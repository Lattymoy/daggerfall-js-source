// WL1 (2026-10-29, the owner: "Windows should have shadowed lightening that shows on the ground at night and also light
// on the inside should show on the ground, all depending on time of day"): WINDOW LIGHT. A lit mock room's lamp through
// its window's own glass onto the street by night; the outside's sun or moon through a building's glass onto its floor.
// The glass's tiles (windowApertures.js), its masks, one light's walk (the GLSL's JS twin), the pass's gather and its
// lights, the renderer's frame kinds and uploads, the sun map's glass cut and the exterior windows whose glass DFU's
// palette rule misses - pinned by execution over a recording GL; the hosts' wiring by their text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  WindowLightPass, windowLightGlsl, windowLightOn, writeWindowLight, windowLightAt, lampOf, maskBoxOf, maskLayerOf, holesOf,
  windowAperturesOf, WL_REC, WL_VEC4, WL_MAX_LIGHTS, WL_FAR_UBO_BINDING, WL_KIND, WL_LAMP_GOBO, WL_LAMP_SPILL, WL_LAMP_RANGE, WL_SUN_GAIN,
  WL_MOON_GAIN, WL_SKY_GAIN, WL_SUN_REACH, WL_HOLD_MS, WL_MASK_SIZE, WL_MASK_UNIT, WL_UBO_BINDING, WL_GRID_ROW, WL_LIST_BASE,
  WL_GATHER, WL_CURTAIN_PASS, WL_LAMP_DEPTH, WL_LAMP_LIFT, WL_MOVE_REACH, WL_PLACEMENTS_MAX, WL_LAMP_RADIUS, WL_SUN_ANGLE,
  WL_SPILL_REACH, WL_STOREY, WL_MASK_LAYERS, WL_BUILD_TILES,
} from '../../src/render/windowLight.js';
import { SNOW_UNITS } from '../../src/render/snowfallGlsl.js';
import { readdirSync } from 'node:fs';
import { apertureSteps, APERTURE_STEP_TRIS, APERTURE_CELL, APERTURE_CELL_REC, APERTURE_MIN_COVER } from '../../src/render/windowApertures.js';
import { CLUSTER_Z, CLUSTER_LIST_W, CLUSTER_LIST_ROWS, CLUSTER_BANDS } from '../../src/render/lightClusters.js';
import { roomSeedBits, roomLitAt, curtainBitsOf, roomCurtained, curtainEdges } from '../../src/world/windowRoomArt.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { ShadowPass, DEPTH_GLASS_FS, DEPTH_FS } from '../../src/render/shadowPass.js';
import { StaticBatchBuilder } from '../../src/render/staticBatch.js';
import { windowEmissionRGB } from '../../src/render/windowEmission.js';
import { createViewOut, viewOutFrame, realWindowsGlsl, ROOM_SUN_SHARE } from '../../src/render/realWindows.js';
import { lightStreetAt } from '../../src/render/enhancedSky.js';
import { EL_BB_FS, EL_MESH_FS } from '../../src/render/enhancedLighting.js';
import { EXTERIOR_GLASS, exteriorGlassIndices, exteriorWindowMask, fillPaneSpecks, SPECK_MAX } from '../../src/world/exteriorGlass.js';
import { isExteriorWindow } from '../../src/world/climateSwaps.js';
import { scanWindows } from '../../tools/exteriorGlassScan.mjs';
import { perspective, lookAt, identity } from '../../src/world/mat4.js';
import { hostText } from '../hostText.mjs';

const rd = (p) => hostText(p);
const I = identity();
const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;

