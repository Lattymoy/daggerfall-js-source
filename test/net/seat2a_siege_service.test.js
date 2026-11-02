// SEAT2a part three (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): WHAT THE
// SERVICE SAYS OF A BATTLE - the pass (a signed fighter on its side, anyone else a spectator, from ten minutes before
// the start to its window's close, over the field the two sides' games agree), the result off a fighter's `s1` receipt
// (written once a battle, with all it gives: a Charter taken, a seat held and the Turning's memory of it, a forfeit, a
// Tourney's winner and its fee, the Sellswords paid), each fighter's Honours, and the deploy blackout's public question.
// Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/11-Multiplayer/Seats-Arc.md 6.2, 6.5-6.8, 17; `06-Systems/Online-Arc.md` SEAT2a (part three).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, siegeStartMs, SIGN_CLOSES_MS, STANDING_START, CLAIM_FEE, SIEGE_HONOURS, spoilsOf, SIEGE_PAIR_WEEKS, seatDefence } from '../../src/net/townSeatLaw.js';
import { verifyOrder } from '../../src/net/identityToken.js';
import { mintSiegeReceipt } from '../../src/net/siege/siegeReceipt.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const S = (ms) => Math.floor(ms / 1000);
const START = S(siegeStartMs(W + 1, 0, 20));   // Wednesday 20:00 - the default window, and a Tourney's
const F = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * SIEGE_UNITS_PER_M, z * SIEGE_UNITS_PER_M]);
const F2 = F.map(([x, z]) => [x + 1, z]);

