// AUDIT 18 - systems-magic. Pins for the five fixes this pass landed:
//   1. EFFECT_COST_TABLE now carries EVERY classic key DFU's effect
//      library defines, each with its own MagicSkill and its own
//      MakeEffectCosts rows; the 60/100/160 fudge fires only for a
//      class with no components at all (Teleport / MorphSelf), and a
//      key with no class costs nothing.
//   2. liveStat clamps to 0..MaxStatValue (DaggerfallStats
//      .GetLiveStatValue).
//   3. savingThrow applies the player's RACIAL resistance/immunity/
//      low-tolerance/critical-weakness flags and the biography
//      resist mods (FormulaHelper.SavingThrow :1464-1521).
//   4. RestSession ends a 0-hour timed/loiter request on the first
//      frame with no time passing (DaggerfallRestWindow.Update).
//   5. An INSTANT effect is live on its target for one magic round,
//      so EnemyMotor.EffectsAlreadyOnTarget vetoes a re-cast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EFFECT_COST_TABLE, effectCost, calculateCastCost,
} from '../src/systems/spellcost.js';
import { liveStat, maxFatigue, MAX_STAT_VALUE } from '../src/systems/statMods.js';
import { savingThrow, spellHasFlags, EFFECT_FLAGS, ELEMENTS } from '../src/systems/spellcast.js';
import { RestSession, REST_TEXT, REST_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { applySpell, tickActiveEffects, effectsAlreadyOnTarget, effectActiveIdentity } from '../src/systems/effects.js';
import { readSpellsStd } from '../src/formats/spellsStd.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// ---------------------------------------------------------------
// 1. The cost table, key for key against the C#
// ---------------------------------------------------------------

// [classicKey, MagicSkill, DurationCosts, ChanceCosts, MagnitudeCosts]
// transcribed from Game/MagicAndEffects/Effects/**/*.cs - a null
// column is a component the class does not support (SupportDuration /
// SupportChance / SupportMagnitude false), and each triple is
// MakeEffectCosts(costA, costB, offsetGold).
const DFU_EFFECT_COSTS = [
  ['0,255', 25, [28, 100, 0], [28, 100, 0], null],   // Paralyze
  ['1,0', 22, [28, 8, 0], null, [40, 28, 0]],   // ContinuousDamageHealth
  ['1,1', 22, [20, 8, 0], null, [40, 28, 0]],   // ContinuousDamageFatigue
  ['1,2', 22, [40, 8, 0], null, [40, 28, 0]],   // ContinuousDamageSpellPoints
  ['2,255', 27, [60, 120, 0], null, null],   // CreateItem
  ['3,0', 23, null, [8, 100, 0], null],   // CureDisease
  ['3,1', 23, null, [8, 100, 0], null],   // CurePoison
  ['3,2', 23, null, [20, 140, 0], null],   // CureParalyzation
  ['4,0', 22, null, null, [20, 28, 0]],   // DamageHealth
  ['4,1', 22, null, null, [20, 28, 0]],   // DamageFatigue
  ['4,2', 22, null, null, [20, 28, 0]],   // DamageSpellPoints
  ['5,255', 22, null, [80, 140, 0], null],   // Disintegrate
  ['6,0', 27, null, [120, 180, 0], null],   // DispelMagic
  ['6,1', 27, null, [80, 140, 0], null],   // DispelUndead
  ['6,2', 27, null, [120, 180, 0], null],   // DispelDaedra
  ['7,0', 22, null, null, [8, 100, 116]],   // DrainStrength
  ['7,1', 22, null, null, [8, 100, 116]],   // DrainIntelligence
  ['7,2', 22, null, null, [8, 100, 116]],   // DrainWillpower
  ['7,3', 22, null, null, [8, 100, 116]],   // DrainAgility
  ['7,4', 22, null, null, [8, 100, 116]],   // DrainEndurance
  ['7,5', 22, null, null, [8, 100, 116]],   // DrainPersonality
  ['7,6', 22, null, null, [8, 100, 116]],   // DrainSpeed
  ['7,7', 22, null, null, [8, 100, 116]],   // DrainLuck
  ['8,0', 25, [100, 100, 0], [8, 100, 0], null],   // ElementalResistance-Fire
  ['8,1', 25, [100, 100, 0], [8, 100, 0], null],   // ElementalResistance-Frost
  ['8,2', 25, [100, 100, 0], [8, 100, 0], null],   // ElementalResistance-DiseaseOrPoison
  ['8,3', 25, [100, 100, 0], [8, 100, 0], null],   // ElementalResistance-Shock
  ['8,4', 25, [100, 100, 0], [8, 100, 0], null],   // ElementalResistance-Magic
  ['9,0', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifyStrength
  ['9,1', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifyIntelligence
  ['9,2', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifyWillpower
  ['9,3', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifyAgility
  ['9,4', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifyEndurance
  ['9,5', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifyPersonality
  ['9,6', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifySpeed
  ['9,7', 23, [28, 100, 0], null, [40, 120, 0]],   // FortifyLuck
  ['10,0', 23, null, null, [40, 28, 0]],   // HealStrength
  ['10,1', 23, null, null, [40, 28, 0]],   // HealIntelligence
  ['10,2', 23, null, null, [40, 28, 0]],   // HealWillpower
  ['10,3', 23, null, null, [40, 28, 0]],   // HealAgility
  ['10,4', 23, null, null, [40, 28, 0]],   // HealEndurance
  ['10,5', 23, null, null, [40, 28, 0]],   // HealPersonality
  ['10,6', 23, null, null, [40, 28, 0]],   // HealSpeed
  ['10,7', 23, null, null, [40, 28, 0]],   // HealLuck
  ['10,8', 23, null, null, [20, 28, 0]],   // HealHealth
  ['10,9', 23, null, null, [8, 28, 0]],   // HealFatigue
  ['11,0', 22, null, null, [60, 100, 40]],   // TransferStrength
  ['11,1', 22, null, null, [60, 100, 40]],   // TransferIntelligence
  ['11,2', 22, null, null, [60, 100, 40]],   // TransferWillpower
  ['11,3', 22, null, null, [60, 100, 40]],   // TransferAgility
  ['11,4', 22, null, null, [60, 100, 40]],   // TransferEndurance
  ['11,5', 22, null, null, [60, 100, 40]],   // TransferPersonality
  ['11,6', 22, null, null, [60, 100, 40]],   // TransferSpeed
  ['11,7', 22, null, null, [60, 100, 40]],   // TransferLuck
  ['11,8', 22, null, null, [60, 100, 40]],   // TransferHealth
  ['11,9', 22, null, null, [60, 100, 40]],   // TransferFatigue
  ['12,255', 27, [60, 68, 0], [40, 68, 0], null],   // SoulTrap
  ['13,0', 24, [40, 120, 0], null, null],   // InvisibilityNormal
  ['13,1', 24, [60, 140, 0], null, null],   // InvisibilityTrue
  ['14,255', 26, [60, 100, 0], null, null],   // Levitate
  ['15,255', 24, [8, 40, 0], null, null],   // LightNormal
  ['16,255', 27, null, [28, 120, 120], null],   // Lock
  ['17,255', 27, null, [20, 100, 0], null],   // Open
  ['18,255', 23, [100, 20, 0], null, [8, 8, 0]],   // Regenerate
  ['19,255', 27, [20, 100, 0], [20, 100, 0], null],   // Silence
  ['20,255', 23, [28, 140, 0], [28, 140, 0], null],   // SpellAbsorption
  ['21,255', 26, [28, 140, 0], [28, 140, 0], null],   // SpellReflection
  ['22,255', 26, [20, 100, 0], [20, 100, 0], null],   // SpellResistance
  ['23,0', 24, [20, 80, 0], null, null],   // ChameleonNormal
  ['23,1', 24, [40, 120, 0], null, null],   // ChameleonTrue
  ['24,0', 24, [20, 80, 0], null, null],   // ShadowNormal
  ['24,1', 24, [40, 120, 0], null, null],   // ShadowTrue
  ['25,255', 25, [20, 100, 0], null, null],   // Slowfall
  ['26,255', 23, [20, 8, 0], null, null],   // FreeAction
  ['27,255', 25, [20, 8, 0], null, null],   // Jumping
  ['28,255', 25, [20, 20, 0], null, null],   // Climbing
  ['29,255', 24, null, null, null],   // MorphSelf
  ['30,255', 25, [20, 8, 0], null, null],   // WaterBreathing
  ['31,255', 26, [20, 8, 0], null, null],   // WaterWalking
  ['33,0', 26, null, [60, 100, 160], null],   // Pacify-Animals
  ['33,1', 26, null, [80, 140, 60], null],   // Pacify-Undead
  ['33,2', 26, null, [80, 140, 60], null],   // Pacify-Humanoid
  ['33,3', 26, null, [60, 120, 36], null],   // Pacify-Daedra
  ['34,255', 26, null, [40, 60, 0], null],   // CharmEffect - AUDIT 23 (magic-6): DurationCosts commented out in DFU (:42)
  ['35,255', 25, [28, 8, 0], null, [80, 60, 0]],   // Shield
  ['39,0', 26, [20, 8, 200], null, null],   // DetectMagic
  ['39,1', 26, [20, 8, 200], null, null],   // DetectEnemy
  ['39,2', 26, [20, 8, 160], null, null],   // DetectTreasure
  ['40,255', 26, null, [40, 100, 28], null],   // Identify
  ['43,255', 27, null, null, null],   // Teleport
  ['44,255', 27, [60, 68, 0], [40, 68, 0], null],   // ComprehendLanguages
];

const triple = (c) => (c ? { A: c[0], B: c[1], offset: c[2] } : null);
const expectedTable = () => {
  const out = {};
  for (const [key, skill, d, c, m] of DFU_EFFECT_COSTS) {
    const row = { skill };
    if (d) row.duration = triple(d);
    if (c) row.chance = triple(c);
    if (m) row.magnitude = triple(m);
    out[key] = row;
  }
  return out;
};

test('audit18 magic: EFFECT_COST_TABLE is DFU\'s whole effect library, key for key', () => {
  const want = expectedTable();
  // plain-object copy so deepEqual compares values, not frozenness
  const got = {};
  for (const [k, v] of Object.entries(EFFECT_COST_TABLE)) got[k] = { ...v };
  assert.deepEqual(got, want);
  assert.equal(Object.keys(EFFECT_COST_TABLE).length, 91);
  // The families that shipped after S10 and were priced by the fudge
  // at the wrong skill until this pass:
  for (const k of ['14,255', '18,255', '9,0', '7,0', '11,0', '11,8', '11,9', '10,0', '10,9', '4,1', '1,1', '4,2', '1,2']) {
    assert.ok(EFFECT_COST_TABLE[k], `missing cost row ${k}`);
  }
});

test('audit18 magic: the zero-component fudge fires only for a component-less CLASS, at its own magic skill', () => {
  // Teleport (43,255) and MorphSelf (29,255) are DFU's only vanilla
  // classes with no duration/chance/magnitude - MakeEffectCosts(60,
  // 100, 160) over (1, 1, 1) = 320 gold - but they are still priced
  // against Mysticism and Illusion, never a defaulted Destruction.
  const skillsAsked = [];
  const ask = (id) => { skillsAsked.push(id); return 50; };
  assert.equal(effectCost({ type: 43, subType: -1 }, ask).gold, 320);
  assert.equal(effectCost({ type: 29, subType: -1 }, ask).gold, 320);
  assert.deepEqual(skillsAsked, [27, 24]);   // Mysticism, Illusion
  // A classic key with no effect class at all is dropped from the
  // bundle by ClassicEffectRecordToEffectEntry: no cost, no skill read
  const none = [];
  assert.deepEqual(effectCost({ type: 99, subType: 3 }, (id) => { none.push(id); return 50; }), { gold: 0, sp: 0 });
  assert.deepEqual(none, []);
  // A row WITH components never takes the fudge: Levitate's 320-gold
  // fudge would have been 320, its real duration cost is 220
  const levitate = { type: 14, subType: -1, durationBase: 1, durationMod: 1, durationPerLevel: 1 };
  assert.equal(effectCost(levitate, () => 80).gold, 60 * 1 + 100 * 1);
});

test('audit18 magic: real SPELLS.STD cast costs, per-effect magic skill and all', (t) => {
  if (!process.env.ARENA2_PATH) return t.skip('ARENA2_PATH not set');
  const spells = readSpellsStd(new Uint8Array(readFileSync(join(process.env.ARENA2_PATH, 'SPELLS.STD'))));
  const at = (skills) => ({ isPlayer: true, skills });
  const flat = (v) => { const s = new Array(35).fill(0); for (const id of [22, 23, 24, 25, 26, 27]) s[id] = v; return s; };
  const byIndex = (i) => spells.find((s) => s.index === i);
  const master = at(flat(80));
  // Each of these lands on a family that had NO cost row before this
  // pass and was charged the 320-gold fudge at Destruction instead.
  assert.deepEqual(calculateCastCost(byIndex(52), master), { gold: 820, sp: 61 });    // Vampiric Touch  (11,8 TransferHealth)
  assert.deepEqual(calculateCastCost(byIndex(67), master), { gold: 840, sp: 63 });    // Energy Leech    (11,9 TransferFatigue)
  assert.deepEqual(calculateCastCost(byIndex(51), master), { gold: 780, sp: 58 });    // Sleep           (1,1 ContinuousDamageFatigue)
  assert.deepEqual(calculateCastCost(byIndex(34), master), { gold: 1076, sp: 80 });   // Wizard Rend     (4,2 + 0,255)
  assert.deepEqual(calculateCastCost(byIndex(24), master), { gold: 616, sp: 46 });    // Troll's Blood   (18,255 Regenerate)
  // Levitate is read against THAUMATURGY: pin Destruction somewhere
  // else entirely, and the cost must not move.
  const lev = byIndex(4);
  const thaumOnly = flat(0); thaumOnly[26] = 80; thaumOnly[22] = 10;
  assert.deepEqual(calculateCastCost(lev, at(thaumOnly)), { gold: 220, sp: 16 });
  assert.deepEqual(calculateCastCost(lev, master), { gold: 220, sp: 16 });
  // and every key the shipping file uses now has a class
  for (const s of spells) {
    for (const e of s.effects) {
      if (e.type <= -1) continue;
      assert.ok(EFFECT_COST_TABLE[`${e.type},${e.subType & 0xff}`], `${s.name} key ${e.type},${e.subType & 0xff}`);
    }
  }
});

// ---------------------------------------------------------------
// 2. liveStat clamps 0..MaxStatValue
// ---------------------------------------------------------------

test('audit18 magic: liveStat clamps to 0..MaxStatValue, as GetLiveStatValue does', () => {
  assert.equal(MAX_STAT_VALUE, 100);
  // A Drothweed poison drains strength every active minute and DFU's
  // producers never clamp - the READ does.
  const poisoned = {
    stats: { strength: 50, endurance: 40 },
    activeEffects: [{ kind: 'poison', poison: 129, statMods: { strength: -270 } }],
  };
  assert.equal(liveStat(poisoned, 'strength'), 0);
  assert.equal(maxFatigue(poisoned), (0 + 40) * 64);
  assert.ok(maxFatigue(poisoned) >= 0);
  // A fortify never reads past 100 either
  const fortified = {
    stats: { strength: 95 },
    activeEffects: [{ kind: 'fortifyAttribute', stat: 'strength', magnitude: 20, roundsRemaining: 4 }],
  };
  assert.equal(liveStat(fortified, 'strength'), 100);
  // in range, nothing changes
  assert.equal(liveStat({ stats: { strength: 62 } }, 'strength'), 62);
});

// ---------------------------------------------------------------
// 3. SavingThrow: racial flags + biography mods
// ---------------------------------------------------------------

test('audit18 magic: SpellHasFlags, all six clauses verbatim', () => {
  const F = EFFECT_FLAGS;
  // element-keyed clauses: the check flag must match the ELEMENT
  assert.equal(spellHasFlags(ELEMENTS.Fire, F.Fire, 0), true);
  assert.equal(spellHasFlags(ELEMENTS.Fire, F.Frost, 0), false);
  assert.equal(spellHasFlags(ELEMENTS.Frost, F.Frost, 0), true);
  assert.equal(spellHasFlags(ELEMENTS.Shock, F.Shock, 0), true);
  assert.equal(spellHasFlags(ELEMENTS.Magic, F.Magic, 0), true);
  assert.equal(spellHasFlags(ELEMENTS.Magic, F.Fire, 0), false);
  // the DiseaseOrPoison clause ANDs with the SPELL's own flags
  assert.equal(spellHasFlags(ELEMENTS.DiseaseOrPoison, F.Disease, F.Disease), true);
  assert.equal(spellHasFlags(ELEMENTS.DiseaseOrPoison, F.Disease, F.Poison), false);
  assert.equal(spellHasFlags(ELEMENTS.DiseaseOrPoison, F.Poison, F.Poison), true);
  assert.equal(spellHasFlags(ELEMENTS.DiseaseOrPoison, F.Disease, 0), false);
  // the final clause is ELEMENT-INDEPENDENT: any paralysis vs any paralysis
  assert.equal(spellHasFlags(ELEMENTS.Fire, F.Paralysis, F.Paralysis), true);
  assert.equal(spellHasFlags(ELEMENTS.Magic, F.Paralysis, F.Paralysis | F.Magic), true);
  assert.equal(spellHasFlags(ELEMENTS.Fire, F.Paralysis, F.Magic), false);
});

// A race template as races.js hands one over (the four tolerance flag
// bytes DFU's RaceTemplate carries).
const player = (raceTemplate, extra = {}) => ({
  isPlayer: true, career: {}, stats: { willpower: 50 }, raceTemplate, ...extra,
});

test('audit18 magic: savingThrow applies the racial flag block, player only', () => {
  const F = EFFECT_FLAGS;
  const plain = {};                                   // no racial flags at all
  const magicResistant = { resistanceFlags: F.Magic };   // Breton
  const frostResistant = { resistanceFlags: F.Frost };   // Nord
  const paralysisImmune = { immunityFlags: F.Paralysis };   // High Elf
  // +30 saving points: with willpower 50 (MagicResist 5) a plain
  // player saves on 55 and a resistant one on 85 - roll 70 splits them
  const roll70 = seq(0.699);
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player(plain), 0, roll70), 100);
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player(magicResistant), 0, seq(0.699)), 25);   // 100 - 5*(85-70)
  assert.equal(savingThrow(ELEMENTS.Frost, F.Frost, player(frostResistant), 0, seq(0.699)), 25);
  // the resistance is ELEMENT-KEYED: a frost-resistant player gets
  // nothing against a magic-element spell
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player(frostResistant), 0, seq(0.699)), 100);
  // immunity ASSIGNS 100 -> the >= 100 early return, for EVERY roll
  for (let r = 0; r < 100; r++) {
    assert.equal(savingThrow(ELEMENTS.Magic, F.Paralysis | F.Magic, player(paralysisImmune), 0, seq(r / 100)), 0);
  }
  // ...but only against paralysis: the same player takes a plain
  // magic spell normally
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player(paralysisImmune), 0, seq(0.699)), 100);
  // low tolerance -25 and critical weakness -50. At roll 30 a plain
  // player (save 55) is fully saved - percent 0 - while -25 (save 30)
  // and -50 (save 5, the clamp) take the whole payload.
  assert.equal(savingThrow(ELEMENTS.Fire, F.Fire, player(plain), 0, seq(0.299)), 0);
  assert.equal(savingThrow(ELEMENTS.Fire, F.Fire, player({ lowToleranceFlags: F.Fire }), 0, seq(0.299)), 100);
  assert.equal(savingThrow(ELEMENTS.Fire, F.Fire, player({ criticalWeaknessFlags: F.Fire }), 0, seq(0.299)), 100);
  //   at roll 40 the plain player prorates (100 - 5*(55-40)) and the
  //   low-tolerance one is past its save entirely
  assert.equal(savingThrow(ELEMENTS.Fire, F.Fire, player(plain), 0, seq(0.399)), 25);
  assert.equal(savingThrow(ELEMENTS.Fire, F.Fire, player({ lowToleranceFlags: F.Fire }), 0, seq(0.399)), 100);
  // NON-player entities never read the racial block (DFU gates on
  // `target == playerEntity`)
  const foe = { career: {}, stats: { willpower: 50 }, raceTemplate: magicResistant };
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, foe, 0, seq(0.699)), 100);
});

