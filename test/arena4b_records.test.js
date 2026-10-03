// ARENA4b (2026-10-03, Arena.md 5: "Records - your bouts: wins, losses, yields, falls, best streak, purses; the last
// twenty bouts"): THE BOARD'S RECORDS FOR THE RECORDS PAGE - `me.recent` and `me.record` on /v1/arena/board
// (server-account/src/arena.js arenaRecordsOf), counted from the account's own rows over node:sqlite with every migration
// (test/accountDb.mjs). Another stream renders these, so the shape is pinned key for key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { arenaSeasonOf, ARENA_TEAM_POINTS } from '../src/net/arenaLaw.js';
import { ARENA_RECENT_MAX } from '../server-account/src/arena.js';

const PVE_KEYS = ['at', 'kind', 'tier', 'step', 'won', 'how', 'points'];
const PVP_KEYS = ['at', 'kind', 'won', 'how', 'rating', 'rated', 'opponent', 'points'];

/** Aldric's bouts, laid as the claims write them: the ladder's and the players', a minute apart. */
async function stood() {
  const S = await standService();
  const raw = S.env.DB._raw;
  const a = await S.registered('Aldric');
  const b = await S.registered('Bran');
  const t = (n) => T0 + n * 60;
  const pve = raw.prepare('INSERT INTO arena_pve (bout, player, season, tier, step, won, how, banner, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const pvp = raw.prepare(`INSERT INTO arena_pvp (bout, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, banner_a, banner_b, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const s = arenaSeasonOf(T0);
  pve.run('0000000000000001', a.id, s, 0, 0, 1, 'fall', 'red', t(1));
  pve.run('0000000000000002', a.id, s, 0, 1, 1, 'yield', 'red', t(2));
  pvp.run('0000000000000003', s, a.id, b.id, 0, 'ringout', 1000, 1000, 1016, 984, 1, 'red', null, t(3));
  pvp.run('0000000000000004', s, b.id, a.id, 2, 'judges', 984, 1016, 984, 1016, 1, null, 'red', t(4));
  pve.run('0000000000000005', a.id, s, 0, 2, 0, 'fall', 'red', t(5));
  pvp.run('0000000000000006', s, a.id, b.id, 0, 'fall', 1016, 984, 1016, 984, 0, 'red', null, t(6));
  pve.run('0000000000000007', a.id, s, 0, 3, 1, 'fall', 'red', t(7));
  pvp.run('0000000000000008', s, null, a.id, 0, 'forfeit', 1100, 1016, 1116, 1000, 1, null, 'red', t(8));   // a fighter whose account is gone
  return { S, raw, a, b, t, pve, s };
}

test('ARENA4b the Records page\'s bouts: newest first, each in EXACTLY its shape - a ladder bout\'s tier and step, a players\' won/lost/draw (null), how, both ratings, rated, the opponent by name and badge (none for an account gone), and the team law\'s points (mutants: oldest first; a draw read as a loss; a loss scored; an unrated win scored; a bout with no banner scored; the opponent\'s id handed out)', async (t) => {
  t.mock.method(Date, 'now', () => (T0 + 3600) * 1000);
  const { S, a, t: at } = await stood();
  const r = await S.call('/v1/arena/board', {}, a.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const recent = r.body.me.recent;
  assert.deepEqual(recent.map((x) => x.at), [8, 7, 6, 5, 4, 3, 2, 1].map(at), 'newest first');
  for (const x of recent) {
    const keys = x.kind === 'pve' ? PVE_KEYS : PVP_KEYS.filter((k) => k !== 'opponent' || x.opponent);
    assert.deepEqual(Object.keys(x), keys, `${x.kind} at ${x.at}: the shape`);
  }
  const [b8, b7, b6, b5, b4, b3, b2, b1] = recent;
  assert.deepEqual(b1, { at: at(1), kind: 'pve', tier: 0, step: 0, won: true, how: 'fall', points: ARENA_TEAM_POINTS.bout });
  assert.equal(b2.points, 1);
  assert.deepEqual(b5, { at: at(5), kind: 'pve', tier: 0, step: 2, won: false, how: 'fall', points: 0 }, 'a loss scores none');
  assert.equal(b7.points, ARENA_TEAM_POINTS.champion, 'a tier\'s champion under a banner');
  assert.deepEqual({ ...b3, opponent: b3.opponent.name }, { at: at(3), kind: 'pvp', won: true, how: 'ringout', rating: { before: 1000, after: 1016 }, rated: true, opponent: 'Bran', points: ARENA_TEAM_POINTS.pvp });
  assert.deepEqual(Object.keys(b3.opponent), ['name', 'title', 'glyphs'], 'a name and a badge - never an id');
  assert.ok(Array.isArray(b3.opponent.glyphs));
  assert.deepEqual([b4.won, b4.rating, b4.points, b4.opponent.name], [null, { before: 1016, after: 1016 }, 0, 'Bran'], 'a draw is null; my side\'s ratings');
  assert.deepEqual([b6.won, b6.rated, b6.points], [true, false, 0], 'a win kept unrated scores none');
  assert.deepEqual([b8.won, 'opponent' in b8, b8.rating], [false, false, { before: 1016, after: 1000 }], 'an account gone: no opponent');
});

test('ARENA4b the Records page\'s tallies: every bout fought, the ladder\'s and the players\' (unrated too), and the best run of wins over both in time order - a loss or a draw ends one (mutants: a draw counted a win; the run over one table alone; the run unordered)', async (t) => {
  t.mock.method(Date, 'now', () => (T0 + 3600) * 1000);
  const { S, a, b } = await stood();
  const me = (await S.call('/v1/arena/board', {}, a.secret)).body.me;
  assert.deepEqual(me.record, { pveWins: 3, pveLosses: 1, pvpWins: 2, pvpLosses: 1, pvpDraws: 1, best: 3 }, 'W W W (pve, pve, pvp) then a draw: three');
  const bran = (await S.call('/v1/arena/board', {}, b.secret)).body.me;
  assert.deepEqual(bran.record, { pveWins: 0, pveLosses: 0, pvpWins: 0, pvpLosses: 2, pvpDraws: 1, best: 0 }, 'Bran\'s side of the same rows');
  assert.deepEqual(bran.recent.map((x) => x.won), [false, null, false]);
  const g = await S.guest();
  const gm = (await S.call('/v1/arena/board', {}, g.secret)).body.me;
  assert.deepEqual([gm.recent, gm.record], [[], { pveWins: 0, pveLosses: 0, pvpWins: 0, pvpLosses: 0, pvpDraws: 0, best: 0 }], 'nothing kept, nothing shown');
});

test('ARENA4b at most twenty: the newest twenty of many, the tallies over all of them, the run across the cut (mutants: the cap dropped; the tallies cut to the twenty)', async (t) => {
  t.mock.method(Date, 'now', () => (T0 + 86400) * 1000);
  const { S, raw, a, s } = await stood();
  const pve = raw.prepare('INSERT INTO arena_pve (bout, player, season, tier, step, won, how, banner, at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)');
  for (let i = 0; i < 25; i++) pve.run(`f${String(i).padStart(15, '0')}`, a.id, s, 1 + Math.floor(i / 4) % 8, i % 4, 0, 'yield', T0 + 3600 + i);
  for (let i = 0; i < 4; i++) pve.run(`e${String(i).padStart(15, '0')}`, a.id, s, 9, i, 1, 'fall', T0 + 7200 + i);
  const me = (await S.call('/v1/arena/board', {}, a.secret)).body.me;
  assert.equal(ARENA_RECENT_MAX, 20);
  assert.equal(me.recent.length, 20);
  assert.deepEqual(me.recent.slice(0, 4).map((x) => [x.tier, x.step]), [[9, 3], [9, 2], [9, 1], [9, 0]], 'the newest first');
  assert.deepEqual(me.recent.slice(0, 4).map((x) => x.points), [0, 0, 0, 0], 'won under no banner: no points, the Grand Champion\'s ten included');
  assert.deepEqual([me.record.pveWins, me.record.pveLosses], [7, 26], 'every bout tallied');
  assert.equal(me.record.best, 4, 'the last four wins in a row');
});
