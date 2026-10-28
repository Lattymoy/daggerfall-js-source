// ZONE-HOMES (2026-10-28; bible/11-Multiplayer/Wild-Zone.md section 29), the owner: "Imperial City houses still cannot
// be purchased". PVPDUNGEONS refused every house in the zone, and the zone is Cyrodiil whole, the Imperial City in its
// heart: the door offered "Buy it" and the press said "No house is for sale". The law (systems/wild/zoneSafe.js
// zoneHouseFree): a house in a settlement's streets is for sale in the zone, as ZONE-SAFE made them peace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zoneHouseFree, ZONE_SAFE_TEXT, SETTLEMENT_TYPES } from '../../../src/systems/wild/zoneSafe.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { locationWorldRect, WORLD_MAP_RMB_DIM } from '../../../src/world/streamingWorld.js';

/** A location of `type` (test/systems/wild/wildcityport.test.js's). */
const place = (type, w = 1, h = 1) => ({ name: 'Somewhere', mapTableData: { locationType: type }, exterior: { exteriorData: { width: w, height: h, blockNames: Array(w * h).fill('TVRNAL01.RMB') } } });
const IN = { x: 2069, y: 658 };

test('ZONE-HOMES THE LAW (zoneSafe.js zoneHouseFree): outside the zone every house; in it a door in a settlement\'s streets, never the open country, a farmstead\'s, an inn\'s, a temple\'s or a manor\'s, nor a press made indoors (mutants: the zone ignored; a settlement refused; the open country free)', () => {
  assert.equal(zoneHouseFree(false, null, new Map()), true, 'outside the zone: Daggerfall\'s law');
  for (const type of Object.values(LOCATION_TYPES)) {
    const loc = place(type, 3, 3), index = new Map([[`${IN.x},${IN.y}`, loc]]);
    const r = locationWorldRect(loc, IN.x, IN.y), mid = [(r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2];
    assert.equal(zoneHouseFree(true, mid, index), SETTLEMENT_TYPES.has(type), `in the zone, in a place of kind ${type}`);
    assert.equal(zoneHouseFree(true, [r.maxX + WORLD_MAP_RMB_DIM + 1, 0, mid[2]], index), false, `kind ${type}: the open country of its own pixel`);
  }
  assert.equal(zoneHouseFree(true, null, new Map([[`${IN.x},${IN.y}`, place(LOCATION_TYPES.TownCity)]])), false, 'no feet (indoors, underground): the zone\'s');
  assert.equal(ZONE_SAFE_TEXT.noHouse, 'In Cyrodiil, houses are for sale only in cities, towns and villages.');
});

test('ZONE-HOMES THE HOSTS: the interior host\'s buy asks the world host\'s seam, and the seam asks the law where I stand outdoors (mutants: the seam\'s old refusal of the whole zone)', () => {
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const modes = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(world, /wildNoHouse: \(\) => \{ if \(zoneHouseFree\(wildHere\(\), wildOutdoors\(\) \? campToWire\(player\.feetAt\(\)\) : null, locationIndex\)\) return false; townTalk\.say\(ZONE_SAFE_TEXT\.noHouse\); return true; \}/);
  assert.match(modes, /async function buyHomeAt\(bd, price\) \{[^]*?if \(host\.wildNoHouse\?\.\(\)\) return;/);
});
