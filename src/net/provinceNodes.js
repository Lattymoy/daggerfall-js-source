// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW-C1 (2026-10-24, bible/03-World/World-Wide.md WW-C) - THE PROVINCES' GROUND: what each province past the Bay is
// rich in.
//
// The owner: "Each region becomes home to their own abundant harvesting resources with other resources sprinkled in.
// Cyrodil becomes the new open PvP area ... Cryodil will be home to all abundent resources".
//
// A province's ground stands its climate's nodes (net/nodeLaw.js NODE_COUNTS) - the resources sprinkled in - and of
// the kinds it is rich in, its RICHNESS times as many; a province with an ore of its own stands it on PROVINCE_ORE_SLOTS
// veins beside them, as a Bay crown's signature stands (nodeLaw.js regionSignature). CYRODIIL is rich in every kind
// any province is, as rich as the richest, drawn over every rich province's tables together, and it stands each
// province's ore.
//
// ON WITNESSED GROUND ALONE, as a crown's signature is (AUDIT 29 A6, UNWITNESSED-ORE): the service knows a pixel's
// province only from the clients that derived it - the border is the player's own traced picture
// (world/tamriel/tamrielLand.js), and the service holds none - so the province is the claim a lie is worth most on,
// and ground no three witnesses have confirmed stands its climate's alone.
//
// Pure: tables in, answers out. Both ends read it through nodeLaw.js.
// ═══════════════════════════════════════════════════════════════════
import { CLIMATES, CYRODIIL_REGION, regionOfTheatre } from '../formats/mapsTables.js';

/** A node kind a province can be rich in (nodeLaw.js NODE_COUNTS' four). */
export const RICH_KINDS = Object.freeze(['tree', 'herb', 'vein', 'boulder']);
/** How many veins of its own ore a confirmed pixel of a province stands a day (a Bay crown's Daggerfall's two). */
export const PROVINCE_ORE_SLOTS = 2;

/** @typedef {{ climate: number, rich: Readonly<Record<string, number>>, ore: string|null }} ProvinceGround */
/** @returns {ProvinceGround} */
const ground = (climate, rich, ore = null) => Object.freeze({ climate, rich: Object.freeze(rich), ore });
/** Each province's ground but Cyrodiil's (theatres 1..8, by region): its climate (world/tamriel/tamrielGeography.js
 *  PROVINCES' - pinned), the kinds it is rich in and how many times its climate's count of each, and its own ore. */
export const PROVINCE_GROUND = Object.freeze({
  [regionOfTheatre(1)]: ground(CLIMATES.Woodlands, { tree: 3, herb: 2 }, 'ore:mithril'), // High Rock: the Breton woods; Wayrest's Mithril
  [regionOfTheatre(2)]: ground(CLIMATES.Desert, { vein: 3, boulder: 2 }, 'ore:dwarven'), // Hammerfell: the Alik'r's ore, the Dwemer's ruins
  [regionOfTheatre(3)]: ground(CLIMATES.Mountain, { vein: 3, boulder: 2 }, 'ore:orichalcum'), // Skyrim: the mountains' mines
  [regionOfTheatre(4)]: ground(CLIMATES.MountainWoods, { vein: 2, herb: 2 }, 'ore:ebony'), // Morrowind: Red Mountain's Ebony
  [regionOfTheatre(5)]: ground(CLIMATES.Subtropical, { herb: 3, tree: 2 }, 'ore:moonstone'), // Sumurset Isle: the Altmer's Moonstone
  [regionOfTheatre(6)]: ground(CLIMATES.Rainforest, { tree: 4 }), // Valenwood: the forests - the jungle's forty-eight
  [regionOfTheatre(7)]: ground(CLIMATES.Desert2, { herb: 3, vein: 2 }, 'metal:gold'), // Elsweyr
  [regionOfTheatre(8)]: ground(CLIMATES.Swamp, { herb: 4, tree: 2 }), // Black Marsh: the Hist's swamp
});
const PROVINCES = Object.values(PROVINCE_GROUND);
/** Cyrodiil's own climate (the Imperial Province's - tamrielGeography.js, pinned). */
export const CYRODIIL_CLIMATE = CLIMATES.Woodlands;

/** How many times its climate's count of `kind` a CONFIRMED pixel of `region` stands: a province's richness; Cyrodiil's
 *  the richest any province has; 1 for a kind a province is not rich in, and for every Bay region. */
export function richness(region, kind) {
  if (region === CYRODIIL_REGION) return Math.max(1, ...PROVINCES.map((p) => p.rich[kind] ?? 1));
  return PROVINCE_GROUND[region]?.rich[kind] ?? 1;
}
/** The ores a CONFIRMED pixel of `region` stands beside its climate's veins, one a slot: a province's own,
 *  PROVINCE_ORE_SLOTS times; Cyrodiil's every province's, once each; none for a Bay region (its crown's is
 *  nodeLaw.js regionSignature's) or a province with no ore of its own. */
export function provinceOres(region) {
  if (region === CYRODIIL_REGION) return PROVINCES.map((p) => p.ore).filter((o) => o !== null);
  const ore = PROVINCE_GROUND[region]?.ore ?? null;
  return ore ? Array(PROVINCE_ORE_SLOTS).fill(ore) : [];
}
/** The climates whose tables of `kind` a CONFIRMED pixel of `region` and `climate` draws over: its own climate's
 *  first; Cyrodiil's, every province's rich in `kind` after it (its abundance theirs). */
export function richClimates(region, kind, climate) {
  if (region !== CYRODIIL_REGION) return [climate];
  return [...new Set([climate, ...PROVINCES.filter((p) => (p.rich[kind] ?? 1) > 1).map((p) => p.climate)])];
}
