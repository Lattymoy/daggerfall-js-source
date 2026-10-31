// @ts-check
// IC-GRAND's perf pass (bible/03-World/Arena-Provinces.md IC-GRAND, "Off the page's thread") - THE CITY'S WORKER TOLD WHAT
// IS COMING. On the frame (scenes/tamrielSweepsHost.js wires it - HOST-SPLIT), asked only when the player's pixel or the
// city's moves: within PREBUILD_REACH of the city's centre pixel its worker stands (made once - world/imperialPrebuildClient
// .js) and is told the slices the stream is about to build - the ones within NEAR_RING of the player's pixel near (the
// player's own first, then nearest first), the ring past them far; out of reach it is let go, and what it held with it.
//
// IC-STUTTER (2026-10-27, the owner: "Traveling in the Imperial City at x60 presents really bad stuttering"; bible/03-World/
// Arena-Provinces.md IC-STUTTER): AHEAD OF THE TRAVELLER, AND NOTHING OF THE CITY MADE ON THE PAGE. At x60 a slice is
// crossed every two or three seconds, and the worker heard of a slice only on the frame the stream queued it - so the
// pixel's build met pieces not made yet and made them on the page's thread, each a unit no breath parts. Now:
//   - AHEAD (`prebuildWanted`'s `heading`): the slices of the next ring that one more crossing the way the traveller is
//     going brings within NEAR_RING are wanted NEAR, before the stream asks - made while the traveller is a pixel off;
//   - READY (`readyToBuild`, `firstReady`): the stream builds a pixel of the city only once every piece its view reads is
//     the page's (made and kept) or held from a worker; a piece still owed is asked of its worker (`need`, ahead of every
//     wanted piece) and the pump builds the next pixel it owes meanwhile, the view that stands left standing
//     (IC-SWAP-BEHIND). No worker (node, none made, one that failed): every pixel ready, every piece the page's as ever.
import { CAPITALS, capitalCentrePixel, capitalOnPixel, capitalNear } from '../world/tamrielCapitals.js';
import { IMPERIAL_SPAN } from '../world/imperialCity.js';
import { NEAR_RING } from '../world/imperialBlocks.js';
import { createImperialPrebuild } from '../world/imperialPrebuildClient.js';
import { sliceWork } from '../world/imperialPrebuild.js';
import { portBlockFamilyHas } from '../formats/worldData/worldDataReplacement.js';
import { customModelReady } from '../world/customModels.js';

const R = (IMPERIAL_SPAN - 1) / 2;
const CITY = CAPITALS.findIndex((c) => c.family);
/** How far, Chebyshev pixels from the city's centre pixel, the player stands for its worker to stand: the city's half
 *  span and the rings it is told of past it. */
export const PREBUILD_REACH = R + NEAR_RING + 1;

/**
 * The slices wanted with the player at (x, y) and the city's centre at (px, py): every slice within NEAR_RING + 1 of the
 * player's pixel, ring by ring and nearest first in a ring - near within NEAR_RING, far past it. IC-STUTTER: `heading` the
 * way the traveller last crossed ([dx, dy], each -1, 0 or 1): a slice of the outer ring one more crossing that way brings
 * within NEAR_RING is wanted near, first of its ring.
 * @param {number} x @param {number} y @param {number} px @param {number} py @param {?number[]} [heading]
 * @returns {Array<{ s: number, near: boolean }>}
 */
export function prebuildWanted(x, y, px, py, heading = null) {
  const dx = x - px + R,
    dy = y - py + R,
    out = [];
  const [hx, hy] = heading ?? [0, 0];
  const ahead = (/** @type {number} */ ox, /** @type {number} */ oy) =>
    (hx !== 0 || hy !== 0) && Math.max(Math.abs(ox - hx), Math.abs(oy - hy)) <= NEAR_RING;
  for (let ring = 0; ring <= NEAR_RING + 1; ring++) {
    const here = [];
    for (let oy = -ring; oy <= ring; oy++)
      for (let ox = -ring; ox <= ring; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
        const sx = dx + ox,
          sy = dy + oy;
        if (sx >= 0 && sy >= 0 && sx < IMPERIAL_SPAN && sy < IMPERIAL_SPAN)
          here.push({ s: sy * IMPERIAL_SPAN + sx, near: ring <= NEAR_RING || ahead(ox, oy), d: Math.hypot(ox, oy) });
      }
    here.sort((a, b) => Number(b.near) - Number(a.near) || a.d - b.d || a.s - b.s);
    out.push(...here.map(({ s, near }) => ({ s, near })));
  }
  return out;
}