/** A quad from `o` along `eu` and `ev` (metres), its uv 0..su x 0..sv, facing `n`. */
function quad(o, eu, ev, n, su, sv) {
  const P = [], N = [], UV = [];
  for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    P.push(o[0] + eu[0] * a + ev[0] * b, o[1] + eu[1] * a + ev[1] * b, o[2] + eu[2] * a + ev[2] * b);
    N.push(...n); UV.push(su * a, sv * b);
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
}
/** A mask W x H, white where `glass(x, y)` (rows as uploaded). */
function mask(W, H, glass) {
  const colors = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (glass(x, y)) colors.fill(255, (y * W + x) * 4, (y * W + x) * 4 + 4);
  return { width: W, height: H, colors };
}
/** A recording GL: every call logged; programs and shaders link; a uniform block has index 0. */
function recordingGl(log) {
  let id = 0;
  return new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name, p });
      if (k === 'getUniformBlockIndex') return () => 0;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (k === 'TEXTURE0') return 33984;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
}
function recordingRenderer(log) {
  const gl = recordingGl(log);
  const canvas = { getContext: () => gl, clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  return new Renderer(canvas);
}
const uploads = (log, name) => log.filter((c) => /^uniform/.test(c[0]) && c[1]?.name === name).map((c) => c.slice(2));
/** The pass on a recording GL. */
const passOn = (log = []) => new WindowLightPass(recordingGl(log), { activeTexture: () => {} });
/** A cross of lead over four panes: glass but the bands |u - 0.5| < 0.06 and |v - 0.5| < 0.06, and a frame 0.1 wide. */
const CROSS = mask(64, 64, (x, y) => { const u = (x + 0.5) / 64, v = (y + 0.5) / 64; return u > 0.1 && u < 0.9 && v > 0.1 && v < 0.9 && Math.abs(u - 0.5) > 0.06 && Math.abs(v - 0.5) > 0.06; });
const crossAt = (u, v) => (u > 0.1 && u < 0.9 && v > 0.1 && v < 0.9 && Math.abs(u - 0.5) > 0.06 && Math.abs(v - 0.5) > 0.06 ? 1 : 0);
/** A house front facing +z at z = -10: six tiles of 2.5 m across from x = -7.5, two storeys. */
const FRONT = quad([-7.5, 0, -10], [15, 0, 0], [0, 5, 0], [0, 0, 1], 6, 2);
const frontAp = () => windowAperturesOf(FRONT.positions, FRONT.normals, FRONT.uvs, FRONT.indices, 0, 6);
/** A mesh's window entry, as renderer._wlApertures makes it. */
const wlOf = (key, set) => ({ key, ap: set.recs, cells: set.cells });
/** The mock room's seed of a front tile as the rooms' shader rounds it (realWindows.js rwSeedBits). */
const frontSeed = (tx, ty) => roomSeedBits(0, 0, 4, Math.floor(-10 * 40 + 0.5), tx, ty);

test('WL1 W1: a mesh\'s glass tile by tile - a wall\'s two triangles one quad, cut into the tiles of picture its uv spans, each tile its origin, the metres a tile of u and of v spans, its normal and the share it covers; a picture tiled past reason none; the sliced walk yields and answers the same (mutants: the tile\'s origin, the spans swapped, the cover, the yield lost)', () => {
  const q = quad([0, 0, 0], [3, 0, 0], [0, 2, 0], [0, 0, 1], 1.5, 1);
  const { recs: ap, cells } = windowAperturesOf(q.positions, q.normals, q.uvs, q.indices, 0, 6);
  assert.equal(ap.length, 2 * WL_REC, 'two tiles: u 0..1 and 1..1.5');
  assert.deepEqual(Array.from(cells), [1.75, 1, 0, 0.75, 0, 2], 'one cell: its centre, its radius, its first record and its count');
  const rec = (k) => Array.from(ap.subarray(k * WL_REC, (k + 1) * WL_REC)).map((v) => Math.round(v * 1e4) / 1e4);
  assert.deepEqual(rec(0), [0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 1, 1]);
  assert.deepEqual(rec(1), [1, 0, 2, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0.5, 1], 'the second tile two metres along, half of it covered');
  const wild = quad([0, 0, 0], [3, 0, 0], [0, 2, 0], [0, 0, 1], 200, 200);
  assert.equal(windowAperturesOf(wild.positions, wild.normals, wild.uvs, wild.indices, 0, 6).recs.length, 0, 'a picture tiled 40000 times is no window');
  // a strip of many quads: the walk breathes between units and answers what the whole walk does
  const P = [], N = [], UV = [], IDX = [];
  for (let i = 0; i < APERTURE_STEP_TRIS + 8; i++) {
    const b = P.length / 3;
    P.push(i, 0, 0, i + 1, 0, 0, i + 1, 1, 0, i, 1, 0); N.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1); UV.push(i, 0, i + 1, 0, i + 1, 1, i, 1);
    IDX.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const args = [new Float32Array(P), new Float32Array(N), new Float32Array(UV), new Uint32Array(IDX), 0, IDX.length];
  const it = apertureSteps(...args);
  let yields = 0, r = it.next();
  while (!r.done) { yields++; r = it.next(); }
  assert.ok(yields >= 2, `it yields (${yields})`);
  assert.deepEqual(Array.from(r.value.recs), Array.from(windowAperturesOf(...args).recs));
  assert.equal(r.value.recs.length / WL_REC, APERTURE_STEP_TRIS + 8, 'one plane, one mapping: a tile a quad');
  const C = r.value.cells;
  assert.equal(C.length / APERTURE_CELL_REC, Math.ceil((APERTURE_STEP_TRIS + 8) / APERTURE_CELL), 'filed in cells of APERTURE_CELL metres');
  for (let c = 0; c < C.length; c += APERTURE_CELL_REC) for (let k = C[c + 4]; k < C[c + 4] + C[c + 5]; k++) {
    const x = r.value.recs[k * WL_REC + 2] + 0.5;
    assert.ok(Math.abs(x - C[c]) <= C[c + 3] + 1e-4 && Math.floor(x / APERTURE_CELL) === Math.floor(C[c] / APERTURE_CELL), 'each record in its cell\'s ball');
  }
  // many triangles inside one tile: the walk breathes between triangles too, not only between tiles
  const p2 = [], n2 = [], uv2 = [], i2 = [];
  for (let i = 0; i < APERTURE_STEP_TRIS; i++) {
    const b = p2.length / 3, x = (i % 32) / 32, y = Math.floor(i / 32) / 32, e = 1 / 32;
    p2.push(x, y, 0, x + e, y, 0, x + e, y + e, 0, x, y + e, 0); n2.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1); uv2.push(x, y, x + e, y, x + e, y + e, x, y + e);
    i2.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const one = apertureSteps(new Float32Array(p2), new Float32Array(n2), new Float32Array(uv2), new Uint32Array(i2), 0, i2.length);
  let ty = 0, r2 = one.next();
  while (!r2.done) { ty++; r2 = one.next(); }
  assert.equal(r2.value.recs.length, WL_REC, 'one tile');
  assert.ok(ty >= 1, 'a yield between the triangles');
  // triangles that map no picture (no uv area): no tile to clip, and still the walk breathes between them
  const p3 = new Float32Array(9 * 600), n3 = new Float32Array(9 * 600).fill(1), uv3 = new Float32Array(6 * 600), i3 = Uint32Array.from({ length: 1800 }, (_, i) => i);
  for (let i = 0; i < p3.length; i += 9) { p3[i + 3] = 1; p3[i + 7] = 1; }
  const none = apertureSteps(p3, n3, uv3, i3, 0, 1800);
  let ny = 0;
  while (!none.next().done) ny++;
  assert.ok(ny >= Math.floor(600 / APERTURE_STEP_TRIS) + 1, `the triangles' own yields (${ny})`);
});

test('WL1 W2: the masks - the glass\'s box in the tile\'s uv, none without glass; a layer resampled nearest so the lead keeps its edge; a cutout\'s holes as glass (mutants: the box\'s far edge, the lead blurred, the holes inverted)', () => {
  const m = mask(8, 8, (x, y) => x >= 2 && x <= 5 && y >= 1 && y <= 6);
  assert.deepEqual(maskBoxOf(m), [2 / 8, 1 / 8, 6 / 8, 7 / 8]);
  assert.equal(maskBoxOf(mask(8, 8, () => false)), null);
  const lead = maskLayerOf(mask(8, 8, (x) => x !== 4));
  assert.equal(lead.length, WL_MASK_SIZE * WL_MASK_SIZE);
  const row = Array.from(lead.subarray(0, WL_MASK_SIZE));
  assert.equal(row.filter((v) => v === 0).length, WL_MASK_SIZE / 8, 'the lead a sixteenth of the layer');
  assert.ok(row.every((v) => v === 0 || v === 255), 'nearest: no grey at the lead\'s edge');
  assert.equal(row[WL_MASK_SIZE / 2 + 1], 0); assert.equal(row[WL_MASK_SIZE / 2 - 1], 255);
  const cut = { width: 2, height: 1, colors: new Uint8ClampedArray([9, 9, 9, 255, 9, 9, 9, 0]) };
  assert.deepEqual(Array.from(holesOf(cut).colors), [0, 0, 0, 0, 255, 255, 255, 255]);
  assert.deepEqual(Array.from(maskLayerOf(cut, true).subarray(0, 2)), [0, 0]);
  assert.equal(maskLayerOf(cut, true)[WL_MASK_SIZE - 1], 255, 'alpha: the hole is the glass');
});

test('WL1 W3: ONE WINDOW\'S LIGHT (the shader\'s JS twin) - a lamp behind a cross-leaded window lights the ground where the line to the lamp crosses a pane and only the glass\'s glow where it crosses the lead, the frame or the wall; nothing behind the glass or past the reach; the record\'s duals invert the spans (mutants: the plane\'s crossing, the duals, the behind cut, the reach, the mask\'s v)', () => {
  // the glass's box: 2 m across and 1.5 m high about (0, 1.5, 0), the mask's u 0.1..0.9 and v 0.15..0.75 of its tile
  const c = [0, 1.5, 0], U = [2, 0, 0], V = [0, 1.5, 0], nf = [0, 0, 1], box = [0.5, 0.45, 0.8, 0.6];
  const src = lampOf(c, nf, V);
  assert.deepEqual(src.map((v) => Math.round(v * 1e4) / 1e4), [0, 1.5 + 0.75 + WL_LAMP_LIFT, -WL_LAMP_DEPTH], 'over the glass by half its height and the lift, behind it');
  const out = new Float32Array(WL_VEC4 * 4);
  const gobo = [1, 0.7, 0.3], spill = [0.1, 0.07, 0.03];
  writeWindowLight(out, 0, { c, U, V, nf, uv: box, src, kind: WL_KIND.lamp, layer: 5, reach: 9, area: 3, gobo, spill, halfDiag: 1.25 });
  assert.deepEqual([out[4], out[5], out[6], out[8], out[9], out[10]].map((v) => Math.round(v * 1e6) / 1e6), [0.5, 0, 0, 0, 0.666667, 0], 'u* and v*: U / |U|^2, V / |V|^2');
  assert.equal(out[23], 5 + 256 * WL_KIND.lamp);
  const atten = (d, r) => Math.max(0, 1 - d / r) ** 2;
  const at = (p) => windowLightAt(out, p, [0, 1, 0], crossAt, atten);
  const glowOnly = (p) => windowLightAt(out, p, [0, 1, 0], () => 0, atten);
  // an independent oracle: where the line from a ground point to the lamp crosses z = 0
  const crossing = (p) => { const t = p[2] / (p[2] - src[2]); return [p[0] + (src[0] - p[0]) * t, p[1] + (src[1] - p[1]) * t]; };
  const sweep = (maskAt) => {
    let lit = 0, dark = 0;
    for (let x = -3; x <= 3; x += 0.25) for (let z = 0.25; z <= 6; z += 0.25) {
      const p = [x, 0, z];
      const [cx, cy] = crossing(p);
      const a = cx / 2, b = (cy - 1.5) / 1.5;
      const pw = 2 * WL_LAMP_RADIUS * (p[2] / (p[2] - src[2]));   // the lamp's footprint on the glass: the soft edge
      const want = Math.abs(a) <= 0.5 + pw / 2 && Math.abs(b) <= 0.5 + pw / 1.5 ? maskAt(box[0] + a * box[2], box[1] + b * box[3]) : 0;
      const got = windowLightAt(out, p, [0, 1, 0], maskAt, atten)[0] - glowOnly(p)[0];
      if (want) { assert.ok(got > 0, `lit at ${p}`); lit++; } else { assert.ok(Math.abs(got) < 1e-9, `dark at ${p} (${got})`); dark++; }
    }
    return [lit, dark];
  };
  const [lit, dark] = sweep(crossAt);
  assert.ok(lit > 40 && dark > 40, `both the panes and the lead fall on the ground (${lit} lit, ${dark} dark)`);
  const [inside, outside] = sweep(() => 1);
  assert.ok(inside > 40 && outside > 40, `a mask all glass: lit inside the box's shadow, unlit past it (${inside}, ${outside})`);
  assert.ok(glowOnly([0, 0, 1])[0] > 0, 'the glass glows on what faces it');
  assert.deepEqual(at([0, 0, -1]), [0, 0, 0], 'behind the glass: nothing');
  assert.deepEqual(at([0, 0, 9.5]), [0, 0, 0], 'past the reach: nothing');
  // the lit point's colour is the gobo through the mask, by the falloff and the facing
  const p = [-0.6, 0, 1.6], ray = [src[0] - p[0], src[1] - p[1], src[2] - p[2]], rl = Math.hypot(...ray);
  assert.ok(near(at(p)[0] - glowOnly(p)[0], gobo[0] * (ray[1] / rl) * atten(rl, 9), 1e-6));
});

test('WL1 W4: THE SHADER\'S BLOCK walks what the twin walks - in both sets: the classic set\'s lit programs declare the grid with the block and add winLit (models, characters, terrain, flats, decals), the lane\'s point term carries it with its own falloff and the sun map (mutants: a set without the block, the lamp\'s crossing, the aperture\'s bounds, the mask\'s v, the sun map unread)', () => {
  const g = windowLightGlsl();
  for (const line of [
    'if (s <= 0.0) continue;',
    'if (kind == 0) { ray = c4.xyz - wp; tt = s / (s - dot(c4.xyz - c0.xyz, c3.xyz)); }',
    'if (abs(a) > 0.5 + pa || abs(b) > 0.5 + pb) continue;',
    `float pw = kind == 0 ? ${2 * WL_LAMP_RADIUS} * tt : ${WL_SUN_ANGLE} * tt;`,
    'float lod = log2(max(max(pa * c3.w, pb * c4.w) * 128.0, 1.0));',
    `if (kind == 2 && wp.y < c0.y - 0.5 / max(length(c2.xyz), 1e-4) - ${WL_STOREY.toFixed(1)}) continue;`,
    `if (d2 < ${(WL_SPILL_REACH * WL_SPILL_REACH).toFixed(1)}) {`,
    'float m = textureLod(uWinMask, vec3(c1.w + a * c3.w, c2.w + b * c4.w, float(code & 255)), lod).r;',
    `highp int at = ${WL_LIST_BASE} + int(cell.x) + j;`,
    `zc + ${WL_GRID_ROW}), 0).rg;`,
    'float g = kind == 0 ? wlClassicAtten(rl, r) : 1.0;',
  ]) assert.ok(g.includes(line), line);
  assert.ok(windowLightGlsl({ clusters: true }).includes('uniform highp usampler2D uClusterGrid;') && !g.includes('uClusterGrid;'));
  const lane = windowLightGlsl({ atten: 'elAttenuation(rl, r)', shadow: true });
  assert.ok(lane.includes('float g = kind == 0 ? elAttenuation(rl, r) : (kind == 1 ? (isFlat > 0.5 ? flatSun : sunShadowAt(wp, n)) : 1.0);'));
  // a flat's sun through glass is its quad's one read (LA-COST3's vBBSunVis): the billboard program's block reads no map
  const flat = windowLightGlsl({ atten: 'elAttenuation(rl, r)', shadow: 'flat' });
  assert.ok(flat.includes('float g = kind == 0 ? elAttenuation(rl, r) : (kind == 1 ? flatSun : 1.0);') && !/sunShadow(?:Soft)?At\(/.test(flat));
  const el = rd('src/render/enhancedLighting.js');
  const point = el.slice(el.indexOf('const elPointLitGlsl = (wlShadow) => `'), el.indexOf('`;', el.indexOf('const elPointLitGlsl = (wlShadow) => `')));
  assert.ok(point.includes("${windowLightGlsl({ atten: 'elAttenuation(rl, r)', shadow: wlShadow })}"), 'the lane\'s point term carries the block');
  assert.ok(point.includes('acc + winLit(wp, n, 0.0, 1.0)') && point.includes('acc + winLit(wp, vec3(0.0), 1.0, flatSun)'));
  assert.ok(el.includes("const EL_POINT_LIT_GLSL = elPointLitGlsl(true);") && el.includes("const EL_POINT_LIT_FLAT_GLSL = elPointLitGlsl('flat');"));
  assert.ok(EL_BB_FS.includes(flat) && EL_MESH_FS.includes(lane), 'the flat\'s program takes the flat block, a surface\'s the sun map\'s');
  const r = rd('src/render/renderer.js');
  assert.match(r, /const WL_CLASSIC_GLSL = windowLightGlsl\(\{ clusters: true \}\);/);
  const between = (a, b) => r.slice(r.indexOf(a), r.indexOf(b, r.indexOf(a) + a.length));
  for (const [name, from, to, call] of [
    ['FS', 'const FS = `', 'const CHAR_FS = `', 'lit += albedo * winLit(vWorldPos, n, 0.0, 1.0);'],
    ['CHAR_FS', 'const CHAR_FS = `', '`;', 'lit += albedo * winLit(vWorldPos, n, 0.0, 1.0);'],
    ['TERRAIN_FS', 'const TERRAIN_FS = `', '`;', 'winLit(vWorldPos, n, 0.0, 1.0)'],
    ['BB_FS', 'const BB_FS = `', '`;', 'pointAcc += winLit(vBBWorld, vec3(0.0), 1.0, 1.0);'],
    ['DECAL_FS', 'const DECAL_FS = `', '`;', 'pointAcc += winLit(vWorld, n, 0.0, 1.0);'],
  ]) {
    const src = between(from, to);
    assert.ok(src.includes('${WL_CLASSIC_GLSL}') && src.includes(call), name);
  }
});

test('WL1 W5: THE STREET BY NIGHT - a house front\'s tiles light where the mock room behind is lit (the rooms\' own seed, whole numbers on both sides) and only then; each a lamp through the window\'s glass box, its curtains narrowing it; none by day, none through an interior\'s glass, none from a mask not up; a placement held WL_HOLD_MS and let go after, forgotten with its mesh, moved with the floating origin (mutants: a dark room lit, the lamp by day, the hold, the forget, the shift)', () => {
  const log = [];
  const pass = passOn(log);
  pass.addMask('4001_0', CROSS);
  assert.equal(log.filter((c) => c[0] === 'texSubImage3D').length, 0, 'a mask goes up when a light first reads it');
  const mesh = { wl: [wlOf('4001_0', frontAp())] };
  pass.note(mesh, I, null, 'street', 1000);
  pass.note(mesh, I, null, 'street', 1001);
  assert.equal(pass.sources.street.get(mesh).length, 1, 'a placement is one source however often drawn');
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 4, 0], [0, 0.3, -8.5], [0, 1, 0]);
  const lamp = [1.2, 0.8, 0.3];
  const frame = (o) => pass.frame({ kind: 'street', eye: [0, 4, 0], view, proj, now: 1200, lamp, glass: () => 'window', ...o });
  const want = [];
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 6; tx++) if (roomLitAt(frontSeed(tx, ty))) want.push([tx, ty]);
  assert.ok(want.length > 0 && want.length < 12, `some rooms lit, some dark (${want.length})`);
  assert.ok(want.some(([tx, ty]) => roomCurtained(curtainBitsOf(frontSeed(tx, ty)))) && want.some(([tx, ty]) => !roomCurtained(curtainBitsOf(frontSeed(tx, ty)))), 'curtained rooms and bare ones');
  assert.equal(frame(), want.length, 'a light for each lit room, none for a dark one');
  // each light: the lamp kind, behind its own window, the rooms' lamp through the shape and as the glow
  const got = [];
  for (let i = 0; i < pass.count; i++) {
    const o = i * WL_VEC4 * 4, d = pass.data;
    assert.equal(d[o + 23], pass.masks.get('4001_0').layer + 256 * WL_KIND.lamp);
    assert.ok(near(d[o + 20], lamp[0] * WL_LAMP_GOBO, 1e-5) && near(d[o + 24], lamp[0] * WL_LAMP_SPILL, 1e-5));
    assert.equal(d[o + 3], WL_LAMP_RANGE);
    assert.ok(near(d[o + 18], -10 - WL_LAMP_DEPTH, 1e-4), 'the lamp behind the front');
    const tx = Math.floor((d[o] + 7.5) / 2.5), ty = Math.floor(d[o + 1] / 2.5);
    got.push([tx, ty]);
    const cb = curtainBitsOf(frontSeed(tx, ty));
    const u0 = roomCurtained(cb) ? curtainEdges(cb)[0] : 0, u1 = roomCurtained(cb) ? curtainEdges(cb)[1] : 1;
    const span = 58 / 64 - 6 / 64;   // the glass's box: texels 6..57 of 64
    assert.ok(near(d[o + 15], Math.min(u1, 58 / 64) - Math.max(u0, 6 / 64), 1e-4), `the glass box, its curtains drawn (${tx}, ${ty})`);
    const area = (Math.min(u1, 58 / 64) - Math.max(u0, 6 / 64)) * 2.5 * span * 2.5;
    const whole = span * 2.5 * span * 2.5;
    assert.ok(near(d[o + 27], roomCurtained(cb) ? area + (whole - area) * WL_CURTAIN_PASS : whole, 1e-3), 'the glow\'s area: the curtains pass their share');
  }
  assert.deepEqual(got.sort(), want.sort());
  assert.equal(frame({ lamp: null }), 0, 'by day the rooms\' lamps are out');
  assert.equal(frame({ glass: () => 'glass' }), 0, 'an interior\'s glass throws no lamp onto the street');
  assert.equal(frame({ glass: () => null }), 0, 'a picture without glass none');
  // the floating origin
  const xs = () => Array.from({ length: pass.count }, (_, i) => pass.data[i * WL_VEC4 * 4]).sort((a, b) => a - b);
  frame();
  const before = xs();
  pass.shift([5, 0, 0]);
  frame();
  assert.deepEqual(xs().map((x) => Math.round(x * 1e3)), before.map((x) => Math.round((x + 5) * 1e3)), 'every light moved with the origin');
  pass.shift([495, 0, 0]);
  assert.equal(frame(), 0, 'shifted half a kilometre: past the gather');
  pass.shift([-500, 0, 0]);
  assert.equal(frame(), want.length, 'and back');
  // the hold
  assert.equal(pass.frame({ kind: 'street', eye: [0, 4, 0], view, proj, now: 1001 + WL_HOLD_MS + 1, lamp, glass: () => 'window' }), 0, 'a placement unseen past the hold lights nothing');
  assert.equal(pass.sources.street.has(mesh), false, 'and is let go');
  pass.note(mesh, I, null, 'street', 1000);
  pass.forget(mesh);
  assert.equal(frame(), 0, 'a mesh let go lights nothing');
  // a dead mesh is let go at the frame
  const dead = { wl: mesh.wl, _dead: true };
  pass.note(dead, I, null, 'street', 1100);
  assert.equal(frame(), 0);
  assert.equal(pass.sources.street.has(dead), false);
});

