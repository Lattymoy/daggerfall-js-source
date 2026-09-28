// UI1 (2026-09-27, the Plus UI pass - bible/10-UI/Slots-Hotbar-Status.md; Mac: "make the actual inventory plots have
// the rarity frame with sprites enlarged properly, instead of the inventory icon just plopping into a slot").
//
// THE SLOTS: a picture FITTED to its slot's box (ui/iconFit.js - the law, pure), made at exactly the device size it
// is drawn at (ui/bitmapCanvas.js fitCanvas - the canvas; ui/textureCanvas.js requestFittedPicture - the cache and its
// waiting screens), drawn by an <img> that carries its own size (fittedImg); the pack's slot a 64px plate round a 52px
// well with the stack's count in its corner; every other surface fitted to its own box. What only a browser with the
// real records can say - the sprite fills its well, the page resamples nothing - is tools/uiSlotsProbe.mjs's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from './invdrag.mjs';
import {
  fitIcon, opaqueBounds, clampDpr, ICON_CAP, SNAP, SLOT_BOX, gridBox, wornBox, PHONE_QUERY, WIDE_QUERY,
} from '../src/ui/iconFit.js';
import { fitCanvas, TRIM_ALPHA } from '../src/ui/bitmapCanvas.js';
import { requestFittedPicture, requestFittedIcon, requestIcon, fittedImg, iconName, _fittedKeys } from '../src/ui/textureCanvas.js';
import { addVendorTextures, clearVendorTextures, preloadTextureArchive } from '../src/systems/textureReplacement.js';
import { VENDOR_ICON_FILES } from '../src/systems/survival/items.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { HOTBAR_CSS } from '../src/ui/enhancedHotbar.js';
import { PAGE_IDS } from '../src/ui/packPages.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { setItemFields, mintCondition, inventoryItemImage } from '../src/systems/itemTemplates.js';
import { equipItem } from '../src/systems/equip.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

// ── THE LAW ─────────────────────────────────────────────────────────

test('UI1 law: a picture fitted to its box - whole pixels when they keep three quarters of it, sharp bilinear between, smooth under one, the cap for a gem, the device ratio honoured - to eight, a 3x phone at HUD scale 1.5 its own 4.5 (mutants: no snap; no cap; the ratio ignored; no sharp prescale; the box by round; the ratio capped at four)', () => {
  assert.equal(fitIcon(0, 10, { box: 48 }), null, 'no picture');
  assert.equal(fitIcon(10, 10, { box: 0 }), null, 'no box');
  assert.equal(fitIcon(10, NaN, { box: 48 }), null);
  // a 16px potion: exactly three times - nearest neighbour alone
  assert.deepEqual(fitIcon(16, 16, { box: 48 }), { prescale: 3, outW: 48, outH: 48, smooth: false, cssW: 48, cssH: 48 });
  // a 20px ring: 2.4 would fill the box, 2 keeps 83% of it in whole pixels - taken
  assert.deepEqual(fitIcon(20, 20, { box: 48 }), { prescale: 2, outW: 40, outH: 40, smooth: false, cssW: 40, cssH: 40 });
  // a 30px piece: 1.6 - 1 would keep 62%, so sharp bilinear: grown to 2, brought down to 48
  assert.deepEqual(fitIcon(30, 30, { box: 48 }), { prescale: 2, outW: 48, outH: 48, smooth: true, cssW: 48, cssH: 48 });
  // a staff 102x141: under one - a smooth reduction, the longest side the box's
  assert.deepEqual(fitIcon(102, 141, { box: 48 }), { prescale: 1, outW: 35, outH: 48, smooth: true, cssW: 35, cssH: 48 });
  // a gem 11x9: four CSS pixels a source pixel and no more - 44, never 48
  assert.deepEqual(fitIcon(11, 9, { box: 48 }), { prescale: 4, outW: 44, outH: 36, smooth: false, cssW: 44, cssH: 36 });
  assert.equal(fitIcon(11, 9, { box: 48, cap: 2 }).outW, 22, 'a cap of its own');
  // THE RATIO: a longsword 88x29 at 2x is 88 device pixels a side - 1:1, crisp, drawn at 44 CSS pixels
  assert.deepEqual(fitIcon(88, 29, { box: 48, dpr: 2 }), { prescale: 1, outW: 88, outH: 29, smooth: false, cssW: 44, cssH: 14.5 });
  assert.deepEqual(fitIcon(88, 29, { box: 48, dpr: 1 }), { prescale: 1, outW: 48, outH: 16, smooth: true, cssW: 48, cssH: 16 });
  // a phone's 2.625: the box is floor(44 x 2.625) = 115 device pixels, never 116
  const phone = fitIcon(230, 10, { box: 44, dpr: 2.625 });
  assert.equal(phone.outW, 115, 'the box in whole device pixels, rounded down');
  assert.ok(Math.abs(phone.cssW - 115 / 2.625) < 1e-9);
  // the ratio is clamped: nothing, zero or a nonsense is 1; past four is four
  assert.equal(clampDpr(undefined), 1); assert.equal(clampDpr(0), 1); assert.equal(clampDpr(-2), 1); assert.equal(clampDpr(NaN), 1);
  assert.equal(clampDpr(9), 8); assert.equal(clampDpr(1.5), 1.5);
  assert.equal(clampDpr(4.5), 4.5, 'AUDIT UI A6: a 3x screen at HUD scale 1.5 - its own ratio, not 4');
  assert.equal(clampDpr(0.67), 0.67, 'a browser zoomed out'); assert.equal(clampDpr(0.2), 0.5);
  assert.deepEqual(fitIcon(88, 29, { box: 48, dpr: 0.67 }), { prescale: 1, outW: 32, outH: 11, smooth: true, cssW: 32 / 0.67, cssH: 11 / 0.67 }, 'made at the zoomed page\'s own pixels');
  assert.equal(ICON_CAP, 4); assert.equal(SNAP, 0.75);
  // THE LAW OVER EVERY SIZE THE GAME MINTS (and more): never past the box, the shape kept, whole pixels when taken,
  // and whole pixels whenever they keep SNAP of the size
  for (const dpr of [0.67, 1, 1.25, 1.5, 2, 2.625, 3]) {
    for (const box of [20, 26, 32, 40, 48, 96]) {
      for (let w = 1; w <= 150; w += 7) {
        for (let h = 1; h <= 150; h += 11) {
          const f = fitIcon(w, h, { box, dpr });
          const side = Math.max(f.cssW, f.cssH);
          assert.ok(side <= box + 1e-9, `${w}x${h} in ${box} at ${dpr}: ${side}`);
          assert.ok(Math.max(f.outW, f.outH) <= Math.floor(box * dpr), 'the device box');
          if (!f.smooth) assert.deepEqual([f.outW, f.outH], [w * f.prescale, h * f.prescale], 'whole pixels are whole');
          const s = Math.min(Math.floor(box * dpr) / Math.max(w, h), ICON_CAP * dpr);
          if (s >= 1 && Math.floor(s + 1e-9) / s >= SNAP) assert.equal(f.smooth, false, `${w}x${h} at ${s}: whole pixels keep ${SNAP}`);
          if (f.smooth) assert.ok(Math.abs(f.outW / f.outH - w / h) <= Math.max(1 / f.outH, 1 / f.outW) * (w / h + 1) + 1e-9, 'the shape kept');
        }
      }
    }
  }
});