/** IC-STUTTER: how many of the queue's pixels of the city owing pieces have them asked at once - the next builds' (a near
 *  slice ~125 pieces, a far one ~65: all of them held at once well inside world/imperialPrebuildClient.js PREBUILD_KEEP,
 *  so a piece made for the queue's head is never let go for one made for its tail). */
export const NEED_AHEAD = 8;
/** IC-STUTTER: a slice's pieces' keys for a view (its sliceWork's), the latest few kept - a pump asks them every frame
 *  while a build waits. @type {Map<string, string[]>} */
const _keys = new Map();
const KEYS_KEEP = 64;
/** @param {number} s @param {boolean} near */
export function slicePieceKeys(s, near) {
  const k = `${s}${near ? 'n' : 'f'}`;
  let got = _keys.get(k);
  if (!got) {
    got = sliceWork(s, near).map((w) => (w.kind === 'block' ? `b:${w.name}` : `m:${w.id}`));
    _keys.set(k, got);
    if (_keys.size > KEYS_KEEP) _keys.delete(/** @type {string} */ (_keys.keys().next().value));
  }
  return got;
}
/** IC-STUTTER: how many slices' looks (`createCapitalPrebuild`'s `looks`) are kept - a slice and its view each, the
 *  stream's whole square (streamingWorld.js TERRAIN_DISTANCE 4 at most: 81 pixels) many times over. */
const LOOKS_KEEP = 256;
/** IC-STUTTER: whether the page already has a piece - made and kept by the world-data door or the models' family (a read
 *  of it makes nothing). @param {string} key */
export const pageHasPiece = (key) =>
  key.startsWith('b:') ? portBlockFamilyHas(key.slice(2)) : customModelReady(Number(key.slice(2)));

/** @param {{ state: any, built?: Map<string, any> }} host @param {{ make?: () => any, centre?: () => ?{ px: number, py: number }, pageHas?: (key: string) => boolean, onPixel?: (px: number, py: number) => any }} [o]
 *  the client's maker, the city's centre pixel, the page's own caches and the capitals' pixels (the pins' fakes) */
