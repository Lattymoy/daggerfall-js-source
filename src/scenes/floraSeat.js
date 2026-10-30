// FLORA-GROUND, THE RINGS (FIELD BUGS 2026-10-27, the owner: "Plus floating flora and reflective flora can be seen off
// the ground in first person", "No band aids or half assed work"; the coordinator: "Fix it at the root in the terrain's
// level of detail, so the coarse surface the player sees and the ground the plants stand on agree at every ring") - A
// BUILT PIXEL'S PLANTS DRAWN ON THE GROUND IT DRAWS (bible/03-World/World-Arc.md, Milestone 8 FLORA-GROUND).
//
// EV4 draws a pixel three or more out at stride 4 (scenes/world.js strideFor): 33 x 33 vertices, every fourth sample of
// the near grid's 129 x 129, one quad over sixteen. Every plant is PLACED on the ground the player walks
// (world/terrain/terrainSurface.js walkGroundAt) - where it must stand when the player comes to it - and no coarse quad
// can carry the relief under it: on the real data 18.8% of the Bay's plants stood more than 25 cm over the far ring's
// ground and 16.9% more than 25 cm in it, the worst 6.6 m in the air. Each coarse vertex the highest sample about it
// would have buried 92% of them a metre or more instead, and drawn every ridge fat. So the plant is DRAWN on the ground
// its pixel draws (terrainSurface.js drawnGroundAt: its stride, its bed - the very vertices and triangles its surface
// uploads), by what that ground stands over or under the walk ground at its root, and drawn on the walk ground again
// when the pixel comes near: one law at every ring, no ring's offset. Its PLACE stays the game's - its cover, its body,
// Logging's tree, the near set of 3D trees and its outline read the walk ground's, as they read a felled tree's place
// while its picture lies sunk (treeHost.js sinkFelled, which draws through drawnCentre below). A flat set on something
// other than the ground - a town's tree a hill's mound raised (world/townStandIns.js seatNatureFlat), a World of
// Daggerfall site's flats at its author's height - is no plant of the ground: it keeps its picture where it stands.
import { drawnGroundAt, walkGroundAt } from '../world/terrain/terrainSurface.js';
import { flatBatchAabb } from '../render/frustum.js';
import { FELLED } from '../ai/cover.js';
import { GRAHT_TREE_FLOATS } from '../world/jungle/grahtOaks.js';
import { LAND_PROP_FLOATS } from '../world/lands/landProps.js';   // TESA-LANDS: the lands' landmarks, seated as the graht-oaks are

/** The centres stood on the ground by its law (the kernel's woods and scatter, the jungle's trees and roadside pairs, a
 *  town's nature flats on its ground) - a mark on the flat's own base array. OW-SEAT: a mark, not a WeakSet - every wild
 *  flat standing was its entry, and the set's growth rehashed them all in one add (484 ms in a pixel's build past the Bay). */
const ON_GROUND = Symbol('onGround');
/** A flat's centre stands on the ground (walkGroundAt, less its slope's sink): drawn on its pixel's ring.
 *  @param {number[]} c */
export const standsOnGround = (c) => { c[ON_GROUND] = true; };

/** What the ground a pixel draws (`stride`, `carve`) stands over the walk ground at (x, z), m - 0 in the near ring
 *  with no bed under it. */
const liftAt = (samples, x, z, stride, carve) => drawnGroundAt(samples, x, z, stride, carve) - walkGroundAt(samples, x, z);

/**
 * Each ground-stood centre's lift at a ring, null where every one is 0 (the near ring, no bed under its plants).
 * @param {Float32Array} samples @param {number[][]} centers @param {number} stride @param {?ArrayLike<number>} carve
 * @returns {Float32Array|null}
 */
export function ringLifts(samples, centers, stride, carve) {
  if (stride === 1 && !carve) return null;
  let lift = null;
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    if (c[ON_GROUND] !== true) continue;
    const d = liftAt(samples, c[0], c[2], stride, carve);
    if (d !== 0) (lift ??= new Float32Array(centers.length))[i] = d;
  }
  return lift;
}

/** The same for a packed set (`step` floats a tree, x at 0 and z at 2 - the graht-oaks', every one on the ground). */
function packedLifts(samples, packed, step, stride, carve) {
  if (stride === 1 && !carve) return null;
  let lift = null;
  for (let i = 0, k = 0; i < packed.length; i += step, k++) {
    const d = liftAt(samples, packed[i], packed[i + 2], stride, carve);
    if (d !== 0) (lift ??= new Float32Array(packed.length / step))[k] = d;
  }
  return lift;
}

