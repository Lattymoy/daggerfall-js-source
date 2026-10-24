// KG4 (2026-10-14, bible/11-Multiplayer/Kings-Gambit.md sections 5.3, 10.1, 10.7, 14.3, 14.7, 14.8 and 17): THE BOARD
// RAISED - the walk's path (net/kingsGambit.js reachPath), the pieces' motion on the mod's clock (world/gambitMotion.js),
// the press on the built board and the lean fitted to the clear screen (world/gambitCloth.js), the clear screen beside
// the panel (scenes/gambitTableGame.js gambitClear), and the built board's models and poses (render/gambitTableDraw.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KG_COLS, KG_ROWS, KG_TILE, KG_MOVE_RANGE, reachable, reachPath, isPassable, pieceAt, autoFill, KG_POINT_BUDGET } from '../../src/net/kingsGambit.js';
import { GAMBIT_TIERS, dealRegular, regularStep } from '../../src/systems/gambit/gambitPatrons.js';
import { finishTurn } from '../../src/net/kingsGambit.js';
import {
  createGambitMotion, gambitPile, gambitPileStep, GAMBIT_WALK_CELLS_S, GAMBIT_IMPACT_S, GAMBIT_LUNGE_LEAD_S, GAMBIT_LUNGE_S,
  GAMBIT_LUNGE_MELEE, GAMBIT_LUNGE_SHOT, GAMBIT_SHOT_S, GAMBIT_HIT_S, GAMBIT_GLOW_S, GAMBIT_FLOAT_S, GAMBIT_FLOAT_RISE,
  GAMBIT_FALL_AFTER_S, GAMBIT_TOPPLE_S, GAMBIT_PILE_SLIDE_S, GAMBIT_MUSTER_BEAT_S, GAMBIT_SHAKE,
  GAMBIT_HIT_CLIPS, GAMBIT_SWING_CLIPS, GAMBIT_SPELL_CLIPS, GAMBIT_ARCHER_CLASSES, GAMBIT_HAZARD_CLIPS,
} from '../../src/world/gambitMotion.js';
import { SOUND } from '../../src/systems/soundClips.js';
import { ILIAC_THROW_S } from '../../src/world/iliacCloth.js';
import {
  gambitPlaces, gambitPressCell, gambitLean, gambitCardHeight, GAMBIT_CARD_FOOT, GAMBIT_WALL_H, GAMBIT_LEAN_PITCH, GAMBIT_LEAN_FILL,
  GAMBIT_FELT_LONG, GAMBIT_FELT_SHORT, GAMBIT_MAT_LIFT, GAMBIT_WATER_DROP, GAMBIT_SELECT_LIFT, GAMBIT_CARD_SHARE,
} from '../../src/world/gambitCloth.js';
import { gambitClear, GAMBIT_TOUCH_TOP_PX } from '../../src/scenes/gambitTableGame.js';
import {
  matModel, stoneModel, discModel, spikesModel, fxQuadModel, gambitPlateModel, gambitPieceDraws, standingMatrix, facingMatrix,
  gambitFxUv, gambitFxCell, GAMBIT_FX_KEYS, GAMBIT_GLYPHS, GAMBIT_REMAP_HURT, GAMBIT_REMAP_GLOW, GAMBIT_ARCHIVE, GAMBIT_ATLAS,
  GAMBIT_ATLAS_HURT, GAMBIT_ATLAS_GLOW, GAMBIT_FX, gambitCellUv, gambitAtlasCell, createGambitTableDraw, standKey,
} from '../../src/render/gambitTableDraw.js';
import { CARD_W } from '../../src/world/card/cardMotion.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';
import { projectToScreen } from '../../src/player/tapRay.js';
import { xorshift } from '../../tools/kgMeasure.mjs';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const frame = (yaw = Math.PI / 2) => ({ centre: [2, 0.8, -3], axisYaw: yaw, halfLong: 0.75, halfShort: 0.5 });
const LONG = gambitPlaces(frame(), [2, 0, -3.9]), END = gambitPlaces(frame(), [3.4, 0, -3]);
const floor = () => new Array(KG_COLS * KG_ROWS).fill(KG_TILE.floor);
const deal = (seed, tier = GAMBIT_TIERS[1]) => { const r = xorshift(seed); return dealRegular({ army: autoFill([], KG_POINT_BUDGET, r), tier, rand32: r }); };

test('KG4 THE WAY A MOVE WALKED (AUDIT KG C22): reachPath meets every cell reachable meets, by a path a step a cell over floor and through no piece, never longer than the move - and none to a cell the walk does not reach (mutants: a piece passed through; the range)', () => {
  let paths = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const st = deal(seed);
    for (const p of st.pieces) {
      const reach = reachable(st, p);
      for (const [c, r] of reach) {
        const path = reachPath(st, p, c, r);
        assert.ok(path, `${seed}: a path to every reachable cell`);
        assert.deepEqual(path[0], [p.col, p.row]);
        assert.deepEqual(path.at(-1), [c, r]);
        assert.ok(path.length - 1 <= KG_MOVE_RANGE, 'never longer than the move');
        for (let i = 1; i < path.length; i++) {
          const [a, b] = [path[i - 1], path[i]];
          assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1, 'a step a cell');
          assert.ok(isPassable(st.tiles, b[0], b[1]) && !pieceAt(st, b[0], b[1]), 'over floor, through no piece');
        }
        paths++;
      }
      // a cell the walk does not reach: none (a wall, a piece, its own cell, past the range)
      assert.equal(reachPath(st, p, p.col, p.row), null);
      for (let r = 0; r < KG_ROWS; r++) for (let c = 0; c < KG_COLS; c++) {
        if (!reach.some(([x, y]) => x === c && y === r)) assert.equal(reachPath(st, p, c, r), null, `${seed}: (${c}, ${r}) unreached`);
      }
    }
  }
  assert.ok(paths > 500, `${paths} paths walked`);
  // round a wall, not through it: (5, 6) to (7, 5) with a wall on (6, 6) - three steps over its corner's floor
  const tiles = floor();
  tiles[6 * KG_COLS + 6] = KG_TILE.wall;
  const board = { tiles, hazards: [], pieces: [{ id: 1, side: 0, col: 5, row: 6 }] };
  const path = reachPath(board, board.pieces[0], 7, 5);
  assert.equal(path.length, 4, 'three steps');
  assert.ok(!path.some(([c, r]) => c === 6 && r === 6), 'none on the wall');
  assert.equal(reachPath(board, board.pieces[0], 7, 6), null, 'and four steps round it is past the range: none');
});

