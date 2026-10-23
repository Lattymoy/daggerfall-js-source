// AUDIT KG II (2026-10-15, bible/01-Overview/audits/Audit-Kings-Gambit-II.md, lane B): THE KING'S GAMBIT ONLINE, ON THE
// CLIENT, FOUND AND FIXED - the gold table's Ready (one stake on its way, never past a Ready, never a pick the other
// seat's stake closed, the realm's own refusal said), a watcher (no stake, no gold line, no armed Stand up, a Sit when a
// seat comes free, both sides' actions shown apart, no deal's muster for a game opened under way), a seated player's
// deal said with its stake, a press held while one is on its way, a game ended while the socket was away read off the
// table's `last`, a seat stood up by the clock reading its own loss, a stand the link would not carry said again, a
// watched board let go with its table. Each was a lane B repro of the frozen snapshot, kept here the right way up.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGambitTableGame } from '../../src/scenes/gambitTableGame.js';
import {
  newGambitTable, gambitSit, gambitReady, gambitTick, gambitStand, gambitForfeit, gambitCommand, gambitPublicView,
  validGambitOut, GAMBIT_FIRST_MS, GAMBIT_TURN_END_MS, GAMBIT_TURN_MS, GAMBIT_REMOTE_GAP_MS,
} from '../../src/net/gambit/gambitTable.js';
import { createCardStakes, CARD_VOID_AFTER_MS } from '../../src/net/card/cardStakes.js';
import { RemoteGambitSession, RemoteGambitTable, GAMBIT_HELD_MAX } from '../../src/systems/gambit/gambitRemoteTable.js';
import { createGambitMotion } from '../../src/world/gambitMotion.js';
import { autoFill, reachable, KG_POINT_BUDGET } from '../../src/net/kingsGambit.js';
import { GAMBIT_RESULT_MS } from '../../src/systems/gambit/gambitTableSession.js';
import { stakeRefusal } from '../../src/ui/gambitTableWords.js';
import { CARD_TABLE_W, CARD_TABLE_D } from '../../src/world/card/cardTableProp.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { xorshift } from '../../tools/kgMeasure.mjs';
import { fakeDoc, text } from '../decorFakes.mjs';
import { fakeRoom } from '../fakeRoom.mjs';

beforeEach(() => resetPrefs());
const FRAME = { centre: [0, 0.8, 0], axisYaw: Math.PI / 2, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 };
const CHAIRS = [[0, 0, -0.9], [0.9, 0, 0], [0, 0, 0.9], [-0.9, 0, 0]];
const buttons = (n, out = []) => { if (n.tag === 'button') out.push(n); for (const c of n.children ?? []) buttons(c, out); return out; };
const tick0 = () => new Promise((r) => setTimeout(r, 0));
const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));

/** The gold table's panel on a fake relay link: its words sent, its frames handed in. */
function panel({ myId, purse = () => 300, stake, seated = () => {}, said = [], onStand = () => {}, standDue = () => {} }) {
  let local = 0;
  const renderer = { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} };
  const sent = [];
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer, entity: { name: myId, items: [], goldPieces: 0 }, say: (t) => said.push(t), holdCursor: () => () => true, relock() {},
    rand32: () => 7, now: () => local, day: () => 1, key: 'k', friendly: true, regulars: [], frame: FRAME, mySeatFeet: CHAIRS[3], touch: () => false,
    onHoldem() {}, onIliac() {}, onStand,
    online: {
      send: (w) => { sent.push(w); return true; }, myId: () => myId, now: () => 1e12, table: 1, chairs: 4, chair: 3, chairFeet: (k) => CHAIRS[k],
      gold: true, purse, seated, standDue, stake: stake ?? (async (n) => ({ ok: true, stake: `order-${n}`, id: `stake-${n}` })),
    },
  });
  const frame = (state, events = []) => g.relay({ t: 'gambit', table: 1, now: 1e12, events, state });
  const step = (ms) => { local += ms; g.frame(local); };
  return { g, sent, frame, step, said };
}
const view = (seats) => ({ chairs: 4, gameNo: 0, seats, game: null, clockAt: 0, last: null, gold: true });
/** A gold game dealt at the relay's table, and the frames the room was told. */
function goldGame(seed = 3) {
  const t = newGambitTable({ chairs: 4, gold: true }), rand32 = xorshift(seed), frames = [];
  const keep = (m) => { for (const x of m) frames.push({ t: 'gambit', table: 1, now: 1e12, ...x.frame }); return m; };
  keep(gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0, sub: 'acct-a' }));
  keep(gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0, sub: 'acct-b' }));
  keep(gambitReady(t, { id: 'a', army: army(seed), now: 0, stake: { j: 'ja', sub: 'acct-a', amount: 50 } }));
  keep(gambitReady(t, { id: 'b', army: army(seed + 1), now: 0, stake: { j: 'jb', sub: 'acct-b', amount: 50 } }));
  keep(gambitTick(t, GAMBIT_FIRST_MS, rand32));
  return { t, rand32, frames, keep };
}

