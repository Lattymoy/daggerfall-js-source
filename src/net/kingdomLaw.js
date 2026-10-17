// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - THE KINGDOMS OF THE ILIAC BAY, as
// SEAT0 drew them (bible/11-Multiplayer/Seats-Arc.md 4.3; Mac: "You").
//
// FACT: nothing in DFU maps a region to a kingdom, and its borderRegions
// table (systems/faction/factionRelations.js BORDER_REGIONS) is not laid out in
// region order, so SEAT0 drew the map from the bay itself - High Rock
// north of it, Hammerfell south - in REGION_NAMES' own indices
// (formats/mapsTables.js). This is that table, one home: the professions
// read it for the region signatures and the Marches (PROF0 4.7), and the
// seats' slices will read it for a crown's reach.
//
// The regions it leaves out hold no seat and no signature: seventeen
// hold no location at all (the wildernesses, coasts and generic
// villages), and region 31 - the High Rock sea coast - only Mantellan
// Crux and the ship moorings.
//
// Pure: no clock, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

const regions = (...r) => Object.freeze(r);

/** The three crowns and their regions (SEAT0 4.3). */
export const KINGDOMS = Object.freeze({
  daggerfall: Object.freeze({ id: 'daggerfall', name: 'Daggerfall', regions: regions(17, 59, 58, 60, 18, 42, 41, 32) }),
  wayrest: Object.freeze({ id: 'wayrest', name: 'Wayrest', regions: regions(23, 33, 34, 35, 36, 37, 5, 38, 39, 40, 57) }),
  sentinel: Object.freeze({ id: 'sentinel', name: 'Sentinel', regions: regions(20, 0, 1, 11, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 61) }),
});
/** The Marches, each claimed by two crowns: Betony (Daggerfall and Sentinel), Anticlere (Daggerfall and Wayrest),
 *  Lainlyn (Wayrest and Sentinel). */
export const MARCHES = Object.freeze({
  19: Object.freeze(['daggerfall', 'sentinel']),
  21: Object.freeze(['daggerfall', 'wayrest']),
  22: Object.freeze(['wayrest', 'sentinel']),
});
export const MARCH_REGIONS = Object.freeze(Object.keys(MARCHES).map(Number));
/** The Free Lands, no crown's: the Isle of Balfiera (the Direnni's), the Orsinium Area and the Wrothgarian Mountains
 *  (the Orcs'). */
export const FREE_LANDS = Object.freeze({ balfiera: 9, orsinium: 26, wrothgarian: 16 });
export const FREE_LAND_REGIONS = Object.freeze(Object.values(FREE_LANDS));

const BY_REGION = new Map();
for (const k of Object.values(KINGDOMS)) for (const r of k.regions) BY_REGION.set(r, k.id);
/** The crown a region is under - 'daggerfall', 'wayrest', 'sentinel' - or null for a March, a Free Land or a region
 *  no crown holds. */
export const kingdomOf = (region) => BY_REGION.get(region) ?? null;
export const isMarch = (region) => Number.isInteger(region) && Object.prototype.hasOwnProperty.call(MARCHES, region);   // AUDIT-SEATS L10: a number, as kingdomOf and isFreeLand read one ('21' is no region)
export const isFreeLand = (region) => FREE_LAND_REGIONS.includes(region);
