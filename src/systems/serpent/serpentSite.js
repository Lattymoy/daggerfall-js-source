// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): WHERE SETHRAKUL RISES - the client's half of
// the site, over the world's own data. Design: bible/11-Multiplayer/Sea-Serpent.md section 3.
//
// IT HUNTS THE PACKET LANES. Its waters are always on one of the world's packet lanes (WW7-12, below - the Bay's
// (systems/naval/seaLanes.js, made from the map files every client holds), the ones past it and across its edge): the
// lanes tried in the order of the day's score of each (net/serpent/serpentLaw.js serpentLaneScore, off its two ends), a
// place along its way's middle stretch rolled by the day and the lane (serpentAlongAt), kept only where the sea is OPEN round it - every map pixel within SITE_CLEAR_PX of the site's is open
// sea (the lanes' own `open` law: the ocean's water, never a lake's) - so its waters are never a strait a carrack cannot
// turn in, nor a fight against a headland. A lane too short, or no open stretch on it, and the next try; SERPENT_LANE_TRIES
// tries and no site is no serpent that day (the omen stays silent rather than naming nowhere).
//
// NAMES. The port its site lies nearer names it in the chat ("off Sentinel"), with the port's province on the omen's
// first line; both ports the lane joins are said on the map's card.
//
// PURE: the lanes, a lane's way and the open law are handed in (scenes/naval/worldLanes.js's `all`, `way` and `open`
// through scenes/world.js - the packets' own), so the pins drive it over a made sea. Not a DFU member. Ledger A (SERPENT1).
//
// WW7-12 (2026-10-26, bible/03-World/World-Wide.md WW7-12; the owner on the serpent staying on the Bay's lanes: "Fucking
// do it"): THE WORLD'S LANES. Its lanes are every lane of the world now (scenes/naval/worldLanes.js `all`: the Bay's, the
// ones past it, the ones across its edge - one list in one order on every game that stands the land past the Bay, once
// its picture and its fit stand: `whole`), the open law the world's lane water (`open`). A game without them (the land
// past the Bay off, or its picture still coming) cannot roll the site: it takes the HUB'S word of where the accounts that
// rolled it agree it lies (`told` - net/serpent/serpentLink.js toldAt, the relay's `at`: serpentHerald.js serpentAtWord),
// and names none till then (worldSerpentSite) - so every game online rises the one serpent at the one site.
import { serpentLaneScore, serpentAlongAt, serpentRing, SERPENT_LANE_TRIES } from '../../net/serpent/serpentLaw.js';
import { worldPixelKey, inWorldGrid } from '../../world/worldWide/worldGrid.js';
import { PIXEL_M } from '../../net/gate/gateLaw.js';
import { PIXEL_UNITS } from '../../net/wire.js'; // native units a map pixel (world/streamingWorld.js NATIVE_PIXEL's)
import { REGION_NAMES } from '../../formats/mapsFile.js';
/** Every map pixel within this of the site's (Chebyshev) is open sea - a mile and more of water on every side. */
export const SITE_CLEAR_PX = 1;
/** The shortest lane a serpent rises on (m): its waters lie in the lane's middle, never a harbour mouth. */
export const SITE_LANE_MIN_M = 6 * PIXEL_M;
/** How far along its way a try may slide from its rolled place looking for open sea, and the step. */
export const SITE_SLIDE = 0.16;
export const SITE_SLIDE_STEP = 0.04;

/** The map pixel a native point stands in (wire.js mapPixelOfWire's arithmetic). */
export const sitePixelOfNative = (x, z) => [Math.floor(x / PIXEL_UNITS), 499 - Math.floor(z / PIXEL_UNITS)]; // WW-C2: floored, as mapPixelOfWire
/** AUDIT TAMRIEL-WIDE E3: a lane's two numbers - its ports' world keys, the same on every client whatever else the list
 *  holds or its order - or null for a port with no pixel. */
export const serpentLaneEnds = (lane) =>
  inWorldGrid(lane?.a?.px, lane?.a?.py) && inWorldGrid(lane?.b?.px, lane?.b?.py)
    ? [worldPixelKey(lane.a.px, lane.a.py), worldPixelKey(lane.b.px, lane.b.py)]
    : null;
/** The lanes a day tries, best first: each scored by its ends (serpentLaneScore), SERPENT_LANE_TRIES of them. A lane
 *  added moves a day only where it scores above the day's site; a tie keeps the list's order. */
