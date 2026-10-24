// KG5 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 5.8, 10.7 and 18): THE RELAY'S KING'S GAMBIT TABLE
// (net/gambit/gambitTable.js) - the seats and their refusals, the armies at Ready (never told), the relay's deal and dice, the
// law's commands and its refusals, the turn's end on its beat, the clock (a turn run out, three running a stand), a
// forfeit and a stand, the stored table checked (AUDIT KG A4), both directions of the wire, and the guest's eye (the board
// turned about its middle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGambitTable, gambitSit, gambitSitRefusal, gambitReady, gambitUnready, gambitCommand, gambitForfeit, gambitStand,
  gambitTick, gambitNextAt, gambitLook, gambitPublicView, gambitSeatOf, gambitEmpty, gambitTableValid, validGambitState,
  validGambitIn, validGambitOut, flipGambitState, flipGambitEvent, unflipCommand, flipCell,
  GAMBIT_TURN_MS, GAMBIT_TURN_END_MS, GAMBIT_FIRST_MS, GAMBIT_IDLE_TURNS,
} from '../../../src/net/gambit/gambitTable.js';
import { KG_COLS, KG_ROWS, KG_TILE, KG_POINT_BUDGET, autoFill, reachable, foesInRange, pieceById } from '../../../src/net/kingsGambit.js';
import { GAMBIT_TIERS, regularAction } from '../../../src/systems/gambit/gambitPatrons.js';
import { xorshift } from '../../../tools/kgMeasure.mjs';

const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));
/** Two seated and ready, dealt: the table, its source and the deal's clock. */
function dealt(seed = 3) {
  const t = newGambitTable({ chairs: 4 }), rand32 = xorshift(seed);
  gambitSit(t, { id: 'a', name: 'Ana', chair: 1, crown: 0, now: 0 });
  gambitSit(t, { id: 'b', name: 'Bors', chair: 3, crown: 2, now: 0 });
  gambitReady(t, { id: 'a', army: army(seed), now: 10 });
  gambitReady(t, { id: 'b', army: army(seed + 1), now: 20 });
  const msgs = gambitTick(t, 20 + GAMBIT_FIRST_MS, rand32);
  return { t, rand32, msgs, at: 20 + GAMBIT_FIRST_MS };
}
const frameOf = (m, table = 2) => ({ t: 'gambit', table, ...m.frame });

test('KG5 THE SEATS: a chair of the cloth, a crown of the four, two seats - the first the host; each refusal in words before anything moves; the room told the sit (mutants: the chair\'s range; the crown; full)', () => {
  const t = newGambitTable({ chairs: 4 });
  assert.equal(newGambitTable({ chairs: 7 }), null);
  assert.equal(gambitSitRefusal(t, { id: 'a', chair: 4, crown: 0 }), 'no such chair');
  assert.equal(gambitSitRefusal(t, { id: 'a', chair: 0, crown: 4 }), 'bad crown');
  const m = gambitSit(t, { id: 'a', name: 'Ana', chair: 1, crown: 0, now: 5 });
  assert.equal(m[0].to, null);
  assert.deepEqual(m[0].frame.events, [{ t: 'sit', seat: 0, chair: 1, name: 'Ana', crown: 0, at: 5 }]);
  assert.equal(gambitSit(t, { id: 'a', name: 'Ana', chair: 2, crown: 0, now: 6 }), 'seated');
  assert.equal(gambitSit(t, { id: 'b', name: 'Bors', chair: 1, crown: 0, now: 6 }), 'taken');
  gambitSit(t, { id: 'b', name: 'Bors', chair: 2, crown: 1, now: 6 });
  assert.equal(gambitSit(t, { id: 'c', name: 'Cael', chair: 3, crown: 1, now: 7 }), 'full');
  assert.deepEqual([gambitSeatOf(t, 'a'), gambitSeatOf(t, 'b'), gambitSeatOf(t, 'c')], [0, 1, -1], 'the first sat the host');
  assert.equal(gambitEmpty(t), false);
  gambitStand(t, { id: 'a', now: 8 }); gambitStand(t, { id: 'b', now: 8 });
  assert.equal(gambitEmpty(t), true);
});

