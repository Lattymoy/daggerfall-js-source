// @ts-check
// STAR2 (2026-10-20): THE COVENS WHOSE RITE PULLS THE STARS DOWN - one a night, by a shuffle bag. Design:
// bible/11-Multiplayer/Starfall.md section 2.
//
// The Bay's covens are the game's own (canon): fourteen coven locations in MAPS.BSA, each the home of a FACTION.TXT
// witches' coven (type 8). Thirteen work Mephala's rite here. The Glenmoril Witches serve Hircine alone (DFU,
// systems/daedraSummoning.js: "THE GLENMORIL WITCHES always summon HIRCINE") and stand against it in the questline. The
// Daughters of Wroth were kept apart while the open zone was the Wrothgarian Mountains, where no world event runs; WW-C2
// (bible/03-World/World-Wide.md WW-C) moved the zone to Cyrodiil, and their coven works the rite again. FACTION.TXT's
// `region:` field for a coven does not name the MAPS.BSA region it stands in, so each pair is written here by name and
// held against the player's data by test/systems/starfall/star2_covens.test.js (ARENA2-gated).
//
// A coven's names are the game's (its location's and its faction's), shown through the text core's own lookups; what a
// member is called is the port's own, through t(). Not a DFU member. Ledger A (STARFALL).
import { gateHash } from '../../net/gate/gateLaw.js';
import { STAR_SALT } from '../../net/starfall/starfallLaw.js';
import { t, getLocalizedFactionName } from '../textManager.js';
import { regionOfTheatre } from '../../formats/mapsTables.js'; // WW5: a province's coven is its province's region's

/**
 * @typedef {{ id: string, region: number, location: string, place: string|null, factionId: number, witches: string,
 *   member: () => string }} StarCoven
 *   region the MAPS.BSA region index; location its coven's MAPS.BSA name (covenLocation); place the quest table's
 *   permanent name for it (vendor/dfu-quests/Tables/Quests-Places.txt - null where the table has none); factionId and
 *   witches its FACTION.TXT record (covenFactionName); member what one of its witches is called
 */
/** @param {StarCoven} c @returns {Readonly<StarCoven>} */
const coven = (c) => Object.freeze(c);
/**
 * @typedef {StarCoven & { theatre: number, own: true, name: () => string, leader: () => string }} StarProvinceCoven
 *   WW5: a coven of the port's own past the Bay - FACTION.TXT has none there (its witches are the Bay's), so it carries no
 *   faction (`factionId` null: no number of FACTION.TXT's, nor one it could ever grow to name, is a province coven's) and
 *   no MAPS.BSA location (`location`, `place` null); its words are its own through t() - its witches' name, what one of
 *   them is called, and its LEADER, who comes for the star as its master where a Bay coven's Coven Mother does
 *   (systems/starfall/starCoven.js starMasterOf). `theatre` the province (world/worldWide/worldGrid.js THEATRE_KEYS),
 *   `region` its WW-R region.
 */

