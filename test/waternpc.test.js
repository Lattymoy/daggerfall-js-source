// WATER-NPC - THE WANDERING NPCs LEARN THE WHOLE WATER FAMILY (2026-09-15).
//
// Mac, from live play: "NPCs arent water aware and will walk into it".
//
// THE PORT IS VERBATIM, AND THAT IS THE PROBLEM. DFU's `GetTileWeight`
// (CityNavigation.cs) gives weight 0 - "never try to walk" - to seven
// records, because its `TileTypes` enum knows Water plus TWO edges per
// family: WaterDirtEdge1/2, WaterGrassEdge1/2, WaterStoneEdge1/2. The
// port copies it character for character. But each shore family has
// FOUR members - corner, edge, three-corner, saddle - and the enum has
// the first two. The shallow-whole records are absent as well.
//
// DFU DISAGREES WITH ITSELF ABOUT THIS, which is the tell.
// `PlayerMotor.OnShallowWaterTile` (:551-563) counts 5, 6, 8, 20, 21,
// 23, 30, 31, 33-36 and 49 as water the player wades in. Six of those
// records are not in the navgrid's enum, so DFU itself has the player
// wading where its own townsfolk walk dry-shod.
//
// Twelve records are water to the draw and dry land to the pathing:
//   7, 8, 22, 23, 32, 33, 34, 35, 36, 48, 49, 50
//
// SO THIS IS AN ENHANCED-LANE DEPARTURE, NOT A PORT FIX, and it is
// gated as one. The classic lane keeps DFU's seven exactly. The enhanced
// arm asks the port's OWN water table - the one `render/waterSurface.js`
// draws from and `player/exteriorSurface.js` swims the player by - so
// the pathing cannot disagree with the picture or the physics, which is
// MAC2's principle carried one seam further.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tileWeight, WATER_RECORDS_CLASSIC, WATER_RECORDS_ENHANCED, CityNavigation } from '../src/world/cityNavigation.js';
import { WATER_MASK_TABLE } from '../src/world/waterCorners.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WATER-NPC: the classic lane is still DFU\'s seven, exactly', () => {
  // The departure must not cost the port its 1:1 default. Every record
  // outside DFU's own enum keeps the weight DFU gives it.
  assert.deepEqual([...WATER_RECORDS_CLASSIC], [0, 5, 6, 20, 21, 30, 31],
    'CityNavigation.cs TileTypes: Water, and Edge1/Edge2 of the three families');
  for (const r of WATER_RECORDS_CLASSIC) assert.equal(tileWeight(r), 0, `record ${r} is DFU's own never-walk`);
  assert.equal(tileWeight(3), 4, 'Stone hurts our feet, but walkable');
  assert.equal(tileWeight(1), 6, 'Dirt is OK');
  assert.equal(tileWeight(2), 12, 'Grass is nice!');
  for (const r of [46, 47, 55]) assert.equal(tileWeight(r), 15, 'Roads are great!');
  // ...and the twelve the enum never learned are STILL average here.
  for (const r of [7, 8, 22, 23, 32, 33, 34, 35, 36, 48, 49, 50]) {
    assert.equal(tileWeight(r), 7, `record ${r} keeps DFU's "everything else is average" in the classic lane`);
  }
});

test('WATER-NPC: the enhanced family is DERIVED from the water table, not typed out', () => {
  // A hand-written second list would be the enumeration this whole
  // program removes - and it is the shape that produced the gap in the
  // first place. The family is read off the table the draw uses.
  const derived = [];
  for (let record = 0; record < 64; record++) {
    let any = 0;
    for (let t = 0; t < 4; t++) any |= WATER_MASK_TABLE[(record << 2) | t];
    if (any) derived.push(record);
  }
  assert.deepEqual([...WATER_RECORDS_ENHANCED], derived,
    'the enhanced water family must BE the water table\'s records - if these can differ, the pathing can disagree with the draw');
  // the twelve DFU walks on
  for (const r of [7, 8, 22, 23, 32, 33, 34, 35, 36, 48, 49, 50]) {
    assert.ok(WATER_RECORDS_ENHANCED.includes(r), `record ${r} is water to the draw`);
    assert.equal(tileWeight(r, { enhancedWater: true }), 0, `...so an NPC must not walk record ${r}`);
    assert.equal(tileWeight(r), 7, '...and the classic lane is untouched');
  }
  // and nothing DRY became impassable
  for (const [r, w] of [[1, 6], [2, 12], [3, 4], [46, 15], [47, 15], [55, 15], [9, 7]]) {
    assert.equal(tileWeight(r, { enhancedWater: true }), w, `record ${r} is dry land in both lanes`);
  }
});

test('WATER-NPC: DFU\'s own PlayerMotor contradicts its own navgrid - the six records', () => {
  // The evidence the departure rests on, kept where it can be re-read.
  // If DFU's shallow-water list is ever ported differently, this says so.
  const SHALLOW = [5, 6, 8, 20, 21, 23, 30, 31, 33, 34, 35, 36, 49];   // PlayerMotor.cs:551-563
  const walkedByNpcs = SHALLOW.filter((r) => !WATER_RECORDS_CLASSIC.includes(r));
  assert.deepEqual(walkedByNpcs, [8, 23, 33, 34, 35, 36, 49],
    'these are water to DFU\'s player and dry land to DFU\'s townsfolk');
  for (const r of walkedByNpcs) {
    assert.equal(tileWeight(r, { enhancedWater: true }), 0, `the enhanced lane closes record ${r}`);
  }
});

test('WATER-NPC: the navgrid carries the switch through, and both hosts pass it', () => {
  const nav = new CityNavigation(1, 1);
  const autoMap = new Uint8Array(64 * 64);             // nothing covered
  const allShallow = () => ({ textureRecord: 33 });    // a shallow-whole water tile
  nav.setBlockData(0, 0, autoMap, () => allShallow().textureRecord, { enhancedWater: true });
  assert.equal(nav.weightAt(10, 10), 0, 'an enhanced-lane navgrid gives shallow water weight 0');

  const classic = new CityNavigation(1, 1);
  classic.setBlockData(0, 0, autoMap, () => allShallow().textureRecord);
  assert.equal(classic.weightAt(10, 10), 7, '...and the classic lane still walks it, as DFU does');

  // both hosts ask the ONE switch (render/waterSurface.js waterSwitchOn),
  // so the pathing and the draw can never be on opposite settings.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(host), /setBlockData\([\s\S]{0,200}?\{ enhancedWater: waterSwitchOn\(\) \}\)/,
      `${host} must pass the same switch the water surface reads`);
  }
});
