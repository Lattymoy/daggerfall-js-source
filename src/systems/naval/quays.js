// @ts-check
// QUAYS (2026-10-03, Mac: "Completely revamp port towns with actual piers and docking ports. I want these places to feel
// alive and connected with the oceans of daggerfall, along with having them appear when sailing and close to a port") -
// THE PORT'S OWN QUAYS AND ITS DOCKING. Pure: the host hands a harbour's berths (shipLife.js findHarbour), the sea's top
// and the ground, and gets back where each berth's quay stands, what stands on it, and whether a ship of the player's
// is warped in to it or lies made fast at it. Design: bible/03-World/Holdings.md section 7.
//
// NO DOCK DATA EXISTS (shipLife.js's header): Daggerfall's port towns stand no piers, and a harbour is found from the
// terrain. So is its quay, berth by berth, in THE BERTH'S FRAME (`quayFrame`): its origin the berth's place on the sea's
// top, +x toward the land (against the shore's normal), +z along the shore - the trs yaw `theta` turns it into the scene.
// A berth is sounded for the harbour's hull (BERTH_HULL, the Carrack), her widest QUAY_GAP off the quay's FACE; the quay
// runs QUAY_ENDS past her bow and her stern, QUAY_WIDTH deep, its deck QUAY_DECK_UP over the sea's top on piles every
// PILE_STEP down to the bed (PILE_DEPTH at most). Behind it the shore is walked (`planQuay`) along +x in JETTY_STEP: a
// bank that meets the deck within STEP_M takes a JETTY of JETTY_WIDTH onto it, JETTY_LAND in; dry ground under the deck
// takes the jetty to it and a RAMP down to the ground at RAMP_SLOPE (RAMP_MAX at most); no land within JETTY_MAX, a
// quay that stands alone (a sandbar's). HARBOUR-BOOK: the jetty is a PIER as long as the shelf asks - a berth is sounded
// where the deepest keel floats, which Iliac Puddle's Deep Waters (its floor lifted to the sea's top at the coast and
// carved full depth only SHORE_TERRAIN_FIT_METERS out) puts some 80 m off the land; a 40 m walk stood every such quay
// alone out on the water, and a player in the town saw no dock. Bollards stand on its face by her bow, her waist and her stern, a lantern post
// at each landward corner (lit in the lanterns' hours), and the port's cargo on its back - crates and barrels, off the
// harbour's key and the berth's number on QUAY_SALT, so every player in the port sees the same quay.
//
// DOCKING (`dockFor`, `madeFast`, `warpStep`): a ship of the player's at the helm with her sails struck and no oar
// pulling, her way under DOCK_WAY, her alongside place (shipLife.js `alongside`) within DOCK_REACH_M and her bow within
// DOCK_ANGLE of the berth's line either way, is WARPED IN by her hands - eased onto it at DOCK_EASE a second. Within
// FAST_M and FAST_DEG of it she lies MADE FAST: a gangway runs from the quay's face to her rail (`gangwayOf`).

import { alongside, berthSize, BERTH_HULL } from './shipLife.js';
import { hullBuild, MOD_BUILDS } from './navalShips.js';   // GALLEON-HOLDINGS: hull 2's gangway follows the build that stands (SHIPS-2: hull 4's too)
import { hash32 } from '../../world/spawnedDungeons.js';
import { mulberry32 } from '../../combat/bloodArt.js';
import { SHORE_TERRAIN_FIT_METERS } from '../../world/deepWaterFloor.js';   // HARBOUR-BOOK: the shelf a pier crosses

/** The water between her widest and the quay's face (m) - the fenders' room. */
export const QUAY_GAP = 0.8;
/** The quay's deck, face to back (m). */
export const QUAY_WIDTH = 4.5;
/** The deck's top over the sea's (m), and its planking with its joists (m). */
export const QUAY_DECK_UP = 1.6;
export const QUAY_DECK_T = 0.3;
/** The quay past her bow and past her stern (m). */
export const QUAY_ENDS = 3;
/** The piles: along each edge every this (m), their radius, and the deepest foot under the sea's top (m). */
export const PILE_STEP = 4;
export const PILE_R = 0.22;
export const PILE_DEPTH = 6;
/** The jetty to the shore: its width, the walk's step and its reach from the quay's back, and how far onto a bank (m).
 *  HARBOUR-BOOK: its reach the Deep Waters shelf's whole shore fit - past it the floor is carved full depth (no shallower
 *  than min(11.2 m, Water Depth), deepBathymetry.js), so the deepest keel's berth lies within it - and JETTY_BEACH more
 *  over a beach standing under DRY_M at the water's edge. */
