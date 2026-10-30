// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md section 2): WHERE A DRAGON COMES DOWN - the gate's site law over the world's
// own data, under a number of the dragon's own (net/dragon/dragonLaw.js dragonSiteDay, its lane dragonLaneOf): the Bay's scan
// for the Bay's lane (systems/gate/gateSite.js findGateSite), a province's for the rest (scenes/gate/gateLanes.js
// createTheatreGateScans siteOf). Every client with the map finds the same pixel; its centre is the site's native point
// (systems/serpent/serpentSite.js sitePixelOfNative's inverse). Not a DFU member. Ledger A (DRAGON).
import { findGateSite } from '../gate/gateSite.js';
import { gateNumber } from '../../net/gate/gateLaw.js';
import { dragonSiteDay, dragonLaneOf } from '../../net/dragon/dragonLaw.js';
import { PIXEL_UNITS } from '../../net/wire.js';
import { BAY_THEATRE } from '../../world/worldWide/worldGrid.js';

/** A map pixel's centre, in native units (x east, z north). @param {number} px @param {number} py */
export const pixelCentreNative = (px, py) => ({ sx: (px + 0.5) * PIXEL_UNITS, sz: (499 - py + 0.5) * PIXEL_UNITS });

/**
 * Watch `w`'s site, or null while its theatre's scan is not whole (asked again later) or the theatre has no ground.
 * @param {number} w @param {{ bayScan: () => any, theatres: () => ({ siteOf: (n: number) => any } | null) }} scans
 * @returns {{ w: number, lane: number, px: number, py: number, sx: number, sz: number, near: string } | null}
 */
export function dragonSiteOf(w, { bayScan, theatres }) {
  const lane = dragonLaneOf(w), day = dragonSiteDay(w);
  let g = null;
  if (lane === BAY_THEATRE) { const scan = bayScan(); g = scan ? findGateSite(day, scan) : null; } else g = theatres()?.siteOf(gateNumber(day, lane)) ?? null;
  if (!g || !Number.isInteger(g.px) || !Number.isInteger(g.py)) return null;
  return { w, lane, px: g.px, py: g.py, ...pixelCentreNative(g.px, g.py), near: g.near ?? '' };
}

/** The site of each watch, found once (a scan not yet whole is asked again after `retryMs`). */
export function createDragonSites(scans, { now = () => Date.now(), retryMs = 5000 } = {}) {
  const found = new Map();
  let triedAt = -Infinity, tried = null;
  return {
    /** @param {number} w */
    of(w) {
      if (found.has(w)) return found.get(w);
      if (tried === w && now() - triedAt < retryMs) return null;
      tried = w; triedAt = now();
      let s = null;
      try { s = dragonSiteOf(w, scans); } catch (e) { console.warn('[dragon] no site', /** @type {any} */ (e)?.message ?? e); }
      if (s) { found.clear(); found.set(w, s); }
      return s;
    },
  };
}