test('UI1 law: the opaque part of a picture - its trimmed rectangle, or nothing (mutant: an empty picture answers a rectangle)', () => {
  assert.equal(opaqueBounds(4, 4, () => false), null);
  assert.deepEqual(opaqueBounds(5, 4, (x, y) => x >= 1 && x <= 3 && y === 2), { x: 1, y: 2, w: 3, h: 1 });
  assert.deepEqual(opaqueBounds(3, 3, () => true), { x: 0, y: 0, w: 3, h: 3 });
});

// ── THE CANVAS ──────────────────────────────────────────────────────

/** Canvases that remember what was drawn on them: `alpha(x, y)` is a picture's opacity, carried by a draw. */
function canvasWorld() {
  const made = [];
  const createElement = (tag) => {
    assert.equal(tag, 'canvas');
    const c = { width: 0, height: 0, alpha: null, draws: [] };
    const ctx = {
      imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData(img) { c.alpha = (x, y) => img.data[(y * img.width + x) * 4 + 3]; },
      getImageData(x0, y0, w, h) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = c.alpha?.(x0 + x, y0 + y) ?? 0;
        return { data };
      },
      drawImage(from, ...a) {
        c.draws.push({ from, a, smooth: ctx.imageSmoothingEnabled, quality: ctx.imageSmoothingQuality });
        if (a.length === 2 && from.alpha) c.alpha = from.alpha;   // a 1:1 blit carries the picture
      },
    };
    c.getContext = () => ctx;
    c.toDataURL = () => `data:image/png;fit-${c.width}x${c.height}`;
    made.push(c);
    return c;
  };
  return { made, createElement };
}
const withCanvases = (fn) => {
  const world = canvasWorld();
  const had = 'document' in globalThis, saved = globalThis.document;
  const restore = () => { if (had) globalThis.document = saved; else delete globalThis.document; };
  globalThis.document = { createElement: world.createElement };
  let out;
  try { out = fn(world); } catch (e) { restore(); throw e; }
  if (out && typeof out.then === 'function') return out.finally(restore);   // an async body keeps its canvases to the end
  restore();
  return out;
};
const picture = (world, w, h, drawn) => { const c = world.createElement('canvas'); c.width = w; c.height = h; c.alpha = (x, y) => (drawn(x, y) ? 255 : 0); return c; };

