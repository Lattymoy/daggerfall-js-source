// MAP-PAN: the world sheet's place marks are one layer. A pan shifts it;
// a zoom paints the marks again. A glyph is a paper-pixel size, so the
// layer is never scaled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  paintInkStatic, paintInkMarks, syncMarksLayer, blitMarksLayer, marksLayerHolds, marksMargin,
  MARKS_PAN_PAD, MARKS_DEVICE_PIXELS, toPaper,
} from '../../src/ui/ink/inkMap.js';

const read = (p) => readFileSync(p, 'utf8');

/** A recording 2D context: every call, and every style set. */
function recordingCtx() {
  const calls = [];
  const state = {};
  const ctx = new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
  return ctx;
}

const city = { x: 10, y: 10, colorIndex: 11, kind: 'city', name: 'Sentinel', mapId: 1, port: false };
const model = { coast: [], borders: [], roads: [], tracks: [], regions: [], high: [], marks: [city] };

test('MAP-PAN: a pan shifts the marks layer and does not paint the places again; a zoom does (mutants: marks-repainted-per-pan, marks-layer-on-zoom, marks-keyed-by-pan)', () => {
  const ctx = recordingCtx();
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  let made = 0;
  const spec = (view, contentKey) => ({
    view, paperW: 200, paperH: 100, dpr: 1, contentKey, model,
    markOpts: { band: 'near', ports: true },
    createCanvas: () => { made += 1; return canvas; },
  });
  const arcs = () => ctx.calls.filter((c) => c.fn === 'arc').length;
  const first = syncMarksLayer(null, spec({ ox: 0, oy: 0, scale: 4 }, 'near|4'));
  assert.equal(first.baked, true);
  assert.equal(made, 1);
  const painted = arcs();
  assert.ok(painted > 0, 'the bake inks the city');
  assert.equal(marksMargin(200, 100, 1).padX, 200 * MARKS_PAN_PAD, 'half a paper past each edge, while the bitmap fits');

  const panned = { ox: 3, oy: 1, scale: 4 };
  const held = syncMarksLayer(first.layer, spec(panned, 'near|4'));
  assert.equal(held.baked, false, 'a pan inside the bake does not paint');
  assert.equal(arcs(), painted, 'and no place is walked again');
  assert.equal(made, 1, 'one canvas for the layer');
  assert.equal(held.layer, first.layer);

  const dest = recordingCtx();
  blitMarksLayer(dest, held.layer, panned);
  const img = dest.calls.find((c) => c.fn === 'drawImage');
  const [gx, gy] = ctx.calls.find((c) => c.fn === 'arc').args;
  assert.deepEqual(
    [gx + img.args[1], gy + img.args[2]],
    toPaper(panned, city.x, city.y),
    'the shifted layer lands the glyph where a fresh paint would',
  );
  assert.equal(dest.calls.find((c) => c.fn === 'drawImage').args[0], canvas);
  const sized = recordingCtx();
  blitMarksLayer(sized, { canvas: { width: 200, height: 100 }, ox: 0, oy: 0, scale: 4, dpr: 2, paperW: 100, paperH: 50 }, { ox: 0.2, oy: 0, scale: 4 });
  // (0 - 0.2) * 4 = -0.8 paper px, -1.6 device px, rounded to -2 device px = -1 paper px; the dest size is the bitmap over dpr
  assert.deepEqual(sized.calls.find((c) => c.fn === 'drawImage').args.slice(1), [-1, 0, 100, 50]);

  const zoomed = syncMarksLayer(held.layer, spec({ ox: 3, oy: 1, scale: 8 }, 'near|8'));
  assert.equal(zoomed.baked, true, 'a zoom paints the marks again');
  assert.equal(marksLayerHolds(held.layer, { ox: 3, oy: 1, scale: 8 }, 200, 100), false, 'the old layer does not hold across a scale');

  const walked = syncMarksLayer(zoomed.layer, spec({ ox: 80, oy: 1, scale: 8 }, 'near|8'));
  assert.equal(walked.baked, true, 'a pan that leaves the bake paints again');

  const changed = syncMarksLayer(walked.layer, spec({ ox: 80, oy: 1, scale: 8 }, 'far|8'));
  assert.equal(changed.baked, true, 'a band change paints again');

  assert.equal(syncMarksLayer(null, { ...spec({ ox: 0, oy: 0, scale: 4 }, 'x'), createCanvas: () => ({ getContext: () => null }) }).layer, null);
});

