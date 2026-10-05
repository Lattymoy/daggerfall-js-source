// AUDIT PRE-MERGE 1003 (2026-10-03) - lens S of the pre-merge audit of PR 545 (the Arena arc's online half): the relay,
// the account service and the trust boundary between them. Each finding pinned against the real Room over fake sockets
// and fake objects (test/fakeRoom.mjs), the real Worker over node:sqlite with every migration (test/accountDb.mjs), or
// the client's arena online over a fake session - and each failing on the unfixed tree for its finding's reason:
//   S1 one socket's sixty `in`s filled the hour's exhibition's sixty seats (59 left phantom at its close), and a socket
//      refused its seat heard the whole bout all the same;
//   S2 a token's `cl` 1000 (the realm tile's level, the client's own word) fought the Pit at 2,000 health;
//   S3 a rated players' bout took each fighter's health from the client's queue word (`lv` 999: 420 against 302);
//   S4 a ladder receipt whose bout id was already kept (a loss of mine, anybody's bout) was answered `claimed` and paid
//      the receipt's own Renown - a Grand Champion's 2,115 out of order;
//   S5 a fighter back after the healers was told `no bout` and never handed the receipt the room keeps for them;
//   S6 two players' claims of one account at once both rated off the same "before" - a loss erased by a win;
//   S7 a pair member who stood a ladder bout in `arena:b<offer id>` sent both back `busy`, re-paired, for ever;
//   S8 a Grand Champion's letter and notice wore no title (and the season's #1 no laurel).
// The record: bible/11-Multiplayer/Arena.md (the ARENA4b record, its trust).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms } from './fakeRoom.mjs';
import { standService, T0 } from './accountDb.mjs';
import { readArenaReceipt, mintArenaReceipt } from '../src/net/arenaReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import {
  ARENA_HALL, arenaBoutRoom, arenaExhibitionRoom, ARENA_FLOOR_CENTRE, ARENA_SPECTATORS_MAX, ARENA_TICK_MS, ARENA_KEEP_MS, ARENA_GONE_MS,
  pvpVitality, ladderVitality, ladderVitalityAt, ladderLevelCap, arenaLadderOf, eloAfter, ARENA_ELO_START,
} from '../src/net/arenaLaw.js';
import { exhibitionFor } from '../src/net/arenaExhibition.js';
import { wallMsForClassicMinutes, sharedClassicMinutes } from '../src/net/wire.js';
import { COUNT_MS, callMs } from '../src/systems/arenaBout.js';
import { _resetArenaCache } from '../server-account/src/arena.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';

const { subtle } = globalThis.crypto;
const C = ARENA_FLOOR_CENTRE;
const O = ARENA_TEXT.online;
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const at = (x, z = C[2]) => ({ x, y: 0.3, z, yaw: 0, pitch: 0, mv: 0 });
const settle = () => new Promise((r) => setTimeout(r, 0));

