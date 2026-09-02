// ROAD TO 1:1, Wave A, group a4-save-import.
//
// Two laws, both about a character SURVIVING a doorway: the save
// envelope (SerializablePlayer's PlayerEntityData_v1 members the port
// never carried) and the classic import (StartFromClassicSave's tail
// and DaggerfallUnityItem.FromItemRecord's identity bits).
//
// Every pin here is BEHAVIOURAL where the law is pure - the damage
// gate that reads minMetalToHit, the temple bill that counts the
// turn, the info-text id an artifact resolves to - because a
// round-trip pin alone proves only that a field made the trip, not
// that anything on the far side reads it (the AUDIT 39 lesson).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  snapshotPlayer, restorePlayer, newSkillsRecentlyRaised,
} from '../src/systems/save.js';
import {
  raiseSkills, skillRecentlyIncreased, setSkillRecentlyIncreased,
  resetSkillsRecentlyRaised, SKILL_RAISE_CHECK_INTERVAL,
} from '../src/systems/advancement.js';
import {
  cureDiseaseOffer, payForCure, cureForFree, becomingVampireOrWerebeast,
  CURE_BASE_COST_PER_DISEASE,
} from '../src/systems/guildServiceActions.js';
import { GUILDS } from '../src/systems/guilds.js';
import { classicItemFromRecord } from '../src/systems/classicSave.js';
import {
  legacyGetArtifactSubType, legacyArtifactIndexBitfieldCheck,
  ITEM_ARTIFACT_MASK, ITEM_IDENTIFIED_MASK,
} from '../src/systems/loot.js';
import { calculateAttackDamage, MATERIAL_INEFFECTIVE_TEXT } from '../src/combat/formulas.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { itemInfoTextId, INFO_TEXT } from '../src/systems/itemInfo.js';
import { isBook } from '../src/systems/useItem.js';
import { itemIsIdentified } from '../src/systems/tradeModes.js';
import { SKILLS } from '../src/systems/skills.js';

/** A minimal live entity snapshotPlayer accepts (the audit24_save
 *  shape, which is the house fixture for this file). */
function makeEntity(over = {}) {
  return {
    name: 'Tester', race: 'Breton', gender: 'male', level: 3,
    stats: { strength: 50, endurance: 40, agility: 30, speed: 30, willpower: 30, intelligence: 30, luck: 30, personality: 30 },
    skills: new Array(35).fill(10), skillUses: new Array(35).fill(0),
    items: [], wagonItems: [], activeEffects: [], spells: [],
    health: 30, fatigue: 100, magicka: 10, gold: 0,
    ...over,
  };
}

/** One PLAYER swing of a weapon of the given material at `target`,
 *  reporting whether the material gate refused it. The refusal has a
 *  line of its own (MATERIAL_INEFFECTIVE_TEXT) and a plain miss does
 *  not, which is the only way to tell the two zeroes apart. */
function swing(target, material) {
  const said = [];
  const weapon = {
    group: 'Weapons', templateIndex: 117, material,
    currentCondition: 100, maxCondition: 100,
  };
  const attacker = makeEntity({ isPlayer: true, career: null });
  const damage = calculateAttackDamage(attacker, target, {
    weapon, rolls: () => 0, dfRand: () => 0, say: (s) => said.push(s),
  });
  return { damage, refused: said.includes(MATERIAL_INEFFECTIVE_TEXT) };
}

// ── minMetalToHit (SerializablePlayer.cs:135, :304) ───────────────

