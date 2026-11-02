// KG6 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 10.7 and 19): THE KING'S GAMBIT'S SEASON AND ITS
// GRANDMASTER. The rated game's receipt (net/gambit/gambitReceipt.js g1): a winner, never a draw; two accounts; the version
// signed, so no other receipt passes for it. The season board on the real Worker over SQLite (server-account/src/
// gambit.js): one row a game whichever seat carries it, the arena's Elo, another's receipt refused, the pair's day
// capped; the season's #1 over ten games against five foes wears GRANDMASTER at the mint, the minute clock counts it,
// and it lapses when another takes the top. The client: the carrier keeps a result and offers it (net/gambit/gambitClaims.js);
// the panel (scenes/gambitTableGame.js online): the gold table's stake picks - the purse's to cover, the other's to
// match - a staked Ready (the service first, then the relay with its order), the stake book told once the relay sat
// it; the season board read and shown.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mintGambitReceipt, readGambitReceipt, verifyGambitReceipt, gambitReceiptValid, GAMBIT_HOW, GAMBIT_RECEIPT_V } from '../../../src/net/gambit/gambitReceipt.js';
import { mintIliacReceipt, verifyIliacReceipt } from '../../../src/net/iliac/iliacReceipt.js';
import { createGambitClaims, GAMBIT_CLAIMS_KEY } from '../../../src/net/gambit/gambitClaims.js';
import { verifyToken, TITLES } from '../../../src/net/identityToken.js';
import { ARENA_PAIR_DAY_MAX, ARENA_ELO_START } from '../../../src/net/arena/arenaLaw.js';
import { _resetGambitCache, gambitTitleWorthy, gambitChampionOfBoard, GAMBIT_CHAMPION_MIN_GAMES, GAMBIT_CHAMPION_MIN_FOES } from '../../../server-account/src/gambit.js';
import { titlesHeld } from '../../../server-account/src/titles.js';
import { runCron, CRON_MINUTE, _resetCronForTests } from '../../../server-account/src/cron.js';
import { TITLE_TEXT, TITLE_RGBA } from '../../../src/ui/playerBadge.js';
import { openGambitTableGame } from '../../../src/scenes/gambitTableGame.js';
import { crownIndex } from '../../../src/systems/gambit/gambitTableSession.js';
import { CARD_TABLE_W, CARD_TABLE_D } from '../../../src/world/card/cardTableProp.js';
import { _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { fakeDoc, text } from '../../decorFakes.mjs';
import { standService } from '../../accountDb.mjs';

beforeEach(() => resetPrefs());
const { subtle } = globalThis.crypto;
const nowS = () => Math.floor(Date.now() / 1000);
let _game = 0;
const gameId = () => (0x6000 + ++_game).toString(16).padStart(16, '0');
const receiptOf = (S, a, b, r, h = 'king', j = gameId()) => mintGambitReceipt({ j, f: [a.id, b.id], r, h }, S.gatePriv, { subtle, nowS: nowS() });
const claimOf = (S, who, receipt) => S.call('/v1/gambit/claim', { receipt }, who.secret);
const tokenOf = async (S, who) => {
  const r = await S.call('/v1/auth/token', {}, who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return verifyToken(r.body.token, S.identityPublic, { subtle, nowS: nowS() });
};

test('KG6 THE RATED GAME\'S RECEIPT: g1 - a winner (never a draw), two accounts, how it ended; read on the client signed or not, verified on the service by signature first; an Iliac Hand receipt is no King\'s Gambit one, nor the other way (mutants: the draw; the accounts; the version)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const r = await mintGambitReceipt({ j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 1, h: 'king' }, kp.privateKey, { subtle, nowS: 1000 });
  assert.ok(r.startsWith(`${GAMBIT_RECEIPT_V}.`));
  const v = await verifyGambitReceipt(r, kp.publicKey, { subtle, nowS: 1001 });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.f, v.claims.r, v.claims.h], [['acct-a', 'acct-b'], 1, 'king']);
  assert.equal(readGambitReceipt(r).signed, true);
  assert.deepEqual(GAMBIT_HOW, ['king', 'forfeit', 'idle', 'left']);
  const base = { j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 0, h: 'king', i: 1, e: 2 };
  assert.equal(gambitReceiptValid(base), true);
  assert.equal(gambitReceiptValid({ ...base, r: 2 }), false, 'no draw');
  assert.equal(gambitReceiptValid({ ...base, f: ['acct-a', 'acct-a'] }), false, 'one account twice');
  assert.equal(gambitReceiptValid({ ...base, h: 'void' }), false, 'no contest is no receipt');
  assert.equal(gambitReceiptValid({ ...base, w: 'stood' }), false, 'a cash-out\'s field');
  await assert.rejects(() => mintGambitReceipt({ j: 'x', f: ['acct-a', 'acct-b'], r: 0, h: 'king' }, null, { subtle, nowS: 1 }));
  const iliac = await mintIliacReceipt({ j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 0, h: 'power' }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyGambitReceipt(iliac, kp.publicKey, { subtle, nowS: 1001 })).why, 'version');
  assert.equal((await verifyIliacReceipt(r, kp.publicKey, { subtle, nowS: 1001 })).why, 'version');
  const unsigned = await mintGambitReceipt({ j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 0, h: 'king' }, null, { subtle, nowS: 1000 });
  assert.equal((await verifyGambitReceipt(unsigned, kp.publicKey, { subtle, nowS: 1001 })).why, 'unsigned');
  assert.equal(readGambitReceipt(unsigned).signed, false);
});

