// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE SKY-KETCH MZUNTHAR, MADE - the Rourken ship as the
// dungeon host stands it (scenes/ketch/ketchDeckHost.js), laid from the deck plan the relay judges on (net/ketch/ketchDeck.js
// - every floor, wall, spot and hazard at the law's own numbers) with the kit (world/ketch/ketchKit.js) in the Ketch's own
// dress (world/ketch/ketchArt.js):
//
//   THE STATIC SHIP (buildKetchShip): the hull - clinker bronze from the bulwarks to the keel, a gilt rub-rail, lit ports,
//     the keel fin, the flippers, the outrigger horns; the Anchor Deck and its anchor-lift; the waist, its bulwarks and the
//     rigging nets above them (the nets are the collider's walls - nobody leaves a deck over them), its capstans and hatch
//     covers, the hatch's coaming and stair; the quarter wall and its sealed door; the engine house aft of it; the gun deck,
//     its gun ports, its hammers' housings, its steam pipes, the landing and the hold's stair; the hold, its ribs, the
//     Starved Engine, its sockets, its cradles, its arc-coils' posts and its vents; the mast-lift's tower; the main top, the
//     yard and the Sailwalk's first top; the gangway; the bridge's core, its inlay, its helm and console, its spires and its
//     two cradles; the Ketchmaster's cabin, its chest and its stern lift; her two masts (a ketch's) with their sail-vanes and rigging; the
//     lamps. With it the collider's one bucket (`hit`), and the lamps as the light list takes them.
//   THE PARTS that move or come and go (buildKetchParts): a hammer's head, the lift's cage (and its gates), the two hatch
//     grates, the cabin's doors, the bridge's eight outer sections (each its own mesh and collider - each falls alone),
//     the resonators' heads (true and false), an aether cell, a tuning-fork, an arc's four frames, the bosun's line.
//   THE LAND BELOW (buildKetchGround): the fields outside Daggerfall and the city itself far under the keel, drawn in the
//     haze - noShadow, never collided.
//
// Every number of a place a body stands is the law's; the dress (a rail's height, a lamp's place) is this file's.
//
// Not a DFU member. Ledger A (KETCH).
import {
  KT_ANCHOR, KT_WAIST, KT_GALLERY, KT_LANDING, KT_HOLD, KT_HATCH, KT_HOLD_HATCH, KT_QUARTER_WALL, KT_ANCHOR_LIFT, KT_LIFT, KT_MAIN_TOP, KT_YARD,
  KT_LINE, KT_LINE_LAND, KT_RAIL_R, railRuns, KT_GUN_ZS, KT_GUN_DEPTH, KT_COURSE, KT_COURSE_SPEC, KT_GANGWAY, KT_BRIDGE, KT_HELM, KT_CONSOLE, KT_RESONATORS, KT_BRIDGE_CRADLES, KT_SECTIONS, sectionAt, KT_CABIN,
  KT_CABIN_DOOR, KT_VAULT, KT_STERN_LIFT, KT_WAIST_COVER, KT_WARDEN_POSTS, KT_ENGINE, KT_SOCKETS, KT_CRADLES, KT_VENTS, KT_HAMMER, KT_STEAM,
  KT_ARCS, KT_DECK_H, KT_MAIN_MAST, deckToDungeon,
} from '../../net/ketch/ketchDeck.js';
import { faces } from '../gate/gateModel.js';
import { ketchKit, packKetchFaces, packKetchHit, KT_TILE_M } from './ketchKit.js';
import { KT_REC as R, KT_NET_M } from './ketchArt.js';

// ── the dress's numbers ─────────────────────────────────────────────────────────────────────────────────────────
/** A floor's thickness (its underside is the ceiling of the room below). */
export const KT_FLOOR_T = 0.3;
/** The bulwarks' height and thickness; the rigging nets' top over a deck (and the collider's wall to it). */
export const KT_BULWARK = Object.freeze({ h: 1.4, t: 0.35 });
export const KT_NET_TOP = 7;
/** The waist's and the Anchor Deck's lid - unseen, the collider's alone: over every netted deck at KT_NET_TOP, so nobody
 *  climbs out over the quarter wall or the nets. */
export const KT_LID_Y = KT_NET_TOP;
/** A rail's height (the main top, the yard, the gangway, the stairs), and the nets over the high decks (m above their deck). */
export const KT_RAIL_H = 1.1;
export const KT_HIGH_NET = 3.4;
/** The engine house aft of the quarter wall: its walls' inset from the hull's sides, its eaves and its ridge. */
export const KT_HOUSE = Object.freeze({ x: 11, z0: KT_QUARTER_WALL.z + 0.6, z1: 170, eave: 8, ridge: 12.5 });
/** The hull's outline's keel and bilge (deck y): the sides run from the bulwark's top to the bilge, then in to the keel. */
export const KT_HULL = Object.freeze({ bilge: -14, keel: -20, fin: -25, rub: -2 });
/** KETCH-FIX: is a run of the hull's outline (`a` to `b`, deck [x, z]) solid below her deck - every run but one the
 *  anchor-lift's cage rises past (a body's reach to spare). Pure. */
export function hullRunSolid(a, b) {
  const L = KT_ANCHOR_LIFT, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((L.x - a[0]) * dx + (L.z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a[0] + dx * t - L.x, a[1] + dz * t - L.z) > L.r + 1;
}
/** The lift's cage: its floor's half side, its walls' height, its roof's peak over its floor. */
export const KT_CAGE = Object.freeze({ half: 2.6, h: 2.8, peak: 4.4 });
/** The cage's floor stands this far over its own zero - over the hold's floor at its foot, never in it. */
export const KT_CAGE_LIFT_M = 0.02;

/** The shaft's wall thickness; the door in its west face at the hold (z0..z1, its height). */
export const KT_SHAFT = Object.freeze({ t: 0.3, door: Object.freeze({ z0: KT_LIFT.z - 2, z1: KT_LIFT.z + 2, h: 3.2 }) });
/** The masts - a ketch's two: each `{ x, z, y0, y1, r, vanes: [lo, hi, reach] }` - the main, the taller, stands on the
 *  waist beside the lift's tower and pierces the main top; the mizzen, shorter, stands aft on the engine house. */
export const KT_MASTS = Object.freeze([
  Object.freeze({ x: KT_MAIN_MAST.x, z: KT_MAIN_MAST.z, y0: 0, y1: 52, r: KT_MAIN_MAST.r, vanes: Object.freeze([24, 48, 26]) }),
  Object.freeze({ x: 0, z: 140, y0: KT_HOUSE.ridge, y1: 42, r: 0.65, vanes: Object.freeze([22, 38, KT_COURSE_SPEC.start.x]) }),
]);
/** How far aft of its mast each mast's fan of vanes and its spar stand. */
export const KT_VANE_DZ = 1.2;
/** THE JACKSTAY: a brass spar over the Sailwalk's line (`x`), from the main mast's vane-spar (`fore`, its height and z) aft
 *  to the mizzen's, whose spar reaches out to the line - every checkpoint's three chains hang from it (AUDIT KETCH L4-13:
 *  they ended in the empty sky). */
export const KT_JACKSTAY = Object.freeze({
  x: KT_COURSE_SPEC.start.x,
  fore: Object.freeze({ y: (KT_MASTS[0].vanes[0] + KT_MASTS[0].vanes[1]) / 2, z: KT_MASTS[0].z + KT_VANE_DZ }),
  aft: Object.freeze({ y: (KT_MASTS[1].vanes[0] + KT_MASTS[1].vanes[1]) / 2, z: KT_MASTS[1].z + KT_VANE_DZ }),
});
/** The jackstay's height over a z between its ends. */
export function jackstayY(z) {
  const { fore: a, aft: b } = KT_JACKSTAY;
  return a.y + ((b.y - a.y) * (z - a.z)) / (b.z - a.z);
}
/** The ground under the keel (deck y), its tile (m a picture), how far it runs; the city of Daggerfall's place and size. */
export const KT_GROUND = Object.freeze({ y: -260, tile: 420, half: 3200 });
/** THE KETCH'S STATION over the fields outside Daggerfall (scenes/ketch/ketchSky.js): the deck's origin (the Anchor Deck's fore
 *  rail) from the city's centre, metres east (`x`) and north (`z`) - the bow to the south, the city off the starboard side. The
 *  city is eight blocks a side (819.2 m, its pixel whole), so 700 m east stands the anchor-lift some 290 m outside the
 *  east wall. One home: the land below the made level draws the city where the world has it. */
export const KT_STATION = Object.freeze({ x: 700, z: -140 });
/** The city below, as the made level draws it: where the station puts its centre (deck metres), its walls' reach. */
export const KT_CITY = Object.freeze({ x: -KT_STATION.x, z: -KT_STATION.z, r: 400, towers: 24, houses: 340, seed: 0x6b1c });
/** THE LAMPS: each the light list's shape at its glass; their colours (below decks warmer) and reach. */
export const KT_LAMP = Object.freeze({ color: Object.freeze([1.0, 0.8, 0.5]), below: Object.freeze([1.0, 0.7, 0.4]), range: 11, rangeBelow: 9, glass: 0.16 });

const BRIDGE_C = KT_BRIDGE;
/** The hull's outline (deck [x, z], round the ship anticlockwise seen from above): the bow's taper, the long sides, round
 *  the bridge's disc, about the cabin and back. */
export function ketchHullOutline(steps = 10) {
  const out = [[-4, 0], [4, 0], [8, 6], [KT_ANCHOR.x1, KT_ANCHOR.z1], [KT_WAIST.x1, KT_WAIST.z0]];
  const joinA = Math.atan2(KT_WAIST.x1, -Math.sqrt(BRIDGE_C.r ** 2 - KT_WAIST.x1 ** 2));   // where the side meets the disc
  const cabinA = Math.atan2(KT_CABIN.x1, Math.sqrt(BRIDGE_C.r ** 2 - KT_CABIN.x1 ** 2));
  const arc = (a0, a1) => { for (let k = 0; k <= steps; k++) { const a = a0 + ((a1 - a0) * k) / steps; out.push([BRIDGE_C.x + Math.sin(a) * BRIDGE_C.r, BRIDGE_C.z + Math.cos(a) * BRIDGE_C.r]); } };
  arc(joinA, cabinA);
  out.push([KT_CABIN.x1, KT_CABIN.z1], [KT_CABIN.x0, KT_CABIN.z1]);
  arc(-cabinA, -joinA);
  out.push([KT_WAIST.x0, KT_WAIST.z0], [KT_ANCHOR.x0, KT_ANCHOR.z1], [-8, 6]);
  return out;
}

/** THE LAMPS BELOW DECKS THAT HANG (KETCH-LOOK KL1, Sky-Ketch-Look.md section 5 - "light where it means something"): one
 *  under each hammer row's middle housing, `rowDz` aft of its head (2.5 m square - its wind-up never reaches the glass), so
 *  each slam lands in its row's pool, and the way-on lamp at the Watch hatch's stair's foot (`wayOnZ` - LAMP's own place,
 *  the made way: the corridor's fore 16 m had no lamp and read at p50 0.035); in the hold one over each cradle (`cradleX`
 *  either side) and down the middle where the hold's stair leaves room (`middleZ` - the middle cradle row's own place is
 *  the stair's: KT_HOLD_HATCH, a body's head on it at y -6.45), a ninth over the arcs' aisle; and a ring of four round the
 *  engine (`engine` from its axis on the diagonals); the Wardens' landing's four from its ceiling over its floor either
 *  side of the hold's hatch (`landing`: x and the two z - on its walls they left the landing at p50 0.072); each glass
 *  `drop` under the gun deck's ceiling over the hammers' lanes, `holdDrop` under the landing's and the hold's (a lamp 4 m
 *  over the hold's floor burned a pool at p95 0.28 by the lift's door, over the telegraphs' 0.25; at 4.9 m, 0.25). */
export const KT_HUNG_LAMPS = Object.freeze({
  rowDz: 1.8, wayOnZ: 62.5, cradleX: 7, middleZ: Object.freeze([112, 126, 100]), engine: 4.5,
  landing: Object.freeze({ x: 5, z: Object.freeze([114, 124]) }), drop: 1.7, holdDrop: 0.8,
});
/** The lamps' places (deck [x, y, z] - a fourth, the ceiling's y, for a lamp that hangs): her open decks' (`up`), below
 *  decks' and the cabin's. 49: 23 on deck, 24 below, 2 in the cabin - the gallery's ten wall lamps became its six rows'
 *  and its way-on lamp, the hold's twelve its nine and its engine's four (KETCH-LOOK KL1: a wall lamp every 12 m left the
 *  24 m hold's middle and the hammers' lanes black; the plan's 48 left the gallery's fore end dark - the way-on lamp is
 *  the one more). */
export function ketchLampSpots() {
  const up = [], below = [], cabin = [];
  for (const z of [20, 32, 44, 56]) for (const x of [KT_WAIST.x0 + KT_BULWARK.t + 0.2, KT_WAIST.x1 - KT_BULWARK.t - 0.2]) up.push([x, 2.3, z]);   // KL1: clear of the net's face (its glass stood a centimetre into it)
  up.push([-3.2, 3.6, KT_QUARTER_WALL.z - 0.4], [3.2, 3.6, KT_QUARTER_WALL.z - 0.4], [-6, 2.3, 8], [6, 2.3, 8]);
  const HL = KT_HUNG_LAMPS, gCeil = -KT_FLOOR_T, hCeil = KT_GALLERY.y - KT_FLOOR_T;
  for (const z of [HL.wayOnZ, ...KT_HAMMER.rows.map((r) => r + HL.rowDz)]) below.push([0, gCeil - HL.drop, z, gCeil]);
  for (const z of HL.landing.z) for (const sx of [-1, 1]) below.push([sx * HL.landing.x, gCeil - HL.holdDrop, z, gCeil]);
  for (const [x, z] of KT_CRADLES) below.push([Math.sign(x) * HL.cradleX, hCeil - HL.holdDrop, z, hCeil]);
  for (const z of HL.middleZ) below.push([0, hCeil - HL.holdDrop, z, hCeil]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) below.push([KT_ENGINE.x + sx * HL.engine, hCeil - HL.holdDrop, KT_ENGINE.z + sz * HL.engine, hCeil]);
  up.push([KT_MAIN_TOP.x - 4.2, KT_MAIN_TOP.y + 2.4, KT_MAIN_TOP.z - 4.2], [KT_MAIN_TOP.x + 4.2, KT_MAIN_TOP.y + 2.4, KT_MAIN_TOP.z + 4.2]);   // KL1: inside the top's rail (on its rim, 6.5 m out, the glass stood in the net)
  up.push([KT_COURSE_SPEC.start.x, KT_COURSE_SPEC.start.y + 2.4, KT_COURSE_SPEC.start.z + 2.4]);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * (Math.PI / 4); up.push([BRIDGE_C.x + Math.sin(a) * (BRIDGE_C.core - 0.6), 2.6, BRIDGE_C.z + Math.cos(a) * (BRIDGE_C.core - 0.6)]); }
  cabin.push([-4, 3.6, KT_CABIN.z0 + 3], [4, 3.6, KT_CABIN.z1 - 3]);
  return { up, below, cabin };
}
/** THE LAMPS as the light list takes them: `{ x, y, z, range, color, zone }` in the dungeon's frame, at each lamp's glass -
 *  `zone` the room it lights, 'deck' (her open decks), 'below' or 'cabin': its gain the zone's (KETCH-LOOK KL1, world/ketch/
 *  ketchAtmos.js KT_HOURS `lamps`); below decks and in the cabin the warmer glass. */
