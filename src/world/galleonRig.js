// @ts-check
// GALLEON (2026-10-01, Mac: "the sails and ropes"): THE NEW GALLEON'S RIG - her yards, her five sails, and her rope.
//
// Mac's scene stands two bare masts, a crow's nest and a bowsprit; the rig is built here over them, in the boat's frame
// (Unity's: +x starboard, +y up, +z the bow - world/galleonModel.js says where every measurement comes from).
//
// SHE IS RIGGED AS A BRIGANTINE, because two masts carry that rig and it sails every way the old galleon did:
//   - the FORE MAST square - a course and a topsail on their yards;
//   - the MAIN MAST a GAFF mainsail (fore-and-aft, the rig that works to windward) under a square main topsail;
//   - a JIB on the forestay out to the bowsprit's end.
// Every one is a sail as Come Sail Away's own are, so every line of the mod's sailing reads them (systems/
// comeSailAway.js): a node named for its kind (Square / Gaff / Stay) and size (Small / Large) with an Animator on the
// mod's own controllers - the Sail Controller (Stowed, or Unstowed blended by Wind -1..1) and the Staysail Controller
// (five Winds) - overridden with this ship's own clips; the yards and the gaff are BOOM nodes the trim turns about the
// mast (`Booms`, the C# sets each one's whole local rotation), each one's first child its sail, which is where the
// auto-trim asks whether that sail is stowed. The sail power the mod sums (GetSailPower) is what she sails on, so the
// kinds and sizes are her handling, not her canvas's shape: where the mod's galleon carried two large lateens, she
// carries these five, and what they make of her - her way and her turning, under the mod's handling and the responsive
// helm - is measured in systems/helmWay.js's header (AUDIT GN-R15: the arc page records only "five sails where the mod's
// galleon carried two lateens", no sail profile).
//
// A SAIL IS SKINNED AS THE MOD'S ARE (world/skinnedBake.js): one bone per grid point - a grid of them under the sail's
// Bones node, each of the canvas's two faces' vertices on its point's bone (AUDIT GN-R15: 72 bones for a square sail's
// 144 vertices) - so a clip can stand every corner of the canvas where it should be, and FixDeformations bakes the cloth
// where the bones are each tenth of a second, each of her five canvases on a frame of its own (AUDIT GN2-RG9: BAKE
// below). Its clips are positions only: STOWED (furled against its yard, brailed to its mast, or rolled down its stay),
// and Unstowed with the wind at -1 (taken aback, or bellied to port), 0 (hanging) and +1 (full, or bellied to
// starboard) - the jib's two more at -0.5 and +0.5, the Staysail Controller's five Winds, six clips in all (AUDIT
// GN-R15) - the blend tree mixes them by Wind, and a CrossFade from one state to the other walks every bone between
// them, so a sail falls from its yard as it is set. AUDIT GN2-TS6: Left and Right as the mod's own sails of each kind
// have them (a Large Square's Left its "Unstowed Backward"; a Large Gaff's and a Large Staysail's Left to port). Every
// sail's grid runs from its head (row 0) to its foot, so its picture stands upright on it (AUDIT GN-R13).
//
// THE ROPE: shrouds with their ratlines and deadeyes on channels outside her rail, the stays fore and aft, backstays,
// the bowsprit's bobstay - still in her frame, a mesh each for each mast's shrouds, the stays, the backstays and the
// flagstaff (AUDIT GN-R15: not one mesh) - a yard's lifts and the gaff's peak halyard in its spar's mesh under its boom,
// so they swing with it, and the running rope that moves: each yard's braces, the fore course's and the jib's sheets
// and the gaff's mainsheet (AUDIT GN-R15: one course), every one a two-bone skinned rope from a bone on the moving spar
// or the sail's own clew to one on her deck, baked EVERY FRAME (AUDIT GN2-RG1: on FixDeformations' tenth of a second a
// rope with one end on a swinging spar and the other on her deck was drawn where both stood at its last bake - its end
// trailed its spar 1.2-1.7 m at the auto-trim's 100 degrees a second, 4.99 m through a gybe), so it follows the trim
// and the sail's set; a sheet hangs under its own sail, so a sail struck from sight takes its sheets with it (AUDIT
// GN2-RG2). Every rope's end lies on what it is made fast to - a masthead, a spar, her bulwark's or her castle rail's
// top, her deck, her stem (AUDIT GN-R7) - on every frame it is drawn, and none passes through canvas, spar or her hull
// at any trim the auto-trim sets (AUDIT GN-R2..R4).
//
// Not a DFU member. Ledger A (GALLEON).
import { MeshBench, prism, rope, box, sub, add, scl, len, norm, lerp3, sagging } from './galleonMesh.js';
import { TEX, GALLEON_TILE } from './galleonArt.js';
import { nodeOf, constClip, posCurve } from './shipKit.js';   // SHIPS-2: the shipwright's kit, every ship's
import { FIX_DEFORMATIONS_INTERVAL } from './skinnedBake.js';

/**
 * Where the rig stands (the boat's frame, metres). AUDIT GN-R10/R15: the masts are measured off the bake itself
 * (src/assets/galleon/galleon.json, roles mainMast and foreMast - not MEASURED, which carries none of them): each is a
 * regular pentagonal prism, a corner forward and a flat face aft, its axis (the pentagon's middle) at x 0 and z `mainZ`
 * / `foreZ` - the booms pivot on it (they pivoted on the masts' boxes' middles, -0.1225 and 8.8375: 6.85 cm forward of
 * the main's axis, 6.55 of the fore's) - its corners `*FootR` from it at `mastFootY` (her step) tapering to `*HeadR` at
 * its head (`mainTopY` / `foreTopY`). The crow's nest is a flared cup over the main masthead (from 18.131 up): its
 * floor `nestFloorY`, its rim `nestTopY`. Her bulwark's top is `railY` (5.08 to 5.325 out, amidships), her main deck
 * `deckY`. `mainR` / `foreR` are what a yard's slings and the gaff's jaws stand off the mast by.
 */
export const RIG = Object.freeze({
  mainZ: -0.191, foreZ: 8.772,
  deckY: 6.202, mainTopY: 18.683, foreTopY: 16.939, nestFloorY: 18.767, nestTopY: 19.782,
  mastFootY: 0.771, mainFootR: 0.7, mainHeadR: 0.538, foreFootR: 0.7, foreHeadR: 0.448,
  mainR: 0.55, foreR: 0.5,
  railY: 6.925,
  bowspritEnd: Object.freeze([0, 9.1, 27.55]),
  // AUDIT GN-R9: the bobstay's head on the bowsprit's underside near its end, its foot on her stem's cutwater (the
  // bake's own surfaces: the underside 8.473 at z 27.5, the stem's leading edge 21.725 at y 2.1 - its foot stood 12.5 cm
  // abaft that edge, inside her, at 21.6)
  bowspritUnder: Object.freeze([0, 8.473, 27.5]),
  stem: Object.freeze([0, 2.1, 21.735]),
});