test('audit18 magic: savingThrow folds the biography resist mods, player only', () => {
  const F = EFFECT_FLAGS;
  // roll 70; base save 55. +20 biography -> 75, the roll lands and
  // prorates; the clean player takes the full payload.
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player({}), 0, seq(0.699)), 100);
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player({}, { biographyResistMagicMod: 20 }), 0, seq(0.699)), 75);
  assert.equal(savingThrow(ELEMENTS.DiseaseOrPoison, F.Poison, player({}, { biographyResistPoisonMod: 20 }), 0, seq(0.699)), 75);
  assert.equal(savingThrow(ELEMENTS.DiseaseOrPoison, F.Disease, player({}, { biographyResistDiseaseMod: 20 }), 0, seq(0.699)), 75);
  // the mods are per-flag: a magic mod does nothing on a poison save
  assert.equal(savingThrow(ELEMENTS.DiseaseOrPoison, F.Poison, player({}, { biographyResistMagicMod: 20 }), 0, seq(0.699)), 100);
  // a NEGATIVE mod costs the player the prorated save it would have
  // made (roll 50: save 55 prorates to 75, save 35 is missed entirely)
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player({}, { biographyResistMagicMod: -20 }), 0, seq(0.499)), 100);
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, player({}), 0, seq(0.499)), 75);
  // non-player entities carrying the same field get nothing
  const foe = { career: {}, stats: { willpower: 50 }, biographyResistMagicMod: 20 };
  assert.equal(savingThrow(ELEMENTS.Magic, F.Magic, foe, 0, seq(0.699)), 100);
});

