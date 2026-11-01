// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV2 - THE ROAD PLANNER (bible/06-Systems/Travel-View.md).
//
// Mac's call: a click on a town or a marker is reached BY THE ROADS. The
// roads are Hazelnut's - Basic Roads' four arrays, one byte a map pixel,
// a bit for each edge a path leaves through (systems/travel/travelPaths.js's
// compass, world/road/roadNetwork.js's DIR, one law) - the very bytes Travel
// Options' own follow key walks. A step from pixel A to its neighbour B
// is ON the road only when A's byte carries the edge toward B and B's
// carries the edge back: two roads side by side are not one road.
//
// A* over the 1000x500 pixel grid, 8-connected: a road step costs 1, a
// track 1.6, the open ground between 3.5 (x sqrt 2 on a diagonal), and
// the sea is refused - a route never swims (the traveller could, and
// Travel Options stops a journey at the ocean's climate anyway). So a
// town two pixels off across a field is walked to across the field, and
// one six pixels off round a hill is reached by the road round it.
//
// NOT world/road/roadNetwork.js's route(): that one LAYS roads (it prices
// climbing and prefers the roads it already laid), this one WALKS them,
// and a third copy of either law is what AUDIT 68 exists to stop. Both
// read DIR_DELTA, so the compass is still one table.
//
// PURE: arrays in, pixels out. The legs a journey walks come out of
// `routeLegs`, which folds a straight run of steps into one leg so the
// autopilot aims down the road rather than at every pixel's middle.
//
// OWS2 (2026-09-28, the player's ask: "You should transition to your boat
// if traveling across water then back onto land when hitting land"): THE
// CROSSING. Given `sea` - the traveller has a boat (at its helm, moored in
// reach, or packed in the pack) - the search walks three layers of the
// grid: ashore with the boat to hand, afloat, and ashore with it left
// behind. A step from a land pixel into the water LAUNCHES the boat
// ('embark'), steps between water pixels are sailed ('sea'), and a step
// out of the water onto land is the LANDFALL ('landfall') - back to hand
// when the boat packs (`again`), else left where it landed. Without `sea`
// the one layer is the law above, unchanged: the sea refused.
// ═══════════════════════════════════════════════════════════════════
import { DIR_DELTA, MAP_W, MAP_H } from '../../world/road/roadNetwork.js';
import {
  arenaRoadByte,
  arenaRoadsLayer,
  arenaRoadsVersion,
  JOIN_DEPTH,
  beyondKey,
  beyondPixel,
} from '../../world/arenaRoads.js'; // VOYAGER2.1: the roads past the Bay, walked as roads
import { tamrielLandVersion } from '../../world/tamriel/tamrielLand.js'; // AUDIT RELEASE R1-2: the ground past the table kept a land
import { tamrielFit } from '../../world/tamriel/tamrielFrame.js';
import { apartPastBay, apartExact } from './landPieces.js'; // FAST-REFUSAL: the land's pieces past the Bay; EXACT-PIECES: at the pixel
import { roadLineLegs } from './roadLine.js'; // ROAD-FOLLOW: a road past the Bay walked and drawn on its curves
import { ghostfenceShuts } from '../../world/tamriel/ghostfence.js';
import { inEther, ETHER_BOX } from '../../world/ethericSea.js'; // the Veil crossed by the crossing alone
import { SCALED_OCEAN_ELEVATION, BASE_HEIGHT_SCALE } from '../../world/terrain/terrainSampler.js'; // the sea's own height
import { mendSeaLegs } from './seaLegsMend.js'; // a sailed leg round the kernel's land // AUDIT RED-MOUNTAIN G2: the Ghostfence crossed only at Ghostgate

/** What a step costs, by what it walks on. The open ground's 3.5 makes a road worth a detour of up to three and a half
 *  times its length - Travel Options' reckless (road) and cautious (open) multipliers are 1 and 0.8 by default, so the
 *  road is also the faster walk. ROAD-FOLLOW: TV2's cost law where no road joins a plan's two ends (and FREE's); where
 *  one does, the plan keeps to the roads whatever their detour (roadEndsSteps). */
export const ROUTE_COST = Object.freeze({ road: 1, track: 1.6, open: 3.5 });
/** OWS2: what a crossing's steps cost - a step sailed (`sea`, x sqrt 2 on a diagonal), one into a water pixel with
 *  land about it (`coast`: the route keeps off the shore where the sea is wide, and still threads a strait), and the
 *  launch's or the landfall's own (`shore`, on top of its step: the boat put in or taken out - so no route hops in and
 *  out of the water to save a step). A sailed step costs little more than a road's: the boat makes its way about as
 *  fast as the road walks, and the heuristic's road cost stays under every step (admissible). */
export const SEA_COST = Object.freeze({ sea: 1.2, coast: 1.5, shore: 6 });
/** a byte over this stands over the sea in the ground the game builds (the sea at 3.4, the beach to
 *  WATER_BYTE): in the Eltheric Ocean the planner reads it as land (routeGround) - an isle stood a pixel past its last land
 *  byte, and every approach to it ran over its beach. */
export const DEEP_BYTE = Math.floor(SCALED_OCEAN_ELEVATION / BASE_HEIGHT_SCALE);
/** the kernel's sea and the planner's water at a map pixel the host registers (setSeaLegKernel), with
 *  which routeLegs mends a journey's sailed legs round the kernel's land (seaLegsMend.js); none: the legs as planned. */
let _legKernel = null,
  _legWater = null;
/** @param {((x: number, z: number) => boolean) | null} kernel @param {((px: number, py: number) => boolean) | null} waterPx */
export function setSeaLegKernel(kernel, waterPx) {
  _legKernel = kernel;
  _legWater = waterPx;
}
/** OWS2: the kinds a crossing's steps are. */
export const SEA_KINDS = Object.freeze(['sea', 'embark', 'landfall']);
/** PASSAGE (AUDIT PASSAGE A1, bible/03-World/Passage.md): a booked voyage (`sea.voyage`) comes ashore only this near its
 *  goal (map pixels, the longest axis) - the port's own roadstead, as far as SEA-LANES finds one from its town
 *  (systems/naval/seaLanes.js ROADSTEAD_PX, pinned equal) - so a coast road is never the cheaper way to the port a passenger
 *  paid to sail to. */
export const VOYAGE_LANDFALL_PX = 3;
/** OWS2: the search's layers - ashore with the boat to hand, afloat, ashore with it left behind (the one layer without
 *  `sea` is the last's law: no launch). */
const ASHORE = 0,
  AFLOAT = 1,
  LEFT = 2;
/** OW-MOUNTAINS (2026-09-28, Mac: "Bumping into a mountain can cause insane lag and cause you to take character damage. You
 *  shouldnt be able to navigate mountains"): the open ground a journey never crosses - a pixel of the Mountain climate
 *  (MapsFile.Climates.Mountain), or a step whose ground rises or falls more than TV_STEEP_RISE between two pixels (the
 *  small heightmap's own units, world/road/roadNetwork.js's ROAD_DIALS scale). A road or a track goes where it goes: the
 *  roads were laid over the passes. */
export const TV_MOUNTAIN_CLIMATE = 226;
export const TV_STEEP_RISE = 16;
/** Whether an open step from pixel a to pixel b is refused (the host's climate and height reads).
 *  AUDIT OW3 J5: A STEP INTO THE RANGE IS ALWAYS REFUSED - a one-pixel ridge beside the start is not crossed, and no route
 *  leads anyone in. AUDIT OW4 J1: AND ONLY THE TRAVELLER'S OWN PEAKS ARE LEFT FREELY (`leaving`: the step starts in the
 *  start's own connected Mountain area, planRoute's flood fill). OW3 J5 freed EVERY step out of EVERY Mountain pixel, so
 *  a route that entered a range by a road (a dead end, a pass) walked on across it peak to peak - 15 open mountain steps
 *  over a 21x101 block, and down its edge with no steep test: Mac's lag and fall again. Inside the start's own range
 *  every step is walked (every step there is steep - refusing them is a traveller who can never leave); every other
 *  step is the ground's: into the peaks refused, a steep rise refused. */
export function openStepBlocked(climateAt, heightAt, ax, ay, bx, by, leaving = false) {
  return false; // MOUNTAINS WALKABLE: no peak and no steep rise refuses a step on foot
}

/**
 * AUDIT OW4 J3: THE GROUND, READ ONCE. The host handed the planner closures that read the climate and the small
 * heightmap through the map files and made two new closures on every open neighbour asked (tvOpenBlocked), and the sea
 * through a third. Both maps are the world's own, fixed for the session, so they are copied here into two byte tables
 * once, and the planner's questions - the sea, the peaks' law (openStepBlocked, the one law), whether a pixel is a peak
 * (the start's own range, J1) - read the tables. Measured on the real map (AUDIT OW4's probe) the reads were never the
 * cost - the search is - so the costly click is answered here too: `apart`, THE LAND'S PIECES. A pick with no way by
 * land (High Rock to Hammerfell: the bay between, the peaks round its head) searched every box to the whole map before
 * it said so, ~70-380 ms; the pieces the step law joins (stepKind, folded once a session and per road network, ~0.15 s,
 * the first time a pick misses its first box) say it at once. `climateAt`/`heightAt` the host's reads; `waterByte` the
 * heightmap's shore (world/roadsProducer.js WATER_BYTE).
 * TV-BEYOND (2026-10-09): `beyond(x, y)` - the host's - answers whether a pixel PAST the table is dry ground (TAMRIEL2's
 * land beyond the Bay, where the world streams it); without it, off the table is the sea, DFU's empty edge of the world.
 * Its answers are kept (BEYOND_CACHE_MAX, dropped whole): the ground past the Bay costs a province test a pixel.
 * @param {(x:number, y:number) => number} climateAt
 * @param {(x:number, y:number) => number} heightAt
 * @param {number} waterByte
 * @param {number} [width]
 * @param {number} [height]
 * @param {((x:number, y:number) => boolean)|null} [beyond]
 * @param {any} [pathsBeyond]
 * @param {((x:number, y:number) => boolean)|null} [seaAlso] RUMARE-WATER: water a boat sails that no step on foot is refused
 *   (world/rumareWaters.js rumareSeaPixel - the Imperial City's lake, its isle's way by Talos Bridge walked as the city's
 *   streets): the sea lanes' (`seaWater`), never the land's
 */
export function routeGround(
  climateAt,
  heightAt,
  waterByte,
  width = MAP_W,
  height = MAP_H,
  beyond = null,
  pathsBeyond = arenaRoadByte,
  seaAlso = null,
) {
  const climate = new Uint8Array(width * height),
    heights = new Uint8Array(width * height);
  // OW-WOD-PATH: the World of Daggerfall massifs (WodWorld mountainPixels), one byte a pixel - set by the host when the
  // mod's list is read or grows (setRocks), null while it stands none
  let rocks = null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      climate[y * width + x] = climateAt(x, y);
      heights[y * width + x] = heightAt(x, y);
    }
  }
  const climateOf = (x, y) => climate[y * width + x];
  const heightOf = (x, y) => heights[y * width + x];
  /** @type {Map<number, boolean>} */
  const dryBeyond = new Map();
  // AUDIT RELEASE R1-2: the answers past the table are the land's that stood when they were asked - the trace, its relief
  // and the fit land after the boot (world/tamriel/tamrielLand.js tamrielLandVersion, tamrielFit), and a host keeps one
  // ground a session (scenes/world.js tvRouteGround, scenes/livingWorld/livingTrips.js) - so they are dropped when either
  // moves, and `isWater` is another function then: the sea lanes' kept water (planSeaLanes' _laneGround) is keyed by it.
  const memoMoved = landWatch(),
    waterMoved = landWatch();
  const beyondDry = (x, y) => {
    if (!beyond) return false;
    if (memoMoved()) dryBeyond.clear();
    const k = beyondKey(x, y); // ROAD-BEYOND: a number, not a string a pixel - the plan past the Bay asks it at every step
    let dry = dryBeyond.get(k);
    if (dry === undefined) {
      if (dryBeyond.size >= BEYOND_CACHE_MAX) dryBeyond.clear();
      dry = !!beyond(x, y) || (inEther(x, y) && heightAt(x, y) > DEEP_BYTE); // an isle's beach its land
      dryBeyond.set(k, dry);
    }
    return dry;
  };
  const waterOn = () => (x, y) =>
    x < 0 || y < 0 || x >= width || y >= height ? !beyondDry(x, y) : heights[y * width + x] <= waterByte;
  let isWater = waterOn();
  /** RUMARE-WATER: the sea lanes' water, made once a water. @type {any} */
  let seaFor = null,
    seaFn = null;
  /** AUDIT RELEASE R1-2: the water as the land stands now - a new function when the land past the table has moved. */
  const waterNow = () => {
    if (beyond && waterMoved()) isWater = waterOn();
    return isWater;
  };
  // OW-WOD-PATH: an open step into a massif's pixel is refused as one into the Mountain climate is - and the start's own
  // massif is left freely, as its own peaks are (AUDIT OW4 J1: `leaving`, the flood fill over peakAt)
  const openBlocked = (_ax, _ay, bx, by) => ghostfenceShuts(bx, by); // MOUNTAINS WALKABLE; AUDIT RED-MOUNTAIN G2: the fence's line is not
  const peak = (_x, _y) => false; // MOUNTAINS WALKABLE: no pixel is a peak, so "the mountains cannot be crossed" never fires
  // THE PIECES: two neighbours joined where the step law (an ordinary step - no goal's exemption, no start's peaks, roads
  // and tracks included) walks from one that can be ENTERED to the other. A pixel no ordinary step enters - the sea, a
  // peak no road reaches - is only ever a route's start, so its steps out join nothing (a one-pixel ridge is left down
  // either side, and joined the two). A route from a start that is no peak takes ordinary steps from the pixel after the
  // start to the one before the goal, each out of a pixel just entered: all in one piece, beside the start and the goal
  let land = null;
  const pieces = (roads, tracks) => {
    if (land && land.roads === roads && land.tracks === tracks) return land.root;
    const n = width * height,
      out = new Uint8Array(n),
      entered = new Uint8Array(n),
      root = new Int32Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (const [bit, dx, dy] of DIR_DELTA) {
          const bx = x + dx,
            by = y + dy;
          if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
          if (stepKind(x, y, bx, by, bit, width, height, roads, tracks, isWater, openBlocked, 0, false) < 0) continue;
          out[y * width + x] |= bit;
          entered[by * width + bx] = 1;
        }
      }
    }
    for (let i = 0; i < n; i++) root[i] = i;
    const find = (i) => {
      while (root[i] !== i) {
        root[i] = root[root[i]];
        i = root[i];
      }
      return i;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = y * width + x;
        for (const [bit, dx, dy] of HALF_COMPASS) {
          const bx = x + dx,
            by = y + dy;
          if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
          const b = by * width + bx;
          if (!((entered[a] && out[a] & bit) || (entered[b] && out[b] & BACK_BIT[bit]))) continue;
          const ra = find(a),
            rb = find(b);
          if (ra !== rb) root[ra] = rb;
        }
      }
    }
    for (let i = 0; i < n; i++) root[i] = find(i);
    land = { roads, tracks, root };
    return root;
  };
  const onTable = (p) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;
  return {
    /** The water (AUDIT RELEASE R1-2: as the land past the table stands now - a host's spread, `...ground`, reads it at
     *  each plan). */
    get isWater() {
      return waterNow();
    },
    /** RUMARE-WATER: the sea a boat sails - the water, and `seaAlso`'s (planSeaLanes' own; one function a water, so its
     *  kept lanes are kept by it). */
    get seaWater() {
      const w = waterNow();
      if (!seaAlso) return w;
      if (seaFor !== w) {
        seaFor = w;
        seaFn = (x, y) => w(x, y) || seaAlso(x, y);
      }
      return seaFn;
    },
    /** VOYAGER2.1: the roads past the Bay (world/arenaRoads.js's installed layer - `kind` 'roads', 'tracks' or 'join'),
     *  which the planner walks as roads where it is handed the Bay's (planRoute `pathsBeyond`) - none while no layer is
     *  installed (the reader read nothing there and cost a long route past the table a fifth more), as the host's spread
     *  (`...tvRouteGround()`) asks it at each plan. */
    get pathsBeyond() {
      return pathsBeyond === arenaRoadByte && !arenaRoadsLayer() ? null : pathsBeyond;
    },
    /** ROAD-GRAPH: the roads' graph searchByRoad keeps between plans (planRoute `roadKeep`) - this ground's, so it goes
     *  with the ground the host lets go. */
    roadKeep: { graph: null },
    peakAt: peak,
    openBlocked,
    /** FIRST-VISIT: what the pieces are folded from, for their stamp (systems/travel/landPiecesKept.js). */
    pieceInputs: () => ({ climate, heights, waterByte, width, height }),
    /** FIRST-VISIT: the pieces over this network - folded now when they are not held. */
    landPieces: (roads, tracks) => pieces(roads, tracks),
    /** FIRST-VISIT: pieces folded on another launch over the same inputs (landPiecesKept.js checked them), held as folded here. */
    adoptPieces(roads, tracks, root) {
      if (root?.length === width * height) land = { roads, tracks, root };
    },
    /** OW-WOD-PATH: the massifs' table (width x height bytes, 1 a massif's pixel) or null - the land's pieces folded again. */
    setRocks(table) {
      if (table === rocks) return;
      rocks = table;
      land = null;
    },
    /** No way by land: no piece beside (or under) the start is one beside (or under) the goal. Never said from among the
     *  peaks (the start's own range is walked freely - the search answers). */
    apart: (from, to, { roads = null, tracks = null } = {}) => {
      if (peak(from.x, from.y)) return false;
      // TV-BEYOND: an end past the table is in no piece - the pieces are the Bay's - so the search answers it
      if (!onTable(from) || !onTable(to)) return false;
      const root = pieces(roads, tracks);
      const about = (p) => {
        const set = new Set();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = p.x + dx,
              y = p.y + dy;
            if (x >= 0 && y >= 0 && x < width && y < height) set.add(root[y * width + x]);
          }
        }
        return set;
      };
      const mine = about(from);
      for (const piece of about(to)) if (mine.has(piece)) return false;
      return true;
    },
  };
}

