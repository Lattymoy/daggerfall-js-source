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
// A FEW A FRAME. The planner is the host's heaviest pure call (a long way is tens of milliseconds), so a frame asks at
// most WAYS_PER_FRAME new pairs (`frame()` renews it) and a pair not yet asked answers undefined - the trips wait on it.
import { planRoute } from '../travelRoute.js';

/** New pairs asked a frame. */
export const WAYS_PER_FRAME = 2;

/**
 * @typedef {{ pixels: { x: number, y: number }[], kinds?: string[] }} WayPlan
 * @param {{ roads: () => ({ roads: any, tracks: any } | null), ground: () => object, plan?: typeof planRoute }} deps -
 *   `roads` the drawn network (null until it is built); `ground` the planner's ground (travelRoute.js routeGround's)
 */
export function createWayBook({ roads, ground, plan = planRoute }) {
  /** @type {Map<string, WayPlan|null>} */
  const book = new Map();
  let budget = WAYS_PER_FRAME;
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
        if (budget <= 0) return undefined;
        budget--;
        way = plan({ x: p.px, y: p.py }, { x: q.px, y: q.py }, { roads: raw.roads ?? null, tracks: raw.tracks ?? null, ...ground() }) ?? null;
        book.set(key, way);
      }
      if (!way || !flip) return way;
      return { pixels: [...way.pixels].reverse(), kinds: [...(way.kinds ?? [])].reverse() };
    },
    /** A new frame: the asking renewed. */
    frame(n = WAYS_PER_FRAME) { budget = n; },
    /** Bumped each time the network changed under the book (the host's trips are cleared with it). */
    get generation() { return generation; },
    get size() { return book.size; },
  };
}
