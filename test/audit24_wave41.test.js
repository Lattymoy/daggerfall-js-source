// AUDIT 24, wave 41: EnemySounds.cs, whole - and the drift that comes
// of a law living in a frame body.
//
// `moveSound` and `barkSound` sit in all 62 rows of ENEMY_BASICS and
// had ZERO consumers anywhere in src/. `attackSound` had exactly one,
// written inline in the dungeon's frame body. So above ground nothing
// barked, nothing moved audibly, and nothing made a noise when it
// swung - a watchman's whole vocabulary was a single HALT on the
// detection edge, which is not a thing DFU does at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EnemySoundSource, ignoreHumanSounds, rollAttractDelay,
  ATTRACT_RADIUS, MIN_ATTRACT_DELAY, MAX_ATTRACT_DELAY,
  OCCLUDED_VOLUME_SCALE, MOVE_SOUND_THRESHOLD, ATTACK_SOUND_THRESHOLD,
} from '../src/characters/enemySounds.js';
import { enemySoundOccluded, tickEnemySound, playEnemyClip } from '../src/scenes/hostCombat.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { KNIGHT_CITY_WATCH, MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** Does `fn(` appear as a STATEMENT in this source - a line that
 *  starts with the call - rather than merely appearing somewhere?
 *  A bare `src.includes('fn(')` is satisfied by `if (false) fn(...)`
 *  and by a commented-out call, which is how three mutants walked
 *  through the first campaign. */
function callsAsStatement(src, fn) {
  return src.split('\n').some((l) => l.trim().startsWith(`${fn}(`));
}


// Mutation campaign: 29 reintroductions, 29 killed. The attract radius
// and both delay bounds; the `+1` that makes 9 reachable; the human
// mute losing its city-watch carve-out (the dungeon's actual drift)
// and the mute swallowing monsters; the counter stopping while out of
// range; the radius test as `<=`; move and bark swapped and the 0.8
// threshold slid; a muted source no longer resetting its timer; the
// occlusion probe run eagerly, stopped dampening, or dampening by the
// wrong amount; the attack sound losing the stale scale, always
// playing, or ignoring the mute; the cast ignoring a wall or firing on
// the player; the play reverting to an inverse rolloff, losing
// maxDistance, dropping to the feet, or dropping the volume; audio.js
// hardcoding inverse again; the id back to a literal; and each of the
// five pool call sites silenced one at a time.
// M11 - the eager probe - SURVIVED the first campaign, because the
// pin only counted casts on an unmuted foe and the hoist is invisible
// there. It differs on exactly one case, which is the case DFU's
// ORDER encodes: IgnoreHumanSounds returns before SetVolumeScale, so a
// muted enemy that is due and in range casts nothing at all. Pinned
// now, and killed.
// Two EQUIVALENT mutants, recorded rather than dressed up:
// `Math.max(0, dt)` for the dt guard, and recomputing
// `ignoreHumanSounds` instead of reading the cached flag.
const RAT = 0, BRIGAND = MOBILE_TYPES.Barbarian;

/** A rolls() that hands back a scripted queue, then 0. */
const scripted = (...vals) => { let i = 0; return () => (i < vals.length ? vals[i++] : 0); };

test('audit24 wave41: the constants, and the delay is the INT overload', () => {
  assert.equal(ATTRACT_RADIUS, 16);          // :26
  assert.equal(MIN_ATTRACT_DELAY, 3);        // :27
  assert.equal(MAX_ATTRACT_DELAY, 9);        // :28
  assert.equal(OCCLUDED_VOLUME_SCALE, 0.25); // :253
  assert.equal(MOVE_SOUND_THRESHOLD, 0.8);   // :212
  assert.equal(ATTACK_SOUND_THRESHOLD, 0.5); // :108

  // Random.Range(MinAttractDelay, MaxAttractDelay + 1) is the int
  // overload: INCLUSIVE 3..9, seven possible values.
  assert.equal(rollAttractDelay(() => 0), 3, 'the bottom');
  assert.equal(rollAttractDelay(() => 0.999999), 9, 'the top is REACHABLE - the +1 is why');
  const seen = new Set();
  for (let i = 0; i < 7; i++) seen.add(rollAttractDelay(() => i / 7 + 1e-9));
  assert.deepEqual([...seen].sort((a, b) => a - b), [3, 4, 5, 6, 7, 8, 9]);
});

