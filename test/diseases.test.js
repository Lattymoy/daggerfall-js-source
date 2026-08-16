// S18: diseases - the DiseaseData table, InflictDisease gates, the
// daily tick over the classic day, the OnMonsterHit rider table, and
// the liveStat/heal integrations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISEASES, DISEASE_DATA, DISEASE_LIST_A, DISEASE_LIST_B, DISEASE_LIST_C,
  PERMANENT_DISEASE_VALUE, COMPLETED_DISEASE_VALUE, isDiseasePermanent,
  contractedMessageRecord, YOU_FEEL_SOMEWHAT_BAD,
  startDisease, updateDiseases, inflictDisease, onMonsterHit, fatigueDamage,
} from '../src/systems/diseases.js';
import { tickActiveEffects, healAttributeDamage, maxFatigue } from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const P = (level = 5) => ({
  isPlayer: true, level, career: {}, health: 40, maxHealth: 40, magicka: 30, fatigue: 6400,
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
});
const sinkRec = () => {
  const rec = { hurt: 0, fatigue: 0, magicka: 0 };
  rec.sinks = { hurt: (n) => { rec.hurt += n; }, drainFatigue: (n) => { rec.fatigue += n; }, drainMagicka: (n) => { rec.magicka += n; } };
  return rec;
};

test('diseases: the DiseaseData table pins (byte-exact rows, permanence)', () => {
  assert.equal(DISEASE_DATA.length, 17);
  // Witches' Pox: STR/END/HEA multipliers, damage 2-10, permanent
  const pox = DISEASE_DATA[DISEASES.WitchesPox];
  assert.deepEqual([pox.STR, pox.INT, pox.WIL, pox.AGI, pox.END, pox.PER, pox.SPD, pox.LUC], [1, 0, 0, 0, 1, 0, 0, 0]);
  assert.deepEqual([pox.HEA, pox.FAT, pox.SPL, pox.minDamage, pox.maxDamage], [1, 0, 0, 2, 10]);
  assert.ok(isDiseasePermanent(pox));
  // Cholera hits everything 5-30; Leprosy everything but SPL
  const cholera = DISEASE_DATA[DISEASES.Cholera];
  assert.deepEqual([cholera.STR, cholera.SPL, cholera.minDamage, cholera.maxDamage], [1, 1, 5, 30]);
  assert.equal(DISEASE_DATA[DISEASES.Leprosy].SPL, 0);
  // The three finite diseases run 3-18 days; everything else 0xff
  for (const id of [DISEASES.CalironsCurse, DISEASES.BloodRot, DISEASES.WizardFever]) {
    assert.deepEqual([DISEASE_DATA[id].daysOfSymptomsMin, DISEASE_DATA[id].daysOfSymptomsMax], [3, 18]);
    assert.ok(!isDiseasePermanent(DISEASE_DATA[id]));
  }
  assert.equal(DISEASE_DATA.filter((d) => !isDiseasePermanent(d)).length, 3);
  assert.equal(DISEASE_DATA[DISEASES.StomachRot].maxDamage, 5);
  // Lists: A plague-only; B adds stomach rot/brain fever; C the 11
  assert.deepEqual([...DISEASE_LIST_A], [DISEASES.Plague]);
  assert.deepEqual([...DISEASE_LIST_B], [DISEASES.Plague, DISEASES.StomachRot, DISEASES.BrainFever]);
  assert.equal(DISEASE_LIST_C.length, 11);
  assert.ok(!DISEASE_LIST_C.includes(DISEASES.CalironsCurse));   // finite diseases never transmit by hit
  // Contracted text = TEXT.RSC record 100 + type
  assert.equal(contractedMessageRecord(DISEASES.WitchesPox), 100);
  assert.equal(contractedMessageRecord(DISEASES.WizardFever), 116);
});