/** The thirteen, in MAPS.BSA's region order (the bag's order is its own) - WW-C2: the Daughters of Wroth back among them. */
export const STAR_COVENS = Object.freeze([
  coven({
    id: 'marsh',
    region: 0,
    location: 'Coven_in_the_Marsh',
    place: 'Coven_in_the_Marsh',
    factionId: 426,
    witches: 'The_Witches_of_the_Marsh',
    member: () => t('starfall.member.marsh', 'Witch of the Marsh'),
  }),
  coven({
    id: 'devilrock',
    region: 1,
    location: 'Devilrock_Coven',
    place: 'DevilRockCoven',
    factionId: 421,
    witches: 'The_Witches_of_Devilrock',
    member: () => t('starfall.member.devilrock', 'Witch of Devilrock'),
  }),
  coven({
    id: 'peaks',
    region: 1,
    location: 'Coven_of_the_Peaks',
    place: 'Coven_of_the_Peaks',
    factionId: 427,
    witches: 'The_Mountain_Witches',
    member: () => t('starfall.member.peaks', 'Mountain Witch'),
  }),
  coven({
    id: 'kykos',
    region: 11,
    location: 'Kykos_Coven',
    place: 'KykosCoven',
    factionId: 430,
    witches: 'The_Sisters_of_Kykos',
    member: () => t('starfall.member.kykos', 'Sister of Kykos'),
  }),
  coven({
    id: 'wroth',
    region: 16,
    location: 'Wroth_Coven',
    place: 'WrothCoven',
    factionId: 424,
    witches: 'The_Daughters_of_Wroth',
    member: () => t('starfall.member.wroth', 'Daughter of Wroth'),
  }),
  coven({
    id: 'bluff',
    region: 17,
    location: 'Coven_on_the_Bluff',
    place: 'BluffCoven',
    factionId: 423,
    witches: 'The_Sisters_of_the_Bluff',
    member: () => t('starfall.member.bluff', 'Sister of the Bluff'),
  }),
  coven({
    id: 'tamarilyn',
    region: 33,
    location: 'Tamarilyn_Coven',
    place: 'TamarilynCoven',
    factionId: 422,
    witches: 'The_Tamarilyn_Witches',
    member: () => t('starfall.member.tamarilyn', 'Tamarilyn Witch'),
  }),
  coven({
    id: 'alcaire',
    region: 34,
    location: 'Alcaire_Coven',
    place: 'AlcaireCoven',
    factionId: 432,
    witches: 'The_Witches_of_Alcaire',
    member: () => t('starfall.member.alcaire', 'Witch of Alcaire'),
  }),
  coven({
    id: 'skeffington',
    region: 38,
    location: 'Skeffington_Coven',
    place: 'SkeffingtonCoven',
    factionId: 425,
    witches: 'The_Skeffington_Witches',
    member: () => t('starfall.member.skeffington', 'Skeffington Witch'),
  }),
  coven({
    id: 'beldama',
    region: 41,
    location: 'Beldama_Coven',
    place: 'BeldamaCoven',
    factionId: 429,
    witches: 'The_Beldama',
    member: () => t('starfall.member.beldama', 'Beldam'),
  }),
  coven({
    id: 'daggerfall',
    region: 42,
    location: 'Daggerfall_Coven',
    place: null,
    factionId: 428,
    witches: 'The_Daggerfall_Witches',
    member: () => t('starfall.member.daggerfall', 'Daggerfall Witch'),
  }),
  coven({
    id: 'tide',
    region: 46,
    location: 'Coven_of_the_Tide',
    place: 'MyrkwasaCoven',
    factionId: 431,
    witches: 'The_Tide_Witches',
    member: () => t('starfall.member.tide', 'Tide Witch'),
  }),
  coven({
    id: 'dust',
    region: 55,
    location: 'Coven_of_Dust',
    place: 'Coven_of_Dust',
    factionId: 420,
    witches: 'The_Dust_Witches',
    member: () => t('starfall.member.dust', 'Dust Witch'),
  }),
]);
/**
 * WW5 (bible/03-World/World-Wide.md WW5; Starfall.md section 2, WW5): THE PROVINCES' COVENS - the port's own, one a
 * province theatre that stands a coven night (net/wire.js SITE_EVENT_LANES: Cyrodiil's open zone none), each named in its
 * province's own lore and worshipping as the rite does, Mephala: the Moor's Breton hedge-witches; the Sand Witches of the
 * Alik'r's far side; the Witches of the Rime, Skyrim's; the Ash Witches under the Dunmer's wise-woman's title; the
 * Sisters of Dusk on Sumurset; the Briar Witches, who keep the Green Pact's wood and break it for her; the Daughters of
 * Mafala - the Khajiit's own name for Mephala, the Clan Mother; the Fen Witches of Black Marsh. A coven's words are the
 * text core's (`starfall.coven.<id>`, `starfall.member.<id>`, `starfall.leader.<id>`); its leader comes for the star.
 * In the provinces' order (theatre 1..8). Not DFU's (FACTION.TXT's covens are the Bay's alone). Ledger A (WW5).
 */
/** @param {Omit<StarProvinceCoven, 'region'|'location'|'place'|'factionId'|'own'>} c @returns {Readonly<StarProvinceCoven>} */
const provinceCoven = (c) =>
  Object.freeze({
    ...c,
    region: regionOfTheatre(c.theatre),
    location: null,
    place: null,
    factionId: null,
    own: /** @type {true} */ (true),
  });
