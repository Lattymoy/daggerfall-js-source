// SEAT1a (2026-09-30, Mac: "Finish the seats"): THE SEATS AS EVERY CLIENT DERIVES AND SHOWS THEM - the derivation over a
// fixture MAPS set (never hand-built rows: TEST THE SHAPE THE PRODUCER MINTS), the one law module, the seat book, the
// map's rings, the banners' anchors and the hosts by their source. bible/11-Multiplayer/Seats-Arc.md 3.1-3.4;
// `06-Systems/Online-Arc.md` SEAT1a.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mapPixelToLongitudeLatitude, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { deriveTownSeats, seatAtMapId, seatOfLocation, hasPalace, seatTotals } from '../src/systems/townSeats.js';
import {
  seatReportOf, seatReportText, parseSeatReport, seatIgnoredAccounts, charterName, seatArrivalLine, seatInfoLine,
  seatMapMark, seatPlainBanner, SEAT_RING_UNHELD, KINGDOM_METALS, FREE_LAND_RING, SEAT_BANNERS_MAX, seatWeekOf,
  seatWeekStartMs, seatPhaseOf, SEAT_WEEK0_MS, SEATS_SWITCH, seatsSwitchOf, CROWN_SEAT_REGIONS,
  SEAT_WITNESS_UNMATCHED_MAX, SEAT_WITNESS_IGNORED_S, SEAT_WITNESS_REPORTS_HOUR, SEAT_REPORT_EVERY_S, SEAT_WITNESSES_AUDIT,
} from '../src/net/townSeatLaw.js';
import { witnessedFact } from '../src/net/nodeLaw.js';
import { createTownSeatBook, parseSeatCommand, SEAT_USAGE, SEAT_LIST_CACHE_MS, SEAT_REPORTED_KEY } from '../src/net/townSeatBook.js';
import { buildInkMarks, markReach, paintSeatRing, SEAT_RING_PAD, SEAT_SECOND_PAD } from '../src/ui/inkMap.js';
import { plainBannerOf } from '../src/ui/heraldryArt.js';
import { seatBannerAnchors, gateBannerAnchor, boardPennantAnchor, palaceKeysOf, townCentreOf, createSeatBanners, GATE_BANNER_DROP_M, BOARD_PENNANT_RISE_M } from '../src/scenes/seatBanners.js';
import { countSeats } from '../tools/seatCount.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A MAPS.BSA row as the reader mints it: its region and index, its name, its map table (the map id, the pixel's
 *  longitude and latitude) and its building records. */
function row({ region, index = 0, name, mapId, px = [100, 100], buildings = [] }) {
  const ll = mapPixelToLongitudeLatitude(px[0], px[1]);
  return {
    regionIndex: region, locationIndex: index, name,
    mapTableData: { mapId, longitude: ll.x + 5, latitude: ll.y + 5, locationType: 0 },
    exterior: { buildings: buildings.map((t) => ({ buildingType: t })), exteriorData: {} },
  };
}
const P = BUILDING_TYPES.Palace, H = BUILDING_TYPES.House1 ?? 17;
const FIXTURE = [
  row({ region: 17, name: 'Daggerfall', mapId: 0x80001000, px: [210, 190], buildings: [H, H] }),   // a capital: a crown (a signed id read unsigned)
  row({ region: 23, name: 'Wayrest', mapId: 5023, px: [610, 118], buildings: [P] }),   // a crown with a palace: never also a palace seat
  row({ region: 21, name: 'Anticlere', mapId: 3021, px: [402, 151], buildings: [H, P, P] }),   // two palaces: one seat
  row({ region: 21, index: 1, name: 'Ruins of Nowhere', mapId: 3022, px: [403, 160], buildings: [H] }),   // no palace, no seat
  row({ region: 20, name: 'Sentinel', mapId: 2020, px: [300, 400], buildings: [] }),
  row({ region: 18, name: 'Daggerfall', mapId: 1818, px: [120, 200], buildings: [] }),   // the capital's name outside its region: nothing
  row({ region: 26, name: 'Orsinium', mapId: 2626, px: [700, 60], buildings: [P] }),   // a Free Land's palace
];

