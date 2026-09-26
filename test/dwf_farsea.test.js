// DW-F (2026-09-26) - ILIAC PUDDLE NO MORE 1.2.2's SEA AT A DISTANCE (jet082), PINNED. Mac: "at a distance,
// the ocean seems to look like large square panels". Two causes, both the port's own: (1) EV4's strided far
// ground kept its whole perimeter skirt through the clip, so every far coastal pixel hung 40 m of pale curtain
// in the carved sea along its edges, a hand under the surface; (2) the sea's top took no world fog, so the
// carved sea stood out of the fogged world and far ring as dark squares to the horizon. The laws: a skirt
// segment goes with the edge tiles it hangs under, and the top, its far-plane arm and the column's share of it
// take the world's fog as the floor does - the split sum still the blend's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import { clippedTerrainIndices, CLIP_SENTINEL, patchTilemapForClip } from '../src/world/deepWaterCap.js';
import { buildTerrainGrid, buildTerrainIndices, TERRAIN_SKIRT_DEPTH, convertTilemap } from '../src/world/terrainSurface.js';
import { buildWaterIndices } from '../src/render/waterSurface.js';
import { WATER_DRAW_MASK_TABLE } from '../src/world/waterCorners.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { FOG_GLSL } from '../src/render/fogGlsl.js';
import { TOP_FS, TOP_FAR_FS, FLOOR_FS, DECOR_FS, COLUMN_GLSL, DeepWatersRenderer } from '../src/render/deepWatersRender.js';
import { SURFACE_TEXTURE_TILING } from '../src/world/deepWaterLook.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CELL = 6.4, EDGE = 128 * CELL;   // a tile, a pixel
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const close = (a, b, eps, msg) => { for (let i = 0; i < b.length; i++) assert.ok(Math.abs(a[i] - b[i]) < eps, `${msg}: [${a}] vs [${b}]`); };

/** A pixel's patched TileMap with `clip(tx, tz)` tiles clipped, the rest ground. */
function tilemap(clip) {
  const bytes = new Uint8Array(128 * 128).fill(4);
  for (let tz = 0; tz < 128; tz++) for (let tx = 0; tx < 128; tx++) if (clip(tx, tz)) bytes[tz * 128 + tx] = CLIP_SENTINEL;
  return bytes;
}

/** The index set's triangles in the grid's own frame: [x0, y0, z0, x1, ...] per triangle, and which are skirt. */
function triangles(idx, stride) {
  const { positions } = buildTerrainGrid(new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), stride);
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]].map((i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]);
    const skirt = v.some((p) => p[1] < positions[1] - TERRAIN_SKIRT_DEPTH / 2);
    out.push({ v, skirt });
  }
  return out;
}

/** The edge tiles a skirt triangle hangs under: its span along its edge, the edge's own row or column. */
function tilesUnder(tri) {
  const xs = tri.v.map((p) => p[0]), zs = tri.v.map((p) => p[2]);
  const along = (a) => { const lo = Math.min(...a), hi = Math.max(...a); const out = []; for (let t = Math.round(lo / CELL); t < Math.round(hi / CELL); t++) out.push(t); return out; };
  const on = (a, c) => a.every((x) => Math.abs(x - c) < 1e-3);
  if (on(zs, 0)) return along(xs).map((tx) => [tx, 0]);
  if (on(zs, EDGE)) return along(xs).map((tx) => [tx, 127]);
  if (on(xs, 0)) return along(zs).map((tz) => [0, tz]);
  if (on(xs, EDGE)) return along(zs).map((tz) => [127, tz]);
  throw new Error('a skirt triangle off every edge');
}

