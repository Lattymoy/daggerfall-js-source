// "We need to make sure we go away from the water tiles and move into a proper water
// shader"): A WATER BODY IS A LEVEL, NOT A TILE (world/water/waterLevel.js, world/water/streamLevels.js). The tiles mark
// where water is; each body's own law gives its level; the ground is carved under it, never raised; the sheet stands at
// it and its shore is where the plane meets the ground, or the cut field. The record:
// WATER-LEVEL. Mutants: tools/mutants/waterlevel.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waterVotes, waterLevels, waterSheet, fanCut, seaLevelAt, SEA_LEVEL_Y, SEA_GROUND_EPSILON, DEPTH_CUT_RISE } from '../../../src/world/water/waterLevel.js';
import { streamLevelAt, gen2LevelY, paintedWaterAt } from '../../../src/world/water/streamLevels.js';
import { waterBedOf, bedFields, flatGrid, bedHalo, BED_DEPTH } from '../../../src/world/water/waterBed.js';
import { WATER_DRAW_MASK_TABLE, WATER_MASK_TABLE } from '../../../src/world/water/waterCorners.js';
import { CLIP_SENTINEL } from '../../../src/world/terrain/terrainSurface.js';
import { WATER_SURFACE_VS, waterSurfaceFs, SHORE_MEET, WATER_LIFT } from '../../../src/render/waterSurface.js';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { gen2Install, gen2Regions } from '../../../src/world/gen2/gen2Ground.js';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { worldManifest } from '../../../src/world/gen2/manifest.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { hostText } from '../../hostText.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const DRY = 2 << 2, WET = 0;
/** A T x T tilemap: `wet(x, z)` water (record 0), the rest grass. */
const map = (T, wet) => { const b = new Uint8Array(T * T).fill(DRY); for (let z = 0; z < T; z++) for (let x = 0; x < T; x++) if (wet(x, z)) b[z * T + x] = WET; return b; };

test('WATER-LEVEL the tiles mark the water: each vertex\'s share of the tiles meeting it that call that corner water, by the draw\'s table; a tile past the map is no vote, nor is a Deep Waters clip; none where no tile is water (mutants: the share\'s divisor; the clip voting dry; the law\'s table)', () => {
  const b = map(4, (x, z) => x === 1 && z === 1);
  const f = waterVotes(b, { tileDim: 4 }), at = (x, z) => f[z * 5 + x];
  assert.deepEqual([at(1, 1), at(2, 1), at(1, 2), at(2, 2)], [0.25, 0.25, 0.25, 0.25], 'a lone tile: a quarter of each corner\'s four');
  assert.equal(at(0, 0), 0);
  const edge = waterVotes(map(4, (x) => x === 0), { tileDim: 4 });
  assert.equal(edge[0], 1, 'the map\'s corner: its one tile the only vote');
  assert.equal(edge[2 * 5], 1, 'the map\'s edge: two tiles, both water');
  const clip = map(4, () => true);
  clip[1 * 4 + 2] = CLIP_SENTINEL;
  assert.equal(waterVotes(clip, { tileDim: 4 })[1 * 5 + 2], 1, 'a clipped tile is no vote - the water beside it is the water\'s own');
  assert.equal(waterVotes(map(4, () => false), { tileDim: 4 }), null, 'no water, no votes');
  const nine = new Uint8Array(16).fill(DRY); nine[5] = 9 << 2;
  assert.ok(waterVotes(nine, { tileDim: 4 }), 'the draw\'s table: record 9 reads as water to the eye (WATER-DRAW1)');
  assert.equal(waterVotes(nine, { tileDim: 4, table: WATER_MASK_TABLE }), null, '...and the law\'s does not');
  // the seam: each pixel marks its edge by its own tiles, whatever lies past it
  assert.equal(waterVotes(map(4, () => true), { tileDim: 4 })[2 * 5 + 4], 1, 'a water tile at the map\'s edge: its vertex wholly water');
});