test('UI1 canvas: fitCanvas trims the margin, grows by nearest neighbour, and brings a large picture down by halves, smoothly (mutants: no trim; the growth smoothed; no halving)', () => {
  withCanvases((world) => {
    // a longsword 88x29 inside a 2px transparent margin, into 48 at 1x: trimmed, then one smooth reduction
    const sword = picture(world, 92, 33, (x, y) => x >= 2 && x < 90 && y >= 2 && y < 31);
    const out = fitCanvas(sword, { box: 48, dpr: 1 });
    assert.deepEqual([out.canvas.width, out.canvas.height, out.cssW, out.cssH, out.smooth], [48, 16, 48, 16, true]);
    const [grow, last] = world.made.slice(1);
    assert.deepEqual(grow.draws[0].a, [2, 2, 88, 29, 0, 0, 88, 29], 'the TRIMMED rectangle, at the prescale (1)');
    assert.equal(grow.draws[0].smooth, false, 'the growth is nearest neighbour');
    assert.equal(last.draws[0].smooth, true, 'the reduction is smooth');
    assert.equal(last.draws[0].quality, 'high');
    assert.equal(world.made.length, 3, 'no halving: 88 is under twice 48');
    // a staff 102x141 into 48: halved once (51x71), then brought to 35x48
    world.made.length = 0;
    const staff = picture(world, 102, 141, () => true);
    const st = fitCanvas(staff, { box: 48, dpr: 1 });
    assert.deepEqual([st.canvas.width, st.canvas.height], [35, 48]);
    assert.deepEqual(world.made.slice(1).map((c) => [c.width, c.height]), [[102, 141], [51, 71], [35, 48]], 'grown (1x), halved, fitted');
    assert.deepEqual(world.made.slice(1).map((c) => c.draws[0].smooth), [false, true, true]);
    // a ring 20x20 into 48: whole pixels (2x) and nothing after
    world.made.length = 0;
    const ring = picture(world, 20, 20, () => true);
    const r = fitCanvas(ring, { box: 48, dpr: 1 });
    assert.deepEqual([r.canvas.width, r.cssW, r.smooth], [40, 40, false]);
    assert.equal(world.made.length, 2, 'one canvas made: the growth is the picture');
    // nothing drawn (and a fringe under TRIM_ALPHA is nothing): no picture
    const faint = world.createElement('canvas'); faint.width = 4; faint.height = 4; faint.alpha = () => TRIM_ALPHA;
    assert.equal(fitCanvas(faint, { box: 48 }), null);
    assert.equal(fitCanvas({ width: 4, height: 4, getContext: () => null }, { box: 48 }), null, 'no 2D canvas');
    assert.equal(fitCanvas(null, { box: 48 }), null);
  });
});

// ── THE DOOR ────────────────────────────────────────────────────────

class FakeImage {
  set src(u) { this.u = u; const m = /src-(\d+)x(\d+)/.exec(u); this.naturalWidth = Number(m?.[1] ?? 0); this.naturalHeight = Number(m?.[2] ?? 0); this.alpha = () => 255; }
  get src() { return this.u; }
  decode() { return Promise.resolve(); }
}
const withImages = async (fn) => {
  const had = 'Image' in globalThis, saved = globalThis.Image;
  globalThis.Image = FakeImage;
  try { return await withCanvases(fn); } finally { if (had) globalThis.Image = saved; else delete globalThis.Image; }
};

test('UI1 door: requestFittedPicture - null while it is made, the source asked once, EVERY screen that waited told once, the answer cached by its box, its ratio and its cap; a picture that never comes stays nothing (mutants: the key blind to the box; the second waiter dropped)', async () => {
  await withImages(async () => {
    let url = null;
    const wakes = [];
    const ask = (w) => { if (w) wakes.push(w); return url; };
    const told = { a: 0, b: 0 };
    assert.equal(requestFittedPicture('ui1-t', ask, { box: 48, dpr: 1, onReady: () => told.a++ }), null, 'cold');
    assert.equal(requestFittedPicture('ui1-t', ask, { box: 48, dpr: 1, onReady: () => told.b++ }), null, 'in flight');
    assert.equal(wakes.length, 1, 'the source asked once');
    url = 'data:src-20x20';
    wakes[0]();
    await settle();
    assert.deepEqual(told, { a: 1, b: 1 }, 'both screens told, once');
    assert.deepEqual(requestFittedPicture('ui1-t', ask, { box: 48, dpr: 1, onReady: () => told.a++ }),
      { src: 'data:image/png;fit-40x40', w: 40, h: 40, smooth: false }, 'warm: a ring, twice its size');
    await settle();
    assert.equal(told.a, 1, 'a warm picture tells no one - a repaint cannot loop');
    // another box, another ratio, another cap: each its own picture
    assert.equal(requestFittedPicture('ui1-t', ask, { box: 32, dpr: 1 }), null);
    assert.equal(requestFittedPicture('ui1-t', ask, { box: 48, dpr: 2 }), null);
    assert.equal(requestFittedPicture('ui1-t', ask, { box: 48, dpr: 1, cap: 1 }), null);
    await settle();
    assert.deepEqual(requestFittedPicture('ui1-t', ask, { box: 32, dpr: 1 }), { src: 'data:image/png;fit-32x32', w: 32, h: 32, smooth: true });
    assert.deepEqual(requestFittedPicture('ui1-t', ask, { box: 48, dpr: 2 }), { src: 'data:image/png;fit-80x80', w: 40, h: 40, smooth: false });
    assert.deepEqual(requestFittedPicture('ui1-t', ask, { box: 48, dpr: 1, cap: 1 }), { src: 'data:image/png;fit-20x20', w: 20, h: 20, smooth: false });
    assert.ok(_fittedKeys().includes('ui1-t@48x1c4') && _fittedKeys().includes('ui1-t@32x1c4') && _fittedKeys().includes('ui1-t@48x2c4'));
    // a picture whose source never lands: nothing, and no one told
    let never = 0;
    assert.equal(requestFittedPicture('ui1-miss', () => null, { box: 48, onReady: () => never++ }), null);
    await settle();
    assert.equal(requestFittedPicture('ui1-miss', () => null, { box: 48 }), null);
    assert.equal(never, 0);
    // no box, no door
    assert.equal(requestFittedPicture('ui1-t', ask, { box: 0 }), null);
  });
});

