// CROWN1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE ROYAL TOURNEY, AS THE SERVICE KEEPS
// IT - the Edict at a crown alone, its 5,000 escrowed at the Turning that makes it law; the pass over the ring two
// contenders' games agree; each bout a winner's `t1` receipt brings, counted once and the same two three times a UTC
// day; the ladder on the Seat tab; and at the Turning that ends its week the champion named, paid and titled for good
// (worn with its crown and Season), or the prize home. Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md 7.6; `06-Systems/Online-Arc.md` CROWN1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, EDICTS, seatTitleText } from '../../src/net/townSeatLaw.js';
import { verifyOrder, verifyToken } from '../../src/net/identityToken.js';
import { mintRoyalReceipt } from '../../src/net/siege/siegeReceipt.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';

const { subtle } = globalThis.crypto;
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const RING = [[590 * SIEGE_UNITS_PER_M, 166 * SIEGE_UNITS_PER_M]];

async function stood(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [WAYREST, ALCAIRE]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const gm = await svc.registered('Orla', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Oath', tag: 'OA' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, 'crown', ?, 50, NULL, ?, 6, 0)`).run(WAYREST.key, gid, WAYREST.region, W - 1, T0 - 7 * DAY);
  raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, 'seed-oath')`).run(gid, 100000);
  const purse = () => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const marks = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const lines = (kind) => raw.prepare('SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind)
    .map((r) => [r.src_kind, r.src_id, r.dst_kind, r.dst_id, Number(r.amount)]);
  const chronicle = (key) => raw.prepare('SELECT kind, data FROM town_seat_history WHERE key = ? ORDER BY seq').all(key).map((r) => ({ kind: r.kind, data: JSON.parse(r.data) }));
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  const watch = (week) => {
    raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, ?, 'watch', 100, ?, 1, ?, ?)`).run(week, WAYREST.key, gid, gm.id, gm.character, WAYREST.region, `w:${week}`, T0);
    raw.prepare('INSERT OR IGNORE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, gm.id, gid, gm.character, T0);
  };
  const bout = (winner, loser, n, nowS = now) => mintRoyalReceipt({ s: winner.id, l: loser.id, sk: WAYREST.key, sw: W + 1, n }, svc.gateKey, { subtle, nowS });
  return { svc, raw, gm, gid, purse, marks, lines, chronicle, call, watch, bout, getNow: () => now, setNow: (v) => { now = v; } };
}

/** The Royal Tourney proclaimed this week, made law at week W's Turning: the clock in week W + 1. */
async function ruled(t) {
  const s = await stood(t);
  assert.deepEqual((await s.call('/v1/seats/edict', { character: s.gm.character, key: WAYREST.key, edict: 'royal-tourney' }, s.gm)).body, { ok: true, next: 'royal-tourney' });
  s.watch(W);
  s.setNow(AFTER(W));
  await s.call('/v1/seats/list', {}, s.gm);
  return s;
}

test('CROWN1 THE ROYAL TOURNEY\'S EDICT: a crown\'s alone, its 5,000 escrowed at the Turning that makes it law (mutants: the cost; the escrow; the tier)', async (t) => {
  assert.deepEqual({ ...EDICTS['royal-tourney'], cost: { ...EDICTS['royal-tourney'].cost } }, { name: 'Royal Tourney', standing: 0, cost: { crown: 5000 }, repeat: false, crown: true });
  const s = await ruled(t);
  assert.equal(s.raw.prepare('SELECT state, cost FROM town_seat_edicts WHERE key = ? AND week = ?').get(WAYREST.key, W + 1).state, 'law');
  assert.deepEqual(s.lines('royal-escrow'), [['guild', s.gid, 'escrow', `royal:${WAYREST.key}:${W + 1}`, 5000]]);
  // the crown's upkeep is scaled by the accounts that played; the escrow is its own line
  assert.ok(s.purse() <= 100000 - 5000);
});

