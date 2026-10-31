// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md section 2): WHERE A DRAGON COMES DOWN - the gate's site law over the world's
// own data, under a number of the dragon's own (net/dragon/dragonLaw.js dragonSiteDay, its lane dragonLaneOf - both of the
// watch's omen, DRAGON-HIDDEN: its seed the relay's, told once it has landed): the Bay's scan
// for the Bay's lane (systems/gate/gateSite.js findGateSite), a province's for the rest (scenes/gate/gateLanes.js
// createTheatreGateScans siteOf). Every client with the map finds the same pixel; its centre is the site's native point
// (systems/serpent/serpentSite.js sitePixelOfNative's inverse). Not a DFU member. Ledger A (DRAGON).
import { findGateSite } from '../gate/gateSite.js';
import { gateNumber } from '../../net/gate/gateLaw.js';
import { dragonSiteDay, dragonLaneOf, pixelCentreNative } from '../../net/dragon/dragonLaw.js';
import { BAY_THEATRE } from '../../world/worldWide/worldGrid.js';

/**
 * An omen's site, or null while its theatre's scan is not whole (asked again later) or the theatre has no ground.
 * @param {{w: number, s: number}} o @param {{ bayScan: () => any, theatres: () => ({ siteOf: (n: number) => any } | null) }} scans
 * @returns {{ w: number, lane: number, px: number, py: number, sx: number, sz: number, near: string } | null}
 */
export function dragonSiteOf(o, { bayScan, theatres }) {
  const w = o.w, lane = dragonLaneOf(o), day = dragonSiteDay(o);
  let g = null;
  if (lane === BAY_THEATRE) { const scan = bayScan(); g = scan ? findGateSite(day, scan) : null; } else g = theatres()?.siteOf(gateNumber(day, lane)) ?? null;
  if (!g || !Number.isInteger(g.px) || !Number.isInteger(g.py)) return null;
  return { w, lane, px: g.px, py: g.py, ...pixelCentreNative(g.px, g.py), near: g.near ?? '' };
}

/** The site of each watch's omen, found once (a scan not yet whole is asked again after `retryMs`). */
export function createDragonSites(scans, { now = () => Date.now(), retryMs = 5000 } = {}) {
  const found = new Map();
  let triedAt = -Infinity, tried = null;
  return {
    /** @param {{w: number, s: number}} o */
    of(o) {
      const w = o.w;
      if (found.has(w)) return found.get(w);
      if (tried === w && now() - triedAt < retryMs) return null;
      tried = w; triedAt = now();
      let s = null;
      try { s = dragonSiteOf(o, scans); } catch (e) { console.warn('[dragon] no site', /** @type {any} */ (e)?.message ?? e); }
      if (s) { found.clear(); found.set(w, s); }
      return s;
    },
  };
}
