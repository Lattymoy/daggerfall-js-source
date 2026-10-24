// VOID (2026-10-02, Mac: "lets finish the build work") - A MODERATOR VOIDS A SIEGE (`/siege void <key>`): Seats-Arc 18,
// "Moderators (MOD1) may **void a siege** (`/siege void`) - a history row, the holder keeping the seat - when a fight was
// won by an exploit found after it". The seat's battle of this week void: before its result, as a Turning voids an
// unfinished one (the Sellswords' escrow home) but the challenger's Right NOT carried; after a capture, the Charter back
// to the guild that held it (its Standing, Tithe, Legacy and works as the result's `prior` kept them - migration 0067);
// after a hold, the holder's Standing and defence fifth struck and the challenger's bar lifted; after a Tourney, the
// winner's Charter gone. A Chronicle row; Honours paid stand; a later receipt refused; idempotent. Driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs), and the chat word parsed.
// bible/11-Multiplayer/Seats-Arc.md 18; `06-Systems/Online-Arc.md` SIEGE-VOID.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, siegeStartMs, STANDING_START, CLAIM_FEE, SIEGE_HONOURS, chronicleLine, SIEGE_WHY } from '../../src/net/townSeatLaw.js';
import { mintSiegeReceipt } from '../../src/net/siege/siegeReceipt.js';
import { parseSiegeCommand, SIEGE_USAGE, createTownSeatBook } from '../../src/net/townSeatBook.js';
import { accountRefusalText } from '../../src/net/accountClient.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const START = Math.floor(siegeStartMs(W + 1, 0, 20) / 1000);   // Wednesday 20:00 - the default window

/** A siege at Anticlere in week W + 1: the Silver Hand holds it, the Ebon Oath won its Right (seat2a_siege_service's shape),
 *  a moderator (Mora) and a developer (Devra) beside them. */
async function siegeWeek(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', MODERATOR_HANDLES: 'Mora', DEVELOPER_HANDLES: 'Devra' });
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
  const mora = await svc.registered('Mora'), devra = await svc.registered('Devra');
  const receipt = (who, o) => mintSiegeReceipt({ s: who.id, sk: ANTICLERE.key, sw: W + 1, sd: 'attack', r: 'attack', a: 1, h: 1, ...o }, svc.gateKey, { subtle, nowS: now });
  const claim = async (who, o, extra = {}) => call('/v1/seats/siege/claim', { receipt: await receipt(who, o), character: who.character, ...extra }, who);
  const voidIt = (who, key = ANTICLERE.key) => call('/v1/seats/siege/void', { key }, who);
  const battle = (key = ANTICLERE.key, week = W + 1) => raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(week, key);
  const holdOf = (key = ANTICLERE.key) => { const h = raw.prepare('SELECT guild_id, standing, since_week, truce_week, tithe, tithe_week, owed FROM town_seat_holds WHERE key = ?').get(key); return h ? { ...h } : null; };
  const voids = (key = ANTICLERE.key) => raw.prepare("SELECT week, data FROM town_seat_history WHERE key = ? AND kind = 'siege-voided'").all(key).map((r) => ({ week: r.week, ...JSON.parse(r.data) }));
  return { svc, raw, sh, eo, a1, a2, d1, mora, devra, treasury, purse, marks, call, claim, receipt, voidIt, battle, holdOf, voids, setNow: (n) => { now = n; } };
}

test('VOID WHO MAY: a moderator or a developer alone - a player, a guest, a guild\'s own guildmaster refused (403 not-moderator) and nothing moves; a seat with no battle this week answers battle-none in words; a key that is no seat bad-seat (mutants: the authority; the week\'s battle)', async (t) => {
  const s = await siegeWeek(t);
  s.setNow(START - 3600);
  const player = await s.svc.registered('Plain');
  for (const who of [player, s.sh.gm, s.eo.gm, await s.svc.guest()]) {
    const r = await s.voidIt(who);
    assert.deepEqual([r.status, r.body.error], [403, 'not-moderator']);
  }
  assert.equal(s.battle().state, 'scheduled', 'a refusal moves nothing');
  assert.deepEqual(s.voids(), []);
  assert.equal(accountRefusalText('not-moderator'), 'Only moderators can do that.');
  const none = await s.voidIt(s.mora, ASHFIELD.key);
  assert.deepEqual([none.status, none.body.error], [404, 'battle-none'], 'no battle at Ashfield this week');
  assert.equal(accountRefusalText('battle-none'), 'No battle is named here this week.');
  assert.equal((await s.voidIt(s.mora, 'x')).body.error, 'bad-seat');
  // last week's battle is not this week's: at Anticlere before the Turning that scheduled it there was none
  const ok = await s.voidIt(s.devra);
  assert.deepEqual([ok.status, ok.body.ok, ok.body.week], [200, true, W + 1], 'a developer may');
});