export const STAR_PROVINCE_COVENS = Object.freeze([
  provinceCoven({
    id: 'moor',
    theatre: 1,
    witches: 'The_Sisters_of_the_Moor',
    name: () => t('starfall.coven.moor', 'The Sisters of the Moor'),
    member: () => t('starfall.member.moor', 'Sister of the Moor'),
    leader: () => t('starfall.leader.moor', 'Mother Gwenllian'),
  }),
  provinceCoven({
    id: 'sand',
    theatre: 2,
    witches: 'The_Sand_Witches',
    name: () => t('starfall.coven.sand', 'The Sand Witches'),
    member: () => t('starfall.member.sand', 'Sand Witch'),
    leader: () => t('starfall.leader.sand', 'Mother Adara'),
  }),
  provinceCoven({
    id: 'rime',
    theatre: 3,
    witches: 'The_Witches_of_the_Rime',
    name: () => t('starfall.coven.rime', 'The Witches of the Rime'),
    member: () => t('starfall.member.rime', 'Witch of the Rime'),
    leader: () => t('starfall.leader.rime', 'Mother Hjordis'),
  }),
  provinceCoven({
    id: 'ash',
    theatre: 4,
    witches: 'The_Ash_Witches',
    name: () => t('starfall.coven.ash', 'The Ash Witches'),
    member: () => t('starfall.member.ash', 'Ash Witch'),
    leader: () => t('starfall.leader.ash', 'Wise Woman Ulyne'),
  }),
  provinceCoven({
    id: 'dusk',
    theatre: 5,
    witches: 'The_Sisters_of_Dusk',
    name: () => t('starfall.coven.dusk', 'The Sisters of Dusk'),
    member: () => t('starfall.member.dusk', 'Sister of Dusk'),
    leader: () => t('starfall.leader.dusk', 'Mother Calanwe'),
  }),
  provinceCoven({
    id: 'briar',
    theatre: 6,
    witches: 'The_Briar_Witches',
    name: () => t('starfall.coven.briar', 'The Briar Witches'),
    member: () => t('starfall.member.briar', 'Briar Witch'),
    leader: () => t('starfall.leader.briar', 'Mother Thaewen'),
  }),
  provinceCoven({
    id: 'mafala',
    theatre: 7,
    witches: 'The_Daughters_of_Mafala',
    name: () => t('starfall.coven.mafala', 'The Daughters of Mafala'),
    member: () => t('starfall.member.mafala', 'Daughter of Mafala'),
    leader: () => t('starfall.leader.mafala', "Clan Mother Ri'shazra"),
  }),
  provinceCoven({
    id: 'fen',
    theatre: 8,
    witches: 'The_Fen_Witches',
    name: () => t('starfall.coven.fen', 'The Fen Witches'),
    member: () => t('starfall.member.fen', 'Fen Witch'),
    leader: () => t('starfall.leader.fen', 'Mother Neeta-Hei'),
  }),
]);
/** WW5: the covens whose rite a theatre's night is - the Bay's thirteen on lane 0, a province's own past it, none on a
 *  lane that stands no coven night (Cyrodiil's). @param {number} lane @returns {readonly Readonly<StarCoven>[]} */
export const covensOfLane = (lane) =>
  lane === 0 ? STAR_COVENS : STAR_PROVINCE_COVENS.filter((c) => c.theatre === lane);
/** The one left out, and why (section 2): Hircine's own. */
export const STAR_COVENS_APART = Object.freeze([
  Object.freeze({
    id: 'glenmoril',
    region: 60,
    location: 'Glenmoril_Coven',
    place: 'GlenmorilCoven',
    factionId: 419,
    witches: 'The_Glenmoril_Witches',
  }),
]);

/** A coven's names as the game spells them: written here in the quest tables' own form (Quests-Places.txt,
 *  Quests-Factions.txt - a name's spaces as underscores), the form a table's English keeps out of the text core's count. */
const spoken = (name) => name.replace(/_/g, ' ');
/** The coven's MAPS.BSA location name, as the map file has it. */
export const covenLocation = (c) => spoken(c.location);
/** The witches' FACTION.TXT name, as the file has it. */
export const covenFactionName = (c) => spoken(c.witches);
/** The witches' name as the player's language has it (the faction's own record, canon) - WW5: a province coven's its own
 *  words (it has no faction). */
export const covenWitches = (c) => (c.own ? c.name() : getLocalizedFactionName(c.factionId, covenFactionName(c)));

/** One round of the bag: the thirteen shuffled by the round's own rolls (the gate's bag, net/gate/gateLaw.js bagRound). */
function bagRound(round, n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = gateHash(STAR_SALT, round, 11, i) % (i + 1);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}
/**
 * THE NIGHT'S COVEN: a shuffle bag over the twelve (the gate's region bag's law) - every coven takes a night, in an order
 * each round of thirteen shuffles, before any takes a second, and a round never opens on the coven the last one closed on.
 * Pure: every client names the same coven for a night with no word sent. WW5: a theatre's night is its own covens' bag
 * (covensOfLane - a province's one coven every night it has), the Bay's the thirteen's it always was; null on a lane with
 * no coven.
 * @param {number} n the night (net/starfall/starfallLaw.js starNightAt)
 * @param {number} [lane] the theatre (net/starfall/starfallLaw.js starLaneOf)
 * @returns {Readonly<StarCoven>|null}
 */
export function starCovenOf(n, lane = 0) {
  const covens = covensOfLane(lane),
    len = covens.length;
  if (!len) return null;
  if (len === 1) return covens[0]; // a province's one coven every night (a bag of one has no second to swap in)
  const round = Math.floor(n / len),
    at = n - round * len;
  const bag = bagRound(round, len);
  if (bag[0] === bagRound(round - 1, len)[len - 1]) {
    const tmp = bag[0];
    bag[0] = bag[1];
    bag[1] = tmp;
  }
  return covens[bag[at]];
}