test('KG4 THE MOTION ON THE MOD\'S CLOCK (10.1, 2.10): the walk along its path at 3.5 cells a second; a blow\'s lunge 0.1 s before its impact, 0.28 s, 0.15 of a cell (0.06 for a shot); a shot\'s bolt 0.3 s; the hit\'s 0.45 s shake and flash - no shake under reduced motion; the number rising 0.8 of a cell over 1 s (mutants: the speed; the path; the lunge\'s reach; the shot\'s flight; the reduced shake)', () => {
  const tiles = floor();
  tiles[6 * KG_COLS + 6] = KG_TILE.wall;
  const a = { id: 1, side: 0, unit: 41, king: false, ranged: false, col: 5, row: 6, hp: 30, maxHp: 30 };
  const b = { id: 2, side: 1, unit: 41, king: false, ranged: false, col: 9, row: 5, hp: 30, maxHp: 30 };
  const archer = { id: 3, side: 0, unit: 128, king: false, ranged: true, col: 9, row: 10, hp: 30, maxHp: 30 };
  const st0 = { tiles, hazards: [], pieces: [a, b, archer] };
  const m = createGambitMotion();
  m.feed([], 0, st0);
  // the walk round the wall's corner: (5,6) -> (7,5), three cells a path - never across the wall's cell
  const st1 = { ...st0, pieces: [{ ...a, col: 7, row: 5 }, b, archer] };
  m.feed([{ t: 'move', side: 0, piece: 1, from: [5, 6], to: [7, 5], at: 1000 }], 1000, st1);
  const at = (now) => m.poses(st1, now).pieces.find((p) => p.id === 1).at;
  assert.deepEqual(at(1000), [5, 6], 'it starts at its old cell');
  const per = 1000 / GAMBIT_WALK_CELLS_S;
  for (let k = 0; k <= 30; k++) { const q = at(1000 + (k / 30) * 3 * per); assert.ok(!(q[0] > 5.5 && q[0] < 6.5 && q[1] > 5.5), `never on the wall: ${q}`); }
  const mid = at(1000 + 2 * per);
  assert.ok(near(mid[0], 6, 1e-6) && near(mid[1], 5, 1e-6), `two steps in it stands at (6, 5): ${mid}`);
  assert.deepEqual(at(1000 + 3 * per + 1), [7, 5], 'and on its new cell once walked');
  assert.ok(m.moving(1000 + 2 * per) && !m.moving(1000 + 3 * per + 1));
  // a melee blow, ordered while the walk still moves the piece: it waits for its walk
  const st2 = { ...st1, pieces: [{ ...a, col: 7, row: 5 }, { ...b, col: 9, row: 5, hp: 22 }, archer] };
  m.feed([{ t: 'attack', side: 0, piece: 1, target: 2, damage: 8, killed: false, shot: false, at: 1100 }], 1100, st2);
  const t0 = 1000 + 3 * per, impact = t0 + GAMBIT_IMPACT_S * 1000, lungeFrom = impact - GAMBIT_LUNGE_LEAD_S * 1000;
  const pose = (id, now, o) => m.poses(st2, now, o).pieces.find((p) => p.id === id);
  assert.deepEqual(pose(1, lungeFrom - 1).tip, [0, 0], 'no lunge before its time');
  const peak = pose(1, lungeFrom + (GAMBIT_LUNGE_S * 1000) / 2).tip;
  assert.ok(near(peak[0], GAMBIT_LUNGE_MELEE, 1e-3) && near(peak[1], 0, 1e-9), `the lunge's peak toward the foe, 0.15 of a cell: ${peak}`);
  assert.equal(pose(2, impact - 1).flash, false);
  assert.equal(pose(2, impact + 1).flash, true, 'struck at the impact');
  const shake = pose(2, impact + 50).shake;
  assert.ok(Math.hypot(...shake) > 0.05, 'knocked and shaken');
  assert.deepEqual(pose(2, impact + 50, { reduced: true }).shake, [0, 0], 'reduced motion: no shake');
  assert.equal(pose(2, impact + 50, { reduced: true }).flash, true, 'the flash stays');
  assert.equal(pose(2, impact + GAMBIT_HIT_S * 1000 + 1).flash, false, 'the hit lasts 0.45 s');
  const f = m.poses(st2, impact + 500).floats.find((x) => x.text === '-8');
  assert.ok(f && near(f.rise, GAMBIT_FLOAT_RISE * 0.5, 1e-6), 'the number half risen at half its second');
  assert.equal(m.poses(st2, impact + GAMBIT_FLOAT_S * 1000 + 1).floats.length, 0);
  // a shot: its lunge 0.06, its bolt from the impact for 0.3 s, the foe struck when it lands
  m.feed([{ t: 'attack', side: 0, piece: 3, target: 2, damage: 5, killed: false, shot: true, at: 5000 }], 5000, st2);
  const si = 5000 + GAMBIT_IMPACT_S * 1000;
  const sp = pose(3, si - GAMBIT_LUNGE_LEAD_S * 1000 + (GAMBIT_LUNGE_S * 1000) / 2).tip;
  assert.ok(near(Math.hypot(...sp), GAMBIT_LUNGE_SHOT, 1e-3), 'a shot\'s lunge 0.06');
  const bolt = m.poses(st2, si + (GAMBIT_SHOT_S * 1000) / 2).shots;
  assert.equal(bolt.length, 1);
  assert.ok(near(bolt[0].at[1], 7.5, 1e-6), 'the bolt half way along its line');
  assert.equal(pose(2, si + GAMBIT_SHOT_S * 1000 - 1).flash, false, 'not struck until it lands');
  assert.equal(pose(2, si + GAMBIT_SHOT_S * 1000 + 1).flash, true);
  assert.ok(GAMBIT_SHAKE > 0.05 && GAMBIT_SHAKE < 0.07, 'the mod\'s 4 px on its 1080-line cell');
});