/** A mast's corners' distance from its axis at height `y` (its taper, the bake's). */
export function mastRadius(mast, y) {
  const [r0, r1, top] = mast === 'fore' ? [RIG.foreFootR, RIG.foreHeadR, RIG.foreTopY] : [RIG.mainFootR, RIG.mainHeadR, RIG.mainTopY];
  return r0 + (r1 - r0) * (y - RIG.mastFootY) / (top - RIG.mastFootY);
}
/** A point on a mast's side face (`s` +1 starboard, -1 port) at height `y`: the face's middle, between its side corner
 *  (18 degrees off athwartships, forward) and its aft corner (54 degrees off it, aft). */
export function mastSideFace(mast, y, s) {
  const r = mastRadius(mast, y), z = mast === 'fore' ? RIG.foreZ : RIG.mainZ;
  return [s * 0.7694 * r, y, z - 0.25 * r];
}

/** The sails: their yards' (or gaff's) height, their size, their kind - each one's node names say what the mod reads.
 *  A square sail's `belly` is how far its canvas fills forward set full, of its foot's width. */
export const SAILS = Object.freeze([
  Object.freeze({ key: 'ForeCourse', kind: 'square', size: '', mast: 'fore', yardY: 12.2, drop: 4.35, headW: 11.0, footW: 12.6, yardSpan: 12.4, belly: 0.15 }),
  // AUDIT GN-R2: the fore topsail's yard 0.35 m lower (it stood 1.4 cm under the jib's head and 0.157 m from the forestay
  // under radii of 0.215), its canvas as much shorter so its foot hangs where it did, clear of the course's yard (5 cm
  // at the nearest, the middle of its foot over the yard's slings);
  // AUDIT GN-R2/R3: the topsails fill half the course's (at 0.15 of the foot, 1.5 m of belly stood the fore topsail's
  // canvas through the jib and the main topsail's through the main stay as those were led; led clear now, the flatter
  // topsails keep their hit boxes 0.75 m the thinner - navalShips.js HULL_BUILDS' Small Ship)
  Object.freeze({ key: 'ForeTopsail', kind: 'square', size: 'Small', mast: 'fore', yardY: 16.0, drop: 3.4, headW: 8.0, footW: 10.0, yardSpan: 9.4, belly: 0.075 }),
  Object.freeze({ key: 'MainTopsail', kind: 'square', size: 'Small', mast: 'main', yardY: 17.65, drop: 4.2, headW: 8.6, footW: 10.4, yardSpan: 10.0, belly: 0.075 }),
  Object.freeze({ key: 'MainGaff', kind: 'gaff', size: 'Large', mast: 'main', boomY: 7.75, throatY: 12.75, peak: Object.freeze([7.2, -6.9]), clewZ: -8.0, boomLen: 8.6 }),
  Object.freeze({ key: 'Jib', kind: 'stay', size: 'Large' }),
]);
/** A square sail's canvas grid (columns across, rows down) and a fore-and-aft sail's (along the foot, up the luff). */
export const GRID = Object.freeze({ square: Object.freeze([9, 8]), gaff: Object.freeze([8, 7]), stay: Object.freeze([8, 7]), lateen: Object.freeze([9, 7]) });   // SHIPS-2: a lateen's along its foot
/** A clip's length (s): a CrossFade between the sail's states runs SAIL_ANIMATION_SPEED (2) of these. */
export const SAIL_CLIP_S = 1;
/** A yard's radius at its slings and at its arms (it tapers between). */
export const YARD_R = Object.freeze([0.17, 0.08]);
/** AUDIT GN-R1: how far a square sail's head stands off its yard's surface (its robands), and how far round the yard's
 *  underside toward its fore side the head is bent (from straight down); the furled roll's radius. */
export const HEAD_OFF = 0.02;
export const HEAD_TURN = 20 * Math.PI / 180;
export const FURL_R = 0.13;

/**
 * AUDIT GN2-RG1/RG9: HOW HER SKINNED RENDERERS BAKE - a `BakeCadence` on the renderer's node, which Come Sail Away's walk
 * reads onto its FixDeformations holder (systems/comeSailAwayBoat.js; the mod's own boats carry none: a tenth of a second
 * from nought, as the C# times them). Her running rope every frame (`everyFrame`: scenes/comeSailAwayPool.js, never
 * while the game is paused, nor again while its bones stand where they did at its last bake); each canvas on the mod's
 * tenth of a second from its own `timer` - the k-th sail's k fifths of the interval - so her five bake on frames of
 * their own (her five canvases and eleven ropes baked on one frame together: 277-279 us at once).
 */
export const BAKE = Object.freeze({ rope: Object.freeze({ everyFrame: true }), canvasTimer: (k) => Math.fround(k * FIX_DEFORMATIONS_INTERVAL / SAILS.length) });
const bakeCadence = (o) => ({ type: 'BakeCadence', ...o });


/** A square sail's yard's radius `x` along it from its slings (its taper). */
export function yardRadius(sail, x) {
  const R = sail.yardR ?? YARD_R;   // SHIPS-2: or the sail's own yard's (world/largeBoatRig.js: a boat's lighter spars)
  return R[0] + (R[1] - R[0]) * Math.min(1, Math.abs(x) / (sail.yardSpan / 2));
}
/** How far forward of its mast's axis a square sail's yard hangs (its boom's frame z). */
export const yardOffset = (sail) => (sail.mast === 'fore' ? RIG.foreR : RIG.mainR) + 0.24;

// ── the canvas ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A square sail's corner positions (its boom's frame: the yard on the mast's axis line at y 0, `d` before it) in a
 *  pose: 'center' hanging, 'full' bellied forward, 'aback' pressed back, 'stowed' furled on the yard. */