test('VOID BEFORE ITS RESULT: the battle void as a Turning voids an unfinished one - every Sellsword\'s escrow home, signed or not; no pass opens and a receipt that comes after is refused; the Chronicle\'s row; asked again, repeat; and at the Turning the challenger\'s Right is NOT carried, its own void row never written (mutants: the void; the escrow; the Right)', async (t) => {
  const s = await siegeWeek(t);
  const { eo, mora, a1 } = s;
  s.treasury(eo.gid, 1000);
  const sword = await s.svc.registered('Swordo'), idle = await s.svc.registered('Idris');
  s.setNow(START - 3600);
  assert.equal((await s.call('/v1/seats/siege/hire', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Swordo', fee: 300 }, eo.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/hire', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Idris', fee: 200 }, eo.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/sign', { character: sword.character, key: ANTICLERE.key }, sword)).status, 200);
  const before = s.purse(eo.gid);
  const r = await s.voidIt(mora);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, key: ANTICLERE.key, week: W + 1, battle: 'siege', result: null, restored: false });
  assert.equal(s.battle().state, 'void');
  assert.equal(s.purse(eo.gid), before + 500, 'both contracts home - the signed one too: nobody earns a fee');
  assert.equal(s.marks(sword), 0);
  assert.equal(s.marks(idle), 0);
  assert.deepEqual(s.raw.prepare('SELECT state FROM town_seat_hires WHERE week = ? AND key = ? ORDER BY account').all(W + 1, ANTICLERE.key).map((h) => h.state), ['withdrawn', 'withdrawn']);
  assert.deepEqual(s.voids(), [{ week: W + 1, battle: 'siege', result: null, guild: { name: 'Ebon Oath', tag: 'EO' }, holder: { name: 'The Silver Hand', tag: 'SH' }, restored: false, by: 'Mora' }]);
  assert.deepEqual([s.holdOf().guild_id, s.holdOf().since_week], [s.sh.gid, W - 2], 'the holder keeps the seat');
  s.setNow(START + 1500);
  assert.equal((await s.call('/v1/seats/siege/pass', { key: ANTICLERE.key }, a1)).body.error, 'battle-none', 'no pass opens');
  const late = await s.claim(a1);
  assert.deepEqual([late.status, late.body.error], [409, 'battle-void'], 'a receipt after the void moves nothing');
  assert.match(SIEGE_WHY['battle-void'], /by the Moderators/);
  assert.equal(s.marks(a1), 0, 'no Honours');
  assert.equal(s.holdOf().guild_id, s.sh.gid);
  const again = await s.voidIt(mora);
  assert.deepEqual([again.status, again.body.repeat], [200, true], 'idempotent');
  assert.equal(s.voids().length, 1);
  assert.equal(s.purse(eo.gid), before + 500, 'the escrow came home once');
  // the Turning: a scheduled siege no result reached would carry its Right - a voided one does not
  s.setNow(AFTER(W + 1));
  await s.call('/v1/seats/list', {}, s.sh.gm);
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W + 1), 'the week settled');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_rights WHERE week = ? AND key = ? AND kind = 'siege' AND guild_id = ?").get(W + 2, ANTICLERE.key, eo.gid).n, 0, 'the challenger\'s Right is spent');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_history WHERE key = ? AND kind = 'siege-void'").get(ANTICLERE.key).n, 0, 'the Turning finds it void already');
  assert.equal(s.purse(eo.gid), before + 500, 'and pays no escrow twice');
});