test('KG6 THE CLAIM: one row a game whichever seat carries it, the arena\'s Elo; another\'s receipt and an unsigned one refused; a foe unregistered kept as nothing; the pair\'s day capped (mutants: the row keyed by the game; the account checked; the pair\'s day)', async () => {
  _resetGambitCache();
  const S = await standService();
  const A = await S.registered('Bryn'), B = await S.registered('Cade'), C = await S.registered('Dara');
  const rc = await receiptOf(S, A, B, 0);
  const a1 = await claimOf(S, A, rc);
  assert.equal(a1.status, 200, JSON.stringify(a1.body));
  assert.deepEqual([a1.body.recorded, a1.body.result, a1.body.rated, a1.body.rating], [true, 'won', true, ARENA_ELO_START + 16]);
  const b1 = await claimOf(S, B, rc);
  assert.deepEqual([b1.body.recorded, b1.body.why, b1.body.result, b1.body.rating], [false, 'claimed', 'lost', ARENA_ELO_START - 16], 'the loser\'s copy changes nothing');
  assert.equal((await claimOf(S, C, rc)).status, 403, 'not hers to carry');
  const unsigned = await mintGambitReceipt({ j: gameId(), f: [A.id, B.id], r: 0, h: 'forfeit' }, null, { subtle, nowS: nowS() });
  assert.deepEqual([(await claimOf(S, A, unsigned)).body.why], ['unsigned']);
  const G = await S.guest();
  const g = await claimOf(S, A, await receiptOf(S, A, G, 0));
  assert.deepEqual([g.body.recorded, g.body.why], [false, 'foe-unregistered']);
  assert.deepEqual([(await claimOf(S, G, await receiptOf(S, G, A, 1))).body.why], ['guest']);
  for (let i = 1; i < ARENA_PAIR_DAY_MAX; i++) await claimOf(S, A, await receiptOf(S, A, B, 0));
  const capped = await claimOf(S, A, await receiptOf(S, A, B, 0));
  assert.deepEqual([capped.body.recorded, capped.body.rated, capped.body.delta], [true, false, 0], 'kept, not counted');
  const left = await claimOf(S, C, await receiptOf(S, A, C, 1, 'left'));
  assert.deepEqual([left.body.result, left.body.how], ['won', 'left']);
});