test('DW-F: a far pixel\'s skirt goes with the edge tiles it hangs under - no curtain in the carved sea, the ground\'s own kept (mutants: the skirt whole again; rows for columns; the south segment read off the row inside; the null answered before the skirt)', () => {
  const s = 4, g = 128 / s + 1, q = g - 1;
  // the sea along the south and east edges and a bay off the west one; a lone ground tile in the south-east corner quad's
  // interior (its quad stands, its edge tiles are sea); one ground tile on the north edge in a sea strip
  const clip = (tx, tz) => tz < 12 || tx > 115 || (tx < 20 && tz > 40 && tz < 70) || (tz > 124 && tx > 60 && tx < 80 && tx !== 70);
  const bytes = tilemap(clip);
  bytes[1 * 128 + 125] = 4;
  const idx = clippedTerrainIndices(bytes, s);
  const tris = triangles(idx, s);
  const skirts = tris.filter((t) => t.skirt);
  const clipped = (tx, tz) => bytes[tz * 128 + tx] === CLIP_SENTINEL;
  for (const t of skirts) assert.ok(tilesUnder(t).some(([tx, tz]) => !clipped(tx, tz)), `a skirt under all-sea edge tiles: ${JSON.stringify(t.v)}`);
  // every segment with ground over it is kept, both windings: a segment is two triangles each way
  let want = 0;
  for (let i = 0; i < q; i++) {
    const span = Array.from({ length: s }, (_, k) => i * s + k);
    want += span.some((tx) => !clipped(tx, 0)) + span.some((tx) => !clipped(tx, 127)) + span.some((tz) => !clipped(0, tz)) + span.some((tz) => !clipped(127, tz));
  }
  assert.equal(skirts.length, want * 4, 'each kept segment\'s four triangles');
  assert.ok(want > 0 && want < q * 4, 'some segments go, some stay');
  // the corner quad (x 31, z 0) stands for its one ground tile (125, 1), and its south segment - all sea on row 0 - goes
  const cornerQuad = tris.filter((t) => !t.skirt && t.v.every((p) => p[0] >= 124 * CELL - 1e-3 && p[2] <= 4 * CELL + 1e-3));
  assert.equal(cornerQuad.length, 2, 'the part-clipped quad stands');
  assert.ok(!skirts.some((t) => tilesUnder(t).some(([tx, tz]) => tz === 0 && tx >= 124)), '...its south skirt, all sea, does not');
  // the north edge's strip: the segment over the one ground tile (70, 127) stays, its sea neighbours go
  const north = (tx) => skirts.some((t) => tilesUnder(t).some(([x, z]) => z === 127 && x === tx));
  assert.ok(north(70) && !north(64) && !north(76), 'the north strip: the ground\'s segment only');
  // the ground's grid quads are exactly the full set's, in its order, less the all-sea ones
  const full = buildTerrainIndices(s), grid = idx.slice(0, idx.length - skirts.length * 3);
  let at = 0;
  for (let z = 0; z < q; z++) for (let x = 0; x < q; x++) {
    let sea = true;
    for (let tz = z * s; tz < z * s + s; tz++) for (let tx = x * s; tx < x * s + s; tx++) sea &&= clipped(tx, tz);
    if (sea) continue;
    assert.deepEqual([...grid.slice(at, at + 6)], [...full.slice((z * q + x) * 6, (z * q + x) * 6 + 6)], `quad ${x},${z}`);
    at += 6;
  }
  assert.equal(at, grid.length, 'nothing else in the grid part');
});

test('DW-F: the clip\'s answers at the ends - nothing clipped is the full set (null), a sea edge alone is a clip at a far stride, and stride 1 has no skirt to keep', () => {
  assert.equal(clippedTerrainIndices(tilemap(() => false), 4), null, 'no clip: the ground\'s own index set');
  // no quad all sea, but the whole south row is: the far pixel's south skirt goes, nothing else
  const edgeOnly = clippedTerrainIndices(tilemap((tx, tz) => tz === 0), 4);
  assert.ok(edgeOnly, 'a sea edge row clips the skirt although every quad stands');
  assert.equal(edgeOnly.length, buildTerrainIndices(4).length - 32 * 12, 'one edge\'s 32 segments, both windings, gone');
  assert.equal(clippedTerrainIndices(tilemap((tx, tz) => tz === 0), 1).length, (128 * 128 - 128) * 6, 'stride 1: the row\'s quads, and no skirt anywhere');
  // an all-sea pixel keeps nothing at a far stride - not a curtain round its rim
  assert.equal(clippedTerrainIndices(tilemap(() => true), 8).length, 0);
});

