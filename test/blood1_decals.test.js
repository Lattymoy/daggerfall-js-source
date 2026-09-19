// BLOOD1a - THE DECAL POOL (2026-09-19, Mac: "this mod we do not have
// permission to integrate. So instead I really want to try and build
// our own version as close to 1:1 as possible" / "I really want you to
// read in how their module works so we can achieve our own type of
// parity").
//
// The port's own blood marks. The FEEL is measured off DaggerBlood
// 1.0.6a (Excoriated) and nothing else is: no code, no art, no vendor
// row (bible/05-Combat/Blood-Arc.md says so at length). These pins hold
// the FACTS that reading established - which are numbers and orderings,
// not anybody's expression - and the port's own maths around them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createBloodDecalPool, bloodRate, ladderRate, scaleRate, damagePercent, isOverkill,
  surfaceBasis, writeDecalQuad, clearDecalQuad, decalIndices,
  DECAL_FLOATS, DECAL_FLOATS_PER_VERTEX, RATE_LADDER, RATE_NEAR_LETHAL, RATE_MAX, OVERKILL_PERCENT, OVERKILL_BURST, OVERKILL_UNDER, SURFACE_LIFT,
} from '../src/combat/bloodDecals.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

test('BLOOD1a: the rate ladder is five rungs off damage over max health, and the density floor is one', () => {
  // the rungs themselves - three with a ceiling of their own, then the
  // near-lethal band, then the top. The top rung's boundary IS the
  // overkill line, which is why it is not a fourth row in the table:
  // one number, so the two cannot drift apart.
  assert.deepEqual(RATE_LADDER.map((r) => [r.upTo, r.rate]), [[25, 30], [50, 50], [100, 70]]);
  assert.equal(RATE_NEAR_LETHAL, 150);
  assert.equal(RATE_MAX, 200);

  // the boundaries are INCLUSIVE at the top of each rung
  assert.equal(ladderRate(0), 30);
  assert.equal(ladderRate(25), 30);
  assert.equal(ladderRate(25.01), 50);
  assert.equal(ladderRate(50), 50);
  assert.equal(ladderRate(50.01), 70);
  assert.equal(ladderRate(100), 70);
  assert.equal(ladderRate(100.01), 150);
  assert.equal(ladderRate(174.99), 150);
  // ...and 175 itself is the TOP rung, because that is where overkill starts
  assert.equal(ladderRate(175), 200);
  assert.equal(ladderRate(1000), 200);

  // the percent
  assert.equal(damagePercent(10, 40), 25);
  assert.equal(damagePercent(70, 40), 175);
  assert.equal(damagePercent(10, 0), 0, 'nothing to measure against is not an overkill');
  assert.equal(damagePercent(0, 40), 0);
  assert.equal(damagePercent(-5, 40), 0);

  // THE FLOOR. A player who turns the blood right down gets less of
  // it, never none of it - the whole reason this is max(1, ...).
  assert.equal(scaleRate(30, 1), 30);
  assert.equal(scaleRate(30, 0.5), 15);
  assert.equal(scaleRate(30, 0.1), 3);
  assert.equal(scaleRate(30, 0), 1, 'a hit always marks something');
  assert.equal(scaleRate(200, 0.1), 20);
  assert.equal(scaleRate(1, 0.1), 1);

  // and the whole ladder in one read
  assert.equal(bloodRate(10, 40), 30);
  assert.equal(bloodRate(70, 40), 200);
  assert.equal(bloodRate(70, 40, 0.5), 100);
});

test('BLOOD1a: overkill is 175%, NOT the 200 the reference’s own setting text claims', () => {
  assert.equal(OVERKILL_PERCENT, 175);
  assert.equal(isOverkill(69, 40), false, '172.5% is not one');
  assert.equal(isOverkill(70, 40), true, '175% exactly is');
  assert.equal(isOverkill(80, 40), true);
  assert.equal(isOverkill(10, 0), false);
  // the burst, in the order it goes off, with the ladder's spawn under it
  assert.deepEqual(OVERKILL_BURST.map((b) => [b.rate, b.min, b.max]), [[450, 5, 10], [350, 5, 10]]);
  assert.deepEqual([OVERKILL_UNDER.min, OVERKILL_UNDER.max], [1, 5]);
});