test('SEAT1a the derivation over a fixture MAPS set: every Palace record a seat, the three capitals crowns in their own regions, one seat a location, no palace no seat, a mod\'s rows never counted, the key unsigned (mutants: the palace type; the crown\'s region; a capital also a palace seat; the base rows)', () => {
  const mod = row({ region: 21, name: 'Mod Keep', mapId: 9999, buildings: [P] });
  const base = new Set(FIXTURE);
  const seats = deriveTownSeats([...FIXTURE, mod], { isBase: (l) => base.has(l), isHub: (k) => k === 3021 });
  assert.deepEqual(seats.list.map((s) => [s.name, s.tier, s.key]), [
    ['Sentinel', 'crown', 2020], ['Orsinium', 'palace', 2626], ['Anticlere', 'palace', 3021], ['Wayrest', 'crown', 5023], ['Daggerfall', 'crown', 0x80001000],
  ]);
  assert.equal(seatAtMapId(seats, 0x80001000 | 0).name, 'Daggerfall', 'a signed id finds its seat');
  assert.equal(seatAtMapId(seats, 9999), null, 'a mod\'s row never counts');
  assert.equal(seatAtMapId(seats, 3022), null, 'no palace, no seat');
  assert.equal(seatAtMapId(seats, 1818), null, 'a capital\'s name outside its region is nothing');
  const anticlere = seatAtMapId(seats, 3021);
  assert.deepEqual({ ...anticlere, pixel: [...anticlere.pixel] }, { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151], kingdom: null, isHub: true });
  assert.equal(seatAtMapId(seats, 5023).kingdom, 'wayrest');
  assert.equal(hasPalace(FIXTURE[2]), true);
  assert.equal(seatOfLocation(null), null);
  assert.deepEqual(seatTotals(seats.list), { seats: 5, crown: 3, palace: 2, hubs: 1, kingdoms: { sentinel: 1, free: 1, march: 1, wayrest: 1, daggerfall: 1 } });
  // SEAT-COUNT is the same derivation, laid out through its host
  const counted = countSeats(FIXTURE, { layout: () => ({ blocks: [] }) });
  assert.equal(counted.totals.seats, 5);
  assert.ok(counted.seats.every((s) => s.boards === 0), 'a layout with no boards counts none');
  assert.ok(countSeats(FIXTURE).seats.every((s) => s.boards === -1), 'no layout: not measured, never "none"');
});

test('SEAT1a the law: a report canonical in its bytes and read back; a crown in its region under its name; the switch; the witness numbers the record set (mutants: the key order; the name\'s bound; the crown\'s name; the switch\'s default)', () => {
  const a = seatReportOf({ pixel: [402, 151], tier: 'palace', region: 21, name: 'Anticlere', key: 3021, extra: 1 });
  assert.deepEqual(a, { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] });
  assert.equal(seatReportText(a), '[3021,"Anticlere",21,"palace",402,151]');
  assert.deepEqual(parseSeatReport(seatReportText(a)), { seat: a });
  assert.equal(parseSeatReport('[3021,"Anticlere",21,"palace",402]'), null);
  assert.equal(parseSeatReport('[3021, "Anticlere",21,"palace",402,151]'), null, 'only the canonical bytes');
  for (const bad of [{ ...a, key: -1 }, { ...a, key: 2 ** 32 }, { ...a, name: '' }, { ...a, name: 'x'.repeat(49) }, { ...a, name: 'Antié' }, { ...a, region: 62 },
    { ...a, tier: 'castle' }, { ...a, pixel: [1000, 0] }, { ...a, pixel: [0, 500] }, { ...a, pixel: [1.5, 2] }]) assert.equal(seatReportOf(bad), null, JSON.stringify(bad));
  assert.ok(seatReportOf({ ...a, name: 'x'.repeat(48) }));
  assert.deepEqual(CROWN_SEAT_REGIONS, { 17: 'daggerfall', 23: 'wayrest', 20: 'sentinel' });
  assert.ok(seatReportOf({ key: 1, name: 'Wayrest', region: 23, tier: 'crown', pixel: [1, 1] }));
  assert.equal(seatReportOf({ key: 1, name: 'Sentinel', region: 23, tier: 'crown', pixel: [1, 1] }), null);
  assert.equal(seatReportOf({ key: 1, name: 'Anticlere', region: 21, tier: 'crown', pixel: [1, 1] }), null);
  assert.deepEqual(SEATS_SWITCH, ['off', 'dev', 'on']);
  assert.equal(seatsSwitchOf(undefined), 'off');
  assert.equal(seatsSwitchOf('on'), 'on');
  assert.deepEqual([SEAT_WITNESS_UNMATCHED_MAX, SEAT_WITNESS_IGNORED_S, SEAT_WITNESS_REPORTS_HOUR, SEAT_REPORT_EVERY_S, SEAT_WITNESSES_AUDIT], [3, 7 * 86400, 24, 86400, 3]);
  // the witness law is the professions' own - a seat read by it
  const t = seatReportText(a);
  const f = witnessedFact([{ account: 'x', report: t, at: 1 }, { account: 'y', report: t, at: 2 }, { account: 'z', report: t, at: 3 }], parseSeatReport);
  assert.deepEqual(f, { state: 'confirmed', seat: a });
});

