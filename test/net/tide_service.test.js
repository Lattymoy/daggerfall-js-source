// SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE TIDES IN THE SERVICE - each set
// against a twin service counting no Season (where every land is Calm): a Daedric Incursion's gate kills and a Plague's
// Watch in the standings, the week's and the coming week's Tide on the Seat tab, a Plague pricing the coming week's
// Festival at the Turning (bible/11-Multiplayer/Seats-Arc.md 9.3). Driven through the real Worker over node:sqlite.
// The rolls are the law's (test/net/tide_law.test.js): around T0 the Marches roll a Daedric Incursion in week W and a Plague
// in week W+1, pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, WATCH_INFLUENCE, GATE_INFLUENCE } from '../../src/net/townSeatLaw.js';
import { tideOf } from '../../src/net/tideLaw.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;

async function stood(t, zero) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', ...(zero != null ? { SEASON_ZERO_WEEK: String(zero) } : {}) });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const gm = await svc.registered('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', 100000, 1, 1, 'seed', NULL, ?)`).run(gid, `seed-${gid}`);
  const week = (w, { watch = 0, gate = false } = {}) => {
    raw.prepare('INSERT OR IGNORE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(w, gm.id, gid, gm.character, T0);
    raw.prepare('INSERT OR IGNORE INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(w, gid, ANTICLERE.region, ANTICLERE.key, 'x', T0);
    if (watch) raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, ?, 'watch', ?, ?, 1, ?, ?)`).run(w, ANTICLERE.key, gid, gm.id, gm.character, watch, ANTICLERE.region, `w-${w}`, T0);
    if (gate) {
      const day = 9000 + w;
      raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        VALUES (?, ?, ?, ?, ?, 'gate', 300, ?, ?, ?, ?)`).run(w, ANTICLERE.key, gid, gm.id, gm.character, ANTICLERE.region, day, `g-${w}`, T0);
      for (let i = 0; i < 3; i++) raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, region) VALUES (?, ?, 'ruhn', 'x', ?, ?)").run(day, witnesses[i].id, T0, ANTICLERE.region);
    }
  };
  const standings = async () => (await svc.call('/v1/seats/standings', { key: ANTICLERE.key, character: gm.character }, gm.secret)).body;
  return { svc, raw, gm, gid, week, standings, setNow: (v) => { now = v; } };
}

test('SEASON1 THE TIDES IN THE STANDINGS, AGAINST A TWIN COUNTING NONE: a Daedric Incursion\'s gate kill counts double, a Plague\'s Watch half; the Seat tab names this week\'s Tide and the next\'s, the twin none (mutants: the Tide threaded; the counted gate; the answer)', async (t) => {
  assert.deepEqual([tideOf(W, 'marches'), tideOf(W + 1, 'marches')], ['daedra', 'plague'], 'the rolls this test stands on');
  const run = async (zero) => {
    const s = await stood(t, zero);
    s.week(W, { watch: 20, gate: true });
    const a = await s.standings();
    s.week(W + 1, { watch: 20 });
    s.setNow(AFTER(W));
    const b = await s.standings();
    return { a: [a.standings[0].influence, a.tides], b: [b.standings[0].influence - b.standings[0].legacy, b.tides] };   // W+1's own week, its Legacy from W aside
  };
  const twin = await run(null), counted = await run(W - 2);
  assert.deepEqual(twin.a, [20 * WATCH_INFLUENCE + GATE_INFLUENCE, null]);
  assert.deepEqual(counted.a, [20 * WATCH_INFLUENCE + 2 * GATE_INFLUENCE, { now: 'daedra', next: 'plague' }], 'the Incursion: the gate kill doubled');
  assert.deepEqual(twin.b, [20 * WATCH_INFLUENCE, null]);
  assert.deepEqual(counted.b, [Math.floor(20 * WATCH_INFLUENCE * 0.5), { now: 'plague', next: tideOf(W + 2, 'marches') }], 'the Plague: the Watch halved');
});

test('SEASON1 THE TIDES AT THE TURNING, AGAINST A TWIN: the week\'s Incursion in the Turning\'s own totals (the Legacy it carries); the coming week\'s Plague doubles a Festival\'s cost (mutants: the Turning\'s Tide; the coming week\'s; its counted gate)', async (t) => {
  const run = async (zero) => {
    const s = await stood(t, zero);
    s.raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
      VALUES (?, ?, ?, 'palace', ?, 50, NULL, ?, 6, 0)`).run(ANTICLERE.key, s.gid, ANTICLERE.region, W - 3, T0 - 7 * DAY);
    s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'festival', ?, 'x', 'proclaimed', ?)").run(ANTICLERE.key, W + 1, s.gid, T0);
    s.week(W, { watch: 20, gate: true });
    s.setNow(AFTER(W));
    await s.standings();
    return [s.raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'seat-edict'").all().map((r) => Number(r.amount)), s.raw.prepare('SELECT amount FROM town_seat_legacy WHERE week = ?').get(W + 1)?.amount];
  };
  assert.deepEqual(await run(null), [[2500], Math.floor((20 * WATCH_INFLUENCE + GATE_INFLUENCE) / 10)]);
  assert.deepEqual(await run(W - 2), [[5000], Math.floor((20 * WATCH_INFLUENCE + 2 * GATE_INFLUENCE) / 10)], 'the Marches\' Plague in week W+1; the week\'s Incursion in the Legacy');
});
