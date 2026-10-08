// CARDS3b (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 19): THE HAND IN THE SEAT'S VIEW, THE CHIPS UNDER
// THE MOUSE, THE RIFFLE. Driven: the held hand's matrices (world/cardHand.js) - each card's face turned to the eye and its
// top up, before the eye and below it, fanned, the screen's right-hand card in front, leaning back held and coming up and
// apart when peeked; the cursor's ray met with the cloth; a press on the player's own stack, the betting ground before
// his cards, the bet a drag carries (the slider's raise clamped to the law, else the call, else nothing); the dealer's
// riffle (world/cardMotion.js) - two halves parting and falling one card from each in turn into one pile, on the cloth,
// only while it runs; the cloth's scene riffling before it deals and saying whose each card is and whether it rests; the
// evening's first patron waiting the riffle out; the draw taking a held card's own matrix; and by source, the host - the
// held two drawn from the view, the press on the stack or the hand taken at the capture phase before the seat's stand,
// the panel's press left to the panel, the listeners the game's and gone with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  heldMatrices, heldLift, blendMatrix, HELD_EASE_S, tablePoint, onStack, onTable, inBetZone, dragBet, HELD_LIFT_MAX, HELD_PANEL_GAP_PX, FACE_THE_EYE, HELD_AT, HELD_LEAN_DEG, PEEK_LEAN_DEG, HELD_GAP, PEEK_GAP, STACK_GRAB_M,
} from '../src/world/cardHand.js';
import { riffleAt, RIFFLE_S, RIFFLE_HALF, RIFFLE_PART, CARD_T } from '../src/world/cardMotion.js';
import { tablePlaces, CardScene } from '../src/world/cardScene.js';
import { tableFrame, cardTableSeats } from '../src/world/cardTables.js';
import { lookAt, trs } from '../src/world/mat4.js';
import { CardTableSession, settleMs } from '../src/systems/cardTableSession.js';
import { createCardTableDraw } from '../src/render/cardTableDraw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const col = (m, c) => [m[c * 4], m[c * 4 + 1], m[c * 4 + 2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(...a);

test('CARDS3b the held hand: faces to the eye, tops up, before the eye and below it, fanned, the right-hand card in front; peeked, up and apart', () => {
  // the plate's turn alone: its face (+Y) toward the view's +Z (the eye), its top (+Z) up
  assert.deepEqual(col(FACE_THE_EYE, 1).map((v) => Math.round(v) + 0), [0, 0, 1]);
  assert.deepEqual(col(FACE_THE_EYE, 2).map((v) => Math.round(v) + 0), [0, 1, 0]);
  // a seat's eye looking down the table's length
  const eye = [2, 1.2, 3], at = [2, 0.8, 4];
  const view = lookAt(eye, at, [0, 1, 0]);
  const fwd = sub(at, eye).map((v, i, a) => v / len(a));
  for (const peek of [0, 1]) {
    const m = heldMatrices(view, 2, peek);
    assert.equal(m.length, 2);
    for (const k of [0, 1]) {
      const pos = col(m[k], 3), face = col(m[k], 1), top = col(m[k], 2);
      const toEye = sub(eye, pos);
      assert.ok(dot(face, toEye) > 0, `card ${k} at peek ${peek}: its face to the eye`);
      assert.ok(top[1] > 0.1, 'its top up');
      assert.ok(dot(sub(pos, eye), fwd) > 0.2, 'before the eye');
      assert.ok(pos[1] < eye[1], 'below it');
    }
    // the screen's right-hand card is nearer the eye (in front)
    const d = (k) => dot(sub(col(m[k], 3), eye), fwd);   // depth along the view
    assert.ok(d(0) < d(1), 'the first card (the view\'s -X: the screen\'s right) in front');
  }
  // fanned: the two cards' tops lean apart; peeked, further apart and less leaned back
  const held = heldMatrices(view, 2, 0), peeked = heldMatrices(view, 2, 1);
  const apart = (m) => len(sub(col(m[0], 3), col(m[1], 3)));
  assert.ok(Math.abs(apart(held) - HELD_GAP) < 0.003 && Math.abs(apart(peeked) - PEEK_GAP) < 0.003, 'the spread');
  assert.ok(dot(col(held[0], 2), col(held[1], 2)) < 0.9999, 'fanned');
  const faceToEye = (m) => dot(col(m[0], 1), sub(eye, col(m[0], 3)).map((v, i, a) => v / len(a)));
  assert.ok(faceToEye(peeked) > faceToEye(held), 'peeked, the faces come up toward the eye');
  assert.ok(HELD_LEAN_DEG > PEEK_LEAN_DEG && HELD_AT[2] < 0);
  assert.deepEqual(heldMatrices(view, 0, 0), []);
});