/** A world on a fake clock, from `start` (ms). */
async function onClock(fn, start = 1_800_000_000_000) {
  const realNow = Date.now;
  let clock = start;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
/** The relay's signing half, as tools/mintGateKeys.mjs mints it. */
async function relayKey() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
}
/** The beats run for `ms`. */
async function beats(R, step, ms, every = ARENA_TICK_MS) { for (let t = 0; t < ms; t += every) { step(every); await R.fire(); } }
/** Two registered fighters in the hall (their tokens' Renown level `lv`), queued with these words. */
async function hallOf(W, qa = {}, qb = {}, { lvA = 20, lvB = 30 } = {}) {
  const H = W.room(ARENA_HALL);
  const A = H.connect(), B = H.connect();
  await H.hello(A, 'peer-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ar: 1000, lv: lvA });
  await H.hello(B, 'peer-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', ar: 1040, lv: lvB });
  await word(H, A, { k: 'q', ...qa }); await word(H, B, { k: 'q', ...qb });
  return { H, A, B };
}
/** A matched pair sent to their bout (the room the `go` names), both on its sand. */
async function matchedOn(W, step, { casual = false, lvA = 20, lvB = 30 } = {}) {
  const u = casual ? { u: 1 } : {};
  const { H, A, B } = await hallOf(W, u, u, { lvA, lvB });
  step(1000); await H.fire();
  const of = last(A, 'of').o;
  await word(H, A, { k: 'y', o: of }); await word(H, B, { k: 'y', o: of });
  const o = last(A, 'go').o;
  const R = W.room(arenaBoutRoom(o));
  R.env.GATE_SIGNING_KEY = await relayKey();
  const a = R.connect(), b = R.connect();
  await R.hello(a, 'fight-alva', at(C[0] - 6), { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', lv: lvA });
  await R.hello(b, 'fight-brann', at(C[0] + 6), { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: lvB });
  await word(R, a, { k: 'in', r: 'f' }); await word(R, b, { k: 'in', r: 'f' });
  return { H, A, B, R, a, b, o, of };
}

// ── S1: a seat is a socket's once; the bout's words reach the sand and the stands alone ──
/** The hour's exhibition's room at noon of a day well inside the online era, on the shared clock. */
const NOON = 600 * 1440 + 12 * 60;
const exhibitionAt = () => {
  const W = fakeRooms();
  return { W, R: W.room(arenaExhibitionRoom(exhibitionFor(sharedClassicMinutes(Date.now())).hour)) };
};

test('AUDIT PRE-MERGE 1003 S1: ONE SOCKET TAKES ONE SEAT - sixty `in`s from one socket in the hour\'s exhibition hold one seat (they held all sixty, and its close gave back one: 59 phantom seats, the exhibition blank realm-wide); a second watcher is seated beside it; both closes leave the stands empty; a seated socket\'s `in` again is answered with the bout (mutants: the seat counted again; the bout not answered again)', () => onClock(async ({ step }) => {
  const { R } = exhibitionAt();
  const g = R.connect();
  await R.hello(g, 'seat-grief', null, { name: 'Grief', kind: 'guest', tokenSub: 'acct-grief' });   // a guest's token will do
  for (let i = 0; i < ARENA_SPECTATORS_MAX; i++) { step(70); await word(R, g, { k: 'in', r: 's' }); }   // inside the arena bucket's rate
  assert.equal((await R.room._boutOf()).spectators, 1, 'one socket, one seat');
  assert.equal(last(g, 'no'), null, 'never refused its own seat');
  assert.equal(arena(g).filter((m) => m.k === 'st').length, ARENA_SPECTATORS_MAX, 'each `in` answered with the bout');
  assert.equal(last(g, 'st').sp, 1);
  const w = R.connect();
  await R.hello(w, 'seat-honest', null, { name: 'Honest', kind: 'linked', tokenSub: 'acct-honest' });
  await word(R, w, { k: 'in', r: 's' });
  assert.equal(last(w, 'no'), null, 'the honest watcher is not told the seats are full');
  assert.equal(last(w, 'st').sp, 2, 'seated beside it');
  await R.drop(g);
  assert.equal((await R.room._boutOf()).spectators, 1);
  await R.drop(w);
  assert.equal((await R.room._boutOf()).spectators, 0, 'both gone: nobody in the stands');
}, Math.round(wallMsForClassicMinutes(NOON + 1))));

test('AUDIT PRE-MERGE 1003 S1: A REFUSED WATCHER HEARS NOTHING - the sixty-first socket told the seats are full hears no word of the bout after it (it heard every ev, mv, atk, hp and st: the fan was every hello\'d socket, seated or not), while the seated hear it all (mutants: the fan to every socket; the state to every socket)', () => onClock(async ({ step }) => {
  const { R } = exhibitionAt();
  const seated = [];
  for (let i = 0; i < ARENA_SPECTATORS_MAX; i++) {
    step(500);
    const s = R.connect();
    await R.hello(s, `seat-${i}`, null, { name: `S${i}`, kind: 'linked', tokenSub: `acct-s${i}` });
    await word(R, s, { k: 'in', r: 's' });
    seated.push(s);
  }
  step(500);
  const late = R.connect();
  await R.hello(late, 'seat-late', null, { name: 'Late', kind: 'linked', tokenSub: 'acct-late' });
  await word(R, late, { k: 'in', r: 's' });
  assert.equal(last(late, 'no')?.m, 'seats full');
  const heard0 = arena(seated[0]).length;
  await beats(R, step, 30_000);   // the law's call, the count and the fight: the stand's whole stream
  await R.drop(seated[1]);        // a seat given back: the count said to the stands
  assert.deepEqual(arena(late).map((m) => m.k), ['no'], 'the refused socket heard nothing of the bout');
  const kinds = new Set(arena(seated[0]).slice(heard0).map((m) => m.k));
  for (const k of ['ev', 'mv', 'st', 'sp']) assert.ok(kinds.has(k), `the seated hear the bout's ${k}`);
}, Math.round(wallMsForClassicMinutes(NOON + 1))));

// ── S2: the signed level is held to the tier's cap, as a claimed one is ──
test('AUDIT PRE-MERGE 1003 S2: THE SIGNED LEVEL IS CAPPED - a token\'s `cl` is the realm tile\'s summary, which the client writes itself, so it is held to the tier\'s cap as an old token\'s claim is: `cl` 1000 opening the Pit fights at the Pit\'s cap (it fought at 2,000 health, against the fallback\'s 265); a signed level under the cap stands, whatever the word says (mutants: the signed level uncapped; the cap off another tier; the word believed under the cap)', async () => {
  assert.equal(ladderVitality(1000, 1, 0), ladderVitalityAt(ladderLevelCap(0)), 'a forged thousand in the Pit');
  assert.equal(ladderVitality(1000, 1, 0), 265);
  assert.equal(ladderVitality(1000, 1, 9), ladderVitalityAt(ladderLevelCap(9)), 'and in the Grand Melee');
  assert.equal(ladderVitality(9, 1, 0), ladderVitalityAt(ladderLevelCap(0)), 'one past the Pit\'s cap is the cap');
  assert.equal(ladderVitality(5, 60, 0), ladderVitalityAt(5), 'an honest signed level under the cap stands, whatever the word says');
  assert.equal(ladderVitality(20, 1, 6), ladderVitalityAt(20), 'and in Tier 7 (its cap 21)');
  assert.equal(ladderVitality(null, 60, 0), ladderVitalityAt(ladderLevelCap(0)), 'the old token\'s fallback as it was');
  // on the relay: the token signs a thousand, the Pit's first bout opened with it
  const W = fakeRooms();
  const R = W.room(arenaBoutRoom('00000000000010a2'));
  const p = R.connect();
  await R.hello(p, 'fight-ceryn', at(C[0] - 6), { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-ceryn', charLevel: 1000 });
  await word(R, p, { k: 'in', r: 'f', tier: 0, bout: 0, lv: 1, z: 'feedc0de00000001' });
  assert.equal(R.room._attach(p).cl, 1000, 'the signed thousand carried onto the socket');
  assert.equal(last(p, 'st').f.find((f) => f[0] === 'p0')[4], ladderVitalityAt(ladderLevelCap(0)), 'the Pit\'s cap, not two thousand');
});

// ── S3: a rated bout's vitality is the token's, never the queue word's ──
test('AUDIT PRE-MERGE 1003 S3: A RATED BOUT\'S VITALITY IS THE TOKEN\'S - a queue word saying `lv` 999 from a token that signs Renown level 1 fights at pvpVitality(1) (it fought at the word\'s, held at sixty: 420 against an honest 302); the queue entry keeps the signed level (mutants: the word\'s level queued; the word read before the token)', () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { H, A, B } = await hallOf(W, { lv: 999 }, { lv: 1 }, { lvA: 1, lvB: 1 });
  assert.equal((await H.room._hallOf()).q.find((e) => e.sub === 'acct-alva').lv, 1, 'queued at the token\'s level');
  step(1000); await H.fire();
  const of = last(A, 'of').o;
  await word(H, A, { k: 'y', o: of }); await word(H, B, { k: 'y', o: of });
  const o = last(A, 'go').o;
  const R = W.room(arenaBoutRoom(o));
  const a = R.connect(), b = R.connect();
  await R.hello(a, 'fight-alva', at(C[0] - 6), { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', lv: 1 });
  await R.hello(b, 'fight-brann', at(C[0] + 6), { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: 1 });
  await word(R, a, { k: 'in', r: 'f' }); await word(R, b, { k: 'in', r: 'f' });
  const st = last(a, 'st');
  assert.equal(st.u, undefined, 'a rated bout');
  assert.deepEqual(st.f.map((f) => [f[0], f[4]]), [['p0', pvpVitality(1)], ['p1', pvpVitality(1)]], 'both at the signed level');
  // a token with no level (none signed) fights at the floor, whatever its word
  const W2 = fakeRooms();
  const H2 = W2.room(ARENA_HALL);
  const X = H2.connect();
  await H2.hello(X, 'peer-xan', null, { name: 'Xan', kind: 'linked', tokenSub: 'acct-xan', ar: 1000 });
  await word(H2, X, { k: 'q', lv: 999 });
  assert.equal((await H2.room._hallOf()).q[0].lv, 1);
}));

// ── S4: a kept bout answers `claimed` only to its own receipt ──
let _bout = 0;
const boutId = () => (0x1003_0000 + ++_bout).toString(16).padStart(16, '0');
const ladderRc = (S, who, j, tier, step, won) => mintArenaReceipt({ a: 'l', j, s: who.id, q: tier, u: step, r: won, h: won ? 'fall' : 'yield' }, S.gatePriv, { subtle, nowS: T0 });
const claimOf = (S, who, receipt) => S.call('/v1/arena/claim', { receipt, character: who.character, name: who.handle }, who.secret);
const trackOf = (S, who) => S.env.DB._raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(who.id, who.character)?.xp ?? 0;
const renownRows = (S, who) => S.env.DB._raw.prepare('SELECT bout FROM arena_renown WHERE player = ?').all(who.id).map((r) => r.bout);

test('AUDIT PRE-MERGE 1003 S4: A KEPT BOUT IS ITS OWN RECEIPT\'S - a win receipt whose bout id is already a kept loss of mine, or another account\'s bout, is refused `reused` and pays no Renown (it was answered `claimed` and paid the receipt\'s own Renown: the Grand Champion\'s 2,115 out of order); the receipt itself carried again is still `claimed`, its Renown once (mutants: the kept row\'s account, tier, step or result unread; `claimed` for any kept row; a reused win paid)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const a = await S.registered('Aldric', { renown: 30 }), b = await S.registered('Bran', { renown: 30 });
  const x0 = trackOf(S, a);
  // a loss of mine in room X, kept
  const X = boutId();
  const lost = await claimOf(S, a, await ladderRc(S, a, X, 0, 0, 0));
  assert.equal(lost.body.recorded, true);
  // X again, now "won" - at the Grand Champion's step, and at the Pit's own
  for (const [tier, step] of [[9, 3], [0, 0]]) {
    const r = await claimOf(S, a, await ladderRc(S, a, X, tier, step, 1));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.recorded, r.body.why, r.body.renown], [false, 'reused', undefined], `a win reusing my loss's id at tier ${tier} step ${step}`);
  }
  // the same loss at another step, or another tier: reused too (the kept row is not this bout)
  assert.equal((await claimOf(S, a, await ladderRc(S, a, X, 0, 1, 0))).body.why, 'reused');
  assert.equal((await claimOf(S, a, await ladderRc(S, a, X, 1, 0, 0))).body.why, 'reused');
  // another account's bout id (the hall lists every ladder bout's id to anybody)
  const Z = boutId();
  const theirs = await claimOf(S, b, await ladderRc(S, b, Z, 0, 0, 1));
  assert.deepEqual([theirs.body.recorded, theirs.body.renown.credited > 0], [true, true], 'Bran\'s own win, paid');
  const mine = await claimOf(S, a, await ladderRc(S, a, Z, 0, 0, 1));
  assert.deepEqual([mine.body.recorded, mine.body.why, mine.body.renown], [false, 'reused', undefined], 'Bran\'s bout is not mine');
  assert.equal(trackOf(S, a) - x0, 0, 'no Renown for any of it');
  assert.deepEqual(renownRows(S, a), [], 'and no bout\'s Renown taken');
  assert.deepEqual((await S.call('/v1/arena/board', {}, a.secret)).body.me.ladder.won, 0, 'the climb untouched');
  // the receipt itself carried again (its first answer lost on the way): `claimed`, its Renown once
  const again = await claimOf(S, b, await ladderRc(S, b, Z, 0, 0, 1));
  assert.deepEqual([again.body.recorded, again.body.why, again.body.renown], [false, 'claimed', undefined], 'the same receipt: claimed, the Renown already its own');
  assert.deepEqual(renownRows(S, b), [Z]);
  const lostAgain = await claimOf(S, a, await ladderRc(S, a, X, 0, 0, 0));
  assert.equal(lostAgain.body.why, 'claimed', 'my loss carried again: claimed');
});

test('AUDIT PRE-MERGE 1003 S4: THE CLIENT PAYS NO PURSE ON A REUSED BOUT - the service\'s `reused` lets the held purse go unpaid and says the realm\'s words (mutants: the words not said; `reused` paid as `claimed`)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const climbOf = (n) => arenaLadderOf(Array.from({ length: n }, (_, k) => ({ tier: Math.floor(k / 4), bout: k % 4 })));
  const board = { season: 5, day: 9, team: { standings: { red: 0, blue: 0 }, laurel: null }, hall: [], me: { ladder: climbOf(1), banner: null, left: null, leftSeason: null, points: 0 } };
  const said = [], asked = [];
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  let answer = null;
  const A = createArenaOnline({
    now: () => 0, session: () => session, makeHall: () => null, say: (l) => said.push(l), guest: () => false,
    bouts: { ask: (p) => asked.push(p), relayWord: () => true, dismiss() {}, holds: () => false, setRealm() {} },
    account: { board: async () => ({ ok: true, data: board }), claim: async () => answer, team: async () => ({ ok: false }), attempt: async (tier, bout) => ({ ok: true, data: { ticket: 'feedc0de00000002', tier, bout } }), me: () => 'acct-alva' },
    enterFloor: () => true, level: () => 12, maxHealth: () => 140, inBout: () => false,
  });
  A.model();
  await settle();
  assert.equal(A.fightLadder().ok, true);
  const relay = asked.at(-1).relay;
  session.room = `arena:b${relay.o}`;
  answer = { ok: true, data: { recorded: false, why: 'reused', ladder: climbOf(1) } };
  A.word({ k: 'rc', r: await mintArenaReceipt({ a: 'l', j: relay.o, s: 'acct-alva', q: 0, u: 1, r: 1, h: 'fall' }, priv, { subtle, nowS: Math.floor(Date.now() / 1000) }) }, `arena:b${relay.o}`);
  await settle(); await settle();
  let paid = 0;
  relay.owe(50, (g) => { paid += g; });
  assert.equal(paid, 0, 'a reused bout\'s win pays no purse');
  assert.equal(typeof O.reused, 'string');
  assert.ok(said.includes(O.reused), 'the realm\'s words');
});

