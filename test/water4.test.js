// WATER4 (2026-09-11, Mac: "its still not taking into account all the
// water textures that are on land, and its not traced well, just
// square. Water is also still way too see through"): THE ART'S OWN
// WATER. The leaf EXECUTES on synthetic 64x64 indexed bitmaps - the
// water palette learned from record 0, the coverage grid, the four
// turns as TERRAIN_FS applies them, the bilinear read, the any and
// corner tables, the shore ramp - and the feet cross into water where
// the art puts it (a puddle no corner reaches included). The shader,
// the renderer, both hosts, the lab and the record are text-pinned.
// Mutants: the turn tables swapped (t1 for t3) change the corner masks
// and the coverage reads; the water set inverted marks dirt as water;
// the puddle's `any` dropped keeps it out of the pass; the shader's
// ROT/TRANS drifting from the terrain's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ART_GRID, ART_SHORE, ART_WET, ART_TURN, artShore, waterIndexSet, recordCoverage, artCoverage, artCornerMask, buildWaterArt,
} from '../src/world/waterArt.js';
import { waterSurfaceFs, buildWaterIndices, tilemapRectHasWater, SHALLOW_OPACITY, WATER_OPACITY, SHORE_DEPTH } from '../src/render/waterSurface.js';
import { basinDepths, flatDepths, BASIN_DEPTH } from '../src/render/waterBasin.js';
import { WATER_MASK_TABLE, waterCoverage } from '../src/world/waterCorners.js';
import { feetWaterCoverage, exteriorSurfaces, SWIM_COVERAGE, ON_EXTERIOR_WATER } from '../src/player/exteriorSurface.js';
import { createLookupTable } from '../src/world/terrainTiles.js';
import { convertTile } from '../src/world/terrainSurface.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// a 64x64 indexed record: index 200 where `wet(x, y)`, else 1 (dirt)
const bm = (wet) => {
  const data = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) data[y * 64 + x] = wet(x, y) ? 200 : 1;
  return { width: 64, height: 64, data };
};
const WATER = 0, DIRT = 1, HALF = 2, PUDDLE = 3, DIAG = 4;
const BITMAPS = [
  bm(() => true),                                              // 0: the water tile, and so the water palette
  bm(() => false),                                             // 1: dirt
  bm((x) => x < 32),                                           // 2: water on the left half (u < 0.5)
  bm((x, y) => x >= 16 && x < 48 && y >= 16 && y < 48),        // 3: a puddle no corner reaches
  bm((x, y) => x + y < 64),                                    // 4: the diagonal, one dry corner at (1,1)
];
const ART = buildWaterArt(BITMAPS);
const byte = (r, t = 0) => (r << 2) | t;

test('WATER4: the art is read off the bitmaps - record 0 is the water palette, the grid is the box average in the record\'s own frame, and an archive without a record 0 has no art', () => {
  assert.equal(ART_GRID, 16, '64 texels in 16 cells of 4x4');
  assert.equal(ART.grid, ART_GRID);
  assert.equal(ART.records, 5);
  assert.equal(ART.coverage.length, 5 * 16 * 16);
  assert.deepEqual([...waterIndexSet(BITMAPS[WATER])], [200], 'the water tile\'s indices, nothing else');
  const cells = (r) => ART.coverage.subarray(r * 256, r * 256 + 256);
  assert.ok(cells(WATER).every((c) => c === 255), 'the water tile is all water');
  assert.ok(cells(DIRT).every((c) => c === 0), 'dirt has none');
  for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) assert.equal(cells(HALF)[v * 16 + u], u < 8 ? 255 : 0, `half: cell (${u},${v})`);
  for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) assert.equal(cells(PUDDLE)[v * 16 + u], u >= 4 && u < 12 && v >= 4 && v < 12 ? 255 : 0, `puddle: cell (${u},${v})`);
  // a dithered cell is a fraction, not a checker: a 2x2 dither is half
  const dither = recordCoverage(bm((x, y) => ((x + y) & 1) === 0), new Set([200]));
  assert.ok(dither.every((c) => Math.abs(c - 128) <= 1), 'a checker averages to half');
  // an empty record (the archive does not carry it) is dry, and a record past the art is dry
  assert.ok(recordCoverage({ width: 0, height: 0, data: null }, new Set([200])).every((c) => c === 0));
  assert.equal(artCoverage(ART, byte(9), 0.5, 0.5), 0, 'a record the art has no row for');
  assert.equal(buildWaterArt([]), null);
  assert.equal(buildWaterArt([{ width: 0, height: 0, data: null }]), null, 'no record 0, no palette to learn');
  assert.equal(buildWaterArt(null), null);
  // mutant: the water set inverted marks the dirt as water
  const inverted = recordCoverage(BITMAPS[DIRT], new Set([1]));
  assert.ok(inverted.every((c) => c === 255), 'the set decides, so an inverted set is caught here');
});

