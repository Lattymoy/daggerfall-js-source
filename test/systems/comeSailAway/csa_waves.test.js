// CSA-F (2026-09-27) - COME SAIL AWAY'S WAVES: systems/comeSailAway/comeSailAwayWaves.js's buildWaveMesh (UpdateWaveMesh past its
// gate), its frames and material, render/comeSailAwayRender.js's wave shader, and the runtime's UpdateWaveMesh, its
// triggers, Update's frame step and FixedUpdate's current - over a scripted heightmap and scripted rays. Every
// expectation is worked out here from ComeSailAway.cs's own statements.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildWaveMesh, waveFrameTimeOf, waveDitherOf, stepWaveFrame, isDayHour, WAVE_MATERIAL, BAYER_8X8, WAVE_FRAME_COUNT,
  WAVE_ARCHIVE, WAVE_RECORD, WAVE_LIFT, WAVE_SCALE,
} from '../../../src/systems/comeSailAway/comeSailAwayWaves.js';
import { WAVE_FS } from '../../../src/render/comeSailAwayRender.js';
import { composeTiledPicture } from '../../../src/formats/derivedTexture.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { NAMED_MATERIALS, openBundle } from '../../../tools/comeSailAwayExtract.mjs';
import { userStrings } from '../../../tools/lib/clrUserStrings.mjs';
import { decodeTexture2D, CLASS_ID } from '../../../src/formats/unity/unityBundle.js';

const f = Math.fround;
const VENDOR = new URL('../../../vendor/come-sail-away/', import.meta.url);
const vjson = (p) => JSON.parse(readFileSync(new URL(p, VENDOR), 'utf8'));
const near = (a, b, eps = 1e-5, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);

/** A heightmap from a set of land pixels (everything else the sea's 2), and rays that meet nothing. */
const sea = (land = [], { value = 20 } = {}) => {
  const set = new Set(land.map(([x, y]) => `${x},${y}`));
  return (x, y) => (set.has(`${x},${y}`) ? value : 2);
};
const build = (o = {}) => {
  const rays = [];
  const r = buildWaveMesh({
    heightMapValue: o.heightMapValue ?? sea(),
    raycast: (origin, dir, max) => { rays.push({ origin: [...origin], dir: [...dir], max }); return o.hit ? o.hit(origin) : null; },
    mapPixel: o.mapPixel ?? { X: 100, Y: 50 },
    worldCompensation: o.compensation ?? [0, 0, 0],
    waveDistance: o.distance ?? 0,
    waterLevel: 34,
  });
  return { ...r, rays };
};
const verts = (mesh) => Array.from({ length: mesh.vertices.length / 3 }, (_, i) => [mesh.vertices[i * 3], mesh.vertices[i * 3 + 2]]);
const uvs = (mesh) => Array.from({ length: mesh.uvs.length / 2 }, (_, i) => [mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]]);

// ── the builder ────────────────────────────────────────────────────────────────

test('CSA-F: buildWaveMesh - WOODS.WLD above 2 is land at once: no ray is cast, no pixel is water, and the object still stands over the player\'s pixel, a tenth over the sea and the vertical compensation', () => {
  const r = build({ heightMapValue: () => 3, distance: 2, compensation: [7, -12, 9] });
  assert.equal(r.rays.length, 0);
  assert.equal(r.mesh, null);
  assert.equal(r.neighbors, undefined, 'the loop never ran: the last neighbours stay (kept)');
  assert.deepEqual(r.position, [f(409.6), f(f(f(34) + WAVE_LIFT) + f(-12)), f(409.6)]);
  assert.equal(WAVE_SCALE, f(819.2));
});

