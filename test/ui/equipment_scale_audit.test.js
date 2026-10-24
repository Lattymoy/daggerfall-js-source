import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitIcon } from '../../src/ui/iconFit.js';

test('equipment icons keep the requested UI size across fractional display scales', () => {
  // Original-art helm and differently shaped armor/weapon pictures; the UI
  // should grow with display scaling, without each record snapping differently.
  for (const [w, h] of [[23, 25], [38, 50], [65, 29], [86, 24]]) {
    for (const box of [22, 28, 38, 48]) {
      for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.625, 3]) {
        const f = fitIcon(w, h, { box, dpr, snap: false });
        assert.ok(Math.abs(Math.max(f.cssW, f.cssH) - box) <= 1 / dpr);
        assert.ok(Math.abs(f.outW - f.outH * w / h) <= 1 + w / h);
        assert.ok(Math.max(f.cssW, f.cssH) <= box + 1e-9);
      }
    }
  }
});

test('stable equipment sizing preserves small-sprite caps and the default fit policy', () => {
  assert.equal(fitIcon(9, 9, { box: 48, dpr: 1.25, snap: false }).cssH, 36);
  assert.equal(fitIcon(23, 25, { box: 48, dpr: 1.25 }).cssH, 40);
  assert.equal(fitIcon(23, 25, { box: 48, dpr: 1.25, snap: false }).cssH, 48);
  assert.equal(fitIcon(24, 24, { box: 48, dpr: 1, snap: false }).smooth, false);
});
