// @ts-check
// SHIPS-2 (2026-10-07, Mac: "ensure it matches the love we gave the other new ship model we implemented"): THE NEW
// CARRACK'S RIG - her yards, her five sails and her rope, over Mac's three masts and his bowsprit, in the boat's frame
// (world/carrackModel.js says where every measurement comes from).
//
// SHE IS RIGGED AS A CARRACK, AND AS COME SAIL AWAY'S CARRACK IS - its five sails, each where the mod's own stands and of
// its kind and size, so the sail power the mod sums (systems/comeSailAway.js GetSailPower) and every line of its trim,
// stowing and handling read her as they read hull 4:
//   - a SPRITSAIL under her bowsprit (the mod's CarrackSmallSquareSail: a Small square sail),
//   - a FORE COURSE on her fore mast (CarrackLargeSquareSail: Large, square),
//   - a MAIN COURSE (CarrackLargeSquareSail1: Large, square) and a MAIN TOPSAIL (CarrackMediumSquareSail: a square of
//     neither size) on her main mast,
//   - a LATEEN on her mizzen (CarrackMediumLateenSail1: a lateen of neither size).
// Each is a sail as the galleon's are (world/galleonRig.js's header, every law of it hers): a node named for its kind
// and size with an Animator on the mod's Sail Controller over her own clips, its yard a BOOM the trim turns about its
// mast (or, the spritsail's, about its slings under the bowsprit), the sail its boom's first child; skinned on a grid of
// bones (rigBench, world/galleonRig.js - the one bench every ship's rig is made on); every canvas baked on a frame of its
// own and her running rope every frame (BAKE).
//
// HER TRIM IS THE MOD'S CARRACK'S, AND IT IS WIDER THAN THE GALLEON'S: with no gaff the auto-trim braces her square yards
// to 45 degrees either way (HasLargeSquareSailWithGaff false: the galleon's stop at 30), and her lateen swings to 90.
// So her shrouds lead well aft of their masts (`CHANNELS`): a course braced sharp up swings its after half back toward
// them, and its canvas must pass every shroud at 45 (test/ships2_carrack.test.js sweeps it). And HER MIZZEN CARRIES NO
// SHROUD AND NO BACKSTAY: her lateen's yard and canvas sweep a ring round it from 12.4 m up, 9 m out aft and 5.3 m
// forward, at the 90 degrees the mod swings it - farther than her side stands from it - so any rope from the mizzen's
// head to her rail would be cut by it at some trim; she is stayed forward to the main mast (`stayLines`' mizzen stay,
// over her lateen's forward arm at every swing) and her lateen's halyard holds the yard to the masthead.
//
// THE ROPE: shrouds with their ratlines and deadeyes on channels outside her rail for the fore and main masts, the
// forestay to her bowsprit's end, the main stay to the fore mast, the mizzen stay to the main mast, the bobstay from the
// bowsprit to her stem - a still mesh each; each yard's lifts and footropes in its spar's mesh, the lateen's halyard and
// parrel in its own, so they swing with it; and the running rope that moves - every square yard's braces and the two
// courses' sheets - two-bone skinned ropes from a bone on the moving spar or the sail's clew to one on her rail, baked
// every frame. The braces of the main yards are belayed on her waist's rail forward of her entry port, under her
// lateen's sweep (a brace led aft past the mizzen would be cut by it).
//
// Not a DFU member. Ledger A (SHIPS-2).
import { MeshBench, prism, rope, box, add, scl, norm, lerp3 } from './galleonMesh.js';
import { CARRACK_ARCHIVE, TEX, CARRACK_TILE } from './carrackArt.js';
import { nodeOf, inArchive } from './shipKit.js';
import { rigBench, squareSailPose, yardGeometry, YARD_R, GRID, lateenBoomY, lateenSailPose, lateenSparsGeometry } from './galleonRig.js';
import { FIX_DEFORMATIONS_INTERVAL } from './skinnedBake.js';