test('WATER4: the CPU read is the shader\'s - the four turns as TERRAIN_FS applies them, the bilinear between cells, the clamp a half-cell in (mutant: t1 and t3 swapped)', () => {
  // the turns: GLSL's column-major mat2 * f + TRANS, turn by turn
  assert.deepEqual(ART_TURN[0](0.25, 0.75), [0.25, 0.75]);
  assert.deepEqual(ART_TURN[1](0.25, 0.75), [0.75, 0.75]);   // (y, 1 - x)
  assert.deepEqual(ART_TURN[2](0.25, 0.75), [0.75, 0.25]);   // (1 - x, 1 - y)
  assert.deepEqual(ART_TURN[3](0.25, 0.75), [0.25, 0.25]);   // (1 - y, x)
  // the half record through each turn: where its water lands in the tile's frame
  const at = (r, t, x, y) => artCoverage(ART, byte(r, t), x, y);
  assert.equal(at(HALF, 0, 0.25, 0.5), 1); assert.equal(at(HALF, 0, 0.75, 0.5), 0);   // unturned: the left
  assert.equal(at(HALF, 1, 0.5, 0.25), 1); assert.equal(at(HALF, 1, 0.5, 0.75), 0);   // t1: the top (y < 0.5)
  assert.equal(at(HALF, 2, 0.75, 0.5), 1); assert.equal(at(HALF, 2, 0.25, 0.5), 0);   // t2: the right
  assert.equal(at(HALF, 3, 0.5, 0.75), 1); assert.equal(at(HALF, 3, 0.5, 0.25), 0);   // t3: the bottom
  // between the last wet and the first dry cell the read is their mean - the shore is traced, not stepped
  assert.ok(Math.abs(at(HALF, 0, 0.5, 0.5) - 0.5) < 1e-9, 'the boundary between cells 7 and 8 reads half');
  assert.ok(Math.abs(at(HALF, 0, 0.5 - 0.25 / 16, 0.5) - 0.75) < 1e-9, 'a quarter cell into the water: three quarters');
  // the diagonal: water under x + y < 1, the read crossing half on the diagonal itself
  assert.equal(at(DIAG, 0, 0.25, 0.25), 1); assert.equal(at(DIAG, 0, 0.75, 0.75), 0);
  assert.ok(Math.abs(at(DIAG, 0, 0.5, 0.5) - 0.5) < 0.1, 'about half on the diagonal');
  // the clamp: past the tile's edge the read is the edge cell, never a neighbour record's
  assert.equal(at(HALF, 0, -1, 0.5), 1); assert.equal(at(HALF, 0, 2, 0.5), 0);
  assert.equal(at(WATER, 0, 0.5, 1.5), 1, 'the water tile\'s last row, not the dirt record below it');
  assert.equal(at(DIRT, 0, 0.5, -0.5), 0, 'the dirt record\'s first row, not the water record above it');
  // mutant: t1 and t3 swapped - the top and the bottom trade places
  const swapped = [ART_TURN[0], ART_TURN[3], ART_TURN[2], ART_TURN[1]];
  const [u1, v1] = swapped[1](0.5, 0.25);
  assert.notEqual(ART.coverage[HALF * 256 + Math.floor(v1 * 16) * 16 + Math.floor(u1 * 16)] / 255, at(HALF, 1, 0.5, 0.25), 'the swap reads the other half');
});

