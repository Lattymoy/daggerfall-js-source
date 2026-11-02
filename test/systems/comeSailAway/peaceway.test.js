// PEACE-WAY (2026-10-17, the owner: "When out of combat, the ship should traverse 15% faster"; bible/03-World/Naval-Refit.md
// PEACE-WAY) - her way out of a fight, on Come Sail Away's real runtime over the vendored hulls (test/csaScene.mjs): the
// law's own numbers, her way under sail and under oars and its coming on, the journey's estimates of both, the seam
// bounded, the bonus shed when a fight begins - and the world host's word for "out of a fight".
// tools/mutants/peaceway.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { scene } from '../../csaScene.mjs';
import { PEACE_WAY, PEACE_HOLD_S, peaceWayOf, peaceShare, heldPeaceWay } from '../../../src/systems/comeSailAway/peaceWay.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);
const rad = (d) => (d * Math.PI) / 180;

/** Her helm taken (`hull`), a 1.5 m/s wind on her beam, the seam answering `peace()` each read. */
function helmOn(hull, { peace = () => 1, raise = true } = {}) {
  const s = scene();
  s.deps.handling = () => 'responsive';
  s.deps.peaceWay = () => peace();
  const boat = s.helm(s.place(hull, 0));
  const w = [-1.5 * Math.sin(rad(90)), 0, -1.5 * Math.cos(rad(90))];
  const hold = () => { s.rt.state.windVectorCurrent = [...w]; s.rt.state.windVectorTarget = [...w]; };
  hold();
  if (raise) s.rt.RaiseSails();
  const run = (secs) => { for (let t = 0; t < secs - 1e-9; t += 0.25) { hold(); s.frame(); } };
  return { s, boat, run, way: () => Math.hypot(...s.rt.state.MoveVectorCurrent) };
}
/** The seconds she takes to come up to `share` of the way she settles at, from a stand. */
function gather(h, share = 0.95, secs = 90) {
  const ways = [];
  for (let t = 0; t < secs - 1e-9; t += 0.25) { h.run(0.25); ways.push(h.way()); }
  const top = ways.at(-1);
  return { top, at: (ways.findIndex((v) => v >= top * share) + 1) * 0.25 };
}

test('PEACE-WAY the law: PEACE_WAY (1.15) with no enemy near, no boarding and no broadside laid - any one of them and her way is her own; a seam\'s answer bounded to [1, PEACE_WAY], anything not a number her own', () => {
  assert.equal(PEACE_WAY, 1.15);
  assert.equal(peaceWayOf({}), PEACE_WAY);
  assert.equal(peaceWayOf({ enemies: false, boarding: false, aiming: false }), PEACE_WAY);
  assert.equal(peaceWayOf({ enemies: true }), 1, 'an enemy near');
  assert.equal(peaceWayOf({ boarding: true }), 1, 'a boarding under way');
  assert.equal(peaceWayOf({ aiming: true }), 1, 'a broadside laid');
  assert.equal(peaceShare(PEACE_WAY), PEACE_WAY);
  assert.equal(peaceShare(1), 1);
  assert.equal(peaceShare(7), PEACE_WAY, 'never past the law\'s own');
  assert.equal(peaceShare(0.2), 1, 'never under her own way');
  assert.equal(peaceShare(NaN), 1);
  assert.equal(peaceShare(undefined), 1);
  assert.equal(peaceShare('x'), 1);
});

test('PEACE-WAY held (AUDIT 2026-10-17): the world\'s answer - a walk of every foe, guard and ship near - asked once a PEACE_HOLD_S however often the runtime asks in a frame, asked again past it and when the clock runs back (mutants: the hold, its span)', () => {
  let now = 10, asked = 0, k = PEACE_WAY;
  const held = heldPeaceWay(() => { asked++; return k; }, () => now);
  for (let i = 0; i < 5; i++) assert.equal(held(), PEACE_WAY);
  assert.equal(asked, 1, 'once for the frame\'s five asks');
  k = 1; now += PEACE_HOLD_S * 0.9;
  assert.equal(held(), PEACE_WAY, 'held');
  now += PEACE_HOLD_S * 0.2;
  assert.deepEqual([held(), asked], [1, 2], 'past the hold: asked again');
  now -= 5;
  assert.deepEqual([held(), asked], [1, 3], 'a clock run back asks again');
  assert.ok(PEACE_HOLD_S > 0 && PEACE_HOLD_S <= 0.25, 'a moment, not a passage');
});

