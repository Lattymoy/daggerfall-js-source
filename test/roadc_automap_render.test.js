// ROAD-C c2/S6: THE RENDER MODES AND THE WATER TINT - the second half of
// Assets/Shaders/DaggerfallAutomap.shader.
//
// WHAT THESE PINS ARE FOR. Nothing in CI can look at a pixel, so a
// shader arm is exactly the kind of law that ships broken and stays
// broken (c2's own standing warning: two data-gated pins have already
// rotted into existence checks). So this file pins the shader THREE
// ways, none of which is "the uniform exists":
//   1. the CONSTANTS, digit for digit against the C# - 0.75, the two
//      wireframe colours, 0.3/0.59/0.11, 20.0 and the 0.6 floor, and
//      the water lerp;
//   2. the ORDER of the statements those constants live in, because
//      every one of the three DFU quirks here IS an ordering (the water
//      tint before the dim; the wireframe constant before the
//      grayscale; and `min(y, slice)`, which is what makes the
//      above-slice dim identically zero);
//   3. the BEHAVIOUR on the real Renderer over the EV6 counting
//      Proxy-GL - the blend flip, the depth mask that stays ON, the
//      line index buffer built once and reused, and the four draw
//      groups the window issues.
//
// THE ONE THING A PIN MUST NOT DO HERE is re-derive the dim in JS and
// compare it to itself. Where a pin below computes, it computes the C#'s
// arithmetic by hand from the C# source and compares to the port's
// shader text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identity } from '../src/world/mat4.js';
import {
  Renderer, AUTOMAP_MODE, AUTOMAP_NO_WATER, AUTOMAP_WATER_COLOR, buildWireIndices,
} from '../src/render/renderer.js';
import {
  AutomapWindow, RENDER_MODES, ABOVE_SLICE_MODES, nextRenderMode,
  HOTKEYS_DOWN, HOTKEY_VERBS, automapRenderMode,
  signalAutomapReset, resetAutomapWindowState, _setAutomapArt,
} from '../src/ui/automapWindow.js';
import { automapTooltipFor } from '../src/ui/automapText.js';
import { _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const RENDERER = src('src/render/renderer.js');
/** The mesh fragment shader's automap block - from the `amMode > 0`
 *  gate to the end of the function it closes. */
const AUTOMAP_BLOCK = (() => {
  const at = RENDERER.indexOf('  if (amMode > 0) {');
  assert.ok(at > 0, 'the automap block is findable');
  return RENDERER.slice(at, RENDERER.indexOf('}`;', at));
})();

// ─────────────────────────────────────────────────────────────────────
// 1. THE CONSTANTS
// ─────────────────────────────────────────────────────────────────────
test('c2/S6 the shader constants, digit for digit against DaggerfallAutomap.shader', () => {
  // the TRANSPARENT arm: `outColor.a = 0.75;` (pass 2, the target-4.0
  // SubShader - NOT the 0.65 of the target-3.0 fallback SubShader,
  // which Unity never selects on a machine that runs DFU)
  assert.match(AUTOMAP_BLOCK, /outColor\.a = 0\.75;/, 'the transparent alpha is 0.75');
  assert.equal(/outColor\.a = 0\.65/.test(AUTOMAP_BLOCK), false,
    'and NOT the 3.0 fallback SubShader\'s 0.65 - that pass is never the one that runs');

  // the WIREFRAME constants, both of them
  assert.match(AUTOMAP_BLOCK, /vec4\(0\.9, 0\.9, 0\.7, 0\.6\)/, 'wireframe colour = float4(0.9, 0.9, 0.7, 0.6)');
  assert.match(AUTOMAP_BLOCK, /vec4\(0\.25, 0\.25, 0\.25, 0\.6\)/, 'wireframe grayscale = float4(0.25, 0.25, 0.25, 0.6)');
  // the grayscale wireframe colour is NOT the luminance of the colour
  // one - which is why DFU spells it out, and why a port that "derives"
  // it is wrong. 0.3*0.9 + 0.59*0.9 + 0.11*0.7 = 0.878, not 0.25.
  assert.ok(Math.abs((0.3 * 0.9 + 0.59 * 0.9 + 0.11 * 0.7) - 0.878) < 1e-12);

  // the luminance weights and the dim band
  assert.match(AUTOMAP_BLOCK, /dot\(outColor\.rgb, vec3\(0\.3, 0\.59, 0\.11\)\)/, 'RENDER_IN_GRAYSCALE luminance');
  assert.match(AUTOMAP_BLOCK, /outColor\.rgb \*= 1\.0 - clamp\(sliceDist \/ 20\.0, 0\.0, 0\.6\);/,
    '1 - max(0, min(0.6, dist/20)) - the 20.0 divisor with its 0.6 (40% brightness) floor');

  // the water lerp, and its default colour/level
  assert.match(AUTOMAP_BLOCK, /vWorldPos\.y <= uAutomapWaterLevel/, 'the water test is `worldPos.y <= _WaterLevel`');
  assert.match(AUTOMAP_BLOCK, /mix\(outColor\.rgb, uAutomapWaterColor\.rgb, uAutomapWaterColor\.a\)/,
    'lerp(rgb, _WaterColor.rgb, _WaterColor.a)');
  assert.deepEqual([...AUTOMAP_WATER_COLOR], [0.0, 0.3, 0.5, 0.4], 'the _WaterColor property default');
  assert.equal(AUTOMAP_NO_WATER, -10000, 'the _WaterLevel property default - AddWater leaves it when the block is dry');
});

test('c2/S6 the ORDER is the law: water before the dim, the mode constant before the grayscale', () => {
  const iWater = AUTOMAP_BLOCK.indexOf('mix(outColor.rgb, uAutomapWaterColor.rgb');
  const iWire = AUTOMAP_BLOCK.indexOf('vec4(0.9, 0.9, 0.7, 0.6)');
  const iAlpha = AUTOMAP_BLOCK.indexOf('outColor.a = 0.75;');
  const iDim = AUTOMAP_BLOCK.indexOf('outColor.rgb *= 1.0 - clamp');
  const iGray = AUTOMAP_BLOCK.indexOf('dot(outColor.rgb, vec3(0.3, 0.59, 0.11))');
  assert.ok(iWater > 0 && iWire > 0 && iAlpha > 0 && iDim > 0 && iGray > 0);
  // DFU's first pass: albedo -> water lerp -> dist dim -> grayscale.
  assert.ok(iWater < iDim, 'the water tint lands BEFORE the dim (both DFU passes)');
  assert.ok(iDim < iGray, 'and the dim before the grayscale collapse');
  // DFU's second pass writes the mode's own colour INSIDE the
  // above-slice branch, i.e. before it ever reaches the dim line.
  assert.ok(iWire < iDim && iAlpha < iDim, 'the wireframe constant and the transparent alpha come before the dim');
  assert.ok(iWater < iWire, 'and the water tint before them - which is why WIREFRAME overwrites it, exactly as the C# does');
});

test('c2/S6 THE ABOVE-SLICE PASS NEVER DIMS - `min(y, slice)`, not `abs(y - slice)`', () => {
  // This is the whole quirk. DFU's second pass computes
  // `distance(min(IN.worldPos.y, _SclicingPositionY), _SclicingPositionY)`
  // over fragments it has ALREADY established are above the slice, so
  // the min IS the slice and the distance is identically zero: the
  // above-slice group is drawn at full brightness, always. A port that
  // reuses the first pass's `distance(worldPos.y, slice)` dims it, and
  // the difference is invisible in any test that only checks a uniform.
  assert.match(AUTOMAP_BLOCK, /float sliceDist = distance\(min\(vWorldPos\.y, uClipY\), uClipY\);/);
  assert.equal(/abs\(vWorldPos\.y - uClipY\)/.test(RENDERER), false,
    'the old A2 expression is GONE - it dims the above-slice group, which DFU never does');
  // and below the slice the two expressions agree, which is why one
  // line serves both passes: min(y, slice) == y for every y <= slice
  for (const [y, slice] of [[-3, 10], [10, 10], [0, 0], [-40, 1e9]]) {
    assert.equal(Math.abs(Math.min(y, slice) - slice), Math.abs(y - slice), `below-slice agreement at y=${y}`);
  }
  // above it, it is zero
  for (const [y, slice] of [[11, 10], [1e6, 10]]) {
    assert.equal(Math.abs(Math.min(y, slice) - slice), 0, `above-slice dim is zero at y=${y}`);
  }
});

test('c2/S6 the above-slice pass INVERTS the clip - the two passes partition the geometry', () => {
  const head = RENDERER.slice(RENDERER.indexOf('void main() {'), RENDERER.indexOf('vec4 tex = texture(uTex, vUV);'));
  assert.match(head, /if \(amMode >= 3\) \{ if \(vWorldPos\.y <= uClipY\) discard; \}/,
    'above-slice keeps ONLY what is above the plane');
  assert.match(head, /else if \(vWorldPos\.y > uClipY\) discard;/,
    'and the world / below-slice arm is A1\'s ceiling cut, unchanged');
});

test('c2/S6 the recorded substitutions are STATED, at their true size', () => {
  // The stage's own contract: the wireframe stand-in and the
  // group-by-group ordering are departures from the mechanism, not from
  // the behaviour, and both are written down where the code is.
  const r = RENDERER;
  assert.match(r, /geometry shader/i, 'the renderer says what gl.LINES stands in for');
  assert.match(r, /I < 0\.1/, 'and names DFU\'s hard clip - the reason the loss is a band, not a falloff');
  assert.match(r, /lineWidth/, 'and the 1 px WebGL2 cap, which is the only real delta');
  assert.match(r, /DO NOT "fix" this with a barycentric vertex variant/i,
    'with the instruction that closes the door on the memory-doubling "fix"');
  const w = src('src/ui/automapWindow.js');
  assert.match(w, /DFU RENDERS BOTH PASSES PER OBJECT/, 'the window records the group-by-group substitution');
  assert.match(w, /the artifacts ARE the classic look/,
    'and says the unsorted blend is the target, not a bug to fix');
});

// ─────────────────────────────────────────────────────────────────────
// 2. THE MODE TABLES
// ─────────────────────────────────────────────────────────────────────
test('c2/S6 AutomapRenderMode is the enum, and the cycle is the enum\'s order INCLUDING the wrap', () => {
  // Automap.cs:197-202 - Cutout = 0, Wireframe = 1, Transparent = 2
  assert.deepEqual([...RENDER_MODES], ['Cutout', 'Wireframe', 'Transparent']);
  assert.equal(RENDER_MODES.indexOf('Cutout'), 0);
  assert.equal(RENDER_MODES.indexOf('Wireframe'), 1);
  assert.equal(RENDER_MODES.indexOf('Transparent'), 2);
  // SwitchToNextAutomapRenderMode (:464-486): ++ then wrap past
  // Length-1. NOT the tooltip's cutout/wireframe/transparent hotkey
  // order, and NOT alphabetical.
  assert.equal(nextRenderMode('Cutout'), 'Wireframe');
  assert.equal(nextRenderMode('Wireframe'), 'Transparent');
  assert.equal(nextRenderMode('Transparent'), 'Cutout', 'THE WRAP');
  // three steps from anywhere returns you to where you started
  let m = 'Transparent';
  for (let i = 0; i < 3; i++) m = nextRenderMode(m);
  assert.equal(m, 'Transparent');
  assert.equal(nextRenderMode('nonsense'), 'Cutout', 'an unknown mode answers the enum default');
});

test('c2/S6 the six presentations by VALUE, and Cutout is the absence of a group', () => {
  assert.deepEqual({ ...AUTOMAP_MODE }, {
    OFF: 0,
    BELOW_COLOUR: 1,
    BELOW_GRAY: 2,
    ABOVE_TRANSPARENT_COLOUR: 3,
    ABOVE_TRANSPARENT_GRAY: 4,
    ABOVE_WIREFRAME_COLOUR: 5,
    ABOVE_WIREFRAME_GRAY: 6,
  });
  // the EVEN modes are the grayscale halves - the shader reads
  // `amMode % 2 == 0`, so this parity is load-bearing
  for (const m of [AUTOMAP_MODE.BELOW_GRAY, AUTOMAP_MODE.ABOVE_TRANSPARENT_GRAY, AUTOMAP_MODE.ABOVE_WIREFRAME_GRAY]) {
    assert.equal(m % 2, 0, `mode ${m} is a grayscale half`);
  }
  for (const m of [AUTOMAP_MODE.BELOW_COLOUR, AUTOMAP_MODE.ABOVE_TRANSPARENT_COLOUR, AUTOMAP_MODE.ABOVE_WIREFRAME_COLOUR]) {
    assert.equal(m % 2, 1, `mode ${m} is a colour half`);
  }
  assert.match(AUTOMAP_BLOCK, /if \(amMode % 2 == 0\) \{/, 'and the shader really tests that parity');

  assert.deepEqual({ ...ABOVE_SLICE_MODES.Cutout }, { colour: 0, gray: 0 },
    'CUTOUT ISSUES NOTHING - DFU\'s cutout arm is clip(-1.0) in the second pass');
  assert.deepEqual({ ...ABOVE_SLICE_MODES.Wireframe }, { colour: 5, gray: 6 });
  assert.deepEqual({ ...ABOVE_SLICE_MODES.Transparent }, { colour: 3, gray: 4 });
  for (const name of RENDER_MODES) assert.ok(ABOVE_SLICE_MODES[name], `${name} has a row`);
});

// ─────────────────────────────────────────────────────────────────────
// 3. THE LINE INDEX CACHE
// ─────────────────────────────────────────────────────────────────────
test('c2/S6 the edge expansion: a 2-triangle quad yields SIX pairs, the diagonal twice', () => {
  // 0-1-2 / 0-2-3, the two triangles of a quad
  const tri = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const { indices, ranges } = buildWireIndices(tri, [{ startIndex: 0, primitiveCount: 2 }]);
  assert.equal(indices.length, 12, '2 triangles x 3 edges x 2 endpoints');
  assert.deepEqual([...indices], [0, 1, 1, 2, 2, 0, 0, 2, 2, 3, 3, 0]);
  assert.deepEqual(ranges, [{ start: 0, count: 12 }]);

  // the SHARED DIAGONAL (0,2) appears TWICE, once per triangle - which
  // is not waste: DFU's geometry shader computes per-triangle
  // barycentrics, so it draws every triangle's own three edges and
  // shows the diagonals too. A de-duplicating port would be CLEANER
  // than the original, which is the wrong direction.
  const pairs = [];
  for (let i = 0; i < indices.length; i += 2) pairs.push([indices[i], indices[i + 1]].sort((a, b) => a - b).join('-'));
  assert.equal(pairs.length, 6);
  assert.equal(pairs.filter((p) => p === '0-2').length, 2, 'the shared edge is drawn twice, as DFU draws it');
  assert.equal(new Set(pairs).size, 5, 'five distinct edges over six draws');

  // sub-mesh ranges are per sub-mesh, in order, and cover the buffer
  const two = buildWireIndices(new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]), [
    { startIndex: 0, primitiveCount: 1 },
    { startIndex: 3, primitiveCount: 2 },
  ]);
  assert.deepEqual(two.ranges, [{ start: 0, count: 6 }, { start: 6, count: 12 }]);
  assert.equal(two.indices.length, 18);
  assert.deepEqual([...two.indices.slice(6, 12)], [3, 4, 4, 5, 5, 3], 'the second sub-mesh starts at ITS startIndex');
});

