// FOUNDATION F4 (bible/03-World/Foundation-Arc.md): THE LAND AS DATA (world/land/landLayer.js, landEdits.json) - a row of
// pixels made water or land, or given a climate, read alike by every reader of the ground: on the Bay through the game's
// own files as they are served (WOODS.WLD's height and detail, CLIMATE.PAK), past it through the ground's two reads; the
// keys of the caches kept between sessions move with the rows. A pixel past the Bay beside the Bay's. Pins
// mutation-checked (tools/mutants/foundation.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { landRowProblems, landLayerOf, landLayer, setLandLayer, landServedBytes, filedClimate, filedHeight, WATER_LINE, LAND_LEAST, LAND_SEAM_REACH } from '../../../src/world/land/landLayer.js';
import { addLandRow } from '../../../tools/landEdit.mjs';
import { tamrielHeightByte, groundClimateIndex, groundAirClimateIndex, feltClimateIndex, dropGroundCache, tamrielLargeMap, tamrielClimateAt, groundWoods, largeOfByte, SEAM_PX, BLEND_PX } from '../../../src/world/tamriel/tamrielGround.js';
import { capLineOfPixel, SNOWCAP } from '../../../src/world/peaks/snowcap.js';
import { ETHER_BOX } from '../../../src/world/ethericSea.js';
import { isWaterPixel } from '../../../src/ui/overworldModel.js';
import { WATER_BYTE } from '../../../src/world/roadsProducer.js';
import { roadsCacheKey } from '../../../src/world/roadsCache.js';
import { regionKey } from '../../../src/world/tamrielRoads.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';

test('F4 the row: a rectangle of the world\'s pixels, water at 0 or land at the shore and over with a land climate - nothing between, and none in the seam band past the Bay\'s edge nor the Eltheric Ocean\'s box - so no two readers of the water disagree, and why (mutants: the between bytes kept, the note unasked, the land climate unasked, the seam unread, the box unread)', () => {
  assert.deepEqual(landRowProblems({ x: 100, y: 100, height: 0, note: 'a cove' }), []);
  assert.deepEqual(landRowProblems({ x: -900, y: -300, w: 4, h: 2, climate: CLIMATES.Swamp, note: 'past the Bay' }), []);
  for (const height of [1, WATER_LINE, WATER_LINE + 1, LAND_LEAST - 1]) assert.deepEqual(landRowProblems({ x: 1, y: 1, height, note: 'n' }), ['height'], `${height}`);
  assert.ok(WATER_LINE * 8 <= 27.2 && LAND_LEAST > WATER_BYTE, 'the bytes between are the readers\' disagreement');
  // AUDIT FOUNDATION L3: a land row names its land climate, and the Ocean is water's alone - a height alone over the sea
  // stood land under the Ocean's climate, water to every reader of the climate
  assert.deepEqual(landRowProblems({ x: 1, y: 1, height: 40, note: 'n' }), ['land-climate']);
  assert.deepEqual(landRowProblems({ x: 1, y: 1, height: 40, climate: CLIMATES.Ocean, note: 'n' }), ['land-climate']);
  assert.deepEqual(landRowProblems({ x: 1, y: 1, climate: CLIMATES.Ocean, note: 'n' }), ['land-climate']);
  assert.deepEqual(landRowProblems({ x: 1, y: 1, height: 40, climate: CLIMATES.Woodlands, note: 'n' }), []);
  // AUDIT FOUNDATION L2: the band past the Bay's edge is the Bay's ground, then blended - a row there is refused
  assert.equal(LAND_SEAM_REACH, SEAM_PX + BLEND_PX);
  for (const r of [{ x: -5, y: 100 }, { x: 990, y: 100, w: 20 }, { x: 500, y: 499 + LAND_SEAM_REACH }]) assert.deepEqual(landRowProblems({ ...r, height: 0, note: 'n' }), ['seam'], JSON.stringify(r));
  assert.deepEqual(landRowProblems({ x: -1 - LAND_SEAM_REACH, y: 100, height: 0, note: 'n' }), [], 'just past the band');
  // AUDIT FOUNDATION II L3: the Eltheric Ocean's box answers its own ground (ethericSea.js etherWoods) - a row there read
  // land to the roads and sea to the world
  assert.deepEqual(landRowProblems({ x: 500, y: -5000, height: 40, climate: CLIMATES.Woodlands, note: 'n' }), ['ether']);
  assert.deepEqual(landRowProblems({ x: ETHER_BOX.x0 - 64 - 3, y: -5000, w: 3, height: 0, note: 'n' }), [], 'just west of the box');
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
  setLandLayer(landLayerOf({ edits: [{ x, y, height: 0, climate: CLIMATES.Ocean, note: 'a cove past the Bay' }, { x: x + 20, y, climate: CLIMATES.Desert, note: 'a dry patch' }] }));
  dropGroundCache();
  try {
    // AUDIT FOUNDATION L5: the climate law itself reads the row - the landforms, the far ring and the gates call it
    assert.deepEqual([tamrielClimateAt(x + 20, y), groundClimateIndex(bay)(x + 20, y)], [CLIMATES.Desert, CLIMATES.Desert]);
    assert.equal(tamrielHeightByte(x, y), 0);
    assert.ok(tamrielLargeMap(x, y).every((col) => col.every((v) => v === 0)), 'no detail at sea');
    const climate = groundClimateIndex(bay)(x, y);
    assert.equal(climate, CLIMATES.Ocean);
    assert.deepEqual([isWaterPixel(climate, tamrielHeightByte(x, y)), tamrielHeightByte(x, y) <= WATER_BYTE], [true, true]);
    assert.equal(groundClimateIndex(bay)(207, 212), CLIMATES.Woodlands, 'the Bay\'s read the Bay\'s');
  } finally { setLandLayer(); dropGroundCache(); }
  assert.ok(tamrielHeightByte(x, y) >= 20, 'the law\'s again without the row');
});