export const JETTY_WIDTH = 3;
export const JETTY_STEP = 1;
export const JETTY_BEACH = 20;
export const JETTY_MAX = SHORE_TERRAIN_FIT_METERS + JETTY_BEACH;
export const JETTY_LAND = 2;
/** Ground this far over the sea's top is dry land; within STEP_M of the deck it meets the deck (m). */
export const DRY_M = 0.1;
export const STEP_M = 0.35;
/** A ramp down to a beach: its fall a metre, and its longest run (m). */
export const RAMP_SLOPE = 0.45;
export const RAMP_MAX = 10;
/** A bollard's radius and height, a lantern's head over the deck (m). */
export const BOLLARD_R = 0.18;
export const BOLLARD_H = 0.55;
export const LANTERN_UP = 3.2;
/** How far a lantern hangs out from its post toward the water, and its glass's centre under the post's head (m). */
export const LANTERN_ARM = 0.45;
export const LANTERN_DROP = 0.35;
/** The cargo's stream, and the most pieces a quay stacks. */
export const QUAY_SALT = 0x9a1e;
export const CARGO_MAX = 5;

/** Docking: her way under this (m/s), her alongside place within this (m), her bow within this of the berth's line
 *  (degrees), eased at this a second and never faster than WARP_SPEED (m/s); made fast within FAST_M and FAST_DEG of it. */
export const DOCK_WAY = 2;
export const DOCK_REACH_M = 25;
export const DOCK_ANGLE = 40;
export const DOCK_EASE = 0.5;
export const WARP_SPEED = 2;
export const FAST_M = 1.5;
export const FAST_DEG = 6;
/** The gangway: how near its foot the feet must stand to take it aboard, and how near her rail by its head to take it
 *  ashore (m) - AUDIT HOLDINGS Q4: by the rail, never anywhere on her deck (the whole of a small boat's was in reach). */
export const GANGWAY_REACH = 3;
export const GANGWAY_ASHORE = 1.5;
/** AUDIT HOLDINGS Q4: how square to her (or to the land) the look must be to take it - the cosine. */
export const GANGWAY_FACING = 0.7;
/** AUDIT HOLDINGS Q1: the steepest a gangway climbs to a ship (degrees) - its foot as far in on the quay as it must. */
export const GANGWAY_SLOPE = 30;
/** AUDIT HOLDINGS Q1: a climbing gangway's foot never nearer the quay's face than GANGWAY_CLEAR (it rises clear of the
 *  kerb and the bollard at her waist), nor nearer its back than GANGWAY_BACK (room to step off it) (m). */
export const GANGWAY_CLEAR = 2;
export const GANGWAY_BACK = 1;
/** AUDIT HOLDINGS Q1: the lane each side of her waist (the berth's own point, the frame's z 0) the quay's cargo keeps
 *  clear of - the plank, a crate's half and room to step off it (m). */
export const GANGWAY_LANE = 1.6;
/** The kerb along a quay's face: its width and its height over the deck (m; world/quayModel.js stands it). */
export const QUAY_KERB_W = 0.3;
export const QUAY_KERB_H = 0.15;
/**
 * AUDIT HOLDINGS Q1: WHERE A GANGWAY MEETS HER, by hull - `[x, y]` in her frame at her waist, measured off her own
 * colliders (the plank laid to her innermost rail cell climbed into her side under her deck on every hull but the
 * Rowboat's): a ship's at her main deck's entry port, just off her side; a boat's on her gunwale, the plank resting on it.
 * GALLEON-HOLDINGS: the Small Ship's is Mac's galleon's (QUAYS measured the mod's, which left her plank 2.3 m off
 * her side and 2.6 m under her main deck) - read through `gangwaySide`, which keeps the mod's galleon's while she
 * stands in.
 */