test('UI1 door: requestIcon tells every screen that asked while a record was in flight - the first asker\'s onReady was the only one heard, so a fitted picture asked second never came (mutant: the waiter not heard)', async () => {
  clearVendorTextures();
  addVendorTextures(VENDOR_ICON_FILES.map((f) => {
    const m = /^(\d+)_(\d+)-(\d+)$/.exec(f);
    return { archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]), fileName: f, standIn: true, load: async () => new Uint8Array(8) };
  }));
  const decoded = { width: 6, height: 4, data: new Uint8Array(6 * 4 * 4).fill(255) };
  await preloadTextureArchive(539, { decode: async () => decoded });
  try {
    await withCanvases(async () => {
      const told = { a: 0, b: 0, c: 0 };
      assert.equal(requestIcon(539, 0, { scale: 3, onReady: () => told.a++ }), null, 'cold');
      assert.equal(requestIcon(539, 0, { scale: 3, onReady: () => told.b++ }), null, 'in flight');
      await settle();
      assert.deepEqual(told, { a: 1, b: 0 + 1, c: 0 }, 'the second screen heard it land too');
      assert.match(requestIcon(539, 0, { scale: 3, onReady: () => told.c++ }), /^data:image\/png;fit-18x12$/);
      await settle();
      assert.equal(told.c, 0, 'a landed record tells no one');
      // a record the archive has not got: a miss, and whoever waits on it is told nothing
      let miss = 0;
      assert.equal(requestIcon(539, 7, { scale: 3, onReady: () => miss++ }), null);
      assert.equal(requestIcon(539, 7, { scale: 3, onReady: () => miss++ }), null);
      await settle();
      assert.equal(miss, 0);
    });
  } finally { clearVendorTextures(); }
});

test('UI1 element: a fitted picture carries its own size, never past its box, never the browser\'s own drag; AUDIT UI A1 drawn pixel for pixel - no inline smoothing, the sheets\' img.fit rule pixelated, smoothed only in the phone\'s socket the page shrinks it into (mutants: an inline auto again; the sheet\'s rule gone; the socket pixel-dropped; the size dropped)', async () => {
  withDom(() => {
    const img = fittedImg({ src: 'data:x', w: 40, h: 14.5, smooth: false });
    assert.equal(img.tagName, 'IMG');
    assert.equal(img.className, 'fit');
    assert.equal(img.src, 'data:x');
    assert.equal(img.alt, '');
    assert.equal(img.draggable, false);
    assert.deepEqual({ ...img.style }, { width: '40px', height: '14.5px', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: '' });
    assert.equal(fittedImg({ src: 'y', w: 1, h: 1, smooth: true }).className, 'fit smooth');
  });
  assert.equal(iconName(233, 5, null), '233_5');
  const { ENHANCED_CSS } = await import('../src/ui/enhancedStyle.js');
  const { PLUS_CSS } = await import('../src/ui/enhancedPlusStyle.js');
  assert.match(ENHANCED_CSS, /\nimg\.fit \{ image-rendering: pixelated; \}/, 'the sheet draws it pixel for pixel');
  assert.match(PLUS_CSS, /@media \(max-width: 640px\) \{ \.pack-shell \.wornsock \.tile img\.fit \{ image-rendering: auto; \} \}/, 'the phone\'s socket smooths what it shrinks');
});

test('UI1 x DYE-ICON (the merge with main): a fitted picture is named by its dye AND the swatch the classic arm dyes by it, as requestIcon keys it - a silver blade (18, a dye with no name) and the base one are two fitted pictures, where the name alone made them one; the fitted door asks its source by both (mutants: the fitted name by the dye alone; the swatch dropped at the fitted door)', () => {
  assert.equal(iconName(233, 5, 18, 1), '233_5_t1d18', 'the swatch and the dye, as requestIcon keys them');
  assert.equal(iconName(233, 5, 18, null), '233_5', 'no swatch named: the name alone, as before');
  assert.equal(iconName(233, 5, null, 1), '233_5', 'no dye: nothing to change');
  assert.notEqual(iconName(233, 5, 18, 1), iconName(233, 5, 18, null));
  requestFittedIcon(233, 5, { box: 12, dye: 18, dyeTarget: 1 });
  requestFittedIcon(233, 5, { box: 12, dye: 18 });
  assert.ok(_fittedKeys().includes('233_5_t1d18@12x1c4'), 'the silver blade, fitted');
  assert.ok(_fittedKeys().includes('233_5@12x1c4'), 'the base one, fitted apart');
  assert.match(readFileSync(new URL('../src/ui/textureCanvas.js', import.meta.url), 'utf8'),
    /\(wake\) => requestIcon\(archive, record, \{ scale: 1, dye, dyeTarget, onReady: wake \}\)/, 'the source asked by the swatch too');
});

