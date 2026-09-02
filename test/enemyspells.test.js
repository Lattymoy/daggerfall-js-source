// S16: enemy spellcasting (audit F15) - the verbatim spell lists +
// SetEnemySpells, the SetEnemyCareer assignment tail, the
// already-on-target veto, and the classic casting AI decisions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MONSTER_SPELL_LISTS, ENEMY_CLASS_SPELLS, SPELL_CAST_SOUND,
  ENEMY_MAGIC_SKILL, setEnemySpells, assignEnemySpells,
} from '../src/systems/enemySpells.js';
import { SKILLS } from '../src/systems/skills.js';
import { skillValue } from '../src/systems/skills.js';
import { effectsAlreadyOnTarget } from '../src/systems/effects.js';
import {
  EnemyCaster, pickRangedSpell, pickTouchSpell,
  MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE, RANGED_SPELL_CHANCE,
} from '../src/characters/enemyCasting.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const mkSpell = (index, rangeType, effects = [{ type: 4, subType: 0 }]) => ({ index, rangeType, element: 0, effects });
const mapOf = (...spells) => new Map(spells.map((s) => [s.index, s]));

test('enemyspells: the verbatim lists + cast sounds', () => {
  // EnemyEntity.cs statics, byte-for-byte (spot pins + the full count)
  assert.deepEqual([...MONSTER_SPELL_LISTS[1]], [0x07, 0x0A, 0x1D, 0x2C]);          // Imp
  assert.deepEqual([...MONSTER_SPELL_LISTS[18]], [0x22]);                            // Ghost
  assert.deepEqual([...MONSTER_SPELL_LISTS[21]], [0x06, 0x07, 0x16, 0x19, 0x1F]);   // OrcShaman
  assert.deepEqual([...MONSTER_SPELL_LISTS[33]], [0x08, 0x0A, 0x0E, 0x1D, 0x1F, 0x22, 0x3C]);   // AncientLich
  assert.equal(Object.keys(MONSTER_SPELL_LISTS).length, 13);
  // EnemyClassSpells order: FrostDaedra, Daedroth, OrcShaman,
  // VampireAncient, DaedraLord, Lich, AncientLich
  assert.equal(ENEMY_CLASS_SPELLS.length, 7);
  assert.deepEqual([...ENEMY_CLASS_SPELLS[0]], [0x10, 0x14]);
  assert.deepEqual([...ENEMY_CLASS_SPELLS[6]], [...MONSTER_SPELL_LISTS[33]]);
  // cast sounds, element-indexed fire/cold/poison/shock/magic
  assert.deepEqual([...SPELL_CAST_SOUND], [352, 353, 350, 351, 349]);
});

test('enemyspells: SetEnemySpells - magicka rule, the six 80-skills, loud skips', () => {
  const ent = { level: 8, skills: 8, isClass: false, careerIndex: 1 };
  const spells = mapOf(mkSpell(0x07, 2), mkSpell(0x0A, 2), mkSpell(0x2C, 1));
  setEnemySpells(ent, [0x07, 0x0A, 0x1D, 0x2C], spells);   // 0x1D missing -> skipped loudly
  assert.equal(ent.maxMagicka, 10 * 8 + 100);
  assert.equal(ent.magicka, 180);
  assert.equal(ent.spells.length, 3);
  // the six magic skills pin at 80 over the flat career fill
  for (const id of [SKILLS.Destruction, SKILLS.Restoration, SKILLS.Illusion, SKILLS.Alteration, SKILLS.Thaumaturgy, SKILLS.Mysticism]) {
    assert.equal(skillValue(ent, id), ENEMY_MAGIC_SKILL);
  }
  assert.equal(skillValue(ent, SKILLS.LongBlade), 8);      // the base stays level-derived
});