test('audit24 wave41: IgnoreHumanSounds spares the city watch, and only it', () => {
  // :219-226 - `(ID != Knight_CityWatch && IsClassEnemyId(ID)) && MuteHumanSounds`.
  // The dungeon's inline gate was `!entity.isClass`, which has no
  // carve-out at all - the exact drift a copy in a frame body invites.
  assert.equal(KNIGHT_CITY_WATCH, 146);
  assert.equal(ignoreHumanSounds(KNIGHT_CITY_WATCH), false, 'the watch is heard');
  assert.equal(ignoreHumanSounds(RAT), false, 'monsters are heard');
  assert.equal(ignoreHumanSounds(MOBILE_TYPES.Lamia), false);
  for (const id of [128, 129, 140, 144, 145]) {
    assert.equal(ignoreHumanSounds(id), true, `class enemy ${id} is muted`);
  }
  // and a muted source really does stay silent, on both channels
  const brig = new EnemySoundSource(BRIGAND, () => 0.99);
  assert.equal(brig.muted, true);
  assert.equal(brig.tick(100, 1), null, 'no attract');
  assert.equal(brig.attack(), null, 'no attack sound');
});

test('audit24 wave41: the counter steps out of range, so the first step INTO range speaks', () => {
  // :88-97, and DFU says why: "Keep stepping even when player not in
  // attract radius. This means the player will get audio feedback the
  // moment an enemy is near."
  const s = new EnemySoundSource(RAT, scripted(0));   // waitTime = 3
  assert.equal(s.waitTime, 3);
  // twenty seconds far away: silent, but the counter is running
  for (let i = 0; i < 20; i++) assert.equal(s.tick(1, 100), null);
  assert.ok(s.waitCounter > s.waitTime, 'the counter kept going');
  // the first tick inside the radius fires at once
  const out = s.tick(0.016, ATTRACT_RADIUS - 0.1);
  assert.ok(out, 'it greets you the moment you are near');
  assert.equal(s.waitCounter, 0, 'and StartWaiting reset it');

  // the radius test is STRICT less-than
  const edge = new EnemySoundSource(RAT, scripted(0));
  for (let i = 0; i < 5; i++) edge.tick(1, 100);
  assert.equal(edge.tick(0.016, ATTRACT_RADIUS), null, 'exactly 16 is OUT');
  assert.ok(edge.tick(0.016, ATTRACT_RADIUS - 1e-9), 'a hair under is IN');
});

test('audit24 wave41: bark is the 80% arm, and the reset happens either way', () => {
  const row = ENEMY_BASICS[RAT];
  assert.notEqual(row.moveSound, row.barkSound, 'the two clips differ, so the pin can tell them apart');

  // `Random.value > 0.8f` picks MOVE - so the move sound is the RARE
  // one and DFU's comment ("Random chance favors bark sound") is right.
  // one source per roll, each fired once: rolls[0] is the initial
  // delay, rolls[1] the move-vs-bark pick.
  const pick = (r) => new EnemySoundSource(RAT, scripted(0, r, 0)).tick(4, 1).clip;
  assert.equal(pick(0.5), row.barkSound, '0.5 is not > 0.8, so bark');
  assert.equal(pick(0.81), row.moveSound, '0.81 IS > 0.8, so move');
  assert.equal(pick(0.8), row.barkSound, 'exactly 0.8 is not greater than 0.8');
  assert.equal(pick(0.999), row.moveSound);
  assert.equal(pick(0), row.barkSound);

  // A MUTED source still resets its timer: DFU returns from inside
  // PlayAttractSound, after the caller committed to StartWaiting.
  const brig = new EnemySoundSource(BRIGAND, scripted(0));
  brig.tick(4, 1);
  assert.equal(brig.waitCounter, 0, 'the counter was reset even though nothing played');
});