/** The fog block's bindings: `mode` 0 off, 1 linear, 2 exp, 3 exp2. */
const FOGS = [
  { uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1] },
  { uFogMode: 1, uFogDensity: 0, uFogRange: [300, 5200] },
  { uFogMode: 2, uFogDensity: 0.00045, uFogRange: [0, 1] },
  { uFogMode: 3, uFogDensity: 0.0004, uFogRange: [0, 1] },
];
const factor = (fog, d) => (fog.uFogMode === 0 ? 1 : fog.uFogMode === 1 ? Math.min(Math.max((fog.uFogRange[1] - d) / (fog.uFogRange[1] - fog.uFogRange[0]), 0), 1)
  : fog.uFogMode === 3 ? Math.exp(-((fog.uFogDensity * d) ** 2)) : Math.exp(-fog.uFogDensity * d));
const FOG_COLOR = [0.62, 0.7, 0.78];
const TOP = [0.12, 0.3, 0.34, 0.42];
/** The surface texture: a function of its uv, so the top and the column must sample the same texel. */
const texel = (uv) => [0.5 + 0.3 * Math.sin(uv[0] * 1.7), 0.55 + 0.2 * Math.cos(uv[1] * 2.3), 0.6, 1];
const texture = (_s, uv) => texel(uv);

test('DW-F: the top and its far-plane arm take the world\'s fog at their own fragment - the same factor the floor, the ground and the far ring take there (mutants: the top\'s fog dropped; the far arm\'s)', () => {
  const cam = [100, 420, 50];
  for (const fog of FOGS) for (const frag of [[140, 34, 90], [900, 34, 1700], [-2600, 34, 3900], [5100, 34, -300]]) {
    const vUv = [0.3, 0.8];
    const d = Math.hypot(frag[0] - cam[0], frag[1] - cam[1], frag[2] - cam[2]);
    const tex = texel(vUv).slice(0, 3).map((c, i) => c * TOP[i]);
    const col = mix(tex, TOP.slice(0, 3).map((c) => c * 0.32), 0.22);
    const want = mix(FOG_COLOR, col, factor(fog, d));
    const binds = { vUv, vWorldPos: frag, uColor: TOP, uUnderwater: 0, uCamPos: cam, uFogColor: FOG_COLOR, uDwFog: Array(5).fill([0, 0, 0, 0]), texture, ...fog };
    const top = glslFunctions(TOP_FS, binds);
    top.main();
    close(top.globals.outColor, [...want, TOP[3]], 1e-9, `top, fog ${fog.uFogMode} at ${d.toFixed(0)} m`);
    const far = glslFunctions(TOP_FAR_FS, binds);
    far.main();
    close(far.globals.outColor, [...want, 1], 1e-9, `far arm, fog ${fog.uFogMode} at ${d.toFixed(0)} m`);
  }
  // the floor's own fog is the same law at its own fragment, before the column's share
  assert.match(FLOOR_FS, /col = mix\(uFogColor, col, fogFactorAt\(vWorldPos\)\);\n\s+col = dwColumn\(col, vWorldPos\);/);
});