test('WATER4: the tables by converted byte - `any` admits a puddle no corner reaches, `corners` are WATER1\'s bits read off the art through the turn, and both feed the quads, the basin and the town gate', () => {
  for (let t = 0; t < 4; t++) {
    assert.equal(ART.any[byte(WATER, t)], 1); assert.equal(ART.any[byte(DIRT, t)], 0);
    assert.equal(ART.any[byte(HALF, t)], 1); assert.equal(ART.any[byte(PUDDLE, t)], 1, 'the puddle enters the pass'); assert.equal(ART.any[byte(DIAG, t)], 1);
    assert.equal(ART.corners[byte(WATER, t)], 0xF); assert.equal(ART.corners[byte(DIRT, t)], 0);
    assert.equal(ART.corners[byte(PUDDLE, t)], 0, 'the puddle reaches no corner - the basin leaves its tile alone');
  }
  assert.deepEqual([0, 1, 2, 3].map((t) => ART.corners[byte(HALF, t)]), [0b0101, 0b0011, 0b1010, 0b1100], 'the half: left, top, right, bottom');
  assert.deepEqual([0, 1, 2, 3].map((t) => ART.corners[byte(DIAG, t)]), [0b0111, 0b1011, 0b1110, 0b1101], 'the diagonal: the dry corner walks round');
  assert.equal(artCornerMask(ART, byte(DIAG, 0)), 0b0111, 'the art\'s one-dry-corner record: three wet bits, the mask the shader\'s fallback arm would blend');
  assert.equal(ART_WET, (ART_SHORE[0] + ART_SHORE[1]) / 2, 'a corner is wet at the ramp\'s midpoint');
  // the quads: a puddle tile has a quad by the art, none by the corner table
  const dim = 128, bytes = new Uint8Array(dim * dim).fill(byte(DIRT));
  bytes[5 + 5 * dim] = byte(PUDDLE);
  assert.equal(buildWaterIndices(bytes, 1), null, 'the corner table: no water');
  const q = buildWaterIndices(bytes, 1, ART.any);
  assert.equal(q?.length, 6, 'the art: the puddle\'s one quad');
  assert.equal(basinDepths(bytes, 1, dim, ART.corners), null, 'and no basin under it (no vertex is wet)');
  // the town gate by the art
  assert.equal(tilemapRectHasWater(bytes, dim, 8, 8), false);
  assert.equal(tilemapRectHasWater(bytes, dim, 8, 8, ART.any), true);
  // the half record carves as WATER1's edge would
  const shore = new Uint8Array(dim * dim).fill(byte(DIRT));
  for (let y = 0; y < dim; y++) for (let x = 0; x < 64; x++) shore[x + y * dim] = byte(WATER);
  for (let y = 0; y < dim; y++) shore[64 + y * dim] = byte(HALF);   // water on its left half: the shore runs down x = 64.5
  const d = basinDepths(shore, 1, dim, ART.corners);
  assert.ok(d, 'a basin');
  assert.equal(d[65 + 10 * (dim + 1)], 0, 'the vertex at x = 65: the half tile\'s right corners are dry - the bank');
  assert.ok(d[64 + 10 * (dim + 1)] > 0 && d[64 + 10 * (dim + 1)] < 0.5, 'the vertex at x = 64: the half tile\'s left corners and the water tile\'s right ones are wet - one ring off the bank');
  assert.ok(d[60 + 10 * (dim + 1)] > d[64 + 10 * (dim + 1)], 'deeper away from the bank');
  // the flat sheet: every vertex at zero, buildTerrainGrid's count
  const flat = flatDepths(1, dim);
  assert.equal(flat.length, (dim + 1) ** 2);
  assert.ok(flat.every((v) => v === 0));
  assert.equal(flatDepths(4, dim).length, 33 * 33);
  void BASIN_DEPTH;
});

