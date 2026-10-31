// @ts-check
// IC-GRAND x FAR-LANDMARK (bible/03-World/Arena-Provinces.md IC-GRAND, bible/06-Systems/Travel-View.md FAR-LANDMARK) -
// THE IMPERIAL CITY ON THE HORIZON. Twenty kilometres of city outrun the stream; stream B's hook draws a silhouette on the
// far ring's pass (render/farLandmarks.js) where the stream has not built its pixel. This hands the city in: one landmark
// a slice (world/imperialImpostor.js imperialLandmarkMesh - its tower, walls and landmarks, its streets as a few masses),
// each stood where the stream stands it - AUDIT RELEASE R1-4: every slice at the centre pixel's ground (the stream
// flattens every slice to it, world/terrain/terrainGen.js flattenAt), its masses' feet down to the ring's own ground round
// its pixel (FarRingRenderer.groundAt), never in the air over a lower slice - while the traveller is within
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
/** The slices, the centre's first and outward. */
const BY_CENTRE = Array.from({ length: IMPERIAL_SPAN * IMPERIAL_SPAN }, (_, s) => s).sort(
  (a, b) =>
    Math.hypot((a % IMPERIAL_SPAN) - R, Math.floor(a / IMPERIAL_SPAN) - R) -
    Math.hypot((b % IMPERIAL_SPAN) - R, Math.floor(b / IMPERIAL_SPAN) - R),
);

/** A slice's mesh lifted onto the city's ground (`y`, the world's height - the centre's) - a copy; the made mesh stays the
 *  cache's. AUDIT RELEASE R1-4: its feet (every corner at its ground, y 0 - a wall's, a mass's side's; the far view lays no
 *  flat quad there) at `foot` (the world's height - the ring's lowest round the slice, never above `y`): the far ring's
 *  ground under a slice is the land's own, up to 40 m under the city's, and the slice's masses reach down to it. */
function lifted(mesh, y, foot = y) {
  const positions = Float32Array.from(mesh.positions);
  for (let i = 1; i < positions.length; i += 3) positions[i] = positions[i] <= 0 ? foot : positions[i] + y;
  return { positions, normals: mesh.normals, colors: mesh.colors, indices: mesh.indices };
}
/** AUDIT RELEASE R1-4: the ground the city stands at on this ring - its centre pixel's (the stream flattens every slice to
 *  it), `known`; off the ring's grid, the ring's ground at the city's on-grid slice nearest its centre, an estimate the
 *  slices are stood again from once the centre is on the grid - or null with none of the city on it.
 *  @returns {?{ y: number, known: boolean }} */
function cityGround(fr, centre) {
  const y = fr.groundAt(centre.px, centre.py);
  if (y != null) return { y, known: true };
  for (const s of BY_CENTRE) {
    const g = fr.groundAt(centre.px + (s % IMPERIAL_SPAN) - R, centre.py + Math.floor(s / IMPERIAL_SPAN) - R);
    if (g != null) return { y: g, known: false };
  }
  return null;
}
/** The ring's lowest ground round pixel (px, py) - its own and its eight neighbours' on the grid - or null off it. */
function lowestAround(fr, px, py) {
  if (fr.groundAt(px, py) == null) return null;
  let lo = Infinity;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const g = fr.groundAt(px + dx, py + dy);
      if (g != null && g < lo) lo = g;
    }
  return lo;
}

/** @param {{ farRing: any, state: any }} host @param {{ now?: () => number, centre?: () => ?{ px: number, py: number } }} [o] the
 *  clock (milliseconds) and the city's centre pixel on the live fit and land (the capitals' own) - the pins' fakes */
