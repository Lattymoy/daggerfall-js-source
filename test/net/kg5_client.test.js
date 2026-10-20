// KG5 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 5.8, 10.7 and 18): THE KING'S GAMBIT ONLINE, ON THE
// CLIENT - the mirror (systems/gambit/gambitRemoteTable.js): the room's table and its clock, the online session (the guest's eye
// turned about the board's middle, the law's check before a command goes, one command on its way at a time, the other
// side's actions shown GAMBIT_REMOTE_GAP_MS apart, the relay's result after its beat); the cloth's turned board, every
// cell where the host's lies; the client's session (sent only to a relay that runs it, through its gate; a frame heard
// from the room the player stands in); and two pages and a watcher over the relay itself (server/src/index.js on the
// fake room): sit, Ready, the deal, a move seen on both boards in the same place, the turn's end, a forfeit, the result
// and its words; the watcher's board and presses; Play a regular instead standing up from the board.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteGambitTable, RemoteGambitSession, overBy, GAMBIT_SENT_MS } from '../../src/systems/gambit/gambitRemoteTable.js';
import {
  newGambitTable, gambitSit, gambitReady, gambitTick, gambitCommand, validGambitOut, flipCell,
  GAMBIT_FIRST_MS, GAMBIT_REMOTE_GAP_MS, GAMBIT_TURN_END_MS, GAMBIT_TURN_MS,
} from '../../src/net/gambit/gambitTable.js';
import { autoFill, KG_POINT_BUDGET, KG_COLS, KG_ROWS, reachable, pieceById } from '../../src/net/kingsGambit.js';
import { GAMBIT_RESULT_MS } from '../../src/systems/gambit/gambitTableSession.js';
import { gambitPlaces } from '../../src/world/gambitCloth.js';
import { openGambitTableGame } from '../../src/scenes/gambitTableGame.js';
import { relaySupportsGambit, RELAY_VERSION } from '../../src/net/wire.js';
import { CARD_TABLE_W, CARD_TABLE_D } from '../../src/world/card/cardTableProp.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { xorshift } from '../../tools/kgMeasure.mjs';
import { fakeDoc, text } from '../decorFakes.mjs';
import { fakeRoom } from '../fakeRoom.mjs';

beforeEach(() => resetPrefs());

const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));
const FRAME = { centre: [0, 0.8, 0], axisYaw: Math.PI / 2, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 };
const CHAIRS = [[0, 0, -0.9], [0.9, 0, 0], [0, 0, 0.9], [-0.9, 0, 0]];
/** Two seated and dealt at the relay's table (net/gambit/gambitTable.js), the frames the room was told. */
function dealt(seed = 3) {
  const t = newGambitTable({ chairs: 4 }), rand32 = xorshift(seed);
  const frames = [];
  const keep = (m) => { for (const x of m) frames.push({ t: 'gambit', table: 0, now: 0, ...x.frame }); return m; };
  keep(gambitSit(t, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0 }));
  keep(gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 2, now: 0 }));
  keep(gambitReady(t, { id: 'a', army: army(seed), now: 0 }));
  keep(gambitReady(t, { id: 'b', army: army(seed + 1), now: 0 }));
  keep(gambitTick(t, GAMBIT_FIRST_MS, rand32));
  return { t, rand32, frames, keep };
}

test('KG5 THE ROOM\'S TABLE ON THE CLIENT: my seat, the other\'s, readiness; a refusal kept; the clock the relay\'s, its skew read off each frame (mutants: the seat; the skew)', () => {
  const { t, frames } = dealt();
  const r = new RemoteGambitTable({ myId: 'b' });
  for (const f of frames) r.apply(f, 1000);
  assert.equal(r.seat(), 1);
  assert.equal(r.other().name, 'Ana');
  assert.equal(r.apply({ table: 0, error: 'turn', now: 0 }, 1000).length, 0);
  assert.equal(r.error, 'turn');
  r.apply({ t: 'gambit', table: 0, now: GAMBIT_FIRST_MS, events: [], state: frames.at(-1).state }, 5000);
  assert.equal(r.error, null);
  assert.equal(r.skew, GAMBIT_FIRST_MS - 5000);
  assert.equal(r.clockLeft(5000), Math.ceil(GAMBIT_TURN_MS / 1000), 'the turn\'s whole clock, on the relay\'s time');
  assert.equal(r.clockLeft(5000 + 10_500), Math.ceil((GAMBIT_TURN_MS - 10_500) / 1000));
  assert.equal(new RemoteGambitTable({ myId: 'z' }).clockLeft(0), null, 'no game, no clock');
  assert.ok(t.game);
});