test('CSA-F: the first loop - each water pixel\'s four rays drop from 500 over the compensation at its quarter points, a thousand long, in i-then-j order; one meeting more than a metre over the sea makes it land', () => {
  const r = build({ distance: 1, compensation: [0, 40, 0] });
  // 9 pixels, each 4 rays, then each water pixel's 9 neighbours x 4 rays
  const first = r.rays.slice(0, 36);
  const fa = (a, b) => f(f(a) + f(b));   // Vector3's float adds
  const w = f(819.2);
  assert.deepEqual(first.slice(0, 4).map((x) => x.origin), [[fa(204.8, -w), 540, fa(204.8, w)], [fa(614.4, -w), 540, fa(204.8, w)], [fa(204.8, -w), 540, fa(614.4, w)], [fa(614.4, -w), 540, fa(614.4, w)]], 'i = -1, j = -1: x left, z up (map Y runs south)');
  assert.deepEqual(first[4].origin, [fa(204.8, -w), 540, fa(204.8, 0)], 'then j = 0 - j is the inner loop');
  for (const x of first) { assert.deepEqual(x.dir, [0, -1, 0]); assert.equal(x.max, 1000); }
  // a hit at exactly compensation + 35 is water; a hair over it is land
  const at = (y) => build({ distance: 0, compensation: [0, 40, 0], hit: (o) => (o[1] === 540 && o[0] === f(614.4) && o[2] === f(204.8) ? { point: [0, y, 0] } : null) });
  assert.notEqual(at(75).neighbors, undefined, 'at 75 (= 40 + 35) still water');
  assert.equal(at(f(75.01)).neighbors, undefined, 'over it: land, so no water pixel at all');
});

test('CSA-F: KEPT BUG - the neighbour loop\'s rays rise from 500 over the world\'s origin, not over the compensation the first loop rose from, and are held to the same compensated metre', () => {
  const r = build({ distance: 0, compensation: [0, -300, 0] });
  assert.equal(r.rays[0].origin[1], 200, 'the first loop: -300 + 500');
  const neighbour = r.rays.slice(4);
  assert.equal(neighbour.length, 36, 'nine neighbours, four rays each - the heightmap says water everywhere');
  for (const x of neighbour) assert.equal(x.origin[1], 500);
  // the middle neighbour (k = l = 0) is the pixel itself: its rays at its own quarter points
  assert.deepEqual(neighbour.slice(16, 20).map((x) => [x.origin[0], x.origin[2]]), [[f(204.8), f(204.8)], [f(614.4), f(204.8)], [f(204.8), f(614.4)], [f(614.4), f(614.4)]]);
  // a neighbour ray's hit over -300 + 35 marks that neighbour land
  const r2 = build({ distance: 0, compensation: [0, -300, 0], hit: (o) => (o[1] === 500 && o[2] > 819.2 ? { point: [0, -200, 0] } : null) });
  assert.deepEqual(r2.neighbors.map((c) => c.map(Boolean)), [[true, false, false], [true, false, false], [true, false, false]], 'the north row (l = -1: +z) is land');
});

