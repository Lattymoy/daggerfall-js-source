// AUDIT 39 - the entity/magic lane. Eight findings, each pinned so it
// fails the moment the defect is put back: the load path's dead
// MaxMagicka accessor, the Oghma Infinium's unreachable pool, the
// wizard's no-op region bootstrap, the biography's place in the
// creation order, HealthLeech's two unbilled doors, the vampire and
// lycanthrope spells' flat casting cost, the Mace of Molag Bal's
// unclamped and unhealable drain, and the move-sound timer's re-arm
// (that last one re-pinned in lycanmove.test.js, where the law lives).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createCharacter, spellPoints, spellPointMultiplier } from '../src/systems/chargen.js';
import { finishChargen, applyCreationExtras } from '../src/systems/chargenSession.js';
import { LevelUpScreen } from '../src/ui/charsheet.js';
import { createCharSheetWindow } from '../src/ui/charSheetDoor.js';
import { OGHMA_BONUS_POOL, SPECIAL_ARTIFACT_HANDLERS, ARTIFACTS } from '../src/systems/artifactEffects.js';
import {
  doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES, setDefaultEnchantCtx,
} from '../src/systems/enchantments.js';
import { calculateCastCost, CAST_COST_FLOOR } from '../src/systems/spellcost.js';
import { grantVampireSpells, VAMPIRE_BASE_SPELLS } from '../src/systems/vampirism.js';
import { grantLycanthropySpell, LYCANTHROPY_SPELL_ID } from '../src/systems/lycanthropy.js';
import { setSpellRecordsByIndex } from '../src/systems/loot.js';
import { healAttributeDamage } from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';
import { SKILLS, SKILL_COUNT } from '../src/systems/skills.js';
import { getReputation } from '../src/systems/factionRep.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const synthCareer = () => ({
  name: 'Pin',
  primarySkills: [SKILLS.LongBlade, SKILLS.CriticalStrike, SKILLS.Dodging],
  majorSkills: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Running],
  minorSkills: [SKILLS.Swimming, SKILLS.Jumping, SKILLS.Medical, SKILLS.Stealth, SKILLS.Backstabbing, SKILLS.Mercantile],
  hitPointsPerLevel: 10, advancementMultiplier: 0.3,
  abilityFlagsAndSpellPointsBitfield: 0x1000,   // x1.00 spell points
});
const freshEntity = () => ({
  isPlayer: true, level: 1, health: 50, maxHealth: 50, items: [],
  sGroupReputations: [0, 0, 0, 0, 0],
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
});
const synthResult = (over = {}) => ({
  name: 'Pin', gender: 'male', race: 'Breton', raceId: 1, faceIndex: 0,
  careerIndex: 16, career: synthCareer(),
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: new Array(SKILL_COUNT).fill(30),
  reflexes: 2,
  ...over,
});

// =====================================================================
// #79 - DaggerfallEntity.cs:264 MaxMagicka is a GETTER for the life of
// the entity. The port installed it in applyCharacter alone, and the
// boot skips chargen whenever a save is loaded, so Continue/Load from
// the title menu left `maxMagicka` a plain data property: the ceiling
// froze at the saved number and every maxMagickaModifier producer
// (ExtraSpellPts, the powered-magery specials, the Mace's overflow)
// wrote into a field with no reader.
// =====================================================================
test('AUDIT 39 #79: restorePlayer installs the LIVE MaxMagicka accessor before the field copy', () => {
  const src = { ...freshEntity(), magicka: 10, skills: [30], skillUses: [0], spells: [], activeEffects: [] };
  src.career = synthCareer();
  src.maxMagicka = 42;
  const snap = snapshotPlayer(src, {});

  const dst = {};
  restorePlayer(dst, snap);
  const desc = Object.getOwnPropertyDescriptor(dst, 'maxMagicka');
  assert.equal(typeof desc?.get, 'function', 'an accessor, not the data property the copy used to leave');

  // GetRawMaxMagicka's player arm: SpellPoints(LiveIntelligence, mult)
  assert.equal(dst.maxMagicka, spellPoints(50, spellPointMultiplier(0x1000)));
  // LiveIntelligence moves it (DaggerfallStats.cs:155-163)
  dst.activeEffects = [{ kind: 'fortifyAttribute', stat: 'intelligence', magnitude: 30 }];
  assert.equal(dst.maxMagicka, spellPoints(80, spellPointMultiplier(0x1000)));
  // and MaxMagickaModifier is folded in and floored at 0 (:475-482)
  dst.activeEffects = [];
  dst.maxMagickaModifier = 25;
  assert.equal(dst.maxMagicka, spellPoints(50, spellPointMultiplier(0x1000)) + 25);
  dst.maxMagickaModifier = -9999;
  assert.equal(dst.maxMagicka, 0);
});

