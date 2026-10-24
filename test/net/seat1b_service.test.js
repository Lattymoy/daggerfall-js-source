// SEAT1b (2026-09-30, Mac: "Finish the seats"): INFLUENCE, AS THE SERVICE KEEPS IT - the pledge, the Watch's receipts,
// a gate kill's region, Renown's region, members' homes, Tribute, and the standings that sum them - driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md
// 4.1-4.2; `06-Systems/Online-Arc.md` SEAT1b.
import { test } from 'node:test';
import { SEAT_ROWS_KEPT_S } from '../../server-account/src/townSeats.js';   // D1-LOAD: the kept rows' minute
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { standService, T0 } from '../accountDb.mjs';
import { realmJoinAt } from '../realmSeat.mjs';   // INT16: an account's other realm character taken up before it claims
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import { mintReceipt } from '../../src/net/gate/gateReceipt.js';
import { gameDayAt, gateTimes } from '../../src/net/gate/gateLaw.js';
import { RENOWN_XP_HOUR_MAX } from '../../src/net/renown.js';
import {
  seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, WATCH_DAY_CAP, SEAT_WATCH_CLAIM_MAX, SEAT_PLEDGE_REGIONS_MAX, ACCOUNT_SEAT_WEEK_CAP,
} from '../../src/net/townSeatLaw.js';
import { agreedGateRegions } from '../../server-account/src/seatInfluence.js';

const subtle = webcrypto.subtle;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ALT = { key: 3022, name: 'Alcaire Keep', region: 21, tier: 'palace', pixel: [410, 160] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [610, 118] };
const DAY = 86400;
const OLD = T0 - SEAT_MEMBER_WAIT_S - DAY;   // a member a week and a day

/** The service with the seats and the Marks open; `confirm(seat)` three witnesses' agreeing rows; `guild(gm, name,
 *  tag)` a guild founded, its guildmaster a week and a day in it; `member(who, gid, rank, joined)` a member row. */
