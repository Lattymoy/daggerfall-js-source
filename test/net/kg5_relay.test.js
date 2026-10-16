// KG5 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 5.8 and 18): THE RELAY RUNS THE KING'S GAMBIT - the
// relay itself (server/src/index.js on the fake room): two seated in a tavern's room and a third watching every event;
// the armies at Ready, the alarm's deal, a command the law refuses said to its giver alone, the turn's end on the alarm,
// the clock; a socket gone forfeits; the table kept across a hibernation and CHECKED when the room loads it (AUDIT KG A4);
// one cloth one game - each of the three games refused at a cloth another holds, a sit standing the player up from the
// others; the gold table's Ready a stake (KG6); no table in a layer, none outside an interior; the room's
// sweep; the wire's arm, its frame cap and the relay version that first runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { validGambitOut, gambitTableValid, GAMBIT_FIRST_MS, GAMBIT_TURN_MS, GAMBIT_TURN_END_MS } from '../../src/net/gambit/gambitTable.js';
import { autoFill, KG_POINT_BUDGET, reachable, KG_TILE, KG_COLS } from '../../src/net/kingsGambit.js';
import { parseClient, relaySupportsGambit, GAMBIT_RELAY_MIN, GAMBIT_FRAME_MAX } from '../../src/net/wire.js';
import { relayVersionAtLeast } from '../relayVersion.mjs';
import { STARTER_DECK } from '../../src/net/iliac/iliacCards.js';
import { xorshift } from '../../tools/kgMeasure.mjs';

const ROOM = 'interior:m100.200';
async function withRoom(fn, key = ROOM) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; } }); } finally { Date.now = realNow; _tick = () => {}; }
}
let _tick = () => {};
const kg = (ws) => ws.sent.filter((m) => m.t === 'gambit');
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'gambit', ...o })); };
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
const sit = (r, ws, chair, extra = {}) => word(r, ws, { op: 'sit', table: 0, chair, chairs: 4, crown: chair % 4, ...extra });
const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));
const events = (ws) => kg(ws).flatMap((m) => m.events ?? []);

test('KG5 THE RELAY: two seated in a tavern\'s room and a third watching every event; the armies at Ready never told; the alarm deals from the relay\'s dice; a command the law refuses said to its giver alone; a step and the turn\'s end on the alarm, the watcher told the whole board; the table kept across a hibernation (mutants: the room\'s send; the alarm\'s third table; the deal)', () => withRoom(async ({ r, tick }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  await sit(r, a, 0);
  await sit(r, b, 2);
  assert.deepEqual(kg(c).at(-1).state.seats.map((s) => s?.chair ?? null), [0, 2], 'the watcher told the seats');
  const A = army(1), B = army(2);
  await word(r, a, { op: 'ready', table: 0, army: A });
  await word(r, b, { op: 'ready', table: 0, army: B, crown: 3 });
  assert.ok(!JSON.stringify(c.sent).includes('"army"'), 'an army is never told before the deal');
  assert.ok(r.alarm.at != null && r.alarm.at <= Date.now() + GAMBIT_FIRST_MS, 'the alarm armed for the deal');
  r.wake();   // hibernated between the Ready and the deal: the table is kept, and checked
  tick(GAMBIT_FIRST_MS); await r.fire();
  const dealt = kg(c).at(-1);
  assert.equal(dealt.events[0].t, 'game');
  assert.deepEqual(dealt.events[0].crowns, [0, 3]);
  assert.ok(dealt.state.game.pieces.length >= 2 + A.length + B.length - 2, 'both armies on the board, in the open');
  for (const m of kg(c)) assert.ok(validGambitOut(m), 'every frame the client\'s law takes');
  // a command the law refuses: said to its giver alone
  const before = c.sent.length;
  await word(r, b, { op: 'act', table: 0, gameNo: 1, cmd: { type: 'end' } });
  assert.equal(kg(b).at(-1).error, 'turn', 'not its turn');
  assert.equal(c.sent.length, before, 'the room hears nothing of a refusal');
  // the host steps; the room told the whole board
  const g = r.room._gambit.get(0).game;
  const p = g.pieces.find((x) => x.side === 0 && reachable(g, x).length);
  const [col, row] = reachable(g, p)[0];
  await word(r, a, { op: 'act', table: 0, gameNo: 1, cmd: { type: 'move', piece: p.id, col, row } });
  const moved = kg(c).at(-1);
  assert.equal(moved.events[0].t, 'move');
  assert.deepEqual(((s) => [s.col, s.row])(moved.state.game.pieces.find((x) => x.id === p.id)), [col, row]);
  await word(r, a, { op: 'act', table: 0, gameNo: 1, cmd: { type: 'end' } });
  tick(GAMBIT_TURN_END_MS); await r.fire();
  assert.ok(kg(c).at(-1).events.some((e) => e.t === 'turn' && e.side === 1), 'the turn\'s end on the alarm');
  assert.equal(r.room._gambit.get(0).game.turn, 1);
  // the guest's clock runs out on the alarm: its turn ends as End turn does
  tick(GAMBIT_TURN_MS); await r.fire();
  assert.ok(events(c).some((e) => e.t === 'timeout' && e.seat === 1), 'the clock');
  for (const m of kg(c)) assert.ok(validGambitOut(m));
}));

