// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33): ILIAC HAND'S SEASON BOARD AND THE DECK A RANKED
// SEAT PLAYS, driven on the real Worker over SQLite (server-account/src/iliac.js). The deck order: a realm character's
// own thirty cards vouched for (the service's order on its digest, the room's to check), a card it lacks refused, an
// offline character or a guest never ranked. The claim: the relay's signed result (net/iliacReceipt.js) one row a game
// whichever seat carries it, the Elo the arena's, another's receipt refused, a guest's pair kept as nothing, a pair's
// day capped. The board and its title: the season's #1 over ten games against five foes wears `iliacchampion` at the
// mint, and loses it to whoever takes the top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { mintIliacReceipt } from '../src/net/iliacReceipt.js';
import { verifyOrder, verifyToken, deckDigest } from '../src/net/identityToken.js';
import { STARTER_DECK } from '../src/net/iliacCards.js';
import { ILIAC_CARD_TEMPLATE, deckShortOf, cardCountsOf } from '../src/net/cardWorthLaw.js';
import { ARENA_PAIR_DAY_MAX, ARENA_ELO_START } from '../src/net/arenaLaw.js';
import { _resetIliacCache, iliacTitleWorthy, iliacChampionOfBoard, ILIAC_CHAMPION_MIN_GAMES, ILIAC_CHAMPION_MIN_FOES } from '../server-account/src/iliac.js';
import { titlesHeld, equipRefusal } from '../server-account/src/titles.js';
import { runCron, CRON_MINUTE, _resetCronForTests } from '../server-account/src/cron.js';
import { TITLE_TEXT, TITLE_RGBA } from '../src/ui/playerBadge.js';