test('KG4 THE FALL AND THE PILE, THE POTION, THE MUSTER (10.1): the struck card falls 0.27 s after the blow lands, topples, slides to its owner\'s pile and lies there counted; a potion glows 0.6 s; the deal throws each side\'s king first, then its units a beat apart (mutants: the fall\'s wait; the pile\'s count; the king first; the beat)', () => {
  const tiles = floor();
  const a = { id: 1, side: 0, unit: 41, king: false, col: 5, row: 6, hp: 30, maxHp: 30 };
  const b = { id: 2, side: 1, unit: 41, king: false, col: 6, row: 6, hp: 4, maxHp: 30 };
  const c = { id: 3, side: 1, unit: 41, king: false, col: 6, row: 7, hp: 4, maxHp: 30 };
  const m = createGambitMotion();
  m.lay(false);
  m.feed([], 0, { tiles, hazards: [], pieces: [a, b, c] });
  const after = { tiles, hazards: [], pieces: [a, c] };
  m.feed([{ t: 'attack', side: 0, piece: 1, target: 2, damage: 8, killed: true, shot: false, at: 1000 }], 1000, after);
  const lands = 1000 + GAMBIT_IMPACT_S * 1000, falls = lands + GAMBIT_FALL_AFTER_S * 1000;
  const of = (now) => m.poses(after, now).pieces.find((p) => p.id === 2);
  assert.ok(of(falls - 1) && !of(falls - 1).fall, 'the fallen still stand until their fall');
  assert.ok(of(falls + 10).fall && of(falls + 10).fall.k > 0 && near(of(falls + 10).fall.dir[0], 1), 'toppling away from its attacker');
  const piled = of(falls + (GAMBIT_TOPPLE_S + GAMBIT_PILE_SLIDE_S) * 1000 + 1);
  assert.ok(piled.pile && piled.pile.k === 1 && piled.pile.index === 0, 'lying in the pile');
  assert.deepEqual(piled.pile.at, gambitPile(false, 1));
  // a hazard's bite falls its victim too - the pile counts on
  const last = { tiles, hazards: [], pieces: [a] };
  m.feed([{ t: 'hazard', side: 1, piece: 3, kind: 'fire', damage: 8, killed: true, at: 3000 }], 3000, last);
  const third = m.poses(last, 3000 + 2000).pieces.find((p) => p.id === 3);
  assert.equal(third.pile.index, 1, 'its pile\'s second');
  assert.deepEqual(m.poses(last, 6000).piles, [0, 2]);
  // a potion: green 0.6 s, its number "+n"
  m.feed([{ t: 'potion', side: 0, piece: 1, healed: 12, at: 7000 }], 7000, last);
  const one = (now) => m.poses(last, now).pieces.find((p) => p.id === 1);
  assert.ok(one(7001).glow && !one(7000 + GAMBIT_GLOW_S * 1000 + 1).glow);
  assert.ok(m.poses(last, 7100).floats.some((f) => f.text === '+12'));
  // THE MUSTER: a new game - each side's king first, then its units in the deployment's order, a beat apart
  const st = deal(5);
  const mm = createGambitMotion();
  mm.feed([{ t: 'game', at: 10000 }], 10000, st);
  for (const side of [0, 1]) {
    const mine = st.pieces.filter((p) => p.side === side), king = mine.find((p) => p.king), units = mine.filter((p) => !p.king);
    assert.equal(mm.poses(st, 9999).pieces.length, 0, 'nothing dealt before the deal');
    const k = mm.poses(st, 10001).pieces.find((p) => p.id === king.id);
    assert.ok(k?.thrown, 'the king thrown first');
    assert.ok(!mm.poses(st, 10001).pieces.some((p) => p.id === units[0].id), 'its first unit not yet');
    const u = mm.poses(st, 10000 + GAMBIT_MUSTER_BEAT_S * 1000 + 1).pieces.find((p) => p.id === units[0].id);
    assert.ok(u?.thrown && u.thrown.from[1] === (side === 0 ? KG_ROWS - 1 + 2.5 : -2.5), 'then its first unit, from its owner\'s edge');
  }
  const done = 10000 + (GAMBIT_MUSTER_BEAT_S * 12 + ILIAC_THROW_S) * 1000 + 1;
  assert.ok(mm.poses(st, done).pieces.every((p) => !p.thrown), 'all stood up');
  assert.equal(mm.poses(st, done).pieces.length, st.pieces.length);
});

test('KG4 THE PILES LIE ON THE FELT, OFF THE BOARD - on its owner\'s right at its own edge, fanned along the board\'s edge, from a long side and from an end (mutant: a pile on the board)', () => {
  for (const [P, end] of [[LONG, false], [END, true]]) {
    for (const side of [0, 1]) {
      const [c, r] = gambitPile(end, side), step = gambitPileStep(end, side);
      const onBoard = (x, y) => x > -0.5 && x < KG_COLS - 0.5 && y > -0.5 && y < KG_ROWS - 0.5;
      for (let i = 0; i < 13; i++) {
        const x = c + step[0] * i, y = r + step[1] * i, w = P.at(x, y);
        assert.ok(!onBoard(x, y), `${end ? 'end' : 'long'} ${side} #${i}: off the board (${x}, ${y})`);
        const f = frame(), along = (w[0] - f.centre[0]) * Math.sin(f.axisYaw) + (w[2] - f.centre[2]) * Math.cos(f.axisYaw);
        const across = (w[0] - f.centre[0]) * Math.cos(f.axisYaw) - (w[2] - f.centre[2]) * Math.sin(f.axisYaw);
        assert.ok(Math.abs(along) < GAMBIT_FELT_LONG / 2 && Math.abs(across) < GAMBIT_FELT_SHORT / 2, `${end ? 'end' : 'long'} ${side} #${i}: on the felt`);
      }
    }
  }
});

