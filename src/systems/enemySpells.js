// Enemy spellcasting data + assignment (S16, audit F15). Verbatim
// from DFU EnemyEntity.cs (MIT, Daggerfall Workshop): the per-monster
// classic spell lists, the class-enemy level table, and
// SetEnemySpells (MaxMagicka = 10 * level + 100 - "enemies don't
// follow same rule as player"; the six magic skills forced to 80;
// spells resolved from the standard SPELLS.STD list, missing records
// skipped loudly). Cast sound ids from EntityEffectManager (the
// element-indexed constants).

import { SKILLS, MAGIC_SKILLS } from './skills.js';

// EnemyEntity.cs static spell lists - classic SPELLS.STD record
// indices, byte-for-byte.
const IMP_SPELLS = Object.freeze([0x07, 0x0A, 0x1D, 0x2C]);
const GHOST_SPELLS = Object.freeze([0x22]);
const ORC_SHAMAN_SPELLS = Object.freeze([0x06, 0x07, 0x16, 0x19, 0x1F]);
const WRAITH_SPELLS = Object.freeze([0x1C, 0x1F]);
const FROST_DAEDRA_SPELLS = Object.freeze([0x10, 0x14]);
const FIRE_DAEDRA_SPELLS = Object.freeze([0x0E, 0x19]);
const DAEDROTH_SPELLS = Object.freeze([0x16, 0x17, 0x1F]);
const VAMPIRE_SPELLS = Object.freeze([0x33]);
const SEDUCER_SPELLS = Object.freeze([0x34, 0x43]);
const VAMPIRE_ANCIENT_SPELLS = Object.freeze([0x08, 0x32]);
const DAEDRA_LORD_SPELLS = Object.freeze([0x08, 0x0A, 0x0E, 0x3C, 0x43]);
const LICH_SPELLS = Object.freeze([0x08, 0x0A, 0x0E, 0x22, 0x3C]);
const ANCIENT_LICH_SPELLS = Object.freeze([0x08, 0x0A, 0x0E, 0x1D, 0x1F, 0x22, 0x3C]);

/** MonsterCareers id -> spell list (SetEnemyCareer's assignment
 *  chain, all thirteen casters). */
export const MONSTER_SPELL_LISTS = Object.freeze({
  1: IMP_SPELLS,              // Imp
  18: GHOST_SPELLS,           // Ghost
  21: ORC_SHAMAN_SPELLS,      // OrcShaman
  23: WRAITH_SPELLS,          // Wraith
  25: FROST_DAEDRA_SPELLS,    // FrostDaedra
  26: FIRE_DAEDRA_SPELLS,     // FireDaedra
  27: DAEDROTH_SPELLS,        // Daedroth
  28: VAMPIRE_SPELLS,         // Vampire
  29: SEDUCER_SPELLS,         // DaedraSeducer
  30: VAMPIRE_ANCIENT_SPELLS, // VampireAncient
  31: DAEDRA_LORD_SPELLS,     // DaedraLord
  32: LICH_SPELLS,            // Lich
  33: ANCIENT_LICH_SPELLS,    // AncientLich
});

/** EnemyClassSpells - indexed by min(6, level / 3), verbatim order. */
export const ENEMY_CLASS_SPELLS = Object.freeze([
  FROST_DAEDRA_SPELLS, DAEDROTH_SPELLS, ORC_SHAMAN_SPELLS,
  VAMPIRE_ANCIENT_SPELLS, DAEDRA_LORD_SPELLS, LICH_SPELLS,
  ANCIENT_LICH_SPELLS,
]);

export const ENEMY_MAGIC_SKILL = 80;
// the six schools live in skills.js (ONE DFU MEMBER, ONE EXPORT)

/** EntityEffectManager cast sounds, element-indexed (our classic
 *  order fire/cold/poison/shock/magic): fire 352, cold 353,
 *  poison 350, shock 351, magic 349.
 *
 *  AUDIT 58: these are DAGGER.SND record IDs, not record indices.
 *  EntityEffectManager.cs:44-48 names every one of them `...SoundID`,
 *  and PlayCastSound (:1948-1961) spends them through
 *  `audioSource.PlayOneShot((uint)castSoundID)` - the UINT overload
 *  (DaggerfallAudioSource.cs:232-238), which resolves the id through
 *  SoundReader.GetSoundIndex first. Every consumer must therefore go
 *  through audio.playOneShotId / audio.play3dId, never the raw index
 *  entry points; spent as indices these five ring StormLightningThunder
 *  and SwingMediumPitch2 instead of the cast. */
export const SPELL_CAST_SOUND = Object.freeze([352, 353, 350, 351, 349]);

/** EnemyEntity.SetEnemySpells, verbatim. */
export function setEnemySpells(entity, spellList, spellsByIndex) {
  entity.maxMagicka = 10 * entity.level + 100;
  entity.magicka = entity.maxMagicka;
  // SetPermanentSkillValue x6: pins over the flat career fill (the
  // skillValue override shape - the base number stays level-derived)
  entity.skillOverrides = { ...(entity.skillOverrides ?? {}) };
  for (const id of MAGIC_SKILLS) entity.skillOverrides[id] = ENEMY_MAGIC_SKILL;
  entity.spells = [];
  for (const idx of spellList) {
    const sp = spellsByIndex?.get(idx);
    if (!sp) {
      console.error(`[enemySpells] classic spell ${idx} missing from the standard list`);
      continue;
    }
    entity.spells.push(sp);
  }
}

/** The SetEnemyCareer spell-assignment tail: monsters take their
 *  per-career list; class enemies with CastsMagic take
 *  EnemyClassSpells[min(6, level / 3)] (C# int division). */
export function assignEnemySpells(entity, spellsByIndex) {
  if (!spellsByIndex) return;
  if (!entity.isClass) {
    const list = MONSTER_SPELL_LISTS[entity.careerIndex];
    if (list) setEnemySpells(entity, list, spellsByIndex);
  } else if (entity.basics?.castsMagic) {
    let spellListLevel = Math.trunc(entity.level / 3);
    if (spellListLevel > 6) spellListLevel = 6;
    setEnemySpells(entity, ENEMY_CLASS_SPELLS[spellListLevel], spellsByIndex);
  }
}