test('WL1 W6: THE NEAREST WL_MAX_LIGHTS - more lit windows than the block holds keep the nearest, the farthest kept fading at the cut; nothing past WL_GATHER; the cut eases from frame to frame (mutants: the sort, the fade, the ease)', () => {
  const pass = passOn();
  pass.addMask('4001_0', CROSS);
  // sixty fronts in rows 2 m apart down the street, their rooms lit by their own seeds
  const ap = frontAp();
  const meshes = [];
  for (let i = 0; i < 60; i++) {
    const mesh = { wl: [wlOf('4001_0', ap)] };
    const m = identity(); m[14] = -2 * i;
    pass.note(mesh, m, null, 'street', 1000);
    meshes.push(mesh);
  }
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 2, 0], [0, 2, -10], [0, 1, 0]);
  const both = pass.frame({ kind: 'street', eye: [0, 2, 0], view, proj, now: 1100, lamp: [1, 1, 1], glass: () => 'window' });
  const n = pass.count;   // PIN MOVED (LIGHT-REACH): the frame answers the near tier and the far rows together
  assert.equal(both, n + pass.farCount);
  assert.ok(pass.stats.candidates > WL_MAX_LIGHTS, `more candidates (${pass.stats.candidates}) than the block holds`);
  assert.ok(n <= WL_MAX_LIGHTS && n > WL_MAX_LIGHTS / 2, `${n}`);
  // the lit tiles' centres, every front alike (the seed reads the plane off the model's own frame), nearest first
  const lit = [];
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 6; tx++) if (roomLitAt(frontSeed(tx, ty))) lit.push([tx, ty]);
  const tileD = (i, tx, ty) => Math.hypot(-6.25 + 2.5 * tx, 1.25 + 2.5 * ty - 2, -10 - 2 * i);
  const all = meshes.flatMap((_, i) => lit.map(([tx, ty]) => tileD(i, tx, ty))).sort((a, b) => a - b);
  let far = 0, faded = 0;
  for (let i = 0; i < n; i++) {
    const o = i * WL_VEC4 * 4;
    const tx = Math.floor((pass.data[o] + 7.5) / 2.5), ty = Math.floor(pass.data[o + 1] / 2.5), fi = Math.round((-10 - pass.data[o + 2]) / 2);
    far = Math.max(far, tileD(fi, tx, ty));
    if (pass.data[o + 20] < WL_LAMP_GOBO - 1e-6) faded++;
  }
  assert.ok(far <= all[WL_MAX_LIGHTS - 1] + 1e-6, `the nearest kept (${far} against ${all[WL_MAX_LIGHTS - 1]})`);
  assert.ok(far < WL_GATHER, 'none past the gather');
  assert.ok(faded > 0, 'the ones at the cut fade');
  const first = pass._cuts.street;
  pass.frame({ kind: 'inside', eye: [0, 2, 0], view, proj, now: 1105, glass: () => 'glass' });   // a building's frame between: its own cut
  pass.frame({ kind: 'street', eye: [200, 2, 0], view, proj, now: 1116, lamp: [1, 1, 1], glass: () => 'window' });
  assert.ok(Math.abs(pass._cuts.street - first) < Math.abs(WL_GATHER - first) + 1e-9 && pass._cuts.street !== WL_GATHER, 'the cut eases, never jumps - a frame of the other kind between');
});