/**
 * Where her rig stands (the boat's frame, metres), measured off the bake (src/assets/ships/carrack.json - roles
 * foreMast, mainMast, mizzenMast and bowsprit) and pinned there (test/ships2_carrack.test.js): each mast a regular
 * pentagonal prism, a corner forward and a flat face aft, its axis at x 0 and `masts.*.z`, its corners `footR` from it
 * at `footY` (its step) tapering to `headR` at its head (`masts.*.top`); the bowsprit a pentagon too, a corner up, its
 * axis from `bowsprit.heel` to `bowsprit.end` and its flat underside from `bowsprit.underHeel` to `bowsprit.underEnd`.
 * Her main deck `deckY`, her waist's rail's top `railY` (its cap from x 5.807 to 6.086).
 */
export const CARRACK_RIG = Object.freeze({
  masts: Object.freeze({
    fore: Object.freeze({ z: 17.2475, top: 16.7586 }),
    main: Object.freeze({ z: 8.9293, top: 20.0783 }),
    mizzen: Object.freeze({ z: -1.279, top: 20.0783 }),
  }),
  footY: 1.6016, footR: 0.8, headR: 0.5116,
  deckY: 7.8082, railY: 8.6343, railCap: Object.freeze([5.807, 6.086]),
  bowsprit: Object.freeze({
    heel: Object.freeze([0, 8.4136, 22.714]), end: Object.freeze([0, 10.818, 30.652]), heelR: 0.515, endR: 0.369,
    underHeel: Object.freeze([0, 8.028, 22.872]), underEnd: Object.freeze([0, 10.531, 30.731]),
  }),
  // her stem's leading edge, where the bobstay is set up (the bake's: 23.761 at y 2, 24.068 at 3)
  stem: Object.freeze([0, 2.2, 23.83]),
  // her colours over her main masthead
  flagY: 21.75,
});
const MASTS = CARRACK_RIG.masts;
/** A mast's corners' distance from its axis at height `y` (its taper, the bake's). */
function mastRadius(mast, y) {
  const R = CARRACK_RIG;
  return R.footR + (R.headR - R.footR) * (y - R.footY) / (MASTS[mast].top - R.footY);
}
/** A point on a mast's side face (`s` +1 starboard, -1 port) at height `y`: the face's middle (world/galleonRig.js
 *  mastSideFace's - the masts are the galleon's pentagon). */
function mastSideFace(mast, y, s) {
  const r = mastRadius(mast, y);
  return [s * 0.7694 * r, y, MASTS[mast].z - 0.25 * r];
}
/** A point on the bowsprit's underside `t` of the way from its heel to its end. */
export const bowspritUnder = (t) => lerp3(CARRACK_RIG.bowsprit.underHeel, CARRACK_RIG.bowsprit.underEnd, t);
/** The bowsprit's underside at station `z`. */
export function bowspritUnderAt(z) {
  const { underHeel: a, underEnd: b } = CARRACK_RIG.bowsprit;
  return bowspritUnder((z - a[2]) / (b[2] - a[2]));
}

/**
 * Her sails, in the order Come Sail Away's walk finds them (and her booms with them): the key her nodes are named by,
 * the kind and size the mod reads off the name, the mast (or the bowsprit) it hangs from. A square sail: its yard's
 * height `yardY`, its canvas's `drop` from it, its head's and foot's widths, its yard's `yardSpan`, its `belly` set
 * full (of its foot's width), and `aback` how far its middle presses back taken aback (galleonRig.js squareSailPose).
 * The spritsail hangs at `z` under the bowsprit, square under its slings (no mast before it). The lateen: its yard's
 * fore end `fore` and after end `aft` (her frame, the yard on the mast's port side `side` off its axis), its foot at
 * `footY` from its tack forward to its clew at `clewZ`.
 */
