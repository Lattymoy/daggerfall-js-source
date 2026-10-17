// FIELD BUGS 2026-10-01 part five - #bug-reports, lumin: "Holding the right-mouse button to rotate the 3D map only works
// on one axis (X or Y) at a time. The rotation should work for both vertical and horizontal simultaneously."
//
// ORBIT-FREE. The held map's solid dungeon sheet is turned by a right-drag (or Shift + left) on the stage
// (ui/heldMap.js). TURN-STEADY (Mac: "its a bit hard to control") let the first 8 px of a drag pick its axis for the
// WHOLE drag - mostly across a turn only, mostly up and down a tilt only - so one that set off sideways never tilted
// however far it then went down, and the reverse. Asked, Mac: "Unlock on intent". A locked drag keeps what it holds
// back the other way, less its drift; past 24 px of it the drag turns AND tilts, every move, to its release - and a
// hand's drift along a turn still never tilts it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

/** test/ui/heldmap.test.js's document: nodes that keep their listeners, so a pin can fire the stage's. */
function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener(t, fn) { (n.listeners ||= []).push([t, fn]); }, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
const fire = (n, type, e) => { for (const [t, fn] of n.listeners ?? []) if (t === type) fn(e); };
const mouse = (o) => ({ pointerId: 1, pointerType: 'mouse', preventDefault() {}, stopPropagation() {}, ...o });

/** A held map on a solid sheet that records what the drag hands it; `path` is the pointer's moves after the press. */
function drag(path, { button = 2, shiftKey = false } = {}) {
  globalThis.document = fakeDocument();
  try {
    const win = new HeldMapWindow({
      getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
      woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
      gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false,
      diseaseCount: () => 0, poisonCount: () => 0,
    });
    const got = [];
    win._phase = 'map';
    win._paperPoint = (x, y) => [x, y];
    Object.defineProperty(win, '_sheet', { value: { solid: true, orbitBy: (dx, dy) => got.push([dx, dy]), orbitHold() {}, orbitFrom() {} } });
    const stage = win._chrome.stage;
    const bit = button === 2 ? 2 : 1;
    fire(stage, 'pointerdown', mouse({ button, buttons: bit, shiftKey, clientX: 100, clientY: 100 }));
    for (const [x, y] of path) fire(stage, 'pointermove', mouse({ buttons: bit, clientX: x, clientY: y }));
    fire(stage, 'pointerup', mouse({ button, buttons: 0, clientX: path.at(-1)[0], clientY: path.at(-1)[1] }));
    win.dispose?.();
    return { moves: got, turn: got.reduce((a, [dx]) => a + dx, 0), tilt: got.reduce((a, [, dy]) => a + dy, 0) };
  } finally { delete globalThis.document; }
}

test('ORBIT-FREE: the report - a right-drag that sets off sideways and then goes down turns AND tilts, every deliberate pixel of each; up the same (mutants: the lock held to the release; the held-back travel dropped; the sum unsigned)', () => {
  const d = drag([[110, 100], [130, 100], [130, 120], [130, 140], [150, 160]]);
  assert.equal(d.turn, 50, 'every pixel across turned');
  assert.equal(d.tilt, 60, '...and every pixel down tilted, in the same drag - the 40 held back spent as it frees');
  assert.deepEqual(d.moves.at(-1), [20, 20], 'freed, a diagonal move is both at once');
  const u = drag([[110, 100], [130, 100], [130, 80], [130, 60], [150, 40]]);
  assert.deepEqual([u.turn, u.tilt], [50, -60], 'up tilts up');
});

test('ORBIT-FREE: one that sets off up and down then goes across tilts AND turns; Shift + left (a trackpad\'s) is the same drag (mutant: the lock held)', () => {
  const d = drag([[100, 112], [100, 130], [125, 130], [150, 130]]);
  assert.deepEqual([d.turn, d.tilt], [50, 30]);
  const t = drag([[110, 100], [130, 100], [130, 130]], { button: 0, shiftKey: true });
  assert.deepEqual([t.turn, t.tilt], [30, 30]);
});

test('ORBIT-FREE keeps TURN-STEADY: a long sideways drag that drifts or wobbles never tilts, nor does a short dip under 24 px (mutants: no drift forgiven; a lower bar)', () => {
  const drift = [[110, 100]];
  for (let i = 1; i <= 15; i++) drift.push([110 + 20 * i, 100 + 4 * i]);   // a fifth of a pixel down for every one across
  const d = drag(drift);
  assert.deepEqual([d.turn, d.tilt], [310, 0], 'a hand\'s slope along the turn is drift');
  const wob = [[110, 100]];
  for (let i = 1; i <= 12; i++) wob.push([110 + 15 * i, 100 + (i % 2 ? 7 : 0)]);
  assert.equal(drag(wob).tilt, 0, 'a wobble never adds up');
  const dip = drag([[110, 100], [130, 100], [130, 120], [150, 120]]);
  assert.deepEqual([dip.turn, dip.tilt], [50, 0], '20 px down is short of the bar, and the turn after it forgives it');
});

test('ORBIT-FREE: a drag that sets off on the diagonal turns and tilts from its first move, as before', () => {
  const d = drag([[106, 106], [120, 118]]);
  assert.deepEqual([d.turn, d.tilt], [20, 18]);
});