test('KG5 THE RELAY: a socket gone forfeits, its game the other\'s; a stand leaves the chair; the room forgets an empty table; nothing outside an interior; no table in a layer; the gold table\'s Ready a stake (mutants: the leave; the layer)', () => withRoom(async ({ r, tick }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  await sit(r, a, 0); await sit(r, b, 1);
  await word(r, a, { op: 'ready', table: 0, army: army(1) });
  await word(r, b, { op: 'ready', table: 0, army: army(2) });
  tick(GAMBIT_FIRST_MS); await r.fire();
  await r.drop(b);
  const end = events(a).find((e) => e.t === 'result');
  assert.deepEqual([end.winner, end.how], [0, 'left'], 'a socket gone forfeits');
  assert.equal(r.room._gambit.get(0).seats[1], null);
  await word(r, a, { op: 'stand', table: 0 });
  assert.equal(r.store.get('gambit'), undefined, 'the table forgotten');
  // PIN MOVED (KG6): the red table is the realm's gold table - it seats, and its Ready carries a stake
  await word(r, a, { op: 'sit', table: 1, chair: 0, chairs: 4, crown: 0 });
  assert.equal(r.room._gambit.get(1).gold, true);
  await word(r, a, { op: 'ready', table: 1, army: army(1) });
  assert.equal(kg(a).at(-1).error, 'stake needed');
  // a hallway keeps no table
  await withRoom(async ({ r: h }) => {
    const x = await join(h, 'peer-x');
    await word(h, x, { op: 'sit', table: 0, chair: 0, chairs: 4, crown: 0 });
    assert.equal(kg(x).length, 0);
    assert.equal(h.store.get('gambit'), undefined);
  }, 'world');
}));

test('KG5 ONE CLOTH, ONE GAME: The King\'s Gambit refused at a cloth Hold\'em or Iliac Hand holds, and each of them at one it holds; a sit at any game stands the player up from the others (mutants: each refusal; each stand-up)', () => withRoom(async ({ r }) => {
  const a = await join(r, 'peer-a'), c = await join(r, 'peer-c'), d = await join(r, 'peer-d');
  await sit(r, a, 0);   // King's Gambit at cloth 0
  _tick(300); await r.raw(c, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 3, chairs: 4, bb: 10 }));
  assert.equal(c.sent.filter((m) => m.t === 'holdem').at(-1).error, 'other game', 'Hold\'em refused at a King\'s Gambit cloth');
  _tick(300); await r.raw(d, JSON.stringify({ t: 'iliac', op: 'sit', table: 0, chair: 2, chairs: 4, deck: [...STARTER_DECK] }));
  assert.equal(d.sent.filter((m) => m.t === 'iliac').at(-1).error, 'other game', 'Iliac Hand too');
  // Hold'em at cloth 2, Iliac at cloth 3: The King's Gambit refused at each
  _tick(300); await r.raw(c, JSON.stringify({ t: 'holdem', op: 'sit', table: 2, chair: 0, chairs: 4, bb: 10 }));
  _tick(300); await r.raw(d, JSON.stringify({ t: 'iliac', op: 'sit', table: 3, chair: 0, chairs: 4, deck: [...STARTER_DECK] }));
  const e = await join(r, 'peer-e');
  await word(r, e, { op: 'sit', table: 2, chair: 1, chairs: 4, crown: 0 });
  assert.equal(kg(e).at(-1).error, 'other game');
  await word(r, e, { op: 'sit', table: 3, chair: 1, chairs: 4, crown: 0 });
  assert.equal(kg(e).at(-1).error, 'other game');
  // a King's Gambit sit stands its player up from Hold'em and from Iliac Hand
  await word(r, c, { op: 'sit', table: 0, chair: 1, chairs: 4, crown: 1 });
  assert.ok(!r.room._holdem.get(2)?.seats.some((s) => s?.id === 'peer-c'), 'off Hold\'em');
  await word(r, d, { op: 'sit', table: 4, chair: 1, chairs: 4, crown: 1 });
  assert.ok(!r.room._iliac.get(3)?.seats.some((s) => s?.id === 'peer-d'), 'off Iliac Hand');
  // and a Hold'em or Iliac sit stands its player up from The King's Gambit
  _tick(300); await r.raw(a, JSON.stringify({ t: 'holdem', op: 'sit', table: 6, chair: 0, chairs: 4, bb: 10 }));
  assert.ok(!r.room._gambit.get(0)?.seats.some((s) => s?.id === 'peer-a'), 'off by Hold\'em');
  _tick(300); await r.raw(d, JSON.stringify({ t: 'iliac', op: 'sit', table: 5, chair: 0, chairs: 4, deck: [...STARTER_DECK] }));
  assert.ok(!r.room._gambit.get(4)?.seats.some((s) => s?.id === 'peer-d'), 'off by Iliac Hand');
}));

