// The centaur's HORSE HALF: a barrel, four legs and a tail, hung off
// the human waist.
//
// This is a different problem from the skeleton's ribcage. Ribs were
// geometry the loft could not express — holes in a closed surface — but
// they sat ON the rig's own chest. A horse body is not a detail on the
// human rig at all: it is a SECOND BODY, and the rig has exactly one.
//
// WHY THE HUMAN LEGS ARE BURIED RATHER THAN REMOVED. buildNeutralBody
// clamps every build key into BUILD_MIN..BUILD_MAX and has no way to
// drop a limb group — the face list is fixed, which is the whole reason
// every design in this file can ship as a delta. So the legs go to the
// floor of the clamp band, 0.6, and the barrel is built wide enough to
// contain them. Two 0.6-girth legs inside a horse's chest are not
// visible from outside it, and burying them costs 0 faces where teaching
// the rig to drop a group would cost every caller that depends on the
// count.
//
// Built in FINAL (compressed) body space and tagged 'body', so the horse
// rides the human waist through a swing rather than staying behind while
// the torso turns — a centaur that leaves its own hindquarters when it
// twists is worse than one that has none.

import { HSCALE } from './pieceLoft.js';

/** A bay coat: dark points, warm body. Its own ramp — a horse shaded off
 *  a human skin ramp reads as a pink animal. */
export const BAY_RAMP = [
  [46, 30, 20],
  [72, 48, 30],
  [102, 68, 42],
  [132, 92, 58],
  [162, 118, 78],
  [190, 148, 104],
];

/** Where the human ends and the horse begins, in the rig's own heights. */
const WITHERS_Y = 1.02;
/** How far back the barrel runs from the human spine. */
const BARREL_LEN = 0.62;

function quadder(faces, ramp) {
  return (a, b, c, d, shade) => {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = d[0] - a[0],
      vy = d[1] - a[1],
      vz = d[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    const c3 = ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(shade * (ramp.length - 1))))];
    faces.push({ p: [...a, ...b, ...c, ...d], n: [nx / L, ny / L, nz / L], c: [...c3], g: 'body', _i: shade });
  };
}

/** A box between two corners, six faces, shaded top-bright. */
function box(quad, x0, y0, z0, x1, y1, z1, top = 0.95, side = 0.66, bottom = 0.3) {
  quad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], side); // front
  quad([x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], side * 0.7); // back
  quad([x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], side * 0.85); // right
  quad([x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], side * 0.85); // left
  quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top); // top
  quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], bottom); // underside
}

/**
 * @param {number[][]} ramp coat colours, dark -> light
 * @param {{girth?:number, len?:number, legs?:number}} opts
 *   girth — barrel width, so a heavier centaur reads heavier
 *   len   — how far the body runs back from the human spine
 *   legs  — leg thickness
 */
export function buildHorseBody(ramp = BAY_RAMP, { girth = 1, len = 1, legs = 1 } = {}) {
  const faces = [];
  const quad = quadder(faces, ramp);

  const wx = 0.19 * girth;
  const back = BARREL_LEN * len;
  const topY = WITHERS_Y * HSCALE;
  const belly = (WITHERS_Y - 0.42) * HSCALE;

  // ── THE BARREL ──────────────────────────────────────────────────
  // Three segments rather than one box: a horse is deepest at the girth
  // just behind the shoulder and tapers to the haunch, and a single box
  // reads as a crate on legs.
  const seg = [
    [0.02, -0.2, 1.0], // chest, under the human waist
    [-0.2, -0.46, 1.06], // the girth, deepest
    [-0.46, -back, 0.92], // the haunch, drawing in
  ];
  for (const [z0, z1, f] of seg) {
    box(quad, -wx * f, belly, z1, wx * f, topY, z0);
  }

  // ── FOUR LEGS ───────────────────────────────────────────────────
  // Fore pair under the girth, hind pair under the haunch. Thinner than
  // the barrel by a long way — the contrast is what makes the body read
  // as a body rather than as a block.
  const lw = 0.05 * legs;
  const hoofY = 0.0;
  for (const [side, z] of [
    [-1, -0.12],
    [1, -0.12],
    [-1, -back + 0.1],
    [1, -back + 0.1],
  ]) {
    const x = side * wx * 0.62;
    box(quad, x - lw, hoofY + 0.06 * HSCALE, z - lw, x + lw, belly + 0.02, z + lw, 0.7, 0.6, 0.35);
    // The hoof: darker, and wider than the leg so it reads as a foot.
    box(quad, x - lw * 1.5, hoofY, z - lw * 1.5, x + lw * 1.5, hoofY + 0.06 * HSCALE, z + lw * 1.5, 0.32, 0.26, 0.2);
  }

  // ── THE TAIL ────────────────────────────────────────────────────
  // Off the haunch and down. Without it the hindquarters end in a flat
  // wall and the whole animal reads as unfinished from behind.
  const tw = 0.035 * girth;
  box(quad, -tw, belly + 0.04, -back - 0.06, tw, topY - 0.04, -back + 0.02, 0.5, 0.42, 0.3);

  return faces;
}