export function ketchLights() {
  const { up, below, cabin } = ketchLampSpots();
  const L = (p, color, range, zone) => { const [x, y, z] = deckToDungeon(p[0], p[1], p[2]); return { x, y, z, range, color: [...color], zone }; };
  return [...up.map((p) => L(p, KT_LAMP.color, KT_LAMP.range, 'deck')), ...below.map((p) => L(p, KT_LAMP.below, KT_LAMP.rangeBelow, 'below')), ...cabin.map((p) => L(p, KT_LAMP.below, KT_LAMP.rangeBelow, 'cabin'))];
}

/** A lamp: its glass box about `p` under its cap, on its bracket's post - or, one that hangs (`p[3]` its ceiling's y), on
 *  its rod up to the ceiling. */
function lamp(K, p) {
  const g = KT_LAMP.glass;
  K.box(R.lamp, p[0] - g, p[0] + g, p[1] - g, p[1] + g, p[2] - g, p[2] + g);
  K.box(R.brass, p[0] - g * 1.3, p[0] + g * 1.3, p[1] + g, p[1] + g + 0.06, p[2] - g * 1.3, p[2] + g * 1.3);
  if (p.length > 3) K.box(R.brass, p[0] - 0.03, p[0] + 0.03, p[1] + g + 0.06, p[3], p[2] - 0.03, p[2] + 0.03, { skip: ['top'] });
  else K.box(R.brass, p[0] - 0.03, p[0] + 0.03, p[1] - g - 0.5, p[1] - g, p[2] - 0.03, p[2] + 0.03, { skip: ['bottom'] });
}
/** KETCH-FIX (2026-10-25): THE AFT DECK - from the engine house's aft wall to the bridge's disc, its edge the disc's own rim
 *  (`[x, z]` round it, a fan's hub first: the rim is all in sight of the wall's middle, so the fan never crosses the disc).
 *  It was never laid: the hull's dark lay open under a jump over the bridge's fore rail. Pure. */
export function ketchAftDeck(n = 16) {
  const B = KT_BRIDGE, X = KT_WAIST.x1, z0 = KT_HOUSE.z1, a = Math.asin(X / B.r), pts = [[0, z0], [X, z0]];
  for (let k = 0; k <= n; k++) { const t = Math.PI - a + (2 * a * k) / n; pts.push([B.x + Math.sin(t) * B.r, B.z + Math.cos(t) * B.r]); }
  pts.push([-X, z0]);
  return pts;
}

/** A bulwark along a polyline at deck `y`: its inner face (iron), its brass cap, solid to its top; the rigging net over it to
 *  `net` above the deck, its wall solid. `inside` a point on the deck's side. */
function bulwark(K, pts, y, inside, net = KT_NET_TOP) {
  const B = KT_BULWARK;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 1e-6) continue;
    let nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L;
    const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
    if ((inside[0] - mx) * nx + (inside[1] - mz) * nz < 0) { nx = -nx; nz = -nz; }   // n points inboard
    const ip = [p[0] + nx * B.t, p[1] + nz * B.t], iq = [q[0] + nx * B.t, q[1] + nz * B.t];
    K.quad(R.iron, [ip[0], y, ip[1]], [iq[0], y, iq[1]], [iq[0], y + B.h, iq[1]], [ip[0], y + B.h, ip[1]], [nx, 0, nz], null, true);
    K.quad(R.brass, [p[0], y + B.h, p[1]], [q[0], y + B.h, q[1]], [iq[0], y + B.h, iq[1]], [ip[0], y + B.h, ip[1]], [0, 1, 0]);
    if (net > B.h) {
      K.quad2(R.net, [p[0], y + B.h, p[1]], [q[0], y + B.h, q[1]], [q[0], y + net, q[1]], [p[0], y + net, p[1]], [nx, 0, nz], [[0, 0], [L / KT_NET_M, 0], [L / KT_NET_M, (net - B.h) / KT_NET_M], [0, (net - B.h) / KT_NET_M]]);   // KETCH-LOOK KL2: a diamond a cell
      K.quad(null, [ip[0], y, ip[1]], [iq[0], y, iq[1]], [iq[0], y + net, iq[1]], [ip[0], y + net, ip[1]], [nx, 0, nz], null, true);
      // the net's top cord and the shroud posts it hangs from, a post each four metres
      K.pipe(R.brass, [p[0], y + net, p[1]], [q[0], y + net, q[1]], 0.05, 6);
      const m = Math.max(1, Math.round(L / 4));
      for (let k = 0; k <= m; k++) { const x = p[0] + ((q[0] - p[0]) * k) / m, z = p[1] + ((q[1] - p[1]) * k) / m; K.pipe(R.brass, [x, y + B.h, z], [x, y + net, z], 0.06, 6); }
    }
  }
}

/** A checkpoint's three chains, each `[foot, head]`: from inside its floor's rim up to the jackstay over it. */
export function ketchCheckpointChains(c) {
  const head = [KT_JACKSTAY.x, jackstayY(c.z), c.z], out = [];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + Math.PI / 2; out.push([[c.x + Math.sin(a) * (c.r - 0.3), c.y + 0.1, c.z + Math.cos(a) * (c.r - 0.3)], head]); }
  return out;
}

/** The gangway's sill, its corners ([x, z] round it): along its head's edge on the course's side, the gangway's width and
 *  a hand over each rail, 0.3 m out over the sky and 0.1 m in on its planks (AUDIT KETCH L4-14: it lay square to the deck,
 *  across the last plank's far edge, in the air before the slanted head). */
export function ketchGangwaySill() {
  const W = KT_GANGWAY, L = Math.hypot(W.bx - W.ax, W.bz - W.az), ux = (W.bx - W.ax) / L, uz = (W.bz - W.az) / L, h = W.w / 2 + 0.1;
  const at = (s, u) => [W.ax - uz * s * h + ux * u, W.az + ux * s * h + uz * u];
  return [at(1, -0.3), at(1, 0.1), at(-1, 0.1), at(-1, -0.3)];
}

/**
 * THE STATIC SHIP: `{ model, hit, lights, lamps }` - the mesh (renderer.createMesh's shape, the dungeon's frame), the
 * collider's one bucket (the flat xyz list), the lamps' lights, and the lamps themselves (their glass, caps and posts): a
 * mesh of their own the deck draws casting no shadow. KETCH-LOOK KL1: in the ship's mesh every lamp's glass boxed its own
 * light in - each cube shadow map recorded its own glass round it, so no lamp aboard lit anything (the hold's floor under
 * a lamp at eight times its colour read as the dark between them). Pure; the same ship every call.
 */
