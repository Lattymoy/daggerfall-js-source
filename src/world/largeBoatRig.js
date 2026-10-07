// @ts-check
// SHIPS-2 (2026-10-07, Mac: "ensure it matches the love we gave the other new ship model we implemented"): THE NEW LARGE
// BOAT'S RIG - her seven sail plans over Mac's one mast and his bowsprit, in the boat's frame (world/largeBoatModel.js
// says where every measurement comes from).
//
// SHE CARRIES THE MOD'S LARGE BOAT'S SEVEN PLANS, EACH AS THE MOD DREW IT: under `Variants`, each plan a node the walk
// switches on for the boat's own variant (systems/comeSailAwayBoat.js GetBoatTransforms - a save's variant 6 needs a
// seventh child, or the walk throws), the player cycling them at her VariantTrigger. Each plan's sails are the mod's own
// by name - their kind and size what Come Sail Away reads off the name (GetSailPower's sums, the trim's arms) - and in
// the mod's order (the walk's Booms and Sails, the first square sail ToggleSquareSails reads), so every plan sails as
// the mod's boat sailed it:
//   0  a large lateen                                        (on her mast)
//   1  a small gaff sail and a small staysail                (on her mast)
//   2  a small gaff sail, a large square sail, a small staysail
//   3  a small square topsail and a large lateen             (on her mast and a topmast over it)
//   4  a large staysail, and a small gaff sail with a small gaff topsail over it on its one boom
//   5  a large gaff sail, a small square topsail, a small staysail
//   6  a large square sail and a small square topsail
// Each sail is the galleon's kind of sail (world/galleonRig.js: its bench, `rigBench`, every ship's - her square sails
// squareSailPose's, her gaffs gaffSailPose's, her staysails staysailPose's, her lateens lateenSailPose's), her lighter
// spars on a boat's scale; the four larger plans set their upper canvas on a TOPMAST over Mac's masthead, as the mod's
// own large plans stood on its taller mast.
//
// HER TRIM IS THE MOD'S: her lateens and gaffs swing to 90 either way, her square yards to 45 (to 30 in plan 2, a large
// square sail with a gaff - HasLargeSquareSailWithGaff). So she carries NO SHROUDS - a lateen's or a gaff's boom swung
// square crosses every line from her masthead to her gunwale - and is stayed fore and aft: a forestay from her masthead
// and a topmast stay from the topmast's head to her bowsprit's end, a bobstay under it to her stem. Her running rope is
// the large square sail's braces, aft to her stern rail's cap at her quarters, and the staysails' sheets to her gunwale;
// a gaff's and a lateen's boom swings over her helm, and no sheet is led from them to her deck (they would cross her
// helmsman's step and her tiller - test/ships2_largeboat.test.js sweeps every plan).
//
// Not a DFU member. Ledger A (SHIPS-2).
import { MeshBench, prism, rope, add, sub, scl, len, norm, lerp3 } from './galleonMesh.js';
import { LARGE_BOAT_ARCHIVE, TEX, LARGE_BOAT_TILE } from './largeBoatArt.js';
import { nodeOf, clone, findNode, inArchive } from './shipKit.js';
import {
  rigBench, squareSailPose, gaffSailPose, staysailPose, lateenSailPose, lateenSparsGeometry, lateenBoomY, yardGeometry, GRID,
} from './galleonRig.js';
import { FIX_DEFORMATIONS_INTERVAL } from './skinnedBake.js';

/** How many sail plans the mod's large boat carries (its `Variants`' children). */
export const VARIANT_COUNT = 7;

/**
 * Where her rig stands (the boat's frame, metres), measured off the bake (src/assets/ships/largeBoat.json: her mast, her
 * bowsprit, her stem) and pinned there: her mast's axis (1.7 cm to port of her centreline, as Mac drew it), its foot and
 * head and its corners' reach from its axis at each (an irregular pentagon - the farthest corner); the topmast the four
 * larger plans set over it; her bowsprit's end (its top, where the topmast stay comes down), its top's rise per metre
 * forward (the forestay's foot is set up on it short of the end) and its underside; her stem where the bobstay is set up.
 */
