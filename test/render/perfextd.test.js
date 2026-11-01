// PERF-EXT30 / PERF-EXT31 (2026-09-25; two players via Mac, "fps issues in the exterior but fine in the interior"
// and "me too my friend.. don't know why. I got a RX6600"; Mac: "I am not getting another player to do the work that
// youre suppose to do"). THE SHADERS STOP PAYING FOR WORK THEIR OUTPUT MULTIPLIES BY NOTHING.
//
//   - PERF-EXT30, the sky. Under the volumetric clouds (the default) both skies are told to stand their own clouds
//     down, and both went on computing them to weight 0: Dynamic Skies (the default sky) blended two sheets at
//     opacity 0 - eight taps and the normals' arithmetic per sky pixel - and the port's dome ran two fbm decks at
//     cover 0, which cannot answer anything but 0. Each is skipped now when its weight is 0.
//   - PERF-EXT31, the air resolve. The lanterns' glow and the shafts are cleared black on every frame they were not
//     drawn (the glow on every day outside, the shafts on every night), and the resolve and the bright pass still
//     read and decoded them per pixel. They are built with each read and without it now, and the frame draws through
//     the one for the images it drew.
//
// THE PICTURE IS THE SAME, AND THAT IS WHAT IS PINNED FIRST: each changed shader is RUN (test/glsl.mjs, in float32) -
// the skies on the uniforms the real renderers upload - against the same text with the skip taken out (the gate
// removed; the full pass), and the two must agree to the bit; and the skipping one must not read the texture (or call
// the noise) it is there to skip. Real-GPU equivalence and the timings are the harnesses'
// (bible/07-Rendering/Performance-Exterior.md, cluster D).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../glsl.mjs';
import { FS as DS_FS, DynamicSkiesRenderer } from '../../src/render/dynamicSkiesRenderer.js';
import { DynamicSkies } from '../../src/systems/dynamicSkies/dynamicSkiesRuntime.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { EnhancedSkyRenderer, skyState, fbm, WEATHER_SKY } from '../../src/render/enhancedSky.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { perspective } from '../../src/world/mat4.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A GL that records every call and hands back each uniform's NAME as its location - so an upload names its uniform. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, TEXTURE1: 1001, TEXTURE2: 1002, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, DEPTH_ATTACHMENT: 36096, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160, VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
/** What a draw uploaded, by uniform name - the bindings the evaluator runs the shader on. */
function uploads(calls) {
  const out = {};
  for (const [k, loc, ...v] of calls) {
    if (typeof loc !== 'string' || !/^uniform/.test(k) || /^uniform1i$|Matrix/.test(k)) continue;
    out[loc] = /v$/.test(k) ? Array.from(v[0]) : v.length === 1 ? v[0] : v;
  }
  return out;
}
/** The fragment shader a constructor compiled, found by a line only it has. */
const fsWith = (calls, needle) => calls.filter((c) => c[0] === 'shaderSource').map((c) => c[2]).find((s) => s.includes(needle));
/** Take a gate out of a shader's text: the line that opens it and the brace that closes it. The TEST's own
 *  construction - so it asserts the gate is there to take out (which is what fails with the gate reverted). */
function ungate(src, open, closeAfter) {
  assert.ok(src.includes(open), `the gate is in the shader: ${open.trim()}`);
  assert.ok(src.includes(`${closeAfter}\n  }\n`), `and closes after: ${closeAfter.trim()}`);
  return src.replace(open, '').replace(`${closeAfter}\n  }\n`, `${closeAfter}\n`);
}
let seed = 0x2545f491;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const f32 = (v) => v.map((x) => Math.fround(x));