test('KG6 THE BOARD AND ITS GRANDMASTER: the season\'s #1 over ten games against five foes wears it at the mint, the minute clock counts it, and it lapses when another takes the top; short of the games or the foes nobody wears it (mutants: the floor; the first row only; the title held; the clock)', async () => {
  _resetGambitCache();
  const S = await standService();
  const A = await S.registered('Eira');
  const foes = [];
  for (const n of ['Fen', 'Gale', 'Hob', 'Isla', 'Jory']) foes.push(await S.registered(n));
  assert.deepEqual([GAMBIT_CHAMPION_MIN_GAMES, GAMBIT_CHAMPION_MIN_FOES], [10, 5]);
  for (let i = 0; i < 5; i++) { await claimOf(S, A, await receiptOf(S, A, foes[0], 0)); await claimOf(S, A, await receiptOf(S, A, foes[1], 0)); }
  _resetGambitCache();
  let board = (await S.call('/v1/gambit/board', {}, A.secret)).body;
  assert.deepEqual([board.rows[0].name, board.rows[0].games, board.rows[0].rank, board.rows[0].you], ['Eira', 10, 1, true]);
  assert.equal(board.champion, null, 'two foes are not five');
  assert.deepEqual(board.titleNeeds, { games: 10, foes: 5 });
  for (const f of foes.slice(2)) await claimOf(S, A, await receiptOf(S, A, f, 0));
  _resetGambitCache();
  board = (await S.call('/v1/gambit/board', {}, foes[0].secret)).body;
  assert.equal(board.champion.name, 'Eira');
  assert.ok(board.me && board.me.champion === false, 'the caller\'s own standing');
  assert.equal((await S.call('/v1/account/title', { title: 'grandmaster' }, A.secret)).status, 200, 'the #1 may wear it');
  assert.equal((await tokenOf(S, A)).claims.t, 'grandmaster', 'and it rides the token');
  S.env.DB._raw.prepare('DELETE FROM gambit_champions').run();
  _resetCronForTests();
  const ran = await runCron(S.env, { cron: CRON_MINUTE, nowS: nowS() });
  assert.equal(ran.find((j) => j.name === 'gambit-champion').changed, 1);
  assert.equal(S.env.DB._raw.prepare('SELECT player FROM gambit_champions').get().player, A.id);
  const Z = await S.registered('Zed');
  for (let i = 0; i < ARENA_PAIR_DAY_MAX; i++) await claimOf(S, Z, await receiptOf(S, Z, A, 0));
  _resetGambitCache();
  board = (await S.call('/v1/gambit/board', {}, A.secret)).body;
  assert.equal(board.rows[0].name, 'Zed');
  assert.equal(board.champion, null, 'five games wear no title - and nobody under it does');
  assert.equal((await tokenOf(S, A)).claims.t, undefined, 'the title worn is worn no longer');
  assert.equal(gambitTitleWorthy({ games: 10, foes: 5 }), true);
  assert.equal(gambitTitleWorthy({ games: 9, foes: 5 }), false);
  assert.equal(gambitTitleWorthy({ games: 10, foes: 4 }), false);
  assert.equal(gambitChampionOfBoard([{ player: 'b', games: 3, foes: 1 }, { player: 'a', games: 20, foes: 9 }]), null, 'the title never passes down');
  assert.ok(titlesHeld({ handle: 'x', gambit: { champion: true } }, {}).includes('grandmaster'));
  assert.ok(TITLES.includes('grandmaster'));
  assert.equal(TITLE_TEXT.grandmaster, 'Grandmaster');
  assert.ok(TITLE_RGBA.grandmaster, 'its colour');
  // AUDIT KG II D12: a purple of its own - #b438d2, more than 30 from every title's (the house's bar, crystalfist's)
  const hex = (c) => `#${c.slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
  assert.equal(hex(TITLE_RGBA.grandmaster), '#b438d2');
  for (const other of TITLES.filter((x) => x !== 'grandmaster' && TITLE_RGBA[x])) {
    const d = Math.hypot(...[0, 1, 2].map((i) => (TITLE_RGBA.grandmaster[i] - TITLE_RGBA[other][i]) * 255));
    assert.ok(d > 30, `apart from the ${other}'s (${d.toFixed(0)})`);
  }
});

test('KG6 THE CARRIER: a rated result kept on its own store and offered at once; settled, let go; a guest\'s kept; another account\'s never offered (mutants: the reader; the store)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const store = new Map();
  const asked = [];
  let answer = { ok: true, data: { recorded: true, rated: true, rating: 1516, delta: 16 } };
  const counted = [];
  const c = createGambitClaims({ claim: async (r) => { asked.push(r); return answer; }, store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, me: () => 'acct-a', nowS: () => 1000, nowMs: () => 0, onCounted: (d) => counted.push(d) });
  const r = await mintGambitReceipt({ j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 0, h: 'king' }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal(c.add(r), true);
  await c.flush();
  assert.equal(asked.length, 1);
  assert.equal(counted[0].rating, 1516);
  assert.deepEqual(store.get(GAMBIT_CLAIMS_KEY), [], 'settled, let go');
  answer = { ok: true, data: { recorded: false, why: 'guest' } };
  const r2 = await mintGambitReceipt({ j: '0123456789abcde0', f: ['acct-a', 'acct-b'], r: 0, h: 'king' }, kp.privateKey, { subtle, nowS: 1000 });
  c.add(r2); await c.flush();
  assert.deepEqual(store.get(GAMBIT_CLAIMS_KEY), [r2], 'a guest\'s kept - registering mends it');
  const theirs = await mintGambitReceipt({ j: '0123456789abcde1', f: ['acct-x', 'acct-y'], r: 0, h: 'king' }, kp.privateKey, { subtle, nowS: 1000 });
  const n = asked.length;
  c.add(theirs); await c.flush();
  assert.ok(!asked.slice(n).includes(theirs), 'another account\'s never offered');
  assert.equal(c.add('i1.x.y'), false, 'an Iliac receipt is not this carrier\'s');
});

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────

const FRAME = { centre: [0, 0.8, 0], axisYaw: Math.PI / 2, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 };
const buttons = (n, out = []) => { if (n.tag === 'button') out.push(n); for (const c of n.children ?? []) buttons(c, out); return out; };
const tiles = (n, out = []) => { if (String(n.className).includes('dfgambit-stake')) out.push(n); for (const c of n.children ?? []) tiles(c, out); return out; };