// =====================================================================
// #80 - DaggerfallCharacterSheetWindow.UpdatePlayerValues (:369-394)
// mounts the stats rollout on the SHEET whenever ReadyToLevelUp is set,
// with `bonusPool = oghmaBonusPool` (30) on the Oghma arm and no
// BonusPool() draw at all. The port's sheet read neither flag and its
// level-up screen rolled 4..6 unconditionally, so the Infinium was
// consumed for nothing and its latched flag ate the next real level-up.
// =====================================================================
test('AUDIT 39 #80: the Oghma opens the level-up rollout, and its pool is the fixed 30', () => {
  const p = freshEntity();
  createCharacter(p, synthCareer(), 16, { rolls: () => 0 });
  const book = {
    group: 'Artifacts', templateIndex: 1, name: 'Oghma Infinium',
    enchantments: [{ type: ENCHANTMENT_TYPES.SpecialArtifactEffect, param: ARTIFACTS.OghmaInfinium }],
    currentCondition: 800, maxCondition: 800,
  };
  p.items = [book];
  doItemEnchantmentPayloads(PAYLOAD.Used, book, { entity: p, ctx: {}, collection: p.items });
  assert.equal(p.readyToLevelUp, true);
  assert.equal(p.oghmaLevelUp, true);

  // the sheet door mounts the rollout, not the read-only sheet
  const w = createCharSheetWindow({ entity: p });
  assert.ok(w instanceof LevelUpScreen, 'ReadyToLevelUp mounts the rollout (UpdatePlayerValues :370)');
  assert.equal(w.pool, OGHMA_BONUS_POOL, 'oghmaBonusPool, not a 4..6 draw');

  // spend it by hand and confirm: no Level++, no health roll, both
  // flags cleared (:392-393)
  const level = p.level, maxHealth = p.maxHealth;
  const before = { ...p.stats };
  for (let i = 0; i < OGHMA_BONUS_POOL; i++) w.input('plus');
  assert.equal(w.pool, 0, 'all thirty points are spendable');
  w.input('confirm');
  assert.equal(w.done, true);
  assert.equal(p.stats.strength, before.strength + OGHMA_BONUS_POOL);
  assert.equal(p.level, level, 'NO Level++');
  assert.equal(p.maxHealth, maxHealth, 'no health raise');
  assert.equal(p.oghmaLevelUp, false);
  assert.equal(p.readyToLevelUp, false);

  // and the ORDINARY level-up still draws its own 4..6 pool
  const q = freshEntity();
  createCharacter(q, synthCareer(), 16, { rolls: () => 0 });
  q.readyToLevelUp = true; q.pendingLevel = 2;
  const lv = new LevelUpScreen(q, () => 0);
  assert.equal(lv.pool, 4, 'the low end of BonusPool(), drawn only off the non-oghma arm');
  assert.ok(!(createCharSheetWindow({ entity: { level: 1 } }) instanceof LevelUpScreen),
    'a character owed nothing gets the sheet');
});

// =====================================================================
// #81 - PlayerEntity.InitializeRegionData (:2211-2217) runs twelve
// double passes over a faction dict the entity already owns
// (StartGameBehaviour.cs:433, after AssignCharacter). The port's wizard
// path bootstrapped BEFORE attachFactionRep, so regionPower's
// `if (!dict) return` made all 24 passes a no-op - and even a store
// attached some other way was thrown away, attachFactionRep rebuilding
// fresh records out of the dictionary.
// =====================================================================
const fac = (id, power) => [id, {
  id, power, rep: 0, flags: 0, rulerPowerBonus: 0,
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
  region: -1, type: 2, ggroup: 0, sgroup: 0, parent: 0, children: [],
}];