/** The search's box about the two ends, widened in turn until a route is found. Pixels. AUDIT OW4 J3: the last rung is
 *  the whole map - a range wider than the 60-pixel box (an 11x251 one needs ~200 to be gone round; on the real map a pick
 *  from the west of the bay's head to the east of it, round the eastern ranges) answered "no way by land". */
export const ROUTE_MARGINS = Object.freeze([6, 20, 60, MAP_W]);
/** The most cells one search may expand before it gives up - a guard, never reached by a route the view can show. */
export const ROUTE_MAX_EXPANSIONS = 200000;
/** AUDIT RELEASE R1-2: a watch on the land past the table - true at its first ask and whenever the land's version or the
 *  fit has moved since its last. */
function landWatch() {
  let v0 = -1,
    f0 = /** @type {any} */ (undefined);
  return () => {
    const v = tamrielLandVersion(),
      f = tamrielFit();
    if (v === v0 && f === f0) return false;
    v0 = v;
    f0 = f;
    return true;
  };
}
/** TV-BEYOND: the most answers about the ground past the table routeGround keeps before it drops them all. */
export const BEYOND_CACHE_MAX = 1 << 18; // ROAD-BEYOND: a long plan past the Bay asks some hundred thousand

/** The edge back: N<->S, NE<->SW, E<->W, SE<->NW. */
export const OPPOSITE_BIT = Object.freeze({ 128: 8, 64: 4, 32: 2, 16: 1, 8: 128, 4: 64, 2: 32, 1: 16 });

/** AUDIT OW4 J3: the edge back as a table (the search's hot loop read the frozen object at every neighbour). */
const BACK_BIT = new Uint8Array(256);
for (const [bit, back] of Object.entries(OPPOSITE_BIT)) BACK_BIT[Number(bit)] = back;
/** The compass unpacked for the hot loop (roadNetwork's DIR_DELTA, one table), and its half: each pair of neighbours once. */
const STEP_BIT = DIR_DELTA.map(([bit]) => bit),
  STEP_DX = DIR_DELTA.map(([, dx]) => dx),
  STEP_DY = DIR_DELTA.map(([, , dy]) => dy);
const HALF_COMPASS = DIR_DELTA.filter(([, dx, dy]) => dy > 0 || (dy === 0 && dx > 0));
const KIND_NAMES = ['road', 'track', 'open'];
/** THE MERGE (OW4 x OWS2): a state's step kinds - the land's three (stepKind's), then the crossing's. */
const STEP_NAMES = ['road', 'track', 'open', 'sea', 'embark', 'landfall'];
const KIND_COST = [ROUTE_COST.road, ROUTE_COST.track, ROUTE_COST.open];

/** The kind a step from cell `a` to cell `b` through edge `bit` walks on: 0 a road, 1 a track, 2 the open ground. */
function edgeKindAt(a, b, bit, roads, tracks) {
  const back = BACK_BIT[bit];
  if (roads && roads[a] & bit && roads[b] & back) return 0;
  if (tracks && tracks[a] & bit && tracks[b] & back) return 1;
  return 2;
}
/**
 * What a step from cell `a` to cell `b` through edge `bit` walks on: 'road', 'track' or 'open'.
 * @param {ArrayLike<number>|null} roads
 * @param {ArrayLike<number>|null} tracks
 */
export function edgeKind(a, b, bit, roads, tracks) {
  return KIND_NAMES[edgeKindAt(a, b, bit, roads, tracks)];
}

/**
 * RPT1026-WORLD CAUSEWAY (a private report, 2026-10-26, on Tulune's Grayidge-Westwall road: on the bridge the guide
 * turned off it and left the traveller stuck in the water): A ROAD OVER THE WATER IS THE ROAD'S. Hazelnut's road
 * crosses 42 pixels the step law called the sea (WOODS bytes at the beach line, roadsProducer's WATER_BYTE) - the
 * Grayidge inlet's (72, 131), one at (324, 205) and the forty of a causeway at (515-559, 296-316) - and his painter
 * paves water under a road (roadPainter.js ROAD_TILES, column 0: tile 46, no water corner), so each is a dry strip of
 * road tiles with the water either side (the inlet's: 256 tiles, two wide, its ground at or over the ocean's
 * elevation). The step law refused them, so a route along the road left it at the causeway's foot and went round by
 * the open pixel beside - from Grayidge's road in (72, 132) to (73, 131) across the inlet's east arm, into the water
 * the causeway stands in. A step ON a road (both ends carrying the edge) is taken onto a water pixel and through a
 * corner of it. A track is not: his track table paints water over it (TRACK_TILES column 0 - a ford). Travel Options'
 * follow key walks the bytes whatever the ground under them. OWN-WORK2: the port's own network lays no road on the sea.
 */
function pavedStep(ax, ay, bx, by, bit, width, height, roads) {
  if (!roads || ax < 0 || ay < 0 || bx < 0 || by < 0 || ax >= width || ay >= height || bx >= width || by >= height)
    return false;
  return edgeKindAt(ay * width + ax, by * width + bx, bit, roads, null) === 0;
}

/**
 * AUDIT OW4 J3: THE STEP LAW, ONE HOME - the search walks it, routeGround's pieces fold it: the kind of ground (0 a road,
 * 1 a track, 2 open) a step from (ax, ay) to its neighbour (bx, by) through edge `bit` walks on, or -1 where it is
 * refused. `goal`: 0 an ordinary step; 1 onto the goal (the sea not asked - the traveller may ask for the shore); 2 onto
 * an exempt goal (a place: nor the peaks' law). `leaving`: the step starts in the start's own peaks (AUDIT OW4 J1).
 * VOYAGER2.1: `beyond` (planRoute's `pathsBeyond`, null for none) - the roads past the Bay's table.
 */
function stepKind(
  ax,
  ay,
  bx,
  by,
  bit,
  width,
  height,
  roads,
  tracks,
  isWater,
  openBlocked,
  goal,
  leaving,
  beyond = null,
) {
  // RPT1026-WORLD CAUSEWAY: a road's own step is ground - asked only where the sea would refuse it (pavedStep)
  if (goal === 0 && isWater(bx, by) && !pavedStep(ax, ay, bx, by, bit, width, height, roads)) return -1;
  // AUDIT DEEP T2-5: nor through a corner of the sea - a diagonal between two water pixels is a swim (the roads' own
  // ROADS 6, whose stricter half would refuse a coast road's own diagonal)
  if (
    ax !== bx &&
    ay !== by &&
    isWater(bx, ay) &&
    isWater(ax, by) &&
    !pavedStep(ax, ay, bx, by, bit, width, height, roads)
  )
    return -1;
  const kind = pathKind(ax, ay, bx, by, bit, width, height, roads, tracks, beyond);
  // OW-MOUNTAINS; AUDIT OW3 J5: no step out of the start is exempt (a ridge beside it was crossed on the exempt step), and
  // the step onto the goal only for a place (`goalExempt`) - a spot's is asked (a plateau's cliff was walked straight up);
  // AUDIT OW4 J1: `leaving` only out of the start's own peaks - never out of a range a road led into
  if (kind === 2 && goal !== 2 && openBlocked && openBlocked(ax, ay, bx, by, leaving)) return -1;
  return kind;
}

/** What a step walks on, refusing none (stepKind's own, ROAD-FOLLOW's roadEnds' too): 0 a road, 1 a track, 2 the open
 *  ground. */
function pathKind(ax, ay, bx, by, bit, width, height, roads, tracks, beyond) {
  // TV-BEYOND: past the table there is no road's byte of the Bay's - VOYAGER2.1: the roads past the Bay's are its own
  // (a step onto them, or off the Bay along a crossing's join, a road's or a track's as on the Bay), else the open ground
  const off = ax < 0 || ay < 0 || bx < 0 || by < 0 || ax >= width || ay >= height || bx >= width || by >= height;
  return beyond && (off || nearEdge(ax, ay, width, height) || nearEdge(bx, by, width, height))
    ? beyondKind(ax, ay, bx, by, bit, width, height, roads, tracks, beyond)
    : off
      ? 2
      : edgeKindAt(ay * width + ax, by * width + bx, bit, roads, tracks);
}

/** VOYAGER2.1: is a pixel within a crossing's join of the table's edge (world/arenaRoads.js JOIN_DEPTH) - or past it. */
const nearEdge = (x, y, width, height) =>
  x <= JOIN_DEPTH || y <= JOIN_DEPTH || x >= width - 1 - JOIN_DEPTH || y >= height - 1 - JOIN_DEPTH;
/** VOYAGER2.1: a pixel's road or track byte - on the table the Bay's own (a road's with a crossing's join on it, TESA5),
 *  past it the roads past the Bay's (`beyond`, the layer's reader). */
function pathByte(kind, x, y, width, height, arr, beyond) {
  if (x >= 0 && y >= 0 && x < width && y < height)
    return (arr ? arr[y * width + x] : 0) | (kind === 'roads' ? beyond('join', x, y) : 0);
  return beyond(kind, x, y);
}
/** VOYAGER2.1: edgeKindAt's law on the roads past the Bay - a road where both ends carry the step, else a track, else the
 *  open ground. */
function beyondKind(ax, ay, bx, by, bit, width, height, roads, tracks, beyond) {
  const back = BACK_BIT[bit];
  if (
    pathByte('roads', ax, ay, width, height, roads, beyond) & bit &&
    pathByte('roads', bx, by, width, height, roads, beyond) & back
  )
    return 0;
  if (
    pathByte('tracks', ax, ay, width, height, tracks, beyond) & bit &&
    pathByte('tracks', bx, by, width, height, tracks, beyond) & back
  )
    return 1;
  return 2;
}

/** A binary heap of [priority, value] - the open set. */
class Heap {
  constructor() {
    this.p = [];
    this.v = [];
  }
  get size() {
    return this.p.length;
  }
  push(pri, val) {
    const p = this.p,
      v = this.v;
    let i = p.length;
    p.push(pri);
    v.push(val);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= pri) break;
      p[i] = p[j];
      v[i] = v[j];
      i = j;
    }
    p[i] = pri;
    v[i] = val;
  }
  pop() {
    const p = this.p,
      v = this.v;
    const top = v[0];
    const lp = p.pop(),
      lv = v.pop();
    if (p.length) {
      let i = 0;
      const n = p.length;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i,
          mp = lp;
        if (l < n && p[l] < mp) {
          m = l;
          mp = p[l];
        }
        if (r < n && p[r] < mp) {
          m = r;
          mp = p[r];
        }
        if (m === i) break;
        p[i] = p[m];
        v[i] = v[m];
        i = m;
      }
      p[i] = lp;
      v[i] = lv;
    }
    return top;
  }
}