test('WATER-LEVEL the bed\'s halo sees a painted water past the seam - World 2.0\'s and Cyrodiil\'s lakes are no kernel\'s, so a lake met its seam as a bank and a line of foam (mutants: the halo blind to them)', () => {
  const dry = () => 1;   // a ghost of high dry ground
  const plain = bedHalo(dry, 3000, 1300), wet = bedHalo(dry, 3000, 1300, undefined, () => true);
  const i = (plain.tp - 1) * plain.dim + plain.tp + 5;   // a tile of the south neighbour
  assert.equal(plain.bits[i], 0, 'the kernel alone: dry');
  assert.equal(wet.bits[i], 15, 'painted: water at every corner');
  assert.equal(paintedWaterAt(207, 213), null, 'Daggerfall\'s pixel: nothing painted by a law');
});

test('WATER-LEVEL the levels: a marked vertex takes its body\'s own law or its uncarved ground; a dry vertex beside it borrows its neighbours\' mean, never above its own ground; the cut is 1 - 2 x the share, and at a borrowing vertex -1 where its ground rises through the plane, 1 where the plane runs on over it (mutants: the ring above its ground; the ring\'s mean; the rise; the law ignored)', () => {
  const g = flatGrid(4, 1, 10), gx = 5, gz = 2;
  // a slope down the row: x 0 at 10, x 1 at 11, x 2 at 13 - vertices (0, *) marked, (1, *) beside them, (2, *) far
  for (let i = 0; i < gx * gz; i++) g.positions[i * 3 + 1] = [10, 11, 13, 14, 14][i % gx];
  const votes = new Float32Array(gx * gz); votes[0] = 1; votes[gx] = 0.5;
  const plain = waterLevels({ grid: g.positions, gx, gz, votes });
  assert.equal(plain.level[0], 10, 'the uncarved ground');
  assert.equal(plain.level[1], 10, 'beside it: its neighbours\' level, under its own ground');
  assert.ok(Number.isNaN(plain.level[2]), 'two cells off: no level');
  assert.equal(plain.cut[0], -1); assert.equal(plain.cut[gx], 0, 'a half share is the line itself');
  assert.equal(plain.cut[1], -1, 'its ground a unit over the plane: the depth test is the shore');
  const lawful = waterLevels({ grid: g.positions, gx, gz, votes, levelAt: (vx, vz) => (vz === 0 ? 10.6 : NaN) });
  assert.equal(lawful.level[0], Math.fround(10.6), 'a law\'s level where it speaks');
  assert.equal(lawful.level[gx], 10, 'its uncarved ground where it does not');
  assert.ok(Math.abs(lawful.level[1] - (10.6 + 10) / 2) < 1e-5, 'the borrowing vertex: the mean of the two it meets');
  // flat ground: the plane runs on over a ring no higher than it - the cut field ends it
  const flat = flatGrid(4, 1, 10), fl = waterLevels({ grid: flat.positions, gx, gz, votes });
  assert.equal(fl.level[1], 10); assert.equal(fl.cut[1], 1);
  // a ring vertex below the water: borrows its own ground, the plane follows the ground down
  for (let i = 0; i < gx * gz; i++) flat.positions[i * 3 + 1] = [10, 9, 9, 9, 9][i % gx];
  const down = waterLevels({ grid: flat.positions, gx, gz, votes });
  assert.equal(down.level[1], 9, 'never above its own ground'); assert.equal(down.cut[1], 1);
  assert.equal(DEPTH_CUT_RISE, 0.25);
  assert.ok(DEPTH_CUT_RISE > WATER_LIFT + 0.05, 'past the lift and the calmest swell, so the plane meets the ground inside the cell');
});