test('enemyspells: the SetEnemyCareer assignment tail (monsters + class buckets)', () => {
  const spells = mapOf(
    ...[0x06, 0x07, 0x0A, 0x08, 0x0E, 0x10, 0x14, 0x16, 0x19, 0x1C, 0x1D, 0x1F, 0x22, 0x2C, 0x32, 0x33, 0x34, 0x3C, 0x43].map((i) => mkSpell(i, 2)),
  );
  // a monster with a list (Imp, careerIndex 1)
  const imp = { level: 2, isClass: false, careerIndex: 1 };
  assignEnemySpells(imp, spells);
  assert.equal(imp.spells.length, 4);
  // a monster without one (Rat) stays spell-less
  const rat = { level: 1, isClass: false, careerIndex: 0 };
  assignEnemySpells(rat, spells);
  assert.equal(rat.spells, undefined);
  // class enemies bucket by level/3 (C# int division), capped at 6
  const mage7 = { level: 7, isClass: true, careerIndex: 6, basics: { castsMagic: true } };
  assignEnemySpells(mage7, spells);   // 7/3 = 2 -> OrcShamanSpells
  assert.deepEqual(mage7.spells.map((s) => s.index), [0x06, 0x07, 0x16, 0x19, 0x1F]);
  const mage30 = { level: 30, isClass: true, careerIndex: 6, basics: { castsMagic: true } };
  assignEnemySpells(mage30, spells);  // 10 -> capped 6 -> AncientLichSpells
  assert.deepEqual(mage30.spells.map((s) => s.index), [0x08, 0x0A, 0x0E, 0x1D, 0x1F, 0x22, 0x3C]);
  // a non-caster class enemy gets nothing
  const warrior = { level: 9, isClass: true, careerIndex: 16, basics: { castsMagic: false } };
  assignEnemySpells(warrior, spells);
  assert.equal(warrior.spells, undefined);
});

test('enemyspells: EffectsAlreadyOnTarget - all-live vetoes, instants never count', () => {
  const cont = { type: 1, subType: 0, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 3, durationMod: 0, durationPerLevel: 0 };
  const dmg = { type: 4, subType: 0 };
  const target = { activeEffects: [{ kind: 'continuousDamage', roundsRemaining: 2 }] };
  assert.equal(effectsAlreadyOnTarget({ effects: [cont] }, target), true);            // all effects live
  assert.equal(effectsAlreadyOnTarget({ effects: [cont, dmg] }, target), false);      // the instant is never "found"
  assert.equal(effectsAlreadyOnTarget({ effects: [cont] }, { activeEffects: [] }), false);
  // per-stat identity: a strength fortify does not veto an agility one
  const fortAgi = { type: 9, subType: 3 };
  const fortified = { activeEffects: [{ kind: 'fortifyAttribute', stat: 'strength', magnitude: 5, roundsRemaining: 2 }] };
  assert.equal(effectsAlreadyOnTarget({ effects: [fortAgi] }, fortified), false);
  assert.equal(effectsAlreadyOnTarget({ effects: [{ type: 9, subType: 0 }] }, fortified), true);
});

test('enemyspells: the casting AI - touch resets the shared melee timer, ranged rides the 1/40 classic roll', () => {
  assert.equal(MIN_RANGED_DISTANCE, 6);
  assert.equal(MAX_RANGED_DISTANCE, 51.2);
  assert.equal(RANGED_SPELL_CHANCE, 1 / 40);
  const touchSpell = mkSpell(1, 1), selfSpell = mkSpell(2, 0), rangedSpell = mkSpell(3, 2);
  const ent = { level: 5, magicka: 100, spells: [touchSpell, rangedSpell] };
  const player = { activeEffects: [] };
  // detected + giveUpTimer are the DetectedTarget / CanAct gates DFU
  // puts on BOTH cast branches (EnemyMotor.cs:573, :620, :359-365).
  const mkAi = (dist) => ({ _dist: dist, inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0] });
  const mkAttack = () => ({ machine: { state: 'Idle' }, meleeTimer: 0, playerLevel: 10, reflexes: 2, rangedAttack: false });
  // TOUCH: in melee reach with the timer at 0 -> the touch pick casts
  // and RESETS the melee timer (DoTouchSpell -> ResetMeleeTimer)
  {
    const caster = new EnemyCaster(ent, seq(0, 0.5));   // pick roll 0 -> touchSpell; timer roll .5
    const attack = mkAttack();
    const dec = caster.update(0.016, mkAi(2.0), attack, [0, 0, 2], player);   // player straight ahead (+z, yaw 0)
    assert.equal(dec?.spell, touchSpell);
    assert.equal(dec.touch, true);
    assert.ok(attack.meleeTimer > 0);
  }
  // TOUCH gate: a running melee timer blocks the touch path
  {
    const caster = new EnemyCaster(ent, seq(0));
    const attack = mkAttack();
    attack.meleeTimer = 1.0;
    assert.equal(caster.update(0.016, mkAi(2.0), attack, [0, 0, 2], player), null);
  }
  // RANGED: inside 6..51.2, one classic update, roll UNDER 1/40 casts
  {
    // D9: DFU's order - CanCastRangedSpell PICKS inside the band
    // condition (:573), then the 1/40 roll fires the selection (:601)
    const caster = new EnemyCaster(ent, seq(0.9, 0.01));   // pick .9 -> rangedSpell; chance .01 < .025
    const dec = caster.update(0.0625, mkAi(20), mkAttack(), [0, 0, 20], player);
    assert.equal(dec?.spell, rangedSpell);
    assert.equal(dec.touch, false);
  }
  // RANGED gates: a failed roll, the band edges, and bow precedence
  {
    const caster = new EnemyCaster(ent, seq(0.9));
    assert.equal(caster.update(0.0625, mkAi(20), mkAttack(), [0, 0, 20], player), null);   // roll .9 >= 1/40
    const bowAttack = mkAttack();
    bowAttack.rangedAttack = true;
    const c2 = new EnemyCaster(ent, seq(0.01));
    assert.equal(c2.update(0.0625, mkAi(20), bowAttack, [0, 0, 20], player), null);        // hasBowAttack short-circuit
    const c3 = new EnemyCaster(ent, seq(0.01));
    assert.equal(c3.update(0.0625, mkAi(5), mkAttack(), [0, 0, 5], player), null);         // 5 <= min 6 (and out of touch reach)
  }
  // selection: magicka 0 refuses; CanCastTouchSpell counts CasterOnly
  assert.equal(pickRangedSpell({ magicka: 0, spells: [rangedSpell] }, player), null);
  assert.equal(pickTouchSpell({ magicka: 10, spells: [selfSpell] }, player, seq(0)), selfSpell);
});

