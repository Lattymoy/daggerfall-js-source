// VU1 - THE VAMPIRE TAKES THE UNDEAD MODIFIER (2026-08-28).
//
// GetBonusOrPenaltyByEnemyType (FormulaHelper.cs:1042-1054) has TWO
// arms for a player target, and DFU comments the first itself:
//
//   if (GameManager.Instance.PlayerEffectManager.HasVampirism())
//       // Vampires are undead, therefore use undead modifier
//       ...UndeadAttackModifier...
//   else
//       // Player is assumed humanoid
//       ...HumanoidAttackModifier...
//
// The port had only the else, behind a flag reading "the vampirism
// effect is not ported, so only the humanoid arm exists here". By the
// time this slice read it, systems/vampirism.js had shipped - curse,
// clans, spells and a live `liveVampirism` predicate - some slices
// earlier. THE BLOCKER RETIRED AND THE SENTENCE DID NOT, so every
// vampire character took the wrong modifier from every attacker.
//
// It is not a rounding difference either: the two career flags are
// INDEPENDENT bitfields, so an attacker with a humanoid bonus and no
// undead flag was helping itself against a vampire it should have been
// neutral to, and one with an undead PHOBIA lost its penalty entirely.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bonusOrPenaltyByEnemyType } from '../src/combat/formulas.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// DFCareer.StructureData's attack-modifier byte, read off the port's
// own GROUP_BITS table rather than guessed: [bonus, phobia] per group,
// indexed Undead 0, Daedra 1, Humanoid 2, Animals 3.
const UNDEAD_BONUS = 0x01, UNDEAD_PHOBIA = 0x10;
const HUMANOID_BONUS = 0x04, HUMANOID_PHOBIA = 0x40;

const attacker = (flags, level = 7) => ({ level, attackModifierFlags: flags });
/** A player target; `vampire` adds the live racialOverride entry
 *  liveVampirism looks for (vampirism.js:97-99). */
const player = (vampire = false) => ({
  isPlayer: true,
  activeEffects: vampire ? [{ kind: 'racialOverride', racial: 'vampirism', ended: false }] : [],
});

test('VU1: a vampire player is UNDEAD to the attacker, not humanoid', () => {
  // an attacker that fears the undead takes its penalty against a
  // vampire and is unmoved by a mortal
  const feared = attacker(UNDEAD_PHOBIA);
  assert.equal(bonusOrPenaltyByEnemyType(feared, player(true)), -7, 'the phobia bites a vampire');
  assert.equal(bonusOrPenaltyByEnemyType(feared, player(false)), 0, 'and not a mortal');
  // ...and one that hunts the undead gains against a vampire
  const hunter = attacker(UNDEAD_BONUS);
  assert.equal(bonusOrPenaltyByEnemyType(hunter, player(true)), 7);
  assert.equal(bonusOrPenaltyByEnemyType(hunter, player(false)), 0);
});

test('VU1: the humanoid arm STOPS applying once the player is a vampire', () => {
  // the half the bug actually cost: a humanoid bonus was landing on a
  // vampire, which DFU never does.
  const a = attacker(HUMANOID_BONUS);
  assert.equal(bonusOrPenaltyByEnemyType(a, player(false)), 7, 'a mortal player is humanoid');
  assert.equal(bonusOrPenaltyByEnemyType(a, player(true)), 0,
    'a vampire is NOT humanoid - the bonus does not apply');
  const p = attacker(HUMANOID_PHOBIA);
  assert.equal(bonusOrPenaltyByEnemyType(p, player(false)), -7);
  assert.equal(bonusOrPenaltyByEnemyType(p, player(true)), 0);
});

test('VU1: the two flag sets are INDEPENDENT - the arms do not share a bit', () => {
  // an attacker carrying both a humanoid bonus and an undead phobia
  // flips SIGN when the player turns, which no single-arm port can do.
  const both = attacker(HUMANOID_BONUS | UNDEAD_PHOBIA);
  assert.equal(bonusOrPenaltyByEnemyType(both, player(false)), 7);
  assert.equal(bonusOrPenaltyByEnemyType(both, player(true)), -7);
  // and DFU's EXCLUSIVE decode still holds on the arm this slice
  // switched to: GetAttackModifier tests bonus FIRST and returns, so a
  // career carrying both bits for one group is a BONUS, never a wash.
  // (AUDIT 18 found the port summing them to 0 and asserting the
  // inverse of the C#; the first draft of THIS pin repeated the same
  // wrong belief and the run caught it.)
  assert.equal(bonusOrPenaltyByEnemyType(attacker(UNDEAD_BONUS | UNDEAD_PHOBIA), player(true)), 7,
    'both bits set is a BONUS - bonus is tested first and returns');
});

test('VU1: an ENDED curse is not vampirism - the cured player is humanoid again', () => {
  // liveVampirism tests `!a.ended`, so a cure restores the humanoid
  // arm rather than leaving the entry to speak for a mortal.
  const cured = { isPlayer: true, activeEffects: [{ kind: 'racialOverride', racial: 'vampirism', ended: true }] };
  assert.equal(bonusOrPenaltyByEnemyType(attacker(HUMANOID_BONUS), cured), 7);
  assert.equal(bonusOrPenaltyByEnemyType(attacker(UNDEAD_BONUS), cured), 0);
  // ...and a WEREWOLF is not undead either - the predicate is keyed to
  // the vampirism racial, not to racialOverride in general
  const wolf = { isPlayer: true, activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', ended: false }] };
  assert.equal(bonusOrPenaltyByEnemyType(attacker(HUMANOID_BONUS), wolf), 7, 'a werewolf is still humanoid');
  assert.equal(bonusOrPenaltyByEnemyType(attacker(UNDEAD_BONUS), wolf), 0);
});

test('VU1: the flag is gone, and the arm reads the ONE vampirism predicate', () => {
  const f = readFileSync(join(HERE, '..', 'src', 'combat', 'formulas.js'), 'utf8');
  // EF1c's rule, reused rather than reinvented: ban the claim as an
  // ASSERTION, not as a quotation. VU1's own correction quotes the
  // retired sentence so the next reader can see what was wrong, and a
  // bare phrase test flagged it - which is how EF1c's sweep failed
  // first too. Strip quoted spans, then look at what is left.
  const unquoted = f.replace(/"[^"]*"/g, '""');
  assert.equal(/the vampirism effect is not ported/.test(unquoted), false,
    'the retired blocker must not survive as prose that reads current');
  assert.match(f, /"the vampirism effect is not ported/,
    'and it IS still quoted, so the correction says what it corrected');
  assert.match(f, /liveVampirism\(target\) \? ENEMY_GROUPS\.Undead : ENEMY_GROUPS\.Humanoid/,
    'and the arm goes through systems/vampirism.js rather than re-testing the entry shape here');
});