test('SEAT1a the ignored accounts: three disagreements nobody else shares, inside a week, silence an account; a shared dissent, an old one or a confirmed answer never counts (mutants: the bound; the week; the shared test)', () => {
  const now = 10_000_000;
  const conf = new Map([['1', 'A'], ['2', 'B'], ['3', 'C'], ['4', 'D']]);
  const rows = [
    { key: '1', account: 'liar', report: 'x1', at: now }, { key: '2', account: 'liar', report: 'x2', at: now },
    { key: '3', account: 'liar', report: 'x3', at: now },
    { key: '1', account: 'pair1', report: 'y', at: now }, { key: '1', account: 'pair2', report: 'y', at: now },
    { key: '2', account: 'pair1', report: 'z', at: now }, { key: '4', account: 'pair1', report: 'w', at: now },
    { key: '3', account: 'pair1', report: 'q', at: now - SEAT_WITNESS_IGNORED_S - 1 },   // pair1: two unmatched this week, one older - not three
    { key: '4', account: 'honest', report: 'D', at: now },
  ];
  assert.deepEqual([...seatIgnoredAccounts(rows, conf, now)], ['liar']);
  assert.deepEqual([...seatIgnoredAccounts(rows.slice(1), conf, now)], [], 'two is not three');
});

test('SEAT1a the words and the marks: the Charter, the arrival line, the map\'s line; the ring stone grey, a crown\'s metal, a March\'s two, a Free Land\'s green; the kingdom\'s plain banner (none in a Free Land); the week\'s clock (mutants: each word; each colour; the March\'s pair; the week\'s start and the Reckoning)', () => {
  const pal = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace' };
  const crown = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown' };
  assert.equal(charterName(pal), 'the Charter of Anticlere');
  assert.equal(charterName(crown), 'the Crown Charter of Wayrest');
  assert.equal(seatArrivalLine(pal), 'Anticlere. Its Charter is unheld.');
  assert.equal(seatArrivalLine(pal, { name: 'The Silver Hand', tag: 'SH' }), 'Anticlere, held by the Silver Hand <SH>.');
  assert.equal(seatArrivalLine(crown), 'Wayrest, capital of the Kingdom of Wayrest. Its Crown Charter is unheld.');
  assert.equal(seatArrivalLine(crown, { name: 'Ebon Oath', tag: 'EO' }), 'Wayrest, capital of the Kingdom of Wayrest, held by Ebon Oath <EO>.');
  assert.equal(seatInfoLine(pal), 'The Charter of Anticlere: unheld');
  assert.equal(SEAT_RING_UNHELD, '#8a8a8a');
  assert.deepEqual(KINGDOM_METALS, { daggerfall: '#3b6fd8', wayrest: '#b3262e', sentinel: '#d4a017' });
  assert.equal(FREE_LAND_RING, '#2f8f4e');
  // SEAT1c (PIN MOVED): an unheld, quiet seat's mark names no fill, no split and no siege
  assert.deepEqual(seatMapMark(crown), { ring: '#8a8a8a', crown: '#b3262e', second: null, fill: null, split: null, siege: false });
  assert.deepEqual(seatMapMark(pal), { ring: '#8a8a8a', crown: null, second: ['#3b6fd8', '#b3262e'], fill: null, split: null, siege: false }, 'Anticlere: Daggerfall and Wayrest');
  assert.deepEqual(seatMapMark({ region: 26, tier: 'palace' }), { ring: '#8a8a8a', crown: null, second: ['#2f8f4e'], fill: null, split: null, siege: false });
  assert.deepEqual(seatMapMark({ region: 59, tier: 'palace' }), { ring: '#8a8a8a', crown: null, second: null, fill: null, split: null, siege: false });
  assert.deepEqual(seatPlainBanner({ region: 59 }), { field: 'azure', border: 'azure', device: null });
  assert.deepEqual(seatPlainBanner({ region: 21 }), { field: 'azure', border: 'crimson', device: null });
  assert.equal(seatPlainBanner({ region: 26 }), null, 'a Free Land hangs nothing');
  assert.deepEqual(plainBannerOf({ field: 'gold', border: 'gold', device: null }), { field: 'gold', border: 'gold', device: null });
  assert.equal(plainBannerOf({ field: 'gold', border: 'gold', device: 'wolf' }), null, 'a device is heraldry\'s, not a plain cloth');
  assert.equal(SEAT_BANNERS_MAX, 8);
  assert.equal(new Date(SEAT_WEEK0_MS).toISOString(), '2026-09-20T18:00:00.000Z', 'the first Turning: Sunday 18:00 UTC');
  assert.equal(seatWeekOf(SEAT_WEEK0_MS - 1), -1);
  assert.equal(seatWeekOf(SEAT_WEEK0_MS), 0);
  assert.equal(seatWeekOf(seatWeekStartMs(3) + 1), 3);
  assert.equal(seatPhaseOf(Date.UTC(2026, 8, 25, 17, 59)), 'muster', 'Friday 17:59');
  assert.equal(seatPhaseOf(Date.UTC(2026, 8, 25, 18, 0)), 'reckoning', 'Friday 18:00: pledges lock');
  assert.equal(seatPhaseOf(Date.UTC(2026, 8, 27, 18, 0)), 'muster', 'Sunday 18:00: the Turning, a new week');
});