export const LARGE_BOAT_RIG = Object.freeze({
  mast: Object.freeze({ x: -0.0171, z: -0.5993, footY: 0.8116, topY: 6.3471, footR: 0.2611, headR: 0.167 }),
  topmast: Object.freeze({ footY: 5.4, topY: 9.45, footR: 0.12, headR: 0.07 }),
  bowspritEnd: Object.freeze([-0.0167, 2.7698, 7.5382]), bowspritTopRise: 0.2842,
  bowspritUnder: Object.freeze([Object.freeze([-0.0175, 1.9657, 5.5743]), Object.freeze([-0.0171, 2.4535, 7.5833])]),
  stem: Object.freeze([0, 0.6, 5.225]),
  gunwaleY: 2.2488, sternCapY: 2.5939,
});
const R = LARGE_BOAT_RIG;
/** Her mast's (and above its head the topmast's) corners' reach from its axis at height `y`. */
export function mastRadius(y) {
  const m = R.mast, t = R.topmast;
  if (y > m.topY) return t.footR + (t.headR - t.footR) * (y - t.footY) / (t.topY - t.footY);
  return m.footR + (m.headR - m.footR) * (y - m.footY) / (m.topY - m.footY);
}
/** Her mast as world/galleonRig.js's lateen reads one: its axis, its head (the lateen's halyard's), its taper. */
export const MAST = Object.freeze({ z: R.mast.z, top: R.mast.topY, radius: mastRadius });

/** A sail's own numbers by its kind (world/galleonRig.js's poses read them): her lateens', gaffs', square sails' and
 *  staysails' - `key` the plan's own for a sail (its meshes and clips), `name` the mod's (its node's), `boom` its boom's. */
const lateen = Object.freeze({ kind: 'lateen', fore: Object.freeze([0, 2.75, 4.5]), aft: Object.freeze([0, 7.3, -5.3]), side: 0.33, footY: 2.72, clewY: 3.75, clewZ: -5.0,
  yardR: Object.freeze([0.095, 0.045]), throat: 0.6, peakIn: 0.25, belly: 0.75, pin: 1.0 });
const smallGaff = (throatY, peakY) => Object.freeze({ kind: 'gaff', boomY: 3.75, throatY, peak: Object.freeze([peakY - 3.75, -3.5]), clewZ: -3.6, boomLen: 3.9 });
const largeGaff = Object.freeze({ kind: 'gaff', boomY: 3.75, throatY: 6.55, peak: Object.freeze([7.7 - 3.75, -4.2]), clewZ: -4.4, boomLen: 4.6 });
const largeSquare = Object.freeze({ kind: 'square', yardY: 5.75, drop: 2.35, headW: 6.0, footW: 6.6, yardSpan: 6.6, belly: 0.12, aback: 0.12, yardR: Object.freeze([0.1, 0.05]) });
const smallSquare = Object.freeze({ kind: 'square', yardY: 8.8, drop: 1.5, headW: 3.1, footW: 3.5, yardSpan: 3.5, belly: 0.08, aback: 0.08, yardR: Object.freeze([0.07, 0.04]) });
const smallStay = Object.freeze({ kind: 'stay', stay: 'fore', headDown: 1.4, tackUp: 0.6, clew: Object.freeze([0, 2.75, 2.7]), belly: 0.55 });
const largeStay = Object.freeze({ kind: 'stay', stay: 'top', headDown: 1.1, tackUp: 0.35, clew: Object.freeze([0, 2.75, 1.4]), belly: 0.75 });

/**
 * The seven plans, in the mod's order, each its sails in the mod's order (`boom` and `name` the mod's nodes'; two sails
 * of one boom share it, the first its first child as the mod's) and whether it stands on the topmast (`top`).
 */
