// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT19 (2026-10-07) — SCRYING.
//
// The Loot arc II (bible/06-Systems/Loot-II-Arc.md section 11; Mac:
// "what could we do to make it even more amazing, while also balancing
// everyrhing?", then "Lets go all in"). The codex says where an unfound
// Legendary is said to be - among a FAMILY of foes (LOOT6), whose
// dungeon kinds weigh its records at their piles (lootRarity.js
// DUNGEON_FAMILY). At the Reforge the guild's scryers turn that hint
// into a place: name a family and, for SCRY_PRICE, they reveal the
// NEAREST dungeon of the family's kinds in the player's region that is
// not yet on their map - DFU's own discovery (systems/discovery.js
// discoverLocation, the store the travel map's dots read), named in the
// window's last word. Nothing hidden of that family there, nothing
// asked and nothing paid.
//
// It changes no odds (the arc's law 1: the source sets them, never the
// player) - it is information, which the Economy Arc's intent 7 trades.
// The host hands the region (scenes/world.js scryWhere: its map table's
// rows, each with its name and map pixel, and the player's pixel); the
// window (ui/reforgeWindow.js 'scry') asks and draws. OFF IS DFU
// EXACTLY: with the loot-rarity row off nothing is scried.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn, DUNGEON_FAMILY, FAMILY_IDS } from './lootRarity.js';
import { hasDiscoveredLocationId, discoverLocation } from './discovery.js';
import { shardsHeld, spendShards } from './reforge.js';
import { totalGoldAmount, deductGold } from './court.js';
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';

/** What a scrying costs. */
export const SCRY_PRICE = Object.freeze({ shards: 3, gold: 500 });
/** A family's dungeon kinds (DFRegion.DungeonTypes indices). */
export const familyKinds = (/** @type {string} */ family) => DUNGEON_FAMILY.flatMap((f, i) => (f === family ? [i] : []));
/** The families a scrying may name - each with a dungeon kind of its own. */
export const SCRY_FAMILIES = Object.freeze(FAMILY_IDS.filter((f) => familyKinds(f).length > 0));
/** The page's words for a family, and for the dungeon kinds (DFRegion.DungeonTypes order, plural). */
export const SCRY_FAMILY_WORDS = Object.freeze({
  undead: 'The undead', daedra: 'The daedra', dragon: 'The dragons', beast: 'The beasts of the wild',
  brute: 'Orcs and giants', caster: 'Mages and witches', rogue: 'Thieves and assassins', warrior: 'Warriors and knights',
});
export const DUNGEON_KIND_WORDS = Object.freeze(['crypts', 'orc strongholds', 'human strongholds', 'prisons', 'desecrated temples',
  'mines', 'natural caves', 'covens', 'vampire haunts', 'laboratories', 'harpy nests', 'ruined castles', 'spider nests',
  'giant strongholds', 'dragon\'s dens', 'barbarian strongholds', 'volcanic caves', 'scorpion nests', 'cemeteries']);
/** "crypts, vampire haunts, ruined castles and cemeteries". */
export function familyPlaces(/** @type {string} */ family) {
  const w = familyKinds(family).map((k) => DUNGEON_KIND_WORDS[k]);
  return w.length > 1 ? `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}` : (w[0] ?? '');
}

/**
 * A region's rows as the law reads them: its map table, each row with its name, its region's and its map pixel.
 * @param {any} region  maps.getRegion's record ({ name, mapNames, mapTable })
 */
export function scryRows(region) {
  if (!region || !Array.isArray(region.mapTable)) return [];
  return region.mapTable.map((row, i) => ({
    mapId: row.mapId, discovered: !!row.discovered, dungeonType: row.dungeonType,
    name: region.mapNames?.[i] ?? '', regionName: region.name ?? '',
    ...longitudeLatitudeToMapPixel(row.longitude, row.latitude),
  }));
}
/** The nearest place of a family's kinds among `rows` from the map pixel `at` that is on no map yet - neither the
 *  table's baked Discovered flag nor the player's own store (DiscoverRandomLocation's two tests) - or null. Ties go to
 *  the lower map id, so the answer is one answer. */
export function nearestHidden(rows, /** @type {string} */ family, at) {
  const kinds = familyKinds(family);
  let best = null, bestD = Infinity;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!kinds.includes(r?.dungeonType) || r.discovered || hasDiscoveredLocationId(r.mapId)) continue;
    const d = (r.x - at.x) ** 2 + (r.y - at.y) ** 2;
    if (d < bestD || (d === bestD && r.mapId < best.mapId)) { best = r; bestD = d; }
  }
  return best;
}
/** Why a scrying would be refused now, or null: 'off', 'family' (none the page names), 'nowhere' (no region to scry -
 *  a host with no map), 'none' (nothing of the family's hidden in the region - asked before a coin is taken),
 *  'shards', 'gold'. `where` is the host's `{ rows, at }`. */
export function scryRefusal(player, /** @type {string} */ family, where) {
  if (!lootRarityOn()) return 'off';
  if (!SCRY_FAMILIES.includes(family)) return 'family';
  if (!where?.at || !Array.isArray(where.rows) || !where.rows.length) return 'nowhere';
  if (!nearestHidden(where.rows, family, where.at)) return 'none';
  if (shardsHeld(player?.items) < SCRY_PRICE.shards) return 'shards';
  if (totalGoldAmount(player) < SCRY_PRICE.gold) return 'gold';
  return null;
}
/** THE SCRYING, MADE: paid (the shards, then the gold), the place on the player's map. Answers `{ ok: true, place }` or
 *  `{ ok: false, reason }` with nothing taken. */
export function scryPlace(player, /** @type {string} */ family, where) {
  const why = scryRefusal(player, family, where);
  if (why) return { ok: false, reason: why };
  const place = nearestHidden(where.rows, family, where.at);
  spendShards(player.items, SCRY_PRICE.shards);
  deductGold(player, SCRY_PRICE.gold);
  discoverLocation(place.mapId, { regionName: place.regionName, locationName: place.name });
  return { ok: true, place };
}
