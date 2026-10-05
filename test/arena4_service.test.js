// ARENA4 (2026-10-02, Mac: "join a team (red and blue) and climb esclating tiers of opponents, or choose to matchmake for
// a real opponent ... view your ranking and even player leaderboards ... Being a top rank PvE fighter comes with it's own
// title. Being the #1 pvp arena player comes with it's own temporary title/glyph"): THE ARENA'S RECORDS, DRIVEN - the
// account service over node:sqlite with every migration (test/accountDb.mjs), the relay's receipts signed with the relay's
// own key: the climb in order, the bouts between players and both ratings, the pair's day, the banners, the boards
// counted from the rows, and the arena's titles and laurel derived at the token's mint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from './accountDb.mjs';
import { mintArenaReceipt, readArenaReceipt, verifyArenaReceipt, arenaReceiptValid, ARENA_RECEIPT_TTL_S } from '../src/net/arenaReceipt.js';
import { mintReceipt, readReceipt } from '../src/net/gateReceipt.js';
import { verifyToken } from '../src/net/identityToken.js';
import {
  arenaSeasonOf, arenaSeasonEndsS, arenaSeasonDay, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S, eloAfter, eloExpected, ARENA_ELO_START, ARENA_ELO_MIN,
  arenaLadderOf, arenaNextOf, ladderKey, ARENA_PAIR_DAY_MAX, ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_TEAM_POINTS,
} from '../src/net/arenaLaw.js';
import { _resetArenaCache, laurelWorthy, laurelOfBoard } from '../server-account/src/arena.js';
import { titlesHeld, glyphsOf, equipRefusal } from '../server-account/src/titles.js';
import { TEAM_POINTS } from '../src/systems/arenaLeague.js';

const { subtle } = globalThis.crypto;
const nowS = () => Math.floor(Date.now() / 1000);
let _bout = 0;
const boutId = () => (++_bout).toString(16).padStart(16, '0');
const ladderReceipt = (S, who, tier, step, won = 1, how = 'fall', j = boutId()) => mintArenaReceipt({ a: 'l', j, s: who.id, q: tier, u: step, r: won, h: how }, S.gatePriv, { subtle, nowS: nowS() });
const pvpReceipt = (S, a, b, r, how = 'fall', j = boutId()) => mintArenaReceipt({ a: 'p', j, f: [a.id, b.id], r, h: how }, S.gatePriv, { subtle, nowS: nowS() });
const claimOf = (S, who, receipt) => S.call('/v1/arena/claim', { receipt }, who.secret);
const tokenOf = async (S, who) => {
  const r = await S.call('/v1/auth/token', {}, who.secret);
  assert.equal(r.status, 200);
  const v = await verifyToken(r.body.token, S.identityPublic, { subtle, nowS: nowS() });
  assert.ok(v.ok, v.why);
  return { ...r.body, claims: v.claims };
};