// ---------------------------------------------------------------
// 4. A 0-hour rest passes no time
// ---------------------------------------------------------------

const restDeps = (over = {}) => {
  const d = {
    minutes: 0, vitals: 0, enemyChecks: 0,
    advanceMinutes(n) { d.minutes += n; },
    tickVitals() { d.vitals++; return false; },
    enemiesNearby() { d.enemyChecks++; return false; },
    fullyHealed: () => false,
    dead: () => false,
    ...over,
  };
  return d;
};

test('audit18 magic: a 0-hour timed/loiter rest ends on the first frame with NO time passing', () => {
  // DaggerfallRestWindow.Update tests `hoursRemaining < 1` BEFORE
  // TickRest, so the session never raises time, never checks for
  // enemies and never ticks vitals.
  const d = restDeps();
  const r = new RestSession('timed', 0, d).tick(10);
  assert.deepEqual(r, { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false });
  assert.deepEqual([d.minutes, d.vitals, d.enemyChecks], [0, 0, 0]);
  const dl = restDeps();
  const rl = new RestSession('loiter', 0, dl).tick(10);
  assert.deepEqual(rl, { textId: REST_TEXT.loiterDone, enemyBroke: false, died: false });
  assert.deepEqual([dl.minutes, dl.vitals, dl.enemyChecks], [0, 0, 0]);
  // control: a 1-hour timed rest still runs its full hour
  const d1 = restDeps();
  const r1 = new RestSession('timed', 1, d1).tick(REST_WAIT_PER_HOUR + 0.01);
  assert.equal(r1.textId, REST_TEXT.wakeUp);
  assert.deepEqual([d1.minutes, d1.vitals, d1.enemyChecks], [60, 1, 1]);
  // and a FullRest is not gated on hours at all (its hours are 0)
  const d2 = restDeps();
  const r2 = new RestSession('full', 0, d2).tick(0.46);   // 6 sub-ticks = one hour
  assert.equal(r2, null);
  assert.deepEqual([d2.minutes, d2.vitals, d2.enemyChecks], [60, 1, 1]);
});

