// AUDIT 26 - the combat/damage cluster (F035/F041, F038, F040,
// F052/F053, F206).
//
// F035/F041: sourceless damage must not run the player-attack door's
//       side effects - EnemyMotor.ApplyFallDamage calls DecreaseHealth
//       and nothing else (:1398-1401), while the Murder crime
//       (:265-269) and the hostility flip (:250-261) both sit inside
//       HandleAttackFromSource's `source == Player` gate (:203).
// F038: the acquittal calls FillVitalSigns (DaggerfallCourtWindow
//       :191) - a FULL refill, not a floor, and not on release.
// F040: every enemy fall past the threshold bleeds (EnemyMotor
//       :1403-1407) - the guard pool billed and sounded but never bled.
// F052/F053: an arrow runs the same WeaponDamage a swing does, whose
//       damage-above-zero arm plays the hit sound and splashes at the
//       impact point (:562-573); and a missed enemy arrow rings
//       PlayMissSound (EnemyAttack.cs:297-298).
// F206: a damaging fall flashes - RemoveHealth opens with
//       ShowPlayerDamage.Flash (:36-38) and ApplyPlayerFallDamage
//       goes through it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fillVitalSigns, maxFatigue } from '../src/systems/statMods.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F035 / F041 ───────────────────────────────────────────────────

test('F035/F041: every damage door takes a provenance flag, defaulting TRUE', () => {
  // The hurtPlayer(bypassShield) idiom: one door, and the caller says
  // where the blow came from. Defaulting true leaves every player
  // blow and spell exactly as it was.
  assert.ok(src('scenes/cityGuards.js').includes('function damageGuard(g, damage, playerFeet, knockDir, { fromPlayer = true } = {})'));
  assert.ok(src('scenes/exteriorFoes.js').includes('function damageFoe(f, damage, playerFeet, knockDir = null, { fromPlayer = true } = {})'));
  assert.ok(src('scenes/dungeonContext.js').includes('function damageFoe(foe, damage, playerFeet = null, knockDir = null, { fromPlayer = true } = {})'));
});

test('F035: the Murder crime is gated on the player being the source', () => {
  const cg = src('scenes/cityGuards.js');
  // inside damageGuard, the assignment is now conditional...
  assert.ok(cg.includes('if (fromPlayer) setCrimeCommitted(playerEntity, CRIME_MURDER);'),
    'a watchman who dies falling brands nobody');
  // ...and the CIVILIAN murder arm, which IS a player weapon hit,
  // stays unconditional - the two must not be confused.
  const civ = cg.slice(cg.indexOf('best.disable();'));
  assert.ok(civ.slice(0, 300).includes('setCrimeCommitted(playerEntity, CRIME_MURDER);'),
    'a struck civilian is still Murder, unconditionally');
  assert.equal(civ.slice(0, 300).includes('if (fromPlayer)'), false);
});