export function buildKetchShip() {
  const hit = [];
  const K = ketchKit({ f: faces(), hit });
  const T = KT_FLOOR_T, B = KT_BULWARK;

  // ── THE HULL ─────────────────────────────────────────────────────────────────────────────────────────────────
  const outline = ketchHullOutline();
  const cxz = [0, 118];
  const toward = (p, k) => [p[0] + (cxz[0] - p[0]) * k, p[1] + (cxz[1] - p[1]) * k];
  const bilge = outline.map((p) => [p[0] * 0.94, p[1] + (p[1] < 60 ? 1.2 : p[1] > 200 ? -1.2 : 0)]);
  const keel = outline.map((p) => [p[0] * 0.32, Math.max(8, Math.min(230, p[1]))]);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length, a = outline[i], b = outline[j], c = bilge[i], d = bilge[j], e = keel[i], g = keel[j];
    const out = [(a[0] + b[0]) / 2 - cxz[0], 0, (a[1] + b[1]) / 2 - cxz[1]];
    K.quad(R.hull, [a[0], B.h, a[1]], [b[0], B.h, b[1]], [d[0], KT_HULL.bilge, d[1]], [c[0], KT_HULL.bilge, c[1]], out);
    // KETCH-FIX (2026-10-25): her sides solid below her deck, in their own plane, and her bilge to her keel - drawn only, a
    // body down her side passed through into the void between the gun deck's walls and the hull and stood on the hold's
    // ceiling (its top never drawn). Never the bow's run the anchor-lift's cage rides up through; above the deck the
    // bulwarks stand
    if (hullRunSolid(a, b)) { const k = (B.h + T) / (B.h - KT_HULL.bilge), pa = [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k], pb = [b[0] + (d[0] - b[0]) * k, b[1] + (d[1] - b[1]) * k]; K.quad(null, [pa[0], -T, pa[1]], [pb[0], -T, pb[1]], [d[0], KT_HULL.bilge, d[1]], [c[0], KT_HULL.bilge, c[1]], out, null, true); }
    K.quad(R.hull, [c[0], KT_HULL.bilge, c[1]], [d[0], KT_HULL.bilge, d[1]], [g[0], KT_HULL.keel, g[1]], [e[0], KT_HULL.keel, e[1]], [out[0], -0.8, out[2]], null, hullRunSolid(a, b));
    // the rub-rail: gilt, a hand's width proud of the hull at KT_HULL.rub
    const lift = (p, k) => { const L = Math.hypot(p[0] - cxz[0], p[1] - cxz[1]) || 1; return [p[0] + ((p[0] - cxz[0]) / L) * k, p[1] + ((p[1] - cxz[1]) / L) * k]; };
    const ra = lift(a, 0.08), rb = lift(b, 0.08);
    K.quad(R.gilt, [ra[0], KT_HULL.rub - 0.25, ra[1]], [rb[0], KT_HULL.rub - 0.25, rb[1]], [rb[0], KT_HULL.rub + 0.25, rb[1]], [ra[0], KT_HULL.rub + 0.25, ra[1]], out);
    // the lit ports along the long sides, at the gun deck's and the hold's heights
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > 20) for (let s = 6; s < L - 3; s += 6) for (const y of [KT_GALLERY.y + 2.6, KT_HOLD.y + 2.8]) {
      const t0 = (s - 0.5) / L, t1 = (s + 0.5) / L, k = y < KT_GALLERY.y ? 1 - (KT_GALLERY.y - y) / 20 : 1;
      const pa = lift([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], 0.05 * k), pb = lift([a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1], 0.05 * k);
      K.quad(R.glass, [pa[0], y - 0.5, pa[1]], [pb[0], y - 0.5, pb[1]], [pb[0], y + 0.5, pb[1]], [pa[0], y + 0.5, pa[1]], out);
    }
  }
  // the keel's foot and the keel fin
  K.fan(R.hull, keel.slice().reverse(), KT_HULL.keel, [0, -1, 0], true);   // KETCH-FIX: her bottom shut too (it starts aft of the anchor-lift, z 8)
  K.quad2(R.hull, [0, KT_HULL.keel, 14], [0, KT_HULL.keel, 214], [0, KT_HULL.fin, 196], [0, KT_HULL.fin, 30], [1, 0, 0]);
  // THE FLIPPERS: two great sail-vanes out from the hull's sides under the engine house, and two at the stern
  for (const s of [-1, 1]) {
    K.quad2(R.vane, [s * 12.6, -7, 118], [s * 12.6, -7, 150], [s * 34, -10, 156], [s * 36, -9, 126], [0, 1, 0], [[0.5, 1], [0.5, 1], [1, 0], [0, 0]]);
    K.quad2(R.vane, [s * 20, -6, 206], [s * 18, -6, 226], [s * 30, -9, 236], [s * 34, -8, 214], [0, 1, 0], [[0.5, 1], [0.5, 1], [1, 0], [0, 0]]);
    // THE OUTRIGGER HORNS: the keel-song's two great brass horns on struts from the hull, their bells aft
    const hx = s * 22, hy = -9, hz0 = 70, hz1 = 112;
    K.pipe(R.brass, [hx, hy, hz0], [hx, hy, hz1], 1.6, 12, { caps: true });
    K.cone(R.brass, [hx, hy, hz1 + 6], [hx, hy, hz1 - 2], 3.4, 12);
    K.cone(R.copper, [hx, hy, hz0], [hx, hy, hz0 - 6], 1.6, 12);
    K.pipe(R.iron, [s * 12.8, -4, 84], [hx, hy, 84], 0.35, 6);
    K.pipe(R.iron, [s * 12.8, -4, 100], [hx, hy, 100], 0.35, 6);
  }
  // THE BOWSPRIT and its gilt ram, and the anchor-lift's davit
  K.pipe(R.brass, [0, 1.2, 1], [0, 8, -20], 0.5, 10, { caps: true });
  K.cone(R.gilt, [0, 8, -20], [0, 9.2, -25], 0.9, 10);
  K.pipe(R.iron, [0, B.h, 1.5], [0, 9, 1.5], 0.25, 8);
  K.pipe(R.iron, [0, 9, 1.5], [0, 9, KT_ANCHOR_LIFT.z], 0.2, 6);

  // ── THE ANCHOR DECK AND THE WAIST ─────────────────────────────────────────────────────────────────────────────
  const bow = [[-4, 0], [4, 0], [8, 6], [KT_ANCHOR.x1, KT_ANCHOR.z1], [KT_ANCHOR.x0, KT_ANCHOR.z1], [-8, 6]];
  K.fan(R.deck, bow, 0, [0, 1, 0], true);
  const shaft = [KT_LIFT.x - KT_LIFT.half, KT_LIFT.x + KT_LIFT.half, KT_LIFT.z - KT_LIFT.half, KT_LIFT.z + KT_LIFT.half];
  const hatch = [KT_HATCH.x0, KT_HATCH.x1, KT_HATCH.z0, KT_HATCH.z1];
  K.slabWithHoles(R.deck, KT_WAIST.x0, KT_WAIST.x1, KT_WAIST.z0, KT_QUARTER_WALL.z, 0, [hatch, shaft], [0, 1, 0], true);
  // the deck strips outboard of the engine house, and aft of it to the bridge's disc - solid (KETCH-FIX, 2026-10-25: drawn
  // only, and the deck between the house and the disc not laid at all, a running jump over the bridge's fore rail fell
  // into the hull's dark below them)
  for (const s of [-1, 1]) K.quad(R.deck, [s * KT_HOUSE.x, 0, KT_HOUSE.z0], [s * KT_WAIST.x1, 0, KT_HOUSE.z0], [s * KT_WAIST.x1, 0, KT_HOUSE.z1], [s * KT_HOUSE.x, 0, KT_HOUSE.z1], [0, 1, 0], null, true);
  K.fan(R.deck, ketchAftDeck(), 0, [0, 1, 0], true);
  // the bulwarks and the nets: round the bow and down both sides to the quarter wall (and on, outboard of the house)
  const fore = [[KT_WAIST.x0, 179], [KT_WAIST.x0, KT_WAIST.z0], [KT_ANCHOR.x0, KT_ANCHOR.z1], [-8, 6], [-4, 0], [4, 0], [8, 6], [KT_ANCHOR.x1, KT_ANCHOR.z1], [KT_WAIST.x1, KT_WAIST.z0], [KT_WAIST.x1, 179]];
  bulwark(K, fore, 0, [0, 30]);
  // THE LID (the collider's alone): over the Anchor Deck and the waist at KT_LID_Y, the lift's tower left open
  K.fan(null, bow, KT_LID_Y, [0, -1, 0], true);
  K.slabWithHoles(null, KT_WAIST.x0, KT_WAIST.x1, KT_WAIST.z0, KT_QUARTER_WALL.z, KT_LID_Y, [shaft], [0, -1, 0], true);
  // the waist's cover: two capstans, three hatch covers - drawn and solid
  for (const c of KT_WAIST_COVER.capstans) {
    K.cyl(R.iron, c.x, c.z, c.r, 0, c.h * 0.6, 14, { top: false, solid: true });
    K.cyl(R.brass, c.x, c.z, c.r * 0.82, c.h * 0.6, c.h, 14, { solid: true, capRec: R.gear });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; K.pipe(R.iron, [c.x, c.h * 0.85, c.z], [c.x + Math.sin(a) * (c.r + 0.7), c.h * 0.85, c.z + Math.cos(a) * (c.r + 0.7)], 0.06, 6); }
  }
  for (const c of KT_WAIST_COVER.covers) {
    K.box(R.iron, c.x - c.w / 2, c.x + c.w / 2, 0, c.h, c.z - c.d / 2, c.z + c.d / 2, { skip: ['bottom'], solid: true, recs: { top: R.grate } });
    K.box(R.brass, c.x - c.w / 2 - 0.05, c.x + c.w / 2 + 0.05, c.h - 0.08, c.h + 0.02, c.z - c.d / 2 - 0.05, c.z + c.d / 2 + 0.05, { skip: ['bottom', 'top'] });
  }
  // THE ANCHOR-LIFT: its round floor (brass, a hair proud), its six posts and its crown ring, the chain up to the davit
  const AL = KT_ANCHOR_LIFT;
  K.sector(R.brass, AL.x, AL.z, 0, AL.r, 0, Math.PI * 2, 0.02, 24, { faceUv: true });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; K.pipe(R.brass, [AL.x + Math.sin(a) * AL.r, 0, AL.z + Math.cos(a) * AL.r], [AL.x + Math.sin(a) * AL.r, 3, AL.z + Math.cos(a) * AL.r], 0.06, 6); }
  for (let k = 0; k < 24; k++) { const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2; K.pipe(R.brass, [AL.x + Math.sin(a0) * AL.r, 3, AL.z + Math.cos(a0) * AL.r], [AL.x + Math.sin(a1) * AL.r, 3, AL.z + Math.cos(a1) * AL.r], 0.07, 5); }
  K.pipe(R.chain, [AL.x, 3, AL.z], [AL.x, 9, AL.z], 0.12, 4);
  // THE QUARTER WALL and its sealed door
  K.box(R.stone, KT_WAIST.x0, KT_WAIST.x1, 0, KT_QUARTER_WALL.h, KT_QUARTER_WALL.z, KT_QUARTER_WALL.z + 0.6, { skip: ['bottom'], solid: true });
  K.box(R.gilt, -1.9, 1.9, 0, 4, KT_QUARTER_WALL.z - 0.12, KT_QUARTER_WALL.z, { skip: ['bottom', 'pz'] });
  K.box(R.iron, -1.5, 1.5, 0, 3.6, KT_QUARTER_WALL.z - 0.18, KT_QUARTER_WALL.z - 0.12, { skip: ['bottom', 'pz'] });
  K.cyl(R.gear, 0, KT_QUARTER_WALL.z - 0.2, 0.9, 1.4, 1.42, 16);
  // THE HATCH: its coaming on three sides (open at its head, where the stair begins), the stair down, its rails
  const H = KT_HATCH;
  K.box(R.brass, H.x0 - 0.2, H.x0, 0, 0.35, H.z0, H.z1 + 0.2, { skip: ['bottom'], solid: true });
  K.box(R.brass, H.x1, H.x1 + 0.2, 0, 0.35, H.z0, H.z1 + 0.2, { skip: ['bottom'], solid: true });
  K.box(R.brass, H.x0, H.x1, 0, 0.35, H.z1, H.z1 + 0.2, { skip: ['bottom'], solid: true });
  K.rail([[H.x0 - 0.1, H.z0], [H.x0 - 0.1, H.z1]], 0.35, { h: 0.8, postRec: R.brass, barRec: R.brass });
  K.rail([[H.x1 + 0.1, H.z0], [H.x1 + 0.1, H.z1]], 0.35, { h: 0.8, postRec: R.brass, barRec: R.brass });
  K.stairs(R.deck, H.x0, H.x1, H.z0, H.z1, H.y0 - T, H.y1, 20, { riserRec: R.brass, soffitRec: R.iron });
  // the stairwell's two side walls, the deck's thickness down to the gun deck's head
  for (const x of [H.x0, H.x1]) K.quad(R.iron, [x, -T, H.z0], [x, -T, H.z1], [x, 0, H.z1], [x, 0, H.z0], [x < 0 ? 1 : -1, 0, 0]);

  // ── THE ENGINE HOUSE ─────────────────────────────────────────────────────────────────────────────────────────
  const HO = KT_HOUSE;
  // solid whole - its walls, its eaves' lid and its roof (KETCH-FIX, 2026-10-25, the owner: "The invisable panels cam fuck
  // up players"): drawn only, a running jump over the bridge's fore rail walked through its aft wall, stood on the gun
  // deck's ceiling (its top never drawn) or fell into the hull's void past it, and climbed the quarter wall's back onto the
  // waist's lid (unseen, the collider's alone) - every invisible floor and wall a body found began in here
  K.box(R.stone, -HO.x, HO.x, 0, HO.eave, HO.z0, HO.z1, { skip: ['bottom', 'top'], recs: { nz: R.stone }, solid: true });
  // its roof: a barrel of plates from eave to ridge, in eight strakes a side
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * (Math.PI / 2), a1 = ((k + 1) / 8) * (Math.PI / 2);
    for (const s of [-1, 1]) {
      const x0 = s * HO.x * Math.cos(a0), x1 = s * HO.x * Math.cos(a1), y0 = HO.eave + (HO.ridge - HO.eave) * Math.sin(a0), y1 = HO.eave + (HO.ridge - HO.eave) * Math.sin(a1);
      K.quad(R.hull, [x0, y0, HO.z0], [x1, y1, HO.z0], [x1, y1, HO.z1], [x0, y0, HO.z1], [s * Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0], null, true);
      for (const z of [HO.z0, HO.z1]) K.tri(R.stone, [x0, y0, z], [x1, y1, z], [0, HO.eave, z], [0, 0], [1, 0], [0.5, 1], [0, 0, z === HO.z0 ? -1 : 1], true);
    }
  }
  // its windows, lit, along both sides; and the pipes that run along them
  for (const s of [-1, 1]) {
    for (let z = HO.z0 + 6; z < HO.z1 - 3; z += 8) K.quad(R.glass, [s * (HO.x + 0.03), 3, z - 1.2], [s * (HO.x + 0.03), 3, z + 1.2], [s * (HO.x + 0.03), 5.4, z + 1.2], [s * (HO.x + 0.03), 5.4, z - 1.2], [s, 0, 0]);
    K.pipe(R.copper, [s * (HO.x + 0.4), 6.6, HO.z0], [s * (HO.x + 0.4), 6.6, HO.z1], 0.3, 8);
    K.pipe(R.copper, [s * (HO.x + 0.4), 1.4, HO.z0], [s * (HO.x + 0.4), 1.4, HO.z1], 0.22, 8);
  }

  // ── THE GUN DECK ──────────────────────────────────────────────────────────────────────────────────────────────
  const G = KT_GALLERY, LA = KT_LANDING, gy = G.y, ceil = -T;
  const holdHatch = [KT_HOLD_HATCH.x0, KT_HOLD_HATCH.x1, KT_HOLD_HATCH.z0, KT_HOLD_HATCH.z1];
  K.slabWithHoles(R.deck, G.x0, G.x1, G.z0, G.z1, gy, [], [0, 1, 0], true);
  K.slabWithHoles(R.deck, LA.x0, LA.x1, LA.z0, LA.z1, gy, [holdHatch], [0, 1, 0], true);
  // its ceiling (the waist's underside, the engine house's floor), beamed
  // solid (AUDIT KETCH L4-3: drawn only, DFU's classic climb went up a wall and over its top into the hold)
  K.slabWithHoles(R.iron, G.x0, G.x1, G.z0, G.z1, ceil, [hatch], [0, -1, 0], true);
  K.slabWithHoles(R.iron, LA.x0, LA.x1, LA.z0, LA.z1, ceil, [], [0, -1, 0], true);
  for (let z = G.z0 + 3; z < LA.z1; z += 6) { const x0 = z >= LA.z0 ? LA.x0 : G.x0, x1 = z >= LA.z0 ? LA.x1 : G.x1; K.box(R.brass, x0, x1, ceil - 0.35, ceil, z - 0.2, z + 0.2, { skip: ['top'] }); }
  // its walls, seen from within, solid
  const wall = (rec, a, b, y0, y1, inward) => K.quad(rec, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], inward, null, true);
  wall(R.iron, [G.x0, G.z0], [G.x0, LA.z0], gy, ceil, [1, 0, 0]);
  wall(R.iron, [G.x1, G.z0], [G.x1, LA.z0], gy, ceil, [-1, 0, 0]);
  wall(R.iron, [G.x0, G.z0], [G.x1, G.z0], gy, ceil, [0, 0, 1]);
  wall(R.iron, [LA.x0, LA.z0], [G.x0, LA.z0], gy, ceil, [0, 0, 1]);
  wall(R.iron, [G.x1, LA.z0], [LA.x1, LA.z0], gy, ceil, [0, 0, 1]);
  wall(R.iron, [LA.x0, LA.z0], [LA.x0, LA.z1], gy, ceil, [1, 0, 0]);
  wall(R.iron, [LA.x1, LA.z0], [LA.x1, LA.z1], gy, ceil, [-1, 0, 0]);
  wall(R.stone, [LA.x0, LA.z1], [LA.x1, LA.z1], gy, ceil, [0, 0, -1]);
  // the guns behind their ports: a breech, a barrel into the wall, a brass ring - every eight metres a side; each run in
  // against its wall on a carriage a body stops at (AUDIT KETCH L4-11: drawn across the outer hammer lanes, walked through)
  for (const z of KT_GUN_ZS) for (const s of [-1, 1]) {
    const x = s > 0 ? G.x1 : G.x0, y = gy + 1.5;
    K.box(R.brass, x - s * 0.05, x, y - 0.75, y + 0.75, z - 0.75, z + 0.75, { skip: [s > 0 ? 'px' : 'nx'] });
    K.pipe(R.iron, [x - s * 1.25, y, z], [x, y, z], 0.32, 10, { caps: true });
    K.box(R.iron, Math.min(x - s * KT_GUN_DEPTH, x - s * 0.1), Math.max(x - s * KT_GUN_DEPTH, x - s * 0.1), gy, y - 0.2, z - 0.55, z + 0.55, { skip: ['bottom'], solid: true });
  }
  // the hammers' housings on the ceiling over each slam, and their sleeves
  for (const z of KT_HAMMER.rows) for (const x of KT_HAMMER.lanes) {
    K.box(R.iron, x - 1.0, x + 1.0, ceil - 1.1, ceil, z - 1.0, z + 1.0, { skip: ['top'] });
    K.cyl(R.brass, x, z, 0.55, ceil - 1.5, ceil - 1.1, 10, { top: false, bottom: true });
  }
  // THE STEAM PIPES: along both walls overhead, dropping at each steam lane to a vent at the floor
  for (const s of [-1, 1]) {
    const x = s * (G.x1 - 0.35);
    K.pipe(R.copper, [x, ceil - 0.8, G.z0], [x, ceil - 0.8, LA.z0], 0.24, 8);
    for (const z of KT_STEAM.z) {
      K.pipe(R.copper, [x, ceil - 0.8, z], [x, gy + 0.7, z], 0.2, 8);
      K.box(R.grate, x - 0.25, x + 0.25, gy + 0.2, gy + 0.9, z - KT_STEAM.w / 2, z + KT_STEAM.w / 2, { skip: ['bottom'] });
    }
  }
  // the Hammer Wardens' posts: brass rings inlaid where they stand
  for (const [x, z] of KT_WARDEN_POSTS) K.sector(R.brass, x, z, 1.4, 1.7, 0, Math.PI * 2, gy + 0.01, 20);
  // THE HOLD'S HATCH: its coaming, its stair, its rails
  const HH = KT_HOLD_HATCH;
  K.box(R.brass, HH.x0 - 0.2, HH.x0, gy, gy + 0.35, HH.z0, HH.z1 + 0.2, { skip: ['bottom'], solid: true });
  K.box(R.brass, HH.x1, HH.x1 + 0.2, gy, gy + 0.35, HH.z0, HH.z1 + 0.2, { skip: ['bottom'], solid: true });
  K.box(R.brass, HH.x0, HH.x1, gy, gy + 0.35, HH.z1, HH.z1 + 0.2, { skip: ['bottom'], solid: true });
  K.stairs(R.deck, HH.x0, HH.x1, HH.z0, HH.z1, HH.y0 - T, HH.y1, 20, { riserRec: R.brass, soffitRec: R.iron });
  for (const x of [HH.x0, HH.x1]) K.quad(R.iron, [x, gy - T, HH.z0], [x, gy - T, HH.z1], [x, gy, HH.z1], [x, gy, HH.z0], [x < 0 ? 1 : -1, 0, 0]);

  // ── THE HOLD ──────────────────────────────────────────────────────────────────────────────────────────────────
  const HD = KT_HOLD, hy = HD.y, hc = gy - T;
  K.slabWithHoles(R.deck, HD.x0, HD.x1, HD.z0, HD.z1, hy, [], [0, 1, 0], true);
  K.slabWithHoles(R.iron, HD.x0, HD.x1, HD.z0, HD.z1, hc, [holdHatch, shaft], [0, -1, 0], true);   // solid, the shaft open (AUDIT KETCH L4-3)
  wall(R.inner, [HD.x0, HD.z0], [HD.x0, HD.z1], hy, hc, [1, 0, 0]);   // KETCH-LOOK KL2: the plates' backs (its outside's strakes read as shelves)
  wall(R.inner, [HD.x1, HD.z0], [HD.x1, HD.z1], hy, hc, [-1, 0, 0]);
  wall(R.stone, [HD.x0, HD.z0], [HD.x1, HD.z0], hy, hc, [0, 0, 1]);
  wall(R.stone, [HD.x0, HD.z1], [HD.x1, HD.z1], hy, hc, [0, 0, -1]);
  // its ribs, iron, every six metres down both walls and across the ceiling
  for (let z = HD.z0 + 4; z < HD.z1; z += 6) {
    for (const s of [-1, 1]) K.box(R.iron, s > 0 ? HD.x1 - 0.35 : HD.x0, s > 0 ? HD.x1 : HD.x0 + 0.35, hy, hc, z - 0.25, z + 0.25, { skip: ['bottom', 'top'] });
    K.box(R.iron, HD.x0, HD.x1, hc - 0.35, hc, z - 0.25, z + 0.25, { skip: ['top'] });
  }
  // THE STARVED ENGINE: its drum (iron, brass-banded, a gear's face on top), its flywheel, its pipes into the ceiling
  const E = KT_ENGINE;
  K.cyl(R.iron, E.x, E.z, E.r, hy, hy + E.h, 20, { capRec: R.gear, solid: true });
  for (const y of [hy + 0.6, hy + 2.4, hy + 4.4]) K.cyl(R.brass, E.x, E.z, E.r + 0.08, y, y + 0.3, 20, { top: false });
  K.cyl(R.gear, E.x, E.z, 1.4, hy + E.h, hy + E.h + 0.25, 16, { top: true });
  for (const s of [-1, 1]) {
    K.pipe(R.copper, [E.x + s * 1.6, hy + E.h, E.z - 1], [E.x + s * 1.6, hc, E.z - 1], 0.45, 10);
    K.pipe(R.copper, [E.x + s * 2.4, hy + 3, E.z - 1.8], [s * (HD.x1 - 0.5), hy + 3, E.z - 1.8], 0.3, 8);
  }
  K.pipe(R.iron, [E.x - E.r - 0.2, hy + 2.8, E.z], [E.x - E.r - 1.2, hy + 2.8, E.z], 0.3, 8);
  K.cyl(R.gear, E.x - E.r - 1.4, E.z, 2.2, hy + 0.6, hy + 0.6, 1);   // placeholder face never seen (a disc of no height)
  // the flywheel: a gear's face standing beside the drum, starboard side, turning on its axle (its face drawn both ways)
  {
    const fx = E.x - E.r - 1.3, fy = hy + 2.8, fr = 2.4, n = 20;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const P = (a) => [fx, fy + Math.sin(a) * fr, E.z + Math.cos(a) * fr];
      const uv = (a) => [0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2];
      K.tri(R.gear, [fx, fy, E.z], P(a0), P(a1), [0.5, 0.5], uv(a0), uv(a1), [-1, 0, 0]);
      K.tri(R.gear, [fx, fy, E.z], P(a0), P(a1), [0.5, 0.5], uv(a0), uv(a1), [1, 0, 0]);
    }
  }
  // its seven sockets: copper pedestals on the ring, each a brass cup a cell stands in
  for (const [x, z] of KT_SOCKETS) {
    K.cyl(R.copper, x, z, 0.42, hy, hy + 0.9, 10, { capRec: R.brass, solid: true });
    K.cyl(R.brass, x, z, 0.5, hy + 0.9, hy + 1.05, 10, { top: false });
  }
  // THE CRADLES: iron racks, a brass clamp over each - the cells stand in them (drawn by the parts)
  const cradle = (x, z, y) => {
    K.box(R.iron, x - 0.6, x + 0.6, y, y + 0.7, z - 0.6, z + 0.6, { skip: ['bottom'], solid: true });
    for (const s of [-1, 1]) K.pipe(R.brass, [x + s * 0.45, y + 0.7, z], [x + s * 0.45, y + 1.8, z], 0.06, 6);
    K.pipe(R.brass, [x - 0.45, y + 1.8, z], [x + 0.45, y + 1.8, z], 0.07, 6);
  };
  for (const [x, z] of KT_CRADLES) cradle(x, z, hy);
  // THE ARC-COILS: copper coil columns in pairs across the hold, brass-ringed, their tops the arcs leap between
  for (const z of KT_ARCS.z) for (const s of [-1, 1]) {
    const x = s * KT_ARCS.post;
    K.cyl(R.copper, x, z, 0.42, hy, hy + 4.2, 10, { capRec: R.brass, solid: true });
    for (let y = hy + 0.6; y < hy + 4; y += 0.5) K.cyl(R.brass, x, z, 0.5, y, y + 0.12, 10, { top: false });
    K.cone(R.brass, [x, hy + 4.2, z], [x, hy + 5, z], 0.5, 8);
  }
  // THE VENTS the spiders come from: grilles in the walls, brass-framed
  for (const [x, z] of KT_VENTS) {
    const s = Math.sign(x), wx = s > 0 ? HD.x1 - 0.02 : HD.x0 + 0.02;
    K.quad(R.grate, [wx, hy, z - 1.1], [wx, hy, z + 1.1], [wx, hy + 1.6, z + 1.1], [wx, hy + 1.6, z - 1.1], [-s, 0, 0]);
    K.box(R.brass, wx - s * 0.12, wx, hy + 1.6, hy + 1.8, z - 1.3, z + 1.3);
  }

  // ── THE MAST-LIFT'S TOWER ─────────────────────────────────────────────────────────────────────────────────────
  {
    const L = KT_LIFT, t = KT_SHAFT.t, x0 = L.x - L.half, x1 = L.x + L.half, z0 = L.z - L.half, z1 = L.z + L.half, D0 = KT_SHAFT.door;
    // three walls whole from the hold to the main top (outer and inner faces, solid)
    for (const [a, b, n] of [[[x1, z0], [x1, z1], [1, 0, 0]], [[x0, z0], [x1, z0], [0, 0, -1]], [[x0, z1], [x1, z1], [0, 0, 1]]]) {
      K.quad(R.iron, [a[0], L.y0, a[1]], [b[0], L.y0, b[1]], [b[0], L.y1, b[1]], [a[0], L.y1, a[1]], n, null, true);
      const i = [a[0] - n[0] * t, a[1] - n[2] * t], j = [b[0] - n[0] * t, b[1] - n[2] * t];
      K.quad(R.iron, [i[0], L.y0, i[1]], [j[0], L.y0, j[1]], [j[0], L.y1, j[1]], [i[0], L.y1, i[1]], [-n[0], 0, -n[2]], null, true);
    }
    // the west wall, its door open at the hold
    const west = (za, zb, ya, yb) => {
      K.quad(R.iron, [x0, ya, za], [x0, ya, zb], [x0, yb, zb], [x0, yb, za], [-1, 0, 0], null, true);
      K.quad(R.iron, [x0 + t, ya, za], [x0 + t, ya, zb], [x0 + t, yb, zb], [x0 + t, yb, za], [1, 0, 0], null, true);
    };
    west(z0, D0.z0, L.y0, L.y1); west(D0.z1, z1, L.y0, L.y1); west(D0.z0, D0.z1, L.y0 + D0.h, L.y1);
    K.box(R.brass, x0 - 0.15, x0 + t + 0.15, L.y0 + D0.h, L.y0 + D0.h + 0.3, D0.z0 - 0.2, D0.z1 + 0.2);
    for (const z of [D0.z0 - 0.1, D0.z1 + 0.1]) K.box(R.brass, x0 - 0.15, x0 + t + 0.15, L.y0, L.y0 + D0.h, z - 0.1, z + 0.1);
    // its brass corner posts outside, the height of it; its collar at the top - a rail on three sides (the west the gate's)
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) K.box(R.brass, x - 0.2, x + 0.2, L.y0, L.y1 + 0.1, z - 0.2, z + 0.2, { skip: ['bottom'] });
    // netted to KT_HIGH_NET as the main top is (AUDIT KETCH L4-4: a 1.1 m rail, jumped at a run into a 24 m shaft)
    K.rail([[x0, z0 - 0.15], [x1 + 0.15, z0 - 0.15], [x1 + 0.15, z1 + 0.15], [x0, z1 + 0.15]], L.y1, { h: KT_RAIL_H, net: KT_HIGH_NET, netRec: R.net, postRec: R.brass, barRec: R.brass });
  }

  // ── THE MAIN TOP, THE YARD AND THE FIRST TOP ─────────────────────────────────────────────────────────────────
  {
    const M = KT_MAIN_TOP, n = 48, half = KT_LIFT.half;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      // the inner edge on the shaft's square: along each bearing to the square's boundary
      const sq = (a) => { const s = Math.sin(a), c = Math.cos(a), k2 = half / Math.max(Math.abs(s), Math.abs(c)); return [M.x + s * k2, M.z + c * k2]; };
      const i0 = sq(a0), i1 = sq(a1), o0 = [M.x + Math.sin(a0) * M.r, M.z + Math.cos(a0) * M.r], o1 = [M.x + Math.sin(a1) * M.r, M.z + Math.cos(a1) * M.r];
      K.quad(R.deck, [i0[0], M.y, i0[1]], [o0[0], M.y, o0[1]], [o1[0], M.y, o1[1]], [i1[0], M.y, i1[1]], [0, 1, 0], null, true);
      K.quad(R.iron, [i0[0], M.y - T, i0[1]], [o0[0], M.y - T, o0[1]], [o1[0], M.y - T, o1[1]], [i1[0], M.y - T, i1[1]], [0, -1, 0]);
      K.quad(R.brass, [o0[0], M.y - T, o0[1]], [o1[0], M.y - T, o1[1]], [o1[0], M.y, o1[1]], [o0[0], M.y, o0[1]], [Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2)]);
    }
    // its brackets: struts from the tower down under its rim
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; K.pipe(R.iron, [M.x + Math.sin(a) * KT_LIFT.half, M.y - 5, M.z + Math.cos(a) * KT_LIFT.half], [M.x + Math.sin(a) * (M.r - 0.4), M.y - T, M.z + Math.cos(a) * (M.r - 0.4)], 0.14, 6); }
    // its rail and net, round all but the yard's gap
    const gap = Math.atan2(KT_YARD.halfW + 0.1, M.r), pts = [];
    for (let k = 0; k <= 40; k++) { const a = Math.PI / 2 + gap + ((2 * Math.PI - 2 * gap) * k) / 40; pts.push([M.x + Math.sin(a) * (M.r - 0.1), M.z + Math.cos(a) * (M.r - 0.1)]); }
    K.rail(pts, M.y, { h: KT_RAIL_H, net: KT_HIGH_NET, netRec: R.net, postRec: R.brass, barRec: R.brass });
    // THE YARD: a railed and netted plank out to the first top, its brace under it
    const Y = KT_YARD, yx0 = M.x + Math.sqrt(M.r ** 2 - Y.halfW ** 2) - 0.4;
    K.box(R.deck, yx0, Y.x1 + 0.6, Y.y - T, Y.y, Y.z - Y.halfW, Y.z + Y.halfW, { solid: true, recs: { bottom: R.iron, px: R.brass, nx: R.brass, pz: R.brass, nz: R.brass } });
    for (const s of [-1, 1]) K.rail([[yx0, Y.z + s * (Y.halfW - 0.05)], [Y.x1 + 0.2, Y.z + s * (Y.halfW - 0.05)]], Y.y, { h: KT_RAIL_H, net: KT_HIGH_NET, netRec: R.net, postRec: R.brass, barRec: R.brass });
    K.pipe(R.iron, [KT_LIFT.x + KT_LIFT.half, Y.y - 6, Y.z], [Y.x1, Y.y - T, Y.z], 0.18, 6);
    // THE FIRST TOP (A): the course's start, an island of the Hour's shape at the yard's end - a deck disc, its brass lip,
    // its underside, and the chains it hangs from up to the jackstay - B and C hang the same way (the Steps stand their floors)
    const A = KT_COURSE_SPEC.start;
    K.sector(R.deck, A.x, A.z, 0, A.r, 0, Math.PI * 2, A.y, 32, { solid: true, rim: 0.4, rimRec: R.brass });
    K.cone(R.hull, [A.x, A.y - 0.4, A.z], [A.x, A.y - 3.2, A.z], A.r, 16);
    for (const c of KT_COURSE.checkpoints) for (const [p, q] of ketchCheckpointChains(c)) K.pipe(R.chain, p, q, 0.06, 4);
    // the bosun's line's post on the main top's aft side (its line is a part - it runs once the bridge is unbarred)
    K.cyl(R.brass, KT_LINE.x, KT_LINE.z, 0.22, M.y, M.y + 3.2, 10, { solid: true });
    K.cyl(R.gear, KT_LINE.x, KT_LINE.z, 0.55, M.y + 3.0, M.y + 3.15, 12);
    K.sector(R.edge, KT_LINE.x, KT_LINE.z, KT_LINE.r - 0.08, KT_LINE.r, 0, Math.PI * 2, M.y + 0.01, 20);
  }

  // ── THE GANGWAY ───────────────────────────────────────────────────────────────────────────────────────────────
  {
    const W = KT_GANGWAY, dx = W.bx - W.ax, dz = W.bz - W.az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux, h = W.w / 2;
    const a = [W.ax + nx * h, W.az + nz * h], b = [W.bx + nx * h, W.bz + nz * h], c = [W.bx - nx * h, W.bz - nz * h], d = [W.ax - nx * h, W.az - nz * h];
    K.quad(R.deck, [a[0], 0, a[1]], [b[0], 0, b[1]], [c[0], 0, c[1]], [d[0], 0, d[1]], [0, 1, 0], null, true);
    K.quad(R.iron, [a[0], -T, a[1]], [b[0], -T, b[1]], [c[0], -T, c[1]], [d[0], -T, d[1]], [0, -1, 0]);
    for (const [p, q, s] of /** @type {Array<[number[], number[], number]>} */ ([[a, b, 1], [d, c, -1]])) {
      K.quad(R.brass, [p[0], -T, p[1]], [q[0], -T, q[1]], [q[0], 0, q[1]], [p[0], 0, p[1]], [s * nx, 0, s * nz]);
      K.rail([[p[0] - s * nx * 0.05, p[1] - s * nz * 0.05], [q[0] - s * nx * 0.05, q[1] - s * nz * 0.05]], 0, { h: KT_RAIL_H, net: KT_HIGH_NET, netRec: R.net, postRec: R.brass, barRec: R.brass });
    }
    // its head on the course's side: a brass sill the last plank's jump lands past
    K.prism(R.brass, ketchGangwaySill(), -T, 0.02, { bottom: true });
  }

  // ── THE BRIDGE ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const C = KT_BRIDGE;
    K.sector(R.deck, C.x, C.z, 0, C.core, 0, Math.PI * 2, C.y, 48, { solid: true });
    K.sector(R.iron, C.x, C.z, 0, C.core, 0, Math.PI * 2, C.y - 1.2, 48, { up: false });
    // the core's inlay: the fork ring's two brass circles, the tonal sigil's twelve rays
    for (const r of [6, 13]) K.sector(R.brass, C.x, C.z, r - 0.12, r + 0.12, 0, Math.PI * 2, C.y + 0.01, 64);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a), px = -c * 0.08, pz = s * 0.08;
      K.quad(R.brass, [C.x + s * 6 + px, C.y + 0.01, C.z + c * 6 + pz], [C.x + s * 13 + px, C.y + 0.01, C.z + c * 13 + pz], [C.x + s * 13 - px, C.y + 0.01, C.z + c * 13 - pz], [C.x + s * 6 - px, C.y + 0.01, C.z + c * 6 - pz], [0, 1, 0]);
    }
    K.sector(R.gilt, C.x, C.z, 0, 1.6, 0, Math.PI * 2, C.y + 0.01, 24, { faceUv: true });
    // THE HELM: its pedestal, its great wheel facing the way in, the console behind it
    K.cyl(R.brass, KT_HELM.x, KT_HELM.z, 0.7, C.y, C.y + 1.2, 12, { solid: true, capRec: R.gilt });
    {
      const wx = KT_HELM.x, wy = C.y + 2.6, wz = KT_HELM.z + 0.2, wr = 1.6, n = 24;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, P = (a) => [wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, wz];
        const uv = (a) => [0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2];
        K.tri(R.gear, [wx, wy, wz], P(a0), P(a1), [0.5, 0.5], uv(a0), uv(a1), [0, 0, -1]);
        K.tri(R.gear, [wx, wy, wz], P(a0), P(a1), [0.5, 0.5], uv(a0), uv(a1), [0, 0, 1]);
      }
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; K.pipe(R.gilt, [wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, wz], [wx + Math.cos(a) * (wr + 0.4), wy + Math.sin(a) * (wr + 0.4), wz], 0.07, 6, { caps: true }); }
      K.pipe(R.brass, [wx, wy, wz], [wx, wy, wz + 1.2], 0.15, 8);
    }
    const CO = KT_CONSOLE;
    K.box(R.iron, CO.x0, CO.x1, C.y, C.y + CO.h, CO.z0, CO.z1, { skip: ['bottom'], solid: true, recs: { top: R.gilt } });
    // THE TONAL SPIRES: eight slender brass spires round the core's edge, between the sections' seams
    for (let k = 0; k < 8; k++) {
      const a = k * (Math.PI / 4), x = C.x + Math.sin(a) * (C.core - 0.5), z = C.z + Math.cos(a) * (C.core - 0.5);
      K.cyl(R.brass, x, z, 0.3, C.y, C.y + 7, 8, { top: false, solid: true });
      K.cone(R.gilt, [x, C.y + 7, z], [x, C.y + 9.5, z], 0.36, 8);
      K.cyl(R.brass, x, z, 0.42, C.y + 2.2, C.y + 2.4, 8, { top: false });
    }
    // the bridge's two cradles, on the core by the forward rim
    for (const [x, z] of KT_BRIDGE_CRADLES) cradle(x, z, C.y);
    // under the core: the stern's round hull, its belly down to the keel's line (the outer ring's sections cover the rest)
    K.cone(R.hull, [C.x, C.y - 1.2, C.z], [C.x, KT_HULL.keel - 2, C.z], C.core, 24);
  }

  // ── THE KETCHMASTER'S CABIN ───────────────────────────────────────────────────────────────────────────────────
  {
    const CB = KT_CABIN, DR = KT_CABIN_DOOR, h = 5.2, roof = 6.8;
    K.slabWithHoles(R.deck, CB.x0, CB.x1, CB.z0 - 1.2, CB.z1, 0, [], [0, 1, 0], true);
    // the walls, outside (stone) and inside (stone), the door's opening in the front
    const cw = (a, b, ya, yb, outward) => {
      K.quad(R.stone, [a[0], ya, a[1]], [b[0], ya, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]], outward, null, true);
      const t = 0.4, i = [a[0] - outward[0] * t, a[1] - outward[2] * t], j = [b[0] - outward[0] * t, b[1] - outward[2] * t];
      K.quad(R.stone, [i[0], ya, i[1]], [j[0], ya, j[1]], [j[0], yb, j[1]], [i[0], yb, i[1]], [-outward[0], 0, -outward[2]], null, true);
    };
    cw([CB.x0, CB.z0], [DR.x0, CB.z0], 0, h, [0, 0, -1]);
    cw([DR.x1, CB.z0], [CB.x1, CB.z0], 0, h, [0, 0, -1]);
    cw([DR.x0, CB.z0], [DR.x1, CB.z0], 3.4, h, [0, 0, -1]);
    cw([CB.x0, CB.z0], [CB.x0, CB.z1], 0, h, [-1, 0, 0]);
    cw([CB.x1, CB.z0], [CB.x1, CB.z1], 0, h, [1, 0, 0]);
    cw([CB.x0, CB.z1], [CB.x1, CB.z1], 0, h, [0, 0, 1]);
    K.box(R.gilt, DR.x0 - 0.3, DR.x1 + 0.3, 3.4, 3.8, CB.z0 - 0.1, CB.z0 + 0.05);
    for (const x of [DR.x0 - 0.15, DR.x1 + 0.15]) K.box(R.gilt, x - 0.15, x + 0.15, 0, 3.4, CB.z0 - 0.1, CB.z0 + 0.05);
    // the roof: a low gable of hull plates, its ceiling inside
    for (const s of [-1, 1]) {
      K.quad(R.hull, [0, roof, CB.z0 - 0.3], [s * (CB.x1 + 0.4), h, CB.z0 - 0.3], [s * (CB.x1 + 0.4), h, CB.z1 + 0.3], [0, roof, CB.z1 + 0.3], [s * 0.6, 1, 0], null, true);   // solid (AUDIT KETCH L4-3)
      for (const z of [CB.z0, CB.z1]) K.tri(R.stone, [0, roof, z], [s * CB.x1, h, z], [0, h, z], [0.5, 1], [0, 0], [0.5, 0], [0, 0, z === CB.z0 ? -1 : 1]);
    }
    K.slabWithHoles(R.iron, CB.x0, CB.x1, CB.z0, CB.z1, h, [], [0, -1, 0], true);
    // its two great ports either side of the door
    for (const x of [-4.4, 4.4]) K.quad(R.glass, [x - 1, 1.6, CB.z0 - 0.04], [x + 1, 1.6, CB.z0 - 0.04], [x + 1, 3.6, CB.z0 - 0.04], [x - 1, 3.6, CB.z0 - 0.04], [0, 0, -1]);
    // THE KETCHMASTER'S CHEST: gilt and iron, its lid domed
    const V = KT_VAULT;
    K.box(R.iron, V.x - 0.8, V.x + 0.8, 0, 0.8, V.z - 0.5, V.z + 0.5, { skip: ['bottom'], solid: true, recs: { top: R.gilt } });
    K.box(R.gilt, V.x - 0.85, V.x + 0.85, 0.8, 1.0, V.z - 0.55, V.z + 0.55, { skip: ['bottom'] });
    // THE STERN LIFT: a brass floor ring, its posts and crown, its chain down through the cabin's floor
    const SL = KT_STERN_LIFT;
    K.sector(R.brass, SL.x, SL.z, 0, SL.r, 0, Math.PI * 2, 0.02, 20, { faceUv: true });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; K.pipe(R.brass, [SL.x + Math.sin(a) * SL.r, 0, SL.z + Math.cos(a) * SL.r], [SL.x + Math.sin(a) * SL.r, 3, SL.z + Math.cos(a) * SL.r], 0.06, 6); }
    K.pipe(R.chain, [SL.x, 3, SL.z], [SL.x, h, SL.z], 0.1, 4);
  }

  // ── THE MASTS, THE SAIL-VANES AND THE RIGGING ─────────────────────────────────────────────────────────────────
  for (const m of KT_MASTS) {
    K.cyl(R.brass, m.x, m.z, m.r, m.y0, m.y1, 12, { solid: m.y0 === 0, capRec: R.gilt });
    for (let y = m.y0 + 4; y < m.y1; y += 6) K.cyl(R.iron, m.x, m.z, m.r + 0.08, y, y + 0.3, 12, { top: false });
    const [lo, hi, reach] = m.vanes;
    for (const s of [-1, 1]) {
      // a fan of five blades from the mast out to `reach`, between lo and hi
      const n = 5, mid = (lo + hi) / 2;
      for (let k = 0; k < n; k++) {
        const a0 = -0.9 + (1.8 * k) / n, a1 = -0.9 + (1.8 * (k + 1)) / n;
        const P = (a) => [m.x + s * Math.cos(a) * reach, mid + Math.sin(a) * (hi - lo) * 0.9, m.z + KT_VANE_DZ];
        K.tri(R.vane, [m.x + s * m.r, mid, m.z + KT_VANE_DZ], P(a0), P(a1), [0.5, 1], [k / n, 0], [(k + 1) / n, 0], [0, 0, 1]);
        K.tri(R.vane, [m.x + s * m.r, mid, m.z + KT_VANE_DZ], P(a0), P(a1), [0.5, 1], [k / n, 0], [(k + 1) / n, 0], [0, 0, -1]);
      }
      K.pipe(R.brass, [m.x, mid, m.z + KT_VANE_DZ], [m.x + s * reach, mid, m.z + KT_VANE_DZ], 0.18, 6);
      // the shrouds: rigging from the mast's head to the deck's edge
      K.pipe(R.chain, [m.x, m.y1 - 2, m.z], [s * 12.8, KT_BULWARK.h, m.z - 8], 0.04, 4);
      K.pipe(R.chain, [m.x, m.y1 - 2, m.z], [s * 12.8, KT_BULWARK.h, m.z + 8], 0.04, 4);
    }
    // a crow's nest on the main mast
    if (m.y0 === 0) {
      K.sector(R.iron, m.x, m.z, 0, 1.8, 0, Math.PI * 2, 36, 16, { rim: 1.0, rimRec: R.brass });
      K.sector(R.iron, m.x, m.z, 0, 1.8, 0, Math.PI * 2, 35, 16, { up: false });
    }
  }
  // the stays, fore and aft: the bowsprit to the main mast's head, mast to mast, the mizzen to the cabin's roof
  const [MAIN, MIZZEN] = KT_MASTS;
  K.pipe(R.chain, [0, 8, -20], [MAIN.x, MAIN.y1 - 1, MAIN.z], 0.05, 4);
  K.pipe(R.chain, [MAIN.x, MAIN.y1 - 1, MAIN.z], [MIZZEN.x, MIZZEN.y1 - 1, MIZZEN.z], 0.05, 4);
  K.pipe(R.chain, [MIZZEN.x, MIZZEN.y1 - 1, MIZZEN.z], [0, 6.8, KT_CABIN.z0 + 2], 0.05, 4);
  // the jackstay over the Sailwalk, vane-spar to vane-spar
  K.pipe(R.brass, [KT_JACKSTAY.x, KT_JACKSTAY.fore.y, KT_JACKSTAY.fore.z], [KT_JACKSTAY.x, KT_JACKSTAY.aft.y, KT_JACKSTAY.aft.z], 0.14, 6);

  // ── THE LAMPS ─────────────────────────────────────────────────────────────────────────────────────────────────
  const { up, below, cabin } = ketchLampSpots(), LK = ketchKit({ f: faces(), hit: null });
  for (const p of [...up, ...below, ...cabin]) lamp(LK, p);

  return { model: packKetchFaces(K.f), hit, lights: ketchLights(), lamps: packKetchFaces(LK.f) };
}

