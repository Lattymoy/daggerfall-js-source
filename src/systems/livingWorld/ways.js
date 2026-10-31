// @ts-check
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE WAYS - the road a town's travellers walk to another town, the
// Travel Options planner's own (`systems/travel/travelRoute.js planRoute`) on the roads the world draws. The living world's
// planner is HERE, not in the host: the host's one construction seam (TO-ROADS, test/systems/travel/fb0929d_toroads.test.js) is the
// player's journey's, and a traveller's way is none of the player's settings.
//
// THE SAME WAY FOR EVERY READER (LW0 decision 2). A pair of towns is asked once, in ONE direction - the lower map id
// first - and the other way is its reverse, so a party walks out and home on one line and every client walks it alike.
// The ground is the game's own (the climate and the heightmap - the host's `ground()`, built without a player's
// attached World of Daggerfall massifs, which only that player has), the roads the network the world draws (Hazelnut's
// when Basic Roads is on, the port's own generated one when it is off). A different network is a different road: the
// book is cleared when the network it planned on changes, and the host's trips with it (`generation`).
//
// A FEW A FRAME (LW3), AND MORE WHILE THE ASKING IS CHEAP (PERF-WAYS1, 2026-10-09, Mac: "I want to continue working to
// increase performance across the board, especially for online"; bible/07-Rendering/Performance-Online.md). A pair not
// yet asked answers undefined and the trips wait on it; `frame()` renews the asking: WAYS_PER_FRAME new pairs at the
// least, then more while the frame's asking has taken under WAYS_MS_PER_FRAME, and never past WAYS_MAX_PER_FRAME (a
// coarse clock can read a pair as nothing). The waiting was the dear part, not the asking: measured in the real game
// online (tools/onlineFrameProbe.mjs, Knightstale), while any way a town's trips need is unasked every reader (the
// town's people, the roads' layer, the deep) plans every trip of every town near again each frame and answers undefined
// - 16.8 ms of a 36.5 ms frame on the probe's container, and 3.5 MB of it allocated - for as long as the ways took at
// two a frame. On the real map's ground a pair is 0.16 ms on Hazelnut's roads and 0.22 on the generated network on
// average (p99 0.8 and 1.1; AUDIT PERF-ON4: 20,000 of the 231,819 town pairs within 18 pixels), one pair in a thousand
// on the roads and three on the generated network take over 2 ms (the dearest 18), and the network's first unroutable
// pair about 180 (its land pieces folded, once) - so a frame's asking can run past the time by one pair, as LW3's two
// could. The same pairs, planned by the same planner on the same network in the same direction - every way the one it
// was - known in a tenth of the frames.
import { planRoute } from '../travel/travelRoute.js';
import { keepLandPieces } from '../travel/landPiecesKept.js'; // FIRST-VISIT: the land's pieces kept across launches
import { inBay } from '../../world/tamriel/tamrielFrame.js';

/** New pairs asked a frame - at the least (LW3). */
export const WAYS_PER_FRAME = 2;
/** PERF-WAYS1: and more past them while the frame's asking has taken under this many milliseconds. */
export const WAYS_MS_PER_FRAME = 2;
/** PERF-WAYS1: and never more than this a frame, whatever the clock reads (a browser's is coarse: a pair it reads as
 *  nothing would let a frame ask without end). */
export const WAYS_MAX_PER_FRAME = 32;

/**
 * WW7-7 (bible/03-World/World-Wide.md): A PAIR PAST THE BAY is its own planner's (`beyond` - systems/livingWorld/beyondWays.js
 * createBeyondWays: the one planner on a window of the world's grid, the roads past the Bay its roads), kept by the build
 * of the roads past the Bay it was asked on (`beyond.epoch()` - 0 before the first: undefined, it waits, as a pair unasked
 * does; WW7-9: the planner itself waits while the land under the pair's window is still being laid): the roads laid again,
 * every way past the Bay is asked again and the generation moves (the host's trips with it). WW7-9: A PAIR ACROSS THE BAY'S
 * EDGE (a Bay town and a town past it) is the same planner's with the Bay's pixels its own ground (`plan(a, b, true)`),
 * kept apart by the drawn network it read; with no land past the Bay it has no way. The Bay's pairs are the Bay's
 * planner's, as they always were.
 * @typedef {{ pixels: { x: number, y: number }[], kinds?: string[] }} WayPlan
 * @param {{ roads: () => ({ roads: any, tracks: any } | null), ground: () => object, plan?: typeof planRoute, now?: () => number, keep?: typeof keepLandPieces,
 *   beyond?: { epoch: () => number, plan: (a: { x: number, y: number }, b: { x: number, y: number }, cross?: boolean) => (WayPlan | null | undefined), frame?: () => void, clear?: () => void } | null }} deps -
 *   `roads` the drawn network (null until it is built); `ground` the planner's ground (travelRoute.js routeGround's);
 *   `now` the clock the frame's asking is timed by (PERF-WAYS1; milliseconds); WW7-7 `beyond` the ways past the Bay
 */