test('WATER-LEVEL the bed: carved to at least its profile under the level and never raised - Daggerfall\'s flat water as BANK-FLUSH carves it, a law\'s deeper floor left alone (mutants: the carve by the ground alone; the floor raised)', () => {
  const T = 16, b = map(T, (x, z) => x >= 2 && x < 14 && z >= 2 && z < 14), f = bedFields(b, { tileDim: T });
  const flat = waterBedOf(flatGrid(T, T, 10), b, { tileDim: T });
  assert.deepEqual(flat.depths, f.carve, 'flat water: the ground lowered by BANK-FLUSH\'s carve');
  // a law whose level stands 3 units over the ground (World 2.0's channels, its lakes' floors): carved only past level - 3
  const deep = waterBedOf(flatGrid(T, T, 10), b, { tileDim: T, levelAt: () => 13 });
  for (let i = 0; i < f.carve.length; i++) {
    assert.equal(deep.depths[i], Math.max(0, f.carve[i] - 3), `vertex ${i}: min(ground, level - carve)`);
    assert.ok(deep.ground.positions[i * 3 + 1] <= 10 + 1e-6, 'never raised');
  }
  assert.equal(deep.sheet.positions[(8 * 17 + 8) * 3 + 1], 13, 'the sheet at the law\'s level');
  assert.ok(Math.abs(deep.sheet.depths[(8 * 17 + 8) * 2] - (13 - (10 - Math.max(0, BED_DEPTH - 3)))) < 1e-5, 'its depth over the carved ground');
});

test('WATER-LEVEL the sheet: a quad whose four corners hold a level and one is the water\'s own, never a clip; four triangles about its centre, the centre the corners\' mean level and the tile\'s own water at its middle; the depths the plane over the carved ground and the shading never under the bed (mutants: a quad of borrowed corners; a clipped quad drawn; the centre\'s tile water; the shading\'s floor)', () => {
  const T = 6, b = map(T, (x, z) => x === 2 && z >= 0);   // a stream a tile wide, every corner shared with grass
  const bed = waterBedOf(flatGrid(T, T, 5), b, { tileDim: T }), s = bed.sheet, g = T + 1;
  assert.ok(s, 'a stream with no wet vertex still has its sheet');
  const quads = [];
  for (let t = 0; t < s.indices.length; t += 12) quads.push(s.indices[t + 1]);
  assert.deepEqual([...new Set(quads.map((i0) => i0 % g))].sort(), [1, 2, 3], 'the stream\'s tiles and the ring its level runs on into');
  assert.equal(quads.length, 3 * T);
  const mid = quads.indexOf(3 * g + 2), c = s.indices[mid * 12];
  assert.equal(s.indices[mid * 12 + 3], c); assert.equal(s.indices[mid * 12 + 6], c); assert.equal(s.indices[mid * 12 + 9], c);
  assert.equal(s.cut[c], -1, 'a tile wide, and water at its middle');
  assert.equal(s.cut[3 * g + 2], 0, 'its corners on the line');
  assert.ok(Math.abs(fanCut(0, 0, 0, 0, -1, 0.5, 1)) < 1e-9 && fanCut(0, 0, 0, 0, -1, 0.5, 0.5) === -1 && Math.abs(fanCut(0, 0, 0, 0, -1, 0.5, 0.9) + 0.2) < 1e-9, 'water from the middle out to the line at its edge');
  assert.equal(s.positions[c * 3 + 1], 5, 'the centre at the corners\' level');
  assert.deepEqual([s.positions[c * 3], s.positions[c * 3 + 2]].map((v) => +v.toFixed(3)), [16, 22.4], 'the middle of tile (2, 3)');
  // two streams a tile apart: the quad between their borrowed rings holds no water of its own, and is not drawn
  const two = waterBedOf(flatGrid(8, 2, 5), map(8, (x) => x === 1 || x === 5).subarray(0, 16), { tileDim: 8, width: 8, height: 2 }).sheet;
  const tq = []; for (let t = 1; t < two.indices.length; t += 12) tq.push(two.indices[t] % 9);
  assert.deepEqual([...new Set(tq)].sort(), [0, 1, 2, 4, 5, 6], 'the gap\'s quad (3) borrowed on all four corners');
  // a clip: no quad holding one
  const clipped = map(T, () => true); clipped[3 * T + 3] = CLIP_SENTINEL;
  const cs = waterBedOf(flatGrid(T, T, 5), clipped, { tileDim: T }).sheet;
  const cq = []; for (let t = 1; t < cs.indices.length; t += 12) cq.push(cs.indices[t]);
  assert.ok(!cq.includes(3 * g + 3) && cq.length === T * T - 1, 'Iliac Puddle No More\'s own sea stands there');
  // a pond: the shading never under the bed's profile, the plane's depth over the carved ground
  const P = 16, pond = map(P, (x, z) => x >= 2 && x < 14 && z >= 2 && z < 14), pb = waterBedOf(flatGrid(P, P, 10), pond, { tileDim: P }), f = bedFields(pond, { tileDim: P });
  for (let i = 0; i < f.depths.length; i++) if (f.depths[i] > 0) assert.ok(pb.sheet.depths[i * 2 + 1] >= f.depths[i] - 1e-6 && pb.sheet.depths[i * 2 + 1] >= pb.sheet.depths[i * 2] - 1e-6);
});