export const GANGWAY_SIDE = Object.freeze([
  Object.freeze([0.95, 0.7]),    // 0 Rowboat - on her gunwale (0.63 m up at 0.9 m out)
  Object.freeze([1.9, 2.26]),    // 1 Large Boat - SHIPS-2: Mac's Tiny Ship: on her gunwale's cap at its outer edge (1.89 out, 2.25 up)
  Object.freeze([5.45, 6.7]),    // 2 Small Ship - Mac's galleon: the entry port in her waist's bulwark, her side 5.33 m out there
  Object.freeze([9.2, 10.75]),   // 3 Large Galley - her upper deck (she never docks - DOCK_REFUSED)
  Object.freeze([6.21, 8.31]),   // 4 Carrack - SHIPS-2: Mac's carrack: the entry port in her waist's bulwark (its sill 7.94 up and 6.09 out), half a metre over her deck
]);
/** GALLEON-HOLDINGS: the mod's own Small Ship's - her main deck's port, her side 7.5-7.55 m out there - hull 2's
 *  while she stands in for Mac's galleon (navalShips.js MOD_SMALL_SHIP_BUILD, AUDIT GN-G4). */
export const MOD_SMALL_SHIP_GANGWAY = Object.freeze([7.65, 4.14]);
/** SHIPS-2: the mod's own Carrack's - her main deck's port, her side 7.45-7.5 m out there - hull 4's while it stands in
 *  for Mac's carrack (navalShips.js MOD_CARRACK_BUILD). */
export const MOD_CARRACK_GANGWAY = Object.freeze([7.65, 4.14]);
/** SHIPS-2: the mod's own Large Boat's - on its gunwale (1.27 m up at 1.7-1.8 m out) - hull 1's while it stands in for
 *  Mac's Tiny Ship (navalShips.js MOD_LARGE_BOAT_BUILD). */
export const MOD_LARGE_BOAT_GANGWAY = Object.freeze([1.75, 1.36]);
/** SHIPS-2: the mod's own gangway of each hull a ship of the port's stands in for. */
export const MOD_GANGWAYS = Object.freeze({ 1: MOD_LARGE_BOAT_GANGWAY, 2: MOD_SMALL_SHIP_GANGWAY, 4: MOD_CARRACK_GANGWAY });
/** GALLEON-HOLDINGS: where a gangway meets `hull` - GANGWAY_SIDE's, but the mod's own ship's wherever its is the build
 *  that stands (SHIPS-2: the galleon's, the carrack's and the large boat's). */
export const gangwaySide = (hull) => (MOD_GANGWAYS[hull] && hullBuild(hull) === MOD_BUILDS[hull] ? MOD_GANGWAYS[hull] : GANGWAY_SIDE[hull] ?? GANGWAY_SIDE[0]);
/** AUDIT HOLDINGS Q2: the hulls no quay takes - a Large Galley (93 m) is half again a Carrack's berth, and rows in and
 *  out as the sea's own never moor (shipLife.js). */
export const DOCK_REFUSED = Object.freeze([3]);

const TAU = Math.PI * 2;
const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const DEG = Math.PI / 180;

/**
 * A berth's frame: its origin the berth's place, `theta` the trs yaw (radians) that turns its +x toward the land, and
 * her extent along its +z - `zSign` +1 where her bow points along it. The harbour's hull sizes her.
 * @param {{ pos: number[], yaw: number, normal: number[] }} berth @param {number} [hull]
 */
