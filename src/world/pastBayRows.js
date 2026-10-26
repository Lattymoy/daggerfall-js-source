// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT TESA II P7 (2026-10-25, bible/03-World/World-Wide.md "Folded into TESA"; bible/03-World/Arena-Provinces.md) - THE
// PLACES PAST THE BAY AS THE WORLD'S REGISTRY'S ROWS.
//
// WORLD-WIDE built the registry (world/worldWide/worldPlaces.js) as the seam TESA's places plug into - "a provider
// registers its places and every system reads them" - and the fold left it unplugged: past the Bay the registry held
// nothing, so the living world's towns, the world's ports and the zone halls' ground saw no town there. These are the
// rows: every place past the Bay that stands a location, as the world host's build stands it (scenes/world.js
// _locationToBuild over scenes/tamrielPlacesHost.js) -
//   - a CAPITAL's every slice (world/tamrielCapitals.js: its pixel the capital's, TESA10/TESA11), the capital's own
//     map id and name a slice, a port where the place of its name pinned on its centre is one (TESA10b) - NIBEN-SEA: on its
//     harbour's slice, and the Imperial City's Waterfront one where its canal meets it (world/tamrielCapitals.js);
//   - every other place of the model that stands on its pixel (world/arenaPlaces.js arenaPixels - TESA12's cities, towns
//     and villages) with a template to clone (`templateOf`: the host's; none, no location stands), its kind's location
//     type, its template's block grid and the shore's word whether it is a port (TESA6).
// The countryside and the lairs are rolled a pixel at a time and are no list (TESA7, TESA8) - not here.
// AUDIT TESA II P13: on the registry each row is a record of its province's area and region (worldPlaces.js placeOfRow),
// so a town past the Bay names its residents off its area - the pixel builder's stand-in read its region as one.
//
// Pure: the model, the capitals and the templates in, rows out - the same on every client, as the places are.
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { ARENA_TEMPLATE_KINDS, arenaPlaceId, arenaLocationIndex } from './arenaLocations.js';
import { CAPITALS, capitalPin, capitalSpan, capitalSliceOrdinal, capitalSliceName, capitalPlaceId, capitalLocationIndex, capitalHarbourSlice, capitalCanalOpen } from './tamrielCapitals.js';

/** The registry's name for the places past the Bay. */
export const PAST_BAY_SOURCE = 'tesa';

/**
 * The registry's rows for the places past the Bay.
 * @param {{ pixels: ?{ stood: any[], byPixel: Map<string, any> }, templateOf: (place: any) => any, capitals: boolean }} o
 *   `pixels` world/arenaPlaces.js arenaPixels() (null: none stand), `templateOf` a place's template (null: no clone),
 *   `capitals` whether the capitals stand (the host's `?capitals` door and its base)
 * @returns {import('./worldWide/worldPlaces.js').PlaceRow[]}
 */
export function pastBayPlaceRows({ pixels, templateOf, capitals }) {
  /** @type {import('./worldWide/worldPlaces.js').PlaceRow[]} */ const rows = [];
  if (capitals) {
    CAPITALS.forEach((cap, k) => {
      const at = capitalPin({ name: cap.name, province: cap.province });
      if (!at) return;
      const n = capitalSpan(cap), h = (n - 1) / 2, harbour = capitalHarbourSlice(cap);
      const pin = pixels?.byPixel.get(`${at.px},${at.py}`) ?? null;   // the place of its name, pinned on its centre
      for (let s = 0; s < n * n; s++) {
        const sx = s % n, sy = (s - sx) / n;
        rows.push({
          mapId: capitalPlaceId(k, capitalSliceOrdinal(cap, s)), name: capitalSliceName(cap, s), px: at.px + sx - h, py: at.py + sy - h,
          type: LOCATION_TYPES.TownCity, w: n > 1 ? 8 : cap.plan[0].length, h: n > 1 ? 8 : cap.plan.length,
          port: s === harbour && (!!pin?.port || capitalCanalOpen(k)),   // NIBEN-SEA: its harbour's slice (the Imperial City's Waterfront, on its canal)
          location: capitalLocationIndex(k, capitalSliceOrdinal(cap, s)),   // WW7-5: its location's index (a town past the Bay reports itself)
        });
      }
    });
  }
  for (const p of pixels?.stood ?? []) {
    if (p.pinned && capitals) continue;   // it stands as its capital (above)
    const template = templateOf(p);
    if (!template) continue;   // no clone of its kind: no location stands
    const ed = template.exterior?.exteriorData;
    rows.push({ mapId: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, type: ARENA_TEMPLATE_KINDS[p.kind].type, w: ed?.width ?? 1, h: ed?.height ?? 1, port: !!p.port, location: arenaLocationIndex(p) });   // WW7-5: its location's index
  }
  return rows;
}
