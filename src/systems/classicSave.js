// Classic-save character conversion (SAV1). 1:1 translation of the
// import half of DFU API/Save/CharacterRecord.cs (MIT, Daggerfall
// Workshop): ToCharacterDocument + StripTransformedRace - the bridge
// from a parsed SAVETREE.DAT character record (formats/
// characterRecord.js) to a chargen-shaped character document. It lives
// in systems because it needs the skill/race/clan enums; formats stays
// a leaf layer.
//
// FLAGGED: no consumer yet. The load-classic-game window
// (DaggerfallLoadClassicGameWindow) and the game-state import
// (SaveLoadManager's classic path) are the Ledger row's still-open
// half; when they land they consume this document. No host seam is
// wired by this slice - exterior.js, world.js, worldModes.js and
// dungeonContext.js are all untouched.

import { SKILLS } from './skills.js';
import { VAMPIRE_CLANS, LYCANTHROPY_TYPES } from './infection.js';
import { raceById } from './races.js';

/** EntityEnums.Races' transformed tail (races.js owns the selectable
 *  1-8 half; classic stores these three when the player is turned). */
export const TRANSFORMED_RACES = Object.freeze({
  None: -1,           // Races.None
  Vampire: 9, Werewolf: 10, Wereboar: 11,
});

// DFCareer.Stats order (the statMods charter): 0 Strength,
// 1 Intelligence, 2 Willpower, 3 Agility, 4 Endurance, 5 Personality,
// 6 Speed, 7 Luck.
const STAT = Object.freeze({
  Strength: 0, Intelligence: 1, Willpower: 2, Agility: 3,
  Endurance: 4, Personality: 5, Speed: 6, Luck: 7,
});

/**
 * CharacterRecord.StripTransformedRace. Restores the original race for
 * a vampire/werething and removes classic's baked stat and skill
 * bonuses - DFU re-applies them through the effect system instead.
 * MUTATES parsedData.currentStats and parsedData.skills, exactly as
 * the C# writes through its class references.
 * @param {object} parsedData - parseCharacterRecordData output.
 * @param {number} [stripLycanthropyType] - LYCANTHROPY_TYPES value to
 *   strip when the infection was read separately (a were-character
 *   whose racial transform is not active).
 * @returns {{liveRace: number, classicTransformedRace: number}}
 */
export function stripTransformedRace(parsedData, stripLycanthropyType = LYCANTHROPY_TYPES.None) {
  // "If player is not transformed then this will simply return race + 1"
  let liveRace = parsedData.race + 1;
  let classicTransformedRace = TRANSFORMED_RACES.None;
  if (liveRace === TRANSFORMED_RACES.Vampire ||
      liveRace === TRANSFORMED_RACES.Werewolf ||
      liveRace === TRANSFORMED_RACES.Wereboar) {
    classicTransformedRace = liveRace;
    liveRace = parsedData.race2 + 1;
  }

  const stats = parsedData.currentStats;
  const skills = parsedData.skills;

  // Remove vampire bonuses: +20 to every stat but Intelligence, which
  // only the Anthotis add (the vampirism.js law), and +30 to the six
  // vampire skills.
  if (classicTransformedRace === TRANSFORMED_RACES.Vampire) {
    stats[STAT.Strength] -= 20;
    stats[STAT.Willpower] -= 20;
    stats[STAT.Agility] -= 20;
    stats[STAT.Endurance] -= 20;
    stats[STAT.Personality] -= 20;
    stats[STAT.Speed] -= 20;
    stats[STAT.Luck] -= 20;
    if (parsedData.vampireClan === VAMPIRE_CLANS.Anthotis)
      stats[STAT.Intelligence] -= 20;

    skills[SKILLS.Jumping] -= 30;
    skills[SKILLS.Running] -= 30;
    skills[SKILLS.Stealth] -= 30;
    skills[SKILLS.CriticalStrike] -= 30;
    skills[SKILLS.Climbing] -= 30;
    skills[SKILLS.HandToHand] -= 30;
  }

  // Remove werewolf/wereboar bonuses: +40 to four stats, +30 to the
  // seven lycanthrope skills (the vampire six plus Swimming).
  if (classicTransformedRace === TRANSFORMED_RACES.Werewolf ||
      classicTransformedRace === TRANSFORMED_RACES.Wereboar ||
      stripLycanthropyType !== LYCANTHROPY_TYPES.None) {
    stats[STAT.Strength] -= 40;
    stats[STAT.Speed] -= 40;
    stats[STAT.Agility] -= 40;
    stats[STAT.Endurance] -= 40;

    skills[SKILLS.Swimming] -= 30;
    skills[SKILLS.Running] -= 30;
    skills[SKILLS.Stealth] -= 30;
    skills[SKILLS.CriticalStrike] -= 30;
    skills[SKILLS.Climbing] -= 30;
    skills[SKILLS.HandToHand] -= 30;
    skills[SKILLS.Jumping] -= 30;
  }

  return { liveRace, classicTransformedRace };
}

