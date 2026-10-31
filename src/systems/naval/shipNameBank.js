// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW3 (2026-10-24, bible/03-World/World-Wide.md WW3): THE WATERS' PEOPLE - the name bank a ship's captain and hands are
// named from: past the Bay the waters' area's province's (characters/areaNameBank.js nameBankOfArea - a Nord's in
// Skyrim's waters), on the Bay her region's as always (17, Daggerfall's, for none). The naming laws
// (systems/naval/navalShips.js shipNames, shipCrew.js handName) take the bank this answers: they are the account
// Worker's too (its item law reaches them through the harbour board), and the continent's geography an area's people are
// read off is never its. The client's own; not a DFU member. Ledger A (WW3).
// ═══════════════════════════════════════════════════════════════════
import { nameBankOfArea } from '../../characters/areaNameBank.js';
import { getNameBankOfRegion } from '../../characters/nameHelper.js';
import { BAY_AREA_COUNT } from '../../world/worldWide/worldGrid.js';
import { REGION_NAMES } from '../../formats/mapsTables.js';

/** The bank of the waters' people. @param {number} regionIndex @param {number} [area] */
export const shipNameBank = (regionIndex, area = -1) =>
  Number.isInteger(area) && area >= BAY_AREA_COUNT
    ? nameBankOfArea(area)
    : getNameBankOfRegion(regionIndex >= 0 && regionIndex < REGION_NAMES.length ? regionIndex : 17);