test('KG5 THE STORED TABLE, CHECKED WHEN THE ROOM LOADS IT (AUDIT KG A4): a table the law did not mint is dropped - the room wakes, its alarm fires and nothing throws; a sound one kept; the drained room\'s sweep stands every seat, a game under way no contest (mutants: the check; the sweep)', () => withRoom(async ({ r, tick }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  await sit(r, a, 0); await sit(r, b, 1);
  await word(r, a, { op: 'ready', table: 0, army: army(1) });
  await word(r, b, { op: 'ready', table: 0, army: army(2) });
  tick(GAMBIT_FIRST_MS); await r.fire();
  const kept = r.store.get('gambit');
  assert.ok(gambitTableValid(kept[0]), 'the stored table is sound');
  // a bent store: a piece on a wall
  const bent = structuredClone(kept);
  const wall = bent[0].game.tiles.findIndex((x) => x !== KG_TILE.floor);
  assert.ok(wall >= 0, 'every layout stands something on its floor');
  bent[0].game.pieces[0].col = wall % KG_COLS; bent[0].game.pieces[0].row = Math.floor(wall / KG_COLS);
  r.store.set('gambit', bent);
  r.wake();
  const warn = console.warn; const said = []; console.warn = (...x) => said.push(x.join(' '));
  try {
    tick(GAMBIT_TURN_MS); await r.fire();
  } finally { console.warn = warn; }
  assert.ok(said.some((s) => s.includes('[gambit]')), 'said on the console');
  assert.ok(!r.room._gambit.has(0), 'dropped');
  // the sweep: a room drained of everyone - nobody's win
  r.store.set('gambit', kept);
  r.wake();
  await r.room._sweep();
  assert.equal(r.store.get('gambit'), undefined, 'every seat stood, the table forgotten');
}));

test('KG5 THE WIRE: the `gambit` arm named in parseClient\'s doc, after a hello only, its frame cap; the relay that first runs it (mutants: the arm; the cap; the minimum)', () => {
  assert.deepEqual(parseClient(JSON.stringify({ t: 'gambit', op: 'look', table: 0 }), { hasHello: true }), { t: 'gambit', op: 'look', table: 0 });
  assert.equal(parseClient(JSON.stringify({ t: 'gambit', op: 'look', table: 0 })).error, 'gambit before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'gambit', op: 'fly', table: 0 }), { hasHello: true }).error, 'bad gambit');
  const big = JSON.stringify({ t: 'gambit', op: 'look', table: 0, pad: 'x'.repeat(GAMBIT_FRAME_MAX) });
  assert.equal(parseClient(big, { hasHello: true }).error, 'frame too large');
  const ready = JSON.stringify({ t: 'gambit', op: 'ready', table: 15, army: new Array(12).fill(10), crown: 3 });
  assert.ok(ready.length <= GAMBIT_FRAME_MAX, 'a Ready at its longest fits');
  assert.equal(GAMBIT_RELAY_MIN, 204);   // PIN MOVED: world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge
  assert.ok(relayVersionAtLeast(GAMBIT_RELAY_MIN), 'the relay this tree builds runs it');   // was an equality pin on world204, which PVP-LOOT + QUEST-HOME's world205 left red on main (deploy 1438)
  assert.equal(relaySupportsGambit('world204'), true);
  assert.equal(relaySupportsGambit('world203'), false, 'KG-SET\'s relay closes the socket on a gambit frame');
});