export function createCapitalPrebuild(
  host,
  {
    make = () => createImperialPrebuild(),
    centre: centreOf = () => (CITY >= 0 ? capitalCentrePixel(CITY) : null),
    pageHas = pageHasPiece,
    onPixel = capitalOnPixel,
  } = {},
) {
  /** @type {any} */
  let client = null,
    at = '';
  /** IC-STUTTER: the pixel the traveller stood on before this one, and the way they last crossed. */
  let /** @type {?{ x: number, y: number }} */ was = null,
    /** @type {?number[]} */ heading = null;
  /** IC-STUTTER: A LOOK A SLICE - per slice and view (`s * 2 + near`), its pieces' keys and how far along them a look has
   *  found every key had (held from a worker, or the page's): a frame looks again from the first key still owed, never
   *  the whole view's (a queue of 81 pixels of the city looked at whole was ~2 ms a frame while the pump waited).
   *  @type {Map<number, { keys: string[], at: number }>} */
  const looks = new Map();
  const drop = () => {
    client?.dispose();
    client = null;
    looks.clear();
  };
  function sweep() {
    const cur = host.state?.current,
      c = cur ? centreOf() : null;
    const key = cur && c ? `${cur.x},${cur.y}:${c.px},${c.py}` : '';
    if (key === at) return;
    at = key;
    if (cur && was && (cur.x !== was.x || cur.y !== was.y))
      heading = [Math.sign(cur.x - was.x), Math.sign(cur.y - was.y)]; // IC-STUTTER
    was = cur ? { x: cur.x, y: cur.y } : null;
    if (!cur || !c || Math.max(Math.abs(cur.x - c.px), Math.abs(cur.y - c.py)) > PREBUILD_REACH) {
      drop();
      return;
    }
    client ??= make();
    client.want(prebuildWanted(cur.x, cur.y, c.px, c.py, heading));
  }
  const had = (/** @type {string} */ k) => client.has(k) || pageHas(k);
  /**
   * IC-STUTTER: THE LOOK AT A PIXEL'S VIEW - the pieces of the city its build would make on the page are the keys of the
   * view it builds now (world/tamrielCapitals.js capitalBuildView's: near within NEAR_RING of the traveller, else far)
   * from the look's `at` on that are neither the page's nor held from a worker; the look moved past every key now had.
   * Null for a pixel no slice of the family capital's.
   * @param {number} px @param {number} py @returns {?{ keys: string[], at: number }}
   */
  function lookOf(px, py) {
    const on = onPixel(px, py);
    if (!on?.cap?.family) return null;
    const near = capitalNear(px, py, host.state?.current),
      id = on.s * 2 + (near ? 1 : 0);
    let look = looks.get(id);
    if (!look) {
      look = { keys: slicePieceKeys(on.s, near), at: 0 };
      looks.set(id, look);
      if (looks.size > LOOKS_KEEP) looks.delete(/** @type {number} */ (looks.keys().next().value));
    }
    while (look.at < look.keys.length && had(look.keys[look.at])) look.at++;
    return look;
  }
  /** the pieces a look still owes, put on `out` (no list made a frame for each).
   *  @param {{ keys: string[], at: number }} look @param {string[]} out */
  const owedInto = (look, out) => {
    for (let i = look.at; i < look.keys.length; i++) if (!had(look.keys[i])) out.push(look.keys[i]);
    return out;
  };
  /** IC-STUTTER: a look done, looked at whole again before its pixel is built - a piece let go since it was looked at is
   *  owed again, and the look goes back to it. @param {{ keys: string[], at: number }} look */
  function whole(look) {
    const i = look.keys.findIndex((k) => !had(k));
    if (i >= 0) look.at = i;
    return i < 0;
  }
  /** IC-STUTTER: whether a pixel's build makes nothing of the city on the page - the pieces it owes asked of their
   *  workers when it would. @param {number} px @param {number} py */
  function readyToBuild(px, py) {
    if (!client?.alive) return true;
    const look = lookOf(px, py);
    if (!look || (look.at >= look.keys.length && whole(look))) return true;
    client.need(owedInto(look, []));
    return false;
  }
  /**
   * IC-STUTTER: THE PUMP'S NEXT PIXEL - the queue's first pixel ready to build (its look owing nothing) moved to its
   * head, the queue's order else unchanged; false when none is (the pump waits a frame; what stands, stands). The first
   * NEED_AHEAD pixels of the queue that owe pieces have them asked for - the ones the stream has not built at all (a hole
   * in the land) before the ones built again behind their standing view - so the workers make what the stream is about
   * to build, in its order. A frame costs a look a pixel (from where its look stopped) and the asked pixels' owed keys;
   * the pixel chosen is looked at whole.
   * @param {Array<{ px: number, py: number }>} queue
   */
  function firstReady(queue) {
    if (!client?.alive || !queue.length) return true;
    let first = -1,
      owing = 0;
    const holes = [],
      behind = [];
    for (let i = 0; i < queue.length && (first < 0 || owing < NEED_AHEAD); i++) {
      const q = queue[i],
        look = lookOf(q.px, q.py);
      if (!look || (look.at >= look.keys.length && (first >= 0 || whole(look)))) {
        if (first < 0) first = i;
        continue;
      }
      if (++owing > NEED_AHEAD) continue; // asked when the pump comes nearer it
      owedInto(look, host.built?.has(`${q.px},${q.py}`) ? behind : holes);
    }
    if (holes.length || behind.length) client.need([...holes, ...behind]);
    if (first > 0) queue.unshift(...queue.splice(first, 1));
    return first >= 0;
  }
  return {
    sweep,
    readyToBuild,
    firstReady,
    drop: () => {
      drop();
      at = '';
      was = null;
      heading = null;
    },
    get client() {
      return client;
    },
    get heading() {
      return heading;
    },
    get looks() {
      return looks.size;
    },
  };
}