test('ARENA4 law: the season is eight weeks from a Monday; the rating is Elo 1,000 K 32, the sum kept, never under the floor; the climb is the won rows in order (mutants: K 16; the sum not kept; the gap read as a step; the floor dropped; Elo\'s 400 changed)', () => {
  assert.equal(new Date(ARENA_SEASON_EPOCH_S * 1000).getUTCDay(), 1, 'a Monday');
  assert.equal(ARENA_SEASON_S, 56 * 86400);
  assert.equal(arenaSeasonOf(ARENA_SEASON_EPOCH_S), 1);
  assert.equal(arenaSeasonOf(ARENA_SEASON_EPOCH_S - 999), 1, 'nothing is earlier than the first');
  assert.equal(arenaSeasonOf(ARENA_SEASON_EPOCH_S + ARENA_SEASON_S - 1), 1);
  assert.equal(arenaSeasonOf(ARENA_SEASON_EPOCH_S + ARENA_SEASON_S), 2);
  assert.equal(arenaSeasonEndsS(1), ARENA_SEASON_EPOCH_S + ARENA_SEASON_S);
  assert.equal(arenaSeasonDay(ARENA_SEASON_EPOCH_S), 1);
  assert.equal(arenaSeasonDay(ARENA_SEASON_EPOCH_S + 55 * 86400 + 5), 56);
  assert.equal(ARENA_ELO_START, 1000);
  assert.deepEqual(eloAfter(1000, 1000, 1), [1016, 984], 'K 32, even odds');
  assert.deepEqual(eloAfter(1000, 1000, 0.5), [1000, 1000]);
  const [a, b] = eloAfter(1400, 1000, 0);
  assert.equal(a + b, 2400, 'one change - the sum kept');
  assert.equal(a, 1400 - Math.round(32 * eloExpected(1400, 1000)));
  assert.equal(eloAfter(ARENA_ELO_MIN, 3000, 0)[0], ARENA_ELO_MIN, 'never under the floor');
  // ARENA5: the pin above loses nothing (a 2,900-point favourite's win moves nobody a point), so the floor is held
  // where a loss really crosses it - and the expectation by Elo's own 400
  assert.deepEqual(eloAfter(ARENA_ELO_MIN + 10, ARENA_ELO_MIN + 10, 0), [ARENA_ELO_MIN, ARENA_ELO_MIN + 26], 'a loss that would cross the floor stops on it');
  assert.ok(Math.abs(eloExpected(1400, 1000) - 10 / 11) < 1e-12, 'four hundred points up is ten to one');
  assert.equal(ladderKey(0, 0), 0);
  assert.equal(ladderKey(9, 3), 39);
  const L = arenaLadderOf([{ tier: 0, bout: 0 }, { tier: 0, bout: 1 }, { tier: 0, bout: 3 }]);
  assert.deepEqual([L.tier, L.won, L.champs[0]], [0, 2, false], 'a row past the gap is no step - the champion row unearned');
  assert.deepEqual(arenaNextOf([{ tier: 0, bout: 0 }]), { tier: 0, bout: 1 });
  const all = [];
  for (let t = 0; t < 10; t++) for (let u = 0; u < 4; u++) all.push({ tier: t, bout: u });
  const G = arenaLadderOf(all);
  assert.equal(G.grand, true);
  assert.equal(arenaNextOf(all), null, 'nothing past the Grand Champion');
  assert.deepEqual(ARENA_TEAM_POINTS, { ...TEAM_POINTS, pvp: 2 }, 'the offline banners\' points, and Arena.md 3\'s refereed PvP win');
});