// ── PERF-EXT30: DYNAMIC SKIES' TWO LAYERS ─────────────────────────────────────────────────────────────────────────────
// PIN MOVED (OWN-WORK4): the sky is our own pass now, and test/glsl.mjs runs the whole of its FS - so the layers are run
// in place, the whole frame against the same text with the two gates taken out.
const HIGH_OPEN = '  if (uCloudHigh.y > 0.0) {\n', HIGH_CLOSE = '    col = mix(col, ch, dh * uCloudHigh.y * smoothstep(0.0, 0.2, y));';
const LOW_OPEN = '  if (uCloudLow.y > 0.0) {\n', LOW_CLOSE = '    col = mix(col, cl, dl * uCloudLow.y * smoothstep(0.0, 0.16, y));';
/** One state of the real instance through the real renderer's draw(): the uniforms the pass is run on. */
function dsUniforms(weather, minute, cloudsExternal) {
  const dyn = new DynamicSkies({}, { densitySetting: 1 }, () => 0.25);
  const base = 405 * 360 * MINUTES_PER_DAY + 10 * MINUTES_PER_DAY;
  const st = dyn.tick({ minuteOfDay: minute, classicMinutes: base + minute, weather, seconds: 100, dt: 1 / 60, weatherScale: 1 });
  const { gl, calls } = recordingGl();
  const sky = new DynamicSkiesRenderer(gl);
  sky.setState(st); sky.cloudsExternal = cloudsExternal;
  calls.length = 0;
  sky.draw(0.3, 0.2, 65 * Math.PI / 180, 16 / 9);
  return uploads(calls);
}
/** The whole pass along one direction: the colour it draws and the noise it read. The moons are put out so every tap
 *  counted is a layer's. */
function runSkyPass(src, u, dir) {
  const reads = [];
  const f = glslFunctions(src, {
    ...u, uYaw: Math.atan2(dir[0], dir[2]), uPitch: Math.asin(dir[1]), uTanHalfFov: 1, uAspect: 1, vNdc: [0, 0],
    uMasserColor: [0, 0, 0], uSecundaColor: [0, 0, 0],
    texture: (name, uv) => {
      reads.push(name);
      return [0.5 + 0.5 * Math.sin(uv[0] * 12.9898 + uv[1] * 78.233), 0.5 + 0.5 * Math.cos(uv[0] * 4.1 - uv[1] * 7.7), 0.5, 1];
    },
  }, { fp32: true });
  f.main();
  return { col: f.globals.outColor.slice(0, 3), reads };
}

test('PERF-EXT30: Dynamic Skies\' two layers at opacity 0 read nothing and the frame is to the bit what the ungated layers draw; at their own opacity both run whole and agree to the bit (mutants: either gate dropped, the high gated on the low\'s opacity, the gate open at 0)', () => {
  const open = ungate(ungate(DS_FS, HIGH_OPEN, HIGH_CLOSE), LOW_OPEN, LOW_CLOSE);
  let checked = 0, lit = 0;
  for (const [weather, minute] of [['cloudy', 12 * 60], ['sunny', 7 * 60], ['thunder', 17 * 60 + 30], ['rain', 9 * 60]]) {
    const under = dsUniforms(weather, minute, true), own = dsUniforms(weather, minute, false);
    assert.equal(under.uCloudLow[1], 0); assert.equal(under.uCloudHigh[1], 0);   // DS2: what the pass is handed under the clouds
    assert.ok(own.uCloudLow[1] > 0 && own.uCloudHigh[1] > 0, `${weather}: ?clouds=off hands the layers' own opacity`);
    assert.equal(under.uNight, 0, `${weather}: a day - no star band tapped`);
    const highOnly = { ...under, uCloudHigh: own.uCloudHigh };
    for (let k = 0; k < 6; k++) {
      const y = 0.05 + rnd() * 0.9, a = rnd() * 2 * Math.PI, r = Math.sqrt(1 - y * y);
      const dir = [r * Math.cos(a), y, r * Math.sin(a)];
      const g0 = runSkyPass(DS_FS, under, dir), o0 = runSkyPass(open, under, dir);
      assert.deepEqual(g0.reads, [], `${weather}: at opacity 0 no layer reads the noise`);
      assert.equal(o0.reads.length, 3, 'the ungated layers read three - the work the gate saves');
      assert.deepEqual(g0.col, o0.col, `${weather}: the same colour out, to the bit`);
      const g1 = runSkyPass(DS_FS, own, dir), o1 = runSkyPass(open, own, dir);
      assert.equal(g1.reads.length, 3, `${weather}: at their own opacity both layers run`);
      assert.deepEqual(g1.col, o1.col, `${weather}: and agree to the bit`);
      if (g1.col.some((v, i) => v !== g0.col[i])) lit++;
      const g2 = runSkyPass(DS_FS, highOnly, dir), o2 = runSkyPass(open, highOnly, dir);
      assert.equal(g2.reads.length, 1, 'the high layer alone reads its one tap');
      assert.deepEqual(g2.col, o2.col, 'and the answer is the ungated one');
      checked++;
    }
  }
  assert.equal(checked, 24);
  assert.ok(lit > 12, `the layers drew over most of those directions (${lit} of 24) - else the ?clouds=off arm is vacuous`);
  assert.match(read('src/scenes/shared.js'), /if \(dynamicSky\) dynamicSky\.cloudsExternal = !!cloudsShown;/, 'DS2: under the clouds, the default (CLOUD-COMPILE: once they stand)');
});