/**
 * THE ROUTE from pixel `from` to pixel `to`, both ends included, or null when the sea (or the search's guard) leaves
 * none. `isWater(x, y)` refuses a pixel - never the two ends, which the traveller already stands on or asked for.
 * OWS2: `sea` puts the boat in the search - `start` 'sea' when the traveller is afloat already (at the helm), 'land'
 * with the boat to hand ashore; `again` when a landfall packs it (it launches again later); `goal` 'sea' when the end
 * is a spot on the water (reached afloat), 'land' when it is ashore (the default); PASSAGE: `voyage` a booked passage's -
 * its landfall only within VOYAGE_LANDFALL_PX of the goal.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {{ roads?: ArrayLike<number>|null, tracks?: ArrayLike<number>|null, isWater?: (x:number,y:number)=>boolean,
 *   width?: number, height?: number, margins?: readonly number[], maxExpansions?: number,
 *   openBlocked?: ((ax:number, ay:number, bx:number, by:number, leaving?:boolean) => boolean)|null, goalExempt?: boolean,
 *   peakAt?: ((x:number, y:number) => boolean)|null,
 *   apart?: ((from:{x:number,y:number}, to:{x:number,y:number}, net:{roads:any, tracks:any}) => boolean)|null,
 *   sea?: { start: 'land'|'sea', again?: boolean, goal?: 'land'|'sea', voyage?: boolean } | null, lanes?: boolean,
 *   endPad?: number, pathsBeyond?: ((kind: string, x: number, y: number) => number)|null, tally?: { n: number }, costLaw?: boolean, roadKeep?: { graph: any }|null }} [opts] - VOYAGER2.1: `pathsBeyond` the
 *   roads past the Bay's reader (routeGround's), walked where `roads` or `tracks` is handed;
 *   `openBlocked`: an OPEN step refused (OW-MOUNTAINS) - never a road's or a track's; AUDIT OW3 J5: asked of the step out
 *   of the start too, and of the step onto the goal unless `goalExempt` (a place: a town among the peaks is reached; a
 *   spot is not - false, the cliff up to a plateau refused). AUDIT OW4 J1: told `leaving` - the step starts in the
 *   start's OWN connected Mountain area (`peakAt`, flood-filled from `from` in each box) - so a traveller among the
 *   peaks walks out of them, and a route that came into another range by a road walks no further in it. AUDIT OW4 J3:
 *   `apart` (routeGround's, with its own `isWater` and `openBlocked`) answers a pick with no way by land once the first
 *   box has none (never with a boat in the search - the land's pieces know nothing of the sea: THE MERGE). LONG-VOYAGE:
 *   `lanes` false keeps the sea lanes out (planSeaLanes' own last leg asks so); AUDIT STARTS V4: `endPad` how far the
 *   bounds reach past an end beyond the map (the lanes' landfall: the shore past a port's own row and column).
 *   ROAD-FOLLOW: handed `roads` or `tracks`, the plan keeps to them wherever they join its ends, the open ground on each
 *   end's own leg alone (roadEndsSteps); `costLaw` true walks TV2's cost law instead (the plan's own fallback where they
 *   join nowhere its boxes reach)
 * @returns {{ pixels: {x:number,y:number}[], cost: number, kinds: string[] } | null}
 */
export function planRoute(from, to, opts = {}) {
  return drainPlan(planRouteSteps(from, to, opts));
}

/** PLAN-SLICES (Travel-View.md PLAN-SLICES): a plan's work run to its end in one call - the one law every sliced plan is
 *  the same as, cell for cell. @template T @param {Generator<void, T, void>} it @returns {T} */
export function drainPlan(it) {
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
/** PLAN-SLICES: how many cells a plan's search expands between two of its yields - its slices are cut at these. */
export const PLAN_YIELD_CELLS = 1024;

/**
 * PLAN-SLICES: planRoute's own body, a GENERATOR - it yields every PLAN_YIELD_CELLS cells its searches expand (the box's,
 * the roads', the sea lanes' and their floods), so a host may run it a budget of cells a frame
 * (systems/travel/planSlices.js) and have, at its end, the very plan planRoute answers.
 * @param {{x:number,y:number}} from @param {{x:number,y:number}} to @param {Parameters<typeof planRoute>[2]} [opts]
 * @returns {Generator<void, ReturnType<typeof planRoute>, void>}
 */
export function* planRouteSteps(from, to, opts = {}) {
  // THE VEIL IS CROSSED BY THE CROSSING ALONE (systems/naval/etherCrossing.js) - a plan with one end in
  // the Eltheric Ocean's box and one out of it is none: Veilhaven's helm to Daggerfall sailed one leg of 3,466 pixels, 2,607
  // of them over sea no ground streams. With both ends in it, its boxes keep to it (`ether`, below).
  if (from && to && inEther(from.x, from.y) !== inEther(to.x, to.y)) return null;
  // A BOAT TO HAND ASHORE WITH AN END PAST THE BAY'S TABLE also walks to the nearest shore and sails the
  // sea lanes from it (shoreLanesSteps) - the lanes were asked from a helm alone, and the box's search with the boat spent
  // its count (Rihad to Woodhearth, Wayrest to Northpoint: no plan). The cheaper of that and the box's plan is the plan.
  const sea0 = opts.sea,
    offT = (/** @type {{ x: number, y: number }} */ p) =>
      p.x < 0 || p.y < 0 || p.x >= (opts.width ?? MAP_W) || p.y >= (opts.height ?? MAP_H);
  if (
    (opts.lanes ?? true) &&
    from &&
    to &&
    sea0?.start === 'land' &&
    sea0.goal !== 'sea' &&
    !sea0.voyage &&
    !opts.costLaw &&
    (offT(from) || offT(to))
  ) {
    const viaLanes = yield* shoreLanesSteps(from, to, opts);
    const boxed = yield* planRouteSteps(from, to, { ...opts, lanes: false });
    return viaLanes && (!boxed || viaLanes.cost < boxed.cost) ? viaLanes : boxed;
  }
  const {
    roads = null,
    tracks = null,
    isWater = () => false,
    width = MAP_W,
    height = MAP_H,
    margins = ROUTE_MARGINS,
    maxExpansions = ROUTE_MAX_EXPANSIONS,
    openBlocked = null,
    goalExempt = true,
    peakAt = null,
    apart = null,
    sea = null,
    lanes = true,
    endPad = 0,
    pathsBeyond = null,
  } = opts;
  // VOYAGER2.1: the roads past the Bay are walked as roads where the planner is handed the Bay's (the ROADS mode's net) -
  // FREE, handed none, walks across country there too
  const beyond = roads || tracks ? pathsBeyond : null;
  if (!from || !to) return null;
  const ether = inEther(from.x, from.y); // both ends in the box, or neither (above)
  if (from.x === to.x && from.y === to.y && !(sea && (sea.start === 'sea') !== (sea.goal === 'sea')))
    return { pixels: [{ x: from.x, y: from.y }], cost: 0, kinds: [] };
  // LONG-VOYAGE (START2, bible/06-Systems/Travel-View.md "LONG-VOYAGE"): A CROSSING FROM A HELM WITH AN END PAST THE BAY'S
  // TABLE SAILS THE SEA LANES (planSeaLanes) - the box below never leaves the map and its two ends, and a port past the
  // Bay lies round a province from the Bay's: Winterhold's way to Daggerfall is round all of High Rock. AUDIT STARTS V6:
  // any helm's crossing, not a booked voyage's alone - the box's ladder took 2 to 17 s to sail one the lanes sail in a
  // fifth of one. V5: a lane the first box holds none of is asked once more over a wider one (north to south round a
  // province: Solitude's to Haven). V4: and a booked voyage the lanes cannot sail is no voyage - the box below never
  // sails round a province, and its whole map's rung froze the page for seconds before it said so.
  const offTable = (p) => p.x < 0 || p.y < 0 || p.x >= width || p.y >= height;
  if (lanes && sea?.start === 'sea' && (offTable(from) || offTable(to))) {
    const sailed =
      (yield* planSeaLanesSteps(from, to, opts)) ??
      (yield* planSeaLanesSteps(from, to, { ...opts, laneMargin: LANE_MARGIN_WIDE }));
    if (sailed || sea.voyage) return sailed;
  }
  // AUDIT DEEP2 B-6: A ROUTE FOUND IN A BOX IS KEPT ONLY WHEN NONE OUTSIDE IT COULD BE CHEAPER. The ladder widened only
  // when a box held no route at all, so a road just past the first box lost to open ground inside it (6.6% of real
  // 24-pixel trips cost more than they should). A path that leaves a box `margin` wide goes margin + 1 pixels out and
  // as many back, at no less than a road's cost a step - so a route costing no more than that is the best there is,
  // and one costing more is searched for again in the next box.
  // TV-BEYOND (2026-10-09, the field: "CRASH (2) RangeError: invalid array length" from a click on the Overworld in the
  // wilds past the Alik'r): THE BOX HOLDS ITS ENDS. It was clamped to the map, and TAMRIEL2 streams the land past it - two
  // ends beyond an edge clamped it inside out (a negative width: the typed arrays threw), and one beyond it was indexed
  // into the box's far side (a route that began at a pixel the traveller never stood on). The bounds are the map and the
  // two ends; the ground past the map is the host's to answer (routeGround's `beyond`). AUDIT STARTS V4: and `endPad`
  // about an end past the map (the lanes' landfall: the shore beyond a port's own row and column)
  const padOf = (p) => (offTable(p) ? endPad : 0);
  const bounds = {
    x0: Math.min(0, from.x - padOf(from), to.x - padOf(to)),
    x1: Math.max(width - 1, from.x + padOf(from), to.x + padOf(to)),
    y0: Math.min(0, from.y - padOf(from), to.y - padOf(to)),
    y1: Math.max(height - 1, from.y + padOf(from), to.y + padOf(to)),
  };
  // ROAD-BEYOND (2026-10-26, the owner: "road travel in the overworld needs to work properly outside of tamriel"; Travel-View.md
  // ROAD-BEYOND): A PLAN WITH AN END PAST THE BAY'S TABLE. (1) By the roads first, where it is handed them (`beyond`, the
  // layer past the Bay - VOYAGER2.1) and walks the land: the search over the roads and tracks alone, the open ground only
  // about its two ends (searchByRoad) - its own network's, never the plane's every field (ROAD-GRAPH: no spend; the ladder's
  // A* priced a road a step under the field's 3.5, so a plan of 700 pixels past the Bay flooded ~200 000 cells a rung
  // and took 4 to 11 seconds). (2) The ladder below past the table: its box reaches `margin` past an end beyond the
  // table (`reachOf` - it stopped at the end's own row and column, so the Imperial City's way out south of its lake was
  // never in any box: no way to Bruma, Chorrol or Cheydinhal), its whole spend BEYOND_MAX_EXPANSIONS (there is no map's
  // edge to bound it), and an all-open plan's heuristic the field's own price (`hCost`: a FREE walk is the straight one).
  const past = offTable(from) || offTable(to);
  const tally = opts.tally ?? { n: 0 }; // ROAD-BEYOND: the cells a plan expands, counted (a caller's own count, the pins')
  let spent = tally.n;
  let byRoad = null,
    tried = false;
  // FAST-REFUSAL (Travel-View.md FAST-REFUSAL): no way by land past the Bay said at once from the land's pieces (landPieces.js
  // apartPastBay) - where it spent the whole count of cells first. THE MERGE: a boat's crossing is none of the land's pieces
  if (past && !sea && apart && apartPastBay(from, to, width, height)) return null;
  if (past && !sea && apart && apartExact(from, to)) return null; // EXACT-PIECES: and at the pixel, once the roads' regions have all landed
  // ROAD-GRAPH: with a boat to hand, land the pieces part is no way by the roads - the boat's search is asked alone
  const landApart = past && !!sea && !!apart && (apartPastBay(from, to, width, height) || apartExact(from, to));
  // ROAD-FOLLOW (Travel-View.md ROAD-FOLLOW): a plan handed the roads keeps to them wherever they join its two ends, the
  // open ground walked on each end's own leg alone (roadEndsSteps) - `costLaw` (its own call again, below) TV2's law
  const ends =
    (roads || tracks) && !opts.costLaw
      ? yield* roadEndsSteps(from, to, { roads, tracks, width, height, beyond, isWater, tally })
      : null;
  if (past && beyond && ends?.strict && (!sea || (sea.start === 'land' && sea.goal !== 'sea'))) {
    tried = true;
    byRoad = landApart
      ? null
      : yield* searchByRoadSteps(from, to, {
          roads,
          tracks,
          isWater,
          width,
          height,
          openBlocked,
          goalExempt,
          beyond,
          tally,
          ends,
          keep: opts.roadKeep ?? null,
        });
    spent = tally.n; // ROAD-GRAPH: its answer is whole, so the ladder after it spends a count of its own (AUDIT ROAD-GRAPH H1)
    // ROAD-FOLLOW: the roads join the two - kept, however much dearer than the straight walk across the field they wind
    // round (TV2's law asked the ladder then, and kept its cut across the field - a road worth a detour of three and a
    // half times its length and no more)
    if (byRoad) return byRoad;
  }
  const endLeg = ends?.strict && !tried ? endLegOf(from, to, ends) : null;
  const reachOf = (margin) =>
    etherBox(
      ether,
      past
        ? {
            x0: Math.min(
              bounds.x0,
              offTable(from) ? from.x - margin : Infinity,
              offTable(to) ? to.x - margin : Infinity,
            ),
            x1: Math.max(
              bounds.x1,
              offTable(from) ? from.x + margin : -Infinity,
              offTable(to) ? to.x + margin : -Infinity,
            ),
            y0: Math.min(
              bounds.y0,
              offTable(from) ? from.y - margin : Infinity,
              offTable(to) ? to.y - margin : Infinity,
            ),
            y1: Math.max(
              bounds.y1,
              offTable(from) ? from.y + margin : -Infinity,
              offTable(to) ? to.y + margin : -Infinity,
            ),
          }
        : bounds,
    );
  const hCost = past && !roads && !tracks && !sea ? ROUTE_COST.open : ROUTE_COST.road;
  let best = byRoad,
    box = '',
    asked = false;
  for (const rung of margins) {
    const margin = past ? Math.min(rung, BEYOND_MARGIN) : rung; // ROAD-BEYOND: past the table no rung wider than its spend can walk
    const reach = reachOf(margin);
    // AUDIT OW4 J3: a rung whose box the map's edges clamp to the last one's is that search again - skipped
    const key = `${Math.max(reach.x0, Math.min(from.x, to.x) - margin)},${Math.min(reach.x1, Math.max(from.x, to.x) + margin)},${Math.max(reach.y0, Math.min(from.y, to.y) - margin)},${Math.min(reach.y1, Math.max(from.y, to.y) + margin)}`;
    if (key === box) continue;
    // AUDIT OW4 J3: a pick the first box could not route asks the land's pieces (routeGround `apart`) before any wider
    // one - no way by land said at once, where it searched every box to the whole map first; a pick the first box routes
    // (nearly every click in the view) never folds them
    if (box && !best && !asked && apart && !sea) {
      asked = true;
      if (apart(from, to, { roads, tracks })) return null;
    } // THE MERGE: a boat's crossing is none of the land's pieces
    box = key;
    // AUDIT OW5 J3 (the audit before the merge): THE WHOLE MAP'S RUNG IS NEVER CUT SHORT - its box is every cell there is,
    // so the map itself bounds it. Even a small margin can clip to the full map; capping that search at 200 000
    // expansions would skip the identical final box and falsely refuse a reachable trip. Use actual bounds.
    const cap = key === `${bounds.x0},${bounds.x1},${bounds.y0},${bounds.y1}` ? Infinity : maxExpansions;
    const left = past ? Math.min(cap, BEYOND_MAX_EXPANSIONS - (tally.n - spent)) : cap; // ROAD-BEYOND: no edge of the world bounds the land past the Bay
    if (left <= 0) break;
    const r = yield* searchSteps(from, to, {
      roads,
      tracks,
      isWater,
      width,
      height,
      bounds: reach,
      margin,
      maxExpansions: left,
      openBlocked,
      goalExempt,
      peakAt,
      sea,
      beyond,
      hCost,
      tally,
      endLeg,
    });
    if (r && (!best || r.cost <= best.cost)) best = r;
    if (best && best.cost <= 2 * (margin + 1) * ROUTE_COST.road) return best;
  }
  // ROAD-FOLLOW: by the roads no box held a way (the roads join the two only past every box, or round a gap the flood
  // never met - a boat's landfall on no road, a spend run out): TV2's cost law, the gap crossed where it is cheapest; the
  // roads' search past the Bay that found none goes there at once (`tried`: the ladder's boxes walk its law no further)
  if (!best && endLeg) return yield* planRouteSteps(from, to, { ...opts, costLaw: true, tally });
  // ROAD-BEYOND: a plan by the roads past the Bay that neither the roads nor the ladder's spend found walks across country
  // (the FREE plan's own, as cheap to find as a straight walk) - never "no way" for a field the budget did not reach
  if (!best && past && (roads || tracks) && !sea)
    return yield* planRouteSteps(from, to, { ...opts, roads: null, tracks: null, tally });
  // GREEDY-BEYOND: an all-open plan past the Bay that spent its count leans on its goal (BEYOND_GREED). On open ground
  // every monotone path costs the same, so a detour near the goal made the exact search expand the whole parallelogram
  // between the ends: Daggerfall to the Imperial City, round Lake Rumare's west arm, 530,000 cells. A box that held no
  // way is not searched again.
  if (!best && past && !roads && !tracks && !sea && tally.n - spent >= BEYOND_MAX_EXPANSIONS) {
    return yield* searchSteps(from, to, {
      roads,
      tracks,
      isWater,
      width,
      height,
      bounds: reachOf(BEYOND_MARGIN),
      margin: BEYOND_MARGIN,
      maxExpansions: BEYOND_MAX_EXPANSIONS,
      openBlocked,
      goalExempt,
      peakAt,
      sea,
      beyond,
      hCost: BEYOND_GREED * ROUTE_COST.open,
      tally,
      endLeg,
    });
  }
  return best;
}

/** a plan's box held to the Eltheric Ocean's own when its ends are there (`ether`) - the sea about the
 *  box's edges streams no ground. @param {boolean} ether @param {{ x0: number, x1: number, y0: number, y1: number }} b */
function etherBox(ether, b) {
  return ether
    ? {
        x0: Math.max(b.x0, ETHER_BOX.x0),
        x1: Math.min(b.x1, ETHER_BOX.x1 - 1),
        y0: Math.max(b.y0, ETHER_BOX.y0),
        y1: Math.min(b.y1, ETHER_BOX.y1 - 1),
      }
    : b;
}
/** how far from a traveller ashore (map pixels, the longest axis) the shore a boat is launched at for
 *  the sea lanes is sought, and how many of its water pixels (nearest first) are tried. */
export const LAUNCH_PX = 8;
export const LAUNCH_TRIES = 4;
/** ashore with a boat to hand - the walk to one of the LAUNCH_TRIES nearest water pixels within
 *  LAUNCH_PX (its last step the launch) and a helm's voyage from there (the sea lanes, then the box), one plan; or null. */
function* shoreLanesSteps(from, to, opts) {
  const water = opts.seaWater ?? opts.isWater ?? (() => false),
    sea = opts.sea;
  let tried = 0;
  for (let r = 1; r <= LAUNCH_PX && tried < LAUNCH_TRIES; r++) {
    for (let dy = -r; dy <= r && tried < LAUNCH_TRIES; dy++)
      for (let dx = -r; dx <= r && tried < LAUNCH_TRIES; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !water(from.x + dx, from.y + dy)) continue;
        tried++;
        const shore = { x: from.x + dx, y: from.y + dy };
        const walk = yield* planRouteSteps(from, shore, {
          ...opts,
          sea: { ...sea, goal: 'sea' },
          lanes: false,
          margins: [LAUNCH_PX * 2],
        });
        if (!walk) continue;
        // afloat there, planned as a helm's voyage is (the sea lanes, then the box) - never the box's ladder it was handed
        const sail = yield* planRouteSteps(shore, to, { ...opts, margins: undefined, sea: { ...sea, start: 'sea' } });
        if (sail)
          return {
            pixels: [...walk.pixels, ...sail.pixels.slice(1)],
            kinds: [...walk.kinds, ...sail.kinds],
            cost: walk.cost + sail.cost,
          };
      }
  }
  return null;
}

