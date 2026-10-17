// SEAT2b part two (c) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): A REVOLT IN THE ACCOUNT SERVICE - a
// held seat whose Standing the Turning leaves at nought revolts at its holder's window the next week (a battle row of
// kind 'revolt', migration 0064); the holder's members sign to defend it and enter on a revolt's pass; a defender's
// receipt settles it - put down, the Standing back to 20; standing, the Charter lapsed; none by the next Turning, the
// Charter lapsed there (bible/11-Multiplayer/Seats-Arc.md 7.7, 6.3; server-account/src/seatTurning.js, seatSiege.js).
// Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs). `06-Systems/
// Online-Arc.md` SEAT2b part two (c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, siegeStartMs, chronicleLine } from '../../src/net/townSeatLaw.js';
import { verifyOrder } from '../../src/net/identityToken.js';
import { mintSiegeReceipt } from '../../src/net/siege/siegeReceipt.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const START = Math.floor(siegeStartMs(W + 1, 0, 20) / 1000);   // the default window, Wednesday 20:00 UTC
const F = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * SIEGE_UNITS_PER_M, z * SIEGE_UNITS_PER_M]);

/** A holder whose week leaves its Standing at nought: at 0, its upkeep unpaid (Neglect), no Watch of its own. */
async function revoltWeek(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  for (let i = 0; i < 3; i++) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), (await svc.guest()).id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const gm = await svc.registered('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 0, NULL, ?, 0, 0)`).run(ANTICLERE.key, gid, ANTICLERE.region, ANTICLERE.tier, W - 2, T0 - 14 * DAY);
  const d1 = await svc.registered('Dorran', { renown: 5 });
  raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(d1.id, d1.character, gid, 2, 'Dorran', T0 - 30 * DAY);
  raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(W, d1.id, gid, d1.character, T0);
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  now = AFTER(W);
  await call('/v1/seats/list', {}, gm);   // the Turning: Standing nought - the town rises
  const receipt = (o) => mintSiegeReceipt({ s: d1.id, sk: ANTICLERE.key, sw: W + 1, sd: 'defend', r: 'defend', a: 0, h: 0, ...o }, svc.gateKey, { subtle, nowS: now });
  const claim = async (o) => call('/v1/seats/siege/claim', { receipt: await receipt(o), character: d1.character }, d1);
  const battle = () => raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(W + 1, ANTICLERE.key);
  const holdOf = () => { const h = raw.prepare('SELECT guild_id, standing FROM town_seat_holds WHERE key = ?').get(ANTICLERE.key); return h ? { ...h } : null; };
  const history = () => raw.prepare('SELECT kind, data FROM town_seat_history WHERE key = ? ORDER BY seq').all(ANTICLERE.key).map((r) => r.kind);
  return { svc, raw, gm, gid, d1, call, claim, battle, holdOf, history, setNow: (n) => { now = n; }, getNow: () => now };
}

test('SEAT2b part two (c) A REVOLT DUE (7.7, 6.3): the Turning that leaves a holder\'s Standing at nought places a revolt at its window the next week - no guild against it, two hours long - says so in the Chronicle and on the list; the holder\'s member signs to defend it and its pass is a revolt\'s, the field its first defender\'s, no works (mutants: the due; the window; the length; the list; the pass)', async (t) => {
  const s = await revoltWeek(t);
  const b = s.battle();
  assert.deepEqual([b.kind, b.attacker, b.defender, b.starts_at, b.ends_at, b.state], ['revolt', '', s.gid, START, START + 7200, 'scheduled']);
  assert.ok(s.history().includes('revolt'));
  const row = s.raw.prepare("SELECT kind, week, data FROM town_seat_history WHERE key = ? AND kind = 'revolt'").get(ANTICLERE.key);
  assert.match(chronicleLine({ kind: row.kind, week: Number(row.week), data: JSON.parse(row.data) }, ANTICLERE), /Standing under the Silver Hand <SH> fell to nothing, and the town rose in revolt\.$/);
  const list = await s.call('/v1/seats/list', {}, s.gm);
  const seat = list.body.seats.find((x) => x.key === ANTICLERE.key);
  assert.deepEqual([seat.battle.kind, seat.battle.guild, seat.battle.against.tag, seat.battle.startsAt], ['revolt', null, 'SH', START]);
  assert.deepEqual((await s.call('/v1/seats/siege/sign', { character: s.d1.character, key: ANTICLERE.key }, s.d1)).body, { ok: true, side: 'defend', sellsword: false });
  s.setNow(START - 300);
  const r = await s.call('/v1/seats/siege/pass', { key: ANTICLERE.key, field: F }, s.d1);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = (await verifyOrder(r.body.pass, s.svc.identityPublic, { subtle, nowS: s.getNow(), kind: 'siege' })).claims;
  assert.deepEqual([c.sn, c.sd, c.se, c.sx, c.sf], ['revolt', 'defend', START + 7200, undefined, F]);
});

