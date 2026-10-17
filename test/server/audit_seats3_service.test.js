// AUDIT SEATS-3 (2026-10-02, Mac: "Audit everything") - THE
// SEATS IN THE ACCOUNT SERVICE, THE THIRD AUDIT'S FINDINGS FIXED: an Edict re-proclaimed between the Turning's read and
// its batch made law at the new edict over the old one's escrow (A1); a Season's wear lowered a Market Hall under a Tithe
// set at its higher cap, which stood (A2); a siege's Honours paid to any character id the request named (A3); a guild's
// Pact breaks unlimited, every red line of a day carried on every list (A4); the holder's upkeep read over last week's
// accounts where the Turning burns this week's (D1); a guild's five-region reach counted over its pledges, never the
// regions it holds (D5); the market's read never saying the board's listing cap (D2's service half). Driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs), and the statements a batch carries
// where a Worker path cannot reach the state (a Season's wear). bible/11-Multiplayer/Seats-Arc.md 4.1, 6.8, 7.1, 7.5,
// 7.6, 7.8, 9.1; server-account/src/seatTurning.js, seatForts.js, seatHolding.js, seatSiege.js, seatPolitics.js,
// seatInfluence.js, market.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, SEAT_EDICTS_HOUR, SEAT_UPKEEP, CROWN_SCALE, BOUNTY_MARKS, TITHE_CAP } from '../../src/net/townSeatLaw.js';
import { marketHallListings } from '../../src/net/fortLaw.js';
import { MARKET_LISTINGS_MAX } from '../../src/net/marketLaw.js';
import { _b64url } from '../../src/net/identityToken.js';
import { SIEGE_RECEIPT_V, SIEGE_RECEIPT_TTL_S } from '../../src/net/siege/siegeReceipt.js';
import { fortsSeasonStatements } from '../../server-account/src/seatForts.js';
import { titheAt, holdingOf } from '../../server-account/src/seatHolding.js';
import { redOf, SEAT_RED_MAX } from '../../server-account/src/seatPolitics.js';

const { subtle } = globalThis.crypto;
const src = (f) => readFileSync(new URL(`../../server-account/src/${f}`, import.meta.url), 'utf8');
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const SEATS = [ANTICLERE, ASHFIELD, ALCAIRE, WAYREST];
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);   // T0 is a Friday morning: the Muster of week W
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const enc = new TextEncoder();