test('AUDIT KG II B1 ONE STAKE ON ITS WAY: Ready pressed again before the relay sits the first asks the realm nothing; a Ready the relay refuses lets its stake go to be voided back, never booked as sat (mutants: the pending stake; the refusal\'s clearing)', async () => {
  const store = new Map();
  let clock = 1_000_000, gold = 300, n = 0;
  const door = [];
  const book = createCardStakes({
    door: { stake: () => new Promise((res) => door.push(() => { n++; res({ ok: true, data: { stake: `order-${n}`, id: `stake-${n}` } }); })), cashout: async () => ({ ok: false }) },
    realm: { act: async (o) => { o.reserve?.(); const r = await o.call('at'); o.apply?.(r); return r; } },
    wallet: () => ({ gold: () => gold, pay: (x) => { gold -= x; return () => { gold += x; }; }, bank: (x) => { gold += x; } }),
    character: () => 'c1', region: () => 0, storage: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => clock,
  });
  const P = panel({ myId: 'me', purse: () => gold, stake: (amount) => book.stake({ room: 'r', table: 1, bb: 1, amount }), seated: (id) => book.seated(id) });
  const me = { id: 'me', name: 'Ves', chair: 3, crown: 0 }, oth = { id: 'o', name: 'Oth', chair: 1, crown: 1 };
  P.frame(view([oth, me]));
  P.g.press('autofill'); P.g.press('stake', 50);
  P.g.press('ready');
  await tick0(); door.shift()(); await tick0(); await tick0();
  assert.equal(P.sent.at(-1).stake, 'order-1', 'the first Ready went with its order');
  P.g.press('ready');   // before the relay's word
  await tick0();
  assert.equal(door.length, 0, 'the realm is not asked again while a stake is on its way');
  P.frame(view([oth, { ...me, ready: true, stake: 50 }]), [{ t: 'ready', seat: 1 }]);
  assert.deepEqual(book.kept().stakes.map((x) => [x.id, !!x.sat]), [['stake-1', true]], 'the stake the relay sat, booked sat');
  assert.equal(gold, 250);
  // Not ready (the relay sends the stake home), Ready again, and the relay refuses it unspent: never booked sat
  P.frame(view([oth, me]), [{ t: 'unready', seat: 1 }]);
  P.g.press('ready');
  await tick0(); door.shift()(); await tick0(); await tick0();
  assert.equal(P.sent.at(-1).stake, 'order-2');
  P.g.relay({ t: 'gambit', table: 1, now: 1e12, error: 'stake refused' });
  P.frame(view([{ ...oth, ready: true, stake: 50 }, { ...me, ready: true, stake: 50 }]), [{ t: 'ready', seat: 0 }]);
  assert.equal(book.kept().stakes.find((x) => x.id === 'stake-2')?.sat, undefined, 'a refused stake is never booked sat');
  clock += CARD_VOID_AFTER_MS + 1;
  assert.deepEqual(book.voidable('r').map((x) => x.id), ['stake-2'], 'so it is voided back');
});