// ── PERF-EXT30: THE PORT'S DOME ───────────────────────────────────────────────────────────────────────────────────────
function domeFs(calls) {
  const fs = fsWith(calls, 'float fbm(vec2 p)');
  assert.ok(fs, 'the dome FS, as compiled');
  // count the noise: a global the evaluator keeps between calls, bumped by every fbm
  const counted = fs.replace('float fbm(vec2 p) {', 'float fbmCalls;\nfloat fbm(vec2 p) {\n  fbmCalls += 1.0;');
  assert.notEqual(counted, fs);
  return counted;
}
function domePixels(src, u, cover) {
  let calls = 0; const out = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const f = glslFunctions(src, { ...u, uCloudCover: cover, vNdc: [(x + 0.5) / 4 - 1, (y + 0.5) / 3 - 1], gl_FragCoord: [x + 0.5, y + 0.5, 1, 1] }, { fp32: true });
      f.main();
      calls += f.globals.fbmCalls;
      out.push(f.globals.outColor.slice());
    }
  }
  return { calls, out };
}

test('PERF-EXT30: the port\'s dome at cover 0 calls no noise and draws what the ungated dome draws, to the bit; at a real cover it runs both decks and agrees to the bit - which rests on fbm staying under 1 (mutants: the gate dropped, the gate open at 0, an octave\'s weight raised)', () => {
  const { gl, calls } = recordingGl();
  const sky = new EnhancedSkyRenderer(gl);
  const gated = domeFs(calls);
  const open = gated.replace('  if (dir.y > 0.0 && uCloudCover > 0.0) {', '  if (dir.y > 0.0) {');
  assert.notEqual(open, gated, 'the gate is in the dome');
  for (const [weather, minute, pitch] of [['cloudy', 12 * 60, 0.5], ['overcast', 7 * 60, 0.4], ['sunny', 22 * 60, 0.6]]) {
    const st = skyState({ minuteOfDay: minute, weather, seconds: 300, drift: [37.5, -12.25] });
    sky.setState(st);
    sky.cloudsExternal = true;
    calls.length = 0;
    sky.draw(0.4, pitch, 65 * Math.PI / 180, 16 / 9);
    const u = uploads(calls);
    assert.equal(u.uCloudCover, 0, 'VC3: the dome is handed cover 0 under the volumetric clouds');
    const g0 = domePixels(gated, u, 0), o0 = domePixels(open, u, 0);
    assert.equal(g0.calls, 0, `${weather}: at cover 0 the noise is never called`);
    assert.ok(o0.calls > 0, 'the ungated dome calls it (two decks a pixel above the horizon) - the work saved');
    assert.deepEqual(g0.out, o0.out, `${weather}: the same pixels, to the bit`);
    const g1 = domePixels(gated, u, st.cloudCover), o1 = domePixels(open, u, st.cloudCover);
    assert.equal(g1.calls, o1.calls, `${weather}: a real cover runs both decks`);
    assert.deepEqual(g1.out, o1.out, `${weather}: and agrees to the bit`);
    assert.notDeepEqual(g1.out, g0.out, `${weather}: and draws cloud (else the cover arm is vacuous)`);
  }
  // THE PREMISE the gate's exactness rests on: fbm stays under 1 (the octaves' weights sum to 0.96875 and the hash is a
  // fract), no deck carries a bias, and no weather's softness is 0 - so a cover of 0 (smoothstep from 1) is 0 everywhere
  const fs = read('src/render/enhancedSky.js');
  assert.match(fs, /float fbm\(vec2 p\) \{\n {2}float v = 0\.0, a = 0\.5;\n {2}for \(int i = 0; i < 5; i\+\+\) \{ v \+= a \* vnoise\(p\); p = p \* 2\.0 \+ vec2\(17\.1, 9\.7\); a \*= 0\.5; \}/,
    'five octaves from 1/2 halving: 1/2 + ... + 1/32 = 0.96875 - with a hash under 1, a cover of 0 (smoothstep from 1) is 0 everywhere');
  assert.match(fs, /float hash21\(vec2 p\) \{[^\n]*return fract\(p\.x \* p\.y\); \}/, 'the hash is a fract: under 1');
  assert.match(fs, /vec2 hi = deck\(dir, 0\.95, uDrift \* 0\.55, uCloudCover \* 0\.75, uCloudSoft \* 1\.5, 0\.0\);/);
  assert.match(fs, /vec2 lo = deck\(dir, 1\.9, uDrift, uCloudCover, uCloudSoft, 0\.0\);/);
  let max = 0;
  for (let i = 0; i < 20000; i++) max = Math.max(max, fbm(rnd() * 5120, rnd() * 5120));
  assert.ok(max < 0.96875, `the JS twin over 20,000 points peaks at ${max.toFixed(4)}`);
  for (const [w, row] of Object.entries(WEATHER_SKY)) assert.ok(row.soft > 0, `${w}: soft ${row.soft}`);
  assert.match(fs, /gl\.uniform1f\(u\.uCloudCover, this\.cloudsExternal \? 0 : s\.cloudCover\);/, 'VC3: the cover the gate reads');
});

// ── PERF-EXT31: THE AIR RESOLVE ───────────────────────────────────────────────────────────────────────────────────────
/** The air pass's bright and resolve programs as the renderer builds them - bright[glow], resolve[glow][shafts] - and
 *  the fragment source each one linked (the fake GL pairs a program with its shaders through attachShader). */
function airPasses() {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const P = r.air.programs;
  const text = new Map(calls.filter((c) => c[0] === 'shaderSource').map((c) => [c[1], c[2]]));
  const fsOf = (o) => calls.filter((c) => c[0] === 'attachShader' && c[1] === o.p).map((c) => text.get(c[2])).find((t) => !t.includes('gl_Position'));
  return { bright: [0, 1].map((g) => fsOf(P.bright[g])), resolve: [0, 1].map((g) => [0, 1].map((sh) => fsOf(P.resolve[g][sh]))) };
}
/** One fragment through a pass: its output and the samplers it read. `img` answers a sampler's texel. */
function runPass(src, u, img) {
  const reads = [];
  const f = glslFunctions(src, {
    uRect: [0, 0, 320, 200], uCanvas: [320, 200], uGrade: [0.6, 0.8, 0.25, 1.04], uAOMix: 0.9, uThreshold: 0.85, ...u,
    texture: (name, uv) => { reads.push(name); return img(name, uv); },
  }, { fp32: true });
  f.main();
  return { out: f.globals.outColor.slice(), reads };
}

test('PERF-EXT31: the resolve and the bright pass are built for what the frame drew - each variant is the full pass less exactly the reads of the images it is not given, reads nothing else, and with those images black draws the full pass\'s pixel to the bit; the full pass is the one that reads everything (mutants: a read left in, a read dropped from the full pass, the shafts\' term re-spelled)', () => {
  const { bright, resolve } = airPasses();
  const full = resolve[1][1];
  const GLOW = '    c += airDecode(texture(uVol, wuv).rgb);   // VOL1: what elFinish added per fragment, once per pixel and shadowed\n';
  const SHAFTS = ' + texture(uShaft, wuv).rgb * uGrade.y';
  assert.ok(full.includes(`    c += texture(uBloom, wuv).rgb * uGrade.x${SHAFTS};\n${GLOW}`), 'the full resolve: the bloom and the shafts in one sum, then the glow');
  assert.equal(resolve[0][1], full.replace(GLOW, ''), 'no glow: that line out and nothing else');
  assert.equal(resolve[1][0], full.replace(SHAFTS, ''), 'no shafts: that term out and nothing else');
  assert.equal(resolve[0][0], full.replace(GLOW, '').replace(SHAFTS, ''), 'neither');
  const BRIGHT_GLOW = ' + airDecode(texture(uVol, vUV).rgb)';
  assert.ok(bright[1].includes(`vec3 glow = vec3(0.0)${BRIGHT_GLOW};`), 'the full bright pass (LA-POST1: the glow joins each of the four quarters)');
  assert.equal(bright[0], bright[1].replace(BRIGHT_GLOW, ''), 'and the bright pass without the glow');
  let n = 0;
  for (let k = 0; k < 24; k++) {
    const frame = f32([rnd(), rnd(), rnd()]), bloom = f32([rnd() * 0.3, rnd() * 0.3, rnd() * 0.3]), ao = Math.fround(0.5 + rnd() * 0.5);
    const glow = f32([rnd() * 0.5, rnd() * 0.4, rnd() * 0.2]), shaft = f32([rnd() * 0.3, rnd() * 0.3, rnd() * 0.2]);
    const at = { vUV: [0.05 + rnd() * 0.9, 0.05 + rnd() * 0.9], gl_FragCoord: [1 + Math.floor(rnd() * 300) + 0.5, 1 + Math.floor(rnd() * 180) + 0.5, 0, 1] };
    const img = (lit) => (name) => (name === 'uFrame' ? [...frame, 1] : name === 'uBloom' ? [...bloom, 1] : name === 'uAO' ? [ao, 0, 0, 1]
      : name === 'uVol' ? (lit.vol ? [...glow, 1] : [0, 0, 0, 1]) : name === 'uShaft' ? (lit.shaft ? [...shaft, 1] : [0, 0, 0, 1]) : [0, 0, 0, 1]);
    // every frame the pass can make: the images it drew are lit, the ones it did not are cleared black
    for (const g of [0, 1]) {
      for (const sh of [0, 1]) {
        const lit = img({ vol: !!g, shaft: !!sh });
        const v = runPass(resolve[g][sh], at, lit), f = runPass(full, at, lit);
        assert.equal(v.reads.includes('uVol'), !!g, `the glow is read only where it was marched (glow ${g})`);
        assert.equal(v.reads.includes('uShaft'), !!sh, `the shafts only where they drew (shafts ${sh})`);
        assert.ok(f.reads.includes('uVol') && f.reads.includes('uShaft'), 'the full pass reads both on every world pixel - the work saved');
        assert.deepEqual(v.out, f.out, `the full pass's pixel, to the bit (glow ${g}, shafts ${sh})`);
      }
      const lit = img({ vol: !!g, shaft: false });
      const b = runPass(bright[g], at, lit), bf = runPass(bright[1], at, lit);
      assert.equal(b.reads.includes('uVol'), !!g, 'the bright pass reads the glow only where it was marched');
      assert.deepEqual(b.out, bf.out, 'and its pixel is the full pass\'s, to the bit');
    }
    // built without a read the frame DID draw, a pass would drop that light - which is why the choice is the draws' own
    const drawn = img({ vol: true, shaft: true });
    const all = runPass(full, at, drawn).out, none = runPass(resolve[0][0], at, drawn).out;
    assert.ok(all.some((v, i) => v > none[i]), 'the glow and the shafts add light where they drew');
    n++;
  }
  assert.equal(n, 24);
});

// One world frame on the fake GL through to the resolve, as vol1_glow.test.js and vc7b_shafts.test.js drive it; which
// bright and resolve it drew through, by the programs' own handles.
function airFrame({ lights = null, deck = null, sun = [0, 0.42, 0.9], proj = I, fog = ['linear', 0, 0, 2400], key = null, world = true } = {}) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  if (key != null) r.setLighting(new Float32Array([0.1, 0.1, 0.1]), key, new Float32Array([1, 0.9, 0.8]));
  r.setFog(fog[0], fog[1], fog[2], fog[3], new Float32Array([0.6, 0.65, 0.7]));
  r.textures.set('1_1', { id: 't' });
  const mesh = { vao: { id: 'vao' }, buffers: [], bounds: new Float32Array([0, 1, 0, 4]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const one = (kind) => {
    if (lights) r.setPointLights(new Float32Array(lights), new Float32Array([1, 0.8, 0.5]));
    r.beginFrame(proj, I, new Float32Array(sun), kind);
    r.setCloudShadow(deck);
    if (kind === WORLD_FRAME) r.drawMesh(mesh, I, null);
    calls.length = 0;
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });   // the resolve
  };
  one(WORLD_FRAME);
  if (!world) one(0);   // a menu's or a video's frame, after a world frame (the pass's images exist)
  const P = r.air.programs;
  const used = new Set(calls.filter((c) => c[0] === 'useProgram').map((c) => c[1]));
  const brights = [0, 1].filter((g) => used.has(P.bright[g].p));
  const resolves = [[0, 0], [0, 1], [1, 0], [1, 1]].filter(([g, sh]) => used.has(P.resolve[g][sh].p));
  assert.equal(brights.length, world ? 1 : 0, 'one bright pass a world frame (LA-POST8: none for a frame the pass was not prepared for)'); assert.equal(resolves.length, 1, 'one resolve a frame');
  return { ap: r.air, bright: brights[0] ?? null, resolve: resolves[0] };
}

