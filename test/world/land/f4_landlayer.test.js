// FOUNDATION F4 (bible/03-World/Foundation-Arc.md): THE LAND AS DATA (world/land/landLayer.js, landEdits.json) - a row of
// pixels made water or land, or given a climate, read alike by every reader of the ground: on the Bay through the game's
// own files as they are served (WOODS.WLD's height and detail, CLIMATE.PAK), past it through the ground's two reads; the
// keys of the caches kept between sessions move with the rows. A pixel past the Bay beside the Bay's. Pins
// mutation-checked (tools/mutants/foundation.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { landRowProblems, landLayerOf, landLayer, setLandLayer, landServedBytes, WATER_LINE, LAND_LEAST } from '../../../src/world/land/landLayer.js';
import { addLandRow } from '../../../tools/landEdit.mjs';
import { tamrielHeightByte, groundClimateIndex, dropGroundCache, tamrielLargeMap } from '../../../src/world/tamriel/tamrielGround.js';
import { isWaterPixel } from '../../../src/ui/overworldModel.js';
import { WATER_BYTE } from '../../../src/world/roadsProducer.js';
import { roadsCacheKey } from '../../../src/world/roadsCache.js';
import { regionKey } from '../../../src/world/tamrielRoads.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';

test('F4 the row: a rectangle of the world\'s pixels, water at the water line and under or land at the shore and over - nothing between, so no two readers of the water disagree - a climate the game knows, and why (mutants: the between bytes kept, the note unasked)', () => {
  assert.deepEqual(landRowProblems({ x: 100, y: 100, height: 0, note: 'a cove' }), []);
  assert.deepEqual(landRowProblems({ x: -900, y: -300, w: 4, h: 2, climate: CLIMATES.Swamp, note: 'past the Bay' }), []);
  for (const height of [WATER_LINE + 1, LAND_LEAST - 1]) assert.deepEqual(landRowProblems({ x: 1, y: 1, height, note: 'n' }), ['height']);
  assert.ok(WATER_LINE * 8 <= 27.2 && LAND_LEAST > WATER_BYTE, 'the bytes between are the readers\' disagreement');
  assert.deepEqual(landRowProblems({ x: 1, y: 1, climate: 99, note: '' }), ['climate', 'note']);
  assert.deepEqual(landRowProblems({ x: 9000, y: 1, height: 0, note: 'n' }), ['pixel']);
  assert.deepEqual(landRowProblems({ x: 1, y: 1, w: 65, height: 0, note: 'n' }), ['size']);
});

test('F4 the layer: later rows win, a pixel\'s height and climate by its world key, the Bay\'s pixels apart, a stamp that moves with the rows and is nothing for none; the game\'s file read whole (mutants: the first row wins, the stamp still)', () => {
  const L = landLayerOf({ edits: [
    { x: 10, y: 10, w: 2, h: 1, height: 0, note: 'a' },
    { x: 11, y: 10, height: 40, climate: CLIMATES.Woodlands, note: 'b' },
    { x: -500, y: -200, climate: CLIMATES.Desert, note: 'c' },
    { x: 1, y: 1, height: 5, note: 'dropped' },
  ] });
  assert.deepEqual([L.heightAt(10, 10), L.heightAt(11, 10), L.climateAt(11, 10), L.climateAt(-500, -200), L.heightAt(-500, -200)], [0, 40, CLIMATES.Woodlands, CLIMATES.Desert, undefined]);
  assert.deepEqual(L.dropped, [3]);
  assert.deepEqual(L.bayPixels().map(([x, y]) => [x, y]), [[10, 10], [11, 10]]);
  assert.equal(landLayerOf({ edits: [] }).stamp, '');
  assert.notEqual(L.stamp, landLayerOf({ edits: [{ x: 10, y: 10, height: 0, note: 'a' }] }).stamp);
  const raw = JSON.parse(readFileSync(new URL('../../../src/world/land/landEdits.json', import.meta.url), 'utf8'));
  assert.equal(raw.version, 1);
  assert.deepEqual(landLayer().dropped, [], 'no row of the game\'s is dropped');
  assert.equal(landLayer().rows.length, raw.edits.length);
});

test('F4 the tool writes a row as data: checked, appended, the file\'s own shape; a bad row refused (mutant: the check skipped)', () => {
  const json = { version: 1, edits: [] };
  const next = addLandRow(json, { x: 3, y: 4, height: 0, note: 'a cove opened' });
  assert.deepEqual(next, { version: 1, edits: [{ x: 3, y: 4, height: 0, note: 'a cove opened' }] });
  assert.equal(json.edits.length, 0, 'the file read is not written over');
  assert.throws(() => addLandRow(json, { x: 3, y: 4, height: 4, note: 'between' }), /height/);
});

