// AUDIT CARDS-6 (2026-10-09, bible/01-Overview/Audit-Cards-6.md) lane D: ILIAC HAND'S SEASON BOARD, ITS TITLE AND THE
// DEVICE'S CARRIER, and two of lane E's about the vouch. Driven on the real Worker over SQLite (server-account/src/
// iliac.js, arena.js, boardNames.js, index.js), the real carrier (net/iliacClaims.js), the real realm session and act
// (systems/realmSaves.js), and the host's own lines sliced out of scenes/world.js and run over them: a rating change lost
// when a claim lands after one begun a second later, on both boards (D1); each board badging its rows with its own
// honours alone (D3); the pair's day read on the claims' clock (D5); the board's season end (D6); a short deck's card
// never said (D7); the refusals' statuses and borrowed sentences (D8); the carrier on the device's clock (D9); a deleted
// champion's empty title (D10); an unregistered foe told to register (D11); every rated claim counting the whole season,
// and the pair's counts walking it (D12); the vouch throwing the player to the title (E6) and its words (E14); and only
// the first carrier hearing the rating (E18). Each pin failed on the build before it. tools/mutants/auditcards6_d.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

import worker from '../server-account/src/index.js';
import { standService, sessionStorageOf } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { mintIliacReceipt } from '../src/net/iliacReceipt.js';
import { mintArenaReceipt } from '../src/net/arenaReceipt.js';
import { STARTER_DECK } from '../src/net/iliacCards.js';
import { ILIAC_CARD_TEMPLATE } from '../src/net/cardWorthLaw.js';
import { arenaSeasonOf, arenaSeasonEndsS, ARENA_PAIR_DAY_MAX } from '../src/net/arenaLaw.js';
import { _resetIliacCache, iliacRatingOf, iliacChampionClock, ILIAC_CHAMPION_CLOCK_S } from '../server-account/src/iliac.js';
import { _resetArenaCache, arenaRatingOf } from '../server-account/src/arena.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { accountIliac, accountRefusalText, iliacRefusalText, ILIAC_REFUSALS, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { createIliacClaims, iliacClaimVerdict } from '../src/net/iliacClaims.js';
import { realmGoldAct, createRealmSession } from '../src/systems/realmSaves.js';

const { subtle } = globalThis.crypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000, DAY = 86400;
let _game = 0;
const gameId = () => (0x6000 + ++_game).toString(16).padStart(16, '0');
const iliacReceipt = (S, a, b, r, at, j = gameId()) => mintIliacReceipt({ j, f: [a.id, b.id], r, h: r === 2 ? 'draw' : 'holdings' }, S.gatePriv, { subtle, nowS: at });
const arenaReceipt = (S, a, b, r, at) => mintArenaReceipt({ a: 'p', j: gameId(), f: [a.id, b.id], r, h: 'fall' }, S.gatePriv, { subtle, nowS: at });
const cardsOf = (ids) => [...new Set(ids)].map((id) => ({ templateIndex: ILIAC_CARD_TEMPLATE, group: 'UselessItems2', card: id, stackCount: ids.filter((x) => x === id).length }));
/** The service's clock, pinned: the Worker reads Date.now once a request. */
function pinClock(t, at) {
  const c = { now: at };
  t.mock.method(Date, 'now', () => c.now * 1000);
  return c;
}
const post = (path, body, secret) => new Request(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify(body) });

/**
 * TWO CLAIMS OF ONE ACCOUNT, THE EARLIER-BEGUN LANDING SECOND: the slow one's request begins in second T, every read of
 * its database held until the fast one - begun in T+1 - has answered. Answers both bodies.
 */
async function raceOneSecond(S, clock, path, slow, fast) {
  let release;
  const gate = new Promise((r) => { release = r; });
  const base = S.env.DB;
  const held = { _raw: base._raw, batch: async (l) => { await gate; return base.batch(l); }, prepare(sql) {
    const st = base.prepare(sql);
    const wait = (fn) => async () => { await gate; return fn(); };
    const api = { bind(...a) { st.bind(...a); return api; }, first: wait(() => st.first()), all: wait(() => st.all()), run: wait(() => st.run()), _result: () => st._result() };
    return api;
  } };
  clock.now = T;
  const late = worker.fetch(post(path, slow.body, slow.secret), { ...S.env, DB: held });
  clock.now = T + 1;
  const first = await worker.fetch(post(path, fast.body, fast.secret), S.env);
  release();
  const second = await late;
  return { first: { status: first.status, body: await first.json() }, second: { status: second.status, body: await second.json() } };
}