test('WL1 W7: THE SUN THROUGH A BUILDING\'S GLASS - the outside\'s sun lights in through glass that faces it (read through the sun map when it is drawn), the sky glows off every pane, the moon by night; a pane facing away none of the sun; sunFor names the sun only when some glass faces it, so the frame draws its map then (mutants: the facing, the gains, the kind, the moon, sunFor)', () => {
  const pass = passOn();
  const glass = mask(16, 16, () => true);
  pass.addMask('4002_0', glass);
  // a room's east wall at x = 3, its glass facing into the room (-x)
  const wall = quad([3, 0, -3], [0, 0, 6], [0, 3, 0], [-1, 0, 0], 2, 1);
  const mesh = { wl: [wlOf('4002_0', windowAperturesOf(wall.positions, wall.normals, wall.uvs, wall.indices, 0, 6))] };
  pass.note(mesh, I, null, 'inside', 1000);
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 1.6, 0], [3, 1.6, 0], [0, 1, 0]);
  const sky = [0.6, 0.65, 0.7];
  const sunOut = (dir, sunScale = 0.9, moonScale = 0) => pass.setOutside({ at: 1000, sunDir: dir, sunColor: [1, 0.9, 0.8], sunScale, moonDir: [0.2, 0.6, 0.77], moonColor: [0.5, 0.6, 0.8], moonScale, sky });
  const frame = (shadows) => pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view, proj, now: 1100, shadows, glass: () => 'glass' });
  sunOut([0.8, 0.5, 0.1]);   // the sun in the east: outside the east wall
  assert.deepEqual(pass.sunFor([0, 1.6, 0], 1100), [0.8, 0.5, 0.1]);
  assert.equal(frame(true), 2, 'both panes');
  const d = pass.data;
  assert.ok(near(d[20], 1 * 0.9 * WL_SUN_GAIN, 1e-5) && near(d[21], 0.9 * 0.9 * WL_SUN_GAIN, 1e-5), 'the sun at its scale and gain');
  assert.ok(near(d[24], sky[0] * WL_SKY_GAIN, 1e-5), 'the sky\'s glow');
  assert.equal(d[23], 0 + 256 * WL_KIND.sun); assert.equal(d[3], WL_SUN_REACH);
  assert.deepEqual([d[16], d[17], d[18]].map((v) => Math.round(v * 1e4) / 1e4), [0.8, 0.5, 0.1], 'toward the sun');
  frame(false);
  assert.equal(d[23], 256 * WL_KIND.sunBare, 'no sun map: the sun unshadowed');
  sunOut([-0.8, 0.5, 0.1]);   // the sun in the west: behind the room
  assert.equal(pass.sunFor([0, 1.6, 0], 1100), null, 'no glass faces it: no map');
  assert.equal(frame(true), 2);
  assert.deepEqual([d[20], d[21], d[22]], [0, 0, 0], 'no sun through glass facing away');
  assert.ok(d[24] > 0, 'the sky still glows off it');
  sunOut([0.8, -0.5, 0.1], 0, 0.4);   // night: the sun under, the moon up in the east
  assert.deepEqual(pass.sunFor([0, 1.6, 0], 1100), [0.2, 0.6, 0.77].map((v) => v), 'the moon\'s map');
  frame(true);
  assert.ok(near(d[20], 0.5 * 0.4 * WL_MOON_GAIN, 1e-5), 'the moon at its scale and gain');
  pass.setOutside(null);
  assert.equal(frame(true), 0, 'no outside read: nothing');
});

test('WL1 W8: THE RENDERER\'S FRAME - its kind from the world frame and the Real windows row as a host last said it (street when the window style glows, inside when DFU disables it), none off the world, with the row Off or the door shut; a program reading the block bound to its point and its samplers on their units; a lit street\'s band uploaded to LC1\'s grid past the lanterns\' rows and its draws told (mutants: the kind, the row ignored, the binding, the band\'s row, the draw\'s flag)', () => {
  const log = [];
  const r = recordingRenderer(log);
  const binds = log.filter((c) => c[0] === 'uniformBlockBinding');
  // PIN MOVED (LIGHT-REACH): each lit program holds two blocks - the near lights' and the far rows' - each on its own point
  assert.ok(binds.length >= 10 && binds.every((c, i) => c[3] === (i % 2 ? WL_FAR_UBO_BINDING : WL_UBO_BINDING)), `every lit program on the blocks' points (${binds.length})`);
  assert.deepEqual(log.filter((c) => c[0] === 'bindBufferBase' && c[1] === 'UNIFORM_BUFFER').map((c) => c[2]), [WL_UBO_BINDING, WL_FAR_UBO_BINDING], 'LIGHT-REACH: both blocks on their points from the renderer\'s first frame');
  assert.ok(uploads(log, 'uWinMask').length >= 5 && uploads(log, 'uWinMask').every((v) => v[0] === WL_MASK_UNIT), 'the masks\' unit');
  const grid = log.find((c) => c[0] === 'texImage2D' && c[3] === 'RG16UI');
  assert.ok(grid && grid[5] === 72 && CLUSTER_BANDS === 3, 'LC1\'s grid three bands high (PIN MOVED, LIGHT-REACH: the far rows\' band)');
  assert.equal(r._wlKindOf({ world: true }), null, 'the row Off until a host says it');
  r.setWindowRooms('full');
  r.setWindowEmission(windowEmissionRGB('night'));
  assert.equal(r._wlKindOf({ world: true }), 'street');
  assert.equal(r._wlKindOf({}), null, 'not a world frame');
  r.setWindowEmission(windowEmissionRGB('disabled'));
  assert.equal(r._wlKindOf({ world: true }), 'inside', 'DFU\'s interiors disable the style');
  const loc = globalThis.location;
  globalThis.location = /** @type {any} */ ({ search: '?windowlight=off' });
  try { assert.equal(r._wlKindOf({ world: true }), null, 'the door shut'); } finally { globalThis.location = loc; }
  assert.equal(windowLightOn('?windowlight=off'), false); assert.equal(windowLightOn(''), true);
  r.setWindowRooms('off');
  assert.equal(r._wlKindOf({ world: true }), null, 'the row Off');
  // a lit street: the window mask, the front, two frames
  r.setWindowRooms('full');
  r.setWindowEmission(windowEmissionRGB('night'));
  r.uploadTexture(4001, 0, { width: 64, height: 64, colors: new Uint8Array(64 * 64 * 4).fill(200) }, { opaque: true });
  r.uploadEmissionTexture(4001, 0, CROSS, { window: true });
  const front = r.createMesh({ ...FRONT, subMeshes: [{ textureArchive: 4001, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] });
  assert.equal(front.wl.length, 1, 'the mesh\'s glass measured at its upload');
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 4, 0], [0, 0.3, -8.5], [0, 1, 0]);
  r.beginFrame(proj, view, new Float32Array([0, 1, 0]), WORLD_FRAME);
  r.drawMesh(front, I);
  log.length = 0;
  r.beginFrame(proj, view, new Float32Array([0, 1, 0]), WORLD_FRAME);
  assert.equal(r._wlKind, 'street'); assert.equal(r._wlLive, true);
  const band = log.find((c) => c[0] === 'texSubImage2D' && c[4] === WL_GRID_ROW);
  assert.ok(band, 'the band at the grid\'s second half');
  assert.equal(WL_GRID_ROW, CLUSTER_Z); assert.equal(WL_LIST_BASE, CLUSTER_LIST_W * CLUSTER_LIST_ROWS);
  assert.ok(log.some((c) => c[0] === 'bufferSubData' && c[1] === 'UNIFORM_BUFFER' && c[5] === r._wl.count * WL_VEC4 * 4), 'the lights written into the block, no more');
  assert.ok(uploads(log, 'uWinOn').some((v) => v[0] === 1), 'the frame\'s draws read the band');
  // a panel or a sprite pass is another view: no window light, and a frame off the world none
  log.length = 0;
  r.beginFrame(proj, view, new Float32Array([0, 1, 0]), {});
  assert.equal(r._wlKind, null); assert.equal(r._wlLive, false);
  assert.ok(uploads(log, 'uWinOn').length > 0 && !uploads(log, 'uWinOn').some((v) => v[0] === 1), 'told off');
  r.destroyMesh(front);
  assert.equal(r._wl.sources.street.has(front), false, 'a destroyed mesh lights nothing');
});