test('audit24 wave41: SetVolumeScale is lazy, and it leaves the attack sound stale', () => {
  const row = ENEMY_BASICS[RAT];
  assert.notEqual(row.attackSound, null);

  // :234 - "Only checks when enemy plays attract sound, so not very
  // expensive." The probe is a thunk and must not be called on a tick
  // that plays nothing.
  let casts = 0;
  const probe = () => { casts++; return false; };
  const s = new EnemySoundSource(RAT, scripted(0, 0.5, 0));
  for (let i = 0; i < 10; i++) s.tick(1, 100, probe);   // out of range: due, but silent
  assert.ok(s.waitCounter > s.waitTime, 'the counter is past the delay');
  assert.equal(casts, 0, 'no cast while nothing is playing');
  s.tick(0.1, 1, probe);
  assert.equal(casts, 1, 'exactly one, on the tick that played');

  // ...and the ORDER matters as much as the count. IgnoreHumanSounds
  // returns at the top of PlayAttractSound (:205-207), BEFORE
  // SetVolumeScale (:209), so a muted enemy that is due and in range
  // still casts nothing. An eager probe hoisted up into FixedUpdate
  // would look identical on every unmuted foe and cast a ray per
  // brigand per cadence for a sound nobody hears.
  let mutedCasts = 0;
  const brig = new EnemySoundSource(BRIGAND, scripted(0));
  for (let i = 0; i < 10; i++) brig.tick(1, 1, () => { mutedCasts++; return true; });
  // AUDIT 58: `waitCounter >= 0` was VACUOUS - the field starts at 0
  // (enemySounds.js:98), only ever takes `dt > 0 ? dt : 0` (:113) or a
  // reset to 0 (:120), so it is non-negative by construction and the
  // assertion held even for a source whose clock never advanced at all,
  // which is exactly what its message claimed to exclude. scripted(0)
  // makes StartWaiting roll 3 every time (:196-200), so at dt 1 the muted
  // foe fires and resets on tick 4 of each cycle and 10 ticks leave 2.
  assert.equal(brig.waitCounter, 2, 'it ticked, and the muted foe still reset on its 4s cadence');
  assert.equal(mutedCasts, 0, 'a muted foe never probes');

  // occluded -> 0.25
  const occ = new EnemySoundSource(RAT, scripted(0, 0.5, 0));
  const o = occ.tick(4, 1, () => true);
  assert.equal(o.volume, OCCLUDED_VOLUME_SCALE);

  // THE STALE FIELD, verbatim. volumeScale is written only by
  // SetVolumeScale inside PlayAttractSound, and PlayAttackSound then
  // multiplies by it (:110). So a foe whose last bark was muffled
  // keeps SWINGING quietly after it walks into the open.
  occ.rolls = () => 0.9;   // > 0.5, so the attack sound plays
  assert.equal(occ.attack().volume, OCCLUDED_VOLUME_SCALE, 'the attack rides the stale scale');
  // and one that has never barked swings at full volume
  const fresh = new EnemySoundSource(RAT, () => 0.9);
  assert.equal(fresh.volumeScale, 1);
  assert.equal(fresh.attack().volume, 1);
});

test('audit24 wave41: PlayAttackSound is about half the time', () => {
  const row = ENEMY_BASICS[RAT];
  assert.equal(new EnemySoundSource(RAT, () => 0.51).attack().clip, row.attackSound);
  assert.equal(new EnemySoundSource(RAT, () => 0.5).attack(), null, 'exactly 0.5 is not > 0.5');
  assert.equal(new EnemySoundSource(RAT, () => 0.49).attack(), null);
  // a row with no attack sound says nothing rather than playing null
  const noSound = new EnemySoundSource(99999, () => 0.9);
  assert.equal(noSound.attack(), null);
});