test('SEAT1a the book: open by the service\'s word; the list kept its minutes (a refusal too, a session not yet there asked again); the seat reported once a UTC day and only while open; the developer\'s /seat strike (mutants: the cache; the day; the open gate; the command)', async () => {
  let now = Date.UTC(2026, 9, 1, 12);
  let listed = 0, witnessed = [];
  let answer = { ok: false, error: 'no-session' };
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const door = {
    list: async () => { listed++; return answer; },
    witness: async (s) => { witnessed.push(s.key); return { ok: true, data: { counted: true } }; },
    strike: async (k) => (k === 7 ? { ok: true, data: { reports: 3 } } : { ok: false, error: 'not-developer' }),
  };
  const book = createTownSeatBook({ door, storage, nowMs: () => now });
  const seat = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
  await book.read();
  assert.equal(book.open, false);
  assert.equal(await book.witness(seat), false, 'shut: nothing reported');
  await book.read();
  assert.equal(listed, 2, 'a session not yet there is asked again');
  answer = { ok: true, data: { seats: [{ ...seat, state: 'disputed' }], me: { witness: true } } };
  await book.read();
  assert.equal(book.open, true);
  assert.equal(book.stateOf(3021), 'disputed');
  await book.read();
  assert.equal(listed, 3, 'the list is kept its minutes');
  now += SEAT_LIST_CACHE_MS + 1;
  await book.read();
  assert.equal(listed, 4);
  assert.equal(await book.witness(seat), true);
  assert.equal(await book.witness(seat), false, 'once a day');
  assert.deepEqual(JSON.parse(store.get(SEAT_REPORTED_KEY)), { 3021: Math.floor(now / 86_400_000) });
  now += 86_400_000;
  assert.equal(await book.witness(seat), true, 'the next day, again');
  assert.deepEqual(witnessed, [3021, 3021]);
  assert.equal(await book.witness({ ...seat, pixel: [1000, 0] }), false, 'a bad seat is no report');
  answer = { ok: false, error: 'seats-closed' };
  now += SEAT_LIST_CACHE_MS + 1;
  await book.read();
  assert.equal(book.open, false);
  assert.equal(book.stateOf(3021), null);
  assert.deepEqual(parseSeatCommand('/seat strike 7'), { op: 'strike', key: 7 });
  assert.deepEqual(parseSeatCommand('/seat strike x'), { error: SEAT_USAGE });
  assert.deepEqual(parseSeatCommand('/seat void 7'), { error: SEAT_USAGE });
  assert.equal(parseSeatCommand('/seats'), null);
  assert.equal(parseSeatCommand('hello'), null);
  assert.deepEqual(await book.strike(7), { ok: true, text: 'Seat 7 is struck from the registry (3 reports).' });
  assert.equal((await book.strike(8)).ok, false);
});