export function squareSailPose(sail, d, mastR, pose) {
  const [NU, NV] = GRID.square;
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = j / (NV - 1);
    const w = sail.headW + (sail.footW - sail.headW) * v;
    const x0 = (u - 0.5) * w;
    // AUDIT GN-R1: the head bent to the yard - its row HEAD_OFF off the yard's surface (the yard's own taper: at the arms
    // it stood 10 cm off), turned HEAD_TURN round its underside toward its fore side - and the canvas hanging from it
    const rh = yardRadius(sail, x0) + HEAD_OFF;
    let x = x0, y = -rh * Math.cos(HEAD_TURN) - v * sail.drop, z = d + rh * Math.sin(HEAD_TURN);
    const arch = Math.sin(Math.PI * u);
    if (pose === 'center') z -= 0.1 * arch * v;
    else if (pose === 'full') {
      // AUDIT GN-R1: no belly at the head (sin(pi (0.15 + 0.8 v)) bellied it 0.454 of the most there - the course's head
      // stood 0.77 m off its yard, the topsails' 0.6), the most two thirds down, the foot held by its clews
      const belly = sail.belly * sail.footW * arch * Math.sin(0.8 * Math.PI * v);
      z += belly; y += 0.07 * sail.drop * arch * v; x *= 1 - 0.035 * Math.sin(Math.PI * v);
    } else if (pose === 'aback') {
      // SHIPS-2: or the depth a sail of another ship's names (`aback` - world/carrackRig.js's, whose yards hang further off
      // their masts than her shrouds would let the canvas press back)
      z -= (sail.aback ?? Math.min(0.1 * sail.footW, d - mastR - 0.06)) * arch * Math.sin(Math.PI * v) + 0.04 * v;
    } else if (pose === 'stowed') {
      // AUDIT GN-R1: the furled roll seated against the yard (its nearest turn hung 11-17 cm off it): a roll of FURL_R
      // round a line FURL_R + HEAD_OFF off the yard's surface, the head's own way round it - each row a turn on from the
      // last, the head's touching the yard
      const xr = (u - 0.5) * (sail.headW - 0.2);
      const D = yardRadius(sail, xr) + HEAD_OFF + FURL_R;
      const ny = -Math.cos(HEAD_TURN + 0.35), nz = Math.sin(HEAD_TURN + 0.35);   // out from the yard's axis to the roll's
      const phi = j * 1.25 + u * 0.4;
      x = xr;
      y = D * ny - FURL_R * (Math.cos(phi) * ny + Math.sin(phi) * nz);
      z = d + D * nz - FURL_R * (Math.cos(phi) * nz - Math.sin(phi) * ny);
    }
    out.push([x, y, z]);
  }
  return out;
}

/** The gaff mainsail's corners (its boom's frame: the main mast's axis at the boom's height) in a pose: 'center',
 *  'port' / 'starboard' bellied to that side, 'stowed' brailed in to the mast. Row 0 is its head (AUDIT GN-R13). */
export function gaffSailPose(sail, mastR, pose) {
  const [NU, NV] = GRID.gaff;
  const luffZ = -(mastR + 0.12);
  const tack = [0, 0.32, luffZ], clew = [0, 0.32, sail.clewZ];
  const throat = [0, sail.throatY - sail.boomY - 0.15, luffZ], peak = [0, sail.peak[0] - 0.12, sail.peak[1]];
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = 1 - j / (NV - 1);   // AUDIT GN-R13: v 1 at the head (row 0), 0 at the foot
    const foot = lerp3(tack, clew, u), head = lerp3(throat, peak, u);
    let p = lerp3(foot, head, v);
    const arch = Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.1 + 0.85 * v));
    if (pose === 'port') p[0] -= 1.1 * arch;
    else if (pose === 'starboard') p[0] += 1.1 * arch;
    else if (pose === 'center') p[0] += 0.12 * arch;
    else if (pose === 'stowed') {
      const luff = lerp3(tack, throat, v);
      const k = 0.07 + 0.05 * Math.sin(u * Math.PI * 3);
      p = lerp3(luff, p, k);
      p[0] += 0.18 * Math.sin(u * 7 + v * 3);
    }
    out.push(p);
  }
  return out;
}

/**
 * The jib on its stay (her own frame). AUDIT GN-R2: its head `headDown` down the forestay from the stay's head, now at
 * the fore masthead (the jib was set through the fore topsail's yard - its head 1.4 cm off it, its canvas 0.17 m into
 * it - and its leech met that sail set); its clew forward at `clew` (it stood at z 16.6, under the fore topsail's
 * belly); its luff `luffOff` under the stay, from `tackUp` short of the stay's foot. Its grid stops `top` of the way up
 * to its head, its head row a cut 12 cm across it there (a grid closed to the point had fourteen triangles of no area).
 */
export const JIB = Object.freeze({ headDown: 0.35, tackUp: 0.45, luffOff: 0.075, top: 0.985, clew: Object.freeze([0, 7.85, 19.6]) });
/** The jib's tack, clew and head (where its luff and leech meet). */
export function jibCorners() {
  const { head: sh, foot: sf } = stayLines().forestay;
  const along = norm(sub(sf, sh)), L = len(sub(sf, sh));
  const under = [0, -along[2], along[1]];   // square to the stay in her centreline, downward
  const onLuff = (s) => add(add(sh, scl(along, s)), scl(under, JIB.luffOff));
  return { tack: onLuff(L - JIB.tackUp), clew: [...JIB.clew], head: onLuff(JIB.headDown) };
}
/** The jib's corners (the boat's frame) in a pose: 'center', 'port' / 'starboard' (bellied to that side, the two
 *  halves of the Staysail Controller's five Winds at their halves), 'stowed' rolled down its stay. Row 0 is its head. */
export function jibPose(pose, k = 1) {
  return staysailPose(jibCorners(), pose, k);
}
/** SHIPS-2: ANY STAYSAIL'S CORNERS - the jib's law, on its own `tack`, `clew` and `head` (the boat's frame): in a pose,
 *  its grid stopping `top` of the way up to its head (the jib's), bellied `belly` m set full (the jib's 1.0;
 *  world/largeBoatRig.js's own are smaller). Row 0 is its head. */
export function staysailPose({ tack, clew, head }, pose, k = 1, top = JIB.top, belly = 1.0) {
  const [NU, NV] = GRID.stay;
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = 1 - j / (NV - 1);   // AUDIT GN-R13: v 1 at the head (row 0), 0 at the foot
    const foot = lerp3(tack, clew, u);
    let p = lerp3(foot, head, v * top);
    const arch = Math.sin(Math.PI * u) * (1 - v) * 1.6 * Math.sin(Math.PI * (0.2 + 0.6 * (1 - v)));
    if (pose === 'port') p[0] -= belly * k * arch;
    else if (pose === 'starboard') p[0] += belly * k * arch;
    else if (pose === 'center') p[0] += 0.1 * arch;
    else if (pose === 'stowed') {
      const stay = lerp3(tack, head, Math.min(1, v * 0.97 + u * 0.03));
      p = [stay[0] + 0.12 * Math.sin(u * 6 + j), stay[1] - 0.12, stay[2] + 0.06 * Math.cos(u * 5)];
    }
    out.push(p);
  }
  return out;
}

/**
 * SHIPS-2: A LATEEN - any ship's (world/carrackRig.js's mizzen, world/largeBoatRig.js's): its yard slung on its mast's
 * port side `sail.side` off the axis from its fore end `sail.fore` (low) to its after end `sail.aft` (high), her frame,
 * its radius `sail.yardR` at its slings and its ends; its foot from its tack at `sail.footY` under the yard's fore end to
 * its clew at `sail.clewZ` (and `sail.clewY`, level with its tack unless it says - a boat's rises over her helm). `mast` is its mast - `{ z, top, radius(y) }` (her frame; `radius` its corners' off
 * its axis at a height). Its boom stands on the mast's axis where its yard passes the mast.
 */