/**
 * THE PARTS that move or come and go - each `{ model, hit? }` in its own frame about its origin (the host stands each by
 * its draw's matrix and its collider bucket's translation): `hammer` (origin at its head's foot), `cage` and `cageHit`
 * (its floor's top centre), `gateHold`, `gateTop`, `grateWatch`, `grateHold`, `doors` (the cabin's two leaves), `sections[k]`
 * (each in the dungeon's frame - it falls by its translation alone), `resonator.true|false` (a crystal about its centre),
 * `cell`, `fork` (its foot), `arc[k]` (along x from -post to +post at its own y 0), `line` (the bosun's line, the dungeon's
 * frame). Pure.
 */
export function buildKetchParts() {
  const part = (fn, solid = false) => { const hit = solid ? [] : null; const K = ketchKit({ f: faces(), hit }); fn(K); return { model: packKetchFaces(K.f), hit }; };
  // the kit writes the dungeon's frame; a part made about the deck's origin is moved back there by its draw (`local`)
  const O = deckToDungeon(0, 0, 0);
  const local = (p) => { const m = p.model.positions; for (let i = 0; i < m.length; i += 3) { m[i] -= O[0]; m[i + 1] -= O[1]; m[i + 2] -= O[2]; } if (p.hit) for (let i = 0; i < p.hit.length; i += 3) { p.hit[i] -= O[0]; p.hit[i + 1] -= O[1]; p.hit[i + 2] -= O[2]; } return p; };
  const hammer = local(part((K) => {
    K.box(R.iron, -1.25, 1.25, 0, 0.9, -1.25, 1.25, { recs: { bottom: R.iron, top: R.brass } });
    K.box(R.brass, -1.32, 1.32, 0.6, 0.78, -1.32, 1.32, { skip: ['top', 'bottom'] });
    K.pipe(R.brass, [0, 0.9, 0], [0, 6.5, 0], 0.32, 10);
  }));
  const C = KT_CAGE;
  const cage = local(part((K) => {
    K.box(R.iron, -C.half, C.half, -0.25, KT_CAGE_LIFT_M, -C.half, C.half, { solid: true, recs: { top: R.deck } });   // a hair over the hold's floor at its foot (AUDIT KETCH L4-9: the two coplanar, fighting)
    for (const [a, b, n] of [[[C.half, -C.half], [C.half, C.half], [-1, 0, 0]], [[-C.half, -C.half], [C.half, -C.half], [0, 0, 1]], [[-C.half, C.half], [C.half, C.half], [0, 0, -1]]]) {
      K.quad2(R.net, [a[0], 0.1, a[1]], [b[0], 0.1, b[1]], [b[0], C.h, b[1]], [a[0], C.h, a[1]], n, [[0, 0], [2.6, 0], [2.6, 1.4], [0, 1.4]]);
      K.quad(null, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], C.h, b[1]], [a[0], C.h, a[1]], n, null, true);
      K.pipe(R.brass, [a[0], C.h, a[1]], [b[0], C.h, b[1]], 0.08, 6);
      K.pipe(R.brass, [a[0], 1.1, a[1]], [b[0], 1.1, b[1]], 0.05, 6);
    }
    for (const [x, z] of [[C.half, C.half], [C.half, -C.half], [-C.half, C.half], [-C.half, -C.half]]) K.pipe(R.brass, [x, 0, z], [x, C.h, z], 0.1, 6);
    // its roof: a pyramid of iron to its peak (59 degrees - a body that lands on it stands, and rides it as the floor's
    // riders do: AUDIT KETCH L4-8, the record had it too steep to stand on)
    for (const [a, b, n] of [[[-C.half, -C.half], [C.half, -C.half], [0, 0.6, -1]], [[C.half, -C.half], [C.half, C.half], [1, 0.6, 0]], [[C.half, C.half], [-C.half, C.half], [0, 0.6, 1]], [[-C.half, C.half], [-C.half, -C.half], [-1, 0.6, 0]]]) {
      K.tri(R.iron, [a[0], C.h, a[1]], [b[0], C.h, b[1]], [0, C.peak + C.h, 0], [0, 0], [1, 0], [0.5, 1], n, true);
      K.tri(R.iron, [a[0], C.h, a[1]], [b[0], C.h, b[1]], [0, C.peak + C.h, 0], [0, 0], [1, 0], [0.5, 1], [-n[0], -n[1], -n[2]]);
    }
    K.box(R.lamp, -0.16, 0.16, C.h - 0.4, C.h - 0.08, -0.16, 0.16);
  }, true));
  const D0 = KT_SHAFT.door, L = KT_LIFT;
  // the gates: a portcullis across the tower's door at the hold, a railing gate across its west edge at the top - each in
  // its own frame about the deck's origin (the host moves it by a translation: up into the wall, down into the floor)
  const bars = (K, x, za, zb, ya, yb, pitch) => {
    for (let z = za + pitch / 2; z < zb; z += pitch) K.pipe(R.iron, [x, ya, z], [x, yb, z], 0.06, 6);
    for (const y of [ya + 0.2, (ya + yb) / 2, yb - 0.1]) K.pipe(R.brass, [x, y, za], [x, y, zb], 0.07, 6);
    K.quad(null, [x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za], [-1, 0, 0], null, true);
  };
  const gateHold = local(part((K) => bars(K, L.x - L.half - 0.15, D0.z0, D0.z1, L.y0, L.y0 + D0.h, 0.3), true));
  const gateTop = local(part((K) => bars(K, L.x - L.half - 0.15, L.z - L.half, L.z + L.half, L.y1, L.y1 + KT_HIGH_NET, 0.25), true));   // the net's height (AUDIT KETCH L4-4)
  // the hatches' grates: two leaves barred flat over the opening, hinged along its sides - the host turns each up on its
  // hinge once open (`left` hinged at x0, `right` at x1); `hit` the two together, the bucket the host moves out of reach
  const leaf = (H, xa, xb) => local(part((K) => {
    K.box(R.grate, xa, xb, H.y0, H.y0 + 0.1, H.z0, H.z1, { recs: { bottom: R.grate } });
    for (const z of [H.z0 + 0.1, (H.z0 + H.z1) / 2, H.z1 - 0.1]) K.box(R.brass, xa, xb, H.y0 + 0.1, H.y0 + 0.16, z - 0.08, z + 0.08);
  }));
  const grate = (H) => ({ left: leaf(H, H.x0 - 0.05, (H.x0 + H.x1) / 2), right: leaf(H, (H.x0 + H.x1) / 2, H.x1 + 0.05), hit: local(part((K) => K.box(null, H.x0 - 0.05, H.x1 + 0.05, H.y0, H.y0 + 0.1, H.z0, H.z1, { solid: true }), true)).hit });
  const grateWatch = grate(KT_HATCH), grateHold = grate(KT_HOLD_HATCH);
  // the cabin's doors: two iron leaves faced in gilt, each in the deck's frame - the host slides each into its wall
  const DR = KT_CABIN_DOOR;
  const doorLeaf = (xa, xb) => local(part((K) => {
    K.box(R.iron, xa, xb, 0, 3.4, DR.z - 0.12, DR.z + 0.12, { recs: { nz: R.gilt } });
    K.cyl(R.gear, (xa + xb) / 2, DR.z - 0.14, 0.45, 1.6, 1.62, 12);
  }));
  const doors = { left: doorLeaf(DR.x0, 0), right: doorLeaf(0, DR.x1), hit: local(part((K) => K.box(null, DR.x0, DR.x1, 0, 3.4, DR.z - 0.12, DR.z + 0.12, { solid: true }), true)).hit };
  // THE BRIDGE'S OUTER SECTIONS, each its own mesh and collider in the dungeon's frame: its plates, its rim down to the
  // stern's hull, its rail - and, on 0, 2, 4 and 6, its resonator's pylon
  const BC = KT_BRIDGE;
  const sections = Array.from({ length: KT_SECTIONS }, (_, k) => part((K) => {
    const a0 = (k * Math.PI) / 4, a1 = ((k + 1) * Math.PI) / 4;
    K.sector(R.deck, BC.x, BC.z, BC.core, BC.r, a0, a1, BC.y, 8, { solid: true, rim: 1.2, rimRec: R.hull, inner: true, ends: true });
    K.sector(R.hull, BC.x, BC.z, BC.core, BC.r, a0, a1, BC.y - 1.2, 8, { up: false });
    K.sector(R.edge, BC.x, BC.z, BC.r - 0.08, BC.r, a0, a1, BC.y + 0.01, 8);
    for (const [r0, r1] of railRuns(a0, a1)) {   // open across the gangway's foot and the cabin's door (AUDIT KETCH L4-1)
      const pts = [], n = Math.max(1, Math.ceil(((r1 - r0) / (a1 - a0)) * 8));
      for (let j = 0; j <= n; j++) { const a = r0 + ((r1 - r0) * j) / n; pts.push([BC.x + Math.sin(a) * KT_RAIL_R, BC.z + Math.cos(a) * KT_RAIL_R]); }
      K.rail(pts, BC.y, { h: 0.95, postRec: R.brass, barRec: R.brass });
    }
    const ri = KT_RESONATORS.findIndex(([x, z]) => sectionAt(x, z) === k);   // the deck plan's own reading of a section (ONCRASH1 C2: no hand-rolled wrap)
    if (ri >= 0) {
      const [x, z] = KT_RESONATORS[ri];
      K.cyl(R.iron, x, z, 1.1, BC.y, BC.y + 0.5, 12, { solid: true, capRec: R.brass });
      K.cyl(R.brass, x, z, 0.45, BC.y + 0.5, BC.y + 3.4, 10, { solid: true, top: false });
      for (let j = 0; j < 4; j++) { const a = (j / 4) * Math.PI * 2; K.pipe(R.copper, [x + Math.sin(a) * 0.9, BC.y + 0.5, z + Math.cos(a) * 0.9], [x + Math.sin(a) * 0.3, BC.y + 3.4, z + Math.cos(a) * 0.3], 0.1, 6); }
      K.cyl(R.brass, x, z, 0.7, BC.y + 3.4, BC.y + 3.6, 12, { top: true });
    }
  }, true));
  // THE RESONATORS' HEADS: an octahedron of light about its centre, true (the aether) and false (the ember)
  const crystal = (rec) => local(part((K) => {
    const h = 0.9, w = 0.55, pts = [[w, 0, 0], [0, 0, w], [-w, 0, 0], [0, 0, -w]];
    for (let j = 0; j < 4; j++) {
      const p = pts[j], q = pts[(j + 1) % 4];
      K.tri(rec, p, q, [0, h, 0], [0, 0], [1, 0], [0.5, 1], [p[0] + q[0], 0.5, p[2] + q[2]]);
      K.tri(rec, p, q, [0, -h, 0], [0, 0], [1, 0], [0.5, 1], [p[0] + q[0], -0.5, p[2] + q[2]]);
    }
  }));
  const resonator = { true: crystal(R.aether), false: crystal(R.ember) };
  // AN AETHER CELL: a glass of the aether between brass caps, a handle over it - about its foot
  const cell = local(part((K) => {
    K.cyl(R.aether, 0, 0, 0.24, 0.12, 0.72, 10, { top: false, wrap: true });
    K.cyl(R.brass, 0, 0, 0.28, 0, 0.12, 10, { top: true, bottom: true });
    K.cyl(R.brass, 0, 0, 0.28, 0.72, 0.84, 10, { top: true, bottom: true });
    for (const s of [-1, 1]) K.pipe(R.brass, [s * 0.2, 0.84, 0], [s * 0.12, 1.02, 0], 0.03, 5);
    K.pipe(R.brass, [-0.12, 1.02, 0], [0.12, 1.02, 0], 0.035, 5);
  }));
  // A TUNING-FORK: its foot and stem in brass, its two tines, their tips alight - about its foot
  const fork = local(part((K) => {
    K.cyl(R.iron, 0, 0, 0.55, 0, 0.25, 10, { top: true });
    K.pipe(R.brass, [0, 0.25, 0], [0, 0.9, 0], 0.14, 8);
    K.pipe(R.brass, [-0.3, 0.9, 0], [0.3, 0.9, 0], 0.12, 8);
    for (const s of [-1, 1]) { K.pipe(R.brass, [s * 0.3, 0.9, 0], [s * 0.3, 2.0, 0], 0.11, 8); K.box(R.aether, s * 0.3 - 0.13, s * 0.3 + 0.13, 2.0, 2.25, -0.13, 0.13); }
  }));
  // AN ARC'S FOUR FRAMES: a strip of its lightning from post to post, crossed (seen from any side), at its own y 0
  const arc = [R.arc0, R.arc1, R.arc2, R.arc3].map((rec) => local(part((K) => {
    const x0 = -KT_ARCS.post + 0.5, x1 = KT_ARCS.post - 0.5, w = KT_ARCS.w * 0.45;
    K.quad2(rec, [x0, -w, 0], [x1, -w, 0], [x1, w, 0], [x0, w, 0], [0, 0, 1], [[0, 0], [3, 0], [3, 1], [0, 1]]);
    K.quad2(rec, [x0, 0, -w], [x1, 0, -w], [x1, 0, w], [x0, 0, w], [0, 1, 0], [[0, 0], [3, 0], [3, 1], [0, 1]]);
  })));
  // THE BOSUN'S LINE: from the post's head on the main top down to the gangway's head, sagging - the dungeon's frame; drawn
  // on the rider's own path (AUDIT KETCH L4-6: the path was moved to where it sets its rider down, the chain was not - the
  // rider left it 1.9 m short of its end)
  const line = part((K) => {
    const n = 16;
    let p = bosunLineAt(0);
    for (let k = 1; k <= n; k++) { const q = bosunLineAt(k / n); K.pipe(R.chain, p, q, 0.06, 4); p = q; }
  });
  // THE LODESTONE: blue and brass, set on the console behind the helm and turning on its own - what the ship follows (the
  // line's QLSK03: AUDIT KETCH L5-7, its words named a stone the ship did not have). Made about its foot; the host turns it
  const lodestone = local(part((K) => {
    const S = KT_LODESTONE, c = [0, S.lift, 0], r = S.r;
    K.cyl(R.brass, 0, 0, 0.32, 0, 0.12, 12, { capRec: R.gilt });
    K.pipe(R.brass, [0, 0.12, 0], [0, S.lift - r - 0.05, 0], 0.07, 6);
    const ring = [[r, 0], [0, r], [-r, 0], [0, -r]];
    for (const tip of [1, -1]) for (let k = 0; k < 4; k++) {
      const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % 4], P = [c[0], c[1] + tip * r * 1.35, c[2]], A = [c[0] + ax, c[1], c[2] + az], B = [c[0] + bx, c[1], c[2] + bz];
      K.tri(R.aether, P, A, B, [0.5, 1], [0, 0], [1, 0], [(ax + bx) / 2, tip * r, (az + bz) / 2]);
    }
    const hr = r + 0.14, n = 20;
    for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2; K.pipe(R.brass, [Math.cos(a0) * hr, S.lift + Math.sin(a0) * hr, 0], [Math.cos(a1) * hr, S.lift + Math.sin(a1) * hr, 0], 0.035, 5); }
  }));
  return { hammer, cage, gateHold, gateTop, grateWatch, grateHold, doors, sections, resonator, cell, fork, arc, line, lodestone };
}
/** THE LODESTONE's foot on the console behind the helm (deck metres), its stone's centre over it (`lift`), its half-height
 *  across (`r`) and its turn (radians a second). */