test('AUDIT KG II B8 + B16 A PICK THE OTHER SEAT CLOSED: Ready says why and asks the realm nothing; a stake the realm refused is said in the realm\'s own word (mutants: the pick\'s check; the words)', async () => {
  const asked = [];
  const P = panel({ myId: 'me', stake: async (n) => { asked.push(n); return { ok: false, error: 'realm-gold' }; } });
  const me = { id: 'me', name: 'Ves', chair: 3, crown: 0 }, oth = { id: 'o', name: 'Oth', chair: 1, crown: 1 };
  P.frame(view([oth, me]));
  P.g.press('autofill'); P.g.press('stake', 200);
  P.frame(view([{ ...oth, ready: true, stake: 50 }, me]), [{ t: 'ready', seat: 0 }]);
  const ready = buttons(P.g.g.hud.root).find((x) => /^Ready/.test(x.textContent));
  assert.equal(ready.attrs['aria-disabled'], 'true', 'Ready waits on another pick');
  P.g.press('ready');
  await tick0();
  assert.deepEqual(asked, [], 'the realm holds nothing for a Ready the relay would refuse');
  assert.match(P.g.g.why, /Oth stakes 50 gold\. Match it to play/);
  P.g.press('stake', 50); P.g.press('ready');
  await tick0(); await tick0();
  assert.deepEqual(asked, [50]);
  assert.equal(P.g.g.why, 'Your purse cannot cover that stake.');
  assert.equal(stakeRefusal({ ok: false, error: 'offline', unknown: true }), 'The realm did not answer. Your stake will be settled when it does.');
  assert.equal(stakeRefusal({ ok: false, error: 'cards-closed' }), 'The realm is not holding stakes right now.');
  assert.equal(stakeRefusal({ ok: false, error: 'mystery' }), 'The realm could not take your stake. Try again.');
});

test('AUDIT KG II B4 + B5 + B6 THE GOLD GAME, WATCHED AND PLAYED: a watcher stakes nothing (the save is not held), is told no gold line, and stands up at one press; a seated player\'s deal says its stake (mutants: the watcher\'s stake; the gold line; the deal\'s stake; the armed stand)', () => {
  const { t, frames, keep } = goldGame();
  let stood = 0;
  const W = panel({ myId: 'w', onStand: () => { stood++; } });
  for (const f of frames) W.g.relay(f);
  assert.equal(W.g.g.phase, 'battle');
  assert.equal(W.g.staked(), false, 'a watcher\'s save is never held');
  for (const x of keep(gambitForfeit(t, { id: 'b', gameNo: t.gameNo, now: 10 }))) W.g.relay({ t: 'gambit', table: 1, now: 1e12, ...x.frame });
  W.step(10); W.step(GAMBIT_RESULT_MS + 10);
  const words = text(W.g.g.hud.root);
  assert.match(words, /Ana wins/);
  assert.doesNotMatch(words, /You collect the pot|for fun|no gold changed hands/, 'no gold line for a watcher');
  const said = [];
  const A = panel({ myId: 'a', said });
  for (const f of goldGame().frames) A.g.relay(f);
  assert.equal(A.g.staked(), true, 'a seated player\'s save waits on the stake');
  assert.ok(said.includes('You put down 50 gold and sit down to The King\'s Gambit with Bors.'), said.join(' | '));
  const W2 = panel({ myId: 'w', onStand: () => { stood++; } });
  for (const f of goldGame().frames) W2.g.relay(f);
  W2.g.press('stand');
  assert.equal(stood, 1, 'a watcher stands up at once - nothing of theirs is down');
});

test('AUDIT KG II B7 A WATCHED GAME ENDED WITH A SEAT FREE: the watcher is offered Sit at the board, and it sits (mutants: the press; the sit)', () => {
  const { t, frames, keep } = goldGame();
  const W = panel({ myId: 'w' });
  for (const f of frames) W.g.relay(f);
  for (const x of keep(gambitStand(t, { id: 'b', now: 10 }))) W.g.relay({ t: 'gambit', table: 1, now: 1e12, ...x.frame });
  W.step(10); W.step(GAMBIT_RESULT_MS + 10);
  assert.equal(W.g.g.phase, 'over');
  assert.match(text(W.g.g.hud.root), /Sit at the board to play another player/);
  assert.ok(buttons(W.g.g.hud.root).some((x) => x.textContent === 'Sit at the board'), 'the line\'s press is offered');
  W.g.press('sit');
  assert.equal(W.sent.filter((w) => w.op === 'sit').length, 1);
  assert.equal(W.g.g.session, null, 'the watched game let go');
  for (const x of keep(gambitSit(t, { id: 'w', name: 'Wen', chair: 3, crown: 0, now: 20, sub: 'acct-w' }))) W.g.relay({ t: 'gambit', table: 1, now: 1e12, ...x.frame });
  assert.equal(W.g.g.phase, 'army', 'seated: the army is built');
});