test('WATER-LEVEL the streamed world\'s levels: the sea at its clamp on the Bay; past it World 2.0\'s lake at its own surface where a region holds the whole ground; nothing where no law speaks (mutants: the sea\'s epsilon; World 2.0\'s frame; its share gate)', () => {
  assert.equal(SEA_LEVEL_Y, 34);
  assert.equal(seaLevelAt(34), 34); assert.equal(seaLevelAt(34 + SEA_GROUND_EPSILON / 2), 34);
  assert.ok(Number.isNaN(seaLevelAt(34.5)), 'a hill over the sea is no sea');
  const bay = streamLevelAt(207, 213);
  assert.equal(bay(64, 64, 33.999), 34, 'Daggerfall\'s pixel: the sea\'s law');
  assert.ok(Number.isNaN(bay(64, 64, 52)), 'a town pond\'s level is its ground (the caller\'s)');
  const fit = worldManifest().fit;
  setTamrielFit(fit);
  const bytes = readBake(`${BAKE_DIR}/blackmarsh-test.wg2.gz`), R = decodeBake(bytes).header.rect;
  gen2Install([bytes], fit);
  try {
    const r = gen2Regions()[0];
    let hit = null;
    for (let py = R.y + 12; py < R.y + R.h - 12 && !hit; py++) {
      for (let px = R.x + 12; px < R.x + R.w - 12 && !hit; px++) {
        for (let vz = 4; vz < 128 && !hit; vz += 8) for (let vx = 4; vx < 128 && !hit; vx += 8) {
          const x = px + vx / 128, y = py + 1 - vz / 128, w = r.weight(x, y) >= 1 ? r.waterAt(x, y) : null;
          if (w?.kind === 'lake') hit = { px, py, vx, vz, w };
        }
      }
    }
    assert.ok(hit, 'a lake of the region');
    assert.equal(streamLevelAt(hit.px, hit.py)(hit.vx, hit.vz, 0), gen2LevelY(hit.w.surface), 'the lake\'s own surface, in the scene');
    assert.equal(gen2LevelY(5), 39, 'metres over the sea: 34 + m (regionSampler.js kernelUnits at the streamed scale)');
    assert.equal(streamLevelAt(hit.px, hit.py, 4)(hit.vx / 4, hit.vz / 4, 0), gen2LevelY(hit.w.surface), 'a far ring\'s vertex asks the same point');
    // the region's band, where it holds under half the ground: its water is not the ground's there (paintGen2Waters' gate)
    let band = null;
    for (let i = 0; i < 4000 && !band; i++) {
      const k = i * 0.618034, x = R.x + (k % 1) * 3, y = R.y + 4 + ((i * 7) % (R.h - 8)) + (k % 0.5);
      if (r.weight(x, y) > 0 && r.weight(x, y) < 0.5 && r.waterAt(x, y)) band = [x, y];
    }
    if (band) {
      const [x, y] = band, px = Math.floor(x), py = Math.floor(y), vx = (x - px) * 128, vz = (py + 1 - y) * 128;
      assert.ok(Number.isNaN(streamLevelAt(px, py)(vx, vz, 50)), 'a region\'s water where it holds under half the ground stands nothing');
    }
  } finally { gen2Install([], fit); }
});