export const KT_LODESTONE = Object.freeze({ x: (KT_CONSOLE.x0 + KT_CONSOLE.x1) / 2, y: KT_BRIDGE.y + KT_CONSOLE.h, z: (KT_CONSOLE.z0 + KT_CONSOLE.z1) / 2, lift: 1.1, r: 0.4, spin: 0.35 });
/** The bosun's line's path at `t` (0 its post, 1 the gangway's head): a deck point - the rider's own, as the part sags. */
export function bosunLineAt(t) {
  const a = [KT_LINE.x, KT_MAIN_TOP.y + 3.1, KT_LINE.z], b = [KT_LINE_LAND.x, 3, KT_LINE_LAND.z], k = Math.max(0, Math.min(1, t));   // to where it sets its rider down (AUDIT KETCH L4-6)
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - 6 * Math.sin(Math.PI * k), a[2] + (b[2] - a[2]) * k];
}

/** THE ANCHOR-LIFT'S CHAIN let out, metres: from the Anchor Deck to the lift's crown on the fields below (the deck stands
 *  -KT_GROUND.y over them; the lift's crown KT_LIFT_CROWN over its own floor). */
export const KT_LIFT_CROWN = 3;
export const KT_SKY_CHAIN = -KT_GROUND.y - KT_LIFT_CROWN;
/**
 * THE ANCHOR-LIFT LOWERED, as the world outside sees it (scenes/ketch/ketchSky.js): `cage` the lift whole about its own floor
 * (y 0) - its round brass floor ringed in aether, its six posts, its crown ring, its lamp - and `chain` the chain it hangs
 * by, from its head (y 0) down a metre (the host scales it to the length let out). Both made about their own origin.
 */