export const SAILS = Object.freeze([
  Object.freeze({ key: 'Spritsail', kind: 'square', size: 'Small', mast: 'bowsprit', z: 28.4, yardY: 9.35, drop: 3.0, headW: 6.0, footW: 7.0, yardSpan: 7.0, belly: 0.12, aback: 0.2 }),
  Object.freeze({ key: 'ForeCourse', kind: 'square', size: 'Large', mast: 'fore', yardY: 15.5, drop: 4.55, headW: 10.2, footW: 11.4, yardSpan: 11.4, belly: 0.15, aback: 0.18 }),
  Object.freeze({ key: 'MainCourse', kind: 'square', size: 'Large', mast: 'main', yardY: 15.2, drop: 3.75, headW: 10.4, footW: 11.2, yardSpan: 11.2, belly: 0.15, aback: 0.18 }),
  Object.freeze({ key: 'MainTopsail', kind: 'square', size: '', mast: 'main', yardY: 18.9, drop: 3.25, headW: 7.6, footW: 9.4, yardSpan: 8.8, belly: 0.075, aback: 0.12 }),
  Object.freeze({ key: 'Mizzen', kind: 'lateen', size: '', mast: 'mizzen', fore: Object.freeze([0, 12.55, 3.4]), aft: Object.freeze([0, 21.3, -10.3]), side: 0.85, footY: 12.4, clewZ: -9.6,
    yardR: Object.freeze([0.19, 0.08]), throat: 1.2, peakIn: 0.4, belly: 1.1, pin: 2.0 }),
]);
/** A sail's canvas grid (columns across, rows down): world/galleonRig.js's - a square sail's the galleon's, the
 *  lateen's along its foot. */
export { GRID };
/** A clip's length (s), the galleon's. */
const SAIL_CLIP_S = 1;
/** Her skinned renderers' bakes (world/galleonRig.js BAKE's law): her running rope every frame, each canvas on the
 *  mod's tenth of a second from its own timer - the k-th sail's k fifths of it. */
const BAKE = Object.freeze({ rope: Object.freeze({ everyFrame: true }), canvasTimer: (k) => Math.fround(k * FIX_DEFORMATIONS_INTERVAL / SAILS.length) });

/** How far before its mast's axis a square sail's yard hangs (its boom's frame z): the mast's radius at the yard and a
 *  yard's thickness with a hand's room - the spritsail's under its slings. */
const yardOffset = (sail) => (sail.mast === 'bowsprit' ? 0 : mastRadius(sail.mast, sail.yardY) + 0.24);
/** Where a square sail's boom pivots (her frame): its mast's axis at its yard's height - the spritsail's under the
 *  bowsprit at its slings. */
export const boomPivot = (sail) => [0, sail.yardY, sail.mast === 'bowsprit' ? sail.z : MASTS[sail.mast].z];
/** Where a yard's lifts are made fast, in its boom's frame: its masthead 0.12 m under its top on its axis (the main
 *  course's and the main topsail's both - the course's pass behind the topsail's canvas); the spritsail's into the
 *  bowsprit's underside over its slings. */
function liftHead(sail) {
  if (sail.mast === 'bowsprit') return [0, bowspritUnderAt(sail.z)[1] - sail.yardY, 0];
  return [0, MASTS[sail.mast].top - 0.12 - sail.yardY, 0];
}

// ── the lateen ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Her mizzen as world/galleonRig.js's lateen reads a mast: its axis, its head, its taper. */
export const MIZZEN = Object.freeze({ z: MASTS.mizzen.z, top: MASTS.mizzen.top, radius: (y) => mastRadius('mizzen', y) });

// ── the standing rope ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Her channels and the shrouds' feet on them (the fore and main masts'; the mizzen's lateen leaves it none - this
 * file's header). Each well aft of its mast, so a course braced to the auto-trim's 45 swings its after half past every
 * shroud of its side; each channel against her side - its inner face where her planking stands at its top edge (`inX`,
 * the bake's: her side's half-breadth at `topY` along the channel, its most) - its deadeyes on its top at its outer edge,
 * each deadeye's chainplate down through the channel's edge to her planking `chainDrop` under it (`plateX`, her side
 * there). The main channel is clear of her entry port (aft of it) and of every gunport's shutter swung up (they stand
 * under 4.2).
 */
