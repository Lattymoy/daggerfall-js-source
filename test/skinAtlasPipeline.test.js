// The skin baker must never reconstruct the body as a cylinder again.
// The exact correspondence already exists in neutral.json: each rendered quad
// is the surface. These are structural pins on that ownership boundary.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bake = readFileSync(new URL('../tools/skin/bake_atlas.py', import.meta.url), 'utf8');
const head = readFileSync(new URL('../tools/skin/head_cell.py', import.meta.url), 'utf8');
const beast = readFileSync(new URL('../tools/skin/beast_skin.py', import.meta.url), 'utf8');
const ramps = readFileSync(new URL('../tools/skin/skin_ramps.py', import.meta.url), 'utf8');

test('body skin is baked on the actual quads, not an approximate cylinder', () => {
  assert.match(bake, /p = bilerp\(P\[0\], P\[1\], P\[2\], P\[3\], s, t\)/);
  assert.match(bake, /'mode': 'face-atlas'/);
  assert.match(bake, /one exact bilinear tile per rendered body quad/);

  // These were the old distortion vehicles: a synthetic 0.7-depth ellipse
  // and a group-wide angular unwrap. Neither belongs in the body baker.
  assert.doesNotMatch(bake, /pz\s*=\s*math\.sin\(th\)\s*\*\s*rh\s*\*\s*0\.7/);
  assert.doesNotMatch(bake, /th\s*=\s*\(ax\+0\.5\)\/cw\*2\*math\.pi/);
});

test('head append preserves the body baker UVs instead of rebuilding them', () => {
  assert.match(head, /old_uv = json\.load/);
  assert.match(head, /ax = float\(old_uv\['uv'\]\[off\]\) \* old_w/);
  assert.match(head, /body UVs preserved; head UVs baked/);

  // The old head pass reintroduced the body's cylinder approximation here.
  assert.doesNotMatch(head, /pz\s*\/\s*\(0\.7\s*\*\s*rh\)/);
  assert.doesNotMatch(head, /EXT\[\(g,\s*0\)\]/);
});

test('face-atlas post processing never crosses unrelated quad tiles', () => {
  assert.match(beast, /body\.get\('mode'\) == 'face-atlas'/);
  assert.match(beast, /for k in range\(count\)/);
  assert.match(beast, /sm = blur\(sub, 1\.25\)/);

  // Histogram matching uses useful texels, not duplicated tile gutters.
  assert.match(ramps, /if bc\.get\('mode'\) == 'face-atlas'/);
  assert.match(ramps, /\+ pad/);
  assert.match(ramps, /y0:y0 \+ tile, x0:x0 \+ tile/);
});
