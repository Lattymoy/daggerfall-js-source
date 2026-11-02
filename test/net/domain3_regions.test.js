// DOMAIN3 (2026-10-24, the owner: "A transition to tamriel region control instead of just city control"; asked, "Replace
// seats"): THE REGION'S CHARTER - from the seat week DOMAINS_WEEK names, one Charter a region, keyed by its seat of power
// (the region's seat ranking first by HUB1's own claim, the crown in a crown's region), every other seat town of the
// region its holding: the seat of power witnessed beside the seat, the pledge a region's Charter alone, a holding's Watch
// and the region's homes counted there, every Notice Board of the region its bailiwick, and the Turning before the first
// such week folding every other Charter into its region's (bible/11-Multiplayer/Domains.md section 7; src/net/domainLaw.js,
// server-account/src/domains.js). Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { standService, T0 } from '../accountDb.mjs';
import { mapPixelToLongitudeLatitude, LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { deriveTownSeats } from '../../src/systems/town/townSeats.js';
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, SEAT_WEEK_MS, seasonEndingAt } from '../../src/net/townSeatLaw.js';
import {
  domainsWeekOf, domainsRule, domainReportOf, domainReportText, parseDomainReport, domainSeats, charterSeats, charterUnder,
} from '../../src/net/domainLaw.js';
import { confirmedDomains, domainFacts, witnessDomain, DOMAIN_ROWS_KEPT_S, DOMAIN_AGREEING_KEPT } from '../../server-account/src/domains.js';
import { titheAt, levyAt } from '../../server-account/src/seatHolding.js';
import { settleWeek } from '../../server-account/src/seatTurning.js';
import { readFileSync } from 'node:fs';
import { createTownSeatBook } from '../../src/net/townSeatBook.js';
import { charterName, seatArrivalLine, seatInfoLine, seatMapMark, bailiwickOf, boardTithePct, holdingTabLine } from '../../src/net/townSeatLaw.js';
import { createSeatEdicts } from '../../src/systems/seatEdicts.js';
import { createFestivalStage } from '../../src/scenes/seatFestival.js';

const subtle = webcrypto.subtle;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const RIPMORE = { key: 3022, name: 'Ripmore', region: 21, tier: 'palace', pixel: [430, 180] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [610, 118] };
const GLENPOINT = { key: 1818, name: 'Glenpoint', region: 18, tier: 'palace', pixel: [120, 200] };
const DAY = 86400;
const OLD = T0 - SEAT_MEMBER_WAIT_S - DAY;
const W = seatWeekOf(T0 * 1000);
const TURNED = Math.floor((seatWeekStartMs(W) + SEAT_WEEK_MS) / 1000) + 60;   // a minute past this week's Turning

/** The service with the seats and the Marks open; the four seats confirmed by three witnesses; `domain(region, key)`
 *  three witnesses' agreeing seat-of-power rows; a guild founded, a member, a treasury. */