// ─────────────────────────────────────────────────────────────────────
// 4. THE RENDERER, on the EV6 counting Proxy-GL
// ─────────────────────────────────────────────────────────────────────
function recordingRenderer(log) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
const calls = (log, name) => log.filter((c) => c[0] === name);

const QUAD_MODEL = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  subMeshes: [{ textureArchive: 0, textureRecord: 0, startIndex: 0, primitiveCount: 2 }],
});

test('c2/S6 THE MODE IS THE QUEUE: the above-slice group blends, and the depth mask stays ON', () => {
  const log = [];
  const r = recordingRenderer(log);

  // below-slice (and off): DFU's first pass is Queue=Geometry /
  // RenderType=Opaque, with no Blend line anywhere
  for (const m of [AUTOMAP_MODE.OFF, AUTOMAP_MODE.BELOW_COLOUR, AUTOMAP_MODE.BELOW_GRAY]) {
    log.length = 0;
    r.setAutomapMode(m);
    assert.ok(calls(log, 'disable').some((c) => c[1] === 'BLEND'), `mode ${m} draws opaque`);
    assert.equal(calls(log, 'enable').some((c) => c[1] === 'BLEND'), false);
    assert.deepEqual(calls(log, 'depthMask').pop(), ['depthMask', true], `mode ${m} keeps ZWrite On`);
  }

  // above-slice: Queue=Transparent, Blend SrcAlpha OneMinusSrcAlpha,
  // BlendOp Add - and ZWrite ON, which is written out in the pass and
  // is what makes the output order-dependent on purpose
  for (const m of [3, 4, 5, 6]) {
    log.length = 0;
    r.setAutomapMode(m);
    assert.ok(calls(log, 'enable').some((c) => c[1] === 'BLEND'), `mode ${m} blends`);
    assert.deepEqual(calls(log, 'blendFunc').pop(), ['blendFunc', 'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA']);
    assert.deepEqual(calls(log, 'depthMask').pop(), ['depthMask', true],
      `mode ${m} STILL WRITES DEPTH - the artifacts are the target`);
    assert.equal(calls(log, 'depthMask').some((c) => c[1] === false), false, 'never ZWrite Off');
  }

  // and the bracket hands the blend state back
  r.setAutomapMode(AUTOMAP_MODE.OFF);
  log.length = 0;
  r.panelFrame({ proj: identity(), view: identity(), lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 10, h: 10 } },
    () => { r.setAutomapMode(AUTOMAP_MODE.ABOVE_TRANSPARENT_COLOUR); });
  const lastBlend = log.filter((c) => (c[0] === 'enable' || c[0] === 'disable') && c[1] === 'BLEND').pop();
  assert.deepEqual(lastBlend, ['disable', 'BLEND'], 'blending is OFF again when the bracket closes');
  assert.deepEqual(calls(log, 'depthMask').pop(), ['depthMask', true]);
  assert.equal(r._automapMode, 0, 'and the mode came back to the host\'s');
});

