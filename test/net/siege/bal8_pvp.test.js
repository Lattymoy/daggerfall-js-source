// BAL8 - THE PVP REFEREE, ONE RULE FOR EVERY STRIKER (2026-10-12; bible/05-Combat/Balance-Arc.md section 14).
//   - INT10 bounded a caster at 3 casts of 60 in 5 s (180, 36 a second); a blade or a bare hand was bounded at nothing
//     past 4 blows a second and one blow's bucket, which no measured blow came near: a kitted monk felled a fighter in
//     8.3 s where the mage's ceiling takes 10.6. Every harm a fighter deals in a duel, a siege or the Wild Zone - blows
//     and casts together - is held to the casts' own ceiling (net/siege/siegeRef.js SIEGE_HARM).
//   - The arena's stand-in for a rival player faced `yaw: 0` (scenes/world.js arenaRivalBody), so every blow or shaft
//     from its -z side was a backstab, x3, whatever way the rival faced. No referee of a fight between players rolls a
//     backstab (the duel's, the siege's and the zone's pass none - combat/duelCombat.js); the arena's now passes none.
//
// Pinned by execution through the referee itself, and by source for the arena's two doors (dungeonContext.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIEGE_HARM, SIEGE_CASTS, SIEGE_HIT, SIEGE_UNITS_PER_M, newFighter, refereeBlow, refereeCast, harmRoom,
} from '../../../src/net/siege/siegeRef.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const at = (m) => ({ x: m * SIEGE_UNITS_PER_M, y: 0, z: 0 });

test('BAL8: every harm a fighter deals - blows and casts together - at most the casts\' own 180 in any 5 s; the window slides (mutants: the ceiling dropped from the blow; from the cast; the window never sliding; a blow\'s harm never spent)', () => {
  assert.deepEqual(SIEGE_HARM, { max: SIEGE_CASTS.max * SIEGE_CASTS.damageMax, windowMs: SIEGE_CASTS.windowMs });
  assert.equal(SIEGE_HARM.max, 180);
  let now = 1_000_000;
  const a = newFighter(10, now), b = newFighter(50, now);
  assert.deepEqual(a.harm, [], 'a fighter is born with no harm dealt');
  const fist = { w: -1, m: 0 };
  const blow = (d) => refereeBlow(a, b, { from: at(0), at: at(2), held: fist, d, r: SIEGE_HIT.Melee }, now);
  assert.equal(blow(100).dealt, 100);
  assert.equal(blow(100).dealt, 80, 'the window\'s last 80');
  const third = blow(100);
  assert.deepEqual([third.ok, third.dealt], [true, 0], 'judged, and nothing past the ceiling');
  assert.equal(b.hp, 400 - 180);
  assert.equal(a.clipped, 120);
  assert.equal(harmRoom(a, now), 0);
  now += 4999;
  assert.equal(harmRoom(a, now), 0, 'inside the window still');
  now += 1;
  assert.equal(harmRoom(a, now), 180, 'five seconds on: the window has slid past it');
  assert.equal(blow(60).dealt, 60);
  // casts and blows share it: a spellsword's blade and spell are never two ceilings
  const c = newFighter(10, now), d = newFighter(50, now);
  const cast = () => refereeCast(c, d, { from: at(0), at: at(10), d: 60 }, now);
  assert.equal(cast().dealt, 60);
  assert.equal(cast().dealt, 60);
  assert.equal(refereeBlow(c, d, { from: at(0), at: at(2), held: fist, d: 100, r: SIEGE_HIT.Melee }, now).dealt, 60, 'a blow after two casts: the 60 left');
  assert.equal(cast().dealt, 0, 'and the third cast finds none (it is still counted: three a window)');
  assert.equal(refereeCast(c, d, { from: at(0), at: at(10), d: 60 }, now).why, 'rate', 'INT10\'s own three');
  // a heal is no harm
  assert.equal(refereeCast(c, c, { from: at(0), at: at(0), d: 40, heal: true }, now).ok, true);
  // a fighter from before BAL8 (a room's record with no `harm`) is read as having dealt none
  const old = newFighter(10, now); delete old.harm;
  assert.equal(harmRoom(old, now), 180);
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