test('KG5 THE ARMIES AT READY: a lawful army kept and never told - the room hears only that a seat is ready; both ready, the deal GAMBIT_FIRST_MS on, from the relay\'s source, the crowns said; a seat may take its readiness back (mutants: the army told; the deal\'s wait; the law\'s check)', () => {
  const t = newGambitTable({ chairs: 4 }), rand32 = xorshift(9);
  gambitSit(t, { id: 'a', name: 'Ana', chair: 1, crown: 0, now: 0 });
  assert.equal(gambitReady(t, { id: 'z', army: army(1), now: 1 }), 'not seated');
  assert.equal(gambitReady(t, { id: 'a', army: [...army(1), ...army(2)], now: 1 }), 'bad army', 'the law\'s own check');
  const a = army(1);
  const m = gambitReady(t, { id: 'a', army: a, now: 1 });
  assert.deepEqual(m[0].frame.events, [{ t: 'ready', seat: 0, at: 1 }]);
  assert.ok(!JSON.stringify(m).includes('"army"'), 'the army is never told');
  assert.equal(m[0].frame.state.seats[0].ready, true);
  gambitUnready(t, { id: 'a', now: 2 });
  assert.equal(t.seats[0].ready, false);
  gambitReady(t, { id: 'a', army: a, now: 3 });
  gambitSit(t, { id: 'b', name: 'Bors', chair: 3, crown: 2, now: 4 });
  gambitReady(t, { id: 'b', army: army(2), crown: 3, now: 10 });
  assert.equal(gambitNextAt(t), 10 + GAMBIT_FIRST_MS);
  assert.deepEqual(gambitTick(t, 10 + GAMBIT_FIRST_MS - 1, rand32), [], 'not before its pause');
  const d = gambitTick(t, 10 + GAMBIT_FIRST_MS, rand32);
  assert.equal(d[0].frame.events[0].t, 'game');
  assert.deepEqual(d[0].frame.events[0].crowns, [0, 3], 'the crowns as worn at Ready');
  assert.equal(t.gameNo, 1);
  assert.ok(validGambitState(t.game), 'a state the law minted');
  assert.deepEqual(t.game.pieces.filter((p) => p.side === 0 && !p.king).map((p) => p.unit).sort(), a.slice().sort(), 'the host\'s army on the board');
  assert.equal(t.clockAt, 10 + GAMBIT_FIRST_MS + GAMBIT_TURN_MS);
  assert.ok(t.seats.every((s) => s.army === null), 'and let go once dealt');
  assert.equal(gambitReady(t, { id: 'a', army: a, now: 1 }), 'in a game');
});

test('KG5 THE COMMANDS: the law\'s, in the game the panel showed - a stale one, another\'s turn and the law\'s refusals said in words; a step told the room with the whole board; the turn\'s end on its beat, then the other side\'s own clock (mutants: the beat; the stale game; the turn\'s clock)', () => {
  const { t, rand32, at } = dealt(3);
  const host = t.game.pieces.find((p) => p.side === 0 && reachable(t.game, p).length);
  const [c, r] = reachable(t.game, host)[0];
  assert.equal(gambitCommand(t, { id: 'b', cmd: { type: 'end' }, gameNo: 1, now: at + 1, rand32 }), 'turn');
  assert.equal(gambitCommand(t, { id: 'a', cmd: { type: 'end' }, gameNo: 0, now: at + 1, rand32 }), 'stale');
  assert.equal(gambitCommand(t, { id: 'a', cmd: { type: 'move', piece: host.id, col: 0, row: 0 }, gameNo: 1, now: at + 1, rand32 }), 'cell');
  assert.equal(gambitCommand(t, { id: 'z', cmd: { type: 'end' }, gameNo: 1, now: at + 1, rand32 }), 'not seated');
  const m = gambitCommand(t, { id: 'a', cmd: { type: 'move', piece: host.id, col: c, row: r }, gameNo: 1, now: at + 100, rand32 });
  assert.equal(m[0].frame.events[0].t, 'move');
  assert.deepEqual([pieceById(m[0].frame.state.game, host.id).col, pieceById(m[0].frame.state.game, host.id).row], [c, r]);
  gambitCommand(t, { id: 'a', cmd: { type: 'end' }, gameNo: 1, now: at + 200, rand32 });
  assert.equal(t.endAt, at + 200 + GAMBIT_TURN_END_MS, 'the turn ends on its beat');
  assert.deepEqual(gambitTick(t, at + 200 + GAMBIT_TURN_END_MS - 1, rand32), []);
  const turned = gambitTick(t, at + 200 + GAMBIT_TURN_END_MS, rand32);
  assert.ok(turned[0].frame.events.some((e) => e.t === 'turn' && e.side === 1));
  assert.equal(t.game.turn, 1);
  assert.equal(t.clockAt, at + 200 + GAMBIT_TURN_END_MS + GAMBIT_TURN_MS, 'the guest\'s own clock');
});