/**
 * CharacterRecord.ToCharacterDocument - the prototypical character
 * document for import, field-for-field. Two laws worth naming:
 * doc.maxHealth comes from parsedData.BASEhealth (the transformed
 * pseudo-race may have altered maxHealth), and the strip above runs
 * FIRST, so the stats and skills below are the restored ones.
 * @param {object} parsedData - parseCharacterRecordData output.
 * @param {number} [stripLycanthropyType]
 */
export function toCharacterDocument(parsedData, stripLycanthropyType = LYCANTHROPY_TYPES.None) {
  const { liveRace, classicTransformedRace } =
    stripTransformedRace(parsedData, stripLycanthropyType);

  return {
    raceTemplate: raceById(liveRace),
    gender: parsedData.gender,
    career: parsedData.career,
    name: parsedData.characterName,
    faceIndex: parsedData.faceIndex,
    workingStats: parsedData.currentStats,
    workingSkills: parsedData.skills,
    reflexes: parsedData.reflexes,
    currentHealth: parsedData.currentHealth,
    maxHealth: parsedData.baseHealth,
    currentSpellPoints: parsedData.currentSpellPoints,
    reputationCommoners: parsedData.reputationCommoners,
    reputationMerchants: parsedData.reputationMerchants,
    reputationNobility: parsedData.reputationNobility,
    reputationScholars: parsedData.reputationScholars,
    reputationUnderworld: parsedData.reputationUnderworld,
    currentFatigue: parsedData.currentFatigue,
    skillUses: parsedData.skillUses,
    skillsRaisedThisLevel1: parsedData.skillsRaisedThisLevel1,
    skillsRaisedThisLevel2: parsedData.skillsRaisedThisLevel2,
    startingLevelUpSkillSum: parsedData.startingLevelUpSkillSum,
    minMetalToHit: parsedData.minMetalToHit,
    armorValues: parsedData.armorValues,
    timeToBecomeVampireOrWerebeast: parsedData.timeToBecomeVampireOrWerebeast,
    hasStartedInitialVampireQuest: parsedData.hasStartedInitialVampireQuest,
    lastTimeVampireNeedToKillSatiated: parsedData.lastTimeVampireNeedToKillSatiated,
    lastTimePlayerAteOrDrankAtTavern: parsedData.lastTimePlayerAteOrDrankAtTavern,
    lastTimePlayerBoughtTraining: parsedData.lastTimePlayerBoughtTraining,
    timeForThievesGuildLetter: parsedData.timeForThievesGuildLetter,
    timeForDarkBrotherhoodLetter: parsedData.timeForDarkBrotherhoodLetter,
    vampireClan: parsedData.vampireClan,
    darkBrotherhoodRequirementTally: parsedData.darkBrotherhoodRequirementTally,
    thievesGuildRequirementTally: parsedData.thievesGuildRequirementTally,
    biographyReactionMod: parsedData.biographyReactionMod,
    classicTransformedRace,
  };
}
