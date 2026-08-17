// U8a: the native 320x200 panel foundation (DFU NativePanel
// semantics) + the first real-art window's loader path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { nativeMetrics, pointToNative, loadImg, NATIVE_W, NATIVE_H, DEFAULT_TEXT_COLOR } from '../src/ui/nativePanel.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('nativePanel: integer-scale centered metrics + the point mapping', () => {
  assert.equal(NATIVE_W, 320);
  assert.equal(NATIVE_H, 200);
  // 1400x900: min(4.375, 4.5) -> 4; letterbox centers 1280x800
  const m = nativeMetrics({ width: 1400, height: 900 });
  assert.deepEqual(m, { s: 4, ox: 60, oy: 50 });
  // smaller than native: the scale floors at 1
  assert.equal(nativeMetrics({ width: 300, height: 100 }).s, 1);
  // screen -> virtual round trip (a label position under the scale)
  assert.deepEqual(pointToNative(m, m.ox + 41 * 4, m.oy + 4 * 4), [41, 4]);
  assert.equal(pointToNative(m, 0, 0), null, 'outside the panel is null');
  // DFU's default label color (243,239,44)
  assert.deepEqual(DEFAULT_TEXT_COLOR.map((v) => Math.round(v * 255)), [243, 239, 44, 255]);
});

test('nativePanel: INFO00I0 loads 320x200 through the IMG reader', { skip: skipReal }, async () => {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  let uploaded = null;
  const renderer = { uploadTexture: (group, name, bmp) => { uploaded = { name, w: bmp.width, h: bmp.height }; return `tex:${name}`; } };
  const img = await loadImg({
    renderer, palette,
    fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))),
  }, 'INFO00I0.IMG');
  assert.equal(img.w, 320, 'the char sheet page is full-screen');
  assert.equal(img.h, 200);
  assert.equal(img.tex, 'tex:INFO00I0.IMG');
  assert.deepEqual(uploaded, { name: 'INFO00I0.IMG', w: 320, h: 200 });
});