test('VOID AFTER A CAPTURE: the Charter back to the guild that held it - its Standing, the week it took the seat, its Tithe and arrears as the result kept them; its Legacy back; the works\' capture drop undone; the capturer\'s project fallen to the stockpile and its Edict void; Honours already paid stand, a later receipt refused; the Chronicle says so (mutants: the prior kept; the Charter; the Legacy; the works; the project; the Edict; the Honours)', async (t) => {
  const s = await siegeWeek(t);
  const { eo, sh, a1, a2, mora } = s;
  s.raw.prepare('UPDATE town_seat_holds SET standing = 73, tithe = 5, tithe_week = ?, owed = 40 WHERE key = ?').run(W + 1, ANTICLERE.key);
  s.raw.prepare('INSERT OR REPLACE INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').run(W + 1, ANTICLERE.key, sh.gid, 120);
  for (const [work, tier] of [['walls', 2], ['gatehouse', 1], ['market', 0]]) s.raw.prepare('INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, ?, ?, ?)').run(ANTICLERE.key, work, tier, T0);
  const legacyNow = () => s.raw.prepare('SELECT week, guild_id, amount FROM town_seat_legacy WHERE key = ? ORDER BY week, guild_id').all(ANTICLERE.key).map((l) => [l.week, l.guild_id, l.amount]);
  const legacy0 = legacyNow();
  assert.ok(legacy0.some(([w, g, n]) => w === W + 1 && g === sh.gid && n === 120));
  s.setNow(START + 1500);
  const won = await s.claim(a1);
  assert.equal(won.status, 200, JSON.stringify(won.body));
  assert.equal(won.body.honours.marks, SIEGE_HONOURS.win.marks);
  assert.equal(s.holdOf().guild_id, eo.gid, 'taken');
  assert.notDeepEqual(legacyNow(), legacy0, 'the capture cleared the old holder\'s Legacy');
  const prior = JSON.parse(s.raw.prepare('SELECT prior FROM town_seat_results WHERE week = ? AND key = ?').get(W + 1, ANTICLERE.key).prior);
  assert.deepEqual({ ...prior, legacy: [...prior.legacy].sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)) }, {
    hold: { guild: sh.gid, region: ANTICLERE.region, standing: 73, since: W - 2, truce: null, tithe: 5, titheWeek: W + 1, owed: 40 },
    legacy: legacy0, forts: { gatehouse: 1, market: 0, walls: 2 }, projects: [], held: [], edict: null,
  }, 'the result kept what stood before it');
  const tier = (work) => s.raw.prepare('SELECT tier, building, guild_id FROM town_seat_forts WHERE key = ? AND work = ?').get(ANTICLERE.key, work);
  assert.deepEqual([tier('walls').tier, tier('gatehouse').tier], [1, 0], 'the capture\'s drop');
  // the capturer begins a project, its materials held; and proclaims next week's Edict
  s.raw.prepare('UPDATE town_seat_forts SET building = 2, guild_id = ? WHERE key = ? AND work = ?').run(eo.gid, ANTICLERE.key, 'walls');
  s.raw.prepare("INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, 'walls', 'iron', 5)").run(ANTICLERE.key);
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, at) VALUES (?, ?, 'market-day', ?, 'x', ?)").run(ANTICLERE.key, W + 2, eo.gid, T0);
  // a Fortifier's save this capture spent (its row stamped at the result's clock): unspent by the void
  s.raw.prepare("INSERT INTO town_seat_fortifier (season, key, account, at) SELECT ?, ?, 'x', at FROM town_seat_results WHERE week = ? AND key = ?").run(W, ANTICLERE.key, W + 1, ANTICLERE.key);
  const paid = s.marks(a1);
  const r = await s.voidIt(mora);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, key: ANTICLERE.key, week: W + 1, battle: 'siege', result: 'attack', restored: true });
  assert.equal(s.battle().state, 'void');
  assert.deepEqual(s.holdOf(), { guild_id: sh.gid, standing: 73, since_week: W - 2, truce_week: null, tithe: 5, tithe_week: W + 1, owed: 40 }, 'the Charter back as it stood');
  assert.equal(s.raw.prepare('SELECT amount FROM town_seat_legacy WHERE week = ? AND key = ? AND guild_id = ?').get(W + 1, ANTICLERE.key, sh.gid)?.amount, 120, 'its Legacy back');
  assert.deepEqual(legacyNow(), legacy0, 'every Legacy row as it stood');
  assert.deepEqual({ ...tier('walls') }, { tier: 2, building: null, guild_id: null }, 'the Walls at the tier they were fought behind, the capturer\'s project fallen');
  assert.equal(tier('gatehouse').tier, 1);
  assert.equal(tier('market').tier, 0);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_fort_held WHERE key = ?').get(ANTICLERE.key).n, 0);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_fortifier WHERE key = ?').get(ANTICLERE.key).n, 0, 'the Fortifier\'s save unspent');
  assert.equal(s.raw.prepare("SELECT qty FROM town_seat_stockpile WHERE key = ? AND material = 'iron'").get(ANTICLERE.key)?.qty, 5, 'its materials to the seat\'s stockpile');
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 2).state, 'void', 'the capturer\'s Edict void');
  assert.equal(s.marks(a1), paid, 'Honours already paid stand');
  const after = await s.claim(a2);
  assert.deepEqual([after.status, after.body.error], [409, 'battle-void'], 'a receipt after the void earns nothing');
  assert.equal(s.marks(a2), 0);
  const row = s.voids();
  assert.deepEqual(row, [{ week: W + 1, battle: 'siege', result: 'attack', guild: { name: 'Ebon Oath', tag: 'EO' }, holder: { name: 'The Silver Hand', tag: 'SH' }, restored: true, by: 'Mora' }]);
  const words = chronicleLine({ kind: 'siege-voided', week: W + 1, data: row[0] }, ANTICLERE);
  assert.equal(words, `In week ${W + 1}, the siege of Anticlere was voided by the Moderators, and the Charter of Anticlere went back to the Silver Hand <SH>.`);
  assert.equal((await s.voidIt(mora)).body.repeat, true, 'idempotent');
  assert.equal(s.holdOf().guild_id, sh.gid);
});