test('CROWN1 THE TOURNEY\'S PASS: none where no Royal Tourney rules, nor at a palace; a contender\'s ring checked, waiting until a second contender\'s game agrees - then every pass carries it, signed: `sn` royal, the week its window; a spectator watches (mutants: the ruling; the ring\'s two; the order)', async (t) => {
  const s = await stood(t);
  const a = await s.svc.registered('Arden'), b = await s.svc.registered('Bryn'), c = await s.svc.registered('Cade');
  const pass = (who, o = {}) => s.call('/v1/seats/royal/pass', { key: WAYREST.key, field: RING, ...o }, who);
  assert.equal((await pass(a)).body.error, 'royal-none', 'nothing proclaimed');
  assert.equal((await pass(a)).status, 404);
  assert.deepEqual((await s.call('/v1/seats/edict', { character: s.gm.character, key: WAYREST.key, edict: 'royal-tourney' }, s.gm)).body.next, 'royal-tourney');
  s.watch(W);
  s.setNow(AFTER(W));
  await s.call('/v1/seats/list', {}, s.gm);
  assert.equal((await s.call('/v1/seats/royal/pass', { key: ALCAIRE.key, field: RING }, a)).body.error, 'royal-none', 'a palace has none');
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'royal-tourney', ?, 'x', 'law', ?)").run(ALCAIRE.key, W + 1, s.gid, s.getNow());
  assert.equal((await s.call('/v1/seats/royal/pass', { key: ALCAIRE.key, field: RING }, a)).body.error, 'royal-none', 'nor whatever its rows say: a crown\'s alone');
  assert.equal((await pass(a, { field: [[1, 2], [3, 4]] })).body.error, 'field-bad');
  const first = await pass(a);
  assert.deepEqual([first.status, first.body.error], [409, 'ring-unsettled'], 'one contender\'s word is not the ring');
  assert.equal((await pass(c, { watch: true })).body.error, 'ring-unsettled', 'nor a spectator\'s pass before it');
  assert.equal((await pass(a)).body.error, 'ring-unsettled', 'the same contender twice is still one');
  const second = await pass(b);
  assert.equal(second.status, 200);
  const sb = Math.floor(seatWeekStartMs(W + 1) / 1000);
  assert.deepEqual([second.body.side, second.body.week, second.body.startsAt, second.body.endsAt], ['duel', W + 1, sb, sb + 7 * DAY]);
  const v = await verifyOrder(second.body.pass, s.svc.identityPublic, { subtle, nowS: s.getNow(), kind: 'siege' });
  assert.ok(v.ok, v.why);
  assert.deepEqual({ s: v.claims.s, sk: v.claims.sk, sw: v.claims.sw, sd: v.claims.sd, st: v.claims.st, sn: v.claims.sn, sb: v.claims.sb, se: v.claims.se, sf: v.claims.sf },
    { s: b.id, sk: WAYREST.key, sw: W + 1, sd: 'duel', st: 'crown', sn: 'royal', sb, se: sb + 7 * DAY, sf: RING });
  assert.equal((await pass(a, { field: [[0, 0]] })).status, 200, 'settled once: a contender changing its own word changes nothing');
  const later = await pass(c, { field: [[0, 0]] });
  assert.deepEqual((await verifyOrder(later.body.pass, s.svc.identityPublic, { subtle, nowS: s.getNow(), kind: 'siege' })).claims.sf, RING, 'settled once: a later ring changes nothing');
  const eye = await pass(c, { watch: true });
  assert.equal(eye.body.side, 'watch');
});