test('AUDIT KG II B12 A STAND THE LINK WOULD NOT CARRY: the host is told it is due (said again each frame), and a sit takes it back (mutants: the due mark)', () => {
  const due = [];
  let up = false;
  const renderer = { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} };
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer, entity: { name: 'me', items: [], goldPieces: 0 }, say() {}, holdCursor: () => () => true, relock() {},
    rand32: () => 7, now: () => 0, day: () => 1, key: 'k', friendly: true, regulars: [], frame: FRAME, mySeatFeet: CHAIRS[3], touch: () => false,
    onHoldem() {}, onIliac() {}, onStand() {},
    online: { send: (w) => (w.op === 'stand' ? up : true), myId: () => 'me', now: () => 0, table: 1, chairs: 4, chair: 3, chairFeet: (k) => CHAIRS[k], standDue: (x) => due.push(x) },
  });
  g.relay({ t: 'gambit', table: 1, now: 0, events: [], state: view([null, { id: 'me', name: 'Ves', chair: 3, crown: 0 }]) });
  g.press('leave');
  assert.deepEqual(due, [true], 'a refused stand is due');
  g.relay({ t: 'gambit', table: 1, now: 0, events: [], state: view([null, null]) });   // (stood up some other way)
  g.press('sit');
  assert.deepEqual(due, [true, false], 'a sit takes it back');
  up = true;
  g.relay({ t: 'gambit', table: 1, now: 0, events: [], state: view([null, { id: 'me', name: 'Ves', chair: 3, crown: 0 }]) });
  g.close();
  assert.deepEqual(due, [true, false, false], 'a stand that went owes nothing');
  const wm = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /for \(const \[i, ctx\] of gambitStandsDue\) if \(ctx !== interiorCtx \|\| host\.gambitOnline\?\.send\?\.\(\{ op: 'stand', table: i \}\)\) gambitStandsDue\.delete\(i\);/, 'the host says it again each frame, as Hold\'em\'s');
});