test('WL1 W9: A BUILDING\'S FRAME READS THE OUTSIDE - the view out\'s step asks the renderer for the street\'s light each interior frame (the host\'s own clock, in a bracket that puts the room\'s light back), at most every WL_OUTSIDE_EVERY_MS, never with the row Off (mutants: the capture lost, the bracket leaking, the row ignored)', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.setLighting(new Float32Array([0.2, 0.2, 0.2]), 0, new Float32Array([1, 1, 1]));
  r.setWindowEmission(windowEmissionRGB('disabled'));
  let setups = 0;
  const scene = { setup: (rr) => { setups++; rr.setLighting(new Float32Array([0.8, 0.8, 0.9]), 0.9, new Float32Array([1, 0.95, 0.85])); return new Float32Array([0.8, 0.45, 0.1]); }, draw: () => {} };
  const state = createViewOut();
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 1.6, 0], [3, 1.6, 0], [0, 1, 0]);
  viewOutFrame(state, { renderer: r, mode: 'rooms', proj, view, now: 5000, scene });
  const o = r._wl.outside;
  assert.ok(o && near(o.sunDir[0], 0.8, 1e-6) && o.sunScale === 0.9 && near(o.sky[0], 0.8, 1e-6), 'the street\'s sun and sky');
  assert.equal(r._ambient[0], Math.fround(0.2), 'the room\'s light put back');
  assert.equal(r._sunScale, 0);
  assert.deepEqual(Array.from(r._windowEmission), Array.from(windowEmissionRGB('disabled')));
  assert.equal(r._rwMode, 'rooms');
  const n = setups;
  r.captureOutsideLight(scene, 5100, 'rooms');
  assert.equal(setups, n, 'not again inside the interval');
  r.captureOutsideLight(scene, 5400, 'rooms');
  assert.equal(setups, n + 1);
  r.captureOutsideLight(scene, 9000, 'off');
  assert.equal(setups, n + 1, 'the row Off reads nothing');
  assert.equal(r._rwMode, 'off');
  assert.match(rd('src/render/realWindows.js'), /finally \{ opts\.renderer\.captureOutsideLight\?\.\(opts\.scene, opts\.now, opts\.mode\); \}/);
});

test('WL1 W10: THE SUN MAP IN A BUILDING - a frame with no sun of its own but a window sun draws the sun\'s cascades toward it, a window\'s sub-mesh through the glass cut (its mask a hole), the rest as ever; a frame without one draws none, and the street\'s own sun keeps the glass (mutants: the window sun ignored, the cut lost, the cut on the street\'s sun)', () => {
  const calls = [];
  const gl = new Proxy({}, { get: (_, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, nm) => `${p.name}.${nm}`;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: Math.random() });
    if (k === 'getParameter') return () => new Float32Array(4);
    if (typeof k === 'string' && k.toUpperCase() === k) return k === 'TEXTURE0' ? 33984 : 1;
    return (...a) => { calls.push([k, ...a]); };
  } });
  const build = (vs, fs) => ({ name: `${vs}/${fs === DEPTH_GLASS_FS ? 'glass' : fs === DEPTH_FS ? 'depth' : 'other'}` });
  const sp = new ShadowPass(gl, { build, vs: { mesh: 'MESH', bb: 'BB', terrain: 'TERRAIN', char: 'CHAR' } });
  assert.equal(sp.programs.meshGlass.p.name, 'MESH/glass');
  const b = new Float32Array([0, 1, 0, 4]);
  const mesh = { vao: { m: 1 }, bounds: b, _evAnyGlass: true, subMeshes: [
    { primitiveCount: 2, startIndex: 0, _bounds: b },
    { primitiveCount: 2, startIndex: 6, _bounds: b, _evWin: true, _evEmis: { glass: 1 } },
  ] };
  const f = { bindVao: () => {}, textures: new Map(), isSpectral: () => false, eye: [0, 1.6, 0], lightDir: [0, -1, 0], sunScale: 0, pointLights: new Float32Array(0), carried: null, cascadeScale: 1, everyLight: false, cut: false };
  const run = (extra) => { sp.recordMesh(mesh, I, null, 0); calls.length = 0; sp.render({ ...f, ...extra }); sp.discard?.(); return calls; };
  const lit = run({ windowSun: [0.8, 0.5, 0.1] });
  assert.ok(sp.stats.sunDraws > 0 || lit.some((c) => c[0] === 'drawElements'), 'the cascades drawn');
  assert.ok(lit.some((c) => c[0] === 'useProgram' && c[1].name === 'MESH/glass'), 'the window\'s sub-mesh through the glass cut');
  assert.ok(lit.some((c) => c[0] === 'bindTexture' && c[2]?.glass === 1), 'its mask bound');
  assert.equal(sp.sunParams[3], 1, 'the map stands for the receivers');
  const none = run({});
  assert.ok(!none.some((c) => c[0] === 'useProgram' && c[1].name === 'MESH/glass') && sp.sunParams[3] === 0, 'no window sun: no map');
  const street = run({ sunScale: 1, lightDir: [0.3, 0.8, 0.2] });
  assert.ok(!street.some((c) => c[0] === 'useProgram' && c[1].name === 'MESH/glass'), 'the street\'s sun: the glass casts as it always did');
  const rr = rd('src/render/renderer.js');
  assert.match(rr, /windowSun: this\._wlSun/);
  assert.match(rr, /this\._wlSun = this\._wlKind === 'inside' && this\._shadows \? this\._wl\.sunFor\(/);
});