test('c2/S6 setAutomapWater uploads immediately, rides the bracket, and returns with it', () => {
  const log = [];
  const r = recordingRenderer(log);
  assert.equal(r._automapWaterLevel, AUTOMAP_NO_WATER, 'a fresh renderer is dry');
  const rounded = () => [...r._automapWaterColor].map((v) => Math.round(v * 1e6) / 1e6);
  assert.deepEqual(rounded(), [0.0, 0.3, 0.5, 0.4]);

  log.length = 0;
  r.setAutomapWater(-12.5);
  assert.equal(r._automapWaterLevel, -12.5);
  assert.ok(calls(log, 'uniform1f').length >= 1, 'the level is uploaded straight away - the draw loop changes it MID-pass');
  assert.ok(calls(log, 'uniform4fv').length >= 1, 'and the colour with it');
  r.setAutomapWater(null);
  assert.equal(r._automapWaterLevel, AUTOMAP_NO_WATER, 'null is a DRY block, not zero - zero would flood every floor at y<=0');

  // the bracket names it, saves it and gives it back
  r.setAutomapWater(-3, [1, 0, 0, 0.5]);
  r.panelFrame({ proj: identity(), view: identity(), lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 10, h: 10 } },
    () => { r.setAutomapWater(-99, [0, 1, 0, 0.25]); });
  assert.equal(r._automapWaterLevel, -3, 'the level came back');
  assert.deepEqual(rounded(), [1, 0, 0, 0.5], 'and the colour');

  // the SOURCE half of the bracket law: a thirteenth global must be
  // added to the save list, and these two were
  const begun = RENDERER.slice(RENDERER.indexOf('beginPanelFrame('), RENDERER.indexOf('panelFrame({ proj'));
  for (const f of ['automapWaterLevel', 'automapWaterColor']) {
    assert.ok(begun.includes(`${f}:`), `${f} is saved by the bracket`);
    assert.ok(begun.includes(`s.${f}`), `${f} is restored by the bracket`);
  }
});