test('AUDIT 39 #81: a wizard-made character starts 24 power-walk steps in, not on FACTION.TXT bases', () => {
  const dict = new Map([fac(201, 40), fac(202, 60), fac(203, 55)]);
  const bases = [...dict.values()].map((f) => f.power);
  const e = freshEntity();
  finishChargen(e, synthResult({ factionDict: dict }), null, { rolls: () => 0 });
  assert.ok(e.factionRep, 'the store is attached by creation');
  const after = [...e.factionRep.dict.values()].map((f) => f.power);
  assert.notDeepEqual(after, bases, 'InitializeRegionData walked a REAL dict');

  // the biography's `rf` deltas still drain into that same store, and
  // they are not re-applied by the later readers
  const e2 = freshEntity();
  finishChargen(e2, synthResult({ factionDict: new Map([fac(201, 40)]), biographyEffects: ['rf201 +12'] }), null, { rolls: () => 0 });
  assert.equal(getReputation(e2.factionRep, 201), 12, 'BiogFile.cs:339, drained by the attach');
  assert.deepEqual(e2.pendingFactionRep, [], 'and the parked list is consumed');
});

// =====================================================================
// #82 - StartGameBehaviour.cs:415-419 applies the biography effects
// BEFORE AssignStartingEquipment. ItemCollection.AddItem defaults to
// AddPosition.Back, so the collection order IS the bag order: the port
// ran the kit first, landing a biography item behind the torches and
// running its GP arithmetic against the kit's 100 gold.
// =====================================================================
test('AUDIT 39 #82: the biography lands BEFORE the starting kit', () => {
  const e = freshEntity();
  // "IT 4 2 1" - a MagicItems-group mint would need templates; use the
  // GP arm, which is the half with arithmetic in it. A '-' command
  // clamps at zero, so an empty purse and a stocked one differ.
  finishChargen(e, synthResult({ biographyEffects: ['GP - 50'] }), null, { rolls: () => 0 });
  const gold = e.items.find((it) => it.group === 'Currency');
  assert.equal(gold.stackCount, 100,
    'the answer took 50 from an EMPTY purse (clamped to 0), then the kit paid its 100');

  // and the same answer after the kit would have taken it out of the
  // 100 - which is what the old order did
  const kitFirst = freshEntity();
  applyCreationExtras(kitFirst, synthResult(), null, { rolls: () => 0 });
  const before = kitFirst.items.find((it) => it.group === 'Currency').stackCount;
  assert.equal(before, 100, 'the kit alone is 100 gold');

  // the bag ORDER: the spellbook still heads the kit (ItemHelper.cs:1300)
  const bagged = freshEntity();
  finishChargen(bagged, synthResult({ biographyEffects: [] }), null, { rolls: () => 0 });
  assert.equal(bagged.items[0].templateIndex, 132, 'the spellbook is first when no answer put anything ahead of it');

  // the source order itself, so a later edit cannot quietly swap them
  // (the wizard's seam only - the ?class= copy at the head of the file
  // builds its own kit and has always run in DFU's order)
  const src = read('src/systems/chargenSession.js');
  const seam = src.slice(src.indexOf('export function applyCreationExtras'));
  assert.ok(seam.indexOf('applyBiographyEffects(playerEntity') < seam.indexOf('assignStartingGear(playerEntity'),
    'ApplyEffects then AssignStartingEquipment, StartGameBehaviour.cs:415-419');
  assert.ok(seam.indexOf('attachFactionRep(playerEntity') < seam.indexOf('bootstrapRegionPower(playerEntity.factionRep'),
    'and the store exists before InitializeRegionData walks it');
});

// =====================================================================
// #84/#85 - HealthLeech.cs. The WheneverUsed arm bills the wearer 8 on
// a strike and 16 on a use (:86-89) through the entity behaviour it is
// always handed; the port's `ctx.hurtSelf` was mounted only on
// worldTick's per-round context, so both doors cost nothing. And every
// callback stamps timeHealthLeechLastUsed with the LIVE classic minute
// (:77-78) - the strike site passed a literal 0, so the daily/weekly
// leech read the item as never used and never switched off.
// =====================================================================
const leechItem = (param) => ({
  group: 'Weapons', templateIndex: 130, name: 'Leech', currentCondition: 100, maxCondition: 100,
  enchantments: [{ type: ENCHANTMENT_TYPES.HealthLeech, param }],
});

