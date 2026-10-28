// @ts-check
// PROVINCE-FOLK (2026-10-28, bible/03-World/World-Wide.md PROVINCE-FOLK; the owner: "The world of tamriel needs to have
// their accurate races present within their respective regions"): WHO LIVES IN A PROVINCE PAST THE BAY. Each
// province's people by the lore - its own race most of all, then the neighbours, traders and garrisons it is known to
// hold. A walker, a resident, a keeper and a foe past the Bay is one of them; the Bay keeps DFU's own law (no folk here).
// Not a DFU member: DFU's people stop at the Bay, and its townsfolk are one race a climate.
import { theatreOfArea, THEATRE_KEYS } from '../world/worldWide/worldGrid.js';
import { theatreOfRegion } from '../formats/mapsTables.js';
import { getNameBank, BANK_TYPES } from './nameHelper.js';

/** @typedef {ReadonlyArray<readonly [string, number]>} Folk - [race, weight], the province's own race first */
/** @param {Array<[string, number]>} rows @returns {Folk} */
const folk = (rows) => Object.freeze(rows.map((r) => Object.freeze(r)));

/** Each province's people by its key (world/worldWide/worldGrid.js THEATRE_KEYS), the weights out of 100. No Orcs: DFU's
 *  name banks hold none for them (Daggerfall's orcs stand as foes - Morrowind-NPCs.md MWNPC12). */
export const PROVINCE_FOLK = Object.freeze({
  HighRock: folk([['Breton', 82], ['Redguard', 5], ['Nord', 4], ['Imperial', 4], ['HighElf', 3], ['WoodElf', 2]]),   // the Direnni's Altmer kin, the Skyrim border's Nords
  Hammerfell: folk([['Redguard', 82], ['Breton', 6], ['Imperial', 5], ['Khajiit', 3], ['Nord', 2], ['DarkElf', 2]]),   // the Alik'r caravans' Khajiit, Colovia's Imperials
  Skyrim: folk([['Nord', 84], ['Imperial', 5], ['Breton', 4], ['DarkElf', 4], ['Khajiit', 2], ['Redguard', 1]]),   // the Reach's Bretons, the east's Dark Elves, the caravans
  Morrowind: folk([['DarkElf', 82], ['Imperial', 6], ['Argonian', 4], ['Nord', 3], ['Breton', 3], ['Khajiit', 2]]),   // the Legion and the East Empire Company, the Great Houses' bonded
  Sumurset: folk([['HighElf', 92], ['WoodElf', 4], ['Imperial', 3], ['Breton', 1]]),   // the isles keep to their own
  Valenwood: folk([['WoodElf', 82], ['HighElf', 6], ['Khajiit', 5], ['Imperial', 5], ['Breton', 2]]),   // Elsweyr's border, Sumurset's reach, the Empire's ports
  Elsweyr: folk([['Khajiit', 84], ['WoodElf', 6], ['Imperial', 5], ['Argonian', 3], ['Redguard', 2]]),   // the Bosmer of the border woods, Senchal's traders
  BlackMarsh: folk([['Argonian', 84], ['Imperial', 7], ['DarkElf', 5], ['Khajiit', 2], ['Breton', 2]]),   // Gideon's and Stormhold's Imperials, Morrowind's border
  Imperial: folk([['Imperial', 64], ['Breton', 6], ['Nord', 6], ['Redguard', 6], ['DarkElf', 4], ['WoodElf', 4], ['Khajiit', 4], ['HighElf', 3], ['Argonian', 3]]),   // the Empire's heart, every people in it
});

/** The people of theatre `t` (1..9 - the provinces past the Bay), or null: the Bay's theatre, the sea, none. @param {number} t */
export const folkOfTheatre = (t) => (Number.isInteger(t) && t > 0 ? PROVINCE_FOLK[/** @type {'Skyrim'} */ (THEATRE_KEYS[t])] ?? null : null);
/** The people of a region (formats/mapsTables.js - a province's 62..70), or null on the Bay. @param {number} r */
export const folkOfRegion = (r) => folkOfTheatre(theatreOfRegion(r));
/** The people of an area (worldGrid.js - a province's district past the Bay), or null on the Bay. @param {number} a */
export const folkOfArea = (a) => folkOfTheatre(theatreOfArea(a));

function mix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** One of `people` by a whole-number seed, by their weights; null for no people. The seed is mixed here, so two
 *  neighbouring seeds draw two people. @param {Folk|null} people @param {number} seed @returns {string|null} */
export function folkRace(people, seed) {
  if (!people?.length) return null;
  const total = people.reduce((n, [, w]) => n + w, 0);
  let r = mix((seed >>> 0) ^ 0x70f01c) % total;
  for (const [race, w] of people) { if (r < w) return race; r -= w; }
  return people[0][0];
}
/** The name bank of a person of `race`: their own people's - an Imperial's the Imperial bank, an Argonian's the Imperial
 *  too (NameHelper.GetNameBank's own law). @param {string} race */
export const folkNameBank = (race) => (race === 'Imperial' ? BANK_TYPES.Imperial : getNameBank(race));

/** The region the player stands in, as the world host answers it (scenes/world.js _questRegionIndex - PlayerGPS's);
 *  null where no host set one (the fixed city's bench, the Bay's standalone pages, a test). */
let _placeRegion = /** @type {(() => number) | null} */ (null);
/** The world host's door: who stands where the player is. @param {(() => number) | null} regionOf */
export function setFolkPlace(regionOf) { _placeRegion = typeof regionOf === 'function' ? regionOf : null; }
/** The people where the player stands, or null on the Bay (and with no host). A foe and a standing person read it. */
export const folkHere = () => (_placeRegion ? folkOfRegion(_placeRegion()) : null);
/** The theatre's own people's race where the player stands (Cyrodiil's Imperial), or null on the Bay. */
export const nativeHere = () => folkHere()?.[0][0] ?? null;