// ═══ D1: THE RATING NOW IS THE LAST ROW WRITTEN ══════════════════════════════════════════════════════════════════════

test('AUDIT CARDS-6 D1: a claim begun in second T that lands after one of the same account begun in T+1 keeps its change - the rating read, the board\'s and the next claim\'s guard all the last row WRITTEN (mutants: the rating, the guard and the board by the claim\'s second again)', async (t) => {
  const clock = pinClock(t, T);
  _resetIliacCache();
  const S = await standService();
  const A = await S.registered('Avel'), B = await S.registered('Brom'), C = await S.registered('Cyra');
  const win = await iliacReceipt(S, A, B, 0, T - 5);   // A beats B
  const loss = await iliacReceipt(S, C, A, 0, T - 4);   // C (seat 0) beats A
  const r = await raceOneSecond(S, clock, '/v1/iliac/claim', { body: { receipt: loss }, secret: C.secret }, { body: { receipt: win }, secret: B.secret });
  assert.equal(r.first.status, 200); assert.equal(r.second.status, 200, JSON.stringify(r.second.body));
  const rows = S.env.DB._raw.prepare('SELECT a, rb0, rb1, at FROM iliac_games ORDER BY rowid').all();
  assert.equal(rows.length, 2);
  assert.ok(rows[1].at < rows[0].at, 'the loss is written second, at the earlier second - the race');
  const lossRow = rows[1];
  assert.deepEqual([lossRow.rb0, lossRow.rb1], [1016, 999], 'the loss moved A from the win\'s rating');
  clock.now = T + 2;
  const season = arenaSeasonOf(T);
  assert.equal((await iliacRatingOf({ db: S.env.DB }, A.id, season)).rating, 999, 'A\'s rating is the loss\'s, not the win\'s again');
  const board = (await S.call('/v1/iliac/board', {}, A.secret)).body;
  assert.equal(board.rows.find((x) => x.name === 'Avel').rating, 999, 'and the board\'s');
  // the next claim of A's: its guard asks the same row the read does - recorded, from 999 (by the second, busy for good)
  const next = await S.call('/v1/iliac/claim', { receipt: await iliacReceipt(S, A, B, 0, T + 2) }, A.secret);
  assert.equal(next.status, 200, JSON.stringify(next.body));
  assert.deepEqual([next.body.recorded, next.body.rating - next.body.delta], [true, 999]);
});

test('AUDIT CARDS-6 D1 (found on the arena too, arena.js claimPlayers): the same race keeps a bout\'s change - the rating, the board and the next claim\'s guard the last row written (mutants: each by the claim\'s second again)', async (t) => {
  const clock = pinClock(t, T);
  _resetArenaCache();
  const S = await standService();
  const A = await S.registered('Avel'), B = await S.registered('Brom'), C = await S.registered('Cyra');
  const win = await arenaReceipt(S, A, B, 0, T - 5);
  const loss = await arenaReceipt(S, C, A, 0, T - 4);
  const r = await raceOneSecond(S, clock, '/v1/arena/claim', { body: { receipt: loss }, secret: C.secret }, { body: { receipt: win }, secret: B.secret });
  assert.equal(r.first.status, 200); assert.equal(r.second.status, 200, JSON.stringify(r.second.body));
  const rows = S.env.DB._raw.prepare('SELECT rb0, rb1, at FROM arena_pvp ORDER BY rowid').all();
  assert.equal(rows.length, 2);
  assert.ok(rows[1].at < rows[0].at, 'the race');
  clock.now = T + 2;
  assert.equal((await arenaRatingOf({ db: S.env.DB }, A.id, arenaSeasonOf(T))).rating, rows[1].rb1, 'the loss\'s rating');
  const board = (await S.call('/v1/arena/board', {}, A.secret)).body;
  assert.equal(board.pvp.rows.find((x) => x.name === 'Avel').rating, rows[1].rb1, 'and the board\'s');
  const next = await S.call('/v1/arena/claim', { receipt: await arenaReceipt(S, A, B, 0, T + 2) }, A.secret);
  assert.equal(next.status, 200, JSON.stringify(next.body));
  assert.deepEqual([next.body.recorded, next.body.rating - next.body.delta], [true, rows[1].rb1]);
});

