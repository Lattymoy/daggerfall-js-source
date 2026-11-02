// OW-BEYOND-KNOWN (2026-10-28; bible/06-Systems/Travel-View.md), the field: "travel nodes dont exist outside the bay in
// overworld, so you cant click on a town node to travel". The Overworld's plates and far marks are the known places
// (scenes/mapPlacesHost.js tvPlaceSummary) - on the Bay by MAPS.BSA's baked Discovered bit, which every town carries; past
// the Bay by the player's finds alone, so no town there wore one. Now a place past the Bay is known by its kind, as the
// Bay's rows bake it (systems/discovery.js BAKED_KNOWN_TYPES) - a capital by its centre, its streets not (IC-GRAND).
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMapPlaces } from '../../../src/scenes/mapPlacesHost.js';
import { BAKED_KNOWN_TYPES, restoreDiscovery, discoverLocation } from '../../../src/systems/discovery.js';
import { LOCATION_TYPES as T, MapsFile } from '../../../src/formats/mapsFile.js';
import { capitalPlaceId, isCapitalPlaceId } from '../../../src/world/tamrielCapitals.js';
import { countryPlaceId } from '../../../src/world/tamrielCountry.js';
import { resetPastBayPlaces } from '../../../src/world/pastBayPlaces.js';

beforeEach(() => { restoreDiscovery(null); resetPastBayPlaces(); });

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS_MAPS = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const HAS = HAS_MAPS && ['BLOCKS.BSA', 'TAMRIEL2.IMG', 'TMAP00I0.IMG'].every((f) => existsSync(join(ARENA2, f)));
const KINDS = Object.entries(T);

/** A location as the build stands one past the Bay (test/scenes/bayleft_places.test.js's). */
const stoodLoc = (row) => ({ name: row.name, regionIndex: row.region, locationIndex: row.location, mapTableData: { mapId: row.mapId, locationType: row.type }, exterior: { exteriorData: { width: row.w, height: row.h, blockNames: ['TVRNAS01.RMB'] } } });
/** The places host's reads past the Bay over rows by pixel, every stand counted. */
function placesOf(rows) {
  const at = new Map(rows.map((r) => [`${r.px},${r.py}`, r]));
  const index = new Map(), stands = [];
  const pq = {
    rowAt: (px, py) => at.get(`${px},${py}`) ?? null,
    standAt: (px, py) => { stands.push(`${px},${py}`); const r = at.get(`${px},${py}`); if (!r) return null; const loc = stoodLoc(r); index.set(`${px},${py}`, loc); return loc; },
  };
  return { pq, index, stands };
}
const host = (o) => ({ captainLedger: { isCharted: () => false, chartedCount: () => 0 }, etherPlaceClone: () => null, etherSea: false, locationIndex: o.index ?? new Map(), mapDict: new Map(),
  wildActiveNow: () => null, wildHallStand: () => null, provinceQuestPlaces: o.pq ?? null, worldPlaces: o.worldPlaces ?? null, _locIndexGen: 0 });
const row = (type, i, o = {}) => ({ mapId: countryPlaceId(100 + i), name: `Place ${i}`, px: 1600 + i, py: -420, type, region: 64, location: -900 - i, w: 2, h: 2, ...o });

test('OW-BEYOND-KNOWN THE LAW ON THE GAME\'S OWN ROWS: BAKED_KNOWN_TYPES is every kind MAPS.BSA bakes Discovered on every row, and no other - each town, village, farm, manor, home, inn, temple, cult and ship; no dungeon, coven or graveyard (mutants: a kind more; a kind less)', { skip: HAS_MAPS ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)' }, () => {
  const rd = (f) => { const b = readFileSync(join(ARENA2, f)); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); };
  const maps = new MapsFile();
  maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const by = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    for (const m of maps.getRegion(r)?.mapTable ?? []) { const e = by.get(m.locationType) ?? { n: 0, found: 0 }; e.n++; if (m.discovered) e.found++; by.set(m.locationType, e); }
  }
  const everyRow = [...by].filter(([, e]) => e.found === e.n).map(([k]) => k).sort((a, b) => a - b);
  assert.deepEqual([...BAKED_KNOWN_TYPES].sort((a, b) => a - b), everyRow, 'the kinds every row of which is baked found');
  for (const k of [T.DungeonLabyrinth, T.DungeonKeep, T.DungeonRuin, T.Coven]) assert.equal(by.get(k).found, 0, `kind ${k}: no row baked found`);
  assert.ok(by.get(T.Graveyard).found > 0 && by.get(T.Graveyard).found < by.get(T.Graveyard).n, 'a graveyard sometimes: no kind\'s law');
});