/** ROAD-BEYOND: the ladder's whole spend past the Bay's table, cells expanded over every rung (an op count, never a clock). */
export const BEYOND_MAX_EXPANSIONS = 100000;
/** ROAD-BEYOND: the widest rung past the table, pixels about the ends - a box no wider than the ladder's spend walks (the
 *  whole map's rung there was a box of the ends and a thousand pixels about them: millions of cells to allot for none). */
export const BEYOND_MARGIN = 240;
/** ROAD-BEYOND: searchByRoad leans on its goal by this much (a weighted A*: a way by the roads at most this much dearer than
 *  the cheapest, for a search that does not walk every road of a province to prove it). */
export const BY_ROAD_GREED = 1.25;
/** GREEDY-BEYOND: how hard an all-open plan past the Bay leans on its goal once the exact search has spent its count - a
 *  weighted A*, at most three times the cheapest. Measured on the freeware's city trips: within a tenth of it. */
export const BEYOND_GREED = 3;
/** ROAD-BEYOND: how far an end looks for the nearest road or track, pixels (the longest axis) - ROAD-FOLLOW: an end no
 *  road comes this near walks the open ground as TV2's law has it (roadEnds). */
export const BY_ROAD_SEEK = 96;

/** ROAD-FOLLOW (Travel-View.md ROAD-FOLLOW): how far past the nearest road or track an end's own leg reaches, rings - the
 *  short leg to the road, to the nearest or one beside it. */
export const ROAD_END_SLACK = 2;
/** ROAD-FOLLOW: the most pixels of the roads roadEndsSteps floods from each end to learn whether the roads join the two -
 *  a flood that runs out under this, never meeting the other end's, holds roads of their own that join none of the
 *  other's (a town's stub of a road; Taneth's network, 4,399 pixels; Necrom's, 3,911); one this big from both ends is
 *  the land's network. */
export const ROAD_PIECE_CAP = 8192;

/**
 * ROAD-FOLLOW (2026-10-27, the owner: "Road travel is not following roads properly in overworld travel", then "No band aids
 * or half assed work"): A PLAN BY THE ROADS WALKS THE ROADS WHEREVER THEY JOIN ITS TWO ENDS, AND THE OPEN GROUND ONLY ON
 * EACH END'S OWN LEG AND ACROSS A GAP IN THEM. Each end's own leg: none about an end on a road or a track (its pixel
 * carries one - the journey starts or ends on it), out to ROAD_END_SLACK rings past the nearest about an end off them.
 * The roads are then flooded from both ends' legs at once, ROAD_PIECE_CAP pixels a side at most. A side whose flood runs
 * out first, never meeting the other's, holds roads that join none of the other's - A GAP: the narrowest crossing of the
 * land from them to a road they do not hold (breadth first over the land, out to BY_ROAD_SEEK pixels) is walked across
 * the open ground (its pixels `bridges`, keys), and the flood goes on from its far side. Measured on the freeware's world
 * (Travel-View.md ROAD-FOLLOW): 28 places' roads join no other's, their narrowest crossing 2 to 9 pixels. The answer:
 * `f` and `t` (the rings about `from` and `to`), `bridges`, and `strict` - whether the plan keeps to the roads but on
 * those (false: an end no road comes within BY_ROAD_SEEK of, or a gap no crossing of the land within it closes - an
 * island's roads: the plan is TV2's cost law then). PLAN-SLICES: a generator, its pixels counted in `tally`.
 * @param {{x:number,y:number}} from @param {{x:number,y:number}} to
 * @param {{ roads?: ArrayLike<number>|null, tracks?: ArrayLike<number>|null, width?: number, height?: number,
 *   beyond?: ((kind: string, x: number, y: number) => number)|null, isWater?: (x: number, y: number) => boolean, tally?: { n: number }|null }} [o]
 * @returns {Generator<void, { f: number, t: number, bridges: Set<number>, strict: boolean }, void>}
 */
export function* roadEndsSteps(
  from,
  to,
  {
    roads = null,
    tracks = null,
    width = MAP_W,
    height = MAP_H,
    beyond = null,
    isWater = () => false,
    tally = null,
  } = {},
) {
  const at = (x, y) =>
    x >= 0 && y >= 0 && x < width && y < height
      ? (roads ? roads[y * width + x] : 0) | (tracks ? tracks[y * width + x] : 0) | (beyond ? beyond('join', x, y) : 0)
      : beyond
        ? beyond('roads', x, y) | beyond('tracks', x, y)
        : 0;
  /** The ring (Chebyshev) of the nearest road or track byte about `p`, within BY_ROAD_SEEK; -1 for none. */
  const ringOf = (p) => {
    for (let r = 0; r <= BY_ROAD_SEEK; r++) {
      for (let dy = -r; dy <= r; dy++) {
        const step = Math.abs(dy) === r ? 1 : 2 * r;
        for (let dx = -r; dx <= r; dx += step || 1) if (at(p.x + dx, p.y + dy)) return r;
      }
    }
    return -1;
  };
  const leg = (r) => (r < 0 ? Infinity : r === 0 ? 0 : r + ROAD_END_SLACK);
  const rf = ringOf(from),
    rt = ringOf(to),
    f = leg(rf),
    t = leg(rt),
    bridges = new Set();
  if (rf < 0 || rt < 0) return { f, t, bridges, strict: false };
  // the two floods: each from the road and track pixels within its end's leg
  const sides = [
    [from, f],
    [to, t],
  ].map(([p, L]) => {
    const seen = new Set(),
      q = [];
    for (let y = p.y - L; y <= p.y + L; y++)
      for (let x = p.x - L; x <= p.x + L; x++)
        if (at(x, y)) {
          seen.add(beyondKey(x, y));
          q.push(x, y);
        }
    return { seen, q, head: 0, gap: /** @type {any} */ (null) };
  });
  let joined = [...sides[0].seen].some((k) => sides[1].seen.has(k)),
    n = 0;
  while (!joined) {
    const [a, b] = sides;
    const dry = a.head === a.q.length ? a : b.head === b.q.length ? b : null;
    if (dry) {
      // A GAP: the shortest walk over the land (a diagonal step sqrt 2) from every road pixel the dry side holds to the
      // nearest it does not - one walk a side, kept: the roads a crossing reached are its sources too, at nought, when
      // they run out in turn (a crossing onto a town's stub of a road, and on from it), so no pixel is walked again for
      // a distance it had
      const g = (dry.gap ??= { dist: new Map(), parent: new Map(), open: new Heap(), fed: 0 });
      for (let i = g.fed; i < dry.q.length; i += 2) {
        const k = beyondKey(dry.q[i], dry.q[i + 1]);
        g.dist.set(k, 0);
        g.parent.set(k, -1);
        g.open.push(0, k);
      }
      g.fed = dry.q.length;
      let found = -1;
      while (g.open.size && found < 0) {
        const dk = g.open.p[0],
          k = g.open.pop();
        if (dk !== g.dist.get(k) || dk > BY_ROAD_SEEK) continue; // reached nearer since; or past the seek
        const [x, y] = beyondPixel(k);
        if (at(x, y) && !dry.seen.has(k)) {
          found = k;
          break;
        } // the nearest road the dry side does not hold
        if (++n % PLAN_YIELD_CELLS === 0) yield; // PLAN-SLICES
        if (tally) tally.n++;
        for (let d = 0; d < 8; d++) {
          const nx = x + STEP_DX[d],
            ny = y + STEP_DY[d],
            nk = beyondKey(nx, ny),
            nd = dk + (STEP_DX[d] && STEP_DY[d] ? Math.SQRT2 : 1);
          if (
            (g.dist.get(nk) ?? Infinity) <= nd ||
            isWater(nx, ny) ||
            (STEP_DX[d] && STEP_DY[d] && isWater(nx, y) && isWater(x, ny))
          )
            continue;
          g.dist.set(nk, nd);
          g.parent.set(nk, k);
          g.open.push(nd, nk);
        }
      }
      if (found < 0) return { f, t, bridges, strict: false }; // no crossing within BY_ROAD_SEEK: an island's roads
      for (let k = found; k !== -1; k = g.parent.get(k)) bridges.add(k);
      if ((dry === a ? b : a).seen.has(found)) joined = true;
      const [fx, fy] = beyondPixel(found);
      dry.seen.add(found);
      dry.q.push(fx, fy);
      continue;
    }
    if (a.seen.size >= ROAD_PIECE_CAP && b.seen.size >= ROAD_PIECE_CAP) break; // both the land's network
    const s = a.seen.size >= ROAD_PIECE_CAP || (b.seen.size < ROAD_PIECE_CAP && b.seen.size < a.seen.size) ? b : a,
      other = s === a ? b : a;
    const x = s.q[s.head],
      y = s.q[s.head + 1];
    s.head += 2;
    if (++n % PLAN_YIELD_CELLS === 0) yield; // PLAN-SLICES
    if (tally) tally.n++;
    for (let d = 0; d < 8 && !joined; d++) {
      const nx = x + STEP_DX[d],
        ny = y + STEP_DY[d],
        k = beyondKey(nx, ny);
      if (s.seen.has(k) || pathKind(x, y, nx, ny, STEP_BIT[d], width, height, roads, tracks, beyond) === 2) continue;
      if (other.seen.has(k)) joined = true;
      s.seen.add(k);
      s.q.push(nx, ny);
    }
  }
  return { f, t, bridges, strict: true };
}
/** ROAD-FOLLOW: whether an open step from (ax, ay) to (bx, by) is an end's own leg or a gap's crossing (roadEndsSteps'
 *  `ends`): both its pixels within the rings about the one end, or both on a crossing. */
const endLegOf = (from, to, ends) => (ax, ay, bx, by) =>
  Math.max(Math.abs(ax - from.x), Math.abs(ay - from.y), Math.abs(bx - from.x), Math.abs(by - from.y)) <= ends.f ||
  Math.max(Math.abs(ax - to.x), Math.abs(ay - to.y), Math.abs(bx - to.x), Math.abs(by - to.y)) <= ends.t ||
  (ends.bridges.has(beyondKey(ax, ay)) && ends.bridges.has(beyondKey(bx, by)));

/**
 * ROAD-BEYOND: A PLAN BY THE ROADS, past the Bay - A* over the roads and the tracks (the Bay's arrays on the table, the
 * layer's past it; stepKind's law, TV2's prices: a road 1, a track 1.6), the open ground (3.5) walked only on an end's own
 * leg (ROAD-FOLLOW: roadEndsSteps' `ends`, asked here when none is handed). ROAD-GRAPH: elsewhere a chain at a time (roadGraphFor),
 * with no spend - a flood back from the goal says no way at its side's cost. `{ pixels, cost, kinds }`.
 * @param {{x:number,y:number}} from @param {{x:number,y:number}} to
 * @param {{ roads?: ArrayLike<number>|null, tracks?: ArrayLike<number>|null, isWater?: (x:number,y:number)=>boolean, width?: number, height?: number,
 *   openBlocked?: any, goalExempt?: boolean, beyond?: ((kind: string, x: number, y: number) => number)|null, tally?: { n: number }|null,
 *   ends?: { f: number, t: number, strict: boolean, bridges?: Set<number> }|null }} [o]
 * @returns {{ pixels: {x:number,y:number}[], cost: number, kinds: string[] } | null}
 */