test('KG5 THE ONLINE SESSION: the guest reads the board turned (its own side 0 at its foot); the law\'s check before a command goes, a lawful one sent turned back - one at a time; the other side\'s actions shown GAMBIT_REMOTE_GAP_MS apart; the relay\'s result decided at once and shown after its beat (mutants: the turn; the check; the gap; the beat; the winner)', () => {
  const { t, rand32, frames, keep } = dealt(5);
  const sent = [];
  const g = new RemoteGambitSession({ side: 1, game: t.game, gameNo: 1, send: (c) => { sent.push(c); return true; }, forfeit: () => sent.push('forfeit'), now: 0 });
  assert.equal(g.state.turn, 1, 'the host\'s turn, read as the other side\'s');
  for (const p of g.state.pieces) {
    const q = pieceById(t.game, p.id);
    assert.deepEqual([p.col, p.row], flipCell([q.col, q.row]));
    assert.equal(p.side, 1 - q.side);
  }
  assert.equal(g.act({ type: 'end' }, 10), 'turn', 'the law\'s word, here, before anything goes');
  assert.equal(sent.length, 0);
  // the host moves twice: each its own frame, the second shown GAMBIT_REMOTE_GAP_MS after the first
  for (let k = 0; k < 2; k++) {
    const p = t.game.pieces.find((x) => x.side === 0 && reachable(t.game, x).length && x.id !== 0);
    const [c, r] = reachable(t.game, p)[0];
    const m = keep(gambitCommand(t, { id: 'a', cmd: { type: 'move', piece: p.id, col: c, row: r }, gameNo: 1, now: 100, rand32 }));
    g.feed(m[0].frame.events, m[0].frame.state);
  }
  g.drain();
  g.tick(1000);
  assert.equal(g.drain().filter((e) => e.t === 'move').length, 1, 'the first shown');
  g.tick(1000 + GAMBIT_REMOTE_GAP_MS - 1);
  assert.equal(g.drain().length, 0, 'the second waits its gap');
  g.tick(1000 + GAMBIT_REMOTE_GAP_MS);
  const moved = g.drain().find((e) => e.t === 'move');
  assert.ok(moved && moved.side === 1, 'the host\'s move, read as the other side\'s');
  assert.deepEqual(g.state.pieces.map((p) => [p.id, p.col, p.row]), t.game.pieces.map((p) => [p.id, ...flipCell([p.col, p.row])]), 'the board as the relay holds it, turned');
  // two actions spent: the turn ends on its beat, and comes round
  assert.ok(t.game.ending);
  const turned = keep(gambitTick(t, 100 + GAMBIT_TURN_END_MS, rand32));
  g.feed(turned[0].frame.events, turned[0].frame.state);
  g.tick(5000); g.tick(5000 + GAMBIT_REMOTE_GAP_MS);
  assert.equal(g.state.turn, 0, 'my turn, read as side 0');
  // my move: checked, sent turned back, and a second press waits for the relay's answer
  const mine = g.state.pieces.find((p) => p.side === 0 && reachable(g.state, p).length);
  const [mc, mr] = reachable(g.state, mine)[0];
  assert.equal(g.act({ type: 'move', piece: mine.id, col: mc, row: mr }, 6000), null);
  assert.deepEqual(sent.at(-1), { type: 'move', piece: mine.id, col: KG_COLS - 1 - mc, row: KG_ROWS - 1 - mr }, 'the relay\'s own cell');
  assert.equal(g.act({ type: 'end' }, 6001), null);
  assert.equal(sent.length, 1, 'one command on its way at a time');
  g.tick(6000 + GAMBIT_SENT_MS);
  // PIN MOVED (AUDIT KG II B11): the press made meanwhile was held, and goes once the first is let go
  assert.deepEqual(sent.at(-1), { type: 'end' }, 'a command never answered is let go - and the one held goes');
  g.tick(6000 + 2 * GAMBIT_SENT_MS);
  assert.equal(g.sentAt, null, 'a command never answered is let go');
  // the relay's result: decided at once, shown after the beat
  g.feed([{ t: 'result', gameNo: 1, winner: 0, how: 'forfeit', names: ['Ana', 'Bors'] }], { ...turned[0].frame.state, game: null, last: { gameNo: 1, game: t.game } });
  g.tick(7000);
  const d = g.drain().find((e) => e.t === 'decided');
  assert.deepEqual([d.winner, d.by, d.how], [1, 'forfeit', 'forfeit'], 'the host\'s win is the other side\'s, read');
  assert.equal(g.shown, false);
  g.tick(7000 + GAMBIT_RESULT_MS);
  assert.equal(g.shown, true);
  assert.deepEqual(g.settlement(), { pay: 0, net: 0 }, 'friendly');
  assert.deepEqual(['king', 'forfeit', 'idle', 'left', 'void'].map(overBy), ['king', 'forfeit', 'forfeit', 'forfeit', 'void']);
});