async function stood(t, env = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', ...env });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, RIPMORE, WAYREST, GLENPOINT]) {
    for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  }
  const domain = (region, key) => {
    for (const w of witnesses) raw.prepare('INSERT INTO town_domain_witness (region, account, report, at) VALUES (?, ?, ?, ?)').run(region, w.id, domainReportText({ region, key }), T0 - DAY);
  };
  const guild = async (handle, name, tag) => {
    const gm = await svc.seated(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(OLD, gid);
    return { gm, gid };
  };
  const member = async (g, handle) => {
    const m = await svc.seated(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 2, ?, ?)').run(m.id, m.character, g.gid, handle, OLD);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const silver = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const hold = (seat, gid, { since = W - 1, tithe = 0 } = {}) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, ?, 0)`).run(seat.key, gid, seat.region, seat.tier, since, T0 - 7 * DAY, tithe);
  const pledge = (who, key) => svc.call('/v1/seats/pledge', { character: who.character, key }, who.secret);
  let nonce = 1;
  const tick = (who, seat) => mintWatchReceipt({ s: who.id, x: seat.pixel[0], y: seat.pixel[1], c: nonce++ }, svc.gateKey, { subtle, nowS: T0 });
  const watch = async (who, seat) => (await svc.call('/v1/seats/watch', { character: who.character, receipts: [await tick(who, seat)] }, who.secret)).body;
  const standings = async (who, seat) => (await svc.call('/v1/seats/standings', { key: seat.key, character: who.character }, who.secret)).body;
  return { svc, raw, domain, guild, member, treasury, silver, hold, pledge, watch, standings, at: (s) => { now = s; } };
}

test('DOMAIN3 THE LAW: DOMAINS_WEEK a whole week, ruling from that week on; a seat of power\'s report canonical and checked; a region\'s Charter its confirmed seat of power - a seat of that region, the crown in a crown\'s; the Charters every region\'s seat of power, and every seat of a region with none; a holding\'s Charter its region\'s (mutants: the week\'s rule; the report\'s region; the canonical bytes; the seat\'s region; the crown; a region with none)', () => {
  assert.deepEqual(['6', ' 7 ', '', undefined, null, 'x', '-1', '6.5', 6].map(domainsWeekOf), [6, 7, null, null, null, null, null, null, 6]);
  assert.deepEqual([domainsRule(6, 6), domainsRule(7, 6), domainsRule(5, 6), domainsRule(7, null)], [true, true, false, false]);
  assert.deepEqual(domainReportOf({ region: 21, key: 3021 }), { region: 21, key: 3021 });
  // PIN MOVED (WW7-3, bible/03-World/World-Wide.md WW7): 62-70 the provinces'
  for (const bad of [{ region: 71, key: 3021 }, { region: 21, key: -1 }, { region: 21, key: 1.5 }, { region: '21', key: 3021 }, null]) assert.equal(domainReportOf(bad), null, JSON.stringify(bad));
  assert.equal(domainReportText({ region: 21, key: 3021 }), '[21,3021]');
  assert.deepEqual(parseDomainReport('[21,3021]'), { domain: { region: 21, key: 3021 } });
  // PIN MOVED (WW7-3): 62-70 the provinces'
  for (const bad of ['[21, 3021]', '[21,3021,1]', '{"region":21}', 'x', '[71,3021]']) assert.equal(parseDomainReport(bad), null, bad);
  const seats = new Map([ANTICLERE, RIPMORE, WAYREST, GLENPOINT, { key: 5024, name: 'Wayrest Keep', region: 23, tier: 'palace', pixel: [600, 120] }].map((s) => [s.key, s]));
  const d = domainSeats(seats, new Map([[21, RIPMORE.key], [23, 5024], [18, ANTICLERE.key], [17, 9999]]));
  assert.deepEqual([...d].map(([r, s]) => [r, s.key]), [[21, RIPMORE.key]], 'a crown\'s region its crown alone; another region\'s seat and an unconfirmed key never');
  const domains = new Map([[21, ANTICLERE]]);
  assert.deepEqual(charterSeats([ANTICLERE, RIPMORE, WAYREST, GLENPOINT], domains).map((s) => s.key), [ANTICLERE.key, WAYREST.key, GLENPOINT.key]);
  assert.deepEqual(charterSeats([ANTICLERE, RIPMORE], null).map((s) => s.key), [ANTICLERE.key, RIPMORE.key], 'the seat law: every seat');
  assert.deepEqual([charterUnder(RIPMORE, domains).key, charterUnder(GLENPOINT, domains).key, charterUnder(RIPMORE, null).key, charterUnder(null, domains)], [ANTICLERE.key, GLENPOINT.key, RIPMORE.key, null]);
});

/** A MAPS.BSA row as the reader mints it, with the kind and size HUB1's claim reads. */
function row({ region, index = 0, name, mapId, type = LOCATION_TYPES.TownCity, blocks = 4, palace = true }) {
  const ll = mapPixelToLongitudeLatitude(100 + (mapId % 50), 100);
  return {
    regionIndex: region, locationIndex: index, name,
    mapTableData: { mapId, longitude: ll.x + 5, latitude: ll.y + 5, locationType: type },
    exterior: { buildings: palace ? [{ buildingType: BUILDING_TYPES.Palace }] : [], exteriorData: { width: blocks, height: 1 }, buildingCount: 10 },
  };
}

test('DOMAIN3 THE SEAT OF POWER as every client derives it: a region\'s seat ranking first by HUB1\'s claim - a city over a hamlet, the one named for its region, the largest - the crown first in a crown\'s region, a seat whose kind claims no hub after every one that does; 39 regions on the freeware, 37 of them their hub (mutants: the crown first; the claim; the claimless last; the key\'s tie)', () => {
  const names = { 21: 'Anticlere', 17: 'Daggerfall', 30: 'Nowhere' };
  const seats = deriveTownSeats([
    row({ region: 21, name: 'Ripmore', mapId: 3022, blocks: 9 }),
    row({ region: 21, name: 'Anticlere', mapId: 3021, blocks: 4 }),   // named for its region: over the larger
    row({ region: 21, index: 2, name: 'Bigtown', mapId: 3023, type: LOCATION_TYPES.TownHamlet, blocks: 30 }),
    row({ region: 17, name: 'Daggerfall', mapId: 1700, type: LOCATION_TYPES.TownHamlet, blocks: 1, palace: false }),   // the crown, whatever its claim
    row({ region: 17, index: 1, name: 'Shrike', mapId: 1701, blocks: 20 }),
    row({ region: 30, name: 'Hollow', mapId: 3001, type: 99, blocks: 50 }),   // a kind HUB1 never claims
    row({ region: 30, index: 1, name: 'Little', mapId: 3002, type: LOCATION_TYPES.TownVillage, blocks: 1 }),
    row({ region: 30, index: 2, name: 'Twin', mapId: 3004, type: 99 }),
  ], { regionNameOf: (r) => names[r] ?? '' });
  assert.deepEqual([...seats.powers], [[17, 1700], [21, 3021], [30, 3002]]);
  const none = deriveTownSeats([row({ region: 30, name: 'Twin', mapId: 3004, type: 99 }), row({ region: 30, index: 1, name: 'Hollow', mapId: 3001, type: 99 })], { regionNameOf: () => '' });
  assert.deepEqual([...none.powers], [[30, 3001]], 'no claim on either: the lower key');
  // measured on the freeware ARENA2 (2026-10-24, scratchpad probe over tools/seatCount.mjs baseRows): 322 seats, 39 regions,
  // 37 of the seats of power their region's hub - Wrothgaria for Newing and Aldcester for Koegria the two that are not
});

test('DOMAIN3 THE WITNESS: the client standing in a seat town reports its region\'s seat of power beside the seat; three agreeing confirm it - a confirmed seat of that region; an agreeing answer kept to a dozen, so no few witnesses lost flip it (AUDIT DOMAINS S3); a report of another region, or a young account\'s, counts nothing (mutants: the region tie; the agreeing write; the ignored; the young)', async (t) => {
  const s = await stood(t);
  const ws = [];
  for (const h of ['Wit1', 'Wit2', 'Wit3', 'Wit4']) {
    const w = await s.svc.registered(h);
    s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(T0 - 30 * DAY, w.id);
    ws.push(w);
  }
  const report = (w, seat, domain) => s.svc.call('/v1/seats/witness', { seat, domain }, w.secret);
  const r1 = await report(ws[0], RIPMORE, { region: 21, key: ANTICLERE.key });
  assert.deepEqual(r1.body, { ok: true, counted: true, domain: 'counted' });
  assert.deepEqual((await report(ws[1], RIPMORE, { region: 23, key: WAYREST.key })).body.domain, 'bad-domain', 'only the region it stands in');
  const young = await s.svc.registered('Young');
  assert.deepEqual((await report(young, ANTICLERE, { region: 21, key: ANTICLERE.key })).body, { ok: true, counted: false, why: 'young', domain: 'not-counted' });
  await report(ws[1], ANTICLERE, { region: 21, key: ANTICLERE.key });
  assert.equal((await confirmedDomains(s.svc.env.DB, T0)).size, 0, 'two agree: not yet');
  await report(ws[2], RIPMORE, { region: 21, key: ANTICLERE.key });
  const d = await confirmedDomains(s.svc.env.DB, T0);
  assert.deepEqual([...d].map(([r, x]) => [r, x.key, x.name]), [[21, ANTICLERE.key, 'Anticlere']]);
  // AUDIT DOMAINS S3: an agreeing answer is kept while fewer than DOMAIN_AGREEING_KEPT stand - never the bare three, which
  // one confirming witness lost (deleted, or ignored a week) left to the first three dissenters
  assert.equal((await report(ws[3], ANTICLERE, { region: 21, key: ANTICLERE.key })).body.domain, 'counted');
  const count = () => s.raw.prepare('SELECT COUNT(*) AS n FROM town_domain_witness').get().n;
  assert.equal(count(), 4);
  for (let i = 0; i < DOMAIN_AGREEING_KEPT - 4; i++) {
    const g = await s.svc.guest();
    s.raw.prepare('INSERT INTO town_domain_witness (region, account, report, at) VALUES (21, ?, ?, ?)').run(g.id, domainReportText({ region: 21, key: ANTICLERE.key }), T0);
  }
  const late = await s.svc.guest();
  assert.equal(await witnessDomain({ db: s.svc.env.DB, nowS: T0 + DOMAIN_ROWS_KEPT_S }, { id: late.id }, RIPMORE, { region: 21, key: ANTICLERE.key }), 'agreed');
  assert.equal(count(), DOMAIN_AGREEING_KEPT, 'past a dozen an agreeing answer changes nothing the law judges, and is not written');
  // the facts, pure: an ignored account's answers left out; a region's answers that name another region's never confirm
  const rows = ['a', 'b', 'c'].map((account, i) => ({ key: '21', account, report: '[21,3021]', at: i }));
  assert.deepEqual([...domainFacts(rows)], [[21, 3021]]);
  assert.deepEqual([...domainFacts(rows, new Set(['a']))], []);
  assert.deepEqual([...domainFacts(rows.map((r) => ({ ...r, key: '22' })))], [], 'a fact keyed by one region naming another');
  const dissent = await s.svc.guest();
  assert.equal(await witnessDomain({ db: s.svc.env.DB, nowS: T0 + DOMAIN_ROWS_KEPT_S }, { id: dissent.id }, RIPMORE, { region: 21, key: RIPMORE.key }), 'counted', 'a dissent after the confirmation is written - the dispute\'s row');
  assert.equal(count(), DOMAIN_AGREEING_KEPT + 1);
  // S3, pure: a fourth agreeing answer kept, the first confirmer ignored and three dissenters after - the fact stands
  const kept = [...['a', 'b', 'c', 'd'].map((account, i) => ({ key: '21', account, report: '[21,3021]', at: i })),
    ...['x', 'y', 'z'].map((account, i) => ({ key: '21', account, report: '[21,3022]', at: 10 + i }))];
  assert.deepEqual([...domainFacts(kept, new Set(['a']))], [[21, 3021]]);
  assert.deepEqual([...domainFacts(kept.filter((r) => r.account !== 'd'), new Set(['a']))], [[21, 3022]], 'at the bare three it flipped');
  assert.equal(DOMAIN_AGREEING_KEPT, 12);
  assert.equal(DOMAIN_ROWS_KEPT_S, 60);
});

test('DOMAIN3 THE PLEDGE BY REGION: where the region law rules, a holding is refused and its region\'s Charter pledged; a region with no seat of power confirmed keeps the seat law; before DOMAINS_WEEK every seat is pledged as before (mutants: the Charter check; the week\'s rule; the region with none)', async (t) => {
  const s = await stood(t, { DOMAINS_WEEK: String(W) });
  s.domain(21, ANTICLERE.key);
  const sh = await s.guild('Gamal', 'Silver Hand', 'SH');
  assert.equal((await s.pledge(sh.gm, RIPMORE.key)).body.error, 'seat-not-charter');
  assert.equal((await s.pledge(sh.gm, ANTICLERE.key)).status, 200);
  assert.equal((await s.pledge(sh.gm, GLENPOINT.key)).status, 200, 'Glenpoint\'s region has no seat of power confirmed: its seat its Charter');
  const later = await stood(t, { DOMAINS_WEEK: String(W + 1) });
  later.domain(21, ANTICLERE.key);
  const eo = await later.guild('Horst', 'Ebon Oath', 'EO');
  assert.equal((await later.pledge(eo.gm, RIPMORE.key)).status, 200, 'the week before the law: the seat law');
});

test('DOMAIN3 A HOLDING COUNTS FOR ITS CHARTER: a Watch tick in a holding\'s own pixel counts at the region\'s Charter; a member\'s home anywhere in the region counts in the Charter\'s standings; under the seat law neither does (mutants: the Watch\'s Charter; the homes\' region; a region with no seat of power; every reader handed the law)', async (t) => {
  for (const ruled of [true, false]) {
    const s = await stood(t, ruled ? { DOMAINS_WEEK: String(W) } : {});
    s.domain(21, ANTICLERE.key);
    const sh = await s.guild(`Gamal${ruled}`, 'Silver Hand', 'SH');
    assert.equal((await s.pledge(sh.gm, ANTICLERE.key)).status, 200);
    const r = await s.watch(sh.gm, RIPMORE);
    assert.equal(r.counted, ruled ? 1 : 0, JSON.stringify(r));
    if (ruled) assert.equal(s.raw.prepare("SELECT key FROM town_seat_influence WHERE source = 'watch'").get().key, ANTICLERE.key);
    const o = await s.member(sh, `Owner${ruled}`);
    await s.watch(o, ANTICLERE);   // binds its account to the guild
    s.raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at)
      VALUES (?, 7, ?, ?, ?, 21, 'private', 1000, ?)`).run(RIPMORE.key, o.id, o.character, o.handle, T0 - 30 * DAY);
    const st = (await s.standings(sh.gm, ANTICLERE)).standings[0];
    const homeDays = Math.floor((T0 - seatWeekStartMs(W) / 1000) / DAY);
    assert.equal(st.influence, (ruled ? 2 : 1) + (ruled ? homeDays * 25 : 0), `ruled ${ruled}: ${JSON.stringify(st)}`);
    if (!ruled) continue;
    // AUDIT DOMAINS S1: a region with no seat of power confirmed keeps the seat law - its seats count their own town's homes
    const gp = await s.guild('Glenn', 'Glen Watch', 'GW');
    assert.equal((await s.pledge(gp.gm, GLENPOINT.key)).status, 200);
    const go = await s.member(gp, 'GlenOwner');
    await s.watch(go, GLENPOINT);
    s.raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at)
      VALUES (9999, 7, ?, ?, ?, 18, 'private', 1000, ?)`).run(go.id, go.character, go.handle, T0 - 30 * DAY);
    assert.equal((await s.standings(gp.gm, GLENPOINT)).standings[0].influence, 1, 'a home elsewhere in a region with no seat of power counts nothing');
  }
  // AUDIT DOMAINS S1: every reader of a week's standings counts the region's homes as the board does - the Turning's settle,
  // a Tourney's dead heat, Tribute's room - each handed the region law's seats of power for that week
  const turning = src('server-account/src/seatTurning.js');
  assert.ok(turning.includes('const list = await gatherStandings(db, seat, week, atS, counted, lawNow ? ruled : null);'));
  assert.ok(src('server-account/src/seatSiege.js').includes('!!seasonOf(w, zero), await domainsFor(db, nowS, env, w));'));
  assert.ok(src('server-account/src/seatSiege.js').includes('const applied = !r && await applyResult(db, b, c, nowS, zero, env);'));
  assert.ok(src('server-account/src/seatInfluence.js').includes('seasonZeroOf(env?.SEASON_ZERO_WEEK)), await domainsFor(db, nowS, env, week))).find((x) => x.guild === gid);'));
  assert.ok(src('server-account/src/seatInfluence.js').includes('const region = domains?.get?.(seat.region)?.key === seat.key;'));
});