test('KG5 THE CLOCK: a turn run out ends as End turn does; a seat it ends GAMBIT_IDLE_TURNS times running is stood up, its game the other\'s (\'idle\'); an action in between starts the count again (mutants: the timeout; the count; the reset)', () => {
  const { t, rand32, at } = dealt(5);
  let now = at;
  const runOut = () => {
    now = t.clockAt;
    const m = gambitTick(t, now, rand32);
    now = t.endAt ?? now;
    const n = t.game ? gambitTick(t, now, rand32) : [];
    return [...m, ...n];
  };
  let all = runOut();   // the host's turn, run out
  assert.ok(all[0].frame.events.some((e) => e.t === 'timeout' && e.seat === 0));
  assert.equal(t.seats[0].idle, 1);
  all = runOut();   // the guest's, run out
  assert.equal(t.seats[1].idle, 1);
  // the host acts: its count starts again
  gambitCommand(t, { id: 'a', cmd: { type: 'end' }, gameNo: t.gameNo, now: now + 10, rand32 });
  assert.equal(t.seats[0].idle, 0);
  now = t.endAt; gambitTick(t, now, rand32);
  all = runOut();   // the guest's second
  runOut();   // the host's, run out (1)
  all = runOut();   // the guest's third: stood up
  const ev = all.flatMap((m) => m.frame.events);
  const end = ev.find((e) => e.t === 'result');
  assert.ok(end && end.winner === 0 && end.how === 'idle', 'the guest\'s third run-out stands it up, the host the winner');
  assert.ok(ev.some((e) => e.t === 'leave' && e.seat === 1 && e.idle));
  assert.equal(t.seats[1], null);
  assert.equal(t.game, null);
  assert.equal(GAMBIT_IDLE_TURNS, 3);
});

test('KG5 A FORFEIT AND A STAND: the forfeit keeps its chair, the stand (a socket gone too) leaves it - each a game the other seat\'s; after a game both seats are ready again only by saying so; a broken source is no contest (mutants: the winner; the chair kept; the readiness reset)', () => {
  const { t, rand32, at } = dealt(7);
  assert.equal(gambitForfeit(t, { id: 'a', gameNo: 0, now: at + 1 }), 'stale');
  const f = gambitForfeit(t, { id: 'a', gameNo: 1, now: at + 1 });
  const end = f[0].frame.events.find((e) => e.t === 'result');
  assert.deepEqual([end.winner, end.how], [1, 'forfeit']);
  assert.equal(gambitSeatOf(t, 'a'), 0, 'its chair kept');
  assert.ok(t.seats.every((s) => !s.ready && s.army === null), 'ready again only by saying so');
  assert.equal(t.last.winner, 1);
  assert.ok(validGambitState(t.last.game), 'the board it ended on kept with the end');
  assert.equal(gambitNextAt(t), null, 'nothing due till both are ready');
  // a stand mid-game
  gambitReady(t, { id: 'a', army: army(1), now: at + 2 }); gambitReady(t, { id: 'b', army: army(2), now: at + 2 });
  gambitTick(t, at + 2 + GAMBIT_FIRST_MS, rand32);
  const s = gambitStand(t, { id: 'b', now: at + 5000 });
  const e2 = s[0].frame.events;
  assert.deepEqual([e2[0].t, e2[0].winner, e2[0].how, e2[1].t], ['result', 0, 'left', 'leave']);
  assert.equal(t.seats[1], null);
  // the relay's source broke at a blow: no contest
  // PIN MOVED (AUDIT KG II E1): no seed dealt a blow in reach, so this never ran - the attacker stood beside its foe now
  const v = dealt(11), vg = v.t.game;
  vg.tiles = vg.tiles.map(() => KG_TILE.floor); vg.hazards = [];
  const atk = vg.pieces.find((p) => p.side === 0 && !p.king && !p.ranged), foe = vg.pieces.find((p) => p.side === 1 && !p.king);
  for (const p of vg.pieces) if (p !== atk && p !== foe) { p.col = p.side ? 14 - (p.id % 7) : p.id % 7; p.row = p.side ? 0 : 12; }
  atk.col = 7; atk.row = 6; foe.col = 7; foe.row = 5;
  assert.ok(foesInRange(vg, atk).some((x) => x.id === foe.id));
  const r = gambitCommand(v.t, { id: 'a', cmd: { type: 'attack', piece: atk.id, target: foe.id }, gameNo: 1, now: 1, rand32: () => -1 });
  assert.equal(r[0].frame.events[0].how, 'void');
});