test('WL1 W11: a static batch measures its windows\' glass in its sliced merge (the renderer\'s word on which pictures may hold glass), and the renderer takes the batch\'s apertures as they are; the pipeline names the pictures before they are up (mutants: the batch measuring none, the renderer measuring again, the pipeline\'s word lost)', () => {
  const key = (a, r) => `${a}_${r}`;
  const sb = new StaticBatchBuilder({ windows: (a, r) => a === 4001 && r === 0 });
  sb.add({ ...FRONT, subMeshes: [{ textureArchive: 4001, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] }, I, key);
  sb.add({ ...quad([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 1, 1), subMeshes: [{ textureArchive: 9, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] }, I, key);
  const m = sb.finish();
  const win = m.subMeshes.find((s) => s.textureArchive === 4001), wall = m.subMeshes.find((s) => s.textureArchive === 9);
  assert.equal(win.apertures.recs.length, 12 * WL_REC, 'the front\'s twelve tiles');
  assert.equal(wall.apertures, undefined, 'a wall\'s picture none');
  const log = [];
  const r = recordingRenderer(log);
  const ap = r._wlApertures(m);
  assert.equal(ap.length, 1); assert.equal(ap[0].ap, win.apertures.recs, 'the batch\'s own, not measured again'); assert.equal(ap[0].cells, win.apertures.cells);
  assert.equal(ap[0].key, '4001_0');
  const pb = rd('src/scenes/pixelBuild.js');
  assert.match(pb, /const windowKeys = \(r\) => \(r\?\.wlGlassKey \? \(a, rec\) => r\.wlGlassKey\(a, rec\) : null\);/);
  assert.equal(pb.split('windows: windowKeys(renderer)').length - 1, 2, 'both of the pixel\'s merges');
  assert.match(rd('src/scenes/dataPipeline.js'), /if \(renderer\) renderer\.glassKeyTest = \(a, r\) => isExteriorWindow\(a, r\) \|\| interiorWindowOf\(a\)\?\.record === r \|\| !!facadeGlass\(a, r\);/);
  r.glassKeyTest = (a, rec) => a === 77 && rec === 3;
  assert.equal(r.wlGlassKey(77, 3), true, 'a picture the pipeline names, before it is up');
  assert.equal(r.wlGlassKey(77, 4), false);
});

test('WL1 W12: the mock rooms by day - the sun through the glass lands on the room\'s floor and walls as a patch the shape of the panes, behind the curtains none; the street\'s moon in a view out is the hour\'s (lightStreetAt) (mutants: the patch lost, the moon unset)', () => {
  const room = realWindowsGlsl();
  for (const s of ['float m = textureLod(uEmissionTex, tile + vec2(gp.x, up > 0.0 ? gp.y : 1.0 - gp.y), 0.0).r;', `light += skyL * (${ROOM_SUN_SHARE} * m * max(cosr, 0.0));`, 'bool shut = curtained && lc > 0.0 && (xc < cl || xc > crr);']) {
    assert.ok(room.includes(s), s);
  }
  const calls = [];
  const r = { setLighting: (...a) => calls.push(['light', ...a]), setMoonlight: (m) => calls.push(['moon', m]) };
  const moon = { scale: 0.3, dir: [0, 1, 0], color: [0.5, 0.6, 0.8], ambient: [0.02, 0.02, 0.03] };
  lightStreetAt(r, { ambient: new Float32Array([0.1, 0.1, 0.12]), sun: 0 }, moon, [1, 1, 1]);
  assert.equal(calls[1][1], moon, 'the hour\'s moon');
  assert.ok(near(calls[0][1][2], 0.15, 1e-6), 'its ambient lifted by the moon');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(host), /lightStreetAt\(r, light, sky\.moonlight\(clockMinute\), SUN_RIG_COLOR\);/, host);   // PIN MOVED (AUDIT SKYRIM-AURORA 2): the sky's night light at the clock's minute
});

test('WL1 W13 (see-through): the exterior windows whose glass is not the palette\'s 0xff - each named record\'s colours read as its panes, specks inside a pane filled, the lead and the frame kept; a record with DFU\'s own glass keeps DFU\'s mask; a record not a window none; the pipeline uploads the mask for every window record (mutants: the table, the speck fill, DFU\'s mask overridden)', () => {
  for (const k of Object.keys(EXTERIOR_GLASS)) { const [a, r] = k.split('_').map(Number); assert.ok(isExteriorWindow(a, r), `${k} is a window of DFU's table`); }
  assert.deepEqual(exteriorGlassIndices(171, 2), [104, 105, 106]);
  assert.equal(exteriorGlassIndices(171, 3), null);
  // a 12 x 12 window in 171_2's blue: four panes behind a cross of lead and a frame, a speck of grain in one pane
  const W = 12, H = 12, data = new Uint8Array(W * H).fill(30);
  for (let y = 1; y < 11; y++) for (let x = 1; x < 11; x++) if (x !== 6 && y !== 6) data[y * W + x] = 104 + ((x + y) % 3);
  data[3 * W + 3] = 30;   // the speck
  const t = { getWindowColors32: (bm) => { const colors = new Uint8ClampedArray(bm.width * bm.height * 4); for (let i = 0; i < bm.data.length; i++) if (bm.data[i] === 0xff) colors.fill(255, i * 4, i * 4 + 4); return { colors, width: bm.width, height: bm.height }; } };
  const m = exteriorWindowMask(171, 2, { width: W, height: H, data }, t);
  const g = (x, y) => m.colors[((H - 1 - y) * W + x) * 4] > 127;
  assert.equal(g(3, 3), true, 'the speck is glass');
  assert.equal(g(6, 3), false, 'the lead');
  assert.equal(g(0, 0), false, 'the frame');
  assert.equal(g(2, 8), true, 'a pane, rows bottom-up');
  const own = new Uint8Array(W * H).fill(30); own[5 * W + 5] = 0xff;
  assert.deepEqual(exteriorWindowMask(171, 2, { width: W, height: H, data: own }, t), t.getWindowColors32({ width: W, height: H, data: own }), 'DFU\'s own glass stands');
  assert.equal(exteriorWindowMask(171, 3, { width: W, height: H, data }, t), null, 'not a window');
  const specks = new Uint8Array(25).fill(1); specks[12] = 0; specks[13] = 0; specks[7] = 0;
  assert.equal(fillPaneSpecks(specks, 5, 5)[12], 1, `a run of ${SPECK_MAX} inside glass filled`);
  const diag = new Uint8Array(64).fill(1);
  for (let i = 1; i < 7; i++) diag[i * 8 + i] = 0;   // a lattice's lead, one texel wide, corner to corner
  assert.equal(Array.from(fillPaneSpecks(diag, 8, 8)).filter((v) => !v).length, 6, 'a diagonal lead is one run, kept');
  assert.match(rd('src/scenes/dataPipeline.js'), /renderer\.uploadEmissionTexture\(archive, record, exteriorWindowMask\(archive, record, bitmap, t\), \{ replacement, window: true \}\);/);
});

test('WL1 W13 (ARENA2): every window record DFU\'s table names in a building\'s climate has glass but 036 #3, a wall (skipped without ARENA2_PATH)', (t) => {
  const A = process.env.ARENA2_PATH;
  if (!A || !existsSync(join(A, 'TEXTURE.036'))) return t.skip('ARENA2_PATH not set');
  const rows = scanWindows(A);
  assert.ok(rows.length > 100, `${rows.length}`);
  const none = rows.filter((r) => !r.glass).map((r) => `${r.archive}#${r.record}`);
  assert.deepEqual(none, ['36#3']);
  for (const k of Object.keys(EXTERIOR_GLASS)) { const [a, r] = k.split('_').map(Number); const row = rows.find((x) => x.archive === a && x.record === r); assert.ok(row && row.ff === 0 && row.glass > 0, k); }
});

test('WL1 W14: THE HOSTS - exterior.js and world.js light the street through the renderer (their frames are world frames with the row set), the interior arm through the view out\'s step, the dungeon none (no window to the street: FLAGGED); the hosts did not grow (mutants: a host wiring its own)', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.ok(wm.includes('viewOutFrame('), 'the interior arm asks the view out, which reads the outside');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) assert.ok(!rd(host).includes('WindowLightPass'), `${host}: the renderer owns the pass`);
  assert.ok(!rd('src/scenes/dungeonContext.js').includes('viewOutFrame'), 'a dungeon: no window light');
  assert.ok(readFileSync(new URL('../../src/render/windowLight.js', import.meta.url), 'utf8').includes('07-Rendering/Real-Windows.md, WL1'));
});

test('WL1 W15 (AUDIT): a mover\'s windows go with it - a mesh drawn again within WL_MOVE_REACH of a placement not yet drawn this frame has moved there (no light left behind for the hold), two placements drawn in one frame stay two; a placement past the gather costs one check, not a walk of its tiles (mutants: the mover\'s ghost, the far placement walked)', () => {
  const pass = passOn();
  pass.addMask('4001_0', CROSS);
  const mesh = { wl: [wlOf('4001_0', frontAp())] };
  const at = (x) => { const m = identity(); m[12] = x; return m; };
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 4, 0], [0, 0.3, -8.5], [0, 1, 0]);
  const frame = (now, eye = [0, 4, 0]) => pass.frame({ kind: 'street', eye, view, proj, now, lamp: [1, 1, 1], glass: () => 'window' });
  pass.note(mesh, at(0), null, 'street', 1000);
  frame(1000);
  const x0 = Array.from({ length: pass.count }, (_, i) => pass.data[i * WL_VEC4 * 4]).sort((a, b) => a - b);
  for (let f = 1; f <= 30; f++) pass.note(mesh, at(f * 0.3), null, 'street', 1000 + f * 16);   // a ship under way, 9 m in half a second
  assert.equal(pass.sources.street.get(mesh).length, 1, 'one placement, moved - not thirty');
  frame(1000 + 30 * 16);
  const x1 = Array.from({ length: pass.count }, (_, i) => pass.data[i * WL_VEC4 * 4]).sort((a, b) => a - b);
  assert.deepEqual(x1.map((x) => Math.round(x * 1e3)), x0.map((x) => Math.round((x + 9) * 1e3)), 'its windows where it is now');
  pass.note(mesh, at(9 + WL_MOVE_REACH / 2), null, 'street', 2000);
  pass.note(mesh, at(9), null, 'street', 2000);
  assert.equal(pass.sources.street.get(mesh).length, 2, 'two drawn in one frame are two, however near');
  assert.ok(WL_PLACEMENTS_MAX >= 4096);
  frame(2016, [500, 4, 0]);
  assert.equal(pass.stats.walked, 0, 'half a kilometre off: no tile measured');
  frame(2032);
  assert.equal(pass.stats.walked, 24, 'near: both placements\' twelve tiles');
});

test('WL1 W16 (AUDIT): the masks\' unit is no other pass\'s - the snow terrain program is built from the terrain\'s and holds both its own pictures and the window block, and two sampler types on one unit fail every draw (mutant: the mask on the snow\'s unit 16)', () => {
  const units = new Map();
  const dir = new URL('../../src/render/', import.meta.url);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js') || f === 'windowLight.js') continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/export const (\w+_UNIT) = (\d+);/g)) units.set(`${f}:${m[1]}`, Number(m[2]));
  }
  for (const [k, v] of Object.entries(SNOW_UNITS)) units.set(`snowfallGlsl.js:SNOW_UNITS.${k}`, v);
  assert.ok(units.size > 15, `the tree's units found (${units.size})`);
  const clash = [...units].filter(([, v]) => v === WL_MASK_UNIT).map(([k]) => k);
  assert.deepEqual(clash, [], 'no other pass binds the masks\' unit');
  assert.ok(WL_MASK_UNIT < 32, 'under WebGL2\'s least MAX_COMBINED_TEXTURE_IMAGE_UNITS');
});