test('KG4 THE PRESS ON THE BUILT BOARD (14.3): a press on a standing card\'s face is its cell, not the cell the ray reaches on the mat behind it; on a wall\'s top the wall\'s cell; the mat otherwise; off the board, none (mutants: the card\'s height; the wall\'s top)', () => {
  const P = LONG, tiles = floor();
  tiles[5 * KG_COLS + 4] = KG_TILE.wall;
  const board = { tiles, pieces: [{ col: 7, row: 8 }] };
  const H = gambitCardHeight(P.cell);
  // an eye at the host's side, low: the ray through the card's upper face would reach the mat several rows behind it
  const eyeAt = (c, r) => { const o = P.at(c, r); return [o[0] + P.toHost[0] * 0.5, P.top + 0.12, o[2] + P.toHost[1] * 0.5]; };
  const through = (eye, p) => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], m = Math.hypot(...d); return d.map((x) => x / m); };
  const card = P.at(7, 8), eye = eyeAt(7, 8);
  const hit = [card[0], P.top + GAMBIT_CARD_FOOT + H * 0.8, card[2]];
  assert.deepEqual(gambitPressCell(P, board, eye, through(eye, hit)), [7, 8], 'the card\'s face: its cell');
  assert.notDeepEqual(P.cellAt([eye[0] + through(eye, hit)[0] * 2, 0, 0]), [7, 8]);
  assert.deepEqual(gambitPressCell(P, { tiles, pieces: [] }, eye, through(eye, hit))?.[0], 7, 'no card there: the mat behind');
  assert.notDeepEqual(gambitPressCell(P, { tiles, pieces: [] }, eye, through(eye, hit)), [7, 8]);
  // a wall's top
  const w = P.at(4, 5), weye = eyeAt(4, 5);
  const top = [w[0] - P.toHost[0] * P.cell * 0.3, P.top + GAMBIT_WALL_H, w[2] - P.toHost[1] * P.cell * 0.3];
  assert.deepEqual(gambitPressCell(P, board, weye, through(weye, top)), [4, 5], 'the wall\'s top: the wall\'s cell');
  // the mat, and off the board
  const m = P.at(2, 2), meye = [m[0], P.top + 0.6, m[2]];
  assert.deepEqual(gambitPressCell(P, board, meye, [0, -1, 0]), [2, 2]);
  assert.equal(gambitPressCell(P, board, [P.at(-4, 2)[0], P.top + 0.6, P.at(-4, 2)[2]], [0, -1, 0]), null);
  assert.equal(gambitPressCell(P, board, meye, [0, 1, 0]), null, 'a ray up the room presses nothing');
});

test('KG4 THE LEAN (10.7, 14.7): pitched 55 degrees down over the board, the whole board and its head row\'s cards fitted inside the clear screen and centred there - at a desktop\'s whole screen the record\'s first guess (about 0.6 m over the felt, 0.1 m back from the near edge), beside a panel\'s column, over a phone\'s strip, left of a landscape phone\'s column; from a long side and from an end (mutants: the screen\'s up; the fit\'s fill; the centring)', () => {
  const fovY = (65 * Math.PI) / 180;
  for (const P of [LONG, END]) {
    for (const [aspect, clear] of [[16 / 9, { x0: 0, x1: 1, y0: 0, y1: 1 }], [1280 / 800, { x0: 0, x1: 0.55, y0: 0, y1: 1 }], [390 / 844, { x0: 0, x1: 1, y0: 0.08, y1: 0.75 }], [844 / 390, { x0: 0, x1: 0.7, y0: 0, y1: 1 }]]) {
      const L = gambitLean(P, { aspect, fovY, clear });
      assert.ok(near(Math.asin(-L.fwd[1]), GAMBIT_LEAN_PITCH, 1e-9), 'pitched 55 degrees');
      assert.ok(near(L.fwd[0] * -P.toHost[0] + L.fwd[2] * -P.toHost[1], Math.cos(GAMBIT_LEAN_PITCH), 1e-9), 'looking toward the head');
      // the board's box inside the clear screen, in the projection's units (x right, y up)
      const cx0 = clear.x0 * 2 - 1, cx1 = clear.x1 * 2 - 1, cy0 = 1 - clear.y1 * 2, cy1 = 1 - clear.y0 * 2;
      const b = L.box, tol = 0.02;
      assert.ok(b.x0 >= cx0 - tol && b.x1 <= cx1 + tol && b.y0 >= cy0 - tol && b.y1 <= cy1 + tol, `${aspect.toFixed(2)}: the board inside the clear screen ${JSON.stringify(b)}`);
      assert.ok(near((b.x0 + b.x1) / 2, (cx0 + cx1) / 2, 0.02) && near((b.y0 + b.y1) / 2, (cy0 + cy1) / 2, 0.02), 'centred there');
      const fill = Math.max((b.x1 - b.x0) / (cx1 - cx0), (b.y1 - b.y0) / (cy1 - cy0));
      assert.ok(near(fill, GAMBIT_LEAN_FILL, 0.02), `filling it to the margin: ${fill}`);
    }
  }
  // THROUGH THE RENDERER'S OWN LENS (perspective, mirrorProjectionX, lookAt - the frame's matrices, tapRay's projection):
  // the board's corners on the screen inside the clear part, in CSS px, y down - the solver's own box is no witness
  for (const P of [LONG, END]) {
    for (const [w, h, clear] of [[1280, 800, { x0: 0, x1: 0.55, y0: 0, y1: 1 }], [390, 844, { x0: 0, x1: 1, y0: 0.08, y1: 0.75 }], [844, 390, { x0: 0, x1: 0.7, y0: 0, y1: 1 }]]) {
      const L = gambitLean(P, { aspect: w / h, fovY, clear });
      const proj = mirrorProjectionX(perspective(fovY, w / h, 0.02, 100));
      const view = lookAt(L.eye, [L.eye[0] + L.fwd[0], L.eye[1] + L.fwd[1], L.eye[2] + L.fwd[2]], [0, 1, 0]);
      const on = P.corners.map((c) => projectToScreen(c, w, h, proj, view, null));
      const xs = on.map((q) => q.x / w), ys = on.map((q) => q.y / h);
      assert.ok(on.every((q) => q.front), 'in front of the eye');
      assert.ok(Math.min(...xs) >= clear.x0 - 0.01 && Math.max(...xs) <= clear.x1 + 0.01, `${w}x${h}: across, inside the clear screen ${xs.map((x) => x.toFixed(2))}`);
      assert.ok(Math.min(...ys) >= clear.y0 - 0.01 && Math.max(...ys) <= clear.y1 + 0.01, `${w}x${h}: down, inside it ${ys.map((y) => y.toFixed(2))}`);
      const head = Math.min(...ys), foot = Math.max(...ys);
      assert.ok(head < foot && ys[2] < ys[0], 'the head up the screen, the foot down it');
      // centred there, the head row's cards standing counted in: the middle of what the eye sees is the clear screen's
      const H = gambitCardHeight(P.cell);
      const tops = [P.corners[2], P.corners[3]].map((c) => projectToScreen([c[0], c[1] + H, c[2]], w, h, proj, view, null));
      const all = [...on, ...tops], ax = all.map((q) => q.x / w), ay = all.map((q) => q.y / h);
      assert.ok(near((Math.min(...ax) + Math.max(...ax)) / 2, (clear.x0 + clear.x1) / 2, 0.01), `${w}x${h}: centred across`);
      assert.ok(near((Math.min(...ay) + Math.max(...ay)) / 2, (clear.y0 + clear.y1) / 2, 0.01), `${w}x${h}: centred down ${((Math.min(...ay) + Math.max(...ay)) / 2).toFixed(3)}`);
    }
  }
  // the record's first guess at a desktop's whole screen, from a long side
  const L = gambitLean(LONG, { aspect: 16 / 9, fovY });
  const nearEdge = [(LONG.corners[0][0] + LONG.corners[1][0]) / 2, (LONG.corners[0][2] + LONG.corners[1][2]) / 2];
  const back = (L.eye[0] - nearEdge[0]) * LONG.toHost[0] + (L.eye[2] - nearEdge[1]) * LONG.toHost[1];
  assert.ok(L.eye[1] - 0.8 > 0.5 && L.eye[1] - 0.8 < 0.7, `over the felt: ${L.eye[1] - 0.8}`);
  assert.ok(back > 0 && back < 0.15, `just back from the near edge: ${back}`);
});

