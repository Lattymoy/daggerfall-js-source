// BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 23 - E4): STAFF `/town audit` FOR A
// PROVINCE - a region's confirmed towns 400 a page in the law's order (net/townEconLaw.js townAuditOrderSql): the Bay's by
// their location's index as ever; a province's capitals' slices first, then its places, then its countryside, where
// `ORDER BY location` over its negative indices listed its farthest hamlets and never a capital. The real Worker over
// node:sqlite (bible/06-Systems/Town-Economy-Arc.md BAY-LEFT-SEA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { townAuditRank, TOWN_AUDIT_CAPITAL_LANE, TOWN_AUDIT_PAGE } from '../../src/net/townEconLaw.js';
import { CAPITAL_LANE } from '../../src/world/capitalLane.js';
import { parseTownCommand, townAuditLines, TOWN_USAGE } from '../../src/net/townEconBook.js';
import { capitalPlaceId, capitalLocationIndex } from '../../src/world/tamrielCapitals.js';
import { arenaPlaceId, arenaLocationIndex, ARENA_INDEX_BASE } from '../../src/world/arenaLocations.js';
import { countryPlaceId, countryLocationIndex, COUNTRY_INDEX_BASE } from '../../src/world/tamrielCountry.js';
import { CAPITAL_INDEX_BASE } from '../../src/world/tamrielCapitals.js';

const SKYRIM = 64, DF = 17;
const realNow = Date.now;
test.after(() => { Date.now = realNow; });

/** A province's confirmed towns as the registry's producers number them: `n` country places, six Arena places, two
 *  capitals' slices - written in the order the old query read them worst. */
function skyrimTowns(n) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ map: countryPlaceId(9000 + i * 7), location: countryLocationIndex(9000 + i * 7), kind: 'country' });
  for (let id = 0; id < 6; id++) { const p = { provinceIndex: 2, id }; rows.push({ map: arenaPlaceId(p), location: arenaLocationIndex(p), kind: 'arena' }); }
  for (const [k, so] of [[1, 0], [0, 3], [0, 0]]) rows.push({ map: capitalPlaceId(k, so), location: capitalLocationIndex(k, so), kind: 'capital' });
  return rows.map((r, i) => ({ ...r, px: 1500 + (i % 90), py: -400 - Math.floor(i / 90) }));
}

test('BAY-LEFT-SEA THE AUDIT\'S ORDER LAW: the rank the Bay\'s, a capital\'s, any other\'s past the Bay - the places\' indices below the countryside\'s by their producers\' own bases (mutants: the Bay unranked; the capital lane unread)', () => {
  assert.equal(TOWN_AUDIT_PAGE, 400);
  assert.deepEqual([TOWN_AUDIT_CAPITAL_LANE, CAPITAL_LANE], [0x341, 0x341]);
  assert.deepEqual([
    townAuditRank(((3 << 20) | 212207) >>> 0, 5), townAuditRank(((0x341 << 20) | 212207) >>> 0, 5), townAuditRank(capitalPlaceId(1, 0), capitalLocationIndex(1, 0)),
    townAuditRank(arenaPlaceId({ provinceIndex: 2, id: 4 }), arenaLocationIndex({ provinceIndex: 2, id: 4 })), townAuditRank(countryPlaceId(5000), countryLocationIndex(5000)),
  ], [0, 0, 1, 2, 2]);
  assert.ok(ARENA_INDEX_BASE < COUNTRY_INDEX_BASE && COUNTRY_INDEX_BASE + (1 << 25) < CAPITAL_INDEX_BASE, 'the places\' indices before the countryside\'s, the capitals\' the largest');
});