test('VOID AFTER A CAPTURE WHOSE RESULT KEPT NOTHING (written before migration 0067): the Charter back at Standing 50, from this week, no Tithe (mutants: the fallbacks)', async (t) => {
  const s = await siegeWeek(t);
  s.setNow(START + 1500);
  assert.equal((await s.claim(s.a1)).status, 200);
  s.raw.prepare('UPDATE town_seat_results SET prior = NULL').run();
  const r = await s.voidIt(s.mora);
  assert.equal(r.body.restored, true);
  assert.deepEqual(s.holdOf(), { guild_id: s.sh.gid, standing: STANDING_START, since_week: W + 1, truce_week: null, tithe: 0, tithe_week: null, owed: 0 });
  assert.equal(s.raw.prepare('SELECT region FROM town_seat_holds WHERE key = ?').get(ANTICLERE.key).region, ANTICLERE.region, 'its region the registry\'s');
});

test('VOID AFTER A HOLD: the holder\'s Standing back where it stood and its defence fifth struck; the challenger\'s bar lifted, its influence at the seat counted again; the holder keeps the seat; with nothing kept, its Standing left as it stands (AUDIT 529 V4) (mutants: the Standing; the bonus; the bar; the influence)', async (t) => {
  const s = await siegeWeek(t);
  const { eo, sh, d1, mora } = s;
  s.raw.prepare('UPDATE town_seat_holds SET standing = 60 WHERE key = ?').run(ANTICLERE.key);
  s.raw.prepare('INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(W + 1, ANTICLERE.key, eo.gid, eo.gm.id, eo.gm.character, 'watch', 300, ANTICLERE.region, 1, 'void-test', START - 7200);
  s.setNow(START + 1500);
  const held = await s.claim(d1, { sd: 'defend', r: 'defend', a: 1 });
  assert.equal(held.status, 200, JSON.stringify(held.body));
  assert.equal(s.holdOf().standing, 75, 'held: +15');
  const after = () => s.raw.prepare('SELECT guild_id, what FROM town_seat_aftermath WHERE week = ? AND key = ? ORDER BY what').all(W + 1, ANTICLERE.key).map((r) => [r.guild_id, r.what]);
  assert.deepEqual(after(), [[eo.gid, 'barred'], [sh.gid, 'bonus']]);
  const voided = () => s.raw.prepare('SELECT voided FROM town_seat_influence WHERE ref = ?').get('void-test').voided;
  assert.equal(voided(), 1);
  const r = await s.voidIt(mora);
  assert.deepEqual(r.body, { ok: true, key: ANTICLERE.key, week: W + 1, battle: 'siege', result: 'defend', restored: false });
  assert.equal(s.holdOf().standing, 60, 'the Standing the hold gave struck');
  assert.equal(s.holdOf().guild_id, sh.gid, 'the holder keeps the seat');
  assert.deepEqual(after(), [], 'its defence fifth struck, the challenger\'s bar lifted');
  assert.equal(voided(), 0, 'the challenger\'s influence counts again');
  assert.match(chronicleLine({ kind: 'siege-voided', week: W + 1, data: s.voids()[0] }, ANTICLERE), /the siege of Anticlere was voided by the Moderators\.$/);
  // a second seat's hold whose result kept nothing: its Standing left as it stands (AUDIT 529 V4 - DECIDED: never a guess)
  const s2 = await siegeWeek(t);
  s2.setNow(START + 1500);
  assert.equal((await s2.claim(s2.d1, { sd: 'defend', r: 'defend', a: 1 })).status, 200);
  s2.raw.prepare('UPDATE town_seat_results SET prior = NULL').run();
  s2.raw.prepare('UPDATE town_seat_holds SET standing = 70').run();
  await s2.voidIt(s2.devra);
  assert.equal(s2.holdOf().standing, 70);
});

test('VOID A FORFEIT PAYS NOTHING: a forfeit the Moderators voided is not the pair\'s forfeit of the Season - the next one still gives the holder its +10 (mutants: the voided forfeit counted)', async (t) => {
  const s = await siegeWeek(t);
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, state, at) VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 'void', ?)`)
    .run(W, ANTICLERE.key, s.eo.gid, s.sh.gid, T0 - DAY, T0 - DAY + 1800, T0);
  s.raw.prepare("INSERT INTO town_seat_results (week, key, result, raised, winner, rid, at) VALUES (?, ?, 'forfeit', 0, 'defend', 'r0', ?)").run(W, ANTICLERE.key, T0);
  s.setNow(START + 1500);
  const st0 = s.holdOf().standing;
  const f = await s.claim(s.d1, { sd: 'defend', r: 'forfeit', a: 0 });
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.equal(s.holdOf().standing - st0, 10, 'the voided forfeit counted for nothing');
});

test('VOID AFTER A TOURNEY: the winner\'s Charter gone - the seat unheld again - its Edict void; the claim fee stays burnt; the Chronicle names the Tourney (mutants: the Tourney\'s Charter)', async (t) => {
  const s = await siegeWeek(t);
  const { eo, sh, mora } = s;
  s.treasury(eo.gid, CLAIM_FEE.palace);
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at) VALUES (?, ?, 'tourney', 'palace', ?, ?, ?, ?, ?)`)
    .run(W + 1, ASHFIELD.key, eo.gid, sh.gid, START + 4 * 3600, START + 4 * 3600 + 1800, T0);
  s.setNow(START + 4 * 3600 + 1500);
  const fee0 = s.purse(eo.gid);
  const won = await s.claim(s.a1, { sk: ASHFIELD.key, h: 0 });
  assert.equal(won.status, 200, JSON.stringify(won.body));
  assert.equal(s.holdOf(ASHFIELD.key).guild_id, eo.gid);
  assert.equal(s.purse(eo.gid), fee0 - CLAIM_FEE.palace);
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, at) VALUES (?, ?, 'market-day', ?, 'x', ?)").run(ASHFIELD.key, W + 2, eo.gid, T0);
  const r = await s.voidIt(mora, ASHFIELD.key);
  assert.deepEqual(r.body, { ok: true, key: ASHFIELD.key, week: W + 1, battle: 'tourney', result: 'attack', restored: false });
  assert.equal(s.holdOf(ASHFIELD.key), null, 'the seat unheld again');
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ASHFIELD.key, W + 2).state, 'void');
  assert.equal(s.purse(eo.gid), fee0 - CLAIM_FEE.palace, 'the fee stays burnt');
  assert.equal(chronicleLine({ kind: 'siege-voided', week: W + 1, data: s.voids(ASHFIELD.key)[0] }, ASHFIELD).endsWith('the Tourney for Ashfield was voided by the Moderators.'), true);
  assert.equal(s.holdOf().guild_id, sh.gid, 'the siege at Anticlere untouched');
  assert.equal(s.battle().state, 'scheduled');
});