test('KG4 THE CLEAR SCREEN (14.7): the largest of what lies left of the panel, right of it and above it - the desktop\'s column, the phone\'s strip, the landscape phone\'s column; under the touch layer\'s presses on a touch device; read in the world\'s strip (mutants: the largest; the touch band)', () => {
  const box = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
  assert.deepEqual(gambitClear(null, { w: 1280, h: 800 }), { x0: 0, x1: 1, y0: 0, y1: 1 });
  assert.deepEqual(gambitClear(box(704, 0, 1264, 800), { w: 1280, h: 800 }), { x0: 0, x1: 0.55, y0: 0, y1: 1 }, 'the desktop\'s column: left of it');
  const phone = gambitClear(box(0, 670, 390, 844), { w: 390, h: 844 }, true);
  assert.ok(near(phone.y1, 670 / 844) && near(phone.y0, GAMBIT_TOUCH_TOP_PX / 844) && phone.x0 === 0 && phone.x1 === 1, 'the phone\'s strip: above it, under the touch layer');
  const land = gambitClear(box(590, 140, 844, 390), { w: 844, h: 390 }, true);
  assert.ok(near(land.x1, 590 / 844) && land.x0 === 0, 'a landscape phone\'s column: left of it');
  // the world's strip: a docked bar under the world takes its share off the bottom (Unity's y from the foot)
  const docked = gambitClear(box(0, 300, 400, 380), { w: 400, h: 400, rect: { x: 0, y: 0.2, w: 1, h: 0.8 } });
  assert.ok(near(docked.y1, 300 / 400 / 0.8), 'read in the world\'s strip');
});

test('KG4 THE BUILT BOARD\'S MODELS (5.3, 10.1): the mat\'s top faces up and its water lies GAMBIT_WATER_DROP under it, its recess\'s walls facing in and its slab\'s edges out, down to the felt; the walls a block a cell, the pillars a column, the Open field none; every face wound as the renderer winds (mutants: the winding; the recess; the slab)', () => {
  const st = deal(3);
  const tiles = st.tiles.slice();
  tiles[0] = KG_TILE.water;
  for (const P of [LONG, END]) {
    const m = matModel(P, tiles);
    const pos = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
    const nrm = (i) => [m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]];
    let tops = 0, low = 0, walls = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [pos(m.indices[t]), pos(m.indices[t + 1]), pos(m.indices[t + 2])], n = nrm(m.indices[t]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, 'wound along its normal');
      if (n[1] > 0.9) { tops++; if (near(a[1], P.top - GAMBIT_WATER_DROP, 1e-7)) low++; else assert.ok(near(a[1], P.top, 1e-7)); }
      else { walls++; assert.ok(Math.min(a[1], b[1], c[1]) >= P.top - GAMBIT_MAT_LIFT - 1e-7); }
    }
    const water = tiles.filter((t) => t === KG_TILE.water).length;
    assert.equal(tops, 2 * KG_COLS * KG_ROWS, 'a quad a cell');
    assert.equal(low, 2 * water, 'the water recessed');
    assert.ok(walls >= 8, 'the slab\'s edges and the recess\'s walls');
  }
  assert.equal(stoneModel(LONG, floor()), null, 'the Open field: no stone');
  const walls = tiles.filter((t) => t === KG_TILE.wall).length, pillars = tiles.filter((t) => t === KG_TILE.pillar).length;
  const sm = stoneModel(LONG, tiles);
  if (walls + pillars) assert.equal(sm.indices.length / 3, walls * 10 + pillars * 24, 'a block five faces, a column twelve sides and its top');
  for (const model of [discModel('stand-0'), spikesModel(), fxQuadModel('flame'), fxQuadModel('ring', true)]) assert.equal(model.subMeshes[0].textureRecord, GAMBIT_FX);
});

