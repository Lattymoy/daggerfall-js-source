// AUDIT KG II (2026-10-15, bible/01-Overview/audits/Audit-Kings-Gambit-II.md, lane E): THE SEASON BOARD'S RATING LINES NO
// TEST HELD - a pair's season cap (and the cap a kept game says it was held by, D11), a game kept and not counted out
// of the board's games and the Grandmaster's floor, a rating written only while both ratings stand as read (a claim
// racing another write retried on the ratings now), and a third player passing the kept #1 counted at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintGambitReceipt } from '../../../src/net/gambit/gambitReceipt.js';
import { ARENA_PAIR_SEASON_MAX, ARENA_PAIR_DAY_MAX, arenaSeasonOf } from '../../../src/net/arena/arenaLaw.js';
import { _resetGambitCache } from '../../../server-account/src/gambit.js';
import { standService } from '../../accountDb.mjs';

const { subtle } = globalThis.crypto;
const nowS = () => Math.floor(Date.now() / 1000);
let _game = 0;
const gameId = () => (0x9a000 + ++_game).toString(16).padStart(16, '0');
const receiptOf = (S, a, b, r, h = 'king', j = gameId()) => mintGambitReceipt({ j, f: [a.id, b.id], r, h }, S.gatePriv, { subtle, nowS: nowS() });
const claimOf = (S, who, receipt) => S.call('/v1/gambit/claim', { receipt }, who.secret);
/** A rated game written straight into the rows, `days` ago (outside the pair's day). */
const pastGame = (S, a, b, days) => S.env.DB._raw.prepare(`INSERT INTO gambit_games (game, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, played, at)
  VALUES (?, ?, ?, ?, 0, 'king', 1500, 1500, 1500, 1500, 1, ?, ?)`).run(gameId(), arenaSeasonOf(nowS()), a.id, b.id, nowS() - days * 86400, nowS());

test('AUDIT KG II E5 + D11 THE PAIR\'S SEASON: a pair\'s game past the season\'s cap is kept and not counted, and says the season held it; a kept game is no game on the board (mutants: the season cap; rated = 1 on the board; the cap word)', async () => {
  _resetGambitCache();
  const S = await standService();
  const A = await S.registered('Kestrel'), B = await S.registered('Lark');
  for (let k = 0; k < ARENA_PAIR_SEASON_MAX; k++) pastGame(S, A, B, 3);
  const kept = await claimOf(S, A, await receiptOf(S, A, B, 0));
  assert.equal(kept.status, 200, JSON.stringify(kept.body));
  assert.deepEqual([kept.body.recorded, kept.body.rated, kept.body.delta, kept.body.cap], [true, false, 0, 'season']);
  _resetGambitCache();
  const board = (await S.call('/v1/gambit/board', {}, A.secret)).body;
  assert.equal(board.rows.find((r) => r.name === 'Kestrel').games, ARENA_PAIR_SEASON_MAX, 'the kept game counts nothing');
  assert.equal(board.me.games, ARENA_PAIR_SEASON_MAX, 'nor in the player\'s own standing');
  const C = await S.registered('Moth');
  for (let k = 0; k < ARENA_PAIR_DAY_MAX; k++) await claimOf(S, A, await receiptOf(S, A, C, 0));
  const day = await claimOf(S, A, await receiptOf(S, A, C, 0));
  assert.deepEqual([day.body.rated, day.body.cap], [false, 'day'], 'the day\'s cap says so');
});

test('AUDIT KG II E5 A CLAIM RACING ANOTHER WRITE: its rating written only while both stand as read - retried on the ratings now (mutants: the WHERE)', async () => {
  _resetGambitCache();
  const S = await standService();
  const A = await S.registered('Nell'), B = await S.registered('Orrin'), C = await S.registered('Pike');
  const db = S.env.DB, prepare = db.prepare.bind(db);
  let raced = false;
  const j = gameId(), racing = await receiptOf(S, A, C, 0, 'king', j);
  db.prepare = (sql) => {
    if (!raced && /^INSERT OR IGNORE INTO gambit_games/.test(sql)) {
      raced = true;
      // another claim lands between this one's read and its write: A's rating moves
      db._raw.prepare(`INSERT INTO gambit_games (game, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, played, at) VALUES (?, ?, ?, ?, 0, 'king', 1500, 1500, 1516, 1484, 1, ?, ?)`)
        .run(gameId(), arenaSeasonOf(nowS()), A.id, B.id, nowS() - 3 * 86400, nowS());
    }
    return prepare(sql);
  };
  const r = await claimOf(S, A, racing);
  db.prepare = prepare;
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(raced, true);
  const row = db._raw.prepare('SELECT ra0, ra1 FROM gambit_games WHERE game = ?').get(j);
  assert.equal(row.ra0, 1516, 'written on the rating the other claim left');
});

test('AUDIT KG II E5 A THIRD PLAYER PASSES THE KEPT #1: the Grandmaster counted again at that claim, never only by the clock (mutants: topMayMove)', async () => {
  _resetGambitCache();
  const S = await standService();
  const A = await S.registered('Quill'), Z = await S.registered('Rook');
  const foes = [];
  for (const n of ['Sable', 'Thorn', 'Umber', 'Vale', 'Wick']) foes.push(await S.registered(n));
  for (const f of foes) for (let k = 0; k < 2; k++) await claimOf(S, A, await receiptOf(S, A, f, 0));
  const kept = () => S.env.DB._raw.prepare('SELECT player FROM gambit_champions').get()?.player ?? null;
  assert.equal(kept(), A.id, 'the first #1 kept');
  // Z never plays the #1: its rating passes A's on other games alone (the recount's own case - a game with the #1 in it
  // moves the top whatever the ratings)
  for (const f of foes) for (let k = 0; k < 4; k++) await claimOf(S, Z, await receiptOf(S, Z, f, 0));
  assert.equal(kept(), Z.id, 'passed: counted at the claim');
});