test('AUDIT KG II B10 + B18 + B11 THE SESSION: a watcher\'s board shows both sides\' actions apart; a game opened under way says no deal\'s muster; a press made while one is on its way is held and sent once the board is told, checked again (mutants: the watcher\'s gap; midway; the held press)', () => {
  const t = newGambitTable({ chairs: 4 }), rand32 = xorshift(5);
  gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0 }); gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 2, now: 0 });
  gambitReady(t, { id: 'a', army: army(5), now: 0 }); gambitReady(t, { id: 'b', army: army(6), now: 0 });
  gambitTick(t, GAMBIT_FIRST_MS, rand32);
  const w = new RemoteGambitSession({ side: 0, game: t.game, gameNo: 1, send: () => true, forfeit: () => true, now: 0, watch: true, midway: true });
  assert.equal(w.drain()[0].midway, true);
  const motion = createGambitMotion({ pick: () => 0 });
  motion.feed([{ t: 'game', layout: w.state.layout, midway: true, at: 0 }], 0, w.state);
  assert.deepEqual(motion.sounds(10_000), [], 'no StartBattle for a board come upon mid-game');
  for (let k = 0; k < 2; k++) {
    const p = t.game.pieces.find((x) => x.side === 0 && !x.king && reachable(t.game, x).length);
    const [c, r2] = reachable(t.game, p)[0];
    const m = gambitCommand(t, { id: 'a', cmd: { type: 'move', piece: p.id, col: c, row: r2 }, gameNo: 1, now: 100, rand32 });
    w.feed(m[0].frame.events, m[0].frame.state);
  }
  w.tick(1000);
  assert.equal(w.drain().filter((e) => e.t === 'move').length, 1, 'the host\'s first move');
  w.tick(1000 + GAMBIT_REMOTE_GAP_MS);
  assert.equal(w.drain().filter((e) => e.t === 'move').length, 1, 'and its second, its gap after');
  // a player's press while its command is on its way: held, then sent on the board as told
  const t2 = newGambitTable({ chairs: 4 }), r2 = xorshift(7);
  gambitSit(t2, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0 }); gambitSit(t2, { id: 'b', name: 'Bors', chair: 2, crown: 2, now: 0 });
  gambitReady(t2, { id: 'a', army: army(7), now: 0 }); gambitReady(t2, { id: 'b', army: army(8), now: 0 });
  gambitTick(t2, GAMBIT_FIRST_MS, r2);
  const sent = [];
  const s = new RemoteGambitSession({ side: 0, game: t2.game, gameNo: 1, send: (c) => { sent.push(c); return true; }, forfeit: () => true, now: 0 });
  const p = s.state.pieces.find((x) => x.side === 0 && !x.king && reachable(s.state, x).length);
  const [c, row] = reachable(s.state, p)[0];
  assert.equal(s.act({ type: 'move', piece: p.id, col: c, row }, 10), null);
  assert.equal(s.act({ type: 'move', piece: p.id, col: c, row }, 11), null, 'the same move again, held');
  assert.equal(s.act({ type: 'end' }, 12), null, 'End turn at once, held');
  assert.equal(sent.length, 1);
  const m = gambitCommand(t2, { id: 'a', cmd: sent[0], gameNo: 1, now: 20, rand32: r2 });
  s.feed(m[0].frame.events, m[0].frame.state);
  s.drain();
  s.tick(30);
  assert.deepEqual(sent.map((x) => x.type), ['move', 'end'], 'the held move, refused on the board as told, is said; the End goes');
  assert.ok(s.drain().some((e) => e.t === 'refused' && e.why === 'cell' && e.cmd.piece === p.id), 'the move to where it stands, the law\'s word');
  for (let k = 0; k < GAMBIT_HELD_MAX + 2; k++) s.act({ type: 'end' }, 40);
  assert.equal(s.held.length, GAMBIT_HELD_MAX, 'a turn\'s worth held, no more');
});

test('AUDIT KG II B13 A WATCHED BOARD LET GO WITH ITS TABLE: the last stand\'s frame (both seats empty) closes the watch; the host\'s chair kept past its stand (source pins)', () => {
  const wm = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /if \(!st\?\.game && !\(st\?\.seats \?\? \[\]\)\.some\(Boolean\)\) closeGambitWatch\(f\.table\);/);
  assert.match(wm, /seats\[st\.seats\?\.\[0\]\?\.chair \?\? w\.hostChair \?\? 0\]/);
  assert.doesNotMatch(wm, /the red table plays no King's Gambit online before KG6/, 'AUDIT KG II B9: the red table\'s board is asked on approach');
  // the frame the source reads: both seats empty once the last stands
  const t = newGambitTable({ chairs: 4 }), rand32 = xorshift(3), r = new RemoteGambitTable({ myId: null });
  const told = (m) => { for (const x of m) r.apply({ t: 'gambit', table: 1, now: 0, ...x.frame }, 0); };
  told(gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0 })); told(gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 0 }));
  told(gambitReady(t, { id: 'a', army: army(3), now: 0 })); told(gambitReady(t, { id: 'b', army: army(4), now: 0 }));
  told(gambitTick(t, GAMBIT_FIRST_MS, rand32)); told(gambitForfeit(t, { id: 'b', gameNo: t.gameNo, now: 10 }));
  told(gambitStand(t, { id: 'a', now: 20 })); told(gambitStand(t, { id: 'b', now: 30 }));
  assert.deepEqual(r.state.seats, [null, null]);
  assert.equal(r.state.game, null);
});

// ── over the relay itself (server/src/index.js on the fake room) ────────────────────────────────────────────────

