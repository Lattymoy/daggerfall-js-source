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
import { readFileSync, readdirSync, statSync } from 'node:fs';

import {
  createBloodDecalPool, bloodRate, ladderRate, scaleRate, damagePercent, isOverkill,
  surfaceBasis, writeDecalQuad, clearDecalQuad, decalIndices,
  DECAL_FLOATS, DECAL_FLOATS_PER_VERTEX, RATE_LADDER, RATE_NEAR_LETHAL, RATE_MAX, OVERKILL_PERCENT, OVERKILL_BURST, OVERKILL_UNDER, SURFACE_LIFT,
  bloodHit, LETHAL_HIT, sprayCount, sprayRadius, sprayOffset, dropSize, SPRAY_SHARE, SPRAY_MAX, SPATTER_SCALE, SIZE_JITTER, SPRAY_WOBBLE, SPRAY_RADIUS_MIN, SPRAY_RADIUS_MAX,   // BLOOD1b
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

// ---- the mark, on the seam the splash already uses ------------------

import { createHitEffects } from '../src/scenes/hitEffects.js';
import { createBloodMarks, MARK_DROP } from '../src/combat/bloodMarks.js';
import { markSize, marksBlood, MARK_SIZE_MIN, MARK_SIZE_MAX, BLOODLESS_INDEX } from '../src/combat/bloodDecals.js';

/** A renderer stub that records what the mark asked of it. */
function rigHitEffects(over = {}) {
  const wrote = [];
  const drew = [];
  const renderer = {
    createDecalBatch: (capacity) => ({ capacity, id: 'batch' }),
    writeDecalSlot: (batch, slot, floats) => { wrote.push({ slot, floats: [...floats] }); return true; },
    drawDecals: (batch, tex) => { drew.push({ batch, tex }); },
    createBillboardBatch: () => ({}),
  };
  const o = {
    collider: () => ({ raycastHit: () => ({ dist: 1.5, normal: [0, 1, 0], key: 'floor' }) }),
    settings: { enabled: () => true, capacity: () => 4, density: () => 1 },
    texture: () => 'blood-tex',
    // BLOOD1b: THE CHANCE HELD STILL. The spray wobbles each drop's
    // angle and jitters each drop's size, both off this one seam; a
    // half means no wobble and no jitter, so a pin can name the size
    // the band asked for rather than a window around it.
    rng: () => 0.5,
    ...over,
  };
  // HARD1: the ring is its OWN binding, HANDED to the splash pool -
  // which is a hand-off and so must never own GL.
  const marks = createBloodMarks({ renderer: o.renderer ?? renderer, collider: o.collider, settings: o.settings, texture: o.texture, rng: o.rng });
  const fx = createHitEffects({
    renderer,
    getTexture: () => new Promise(() => {}),   // the splash half never warms here
    uploadRecordFrame: () => {},
    marks,
  });
  return { fx, marks, wrote, drew, renderer };
}

test('BLOOD1a: the mark rides the splash’s own call, finds its surface, and a bloodless foe stains nothing', () => {
  // a ring wide enough to hold a whole spray, so this pin reads what
  // the LADDER asked for rather than what the ring had room for; the
  // recycling pin below keeps the narrow one on purpose
  const wide = { enabled: () => true, capacity: () => 64, density: () => 1 };
  const { fx, marks, wrote } = rigHitEffects({ settings: wide });

  // the splash's eleven call sites across five files are the events
  // where blood happens - the mark comes off the same call rather than
  // a twelfth seam nobody would remember to feed
  fx.showBloodSplash(0, [10, 5, 10], null, { damage: 10, maxHealth: 40 });
  // BLOOD1b: ONE EVENT IS A SPRAY NOW. 25% of max health is the bottom
  // rung, and the bottom rung's share of the floor is four drops.
  assert.equal(marks.count(), sprayCount(30));
  assert.equal(wrote.length, sprayCount(30), 'a slot written for each, each at its own offset');

  // THE SURFACE IS FOUND, NOT ASSUMED. Blood spawns at chest height, so
  // the mark is where the ray DOWN landed - 1.5 below, plus the 2cm lift.
  // DROP ZERO IS THE BODY'S OWN SPOT, with no offset at all: a hit
  // stains where it happened whatever else the spray does, which is
  // what keeps BLOOD1a's single mark as the FLOOR of this.
  const d = marks._pool().decals()[0];
  assert.deepEqual(d.pos, [10, 5 - 1.5 + 0.02, 10]);
  // ...and the rate sized it: the pool at the band's own size
  assert.ok(Math.abs(d.size - markSize(30)) < 1e-9, 'a glancing blow leaves the small pool');
  // ...while everything around it is SPATTER, smaller and off-centre
  for (const sp of marks._pool().decals().slice(1)) {
    assert.ok(Math.abs(sp.size - markSize(30) * SPATTER_SCALE) < 1e-9, 'spatter is a share of the pool');
    assert.ok(Math.hypot(sp.pos[0] - 10, sp.pos[2] - 10) > 0, 'and it landed somewhere else');
    assert.ok(Math.hypot(sp.pos[0] - 10, sp.pos[2] - 10) <= sprayRadius(30) + 1e-9, 'inside the band’s reach');
  }

  // a near-lethal hit throws more of it, and further
  // 50 of 40 is 125% - PAST the hundred rung and short of the overkill
  // line, which is the 150 band. The first cut of this pin used 39 of
  // 40 and called it near-lethal; 97.5% is the SEVENTY rung. The ladder
  // is not intuition.
  const { fx: hard, marks: hardMarks } = rigHitEffects({ settings: wide });
  hard.showBloodSplash(0, [0, 5, 0], null, { damage: 50, maxHealth: 40 });
  const big = hardMarks._pool().decals()[0];
  assert.equal(hardMarks.count(), sprayCount(150));
  assert.ok(hardMarks.count() > marks.count(), 'more damage, more blood');
  assert.ok(big.size > d.size, 'and a bigger pool under it');
  assert.ok(Math.abs(big.size - markSize(150)) < 1e-9, `125% is the 150 band (got ${big.size})`);
  assert.ok(sprayRadius(150) > sprayRadius(30), 'and it carries further');

  // THE SURFACE'S OWN NORMAL, not world up. A dungeon is stairs and
  // ramps: blood on a slope lies ALONG the slope, and a mark that took
  // its basis from nowhere would stand on a floor and float through a
  // staircase. The stub above answers a level floor, which is why this
  // one tilts - the first cut of these pins used the level collider
  // for everything and could not tell the two apart.
  const tilt = [0, Math.SQRT1_2, Math.SQRT1_2];   // a 45-degree ramp
  const { fx: slope, marks: slopeMarks } = rigHitEffects({ collider: () => ({ raycastHit: () => ({ dist: 1, normal: tilt }) }) });
  slope.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  const on = slopeMarks._pool().decals()[0];
  // to a TOLERANCE, not exactly: the module re-normalises what it is
  // handed, and hypot of two Math.SQRT1_2 is 1.0000000000000002, so a
  // unit vector in comes back a bit different in the last place
  assert.ok(dot(on.normal, tilt) > 1 - 1e-12, 'the mark wears the surface it landed on');
  // ...the 2cm lift comes off the RAMP, not straight up
  assert.ok(Math.abs(on.pos[1] - (5 - 1 + Math.SQRT1_2 * 0.02)) < 1e-9, 'lifted along the ramp');
  assert.ok(Math.abs(on.pos[2] - Math.SQRT1_2 * 0.02) < 1e-9, 'which moves it in z too');
  // ...and its quad lies in the ramp's plane
  assert.ok(Math.abs(dot(on.right, tilt)) < 1e-9 && Math.abs(dot(on.up, tilt)) < 1e-9, 'the quad lies on the ramp');

  // A BLOODLESS FOE MARKS NOTHING - DFU's own bloodIndex says which
  // six, and enemyBasics.js has carried it since long before this arc
  assert.equal(BLOODLESS_INDEX, 2);
  assert.equal(marksBlood(2), false);
  const before = marks.count();
  fx.showBloodSplash(2, [1, 5, 1], null, { damage: 39, maxHealth: 40 });
  assert.equal(marks.count(), before, 'a skeleton bleeds nothing');
});

test('BLOOD1a: blood over open air leaves no mark, and a host that wires none of it draws what it always drew', () => {
  // NOTHING WITHIN REACH is no mark, not one hanging in space - a body
  // on a bridge with a chasm under it
  const { fx: over, marks: overMarks } = rigHitEffects({ collider: () => ({ raycastHit: () => ({ dist: Infinity, normal: null }) }) });
  over.showBloodSplash(0, [0, 50, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(overMarks.count(), 0);
  // ...and the reach is a body's height and a bit, because that is how
  // far the floor is from where blood spawns
  assert.equal(MARK_DROP, 3);
  const { fx: far, marks: farMarks } = rigHitEffects({ collider: () => ({ raycastHit: () => ({ dist: MARK_DROP + 0.01, normal: [0, 1, 0] }) }) });
  far.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(farMarks.count(), 0, 'past the reach is past it');

  // THE SWITCH, and every way a host can decline: off, no collider, a
  // renderer too old to know the pass
  for (const off of [
    { settings: { enabled: () => false, capacity: () => 4, density: () => 1 } },
    { collider: null },
    { renderer: { createBillboardBatch: () => ({}) } },   // a renderer too old to know the decal pass
  ]) {
    const { fx, marks: m } = rigHitEffects(off);
    assert.doesNotThrow(() => fx.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 }));
    assert.equal(m.count(), 0, 'no marks, no throw');
  }
  // ...and a host that passes NO decal deps at all is the old signature
  const bare = createHitEffects({ renderer: { createBillboardBatch: () => ({}) }, getTexture: () => new Promise(() => {}), uploadRecordFrame: () => {} });
  assert.doesNotThrow(() => bare.showBloodSplash(0, [0, 5, 0]));

});

test('BLOOD1a: the ring recycles under the mark, the draw needs a texture, and a mode change blanks the buffer', () => {
  const { fx, marks, wrote, drew } = rigHitEffects();
  // BLOOD1b: an event is a SPRAY, so a ring of four is spent by the
  // first blow and everything after it is recycling - which is what
  // the ring is for, and what "a count and not a lifetime" means once
  // the count is small enough to see.
  const per = sprayCount(30);
  for (let i = 0; i < 6; i++) fx.showBloodSplash(0, [i, 5, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(marks.count(), 4, 'the ring is four and stays four');
  assert.equal(wrote.length, 6 * per, 'a slot written for every drop of every spray');
  assert.deepEqual(wrote.map((w) => w.slot), Array.from({ length: 6 * per }, (_, k) => k % 4),
    'and the oldest slot is always the one rewritten');

  // the draw is one call, and it needs art: no texture, no pass
  assert.equal(marks.draw(), true);
  assert.deepEqual(drew.at(-1), { batch: { capacity: 4, id: 'batch' }, tex: 'blood-tex' });
  const { fx: noArt, marks: noArtMarks } = rigHitEffects({ texture: () => null });
  noArt.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(noArtMarks.draw(), false, 'no art, no draw - and no throw');

  // THE STREAMING WORLD MOVES THEM - and the BUFFER has to move with
  // the ring. A decal's four corners are baked into the vertex buffer,
  // so shifting the pool alone would leave every mark drawn 819.2 units
  // from where it now is: the pool would be right and the picture wrong.
  const beforeShift = wrote.length;
  assert.equal(marks.shiftOrigin([100, 7, -3]), 4);
  assert.equal(wrote.length - beforeShift, 4, 'every live slot rewritten, not just the ring moved');
  // ...with the MOVED corners in them
  const moved = marks._pool().decals()[0];
  assert.ok(Math.abs(wrote.at(-4).floats[0] - (moved.pos[0] - moved.size / 2 * 1)) < 1, 'the corners are the new ones');
  assert.ok(wrote.slice(-4).every((w) => w.floats.some((v) => v !== 0)), 'and none of them is a blank');

  // A MODE CHANGE blanks the buffer SLOT BY SLOT rather than freeing
  // it: the ring is the same ring next time, and rebuilding would cost
  // an allocation every time the player opens a door.
  const n = wrote.length;
  assert.equal(marks.clear(), 4);
  assert.equal(marks.count(), 0);
  assert.equal(wrote.length - n, 4, 'four blanks written, no batch rebuilt');
  assert.deepEqual(wrote.at(-1).floats, new Array(DECAL_FLOATS).fill(0));
  assert.equal(marks.draw(), false, 'and nothing draws after');
});

test('BLOOD1a: the mark’s size band is the port’s own choice, and it reads the ladder’s ends rather than copying them', () => {
  assert.equal(MARK_SIZE_MIN, 0.35);
  assert.equal(MARK_SIZE_MAX, 1.2);
  assert.ok(Math.abs(markSize(30) - MARK_SIZE_MIN) < 1e-9, 'the bottom rung is the smallest mark');
  assert.ok(Math.abs(markSize(200) - MARK_SIZE_MAX) < 1e-9, 'the top rung is the biggest');
  assert.ok(markSize(50) > markSize(30) && markSize(150) > markSize(70), 'and it rises with the rung');
  // clamped outside the ladder either way
  assert.equal(markSize(-100), MARK_SIZE_MIN);
  assert.equal(markSize(1e6), MARK_SIZE_MAX);
  // THE ENDS ARE READ, NOT COPIED: a second literal 30/200 here would
  // drift the day a rung moves.
  const src = readFileSync(new URL('../src/combat/bloodDecals.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function markSize('), src.indexOf('export const BLOODLESS_INDEX'));
  assert.match(fn, /const lo = ladderRate\(0\), hi = RATE_MAX;/);
  // comments stripped, for the reason the no-GL pin above strips them:
  // the law is that the CODE carries no second copy, and the line that
  // reads the ladder's ends is allowed to say which ends it means.
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b(30|200)\b/, 'no second copy of the ladder’s ends');
});

test('BLOOD1a: the collider is a GETTER, and the mark survives the world being swapped under it', () => {
  // Every host rebuilds its collider - a mode change swaps it, the
  // streaming world swaps it again on every pixel load - and this pool
  // outlives all of that. A captured reference would be marking a world
  // that no longer exists within one doorway.
  let live = { raycastHit: () => ({ dist: 1, normal: [0, 1, 0] }) };
  const { fx, marks } = rigHitEffects({ collider: () => live });
  fx.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(marks.count(), sprayCount(30));

  // the world is swapped: the NEW collider is the one asked
  live = { raycastHit: () => ({ dist: 2, normal: [0, 1, 0] }) };
  fx.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  assert.ok(Math.abs(marks._pool().decals().at(-1).pos[1] - (5 - 2 + 0.02)) < 1e-9, 'the live collider, not the one captured at mount');

  // ...and BETWEEN two worlds - a pixel unloaded, a mode half changed -
  // it marks nothing rather than throwing into a frame
  for (const gone of [null, undefined, {}]) {
    live = gone;
    const before = marks.count();
    assert.doesNotThrow(() => fx.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 }));
    assert.equal(marks.count(), before, 'no world, no mark');
  }
});