test('ARENA4 receipt: a1 claims are disjoint from the gate\'s and the raid\'s; a ladder receipt names one account, a players\' two different ones; the gate\'s verifier reads none of it (mutants: a gate field admitted; one account twice; the week unbounded; the version unread; the signature, the expiry or the future unchecked; a claim it could not verify minted)', async () => {
  const S = await standService();
  const r = await mintArenaReceipt({ a: 'l', j: 'aaaaaaaaaaaaaaaa', s: 'acct-1', q: 0, u: 0, r: 1, h: 'fall' }, S.gatePriv, { subtle, nowS: 1_800_000_000 });
  assert.ok(r.startsWith('a1.'));
  const c = readArenaReceipt(r);
  assert.equal(c.signed, true);
  assert.equal(c.e - c.i, ARENA_RECEIPT_TTL_S);
  assert.equal(readReceipt(r), null, 'the gate\'s reader refuses it');
  assert.equal(arenaReceiptValid({ ...c, d: 4 }), false, 'a gate\'s day is not admitted');
  assert.equal(arenaReceiptValid({ a: 'p', j: 'aaaaaaaaaaaaaaaa', f: ['acct-1', 'acct-1'], r: 0, h: 'fall', i: 1, e: 2 }), false, 'one account twice');
  assert.equal(arenaReceiptValid({ a: 'p', j: 'aaaaaaaaaaaaaaaa', f: ['acct-1', 'acct-2'], r: 3, h: 'fall', i: 1, e: 2 }), false, 'a result past a draw');
  // ARENA5: carried a week and no longer; read only under its own version; minted only when it could be verified
  assert.equal(arenaReceiptValid({ ...c, e: c.i + ARENA_RECEIPT_TTL_S + 1 }), false, 'nothing carried past the week');
  assert.equal(readArenaReceipt(`x1${r.slice(2)}`), null, 'an arena body under another version is no arena receipt');
  await assert.rejects(mintArenaReceipt({ a: 'p', j: 'aaaaaaaaaaaaaaaa', f: ['acct-1', 'acct-1'], r: 0, h: 'fall' }, S.gatePriv, { subtle, nowS: 1_800_000_000 }), TypeError, 'the relay signs nothing the service would refuse');
  const gate = await mintReceipt({ d: 9, b: 'ruhn', s: 'acct-1', c: 1, x: 'dealt' }, S.gatePriv, { subtle, nowS: 1_800_000_000 });
  assert.equal(readArenaReceipt(gate), null, 'and the arena\'s refuses the gate\'s');
  const pub = await subtle.importKey('raw', new Uint8Array(Buffer.from(S.env.GATE_PUBLIC_KEY, 'base64url')), { name: 'Ed25519' }, false, ['verify']);
  assert.deepEqual(await verifyArenaReceipt(r.slice(0, r.lastIndexOf('.') + 1), pub, { subtle, nowS: 1_800_000_000 }), { ok: false, why: 'unsigned' });
  assert.equal((await verifyArenaReceipt(r, pub, { subtle, nowS: 1_800_000_000 })).ok, true);
  // ARENA5: the verifier's rungs past the shape - another bout's claims under this signature, a week gone, a clock behind
  const other = await mintArenaReceipt({ a: 'l', j: 'bbbbbbbbbbbbbbbb', s: 'acct-1', q: 0, u: 0, r: 1, h: 'fall' }, S.gatePriv, { subtle, nowS: 1_800_000_000 });
  const forged = other.slice(0, other.lastIndexOf('.')) + r.slice(r.lastIndexOf('.'));
  assert.deepEqual(await verifyArenaReceipt(forged, pub, { subtle, nowS: 1_800_000_000 }), { ok: false, why: 'signature' }, 'one bout\'s signature on another\'s claims');
  assert.deepEqual(await verifyArenaReceipt(r, pub, { subtle, nowS: 1_800_000_000 + ARENA_RECEIPT_TTL_S }), { ok: false, why: 'expired' }, 'carried past its week');
  assert.deepEqual(await verifyArenaReceipt(r, pub, { subtle, nowS: 1_800_000_000 - 3600 }), { ok: false, why: 'future' }, 'issued an hour ahead of the clock that reads it');
});

test('ARENA4 the climb: a win is kept only as the account\'s next bout (in the write), a loss whatever its order, a receipt once whoever carries it; another\'s is not yours; a guest keeps nothing (mutants: the order check dropped; a loss refused out of order; a receipt counted twice)', async () => {
  const S = await standService();
  const A = await S.registered('Alva'), B = await S.registered('Brann');
  const r00 = await ladderReceipt(S, A, 0, 0);
  const first = await claimOf(S, A, r00);
  assert.equal(first.status, 200);
  assert.equal(first.body.recorded, true);
  assert.equal(first.body.ladder.won, 1, 'one bout up the Pit');
  assert.deepEqual((await claimOf(S, A, r00)).body.why, 'claimed', 'a receipt counts once');
  const out = await claimOf(S, A, await ladderReceipt(S, A, 0, 2));
  assert.deepEqual([out.body.recorded, out.body.why], [false, 'order'], 'the third bout before the second is no step');
  const lost = await claimOf(S, A, await ladderReceipt(S, A, 3, 1, 0, 'yield'));
  assert.equal(lost.body.recorded, true, 'a loss is kept whatever its order');
  assert.equal(lost.body.ladder.record.losses, 1);
  assert.equal(lost.body.ladder.record.yields, 1);
  assert.equal((await claimOf(S, B, r00)).status, 403, 'another\'s receipt is not yours');
  const G = await S.guest();
  const g = await claimOf(S, G, await ladderReceipt(S, G, 0, 0));
  assert.deepEqual([g.body.recorded, g.body.why], [false, 'guest']);
  const unsigned = (await ladderReceipt(S, A, 0, 1));
  const u = await claimOf(S, A, unsigned.slice(0, unsigned.lastIndexOf('.') + 1));
  assert.deepEqual(u.body, { error: 'receipt', why: 'unsigned' });
  const two = await claimOf(S, A, await ladderReceipt(S, A, 0, 1));
  assert.equal(two.body.recorded, true);
  assert.equal(two.body.ladder.won, 2);
  // the same step won twice in two rooms: the second is not a step
  const again = await claimOf(S, A, await ladderReceipt(S, A, 0, 1));
  assert.deepEqual([again.body.recorded, again.body.why], [false, 'order']);
});