test('PEACE-WAY under sail: out of a fight a galleon and a Carrack settle at PEACE_WAY of the way they make in one, in the time they came up to it before (her way gathers as quickly) - and the journey\'s estimate of her sails (sailWayOf) says the way she makes', () => {
  for (const hull of [HULL.SmallShip, HULL.Carrack]) {
    const fight = gather(helmOn(hull));
    const peaceH = helmOn(hull, { peace: () => PEACE_WAY });
    const calm = gather(peaceH);
    near(calm.top / fight.top, PEACE_WAY, 0.01, `hull ${hull}: her way out of a fight`);
    near(calm.at, fight.at, 0.5, `hull ${hull}: to 95% of it in the same time`);
    near(peaceH.s.rt.sailWayOf(peaceH.boat), calm.top, 0.02 * calm.top, `hull ${hull}: the journey's estimate`);
  }
});

test('PEACE-WAY under oars: a Large Galley rowing out of a fight makes PEACE_WAY of her oars\' way, and the journey\'s estimate of her oars (oarWayOf) says so', () => {
  const row = (peace) => { const h = helmOn(HULL.LargeGalley, { peace, raise: false }); h.s.rt.state.oarThrottle = 1; return { h, g: gather(h, 0.95, 40) }; };
  const fight = row(() => 1), calm = row(() => PEACE_WAY);
  near(calm.g.top / fight.g.top, PEACE_WAY, 0.01, 'her oars');
  near(calm.g.at, fight.g.at, 0.5, 'to 95% of it in the same time');
  near(calm.h.s.rt.oarWayOf(calm.h.boat), calm.g.top, 0.02 * calm.g.top, 'the estimate');
});

test('PEACE-WAY a fight begins: under way at her peace way, an enemy near takes the bonus off and she settles back to her own way; none handed (the seam absent) is the mod to the letter; a seam answering past the law is held to it', () => {
  let peace = PEACE_WAY;
  const h = helmOn(HULL.SmallShip, { peace: () => peace });
  h.run(80);
  const calm = h.way();
  peace = 1;
  h.run(80);
  const fight = h.way();
  near(calm / fight, PEACE_WAY, 0.01, 'shed when the fight begins');
  const bare = scene();
  bare.deps.handling = () => 'responsive';
  delete bare.deps.peaceWay;
  const b = bare.helm(bare.place(HULL.SmallShip, 0));
  const w = [-1.5, 0, 0];
  bare.rt.RaiseSails();
  for (let t = 0; t < 80; t += 0.25) { bare.rt.state.windVectorCurrent = [...w]; bare.rt.state.windVectorTarget = [...w]; bare.frame(); }
  near(Math.hypot(...bare.rt.state.MoveVectorCurrent), fight, 0.01 * fight, 'no seam: her own way');
  assert.ok(b);
  const wild = helmOn(HULL.SmallShip, { peace: () => 7 });
  wild.run(80);
  near(wild.way(), calm, 0.01 * calm, 'a seam of 7 is PEACE_WAY');
});

test('PEACE-WAY the world host\'s word: the runtime\'s seam answers peaceWayOf over its own enemiesNearby (the street\'s foes, the guards, a hostile ship - the helm time scale\'s word), the sea fight\'s boarding and its laid broadside', () => {
  // PIN MOVED (AUDIT 2): and a ship that has sighted me and comes on - a fight past HOSTILE_NEAR_M (navalHost.js threats' `chasing`)
  assert.match(WORLD, /peaceWay\(\) \{ return \(this\._peace \?\?= heldPeaceWay\(\(\) => peaceWayOf\(\{ enemies: !!this\.enemiesNearby\(\) \|\| !!naval\?\.threats\?\.\(\)\.some\(\(t\) => t\.chasing\), boarding: !!naval\?\.boarding, aiming: !!naval\?\.aiming \}\)\)\)\(\); \},/);
  assert.match(WORLD, /enemiesNearby: \(\) => areEnemiesNearby\(.*\|\| navalHostileNear\(\),/, 'the word it reads covers the sea\'s hostile ships');
});