// ── S5: a finished bout's fighter back inside the keep is answered with it ──
test('AUDIT PRE-MERGE 1003 S5: A LADDER WIN SURVIVES A BLIP - a fighter whose socket went as the last blow landed, back 20 s and 5 minutes after the end (the healers long done, the room keeping the receipt ARENA_KEEP_MS), is answered with the finished bout and its receipt (it was told `no bout`, the win lost); a stranger is still told `no bout` (mutants: the receipt not handed back; the reconnect answered `no bout`; the stranger answered as a fighter)', () => onClock(async ({ step, now }) => {
  const W = fakeRooms();
  const o = '0000000000001005';
  const R = W.room(arenaBoutRoom(o));
  R.env.GATE_SIGNING_KEY = await relayKey();
  const who = { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-ceryn', charLevel: 5 };
  const p = R.connect();
  await R.hello(p, 'fight-ceryn', at(C[0] - 6), who);
  await word(R, p, { k: 'in', r: 'f', tier: 0, bout: 0, z: 'feedc0de00000001' });
  // stand and strike until the Pit's first fighter falls - and the socket goes with the blow, before the beat that ends it
  let fell = false;
  for (let i = 0; i < 600 && !fell; i++) {
    step(300); await R.pose(p, at(C[0] - 6)); await R.fire();
    const st = await R.room._boutOf();
    if (st.b?.phase !== 'fight') continue;
    await word(R, p, { k: 'hit', i: 'a0', d: 40, r: 0, w: 116, m: 1, q: 1000 + i });
    fell = !!st.b.fighters.find((f) => f.id === 'a0').out;
  }
  assert.ok(fell, 'the Pit\'s first fighter fell');
  await R.drop(p);
  await beats(R, step, 2000);
  const st = await R.room._boutOf();
  assert.ok(Number.isFinite(st.endAt) && st.rc?.['acct-ceryn'], 'the bout ended and its receipt is held for Ceryn');
  assert.equal(last(p, 'rc'), null, 'minted while the socket was away');
  assert.equal(readArenaReceipt(st.rc['acct-ceryn']).r, 1, 'a win');
  for (const away of [20_000, 5 * 60_000]) {
    await beats(R, step, st.endAt + away - now(), 1000);
    assert.equal((await R.room._boutOf()).b.phase, 'done', 'the healers are past');
    const back = R.connect();
    await R.hello(back, 'fight-ceryn', at(C[0] - 6), who);
    await word(R, back, { k: 'in', r: 'f' });
    assert.equal(last(back, 'no'), null, `back ${away / 1000} s after the end: not "no bout"`);
    assert.deepEqual([last(back, 'st')?.ph, last(back, 'st')?.me, last(back, 'st')?.res?.side], ['done', 'p0', 0], 'the finished bout, as its fighter');
    assert.equal(last(back, 'rc')?.r, st.rc['acct-ceryn'], 'and its receipt');
    await R.drop(back);
  }
  assert.ok(ARENA_KEEP_MS > 5 * 60_000);
  const stranger = R.connect();
  await R.hello(stranger, 'seat-odo', null, { name: 'Odo', kind: 'linked', tokenSub: 'acct-odo' });
  await word(R, stranger, { k: 'in', r: 's' });
  assert.equal(last(stranger, 'no')?.m, 'no bout', 'a stranger to the finished bout');
  assert.equal(last(stranger, 'st'), null);
}));

test('AUDIT PRE-MERGE 1003 S5: A FORFEITED FIGHTER BACK SEES ITS END - gone mid-fight, forfeited, back ~27 s later inside the keep: the finished bout as its own (`st` done, the result) and its receipt (it was told `no bout`); a casual bout\'s the same with no receipt (mutants: the arm for exhibitions alone; the fighter\'s id not said)', () => onClock(async ({ step }) => {
  for (const casual of [false, true]) {
    const W = fakeRooms();
    const { R, a, b } = await matchedOn(W, step, { casual });
    await beats(R, step, callMs({ fighters: Array(2) }) + 300 + COUNT_MS + 600);
    assert.equal(last(a, 'st').ph, 'fight');
    await R.drop(b);
    await beats(R, step, 27_000);
    const st = await R.room._boutOf();
    assert.equal(st.b.phase, 'done', 'the forfeit called and the healers past');
    assert.equal(st.res.how, 'forfeit');
    assert.ok(27_000 > ARENA_GONE_MS);
    const back = R.connect();
    await R.hello(back, 'fight-brann', at(C[0] + 6), { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: 30 });
    await word(R, back, { k: 'in', r: 'f' });
    assert.equal(last(back, 'no'), null, `${casual ? 'casual' : 'rated'}: not "no bout"`);
    const s = last(back, 'st');
    assert.deepEqual([s?.ph, s?.me, s?.res?.side, s?.res?.how], ['done', 'p1', 0, 'forfeit'], 'its own end');
    if (casual) assert.equal(last(back, 'rc'), null, 'a casual bout owes no receipt');
    else assert.deepEqual([last(back, 'rc')?.r, readArenaReceipt(last(back, 'rc').r).h], [st.rc['acct-brann'], 'forfeit'], 'and its receipt');
  }
}));

// ── S6: a players' bout is rated off the ratings as they stand at its write ──
test('AUDIT PRE-MERGE 1003 S6: TWO CLAIMS AT ONCE, ONE RATING - an account\'s loss and win claimed together (each statement a few ms, as D1\'s are) land as if one after the other, the account on either side of the bout: the second rated off the first\'s after, the account at the sequential result, the ratings\' sum kept (the win erased the loss: 1016 and a sum of 3016) (mutants: the write unguarded; either side\'s guard dropped; one try only)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // side 0: Aldric first in both receipts; side 1: Aldric second in both
  for (const side of [0, 1]) {
    const S = await standService();
    const a = await S.registered('Aldric'), b = await S.registered('Bran'), c = await S.registered('Cyra');
    const DB = S.env.DB, prep = DB.prepare.bind(DB);
    DB.prepare = (sql) => {
      const wrap = (api) => ({ ...api, bind: (...x) => wrap(api.bind(...x)), first: async () => { await sleep(3); return api.first(); }, all: async () => { await sleep(3); return api.all(); }, run: async () => { await sleep(3); return api.run(); } });
      return wrap(prep(sql));
    };
    // `r` 0 the first named won; Aldric loses to Bran and beats Cyra
    const players = (x, y, r, j) => mintArenaReceipt({ a: 'p', j, f: [x.id, y.id], r, h: 'fall' }, S.gatePriv, { subtle, nowS: T0 });
    const lossRc = side === 0 ? await players(a, b, 1, '0000000000100e01') : await players(b, a, 0, '0000000000100e01');
    const winRc = side === 0 ? await players(a, c, 0, '0000000000100e02') : await players(c, a, 1, '0000000000100e02');
    const [l, w] = await Promise.all([S.call('/v1/arena/claim', { receipt: lossRc }, a.secret), S.call('/v1/arena/claim', { receipt: winRc }, a.secret)]);
    assert.deepEqual([l.status, l.body.recorded, w.status, w.body.recorded], [200, true, 200, true], JSON.stringify([l.body, w.body]));
    DB.prepare = prep;
    const rows = DB._raw.prepare('SELECT bout, ra0, rb0, ra1, rb1 FROM arena_pvp ORDER BY rowid').all();
    assert.equal(rows.length, 2);
    const mine0 = (row) => (side === 0 ? row.ra0 : row.rb0), mine1 = (row) => (side === 0 ? row.ra1 : row.rb1);
    assert.equal(mine0(rows[0]), ARENA_ELO_START);
    assert.equal(mine0(rows[1]), mine1(rows[0]), `side ${side}: the second bout rated off the first's after`);
    const won = rows[1].bout === '0000000000100e02';
    const [na, nx] = eloAfter(mine1(rows[0]), ARENA_ELO_START, won ? 1 : 0);
    assert.deepEqual([mine1(rows[1]), side === 0 ? rows[1].rb1 : rows[1].ra1], [na, nx], 'the sequential result');
    const rating = async (who) => (await S.call('/v1/arena/board', {}, who.secret)).body.me.pvp.rating;
    const ra = await rating(a), rb = await rating(b), rc = await rating(c);
    assert.equal(ra, mine1(rows[1]));
    assert.ok(ra === 999 || ra === 1001, `Aldric W1 L1 against two 1000s: ${ra}`);
    assert.equal(ra + rb + rc, 3 * ARENA_ELO_START, 'Elo keeps the sum');
  }
});