// ---------------------------------------------------------------
// 5. Instant effects are on the target for one magic round
// ---------------------------------------------------------------

test('audit18 magic: an applied INSTANT effect vetoes a re-cast for exactly one magic round', () => {
  // Fire Daedra's whole spell list is instant DamageHealth (4,0):
  // DFU's AssignBundle adds the effect to liveEffects and the bundle
  // survives until the next DoMagicRound, so CanCastRangedSpell
  // refuses the same spell until then.
  const fireball = {
    element: 0, rangeType: 2,
    effects: [{ type: 4, subType: 0, magnitudeBaseLow: 8, magnitudeBaseHigh: 8, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }],
  };
  const target = { isPlayer: true, career: {}, stats: { willpower: 50 } };
  assert.equal(effectsAlreadyOnTarget(fireball, target), false);
  applySpell(fireball, 5, target, { hurt: () => {} }, seq(0));
  assert.equal(effectsAlreadyOnTarget(fireball, target), true);
  assert.deepEqual(target.activeEffects, [{ kind: 'damageHealth', instant: true, roundsRemaining: 0 }]);
  tickActiveEffects(target, {});                      // DoMagicRound removes the spent bundle
  assert.deepEqual(target.activeEffects, []);
  assert.equal(effectsAlreadyOnTarget(fireball, target), false);
  // The instant families all carry an identity now, per DFU template
  // type - and the per-stat classes stay per-stat.
  assert.deepEqual(effectActiveIdentity({ type: 4, subType: 0 }), { kind: 'damageHealth' });
  assert.deepEqual(effectActiveIdentity({ type: 4, subType: 1 }), { kind: 'damageFatigue' });
  assert.deepEqual(effectActiveIdentity({ type: 4, subType: 2 }), { kind: 'damageSpellPoints' });
  assert.deepEqual(effectActiveIdentity({ type: 10, subType: 8 }), { kind: 'healHealth' });
  assert.deepEqual(effectActiveIdentity({ type: 10, subType: 9 }), { kind: 'healFatigue' });
  assert.deepEqual(effectActiveIdentity({ type: 10, subType: 3 }), { kind: 'healAttribute', stat: 'agility' });
  assert.deepEqual(effectActiveIdentity({ type: 11, subType: 8 }), { kind: 'transferHealth' });
  assert.deepEqual(effectActiveIdentity({ type: 11, subType: 9 }), { kind: 'transferFatigue' });
  assert.deepEqual(effectActiveIdentity({ type: 3, subType: 1 }), { kind: 'curePoison' });
  // A DIFFERENT instant is still absent: one missing effect makes the
  // spell castable (EffectsAlreadyOnTarget returns on the first miss)
  const drainMagicka = { element: 4, rangeType: 2, effects: [{ type: 4, subType: 2, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] };
  applySpell(fireball, 5, target, { hurt: () => {} }, seq(0));
  assert.equal(effectsAlreadyOnTarget(drainMagicka, target), false);
});

test('audit18 magic: an effect the gates REJECTED mints no marker', () => {
  // The cure family rolls its chance before acting; a failed roll
  // never reaches liveEffects, so the veto stays false.
  const cure = { element: 4, rangeType: 0, effects: [{ type: 3, subType: 1, chanceBase: 5, chanceMod: 0, chancePerLevel: 1 }] };
  const target = { isPlayer: true, level: 5, career: {}, stats: { willpower: 50 } };
  const r = applySpell(cure, 5, target, {}, seq(0.99));
  assert.equal(r.chanceFailed, 1);
  assert.equal(r.cured ?? 0, 0);
  assert.deepEqual(target.activeEffects ?? [], []);
  assert.equal(effectsAlreadyOnTarget(cure, target), false);
  // the same cast with a passing chance DOES mint one
  const r2 = applySpell({ ...cure, effects: [{ type: 3, subType: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] }, 5, target, {}, seq(0));
  assert.equal(r2.cured, 1);
  assert.deepEqual(target.activeEffects, [{ kind: 'curePoison', instant: true, roundsRemaining: 0 }]);
});