export function buildKetchAnchorLift() {
  const O = deckToDungeon(0, 0, 0);
  const local = (model) => { const m = model.positions; for (let i = 0; i < m.length; i += 3) { m[i] -= O[0]; m[i + 1] -= O[1]; m[i + 2] -= O[2]; } return model; };
  const C = ketchKit({ f: faces() }), r = KT_ANCHOR_LIFT.r, h = KT_LIFT_CROWN;
  C.sector(R.brass, 0, 0, 0, r, 0, Math.PI * 2, 0.05, 24, { faceUv: true, rim: 0.05, rimRec: R.brass });
  C.sector(R.aether, 0, 0, r - 0.18, r + 0.06, 0, Math.PI * 2, 0.07, 24);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; C.pipe(R.brass, [Math.sin(a) * r, 0, Math.cos(a) * r], [Math.sin(a) * r, h, Math.cos(a) * r], 0.06, 6); }
  for (let k = 0; k < 24; k++) { const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2; C.pipe(R.brass, [Math.sin(a0) * r, h, Math.cos(a0) * r], [Math.sin(a1) * r, h, Math.cos(a1) * r], 0.07, 5); }
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; C.pipe(R.chain, [Math.sin(a) * r, h, Math.cos(a) * r], [0, h + 1.6, 0], 0.05, 4); }
  C.box(R.lamp, -0.18, 0.18, h + 1.3, h + 1.66, -0.18, 0.18);
  const L = ketchKit({ f: faces() });
  L.pipe(R.chain, [0, 0, 0], [0, -1, 0], 0.12, 4);
  return { cage: local(packKetchFaces(C.f)), chain: local(packKetchFaces(L.f)) };
}