test('ARENA4 the Grand Champion: forty refereed wins in order and the title is the account\'s for good - held, equipable, minted, on the board and in the Hall; an account short of it holds none (mutants: the title without the row; the Hall empty)', async () => {
  _resetArenaCache();
  const S = await standService();
  const A = await S.registered('Ceryn'), B = await S.registered('Doran');
  for (let t = 0; t < 10; t++) for (let u = 0; u < 4; u++) {
    const r = await claimOf(S, A, await ladderReceipt(S, A, t, u));
    assert.equal(r.body.recorded, true, `tier ${t} bout ${u}`);
    if (t === 9 && u === 3) { assert.equal(r.body.grand, true); assert.equal(r.body.ladder.grand, true); }
  }
  for (let u = 0; u < 3; u++) await claimOf(S, B, await ladderReceipt(S, B, 0, u));
  const tA = await tokenOf(S, A);
  const eq = await S.call('/v1/account/title', { title: 'grandchampion' }, A.secret);
  assert.equal(eq.status, 200, 'the Grand Champion may wear it');
  assert.ok(eq.body.titles.includes('grandchampion'));
  const tA2 = await tokenOf(S, A);
  assert.equal(tA2.claims.t, 'grandchampion', 'and the token wears it');
  assert.equal(tA.claims.ar, ARENA_ELO_START, 'the season\'s rating rides the token - the start, before any rated bout');
  assert.equal((await S.call('/v1/account/title', { title: 'grandchampion' }, B.secret)).status, 403, 'nine wins short of a tier are no title');
  const board = (await S.call('/v1/arena/board', {}, B.secret)).body;
  assert.equal(board.pve.rows[0].name, 'Ceryn');
  assert.equal(board.pve.rows[0].grand, true);
  assert.equal(board.pve.rows[1].you, true);
  assert.equal(board.fast.rows[0].name, 'Ceryn');
  assert.equal(board.fast.rows[0].days, 1);
  assert.deepEqual(board.hall.map((h) => h.name), ['Ceryn'], 'the Hall of Champions');
  assert.equal(board.me.ladder.won, 3);
  assert.equal(board.pve.rows[0].player, undefined, 'an account\'s id stays the service\'s');
  // the row read without its honours holds neither - the honours are the arena's rows, read at the mint
  assert.deepEqual(titlesHeld({ handle: 'Ceryn', created_at: 1_900_000_000, registered_at: 1_900_000_000 }, {}), []);
  assert.deepEqual(titlesHeld({ handle: 'Ceryn', created_at: 1_900_000_000, registered_at: 1_900_000_000, arena: { grand: true, champion: false } }, {}), ['grandchampion']);
});

