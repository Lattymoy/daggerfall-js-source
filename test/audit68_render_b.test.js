// AUDIT 68 (2026-09-24), cluster render_b: src/render (renderer.js,
// shadowPass, clouds, water, wisps, ...). Each test pins one confirmed
// finding and fails on the base commit: texture release by recorded key,
// exact wisp wrap, far-cascade redraw, the cirrus clock, one zero origin
// and one compile-and-link.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { SHADOW_CASCADES, SHADOW_FAR_CASCADE_EVERY } from '../src/render/shadowPass.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { TravelJunctionMap } from '../src/ui/travelJunctionMap.js';
import { WISP_VS, WISP_LOOK, SAND_LOOK, WindWispsRenderer } from '../src/render/windWisps.js';
import { VolumetricClouds, QUALITY, MARCH_FS, MARCH_UNIFORMS, SHAPE_METRES, EVOLVE_M_PER_MINUTE } from '../src/render/volumetricClouds.js';
import { skyState, WEATHER_SKY } from '../src/render/enhancedSky.js';
import { glslFunctions } from './glsl.mjs';

/** Every GL call a no-op, every create an object, every check a pass. */
const nullGl = () => new Proxy({}, {
  get: (o, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
    if (typeof k === 'string' && k.startsWith('create')) return () => ({});
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => {};
  },
});

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** The audit39/ww3 Proxy precedent: a real Renderer over a GL that counts
 *  live textures. */
function textureRenderer() {
  let live = 0;
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture') return () => { live++; return {}; };
      if (k === 'deleteTexture') return () => { live--; };
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
      return () => {};
    },
  });
  const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const before = live;   // the constructor's own textures
  return { r, live: () => live - before };
}

const px = { width: 1, height: 1, colors: new Uint8Array([1, 2, 3, 4]) };

test('AUDIT 68 X3-release-texture-variant-keys: release frees a custom variant and combined flags, and nothing past its own record', () => {
  const { r, live } = textureRenderer();
  const size = r.textures.size;
  for (const opts of [
    { mips: false, variant: '#travelto' },
    { smooth: true, mips: false },
    { smooth: true, mips: false, variant: '#travelto' },
    { smooth: true, opaque: true },
  ]) {
    r.uploadTexture('travelto', 'junction-1', px, opts);
    assert.equal(live(), 1);
    assert.equal(r.releaseTexture('travelto', 'junction-1'), true, `${JSON.stringify(opts)} is released`);
    assert.equal(live(), 0, 'and its GL texture deleted');
    assert.equal(r.textures.size, size, 'and its cache entry gone');
  }
  // records already carry '#' (hudLarge `${name}#${fi}`): releasing 'foo'
  // must not free 'foo#1'
  r.uploadTexture('img', 'foo', px);
  r.uploadTexture('img', 'foo', px, { smooth: true });
  r.uploadTexture('img', 'foo#1', px);
  assert.equal(r.releaseTexture('img', 'foo'), true);
  assert.ok(r.textures.has('img_foo#1') && !r.textures.has('img_foo') && !r.textures.has('img_foo#smooth'));
  assert.equal(live(), 1);
});

test('AUDIT 68 X3-release-texture-variant-keys: fifty junction-map redraws hold one texture, and dispose frees it', () => {
  const { r, live } = textureRenderer();
  for (const filter of [0, 1]) {
    const jm = new TravelJunctionMap({ settings: () => ({ junctionMapFilterMode: filter }) });
    jm.enabled = true;
    for (let i = 0; i < 50; i++) {
      jm.draw({ x: 500 + i, y: 250 }, 0);
      jm.drawPanel(r, { width: 320, height: 200 });
    }
    assert.equal(live(), 1, `filter ${filter}: the panel's one texture, not fifty`);
    jm.dispose(r);
    assert.equal(live(), 0, 'dispose frees it');
  }
});