const CHANNELS = Object.freeze({
  fore: Object.freeze({ feet: Object.freeze([10.75, 11.4, 12.05]), headY: 16.1, inX: 6.1075, plateX: Object.freeze([6.1698, 6.1744, 6.179]) }),
  main: Object.freeze({ feet: Object.freeze([1.2, 1.8, 2.4, 3.0]), headY: 19.3, inX: 6.0858, plateX: Object.freeze([6.1022, 6.1064, 6.1107, 6.1149]) }),
  topY: 8.4, thick: 0.14, width: 0.52, deadeyeR: 0.11, deadeyeH: 0.22, chainDrop: 0.42,
});
/** Where each shroud stands: its head on its mast's side face, its foot on the deadeye on its channel (the galleon's
 *  shroudLines' shape). */
function shroudLines() {
  const lines = [];
  const C = CHANNELS;
  for (const s of [-1, 1]) {
    for (const mast of /** @type {const} */ (['main', 'fore'])) {
      const xd = C[mast].inX + C.width - C.deadeyeR;
      for (const [k, z] of C[mast].feet.entries()) {
        const deadeye = [s * xd, C.topY, z];
        lines.push({ mast, side: s, head: mastSideFace(mast, C[mast].headY, s), foot: [s * xd, C.topY + C.deadeyeH, z], deadeye, plate: [s * C[mast].plateX[k], C.topY - C.thick - C.chainDrop, z] });
      }
    }
  }
  return lines;
}
/** The ratlines: a rung across each neighbouring pair of a mast's shrouds every 0.42 m, each end on its shroud's line. */
function ratlineLines() {
  const out = [];
  const lines = shroudLines();
  for (const mast of ['main', 'fore']) for (const s of [-1, 1]) {
    const set = lines.filter((l) => l.mast === mast && l.side === s);
    for (let k = 0; k + 1 < set.length; k++) {
      const a = set[k], b = set[k + 1];
      const at = (l, y) => lerp3(l.foot, l.head, (y - l.foot[1]) / (l.head[1] - l.foot[1]));
      for (let y = 9.05; y < Math.min(a.head[1], b.head[1]) - 1.6; y += 0.42) out.push({ mast, side: s, a: at(a, y), b: at(b, y) });
    }
  }
  return out;
}
/**
 * The stays: the forestay from the fore masthead's fore corner to the bowsprit's end (on its top); the main stay from the
 * main masthead's fore corner, over the main topsail's yard, to the fore mast's after face under the fore course's yard;
 * the mizzen stay from the mizzen's head to the main mast's after face under the main course's yard, high over her
 * lateen's forward arm at every swing; the bobstay from the bowsprit's underside, aft of the spritsail's slings, to her
 * stem.
 */
function stayLines() {
  const foreHead = 16.6, mainHead = 19.9, mainFoot = 13.4, mizzenHead = 19.9, mizzenFoot = 14.1;
  const B = CARRACK_RIG.bowsprit;
  const endTop = add(B.end, scl(norm([0, B.end[2] - B.heel[2], -(B.end[1] - B.heel[1])]), B.endR));   // its top corner
  return {
    forestay: { head: [0, foreHead, MASTS.fore.z + mastRadius('fore', foreHead)], foot: endTop, r: 0.045 },
    mainstay: { head: [0, mainHead, MASTS.main.z + mastRadius('main', mainHead)], foot: [0, mainFoot, MASTS.fore.z - 0.809 * mastRadius('fore', mainFoot)], r: 0.05 },
    mizzenstay: { head: [0, mizzenHead, MASTS.mizzen.z + mastRadius('mizzen', mizzenHead)], foot: [0, mizzenFoot, MASTS.main.z - 0.809 * mastRadius('main', mizzenFoot)], r: 0.04 },
    bobstay: { head: bowspritUnderAt(27.0), foot: [...CARRACK_RIG.stem], r: 0.04 },
  };
}

/** Her standing rigging, still in her frame, a mesh a piece (the galleon's AUDIT GN-R15): each mast's shrouds with their
 *  deadeyes, ratlines and channels, the stays and the bobstay, and the flagstaff over her main masthead. */