test('KG6 THE GOLD TABLE\'S PANEL: the mod\'s online stakes picked under the army - the purse\'s to cover, the other\'s stake\'s to match, what it wins said; Ready puts it down - the service first, then the relay with its order - and the stake book is told once the relay sat it; the season board read and shown (mutants: the picks\' bounds; the order sent; the book told; the board)', async () => {
  const sent = [], asked = [], sat = [];
  let purse = 300, local = 0;
  const made = [], freed = [];
  const renderer = { createMesh: (m) => { made.push(m); return { m }; }, drawMesh() {}, destroyMesh: (m) => freed.push(m), uploadTexture() {}, releaseTexture() {} };
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer, entity: { name: 'Ves', items: [], goldPieces: 0 }, say() {}, holdCursor: () => () => true, relock() {},
    rand32: () => 7, now: () => local, day: () => 1, key: 'k', friendly: true, regulars: [], frame: FRAME, mySeatFeet: [0, 0, -0.9], touch: () => false,
    onHoldem() {}, onIliac() {}, onStand() {},
    online: {
      send: (w) => { sent.push(w); return true; }, myId: () => 'me', now: () => 1e12, table: 1, chairs: 4, chair: 0, chairFeet: () => [0, 0, -0.9],
      gold: true, purse: () => purse, seated: (id) => sat.push(id),
      stake: async (amount) => { asked.push(amount); return { ok: true, stake: `order-${amount}`, id: `stake-${amount}` }; },
      board: async () => ({ ok: true, data: { ok: true, season: { n: 4 }, rows: [{ rank: 1, name: 'Eira', rating: 1612, wins: 14, losses: 2, you: false }, { rank: 2, name: 'Ves', rating: 1530, wins: 6, losses: 4, you: true }], pinned: null, champion: { name: 'Eira' }, titleNeeds: { games: 10, foes: 5 }, me: { rating: 1530, wins: 6, losses: 4, games: 10 } } }),
    },
  });
  const frame = (state, events = []) => g.relay({ t: 'gambit', table: 1, now: 1e12, events, state });
  const view = (seats) => ({ chairs: 4, gameNo: 0, seats, game: null, clockAt: 0, last: null, gold: true });
  frame(view([{ id: 'me', name: 'Ves', chair: 0, crown: 0 }, { id: 'o', name: 'Oth', chair: 2, crown: 1, ready: true, stake: 200 }]));
  assert.equal(g.g.phase, 'army');
  g.press('autofill');
  const t = tiles(g.g.hud.root);
  assert.deepEqual(t.map((n) => n.textContent), ['10 gold', '50 gold', '200 gold', '1,000 gold', '5,000 gold']);
  assert.deepEqual(t.map((n) => n.attrs['aria-disabled'] === 'true'), [true, true, false, true, true], 'the other\'s 200 to match - and the purse\'s 300 to cover');
  g.press('stake', 50);
  assert.equal(g.g.stakePick, null, 'a closed pick is said, never taken');
  assert.equal(g.g.why, 'Oth stakes 200 gold. Match it to play.');   // PLAIN-SWEEP: the other's stake, and what to do
  g.press('stake', 200);
  assert.match(text(g.g.hud.root), /Win, and you take the pot: 400 gold\./);
  assert.ok(buttons(g.g.hud.root).some((b) => b.textContent === 'Ready - stake 200 gold'));
  g.press('ready');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(asked, [200], 'the service holds it first');
  assert.deepEqual(sent.at(-1), { op: 'ready', army: g.g.army, crown: crownIndex(g.g.crown), stake: 'order-200', table: 1 }, 'then the relay, with its order');
  assert.deepEqual(sat, []);
  frame(view([{ id: 'me', name: 'Ves', chair: 0, crown: 0, ready: true, stake: 200 }, { id: 'o', name: 'Oth', chair: 2, crown: 1, ready: true, stake: 200 }]));
  assert.deepEqual(sat, ['stake-200'], 'the stake book told the relay sat it');
  purse = 0;
  // the season board
  g.press('board');
  await new Promise((r) => setTimeout(r, 0));
  const shown = text(g.g.hud.root);
  assert.match(shown, /Season 4: the board/);
  assert.match(shown, /1\. Eira - rating 1612 \(14 wins, 2 losses\)/);   // PIN MOVED (AUDIT KG II D20): the counts' plurals
  assert.match(shown, /You: rank 2, rating 1530/);
  assert.match(shown, /Grandmaster: Eira/);
  assert.match(shown, /after playing 10 rated games against 5 different players\. Only games between two registered accounts count\./);   // PIN MOVED (AUDIT KG II D10): registered, not signed in; PLAIN-SWEEP: the rule said once
  g.close();
  assert.equal(freed.length, made.length);
});
