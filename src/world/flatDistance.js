// MAC1 (Mac, 2026-09-10): "Fix fps outside issue. Issue is def caused
// by all the billboards in the distance ESPECIALLY ALL THE SMALL ONES
// not being culled out. Make the distant trees visible, but everything
// else not. Also stop the billboard rotations for the ones that are
// REALLY far away. It is okay not to have them rotate."
//
// WHAT THE COST WAS. The streaming host builds one billboard batch per
// (archive, record) per pixel and drew every one of them every frame,
// frustum-culled and nothing else (EV3) - so with TerrainDistance 3 the
// 49 streamed pixels put every small plant of every far pixel through
// its own draw call at a size under a screen pixel. DFU pays the same
// batches but gets Unity's batching and its own distance falloff for
// free; presentation is the port's under Port-Doctrine, so the rule is
// ours to write, and it is pure so it pins without a GL.
//
// THE RULE. Rings are Chebyshev distance in map pixels from the pixel
// the player stands on (StreamingWorld's own IsInRange shape). The two
// nearest rings draw everything - ring 0 is under the player's feet and
// ring 1 is the eight pixels around it, 800 units to a side. Beyond
// them a flat draws only if it is TALL - a tree, at or above
// TALL_FLAT_HEIGHT in world units (a walker is 1.8) - or if it MOVES
// (an animated flat: a fire, a torch, and any smoke a village puts up),
// which is what marks a settlement from the road. Everything small and
// still is skipped before it costs a draw call. It is a WORLD-UNIT test
// on purpose: under Seasons of the Iliac Bay the managed archives draw
// 3.1x taller, so most of their plants pass this rule three seasons of
// four - they really are that big on screen. That is the mod's cost
// (AUDIT 65 XL-2, judged and left); do not season-condition the height.
//
// THE ROTATION. The owner's permission not to turn the far ones is
// noted and not needed: a billboard's facing is one uniform per pass in
// this renderer (drawBillboards' camRight/camUp), so a far flat that
// draws turns for free, and one that does not draw costs nothing.

/** Rings 0..FAR_FLAT_RING-1 draw every flat. */
export const FAR_FLAT_RING = 2;

/** World units: a flat this tall or taller is a tree and draws at any
 *  ring. Chosen above the tallest walker (1.8) and below the shortest
 *  of Daggerfall's tree records. */
export const TALL_FLAT_HEIGHT = 2.5;

/**
 * Does this flat batch draw at this ring? THE RULE'S ONE HOME.
 *
 * PERF-EXT12 (2026-09-25, the players' "fps issues in the exterior but
 * fine in the interior"): POSITIONAL, because the streaming host asks it of
 * every flat batch of every pixel it can see or reach, every frame - 1,131
 * times a frame on the harness town - and the object form built a
 * `{ ring, height, animated }` for each. AUDIT 65 had judged that object
 * free: in a five-million-call microbenchmark V8 scalar-replaces a literal
 * that never escapes. In the frame it does not. With a 1 MB young space,
 * 3,065 harness frames ran 1,296-1,301 scavenges with the literal and
 * 1,073-1,078 with this call - and the rule written out inline scavenges
 * no less than this call does, so the garbage was the object, not the
 * call: about 70 KB a frame, the collector's to meet (PERF-TOWN1's lesson).
 * @param {number} ring      Chebyshev map-pixel distance from the player's pixel
 * @param {number} height    the batch's scaled billboard height in world units
 * @param {boolean} [animated] true for a batch the FlatAnimator drives (`frame != null`)
 */
export function farFlatVisibleAt(ring, height, animated = false) {
  if (ring < FAR_FLAT_RING) return true;
  if (animated) return true;
  return height >= TALL_FLAT_HEIGHT;
}

/**
 * The same rule, asked with an object - the MAC1 form its pins speak, and
 * nothing more than a call to the one home above.
 * @param {{ring: number, height: number, animated?: boolean}} p
 */
export function farFlatVisible({ ring, height, animated = false }) {
  return farFlatVisibleAt(ring, height, animated);
}