function standingRiggingGeometry() {
  const lines = shroudLines(), rungs = ratlineLines();
  const C = CHANNELS;
  const shrouds = (mast) => {
    const bench = new MeshBench(CARRACK_ARCHIVE);
    for (const l of lines.filter((q) => q.mast === mast)) {
      rope(bench, TEX.rope, [l.foot, l.head], 0.032);
      prism(bench, TEX.trim, l.deadeye, l.foot, C.deadeyeR, C.deadeyeR, 6, { smooth: true });
      prism(bench, TEX.iron, add(l.deadeye, [0, 0.05, 0]), l.plate, 0.03, 0.03, 4);
    }
    for (const r of rungs.filter((q) => q.mast === mast)) rope(bench, TEX.rope, [r.a, r.b], 0.014, { sides: 3 });
    const feet = C[mast].feet, z0 = Math.min(...feet) - 0.35, z1 = Math.max(...feet) + 0.35;
    for (const s of [-1, 1]) box(bench, TEX.trim, [s * (C[mast].inX + C.width / 2), C.topY - C.thick / 2, (z0 + z1) / 2], [C.width / 2, C.thick / 2, (z1 - z0) / 2], { tile: CARRACK_TILE.trim });
    return bench.finish();
  };
  const S = stayLines();
  const stays = new MeshBench(CARRACK_ARCHIVE);
  for (const k of ['forestay', 'mainstay', 'mizzenstay', 'bobstay']) rope(stays, TEX.rope, [S[k].head, S[k].foot], S[k].r);
  const flagstaff = new MeshBench(CARRACK_ARCHIVE);
  prism(flagstaff, TEX.spar, [0, MASTS.main.top - 0.05, MASTS.main.z], [0, CARRACK_RIG.flagY + 0.15, MASTS.main.z], 0.09, 0.05, 6, { smooth: true, tileV: 2 });
  return { mainShrouds: shrouds('main'), foreShrouds: shrouds('fore'), stays: stays.finish(), flagstaff: flagstaff.finish() };
}

/**
 * The running rope's belays (her frame; the starboard one, the port its mirror), every one on her rail's cap (the waist's
 * 8.6343, its cap from x 5.807 to 6.086) or her bow's: the fore course's braces aft to the waist abaft the fore channels,
 * its sheets forward of them; the main course's sheets forward of the main channels; the main yards' braces to the
 * waist forward of her entry port (under her lateen's sweep: test/ships2_carrack.test.js); the spritsail's to her bow's
 * rail where it narrows to her stem.
 */
const BELAYS = Object.freeze({
  spritBrace: Object.freeze([2.5, 9.29, 21.0]),
  foreBrace: Object.freeze([5.95, CARRACK_RIG.railY, 7.4]),
  foreSheet: Object.freeze([5.95, CARRACK_RIG.railY, 13.5]),
  mainBrace: Object.freeze([5.95, CARRACK_RIG.railY, -2.0]),
  mainTopBrace: Object.freeze([5.95, CARRACK_RIG.railY, -2.6]),
  mainSheet: Object.freeze([5.95, CARRACK_RIG.railY, 5.2]),
});

// ── the rig as nodes ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Her rig: its nodes (to hang under her hull's node), the meshes they name, and its clips and overrides - on the
 * galleon's bench (world/galleonRig.js rigBench), `cx` the prefab's (world/carrackModel.js).
 */
