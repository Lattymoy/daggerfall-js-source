// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT RELEASE R2-6 (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md; the owner: "Take care of exclusions and
// gaps") - A CEMETERY PAST THE BAY.
//
// DFU's GetRandomCemetery (PlayerGPS.CurrentRegionIndex's map table, its DungeonType.Cemetery rows, one drawn by
// UnityEngine.Random - VampirismInfection's transfer to a crypt when the turn completes) reads MAPS.BSA, which holds no
// row past the Bay: a vampire turned in a province was never carried to a crypt. The same rule on the province's own
// ground:
//   - THE REGION IS THE AREA. WW1 (03-World/World-Wide.md decision 4) made a province's DISTRICT (DISTRICT_PX, about a
//     Bay region's size) what a region was to every system that grouped by it; a cemetery is drawn from the player's
//     area's own - its lairs of DUNGEON_TYPES.Cemetery (world/tamrielDungeons.js LAIR_TYPES' graveyards) - by DFU's draw.
//   - NONE IN IT: the nearest cemetery of the eight districts about it, the province's own (the theatre's), a map
//     pixel's straight distance, a tie the lower map id.
//   - NONE THERE EITHER (no lair stands - their templates unread): the nearest of the Bay's own, any region's
//     (`nearestBayCemetery`) - the transfer is never skipped past the Bay.
// Pure over the world's registry (world/worldWide/worldPlaces.js inArea - a district walked once a generation) and the
// game's MapsFile; the same answer on every client for one roll.
// ═══════════════════════════════════════════════════════════════════
import { DUNGEON_TYPES, longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';
import { theatreAt, districtOf, areaOfDistrict, BAY_THEATRE } from './worldGrid.js';

/** Is a registry place a cemetery a vampire can wake in - a dungeon of DFU's Cemetery type? @param {any} p */
export const isCemeteryPlace = (p) => !!p && !!p.hasDungeon && p.dungeonType === DUNGEON_TYPES.Cemetery;

/** A place's map pixel and its id, the transfer's answer. @param {any} p */
const siteOf = (p) => ({ px: p.px, py: p.py, mapId: p.mapId, name: p.name });

/**
 * The cemetery a vampire turned at (px, py) past the Bay wakes in: its area's drawn by `roll` (DFU's draw), else the
 * nearest of the eight districts about it in the same province; null on the Bay, at sea and where none stands.
 * @param {{ inArea: (area: number) => readonly any[] }} places @param {number} px @param {number} py
 * @param {() => number} [roll] @returns {{ px: number, py: number, mapId: number, name: string }|null}
 */
export function cemeteryPastBay(places, px, py, roll = Math.random) {
  const t = theatreAt(px, py);
  if (t <= BAY_THEATRE) return null;
  const [cx, cy] = districtOf(px, py);
  const own = cemeteriesOf(places, areaOfDistrict(t, cx, cy));
  if (own.length) return siteOf(own[Math.min(own.length - 1, Math.floor(roll() * own.length))]);
  let best = null,
    bestD = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      for (const p of cemeteriesOf(places, areaOfDistrict(t, cx + dx, cy + dy))) {
        const d = Math.hypot(p.px - px, p.py - py);
        if (d < bestD || (d === bestD && p.mapId < best.mapId)) {
          best = p;
          bestD = d;
        }
      }
    }
  }
  return best ? siteOf(best) : null;
}

/** An area's cemeteries in map-id order (the draw's list, the same on every client). @param {any} places @param {number} area */
function cemeteriesOf(places, area) {
  if (area < 0) return [];
  return [...(places.inArea(area) ?? [])].filter(isCemeteryPlace).sort((a, b) => a.mapId - b.mapId);
}

/**
 * The nearest of the Bay's own cemeteries to (px, py), any region's (MAPS.BSA's DungeonType.Cemetery rows, a tie the
 * lower region and row) - the last answer past the Bay, where no lair stands. Null only for a MapsFile with none.
 * @param {{ regionCount: number, getRegion: (r: number) => any }} maps @param {number} px @param {number} py
 * @returns {{ px: number, py: number, mapId: number, name: string }|null}
 */
export function nearestBayCemetery(maps, px, py) {
  let best = null,
    bestD = Infinity;
  for (let r = 0; r < (maps?.regionCount ?? 0); r++) {
    const region = maps.getRegion(r);
    const table = region?.mapTable ?? [];
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      if (row?.dungeonType !== DUNGEON_TYPES.Cemetery) continue;
      const p = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestD) {
        bestD = d;
        best = { px: p.x, py: p.y, mapId: row.mapId, name: region.mapNames?.[i] ?? '' };
      }
    }
  }
  return best;
}
