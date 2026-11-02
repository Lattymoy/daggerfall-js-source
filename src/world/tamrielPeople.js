// @ts-check
// TESA3 (2026-10-12, bible/03-World/Arena-Provinces.md TESA3) - THE PROVINCE'S PEOPLE: whose names a province past the Bay
// gives its townsfolk, its strangers and its quest people. DFU's own name banks (characters/nameHelper.js BANK_TYPES, its
// NameGen.txt verbatim) by the province's race (world/tamriel/tamrielGeography.js PROVINCES) through MacroHelper.GetNameBank's
// own law (getNameBank: an Argonian takes the IMPERIAL bank, "Imperial names appear where one would expect Argonian
// names", NameHelper.cs:50); the Imperial Province, which no race claims, takes the Imperial bank. Not in the terrain
// worker's graph (it reads characters/): the world host asks it.
import { provinceByKey } from './tamriel/tamrielGeography.js';
import { getNameBank, BANK_TYPES } from '../characters/nameHelper.js';

/** A province's name bank by its key, or null for no province. */
export function provinceNameBank(key) {
  const p = provinceByKey(key);
  if (!p) return null;
  return p.race ? getNameBank(p.race) : BANK_TYPES.Imperial;
}
