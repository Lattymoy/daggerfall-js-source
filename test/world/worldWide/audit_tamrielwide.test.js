// AUDIT TAMRIEL-WIDE (2026-10-28; the owner: "I want to do an audit on anything that could be broken and ensure pur future
// development isnt just Daggerfall anymore and is the entirety of tamriel"). The findings fixed on the integrated head,
// each run on the real code past the Bay beside the Bay's own answer (bible/01-Overview/audits/Audit-Tamriel-Wide.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRaidHost } from '../../../src/scenes/raidHost.js';
import { raidRegionNow, setRaidingPartiesHost } from '../../../src/systems/raidingParties.js';
import { nearRoad } from '../../../src/world/road/roadBand.js';
import { pointNearPath, UNITS_PER_METRE } from '../../../src/world/road/roadClearance.js';
import { setArenaRoads, beyondKey } from '../../../src/world/arenaRoads.js';
import { E, W } from '../../../src/world/road/pathData.js';
import { sdRumor } from '../../../src/systems/superDungeon/sdOmen.js';
import { placeOfRow } from '../../../src/world/worldWide/worldPlaces.js';

test('AUDIT TAMRIEL-WIDE C1: the raid host names the region the player stands in past the Bay - a province\'s politic is its region\'s, as the Bay\'s is - and the sea none, on either side (mutant: the province\'s politic unread)', () => {
  const at = (pol, region, x = 2441, y = -600) => {
    createRaidHost({ maps: { getPoliticIndex: () => pol }, playerTravelPixel: () => ({ x, y }), etherSea: null, _questRegionIndex: () => region });
    return raidRegionNow();
  };
  try {
    assert.equal(at(128 + 64, 64), 64, 'Skyrim: its region, so its raids are told and its row is home');
    assert.equal(at(128 + 70, 70), 70, 'Cyrodiil');
    assert.equal(at(128 + 17, 17, 400, 200), 17, 'a Bay region, as before');
    assert.equal(at(128 + 105, 16, 400, 200), 16, 'the Wrothgarians\' bad politic, as before');
    assert.equal(at(64, 0, 400, 200), -1, 'the Bay\'s sea, as before');
    assert.equal(at(64, 0), -1, 'the sea past the Bay');
    assert.equal(at(128 + 71, 71), -1, 'no region past the provinces');
  } finally { setRaidingPartiesHost(null); }
});

test('AUDIT TAMRIEL-WIDE C2: ROADS-CLEAR past the Bay - a camp on a road there is near it, by the curves\' band, and one a pixel\'s quarter off is not; on the Bay the straight arms\' answer, unchanged (mutant: the Bay\'s clamp answers past it)', () => {
  const bay = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) };
  for (const x of [699, 700, 701]) bay.roads[187 * 1000 + x] = E | W;
  const roads = new Map([[beyondKey(2699, 187), E | W], [beyondKey(2700, 187), E | W], [beyondKey(2701, 187), E | W], [beyondKey(1688, -488), E | W]]);
  setArenaRoads({ roads, tracks: new Map(), join: new Map() });
  try {
    const mid = 16384, r = 10 * UNITS_PER_METRE;
    assert.equal(pointNearPath(bay, 700, 187, mid, mid, r), true, 'the Bay: on the road');
    assert.equal(nearRoad(bay, 700, 187, mid, mid, r), pointNearPath(bay, 700, 187, mid, mid, r), 'the Bay\'s answer is pointNearPath\'s');
    assert.equal(nearRoad(bay, 700, 187, mid, 4096, r), pointNearPath(bay, 700, 187, mid, 4096, r), 'off it too');
    assert.equal(pointNearPath(bay, 2700, 187, mid, mid, r), false, 'the Bay\'s walk never asks past its edge');
    assert.equal(nearRoad(bay, 2700, 187, mid, mid, r), true, 'Skyrim: a camp on the road is near it');
    assert.equal(nearRoad(bay, 1688, -488, mid, mid, r), true, 'and north of the Bay');
    assert.equal(nearRoad(bay, 2700, 187, mid, 4096, r), false, 'a quarter of a pixel off the road is clear');
    assert.equal(nearRoad(bay, 2900, 300, mid, mid, r), false, 'no road there');
    assert.equal(nearRoad(null, 2700, 187, mid, mid, r), false, 'nothing painted yet');
  } finally { setArenaRoads(null); }
});

test('AUDIT TAMRIEL-WIDE C4: a province\'s Hollow is rumoured in its own city\'s taverns - the registry place\'s pixel, not its MapId\'s low bits (0,0) - and the Bay\'s in Daggerfall, as before (mutant: the MapId read again)', () => {
  const now = 1_000_000, rec = { s: 7, ph: 'risen', until: now + 3_600_000, r: 64 };
  const ask = (memo, px, py) => sdRumor(rec, memo, now, { px, py }, { numAnswersGivenTellMeAboutOrRumors: 0, isSpyMaster: false }, { rolls: () => 0 });
  const city = placeOfRow({ px: 1500, py: -200, mapId: 0x30012345, name: 'Solitude', type: 0, w: 8, h: 8 }, 'audit');
  const memo = { s: 7, site: { s: 7, px: 1503, py: -198, city, cityName: 'Solitude', cityRegion: city.region, region: 64 } };
  assert.ok(ask(memo, 1500, -200), 'in Solitude: the rumour');
  assert.equal(ask(memo, 0, 0), null, 'nowhere else - the MapId\'s low bits named (0,0)');
  const bay = { s: 7, site: { city: { name: 'Daggerfall', regionIndex: 17, mapTableData: { mapId: (1 << 20) | (300 * 1000 + 200) } }, cityName: 'Daggerfall' } };
  assert.ok(ask(bay, 200, 300), 'the Bay\'s Hollow in Daggerfall');
  assert.equal(ask(bay, 201, 300), null, 'and only there');
});