test('F4 past the Bay a row\'s climate is the pixel\'s air and its snow line too - Morrowind\'s Velothi foothills made woodland neither feel nor snow as the mountain under its zone\'s air did (AUDIT FOUNDATION II L4; mutants: the air unread, the felt unread, the line unread)', () => {
  const x = 2973, y = 157, bay = () => CLIMATES.Woodlands;
  dropGroundCache();
  const was = [groundAirClimateIndex(bay)(x, y), feltClimateIndex(x, y, tamrielClimateAt(x, y)), capLineOfPixel(x, y, tamrielClimateAt)];
  assert.deepEqual([tamrielClimateAt(x, y), was[0], was[1]], [CLIMATES.Mountain, CLIMATES.Subtropical, CLIMATES.Subtropical], 'a mountain under its zone\'s own air');
  setLandLayer(landLayerOf({ edits: [{ x, y, climate: CLIMATES.Woodlands, note: 'a green hollow in the foothills' }] }));
  dropGroundCache();
  try {
    assert.deepEqual([groundAirClimateIndex(bay)(x, y), feltClimateIndex(x, y, tamrielClimateAt(x, y)), capLineOfPixel(x, y, tamrielClimateAt)], [CLIMATES.Woodlands, CLIMATES.Woodlands, SNOWCAP.climates[CLIMATES.Woodlands]]);
    assert.deepEqual([groundAirClimateIndex(bay)(x + 1, y), capLineOfPixel(x + 1, y, tamrielClimateAt)], [was[0], was[2]], 'the pixel beside it its zone\'s');
  } finally { setLandLayer(); dropGroundCache(); }
  assert.deepEqual([groundAirClimateIndex(bay)(x, y), feltClimateIndex(x, y, tamrielClimateAt(x, y)), capLineOfPixel(x, y, tamrielClimateAt)], was);
});

test('F4 the kept caches\' keys move with the rows - the Bay\'s roads and a region\'s past the Bay - and stand as they were with none (mutants: the land out of a key)', () => {
  const plain = [roadsCacheKey({ settlements: [], woodsLength: 9 }), regionKey({ region: { i: 1, j: 2 }, inputs: 'p' })];
  setLandLayer(landLayerOf({ edits: [{ x: 10, y: 10, height: 0, note: 'a' }] }));
  try {
    const stamp = landLayer().stamp;
    assert.deepEqual([roadsCacheKey({ settlements: [], woodsLength: 9 }), regionKey({ region: { i: 1, j: 2 }, inputs: 'p' })], [`${plain[0]}:land${stamp}`, plain[1].replace('tamriel-roads:1,2:', `tamriel-roads:1,2:land${stamp}:`)]);
  } finally { setLandLayer(); }
  assert.ok(!plain[0].includes('land') && !plain[1].includes('land'));
  // AUDIT FOUNDATION II L6: and the kept regions' ground print past the Bay (tamrielRoadsHost.js)
  assert.ok(readFileSync(new URL('../../../src/scenes/tamrielRoadsHost.js', import.meta.url), 'utf8').includes("|${landLayer().stamp ? `l${landLayer().stamp}|` : ''}${fit ?"));
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
  // AUDIT FOUNDATION L1: past the Bay the composed ground (tamrielGround.js groundWoods, the world's reader) stands a
  // water row as water too - the kernel's samples under the ocean's line across its middle pixel
  let far = null;
  for (let fx = 1200; fx < 1900 && !far; fx += 9) for (let fy = -800; fy < -100 && !far; fy += 9) if (tamrielHeightByte(fx, fy) >= 20) far = [fx, fy];
  setLandLayer(landLayerOf({ edits: [{ x: far[0] - 2, y: far[1] - 2, w: 5, h: 5, height: 0, climate: CLIMATES.Ocean, note: 'a lake past the Bay' }] }));
  dropGroundCache();
  try {
    const ground = groundWoods(plain);
    assert.equal(ground.getHeightMapValue(far[0], far[1]), 0);
    assert.ok(Math.max(...generateSamples(ground, far[0], far[1])) * MAX_TERRAIN_HEIGHT <= SCALED_OCEAN_ELEVATION + 1e-3, 'the kernel stands water past the Bay');
  } finally { setLandLayer(); dropGroundCache(); }
});