test('BLOOD1a: the surface basis spans the plane, and a FLOOR is the case it is written for', () => {
  // A floor's normal is world up, which is exactly where `up x normal`
  // collapses - the degenerate case is the common one here.
  for (const n of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [0, 0, 1], [0.6, 0.8, 0]]) {
    const b = surfaceBasis(n, 0);
    assert.ok(Math.abs(len(b.right) - 1) < 1e-9, `${n}: right is unit`);
    assert.ok(Math.abs(len(b.up) - 1) < 1e-9, `${n}: up is unit`);
    assert.ok(Math.abs(dot(b.right, b.up)) < 1e-9, `${n}: right and up are perpendicular`);
    assert.ok(Math.abs(dot(b.right, b.normal)) < 1e-9, `${n}: right lies IN the surface`);
    assert.ok(Math.abs(dot(b.up, b.normal)) < 1e-9, `${n}: up lies IN the surface`);
  }
  // the turn spins them inside the plane and nothing else
  const a = surfaceBasis([0, 1, 0], 0), q = surfaceBasis([0, 1, 0], Math.PI / 2);
  assert.ok(Math.abs(dot(a.right, q.right)) < 1e-9, 'a quarter turn puts right where up was');
  assert.ok(Math.abs(dot(q.right, q.normal)) < 1e-9, 'and it is still in the plane');
  // a normal that is not one is answered, not thrown at
  assert.deepEqual(surfaceBasis(null).normal, [0, 1, 0]);
  assert.deepEqual(surfaceBasis([0, 0, 0]).normal, [0, 1, 0]);

  // WHY THE SEED AXIS SWAPS NEAR HORIZONTAL, and it is not that the
  // maths breaks - `up x normal` collapsing to nothing falls to a
  // fallback that is still a valid basis. It is that just BESIDE the
  // collapse the cross product is ill-conditioned: two floors tilted a
  // thousandth of a unit either way are the same floor, and seeding
  // both from world up sends their `right` vectors in OPPOSITE
  // directions. A dungeon floor is never exactly level, so this is the
  // case, not the corner.
  const l = surfaceBasis([0.001, 1, 0], 0), r = surfaceBasis([-0.001, 1, 0], 0);
  assert.ok(dot(l.right, r.right) > 0.999,
    `two near-level floors must not disagree about which way is right (got ${dot(l.right, r.right).toFixed(3)})`);
  assert.ok(dot(l.up, r.up) > 0.999);
});

test('BLOOD1a: the pool is a COUNT and not a lifetime - the ring hands back the oldest slot, forever', () => {
  const pool = createBloodDecalPool({ capacity: 3, rng: () => 0 });
  assert.equal(pool.capacity, 3);
  assert.equal(pool.count, 0);

  const a = pool.place([0, 0, 0], [0, 1, 0]);
  const b = pool.place([1, 0, 0], [0, 1, 0]);
  const c = pool.place([2, 0, 0], [0, 1, 0]);
  assert.equal(pool.count, 3);
  assert.deepEqual(pool.decals().map((d) => d.serial), [0, 1, 2], 'oldest first');

  // the fourth takes the FIRST one's slot - nothing new is ever made
  const d = pool.place([3, 0, 0], [0, 1, 0]);
  assert.equal(pool.count, 3, 'the ring never grows');
  assert.equal(d.slot, a.slot, 'the oldest slot is the one reused');
  assert.deepEqual(pool.decals().map((d2) => d2.serial), [1, 2, 3]);
  assert.equal(pool.placed, 4, 'the serial counts every mark ever laid');

  // ...and it keeps doing it
  for (let i = 0; i < 100; i++) pool.place([i, 0, 0], [0, 1, 0]);
  assert.equal(pool.count, 3);
  assert.equal(pool.placed, 104);
  void b; void c;
});

test('BLOOD1a: a mark is lifted off its surface, and the streaming world moves it', () => {
  const pool = createBloodDecalPool({ capacity: 4, rng: () => 0 });
  // lifted ALONG THE NORMAL, not along world up - a wall's mark comes
  // off the wall (the same 2cm hitEffects.js nudges its splash by)
  assert.equal(SURFACE_LIFT, 0.02);
  const floor = pool.place([5, 0, 5], [0, 1, 0]);
  assert.deepEqual(floor.pos, [5, 0.02, 5]);
  const wall = pool.place([0, 1, 0], [1, 0, 0]);
  assert.deepEqual(wall.pos, [0.02, 1, 0]);

  // THE ORIGIN SHIFT. Everything already placed is in the old frame and
  // would jump a map pixel's width without this.
  // ALL THREE AXES. The streamer's compensation carries a height term
  // (state.compensation[1] is read all over world.js), and a delta with
  // a zero y would let a dropped y component pass unnoticed.
  assert.equal(pool.shiftOrigin([100, 7, -100]), 2, 'every live mark, and only the live ones');
  assert.deepEqual(floor.pos, [105, 7.02, -95]);
  assert.deepEqual(wall.pos, [100.02, 8, -100]);
  assert.equal(pool.shiftOrigin(null), 0);

  // a mode change throws the room away and the blood with it
  pool.clear();
  assert.equal(pool.count, 0);
  assert.deepEqual(pool.decals(), []);

  // a point that is not one places nothing rather than a NaN mark
  assert.equal(pool.place(null, [0, 1, 0]), null);
  assert.equal(pool.place([0, NaN, 0], [0, 1, 0]), null);
  assert.equal(pool.count, 0);
});