export function buildCarrackRig(cx) {
  const kids = [];
  const { clips, overrides, meshNode, sailNode, running } = rigBench(cx, { ship: 'carrack', clipPrefix: 'carrack2', timerOf: (key) => BAKE.canvasTimer(SAILS.findIndex((x) => x.key === key)) });
  const own = (geometry) => inArchive(geometry, CARRACK_ARCHIVE);   // the galleon's builders' geometry, worn in her archive

  // the yards and their square sails, each on its boom (the sail its first child: the auto-trim reads it)
  const squares = {};
  for (const s of SAILS.filter((x) => x.kind === 'square')) {
    const d = yardOffset(s), mastR = s.mast === 'bowsprit' ? 0 : mastRadius(s.mast, s.yardY);
    const poses = { stowed: squareSailPose(s, d, mastR, 'stowed'), left: squareSailPose(s, d, mastR, 'aback'), center: squareSailPose(s, d, mastR, 'center'), right: squareSailPose(s, d, mastR, 'full') };
    const { sail, bones } = sailNode(`${s.key}Square${s.size}Sail`, poses, GRID.square, 'Sail Controller', s.key);
    const yard = meshNode(`${s.key}Yard`, `carrack:yard:${s.key}`, own(yardGeometry(s.yardSpan, d, liftHead(s))));
    const armP = nodeOf(`${s.key}YardArmPort`, { p: [-(s.yardSpan / 2 - 0.2), 0, d] });
    const armS = nodeOf(`${s.key}YardArmStarboard`, { p: [s.yardSpan / 2 - 0.2, 0, d] });
    const boom = nodeOf(`${s.key}SquareBoom`, { p: boomPivot(s), kids: [sail, yard, armP, armS] });
    kids.push(boom);
    squares[s.key] = { s, boom, sail, bones, armP, armS };
  }
  // the lateen on her mizzen
  const l = SAILS.find((x) => x.kind === 'lateen');
  const lPoses = { stowed: lateenSailPose(l, MIZZEN, 'stowed'), left: lateenSailPose(l, MIZZEN, 'left'), center: lateenSailPose(l, MIZZEN, 'center'), right: lateenSailPose(l, MIZZEN, 'right') };
  const lSail = sailNode(`${l.key}Lateen${l.size}Sail`, lPoses, GRID.lateen, 'Sail Controller', l.key);
  const lSpars = meshNode(`${l.key}LateenYard`, 'carrack:lateen', lateenSparsGeometry(l, MIZZEN, CARRACK_ARCHIVE));
  kids.push(nodeOf(`${l.key}LateenBoom`, { p: [0, lateenBoomY(l, MIZZEN), MIZZEN.z], kids: [lSail.sail, lSpars] }));

  // the standing rigging
  const standing = standingRiggingGeometry();
  for (const [name, key] of [['MainShrouds', 'mainShrouds'], ['ForeShrouds', 'foreShrouds'], ['Stays', 'stays'], ['Flagstaff', 'flagstaff']]) kids.push(meshNode(name, `carrack:rigging:${key}`, standing[key]));

  // the running rope: a bone on her rail for each rope's foot
  const railBone = (name, p) => { const n = nodeOf(name, { p }); kids.push(n); return { bone: n, world: p }; };
  const local = (boom, child) => add(boom.position, child.position);
  const sided = (p, s) => [s * p[0], p[1], p[2]];
  const braceTo = { Spritsail: BELAYS.spritBrace, ForeCourse: BELAYS.foreBrace, MainCourse: BELAYS.mainBrace, MainTopsail: BELAYS.mainTopBrace };
  for (const { s, boom, armP, armS } of Object.values(squares)) {
    for (const [arm, side] of [[armP, -1], [armS, 1]]) {
      const name = `${s.key}Brace${side > 0 ? 'Starboard' : 'Port'}`;
      kids.push(running(name, { bone: arm, world: local(boom, arm) }, railBone(`${name}Belay`, sided(braceTo[s.key], side))));
    }
  }
  // the courses' sheets from their clews (each foot's corner bone) to her rail - under the sail itself, so a course struck
  // from sight takes them with it (the galleon's AUDIT GN2-RG2)
  const [NU, NV] = GRID.square;
  for (const [key, belay] of [['ForeCourse', BELAYS.foreSheet], ['MainCourse', BELAYS.mainSheet]]) {
    const { boom, sail, bones } = squares[key];
    for (const [k, side] of [[(NV - 1) * NU, -1], [NV * NU - 1, 1]]) {
      const name = `${key}Sheet${side > 0 ? 'Starboard' : 'Port'}`;
      sail.children.push(running(name, { bone: bones[k], world: add(boom.position, bones[k].position) }, railBone(`${name}Belay`, sided(belay, side)), boom.position));
    }
  }
  return { kids, clips, overrides };
}

export { YARD_R };