test('c2/S6 the line buffer is built ONCE per mesh, reused, and freed with the mesh', () => {
  const log = [];
  const r = recordingRenderer(log);
  const mesh = r.createMesh(QUAD_MODEL());
  r.textures.set('0_0', 'T');   // give the sub-mesh a texture so the draw actually issues

  log.length = 0;
  r.drawMeshWire(mesh, identity());
  const built = calls(log, 'bufferData');
  assert.equal(built.length, 1, 'exactly one new buffer - the edge indices');
  assert.equal(built[0][1], 'ELEMENT_ARRAY_BUFFER');
  assert.equal(built[0][2].length, 12, 'the quad\'s twelve line indices');
  assert.equal(mesh._wire.indexCount, 12);
  const draw = calls(log, 'drawElements').pop();
  assert.deepEqual(draw, ['drawElements', 'LINES', 12, 'UNSIGNED_INT', 0], 'gl.LINES over the edge range');

  log.length = 0;
  r.drawMeshWire(mesh, identity());
  assert.equal(calls(log, 'bufferData').length, 0, 'the SECOND draw builds nothing - the cache is per mesh');
  assert.deepEqual(calls(log, 'drawElements').pop(), ['drawElements', 'LINES', 12, 'UNSIGNED_INT', 0]);

  // the triangle draw is untouched by any of it - the line indices live
  // in their own VAO precisely so the mesh's element binding is never
  // swapped out from under it
  log.length = 0;
  r.drawMesh(mesh, identity());
  assert.deepEqual(calls(log, 'drawElements').pop(), ['drawElements', 'TRIANGLES', 6, 'UNSIGNED_INT', 0]);

  log.length = 0;
  r.destroyMesh(mesh);
  assert.ok(calls(log, 'deleteBuffer').length >= 5, 'the four mesh buffers AND the edge buffer are released');
  assert.equal(calls(log, 'deleteVertexArray').length, 2, 'both VAOs go');
  assert.equal(mesh._wire, null);

  // a bundle that kept no indices simply cannot be wireframed, and says
  // so by drawing nothing rather than by throwing
  const bare = { vao: {}, subMeshes: [{ textureArchive: 0, textureRecord: 0, startIndex: 0, primitiveCount: 1 }], buffers: [] };
  log.length = 0;
  assert.doesNotThrow(() => r.drawMeshWire(bare, identity()));
  assert.equal(calls(log, 'drawElements').length, 0);
});