test('OW-BEYOND-KNOWN THE SUMMARY (scenes/mapPlacesHost.js tvPlaceSummary): past the Bay every kind the Bay bakes found is known unfound - not standing (its row) and standing (the index\'s) alike, nothing stood to answer; a dungeon\'s kind still found first; a capital known by its centre, its streets not until found (mutants: the row\'s kind unread; the standing place\'s kind unread; every slice its own town)', () => {
  const rows = KINDS.map(([, type], i) => row(type, i));
  const p = placesOf(rows);
  const mp = createMapPlaces(host(p));
  for (const [name, type] of KINDS) {
    const r = rows.find((x) => x.type === type);
    assert.equal(!!mp.tvPlaceSummary(r.px, r.py), BAKED_KNOWN_TYPES.has(type), `${name}, not standing`);
  }
  assert.deepEqual(p.stands, [], 'nothing stood to answer a list');
  const index = new Map(rows.map((r) => [`${r.px},${r.py}`, stoodLoc(r)]));
  const stood = createMapPlaces(host({ index }));
  for (const [name, type] of KINDS) {
    const r = rows.find((x) => x.type === type);
    assert.equal(stood.tvPlaceSummary(r.px, r.py)?.name ?? null, BAKED_KNOWN_TYPES.has(type) ? r.name : null, `${name}, standing`);
  }
  const ruin = rows.find((x) => x.type === T.DungeonRuin);
  discoverLocation(ruin.mapId, {});
  assert.equal(mp.tvPlaceSummary(ruin.px, ruin.py)?.name, ruin.name, 'a dungeon found: known');
  // IC-GRAND: a capital is one town - its centre slice (capitalPlaceId's ordinal 0) known, a street of it not
  const centre = row(T.TownCity, 40, { mapId: capitalPlaceId(0, 0), name: 'Imperial City' }), street = row(T.TownCity, 41, { mapId: capitalPlaceId(0, 3), name: 'Market District' });
  const c = createMapPlaces(host(placesOf([centre, street])));
  assert.deepEqual([c.tvPlaceSummary(centre.px, centre.py)?.name ?? null, c.tvPlaceSummary(street.px, street.py)?.name ?? null], ['Imperial City', null], 'the centre known, its street not');
  discoverLocation(street.mapId, {});
  assert.equal(c.tvPlaceSummary(street.px, street.py)?.name, 'Market District', 'a street found: known, as before');
  assert.deepEqual(c.junctionPlaceAt(centre.px, centre.py), { locationType: T.TownCity, mapId: centre.mapId, discovered: true }, 'the junction map\'s dot too');
});

let _world = null;
const standWorld = async () => (_world ??= await (await import('../quest/r25World.mjs')).standWorldPastBay(ARENA2));

test('OW-BEYOND-KNOWN on the player\'s data: about a village of Skyrim, nothing found, the Overworld\'s grid wears its places\' plates and its edge the far settlements - none stood; about the Imperial City\'s centre one plate, the city\'s, never its streets\'', { skip: HAS ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)' }, async () => {
  const world = await standWorld();
  const pq = world.places.provinceQuestPlaces;
  pq.refresh();
  const { inBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { farPlaces, TV_FAR_TYPES, TV_FAR_RANGE } = await import('../../../src/systems/travel/travelFarPlaces.js');
  const { addPastBayPlaces } = await import('../../../src/world/pastBayPlaces.js');
  const mp = createMapPlaces(host({ index: world.locationIndex, pq, worldPlaces: world.worldPlaces }));
  /** The plates of world.js travelViewPlaces: the known places of the grid about `at`, its radius three. */
  const plates = (at) => { const out = []; for (let y = at.y - 3; y <= at.y + 3; y++) for (let x = at.x - 3; x <= at.x + 3; x++) { const s = mp.tvPlaceSummary(x, y); if (s) out.push(s); } return out; };
  const village = world.worldPlaces.all().filter((r) => !inBay(r.px, r.py) && r.region === 64 && r.type === T.TownVillage)[3];
  const at = { x: village.px, y: village.py };
  addPastBayPlaces(pq.countryNear(at.x, at.y, TV_FAR_RANGE).map((r) => ({ x: r.px, y: r.py, type: r.type })));   // the countryside its roads' regions laid
  const before = world.locationIndex.size;
  const near = plates(at);
  assert.ok(near.some((s) => s.mapId === village.mapId >>> 0 && s.name === village.name), `the village's own plate (${near.map((s) => s.name).join(', ')})`);
  assert.ok(near.every((s) => BAKED_KNOWN_TYPES.has(s.locationType)), 'each a kind the Bay bakes found');
  const far = farPlaces({ at, near: 3, settlements: mp.tvFarSettlements(at), summaryOf: mp.tvPlaceSummary });
  assert.ok(far.length > 0 && far.every((f) => TV_FAR_TYPES.has(f.summary.locationType)), `the edge's settlements, none found (${far.length})`);
  assert.equal(world.locationIndex.size, before, 'none stood');
  const ic = world.worldPlaces.all().find((r) => r.mapId >>> 0 === capitalPlaceId(0, 0));
  const city = plates({ x: ic.px, y: ic.py }).filter((s) => isCapitalPlaceId(s.mapId));
  assert.deepEqual(city.map((s) => s.name), ['Imperial City'], 'one plate for the city - its 48 streets about it none');
});
