// AUDIT-STOREFRONT II, lane C: the profile's previews. A character stage started again (its canvas back
// on the page) was told the kit and the aura but not the effect the open slot plays, so it stood bare while the picker
// said one was on. The Mount slot's horse read less motion once, as it was made, and kept that choice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { characterSlots, characterSlotName } from '../../src/ui/characterSlots.js';
import { mountPreview } from '../../src/ui/mountPreview.js';

/** The card's smallest document (test/ui/profileslots.test.js's): a canvas that answers for a context. */
function slotsDoc() {
  const mk = (/** @type {string} */ tag) => {
    const n = /** @type {any} */ ({
      tag, className: '', type: null, value: '', disabled: false, children: [], attrs: {}, style: {},
      append: (/** @type {any[]} */ ...k) => n.children.push(...k.filter(Boolean)),
      setAttribute(/** @type {string} */ k, /** @type {string} */ v) { n.attrs[k] = v; },
      get all() { return [n, ...n.children.flatMap((/** @type {any} */ c) => c.all)]; },
      get firstChild() { return n.children[0] ?? null; },
    });
    if (tag === 'canvas') n.getContext = () => ({});
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  return { createElement: mk };
}

/** The browser's frame clock, run by hand: `frames(n)` runs n frames, 16 ms apart. */
function frameClock() {
  const queue = /** @type {Function[]} */ ([]), was = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  let ms = 1000;
  globalThis.requestAnimationFrame = /** @type {any} */ ((/** @type {Function} */ f) => queue.push(f));
  globalThis.cancelAnimationFrame = () => {};
  return {
    frames(/** @type {number} */ n) { for (let i = 0; i < n; i++) { ms += 16; for (const f of queue.splice(0)) f(ms); } },
    get waiting() { return queue.length; },
    restore() { globalThis.requestAnimationFrame = was.raf; globalThis.cancelAnimationFrame = was.caf; },
  };
}

test('AUDIT-STOREFRONT II C5 a stage started again (its canvas back on the page) plays the open slot\'s effect from its first frame, as the stage before it did (mutants: the new stage never told the effect)', () => {
  const clock = frameClock();
  try {
    const flow = {
      busy: false,
      wardrobe: { titles: [], title: null, glyphs: [], glyphsOff: [], auras: [], aura: null, icons: [], icon: null, armoryHeld: [], armory: null, effectsHeld: { kill: ['pyre'], portal: [], mount: [] }, effects: 'c00' },
      wearEffect: () => true,
    };
    const stages = /** @type {any[]} */ ([]);
    const start = () => { const s = { up: true, fx: /** @type {any[]} */ ([]), setKit() {}, setAura() {}, setBody() {}, setEffect(/** @type {any} */ sl, /** @type {any} */ k) { s.fx.push([sl, k]); }, headAt: () => null, stop() { s.up = false; }, alive: () => s.up }; stages.push(s); return s; };
    const slots = characterSlots(slotsDoc(), flow, { start, entryOf: () => null });
    let sec = /** @type {any} */ (null);
    const paint = () => { sec = slots.node(paint); };
    paint();
    clock.frames(1);
    sec.all.find((/** @type {any} */ n) => n.tag === 'button' && n.className.startsWith('slottile') && n.children[0]?.textContent === characterSlotName('kill')).onclick();
    assert.deepEqual(stages[0].fx.at(-1), ['kill', 'pyre'], 'the slot opened plays the kill effect worn');
    stages[0].up = false;   // the card's other pages took the canvas off the page
    paint();
    clock.frames(1);
    assert.equal(stages.length, 2, 'a stage again');
    assert.equal(slots.state().picked, 'kill', 'the picker still open on the kill effect');
    assert.deepEqual(stages[1].fx.at(-1), ['kill', 'pyre'], 'and the new stage plays it');
    slots.dispose();
  } finally { clock.restore(); }
});

test('AUDIT-STOREFRONT II C6 the Mount slot\'s horse follows less motion as it changes, both ways: no beat while it is asked, the beat again once it is not, and still again once asked (mutants: read once as the horse was made; the default read once; the clock stopped under less motion)', async () => {
  const clock = frameClock();
  const was = { Image: globalThis.Image, document: globalThis.document, ImageData: globalThis.ImageData, matchMedia: globalThis.matchMedia, now: Date.now };
  let fills = 0, calm = true, ms = Date.now() + 1e7;
  const canvas = () => ({ width: 0, height: 0, className: '', setAttribute() {}, getContext: () => ({
    drawImage() {}, clearRect() {}, putImageData() {}, fillRect() { fills++; },
    getImageData: (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  }) });
  const g = /** @type {any} */ (globalThis);
  g.document = { createElement: canvas };
  g.ImageData = class { constructor(/** @type {any} */ d, /** @type {number} */ w, /** @type {number} */ h) { this.data = d; this.width = w; this.height = h; } };
  g.matchMedia = (/** @type {string} */ q) => ({ matches: q.includes('reduce') && calm });
  Date.now = () => ms;   // the shared read (systems/hitFlash.js prefersReducedMotion) asks again after a second
  try {
    const m = mountPreview(/** @type {any} */ ({ createElement: canvas }), { picture: async () => ({ width: 40, height: 30, data: new Uint8Array(40 * 30 * 4) }) });   // The side view built, here a blank one
    m.set('warhorse');
    for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
    clock.frames(40);
    assert.equal(fills, 0, 'less motion: the horse stands still');
    calm = false; ms += 2000;
    clock.frames(40);
    assert.ok(fills > 10, `less motion turned off with the card open: the beat (${fills})`);
    calm = true; ms += 2000;
    clock.frames(120);   // the last of it dies out
    fills = 0;
    clock.frames(40);
    assert.equal(fills, 0, 'asked again: still');
    assert.ok(clock.waiting > 0, 'its clock still running, to see the next change');
    m.dispose();
  } finally {
    clock.restore();
    for (const k of /** @type {const} */ (['Image', 'document', 'ImageData', 'matchMedia'])) { if (was[k] === undefined) delete g[k]; else g[k] = was[k]; }
    Date.now = was.now;
  }
});