test('DOMAIN3 THE BAILIWICK IS THE REGION: a board nearer a holding pays the Charter\'s Tithe, a harvest there its Levy - and under the seat law the holding\'s own, unheld (mutants: the Charters read; the region law\'s week unthreaded at a sale, an auction, an order, the clock, a harvest)', async (t) => {
  const s = await stood(t, { DOMAINS_WEEK: String(W) });
  s.domain(21, ANTICLERE.key);
  const sh = await s.guild('Gamal', 'Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid, { tithe: 5 });
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, set_aside, spent, at) VALUES (?, ?, 'levy', ?, 'Gamal', 'law', 0, 0, ?)").run(ANTICLERE.key, W, sh.gid, T0);
  const db = s.svc.env.DB, env = s.svc.env;
  assert.deepEqual(await titheAt(db, T0, 21, RIPMORE.pixel, env), { key: ANTICLERE.key, guild: sh.gid, pct: 5 });
  assert.equal(await titheAt(db, T0, 21, RIPMORE.pixel), null, 'the seat law: Ripmore\'s own bailiwick, unheld');
  assert.equal(await levyAt(db, T0, 21, RIPMORE.pixel, env), ANTICLERE.key);
  assert.equal(await levyAt(db, T0, 21, RIPMORE.pixel), null);
  // the region law's week handed to every Tithe and Levy the service reads - a sale's, an order filled, an auction closed
  // in a read or by the minute's clock, a harvest
  const market = src('server-account/src/market.js');
  for (const call of ['titheAt(db, nowS, Number(a.region), rowBoard(a), env)', 'titheAt(db, nowS, from, rowBoard(l), env)', 'titheAt(db, nowS, region, boardOf(board), env),',
    'titheAt(db, nowS, region, boardOf(board), env) : null;', 'closeAuctions(ctx, dueAuctions, env)']) assert.ok(market.includes(call), call);
  assert.match(src('server-account/src/cron.js'), /\['auctions', \(ctx, env\) => rounds\(\(\) => closeAuctions\(ctx, null, env\)/);
  assert.ok(src('server-account/src/professions.js').includes('levyAt(db, nowS, region, [n.x, n.y], env)'));
});

test('DOMAIN3 THE FOLD: the Turning before the first region-law week releases a Charter held at a holding - its claim fee home, its stockpile to the region\'s Charter\'s, the Chronicle\'s line - keeps the seat of power\'s holder, and claims nothing at a holding; Season 0\'s last Turning wipes instead, and folds nothing (mutants: the fold\'s refund; the stockpile moved; the claims filtered; the wipe\'s guard; the week unthreaded to the Turning)', async (t) => {
  const s = await stood(t);
  s.domain(21, ANTICLERE.key);
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const sh = await s.guild('Gamal', 'Silver Hand', 'SH');
  s.hold(RIPMORE, eo.gid, { since: W - 1 });
  s.hold(ANTICLERE, sh.gid);
  s.treasury(eo.gid, 20_000); s.treasury(sh.gid, 20_000);
  s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('guild', ?, 'burn', NULL, 'seat-claim', 8000, 1, 1, 'seats', 'The Turning', ?)`).run(eo.gid, `claim-${W - 2}-${RIPMORE.key}`);
  s.raw.prepare("INSERT INTO town_seat_stockpile (key, material, qty) VALUES (?, 'iron', 10), (?, 'iron', 4), (?, 'oak', 2)").run(RIPMORE.key, ANTICLERE.key, RIPMORE.key);
  const before = s.silver(eo.gid);
  const r = await settleWeek(s.svc.env.DB, W, TURNED, null, W + 1);
  assert.equal(r.settled, true);
  assert.deepEqual(s.raw.prepare('SELECT key, guild_id FROM town_seat_holds ORDER BY key').all().map((h) => [h.key, h.guild_id]), [[ANTICLERE.key, sh.gid]]);
  assert.equal(s.silver(eo.gid) - before, 8000, 'its claim fee home');
  assert.equal(s.raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'domain-fold'").get().amount, 8000);
  assert.deepEqual(s.raw.prepare('SELECT key, material, qty FROM town_seat_stockpile ORDER BY key, material').all().map((x) => [x.key, x.material, x.qty]), [[ANTICLERE.key, 'iron', 14], [ANTICLERE.key, 'oak', 2]]);
  const line = s.raw.prepare("SELECT data FROM town_seat_history WHERE kind = 'fold'").get();
  assert.deepEqual([JSON.parse(line.data).into, JSON.parse(line.data).refund], [ANTICLERE.key, 8000]);
  // Season 0's last Turning: wiped, and no fee home
  const z = await stood(t);
  z.domain(21, ANTICLERE.key);
  const g = await z.guild('Wren', 'Grey Wren', 'GW');
  z.hold(RIPMORE, g.gid);
  z.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('guild', ?, 'burn', NULL, 'seat-claim', 8000, 1, 1, 'seats', 'The Turning', ?)`).run(g.gid, `claim-${W - 2}-${RIPMORE.key}`);
  const zero = W - 3;
  assert.equal(seasonEndingAt(W, zero)?.n, 0);
  assert.equal((await settleWeek(z.svc.env.DB, W, TURNED, zero, W + 1)).settled, true);
  assert.equal(z.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'domain-fold'").get().n, 0, 'the wipe folds nothing');
  assert.equal(z.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_holds').get().n, 0);
  // the region law's week reaches every Turning: the minute's clock's and every seat route's
  const turning = src('server-account/src/seatTurning.js');
  assert.ok(turning.includes('const r = await settleWeek(db, w, nowS, zero, domainsWeek);'));
  // AUDIT DOMAINS S7: the fold's target read off the registry's region, the one the Charters were read by
  assert.ok(turning.includes('into = domains.get(registry.get(key).region).key'));
  assert.ok(turning.includes('return { settled: await settleDue(db, nowS, zero, domainsWeek), pending: false };'));
  assert.ok(src('server-account/src/cron.js').includes('settleDueOnce(ctx.db, ctx.nowS, seasonZeroOf(env.SEASON_ZERO_WEEK), domainsWeekOf(env.DOMAINS_WEEK))'));
  assert.ok(src('server-account/src/index.js').includes('settleDueOnce(ctx.db, nowS, seasonZeroOf(env.SEASON_ZERO_WEEK), domainsWeekOf(env.DOMAINS_WEEK))'));
});

test('DOMAIN3 A HOLDING\'S PLEDGE CLAIMS NOTHING at the fold\'s Turning, and the seats\' list says the region law - the week it rules from, whether it rules now, each region\'s seat of power; with no DOMAINS_WEEK the list says nothing of it (mutants: the claims\' Charters; the list\'s word)', async (t) => {
  const s = await stood(t, { DOMAINS_WEEK: String(W) });
  s.domain(21, ANTICLERE.key);
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const list = (await s.svc.call('/v1/seats/list', {}, eo.gm.secret)).body;
  assert.deepEqual(list.domains, { from: W, rule: true, seats: [[21, ANTICLERE.key]] });
  const marked = new Map(list.seats.map((x) => [x.key, x]));
  assert.deepEqual([marked.get(ANTICLERE.key).domain, marked.get(RIPMORE.key).charter, 'charter' in marked.get(GLENPOINT.key), 'domain' in marked.get(GLENPOINT.key)], [true, ANTICLERE.key, false, false], 'the seat of power marked, its holding named with its Charter, a region with none as it was');
  const plain = await stood(t);
  const p = await plain.guild('Wren', 'Grey Wren', 'GW');
  assert.equal('domains' in (await plain.svc.call('/v1/seats/list', {}, p.gm.secret)).body, false);
  // a pledge at a holding made under the seat law, the week before the law: settled by region, it claims nothing
  const q = await stood(t);
  q.domain(21, ANTICLERE.key);
  const g = await q.guild('Corin', 'Red Hand', 'RH');
  q.treasury(g.gid, 50_000);
  assert.equal((await q.pledge(g.gm, RIPMORE.key)).status, 200);
  q.raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
    VALUES (?, ?, ?, ?, ?, 'writ', 5000, 21, 1, 'x', ?)`).run(W, RIPMORE.key, g.gid, g.gm.id, g.gm.character, T0);
  q.raw.prepare('INSERT OR IGNORE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(W, g.gm.id, g.gid, g.gm.character, T0);
  assert.equal((await settleWeek(q.svc.env.DB, W, TURNED, null, W + 1)).settled, true);
  assert.equal(q.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_holds').get().n, 0, 'no Charter claimed at a holding');
});

// ─── THE CLIENT ─────────────────────────────────────────────────────

const SH = { id: 'g-sh', name: 'Silver Hand', tag: 'SH', heraldry: { field: 'azure', border: 'or', device: null } };
/** The seats' list as the service sends it under the region law: Anticlere its region's seat of power, held; Ripmore its
 *  holding; Glenpoint a region with none confirmed. */
const LISTED = chartersMarkedFixture();
function chartersMarkedFixture() {
  return [
    { ...ANTICLERE, state: 'confirmed', domain: true, holder: { guild: SH, standing: 85, edict: 'festival', tithe: 5 }, battle: null },
    { ...RIPMORE, state: 'confirmed', charter: ANTICLERE.key, holder: null, battle: null },
    { ...GLENPOINT, state: 'confirmed', holder: null, battle: null },
  ];
}

test('DOMAIN3 THE BOOK: a holding dressed in its Charter as the list says it; a seat of power marked; the seat this client stands in reported with its region\'s seat of power, off the derivation the book is handed - and the Watch\'s pixels off it too (mutants: the dress; the witness\'s domain; the pixels)', async () => {
  const sent = [];
  const door = { list: async () => ({ ok: true, data: { seats: LISTED, domains: { from: W, rule: true, seats: [[21, ANTICLERE.key]] } } }), witness: async (s, d) => { sent.push([s.key, d]); return { ok: true }; } };
  const derived = { list: [ANTICLERE, RIPMORE, GLENPOINT], powers: new Map([[21, ANTICLERE.key], [18, GLENPOINT.key]]) };
  const storage = new Map();
  const book = createTownSeatBook({ door, seats: derived, storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } });
  await book.read();
  const town = book.dressed(RIPMORE);
  assert.equal(town.charterSeat.key, ANTICLERE.key);
  assert.equal(town.charterSeat.holder.guild.tag, 'SH');
  assert.equal(town.holder, null, 'its own Charter none');
  assert.equal(book.dressed(ANTICLERE).domain, true);
  assert.equal('charterSeat' in book.dressed(GLENPOINT), false);
  assert.equal(await book.witness(RIPMORE), true);
  await book.witness(GLENPOINT);
  assert.deepEqual(sent, [[RIPMORE.key, { region: 21, key: ANTICLERE.key }], [GLENPOINT.key, { region: 18, key: GLENPOINT.key }]]);
  const plain = createTownSeatBook({ door: { ...door, list: async () => ({ ok: true, data: { seats: [] } }) }, seats: { list: [ANTICLERE] } });
  await plain.read();
  sent.length = 0;
  await plain.witness(ANTICLERE);
  assert.deepEqual(sent, [[ANTICLERE.key, undefined]], 'no seat of power derived: the seat alone');
  assert.match(src('src/net/townSeatBook.js'), /seats = null,\n\s*isSeatPixel = seats \? seatPixelTest\(seats\) : \(\) => false,/);
  assert.match(src('src/scenes/world.js'), /      seats: townSeats,   \/\/ DOMAIN1 \(HOST-SPLIT\)/);
  assert.match(src('src/net/accountClient.js'), /witness: \(seat, domain = undefined\) => post\('\/v1\/seats\/witness', \{ seat, \.\.\.\(domain \? \{ domain \} : \{\}\) \}\),/);
});

test('DOMAIN3 THE WORDS AND THE MAP: a seat of power\'s Charter named for its region; a holding\'s arrival and its map box name its Charter and the Charter\'s holder, its ring in that holder\'s colours; a board\'s bailiwick among the Charters alone - a holding\'s board pays its Charter\'s Tithe (mutants: the region\'s name; the holding\'s line; the box; the ring; the holdings skipped)', () => {
  const charter = LISTED[0];
  const town = { ...RIPMORE, holder: null, battle: null, charterSeat: charter };
  assert.equal(charterName(charter), 'the Charter of Anticlere');
  assert.equal(charterName({ key: 3501, name: 'Aldcester', region: 35, tier: 'palace', domain: true }), 'the Charter of Koegria', 'ruled from Aldcester');
  assert.equal(charterName({ key: 3501, name: 'Aldcester', region: 35, tier: 'palace' }), 'the Charter of Aldcester', 'the seat law: the town\'s');
  assert.equal(seatArrivalLine(town), 'Ripmore, in the Charter of Anticlere, held by Silver Hand <SH>.');
  assert.equal(seatArrivalLine({ ...town, charterSeat: { ...charter, holder: null } }), 'Ripmore, in the Charter of Anticlere. Its Charter is unheld.');
  assert.equal(seatInfoLine(town, null), 'Ripmore, in the Charter of Anticlere: held by Silver Hand <SH>');
  // AUDIT DOMAINS C2: the seat's own line through the text core whole, its English as it was
  assert.deepEqual([seatInfoLine(charter, SH), seatInfoLine(charter, null)], ['The Charter of Anticlere: held by Silver Hand <SH>', 'The Charter of Anticlere: unheld']);
  assert.match(src('src/net/townSeatLaw.js'), /return holder\n\s*\? t\('seat\.info\.held', '\{charter\}: held by \{guild\}', \{ charter, guild: guildWords\(holder\) \}\)\n\s*: t\('seat\.info\.unheld', '\{charter\}: unheld', \{ charter \}\);/);
  assert.equal(seatMapMark(town).fill, seatMapMark(charter).fill);
  assert.notEqual(seatMapMark(town).fill, null);
  assert.equal(bailiwickOf(LISTED, 21, RIPMORE.pixel).key, ANTICLERE.key, 'the holding skipped');
  assert.equal(boardTithePct(LISTED, 21, RIPMORE.pixel), 5);
  assert.equal(bailiwickOf(LISTED.map(({ charter: _c, ...s }) => s), 21, RIPMORE.pixel).key, RIPMORE.key, 'the seat law: the nearer seat');
  assert.match(holdingTabLine(town), /^Ripmore is a holding of the Charter of Anticlere\. Its Charter is won, held and besieged at Anticlere/);
});

test('DOMAIN3 A HOLDING LIVES UNDER ITS CHARTER: its shops give the Charter holder\'s members their discount, its arrival says the Charter\'s news and takes its Festival, its streets keep the Festival; the Seat tab at its board speaks of the Charter (mutants: the shop\'s Charter; the news; the Festival stage; the tab\'s seat)', () => {
  const charter = LISTED[0];
  const town = { ...RIPMORE, holder: null, battle: null, charterSeat: charter };
  const said = [];
  let festive = 0;
  const edicts = createSeatEdicts({ seatAt: (m) => (m === RIPMORE.key ? town : null), here: () => RIPMORE.key, seats: () => LISTED, guildId: () => SH.id, minutes: () => 0, regionAt: () => 21, say: (l) => said.push(l), onFestive: () => { festive++; } });
  assert.ok(edicts.shopFactor({ townMapId: RIPMORE.key }) < 1, 'a member\'s discount in a holding of the held region');
  edicts.arrived(town);
  assert.equal(festive, 1);
  assert.ok(said.some((l) => /Festival/.test(l)), JSON.stringify(said));
  const stage = createFestivalStage({ seatAt: (m) => (m === RIPMORE.key ? town : null) });
  assert.equal(stage.festive(RIPMORE.key), true);
  const tab = src('src/ui/seatTab.js');
  assert.match(tab, /  const town = host\.seat;\n  const seat = town\?\.charterSeat \?\? town;/);
  assert.match(tab, /if \(town !== seat\) who\.append\(el\('p', 'seat-holding', holdingTabLine\(town\)\)\);/);
  // AUDIT DOMAINS C1: a Harbour is the Charter's own town's coast - never a holding's (Alik'ra's raised one at inland Berbaaqnia)
  assert.match(tab, /  const port = town === seat && host\.port === true;/);
  assert.match(tab, /forts,\n\s*seat,\n\s*port,\n\s*busy: ui\.busy\(\),/);
  assert.match(tab, /onBegin: \(work\) => act\(\(\) => book\.fortFund\(seat, work, port\)\),/);
});