test('BLOOD1a: the mark wears the SPLASH’S SETTLED FRAME, so the port ships no blood art at all', () => {
  const src = readFileSync(new URL('../src/scenes/hitEffects.js', import.meta.url), 'utf8');
  // A splash plays out to the settled splat and then vanishes; that
  // last frame IS the stain. Recorded at the upload because nothing
  // else in the file can see `frameCount`.
  // Only the splash pool can see the frame count, so it TELLS the mark
  // pool rather than the mark pool guessing.
  assert.match(src, /if \(archive === BLOOD_ARCHIVE && record !== BLOODLESS_INDEX\) marks\?\.useArt\?\.\(archive, record, frameCount\);/);
  const mk = readFileSync(new URL('../src/combat/bloodMarks.js', import.meta.url), 'utf8');
  assert.match(mk, /_texKey = `\$\{archive\}_\$\{record\}#\$\{Math\.max\(0, frameCount - 1\)\}`;/);
  // ...and the default means no host spells a texture key, so the four
  // of them cannot spell it four ways
  assert.match(mk, /const markTexture = texture \?\? \(\(\) => \(_texKey \? renderer\?\.textures\?\.get\?\.\(_texKey\) \?\? null : null\)\);/);
  // the port ships NO blood picture: the only archive named is the
  // classic one the splash already reads out of the player's ARENA2
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/public\/art|\.png|BloodPool|Gibs|Corpseplosion/i.test(code), 'no art asset, ours or anybody else’s');
});