export function searchByRoad(from, to, o = {}) {
  return drainPlan(searchByRoadSteps(from, to, o));
}

/** ROAD-GRAPH: the road and track steps out of a pixel under the ordinary step law, written to `out` as direction and
 *  kind pairs; answers how many numbers it wrote. */
function roadOuts(s, x, y, out) {
  const here = s.pathAt(x, y);
  let n = 0;
  if (!here) return 0;
  for (let d = 0; d < 8; d++) {
    if (!(here & STEP_BIT[d])) continue;
    const k = stepKind(
      x,
      y,
      x + STEP_DX[d],
      y + STEP_DY[d],
      STEP_BIT[d],
      s.width,
      s.height,
      s.roads,
      s.tracks,
      s.isWater,
      null,
      0,
      false,
      s.beyond,
    );
    if (k === 0 || k === 1) {
      out[n++] = d;
      out[n++] = k;
    }
  }
  return n;
}
/** ROAD-GRAPH: the flood back from the goal steps one pixel for each this many of the search's own. */
export const ROAD_BACK_EVERY = 4;
/** ROAD-GRAPH: a kept graph whose chains hold more pixels than this is dropped whole when the next plan begins. */
export const ROAD_GRAPH_MAX_PIXELS = 1 << 21;
const growTo = (a, n) => {
  if (n <= a.length) return a;
  let m = a.length * 2;
  while (m < n) m *= 2;
  const b = new a.constructor(m);
  b.set(a);
  return b;
};
/** What the step law reads that can move under a kept graph: the installed layer (the world's reader) and the land. */
const lawStamp = (beyond) => `${beyond === arenaRoadByte ? arenaRoadsVersion() : 0}|${tamrielLandVersion()}`;
/**
 * ROAD-GRAPH: THE ROADS' GRAPH - a junction is a road pixel with other than two steps out (roadOuts); a chain the pixels
 * between two, walked once and read either way. Flat arrays: a node's steps out and the chain each leads to (`nChain`: 0
 * unwalked, +id read forward, -id back), a chain's pixels in one pool (`pk`, and `pd` the kind of the step onto each),
 * its offset, steps, price and box. Kept in `keep` (routeGround's own) for the network it was walked on, else this plan's.
 */
function roadGraphFor(keep, roads, tracks, beyond, isWater, width, height) {
  const stamp = lawStamp(beyond),
    fit = tamrielFit();
  const k = keep?.graph;
  if (
    k &&
    k.roads === roads &&
    k.tracks === tracks &&
    k.beyond === beyond &&
    k.isWater === isWater &&
    k.width === width &&
    k.height === height &&
    k.stamp === stamp &&
    k.fit === fit &&
    k.pixels <= ROAD_GRAPH_MAX_PIXELS
  )
    return k;
  const pathAt = (x, y) =>
    x >= 0 && y >= 0 && x < width && y < height
      ? (roads ? roads[y * width + x] : 0) | (tracks ? tracks[y * width + x] : 0) | beyond('join', x, y)
      : beyond('roads', x, y) | beyond('tracks', x, y);
  const g = {
    roads,
    tracks,
    beyond,
    isWater,
    width,
    height,
    stamp,
    fit,
    pathAt,
    ids: new Map(),
    nodes: 0,
    nN: new Uint8Array(256),
    nDir: new Int8Array(2048),
    nKind: new Int8Array(2048),
    nChain: new Int32Array(2048),
    chains: 0,
    cOff: new Int32Array(256),
    cLen: new Int32Array(256),
    cCost: new Float64Array(256),
    cBox: new Int32Array(1024),
    pixels: 0,
    pk: new Uint32Array(2048),
    pd: new Uint8Array(2048),
  };
  if (keep && beyond === arenaRoadByte) keep.graph = g; // another reader's bytes carry no version to know them by
  return g;
}
const _outs = new Int8Array(16);
/** ROAD-GRAPH: the node at pixel key `k` - made, with its steps out, the first time it is asked. */
function roadNode(g, k, x, y) {
  let id = g.ids.get(k);
  if (id !== undefined) return id;
  id = g.nodes++;
  if (id >= g.nN.length) {
    g.nN = growTo(g.nN, id + 1);
    g.nDir = growTo(g.nDir, 8 * id + 8);
    g.nKind = growTo(g.nKind, 8 * id + 8);
    g.nChain = growTo(g.nChain, 8 * id + 8);
  }
  const n = roadOuts(g, x, y, _outs) >> 1;
  g.nN[id] = n;
  for (let o = 0; o < n; o++) {
    g.nDir[8 * id + o] = _outs[2 * o];
    g.nKind[8 * id + o] = _outs[2 * o + 1];
    g.nChain[8 * id + o] = 0;
  }
  g.ids.set(k, id);
  return id;
}

/** PLAN-SLICES: searchByRoad's own body, a generator (planRouteSteps). @param {{x:number,y:number}} from
 *  @param {{x:number,y:number}} to @param {Parameters<typeof searchByRoad>[2] & { keep?: any }} [o] @returns {Generator<void, ReturnType<typeof searchByRoad>, void>} */
function* searchByRoadSteps(from, to, o = {}) {
  const {
    roads = null,
    tracks = null,
    isWater = () => false,
    width = MAP_W,
    height = MAP_H,
    openBlocked = null,
    goalExempt = true,
    beyond = null,
    tally = null,
    ends = null,
    keep = null,
  } = o;
  if (!beyond) return null;
  const graph = roadGraphFor(keep, roads, tracks, beyond, isWater, width, height),
    pathAt = graph.pathAt;
  // ROAD-GRAPH: what the law reads moved under a sliced plan (an install, the land) - planned again as it lies now
  const moved = () => lawStamp(beyond) !== graph.stamp || tamrielFit() !== graph.fit;
  // ROAD-FOLLOW: the open ground on the ends' own legs alone (roadEnds) - it was any of it within BY_ROAD_REACH (24
  // pixels) of either end, so a way by the roads left them there for a field's corner whenever they wound round it
  const legs = ends ?? (yield* roadEndsSteps(from, to, { roads, tracks, width, height, beyond, isWater, tally }));
  if (!legs.strict) return null; // no road joins the two: the roads' search walks no field but an end's and a gap's
  const rf = legs.f,
    rt = legs.t,
    endLeg = endLegOf(from, to, legs);
  const near = (x, y) =>
    Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) <= rf ||
    Math.max(Math.abs(x - to.x), Math.abs(y - to.y)) <= rt ||
    legs.bridges.has(beyondKey(x, y));
  // ROAD-GRAPH: a pixel stepped a pixel at a time - the ends' legs, the gaps, and the goal's neighbours (a step onto the goal
  // is asked under the goal's own law); everywhere else a chain at a time
  const tr = Math.max(rt, 1);
  const local = (x, y) => near(x, y) || Math.max(Math.abs(x - to.x), Math.abs(y - to.y)) <= tr;
  let bx0 = Infinity,
    by0 = Infinity,
    bx1 = -Infinity,
    by1 = -Infinity;
  for (const k of legs.bridges) {
    const [x, y] = beyondPixel(k);
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
  }
  const hits = (c, x0, y0, x1, y1) =>
    graph.cBox[4 * c] <= x1 &&
    graph.cBox[4 * c + 2] >= x0 &&
    graph.cBox[4 * c + 1] <= y1 &&
    graph.cBox[4 * c + 3] >= y0;
  const touches = (c) =>
    hits(c, from.x - rf, from.y - rf, from.x + rf, from.y + rf) ||
    hits(c, to.x - tr, to.y - tr, to.x + tr, to.y + tr) ||
    hits(c, bx0, by0, bx1, by1);
  const h = (x, y) => {
    const dx = Math.abs(x - to.x),
      dy = Math.abs(y - to.y);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * ROUTE_COST.road;
  };
  /** @type {Map<number, number>} */ const g = new Map();
  /** @type {Map<number, number>} */ const came = new Map();
  /** @type {Map<number, number>} */ const via = new Map();
  /** @type {Map<number, number[]>} */ const link = new Map();
  /** @type {Set<number>} */ const closed = new Set();
  const start = beyondKey(from.x, from.y),
    goal = beyondKey(to.x, to.y);
  const pix = (k) => ({ x: (k % 65536) - 32768, y: Math.floor(k / 65536) - 32768 });
  const open = new Heap();
  const reach = (n, ng, c, nx, ny) => {
    g.set(n, ng);
    came.set(n, c);
    open.push(ng + BY_ROAD_GREED * h(nx, ny), n);
  };
  // a chain read forward (+id) or back (-id): its j-th step's pixel and kind, and its end
  const stepAt = (ref, j) => {
    const c = Math.abs(ref) - 1,
      off = graph.cOff[c],
      L = graph.cLen[c];
    return ref > 0 ? off + 1 + j : off + L - 1 - j;
  };
  const kindAt = (ref, j) => {
    const c = Math.abs(ref) - 1,
      off = graph.cOff[c],
      L = graph.cLen[c];
    return graph.pd[ref > 0 ? off + 1 + j : off + L - j];
  };
  // ROAD-GRAPH: THE FLOOD BACK FROM THE GOAL, a pixel for each ROAD_BACK_EVERY of the search's - the pixels the goal is
  // reached from, by the search's own law. Run dry before it meets a pixel the search reached, it proves no way, at the cost
  // of the goal's side (the search alone walked the start's whole network first).
  /** @type {Set<number>|null} */ let back = new Set([goal]);
  let bq = [to.x, to.y],
    bh = 0,
    backed = 0;
  const backStep = () => {
    // false once the flood has run dry
    if (bh === bq.length) return false;
    const px = bq[bh++],
      py = bq[bh++],
      pk = beyondKey(px, py);
    for (let d = 0; d < 8 && back; d++) {
      const qx = px + STEP_DX[d],
        qy = py + STEP_DY[d],
        q = beyondKey(qx, qy),
        bit = STEP_BIT[(d + 4) & 7];
      if (back.has(q)) continue;
      const here = pathAt(qx, qy);
      if (local(qx, qy)) {
        if (!(here & bit) && !near(px, py)) continue;
        const kind = stepKind(
          qx,
          qy,
          px,
          py,
          bit,
          width,
          height,
          roads,
          tracks,
          isWater,
          openBlocked,
          pk !== goal ? 0 : goalExempt ? 2 : 1,
          false,
          beyond,
        );
        if (kind < 0 || (kind === 2 && !endLeg(qx, qy, px, py))) continue;
      } else {
        if (!(here & bit)) continue;
        const kind = stepKind(qx, qy, px, py, bit, width, height, roads, tracks, isWater, null, 0, false, beyond);
        if (kind !== 0 && kind !== 1) continue;
      }
      if (g.has(q)) {
        back = null;
        bq = [];
      } // met: the search's own
      else {
        back.add(q);
        bq.push(qx, qy);
      }
    }
    return true;
  };
  const walk = new Int8Array(16),
    wk = [],
    wd = [];
  let cells = 0,
    next = PLAN_YIELD_CELLS,
    fw = 0; // the cells worked (the slices'), the search's own of them (the flood's pace)
  /** The flood back caught up with the search's pace - false once it has run dry (no way). */
  const backPace = () => {
    while (back && backed * ROAD_BACK_EVERY < fw) {
      backed++;
      cells++;
      if (tally) tally.n++;
      if (!backStep()) return false;
    }
    return true;
  };
  g.set(start, 0);
  open.push(BY_ROAD_GREED * h(from.x, from.y), start);
  while (open.size) {
    const c = open.pop();
    if (closed.has(c)) continue;
    closed.add(c);
    if (c === goal) break;
    if (++cells >= next) {
      next += PLAN_YIELD_CELLS;
      yield;
      if (moved()) return yield* searchByRoadSteps(from, to, { ...o, ends: null });
    } // PLAN-SLICES: a slice may end here
    if (tally) tally.n++;
    fw++;
    if (!backPace()) return null;
    const { x: cx, y: cy } = pix(c),
      gc = g.get(c);
    if (!local(cx, cy)) {
      // ROAD-GRAPH: each step out, the chain it leads to - walked the first time, kept - to its junction, or to the first
      // pixel of it an end or a gap holds
      const u = roadNode(graph, c, cx, cy);
      for (let o8 = 0; o8 < graph.nN[u]; o8++) {
        let ref = graph.nChain[8 * u + o8];
        if (!ref) {
          let sd = graph.nDir[8 * u + o8],
            kind = graph.nKind[8 * u + o8],
            x = cx + STEP_DX[sd],
            y = cy + STEP_DY[sd],
            cost = 0;
          let x0 = Math.min(cx, x),
            y0 = Math.min(cy, y),
            x1 = Math.max(cx, x),
            y1 = Math.max(cy, y);
          wk.length = 0;
          wd.length = 0;
          for (;;) {
            wk.push(beyondKey(x, y));
            wd.push(kind);
            cost += (STEP_DX[sd] && STEP_DY[sd] ? Math.SQRT2 : 1) * KIND_COST[kind];
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            if (++cells >= next) {
              next += PLAN_YIELD_CELLS;
              yield;
              if (moved()) return yield* searchByRoadSteps(from, to, { ...o, ends: null });
            }
            if (tally) tally.n++;
            fw++;
            if (!backPace()) return null; // a long chain walked, the flood back keeping its pace
            if (x === cx && y === cy) break; // a ring, back where it began
            if (roadOuts(graph, x, y, walk) !== 4) break; // an end or a fork
            const bx = x - STEP_DX[sd],
              by = y - STEP_DY[sd];
            const back0 = x + STEP_DX[walk[0]] === bx && y + STEP_DY[walk[0]] === by;
            const back1 = x + STEP_DX[walk[2]] === bx && y + STEP_DY[walk[2]] === by;
            if (back0 === back1) break; // a step back the law refuses: a junction of its own
            sd = back0 ? walk[2] : walk[0];
            kind = back0 ? walk[3] : walk[1];
            x += STEP_DX[sd];
            y += STEP_DY[sd];
          }
          // kept whole once walked: its two ends, the pixels between, each step's kind
          const id = graph.chains++,
            L = wk.length,
            off = graph.pixels;
          if (id >= graph.cOff.length) {
            graph.cOff = growTo(graph.cOff, id + 1);
            graph.cLen = growTo(graph.cLen, id + 1);
            graph.cCost = growTo(graph.cCost, id + 1);
            graph.cBox = growTo(graph.cBox, 4 * id + 4);
          }
          graph.pk = growTo(graph.pk, off + L + 1);
          graph.pd = growTo(graph.pd, off + L + 1);
          graph.pk[off] = c;
          for (let j = 0; j < L; j++) {
            graph.pk[off + 1 + j] = wk[j];
            graph.pd[off + 1 + j] = wd[j];
          }
          graph.pixels += L + 1;
          graph.cOff[id] = off;
          graph.cLen[id] = L;
          graph.cCost[id] = cost;
          graph.cBox[4 * id] = x0;
          graph.cBox[4 * id + 1] = y0;
          graph.cBox[4 * id + 2] = x1;
          graph.cBox[4 * id + 3] = y1;
          ref = id + 1;
          graph.nChain[8 * u + o8] = ref;
          // read back from its far junction too, when it is the same walk that way: from a junction, to a junction
          const end = wk[L - 1];
          if (end !== c && graph.nN[u] !== 2) {
            const v = roadNode(graph, end, x, y),
              bd = (sd + 4) & 7;
            for (let q = 0; q < graph.nN[v]; q++)
              if (graph.nDir[8 * v + q] === bd && graph.nKind[8 * v + q] === kind && !graph.nChain[8 * v + q])
                graph.nChain[8 * v + q] = -ref;
          }
        }
        const cid = Math.abs(ref) - 1,
          L = graph.cLen[cid];
        let i = L - 1,
          cost = graph.cCost[cid];
        if (touches(cid)) {
          cost = 0;
          for (let j = 0, qx = cx, qy = cy; j < L; j++) {
            const key = graph.pk[stepAt(ref, j)],
              kx = (key % 65536) - 32768,
              ky = Math.floor(key / 65536) - 32768;
            cost += (kx !== qx && ky !== qy ? Math.SQRT2 : 1) * KIND_COST[kindAt(ref, j)];
            if (local(kx, ky)) {
              i = j;
              break;
            }
            qx = kx;
            qy = ky;
          }
        }
        const nk = graph.pk[stepAt(ref, i)];
        if (closed.has(nk) || !(gc + cost < (g.get(nk) ?? Infinity))) continue;
        const [nx, ny] = beyondPixel(nk);
        reach(nk, gc + cost, c, nx, ny);
        link.set(nk, [ref, i]);
        via.delete(nk);
      }
      continue;
    }
    const here = pathAt(cx, cy);
    for (let d = 0; d < 8; d++) {
      const nx = cx + STEP_DX[d],
        ny = cy + STEP_DY[d],
        n = beyondKey(nx, ny);
      if (closed.has(n) || (!(here & STEP_BIT[d]) && !near(nx, ny))) continue; // away from the ends and the gaps a step leaves by a road's or a track's edge
      const kind = stepKind(
        cx,
        cy,
        nx,
        ny,
        STEP_BIT[d],
        width,
        height,
        roads,
        tracks,
        isWater,
        openBlocked,
        n !== goal ? 0 : goalExempt ? 2 : 1,
        false,
        beyond,
      );
      if (kind < 0 || (kind === 2 && !endLeg(cx, cy, nx, ny))) continue; // ROAD-FOLLOW: the open ground on an end's own leg alone
      const ng = gc + (STEP_DX[d] && STEP_DY[d] ? Math.SQRT2 : 1) * KIND_COST[kind];
      if (ng < (g.get(n) ?? Infinity)) {
        reach(n, ng, c, nx, ny);
        via.set(n, kind);
        link.delete(n);
      }
    }
  }
  if (!closed.has(goal)) return null;
  const pixels = [],
    kinds = [];
  for (let c = goal; c !== start; c = came.get(c)) {
    const l = link.get(c);
    if (l)
      for (let j = l[1]; j >= 0; j--) {
        pixels.push(pix(graph.pk[stepAt(l[0], j)]));
        kinds.push(KIND_NAMES[kindAt(l[0], j)]);
      }
    else {
      pixels.push(pix(c));
      kinds.push(KIND_NAMES[via.get(c)]);
    }
  }
  pixels.push(pix(start));
  pixels.reverse();
  kinds.reverse();
  return { pixels, cost: g.get(goal), kinds };
}