export const PLANS = Object.freeze([
  Object.freeze({ top: false, sails: Object.freeze([{ ...lateen, boom: 'SkiffLateenBoom', name: 'SkiffLargeLateenSail' }]) }),
  Object.freeze({ top: false, sails: Object.freeze([{ ...smallGaff(5.75, 6.1), boom: 'SkiffSmallGaffBoom', name: 'SkiffSmallGaffSail2' }, { ...smallStay, name: 'SkiffSmallStaySail' }]) }),
  Object.freeze({ top: false, sails: Object.freeze([{ ...smallGaff(5.15, 5.5), boom: 'SkiffSmallGaffBoom', name: 'SkiffSmallGaffSail2' }, { ...largeSquare, boom: 'SkiffLargeSquareBoom', name: 'SkiffLargeSquareSail' }, { ...smallStay, name: 'SkiffSmallStaySail' }]) }),
  Object.freeze({ top: true, sails: Object.freeze([{ ...smallSquare, boom: 'SkiffSmallSquareBoom', name: 'SkiffSmallSquareSail' }, { ...lateen, boom: 'SkiffLateenBoom', name: 'SkiffLargeLateenSail' }]) }),
  Object.freeze({ top: true, sails: Object.freeze([{ ...largeStay, name: 'SkiffLargeStaySail (1)' }, { kind: 'gaffTopsail', boom: 'SkiffSmallGaffBoom (1)', name: 'SkiffSmallGaffSail1', under: smallGaff(5.75, 6.1), headY: 8.7 }, { ...smallGaff(5.75, 6.1), boom: 'SkiffSmallGaffBoom (1)', name: 'SkiffSmallGaffSail2' }]) }),
  Object.freeze({ top: true, sails: Object.freeze([{ ...largeGaff, boom: 'SkiffLargeGaffBoom', name: 'SkiffLargeGaffSail' }, { ...smallSquare, boom: 'SkiffSmallSquareBoom', name: 'SkiffSmallSquareSail' }, { ...smallStay, name: 'SkiffSmallStaySail' }]) }),
  Object.freeze({ top: true, sails: Object.freeze([{ ...largeSquare, boom: 'SkiffLargeSquareBoom', name: 'SkiffLargeSquareSail' }, { ...smallSquare, boom: 'SkiffSmallSquareBoom', name: 'SkiffSmallSquareSail' }]) }),
]);
/** The plans' sail counts' most (a canvas's bake timer: the k-th sail of a plan k fifths... of the mod's tenth). */
const MOST_SAILS = Math.max(...PLANS.map((p) => p.sails.length));
/** Her skinned renderers' bakes (world/galleonRig.js BAKE's law): her running rope every frame, each canvas from its
 *  own timer - its place in its plan. */
export const BAKE = Object.freeze({ rope: Object.freeze({ everyFrame: true }), canvasTimer: (k) => Math.fround(k * FIX_DEFORMATIONS_INTERVAL / MOST_SAILS) });

// ── the stays ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Her stays: the forestay from her masthead's fore side to her bowsprit's top FORESTAY_IN short of its end, and the
 *  topmast stay from the topmast's head (the larger plans') to the end itself - so the steeper topmast stay comes down
 *  over the forestay's foot, the two never crossing; the bobstay from the bowsprit's underside near its end to her
 *  stem. */
export const FORESTAY_IN = 0.35;
export function stayLines() {
  const m = R.mast, end = R.bowspritEnd;
  const [u0, u1] = R.bowspritUnder;
  const under = lerp3(u0, u1, 0.82);
  return {
    fore: { head: [m.x, m.topY - 0.2, m.z + mastRadius(m.topY - 0.2)], foot: [end[0], end[1] - FORESTAY_IN * R.bowspritTopRise, end[2] - FORESTAY_IN], r: 0.022 },
    top: { head: [m.x, R.topmast.topY - 0.12, m.z + mastRadius(R.topmast.topY - 0.12)], foot: [...end], r: 0.02 },
    bob: { head: under, foot: [...R.stem], r: 0.02 },
  };
}
/** A staysail's corners on its stay (staysailPose's): its head `headDown` down the stay from its head, its tack
 *  `tackUp` up from its foot, its luff 4 cm under the stay; its clew its own. */
export function staysailCorners(sail) {
  const s = stayLines()[sail.stay];
  const along = norm(sub(s.foot, s.head)), L = len(sub(s.foot, s.head));
  const underIt = [0, -along[2], along[1]];
  const onLuff = (d) => add(add(s.head, scl(along, d)), scl(underIt, 0.04));
  return { tack: onLuff(L - sail.tackUp), clew: [...sail.clew], head: onLuff(sail.headDown) };
}

// ── the gaff topsail ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Plan 4's gaff topsail (the mod's SkiffSmallGaffSail1, on its gaff sail's boom - so the trim swings it with the gaff),
 * in that boom's frame: its foot along the gaff from the throat nearly to the peak, its luff up the topmast to `headY`, a
 * short head across the topmast's top - a jib-headed topsail. Row 0 its head; poses as the gaff sail's (galleonRig.js
 * gaffSailPose: 'port' / 'starboard' bellied, 'center', 'stowed' brailed in to the topmast).
 */