// ═══ D3 AND D6: THE BOARDS' BADGES, THE SEASON'S END ═════════════════════════════════════════════════════════════════

test('AUDIT CARDS-6 D3/D6: a champion of one board wears its title and its laurel on the other\'s rows, as the token does; the Iliac board\'s season ends when the season ends (mutants: either board\'s other honours unread; the end handed the clock)', async (t) => {
  pinClock(t, T);
  _resetIliacCache(); _resetArenaCache();
  const S = await standService();
  const raw = S.env.DB._raw;
  const season = arenaSeasonOf(T);
  const Z = await S.registered('Zed'), X = await S.registered('Xox');
  const foes = [];
  for (let i = 0; i < 5; i++) foes.push(await S.registered(`Foe${i}q`));
  for (let i = 0; i < 10; i++) assert.equal((await S.call('/v1/iliac/claim', { receipt: await iliacReceipt(S, Z, foes[i % 5], 0, T) }, Z.secret)).status, 200);
  // Z the arena's #1 too: ten rated bouts against five foes, on arena_pvp's own columns
  for (let i = 0; i < 10; i++) {
    raw.prepare(`INSERT INTO arena_pvp (bout, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, at) VALUES (?, ?, ?, ?, 0, 'fall', 1000, 1000, ?, 1000, 1, ?)`)
      .run(gameId(), season, Z.id, foes[i % 5].id, 1100 + i, T + i);
  }
  raw.prepare('DELETE FROM arena_champions').run(); _resetArenaCache();
  const rowOf = async (path) => {
    const b = (await S.call(path, {}, X.secret)).body;
    return (path === '/v1/arena/board' ? b.pvp.rows : b.rows).find((r) => r.name === 'Zed');
  };
  assert.equal((await S.call('/v1/account/title', { title: 'iliacchampion' }, Z.secret)).status, 200);
  assert.deepEqual(await rowOf('/v1/arena/board').then((r) => [r.title, r.glyphs.includes('laurel')]), ['iliacchampion', true], 'the Iliac Champion\'s title on the arena\'s board');
  assert.equal((await S.call('/v1/account/title', { title: 'arenachampion' }, Z.secret)).status, 200);
  assert.deepEqual(await rowOf('/v1/iliac/board').then((r) => [r.title, r.glyphs.includes('laurel')]), ['arenachampion', true], 'the arena\'s #1 on Iliac Hand\'s, title and laurel');
  const ib = (await S.call('/v1/iliac/board', {}, X.secret)).body;
  assert.deepEqual(ib.season, { n: season, day: ib.season.day, ends: arenaSeasonEndsS(season) }, 'the season\'s own end');
});

// ═══ D5: A PAIR'S DAY IS THE GAMES' ══════════════════════════════════════════════════════════════════════════════════