/** LONG-VOYAGE: the sea lanes' grid - a cell LANE_CELL pixels a side, open water where its middle pixel is, and two
 *  cells joined where the straight run of pixels between their middles is water a boat sails (never through a corner
 *  of the land - the search's own law). The coasts past the Bay are the trace's, a picture pixel of it 15.5 Bay pixels
 *  at the freeware's fit, so no strait there is narrower than a cell. */
export const LANE_CELL = 8;
/** How far past its two ends the lanes' box reaches, pixels - round a province: High Rock's north coast lies some 450
 *  pixels north of the Bay's table's. */
export const LANE_MARGIN = 960;
/** AUDIT STARTS V5: the box a lane the first one holds none of is asked over once more - north to south round a
 *  province (Solitude's to Haven's lies west of Hammerfell and Sumurset). */
export const LANE_MARGIN_WIDE = 2400;
/** How far a voyage's ends are flooded over the water, pixels a side - the channels a harbour reaches the open water
 *  by, a lake's or an inner sea's narrows among them, where the lanes begin and end. */
export const LANE_END_REACH = 256;
/** The lanes' A* leans toward its goal by this much (a weighted A*: a lane at most this much longer than the shortest,
 *  for a search that does not flood an ocean to prove it). */
export const LANE_GREED = 1.5;
/** The lanes' water and joins, kept a ground (the ground is the world's own, fixed for the session), in tiles of
 *  LANE_TILE x LANE_TILE cells: each cell's water (-1 not yet asked) and its eight joins. */
const LANE_TILE = 64;
const _laneGround = new WeakMap();

/**
 * LONG-VOYAGE (START2): A VOYAGE BY THE SEA LANES, from a helm (`sea.start` 'sea') - the water a boat sails from `from`
 * flooded out to LANE_END_REACH, and from the water about `to` (within VOYAGE_LANDFALL_PX of it) the same; A* over the
 * lanes' grid (the ends' box grown LANE_MARGIN) from a cell the first flood reached to one the second did; the route
 * the first flood's way to its cell, the lane's straight runs, the second flood's way out of its cell, and the landfall
 * onto `to` (the box planner's own, as asked - a voyage's at its port). Every step sailed is one the box planner sails.
 * `{ pixels, cost, kinds }` as planRoute's, or null.
 * @param {{x:number,y:number}} from @param {{x:number,y:number}} to @param {any} opts planRoute's own
 */
export function planSeaLanes(from, to, opts = {}) {
  return drainPlan(planSeaLanesSteps(from, to, opts));
}
/** PLAN-SLICES: planSeaLanes' own body, a generator (planRouteSteps) - its floods' and its lanes' cells counted in the
 *  plan's `tally`. @param {{x:number,y:number}} from @param {{x:number,y:number}} to @param {any} opts
 *  @returns {Generator<void, ReturnType<typeof planRoute>, void>} */
function* planSeaLanesSteps(from, to, opts = {}) {
  const {
    isWater: landWater = () => false,
    seaWater = landWater,
    sea = null,
    laneMargin = LANE_MARGIN,
    tally = null,
  } = opts;
  const isWater = seaWater; // RUMARE-WATER: the water a boat sails (routeGround's seaWater) - the land's where none is said
  if (!sea || sea.start !== 'sea') return null;
  let tiles = _laneGround.get(isWater);
  if (!tiles) {
    tiles = new Map();
    _laneGround.set(isWater, tiles);
  }
  const tileOf = (cx, cy) => {
    const k = `${Math.floor(cx / LANE_TILE)},${Math.floor(cy / LANE_TILE)}`;
    let t = tiles.get(k);
    if (!t) {
      t = {
        cell: new Int8Array(LANE_TILE * LANE_TILE).fill(-1),
        join: new Int8Array(LANE_TILE * LANE_TILE * 8).fill(-1),
      };
      tiles.set(k, t);
    }
    return t;
  };
  const inTile = (cx, cy) =>
    (cy - Math.floor(cy / LANE_TILE) * LANE_TILE) * LANE_TILE + (cx - Math.floor(cx / LANE_TILE) * LANE_TILE);
  /** A boat's step between two neighbouring pixels: into the water, never through a corner of the land. */
  const sails = (ax, ay, bx, by) =>
    isWater(bx, by) && !(ax !== bx && ay !== by && !isWater(bx, ay) && !isWater(ax, by));
  const half = LANE_CELL / 2;
  const wetCell = (cx, cy) => {
    const t = tileOf(cx, cy),
      i = inTile(cx, cy);
    if (t.cell[i] < 0) t.cell[i] = isWater(cx * LANE_CELL + half, cy * LANE_CELL + half) ? 1 : 0;
    return t.cell[i] === 1;
  };
  const joined = (cx, cy, d) => {
    const t = tileOf(cx, cy),
      i = inTile(cx, cy) * 8 + d;
    if (t.join[i] < 0) {
      const dx = STEP_DX[d],
        dy = STEP_DY[d];
      let j = 1,
        x = cx * LANE_CELL + half,
        y = cy * LANE_CELL + half;
      for (let k = 0; k < LANE_CELL && j; k++, x += dx, y += dy) if (!sails(x, y, x + dx, y + dy)) j = 0;
      t.join[i] = j;
    }
    return t.join[i] === 1;
  };
  /** The water a boat sails from `seeds` out to LANE_END_REACH about `origin`, nearest first by the way's own length (a
   *  diagonal step √2 - SEA-TAUT: counted as one, the A* took a lane in at a diagonal's far cell and the way to it bent,
   *  up to √2 the straight line): each pixel's length, and the way to it. Queued in buckets a pixel's length wide, which
   *  is exact with every step one or more - and a step reaches only the next two, so three turn round. */
  const flood = function* (origin, seeds) {
    const R = LANE_END_REACH,
      W = 2 * R + 1,
      ox = origin.x - R,
      oy = origin.y - R;
    const dist = new Float64Array(W * W).fill(Infinity),
      prev = new Int32Array(W * W).fill(-1),
      done = new Uint8Array(W * W);
    const q = [new Int32Array(W * W), new Int32Array(W * W), new Int32Array(W * W)],
      len = [0, 0, 0];
    const ix = (x, y) => (x < ox || y < oy || x >= ox + W || y >= oy + W ? -1 : (y - oy) * W + (x - ox));
    // each pixel's water asked once (-1 not yet): a queued pixel's neighbours are asked again as it is reached
    const wetAt = new Int8Array(W * W).fill(-1);
    const wet = (x, y) => {
      const i = ix(x, y);
      if (i < 0) return isWater(x, y);
      if (wetAt[i] < 0) wetAt[i] = isWater(x, y) ? 1 : 0;
      return wetAt[i] === 1;
    };
    const step = (ax, ay, bx, by) => wet(bx, by) && !(ax !== bx && ay !== by && !wet(bx, ay) && !wet(ax, by)); // `sails`, on the kept water
    for (const p of seeds) {
      const i = ix(p.x, p.y);
      if (i >= 0 && dist[i] > 0) {
        dist[i] = 0;
        q[0][len[0]++] = i;
      }
    }
    let popped = 0;
    for (let b = 0; len[0] + len[1] + len[2]; b++) {
      const at = b % 3,
        list = q[at];
      for (let k = 0; k < len[at]; k++) {
        const i = list[k];
        if (done[i]) continue;
        done[i] = 1;
        if (++popped % PLAN_YIELD_CELLS === 0) yield; // PLAN-SLICES
        if (tally) tally.n++;
        const x = ox + (i % W),
          y = oy + Math.floor(i / W);
        for (let d = 0; d < 8; d++) {
          const nx = x + STEP_DX[d],
            ny = y + STEP_DY[d],
            j = ix(nx, ny);
          if (j < 0 || done[j] || !step(x, y, nx, ny)) continue;
          const nd = dist[i] + (STEP_DX[d] && STEP_DY[d] ? Math.SQRT2 : 1);
          if (nd < dist[j]) {
            dist[j] = nd;
            prev[j] = i;
            const to = Math.floor(nd) % 3;
            q[to][len[to]++] = j;
          }
        }
      }
      len[at] = 0;
    }
    return {
      steps: (x, y) => {
        const i = ix(x, y);
        return i < 0 || !done[i] ? -1 : dist[i];
      },
      /** The way from a seed to (x, y), the seed first. */
      way: (x, y) => {
        const out = [];
        for (let i = ix(x, y); i >= 0; i = prev[i]) out.push({ x: ox + (i % W), y: oy + Math.floor(i / W) });
        return out.reverse();
      },
    };
  };
  const seaNear = [];
  for (let dy = -VOYAGE_LANDFALL_PX; dy <= VOYAGE_LANDFALL_PX; dy++)
    for (let dx = -VOYAGE_LANDFALL_PX; dx <= VOYAGE_LANDFALL_PX; dx++)
      if (isWater(to.x + dx, to.y + dy)) seaNear.push({ x: to.x + dx, y: to.y + dy });
  if (!seaNear.length) return null;
  const out = yield* flood(from, [from]),
    back = yield* flood(to, seaNear);
  // the lanes' A*: from every cell the first flood reached (its steps the start's cost) to the second's (its steps the
  // end's) - a goal node past the cells, reached from an exit cell at its end's cost
  const x0 = Math.floor((Math.min(from.x, to.x) - laneMargin) / LANE_CELL),
    x1 = Math.floor((Math.max(from.x, to.x) + laneMargin) / LANE_CELL);
  const y0 = Math.floor((Math.min(from.y, to.y) - laneMargin) / LANE_CELL),
    y1 = Math.floor((Math.max(from.y, to.y) + laneMargin) / LANE_CELL);
  const bw = x1 - x0 + 1,
    bh = y1 - y0 + 1,
    n = bw * bh,
    GOAL = n;
  const g = new Float64Array(n + 1).fill(Infinity),
    came = new Int32Array(n + 1).fill(-1),
    closed = new Uint8Array(n + 1);
  const tcx = Math.floor(to.x / LANE_CELL) - x0,
    tcy = Math.floor(to.y / LANE_CELL) - y0,
    slack = LANE_END_REACH / LANE_CELL;
  const h = (c) => {
    if (c === GOAL) return 0;
    const dx = Math.abs((c % bw) - tcx),
      dy = Math.abs(Math.floor(c / bw) - tcy);
    return Math.max(0, Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) - slack);
  };
  const midOf = (c) => ({ x: (x0 + (c % bw)) * LANE_CELL + half, y: (y0 + Math.floor(c / bw)) * LANE_CELL + half });
  const open = new Heap();
  const R = Math.ceil(LANE_END_REACH / LANE_CELL);
  const fcx = Math.floor(from.x / LANE_CELL) - x0,
    fcy = Math.floor(from.y / LANE_CELL) - y0;
  for (let cy = Math.max(0, fcy - R); cy <= Math.min(bh - 1, fcy + R); cy++) {
    for (let cx = Math.max(0, fcx - R); cx <= Math.min(bw - 1, fcx + R); cx++) {
      const c = cy * bw + cx,
        m = midOf(c),
        k = out.steps(m.x, m.y);
      if (k >= 0 && wetCell(x0 + cx, y0 + cy)) {
        g[c] = k / LANE_CELL;
        open.push(g[c] + LANE_GREED * h(c), c);
      }
    }
  }
  let reached = false,
    popped = 0;
  while (open.size) {
    const c = open.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    if (c === GOAL) {
      reached = true;
      break;
    }
    if (++popped % PLAN_YIELD_CELLS === 0) yield; // PLAN-SLICES
    if (tally) tally.n++;
    const m = midOf(c),
      k = back.steps(m.x, m.y);
    if (k >= 0 && g[c] + k / LANE_CELL < g[GOAL]) {
      g[GOAL] = g[c] + k / LANE_CELL;
      came[GOAL] = c;
      open.push(g[GOAL], GOAL);
    }
    const cx = c % bw,
      cy = Math.floor(c / bw);
    for (let d = 0; d < 8; d++) {
      const dx = STEP_DX[d],
        dy = STEP_DY[d],
        nx = cx + dx,
        ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= bw || ny >= bh || !wetCell(x0 + nx, y0 + ny) || !joined(x0 + cx, y0 + cy, d))
        continue;
      const nc = ny * bw + nx,
        ng = g[c] + (dx && dy ? Math.SQRT2 : 1);
      if (ng < g[nc]) {
        g[nc] = ng;
        came[nc] = c;
        open.push(ng + LANE_GREED * h(nc), nc);
      }
    }
  }
  if (!reached) return null;
  const lane = [];
  for (let c = came[GOAL]; c !== -1; c = came[c]) lane.push(c);
  lane.reverse();
  // the route: the first flood's way into the lane, its straight runs, the second's way out of it, then ashore
  const pixels = out.way(midOf(lane[0]).x, midOf(lane[0]).y);
  if (pixels[0]?.x !== from.x || pixels[0]?.y !== from.y) return null;
  for (let i = 1; i < lane.length; i++) {
    const a = midOf(lane[i - 1]),
      b = midOf(lane[i]),
      dx = Math.sign(b.x - a.x),
      dy = Math.sign(b.y - a.y);
    for (let s = 1; s <= LANE_CELL; s++) pixels.push({ x: a.x + dx * s, y: a.y + dy * s });
  }
  // AUDIT STARTS V4: ashore at the port - its own pixel, or, where the trace's coast stands it on water (Lillandril,
  // Firsthold, Skywatch, Woodhearth: every neighbour water too, so no landfall can end on it), the nearest dry ground
  // within VOYAGE_LANDFALL_PX of it; the landfall's box padded past an end beyond the table (planRoute `endPad`: its
  // bounds stopped at the port's own row and column, and Winterhold's shore lies north and east of it)
  const last = midOf(lane[lane.length - 1]);
  const inshore = back.way(last.x, last.y).reverse();
  const goals = isWater(to.x, to.y) ? [to, nearestDry(to, isWater)].filter(Boolean) : [to];
  let ashore = null;
  for (const goal of goals) {
    ashore = yield* planRouteSteps(inshore[inshore.length - 1], goal, {
      ...opts,
      sea: { ...sea, start: 'sea' },
      margins: [VOYAGE_LANDFALL_PX * 2],
      lanes: false,
      endPad: VOYAGE_LANDFALL_PX * 2,
    });
    if (ashore) break;
  }
  if (!ashore) return null;
  pixels.push(...inshore.slice(1));
  const nearLand = (x, y) => DIR_DELTA.some(([, dx, dy]) => !isWater(x + dx, y + dy));
  // SEA-TAUT: the sailed stretch pulled taut across the open water - so the lane grid's eight headings and the floods'
  // ways are no bend the ship sails (freePull's law, at sea) - its cost the lines' own pixels
  const taut = yield* seaTautSteps(pixels, isWater, tally);
  let cost = 0;
  for (let i = 1; i < taut.length; i++) {
    lineSteps(taut[i - 1], taut[i], (ax, ay, bx, by) => {
      cost += (ax !== bx && ay !== by ? Math.SQRT2 : 1) * (nearLand(bx, by) ? SEA_COST.coast : SEA_COST.sea);
      return true;
    });
  }
  pixels.length = 0;
  pixels.push(...taut);
  const kinds = taut.slice(1).map(() => 'sea');
  pixels.push(...ashore.pixels.slice(1));
  kinds.push(...ashore.kinds);
  return { pixels, cost: cost + ashore.cost, kinds };
}