const { subtle } = globalThis.crypto;
const nowS = () => Math.floor(Date.now() / 1000);
let _game = 0;
const gameId = () => (0x1000 + ++_game).toString(16).padStart(16, '0');
const receiptOf = (S, a, b, r, h = r === 2 ? 'draw' : 'holdings', j = gameId()) => mintIliacReceipt({ j, f: [a.id, b.id], r, h }, S.gatePriv, { subtle, nowS: nowS() });
const claimOf = (S, who, receipt) => S.call('/v1/iliac/claim', { receipt }, who.secret);
const tokenOf = async (S, who) => {
  const r = await S.call('/v1/auth/token', {}, who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return verifyToken(r.body.token, S.identityPublic, { subtle, nowS: nowS() });
};
/** The starter deck as a save's records: one stack a card. */
const cardsOf = (ids) => [...new Set(ids)].map((id) => ({ templateIndex: ILIAC_CARD_TEMPLATE, group: 'UselessItems2', card: id, stackCount: ids.filter((x) => x === id).length }));

test('CARDS10 the deck order: a realm character\'s own thirty vouched for - the order the room checks, on the deck\'s digest; a card it lacks, a lawless deck, an offline character, a guest refused', async () => {
  const S = await standService({});
  const A = await S.registered('Ansel');
  const R = await seatRealm(S.env, A.secret, 'Ansel', { name: 'Ansel', level: 3, goldPieces: 100, items: cardsOf(STARTER_DECK) });
  const ask = (deck, extra = {}) => S.call('/v1/cards/deck', { character: R.id, realm: R.at(), deck, ...extra }, A.secret);
  const ok = await ask(STARTER_DECK);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const v = await verifyOrder(ok.body.order, S.identityPublic, { subtle, nowS: nowS(), kind: 'deck' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.s, v.claims.dh], [A.id, await deckDigest(STARTER_DECK, { subtle })], 'his account, this deck');
  assert.equal(ok.body.digest, v.claims.dh);
  // a deck with a card the character does not hold
  const lich = [...STARTER_DECK.slice(1), 'lich'];
  const short = await ask(lich);
  assert.deepEqual([short.status, short.body.error], [400, 'deck-short']);
  assert.deepEqual(deckShortOf({ items: cardsOf(STARTER_DECK) }, lich), 'lich');
  assert.equal(cardCountsOf({ items: cardsOf(STARTER_DECK) }).get(STARTER_DECK[0]) >= 1, true);
  assert.equal((await ask(STARTER_DECK.slice(1))).body.error, 'bad-deck', 'twenty-nine is no deck');
  // an offline character (none of the realm's) plays friendly
  assert.equal((await S.call('/v1/cards/deck', { character: 'char-ansel', deck: STARTER_DECK }, A.secret)).body.error, 'cards-realm');
  // a guest climbs nothing
  const G = await S.guest();
  assert.equal((await S.call('/v1/cards/deck', { character: 'char-g', deck: STARTER_DECK }, G.secret)).body.error, 'ranked-needs-account');
});

test('CARDS10 the claim: one row a game whichever seat carries it, the arena\'s Elo; another\'s receipt, an unsigned one refused; a guest\'s pair kept as nothing; a pair\'s day capped (mutants: the row keyed by the game; the account checked; the pair\'s day)', async () => {
  _resetIliacCache();
  const S = await standService();
  const A = await S.registered('Bryn'), B = await S.registered('Cade'), C = await S.registered('Dara');
  const rc = await receiptOf(S, A, B, 0);
  const a1 = await claimOf(S, A, rc);
  assert.equal(a1.status, 200, JSON.stringify(a1.body));
  assert.deepEqual([a1.body.recorded, a1.body.result, a1.body.rated, a1.body.rating], [true, 'won', true, ARENA_ELO_START + 16]);
  const b1 = await claimOf(S, B, rc);
  assert.deepEqual([b1.body.recorded, b1.body.why, b1.body.result, b1.body.rating], [false, 'claimed', 'lost', ARENA_ELO_START - 16], 'the loser\'s copy changes nothing');
  assert.equal((await claimOf(S, C, rc)).status, 403, 'not hers to carry');
  const unsigned = await mintIliacReceipt({ j: gameId(), f: [A.id, B.id], r: 0, h: 'power' }, null, { subtle, nowS: nowS() });
  const u = await claimOf(S, A, unsigned);
  assert.deepEqual([u.status, u.body.error, u.body.why], [400, 'receipt', 'unsigned']);
  // a guest at the table: kept as nothing
  const G = await S.guest();
  const g = await claimOf(S, A, await receiptOf(S, A, G, 0));
  // PIN MOVED (AUDIT CARDS-6 D11): the OTHER seat unregistered is its own word - `guest` is the claimant's (which
  // registering mends, its carrier keeping the receipt), and A's carrier kept this one a week for nothing
  assert.deepEqual([g.body.recorded, g.body.why], [false, 'foe-unregistered']);
  // the pair's day: past ARENA_PAIR_DAY_MAX rated games between two, a game is kept and not counted
  for (let i = 1; i < ARENA_PAIR_DAY_MAX; i++) await claimOf(S, A, await receiptOf(S, A, B, 0));
  const capped = await claimOf(S, A, await receiptOf(S, A, B, 0));
  assert.deepEqual([capped.body.recorded, capped.body.rated, capped.body.delta], [true, false, 0], 'kept, not counted');
  const draw = await claimOf(S, C, await receiptOf(S, A, C, 2));
  assert.deepEqual([draw.body.result, draw.body.how], ['draw', 'draw']);
});

test('CARDS10 the board and its title: the season\'s #1 over ten games against five foes wears Iliac Champion at the mint, and loses it to whoever takes the top; short of the games or the foes nobody wears it', async () => {
  _resetIliacCache();
  const S = await standService();
  const A = await S.registered('Eira');
  const foes = [];
  for (const n of ['Fen', 'Gale', 'Hob', 'Isla', 'Jory']) foes.push(await S.registered(n));
  assert.deepEqual([ILIAC_CHAMPION_MIN_GAMES, ILIAC_CHAMPION_MIN_FOES], [10, 5]);
  for (let i = 0; i < 5; i++) { await claimOf(S, A, await receiptOf(S, A, foes[0], 0)); await claimOf(S, A, await receiptOf(S, A, foes[1], 0)); }
  _resetIliacCache();
  let board = (await S.call('/v1/iliac/board', {}, A.secret)).body;
  assert.deepEqual([board.rows[0].name, board.rows[0].games, board.rows[0].rank, board.rows[0].you], ['Eira', 10, 1, true]);
  assert.equal(board.champion, null, 'two foes are not five');
  assert.deepEqual(board.titleNeeds, { games: 10, foes: 5 });
  for (const f of foes.slice(2)) await claimOf(S, A, await receiptOf(S, A, f, 0));
  _resetIliacCache();
  board = (await S.call('/v1/iliac/board', {}, foes[0].secret)).body;
  assert.equal(board.champion.name, 'Eira');
  assert.equal(board.rows[0].title, null, 'held, not worn until she wears it');
  assert.ok(board.me && board.me.champion === false, 'the caller\'s own standing');
  assert.equal((await S.call('/v1/account/title', { title: 'iliacchampion' }, A.secret)).status, 200, 'the #1 may wear it');
  assert.equal((await tokenOf(S, A)).claims.t, 'iliacchampion', 'and it rides the token');
  // the minute clock counts the #1 too: the kept word gone, a rated game since - counted and kept again, the arena's law
  S.env.DB._raw.prepare('DELETE FROM iliac_champions').run();
  _resetCronForTests();
  const ran = await runCron(S.env, { cron: CRON_MINUTE, nowS: nowS() });
  assert.equal(ran.find((j) => j.name === 'iliac-champion').changed, 1);
  assert.equal(S.env.DB._raw.prepare('SELECT player FROM iliac_champions').get().player, A.id);
  // a newcomer takes the top: the title lapses by itself
  const Z = await S.registered('Zed');
  for (let i = 0; i < ARENA_PAIR_DAY_MAX; i++) await claimOf(S, Z, await receiptOf(S, Z, A, 0));
  _resetIliacCache();
  board = (await S.call('/v1/iliac/board', {}, A.secret)).body;
  assert.equal(board.rows[0].name, 'Zed');
  assert.equal(board.champion, null, 'five games wear no title - and nobody under it does');
  assert.equal((await tokenOf(S, A)).claims.t, undefined, 'the title worn is worn no longer');
  // the law, row by row
  assert.equal(iliacTitleWorthy({ games: 10, foes: 5 }), true);
  assert.equal(iliacTitleWorthy({ games: 9, foes: 5 }), false);
  assert.equal(iliacTitleWorthy({ games: 10, foes: 4 }), false);
  assert.equal(iliacChampionOfBoard([{ player: 'b', games: 3, foes: 1 }, { player: 'a', games: 20, foes: 9 }]), null, 'the title never passes down');
  assert.ok(titlesHeld({ handle: 'x', iliac: { champion: true } }, {}).includes('iliacchampion'));
  assert.equal(equipRefusal('iliacchampion', { handle: 'x', iliac: { champion: false } }, {}), 'not-held');
  assert.equal(TITLE_TEXT.iliacchampion, 'Iliac Champion');
  assert.ok(TITLE_RGBA.iliacchampion, 'its colour');
});
