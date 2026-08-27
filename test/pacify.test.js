// X8: PACIFY (33,0..3) and CHARM (34,255) - one effect split by target
// class, and the port's one recorded DEPARTURE from DFU's code in
// favour of DFU's stated intent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySpell, PACIFY_GROUP, isPacifyEffect, isCharmEffect } from '../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey } from '../src/systems/spellEffects.js';
import { NEARBY, enemyGroupOf } from '../src/systems/nearbyObjects.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const foe = (mobileType) => ({
  stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [],
  level: 1, health: 20, maxHealth: 20, mobileType,
});
// chanceMod 0 so the stored chance is exactly chanceBase
// AUDIT 26 F072/F073: the arm rolls the no-magnitude SAVING THROW
// after its chance now (EEM:565-580) - so the roll stream is a
// sequence: the FIRST draw is the OnCast chance (as before), and
// every later draw is the target's save, held high so the save FAILS
// and the effect lands. A constant low roll would have the target
// shrug every cast off - which is DFU's behaviour too, pinned in
// audit26_magicgates.test.js.
const seqRolls = (first) => { let i = 0; return () => (i++ === 0 ? first : 0.99); };
const cast = (target, type, subType, chanceBase = 100, roll = 0.0) => applySpell(
  buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), chanceBase, chanceMod: 0 } }], rangeType: 1 }),
  1, target, {}, seqRolls(roll), null, {});

test('X8: the four Pacify variants map to DFU\'s EnemyGroups in SetVariantProperties order', () => {
  // 0 Animals, 1 Undead, 2 Humanoid, 3 Daedra (PacifyEffect.cs:70-73)
  // - the CALL order, not alphabetical, and not the bit order either.
  assert.deepEqual({ ...PACIFY_GROUP },
    { 0: NEARBY.Animal, 1: NEARBY.Undead, 2: NEARBY.Humanoid, 3: NEARBY.Daedra });
  assert.equal(isPacifyEffect({ type: 33, subType: 0 }), true);
  assert.equal(isPacifyEffect({ type: 33, subType: 3 }), true);
  assert.equal(isPacifyEffect({ type: 33, subType: 4 }), false, 'there is no fifth variant');
  assert.equal(isCharmEffect({ type: 34, subType: 255 }), true);
  for (const k of ['33,0', '33,1', '33,2', '33,3', '34,255']) {
    assert.equal(effectByKey(k).ported, true, `${k} casts`);
  }
});

test('X8: Pacify lands on a MATCHING group and is silent on any other', () => {
  const rat = foe(0);            // Animal
  assert.equal(cast(rat, 33, 0).pacify, true, 'Pacify Animal on a rat');
  assert.equal(cast(foe(15), 33, 0).pacify, undefined, 'a skeleton is not an animal');
  assert.equal(cast(foe(15), 33, 1).pacify, true, 'Pacify Undead on a skeleton');
  assert.equal(cast(foe(25), 33, 3).pacify, true, 'Pacify Daedra on a frost daedra');
  assert.equal(cast(foe(25), 33, 1).pacify, undefined);
  // a mismatch is SILENT - DFU's is a bare `if`, with no failure
  assert.equal(cast(foe(15), 33, 0).chanceFailed, undefined,
    'a mismatch is not a failed roll, it is no roll at all');
});

test('X8: the Humanoid/Charm SPLIT - neither reaches the other\'s targets', () => {
  // Charm only works on enemy classes (IsEnemyClass); Pacify matches
  // the GROUP - and AUDIT 26 F080: GetEnemyEntityEnemyGroup switches
  // on CareerIndex, which for a class is ID - 128, so a class enemy
  // COLLIDES into a monster career's group. A Mage (128, career 0 =
  // Rat) is ANIMALS - so Pacify Humanoid still cannot touch it, but
  // Pacify Animal can, and that is DFU's shipping code whatever
  // PacifyEffect's own comment says.
  const orc = foe(7);            // a humanoid MONSTER
  const bandit = foe(128);       // an enemy CLASS - the Mage
  assert.equal(enemyGroupOf(7), NEARBY.Humanoid);
  assert.equal(enemyGroupOf(128), NEARBY.Animal, 'the Mage rides Rat\'s career slot');
  assert.equal(cast(orc, 33, 2).pacify, true, 'Pacify Humanoid takes the orc');
  assert.equal(cast(bandit, 33, 2).pacify, undefined, 'and cannot touch the bandit');
  assert.equal(cast(bandit, 34, 255).pacify, true, 'Charm takes the bandit');
  assert.equal(cast(orc, 34, 255).pacify, undefined, 'and cannot touch the orc');
  // the four atronachs have no group either, so nothing pacifies them
  for (const at of [35, 36, 37, 38]) {
    for (const v of [0, 1, 2, 3]) assert.equal(cast(foe(at), 33, v).pacify, undefined, `atronach ${at}`);
  }
});