const ROOM = 'interior:m100.200';
async function withRoom(fn) {
  const r = fakeRoom(ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms) => { clock += ms; }, clock: () => clock }); } finally { Date.now = realNow; }
}
/** test/net/kg5_client.test.js's page, its socket able to drop and come back (a new welcome, as online.js counts them). */
async function page(R, id, chair, clock) {
  let ws = R.connect(); await R.hello(ws, id, null, { name: id });
  const out = [], said = [];
  let seen = 0, local = 0, welcomes = 1;
  const renderer = { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} };
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer, entity: { name: id, items: [], goldPieces: 100 }, say: (t) => said.push(t), holdCursor: () => () => true, relock() {},
    rand32: xorshift(9), now: () => local, day: () => 100, key: 'town:7:0', friendly: true, regulars: [{ name: 'Cael', seed: 3, chair: 3 }],
    frame: FRAME, mySeatFeet: CHAIRS[chair], touch: () => false, onHoldem() {}, onIliac() {}, onStand() {},
    online: { send: (w) => { if (!ws) return false; out.push(w); return true; }, myId: () => id, now: clock, table: 0, chairs: 4, chair, chairFeet: (k) => CHAIRS[k], welcomes: () => welcomes },
  });
  const pump = async () => {
    while (out.length) { const w = out.shift(); await R.raw(ws, JSON.stringify({ t: 'gambit', ...w })); }
    const frames = ws.sent.filter((m) => m.t === 'gambit');
    for (; seen < frames.length; seen++) { assert.ok(validGambitOut(frames[seen])); g.relay(frames[seen]); }
  };
  const step = (ms) => { local += ms; g.frame(local); };
  const drop = async () => { await R.drop(ws); ws = null; };
  const back = async () => { ws = R.connect(); await R.hello(ws, id, null, { name: id }); seen = 0; welcomes++; };
  return { get ws() { return ws; }, g, said, pump, step, drop, back };
}
const shown = (p) => text(p.g.g.hud.root);
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) find(c, cls, out); return out; };
async function seatedAndDealt(r, tick, clock) {
  const A = await page(r, 'peer-a', 0, clock), B = await page(r, 'peer-b', 2, clock);
  await A.pump(); await B.pump();
  tick(300); A.g.press('sit'); await A.pump(); await B.pump();
  tick(300); B.g.press('sit'); await B.pump(); await A.pump();
  A.g.press('autofill'); tick(300); A.g.press('ready'); await A.pump(); await B.pump();
  B.g.press('autofill'); tick(300); B.g.press('ready'); await B.pump(); await A.pump();
  tick(GAMBIT_FIRST_MS); await r.fire(); await A.pump(); await B.pump();
  assert.equal(A.g.g.phase, 'battle'); assert.equal(B.g.g.phase, 'battle');
  return { A, B };
}

test('AUDIT KG II B2 A SOCKET DROPPED MID-GAME AND BACK: the game the relay gave away is read off the table\'s last - the loss shown, nothing staked, no game under way (mutants: the last\'s result)', () => withRoom(async ({ r, tick, clock }) => {
  const { A, B } = await seatedAndDealt(r, tick, clock);
  tick(300); await B.drop(); await A.pump();
  A.step(10); A.step(GAMBIT_RESULT_MS + 10);
  assert.match(shown(A), /peer-b left the board/);
  tick(1500); await B.back();
  B.step(10); await B.pump();
  for (let k = 0; k < 3; k++) { B.step(GAMBIT_RESULT_MS); await B.pump(); }
  assert.equal(B.g.g.phase, 'over');
  assert.equal(B.g.playing(), false);
  assert.match(shown(B), /You lose by forfeit/);
  assert.doesNotMatch(shown(B), /You are watching/);
}));