test('SEAT1a the map: a seat\'s mark carries its ring, round any hub\'s circle, the names kept clear of it; the ring hollow in stone grey, a March\'s second ring in both crowns\' metals, a crown over a crown seat (mutants: the reach; the ring\'s colour; the second ring; the crown)', () => {
  const summary = { mapID: 3021, regionIndex: 21 };
  const seat = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace' };
  const sum = (x, y) => ({ id: y * 1000 + x, mapID: -(y * 1000 + x), regionIndex: 21, mapIndex: 1, locationType: LOCATION_TYPES.TownCity, discovered: true });
  const seatTown = sum(10, 10), plainTown = sum(30, 20);
  const marks = buildInkMarks({ summaries: [seatTown, plainTown], isDiscovered: () => true, seatAt: (s) => ((s.mapID >>> 0) === (seatTown.mapID >>> 0) ? seat : null) });
  const byId = (id) => marks.find((x) => x.summary.id === id);
  assert.deepEqual([byId(seatTown.id).seat, byId(seatTown.id).seatMark], [seat, seatMapMark(seat)], 'the seat and its marks ride the mark');
  assert.equal(byId(plainTown.id).seat, undefined, 'a town that is no seat');
  assert.ok(buildInkMarks({ summaries: [seatTown], isDiscovered: () => true }).every((x) => !x.seat), 'no seatAt (offline, or the seats shut): no ring');
  const plain = { kind: 'town', hub: null };
  const seated = { kind: 'town', hub: { capital: false }, seat, seatMark: seatMapMark(seat) };
  assert.equal(markReach({ ...plain, seat }) - markReach(plain), SEAT_RING_PAD);
  assert.ok(markReach(seated) > markReach({ kind: 'town', hub: { capital: false } }));
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (typeof k === 'string' && !['strokeStyle', 'fillStyle', 'lineWidth'].includes(k) ? (...a) => calls.push([k, ...a]) : undefined), set: (_, k, v) => { calls.push(['set', k, v]); return true; } });
  paintSeatRing(ctx, 10, 20, 7, seatMapMark(seat));
  assert.deepEqual(calls.filter((c) => c[0] === 'arc').map((c) => c.slice(1, 4)), [[10, 20, 7], [10, 20, 7 + SEAT_SECOND_PAD], [10, 20, 7 + SEAT_SECOND_PAD]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'set' && c[1] === 'strokeStyle').map((c) => c[2]), ['#8a8a8a', '#3b6fd8', '#b3262e']);
  assert.equal(calls.filter((c) => c[0] === 'fill').length, 0, 'hollow, and no crown over a palace');
  calls.length = 0;
  paintSeatRing(ctx, 10, 20, 7, seatMapMark({ region: 23, tier: 'crown' }));
  assert.deepEqual(calls.filter((c) => c[0] === 'set' && c[1] === 'fillStyle').map((c) => c[2]), ['#b3262e'], 'Wayrest\'s crown, in crimson');
  assert.equal(calls.filter((c) => c[0] === 'fill').length, 1);
  const w = src('src/ui/inkMap.js');
  assert.match(w, /for \(const \[m, x, y\] of inked\) if \(m\.seatMark\) paintSeatRing\(ctx, x, y, markReach\(m\), m\.seatMark\);/);
  assert.ok(w.indexOf('paintSeatRing(ctx, x, y, markReach(m), m.seatMark)') < w.indexOf('for (const [m, x, y] of inked) paintGlyph(ctx, m.kind, x, y, true);'), 'under the glyph and its halo');
});