test('CSA-F: one water pixel, land to its north - the side\'s fan out to the land pixel\'s centre and, both diagonals and both sides water, the two small corner triangles; the mesh in pixel units round the player\'s pixel, its normals up', () => {
  const r = build({ heightMapValue: sea([[100, 49]]), distance: 0 });
  assert.deepEqual(r.neighbors.map((c) => c.map(Boolean)), [[false, false, false], [true, false, false], [false, false, false]], 'array[1][0]: k = 0, l = -1, the north');
  const m = r.mesh;
  assert.deepEqual(verts(m), [[0.25, 0.25], [-0.25, 0.25], [-0.5, 0.5], [0, 1], [0.5, 0.5], [-0.25, 0.25], [-0.75, 0.25], [-0.5, 0.5], [0.75, 0.25], [0.25, 0.25], [0.5, 0.5]]);
  assert.deepEqual(uvs(m), [[0.25, 1], [0.75, 1], [1, 0.75], [0.5, 0.25], [0, 0.75], [0.75, 1], [1.25, 1], [1, 0.75], [-0.25, 1], [0.25, 1], [0, 0.75]]);
  assert.deepEqual([...m.indices], [0, 1, 4, 1, 2, 4, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (let i = 0; i < m.normals.length; i += 3) assert.deepEqual([m.normals[i], m.normals[i + 1], m.normals[i + 2]], [0, 1, 0], 'RecalculateNormals: every triangle wound up');
  assert.ok([...m.vertices].every((v, i) => i % 3 !== 1 || v === 0), 'flat');
  // val8 is the pixel off the player's, its y the player's row less the item's: land south of the pixel south of the
  // player's lays the pieces the player's own would lay toward land south of it, one pixel down (-z)
  const own = verts(build({ heightMapValue: sea([[100, 51]]), distance: 0 }).mesh);
  const south = verts(build({ heightMapValue: sea([[100, 52]]), distance: 1 }).mesh);
  const down = own.map(([x, z]) => [x, f(z - 1)]);
  assert.ok(south.some((_, i) => down.every((v, j) => south[i + j]?.[0] === v[0] && south[i + j]?.[1] === v[1])), 'the pixel south of the player\'s: its pieces a pixel down');
});

test('CSA-F: a corner - north and north-west land with the west water lays the corner\'s two pieces; with the west land too, the one wide piece (and the west\'s own fan)', () => {
  const pieces = (land) => verts(build({ heightMapValue: sea(land), distance: 0 }).mesh);
  const a = pieces([[100, 49], [99, 49]]);
  assert.deepEqual(a.slice(5, 11), [[-0.5, 0.5], [-0.5, 1], [0, 1], [-0.25, 0.25], [-0.5, 0.25], [-0.5, 0.5]], 'array[0][0] and not array[0][1]');
  const b = pieces([[100, 49], [99, 49], [99, 50]]);
  assert.deepEqual(b.slice(5, 8), [[-0.5, 0.5], [-1, 1], [0, 1]], 'array[0][0] and array[0][1]: one piece into the corner');
  assert.deepEqual(b.slice(11, 16), [[-0.25, 0.25], [-0.25, -0.25], [-0.5, -0.5], [-1, 0], [-0.5, 0.5]], 'then the west side\'s own fan');
});

test('CSA-F: KEPT BUG - currentNeighbors is taken in every water pixel\'s loop (k == 0 && l == 0 is each pixel\'s own middle), so the current reads the LAST water pixel\'s - the farthest east, then south - not the player\'s', () => {
  // land at (100, 49) and (101, 51): the list is (99,49) (99,50) (99,51) (100,50) (100,51) (101,49) (101,50)
  const r = build({ heightMapValue: sea([[100, 49], [101, 51]]), distance: 1 });
  assert.deepEqual(r.neighbors, [[true, false, false], [false, false, true], [false, false, false]], 'the neighbours of (101, 50), the last');
  const own = build({ heightMapValue: sea([[100, 49], [101, 51]]), distance: 0 });
  assert.deepEqual(own.neighbors, [[false, false, false], [true, false, false], [false, false, true]], 'the player\'s own pixel would have read these');
});

// ── the frames, the material and the shader ─────────────────────────────────────

test('CSA-F: the material is the bundle\'s CurrentMaterial as the tool carried it - Daggerfall/Dither/Wave, the first frame tiled ten times, tinted (0.5, 0.75, 1), cut at a half, dithered from a half to one until LoadSettings sets it; its pattern BayerDither8x8', () => {
  const m = vjson('Models/materials.json').CurrentMaterial;
  assert.equal(m.shader, 'Daggerfall/Dither/Wave');
  assert.deepEqual(m.textures._MainTex, { texture: '112395_2-0', scale: [...WAVE_MATERIAL.tile], offset: [0, 0] });
  assert.equal(m.textures._DitherPattern.texture, 'BayerDither8x8');
  assert.deepEqual(m.colors._Color, [...WAVE_MATERIAL.color]);
  assert.equal(m.floats._Cutoff, WAVE_MATERIAL.cutoff);
  assert.equal(m.floats._DitherStart, WAVE_MATERIAL.ditherStart);
  assert.equal(m.floats._DitherEnd, WAVE_MATERIAL.ditherEnd);
  // every material the assembly loads by name (mod.GetAsset<Material>("....mat"): an ldstr on its #US heap) is one the
  // tool carries beside the prefabs'
  const heap = userStrings(new Uint8Array(readFileSync(new URL('Come Sail Away.dll', VENDOR))));
  assert.deepEqual(heap.filter((x) => x.endsWith('.mat')), NAMED_MATERIALS.map((n) => `${n}.mat`));
  assert.deepEqual([...NAMED_MATERIALS], ['CurrentMaterial']);
});

test('CSA-F: InitializeWaveTextures finds thirty-two frames - 112395_2-0 to -31, each one of two paints over TEXTURE.303 record 1 keyed ff00ffff (the frames are rebuilt, never shipped)', () => {
  const d = vjson('Textures/derived.json');
  const frames = Object.keys(d).filter((k) => k.startsWith(`${WAVE_ARCHIVE}_${WAVE_RECORD}-`));
  assert.equal(frames.length, WAVE_FRAME_COUNT);
  for (let i = 0; i < WAVE_FRAME_COUNT; i++) {
    const s = d[`${WAVE_ARCHIVE}_${WAVE_RECORD}-${i}`];
    assert.ok(s, `frame ${i}`);
    assert.deepEqual(s.from, [303, 1]);
    assert.equal(s.key, 'ff00ffff');
    assert.deepEqual(s.size, [640, 640]);
  }
  assert.equal(new Set(frames.map((k) => d[k].paint)).size, 2);
  assert.ok(!existsSync(new URL(`Textures/${WAVE_ARCHIVE}_${WAVE_RECORD}-0.png`, VENDOR)), 'no frame is carried as a picture');
});

test('CSA-F: LoadSettings\' numbers - the frame time reads Speed in whole hundreds (the integer division, kept): under 100 a quarter second, 100-199 an eighth, 200 none; the dither ends at half the Length and starts at the Fade\'s share of that', () => {
  assert.equal(waveFrameTimeOf(0), 0.25);
  assert.equal(waveFrameTimeOf(99), 0.25);
  assert.equal(waveFrameTimeOf(100), 0.125);
  assert.equal(waveFrameTimeOf(199), 0.125);
  assert.equal(waveFrameTimeOf(200), 0);
  const d = waveDitherOf(1.5, 0.8);
  assert.equal(d.end, f(0.75));
  assert.equal(d.start, f(f(0.8) * f(0.75)));
});

test('CSA-F: Update\'s frame step - the timer runs up to the frame time and the frame after it steps (the timer back to nought): forward by day round to the first, back by night round to the last; IsDay is six to eighteen', () => {
  let s = stepWaveFrame(5, 0, 0.125, 0.1, 32, true);
  assert.deepEqual(s, { index: 5, timer: f(0.1), changed: false });
  s = stepWaveFrame(5, f(0.1), 0.125, 0.1, 32, true);
  assert.deepEqual(s, { index: 5, timer: f(f(0.1) + f(0.1)), changed: false }, 'still under: it only climbs');
  s = stepWaveFrame(5, 0.2, 0.125, 0.1, 32, true);
  assert.deepEqual(s, { index: 6, timer: 0, changed: true });
  assert.equal(stepWaveFrame(31, 1, 0.125, 0.1, 32, true).index, 0);
  assert.equal(stepWaveFrame(5, 1, 0.125, 0.1, 32, false).index, 4);
  assert.equal(stepWaveFrame(0, 1, 0.125, 0.1, 32, false).index, 31);
  assert.equal(stepWaveFrame(3, 0.125, 0.125, 0.1, 32, true).index, 4, 'at exactly the frame time it steps');
  assert.deepEqual([5, 6, 17, 18].map(isDayHour), [false, true, true, false]);
});

test('CSA-F: the wave shader\'s own arithmetic - the fold of the raw v, the smoothstep\'s complement over the dither\'s span against the 8x8 Bayer table at the screen pixel, the cut at alpha times the tint\'s, the key colour for the snow', () => {
  assert.match(WAVE_FS, /float d = abs\(vUv\.y \* 0\.100000001 - 0\.5\) \* 2\.0 - uDitherStart;/);
  assert.match(WAVE_FS, /float x = clamp\(d \* \(1\.0 \/ \(uDitherEnd - uDitherStart\)\), 0\.0, 1\.0\);/);
  assert.match(WAVE_FS, /float a = 1\.0 - \(3\.0 - 2\.0 \* x\) \* \(x \* x\);/);
  assert.match(WAVE_FS, /if \(a - BAYER\[px\.y \* 8 \+ px\.x\] \/ 255\.0 < 0\.0\) discard;/);
  assert.match(WAVE_FS, /if \(tex\.a \* uColor\.a - uCutoff < 0\.0\) discard;/);
  assert.match(WAVE_FS, /if \(p == vec4\(1\.0, 0\.0, 1\.0, 1\.0\)\)/);
  const table = /const float BAYER\[64\] = float\[64\]\(([^)]*)\);/.exec(WAVE_FS)[1].split(',').map((v) => Number(v));
  assert.deepEqual(table, [...BAYER_8X8]);
});

test('CSA-F: the Bayer table is the 8x8 ordered-dither matrix (its ranks the recursive Bayer order), at the texture\'s own rounding', () => {
  const bayer = (x, y) => { let v = 0; for (let bit = 0; bit < 3; bit++) { const xb = (x >> bit) & 1, yb = (y >> bit) & 1; v |= ((xb ^ yb) << (5 - 2 * bit)) | (yb << (4 - 2 * bit)); } return v; };
  const ranks = [...BAYER_8X8].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v).map((e, rank) => [e.i, rank]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  // the texture's row y, column x holds the matrix's (y, x) entry transposed: rank(x, y) = M(y, x)
  const ok = [0, 1].some((transpose) => ranks.every((r, i) => r === (transpose ? bayer(Math.floor(i / 8), i % 8) : bayer(i % 8, Math.floor(i / 8)))));
  assert.ok(ok, `ranks ${ranks}`);
  assert.equal(new Set(BAYER_8X8).size, 64);
  // the values themselves, as the bundle's BayerDither8x8 stores its red (no formula gives the bundle's rounding)
  assert.deepEqual([...BAYER_8X8], [
    3, 192, 50, 239, 16, 204, 63, 251, 129, 66, 177, 114, 141, 78, 188, 126, 34, 224, 20, 208, 47, 235, 30, 220, 161, 98, 145, 82, 173, 110, 157, 94,
    12, 200, 59, 247, 8, 196, 55, 243, 137, 75, 184, 122, 133, 71, 180, 118, 43, 231, 27, 216, 39, 228, 24, 212, 169, 106, 153, 90, 165, 102, 149, 86,
  ]);
  if (process.env.CSA_BUNDLE && existsSync(process.env.CSA_BUNDLE)) {
    const { sf, resource } = openBundle(new Uint8Array(readFileSync(process.env.CSA_BUNDLE)));
    const o = sf.objects.find((x) => x.classId === CLASS_ID.Texture2D && x.read().m_Name === 'BayerDither8x8');
    const pic = decodeTexture2D(o.read(), resource);
    assert.deepEqual(Array.from({ length: 64 }, (_, i) => pic.data[i * 4]), [...BAYER_8X8], 'the bundle\'s own, texel for texel');
  }
});

test('CSA-F: the frame composed where it is sampled is composeTiledPicture\'s frame, texel for texel - the shader\'s waveTexel restated here and walked over every texel of a synthetic paint and snow', () => {
  const W = 16, H = 16, SW = 5, SH = 3;
  const paint = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    const key = (i * 7) % 3 === 0;
    paint.data.set(key ? [255, 0, 255, 255] : [i % 256, (i * 3) % 256, 40, i % 5 === 0 ? 0 : 255], i * 4);
  }
  const snow = { width: SW, height: SH, data: new Uint8Array(SW * SH * 4) };
  for (let i = 0; i < SW * SH; i++) snow.data.set([200 - i, 100 + i, 50 + i, i % 2 ? 0 : 255], i * 4);
  const spec = { size: [W, H], scroll: 5, tile: [2, 7], key: 'ff00ffff' };
  const frame = composeTiledPicture(spec, snow, paint);
  const wrap = (a, n) => ((a % n) + n) % n;
  // the GLSL's waveTexel, in JS: Unity's point sample with Repeat at uv - texel floor(frac(uv) * size), row 0 the bottom
  const texel = (u, v) => {
    const fr = (t) => t - Math.floor(t);
    const tx = Math.min(W - 1, Math.floor(fr(u) * W)), ty = Math.min(H - 1, Math.floor(fr(v) * H));
    const x = tx, y = H - 1 - ty;
    const pi = (wrap(y + spec.scroll, H) * W + x) * 4;
    const p = paint.data.subarray(pi, pi + 4);
    if (p[0] === 255 && p[1] === 0 && p[2] === 255 && p[3] === 255) {
      const si = (wrap(y + spec.tile[1], SH) * SW + wrap(x + spec.tile[0], SW)) * 4;
      return [snow.data[si], snow.data[si + 1], snow.data[si + 2], 255];
    }
    return [...p];
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W + 3, v = (H - 1 - y + 0.5) / H - 2;   // the frame's (x, y) at a texel centre, tiles away
    const want = [...frame.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];
    assert.deepEqual(texel(u, v), want, `(${x}, ${y})`);
  }
});