test('MAP-PAN: the sheet blits the layer in place of the mark walk, and the world sheet keys that layer on everything but the pan (mutants: marks-still-walked, marks-keyed-by-ox)', () => {
  const bare = recordingCtx();
  paintInkStatic(bare, model, { ox: 0, oy: 0, scale: 4 }, { paperW: 80, paperH: 60, band: 'near' });
  assert.ok(bare.calls.some((c) => c.fn === 'arc'), 'with no layer the marks are inked');

  const layered = recordingCtx();
  const layer = { canvas: { width: 120, height: 90 }, ox: -10, oy: -8, scale: 4, dpr: 1, paperW: 120, paperH: 90 };
  paintInkStatic(layered, model, { ox: 0, oy: 0, scale: 4 }, { paperW: 80, paperH: 60, band: 'near', marksLayer: layer });
  assert.ok(layered.calls.some((c) => c.fn === 'drawImage' && c.args[0] === layer.canvas), 'the layer is blitted');
  assert.ok(!layered.calls.some((c) => c.fn === 'arc'), 'and no mark is painted onto the sheet');

  const held = read('src/ui/heldMap.js');
  const sheet = held.slice(held.indexOf('  _worldSheet() {'), held.indexOf('  _showChrome('));
  assert.match(sheet, /syncMarksLayer\(this\._marksLayer/);
  assert.match(sheet, /contentKey: \[env\.view\.scale, env\.band, env\.dpr, env\.paperW, env\.paperH, sheet\.staticKey\(\)\]/);
  assert.doesNotMatch(sheet, /contentKey: \[[^\]]*env\.view\.ox/);
  assert.match(sheet, /marksLayer: synced\.layer/);
  assert.match(read('src/ui/ink/inkMap.js'), /export function syncMarksLayer\(prev, spec\)/);

  // the inline path and the bake call the same painter
  const again = recordingCtx();
  paintInkMarks(again, model, { ox: 0, oy: 0, scale: 4 }, { paperW: 80, paperH: 60, band: 'near' });
  assert.ok(again.calls.some((c) => c.fn === 'arc'));
});

test('MAP-PAN: the margin gives way when the bitmap would pass the device cap (mutants: marks-uncapped)', () => {
  assert.equal(marksMargin(200, 100, 1).padY, 50);
  assert.equal(marksMargin(8000, 100, 1).padX, (8192 - 8000) / 2);
  assert.equal(marksMargin(9000, 100, 1).padX, 0, 'a paper already past the cap bakes flush');
});

test('MAP-PAN: the margin also gives way when the bitmap\'s area would pass the cap (mutants: marks-area-uncapped)', () => {
  // a 5K landscape sheet: half a paper of pad on both axes stays under 8192 a side and is still ~150MB
  const paperW = 3965, paperH = 2420;
  const full = marksMargin(paperW, paperH, 1);
  assert.ok(full.padX < paperW * MARKS_PAN_PAD && full.padY < paperH * MARKS_PAN_PAD, 'both pads shrink together');
  assert.ok(full.padX > 0 && full.padY > 0, 'the paper itself fits, so a margin remains');
  const dw = paperW + 2 * full.padX;
  const dh = paperH + 2 * full.padY;
  assert.ok(dw <= 8192 && dh <= 8192, 'each side stays under the side cap');
  assert.ok(dw * dh <= MARKS_DEVICE_PIXELS, 'and the bitmap stays under the area cap');
  assert.equal(marksMargin(6000, 4000, 1).padX, 0, 'a paper already past the area bakes flush');
});

test('MAP-PAN: a layer is kept only when its blit covers the whole paper (mutants: marks-kept-short)', () => {
  const view = { ox: 0, oy: 0, scale: 4 };
  const cover = { canvas: { width: 200, height: 100 }, ox: 0, oy: 0, scale: 4, dpr: 2, paperW: 100, paperH: 50 };
  assert.equal(marksLayerHolds(cover, view, 100, 50), true, 'the blit fills the paper');
  // one device pixel inside the left edge
  assert.equal(marksLayerHolds({ ...cover, ox: 1 / 8 }, view, 100, 50), false, 'a strip inside the left edge is not covered');
  assert.equal(marksLayerHolds({ ...cover, canvas: { width: 199, height: 100 } }, view, 100, 50), false, 'a bitmap short of the paper is not covered');
});