test('AUDIT CARDS-6 D5: a pair\'s day is counted on the games\' own seconds - receipts held and carried five a day count five, carried last-first count five, and games held two days count no day they were not played (mutants: the claim\'s second; the day after alone; the claim\'s second stored)', async (t) => {
  const clock = pinClock(t, T);
  _resetIliacCache();
  const S = await standService();
  const rated = async (who, receipt) => { const r = await S.call('/v1/iliac/claim', { receipt }, who.secret); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.rated; };
  // ten games in one hour, the receipts held: five carried that day, five the next
  const A = await S.registered('Avel'), B = await S.registered('Brom');
  const held = [];
  for (let i = 0; i < 2 * ARENA_PAIR_DAY_MAX; i++) held.push(await iliacReceipt(S, A, B, 0, T + i * 300));
  clock.now = T + 3600;
  const day1 = [];
  for (const r of held.slice(0, ARENA_PAIR_DAY_MAX)) day1.push(await rated(A, r));
  clock.now = T + DAY + 3601;
  const day2 = [];
  for (const r of held.slice(ARENA_PAIR_DAY_MAX)) day2.push(await rated(A, r));
  assert.deepEqual([day1, day2], [Array(ARENA_PAIR_DAY_MAX).fill(true), Array(ARENA_PAIR_DAY_MAX).fill(false)], 'one hour\'s ten: five count');
  // ten games in one hour carried last first: a day either side of each
  clock.now = T;
  const C = await S.registered('Cyra'), D = await S.registered('Dax');
  const hour = [];
  for (let i = 0; i < 2 * ARENA_PAIR_DAY_MAX; i++) hour.push(await iliacReceipt(S, C, D, 0, T + i * 300));
  clock.now = T + 3600;
  const lastFirst = [];
  for (const r of [...hour].reverse()) lastFirst.push(await rated(C, r));
  assert.equal(lastFirst.filter(Boolean).length, ARENA_PAIR_DAY_MAX, 'carried last first, five count');
  // five games played on day 0, carried on day 2; a game played on day 2 is that day's first
  clock.now = T;
  const E = await S.registered('Eld'), F = await S.registered('Fyn');
  const old = [];
  for (let i = 0; i < ARENA_PAIR_DAY_MAX; i++) old.push(await iliacReceipt(S, E, F, 0, T + i * 60));
  clock.now = T + 2 * DAY;
  for (const r of old) assert.equal(await rated(E, r), true);
  assert.equal(await rated(E, await iliacReceipt(S, E, F, 0, T + 2 * DAY)), true, 'day 2\'s first game counts - day 0\'s five were played on day 0');
});

// ═══ D7 AND D8: THE DECK ORDER'S REFUSALS ════════════════════════════════════════════════════════════════════════════

test('AUDIT CARDS-6 D7/D8: a short deck\'s card reaches the player - answered by the route, carried by the door, said by name; the service without its key is 503, a guest\'s ranked seat 403; Iliac Hand\'s refusals in its own words (mutants: the route\'s card; the door\'s; the name; each status; each sentence)', async () => {
  const S = await standService({});
  const A = await S.registered('Ansel');
  const R = await seatRealm(S.env, A.secret, 'Ansel', { name: 'Ansel', level: 3, goldPieces: 100, items: cardsOf(STARTER_DECK) });
  const lich = [...STARTER_DECK.slice(1), 'lich'];
  const route = await S.call('/v1/cards/deck', { character: R.id, realm: R.at(), deck: lich }, A.secret);
  assert.deepEqual([route.status, route.body], [400, { error: 'deck-short', card: 'lich' }]);
  const door = accountIliac({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, A) });
  const r = await door.deck({ character: R.id, realm: R.at(), deck: lich });
  assert.deepEqual([r.ok, r.error, r.card], [false, 'deck-short', 'lich'], 'the door carries the card');
  assert.equal(iliacRefusalText(r.error, r.card), 'Your realm character does not hold every card of that deck (Lich).');
  assert.equal(iliacRefusalText('deck-short'), REFUSALS['deck-short'], 'no card named, none said');
  // the statuses
  const G = await S.guest();
  const guest = await S.call('/v1/cards/deck', { character: 'char-g', deck: STARTER_DECK }, G.secret);
  assert.deepEqual([guest.status, guest.body.error], [403, 'ranked-needs-account']);
  _resetKeyForTests();
  const closed = await worker.fetch(post('/v1/cards/deck', { character: R.id, realm: R.at(), deck: STARTER_DECK }, A.secret), { ...S.env, IDENTITY_PRIVATE_KEY: undefined });
  _resetKeyForTests();
  assert.deepEqual([closed.status, (await closed.json()).error], [503, 'cards-closed']);
  // the sentences: Iliac Hand's own, never a gold table's, a backup's or a gate's
  for (const w of ['cards-realm', 'cards-closed', 'no-data', 'receipt', 'not-yours']) {
    assert.notEqual(iliacRefusalText(w), accountRefusalText(w), `${w}: its own sentence`);
    assert.doesNotMatch(iliacRefusalText(w), /gold|stake|backup|gate/i, w);
  }
  assert.equal(iliacRefusalText('cards-closed'), 'The realm is not vouching for decks right now. Try again later.');
  assert.equal(iliacRefusalText('ranked-needs-account'), 'Ranked games need a registered account.');
  assert.equal(iliacRefusalText('offline'), 'The realm is not answering - try again.');
  assert.equal(iliacRefusalText('lease'), accountRefusalText('lease'), 'a word not Iliac Hand\'s own is REFUSALS\'');
  assert.ok(Object.isFrozen(ILIAC_REFUSALS));
});