test('ARENA4 bouts between players: one row a bout whoever claims it, both ratings before and after; past the pair\'s day a bout is kept and not rated; a guest\'s is not kept (mutants: the claimant rated alone; the pair bound off; a draw scored as a win; the rating read from the first bout)', async () => {
  _resetArenaCache();
  const S = await standService();
  const A = await S.registered('Eldis'), B = await S.registered('Fenn');
  const r1 = await pvpReceipt(S, A, B, 0);
  const a1 = await claimOf(S, A, r1);
  assert.equal(a1.status, 200);
  assert.deepEqual([a1.body.recorded, a1.body.result, a1.body.rating, a1.body.delta, a1.body.rated], [true, 'won', 1016, 16, true]);
  const b1 = await claimOf(S, B, r1);
  assert.deepEqual([b1.body.recorded, b1.body.why, b1.body.result, b1.body.rating, b1.body.delta], [false, 'claimed', 'lost', 984, -16], 'the other fighter reads the same row');
  const d = await claimOf(S, B, await pvpReceipt(S, A, B, 2, 'judges'));
  assert.equal(d.body.result, 'draw');
  assert.equal(d.body.rating, 984 + Math.round(32 * (0.5 - eloExpected(984, 1016))), 'a draw moves the lower up');
  for (let i = 0; i < ARENA_PAIR_DAY_MAX - 2; i++) assert.equal((await claimOf(S, A, await pvpReceipt(S, A, B, 1))).body.rated, true);
  const past = await claimOf(S, A, await pvpReceipt(S, A, B, 0));
  assert.deepEqual([past.body.recorded, past.body.rated, past.body.delta], [true, false, 0], 'past the pair\'s day: kept, not rated');
  const G = await S.guest();
  const g = await claimOf(S, A, await pvpReceipt(S, A, G, 0));
  assert.deepEqual([g.body.recorded, g.body.why], [false, 'guest']);
  const st = (await S.call('/v1/arena/board', {}, A.secret)).body;
  assert.equal(st.pvp.total, 2);
  const me = st.pvp.rows.find((r) => r.you);
  assert.equal(me.bouts, ARENA_PAIR_DAY_MAX, 'the unrated bout is not on the board');
  assert.equal(st.me.pvp.rating, me.rating, 'ARENA5: my rating is my last rated bout\'s - the board\'s own');
  assert.equal(st.me.pvp.bouts, ARENA_PAIR_DAY_MAX);
  assert.equal((await tokenOf(S, A)).claims.ar, st.me.pvp.rating, 'the token carries the season\'s rating');
});

test('ARENA4 the laurel: the season\'s #1 wears arenachampion and the laurel at the mint - AUDIT ARENA-LADDER O2: over ten rated bouts against five accounts (two second accounts traded it in three) - and loses both to whoever takes the top; short of the bouts or the foes nobody wears it (mutants: the bouts bound off; the foes bound off; the laurel without the title; the top read from the second row; the laurel passed down past a #1 short of the bouts)', async () => {
  _resetArenaCache();
  const S = await standService();
  const A = await S.registered('Gwyn');
  const foes = [];
  for (const n of ['Hask', 'Ivo', 'Jorn', 'Kael', 'Lyra']) foes.push(await S.registered(n));
  assert.equal(ARENA_CHAMPION_MIN_BOUTS, 10);
  assert.equal(ARENA_CHAMPION_MIN_FOES, 5);
  // ten rated wins against two accounts: the top, and no laurel - two foes are not five
  for (let i = 0; i < 5; i++) { await claimOf(S, A, await pvpReceipt(S, A, foes[0], 0)); await claimOf(S, A, await pvpReceipt(S, A, foes[1], 0)); }
  _resetArenaCache();
  let board = (await S.call('/v1/arena/board', {}, A.secret)).body;
  assert.deepEqual([board.pvp.rows[0].name, board.pvp.rows[0].bouts], ['Gwyn', 10]);
  assert.equal(board.champion, null, `two foes are not ${ARENA_CHAMPION_MIN_FOES}`);
  assert.ok(!(await tokenOf(S, A)).claims.g?.includes('laurel'));
  // three more accounts beaten: thirteen bouts, five foes - the laurel
  for (const f of foes.slice(2)) await claimOf(S, A, await pvpReceipt(S, A, f, 0));
  _resetArenaCache();
  board = (await S.call('/v1/arena/board', {}, foes[0].secret)).body;
  assert.equal(board.champion.name, 'Gwyn');
  assert.ok(board.champion.glyphs.includes('laurel'), 'the board wears the laurel on its #1');
  const tA = await tokenOf(S, A);
  assert.ok(tA.claims.g.includes('laurel'), 'the laurel rides the token');
  assert.equal((await S.call('/v1/account/title', { title: 'arenachampion' }, A.secret)).status, 200, 'the #1 may wear the title');
  assert.equal((await tokenOf(S, A)).claims.t, 'arenachampion');
  // a newcomer beats Gwyn five times (the pair's day): the top passes - short of the bouts - and the laurel lapses with it, no cron
  const Z = await S.registered('Zora');
  for (let i = 0; i < ARENA_PAIR_DAY_MAX; i++) await claimOf(S, Z, await pvpReceipt(S, Z, A, 0));
  _resetArenaCache();
  board = (await S.call('/v1/arena/board', {}, A.secret)).body;
  assert.equal(board.pvp.rows[0].name, 'Zora', 'the top passes');
  assert.equal(board.champion, null, 'its five bouts wear no laurel - and nobody under it does');
  const after = await tokenOf(S, A);
  assert.ok(!after.claims.g?.includes('laurel'), 'the laurel lapses by itself');
  assert.equal(after.claims.t, undefined, 'and the title worn is worn no longer');
  assert.deepEqual(glyphsOf({ handle: 'x', created_at: 0, arena: { champion: true } }, {}, 1e10), ['laurel']);
  assert.equal(equipRefusal('arenachampion', { handle: 'x', arena: { champion: false } }, {}), 'not-held');
  // the law, row by row (laurelWorthy): the bouts and the foes both
  assert.equal(laurelWorthy({ bouts: 10, foes: 5 }), true);
  assert.equal(laurelWorthy({ bouts: 9, foes: 5 }), false);
  assert.equal(laurelWorthy({ bouts: 10, foes: 4 }), false);
  assert.equal(laurelOfBoard([{ player: 'b', bouts: 3, foes: 1 }, { player: 'a', bouts: 20, foes: 9 }]), null, 'the #1 short holds the top - the laurel never passes down');
});

