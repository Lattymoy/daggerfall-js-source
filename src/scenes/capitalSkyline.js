// @ts-check
// IC-GRAND x FAR-LANDMARK (bible/03-World/Arena-Provinces.md IC-GRAND, bible/06-Systems/Travel-View.md FAR-LANDMARK) -
// THE IMPERIAL CITY ON THE HORIZON. Twenty kilometres of city outrun the stream; stream B's hook draws a silhouette on the
// far ring's pass (render/farLandmarks.js) where the stream has not built its pixel. This hands the city in: one landmark
// a slice (world/imperialImpostor.js imperialLandmarkMesh - its tower, walls and landmarks, its streets as a few masses),
// each stood on the ground the far ring stands at its pixel (FarRingRenderer.groundAt), while the traveller is within
// SKYLINE_REACH of the city's centre pixel and the capitals stand; let go once they leave it, the capitals go, or the ring
// is another. Made a few a frame (SKYLINE_BUDGET_MS), the nearest first - never the 625 at once - and each made once.
// The host wires it through scenes/tamrielSweepsHost.js (HOST-SPLIT): `host.farRing` (null on the classic skin, which
// draws no far ring) and `host.state`.
import { CAPITALS, capitalCentrePixel } from '../world/tamrielCapitals.js';
import { IMPERIAL_SPAN } from '../world/imperialCity.js';
import { imperialLandmarkMesh } from '../world/imperialImpostor.js';
import { RING_RADIUS } from '../render/farRing.js';

/** How far, Chebyshev pixels from the city's centre pixel, the traveller stands for the city's landmarks to stand: the far
 *  ring's own radius and the span's half past it (a slice at the ring's rim is on it). */
export const SKYLINE_REACH = RING_RADIUS + (IMPERIAL_SPAN + 1) / 2;
/** A frame's share of the landmarks' making and handing in, milliseconds. */
export const SKYLINE_BUDGET_MS = 3;
const R = (IMPERIAL_SPAN - 1) / 2;
const CITY = CAPITALS.findIndex((c) => c.family);

/** A slice's mesh lifted onto its ground (`y`, the world's height) - a copy; the made mesh stays the cache's. */
function lifted(mesh, y) {
  const positions = Float32Array.from(mesh.positions);
  for (let i = 1; i < positions.length; i += 3) positions[i] += y;
  return { positions, normals: mesh.normals, colors: mesh.colors, indices: mesh.indices };
}

/** @param {{ farRing: any, state: any }} host @param {{ now?: () => number, centre?: () => ?{ px: number, py: number } }} [o] the
 *  clock (milliseconds) and the city's centre pixel on the live fit and land (the capitals' own) - the pins' fakes */
export function createCapitalSkyline(host, { now = () => performance.now(), centre: centreOf = () => (CITY >= 0 ? capitalCentrePixel(CITY) : null) } = {}) {
  /** @type {Map<number, ?ReturnType<typeof imperialLandmarkMesh>>} */
  const made = new Map();   // slice -> its mesh (null: nothing stands there), made once
  /** @type {Map<number, { remove: () => void, landmark: any }>} */
  const handles = new Map();
  let ring = null, at = null, /** @type {number[]} */ owed = [], /** @type {number[]} */ waiting = [], waitBase = '';
  const drop = () => { for (const h of handles.values()) h.remove(); handles.clear(); owed = []; waiting = []; at = null; };
  /** Every slice owed, the nearest the traveller first. */
  const owe = (centre, cur) => {
    owed = Array.from({ length: IMPERIAL_SPAN * IMPERIAL_SPAN }, (_, s) => s)
      .sort((a, b) => Math.hypot(centre.px + (a % IMPERIAL_SPAN) - R - cur.x, centre.py + Math.floor(a / IMPERIAL_SPAN) - R - cur.y) - Math.hypot(centre.px + (b % IMPERIAL_SPAN) - R - cur.x, centre.py + Math.floor(b / IMPERIAL_SPAN) - R - cur.y));
  };
  /** The frame's sweep: the landmarks let go or handed in, a budget's worth. */
  function sweep() {
    let fr = null;
    try { fr = host.farRing ?? null; } catch { fr = null; }   // the ring is made after the sweeps' wiring
    const cur = host.state?.current, centre = fr && cur ? centreOf() : null;
    const within = !!centre && Math.max(Math.abs(cur.x - centre.px), Math.abs(cur.y - centre.py)) <= SKYLINE_REACH;
    const first = handles.values().next().value;
    // let go: out of reach, the capitals gone, the ring another or its landmarks disposed with it, the city moved
    if (fr !== ring || !within || (first && !first.landmark.vao) || (at && centre && (at.px !== centre.px || at.py !== centre.py))) { if (handles.size || owed.length) drop(); ring = fr; }
    if (!within || !centre) return;
    if (!at) { at = { px: centre.px, py: centre.py }; owe(centre, cur); }
    const base = `${fr.baseX},${fr.baseY}`;
    if (waiting.length && base !== waitBase) { owed.push(...waiting); waiting = []; }   // the ring rebuilt round another base
    const t0 = now();
    while (owed.length && now() - t0 < SKYLINE_BUDGET_MS) {
      const s = /** @type {number} */ (owed.shift());
      if (!made.has(s)) made.set(s, imperialLandmarkMesh(s));
      const mesh = made.get(s);
      if (!mesh) continue;
      const px = centre.px + (s % IMPERIAL_SPAN) - R, py = centre.py + Math.floor(s / IMPERIAL_SPAN) - R, y = fr.groundAt(px, py);
      if (y == null) { waiting.push(s); waitBase = base; continue; }   // off the ring's grid (or before its build): asked again when it moves
      handles.set(s, fr.addLandmark({ px, py, mesh: lifted(mesh, y), key: `imperial:${s}` }));
    }
  }
  return { sweep, drop, get count() { return handles.size; }, get owed() { return owed.length; }, get waiting() { return waiting.length; } };
}
