// RPT1026-CLIENT (a private report, 2026-10-23: a pad's A pressed on the open world map threw a NotFoundError from
// setPointerCapture, an invalid pointer id). The pad's
// press is a synthetic pointer (ui/plus/plusPad.js domPointer: pointerId 1, the mouse's id in Chromium); Firefox numbers
// its mouse 0, holds no pointer 1, and refuses the capture with a NotFoundError - thrown out of the held map's listener
// to the page. Driven on the held map as test/ui/fb1001_orbitfree.test.js stands it, with a stage that refuses the
// capture as Firefox does, and the whole of src/ swept for a capture or release outside the one door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { domPointer } from '../../src/ui/plus/plusPad.js';
import { capturePointer, releasePointer } from '../../src/ui/pointerCapture.js';

/** Firefox's refusal for a pointer it does not hold. */
const refuse = () => { const e = new Error('setPointerCapture: no pointer of that id'); e.name = 'NotFoundError'; throw e; };

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener(t, fn) { (n.listeners ||= []).push([t, fn]); }, removeEventListener() {},
      setPointerCapture: refuse, releasePointerCapture: refuse, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
      // a real element's dispatch: each listener in turn, as the browser calls them
      dispatchEvent(e) { for (const [t, fn] of n.listeners ?? []) if (t === e.type) fn(e); return true; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}

test('RPT1026-CLIENT: a pad\'s A on the world map - the browser refuses the capture, and nothing throws out of the press', () => {
  globalThis.document = fakeDocument();
  try {
    const win = new HeldMapWindow({
      getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
      woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
      gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false,
      diseaseCount: () => 0, poisonCount: () => 0,
    });
    win._phase = 'map';
    win._paperPoint = (x, y) => [x, y];
    const stage = win._chrome.stage;
    const makeEvent = (type, init) => ({ type, ...init, preventDefault() {}, stopPropagation() {} });
    // the pad poller's own press: down, then up, at the cursor (ui/plus/plusPad.js domPointer)
    assert.doesNotThrow(() => domPointer(stage, 'down', { x: 100, y: 100, makeEvent }), 'the press lands with its capture refused');
    assert.doesNotThrow(() => domPointer(stage, 'up', { x: 100, y: 100, makeEvent }));
    // a right-press's turn (a solid sheet) and its release
    Object.defineProperty(win, '_sheet', { value: { solid: true, orbitBy() {}, orbitHold() {}, orbitFrom() {}, context() {} } });
    assert.doesNotThrow(() => domPointer(stage, 'down', { x: 100, y: 100, button: 2, makeEvent }));
    win.dispose?.();
  } finally { delete globalThis.document; }
});

test('RPT1026-CLIENT: the one door answers the refusal, and lets a held pointer through', () => {
  const firefox = { setPointerCapture: refuse, releasePointerCapture: refuse };
  assert.equal(capturePointer(firefox, 1), false);
  assert.equal(releasePointer(firefox, 1), false);
  const held = [];
  const chrome = { setPointerCapture: (id) => held.push(['set', id]), releasePointerCapture: (id) => held.push(['release', id]) };
  assert.equal(capturePointer(chrome, 1), true);
  assert.equal(releasePointer(chrome, 1), true);
  assert.deepEqual(held, [['set', 1], ['release', 1]]);
  assert.equal(capturePointer(null, 1), true, 'no element: nothing to refuse');
});

test('RPT1026-CLIENT: no capture or release in the game\'s own code stands outside the door or a try (the labs under src/tools are pages of their own, mouse alone)', () => {
  const root = new URL('../../', import.meta.url).pathname;
  const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (n.endsWith('.js')) out.push(p); } return out; };
  const bare = [];
  for (const p of walk(join(root, 'src'))) {
    const file = relative(root, p);
    if (file.startsWith('src/tools/') || file === 'src/ui/pointerCapture.js') continue;
    // PIN MOVED (LEGIBLE 3): the formatter opens a try on the line above its body, so that line counts as the try
    readFileSync(p, 'utf8').split('\n').forEach((ln, i, lines) => {
      if (/\.(set|release)PointerCapture\b/.test(ln) && !/try \{/.test(ln) && !/try \{\s*$/.test(lines[i - 1] ?? '') && !/^\s*(\/\/|\*)/.test(ln)) bare.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(bare, [], 'each goes through ui/pointerCapture.js (or catches its own refusal on its line)');
});