test('X8: the chance gate is the ordinary OnCast roll, and it can fail', () => {
  assert.equal(cast(foe(0), 33, 0, 100, 0.0).pacify, true);
  const failed = cast(foe(0), 33, 0, 10, 0.9);
  assert.equal(failed.pacify, undefined);
  assert.equal(failed.chanceFailed, 1, 'a matching target with a failed roll IS a failure');
  // nothing is ever attached to the target - Pacify has no duration
  const t = foe(0);
  cast(t, 33, 0);
  assert.deepEqual(t.activeEffects, [], 'no entry, no rounds, nothing to expire');
});

test('X8: a non-enemy target takes nothing (IsGroupMatch / IsEnemyClass both refuse)', () => {
  const player = { stats: { luck: 50 }, skills: [], activeEffects: [], level: 1 };
  assert.equal(cast(player, 33, 2).pacify, undefined);
  assert.equal(cast(player, 34, 255).pacify, undefined);
  assert.deepEqual(player.activeEffects, []);
});

test('X8: the pacify lands ONCE at cast and is permanent - the assign-time magic round', () => {
  // CORRECTED IN X10. This test previously asserted the arm called
  // itself a DEPARTURE from a DFU bug, on the reasoning that:
  //   PacifyEffect and CharmEffect act in MagicRound(); neither sets
  //   SupportDuration (Charm's is commented out deliberately);
  //   SetDuration therefore leaves roundsRemaining = 0; and
  //   DoMagicRound's per-round gate only calls MagicRound() when
  //   RoundsRemaining > 0 - so the pacify never fires.
  // Every step of that is true except the conclusion. AssignBundle
  // gives EVERY effect one unconditional MagicRound at assign time
  // (EntityEffectManager.cs:594, "At this point effect is ready and
  // gets initial magic round"), outside any duration test. A
  // duration-less effect fires exactly once, at cast - which is the
  // whole design here, and matches DFU's own "pacified permanently
  // until player attacks them".
  // The port's BEHAVIOUR was right all along; the justification was
  // not, and a test that pinned the false justification would have
  // kept it alive. This one pins the real mechanism instead.
  const arm = readFileSync(join(ROOT, 'src/systems/effects.js'), 'utf8');
  assert.match(arm, /:594/, 'the arm cites AssignBundle\'s assign-time magic round');
  assert.match(arm, /initial magic round/, 'quoting DFU\'s own comment on it');
  assert.doesNotMatch(arm, /the pacify NEVER RUNS/,
    'and no longer claims DFU is broken here');
  // and the pacify is applied at CAST with no entry to expire, which
  // is what "permanent" means here
  const t = foe(0);
  const out = cast(t, 33, 0);
  assert.equal(out.pacify, true);
  assert.equal(t.activeEffects.length, 0);
});

test('X8: the pacify reaches the AI, and attacking restores hostility', () => {
  // These are host seams (they need a browser), so they are read
  // rather than run - the same convention hostmagic_wiring.test.js
  // uses. The flag lives on the foe RECORD, not the entity, so the
  // one door that holds both is where it can land.
  const host = readFileSync(join(ROOT, 'src/scenes/hostMagic.js'), 'utf8');
  assert.match(host, /if \(r\.pacify && foe\.ai\) foe\.ai\.isHostile = false;/,
    'applySpellToFoe is the one door holding both the result and the foe');
  // and it must sit inside applySpellToFoe, which EVERY player->foe
  // application routes through since X5
  const armStart = host.indexOf('function applySpellToFoe');
  const armEnd = host.indexOf('function applySpellToPlayer');
  assert.ok(armStart > 0 && armStart < armEnd);
  assert.ok(host.slice(armStart, armEnd).includes('r.pacify'));
  assert.doesNotMatch(host.slice(armEnd), /applySpell\(spell, casterLevel, t\.entity/,
    'no foe application bypasses the door');

  // THE OTHER HALF - "until PLAYER attacks them". Both foe damage
  // doors re-hostile a pacified target, which is what makes the
  // permanent pacify a real mechanic rather than an off switch.
  // AUDIT 26 F041 sharpened this to DFU's own wording: the flip sits
  // inside HandleAttackFromSource's player-source gate, so the door
  // now asks whose blow it was - a FALL no longer un-pacifies.
  for (const p of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(readFileSync(join(ROOT, p), 'utf8'),
      /if \(fromPlayer && (foe|f)\.ai && !\1\.ai\.isHostile\) \{ \1\.ai\.isHostile = true;/,
      `${p} restores hostility on a PLAYER attack`);
  }
  // the motor's own field names the mechanic it was waiting for
  assert.match(readFileSync(join(ROOT, 'src/characters/enemyMotor.js'), 'utf8'),
    /isHostile = true;\s*\/\/ EnemyMotor\.IsHostile - pacification/,
    'the seam was anticipated by name');
});