test('KG5 A WHOLE GAME AT THE RELAY: two seats played by the regulars\' careful rules through the table\'s own commands and clock, to a king\'s fall - every frame the client\'s check takes, the end said once (mutant: a frame the client refuses)', () => {
  for (const seed of [1, 5]) {
    const { t, rand32, msgs, at } = dealt(seed);
    const ai = xorshift(seed + 100);
    const frames = [...msgs];
    let now = at;
    for (let i = 0; i < 4000 && t.game; i++) {
      now += 10;
      if (t.endAt !== null) { now = Math.max(now, t.endAt); frames.push(...gambitTick(t, now, rand32)); continue; }
      const side = t.game.turn, id = t.seats[side].id;
      const cmd = regularAction(t.game, side, { blunder: 0 }, ai) ?? { type: 'end' };
      const m = gambitCommand(t, { id, cmd, gameNo: t.gameNo, now, rand32 });
      assert.ok(Array.isArray(m), `the regulars' command is the law's: ${m}`);
      frames.push(...m);
    }
    const ends = frames.flatMap((m) => m.frame.events).filter((e) => e.t === 'result');
    assert.equal(ends.length, 1, 'one end');
    assert.equal(ends[0].how, 'king');
    for (const m of frames) assert.ok(validGambitOut(frameOf(m)), `every frame the client takes: ${JSON.stringify(m.frame.events.map((e) => e.t))}`);
    assert.ok(gambitTableValid(t), 'the table as it is stored');
  }
});

test('KG5 THE STORED TABLE, CHECKED (AUDIT KG A4): a live table and its game pass; a piece on a wall, two on a cell, a number twice, a wounded past its whole, an unknown layout, a game with an empty seat, an unlawful army at Ready - each dropped (mutants: the floor; the cell; the hp; the seats)', () => {
  const { t } = dealt(13);
  assert.ok(gambitTableValid(t));
  assert.ok(gambitTableValid(JSON.parse(JSON.stringify(t))), 'as the relay\'s storage hands it back');
  const bent = (f) => { const c = JSON.parse(JSON.stringify(t)); f(c); return gambitTableValid(c); };
  const wall = (() => { for (let i = 0; i < t.game.tiles.length; i++) if (t.game.tiles[i] === KG_TILE.wall) return i; return -1; })();
  if (wall >= 0) assert.equal(bent((c) => { c.game.pieces[0].col = wall % KG_COLS; c.game.pieces[0].row = Math.floor(wall / KG_COLS); }), false, 'a piece on a wall');
  assert.equal(bent((c) => { c.game.pieces[1].col = c.game.pieces[0].col; c.game.pieces[1].row = c.game.pieces[0].row; }), false, 'two on a cell');
  assert.equal(bent((c) => { c.game.pieces[1].id = c.game.pieces[0].id; }), false, 'a number twice');
  assert.equal(bent((c) => { c.game.pieces[0].hp = c.game.pieces[0].maxHp + 1; }), false, 'past its whole');
  assert.equal(bent((c) => { c.game.layout = 'the void'; }), false);
  assert.equal(bent((c) => { c.seats[1] = null; }), false, 'a game with an empty seat');
  assert.equal(bent((c) => { c.game = null; c.seats[0].army = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; }), false, 'an unlawful army');
  assert.equal(bent((c) => { c.game.turn = 2; }), false);
  assert.equal(gambitTableValid(null), false);
});