test('WL1 W17 (AUDIT): no window picture is ever lost - a mask is kept with its bytes and goes up onto a layer when a light first reads it; with every layer taken, the one read least lately and not this frame gives way, and a mask given way comes back the next time it is read; a picture let go frees its layer; the mips are made once a frame (mutants: the LRU, the drop, the mips per add)', () => {
  const log = [];
  const pass = passOn(log);
  const keys = Array.from({ length: WL_MASK_LAYERS + 6 }, (_, i) => `k${i}`);
  for (const k of keys) pass.addMask(k, CROSS);
  assert.equal(log.filter((c) => c[0] === 'texSubImage3D').length, 0, 'nothing up until read');
  const M = (k) => pass.masks.get(k);
  for (let i = 0; i < WL_MASK_LAYERS; i++) assert.equal(pass._resident(M(keys[i]), 1), true);
  assert.equal(pass._resident(M(keys[WL_MASK_LAYERS]), 1), false, 'every layer read this frame: none to give');
  assert.equal(pass._resident(M(keys[WL_MASK_LAYERS]), 2), true, 'the next frame: one gives way');
  const gone = keys.find((k) => M(k).layer < 0 && keys.indexOf(k) < WL_MASK_LAYERS);
  assert.ok(gone, 'a mask gave way');
  assert.equal(pass._resident(M(gone), 3), true, 'and comes back when read');
  assert.ok(M(gone).layer >= 0);
  const layers = keys.map((k) => M(k).layer).filter((l) => l >= 0);
  assert.equal(new Set(layers).size, layers.length, 'no two masks on one layer');
  const freed = M(keys[3]).layer;
  pass.dropMask(keys[3]);
  assert.equal(pass.masks.has(keys[3]), false);
  assert.equal(pass._resident(M(keys[WL_MASK_LAYERS + 1]), 3), true);
  assert.equal(M(keys[WL_MASK_LAYERS + 1]).layer, freed, 'the freed layer is taken first');
  // a frame: the layers it put up get their mips once
  const pass2 = passOn(log);
  for (const k of ['a', 'b', 'c']) pass2.addMask(k, CROSS);
  const front = (k) => ({ wl: [wlOf(k, frontAp())] });
  for (const k of ['a', 'b', 'c']) pass2.note(front(k), I, null, 'street', 1000);
  log.length = 0;
  pass2.frame({ kind: 'street', eye: [0, 4, 0], view: lookAt([0, 4, 0], [0, 0.3, -8.5], [0, 1, 0]), proj: perspective(1.1, 1.6, 0.1, 500), now: 1000, lamp: [1, 1, 1], glass: () => 'window' });
  assert.equal(log.filter((c) => c[0] === 'texSubImage3D').length, 3, 'three masks up');
  assert.equal(log.filter((c) => c[0] === 'generateMipmap').length, 1, 'their mips once');
  log.length = 0;
  pass2.frame({ kind: 'street', eye: [0, 4, 0], view: lookAt([0, 4, 0], [0, 0.3, -8.5], [0, 1, 0]), proj: perspective(1.1, 1.6, 0.1, 500), now: 1016, lamp: [1, 1, 1], glass: () => 'window' });
  assert.equal(log.filter((c) => c[0] === 'texSubImage3D' || c[0] === 'generateMipmap').length, 0, 'held: nothing again');
  const r = rd('src/render/renderer.js');
  assert.match(r, /this\.windowMasks\?\.delete\(key\);   \/\/ RW1\n    this\._wl\?\.dropMask\(key\);/, 'an evicted window picture frees its layer');
  assert.match(r, /this\.glassMasks\.delete\(key\);\n      this\._wl\?\.dropMask\(key\);/, 'and an evicted glass mask');
  assert.match(r, /if \(this\._cutoutKeys\?\.delete\(base\)\) this\._wl\?\.dropMask\(base\);/, 'and a cutout\'s last picture');
});

test('WL1 W18 (AUDIT): more cells than the band\'s list holds keeps the nearest lights that fit - never none (mutant: the frame dropping every light)', () => {
  const pass = passOn();
  pass.addMask('4001_0', CROSS);
  const ap = frontAp();
  for (let i = 0; i < 160; i++) {   // PIN MOVED (LIGHT-REACH): a light's box is its beam's, not its reach's sphere - so a
    const m = identity(); m[14] = 30 - 0.5 * i;   // denser street than eighty fronts 2 m apart is needed to fill the list
    pass.note({ wl: [wlOf('4001_0', ap)] }, m, null, 'street', 1000);
  }
  const view = lookAt([0, 2, 0], [0, 1.5, -10], [0, 1, 0]), proj = perspective(1.1, 1.6, 0.1, 500);
  pass.frame({ kind: 'street', eye: [0, 2, 0], view, proj, now: 1000, lamp: [1, 1, 1], glass: () => 'window' });
  const n = pass.count;   // PIN MOVED (LIGHT-REACH): the frame answers the far rows with it
  assert.ok(pass.stats.dropped > 0, `the list overflowed (${pass.stats.dropped} dropped)`);
  assert.ok(n > 0 && n === pass.count, `the nearest kept (${n})`);
  assert.equal(pass._cuts.street, pass._ld[n], 'the cut comes in to the first left out: from here the edge fades');
  const d = (i) => Math.hypot(pass.data[i * WL_VEC4 * 4], pass.data[i * WL_VEC4 * 4 + 1] - 2, pass.data[i * WL_VEC4 * 4 + 2]);
  for (let i = 1; i < n; i++) assert.ok(d(i) >= d(i - 1) - 1.5, 'nearest first (a light stands at its glass, a curtain off its tile\'s middle)');
});

test('WL1 W19 (AUDIT): a sliver of a tile is no window, a quad mapped a millimetre apart is one window, a triangle with no area none, and a tile whose share holds none of its picture\'s glass takes no light (mutants: the sliver floor, the merge, the area test, the glass test)', () => {
  const sl = quad([0, 0, 0], [2.525, 0, 0], [0, 2.5, 0], [0, 0, 1], 1.01, 1);
  assert.equal(windowAperturesOf(sl.positions, sl.normals, sl.uvs, sl.indices, 0, 6).recs.length / WL_REC, 1, `a 1% share is under APERTURE_MIN_COVER (${APERTURE_MIN_COVER})`);
  const off = quad([0, 0, 0], [2.5, 0, 0], [0, 2.5, 0], [0, 0, 1], 1, 1);
  off.positions[7] += 0.0015;   // the second triangle's corner a millimetre and a half up
  const one = windowAperturesOf(off.positions, off.normals, off.uvs, off.indices, 0, 6).recs;
  assert.equal(one.length / WL_REC, 1, 'one window');
  assert.deepEqual(Array.from(one.subarray(14, 18)), [0, 0, 1, 1], 'its share the union of both');
  const flat = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]) };
  assert.equal(windowAperturesOf(flat.positions, flat.normals, flat.uvs, flat.indices, 0, 3).recs.length, 0, 'collinear corners: no plane');
  // the glass in u 0.6..0.9 of its tile, the mesh over u 0..0.5: no light
  const pass = passOn();
  pass.addMask('m', mask(64, 64, (x, y) => x >= 38 && x < 58 && y >= 8 && y < 56));
  const half = quad([-0.625, 0, -5], [1.25, 0, 0], [0, 2.5, 0], [0, 0, 1], 0.5, 1);
  pass.note({ wl: [wlOf('m', windowAperturesOf(half.positions, half.normals, half.uvs, half.indices, 0, 6))] }, I, null, 'inside', 1000);
  pass.setOutside({ at: 1000, sunDir: [0, 0.5, -0.87], sunColor: [1, 1, 1], sunScale: 1, moonDir: [0, -1, 0], moonColor: [0, 0, 0], moonScale: 0, sky: [0.5, 0.5, 0.5] });
  assert.equal(pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view: lookAt([0, 1.6, 0], [0, 1.6, -5], [0, 1, 0]), proj: perspective(1.1, 1.6, 0.1, 500), now: 1000, glass: () => 'glass' }), 0);
  assert.equal(pass.stats.candidates, 0, 'not even a candidate - no slot spent on it');
});