// ── S7: the offer's id never names the bout's room ──
test('AUDIT PRE-MERGE 1003 S7: THE ROOM IS MINTED AT THE GO - a pair member who stands a ladder bout in `arena:b<offer id>` before saying yes does not stop the bout: both are sent to a room of its own, told only once it is open (both were told `busy` and re-paired, for ever) (mutants: the room named by the offer\'s id)', () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { A, B, H } = await hallOf(W, {}, {});
  step(1000); await H.fire();
  const of = last(B, 'of').o;
  const S = W.room(arenaBoutRoom(of));
  const s = S.connect();
  await S.hello(s, 'peer-alva-b', at(C[0]), { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva' });
  await word(S, s, { k: 'in', r: 'f', tier: 0, bout: 0, z: 'feedc0de00000001' });
  assert.equal((await S.room._boutOf()).kind, 'pve', 'the offered id\'s room squatted by a ladder bout');
  await word(H, A, { k: 'y', o: of }); await word(H, B, { k: 'y', o: of });
  const ga = last(A, 'go'), gb = last(B, 'go');
  assert.equal(last(B, 'qx'), null, 'not sent back busy');
  assert.ok(ga && gb, 'both sent to the bout');
  assert.equal(ga.o, gb.o, 'one bout');
  assert.notEqual(ga.o, of, 'its room is not the offer\'s id');
  assert.match(ga.o, /^[0-9a-f]{16}$/);
  assert.equal((await W.room(arenaBoutRoom(ga.o)).room._boutOf()).kind, 'pvp', 'the hall opened it, a players\' bout');
  await word(H, A, { k: 'ls' });
  assert.ok(last(A, 'live').l.some((e) => e.o === ga.o && e.kind === 'pvp'), 'listed by its room');
}));