// ── the runtime ────────────────────────────────────────────────────────────────

/** A scripted runtime: the waves on, a sea with land north of the player's pixel, the hour and the wind set. */
function scene(opts = {}) {
  const world = { inside: false, onShip: false, hour: opts.hour ?? 12, time: 0, blockWater: opts.blockWater ?? NO_WATER_LEVEL, dt: 0.1, pixel: { X: 100, Y: 50 } };
  const player = { position: opts.position ?? [409.6, 34, 409.6], rotation: [0, 0, 0, 1] };
  const settings = { 'Waves.Enable': true, 'Waves.Distance': 0, ...opts.settings };
  const heights = opts.heightMapValue ?? sea([[100, 49]]);
  const out = { current: [], rays: 0 };
  const deps = {
    pool: { models: null, ready: () => true, spawnNow: () => null, remove: () => {} },
    player: () => player,
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ ...world.pixel }),
    isPlayerInside: () => world.inside,
    blockWaterLevel: () => world.blockWater,
    iliacPuddleNoMore: () => false,
    raycast: () => { out.rays++; return null; },
    playerTerrain: () => null, terrainAt: () => null, terrains: () => [],
    worldCompensation: () => [0, 0, 0],
    heightMapValue: heights,
    hudText: () => {}, midScreenText: () => {}, log: () => {},
    random: { range: (min) => min, rangeFloat: (min) => min },
    time: () => world.time,
    hour: () => world.hour,
    weatherType: () => 0,
    dt: () => world.dt,
    setting: (k) => settings[k],
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false, isOnShip: () => world.onShip },
    enemies: () => [],
  };
  const rt = createComeSailAwayRuntime(deps);
  rt.on('OnUpdateCurrent', (v) => out.current.push(v));
  rt.state.windVectorCurrent = opts.wind ?? [0.6, 0, 0.8];
  const frame = ({ paused = false } = {}) => { rt.endOfFrame(); rt.fixedUpdate({ paused }); rt.update({ paused }); rt.lateUpdate({ paused }); world.time = f(world.time + world.dt); };
  return { rt, world, player, settings, out, frame };
}