test('SEAT1a the banners: the palace door\'s two, a gate\'s on its town side beside its post, a rumour board\'s pennant over it (never a bounty board\'s), eight at most; the palace\'s keys off its blocks\' own records; the kingdom\'s plain cloth hung while the seats are open, none in a Free Land (mutants: the town side; the bounty test; the cap; the palace type; the open gate)', () => {
  const blocks = [{ x: 1, y: 2, dfBlock: { rmbBlock: { fldHeader: { buildingDataList: [{ buildingType: 17 }, { buildingType: BUILDING_TYPES.Palace }, { buildingType: BUILDING_TYPES.Palace }] }, subRecords: [{}, {}] } } }];
  assert.deepEqual(palaceKeysOf(blocks, makeBuildingKey), [makeBuildingKey(1, 2, 1)], 'the palace record, inside the block\'s own count');
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const gate = { local: I, box: [-2, 0, -0.5, 2, 6, 0.5] };
  const g = gateBannerAnchor(gate, [0, 20]);
  assert.deepEqual(g.out, [0, 0, 1], 'the town side');
  assert.equal(g.top[1], 6 - GATE_BANNER_DROP_M);
  assert.ok(g.top[2] > 0.5, 'off the gate\'s face');
  assert.deepEqual(gateBannerAnchor(gate, [0, -20]).out, [0, 0, -1], 'the other side, never a signed zero');
  const b = boardPennantAnchor({ local: I, box: [0, 0, 0, 1, 2, 0.2] });
  assert.deepEqual(b.top, [0.5, 2 + BOARD_PENNANT_RISE_M, 0.1]);
  const frames = new Map([[makeBuildingKey(1, 2, 1), { at: [0, 0, 0], box: [-5, 0, -5, 5, 8, 5], door: { a: [-1, 0, 5], b: [1, 0, 5] } }]]);
  const boards = [{ local: I, box: [0, 0, 0, 1, 2, 0.2] }, { local: I, box: [3, 0, 0, 4, 2, 0.2] }];
  const all = seatBannerAnchors({ frames, palaceKeys: [makeBuildingKey(1, 2, 1)], gates: [gate], boards, notice: 0, centre: [0, 20] });
  assert.equal(all.length, 4, 'the door\'s two, the gate\'s one, the Notice Board\'s one');
  assert.deepEqual(all[3], boardPennantAnchor(boards[0]), 'ONE-BOARD: the pennant over the Notice Board itself');
  assert.equal(seatBannerAnchors({ boards, notice: -1, centre: [0, 20] }).length, 0, 'no Notice Board, no pennant');
  const many = seatBannerAnchors({ gates: Array(12).fill(gate), centre: [0, 20] });
  assert.equal(many.length, SEAT_BANNERS_MAX);
  assert.deepEqual(townCentreOf(new Map([[1, { at: [2, 0, 4] }], [2, { at: [4, 0, 8] }]])), [3, 6]);
  // the list: the kingdom's cloth while open, none in a Free Land or shut
  let open = true;
  const built = new Map([['a', { px: 5, py: 6, homeTown: 3021, seatAnchors: [g] }], ['b', { px: 7, py: 8, homeTown: 2626, seatAnchors: [g] }]]);
  const seats = { 3021: { region: 21 }, 2626: { region: 26 } };
  const sb = createSeatBanners({ built: () => built, seatAt: (k) => (open ? seats[k] ?? null : null), translation: () => [100, 0, 200], now: () => 0, version: () => (open ? 1 : 0) });
  const hung = sb.list();
  assert.equal(hung.length, 1, 'Orsinium hangs nothing');
  assert.deepEqual(hung[0].heraldry, { field: 'azure', border: 'crimson', device: null });
  assert.deepEqual(hung[0].top, [100 + g.top[0], g.top[1], 200 + g.top[2]]);
  open = false;
  assert.deepEqual(sb.list(), [], 'shut: none');
});