// ── S8: the arena's honours on a letter and a notice ──
test('AUDIT PRE-MERGE 1003 S8: A GRAND CHAMPION\'S LETTER WEARS THE TITLE - the sender\'s badge on the inbox and the opened letter, and an author\'s on the town\'s board, carry the arena\'s honours: `grandchampion` worn, and the season\'s #1 the laurel (both were dropped - the honours rode the token\'s mint and the wardrobe alone) (mutants: the Grand Champions unread; the laurel unread; the honours on the inbox alone)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  _resetArenaCache();
  const S = await standService({ BOARD_OPEN: 'on' });
  const a = await S.registered('Aldric'), b = await S.registered('Bran'), c = await S.registered('Cyra');
  // Aldric's climb won whole (one row is the honour's - arenaHonoursOf reads the Grand Champion's own), the title worn
  S.env.DB._raw.prepare(`INSERT INTO arena_pve (bout, player, season, tier, step, won, how, banner, at) VALUES ('${'c'.repeat(16)}', ?, 1, 9, 3, 1, 'fall', NULL, ?)`).run(a.id, T0);
  const eq = await S.call('/v1/account/title', { title: 'grandchampion' }, a.secret);
  assert.equal(eq.body.title, 'grandchampion', JSON.stringify(eq.body));
  assert.equal((await S.call('/v1/mail/send', { to: 'Bran', subject: 'Hail', body: 'from the sand' }, a.secret)).status, 200);
  const get = async (path, who) => { const r = await S.fetch(`https://accounts.invalid${path}`, { method: 'GET', headers: { authorization: `Bearer ${who.secret}` } }); return r.json(); };
  const inbox = await get('/v1/mail/inbox', b);
  assert.equal(inbox.letters[0].title, 'grandchampion', 'the inbox shows the Grand Champion');
  const opened = await S.call('/v1/mail/read', { id: inbox.letters[0].id }, b.secret);
  assert.equal(opened.body.letter?.title, 'grandchampion', `the opened letter too: ${JSON.stringify(opened.body)}`);
  // the season's #1: the laurel on Cyra's letter - AUDIT ARENA-LADDER O2: ten rated wins over five accounts (two each)
  const beaten = [b];
  for (const n of ['Dain', 'Eddra', 'Fenn', 'Gisla']) beaten.push(await S.registered(n));
  for (let i = 0; i < 10; i++) {
    const rc = await mintArenaReceipt({ a: 'p', j: (0x10038000 + i).toString(16).padStart(16, '0'), f: [c.id, beaten[i % 5].id], r: 0, h: 'fall' }, S.gatePriv, { subtle, nowS: T0 });
    assert.equal((await S.call('/v1/arena/claim', { receipt: rc }, c.secret)).body.recorded, true);
  }
  _resetArenaCache();
  assert.equal((await S.call('/v1/mail/send', { to: 'Bran', subject: 'Laurel', body: 'mine' }, c.secret)).status, 200);
  const inbox2 = await get('/v1/mail/inbox', b);
  const fromCyra = inbox2.letters.find((l) => l.from === 'Cyra');
  assert.ok(fromCyra.glyphs.includes('laurel'), `the season's #1 wears the laurel: ${JSON.stringify(fromCyra)}`);
  assert.equal(inbox2.letters.find((l) => l.from === 'Aldric').glyphs.includes('laurel'), false, 'and nobody else');
  // a notice on the town's board
  const TOWN = 1234567;
  S.env.DB._raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(T0 - 30 * 86400, a.id);
  const pin = await S.call('/v1/board/pin', { map: TOWN, subject: 'Challengers wanted', body: 'At the colosseum.', days: 7, rid: 'aud1003-s8-0001' }, a.secret);
  assert.equal(pin.status, 200, JSON.stringify(pin.body));
  const read = await S.call('/v1/board/read', { map: TOWN }, b.secret);
  assert.equal(read.body.notes.find((n) => n.from === 'Aldric')?.title, 'grandchampion', 'the notice shows the Grand Champion');
  _resetArenaCache();
});