test('CSA-F: UpdateWaveMesh - the mesh cleared first; the waves off, the player inside or on their ship, nothing more; else laid over the player\'s pixel', () => {
  const s = scene();
  s.rt.UpdateWaveMesh();
  assert.equal(s.rt.waves().mesh.vertices.length / 3, 11);
  for (const [k, v] of [['inside', true], ['onShip', true]]) {
    s.world[k] = v;
    s.rt.UpdateWaveMesh();
    assert.equal(s.rt.waves().mesh, null, `${k}: cleared, not rebuilt`);
    s.world[k] = false;
    s.rt.UpdateWaveMesh();
    assert.ok(s.rt.waves().mesh);
  }
  s.settings['Waves.Enable'] = false;
  s.rt.UpdateWaveMesh();
  assert.equal(s.rt.waves().mesh, null);
  assert.deepEqual(s.rt.waves().position, [f(409.6), f(34.1), f(409.6)]);
  assert.equal(s.rt.waves().scale, f(819.2));
  // KEPT: a rebuild that finds no water pixel returns before the loop - the mesh cleared, the last neighbours kept
  let land = false;
  const k = scene({ heightMapValue: (x, y) => (land ? 255 : sea([[100, 49]])(x, y)) });
  k.rt.UpdateWaveMesh();
  const last = k.rt.state.currentNeighbors;
  assert.ok(last);
  land = true;
  k.rt.UpdateWaveMesh();
  assert.equal(k.rt.waves().mesh, null, 'nothing laid');
  assert.equal(k.rt.state.currentNeighbors, last, 'the neighbours the last mesh took');
});

