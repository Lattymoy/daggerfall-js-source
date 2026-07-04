import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNeutralBody } from '../src/characters/neutralBody.js';

// Two-step ramps (dark -> bright) so shading has a range to snap into.
const ramps = {
  skin: [[60, 48, 34], [110, 86, 56], [170, 130, 92], [210, 168, 124]],
  boot: [[40, 34, 30], [70, 58, 44], [110, 92, 66]],
};

test('neutral: builds a well-formed figure', () => {
  const faces = buildNeutralBody(ramps);
  assert.ok(faces.length > 1500, `expected a dense mesh, got ${faces.length}`);
  let minY = Infinity, maxY = -Infinity;
  const skinSet = new Set(ramps.skin.map((c) => c.join(',')));
  const bootSet = new Set(ramps.boot.map((c) => c.join(',')));
  for (const f of faces) {
    assert.equal(f.p.length, 12, 'quad = 4 verts x xyz');
    assert.equal(f.n.length, 3, 'one normal per face');
    assert.equal(f.c.length, 3, 'one rgb per face');
    // colour is a real palette-ramp entry (skin or boot), nothing invented
    assert.ok(skinSet.has(f.c.join(',')) || bootSet.has(f.c.join(',')), `off-ramp colour ${f.c}`);
    const nlen = Math.hypot(f.n[0], f.n[1], f.n[2]);
    assert.ok(Math.abs(nlen - 1) < 1e-6, `normal not unit: ${nlen}`);
    for (let i = 0; i < 4; i++) { const y = f.p[i * 3 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  // feet on the ground, ~7.5-head height, upright.
  assert.ok(minY >= -1e-6 && minY < 0.03, `feet near ground, min y ${minY}`);
  assert.ok(maxY > 1.9 && maxY < 2.15, `crown near 2.0, got ${maxY}`);
});

test('neutral: shading is deterministic and blocky', () => {
  const a = buildNeutralBody(ramps), b = buildNeutralBody(ramps);
  assert.equal(a.length, b.length);
  // identical inputs -> byte-identical geometry + colour
  for (let i = 0; i < a.length; i++) {
    assert.deepEqual(a[i].c, b[i].c);
    assert.deepEqual(a[i].p, b[i].p);
  }
  // snapped shading: only ramp steps appear, no interpolated in-between colours
  const seen = new Set(a.map((f) => f.c.join(',')));
  const allowed = new Set([...ramps.skin, ...ramps.boot].map((c) => c.join(',')));
  for (const c of seen) assert.ok(allowed.has(c), `non-ramp colour leaked: ${c}`);
});