test('F041: the hostility flip is gated the same way, in both foe pools', () => {
  // MT-ii widened the ENCOUNTER pool's arm inside this same gate to
  // the whole of MakeEnemyHostileToAttacker (EnemyMotor.cs:186-214) -
  // there is a target to reassign now, and a struck ally to revert -
  // so its shape is `if (fromPlayer && f.ai) { ... }`. The LAW the
  // pin guards is unchanged and asserted for both: nothing
  // re-hostiles a foe unless the PLAYER was the source. The dungeon
  // host keeps the narrow arm until MT-iv arms it.
  assert.match(src('scenes/dungeonContext.js'), /if \(fromPlayer && foe\.ai && !foe\.ai\.isHostile\)/,
    'scenes/dungeonContext.js re-hostiles only for a PLAYER source');
  const xf = src('scenes/exteriorFoes.js');
  assert.match(xf, /if \(fromPlayer && f\.ai\) \{\n\s*f\.ai\.makeEnemyHostileToAttacker\?\.\(PLAYER_TARGET/,
    'scenes/exteriorFoes.js re-hostiles only for a PLAYER source');
  assert.ok(!/f\.ai\.makeEnemyHostileToAttacker\?\.\(PLAYER_TARGET[\s\S]{0,400}\n  \}/.test(xf.slice(xf.indexOf('function damageFoe')).split('if (fromPlayer')[0]),
    'and nothing outside the gate raises hostility');
});

test('F035/F041: the FALL arms - and MT-ii\'s foe-source door - pass fromPlayer false', () => {
  const files = ['scenes/cityGuards.js', 'scenes/exteriorFoes.js', 'scenes/dungeonContext.js'];
  let falseCalls = 0;
  for (const f of files) {
    const s = src(f);
    const hits = [...s.matchAll(/\{ fromPlayer: false \}/g)];
    // MT-ii gave the two EXTERIOR pools a SECOND sourceless caller:
    // `hurtFromFoe`, the cross-pool door another enemy's blow lands
    // through. Another enemy's blow is not the player's either, and
    // getting that wrong would re-hostile the victim toward the
    // player and revert a struck ally's team for a blow the player
    // never struck. The dungeon keeps its single fall arm (MT-iv).
    const expected = f.includes('dungeon') ? 1 : 2;
    assert.equal(hits.length, expected, `${f} has ${expected} sourceless caller(s)`);
    falseCalls += hits.length;
    // every one of them is either the FALL arm or the foe-source door
    for (const h of hits) {
      const before = s.slice(Math.max(0, h.index - 700), h.index);
      assert.ok(before.includes('landedFall') || before.includes('hurtFromFoe'),
        `${f}: a sourceless call is the FALL arm or the foe-source door`);
    }
  }
  assert.equal(falseCalls, 5);
});

// ── F038 ──────────────────────────────────────────────────────────

test('F038: fillVitalSigns is a FULL refill of all three pools', () => {
  // DaggerfallEntity.cs:442-447 - health, fatigue and magicka to max.
  const e = {
    health: 1, maxHealth: 47,
    magicka: 3, maxMagicka: 62,
    fatigue: 5,
    stats: { strength: 50, endurance: 40 },
  };
  fillVitalSigns(e);
  assert.equal(e.health, 47);
  assert.equal(e.magicka, 62);
  assert.equal(e.fatigue, maxFatigue(e), 'fatigue rides the live formula, not a stored max');
  fillVitalSigns(null);   // a missing entity is a no-op, not a throw
});

test('F038: the acquittal refills; release keeps its own floor, named as such', () => {
  const a = src('scenes/arrestFlow.js');
  const free = a.slice(a.indexOf("if (r.outcome === 'free')"));
  assert.ok(free.slice(0, 700).includes('fillVitalSigns(playerEntity);'),
    'surrender forces health to 1, so an acquittal without this walks out on 1 HP');
  // the old comment claimed the refill was a "floor" belonging to
  // release - both halves wrong: ReleaseFromPrison (:482-490) never
  // touches health.
  assert.equal(a.includes("FillVitalSigns' floor (full refill pends vitals wiring)"), false);
  assert.ok(a.includes("// the port's own floor, not DFU's"));
});

// ── F040 / F206 ───────────────────────────────────────────────────

test('F040: a falling watchman bleeds, like every other falling enemy', () => {
  const cg = src('scenes/cityGuards.js');
  const arm = cg.slice(cg.indexOf('if (g.ai.landedFall > 0'));
  assert.ok(arm.slice(0, 1600).includes('hitEffects?.showBloodSplash(0, [g.ai.feet[0], g.ai.feet[1], g.ai.feet[2]]);'),
    'ShowBloodSplash(0, position) on every fall past the threshold');
  // the sibling pool has done this since CH3 - one law, both pools
  const xf = src('scenes/exteriorFoes.js');
  const xarm = xf.slice(xf.indexOf('if (f.ai.landedFall > 0'));
  assert.ok(xarm.slice(0, 900).includes('hitEffects?.showBloodSplash(0,'));
});

test('F206: a damaging fall in a dungeon flashes the screen', () => {
  const d = src('scenes/dungeonContext.js');
  const arm = d.slice(d.indexOf('if (fell > FALL_DAMAGE_THRESHOLD) {'));
  assert.ok(arm.slice(0, 400).includes('flashPlayerDamage();'), 'RemoveHealth opens with the flash');
  // the stale "pends the HUD arc" note is gone - the file already
  // flashed for arrows and melee, and the shared helper flashes here.
  assert.equal(d.includes('The\n      // ShowPlayerDamage screen flash pends the HUD arc (flagged).'), false);
  assert.ok(src('scenes/shared.js').includes('flashPlayerDamage();'), 'the other three hosts route through this');
});

// ── F052 / F053 ───────────────────────────────────────────────────

test('F052: a landed player arrow thuds and splashes, at the real impact point', () => {
  const d = src('scenes/dungeonContext.js');
  const arm = d.slice(d.indexOf('// AUDIT 26 F052'));
  assert.ok(arm.slice(0, 1400).includes('audio.play3d(hitSoundFor(m.weapon), f.ai.feet, 1.1, { maxDistance: 16 });'),
    'the enemy-side hit sound (:562-567)');
  assert.ok(arm.slice(0, 1400).includes("hitEffects?.showBloodSplash(ENEMY_BASICS[f.mobileType]?.bloodIndex ?? 0, [m.pos[0], m.pos[1], m.pos[2]]);"),
    'and the splash at the MISSILE position - DFU\'s impactPosition (:569-573)');
  // ordering: sound and blood come BEFORE the pain voice and the
  // knockback, as WeaponDamage has them
  const sound = arm.indexOf('audio.play3d(hitSoundFor(m.weapon)');
  const pain = arm.indexOf('enemyPainVoice(f, dmg)');
  const knock = arm.indexOf('damageFoe(f, dmg, null, m.dir)');
  assert.ok(sound > -1 && sound < pain && pain < knock, 'sound, blood, then the voice and the knockback');
});

test('F053: a missed enemy arrow rings, like a missed enemy swing', () => {
  const d = src('scenes/dungeonContext.js');
  // the BRANCH, not just its body - a dead `else if (false)` would
  // keep the comment and the call while ringing nothing.
  assert.ok(d.includes('} else if (m.shooterFoe) {'), 'the miss arm is live, and needs a shooter to sound from');
  const arm = d.slice(d.indexOf('} else if (m.shooterFoe) {'));
  assert.ok(arm.slice(0, 900).includes('audio.play3d(enemyMissSound(m.weapon),'),
    'ApplyDamageToPlayer\'s else arm (:297-298), on the SHOOTER\'s source');
  // the melee arm has always had this else - the arrow arm did not
  assert.ok(d.includes('else audio.play3d(enemyMissSound(wpn),'), 'the melee twin still stands');
});