test('a4 envelope: minMetalToHit survives a load, so a loaded werewolf still needs silver', () => {
  // The two racial curses write the floor (LycanthropyEffect.cs:198,
  // VampirismEffect.cs:125) and CalculateAttackDamage reads it on the
  // TARGET (FormulaHelper.cs:576-583). Between them the port had no
  // envelope, so the first swing after a load - before the curse's
  // next constant round re-armed it - landed with plain steel.
  const werewolf = makeEntity({ minMetalToHit: WEAPON_MATERIALS.Silver });
  const snap = snapshotPlayer(werewolf, {});
  assert.equal(snap.minMetalToHit, WEAPON_MATERIALS.Silver, 'it rides out');

  const loaded = makeEntity();
  restorePlayer(loaded, snap);
  assert.equal(loaded.minMetalToHit, WEAPON_MATERIALS.Silver, 'and back in');

  // and the CONSUMER reads the restored value. The gate's own tell is
  // the line it says when the PLAYER swings (FormulaHelper.cs:578-580,
  // key "materialIneffective") - the only signal that separates "the
  // material was refused" from "the swing simply missed", both of
  // which return 0.
  assert.equal(swing(loaded, WEAPON_MATERIALS.Steel).refused, true,
    'steel cannot touch a restored werewolf');
  assert.equal(swing(loaded, WEAPON_MATERIALS.Silver).refused, false,
    'silver is not refused by the material gate');
});

test('a4 envelope: a save older than minMetalToHit loads with no material floor', () => {
  // C#'s enum default is WeaponMaterialTypes.Iron (0), which the
  // damage gate can never refuse (`0 > material` is false for every
  // real material); the port's absent field reads the same way.
  const snap = snapshotPlayer(makeEntity(), {});
  delete snap.minMetalToHit;
  const loaded = makeEntity({ minMetalToHit: WEAPON_MATERIALS.Silver });
  restorePlayer(loaded, snap);
  assert.equal(loaded.minMetalToHit, undefined, 'nothing invented for a pre-A4 save');
  assert.equal(swing(loaded, WEAPON_MATERIALS.Iron).refused, false,
    'no floor at all, exactly as Iron behaves');
});

// ── skillsRecentlyRaised (PlayerEntity.cs:218-231, :1387) ─────────

test('a4 envelope: the skillsRecentlyRaised bit math is the C# word/bit split', () => {
  // GetSkillRecentlyIncreased: `masks[skill / 32] & (1 << (skill % 32))`.
  // The 35 skills need TWO words, and the split is the only reason
  // there are two - a port that used one would silently drop skills
  // 32, 33 and 34 (Blunt, Archery, CriticalStrike in DFCareer order).
  const e = makeEntity();
  assert.deepEqual(newSkillsRecentlyRaised(), [0, 0]);
  assert.equal(skillRecentlyIncreased(e, 0), false, 'a mask-less entity reports nothing raised');

  setSkillRecentlyIncreased(e, 0);
  setSkillRecentlyIncreased(e, 31);
  setSkillRecentlyIncreased(e, 34);
  assert.equal(skillRecentlyIncreased(e, 0), true);
  assert.equal(skillRecentlyIncreased(e, 31), true, 'bit 31 - the sign bit, kept unsigned');
  assert.equal(skillRecentlyIncreased(e, 34), true, 'skill 34 lives in the SECOND word');
  assert.equal(skillRecentlyIncreased(e, 2), false);
  assert.ok(e.skillsRecentlyRaised[0] > 0, 'word 0 never goes negative');
  assert.equal(e.skillsRecentlyRaised[1], 1 << 2, 'word 1 carries 34 % 32 = bit 2');

  resetSkillsRecentlyRaised(e);
  assert.deepEqual(e.skillsRecentlyRaised, [0, 0], 'Array.Clear over both words');
  assert.equal(skillRecentlyIncreased(e, 34), false);
});