async function stood() {
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  const confirm = (seat) => {
    for (const w of witnesses) {
      raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
    }
  };
  const guild = async (gm, name, tag) => {
    const f = await svc.found(gm, { name, tag });
    assert.equal(f.status, 200, `${name} founded`);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(OLD, gid);
    return gid;
  };
  const member = (who, gid, { rank = 2, joined = OLD, character = who.character } = {}) => raw.prepare(
    'INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(who.id, character, gid, rank, who.handle, joined);
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const pledge = (who, key, extra = {}) => svc.call('/v1/seats/pledge', { character: who.character, key, ...extra }, who.secret);
  const standings = async (who, key = ANTICLERE.key) => (await svc.call('/v1/seats/standings', { key, character: who.character }, who.secret)).body;
  let nonce = 1;
  const tick = (who, seat = ANTICLERE, { at = T0, key = svc.gateKey, s = who.id } = {}) =>
    mintWatchReceipt({ s, x: seat.pixel[0], y: seat.pixel[1], c: nonce++ }, key, { subtle, nowS: at });
  const watch = (who, receipts, character = who.character) => svc.call('/v1/seats/watch', { character, receipts }, who.secret);
  return { svc, raw, confirm, guild, member, treasury, pledge, standings, tick, watch };
}

test('SEAT1b THE PLEDGE: an Officer\'s or the guildmaster\'s, a confirmed seat, one a region (moving replaces), at most five regions, in the Muster alone; a Member is refused; taken down by region (mutants: the ranks; the confirmed seat; the one-a-region conflict; the reach; the phase)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, confirm, guild, member, pledge } = await stood();
  const gm = await svc.seated('Gamal', { renown: 12 });
  const off = await svc.seated('Ofelia');
  const mem = await svc.seated('Menno');
  const gid = await guild(gm, 'Silver Hand', 'SH');
  member(off, gid, { rank: 1 });
  member(mem, gid, { rank: 2 });
  assert.equal((await pledge(gm, ANTICLERE.key)).body.error, 'seat-unconfirmed', 'a seat the witnesses have not confirmed is no pledge');
  confirm(ANTICLERE); confirm(ALT); confirm(WAYREST);
  // PIN MOVED (D1-LOAD): a pledge reads the isolate's kept witness rows (townSeats.js confirmedSeats) - a seat confirmed
  // by witnesses another isolate took is pledgeable within the minute, the seats' list's own bound
  assert.equal((await pledge(gm, ANTICLERE.key)).body.error, 'seat-unconfirmed', 'within the minute: the rows as this isolate kept them');
  now += SEAT_ROWS_KEPT_S;
  assert.equal((await pledge(mem, ANTICLERE.key)).body.error, 'guild-rank', 'a Member pledges nothing');
  const p = await pledge(off, ANTICLERE.key);
  assert.equal(p.status, 200);
  assert.deepEqual(p.body.pledges.map((x) => [x.region, x.key, x.by]), [[21, ANTICLERE.key, 'Ofelia']], 'an Officer pledges');
  const moved = await pledge(gm, ALT.key);
  assert.deepEqual(moved.body.pledges.map((x) => [x.region, x.key]), [[21, ALT.key]], 'one seat a region: the second replaces the first');
  assert.deepEqual((await pledge(gm, WAYREST.key)).body.pledges.map((x) => x.region), [21, 23], 'another region beside it');
  // the reach: five regions, the sixth refused - three more confirmed seats in three more regions
  const more = [[7001, 'Glenpoint', 18, [200, 100]], [7002, 'Tulune', 58, [150, 120]], [7003, 'Kambria', 37, [700, 90]], [7004, 'Ykalon', 40, [720, 80]]]
    .map(([key, name, region, pixel]) => ({ key, name, region, tier: 'palace', pixel }));
  for (const s of more) confirm(s);
  now += SEAT_ROWS_KEPT_S;   // PIN MOVED (D1-LOAD): read here within the minute
  for (const s of more.slice(0, 3)) assert.equal((await pledge(gm, s.key)).status, 200, `${s.name} pledged`);
  const full = await pledge(gm, more[3].key);
  assert.deepEqual([full.status, full.body.error], [409, 'seat-pledges-full'], `a guild's reach is ${SEAT_PLEDGE_REGIONS_MAX} regions`);
  assert.equal((await pledge(gm, ANTICLERE.key)).status, 200, 'moving within a pledged region is no new region');
  const down = await pledge(gm, null, { region: 23 });
  assert.deepEqual(down.body.pledges.map((x) => x.region), [18, 21, 37, 58], 'taken down by its region');
  assert.equal((await pledge(gm, null, { region: 23 })).body.error, 'seat-no-pledge');
  now = T0 + 11 * 3600;   // Friday 19:00 UTC - the Reckoning
  const late = await pledge(gm, WAYREST.key);
  assert.deepEqual([late.status, late.body.error], [409, 'seat-reckoning'], 'pledges lock at the Reckoning');
  assert.equal((await pledge(mem, WAYREST.key)).body.error, 'guild-rank', 'a Member is told its rank before the week');
});