test('KG5 THE GUEST\'S BOARD ON THE CLOTH: laid turned from the host\'s chair, every cell where the host\'s own lies - the guest\'s foot row at the guest\'s edge (mutants: the flip)', () => {
  const host = gambitPlaces(FRAME, CHAIRS[0]), guest = gambitPlaces(FRAME, CHAIRS[0], { flip: true });
  for (let c = 0; c < KG_COLS; c++) for (let r = 0; r < KG_ROWS; r++) {
    const [fc, fr] = flipCell([c, r]);
    const a = host.at(c, r), b = guest.at(fc, fr);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-9, `cell ${c},${r}`);
  }
  const foot = (P, row) => Math.hypot(P.at(7, row)[0] - CHAIRS[2][0], P.at(7, row)[2] - CHAIRS[2][2]);
  assert.ok(foot(guest, KG_ROWS - 1) < foot(guest, 0), 'the guest\'s own foot row at its own edge');
  assert.deepEqual(guest.cellAt(host.at(3, 4)), flipCell([3, 4]));
});

test('KG5 THE CLIENT\'S SESSION: a gambit word sent only to a relay that runs it, through its gate; a table\'s frame heard only from the room the player stands in, checked by the table\'s law (mutants: the gate; the room)', async () => {
  const { OnlineSession } = await import('../../src/net/online.js');
  const { fakeSocketClass } = await import('../fakeSocket.mjs');
  const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
  const link = (v) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => 1_000_000 });
    const heard = []; s.onGambit = (f) => heard.push(f);
    quiet(() => s.join('interior:m1.2'));
    const ws = sockets[0]; ws.open();
    quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v }));
    return { s, heard, sent: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'gambit') };
  };
  const old = link('world203');
  assert.equal(old.s.gambitOk, false);
  assert.equal(old.s.sendGambit({ op: 'look', table: 0 }), false, 'KG-SET\'s relay would close the socket on it');
  const now = link(RELAY_VERSION);
  assert.equal(relaySupportsGambit(RELAY_VERSION), true);
  assert.equal(now.s.gambitOk, true);
  assert.equal(now.s.sendGambit({ op: 'sit', table: 0, chair: 1, chairs: 4, crown: 2 }), true);
  assert.equal(now.s.sendGambit({ op: 'deal', table: 0 }), false, 'a word the table does not know');
  assert.deepEqual(now.sent(), [{ t: 'gambit', op: 'sit', table: 0, chair: 1, chairs: 4, crown: 2 }]);
  let more = 0;
  for (let i = 0; i < 20; i++) if (now.s.sendGambit({ op: 'look', table: 0 })) more++;
  assert.ok(more < 20, 'the gate holds a flood');
  const { frames } = dealt();
  quiet(() => now.s._receive(JSON.stringify(frames.at(-1)), 'interior:m9.9'));
  assert.equal(now.heard.length, 0, 'a halo room\'s table is not this room\'s');
  quiet(() => now.s._receive(JSON.stringify(frames.at(-1))));
  assert.equal(now.heard.length, 1, 'the room the player stands in');
  const bent = JSON.parse(JSON.stringify(frames.at(-1))); bent.state.game.pieces[0].hp = 0;
  quiet(() => now.s._receive(JSON.stringify(bent)));
  assert.equal(now.heard.length, 1, 'a board the law did not mint is no frame');
});

// ── two pages and a watcher over the relay itself ─────────────────────────────────────────────────────────────────