/** A siege receipt minted as the relay mints one (test/net/audit_seats_service.test.js's mint). */
async function mintSiege(claims, key, nowS) {
  const c = { ...claims, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S };
  const body = _b64url.encode(enc.encode(JSON.stringify(c)));
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, key, enc.encode(`${SIEGE_RECEIPT_V}.${body}`)));
  return `${SIEGE_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

async function stood(t, extra = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Devra', ...extra });
  const raw = svc.env.DB._raw;
  // every statement carries its SQL, so a test can know the Turning's batch (its first statement the week's own key)
  const prep = svc.env.DB.prepare.bind(svc.env.DB);
  svc.env.DB.prepare = (sql) => { const st = prep(sql); st._sql = sql; return st; };
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of SEATS) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, rank = 2, week = W) => {
    const m = await svc.registered(handle, { renown: 5 });
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, T0 - 30 * DAY);
    raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, m.id, g.gid, m.character, T0);
    return m;
  };
  let seed = 0;
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-g-${++seed}`);
  const earn = async (gid, seat, amount, week = W) => {
    while (amount > 0) {
      const a = await svc.guest();
      const n = Math.min(2000, amount);
      raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
      raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, n, seat.region, `t:${a.id}:${week}:${seat.key}`, now);
      amount -= n;
    }
  };
  const pledge = (gid, seat, week = W) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(week, gid, seat.region, seat.key, 'x', T0);
  const hold = (seat, gid, o = {}) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`).run(seat.key, gid, seat.region, seat.tier, o.since ?? W - 2, o.standing ?? 50, T0 - 14 * DAY, o.tithe ?? 6, o.owed ?? 0);
  const lines = (kind) => raw.prepare('SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind).map((l) => [l.src_kind, l.src_id, l.dst_kind, l.dst_id, l.amount]);
  const call = (path, body, who) => svc.call(path, body, who.secret);
  const list = (who) => call('/v1/seats/list', {}, who);
  const battle = (seat = ANTICLERE, week = W + 1) => { const b = raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(week, seat.key); return b ? { ...b } : null; };
  return { svc, raw, guild, member, treasury, earn, pledge, hold, lines, call, list, battle, setNow: (n) => { now = n; }, getNow: () => now };
}

// ─── A1 ──────────────────────────────────────────────────────────────

/** THE RACE: the Silver Hand holds Anticlere and proclaims a 20-Drake Bounty for W+1; the moment the Turning's batch is
 *  about to run, a request stamped just before the boundary re-proclaims it with `second`. Answers the Edict row of W+1. */
async function edictRace(t, second) {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 5000);
  await s.earn(sh.gid, ANTICLERE, 500);
  const off = await s.member(sh, 'Ofelia', 1);
  s.setNow(turning(W) - 3600);
  const first = await s.call('/v1/seats/edict', { character: off.character, key: ANTICLERE.key, edict: 'bounty', setAside: BOUNTY_MARKS }, off);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const db = s.svc.env.DB;
  const orig = db.batch.bind(db);
  let armed = true, raced = null;
  db.batch = async (list) => {
    if (armed && list[0]?._sql?.includes('town_seat_weeks')) {
      armed = false;
      const keep = s.getNow();
      s.setNow(turning(W) - 1);
      raced = await s.call('/v1/seats/edict', { character: off.character, key: ANTICLERE.key, ...second }, off);
      s.setNow(keep);
    }
    return orig(list);
  };
  s.setNow(AFTER(W));
  await s.list(sh.gm);   // the Turning planned over the 20, and its batch met the re-proclaimed row
  assert.equal(raced?.status, 200, JSON.stringify(raced?.body));
  assert.equal(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W), undefined, 'the settle rolled back whole');
  await s.list(sh.gm);   // the next read plans it again, over the row as it stands
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W), 'and settles it');
  const e = s.raw.prepare('SELECT edict, state, set_aside, cost, spent FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 1);
  return { s, sh, e: e ? { ...e } : null };
}

test('AUDIT SEATS-3 A1: AN EDICT RE-PROCLAIMED BETWEEN THE TURNING\'S READ AND ITS BATCH - a 20-Drake Bounty made 100,000 rolls the settle back, and the next read finds it unpaid (the treasury holds 2,500 after the upkeep): nothing escrowed, nothing made law (it was law at 100,000 over a 20-Drake escrow, its camps paid from Marks never set aside) (mutants: the edict asked; the set-aside asked; the guard after the law; the guard after the unpaid)', async (t) => {
  const { s, e } = await edictRace(t, { edict: 'bounty', setAside: 100000 });
  assert.deepEqual([e.edict, e.state, e.set_aside], ['bounty', 'unpaid', 100000]);
  assert.deepEqual(s.lines('bounty-escrow'), [], 'no escrow at all - never the 20 under a 100,000 law');
  assert.deepEqual(s.lines('seat-upkeep').map((l) => l[4]), [SEAT_UPKEEP.palace], 'the upkeep paid once, by the settle that stood');
});

test('AUDIT SEATS-3 A1: THE RACE RE-PLANNED - a 20-Drake Bounty made 40 is law at 40, its escrow 40, its cost the 40 (the plan\'s first read paid 20 into an escrow the row said held 40); a Bounty taken back is no law and no escrow', async (t) => {
  const { s, sh, e } = await edictRace(t, { edict: 'bounty', setAside: 40 });
  assert.deepEqual([e.edict, e.state, e.set_aside, e.cost], ['bounty', 'law', 40, 40]);
  assert.deepEqual(s.lines('bounty-escrow'), [['guild', sh.gid, 'escrow', `bounty:${ANTICLERE.key}:${W + 1}`, 40]]);
});

test('AUDIT SEATS-3 A1: AN EDICT TAKEN BACK MID-SETTLE - no row to make law: the settle rolls back, the next read finds none, nothing escrowed', async (t) => {
  const { s, e } = await edictRace(t, { edict: null });
  assert.equal(e, null);
  assert.deepEqual(s.lines('bounty-escrow'), []);
});

test('AUDIT SEATS-3 A1 (source): the law and the unpaid writes ask the planned edict and set-aside, each guarded', () => {
  const tu = src('seatTurning.js');
  assert.match(tu, /UPDATE town_seat_edicts SET state = 'law', cost = \? WHERE key = \? AND week = \? AND guild_id = \? AND state = 'proclaimed' AND edict = \? AND set_aside = \?"\)\n\s*\.bind\(e\.cost, e\.key, next, e\.guild, e\.edict, askedAside\(e\)\), mustChange\(db\)\);/);
  assert.match(tu, /UPDATE town_seat_edicts SET state = 'unpaid' WHERE key = \? AND week = \? AND guild_id = \? AND state = 'proclaimed' AND edict = \? AND set_aside = \?"\)\n\s*\.bind\(e\.key, next, e\.guild, e\.edict, askedAside\(e\)\), mustChange\(db\)\);/);
});

// ─── A2 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-3 A2: A SEASON\'S WEAR LOWERS THE MARKET HALL AND THE TITHE WITH IT - a palace\'s 11% under a first-tier Hall is 10% once the Hall wears to nought; a crown\'s 12% under its own 15 stands; and a Tithe row above its Hall\'s cap is charged at the cap (titheAt, the belt) (mutants: the clamp; the tier\'s cap; the Hall\'s tier; titheAt\'s cap)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const ic = await s.guild('Cyril', 'Iron Circle', 'IC');
  s.hold(ANTICLERE, sh.gid, { tithe: 0 });
  s.hold(WAYREST, ic.gid, { tithe: 12 });
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'market', 1, ?)").run(ANTICLERE.key, T0);
  s.setNow(T0 + 3600);
  assert.deepEqual((await s.call('/v1/seats/tithe', { character: sh.gm.character, key: ANTICLERE.key, pct: 11 }, sh.gm)).body, { ok: true, tithe: 11 });
  const db = s.svc.env.DB;
  assert.equal((await titheAt(db, T0 + 3600, 21, ANTICLERE.pixel)).pct, 11, 'the Hall standing: 11');
  await db.batch(fortsSeasonStatements(db));   // the Season's end, as the Turning runs it
  const tithe = (seat) => s.raw.prepare('SELECT tithe FROM town_seat_holds WHERE key = ?').get(seat.key).tithe;
  assert.equal(tithe(ANTICLERE), TITHE_CAP.palace, 'worn to nought: the palace\'s ten');
  assert.equal(tithe(WAYREST), 12, 'a Tithe under the cap stands');
  assert.equal((await titheAt(db, T0 + 7200, 21, ANTICLERE.pixel)).pct, TITHE_CAP.palace);
  // the belt: a row above its cap however it came there is charged at the cap
  s.raw.prepare('UPDATE town_seat_holds SET tithe = 11 WHERE key = ?').run(ANTICLERE.key);
  assert.equal((await titheAt(db, T0 + 7200, 21, ANTICLERE.pixel)).pct, TITHE_CAP.palace);
  s.raw.prepare("UPDATE town_seat_forts SET tier = 1 WHERE key = ? AND work = 'market'").run(ANTICLERE.key);
  assert.equal((await titheAt(db, T0 + 7200, 21, ANTICLERE.pixel)).pct, 11, 'a Hall standing again: its point');
});

// ─── A3 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-3 A3: A SIEGE\'S HONOURS GO TO THE CHARACTER ON THE ROSTER - a claim naming another character id of the account, or one not in the saves\' shape, is refused \'honours-character\' (the result written whatever); the rostered character\'s claim is paid (mutants: the shape; the roster\'s character; the battle asked)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 10000);
  await s.earn(sh.gid, ANTICLERE, 500);
  s.pledge(eo.gid, ANTICLERE);
  await s.earn(eo.gid, ANTICLERE, 7000);
  const a1 = await s.member(eo, 'Arden'), d1 = await s.member(sh, 'Dorran');
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.equal(s.battle()?.state, 'scheduled', 'the siege placed');
  for (const who of [a1, d1]) assert.equal((await s.call('/v1/seats/siege/sign', { character: who.character, key: ANTICLERE.key }, who)).status, 200);
  s.setNow(s.battle().starts_at + 1500);
  const claim = async (who, character) => s.call('/v1/seats/siege/claim', {
    receipt: await mintSiege({ s: who.id, sk: ANTICLERE.key, sw: W + 1, sd: 'attack', r: 'attack', a: 1, h: 1, th: 0 }, s.svc.gateKey, s.getNow()), character,
  }, who);
  assert.equal((await claim(a1, 'another-character-1')).body.error, 'honours-character', 'a character id not on the roster');
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_results WHERE week = ? AND key = ?').get(W + 1, ANTICLERE.key), 'the result written whatever');
  assert.equal((await claim(a1, 'not a char id!')).body.error, 'honours-character', 'not the saves\' shape');
  assert.equal((await claim(a1, 'x'.repeat(65))).body.error, 'honours-character');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_honours').get().n, 0, 'no Honours row for either');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM renown_tracks WHERE char_id = 'another-character-1'").get().n, 0, 'no Renown track opened');
  s.raw.prepare('UPDATE town_seat_rosters SET char_id = ? WHERE account = ?').run('bad id!', a1.id);
  assert.equal((await claim(a1, 'bad id!')).body.error, 'honours-character', 'a rostered id not in the saves\' shape (a Sellsword signs any)');
  s.raw.prepare('UPDATE town_seat_rosters SET char_id = ? WHERE account = ?').run(a1.character, a1.id);
  const ok = await claim(a1, a1.character);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.honours.won, true);
  assert.equal(s.raw.prepare('SELECT char_id FROM town_seat_honours WHERE account = ?').get(a1.id).char_id, a1.character);
});

// ─── A4 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-3 A4: A GUILD\'S PACT BREAKS ARE RATE-LIMITED BY THE GUILD - five an hour across its officers, the sixth \'seats-rate\' from yet another officer, the other guild\'s own break still standing; the red lines carried are the newest twenty, oldest first (mutants: the guild\'s key; the cap; the LIMIT; the order)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const [a, b] = sh.gid < eo.gid ? [sh.gid, eo.gid] : [eo.gid, sh.gid];
  const sign = () => s.raw.prepare("INSERT INTO guild_pacts (a, b, state, offered_by, until_week, at) VALUES (?, ?, 'signed', ?, ?, ?)").run(a, b, sh.gid, W + 4, T0);
  const officers = [sh.gm];
  for (let i = 0; i < SEAT_EDICTS_HOUR; i++) officers.push(await s.member(sh, `Officer${i}`, 1));
  for (let i = 0; i < SEAT_EDICTS_HOUR; i++) {
    sign();
    assert.deepEqual((await s.call('/v1/seats/pact/break', { character: officers[i].character, tag: 'EO' }, officers[i])).body, { ok: true, announced: true }, `break ${i + 1}`);
  }
  sign();
  const late = officers[SEAT_EDICTS_HOUR];
  assert.equal((await s.call('/v1/seats/pact/break', { character: late.character, tag: 'EO' }, late)).body.error, 'seats-rate', 'the guild\'s hour, whoever pulls it');
  assert.deepEqual((await s.call('/v1/seats/pact/break', { character: eo.gm.character, tag: 'SH' }, eo.gm)).body, { ok: true, announced: true }, 'the other guild\'s own');
  // the red lines: thirty in the day, the newest twenty carried, oldest first
  for (let i = 0; i < 30; i++) s.raw.prepare('INSERT INTO town_seat_red (text, at) VALUES (?, ?)').run(`line ${i}`, T0 - 60 + i);
  const red = await redOf(s.svc.env.DB, T0);
  assert.equal(SEAT_RED_MAX, 20);
  assert.equal(red.length, SEAT_RED_MAX);
  const all = s.raw.prepare('SELECT seq FROM town_seat_red ORDER BY seq').all().map((r) => Number(r.seq));
  assert.deepEqual(red.map((r) => r.id), all.slice(-SEAT_RED_MAX), 'the newest, oldest first');
  assert.equal((await s.list(sh.gm)).body.red.length, SEAT_RED_MAX, 'and the list carries them');
});

// ─── D1 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-3 D1: A CROWN\'S UPKEEP AS ITS HOLDER READS IT IS WHAT THE TURNING BURNS - the crown\'s scale over the accounts that played the week it settles (120 this week, 10 the last: the holder read 0.4 of 15,000 and the Turning burnt 1.2 of it) (mutants: the week read)', async (t) => {
  const s = await stood(t);
  const ic = await s.guild('Cyril', 'Iron Circle', 'IC');
  s.hold(WAYREST, ic.gid);
  s.treasury(ic.gid, 30000);
  await s.earn(ic.gid, WAYREST, 500);
  const played = (n, at, tag) => { for (let i = 0; i < n; i++) s.raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, played_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(`${tag}-${i}`, `${tag}${i}`, `${tag}${i}`.toLowerCase(), `Guest ${tag}${i}`, T0 - 30 * DAY, at, at); };
  played(10, T0 - 7 * DAY, 'Last');
  played(120, T0 + 3600, 'This');
  s.setNow(turning(W) - 60);
  const read = await holdingOf(s.svc.env.DB, WAYREST.key, s.getNow());
  assert.ok(read.upkeep > Math.floor(SEAT_UPKEEP.crown * CROWN_SCALE.least), `this week's scale, not last week's floor: ${read.upkeep}`);
  s.setNow(AFTER(W));
  await s.list(ic.gm);
  assert.deepEqual(s.lines('seat-upkeep').map((l) => l[4]), [read.upkeep], 'the upkeep read is the upkeep burnt');
});

// ─── D5 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-3 D5: A GUILD\'S FIVE REGIONS COUNT THE REGIONS IT HOLDS - holding in two and pledged in three, a sixth region\'s pledge is \'seat-pledges-full\' (it stood: the count saw three); a pledge let go, it stands; a region held and pledged counts once (mutants: the held regions; the region pledged now excluded; the UNION\'s once)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.hold(WAYREST, sh.gid);
  for (const region of [40, 41, 42]) s.raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W, sh.gid, region, 3000 + region, 'x', T0);
  const pledge = () => s.call('/v1/seats/pledge', { character: sh.gm.character, key: ALCAIRE.key }, sh.gm);
  const full = await pledge();
  assert.deepEqual([full.status, full.body.error], [409, 'seat-pledges-full'], JSON.stringify(full.body));
  s.raw.prepare('DELETE FROM town_seat_pledges WHERE week = ? AND guild_id = ? AND region = 42').run(W, sh.gid);
  assert.equal((await pledge()).status, 200, 'four regions and this one: five');
  // a held region with a stray pledge row in it counts once
  s.raw.prepare('DELETE FROM town_seat_pledges WHERE week = ? AND guild_id = ? AND key = ?').run(W, sh.gid, ALCAIRE.key);
  s.pledge(sh.gid, ANTICLERE);
  assert.equal((await pledge()).status, 200, 'region 21 held and pledged: one region');
});

// ─── D2 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-3 D2: THE MARKET\'S READ SAYS THE BOARD\'S LISTING CAP - `listingsMax` beside `counts`: thirty with no board or another town\'s, a quarter more at a board in a town with a first-tier Market Hall; a piece from a realm record lists under the same cap (mutants: the board read; the Hall; the realm path\'s cap)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'market', 1, ?)").run(ANTICLERE.key, T0);
  const seller = await s.svc.registered('Selma');
  const read = async (board) => (await s.call('/v1/market/read', { character: seller.character, region: 21, view: 'materials', hubs: { 21: [402, 151] }, ...(board ? { board } : {}) }, seller)).body;
  const none = await read(null);
  assert.equal(none.ok, true, JSON.stringify(none));
  assert.equal(none.listingsMax, MARKET_LISTINGS_MAX);
  assert.equal((await read([470, 160])).listingsMax, MARKET_LISTINGS_MAX, 'another town\'s board');
  assert.equal((await read([402, 151])).listingsMax, marketHallListings(MARKET_LISTINGS_MAX, 1), 'Anticlere\'s board');
  assert.equal(marketHallListings(MARKET_LISTINGS_MAX, 1), 37);
  const mk = src('market.js');
  assert.match(mk, /if \(kind === 'item'\) return listGood\(ctx, player, env, \{ character, region, item, pick, price, hubs, rid, currency, realm, board, vendor \}\);/);   // PIN MOVED (HOME-VENDOR): and the trader it is stocked at
  // MARKET-AUDIT (PIN MOVED): a trader's stock is its own count (VENDOR_STOCK_MAX) - a board listing's cap the board's still
  assert.match(mk, /const listingsMax = vend \? VENDOR_STOCK_MAX : await listingsCapAt\(db, nowS, boardOf\(board\)\);[^\n]*\n\s*if \(Number\(open\?\.n \?\? 0\) >= listingsMax\) return \{ error: vend \? 'vendor-full' : 'market-listings-max' \};\n\s*\/\/ THE RECORD'S OWN PIECE/);
  assert.match(mk, /JSON\.stringify\(moved\), listingsMax,\n\s*vend\?\.map \?\? null, vend\?\.id \?\? null\),/);   // PIN MOVED (HOME-VENDOR): the trader's stall after the cap
});

test('AUDIT SEATS-3 E2: THE WARDROBE\'S OTHER DOORS KEEP A CHARTER\'S TITLES - an aura worn or taken off answers the wardrobe with the guildmaster\'s "warden" still held and worn, as the account read and the title\'s equip do; the insignia and the Patreon unlink are read the same way (mutants: the aura on the bare row; the insignia; the unlink)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  for (const x of [await svc.guest(), await svc.guest(), await svc.guest()]) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), x.id, seatReportText(ANTICLERE), 21, T0 - DAY);
  const gm = await svc.registered('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, 21, 'palace', 1, 50, NULL, ?)").run(ANTICLERE.key, gid, T0);
  assert.equal((await svc.call('/v1/account/title', { title: 'warden' }, gm.secret)).status, 200);
  const aura = await svc.call('/v1/account/aura', { aura: null }, gm.secret);
  assert.equal(aura.status, 200);
  assert.ok(aura.body.titles.includes('warden'), 'still offered');
  assert.equal(aura.body.title, 'warden', 'still worn');
  const idx = readFileSync(new URL('../../server-account/src/index.js', import.meta.url), 'utf8');
  assert.match(idx, /const r = await buyInsignia\(ctx, await withSeatTitles\(ctx, who\.player, env\), env, body\.item\);/);
  assert.match(idx, /const after = \{ \.\.\.\(await withSeatTitles\(ctx, who\.player, env\)\), patreon_user: null,/);
});