async function battleWeek(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, ASHFIELD]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle) => {
    const m = await svc.registered(handle, { renown: 5 });
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, 2, handle, T0 - 30 * DAY);
    raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(W, m.id, g.gid, m.character, T0);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const purse = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const marks = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
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
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await guild('Horst', 'Ebon Oath', 'EO');
  raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 0, 0)`).run(ANTICLERE.key, sh.gid, ANTICLERE.region, ANTICLERE.tier, W - 2, T0 - 14 * DAY);
  treasury(sh.gid, 10000);
  await earn(sh.gid, ANTICLERE, 500);
  raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W, eo.gid, ANTICLERE.region, ANTICLERE.key, 'x', T0);
  await earn(eo.gid, ANTICLERE, 7000);
  const a1 = await member(eo, 'Arden'), a2 = await member(eo, 'Ashe'), d1 = await member(sh, 'Dorran');
  now = AFTER(W);
  await call('/v1/seats/list', {}, sh.gm);   // the Turning: a Right of Siege at Anticlere, Wednesday 20:00
  for (const who of [a1, a2, d1]) assert.equal((await call('/v1/seats/siege/sign', { character: who.character, key: ANTICLERE.key }, who)).status, 200);
  const pass = (who, field, key = ANTICLERE.key) => call('/v1/seats/siege/pass', { key, ...(field ? { field } : {}) }, who);
  const receipt = (who, o) => mintSiegeReceipt({ s: who.id, sk: ANTICLERE.key, sw: W + 1, sd: 'attack', r: 'attack', a: 1, h: 1, ...o }, svc.gateKey, { subtle, nowS: now });
  const claim = async (who, o, extra = {}) => call('/v1/seats/siege/claim', { receipt: await receipt(who, o), character: who.character, ...extra }, who);
  const battle = (key = ANTICLERE.key, week = W + 1) => raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(week, key);
  const holdOf = (key = ANTICLERE.key) => { const h = raw.prepare('SELECT guild_id, standing, since_week, truce_week FROM town_seat_holds WHERE key = ?').get(key); return h ? { ...h } : null; };
  return { svc, raw, sh, eo, a1, a2, d1, member, guild, treasury, purse, marks, earn, call, pass, receipt, claim, battle, holdOf, setNow: (n) => { now = n; }, getNow: () => now };
}

test('SEAT2a part three THE PASS AND THE FIELD: from ten minutes before the start; a fighter\'s game sends the field it derived, settled when an attacker and a defender agree (never two of one side alone), every pass carrying it after; a signed fighter on its side, anyone else a spectator; the service\'s signature over the account, the seat and week, the start and the window\'s close; refused past the window, for a field that is no field, for a guest (mutants: the door; the window; the agreement; the side; the claims; the field\'s check)', async (t) => {
  const s = await battleWeek(t);
  const { a1, a2, d1 } = s;
  s.setNow(START - SIGN_CLOSES_MS / 1000 - 1);
  assert.equal((await s.pass(a1, F)).body.error, 'pass-early');
  s.setNow(START - 300);
  assert.equal((await s.pass(a1, [[1, 2]])).body.error, 'field-bad');
  const lone = await s.pass(a1, F);
  assert.deepEqual([lone.status, lone.body.error], [409, 'field-unsettled'], 'one side alone - asked again in a moment');
  assert.equal((await s.pass(a2, F)).body.error, 'field-unsettled', 'two of one side agree nothing');
  assert.equal((await s.pass(d1, F2)).body.error, 'field-unsettled', 'a defender who differs');
  const r = await s.pass(d1, F);
  assert.equal(r.status, 200);
  assert.deepEqual({ ...r.body, pass: !!r.body.pass }, { side: 'defend', week: W + 1, key: ANTICLERE.key, startsAt: START, endsAt: START + 1800, window: START + 7200, pass: true });
  const v = await verifyOrder(r.body.pass, s.svc.identityPublic, { subtle, nowS: s.getNow(), kind: 'siege' });
  assert.ok(v.ok, v.why);
  assert.deepEqual({ ...v.claims, i: 0, e: 0 }, { o: 'siege', s: d1.id, sk: ANTICLERE.key, sw: W + 1, sd: 'defend', st: 'palace', sn: 'siege', sb: START, se: START + 7200, sf: F, sx: [0, -1, 0, 0, 0], i: 0, e: 0 });   // SEAT2b part two (b) (PIN MOVED): and its works, frozen - none raised, a palace with no Gatehouse
  assert.equal(s.battle().field, JSON.stringify(F), 'settled on the battle');
  const late = await s.pass(a1, F2);
  assert.deepEqual((await verifyOrder(late.body.pass, s.svc.identityPublic, { subtle, nowS: s.getNow(), kind: 'siege' })).claims.sf, F, 'settled once: a later field changes nothing');
  assert.equal(late.body.side, 'attack');
  const eye = await s.svc.registered('Eyvind');
  const w = await s.pass(eye);
  assert.equal(w.body.side, 'watch', 'anyone else a spectator, no field asked');
  assert.equal((await s.svc.call('/v1/seats/siege/pass', { key: ANTICLERE.key }, (await s.svc.guest()).secret)).body.error, 'seats-need-account');
  s.raw.prepare("UPDATE town_seat_battles SET state = 'void' WHERE week = ? AND key = ?").run(W + 1, ANTICLERE.key);
  assert.equal((await s.pass(a1)).body.error, 'battle-none', 'a void battle has no field');
  s.raw.prepare("UPDATE town_seat_battles SET state = 'scheduled' WHERE week = ? AND key = ?").run(W + 1, ANTICLERE.key);
  s.setNow(START + 7200);
  assert.equal((await s.pass(eye)).body.error, 'pass-late');   // PIN MOVED (AUDIT-SEATS): R6 - a spectator is refused past the window's close as before
  assert.equal((await s.pass(a1)).body.late, true);   // PIN MOVED (AUDIT-SEATS): R6 - a rostered fighter is signed a late pass, for its receipt (its own pins: test/net/siege/audit_seats_relay.test.js)
  assert.equal((await s.pass(a1, F, ASHFIELD.key)).body.error, 'battle-none');
});

test('SEAT2a part three THE RESULT, A SEAT TAKEN: the first receipt writes it - the Charter the attacker\'s at Standing 50 in truce, the old holder\'s Legacy cleared, the Chronicle saying so, the battle fought; a second receipt finds it written; the Sellswords paid from escrow, an unsigned contract\'s escrow home; Honours 50 Marks and 2,000 Renown XP on the winning side, 25 and 1,000 on the losing, a roll on the Spoils into the character\'s Stores - once an account; another\'s receipt, a forged one, no character refused (mutants: the once; the Charter; the truce; the Legacy; the escrow; the Honours\' sizes; the side; the spoil; the twice)', async (t) => {
  const s = await battleWeek(t);
  const { a1, d1, eo, sh } = s;
  // a Sellsword signed at 300, a second offered and never signed at 200
  s.treasury(eo.gid, 1000);
  const sword = await s.svc.registered('Swordo'), idle = await s.svc.registered('Idris');
  s.setNow(START - 3600);
  assert.equal((await s.call('/v1/seats/siege/hire', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Swordo', fee: 300 }, eo.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/hire', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Idris', fee: 200 }, eo.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/sign', { character: sword.character, key: ANTICLERE.key }, sword)).status, 200);
  s.raw.prepare('INSERT OR REPLACE INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').run(W + 1, ANTICLERE.key, sh.gid, 120);
  s.setNow(START + 1500);
  assert.equal((await s.call('/v1/seats/siege/claim', { receipt: 's1.nope.', character: a1.character }, a1)).body.error, 'receipt');
  assert.equal((await s.claim(a1, { s: d1.id })).body.error, 'not-yours');
  const xp0 = Number(s.raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(a1.id, a1.character).xp);
  const r = await s.claim(a1);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const spoil = spoilsOf(W + 1, ANTICLERE.key, a1.id);
  assert.deepEqual(r.body, { result: 'attack', winner: 'attack', applied: true, honours: { side: 'attack', won: true, marks: SIEGE_HONOURS.win.marks, xp: SIEGE_HONOURS.win.xp, spoil, spent: false } });
  assert.deepEqual(s.holdOf(), { guild_id: eo.gid, standing: STANDING_START, since_week: W + 1, truce_week: W + 1 }, 'the Charter the attacker\'s, in truce at the next Turning');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_legacy WHERE key = ? AND guild_id = ?').get(ANTICLERE.key, sh.gid).n, 0, 'the old holder\'s Legacy cleared');
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_history WHERE key = ? AND kind = 'siege-taken'").get(ANTICLERE.key));
  // AUDIT-SEATS: the row keeps the siege's length - the start to the end the receipt was signed at (25 minutes here)
  assert.equal(JSON.parse(s.raw.prepare("SELECT data FROM town_seat_history WHERE key = ? AND kind = 'siege-taken'").get(ANTICLERE.key).data).minutes, 25);
  assert.equal(s.battle().state, 'fought');
  assert.equal(s.marks(sword), 300, 'the Sellsword paid its fee');
  assert.equal(s.purse(eo.gid), 1000 - 300, 'the unsigned contract\'s escrow home');
  assert.equal(s.raw.prepare("SELECT state FROM town_seat_hires WHERE account = ?").get(idle.id).state, 'withdrawn');
  assert.equal(s.marks(a1), SIEGE_HONOURS.win.marks);
  assert.equal(Number(s.raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(a1.id, a1.character).xp), xp0 + SIEGE_HONOURS.win.xp);
  assert.equal(Number(s.raw.prepare('SELECT qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ?').get(a1.id, a1.character, spoil).qty), 1);
  assert.equal((await s.claim(a1)).body.error, 'honours-twice');
  // the loser's receipt: the result already written, its own Honours the losing side's
  const d = await s.claim(d1, { s: d1.id, sd: 'defend' });
  assert.deepEqual([d.body.applied, d.body.result, d.body.honours.won, d.body.honours.marks, d.body.honours.xp], [false, 'attack', false, SIEGE_HONOURS.lose.marks, SIEGE_HONOURS.lose.xp]);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_results').get().n, 1, 'once a battle');
  assert.equal(s.marks(sword), 300, 'and the Sellsword paid once');
  // a receipt that earned no Honours, and a claim naming no character
  const a2r = await s.claim(s.a2, { s: s.a2.id, h: 0 });
  assert.equal(a2r.body.honours, null);
  assert.equal((await s.call('/v1/seats/siege/claim', { receipt: await s.receipt(sword, { s: sword.id }) }, sword)).body.error, 'honours-character');
});

test('SEAT2a part three A SEAT HELD AND THE TURNING\'S MEMORY: held with a banner raised - Standing +15 and the next defence x1.2, the challenger\'s influence this week cleared and the seat barred to it at the Turning; held with none raised - no Standing, no x1.2, barred all the same; a forfeit +10 and x1.2, once a Season against the same challenger; the pair\'s Honours once a Season (mutants: the raised rule; the bonus; the bar; the cleared influence; the forfeit\'s once; the pair\'s once)', async (t) => {
  const s = await battleWeek(t);
  const { a1, d1, eo, sh } = s;
  await s.earn(eo.gid, ANTICLERE, 9000, W + 1);
  s.setNow(START + 1800);
  const standing0 = s.holdOf().standing;   // the Turning's own week moved it already
  const r = await s.claim(d1, { s: d1.id, sd: 'defend', r: 'defend', a: 1 });
  assert.deepEqual([r.body.result, r.body.winner, r.body.honours.won, r.body.honours.marks], ['defend', 'defend', true, SIEGE_HONOURS.win.marks]);
  assert.equal(s.holdOf().standing, standing0 + 15);
  assert.deepEqual(s.raw.prepare('SELECT guild_id, what FROM town_seat_aftermath WHERE week = ? AND key = ? ORDER BY what').all(W + 1, ANTICLERE.key).map((x) => [x.guild_id, x.what]), [[eo.gid, 'barred'], [sh.gid, 'bonus']]);
  // PIN MOVED (AUDIT-SEATS): cleared by voiding, never deleting (S9) - the caps that count an account's rows still count them
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_influence WHERE week = ? AND key = ? AND guild_id = ? AND voided = 0').get(W + 1, ANTICLERE.key, eo.gid).n, 0, 'the challenger\'s week here cleared');
  assert.ok(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_influence WHERE week = ? AND key = ? AND guild_id = ? AND voided = 1').get(W + 1, ANTICLERE.key, eo.gid).n > 0, 'kept, voided');
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_history WHERE key = ? AND kind = 'siege-held'").get(ANTICLERE.key));
  // the standings' defence carries the x1.2
  await s.earn(sh.gid, ANTICLERE, 1000, W + 1);
  const st = await s.call('/v1/seats/standings', { key: ANTICLERE.key, character: sh.gm.character }, sh.gm);
  const legacy = Number(s.raw.prepare('SELECT amount FROM town_seat_legacy WHERE week = ? AND key = ? AND guild_id = ?').get(W + 1, ANTICLERE.key, sh.gid)?.amount ?? 0);
  assert.equal(st.body.defence, seatDefence({ influence: 1000, legacy }, standing0 + 15, 0, true), 'the standings\' defence at x1.2');
  assert.notEqual(st.body.defence, seatDefence({ influence: 1000, legacy }, standing0 + 15, 0));
  // the Turning of W+1: the Oath, past the line again, barred; the Iron Circle past the holder's plain defence and not
  // past its x1.2
  const ic = await s.guild('Cyril', 'Iron Circle', 'IC');
  for (const g of [eo, ic]) s.raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W + 1, g.gid, ANTICLERE.region, ANTICLERE.key, 'x', s.getNow());
  await s.earn(sh.gid, ANTICLERE, 5000, W + 1);   // the holder's own week: 6,000 in all
  await s.earn(eo.gid, ANTICLERE, 9000, W + 1);
  const standingT = s.holdOf().standing;
  const plainT = seatDefence({ influence: 6000, legacy }, standingT, 0), heldT = seatDefence({ influence: 6000, legacy }, standingT, 0, true);
  assert.ok(plainT + 1 >= 6000 && plainT + 1 <= heldT, `${plainT} ${heldT}`);
  await s.earn(ic.gid, ANTICLERE, plainT + 1, W + 1);
  s.setNow(AFTER(W + 1));
  await s.call('/v1/seats/list', {}, sh.gm);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_rights WHERE week = ? AND key = ?').get(W + 2, ANTICLERE.key).n, 0, 'the Oath barred, the Circle short of the x1.2');
  // a forfeit by the same challenger in week W+2: +10 and x1.2; a second within the Season: no Standing; no Honours either
  const fight = (week) => {
    s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
      VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(week, ANTICLERE.key, eo.gid, sh.gid, START + (week - W - 1) * 7 * DAY, START + (week - W - 1) * 7 * DAY + 1800, s.getNow());
    // PIN MOVED (AUDIT SEATS-3): A3 - Honours go to the character on the battle's roster, so its two fighters sign it
    for (const [who, g, side] of [[d1, sh, 'defend'], [a1, eo, 'attack']]) {
      s.raw.prepare('INSERT INTO town_seat_rosters (week, key, account, char_id, guild_id, side, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(week, ANTICLERE.key, who.id, who.character, g.gid, side, s.getNow());
    }
  };
  fight(W + 2);
  const st0 = s.holdOf().standing;
  const f = await s.claim(d1, { s: d1.id, sw: W + 2, sd: 'defend', r: 'forfeit', a: 0 });
  assert.deepEqual([f.body.result, s.holdOf().standing - st0, s.battle(ANTICLERE.key, W + 2).state], ['forfeit', 10, 'forfeit']);
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_history WHERE week = ? AND key = ? AND kind = 'siege-forfeit'").get(W + 2, ANTICLERE.key), 'the Chronicle says a forfeit');
  assert.equal(f.body.honours.marks, 0, 'the pair\'s Honours spent this Season');
  assert.equal(f.body.honours.spent, true);
  fight(W + 3);
  const f2 = await s.claim(d1, { s: d1.id, sw: W + 3, sd: 'defend', r: 'forfeit', a: 0 });
  assert.deepEqual([f2.body.result, s.holdOf().standing - st0], ['forfeit', 10], 'a second forfeit by the same challenger in the Season: no Standing');
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_aftermath WHERE week = ? AND key = ? AND guild_id = ? AND what = 'bonus'").get(W + 3, ANTICLERE.key, sh.gid), 'the x1.2 all the same');
  // a Season on, the pair earns Honours again
  fight(W + 1 + SIEGE_PAIR_WEEKS);
  const later = await s.claim(a1, { sw: W + 1 + SIEGE_PAIR_WEEKS, r: 'defend', a: 0 });
  assert.deepEqual([later.body.honours.won, later.body.honours.marks], [false, SIEGE_HONOURS.lose.marks], 'a Season on');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_aftermath WHERE week = ? AND what = 'bonus'").get(W + 1 + SIEGE_PAIR_WEEKS).n, 0, 'held with no banner raised: no x1.2');
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_aftermath WHERE week = ? AND what = 'barred'").get(W + 1 + SIEGE_PAIR_WEEKS), 'barred all the same');
});

test('SEAT2a part three THE TOURNEY AND THE BLACKOUT: the side with more banners takes the Charter and pays the claim fee - else the other if it can - else the seat stays unheld; a dead heat to the higher influence; the deploy blackout\'s question public, naming no guild (mutants: the winner; the fee; the fallback; the unheld; the tie; the route)', async (t) => {
  const s = await battleWeek(t);
  const rv = await s.guild('Rhea', 'Raven Vale', 'RV');
  const rw = await s.guild('Bran', 'Red Wolves', 'RW');
  const r1 = await s.member(rv, 'Rook'), w1 = await s.member(rw, 'Wynn');
  const tourney = (key, week) => s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
    VALUES (?, ?, 'tourney', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(week, key, rv.gid, rw.gid, START, START + 1200, s.getNow());
  const tclaim = async (who, sd, r, week) => s.call('/v1/seats/siege/claim', {
    receipt: await mintSiegeReceipt({ s: who.id, sk: ASHFIELD.key, sw: week, sd, r, a: 0, h: 0 }, s.svc.gateKey, { subtle, nowS: s.getNow() }), character: who.character }, who);
  const held = () => s.raw.prepare('SELECT guild_id FROM town_seat_holds WHERE key = ?').get(ASHFIELD.key)?.guild_id ?? null;
  s.setNow(START + 1300);
  // the winner cannot pay, the other can
  tourney(ASHFIELD.key, W + 1);
  s.treasury(rv.gid, CLAIM_FEE.palace);
  const a = await tclaim(w1, 'defend', 'defend', W + 1);
  assert.deepEqual([a.body.result, a.body.winner, held()], ['defend', 'attack', rv.gid], 'the Wolves could not pay: the Vale takes it');
  assert.equal(s.purse(rv.gid), 0, 'the fee burnt');
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_history WHERE key = ? AND kind = 'tourney-won'").get(ASHFIELD.key));
  // neither can pay: unheld
  s.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(ASHFIELD.key);
  tourney(ASHFIELD.key, W + 2);
  const b = await tclaim(r1, 'attack', 'attack', W + 2);
  assert.deepEqual([b.body.winner, held()], [null, null]);
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_history WHERE key = ? AND kind = 'tourney-unheld'").get(ASHFIELD.key));
  // a dead heat: the higher influence
  tourney(ASHFIELD.key, W + 3);
  s.treasury(rw.gid, CLAIM_FEE.palace); s.treasury(rv.gid, CLAIM_FEE.palace);
  // PIN MOVED (AUDIT-SEATS): the dead heat reads the week that made the seat Contested - the Tourney's week less one - as its
  // Turning counted it, the two pledged there (S8: the standings' totals and the Legacy, never the rows' raw sum)
  for (const g of [rw, rv]) s.raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W + 2, g.gid, ASHFIELD.region, ASHFIELD.key, 'x', s.getNow());
  await s.earn(rw.gid, ASHFIELD, 3000, W + 2); await s.earn(rv.gid, ASHFIELD, 2000, W + 2);
  const c = await tclaim(r1, 'attack', 'tie', W + 3);
  assert.deepEqual([c.body.result, c.body.winner, held()], ['tie', 'defend', rw.gid], 'the Wolves\' higher influence');
  // a dead heat at equal influence: nobody won it, and the seat stays unheld
  s.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(ASHFIELD.key);
  tourney(ASHFIELD.key, W + 4);
  s.treasury(rv.gid, CLAIM_FEE.palace);
  const e = await tclaim(r1, 'attack', 'tie', W + 4);
  assert.deepEqual([e.body.winner, held()], [null, null], 'a dead heat at equal influence');
  // the blackout's question: public, a GET
  s.setNow(START - 600);
  const res = await s.svc.fetch('https://accounts.invalid/v1/seats/sieges/live');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { live: true, until: START + 1800 });
  assert.equal((await s.svc.fetch('https://accounts.invalid/v1/seats/sieges/live', { method: 'POST', body: '{}' })).status, 405);
});