test('CARDS3b the chips under the cursor: the ray met with the cloth, a press on the stack, the betting ground, the bet a drag carries', () => {
  assert.deepEqual(tablePoint([0, 1.2, 0], [0, -0.6, 0.8], 0.8).map((v) => Math.round(v * 1000) / 1000), [0, 0.8, 0.533]);
  assert.equal(tablePoint([0, 1.2, 0], [0, 0.1, 1], 0.8), null, 'a ray that never comes down');
  assert.equal(tablePoint([0, 0.5, 0], [0, -1, 0], 0.8), null, 'below the cloth: behind the eye');
  assert.equal(tablePoint([0, 0.5, 0], [0, 1, 0], 0.8), null, 'and looking up at it from beneath: nothing to put a chip on');
  assert.equal(tablePoint([0, 1.2, 0], null, 0.8), null);
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const places = tablePlaces(tableFrame(table), seats, seats.map((_, i) => i));
  const pl = places.seats[0];
  assert.equal(onStack(pl.stack, pl), true);
  assert.equal(onStack([pl.stack[0] + STACK_GRAB_M * 0.9, 0.8, pl.stack[2]], pl), true);
  assert.equal(onStack([pl.stack[0] + STACK_GRAB_M * 1.2, 0.8, pl.stack[2]], pl), false);
  assert.equal(onStack(null, pl), false);
  assert.equal(inBetZone(pl.bet, pl), true, 'the bet\'s own place is betting ground');
  assert.equal(inBetZone(places.pot, pl), true, 'and the middle');
  assert.equal(inBetZone(pl.stack, pl), false, 'not his stack');
  assert.equal(inBetZone(null, pl), false);
  // AUDIT CARDS-3 C6: on the table, or no betting ground at all - the top's endless plane past the table is nowhere
  const frame = places.table;
  assert.equal(onTable(places.pot, frame), true);
  assert.equal(onTable(pl.bet, frame), true);
  const beyond = [pl.bet[0] + (places.pot[0] - pl.bet[0]) * 40, 0.8, pl.bet[2] + (places.pot[2] - pl.bet[2]) * 40];
  assert.equal(inBetZone(beyond, pl), true, 'by the seat\'s facing alone, far past the table is "nearer the middle"');
  assert.equal(inBetZone(beyond, pl, frame), false, 'the table\'s own frame says it is off the top');
  assert.equal(inBetZone(pl.bet, pl, frame), true);
  assert.equal(onTable([frame.centre[0] + frame.halfLong * 0.99, 0.8, frame.centre[2]], { ...frame, axisYaw: Math.PI / 2 }), true, 'along its turned length');
  assert.equal(onTable([frame.centre[0] + frame.halfLong * 1.01, 0.8, frame.centre[2]], { ...frame, axisYaw: Math.PI / 2 }), false);
  assert.equal(onTable(null, frame), false);
  // the bet: the slider's raise clamped to the law when it was set; untouched, the call (AUDIT CARDS-3 C7); nothing to
  // call, the least bet; else nothing
  const raise = { call: 10, raise: { min: 20, max: 400 } };
  assert.deepEqual(dragBet(raise, 60, 10), { id: 'raise', value: 60, amount: 50 });
  assert.deepEqual(dragBet(raise, 9999, 0), { id: 'raise', value: 400, amount: 400 });
  assert.deepEqual(dragBet(raise, null, 0), { id: 'call', value: 10, amount: 10 }, 'the slider untouched: chips pushed in call');
  assert.deepEqual(dragBet({ check: true, call: 0, raise: { min: 10, max: 400 } }, null, 0), { id: 'raise', value: 10, amount: 10 }, 'nothing to call: the least bet');
  assert.deepEqual(dragBet({ call: 30, raise: null }, 60, 0), { id: 'call', value: 30, amount: 30 });
  assert.equal(dragBet({ check: true, call: 0, raise: null }, 0, 0), null, 'a check needs no chips');
  assert.equal(dragBet(null, 0, 0), null);
});