test('a4 envelope: a skill raise SETS the mark and the mark survives a save', () => {
  // SetSkillRecentlyIncreased sits between the raise and
  // SetCurrentLevelUpSkillSum (PlayerEntity.cs:1386-1388), so a skill
  // that goes up is marked and a skill that does not is not.
  const e = makeEntity({
    chargenDone: true, reflexes: 2, lastSkillCheckTime: 0, level: 1,
    career: { advancementMultiplier: 0.3, primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] },
    startingLevelUpSkillSum: 0, currentLevelUpSkillSum: 0,
  });
  e.skillUses[SKILLS.Running] = 30000;   // far past any threshold
  const raised = raiseSkills(e, SKILL_RAISE_CHECK_INTERVAL + 1, () => 0.5, () => {});
  assert.ok(raised.includes(SKILLS.Running), 'the fixture really raised Running');
  assert.equal(skillRecentlyIncreased(e, SKILLS.Running), true, 'and marked it');
  assert.equal(skillRecentlyIncreased(e, SKILLS.Swimming), false, 'a skill that did not go up is unmarked');

  const loaded = makeEntity();
  // BOTH copy edges, separately - asserted against the ORIGINAL entity
  // alone, the snapshot's own array sits between them and either spread
  // can go missing without the assertion moving.
  const snap = snapshotPlayer(e, {});
  assert.notEqual(snap.skillsRecentlyRaised, e.skillsRecentlyRaised,
    'the snapshot takes a COPY, not the live entity array');
  restorePlayer(loaded, snap);
  assert.equal(skillRecentlyIncreased(loaded, SKILLS.Running), true,
    'the sheet still has something to highlight after a reload');
  assert.notEqual(loaded.skillsRecentlyRaised, snap.skillsRecentlyRaised,
    'and the restore hands out a COPY, not the save record\'s array');
  // the behavioural tell: a raise on the restored entity must not write
  // back through the save record it was restored from
  setSkillRecentlyIncreased(loaded, SKILLS.Swimming);
  assert.equal(skillRecentlyIncreased({ skillsRecentlyRaised: snap.skillsRecentlyRaised }, SKILLS.Swimming),
    false, 'the save record is not a window onto the live entity');
});

test('a4 envelope: a save with no skillsRecentlyRaised restores DFU\'s new uint[2]', () => {
  // SerializablePlayer.cs:292 is the only one of the four stragglers
  // DFU guards, and it guards because the value is indexed into: a
  // null here would throw on the next raise, not merely read as zero.
  const snap = snapshotPlayer(makeEntity(), {});
  delete snap.skillsRecentlyRaised;
  const loaded = makeEntity({ skillsRecentlyRaised: [7, 7] });
  restorePlayer(loaded, snap);
  assert.deepEqual(loaded.skillsRecentlyRaised, [0, 0]);
});

test('a4 envelope: the construction seam mints the masks, and a new character clears them', () => {
  // PlayerEntity.cs:70 constructs `new uint[2]`, so the field is never
  // absent on a live entity - the port's own construction seam (the
  // skillUses lesson, playerEntity.js) has to carry it too. And
  // chargen assigns onto the MODULE SINGLETON where DFU builds a new
  // PlayerEntity, so the reset belongs there or a character created
  // after a session inherits the previous one's highlights.
  // INTEGRATION MOVED THIS PIN: A11 landed the same field with the
  // named word count (skills.js SKILLS_RECENTLY_RAISED_WORDS), so the
  // mint is spelled through the constant now - the LAW pinned is that
  // both construction seams mint the all-zero pair.
  const MINT = /skillsRecentlyRaised:\s*(\[0,\s*0\]|new Array\(SKILLS_RECENTLY_RAISED_WORDS\)\.fill\(0\))/;
  const src = readFileSync(new URL('../src/characters/playerEntity.js', import.meta.url), 'utf8');
  assert.match(src, MINT, 'the construction seam mints the pair');
  const chargen = readFileSync(new URL('../src/systems/chargen.js', import.meta.url), 'utf8');
  assert.match(chargen, MINT, 'and a new character resets it beside skillUses');
});

// ── previousVampireClan (SerializablePlayer.cs:163, :331) ─────────

