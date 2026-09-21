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
  DECAL_FLOATS, DECAL_FLOATS_PER_VERTEX, RATE_LADDER, RATE_NEAR_LETHAL, RATE_MAX, OVERKILL_PERCENT, OVERKILL_RATE, OVERKILL_RATE_HEAVY, OVERKILL_SPEED, ORDINARY_SPEED, OVERKILL_REACH_SCALE, HEAVY_WEAPON_TEMPLATE, SURFACE_LIFT,
  basisAlong, streakFor, STREAK_MAX,   // BLOOD2a
  bloodHit, LETHAL_HIT, SWING_PUSH, SWING_LEAN, swingThrow, looksUp, isCeilingNormal, CEILING_DOT, CEILING_EVERY, burstCount, burstRate, burstReach, BURST_DROPS_MAX, sprayCount, sprayRadius, sprayOffset, dropSize, SPRAY_SHARE, SPRAY_MAX, SPATTER_SCALE, SIZE_JITTER, SPRAY_WOBBLE, SPRAY_RADIUS_MIN, SPRAY_RADIUS_MAX,   // BLOOD1b
} from '../src/combat/bloodDecals.js';

import {
  throwGibs, gibStep, gibFly, gibLand, gibSprayOrigin, shiftGibs,
  GIB_COUNT, GIB_THROW_SIDE, GIB_THROW_UP, GIB_GRAVITY, GIB_GRAVITY_SCALE, UNITY_GRAVITY,
  GIB_DRAG, GIB_LIFE, GIB_SPLASH_RATE, GIB_SPLASH_SPEED, GIB_SPRAY_LIFT, DRIP_SPLASH_RATE, GIB_FIXED_DT,
} from '../src/combat/bloodGibs.js';
import { GRAVITY as PLAYER_GRAVITY } from '../src/player/motor.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** BLOOD1b: of a spray of `n`, how many look DOWN - which under an
 *  open sky is how many leave a mark at all. */
const onFloor = (n) => n - [...Array(n).keys()].filter(looksUp).length;
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
  // THE BURST, RE-READ FOR BLOOD1b - and the first reading was wrong
  // twice. It is an if/ELSE, not a sequence: 450 for a warhammer, 350
  // for everything else, never both.
  assert.equal(OVERKILL_RATE_HEAVY, 450);
  assert.equal(OVERKILL_RATE, 350);
  // ...and 5..10 against 1..5 are SPEEDS, not sizes. `SpawnBlood` sets
  // `main.startSpeed`; the decal sizes are fixed on the printer (0.05
  // default, 0.01..0.1 metres) and never vary with the blow at all.
  // So the burst buys REACH, and the ratio of the midpoints is the
  // whole of what it buys.
  assert.deepEqual([OVERKILL_SPEED.min, OVERKILL_SPEED.max], [5, 10]);
  assert.deepEqual([ORDINARY_SPEED.min, ORDINARY_SPEED.max], [1, 5]);
  assert.equal(OVERKILL_REACH_SCALE, 2.5);
  // ...and it is DERIVED from the two bands rather than typed again,
  // so a re-read that moves a band moves the scale with it
  const src = readFileSync(new URL('../src/combat/bloodDecals.js', import.meta.url), 'utf8');
  const decl = src.slice(src.indexOf('export const OVERKILL_REACH_SCALE'), src.indexOf('/** THE WEAPON THAT ALWAYS'));
  assert.doesNotMatch(decl.replace(/\/\/.*$/gm, ''), /\b2\.5\b/, 'the scale is read off the bands, not typed');

  // ITEM TEMPLATE 126 IS THE WARHAMMER, not the joke weapon the first
  // reading assumed from the `"horse"` short-name test beside it.
  assert.equal(HEAVY_WEAPON_TEMPLATE, 126);
});

test('BLOOD1b: the heavy-weapon number is the WARHAMMER’s, and the one copy of it is deliberate', async () => {
  // bloodDecals.js imports NOTHING - that is the law the no-GL pin
  // holds and the reason every rule in it can be driven on a table -
  // so it cannot reach `characters/weapons.js` for the name. The
  // number is therefore written twice, and THIS is what keeps the two
  // honest rather than an import that the module is not allowed.
  const { WEAPONS } = await import('../src/characters/weapons.js');
  assert.equal(HEAVY_WEAPON_TEMPLATE, WEAPONS.Warhammer,
    'the blood arc’s heavy weapon and the game’s warhammer are one number');
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

test('BLOOD1a: a mark carries its size and tint, rides NOTHING, and the module knows no renderer', () => {
  const pool = createBloodDecalPool({ capacity: 2, rng: () => 0.5 });
  const d = pool.place([0, 1, 0], [0, 0, 1], { size: 2, tint: [1, 0, 0, 1] });
  // BLOOD1 AUDIT 3: this pin was titled "a mark can ride a moving body"
  // and held a `parent` field that nothing read - the corners are baked
  // into the GPU slot at place and shiftOrigin moved a parented mark
  // too, so the capability never existed. The field is gone.
  assert.ok(!('parent' in d), 'no parent - a mark rides nothing');
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
  assert.equal(DECAL_FLOATS_PER_VERTEX, 10, 'pos3 + uv2 + rgba4 + wet1 (BLOOD2f)');
  assert.equal(DECAL_FLOATS, 40);

  const vert = (i) => [...out.slice(i * DECAL_FLOATS_PER_VERTEX, i * DECAL_FLOATS_PER_VERTEX + DECAL_FLOATS_PER_VERTEX)];   // BLOOD2f: ten a corner
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
  for (let i = 4; i < 8; i++) assert.deepEqual(vert(i).slice(5, 9), [1, 0, 0, 0.5]);   // BLOOD2f: the tenth float is the wet, held by its own pin
  // ...and a decal with no tint of its own is white and opaque
  assert.deepEqual(vert(0).slice(5, 9), [1, 1, 1, 1]);

  // AN EMPTY SLOT IS A DEGENERATE QUAD, not a gap. The ring is drawn
  // whole in one call, so a hole has to be something the rasteriser
  // throws away - skipping would cost either a draw call per run of
  // live decals or an index rebuild on every placement.
  clearDecalQuad(out, 0);
  assert.deepEqual([...out.slice(0, DECAL_FLOATS)], new Array(DECAL_FLOATS).fill(0));
  assert.deepEqual(vert(4).slice(5, 9), [1, 0, 0, 0.5], 'and it clears its OWN slot only');

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

  const i = r.indexOf('  drawDecals(batch, tex, ranges = null) {');
  assert.ok(i > 0, 'the pass exists');
  const fn = r.slice(i, r.indexOf('\n  }\n', i));

  // ONE CALL for the whole ring, or one per RANGE (BLOOD1 AUDIT 3: the
  // pool hands its touched slots in age order - one prefix unwrapped,
  // two ranges wrapped - so a ring of three marks draws three quads and
  // the oldest go down first). Never one per slot: an empty slot is a
  // zero-area quad, and the index buffer is built once at boot.
  assert.equal((fn.match(/gl\.draw(Elements|Arrays)/g) ?? []).length, 2, 'the ranged draw and the whole-ring fallback, nothing per slot');
  assert.match(fn, /gl\.drawElements\(gl\.TRIANGLES, \(hi - lo\) \* 6, gl\.UNSIGNED_INT, lo \* 6 \* 4\);/, 'a range: its quads’ indices, from its own byte offset');
  assert.match(fn, /gl\.drawElements\(gl\.TRIANGLES, batch\.capacity \* 6, gl\.UNSIGNED_INT, 0\);/, 'and the whole ring for a caller that hands no ranges');

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
  // the program is built off the draw path, like every other one here -
  // MAC-BUG W6: as the SET'S fifth program, the classic one at boot and
  // the lane's twin at install, never lazily on the first batch
  assert.match(r, /decal: this\._buildProgram\(DECAL_VS, src\.decalFs \?\? DECAL_FS\),/);
  assert.match(r, /decalFs: DECAL_FS \}\);/, 'the classic set names its own');
  assert.doesNotMatch(r, /_ensureDecalProgram/, 'no lazy build left');
  assert.match(r, /this\.decalProgram = set\.decal;/, 'the draw uses whichever set is installed');
});

// ---- the mark, on the seam the splash already uses ------------------

import { createHitEffects } from '../src/scenes/hitEffects.js';
import { createBloodMarks, MARK_DROP, MAX_BODIES, MAX_DRIPS, CEILING_REACH, GIB_QUAD, GIB_FRAME } from '../src/combat/bloodMarks.js';
import { markSize, marksBlood, MARK_SIZE_MIN, MARK_SIZE_MAX, BLOODLESS_INDEX } from '../src/combat/bloodDecals.js';