export function gaffTopsailPose(sail, pose) {
  const [NU, NV] = GRID.gaff;
  // its luff clear of her masthead's iron cap at its foot (the cap the topmast stands in), 8 cm off the topmast aloft;
  // its foot 12 cm over the gaff from throat to peak
  const g = sail.under, luffZ = -(mastRadius(sail.headY - 1) + 0.08), capR = R.mast.headR + 0.03;
  const throat = [0, g.throatY - g.boomY + 0.12, -(capR + 0.06)], peak = [0, g.peak[0] + 0.1, g.peak[1] + 0.35];
  const head1 = [0, sail.headY - g.boomY, luffZ], head2 = [0, sail.headY - g.boomY - 0.28, luffZ - 0.4];
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = 1 - j / (NV - 1);   // its head's row first
    const footAt = lerp3(throat, peak, u), headAt = lerp3(head1, head2, u);
    let p = lerp3(footAt, headAt, v);
    const arch = Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.1 + 0.85 * v)) * (1 - 0.6 * v);
    if (pose === 'port') p[0] -= 0.45 * arch;
    else if (pose === 'starboard') p[0] += 0.45 * arch;
    else if (pose === 'center') p[0] += 0.05 * arch;
    else if (pose === 'stowed') {
      const luff = lerp3(throat, head1, v);
      p = lerp3(luff, p, 0.08 + 0.04 * Math.sin(u * Math.PI * 3));
      p[0] += 0.06 * Math.sin(u * 7 + v * 3);
    }
    out.push(p);
  }
  return out;
}

// ── the spars ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A gaff sail's spars in its boom's frame (galleonRig.js gaffSparsGeometry's, on a boat's scale): the boom aft along
 *  its foot, the gaff up to its peak, their jaws about her mast, and the peak halyard up into the masthead (or the
 *  topmast's head, `headY`) on its axis - none where `headY` is null (plan 5: a square topsail braced round sweeps
 *  through any line from the topmast to the gaff's peak). */
export function gaffSparsGeometry(sail, headY) {
  const bench = new MeshBench(LARGE_BOAT_ARCHIVE);
  const mastR = mastRadius(sail.boomY), z0 = -(mastR + 0.03);
  prism(bench, TEX.spar, [0, 0.12, z0], [0, 0.12, -sail.boomLen], 0.075, 0.055, 8, { tileV: LARGE_BOAT_TILE.spar[1], smooth: true });
  const throat = [0, sail.throatY - sail.boomY, -(mastRadius(sail.throatY) + 0.03)], peak = [0, sail.peak[0], sail.peak[1]];
  prism(bench, TEX.spar, throat, peak, 0.06, 0.04, 8, { tileV: LARGE_BOAT_TILE.spar[1], smooth: true });
  for (const [y, r] of [[0.12, mastR], [throat[1], mastRadius(sail.throatY)]]) {
    const ring = [];
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push([Math.sin(a) * (r + 0.03), y, Math.cos(a) * (r + 0.03)]); }
    rope(bench, TEX.rope, ring, 0.022);
  }
  if (headY != null) rope(bench, TEX.rope, [peak, [0, headY - sail.boomY, 0]], 0.016);
  return bench.finish();
}
/** The topmast the four larger plans set over her masthead, in her frame: a pole from inside her masthead to its truck,
 *  an iron cap at the masthead holding it, the truck at its head. */
export function topmastGeometry() {
  const bench = new MeshBench(LARGE_BOAT_ARCHIVE);
  const m = R.mast, t = R.topmast;
  prism(bench, TEX.spar, [m.x, t.footY, m.z], [m.x, t.topY, m.z], t.footR, t.headR, 8, { smooth: true, tileV: LARGE_BOAT_TILE.spar[1] });
  prism(bench, TEX.iron, [m.x, m.topY - 0.06, m.z], [m.x, m.topY + 0.1, m.z], m.headR + 0.03, m.headR + 0.03, 8, { smooth: true });
  prism(bench, TEX.trim, [m.x, t.topY, m.z], [m.x, t.topY + 0.06, m.z], 0.1, 0.1, 8, { smooth: true });
  return bench.finish();
}
/** A plan's standing rope: its stays (the forestay, the topmast stay or both) and the bobstay. */
export function staysGeometry(which) {
  const bench = new MeshBench(LARGE_BOAT_ARCHIVE);
  const S = stayLines();
  for (const k of [...which, 'bob']) rope(bench, TEX.rope, [S[k].head, S[k].foot], S[k].r);
  return bench.finish();
}