test('KG4 THE CARDS STANDING (10.1, 14.8): a standee - its picture on both faces, the back\'s turned to read right way round from behind; a standing card a rotation (no mirror), its face to its owner, its foot on its disc, scaled to the cell; the chosen lifted 1 cm in a brass-rimmed stand; the hurt card drawn red, the healed green; a thrown or piled card no stand and no bar; the bar its health\'s share (mutants: the back\'s turn; the face\'s side; the lift; the remaps)', () => {
  const pm = gambitPlateModel('u41'), [u0, , u1] = gambitCellUv(gambitAtlasCell('u41'));
  // the back's four corners are vertices 4..7 (cardTableDraw.js plateModel's second quad): -X takes u1
  assert.ok(near(pm.uvs[8], u1, 1e-6) && near(pm.uvs[10], u0, 1e-6), 'the back\'s u turned');
  for (const side of [0, 1]) {
    const foot = LONG.at(5, 5), M = standingMatrix(LONG, side, [foot[0], LONG.top, foot[2]], [0, 1, 0]);
    const X = [M[0], M[1], M[2]], Y = [M[4], M[5], M[6]], Z = [M[8], M[9], M[10]];
    const det = X[0] * (Y[1] * Z[2] - Y[2] * Z[1]) - X[1] * (Y[0] * Z[2] - Y[2] * Z[0]) + X[2] * (Y[0] * Z[1] - Y[1] * Z[0]);
    assert.ok(det > 0, 'a rotation, no mirror (the renderer culls a mirrored face)');
    const s = (GAMBIT_CARD_SHARE * LONG.cell) / CARD_W;
    assert.ok(near(Math.hypot(...X), s, 1e-6) && near(Math.hypot(...Z), s, 1e-6) && near(Math.hypot(...Y), 1, 1e-6), 'scaled to the cell');
    assert.ok(Z[1] > 0.99 * s, 'its top up');
    const toOwner = side === 0 ? LONG.toHost : [-LONG.toHost[0], -LONG.toHost[1]];
    assert.ok(near(Y[0] * toOwner[0] + Y[2] * toOwner[1], 1, 1e-6), 'its face toward its owner');
    assert.ok(near(M[13], LONG.top + gambitCardHeight(LONG.cell) / 2, 1e-6), 'its middle a half card over its foot');
  }
  const base = { side: 0, king: false, unit: 41, hp: 15, maxHp: 30, at: [3, 3], tip: [0, 0], shake: [0, 0], flash: false, glow: false, thrown: null, fall: null, pile: null };
  const [plain, chosen, hurt, healed, thrown, piled] = gambitPieceDraws(LONG, [
    { ...base, id: 1 }, { ...base, id: 2 }, { ...base, id: 3, flash: true }, { ...base, id: 4, glow: true },
    { ...base, id: 5, thrown: { k: 0.5, from: [3, 14.5] } }, { ...base, id: 6, pile: { k: 1, at: [16.2, 10], index: 2 } },
  ], { selected: 2 });
  assert.ok(near(chosen.plate[13] - plain.plate[13], GAMBIT_SELECT_LIFT, 1e-6), 'the chosen lifted 1 cm');
  assert.equal(standKey({ side: 0, king: false }, true), 'stand-0-on');
  assert.equal(plain.remap, null);
  assert.equal(hurt.remap, GAMBIT_REMAP_HURT); assert.equal(healed.remap, GAMBIT_REMAP_GLOW);
  assert.equal(GAMBIT_REMAP_HURT.get(`${GAMBIT_ARCHIVE}_${GAMBIT_ATLAS}`), `${GAMBIT_ARCHIVE}_${GAMBIT_ATLAS_HURT}`);
  assert.equal(GAMBIT_REMAP_GLOW.get(`${GAMBIT_ARCHIVE}_${GAMBIT_ATLAS}`), `${GAMBIT_ARCHIVE}_${GAMBIT_ATLAS_GLOW}`);
  assert.ok(plain.disc && plain.bar && near(plain.bar.share, 0.5), 'standing: a stand and its bar, half full');
  assert.ok(!thrown.disc && !thrown.bar && !piled.disc && !piled.bar, 'thrown or piled: neither');
  assert.ok(near(piled.plate[13], LONG.top - GAMBIT_MAT_LIFT + 3 * 0.001, 1e-6), 'the third in its pile, on the felt');
  // a billboard turned to the eye, upright, its X the viewer's right
  const F = facingMatrix([0, 1, 0], [0, 1, 5], 2, 1);
  assert.ok(near(F[10], 1) && near(F[5], 1) && near(F[0], 2), 'facing the eye, upright, its width');
});

test('KG4 THE EFFECTS\' ATLAS: a cell a key, the glyph strip\'s twelve each three by five, every UV inside its own cell (mutant: a cell\'s place)', () => {
  assert.equal(new Set(GAMBIT_FX_KEYS).size, GAMBIT_FX_KEYS.length);
  assert.equal(GAMBIT_FX_KEYS.length, 32);
  for (const ch of '0123456789+-') {
    assert.ok(GAMBIT_FX_KEYS.includes(ch));
    assert.equal(GAMBIT_GLYPHS[ch].length, 5);
    assert.ok(GAMBIT_GLYPHS[ch].every((row) => /^[01]{3}$/.test(row)));
  }
  for (const k of GAMBIT_FX_KEYS) {
    const [c, r] = gambitFxCell(k), [a, b, cc, d] = gambitFxUv(k);
    assert.ok(a > c / 8 && cc < (c + 1) / 8 && d < 1 - r / 4 && b > 1 - (r + 1) / 4, `${k} inside its cell`);
  }
});