// ═══ D9: THE CARRIER ON THE RELAY'S CLOCK ════════════════════════════════════════════════════════════════════════════

/** The source text of the expression that begins at `from` in `src` (acorn's own end - the first of a list's). */
const exprAt = (src, from) => {
  let node = acorn.parseExpressionAt(src, from, { ecmaVersion: 'latest', sourceType: 'module' });
  if (node.type === 'SequenceExpression') node = node.expressions[0];
  return src.slice(node.start, node.end);
};

test('AUDIT CARDS-6 D9 (E17): the host\'s carrier reads a receipt\'s life on the relay\'s clock - a device eight days fast keeps and carries a receipt the relay stamped today (mutant: the relay\'s clock unpassed)', async (t) => {
  const W = read('src/scenes/world.js');
  const at = W.indexOf('? createIliacClaims({');
  assert.ok(at > 0);
  const ARGS = exprAt(W, W.indexOf('{', at));
  const make = new Function('iliacDoor', '_spoilsStore', 'townTalk', `let _sharedClockHeard = false, _sharedOffsetMs = 0;
    return { args: (${ARGS}), hear: (o) => { _sharedClockHeard = true; _sharedOffsetMs = o; } };`);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const relayS = T;
  const receipt = await mintIliacReceipt({ j: gameId(), f: ['acct-me', 'acct-you'], r: 0, h: 'holdings' }, kp.privateKey, { subtle, nowS: relayS });
  t.mock.method(Date, 'now', () => (relayS + 8 * DAY) * 1000);   // the device eight days fast
  const asked = [], said = [];
  const store = new Map();
  const host = make({ claim: async (r) => { asked.push(r); return { ok: true, data: { recorded: true, rated: true, rating: 1016, delta: 16 } }; }, me: () => 'acct-me' },
    { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, { say: (line) => said.push(line) });
  host.hear(-8 * DAY * 1000);   // the relay's welcome: this machine is eight days ahead
  const c = createIliacClaims(host.args);
  assert.equal(c.add(receipt), true, 'kept - its life the relay\'s');
  await c.flush();
  assert.deepEqual(asked, [receipt], 'and carried');
  assert.match(said[0], /your rating 1016 \(\+16\)/);
});

// ═══ D10: A DELETED CHAMPION'S TITLE ═════════════════════════════════════════════════════════════════════════════════

test('AUDIT CARDS-6 D10: the champion\'s account deleted, the minute clock counts the kept word of nobody again - the next #1 wears the title within a clock (mutant: a kept word of nobody stamped)', async (t) => {
  const clock = pinClock(t, T);
  _resetIliacCache();
  const S = await standService();
  const raw = S.env.DB._raw;
  const Z = await S.registered('Zed'), Y = await S.registered('Yew');
  const foes = [];
  for (let i = 0; i < 6; i++) foes.push(await S.registered(`Foe${i}q`));
  for (let i = 0; i < 10; i++) await S.call('/v1/iliac/claim', { receipt: await iliacReceipt(S, Z, foes[i % 5], 0, T) }, Z.secret);
  for (let i = 0; i < 10; i++) await S.call('/v1/iliac/claim', { receipt: await iliacReceipt(S, Y, foes[1 + (i % 5)], i < 9 ? 0 : 1, T) }, Y.secret);
  const kept = () => raw.prepare('SELECT player, at FROM iliac_champions').get();
  assert.equal(kept().player, Z.id);
  // the clock counts once after the last game: the kept word now newer than every game
  clock.now = T + ILIAC_CHAMPION_CLOCK_S + 60;
  assert.equal(await iliacChampionClock({ db: S.env.DB, nowS: clock.now }), 1);
  assert.ok(kept().at > T);
  raw.prepare('DELETE FROM players WHERE id = ?').run(Z.id);
  assert.equal(kept().player, null, 'the kept word goes with the account');
  clock.now += ILIAC_CHAMPION_CLOCK_S + 60;
  assert.equal(await iliacChampionClock({ db: S.env.DB, nowS: clock.now }), 1, 'no game since, and counted again - not stamped');
  assert.equal(kept().player, Y.id);
  _resetIliacCache();
  assert.equal((await S.call('/v1/account/title', { title: 'iliacchampion' }, Y.secret)).status, 200, 'the next #1 wears it');
  clock.now += ILIAC_CHAMPION_CLOCK_S + 60;
  assert.equal(await iliacChampionClock({ db: S.env.DB, nowS: clock.now }), 0, 'a kept word of somebody, no game since: stamped');
});

// ═══ D11: AN UNREGISTERED FOE ════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT CARDS-6 D11: a game whose other seat is no registered account is its own word, and the carrier lets it go unsaid - `guest` is the claimant\'s own, kept (mutant: the foe\'s word `guest` again)', async () => {
  _resetIliacCache();
  const S = await standService();
  const A = await S.registered('Pell'), Q = await S.registered('Quin');
  const receipt = await iliacReceipt(S, A, Q, 0, Math.floor(Date.now() / 1000));
  S.env.DB._raw.prepare('DELETE FROM players WHERE id = ?').run(Q.id);
  const said = [];
  const c = createIliacClaims({ claim: async (r) => { const x = await S.call('/v1/iliac/claim', { receipt: r }, A.secret); return x.status === 200 ? { ok: true, data: x.body } : { ok: false, error: x.body?.error }; },
    me: () => A.id, onGuest: () => said.push('guest'), onCounted: () => said.push('counted') });
  c.add(receipt);
  await c.flush();
  assert.deepEqual(c.kept(), [], 'let go');
  assert.deepEqual(said, [], 'and nobody told to register');
  assert.equal(iliacClaimVerdict({ ok: true, data: { recorded: false, why: 'foe-unregistered' } }), 'done');
  assert.equal(iliacClaimVerdict({ ok: true, data: { recorded: false, why: 'guest' } }), 'keep');
});