/** A renderer stub that records what the mark asked of it. */
function rigHitEffects(over = {}) {
  const wrote = [];
  const calls = [];
  const drew = [];
  const renderer = {
    createDecalBatch: (capacity) => ({ capacity, id: 'batch' }),
    // BLOOD AUDIT 4: an upload is a RUN of slots from the mirror, so the
    // stub records one entry a slot - the pins below count marks, and a
    // call count of its own (`calls`) holds the runs
    writeDecalSlot: (batch, slot, floats) => {
      calls.push({ slot, n: floats.length / DECAL_FLOATS });
      for (let k = 0; k * DECAL_FLOATS < floats.length; k++) wrote.push({ slot: slot + k, floats: [...floats.slice(k * DECAL_FLOATS, (k + 1) * DECAL_FLOATS)] });
      return true;
    },
    drawDecals: (batch, tex) => { drew.push({ batch, tex }); },
    createBillboardBatch: () => ({}),
  };
  const o = {
    // BLOOD1b: A FLOOR AND NO CEILING - an outdoor fight. One drop in
    // four looks UP now, and a stub that answered every direction
    // would put blood on a sky.
    // MAC-BUG W5: and this stub was the bug wearing the bug's own
    // name. It answers a floor for any downward ray and calls itself
    // "an outdoor fight" - which is the INDOOR collider, where a floor
    // is a mesh. The real one outside answers nothing to that ray.
    // Kept, because the ladder is what these arms are about; the pin
    // at the bottom of this file drives a REAL Collider instead.
    collider: () => ({ surfaceHit: (from, dir) => (dir[1] < 0 ? { dist: 1.5, normal: [0, 1, 0], key: 'floor' } : null) }),
    settings: { enabled: () => true, capacity: () => 4, density: () => 1, overkill: () => true },
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
    rng: o.rng,   // BLOOD2c: the bleeding ledger's waits roll the rig's one chance too
  });
  return { fx, marks, wrote, calls, drew, renderer };
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
  assert.equal(marks.count(), onFloor(sprayCount(30)));
  assert.equal(wrote.length, onFloor(sprayCount(30)), 'a slot written for each that landed, each at its own offset');

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
  assert.equal(hardMarks.count(), onFloor(sprayCount(150)));
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
  const { fx: slope, marks: slopeMarks } = rigHitEffects({ collider: () => ({ surfaceHit: () => ({ dist: 1, normal: tilt }) }) });
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
  const { fx: over, marks: overMarks } = rigHitEffects({ collider: () => ({ surfaceHit: () => ({ dist: Infinity, normal: null }) }) });
  over.showBloodSplash(0, [0, 50, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(overMarks.count(), 0);
  // ...and the reach is a body's height and a bit, because that is how
  // far the floor is from where blood spawns
  assert.equal(MARK_DROP, 3);
  const { fx: far, marks: farMarks } = rigHitEffects({ collider: () => ({ surfaceHit: () => ({ dist: MARK_DROP + 0.01, normal: [0, 1, 0] }) }) });
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
  const { fx, marks, wrote, calls, drew } = rigHitEffects();
  // BLOOD1b: an event is a SPRAY, so a ring of four is spent by the
  // first blow and everything after it is recycling - which is what
  // the ring is for, and what "a count and not a lifetime" means once
  // the count is small enough to see.
  const per = onFloor(sprayCount(30));
  for (let i = 0; i < 6; i++) {
    wrote.length = 0;
    fx.showBloodSplash(0, [i, 5, 0], null, { damage: 10, maxHealth: 40 });
    assert.equal(wrote.length, per, 'a slot written for every drop of every spray');
    // BLOOD AUDIT 4: an upload is a run in SLOT order, so the spray's
    // slots are compared as a set - the oldest slots, always
    assert.deepEqual(wrote.map((w) => w.slot).sort(), Array.from({ length: per }, (_, j) => (i * per + j) % 4).sort(),
      'and the oldest slot is always the one rewritten');
  }
  assert.equal(marks.count(), 4, 'the ring is four and stays four');

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
  // (BLOOD AUDIT 4: the four went up as ONE run in slot order, so the
  // slot is read by its number rather than by its place in the list)
  const moved = marks._pool().decals()[0];
  const movedWrite = wrote.slice(-4).find((w) => w.slot === moved.slot);
  assert.ok(Math.abs(movedWrite.floats[0] - (moved.pos[0] - moved.size / 2 * 1)) < 1, 'the corners are the new ones');
  assert.equal(calls.at(-1).n, 4, 'the whole ring, one upload');
  assert.ok(wrote.slice(-4).every((w) => w.floats.some((v) => v !== 0)), 'and none of them is a blank');

  // A MODE CHANGE keeps the ring - the same ring next time, and
  // rebuilding would cost an allocation every time the player opens a
  // door - and (BLOOD AUDIT 4) uploads NOTHING for it: the ring's
  // ranges are empty, so no slot is rasterised, and a slot reused later
  // is written before it is drawn. Blanking four slots a door was four
  // GL calls of dead work; at a full ring it was nine hundred.
  const n = wrote.length;
  assert.equal(marks.clear(), 4);
  assert.equal(marks.count(), 0);
  assert.equal(wrote.length - n, 0, 'no slot written, no batch rebuilt');
  assert.deepEqual(marks._pool().ranges(), []);
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
  let live = { surfaceHit: () => ({ dist: 1, normal: [0, 1, 0] }) };
  const { fx, marks } = rigHitEffects({ collider: () => live });
  fx.showBloodSplash(0, [0, 5, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(marks.count(), onFloor(sprayCount(30)));

  // the world is swapped: the NEW collider is the one asked
  live = { surfaceHit: () => ({ dist: 2, normal: [0, 1, 0] }) };
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

test('BLOOD1a/BLOOD2b: the mark wears the PORT’S OWN ART, made at boot - and the port still ships no blood picture', () => {
  const src = readFileSync(new URL('../src/scenes/hitEffects.js', import.meta.url), 'utf8');
  // BLOOD1a wore the splash's settled frame. BLOOD2b makes an atlas at
  // boot (bloodArt.js) - the mark takes NOTHING from the splash now but
  // the chunks' art, which is still the record's first frame, and only
  // the splash pool can see the record, so it still tells this one.
  assert.match(src, /if \(archive === BLOOD_ARCHIVE && record !== BLOODLESS_INDEX\) marks\?\.useArt\?\.\(archive, record, frameCount\);/);
  const mk = readFileSync(new URL('../src/combat/bloodMarks.js', import.meta.url), 'utf8');
  assert.match(mk, /function useArt\(archive, record\) \{/, 'the frame count is no longer the mark’s business');
  assert.match(mk, /_gibArt = \{ archive, record \};/, 'the chunks still take the splash’s record');
  assert.doesNotMatch(mk, /_texKey/, 'no splash frame key remains');
  // the atlas: uploaded ONCE through the renderer's own cache, by one
  // key every host spells the same, LINEAR so a splat's edge is soft
  assert.match(mk, /_atlasTex = renderer\.uploadTexture\(BLOOD_ATLAS_ARCHIVE, BLOOD_ATLAS_RECORD, atlas\(\), \{ smooth: true \}\) \?\? null;/);   // BLOOD AUDIT 4: built when first worn
  assert.match(mk, /const markTexture = texture \?\? \(\(\) => _atlasTex\);/);
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
  ]) {
    const h = read(host);
    // BLOOD1b gave it the camera basis, because the chunks over the
    // marks are billboards and a billboard needs one; every host
    // already holds both at this very line.
    const d = h.indexOf('loodMarks.draw(');
    assert.ok(d > 0, `${host}: draws its marks`);
    assert.match(h.slice(d, d + 80), /loodMarks\.draw\(\s*(camRight|new Float32Array\(\[-view)/, `${host}: on the basis the draw below uses`);
    assert.ok(d < h.indexOf(bb), `${host}: the marks go down BEFORE the billboards`);
  }
  // ...and the CONTEXT's ring is drawn by its HOSTS - the world-hosted
  // dungeon and the standalone one - once each, on their own pass,
  // beside the level's own flats and under them. BLOOD1 AUDIT 3: it was
  // also drawn inside drawFoes, behind that function's gate, so the
  // world-hosted dungeon drew it twice a frame and the standalone host
  // drew it only while a foe, a drop or a spell was alive.
  assert.equal((read('src/scenes/dungeonContext.js').match(/loodMarks\.draw\(/g) ?? []).length, 0, 'the context draws its own ring nowhere - the hosts own the pass');
  for (const [host, line, bb] of [
    ['src/scenes/worldModes.js', 'dungeonCtx.bloodMarks?.draw?.(camRight, UP_Y);', 'renderer.drawBillboards([...dungeonCtx.billboardBatches'],
    ['src/scenes/dungeon.js', 'ctx.bloodMarks?.draw?.(camRight, UP_Y);', 'renderer.drawBillboards([...ctx.billboardBatches'],
  ]) {
    const h = read(host);
    assert.equal(h.split(line).length - 1, 1, `${host}: draws the context’s ring exactly once`);
    const d = h.indexOf(line);
    assert.ok(d < h.indexOf(bb) && h.indexOf(bb) - d < 400, `${host}: beside and before the level’s flats`);
    // ...at the SAME depth as the flats' own draw beside it: not behind
    // a gate of its own (drawFoes' was `if (_mobileBatches.length || ...)`)
    const indentOf = (at) => h.slice(h.lastIndexOf('\n', at) + 1, at);
    assert.equal(indentOf(d), indentOf(h.indexOf(bb)), `${host}: at the flats’ own depth - unconditional, not behind a gate`);
    assert.ok(!/^\s*if \(/.test(h.slice(h.lastIndexOf('\n', d) + 1, d + line.length)), `${host}: no gate on the line`);
  }

  // BLOOD1 AUDIT (2026-09-20) - EVERY POOL BUILT IS A POOL DRAWN, and
  // this is the pin that was missing.
  //
  // The check above counts four draws and one of them is worldModes
  // drawing the DUNGEON'S pool. Nothing asked whether worldModes drew
  // its OWN - and it did not: `interiorBloodMarks` was built, fed,
  // ticked and cleared on the way out, and never once rendered. Every
  // mark laid in a shop, a tavern or a house went into a GPU buffer
  // that no pass ever read. Four hosts, four pools, three draws, and
  // a pin that counted to four on the wrong objects.
  //
  // So this one is by BINDING rather than by count: whatever
  // `createBloodMarks` is assigned to anywhere in `src/` has to be
  // drawn by that same name.
  const pools = [];
  const srcFiles = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const q = `${dir}/${name}`;
      if (statSync(new URL(`../${q}`, import.meta.url)).isDirectory()) walk(q);
      else if (name.endsWith('.js')) srcFiles.push(q);
    }
  })('src');
  for (const f of srcFiles) {
    for (const m of read(f).matchAll(/const (\w+) = createBloodMarks\(/g)) pools.push([f, m[1]]);
  }
  assert.equal(pools.length, 4, `four hosts build a pool (found ${pools.length})`);
  for (const [f, binding] of pools) {
    if (f === 'src/scenes/dungeonContext.js') continue;   // BLOOD1 AUDIT 3: the context's ring is its two hosts' to draw, held above
    const h = read(f);
    const at = h.search(new RegExp(`\\b${binding}\\.draw\\(`));
    assert.ok(at > 0, `${f}: builds \`${binding}\` and never draws it - the marks would be computed and never rendered`);
    // ...and UNDER the sprites, wherever it is: a body standing in its
    // own blood is over it, not under it. The interior host's own pass
    // is held to the same order as the three above.
    const firstSprite = h.indexOf('renderer.drawBillboards(', at > 0 ? 0 : 0);
    assert.ok(firstSprite < 0 || at < h.indexOf('renderer.drawBillboards(', at) || at < firstSprite
      || h.slice(0, at).lastIndexOf('renderer.drawBillboards(') < h.indexOf(`${binding}.draw(`),
      `${f}: the marks must go down before this host’s sprites`);
  }
  // the interior's is the one this audit added, so it is named outright
  {
    const wm = read('src/scenes/worldModes.js');
    const draw = wm.indexOf('interiorBloodMarks.draw(camRight, UP_Y);');
    const sprites = wm.indexOf("renderer.drawBillboards([...interiorCtx.billboardBatches");
    assert.ok(draw > 0 && sprites > 0 && draw < sprites,
      'the interior marks go down before the room’s own sprites');
  }

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

  // BLOOD2g: THE TWO NUMBERS ARE THE TIER'S. The capacity is CLAMPED,
  // and that is not tidiness: the ring is ALLOCATED to this number at
  // boot and a vertex buffer is built beside it, so a tier could never
  // ask for 180 MB of floats or a pool that divides by its own size -
  // and the old keys, which a hand-edited store could, are retired.
  const { setPref } = await import('../src/systems/uiPrefs.js');
  const sw = await import('../src/combat/bloodSwitch.js');
  const { BLOOD_GORE_PREF, GORE_TIERS, GORE_DEFAULT, bloodGore } = sw;
  assert.equal(sw.BLOOD_CAPACITY_PREF, undefined, 'the capacity key is retired'); assert.equal(sw.BLOOD_DENSITY_PREF, undefined, 'and the density key');
  const restore = [];
  try {
    for (const [tier, t] of Object.entries(GORE_TIERS)) {
      assert.ok(t.capacity >= BLOOD_CAPACITY_MIN && t.capacity <= BLOOD_CAPACITY_MAX && t.density > 0 && t.density <= 1, `${tier} inside the bounds`);
      setPref(BLOOD_GORE_PREF, tier); restore.push(BLOOD_GORE_PREF);
      assert.equal(bloodGore(), tier); assert.equal(bloodCapacity(), t.capacity, `${tier}: its count`); assert.equal(bloodDensity(), t.density, `${tier}: its amount`);
    }
    for (const stored of ['nonsense', 7, null, '', 'constructor', 'toString']) {
      setPref(BLOOD_GORE_PREF, stored);
      assert.equal(bloodGore(), GORE_DEFAULT, `a stored ${JSON.stringify(stored)} is Normal`);
      assert.equal(bloodCapacity(), BLOOD_CAPACITY_DEFAULT); assert.equal(bloodDensity(), 1);
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
  assert.deepEqual(bloodHit(12, { maxHealth: 40 }), { damage: 12, maxHealth: 40, fromPlayer: false, heavy: false, throw: [0, 0] });
  assert.deepEqual(bloodHit(undefined, undefined), { damage: 0, maxHealth: 0, fromPlayer: false, heavy: false, throw: [0, 0] }, 'nothing known is a graze, never a NaN');
  assert.deepEqual(bloodHit(NaN, { maxHealth: NaN }), { damage: 0, maxHealth: 0, fromPlayer: false, heavy: false, throw: [0, 0] });
  assert.ok(Object.isFrozen(bloodHit(1, { maxHealth: 2 })), 'and it is read, never edited downstream');

  // BLOOD1b: and the two things the overkill branch asks, both
  // decided at the SITE - a site that knows neither answers no to
  // both, which is the branch nearly every overkill takes anyway.
  assert.equal(bloodHit(1, null, { fromPlayer: true }).fromPlayer, true);
  assert.equal(bloodHit(1, null, { weapon: { templateIndex: HEAVY_WEAPON_TEMPLATE } }).heavy, true);
  assert.equal(bloodHit(1, null, { weapon: { templateIndex: 125 } }).heavy, false, 'a flail is not a warhammer');
  assert.equal(bloodHit(1, null, { weapon: null }).heavy, false, 'and a bare fist is not either');

  // A CIVILIAN DIES TO ONE HIT whatever the weapon was
  // (WeaponManager.cs:504-508), and has no entity to measure against -
  // so the blow took ALL of them. That is the HUNDRED rung, not an
  // overkill: a murder is not a gibbing.
  assert.deepEqual(LETHAL_HIT, { damage: 1, maxHealth: 1, fromPlayer: true, heavy: false, throw: [0, 0] });
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
      surfaceHit: (from, dir) => {
        if (dir[1] > 0) return null;                    // BLOOD1b: open sky over the walkway
        reach.push(from[0]);
        return from[0] >= 0 ? { dist: 1, normal: [0, 1, 0] } : { dist: Infinity, normal: null };
      },
    }),
  });
  fx.showBloodSplash(0, [0, 5, 0], null, { damage: 50, maxHealth: 40 });   // 125%: the 150 band, eighteen drops
  assert.equal(reach.length, onFloor(sprayCount(150)), 'a DOWNWARD ray for every drop that looked down');
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

test('BLOOD1b: a killing blow throws a SECOND spray over the first, wider and only for a player’s warhammer', () => {
  // THE BURST IS NEVER A REPLACEMENT. The assembly runs its ordinary
  // `SpawnBlood(pos, rate, 1, 5)` under BOTH overkill branches and
  // under NEITHER, so the ladder's own spray lands whatever happens
  // and the burst is an extra spawn on top of it.
  assert.equal(burstRate(true), OVERKILL_RATE_HEAVY);
  assert.equal(burstRate(false), OVERKILL_RATE);
  // ...and the two rates SURVIVE the count, which is why the burst has
  // a ceiling of its own: both come out past SPRAY_MAX, so the
  // ordinary cap would make a warhammer and a dagger leave one mess.
  assert.equal(BURST_DROPS_MAX, 48);
  assert.ok(burstCount(true) > burstCount(false), 'a warhammer throws more than everything else');
  assert.ok(sprayCount(OVERKILL_RATE_HEAVY) === sprayCount(OVERKILL_RATE),
    'which the ordinary cap could not tell apart - hence the burst’s own');
  assert.deepEqual([burstCount(true), burstCount(false)], [48, 42]);
  // the density slider scales it, with the same floor of one
  assert.equal(burstCount(true, 0), 1, 'turned right down is less blood, never none');
  assert.ok(burstCount(true, 0.5) < burstCount(true, 1));
  // THE SPEED IS THE REACH, and both branches fly at the same speed -
  // the 450/350 difference is how MUCH, not how far.
  assert.ok(Math.abs(burstReach(true) - sprayRadius(RATE_MAX) * OVERKILL_REACH_SCALE) < 1e-9);
  assert.equal(burstReach(true), burstReach(false));
  assert.ok(burstReach(false) > sprayRadius(RATE_MAX), 'and it carries further than any ordinary hit');

  // ---- and now on a live pool
  const wide = { enabled: () => true, capacity: () => 512, density: () => 1, overkill: () => true };
  const kill = { damage: 70, maxHealth: 40, fromPlayer: true, heavy: false };   // 175% exactly
  assert.equal(isOverkill(kill.damage, kill.maxHealth), true);

  const { fx, marks } = rigHitEffects({ settings: wide });
  fx.showBloodSplash(0, [0, 5, 0], null, kill);
  assert.equal(marks.count(), onFloor(burstCount(false)) + onFloor(sprayCount(RATE_MAX)), 'the burst AND the ladder’s own spray');

  // A PLAYER'S WARHAMMER TAKES THE HEAVY BRANCH, and nothing else does
  const { fx: hammer, marks: hammerMarks } = rigHitEffects({ settings: wide });
  hammer.showBloodSplash(0, [0, 5, 0], null, { ...kill, heavy: true });
  assert.equal(hammerMarks.count(), onFloor(burstCount(true)) + onFloor(sprayCount(RATE_MAX)));
  assert.ok(hammerMarks.count() > marks.count(), 'a warhammer leaves more of them');
  // ...a FOE swinging the same warhammer does not: the assembly asks
  // both questions and only the player's blow can answer the first
  const { fx: foe, marks: foeMarks } = rigHitEffects({ settings: wide });
  foe.showBloodSplash(0, [0, 5, 0], null, { ...kill, fromPlayer: false, heavy: true });
  assert.equal(foeMarks.count(), marks.count(), 'a foe’s warhammer throws the ordinary burst');

  // THE BURST GOES DOWN FIRST so the ordinary spray's pool lands ON
  // TOP of it - the assembly's own order, and the one that reads
  // right: the wide thin spatter, then the pool under the body.
  const all = hammerMarks._pool().decals();
  assert.equal(all.length, hammerMarks.count());
  const lastOfBurst = all[onFloor(burstCount(true)) - 1], firstOfSpray = all[onFloor(burstCount(true))];
  assert.ok(firstOfSpray.serial > lastOfBurst.serial, 'the ladder’s spray is laid after the burst');
  assert.deepEqual([firstOfSpray.pos[0], firstOfSpray.pos[2]], [0, 0], 'and its drop zero is the body’s own spot');
  // ...and the burst really did carry further than the ordinary spray
  const reachOf = (d) => Math.hypot(d.pos[0], d.pos[2]);
  assert.ok(Math.max(...all.slice(0, onFloor(burstCount(true))).map(reachOf)) > Math.max(...all.slice(onFloor(burstCount(true))).map(reachOf)),
    'the burst is the wider of the two');

  // UNDER THE LINE, NOTHING EXTRA. 172.5% is not an overkill.
  const { fx: under, marks: underMarks } = rigHitEffects({ settings: wide });
  under.showBloodSplash(0, [0, 5, 0], null, { damage: 69, maxHealth: 40, fromPlayer: true, heavy: true });
  assert.equal(underMarks.count(), onFloor(sprayCount(ladderRate(172.5))), 'the ladder’s spray alone');

  // AND THE ROW TURNS IT OFF, read LIVE - a player who turns it off
  // mid-fight gets the next blow plain.
  const off = { enabled: () => true, capacity: () => 512, density: () => 1, overkill: () => false };
  const { fx: plain, marks: plainMarks } = rigHitEffects({ settings: off });
  plain.showBloodSplash(0, [0, 5, 0], null, { ...kill, heavy: true });
  assert.equal(plainMarks.count(), onFloor(sprayCount(RATE_MAX)), 'off, a killing blow bleeds like any other hit');
  // ...and a host wiring no overkill dep at all is the same as off
  const none = { enabled: () => true, capacity: () => 512, density: () => 1 };
  const { fx: bare, marks: bareMarks } = rigHitEffects({ settings: none });
  bare.showBloodSplash(0, [0, 5, 0], null, { ...kill, heavy: true });
  assert.equal(bareMarks.count(), onFloor(sprayCount(RATE_MAX)));
});

test('BLOOD1b: a site that knows nothing about the swing says so, and gets the ordinary branch', () => {
  // The two overkill questions are the SITE'S to answer, and eleven
  // sites means a default that leans the wrong way is eleven silent
  // wrong answers. `fromPlayer` therefore defaults to NO: a fall, a
  // foe's blow, a peer's blow over the wire and anything written next
  // year all take the ordinary branch until someone says otherwise.
  assert.equal(bloodHit(1, null).fromPlayer, false);
  assert.equal(bloodHit(1, null, {}).fromPlayer, false);
  assert.equal(bloodHit(1, null, { fromPlayer: undefined }).fromPlayer, false, 'unknown is not yes');
  assert.equal(bloodHit(1, null, { fromPlayer: null }).fromPlayer, false);
  assert.equal(bloodHit(1, null, { fromPlayer: 0 }).fromPlayer, false);
  assert.equal(bloodHit(1, null, { fromPlayer: true }).fromPlayer, true, 'only a site that says yes gets yes');

  // ...and the seven sites that are NOT the player's own blow really
  // do leave it unsaid, rather than saying yes by copying a neighbour
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const argsAt = (s, i) => {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') { depth--; if (!depth) return s.slice(i + 1, j); }
    }
    return null;
  };
  let claimed = 0;
  for (const f of ['src/combat/arrowFlight.js', 'src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js',
    'src/scenes/exteriorFoes.js', 'src/scenes/hostCombat.js']) {
    const s = read(f);
    for (const m of s.matchAll(/showBloodSplash\??\.?\(/g)) {
      if (/fromPlayer: true/.test(argsAt(s, m.index + m[0].length - 1) ?? '')) claimed++;
    }
  }
  // the player's four: a melee swing in each of the three foe pools,
  // and the shaft that all three share
  assert.equal(claimed, 4, 'exactly the four sites that ARE the player’s own blow');
});

test('BLOOD1b: the gib law - ten chunks thrown UP, falling at three times gravity, landing for good', () => {
  // Read off the assembly, and the numbers are its own.
  assert.equal(GIB_COUNT, 10);
  assert.equal(GIB_THROW_SIDE, 15);
  assert.deepEqual([GIB_THROW_UP.min, GIB_THROW_UP.max], [5, 15]);
  assert.equal(GIB_GRAVITY_SCALE, 3);
  assert.equal(GIB_DRAG, 0.1);
  assert.equal(GIB_LIFE, 4);
  assert.equal(GIB_SPLASH_RATE, 20);
  assert.deepEqual([GIB_SPLASH_SPEED.min, GIB_SPLASH_SPEED.max], [2, 4]);

  // THE GRAVITY IS UNITY'S, NOT THE PORT'S. `player/motor.js` carries
  // GRAVITY = 20, DFU's own number for a walking body, which has
  // nothing to do with a thrown chunk: the arc was shaped by Unity's
  // physics and matching the feel means matching that number.
  assert.equal(UNITY_GRAVITY, 9.81);
  assert.equal(GIB_GRAVITY, 29.43);
  assert.notEqual(GIB_GRAVITY, PLAYER_GRAVITY * GIB_GRAVITY_SCALE, 'and it is NOT three times the port’s own');

  // ALWAYS THROWN UPWARD - the y band never reaches zero, which is
  // what makes a gibbing read as a burst rather than a pile.
  for (const r of [() => 0, () => 0.5, () => 1, () => 0.999]) {
    for (const g of throwGibs([1, 2, 3], r)) {
      assert.ok(g.vel[1] >= GIB_THROW_UP.min, 'no chunk starts out heading for the floor');
      assert.ok(g.vel[1] <= GIB_THROW_UP.max);
      assert.ok(Math.abs(g.vel[0]) <= GIB_THROW_SIDE && Math.abs(g.vel[2]) <= GIB_THROW_SIDE);
      assert.deepEqual(g.pos, [1, 2, 3], 'and every one starts at the body');
    }
  }
  assert.equal(throwGibs([0, 0, 0], () => 0.5).length, GIB_COUNT);
  assert.equal(throwGibs(null, () => 0.5).length, 0, 'nowhere to throw them from is none of them');

  // THE ARC. Gravity is added as an acceleration and the drag damps
  // the WHOLE velocity, both before the move.
  const g = throwGibs([0, 10, 0], () => 0.5)[0];   // straight up, no sideways
  assert.deepEqual([g.vel[0], g.vel[2]], [0, 0]);
  const up0 = g.vel[1];
  const step = gibStep(g, 0.5);
  // BLOOD1 AUDIT 3: at UNITY'S FIXED STEP, twenty-five of them in half a
  // second - the frame's dt is not the physics' dt, so the same throw
  // is the same arc at every frame rate (pinned on its own below).
  let v = up0, moved = 0;
  for (let k = 0; k < 25; k++) { v *= 1 - GIB_DRAG * GIB_FIXED_DT; v -= GIB_GRAVITY * GIB_FIXED_DT; moved += v * GIB_FIXED_DT; }
  assert.ok(Math.abs(g.vel[1] - v) < 1e-9, 'damped, then pulled down, at the fixed step');
  assert.ok(g.vel[1] < 0, 'half a second and a chunk is already falling - three gravities is heavy');
  // the step is a SEGMENT for the host to ray, and nothing is committed
  assert.deepEqual(step.from, [0, 10, 0], 'the step starts where the chunk still is');
  assert.ok(Math.abs(step.dist - Math.abs(moved)) < 1e-9, 'the whole half second’s travel, as one segment');
  assert.ok(Math.abs(Math.hypot(...step.dir) - 1) < 1e-12, 'a unit direction, for the ray');
  assert.deepEqual(g.pos, [0, 10, 0], 'and the chunk has NOT moved until the host says so');
  gibFly(g, step);
  assert.deepEqual(g.pos, step.to, 'nothing in the way, and it goes where it wanted');

  // SOMETHING IN THE WAY AND IT STOPS THERE FOR GOOD - no bounce,
  // which is the engine's answer and not a choice: nothing sets a
  // PhysicMaterial and Unity's default bounciness is zero.
  gibLand(g, [4, 0, 5]);
  assert.deepEqual(g.pos, [4, 0, 5]);
  assert.equal(g.still, true);
  assert.equal(gibStep(g, 1 / 60), null, 'a chunk that landed is done');

  // ...and so is one whose four seconds are up: the assembly destroys
  // the rigidbody AND the collider at 4, so it freezes where it lies
  // rather than falling for ever.
  //
  // THE LOOP IS BOUNDED, and that is not belt and braces. The first
  // cut of this pin spun `while (gibStep(...))` with no ceiling, so
  // the mutant that deletes the four-second cutoff did not FAIL the
  // pin - it hung the whole suite, and a mutation run that never
  // returns reports nothing at all. A pin whose failure mode is a
  // hang is not a pin.
  const forever = throwGibs([0, 1e6, 0], () => 0.5)[0];
  const cap = Math.ceil((GIB_LIFE * 4) * 60);
  let frames = 0;
  // BLOOD1 AUDIT 3: a null answer is "nothing to move THIS frame" (a
  // frame shorter than the fixed step banks its time); `still` is the stop.
  while (frames < cap && !forever.still) { gibStep(forever, 1 / 60); frames++; }
  assert.ok(frames < cap, 'a chunk that never stopped is the bug this pin exists for');
  assert.ok(forever.still, 'it stops');
  assert.ok(Math.abs(frames / 60 - GIB_LIFE) < 0.05, `and it stops at four seconds (got ${(frames / 60).toFixed(2)})`);

  // THE SPLAT IS SPRAYED FROM A HAND'S BREADTH UP, because the spray
  // finds its surface by raying DOWN and a ray that starts exactly on
  // the surface it is looking for is a coin toss in any collider.
  assert.equal(GIB_SPRAY_LIFT, 0.1);
  assert.deepEqual(gibSprayOrigin({ pos: [4, 0, 5] }), [4, GIB_SPRAY_LIFT, 5]);

  // THE STREAMING WORLD MOVES THEM TOO - a chunk mid-flight would
  // otherwise land its splat 819.2 units from where it now is.
  const flock = throwGibs([0, 0, 0], () => 0.5);
  assert.equal(shiftGibs(flock, [100, 7, -100]), GIB_COUNT);
  for (const c of flock) assert.deepEqual(c.pos, [100, 7, -100]);
  assert.equal(shiftGibs(null, [1, 1, 1]), 0);
});

test('BLOOD1b: a warhammer takes the body apart, and the chunks stain where they land', () => {
  // A FLOOR AT y = 0 and nothing else, so a chunk flies until it
  // falls through it.
  const floorRig = (over = {}) => rigHitEffects({
    settings: { enabled: () => true, capacity: () => 1024, density: () => 1, overkill: () => true },
    collider: () => ({
      surfaceHit: (from, dir, max) => {
        if (dir[1] >= 0) return null;                       // going up: nothing above
        const drop = from[1] / -dir[1];                     // where the ray meets y = 0
        return drop >= 0 && drop <= max ? { dist: drop, normal: [0, 1, 0] } : null;
      },
    }),
    // BLOOD1 AUDIT 3: VARIED throws. The rig's rng of one half threw
    // ten identical chunks that landed on one frame with one overshoot,
    // and two mutants - a landed chunk stepping on, a chunk landing at
    // its segment's end rather than the hit - lived in that coincidence.
    rng: (() => { let k = 0; return () => (k++ * 0.6180339887498949) % 1; })(),
    ...over,
  });
  const kill = { damage: 70, maxHealth: 40, fromPlayer: true, heavy: true };

  const { fx, marks } = floorRig();
  fx.showBloodSplash(0, [0, 2, 0], null, kill);
  assert.equal(marks.gibs().length, GIB_COUNT, 'ten chunks, thrown from the body');
  for (const g of marks.gibs()) assert.deepEqual(g.pos, [0, 2, 0]);
  const afterBlow = marks.count();

  // IT NEEDS NO DEATH SEAM: a blow for 175% of a body's whole health
  // is always lethal, so the hit IS the death and four hosts are
  // spared a wire they would each have had to remember.
  // THE CHUNKS RIDE `hitEffects.tick`, the call every host already
  // makes - so ticking the SPLASH pool flies them.
  const flown = marks.gibs().length;
  for (let i = 0; i < Math.ceil(GIB_LIFE * 60) && marks.gibs().some((g) => !g.still); i++) fx.tick(1 / 60);
  assert.ok(marks.gibs().length === 0 || marks.gibs().every((g) => g.still), 'they all come to rest');
  assert.equal(marks.gibs().length, 0, 'and once every chunk is still the list is dropped, and their quads with it');

  // ...AND EACH ONE STAINED WHERE IT LANDED, with what it was
  // carrying. Twenty is BELOW the rate ladder's bottom rung, so a
  // chunk's splat is smaller than any blow's - one piece landing is
  // not a body opening - and this counts the marks rather than just
  // asserting the constant, because the constant being right does not
  // make the tick read it.
  assert.ok(GIB_SPLASH_RATE < ladderRate(0));
  const perChunk = sprayCount(scaleRate(GIB_SPLASH_RATE, 1));
  assert.ok(perChunk < sprayCount(ladderRate(0)));
  assert.equal(marks.count() - afterBlow, flown * perChunk,
    `each of the ${flown} chunks left ${perChunk} marks and no more`);

  // NOT WITHOUT THE HAMMER. The ordinary overkill branch throws no
  // chunks at all - the assembly gibs only the death it marked, and
  // the player's warhammer is what marks one.
  const { fx: plain, marks: plainMarks } = floorRig();
  plain.showBloodSplash(0, [0, 2, 0], null, { ...kill, heavy: false });
  assert.equal(plainMarks.gibs().length, 0);
  const { fx: foe, marks: foeMarks } = floorRig();
  foe.showBloodSplash(0, [0, 2, 0], null, { ...kill, fromPlayer: false });
  assert.equal(foeMarks.gibs().length, 0, 'a foe’s warhammer takes nobody apart');

  // ...nor with the row off
  const { fx: off, marks: offMarks } = floorRig({ settings: { enabled: () => true, capacity: () => 1024, density: () => 1, overkill: () => false } });
  off.showBloodSplash(0, [0, 2, 0], null, kill);
  assert.equal(offMarks.gibs().length, 0);

  // THE COST IS CAPPED AT FOUR BODIES. Each chunk rays its own step
  // every frame, so what a gibbing costs per frame is decided here
  // and not by how fast a player can swing.
  assert.equal(MAX_BODIES, 4);
  const { fx: many, marks: manyMarks } = floorRig();
  for (let i = 0; i < 20; i++) many.showBloodSplash(0, [0, 2, 0], null, kill);
  assert.ok(manyMarks.gibs().length <= GIB_COUNT * MAX_BODIES, `at most four bodies in the air (got ${manyMarks.gibs().length})`);

  // A ROOM THROWN AWAY takes the chunks still in the air with it
  const { fx: door, marks: doorMarks } = floorRig();
  door.showBloodSplash(0, [0, 2, 0], null, kill);
  assert.equal(doorMarks.gibs().length, GIB_COUNT);
  door.clear();
  assert.equal(doorMarks.gibs().length, 0, 'the chunks leave with the room');

  // ...and the streaming world moves them: a chunk that stayed behind
  // would land its splat 819.2 units from where it now is
  const { fx: shift, marks: shiftMarks } = floorRig();
  shift.showBloodSplash(0, [0, 2, 0], null, kill);
  shift.offsetAll([100, 7, -100]);
  for (const g of shiftMarks.gibs()) assert.deepEqual(g.pos, [100, 9, -100]);

  // BETWEEN TWO WORLDS a chunk flies on rather than landing on
  // nothing - a pixel unloaded, a mode half changed
  const { fx: gone, marks: goneMarks } = floorRig({ collider: () => null });
  gone.showBloodSplash(0, [0, 2, 0], null, kill);
  assert.equal(goneMarks.gibs().length, 0, 'no world, no blow, no chunks');
});

test('BLOOD1b by source: the chunks ride the tick every host already makes', () => {
  const fx = readFileSync(new URL('../src/scenes/hitEffects.js', import.meta.url), 'utf8');
  // The same reading as the origin shift: every host that animates
  // its splashes already calls `tick` each frame, and a second call
  // beside it is a line four hosts have to remember - the one that
  // forgot would leave a gibbed body's chunks hanging in the air.
  const tick = fx.slice(fx.indexOf('    tick(dt) {'), fx.indexOf('\n    },', fx.indexOf('    tick(dt) {')));
  assert.match(tick, /marks\?\.tick\?\.\(dt\);/, 'the chunks fly on the splash pool’s own tick');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(readFileSync(new URL(`../${host}`, import.meta.url), 'utf8'), /hitEffects\??\.?\.tick\(dt\);/,
      `${host}: makes that call already`);
  }
  // NO RENDERER, NO GL, NO COLLIDER in the gib law either - same
  // split as bloodDecals.js, and what lets the arc above be driven on
  // a table.
  const src = readFileSync(new URL('../src/combat/bloodGibs.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['renderer', 'gl.', 'raycast', 'import ', 'document', 'window.']) {
    assert.ok(!code.includes(forbidden), `bloodGibs.js must not reach for \`${forbidden}\``);
  }
  assert.ok(src.includes('collider'), 'the header explains what the host does with a step');
  assert.ok(code.length < src.length * 0.75, 'the comments really came out');
});

test('BLOOD1b: a chunk in the air is a QUAD, written rather than rebuilt, and it wears the splash’s first frame', () => {
  // THE PORT SHIPS NO GORE ART AND WILL NOT. The reference's gib sheet
  // is art there is no permission to carry, so a chunk wears a frame
  // of TEXTURE.380 - the same archive the splash and the mark already
  // come from, and the one the player's own ARENA2 supplies.
  //
  // THE FIRST FRAME, not the last. The mark takes the settled stain
  // because that is what a stain looks like; a chunk in the air is the
  // burst, which is frame zero.
  assert.equal(GIB_FRAME, 0);
  assert.deepEqual(GIB_QUAD, { w: 0.28, h: 0.28 });

  const made = [], moved = [], killed = [], drewBb = [];
  const renderer = {
    createDecalBatch: (capacity) => ({ capacity, id: 'decals' }),
    writeDecalSlot: () => true,
    drawDecals: () => {},
    createBillboardBatch: (archive, record, size, centers, opts) => {
      const b = { archive, record, size, centers: centers.map((c) => [...c]), opts, frame: null, id: made.length };
      made.push(b); return b;
    },
    moveBillboardBatch: (batch, centers) => { moved.push({ batch, centers: centers.map((c) => [...c]) }); return true; },
    destroyBillboardBatch: (b) => { killed.push(b); },
    drawBillboards: (batches, right, up) => { drewBb.push({ batches, right, up }); },
  };
  const { fx, marks } = rigHitEffects({
    renderer,
    settings: { enabled: () => true, capacity: () => 512, density: () => 1, overkill: () => true },
    collider: () => ({
      surfaceHit: (from, dir, max) => {
        if (dir[1] >= 0) return null;
        const drop = from[1] / -dir[1];
        return drop >= 0 && drop <= max ? { dist: drop, normal: [0, 1, 0] } : null;
      },
    }),
  });
  // the splash pool is what can see the frame count, so it is what
  // tells this pool which record the chunks wear
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 2, 0], null, { damage: 70, maxHealth: 40, fromPlayer: true, heavy: true });

  assert.equal(made.length, 1, 'one batch for the flight, not one per chunk');
  const batch = made[0];
  assert.equal(batch.archive, 380);
  assert.equal(batch.record, 1);
  assert.equal(batch.frame, GIB_FRAME);
  assert.deepEqual(batch.size, GIB_QUAD);
  assert.equal(batch.centers.length, GIB_COUNT, 'a quad each');
  assert.equal(batch.opts?.dynamic, true, 'born DYNAMIC_DRAW - the hint is the buffer’s and cannot change after');

  // THE QUADS ARE WRITTEN, NOT REBUILT. Ten chunks at sixty frames is
  // 2,400 batch rebuilds for one death, each a VAO and two buffers.
  const madeBefore = made.length;
  fx.tick(1 / 60);
  assert.equal(moved.length, 1, 'one write a frame');
  assert.equal(made.length, madeBefore, 'and nothing rebuilt');
  assert.deepEqual(moved[0].centers, marks.gibs().map((g) => g.pos), 'the quads are where the chunks are');

  // THE CHUNKS DRAW OVER THE MARKS, on the basis the host hands in -
  // this pool has no camera, and every host holds one at the line it
  // calls from.
  const right = new Float32Array([1, 0, 0]), up = new Float32Array([0, 1, 0]);
  assert.equal(marks.draw(right, up), true);
  assert.equal(drewBb.at(-1).batches[0], batch);
  assert.equal(drewBb.at(-1).right, right);
  assert.equal(drewBb.at(-1).up, up);
  // ...and a host that hands in no basis draws the marks and no chunks
  const before = drewBb.length;
  marks.draw();
  assert.equal(drewBb.length, before, 'no basis, no billboard pass - and no throw');

  // WHEN THE LAST CHUNK COMES TO REST the batch goes with them: a
  // billboard quad has no per-vertex size, so there is no blanking a
  // spare one the way an empty decal slot is blanked.
  for (let i = 0; i < Math.ceil(GIB_LIFE * 60) && marks.gibs().length; i++) fx.tick(1 / 60);
  assert.equal(marks.gibs().length, 0);
  assert.ok(killed.includes(batch), 'the flight’s batch is ended by name');
  const drawsBefore = drewBb.length;
  marks.draw(right, up);
  assert.equal(drewBb.length, drawsBefore, 'and no billboard pass runs for a flight that is over');

  // HARD1: dispose ends everything this pool owns, the chunks' batch
  // among it - and it is idempotent
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 2, 0], null, { damage: 70, maxHealth: 40, fromPlayer: true, heavy: true });
  const live = made.at(-1);
  marks.dispose();
  assert.ok(killed.includes(live), 'a flight still in the air ends with the pool');
  assert.doesNotThrow(() => marks.dispose());
});

test('BLOOD1b by source: a moved batch moves its BOUNDS, and the corner table has one home', () => {
  const r = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  const fn = r.slice(r.indexOf('  moveBillboardBatch(batch, centers) {'), r.indexOf('\n  }', r.indexOf('  moveBillboardBatch(batch, centers) {')));
  // THE BOUNDS MOVE WITH THE QUADS. `_bbVisible` culls on the batch's
  // own sphere, so a batch whose quads moved and whose bounds did not
  // would be culled while it is on screen - and chunks fly far enough
  // to leave the sphere they were born in within a frame or two.
  assert.match(fn, /bounds\[0\] = cx; bounds\[1\] = cy; bounds\[2\] = cz;/, 'the sphere is rewritten');
  // BOTH TERMS. The extent of the centres AND the quad's own
  // half-diagonal - a radius that forgot the first would cull a
  // spread-out flight the moment its centre left the frustum.
  assert.match(fn, /bounds\[3\] = Math\.hypot\(hi0 - cx, hi1 - cy, hi2 - cz\) \+ Math\.hypot\(batch\.size\.w, batch\.size\.h\) \* 0\.5;/,
    'the centres’ extent plus the quad’s own half-diagonal, as the birth does');
  // BLOOD1 AUDIT: and IN PLACE. This runs every frame of every flight,
  // so the box is walked here rather than packed into a flat list for
  // `boundsOf` to unpack, and the sphere is written into the batch's
  // own array rather than a fresh one each time.
  assert.doesNotMatch(fn, /boundsOf\(/, 'the sphere is walked here, not packed and handed off');
  // ...and the array is REUSED, minted only when the batch has none:
  // this runs every frame of every flight.
  assert.match(fn, /const bounds = \(batch\.bounds && batch\.bounds\.length === 4\) \? batch\.bounds : \(batch\.bounds = new Float32Array\(4\)\);/,
    'minted once, on the first move only, and written in place after');
  // ...and it writes rather than reallocating
  assert.match(fn, /gl\.bufferSubData\(gl\.ARRAY_BUFFER, 0, verts, 0, count \* 20\);/);
  assert.doesNotMatch(fn, /createBuffer|createVertexArray|bufferData\(/, 'nothing is rebuilt on a move');
  // ...and it cannot write past the buffer it was given
  assert.match(fn, /Math\.min\(centers\.length, batch\._quads \?\? 0\)/, 'bounded by the quads the batch actually holds');

  // ONE CORNER TABLE. The birth bakes the corners and the move
  // rewrites them; the two disagreeing about the winding would tear
  // every moved quad.
  assert.match(r, /const BB_CORNERS = Object\.freeze\(\[/);
  const birth = r.slice(r.indexOf('  createBillboardBatch(archive'), r.indexOf('\n  }', r.indexOf('  createBillboardBatch(archive')));
  assert.match(birth, /const corners = BB_CORNERS;/, 'the birth reads the one table');
  assert.match(fn, /BB_CORNERS\[k\]\[0\]/, 'and so does the move');

  // THE DYNAMIC HINT IS THE BUFFER'S and cannot change after, so it is
  // taken at birth - and everything else in the tree stays STATIC.
  assert.match(birth, /dynamic \? gl\.DYNAMIC_DRAW : gl\.STATIC_DRAW/);
});

test('BLOOD1b: blood reaches the CEILING, and what a ceiling holds it eventually lets go of', () => {
  // A CEILING IS A SURFACE TEST, not a position one - the reference's
  // own `Dot(normal, Vector3.down) > 0.7`, which is about forty-five
  // degrees: a steep overhang counts and a wall does not.
  assert.equal(CEILING_DOT, 0.7);
  assert.equal(isCeilingNormal([0, -1, 0]), true, 'straight down is');
  assert.equal(isCeilingNormal([0, 1, 0]), false, 'a floor is not');
  assert.equal(isCeilingNormal([1, 0, 0]), false, 'a wall is not');
  assert.equal(isCeilingNormal([0.5, -Math.sqrt(0.75), 0]), true, 'thirty degrees off is');
  assert.equal(isCeilingNormal([0.8, -0.6, 0]), false, 'and past the cone is not');
  assert.equal(isCeilingNormal(null), false);
  assert.equal(isCeilingNormal([0, 0, 0]), false, 'and nothing is nothing');

  // ONE DROP IN FOUR LOOKS UP, by INDEX and not by chance, so a spray
  // always has some of both and a pin can say which.
  assert.equal(CEILING_EVERY, 4);
  assert.deepEqual([...Array(8).keys()].filter(looksUp), [3, 7]);
  // DROP ZERO NEVER DOES. It is the pool under the body, and a hit
  // that stained the ceiling instead of the floor where it happened
  // would be the one drop of this arc a player would call a bug.
  assert.equal(looksUp(0), false);

  // ---- a room with a ceiling two metres up
  const CEIL = 2;
  const rig = (over = {}) => rigHitEffects({
    settings: { enabled: () => true, capacity: () => 1024, density: () => 1, overkill: () => true },
    collider: () => ({
      surfaceHit: (from, dir, max) => {
        if (dir[1] > 0) return CEIL - from[1] <= max ? { dist: CEIL - from[1], normal: [0, -1, 0] } : null;
        return from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null;   // floor at y = 0
      },
    }),
    ...over,
  });

  const { fx, marks } = rig();
  fx.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
  const n = sprayCount(30);
  assert.equal(marks.count(), n, 'with a ceiling overhead, every drop of the spray lands somewhere');
  const up = marks._pool().decals().filter((d) => d.pos[1] > 1);
  assert.equal(up.length, n - onFloor(n), 'and the ones that looked up are on the ceiling');
  for (const d of up) {
    assert.ok(Math.abs(d.pos[1] - (CEIL - SURFACE_LIFT)) < 1e-9, 'lifted DOWN off the ceiling, along its own normal');
    assert.ok(dot(d.normal, [0, -1, 0]) > 1 - 1e-12, 'wearing the ceiling’s normal, not the floor’s');
  }

  // WHAT A CEILING HOLDS IT LETS GO OF. Each ceiling mark hangs a
  // drip, which falls exactly as a chunk does - a falling drop and a
  // falling piece fall the same way, and a second integrator would be
  // a second thing to get wrong.
  assert.equal(marks.drips().length, up.length, 'a drip for every ceiling mark');
  for (const d of marks.drips()) assert.deepEqual(d.vel, [0, 0, 0], 'a drip is a chunk with no throw at all');
  assert.equal(marks.gibs().length, 0, 'and a drip is not a chunk - no quad, its own list');

  // it falls, and stains the floor beneath a moment later
  const beforeFall = marks.count();
  for (let i = 0; i < Math.ceil(GIB_LIFE * 60) && marks.drips().length; i++) fx.tick(1 / 60);
  assert.equal(marks.drips().length, 0, 'they all come down');
  // A DRIP CARRIES A DROP: one mark each, against a chunk's twenty
  // particles' worth.
  assert.equal(DRIP_SPLASH_RATE, 1);
  assert.equal(sprayCount(DRIP_SPLASH_RATE), 1);
  assert.equal(marks.count() - beforeFall, up.length, 'one mark for each, and no more');

  // A DROP THAT WENT UP AND MET SOMETHING THAT IS NOT A CEILING leaves
  // nothing: blood does not stick to a wall it hit from below.
  const { fx: wall, marks: wallMarks } = rig({
    collider: () => ({
      surfaceHit: (from, dir, max) => (dir[1] > 0
        ? { dist: 1, normal: [1, 0, 0] }                    // the underside of a stair, near vertical
        : (from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null)),
    }),
  });
  wall.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(wallMarks.count(), onFloor(n), 'only the drops that looked down');
  assert.equal(wallMarks.drips().length, 0, 'and nothing to drip');

  // THE REACH UP IS LONGER THAN THE REACH DOWN, because blood spawns
  // at chest height: the floor is close and the ceiling is not.
  assert.equal(CEILING_REACH, 4);
  assert.ok(CEILING_REACH > MARK_DROP);
  const overhead = (h) => rig({
    collider: () => ({
      surfaceHit: (from, dir, max) => (dir[1] > 0
        ? (h <= max ? { dist: h, normal: [0, -1, 0] } : null)
        : (from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null)),
    }),
  });
  const { fx: tall, marks: tallMarks } = overhead(CEILING_REACH + 0.01);
  tall.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(tallMarks.count(), onFloor(n), 'a hall too high to stain stains nothing overhead');
  // ...and a ceiling BETWEEN the two reaches is stained, which is the
  // whole point of their being two numbers. The first cut of this pin
  // only drove a ceiling closer than MARK_DROP and one past
  // CEILING_REACH, so a mutant that gave the up-ray the DOWN-ray's
  // reach survived: both cases answered the same either way.
  const { fx: mid, marks: midMarks } = overhead((MARK_DROP + CEILING_REACH) / 2);
  mid.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(midMarks.count(), n, 'a ceiling past the floor’s reach but inside its own is still stained');
  assert.ok(midMarks.drips().length > 0, 'and it drips');

  // A ROOM THROWN AWAY takes the blood its ceilings had not finished
  // with, and the streaming world moves a drip still falling
  const { fx: door, marks: doorMarks } = rig();
  door.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
  assert.ok(doorMarks.drips().length > 0);
  const at = doorMarks.drips()[0].pos.slice();
  door.offsetAll([100, 7, -100]);
  assert.deepEqual(doorMarks.drips()[0].pos, [at[0] + 100, at[1] + 7, at[2] - 100]);
  door.clear();
  assert.equal(doorMarks.drips().length, 0);

  // ...and the count of them in the air is capped, like the chunks'
  assert.equal(MAX_DRIPS, 64);
  const { fx: many, marks: manyMarks } = rig();
  for (let i = 0; i < 60; i++) many.showBloodSplash(0, [0, 1, 0], null, { damage: 70, maxHealth: 40, fromPlayer: true, heavy: true });
  assert.ok(manyMarks.drips().length <= MAX_DRIPS, `at most ${MAX_DRIPS} falling (got ${manyMarks.drips().length})`);
});

test('BLOOD1b: the SWING throws the spray, and the pool under the body does not move', async () => {
  // The IL switches on `state - 1` with six arms; against the port's
  // own enum (fpsWeapon.js STATE_INDEX, which is DFU's order) they are
  // these. The table is the MIDPOINT of each band, in the player's own
  // frame: x their right, y up, z their forward.
  assert.deepEqual(SWING_PUSH.StrikeDown, [0, 3, 0], 'a straight chop sprays it back UP');
  assert.deepEqual(SWING_PUSH.StrikeDownLeft, [-7.5, -7.5, 0]);
  assert.deepEqual(SWING_PUSH.StrikeLeft, [-7.5, 0, 0]);
  assert.deepEqual(SWING_PUSH.StrikeRight, [7.5, 0, 0]);
  assert.deepEqual(SWING_PUSH.StrikeDownRight, [7.5, -7.5, 0]);
  assert.deepEqual(SWING_PUSH.StrikeUp, [0, 0, -5], 'an upward cut throws it back at you');
  assert.equal(SWING_PUSH.Idle, undefined, 'and standing still throws nothing');

  // ...and the table's keys are the GAME'S state names, not a second
  // spelling of them - the site hands `machine.state` straight in.
  const { STATE_INDEX } = await import('../src/combat/fpsWeapon.js');
  for (const k of Object.keys(SWING_PUSH)) {
    assert.ok(k in STATE_INDEX, `${k} is a weapon state the machine can actually be in`);
  }

  // THE HANDEDNESS IS THE TREE'S. Forward is (sin yaw, ., cos yaw) and
  // right is (cos yaw, 0, -sin yaw), which is (f.z, 0, -f.x).
  const north = [0, 0, 1];                       // yaw 0
  assert.deepEqual(swingThrow('StrikeRight', north), [SWING_PUSH.StrikeRight[0] * SWING_LEAN, 0], 'facing +z, right is +x');
  assert.deepEqual(swingThrow('StrikeLeft', north), [SWING_PUSH.StrikeLeft[0] * SWING_LEAN, 0]);
  const east = [1, 0, 0];                        // yaw 90
  const [ex, ez] = swingThrow('StrikeRight', east);
  assert.ok(Math.abs(ex) < 1e-12 && Math.abs(ez + 0.6) < 1e-12, 'facing +x, right is -z');
  // ...and an upward cut throws it BACKWARD along the look
  const [ux, uz] = swingThrow('StrikeUp', north);
  assert.ok(Math.abs(ux) < 1e-12 && uz < 0, 'toward the player, not away');

  // THE VERTICAL TERM IS DROPPED, and StrikeDown is the case that
  // shows why it is still right: its whole push is upward, so the
  // spatter is thrown NOWHERE - a straight chop sprays straight up and
  // it comes straight back down. A mark lies on a surface; an up or
  // down push changes how LONG blood is in the air, not where on the
  // floor it lands.
  assert.deepEqual(swingThrow('StrikeDown', north), [0, 0]);
  // ...nothing to throw it, nothing to throw it with, and nothing to
  // throw it along, all answer the same
  assert.deepEqual(swingThrow('Idle', north), [0, 0]);
  assert.deepEqual(swingThrow(null, north), [0, 0]);
  assert.deepEqual(swingThrow('StrikeRight', null), [0, 0]);
  assert.deepEqual(swingThrow('StrikeRight', [0, 1, 0]), [0, 0], 'a look straight up has no flat part');

  assert.equal(SWING_LEAN, 0.08);
  assert.ok(Math.abs(Math.hypot(...swingThrow('StrikeRight', north)) - 0.6) < 1e-12,
    'a full side swipe leans the spatter about two thirds of a metre');

  // ---- and on a live pool
  const wide = { enabled: () => true, capacity: () => 512, density: () => 1, overkill: () => true };
  const swung = (state) => {
    const { fx, marks } = rigHitEffects({ settings: wide });
    fx.showBloodSplash(0, [0, 5, 0], null, bloodHit(10, { maxHealth: 40 }, { swing: state, forward: north }));
    return marks._pool().decals();
  };
  const mid = (ds) => ds.slice(1).reduce((a, d) => a + d.pos[0], 0) / Math.max(1, ds.length - 1);

  const right = swung('StrikeRight'), left = swung('StrikeLeft'), still = swung('Idle');
  assert.ok(mid(right) > mid(still), 'a right swipe throws the spatter right');
  assert.ok(mid(left) < mid(still), 'and a left swipe throws it left');
  assert.ok(Math.abs(mid(right) - mid(still) - SWING_PUSH.StrikeRight[0] * SWING_LEAN) < 1e-9,
    'by exactly what the push says, since the ring is the same ring either way');

  // THE POOL DOES NOT LEAN. Drop zero is blood running off the body,
  // not blood thrown from it, so it stays at the body's own spot
  // whatever the swing did - which is what keeps "a hit stains where
  // it happened" true.
  for (const ds of [right, left, still]) assert.deepEqual([ds[0].pos[0], ds[0].pos[2]], [0, 0]);
});

test('BLOOD1b by source: the three melee sites hand the swing over, and the shaft deliberately does not', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // A SWING IS THE PLAYER'S MELEE AND NOTHING ELSE. The three foe
  // pools each resolve one and each holds both halves at the line -
  // the machine's live state and the look it was thrown along.
  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(read(host), /swing: playerWeapon\.machine\?\.state, forward: lookDir/,
      `${host}: the live state and the look it was thrown along`);
  }
  // THE SHAFT DOES NOT. The reference reads the LIVE weapon state when
  // blood spawns, which for an arrow that has been in the air is
  // whatever the player's arm happens to be doing now - a quirk of
  // reading a global at spawn time, not a thing to carry.
  assert.doesNotMatch(read('src/combat/arrowFlight.js'), /swing:/, 'a shaft’s blood is thrown by the shaft');
  // ...and neither does anything that is not the player's blow: a
  // fall, a foe's swing, a peer's blow over the wire.
  const argsAt = (s, i) => {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') { depth--; if (!depth) return s.slice(i + 1, j); }
    }
    return null;
  };
  let swung = 0;
  for (const f of ['src/combat/arrowFlight.js', 'src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js',
    'src/scenes/exteriorFoes.js', 'src/scenes/hostCombat.js']) {
    const s = read(f);
    for (const m of s.matchAll(/showBloodSplash\??\.?\(/g)) {
      if (/swing:/.test(argsAt(s, m.index + m[0].length - 1) ?? '')) swung++;
    }
  }
  assert.equal(swung, 3, 'exactly the three sites that ARE a player’s melee swing');
});

test('BLOOD1 AUDIT: dispose is TERMINAL, the art may arrive after the throw, and an empty list is not a full one', () => {
  const made = [], killed = [];
  const renderer = {
    createDecalBatch: (capacity) => ({ capacity, id: `decals${made.length}` }),
    writeDecalSlot: () => true,
    drawDecals: () => {},
    createBillboardBatch: (archive, record, size, centers, opts) => {
      const b = { archive, record, size, centers, opts, frame: null, id: made.length };
      made.push(b); return b;
    },
    moveBillboardBatch: () => true,
    destroyBillboardBatch: (b) => { killed.push(b); },
    drawBillboards: () => {},
  };
  const floor = () => ({
    surfaceHit: (from, dir, max) => (dir[1] < 0 && from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null),
  });
  const rig = () => rigHitEffects({
    renderer,
    settings: { enabled: () => true, capacity: () => 256, density: () => 1, overkill: () => true },
    collider: floor,
  });
  const kill = { damage: 70, maxHealth: 40, fromPlayer: true, heavy: true };

  // ---- DISPOSE IS TERMINAL.
  // Without this, a `place` or a `tick` arriving after teardown - a
  // peer's blow landing over the wire as the room goes, a splash whose
  // art resolved late - would run `ensure()` and mint a FRESH ring and
  // a FRESH GPU batch on a pool nobody will ever free again. That is
  // the HARD1 fault from the other end: not a thing freed twice, but a
  // thing BUILT after its owner had gone.
  {
    const { fx, marks } = rig();
    marks.useArt(380, 1, 6);
    fx.showBloodSplash(0, [0, 2, 0], null, kill);
    assert.ok(marks.count() > 0);
    const decalsBefore = made.length;
    marks.dispose();
    assert.equal(marks.count(), 0);
    // everything after is a no-op, and NOTHING is built
    assert.doesNotThrow(() => fx.showBloodSplash(0, [0, 2, 0], null, kill));
    assert.doesNotThrow(() => fx.tick(1 / 60));
    assert.doesNotThrow(() => marks.draw(new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])));
    assert.equal(marks.count(), 0, 'no ring is minted on a disposed pool');
    assert.equal(marks.gibs().length, 0, 'and no chunks are thrown');
    assert.equal(made.length, decalsBefore, 'and no GPU batch is built that nothing would free');
    assert.doesNotThrow(() => marks.dispose(), 'and it stays idempotent');
  }

  // ---- THE ART CAN ARRIVE AFTER THE THROW.
  // `_gibArt` is set when a splash's texture resolves, and on the
  // FIRST blood of a session that resolution lands after `place` has
  // already thrown - so the batch was built with no art, and nothing
  // ever built it again. A player whose first blood was a warhammer
  // overkill watched ten invisible chunks fly.
  {
    const { fx, marks } = rig();
    const before = made.length;
    fx.showBloodSplash(0, [0, 2, 0], null, kill);        // art not known yet
    assert.equal(marks.gibs().length, GIB_COUNT, 'the chunks fly either way');
    assert.equal(made.length, before, 'but with no art there is no batch to draw them with');
    marks.useArt(380, 1, 6);                              // ...and now the splash's texture lands
    fx.tick(1 / 60);
    assert.equal(made.length, before + 1, 'the next frame seats the batch the art was missing for');
    assert.equal(made.at(-1).archive, 380);
    // ...and it is seated ONCE, not re-minted every frame after
    const seated = made.length;
    fx.tick(1 / 60); fx.tick(1 / 60);
    assert.equal(made.length, seated, 'once seated, it is written and not rebuilt');
  }

  // ---- AN EMPTY LIST IS NOT A FULL ONE. `[].every()` is TRUE, so
  // with no chunks and a drip still falling the bare `every` ran a
  // reseat on every frame of the fall. It no-opped, which is how it
  // went unseen.
  {
    const CEIL = 2;
    const { fx, marks } = rigHitEffects({
      renderer,
      settings: { enabled: () => true, capacity: () => 256, density: () => 1, overkill: () => false },
      collider: () => ({
        surfaceHit: (from, dir, max) => (dir[1] > 0
          ? (CEIL - from[1] <= max ? { dist: CEIL - from[1], normal: [0, -1, 0] } : null)
          : (from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null)),
      }),
    });
    marks.useArt(380, 1, 6);
    fx.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
    assert.ok(marks.drips().length > 0, 'drips falling');
    assert.equal(marks.gibs().length, 0, 'and no chunks at all');
    const churn = killed.length + made.length;
    fx.tick(1 / 60); fx.tick(1 / 60); fx.tick(1 / 60);
    assert.equal(killed.length + made.length, churn, 'a drip falling reseats nothing');
  }
});

test('BLOOD1 AUDIT: the chunks’ centre list is the chunks’ OWN arrays, so a flight allocates nothing a frame', () => {
  const src = readFileSync(new URL('../src/combat/bloodMarks.js', import.meta.url), 'utf8');
  // Every entry of `_gibPos` is the chunk's own `pos` ARRAY, and
  // gibStep / gibFly / gibLand / shiftGibs all write through it in
  // place - so the references stay live for the whole flight and the
  // per-frame move hands the same list over rather than building one.
  assert.match(src, /_gibPos = _gibs\.map\(\(g\) => g\.pos\);/, 'built once, with the batch');
  assert.match(src, /moveBillboardBatch\?\.\(_gibBatch, _gibPos\)/, 'and handed over as it stands');
  const tick = src.slice(src.indexOf('  function tick(dt) {'), src.indexOf('\n  }', src.indexOf('  function tick(dt) {')));
  assert.doesNotMatch(tick, /_gibs\.map\(/, 'the frame builds no list of its own');

  // ...and the writers really do write THROUGH the array rather than
  // replacing it, or the references above would go stale on the first
  // step and every chunk would draw at its birthplace for ever.
  const gibs = readFileSync(new URL('../src/combat/bloodGibs.js', import.meta.url), 'utf8');
  for (const [fn, what] of [['gibFly', 'flying on'], ['gibLand', 'landing'], ['shiftGibs', 'the origin shift']]) {
    const body = gibs.slice(gibs.indexOf(`export function ${fn}(`), gibs.indexOf('\n}', gibs.indexOf(`export function ${fn}(`)));
    assert.match(body, /\.pos\[0\] [+]?= /, `${what} writes through the chunk’s own array`);
    assert.doesNotMatch(body, /\.pos = /, `${what} must not replace it`);
  }
});

test('BLOOD1 AUDIT 2: the blood goes with the world - a teleport clears the ring, the chunks and the drips, and the ring is the same ring after', () => {
  // THE FAULT. `_teleportToPixel` is the world host's ClearStreamingWorld:
  // a fast travel, a quickload and every teleport go through it. It
  // clears the live foes, the guards, the missiles and the arrows,
  // destroys every pixel and then `state.init`s a NEW scene frame -
  // mapOrigin moved, x/z compensation zeroed - with no recentre offset
  // for anything to ride. The splash pool and its ring were the one
  // world-space thing it did not clear, so every mark laid before the
  // jump kept its old local coordinates in the new frame: a fight's
  // blood at the same spot in the next town, floating or buried
  // wherever the ground differed.
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const start = world.indexOf('  async function _teleportToPixel(');
  assert.ok(start > 0, 'the world host has the one teleport door');
  const body = world.slice(start, world.indexOf('\n  }\n', start));
  const clear = body.indexOf('    hitEffects.clear();');
  assert.ok(clear > 0, 'the teleport clears the splash pool, and the ring with it');
  // ...in the SAME sweep as the rest of the world, before the pixels go
  // and before the new frame is initialised
  assert.ok(clear > body.indexOf('exteriorFoes.clearLive();'), 'beside the sweep that clears the foes');
  assert.ok(clear < body.indexOf('for (const key of [...built.keys()])'), 'before the pixels are destroyed');
  assert.ok(clear < body.indexOf('queue.push(...state.init(px, py));'), 'before the new frame is begun');
  // ...and clear() is a FREE here and not a double free: this pool is
  // built with no `onSpawn`, so it owns its splash batches (the
  // dungeon's hands every batch to its billboard list, which is why
  // its teardown must NOT call this - HARD1's own catch).
  assert.match(world, /const hitEffects = createHitEffects\(\{ renderer, getTexture, uploadRecordFrame, marks: bloodMarks \}\);/, 'the world pool owns its batches');
  assert.doesNotMatch(world.slice(start, start + 6000), /hitEffects\.dispose\(\)/, 'and it is cleared, never ended - the host lives on');

  // THE LAW, DRIVEN ON THE POOL: everything in scene space goes, the
  // ring's slots are blanked (a stale quad in a live buffer is a mark
  // at the old place), and the ring is the SAME ring afterwards - the
  // next blood reuses it rather than minting a batch.
  const CEIL = 2.2;
  const made = [];
  const wrote = [];
  const renderer = {
    createDecalBatch: (capacity) => { const b = { capacity, id: `decals${made.length}` }; made.push(b); return b; },
    writeDecalSlot: (batch, slot, floats) => { for (let k = 0; k * DECAL_FLOATS < floats.length; k++) wrote.push({ slot: slot + k, zero: floats.slice(k * DECAL_FLOATS, (k + 1) * DECAL_FLOATS).every((f) => f === 0) }); return true; },
    drawDecals: () => {},
    createBillboardBatch: () => ({}),
    moveBillboardBatch: () => true,
    destroyBillboardBatch: () => {},
    drawBillboards: () => {},
  };
  const { fx, marks } = rigHitEffects({
    renderer,
    settings: { enabled: () => true, capacity: () => 256, density: () => 1, overkill: () => true },
    collider: () => ({
      surfaceHit: (from, dir, max) => (dir[1] > 0
        ? (CEIL - from[1] <= max ? { dist: CEIL - from[1], normal: [0, -1, 0] } : null)
        : (from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null)),
    }),
  });
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [3, 1, 3], null, { damage: 70, maxHealth: 40, fromPlayer: true, heavy: true, throw: [0, 0] });
  fx.tick(1 / 60);
  assert.ok(marks.count() > 0, 'marks on the floor and the ceiling');
  assert.ok(marks.gibs().length > 0, 'chunks in the air');
  assert.ok(marks.drips().length > 0, 'and drips the ceiling has not let go of');
  // a recentre mid-fight moves everything (the streaming case - pinned
  // elsewhere; here it only proves the sweep below is not the shift)
  fx.offsetAll([819.2, 0, 0]);
  assert.equal(made.length, 1, 'one ring');
  const placed = marks.count();
  wrote.length = 0;

  const beforeClear = wrote.length;
  fx.clear();   // the teleport's line
  assert.equal(marks.count(), 0, 'no marks');
  assert.equal(marks.gibs().length, 0, 'no chunks');
  assert.equal(marks.drips().length, 0, 'no drips');
  assert.equal(marks.draw(new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])), false, 'nothing to draw');
  // BLOOD AUDIT 4: and NOTHING IS UPLOADED for it. The slots were
  // blanked one by one - nine hundred calls a door - and every one was
  // dead work: the ring's ranges are empty, and a slot outside them is
  // never rasterised.
  assert.equal(wrote.length, beforeClear, 'a clear writes no slot');
  assert.deepEqual(marks._pool().ranges(), [], 'and there is nothing to draw from');
  assert.ok(placed > 0);

  // ...and the ring is the same ring: the next blood, in the new
  // frame, lands in it without a second batch
  fx.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
  assert.ok(marks.count() > 0, 'blood in the new place');
  assert.equal(made.length, 1, 'on the ring it always had');
});