test('KG5 THE WIRE: a client\'s word checked - each op\'s fields, a command\'s numbers in range; the relay\'s word checked on the client - a refusal, the room\'s events and state (mutants: the command\'s check; the state\'s check)', () => {
  assert.deepEqual(validGambitIn({ op: 'sit', table: 2, chair: 1, chairs: 4, crown: 3 }), { op: 'sit', table: 2, chair: 1, chairs: 4, crown: 3 });
  assert.equal(validGambitIn({ op: 'sit', table: 2, chair: 4, chairs: 4, crown: 3 }), null);
  assert.equal(validGambitIn({ op: 'sit', table: 99, chair: 1, chairs: 4, crown: 3 }), null);
  assert.deepEqual(validGambitIn({ op: 'ready', table: 0, army: [1, 2], crown: 1 }), { op: 'ready', table: 0, army: [1, 2], crown: 1 });
  assert.equal(validGambitIn({ op: 'ready', table: 0, army: new Array(13).fill(1) }), null);
  assert.deepEqual(validGambitIn({ op: 'act', table: 0, gameNo: 2, cmd: { type: 'move', piece: 3, col: 4, row: 5, x: 1 } }), { op: 'act', table: 0, gameNo: 2, cmd: { type: 'move', piece: 3, col: 4, row: 5 } });
  assert.equal(validGambitIn({ op: 'act', table: 0, gameNo: 2, cmd: { type: 'move', piece: 3, col: 15, row: 5 } }), null);
  assert.equal(validGambitIn({ op: 'act', table: 0, gameNo: 2, cmd: { type: 'fly' } }), null);
  assert.equal(validGambitIn({ op: 'act', table: 0, cmd: { type: 'end' } }), null, 'a command names its game');
  assert.deepEqual(validGambitIn({ op: 'forfeit', table: 0, gameNo: 1 }), { op: 'forfeit', table: 0, gameNo: 1 });
  assert.deepEqual(validGambitIn({ op: 'look', table: 0, junk: 1 }), { op: 'look', table: 0 });
  assert.equal(validGambitIn({ op: 'deal', table: 0 }), null);
  assert.ok(validGambitOut({ table: 1, error: 'turn' }));
  const { t, msgs } = dealt(3);
  assert.ok(validGambitOut(frameOf(msgs[0])));
  const bad = JSON.parse(JSON.stringify(frameOf(msgs[0])));
  bad.state.game.pieces[0].hp = 0;
  assert.equal(validGambitOut(bad), false, 'a state the law did not mint');
  const look = gambitLook(t, 'c');
  assert.equal(look[0].to, 'c');
  assert.ok(validGambitOut(frameOf(look[0])));
  assert.equal(validGambitOut({ ...frameOf(look[0]), events: [{ t: 'game', gameNo: 1 }] }), false, 'a game said without its layout');
  assert.deepEqual(gambitPublicView(t).seats.map((s) => Object.keys(s).sort()), [['chair', 'crown', 'id', 'name'], ['chair', 'crown', 'id', 'name']]);
});

test('KG5 THE GUEST\'S EYE: the board turned about its middle - twice is the board itself; every piece on its turned cell, its side the other; the law reads the turned board as the board (each piece\'s reach and foes, turned); an event\'s cells and sides turned, a command\'s cell turned back (mutants: the turn; the sides; the command)', () => {
  const st = dealt(17).t.game;
  const f = flipGambitState(st);
  assert.deepEqual(flipGambitState(f), st, 'twice: itself');
  assert.ok(validGambitState(f));
  for (const p of st.pieces) {
    const q = pieceById(f, p.id);
    assert.deepEqual([q.col, q.row], flipCell([p.col, p.row]));
    assert.equal(q.side, 1 - p.side);
    const R = reachable(st, p).map((c) => flipCell(c).join()).sort(), Q = reachable(f, q).map((c) => c.join()).sort();
    assert.deepEqual(Q, R, 'its reach, turned');
    assert.deepEqual(foesInRange(f, q).map((x) => x.id).sort(), foesInRange(st, p).map((x) => x.id).sort(), 'its foes');
  }
  assert.deepEqual([f.turn, f.potions], [1 - st.turn, [st.potions[1], st.potions[0]]]);
  assert.deepEqual(flipGambitEvent({ t: 'move', side: 0, piece: 1, from: [0, 0], to: [1, 2] }), { t: 'move', side: 1, piece: 1, from: [KG_COLS - 1, KG_ROWS - 1], to: [KG_COLS - 2, KG_ROWS - 3] });
  assert.deepEqual(flipGambitEvent({ t: 'sit', seat: 1, chair: 2 }), { t: 'sit', seat: 1, chair: 2 }, 'a room\'s seat stays the relay\'s');
  assert.deepEqual(unflipCommand({ type: 'move', piece: 4, col: 2, row: 3 }), { type: 'move', piece: 4, col: KG_COLS - 3, row: KG_ROWS - 4 });
  assert.deepEqual(unflipCommand({ type: 'attack', piece: 4, target: 5 }), { type: 'attack', piece: 4, target: 5 });
  assert.equal(GAMBIT_TIERS.length, 4);
});