test('BLOOD1a by source: FOUR HOSTS, one spelling - the switch bag, the draw under the billboards, the shift on the call they already make', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

  // THE SWITCH IS ONE BAG. Four hosts spelling three deps three ways is
  // the FOUR HOSTS RULE's own hazard, so `bloodDecalDeps` is built once
  // and every host passes the same object.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    const h = read(host);
    assert.match(h, /import \{ bloodDecalDeps \} from '\.\.\/combat\/bloodSwitch\.js';/, `${host}: the one bag`);
    assert.match(h, /import \{ createBloodMarks \} from '\.\.\/combat\/bloodMarks\.js';/, `${host}: the ring's own home`);
    // HARD1: the ring is the HOST'S binding, not a property of the
    // splash pool - that pool is a hand-off and must own no GL.
    assert.match(h, /const \w*[bB]loodMarks = createBloodMarks\(\{ renderer, collider: \(\) => (collider|player\.collider), settings: bloodDecalDeps \}\)/,
      `${host}: its own binding, the one bag, and the collider by a GETTER`);
    assert.match(h, /marks: \w*[bB]loodMarks/, `${host}: handed to the splash pool`);
  }

  // THE MARKS GO DOWN BEFORE THE BILLBOARDS, so a body standing in its
  // own blood is over it and not under it.
  for (const [host, bb] of [
    ['src/scenes/world.js', 'renderer.drawBillboards(allBatches, camRight, UP_Y);'],
    ['src/scenes/exterior.js', 'renderer.drawBillboards(_visBatches, camRight, UP_Y);'],
    ['src/scenes/dungeonContext.js', 'renderer.drawBillboards([..._mobileBatches, ..._dropBatches, ..._spellBatches],'],
  ]) {
    const h = read(host);
    const d = h.indexOf('loodMarks.draw()');
    assert.ok(d > 0, `${host}: draws its marks`);
    assert.ok(d < h.indexOf(bb), `${host}: the marks go down BEFORE the billboards`);
  }
  // ...and the world-hosted dungeon draws the CONTEXT's ring on its own pass
  assert.match(read('src/scenes/worldModes.js'), /dungeonCtx\.bloodMarks\?\.draw\?\.\(\);/);

  // THE SHIFT RIDES offsetAll, which every host already calls. A second
  // line beside it is a line four hosts have to remember, and the one
  // that forgot would strand its blood 819.2 units behind - the exact
  // fault AUDIT 17e F23 wrote that block's comment about.
  const fx = read('src/scenes/hitEffects.js');
  const off = fx.slice(fx.indexOf('    offsetAll(offset) {'), fx.indexOf('\n    },', fx.indexOf('    offsetAll(offset) {')));
  assert.match(off, /marks\?\.shiftOrigin\?\.\(offset\);/, 'the marks ride the splash’s own shift');
  assert.match(read('src/scenes/world.js'), /hitEffects\.offsetAll\(r\.offset\);/, 'and the host calls it exactly as it did');

  // a room thrown away takes its blood, and its GL, with it
  assert.match(fx, /marks\?\.clear\?\.\(\);   \/\/ BLOOD1a: a room thrown away takes its blood with it/);
  // HARD1: ended by ITS OWN NAME in destroy(), never through the
  // hand-off pool - that is the double free the gate exists for.
  assert.match(read('src/scenes/dungeonContext.js'), /bloodMarks\.dispose\(\);   \/\/ BLOOD1a \(HARD1\)/);
  assert.doesNotMatch(read('src/scenes/dungeonContext.js'), /hitEffects\.dispose\(\)/, 'the hand-off pool is never ended by hand');
});