/** The running rope's belays (her frame; the starboard one, the port its mirror): the large square sail's braces on her
 *  stern rail's cap at her quarter, the staysails' sheets on her gunwale's cap abreast of their clews. */
export const BELAYS = Object.freeze({
  squareBrace: Object.freeze([1.735, R.sternCapY, -3.6]),
  staySheet: Object.freeze([1.7, R.gunwaleY, 1.6]),
});

// ── the rig as nodes ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Her rig: the seven plans as `Variants`' children (each switched off - the walk switches the boat's own on), the
 * meshes they name, and their clips and overrides - on the galleon's bench (world/galleonRig.js rigBench), `cx` the
 * prefab's (world/largeBoatModel.js).
 */
export function buildLargeBoatRig(cx) {
  const variants = [];
  const timers = new Map();
  const { clips, overrides, meshNode, sailNode, running } = rigBench(cx, { ship: 'largeBoat', clipPrefix: 'largeboat2', timerOf: (key) => BAKE.canvasTimer(timers.get(key) ?? 0) });
  const own = (geometry) => inArchive(geometry, LARGE_BOAT_ARCHIVE);
  const m = R.mast;
  mesh('largeBoat:topmast', topmastGeometry(), cx);
  for (const [v, plan] of PLANS.entries()) {
    const kids = [];
    const booms = new Map();
    const boomOf = (name, y) => { if (!booms.has(name)) { const b = nodeOf(name, { p: [m.x, y, m.z] }); booms.set(name, b); kids.push(b); } return booms.get(name); };
    const headY = plan.top ? R.topmast.topY - 0.1 : m.topY - 0.12;
    plan.sails.forEach((s, k) => {
      const key = `V${v}${s.name.replace(/[^A-Za-z0-9]/g, '')}`;
      timers.set(key, k);
      if (s.kind === 'square') {
        const d = mastRadius(s.yardY) + 0.17;
        const poses = { stowed: squareSailPose(s, d, 0, 'stowed'), left: squareSailPose(s, d, 0, 'aback'), center: squareSailPose(s, d, 0, 'center'), right: squareSailPose(s, d, 0, 'full') };
        const { sail } = sailNode(s.name, poses, GRID.square, 'Sail Controller', key);
        const liftTo = [0, (s.yardY > m.topY ? R.topmast.topY - 0.1 : m.topY - 0.12) - s.yardY, 0];
        const yard = meshNode(`${key}Yard`, `largeBoat:yard:${key}`, own(yardGeometry(s.yardSpan, d, liftTo, { r: s.yardR, footropes: false })));
        const armP = nodeOf(`${key}YardArmPort`, { p: [-(s.yardSpan / 2 - 0.12), 0, d] }), armS = nodeOf(`${key}YardArmStarboard`, { p: [s.yardSpan / 2 - 0.12, 0, d] });
        const boom = boomOf(s.boom, s.yardY);
        boom.children.push(sail, yard, armP, armS);
        // the large square sail's braces, aft to her stern rail's cap at her quarters
        if (s.yardY < m.topY) {
          for (const [arm, side] of [[armP, -1], [armS, 1]]) {
            const name = `${key}Brace${side > 0 ? 'Starboard' : 'Port'}`;
            const p = [side * BELAYS.squareBrace[0], BELAYS.squareBrace[1], BELAYS.squareBrace[2]];
            const belay = nodeOf(`${name}Belay`, { p });
            kids.push(belay, running(name, { bone: arm, world: add(boom.position, arm.position) }, { bone: belay, world: p }));
          }
        }
      } else if (s.kind === 'gaff') {
        const mastR = mastRadius(s.boomY);
        const poses = { stowed: gaffSailPose(s, mastR, 'stowed'), left: gaffSailPose(s, mastR, 'port'), center: gaffSailPose(s, mastR, 'center'), right: gaffSailPose(s, mastR, 'starboard') };
        const { sail } = sailNode(s.name, poses, GRID.gaff, 'Sail Controller', key);
        const topsail = plan.sails.some((x) => x.kind === 'square' && x.yardY > m.topY);
        const spars = meshNode(`${key}Spars`, `largeBoat:gaff:${key}`, gaffSparsGeometry(s, topsail ? null : headY));
        boomOf(s.boom, s.boomY).children.push(sail, spars);
      } else if (s.kind === 'gaffTopsail') {
        const poses = { stowed: gaffTopsailPose(s, 'stowed'), left: gaffTopsailPose(s, 'port'), center: gaffTopsailPose(s, 'center'), right: gaffTopsailPose(s, 'starboard') };
        const { sail } = sailNode(s.name, poses, GRID.gaff, 'Sail Controller', key);
        boomOf(s.boom, s.under.boomY).children.push(sail);
      } else if (s.kind === 'lateen') {
        const poses = { stowed: lateenSailPose(s, MAST, 'stowed'), left: lateenSailPose(s, MAST, 'left'), center: lateenSailPose(s, MAST, 'center'), right: lateenSailPose(s, MAST, 'right') };
        const { sail } = sailNode(s.name, poses, GRID.lateen, 'Sail Controller', key);
        const spars = meshNode(`${key}Yard`, `largeBoat:lateen:${key}`, lateenSparsGeometry(s, MAST, LARGE_BOAT_ARCHIVE));
        boomOf(s.boom, lateenBoomY(s, MAST)).children.push(sail, spars);
      } else {
        // a staysail on its stay (in her frame: no boom turns it), its sheets to her gunwale abreast of its clew
        const c = staysailCorners(s);
        const pose = (p, k2 = 1) => staysailPose(c, p, k2, 0.985, s.belly);
        const poses = { stowed: pose('stowed'), left: pose('port'), centerLeft: pose('port', 0.5), center: pose('center'), centerRight: pose('starboard', 0.5), right: pose('starboard') };
        const st = sailNode(s.name, poses, GRID.stay, 'Staysail Controller', key);
        kids.push(st.sail);
        const [NU, NV] = GRID.stay;
        const clewBone = st.bones[NV * NU - 1];
        for (const side of [-1, 1]) {
          const name = `${key}Sheet${side > 0 ? 'Starboard' : 'Port'}`;
          const p = [side * BELAYS.staySheet[0], BELAYS.staySheet[1], BELAYS.staySheet[2]];
          const belay = nodeOf(`${name}Belay`, { p });
          st.sail.children.push(belay, running(name, { bone: clewBone, world: clewBone.position }, { bone: belay, world: p }));
        }
      }
    });
    // the plan's mast (the topmast over her masthead for the larger plans), its stays and its colours
    if (plan.top) kids.push(nodeOf(v === 4 ? 'SkiffLargeMast (1)' : 'SkiffLargeMast', { c: meshComps(cx, 'largeBoat:topmast') }));
    const which = plan.sails.some((s) => s.stay === 'top') ? ['top'] : plan.top ? ['fore', 'top'] : ['fore'];
    kids.push(meshNode(`V${v}Stays`, `largeBoat:stays:${v}`, staysGeometry(which)));
    kids.push(flagOf(cx, [m.x, (plan.top ? R.topmast.topY + 0.06 : m.topY) + 0.1, m.z]));
    variants.push(nodeOf(String(v), { active: false, kids }));
  }
  return { variants, kids: [], clips, overrides };
}

/** A mesh registered once by key on the prefab's bench. */
function mesh(key, geometry, cx) { if (!cx.meshes?.[key]) cx.mesh(key, geometry); return key; }
/** A drawn mesh's components (a MeshFilter and its renderer) over a mesh already registered. */
function meshComps(cx, key) {
  const g = cx.geometryOf(key);
  return [cx.comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), cx.comp({ type: 'MeshRenderer', m_Enabled: true, materials: g.slots.map((s) => ({ ...s })) })];
}
/** The mod's large boat's colours (its plans' FlagObject), stood at `p`. */
function flagOf(cx, p) {
  const f = clone(findNode(cx.modBoat, 'FlagObject'));
  if (!f) throw new Error('largeBoat: Come Sail Away\'s large boat has no FlagObject');
  f.position = [...p];
  return f;
}