test('KG4 THE DRAW: the atlas and its hurt and healed tints, the effects\' atlas a cutout, the mat; the slab and the stone made again only for a new board; each kind of mesh once; the stands and the bars only where a card stands; all freed once (mutants: a tint; the cutout; a mesh a draw)', () => {
  const made = [], freed = [], released = [], uploads = [], drawn = [];
  const own = { measureText: (t) => ({ width: String(t).length * 5 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) };
  const tints = [];
  const ctx = new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { if (k === 'globalCompositeOperation') tints.push(v); o[k] = v; return true; } });
  const doc = { createElement: () => ({ getContext: () => ctx }) };
  const renderer = { createMesh: (m) => { made.push(m); return { m }; }, drawMesh: (m, mat, remap) => drawn.push([m, mat, remap]), destroyMesh: (m) => freed.push(m), uploadTexture: (a, r, c, o) => uploads.push([r, o]), releaseTexture: (a, r) => released.push(r) };
  const d = createGambitTableDraw(renderer, { doc });
  const st = deal(7);
  const look = { layout: st.layout, tiles: st.tiles, hazards: st.hazards, pieces: st.pieces.map((p) => ({ id: p.id, side: p.side, col: p.col, row: p.row, king: p.king, unit: p.unit })), selected: st.pieces[0].id, lit: [], range: [], targets: [], cursor: null, staged: null };
  const m = createGambitMotion();
  m.feed([{ t: 'game', at: 0 }], 0, st);
  const poses = m.poses(st, 60000);
  d.draw({ places: LONG, look, crowns: [3, 0], poses, eye: [0, 2, 0], now: 60000 });
  assert.deepEqual(uploads.map((u) => u[0]), [GAMBIT_ATLAS, GAMBIT_ATLAS_HURT, GAMBIT_ATLAS_GLOW, GAMBIT_FX, 'mat']);
  assert.deepEqual(uploads[3][1], { cutout: true }, 'the effects\' clear texels are no texels');
  assert.deepEqual(tints, ['source-atop', 'source-atop'], 'the hurt and the healed atlases each tinted over the picture\'s own shape');
  const plates = drawn.filter((x) => x[0].m.subMeshes[0].textureRecord === GAMBIT_ATLAS);
  assert.equal(plates.length, st.pieces.length, 'a card a piece');
  const discs = drawn.filter((x) => x[0].m.subMeshes[0].textureRecord === GAMBIT_FX && x[0].m.indices.length === 6 * 20 * 2);
  assert.equal(discs.length, st.pieces.length, 'a stand a piece');
  const n = made.length;
  d.draw({ places: LONG, look, crowns: [3, 0], poses, eye: [0, 2, 0], now: 60100 });
  assert.equal(made.length, n, 'nothing made again for the same board');
  assert.equal(uploads.length, 5, 'nothing painted again');
  d.draw({ places: LONG, look: { ...look, tiles: floor() }, crowns: [3, 0], poses, eye: [0, 2, 0], now: 60200 });
  assert.ok(made.length > n, 'a new board: its slab made again');
  d.destroy(); d.destroy();
  assert.equal(freed.length, made.length, 'every mesh freed - the old slab and stone when the board changed, the rest at the end');
  assert.equal(new Set(freed).size, freed.length, 'and each once');
  assert.deepEqual(released.filter((r) => r !== 'mat').sort(), [GAMBIT_ATLAS, GAMBIT_ATLAS_GLOW, GAMBIT_ATLAS_HURT, GAMBIT_FX].sort());
  const bare = createGambitTableDraw({}, { doc });
  assert.doesNotThrow(() => bare.draw({ places: LONG, look, crowns: [3, 0], poses }));
});

test('KG4 A GAME PLAYED ON: the motion follows a whole seeded game - every piece the law holds is drawn, every fallen one lies in its owner\'s pile in the order it fell, and nothing moves once the game is still (mutant: a fallen piece lost)', () => {
  const r = xorshift(11);
  const tier = GAMBIT_TIERS[2];
  let st = dealRegular({ army: autoFill([], KG_POINT_BUDGET, r), tier, rand32: r });
  const m = createGambitMotion();
  let now = 0;
  m.feed([{ t: 'game', at: now }], now, st);
  const fell = [[], []];
  for (let k = 0; k < 400 && !st.over; k++) {
    const out = st.ending ? finishTurn(st, r) : regularStep(st, st.turn, tier, r, r);
    if (!out || 'refused' in out) break;
    const before = st;
    st = out.state;
    now += 1500;
    for (const e of out.events) if ((e.t === 'attack' || e.t === 'hazard') && e.killed) { const id = e.t === 'attack' ? e.target : e.piece; fell[before.pieces.find((p) => p.id === id).side].push(id); }
    m.feed(out.events.map((e) => ({ ...e, at: now })), now, st);
  }
  const end = now + 60000;
  const pic = m.poses(st, end);
  assert.ok(!m.moving(end), 'still');
  for (const p of st.pieces) assert.ok(pic.pieces.some((x) => x.id === p.id && !x.pile), 'every standing piece drawn');
  for (const side of [0, 1]) {
    fell[side].forEach((id, i) => {
      const x = pic.pieces.find((q) => q.id === id);
      assert.ok(x?.pile, `${id} piled`);
      assert.equal(x.pile.index, i, 'in the order it fell');
    });
  }
  assert.deepEqual(pic.piles, [fell[0].length, fell[1].length]);
  assert.ok(fell[0].length + fell[1].length > 0, 'the game took some');
});