test('AUDIT 68 S17-wisp-wrap-gust: no wisp jumps when the wind\'s travel wraps - the shader\'s own position moves by the step times its gust', () => {
  const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const step = 0.1;
  for (const look of [WISP_LOOK, SAND_LOOK]) {
    const r = new WindWispsRenderer(nullGl(), look);
    const box = look.box;
    // the eye box's own wrap is the lab's law (moving reveals other wisps): measure the move modulo the box
    const circ = (d) => d - box * Math.round(d / box);
    const f = glslFunctions(WISP_VS, {
      uVP: I16, uEye: [0, 0, 0], uTime: 12.3, uBox: box, uStrength: 0.6, uWindV: [3, 0], uWindOff: [0, 0],
      uLen: [...look.len], aCorner: [0.5, 0.5], aSeed: [10, 5, 20, 0],
    }, { fp32: true });
    for (const seed of [0.07, 0.31, 0.37, 0.5, 0.77, 0.93]) {
      f.globals.aSeed = [10, 5, 20, Math.fround(seed)];
      const at = () => {
        f.globals.uWindOff = [...r.windOff];   // float32 already, as the upload hands it over
        f.main();
        return [...f.globals.gl_Position];
      };
      // straddle every whole box up to fifty: wherever the renderer wraps its travel, one of these crosses it
      for (let n = 1; n <= 50; n++) {
        const w = n * box - step / 2;
        r.windOff[0] = w; r.windOff[1] = 0;
        const a = at();
        r.advance([step, 0]);
        const b = at();
        const moved = Math.hypot(circ(b[0] - a[0]), circ(b[2] - a[2]));
        assert.ok(moved <= step * 1.2 + 1e-3, `${look === SAND_LOOK ? 'sand' : 'wisps'} seed ${seed}: travel ${w.toFixed(2)} -> ${r.windOff[0].toFixed(2)} moved ${moved.toFixed(3)} m, not the step`);
      }
    }
  }
});

/** A real Renderer on the enhanced lane, its ShadowPass fed one mesh a frame (el8_contact's shape). */
function shadowHost() {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const sun = new Float32Array([0.3, 0.8, 0.2]);
  const make = () => {
    const r = new Renderer({ getContext: () => nullGl(), clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
    r.setLightingLane(EL_LANE);
    r.textures.set('1_1', {});
    // one mesh per renderer: the pass remembers placements on the mesh itself
    r.mesh = { vao: {}, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] };
    return r;
  };
  const eyeAt = (x) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -2, 0, 1]);
  const frame = (r, x, { sunScale = 0.55, draw = true } = {}) => {
    r.setLighting(new Float32Array([0.5, 0.5, 0.5]), sunScale, new Float32Array([1, 1, 1]));
    r.beginFrame(I, eyeAt(x), sun, WORLD_FRAME);
    if (draw) r.drawMesh(r.mesh, I, null);
    r.drawScreenQuad({}, { x: 0, y: 0, w: 10, h: 10 });
  };
  const offFrameNext = (r, x) => { while ((r.shadows.frameNo + 1) % SHADOW_FAR_CASCADE_EVERY === 0) frame(r, x); };
  return { make, frame, offFrameNext };
}
const FAR = SHADOW_CASCADES.length - 1;

test('AUDIT 68 S17-far-cascade-shift: after a floating-origin recenter the far cascade is drawn under the new origin\'s matrix, even on its off frame', () => {
  const { make, frame, offFrameNext } = shadowHost();
  const far = FAR;
  // the recenter: world.js shifts the origin 819.2 units between two frames
  const r = make(), sp = r.shadows;
  for (let i = 0; i < 3; i++) frame(r, 400);
  offFrameNext(r, 400);
  r.shadowOriginShift([-819.2, 0, 0]);
  frame(r, 400 - 819.2);
  assert.notEqual(sp.frameNo % SHADOW_FAR_CASCADE_EVERY, 0, 'the far cascade\'s off frame');
  assert.equal(sp.stats.cascadesDrawn, SHADOW_CASCADES.length, 'every cascade drawn on the crossing frame');
  assert.deepEqual([...sp.sunVP[far]], [...sp._sunVPNew[far]], 'the far matrix is the new origin\'s, not the one 819 units away');
  // the steady cadence resumes after it
  offFrameNext(r, 400 - 819.2);
  frame(r, 400 - 819.2);
  assert.equal(sp.stats.cascadesDrawn, SHADOW_CASCADES.length - 1, 'EL8: held again on the next off frame');
});

