// AUDIT 39 (combat-formulas): five laws that were computed and then
// thrown away, or read off a field nobody writes.
//
//   #66  fpArm is a module SINGLETON and only the constructor bound it,
//        so the last rig built owned the arm - one dungeon visit pinned
//        the walk/run/sneak animation to a dead context's frozen eye.
//   #67  SuppressOptionalCombatVoices was unported behind a flag that
//        claimed the port had no racial override to ask.
//   #68  the monster multi-attack gate read the TARGET's reflexes where
//        DFU always reads the PLAYER's.
//   #83  the racial-override hit hook stamped satiation at minute 0, so
//        feeding STARVED a vampire and killing reset nothing.
//   #157 ImprovesTalents' hearing and adrenaline flags decoded into the
//        enchantment fold and were read off top-level entity fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { calculateAttackDamage, adrenalineRushToHit, setRacialHitHook, ADRENALINE_RUSH_MODIFIER, IMPROVED_ADRENALINE_RUSH_MODIFIER } from '../src/combat/formulas.js';
import { playerAttackGrunt, playerPainVoice, suppressOptionalCombatVoices } from '../src/scenes/hostCombat.js';
import { acuteHearingMultiplier } from '../src/characters/enemySounds.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { fpArm } from '../src/combat/fpArm.js';
import { SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

// ---------------------------------------------------------------
// #66 - the arm follows the FRAME, not the constructor
// ---------------------------------------------------------------

test('AUDIT 39 #66: the rig that steps (and the rig that draws) re-claims the fpArm singleton', () => {
  const CANVAS = { clientWidth: 800, clientHeight: 600 };
  const mkRig = (renderer, camera) => createWeaponRig({
    renderer, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); },
    palette: null, audio: { playOneShot() {} }, entity: { items: [] }, camera,
  });
  // fpArm is the module singleton every rig shares; attach() is its ONE
  // writer, so a spy over it is exactly what the hosts fight over.
  const real = fpArm.attach;
  const bound = [];
  try {
    fpArm.attach = (r, cam) => { bound.push([r, cam]); real.call(fpArm, r, cam); };
    const rendererA = { id: 'exterior' }, camA = () => ({ pos: [0, 0, 0], yaw: 0 });
    const rigA = mkRig(rendererA, camA);
    // the dungeon opens: its rig is built LAST and takes the singleton,
    // and its camera latch outlives the context that fed it.
    const rendererB = { id: 'dungeon' }, camB = () => null;
    mkRig(rendererB, camB);
    assert.deepEqual(bound.at(-1), [rendererB, camB], 'the later rig owns it at construction (the old behaviour)');
    // back outside: the exterior rig steps the arm, so it binds first.
    rigA.frame(0.016);
    assert.deepEqual(bound.at(-1), [rendererA, camA], 'frame() re-claims the arm for the stepping rig');
    bound.length = 0;
    rigA.draw();
    assert.deepEqual(bound.at(-1), [rendererA, camA], 'draw() re-claims it too - the arm renders through this renderer');
  } finally {
    fpArm.attach = real;
    fpArm.attach(null, null);
  }
});

// ---------------------------------------------------------------
// #67 - SuppressOptionalCombatVoices
// ---------------------------------------------------------------

const werewolf = (isTransformed) => ({
  race: 'Breton', gender: 'male', maxHealth: 40,
  activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed }],
});

test('AUDIT 39 #67: a TRANSFORMED lycanthrope grunts and screams as itself, not as a Breton', () => {
  // LycanthropyEffect.cs:105-108 is the one override of
  // RacialOverrideEffect.SuppressOptionalCombatVoices, and DFU tests it
  // ahead of the Dice100 draw at both player sites
  // (WeaponManager.cs:385-388, PlayerFootsteps.cs:352-354).
  assert.equal(suppressOptionalCombatVoices(werewolf(true)), true);
  assert.equal(suppressOptionalCombatVoices(werewolf(false)), false, 'the human form keeps its voices');
  assert.equal(suppressOptionalCombatVoices({}), false, 'the base property is false - no override, no suppression');

  // AND THE ROLL STREAM IS UNCHANGED: C#'s && short-circuits before
  // SuccessRoll, so a suppressed voice draws nothing at all.
  let draws = 0;
  const rolls = () => { draws++; return 0; };
  assert.equal(playerAttackGrunt(werewolf(true), false, rolls), null);
  assert.equal(playerPainVoice(werewolf(true), 10, rolls), null);
  assert.equal(draws, 0, 'suppression short-circuits AHEAD of the Dice100 draw');

  // the untransformed werewolf still speaks - the gate is the form, not
  // the curse (roll 0 passes both the 20% and the 40%).
  assert.ok(playerAttackGrunt(werewolf(false), false, seq(0, 0, 0))?.clip >= 0);
  assert.ok(playerPainVoice(werewolf(false), 10, seq(0, 0, 0))?.clip >= 0);
});

test('AUDIT 39 #67: the stale flag is gone from combatVoices', () => {
  const s = src('combat/combatVoices.js');
  assert.equal(/the port has no racial-override effect to ask yet/.test(s), false,
    'both curses shipped - the blocker retired');
  assert.match(s, /SuppressOptionalCombatVoices/, 'the remaining law is named where it is enforced');
});

// ---------------------------------------------------------------
// #68 - the multi-attack gate reads the PLAYER's reflexes
// ---------------------------------------------------------------