test('VOID THE CHAT WORD: `/siege void <key>` parsed - anything else /siege is the usage, any other line null; never guarded on the client - the book asks the service and says its answer in words; world.js\'s chat arm (mutants: the parse; the words)', async () => {
  assert.deepEqual(parseSiegeCommand('/siege void 3021'), { op: 'void', key: 3021 });
  assert.deepEqual(parseSiegeCommand('  /SIEGE VOID 7 '), { op: 'void', key: 7 });
  for (const bad of ['/siege', '/siege void', '/siege void x', '/siege strike 7', '/siege end 7', '/siege void 7 8', '/siege void -7']) assert.deepEqual(parseSiegeCommand(bad), { error: SIEGE_USAGE }, bad);
  assert.equal(parseSiegeCommand('/sieges'), null);
  assert.equal(parseSiegeCommand('/seat strike 7'), null);
  assert.equal(parseSiegeCommand('hello'), null);
  const asked = [];
  const answers = [
    { ok: true, data: { battle: 'siege', restored: true } },
    { ok: true, data: { battle: 'tourney', repeat: true } },
    { ok: false, error: 'not-moderator' },
  ];
  const door = { voidSiege: async (key) => { asked.push(key); return answers.shift(); } };
  const book = createTownSeatBook({ door: /** @type {any} */ (door), storage: null });
  assert.deepEqual(await book.voidSiege(3021), { ok: true, text: 'The siege at seat 3021 is voided - its Charter went back to the guild that held it.' });
  assert.deepEqual(await book.voidSiege(3022), { ok: true, text: 'The Tourney at seat 3022 is void already.' });
  assert.deepEqual(await book.voidSiege(3023), { ok: false, text: 'Only moderators can do that.' });
  assert.deepEqual(asked, [3021, 3022, 3023]);
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const siegeCmd = parseSiegeCommand\(text\);/);
  assert.match(w, /seatBook\.voidSiege\(siegeCmd\.key\)\.then\(\(r\) => say\(r\.text\)/);
  const client = readFileSync(new URL('../../src/net/accountClient.js', import.meta.url), 'utf8');
  assert.match(client, /voidSiege: \(key\) => post\('\/v1\/seats\/siege\/void', \{ key \}\)/);
});

// ─── AUDIT 529: the void's audit (V1-V5) ─────────────────────────────

/** A revolt at Ashfield in week W + 1 against the Ebon Oath, which holds it at Standing 0 - its Walls raising a tier (six
 *  iron held) and its Edict for next week proclaimed. */