test('CARDS3b the riffle: two halves part and fall one card from each in turn into one pile, on the cloth, only while it runs', () => {
  const at = [1, 0.8, 2];
  assert.deepEqual(riffleAt(0.99, 1, at, 0), [], 'not before');
  assert.deepEqual(riffleAt(1 + RIFFLE_S, 1, at, 0), [], 'not after');
  const parted = riffleAt(1 + RIFFLE_S * 0.24, 1, at, 0);
  assert.equal(parted.length, RIFFLE_HALF * 2);
  const xs = parted.map((c) => c.pos[0] - at[0]);
  assert.ok(Math.max(...xs) > RIFFLE_PART * 0.8 && Math.min(...xs) < -RIFFLE_PART * 0.8, 'the halves apart');
  assert.ok(parted.every((c) => c.card === -1 && Math.cos(c.roll) < 0), 'backs up');
  const squared = riffleAt(1 + RIFFLE_S * 0.99, 1, at, 0);
  assert.ok(squared.every((c) => Math.abs(c.pos[0] - at[0]) < 1e-3), 'one pile at the end');
  const ys = squared.map((c) => c.pos[1]).sort((a, b) => a - b);
  for (let k = 1; k < ys.length; k++) assert.ok(ys[k] - ys[k - 1] > CARD_T * 0.5, 'stacked, never on one plane');
  for (let u = 0; u < 1; u += 0.05) for (const c of riffleAt(1 + RIFFLE_S * u, 1, at, 0)) assert.ok(c.pos[1] >= at[1], 'never under the cloth');
});