export function lateenBoomY(sail, mast) {
  return sail.fore[1] + (sail.aft[1] - sail.fore[1]) * (sail.fore[2] - mast.z) / (sail.fore[2] - sail.aft[2]);
}
/** The lateen's yard's two ends in its boom's frame (the mast's axis at the boom's height), on the mast's port side. */
export function lateenYard(sail, mast) {
  const y0 = lateenBoomY(sail, mast);
  const at = (p) => [-sail.side, p[1] - y0, p[2] - mast.z];
  return { fore: at(sail.fore), aft: at(sail.aft) };
}
/**
 * The lateen's corners (its boom's frame) in a pose: its head along the yard from its throat (`sail.throat` m up from
 * the yard's fore end) to its peak (`sail.peakIn` m short of its after end), HEAD_OFF under the yard's surface; its foot
 * level from its tack under the yard's fore end to its clew. Row 0 its head (AUDIT GN-R13's law). 'right' bellied away
 * from the mast (to port: the good tack - the mod's Right, "GoodTack"), 'left' pressed toward it (the bad tack: its
 * canvas held off the mast within `sail.pin` m of it - flat against its side there, as a lateen lies on the bad tack),
 * 'center' hanging, 'stowed' brailed up under its yard. Its belly `sail.belly` m set full.
 */
export function lateenSailPose(sail, mast, pose) {
  const [NU, NV] = GRID.lateen;
  const { fore, aft } = lateenYard(sail, mast);
  const y0 = lateenBoomY(sail, mast);
  const along = norm(sub(aft, fore)), L = len(sub(aft, fore));
  const under = [0, along[2], -along[1]];   // square to the yard in its plane, down (the yard rises aft: along's z < 0)
  const onYard = (s) => add(add(fore, scl(along, s)), scl(under, sail.yardR[0] + HEAD_OFF));
  const throat = onYard(sail.throat), peak = onYard(L - sail.peakIn);
  const tack = [-sail.side, sail.footY - y0, throat[2] - 0.15 * (sail.throat / 1.2)], clew = [-sail.side, (sail.clewY ?? sail.footY) - y0, sail.clewZ - mast.z];
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = 1 - j / (NV - 1);   // the head's row first (v 1), the foot's last
    const footAt = lerp3(tack, clew, u), headAt = lerp3(throat, peak, u);
    let p = lerp3(footAt, headAt, v);
    const arch = Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.1 + 0.85 * v));
    if (pose === 'right') p[0] -= sail.belly * arch;
    else if (pose === 'center') p[0] -= 0.11 * sail.belly * arch;
    else if (pose === 'left') p[0] += sail.belly * arch * Math.min(1, Math.max(0, (Math.abs(p[2]) - sail.pin * 0.3) / sail.pin));
    else if (pose === 'stowed') {
      const k = 0.06 + 0.05 * Math.sin(u * Math.PI * 3);
      p = lerp3(headAt, p, k);
      p[0] -= sail.yardR[0] * 0.7 + 0.1 * Math.sin(u * 9 + v * 2) * (sail.yardR[0] / 0.19);
    }
    out.push(p);
  }
  return out;
}
/** The lateen's spars in its boom's frame: its yard (thickest at its slings, where it passes the mast), an iron band
 *  there, the parrel round the mast that holds it, and its halyard from the slings up into the masthead. Worn in
 *  `archive` (a ship's own; the pictures it wears are the fleet's shared ones). */
export function lateenSparsGeometry(sail, mast, archive = undefined) {
  const bench = new MeshBench(archive);
  const { fore, aft } = lateenYard(sail, mast);
  const y0 = lateenBoomY(sail, mast);
  const slings = [-sail.side, 0, 0];
  prism(bench, TEX.spar, slings, fore, sail.yardR[0], sail.yardR[1], 8, { smooth: true, tileV: GALLEON_TILE.spar[1] });
  prism(bench, TEX.spar, slings, aft, sail.yardR[0], sail.yardR[1], 8, { smooth: true, tileV: GALLEON_TILE.spar[1] });
  const along = norm(sub(aft, fore)), band = sail.yardR[0] * 0.42;
  prism(bench, TEX.iron, sub(slings, scl(along, band)), add(slings, scl(along, band)), sail.yardR[0] * 1.13, sail.yardR[0] * 1.13, 8, { smooth: true });
  // the parrel: a rope ring round the mast, made fast to the yard at its slings
  const r = mast.radius(y0) + sail.yardR[0] * 0.26, N = 10, rr = Math.max(0.018, sail.yardR[0] * 0.18), dy = -sail.yardR[0] * 0.63;
  const ring = [];
  for (let k = 0; k <= N; k++) { const a = Math.PI / 2 + (k / N) * Math.PI * 2; ring.push([Math.sin(a) * -r, dy, Math.cos(a) * r]); }
  rope(bench, TEX.rope, ring, rr);
  rope(bench, TEX.rope, [[-r, dy, 0], [slings[0] + sail.yardR[0] * 0.7, -sail.yardR[0] * 0.26, 0]], rr);
  // the halyard, from the slings up to the masthead's face on their side (SHIPS-2: to its axis it went into the mast
  // half way up - the slings stand off the mast, which tapers: led to its face it lies outside the mast all the way)
  rope(bench, TEX.rope, [add(slings, [0, sail.yardR[0], 0]), [-(mast.radius(mast.top - 0.15) + rr), mast.top - 0.15 - y0, 0]], rr * 0.86);
  return bench.finish();
}

/**
 * A sail's skinned canvas: both faces of its grid (each face its own vertices, so its normals face its own way),
 * every vertex on the bone of its grid point, the bind poses those bones' rest (`rest`, the grid in the mesh's frame).
 * Row 0 is the sail's head, so the picture's top (v 1) is there and its foot's weathering at its foot (AUDIT GN-R13).
 */
export function canvasGeometry(rest, [NU, NV]) {
  const nGrid = NU * NV;
  const positions = new Float32Array(nGrid * 2 * 3), normals = new Float32Array(nGrid * 2 * 3), uvs = new Float32Array(nGrid * 2 * 2);
  const blendIndices = new Uint16Array(nGrid * 2);
  for (let side = 0; side < 2; side++) for (let k = 0; k < nGrid; k++) {
    const v = side * nGrid + k;
    positions.set(rest[k], v * 3);
    const i = k % NU, j = Math.floor(k / NU);
    uvs[v * 2] = side ? 1 - i / (NU - 1) : i / (NU - 1);
    uvs[v * 2 + 1] = 1 - j / (NV - 1);
    blendIndices[v] = k;
  }
  const idx = [];
  for (let j = 0; j + 1 < NV; j++) for (let i = 0; i + 1 < NU; i++) {
    const a = j * NU + i, b = a + 1, c = a + NU, d = c + 1;
    idx.push(a, b, d, a, d, c);                                      // one face
    idx.push(nGrid + a, nGrid + d, nGrid + b, nGrid + a, nGrid + c, nGrid + d);   // and the other, wound the other way
  }
  const indices = Uint32Array.from(idx);
  const bindPoses = rest.map((p) => translation(scl(p, -1)));
  return { vertexCount: nGrid * 2, positions, normals, uvs, indices, subMeshes: [{ startIndex: 0, primitiveCount: indices.length / 3 }], blendIndices, bindPoses, aabb: boxOf(rest) };
}