export function serpentLaneTries(day, lanes) {
  const scored = [];
  lanes.forEach((lane, i) => {
    const e = serpentLaneEnds(lane);
    if (e) scored.push({ lane, ends: e, score: serpentLaneScore(day, e[0], e[1]), i });
  });
  return scored.sort((p, q) => q.score - p.score || p.i - q.i).slice(0, SERPENT_LANE_TRIES);
}
/** Is every pixel within `r` of (px, py) open sea? */
export function openAround(px, py, open, r = SITE_CLEAR_PX) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!open(px + dx, py + dy)) return false;
  return true;
}
/** The native point a share `k` (0..1) of a way's length along it: `{x, z}`. */
export function pointAlong(way, k) {
  const pts = way.pts;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  let left = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      d = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= d) {
      const t = d > 0 ? left / d : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    left -= d;
  }
  return { x: pts[pts.length - 1].x, z: pts[pts.length - 1].z };
}

/**
 * THE DAY'S SITE, or null: `{day, lane, px, py, sx, sz, near, region, place, between, ring}` - its map pixel, its native
 * point (`sx`, `sz` - what the `in` says, and the fight's frame), the port it lies off and its province, the two ports
 * its lane joins, and the map's ring.
 * @param {number} day
 * @param {{lanes: ReadonlyArray<any>, wayOf: (lane: any) => ({pts: {x: number, z: number}[], len: number}|null), open: (px: number, py: number) => boolean}} sea
 */
export function findSerpentSite(day, { lanes, wayOf, open }) {
  if (!lanes?.length) return null;
  for (const { lane, ends } of serpentLaneTries(day, lanes)) {
    const way = wayOf(lane);
    if (!way || !(way.len >= SITE_LANE_MIN_M) || !(way.pts?.length >= 2)) continue;
    const f = serpentAlongAt(day, ends[0], ends[1]);
    // the rolled place, then outward from it a step at a time each way
    for (let j = 0; j <= Math.round((2 * SITE_SLIDE) / SITE_SLIDE_STEP); j++) {
      const g = f + (j === 0 ? 0 : (j % 2 ? 1 : -1) * Math.ceil(j / 2) * SITE_SLIDE_STEP);
      if (g < 0.15 || g > 0.85) continue;
      const p = pointAlong(way, g);
      const [px, py] = sitePixelOfNative(p.x, p.z);
      if (!openAround(px, py, open)) continue;
      const da = Math.hypot(lane.a.road.x - px, lane.a.road.y - py),
        db = Math.hypot(lane.b.road.x - px, lane.b.road.y - py);
      const port = da <= db ? lane.a : lane.b;
      const near = String(port.name || '') || (REGION_NAMES[port.region] ?? 'the Bay');
      const region = REGION_NAMES[port.region] ?? '';
      return Object.freeze({
        day,
        lane: lane.key,
        px,
        py,
        sx: p.x,
        sz: p.z,
        near,
        region,
        place: region && region !== near ? `${near}, ${region}` : near,
        between: [lane.a.name || null, lane.b.name || null],
        ring: serpentRing(day, p.x, p.z),
      });
    }
  }
  return null;
}

/** WW7-12: THE SITE THE HUB TOLD, as findSerpentSite names one: its pixel and native point, the port it lies off (no
 *  province, no lane - the hub says neither), its ring; `told` - this game rolled none (net/online.js says it no word back).
 *  @param {number} day @param {{sx: number, sz: number, pl: string}} at */
export function siteOfWord(day, { sx, sz, pl }) {
  const [px, py] = sitePixelOfNative(sx, sz);
  return Object.freeze({
    day,
    lane: null,
    px,
    py,
    sx,
    sz,
    near: pl,
    region: '',
    place: pl,
    between: [null, null],
    ring: serpentRing(day, sx, sz),
    told: true,
  });
}

/**
 * WW7-12: THE DAY'S SITE OVER THE WORLD'S LANES, or null - rolled over every lane of the world where this game stands
 * them whole (the lanes' book, scenes/naval/worldLanes.js: `whole()`, then findSerpentSite over `all()` by its `way` and
 * its `open`), else the hub's word of the agreed site (`told(day)`: siteOfWord), else none (asked again - serpentOmen.js
 * SITE_RETRY_MS).
 * @param {number} day
 * @param {{whole: () => boolean, all: () => ReadonlyArray<any>, way: (lane: any) => any, open: (px: number, py: number) => boolean}} lanes
 * @param {(day: number) => ({sx: number, sz: number, pl: string}|null)} told
 */
export function worldSerpentSite(day, lanes, told) {
  if (lanes.whole()) return findSerpentSite(day, { lanes: lanes.all(), wayOf: lanes.way, open: lanes.open });
  const at = told(day);
  return at ? siteOfWord(day, at) : null;
}
