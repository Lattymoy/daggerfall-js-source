// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV2 - THE TRAVEL VIEW'S PICK (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-27): "Even adding the option to tap/click to move to a
// specific location." His call on what a click means: BOTH, BY TARGET -
// a town or a marker is reached by the roads, open ground by walking
// straight there.
//
// THE RAY IS THE FRAME'S. player/tapRay.js's rayDirFromScreen turns the
// point under the finger into a direction through the very matrices the
// frame was drawn with (TI1), from the eye it was drawn from - under the
// travel view that is the RAISED eye, 150-450 m over the traveller, not
// `cam.pos`. Nothing in the tree met a slanted ray with the ground: the
// collider's raycast answers meshes, and outdoors the ground is not a
// mesh (world/collider.js). So the march is here, PURE - it takes the
// host's `heightAt` (a bilinear read of the BUILT terrain, -Infinity off
// it) and nothing else, which is what lets the pins drive it over a
// table of hills.
//
// THE MARCH: a step that grows with distance (a metre near the eye is
// wasted on a pick that lands 3 km off, and a stride of tens of metres
// can step over a ridge near it), then a bisection of the bracket the
// ray first went under the ground in. Unbuilt ground is neither ground
// nor air: the march goes on over it and says so, so a click beyond the
// built grid is told apart from a click on the sky.
// ═══════════════════════════════════════════════════════════════════

/** How far a pick reaches: the lens's far plane (scenes/world.js perspective(..., 0.2, 6000)). Scene units (metres). */
export const TV_PICK_MAX = 6000;
/** The march's shortest stride (m), and the share of the distance a stride grows to far out. */
export const TV_PICK_STEP_MIN = 2;
export const TV_PICK_STEP_SHARE = 0.004;
/** Bisections of the bracket - 2^-14 of the last stride, well under a centimetre at the far plane's. */
export const TV_PICK_REFINE = 14;

/**
 * Where a ray from `eye` along `dir` (unit) first meets the ground: `point` null for a ray that never does inside
 * `maxDist` (the sky, or a horizon past the far plane). `unbuilt` says the ray crossed ground the grid has not built on
 * its way - "beyond what can be seen from here" rather than "nothing there".
 * @param {number[]} eye
 * @param {number[]} dir
 * @param {(x:number, z:number) => number} heightAt
 * @returns {{ point: number[]|null, dist: number, unbuilt: boolean }}
 */
export function groundHit(eye, dir, heightAt, { maxDist = TV_PICK_MAX, stepMin = TV_PICK_STEP_MIN, stepShare = TV_PICK_STEP_SHARE, refine = TV_PICK_REFINE } = {}) {
  if (!eye || !dir || typeof heightAt !== 'function') return { point: null, dist: Infinity, unbuilt: false };
  const at = (t) => [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
  const under = (t) => { const p = at(t); const h = heightAt(p[0], p[2]); return Number.isFinite(h) && p[1] <= h; };
  let unbuilt = false;
  let t = 0;
  while (t < maxDist) {
    const t1 = Math.min(maxDist, t + Math.max(stepMin, t * stepShare));
    const p = at(t1);
    const h = heightAt(p[0], p[2]);
    if (!Number.isFinite(h)) unbuilt = true;
    else if (p[1] <= h) {
      let lo = t, hi = t1;
      for (let i = 0; i < refine; i++) { const m = (lo + hi) / 2; if (under(m)) hi = m; else lo = m; }
      const q = at(hi);
      const g = heightAt(q[0], q[2]);
      return { point: [q[0], Number.isFinite(g) ? g : q[1], q[2]], dist: hi, unbuilt };
    }
    t = t1;
  }
  return { point: null, dist: Infinity, unbuilt };
}

/** A pointer event's viewport point as the canvas's own CSS pixels - what tapRay reads (ui/touch/touch.js does the same). */
export function canvasPoint(clientX, clientY, rect) {
  return [clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0)];
}

/**
 * WHAT WAS CLICKED, by target (Mac's call): a known place under the click is reached by the roads; open ground is
 * walked to; water, and ground the grid has not built, are refused with the reason. `place` is the host's answer for
 * the hit's map pixel (a known location whose rect, grown by its border, holds the hit), `water` its WOODS byte test.
 * @param {{ hit: {point:number[]|null, unbuilt:boolean}|null, place?: any, water?: boolean }} q
 * @returns {{ kind: 'place'|'ground'|'water'|'far'|'none', place?: any }}
 */
export function classifyPick({ hit, place = null, water = false }) {
  if (!hit?.point) return { kind: hit?.unbuilt ? 'far' : 'none' };
  if (place) return { kind: 'place', place };
  if (water) return { kind: 'water' };
  return { kind: 'ground' };
}