// ─────────────────────────────────────────────────────────────────────
// 5. THE WINDOW: four draw groups, and the water level per block
// ─────────────────────────────────────────────────────────────────────
const CANVAS = { width: 320, height: 200 };

function windowStub(log) {
  return {
    canvas: CANVAS,
    uploadTexture: (a, k) => `tex:${a}/${k}`,
    releaseTexture: () => {},
    createBillboardBatch: () => ({}),
    destroyBillboardBatch: () => {},
    createMesh: (model) => ({ stub: true, subMeshes: model.subMeshes }),   // c2/S7
    destroyMesh: () => {},
    drawBillboards: () => {},
    drawMesh: (mesh) => log.push(['drawMesh', mesh]),
    drawMeshWire: (mesh) => log.push(['drawMeshWire', mesh]),
    drawScreenQuad: () => {},
    setClipY: () => {},
    setAutomapMode: (m) => log.push(['setAutomapMode', m]),
    setAutomapWater: (l) => log.push(['setAutomapWater', l]),
    setFog: () => {}, setLighting: () => {}, setMoonlight: () => {},
    setPointLights: () => {}, setIndirectLight: () => {}, setWindowEmission: () => {},
    panelFrame: ({ setup }, body) => { setup?.(); body(); },
  };
}

/** Four models across two blocks: block 0 is FLOODED at y = -8, block 1
 *  is dry. One model of each block was seen on a prior run. */