test('WATER-LEVEL the sheet\'s shader: no tile says where the water is - the shore is the cut field, softened where the ground meets the plane; the swell grows with the water over the ground (mutants: the meet dropped; the cut\'s sign)', () => {
  const fs = waterSurfaceFs('');
  assert.doesNotMatch(fs, /uWaterMask|waterCorners\(|coverage\(/);
  assert.match(fs, /edge = smoothstep\(0\.5 - uShoreSoft, 0\.5 \+ uShoreSoft, 0\.5 - 0\.5 \* vCut - /);
  assert.match(fs, /float meet = vDepth\.x;/);
  assert.match(fs, /meet = \(bedD - here\) \* slant;/, 'Full: the scene\'s own depth behind the surface');
  assert.match(fs, /if \(uOpen == 0\) edge \*= smoothstep\(0\.0, 0\.060, meet\);/);
  assert.equal(SHORE_MEET, 0.06);
  assert.ok(SHORE_MEET < WATER_LIFT, 'a shelf standing at the level is water whole');
  assert.match(WATER_SURFACE_VS, /layout\(location=2\) in float aCut;/);
  assert.match(WATER_SURFACE_VS, /vCut = aCut;/);
});

test('WATER-LEVEL THE FOUR HOSTS, and the play keeps its line: the streaming world and the fixed town draw the sheet at its level; the interiors and the dungeons draw none; the feet, the townsfolk and the swim read the law\'s table, never a level (mutants: a host off the sheet)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const water = bed\?\.sheet \? renderer\.createWaterSheet\(bed\.sheet\) : null;/, 'the build');
  assert.match(w, /p\.water = bed\?\.sheet \? renderer\.createWaterSheet\(bed\.sheet\) : null;/, 'the restride');
  assert.match(w, /p\.water = p\._bed\?\.sheet \? renderer\.createWaterSheet\(p\._bed\.sheet\) : null;/, 'Deep Waters\' cap');
  assert.match(read('src/world/terrain/terrainGen.js'), /levelAt: at \? streamLevelAt\(at\.px, at\.py, stride\) : null/, 'the kernel levels by the pixel\'s own laws');
  assert.match(read('src/scenes/exterior.js'), /const townWater = townBed\?\.sheet \? renderer\.createWaterSheet\(townBed\.sheet\) : null;/, 'the fixed town: its own ground, no law');
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(f), /createWaterSheet|waterBedOf|water\/waterLevel\.js|streamLevels/, `${f}: the classic plane`);
  // the play: its readers ask the law's table and the uncarved ground, never the sheet
  const feet = read('src/player/exteriorSurface.js'), town = read('src/world/city/cityNavigation.js');
  assert.match(feet, /return waterCoverage\(waterCorners\(convertTile\(rawTile\)\), feet\[0\], feet\[1\]\);/, 'the feet: the corner table\'s default, the law\'s');
  assert.match(town, /any \|= WATER_MASK_TABLE\[\(record << 2\) \| t\];/, 'the townsfolk: the law\'s table');
  for (const [f, t] of [['exteriorSurface.js', feet], ['cityNavigation.js', town]]) assert.doesNotMatch(t, /waterLevel|streamLevels|\.sheet\b|WATER_DRAW_MASK_TABLE/, `${f} reads no level and not the draw's table`);
  assert.notDeepEqual(WATER_MASK_TABLE, WATER_DRAW_MASK_TABLE);
  assert.doesNotMatch(w.slice(w.indexOf('const heightAt = (x, z, terrainOnly = false) => {'), w.indexOf('// BLOOD1 AUDIT 3: WHERE THE GROUND IS DRAWN.')), /positions|_bed|sheet/, 'the game\'s ground is the samples\'');
});