test('DW-F: the column\'s share is the FOGGED top at the ray\'s entry - the floor, or a weed, under the fogged top at alpha a is the mod\'s blend at a + (1 - a) min(behind / vision, 1), on every fog mode (mutants: the share\'s fog dropped; fogged at the fragment, not the entry)', () => {
  const origin = [819.2 * 3, 0, 819.2 * -2], seaY = 34, vision = 18, scroll = [0.21, 0.07];
  const header = 'uniform vec3 uCamPos;\nuniform vec3 uFogColor;\nuniform int uFogMode;\nuniform float uFogDensity;\nuniform vec2 uFogRange;\n';
  for (const fog of FOGS) for (const [cam, frag, fwdRaw] of [
    [[origin[0] + 100, 420, origin[2] + 50], [origin[0] + 700, 12, origin[2] + 600], [0.6, -0.4, 0.6]],
    [[origin[0] + 10, 60, origin[2] + 10], [origin[0] + 1500, 20, origin[2] + 900], [0.85, -0.05, 0.5]],
    [[origin[0] + 400, 36, origin[2] + 400], [origin[0] + 402, 30, origin[2] + 401], [0.2, -0.95, 0.1]],
  ]) {
    const n = Math.hypot(...fwdRaw), fwd = fwdRaw.map((c) => c / n);
    const toFrag = frag.map((x, i) => x - cam[i]);
    const entry = cam.map((x, i) => x + toFrag[i] * ((seaY - cam[1]) / toFrag[1]));
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const behind = dot(frag.map((x, i) => x - entry[i]), fwd);
    const t = Math.min(behind / vision, 1);
    // what the top draws at the entry (its own program, its own uv there)
    const vUv = [(entry[0] - origin[0]) / 819.2 * SURFACE_TEXTURE_TILING + scroll[0], (entry[2] - origin[2]) / 819.2 * SURFACE_TEXTURE_TILING + scroll[1]];
    const top = glslFunctions(TOP_FS, { vUv, vWorldPos: entry, uColor: TOP, uUnderwater: 0, uCamPos: cam, uFogColor: FOG_COLOR, uDwFog: Array(5).fill([0, 0, 0, 0]), texture, ...fog });
    top.main();
    const topOut = top.globals.outColor;
    // the floor fragment's colour, already under the world's fog at its own distance
    const floor = mix(FOG_COLOR, [0.55, 0.45, 0.3], factor(fog, Math.hypot(...toFrag)));
    const col = glslFunctions(header + FOG_GLSL + COLUMN_GLSL, {
      uCamPos: cam, uFogColor: FOG_COLOR, uDwCamFwd: fwd, uColumnOn: 1, uSeaY: seaY, uTopColor: TOP, uTopVision: vision, uSurfaceScroll: scroll, uPixelOrigin: origin, texture, ...fog,
    }).dwColumn(floor, frag);
    const port = mix(col, topOut.slice(0, 3), topOut[3]);
    const mod = mix(floor, topOut.slice(0, 3), TOP[3] + (1 - TOP[3]) * t);
    close(port, mod, 1e-9, `fog ${fog.uFogMode}, behind ${behind.toFixed(1)} m`);
  }
  assert.ok(FLOOR_FS.includes(COLUMN_GLSL) && DECOR_FS.includes(COLUMN_GLSL), 'one column, both programs');
});

test('DW-F: the decorations take no world fog of their own (the mod\'s forward pass has none) - only the column\'s share of the fogged top (mutant: the world fog on the weed)', () => {
  const binds = (columnOn) => ({
    vUv: [0.4, 0.6], vStart: 0, vWorldPos: [30, 20, 40], uColor: [1.12, 1.12, 1.12, 1], uCutoff: 0.5, uSceneTint: [1, 1, 1, 0], uTick: 0, uFrames: 1,
    uCamPos: [0, 420, 0], uFogColor: FOG_COLOR, uFogMode: 3, uFogDensity: 0.004, uFogRange: [0, 1], uDwFog: Array(5).fill([0, 0, 0, 0]),
    uDwCamFwd: [0, -1, 0], uColumnOn: columnOn, uSeaY: 34, uTopColor: TOP, uTopVision: 18, uSurfaceScroll: [0, 0], uPixelOrigin: [0, 0, 0],
    texture: () => [0.4, 0.5, 0.2, 1],
  });
  const weed = [0.4 * 1.12, 0.5 * 1.12, 0.2 * 1.12];
  const off = glslFunctions(DECOR_FS, binds(0));
  off.main();
  close(off.globals.outColor, [...weed, 1], 1e-9, 'a thick fog, and the weed its own colour');
  // seen through the top: the weed unfogged, carried to the top's colour at the entry - fogged there
  const on = glslFunctions(DECOR_FS, binds(1));
  on.main();
  const cam = [0, 420, 0], frag = [30, 20, 40], s = (34 - 420) / (20 - 420);
  const entry = cam.map((c, i) => c + (frag[i] - c) * s);
  const st = mix([0.4, 0.5, 0.2].map((c, i) => c * TOP[i]), TOP.slice(0, 3).map((c) => c * 0.32), 0.22);
  const fogged = mix(FOG_COLOR, st, Math.exp(-((0.004 * Math.hypot(...entry.map((c, i) => c - cam[i]))) ** 2)));
  close(on.globals.outColor, [...mix(weed, fogged, (34 - 20) / 18), 1], 1e-9, 'the share of the fogged top, and no fog on the weed');
});

