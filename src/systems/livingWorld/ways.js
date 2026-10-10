// @ts-check
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE WAYS - the road a town's travellers walk to another town, the
// Travel Options planner's own (`systems/travelRoute.js planRoute`) on the roads the world draws. The living world's
// planner is HERE, not in the host: the host's one construction seam (TO-ROADS, test/fb0929d_toroads.test.js) is the
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
import { planRoute } from '../travelRoute.js';

/** New pairs asked a frame - at the least (LW3). */
export const WAYS_PER_FRAME = 2;
/** PERF-WAYS1: and more past them while the frame's asking has taken under this many milliseconds. */
export const WAYS_MS_PER_FRAME = 2;
/** PERF-WAYS1: and never more than this a frame, whatever the clock reads (a browser's is coarse: a pair it reads as
 *  nothing would let a frame ask without end). */
export const WAYS_MAX_PER_FRAME = 32;

/**
 * @typedef {{ pixels: { x: number, y: number }[], kinds?: string[] }} WayPlan
 * @param {{ roads: () => ({ roads: any, tracks: any } | null), ground: () => object, plan?: typeof planRoute, now?: () => number }} deps -
 *   `roads` the drawn network (null until it is built); `ground` the planner's ground (travelRoute.js routeGround's);
 *   `now` the clock the frame's asking is timed by (PERF-WAYS1; milliseconds)
 */
export function createWayBook({ roads, ground, plan = planRoute, now = () => performance.now() }) {
  /** @type {Map<string, WayPlan|null>} */
  const book = new Map();
  let budget = WAYS_PER_FRAME;
  let asked = 0, spent = 0, spendMs = WAYS_MS_PER_FRAME;   // PERF-WAYS1: the frame's asking so far (pairs, ms), and how long it may run past the floor
  let net = null, generation = 0;
  return {
    /**
     * The way from town `a` to town `b` (`{ mapId, px, py }`): the plan, null for none, undefined while it waits (the
     * network not built yet, or the frame's asking spent).
     * @param {{ mapId: number, px: number, py: number }} a @param {{ mapId: number, px: number, py: number }} b
     * @returns {WayPlan|null|undefined}
     */
    wayOf(a, b) {
      const raw = roads();
      if (!raw) return undefined;
      if (raw.roads !== net) { if (net !== null) { book.clear(); generation++; } net = raw.roads; }
      const flip = a.mapId > b.mapId;
      const p = flip ? b : a, q = flip ? a : b;
      const key = `${p.mapId}>${q.mapId}`;
      let way = book.get(key);
      if (way === undefined) {
        if (budget <= 0 && !(spent < spendMs && asked < WAYS_MAX_PER_FRAME)) return undefined;   // PERF-WAYS1: the floor spent, and the frame's time or its cap
        budget--; asked++;
        const t0 = now();
        way = plan({ x: p.px, y: p.py }, { x: q.px, y: q.py }, { roads: raw.roads ?? null, tracks: raw.tracks ?? null, ...ground() }) ?? null;
        spent += now() - t0;
        book.set(key, way);
      }
      if (!way || !flip) return way;
      return { pixels: [...way.pixels].reverse(), kinds: [...(way.kinds ?? [])].reverse() };
    },
    /** A new frame: the asking renewed - `n` pairs at the least, and more while it has taken under `ms` (PERF-WAYS1). */
    frame(n = WAYS_PER_FRAME, ms = WAYS_MS_PER_FRAME) { budget = n; asked = 0; spent = 0; spendMs = ms; },
    /** Bumped each time the network changed under the book (the host's trips are cleared with it). */
    get generation() { return generation; },
    get size() { return book.size; },
  };
}
