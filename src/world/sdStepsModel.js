// @ts-check
// SD7b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE UNMOORED STEPS, MADE -
// the meshes the course's steps are and the triangles they stand in the collider as, and the checkpoints B and C. Pure:
// the scene (scenes/sdSteps.js) uploads them, stands each step where the law (world/sdSteps.js) puts it, and moves it.
//
//   A STEP is a box in its OWN frame - its top's centre the origin, the dungeon's axes (the realm's frame is the dungeon's
//     moved, never turned) - so one mesh serves every step of a kind, each drawn and each collider bucket moved by a
//     translation alone. Its top, its four sides and its underside are all in the collider: a body that jumps short meets
//     a side and slides down it, and a riser's face is a wall for the run up it.
//       the Drift's - the Hour's floor (dark stone set in brass) on brass sides
//       the Beat's  - a brass plate alight on glowing brass sides: there on the Hour's beat
//       a riser     - the Hour's floor on brass, reaching from its top past the step it rises from (SD_RISER_H and the
//                     step's own thickness): the wall run up
//       the Crumble's - cracked stone, the void's light in its cracks, on the islands' dark stone
//   THE CHECKPOINTS B and C - islands as the first step is (A, world/sdHall.js), at their heights.
//   THE BREATH'S STREAKS (AUDIT SD II) - brass light blowing across the Crumble, the Warp's breath seen (buildBreathModel).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { realmToDungeon } from '../net/sdBrain.js';
import { faces } from './gateModel.js';
import { realmIsland, packRealmFaces, SD_REALM_FLOOR_RECORD, SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD, SD_ISLAND_SIDES } from './sdRealm.js';
import { SD_HALL_GLOW_RECORD } from './sdHallArt.js';
import { SD_STEPS_CRACKED_RECORD, SD_STEPS_BEAT_RECORD } from './sdStepsArt.js';
import { SD_STEP_THICK, SD_DRIFT_SIZE, SD_BEAT_SIZE, SD_CRUMBLE_SIZE, SD_RISER_H, SD_CHECKPOINTS, SD_COURSE_END } from './sdSteps.js';

/** The kinds of step, in the order their meshes are made. */
export const SD_STEP_KINDS = Object.freeze(['drift', 'beat', 'riser', 'crumble']);
/** A step's box, its own frame: across (x), along (z), and how far below its top it reaches. */
export function stepBox(kind) {
  const size = kind === 'drift' ? SD_DRIFT_SIZE : kind === 'crumble' ? SD_CRUMBLE_SIZE : SD_BEAT_SIZE;
  return { w: size.w, d: size.d, h: kind === 'riser' ? SD_RISER_H + SD_STEP_THICK : SD_STEP_THICK };
}
/** What each kind wears: its top, its sides, its underside. */
export const SD_STEP_WEAR = Object.freeze({
  drift: Object.freeze({ top: SD_REALM_FLOOR_RECORD, side: SD_REALM_BRASS_RECORD, under: SD_REALM_ROOT_RECORD }),
  beat: Object.freeze({ top: SD_STEPS_BEAT_RECORD, side: SD_HALL_GLOW_RECORD.brass, under: SD_REALM_BRASS_RECORD }),
  riser: Object.freeze({ top: SD_REALM_FLOOR_RECORD, side: SD_REALM_BRASS_RECORD, under: SD_REALM_ROOT_RECORD }),
  crumble: Object.freeze({ top: SD_STEPS_CRACKED_RECORD, side: SD_REALM_ROOT_RECORD, under: SD_REALM_ROOT_RECORD }),
});

/** The box's eight corners, its own frame: 0-3 its top (x-z-, x+z-, x+z+, x-z+), 4-7 under them. */
function corners({ w, d, h }) {
  const x = w / 2, z = d / 2;
  return [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, -h, -z], [x, -h, -z], [x, -h, z], [-x, -h, z]];
}
/** The box's faces by its corners, each wound to face out ((b - a) x (c - a) outward, world/gateModel.js faces' own):
 *  the top, the underside, and the sides facing -z (the way in), +x, +z, -x. */