/** SEA-TAUT (bible/01-Overview/bugs/Field-Bugs-2026-10-29g.md): a sea route's pixels pulled taut - from each kept pixel
 *  to a later one whose straight line (Bresenham) runs over open water: every pixel of it water and all eight about it
 *  (the kernel builds a square from its corner bytes, so a line past a land pixel's corner may run ashore between the
 *  middles - SEA-SQUARE). The run is galloped out and then bisected, so it ends at a pixel tested clear with the next
 *  one tested not: not always the farthest clear one. Along a coast the route keeps its own steps. The ends are kept. */
export function seaTaut(pixels, isWater) {
  return drainPlan(seaTautSteps(pixels, isWater));
}
/** PLAN-SLICES: seaTaut's own body, a generator (planSeaLanesSteps) - each pixel a line asks one cell of the plan's
 *  `tally`, and a yield between two lines once PLAN_YIELD_CELLS are asked; a pixel's water and its open ground kept over
 *  the route's box, typed (AUDIT FB1029g F2: a string-keyed map, in one block, held a long voyage's last frame). */
export function* seaTautSteps(pixels, isWater, tally = null) {
  const n = pixels.length;
  if (n < 3) return pixels.slice();
  let bx = Infinity,
    by = Infinity,
    ex = -Infinity,
    ey = -Infinity;
  for (const p of pixels) {
    bx = Math.min(bx, p.x);
    by = Math.min(by, p.y);
    ex = Math.max(ex, p.x);
    ey = Math.max(ey, p.y);
  }
  bx--;
  by--; // a line between two of its pixels stays in their box; the eight about each, a pixel past it
  const W = ex - bx + 2,
    wet = new Int8Array(W * (ey - by + 2)).fill(-1),
    opens = new Int8Array(wet.length).fill(-1);
  let asked = 0,
    slice = PLAN_YIELD_CELLS;
  const water = (x, y) => {
    const i = (y - by) * W + x - bx;
    if (wet[i] < 0) wet[i] = isWater(x, y) ? 1 : 0;
    return wet[i] === 1;
  };
  const open = (x, y) => {
    const i = (y - by) * W + x - bx;
    if (opens[i] < 0) {
      opens[i] = 1;
      for (let dy = -1; dy <= 1 && opens[i]; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!water(x + dx, y + dy)) {
            opens[i] = 0;
            break;
          }
    }
    if (tally) tally.n++;
    asked++;
    return opens[i] === 1;
  };
  const clear = (a, b) => open(a.x, a.y) && lineSteps(a, b, (_ax, _ay, qx, qy) => open(qx, qy));
  const keep = [pixels[0]];
  for (let i = 0; i < n - 1;) {
    // galloped out, then narrowed - only a run tested clear is kept
    let ok = i + 1,
      bad = n,
      step = 1;
    while (ok < n - 1) {
      const t = Math.min(ok + step, n - 1);
      if (!clear(pixels[i], pixels[t])) {
        bad = t;
        break;
      }
      ok = t;
      step *= 2;
      if (asked >= slice) {
        slice = asked + PLAN_YIELD_CELLS;
        yield;
      } // PLAN-SLICES
    }
    while (bad - ok > 1) {
      const mid = (ok + bad) >> 1;
      if (clear(pixels[i], pixels[mid])) ok = mid;
      else bad = mid;
      if (asked >= slice) {
        slice = asked + PLAN_YIELD_CELLS;
        yield;
      } // PLAN-SLICES
    }
    keep.push(pixels[ok]);
    i = ok;
  }
  return keep;
}
/** Each 8-connected step of the straight line a -> b (Bresenham) asked of `step(ax, ay, bx, by)`; whether every one said
 *  yes. */
function lineSteps(a, b, step) {
  let x = a.x,
    y = a.y;
  const dx = Math.abs(b.x - a.x),
    dy = Math.abs(b.y - a.y),
    sx = a.x < b.x ? 1 : -1,
    sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err,
      px = x,
      py = y;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (!step(px, py, x, y)) return false;
  }
  return true;
}

/** AUDIT STARTS V4: the dry pixel nearest `p` within VOYAGE_LANDFALL_PX (the ring nearest first, then row, then column),
 *  or null - a port's landfall where the trace's coast stands its pixel on water. */
function nearestDry(p, isWater) {
  for (let r = 1; r <= VOYAGE_LANDFALL_PX; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !isWater(p.x + dx, p.y + dy))
          return { x: p.x + dx, y: p.y + dy };
      }
  }
  return null;
}

function* searchSteps(
  from,
  to,
  {
    roads,
    tracks,
    isWater,
    width,
    height,
    bounds,
    margin,
    maxExpansions,
    openBlocked,
    goalExempt,
    peakAt,
    sea,
    beyond = null,
    hCost = /** @type {number} */ (ROUTE_COST.road),
    tally = null,
    endLeg = null,
  },
) {
  const x0 = Math.max(bounds.x0, Math.min(from.x, to.x) - margin),
    x1 = Math.min(bounds.x1, Math.max(from.x, to.x) + margin);
  const y0 = Math.max(bounds.y0, Math.min(from.y, to.y) - margin),
    y1 = Math.min(bounds.y1, Math.max(from.y, to.y) + margin);
  const bw = x1 - x0 + 1,
    bh = y1 - y0 + 1;
  const local = (x, y) => (y - y0) * bw + (x - x0);
  const cells = bw * bh,
    layers = sea ? 3 : 1; // OWS2: a state is a cell in a layer
  const g = new Float64Array(cells * layers).fill(Infinity);
  const came = new Int32Array(cells * layers).fill(-1);
  const via = new Uint8Array(cells * layers); // the kind of step the state was reached by: an index into STEP_NAMES
  const closed = new Uint8Array(cells * layers);
  const h = (x, y) => {
    const dx = Math.abs(x - to.x),
      dy = Math.abs(y - to.y);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * hCost;
  }; // ROAD-BEYOND: the cheapest step there is (planRoute `hCost`)
  const goal = local(to.x, to.y),
    startCell = local(from.x, from.y);
  const startLayer = !sea ? 0 : sea.start === 'sea' ? AFLOAT : ASHORE;
  const seaGoal = !!sea && sea.goal === 'sea';
  const goalOk = (layer) => !sea || (seaGoal ? layer === AFLOAT : layer !== AFLOAT);
  // A PLACE STOOD ON WATER WITH NO DRY PIXEL WITHIN VOYAGE_LANDFALL_PX is landed on itself - a landfall
  // was a step onto dry ground, and 631 of the Eltheric Ocean's port isles (Syrisol Landing, Ishomere Landing) read water
  // about their town; one with dry ground in reach lands there (AUDIT STARTS V4)
  const goalIsle = !!sea && !seaGoal && isWater(to.x, to.y) && !nearestDry(to, isWater);
  // OWS2: land about a water pixel - a sailed step into it is a coast's
  const nearLand = (x, y) => {
    for (const [, dx, dy] of DIR_DELTA) if (!isWater(x + dx, y + dy)) return true;
    return false;
  };
  // AUDIT OW4 J1: THE TRAVELLER'S OWN PEAKS - the Mountain pixels joined to the start (8-connected, the search's own
  // steps, within this box): the only ones whose open steps are walked freely. None when the start is no peak
  const mine = openBlocked && peakAt && peakAt(from.x, from.y) ? new Uint8Array(cells) : null;
  if (mine) {
    mine[startCell] = 1;
    const fill = [startCell];
    while (fill.length) {
      const c = fill.pop(),
        cx = x0 + (c % bw),
        cy = y0 + Math.floor(c / bw);
      for (const [, dx, dy] of DIR_DELTA) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const n = local(nx, ny);
        if (!mine[n] && peakAt(nx, ny)) {
          mine[n] = 1;
          fill.push(n);
        }
      }
    }
  }
  const start = startLayer * cells + startCell;
  g[start] = 0;
  const open = new Heap();
  open.push(h(from.x, from.y), start);
  let expanded = 0,
    reached = -1;
  while (open.size) {
    const c = open.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    const layer = Math.floor(c / cells),
      cell = c - layer * cells;
    if (cell === goal && goalOk(layer)) {
      reached = c;
      break;
    }
    if (expanded && (expanded & (PLAN_YIELD_CELLS - 1)) === 0) yield; // PLAN-SLICES: a slice may end here
    if (tally) tally.n++;
    if (++expanded > maxExpansions) return null;
    const cx = x0 + (cell % bw),
      cy = y0 + Math.floor(cell / bw);
    const leaving = mine !== null && mine[cell] === 1;
    for (let d = 0; d < 8; d++) {
      const dx = STEP_DX[d],
        dy = STEP_DY[d],
        nx = cx + dx,
        ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const n = local(nx, ny);
      const diag = dx && dy ? Math.SQRT2 : 1;
      // OWS2: a spot on the water asked for is water, whatever its pixel's byte (a bay in a land pixel)
      const wet = sea ? isWater(nx, ny) || (seaGoal && n === goal) : false;
      let nl = layer,
        kindIx,
        step;
      if (sea && layer === AFLOAT) {
        if (wet && !(goalIsle && n === goal)) {
          // afloat: a boat never sails through a corner of the land (a diagonal between two land pixels)
          if (dx && dy && !isWater(cx + dx, cy) && !isWater(cx, cy + dy)) continue;
          kindIx = 3;
          step = diag * (nearLand(nx, ny) ? SEA_COST.coast : SEA_COST.sea);
        } else {
          // the landfall: the step up the beach, and the boat taken out - to hand again when it packs. THE MERGE: never
          // up onto the peaks (OW-MOUNTAINS) but a place's own pixel asked for
          if (peakAt && peakAt(nx, ny) && !(n === goal && goalExempt)) continue;
          if (sea.voyage && Math.max(Math.abs(nx - to.x), Math.abs(ny - to.y)) > VOYAGE_LANDFALL_PX) continue; // PASSAGE: ashore at the port she sails for
          nl = sea.again ? ASHORE : LEFT;
          kindIx = 5;
          step = diag * ROUTE_COST.open + SEA_COST.shore;
        }
      } else if (
        wet &&
        ((seaGoal && n === goal) || (n !== goal && !pavedStep(cx, cy, nx, ny, STEP_BIT[d], width, height, roads)))
      ) {
        // a place's own pixel on the water is walked into (the harbour town), a spot on it sailed to; RPT1026-WORLD CAUSEWAY: his road's step onto it walked
        if (layer !== ASHORE) continue; // no boat to hand: the sea refused
        nl = AFLOAT;
        kindIx = 4;
        step = diag * SEA_COST.sea + SEA_COST.shore; // the launch
      } else {
        // the land's step: the sea refused (never the goal - the traveller may ask for the shore), and the peaks: stepKind,
        // the one law (AUDIT OW4 J3)
        const kind = stepKind(
          cx,
          cy,
          nx,
          ny,
          STEP_BIT[d],
          width,
          height,
          roads,
          tracks,
          isWater,
          openBlocked,
          n !== goal ? 0 : goalExempt ? 2 : 1,
          leaving,
          beyond,
        );
        if (kind < 0 || (kind === 2 && endLeg && !endLeg(cx, cy, nx, ny))) continue; // ROAD-FOLLOW: by the roads, the open ground on an end's own leg alone
        kindIx = kind;
        step = diag * KIND_COST[kind];
      }
      const ns = nl * cells + n;
      if (closed[ns]) continue;
      const ng = g[c] + step;
      if (ng < g[ns]) {
        g[ns] = ng;
        came[ns] = c;
        via[ns] = kindIx;
        open.push(ng + h(nx, ny), ns);
      }
    }
  }
  if (reached < 0) return null;
  const pixels = [];
  const kinds = [];
  for (let c = reached; c !== -1; c = came[c]) {
    const cell = c % cells;
    pixels.push({ x: x0 + (cell % bw), y: y0 + Math.floor(cell / bw) });
    if (c !== start) kinds.push(STEP_NAMES[via[c]]);
  }
  pixels.reverse();
  kinds.reverse();
  return { pixels, cost: g[reached], kinds };
}