test('D9: the tick KEEPS SelectedSpell, so EffectsAlreadyOnTarget reaches the stand-off band', () => {
  // EnemyMotor.cs:759-789. CanCastRangedSpell picks, stores
  // SelectedSpell, and vetoes on EffectsAlreadyOnTarget - and
  // DoRangedAttack's band condition (:573) is that same call, so the
  // veto decides whether the foe stands off at all, not only whether
  // it casts. The port rolled 1/40 FIRST and picked second, so there
  // was no selection to read and the band answered "has a ranged
  // spell" forever.
  const ranged = mkSpell(3, 2, [{ type: 1, subType: 0 }]);              // Continuous Damage: Health
  const ent = { level: 5, magicka: 100, spells: [ranged] };
  const mkAi = (dist) => ({ _dist: dist, inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0] });
  const mkAttack = () => ({ machine: { state: 'Idle' }, meleeTimer: 0, playerLevel: 10, reflexes: 2, rangedAttack: false });

  // a clean target: the pick stands, and it stands even though the
  // 1/40 roll failed (seq .9 picks, then .9 >= 1/40)
  const clean = { activeEffects: [] };
  const c1 = new EnemyCaster(ent, seq(0.9));
  assert.equal(c1.update(0.0625, mkAi(20), mkAttack(), [0, 0, 20], clean), null, 'the roll failed');
  assert.equal(c1.selectedSpell, ranged, 'but SelectedSpell is set - DFU sets it in the band condition');
  assert.equal(c1.canCastRangedSpell(), true, 'so the motor stands off');

  // the SAME spell already running on the target: EffectsAlreadyOnTarget
  // vetoes the pick, so there is no selection and no stand-off - DFU
  // sends the caster back to closing in.
  const already = { activeEffects: [{ kind: 'continuousDamage', roundsRemaining: 3 }] };
  const c2 = new EnemyCaster(ent, seq(0.9));
  assert.equal(c2.update(0.0625, mkAi(20), mkAttack(), [0, 0, 20], already), null);
  assert.equal(c2.selectedSpell, null, 'the veto left no selection');
  assert.equal(c2.canCastRangedSpell(), false, 'and the band gate is false');

  // out of the band, or blind, or bow-armed: no selection either -
  // DoRangedAttack never reaches CanCastRangedSpell
  const c3 = new EnemyCaster(ent, seq(0.9));
  c3.update(0.0625, mkAi(20), mkAttack(), [0, 0, 20], clean);
  assert.equal(c3.canCastRangedSpell(), true);
  c3.update(0.0625, mkAi(4), mkAttack(), [0, 0, 4], clean);
  assert.equal(c3.canCastRangedSpell(), false, 'inside the near edge the selection is dropped');
  const bow = mkAttack(); bow.rangedAttack = true;
  const c4 = new EnemyCaster(ent, seq(0.9));
  c4.update(0.0625, mkAi(20), bow, [0, 0, 20], clean);
  assert.equal(c4.canCastRangedSpell(), false, 'CanShootBow() short-circuits the pick');

  // a one-shot animation in flight holds the 1/40 roll (:588) but NOT
  // the band condition - the selection is still refreshed
  const busy = mkAttack(); busy.machine.state = 'Strike';
  const c5 = new EnemyCaster(ent, seq(0.001));
  assert.equal(c5.update(0.0625, mkAi(20), busy, [0, 0, 20], clean), null, 'no cast mid-swing');
  assert.equal(c5.canCastRangedSpell(), true, 'but the stand-off holds');
});