const ROOM = 'interior:m100.200';
async function withRoom(fn) {
  const r = fakeRoom(ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms) => { clock += ms; }, clock: () => clock }); } finally { Date.now = realNow; }
}
/** A page at the tavern's table: the host's half (scenes/gambitTableGame.js) on a fake page, its words to the relay
 *  queued and carried by `pump`, the relay's frames handed to it as world.js's online.onGambit would. */
async function page(R, id, chair, clock) {
  const ws = R.connect(); await R.hello(ws, id, null, { name: id });
  const out = [], said = [], made = [], freed = [];
  let seen = 0, local = 0;
  const renderer = { createMesh: (m) => { made.push(m); return { m }; }, drawMesh() {}, destroyMesh: (m) => freed.push(m), uploadTexture() {}, releaseTexture() {} };
  const entity = { name: id, items: [], goldPieces: 100 };
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer, entity, say: (t) => said.push(t), holdCursor: () => () => true, relock() {},
    rand32: xorshift(9), now: () => local, day: () => 100, key: 'town:7:0', friendly: true, regulars: [{ name: 'Cael', seed: 3, chair: 3 }],
    frame: FRAME, mySeatFeet: CHAIRS[chair], touch: () => false, onHoldem() {}, onIliac() {}, onStand() {},
    online: { send: (w) => { out.push(w); return true; }, myId: () => id, now: clock, table: 0, chairs: 4, chair, chairFeet: (k) => CHAIRS[k], welcomes: () => 1 },
  });
  const pump = async () => {
    while (out.length) { const w = out.shift(); await R.raw(ws, JSON.stringify({ t: 'gambit', ...w })); }
    const frames = ws.sent.filter((m) => m.t === 'gambit');
    for (; seen < frames.length; seen++) { assert.ok(validGambitOut(frames[seen]), 'every frame the client\'s law takes'); g.relay(frames[seen]); }
  };
  const step = (ms) => { local += ms; g.g.motion && g.frame(local); };
  return { ws, g, said, made, freed, pump, step };
}
/** The panel's words as its page shows them, and its presses' labels. */
const shown = (p) => text(p.g.g.hud.root);
const buttons = (n, out = []) => { if (n.tag === 'button') out.push(n); for (const c of n.children ?? []) buttons(c, out); return out; };
const acts = (p) => buttons(p.g.g.hud.root).map((n) => n.textContent);