test('WATER4: the feet read the art through the shader\'s shore ramp - the player swims where the art puts water, a puddle included, and the corner table answers where no art is read', () => {
  assert.equal(artShore(ART_SHORE[0]), 0); assert.equal(artShore(ART_SHORE[1]), 1);
  assert.ok(Math.abs(artShore(ART_WET) - 0.5) < 1e-9, 'the ramp crosses half at ART_WET - the shader\'s and MAC2\'s 0.5');
  assert.ok(artShore(0.3) > 0 && artShore(0.3) < 0.5 && artShore(0.5) > 0.5 && artShore(0.5) < 1, 'smoothstep between');
  assert.deepEqual(ART_SHORE, [0.2, 0.6], 'low, so a dither reads as water and not as lace');
  // the raw byte as the tilemap carries it: the record in the low six bits, the turn's two bits above (convertTile, UpdateTileMapDataJob's conversion, makes record << 2 | turn of it)
  const rawFor = (r, t) => { const raw = r | (t << 6); assert.equal(convertTile(raw), byte(r, t)); return raw; };
  assert.equal(feetWaterCoverage(rawFor(HALF, 0), [0.25, 0.5], ART), 1, 'in the half tile\'s water');
  assert.equal(feetWaterCoverage(rawFor(HALF, 0), [0.75, 0.5], ART), 0, 'on its dirt');
  assert.equal(feetWaterCoverage(rawFor(HALF, 2), [0.75, 0.5], ART), 1, 'turned twice: the water is on the right');
  assert.equal(feetWaterCoverage(rawFor(PUDDLE, 0), [0.5, 0.5], ART), 1, 'the puddle\'s middle');
  assert.equal(feetWaterCoverage(rawFor(PUDDLE, 0), [0.05, 0.05], ART), 0, 'its corner');
  assert.ok(feetWaterCoverage(rawFor(DIAG, 0), [0.25, 0.25], ART) >= SWIM_COVERAGE);
  assert.ok(feetWaterCoverage(rawFor(DIAG, 0), [0.75, 0.75], ART) < SWIM_COVERAGE);
  // no art: MAC2's corner read, untouched (the marching squares' own byte)
  const raw = createLookupTable()[0b0011];
  assert.ok(Math.abs(feetWaterCoverage(raw, [0.5, 0.9]) - waterCoverage(WATER_MASK_TABLE[convertTile(raw)], 0.5, 0.9)) < 1e-9);
  assert.ok(Math.abs(feetWaterCoverage(raw, [0.5, 0.9], null) - 0.9) < 1e-9);
  assert.equal(feetWaterCoverage(null, [0.5, 0.5], ART), null);
  // through exteriorSurfaces: the puddle swims, its dirt is DFU's dry (a record DFU has no water law for)
  const probe = { hit: true, terrain: true, staticGeometry: false, dist: 0.9 };
  const { Swimming, None } = ON_EXTERIOR_WATER;
  assert.equal(exteriorSurfaces({ rawTile: rawFor(PUDDLE, 0), feet: [0.5, 0.5], art: ART, probe }).water, Swimming, 'the player swims in the puddle the art paints');
  assert.equal(exteriorSurfaces({ rawTile: rawFor(PUDDLE, 0), feet: [0.05, 0.05], art: ART, probe }).water, None);
  assert.equal(exteriorSurfaces({ rawTile: rawFor(PUDDLE, 0), feet: [0.5, 0.5], art: null, probe }).water, None, 'without the art the record is dry, as MAC2 left it');
});