test('F4 past the Bay: a row\'s height and climate are the ground\'s - the byte, the large map\'s sea, the climate read - and every water law agrees on it (mutants: the height unread, the climate unread)', () => {
  dropGroundCache();
  let at = null;
  for (let x = 1200; x < 1900 && !at; x += 9) for (let y = -800; y < -100 && !at; y += 9) if (tamrielHeightByte(x, y) >= 20) at = [x, y];   // Skyrim's
  assert.ok(at, 'a land pixel past the Bay');
  const [x, y] = at, bay = () => CLIMATES.Woodlands;
  setLandLayer(landLayerOf({ edits: [{ x, y, height: 0, climate: CLIMATES.Ocean, note: 'a cove past the Bay' }] }));
  dropGroundCache();
  try {
    assert.equal(tamrielHeightByte(x, y), 0);
    assert.ok(tamrielLargeMap(x, y).every((col) => col.every((v) => v === 0)), 'no detail at sea');
    const climate = groundClimateIndex(bay)(x, y);
    assert.equal(climate, CLIMATES.Ocean);
    assert.deepEqual([isWaterPixel(climate, tamrielHeightByte(x, y)), tamrielHeightByte(x, y) <= WATER_BYTE], [true, true]);
    assert.equal(groundClimateIndex(bay)(207, 212), CLIMATES.Woodlands, 'the Bay\'s read the Bay\'s');
  } finally { setLandLayer(); dropGroundCache(); }
  assert.ok(tamrielHeightByte(x, y) >= 20, 'the law\'s again without the row');
});

test('F4 the kept caches\' keys move with the rows - the Bay\'s roads and a region\'s past the Bay - and stand as they were with none (mutants: the land out of a key)', () => {
  const plain = [roadsCacheKey({ settlements: [], woodsLength: 9 }), regionKey({ region: { i: 1, j: 2 }, inputs: 'p' })];
  setLandLayer(landLayerOf({ edits: [{ x: 10, y: 10, height: 0, note: 'a' }] }));
  try {
    const stamp = landLayer().stamp;
    assert.deepEqual([roadsCacheKey({ settlements: [], woodsLength: 9 }), regionKey({ region: { i: 1, j: 2 }, inputs: 'p' })], [`${plain[0]}:land${stamp}`, plain[1].replace('tamriel-roads:1,2:', `tamriel-roads:1,2:land${stamp}:`)]);
  } finally { setLandLayer(); }
  assert.ok(!plain[0].includes('land') && !plain[1].includes('land'));
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'WOODS.WLD')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('F4 with ARENA2, on the Bay: the served WOODS.WLD holds the rows\' heights and a water pixel\'s detail flat, so the terrain kernel stands water there; the served CLIMATE.PAK the rows\' climate, every other pixel the file\'s; one copy a read, the file untouched where no row is (mutants: the detail kept, the climate\'s x, the run lengths)', { skip: skipReal }, async () => {
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { PakFile } = await import('../../../src/formats/pakFile.js');
  const { generateSamples, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION } = await import('../../../src/world/terrain/terrainSampler.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const woodsRaw = bytes('WOODS.WLD'), pakRaw = bytes('CLIMATE.PAK');
  const plain = new WoodsFile(); plain.load(woodsRaw);
  let at = null;
  for (let y = 120; y < 400 && !at; y += 3) for (let x = 120; x < 900 && !at; x += 3) {
    let land = true;
    for (let j = -2; j <= 2 && land; j++) for (let i = -2; i <= 2 && land; i++) land = plain.getHeightMapValue(x + i, y + j) >= 30;
    if (land) at = [x, y];
  }
  assert.ok(at, 'a 5 x 5 of the Bay\'s land');
  const [x, y] = at;
  const L = landLayerOf({ edits: [{ x: x - 2, y: y - 2, w: 5, h: 5, height: 0, climate: CLIMATES.Ocean, note: 'a lake on the Bay' }] });
  assert.equal(landServedBytes('WOODS.WLD', woodsRaw, landLayerOf({ edits: [] })), woodsRaw, 'no row: the file as it came');
  const woodsServed = landServedBytes('WOODS.WLD', woodsRaw, L);
  assert.equal(landServedBytes('WOODS.WLD', woodsRaw, L), woodsServed, 'one copy a read');
  assert.notEqual(woodsServed, woodsRaw);
  const w = new WoodsFile(); w.load(woodsServed);
  assert.equal(w.getHeightMapValue(x, y), 0);
  assert.ok(w.getLargeMapData(x, y).every((col) => col.every((v) => v === 0)));
  assert.equal(w.getHeightMapValue(x + 3, y), plain.getHeightMapValue(x + 3, y), 'a pixel past the rows the file\'s');
  const samples = generateSamples(w, x, y);
  assert.ok(Math.max(...samples) * MAX_TERRAIN_HEIGHT <= SCALED_OCEAN_ELEVATION + 1e-3, 'the kernel stands water across the pixel');
  const p0 = new PakFile(); p0.load(pakRaw);
  const round = new PakFile(); round.load(p0.encode());
  assert.deepEqual(round.buffer, p0.buffer, 'the PAK written back reads the same');
  const p1 = new PakFile(); p1.load(landServedBytes('CLIMATE.PAK', pakRaw, L));
  assert.deepEqual([p1.getValue(x + 3, y), p1.getValue(x - 2, y)], [CLIMATES.Ocean, p0.getValue(x - 2, y)], 'the climate read is +1 x (mapsFile.js getClimateIndex): the row\'s east edge moved, the pixel west of it not');
  let moved = 0;
  for (let i = 0; i < p0.buffer.length; i++) if (p0.buffer[i] !== p1.buffer[i]) moved++;
  assert.ok(moved <= 25 && moved > 0);
  assert.equal(isWaterPixel(p1.getValue(x + 1, y), w.getHeightMapValue(x, y)), true);
});