test('diseases: startDisease gates - player-only, level >= 2, no double catch, finite day roll', () => {
  assert.equal(startDisease({ isPlayer: false, level: 9 }, DISEASES.Plague, 0), null);
  assert.equal(startDisease(P(1), DISEASES.Plague, 0), null);   // Start: level < 2 ends the disease
  const p = P();
  const entry = startDisease(p, DISEASES.Plague, 7, seq(0));
  assert.equal(entry.kind, 'disease');
  assert.ok(entry.permanent);
  assert.equal(entry.lastDay, 7);
  assert.equal(entry.incubationOver, false);
  assert.equal(entry.daysOfSymptomsLeft, 0);   // permanent: no span rolled
  assert.equal(startDisease(p, DISEASES.Plague, 7), null);   // AddState: can't catch it twice
  // A finite disease rolls Range(3, 19): roll 0.5 -> 3 + 8 = 11 days
  const q = P();
  assert.equal(startDisease(q, DISEASES.WizardFever, 0, seq(0.5)).daysOfSymptomsLeft, 11);
});

test('diseases: InflictDisease - level-1 immunity, the full-save resist, uniform pick', () => {
  // Level 1: classic immunity, no rolls consumed
  assert.equal(inflictDisease(P(1), DISEASE_LIST_B, { rolls: () => { throw new Error('no roll'); } }), null);
  // A full save (roll 1 vs throw 55, outside the 20-band) resists
  assert.equal(inflictDisease(P(), DISEASE_LIST_B, { rolls: seq(0) }), null);
  // Failed save (roll 100 > 55): pick 0.4 -> index 1 -> Stomach Rot
  const p = P();
  const entry = inflictDisease(p, DISEASE_LIST_B, { rolls: seq(0.99, 0.4), currentDay: 3 });
  assert.equal(entry.disease, DISEASES.StomachRot);
  assert.equal(entry.lastDay, 3);
  assert.equal(p.activeEffects.length, 1);
});

test('diseases: incubation day is silent; the daily tick lands the row ONCE per day', () => {
  const p = P();
  const rec = sinkRec();
  const entry = startDisease(p, DISEASES.WitchesPox, 10);
  let alerts = 0;
  // Same classic day: incubation - nothing happens
  updateDiseases(p, 10, rec.sinks, seq(0.5), () => alerts++);
  assert.equal(rec.hurt, 0);
  assert.equal(entry.incubationOver, false);
  assert.equal(alerts, 0);
  // Next day: one damage roll 2 + floor(0.5*9) = 6 through the matrix
  updateDiseases(p, 11, rec.sinks, seq(0.5), (msg) => { alerts++; assert.equal(msg, YOU_FEEL_SOMEWHAT_BAD); });
  assert.equal(entry.incubationOver, true);
  assert.equal(entry.lastDay, 11);
  assert.equal(entry.statMods.strength, -6);
  assert.equal(entry.statMods.endurance, -6);
  assert.equal(entry.statMods.agility ?? 0, 0);   // 0-column stats untouched
  assert.equal(rec.hurt, 6);      // HEA x damage
  assert.equal(rec.fatigue, 0);   // FAT column 0
  assert.equal(alerts, 1);
  // liveStat consumes the mods; maxFatigue follows the live stats
  assert.equal(liveStat(p, 'strength'), 44);
  assert.equal(maxFatigue(p), (44 + 44) * 64);
  // Two days at once (rest/travel): two rolls, mods accumulate
  updateDiseases(p, 13, rec.sinks, seq(0, 0), () => alerts++);
  assert.equal(entry.statMods.strength, -6 - 2 - 2);
  assert.equal(rec.hurt, 6 + 4);
  assert.equal(alerts, 2);   // one alert per round, not per day
});

test('diseases: the FAT/SPL columns drain RAW units (no x64)', () => {
  const p = P();
  const rec = sinkRec();
  startDisease(p, DISEASES.Cholera, 0);   // every column 1, damage 5-30
  updateDiseases(p, 1, rec.sinks, seq(0));   // damage roll 5
  assert.equal(rec.hurt, 5);
  assert.equal(rec.fatigue, 5);    // DecreaseFatigue WITHOUT assignMultiplier
  assert.equal(rec.magicka, 5);
  for (const k of ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck']) {
    assert.equal(liveStat(p, k), 45);
  }
  // Plague's one 0 column: intelligence stays untouched
  const q = P();
  startDisease(q, DISEASES.Plague, 0);
  updateDiseases(q, 1, sinkRec().sinks, seq(0));
  assert.equal(liveStat(q, 'intelligence'), 50);
  assert.equal(liveStat(q, 'strength'), 47);
});