test('BLOOD1a: a mark can ride a moving body, and the module knows no renderer', () => {
  const pool = createBloodDecalPool({ capacity: 2, rng: () => 0.5 });
  const body = { pos: [0, 0, 0] };
  const d = pool.place([0, 1, 0], [0, 0, 1], { size: 2, tint: [1, 0, 0, 1], parent: body });
  assert.equal(d.parent, body, 'blood on a body travels with the body');
  assert.equal(d.size, 2);
  assert.deepEqual(d.tint, [1, 0, 0, 1]);

  // NO GL IN HERE. The split is camp.js/camps.js's: this answers where
  // a mark goes and what its four corners are, the host draws it -
  // which is what lets every law above be driven on a table.
  //
  // THE COMMENTS ARE STRIPPED FIRST, and that is not a loosening. The
  // law is that this module CALLS no GL, not that it never says the
  // word: the file's own header has to be able to explain what the
  // host does with what it answers, and the first cut of this pin
  // failed on the sentence "the renderer's pass is plumbing over it".
  // A pin that cannot tell code from prose reports the prose.
  const src = readFileSync(new URL('../src/combat/bloodDecals.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['renderer', 'drawScreenQuad', 'gl.', 'uploadTexture', 'import ', 'document', 'window.']) {
    assert.ok(!code.includes(forbidden), `bloodDecals.js must not reach for \`${forbidden}\``);
  }
  // ...and the stripper has to actually strip, or the check above is a
  // pin that cannot fail
  assert.ok(src.includes('renderer'), 'the header explains what the host does with this');
  assert.ok(code.length < src.length * 0.75, 'the comments really came out');
});

test('BLOOD1a: a decal is FOUR CORNERS around its own centre, and an empty slot is a zero-area quad', () => {
  const pool = createBloodDecalPool({ capacity: 3, rng: () => 0 });
  // a floor mark at the origin, one metre across, with turn 0 so the
  // basis is the deterministic one
  const d = pool.place([0, 0, 0], [0, 1, 0], { size: 2, turn: 0 });
  const out = new Float32Array(DECAL_FLOATS * 3);
  const next = writeDecalQuad(out, 0, d);
  assert.equal(next, DECAL_FLOATS, 'the writer chains');
  assert.equal(DECAL_FLOATS_PER_VERTEX, 9, 'pos3 + uv2 + rgba4');
  assert.equal(DECAL_FLOATS, 36);

  const vert = (i) => [...out.slice(i * 9, i * 9 + 9)];
  const pos = (i) => vert(i).slice(0, 3);
  const uv = (i) => vert(i).slice(3, 5);

  // SIZE IS THE FULL WIDTH, so a size-2 decal reaches one unit each
  // way - a caller passing a metre expects to cover a metre of floor.
  const h = 1;
  for (let i = 0; i < 4; i++) {
    const p = pos(i);
    // every corner is the centre plus +-h of right and +-h of up...
    const dx = [p[0] - d.pos[0], p[1] - d.pos[1], p[2] - d.pos[2]];
    assert.ok(Math.abs(Math.hypot(...dx) - Math.hypot(h, h)) < 1e-6, `corner ${i} is at the half-diagonal`);
    // ...and LIES IN THE SURFACE: the offset has no component along the normal
    assert.ok(Math.abs(dot(dx, d.normal)) < 1e-6, `corner ${i} lies in the plane of the surface`);
  }
  // the corners go BL, TL, TR, BR - the uv order says so, and the
  // index buffer below is wound to match
  assert.deepEqual([uv(0), uv(1), uv(2), uv(3)], [[0, 0], [0, 1], [1, 1], [1, 0]]);
  // ...and opposite corners are opposite: 0/2 and 1/3 straddle the centre
  for (const [a, b] of [[0, 2], [1, 3]]) {
    const mid = pos(a).map((v, i) => (v + pos(b)[i]) / 2);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(mid[i] - d.pos[i]) < 1e-6, `${a}/${b} straddle the centre`);
  }

  // the tint rides per vertex, so one call can draw decals of
  // different colours and fades
  const red = pool.place([0, 0, 0], [0, 1, 0], { size: 1, tint: [1, 0, 0, 0.5], turn: 0 });
  writeDecalQuad(out, DECAL_FLOATS, red);
  for (let i = 4; i < 8; i++) assert.deepEqual(vert(i).slice(5), [1, 0, 0, 0.5]);
  // ...and a decal with no tint of its own is white and opaque
  assert.deepEqual(vert(0).slice(5), [1, 1, 1, 1]);

  // AN EMPTY SLOT IS A DEGENERATE QUAD, not a gap. The ring is drawn
  // whole in one call, so a hole has to be something the rasteriser
  // throws away - skipping would cost either a draw call per run of
  // live decals or an index rebuild on every placement.
  clearDecalQuad(out, 0);
  assert.deepEqual([...out.slice(0, DECAL_FLOATS)], new Array(DECAL_FLOATS).fill(0));
  assert.deepEqual(vert(4).slice(5), [1, 0, 0, 0.5], 'and it clears its OWN slot only');

  // the index buffer winds both triangles off the corner order above
  const idx = decalIndices(2);
  assert.equal(idx.length, 12);
  assert.deepEqual([...idx.slice(0, 6)], [0, 2, 1, 0, 3, 2]);
  assert.deepEqual([...idx.slice(6)], [4, 6, 5, 4, 7, 6], 'the second quad is the first plus four');
});