/** A GL that answers everything, and records each uniform upload with the program in use. */
function recordingGl() {
  const log = [];
  let cur = null;
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : (...a) => {
    if (k === 'useProgram') cur = a[0];
    if (typeof k === 'string' && k.startsWith('uniform')) log.push({ prog: cur, name: a[0], args: a.slice(1) });
    return ['createVertexArray', 'createProgram', 'createShader', 'createBuffer', 'createTexture'].includes(k) ? {} : k === 'getUniformLocation' ? a[1] : k === 'getProgramParameter' || k === 'getShaderParameter' ? true : null;
  })) });
  return { gl, log };
}

test('DW-F: the pass hands the world\'s fog to every program that reads it - the floor, the top, its far arm and the decorations\' column (mutants: the fog left to the floor alone; the decorations\' fog forced off)', () => {
  const { gl, log } = recordingGl();
  const renderer = { gl, _proj: new Float32Array(16), _view: new Float32Array(16), _camPos: new Float32Array(3), _dwFog: new Float32Array(20),
    _fogColor: new Float32Array(FOG_COLOR), _fogMode: 3, _fogDensity: 0.0004, _fogRange: new Float32Array([0, 1]), markForeignPass() {} };
  const r = new DeepWatersRenderer(renderer);
  const frame = { surfaceTexture: {}, underwater: false, liftY: 0, surfaceScroll: [0, 0], topColor: TOP, topDepthWrite: false,
    sceneTint: [1, 1, 1, 0], seconds: 0, columnOn: true, seaY: 34, topVision: 18 };
  r.drawSurfaces([{ h: { surface: { vao: {}, count: 6 } }, model: new Float32Array(16) }], frame);
  r.drawDecorations([{ h: { groups: [{ vao: {}, count: 6, texture: { tex: {}, frames: 1 }, fps: 0, born: 0, facing: 0 }] }, model: new Float32Array(16), origin: [0, 0, 0] }], frame);
  r.drawFloors([{ h: { floor: { vao: {}, count: 6 } }, model: new Float32Array(16), origin: [0, 0, 0],
    material: { texture: null, strength: 0, palette: { sand: [1, 1, 1], mid: [1, 1, 1], deep: [1, 1, 1], swamp: [1, 1, 1] }, ambientBoost: 1 } }], frame);
  const P = r._programs;
  for (const [name, prog] of [['top', P.top.p], ['far arm', P.topFar.p], ['decorations', P.decor.p], ['floor', P.floor.p]]) {
    const last = (u) => log.filter((e) => e.prog === prog && e.name === u).at(-1)?.args;
    assert.deepEqual(last('uFogMode'), [3], `${name}: the world's fog mode`);
    assert.deepEqual(last('uFogDensity'), [0.0004], `${name}: its density`);
    assert.deepEqual([...last('uFogColor')[0]], [...renderer._fogColor], `${name}: its colour`);
    assert.deepEqual([...last('uFogRange')[0]], [0, 1], `${name}: its range`);
  }
  assert.ok(!log.some((e) => e.prog === P.under.p), 'the underside is not drawn from over the sea');
});