/**
 * THE LEGS a journey walks: the route's pixels after the first, a straight run of same-direction steps on the same
 * kind of ground folded into its last pixel. The last leg is always the route's last pixel. Each leg carries the kind
 * it walks on (the host's speed: a road leg reckless, the rest cautious - Travel Options' own two multipliers).
 * OW-TOWN-RING: `ringAt(x, y, from, to)` - the host's - answers the points of a town's border ring a route through
 * pixel (x, y) walks (from the side toward the pixel before to the side toward the pixel after), or null for none.
 * OW-TOWN-ROUND (2026-10-23, the owner: "Overworld pathing always wants to walk into the middle of the town let the player
 * always go around it"): a spot journey's `start` and `end` (native {x, z}) are asked of `ringAt` too (travelOptions.js
 * ringPassPoints) - a traveller beside a town walks round it, a spot beyond one is reached round it - and the spot's leg
 * carries the spot (`at`), so no road's lane is laid from the ring back to the town's middle (travelOptions.js routeLane).
 * ROAD-FOLLOW (roadLine.js roadLineLegs): a leg that turns on a curve of the roads past the Bay carries `line`, the painted
 * road's native points from the leg before's end to its own; `roadBytes` the layer's reader (the installed one's default).
 * @param {{x:number,y:number}[]} pixels
 * @param {string[]} kinds - kinds[i] is the step from pixels[i] to pixels[i + 1]
 * @param {{ ringAt?: ((x:number, y:number, from:number[]|{x:number,z:number}, to:number[]|{x:number,z:number}) => ({x:number, z:number}[]|null))|null,
 *   start?: {x:number,z:number}|null, end?: {x:number,z:number}|null, roadBytes?: (kind: string, x: number, y: number) => number }} [opts]
 * @param {[{x:number,z:number}, {x:number,z:number}]|null|false} [ends] - `[start, end]`, in place of the options' two
 * @returns {{ x:number, y:number, kind:string, at?:{x:number,z:number}, ring?:boolean, line?:Array<[number, number]> }[]}
 */
export function routeLegs(
  pixels,
  kinds = [],
  { ringAt = null, start: start0 = null, end: end0 = null, roadBytes = arenaRoadByte } = {},
  ends = null,
) {
  const legs = [],
    ix = []; // ROAD-FOLLOW: each leg's pixel's index in the route (-1: a ring's or an end's own point)
  const [start, end] = ends || [start0, end0]; // OW-TOWN-ROUND: the two ends as a pair too (the host's own call; `end && [...]`, so false for none)
  const n = pixels.length;
  const step = (i, j) => [pixels[j].x - pixels[i].x, pixels[j].y - pixels[i].y];
  // OW-TOWN-ROUND: the ends' rings - the first pixel's from the traveller to the step out (never one left under sail), the
  // last's from the step in to the spot (never one reached under sail); one pixel alone, from the traveller to the spot
  const endRing = (i, from, to) => (ringAt && from && to ? (ringAt(pixels[i].x, pixels[i].y, from, to) ?? []) : []);
  const ringStart = n > 1 && !['sea', 'landfall'].includes(kinds[0]) ? endRing(0, start, step(0, 1)) : []; // AUDIT UPDATE T5: afloat at the first pixel when its step out is sailed or a landfall - an embark starts ashore
  const ringEnd = n > 1 && !['sea', 'embark'].includes(kinds[n - 2]) ? endRing(n - 1, step(n - 1, n - 2), end) : [];
  if (n === 1) {
    const only = endRing(0, start, end);
    return only.length
      ? [
          ...only.map((at) => ({ x: pixels[0].x, y: pixels[0].y, kind: 'open', at: { x: at.x, z: at.z }, ring: true })),
          { x: pixels[0].x, y: pixels[0].y, kind: 'open', at: { x: end.x, z: end.z } },
        ]
      : legs;
  }
  for (const at of ringStart)
    legs.push({
      x: pixels[0].x,
      y: pixels[0].y,
      kind: kinds[0] === 'embark' ? 'open' : (kinds[0] ?? 'open'),
      at: { x: at.x, z: at.z },
      ring: true,
    }); // AUDIT UPDATE T5: an embark's ring walked ashore
  // OW-TOWN-RING: a pixel the route passes THROUGH (never its last - the place itself is arrived at) that holds a town
  // is walked round its border ring - the ring's points (`ringAt`: the town's own rects, travelOptions.js
  // ringPassPoints) each a leg of the incoming step's kind, aimed at its own point (`at`) and marked `ring`; the run
  // before it ends at the pixel before, so no straight leg is aimed across the town. FIELD BUGS 2026-10-21d PASSAGE-IN: never
  // a pixel reached or left under sail - the ring's points stand on the town's land, and a sailed leg aimed at one ran
  // her at the shore (15 of 312 voyages to Wayrest, Daggerfall or Sentinel passed a town on the heightmap's water).
  // AUDIT FB1021d PS-3: afloat is a pixel reached under sail or by embarking - the pixel a party embarks FROM and the one
  // it makes landfall ON are land, walked, and keep their ring (read as any step of the sea's three kinds, 13 of 432
  // crossings of my own boat lost a ring walked on foot, and one embarking walked straight across its town to the water -
  // OW-TOWN-RING's own fault back). The step in is the pixel's layer in planRoute's search: every step out of the afloat
  // layer is a sail or a landfall, and none out of the others is, so the step out says nothing more (37,217 pixels of
  // 2,997 planned crossings: never once another word)
  const afloat = (i) => ['sea', 'embark'].includes(kinds[i - 1]);
  const ring = (i) =>
    ringAt && i < pixels.length - 1 && !afloat(i)
      ? ringAt(
          pixels[i].x,
          pixels[i].y,
          [pixels[i - 1].x - pixels[i].x, pixels[i - 1].y - pixels[i].y],
          [pixels[i + 1].x - pixels[i].x, pixels[i + 1].y - pixels[i].y],
        )
      : null;
  const rings = pixels.map((_, i) => (i > 0 ? ring(i) : null));
  for (let i = 1; i < pixels.length; i++) {
    const dx = pixels[i].x - pixels[i - 1].x,
      dy = pixels[i].y - pixels[i - 1].y;
    const kind = kinds[i - 1] ?? 'open';
    const pts = rings[i];
    if (pts && pts.length) {
      for (const at of pts) legs.push({ x: pixels[i].x, y: pixels[i].y, kind, at: { x: at.x, z: at.z }, ring: true });
      continue;
    }
    if (i === n - 1 && ringEnd.length) {
      // OW-TOWN-ROUND: round the spot's own town, then the spot's own leg
      for (const at of ringEnd)
        legs.push({ x: pixels[i].x, y: pixels[i].y, kind, at: { x: at.x, z: at.z }, ring: true });
      legs.push({ x: pixels[i].x, y: pixels[i].y, kind, at: { x: end.x, z: end.z } });
      continue;
    }
    const next = pixels[i + 1];
    const same =
      next &&
      !rings[i + 1]?.length &&
      !(i + 1 === n - 1 && ringEnd.length) &&
      next.x - pixels[i].x === dx &&
      next.y - pixels[i].y === dy &&
      (kinds[i] ?? 'open') === kind;
    if (!same) {
      while (ix.length < legs.length) ix.push(-1);
      legs.push({ x: pixels[i].x, y: pixels[i].y, kind });
      ix.push(i);
    }
  }
  while (ix.length < legs.length) ix.push(-1);
  const out = roadLineLegs(legs, ix, pixels, kinds, { byteAt: roadBytes }); // On the curves past the Bay
  // its sailed legs round the kernel's land, where the host registered it (setSeaLegKernel)
  return _legKernel && _legWater && kinds.includes('sea')
    ? mendSeaLegs(
        out,
        start ?? { x: (pixels[0].x + 0.5) * 32768, z: (499 - pixels[0].y + 0.5) * 32768 },
        _legKernel,
        _legWater,
      )
    : out;
}

/**
 * OW-ROADSIDE (2026-09-28, Mac: "Sometimes routes do follow roads, but appear traveling alongside it"): WHERE A TRAVELLER
 * OFF THE ROAD JOINS IT. The first leg ran from wherever in the start pixel the traveller stood (up to 400 m off the road)
 * straight to the far end of the road's first straight run - beside the road all the way. The join is the nearest point
 * of that run's line - from the start pixel's middle to the first leg's (the road's own lane, travelPaths.js) - to the
 * traveller, clamped to the run: walked to first, the road is walked after. Native `{x, z}` in, native out.
 * @param {{x:number,z:number}} me
 * @param {{x:number,z:number}} a - the start pixel's middle
 * @param {{x:number,z:number}} b - the first leg's middle
 */
export function joinPoint(me, a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    L = dx * dx + dz * dz;
  if (!(L > 0)) return { x: a.x, z: a.z };
  const t = Math.max(0, Math.min(1, ((me.x - a.x) * dx + (me.z - a.z) * dz) / L));
  return { x: a.x + dx * t, z: a.z + dz * t };
}

/**
 * AUDIT OW3 J4: THE DRAWN ROUTE'S POINTS - the traveller, then where each leg but the last aims (a join its own point,
 * OW-ROADSIDE; the rest their pixel's middle, `centre`), then the journey's end: one point a leg, so `route.i`, a LEG
 * index, cuts the line where the walk is (AUDIT TV A1). A spot's journey drew a straight [traveller, spot] the routed walk
 * left at its first bend; both journeys draw through here. Native `{x, z}` in, `[x, z]` pairs out.
 * @param {{x:number,z:number}} me
 * @param {{x:number,y:number,at?:{x:number,z:number},line?:Array<[number, number]>}[]} legs
 * @param {{x:number,z:number}} end
 * @param {(leg: {x:number,y:number}) => number[]} centre - a leg's pixel middle, native
 */
export function routeDrawPoints(me, legs, end, centre, via = null) {
  // ROAD-FOLLOW (roadLine.js): a leg on a curve past the Bay is its line's end, the painted road's points before it its
  // `via` (drawRouteRuns draws them; a point a leg still, so `route.i` cuts the line where the walk is)
  const onRoad = (l, p) => (l?.line?.length > 1 ? Object.assign(p, { via: l.line.slice(0, -1) }) : p);
  const last = legs[legs.length - 1];
  return [
    [me.x, me.z],
    ...legs
      .slice(0, -1)
      .map((l) => (l.at ? [l.at.x, l.at.z] : onRoad(l, l.line ? [...l.line[l.line.length - 1]] : centre(l)))),
    ...(via ? [[via.x, via.z]] : []),
    onRoad(via || last?.at ? null : last, [end.x, end.z]),
  ]; // AUDIT OW-REVISITED L2-1/L2-2: where the last leg leaves its road (finalRoadVia)
}

/**
 * AUDIT OW-REVISITED L3-2 / L6-1: THE WAY STILL TO WALK - the drawn line's own (scenes/world.js travelViewRoute) as the
 * forecast reads it: from `me`, a town's streets still ahead (`route.street`'s points from the run the walk is on, `seg`
 * - the walked ones dropped: they ran the forecast's distances back through the town), the rejoin, then each leg's point
 * from the one being walked on (`natives`, one a leg - routeDrawPoints - the last leg's road end and the journey's end
 * its own). Native `[x, z]` points, and each stretch's own (`of`: the leg's index in the route, 'street' or 'join'). Null
 * with no route or no line.
 */
export function wayStillToWalk(me, route, seg, natives) {
  const n = natives ?? [];
  if (!route || n.length < 2) return null;
  const points = [[me.x, me.z]],
    of = [];
  for (const q of (route.street?.pts ?? []).slice(Math.max(0, seg | 0))) {
    points.push([q.x, q.z]);
    of.push('street');
  }
  if (route.join) {
    points.push([route.join.x, route.join.z]);
    of.push('join');
  }
  const last = (route.legs?.length ?? 1) - 1;
  for (let k = Math.min(n.length - 1, (route.i ?? 0) + 1); k < n.length; k++) {
    for (const q of [...(n[k].via ?? []), n[k]]) {
      points.push([q[0], q[1]]);
      of.push(Math.min(k - 1, last));
    } // ROAD-FOLLOW: along the painted road's curves (routeDrawPoints' `via`)
  }
  return { points, of };
}

/**
 * AUDIT OW-REVISITED L2-1 / L2-2: WHERE A ROUTE'S LAST LEG LEAVES ITS ROAD for the journey's end - a place: its leg's own
 * pixel middle, the road's end (the place's middle lies off it for the main quest's eight off-middle dungeons, whose
 * walk said "arrived" fifty metres short of them); a spot: the road's point nearest it (joinPoint), so the last run is
 * walked on the road to there and off it to the spot (it was walked on one bearing from the leg before - a click 300 m
 * beside a road walked 280 m beside it, and one past a bend cut the bend). Null where the last leg walks no road (open
 * ground, the sea, a join's or a ring's own point) or has none behind it. `mid(leg)` a leg's pixel middle, native -
 * `{x, z}` or `[x, z]`; `end` native `{x, z}`. The walk (travelOptions.js startRouteLeg) and the drawn line
 * (routeDrawPoints' `via`) ask the same.
 */
export function finalRoadVia(legs, end, mid, { place = false } = {}) {
  const last = legs?.[legs.length - 1],
    prev = legs?.[legs.length - 2];
  if (!last || !prev || !end || last.at || last.ring || (last.kind !== 'road' && last.kind !== 'track')) return null;
  const xz = (l) => {
    const v = l.at ?? mid(l);
    return Array.isArray(v) ? { x: v[0], z: v[1] } : { x: v.x, z: v.z };
  };
  const b = xz({ ...last, at: null }),
    a = xz(prev);
  return place ? b : joinPoint(end, a, b);
}

/** How much of a route is on a road or a track - the readout's "by the road" line. 0..1. OWS2: a road or a track
 *  alone - a step sailed is on neither. */
export function roadShare(kinds) {
  if (!kinds?.length) return 0;
  return kinds.filter((k) => k === 'road' || k === 'track').length / kinds.length;
}
/** AUDIT DEEP T2-1's law, and OWS2's: no water pixel on the straight line between two pixels (the resume's, and the
 *  Overworld's spot walk that asks whether the way to it crosses the water). */
export function dryLine(a, b, isWater) {
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let s = 1; s <= n; s++)
    if (isWater(Math.round(a.x + ((b.x - a.x) * s) / n), Math.round(a.y + ((b.y - a.y) * s) / n))) return false;
  return true;
}
/** OWS2: does a route put to sea - a launch, a step sailed or a landfall in it. */
export const crossesWater = (kinds) => !!kinds?.some((k) => SEA_KINDS.includes(k));
