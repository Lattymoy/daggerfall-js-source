// @ts-check
// STAR2 (2026-10-20): THE COVENS WHOSE RITE PULLS THE STARS DOWN - one a night, by a shuffle bag. Design:
// bible/11-Multiplayer/Starfall.md section 2.
//
// The Bay's covens are the game's own (canon): fourteen coven locations in MAPS.BSA, each the home of a FACTION.TXT
// witches' coven (type 8). Twelve work Mephala's rite here. The Glenmoril Witches serve Hircine alone (DFU,
// systems/daedraSummoning.js: "THE GLENMORIL WITCHES always summon HIRCINE") and stand against it in the questline; the
// Daughters of Wroth live in the open zone, where no world event runs (systems/wild/wildZone.js WILD_REGION). FACTION.TXT's
// `region:` field for a coven does not name the MAPS.BSA region it stands in, so each pair is written here by name and
// held against the player's data by test/systems/starfall/star2_covens.test.js (ARENA2-gated).
//
// A coven's names are the game's (its location's and its faction's), shown through the text core's own lookups; what a
// member is called is the port's own, through t(). Not a DFU member. Ledger A (STARFALL).
import { gateHash } from '../../net/gate/gateLaw.js';
import { STAR_SALT } from '../../net/starfall/starfallLaw.js';
import { t, getLocalizedFactionName } from '../textManager.js';

/**
 * @typedef {{ id: string, region: number, location: string, place: string|null, factionId: number, witches: string,
 *   member: () => string }} StarCoven
 *   region the MAPS.BSA region index; location its coven's MAPS.BSA name (covenLocation); place the quest table's
 *   permanent name for it (vendor/dfu-quests/Tables/Quests-Places.txt - null where the table has none); factionId and
 *   witches its FACTION.TXT record (covenFactionName); member what one of its witches is called
 */
/** @param {StarCoven} c @returns {Readonly<StarCoven>} */
const coven = (c) => Object.freeze(c);

/** The twelve, in MAPS.BSA's region order (the bag's order is its own). */
export const STAR_COVENS = Object.freeze([
  coven({ id: 'marsh', region: 0, location: 'Coven_in_the_Marsh', place: 'Coven_in_the_Marsh', factionId: 426, witches: 'The_Witches_of_the_Marsh', member: () => t('starfall.member.marsh', 'Witch of the Marsh') }),
  coven({ id: 'devilrock', region: 1, location: 'Devilrock_Coven', place: 'DevilRockCoven', factionId: 421, witches: 'The_Witches_of_Devilrock', member: () => t('starfall.member.devilrock', 'Witch of Devilrock') }),
  coven({ id: 'peaks', region: 1, location: 'Coven_of_the_Peaks', place: 'Coven_of_the_Peaks', factionId: 427, witches: 'The_Mountain_Witches', member: () => t('starfall.member.peaks', 'Mountain Witch') }),
  coven({ id: 'kykos', region: 11, location: 'Kykos_Coven', place: 'KykosCoven', factionId: 430, witches: 'The_Sisters_of_Kykos', member: () => t('starfall.member.kykos', 'Sister of Kykos') }),
  coven({ id: 'bluff', region: 17, location: 'Coven_on_the_Bluff', place: 'BluffCoven', factionId: 423, witches: 'The_Sisters_of_the_Bluff', member: () => t('starfall.member.bluff', 'Sister of the Bluff') }),
  coven({ id: 'tamarilyn', region: 33, location: 'Tamarilyn_Coven', place: 'TamarilynCoven', factionId: 422, witches: 'The_Tamarilyn_Witches', member: () => t('starfall.member.tamarilyn', 'Tamarilyn Witch') }),
  coven({ id: 'alcaire', region: 34, location: 'Alcaire_Coven', place: 'AlcaireCoven', factionId: 432, witches: 'The_Witches_of_Alcaire', member: () => t('starfall.member.alcaire', 'Witch of Alcaire') }),
  coven({ id: 'skeffington', region: 38, location: 'Skeffington_Coven', place: 'SkeffingtonCoven', factionId: 425, witches: 'The_Skeffington_Witches', member: () => t('starfall.member.skeffington', 'Skeffington Witch') }),
  coven({ id: 'beldama', region: 41, location: 'Beldama_Coven', place: 'BeldamaCoven', factionId: 429, witches: 'The_Beldama', member: () => t('starfall.member.beldama', 'Beldam') }),
  coven({ id: 'daggerfall', region: 42, location: 'Daggerfall_Coven', place: null, factionId: 428, witches: 'The_Daggerfall_Witches', member: () => t('starfall.member.daggerfall', 'Daggerfall Witch') }),
  coven({ id: 'tide', region: 46, location: 'Coven_of_the_Tide', place: 'MyrkwasaCoven', factionId: 431, witches: 'The_Tide_Witches', member: () => t('starfall.member.tide', 'Tide Witch') }),
  coven({ id: 'dust', region: 55, location: 'Coven_of_Dust', place: 'Coven_of_Dust', factionId: 420, witches: 'The_Dust_Witches', member: () => t('starfall.member.dust', 'Dust Witch') }),
]);
/** The two left out, and why (section 2): Hircine's own, and the open zone's. */
export const STAR_COVENS_APART = Object.freeze([
  Object.freeze({ id: 'glenmoril', region: 60, location: 'Glenmoril_Coven', place: 'GlenmorilCoven', factionId: 419, witches: 'The_Glenmoril_Witches' }),
  Object.freeze({ id: 'wroth', region: 16, location: 'Wroth_Coven', place: 'WrothCoven', factionId: 424, witches: 'The_Daughters_of_Wroth' }),
]);

/** A coven's names as the game spells them: written here in the quest tables' own form (Quests-Places.txt,
 *  Quests-Factions.txt - a name's spaces as underscores), the form a table's English keeps out of the text core's count. */
const spoken = (name) => name.replace(/_/g, ' ');
/** The coven's MAPS.BSA location name, as the map file has it. */
export const covenLocation = (c) => spoken(c.location);
/** The witches' FACTION.TXT name, as the file has it. */
export const covenFactionName = (c) => spoken(c.witches);
/** The witches' name as the player's language has it (the faction's own record, canon). */
export const covenWitches = (c) => getLocalizedFactionName(c.factionId, covenFactionName(c));

/** One round of the bag: the twelve shuffled by the round's own rolls (the gate's bag, net/gate/gateLaw.js bagRound). */
function bagRound(round, n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = gateHash(STAR_SALT, round, 11, i) % (i + 1);
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
/**
 * THE NIGHT'S COVEN: a shuffle bag over the twelve (the gate's region bag's law) - every coven takes a night, in an order
 * each round of twelve shuffles, before any takes a second, and a round never opens on the coven the last one closed on.
 * Pure: every client names the same coven for a night with no word sent.
 * @param {number} n the night (net/starfall/starfallLaw.js starNightAt)
 * @returns {Readonly<StarCoven>}
 */
export function starCovenOf(n) {
  const len = STAR_COVENS.length;
  const round = Math.floor(n / len), at = n - round * len;
  const bag = bagRound(round, len);
  if (bag[0] === bagRound(round - 1, len)[len - 1]) { const tmp = bag[0]; bag[0] = bag[1]; bag[1] = tmp; }
  return STAR_COVENS[bag[at]];
}