test('F4 with ARENA2, on the Bay: a land row\'s 5 x 5 is the file\'s own law for its height, so the kernel stands it where the map draws it; and the Bay as the files hold it stays read under the rows - the fit to the picture and the countryside\'s rates read that, so a row moves no place past the Bay (AUDIT FOUNDATION II L1/L2; mutants: the detail kept, the file unkept, the fit\'s and the rates\' Bay served)', { skip: skipReal }, async () => {
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { PakFile } = await import('../../../src/formats/pakFile.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const woodsRaw = bytes('WOODS.WLD'), pakRaw = bytes('CLIMATE.PAK');
  const plain = new WoodsFile(); plain.load(woodsRaw);
  const p0 = new PakFile(); p0.load(pakRaw);
  let at = null;
  for (let y = 20; y < 480 && !at; y += 2) for (let x = 20; x < 980 && !at; x += 2) if (plain.getHeightMapValue(x, y) >= 100) at = [x, y];
  assert.ok(at, 'a mountain pixel of the Bay');
  const [x, y] = at;
  setLandLayer(landLayerOf({ edits: [{ x, y, height: 10, climate: CLIMATES.Desert, note: 'a mountain let down' }] }));
  try {
    const w = new WoodsFile(); w.load(landServedBytes('WOODS.WLD', woodsRaw));
    const p1 = new PakFile(); p1.load(landServedBytes('CLIMATE.PAK', pakRaw));
    assert.equal(w.getHeightMapValue(x, y), 10);
    assert.ok(w.getLargeMapData(x, y).every((col) => col.every((v) => v === Math.round(largeOfByte(10)))), 'the detail the law\'s for byte 10, not the mountain\'s');
    assert.deepEqual(w.getLargeMapData(x + 1, y), plain.getLargeMapData(x + 1, y), 'the pixel beside it the file\'s');
    assert.deepEqual([filedHeight(x, y, w.getHeightMapValue(x, y)), filedClimate(x, y, p1.getValue(x + 1, y))], [plain.getHeightMapValue(x, y), p0.getValue(x + 1, y)], 'the files as they came');
    assert.deepEqual([filedHeight(x + 1, y, 77), filedClimate(x + 1, y, 77)], [77, 77], 'a pixel no row names: the reader\'s own');
  } finally { setLandLayer(); }
  assert.equal(filedHeight(x, y, 10), 10, 'no row: the reader\'s own');
  const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
  assert.ok(src('src/scenes/world.js').includes('keptBayFit({ bayLand: (x, y) => !isWaterPixel(filedClimate(x, y, maps.getClimateIndex(x, y)), filedHeight(x, y, woods.getHeightMapValue(x, y))), trace })'));
  assert.ok(src('src/scenes/world.js').includes('countryCounts(_countryTemplates, (x, y) => filedClimate(x, y, maps.getClimateIndex(x, y)))'));
  assert.ok(src('src/scenes/world.js').includes('countryCounts(_lairTemplates, (x, y) => filedClimate(x, y, maps.getClimateIndex(x, y)))'));
  assert.ok(src('src/scenes/tamrielPlacesHost.js').includes('bayLand((x, y) => filedClimate(x, y, maps.getClimateIndex(x, y)), (x, y, c) => isWaterPixel(c, filedHeight(x, y, host.woods.getHeightMapValue(x, y))))'));
});