test('AUDIT 68 S17-far-cascade-shift: a sun returning after a night or an empty frame draws its far cascade at once, never the map held from before', () => {
  const { make, frame } = shadowHost();
  const far = FAR;
  // the sun returns: a night (point frames) or an empty frame (no records) between two suns holds no far map
  // (a frame's records are replayed at the NEXT beginFrame, so the empty frame is the one after the draw-less one)
  const night = make(), empty = make();
  for (const q of [night, empty]) for (let i = 0; i < 3; i++) frame(q, 0);
  frame(night, 300, { sunScale: 0 });
  if ((night.shadows.frameNo + 1) % SHADOW_FAR_CASCADE_EVERY === 0) frame(night, 300, { sunScale: 0 });
  frame(empty, 300, { draw: false });
  if ((empty.shadows.frameNo + 2) % SHADOW_FAR_CASCADE_EVERY === 0) frame(empty, 300, { draw: false });
  frame(empty, 300);
  assert.equal(empty.shadows.kind, null, 'an empty frame');
  for (const [name, q] of [['a night', night], ['an empty frame', empty]]) {
    const sq = q.shadows;
    assert.notEqual(sq.kind, 'sun');
    frame(q, 300);
    assert.equal(sq.kind, 'sun');
    assert.notEqual(sq.frameNo % SHADOW_FAR_CASCADE_EVERY, 0, 'the far cascade\'s off frame');
    assert.equal(sq.stats.cascadesDrawn, SHADOW_CASCADES.length, `after ${name}: the returning sun draws its far cascade here, now`);
    assert.deepEqual([...sq.sunVP[far]], [...sq._sunVPNew[far]]);
  }
});

test('AUDIT 68 S17-cirrus-boil-wrap: the ice\'s streaks read on across every wrap of the clouds\' clocks - the real upload into the shader\'s own read', () => {
  // the uniforms VolumetricClouds.update() uploads at a game minute (vc7a's recording-GL shape, driven through update)
  const uploadAt = (minutes) => {
    const c = Object.create(VolumetricClouds.prototype);
    Object.assign(c, { q: QUALITY.default, cam: [0, 0], shift: [0, 0], profile: null, weather: null, state: null, row: null, cells: [], noise: { shape: { tex: 1 }, detail: { tex: 2 } } });
    const got = {};
    c.gl = new Proxy({}, {
      get: (_, k) => (typeof k === 'string' && k.startsWith('uniform') ? (loc, ...v) => { got[loc] = v.length === 1 ? v[0] : v; }
        : (typeof k === 'string' && k.toUpperCase() === k ? 1 : () => {})),
    });
    c.setState(skyState({ minuteOfDay: minutes % 1440, weather: 'sunny', classicMinutes: minutes }), WEATHER_SKY.sunny, 'sunny', 1e9, [0, 0]);
    Object.assign(c, { mu: Object.fromEntries(MARCH_UNIFORMS.map((n) => [n, n])), su: {}, map: {}, shadowMap: {}, stripe: 0, shadowStripe: 0, sweeps: 0 });
    c.update([0, 0, 320, 200]);
    return got;
  };
  // ...and the volume coordinate MARCH_FS's cirrus() reads its streaks at, under them
  const streakY = (u) => {
    let y = null;
    const f = glslFunctions(MARCH_FS, {
      uCirrus: u.uCirrus, uEvolve: u.uEvolve, uShift: [0, 0], uCirrusDir: [0, 1, 0], uCirrusLight: [1, 1, 1], uCloudLit: [1, 1, 1],
      textureLod: (sampler, p, lod) => { if (sampler === 'uShape' && lod > 0.5) y = p[1]; return [1, 1, 1, 1]; },
    });
    f.cirrus([0, 0, 0], [0.3, 0.8, 0.52]);
    return y;
  };
  const circ = (d) => Math.abs(d - Math.round(d));   // the volume REPEATs: a whole volume is no move
  const P = SHAPE_METRES / EVOLVE_M_PER_MINUTE;   // the slab's boil wraps every P game minutes
  const perMinute = 0.5 * EVOLVE_M_PER_MINUTE / SHAPE_METRES;
  for (const wrapAt of [P, 2 * P, 3 * P, 2050000 * P, 2050001 * P]) {
    const a = streakY(uploadAt(wrapAt - 0.01)), b = streakY(uploadAt(wrapAt + 0.01));
    assert.ok(Number.isFinite(a) && Number.isFinite(b), 'the streaks are read');
    assert.ok(Math.abs(circ(b - a) - 0.02 * perMinute) < 1e-6, `minute ${wrapAt.toFixed(1)}: the streaks moved ${circ(b - a).toFixed(4)} of the volume across the wrap, not the boil's 0.02 minute`);
  }
});