test('DW-F: WATER1 reads the cap\'s TileMap - the carved sea and the repainted water take its sheet with them, the water the cap leaves keeps it, and the original is its own again when the patch goes (mutants: the patch unread; the restride on the original)', () => {
  // the DW-B pixel: water west of x 64 (the sea west of 40, raised between 40 and 64), grass east
  const H = 129, T = 128, SEA = Math.fround(Math.fround(27.2) / 1539);
  const samples = new Float32Array(H * H), raw = new Uint8Array(T * T);
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) samples[x * H + y] = x <= 40 ? SEA : Math.fround(30 / 1539);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) raw[y * T + x] = x < 64 ? 0 : 2;
  const bytes = convertTilemap(raw), patched = patchTilemapForClip(bytes, { samples, tilemap: raw });
  assert.equal(WATER_DRAW_MASK_TABLE[CLIP_SENTINEL], 0, 'the clip\'s byte is no water to WATER1');
  const wet = (idx, stride) => {
    const g = 128 / stride + 1, out = new Set();
    for (let t = 0; t < idx.length; t += 6) { const i0 = idx[t]; out.add(`${(i0 % g) * stride},${Math.floor(i0 / g) * stride}`); }
    return out;
  };
  for (const stride of [1, 4]) {
    const before = wet(buildWaterIndices(bytes, stride), stride), after = wet(buildWaterIndices(patched, stride), stride);
    assert.ok(before.has(`${8 * stride},0`), 'the original: the sea wears WATER1');
    for (const k of after) {
      const [tx, tz] = k.split(',').map(Number);
      let any = false;
      for (let z = tz; z < tz + stride; z++) for (let x = tx; x < tx + stride; x++) any ||= WATER_DRAW_MASK_TABLE[patched[z * 128 + x]] > 0;
      assert.ok(any, `stride ${stride}: a sheet over ${k}, which the cap left no water`);
    }
    assert.ok(![...after].some((k) => Number(k.split(',')[0]) < 40), `stride ${stride}: none over the carved sea`);
    assert.ok(after.size > 0 && after.size < before.size, `stride ${stride}: the water the cap leaves (raised, no ground within eight) keeps its sheet`);
  }
  const world = rd('src/scenes/world.js');
  assert.match(world, /function dwSetTilemap\(entry, bytes\) \{\n\s+renderer\.writeTilemapTexture\(entry\.tilemapTex, bytes, TERRAIN_TILE_DIM\);\n\s+entry\._dwBytes = bytes === entry\.tilemapBytes \? null : bytes;\n\s+dwClipTerrain\(entry\);\n\s+dwWaterSurface\(entry\);/);
  assert.match(world, /const idx = buildWaterIndices\(p\._dwBytes \?\? p\.tilemapBytes, p\._stride \?\? 1\);/, 'the patch where there is one, the original when it goes');
  assert.match(world, /const waterIndices = waterOn \? buildWaterIndices\(p\._dwBytes \?\? p\.tilemapBytes, stride\) : null;/, 'and a restride reads it too');
  assert.match(world, /if \(!p\._visible \|\| !p\.water \|\| p\.deepWaters\?\.hide\) continue;/, 'a hidden cap takes its water with it, as before');
});

test('DW-F: the far ground\'s clip is the index set the world draws, rebuilt at its own stride (pins)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /const idx = p\._dwBytes \? clippedTerrainIndices\(p\._dwBytes, p\._stride \?\? 1\) : null;/);
  const cap = rd('src/world/deepWaterCap.js');
  assert.match(cap, /const tiles = \[\(t\) => t, \(t\) => last \* dim \+ t, \(t\) => t \* dim, \(t\) => t \* dim \+ last\];/, 'south row 0, north row 127, west column 0, east column 127 - buildTerrainIndices\' own edge order');
});