test('WATER4: the shader - the art on its own sampler, the record\'s texel through THE TERRAIN\'S OWN ROT/TRANS, the ramp off the leaf\'s numbers, the puddle\'s floor, the corner table as the fallback arm, no surf on an uncarved bed', () => {
  const fs = waterSurfaceFs('float cloudShadowAt(vec3 wp) { return 1.0; }');
  assert.match(fs, /uniform sampler2D uWaterArt;/);
  assert.match(fs, /uniform int uWaterArtOn;/);
  assert.match(fs, /uniform float uWaterArtRows;/);
  assert.match(fs, /const float ART_GRID = 16\.0;/, 'the leaf\'s grid, templated');
  assert.match(fs, /const vec2 ART_SHORE = vec2\(0\.20, 0\.60\);/, 'the leaf\'s ramp, templated');
  // the turn tables are the terrain pass's, character for character
  const block = (src) => src.slice(src.indexOf('const mat2 ROT[4] = mat2[4]('), src.indexOf('vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, 0.0));') + 'vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, 0.0));'.length);
  const terrain = block(rd('src/render/renderer.js')), water = block(fs);
  assert.ok(terrain.length > 100 && terrain === water, 'the water samples the record at the uv the terrain draws it by');
  assert.match(fs, /vec2 tuv = clamp\(ROT\[t\] \* f \+ TRANS\[t\], 0\.0, 1\.0\) \* ART_GRID;\s*\n\s*tuv = clamp\(tuv, vec2\(0\.5\), vec2\(ART_GRID - 0\.5\)\);\s*\n\s*return texture\(uWaterArt, vec2\(tuv\.x \/ ART_GRID, \(float\(layer\) \* ART_GRID \+ tuv\.y\) \/ uWaterArtRows\)\)\.r;/, 'a half-cell in from the record\'s edges, the record\'s own rows');
  assert.match(fs, /if \(uWaterArtOn == 1\) \{\s*\n(\s*\/\/[^\n]*\n)*\s*edge = smoothstep\(ART_SHORE\.x, ART_SHORE\.y, artCoverage\(data, f\)\);\s*\n\s*if \(edge <= 0\.002\) discard;\s*\n\s*depth = max\(vDepth, uShoreDepth \* edge\);\s*\n\s*\} else \{\s*\n\s*uint corners = waterCorners\(data\);\s*\n\s*if \(corners == 0u\) discard;/, 'the art arm, then the corner arm');
  assert.match(fs, /edge \*= smoothstep\(0\.0, uShoreDepth, depth\);/, 'the shoreline ramp reads the floored depth');
  assert.match(fs, /float deep = 1\.0 - exp\(-max\(depth, 0\.0\) \* uAbsorb\);/, 'so does the bed\'s loss');
  assert.match(fs, /shoreFoam \*= smoothstep\(0\.0, 0\.05, vDepth\);/, 'the foam still reads the carved bed: a puddle breaks no surf');
  assert.ok(SHORE_DEPTH > 0, 'the puddle\'s floor is the shoreline\'s depth');
});

test('WATER4: the renderer and the hosts - the art uploaded once per archive beside its tiles as R8 LINEAR, bound on unit 3 or the black texel, both hosts read it off the bitmaps and hand it to the quads, the basin, the gate and the feet; the lab paints its own; the water is no longer glass', () => {
  const r = rd('src/render/renderer.js');
  assert.match(r, /this\.waterArts = new Map\(\);/);
  const up = r.slice(r.indexOf('  uploadWaterArt(archive, art) {'));
  const upBody = up.slice(0, up.indexOf('\n  }\n'));
  assert.match(upBody, /if \(this\.waterArts\.has\(archive\)\) return this\.waterArts\.get\(archive\);\s*\n\s*if \(!art\) \{ this\.waterArts\.set\(archive, null\); return null; \}/, 'once, null cached too');
  assert.match(upBody, /gl\.texImage2D\(gl\.TEXTURE_2D, 0, gl\.R8, art\.grid, art\.grid \* art\.records, 0, gl\.RED, gl\.UNSIGNED_BYTE, art\.coverage\);/);
  assert.match(upBody, /gl\.TEXTURE_MIN_FILTER, gl\.LINEAR\);\s*\n\s*gl\.texParameteri\(gl\.TEXTURE_2D, gl\.TEXTURE_MAG_FILTER, gl\.LINEAR\);/, 'traced between cells');
  assert.match(upBody, /gl\.pixelStorei\(gl\.UNPACK_ALIGNMENT, 1\);[\s\S]*?gl\.pixelStorei\(gl\.UNPACK_ALIGNMENT, 4\);/, 'a 16-wide R8 row is not 4-aligned by default');
  assert.match(r, /waterArtOf\(archive\) \{ return this\.waterArts\.get\(archive\)\?\.art \?\? null; \}/);
  assert.match(r, /waterArt: u\('uWaterArt'\), waterArtOn: u\('uWaterArtOn'\), waterArtRows: u\('uWaterArtRows'\),/);
  const draw = r.slice(r.indexOf('  drawWaterSurface(surface, modelMatrix, arrayTex, tilemapTex, tileSize, u, tileDim = 128, art = null) {'));
  const body = draw.slice(0, draw.indexOf('\n  }\n'));
  assert.match(body, /gl\.activeTexture\(gl\.TEXTURE3\);\s*\n\s*gl\.bindTexture\(gl\.TEXTURE_2D, art\?\.tex \?\? this\._blackTex\);\s*\n\s*gl\.uniform1i\(L\.waterArt, 3\);\s*\n\s*gl\.uniform1i\(L\.waterArtOn, art \? 1 : 0\);\s*\n\s*gl\.uniform1f\(L\.waterArtRows, art \? art\.art\.grid \* art\.art\.records : 1\);\s*\n\s*gl\.activeTexture\(gl\.TEXTURE0\);/, 'unit 3, the terrain\'s two on 0 and 2');
  // the hosts
  const w = rd('src/scenes/world.js'), e = rd('src/scenes/exterior.js');
  for (const [name, src] of [['world', w], ['exterior', e]]) {
    assert.match(src, /import \{ buildWaterArt \} from '\.\.\/world\/waterArt\.js';/, `${name}: the leaf`);
    assert.match(src, /if \(!renderer\.waterArts\.has\(groundArchive\)\) \{[\s\S]{0,200}?const bitmaps = \[\];\s*\n\s*for \(let r = 0; r < groundTex\.recordCount; r\+\+\) bitmaps\.push\(groundTex\.getDFBitmap\(r, 0\)\);\s*\n\s*renderer\.uploadWaterArt\(groundArchive, buildWaterArt\(bitmaps\)\);\s*\n\s*\}\s*\n\s*const waterArt = renderer\.waterArtOf\(groundArchive\);/, `${name}: read off the archive's own bitmaps, once`);
    assert.match(src, /feet: \[u - tx, v - ty\], art: renderer\.waterArtOf\(/, `${name}: the ground sample carries the art`);
    assert.match(src, /feet: _ground\?\.feet \?\? null,[^\n]*\n\s*art: _ground\?\.art \?\? null,/, `${name}: and the surface read takes it`);
  }
  assert.match(e, /const groundTex = textureFiles\.get\(groundArchive\) \?\? await getTexture\(groundArchive\);/, 'the town: the archive may be cached on the renderer by the world host and not yet loaded here');
  assert.match(e, /renderer\.drawWaterSurface\(townWater, identityMatrix, renderer\.tileArrays\.get\(groundArchive\), tilemapTex, 6\.4,\s*\n[^\n]*\n\s*tilemapDim, renderer\.waterArts\.get\(groundArchive\)\);/, 'the town draws with it');
  assert.match(rd('src/player/exteriorSurface.js'), /export function feetWaterCoverage\(rawTile, feet, art = null\) \{\s*\n\s*if \(rawTile == null \|\| !feet\) return null;\s*\n\s*const byte = convertTile\(rawTile\);\s*\n\s*if \(art\) return artShore\(artCoverage\(art, byte, feet\[0\], feet\[1\]\)\);\s*\n\s*return waterCoverage\(waterCorners\(byte\), feet\[0\], feet\[1\]\);/);
  // the lab: its art painted off the corner table, `?noart` the corner path
  const lab = rd('src/tools/waterLab.js');
  assert.match(lab, /const artOn = !params\.has\('noart'\);/);
  assert.match(lab, /const labArt = artOn \? buildWaterArt\(artBitmaps\) : null;/);
  assert.match(lab, /const basin = basinDepths\(tilemapBytes, 1, TERRAIN_TILE_DIM, labArt\?\.corners\);/);
  assert.match(lab, /const waterIndices = buildWaterIndices\(tilemapBytes, 1, labArt\?\.any\);/);
  // the glass: Mac's "still way too see through" (0.30 before)
  assert.ok(SHALLOW_OPACITY >= 0.75 && SHALLOW_OPACITY < WATER_OPACITY, `the shallows are ${SHALLOW_OPACITY} opaque`);
  // the record
  assert.match(rd('bible/07-Rendering/Water-Arc.md'), /## WATER4 - THE ART'S OWN WATER \(2026-09-11\)/);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /\| THE WATER IS THE ART'S \(WATER4, 2026-09-11\) \|/, 'section A carries it');
});