test('AUDIT 68 S16-v-replay-origin-alloc: an origin-less batch reads ONE frozen zero in the draw and both replays - no [0, 0, 0] minted per batch per pass', async () => {
  const { ZERO_ORIGIN } = await import('../src/render/bounds.js');
  assert.ok(Object.isFrozen(ZERO_ORIGIN));
  assert.deepEqual([...ZERO_ORIGIN], [0, 0, 0]);
  for (const f of ['src/render/shadowPass.js', 'src/render/airPass.js', 'src/render/renderer.js']) {
    const s = rd(f);
    assert.doesNotMatch(s, /origin \|\| \[0, 0, 0\]/, `${f}: no fresh zero per batch`);
    assert.match(s, /import \{[^}]*\bZERO_ORIGIN\b[^}]*\} from '\.\/bounds\.js';/, `${f}: the leaf's one zero`);
  }
  assert.doesNotMatch(rd('src/render/renderer.js'), /const ZERO_ORIGIN = /, 'no second copy in the renderer');
});

test('AUDIT 68 S17-gl-program-dup: one compile and link - the order every pass wrote, the far ring\'s prefixes, and no other home under src/render', async () => {
  const { buildProgram } = await import('../src/render/glProgram.js');
  const calls = [];
  let ok = { COMPILE_STATUS: true, LINK_STATUS: true };
  const gl = new Proxy({}, {
    get: (_, k) => {
      if (typeof k !== 'string') return undefined;
      if (k === k.toUpperCase()) return k;
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return (o, p) => { calls.push(k); return ok[p]; };
      if (k === 'getShaderInfoLog' || k === 'getProgramInfoLog') return () => 'ERROR: 0:1: boom';
      return (...a) => { calls.push(k === 'createShader' || k === 'shaderSource' ? `${k}:${a[a.length - 1]}` : k); return {}; };
    },
  });
  const prog = buildProgram(gl, 'vs-src', 'fs-src');
  assert.ok(prog);
  assert.deepEqual(calls, [
    'createProgram',
    'createShader:VERTEX_SHADER', 'shaderSource:vs-src', 'compileShader', 'getShaderParameter', 'attachShader',
    'createShader:FRAGMENT_SHADER', 'shaderSource:fs-src', 'compileShader', 'getShaderParameter', 'attachShader',
    'linkProgram', 'getProgramParameter',
  ]);
  ok = { COMPILE_STATUS: false, LINK_STATUS: true };
  assert.throws(() => buildProgram(gl, 'v', 'f'), { message: 'ERROR: 0:1: boom' }, 'the driver\'s log, as every pass threw it');
  assert.throws(() => buildProgram(gl, 'v', 'f', 'far ring'), { message: 'far ring shader: ERROR: 0:1: boom' });
  ok = { COMPILE_STATUS: true, LINK_STATUS: false };
  assert.throws(() => buildProgram(gl, 'v', 'f', 'far ring'), { message: 'far ring link: ERROR: 0:1: boom' });
  const homes = readdirSync(new URL('../src/render/', import.meta.url)).filter((f) => f.endsWith('.js') && /COMPILE_STATUS/.test(rd(`src/render/${f}`)));
  assert.deepEqual(homes, ['glProgram.js'], 'every pass builds through the leaf');
});