// ── MAC-BUG W4 (2026-09-20, Mac: "Also blood is black") ────────────
test('MAC-BUG W4: a MARK takes the same light a CHUNK takes - the two passes of one blow agree, term for term', () => {
  // ONE BLOW, TWO PASSES. `bloodMarks.draw` sends the marks through
  // `drawDecals` and the gibs through `drawBillboards` - and the decal
  // pass took AMBIENT AND NOTHING ELSE. Its own comment said what it
  // was for ("so a mark on a dungeon floor is as dark as the floor"),
  // and it was darker than the floor by every term it left out: the
  // floor is a mesh lit by ambient AND the sun AND the point lights,
  // and a dungeon's ambient is 0.12. A red mark came out at about two
  // units of red - black - with lit chunks landing on top of it.
  //
  // `npm run blood` reads the pixels in a real GL context and the
  // numbers are the finding: before the fix a torch standing ON the
  // mark left it at 20,2,2 while the sprite beside it was 187,18,18,
  // and noon drew it at 92,9,9 against the sprite's 176,16,16. This
  // holds the SHAPE of the fix, which is the half a suite can hold:
  // the decal shader's light must be the billboard shader's, term for
  // term, because a mark and a chunk are the same blood.
  const r = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');

  const decalFs = r.slice(r.indexOf('const DECAL_FS = `'), r.indexOf('`;', r.indexOf('const DECAL_FS = `')));   // MAC-BUG W6: the classic one, a module const now
  const meshFs = r.slice(r.indexOf('const CHAR_FS = `'), r.indexOf('`;', r.indexOf('const CHAR_FS = `')));   // BLOOD AUDIT 4: the SURFACE's shader, which is what a mark lies on

  // BLOOD AUDIT 4: THE POINT-LIGHT TERM, character for character with
  // THE MESH'S - W4 had the flats' attenuation-only loop here ("a decal
  // has no normal, exactly as a billboard has none"), and that was the
  // outdoor inconsistency: blood one brightness on every surface of a
  // world lit by N.L. The quad's normal is in its derivatives, and the
  // mark takes the surface's law.
  const loop = /for \(int i = 0; i < 16; i\+\+\) \{\s*if \(i >= uPointCount\) break;\s*vec3 L = uPointLights\[i\]\.xyz - (vWorld|vWorldPos);\s*float d = length\(L\);\s*float att = clamp\(1\.0 - d \/ uPointLights\[i\]\.w, 0\.0, 1\.0\);\s*pointAcc \+= att \* att \* max\(dot\(n, L \/ max\(d, 1e-4\)\), 0\.0\) \* uPointColors\[i\];\s*\}/;
  assert.match(decalFs, loop, 'the decal pass has the MESH’s own point-light loop - N.L on the squared falloff');
  assert.match(meshFs, loop, '...and the mesh still has it, so the two were compared against something real');
  assert.match(decalFs, /uniform vec3 uLightDir;/, 'the sun’s direction');
  assert.match(decalFs, /vec3 c = cross\(dFdx\(vWorld\), dFdy\(vWorld\)\);\s*\n\s*vec3 n = dot\(c, c\) > 1e-12 \? normalize\(c\) : vec3\(0\.0, 1\.0, 0\.0\);/, 'the quad’s own normal - and up, not NaN, for a quad seen edge-on');
  assert.match(decalFs, /if \(dot\(n, uCamPos - vWorld\) < 0\.0\) n = -n;/, 'facing the eye');
  assert.match(decalFs, /float diff = max\(dot\(n, uLightDir\), 0\.0\);/, 'the sun by N.L - the mesh’s own line');
  assert.match(meshFs, /float diff = max\(dot\(n, uLightDir\), 0\.0\);/);

  // THE INDIRECT TERM, the mesh's N.L shape on the same falloff.
  assert.match(decalFs, /vec3 iL = uIndirect\.xyz - vWorld;\s*\n\s*float iD = length\(iL\);/);
  assert.match(decalFs, /float iAtt = clamp\(1\.0 - iD \/ max\(uIndirect\.w, 1e-4\), 0\.0, 1\.0\);/);

  // ...and they are SUMMED, not one of them used.
  // BLOOD AUDIT 5: the MOON by N.L and the TRILIGHT ambient too - W4 folded
  // the moon's Lambert half into the ambient, so a wall mark facing away
  // from Masser glowed at night against an unlit wall
  assert.match(decalFs, /float mdiff = max\(dot\(n, uMoonDir\), 0\.0\);/, 'the moon by N.L');
  assert.match(meshFs, /float mdiff = max\(dot\(n, uMoonDir\), 0\.0\);/);
  assert.match(decalFs, /vec3 ambient = uTrilight > 0\.5 \? \(n\.y >= 0\.0 \? mix\(uTint, uAmbientSky, n\.y\) : mix\(uTint, uAmbientGround, -n\.y\)\) : uTint;/, 'the trilight ambient, as MESH_FS has it');
  assert.match(decalFs, /vec3 lightAcc = ambient \+ uDecalSun \* \(diff \* cloudShadowAt\(vWorld\)\) \+ uDecalMoon \* mdiff \+ pointAcc \+ \(iAtt \* iAtt \* max\(dot\(n, iL \/ max\(iD, 1e-4\)\), 0\.0\)\) \* uIndirectColor;/);   // BLOOD1 AUDIT 3: and under the cloud's shadow, as the mesh's sun term is
  assert.match(decalFs, /vec3 rgb = t\.rgb \* vColor\.rgb \* lightAcc;/);
  assert.doesNotMatch(decalFs, /vec3 rgb = t\.rgb \* vColor\.rgb \* uTint;/,
    'ambient alone is what made the mark black');

  // THE UPLOAD, and the same three-scratch rule the flats' own pass
  // had to learn the hard way (AUDIT PERF-SUN/FOG F4: two decodes into
  // one scratch computed the moon term from the sun's colour).
  const fn = r.slice(r.indexOf('  drawDecals(batch, tex, ranges = null) {'), r.indexOf('\n  }\n', r.indexOf('  drawDecals(batch, tex, ranges = null) {')));
  assert.match(fn, /const am = this\._c3\(this\._ambient, this\._decA\);/);
  assert.match(fn, /const mc = this\._c3\(this\._moonColor, this\._decB\);/);
  assert.match(fn, /const sc = this\._c3\(this\._sunColor, this\._decC\);/);
  assert.equal(new Set(['_decA', '_decB', '_decC'].map((k) => fn.includes(k))).size, 1, 'three colours, three scratches');
  assert.match(fn, /gl\.uniform3f\(d\.sun, sc\[0\] \* this\._sunScale, sc\[1\] \* this\._sunScale, sc\[2\] \* this\._sunScale\);/,
    'BLOOD AUDIT 4: the WHOLE sun - the shader takes N.L off the quad’s normal, as the mesh does; the flats’ half was for a thing with no normal');
  assert.match(fn, /if \(d\.lightDir\) gl\.uniform3fv\(d\.lightDir, this\._lightDir\);/, 'and its direction, on both programs');
  assert.match(fn, /gl\.uniform3f\(d\.tint, am\[0\], am\[1\], am\[2\]\);/, 'BLOOD AUDIT 5: the BARE ambient - no moon half folded in');
  assert.match(fn, /gl\.uniform3f\(d\.moon, mc\[0\] \* this\._moonScale, mc\[1\] \* this\._moonScale, mc\[2\] \* this\._moonScale\);/, 'the whole moon, by N.L in the shader');
  assert.match(fn, /if \(d\.moonDir\) gl\.uniform3fv\(d\.moonDir, this\._moonDir\);/);
  assert.match(fn, /const tri = this\._ambientTri;\s*\n\s*gl\.uniform1f\(d\.trilight, tri \? 1 : 0\);\s*\n\s*if \(tri\) \{ gl\.uniform3fv\(d\.ambientSky, this\._c3\(tri\.sky\)\); gl\.uniform3fv\(d\.ambientGround, this\._c3\(tri\.ground\)\); \}/, 'the trilight, as drawMesh uploads it');
  assert.match(fn, /gl\.uniform3f\(d\.moon, 0, 0, 0\);/, 'a clockless scene: no moon');
  for (const u of ['uDecalMoon', 'uMoonDir', 'uTrilight', 'uAmbientSky', 'uAmbientGround']) { assert.match(decalFs, new RegExp(`uniform (vec3|float) ${u};`)); assert.match(r, new RegExp(`gl\\.getUniformLocation\\(P, '${u}'\\)`)); }
  assert.match(r, /lightDir: gl\.getUniformLocation\(P, 'uLightDir'\),/, 'looked up with the rest of the decal’s locations');
  assert.match(fn, /gl\.uniform1i\(d\.pointCount, dCount\);/);
  assert.match(fn, /gl\.uniform4fv\(d\.pointLights, this\._pointLights\.subarray \? this\._pointLights\.subarray\(0, dCount \* 4\) : this\._pointLights\.slice\(0, dCount \* 4\)\);/, 'BLOOD1 AUDIT 3: with drawTerrain’s own guard for a plain array');
  assert.match(fn, /gl\.uniform3fv\(d\.pointColors, this\._pointColorData\(dCount\)\);/);
  // W4 pinned the decal as "a fifth classic program with no lane twin",
  // cutting to CLASSIC_MAX_LIGHTS under the lane's forty-eight. MAC-BUG
  // W6 gave it the twin, so the cut is to the INSTALLED set's cap - the
  // classic sixteen or the lane's forty-eight, whichever `maxPointLights`
  // says - and the W6 pins below hold the twin itself.
  assert.match(fn, /const dCount = Math\.min\(this\._pointLights\.length >> 2, this\._decalLights\);/,
    'the decal cuts to the installed decal PROGRAM\u2019s cap (BLOOD1 AUDIT 3: a lane with no twin runs the classic program under forty-eight)');

  // A CLOCKLESS SCENE keeps full bright, as the flats do - and its sun
  // goes to zero with it, or a scene with no clock would carry the last
  // one's sun.
  assert.match(fn, /gl\.uniform3f\(d\.tint, 1, 1, 1\);\s*\n\s*gl\.uniform3f\(d\.sun, 0, 0, 0\);/);

  // and the probe that measured it is committed, so the next person
  // reads pixels rather than the shader
  assert.match(readFileSync(new URL('../package.json', import.meta.url), 'utf8'), /"blood": "node tools\/bloodProbe\.mjs"/);
});