export function quayFrame(berth, hull = BERTH_HULL) {
  const [nx, nz] = berth.normal;
  const theta = Math.atan2(nz, -nx);
  const fz = Math.sin(berth.yaw) * nz - Math.cos(berth.yaw) * nx;   // her bow along +z (sin theta, cos theta) = (nz, -nx)
  const zSign = fz >= 0 ? 1 : -1;
  const s = berthSize(hull);   // SHIPS-2: the harbour's hull's the berths' template's (shipLife.js berthSize)
  const zAft = zSign > 0 ? s.aftZ : -s.bowZ, zBow = zSign > 0 ? s.bowZ : -s.aftZ;
  return { origin: [berth.pos[0], berth.pos[1]], theta, zSign, halfWidth: s.halfWidth, z0: Math.min(zAft, zBow), z1: Math.max(zAft, zBow) };
}
/** A point of the berth's frame in the scene: `[x, z]`. */
export function quayToScene(frame, lx, lz) {
  const c = Math.cos(frame.theta), s = Math.sin(frame.theta);
  return [frame.origin[0] + lx * c + lz * s, frame.origin[1] - lx * s + lz * c];
}
/** A scene point in the berth's frame: `[lx, lz]`. */
export function sceneToQuay(frame, x, z) {
  const c = Math.cos(frame.theta), s = Math.sin(frame.theta), dx = x - frame.origin[0], dz = z - frame.origin[1];
  return [dx * c - dz * s, dx * s + dz * c];
}

/**
 * A berth's quay, in its frame (y over the sea's top): the deck, the jetty and the ramp to the shore, the piles, the
 * bollards, the lanterns and the cargo - or null while the ground it is laid on is not built
 * (`groundAt` not finite), to be laid again once it is.
 * @param {{ berth: { pos: number[], yaw: number, normal: number[] }, hull?: number, key?: string, index?: number,
 *   seaY: number, groundAt: (x: number, z: number) => number }} a
 */