// ── THE SLOTS ───────────────────────────────────────────────────────

test('UI1 boxes: each surface\'s box is its sheet\'s well inside the frame, less two pixels a side; the grid\'s on a phone, the body\'s on a desktop (mutants: a box off its sheet; the phone\'s grid box ignored; the desktop\'s worn box ignored)', () => {
  const E = ENHANCED_CSS, P = PLUS_CSS;
  // the pack's slot: 64 round a 52 well (the frame is the slot's; the well has none) - 56 round 44 on a phone
  assert.match(E, /\.pack-shell \.itemrow \{ position: relative;[^}]*width: 64px; height: 64px;/);
  assert.match(E, /\.pack-shell \.itemrow \.tile \{ display: flex; width: 52px; height: 52px;/);
  assert.match(E, /@media \(max-width: 640px\) \{\n {2}\.pack-shell \.itemrow \{ width: 56px; height: 56px; \}\n {2}\.pack-shell \.itemrow \.tile \{ width: 44px; height: 44px;/);
  assert.equal(SLOT_BOX.grid, 52 - 4);
  assert.equal(SLOT_BOX.gridPhone, 44 - 4);
  // the worn panels: a 34px tile (28 a half) with its own 1px edge - the tier's frame is the PANEL's (UI1b); a
  // desktop's room up to 56 (44 a half), the full panel's box the grid's own
  assert.match(E, /\.pack-shell \.charcol \.wornrow \.tile \{ width: 34px; height: 34px; \}/);
  assert.match(P, /\.pack-shell \.wornpair > \.wornrow \.tile \{ width: 28px; height: 28px;/);
  assert.equal(SLOT_BOX.worn, 34 - 2 - 4);
  assert.equal(SLOT_BOX.wornHalf, 28 - 2 - 4);
  assert.match(P, /@media \(min-width: 1000px\) \{\n {2}\.pack-shell \.charcol \.equipped \.wornrow \.tile \{ width: auto; height: min\(56px, calc\(100% - 4px\)\); aspect-ratio: 1;/);
  assert.match(P, /\.pack-shell \.charcol \.equipped \.wornpair > \.wornrow \.tile \{ height: min\(44px, calc\(100% - 26px\)\);/);
  assert.ok(SLOT_BOX.wornWide <= 56 - 2 - 4, 'inside its room');
  assert.equal(SLOT_BOX.wornHalfWide, 44 - 2 - 4);
  assert.equal(SLOT_BOX.wornWide, SLOT_BOX.grid, 'the body\'s picture and the pack\'s are one');
  // the loot row, the shop's row, the Broker's offer, the shelf's socket
  assert.match(E, /\.loot-win \.itemrow \.tile \{ width: 38px; height: 38px;/);
  assert.equal(SLOT_BOX.loot, 38 - 4 - 4);
  assert.match(P, /\.trade-shell \.itemrow \.tile \{ width: 34px; height: 34px; border: 2px solid;/);
  assert.equal(SLOT_BOX.row, 34 - 4 - 4);
  assert.match(P, /\.broker-frame \.tile \{[^}]*width: 36px; height: 36px;/);
  assert.equal(SLOT_BOX.broker, 36 - 4);
  assert.match(P, /\.pack-shell \.wornsock \{ position: relative; aspect-ratio: 1;[^}]*padding: 2px;/);
  assert.equal(SLOT_BOX.socket, 44 - 4 - 4 - 4, 'a desktop\'s 44px socket, its 2px frame and 2px padding');
  assert.match(P, /\.inv-tip \.bigicon img \{ width: 96px; height: 96px;/);
  assert.equal(SLOT_BOX.card, 96);
  // which box on this screen: the pack's phone line and its desktop line
  assert.equal(PHONE_QUERY, '(max-width: 640px)'); assert.equal(WIDE_QUERY, '(min-width: 1000px)');
  assert.ok(E.includes(`@media ${PHONE_QUERY} {`) && E.includes(`@media ${WIDE_QUERY} {`));
  const was = globalThis.matchMedia;
  try {
    delete globalThis.matchMedia;
    assert.deepEqual([gridBox(), wornBox(), wornBox(true)], [SLOT_BOX.grid, SLOT_BOX.worn, SLOT_BOX.wornHalf], 'no matchMedia: a desktop grid, the compact body');
    globalThis.matchMedia = (q) => ({ matches: q === PHONE_QUERY });
    assert.deepEqual([gridBox(), wornBox(), wornBox(true)], [SLOT_BOX.gridPhone, SLOT_BOX.worn, SLOT_BOX.wornHalf], 'a phone');
    globalThis.matchMedia = (q) => ({ matches: q === WIDE_QUERY });
    assert.deepEqual([gridBox(), wornBox(), wornBox(true)], [SLOT_BOX.grid, SLOT_BOX.wornWide, SLOT_BOX.wornHalfWide], 'a desktop');
  } finally { if (was) globalThis.matchMedia = was; else delete globalThis.matchMedia; }
});

const hero = (items) => ({
  isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 5,
  stats: { strength: 50, endurance: 48 }, activeEffects: [], spells: [], items, goldPieces: 100,
});
const arrows = (n) => { const a = createWeapon(131, 3); a.stackCount = n; return a; };
const gems = (n) => { const g = mintCondition(setItemFields({ group: 'Gems', templateIndex: 0 })); g.stackCount = n; return g; };

test('UI1 slots: the pack\'s slot shows a stack\'s count in its corner (a single piece none), the loot row says it in its name alone; each surface asks for its own box - the grid, the loot row, the body\'s panel, the carried ghost the grid\'s own (mutants: no count; the count on the loot row; the grid\'s box on the loot row; the ghost at its own box)', () => {
  const was = globalThis.matchMedia;
  globalThis.matchMedia = (q) => ({ matches: q === WIDE_QUERY });   // a desktop: the body's panels are plates
  try {
    withDom((dom) => {
      const sword = createWeapon(120, 3);
      const items = [sword, arrows(40), gems(3), createWeapon(113, 3)];
      const e = hero(items);
      equipItem(e, sword);
      const host = dom.mk('div');
      dom.body.append(host);
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
      const one = (n, cls) => n.querySelectorAll('.' + cls)[0] ?? null;
      const dock = () => one(dom.doc, 'pack-dock');
      const rows = () => dock().querySelectorAll('.itemrow');
      const countOf = (r) => one(r, 'count')?.textContent ?? null;
      // the weapons page: arrows x40 and a dagger
      const w = rows();
      assert.deepEqual(w.map((r) => [one(r, 'itemname').children[0].textContent, countOf(r)]), [['Arrow ×40', '40'], ['Dagger', null]]);
      // the valuables page: the rubies x3
      one(dom.doc, 'packtabs').querySelectorAll('.packtab')[PAGE_IDS.indexOf('valuables')].onclick({});
      assert.deepEqual(rows().map(countOf), ['3']);
      // THE BOXES ASKED: the grid 48, the body's panel 48 (a desktop), each at the page's ratio (1)
      const nameOf = (it) => { const img = inventoryItemImage(it); return iconName(img.archive, img.record, img.dye, img.dyeTarget); };
      assert.ok(_fittedKeys().includes(`${nameOf(items[1])}@${SLOT_BOX.grid}x1c4`), 'the arrows at the grid\'s box');
      assert.ok(_fittedKeys().includes(`${nameOf(sword)}@${SLOT_BOX.wornWide}x1c4`), 'the worn longsword at the desktop panel\'s');
      // THE GHOST: a carry off the dagger's slot draws at the grid's box - no second picture
      one(dom.doc, 'packtabs').querySelectorAll('.packtab')[PAGE_IDS.indexOf('weapons')].onclick({});
      const before = _fittedKeys().length;
      const dagger = rows()[1];
      dagger.onpointerdown({ pointerId: 1, button: 0, clientX: 10, clientY: 10, pointerType: 'mouse', preventDefault() {}, stopPropagation() {} });
      dom.win.fire('pointermove', { pointerId: 1, clientX: 60, clientY: 40, pointerType: 'mouse', preventDefault() {} });
      const ghost = dom.body.querySelectorAll('.dragghost')[0];
      assert.ok(ghost, 'the ghost is up');
      assert.equal(_fittedKeys().length, before, 'the ghost asked for no picture the slot had not');
      assert.ok(_fittedKeys().includes(`${nameOf(items[3])}@${SLOT_BOX.grid}x1c4`));
      dom.win.fire('pointerup', { pointerId: 1, clientX: 60, clientY: 40, pointerType: 'mouse', preventDefault() {} });
      view.unmount();
    });
    // A LOOT PILE (the pack's own frame not built while it is closed - PX20b): the row says x2 in its name, no badge,
    // and its picture is asked at the loot row's box
    withDom((dom) => {
      const e = hero([]);
      const pile = [gems(2)];
      const host = dom.mk('div');
      dom.body.append(host);
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => pile }, onExit: () => {} });
      const loot = dom.doc.querySelectorAll('.loot-win')[0];
      assert.ok(loot, 'the loot window');
      const rows = loot.querySelectorAll('.itemrow');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].querySelectorAll('.itemname')[0].children[0].textContent, 'Ruby ×2');
      assert.equal(loot.querySelectorAll('.count').length, 0, 'no badge: the name says it');
      const img = inventoryItemImage(pile[0]);
      assert.ok(_fittedKeys().includes(`${iconName(img.archive, img.record, img.dye, img.dyeTarget)}@${SLOT_BOX.loot}x1c4`), 'at the loot row\'s box');
      view.unmount();
    });
  } finally { if (was) globalThis.matchMedia = was; else delete globalThis.matchMedia; }
});

test('UI1b sheet: THE SLOT IS THE FRAME - the tier on the slot\'s own border and the picture in no second box: the grid\'s slot, the worn panel (its rune and padlock at the panel\'s corners, the family count stepping off the rune), the shelf\'s socket, the hotbar\'s slot, the diamond\'s cell, the carried ghost; a list row\'s picture keeps the frame, having no slot; the count\'s corner clear of the padlock and the wear bar (mutants: the worn frame back on its tile; the grid given an inner box; the count on the padlock)', () => {
  const P = PLUS_CSS, E = ENHANCED_CSS;
  // the grid: the tier on the slot, and the room inside it no box of its own
  assert.match(P, /\.pack-shell \.pack-dock \.itemrow\[data-rarity\] \{\n {2}border-color: var\(--rar-hi\) var\(--rar-lo\) var\(--rar-lo\) var\(--rar-hi\);/);
  assert.doesNotMatch(P, /\.pack-shell \.pack-dock \.itemrow(\[data-rarity\])? \.tile \{[^}]*(background|box-shadow|border):/, 'no box inside the grid\'s slot');
  assert.match(E, /\.pack-shell \.itemrow \.tile \{ display: flex; width: 52px; height: 52px; align-items: center;\n {2}justify-content: center; border: 0; background: none;/);
  // the worn panel: the panel is the frame
  assert.match(P, /\.pack-shell \.equipped \.wornrow\[data-rarity\] \{\n {2}border-color: var\(--rar-hi\) var\(--rar-lo\) var\(--rar-lo\) var\(--rar-hi\);/);
  assert.match(P, /\.pack-shell \.equipped \.wornrow\[data-rarity\]:hover, \.pack-shell \.equipped \.wornrow\[data-rarity\]:focus-visible \{\n {2}border-color: var\(--rar-hi\);/);
  assert.match(P, /\.pack-shell \.equipped \.wornrow\[data-rarity\]\.on \{ border-color: var\(--rar-hi\);/);
  assert.doesNotMatch(P, /\.pack-shell \.wornrow\[data-rarity\] \.tile/, 'the worn tile wears no frame of its own');
  assert.doesNotMatch(P, /wornrow:not\(\[data-rarity\]\) \.tile\.has-icon \{ background/, 'nor a Common piece\'s box');
  assert.match(P, /\.pack-shell \.pack-dock \.itemrow\[data-sigil\]::after, \.pack-shell \.wornsock\[data-sigil\]::after,\n\.pack-shell \.equipped \.wornrow\[data-sigil\]::after \{ right: 3px; top: 3px; \}/, 'the rune at the panel\'s corner');
  assert.match(P, /\.pack-shell \.equipped \.wornrow\[data-sigil\] \.worncount \{ right: 18px; \}/);
  assert.match(P, /\.pack-shell \.equipped \.wornrow\[data-locked\] \.tile::before \{ content: none; \}\n\.pack-shell \.equipped \.wornrow\[data-locked\]::before \{ content: ''; position: absolute; left: 3px; top: 3px;/, 'the padlock too');
  // the socket, the hotbar, the diamond and the ghost were their own frames already
  for (const sel of ['.pack-shell .wornsock[data-rarity] { border-color: var(--rar-hi)', '.hb .hb-slot[data-rarity] .hb-frame { border-color: var(--rar-hi)',
    '.hud-qdiamond .hud-qcell[data-rarity]:not(.socket) .hud-qframe {', '.dragghost[data-rarity] .tile.has-icon, .dragghost[data-rarity] .tile { border: 2px solid;']) {
    assert.ok(P.includes(sel), sel);
  }
  assert.match(HOTBAR_CSS, /\.hb-frame \{ position: absolute; inset: 0; border: 2px solid/, 'the hotbar\'s frame is the slot\'s own edge');
  // a list row has no slot: its picture is the frame
  assert.match(P, /\.pack-shell \.loot-win \.itemrow\[data-rarity\] \.tile, \.trade-shell \.itemrow\[data-rarity\] \.tile,\n\.ptrade-shell \.itemrow\[data-rarity\] \.tile \{\n {2}border: 2px solid;/);
  // the corners
  assert.match(P, /\.pack-shell \.pack-dock \.itemrow \.count \{ right: 4px; bottom: 3px; z-index: 2;/);
  assert.match(P, /\.pack-shell \.pack-dock \.itemrow\.hasbar \.count \{ bottom: 7px; \}/);
  assert.match(P, /\.pack-shell \.pack-dock \.itemrow\[data-locked\] \.count \{ right: 16px; \}/);
  assert.match(P, /\.pack-shell \[data-locked\] \.tile::before, [^{]*\{\n {2}content: ''; position: absolute; right: 2px; bottom: 2px; width: 11px;/, 'the padlock\'s 11px in the corner the count steps off');
  assert.match(E, /\.dragghost \.tile\.has-icon, \.dragghost \.tile \{\n {2}width: 56px; height: 56px;/, 'the carried tile outgrows the 52px room it lifts from');
  // the old cap is the initials' now, and the fitted picture's own style outranks it
  assert.match(E, /\.tile img \{ image-rendering: pixelated; max-width: 30px; max-height: 30px; \}/);
});

test('UI1 wiring: every enhanced surface draws its item through the one fitted door, each at its box (mutants: a surface back on the unfitted door)', () => {
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /export function linePicture\(line, \{ box, onReady = null \} = \/\*\* @type \{any\} \*\/ \(\{\}\)\) \{\n {2}if \(!line\.image && line\.model == null\) return null;\n {2}\/\/ MERGE \(UI1 x DYE-ICON\)[^\n]*\n {2}const name = line\.image \? iconName\(line\.image\.archive, line\.image\.record, line\.image\.dye, line\.image\.dyeTarget\) : `model\$\{line\.model\}`;\n {2}return requestFittedPicture\(name, \(wake\) => linePictureUrl\(line, \{ scale: 1, onReady: wake \}\), \{ box, dpr: screenDpr\(\), onReady \}\);/);
  assert.match(inv, /const pic = modelPicture\(line\.item, box\)\n {4}\|\| linePicture\(line, \{ box, onReady: ready \}\);/, 'the tile: the Morrowind icon, then the classic record');
  assert.match(inv, /const big = modelPicture\(line\.item, SLOT_BOX\.card\)\n {4}\|\| linePicture\(line, \{ box: SLOT_BOX\.card, onReady: ready \}\);/, 'the card');
  assert.match(inv, /row\.append\(tileWithWear\(line, row, from === 'remote' \? SLOT_BOX\.loot : gridBox\(\)\)\);/);
  assert.match(inv, /b\.append\(tileWithWear\(line, b, wornBox\(area == null\)\)\);/);
  assert.match(inv, /b\.append\(tileWithWear\(line, b, SLOT_BOX\.socket\)\);/);
  assert.match(inv, /node\.append\(line \? itemTile\(line, wornBox\(true\)\) :/);
  assert.match(inv, /const tile = \(\) => itemTile\(line, gridBox\(\), \(\) => \{ if \(ghost === g\) g\.querySelector\('\.tile'\)\?\.replaceWith\(tile\(\)\); \}\);/);
  for (const f of ['src/ui/enhancedTrade.js', 'src/ui/enhancedPlayerTrade.js']) {
    assert.match(read(f), /linePicture\(line, \{ box: SLOT_BOX\.row, onReady:/, f);
    assert.doesNotMatch(read(f), /linePictureUrl/, `${f}: nothing on the unfitted door`);
  }
  assert.match(read('src/ui/brokerWindow.js'), /requestFittedIcon\(img\.archive, img\.record, \{ box: SLOT_BOX\.broker, dpr: screenDpr\(\), dye: img\.dye, dyeTarget: img\.dyeTarget, onReady \}\)/);
  assert.doesNotMatch(inv.slice(inv.indexOf('function itemTile('), inv.indexOf('export const itemStatSuffix')), /linePictureUrl|img\.width\s*=/, 'the tile: no unfitted picture, no width attribute');
});

test('UI1 AUDIT UI A2/A3/A4: a tiered worn panel keeps its glow under a textured theme (level with Stone\'s tile rule, and later); a pack left open repaints when its slots\' boxes change under it - a phone turned, a window narrowed - and not when they do not; the fitted pictures kept are bounded, the oldest asked going first (mutants: the glow under Stone lost; no repaint on a resize; a repaint on every resize; the cache unbounded)', async () => {
  // A2: the rule outranks the theme's tile texture at equal weight by coming after it
  const glow = PLUS_CSS.indexOf(':root .pack-shell .equipped .wornrow[data-rarity] {');
  assert.ok(glow > 0, 'the glow at :root weight');
  const stone = PLUS_CSS.indexOf(':root[data-plus-theme="stone"] .pack-shell .equipped .wornrow');
  assert.ok(stone > 0 && stone < glow, 'the theme\'s tile rule first, the glow after it');
  // A3: the pack's resize handler
  const was = globalThis.matchMedia;
  let phone = false;
  globalThis.matchMedia = (q) => ({ matches: q === PHONE_QUERY ? phone : false });
  try {
    withDom((dom) => {
      const sword = createWeapon(120, 3);
      const e = hero([sword, createWeapon(113, 3)]);
      const host = dom.mk('div');
      dom.body.append(host);
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
      assert.equal(dom.win.count('resize'), 1, 'the pack listens');
      const paints = () => JSON.parse(globalThis.__pack()).repaints;
      const before = paints();
      dom.win.fire('resize', {});
      assert.equal(paints(), before, 'nothing changed: no repaint');
      phone = true;   // turned to a phone's width: the grid's box is the phone's
      dom.win.fire('resize', {});
      assert.equal(paints(), before + 1, 'the boxes changed: a repaint');
      view.unmount();
      assert.equal(dom.win.count('resize'), 0, 'and the listener goes with the pane');
    });
  } finally { globalThis.matchMedia = was; }
  // A4: the fitted pictures kept are bounded
  const { FIT_CACHE_MAX } = await import('../src/ui/textureCanvas.js');
  for (let i = 0; i < FIT_CACHE_MAX + 20; i++) requestFittedPicture(`auditA4_${i}`, () => null, { box: 10 });
  const keys = _fittedKeys();
  assert.ok(keys.length <= FIT_CACHE_MAX, `${keys.length} kept`);
  assert.ok(!keys.includes('auditA4_0@10x1c4'), 'the oldest went');
  assert.ok(keys.includes(`auditA4_${FIT_CACHE_MAX + 19}@10x1c4`), 'the newest stays');
});
