// SEAT2b part two (b) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): A SIEGE'S WORKS ON ITS PASS - frozen at
// the battle's first pass (`town_seat_battles.works`, migration 0063): each work's tier then, a palace's Gatehouse or
// none, the camp's Rams where a gate stands, a Siegewright on the attacking roster; every later pass carries the same
// though a work stands between them (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5; server-account/src/seatSiege.js
// siegePass). Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs), on
// SEAT2a part three's battle week (test/seat2a_siege_service.test.js's harness, copied). `06-Systems/Online-Arc.md`
// SEAT2b part two (b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, siegeStartMs } from '../src/net/townSeatLaw.js';
import { verifyOrder } from '../src/net/identityToken.js';
import { mintSiegeReceipt } from '../src/net/siegeReceipt.js';
import { SIEGE_UNITS_PER_M } from '../src/net/siegeRef.js';
import { xpForRank } from '../src/net/professionLaw.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const S = (ms) => Math.floor(ms / 1000);
const START = S(siegeStartMs(W + 1, 0, 20));
const F = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * SIEGE_UNITS_PER_M, z * SIEGE_UNITS_PER_M]);

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

const work = (raw, w, tier, o = {}) => raw.prepare(`INSERT INTO town_seat_forts (key, work, tier, building, stands_at, at) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (key, work) DO UPDATE SET tier = excluded.tier, building = excluded.building, stands_at = excluded.stands_at`).run(ANTICLERE.key, w, tier, o.building ?? null, o.standsAt ?? null, T0);
const sxOf = async (s, who) => {
  const r = await s.pass(who, F);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return (await verifyOrder(r.body.pass, s.svc.identityPublic, { subtle, nowS: s.getNow(), kind: 'siege' })).claims.sx;
};

test('SEAT2b part two (b) THE WORKS FROZEN AT THE FIRST PASS: the Walls\' tier, a palace\'s own Gatehouse, the camp\'s Rams and a Siegewright on the attacking roster, the Barracks\' tier - frozen on the battle\'s row; a Walls project standing between two passes moves nothing; every pass the same (mutants: each work\'s tier; the gate; the Rams; the Siegewright; the freeze)', async (t) => {
  const s = await battleWeek(t);
  work(s.raw, 'walls', 2);
  work(s.raw, 'gatehouse', 1);
  work(s.raw, 'barracks', 2, { building: 3, standsAt: T0 + 60 });   // a tier whose day has come counts
  work(s.raw, 'walls', 2, { building: 3, standsAt: START });   // ...one whose day comes after the door opens does not
  s.raw.prepare('UPDATE town_seat_battles SET rams = 2 WHERE week = ? AND key = ?').run(W + 1, ANTICLERE.key);
  s.raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec100, updated_at) VALUES (?, ?, 'building', ?, 'siegewright', ?)`).run(s.a2.id, s.a2.character, xpForRank(100), T0);  // PIN MOVED (CRAFT3): Carpentry's and Masonry's are Building's track
  s.setNow(START - 600 + 1);
  assert.equal((await s.pass(s.d1, F)).body.error, 'field-unsettled', 'one side\'s field alone settles nothing - and freezes nothing');
  assert.equal(s.battle().works, null);
  const first = await sxOf(s, s.a1);
  assert.deepEqual(first, [2, 1, 2, 1, 3], 'Walls 2, the tier-1 Gatehouse, two Rams, a Siegewright among the attackers, Barracks 3');
  assert.deepEqual(JSON.parse(s.battle().works), [2, 1, 2, 1, 3], 'frozen on the battle\'s row');
  s.setNow(START + 60);   // the Walls' third tier stands
  assert.deepEqual(await sxOf(s, s.d1), first, 'a work standing mid-battle moves no pass');
  assert.deepEqual(await sxOf(s, s.a1), first);
});

test('SEAT2b part two (b) A PALACE WITHOUT A GATE, AND NO SIEGEWRIGHT: no Gatehouse (-1) and no Ram whatever the camp sent; a Siegewright among the defenders is not the attackers\' (mutants: the gate\'s -1; the Rams\' gate; the attacking side)', async (t) => {
  const s = await battleWeek(t);
  s.raw.prepare('UPDATE town_seat_battles SET rams = 3 WHERE week = ? AND key = ?').run(W + 1, ANTICLERE.key);
  s.raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec100, updated_at) VALUES (?, ?, 'building', ?, 'siegewright', ?)`).run(s.d1.id, s.d1.character, xpForRank(100), T0);  // PIN MOVED (CRAFT3): Carpentry's and Masonry's are Building's track
  s.setNow(START - 600 + 1);
  await s.pass(s.a1, F);
  assert.deepEqual(await sxOf(s, s.d1), [0, -1, 0, 0, 0]);
});