function revoltAt(s) {
  const K = ASHFIELD.key;
  s.raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, 0, 0)`)
    .run(K, s.eo.gid, ASHFIELD.region, ASHFIELD.tier, W - 3, T0 - 20 * DAY);
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at) VALUES (?, ?, 'revolt', 'palace', '', ?, ?, ?, ?)`)
    .run(W + 1, K, s.eo.gid, START + 4 * 3600, START + 4 * 3600 + 1800, T0);
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, siegewright, stands_at, at) VALUES (?, 'walls', 1, 2, ?, 0, 0, NULL, ?)").run(K, s.eo.gid, T0 + 7);
  s.raw.prepare("INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, 'walls', 'iron', 6)").run(K);
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, at) VALUES (?, ?, 'market-day', ?, 'x', ?)").run(K, W + 2, s.eo.gid, T0);
  return {
    K,
    seat: () => ({
      hold: s.holdOf(K),
      edict: s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(K, W + 2)?.state ?? null,
      walls: { ...s.raw.prepare('SELECT tier, building, guild_id, stands_at, at FROM town_seat_forts WHERE key = ? AND work = ?').get(K, 'walls') },
      held: s.raw.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM town_seat_fort_held WHERE key = ?').get(K).n,
      iron: s.raw.prepare("SELECT qty FROM town_seat_stockpile WHERE key = ? AND material = 'iron'").get(K)?.qty ?? 0,
      stood: s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_history WHERE key = ? AND kind = 'revolt-stood'").get(K).n,
    }),
  };
}

test('AUDIT 529 V1 VOID A REVOLT BEFORE ITS RESULT: what the Turning does with a revolt nobody put down - the holder\'s Charter lapses now, its project fallen to the stockpile, its Edict for next week void, the Chronicle\'s revolt-stood; the Turning after finds the seat as it would have left it, and lapses nothing twice; a holder already gone lapses nothing (mutants: the lapse; the holder asked)', async (t) => {
  const outcome = async (how) => {
    const s = await siegeWeek(t);
    const r = revoltAt(s);
    s.setNow(START - 3600);
    let now = null;
    if (how === 'relinquished') assert.equal((await s.call('/v1/seats/relinquish', { character: s.eo.gm.character, key: r.K }, s.eo.gm)).status, 200);
    if (how !== 'control') {
      const v = await s.voidIt(s.mora, r.K);
      assert.deepEqual(v.body, { ok: true, key: r.K, week: W + 1, battle: 'revolt', result: null, restored: false });
      assert.equal(s.battle(r.K).state, 'void');
      now = r.seat();
    }
    s.setNow(AFTER(W + 1));
    await s.call('/v1/seats/list', {}, s.sh.gm);
    assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W + 1), 'the week settled');
    return { now, after: r.seat() };
  };
  const control = await outcome('control');
  const lapsed = { hold: null, edict: 'void', walls: { tier: 1, building: null, guild_id: null, stands_at: null, at: T0 + 7 }, held: 0, iron: 6, stood: 1 };
  assert.deepEqual(control.after, lapsed, 'the Turning lapses a revolt nobody put down');
  const voided = await outcome('void');
  assert.deepEqual(voided.now, lapsed, 'the void lapses it now - never a Charter saved');
  assert.deepEqual(voided.after, control.after, 'and the Turning after finds the seat as it would have left it');
  const gone = await outcome('relinquished');
  assert.equal(gone.now.stood, 0, 'a holder already gone: no revolt stood against it');
  assert.equal(gone.now.hold, null);
});

