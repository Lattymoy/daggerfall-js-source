// WILD-CITY-PORT (2026-10-28; bible/11-Multiplayer/Wild-Zone.md section 26), the owner, on the field's "people can't
// teleport to IC": "Even with the open pvp, players should be able to teleport in and out of the cities". The law
// (systems/wild/zoneSafe.js zonePortFree): a teleport passes the zone where each end is none, outside it, or a
// settlement's - ZONE-SAFE's every settlement. The host's doors: test/systems/portalbay_stone.test.js; the map's press:
// test/ui/audittesa2m_window.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonePortFree, SETTLEMENT_TYPES } from '../../../src/systems/wild/zoneSafe.js';
import { buildWildMask } from '../../../src/systems/wild/wildZone.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { locationWorldRect, WORLD_MAP_RMB_DIM } from '../../../src/world/streamingWorld.js';

/** A location of `type` whose footprint is `w` x `h` city blocks (test/systems/wild/zonesafe.test.js's). */
const place = (type, w = 1, h = 1) => ({ name: 'Somewhere', mapTableData: { locationType: type }, exterior: { exteriorData: { width: w, height: h, blockNames: Array(w * h).fill('TVRNAL01.RMB') } } });
/** Cyrodiil's heart in a zone of its own, and two pixels of the Bay. */
const IN = { x: 2069, y: 658 }, BAY = { x: 207, y: 213 }, BAY2 = { x: 300, y: 300 };
const mask = buildWildMask({ width: 40, height: 40, ox: IN.x - 20, oy: IN.y - 20, inZone: () => true });
const none = () => null;

test('WILD-CITY-PORT THE LAW (zoneSafe.js zonePortFree): each end none, outside the zone or a settlement\'s - the end it lands at the place its pixel stands, of a city\'s, a town\'s or a village\'s kind; where I stand its streets outdoors (settledAt), a building of one indoors, never a dungeon (mutants: the city end refused; the end I stand at refused; a dungeon free; the streets a pixel)', () => {
  assert.equal(zonePortFree(mask, BAY, BAY2, null, 'exterior', new Map(), none), true, 'outside to outside: the zone not asked');
  assert.equal(zonePortFree(mask, null, null, null, 'exterior', new Map(), none), true, 'nothing to say where: no end in the zone');
  // THE END IT LANDS AT: every kind the game has, a settlement's alone
  for (const type of Object.values(LOCATION_TYPES)) {
    assert.equal(zonePortFree(mask, BAY, IN, null, 'exterior', new Map(), () => place(type)), SETTLEMENT_TYPES.has(type), `to a place of kind ${type}`);
  }
  assert.equal(zonePortFree(mask, BAY, IN, null, 'exterior', new Map(), none), false, 'to the zone\'s land: none stands');
  assert.equal(zonePortFree(mask, BAY, IN, null, 'exterior', new Map(), () => ({ mapTableData: { locationType: LOCATION_TYPES.TownCity } })), false, 'a city with no exterior is no settlement (isSettlement)');
  // WHERE I STAND, outdoors: a settlement's streets - its footprint widened a block - and not the open country of its own pixel
  const town = place(LOCATION_TYPES.TownVillage), index = new Map([[`${IN.x},${IN.y}`, town]]), at = () => town;
  const r = locationWorldRect(town, IN.x, IN.y), z = (r.minZ + r.maxZ) / 2;
  assert.equal(zonePortFree(mask, IN, BAY, [(r.minX + r.maxX) / 2, 0, z], 'exterior', index, at), true, 'from the streets, out of the zone');
  assert.equal(zonePortFree(mask, IN, BAY, [r.maxX + WORLD_MAP_RMB_DIM - 1, 0, z], 'exterior', index, at), true, 'a block past its footprint: its streets still');
  assert.equal(zonePortFree(mask, IN, BAY, [r.maxX + WORLD_MAP_RMB_DIM + 1, 0, z], 'exterior', index, at), false, 'past the block: the open country, on the village\'s own pixel');
  assert.equal(zonePortFree(mask, IN, IN, [(r.minX + r.maxX) / 2, 0, z], 'exterior', index, at), true, 'from its streets to a settlement in the zone');
  assert.equal(zonePortFree(mask, IN, IN, [(r.minX + r.maxX) / 2, 0, z], 'exterior', index, none), false, 'nor to the zone\'s land from them');
  assert.equal(zonePortFree(mask, IN, null, [(r.minX + r.maxX) / 2, 0, z], 'exterior', index, at), true, 'the door (no end yet), in the streets');
  assert.equal(zonePortFree(mask, IN, null, [r.maxX + WORLD_MAP_RMB_DIM + 1, 0, z], 'exterior', index, at), false, 'the door, in the open country');
  // indoors: a building of a settlement; a farmstead's, an inn's or a temple's no settlement's; a dungeon the zone's
  assert.equal(zonePortFree(mask, IN, BAY, null, 'interior', new Map(), at), true, 'from a building of the village');
  for (const type of [LOCATION_TYPES.HomeFarms, LOCATION_TYPES.Tavern, LOCATION_TYPES.ReligionTemple, LOCATION_TYPES.HomeWealthy]) {
    assert.equal(zonePortFree(mask, IN, BAY, null, 'interior', new Map(), () => place(type)), false, `from a building of a place of kind ${type}`);
  }
  assert.equal(zonePortFree(mask, IN, BAY, null, 'dungeon', new Map(), at), false, 'from a dungeon under the village: the zone\'s');
});