const monster = {
  isPlayer: false, isClass: false, level: 2, skills: 40,
  stats: { strength: 50, agility: 50, luck: 50 }, attackModifierFlags: 0,
  basics: { minDamage: 2, maxDamage: 2, minDamage2: 0, maxDamage2: 0, minDamage3: 0, maxDamage3: 0 },
};
const foeTarget = { isPlayer: false, isClass: false, armor: 0, skills: 0, stats: { strength: 50, agility: 50, luck: 50 } };
/** struck part, then per span: crit roll (fails), hit roll (passes the
 *  3-point floor), damage roll. */
const attackRolls = () => seq(0, 0.99, 0, 0);

test('AUDIT 39 #68: the multi-attack reflex gate is the PLAYER\'s setting, whoever is bitten', () => {
  // FormulaHelper.cs:551 binds `player` from the game and :654 reads
  // `player.Reflexes` regardless of `target` - so an infighting monster
  // rolls the same band as one biting the player. dfRand 60 lands
  // between the Average band (50) and the VeryHigh one (70).
  const hit = calculateAttackDamage(monster, foeTarget, {
    dfRand: () => 60, rolls: attackRolls(), playerReflexes: 0,   // VeryHigh -> 70
  });
  assert.equal(hit, 2, 'a VeryHigh-reflex game lets the blow through');
  const missed = calculateAttackDamage(monster, foeTarget, {
    dfRand: () => 60, rolls: attackRolls(), playerReflexes: 4,   // VeryLow -> 30
  });
  assert.equal(missed, 0, 'and a VeryLow one gates it out');
  // the old law read the struck entity, which carries no such field:
  // every foe-vs-foe strike rolled a flat 50 whatever the player chose.
  assert.equal(calculateAttackDamage(monster, foeTarget, { dfRand: () => 60, rolls: attackRolls() }), 0,
    'unset, the gate is Average (50) - not the target\'s missing field');
  // a strike AT the player finds the field on the target itself, which
  // is the read that was already correct.
  const player = { ...foeTarget, isPlayer: true, reflexes: 0 };
  assert.equal(calculateAttackDamage(monster, player, { dfRand: () => 60, rolls: attackRolls() }), 2);
});

test('AUDIT 39 #68: the foe-vs-foe seam hands the formula the player\'s value', () => {
  const s = src('scenes/hostCombat.js');
  assert.match(s, /playerReflexes: attacker\.attack\?\.reflexes/,
    'ApplyDamageToNonPlayer passes it - every pool seeds attack.reflexes from playerEntity');
  for (const host of ['scenes/cityGuards.js', 'scenes/dungeonContext.js', 'scenes/exteriorFoes.js']) {
    assert.match(src(host), /reflexes: (?:D\.)?playerEntity\.reflexes/, `${host} seeds it`);
  }
});

// ---------------------------------------------------------------
// #83 - the satiation stamp is the LIVE minute
// ---------------------------------------------------------------

test('AUDIT 39 #83: the racial-override hit hook is stamped with the live classic minute', () => {
  const seen = [];
  try {
    setRacialHitHook((a, t, ctx) => seen.push(ctx));
    const attacker = {
      isPlayer: true, racialOverride: { racial: 'vampirism' }, level: 3, skills: 40,
      stats: { strength: 50, agility: 50, luck: 50 },
      lastGameMinutes: 523530 + 4000,   // the classic start plus a few days
    };
    calculateAttackDamage(attacker, foeTarget, { rolls: seq(0, 0.99, 0, 0) });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].nowMinutes, 527530,
      'UpdateSatiation stamps the clock, and 0 makes a fed vampire read unfed forever');
    // an explicit ctx still wins - the host is the authority when it has one
    seen.length = 0;
    calculateAttackDamage(attacker, foeTarget, { rolls: seq(0, 0.99, 0, 0), enchantCtx: { nowMinutes: 99 } });
    assert.equal(seen[0].nowMinutes, 99);
  } finally {
    setRacialHitHook(null);
  }
});

// ---------------------------------------------------------------
// #157 - ImprovesTalents' two dead readers
// ---------------------------------------------------------------

test('AUDIT 39 #157: both improved-talent consumers read the enchantment fold', () => {
  // ImprovesTalents.cs:79-86 sets the entity flags FormulaHelper.cs:1175
  // and DaggerfallEnemy.cs:69 read; here the fold's bag IS that entity
  // field, and the consumers were asking a property nothing assigns.
  const rusher = (mods) => ({
    career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.adrenalineRush },
    health: 11, maxHealth: 96, isPlayer: true, stats: {}, skills: {}, _enchantMods: mods,
  });
  const plain = { career: { abilityFlagsAndSpellPointsBitfield: 0 }, health: 50, maxHealth: 96, isPlayer: true, stats: {}, skills: {} };
  assert.equal(adrenalineRushToHit(rusher(null), plain), ADRENALINE_RUSH_MODIFIER);
  assert.equal(adrenalineRushToHit(rusher({ improvedAdrenalineRush: true }), plain), IMPROVED_ADRENALINE_RUSH_MODIFIER);

  const hearer = { career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.acuteHearing } };
  assert.equal(acuteHearingMultiplier(hearer), 1.25);
  assert.equal(acuteHearingMultiplier({ ...hearer, _enchantMods: { improvedAcuteHearing: true } }), 1.5);
  // the flag that called the enchantment unported is gone from both
  assert.equal(/unported enchantment/.test(src('characters/enemySounds.js')), false);
  assert.equal(/ImprovedAdrenalineRush is an unported enchantment/.test(src('combat/formulas.js')), false);
});