test('SEAT1a the hosts by source: the boot pass derives the seats over the hubs\' own rows; the book online; the arrival line a seat\'s, and the seat reported; the map\'s seatAt; the banners measured at the build and hung with the halls\'; /seat strike; the four hosts (mutants: the rows; the arrival; the witness; the anchors; the merge)', () => {
  const w = src('src/scenes/world.js');
  // PIN MOVED (AUDIT LEGACY III W1): the rows are let go once the Living World's two indices over them stand (releaseHubRows)
  // - emptied here at the boot, every index read nothing
  assert.match(w, /const townSeats = deriveTownSeats\(_hubRows, \{ regionNameOf: \(r\) => maps\.getRegionName\(r\), isHub: \(k\) => regionHubs\.byMapId\.has\(k\) \}\);/, 'the game\'s own rows');
  assert.match(w, /const releaseHubRows = \(\) => \{ if \(_livingTowns && _livingDungeons\) _hubRows\.length = 0; \};/, '...let go once both indices stand');
  // SEAT1b (PIN MOVED): the book's door is named once, for the Watch's account beside it
  assert.match(w, /const _seatDoor = params\.has\('online'\) \? accountSeats\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\) \}\) : null;\n\s*const seatBook = _seatDoor\n\s*\? createTownSeatBook\(\{\n\s*door: _seatDoor,/);
  assert.match(w, /const seatHere = \(mapId\) => \(seatBook\?\.open === true \? seatBook\.dressed\(seatAtMapId\(townSeats, mapId\)\) : null\);/);   // SEAT1c (PIN MOVED): dressed in its holder
  assert.match(w, /if \(seat\) \{ townTalk\.say\(seatArrivalLine\(seat\), 5\); seatBook\.witness\(seat\); \}\n\s*else if \(hub\) townTalk\.say\(hubArrivalLine\(hub\), 5\);/);
  assert.match(w, /seatAt: seatBook \? \(summary\) => seatHere\(summary\?\.mapID \?\? summary\?\.mapId\) : null,/);
  assert.match(w, /const seatAnchors = pixelBoardSplit \? seatBannerAnchors\(\{/);
  assert.match(w, /gates: pixelGates\.map\(\(g\) => \(\{ local: g\.local, box: g\.entry\?\._box \}\)\), boards: pixelBoards,\n\s*notice: noticeBoardIndex\(pixelBoards, pixelBoardSplit, townCentreOf\(pixelHomeFrames\)\),/);   // PIN MOVED (AUDIT SEATS-3 F5): the anchors' own, not the siege field's
  assert.match(w, /const pixelBoardSplit = dfLocation && locBlocks && seatAtMapId\(townSeats, dfLocation\.mapTableData\?\.mapId\) \? boardSplitOf\(\{ boards: pixelBoards \}\) : null;/, 'BOUNTY1\'s split through its one memo (AUDIT 28 H8)');
  assert.match(w, /if \(isBulletinBoard\(placed\.modelIdNum\)\) pixelBoards\.push\(\{ box, local \}\);/);
  // PIN MOVED (AUDIT SEATS-3): the halls' and the seats' merged into one kept list (C4: no spread a frame)
  assert.match(w, /for \(const b of hallBanners\?\.list\(\) \?\? \[\]\) all\.push\(b\);\n\s*for \(const b of seatBanners\?\.list\(\) \?\? \[\]\) all\.push\(b\);/);
  assert.match(w, /const hung = bannersHung\(\);/);
  assert.match(w, /const seatCmd = parseSeatCommand\(text\);/);
  assert.match(src('src/ui/heldMap.js'), /seatAt: \(s\) => this\.deps\.seatAt\?\.\(s\) \?\? null,/);
  assert.match(src('src/ui/heldMap.js'), /const hubRows = \[\.\.\.\(hub \? \[hubTitle\(hub\)\] : \[\]\), \.\.\.\(seat \? \[seatInfoLine\(seat, seat\.holder\?\.guild \?\? null\)\] : \[\]\)\];/);   // PIN MOVED (FIELD BUGS 2026-10-04e SEAT-TIP): the holder named
  for (const f of ['src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) assert.doesNotMatch(src(f), /seatBook|createSeatBanners|deriveTownSeats/, `${f}: no seat there`);
});
