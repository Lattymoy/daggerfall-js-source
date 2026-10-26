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