test('BAY-LEFT-SEA (the real Worker): a province\'s audit lists its capitals, then its places, then its countryside, 400 a page with the word for the next; a Bay region\'s as it ever was; a page past them none and a bad page refused - the client\'s word for a page and its line (mutants: ordered by location again; the page unread; `more` never said; the witnesses the region\'s first)', async () => {
  Date.now = () => T0 * 1000;
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Devi' });
  const raw = s.env.DB._raw;
  const dev = await s.registered('Devi');
  const towns = skyrimTowns(420);
  const put = raw.prepare('INSERT INTO town_econ_towns (map, px, py, region, location, at) VALUES (?, ?, ?, ?, ?, ?)');
  for (const t of towns) put.run(t.map, t.px, t.py, SKYRIM, t.location, T0);
  // the Bay's: five Daggerfall towns, their indices out of order
  // (the last one's map id in a capital's lane's high bits: a Bay row's high bits are MAPS.BSA's, any of them)
  const bay = [7, 2, 9, 0, 4].map((loc) => ({ map: (((loc === 9 ? 0x341 : 3) << 20) | (100 * 1000 + 310 - loc)) >>> 0, px: 310 - loc, py: 100, location: loc }));   // their map ids against their indices
  for (const t of bay) put.run(t.map, t.px, t.py, DF, t.location, T0);
  // the witnesses: the developer's of Solitude (the first page) the earliest; ten each of the first page's 400 towns
  // after it (4,000 - the region's whole cap, so the old read never reached a later page's); one of the last country town
  // (the second page) last
  const solitude = capitalPlaceId(1, 0), late = towns[419].map;
  const wit = raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('town', ?, ?, '[]', ?, ?)");
  wit.run(`1:${solitude}`, dev.id, SKYRIM, T0 - 20);
  const first = [...towns].sort((a, b) => townAuditRank(a.map, a.location) - townAuditRank(b.map, b.location) || Math.abs(a.location) - Math.abs(b.location)).slice(0, 400);   // the law's own order
  const ten = [];
  for (let w = 0; w < 10; w++) ten.push(await s.registered(`Wit${w}`));
  for (const t of first) ten.forEach((w, i) => wit.run(`1:${t.map}`, w.id, SKYRIM, T0 - 15 + i));
  wit.run(`1:${late}`, dev.id, SKYRIM, T0);
  const audit = async (region, page) => (await s.call('/v1/towns/audit', page == null ? { region } : { region, page }, dev.secret)).body;
  const one = await audit(SKYRIM);
  assert.equal(one.ok, true);
  assert.deepEqual([one.page, one.more, one.towns.length], [0, true, 400]);
  const kindOf = new Map(towns.map((t) => [t.map, t.kind]));
  assert.deepEqual(one.towns.slice(0, 10).map((t) => [kindOf.get(t.map), t.map]), [
    ['capital', capitalPlaceId(0, 0)], ['capital', capitalPlaceId(1, 0)], ['capital', capitalPlaceId(0, 3)],
    ...[0, 1, 2, 3, 4, 5].map((id) => ['arena', arenaPlaceId({ provinceIndex: 2, id })]), ['country', countryPlaceId(9000)],
  ], 'the capitals (each centre first), then the places, then the countryside nearest its first');
  assert.deepEqual(one.towns.find((t) => t.map === solitude).by, ['Devi', 'Wit0', 'Wit1'], 'a town\'s witnesses read with its page');
  assert.deepEqual(one.towns.map((t) => t.map), first.map((t) => t.map), 'the law\'s own order (townAuditRank), the SQL\'s');
  const two = await audit(SKYRIM, 1);
  assert.deepEqual([two.page, two.more, two.towns.length], [1, false, 29]);
  assert.deepEqual(two.towns.at(-1).map, late);
  assert.deepEqual(two.towns.at(-1).by, ['Devi'], 'and a later page\'s');
  assert.deepEqual(new Set([...one.towns, ...two.towns].map((t) => t.map)).size, 429, 'every town once over the pages');
  assert.deepEqual((await audit(SKYRIM, 2)).towns, []);
  for (const bad of [-1, 1.5, 10000, '1']) assert.equal((await audit(SKYRIM, bad)).error, 'bad-town', String(bad));
  const df = await audit(DF);
  assert.deepEqual([df.towns.map((t) => t.location), df.more], [[0, 2, 4, 7, 9], false], 'the Bay\'s by its location\'s index, as ever');
  // the client: a page asked by its number, the next one's word
  assert.deepEqual([parseTownCommand('/town audit'), parseTownCommand('/town audit 2'), parseTownCommand('/town audit 0'), parseTownCommand('/town audit 2 3')], [{ op: 'audit' }, { op: 'audit', page: 1 }, { error: TOWN_USAGE }, { error: TOWN_USAGE }]);
  const lines = townAuditLines(one, () => null);
  assert.deepEqual([lines.length, lines.at(-1)], [401, 'More confirmed towns of this region: /town audit 2']);
  assert.equal(townAuditLines(two, () => null).length, 29, 'the last page says no more');
});
