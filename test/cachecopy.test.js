// CACHE-COPY (2026-10-07, Mac: "instead of one of my developers fixing the flickering shadow issue, they just turned on
// the non-baked version on by default, which really really kill performance. Instead of such a half baked fix, I want to
// fix the flickering issue properly"; bible/07-Rendering/Enhanced-Lighting-Arc.md CACHE-COPY).
//
// SC1's static shadow cache reached the live layers by six blitFramebuffer(DEPTH_BUFFER_BIT) calls a lamp, out of a layer
// of one depth array into a layer of another. On Windows - ANGLE over Direct3D 11, every browser's WebGL there - that blit
// is a quad (Blit11::copyDepth) whose shader declares a Texture2D and is handed the layer's TEXTURE2DARRAY view: a D3D11
// view-dimension mismatch, its read left to the driver. The cached shadows were the driver's, and they changed whenever
// the cache did - the whole room's at once, which the anti-flicker patch's CACHE-OFF answered by turning the cache off.
// The copy is a draw now (render/shadowPass.js _blitSlot) and the cache is on again.
//
// Pinned on the fake GL: the copy is a triangle a face with the copy program into the slot's own live layer, reading
// its own layer of the cache bound on unit 0, under ALWAYS with LESS put back and the cache unbound - no blit; the copy
// shader fetches its own texel at highp and writes it as the fragment's depth over a triangle that covers the face; the
// door is SC1's again (on unless `?shadowcache=off` - no device switch, no Features part, a page's renderer on); the
// copy binds its array through the renderer's tracked binder, so a replay after it draws with its own; and the GPU check
// (tools/fixtures/depth-copy-check.html, for the machines that flickered) copies with the shipped shaders, reads back
// with a twin of the pattern its shader writes, and names a blind check, then a wrong draw copy, before anything else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, syncLightingLane } from '../src/render/enhancedLighting.js';
import { DEPTH_COPY_VS, DEPTH_COPY_FS, SHADOW_POINT_SIZE, shadowCacheOn } from '../src/render/shadowPass.js';
import { SHADOW_TUNING } from '../src/render/shadowPass.js';
import { PREF_DEFAULTS, setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { readFileSync } from 'node:fs';
import { PATTERN_GLSL, patternOf, unitsOf, CLEARED, verdictOf } from '../src/tools/depthCopyCheck.js';
SHADOW_TUNING.override = false;   // EL8's schedule: the two lamps nearest the eye redraw every frame

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** The GL constants this file reads by value (the real ones), each distinct - the rest are 1. */
const GL = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, TRIANGLES: 4, LESS: 513, ALWAYS: 519, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };

function recordingGl() {
  const calls = [];
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in GL) return GL[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** A room under two lamps either side of the eye, a townsman walking between them (near both: each nearest-two lamp
 *  copies its cache and draws him on top, every frame). */
function room() {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('201_1', { id: 't2011' }); r.textures.set('1_1', { id: 't11' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  const walls = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 12]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const man = { archive: 201, record: 1, vao: { id: 'vao-man' }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: [0, 0, 0.5], bounds: new Float32Array([0, 0.9, 0, 1]) };
  const lights = new Float32Array([1.5, 2.5, 0, 10, -1.5, 2.5, 0, 10]);
  const frame = () => {
    r.setPointLights(lights, new Float32Array([1, 1, 1, 1, 1, 1]));
    calls.length = 0;
    r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
    const shadowCalls = calls.slice();
    r.drawMesh(walls, I, null);
    man.origin = [man.origin[0], 0, man.origin[2] + 0.01];   // a step a frame: never still
    r.drawBillboards([man], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return shadowCalls;
  };
  return { r, sp: r.shadows, man, frame };
}

/** Walk a frame's calls with the GL state they set, and hand each copy draw (drawArrays under the copy program) to
 *  `onCopy` with that state; `onDraw` sees every drawElements. */
function walk(sp, calls, { onCopy = () => {}, onDraw = () => {}, onCall = () => {} } = {}) {
  const s = { prog: null, fbo: null, unit: null, arrayOn: new Map(), layer: null, cache: null, depthFunc: null, viewport: null, vao: null };
  for (const c of calls) {
    const [k, a, b] = c;
    if (k === 'useProgram') s.prog = a;
    else if (k === 'bindFramebuffer' && a === GL.FRAMEBUFFER) s.fbo = b;
    else if (k === 'activeTexture') s.unit = a;
    else if (k === 'bindTexture' && a === GL.TEXTURE_2D_ARRAY) s.arrayOn.set(s.unit, b);
    else if (k === 'uniform1i' && a === 'uLayer') s.layer = b;
    else if (k === 'uniform1i' && a === 'uCache') s.cache = b;
    else if (k === 'depthFunc') s.depthFunc = a;
    else if (k === 'viewport') s.viewport = c.slice(1);
    else if (k === 'bindVertexArray') s.vao = a;
    else if (k === 'drawArrays' && s.prog === sp.programs.copy.p) onCopy(c, s);
    else if (k === 'drawElements') onDraw(c, s);
    onCall(c, s);
  }
  return s;
}

test('CACHE-COPY: the cache reaches the live layers BY A DRAW - one triangle a face with the copy program into the slot\'s own live layer, reading that layer of the cache on unit 0, under ALWAYS (the replays\' LESS put back), the cache unbound after; no blitFramebuffer anywhere (mutants: the draw dropped; the compare left LESS; LESS not put back; the layer without its slot; the unit not chosen; the cache left bound)', () => {
  const { sp, frame } = room();
  frame(); frame(); frame();   // records; the caches drawn (the man's first sight is still); his step seen: drawn without him
  for (let f = 0; f < 3; f++) {
    const calls = frame();
    assert.equal(calls.filter((c) => c[0] === 'blitFramebuffer').length, 0, `frame ${f}: no blit - on Direct3D a depth blit out of an array's layer is no copy`);
    const copied = new Map();
    walk(sp, calls, {
      onCopy: (c, s) => {
        const at = sp.pointFbos.indexOf(s.fbo);
        assert.ok(at >= 0, 'into a live layer');
        assert.deepEqual(c.slice(1), [GL.TRIANGLES, 0, 3], 'the full-screen triangle');
        assert.equal(s.layer, at, 'it reads ITS OWN layer of the cache: slot k face f is layer 6k + f in both arrays');
        assert.equal(s.cache, 0); assert.equal(s.unit, GL.TEXTURE0); assert.equal(s.arrayOn.get(GL.TEXTURE0), sp.cacheTex, 'the cache, on the unit the copy reads');
        assert.equal(s.depthFunc, GL.ALWAYS, 'every texel written, whatever the layer held');
        assert.deepEqual(s.viewport, [0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE], 'the whole face');
        const k = Math.floor(at / 6);
        copied.set(k, (copied.get(k) ?? 0) | (1 << (at % 6)));
      },
      onDraw: (c, s) => {
        assert.equal(s.depthFunc === GL.ALWAYS, false, 'a replay after a copy keeps the nearest caster: LESS is back');
        assert.notEqual(s.arrayOn.get(GL.TEXTURE0), sp.cacheTex, 'and no replay runs with the cache still bound');
      },
    });
    assert.equal(copied.size, 2, `frame ${f}: both lamps copied their caches (the man near both)`);
    for (const [k, faces] of copied) assert.equal(faces, 0b111111, `slot ${k}: all six faces`);
    assert.ok([...copied.keys()].some((k) => k > 0), 'a slot past the first, where a layer without its slot is another lamp\'s');
  }
});

test('CACHE-COPY: the copy shader fetches the cache at its own texel of the layer, at HIGHP, and writes it as the fragment\'s depth - no compare sampler (it reads 0 or 1, not a depth) - over a triangle made of gl_VertexID that covers the face (mutants: mediump; the texel not its own; a shadow sampler)', () => {
  assert.match(DEPTH_COPY_FS, /^#version 300 es\n/);
  assert.match(DEPTH_COPY_FS, /\nprecision highp sampler2DArray;\n/, 'the sampler at highp - a mediump fetch rounds the 24-bit depth to eleven bits');
  assert.match(DEPTH_COPY_FS, /\nuniform sampler2DArray uCache;\n/);
  assert.ok(!/Shadow/.test(DEPTH_COPY_FS), 'a plain array sampler: the cache has no compare mode, and a compare would answer 0 or 1');
  assert.match(DEPTH_COPY_FS, /\n {2}gl_FragDepth = texelFetch\(uCache, ivec3\(gl_FragCoord\.xy, uLayer\), 0\)\.r;\n/, 'the texel under the fragment, of the layer asked, level 0');
  assert.match(DEPTH_COPY_VS, /vec2 p = vec2\(float\(\(gl_VertexID << 1\) & 2\), float\(gl_VertexID & 2\)\);\n {2}gl_Position = vec4\(p \* 2\.0 - 1\.0, 0\.0, 1\.0\);/);
  // the triangle that formula makes, in JS: it holds every corner of the face's clip square
  const v = [0, 1, 2].map((id) => [((id << 1) & 2) * 2 - 1, (id & 2) * 2 - 1]);
  assert.deepEqual(v, [[-1, -1], [3, -1], [-1, 3]]);
  const side = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (const p of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) assert.ok(side(p, v[0], v[1]) >= 0 && side(p, v[1], v[2]) >= 0 && side(p, v[2], v[0]) >= 0, `corner ${p}`);
});

test('CACHE-COPY: the door is SC1\'s again - on unless `?shadowcache=off`; no device switch, no Features part, and a page\'s renderer starts with the cache on (CACHE-OFF retired: its off-unless-asked, the device\'s word, the "Shadow cache (faster, may flicker)" part and the console line); `setShadowCache(false)` still turns it off (mutants: the door asked on; the renderer\'s own default off)', () => {
  assert.equal(shadowCacheOn(''), true, 'asked by nothing: on');
  assert.equal(shadowCacheOn('?shadowcache=off'), false, 'the comparison\'s door');
  assert.equal(shadowCacheOn('?shadowcache=on'), true);
  resetPrefs();
  globalThis.localStorage = { getItem: (k) => (k === 'dfjs.shadowCache' ? 'off' : null), setItem() {}, removeItem() {} };
  try {
    setPref('shadowCache', false);
    assert.equal(shadowCacheOn(''), true, 'neither the device\'s word nor a stored pref turns it');
  } finally { delete globalThis.localStorage; resetPrefs(); }
  assert.equal('shadowCache' in PREF_DEFAULTS, false, 'no switch on the Features row');
  const info = console.info, said = [];
  console.info = (...a) => said.push(a.join(' '));
  globalThis.document = {};
  try {
    const { canvas } = recordingGl();
    const page = new Renderer(canvas);
    page.setLightingLane(EL_LANE);
    assert.equal(page.shadows.cacheOn, true, 'a page asked by nothing: the cache, as SC1 built it');
    page.setShadowCache(false);
    assert.equal(page.shadows.cacheOn, false, 'the lane\'s door still turns it off');
    page.setShadowCache(true);
    assert.equal(page.shadows.cacheOn, true);
    syncLightingLane(page, '?shadowcache=off');
    assert.equal(page.shadows.cacheOn, false, 'the host\'s one call reads the page\'s door');
    syncLightingLane(page, '');
    assert.equal(page.shadows.cacheOn, true, 'and a page asked by nothing is answered on');
  } finally { delete globalThis.document; console.info = info; }
  assert.equal(said.filter((s) => s.includes('[shadow]')).length, 0, 'and nothing said about it at construction');
});

test('CACHE-COPY: the copy binds its empty vertex array through the renderer\'s tracked binder - the second lamp\'s copy, after the first lamp drew the man, would otherwise leave the tracker naming his array and his next draw would run on the copy\'s (mutant: the array bound behind the tracker)', () => {
  const { sp, man, frame } = room();
  frame(); frame(); frame();
  for (let f = 0; f < 3; f++) {
    let draws = 0, copies = 0;
    walk(sp, frame(), {
      onCopy: (c, s) => { copies++; assert.equal(s.vao, sp._copyVao, 'the copy draws on its own empty array'); },
      onDraw: (c, s) => {
        draws++;
        assert.notEqual(s.vao, sp._copyVao, `frame ${f}: a replay draw on the copy's array - the tracker skipped its bind`);
      },
    });
    assert.ok(copies >= 12 && draws > 0, `frame ${f}: two lamps copied and the man drawn over them (${copies} copies, ${draws} draws)`);
  }
  assert.ok(man.vao, 'the man has an array of his own');
});

test('CACHE-COPY: the GPU check for the machines that flickered (tools/fixtures/depth-copy-check.html, src/tools/depthCopyCheck.js) copies with shadowPass.js\'s own copy shaders - never a restated pair - reads back with a JS twin of the very pattern its shader writes, two layers\' values thousands of 24-bit units apart, and its verdict names a blind check first, then a wrong draw copy, before the blit (mutants: the twin drifting from the shader; the control not read; the verdict reading the blit before the draw copy)', () => {
  const mod = readFileSync(new URL('../src/tools/depthCopyCheck.js', import.meta.url), 'utf8');
  assert.match(mod, /^import \{ DEPTH_COPY_VS, DEPTH_COPY_FS \} from '\.\.\/render\/shadowPass\.js';$/m, 'the shipped pair, one home');
  assert.equal(/gl_FragDepth = texelFetch\(/.test(mod), false, 'no copy shader of its own');
  const page = readFileSync(new URL('../tools/fixtures/depth-copy-check.html', import.meta.url), 'utf8');
  assert.match(page, /import \{ runDepthCopyCheck, verdictOf \} from '\/src\/tools\/depthCopyCheck\.js';/);
  // the twin: the shader's coefficients, read off its own text, give the JS pattern at every texel, layer and round
  const m = /\(p\.x \* (\d+) \+ p\.y \* (\d+) \+ layer \* (\d+) \+ round \* (\d+)\) % (\d+)/.exec(PATTERN_GLSL);
  assert.ok(m, 'the shader\'s pattern');
  const [a, b, c, d, n] = m.slice(1).map(Number);
  for (const [x, y, l, r] of [[0, 0, 0, 0], [127, 3, 71, 3], [511, 511, 5, 7], [64, 200, 40, 1]]) assert.equal(patternOf(x, y, l, r), (x * a + y * b + l * c + r * d) % n, `(${x}, ${y}) layer ${l} round ${r}`);
  assert.ok(unitsOf(n - 1) < CLEARED, 'every value below the clear\'s');
  for (let l = 0; l < 72; l++) assert.ok(Math.abs(unitsOf(patternOf(9, 9, l, 2)) - unitsOf(patternOf(9, 9, (l + 1) % 72, 2))) > 1000, `layers ${l} and ${l + 1} told apart`);
  // the verdict's order
  const r = (blit, draw, control = 10, other = control) => ({ error: 0, texels: 10, blit: { wrong: blit, byRound: [blit] }, draw: { wrong: draw }, control: { wrong: control, otherLayer: other } });
  assert.match(verdictOf(r(0, 0, 9)), /^THE CHECK COULD NOT SEE A WRONG COPY/, 'a control not wholly wrong: a blind check');
  assert.match(verdictOf(r(0, 0, 10, 4)), /^THE CHECK COULD NOT SEE A WRONG COPY/, 'and every wrong texel told as another layer\'s');
  assert.match(verdictOf(r(10, 3)), /^THE DRAW COPY CAME BACK WRONG HERE/, 'a wrong draw copy before a wrong blit');
  assert.match(verdictOf(r(10, 0)), /^The old blit is broken on this GPU \(10 of 10 texels wrong\) and the draw copy is exact/);
  assert.match(verdictOf(r(0, 0)), /^Both copies exact/);
});
