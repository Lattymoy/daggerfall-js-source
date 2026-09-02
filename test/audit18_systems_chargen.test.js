// AUDIT 18 - systems/chargen lane. Every pin here is written to FAIL
// when the defect it fixes is put back; the synthetic arms always
// run, the corpus arms walk the shipping ARENA2 data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { finishChargen } from '../src/systems/chargenSession.js';
import { levelUpSkillSum, calculatePlayerLevel, raiseSkills } from '../src/systems/advancement.js';
import { applyBiographyEffect, generateBackstory } from '../src/systems/biography.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import { RACE_TEMPLATES, raceByKey } from '../src/systems/races.js';
import {
  jumpSpeedMultiplier, SKILLS, SKILL_COUNT,
  ATHLETICISM_MULTIPLIER, IMPROVED_ATHLETICISM_MULTIPLIER,
} from '../src/systems/skills.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { ClassFile } from '../src/formats/classFile.js';
import { TextRsc } from '../src/formats/textRsc.js';
import { parseBiog } from '../src/formats/biogFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const arena = (name) => new Uint8Array(readFileSync(join(ARENA2, name)));
import { applyHeadlessChargen } from '../src/systems/chargenSession.js';
import { getReputation } from '../src/systems/factionRep.js';

// ---- a career shaped like a CLASS*.CFG one, so the synthetic arms
// need no data files ----
const synthCareer = (over = {}) => ({
  name: 'Pin',
  primarySkills: [SKILLS.LongBlade, SKILLS.CriticalStrike, SKILLS.Dodging],
  majorSkills: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Running],
  minorSkills: [SKILLS.Swimming, SKILLS.Jumping, SKILLS.Medical, SKILLS.Stealth, SKILLS.Backstabbing, SKILLS.Mercantile],
  hitPointsPerLevel: 10,
  advancementMultiplier: 0.3,
  abilityFlagsAndSpellPointsBitfield: 0x1000,
  ...over,
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
// F1: StartGameBehaviour.cs:415-426 - the biography effects are applied
// FIRST and the level-up anchor is taken AFTER them
// (SetCurrentLevelUpSkillSum, then StartingLevelUpSkillSum =
// CurrentLevelUpSkillSum). The port anchored inside applyCharacter,
// i.e. BEFORE the biography, so every biography skill bonus read as
// post-creation progress.
// =====================================================================
test('AUDIT 18 F1: the level-up anchor is taken AFTER the biography effects', () => {
  const e = freshEntity();
  // LongBlade (29) is a PRIMARY skill of the synthetic career, so a
  // +20 answer moves the counted sum by exactly 20.
  const result = synthResult({ biographyEffects: ['29 +20'] });
  finishChargen(e, result, null, { rolls: () => 0 });

  // the anchor IS the post-biography sum, both fields, to the number
  const post = levelUpSkillSum(e);
  assert.deepEqual(
    { starting: e.startingLevelUpSkillSum, current: e.currentLevelUpSkillSum },
    { starting: post, current: post });
  // and that sum is the pre-biography one plus the answer's 20:
  // 3 primaries + 3 majors - lowest major + highest minor = 30*6 - 30 + 30
  assert.equal(post, 30 * 6 - 30 + 30 + 20);

  // the observable consequence: the FIRST skill raise must leave the
  // character at level 1, not jump it to 3
  assert.equal(calculatePlayerLevel(e.startingLevelUpSkillSum, post + 1), 1);
});

test('AUDIT 18 F1: one skill raise after a biography leaves the player at level 1', { skip: skipReal }, () => {
  const cf = new ClassFile();
  cf.load(arena('CLASS16.CFG'));   // Warrior
  const biog = parseBiog(new TextDecoder('latin1').decode(arena('BIOG16T0.TXT')), 16);
  // every question answered 'a', the way the verifier reproduced it
  const effects = biog.questions.map((q) => q.answers[0].effects).flat();

  const e = freshEntity();
  finishChargen(e, synthResult({ careerIndex: 16, career: cf.career, biographyEffects: effects }), null, { rolls: () => 0 });
  assert.equal(e.startingLevelUpSkillSum, levelUpSkillSum(e));

  e.skillUses = new Array(SKILL_COUNT).fill(0);
  e.skillUses[cf.career.primarySkills[0]] = 20000;   // any raise recomputes + level-checks
  raiseSkills(e, 500, () => 0);
  assert.equal(e.level, 1);
});

// =====================================================================
// F8: PlayerEntity.cs:871 `BackStory = character.backStory;` inside
// AssignCharacter. finishChargen threaded everything else off the flow
// result and dropped the composed prose, so save.js only ever wrote [].
// =====================================================================
test('AUDIT 18 F8: finishChargen assigns the composed backstory, and it survives a save round trip', () => {
  const e = freshEntity();
  finishChargen(e, synthResult({ backStory: ['line one', 'line two'] }), null, { rolls: () => 0 });
  assert.deepEqual(e.backStory, ['line one', 'line two']);

  const snap = snapshotPlayer(e);
  assert.deepEqual(snap.backStory, ['line one', 'line two']);
  const back = freshEntity();
  restorePlayer(back, snap);
  assert.deepEqual(back.backStory, ['line one', 'line two']);
});

// =====================================================================
// F2: ItemBuilder.CreateWeapon:353-368 - "Ignored for arrows". An
// arrow takes stackCount Range(1, 20+1), currentCondition 0 and
// nativeMaterialValue 0; the biography's IT arm minted ONE arrow at
// the file's own material instead.
// =====================================================================
test('AUDIT 18 F2: a biography Arrow is an iron STACK, and two IT lines merge', () => {
  const e = freshEntity();
  const rolls = () => 0.999;   // Range(1, 21) -> 20
  assert.equal(applyBiographyEffect(e, 'IT 3 18 2', { rolls }), 'item');
  assert.deepEqual(e.items, [{
    group: 'Weapons', templateIndex: 131, material: 0, stackCount: 20,
    currentCondition: 0, name: 'Arrow', value: 2,
  }]);

  // the material is forced to iron, so a second line of a DIFFERENT
  // material stacks with the first (inventory.stacksWith keys on it)
  applyBiographyEffect(e, 'IT 3 18 1', { rolls });
  assert.equal(e.items.length, 1);
  assert.equal(e.items[0].stackCount, 40);
});

// =====================================================================
// F3 (the affordable half): ItemBuilder.CreateRandomBook:256-269 rolls
// CurrentVariant = Range(0, TotalVariants). The biography's Books arm
// did not exist, so every biography book drew the same icon while a
// shop book varied. (message + BookFile.Price still pend the books arc
// - the site now says so out loud.)
// =====================================================================
test('AUDIT 18 F3: a biography Book rolls a variant, and the icon follows it', () => {
  const e = freshEntity();
  // template 277 carries variants: 2, so Range(0, 2) at 0.6 -> 1
  assert.equal(applyBiographyEffect(e, 'IT 7 0 0', { rolls: () => 0.6 }), 'item');
  assert.equal(e.items[0].variant, 1);
  // playerTextureRecord 2 + min(variant, variants - 1)
  assert.deepEqual(inventoryItemImage(e.items[0]), { archive: 209, record: 3 });

  const e0 = freshEntity();
  applyBiographyEffect(e0, 'IT 7 0 0', { rolls: () => 0.1 });
  assert.equal(e0.items[0].variant, 0);
  assert.deepEqual(inventoryItemImage(e0.items[0]), { archive: 209, record: 2 });
});

// =====================================================================
// F4 (the minting half): RaceTemplate.cs:38-42's four effect-flag
// fields, dropped by the port's table. Only three playable races set
// anything - Breton :191 Magic, Nord :235 Frost, HighElf :279
// Paralysis - and each sets exactly ONE field.
// =====================================================================
test('AUDIT 18 F4: the eight race templates carry DFU\'s resistance/immunity flags', () => {
  const flags = Object.fromEntries(RACE_TEMPLATES.map((r) => [r.key, {
    resistanceFlags: r.resistanceFlags, immunityFlags: r.immunityFlags,
    lowToleranceFlags: r.lowToleranceFlags, criticalWeaknessFlags: r.criticalWeaknessFlags,
    specialAbilities: r.specialAbilities,
  }]));
  const none = { resistanceFlags: 0, immunityFlags: 0, lowToleranceFlags: 0, criticalWeaknessFlags: 0, specialAbilities: 0 };
  assert.deepEqual(flags, {
    Breton: { ...none, resistanceFlags: 2 },     // EffectFlags.Magic
    Redguard: { ...none },
    Nord: { ...none, resistanceFlags: 16 },      // EffectFlags.Frost
    DarkElf: { ...none },
    HighElf: { ...none, immunityFlags: 1 },      // EffectFlags.Paralysis
    WoodElf: { ...none },
    Khajiit: { ...none },
    Argonian: { ...none },
  });
  // the two the saving throw arm keys on, by id as well as by key
  assert.equal(raceByKey('Breton').resistanceFlags, 2);
  assert.equal(raceByKey('HighElf').immunityFlags, 1);
});

// =====================================================================
// F7: MacroHelper registers %q1b..%q12b and reads a macro name up to
// the next MACRO_TERMINATORS char (never a letter), so "%q1b." is one
// macro; BiogFileMCP.Q1b:462-473 returns the THIRD token's first line.
// The port's regex only knew the optional 'a'.
// =====================================================================
const stubRsc = (byId) => ({ linesById: (id) => byId[id] ?? null });

test('AUDIT 18 F7: %qNb expands the THIRD token, not the first plus a stray letter', () => {
  const rsc = stubRsc({
    900: [{ text: 'A %q1 B %q1a C %q1b. D %q2b.' }],
    10: [{ text: 'FIRST' }], 11: [{ text: 'SECOND' }], 12: [{ text: 'THIRD' }],
    20: [{ text: 'ONLY' }],
  });
  const effects = ['#10 0', '#11 0', '!12 0', '#20 1'];
  const rows = generateBackstory(rsc, 900, effects);
  // the three suffixes are the three DIFFERENT records, and a question
  // with only ONE token expands %q2b to nothing
  assert.deepEqual(rows.map((r) => r.text), ['A FIRST B SECOND C THIRD. D .']);
  // no 'b' artefact survives anywhere
  assert.ok(!/[a-zA-Z]b\./.test(rows[0].text));
});

test('AUDIT 18 F7: TEXT.RSC 4130 (Ranger) renders its %q1b from the real tokens', { skip: skipReal }, () => {
  const rsc = new TextRsc().load(arena('TEXT.RSC'));
  const biog = parseBiog(new TextDecoder('latin1').decode(arena('BIOG14T0.TXT')), 14);
  const effects = biog.questions.map((q, i) => q.answers[0].effects.map((x) => (
    /^[#!?]/.test(x) ? `${x} ${i}` : x))).flat();
  const text = generateBackstory(rsc, 4130, effects).map((r) => r.text).join('\n');
  // the defect left "...daggerb." - a primary token plus a literal b
  assert.ok(!/[a-z]b\./.test(text), `stray b in: ${text}`);
  // question 1's THIRD token is record 4701; its first line must land
  const third = rsc.linesById(4701)[0].text;
  assert.ok(text.includes(third), `missing ${JSON.stringify(third)} in: ${text}`);
});

// =====================================================================
// F9: AcrobatMotor.cs:96-98 adds athleticismMultiplier 0.1 when
// PlayerEntity.Career.Athleticism. The port returned only the Jumping
// term, behind a flag blaming a decode that had already shipped.
// =====================================================================
test('AUDIT 18 F9: Athleticism adds exactly +0.1 to the jump multiplier', () => {
  const withAth = { career: { abilityFlagsAndSpellPointsBitfield: 0x1406 }, skills: new Array(SKILL_COUNT).fill(0) };
  const without = { career: { abilityFlagsAndSpellPointsBitfield: 0x1404 }, skills: new Array(SKILL_COUNT).fill(0) };
  withAth.skills[SKILLS.Jumping] = 40;
  without.skills[SKILLS.Jumping] = 40;
  assert.equal(jumpSpeedMultiplier(without), 1.2);          // 1 + 40*0.5/100
  assert.equal(jumpSpeedMultiplier(withAth), 1.3);          // + athleticismMultiplier
  assert.equal(
    Math.round((jumpSpeedMultiplier(withAth) - jumpSpeedMultiplier(without)) * 1e6) / 1e6, 0.1);
});

// AcrobatMotor.cs:95-101 NESTS improvedAthleticismMultiplier (:15)
// inside the Athleticism branch: the enchantment's +0.1 rides on top
// of the career's +0.1 and does nothing on its own.
test('D9: ImprovedAthleticism is NESTED inside the Athleticism arm, +0.1 on top of +0.1', () => {
  assert.equal(ATHLETICISM_MULTIPLIER, 0.1);            // AcrobatMotor.cs:14
  assert.equal(IMPROVED_ATHLETICISM_MULTIPLIER, 0.1);   // AcrobatMotor.cs:15
  const mk = (bits, mods) => ({
    career: { abilityFlagsAndSpellPointsBitfield: bits },
    skills: new Array(SKILL_COUNT).fill(0),
    ...(mods ? { _enchantMods: mods } : {}),
  });
  const round = (n) => Math.round(n * 1e6) / 1e6;
  const bare = mk(0x1406);                                     // athleticism, no item
  const gifted = mk(0x1406, { improvedAthleticism: true });     // athleticism + item
  const itemOnly = mk(0x1404, { improvedAthleticism: true });   // item, no athleticism
  assert.equal(round(jumpSpeedMultiplier(bare)), 1.1, 'the career flag alone is +0.1');
  assert.equal(round(jumpSpeedMultiplier(gifted)), 1.2, 'the enchantment adds a SECOND +0.1');
  assert.equal(round(jumpSpeedMultiplier(itemOnly)), 1,
    'and it is nested - without the career flag the item does nothing');
});

test('AUDIT 18 F9: the shipping Acrobat (CLASS09) carries the flag and jumps 10% higher', { skip: skipReal }, () => {
  const cf = new ClassFile();
  cf.load(arena('CLASS09.CFG'));
  assert.equal(cf.career.abilityFlagsAndSpellPointsBitfield, 0x1406);   // athleticism (2) + adrenalineRush (4)
  const acrobat = { career: cf.career, skills: new Array(SKILL_COUNT).fill(0) };
  const plain = { career: { ...cf.career, abilityFlagsAndSpellPointsBitfield: 0x1404 }, skills: new Array(SKILL_COUNT).fill(0) };
  acrobat.skills[SKILLS.Jumping] = 50;
  plain.skills[SKILLS.Jumping] = 50;
  assert.equal(jumpSpeedMultiplier(acrobat), 1.35);
  assert.equal(jumpSpeedMultiplier(plain), 1.25);
});

// The stale flag F9 retired must stay retired: skills.js may no longer
// blame the career-advantage decode for the missing multiplier.
test('AUDIT 18 F9: the stale "career advantage decode" excuse is gone from skills.js', () => {
  const src = readFileSync(new URL('../src/systems/skills.js', import.meta.url), 'utf8');
  assert.ok(!/career advantage decode/.test(src), 'skills.js still carries the retired flag text');
});


test('AUDIT 20: the HEADLESS chargen path attaches the faction store too', { skip: skipReal }, async () => {
  // THE ONE CONSTRUCTION SEAM, a fourth time. applyHeadlessChargen is
  // a SECOND copy of the construction - it hand-rolls the starting kit
  // rather than going through applyCreationExtras - so it silently
  // missed the faction store S25 added at the flow's seam. A ?class=
  // character, which all three exterior hosts can boot, had no
  // factionRep at all: a crime moved no faction and guild rank could
  // not be computed.
  const entity = { stats: {}, skills: 30, items: [] };
  await applyHeadlessChargen(entity, 1, { fetchBytes: async (n) => arena(n) });
  assert.ok(entity.factionRep, 'the headless path builds the store');
  assert.equal(entity.factionRep.dict.size, 366, 'the whole faction file');
  assert.equal(getReputation(entity.factionRep, 41), 0, 'and it reads');
});