// ═══ D12: A CLAIM COUNTS THE TOP ONLY WHEN IT MAY MOVE IT ════════════════════════════════════════════════════════════

const BOARD_MARK = 'ROW_NUMBER() OVER (PARTITION BY p';
function counting(S) {
  const base = S.env.DB;
  const sqls = [];
  S.env.DB = { _raw: base._raw, prepare: (sql) => { sqls.push(sql); return base.prepare(sql); }, batch: (l) => base.batch(l) };
  return { sqls, boards: () => sqls.filter((q) => q.includes(BOARD_MARK)).length, reset: () => { sqls.length = 0; } };
}

test('AUDIT CARDS-6 D12: a rated game below the kept #1 counts no board, one that reaches its rating or has it a side counts it; the pair\'s two counts ask the pair\'s own rows (mutants: never counted; always counted; the pair\'s index unwritten; the pair asked as one OR)', async (t) => {
  pinClock(t, T);
  _resetIliacCache();
  const S = await standService();
  const raw = S.env.DB._raw;
  const season = arenaSeasonOf(T);
  const X = await S.registered('Xan'), P = await S.registered('Pell'), Q = await S.registered('Quin'), R = await S.registered('Rook'), V = await S.registered('Vale');
  const foes = [];
  for (let i = 0; i < 5; i++) foes.push(await S.registered(`Foe${i}q`));
  // the season as rows: X the #1 at 1020 over ten games against five foes; P at 1010 over one
  raw.exec('PRAGMA foreign_keys = OFF');
  const ins = raw.prepare(`INSERT INTO iliac_games (game, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, played, at) VALUES (?, ?, ?, ?, 0, 'holdings', 1000, 1000, ?, ?, 1, ?, ?)`);
  for (let i = 0; i < 10; i++) ins.run(gameId(), season, X.id, foes[i % 5].id, 1002 + 2 * i, 990, T - 100 + i, T - 100 + i);
  ins.run(gameId(), season, P.id, foes[0].id, 1010, 985, T - 50, T - 50);
  raw.exec('PRAGMA foreign_keys = ON');
  assert.equal(await iliacChampionClock({ db: S.env.DB, nowS: T }), 1);
  const kept = () => raw.prepare('SELECT player, at FROM iliac_champions WHERE season = ?').get(season);
  assert.equal(kept().player, X.id, 'X the kept #1');
  const w = counting(S);
  const claim = async (who, a, b, r) => { const x = await S.call('/v1/iliac/claim', { receipt: await iliacReceipt(S, a, b, r, T) }, who.secret); assert.equal(x.status, 200, JSON.stringify(x.body)); return x.body; };
  // R beats V, both new: 1016 and 984, under X's 1020 - no board counted, the kept word as it was
  const before = kept();
  assert.equal((await claim(R, R, V, 0)).rating, 1016);
  assert.equal(w.boards(), 0, 'a game below the top counts no board');
  assert.deepEqual(kept(), before);
  // the pair's two counts: one lookup a seating on the pair's index, never the season's every game
  const pairQs = w.sqls.filter((q) => /SELECT \(SELECT COUNT\(\*\) FROM iliac_games WHERE a = \?1 AND b = \?2/.test(q));
  assert.equal(pairQs.length, 2, 'the day\'s and the season\'s');
  for (const q of pairQs) {
    const plan = raw.prepare(`EXPLAIN QUERY PLAN ${q}`).all(R.id, V.id, q.includes('season = ?3') ? season : T).map((r) => r.detail).join(' | ');
    assert.match(plan, /idx_iliac_games_pair \(a=\? AND b=\?/);
    assert.doesNotMatch(plan, /idx_iliac_games_season/);
  }
  // P beats Q: 1010 + 15 reaches X's 1020 - counted: P the top now, short of the games, and nobody wears it
  w.reset();
  assert.ok((await claim(P, P, Q, 0)).rating >= 1020);
  assert.equal(w.boards(), 1, 'a game that reaches the top counts it');
  assert.equal(kept().player, null, 'the top moved');
  _resetIliacCache();
  assert.equal((await S.call('/v1/iliac/board', {}, X.secret)).body.rows[0].name, 'Pell');
});

// ═══ E6 AND E14: THE VOUCH IS A READ, IN ITS OWN WORDS ═══════════════════════════════════════════════════════════════

/** The host's iliacRanked (scenes/world.js), sliced and run over the real realm act and a real realm session. */
function hostRanked(door, { guest = false } = {}) {
  const W = read('src/scenes/world.js');
  const SRC = exprAt(W, W.indexOf('{', W.indexOf('    iliacRanked: {')));
  const lost = [];
  const realmSession = createRealmSession({ io: { storage: null }, id: 'char-1', lease: 'L', seq: 7, onLost: (why) => lost.push(why), later: () => () => {}, hidden: () => false, watchHidden: () => () => {} });
  const act = (o) => realmGoldAct({ ...o, wait: async () => {} });   // the retries' waits, none
  const ranked = new Function('realmSession', 'realmGoldAct', 'onlineCheckpoint', 'iliacDoor', 'characterIdOf', 'playerEntity', 'iliacRefusalText', `return (${SRC});`)(
    realmSession, act, () => {}, { deck: door, me: () => 'acct-1', guest: () => guest, board: async () => ({ ok: false }) }, () => 'char-1', {}, iliacRefusalText);
  return { ranked, lost };
}

test('AUDIT CARDS-6 E6/E14: the ranked vouch is a read - the realm not answering, or the record a move on, never ends the session; each refusal in Iliac Hand\'s words, a short deck\'s card by name; a guest\'s account offered no ranked seat (mutants: the vouch an act again; the read\'s unknown; the guest\'s why; the words)', async () => {
  const lostThenMoved = () => { let n = 0; return async () => (n++ === 0 ? { ok: false, error: 'offline' } : { ok: false, error: 'seq', seq: 8, status: 409 }); };
  for (const [what, door] of [['the service unreachable', async () => ({ ok: false, error: 'offline' })], ['the record a move on', async () => ({ ok: false, error: 'seq', seq: 8, status: 409 })],
    ['an answer lost, then the record one on (a read lands nothing)', lostThenMoved()]]) {
    const { ranked, lost } = hostRanked(door);
    const r = await ranked.vouch(STARTER_DECK);
    assert.deepEqual(r, { ok: false, why: 'The realm is not answering - try again.' }, what);
    assert.deepEqual(lost, [], `${what}: the session stands`);
  }
  const said = async (answer) => (await hostRanked(async () => answer).ranked.vouch(STARTER_DECK)).why;
  assert.equal(await said({ ok: false, error: 'deck-short', card: 'lich', status: 400 }), 'Your realm character does not hold every card of that deck (Lich).');
  assert.equal(await said({ ok: false, error: 'cards-closed', status: 503 }), 'The realm is not vouching for decks right now. Try again later.');
  assert.equal(await said({ ok: false, error: 'ranked-needs-account', status: 403 }), 'Ranked games need a registered account.');
  assert.deepEqual(await hostRanked(async () => ({ ok: true, data: { order: 'v1.deck.order' } })).ranked.vouch(STARTER_DECK), { ok: true, order: 'v1.deck.order' });
  assert.equal(hostRanked(async () => ({ ok: false })).ranked.why(), null, 'a registered realm character may play ranked');
  assert.equal(hostRanked(async () => ({ ok: false }), { guest: true }).ranked.why(), 'Ranked games need a registered account.', 'a guest is told before the realm is asked');
  const doorOf = (kind) => accountIliac({ fetch: async () => { throw new Error('unasked'); }, storage: { getItem: () => JSON.stringify({ secret: 's', id: 'p1', kind }) } });
  assert.deepEqual([doorOf('guest').guest(), doorOf('linked').guest()], [true, false], 'the door says a guest\'s session');
  // the act's own law, unchanged for an act: a lost answer is unknown, and ends the session
  const lost = [];
  const session = createRealmSession({ io: { storage: null }, id: 'char-1', lease: 'L', seq: 7, onLost: (why) => lost.push(why), later: () => () => {}, hidden: () => false, watchHidden: () => () => {} });
  const act = await realmGoldAct({ session, checkpoint: () => {}, needsAnswer: true, wait: async () => {}, call: async () => ({ ok: false, error: 'offline' }) });
  assert.deepEqual([act.unknown, lost], [true, ['unknown']]);
});

// ═══ E18: THE OTHER SEAT HEARS ITS RATING ════════════════════════════════════════════════════════════════════════════

test('AUDIT CARDS-6 E18: a ranked game carried by both seats tells both their rating - the first carrier\'s counted, the second\'s found counted with its own side on it (mutant: the second unsaid)', async () => {
  _resetIliacCache();
  const S = await standService({});
  const A = await S.registered('Bryn'), B = await S.registered('Cade');
  const receipt = await iliacReceipt(S, A, B, 0, Math.floor(Date.now() / 1000));
  const heard = { [A.id]: [], [B.id]: [] };
  const carrier = (who) => createIliacClaims({
    claim: async (r) => { const x = await S.call('/v1/iliac/claim', { receipt: r }, who.secret); return x.status === 200 ? { ok: true, data: x.body } : { ok: false, error: x.body?.error ?? 'server' }; },
    me: () => who.id, onCounted: (d) => heard[who.id].push([d.result, d.rating, d.delta]),
  });
  const ca = carrier(A), cb = carrier(B);
  ca.add(receipt); await ca.flush();
  cb.add(receipt); await cb.flush();
  assert.deepEqual(heard[A.id], [['won', 1016, 16]]);
  assert.deepEqual(heard[B.id], [['lost', 984, -16]], 'the loser hears his own');
  assert.deepEqual(cb.kept(), [], 'and lets it go');
});