test('a4 envelope: previousVampireClan round-trips, and an older save reads None', () => {
  // VampireClans.None is 0, which is also C#'s default for the member,
  // so the absent-field arm and the never-was-a-vampire arm are the
  // same value by construction.
  const cured = makeEntity({ previousVampireClan: 157 });   // Anthotis
  const loaded = makeEntity();
  restorePlayer(loaded, snapshotPlayer(cured, {}));
  assert.equal(loaded.previousVampireClan, 157);

  const old = snapshotPlayer(makeEntity(), {});
  delete old.previousVampireClan;
  const l2 = makeEntity({ previousVampireClan: 157 });
  restorePlayer(l2, old);
  assert.equal(l2.previousVampireClan, 0, 'VampireClans.None');
});

// ── timeToBecomeVampireOrWerebeast (:146, :315) + its consumer ────

test('a4 envelope: the turn counts as one more disease at the temple, and a cure clears it', () => {
  // DaggerfallGuildServiceCureDisease.cs:57-59 - `if
  // (TimeToBecomeVampireOrWerebeast != 0) numberOfDiseases++`, at 250
  // gold a disease before every modifier. A clean character with the
  // stamp set is NOT "not diseased".
  const clean = makeEntity({ items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 100000 }] });
  assert.equal(becomingVampireOrWerebeast(clean), false);
  assert.equal(cureDiseaseOffer(clean, GUILDS.FightersGuild, null, { quality: 10 }).kind, 'noDisease');

  const turning = makeEntity({
    items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 100000 }],
    timeToBecomeVampireOrWerebeast: 123456,
  });
  assert.equal(becomingVampireOrWerebeast(turning), true);
  const offer = cureDiseaseOffer(turning, GUILDS.FightersGuild, null, { quality: 10, nowClassicMinutes: 0 });
  assert.equal(offer.kind, 'offer', 'the turn alone is enough to be offered a cure');
  assert.equal(offer.diseases, 1, 'exactly one more than the zero diseases carried');
  assert.ok(offer.cost > 0);
  assert.equal(CURE_BASE_COST_PER_DISEASE, 250);

  // ConfirmCuring's Yes arm (:126) clears the turn beside the diseases.
  assert.equal(payForCure(turning, offer.cost).kind, 'cured');
  assert.equal(turning.timeToBecomeVampireOrWerebeast, 0, 'cured of the turn, not only of the diseases');

  // and the free-holiday arm (:72) does the same without payment.
  const free = makeEntity({ timeToBecomeVampireOrWerebeast: 999 });
  cureForFree(free);
  assert.equal(free.timeToBecomeVampireOrWerebeast, 0);
});

test('a4 envelope: the turn survives a save, and an older save loads at 0', () => {
  const turning = makeEntity({ timeToBecomeVampireOrWerebeast: 987654 });
  const loaded = makeEntity();
  restorePlayer(loaded, snapshotPlayer(turning, {}));
  assert.equal(loaded.timeToBecomeVampireOrWerebeast, 987654);
  assert.equal(becomingVampireOrWerebeast(loaded), true, 'and the temple still bills for it');

  const old = snapshotPlayer(makeEntity(), {});
  delete old.timeToBecomeVampireOrWerebeast;
  const l2 = makeEntity({ timeToBecomeVampireOrWerebeast: 5 });
  restorePlayer(l2, old);
  assert.equal(l2.timeToBecomeVampireOrWerebeast, 0, 'the uint type default');
});

// ── LegacyArtifactIndexBitfieldCheck (DaggerfallUnityItem.cs:1697) ─

test('a4 import: LegacyGetArtifactSubType is the name reversal, punctuation and all', () => {
  // ItemHelper.cs:534 - apostrophes DROPPED, spaces to underscores,
  // then the first enum name the result CONTAINS wins. A substring
  // test, so decoration around the name does not defeat it.
  assert.equal(legacyGetArtifactSubType('Auriel\'s Bow'), 12);
  assert.equal(legacyGetArtifactSubType('Oghma Infinium'), 5);
  assert.equal(legacyGetArtifactSubType('Mace of Molag Bal'), 2);
  assert.equal(legacyGetArtifactSubType('Ebony Blade'), 22);
  assert.equal(legacyGetArtifactSubType('The Wabbajack of doom'), 6, 'CONTAINS, not equals');
  assert.equal(legacyGetArtifactSubType('Iron Dagger'), -1, 'ArtifactsSubTypes.None');
  assert.equal(legacyGetArtifactSubType(''), -1);
  assert.equal(legacyGetArtifactSubType(null), -1);
});