test('CSA-F: the four events that lay the waves - OnLoad, OnTransition and OnPositionUpdate at once, OnTeleportToCoordinates a tenth of a second of Time.time later (WaitForSeconds, resumed after Update)', () => {
  for (const ev of ['OnLoad', 'OnTransition', 'OnPositionUpdate']) {
    const s = scene();
    assert.equal(s.rt.waves().mesh, null);
    s.rt[ev](ev === 'OnPositionUpdate' ? [0, 0, 0] : undefined);
    assert.ok(s.rt.waves().mesh, ev);
  }
  const s = scene();
  s.world.dt = 0.04;
  s.rt.OnTeleportToCoordinates();
  s.frame(); s.frame();   // Time.time 0, then 0.04
  assert.equal(s.rt.waves().mesh, null, 'not yet');
  s.frame();   // 0.08
  assert.equal(s.rt.waves().mesh, null);
  s.world.time = f(0.1);
  s.rt.update();
  assert.ok(s.rt.waves().mesh, 'at 0.1: laid');
});

test('CSA-F: Update steps the waves\' frame on its timer - by day forward, by night back; not while paused, not with the waves off', () => {
  const s = scene({ settings: { 'Waves.Speed': 100 } });
  s.world.dt = 0.05;
  const seen = [];
  for (let i = 0; i < 8; i++) { s.rt.update(); seen.push(s.rt.waves().frame); }
  assert.deepEqual(seen, [0, 0, 0, 1, 1, 1, 1, 2], 'the timer climbs past an eighth (0.05, 0.1, 0.15) and the next frame steps');
  s.rt.update({ paused: true });
  assert.equal(s.rt.waves().frame, 2);
  s.world.hour = 20;
  for (let i = 0; i < 4; i++) s.rt.update();
  assert.equal(s.rt.waves().frame, 1, 'night: back');
  s.settings['Waves.Enable'] = false;
  for (let i = 0; i < 8; i++) s.rt.update();
  assert.equal(s.rt.waves().frame, 1);
});