test('audit24 wave41: the host seam - the occlusion cast and the LINEAR rolloff', () => {
  // The port's collider holds static geometry and action doors and
  // nothing else, which is exactly the two things DFU dampens for.
  const clear = { raycast: () => Infinity };
  const wall = { raycast: () => 2 };
  assert.equal(enemySoundOccluded(clear, [0, 0, 0], [0, 0, 10]), false);
  assert.equal(enemySoundOccluded(wall, [0, 0, 0], [0, 0, 10]), true, 'a wall two metres out');
  assert.equal(enemySoundOccluded({ raycast: () => 10 }, [0, 0, 0], [0, 0, 10]), false,
    'a hit AT the player is the player, not a wall');
  assert.equal(enemySoundOccluded(null, [0, 0, 0], [0, 0, 10]), false, 'no collider, no dampening');
  assert.equal(enemySoundOccluded(wall, [0, 0, 0], null), false, 'no player yet');

  // the play: linear rolloff bounded at the attract radius, a metre up
  const played = [];
  const audio = { play3d: (clip, pos, vol, opts) => played.push({ clip, pos, vol, opts }) };
  playEnemyClip(audio, { clip: 42, volume: 0.25 }, [1, 0, 2]);
  assert.equal(played.length, 1);
  assert.deepEqual(played[0].pos, [1, 1, 2], 'a metre above the feet');
  assert.equal(played[0].vol, 0.25);
  assert.equal(played[0].opts.distanceModel, 'linear', "LinearRolloff = true (:57-60)");
  assert.equal(played[0].opts.maxDistance, ATTRACT_RADIUS, 'maxDistance = AttractRadius');
  assert.equal(playEnemyClip(audio, null, [0, 0, 0]), null);
  assert.doesNotThrow(() => playEnemyClip(null, { clip: 1, volume: 1 }, [0, 0, 0]), 'a host with no audio');

  // and play3d really can take the model now
  assert.match(rd('src/systems/audio.js'), /distanceModel = 'inverse', pitch = 1 \} = \{\}\)/,
    'inverse stays the default (AUDIT 58 added pitch beside it, at 1)');
  assert.match(rd('src/systems/audio.js'), /pan\.distanceModel = distanceModel;/);

  // the whole FixedUpdate, end to end
  played.length = 0;
  const src = new EnemySoundSource(RAT, scripted(0, 0.5, 0));
  tickEnemySound(src, [0, 0, 0], [0, 0, 100], 4, { audio, collider: clear });
  assert.equal(played.length, 0, 'out of range');
  tickEnemySound(src, [0, 0, 0], [0, 0, 5], 0.1, { audio, collider: clear });
  assert.equal(played.length, 1, 'in range, and it spoke');
  assert.equal(played[0].clip, ENEMY_BASICS[RAT].barkSound);
});

test('audit24 wave41: all three pools ask the one home, and nobody keeps a copy', () => {
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    const src = rd(f);
    // as STATEMENTS: `assert.match(src, /tickEnemySound\(/)` is
    // satisfied by `if (false) tickEnemySound(...)`, which is exactly
    // how three of wave 42's mutants survived their first campaign.
    assert.ok(callsAsStatement(src, 'tickEnemySound'), `${f}: runs the attract cadence`);
    assert.match(src, /playEnemyClip\(audio, [a-z]\.sounds\.attack\(\)/, `${f}: and the attack sound`);
    assert.match(src, /EnemySoundSource/, `${f}: through the shared source`);
    // no pool re-derives the cadence for itself any more
    assert.doesNotMatch(src, /_attractWait|_attractT/, `${f}: no private timer`);
    assert.doesNotMatch(src, /Math\.random\(\) > 0\.8|Math\.random\(\) <= 0\.5/, `${f}: no private roll`);
  }
  // the watch's invented detection-edge bark is gone
  assert.doesNotMatch(rd('src/scenes/cityGuards.js'), /_halted/, 'and the flag it rode');

  // ONE DFU MEMBER, ONE EXPORT: 146 was written out in five places.
  assert.match(rd('src/characters/mobileTypes.js'), /export const KNIGHT_CITY_WATCH = MOBILE_TYPES\.Knight_CityWatch;/);
  for (const f of ['src/scenes/hostCombat.js', 'src/characters/enemyEntity.js',
    'src/scenes/cityGuards.js', 'src/combat/enemyEquipment.js', 'src/characters/enemySounds.js']) {
    assert.doesNotMatch(rd(f), /= 146;|=== 146\b/, `${f}: no second copy of the id`);
  }
});
