// @ts-check
// START2 (bible/06-Systems/Alternate-Starts-Arc.md section 8): A PROVINCE'S START DUNGEON - which of the land's own
// dungeons (TESA8's lairs, world/tamrielDungeons.js) a province's story begins in. The province's capital is the story's
// landmark ("an old Nord tomb near Solitude"), so the dungeon is the nearest to it of the kinds the story wants, in the
// order it wants them (starts.js STARTS `lair`), and the nearest lair of any kind where none of them stands in reach.
// Only a lair that stands: on its cell's site, in its own province, on no pixel another place takes (a capital, a
// city, the countryside's), laid out to a plan of its own (lairPlanned). Pure over the world's own reads - the same
// lairs on every client, as every client rolls them (scenes/tamrielPlacesHost.js startLairAt).
import { DUNGEON_TYPES, LOCATION_TYPES } from '../../formats/mapsFile.js';
import { lairCellOf, lairSite } from '../../world/tamrielDungeons.js';

/** The nearest a start dungeon stands to its capital's pixel, Bay pixels - past the widest capital's own span (the
 *  Imperial City's three) and its gates, so the story's dungeon is the country's, never the city's doorstep. */
export const START_SITE_MIN = 3;
/** The farthest it is looked for: some 39 km (a pixel is 819.2 m). Measured on the freeware's trace at its fit: each
 *  start's first-wanted kind stands within 35 of its capital (Skyrim's haunted hall the farthest), and every start but
 *  Skyrim's has another of its wanted kinds within it as well. */
export const START_SITE_REACH = 48;

/** Does a lair of location type `type` and dungeon type `dungeonType` answer `want` ([location type, dungeon type] by
 *  MapsFile's names, `*` any dungeon type)? */
export function wantMatches(want, type, dungeonType) {
  const [kind, dt] = want;
  return LOCATION_TYPES[kind] === type && (dt === '*' || DUNGEON_TYPES[dt] === dungeonType);
}

/**
 * THE START DUNGEON'S CANDIDATES, in the order they are taken: each kind the start wants in its order, nearest first
 * (`want` its index in the start's list), then every other lair in reach, nearest first (`want` -1). The host takes the
 * first whose dungeon a quest can use (scenes/startsHost.js: a quest item's marker in it). Empty where none stands.
 * @param {{ lair: ReadonlyArray<ReadonlyArray<string>>, province: ?string }} start
 * @param {{ centre: ?{ px: number, py: number }, rollAt: (px: number, py: number) => ?{ type: number, dungeonType: number },
 *   free: (px: number, py: number) => boolean, provinceAt: (px: number, py: number) => ?string,
 *   min?: number, reach?: number }} world `rollAt` - the lair standing laid out on the pixel (its kind and dungeon
 *   type), or null; `free` - no other place takes the pixel; `provinceAt` - the province whose land it is
 * @returns {Array<{ px: number, py: number, want: number }>}
 */
export function startLairSites(
  start,
  { centre, rollAt, free, provinceAt, min = START_SITE_MIN, reach = START_SITE_REACH },
) {
  if (!start?.province || !centre) return [];
  const found = [];
  const seen = new Set();
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const c = lairCellOf(centre.px + dx, centre.py + dy);
      if (c < 0 || seen.has(c)) continue;
      seen.add(c);
      const { px, py } = lairSite(c);
      const d = Math.hypot(px - centre.px, py - centre.py);
      if (d < min || d > reach || provinceAt(px, py) !== start.province || !free(px, py)) continue;
      const at = rollAt(px, py);
      if (at) found.push({ px, py, d, type: at.type, dungeonType: at.dungeonType });
    }
  }
  // nearest first; a tie by the pixel itself, so every client takes the same
  found.sort((a, b) => a.d - b.d || a.py - b.py || a.px - b.px);
  const out = [],
    taken = new Set();
  const take = (f, want) => {
    taken.add(f);
    out.push({ px: f.px, py: f.py, want });
  };
  start.lair.forEach((w, i) => {
    for (const f of found) if (!taken.has(f) && wantMatches(w, f.type, f.dungeonType)) take(f, i);
  });
  for (const f of found) if (!taken.has(f)) take(f, -1);
  return out;
}