/** THE LAND BELOW: the fields under the keel (one great quad, its picture KT_GROUND.tile metres a repeat) and the city of
 *  Daggerfall off the starboard beam - its walls and towers, its houses, its castle - drawn in the haze. noShadow; never collided. */
export function buildKetchGround() {
  const K = ketchKit({ f: faces() });
  const G = KT_GROUND, y = G.y, h = G.half, k = (2 * h) / G.tile;
  K.quad(R.ground, [-h, y, -h + 120], [h, y, -h + 120], [h, y, h + 120], [-h, y, h + 120], [0, 1, 0], [[0, 0], [k, 0], [k, k], [0, k]]);
  const C = KT_CITY;
  let s = C.seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // the walls: a ring of curtain wall with its towers
  for (let j = 0; j < C.towers; j++) {
    const a0 = (j / C.towers) * Math.PI * 2, a1 = ((j + 1) / C.towers) * Math.PI * 2;
    const p = [C.x + Math.sin(a0) * C.r, C.z + Math.cos(a0) * C.r], q = [C.x + Math.sin(a1) * C.r, C.z + Math.cos(a1) * C.r];
    K.prism(R.stone, [[p[0], p[1]], [q[0], q[1]], [q[0] - Math.sin((a0 + a1) / 2) * 4, q[1] - Math.cos((a0 + a1) / 2) * 4], [p[0] - Math.sin((a0 + a1) / 2) * 4, p[1] - Math.cos((a0 + a1) / 2) * 4]], y, y + 14);
    K.cyl(R.stone, p[0], p[1], 6, y, y + 22, 8, { capRec: R.copper });
  }
  // the houses: low stone blocks under copper-brown roofs, scattered inside the walls
  for (let j = 0; j < C.houses; j++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (C.r - 18) + 8, x = C.x + Math.sin(a) * d, z = C.z + Math.cos(a) * d;
    if (Math.hypot(x - C.x, z - C.z) < 30) continue;
    const w = 6 + r() * 8, l = 8 + r() * 10, hh = 5 + r() * 6, yaw = Math.round(r() * 4) * (Math.PI / 4);
    const cs = Math.cos(yaw), sn = Math.sin(yaw), P = (u, v) => [x + u * cs - v * sn, z + u * sn + v * cs];
    K.prism(R.stone, [P(-w / 2, -l / 2), P(w / 2, -l / 2), P(w / 2, l / 2), P(-w / 2, l / 2)], y, y + hh, { top: false });
    const ridge = y + hh + w * 0.45, ra = P(0, -l / 2), rb = P(0, l / 2);
    for (const sd of [-1, 1]) { const ea = P(sd * w / 2, -l / 2), eb = P(sd * w / 2, l / 2); K.quad(R.copper, [ea[0], y + hh, ea[1]], [eb[0], y + hh, eb[1]], [rb[0], ridge, rb[1]], [ra[0], ridge, ra[1]], [sd * cs, 0.8, sd * sn]); }
    for (const v of [-l / 2, l / 2]) { const pa = P(-w / 2, v), pb = P(w / 2, v), pr = P(0, v); K.tri(R.stone, [pa[0], y + hh, pa[1]], [pb[0], y + hh, pb[1]], [pr[0], ridge, pr[1]], [0, 0], [1, 0], [0.5, 1], [-sn * Math.sign(v), 0, cs * Math.sign(v)]); }
  }
  // the castle: its keep and four towers at the city's heart
  K.prism(R.stone, [[C.x - 14, C.z - 14], [C.x + 14, C.z - 14], [C.x + 14, C.z + 14], [C.x - 14, C.z + 14]], y, y + 30, { topRec: R.iron });
  for (const [dx, dz] of [[-16, -16], [16, -16], [16, 16], [-16, 16]]) K.cyl(R.stone, C.x + dx, C.z + dz, 5, y, y + 38, 10, { capRec: R.copper });
  return packKetchFaces(K.f);
}

/** The collider's static bucket packed (the ship's `hit`). */
export const ketchColliderOf = (ship) => packKetchHit(ship.hit);
/** KT_DECK_H re-said for the host (the rooms' height). */
export const KT_ROOM_H = KT_DECK_H;
