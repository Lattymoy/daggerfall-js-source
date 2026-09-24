// WEEDS1 (2026-09-19, Mac: "its better, what else can we do?") - EVERY
// WEED IN THE WORLD WAS CASTING INTO THE 240-UNIT CASCADE.
//
// F5 already culls a caster too small to shadow a texel of the cascade it
// is being replayed into. But it measures the BATCH'S SPHERE, and a
// billboard batch is every flat of one (archive, record) across a whole
// streamed pixel - and a pixel is 128 tiles at 6.4 units, 819 across. So a
// batch of ankle-high weeds scattered over one has a bounding sphere of
// several hundred units and sails straight through a test meant to catch
// small things, while each sprite in it is thirty centimetres.
//
// The right measure for a flat is the SPRITE, which the batch carries as
// `size`. This is MAC1's argument - "all the billboards in the distance
// ESPECIALLY ALL THE SMALL ONES" - applied to the pass that never got it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SHADOW_CASCADES, SHADOW_FLAT_MIN_HEIGHT, SHADOW_FLAT_MIN_TEXELS,
  SHADOW_CASCADE_MIN_RADIUS_TEXELS, sunTexelWorld, SHADOW_SUN_SIZE, SHADOW_POINT_SIZE,
} from '../src/render/shadowPass.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const minFlatH = (c) => Math.max(SHADOW_FLAT_MIN_HEIGHT, sunTexelWorld(c) * SHADOW_FLAT_MIN_TEXELS);

test('WEEDS1: the threshold is a CASCADE’s, and it touches only the far one', () => {
  // The whole safety of this is that four texels is under the existing
  // flat floor for both near cascades, so they cannot change at all.
  assert.equal(minFlatH(0), SHADOW_FLAT_MIN_HEIGHT, 'cascade 0 is the floor, unchanged');
  assert.equal(minFlatH(1), SHADOW_FLAT_MIN_HEIGHT, 'cascade 1 is the floor, unchanged');
  assert.ok(minFlatH(2) > SHADOW_FLAT_MIN_HEIGHT, 'and only the far cascade rises');
  assert.ok(minFlatH(2) > 0.9 && minFlatH(2) < 1.1, `the far cascade stops carrying anything under ${(minFlatH(2) * 100).toFixed(0)} cm`);
  // what still casts there, stated as the sizes rather than trusted:
  for (const [h, what] of [[3.0, 'a tree'], [1.8, 'a person'], [1.2, 'a fence post']]) {
    assert.ok(h >= minFlatH(2), `${what} (${h} m) still casts into the far cascade`);
  }
  for (const [h, what] of [[0.3, 'a weed'], [0.6, 'a flower'], [0.9, 'a small bush']]) {
    assert.ok(h < minFlatH(2), `${what} (${h} m) does not`);
  }
  // and a shadow at that size really is beneath seeing: four texels of the
  // far cascade against a screen pixel at a hundred metres
  const pixelAt100m = 100 * (2 * Math.tan(Math.PI / 6)) / 1080;
  const shadowPx = (SHADOW_FLAT_MIN_TEXELS * sunTexelWorld(2)) / pixelAt100m;
  assert.ok(shadowPx < 10, `the largest shadow this removes is about ${shadowPx.toFixed(0)} screen pixels at 100 m`);
});