test('SEAT1b THE WATCH: relay-signed ticks in a confirmed seat\'s own pixel count 1 each for the war-guild at its pledge, each receipt once, 60 an account a UTC day; another\'s, an unsigned, another pixel\'s, a last week\'s, and a new member\'s count nothing (mutants: the signature; the account; the pixel; the week; the day cap; the ref; the 7-day wait; the pledge)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, confirm, guild, member, pledge, standings, tick, watch } = await stood();
  confirm(ANTICLERE); confirm(WAYREST);
  const gm = await svc.seated('Gamal', { renown: 12 });
  const gid = await guild(gm, 'Silver Hand', 'SH');
  const r1 = await tick(gm);
  assert.deepEqual((await watch(gm, [r1])).body, { ok: true, counted: 0, why: { 'no-pledge': 1 } }, 'no pledge: nothing banked');
  await pledge(gm, ANTICLERE.key);
  assert.deepEqual((await watch(gm, [r1])).body, { ok: true, counted: 1 });
  assert.deepEqual((await watch(gm, [r1])).body, { ok: true, counted: 0, why: { claimed: 1 } }, 'a receipt counts once');
  const other = await svc.seated('Oswin');
  const unsigned = await tick(gm, ANTICLERE, { key: null });
  const theirs = await tick(other, ANTICLERE);
  const wayrest = await tick(gm, WAYREST);
  const elsewhere = await mintWatchReceipt({ s: gm.id, x: 1, y: 1, c: 99 }, svc.gateKey, { subtle, nowS: T0 });
  const lastWeek = await tick(gm, ANTICLERE, { at: T0 - 7 * DAY + 3600 });
  const w = await watch(gm, [unsigned, theirs, wayrest, elsewhere, lastWeek]);
  assert.deepEqual(w.body.why, { unsigned: 1, 'not-yours': 1, 'no-pledge': 1, 'no-seat': 1, expired: 1 }, 'each refused rung by name');
  // the day cap: 60 an account a UTC day of issue - 59 more, then one refused
  const day = [];
  for (let i = 0; i < WATCH_DAY_CAP; i++) day.push(await tick(gm));
  let counted = 0;
  for (let i = 0; i < 48; i += SEAT_WATCH_CLAIM_MAX) counted += (await watch(gm, day.slice(i, i + SEAT_WATCH_CLAIM_MAX))).body.counted;
  assert.equal(counted, 48);
  const last = await watch(gm, day.slice(48, 60));
  assert.deepEqual([last.body.counted, last.body.why], [11, { capped: 1 }], `${WATCH_DAY_CAP} a UTC day, the first one of the day counted too`);
  assert.equal((await watch(gm, [])).body.error, 'bad-watch');
  assert.equal((await watch(gm, new Array(SEAT_WATCH_CLAIM_MAX + 1).fill(r1))).body.error, 'bad-watch', 'what one request holds, at most');
  // the next UTC day counts afresh
  const tomorrow = Math.floor(T0 / DAY) * DAY + DAY + 60;
  now = tomorrow;
  assert.equal((await watch(gm, [await tick(gm, ANTICLERE, { at: tomorrow })])).body.counted, 1);
  assert.equal((await standings(gm)).standings[0].influence, WATCH_DAY_CAP + 1);
  // a character a week less a day in its guild: nothing, answered by name
  const young = await svc.seated('Yara');
  member(young, gid, { joined: now - SEAT_MEMBER_WAIT_S + DAY });
  assert.deepEqual((await watch(young, [await tick(young, ANTICLERE, { at: now })])).body.why, { 'new-member': 1 });
  // a receipt stood an hour before the Turning, still alive, claimed an hour after it: its week is gone
  const turning = seatWeekStartMs(seatWeekOf(T0 * 1000)) / 1000;
  const stale = await tick(gm, ANTICLERE, { at: turning - 3600 });
  now = turning + 3600;
  assert.deepEqual((await watch(gm, [stale])).body.why, { 'old-week': 1 }, 'a tick counts in the week it was stood');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM town_seat_influence WHERE source = 'watch'").get().n, WATCH_DAY_CAP + 1);
});