test('AUDIT 39 #84: the WheneverUsed leech bills the wearer at BOTH doors', () => {
  const hurts = [];
  setDefaultEnchantCtx({ now: () => 600000, hurtSelf: (n) => hurts.push(n) });
  try {
    const e = { isPlayer: true, health: 60, maxHealth: 60 };
    doItemEnchantmentPayloads(PAYLOAD.Used, leechItem(0), { entity: e });
    doItemEnchantmentPayloads(PAYLOAD.Strikes, leechItem(0), { entity: e, damage: 5 });
    assert.deepEqual(hurts, [16, 8], 'leechCastAmount then leechWeaponAmount (:84-89)');
  } finally { setDefaultEnchantCtx(null); }

  // the host mount is where it has to live - worldTick's round ctx
  // reaches only the magic round
  assert.match(read('src/scenes/world.js'), /hurtSelf: \(n\) => \{ if \(n > 0\) hurtPlayer\(playerEntity, n\); \},/);
});

test('AUDIT 39 #85: the strike stamps the LIVE classic minute, so the timed leech switches off', () => {
  const hurts = [];
  const NOW = 523530 + 5000;   // an absolute classic minute, as the world's clock reads
  setDefaultEnchantCtx({ now: () => NOW, hurtSelf: (n) => hurts.push(n) });
  try {
    const e = { isPlayer: true, health: 60, maxHealth: 60 };
    const daily = leechItem(1);
    // before any use the stamp is absent: the leech is ON, 1 health
    // every 4th round (:106-113)
    doItemEnchantmentPayloads(PAYLOAD.MagicRound, daily, { entity: e, round: 4, nowMinutes: NOW });
    assert.deepEqual(hurts, [1], 'an unused daily leech drains');

    // a strike stamps NOW - not 0, which is what made `since` always
    // astronomically greater than a day
    doItemEnchantmentPayloads(PAYLOAD.Strikes, daily, { entity: e, damage: 5 });
    assert.equal(daily.timeHealthLeechLastUsed, NOW);
    hurts.length = 0;
    doItemEnchantmentPayloads(PAYLOAD.MagicRound, daily, { entity: e, round: 8, nowMinutes: NOW });
    assert.deepEqual(hurts, [], 'the strike bought a day of relief');
    // and a day later it is back
    doItemEnchantmentPayloads(PAYLOAD.MagicRound, daily, { entity: e, round: 8, nowMinutes: NOW + 1441 });
    assert.deepEqual(hurts, [1]);
  } finally { setDefaultEnchantCtx(null); }
});

// =====================================================================
// #86 - PlayerEntity.cs:1138/:1162 grant every vampire clan spell and
// the lycanthrope's morph with MinimumCastingCost, and
// FormulaHelper.cs:2234-2236 ASSIGNS castCostFloor when it is set. The
// port read that as equivalent to its universal floor - which only ever
// RAISES a cheap spell - so the granted spells were billed in full.
// =====================================================================
const expensiveSpell = () => ({
  index: 20, name: 'Ice Storm', rangeType: 3,
  effects: [{ type: 4, subType: 2, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 40, magnitudeBaseHigh: 60, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }],
});

test('AUDIT 39 #86: MinimumCastingCost ASSIGNS the floor, it does not merely floor', () => {
  const caster = { isPlayer: true, level: 5, skills: new Array(SKILL_COUNT).fill(30), stats: { intelligence: 50 } };
  const full = calculateCastCost(expensiveSpell(), caster);
  assert.ok(full.sp > CAST_COST_FLOOR, 'the fixture is a spell the floor could never have reached');
  const flagged = calculateCastCost({ ...expensiveSpell(), minimumCastingCost: true }, caster);
  assert.equal(flagged.sp, CAST_COST_FLOOR, 'a flat 5 (FormulaHelper.cs:2234-2236)');
  assert.equal(flagged.gold, full.gold, 'the GOLD cost is untouched by the flag');

  // and both grants stamp it
  setSpellRecordsByIndex(new Map([
    ...VAMPIRE_BASE_SPELLS.map((i) => [i, { index: i, name: `V${i}`, effects: [] }]),
    [LYCANTHROPY_SPELL_ID, { index: LYCANTHROPY_SPELL_ID, name: '!Lycanthropy', effects: [] }],
  ]));
  try {
    const v = { spells: [] };
    grantVampireSpells(v, 'none');
    assert.ok(v.spells.length >= VAMPIRE_BASE_SPELLS.length);
    assert.ok(v.spells.every((s) => s.minimumCastingCost === true), 'AssignVampireSpell (:1138)');
    const w = { spells: [] };
    grantLycanthropySpell(w);
    assert.equal(w.spells[0].minimumCastingCost, true, 'AssignPlayerLycanthropySpell (:1162)');
  } finally { setSpellRecordsByIndex(null); }
});