test('diseases: a finite disease runs its course, ends, and its mods lift on removal', () => {
  const p = P();
  const rec = sinkRec();
  // Wizard Fever: INT/SPL, damage 2-4; days roll 0 -> exactly 3 days
  const entry = startDisease(p, DISEASES.WizardFever, 0, seq(0));
  assert.equal(entry.daysOfSymptomsLeft, 3);
  updateDiseases(p, 1, rec.sinks, seq(0));
  updateDiseases(p, 2, rec.sinks, seq(0));
  assert.equal(entry.daysOfSymptomsLeft, 1);
  assert.ok(!entry.ended);
  // The final day: damage lands, THEN the countdown ends the disease
  updateDiseases(p, 3, rec.sinks, seq(0));
  assert.equal(entry.daysOfSymptomsLeft, COMPLETED_DISEASE_VALUE);
  assert.ok(entry.ended);
  assert.equal(rec.magicka, 6);   // three days of SPL x 2
  assert.equal(liveStat(p, 'intelligence'), 44);   // mods persist until the tick removes
  // The same round's tick pass removes the expired entry - stats recover
  tickActiveEffects(p, rec.sinks);
  assert.equal(p.activeEffects.length, 0);
  assert.equal(liveStat(p, 'intelligence'), 50);
  // A completed entry never re-ticks
  updateDiseases(p, 9, rec.sinks, seq(0));
  assert.equal(rec.magicka, 6);
});

test('diseases: Heal{Attribute} heals disease stat damage but never ends the disease', () => {
  const p = P();
  const rec = sinkRec();
  const entry = startDisease(p, DISEASES.WitchesPox, 0);
  updateDiseases(p, 1, rec.sinks, seq(0.99));   // damage 10: STR/END -10
  assert.equal(liveStat(p, 'strength'), 40);
  healAttributeDamage(p, 'strength', 6);
  assert.equal(entry.statMods.strength, -4);
  assert.equal(liveStat(p, 'strength'), 46);
  healAttributeDamage(p, 'strength', 99);   // clamps at 0, never a bonus
  assert.equal(entry.statMods.strength, 0);
  assert.ok(!entry.ended);   // base HealAttributeDamage: the disease keeps falling
  updateDiseases(p, 2, rec.sinks, seq(0));   // next day drains again (2)
  assert.equal(entry.statMods.strength, -2);
});

test('diseases: OnMonsterHit - rat/bat/zombie/mummy disease rolls land on the lists', () => {
  // Rat: Dice100(5) success (roll 0.01 -> 1 < 5), save fails (0.99),
  // pick 0.4 -> Stomach Rot from list B
  const p = P();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Rat }, p, 3, { rolls: seq(0.01, 0.99, 0.4), currentDay: 2 });
  assert.equal(p.activeEffects[0].disease, DISEASES.StomachRot);
  // Rat miss: 5 >= 5 fails the dice, no infection rolls consumed
  const q = P();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Rat }, q, 3, { rolls: seq(0.05) });
  assert.equal(q.activeEffects, undefined);
  // Mummy: Dice100(5), list C pick 0 -> Plague
  const r = P();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Mummy }, r, 3, { rolls: seq(0.01, 0.99, 0) });
  assert.equal(r.activeEffects[0].disease, DISEASES.Plague);
  // Zombie: 2% - roll 0.02 -> 2 >= 2 fails
  const s = P();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Zombie }, s, 3, { rolls: seq(0.02) });
  assert.equal(s.activeEffects, undefined);
});