test('SEAT1b PER-ACCOUNT WAR: the first guild an account\'s character contributes to is its war-guild for the week; its other character earns nothing for another guild - Renown through that character refused, the Watch counted for the war-guild through the account\'s seasoned member (mutants: the bind; the bound-elsewhere read; anyCharacter)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, raw, confirm, guild, member, pledge, standings, tick, watch } = await stood();
  confirm(ANTICLERE);
  const a = await svc.seated('Adala', { renown: 12 });
  const b = await svc.seated('Bodil', { renown: 12 });
  // PIN MOVED (INT16, Integrity-Arc section 7): Renown and the Watch are asked of the account's SEATED realm character
  // (progress.js progressRefusal) - so Bodil's second character is a realm character of its own (the one it was seated
  // as; the founding below seats the Ebon Oath's founder), taken up (a join) before it claims, where an offline
  // 'bodil-alt' is refused 'progress-seat' before the seats' law reads it
  const bAlt = b.character;
  const ga = await guild(a, 'Silver Hand', 'SH');
  const gb = await guild(b, 'Ebon Oath', 'EO');
  await pledge(a, ANTICLERE.key);
  await pledge(b, ANTICLERE.key);
  // Bodil's account has a second character, a seasoned member of the Silver Hand
  member(b, ga, { character: bAlt });
  // it contributes first through its Ebon Oath character: bound to the Oath
  assert.equal((await watch(b, [await tick(b)])).body.counted, 1);
  assert.equal(raw.prepare('SELECT guild_id FROM town_seat_binds WHERE account = ?').get(b.id).guild_id, gb);
  await realmJoinAt(svc.env, b.secret, bAlt);   // the account takes up its Silver Hand character - its seat now
  // its Silver Hand character's Renown counts nothing for the Hand
  const rep = await svc.call('/v1/renown/xp', { character: bAlt, xp: 200, rid: 'b0d11a0000000001', region: 21 }, b.secret);
  assert.equal(rep.status, 200, 'the report stands');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM town_seat_renown WHERE account = ?').get(b.id).n, 0, 'no Renown for another guild');
  // its Watch ticks through the Silver Hand character count for the Oath - the account's war, through a seasoned member of it
  assert.equal((await watch(b, [await tick(b)], bAlt)).body.counted, 1);
  const s = (await standings(a)).standings;
  assert.deepEqual(s.map((x) => [x.guild.tag, x.influence]), [['EO', 2], ['SH', 0]]);
  void gb;
});

