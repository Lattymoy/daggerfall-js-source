// SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE BATTLES' WEEK, AS
// THE SERVICE KEEPS IT - the holder's window set at its board; the Turning placing every battle it names in the coming
// week (a siege at the window it froze, a Tourney at Wednesday 20:00, moved where a guild would fight twice at once); the
// two sides' rosters signed under 6.4's rules and their caps, closed ten minutes before the start; the Sellswords hired
// by name with a fee escrowed, signed under the contract or withdrawn; the Seat tab's view of it all; the deploy
// blackout's question. Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/11-Multiplayer/Seats-Arc.md 6.3-6.5; `06-Systems/Online-Arc.md` SEAT2a.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import {
  seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, siegeStartMs, BATTLE_LENGTH_MS, SIGN_CLOSES_MS, SIEGE_SIDE_MAX,
} from '../../src/net/townSeatLaw.js';
import { siegesLive, BLACKOUT_LEAD_S } from '../../server-account/src/seatBattles.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const S = (ms) => Math.floor(ms / 1000);

async function stood() {
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, ASHFIELD, ALCAIRE]) {
    for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  }
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  /** a member of `g`, `joined` seconds ago (a seasoned month by default), bound to it in week W (the Right's) unless not */
  const member = async (g, handle, { rank = 2, joined = T0 - 30 * DAY, bindW = true } = {}) => {
    const m = await svc.registered(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, joined);
    if (bindW) raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(W, m.id, g.gid, m.character, T0);
    return m;
  };
  const bindW = (who, gid, week = W) => raw.prepare('INSERT OR REPLACE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, who.id, gid, who.character, T0);
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const purse = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const hold = (seat, gid) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 0, 0)`).run(seat.key, gid, seat.region, seat.tier, W - 2, T0 - 14 * DAY);
  const pledge = (gid, seat, week = W) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(week, gid, seat.region, seat.key, 'x', T0);
  const earn = async (gid, seat, amount, week = W) => {
    while (amount > 0) {
      const a = await svc.guest();
      const n = Math.min(2000, amount);
      raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
      raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, n, seat.region, `t:${a.id}:${week}:${seat.key}`, T0);
      amount -= n;
    }
  };
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  const battle = (key, week = W + 1) => raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(week, key) ?? null;
  const lines = (kind) => raw.prepare('SELECT src_kind, dst_kind, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind).map((r) => [r.src_kind, r.dst_kind, Number(r.amount)]);
  const roster = (key) => raw.prepare('SELECT account, side, sellsword, fee FROM town_seat_rosters WHERE week = ? AND key = ? ORDER BY at, account').all(W + 1, key);
  return { svc, raw, guild, member, bindW, treasury, purse, hold, pledge, earn, call, battle, lines, roster };
}

/** A held ANTICLERE (the Silver Hand's) challenged by the Ebon Oath at the Turning of week W. */
async function rightAtAnticlere(t, { window = null } = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const s = await stood();
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid); s.treasury(sh.gid, 10000);
  await s.earn(sh.gid, ANTICLERE, 500);
  s.pledge(eo.gid, ANTICLERE); await s.earn(eo.gid, ANTICLERE, 7000);
  if (window) assert.equal((await s.call('/v1/seats/window', { character: sh.gm.character, key: ANTICLERE.key, ...window }, sh.gm)).status, 200);
  now = AFTER(W);
  await s.call('/v1/seats/list', {}, sh.gm);   // the Turning
  return { ...s, sh, eo, setNow: (n) => { now = n; }, getNow: () => now };
}

test('SEAT2a THE WINDOW AND THE SCHEDULE: the holder\'s Guildmaster or an Officer sets a day Wednesday to Saturday and a start 16:00-02:00 (a member, another guild, a bad hour refused); the Turning freezes it into the battle it names - a siege at the window, a Tourney at Wednesday 20:00, a crown at its slot - and a guild that would fight twice at once has its second battle moved two hours on, the Chronicle saying so (mutants: the ranks; the window\'s bounds; the frozen window; the default; the clash; the move)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const s = await stood();
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const ic = await s.guild('Cyril', 'Iron Circle', 'IC');
  const rv = await s.guild('Rhea', 'Raven Vale', 'RV');
  const rw = await s.guild('Bran', 'Red Wolves', 'RW');
  const officer = await s.member(sh, 'Ofelia', { rank: 1 });
  const plain = await s.member(sh, 'Plaine', { rank: 2 });
  s.hold(ANTICLERE, sh.gid); s.hold(ALCAIRE, sh.gid); s.treasury(sh.gid, 20000);
  const win = (who, key, day, hour) => s.call('/v1/seats/window', { character: who.character, key, day, hour }, who);
  assert.deepEqual((await win(officer, ANTICLERE.key, 1, 21)).body, { ok: true, window: { day: 1, hour: 21 } }, 'an Officer: Thursday 21:00');
  assert.equal((await win(sh.gm, ALCAIRE.key, 1, 21)).status, 200, 'the Guildmaster: the same hour at its second seat');
  assert.equal((await win(plain, ANTICLERE.key, 2, 20)).body.error, 'guild-rank');
  assert.equal((await win(eo.gm, ANTICLERE.key, 2, 20)).body.error, 'seat-not-held');
  for (const [d, h] of [[4, 20], [-1, 20], [0, 3], [0, 15], [0, 24]]) assert.equal((await win(sh.gm, ANTICLERE.key, d, h)).body.error, 'bad-window', `${d} ${h}`);
  // two Rights against the Hand's two seats, a Tourney at an unheld third
  await s.earn(sh.gid, ANTICLERE, 300); await s.earn(sh.gid, ALCAIRE, 300);
  s.pledge(eo.gid, ANTICLERE); await s.earn(eo.gid, ANTICLERE, 7000);
  s.pledge(ic.gid, ALCAIRE); await s.earn(ic.gid, ALCAIRE, 7000);
  s.pledge(rv.gid, ASHFIELD); await s.earn(rv.gid, ASHFIELD, 7000);
  s.pledge(rw.gid, ASHFIELD); await s.earn(rw.gid, ASHFIELD, 6800);
  now = AFTER(W);
  await s.call('/v1/seats/list', {}, sh.gm);
  const a = s.battle(ANTICLERE.key), b = s.battle(ALCAIRE.key), c = s.battle(ASHFIELD.key);
  assert.deepEqual([a.kind, a.attacker, a.defender, a.starts_at, a.ends_at, a.moved], ['siege', eo.gid, sh.gid, S(siegeStartMs(W + 1, 1, 21)), S(siegeStartMs(W + 1, 1, 21) + BATTLE_LENGTH_MS.palace), 0], 'at the window frozen at the Turning');
  assert.deepEqual([b.kind, b.starts_at, b.moved], ['siege', S(siegeStartMs(W + 1, 1, 23)), 1], 'the Hand would fight twice at once: the second moved two hours on');
  assert.deepEqual([c.kind, c.attacker, c.defender, c.starts_at, c.ends_at, c.moved], ['tourney', rv.gid, rw.gid, S(siegeStartMs(W + 1, 0, 20)), S(siegeStartMs(W + 1, 0, 20) + BATTLE_LENGTH_MS.tourney), 0], 'a Tourney: Wednesday 20:00');
  assert.ok(s.raw.prepare("SELECT 1 FROM town_seat_history WHERE key = ? AND kind = 'battle-moved'").get(ALCAIRE.key), 'the Chronicle says so');
  // a window set after the Turning is the next Turning's, not this battle's
  await win(sh.gm, ANTICLERE.key, 3, 16);
  assert.equal(s.battle(ANTICLERE.key).starts_at, S(siegeStartMs(W + 1, 1, 21)));
});

test('SEAT2a THE ROSTERS: a member of seven days at the Turning, bound to the guild in the Right\'s week and to no other this week, signs onto its side (the signing binds it); a newer member, one unbound then, one fighting for another guild this week, one of neither guild refused; ten a side at a palace; a second signing refused; a place given back and taken again; nothing past ten minutes before the start (mutants: each rule; the cap; the close; the bind)', async (t) => {
  const s = await rightAtAnticlere(t);
  const { sh, eo } = s;
  const sign = (who) => s.call('/v1/seats/siege/sign', { character: who.character, key: ANTICLERE.key }, who);
  const a1 = await s.member(eo, 'Arden');
  assert.deepEqual((await sign(a1)).body, { ok: true, side: 'attack', sellsword: false });
  assert.equal(s.raw.prepare('SELECT guild_id FROM town_seat_binds WHERE week = ? AND account = ?').get(W + 1, a1.id).guild_id, eo.gid, 'the signing binds the week');
  assert.equal((await sign(a1)).body.error, 'sign-twice');
  const fresh = await s.member(eo, 'Fresh', { joined: turning(W) - SEAT_MEMBER_WAIT_S + 60 });
  assert.equal((await sign(fresh)).body.error, 'sign-new-member', 'not seven days at the Turning');
  const idle = await s.member(eo, 'Idlewyn', { bindW: false });
  assert.equal((await sign(idle)).body.error, 'sign-unbound', 'not bound to the guild in the Right\'s week');
  const turncoat = await s.member(eo, 'Turnor');
  s.bindW(turncoat, sh.gid, W + 1);
  assert.equal((await sign(turncoat)).body.error, 'sign-bound-elsewhere');
  const stranger = await s.svc.registered('Strang');
  assert.equal((await sign(stranger)).body.error, 'battle-not-side');
  const d1 = await s.member(sh, 'Dorran');
  assert.deepEqual((await sign(d1)).body, { ok: true, side: 'defend', sellsword: false });
  // the side's cap: ten at a palace
  for (let i = 2; i <= SIEGE_SIDE_MAX.palace; i++) assert.equal((await sign(await s.member(eo, `Atk${i}`))).status, 200, `attacker ${i}`);
  const eleventh = await s.member(eo, 'Atk11');
  assert.equal((await sign(eleventh)).body.error, 'side-full');
  assert.equal((await s.call('/v1/seats/siege/unsign', { key: ANTICLERE.key }, a1)).status, 200, 'a place given back');
  assert.equal((await sign(eleventh)).status, 200, 'and taken by another');
  assert.equal(s.roster(ANTICLERE.key).filter((r) => r.side === 'attack').length, SIEGE_SIDE_MAX.palace);
  // the rosters close ten minutes before the start
  const start = s.battle(ANTICLERE.key).starts_at;
  s.setNow(start - SIGN_CLOSES_MS / 1000);
  assert.equal((await sign(await s.member(sh, 'Late'))).body.error, 'sign-closed');
  assert.equal((await sign(await s.member(sh, 'Newer', { joined: turning(W) }))).body.error, 'sign-closed', 'the close said before any other rule');
  assert.equal((await s.call('/v1/seats/siege/unsign', { key: ANTICLERE.key }, d1)).body.error, 'sign-closed');
});

test('SEAT2a THE SELLSWORDS: a side\'s Guildmaster hires an account by name at a fee escrowed from the treasury (an Officer, a member of either guild, a third at a palace, a fee past the cap refused); the Sellsword signs under the contract (its fee on the roster, the contract signed, the week bound); an offered contract withdrawn sends the escrow home; an account on the other side\'s rosters in the last four weeks may not serve (mutants: the rank; the membership; the cap; the escrow; the return; the cooling)', async (t) => {
  const s = await rightAtAnticlere(t);
  const { sh, eo } = s;
  s.treasury(eo.gid, 1000);
  const hire = (who, handle, fee) => s.call('/v1/seats/siege/hire', { character: who.character, key: ANTICLERE.key, handle, fee }, who);
  const sword = await s.svc.registered('Bladra');
  await s.svc.registered('Cutter');
  const sword3 = await s.svc.registered('Dirk');
  const officer = await s.member(eo, 'Offa', { rank: 1 });
  assert.equal((await hire(officer, 'Bladra', 300)).body.error, 'guild-rank', 'the Guildmaster\'s alone');
  assert.equal((await hire(eo.gm, 'Offa', 0)).body.error, 'sellsword-member', 'a member of either guild is no Sellsword');
  assert.equal((await hire(eo.gm, 'Bladra', 5001)).body.error, 'bad-fee');
  assert.equal((await hire(eo.gm, 'Nobody', 0)).body.error, 'no-such-account');
  assert.deepEqual((await hire(eo.gm, 'Bladra', 300)).body, { ok: true, fee: 300 });
  assert.deepEqual(s.lines('sellsword-escrow'), [['guild', 'escrow', 300]], 'the fee escrowed');
  assert.equal(s.purse(eo.gid), 700);
  assert.equal((await hire(eo.gm, 'Bladra', 300)).body.error, 'hire-twice');
  assert.equal((await hire(eo.gm, 'Cutter', 0)).status, 200);
  assert.equal((await hire(eo.gm, 'Dirk', 0)).body.error, 'sellswords-full', 'two a side at a palace');
  // the Sellsword signs under its contract
  const sign = (who) => s.call('/v1/seats/siege/sign', { character: who.character, key: ANTICLERE.key }, who);
  assert.deepEqual((await sign(sword)).body, { ok: true, side: 'attack', sellsword: true, fee: 300 });
  assert.deepEqual(s.roster(ANTICLERE.key).map((r) => [r.side, r.sellsword, r.fee]), [['attack', 1, 300]]);
  assert.deepEqual((await s.call('/v1/seats/standings', { key: ANTICLERE.key, character: sword.character }, sword)).body.fight.sides.attack, { n: 1, swords: 1 }, 'the side counts its Sellsword');
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_hires WHERE account = ?').get(sword.id).state, 'signed');
  assert.equal(s.raw.prepare('SELECT guild_id FROM town_seat_binds WHERE week = ? AND account = ?').get(W + 1, sword.id).guild_id, eo.gid);
  // an offered contract withdrawn: the escrow home
  assert.equal((await s.call('/v1/seats/siege/withdraw', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Cutter' }, eo.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/withdraw', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Bladra' }, eo.gm)).body.error, 'hire-none', 'a signed contract stands');
  assert.equal((await hire(eo.gm, 'Dirk', 0)).status, 200, 'room again');
  // a hired account one of whose characters joined a side's guild since is no Sellsword
  s.raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 2, ?, ?)').run(sword3.id, 'alt-dirk', sh.gid, 'Alt', T0);
  assert.equal((await sign(sword3)).body.error, 'sellsword-member');
  s.raw.prepare("DELETE FROM guild_members WHERE char_id = 'alt-dirk'").run();
  // cooling: Dirk fought for the Hand two weeks ago
  s.raw.prepare("INSERT INTO town_seat_rosters (week, key, account, char_id, guild_id, side, sellsword, fee, at) VALUES (?, ?, ?, ?, ?, 'defend', 1, 0, ?)").run(W - 1, ALCAIRE.key, sword3.id, sword3.character, sh.gid, T0);
  assert.equal((await sign(sword3)).body.error, 'sellsword-cooling');
  // a withdrawn fee comes home; a refused sign moves nothing
  const fees = s.raw.prepare("SELECT dst_kind, amount FROM marks_ledger WHERE kind = 'sellsword-return'").all().map((r) => [r.dst_kind, Number(r.amount)]);
  assert.deepEqual(fees, []);
  assert.equal(s.purse(eo.gid), 700);
});

test('SEAT2a THE ESCROW COMES HOME and the Seat tab sees it all: a withdrawn contract\'s fee back in the treasury; the standings carry the battle - its start, its sides, the reader\'s side and place, the side\'s Guildmaster\'s contracts, the holder\'s window; the deploy blackout reads a battle live from thirty minutes before its start to its end (mutants: the return; the view; the lead; the end)', async (t) => {
  const s = await rightAtAnticlere(t, { window: { day: 2, hour: 18 } });
  const { sh, eo } = s;
  s.treasury(eo.gid, 1000);
  await s.svc.registered('Bladra');
  await s.call('/v1/seats/siege/hire', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Bladra', fee: 250 }, eo.gm);
  assert.equal(s.purse(eo.gid), 750);
  await s.call('/v1/seats/siege/withdraw', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Bladra' }, eo.gm);
  assert.deepEqual(s.lines('sellsword-return'), [['escrow', 'guild', 250]]);
  assert.equal(s.purse(eo.gid), 1000, 'the fee home');
  const a1 = await s.member(eo, 'Arden');
  await s.call('/v1/seats/siege/sign', { character: a1.character, key: ANTICLERE.key }, a1);
  const view = (who) => s.call('/v1/seats/standings', { key: ANTICLERE.key, character: who.character }, who).then((r) => r.body.fight);
  const start = S(siegeStartMs(W + 1, 2, 18));
  const f = await view(a1);
  assert.deepEqual([f.kind, f.startsAt, f.endsAt, f.attackerGuild.tag, f.defenderGuild.tag, f.sides.attack.n, f.sides.defend.n, f.max, f.swordsMax, f.open], ['siege', start, start + BATTLE_LENGTH_MS.palace / 1000, 'EO', 'SH', 1, 0, 10, 2, true]);
  assert.deepEqual(f.window, { day: 2, hour: 18 }, 'the holder\'s window');
  assert.deepEqual([f.mine.side, f.mine.signed, f.mine.hires], ['attack', true, undefined], 'a member sees no contracts');
  const g = await view(eo.gm);
  assert.deepEqual([g.mine.side, g.mine.signed, g.mine.hires], ['attack', false, []], 'the Guildmaster sees the contracts (none standing)');
  const h = await view(sh.gm);
  assert.deepEqual([h.mine.side, h.mine.signed, h.mine.hires], ['defend', false, []]);
  // the Charter changes hands: the window its former holder set is not the new holder's
  s.raw.prepare('UPDATE town_seat_holds SET guild_id = ? WHERE key = ?').run(eo.gid, ANTICLERE.key);
  assert.equal((await view(eo.gm)).window, null);
  // the deploy blackout
  assert.deepEqual(await siegesLive(s.svc.env.DB, start - BLACKOUT_LEAD_S - 1), { live: false, until: null });
  assert.deepEqual(await siegesLive(s.svc.env.DB, start - BLACKOUT_LEAD_S), { live: true, until: start + BATTLE_LENGTH_MS.palace / 1000 });
  assert.equal((await siegesLive(s.svc.env.DB, start + BATTLE_LENGTH_MS.palace / 1000)).live, false, 'over at its end');
  assert.equal(BLACKOUT_LEAD_S, 1800);
});
