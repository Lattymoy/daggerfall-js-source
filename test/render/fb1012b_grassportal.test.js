// FIELD BUGS 2026-10-12b GRASS-PORTAL - "Grass renders through portals" (a Portal Stone's violet vortex on a town's grass,
// a band of blades drawn across its middle). The vortex is a concealed billboard batch (portalFx.js, conceal mode 3):
// drawBillboards draws it in its blended phase, depth tested and never written, so the grass the frame drew after the
// street's billboards met the ground's depth at the vortex's pixels and painted every blade behind it over it. The street's
// blended flats are held back and drawn after the grass (RAIN-OVER-GRASS's fix for the rain, the same law).
// bible/01-Overview/bugs/Field-Bugs-2026-10-12b.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { billboardBlended, holdBlendedBillboards, Renderer } from '../../src/render/renderer.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('GRASS-PORTAL the blended phase\'s one test: a concealed batch or a spectral archive\'s, drawn - never a cast-only one, never a plain flat (mutants: the conceal unread; the spectral unread; a cast-only held)', () => {
  assert.equal(billboardBlended({ archive: 182, conceal: { mode: 3, alpha: 0, t: 0, phase: 0 } }), true, 'a portal\'s vortex');
  assert.equal(billboardBlended({ archive: 273 }), true, 'a ghost');
  assert.equal(billboardBlended({ archive: 182 }), false, 'a townsman');
  assert.equal(billboardBlended({ archive: 273, castOnly: true }), false, 'a body stands for it: it casts, it is not drawn');
  assert.equal(billboardBlended(null), false);
});

test('GRASS-PORTAL the street\'s blended flats are held back in place, the rest kept in their order, the held list emptied first (mutants: the list unfiltered; the order lost; a stale held list carried into the next frame)', () => {
  const a = { archive: 182 }, ghost = { archive: 273 }, b = { archive: 183 }, portal = { archive: 182, conceal: { mode: 3 } };
  const list = [a, ghost, b, portal];
  const out = [{ stale: true }];
  assert.equal(holdBlendedBillboards(list, out), out);
  assert.deepEqual(list, [a, b], 'the opaque flats, in order');
  assert.deepEqual(out, [ghost, portal], 'the blended ones, and nothing of the frame before');
});

test('GRASS-PORTAL the renderer holds them in its one list and draws them in a call of its own, emptied by the hold and the draw (mutants: the held list never let go; drawn in no call)', () => {
  const r = Object.create(Renderer.prototype);
  r._heldFlats = [];
  const drawn = [];
  r.drawBillboards = (bs) => { drawn.push([...bs]); };
  const portal = { archive: 182, conceal: { mode: 3 } }, man = { archive: 182 };
  const street = [man, portal];
  r.holdBlended(street);
  assert.deepEqual(street, [man]);
  r.drawHeld([1, 0, 0], [0, 1, 0]);
  assert.deepEqual(drawn, [[portal]], 'drawn once, alone');
  r.drawHeld([1, 0, 0], [0, 1, 0]);
  assert.equal(drawn.length, 1, 'let go: the next frame draws nothing of it');
  r.holdBlended([man]);
  r.drawHeld([1, 0, 0], [0, 1, 0]);
  assert.equal(drawn.length, 1, 'nothing held, no call');
});

test('GRASS-PORTAL the world host draws the held flats after the grass, the banners and the haze, before what falls; the renderer\'s blended phase asks the same test (mutants: the late draw before the grass; the hold dropped; a second law in the phase)', () => {
  const w = src('src/scenes/world.js');
  const at = (needle) => { const i = w.indexOf(needle); assert.ok(i >= 0, needle); assert.equal(w.indexOf(needle, i + 1), -1, `one ${needle}`); return i; };
  const hold = at('    renderer.holdBlended(livePersonBatches);');
  const street = at('    if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, bbUp);');
  const grass = at('    frameGrass();');
  const banners = at('    frameBanners();');
  const haze = at('    frameHaze();');
  const late = at('    renderer.drawHeld(camRight, bbUp);');
  const falling = at('    drawFalling();   // RAIN-OVER-GRASS');
  assert.ok(hold < street && street < grass && grass < banners && banners < haze && haze < late && late < falling, 'held, the street, the grass, the banners, the haze, the held flats, the rain');
  const r = src('src/render/renderer.js');
  assert.match(r, /if \(!billboardBlended\(b\)\) continue;   \/\/ MWNPC5b/);
});
