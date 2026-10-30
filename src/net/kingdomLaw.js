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

/** The crowns and their regions (SEAT0 4.3) - the Bay's three, each named for its capital; WW7-3 (2026-10-25, the owner:
 *  "we need the same city nodes populating the entire map of tamriel", and asked whether each province's crown is a
 *  kingdom of its own: "Yes"; bible/03-World/World-Wide.md WW7) every province past the Bay's but High Rock's and
 *  Hammerfell's (whose crowns are the Bay's three - the owner: "Whatever makes sense"), its region WW-R's (formats/
 *  mapsTables.js regionOfTheatre), named for its province and SEATED at its capital (world/tamrielCapitals.js CAPITALS:
 *  `seat` the crown seat's own name, where the Bay's crowns' is their kingdom's). */
export const KINGDOMS = Object.freeze({
  daggerfall: Object.freeze({ id: 'daggerfall', name: 'Daggerfall', regions: regions(17, 59, 58, 60, 18, 42, 41, 32) }),
  wayrest: Object.freeze({
    id: 'wayrest',
    name: 'Wayrest',
    regions: regions(23, 33, 34, 35, 36, 37, 5, 38, 39, 40, 57),
  }),
  sentinel: Object.freeze({
    id: 'sentinel',
    name: 'Sentinel',
    regions: regions(20, 0, 1, 11, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 61),
  }),
  skyrim: Object.freeze({ id: 'skyrim', name: 'Skyrim', seat: 'Solitude', regions: regions(64) }),
  morrowind: Object.freeze({ id: 'morrowind', name: 'Morrowind', seat: 'Mournhold', regions: regions(65) }),
  summerset: Object.freeze({ id: 'summerset', name: 'Summerset', seat: 'Alinor', regions: regions(66) }),
  valenwood: Object.freeze({ id: 'valenwood', name: 'Valenwood', seat: 'Falinesti', regions: regions(67) }),
  elsweyr: Object.freeze({ id: 'elsweyr', name: 'Elsweyr', seat: 'Torval', regions: regions(68) }),
  blackmarsh: Object.freeze({ id: 'blackmarsh', name: 'Black Marsh', seat: 'Helstrom', regions: regions(69) }),
  cyrodiil: Object.freeze({ id: 'cyrodiil', name: 'Cyrodiil', seat: 'Imperial City', regions: regions(70) }),
});
/** WW7-3: the Bay's three crowns (the Marches', the Tides', the region signatures' and the card suits' kingdoms). */
export const BAY_KINGDOMS = Object.freeze(['daggerfall', 'wayrest', 'sentinel']);
/** WW7-3: a crown seat's own name - its kingdom's `seat` (a province's capital), else the kingdom's name (the Bay's). */
export const kingdomSeatName = (id) => KINGDOMS[id]?.seat ?? KINGDOMS[id]?.name ?? null;
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
/** The crown a region is under - 'daggerfall', 'wayrest', 'sentinel', WW7-3 a province's - or null for a March, a Free
 *  Land or a region no crown holds (High Rock's and Hammerfell's past the Bay among them). */
export const kingdomOf = (region) => BY_REGION.get(region) ?? null;
export const isMarch = (region) => Number.isInteger(region) && Object.prototype.hasOwnProperty.call(MARCHES, region); // AUDIT-SEATS L10: a number, as kingdomOf and isFreeLand read one ('21' is no region)
export const isFreeLand = (region) => FREE_LAND_REGIONS.includes(region);