// ── MAC-BUG W6 (2026-09-20, Mac: "super dark coloring instead of red") ──
test('MAC-BUG W6 by source: the decal has a LANE TWIN, the flat’s model on the lane’s pipeline, and the renderer builds and feeds it as the set’s fifth program', async () => {
  // THE FAULT. The port ships with the Enhanced Lighting lane ON, and
  // under it the renderer DECODES every colour it uploads to linear
  // (`_c3`, `_pointColorData`) because the lane's shaders light in
  // linear and encode at the end. The decal pass was a classic program
  // with, as W4 pinned it, "no lane twin": it took those linear values
  // as display ones, multiplied an UNDECODED texel by them and wrote the
  // product raw - no exposure, no tonemap, no encode. Measured beside a
  // sprite in the same light (tools/bloodProbe.mjs, the LANE rows): dusk
  // 25 against 69, a dark dungeon 2 against 17. W4's probe read the
  // classic set alone, and was green the whole time.
  const el = readFileSync(new URL('../src/render/enhancedLighting.js', import.meta.url), 'utf8');
  const r = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  const { EL_LANE, EL_DECAL_FS, EL_BB_FS, EL_MAX_LIGHTS } = await import('../src/render/enhancedLighting.js');

  // the lane carries it, by the key the set builder reads
  assert.equal(EL_LANE.decalFs, EL_DECAL_FS, 'EL_LANE.decalFs is the twin');
  assert.match(r, /decal: this\._buildProgram\(DECAL_VS, src\.decalFs \?\? DECAL_FS\),/, 'the set builds it from the lane’s key, the classic FS only for a lane that brings none');

  // THE FLAT'S MODEL, TERM FOR TERM WITH EL_BB_FS - a mark and a chunk
  // are the same blood, and under this lane they were not.
  assert.match(EL_DECAL_FS, /vec3 albedo = elDecode\(t\.rgb\) \* elDecode\(vColor\.rgb\);/, 'the texel AND the tint decode - each on its own, the curve being what it is (BLOOD1 AUDIT 3)');
  assert.match(EL_BB_FS, /vec3 albedo = max\(elDecode\(tex\.rgb\) - emission, vec3\(0\.0\)\);/, '(the flat decodes its texel - the comparison is against something real)');
  // BLOOD AUDIT 4: the SURFACE's terms on the lane too - elPointLit and
  // elIndirectLit (N.L, the lantern's map, the contact shadow, the
  // glint), which is what the mesh under the mark takes
  assert.match(EL_DECAL_FS, /vec3 lit = albedo \* \(ambient \+ sunLit \+ moonLit \+ elPointLitWet\(vWorld, n, vWet, glint\) \+ elIndirectLit\(vWorld, n\)\);/, 'the mesh’s lantern and indirect terms, N.L - and (BLOOD AUDIT 5) the moon by N.L and the trilight ambient');
  assert.match(EL_DECAL_FS, /vec3 moonLit = uDecalMoon \* max\(dot\(n, uMoonDir\), 0\.0\);/);
  assert.match(EL_DECAL_FS, /vec3 ambient = uTrilight > 0\.5 \? \(n\.y >= 0\.0 \? mix\(uTint, uAmbientSky, n\.y\) : mix\(uTint, uAmbientGround, -n\.y\)\) : uTint;/);
  assert.match(EL_DECAL_FS, /float sunVis = \(dot\(uDecalSun, uDecalSun\) > 0\.0 && ndl > 0\.0\) \? cloudShadowAt\(vWorld\) \* sunShadowAt\(vWorld, n\) : 0\.0;/, 'the sun’s visibility ONCE - the nine-tap map is read for the diffuse and the glint together');
  assert.match(EL_DECAL_FS, /vec3 sunLit = uDecalSun \* \(ndl \* sunVis\);/);
  assert.match(EL_DECAL_FS, /uniform vec3 uLightDir;/);
  assert.match(EL_DECAL_FS, /float ndl = max\(dot\(n, uLightDir\), 0\.0\);/, 'the sun by N.L - the lane’s mesh line');
  assert.match(EL_BB_FS, /vec3 lit = albedo \* \(uTint \+ sunLit \+ elPointFlat\(vBBWorld, base\) \+ elIndirectFlat\(vBBWorld\)\) \+ emission;/, '(the flat’s own line)');
  assert.equal((EL_DECAL_FS.slice(EL_DECAL_FS.lastIndexOf('void main()')).match(/sunShadowAt\(/g) || []).length, 1, 'the sun map is read once per fragment');
  assert.match(EL_DECAL_FS, /outColor = vec4\(elFinish\(lit, vWorld\), t\.a \* vColor\.a\);/, 'exposure, tonemap, fog in linear, in-scatter, ENCODE - the lane’s finish, with the mark’s own alpha');
  assert.match(EL_DECAL_FS, new RegExp(`uniform vec4 uPointLights\\[${EL_MAX_LIGHTS}\\];`), 'the lane’s forty-eight');
  assert.doesNotMatch(EL_DECAL_FS, /uPointLights\[16\]/, 'not the classic sixteen');
  // THE ONE THING A MARK HAS THAT A FLAT DOES NOT is a surface: a flat
  // reads its shadow half a unit UP from its base; a ceiling's mark read
  // that way reads inside the rock. The mark's normal comes from its own
  // quad, faces the eye, and the shadow is read half a unit out along it.
  assert.match(EL_DECAL_FS, /vec3 c = cross\(dFdx\(vWorld\), dFdy\(vWorld\)\);\s*\n\s*vec3 n = dot\(c, c\) > 1e-12 \? normalize\(c\) : vec3\(0\.0, 1\.0, 0\.0\);/, 'the quad’s own normal - and up, not NaN, for a quad seen edge-on (BLOOD1 AUDIT 3)');
  assert.match(EL_DECAL_FS, /if \(dot\(n, uCamPos - vWorld\) < 0\.0\) n = -n;/, 'facing the eye');
  assert.doesNotMatch(EL_DECAL_FS.slice(EL_DECAL_FS.lastIndexOf('void main()')), /elPointFlat|elIndirectFlat|sunShadowSoftAt|vec3 base/, 'BLOOD AUDIT 4: none of the flat’s terms in the mark’s own main - it lies on a surface and is lit as one');
  // the shared blocks the flat has - the decode/encode, the shadow
  // receiver, the contact block, the fog, the lantern loop
  for (const block of ['${EL_GLSL}', '${SHADOW_GLSL}', '${AIR_CONTACT_GLSL}', '${EL_FOG_GLSL}', '${EL_POINT_LIT_GLSL}']) {
    const decalSrc = el.slice(el.indexOf('export const EL_DECAL_FS = `'), el.indexOf('`;', el.indexOf('export const EL_DECAL_FS = `')));
    assert.ok(decalSrc.includes(block), `the twin interpolates ${block}`);
  }
  // and the same alpha law the classic program has: a clear texel draws nothing
  assert.match(EL_DECAL_FS, /if \(t\.a < 0\.01\) discard;/);

  // THE RENDERER FEEDS IT WHAT IT FEEDS THE FLATS. `_uploadEl` is the
  // exposure, the in-scatter, the shadow maps and the eye; the cloud
  // shadow is its own pair; both are keyed by program and the decal's
  // entries ride the same tables the other four do.
  const fn = r.slice(r.indexOf('  drawDecals(batch, tex, ranges = null) {'), r.indexOf('\n  }\n', r.indexOf('  drawDecals(batch, tex, ranges = null) {')));
  assert.match(fn, /this\._uploadEl\('decal'\);/, 'the lane’s own uniforms');
  assert.match(fn, /this\._uploadCloudShadow\('decal'\);/, 'the cloud’s shadow');
  assert.ok(fn.indexOf("this._uploadEl('decal');") < fn.indexOf('gl.drawElements('), 'uploaded BEFORE the draw');
  assert.ok(fn.indexOf("this._uploadCloudShadow('decal');") < fn.indexOf('gl.drawElements('), 'and so is the cloud');
  assert.match(fn, /const dCount = Math\.min\(this\._pointLights\.length >> 2, this\._decalLights\);/, 'the installed decal program’s cap: sixteen classic, forty-eight lane, sixteen for a foreign lane with no twin');
  assert.match(r, /decalLights: src\.decalFs \? \(src\.maxLights \?\? CLASSIC_MAX_LIGHTS\) : CLASSIC_MAX_LIGHTS,/, 'the set carries the cap its decal program declares');
  assert.match(r, /decal: elLocs\(set\.decal\)/, 'the decal’s lane uniforms are looked up with the set');
  assert.match(r, /this\._csLoc\.decal = \[gl\.getUniformLocation\(set\.decal, 'uCloudShadowMap'\), gl\.getUniformLocation\(set\.decal, 'uCloudShadowRect'\)\];/, 'and its cloud pair');
  assert.match(r, /this\.decalProgram = set\.decal;\s*\n\s*this\._decal = this\._decalLocs\(set\.decal\);/, 'the program and its table are the installed set’s');
  assert.match(r, /\.\.\.this\._fogLocs\(P\),/, 'the fog table is the one that knows uFogColorLin - the lane’s finish blends the DECODED fog');
  // the classic program is untouched by all of this: no lane uniform in it
  const classicFs = r.slice(r.indexOf('const DECAL_FS = `'), r.indexOf('`;', r.indexOf('const DECAL_FS = `')));
  assert.ok(!/uELExposure|elFinish|elDecode/.test(classicFs), 'the classic decal stays classic');
  assert.match(classicFs, /uniform vec4 uPointLights\[16\];/);

  // and the probe reads BOTH sets now - W4's rows were all classic, and
  // that is how a fault in the shipped default went unread
  const probe = readFileSync(new URL('../tools/bloodProbe.mjs', import.meta.url), 'utf8');
  assert.match(probe, /r\.setLightingLane\(EL_LANE\);/, 'the probe installs the lane');
  assert.match(probe, /LANE \$\{x\.what\}: the mark is lit as the wall it lies on is/, 'and holds the mark to the SURFACE it lies on (BLOOD AUDIT 4: a mesh facing the eye, not the flat beside it)');
  assert.match(probe, /r\.drawMesh\(wall, IDENT\);/, 'the wall goes through the mesh pass');
  assert.match(probe, /OWN \$\{lane\}: dried blood at noon is a RUST, browner than fresh/, 'and reads the atlas under the real tints');
});

// ── BLOOD1 AUDIT 3 (2026-09-20, Mac: "I think this deserves a real audit.
// I doubt there's only one issue" / "the blood system needs to be as
// visceral and detailed as possible ... inconsistencies with blood with
// the exterior") - three lenses, the findings paid ──────────────────
test('BLOOD1 AUDIT 3: the mark is the FOE’S even where the splash is record 0 - a skeleton’s fall stains nothing', () => {
  // EnemyMotor's fall damage shows record 0 for EVERY foe (its own
  // literal), and the two generic fall sites passed that 0 on to the
  // marks too - so the bloodless gate, the whole point of
  // BLOODLESS_INDEX, was bypassed for a skeleton walking off a ledge.
  const { fx, marks } = rigHitEffects();
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 2, 0], null, { damage: 10, maxHealth: 40, markIndex: BLOODLESS_INDEX });
  assert.equal(marks.count(), 0, 'record 0 splashes, the bloodless mark index marks nothing');
  fx.showBloodSplash(0, [0, 2, 0], null, { damage: 10, maxHealth: 40, markIndex: 0 });
  assert.ok(marks.count() > 0, 'and a bleeding foe’s fall stains as any blow does');
  fx.showBloodSplash(0, [0, 2, 0], null, { damage: 10, maxHealth: 40 });
  assert.ok(marks.count() > 0, 'a site naming no mark index keeps the splash’s own');
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(read('src/scenes/hitEffects.js'), /marks\?\.place\?\.\(hit\?\.markIndex \?\? bloodIndex, pos, hit\);/);
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(read(f), /showBloodSplash\(0, f\.ai\._centre\(\), null, \{ \.\.\.bloodHit\(\w+, f\.entity\), markIndex: ENEMY_BASICS\[f\.mobileType\]\?\.bloodIndex \?\? 0 \}\)/, `${f}: the fall site names the foe’s own mark index`);
  }
});

test('BLOOD1 AUDIT 3: the dungeon’s hand-off splash pool is cleared ABOVE the list it hands to, so a warming splash cannot mint an orphan', async () => {
  // THE HOLE: `entry.dead` is set by retire() alone, and the dungeon
  // never called clear() (a clear BELOW the destroy loop was a double
  // free). So a splash whose archive was still warming when the dungeon
  // went minted a batch into the orphaned list, and nothing freed it.
  // ABOVE the loop it is one free per batch: retire() splices the batch
  // out of the list before it frees it.
  const src = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const d = src.indexOf('    destroy() {');
  const body = src.slice(d, src.indexOf('\n    },\n', d));
  const clear = body.indexOf('      hitEffects.clear();');
  const loop = body.indexOf('      for (const b of billboardBatches) renderer.destroyBatch(b);');
  assert.ok(clear > 0 && loop > 0 && clear < loop, 'the splash pool is cleared before the hand-off list is freed');
  assert.ok(body.indexOf('bloodMarks.dispose();') < clear, 'and the ring, its own, is ended by its own name first');

  // driven: a splash warming at teardown, with the hand-off wiring the
  // dungeon uses - the continuation lands on a dead entry and builds
  // nothing, and the list it would have pushed into is empty
  const list = [];
  let resolveTex = null;
  const made = [];
  const renderer = {
    createBillboardBatch: (a, r, size, centers) => { const b = { a, r, centers }; made.push(b); return b; },
    destroyBillboardBatch: () => {},
    uploadTexture: () => {},
  };
  const fx = createHitEffects({
    renderer,
    getTexture: () => new Promise((res) => { resolveTex = res; }),
    uploadRecordFrame: () => {},
    onSpawn: (b) => list.push(b),
    onRetire: (b) => { const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); },
  });
  fx.showBloodSplash(0, [0, 1, 0]);
  assert.equal(made.length, 0, 'warming: nothing built yet');
  fx.clear();   // the dungeon goes
  resolveTex({ recordCount: 8, getFrameCount: () => 6, getSize: () => ({ width: 8, height: 8 }), getScale: () => ({ width: 0, height: 0 }) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(made.length, 0, 'the continuation builds nothing for a dead entry');
  assert.equal(list.length, 0, 'and hands nothing to the orphaned list');
});

test('BLOOD1 AUDIT 3: the switch gates the DRAW and the TICK, the ring is built at boot, and a recentre moves the chunks’ quads before the draw', () => {
  let enabled = true;
  const made = [], moves = [];
  const renderer = {
    createDecalBatch: (capacity) => { const b = { capacity }; made.push(b); return b; },
    writeDecalSlot: () => true,
    drawDecals: () => {},
    createBillboardBatch: (a, r, size, centers) => ({ a, r, centers }),
    moveBillboardBatch: (batch, centers) => { moves.push(centers.map((c) => [...c])); return true; },
    destroyBillboardBatch: () => {},
    drawBillboards: () => {},
  };
  let capacityReads = 0;
  const { fx, marks } = rigHitEffects({
    renderer,
    settings: { enabled: () => enabled, capacity: () => { capacityReads++; return 64; }, density: () => 1, overkill: () => true },
    collider: () => ({ surfaceHit: (from, dir, max) => (dir[1] < 0 && from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null), raycastHit: () => ({ dist: Infinity }) }),
  });
  // BUILT AT BOOT, as bloodSwitch.js always said - it was built at the
  // first drop that landed, reading the capacity then.
  assert.equal(made.length, 1, 'the ring exists before any blood');
  assert.equal(capacityReads, 1, 'the capacity was read once, at boot');
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 1, 0], null, { damage: 70, maxHealth: 40, fromPlayer: true, heavy: true, throw: [0, 0] });
  fx.showBloodSplash(0, [3, 1, 3], null, { damage: 10, maxHealth: 40 });
  assert.equal(capacityReads, 1, 'and never again');
  assert.ok(marks.count() > 0 && marks.gibs().length === GIB_COUNT);
  // A RECENTRE MOVES THE QUADS NOW: the host shifts, then draws, then
  // ticks, so the chunks drew one frame from the old buffer.
  moves.length = 0;
  fx.offsetAll([819.2, 0, 0]);
  assert.equal(moves.length, 1, 'the chunks’ quads are rewritten at the shift');
  assert.ok(moves[0].every((c) => c[0] >= 819.2 - 15), 'to the shifted positions');
  assert.ok(marks.draw(new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])), 'drawn while on');
  // THE SWITCH OFF MID-FIGHT: nothing drawn, the chunks and drips dropped
  enabled = false;
  assert.equal(marks.draw(new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])), false, 'off: nothing drawn, marks included');
  fx.tick(1 / 60);
  assert.equal(marks.gibs().length, 0, 'off: the chunks in the air are dropped');
  assert.equal(marks.drips().length, 0, 'and the drips');
  enabled = true;
  assert.ok(marks.draw(new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])), 'on again: the marks that were laid are still there');
});

test('BLOOD1 AUDIT 3: the ring draws its TOUCHED slots in AGE order - one range unwrapped, two once wrapped - and the pool hands them to the pass', () => {
  const pool = createBloodDecalPool({ capacity: 4, rng: () => 0.5 });
  assert.deepEqual(pool.ranges(), [], 'empty: nothing to draw');
  for (let i = 0; i < 3; i++) pool.place([i, 0, 0], [0, 1, 0]);
  assert.deepEqual(pool.ranges(), [[0, 3]], 'three marks: the prefix, not the capacity');
  assert.equal(pool.touched, 3);
  pool.place([3, 0, 0], [0, 1, 0]);
  assert.deepEqual(pool.ranges(), [[0, 4]], 'full and unwrapped: the whole ring, oldest first');
  pool.place([4, 0, 0], [0, 1, 0]);   // wraps: slot 0 is now the NEWEST
  assert.deepEqual(pool.ranges(), [[1, 4], [0, 1]], 'wrapped: the oldest slots first, the newest last - the burst under the pool holds');
  // ...which is exactly decals()' order, range by range
  const order = pool.ranges().flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
  assert.deepEqual(order, pool.decals().map((d) => d.slot));
  pool.clear();
  assert.deepEqual(pool.ranges(), []);
  assert.equal(pool.touched, 0);
  // the pass is handed the ranges
  const drew = [];
  const { fx, marks } = rigHitEffects({ renderer: { createDecalBatch: (capacity) => ({ capacity }), writeDecalSlot: () => true, drawDecals: (b, t, ranges) => { drew.push(ranges); }, createBillboardBatch: () => ({}) } });
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 2, 0], null, { damage: 10, maxHealth: 40 });
  marks.draw();
  assert.ok(Array.isArray(drew[0]) && drew[0].length >= 1 && drew[0][0][0] === 0, 'the pool’s own ranges reach drawDecals');
});

test('BLOOD1 AUDIT 3: the spray’s wobble is a share of the SLOT, so the top rung’s drops never cross - and blood does not pass through walls', () => {
  // 0.9 RADIANS of wobble on a 15-degree slot (the top rung's 24 drops)
  // put drops on top of each other; nine tenths of a slot cannot.
  for (const n of [4, 24, SPRAY_MAX]) {
    for (let i = 1; i < n - 1; i++) {
      const hi = Math.atan2(...sprayOffset(i, n, 1, () => 1).reverse());
      const lo = Math.atan2(...sprayOffset(i + 1, n, 1, () => 0).reverse());
      assert.ok(lo - hi > 1e-9 || lo - hi < -Math.PI, `n=${n}: drop ${i} at its widest never reaches drop ${i + 1} at its narrowest`);
    }
  }
  assert.ok(SPRAY_WOBBLE < 1, 'a share of the slot');

  // A WALL BETWEEN THE BODY AND THE DROP: the drop lands nowhere. The
  // stub's wall stands at x = +0.3 for any ray heading +x.
  const wallAt = 0.3;
  const collider = (walled) => () => ({
    surfaceHit: (from, dir, max) => (dir[1] < 0 && from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null),
    // BLOOD2a: a wall BEYOND the ray's reach is a miss, not a hit at the
    // reach - the first cut of this stub clamped the distance and so
    // reported a drop short of the wall as having met it there
    raycastHit: (from, dir, max) => {
      if (!walled || !(dir[0] > 0) || from[0] >= wallAt) return { dist: Infinity, normal: null };
      const d = (wallAt - from[0]) / dir[0];
      return d <= max ? { dist: d, normal: [-1, 0, 0] } : { dist: Infinity, normal: null };
    },
  });
  const hit = { damage: 30, maxHealth: 40, fromPlayer: true, heavy: false, throw: [0, 0] };   // the top rung: 24 drops over 1.8 m
  const open = rigHitEffects({ collider: collider(false), settings: { enabled: () => true, capacity: () => 256, density: () => 1, overkill: () => false } });
  open.marks.useArt(380, 1, 6); open.fx.showBloodSplash(0, [0, 1, 0], null, hit);
  const walled = rigHitEffects({ collider: collider(true), settings: { enabled: () => true, capacity: () => 256, density: () => 1, overkill: () => false } });
  walled.marks.useArt(380, 1, 6); walled.fx.showBloodSplash(0, [0, 1, 0], null, hit);
  // BLOOD2a: the wall does not LOSE the drops, it TAKES them - every
  // drop that would have passed through it stains it where it met it
  // (MORE, not the same: a drop that would have looked UP past the wall and found no ceiling in this stub meets the wall first, and stains it)
  assert.ok(walled.marks.count() >= open.marks.count(), 'no drop is lost to the wall');
  assert.ok(walled.marks._pool().decals().every((d) => d.pos[0] <= wallAt + 1e-9), 'and none landed past it');
  const onWall = walled.marks._pool().decals().filter((d) => Math.abs(d.normal[1]) < 1e-9);
  assert.ok(onWall.length > 0, 'some are ON the wall');
  for (const d of onWall) {
    assert.ok(Math.abs(d.pos[0] - (wallAt - SURFACE_LIFT)) < 1e-9, 'at the wall, lifted toward the body it came from');
    assert.deepEqual(d.normal, [-1, 0, 0], 'facing the way it came');
    assert.equal(d.stretch, 1, 'a wall mark is round - a spurt meeting a wall head-on spreads');
  }
  assert.ok(walled.marks._pool().decals().some((d) => d.pos[0] === 0 && d.pos[2] === 0), 'the pool under the body still lands');
});

test('BLOOD1 AUDIT 3: the pure law refuses what would poison it - a NaN capacity, size or delta, a prototype swing, an endless throw - and `?blood=off` exists', async () => {
  assert.doesNotThrow(() => createBloodDecalPool({ capacity: NaN }));
  assert.doesNotThrow(() => createBloodDecalPool({ capacity: Infinity }));
  const nanCap = createBloodDecalPool({ capacity: NaN, rng: () => 0.5 });
  for (let i = 0; i < 1001; i++) nanCap.place([0, 0, 0], [0, 1, 0]);
  assert.equal(nanCap.count, 1000, 'not a number is the default, as it is for the switch');
  const pool = createBloodDecalPool({ capacity: 4, rng: () => 0.5 });
  assert.equal(pool.place([0, 0, 0], [0, 1, 0], { size: NaN }).size, 0, 'a NaN size is a size of zero, not twelve NaN floats in the slot');
  const d = pool.place([1, 2, 3], [0, 1, 0]);
  assert.equal(pool.shiftOrigin([NaN, 0, 0]), 0, 'a non-finite delta moves nothing');
  assert.deepEqual(d.pos.map((v) => Math.round(v * 1000) / 1000), [1, 2.02, 3], 'and the mark is where it was');
  assert.deepEqual(swingThrow('constructor', [0, 0, 1]), [0, 0], 'a prototype key is not a swing');
  assert.deepEqual(swingThrow('toString', [0, 0, 1]), [0, 0]);
  assert.equal(throwGibs([0, 0, 0], () => 0.5, Infinity).length, GIB_COUNT, 'an endless throw is the default throw');
  assert.equal(shiftGibs([null, { pos: [0, 0, 0] }], [1, 0, 0]), 1, 'a hole in the list is skipped');
  assert.ok(!('parent' in pool.place([0, 0, 0], [0, 1, 0])), 'the dead field is gone');
  const { bloodMarksOn } = await import('../src/combat/bloodSwitch.js');
  assert.equal(bloodMarksOn('?blood=off'), false, 'the door the comment promised');
  assert.equal(bloodMarksOn('?blood=on'), true);
  assert.equal(bloodMarksOn(''), true);
});