test('AUDIT 529 V2 VOID AFTER A CAPTURE GIVES BACK THE HOLDER\'S PROJECTS: each the capture made fall begun again at its tier, its starter\'s marks and clock, what it held back out of the stockpile - the capturer\'s own project falling first in the same void; a project short of what it held waits on the stockpile again (its day forgotten) (mutants: the projects kept; given back; the stockpile; the day)', async (t) => {
  const s = await siegeWeek(t);
  const { sh, eo } = s;
  const K = ANTICLERE.key;
  const due = START + 5 * DAY, due2 = START + 6 * DAY;
  // the holder raising its Walls to 2 (a Builder's, every need held) and its Gatehouse to 1 (a Siegewright's, the same)
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, siegewright, stands_at, at) VALUES (?, 'walls', 1, 2, ?, 1, 0, ?, ?)").run(K, sh.gid, due, T0 + 11);
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, siegewright, stands_at, at) VALUES (?, 'gatehouse', 0, 1, ?, 0, 1, ?, ?)").run(K, sh.gid, due2, T0 + 12);
  s.raw.prepare("INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, 'walls', 'iron', 7), (?, 'gatehouse', 'stone', 4)").run(K, K);
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, siegewright, stands_at, at) VALUES (?, 'market', 0, 1, ?, 0, 0, NULL, ?)").run(K, sh.gid, T0 + 13);
  s.setNow(START + 1500);
  assert.equal((await s.claim(s.a1)).status, 200);
  const prior = JSON.parse(s.raw.prepare('SELECT prior FROM town_seat_results WHERE week = ? AND key = ?').get(W + 1, K).prior);
  assert.deepEqual([[...prior.projects].sort(), [...prior.held].sort()], [
    [['gatehouse', 1, sh.gid, 0, 1, due2, T0 + 12], ['market', 1, sh.gid, 0, 0, null, T0 + 13], ['walls', 2, sh.gid, 1, 0, due, T0 + 11]],
    [['gatehouse', 'stone', 4], ['walls', 'iron', 7]],
  ], 'the result kept the projects the drop made fall');
  const work = (w) => ({ ...s.raw.prepare('SELECT tier, building, guild_id, builder, siegewright, stands_at, at FROM town_seat_forts WHERE key = ? AND work = ?').get(K, w) });
  const held = (w) => Object.fromEntries(s.raw.prepare('SELECT material, qty FROM town_seat_fort_held WHERE key = ? AND work = ?').all(K, w).map((h) => [h.material, h.qty]));
  const stock = () => Object.fromEntries(s.raw.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ?').all(K).map((h) => [h.material, h.qty]));
  assert.deepEqual([work('walls').building, work('gatehouse').building, stock()], [null, null, { iron: 7, stone: 4 }], 'fallen, what they held to the stockpile');
  // the capturer begins its own Gatehouse and takes the stone in (one gone since)
  s.raw.prepare("UPDATE town_seat_forts SET building = 1, guild_id = ? WHERE key = ? AND work = 'gatehouse'").run(eo.gid, K);
  s.raw.prepare("UPDATE town_seat_stockpile SET qty = 0 WHERE key = ? AND material = 'stone'").run(K);
  s.raw.prepare("INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, 'gatehouse', 'stone', 3)").run(K);
  s.raw.prepare("UPDATE town_seat_forts SET tier = 1 WHERE key = ? AND work = 'market'").run(K);   // and the Market Hall it raised stands
  const r = await s.voidIt(s.mora);
  assert.equal(r.body.restored, true);
  assert.deepEqual(work('walls'), { tier: 1, building: 2, guild_id: sh.gid, builder: 1, siegewright: 0, stands_at: due, at: T0 + 11 }, 'the Walls\' project again, its day kept: everything it held came back');
  assert.deepEqual(held('walls'), { iron: 7 });
  assert.deepEqual(work('gatehouse'), { tier: 0, building: 1, guild_id: sh.gid, builder: 0, siegewright: 1, stands_at: null, at: T0 + 12 }, 'the Gatehouse\'s the holder\'s again - short a stone, its day forgotten');
  assert.deepEqual(held('gatehouse'), { stone: 3 });
  assert.deepEqual(stock(), { iron: 0, stone: 0 }, 'taken back out of the stockpile');
  assert.deepEqual([work('market').tier, work('market').building], [1, null], 'a work that stands past the tier its project was raising begins nothing');
});

test('AUDIT 529 V2 VOID A REVOLT THAT STOOD: the Charter back to its holder, its fallen project begun again with what it held, its Edict for next week proclaimed again (mutants: the revolt\'s prior; its project; its Edict)', async (t) => {
  const s = await siegeWeek(t);
  const r = revoltAt(s);
  s.setNow(START + 4 * 3600 + 1500);
  const stood = await s.claim(s.a1, { sk: r.K, sd: 'defend', r: 'attack', h: 0 });
  assert.equal(stood.status, 200, JSON.stringify(stood.body));
  assert.deepEqual(r.seat(), { hold: null, edict: 'void', walls: { tier: 1, building: null, guild_id: null, stands_at: null, at: T0 + 7 }, held: 0, iron: 6, stood: 1 }, 'the revolt stood: the Charter lapsed');
  const prior = JSON.parse(s.raw.prepare('SELECT prior FROM town_seat_results WHERE week = ? AND key = ?').get(W + 1, r.K).prior);
  assert.deepEqual([prior.projects, prior.held, prior.edict], [[['walls', 2, s.eo.gid, 0, 0, null, T0 + 7]], [['walls', 'iron', 6]], 'market-day']);
  const v = await s.voidIt(s.mora, r.K);
  assert.deepEqual(v.body, { ok: true, key: r.K, week: W + 1, battle: 'revolt', result: 'attack', restored: true });
  const now = r.seat();
  assert.deepEqual([now.hold?.guild_id, now.hold?.standing, now.hold?.since_week], [s.eo.gid, 0, W - 3], 'the Charter back as it stood');
  assert.deepEqual({ ...now, hold: null }, { hold: null, edict: 'proclaimed', walls: { tier: 1, building: 2, guild_id: s.eo.gid, stands_at: null, at: T0 + 7 }, held: 6, iron: 0, stood: 1 });
});

test('AUDIT 529 V3 VOID A CAPTURE OF A SEAT NOBODY HELD: its holder relinquished before the battle - the capturer\'s Charter goes and none comes back; the guild that gave it up does not get it again (mutants: the kept unheld seat)', async (t) => {
  const s = await siegeWeek(t);
  s.setNow(START - 3600);
  assert.equal((await s.call('/v1/seats/relinquish', { character: s.sh.gm.character, key: ANTICLERE.key }, s.sh.gm)).status, 200);
  assert.equal(s.holdOf(), null);
  s.setNow(START + 1500);
  assert.equal((await s.claim(s.a1)).status, 200);
  assert.deepEqual([s.holdOf().guild_id, s.holdOf().since_week], [s.eo.gid, W + 1], 'taken');
  assert.equal(JSON.parse(s.raw.prepare('SELECT prior FROM town_seat_results').get().prior).hold, null, 'the result kept a seat nobody held');
  const v = await s.voidIt(s.mora);
  assert.deepEqual(v.body, { ok: true, key: ANTICLERE.key, week: W + 1, battle: 'siege', result: 'attack', restored: false });
  assert.equal(s.holdOf(), null, 'unheld again, as it stood');
  assert.equal(s.voids()[0].restored, false);
  assert.match(chronicleLine({ kind: 'siege-voided', week: W + 1, data: s.voids()[0] }, ANTICLERE), /the siege of Anticlere was voided by the Moderators\.$/);
});