test('KG5 TWO PLAYERS OVER THE RELAY: each sits at the board, builds an army and says Ready; the relay deals; the host\'s move lands on both boards in the same place on the cloth, the guest shown it after the gap; the turn comes round to the guest; the guest forfeits; the result and its words on both; a watcher sees the board and presses nothing of the game\'s; Play a regular instead stands up from the board (mutants: the sit; the deal opened; the guest\'s eye; the watcher\'s presses; the stand)', () => withRoom(async ({ r, tick, clock }) => {
  const A = await page(r, 'peer-a', 0, clock), B = await page(r, 'peer-b', 2, clock);
  await A.pump(); await B.pump();
  assert.equal(A.g.g.mode, 'online');
  assert.ok(acts(A).includes('Sit at the board'));
  assert.match(shown(A), /Sit at the board to play another player/);
  tick(300); A.g.press('sit'); await A.pump(); await B.pump();
  assert.equal(A.g.g.phase, 'army', 'seated: the army');
  tick(300); B.g.press('sit'); await B.pump(); await A.pump();
  assert.equal(B.g.g.phase, 'army');
  assert.match(shown(A), /Add a unit from the list/, 'an empty army: the army\'s own next step');
  A.g.press('autofill');
  assert.match(shown(A), /Build your army, then press Ready\. peer-b sits across the board\./);
  tick(300); A.g.press('ready'); await A.pump(); await B.pump();
  assert.match(shown(B), /peer-a is ready/);
  assert.ok(acts(A).includes('Not ready'));
  tick(300); B.g.press('autofill'); B.g.press('ready'); await B.pump(); await A.pump();
  tick(GAMBIT_FIRST_MS); await r.fire(); await A.pump(); await B.pump();
  assert.equal(A.g.g.phase, 'battle'); assert.equal(B.g.g.phase, 'battle');
  assert.equal(B.g.g.session.side, 1, 'the guest');
  assert.equal(A.g.g.session.state.turn, 0); assert.equal(B.g.g.session.state.turn, 1);
  // the host moves a piece, by the cloth's own presses
  const st = A.g.g.session.state;
  const p = st.pieces.find((x) => x.side === 0 && !x.king && reachable(st, x).length);
  const [c, row] = reachable(st, p)[0];
  tick(300); A.g.press('cell', [p.col, p.row]); A.g.press('cell', [c, row]); await A.pump(); await B.pump();
  A.step(10); B.step(10);
  const onA = pieceById(A.g.g.session.state, p.id), onB = pieceById(B.g.g.session.state, p.id);
  assert.deepEqual([onA.col, onA.row], [c, row], 'the host\'s board');
  assert.deepEqual([onB.col, onB.row], flipCell([c, row]), 'the guest\'s, turned');
  const pa = A.g.g.places.at(onA.col, onA.row), pb = B.g.g.places.at(onB.col, onB.row);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(pa[i] - pb[i]) < 1e-9, 'one place on the cloth');
  assert.ok(B.g.g.log.some((l) => /peer-a's .* moves\./.test(l)), `the guest's log: ${B.g.g.log}`);
  // a watcher sits at the cloth's last chair and opens the game
  const C = await page(r, 'peer-c', 3, clock);
  await C.pump();
  assert.equal(C.g.g.phase, 'battle', 'a game under way, watched');
  assert.match(shown(C), /You are watching peer-a play peer-b/);
  assert.deepEqual(acts(C), ['Play a regular instead', 'Stand up', 'More']);   // PIN MOVED (AUDIT KG II D2): More, a phone watcher's door to the sheet
  const before = C.ws.sent.length;
  const cp = C.g.g.session.state.pieces.find((x) => x.side === 0 && reachable(C.g.g.session.state, x).length);
  C.g.press('cell', [cp.col, cp.row]); C.g.press('cell', reachable(C.g.g.session.state, cp)[0]); await C.pump();
  C.g.g.cursor = [cp.col, cp.row]; C.g.key('Enter'); C.g.g.cursor = reachable(C.g.g.session.state, cp)[0]; C.g.key('Enter'); await C.pump();   // the keys press the board's cells directly
  assert.equal(C.ws.sent.length, before, 'a watcher\'s press sends nothing - on the host\'s own turn');
  // the host ends; the alarm ends the turn on its beat
  tick(300); A.g.press('end'); await A.pump(); await B.pump();
  tick(GAMBIT_TURN_END_MS); await r.fire(); await A.pump(); await B.pump();
  B.step(GAMBIT_REMOTE_GAP_MS); A.step(GAMBIT_REMOTE_GAP_MS);
  assert.equal(B.g.g.session.state.turn, 0, 'the guest\'s turn');
  assert.ok(acts(B).includes('End turn'));
  // the guest forfeits - asked twice
  tick(300); B.g.press('forfeit'); B.g.press('forfeit'); await B.pump(); await A.pump(); await C.pump();
  A.step(10); B.step(10); A.step(GAMBIT_RESULT_MS); B.step(GAMBIT_RESULT_MS); C.step(10); C.step(GAMBIT_RESULT_MS);
  assert.equal(A.g.g.phase, 'over'); assert.equal(B.g.g.phase, 'over');
  assert.match(shown(A), /You win/); assert.match(shown(A), /peer-b gave up the game\./);
  assert.match(shown(B), /You lose by forfeit/);
  assert.match(shown(C), /peer-a wins/, 'the watcher\'s headline names the winner');
  assert.match(shown(A), /Played for fun\. No gold changed hands\./);
  // Play again: the army again, Ready said again
  tick(300); A.g.press('again'); await A.pump();
  assert.equal(A.g.g.phase, 'army');
  assert.ok(acts(A).includes('Ready'));
  // Play a regular instead: up from the board
  tick(300); B.g.press('regulars'); await B.pump(); await A.pump();
  assert.equal(B.g.g.mode, 'regulars');
  assert.equal(r.room._gambit.get(0).seats[1], null, 'the guest stood up at the relay');
  assert.match(shown(A), /Build your army while you wait for another player/);
  // the close stands up; every allocation freed
  tick(300); A.g.close(); await A.pump();
  assert.equal(r.store.get('gambit'), undefined, 'the board forgotten');
  for (const P of [A, B, C]) { if (P !== A) P.g.close(); assert.equal(P.freed.length, P.made.length, 'every mesh freed'); }
}));