test('CARDS3b the scene riffles before it deals, says whose each card is and whether it rests; the first patron waits the riffle out; a held card draws by its own matrix', () => {
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const places = tablePlaces(tableFrame(table), seats, [0, 1, 2]);
  const scene = new CardScene({ places, playerSeat: 0, tableSeed: 1 });
  scene.onEvent({ t: 'hand', hand: 1, button: 1, seats: [0, 1, 2], at: 1000 }, (s, r) => (s === 0 ? r : -1));
  assert.ok(Math.min(...scene.cards.map((c) => c.motions[0].t0)) >= 1 + RIFFLE_S, 'the first throw after the riffle');
  assert.equal(scene.poses(1.2, null).cards.filter((c) => !c.id).length, RIFFLE_HALF * 2, 'the riffle on the cloth meanwhile');
  assert.ok(places.seats.every((p) => p.deck && p.deck[1] === 0.8), 'a deck place before each seat, on the cloth');
  const late = scene.poses(9, null).cards.filter((c) => c.id);
  assert.equal(late.length, 6);
  assert.ok(late.every((c) => c.settled && Number.isInteger(c.seat)));
  assert.deepEqual(late.filter((c) => c.seat === 0 && Math.cos(c.roll) > 0.5).map((c) => c.card).sort(), [0, 1], 'the player\'s two, his to hold');
  // the first patron's thought waits the riffle and the deal out
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 500 }, { id: 'patron:1', name: 'Bors', temper: 'tight', stack: 500 }], stakes: { sb: 5, bb: 10 }, rand32: () => 0, now: 0 });
  s.tick(0);
  assert.ok(s.thinkUntil >= settleMs(6) + Math.round(RIFFLE_S * 1000));
  // the draw takes a held card's own matrix
  const drawn = [];
  const renderer = { createMesh: (m) => ({ m }), uploadTexture: () => {}, drawMesh: (mesh, matrix) => drawn.push(matrix), destroyMesh: () => {}, releaseTexture: () => {} };
  const ctx = new Proxy({}, { get: (_, k) => (k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  const d = createCardTableDraw(renderer, { doc: { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } });
  const mine = new Float32Array(16).fill(7);
  d.draw({ cards: [{ card: 5, matrix: mine }], chips: [] });
  assert.equal(drawn[0], mine);
  d.destroy();
});

test('CARDS3b the host: the held two drawn from the view, the press on the stack or the hand taken before the seat\'s stand, the panel\'s left to it, the listeners gone with the game', () => {
  const wm = read('src/scenes/worldModes.js');
  const body = (name) => { const a = wm.indexOf(`function ${name}(`); return wm.slice(a, wm.indexOf('\n  }\n', a)); };
  assert.match(wm, /if \(cardGame\?\.scene\) cardDrawGame\(cardGame, proj, view, mwv\.eye\);/);
  assert.match(body('cardDrawGame'), /const held = mine >= 0 \? p\.cards\.filter\(\(c\) => c\.seat === mine && c\.settled && Math\.cos\(c\.roll\) > 0\.5\)/);
  assert.match(body('cardDrawGame'), /const mats0 = heldMatrices\(view, fan, g\.peek\);/, 'AUDIT CARDS-3 C3: the fan laid for the whole hand');
  assert.match(body('cardDrawGame'), /const mats = g\.lift > 1e-4 \? heldMatrices\(view, fan, g\.peek, g\.lift\) : mats0;/, 'AUDIT CARDS-3 C1: lifted clear of the panel');
  assert.match(body('cardDrawGame'), /matrix: h\.k >= 1 \? h\.m : blendMatrix\(cardMatrix\(c\.pos, c\.yaw, c\.roll\), h\.m, ease\(h\.k\)\)/, 'AUDIT CARDS-3 C3: eased from the cloth into the hand and out');
  const listen = body('cardPointerListen');
  // AUDIT CARDS-3 C5: pointer events (a touch is a pointer), the press at the capture phase - before the seat's
  assert.match(listen, /window\.addEventListener\('pointerdown', down, true\);/, 'the capture phase - before the seat\'s mousedown');
  assert.match(listen, /window\.addEventListener\('mousedown', mouseDown, true\);/, 'and the mouse press a taken pointerdown leaves behind');
  assert.match(listen, /g\.swallowMouse = true;\n\s*e\.stopImmediatePropagation\?\.\(\); e\.preventDefault\?\.\(\);/);
  assert.match(listen, /const up = \(e\) => \{\n\s*g\.swallowMouse = false;/, 'and the swallow ends with the press - a later click is the seat\'s');
  assert.match(listen, /if \(!mine\(\) \|\| onPanel\(e\) \|\| \(e\.button \?\? 0\) !== 0\) return;/, 'the panel\'s press is the panel\'s; the primary button alone (C10)');
  assert.match(listen, /else if \(!grabbed\) return;/, 'AUDIT CARDS-3 C2: a press on the stack is swallowed with nothing to bet');
  assert.match(listen, /if \(!place \|\| d\.off \|\| onPanel\(e\) \|\| !inBetZone\(d\.point, place, g\.scene\.places\.table\)\) return;/, 'C6: let go on the table, never over the panel');
  assert.match(listen, /if \(still && still\.id === d\.bet\.id && still\.value === d\.bet\.value\) cardPress\(g, d\.bet\.id, d\.bet\.value\);/, 'C10: the bet as the table stands at the letting go');
  assert.match(body('closeCardGame'), /g\.unlisten\?\.\(\);/, 'the listeners gone with the game');
  assert.match(read('src/ui/cardTableHud.js'), /sliderValue: \(\) => sliderValue,/);
});

test('AUDIT CARDS-3 C1: the held hand lifts clear of the panel - by the pixels it is under it, at the hand\'s depth and the frame\'s field of view; never past HELD_LIFT_MAX', () => {
  const proj = new Float32Array(16); proj[5] = 1 / Math.tan((65 * Math.PI) / 360);   // a 65-degree field
  assert.equal(heldLift(400, 500, 640, proj), 0, 'clear of it already');
  assert.equal(heldLift(490, 500, 640, proj), 0, 'the gap kept, and still clear');
  const px = 40 + HELD_PANEL_GAP_PX;
  const want = (px * 2 * -HELD_AT[2]) / (proj[5] * 640);
  assert.ok(Math.abs(heldLift(540, 500, 640, proj) - want) < 1e-9, 'metres for the pixels under the panel, at the hand\'s depth');
  assert.equal(heldLift(5000, 0, 640, proj), HELD_LIFT_MAX, 'never off the top of the view');
  // the lift raises every card the same, up the view
  const view = lookAt([0, 1.2, 0], [0, 1.2, -1], [0, 1, 0]);
  const a = heldMatrices(view, 2, 0), b = heldMatrices(view, 2, 0, 0.05);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(b[i][13] - a[i][13] - 0.05) < 1e-6 && Math.abs(b[i][12] - a[i][12]) < 1e-6);
  assert.ok(Math.abs(heldMatrices(view, 1, 0, 9)[0][13] - heldMatrices(view, 1, 0, HELD_LIFT_MAX)[0][13]) < 1e-9, 'clamped');
});

test('AUDIT CARDS-3 C3: a card picked up or let go blends - the place along the line, the turn the short way, a rigid card all the way', () => {
  const a = trs(0, 0.8, 0, 0, 30, 0), b = trs(0.2, 1.1, -0.3, -70, 200, 10);
  const close = (x, y) => [...x].every((v, i) => Math.abs(v - y[i]) < 1e-5);
  assert.ok(close(blendMatrix(a, b, 0), a) && close(blendMatrix(a, b, 1), b), 'its ends are the two poses');
  let last = blendMatrix(a, b, 0);
  for (let i = 1; i <= 20; i++) {
    const m = blendMatrix(a, b, i / 20);
    for (const c of [0, 4, 8]) assert.ok(Math.abs(Math.hypot(m[c], m[c + 1], m[c + 2]) - 1) < 1e-5, 'never squashed');
    assert.ok(Math.abs(m[0] * m[4] + m[1] * m[5] + m[2] * m[6]) < 1e-5, 'never sheared');
    assert.ok(Math.abs(m[13] - (0.8 + 0.3 * i / 20)) < 1e-6, 'along the line');
    assert.ok([...m].every((v, k) => Math.abs(v - last[k]) < 0.25), 'no jump between steps');
    last = m;
  }
  assert.ok(HELD_EASE_S > 0.1 && HELD_EASE_S < 0.5);
});