test('BLOOD1a: the feature row owns the key and the default, and online it is the player’s own', async () => {
  const { FEATURES } = await import('../src/systems/features.js');
  const { BLOOD_PREF, bloodMarksOn, bloodCapacity, bloodDensity, BLOOD_CAPACITY_DEFAULT, BLOOD_CAPACITY_MIN, BLOOD_CAPACITY_MAX } =
    await import('../src/combat/bloodSwitch.js');
  const row = FEATURES.find((f) => f.id === 'blood-marks');
  assert.ok(row, 'the row exists');
  assert.equal(row.control.key, BLOOD_PREF, 'RF4: the row owns the key the switch reads');
  assert.equal(row.control.initial, true, 'on by default - the splash always played, and the mark is what a player expects to still be there');
  // AN ENHANCED ROW, NOT A MOD ROW: no mod is vendored for this, so
  // there is no author's name to carry in the title the way every
  // `modFeature` row does.
  assert.deepEqual([...row.kinds], ['enhanced']);
  assert.ok(!/by /i.test(row.title), 'no author in the title - it is the port’s own');
  // ONLINE IT IS THE PLAYER'S: a mark is a local picture with no
  // gameplay in it, unlike the survival row the room has to agree on.
  assert.equal(row.control.online, 'player');

  // the defaults hold with nothing stored
  assert.equal(bloodMarksOn(), true);
  assert.equal(bloodCapacity(), BLOOD_CAPACITY_DEFAULT);
  assert.equal(bloodDensity(), 1);
  assert.ok(BLOOD_CAPACITY_MIN < BLOOD_CAPACITY_DEFAULT && BLOOD_CAPACITY_DEFAULT < BLOOD_CAPACITY_MAX);

  // THE CAPACITY IS CLAMPED, and that is not tidiness: the ring is
  // ALLOCATED to this number at boot and a vertex buffer is built
  // beside it, so a stored 5,000,000 is 180 MB of floats and a stored
  // zero is a pool that divides by its own size. Neither can be
  // reached from the panel; both can be reached from a hand-edited
  // store, which is where settings come from often enough.
  const { setPref } = await import('../src/systems/uiPrefs.js');
  const { BLOOD_CAPACITY_PREF, BLOOD_DENSITY_PREF } = await import('../src/combat/bloodSwitch.js');
  const restore = [];
  try {
    for (const [stored, want] of [[5e6, BLOOD_CAPACITY_MAX], [0, BLOOD_CAPACITY_MIN], [-40, BLOOD_CAPACITY_MIN], [1200.6, 1201], ['nonsense', BLOOD_CAPACITY_DEFAULT]]) {
      setPref(BLOOD_CAPACITY_PREF, stored); restore.push(BLOOD_CAPACITY_PREF);
      assert.equal(bloodCapacity(), want, `a stored ${stored} answers ${want}`);
    }
    // ...and the density is a FRACTION, clamped the same way
    for (const [stored, want] of [[2, 1], [-1, 0], [0.5, 0.5], ['x', 1]]) {
      setPref(BLOOD_DENSITY_PREF, stored); restore.push(BLOOD_DENSITY_PREF);
      assert.equal(bloodDensity(), want, `a stored ${stored} answers ${want}`);
    }
  } finally {
    for (const k of restore) setPref(k, undefined);
  }
});

