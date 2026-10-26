// @ts-check
// IC-GRAND's perf pass (bible/03-World/Arena-Provinces.md IC-GRAND, "Off the page's thread") - THE CITY'S WORKER TOLD WHAT
// IS COMING. On the frame (scenes/tamrielSweepsHost.js wires it - HOST-SPLIT), asked only when the player's pixel or the
// city's moves: within PREBUILD_REACH of the city's centre pixel its worker stands (made once - world/imperialPrebuildClient
// .js) and is told the slices the stream is about to build - the ones within NEAR_RING of the player's pixel near (the
// player's own first, then nearest first), the ring past them far; out of reach it is let go, and what it held with it.
import { CAPITALS, capitalCentrePixel } from '../world/tamrielCapitals.js';
import { IMPERIAL_SPAN } from '../world/imperialCity.js';
import { NEAR_RING } from '../world/imperialBlocks.js';
import { createImperialPrebuild } from '../world/imperialPrebuildClient.js';

const R = (IMPERIAL_SPAN - 1) / 2;
const CITY = CAPITALS.findIndex((c) => c.family);
/** How far, Chebyshev pixels from the city's centre pixel, the player stands for its worker to stand: the city's half
 *  span and the rings it is told of past it. */
export const PREBUILD_REACH = R + NEAR_RING + 1;

/**
 * The slices wanted with the player at (x, y) and the city's centre at (px, py): every slice within NEAR_RING + 1 of the
 * player's pixel, ring by ring and nearest first in a ring - near within NEAR_RING, far past it.
 * @returns {Array<{ s: number, near: boolean }>}
 */
export function prebuildWanted(x, y, px, py) {
  const dx = x - px + R, dy = y - py + R, out = [];
  for (let ring = 0; ring <= NEAR_RING + 1; ring++) {
    const here = [];
    for (let oy = -ring; oy <= ring; oy++) for (let ox = -ring; ox <= ring; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
      const sx = dx + ox, sy = dy + oy;
      if (sx >= 0 && sy >= 0 && sx < IMPERIAL_SPAN && sy < IMPERIAL_SPAN) here.push({ s: sy * IMPERIAL_SPAN + sx, near: ring <= NEAR_RING, d: Math.hypot(ox, oy) });
    }
    here.sort((a, b) => a.d - b.d || a.s - b.s);
    out.push(...here.map(({ s, near }) => ({ s, near })));
  }
  return out;
}

/** @param {{ state: any }} host @param {{ make?: () => any, centre?: () => ?{ px: number, py: number } }} [o] the client's
 *  maker and the city's centre pixel (the pins' fakes) */
export function createCapitalPrebuild(host, { make = () => createImperialPrebuild(), centre: centreOf = () => (CITY >= 0 ? capitalCentrePixel(CITY) : null) } = {}) {
  /** @type {any} */
  let client = null, at = '';
  const drop = () => { client?.dispose(); client = null; };
  function sweep() {
    const cur = host.state?.current, c = cur ? centreOf() : null;
    const key = cur && c ? `${cur.x},${cur.y}:${c.px},${c.py}` : '';
    if (key === at) return;
    at = key;
    if (!cur || !c || Math.max(Math.abs(cur.x - c.px), Math.abs(cur.y - c.py)) > PREBUILD_REACH) { drop(); return; }
    client ??= make();
    client.want(prebuildWanted(cur.x, cur.y, c.px, c.py));
  }
  return { sweep, drop: () => { drop(); at = ''; }, get client() { return client; } };
}
