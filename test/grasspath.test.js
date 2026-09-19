import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { paintRoads, TILE, TRACK_TILES } from '../src/world/roadPainter.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { createLookupTable } from '../src/world/terrainTiles.js';
import { waterCorners } from '../src/world/waterCorners.js';
import { discSlotCount, cellKey, createGrassField, GRASS_CELL, LAB_GRASS } from '../src/render/labGrass.js';
import { grassRecordsOf } from '../src/render/labGrass.js';
import { DIR } from '../src/world/roadNetwork.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('GRASS-PATH1: a track across grass writes the very records the natural dirt-grass edge writes', () => {
  // This is WHY the mask has to exist. The grass placer decides by
  // record (grassRecordsOf), and the record cannot tell a dirt path from
  // the edge of a field: the track's four slots on grass ground are
  // 11/51/12/10, and createLookupTable's dirt-grass ring is built from
  // the same shapeStart 10 and saddle 51. Excluding them by number would
  // strip the grass off every dirt boundary in the world.
  const onGrass = new Set(TRACK_TILES.filter(Boolean).map((slot) => slot[TILE.grass]));
  const natural = new Set();
  const lut = createLookupTable();
  for (let i = 16; i < 32; i++) natural.add(lut[i] & 0x3f);   // the ring-1 (dirt <-> grass) half of the table
  for (const rec of onGrass) assert.ok(natural.has(rec), `track record ${rec} is also a natural dirt-grass transition`);
});

test('GRASS-PATH1: the painter marks every tile it writes, and marks nothing else', () => {
  const tilemap = new Uint8Array(128 * 128);
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const paths = new Uint8Array(128 * 128);
  // one track running east-west across the pixel
  const painted = paintRoads(tileData, tilemap, 0, DIR.E | DIR.W, null, 129, { paths });
  assert.ok(painted > 0, 'the track painted');
  let marked = 0, written = 0;
  for (let i = 0; i < tilemap.length; i++) {
    if (paths[i]) marked++;
    if (tilemap[i] !== 0) written++;
  }
  assert.equal(marked, written, 'exactly the tiles the painter wrote carry the mark');
  assert.ok(marked > 100, `a track across the pixel is a run of tiles (${marked})`);
});

test('GRASS-PATH1: the mask is null on a roadless pixel and the painter is unchanged without one', () => {
  const tilemap = new Uint8Array(128 * 128);
  const bare = new Uint8Array(128 * 128);
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  paintRoads(tileData, tilemap, 0, DIR.E | DIR.W, null, 129, {});             // no mask
  paintRoads(tileData, bare, 0, DIR.E | DIR.W, null, 129, { paths: new Uint8Array(128 * 128) });
  assert.deepEqual([...tilemap], [...bare], 'the tilemap the painter writes does not depend on the mask');
  const gen = read('src/world/terrainGen.js');
  assert.match(gen, /let paths = null;/, 'no network, no mask');
  assert.match(gen, /paths,\s+\/\/ GRASS-PATH1/, 'and it rides the kernel’s answer out');
  assert.equal(typeof generatePixelTerrain, 'function');
  const worker = read('src/world/terrainGenWorker.js');
  assert.match(worker, /if \(out\.paths\) transfer\.push\(out\.paths\.buffer\);/, 'transferred when present, never when null');
});

test('GRASS-PATH1 / GRASS-WET1: the host keeps no blade on a painted tile or a tile with a water corner', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(p\.paths\?\.\[ti\]\) return null;/, 'a painted tile grows nothing');
  assert.match(w, /if \(waterCorners\(byte, WATER_DRAW_MASK_TABLE\)\) return null;/, 'nor does a tile with any corner in water');
  assert.match(w, /import \{ waterCorners, WATER_DRAW_MASK_TABLE \} from '\.\.\/world\/waterCorners\.js';/, 'from the one table that owns the question');
  assert.match(w, /^\s+paths,\s+\/\/ GRASS-PATH1/m, 'the mask rides the built pixel');
});

test('GRASS-WET1: the shore records a stream writes over grass are mostly-grass by texel, which is why the record alone let blades into the water', () => {
  const flat = (r, g, b) => { const c = new Uint8ClampedArray(16 * 16 * 4); for (let k = 0; k < 16 * 16; k++) { c[k * 4] = r; c[k * 4 + 1] = g; c[k * 4 + 2] = b; c[k * 4 + 3] = 255; } return { width: 16, height: 16, colors: c }; };
  const archive = [flat(53, 94, 143), flat(134, 100, 65), flat(52, 76, 42), flat(80, 79, 81)];
  for (let r = 4; r < 56; r++) archive.push(flat(52, 76, 42));   // every blend a lawn, as the GR1 fixture has it
  const grass = grassRecordsOf(archive);
  for (const rec of [20, 21, 22, 49]) {
    assert.ok(grass.has(rec), `water-grass record ${rec} passes grassRecordsOf`);
    assert.ok(waterCorners(rec << 2) !== 0, `...and the corner table knows record ${rec} stands in water`);
  }
});