export function createCapitalSkyline(
  host,
  { now = () => performance.now(), centre: centreOf = () => (CITY >= 0 ? capitalCentrePixel(CITY) : null) } = {},
) {
  /** @type {Map<number, ?ReturnType<typeof imperialLandmarkMesh>>} */
  const made = new Map(); // slice -> its mesh (null: nothing stands there), made once
  /** @type {Map<number, { remove: () => void, landmark: any }>} */
  const handles = new Map();
  let ring = null,
    at = null,
    /** @type {number[]} */ owed = [],
    /** @type {number[]} */ waiting = [],
    waitBase = '';
  let /** @type {?{ y: number, known: boolean }} */ stood = null,
    groundBase = ''; // R1-4: the city's ground the slices stand at, and the ring's base it was read on
  const drop = () => {
    for (const h of handles.values()) h.remove();
    handles.clear();
    owed = [];
    waiting = [];
    at = null;
    stood = null;
    groundBase = '';
  };
  /** Every slice owed, the nearest the traveller first. */
  const owe = (centre, cur) => {
    owed = Array.from({ length: IMPERIAL_SPAN * IMPERIAL_SPAN }, (_, s) => s).sort(
      (a, b) =>
        Math.hypot(centre.px + (a % IMPERIAL_SPAN) - R - cur.x, centre.py + Math.floor(a / IMPERIAL_SPAN) - R - cur.y) -
        Math.hypot(centre.px + (b % IMPERIAL_SPAN) - R - cur.x, centre.py + Math.floor(b / IMPERIAL_SPAN) - R - cur.y),
    );
  };
  /** The frame's sweep: the landmarks let go or handed in, a budget's worth. */
  function sweep() {
    let fr = null;
    try {
      fr = host.farRing ?? null;
    } catch {
      fr = null;
    } // the ring is made after the sweeps' wiring
    const cur = host.state?.current,
      centre = fr && cur ? centreOf() : null;
    const within = !!centre && Math.max(Math.abs(cur.x - centre.px), Math.abs(cur.y - centre.py)) <= SKYLINE_REACH;
    const first = handles.values().next().value;
    // let go: out of reach, the capitals gone, the ring another or its landmarks disposed with it, the city moved
    if (
      fr !== ring ||
      !within ||
      (first && !first.landmark.vao) ||
      (at && centre && (at.px !== centre.px || at.py !== centre.py))
    ) {
      if (handles.size || owed.length) drop();
      ring = fr;
    }
    if (!within || !centre) return;
    if (!at) {
      at = { px: centre.px, py: centre.py };
      owe(centre, cur);
    }
    const base = `${fr.baseX},${fr.baseY}`;
    if (waiting.length && base !== waitBase) {
      owed.push(...waiting);
      waiting = [];
    } // the ring rebuilt round another base
    if (base !== groundBase || !stood) {
      // R1-4: the city's ground read once a base; an estimate's slices stood again once it is known
      const g = cityGround(fr, centre);
      groundBase = base;
      if (!g) return;
      if (stood && !stood.known && g.known && g.y !== stood.y) {
        for (const h of handles.values()) h.remove();
        handles.clear();
        waiting = [];
        owe(centre, cur);
      }
      if (!stood || (!stood.known && g.known)) stood = g;
    }
    const cityY = stood.y;
    const t0 = now();
    while (owed.length && now() - t0 < SKYLINE_BUDGET_MS) {
      const s = /** @type {number} */ (owed.shift());
      if (!made.has(s)) made.set(s, imperialLandmarkMesh(s));
      const mesh = made.get(s);
      if (!mesh) continue;
      const px = centre.px + (s % IMPERIAL_SPAN) - R,
        py = centre.py + Math.floor(s / IMPERIAL_SPAN) - R,
        lo = lowestAround(fr, px, py);
      if (lo == null) {
        waiting.push(s);
        waitBase = base;
        continue;
      } // off the ring's grid (or before its build): asked again when it moves
      handles.set(s, fr.addLandmark({ px, py, mesh: lifted(mesh, cityY, Math.min(cityY, lo)), key: `imperial:${s}` }));
    }
  }
  return {
    sweep,
    drop,
    get count() {
      return handles.size;
    },
    get owed() {
      return owed.length;
    },
    get waiting() {
      return waiting.length;
    },
  };
}
