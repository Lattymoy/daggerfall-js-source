// @ts-check
// REGION-NAMES (bible/04-Characters/Region-Names.md): THE GAME'S DOORS TO A PERSON'S NAME. Each draws DFU's own FullName
// first, exactly as DFU draws it, so DFRandom stands where DFU leaves it and every key read after it is DFU's; the person
// is then named by their culture's customs off that draw (characters/regionNames.js). A name that is a KEY - a static
// NPC's, a quest Person's, compared by the topic tree (TalkManager.cs:3159) - is named by its bank's culture alone, never
// its region: two readers of one seed hold only the bank in common.
import { fullName, GENDERS } from './nameHelper.js';
import { srand, getSeed, setSeed, randomRangeInclusive } from '../formats/dfRandom.js';
import { regionName, cultureOfRace, cultureOfBank, nameHash, mixSeed } from './regionNames.js';

/** @typedef {{ race?: string|null, region?: number, home?: string|null }} NamedWhere - `race` their people (else the
 *  bank's), `region` a region or an area number (-1: no region's families), `home` provinceFolk.js's key of the place */

/**
 * A person's name on DFU's stream as it stands: FullName(bank, gender) drawn, then the person named by their customs.
 * @param {number} bank @param {number} gender @param {NamedWhere} [where] @returns {string}
 */
export function personName(bank, gender, { race = null, region = -1, home = null } = {}) {
  const classic = fullName(bank, gender);
  const seed = mixSeed(getSeed(), nameHash(classic));
  return regionName({ culture: cultureOfRace(race) ?? cultureOfBank(bank), gender, seed, region, home, classic });
}

/** census.js residentName's frame - DFRandom seeded with the person's own seed and put back after - for a person of a
 *  place. @param {number} seed @param {number} bank @param {number} gender @param {NamedWhere} [where] */
export function seededPersonName(seed, bank, gender, where = {}) {
  const saved = getSeed();
  try {
    srand(seed >>> 0 || 1);
    return personName(bank, gender, where);
  } finally {
    setSeed(saved);
  }
}

/** MacroHelper.GetRandomFullName's draw (nameHelper.js getRandomFullNameOfBank): the gender's coin on DFRandom, then the
 *  person. @param {number} bank */
export function randomPersonName(bank) {
  const gender = randomRangeInclusive(0, 1) === 1 ? GENDERS.Female : GENDERS.Male;
  return personName(bank, gender);
}
