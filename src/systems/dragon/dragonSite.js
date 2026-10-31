// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md section 2): WHERE A DRAGON COMES DOWN - the gate's ground over the world's
// own data, in the cell its omen picks (net/dragon/dragonLaw.js dragonCellOf - DRAGON-CELL: its seed the relay's, told only
// to a player near that cell). The cell's ground is the Bay's scan's pixels in it (systems/gate/gateSite.js, never the open
// zone's) and, past the Bay, the gate's law over the towns about it (scenes/gate/gateLanes.js groundIn - the countryside's
// towns among them); its own roll picks one (dragonSitePick). Every client with the map finds the same pixel; its centre is
// the site's native point. A cell with no ground brings no dragon down. Not a DFU member. Ledger A (DRAGON).
import { dragonCellOf, dragonSitePick, pixelCentreNative, DRAGON_CELL_PX } from '../../net/dragon/dragonLaw.js';
import { WILD_REGION } from '../wild/wildZone.js';
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { worldPixelKey, worldPixelOfKey } from '../../world/worldWide/worldGrid.js';

/** Bay pixel ids are MapsFile's `y * 1000 + x` (BAY-OWN: the Bay's own scan lists them so). */
const BAY_ROW = 1000;

/**
 * An omen's site; `null` while a scan it needs is not whole (asked again later); `false` where its cell holds no ground.
 * @param {{w: number, s: number}} o
 * @param {{ bayScan: () => any, theatres: () => ({ groundIn?: (x0: number, y0: number, side: number) => any } | null) }} scans
 * @returns {{ w: number, px: number, py: number, sx: number, sz: number, near: string } | null | false}
 */
export function dragonSiteOf(o, { bayScan, theatres }) {
  const { cx, cy } = dragonCellOf(o), x0 = cx * DRAGON_CELL_PX, y0 = cy * DRAGON_CELL_PX, side = DRAGON_CELL_PX;
  const inCell = (/** @type {number} */ x, /** @type {number} */ y) => x >= x0 && y >= y0 && x < x0 + side && y < y0 + side;
  /** @type {Array<[number, string]>} */ const ground = [];
  const onBay = [[x0, y0], [x0 + side - 1, y0], [x0, y0 + side - 1], [x0 + side - 1, y0 + side - 1]].map(([x, y]) => inBay(x, y));   // a cell is far smaller than the Bay: its corners say where it lies
  if (onBay.some(Boolean)) {
    const scan = bayScan();
    if (!scan) return null;
    for (const [r, list] of scan.byRegion) {
      if (r === WILD_REGION) continue;
      for (const id of list) {
        const x = id % BAY_ROW, y = Math.floor(id / BAY_ROW);   // BAY-OWN: the Bay's scan's own ids
        if (inCell(x, y)) ground.push([worldPixelKey(x, y), scan.towns[scan.townAt[id]]?.name ?? '']);
      }
    }
  }
  if (!onBay.every(Boolean)) {
    const g = theatres()?.groundIn?.(x0, y0, side);
    if (!g) return null;
    for (const list of g.byArea.values()) for (const k of list) ground.push([k, g.towns[g.townOf.get(k)]?.name ?? '']);
  }
  if (!ground.length) return false;
  ground.sort((a, b) => a[0] - b[0]);
  const [k, near] = ground[dragonSitePick(o) % ground.length];
  const [px, py] = worldPixelOfKey(k);
  return { w: o.w, px, py, ...pixelCentreNative(px, py), near };
}

/** The site of each watch's omen, found once (a scan not yet whole is asked again after `retryMs`; a cell with no ground
 *  is kept as none). */
export function createDragonSites(scans, { now = () => Date.now(), retryMs = 5000 } = {}) {
  const found = new Map();
  let triedAt = -Infinity, tried = null;
  return {
    /** @param {{w: number, s: number}} o */
    of(o) {
      const key = `${o.w}:${o.s}`;
      if (found.has(key)) return found.get(key);
      if (tried === key && now() - triedAt < retryMs) return null;
      tried = key; triedAt = now();
      let s = null;
      try { s = dragonSiteOf(o, scans); } catch (e) { console.warn('[dragon] no site', /** @type {any} */ (e)?.message ?? e); }
      if (s === null) return null;
      found.clear(); found.set(key, s || null);
      return s || null;
    },
  };
}