export function createWayBook({
  roads,
  ground,
  plan = planRoute,
  now = () => performance.now(),
  beyond = null,
  keep = keepLandPieces,
}) {
  // FIRST-VISIT `keep`: the fetch of the land's pieces (landPiecesKept.js) - a promise the book waits on, or null
  /** @type {Map<string, WayPlan|null>} */
  const book = new Map();
  /** WW7-7: the ways past the Bay, and the epoch of the roads past the Bay they were asked on. @type {Map<string, WayPlan|null>} */
  const far = new Map();
  let farAt = 0;
  /** WW7-9: the ways across the Bay's edge, and the drawn network they read. @type {Map<string, WayPlan|null>} */
  const edge = new Map();
  /** @type {any} */ let edgeNet = null;
  let budget = WAYS_PER_FRAME;
  let asked = 0,
    spent = 0,
    spendMs = WAYS_MS_PER_FRAME; // PERF-WAYS1: the frame's asking so far (pairs, ms), and how long it may run past the floor
  let net = null,
    generation = 0;
  let keeping = null; // FIRST-VISIT: the network's pieces being fetched (or folded and kept) - the ways wait on it
  /** The kept way of the lower id's town to the other's, the reverse when `flip`. @param {WayPlan|null|undefined} way @param {boolean} flip */
  const turned = (way, flip) =>
    !way || !flip ? way : { pixels: [...way.pixels].reverse(), kinds: [...(way.kinds ?? [])].reverse() };
  /** WW7-7: a pair past the Bay - its planner's, on the build of the roads past the Bay it was asked on. WW7-9: `cross` a
   *  pair across the Bay's edge - its book the drawn network's too (none built yet: it waits). */
  const farWayOf = (
    /** @type {{ mapId: number, px: number, py: number }} */ p,
    /** @type {{ mapId: number, px: number, py: number }} */ q,
    /** @type {boolean} */ flip,
    cross = false,
  ) => {
    const epoch = /** @type {NonNullable<typeof beyond>} */ (beyond).epoch();
    if (!epoch) return undefined; // a region still to land: no way is the one every client will walk yet
    if (epoch !== farAt) {
      if (farAt) {
        far.clear();
        edge.clear();
        beyond?.clear?.();
        generation++;
      }
      farAt = epoch;
    }
    const raw = cross ? roads() : null;
    if (cross && !raw) return undefined;
    if (raw && raw.roads !== edgeNet) {
      if (edgeNet !== null) {
        edge.clear();
        generation++;
      }
      edgeNet = raw.roads;
    } // another network: the ways over it asked again
    const book = cross ? edge : far,
      key = `${p.mapId}>${q.mapId}`;
    let way = book.get(key);
    if (way === undefined) {
      if (budget <= 0 && (spent >= spendMs || asked >= WAYS_MAX_PER_FRAME)) return undefined; // PERF-WAYS1's floor, its time and its cap, as a Bay pair's
      const t0 = now();
      way = /** @type {NonNullable<typeof beyond>} */ (beyond).plan({ x: p.px, y: p.py }, { x: q.px, y: q.py }, cross);
      if (way === undefined) return undefined; // its ground still being read (a tile a frame)
      budget--;
      asked++;
      spent += now() - t0;
      book.set(key, way ?? null);
    }
    return turned(way, flip);
  };
  return {
    /**
     * The way from town `a` to town `b` (`{ mapId, px, py }`): the plan, null for none, undefined while it waits (the
     * network not built yet, or the frame's asking spent).
     * @param {{ mapId: number, px: number, py: number }} a @param {{ mapId: number, px: number, py: number }} b
     * @returns {WayPlan|null|undefined}
     */
    wayOf(a, b) {
      const pastA = !inBay(a.px, a.py),
        pastB = !inBay(b.px, b.py);
      if (pastA !== pastB && !beyond) return null; // WW7-7: across the Bay's edge with no land past it - no trip's way
      if ((pastA || pastB) && beyond) {
        const flip = a.mapId > b.mapId;
        return farWayOf(flip ? b : a, flip ? a : b, flip, pastA !== pastB);
      } // WW7-9: past the Bay, or across its edge
      const raw = roads();
      if (!raw) return undefined;
      if (raw.roads !== net) {
        if (net !== null) {
          book.clear();
          generation++;
        }
        net = raw.roads;
        const k = keep?.(ground(), raw) ?? null;
        keeping = k;
        k?.catch(() => false).finally(() => {
          if (keeping === k) keeping = null;
        });
      }
      if (keeping) return undefined;
      const flip = a.mapId > b.mapId;
      const p = flip ? b : a,
        q = flip ? a : b;
      const key = `${p.mapId}>${q.mapId}`;
      let way = book.get(key);
      if (way === undefined) {
        if (budget <= 0 && !(spent < spendMs && asked < WAYS_MAX_PER_FRAME)) return undefined; // PERF-WAYS1: the floor spent, and the frame's time or its cap
        budget--;
        asked++;
        const t0 = now();
        way =
          plan(
            { x: p.px, y: p.py },
            { x: q.px, y: q.py },
            { roads: raw.roads ?? null, tracks: raw.tracks ?? null, ...ground() },
          ) ?? null;
        spent += now() - t0;
        book.set(key, way);
      }
      return turned(way, flip);
    },
    /** A new frame: the asking renewed - `n` pairs at the least, and more while it has taken under `ms` (PERF-WAYS1);
     *  WW7-7: and the ground past the Bay's reading. */
    frame(n = WAYS_PER_FRAME, ms = WAYS_MS_PER_FRAME) {
      budget = n;
      asked = 0;
      spent = 0;
      spendMs = ms;
      beyond?.frame?.();
    },
    /** Bumped each time the network changed under the book (the host's trips are cleared with it). */
    get generation() {
      return generation;
    },
    get size() {
      return book.size + far.size + edge.size;
    },
    /** FIRST-VISIT: the land's pieces being fetched for the network - a promise the ways wait on, or null. */
    get keeping() {
      return keeping;
    },
  };
}