test('WEEDS1: why F5’s own test cannot see it - a batch is a whole pixel wide', () => {
  // F5 culls on `b.bounds[3] < minRadius`, and minRadius for the far
  // cascade is two texels: 47 cm. A nature batch's sphere is the span of
  // every flat of that record across the pixel, so it is not in the same
  // order of magnitude and the test is dead for exactly the batches that
  // most need it.
  const farMinRadius = SHADOW_CASCADE_MIN_RADIUS_TEXELS * sunTexelWorld(2);
  assert.ok(farMinRadius < 0.5, `F5's radius floor is ${(farMinRadius * 100).toFixed(0)} cm`);
  const pixelSpan = 128 * 6.4;
  assert.ok(pixelSpan / 2 > farMinRadius * 100,
    `a batch's sphere can be ${(pixelSpan / 2).toFixed(0)} units where F5 is looking for ${farMinRadius.toFixed(2)} - three orders apart`);
  // ...AND F5'S BATCH LINE IS GONE WITH IT, because once the sprite test
  // exists F5 can no longer decide anything about a flat: a single-flat
  // batch's radius is hypot(w, h) / 2, so F5 fired only when
  // hypot(w, h) < 4 texels - which implies h < 4 texels, the sprite test
  // itself. Its behavioural pin in bugs5 passed for the wrong reason the
  // moment this landed, and its mutant survived, which is what said so.
  const sp = read('src/render/shadowPass.js');
  assert.match(sp, /b\.size\.h < minFlatH/, 'the sprite test decides a flat');
  assert.doesNotMatch(sp, /if \(minRadius > 0 && b\.bounds && b\.bounds\[3\] < minRadius\)/, 'F5\u2019s batch line is retired, not left looking like it decides something');
  // F5 over MESHES and terrain is untouched and still live - it is only
  // the FLAT arm the sprite test subsumes
  assert.match(sp, /if \(minRadius > 0 && r\.kind !== REC_BB && r\.kind !== REC_CHAR && r\.bounded/, 'the record-level test stands');
  // the subsumption, arithmetically rather than by assertion: for every
  // sprite shape, if F5 would have culled it then the height test does
  for (const [w, h] of [[0.3, 0.3], [0.1, 0.9], [2, 0.2], [0.6, 0.6], [3, 3]]) {
    const f5 = Math.hypot(w, h) / 2 < SHADOW_CASCADE_MIN_RADIUS_TEXELS * sunTexelWorld(2);
    if (f5) assert.ok(h < minFlatH(2), `a ${w}x${h} flat: F5 would cull it, so the height test must too`);
  }
});

test('WEEDS1: the lantern replays are untouched, and that is the point of passing the texel', () => {
  // A cube face is 512 over a lantern's range, so its texel is centimetres
  // and a small prop beside a lantern casts a shadow you can see. The
  // point replays pass no texel, so they get the floor alone - exactly
  // what they had before.
  const sp = read('src/render/shadowPass.js');
  assert.match(sp, /replay\(f, vp, lightPos, recordBasis = false, minRadius = 0, texel = 0, filter = REPLAY_ALL, self = true\)/, 'the texel is an argument with a zero default (SC1: and the filter after it, every record by default; DISC24-C: and the self card\'s word after that)');
  assert.match(sp, /const minFlatH = texel > 0 \? Math\.max\(SHADOW_FLAT_MIN_HEIGHT, texel \* SHADOW_FLAT_MIN_TEXELS\) : SHADOW_FLAT_MIN_HEIGHT;/,
    'no texel means the floor, unchanged');
  assert.match(sp, /this\.replay\(f, this\.faceVP\[face\], pos, false, 0, 0, REPLAY_ALL, near\)/, 'and the point replay passes none (a zero)');
  // the sun cascades pass their own
  assert.match(sp, /this\.replay\(f, this\.sunVP\[c\], null, false, SHADOW_CASCADE_MIN_RADIUS_TEXELS \* sunTexelWorld\(c\), sunTexelWorld\(c\)\)/);
  // a lantern's texel really is far finer than a far cascade's, which is
  // what makes treating them differently right rather than convenient
  const lanternTexel = 2 * 18 / SHADOW_POINT_SIZE;   // a lantern's range is ~18 units over a 512 face
  assert.ok(lanternTexel * SHADOW_FLAT_MIN_TEXELS < SHADOW_FLAT_MIN_HEIGHT,
    `a lantern's four texels is ${(lanternTexel * SHADOW_FLAT_MIN_TEXELS * 100).toFixed(0)} cm - under the floor, so it would have changed nothing anyway`);
  assert.equal(SHADOW_SUN_SIZE, 2048);
});

test('WEEDS1: an upside-down flame still casts nothing, as it did', () => {
  // droppedTorches draws its flame on a negated localScale.y, so its
  // `size.h` is NEGATIVE - and the existing test culls it, because a
  // negative height is below any floor. That is pre-existing and stays:
  // raising the floor cannot start a flame casting.
  const sp = read('src/render/shadowPass.js');
  assert.match(sp, /b\.size\.h < minFlatH/, 'the comparison is signed, not an absolute');
  assert.doesNotMatch(sp, /Math\.abs\(b\.size\.h\)/, 'nothing takes the magnitude, which would change what casts');
  for (const c of [0, 1, 2]) assert.ok(-2 < minFlatH(c), 'a negative height is under every cascade’s threshold');
});