test('diseases: OnMonsterHit - nymph/lamia fatigue, vampire branch, routed specials', () => {
  // Nymph: 2 pts of fatigue per health damage, x64 stored units
  const rec = sinkRec();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Nymph }, P(), 5, { sinks: rec.sinks });
  assert.equal(rec.fatigue, 5 * 2 * 64);
  const rec2 = sinkRec();
  fatigueDamage(P(), 3, rec2.sinks);
  assert.equal(rec2.fatigue, 384);
  // Vampire: roll 1.5% - above specialInfectionChance (0.6), within
  // 2.0 -> plague (list A)
  const p = P();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Vampire }, p, 4, { rolls: seq(0.015, 0.99, 0) });
  assert.equal(p.activeEffects[0].disease, DISEASES.Plague);
  // Vampire roll 0.5% <= 0.6: the vampirism branch (ROUTED) - no disease
  const q = P();
  onMonsterHit({ careerIndex: MOBILE_TYPES.VampireAncient }, q, 4, { rolls: seq(0.005) });
  assert.equal(q.activeEffects, undefined);
  // Werewolf consumes its infection roll and does nothing else (ROUTED)
  const rolls = seq(0.5);
  onMonsterHit({ careerIndex: MOBILE_TYPES.Werewolf }, P(), 4, { rolls });
  assert.equal(rolls(), 0.5);   // exactly one value was consumed
  // Spider: paralysis pends S19 - no rolls, no effect
  const s = P();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Spider }, s, 4, { rolls: () => { throw new Error('no roll'); } });
  assert.equal(s.activeEffects, undefined);
});

test('diseases: the multi-attack loop fires onMonsterHit per landed hit (FormulaHelper.cs:662)', () => {
  const M = {
    isPlayer: false, isClass: false, level: 2, skills: 40, careerIndex: MOBILE_TYPES.Rat,
    stats: { strength: 50, agility: 50, luck: 50 },
    basics: { minDamage: 2, maxDamage: 2, minDamage2: 3, maxDamage2: 3, minDamage3: 0, maxDamage3: 0 },
  };
  const T = { isPlayer: true, reflexes: 2, armor: 0, skills: 0, stats: { strength: 50, agility: 50, luck: 50 } };
  const hits = [];
  // Attack 1 hits (damage 2), attack 2 misses, attack 3 min-0 skipped
  // (the formulas.test multi-attack fixture rolls, verbatim)
  const d = calculateAttackDamage(M, T, {
    targetGroup: null, dfRand: () => 0,
    rolls: seq(0, 0.99, 0.02, 0, 0.99, 0.03, 0.5),
    onMonsterHit: (att, tgt, dmg) => hits.push([att.careerIndex, tgt.isPlayer, dmg]),
  });
  assert.equal(d, 2);
  assert.deepEqual(hits, [[MOBILE_TYPES.Rat, true, 2]]);   // per HIT, not per attack
});

test('diseases: the save round-trip detaches the statMods map', () => {
  const p = P();
  startDisease(p, DISEASES.WitchesPox, 0);
  updateDiseases(p, 1, sinkRec().sinks, seq(0));
  const snap = snapshotPlayer(p, {});
  p.activeEffects[0].statMods.strength = -99;   // live play after the save
  assert.equal(snap.activeEffects[0].statMods.strength, -2);   // the snapshot held
  const fresh = { stats: {} };
  restorePlayer(fresh, snap);
  assert.equal(fresh.activeEffects[0].disease, DISEASES.WitchesPox);
  assert.equal(fresh.activeEffects[0].statMods.strength, -2);
  assert.equal(liveStat(fresh, 'strength'), 48);
  snap.activeEffects[0].statMods.strength = -1;   // and the restore detached too
  assert.equal(fresh.activeEffects[0].statMods.strength, -2);
});

test('diseases: permanent marker constants + the ids stay pinned', () => {
  assert.equal(PERMANENT_DISEASE_VALUE, 0xff);
  assert.equal(COMPLETED_DISEASE_VALUE, 0xfe);
  assert.equal(DISEASES.WitchesPox, 0);
  assert.equal(DISEASES.CalironsCurse, 7);
  assert.equal(DISEASES.BloodRot, 12);
  assert.equal(DISEASES.WizardFever, 16);
  assert.equal(DISEASES.None, -1);
});