export function planQuay({ berth, hull = BERTH_HULL, key = '', index = 0, seaY, groundAt }) {
  const frame = quayFrame(berth, hull);
  const deck = QUAY_DECK_UP;
  const x0 = frame.halfWidth + QUAY_GAP, x1 = x0 + QUAY_WIDTH;
  const z0 = frame.z0 - QUAY_ENDS, z1 = frame.z1 + QUAY_ENDS;
  let unbuilt = false;
  /** The ground under a point of the frame, over the sea's top - NaN (and the plan unbuilt) where it is not up yet. */
  const ground = (lx, lz) => {
    const [x, z] = quayToScene(frame, lx, lz);
    const g = groundAt(x, z);
    if (!Number.isFinite(g)) { unbuilt = true; return NaN; }
    return g - seaY;
  };
  const footOf = (lx, lz) => { const g = ground(lx, lz); return Math.max(-PILE_DEPTH, Number.isFinite(g) ? g - 0.3 : -PILE_DEPTH); };
  const piles = [];
  /** Piles along a line of the frame where the ground is under the deck. */
  const pileRow = (lx, from, to) => {
    const n = Math.max(1, Math.round((to - from) / PILE_STEP));
    for (let k = 0; k <= n; k++) {
      const lz = from + ((to - from) * k) / n;
      const foot = footOf(lx, lz);
      if (foot < deck - QUAY_DECK_T - 0.4) piles.push([lx, lz, foot]);
    }
  };
  pileRow(x0 + PILE_R, z0 + PILE_R, z1 - PILE_R);
  pileRow(x1 - PILE_R, z0 + PILE_R, z1 - PILE_R);
  // the shore, walked from the quay's back along +x at her waist
  const zJ = (frame.z0 + frame.z1) / 2;
  let jetty = null, ramp = null;
  for (let t = 0; t <= JETTY_MAX && !jetty; t += JETTY_STEP) {
    const g = ground(x1 + t, zJ);
    if (!Number.isFinite(g)) break;
    // a bank meets the deck - AUDIT HOLDINGS Q9: one standing over it by more than two steps (a wall, a cliff) is met at
    // its face, never run JETTY_LAND into it
    if (g >= deck - STEP_M) { jetty = { x0: x1, x1: x1 + t + (g <= deck + 2 * STEP_M ? JETTY_LAND : 0), z0: zJ - JETTY_WIDTH / 2, z1: zJ + JETTY_WIDTH / 2 }; break; }
    if (g >= DRY_M) {
      // dry ground under the deck: the jetty to it, and a ramp down to the ground
      jetty = { x0: x1, x1: x1 + t, z0: zJ - JETTY_WIDTH / 2, z1: zJ + JETTY_WIDTH / 2 };
      let end = RAMP_MAX, endY = deck - RAMP_MAX * RAMP_SLOPE;
      for (let s = JETTY_STEP; s <= RAMP_MAX; s += JETTY_STEP) {
        const y = deck - s * RAMP_SLOPE, gs = ground(x1 + t + s, zJ);
        if (!Number.isFinite(gs)) break;
        if (y <= gs + 0.05) { end = s; endY = Math.max(y, gs); break; }
      }
      ramp = { x0: x1 + t, x1: x1 + t + end, y0: deck, y1: endY, z0: jetty.z0, z1: jetty.z1 };
    }
  }
  if (unbuilt) return null;
  if (jetty && jetty.x1 - jetty.x0 > 0.5) {
    pileRow(Math.min(jetty.x1, x1 + 0.6), jetty.z0 + PILE_R, jetty.z1 - PILE_R);
    for (let lx = x1 + PILE_STEP; lx < jetty.x1 - 0.5; lx += PILE_STEP) pileRow(lx, jetty.z0 + PILE_R, jetty.z1 - PILE_R);
  }
  if (unbuilt) return null;
  const zMid = (frame.z0 + frame.z1) / 2;
  const bollards = [[x0 + 0.45, frame.z0 + 4], [x0 + 0.45, zMid], [x0 + 0.45, frame.z1 - 4]];
  const lanterns = [[x1 - 0.4, z0 + 0.6], [x1 - 0.4, z1 - 0.6]];
  // the cargo: on the quay's back, clear of the jetty's mouth, the gangway's lane at her waist and the lanterns - its face
  // kept for the walk
  const r = mulberry32(hash32(keyHash(key), index >>> 0, QUAY_SALT));
  const cargo = [];
  const count = 2 + Math.floor(r() * (CARGO_MAX - 1));
  for (let k = 0, tries = 0; k < count && tries < 24; tries++) {
    const kind = r() < 0.6 ? 'crate' : 'barrel';
    const s = kind === 'crate' ? 0.8 + r() * 0.35 : 0.36;
    const lz = z0 + 2 + r() * (z1 - z0 - 4);
    const lx = x1 - 0.9 - r() * 1.2;
    if (Math.abs(lz - zJ) < JETTY_WIDTH / 2 + 1 || Math.abs(lz) < GANGWAY_LANE || Math.abs(lz - z0) < 1.6 || Math.abs(lz - z1) < 1.6) continue;
    if (cargo.some((c) => Math.abs(c.z - lz) < 1.6)) continue;
    const stack = kind === 'crate' && r() < 0.35 ? 2 : 1;
    cargo.push({ kind, x: lx, z: lz, s, stack });
    k++;
  }
  return {
    frame, deck, quay: { x0, x1, z0, z1 }, jetty, ramp, piles, bollards, lanterns, cargo,
  };
}
/** A harbour's key as a number for the cargo's stream (FNV-1a). */
export function keyHash(key) {
  let h = 0x811c9dc5;
  const s = String(key ?? '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
/** A lantern's glass in the berth's frame: `[lx, y, lz]` (y over the sea's top) for a post at `(lx, lz)`. */
export const lanternHead = (lx, lz, deck) => [lx - LANTERN_ARM, deck + LANTERN_UP - LANTERN_DROP, lz];
/** The lanterns' glass in the scene: `[x, y, z]` each, the sea's top at `seaY`. */
export function lanternLights(plan, seaY) {
  return plan.lanterns.map(([lx, lz]) => { const h = lanternHead(lx, lz, plan.deck); const [x, z] = quayToScene(plan.frame, h[0], h[2]); return [x, seaY + h[1], z]; });
}

/**
 * THE BERTH A SHIP OF THE PLAYER'S WARPS IN TO: of `berths` ([{ key, index, berth, hull (the harbour's), name, free }]),
 * the one whose alongside place for her hull lies within DOCK_REACH_M of her, her bow within DOCK_ANGLE of its line
 * either way, nearest first; `free` false (another ship lies at it) is passed over. Answers `{ key, index, name, pos:
 * [x, z], yaw, d }` - `yaw` the berth's line turned the way her bow lies - or null.
 * @param {{ pos: number[], yaw: number, hull: number }} ship @param {Array<any>} berths
 */
export function dockFor(ship, berths) {
  if (DOCK_REFUSED.includes(ship.hull)) return null;   // AUDIT HOLDINGS Q2
  let best = null;
  for (const b of berths) {
    if (b.free === false) continue;
    const at = alongside(b.berth, ship.hull, b.hull ?? BERTH_HULL);
    const d = Math.hypot(at[0] - ship.pos[0], at[1] - ship.pos[2]);
    if (d > DOCK_REACH_M || (best && d >= best.d)) continue;
    const ahead = Math.abs(wrap(ship.yaw - b.berth.yaw)) <= Math.PI / 2;
    const yaw = ahead ? b.berth.yaw : wrap(b.berth.yaw + Math.PI);
    if (Math.abs(wrap(ship.yaw - yaw)) > DOCK_ANGLE * DEG) continue;
    best = { key: b.key, index: b.index, name: b.name ?? null, pos: at, yaw, d };
  }
  return best;
}
/** Whether she lies made fast at `dock` (dockFor's): within FAST_M of its place and FAST_DEG of its line. */
export function madeFast(ship, dock) {
  return !!dock && dock.d <= FAST_M && Math.abs(wrap(ship.yaw - dock.yaw)) <= FAST_DEG * DEG;
}
/** One step of her warping in: her place eased toward the berth's at DOCK_EASE a second, never faster than WARP_SPEED
 *  (her hands on the warps, not a tow), and her heading brought round with it so both come home together -
 *  `{ pos: [x, z], yaw }`. Pure. */
export function warpStep(pos, yaw, dock, dt) {
  const t = Math.max(0, dt), dx = dock.pos[0] - pos[0], dz = dock.pos[1] - pos[1], d = Math.hypot(dx, dz);
  const ease = 1 - Math.exp(-DOCK_EASE * t);
  const step = Math.min(WARP_SPEED * t, d * ease);
  const k = d > 1e-9 ? step / d : 1;
  return { pos: [pos[0] + dx * k, pos[1] + dz * k], yaw: wrap(yaw + wrap(dock.yaw - yaw) * Math.max(k, ease)) };
}
/** Which of her sides lies to the quay: +1 her starboard (her frame's +x), -1 her port. `landward` the berth's frame's
 *  +x in the scene ([x, z]). */
export function quaySide(yaw, landward) {
  const sx = Math.cos(yaw), sz = -Math.sin(yaw);   // her starboard, the yaw's own +x
  return sx * landward[0] + sz * landward[1] >= 0 ? 1 : -1;
}
/**
 * AUDIT HOLDINGS Q1: A GANGWAY'S FOOT - the gangway runs square to her side, in the quay's frame (+x to the land), from
 * its head at her waist (GANGWAY_SIDE; `headX` its x in the frame, `headY` its height over the sea's top) to its foot on
 * the quay, `{ x, y }` (y over the sea's top), `x0`/`x1` the quay's face and back:
 *  - a head over the kerb (a ship's port): the foot on the deck, in from the face as far as a climb of GANGWAY_SLOPE
 *    asks - never nearer it than GANGWAY_CLEAR, nor nearer the back than GANGWAY_BACK - the plank clear of her all the
 *    way down (it leaves her side going out);
 *  - under it (a boat's gunwale): the foot on the kerb's outer edge, the plank down from it over the water onto her
 *    gunwale, as steep as she lies under the quay.
 */
export function gangwayFoot(headX, headY, x0, x1) {
  if (headY <= QUAY_DECK_UP + QUAY_KERB_H) return { x: x0, y: QUAY_DECK_UP + QUAY_KERB_H };
  const run = (headY - QUAY_DECK_UP) / Math.tan(GANGWAY_SLOPE * DEG);
  return { x: Math.min(x1 - GANGWAY_BACK, Math.max(x0 + GANGWAY_CLEAR, headX + run)), y: QUAY_DECK_UP };
}
/** The berth's landward direction in the scene, `[x, z]`. */
export const landwardOf = (berth) => [-berth.normal[0], -berth.normal[1]];