test('PERF10: the field is a disc - filled at the draw’s range, held out to the span', () => {
  const src = read('src/render/labGrass.js');
  assert.match(src, /const slots = discSlotCount\(span, cell\);/);
  assert.match(src, /const keepR2 = span \* span;/);
  assert.match(src, /const fillR2 = range \* range;/);
  assert.ok(discSlotCount(LAB_GRASS.span) < Math.ceil((LAB_GRASS.span * 2) / GRASS_CELL + 1) ** 2,
    'a disc of the same reach holds fewer cells than the square it replaced');
  assert.equal(discSlotCount(LAB_GRASS.span), 392);
  // and the slots allocated cover every cell the field can hold at once:
  // a cell is only ever created inside `range` and freed past `span`.
  const seen = [];
  const r = { allocSlots: (p, s) => seen.push(s), writeSlot: () => {}, clearSlot: () => {} };
  const f = createGrassField(r, { keep: () => 0, perFrame: 1e9 });
  assert.equal(seen[0], f.slots);
  let max = 0;
  for (let step = 0; step < 40; step++) { f.update(step * 7.5, step * 3.1); if (f.live.size > max) max = f.live.size; }
  assert.ok(max <= f.slots, `the disc never wants more cells than it has slots (${max} of ${f.slots})`);
});

test('PERF10: the cell key is a number and the free sweep parses nothing', () => {
  assert.equal(cellKey(3, -4), 3 * 65536 - 4);
  assert.notEqual(cellKey(3, -4), cellKey(-4, 3));
  const src = read('src/render/labGrass.js');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // the header still QUOTES the old spelling
  assert.doesNotMatch(code, /key\.split\(','\)/, 'the per-frame string split is gone');
  assert.match(src, /live\.set\(key, \{ slot, cx, cz \}\);/, 'cx/cz ride the entry');
  assert.match(src, /nearSq\(held\.cx, held\.cz, ex, ez\)/, 'so the sweep reads them off it');
});

test('PERF10: the near-piece index is built only when a cell is actually filled', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const nearPieces = \(\) => \(_near \?\?= \[\.\.\.built\.values\(\)\]/, 'the near list is a lazy memo');
  assert.match(w, /const pieceAt = \(x, z\) => \(_pieceAt \?\?= pieceIndex\(/, 'and so is the index over it');
  assert.doesNotMatch(w, /const near = \[\.\.\.built\.values\(\)\]\.filter/, 'the eager per-frame spread is gone');
});

test('PERF11: the online frame builds the owner list once, not twice', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const ownerIds = \(\) => \{/, 'one lazy memo a frame');
  assert.match(w, /exteriorFoes\.pruneOwners\(ids, now\);/);
  assert.match(w, /camps\.sweepOwners\(ids, now, FOES_STALE_MS\);/);
  assert.doesNotMatch(w, /const near = peersNear\(\); if \(near\)/, 'neither sweep builds its own any more');
});

test('WATER-DRAW1: the draw and the feet ask different questions, and only the draw’s table moved', async () => {
  const { WATER_MASK_TABLE, WATER_DRAW_MASK_TABLE, SHALLOW_DRAWN, SHALLOW_WHOLE, buildWaterMaskTable } = await import('../src/world/waterCorners.js');
  // The LAW's table is byte-for-byte what it was: the player swims where
  // PlayerMotor.OnShallowWaterTile says and nowhere else.
  assert.deepEqual([...WATER_MASK_TABLE], [...buildWaterMaskTable()], 'the feet’s table is the default build');
  for (const r of SHALLOW_DRAWN) {
    assert.equal(WATER_MASK_TABLE[r << 2], 0, `record ${r} is NOT water to DFU's motor, and still is not`);
    assert.equal(WATER_DRAW_MASK_TABLE[r << 2], 0xF, `...but the enhanced pass draws it whole`);
  }
  // and nothing else differs between the two
  const diff = [];
  for (let i = 0; i < 256; i++) if (WATER_MASK_TABLE[i] !== WATER_DRAW_MASK_TABLE[i]) diff.push(i >> 2);
  assert.deepEqual([...new Set(diff)].sort((a, b) => a - b), [...SHALLOW_DRAWN].sort((a, b) => a - b), 'SHALLOW_DRAWN is the whole of the difference');
  // SHALLOW_DRAWN names records neither the shore families nor DFU's list covers
  for (const r of SHALLOW_DRAWN) assert.ok(!SHALLOW_WHOLE.includes(r), `${r} is not already DFU's`);
  // the consumers: the pass and the lab take the draw's, the feet and the town's navigation the law's
  const pass = read('src/render/waterSurface.js');
  assert.match(pass, /table = WATER_DRAW_MASK_TABLE/, 'buildWaterIndices takes the draw’s');
  assert.doesNotMatch(pass.replace(/WATER_DRAW_MASK_TABLE/g, ''), /WATER_MASK_TABLE/, 'and nothing in the pass takes the feet’s');
  assert.match(read('src/render/renderer.js'), /packWaterMask\(WATER_DRAW_MASK_TABLE\)/, 'and so does the shader’s uniform');
  assert.match(read('src/player/exteriorSurface.js'), /import \{ waterCorners, waterCoverage \} from '\.\.\/world\/waterCorners\.js';/, 'the feet keep the default, which is the law’s');
  assert.match(read('src/world/cityNavigation.js'), /WATER_MASK_TABLE\[\(record << 2\) \| t\]/, 'and so does the town’s navigation');
  // the grass asks the EYE's question - a blade in a puddle is a picture
  assert.match(read('src/scenes/world.js'), /if \(waterCorners\(byte, WATER_DRAW_MASK_TABLE\)\) return null;/);
});

test('WATER-DRAW1: the tile probe names the record under the player', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /window\.__tileHere = \(\) => \{/);
  assert.match(w, /record: byte >> 2, transform: byte & 3, byte,/, 'the number a screenshot cannot give');
  assert.match(w, /drawnWet: waterCorners\(byte, WATER_DRAW_MASK_TABLE\), feetWet: waterCorners\(byte\),/, 'and both answers, so the two questions can be told apart');
});