const ROWS = [
  { key: 'a', mesh: 'A', water: -8 },
  { key: 'b', mesh: 'B', water: -8 },
  { key: 'c', mesh: 'C', water: null },
  { key: 'd', mesh: 'D', water: null },
];
function mapDeps(over = {}) {
  const byKey = new Map(ROWS.map((r) => [r.key, { key: r.key, waterLevel: r.water }]));
  return {
    record: () => ({
      revealed: new Set(['a', 'b', 'c', 'd']),
      visitedThisRun: new Set(['a', 'c']),
      entranceDiscovered: false,
    }),
    model: { exploredPercentage: () => 100, length: 4, byKey },
    drawList: ROWS.map((r) => ({ key: r.key, mesh: r.mesh, matrix: identity() })),
    dynamicDraws: [],
    texRemap: null,
    player: () => ({ feet: [0, 1, 0], eye: [0, 2.7, 0], yaw: 0 }),
    startMarker: null,
    blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }],
    arrowMesh: null,
    dungeonName: 'D',
    insideBuilding: false,
    ...over,
  };
}

function drawInMode(mode) {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  signalAutomapReset();
  const w = new AutomapWindow(mapDeps());
  w.runVerb(`ActionSwitchToAutomapRenderMode${mode}`);
  const log = [];
  w.draw(windowStub(log), CANVAS, null, 1);
  _resetForTests();
  resetAutomapWindowState();
  return log;
}

test('c2/S6 the FOUR draw groups: below colour, below gray, then the above-slice pair by mode', () => {
  // TRANSPARENT: 1, 2, 3, 4 - both tiers again above the plane
  const t = drawInMode('Transparent').filter((c) => c[0] === 'setAutomapMode').map((c) => c[1]);
  assert.deepEqual(t, [1, 2, 3, 4, 0], 'below colour, below gray, above colour, above gray, then OFF for the markers');

  // WIREFRAME: the same partition at 5/6
  const wf = drawInMode('Wireframe').filter((c) => c[0] === 'setAutomapMode').map((c) => c[1]);
  assert.deepEqual(wf, [1, 2, 5, 6, 0]);

  // CUTOUT: NO above-slice group is issued at all
  const c = drawInMode('Cutout').filter((c2) => c2[0] === 'setAutomapMode').map((c2) => c2[1]);
  assert.deepEqual(c, [1, 2, 0], 'cutout is the ABSENCE of the second pass, not a mode of it');

  // the below-slice output is byte-identical across all three modes -
  // c2/S6 must not have touched what S5 already draws
  const below = (log) => {
    const out = [];
    let mode = 0;
    for (const e of log) {
      if (e[0] === 'setAutomapMode') mode = e[1];
      else if ((mode === 1 || mode === 2) && e[0] !== 'setAutomapWater') out.push([mode, e[0], e[1]]);
    }
    return out;
  };
  const ref = below(drawInMode('Cutout'));
  assert.deepEqual(below(drawInMode('Transparent')), ref, 'the below-slice half is unchanged by the render mode');
  assert.deepEqual(below(drawInMode('Wireframe')), ref);
  assert.deepEqual(ref, [
    [1, 'drawMesh', 'A'], [1, 'drawMesh', 'C'],
    [2, 'drawMesh', 'B'], [2, 'drawMesh', 'D'],
  ], 'visited this run in colour, revealed on a prior run in grayscale');
});