test('SEAT2b part two (c) A REVOLT SETTLED BY ITS RECEIPT: put down (`defend`) the holder\'s Standing returns to 20 and the Chronicle says the Captain fell; it earns no Honours; standing (`attack`) the Charter lapses and its coming Edict is void (mutants: the Standing; Honours; the lapse)', async (t) => {
  const s = await revoltWeek(t);
  s.setNow(START + 3600);
  const r = await s.claim();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.result, r.body.honours], ['defend', null]);
  const again = await s.claim({ h: 1 });   // a receipt that says honoured: a revolt earns none all the same
  assert.equal(again.body.honours, null);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_honours').get().n, 0);
  assert.deepEqual(s.holdOf(), { guild_id: s.gid, standing: 20 });
  assert.equal(s.battle().state, 'fought');
  assert.ok(s.history().includes('revolt-down'));
  const s2 = await revoltWeek(t);
  s2.raw.prepare("INSERT INTO town_seat_edicts (key, week, guild_id, edict, state, set_aside, cost, set_by, at) VALUES (?, ?, ?, 'market-day', 'proclaimed', 0, 0, 'x', ?)").run(ANTICLERE.key, W + 2, s2.gid, T0);
  s2.setNow(START + 7300);
  const r2 = await s2.claim({ r: 'attack' });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(s2.holdOf(), null, 'the Charter lapsed');
  assert.equal(s2.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 2).state, 'void');
  assert.ok(s2.history().includes('revolt-stood'));
});

test('SEAT2b part two (c) A REVOLT NOBODY PUT DOWN: no result by the next Turning - the Charter lapses there (no upkeep, no Standing), the Chronicle says the Captain held the door, the battle void (mutants: the lapse at the Turning; the void)', async (t) => {
  const s = await revoltWeek(t);
  s.setNow(AFTER(W + 1));
  await s.call('/v1/seats/list', {}, s.gm);
  assert.equal(s.holdOf(), null);
  assert.ok(s.history().includes('revolt-stood'));
  assert.ok(!s.history().includes('siege-void'));
  assert.equal(s.battle().state, 'void');
});

test('AUDIT SEATS-2 L2: a revolt won no Right - a holder\'s member of seven days signs to defend it with no bind in the week before (a town that rose for its holder\'s absence), where a siege still asks one (mutant: the revolt asked the Right\'s bind)', async (t) => {
  const s = await revoltWeek(t);
  s.raw.prepare('DELETE FROM town_seat_binds WHERE account = ?').run(s.d1.id);
  const r = await s.call('/v1/seats/siege/sign', { character: s.d1.character, key: ANTICLERE.key }, s.d1);
  assert.deepEqual(r.body, { ok: true, side: 'defend', sellsword: false }, JSON.stringify(r.body));
  // the same member at a siege: the Right's week's bind still asked
  s.raw.prepare('DELETE FROM town_seat_rosters').run();
  s.raw.prepare('DELETE FROM town_seat_binds WHERE account = ?').run(s.d1.id);
  s.raw.prepare("UPDATE town_seat_battles SET kind = 'siege', attacker = ? WHERE key = ?").run(s.gid, ANTICLERE.key);
  s.raw.prepare("UPDATE town_seat_battles SET defender = 'other-guild' WHERE key = ?").run(ANTICLERE.key);
  assert.equal((await s.call('/v1/seats/siege/sign', { character: s.d1.character, key: ANTICLERE.key }, s.d1)).body.error, 'sign-unbound');
});
