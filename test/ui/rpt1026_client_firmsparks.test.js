// RPT1026-CLIENT (a private report, 2026-10-24: points spent in the Firmament and Accept pressed, every time an
// IndexSizeError, an arc's radius below nought, from firmamentWindow's sparks). A star's burst was stamped with
// performance.now() and drawn by the
// requestAnimationFrame clock, and every callback of one frame is handed that frame's START: a burst stamped later in the
// frame (Accept's answer, landing after the world's own frame callback) was younger than nought, and its ring's radius
// went below it. The window is driven here as the page drives it - its own rAF loop, a canvas that refuses a negative
// radius as a real one does.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { mountFirmamentWindow, NODE_R } from '../../src/ui/firmamentWindow.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';
import { setFirmamentOnline, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import '../chargenDom.mjs';

/** A 2D context that throws as the browser's does on a negative arc radius, and counts the rings drawn. */
function strictContext(log) {
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'arc') return (x, y, r) => {
        if (r < 0) { const e = new Error(`arc: a negative radius (${r})`); e.name = 'IndexSizeError'; throw e; }
        log.push({ x, y, r });
      };
      if (k === 'measureText') return () => ({ width: 1 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
      return typeof k === 'string' ? () => {} : undefined;
    },
    set: () => true,
  });
}

function fakeBook() {
  return {
    state: { open: true, tree: { start: null, keys: [] }, stars: 4, craft: 0, renown: 3 },
    current() { return this.state.tree; },
    onChange: () => () => {},
    read: () => Promise.resolve(),
    canRespec: () => false,
  };
}

beforeEach(() => {
  _resetFirmamentLiveForTests();
  _resetSigilForTests();
  setFirmamentOnline(true);
});

test('RPT1026-CLIENT: a burst stamped after its frame began draws no ring of negative radius', () => {
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  globalThis.cancelAnimationFrame = () => {};
  const rings = [];
  const proto = Object.getPrototypeOf(globalThis.document.createElement('canvas'));
  const was = proto.getContext, media = globalThis.matchMedia;
  proto.getContext = () => strictContext(rings);
  // the fake page answers every media query yes; the sky moves only where motion is not reduced
  globalThis.matchMedia = (q) => (/reduced-motion/.test(q) ? { matches: false, addEventListener() {}, removeEventListener() {} } : media(q));
  try {
    const host = globalThis.document.createElement('div');
    const win = mountFirmamentWindow(host, { book: fakeBook(), embed: true });
    // the frame this callback belongs to began 560 ms before the press is stamped (the report's -21.27 is a notable's
    // 16 px ring at u = -0.62) - the clock every callback of one frame is handed
    const frameStart = performance.now();
    win.allocate('wr.start');   // a birthsign pressed: its star bursts
    const next = () => { const fn = frames.shift(); assert.ok(fn, 'the sky asks for its next frame'); return fn; };
    assert.doesNotThrow(() => next()(frameStart - 560), 'the ring of a burst younger than its frame never goes below nought');
    // the star's own rings are its radius and a halo 5 past it; a burst's ring is drawn from the radius out to 60 past it
    const star = FIRM_NODES.get('wr.start'), r0 = NODE_R.start;
    const at = () => rings.filter((c) => c.x === star.x && c.y === star.y).map((c) => c.r);
    assert.deepEqual(at().sort((a, b) => a - b), [r0, r0, r0 + 5], 'the first frame draws the burst at its start: the star\'s own radius');
    // and the burst runs its course on the frame clock: half grown at half its 900 ms, gone past them
    rings.length = 0;
    next()(frameStart - 560 + 450);
    assert.deepEqual(at().sort((a, b) => a - b), [r0, r0 + 5, r0 + 30]);
    rings.length = 0;
    next()(frameStart - 560 + 1000);
    assert.deepEqual(at().sort((a, b) => a - b), [r0, r0 + 5], 'the burst is over');
    win.close();
  } finally { proto.getContext = was; globalThis.matchMedia = media; }
});