test('WL1 W20 (AUDIT): with no sun map, the sun through glass stops a storey down (a floor is between), and a pane the sun does not face only glows out to WL_SPILL_REACH with a ball to match; a sun beam\'s ball runs into the room (mutants: the storey test, the spill reach, the beam\'s ball)', () => {
  const c = [0, 4.5, 0], U = [2, 0, 0], V = [0, 1.5, 0], nf = [0, 0, 1];
  const dir = [0, 0.6, -0.8];   // toward the sun: up and behind the glass
  const out = new Float32Array(WL_VEC4 * 4);
  writeWindowLight(out, 0, { c, U, V, nf, uv: [0.5, 0.5, 1, 1], src: dir, kind: WL_KIND.sunBare, layer: 0, reach: 24, area: 3, gobo: [1, 1, 1], spill: [0, 0, 0], halfDiag: 1.25 });
  const beam = (y) => { const t = (4.5 - y) / 0.6; return [0, y, 0.8 * t]; };   // a point the beam through the middle reaches
  const lit = (p) => windowLightAt(out, p, [0, 1, 0], () => 1, () => 1)[0];
  assert.ok(lit(beam(3.0)) > 0, 'its own floor (1.5 m under the middle, the glass\'s bottom 0.75 above it)');
  assert.equal(lit(beam(0.5)), 0, 'the floor below: under the storey');
  assert.ok(windowLightGlsl().includes('if (kind == 2 && wp.y < c0.y'), 'the shader the same');
  // the pass's balls
  const pass = passOn();
  pass.addMask('g', mask(16, 16, () => true));
  const wall = quad([3, 0, -3], [0, 0, 6], [0, 3, 0], [-1, 0, 0], 2, 1);
  pass.note({ wl: [wlOf('g', windowAperturesOf(wall.positions, wall.normals, wall.uvs, wall.indices, 0, 6))] }, I, null, 'inside', 1000);
  const frame = (sunDir) => {
    pass.setOutside({ at: 1000, sunDir, sunColor: [1, 1, 1], sunScale: 1, moonDir: [0, -1, 0], moonColor: [0, 0, 0], moonScale: 0, sky: [0.5, 0.5, 0.5] });
    return pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view: lookAt([0, 1.6, 0], [3, 1.6, 0], [0, 1, 0]), proj: perspective(1.1, 1.6, 0.1, 500), now: 1000, shadows: true, glass: () => 'glass' });
  };
  const sd = [0.8, 0.6, 0];
  assert.equal(frame(sd), 2);
  // PIN MOVED (LIGHT-REACH): the light's box (centre, three half-axes), not a ball - the beam carried away from the sun
  // into the room as far as its reach, with the glow's half-box on the room's side of the glass
  const box = () => ({ c: Array.from(pass.boxes.subarray(0, 3)), ext: [0, 1, 2].map((a) => [0, 3, 6].reduce((e, h) => e + Math.abs(pass.boxes[3 + h + a]), 0)) });
  const ctr = [pass.data[0], pass.data[1], pass.data[2]], into = box();
  const T = WL_SUN_REACH + 0.5 * Math.hypot(3, 3), edge = WL_SUN_ANGLE * T;   // the beam's run (the reach and the pane's half diagonal), the sun's soft edge over it
  assert.ok(near(into.ext[0], 0.5 * sd[0] * T, 1e-3) && near(into.c[0], ctr[0] - 0.5 * sd[0] * T, 1e-3), 'the beam\'s box runs into the room, away from the sun, its reach long');
  const yLo = -1.5 - edge - sd[1] * T, yHi = WL_SPILL_REACH;
  assert.ok(near(into.c[1], ctr[1] + 0.5 * (yLo + yHi), 1e-3) && near(into.ext[1], 0.5 * (yHi - yLo), 1e-3), 'and down as the sun\'s rays go, the glow\'s half-box above');
  assert.ok(near(into.ext[2], WL_SPILL_REACH, 1e-3), 'across the pane: the glow\'s');
  assert.equal(frame([-0.8, 0.6, 0]), 2);
  assert.equal(pass.data[3], WL_SPILL_REACH, 'facing away: only its glow, out to the spill\'s reach');
  const glow = box();
  assert.ok(near(glow.ext[0], WL_SPILL_REACH / 2, 1e-3) && near(glow.c[0], ctr[0] - WL_SPILL_REACH / 2, 1e-3) && near(glow.ext[1], WL_SPILL_REACH, 1e-3), 'a box to match: the glow\'s half-box on the room\'s side');
});

test('WL1 W21 (AUDIT): a frame builds at most WL_BUILD_TILES tiles\' world data, the nearest cells first, and lights what it built in that same frame (mutant: the budget ignored)', () => {
  const pass = passOn();
  pass.addMask('4001_0', CROSS);
  // a strip of 1200 window tiles a decimetre wide along x - five cells of 240, all within the gather
  const P = [], N = [], UV = [], IDX = [];
  for (let i = 0; i < 1200; i++) {
    const b = P.length / 3, x = i * 0.1 - 60;
    P.push(x, 0, -6, x + 0.1, 0, -6, x + 0.1, 2.5, -6, x, 2.5, -6); N.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1); UV.push(i, 0, i + 1, 0, i + 1, 1, i, 1);
    IDX.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const set = windowAperturesOf(new Float32Array(P), new Float32Array(N), new Float32Array(UV), new Uint32Array(IDX), 0, IDX.length);
  pass.note({ wl: [wlOf('4001_0', set)] }, I, null, 'inside', 1000);
  pass.setOutside({ at: 1000, sunDir: [0, 0.5, -0.87], sunColor: [1, 1, 1], sunScale: 1, moonDir: [0, -1, 0], moonColor: [0, 0, 0], moonScale: 0, sky: [0.5, 0.5, 0.5] });
  const frame = (now) => pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view: lookAt([0, 1.6, 0], [0, 1.6, -5], [0, 1, 0]), proj: perspective(1.1, 1.6, 0.1, 500), now, glass: () => 'glass' });
  assert.ok(frame(1000) > 0, 'lights the first frame');
  const first = pass.stats.built;
  assert.ok(first > 0 && first <= WL_BUILD_TILES + 240, `the budget, and the cell that crosses it (${first} built)`);
  let total = first, frames = 1;
  for (;;) { frame(1000 + 16 * frames); if (!pass.stats.built) break; total += pass.stats.built; frames++; assert.ok(frames < 10); }
  assert.equal(total, 1200, 'every tile, once');
  assert.ok(frames >= 3, `over ${frames} frames`);
});

test('WL1 W22 (AUDIT): the renderer\'s edges - the outside is read once in its interval though the view out stamps a moment after the caller\'s clock; the door shut reads nothing, measures no glass and keeps no mask; the sun map is asked only for glass the frame could light (its mask up, within the gather); a panel puts the frame\'s window light back; a draw always finds the block bound (mutants: the stamp ahead re-read, the door ignored, sunFor past the gather, the panel\'s loss, the block unbound)', () => {
  const log = [];
  const r = recordingRenderer(log);
  let setups = 0;
  const scene = { setup: (rr) => { setups++; rr.setLighting(new Float32Array([0.8, 0.8, 0.9]), 0.9, new Float32Array([1, 1, 1])); return new Float32Array([0.8, 0.45, 0.1]); } };
  r._wlTakeOutside([0.8, 0.45, 0.1], 5010);   // the view out's own read, stamped after the caller's clock
  r.captureOutsideLight(scene, 5000, 'rooms');
  assert.equal(setups, 0, 'a stamp a moment ahead is fresh');
  const loc = globalThis.location;
  globalThis.location = /** @type {any} */ ({ search: '?windowlight=off' });
  try {
    r.captureOutsideLight(scene, 9000, 'rooms');
    assert.equal(setups, 0, 'the door shut reads nothing');
    r.glassKeyTest = () => true;
    assert.equal(r._wlApertures({ ...FRONT, subMeshes: [{ textureArchive: 4001, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] }), null, 'measures no glass');
    r.glassKeyTest = null;
    r.uploadEmissionTexture(4005, 0, CROSS, { window: true });
    assert.equal(r._wl.masks.has('4005_0'), false, 'keeps no mask');
  } finally { globalThis.location = loc; }
  // sunFor: glass past the gather, or with no mask, asks no map
  const pass = passOn();
  const wall = quad([3, 0, -3], [0, 0, 6], [0, 3, 0], [-1, 0, 0], 2, 1);
  const set = windowAperturesOf(wall.positions, wall.normals, wall.uvs, wall.indices, 0, 6);
  pass.note({ wl: [wlOf('g', set)] }, I, null, 'inside', 1000);
  pass.setOutside({ at: 1000, sunDir: [0.8, 0.5, 0.1], sunColor: [1, 1, 1], sunScale: 1, moonDir: [0, -1, 0], moonColor: [0, 0, 0], moonScale: 0, sky: [0.5, 0.5, 0.5] });
  assert.equal(pass.sunFor([0, 1.6, 0], 1100, () => 'glass'), null, 'no mask: no map');
  pass.addMask('g', mask(16, 16, () => true));
  assert.deepEqual(pass.sunFor([0, 1.6, 0], 1100, () => 'glass'), [0.8, 0.5, 0.1]);
  assert.equal(pass.sunFor([500, 1.6, 0], 1100, () => 'glass'), null, 'past the gather: no map');
  assert.equal(pass.sunFor([0, 1.6, 0], 1100, () => null), null, 'not glass now: no map');
  // the panel bracket
  r._wlKind = 'street'; r._wlLive = true; r._wlSun = null;
  r.beginPanelFrame(I, I, new Float32Array([0, 1, 0]), { x: 0, y: 0, w: 10, h: 10 });
  assert.equal(r._wlLive, false, 'the panel\'s frame lights no window');
  r.endPanelFrame();
  assert.deepEqual([r._wlKind, r._wlLive], ['street', true], 'and the frame\'s is back');
  // the block: bound for a program whatever the frame
  r._wl.release();
  log.length = 0;
  r._wlLive = false;
  r._uploadWl({ on: { name: 'uWinOn' } });
  assert.ok(log.some((c) => c[0] === 'bindBufferBase' && c[2] === WL_UBO_BINDING), 'the block stands again');
  // the switch says whether the sun map holds a window's sun: a flat's vertex stage reads it for its window light then
  r._wlLive = true;
  for (const [sun, want] of [[[0.8, 0.5, 0.1], 2], [null, 1]]) {
    r._wlSun = sun; log.length = 0;
    r._uploadWl({ on: { name: 'uWinOn' } });
    assert.deepEqual(uploads(log, 'uWinOn'), [[want]], sun ? 'a window\'s sun in the map: 2' : 'lamps alone: 1');
  }
});