test('AUDIT KG II B3 A SEAT STOOD UP BY THE CLOCK: its own loss read as its own - You lose, and You let the clock run out (mutants: the watcher\'s mark)', () => withRoom(async ({ r, tick, clock }) => {
  const { A, B } = await seatedAndDealt(r, tick, clock);
  for (let k = 0; k < 3 && r.room._gambit.get(0).game; k++) {
    tick(300); A.g.press('end'); await A.pump(); await B.pump();
    tick(GAMBIT_TURN_END_MS); await r.fire(); await A.pump(); await B.pump();
    A.step(GAMBIT_REMOTE_GAP_MS); B.step(GAMBIT_REMOTE_GAP_MS);
    tick(GAMBIT_TURN_MS); await r.fire(); await A.pump(); await B.pump();
    tick(GAMBIT_TURN_END_MS); await r.fire(); await A.pump(); await B.pump();
    A.step(GAMBIT_REMOTE_GAP_MS); B.step(GAMBIT_REMOTE_GAP_MS);
  }
  const t = r.room._gambit.get(0);
  assert.equal(t.last.how, 'idle'); assert.equal(t.seats[1], null, 'the guest stood up');
  for (let k = 0; k < 4; k++) { B.step(GAMBIT_RESULT_MS); A.step(GAMBIT_RESULT_MS); }
  const box = find(B.g.g.hud.root, 'dfgambit-result')[0];
  assert.equal(find(box, 'dfgambit-head')[0].textContent, 'You lose by forfeit');
  assert.match(text(box), /You let the clock run out 3 turns in a row\./);
  assert.ok(B.g.g.log.some((l) => /peer-a wins/.test(l)), 'its log says the end');
}));

test('AUDIT KG II B11 MOVE, THEN END TURN AT ONCE: the End reaches the relay once the move is answered (mutants: the held press)', () => withRoom(async ({ r, tick, clock }) => {
  const { A, B } = await seatedAndDealt(r, tick, clock);
  const st = A.g.g.session.state;
  const p = st.pieces.find((x) => x.side === 0 && !x.king && reachable(st, x).length);
  const [c, row] = reachable(st, p)[0];
  tick(300); A.g.press('cell', [p.col, p.row]); A.g.press('cell', [c, row]);
  A.g.press('end');
  await A.pump(); await B.pump();
  A.step(10); await A.pump(); await B.pump();
  const tt = r.room._gambit.get(0);
  assert.ok(tt.game.ending || tt.game.turn === 1, 'the End turn reached the relay');
}));

test('AUDIT KG II E11 + E14 A RATED RESULT FROM THE ROOM JUST LEFT IS HEARD (its table\'s other frames are not); A SEATED PLAYER\'S GOLD RESULT SAYS THE POT (mutants: the halo\'s receipt; the pot\'s words)', async () => {
  const { OnlineSession } = await import('../../src/net/online.js');
  const { fakeSocketClass } = await import('../fakeSocket.mjs');
  const { mintGambitReceipt } = await import('../../src/net/gambit/gambitReceipt.js');
  const { RELAY_VERSION } = await import('../../src/net/wire.js');
  const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => 1_000_000 });
  const heard = []; s.onGambit = (f) => heard.push(f);
  quiet(() => s.join('interior:m1.2'));
  sockets[0].open();
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v: RELAY_VERSION }));
  const receipt = await mintGambitReceipt({ j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 0, h: 'king' }, null, { subtle: globalThis.crypto.subtle, nowS: 1000 });
  quiet(() => s._receive(JSON.stringify({ t: 'gambit', table: 1, now: 0, receipt }), 'interior:m9.9'));
  assert.equal(heard.length, 1, 'the room just left: its result heard');
  const { frames } = goldGame();
  quiet(() => s._receive(JSON.stringify(frames.at(-1)), 'interior:m9.9'));
  assert.equal(heard.length, 1, 'never its table');
  // the seated winner's words: the pot
  const { t, frames: f2, keep } = goldGame();
  const A = panel({ myId: 'a' });
  for (const f of f2) A.g.relay(f);
  for (const x of keep(gambitForfeit(t, { id: 'b', gameNo: t.gameNo, now: 10 }))) A.g.relay({ t: 'gambit', table: 1, now: 1e12, ...x.frame });
  A.step(10); A.step(GAMBIT_RESULT_MS + 10);
  assert.match(text(A.g.g.hud.root), /You collect the pot: your 50 gold back, plus 50 gold from Bors\./);
});
