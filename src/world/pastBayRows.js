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
import {
  CAPITALS,
  capitalPin,
  capitalSliceOrdinal,
  capitalSliceName,
  capitalPlaceId,
  capitalLocationIndex,
  capitalSlicePort,
  capitalDims,
  capitalCanalOpen,
} from './tamrielCapitals.js';

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
      // AUDIT FB1029g P1: its span as the build lays it (synthesizeCapitalLocation) - w by h slices about its centre, each
      // eight blocks square where there are several; a square's n by n read Alinor's and Torval's harbours out
      const D = capitalDims(cap),
        many = D.w * D.h > 1;
      const pin = pixels?.byPixel.get(`${at.px},${at.py}`) ?? null; // the place of its name, pinned on its centre
      for (let s = 0; s < D.w * D.h; s++) {
        const sx = s % D.w,
          sy = (s - sx) / D.w;
        rows.push({
          mapId: capitalPlaceId(k, capitalSliceOrdinal(cap, s)),
          name: capitalSliceName(cap, s),
          px: at.px + sx - D.mx,
          py: at.py + sy - D.my,
          type: LOCATION_TYPES.TownCity,
          w: many ? 8 : cap.plan[0].length,
          h: many ? 8 : cap.plan.length,
          port: capitalSlicePort(k, s, pin?.port), // NIBEN-SEA: its harbour's slice (the Imperial City's Waterfront, on its canal); BAY-LEFT-SEA: the slice's own port byte's law
          location: capitalLocationIndex(k, capitalSliceOrdinal(cap, s)), // WW7-5: its location's index (a town past the Bay reports itself)
        });
      }
    });
  }
  for (const p of pixels?.stood ?? []) {
    if (p.pinned && capitals) continue; // it stands as its capital (above)
    const template = templateOf(p);
    if (!template) continue; // no clone of its kind: no location stands
    const ed = template.exterior?.exteriorData;
    rows.push({
      mapId: arenaPlaceId(p),
      name: p.name,
      px: p.bx,
      py: p.by,
      type: ARENA_TEMPLATE_KINDS[p.kind].type,
      w: ed?.width ?? 1,
      h: ed?.height ?? 1,
      port: !!p.port,
      location: arenaLocationIndex(p),
    }); // WW7-5: its location's index
  }
  return rows;
}

/**
 * BAY-LEFT-GROUND (the audit "no system left behind in the Bay", D1; bible/03-World/Landforms.md "BAY-LEFT-GROUND"): THE
 * PLACES PAST THE BAY AS THE LANDFORMS' SITES (world/landforms.js landformSitesBeyond), as landformSites reads the Bay's
 * own rows - `{ px, py, loc }`, `loc` what a site's footprint reads (terrainTiles.js locationFootprintRect: its block
 * grid and its type), the template a place clones (the game's own rows as MAPS.BSA holds them: a town pack's grid is never
 * a site's - AUDIT LANDFORMS III B1's law). GROUND-AGREE: every client standing the land stands these alike - TESA12's
 * places are the port's own, made on the trace from Daggerfall's own files (no Arena: TESA10d's two sets are history),
 * and the doors that take them off (`?arenaplaces`, `?capitals`, `?tamrieltrace`) are offline alone.
 *   - every place of the model that stands on its pixel with a template (pastBayPlaceRows' second half);
 *   - a capital LEVELLED AS A TOWN IS - one pixel, inland, its canal shut (Mournhold, Falinesti, Helstrom: no
 *     `flattenAt`, its ground its own pixel's mean, a Bay city's law). A capital over several pixels (every slice
 *     flattened to its centre's ground, TESA11/IC-GRAND) or at the sea (its sea's floor, AUDIT TESA II C2, RUMARE-WATER's
 *     basin) keeps its own law: a site pulls toward its own pixel's level, which is not the level it stands at.
 * Not here: the countryside and the lairs (TESA7/TESA8) - a pixel's roll, no list, and a block or two in the middle of
 * their pixel, which DFU's own blend levels inside it.
 * @param {{ pixels: ?{ stood: any[], byPixel: Map<string, any> }, templateOf: (place: any) => any, capitals: boolean }} o
 * @returns {Array<{ px: number, py: number, loc: any }>}
 */
export function pastBaySites({ pixels, templateOf, capitals }) {
  const out = [];
  if (capitals) {
    CAPITALS.forEach((cap, k) => {
      const D = capitalDims(cap);
      if (D.w * D.h > 1 || cap.shore || capitalCanalOpen(k) || !cap.plan) return; // its own ground's law
      const at = capitalPin({ name: cap.name, province: cap.province });
      if (!at) return;
      out.push({
        px: at.px,
        py: at.py,
        loc: {
          mapTableData: { locationType: LOCATION_TYPES.TownCity },
          exterior: { exteriorData: { width: cap.plan[0].length, height: cap.plan.length, blockNames: [''] } },
        },
      });
    });
  }
  for (const p of pixels?.stood ?? []) {
    if (p.pinned && capitals) continue; // a site already: it stands as its capital (above)
    const template = templateOf(p);
    if (template) out.push({ px: p.bx, py: p.by, loc: template });
  }
  return out;
}
