// CARDS3c (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 30; section 3, DECIDED: the hand "can be peeked
// (lifted at the corner) or squeezed ... a click on the cards checks, a push folds"): THE SQUEEZE, THE CLICK AND THE
// PUSH (world/cardHand.js), and the host's wiring of them (scenes/worldModes.js cardPointerListen, cardDrawGame). Driven:
// a short still press is a click, a long one or one that wandered is no click; a drag up the screen more up than across
// is a push, a sideways one is not; a pull down squeezes from past a click's slop to all the way, never further; a
// squeezed card is the same rigid card, drawn up along its own length and turned about its face; the host checks on a
// click only when the law has a check, folds on a push only on the player's turn, and squeezes the front card alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handGesture, squeezeOf, squeezeMatrix, CLICK_SLOP, CLICK_MS, PUSH_FOLD, SQUEEZE_PULL, SQUEEZE_RISE, SQUEEZE_TURN_DEG, heldMatrices } from '../src/world/cardHand.js';
import { lookAt, trs } from '../src/world/mat4.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const H = 800;

test('CARDS3c the gestures: a click is short and still, a push goes up the screen more than across, the squeeze is the pull down past a click\'s slop (mutants: the slop; the time; the push\'s direction; the squeeze\'s start)', () => {
  assert.deepEqual([CLICK_SLOP, CLICK_MS, PUSH_FOLD, SQUEEZE_PULL], [0.012, 300, 0.1, 0.12]);
  assert.equal(handGesture([100, 500], [103, 502], 120, H), 'click');
  assert.equal(handGesture([100, 500], [103, 502], CLICK_MS + 1, H), null, 'held: a peek, no click');
  assert.equal(handGesture([100, 500], [100, 500 - CLICK_SLOP * H * 2], 100, H), null, 'moved: no click, and not far enough for a push');
  assert.equal(handGesture([100, 500], [110, 500 - PUSH_FOLD * H], 400, H), 'push', 'up the screen: a push');
  assert.equal(handGesture([100, 500], [100 + PUSH_FOLD * H * 1.5, 500 - PUSH_FOLD * H], 400, H), null, 'more across than up: no push');
  assert.equal(handGesture([100, 500], [100, 500 + PUSH_FOLD * H], 400, H), null, 'down the screen is the squeeze, never a push');
  assert.equal(handGesture(null, [1, 1], 0, H), null);
  assert.equal(squeezeOf([100, 500], [100, 500 + CLICK_SLOP * H * 0.5], H), null, 'still inside the slop: the peek alone');
  assert.ok(Math.abs(squeezeOf([100, 500], [100, 500 + (CLICK_SLOP + SQUEEZE_PULL / 2) * H], H) - 0.5) < 1e-9, 'half the pull, half squeezed');
  assert.equal(squeezeOf([100, 500], [100, 500 + H], H), 1, 'never past all the way');
  assert.equal(squeezeOf([100, 500], [100, 400], H), null, 'up the screen squeezes nothing');
});

test('CARDS3c the squeezed card: the same rigid plate, drawn up along its own length and turned about its face, as far as the squeeze (mutants: the rise; the turn; the clamp)', () => {
  const view = lookAt([0, 1.2, 0], [0, 1.2, -1], [0, 1, 0]);
  const [m] = heldMatrices(view, 2, 1);
  assert.deepEqual([...squeezeMatrix(m, 0)].map((v) => +v.toFixed(9)), [...m].map((v) => +v.toFixed(9)), 'unsqueezed: where it was');
  const s = squeezeMatrix(m, 1);
  const len = (v) => Math.hypot(v[0], v[1], v[2]);
  for (const c of [0, 4, 8]) assert.ok(Math.abs(len([s[c], s[c + 1], s[c + 2]]) - 1) < 1e-6, 'rigid: no axis stretched');
  const moved = [s[12] - m[12], s[13] - m[13], s[14] - m[14]];
  assert.ok(Math.abs(len(moved) - SQUEEZE_RISE) < 1e-6, 'drawn up by the rise');
  const top = [m[8], m[9], m[10]];
  assert.ok(Math.abs((moved[0] * top[0] + moved[1] * top[1] + moved[2] * top[2]) / SQUEEZE_RISE - 1) < 1e-6, 'along its own length, toward its top');
  const face = [m[4], m[5], m[6]], face2 = [s[4], s[5], s[6]];
  assert.ok(face.every((v, i) => Math.abs(v - face2[i]) < 1e-6), 'turned about its face, which still faces where it did');
  const side = [m[0], m[1], m[2]], side2 = [s[0], s[1], s[2]];
  const cos = side[0] * side2[0] + side[1] * side2[1] + side[2] * side2[2];
  assert.ok(Math.abs(Math.acos(Math.min(1, cos)) * 180 / Math.PI - SQUEEZE_TURN_DEG) < 1e-4, 'by the turn');
  assert.deepEqual([...squeezeMatrix(m, 5)], [...s], 'clamped at all the way');
  assert.ok(trs, 'mat4');
});

test('CARDS3c the host: a press on the hand remembered, squeezed as it is pulled down, its letting go a check (when the law has one) or a fold (on his turn), the front card alone squeezed', () => {
  const wm = read('src/scenes/worldModes.js');
  const body = (name) => { const a = wm.indexOf(`function ${name}(`); return wm.slice(a, wm.indexOf('\n  }\n', a)); };
  const listen = body('cardPointerListen');
  assert.ok(listen.includes("else if (!grabbed && cardHandHovered(g)) { g.peekHeld = true; g.handPress = { at: g.mouse.slice(), t: performance.now() }; }"));
  assert.ok(listen.includes('if (g.handPress) g.squeeze = squeezeOf(g.handPress.at, g.mouse, canvas.clientHeight);'));
  assert.ok(listen.includes("if (kind === 'click' && legal?.check) cardPress(g, 'check');"), 'a click checks only where a check is the law\'s');
  assert.ok(listen.includes("else if (kind === 'push' && legal) cardPress(g, 'fold');"), 'a push folds only on his turn');
  assert.ok(listen.indexOf('g.handPress = null; g.squeeze = null;') < listen.indexOf('const d = g.drag;'), 'the press let go before the chips are asked');
  assert.ok(body('cardDrawGame').includes('if (g.squeeze > 0 && mats.length > 1) mats[0] = squeezeMatrix(mats[0], g.squeeze);'), 'the front card');
});
