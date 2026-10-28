// BAL8 - THE PVP REFEREE, ONE RULE FOR EVERY STRIKER (2026-10-12; bible/05-Combat/Balance-Arc.md section 14).
//   - INT10 bounded a caster at 3 casts of 60 in 5 s (180, 36 a second); a blade or a bare hand was bounded at nothing
//     past 4 blows a second and one blow's bucket, which no measured blow came near: a kitted monk felled a fighter in
//     8.3 s where the mage's ceiling takes 10.6. Every harm a fighter deals in a duel, a siege or the Wild Zone - blows
//     and casts together - was held to the casts' own ceiling (SIEGE_HARM), retired by the PvP rework's PVP-HIT.
//   - The arena's stand-in for a rival player faced `yaw: 0` (scenes/world.js arenaRivalBody), so every blow or shaft
//     from its -z side was a backstab, x3, whatever way the rival faced. No referee of a fight between players rolls a
//     backstab (the duel's, the siege's and the zone's pass none - combat/duelCombat.js); the arena's now passes none.
//
// Pinned by execution through the referee itself, and by source for the arena's two doors (dungeonContext.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PVP_HIT, PVP_CASTS, SIEGE_HIT, SIEGE_UNITS_PER_M, newFighter, refereeBlow, refereeCast,
} from '../../../src/net/siege/siegeRef.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const at = (m) => ({ x: m * SIEGE_UNITS_PER_M, y: 0, z: 0 });

test('PVP-HIT (the PvP rework: "so let cap at 45%"): one blow or cast takes at most 45% of the target\'s whole, never past what is left; BAL8\'s 180 in 5 s retired - blows and casts are paced by the swing law and PVP-CASTS (mutants: the share unread; the old ceiling kept)', () => {
  assert.equal(PVP_HIT.share, 0.45);
  const now = 1_000_000;
  const a = newFighter(10, now);
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  const fist = { w: -1, m: 0 };
  const blow = (d, t) => refereeBlow(a, b, { from: at(0), at: at(2), held: fist, d, r: SIEGE_HIT.Melee }, t);
  assert.equal(blow(900, now).dealt, 450, '45% of the target, no more');
  assert.equal(a.clipped, 450);
  assert.equal(blow(450, now + 250).dealt, 450, 'no ceiling of 180 a 5 s');
  const third = blow(450, now + 500);
  assert.deepEqual([third.dealt, third.fell, b.hp], [100, true, 0], 'the third, never past what is left');
  const c = newFighter(10, now), d = newFighter(50, now); d.max = 1000; d.hp = 1000;
  assert.equal(refereeCast(c, d, { from: at(0), at: at(10), d: 9999 }, now).dealt, 450, 'a cast takes the same share');
  assert.equal(refereeBlow(c, d, { from: at(0), at: at(2), held: fist, d: 300, r: SIEGE_HIT.Melee }, now).dealt, 300, 'and a blow after it whole');
});

test('PVP-CASTS: harmful and healing casts share one clock, at most 1.9 a second (mutants: the heal off the clock; the rate unread)', () => {
  assert.deepEqual(PVP_CASTS, { max: 19, windowMs: 10_000 });
  const now = 1_000_000;
  const c = newFighter(10, now), d = newFighter(50, now);
  for (let i = 0; i < 18; i++) assert.equal(refereeCast(c, d, { from: at(0), at: at(10), d: 1 }, now).ok, true);
  assert.equal(refereeCast(c, c, { from: at(0), at: at(0), d: 1, heal: true }, now).ok, true, 'the 19th, a heal');
  assert.equal(refereeCast(c, d, { from: at(0), at: at(10), d: 1 }, now).why, 'rate');
  assert.equal(refereeCast(c, c, { from: at(0), at: at(0), d: 1, heal: true }, now).why, 'rate', 'a heal counts on the same clock');
  assert.equal(refereeCast(c, d, { from: at(0), at: at(10), d: 1 }, now + PVP_CASTS.windowMs).ok, true, 'the window passed');
});

test('BAL8: one referee - the duel\'s, the Wild Zone\'s and the siege\'s rooms all judge a blow through refereeBlow, so the ceiling is every lane\'s', () => {
  for (const f of ['src/net/duel/duelRef.js', 'src/net/wild/wildRef.js']) assert.match(rd(f), /refereeBlow\(/, `${f} judges through refereeBlow`);
  assert.match(rd('server/src/index.js'), /: refereeBlow\(by, to, \{ from: by\.pose, at: to\.pose, held: siegeHeld\(look, m\.w, m\.m\)/, 'and the siege\'s room');
});

test('BAL8: the arena\'s rival is never backstabbed - the swing\'s and the shaft\'s doors both hand no facing (mutants: the rival\'s facing read off its yaw 0; the shaft handed my feet)', () => {
  const ctx = rd('src/scenes/dungeonContext.js');
  assert.match(ctx, /if \(rival\) \{ rival\._backFacing = false; live\.push\(rival\); \}/, 'the swing: no facing');
  assert.doesNotMatch(ctx, /rival\._backFacing = foeDeps\.isBackFacing/, 'never the stand-in\'s yaw');
  assert.match(ctx, /playerArrowHitFoe\(m, rv, \{ playerEntity, playerWeapon, playerFeet: null,/, 'the shaft: no feet to judge a back from');
  assert.match(rd('src/combat/arrowFlight.js'), /const back = foe\.ai && playerFeet \? isBackFacing\(foe\.ai\.yaw, foe\.ai\.feet, playerFeet\) : false;/, 'the shaft\'s backstab reads the feet it is handed');
  assert.match(rd('src/scenes/world.js'), /radius: 0\.4, yaw: 0 \};/, 'the stand-in still faces nowhere - which is why it is never asked');
});
