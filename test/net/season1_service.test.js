// SEASON1 part one (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE SEASONS IN THE SERVICE - a Season's
// last Turning (its titles to the guildmasters, every Standing halfway back toward 50, no Legacy carried, the Chronicle's
// line), set against a twin service counting no Season; Season 0's last Turning wiping the seats and keeping what is
// owed and earned; the Season on the standings and on every title's claim; a Pact to its Season's end; the pair's
// Honours and a forfeit's Standing once a Season (bible/11-Multiplayer/Seats-Arc.md 9.1, 18). Driven through the real
// Worker over node:sqlite with every migration applied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, seasonStanding, SIEGE_HONOURS, STANDING_CHANGES } from '../../src/net/townSeatLaw.js';
import { tideOf } from '../../src/net/tideLaw.js';
import { verifyToken } from '../../src/net/identityToken.js';
import { mintSiegeReceipt } from '../../src/net/siege/siegeReceipt.js';
import { SEASON_ZERO_WIPED } from '../../server-account/src/seatTurning.js';

const subtle = globalThis.crypto.subtle;
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const TULUNE = { key: 3058, name: 'Tulune', region: 58, tier: 'palace', pixel: [150, 120] };
const YKALON = { key: 3040, name: 'Ykalon', region: 40, tier: 'palace', pixel: [560, 100] };
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
  for (const seat of [WAYREST, ALCAIRE, TULUNE, YKALON]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag, seed = 100000) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, seed, `seed-${gid}`);
    return { gm, gid, tag };
  };
  const hold = (seat, g, standing, since) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 6, 0)`).run(seat.key, g.gid, seat.region, seat.tier, since, standing, T0 - 7 * DAY);
  const held = (key) => raw.prepare('SELECT * FROM town_seat_holds WHERE key = ?').get(key) ?? null;
  const watch = (g, seat, week, amount = 100, who = g.gm) => {
    raw.prepare('INSERT OR IGNORE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, who.id, g.gid, who.character, T0);
    raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, ?, 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, g.gid, who.id, who.character, amount, seat.region, `w-${who.id}-${seat.key}-${week}-${amount}`, T0);
  };
  const count = (table) => raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  const list = async (g) => (await call('/v1/seats/list', {}, g.gm)).body;
  return { svc, raw, guild, hold, held, watch, count, call, list, getNow: () => now, setNow: (v) => { now = v; } };
}

test('SEASON1 A SEASON\'S END, AGAINST A TWIN COUNTING NONE: the crown\'s guildmaster "Crowned" and, its crown held the whole Season, its "Keeper"; a seat taken in the Season keeps no title; every Standing the twin\'s moved halfway back toward 50; no Legacy carried where the twin carries it; the Chronicle\'s line at both seats; the standings name the next Season; the titles worn with the Season they were won in, a Charter\'s with the Season now (mutants: the end; the titles; the keeper\'s week; the guildmaster; the halfway; the Legacy; the line; the Season on each claim)', async (t) => {
  const scenario = async (zero) => {
    const s = await stood(t, zero);
    const oa = await s.guild('Orla', 'The Oath', 'OA'), sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
    s.hold(WAYREST, oa, 50, W - 10);
    s.hold(ALCAIRE, sh, 70, W - 3);
    // the Oath's plain member (never its title); a Charter lapsing at this Turning (no title, no line); a guild with no
    // guildmaster (its title nobody's - and the Turning settles all the same)
    const m = await s.svc.registered('Mira', { renown: 3 });
    s.raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 2, ?, ?)').run(m.id, m.character, oa.gid, 'Mira', T0 - 30 * DAY);
    const dg = await s.guild('Doran', 'Daggers', 'DG', 1);
    s.hold(TULUNE, dg, 50, W - 20);
    s.raw.prepare('UPDATE town_seat_holds SET owed = 2500 WHERE key = ?').run(TULUNE.key);
    const ic = await s.guild('Cade', 'Iron Circle', 'IC');
    s.hold(YKALON, ic, 50, W - 20);
    s.raw.prepare('DELETE FROM guild_members WHERE guild_id = ?').run(ic.gid);
    s.watch(oa, WAYREST, W, 2000);
    s.watch(sh, ALCAIRE, W, 2000);
    s.setNow(AFTER(W));
    await s.list(oa);
    return { s, oa, sh };
  };
  const plain = await scenario(null);
  const plainStanding = [plain.s.held(WAYREST.key).standing, plain.s.held(ALCAIRE.key).standing];
  assert.equal(plain.s.count('town_seat_titles'), 0, 'no Season counted: none');
  assert.ok(plain.s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_legacy WHERE week = ?').get(W + 1).n > 0, 'the twin carries Legacy');
  // W the last week of Season 1: Season 0 W-11..W-8, Season 1 W-7..W
  const { s, oa, sh } = await scenario(W - 11);
  assert.deepEqual(s.raw.prepare('SELECT account, title, key, week FROM town_seat_titles ORDER BY title').all().map((r) => ({ ...r })), [
    { account: oa.gm.id, title: 'crowned', key: WAYREST.key, week: W }, { account: oa.gm.id, title: 'keeper', key: WAYREST.key, week: W },
  ]);
  // week W's Tide in Wayrest is a Royal Wedding - counted only with a Season (SEASON1 part two): +3 before the halving
  assert.equal(tideOf(W, 'wayrest'), 'wedding');
  assert.deepEqual([s.held(WAYREST.key).standing, s.held(ALCAIRE.key).standing], plainStanding.map((x) => seasonStanding(x + STANDING_CHANGES.wedding)));
  assert.deepEqual([s.held(TULUNE.key), plain.s.held(TULUNE.key)], [null, null], 'the Daggers\' Charter lapsed in both');
  assert.ok(s.held(YKALON.key) && s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W), 'a guild with no guildmaster: the week settled all the same');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_history WHERE key = ? AND kind = 'season-end'").get(TULUNE.key).n, 0, 'a lapsed Charter: no line');
  assert.notDeepEqual(plainStanding.map(seasonStanding), plainStanding, 'the reset moves them');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_legacy WHERE week = ?').get(W + 1).n, 0, 'Legacy is cleared');
  const ends = (key) => s.raw.prepare("SELECT data FROM town_seat_history WHERE key = ? AND kind = 'season-end'").all(key).map((r) => JSON.parse(r.data));
  assert.deepEqual(ends(WAYREST.key), [{ guild: { name: 'The Oath', tag: 'OA' }, season: 1, kept: true }]);
  assert.deepEqual(ends(ALCAIRE.key), [{ guild: { name: 'The Silver Hand', tag: 'SH' }, season: 1, kept: false }]);
  const st = (await s.call('/v1/seats/standings', { key: ALCAIRE.key }, sh.gm)).body;
  assert.deepEqual(st.season, { n: 2, start: W + 1, end: W + 9 });
  // the titles worn: a kept one with the Season it was won in, the Charter's with the Season now
  const wear = async (title) => {
    assert.equal((await s.call('/v1/account/title', { title }, oa.gm)).status, 200, title);
    const minted = (await s.call('/v1/auth/token', { character: oa.gm.character }, oa.gm)).body;
    const v = await verifyToken(minted.token, s.svc.identityPublic, { subtle, nowS: s.getNow() });
    assert.deepEqual([minted.title, minted.ts], [v.claims.t, v.claims.ts]);
    return [minted.title, minted.ts];
  };
  assert.deepEqual(await wear('crowned'), ['crowned', [WAYREST.key, 1]]);
  assert.deepEqual(await wear('keeper'), ['keeper', [WAYREST.key, 1]]);
  assert.deepEqual(await wear('protector'), ['protector', [WAYREST.key, 2]]);
  // a champion's title won in Season 0 (week W-9): its own row and its own Season, whatever else is newer
  s.raw.prepare("INSERT INTO town_seat_titles (account, title, key, week, at) VALUES (?, 'champion', ?, ?, ?)").run(oa.gm.id, WAYREST.key, W - 9, T0);
  assert.deepEqual(await wear('champion'), ['champion', [WAYREST.key, 0]]);
  assert.equal((await s.call('/v1/account/title', { title: 'keeper' }, sh.gm)).status, 403, 'a seat taken in the Season: no Keeper');
});

test('SEASON1 SEASON 0\'S END WIPES THE SEATS (18): its own week settled - the upkeep paid, Legacy carried nowhere - then nothing set up for the next (no claim though a guild passed the line, the Edict proclaimed for it void) and the Charters, influence, pledges, binds, Legacy, history, fealty and Pacts gone; the titles, the red lines and the weeks kept; no Season title for the beta (mutants: the wipe; each table; the claim; the Edict; the beta\'s titles)', async (t) => {
  const s = await stood(t, W - 3);
  const oa = await s.guild('Orla', 'The Oath', 'OA'), sh = await s.guild('Gamal', 'The Silver Hand', 'SH'), dg = await s.guild('Doran', 'Daggers', 'DG');
  s.hold(WAYREST, oa, 60, W - 3);
  s.hold(ALCAIRE, sh, 60, W - 3);
  s.watch(oa, WAYREST, W, 2000);
  s.watch(sh, ALCAIRE, W, 2000);
  s.raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W, dg.gid, TULUNE.region, TULUNE.key, 'x', T0);
  for (let i = 0; i < 4; i++) s.watch(dg, TULUNE, W, 2000, await s.svc.registered(`Dagger${i}`, { renown: 1 }));
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'festival', ?, 'x', 'proclaimed', ?)").run(WAYREST.key, W + 1, oa.gid, T0);
  s.raw.prepare("INSERT INTO guild_fealty (vassal, liege, state, offered_by, since_week, at) VALUES (?, ?, 'sworn', ?, ?, ?)").run(sh.gid, oa.gid, sh.gid, W - 2, T0);
  s.raw.prepare("INSERT INTO guild_pacts (a, b, state, offered_by, until_week, at) VALUES (?, ?, 'signed', ?, ?, ?)").run(...[dg.gid, oa.gid].sort(), dg.gid, W + 1, T0);
  s.raw.prepare("INSERT INTO town_seat_titles (account, title, key, week, at) VALUES (?, 'champion', ?, ?, ?)").run(oa.gm.id, WAYREST.key, W - 1, T0);
  s.raw.prepare('INSERT INTO town_seat_red (text, at) VALUES (?, ?)').run('A line.', T0);
  s.raw.prepare("INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, 'held', '{}', ?)").run(ALCAIRE.key, W - 1, T0);
  s.setNow(AFTER(W));
  await s.list(oa);
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W), 'its own week settled');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'seat-upkeep'").get().n, 2, 'its upkeep paid');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'seat-claim'").get().n, 0, 'no Charter claimed for the next');
  for (const table of ['town_seat_holds', 'town_seat_legacy', 'town_seat_pledges', 'town_seat_binds', 'town_seat_influence', 'town_seat_history', 'guild_fealty', 'guild_pacts', 'town_seat_rights', 'town_seat_battles']) {
    assert.equal(s.count(table), 0, table);
  }
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(WAYREST.key, W + 1).state, 'void');
  assert.deepEqual(s.raw.prepare('SELECT title FROM town_seat_titles').all().map((r) => r.title), ['champion'], 'the titles kept; the beta crowns no one');
  assert.equal(s.count('town_seat_red'), 1);
  assert.deepEqual([...SEASON_ZERO_WIPED], ['town_seat_holds', 'town_seat_legacy', 'town_seat_pledges', 'town_seat_binds', 'town_seat_influence',
    'town_seat_renown', 'town_seat_rights', 'town_seat_aftermath', 'town_seat_windows', 'town_seat_stockpile', 'town_seat_levies', 'town_seat_history',
    'guild_fealty', 'guild_pacts',
    // PIN MOVED (SEAT2b): and the works - a beta's walls fall with its Charters
    'town_seat_forts', 'town_seat_fort_held', 'town_seat_fortifier', 'town_seat_camps']);
  // Season 1 begins: the board says so
  const st = (await s.call('/v1/seats/standings', { key: ALCAIRE.key }, sh.gm)).body;
  assert.deepEqual([st.season, st.holder], [{ n: 1, start: W + 1, end: W + 9 }, null]);
});

test('SEASON1 THE ONCE-A-SEASON RULES OVER THE SEASON ITSELF: a Pact runs to its Season\'s end; a forfeit\'s Standing and the pair\'s Honours come again in the next Season\'s first week, where the 8-week stand-in would have spent them (mutants: the Pact\'s Season; the forfeit\'s floor; the Honours\' floor)', async (t) => {
  // a Pact signed in week W, Season 0 running W-2..W+1: to W+2
  const p = await stood(t, W - 2);
  const oa = await p.guild('Orla', 'The Oath', 'OA'), dg = await p.guild('Doran', 'Daggers', 'DG');
  await p.call('/v1/seats/pact', { character: oa.gm.character, tag: 'DG' }, oa.gm);
  assert.deepEqual((await p.call('/v1/seats/pact', { character: dg.gm.character, tag: 'OA' }, dg.gm)).body, { ok: true, signed: true, until: W + 2 });
  // two forfeits by the same challenger, in Season 1's last week (W+1) and Season 2's first (W+2)
  const run = async (zero) => {
    const s = await stood(t, zero);
    const sh = await s.guild('Gamal', 'The Silver Hand', 'SH'), eo = await s.guild('Horst', 'Ebon Oath', 'EO');
    s.hold(ALCAIRE, sh, 50, W - 20);
    const out = [];
    for (const week of [W + 1, W + 2]) {
      const start = Math.floor(seatWeekStartMs(week) / 1000) + 3 * DAY;
      s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
        VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(week, ALCAIRE.key, eo.gid, sh.gid, start, start + 1800, T0);
      // PIN MOVED (AUDIT SEATS-3): A3 - Honours go to the character on the battle's roster, so the Guildmaster signs it
      s.raw.prepare("INSERT INTO town_seat_rosters (week, key, account, char_id, guild_id, side, at) VALUES (?, ?, ?, ?, ?, 'defend', ?)").run(week, ALCAIRE.key, sh.gm.id, sh.gm.character, sh.gid, T0);
      const before = s.held(ALCAIRE.key).standing;
      const receipt = await mintSiegeReceipt({ s: sh.gm.id, sk: ALCAIRE.key, sw: week, sd: 'defend', r: 'forfeit', a: 0, h: 1 }, s.svc.gateKey, { subtle, nowS: s.getNow() });
      const r = (await s.call('/v1/seats/siege/claim', { receipt, character: sh.gm.character }, sh.gm)).body;
      out.push([r.result, s.held(ALCAIRE.key).standing - before, r.honours.marks]);
    }
    return out;
  };
  assert.deepEqual(await run(null), [['forfeit', 10, SIEGE_HONOURS.win.marks], ['forfeit', 0, 0]], 'no Season counted: within 8 weeks, spent');
  assert.deepEqual(await run(W - 10), [['forfeit', 10, SIEGE_HONOURS.win.marks], ['forfeit', 10, SIEGE_HONOURS.win.marks]], 'a new Season: again');
});