test('SEAT1b GATE KILLS: a claim names its region; a kill counts 300 for the war-guild where three of the day\'s claims agree on the region, only in its own week, 900 an account a week (mutants: the region stored; the agreement count; the level top; the week; the week cap)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, confirm, guild, pledge, standings } = await stood();
  confirm(ANTICLERE);
  const gm = await svc.seated('Gamal', { renown: 12 });
  await guild(gm, 'Silver Hand', 'SH');
  await pledge(gm, ANTICLERE.key);
  const others = [];
  for (const h of ['Adala', 'Bodil', 'Cyril', 'Dinah', 'Edric']) others.push(await svc.seated(h));
  const today = gameDayAt(T0 * 1000);
  const kill = async (who, day, region) => svc.call('/v1/gate/claim', {
    receipt: await mintReceipt({ d: day, b: 'ruhn', s: who.id, c: 4242, x: 'dealt' }, svc.gateKey, { subtle, nowS: now }), region, character: who.character,
  }, who.secret);
  const days = [today - 4, today - 3, today - 2, today - 1, today].filter((d) => seatWeekOf(gateTimes(d).riseAt) === seatWeekOf(T0 * 1000));
  assert.equal(days.length, 5, 'five gate days inside the week');
  const first = await kill(gm, days[0], 21);
  assert.deepEqual(first.body.seat, { counted: true, key: ANTICLERE.key }, 'the kill written for the pledge');
  assert.equal((await standings(gm)).standings[0].influence, 0, 'one claim alone agrees on nothing');
  await kill(others[0], days[0], 21);
  assert.equal((await standings(gm)).standings[0].influence, 0, 'two agree: not yet');
  await kill(others[1], days[0], 21);
  assert.equal((await standings(gm)).standings[0].influence, 300, 'three agree: 300');
  // a day whose claims tie at the top - three for 21, three for 30 - agrees on neither
  // PIN MOVED (AUDIT-SEATS): another account's claim stands in the tie where the guildmaster's stood - the week's cap is now
  // three gate claims an account, every seat together, asked in the write (S7, 4.2: "(three receipts)"), so the
  // guildmaster's unagreed claim here would spend one of its three and the four agreed below would not reach 900
  await kill(await svc.seated('Fenna'), days[1], 21);
  await kill(others[0], days[1], 21); await kill(others[1], days[1], 21);
  for (const o of others.slice(2, 5)) await kill(o, days[1], 30);
  assert.equal((await standings(gm)).standings[0].influence, 300, 'a level top agrees on nothing');
  // PIN MOVED (AUDIT SEATS-3 F2): the tie's claims are none of the Hand's, so the standing above holds either way - the
  // day's agreement itself is asked
  assert.equal((await agreedGateRegions(svc.env.DB, [days[1]])).has(days[1]), false, 'a level top agrees on nothing');
  assert.equal((await agreedGateRegions(svc.env.DB, [days[0]])).get(days[0]), 21);
  await kill(others[1], days[2], 30);
  // the week's cap: four agreed kills, 900
  for (const d of days.slice(2)) { await kill(gm, d, 21); for (const o of others.slice(2, 4)) await kill(o, d, 21); }
  assert.equal((await standings(gm)).standings[0].influence, 900, 'four agreed kills: 900 an account a week');
  const weekStart = seatWeekStartMs(seatWeekOf(T0 * 1000));
  let lastWeeks = gameDayAt(weekStart);
  while (gateTimes(lastWeeks).riseAt >= weekStart) lastWeeks--;   // the last gate day to rise before the Turning
  assert.deepEqual((await kill(gm, lastWeeks, 21)).body.seat, { counted: false, why: 'old-week' }, 'a kill counts in its own game day\'s week');
  const noRegion = await kill(others[4], days[4], null);
  assert.equal(noRegion.body.seat, undefined, 'a claim naming no region is answered as before');
});