test('KG4b THE SOUNDS ON THE MOTION\'S CLOCK (5.6, 17.4; the mod\'s IL): a monster\'s walk its move clip at once and half way on; a melee blow the attacker\'s own (a monster\'s attack clip, a calling\'s swing) as ordered and a hit as it lands, the struck\'s bark or PainSound 0.1 s after, BodyFall 0.3 s after a death; an archer\'s ArrowShoot and ArrowHit, a mage\'s cast and SpellImpactMagic; a potion, each hazard\'s bite, a warning, the deal; each handed once, in order (mutants: the archers; the swing; the bark; the fall\'s wait; the hazard\'s clip; the move\'s second; handed twice)', () => {
  const tiles = floor();
  const rat = { id: 1, side: 0, unit: 0, king: false, col: 4, row: 6, hp: 30, maxHp: 30 };
  const mage = { id: 2, side: 0, unit: 128, king: false, ranged: true, col: 4, row: 10, hp: 30, maxHp: 30 };
  const archer = { id: 3, side: 0, unit: 141, king: false, ranged: true, col: 8, row: 10, hp: 30, maxHp: 30 };
  const foe = { id: 4, side: 1, unit: 3, king: false, col: 8, row: 6, hp: 80, maxHp: 80 };   // a giant bat: 124, 125, 126
  const king = { id: 5, side: 0, unit: 145, king: true, col: 1, row: 1, hp: 70, maxHp: 70 };
  const st = { tiles, hazards: [], pieces: [rat, mage, archer, foe, king] };
  const m = createGambitMotion({ pick: () => 1 });
  m.feed([{ t: 'game', at: 0 }], 0, st);
  const all = (now) => m.sounds(now).map((c) => [c.clip, c.at]);
  assert.deepEqual(all(5000), [[SOUND.DrawWeapon, 0]], 'the deal: DrawWeapon');
  assert.deepEqual(all(6000), [], 'handed once');
  const walked = { ...st, pieces: [{ ...rat, col: 7, row: 6 }, mage, archer, foe, king] };
  m.feed([{ t: 'move', side: 0, piece: 1, from: [4, 6], to: [7, 6], at: 10000 }], 10000, walked);
  const half = 10000 + (3 / GAMBIT_WALK_CELLS_S) * 0.5 * 1000;
  assert.deepEqual(all(20000), [[115, 10000], [115, half]], 'a rat\'s move clip at once and half way on');
  // a melee blow: the rat's own attack clip as ordered, a hit as it lands, the bat's bark 0.1 s after
  m.feed([{ t: 'attack', side: 0, piece: 1, target: 4, damage: 5, killed: false, shot: false, at: 30000 }], 30000, walked);
  const lands = 30000 + GAMBIT_IMPACT_S * 1000;
  assert.deepEqual(all(40000), [[117, 30000], [GAMBIT_HIT_CLIPS[1], lands], [125, lands + 100]]);
  // a calling's blow swings; a calling struck cries PainSound
  m.feed([{ t: 'attack', side: 1, piece: 4, target: 5, damage: 5, killed: false, shot: false, at: 50000 }], 50000, walked);
  assert.deepEqual(all(60000).map((x) => x[0]), [126, GAMBIT_HIT_CLIPS[1], SOUND.PainSound], 'a monster strikes a king: its attack clip, a hit, the king\'s pain');
  // a calling's melee blow: one of the three swings (pick 1: SwingMediumPitch), the bat's bark
  const kingNear = { ...walked, pieces: walked.pieces.map((p) => (p.id === 5 ? { ...p, col: 8, row: 7 } : p)) };
  m.feed([{ t: 'move', side: 0, piece: 5, from: [1, 1], to: [1, 2], at: 60500 }], 60500, kingNear);
  all(60900);
  m.feed([{ t: 'attack', side: 0, piece: 5, target: 4, damage: 5, killed: false, shot: false, at: 62000 }], 62000, kingNear);
  assert.deepEqual(all(65000).map((x) => x[0]), [SOUND.SwingMediumPitch, GAMBIT_HIT_CLIPS[1], 125], 'a king swings; the bat barks');
  // shots: the archer's arrow, the mage's spell
  m.feed([{ t: 'attack', side: 0, piece: 3, target: 4, damage: 5, killed: false, shot: true, at: 70000 }], 70000, walked);
  const si = 70000 + GAMBIT_IMPACT_S * 1000, sl = si + GAMBIT_SHOT_S * 1000;
  assert.deepEqual(all(80000), [[SOUND.ArrowShoot, si], [SOUND.ArrowHit, sl], [125, sl + 100]]);
  m.feed([{ t: 'attack', side: 0, piece: 2, target: 4, damage: 5, killed: true, shot: true, at: 90000 }], 90000, { ...walked, pieces: walked.pieces.filter((p) => p.id !== 4) });
  const mi = 90000 + GAMBIT_IMPACT_S * 1000, ml = mi + GAMBIT_SHOT_S * 1000;
  assert.deepEqual(all(100000), [[GAMBIT_SPELL_CLIPS[1], mi], [SOUND.SpellImpactMagic, ml], [SOUND.BodyFall, ml + 300]], 'a mage\'s cast, its impact, the fall 0.3 s on');
  // a potion, the hazards' bites, a warning
  const last = { ...walked, pieces: walked.pieces.filter((p) => p.id !== 4) };
  m.feed([{ t: 'potion', side: 0, piece: 5, healed: 10, at: 110000 }], 110000, last);
  m.feed([{ t: 'hazard', side: 0, piece: 1, kind: 'fire', damage: 8, killed: false, at: 120000 }, { t: 'hazard', side: 0, piece: 2, kind: 'spikes', damage: 6, killed: false, at: 120000 }, { t: 'hazard', side: 0, piece: 3, kind: 'poison', damage: 5, killed: true, at: 120000 }], 120000, last);
  m.feed([{ t: 'warning', kind: 'fire', cells: [[2, 2], [12, 10]], at: 130000 }], 130000, last);
  assert.deepEqual(all(140000).map((x) => x[0]), [SOUND.MakePotion, SOUND.SpellImpactFire, SOUND.Hit3, SOUND.SpellImpactPoison, SOUND.BodyFall, SOUND.SpookyMid]);
  assert.equal(GAMBIT_HAZARD_CLIPS.spikes, 110);
  assert.deepEqual([...GAMBIT_ARCHER_CLASSES], [141, 142]);
  assert.deepEqual([...GAMBIT_SWING_CLIPS], [105, 347, 106]);
  // a single step: the move clip once; a calling's walk: none
  const m2 = createGambitMotion();
  m2.feed([], 0, st);
  m2.feed([{ t: 'move', side: 0, piece: 1, from: [4, 6], to: [5, 6], at: 0 }, { t: 'move', side: 0, piece: 5, from: [1, 1], to: [2, 1], at: 0 }], 0, st);
  assert.deepEqual(m2.sounds(10000).map((c) => c.clip), [115]);
});