// ---------------------------------------------------------------- BLOOD1b

test('BLOOD1b: EVERY splash site hands its blow over, so the rate ladder actually runs', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

  // BLOOD1a shipped the ladder and nothing drove it. `showBloodSplash`
  // took the blow as its fourth argument and NOT ONE of the eleven call
  // sites passed it, so every mark in a real game came out of
  // damagePercent(0, 0) - the bottom rung, the smallest spatter, for a
  // dagger's graze and for a blow that took three quarters of a giant.
  // The pins above drove the ladder on a table and the hosts never did.
  //
  // This is the pin that makes forgetting impossible: it reads every
  // call in `src/` and holds that each one carries a blow. A twelfth
  // site written next year fails here on the day it is written.
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(new URL(`../${p}`, import.meta.url)).isDirectory()) walk(p);
      else if (name.endsWith('.js')) files.push(p);
    }
  })('src');

  /** The argument list of a call, by balanced parens. */
  const argsAt = (s, i) => {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') { depth--; if (!depth) return s.slice(i + 1, j); }
    }
    return null;
  };

  const sites = [];
  for (const f of files) {
    if (f === 'src/scenes/hitEffects.js') continue;   // the definition, not a call
    // COMMENTS OUT FIRST, for the same reason the no-GL pin above
    // strips them: the law is about the CALLS, and this arc's own
    // prose has to be able to name the seam it is talking about.
    const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of s.matchAll(/showBloodSplash\??\.?\(/g)) {
      const args = argsAt(s, m.index + m[0].length - 1);
      assert.ok(args != null, `${f}: unbalanced showBloodSplash call`);
      sites.push([f, args]);
    }
  }
  // the count is pinned too: a site DELETED is as much a drift as one
  // added, and both should be read by a person rather than pass quietly
  assert.equal(sites.length, 11, `eleven splash sites across five files (found ${sites.length})`);
  for (const [f, args] of sites) {
    assert.ok(/bloodHit\(|LETHAL_HIT/.test(args),
      `${f}: a splash site that hands over no blow - the ladder would read it as a graze`);
  }

  // THE SHAPE IS SPELLED ONCE. Eleven sites each building their own
  // object literal is the FOUR HOSTS RULE's hazard with five more
  // hosts; `bloodHit` is the one home and takes the ENTITY, because
  // what a site has to hand is the body it just hurt, not a field of it.
  assert.deepEqual(bloodHit(12, { maxHealth: 40 }), { damage: 12, maxHealth: 40 });
  assert.deepEqual(bloodHit(undefined, undefined), { damage: 0, maxHealth: 0 }, 'nothing known is a graze, never a NaN');
  assert.deepEqual(bloodHit(NaN, { maxHealth: NaN }), { damage: 0, maxHealth: 0 });
  assert.ok(Object.isFrozen(bloodHit(1, { maxHealth: 2 })), 'and it is read, never edited downstream');

  // A CIVILIAN DIES TO ONE HIT whatever the weapon was
  // (WeaponManager.cs:504-508), and has no entity to measure against -
  // so the blow took ALL of them. That is the HUNDRED rung, not an
  // overkill: a murder is not a gibbing.
  assert.deepEqual(LETHAL_HIT, { damage: 1, maxHealth: 1 });
  assert.equal(damagePercent(LETHAL_HIT.damage, LETHAL_HIT.maxHealth), 100);
  assert.equal(ladderRate(100), 70);
  assert.equal(isOverkill(LETHAL_HIT.damage, LETHAL_HIT.maxHealth), false);
});