test('BLOOD1 AUDIT 3: a chunk’s arc is the same arc at every frame rate - Unity’s fixed step, whole steps only, the remainder carried', () => {
  // the SAME trajectory, sampled at whatever times a frame rate happens
  // to land on: at every time two rates share, the chunk is in the same
  // place. (The apex a frame SEES differs by a few millimetres, because
  // a coarser rate looks between the steps less often - that is the
  // frame's business, not the physics'.)
  const fly = (dt, seconds, at) => {
    const g = throwGibs([0, 0, 0], () => 0.5)[0];   // straight up at 10 m/s
    const seen = [];
    let frames = 0;
    for (let t = 0; t < seconds - 1e-9; t += dt) {
      const step = gibStep(g, dt); if (step) gibFly(g, step);
      frames++;
      if (at.some((a) => Math.abs(frames * dt - a) < 1e-9)) seen.push([...g.pos]);
    }
    return { seen, vel: [...g.vel] };
  };
  const times = [0.5, 1, 1.5, 2];
  const at60 = fly(1 / 60, 2, times), at10 = fly(1 / 10, 2, times), at30 = fly(1 / 30, 2, times);
  assert.equal(at60.seen.length, 4); assert.equal(at10.seen.length, 4); assert.equal(at30.seen.length, 4);
  for (let k = 0; k < 4; k++) {
    assert.ok(Math.abs(at60.seen[k][1] - at10.seen[k][1]) < 1e-6, `at ${times[k]}s: 60 fps ${at60.seen[k][1].toFixed(5)} is 10 fps ${at10.seen[k][1].toFixed(5)}`);
    assert.ok(Math.abs(at60.seen[k][1] - at30.seen[k][1]) < 1e-6, `at ${times[k]}s: and 30 fps`);
  }
  assert.ok(Math.abs(at60.vel[1] - at10.vel[1]) < 1e-6);
  assert.ok(at60.seen[0][1] > 1.0, 'and it really flew - past a metre, already on the way down by the half second');
  // a frame shorter than a step banks its time rather than moving
  const g = throwGibs([0, 0, 0], () => 0.5)[0];
  assert.equal(gibStep(g, GIB_FIXED_DT / 2), null, 'half a step: nothing yet');
  assert.ok(gibStep(g, GIB_FIXED_DT / 2), 'the other half: one whole step');
  assert.equal(GIB_FIXED_DT, 0.02, 'Time.fixedDeltaTime');
});

test('BLOOD1 AUDIT 3: a mark on streamed terrain lies on the DRAWN ground, and the ray walk allocates nothing per bucket', () => {
  // The world host's `heightAt` is a bilinear read the capsule walks on;
  // the terrain is two triangles a quad, up to 0.08 apart from it - four
  // times a mark's 2cm lift. The collider takes a second sampler for
  // what is PLACED, and the capsule keeps its floor.
  const c = new Collider(() => 5, () => 5.06);
  const h = c.surfaceHit([0, 10, 0], [0, -1, 0], 20);
  assert.ok(Math.abs(h.dist - 4.94) < 1e-9, 'the drawn ground, not the bilinear one');
  assert.deepEqual(c.groundNormal(0, 0), [0, 1, 0]);
  const slope = new Collider(() => 0, (x) => x * 0.5);   // the drawn ground rises with x; the capsule floor is flat
  const n = slope.groundNormal(0, 0);
  assert.ok(n[0] < 0 && Math.abs(n[0] / n[1] + 0.5) < 1e-9, 'the slope is the DRAWN surface’s');
  assert.equal(new Collider(() => 5).surfaceHit([0, 10, 0], [0, -1, 0], 20).dist, 5, 'no second sampler: the floor as before');
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const world = read('src/scenes/world.js');
  assert.match(world, /const collider = new Collider\(heightAt, surfaceAt\);/, 'the world host hands both');
  assert.match(world, /return surfaceHeightAt\(p\.samples, lx, lz, p\._stride \?\? 1\) \+ t\[1\];/, 'the drawn ground is the grass placer’s own sampler, on the pixel the point is in');
  // the ray walk: one translation array a bucket, and no boxed origin
  assert.equal((world.match(/\(\(o\) => \(\) => state\.pixelTranslation\(px, py, o\)\)\(\[0, 0, 0\]\)/g) ?? []).length, 3, 'every bucket translation reuses its own array');
  assert.doesNotMatch(world, /\(\) => state\.pixelTranslation\(px, py\)[,)]/, 'no bucket allocates a translation per call');
  const col = read('src/player/collider.js');
  const box = col.slice(col.indexOf('export function segmentHitsBox('), col.indexOf('\n}', col.indexOf('export function segmentHitsBox(')));
  assert.doesNotMatch(box, /\[ox, oy, oz\]/, 'the box test reads its origin in place - no array of it in any spelling');
  assert.match(box, /const ok = k === 0 \? ox : k === 1 \? oy : oz;/, 'the component by index, without a list');
  // and the classic decal shader takes the cloud's shadow on its sun term
  const r = read('src/render/renderer.js');
  const classicFs = r.slice(r.indexOf('const DECAL_FS = `'), r.indexOf('`;', r.indexOf('const DECAL_FS = `')));
  assert.ok(classicFs.includes('${CLOUD_SHADOW_GLSL}'), 'the classic decal reads the cloud map');
  assert.match(classicFs, /uDecalSun \* \(diff \* cloudShadowAt\(vWorld\)\)/, 'on the sun term, as the mesh has it');
});

// ── BLOOD2a (2026-09-21, Mac: "make it even more visceral and detailed" /
// "Lets do it") - blood on walls, and spatter stretched along its travel ──
test('BLOOD2a: a basis ALONG a travel - right is the travel in the plane, the frame is the same right-handed frame, and no travel in the plane falls back', () => {
  // a floor, a drop that flew +x: right is +x, up closes the frame
  const b = basisAlong([0, 1, 0], [3, 0, 0]);
  assert.deepEqual(b.right, [1, 0, 0]);
  assert.deepEqual(b.normal, [0, 1, 0]);
  const cr = [b.right[1] * b.up[2] - b.right[2] * b.up[1], b.right[2] * b.up[0] - b.right[0] * b.up[2], b.right[0] * b.up[1] - b.right[1] * b.up[0]];
  assert.ok(cr.every((v, k) => Math.abs(v - b.normal[k]) < 1e-12), 'right x up = normal, as surfaceBasis has it - the same winding, the same lift');
  // the travel is PROJECTED: a drop that flew +x and fell lands along +x on the floor
  const slanted = basisAlong([0, 1, 0], [2, -5, 0]);
  assert.ok(Math.abs(slanted.right[0] - 1) < 1e-12 && Math.abs(slanted.right[1]) < 1e-12);
  // a wall: the travel toward it has no component in its plane ONLY when
  // it is dead-on; a slanted travel lies along the wall
  const wall = basisAlong([-1, 0, 0], [1, 0, 1]);
  assert.ok(Math.abs(wall.right[2] - 1) < 1e-12 && Math.abs(wall.right[0]) < 1e-12, 'along the wall');
  // straight down onto a floor: nothing in the plane, the spun basis
  const down = basisAlong([0, 1, 0], [0, -1, 0], 0.7);
  assert.deepEqual(down, surfaceBasis([0, 1, 0], 0.7));
  assert.deepEqual(basisAlong([0, 1, 0], null, 0.3), surfaceBasis([0, 1, 0], 0.3), 'no travel at all: the spun basis');
  // a non-unit normal is normalised, as everywhere
  assert.deepEqual(basisAlong([0, 4, 0], [0, 0, 2]).right, [0, 0, 1]);
});

test('BLOOD2a: the streak - round at the body, STREAK_MAX at the reach, clamped past it - and the quad is longer along `right` by it, not across', () => {
  assert.equal(streakFor(0, 2), 1, 'the pool flew nowhere');
  assert.equal(streakFor(2, 2), STREAK_MAX, 'the edge of the spray');
  assert.equal(streakFor(5, 2), STREAK_MAX, 'and never past it');
  assert.ok(Math.abs(streakFor(1, 2) - (1 + (STREAK_MAX - 1) / 2)) < 1e-12, 'half way, half the stretch');
  assert.equal(streakFor(1, 0), 1); assert.equal(streakFor(NaN, 2), 1); assert.equal(streakFor(1, NaN), 1);
  assert.ok(STREAK_MAX > 1 && STREAK_MAX <= 4, 'a streak, not a line');
  const pool = createBloodDecalPool({ capacity: 4, rng: () => 0.5 });
  const d = pool.place([0, 0, 0], [0, 1, 0], { size: 1, along: [1, 0, 0], stretch: 2.5 });
  assert.equal(d.stretch, 2.5);
  assert.deepEqual(d.right, [1, 0, 0], 'laid along the travel');
  const out = new Float32Array(DECAL_FLOATS);
  writeDecalQuad(out, 0, d);
  const xs = [0, 1, 2, 3].map((k) => out[k * DECAL_FLOATS_PER_VERTEX]), zs = [0, 1, 2, 3].map((k) => out[k * DECAL_FLOATS_PER_VERTEX + 2]);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 2.5) < 1e-6, 'two and a half along the travel');
  assert.ok(Math.abs(Math.max(...zs) - Math.min(...zs) - 1) < 1e-6, 'one across it');
  // a round drop is round, and a stretch under one is one
  const r = pool.place([0, 0, 0], [0, 1, 0], { size: 1, turn: 0 });
  assert.equal(r.stretch, 1);
  assert.equal(pool.place([0, 0, 0], [0, 1, 0], { size: 1, stretch: 0.2 }).stretch, 1);
  assert.equal(pool.place([0, 0, 0], [0, 1, 0], { size: 1, stretch: NaN }).stretch, 1);
});

test('BLOOD2a: a spray’s spatter lies ALONG its travel and longer the further it flew; the pool stays round; the ceiling’s drops too', () => {
  const CEIL = 2.2;
  const { fx, marks } = rigHitEffects({
    settings: { enabled: () => true, capacity: () => 256, density: () => 1, overkill: () => false },
    collider: () => ({
      surfaceHit: (from, dir, max) => (dir[1] > 0
        ? (CEIL - from[1] <= max ? { dist: CEIL - from[1], normal: [0, -1, 0] } : null)
        : (from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null)),
      raycastHit: () => ({ dist: Infinity, normal: null }),
    }),
  });
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 1, 0], null, { damage: 30, maxHealth: 40, fromPlayer: true, heavy: false, throw: [0, 0] });   // the top rung
  const ds = marks._pool().decals();
  const pool = ds.find((d) => d.pos[0] === 0 && d.pos[2] === 0 && d.normal[1] > 0);
  assert.ok(pool && pool.stretch === 1, 'the pool under the body is round');
  const spatter = ds.filter((d) => d !== pool);
  assert.ok(spatter.length > 4);
  for (const d of spatter) {
    const flown = Math.hypot(d.pos[0], d.pos[2]);
    assert.ok(d.stretch > 1, 'every flung drop is a streak');
    // laid ALONG the line from the body: right is the drop's own bearing (or its opposite, on a ceiling)
    const bearing = [d.pos[0] / flown, 0, d.pos[2] / flown];
    const dot = Math.abs(d.right[0] * bearing[0] + d.right[2] * bearing[2]);
    assert.ok(dot > 1 - 1e-6, `along its travel (${dot})`);
  }
  // the further it flew, the longer - monotone over the spray
  const sorted = [...spatter].sort((a, b) => Math.hypot(a.pos[0], a.pos[2]) - Math.hypot(b.pos[0], b.pos[2]));
  for (let k = 1; k < sorted.length; k++) assert.ok(sorted[k].stretch >= sorted[k - 1].stretch - 1e-9, 'longer the further it flew');
  assert.ok(sorted.at(-1).stretch > sorted[0].stretch, 'and not all the same');
  assert.ok(ds.some((d) => d.normal[1] < 0 && d.stretch > 1), 'the ceiling’s drops are streaks too');
});

// ── BLOOD2b (2026-09-21) - the port's own blood art, made at boot, and marks that dry ──
import {
  buildBloodAtlas, bloodAtlas, pickCell, bloodMarkKind, freshTint, freshShade, dryStage, driedTint, mulberry32,
  ATLAS_SIZE, ATLAS_CELLS, ATLAS_KINDS, BLOOD_BASE, FRESH_VARIANCE, DRIED_TINT, DRY_TIME, DRY_STAGES, DRY_TICK, BLOOD_ATLAS_ARCHIVE, BLOOD_ATLAS_RECORD,
} from '../src/combat/bloodArt.js';

test('BLOOD2b: the atlas is the kinds in four variants, every cell bordered so a soft sample cannot bleed, red, and the same picture on every boot', () => {
  const a = buildBloodAtlas();
  const cell = ATLAS_SIZE / ATLAS_CELLS;
  assert.equal(a.width, ATLAS_SIZE); assert.equal(a.height, cell * ATLAS_KINDS.length, 'BLOOD2d: one row a kind, the sheet as tall as it needs');
  assert.equal(a.cells.length, ATLAS_CELLS * ATLAS_KINDS.length);
  assert.deepEqual([...new Set(a.cells.map((c) => c.kind))], [...ATLAS_KINDS], 'the kinds, one row each');
  for (let k = 0; k < a.cells.length; k++) {
    const c = a.cells[k], col = k % ATLAS_CELLS, row = Math.floor(k / ATLAS_CELLS);
    // the uv rect is inset a texel inside the cell
    assert.ok(Math.abs(c.u0 - (col * cell + 1) / ATLAS_SIZE) < 1e-12 && Math.abs(c.u1 - (col * cell + cell - 1) / ATLAS_SIZE) < 1e-12);
    assert.ok(Math.abs(c.v0 - (row * cell + 1) / a.height) < 1e-12 && Math.abs(c.v1 - (row * cell + cell - 1) / a.height) < 1e-12);
    let opaque = 0, border = 0, ink = 0;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const o = ((row * cell + y) * ATLAS_SIZE + col * cell + x) * 4;
        const al = a.colors[o + 3];
        if (x < 2 || y < 2 || x >= cell - 2 || y >= cell - 2) { if (al !== 0) border++; continue; }
        if (al > 128) { opaque++; if (a.colors[o] === a.colors[o + 1] && a.colors[o + 1] === a.colors[o + 2] && a.colors[o] > 0) ink++; }
      }
    }
    assert.equal(border, 0, `${c.kind} ${col}: a clear two-texel border`);
    assert.ok(opaque > cell * cell * 0.05, `${c.kind} ${col}: a shape that is there`);
    assert.ok(opaque < cell * cell * 0.7, `${c.kind} ${col}: and room around it`);
    assert.equal(ink, opaque, `${c.kind} ${col}: every opaque texel is INK - grey, the colour is the tint's (BLOOD AUDIT 4)`);
  }
  // a pool is the broadest, a run the narrowest
  const cover = (kind) => { const k = a.cells.findIndex((c) => c.kind === kind); const col = k % ATLAS_CELLS, row = Math.floor(k / ATLAS_CELLS); let n = 0; for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (a.colors[((row * cell + y) * ATLAS_SIZE + col * cell + x) * 4 + 3] > 128) n++; return n; };
  assert.ok(cover('pool') > cover('spatter') && cover('spatter') > cover('drip'), 'pool broadest, run narrowest');
  assert.ok(cover('print') > cover('drip') && cover('print') < cover('pool'), 'BLOOD2d: a boot between them');
  // a print's toe is at +u: the right third holds more than the left
  { const k = a.cells.findIndex((c) => c.kind === 'print'); const col = k % ATLAS_CELLS, row = Math.floor(k / ATLAS_CELLS); let left = 0, right = 0; for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const al = a.colors[((row * cell + y) * ATLAS_SIZE + col * cell + x) * 4 + 3]; if (al > 128) { if (x < cell / 3) left++; else if (x > cell * 2 / 3) right++; } } assert.ok(right > left, 'the sole is heavier than the heel'); }
  // a streak's head is at -u and its tail at +u: the left third holds more than the right third
  { const k = a.cells.findIndex((c) => c.kind === 'streak'); const col = k % ATLAS_CELLS, row = Math.floor(k / ATLAS_CELLS); let left = 0, right = 0; for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const al = a.colors[((row * cell + y) * ATLAS_SIZE + col * cell + x) * 4 + 3]; if (al > 128) { if (x < cell / 3) left++; else if (x > cell * 2 / 3) right++; } } assert.ok(left > right, 'the head is heavier than the tail'); }
  // deterministic: the same seed, the same bytes; another seed, another picture
  assert.ok(Buffer.compare(Buffer.from(buildBloodAtlas().colors.buffer), Buffer.from(a.colors.buffer)) === 0, 'the same picture on every boot');
  assert.ok(Buffer.compare(Buffer.from(buildBloodAtlas({ seed: 7 }).colors.buffer), Buffer.from(a.colors.buffer)) !== 0);
  assert.equal(bloodAtlas(), bloodAtlas(), 'one atlas for the page');
  const r = mulberry32(1); assert.ok(r() !== r(), 'the generator moves');
  // the base is a red, deeper than the splash's own - and it is the
  // TINT'S now, not the texel's (BLOOD AUDIT 4)
  assert.ok(BLOOD_BASE[0] > 0.5 && BLOOD_BASE[1] < 0.1 && BLOOD_BASE[2] < 0.1);
  // no picture is shipped: the atlas is made, not read
  const art = readFileSync(new URL('../src/combat/bloodArt.js', import.meta.url), 'utf8');
  assert.ok(!/BLOOD_BASE\[\d\] \* shade/.test(art), 'the atlas is not painted the base');
  assert.ok(!/\.png|fetch\(|import .*\.png/.test(art), 'nothing loaded');
});

test('BLOOD2b: a mark wears a cell of its KIND, is born a fresh red of its own, and DRIES in bounded steps', () => {
  // the law
  assert.equal(bloodMarkKind({ pool: true, stretch: 3 }), 'pool');
  assert.equal(bloodMarkKind({ wall: true, stretch: 3 }), 'drip');
  assert.equal(bloodMarkKind({ stretch: 2 }), 'streak');
  assert.equal(bloodMarkKind({ stretch: 1.2 }), 'spatter');
  assert.equal(bloodMarkKind(), 'spatter');
  const a = buildBloodAtlas();
  for (const kind of ATLAS_KINDS) for (const v of [0, 0.5, 0.999]) assert.equal(pickCell(a, kind, () => v).kind, kind);
  assert.notEqual(pickCell(a, 'pool', () => 0), pickCell(a, 'pool', () => 0.999), 'variants');
  // BLOOD AUDIT 4: the tint IS the colour - fresh is the base by one
  // shade on all three channels, so the variance is never a hue
  const bright = freshTint(() => 0), dark = freshTint(() => 1);
  assert.deepEqual(bright, [...BLOOD_BASE, 1], 'fresh is the base');
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(dark[k] - BLOOD_BASE[k] * (1 - FRESH_VARIANCE)) < 1e-12, 'one factor on all three - a shade, not a hue');
  assert.ok(Math.abs(dark[1] / dark[0] - BLOOD_BASE[1] / BLOOD_BASE[0]) < 1e-12, 'the same G/R at every shade');
  assert.equal(freshShade(bright), 1); assert.ok(Math.abs(freshShade(dark) - (1 - FRESH_VARIANCE)) < 1e-12); assert.equal(freshShade([1, 1, 1, 1]), 1, 'a tint that is not a fresh roll is shade one');
  assert.equal(dryStage(0), 0); assert.equal(dryStage(-1), 0); assert.equal(dryStage(NaN), 0);
  assert.equal(dryStage(DRY_TIME), DRY_STAGES); assert.equal(dryStage(DRY_TIME * 10), DRY_STAGES, 'never past dried');
  for (let t = 0; t < DRY_TIME; t += 1) assert.ok(dryStage(t + 1) >= dryStage(t), 'monotone');
  assert.deepEqual(driedTint(bright, 0), bright);
  assert.deepEqual(driedTint(bright, DRY_STAGES), [...DRIED_TINT]);
  assert.deepEqual(driedTint([1, 1, 1, 1], DRY_STAGES), [...DRIED_TINT]);
  // BLOOD AUDIT 4: DRIED IS BROWNER, NOT BLACKER. The old tint was a
  // multiply over a red texel - it halved the brightness and RAISED the
  // saturation (G/R 0.082 fresh, 0.059 dried), a black-red on every mark
  // older than three minutes. A rust: green and blue up against red,
  // about as bright as fresh, every channel inside the curve.
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  assert.ok(DRIED_TINT[1] / DRIED_TINT[0] > 2 * BLOOD_BASE[1] / BLOOD_BASE[0] && DRIED_TINT[2] / DRIED_TINT[0] > 2 * BLOOD_BASE[2] / BLOOD_BASE[0], 'browner: green and blue up against red');
  assert.ok(lum(DRIED_TINT) > lum(BLOOD_BASE) * 0.8 && lum(DRIED_TINT) < lum(BLOOD_BASE) * 1.3, 'about as bright as fresh - not a black-red');
  assert.ok(DRIED_TINT.slice(0, 3).every((c) => c > 0 && c < 1) && DRIED_TINT[0] > DRIED_TINT[1] && DRIED_TINT[1] > DRIED_TINT[2], 'a rust, inside the curve');
  // a mark rolled darker dries darker: the shade is the mark's for life
  const dd = driedTint(dark, DRY_STAGES);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(dd[k] - DRIED_TINT[k] * (1 - FRESH_VARIANCE)) < 1e-12, 'dried at its own shade');
  const half = driedTint(dark, DRY_STAGES / 2);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(half[k] - (dark[k] + (dd[k] - dark[k]) * 0.5)) < 1e-12, 'halfway between its own two ends');

  // the pool: kinds, tints in the slot, drying rewrites bounded
  const CEIL = 2.2;
  const uploads = [];
  const writes = new Map();
  const renderer = {
    createDecalBatch: (capacity) => ({ capacity }),
    writeDecalSlot: (batch, slot, floats) => { for (let k = 0; k * DECAL_FLOATS < floats.length; k++) writes.set(slot + k, (writes.get(slot + k) ?? 0) + 1); return true; },   // BLOOD AUDIT 4: a run is its slots
    drawDecals: () => {},
    createBillboardBatch: () => ({}),
    moveBillboardBatch: () => true,
    destroyBillboardBatch: () => {},
    uploadTexture: (archive, record, img, opts) => { uploads.push({ archive, record, w: img.width, opts }); return { tex: `${archive}_${record}` }; },
  };
  const wallAt = 0.9;
  const { fx, marks } = rigHitEffects({
    renderer, texture: null, rng: mulberry32(3),   // a chance that MOVES - the rig's one-half would dress every mark alike
    settings: { enabled: () => true, capacity: () => 256, density: () => 1, overkill: () => false },
    collider: () => ({
      surfaceHit: (from, dir, max) => (dir[1] > 0
        ? (CEIL - from[1] <= max ? { dist: CEIL - from[1], normal: [0, -1, 0] } : null)
        : (from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null)),
      raycastHit: (from, dir, max) => { if (!(dir[0] > 0) || from[0] >= wallAt) return { dist: Infinity, normal: null }; const d = (wallAt - from[0]) / dir[0]; return d <= max ? { dist: d, normal: [-1, 0, 0] } : { dist: Infinity, normal: null }; },
    }),
  });
  assert.deepEqual(uploads, [], 'BLOOD AUDIT 5: the ring is built at boot, the atlas waits for the first mark');
  assert.deepEqual(marks.draw(), false, 'nothing yet');
  // the LADDER'S TOP: twenty-four drops over 1.8 m (an overkill's blow with
  // the burst row off), so drops land short of a third of the reach
  // (spatter), past it (streaks), and against the wall at 0.9
  fx.showBloodSplash(0, [0, 1, 0], null, { damage: 80, maxHealth: 40, fromPlayer: true, heavy: false, throw: [0, 0] });
  const ds = marks._pool().decals();
  assert.equal(ds.length, 24, 'the top rung, every drop landed somewhere');
  assert.deepEqual(uploads, [{ archive: BLOOD_ATLAS_ARCHIVE, record: BLOOD_ATLAS_RECORD, w: ATLAS_SIZE, opts: { smooth: true } }], 'the atlas, uploaded ONCE with the first mark, smooth');
  const pool = ds.find((d) => d.pos[0] === 0 && d.pos[2] === 0 && d.normal[1] > 0);
  assert.equal(pool.uv.kind, 'pool', 'the pool wears a pool');
  assert.ok(ds.some((d) => d.stretch > 1.5 && d.uv.kind === 'streak'), 'a drop that flew wears a streak');
  assert.ok(ds.filter((d) => d.normal[1] === 0).length > 0, 'some met the wall');
  assert.ok(ds.filter((d) => d.normal[1] === 0).every((d) => d.uv.kind === 'drip'), 'a wall’s mark wears a run');
  assert.ok(ds.filter((d) => d.normal[1] === 0).every((d) => Math.abs(d.up[1] - 1) < 1e-9), 'and its run hangs DOWN the wall - the basis’ up is world up');
  assert.ok(ds.some((d) => d.stretch <= 1.5 && d !== pool && d.normal[1] !== 0 && d.uv.kind === 'spatter'), 'the rest wear spatter');
  for (const d of ds) { assert.ok(d.tint[0] <= BLOOD_BASE[0] && d.tint[0] >= BLOOD_BASE[0] * (1 - FRESH_VARIANCE) - 1e-12, 'born fresh - the base by a shade'); assert.equal(d.stage, 0); assert.equal(d.born, 0); }
  assert.ok(new Set(ds.map((d) => d.tint[1].toFixed(4))).size > 1, 'each its own shade');
  // the slot carries the cell and the tint: write one and read the floats back
  const out = new Float32Array(DECAL_FLOATS);
  writeDecalQuad(out, 0, pool, pool.uv);
  assert.ok(Math.abs(out[3] - pool.uv.u0) < 1e-6 && Math.abs(out[4] - pool.uv.v0) < 1e-6, 'the first corner at the cell’s own corner');
  assert.ok(Math.abs(out[5] - pool.tint[0]) < 1e-6 && Math.abs(out[6] - pool.tint[1]) < 1e-6, 'the tint in the colour floats');

  // DRYING. Tick the pool through DRY_TIME and past it: every mark ends
  // at DRIED_TINT, its slot rewritten at most DRY_STAGES times beyond
  // its placing, and never again once dried.
  const placedWrites = new Map(writes);
  const step = 0.5;
  for (let t = 0; t < DRY_TIME + DRY_TICK * 2; t += step) fx.tick(step);
  for (const d of ds) {
    assert.equal(d.stage, DRY_STAGES, 'dried');
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(d.tint[k] - DRIED_TINT[k] * freshShade(d.fresh)) < 1e-9, 'to DRIED_TINT at its own shade, exactly');
    const extra = writes.get(d.slot) - placedWrites.get(d.slot);
    assert.ok(extra >= 1 && extra <= DRY_STAGES, `rewritten ${extra} times, bounded by the stages`);
  }
  const after = new Map(writes);
  for (let t = 0; t < 30; t += step) fx.tick(step);
  assert.deepEqual([...writes], [...after], 'dried is dried - no rewrite ever again');
  assert.ok(marks.clock() > DRY_TIME, 'the clock ran');
  // a fresh mark laid now is born at the clock, not at zero, and starts wet
  fx.showBloodSplash(0, [3, 1, 3], null, { damage: 10, maxHealth: 40 });
  const young = marks._pool().decals().filter((d) => d.stage === 0);
  assert.ok(young.length > 0 && young.every((d) => d.born > DRY_TIME), 'born now');
  // a recentre keeps the cell and the tint
  const before = young[0].uv;
  fx.offsetAll([819.2, 0, 0]);
  assert.equal(young[0].uv, before);
  // the switch off drops nothing here; dispose drops the atlas HANDLE alone (the renderer's cache owns the texture)
  marks.dispose();
  assert.equal(marks.draw(), false);
  // and the drying pass has a name of its own, for the next pin that wants to drive it
  assert.equal(typeof marks.dry, 'function');
});