test('ARENA4 the banners: join free, a second refused, quit at once, the other banner waits a season and the quit one takes you back; points counted from the rows by the banner worn at the claim (mutants: the season wait dropped; a loss scored; the champion scored as a bout)', async () => {
  _resetArenaCache();
  const S = await standService();
  const A = await S.registered('Jory'), B = await S.registered('Kael');
  const team = (who, banner) => S.call('/v1/arena/team', { banner }, who.secret);
  assert.equal((await team(A, 'red')).body.banner, 'red');
  assert.equal((await team(A, 'blue')).status, 409, 'one banner at a time');
  assert.equal((await team(A, 'red')).body.repeat, true);
  await claimOf(S, A, await ladderReceipt(S, A, 0, 0));
  await claimOf(S, A, await ladderReceipt(S, A, 0, 1));
  await claimOf(S, A, await ladderReceipt(S, A, 0, 2));
  const champ = await claimOf(S, A, await ladderReceipt(S, A, 0, 3));
  assert.equal(champ.body.points, 3, 'a tier\'s champion three');
  await claimOf(S, A, await ladderReceipt(S, A, 1, 0, 0));
  assert.equal((await team(B, 'blue')).body.banner, 'blue');
  await claimOf(S, B, await pvpReceipt(S, B, A, 0));
  let board = (await S.call('/v1/arena/board', {}, A.secret)).body;
  assert.deepEqual(board.team.standings, { red: 6, blue: 2 }, 'three bouts and a champion for the Red, a rated win for the Blue');
  assert.equal(board.me.banner, 'red');
  assert.equal(board.me.points, 6);
  assert.equal(board.team.rosters.red.rows[0].you, true);
  assert.equal(board.team.members.red, 1);
  assert.equal((await team(A, null)).body.left, 'red');
  const wait = await team(A, 'blue');
  assert.deepEqual([wait.status, wait.body.error], [409, 'season'], 'the other banner waits for the next season');
  assert.equal((await team(A, 'red')).body.banner, 'red', 'the banner quit takes you back at once');
  const G = await S.guest();
  assert.equal((await team(G, 'red')).status, 403);
  board = (await S.call('/v1/arena/board', {}, A.secret)).body;
  assert.equal(board.team.laurel, null, 'the first season has no last season to give a laurel');
  assert.equal(board.season, arenaSeasonOf(nowS()));
});