test('CROWN1 A BOUT CLAIMED: the winner\'s own receipt, verified, counted once - the same two three times a UTC day - another\'s refused, a forged one refused; the ladder on the Seat tab (mutants: the owner; the once; the pair\'s cap; the day; the ladder)', async (t) => {
  const s = await ruled(t);
  const a = await s.svc.registered('Arden'), b = await s.svc.registered('Bryn'), c = await s.svc.registered('Cade');
  const claim = async (who, rc) => (await s.call('/v1/seats/royal/claim', { receipt: rc }, who)).body;
  assert.equal((await claim(b, await s.bout(a, b, 1))).error, 'not-yours');
  const forged = await mintRoyalReceipt({ s: a.id, l: b.id, sk: WAYREST.key, sw: W + 1, n: 1 }, (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey, { subtle, nowS: s.getNow() });
  assert.equal((await claim(a, forged)).error, 'receipt', 'not the relay\'s');
  assert.deepEqual(await claim(a, await s.bout(a, b, 1)), { ok: true, counted: true, repeat: false, wins: 1 });
  assert.deepEqual(await claim(a, await s.bout(a, b, 1)), { ok: true, counted: true, repeat: true, wins: 1 }, 'once a bout');
  assert.equal((await claim(b, await s.bout(b, a, 2))).counted, true);
  assert.equal((await claim(a, await s.bout(a, b, 3))).counted, true);
  assert.deepEqual(await claim(a, await s.bout(a, b, 4)), { ok: true, counted: false, repeat: false, wins: 2 }, 'the fourth between them today');
  assert.equal((await claim(a, await s.bout(a, c, 5))).counted, true, 'another opponent');
  const yesterday = await s.bout(a, b, 7);   // won today, carried tomorrow: today's bout
  assert.equal((await claim(a, await mintRoyalReceipt({ s: a.id, l: b.id, sk: ALCAIRE.key, sw: W + 1, n: 1 }, s.svc.gateKey, { subtle, nowS: s.getNow() }))).error, 'royal-none', 'no Royal Tourney at that seat');
  s.setNow(s.getNow() + DAY);
  assert.equal((await claim(a, await s.bout(a, b, 6))).counted, true, 'tomorrow again (the bout\'s own day)');
  assert.equal((await claim(a, yesterday)).counted, false, 'yesterday\'s fourth, whenever it is carried');
  const view = (await s.call('/v1/seats/standings', { key: WAYREST.key }, a)).body.royal;
  assert.deepEqual(view, { prize: 5000, startsAt: Math.floor(seatWeekStartMs(W + 1) / 1000), endsAt: turning(W + 1), ladder: [
    { name: 'Arden', wins: 4, losses: 1 }, { name: 'Bryn', wins: 1, losses: 3 }, { name: 'Cade', wins: 0, losses: 1 }] });
  assert.equal((await s.call('/v1/seats/standings', { key: ALCAIRE.key }, a)).body.royal, null, 'a palace: none');
});

test('CROWN1 THE CHAMPION: at the Turning that ends its week the ladder\'s first is named - the prize paid to its account, the title kept for good and worn with its crown and Season, the Chronicle\'s row; a bout claimed after it refused; a week with no bout won sends the prize home (mutants: the champion; the prize; the title; the mint; the row; the late claim; the return)', async (t) => {
  const s = await ruled(t);
  const a = await s.svc.registered('Arden'), b = await s.svc.registered('Bryn');
  for (const [w, l, n] of [[a, b, 1], [b, a, 2], [a, b, 3]]) assert.equal((await s.call('/v1/seats/royal/claim', { receipt: await s.bout(w, l, n) }, w)).body.counted, true);
  const late = await s.bout(b, a, 4, turning(W + 1) - 3600);   // won in the week's last hour, carried after its Turning
  s.watch(W + 1);
  s.setNow(AFTER(W + 1));
  await s.call('/v1/seats/list', {}, s.gm);
  assert.deepEqual(s.lines('royal-prize'), [['escrow', `royal:${WAYREST.key}:${W + 1}`, 'account', a.id, 5000]]);
  assert.equal(s.marks(a), 5000);
  assert.deepEqual(s.raw.prepare('SELECT account, title, key, week FROM town_seat_titles').all().map((r) => ({ ...r })), [{ account: a.id, title: 'champion', key: WAYREST.key, week: W + 1 }]);
  const row = s.chronicle(WAYREST.key).find((r) => r.kind === 'royal-champion');
  assert.deepEqual(row.data, { name: 'Arden', kingdom: 'wayrest', wins: 2, prize: 5000 });
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(WAYREST.key, W + 1).state, 'returned');
  assert.equal((await s.call('/v1/seats/royal/claim', { receipt: late }, b)).body.error, 'royal-over');
  // the title, chosen and worn - the account's own, whatever character it brings
  assert.equal((await s.call('/v1/account/title', { title: 'champion' }, b)).status, 403, 'not the loser\'s');
  assert.equal((await s.call('/v1/account/title', { title: 'champion' }, a)).status, 200);
  const minted = (await s.call('/v1/auth/token', { character: a.character }, a)).body;
  assert.deepEqual([minted.title, minted.ts], ['champion', [WAYREST.key, 0]]);
  const v = await verifyToken(minted.token, s.svc.identityPublic, { subtle, nowS: s.getNow() });
  assert.deepEqual([v.claims.t, v.claims.ts], ['champion', [WAYREST.key, 0]]);
  assert.equal(seatTitleText('champion', minted.ts, (k) => (k === WAYREST.key ? WAYREST : null)), 'Champion of Wayrest');   // PIN MOVED (AUDIT-SEATS L7): with no Season counted, none named
  // a week with no bout won: the prize home
  assert.deepEqual((await s.call('/v1/seats/edict', { character: s.gm.character, key: WAYREST.key, edict: 'royal-tourney' }, s.gm)).body, { ok: true, next: 'royal-tourney' }, 'proclaimed again for week W + 3');
  s.watch(W + 2);
  s.setNow(AFTER(W + 2));
  await s.call('/v1/seats/list', {}, s.gm);
  const before = s.purse();
  s.watch(W + 3);
  s.setNow(AFTER(W + 3));
  await s.call('/v1/seats/list', {}, s.gm);
  assert.deepEqual(s.lines('royal-return'), [['escrow', `royal:${WAYREST.key}:${W + 3}`, 'guild', s.gid, 5000]]);
  assert.ok(s.chronicle(WAYREST.key).some((r) => r.kind === 'royal-none'));
  assert.ok(s.purse() > before - 15000, 'the prize came home (less the week\'s upkeep)');
});
