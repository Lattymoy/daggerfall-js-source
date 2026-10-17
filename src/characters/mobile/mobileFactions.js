// MOBILE FACTIONS - grouping classification, NOT part of DFU/classic.
//
// campEncounters.js's problem: a camp/pack draws each of its 3-5
// members from chooseRandomEnemy() independently, so nothing stops
// three different tiers of monster - or three copies of something
// that was only ever meant to appear alone (a Dragonling, a Daedra
// Lord, an Atronach) - from landing in the same "group". Classic
// Daggerfall never had this problem because it never spawned groups
// at all; this table is this port's own answer for the group system
// we added on top.
//
// Two things live here:
//  - SOLITARY_TYPES: ids that never seed AND never join a camp/pack,
//    because in the base game's own encounter tables they read as a
//    rare, singular "uh oh" spawn (bosses, Daedra, Atronachs, the
//    dragon ids), not a squad member. If one of these is the FIRST
//    roll for a group, campEncounters.js re-rolls or gives up rather
//    than forcing it into a group.
//  - FACTION_OF: everything else, bucketed into the kind of group it
//    plausibly belongs to (human outlaws/"bandits", orcs, vermin,
//    animal packs, undead, fae/wild-folk, aquatic). A group's OTHER
//    members are drawn only from the SAME bucket, filtered through
//    the SAME climate/day-night table chooseRandomEnemy would have
//    used anyway - so climate is never violated, only which of that
//    climate's residents get to stand together.
//
// Anything not listed in either map (id not present) is treated as
// solitary by default - the safe fallback for anything added later.
import { MOBILE_TYPES } from './mobileTypes.js';

export const SOLITARY_TYPES = new Set([
  MOBILE_TYPES.Imp,
  MOBILE_TYPES.Spriggan,
  MOBILE_TYPES.Nymph,
  MOBILE_TYPES.Giant,
  MOBILE_TYPES.Mummy,
  MOBILE_TYPES.FrostDaedra,
  MOBILE_TYPES.FireDaedra,
  MOBILE_TYPES.Daedroth,
  MOBILE_TYPES.DaedraSeducer,
  MOBILE_TYPES.VampireAncient,
  MOBILE_TYPES.DaedraLord,
  MOBILE_TYPES.Lich,
  MOBILE_TYPES.AncientLich,
  MOBILE_TYPES.Dragonling,
  MOBILE_TYPES.FireAtronach,
  MOBILE_TYPES.IronAtronach,
  MOBILE_TYPES.FleshAtronach,
  MOBILE_TYPES.IceAtronach,
  MOBILE_TYPES.Dragonling_Alternate,
  MOBILE_TYPES.Dreugh,
  MOBILE_TYPES.Lamia,
]);

export const FACTIONS = Object.freeze({
  // The "bandit camp" feel: every human class id except the city
  // watch (that one's reserved for guard spawning, never wilderness).
  BANDIT: [
    MOBILE_TYPES.Mage, MOBILE_TYPES.Spellsword, MOBILE_TYPES.Battlemage,
    MOBILE_TYPES.Sorcerer, MOBILE_TYPES.Healer, MOBILE_TYPES.Nightblade,
    MOBILE_TYPES.Bard, MOBILE_TYPES.Burglar, MOBILE_TYPES.Rogue,
    MOBILE_TYPES.Acrobat, MOBILE_TYPES.Thief, MOBILE_TYPES.Assassin,
    MOBILE_TYPES.Monk, MOBILE_TYPES.Archer, MOBILE_TYPES.Ranger,
    MOBILE_TYPES.Barbarian, MOBILE_TYPES.Warrior, MOBILE_TYPES.Knight,
  ],
  ORC: [MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcShaman, MOBILE_TYPES.OrcWarlord],
  VERMIN: [MOBILE_TYPES.Spider, MOBILE_TYPES.GiantScorpion, MOBILE_TYPES.GiantBat],
  // Plain animals - fine to group day or night, same as classic lets
  // them appear either.
  BEASTPACK: [MOBILE_TYPES.Rat, MOBILE_TYPES.GrizzlyBear, MOBILE_TYPES.SabertoothTiger],
  // Lycanthropes: the climate tables are baked from DFU and carry a
  // handful of DAY-table entries for these anyway (Wereboar in a few
  // climates' day lists, one Vampire in Mountain's day list) - table
  // quirks, not lore. NIGHT_ONLY_FACTIONS below overrides those few
  // exceptions so a werewolf/wereboar pack only ever forms after dark.
  WEREBEAST: [MOBILE_TYPES.Werewolf, MOBILE_TYPES.Wereboar],
  UNDEAD: [MOBILE_TYPES.SkeletalWarrior, MOBILE_TYPES.Zombie, MOBILE_TYPES.Ghost, MOBILE_TYPES.Wraith, MOBILE_TYPES.Vampire],
  FAE: [MOBILE_TYPES.Centaur, MOBILE_TYPES.Harpy, MOBILE_TYPES.Gargoyle],
  AQUATIC: [MOBILE_TYPES.Slaughterfish],
});

// Factions that should only ever seed/fill a group at night, even on
// the rare climate table that technically lists one of their members
// in the day slot too (see WEREBEAST's note above). A group of
// zombies or werewolves standing around in broad daylight reads as a
// data quirk, not a monster you'd actually meet that way.
export const NIGHT_ONLY_FACTIONS = new Set(['UNDEAD', 'WEREBEAST']);

const FACTION_OF = new Map();
for (const [name, ids] of Object.entries(FACTIONS)) {
  for (const id of ids) FACTION_OF.set(id, name);
}

/** The faction key for `id`, or null if it's solitary/unclassified -
 *  either way, null means "don't use this to build a group theme". */
export function factionOf(id) {
  if (SOLITARY_TYPES.has(id)) return null;
  return FACTION_OF.get(id) ?? null;
}