test('BLOOD1b: one blood event is a SPRAY, laid by area, and each drop finds its own surface', () => {
  // THE RATE IS A PARTICLE COUNT AND THIS PORT FLIES NO PARTICLES.
  // BLOOD1a said so and left the scatter here. The share of a spray
  // that reaches a surface is the port's OWN number: most of it goes
  // onto the body, into the air and onto walls out of the ray's reach.
  assert.equal(SPRAY_SHARE, 0.12);
  assert.deepEqual([30, 50, 70, 150, 200].map(sprayCount), [4, 6, 8, 18, 24]);
  // ONE IS THE FLOOR, always - BLOOD1a's single mark is the bottom of
  // this and not a case it replaced. A density turned right down still
  // stains where the blow landed.
  assert.equal(sprayCount(0), 1);
  assert.equal(sprayCount(-5), 1);
  assert.equal(sprayCount(1), 1);
  // ...and the CAP is a ceiling decided at the top of the file rather
  // than at the bottom of a frame: each drop costs a raycast. The top
  // rung lands just under it, which is the point - the cap shapes
  // nothing a real hit does and catches a rung that would.
  assert.equal(SPRAY_MAX, 24);
  assert.equal(sprayCount(1e6), SPRAY_MAX);
  assert.ok(sprayCount(RATE_MAX) <= SPRAY_MAX);

  // THE REACH GROWS WITH THE BLOW, off the ladder's own ends
  assert.ok(Math.abs(sprayRadius(ladderRate(0)) - SPRAY_RADIUS_MIN) < 1e-9);
  assert.ok(Math.abs(sprayRadius(RATE_MAX) - SPRAY_RADIUS_MAX) < 1e-9);
  assert.ok(sprayRadius(150) > sprayRadius(70) && sprayRadius(70) > sprayRadius(30));
  // ...and it reads the ends rather than keeping a second copy of them
  const src = readFileSync(new URL('../src/combat/bloodDecals.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function sprayRadius('), src.indexOf('export const SPRAY_WOBBLE'));
  assert.match(fn, /const lo = ladderRate\(0\), hi = RATE_MAX;/);
  assert.doesNotMatch(fn.replace(/\/\/.*$/gm, ''), /\b(30|200)\b/, 'no second copy of the ladder’s ends');

  // DROP ZERO IS THE BODY'S OWN SPOT. Whatever else a spray does, the
  // hit stains where it happened.
  assert.deepEqual(sprayOffset(0, 8, 2, () => 0.5), [0, 0]);
  assert.deepEqual(sprayOffset(-1, 8, 2, () => 0.5), [0, 0]);

  // THE REST ARE LAID BY AREA, NOT BY RADIUS. sqrt() on the share is
  // what keeps the middle from filling in: a linear radius piles the
  // drops where the pool already is. Held still (rng 0.5), drop k sits
  // at radius * sqrt((k + 0.5) / n) - which rises, and rises SLOWER
  // than k does.
  const n = 8, R = 2;
  const rs = Array.from({ length: n }, (_, k) => {
    const [x, z] = sprayOffset(k, n, R, () => 0.5);
    return Math.hypot(x, z);
  });
  for (let k = 1; k < n; k++) assert.ok(rs[k] > rs[k - 1], 'each drop lands further out than the last');
  assert.ok(rs.at(-1) <= R + 1e-9, 'and none of them past the reach');
  assert.ok(Math.abs(rs[1] - R * Math.sqrt(1.5 / n)) < 1e-9, 'by area: sqrt of the share');
  assert.ok(rs[4] - rs[3] < rs[1] - rs[0], 'so the outer rings crowd and the middle does not fill');

  // AN EVEN ANGULAR TURN, not a random angle: random angles clump, and
  // a clump of spatter reads as one badly drawn mark. The wobble is
  // what stops the even turn reading as a stencil.
  assert.equal(SPRAY_WOBBLE, 0.9);
  const ang = (k, r) => { const [x, z] = sprayOffset(k, n, R, r); return Math.atan2(z, x); };
  assert.ok(Math.abs(ang(2, () => 0.5) - ang(1, () => 0.5) - (Math.PI * 2) / n) < 1e-9, 'an even share of the circle');
  assert.ok(Math.abs(ang(1, () => 1) - ang(1, () => 0)) - SPRAY_WOBBLE < 1e-9, 'and the wobble is the whole of the wander');

  // A POOL AND ITS SPATTER, not one size repeated
  assert.equal(SPATTER_SCALE, 0.45);
  assert.equal(SIZE_JITTER, 0.3);
  assert.equal(dropSize(0, 150, () => 0.5), markSize(150));
  assert.equal(dropSize(3, 150, () => 0.5), markSize(150) * SPATTER_SCALE);
  // ...jittered either way, because a ring of identical marks reads as
  // a stencil rather than as blood
  assert.ok(Math.abs(dropSize(3, 150, () => 1) - markSize(150) * SPATTER_SCALE * (1 + SIZE_JITTER)) < 1e-12);
  assert.ok(Math.abs(dropSize(3, 150, () => 0) - markSize(150) * SPATTER_SCALE * (1 - SIZE_JITTER)) < 1e-12);
  assert.ok(dropSize(3, 150, () => 0) >= 0, 'and never negative, whatever the jitter');
});