test('AUDIT 529 V4 VOID A HOLD WHOSE RESULT KEPT NOTHING: its Standing left as it stands - never the hold\'s +15 taken off past a Throne\'s -5, the cap, or a forfeit the Season already paid (mutants: the fallback)', async (t) => {
  const cases = [
    { standing: 60, o: { sd: 'defend', r: 'defend', a: 1, th: 1 }, gave: 10 },   // the Throne reached: +10
    { standing: 95, o: { sd: 'defend', r: 'defend', a: 1 }, gave: 5 },   // the cap
    { standing: 50, o: { sd: 'defend', r: 'forfeit', a: 0 }, gave: 0, paid: true },   // a forfeit this Season already paid
  ];
  for (const c of cases) {
    const s = await siegeWeek(t);
    s.raw.prepare('UPDATE town_seat_holds SET standing = ? WHERE key = ?').run(c.standing, ANTICLERE.key);
    if (c.paid) {
      s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, state, at) VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 'forfeit', ?)`)
        .run(W, ANTICLERE.key, s.eo.gid, s.sh.gid, T0 - DAY, T0 - DAY + 1800, T0);
      s.raw.prepare("INSERT INTO town_seat_results (week, key, result, raised, winner, rid, at) VALUES (?, ?, 'forfeit', 0, 'defend', 'r0', ?)").run(W, ANTICLERE.key, T0);
    }
    s.setNow(START + 1500);
    assert.equal((await s.claim(s.d1, c.o)).status, 200);
    assert.equal(s.holdOf().standing, c.standing + c.gave, JSON.stringify(c));
    s.raw.prepare('UPDATE town_seat_results SET prior = NULL WHERE week = ?').run(W + 1);
    assert.equal((await s.voidIt(s.mora)).body.result, c.o.r);
    assert.equal(s.holdOf().standing, c.standing + c.gave, `nothing kept, nothing guessed: ${JSON.stringify(c)}`);
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_aftermath WHERE week = ? AND key = ?').get(W + 1, ANTICLERE.key).n, 0, 'its defence fifth and the bar struck still');
  }
});

test('AUDIT 529 V5 VOID AFTER ITS WEEK SETTLED: a void whose clock was read before the Turning, landing after it reckoned the battle\'s week - refused (409 battle-settled, in words) and nothing moves; a Turning that settles between the void\'s read and its write rolls it back whole (mutants: the read; the write; the status; the words)', async (t) => {
  const s = await siegeWeek(t);
  s.setNow(START + 1500);
  assert.equal((await s.claim(s.a1)).status, 200);
  s.setNow(AFTER(W + 1));
  await s.call('/v1/seats/list', {}, s.sh.gm);
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W + 1), 'the Turning reckoned the week with the capture in it');
  s.setNow(turning(W + 1) - 1);
  const late = await s.voidIt(s.mora);
  assert.deepEqual([late.status, late.body.error], [409, 'battle-settled']);
  assert.equal(accountRefusalText('battle-settled'), 'That battle\'s week is settled and can no longer be voided.');
  assert.equal(s.battle().state, 'fought');
  assert.equal(s.holdOf().guild_id, s.eo.gid, 'the capture stands as the Turning reckoned it');
  assert.deepEqual(s.voids(), []);
  // the race: the week settled after the void read it unsettled - its own write asks again
  const s2 = await siegeWeek(t);
  s2.setNow(START + 1500);
  assert.equal((await s2.claim(s2.a1)).status, 200);
  const db = s2.svc.env.DB, prepare = db.prepare, batch = db.batch, voiding = new Set();
  let raced = false;
  db.prepare = (sql) => { const st = prepare.call(db, sql); if (sql.includes("SET state = 'void' WHERE week = ?1 AND key = ?2 AND state IN")) voiding.add(st); return st; };
  db.batch = async (list) => {
    if (!raced && list.some((st) => voiding.has(st))) { raced = true; s2.raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W + 1, START + 1600); }
    return batch.call(db, list);
  };
  const r2 = await s2.voidIt(s2.mora);
  assert.equal(raced, true);
  assert.deepEqual([r2.status, r2.body.error], [409, 'battle-settled']);
  assert.equal(s2.battle().state, 'fought');
  assert.equal(s2.holdOf().guild_id, s2.eo.gid);
  assert.deepEqual(s2.voids(), []);
});