/** A holder's lifts at a ring - the last ones made kept with the ring they were made for, so a pixel crossing back and
 *  forth reads its ground once (a pixel's samples and its plants' places never change while it stands). */
function liftsFor(holder, stride, carve, make) {
  if (stride === 1 && !carve) return null;
  const kept = holder._ringLift;
  if (kept && kept.stride === stride && kept.carve === carve) return kept.lift;
  const lift = make();
  holder._ringLift = { stride, carve, lift };
  return lift;
}

/**
 * A BUILT PIXEL'S PLANTS' LIFTS MADE AHEAD for a ring it is not drawn at yet (`stride`, the ground with no bed): the
 * build of a pixel about the player makes the far ring's in a breath of its own, so the crossing that first demotes it
 * moves its pictures and reads no ground. A pixel whose water carves the far grid reads its own bed when it comes.
 * @param {any} p @param {number} stride
 */
export function warmFlora(p, stride) {
  if (stride === 1) return;
  for (const g of p.forest?.groups?.values() ?? []) if (g.batch) liftsFor(g, stride, null, () => ringLifts(p.samples, g.centers, stride, null));
  const set = p.grahtOaks;
  if (set) liftsFor(set, stride, null, () => packedLifts(p.samples, set.trees, GRAHT_TREE_FLOATS, stride, null));
  const lands = p.landProps;
  if (lands) liftsFor(lands, stride, null, () => packedLifts(p.samples, lands.props, LAND_PROP_FLOATS, stride, null));
}

/**
 * A forest group's centre `i` AS DRAWN: on its ring's ground (`g.lift`), and a felled tree under it by its height and a
 * metre (PROF4) - the centre itself where neither moves it.
 * @param {{ lift?: Float32Array|null, size: { h: number } }} g @param {number[]} c @param {number} i @param {boolean} felled
 * @returns {number[]}
 */
export function drawnCentre(g, c, i, felled) {
  const dy = (g.lift ? g.lift[i] : 0) - (felled ? g.size.h + 1 : 0);
  return dy === 0 ? c : [c[0], c[1] + dy, c[2]];
}

/**
 * A BUILT PIXEL'S PLANTS SEATED ON ITS RING: every forest group's batch (`p.forest.groups` - the woods', a town's nature
 * flats', the jungle's), its graht-oaks (`p.grahtOaks`, which their host frames at `lift`) and TESA-LANDS' landmarks (`p.landProps`, the same) drawn on the ground the pixel
 * draws now (`p._stride`, `p._bed`), the felled trees under it; each moved batch's cull box with it and the pixel's grown
 * to hold it. The build calls it as it publishes, and the world host where the ground it draws changes (restrideTerrain,
 * dwRecarve) - a re-skin with the groups it makes. A group drawn on that ground already is left as it stands.
 * @param {any} p a built pixel's entry
 * @param {{ moveBillboardBatch: (b: any, c: number[][]) => boolean }} renderer
 */
export function seatFlora(p, renderer) {
  if (!p?.samples) return;
  const stride = p._stride ?? 1, carve = p._bed?.depths ?? null;
  for (const g of p.forest?.groups?.values() ?? []) {
    if (!g.batch) continue;
    const lift = liftsFor(g, stride, carve, () => ringLifts(p.samples, g.centers, stride, carve));
    if (lift === (g.lift ?? null)) continue;   // drawn on this ground already - the walk ground then and now, or this ring's
    g.lift = lift;
    const drawn = g.centers.map((c, i) => drawnCentre(g, c, i, FELLED.has(c)));
    renderer.moveBillboardBatch(g.batch, drawn);
    g.batch._box = flatBatchAabb(drawn, g.size);   // EV3: culled where it is drawn
    if (p._box) for (let k = 0; k < 3; k++) { p._box[k] = Math.min(p._box[k], g.batch._box[k]); p._box[3 + k] = Math.max(p._box[3 + k], g.batch._box[3 + k]); }
  }
  const set = p.grahtOaks;
  if (set) set.lift = liftsFor(set, stride, carve, () => packedLifts(p.samples, set.trees, GRAHT_TREE_FLOATS, stride, carve));
  const lands = p.landProps;   // TESA-LANDS: the landmarks by the same law (landPropsHost.js frames each at its lift)
  if (lands) lands.lift = liftsFor(lands, stride, carve, () => packedLifts(p.samples, lands.props, LAND_PROP_FLOATS, stride, carve));
}