test('BLOOD1b: a drop over open air falls past it while the pool under the body still lands', () => {
  // THE REACH IS JUDGED PER DROP. A foe fought on the edge of a
  // walkway throws spatter into the dark on one side and onto the
  // stone on the other; a spray that took one ray for the lot would
  // either hang the far drops in space or drop the near ones with them.
  const reach = [];
  const { fx, marks } = rigHitEffects({
    settings: { enabled: () => true, capacity: () => 64, density: () => 1 },
    // the floor stops at x = 0: everything thrown to the left is over
    // the edge (the stub answers a miss), everything to the right lands
    collider: () => ({
      raycastHit: (from) => { reach.push(from[0]); return from[0] >= 0 ? { dist: 1, normal: [0, 1, 0] } : { dist: Infinity, normal: null }; },
    }),
  });
  fx.showBloodSplash(0, [0, 5, 0], null, { damage: 50, maxHealth: 40 });   // 125%: the 150 band, eighteen drops
  assert.equal(reach.length, sprayCount(150), 'a ray for every drop the ladder asked for');
  const landed = marks._pool().decals();
  assert.ok(landed.length > 0 && landed.length < reach.length, 'some landed, some fell past the edge');
  assert.equal(landed.length, reach.filter((x) => x >= 0).length, 'exactly the ones over stone');
  for (const d of landed) assert.ok(d.pos[0] >= 0, 'and nothing hangs over the drop');
  // the POOL is drop zero and its ray went straight down from the body
  assert.equal(reach[0], 0);
});

test('BLOOD1b: the ring and the spray roll ONE set of dice', () => {
  // The ring spins every mark's own turn inside its surface, and the
  // spray picks where each drop lands and how big it is. Both are
  // chance, and a pool that let them come from two places would be one
  // a test could hold still only halfway - so `createBloodMarks` takes
  // the rng and hands it DOWN to the ring rather than letting the ring
  // reach for Math.random of its own.
  const { fx, marks } = rigHitEffects({ rng: () => 0.25 });
  fx.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  const d = marks._pool().decals()[0];
  const want = surfaceBasis([0, 1, 0], 0.25 * Math.PI * 2);
  assert.ok(Math.abs(dot(d.right, want.right) - 1) < 1e-12, 'the mark’s turn came from the rng handed in');
  assert.ok(Math.abs(dot(d.up, want.up) - 1) < 1e-12);
  // ...and a different roll is a different turn, so the pin above is
  // reading the dice and not a constant
  const { fx: other, marks: otherMarks } = rigHitEffects({ rng: () => 0.75 });
  other.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  assert.ok(dot(otherMarks._pool().decals()[0].right, d.right) < 0.99, 'a different roll turns it elsewhere');
});