test('c2/S6 wireframe uses the LINE path and only above the slice; transparent uses the triangle path throughout', () => {
  const wf = drawInMode('Wireframe');
  let mode = 0;
  const seen = [];
  for (const e of wf) {
    if (e[0] === 'setAutomapMode') mode = e[1];
    // mode 0 is c2/S7's NEVER-SLICED marker group, which is not a
    // presentation of the geometry and takes no part in this law
    else if (mode !== 0 && (e[0] === 'drawMesh' || e[0] === 'drawMeshWire')) seen.push([mode, e[0]]);
  }
  assert.deepEqual(seen, [
    [1, 'drawMesh'], [1, 'drawMesh'],
    [2, 'drawMesh'], [2, 'drawMesh'],
    [5, 'drawMeshWire'], [5, 'drawMeshWire'],
    [6, 'drawMeshWire'], [6, 'drawMeshWire'],
  ], 'the wireframe substitution applies to the ABOVE-slice group alone');

  const t = drawInMode('Transparent');
  assert.equal(t.some((e) => e[0] === 'drawMeshWire'), false, 'transparent never takes the line path');
  let tm = 0;
  const geo = t.filter((e) => {
    if (e[0] === 'setAutomapMode') { tm = e[1]; return false; }
    return tm !== 0 && e[0] === 'drawMesh';
  });
  assert.equal(geo.length, 8, 'four models, twice - once per pass');
});