test('a4 import: the bitfield is generated only for an artifact that lacks one', () => {
  // "(ArtifactIndexBitfield & 1) ...check if this bitfield has been
  // set" (:179) - bit 0 is the HAS-AN-INDEX flag and the index is
  // `subType << 1 | 1`.
  const razor = legacyArtifactIndexBitfieldCheck({ artifact: true, name: 'Mehrunes\' Razor' });
  assert.equal(razor.artifactIndexBitfield, (1 << 1) | 1);
  assert.equal(razor.artifactIndexBitfield >> 1, 1, 'ArtifactsSubTypes.Mehrunes_Razor');

  // a non-artifact is never touched
  assert.equal(legacyArtifactIndexBitfieldCheck({ artifact: false, name: 'Mehrunes\' Razor' }).artifactIndexBitfield, undefined);
  // an artifact that already has a real index keeps it (the low bit set)
  const already = legacyArtifactIndexBitfieldCheck({ artifact: true, name: 'Mehrunes\' Razor', artifactIndexBitfield: (9 << 1) | 1 });
  assert.equal(already.artifactIndexBitfield >> 1, 9, 'not re-derived from the name');
  // an artifact whose name matches nothing is LEFT without an index,
  // which is DFU's own outcome rather than a wrong guess
  assert.equal(legacyArtifactIndexBitfieldCheck({ artifact: true, name: 'Renamed Blade' }).artifactIndexBitfield, undefined);
});

test('a4 import: a classic artifact imports as an artifact, not as a plain enchanted item', () => {
  // FromItemRecord copies the classic flags word and DFU derives both
  // identity bits from it (:96-97, :310); the port models them as
  // booleans, so the import has to read them back out.
  assert.equal(ITEM_ARTIFACT_MASK, 0x800);
  assert.equal(ITEM_IDENTIFIED_MASK, 0x20);
  const record = (over = {}) => ({ parsedData: {
    name: 'Chrysamere', group: 3, index: 4, value: 60000,
    flags: ITEM_ARTIFACT_MASK | ITEM_IDENTIFIED_MASK,
    currentCondition: 300, maxCondition: 400, typeDependentData: 0,
    image1: 0x1234, material: 2, color: 0, enchantmentPoints: 500, message: 0,
    magic: [{ type: 26, param: 14 }, { type: -1, param: -1 }],
    ...over,
  } });

  const blade = classicItemFromRecord(record());
  assert.equal(blade.artifact, true, 'the artifact bit is read, not dropped');
  assert.equal(blade.isIdentified, true, 'and classic had already identified it');
  assert.equal(blade.artifactIndexBitfield >> 1, 14, 'ArtifactsSubTypes.Chrysamere');

  // THE CONSUMERS. An artifact weapon resolves to the no-material info
  // record, an artifact book is not the plain reader's book, and the
  // trade window does not offer to identify what is already identified.
  assert.equal(itemInfoTextId(blade), INFO_TEXT.weaponNoMaterial);
  assert.equal(itemIsIdentified(blade), true);
  const oghma = classicItemFromRecord(record({ name: 'Oghma Infinium', group: 7, index: 0 }));
  assert.equal(oghma.group, 'Books');
  assert.equal(oghma.artifact, true);
  assert.equal(isBook(oghma), false, 'an artifact book skips the plain reader (:1712)');

  // and an ORDINARY enchanted item keeps reading as one
  const ring = classicItemFromRecord(record({ name: 'Ring', group: 25, index: 0, flags: 0 }));
  assert.equal(ring.artifact, false);
  assert.equal(ring.isIdentified, false, 'unidentified enchanted loot still needs the service');
  assert.equal(ring.artifactIndexBitfield, undefined);
});
