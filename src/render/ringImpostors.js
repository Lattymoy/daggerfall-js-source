// @ts-check
// IC-GRAND (bible/03-World/Arena-Provinces.md IC-GRAND) - THE FAR RING'S IMPOSTORS: a place too big for the stream - the
// Imperial City, twenty kilometres across - stands its far shape on the far ring's pass (render/farRing.js): drawn by
// the ring's own program after the ring's ground, at the far plane (every pixel the stream draws paints over it), lit,
// fogged and hazed as the ring is. A door of its own, so a world module registers one (world/capitalModels.js
// installCapitals) and the ring draws what is registered - no host wires it.
//
// An impostor: `anchor()` the map pixel whose middle is its origin (or null: not standing), `reach` how many pixels it
// runs from there, `step()` its making a step at a time (true once whole), `mesh()` its vertices (positions, normals
// about the anchor in the ring's frame, +z north; colours and the sea's flag as bytes, four a quad), and `order(dx, dy,
// dz, builtAt)` its triangles' indices from an eye that far from its anchor (the ring's frame), leaving out what stands
// on a pixel `builtAt(px, py)` says the stream has built.

/** @typedef {{ anchor: () => ({ px: number, py: number } | null), reach: number, step: () => boolean,
 *   mesh: () => ({ positions: Float32Array, normals: Float32Array, colors: Uint8Array, sea: Uint8Array } | null),
 *   order: (dx: number, dy: number, dz: number, builtAt: (px: number, py: number) => boolean) => Uint32Array }} RingImpostor */

/** @type {RingImpostor[]} */
const _list = [];
/** Register an impostor (once; a second registration of the same is none). @param {RingImpostor} imp */
export function registerRingImpostor(imp) {
  if (!imp || typeof imp.anchor !== 'function' || typeof imp.order !== 'function' || _list.includes(imp)) return false;
  _list.push(imp);
  return true;
}
/** The impostors registered. */
export const ringImpostors = () => _list;
/** Test seam. */
export function _resetRingImpostors() { _list.length = 0; }