const TOP = [0, 3, 2, 1], UNDER = [4, 5, 6, 7];
const SIDES = Object.freeze([[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);

/** ONE STEP of `kind`, a mesh in its own frame (renderer.createMesh's model shape, sub-meshes by record). */
export function buildStepModel(kind) {
  const f = faces(), box = stepBox(kind), c = corners(box), wear = SD_STEP_WEAR[kind];
  f.quad(wear.top, c[TOP[0]], c[TOP[1]], c[TOP[2]], c[TOP[3]], [0, 0], [0, 1], [1, 1], [1, 0]);
  f.quad(wear.under, c[UNDER[0]], c[UNDER[1]], c[UNDER[2]], c[UNDER[3]], [0, 0], [1, 0], [1, 1], [0, 1]);
  const tall = box.h / box.w;
  for (const [a, b, e, g] of SIDES) f.quad(wear.side, c[a], c[b], c[e], c[g], [0, tall], [1, tall], [1, 0], [0, 0]);
  return packRealmFaces(f);
}
/** ONE STEP's triangles for the collider, its own frame: `{ positions, indices }` - the top, the sides, the underside. */
export function stepTris(kind) {
  const c = corners(stepBox(kind));
  const positions = new Float32Array(c.flat()), indices = [];
  for (const [a, b, e, g] of [TOP, UNDER, ...SIDES]) indices.push(a, b, e, a, e, g);
  return { positions, indices };
}

/** THE CHECKPOINTS B and C, one mesh in the dungeon's frame: islands at their heights. */
export function buildChecksModel() {
  const f = faces();
  for (const [k, c] of SD_CHECKPOINTS.entries()) if (k > 0) realmIsland(f, c.x, c.z, c.r, SD_REALM_FLOOR_RECORD, { y: c.y, lean: k === 1 ? 1 : -1.5 });
  return packRealmFaces(f);
}
/** Their floors, for the collider (the dungeon's frame): a disc each, at its height. */
export function checkFloorTris() {
  const out = [];
  for (const [k, { x: cx, y, z: cz, r }] of SD_CHECKPOINTS.entries()) {
    if (k === 0) continue;   // A is the first step, the hall's (world/sdHall.js hallFloorTris)
    for (let j = 0; j < SD_ISLAND_SIDES; j++) {
      const a0 = (j / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((j + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
      out.push(...realmToDungeon(cx, y, cz), ...realmToDungeon(cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r), ...realmToDungeon(cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r));
    }
  }
  return new Float32Array(out);
}

/** AUDIT SD II (L2 F18): THE BREATH'S STREAKS - how many, how far either side of the course's line they lie, how far the
 *  breath carries them over its two seconds (scenes/sdSteps.js), and each one's length and its head's thickness. */
export const SD_BREATH = Object.freeze({ n: 64, halfX: 10, sweep: 10, len: 1.4, thick: 0.04 });
/**
 * THE WARP'S BREATH SEEN: SD_BREATH.n streaks of brass light (the hands' glow, as the Beat's sides wear it) over the
 * Crumble - from C's far edge to the course's end, each at the course's height there or a little over it - one mesh in
 * the REALM's frame (x 0 the course's line; the draw's matrix stands it at SD_REALM_ORIGIN, moves it across, and turns it
 * by x's sign the way the breath blows). Each a streak tapering from its head (toward +x) to its tail, upright and lying flat, every face both ways - a
 * player sees it from the side, from above, and as the mirror turns it. The same streaks every boot.
 */
export function buildBreathModel() {
  const f = faces(), C = SD_CHECKPOINTS[2], z0 = C.z + C.r, z1 = SD_COURSE_END;
  let seed = 0x5db7;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rec = SD_HALL_GLOW_RECORD.brass, UV = [[0, 0], [0, 1], [1, 1], [1, 0]];
  const both = (a, b, c, d) => { f.quad(rec, a, b, c, d, ...UV); f.quad(rec, d, c, b, a, ...UV); };
  for (let k = 0; k < SD_BREATH.n; k++) {
    const x = (rnd() * 2 - 1) * SD_BREATH.halfX, z = z0 + rnd() * (z1 - z0);
    const y = C.y * (1 - (z - z0) / (z1 - z0)) - 0.4 + rnd() * 2.6;   // about the course's height there
    const half = (SD_BREATH.len * (0.6 + 0.4 * rnd())) / 2, t = SD_BREATH.thick, tail = t * 0.2;
    both([x - half, y - tail, z], [x - half, y + tail, z], [x + half, y + t, z], [x + half, y - t, z]);   // upright
    both([x - half, y, z + tail], [x - half, y, z - tail], [x + half, y, z - t], [x + half, y, z + t]);   // lying flat
  }
  return packRealmFaces(f);
}
