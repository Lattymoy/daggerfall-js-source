// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TVD-WORLD (2026-10-27, bible/06-Systems/Travel-View.md TVD-WORLD; the audit NO SYSTEM LEFT BEHIND IN THE BAY item 29, C4;
// the owner: "Every single thing here needs to be addressed. No exceptions.") - THE LAIRS ABOUT THE TRAVELLER PAST THE
// BAY, as TV6's dungeons read them.
//
// TV6 (systems/travel/travelDungeons.js) stands every dungeon within the far range on the Overworld - a found one a plate
// and a journey, the rest a "?" where it lies, found on approach - and OW-DUNGEONS each one's model. Its dungeons were
// the map's rows (dungeonRows, MAPS.BSA's: the Bay's alone), so past the Bay no lair (TESA8, world/tamrielDungeons.js -
// the land's dungeons there) was ever plated, marked, found or drawn. A lair is a roll of its 8 x 8 cell (lairSite, the
// places host's `lairAt`): reading one the first time is its plateau and its plan, some milliseconds, and the far range
// holds forty cells. So this reads them NEAREST FIRST, AT MOST `reads` NEW CELLS A CALL (a cell read is kept while what
// stands the places is - the places host's own stamp, `version`), and while any cell in reach is unread its `gen` moves,
// so the lists built on it are built again the next frame with more: the Overworld fills its lairs in over a few frames
// and never spends a frame on all forty. What a pixel holds that no index has stood is the lair laid out as it would
// stand (the places host's `lairCloneAt`), marked and never built - kept the same way.
//
// Pure over the places host's answers; it reads no host.
// ═══════════════════════════════════════════════════════════════════
import { lairCellOf, lairSite } from '../../world/tamrielDungeons.js';
import { inBay } from '../../world/tamriel/tamrielFrame.js';

/** The cells a call reads that no call has read before (the far range holds some forty). */
export const TV_LAIR_READS = 4;

/**
 * @param {{ lairAt: (px: number, py: number) => ({ mapId: number, name: string, px: number, py: number, type: number }|null),
 *   cloneAt: (px: number, py: number) => any, regionAt: (px: number, py: number) => number, version: () => string,
 *   reads?: number }} deps - the places host's (scenes/tamrielPlacesHost.js provinceQuestPlaces): its lair on a cell's
 *   site, that lair laid out unstood, the politic map's region, the stamp of what stands the places
 */
export function createTravelLairs({ lairAt, cloneAt, regionAt, version, reads = TV_LAIR_READS }) {
  let ver = null,
    gen = 0;
  /** @type {Map<number, any>} cell -> its lair's row, or null */
  const cells = new Map();
  /** @type {Map<string, any>} "x,y" -> the lair laid out there, or null */
  const laid = new Map();
  const fresh = () => {
    const v = version();
    if (v !== ver) {
      ver = v;
      cells.clear();
      laid.clear();
      gen++;
    }
  };
  /**
   * THE LAIRS within `range` (a circle, map pixels) of `at` whose cell's site lies past the Bay, nearest first - TV6's
   * row shape, `{ x, y, row: { mapID, regionIndex, locationType }, lair }` - of the cells read so far: at most `budget`
   * new ones a call.
   * @param {{ x: number, y: number }} at @param {number} range @param {number} [budget]
   */
  function rowsNear(at, range, budget = reads) {
    fresh();
    const r = Math.ceil(range),
      seen = new Set(),
      near = [];
    for (let y = at.y - r; y <= at.y + r; y++) {
      for (let x = at.x - r; x <= at.x + r; x++) {
        const c = lairCellOf(x, y);
        if (c < 0 || seen.has(c)) continue;
        seen.add(c);
        const s = lairSite(c),
          d = Math.hypot(s.px - at.x, s.py - at.y);
        if (d <= range && !inBay(s.px, s.py)) near.push({ c, s, d });
      }
    }
    near.sort((a, b) => a.d - b.d || a.c - b.c);
    let read = 0,
      owed = false;
    const out = [];
    for (const { c, s } of near) {
      if (!cells.has(c)) {
        if (read >= budget) {
          owed = true;
          continue;
        }
        read++;
        cells.set(c, lairAt(s.px, s.py) ?? null);
      }
      const row = cells.get(c);
      if (row)
        out.push({
          x: row.px,
          y: row.py,
          row: { mapID: row.mapId, regionIndex: regionAt(row.px, row.py), locationType: row.type },
          lair: row,
        });
    }
    if (owed) gen++; // cells in reach still unread: what was built on this answer is built again
    return out;
  }
  /** The lair a pixel past the Bay holds, laid out as it would stand and never stood - or null. @param {number} x @param {number} y */
  function lairPlaceAt(x, y) {
    fresh();
    const key = `${x},${y}`;
    if (!laid.has(key)) laid.set(key, lairAt(x, y) ? (cloneAt(x, y) ?? null) : null);
    return laid.get(key);
  }
  return { rowsNear, lairPlaceAt, gen: () => gen };
}
