// @ts-check
// WW1 (2026-10-24, bible/03-World/World-Wide.md): THE NAME BANK OF AN AREA (world/worldWide/worldGrid.js) - on the Bay a
// region, and its bank is GetNameBankOfRegion's own; past it a province's district, and its bank its people's
// (characters/nameHelper.js getNameBank - a Nord's in Skyrim, a Khajiit's in Elsweyr, the Imperial bank in the Imperial
// Province and, by DFU's own quirk, in Black Marsh). Its own module, beside nameHelper.js rather than in it: the account
// Worker bundles nameHelper.js, and the world's grid and the continent behind it are no part of that Worker.
//
// Not a DFU member: DFU's names stop at the Bay.
import { getNameBankOfRegion, getNameBank, BANK_TYPES } from './nameHelper.js';
import { areaRace, isBayArea } from '../world/worldWide/worldGrid.js';

/** @param {number} area */
export const nameBankOfArea = (area) => {
  if (isBayArea(area)) return getNameBankOfRegion(area);
  const race = areaRace(area);
  return race === 'Imperial' ? BANK_TYPES.Imperial : getNameBank(race ?? 'Breton');
};