/** A two-bone skinned rope from `a` to `b` (the mesh's frame): a thin prism whose `a` ring rides bone 0 and `b` ring
 *  bone 1, its bind poses those two points. */
export function ropeGeometry(a, b, r = 0.03, sides = 4) {
  const bench = new MeshBench();
  prism(bench, TEX.rope, a, b, r, r, sides, { caps: [false, false], smooth: true, tileV: GALLEON_TILE.rope[1] });
  const g = bench.finish();
  const blendIndices = new Uint16Array(g.vertexCount);
  const ab = sub(b, a), L2 = Math.max(1e-9, ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]);
  for (let v = 0; v < g.vertexCount; v++) {
    const p = [g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]];
    const t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2;
    blendIndices[v] = t > 0.5 ? 1 : 0;
  }
  return { ...g, slots: undefined, blendIndices, bindPoses: [translation(scl(a, -1)), translation(scl(b, -1))] };
}

/** A translation as a column-major 4x4. */
export function translation(t) {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1; m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}
const boxOf = (pts) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  return { center: [0, 1, 2].map((k) => (min[k] + max[k]) / 2), extent: [0, 1, 2].map((k) => (max[k] - min[k]) / 2) };
};

// ── the spars ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** AUDIT GN-R7: where a yard's lifts are made fast, in its boom's frame (on the mast's axis, so they swing with the yard
 *  about it): a fore yard's into the fore masthead 0.12 m under its top (each went 1.3 m over its yard: the fore
 *  topsail's met 0.71 m over the masthead, in the air, the course's went into the mast 3.4 m under it), the main
 *  topsail's into the main masthead under the crow's nest's floor (they rose through the floor, to 0.18 m over it). */
export function liftHead(sail) {
  return [0, (sail.mast === 'fore' ? RIG.foreTopY - 0.12 : RIG.nestFloorY - 0.17) - sail.yardY, 0];
}
/** A yard: tapered from its slings to its arms, an iron band at each quarter, its footrope sagging under it, and its
 *  lifts up to its masthead (so they swing with it). In the boom's frame. */