// =====================================================================
// #87 - MaceOfMolagBalEffect.DrainTargetStrength (:186-212) assigns a
// real DrainStrength bundle and calls drain.IncreaseMagnitude, whose
// clamp holds the live stat at 1 of the permanent value and which Heal
// Strength can undo. The port minted a bespoke `kind: 'artifact'` entry
// with an unbounded negative statMod: unhealable, and - through
// killIfAnyLiveStatZero - an instant kill on a magicka-less foe.
// =====================================================================
test('AUDIT 39 #87: the Mace drains the target through a real DrainStrength incumbent', () => {
  const mace = SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.MaceOfMolagBal);
  const wielder = {
    isPlayer: true, level: 5, activeEffects: [], magicka: 20, maxMagicka: 30,
    stats: { strength: 50, willpower: 50, luck: 50 },
  };
  const target = { health: 30, magicka: 0, stats: { strength: 8, willpower: 0, luck: 0 }, level: 1, skills: {}, activeEffects: [] };
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  // fail the save (0.99), then 1 + floor(0.5*6) = 4
  mace.strikes({ entity: wielder, target, damage: 5, nowMinutes: 100, rolls: seq(0.99, 0.5) });
  const entry = target.activeEffects.find((a) => a.kind === 'drainAttribute');
  assert.ok(entry, 'the ordinary drain channel, not a bespoke artifact entry');
  assert.equal(entry.stat, 'strength');
  assert.equal(entry.magnitude, 4);
  assert.equal(liveStat(target, 'strength'), 4);

  // strike again: IncreaseMagnitude never takes the stat below 1 of
  // the permanent value, so the drain plateaus instead of killing
  for (let i = 0; i < 6; i++) mace.strikes({ entity: wielder, target, damage: 5, nowMinutes: 100, rolls: seq(0.99, 0.5) });
  assert.equal(entry.magnitude, 7, 'permanentValue - 1 (DrainEffect.IncreaseMagnitude)');
  assert.equal(liveStat(target, 'strength'), 1, 'a drained stat plateaus at 1 - the drain alone never kills');

  // and Heal Strength repairs it, which it could never do before
  healAttributeDamage(target, 'strength', 3);
  assert.equal(entry.magnitude, 4);
  assert.equal(liveStat(target, 'strength'), 4);
  healAttributeDamage(target, 'strength', 99);
  assert.equal(entry.ended, true, 'healed to 0, the incumbent ends');
});

// =====================================================================
// #88 - LycanthropyEffect.cs:519-521 re-arms the move-sound timer
// inside MorphSelf's transform-into-beast branch. The behaviour is
// pinned in lycanmove.test.js (where the LM1 laws live); this is the
// source pin that the call site exists at all.
// =====================================================================
test('AUDIT 39 #88: MorphSelf re-arms the move-sound timer on the way INTO beast form', () => {
  const src = read('src/systems/lycanthropy.js');
  const at = src.indexOf("entry.raceNameOverride = entry.infectionType === LYCANTHROPY_TYPES.Wereboar");
  assert.ok(at > 0);
  const branch = src.slice(at, src.indexOf('} else {', at));
  assert.match(branch, /entry\.moveSoundTimer = initMoveSoundTimer\(rolls\);/,
    'the third InitMoveSoundTimer call site (:521), after the compound-race name swap');
  // and the note that said DFU does NOT re-arm is gone
  assert.doesNotMatch(src, /resumes it rather than restarting/);
});