test('c2/S6 the water level rides per BLOCK, uploaded only when it changes, and never re-orders the draws', () => {
  const log = drawInMode('Transparent');
  // the flooded block's rows carry -8, the dry block's carry null
  // (AddWater's early return leaves the shader's own -10000 default)
  const groups = [];
  let cur = null;
  for (const e of log) {
    if (e[0] === 'setAutomapMode') { cur = { mode: e[1], water: [], draws: [] }; groups.push(cur); }
    else if (e[0] === 'setAutomapWater') cur.water.push(e[1]);
    else if (e[0] === 'drawMesh' || e[0] === 'drawMeshWire') cur.draws.push(e[1]);
  }
  // group 1 (visited): A is flooded, C is dry -> two uploads
  assert.deepEqual(groups[0].water, [-8, null]);
  assert.deepEqual(groups[0].draws, ['A', 'C'], 'DRAW ORDER IS INPUT ORDER - the transparent group is deliberately unsorted');
  // group 2 (prior run): B flooded, D dry
  assert.deepEqual(groups[1].water, [-8, null]);
  assert.deepEqual(groups[1].draws, ['B', 'D']);
  // the above-slice groups repeat the same levels
  assert.deepEqual(groups[2].water, [-8, null]);
  assert.deepEqual(groups[3].water, [-8, null]);
  // and the marker group turns it off with the mode
  assert.equal(groups[4].mode, 0);
  assert.deepEqual(groups[4].water, [null], 'beacons are Standard-material in DFU and never saw _WaterLevel');

  // nothing in the draw path sorts
  const w = src('src/ui/automapWindow.js');
  const body = w.slice(w.indexOf('_partitionDraws(rec) {'), w.indexOf('// ── draw ─'));
  assert.equal(/\.sort\(/.test(body), false, 'NO SORTING - DFU sorts nothing and its artifacts are the target');
});

test('c2/S6 one upload per run of equal levels - a single-block dungeon uploads once per group', () => {
  _resetForTests(); resetAutomapWindowState(); _setAutomapArt(null); signalAutomapReset();
  const rows = ['a', 'b', 'c'].map((k) => ({ key: k, mesh: k.toUpperCase(), matrix: identity() }));
  const byKey = new Map(rows.map((r) => [r.key, { key: r.key, waterLevel: -4 }]));
  const w = new AutomapWindow(mapDeps({
    record: () => ({ revealed: new Set(['a', 'b', 'c']), visitedThisRun: new Set(['a', 'b', 'c']), entranceDiscovered: false }),
    model: { exploredPercentage: () => 100, length: 3, byKey },
    drawList: rows,
  }));
  w.runVerb('ActionSwitchToAutomapRenderModeCutout');
  const log = [];
  w.draw(windowStub(log), CANVAS, null, 1);
  _resetForTests(); resetAutomapWindowState();
  const uploads = log.filter((c) => c[0] === 'setAutomapWater');
  assert.deepEqual(uploads.map((c) => c[1]), [-4, null],
    'ONE upload for the whole flooded group, then the marker group\'s reset');
});

// ─────────────────────────────────────────────────────────────────────
// 6. THE HOTKEYS
// ─────────────────────────────────────────────────────────────────────
test('c2/S6 the four render-mode hotkeys sit where DFU polls them, and each one lands', () => {
  // :747-763 - after SwitchFocusToNextBeaconObject and before the four
  // backgrounds, in the order next / transparent / wireframe / cutout
  const i = (n) => HOTKEYS_DOWN.indexOf(n);
  assert.deepEqual(HOTKEYS_DOWN.slice(i('AutomapSwitchToNextAutomapRenderMode'), i('AutomapSwitchToAutomapBackgroundOriginal')), [
    'AutomapSwitchToNextAutomapRenderMode',
    'AutomapSwitchToAutomapRenderModeTransparent',
    'AutomapSwitchToAutomapRenderModeWireframe',
    'AutomapSwitchToAutomapRenderModeCutout',
  ]);
  assert.equal(i('AutomapSwitchFocusToNextBeaconObject') + 1, i('AutomapSwitchToNextAutomapRenderMode'));
  for (const b of HOTKEYS_DOWN.filter((n) => n.includes('RenderMode'))) {
    assert.ok(HOTKEY_VERBS[b], `${b} has a verb`);
  }

  // and they really change the mode, through the real window's key seam
  _resetForTests(); resetAutomapWindowState(); _setAutomapArt(null); signalAutomapReset();
  const w = new AutomapWindow(mapDeps());
  try {
    // the reset arm set Transparent (this host is not inside a building)
    assert.equal(automapRenderMode(), 'Transparent');
    w.input('F2', { code: 'F2' });
    assert.equal(automapRenderMode(), 'Cutout', 'F2 = cutout');
    w.input('F3', { code: 'F3' });
    assert.equal(automapRenderMode(), 'Wireframe', 'F3 = wireframe');
    w.input('F4', { code: 'F4' });
    assert.equal(automapRenderMode(), 'Transparent', 'F4 = transparent');
    w.input('Enter', { code: 'Enter' });
    assert.equal(automapRenderMode(), 'Cutout', 'Return cycles, and Transparent wraps to Cutout');
    w.input('Enter', { code: 'Enter' });
    assert.equal(automapRenderMode(), 'Wireframe');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S6 the mode tooltips were already law-complete - and now the keys they name answer', () => {
  // S5 transcribed Internal_Strings:874-890 whole, so the stair
  // buttons' tooltips have named the three render modes and the Return
  // cycle since then - documenting a surface that did not yet exist.
  // Nothing in ui/automapChrome.js needed changing for this stage; what
  // this pin holds is the LOOP - the key the tooltip PRINTS is the key
  // that sets the mode the sentence beside it names.
  _resetForTests(); resetAutomapWindowState(); _setAutomapArt(null); signalAutomapReset();
  const w = new AutomapWindow(mapDeps());
  try {
    for (const rect of ['upstairs', 'downstairs']) {
      const tip = automapTooltipFor(rect, 'KeyM');
      assert.match(tip, /hotkey F2: cutout mode/);
      assert.match(tip, /hotkey F3: wireframe mode/);
      assert.match(tip, /hotkey F4: transparent mode/);
      assert.match(tip, /switch between modes with return key/);
    }
    for (const [code, mode] of [['F2', 'Cutout'], ['F3', 'Wireframe'], ['F4', 'Transparent']]) {
      w.input(code, { code });
      assert.equal(automapRenderMode(), mode, `${code} really selects ${mode}`);
    }
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

// DATA-GATED: none in this file, and deliberately so. This stage's
// real-data claim ("a real dungeon renders in all three modes with no
// GL error") needs a GL context, which CI does not have - an
// ARENA2-gated pin here could only assert that data loaded, which is
// exactly the rot the c2 risk list warns about. It is recorded as a
// remainder instead; the below-slice half's real-data arm already
// stands in roadc_automap_window.test.js.