test('BLOOD1a by source: the decal pass is ONE draw call, depth-tested and depth-UNWRITTEN, and it shares the module’s format', () => {
  const r = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');

  // THE FORMAT HAS ONE HOME. The winding and the stride come from
  // bloodDecals.js, so the writer that fills a slot and the buffer that
  // reads it cannot disagree about what 36 floats mean.
  assert.match(r, /import \{ decalIndices, DECAL_FLOATS_PER_VERTEX \} from '\.\.\/combat\/bloodDecals\.js';/);
  assert.match(r, /const DECAL_STRIDE = DECAL_FLOATS_PER_VERTEX \* 4;/);
  assert.match(r, /gl\.bufferData\(gl\.ELEMENT_ARRAY_BUFFER, decalIndices\(cap\), gl\.STATIC_DRAW\);/);

  const i = r.indexOf('  drawDecals(batch, tex) {');
  assert.ok(i > 0, 'the pass exists');
  const fn = r.slice(i, r.indexOf('\n  }\n', i));

  // ONE CALL for the whole ring - an empty slot is a zero-area quad, so
  // the draw never has to skip a hole and the index buffer is built
  // once at boot.
  assert.equal((fn.match(/gl\.draw(Elements|Arrays)/g) ?? []).length, 1, 'one draw call for the whole ring');
  assert.match(fn, /gl\.drawElements\(gl\.TRIANGLES, batch\.capacity \* 6, gl\.UNSIGNED_INT, 0\);/);

  // DEPTH TESTED, DEPTH NOT WRITTEN. The 2cm lift wins the test against
  // the surface; writing depth would make two overlapping marks fight
  // instead of layering, which is not what blood does.
  assert.match(fn, /gl\.depthMask\(false\);[\s\S]*gl\.drawElements[\s\S]*gl\.depthMask\(true\);/, 'depth write off ACROSS the draw, and restored');
  assert.doesNotMatch(fn, /gl\.disable\(gl\.DEPTH_TEST\)/, 'a decal is still occluded by the world in front of it');

  // ...and every state it changes, it puts back
  for (const [off, on] of [[/gl\.enable\(gl\.BLEND\)/, /gl\.disable\(gl\.BLEND\)/], [/gl\.disable\(gl\.CULL_FACE\)/, /gl\.enable\(gl\.CULL_FACE\)/]]) {
    assert.match(fn, off); assert.match(fn, on);
  }

  // a placement touches ONE slot, never the whole buffer
  assert.match(r, /gl\.bufferSubData\(gl\.ARRAY_BUFFER, slot \* 4 \* DECAL_STRIDE, floats\);/);
  // the program is built off the draw path, like every other one here
  assert.match(r, /_ensureDecalProgram\(\) \{/);
  assert.match(r, /createDecalBatch\(capacity\) \{\s*\n\s*const gl = this\.gl;[\s\S]{0,200}?this\._ensureDecalProgram\(\);/);
});