test('CSA-F: FixedUpdate\'s current - with the waves off none is written; with no wave mesh yet the wind at half strength (nought over a dungeon block\'s water); OnUpdateCurrent only when it changes', () => {
  const off = scene({ settings: { 'Waves.Enable': false } });
  off.rt.fixedUpdate();
  assert.deepEqual(off.rt.state.currentVector, [0, 0, 0]);
  const s = scene();
  s.rt.fixedUpdate();
  assert.deepEqual(s.rt.state.currentVector, [f(0.3), 0, f(0.4)]);
  s.rt.fixedUpdate();
  assert.equal(s.out.current.length, 1, 'unchanged: no second event');
  const d = scene({ blockWater: 60 });
  d.rt.fixedUpdate();
  assert.deepEqual(d.rt.state.currentVector, [0, 0, 0]);
  assert.equal(d.out.current.length, 0, 'nought from nought: no event');
});

test('CSA-F: FixedUpdate\'s current near a coast - toward the land whichever quarter of the pixel the player stands in faces, the wind\'s own component elsewhere, normalized to half the wind\'s strength; reversed where the pixel\'s own middle is land, and again by night', () => {
  const NORTH = [[false, false, false], [true, false, false], [false, false, false]];
  const current = (position, neighbors, hour = 12) => {
    const s = scene({ position, hour, wind: [0.6, 0, 0.8] });
    s.rt.state.currentNeighbors = neighbors;
    s.rt.fixedUpdate();
    return s.rt.state.currentVector;
  };
  const want = (v, sign = 1) => { const l = Math.hypot(...v); return v.map((c) => (sign * c) / l * 0.5); };   // |wind| is one
  const check = (got, exp, msg) => got.forEach((g, i) => near(g, exp[i], 1e-6, `${msg}[${i}]`));
  check(current([400, 34, 700], NORTH), want([0.6, 0, 1]), 'the north quarter, land north: z pulled to one');
  check(current([400, 34, 400], NORTH), want([0.6, 0, 0.8]), 'the middle: the wind\'s own, halved');
  check(current([400, 34, 100], NORTH), want([0.6, 0, 0.8]), 'the south quarter: land is not south');
  check(current([400, 34, 700], NORTH, 22), want([0.6, 0, 1], -1), 'by night: reversed');
  check(current([100, 34, 400], [[false, true, false], [false, false, false], [false, false, false]]), want([-1, 0, 0.8]), 'the west quarter, land west: x pulled to minus one');
  check(current([700, 34, 400], [[false, false, false], [false, false, false], [false, true, false]]), want([1, 0, 0.8]), 'the east quarter, land east');
  check(current([400, 34, 100], [[false, false, false], [false, false, true], [false, false, false]]), want([0.6, 0, -1]), 'the south quarter, land south');
  check(current([400, 34, 700], [[false, false, false], [true, true, false], [false, false, false]]), want([0.6, 0, 1], -1), 'its own middle land: reversed');
  check(current([400, 34, 700], [[false, false, false], [true, true, false], [false, false, false]], 22), want([0.6, 0, 1]), 'and by night again: back');
  check(current([f(614.4), 34, f(614.4)], [[false, true, false], [true, false, true], [false, true, false]]), want([0.6, 0, 0.8]), 'on the far quarter lines exactly (614.4f): neither side (strict compares)');
  check(current([f(204.8), 34, f(204.8)], [[false, true, false], [true, false, true], [false, true, false]]), want([0.6, 0, 0.8]), 'on the near ones (204.8f): neither');
});
