// @ts-check
// MWNPC9 (2026-10-09, the MW-NPC arc's ninth slice - bible/04-Characters/Morrowind-NPCs.md section 14b): DAGGERFALL'S
// CREATURES, MATCHED TO MORROWIND'S. Every creature mobile (characters/mobileTypes.js, 0-42) is either matched to the
// Morrowind creature that stands for it - an ordered list of CREA ids, the first the attached masters carry building
// its body (combat/fpArm.js buildCreatureBody) - or a DECLARED MISS with its reason, keeping its Daggerfall sprite. The
// ids are the records' own, read off UESP's creature tables (2026-10-09), never recalled: Morrowind.esm's, Tribunal's
// (lich) and Bloodmoon's (BM_spriggan, BM_bear_black, bm_frost_giant, draugr); a master that lacks one refuses the
// build and the sprite stands, as for any refused body.
import { MOBILE_TYPES as M } from './mobileTypes.js';

/** The match: mobile type -> `{ creature: [CREA ids, first carried wins] }` or `{ miss: reason }`. Every creature
 *  mobile is named - the table is the census.
 *  @type {Readonly<Record<number, { creature?: string[], miss?: string }>>} */
export const CREATURE_MATCH = Object.freeze({
  [M.Rat]: { creature: ['rat'] },
  [M.Imp]: { creature: ['scamp'] },                       // the small winged daedra of the Bay is Morrowind's scamp
  [M.Spriggan]: { creature: ['bm_spriggan'] },
  [M.GiantBat]: { miss: 'no bat walks Morrowind' },
  [M.GrizzlyBear]: { creature: ['bm_bear_black'] },        // Bloodmoon's grizzly
  [M.SabertoothTiger]: { miss: 'no great cat' },
  [M.Spider]: { miss: 'no giant spider (the centurion spider is a Dwemer machine)' },
  [M.Orc]: { miss: 'an orc is a person - Morrowind\'s Orc (MWNPC12, foeBodies.js isPersonFoe), never a creature' },
  [M.Centaur]: { miss: 'no centaur' },
  [M.Werewolf]: { miss: 'the werewolf is the player\'s wolf (WEREWOLF1), not yet a foe\'s body' },
  [M.Nymph]: { miss: 'no nymph' },
  [M.Slaughterfish]: { miss: 'a water creature - the swimming groups are not driven yet' },
  [M.OrcSergeant]: { miss: 'an orc is a person' },
  [M.Harpy]: { miss: 'no harpy' },
  [M.Wereboar]: { miss: 'no wereboar' },
  [M.SkeletalWarrior]: { creature: ['skeleton warrior', 'skeleton'] },
  [M.Giant]: { creature: ['bm_frost_giant'] },             // Bloodmoon's frost giant
  [M.Zombie]: { creature: ['bonewalker'] },
  [M.Ghost]: { miss: 'a ghost is translucent - a body\'s textures are alpha-tested, never blended' },
  [M.Mummy]: { creature: ['draugr'] },                     // Bloodmoon's draugr, the barrows' wrapped dead
  [M.GiantScorpion]: { miss: 'no giant scorpion' },
  [M.OrcShaman]: { miss: 'an orc is a person' },
  [M.Gargoyle]: { miss: 'no gargoyle' },
  [M.Wraith]: { miss: 'a wraith is translucent, as a ghost is' },
  [M.OrcWarlord]: { miss: 'an orc is a person' },
  [M.FrostDaedra]: { creature: ['atronach_frost'] },
  [M.FireDaedra]: { creature: ['atronach_flame'] },
  [M.Daedroth]: { creature: ['daedroth'] },
  [M.Vampire]: { miss: 'a vampire is a person (Morrowind\'s are NPCs)' },
  [M.DaedraSeducer]: { creature: ['winged twilight'] },
  [M.VampireAncient]: { miss: 'a vampire is a person' },
  [M.DaedraLord]: { creature: ['dremora_lord'] },
  [M.Lich]: { creature: ['lich'] },                        // Tribunal's
  [M.AncientLich]: { creature: ['lich'] },
  [M.Dragonling]: { miss: 'no dragon' },
  [M.FireAtronach]: { creature: ['atronach_flame'] },
  [M.IronAtronach]: { creature: ['atronach_storm'] },      // the stone atronach for the iron one
  [M.FleshAtronach]: { miss: 'no flesh atronach' },
  [M.IceAtronach]: { creature: ['atronach_frost'] },
  [M.Horse_Invalid]: { miss: 'not a foe' },
  [M.Dragonling_Alternate]: { miss: 'no dragon' },
  [M.Dreugh]: { creature: ['dreugh'] },
  [M.Lamia]: { miss: 'no lamia' },
});

/** The looks, one frozen object a mobile type (a look is a body key - PeerBodies keys it `crea|<ids>`). */
const LOOKS = new Map(Object.entries(CREATURE_MATCH).filter(([, m]) => m.creature).map(([t, m]) => [Number(t), Object.freeze({ creature: Object.freeze([...m.creature]) })]));

/** The creature foe's look - `{ creature: [ids] }` - or null: a person (a class mobile, 128 and up, is in no row), or a
 *  creature Morrowind has no match for.
 *  @param {any} f a foe record (its `mobileType`) */
export function creatureLook(f) {
  return (f && LOOKS.get(f.mobileType)) ?? null;
}