// ── BLOOD2c (2026-09-21) - a wounded body bleeds, a dead one bleeds out ──
import {
  createBleedLedger, bleedShare, bleedDrops, poolSizeAt,
  BLEED_THRESHOLD, BLEED_WAIT, BLEED_DROPS_MAX, BLEED_RADIUS, BLEED_RATE, POOL_SIZE, POOL_SPREAD, POOL_STEPS,
} from '../src/combat/bloodBleed.js';
import { DRIP_FROM, BLEED_DROPS_CAP, MAX_SPREADS } from '../src/combat/bloodMarks.js';

test('BLOOD2c: the ledger - the reference’s ramp and cadence on a wounded body, one pool for a body with a corpse, nothing for the bloodless', () => {
  // the ramp: nothing at the threshold, everything at one percent
  assert.equal(bleedShare(20, 40), 0, 'at the threshold: nothing');
  assert.equal(bleedShare(40, 40), 0);
  assert.ok(Math.abs(bleedShare(0.4, 40) - 1) < 1e-9, 'one percent: everything');
  assert.ok(Math.abs(bleedShare(10, 40) - (1 - (0.25 - 0.01) / (0.5 - 0.01))) < 1e-12, 'the reference’s own arithmetic between');
  assert.equal(bleedShare(0, 40), 0, 'dead is not bleeding'); assert.equal(bleedShare(5, 0), 0); assert.equal(bleedShare(NaN, 40), 0);
  assert.equal(bleedDrops(0), 0); assert.equal(bleedDrops(0.01), 1, 'once bleeding, at least one'); assert.equal(bleedDrops(1), BLEED_DROPS_MAX);
  assert.equal(BLEED_THRESHOLD, 0.5); assert.deepEqual([BLEED_WAIT.min, BLEED_WAIT.max], [2, 5], 'the reference’s 2..5 s');
  // the pool's size: the start, steps, the end, and never past it
  assert.equal(poolSizeAt(0), POOL_SIZE.start); assert.equal(poolSizeAt(POOL_SPREAD), POOL_SIZE.end); assert.equal(poolSizeAt(POOL_SPREAD * 3), POOL_SIZE.end);
  assert.equal(new Set(Array.from({ length: 200 }, (_, k) => poolSizeAt(k * POOL_SPREAD / 199))).size, POOL_STEPS + 1, 'in steps');

  // the ledger, with the wait held at its floor
  const led = createBleedLedger({ rng: () => 0 });
  const view = (b) => b;
  const hurt = { feet: [1, 0, 1], health: 10, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  const well = { feet: [2, 0, 2], health: 30, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  const bone = { feet: [3, 0, 3], health: 1, maxHealth: 40, bloodIndex: 2, dead: false, corpse: false };
  assert.deepEqual(led.tick(1, [hurt, well, bone], view), [], 'the first second: the wait is not up');
  const a = led.tick(1.01, [hurt, well, bone], view);
  assert.equal(a.length, 1, 'two seconds in: the wounded one drips, the well one and the skeleton do not');
  assert.equal(a[0].kind, 'drip'); assert.equal(a[0].body, hurt); assert.deepEqual(a[0].pos, [1, 0, 1]);
  assert.equal(a[0].count, bleedDrops(bleedShare(10, 40)));
  assert.deepEqual(led.tick(1.5, [hurt], view), [], 'and waits again');
  assert.equal(led.tick(0.6, [hurt], view).length, 1, 'the next, at the cadence');
  // healed past the threshold: the wait is FRESH when it is wounded again -
  // most of a wait spent, then healed, then wounded: the old remainder
  // (half a second) would drip at once; a fresh wait (two) does not
  led.tick(1.5, [hurt], view);
  hurt.health = 30; led.tick(0.1, [hurt], view);
  hurt.health = 10;
  assert.deepEqual(led.tick(1.9, [hurt], view), [], 'a fresh wait, not the old remainder');
  assert.equal(led.tick(0.2, [hurt], view).length, 1);
  // a walking foe drips where it IS (BLOOD AUDIT 4: and its walk lays
  // steps of its own along the way, held by the BLOOD2d pin - here the
  // drips are read past them)
  const noSteps = (acts) => acts.filter((x) => x.kind !== 'step');
  hurt.feet = [5, 0, 5]; assert.deepEqual(noSteps(led.tick(1.9, [hurt], view)), []);
  assert.deepEqual(noSteps(led.tick(0.2, [hurt], view))[0].pos, [5, 0, 5]);
  // death: one pool, with a corpse, never a drip again
  hurt.dead = true; hurt.corpse = true;
  const d1 = led.tick(0.1, [hurt], view);
  assert.deepEqual(d1.map((x) => x.kind), ['pool']); assert.deepEqual(d1[0].pos, [5, 0, 5]);
  assert.deepEqual(led.tick(10, [hurt], view), [], 'once');
  // (seen alive first - BLOOD AUDIT 4 makes a body FIRST met dead one that has already bled out, which would hide this law)
  const gone = { feet: [0, 0, 0], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  led.tick(0.1, [gone], view);
  gone.dead = true; gone.health = 0;
  assert.deepEqual(led.tick(1, [gone], view), [], 'dead with no body (removed, walked away): no pool');
  bone.dead = true; bone.corpse = true;
  assert.deepEqual(led.tick(1, [bone], view), [], 'a skeleton has nothing to bleed out');
  assert.deepEqual(led.tick(0, [hurt], view), []); assert.deepEqual(led.tick(1, null, view), []);
  // the wait really is random within the band
  const spread = createBleedLedger({ rng: () => 1 });
  const slow = { feet: [0, 0, 0], health: 1, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  assert.deepEqual(spread.tick(4.9, [slow], view), []); assert.equal(spread.tick(0.2, [slow], view).length, 1, 'at the top of the band, five seconds');
});

test('BLOOD2c: the pool lays a drip at the feet and a corpse’s pool that spreads in steps; the splash pool maps the ledger onto it; the three foe pools hand their bodies over', () => {
  const writes = new Map();
  const renderer = {
    createDecalBatch: (capacity) => ({ capacity }),
    writeDecalSlot: (batch, slot, floats) => { for (let k = 0; k * DECAL_FLOATS < floats.length; k++) writes.set(slot + k, (writes.get(slot + k) ?? 0) + 1); return true; },   // BLOOD AUDIT 4: a run is its slots
    drawDecals: () => {}, createBillboardBatch: () => ({}), moveBillboardBatch: () => true, destroyBillboardBatch: () => {},
  };
  const rays = [];
  const { fx, marks } = rigHitEffects({
    renderer,
    settings: { enabled: () => true, capacity: () => 64, density: () => 1, overkill: () => false },
    collider: () => ({ surfaceHit: (from, dir, max) => { rays.push([...from]); return dir[1] < 0 && from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null; }, raycastHit: () => ({ dist: Infinity, normal: null }) }),
  });
  marks.useArt(380, 1, 6);
  // THE DRIP: `count` small drops within the radius, from KNEE height
  // (a foe on a stair stains its step), the ladder's smallest size
  rays.length = 0;
  const d = marks.drip(0, [2, 0, 2], 3);
  assert.ok(d, 'the drip landed');
  assert.ok(rays.length >= 3 && rays.every((r) => Math.abs(r[1] - (0 + DRIP_FROM)) < 1e-9), 'every ray from knee height, not the chest');
  const ds = marks._pool().decals();
  assert.equal(ds.length, 3, 'three drops');
  for (const m of ds) {
    assert.ok(Math.hypot(m.pos[0] - 2, m.pos[2] - 2) <= BLEED_RADIUS + 1e-9, 'within the radius of the feet');
    assert.ok(m.size <= markSize(BLEED_RATE) * 1.01 + SIZE_JITTER, 'small');
  }
  assert.equal(marks.drip(2, [2, 0, 2], 3), null, 'a skeleton drips nothing');
  marks.drip(0, [2, 0, 2], 100);
  assert.equal(marks._pool().decals().length - 3, BLEED_DROPS_CAP, 'capped - and every drop of a drip lands on the FLOOR: gravity’s blood never looks up for a ceiling');
  assert.equal(DRIP_FROM, 0.5, 'knee height');
  // THE POOL: laid at the feet as a pool, grows in steps to the end, then stops
  writes.clear();
  const p = marks.spreadPool(0, [4, 0, 4]);
  assert.ok(p && p.uv.kind === 'pool' && p.size === POOL_SIZE.start, 'a pool, at its start size');
  assert.equal(marks.spreads().length, 1);
  const slotWrites = () => writes.get(p.slot) ?? 0;
  const atPlace = slotWrites();
  for (let t = 0; t < POOL_SPREAD + 1; t += 0.25) fx.tick(0.25);
  assert.equal(p.size, POOL_SIZE.end, 'spread to its end');
  assert.equal(slotWrites() - atPlace, POOL_STEPS, 'in exactly the steps');
  assert.equal(marks.spreads().length, 0, 'and done');
  const after = slotWrites();
  fx.tick(5);
  assert.equal(slotWrites(), after, 'never again');
  assert.equal(marks.spreadPool(2, [4, 0, 4]), null, 'no pool for the bloodless');
  // a slot the ring reuses under a spreading pool ends that spread
  const q = marks.spreadPool(0, [6, 0, 6]);
  for (let k = 0; k < 70; k++) marks.drip(0, [8, 0, 8], 1);   // the ring wraps
  fx.tick(1);
  assert.ok(!marks.spreads().some((x) => x.d === q), 'a reused slot is not rewritten as a pool');
  // bounded
  for (let k = 0; k < MAX_SPREADS + 5; k++) marks.spreadPool(0, [k, 0, 0]);
  assert.ok(marks.spreads().length <= MAX_SPREADS);
  // a mode change takes the spreads with the room
  fx.clear();
  assert.equal(marks.spreads().length, 0);

  // THE SPLASH POOL MAPS THE LEDGER: a wounded body drips, a dead one pools
  const hurt = { feet: [1, 0, 1], health: 5, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  assert.equal(fx.bleed(3.4, [hurt], (b) => b), 0, 'the rig’s chance of one half holds the wait at three and a half: not yet');
  assert.equal(fx.bleed(0.2, [hurt], (b) => b), 1, 'one drip');
  assert.ok(marks.count() > 0);
  hurt.dead = true; hurt.corpse = true;
  assert.equal(fx.bleed(0.1, [hurt], (b) => b), 1, 'one pool');
  assert.equal(marks.spreads().length, 1);

  // THE HOSTS: every foe pool hands its bodies to the ledger every frame,
  // through a view that names the six fields, and the dungeon's kill
  // paths mark the body a corpse
  const read = (q) => readFileSync(new URL(`../${q}`, import.meta.url), 'utf8');
  const VIEW = /\(\w\) => \(\{ feet: \w\.ai\?\.feet, health: \w\.entity\?\.health, maxHealth: \w\.entity\?\.maxHealth, bloodIndex: ENEMY_BASICS\[[\w.]+\]\?\.bloodIndex \?\? 0, dead: !!\w\.dead, corpse: !!\w\.corpse \}\)/;
  for (const [f, call] of [
    ['src/scenes/exteriorFoes.js', /hitEffects\?\.bleed\?\.\(dt, foes, foeBleedView\);/],
    ['src/scenes/dungeonContext.js', /hitEffects\.bleed\(dt, foes, foeBleedView\);/],
    ['src/scenes/cityGuards.js', /hitEffects\?\.bleed\?\.\(dt, guards, guardBleedView\);/],
  ]) {
    const src = read(f);
    assert.match(src, call, `${f}: hands its bodies over`);
    assert.match(src, VIEW, `${f}: through the six-field view`);
  }
  const dc = read('src/scenes/dungeonContext.js');
  // the dungeon's body flag rides the ONE corpse mint (both the kill's
  // door and the stream's reach it) and is cleared with the corpse, so a
  // resurrected or respawned foe starts clean and a quest-removed one
  // never has it
  assert.match(dc, /async function spawnCorpseNow\(f\) \{\n\s*f\.corpse = true;/, 'a minted corpse is a body');
  assert.match(dc, /function freeCorpse\(f\) \{\n\s*f\.corpse = false;/, 'a freed one is not');
  assert.doesNotMatch(dc.slice(dc.indexOf('removeFoe: (f) => {'), dc.indexOf('removeFoe: (f) => {') + 400), /corpse = true/, 'a quest-removed foe has none');
  const fxSrc = read('src/scenes/hitEffects.js');
  assert.match(fxSrc, /const bleeding = createBleedLedger\(\{ rng \}\);/);
  assert.match(fxSrc, /if \(a\.kind === 'drip'\) \{ if \(marks\.drip\?\.\(a\.bloodIndex, a\.pos, a\.count\)\) n\+\+; \}/);
  assert.match(fxSrc, /else if \(a\.kind === 'pool'\) \{ if \(marks\.spreadPool\?\.\(a\.bloodIndex, a\.pos\)\) n\+\+; \}/);
});

// ── BLOOD2d (2026-09-21) - tracked blood: a walker who treads in it leaves prints ──
import { STRIDE } from '../src/combat/bloodBleed.js';
import { TRACK_STEPS, TRACK_WET_STAGE, PRINT_SIZE, PRINT_SPREAD } from '../src/combat/bloodMarks.js';
import { PLAYER_WALKER } from '../src/scenes/hitEffects.js';

test('BLOOD2d: treading in wet blood tracks it - alternating prints along the walk, fainter each step, none from dried blood or from a print', () => {
  const { fx, marks } = rigHitEffects({
    settings: { enabled: () => true, capacity: () => 128, density: () => 1, overkill: () => false },
    collider: () => ({ surfaceHit: (from, dir, max) => (dir[1] < 0 && from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null), raycastHit: () => ({ dist: Infinity, normal: null }) }),
  });
  marks.useArt(380, 1, 6);
  const me = PLAYER_WALKER;
  // a pool under the body, and a step a metre off it: nothing
  fx.showBloodSplash(0, [0, 1.7, 0], null, { damage: 10, maxHealth: 40 });
  const before = marks.count();
  assert.equal(fx.footfall([3, 1.7, 3], [0, 0, 1]), null, 'a clean foot prints nothing');
  assert.equal(marks.tracked(me), 0);
  // a step IN the pool: the foot picks it up, and nothing is printed over the pool
  assert.equal(fx.footfall([0, 1.7, 0], [0, 0, 1]), null);
  assert.equal(marks.tracked(me), TRACK_STEPS, 'blood on the feet');
  assert.equal(marks.count(), before);
  // the next steps, walking +z: a print each, alternating feet about the line, fading, along the walk
  const prints = [];
  for (let k = 1; k <= TRACK_STEPS + 2; k++) {
    const d = fx.footfall([0, 1.7, 2 + k * 0.7], [0, 0, 1]);
    if (d) prints.push(d);
  }
  assert.equal(prints.length, TRACK_STEPS, 'exactly TRACK_STEPS prints, then a clean foot again');
  assert.equal(marks.tracked(me), 0);
  for (let k = 0; k < prints.length; k++) {
    const d = prints[k];
    assert.equal(d.uv.kind, 'print', 'wears the boot');
    assert.equal(d.size, PRINT_SIZE); assert.equal(d.stretch, 1);
    assert.ok(Math.abs(d.right[2] - 1) < 1e-9, 'the toe points the way the walker went');
    assert.ok(Math.abs(Math.abs(d.pos[0]) - PRINT_SPREAD) < 1e-9, 'a foot’s width off the line');
    if (k > 0) assert.ok(Math.sign(d.pos[0]) !== Math.sign(prints[k - 1].pos[0]), 'left, right, left');
    assert.ok(Math.abs(d.tint[3] - (TRACK_STEPS - k) / TRACK_STEPS) < 1e-9, 'fainter each step');
    assert.equal(d.fresh[3], d.tint[3], 'and drying keeps the fade');
  }
  // a print is never a trigger: stepping on one picks nothing up
  assert.equal(fx.footfall([prints[0].pos[0], 1.7, prints[0].pos[2]], [0, 0, 1]), null);
  assert.equal(marks.tracked(me), 0, 'a print is not wet blood');
  // dried blood is not wet blood either
  for (let t = 0; t < 200; t += 1) fx.tick(1);   // well past TRACK_WET_STAGE
  assert.ok(marks._pool().decals().every((d) => d.stage > TRACK_WET_STAGE));
  assert.equal(fx.footfall([0, 1.7, 0], [0, 0, 1]), null);
  assert.equal(marks.tracked(me), 0, 'dried blood does not track');
  // treading in it again while carrying refreshes rather than prints
  fx.showBloodSplash(0, [10, 1.7, 10], null, { damage: 10, maxHealth: 40 });
  fx.footfall([10, 1.7, 10], [1, 0, 0]);
  fx.footfall([11, 1.7, 10], [1, 0, 0]); fx.footfall([12, 1.7, 10], [1, 0, 0]);
  assert.equal(marks.tracked(me), TRACK_STEPS - 2);
  assert.equal(fx.footfall([10, 1.7, 10], [1, 0, 0]), null);
  assert.equal(marks.tracked(me), TRACK_STEPS, 'refreshed');
  // no forward: a print still lands, un-turned
  assert.ok(fx.footfall([14, 1.7, 10], null));

  // A FOE'S STEPS come off the ground it covers, one every STRIDE, and
  // track the same way through the ledger
  // (a 10-of-40 hit's pool is MARK_SIZE_MIN wide - 0.35 - so the stride
  // that picks it up has to END in it, not start there)
  const foe = { feet: [10 - STRIDE, 0, 10], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  fx.bleed(0.1, [foe], (b) => b);                    // seen; a stride short of the pool
  foe.feet = [10 + 0.01, 0, 10]; fx.bleed(0.1, [foe], (b) => b);   // one stride: a step, in the pool - picked up
  assert.equal(marks.tracked(foe), TRACK_STEPS, 'the foe has blood on its feet');
  const n0 = marks.count();
  foe.feet = [10 + STRIDE + 0.02, 0, 10]; fx.bleed(0.1, [foe], (b) => b);
  assert.equal(marks.count(), n0 + 1, 'and prints on its next stride');
  foe.feet = [10 + STRIDE + 0.1, 0, 10]; fx.bleed(0.1, [foe], (b) => b);
  assert.equal(marks.count(), n0 + 1, 'a shuffle short of a stride is no step');
  foe.feet = [200, 0, 200]; fx.bleed(0.1, [foe], (b) => b);
  assert.equal(marks.count(), n0 + 1, 'a teleport is not a walk');

  // the hosts: every footstep machine's step reaches the pool that holds this mode's marks
  const read = (q) => readFileSync(new URL(`../${q}`, import.meta.url), 'utf8');
  for (const [f, line] of [
    ['src/scenes/world.js', /if \(_step\) hitEffects\?\.footfall\?\.\(player\.pos, \[Math\.sin\(cam\.yaw\), 0, Math\.cos\(cam\.yaw\)\]\);/],
    ['src/scenes/exterior.js', /if \(_step\) hitEffects\?\.footfall\?\.\(player\.pos, \[Math\.sin\(cam\.yaw\), 0, Math\.cos\(cam\.yaw\)\]\);/],
    ['src/scenes/dungeon.js', /if \(_step\) ctx\.hitEffects\?\.footfall\?\.\(player\.pos, \[Math\.sin\(cam\.yaw\), 0, Math\.cos\(cam\.yaw\)\]\);/],
    ['src/scenes/worldModes.js', /if \(_step\) \(mode === 'dungeon' \? dungeonCtx\?\.hitEffects : interiorHitEffects\)\?\.footfall\?\.\(player\.pos, \[Math\.sin\(cam\.yaw\), 0, Math\.cos\(cam\.yaw\)\]\);/],
  ]) {
    const src = read(f);
    assert.match(src, line, `${f}: the footfall`);
    const at = src.search(line);
    assert.ok(src.slice(at, at + 400).includes('if (_step && classicFootstepAllowed(_step.clip))'), `${f}: beside the step that plays`);
  }
  assert.match(read('src/scenes/hitEffects.js'), /footfall: \(pos, forward = null\) => marks\?\.step\?\.\(PLAYER_WALKER, pos, forward\) \?\? null,/);
  assert.match(read('src/scenes/hitEffects.js'), /else if \(a\.kind === 'step'\) \{ if \(marks\.step\?\.\(a\.body, a\.pos, a\.forward\)\) n\+\+; \}/);
});

// ── MAC-BUG W5 (2026-09-20, Mac: "Also blood doesn't work outside")
//
// EVERY STUB IN THIS FILE ANSWERS A FLOOR, and one of them calls
// itself "an outdoor fight". That is the indoor collider: indoors and
// underground a floor is a MESH, registered with `addMesh` and found
// by `raycastHit`, which walks the triangle buckets and nothing else.
//
// Outside there is no such mesh. The world host's ground is its
// terrain sampler and the exterior host's is a flat constant, both
// handed to `new Collider(heightAt)` and applied to the CAPSULE
// alone - so a drop cast straight down met nothing, and nothing is
// the right answer for spatter thrown off a walkway. The pool under
// the body took that same silent arm, at every hit, outdoors, always.
//
// So these pins use a REAL Collider, built the way the two outdoor
// hosts build theirs, because that is the one thing a stub cannot
// misrepresent.
import { Collider } from '../src/player/collider.js';
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

test('MAC-BUG W5: the ground outside is heightAt, and surfaceHit is the ray that knows it', () => {
  // exterior.js:508 - `new Collider(() => GROUND_OFFSET * 0.025)`,
  // and not one triangle under the player's feet.
  const outside = new Collider(() => 0);
  assert.equal(outside.raycastHit([0, 2, 0], [0, -1, 0], 8).dist, Infinity,
    'the bucket ray finds nothing outdoors - which is TRUE, and was read as "no surface"');
  const h = outside.surfaceHit([0, 2, 0], [0, -1, 0], 8);
  assert.ok(Number.isFinite(h.dist), 'the ground is a surface');
  assert.ok(Math.abs(h.dist - 2) < 1e-9, 'two units down to a floor at y=0');
  assert.deepEqual(h.normal, [0, 1, 0], 'flat ground stands up');

  // ...and out of reach is still out of reach, so spatter thrown off a
  // walkway falls into the dark exactly as it did
  assert.equal(outside.surfaceHit([0, 50, 0], [0, -1, 0], 8).dist, Infinity);
  // UP is untouched: a sky is not a ceiling, and the floor is only
  // ever met on the way down
  assert.equal(outside.surfaceHit([0, 2, 0], [0, 1, 0], 8).dist, Infinity);
  // ...and that has to be said about the ray's DIRECTION and not about
  // the arithmetic, because a ray cast upward from BELOW the ground
  // would otherwise solve to a positive distance and stick blood to
  // the underside of the world.
  assert.equal(outside.surfaceHit([0, -3, 0], [0, 1, 0], 8).dist, Infinity,
    'no surface overhead when the "surface" is the ground you are under');
  assert.equal(outside.surfaceHit([0, -3, 0], [0, 1, 0], 8).normal, null);

  // A DUNGEON IS UNCHANGED. dungeonContext.js:265 hands `-Infinity`,
  // so there is no floor to find and the answer is the bucket ray's,
  // byte for byte - which is what keeps this a second door rather
  // than a change to the first.
  const under = new Collider(() => -Infinity);
  assert.deepEqual(under.surfaceHit([0, 2, 0], [0, -1, 0], 8), under.raycastHit([0, 2, 0], [0, -1, 0], 8));
});

test('MAC-BUG W5: nearer wins, so a walkway over a valley still catches what lands on it', () => {
  // a mesh ONE unit down, over ground FIVE units down
  const c = new Collider(() => -5);
  c.addMesh('walkway',
    [-4, -1, -4, 4, -1, -4, 4, -1, 4, -4, -1, 4],
    [0, 1, 2, 0, 2, 3], IDENTITY);
  const on = c.surfaceHit([0, 0, 0], [0, -1, 0], 10);
  assert.ok(Math.abs(on.dist - 1) < 1e-6, 'the plank is nearer than the valley floor');
  assert.equal(on.key, 'walkway', 'and it is the plank that answers');
  // step off the edge and the ground catches it instead
  const off = c.surfaceHit([9, 0, 9], [0, -1, 0], 10);
  assert.ok(Math.abs(off.dist - 5) < 1e-6, 'past the plank, the valley floor');
  assert.equal(off.key, null, 'which is the ground, not a bucket');
});

test('MAC-BUG W5: a hillside is a surface, so the mark lies on the slope', () => {
  // a ramp that falls one unit for every two along x
  const hill = new Collider((x) => -x / 2);
  const n = hill.groundNormal(0, 0);
  assert.ok(Math.abs(Math.hypot(n[0], n[1], n[2]) - 1) < 1e-9, 'a unit normal');
  assert.ok(n[0] > 0, 'the ground falls towards +x, so its normal leans back towards -x... ');
  assert.ok(Math.abs(n[0] - 0.5 / Math.hypot(0.5, 1, 0)) < 1e-9, '...by exactly the gradient');
  assert.ok(n[1] > 0, 'and it still points up');
  // the same slope reaches the hit
  assert.deepEqual(hill.surfaceHit([0, 3, 0], [0, -1, 0], 8).normal, n);
  // flat ground costs the four lookups and answers straight up
  assert.deepEqual(new Collider(() => 7).groundNormal(3, 4), [0, 1, 0]);
  // and a sampler that runs off what is streamed does not produce a
  // NaN normal for a decal to be built on. BOTH shapes of "off the
  // edge": a NaN, and the -Infinity that means "no floor here" -
  // which is the one that matters, because Infinity/Infinity is NaN
  // and a NaN normal is a decal with no orientation at all.
  assert.deepEqual(new Collider(() => NaN).groundNormal(0, 0), [0, 1, 0]);
  const edge = new Collider((x) => (x > 0 ? -Infinity : 0));
  assert.deepEqual(edge.groundNormal(0, 0), [0, 1, 0], 'half a sample off the streamed edge is flat, not NaN');
  for (const v of edge.groundNormal(0, 0)) assert.ok(Number.isFinite(v));
});

test('MAC-BUG W5: and the blood really lands - the whole ladder, on an outdoor collider', () => {
  const outside = new Collider(() => 0);
  const { fx, marks, wrote } = rigHitEffects({
    collider: () => outside,
    settings: { enabled: () => true, capacity: () => 64, density: () => 1, overkill: () => true },
  });
  // a foe bleeding at head height on open ground - the exact event
  // that has marked nothing since BLOOD1a shipped
  fx.showBloodSplash(0, [10, 1.2, 10], null, { damage: 10, maxHealth: 40 });
  assert.ok(marks.count() > 0, 'blood outside leaves a mark');
  assert.ok(wrote.length > 0, 'and a slot is written for each that landed');
  // every drop that landed is ON THE GROUND, not hanging at the
  // height the foe was hit at
  for (const w of wrote) {
    const y = w.floats[1];
    assert.ok(Math.abs(y) < 0.5, `a drop settled at y=${y}, which is the ground and not the wound`);
  }
  // run it against the ray that caused the report and it marks nothing
  const { fx: old, marks: oldMarks } = rigHitEffects({
    collider: () => ({ surfaceHit: (from, dir, max) => outside.raycastHit(from, dir, max) }),
    settings: { enabled: () => true, capacity: () => 64, density: () => 1, overkill: () => true },
  });
  old.showBloodSplash(0, [10, 1.2, 10], null, { damage: 10, maxHealth: 40 });
  assert.equal(oldMarks.count(), 0, 'the bucket ray alone is the bug, reproduced');
});

// ── BLOOD AUDIT 4 (2026-09-21, Mac: "I just want to audit everything so
// far before we continue") - four lenses over BLOOD2a..2d, every finding
// verified here before it was paid (bible/05-Combat/Blood-Arc.md item 8).
import { createBleedLedger as a4Ledger, TELEPORT_SPEED as A4_TELEPORT, BLEED_RATE as A4_BLEED_RATE, POOL_SPREAD as A4_POOL_SPREAD } from '../src/combat/bloodBleed.js';
import { GIB_SPLASH_RATE as A4_GIB_RATE } from '../src/combat/bloodGibs.js';
import { BLOOD_BASE as A4_BASE, FRESH_VARIANCE as A4_VAR, DRY_TIME as A4_DRY_TIME, DRY_TICK as A4_DRY_TICK, DRY_STAGES as A4_DRY_STAGES, mulberry32 as a4Rng } from '../src/combat/bloodArt.js';

const a4Floor = () => ({ surfaceHit: (from, dir, max) => (dir[1] < 0 && from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null), raycastHit: () => ({ dist: Infinity, normal: null }) });
const a4Settings = { enabled: () => true, capacity: () => 64, density: () => 1, overkill: () => false };
const a4Read = (q) => readFileSync(new URL(`../${q}`, import.meta.url), 'utf8');

test('BLOOD AUDIT 4: a walker’s step rays from the KNEE - prints land on a mesh floor and on twisted terrain, where they never did', () => {
  // THE DUNGEON: a mesh floor at y=0 and the walker's feet ON it (the
  // motor clamps the feet to the floor). A ray that starts on the
  // triangle never meets it - the walk refuses a hit inside its own
  // epsilon - which is the whole bug: no print ever landed indoors.
  const under = new Collider(() => -Infinity);
  under.addMesh('floor', [-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20], [0, 1, 2, 0, 2, 3], IDENTITY);
  assert.equal(under.surfaceHit([0, 0, 0], [0, -1, 0], MARK_DROP).dist, Infinity, 'from the feet: nothing (the bug)');
  assert.ok(Math.abs(under.surfaceHit([0, DRIP_FROM, 0], [0, -1, 0], MARK_DROP).dist - DRIP_FROM) < 1e-9, 'from the knee: the floor');
  const rig = (collider) => rigHitEffects({ collider: () => collider, settings: a4Settings });
  const { fx, marks } = rig(under);
  marks.useArt(380, 1, 6);
  assert.ok(marks.spreadPool(0, [0, 0, 0]), 'the corpse’s pool lands - it always rayed from the knee');
  assert.equal(fx.footfall([0, 0, 0], [0, 0, 1]), null);
  assert.equal(marks.tracked(PLAYER_WALKER), TRACK_STEPS, 'the foot ON the floor picks the blood up');
  const print = fx.footfall([0, 0, 1], [0, 0, 1]);
  assert.ok(print && print.uv.kind === 'print', 'and prints on the mesh');
  assert.ok(Math.abs(print.pos[1] - SURFACE_LIFT) < 1e-6, 'on the floor, lifted its two centimetres');
  // THE WORLD: the capsule stands on the bilinear floor (heightAt) and
  // the DRAWN triangle (surfaceAt) sits four centimetres above it, as
  // it does on every quad of positive twist - so from the feet the
  // drawn ground was behind the ray and the print was dropped
  const twisted = new Collider(() => 0, () => 0.04);
  assert.equal(twisted.surfaceHit([0, 0, 0], [0, -1, 0], MARK_DROP).dist, Infinity, 'from the feet: the drawn ground is behind the ray');
  const w = rig(twisted);
  w.marks.useArt(380, 1, 6);
  assert.ok(w.marks.spreadPool(0, [5, 0, 5]));
  w.fx.footfall([5, 0, 5], [1, 0, 0]);
  assert.equal(w.marks.tracked(PLAYER_WALKER), TRACK_STEPS);
  const p2 = w.fx.footfall([6, 0, 5], [1, 0, 0]);
  assert.ok(p2, 'a print on the twisted quad');
  assert.ok(Math.abs(p2.pos[1] - (0.04 + SURFACE_LIFT)) < 1e-6, 'on the DRAWN ground');
  // ...and a foe's stride through the ledger lands the same way
  const foe = { feet: [5, 0, 5 + STRIDE + 0.01], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  w.fx.bleed(0.1, [foe], (b) => b);
  foe.feet = [5, 0, 5]; w.fx.bleed(0.1, [foe], (b) => b);   // one stride, ending a centimetre into the pool
  assert.equal(w.marks.tracked(foe), TRACK_STEPS, 'the foe’s stride, from its feet on the floor, picks it up');
  // by source: the knee, as the drip and the pool
  const mk = a4Read('src/combat/bloodMarks.js');
  const stepSrc = mk.slice(mk.indexOf('  function step(walker, pos, forward = null) {'), mk.indexOf('\n  }\n', mk.indexOf('  function step(walker, pos, forward = null) {')));
  assert.match(stepSrc, /const h = col\.surfaceHit\(\[pos\[0\], pos\[1\] \+ DRIP_FROM, pos\[2\]\], DOWN, MARK_DROP\);/);
  assert.match(stepSrc, /const foot = \[pos\[0\], pos\[1\] \+ DRIP_FROM - h\.dist, pos\[2\]\];/);
});

test('BLOOD AUDIT 4: the room thrown away takes the blood on everyone’s boots and the ledger’s memory with it', () => {
  const { fx, marks } = rigHitEffects({ collider: a4Floor, settings: a4Settings });
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 1.7, 0], null, { damage: 10, maxHealth: 40 });
  fx.footfall([0, 1.7, 0], [0, 0, 1]);
  assert.equal(marks.tracked(PLAYER_WALKER), TRACK_STEPS);
  fx.clear();   // the door
  assert.equal(marks.tracked(PLAYER_WALKER), 0, 'clean boots in the next room');
  assert.equal(fx.footfall([3, 1.7, 3], [0, 0, 1]), null, 'no print on a floor never bled on');
  // the ledger: a body that pooled in the old room and is met again
  // after the door is a body first seen - dead, so it has bled out
  // elsewhere and lays no pool here
  const view = (b) => b;
  const foe = { feet: [1, 0, 1], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  fx.bleed(0.1, [foe], view);
  foe.dead = true; foe.corpse = true; foe.health = 0;
  const before = marks.count();
  fx.bleed(0.1, [foe], view);
  assert.equal(marks.count(), before + 1, 'it pooled');
  fx.clear();
  assert.equal(marks.count(), 0);
  fx.bleed(0.1, [foe], view);
  assert.equal(marks.count(), 0, 'met dead after the clear: no second pool');
  assert.match(a4Read('src/scenes/hitEffects.js'), /marks\?\.clear\?\.\(\);.*\n\s*bleeding\.clear\(\);/, 'the ledger clears on the same call');
});

test('BLOOD AUDIT 4: the ledger - alive again is a new life, a body met dead has bled out, feet nowhere skip the frame, a teleport is a SPEED, and the steps come off the ground covered', () => {
  const led = a4Ledger({ rng: () => 0 });
  const v = (b) => b;
  const kinds = (acts) => acts.map((a) => a.kind);
  const steps = (acts) => acts.filter((a) => a.kind === 'step');
  // alive again: the load's rewind and the stream's un-death reuse the record
  const b = { feet: [0, 0, 0], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  led.tick(0.1, [b], v);
  b.dead = true; b.corpse = true; b.health = 0;
  assert.deepEqual(kinds(led.tick(0.1, [b], v)), ['pool']);
  assert.deepEqual(kinds(led.tick(0.1, [b], v)), [], 'once');
  b.dead = false; b.corpse = false; b.health = 40;
  led.tick(0.1, [b], v);
  b.dead = true; b.corpse = true; b.health = 0;
  assert.deepEqual(kinds(led.tick(0.1, [b], v)), ['pool'], 'killed again, it pools again');
  // met dead: a restored corpse, a re-entered room, a peer's kill before this ledger was born
  const old = { feet: [1, 0, 1], health: 0, maxHealth: 40, bloodIndex: 0, dead: true, corpse: true };
  assert.deepEqual(led.tick(1, [old], v), []);
  assert.deepEqual(led.tick(1, [old], v), [], 'and never');
  // feet nowhere on the death frame: the frame is skipped, the pool kept for the frame the feet are somewhere
  const lost = { feet: [2, 0, 2], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  led.tick(0.1, [lost], v);
  lost.dead = true; lost.corpse = true; lost.health = 0; lost.feet = [NaN, 0, 2];
  assert.deepEqual(led.tick(0.1, [lost], v), [], 'nowhere: nothing this frame');
  lost.feet = [2, 0, 2];
  assert.deepEqual(kinds(led.tick(0.1, [lost], v)), ['pool'], 'somewhere: the pool, not burnt');
  // A TELEPORT IS A SPEED. Six metres in one second at one frame a
  // second is a walk (6 m/s) - the old law read it as a teleport and
  // erased the trail on every hitch - and it lays the steps the ground
  // holds, ALONG the run, where the feet passed
  const run = { feet: [0, 0, 0], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  led.tick(1, [run], v);
  run.feet = [6.05, 0, 0];
  const one = steps(led.tick(1, [run], v));
  assert.equal(one.length, Math.floor(6.05 / STRIDE), 'one step a stride along the run');
  for (let k = 0; k < one.length; k++) {
    assert.ok(Math.abs(one[k].pos[0] - (k + 1) * STRIDE) < 1e-9, 'where the feet passed, not where they stopped');
    assert.deepEqual(one[k].forward, [1, 0, 0]);
  }
  // the same walk at sixty frames: the same steps
  const sixty = { feet: [0, 0, 0], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false };
  led.tick(1 / 60, [sixty], v);
  let n60 = 0;
  for (let k = 1; k <= 60; k++) { sixty.feet = [6.05 * k / 60, 0, 0]; n60 += steps(led.tick(1 / 60, [sixty], v)).length; }
  assert.equal(n60, one.length, 'frame-rate free');
  // faster than TELEPORT_SPEED is a teleport, and the bank resets; the remainder carries otherwise
  run.feet = [6.05 + A4_TELEPORT * 0.1 + 1, 0, 0];
  assert.deepEqual(steps(led.tick(0.1, [run], v)), [], 'a teleport is not a walk');
  run.feet[0] += 0.4; assert.deepEqual(steps(led.tick(0.1, [run], v)), [], 'four tenths: short of a stride');
  run.feet[0] += 0.3; assert.equal(steps(led.tick(0.1, [run], v)).length, 1, 'and three more: the stride, off the carried remainder');
  // the literals the arc states, so its text cannot drift from the code
  assert.equal(STRIDE, 0.7); assert.equal(A4_TELEPORT, 40); assert.equal(A4_POOL_SPREAD, 12); assert.equal(STREAK_MAX, 2.5);
  assert.equal(TRACK_WET_STAGE, 2); assert.equal(TRACK_STEPS, 6);
  assert.equal(A4_BLEED_RATE, A4_GIB_RATE, 'the drip’s rate IS the gib’s splat rate');
  assert.match(a4Read('src/combat/bloodBleed.js'), /export const BLEED_RATE = GIB_SPLASH_RATE;/, '...by import, not a second copy');
});

test('BLOOD AUDIT 4: the wet test is a FLOOR test at the ceiling’s own number, and a drip’s drops never wear a streak', () => {
  const { fx, marks } = rigHitEffects({ collider: a4Floor, settings: a4Settings, rng: a4Rng(9) });
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [20, 1.7, 20], null, { damage: 10, maxHealth: 40 });   // so the ring exists
  const pool = marks._pool();
  // a WALL's mark under the foot - a run down a wall the walker brushes past - is not wet floor
  const wall = pool.place([0, 0, 0], [1, 0, 0], { size: 1 });
  wall.uv = { kind: 'drip' }; wall.stage = 0;
  assert.equal(fx.footfall([0, 1.7, 0], [0, 0, 1]), null);
  assert.equal(marks.tracked(PLAYER_WALKER), 0, 'a wall’s mark does not make the foot wet');
  // the boundary is CEILING_DOT, by name: a slope AT it is not a floor, just past it is
  const at = pool.place([3, 0, 3], [Math.sqrt(1 - CEILING_DOT * CEILING_DOT), CEILING_DOT, 0], { size: 1 });
  at.uv = { kind: 'pool' }; at.stage = 0;
  fx.footfall([3, 1.7, 3], [0, 0, 1]);
  assert.equal(marks.tracked(PLAYER_WALKER), 0, 'at the dot: not a floor');
  const past = pool.place([6, 0, 6], [Math.sqrt(1 - 0.71 * 0.71), 0.71, 0], { size: 1 });
  past.uv = { kind: 'pool' }; past.stage = 0;
  fx.footfall([6, 1.7, 6], [0, 0, 1]);
  assert.equal(marks.tracked(PLAYER_WALKER), TRACK_STEPS, 'past it: a floor');
  // TRACK_WET_STAGE's boundary: at the stage is wet, one past is not
  fx.clear();
  fx.showBloodSplash(0, [20, 1.7, 20], null, { damage: 10, maxHealth: 40 });
  for (const d of marks._pool().decals()) d.stage = TRACK_WET_STAGE;
  fx.footfall([20, 1.7, 20], [0, 0, 1]);
  assert.equal(marks.tracked(PLAYER_WALKER), TRACK_STEPS, 'at TRACK_WET_STAGE: still wet');
  fx.clear();
  fx.showBloodSplash(0, [20, 1.7, 20], null, { damage: 10, maxHealth: 40 });
  for (const d of marks._pool().decals()) d.stage = TRACK_WET_STAGE + 1;
  fx.footfall([20, 1.7, 20], [0, 0, 1]);
  assert.equal(marks.tracked(PLAYER_WALKER), 0, 'one past: a stain');
  // a drip fell, it did not fly: none of its drops is a streak, whatever radius it landed at
  fx.clear();
  for (let k = 0; k < 20; k++) marks.drip(0, [k, 0, 0], BLEED_DROPS_CAP);
  const drops = marks._pool().decals();
  assert.ok(drops.length >= 20);
  assert.ok(drops.every((d) => d.uv.kind !== 'streak' && d.stretch === 1), 'gravity’s blood wears no streak');
  assert.ok(drops.some((d) => Math.hypot(d.pos[0] - Math.round(d.pos[0]), d.pos[2]) > BLEED_RADIUS * 0.6), '(and some landed far enough out that the old law would have streaked them)');
});

test('BLOOD AUDIT 4: uploads are RUNS - a dry cohort is one call, a recentre one, a print one write, a clear none - and the cell survives the recentre in the BUFFER', () => {
  const { fx, marks, wrote, calls } = rigHitEffects({ collider: a4Floor, settings: a4Settings, rng: a4Rng(5) });
  marks.useArt(380, 1, 6);
  // the ladder's top: twenty-four drops, one blow, contiguous slots
  fx.showBloodSplash(0, [0, 1, 0], null, { damage: 80, maxHealth: 40, fromPlayer: true, heavy: false, throw: [0, 0] });
  const n = marks.count();
  assert.ok(n >= 12, `${n} marks`);   // twenty-four drops less the one in four that looked up at a sky
  assert.equal(calls.length, 1, 'the blow’s marks went up as ONE run');
  assert.equal(calls[0].n, n);
  // drying: every stage the cohort crosses is one call for the whole cohort
  calls.length = 0;
  for (let t = 0; t < A4_DRY_TIME + A4_DRY_TICK * 2; t += 1) fx.tick(1);
  assert.equal(calls.length, A4_DRY_STAGES, `${calls.length} uploads for eight stages - one a stage, not one a mark`);
  assert.ok(calls.every((c) => c.n === n), 'each the whole cohort');
  // the recentre: one call for the whole ring, and the cell rides IN THE BUFFER
  calls.length = 0;
  fx.offsetAll([819.2, 0, 0]);
  assert.equal(calls.length, 1); assert.equal(calls[0].n, n);
  const d = marks._pool().decals()[0];
  const w = wrote.filter((x) => x.slot === d.slot).at(-1);
  assert.ok(Math.abs(w.floats[3] - d.uv.u0) < 1e-6 && Math.abs(w.floats[4] - d.uv.v0) < 1e-6, 'the cell’s own corner, in the floats, after the recentre - the survivor');
  assert.ok(Math.abs(w.floats[0] - (819.2 + d.pos[0] - w.floats[0])) > 100 || w.floats[0] > 800, 'and the corner moved');
  // a print is ONE write, its fade dressed in
  fx.showBloodSplash(0, [5, 1.7, 5], null, { damage: 10, maxHealth: 40 });
  fx.footfall([5, 1.7, 5], [0, 0, 1]);
  const before = wrote.length, cBefore = calls.length;
  const print = fx.footfall([5, 1.7, 6], [0, 0, 1]);
  assert.ok(print);
  assert.equal(wrote.length - before, 1, 'one slot written');
  assert.equal(calls.length - cBefore, 1, 'one call');
  assert.ok(Math.abs(wrote.at(-1).floats[8] - (TRACK_STEPS - 1) / TRACK_STEPS) < 1e-6 || Math.abs(wrote.at(-1).floats[8] - 1) < 1e-6, 'with its fade in the alpha float');
  // a clear uploads nothing
  const c0 = calls.length;
  fx.clear();
  assert.equal(calls.length, c0, 'no call for a clear');
  assert.deepEqual(marks._pool().ranges(), []);
});

test('BLOOD AUDIT 4: nothing per frame - the spread and the step read slots, never the ring as an array - and the ring, the batch and the atlas wait for blood ON', () => {
  const { fx, marks } = rigHitEffects({ collider: a4Floor, settings: a4Settings });
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [20, 1.7, 20], null, { damage: 10, maxHealth: 40 });
  const pool = marks._pool();
  const asArray = pool.decals;
  let arrays = 0;
  pool.decals = () => { arrays++; return asArray(); };
  marks.spreadPool(0, [0, 0, 0]);
  for (let t = 0; t < A4_POOL_SPREAD + 1; t += 0.25) fx.tick(0.25);
  assert.equal(arrays, 0, 'twelve seconds of spreading read no array of the ring');
  fx.footfall([0, 1.7, 0], [0, 0, 1]); fx.footfall([0, 1.7, 1], [0, 0, 1]);
  assert.equal(arrays, 0, 'two footsteps read no array of the ring');
  fx.offsetAll([1, 0, 0]);
  assert.equal(arrays, 0, 'nor a recentre');
  assert.ok(marks.count() > 0);
  // BLOOD AUDIT 5: the ring and the batch are built AT BOOT to the tier
  // held then, blood on or off (AUDIT 3's law - AUDIT 4 gated this on the
  // row and the ring was sized by whenever the row was next switched on,
  // which BLOOD2g's dial made live); what waits for the first mark is
  // the ATLAS, the seventy milliseconds and the upload
  let enabled = false, made = 0;
  const uploads = [];
  const renderer = {
    createDecalBatch: (capacity) => { made++; return { capacity }; },
    writeDecalSlot: () => true, drawDecals: () => {}, createBillboardBatch: () => ({}),
    uploadTexture: (archive, record) => { uploads.push(`${archive}_${record}`); return { tex: 1 }; },
  };
  let cap = 8;
  const off = rigHitEffects({ renderer, texture: null, collider: a4Floor, settings: { ...a4Settings, enabled: () => enabled, capacity: () => cap } });
  assert.equal(made, 1, 'blood off: the ring and the batch still, at boot');
  assert.equal(off.marks._pool().capacity, 8, 'to the tier held at boot');
  assert.equal(uploads.length, 0, 'and no atlas upload');
  off.fx.showBloodSplash(0, [0, 1.7, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(uploads.length, 0, 'still off: nothing laid, nothing uploaded');
  enabled = true; cap = 300;
  off.fx.showBloodSplash(0, [0, 1.7, 0], null, { damage: 10, maxHealth: 40 });
  assert.equal(made, 1, 'the ring is the ring it always had');
  assert.equal(off.marks._pool().capacity, 8, '- at the boot tier, not the one the store holds now (the count takes effect when the game is next reloaded)');
  assert.deepEqual(uploads, ['38001_marks'], 'the first mark uploads the atlas');
  const mk = a4Read('src/combat/bloodMarks.js');
  assert.match(mk, /if \(renderer\?\.createDecalBatch\) ensure\(\);/);
  assert.match(mk, /const atlas = \(\) => \(_atlas \?\?= bloodAtlas\(\)\);/, 'the atlas is built when first worn');
  assert.doesNotMatch(mk, /const _atlas = bloodAtlas\(\)/);
  assert.match(mk, /function dress\(d, kind, alpha = 1\) \{\s*\n\s*wear\(\);/, 'worn at the first dress');
});

test('BLOOD AUDIT 4: by source - the dungeon quickload clears the blood, every pool bleeds at the top of its update, the decal pass counts its bind once', () => {
  const dc = a4Read('src/scenes/dungeonContext.js');
  const rs = dc.indexOf('restoreSaved(extras, setPlayerPos');
  const ap = dc.indexOf('applyWorld(extras.world)', rs);
  const cl = dc.indexOf('hitEffects.clear();', rs);
  assert.ok(rs > 0 && cl > rs && cl < ap, 'the dungeon quickload clears the blood before it applies the saved world');
  // the bleed sits above every early return of the function it is in
  for (const [f, line] of [
    ['src/scenes/exteriorFoes.js', 'hitEffects?.bleed?.(dt, foes, foeBleedView);'],
    ['src/scenes/cityGuards.js', 'hitEffects?.bleed?.(dt, guards, guardBleedView);'],
    ['src/scenes/dungeonContext.js', 'hitEffects.bleed(dt, foes, foeBleedView);'],
  ]) {
    const src = a4Read(f);
    const at = src.indexOf(line);
    assert.ok(at > 0, `${f}: the bleed`);
    const heads = [...src.slice(0, at).matchAll(/\n {2,4}(?:async )?function \w+\([^)]*\) \{/g)];
    const head = heads.at(-1);
    assert.ok(head, `${f}: inside a function`);
    assert.doesNotMatch(src.slice(head.index, at), /\breturn\b/, `${f}: no return between the function’s head and the bleed - every frame, every body`);
  }
  // drawDecals: _bindTex0 counts the bind it makes; the pass does not count it again
  const r = a4Read('src/render/renderer.js');
  const fn = r.slice(r.indexOf('  drawDecals(batch, tex, ranges = null) {'), r.indexOf('\n  }\n', r.indexOf('  drawDecals(batch, tex, ranges = null) {')));
  assert.match(fn, /this\._bindTex0\(tex\);/);
  assert.doesNotMatch(fn, /this\.stats\.texBinds\+\+/, 'counted once, by the bind');
});

// ── BLOOD2e (2026-09-21) - THE PLAYER'S OWN BLOOD: the reference's player
// bleeding on the same ledger, its subtle flash, and blood on the lens ──
import { playerDamageFlash, flashPlayerDamage, BLEED_FLASH_ALPHA, FLASH_ALPHA as E_FLASH_ALPHA } from '../src/ui/damageFlash.js';
import { createBloodScreen, screenDrops, screenDropAlpha, SCREEN_SPATTER_MIN, SCREEN_DROPS_MAX, SCREEN_DROPS_AT, SCREEN_DROPS_CAP, SCREEN_DROP_LIFE, SCREEN_FADE_SHARE, SCREEN_DROP_SIZE, SCREEN_DROP_SLIDE } from '../src/ui/bloodScreen.js';
import { bleedDrops as eBleedDrops, bleedShare as eBleedShare, BLEED_WAIT as E_WAIT } from '../src/combat/bloodBleed.js';
import { FEATURES as E_FEATURES } from '../src/systems/features.js';

test('BLOOD2e: the player bleeds - the same ledger, no strides, no corpse, a subtle flash a drip that never lowers a blow’s, nothing at zero health', () => {
  // the ledger: a view that says `strides: false` walks without steps
  const led = a4Ledger({ rng: () => 0 });
  const me = { feet: [0, 0, 0], health: 40, maxHealth: 40, bloodIndex: 0, dead: false, corpse: false, strides: false };
  led.tick(0.1, [me], (b) => b);
  me.feet = [3, 0, 0];
  assert.deepEqual(led.tick(0.1, [me], (b) => b), [], 'three metres, no steps - the footstep machine lays the player’s');
  const other = { ...me, strides: true };
  led.tick(0.1, [other], (b) => b); other.feet = [6, 0, 0];
  assert.ok(led.tick(0.1, [other], (b) => b).some((a) => a.kind === 'step'), '(a body that strides still does)');

  // the seam: drips at the feet off the entity's health, on the rig's held chance (a wait of 3.5 s)
  const { fx, marks } = rigHitEffects({ collider: a4Floor, settings: a4Settings });
  marks.useArt(380, 1, 6);
  const entity = { health: 10, maxHealth: 40 };
  const wait = E_WAIT.min + 0.5 * (E_WAIT.max - E_WAIT.min);
  playerDamageFlash.tick(10);   // clean
  assert.equal(fx.bleedPlayer(wait - 0.1, [2, 1.7, 2], entity), 0, 'the wait is not up');
  assert.equal(playerDamageFlash.alpha, 0);
  assert.equal(fx.bleedPlayer(0.2, [2, 1.7, 2], entity), 1, 'then a drip');
  const drops = marks._pool().decals();
  assert.equal(drops.length, 3, 'the ramp’s count at a quarter of a life - round(0.51 x 6) - at the feet (the literal, not the law under test)');
  assert.ok(drops.every((d) => Math.hypot(d.pos[0] - 2, d.pos[2] - 2) <= BLEED_RADIUS + 1e-9 && Math.abs(d.pos[1]) < 0.05), 'on the floor under the feet');
  assert.ok(Math.abs(playerDamageFlash.alpha - BLEED_FLASH_ALPHA) < 1e-9, 'and the subtle flash');
  assert.ok(BLEED_FLASH_ALPHA < E_FLASH_ALPHA / 3, 'subtle: under a third of a blow’s');
  // a blow's flash is never lowered by a drip
  flashPlayerDamage(5);
  fx.bleedPlayer(wait + 0.1, [2, 1.7, 2], entity);
  assert.equal(playerDamageFlash.alpha, E_FLASH_ALPHA, 'the blow’s flash stands');
  playerDamageFlash.tick(10);
  // walking while bleeding lays drips where the feet are and no prints
  const n0 = marks.count();
  fx.bleedPlayer(wait + 0.1, [9, 1.7, 9], entity);
  assert.ok(marks._pool().decals().slice(n0).every((d) => d.uv.kind !== 'print' && Math.hypot(d.pos[0] - 9, d.pos[2] - 9) <= BLEED_RADIUS + 1e-9), 'drips, not prints, at the new feet');
  // well: nothing; dead: nothing, and NO POOL - the death screen's, not the floor's
  entity.health = 30;
  assert.equal(fx.bleedPlayer(wait + 1, [2, 1.7, 2], entity), 0, 'above the threshold: nothing');
  entity.health = 0;
  const before = marks.count();
  for (let k = 0; k < 10; k++) fx.bleedPlayer(1, [2, 1.7, 2], entity);
  assert.equal(marks.count(), before, 'at zero health: no drip, no pool');
  assert.equal(fx.bleedPlayer(1, null, entity), 0); assert.equal(fx.bleedPlayer(1, [0, 0, 0], null), 0);
  // the four hosts, by source, beside the tick they already make
  for (const [f, line] of [
    // (BLOOD AUDIT 5: a held window passes dt 0 - no drip and no flash under
    // the inventory - and the world hosts hand the feet they hand everything else)
    ['src/scenes/world.js', 'hitEffects.bleedPlayer(townTalk.overlayActive ? 0 : dt, walkMode && playerSpawned ? player.pos : cam.pos, playerEntity);'],
    ['src/scenes/exterior.js', 'hitEffects.bleedPlayer(popDt, walkMode ? player.pos : cam.pos, playerEntity);'],
    ['src/scenes/dungeonContext.js', 'hitEffects.bleedPlayer(dt, playerFeet, playerEntity);'],
    ['src/scenes/worldModes.js', 'interiorHitEffects.bleedPlayer(overlayHeld ? 0 : dt, player.pos, playerEntity);'],
  ]) {
    const src = a4Read(f);
    const at = src.indexOf(line);
    assert.ok(at > 0, `${f}: the player bleeds`);
    assert.ok(src.slice(Math.max(0, at - 200), at).includes('.tick(dt);'), `${f}: beside the pool’s tick`);
  }
  assert.match(a4Read('src/scenes/hitEffects.js'), /dead: !\(health > 0\), corpse: false, strides: false/, 'the player’s view: no corpse, no strides');
});

test('BLOOD2e: blood on the lens - a real blow throws drops that slide and fade, one blended quad each in the blood’s red, capped; its row; the HUD’s one call', () => {
  // the law
  assert.equal(screenDrops(0), 0); assert.equal(screenDrops(SCREEN_SPATTER_MIN - 0.001), 0, 'a scratch throws nothing');
  assert.equal(screenDrops(SCREEN_SPATTER_MIN), 1); assert.equal(screenDrops(SCREEN_DROPS_AT), SCREEN_DROPS_MAX); assert.equal(screenDrops(1), SCREEN_DROPS_MAX, 'never past the most');
  assert.ok(screenDrops(0.3) > 1 && screenDrops(0.3) < SCREEN_DROPS_MAX, 'and between, between');
  assert.equal(screenDropAlpha(0), 1); assert.equal(screenDropAlpha(SCREEN_DROP_LIFE * (1 - SCREEN_FADE_SHARE)), 1, 'holds');
  assert.ok(screenDropAlpha(SCREEN_DROP_LIFE * 0.9) > 0 && screenDropAlpha(SCREEN_DROP_LIFE * 0.9) < 1, 'then fades'); assert.equal(screenDropAlpha(SCREEN_DROP_LIFE), 0); assert.equal(screenDropAlpha(-1), 0);
  for (let t = 0; t < SCREEN_DROP_LIFE; t += 0.05) assert.ok(screenDropAlpha(t + 0.05) <= screenDropAlpha(t) + 1e-12, 'monotone');
  assert.equal(SCREEN_SPATTER_MIN, 0.1); assert.equal(SCREEN_DROPS_MAX, 5); assert.equal(SCREEN_DROPS_CAP, 12); assert.equal(SCREEN_DROP_LIFE, 2.5);

  // the lens
  const atlas = buildBloodAtlas();
  const lens = createBloodScreen({ rng: a4Rng(11) });
  assert.equal(lens.spatter(0.05, atlas), 0); assert.equal(lens.count, 0);
  assert.equal(lens.spatter(0.5, atlas), SCREEN_DROPS_MAX); assert.equal(lens.count, SCREEN_DROPS_MAX);
  for (const d of lens._drops()) {
    assert.ok(d.x > 0 && d.x < 1 && d.y > 0 && d.y < 1, 'on the screen');
    assert.ok(d.size >= SCREEN_DROP_SIZE.min && d.size <= SCREEN_DROP_SIZE.max);
    assert.equal(d.cell.kind, 'spatter', 'wears the atlas’s spatter');
  }
  assert.ok(new Set(lens._drops().map((d) => `${d.x.toFixed(3)},${d.size.toFixed(3)}`)).size === SCREEN_DROPS_MAX, 'each its own');
  for (let k = 0; k < 5; k++) lens.spatter(1, atlas);
  assert.equal(lens.count, SCREEN_DROPS_CAP, 'capped - the oldest go first');
  // the draw: one blended quad a drop, the blood's red at the drop's alpha, sliding down with age
  const quads = [];
  const renderer = { drawScreenQuad: (tex, dst, src, color, opts) => { quads.push({ tex, dst, src, color, opts }); } };
  const canvas = { width: 1600, height: 900 };
  lens.clear(); lens.spatter(0.5, atlas);
  assert.equal(lens.draw(renderer, canvas, 'atlas-tex'), SCREEN_DROPS_MAX);
  assert.equal(quads.length, SCREEN_DROPS_MAX);
  for (const q of quads) {
    assert.equal(q.tex, 'atlas-tex'); assert.equal(q.opts.blend, true, 'blended - the atlas’s alpha is the shape');
    assert.ok(Math.abs(q.color[0] - A4_BASE[0]) < 1e-12 && Math.abs(q.color[1] - A4_BASE[1]) < 1e-12 && Math.abs(q.color[2] - A4_BASE[2]) < 1e-12 && q.color[3] === 1, 'the blood’s red, fresh');
    assert.ok(q.dst.w === q.dst.h && q.dst.w >= SCREEN_DROP_SIZE.min * 900 - 1e-9 && q.dst.w <= SCREEN_DROP_SIZE.max * 900 + 1e-9, 'sized by the canvas HEIGHT');
    assert.equal(q.src.kind, 'spatter'); assert.ok(q.opts.rotate && Number.isFinite(q.opts.rotate.rad), 'turned');
  }
  const y0 = quads.map((q) => q.dst.y);
  quads.length = 0;
  lens.tick(SCREEN_DROP_LIFE * 0.8);
  lens.draw(renderer, canvas, 'atlas-tex');
  for (let k = 0; k < quads.length; k++) {
    assert.ok(quads[k].dst.y > y0[k], 'slid down');
    assert.ok(Math.abs(quads[k].dst.y - y0[k] - SCREEN_DROP_SLIDE * 900 * 0.8) < 1e-6, 'by its age’s share of the slide');
    assert.ok(quads[k].color[3] < 1 && quads[k].color[3] > 0, 'fading');
  }
  lens.tick(SCREEN_DROP_LIFE);
  assert.equal(lens.count, 0, 'gone'); assert.equal(lens.draw(renderer, canvas, 'atlas-tex'), 0);
  assert.equal(lens.tick(-1), 0); assert.equal(lens.tick(NaN), 0);
  lens.spatter(0.5, null); assert.equal(lens.draw(renderer, canvas, 'atlas-tex'), 0, 'no art, no quad - and no throw'); lens.clear();
  assert.equal(lens.draw(renderer, canvas, null), 0);

  // the row, on by default, the player's own online
  const row = E_FEATURES.find((f) => f.id === 'blood-screen');
  assert.ok(row && row.group === 'combat' && row.kinds.includes('enhanced'));
  assert.deepEqual(row.control, { store: 'prefs', key: 'blood-screen', initial: true, online: 'player' });
  assert.match(a4Read('src/combat/bloodSwitch.js'), /export const bloodScreenOn = \(\) => getPref\(BLOOD_SCREEN_PREF\) !== false;/);
  // the HUD's one call: spattered off the detector CameraRecoiler reads, ticked and drawn above the `!art` return
  const hud = a4Read('src/ui/hud.js');
  const spat = hud.indexOf("if (blow && bloodScreenOn() && lastHealthLostPercent() >= SCREEN_SPATTER_MIN) playerBloodScreen.spatter(lastHealthLostPercent(), bloodAtlas());");
  assert.ok(hud.indexOf('const blow = playerDamageFlash.takeBlow();') > 0 && hud.indexOf('const blow = playerDamageFlash.takeBlow();') < spat, 'BLOOD AUDIT 5: and a BLOW - the RemoveHealth latch, read once, before the amount');
  const tick = hud.indexOf('playerBloodScreen.tick(dt);');
  const draw = hud.indexOf('playerBloodScreen.draw(renderer, canvas, renderer.uploadTexture(BLOOD_ATLAS_ARCHIVE, BLOOD_ATLAS_RECORD, bloodAtlas(), { smooth: true }));');
  const detector = hud.indexOf('const rig = updateHudVitals(');
  const artReturn = hud.indexOf('  if (!art) return;');
  assert.ok(detector > 0 && spat > detector && tick > spat && draw > tick && draw < artReturn, 'after the detector, before the art return');
  assert.match(a4Read('src/ui/damageFlash.js'), /export function flashPlayerBleed\(\) \{ playerDamageFlash\.bleed\(\); \}/);
});


// ── BLOOD2f (2026-09-21) - THE WET SHEEN: a fresh mark glints under the
// enhanced lane, and the glint goes before the colour does ──
import { wetAt, WET_POWER } from '../src/combat/bloodArt.js';
import { EL_WET_GLOSS, EL_WET_STRENGTH, EL_SPEC_GLOSS as F_SPEC_GLOSS, EL_SPEC_STRENGTH as F_SPEC_STRENGTH, EL_DECAL_FS as F_DECAL_FS } from '../src/render/enhancedLighting.js';

test('BLOOD2f: the wet float rides the slot - one fresh, falling as the square with the stages, zero dried; a mark that says nothing is dry', () => {
  // the law
  assert.equal(wetAt(0), 1); assert.equal(wetAt(A4_DRY_STAGES), 0); assert.equal(wetAt(NaN), 1); assert.equal(wetAt(A4_DRY_STAGES * 3), 0, 'never under zero');
  assert.equal(WET_POWER, 2);
  assert.ok(Math.abs(wetAt(A4_DRY_STAGES / 2) - 0.25) < 1e-12, 'half dried: a quarter wet - the sheen goes before the colour');
  for (let k = 0; k < A4_DRY_STAGES; k++) assert.ok(wetAt(k + 1) < wetAt(k), 'monotone');
  // the writer: the tenth float of every corner
  const d = { pos: [1, 2, 3], size: 1, right: [1, 0, 0], up: [0, 0, 1], tint: [0.5, 0.1, 0.1, 1], wet: 0.75 };
  const out = new Float32Array(DECAL_FLOATS);
  writeDecalQuad(out, 0, d, null);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(out[i * DECAL_FLOATS_PER_VERTEX + 9] - 0.75) < 1e-6, `corner ${i} carries the wet`);
  writeDecalQuad(out, 0, { ...d, wet: undefined }, null);
  for (let i = 0; i < 4; i++) assert.equal(out[i * DECAL_FLOATS_PER_VERTEX + 9], 0, 'a mark that says nothing is dry');
  writeDecalQuad(out, 0, { ...d, wet: 7 }, null); assert.equal(out[9], 1, 'clamped');
  writeDecalQuad(out, 0, { ...d, wet: -1 }, null); assert.equal(out[9], 0);
  // the pool: born wet, dried by the stages on the same rewrites
  const { fx, marks, wrote } = rigHitEffects({ collider: a4Floor, settings: a4Settings, rng: a4Rng(4) });
  marks.useArt(380, 1, 6);
  fx.showBloodSplash(0, [0, 1, 0], null, { damage: 10, maxHealth: 40 });
  const ds = marks._pool().decals();
  assert.ok(ds.length > 0 && ds.every((m) => m.wet === 1), 'born wet');
  assert.ok(wrote.slice(-ds.length).every((w) => w.floats[9] === 1), 'and the slot says so');
  for (let t = 0; t < A4_DRY_TIME / 2 + A4_DRY_TICK; t += 1) fx.tick(1);
  assert.ok(ds.every((m) => m.stage === A4_DRY_STAGES / 2 && Math.abs(m.wet - wetAt(A4_DRY_STAGES / 2)) < 1e-12), 'half dried: a quarter wet');
  assert.ok(wrote.slice(-ds.length).every((w) => Math.abs(w.floats[9] - 0.25) < 1e-6), 'in the buffer, on the dry pass’s own rewrite');
  for (let t = 0; t < A4_DRY_TIME; t += 1) fx.tick(1);
  assert.ok(ds.every((m) => m.wet === 0), 'dried: dry');
  assert.ok(wrote.slice(-ds.length).every((w) => w.floats[9] === 0));
  // a print is born wet too (fresh blood off a boot)
  fx.showBloodSplash(0, [5, 1.7, 5], null, { damage: 10, maxHealth: 40 });
  fx.footfall([5, 1.7, 5], [0, 0, 1]);
  const print = fx.footfall([5, 1.7, 6], [0, 0, 1]);
  assert.ok(print && print.wet === 1);
});

test('BLOOD2f: the lane glints a wet mark - the lamp and the sun seen in it at the wet gloss, scaled by the wetness, nothing when dry; the classic set does not know the float', () => {
  assert.ok(EL_WET_GLOSS > F_SPEC_GLOSS * 2 && EL_WET_STRENGTH > F_SPEC_STRENGTH * 4, 'far tighter and far brighter than stone');
  assert.equal(EL_WET_GLOSS, 64); assert.equal(EL_WET_STRENGTH, 0.9);
  // the attribute, the varying
  const r = a4Read('src/render/renderer.js');
  const vs = r.slice(r.indexOf('const DECAL_VS = `'), r.indexOf('`;', r.indexOf('const DECAL_VS = `')));
  assert.match(vs, /layout\(location=3\) in float aWet;/);
  assert.match(vs, /out float vWet;/); assert.match(vs, /vWet = aWet;/);
  assert.match(r, /gl\.vertexAttribPointer\(3, 1, gl\.FLOAT, false, DECAL_STRIDE, 36\);/, 'the tenth float, after the colour');
  assert.match(r, /gl\.vertexAttribPointer\(2, 4, gl\.FLOAT, false, DECAL_STRIDE, 20\);\s*\n\s*gl\.enableVertexAttribArray\(3\);/);
  const classicFs = r.slice(r.indexOf('const DECAL_FS = `'), r.indexOf('`;', r.indexOf('const DECAL_FS = `')));
  assert.doesNotMatch(classicFs, /vWet/, 'the classic set has no specular at all - the float means nothing to it');
  // the lane's term
  assert.match(F_DECAL_FS, /in float vWet;/);
  assert.match(F_DECAL_FS, /lit \+= glint \+ sunGlint;/, 'added AFTER the albedo multiply - a highlight is the light’s colour');
  assert.match(F_DECAL_FS, /vec3 sunGlint = vWet > 0\.0\s*\n\s*\? uDecalSun \* \(pow\(max\(dot\(n, normalize\(uLightDir \+ normalize\(uCamPos - vWorld\)\)\), 0\.0\), 64\.0\) \* 0\.9 \* vWet \* sunVis\)/, 'the sun’s glint: Blinn-Phong at the wet gloss, on the ONE sun visibility (BLOOD AUDIT 5)');
  // BLOOD AUDIT 5: ONE lantern loop for the diffuse and the glint - the
  // same shadow answer for both (a mark in a contact shadow is
  // glint-shadowed too), the pow skipped where the mark is dry
  const loop = F_DECAL_FS.slice(F_DECAL_FS.indexOf('vec3 elPointLitWet(vec3 wp, vec3 n, float wet, out vec3 glint) {'), F_DECAL_FS.indexOf('\n}', F_DECAL_FS.indexOf('vec3 elPointLitWet(vec3 wp, vec3 n, float wet, out vec3 glint) {')));
  assert.ok(loop.length > 0, 'the lantern loop takes the wetness and answers the glint beside the diffuse');
  assert.match(loop, /float att = sh \* elAttenuation\(d, uPointLights\[i\]\.w\);\s*\n\s*acc \+= att \* \(max\(dot\(n, Ln\), 0\.0\) \+ spec\) \* uPointColors\[i\];/, 'the diffuse as it was');
  assert.match(loop, new RegExp(`if \\(wet > 0\\.0\\) \\{\\s*\\n\\s*float g = pow\\(max\\(dot\\(n, H\\), 0\\.0\\), ${EL_WET_GLOSS}\\.0\\);\\s*\\n\\s*if \\(g > 0\\.0\\) glint \\+= att \\* g \\* uPointColors\\[i\\];`), 'the glint on the SAME att - the same shadow, the same falloff - at the wet gloss, ITS colour, and no pow when dry');
  assert.match(loop, new RegExp(`glint \\*= ${EL_WET_STRENGTH} \\* wet;`), 'scaled by the wetness');
  assert.match(F_DECAL_FS, /vec3 elPointLit\(vec3 wp, vec3 n\) \{ vec3 g; return elPointLitWet\(wp, n, 0\.0, g\); \}/, 'the mesh’s call is the dry case of the one loop');
  assert.doesNotMatch(F_DECAL_FS, /elWetGlint/, 'no second loop');
  // the probe reads it
  const probe = a4Read('tools/bloodProbe.mjs');
  assert.match(probe, /a WET mark under a torch glints - brighter than the same mark dry/);
  assert.match(probe, /the wet float means nothing to the classic set/);
  assert.match(probe, /new Float32Array\(4 \* 10\)/, 'ten floats a corner');
  assert.doesNotMatch(probe, /new Float32Array\(4 \* 9\)/);
});


// ── BLOOD2g (2026-09-21) - THE GORE DIAL: one tier for how much blood there is ──
test('BLOOD2g: the gore dial - one tier sets the amount and the count, the row names every tier and the default, a pool is sized by it', async () => {
  const { GORE_TIERS, GORE_DEFAULT, BLOOD_GORE_PREF, bloodGore, bloodCapacity, bloodDensity, bloodDecalDeps, BLOOD_CAPACITY_MAX } = await import('../src/combat/bloodSwitch.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  assert.deepEqual(Object.keys(GORE_TIERS), ['light', 'normal', 'heavy', 'abattoir']);
  assert.deepEqual(GORE_TIERS.normal, { density: 1, capacity: 600 }, 'Normal is the defaults - nothing changes for anyone who never touches it');
  assert.deepEqual(GORE_TIERS.light, { density: 0.5, capacity: 300 }, 'Light halves the amount');
  assert.ok(GORE_TIERS.heavy.capacity > GORE_TIERS.normal.capacity && GORE_TIERS.abattoir.capacity > GORE_TIERS.heavy.capacity, 'more, and more');
  assert.equal(GORE_TIERS.abattoir.capacity, BLOOD_CAPACITY_MAX, 'the ceiling');
  assert.equal(GORE_DEFAULT, 'normal');
  // the row: a tiered prefs row over the same key, every tier named, the default among them
  const row = E_FEATURES.find((f) => f.id === 'blood-gore');
  assert.ok(row && row.group === 'combat' && row.kinds.includes('enhanced'));
  assert.equal(row.control.key, BLOOD_GORE_PREF); assert.equal(row.control.initial, GORE_DEFAULT); assert.equal(row.control.online, 'player');
  assert.deepEqual(row.control.tiers.map(([v]) => v), Object.keys(GORE_TIERS), 'every tier, in order');
  assert.ok(row.control.tiers.every(([v, l]) => typeof l === 'string' && l.toLowerCase() === v), 'named as itself');
  // the dep bag reads the tier live: a pool built after the shelf changes is sized by it
  const restore = () => setPref(BLOOD_GORE_PREF, undefined);
  try {
    setPref(BLOOD_GORE_PREF, 'light');
    assert.equal(bloodDecalDeps.capacity(), 300); assert.equal(bloodDecalDeps.density(), 0.5);
    const { marks } = rigHitEffects({ collider: a4Floor, settings: bloodDecalDeps });
    assert.equal(marks._pool().capacity, 300, 'the ring is the tier’s count');
    setPref(BLOOD_GORE_PREF, 'abattoir');
    assert.equal(marks._pool().capacity, 300, 'and stays: allocated once (the count takes effect when the world next loads)');
    assert.equal(bloodDecalDeps.density(), 1, 'the amount is live');
    assert.equal(bloodGore(), 'abattoir');
  } finally { restore(); }
  assert.match(a4Read('src/combat/bloodSwitch.js'), /GORE_TIERS\[bloodGore\(\)\]\.capacity/); assert.match(a4Read('src/combat/bloodSwitch.js'), /GORE_TIERS\[bloodGore\(\)\]\.density/);
  assert.doesNotMatch(a4Read('src/combat/bloodSwitch.js'), /'blood-capacity'|'blood-density'/, 'the old keys are gone, not aliased');
});


// ── BLOOD AUDIT 5 (2026-09-21, Mac: "Lets audit this") - four lenses over
// BLOOD2e..2g and AUDIT 4's own fixes, every finding paid (Blood-Arc item 12) ──
import { createDamageFlash as a5Flash } from '../src/ui/damageFlash.js';
import { updateHudVitals as a5Vitals, resetVitalsDetector as a5Reset, lastHealthLostPercent as a5Lost, _resetHudVitals as a5Fresh } from '../src/ui/hudVitals.js';
import { STEP_ABOVE } from '../src/combat/bloodMarks.js';

test('BLOOD AUDIT 5: the lens needs a BLOW - the RemoveHealth latch answers once; a load resets the detector, so the loaded health is no loss', () => {
  const f = a5Flash();
  assert.equal(f.takeBlow(), false);
  f.flash(); assert.equal(f.takeBlow(), true, 'a blow, once'); assert.equal(f.takeBlow(), false, 'and not twice');
  f.bleed(); assert.equal(f.takeBlow(), false, 'a drip is not a blow');
  f.flash(); f.flash(); assert.equal(f.takeBlow(), true); assert.equal(f.takeBlow(), false);
  // the detector: live at 90 of 100, a save at 20 of 100 written IN PLACE
  const cur = (health) => ({ health, maxHealth: 100, fatigue: 100, maxFatigue: 100, magicka: 10, maxMagicka: 10 });
  a5Fresh();
  a5Vitals(false, cur(90), 0.016, false); a5Vitals(false, cur(90), 0.016, false);
  a5Vitals(false, cur(20), 0.016, false);
  assert.ok(Math.abs(a5Lost() - 0.7) < 1e-9, '(without the reset the load reads as a seven-tenths blow - the recoil, the tint and the lens all fired on it)');
  a5Vitals(false, cur(90), 0.016, false); a5Vitals(false, cur(90), 0.016, false);
  a5Reset();
  a5Vitals(false, cur(20), 0.016, false);
  assert.equal(a5Lost(), 0, 'reset: the first frame primes from the loaded values and reports nothing');
  a5Vitals(false, cur(10), 0.016, false);
  assert.ok(Math.abs(a5Lost() - 0.1) < 1e-9, 'and the next real loss reads');
  a5Fresh();
  // the two load sites, beside the recoiler's own reset
  assert.match(a4Read('src/scenes/world.js'), /cameraRecoiler\.reset\(\);\s*\n\s*resetVitalsDetector\(\);/, 'the world’s quickload');
  assert.match(a4Read('src/scenes/dungeonContext.js'), /hitEffects\.clear\(\);\s*\n\s*resetVitalsDetector\(\);/, 'the dungeon’s restore');
  assert.match(a4Read('src/ui/hudVitals.js'), /export function resetVitalsDetector\(\) \{ _detector\.primed = false; \}/);
});

test('BLOOD AUDIT 5: the lens keeps the NEWEST drops, a drip that landed nothing does not flash, the drops stay in the band, the bleed flash is 0.12', () => {
  const atlas = buildBloodAtlas();
  const lens = createBloodScreen({ rng: a4Rng(21) });
  lens.spatter(1, atlas); lens.tick(0.5); lens.spatter(1, atlas); lens.tick(0.5); lens.spatter(1, atlas);
  const ages = lens._drops().map((d) => +d.age.toFixed(3));
  assert.equal(ages.filter((a) => a === 0).length, 5, 'all of the newest blow');
  assert.equal(ages.filter((a) => a === 0.5).length, 5, 'all of the one before');
  assert.equal(ages.filter((a) => a === 1).length, 2, 'and what room is left goes to the oldest - the oldest go first');
  for (let k = 0; k < 40; k++) lens.spatter(1, atlas);
  assert.ok(lens._drops().every((d) => d.x >= 0.1 && d.x <= 0.9 && d.y >= 0.1 && d.y <= 0.8), 'in the band, never half off the screen');
  assert.equal(BLEED_FLASH_ALPHA, 0.12);
  // levitating over nothing: the ledger drips, nothing lands, and nothing flashes
  const { fx } = rigHitEffects({ collider: () => ({ surfaceHit: () => null, raycastHit: () => ({ dist: Infinity, normal: null }) }), settings: a4Settings });
  playerDamageFlash.tick(10);
  assert.equal(fx.bleedPlayer(E_WAIT.max + 1, [0, 10, 0], { health: 10, maxHealth: 40 }), 0);
  assert.equal(playerDamageFlash.alpha, 0, 'no drip on the floor, no flash');
});

test('BLOOD AUDIT 5: the ring is minted once, the mirror goes with dispose, a surface above the feet is not the floor, and a dry cohort and a spread share one flush', () => {
  // a renderer whose batch comes back empty: one ring, kept
  const { fx, marks } = rigHitEffects({ renderer: { createDecalBatch: () => null, writeDecalSlot: () => true, drawDecals: () => {}, createBillboardBatch: () => ({}) }, collider: a4Floor, settings: a4Settings });
  fx.showBloodSplash(0, [0, 1.7, 0], null, { damage: 10, maxHealth: 40 });
  const p1 = marks._pool();
  fx.showBloodSplash(0, [3, 1.7, 3], null, { damage: 10, maxHealth: 40 });
  assert.equal(marks._pool(), p1, 'the same ring'); assert.ok(marks.count() >= 2, 'holding both blows');
  // dispose ends the mirror
  const rig2 = rigHitEffects({ collider: a4Floor, settings: a4Settings });
  rig2.fx.showBloodSplash(0, [0, 1.7, 0], null, { damage: 10, maxHealth: 40 });
  assert.ok(rig2.marks._mirror() instanceof Float32Array);
  rig2.marks.dispose();
  assert.equal(rig2.marks._mirror(), null, 'the pool ends what it owns');
  // a surface met above the feet - streamed feet inside a step - is not the floor
  assert.equal(STEP_ABOVE, 0.25);
  let dist = 0.1;   // the knee ray meets something 0.4 m ABOVE the feet
  const rig3 = rigHitEffects({ collider: () => ({ surfaceHit: (from, dir, max) => (dir[1] < 0 ? { dist, normal: [0, 1, 0] } : null), raycastHit: () => ({ dist: Infinity, normal: null }) }), settings: a4Settings });
  rig3.marks.useArt(380, 1, 6);
  assert.equal(rig3.marks.spreadPool(0, [0, 0, 0]), null, 'no pool floating above a corpse’s feet');
  dist = DRIP_FROM - STEP_ABOVE + 0.01;   // just inside the tolerance: the drawn terrain, centimetres up
  const pool = rig3.marks.spreadPool(0, [0, 0, 0]);
  assert.ok(pool && Math.abs(pool.pos[1] - (STEP_ABOVE - 0.01 + SURFACE_LIFT)) < 1e-9, 'a floor a little above the feet is the floor');
  dist = 0.1;
  assert.equal(rig3.fx.footfall([0, 0, 0], [0, 0, 1]), null); assert.equal(rig3.marks.tracked(PLAYER_WALKER), 0, 'and the foot is not in it');
  dist = DRIP_FROM - STEP_ABOVE + 0.01;
  rig3.fx.footfall([0, 0, 0], [0, 0, 1]);
  assert.equal(rig3.marks.tracked(PLAYER_WALKER), TRACK_STEPS);
  // one flush for a tick that both dries a cohort and steps a spread
  const rig4 = rigHitEffects({ collider: a4Floor, settings: a4Settings, rng: a4Rng(8) });
  rig4.marks.useArt(380, 1, 6);
  rig4.fx.showBloodSplash(0, [0, 1, 0], null, { damage: 80, maxHealth: 40, fromPlayer: true, heavy: false, throw: [0, 0] });
  const n = rig4.marks.count();
  for (let t = 0; t < 21; t++) rig4.fx.tick(1);
  const pool4 = rig4.marks.spreadPool(0, [5, 0, 5]);
  assert.equal(pool4.slot, n, 'the pool sits right after the cohort');
  rig4.fx.tick(1); rig4.fx.tick(1);   // clock 23: the spread’s first step alone
  rig4.calls.length = 0;
  rig4.fx.tick(1);   // clock 24: the cohort crosses stage one AND the spread steps
  assert.ok(rig4.marks._pool().decals()[0].stage === 1 && pool4.size > POOL_SIZE.start, 'both happened');
  assert.equal(rig4.calls.length, 1, 'one flush, one run');
  assert.equal(rig4.calls[0].n, n + 1, 'the cohort and the pool in it');
});

test('BLOOD AUDIT 5: by source - the menu shows a row’s default for a stored value that is no tier, the gore effect says when', () => {
  const menu = a4Read('src/ui/enhancedMenu.js');
  assert.match(menu, /const found = c\.tiers\.findIndex\(\(\[v\]\) => String\(v\) === cur\);\s*\n\s*const at = found >= 0 \? found : fallback;/, 'the tile');
  assert.match(menu, /const fallback = Math\.max\(0, c\.tiers\.findIndex\(\(\[v\]\) => String\(v\) === String\(c\.default \?\? c\.initial\)\)\);/);
  assert.match(menu, /const found = tiers\.findIndex\(\(\[v\]\) => String\(v\) === cur\);\s*\n\s*const at = found >= 0 \? found : Math\.max\(0, tiers\.findIndex/, 'the chooser');
  const row = E_FEATURES.find((f) => f.id === 'blood-gore');
  assert.match(row.effect, /when the game is next reloaded \(a dungeon takes it on entry\)/, 'three pools live a page; only the dungeon rebuilds on entry');
});
