// AUDIT RELEASE R2 - THE EXCLUSIONS AND GAPS (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md; the owner: "Take
// care of exclusions and gaps"): what lane R2 recorded past the Bay, closed - R2-6 a vampire's crypt in a province. Each
// pin fails on the head before its fix, and on its mutants (tools/mutants/auditrelease_r2_gaps.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { theatreAt, districtOf, DISTRICT_PX, WORLD_PIXEL_SPAN } from '../../../src/world/worldWide/worldGrid.js';
import { cemeteryPastBay, nearestBayCemetery, isCemeteryPlace } from '../../../src/world/worldWide/worldCemetery.js';
import { vampireCryptPixel } from '../../../src/scenes/vampireCrypt.js';
import { DUNGEON_TYPES, LOCATION_TYPES, mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { validStaffEvent, staffEventFault, validStaffEventIn, STAFF_EVENT_PIXEL_BOUND, staffTownPixelOk, isAreaEvent } from '../../../src/net/staffEvent/staffEventLaw.js';
import { WORLD_PIXEL_BOUND, parseClient, worldRoom } from '../../../src/net/wire.js';
import { staffPlaces, staffHere, gamePlaces, keptPlaces } from '../../../src/net/staffPlaces.js';
import { staffRaidHere, staffEventBook } from '../../../src/systems/staffEvents.js';
import { theatreOfRegion, REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { codeOnly } from '../../codeOnly.mjs';

setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the suite

const at = (name) => { const c = CITIES.find((x) => x.name === name); const [x, y] = pictureToBay(c.at[0], c.at[1]).map(Math.floor); return { x, y }; };
const WHITERUN = at('Whiterun');

/** A lairs' pixel provider over a table of rows (the shape scenes/tamrielPlacesHost.js lairRow hands the registry). */
function lairs(rows) {
  const places = createWorldPlaces();
  const by = new Map(rows.map((r) => [`${r.px},${r.py}`, r]));
  places.registerPixels('lairs', (px, py) => by.get(`${px},${py}`) ?? null);
  return places;
}
const lair = (mapId, px, py, dungeonType = DUNGEON_TYPES.Cemetery) => ({ mapId, name: `Lair ${mapId}`, px, py, type: dungeonType === DUNGEON_TYPES.Cemetery ? LOCATION_TYPES.Graveyard : LOCATION_TYPES.DungeonRuin, dungeonType, hasDungeon: true });

test('R2-6 the probe: Whiterun stands in Skyrim past the Bay, its district\'s neighbours too', () => {
  assert.ok(theatreAt(WHITERUN.x, WHITERUN.y) > 0);
  for (const [dx, dy] of [[3, 0], [-3, 2], [DISTRICT_PX, 0]]) assert.equal(theatreAt(WHITERUN.x + dx, WHITERUN.y + dy), theatreAt(WHITERUN.x, WHITERUN.y), `${dx},${dy}`);
});

test('R2-6 a vampire turned past the Bay wakes in a cemetery of the province: DFU\'s draw over its area\'s (WW1\'s district, a Bay region\'s size) cemeteries in map-id order, never a lair of another kind; none there, the nearest of the districts about it; none at all, the nearest of the Bay\'s own - never skipped (mutants: the draw unordered, a ruin taken, the neighbours unasked, the Bay\'s fallback unasked, the Bay\'s rule past the Bay)', () => {
  const [cx] = districtOf(WHITERUN.x, WHITERUN.y);
  const inOwn = (dx) => districtOf(WHITERUN.x + dx, WHITERUN.y)[0] === cx;
  // two cemeteries in the player's district (the lower map id further away), a nearer ruin
  const dxs = [2, -3, 1].filter(inOwn).length === 3 ? [2, -3, 1] : [-2, -3, -1];
  const own = lairs([lair(9002, WHITERUN.x + dxs[0], WHITERUN.y), lair(9001, WHITERUN.x + dxs[1], WHITERUN.y + 1), lair(9000, WHITERUN.x + dxs[2], WHITERUN.y, DUNGEON_TYPES.RuinedCastle)]);
  assert.deepEqual(cemeteryPastBay(own, WHITERUN.x, WHITERUN.y, () => 0)?.mapId, 9001, 'the draw\'s floor: the first in map-id order');
  assert.deepEqual(cemeteryPastBay(own, WHITERUN.x, WHITERUN.y, () => 0.99)?.mapId, 9002, 'its ceiling: the last');
  assert.deepEqual(cemeteryPastBay(own, WHITERUN.x, WHITERUN.y, () => 0), { px: WHITERUN.x + dxs[1], py: WHITERUN.y + 1, mapId: 9001, name: 'Lair 9001' });
  // none in the district: the nearest of the districts about it, the province's
  const nx = (cx + 1) * DISTRICT_PX - WORLD_PIXEL_SPAN + 5, fx = (cx + 1) * DISTRICT_PX - WORLD_PIXEL_SPAN + 40;   // the district east of it
  const near = lairs([lair(9105, fx, WHITERUN.y), lair(9104, nx, WHITERUN.y), lair(9100, WHITERUN.x, WHITERUN.y + 1, DUNGEON_TYPES.RuinedCastle)]);
  assert.equal(theatreAt(nx, WHITERUN.y), theatreAt(WHITERUN.x, WHITERUN.y), 'the neighbour is Skyrim too');
  assert.equal(cemeteryPastBay(near, WHITERUN.x, WHITERUN.y, () => 0)?.mapId, 9104, 'the nearest of the neighbours');
  // no lair at all: the nearest of the Bay's own, any region's
  const bayRow = (mapId, x, y, dungeonType = DUNGEON_TYPES.Cemetery) => { const l = mapPixelToLongitudeLatitude(x, y); return { mapId, dungeonType, longitude: l.x, latitude: l.y }; };
  const maps = { regionCount: 2, getRegion: (r) => (r === 0 ? { mapTable: [bayRow(1, 900, 40), bayRow(2, 990, 10, DUNGEON_TYPES.Crypt)], mapNames: ['Far', 'Crypt'] } : { mapTable: [bayRow(3, 100, 400)], mapNames: ['Other'] }) };
  assert.equal(cemeteryPastBay(lairs([]), WHITERUN.x, WHITERUN.y), null);
  assert.deepEqual(nearestBayCemetery(maps, WHITERUN.x, WHITERUN.y), { px: 900, py: 40, mapId: 1, name: 'Far' }, 'the nearest Bay cemetery, not the nearer crypt');
  assert.deepEqual(vampireCryptPixel(WHITERUN, 64, maps, lairs([])), { x: 900, y: 40 }, 'never skipped past the Bay');
  assert.deepEqual(vampireCryptPixel(WHITERUN, 64, maps, own, () => 0), { x: WHITERUN.x + dxs[1], y: WHITERUN.y + 1 }, 'the province\'s own first');
  // on the Bay DFU's own: the region's draw, and a region with none answers null (the host's skip, where DFU throws)
  assert.deepEqual(vampireCryptPixel({ x: 500, y: 200 }, 1, maps, own, () => 0), { x: 100, y: 400 }, 'the region\'s own, however far');
  assert.equal(vampireCryptPixel({ x: 500, y: 200 }, 5, { ...maps, getRegion: () => null }, own), null);
  assert.equal(isCemeteryPlace({ hasDungeon: false, dungeonType: DUNGEON_TYPES.Cemetery }), false, 'a graveyard with no dungeon is no crypt');
  // the host asks the module (HOST-SPLIT), with the world's registry
  const w = codeOnly(readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8'));
  const arm = w.slice(w.indexOf('function transferToCemeteryArm()'), w.indexOf('function cancelRestArm()'));
  assert.match(arm, /const pos = vampireCryptPixel\(playerTravelPixel\(\), _questRegionIndex\(\), maps, worldPlaces\);/);
  assert.doesNotMatch(arm, /maps\.getRegion\(/, 'no Bay-only search left in the host');
});

test('R2-7 a staff event past the Bay: an AREA\'s event stands on the world\'s pixel (the law, the relay\'s word, its cell), a town\'s is the Bay\'s until WW6 and refused by name; the place picker lists a province\'s places from the world\'s registry, each offered as an area, and says where staff stand (mutants: the Bay\'s bound again, the word\'s, a town past the Bay taken, the province unlisted, a place offered as a town)', () => {
  assert.equal(STAFF_EVENT_PIXEL_BOUND, WORLD_PIXEL_BOUND, 'the law\'s bound is the wire\'s (it imports nothing)');
  const EV = { id: 'ab12cd34ef', rg: 64, loc: -1, px: WHITERUN.x, py: WHITERUN.y, nm: 'Whiterun', ct: 0, mt: [7, 12], n: 50, m: 25, b: 24, bs: 200, bh: 10, at: 1_700_000_000_000, ue: 0, eb: 1, fb: 0, by: 'Mob' };
  assert.deepEqual(validStaffEvent(EV), { ...EV, hp: 0 }, 'an area past the Bay');
  assert.equal(isAreaEvent(validStaffEvent(EV)), true);
  assert.equal(staffEventFault({ ...EV, loc: 3, ct: 1 }), 'town-past-bay', 'a town\'s event past the Bay: the raids are the Bay\'s until WW6');
  assert.equal(staffEventFault({ ...EV, rg: 17, loc: 0, px: 207, py: 213, ct: 1 }), null, 'a Bay town\'s as it was');
  for (const [px, py] of [[WORLD_PIXEL_BOUND, 0], [0, -WORLD_PIXEL_BOUND], [1.5, 0]]) assert.equal(staffEventFault({ ...EV, px, py }), 'pixel', `${px},${py}`);
  assert.equal(staffTownPixelOk(999, 499), true);
  assert.deepEqual([staffTownPixelOk(1000, 0), staffTownPixelOk(0, -1)], [false, false]);
  // a player's word in its place, through the relay's parse, to the place's cell
  const word = { k: 'w', id: EV.id, px: WHITERUN.x, py: WHITERUN.y, n: 3, s: 1, bu: 0, bk: 0, fb: 0, h: 2 };
  assert.deepEqual(validStaffEventIn(word), word);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'sev', ...word }), { hasHello: true }), { t: 'sev', ...word });
  assert.equal(validStaffEventIn({ ...word, py: -WORLD_PIXEL_BOUND }), null);
  assert.match(worldRoom(WHITERUN.x, WHITERUN.y), /^world:-?\d+,-?\d+$/, 'its cell past the Bay');
  // the game runs it as the raid it is: a player outdoors on its pixel
  assert.equal(staffEventBook([EV]), 1, 'the hub\'s book held as a raid past the Bay');
  assert.equal(staffRaidHere(null, WHITERUN, true)?.staff.id, EV.id, 'outdoors on its pixel: in it');
  assert.equal(staffRaidHere(null, WHITERUN, false), null, 'indoors: not');
  staffEventBook([]);
  // the picker: a province's places from the registry, as areas
  const reg = createWorldPlaces();
  reg.register('tesa', [
    { mapId: 600001, name: 'Whiterun', px: WHITERUN.x, py: WHITERUN.y, type: LOCATION_TYPES.TownCity },
    { mapId: 600002, name: 'Riverwood', px: WHITERUN.x + 4, py: WHITERUN.y + 2, type: LOCATION_TYPES.TownVillage },
    { mapId: 600003, name: 'Anvil', px: 2000, py: 1400, type: LOCATION_TYPES.TownCity },
  ]);
  const maps = { getRegion: () => null, getRegionName: (r) => REGION_NAMES[r] ?? '', getRegionIndexAt: () => 64 };
  assert.equal(theatreOfRegion(64) > 0, true);
  const p = staffPlaces(maps, 64, reg);
  assert.equal(p.name, 'Skyrim');
  assert.deepEqual(p.list.map((x) => [x.loc, x.name, x.px, x.py]), [[-1, 'Riverwood', WHITERUN.x + 4, WHITERUN.y + 2], [-1, 'Whiterun', WHITERUN.x, WHITERUN.y]], 'Skyrim\'s alone, each an area, by name');
  for (const x of p.list) assert.equal(staffEventFault({ ...EV, loc: x.loc, px: x.px, py: x.py, nm: x.name }), null, `${x.name}: what the picker offers runs`);
  assert.deepEqual(staffPlaces(maps, 64, null).list, [], 'no registry: none');
  gamePlaces(reg);
  assert.equal(keptPlaces(), reg);
  assert.deepEqual(staffHere(maps, WHITERUN), { dfoStaff: 'here', region: 64, name: 'Skyrim', loc: -1, place: 'Whiterun', kind: 'town', px: WHITERUN.x, py: WHITERUN.y }, 'where I stand past the Bay: the area at Whiterun');
  gamePlaces(null);
  // the host keeps the registry for the picker
  assert.match(codeOnly(readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8')), /const worldPlaces = gamePlaces\(createWorldPlaces\(\)\);/);
});