test('SEAT1b RENOWN AND HOMES: a report\'s region keeps what it CREDITED for the character\'s war-guild, 1 per 20 at most 400 an account a week; a bound member\'s home in the seat\'s town 25 a day, the guild\'s five longest-standing (mutants: credited not asked; the repeat; 20; 400; the homes\' five; the 7-day member; the bound account)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, confirm, guild, member, pledge, standings, tick, watch } = await stood();
  confirm(ANTICLERE);
  const gm = await svc.seated('Gamal', { renown: 12 });
  const gid = await guild(gm, 'Silver Hand', 'SH');
  await pledge(gm, ANTICLERE.key);
  // the hour nearly spent: the report asks 390 and is credited 100
  raw.prepare('UPDATE players SET renown_hour = ?, renown_hour_xp = ? WHERE id = ?').run(Math.floor(T0 / 3600), RENOWN_XP_HOUR_MAX - 100, gm.id);
  const r = await svc.call('/v1/renown/xp', { character: gm.character, xp: 390, rid: 'a1b2c3d4e5f60001', region: 21 }, gm.secret);
  assert.deepEqual([r.status, r.body.credited], [200, 100]);
  assert.equal((await standings(gm)).standings[0].influence, 5, '1 per 20 XP CREDITED, never asked');
  const again = await svc.call('/v1/renown/xp', { character: gm.character, xp: 390, rid: 'a1b2c3d4e5f60001', region: 21 }, gm.secret);
  assert.equal(again.body.repeat, true);
  assert.equal(raw.prepare('SELECT xp FROM town_seat_renown WHERE account = ?').get(gm.id).xp, r.body.credited, 'a repeat keeps nothing more');
  raw.prepare('UPDATE town_seat_renown SET xp = 50000 WHERE account = ?').run(gm.id);
  assert.equal((await standings(gm)).standings[0].influence, 400, '400 an account a week');
  raw.prepare('DELETE FROM town_seat_renown').run();
  // homes: six members' homes in the town, bought 1..6 days into the week; the five longest count, 25 a day
  const weekStartS = seatWeekStartMs(seatWeekOf(T0 * 1000)) / 1000;
  const owners = [];
  for (let i = 0; i < 6; i++) {
    const o = await svc.seated(`Owner${i}x`);
    member(o, gid);
    raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at)
      VALUES (?, ?, ?, ?, ?, 21, 'private', 1000, ?)`).run(ANTICLERE.key, 100 + i, o.id, o.character, o.handle, weekStartS - (i === 0 ? 30 * DAY : 0) + i * 3600);
    owners.push(o);
  }
  assert.equal((await standings(gm)).standings[0].influence, 0, 'a home counts only for an account bound to the guild');
  for (const o of owners) { now = T0; await watch(o, [await tick(o)]); }   // each binds its account by a tick
  const s = (await standings(gm)).standings[0];
  // homes stood 4 whole days (the week's start to Friday 08:00, less hours) - five of them, 25 a day, plus six ticks
  assert.equal(s.influence, 5 * 4 * 25 + 6, 'the five longest-standing homes, 25 a day each');
  // a member of six days: its home counts nothing - the sixth home steps in, and with it gone too, four stand
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE player = ?').run(T0 - SEAT_MEMBER_WAIT_S + DAY, owners[0].id);
  assert.equal((await standings(gm)).standings[0].influence, 5 * 4 * 25 + 6, 'the sixth home steps in for the new member\'s');
  raw.prepare('DELETE FROM homes WHERE player = ?').run(owners[5].id);
  assert.equal((await standings(gm)).standings[0].influence, 4 * 4 * 25 + 6, 'a new member\'s home is no home of the guild\'s');
});

test('SEAT1b TRIBUTE: the guildmaster burns Drakes from the treasury on a pledge, 1 influence per 10, never past a fifth of the guild\'s week; a repeat is answered, an Officer and a short treasury refused (mutants: the rank; the room; the burn line; the repeat; the balance guard)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, raw, confirm, guild, member, treasury, pledge, standings, tick, watch } = await stood();
  confirm(ANTICLERE);
  const gm = await svc.seated('Gamal', { renown: 12 });
  const off = await svc.seated('Ofelia');
  const gid = await guild(gm, 'Silver Hand', 'SH');
  member(off, gid, { rank: 1 });
  await pledge(gm, ANTICLERE.key);
  treasury(gid, 5000);
  const pay = (who, marks, rid) => svc.call('/v1/seats/tribute', { character: who.character, key: ANTICLERE.key, marks, rid }, who.secret);
  assert.equal((await pay(off, 10, 'tribute-off-0001')).body.error, 'guild-rank', 'the guildmaster\'s alone');
  const none = await pay(gm, 10, 'tribute-gm-000001');
  assert.deepEqual([none.status, none.body.error], [409, 'seat-tribute-cap'], 'nothing else earned: no room');
  // 40 ticks: room for 10 influence (a fifth of 50) - 100 Drakes
  const ticks = [];
  for (let i = 0; i < 40; i++) ticks.push(await tick(gm));
  for (let i = 0; i < 40; i += SEAT_WATCH_CLAIM_MAX) await watch(gm, ticks.slice(i, i + SEAT_WATCH_CLAIM_MAX));
  assert.equal((await standings(gm)).mine.tributeRoom, 100);
  assert.equal((await pay(gm, 15, 'tribute-gm-000002')).body.error, 'bad-tribute', 'tens of Drakes');
  assert.equal((await pay(gm, 110, 'tribute-gm-000003')).body.error, 'seat-tribute-cap');
  const paid = await pay(gm, 100, 'tribute-gm-000004');
  assert.deepEqual(paid.body, { ok: true, influence: 10, marks: 100 });
  assert.deepEqual((await pay(gm, 100, 'tribute-gm-000004')).body, { ok: true, repeat: true }, 'asked again: the line it made');
  assert.equal(raw.prepare("SELECT balance FROM guild_marks WHERE guild_id = ?").get(gid).balance, 4900, 'burnt from the treasury');
  assert.deepEqual({ ...raw.prepare("SELECT src_kind, dst_kind, kind, amount FROM marks_ledger WHERE rid = 'tribute-gm-000004'").get() }, { src_kind: 'guild', dst_kind: 'burn', kind: 'tribute', amount: 100 });
  const st = await standings(gm);
  assert.deepEqual([st.standings[0].influence, st.standings[0].tribute, st.mine.tributeRoom], [50, 10, 0]);
  // a short treasury: the room is there (more ticks), the Drakes are not
  raw.prepare('UPDATE guild_marks SET balance = 5 WHERE guild_id = ?').run(gid);
  const more = [];
  for (let i = 0; i < 20; i++) more.push(await tick(gm));
  for (let i = 0; i < 20; i += SEAT_WATCH_CLAIM_MAX) await watch(gm, more.slice(i, i + SEAT_WATCH_CLAIM_MAX));
  assert.equal((await pay(gm, 10, 'tribute-gm-000005')).body.error, 'guild-marks-short');
});

test('SEAT1b THE ACCOUNT\'S CAP AND THE STANDINGS\' SHAPE: 2,000 an account a seat a week from every source together; the answer names the week\'s clock, each pledged guild\'s influence under its banner, and the reader\'s own guild, war and week (mutants: the account cap; the order; mine)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, raw, confirm, guild, pledge, standings } = await stood();
  confirm(ANTICLERE);
  const gm = await svc.seated('Gamal', { renown: 12 });
  const gid = await guild(gm, 'Silver Hand', 'SH');
  await pledge(gm, ANTICLERE.key);
  const week = seatWeekOf(T0 * 1000);
  raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, gm.id, gid, gm.character, T0);
  for (let i = 0; i < 3000; i++) {
    raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, ?, 'watch', 1, 21, ?, ?, ?)`).run(week, ANTICLERE.key, gid, gm.id, gm.character, 20000 + Math.floor(i / 60), `x:${i}`, T0);
  }
  const s = await standings(gm);
  assert.equal(s.standings[0].influence, ACCOUNT_SEAT_WEEK_CAP, 'one account, 2,000 a seat a week');
  assert.deepEqual(Object.keys(s).sort(), ['battle', 'chronicle', 'defence', 'fight', 'holder', 'mine', 'phase', 'reckoningAt', 'royal', 'season', 'seat', 'standings', 'tides', 'turningAt', 'week']);   // SEAT1c: the holder, its defence, the week's battle, the Chronicle; SEAT2a (PIN MOVED): the battle placed and its sides (`fight`, null where none); CROWN1 part two (PIN MOVED): a crown's Royal Tourney (`royal`, null where none); SEASON1 (PIN MOVED): the Season counted (`season`, null where none); SEASON1 part two (PIN MOVED): the Tides (`tides`, null where no Season is counted)
  assert.deepEqual([s.phase, s.week, s.seat.key], ['muster', week, ANTICLERE.key]);
  assert.deepEqual(s.standings[0].guild, { id: gid, name: 'Silver Hand', tag: 'SH', heraldry: null });
  // CROWN2 (PIN MOVED): the guild's crown politics ride `mine` too
  assert.deepEqual(s.mine, { guild: gid, rank: 0, seasoned: true, bound: gid, pledges: [{ region: 21, key: ANTICLERE.key, by: 'Gamal', at: T0 }], influence: ACCOUNT_SEAT_WEEK_CAP, tributeRoom: 5000, politics: { fealty: [], pacts: [] } });
  assert.equal((await svc.call('/v1/seats/standings', { key: 999 }, gm.secret)).body.error, 'seat-unconfirmed');
});