test('PERF-EXT31: the frame draws through the passes built for what it drew, chosen after the images - a lantern in fog marches the glow and takes the glow\'s passes, a day with no light takes the ones without; the beams or the haze take the shafts\' resolve, neither the one without; a frame the pass was not prepared for takes the bare ones (mutants: the choice stuck, made before the images, the haze\'s arm dropped, the bright pass or the resolve always full)', () => {
  const lantern = airFrame({ lights: [0, 2, -3, 12], fog: ['exp', 0.03, 60, 180] });
  assert.equal(lantern.ap.stats.vol, true, 'marched (else this is vacuous)');
  assert.deepEqual([lantern.bright, lantern.resolve], [1, [1, 0]], 'the glow read by the bright pass and the resolve');
  const day = airFrame({ lights: [] });
  assert.equal(day.ap.stats.vol, false, 'no lantern: nothing marched, the image cleared black');
  assert.deepEqual([day.bright, day.resolve], [0, [0, 0]], 'neither reads it');
  // the shafts: the beams (the sun on screen), the haze (a deck, the sun up but behind), both off
  const beams = airFrame({ sun: [0, 0.3, -0.954], proj: perspective(Math.PI / 3, 1.6, 0.1, 400) });
  assert.equal(beams.ap.stats.shafts, true); assert.equal(beams.ap.stats.haze, false);
  assert.deepEqual(beams.resolve, [0, 1], 'the beams drew: the resolve reads them');
  const haze = airFrame({ deck: { map: { id: 'shadowMap' }, rect: [-500, -500, 1 / 1000, 1] } });
  assert.equal(haze.ap.stats.shafts, false); assert.equal(haze.ap.stats.haze, true);
  assert.deepEqual(haze.resolve, [0, 1], 'the haze alone drew into the same image: read');
  const night = airFrame({ key: 0, lights: [0, 2, -3, 12], fog: ['exp', 0.03, 60, 180] });
  assert.equal(night.ap.stats.shafts, false); assert.equal(night.ap.stats.haze, false);
  assert.deepEqual([night.bright, night.resolve], [1, [1, 0]], 'no sun: the shafts\' image is black and not read, while the lanterns\' glow is');
  const menu = airFrame({ lights: [0, 2, -3, 12], fog: ['exp', 0.03, 60, 180], world: false });
  assert.deepEqual([menu.bright, menu.resolve], [null, [0, 0]], 'a frame the pass was not prepared for: black images, the bare resolve (LA-POST8: and no bright pass)');
});