export function yardGeometry(span, d, liftTo, { r = YARD_R, footropes = true } = {}) {
  const bench = new MeshBench();
  const half = span / 2;
  prism(bench, TEX.spar, [0, 0, d], [half, 0, d], r[0], r[1], 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  prism(bench, TEX.spar, [0, 0, d], [-half, 0, d], r[0], r[1], 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  for (const x of [-half * 0.5, half * 0.5]) prism(bench, TEX.iron, [x - 0.06, 0, d], [x + 0.06, 0, d], r[0] - 0.01, r[0] - 0.01, 8, { smooth: true });
  // the parrel holding it to the mast
  box(bench, TEX.trim, [0, 0, d * 0.55], [r[0] + 0.05, r[0] - 0.01, d * 0.45], { tile: GALLEON_TILE.trim });
  // its footropes, and its lifts to the masthead over it. AUDIT GN-R1: the footropes hang ABAFT the yard, where a hand
  // stands on them to work it (2 cm forward of the canvas's plane, they ran through it and its furled roll). SHIPS-2: a
  // boat's yard (`r` its own radii) none - her hands work it from her deck
  for (const s of [-1, 1]) {
    if (footropes) rope(bench, TEX.rope, sagging([s * 0.25, -0.1, d - 0.22], [s * (half - 0.15), -0.06, d - 0.16], 0.45, 6), 0.022);
    rope(bench, TEX.rope, [[s * (half - 0.2), 0.05, d], liftTo], 0.024);
  }
  return bench.finish();
}

/** The gaff and its boom, in the gaff-boom's frame (the main mast's axis at the boom's height): the boom aft along the
 *  foot, the gaff up to the peak, their jaws about the mast. */
export function gaffSparsGeometry(sail, mastR) {
  const bench = new MeshBench();
  const z0 = -(mastR + 0.05);
  prism(bench, TEX.spar, [0, 0.18, z0], [0, 0.18, -sail.boomLen], 0.16, 0.11, 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  const throat = [0, sail.throatY - sail.boomY, z0], peak = [0, sail.peak[0], sail.peak[1]];
  prism(bench, TEX.spar, throat, peak, 0.13, 0.08, 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  // the jaws: a dark collar half round the mast at each
  for (const y of [0.18, throat[1]]) box(bench, TEX.trim, [0, y, -mastR * 0.4], [mastR + 0.08, 0.1, mastR * 0.5], { tile: GALLEON_TILE.trim });
  // the peak halyard, from the peak up into the masthead (on its axis) - it swings with the gaff
  rope(bench, TEX.rope, [peak, [0, RIG.mainTopY - 0.7 - sail.boomY, 0]], 0.025);
  return bench.finish();
}

// ── the standing rope ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Her channels and the shrouds' feet on them. AUDIT GN-R4: the feet aft and closer together - the main's at z -5.3 to
 * -4.1 (they stood at -3.5 to -1.1), the fore's at 2.75 to 4.05 (6.2 to 7.8) - so no yard, canvas, footrope or brace
 * meets a shroud or a ratline at any trim the auto-trim sets (to 30 degrees: the fore course met the fore shrouds
 * through its canvas and its yard, the topsails theirs set aback), nor with the square yards braced to the manual 45
 * but a fore course brace, 2 cm into the aftmost fore shroud; the gaff swung past 30 still meets the main shrouds - its
 * sail at 45 and 60, its halyard at 60, its sheet at 75 and 90 (the gaff's sweep crosses the shrouds' sector, wherever
 * they stand). AUDIT GN-R10: each channel against her side (it stood 3.1-3.5 cm off it), its inner face where her
 * planking stands at its top edge (`inX` port and starboard, each side's own:
 * since AUDIT GN-B1 cut her faces as Blender does they mirror - the first bake's own cut stood her port side 2.7 cm
 * out under the main channels), its deadeyes on its top at its outer edge, each deadeye's chainplate down
 * through the channel's edge to her planking `chainDrop` under it (`plateX` her side there).
 */
export const CHANNELS = Object.freeze({
  main: Object.freeze({ feet: Object.freeze([-5.3, -4.9, -4.5, -4.1]), headY: 18.02, inX: Object.freeze([5.325, 5.325]), plateX: Object.freeze([5.387, 5.387]) }),
  fore: Object.freeze({ feet: Object.freeze([2.75, 3.4, 4.05]), headY: 16.09, inX: Object.freeze([5.325, 5.325]), plateX: Object.freeze([5.376, 5.376]) }),
  topY: 6.7, thick: 0.14, width: 0.52, deadeyeR: 0.11, deadeyeH: 0.22, chainDrop: 0.42,
});
/** Where each shroud stands: its head on its mast's side face, its foot on the deadeye on its channel - `deadeye` the
 *  deadeye's foot on the channel's top, `foot` its top where the rope begins, `plate` the chainplate's foot on her
 *  planking under the channel. */
export function shroudLines() {
  const lines = [];
  const C = CHANNELS;
  for (const s of [-1, 1]) {
    for (const mast of /** @type {const} */ (['main', 'fore'])) {
      const k = s > 0 ? 1 : 0, xd = C[mast].inX[k] + C.width - C.deadeyeR;
      for (const z of C[mast].feet) {
        const deadeye = [s * xd, C.topY, z];
        lines.push({ mast, side: s, head: mastSideFace(mast, C[mast].headY, s), foot: [s * xd, C.topY + C.deadeyeH, z], deadeye, plate: [s * C[mast].plateX[k], C.topY - C.thick - C.chainDrop, z] });
      }
    }
  }
  return lines;
}
/** The ratlines: a rung across each neighbouring pair of a mast's shrouds every 0.42 m, AUDIT GN-R10 each end on its
 *  shroud's own line (they were laid on a line 0.13 m over its foot: 244 of 408 ends more than the rope's radius off
 *  it). */
export function ratlineLines() {
  const out = [];
  const lines = shroudLines();
  for (const mast of ['main', 'fore']) for (const s of [-1, 1]) {
    const set = lines.filter((l) => l.mast === mast && l.side === s);
    for (let k = 0; k + 1 < set.length; k++) {
      const a = set[k], b = set[k + 1];
      const at = (l, y) => lerp3(l.foot, l.head, (y - l.foot[1]) / (l.head[1] - l.foot[1]));
      for (let y = 7.25; y < Math.min(a.head[1], b.head[1]) - 1.6; y += 0.42) out.push({ mast, side: s, a: at(a, y), b: at(b, y) });
    }
  }
  return out;
}
/**
 * The stays. AUDIT GN-R2: the forestay from the fore masthead's fore corner, 0.14 m under its head (it left the mast
 * 0.3 m under it, over the fore topsail's yard by less than the two's radii). AUDIT GN-R3: the main stay from the main
 * masthead under the crow's nest's floor down to the fore mast's after face over the fore course's yard (it ran to the
 * fore mast's foot, 5 cm through the main topsail set and 0.12 m into its yard at the auto-trim's 30). AUDIT GN-R9: the
 * bobstay from the bowsprit's underside to her stem (it began on the bowsprit's end and ran 1.1 m inside it).
 */
export function stayLines() {
  const foreHead = 16.8, mainHead = 18.6, mainFoot = 13.2;
  return {
    forestay: { head: [0, foreHead, RIG.foreZ + mastRadius('fore', foreHead)], foot: [...RIG.bowspritEnd], r: 0.045 },
    mainstay: { head: [0, mainHead, RIG.mainZ + mastRadius('main', mainHead)], foot: [0, mainFoot, RIG.foreZ - 0.809 * mastRadius('fore', mainFoot)], r: 0.05 },
    bobstay: { head: [...RIG.bowspritUnder], foot: [...RIG.stem], r: 0.04 },
  };
}
/** The backstays: the main's from its masthead to the castle rail's top, the fore's from its masthead to her bulwark's
 *  top abaft the fore channels. AUDIT GN-R7: each foot on the rail it is set up to (the fore's stood 5.5 cm outboard of
 *  her side, the main's buried in the castle rail); AUDIT GN-R15: the fore's are forward of the gangway (z -0.58..1.575),
 *  not abaft it. */
export function backstayLines() {
  const out = [];
  for (const s of [-1, 1]) {
    out.push({ mast: 'main', side: s, head: [s * 0.35, RIG.nestFloorY - 0.55, RIG.mainZ - 0.3], foot: [s * 5.07, 12.297, -11.2], r: 0.035 });
    out.push({ mast: 'fore', side: s, head: [s * 0.3, RIG.foreTopY - 0.6, RIG.foreZ - 0.25], foot: [s * 5.2, RIG.railY, 2.1], r: 0.032 });
  }
  return out;
}

/** The standing rigging, still in her frame, as the meshes it is drawn in - each mast's shrouds with their deadeyes,
 *  the ratlines across each pair and the channel they stand on (`mainShrouds`, `foreShrouds`), the stays and the
 *  bobstay (`stays`), the backstays (`backstays`) and the flagstaff over the crow's nest (`flagstaff`): a box a piece,
 *  never one round the whole rig from her bowsprit's end to her castle - a box that wide and tall stood higher the
 *  more she heeled (a sinking's list read its corner for her masthead). */
export function standingRiggingGeometry() {
  const lines = shroudLines(), rungs = ratlineLines();
  const C = CHANNELS;
  const shrouds = (mast) => {
    const bench = new MeshBench();
    const own = lines.filter((l) => l.mast === mast);
    for (const l of own) {
      rope(bench, TEX.rope, [l.foot, l.head], 0.032);
      // the deadeye on the channel, and AUDIT GN-R10 its chainplate from it down through the channel's edge to her
      // planking under it (it hung 0.21 m under the channel, 0.35-0.40 m off her side)
      prism(bench, TEX.trim, l.deadeye, l.foot, C.deadeyeR, C.deadeyeR, 6, { smooth: true });
      prism(bench, TEX.iron, add(l.deadeye, [0, 0.05, 0]), l.plate, 0.03, 0.03, 4);
    }
    for (const r of rungs.filter((q) => q.mast === mast)) rope(bench, TEX.rope, [r.a, r.b], 0.014, { sides: 3 });
    // the channels: a plank against her side under the mast's shrouds, out to the deadeyes
    const feet = C[mast].feet, z0 = Math.min(...feet) - 0.35, z1 = Math.max(...feet) + 0.35;
    for (const s of [-1, 1]) box(bench, TEX.trim, [s * (C[mast].inX[s > 0 ? 1 : 0] + C.width / 2), C.topY - C.thick / 2, (z0 + z1) / 2], [C.width / 2, C.thick / 2, (z1 - z0) / 2], { tile: GALLEON_TILE.trim });
    return bench.finish();
  };
  const S = stayLines();
  const stays = new MeshBench();
  for (const k of ['forestay', 'mainstay', 'bobstay']) rope(stays, TEX.rope, [S[k].head, S[k].foot], S[k].r);
  const backstays = new MeshBench();
  for (const b of backstayLines()) rope(backstays, TEX.rope, [b.head, b.foot], b.r);
  // the flagstaff over the crow's nest
  const flagstaff = new MeshBench();
  prism(flagstaff, TEX.spar, [0, RIG.nestFloorY, RIG.mainZ + 0.05], [0, RIG.nestTopY + 1.6, RIG.mainZ + 0.05], 0.09, 0.05, 6, { smooth: true, tileV: 2 });
  return { mainShrouds: shrouds('main'), foreShrouds: shrouds('fore'), stays: stays.finish(), backstays: backstays.finish(), flagstaff: flagstaff.finish() };
}

/**
 * The running rope's deck ends (her frame; the starboard one, the port its mirror). AUDIT GN-R7/R10: each on what it
 * is belayed to - the fore yards' braces aft, outside the fore shrouds, to her bulwark's top at the gangway's after end,
 * under the gaff's boom swung square (AUDIT GN-R15: they led to z 3.0, not to the main channels the comment named);
 * the main topsail's aft to the castle rail's top abaft the helm (z -17), over the gaff at the auto-trim's every swing
 * (they stood 7-10 cm off the rail, at -10.6, and ran through the gaff sail at 45); the fore course's sheets forward of
 * the fore channels (they crossed the foremost fore shroud over its deadeye); the jib's on her bulwark's top forward of
 * the fore mast, where her bow narrows (they ended 0.75 m over her deck, 1 m inboard of her bulwark); AUDIT GN-R6 the
 * mainsheet on her main deck at the castle's foot, abreast of its door and inboard of its stair (it was belayed inside
 * the castle's parapet, 4.85 m over her deck, and ran through the castle and its parapet).
 */
export const BELAYS = Object.freeze({
  foreBrace: Object.freeze([5.3, RIG.railY, -0.7]),
  mainBrace: Object.freeze([5.15, 12.297, -17.0]),
  courseSheet: Object.freeze([5.2, RIG.railY, 5.4]),
  jibSheet: Object.freeze([4.7, 6.959, 13.6]),
  mainSheet: Object.freeze([1.3, RIG.deckY, -9.8]),
});

// ── the rig as nodes ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * SHIPS-2: A RIG'S BENCH - how every ship of the port's makes her sails and her running rope (world/carrackRig.js's and
 * world/largeBoatRig.js's are made here as hers are): a still mesh's node (`meshNode`), a sail's node with its bones, its
 * skinned canvas and its clips over the mod's controller (`sailNode`), a running rope between two bones (`running`).
 * `ship` names her meshes and materials (`<ship>:sail:<key>`, `<ship>-canvas`), `clipPrefix` her clips and overrides,
 * `timerOf(sailKey)` each canvas's bake timer (BAKE); the clips and overrides made land in `clips` and `overrides`.
 */
export function rigBench(cx, { ship, clipPrefix, timerOf }) {
  const clips = {}, overrides = {};
  const meshNode = (name, key, geometry, opts = {}) => {
    cx.mesh(key, geometry);
    return nodeOf(name, { ...opts, c: [cx.comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), cx.comp({ type: 'MeshRenderer', m_Enabled: true, materials: geometry.slots.map((s) => ({ ...s })) })] });
  };
  /** A sail's node, its bones and its skinned canvas: `poses` { stowed, left, center, right } (each the grid), its
   *  controller the base it overrides. */
  const sailNode = (sailName, poses, grid, base, sailKey) => {
    const bonesName = `${sailKey}SailBones`, meshName = `${sailKey}SailMesh`;
    const rest = poses.center;
    const bones = rest.map((p, k) => nodeOf(`B${k}`, { p }));
    const bonesNode = nodeOf(bonesName, { kids: bones });
    const geometry = canvasGeometry(rest, grid);
    const key = `${ship}:sail:${sailKey}`;
    cx.mesh(key, geometry);
    const texChild = nodeOf(`${cx.archive}_${TEX.canvas}`);   // ApplyGameTextures' slot 0: the canvas
    const meshNode = nodeOf(meshName, { c: [cx.comp(bakeCadence({ timer: timerOf(sailKey) }))], kids: [texChild] });   // AUDIT GN2-RG9
    cx.skinned(meshNode, key, bones, bonesNode, [{ material: `${ship}-canvas` }]);
    const clipName = (pose) => `${clipPrefix}/${sailKey} ${pose}`;
    const curvesOf = (grid2) => grid2.map((p, k) => posCurve(`${bonesName}/B${k}`, p));
    const ovName = `${clipPrefix}/${sailKey}`;
    if (base === 'Staysail Controller') {
      clips[clipName('Stowed')] = constClip(clipName('Stowed'), curvesOf(poses.stowed), SAIL_CLIP_S, false);
      for (const [slot, g] of [['Left', poses.left], ['Center Left', poses.centerLeft], ['Center', poses.center], ['Center Right', poses.centerRight], ['Right', poses.right]]) {
        clips[clipName(slot)] = constClip(clipName(slot), curvesOf(g), SAIL_CLIP_S, false);
      }
      overrides[ovName] = { base, clips: [['Sail Stowed', clipName('Stowed')], ['Staysail Unstowed Left', clipName('Left')], ['Staysail Unstowed Center Left', clipName('Center Left')], ['Staysail Unstowed Center', clipName('Center')], ['Staysail Unstowed Center Right', clipName('Center Right')], ['Staysail Unstowed Right', clipName('Right')]] };
    } else {
      for (const [slot, g] of [['Stowed', poses.stowed], ['Left', poses.left], ['Center', poses.center], ['Right', poses.right]]) clips[clipName(slot)] = constClip(clipName(slot), curvesOf(g), SAIL_CLIP_S, false);
      overrides[ovName] = { base, clips: [['Sail Stowed', clipName('Stowed')], ['Sail Unstowed Left', clipName('Left')], ['Sail Unstowed Center', clipName('Center')], ['Sail Unstowed Right', clipName('Right')]] };
    }
    const sail = nodeOf(sailName, { c: [cx.comp({ type: 'Animator', m_Enabled: true, m_Controller: { controller: ovName }, m_ApplyRootMotion: false })], kids: [bonesNode, meshNode] });
    return { sail, bones, bonesNode };
  };
  /** A running rope: a two-bone skinned line between two nodes' points (`a` on node A, `b` on node B, each a bone
   *  placed at its node's local point), its mesh in the frame of the node it hangs under (`at`, where that node's frame
   *  stands in hers at rest - AUDIT GN2-RG2: a sheet's, its sail's), baked every frame (AUDIT GN2-RG1). */
  const running = (name, a, b, at = [0, 0, 0]) => {
    const meshName = `${name}Line`;
    const key = `${ship}:rope:${name}`;
    const geometry = ropeGeometry(sub(a.world, at), sub(b.world, at), 0.028);
    cx.mesh(key, geometry);
    const meshNode = nodeOf(meshName, { c: [cx.comp(bakeCadence({ ...BAKE.rope }))], kids: [nodeOf(`${cx.archive}_${TEX.rope}`)] });
    cx.skinned(meshNode, key, [a.bone, b.bone], null, [{ material: `${ship}-rope` }], true);
    return meshNode;
  };
  return { clips, overrides, meshNode, sailNode, running };
}

/**
 * The rig: its nodes (to hang under the hull's node), the meshes they name, and its clips and overrides.
 * `cx` is the prefab builder's (world/galleonModel.js): `mesh(key, geometry)` registers a mesh, `comp(record)` a
 * component and answers its index, `skinned(node, key, bones, root)` asks for a SkinnedMeshRenderer whose bone pointers
 * are filled in once the tree's paths are known.
 */
export function buildRig(cx) {
  const kids = [];
  const mastOf = (m) => (m === 'fore' ? { z: RIG.foreZ, r: RIG.foreR } : { z: RIG.mainZ, r: RIG.mainR });
  const { clips, overrides, meshNode, sailNode, running } = rigBench(cx, { ship: 'galleon', clipPrefix: 'galleon2', timerOf: (sailKey) => BAKE.canvasTimer(SAILS.findIndex((x) => x.key === sailKey)) });

  // the yards and their square sails
  const squareSails = {};
  for (const s of SAILS.filter((x) => x.kind === 'square')) {
    const m = mastOf(s.mast);
    const d = yardOffset(s);
    const boomName = `${s.key}SquareBoom`;
    const poses = {
      stowed: squareSailPose(s, d, m.r, 'stowed'), left: squareSailPose(s, d, m.r, 'aback'),
      center: squareSailPose(s, d, m.r, 'center'), right: squareSailPose(s, d, m.r, 'full'),
    };
    const { sail, bones } = sailNode(`${s.key}Square${s.size}Sail`, poses, GRID.square, 'Sail Controller', s.key);
    const yard = meshNode(`${s.key}Yard`, `galleon:yard:${s.key}`, yardGeometry(s.yardSpan, d, liftHead(s)));
    // the yard's arms, as bones for its braces (under the boom, so they turn with it)
    const armP = nodeOf(`${s.key}YardArmPort`, { p: [-(s.yardSpan / 2 - 0.2), 0, d] });
    const armS = nodeOf(`${s.key}YardArmStarboard`, { p: [s.yardSpan / 2 - 0.2, 0, d] });
    const boom = nodeOf(boomName, { p: [0, s.yardY, m.z], kids: [sail, yard, armP, armS] });   // the sail FIRST: the auto-trim reads the boom's first child
    kids.push(boom);
    squareSails[s.key] = { s, boom, sail, bones, armP, armS, d };
  }
  // the gaff mainsail on its boom
  const g = SAILS.find((x) => x.kind === 'gaff');
  const mm = mastOf(g.mast);
  const gPoses = { stowed: gaffSailPose(g, mm.r, 'stowed'), left: gaffSailPose(g, mm.r, 'port'), center: gaffSailPose(g, mm.r, 'center'), right: gaffSailPose(g, mm.r, 'starboard') };
  const gSail = sailNode(`${g.key}${g.size}Sail`, gPoses, GRID.gaff, 'Sail Controller', g.key);
  const gSpars = meshNode(`${g.key}Spars`, 'galleon:gaff', gaffSparsGeometry(g, mm.r));
  const gEnd = nodeOf(`${g.key}SheetBlock`, { p: [0, 0.18, -g.boomLen + 0.3] });
  const gBoom = nodeOf(`${g.key}Boom`, { p: [0, g.boomY, mm.z], kids: [gSail.sail, gSpars, gEnd] });   // 'Gaff' and 'Boom' in its name: the auto-trim's gaff arm turns it
  kids.push(gBoom);
  // the jib on the forestay (in her own frame: no boom turns it)
  const jPoses = { stowed: jibPose('stowed'), left: jibPose('port'), centerLeft: jibPose('port', 0.5), center: jibPose('center'), centerRight: jibPose('starboard', 0.5), right: jibPose('starboard') };
  const jib = sailNode('JibStayLargeSail', jPoses, GRID.stay, 'Staysail Controller', 'Jib');
  kids.push(jib.sail);

  // the standing rigging
  const standing = standingRiggingGeometry();
  for (const [name, key] of [['MainShrouds', 'mainShrouds'], ['ForeShrouds', 'foreShrouds'], ['Stays', 'stays'], ['Backstays', 'backstays'], ['Flagstaff', 'flagstaff']]) {
    kids.push(meshNode(name, `galleon:rigging:${key}`, standing[key]));
  }

  // the running rope: a deck bone for each rope's foot, every one in her frame
  const deckBone = (name, p) => { const n = nodeOf(name, { p }); kids.push(n); return { bone: n, world: p }; };
  const local = (boomNode, child) => add(boomNode.position, child.position);
  const sided = (p, s) => [s * p[0], p[1], p[2]];
  for (const { s, boom, armP, armS } of Object.values(squareSails)) {
    const belay = s.mast === 'fore' ? BELAYS.foreBrace : BELAYS.mainBrace;
    for (const [arm, side] of [[armP, -1], [armS, 1]]) {
      const foot = deckBone(`${s.key}BraceBelay${side > 0 ? 'Starboard' : 'Port'}`, sided(belay, side));
      kids.push(running(`${s.key}Brace${side > 0 ? 'Starboard' : 'Port'}`, { bone: arm, world: local(boom, arm) }, foot));
    }
  }
  // the fore course's sheets, from its two clews (its foot's corner bones) aft to her bulwark - AUDIT GN2-RG2: each under
  // the course itself (its node at its boom's own place), so a course struck from sight takes them with it (under her
  // hull they were drawn ending 4.4 m under its yard, in the air)
  {
    const { boom, sail, bones } = squareSails.ForeCourse;
    const [NU, NV] = GRID.square;
    for (const [k, side] of [[(NV - 1) * NU, -1], [NV * NU - 1, 1]]) {
      const foot = deckBone(`ForeCourseSheetBelay${side > 0 ? 'Starboard' : 'Port'}`, sided(BELAYS.courseSheet, side));
      sail.children.push(running(`ForeCourseSheet${side > 0 ? 'Starboard' : 'Port'}`, { bone: bones[k], world: add(boom.position, bones[k].position) }, foot, boom.position));
    }
  }
  // the gaff's mainsheet, from its boom's end down to her main deck at the castle's foot
  kids.push(running('MainGaffSheet', { bone: gEnd, world: local(gBoom, gEnd) }, deckBone('MainGaffSheetBelay', [...BELAYS.mainSheet])));
  // the jib's sheets, from its clew (its foot's after corner: the last row's last bone) to her bulwark either side -
  // AUDIT GN2-RG2: under the jib (its node in her own frame), so a jib struck from sight takes them with it
  {
    const [NU, NV] = GRID.stay;
    const clewBone = jib.bones[NV * NU - 1];
    for (const side of [-1, 1]) jib.sail.children.push(running(`JibSheet${side > 0 ? 'Starboard' : 'Port'}`, { bone: clewBone, world: clewBone.position }, deckBone(`JibSheetBelay${side > 0 ? 'Starboard' : 'Port'}`, sided(BELAYS.jibSheet, side))));
  }
  return { kids, clips, overrides };
}

export { len, norm };
