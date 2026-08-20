// The skeleton's RIBCAGE: the one part of it that is not expressible as
// a girth multiplier on the neutral rig.
//
// Everything the orc line needed was BUILD_IDENTITY scaling — a barrel
// chest is a torso multiplier, a heavy jaw is a jaw multiplier — and the
// undead line proved how far that goes: a zombie's decay and a mummy's
// wrappings are both girth and displace-zones over the same 2136 faces.
//
// A SKELETON IS WHERE THAT RUNS OUT. Ribs are not a thinner torso. They
// are a row of separate bones with GAPS BETWEEN THEM, and no multiplier
// on a closed loft will ever put a hole in it. So the chest is built
// here as its own geometry and the body under it is scaled away to
// nothing, which is the first time this rig has needed a piece to carry
// a silhouette rather than decorate one.
//
// Built in FINAL (compressed) body space — same convention as
// orcHead.js, tail.js and hair.js — and tagged 'body' so the ribs ride
// the torso through a swing instead of hanging in the air behind it.
//
// ANCHORING: the chest rows this sits on are scaled by BD.torso at build
// time, so the anchors take the same multiplier. A rib pinned to the
// unscaled human chest floats off a 0.7-torso skeleton and sinks into a
// 1.2-torso one; passing the build through is what keeps the ribs on the
// ribcage at every width in the clamp band.

import { HSCALE } from './pieceLoft.js';

/** Bone: cold and grey-white, its own ramp. A rib shaded off a hide
 *  ramp reads as painted wood. */
export const BONE_RAMP = [
  [74, 72, 66],
  [104, 102, 94],
  [136, 133, 123],
  [168, 165, 154],
  [198, 195, 184],
  [226, 223, 212],
];

// The chest band the ribs occupy, in the rig's own un-compressed
// heights — the same numbers the zone helpers speak in.
const CHEST_TOP = 1.5;
const CHEST_BOT = 1.06;
const STERNUM_Z = 0.1;

/**
 * @param {number[][]} ramp bone colours, dark -> light
 * @param {{torso?:number, ribs?:number, gap?:number}} opts
 *   torso — the design's BUILD torso multiplier, so the cage matches
 *   ribs  — how many pairs (Daggerfall's skeletons read as few and heavy)
 *   gap   — the fraction of each band that is air rather than bone
 */
export function buildRibcage(ramp = BONE_RAMP, { torso = 1, ribs = 6, gap = 0.42 } = {}) {
  const faces = [];
  const quad = (a, b, c, d, shade) => {
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

  const rx = 0.15 * torso;
  const rz = 0.1 * torso;
  const span = CHEST_TOP - CHEST_BOT;
  const band = span / ribs;
  const bone = band * (1 - gap); // the rib itself; the rest is air

  for (let i = 0; i < ribs; i++) {
    // Top rib is shortest and highest; the cage widens as it descends,
    // then draws back in at the floating ribs. A straight barrel reads
    // as a crate.
    const t = i / (ribs - 1);
    const flare = 0.72 + Math.sin(t * Math.PI * 0.86) * 0.42;
    const yTop = (CHEST_TOP - i * band) * HSCALE;
    const yBot = (CHEST_TOP - i * band - bone) * HSCALE;
    const wx = rx * flare;
    const wz = rz * flare;

    // Each rib is a hoop of four faces round the chest. Front and back
    // are lit brightest, the sides fall away — the shading is what makes
    // a stack of hoops read as a cage rather than as a ladder.
    const ring = [
      [
        [-wx, yTop, wz],
        [wx, yTop, wz],
        [wx, yBot, wz],
        [-wx, yBot, wz],
        0.95,
      ], // front
      [
        [wx, yTop, -wz],
        [-wx, yTop, -wz],
        [-wx, yBot, -wz],
        [wx, yBot, -wz],
        0.4,
      ], // back
      [
        [wx, yTop, wz],
        [wx, yTop, -wz],
        [wx, yBot, -wz],
        [wx, yBot, wz],
        0.62,
      ], // right
      [
        [-wx, yTop, -wz],
        [-wx, yTop, wz],
        [-wx, yBot, wz],
        [-wx, yBot, -wz],
        0.62,
      ], // left
    ];
    for (const [a, b, c, d, shade] of ring) quad(a, b, c, d, shade);
  }

  // THE STERNUM. Without it the ribs float as separate hoops and the
  // chest reads hollow from the front — a breastbone is what tells the
  // eye they are one cage.
  const sx = 0.028 * torso;
  quad(
    [-sx, CHEST_TOP * HSCALE, STERNUM_Z * torso],
    [sx, CHEST_TOP * HSCALE, STERNUM_Z * torso],
    [sx, (CHEST_BOT + 0.06) * HSCALE, STERNUM_Z * torso],
    [-sx, (CHEST_BOT + 0.06) * HSCALE, STERNUM_Z * torso],
    1,
  );

  return faces;
}

/**
 * THE PELVIS, for the same reason as the ribs: a hip girdle has a hole
 * through it and a loft does not.
 */
export function buildPelvis(ramp = BONE_RAMP, { torso = 1 } = {}) {
  const faces = [];
  const quad = (a, b, c, d, shade) => {
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

  const yTop = 1.02 * HSCALE;
  const yBot = 0.86 * HSCALE;
  const wx = 0.17 * torso;
  const wz = 0.1 * torso;
  // Two blades with the gap between them, rather than a solid block.
  for (const side of [-1, 1]) {
    const xo = side * wx * 0.55;
    const bw = wx * 0.42;
    quad([xo - bw, yTop, wz], [xo + bw, yTop, wz], [xo + bw, yBot, wz], [xo - bw, yBot, wz], 0.92);
    quad([xo + bw, yTop, -wz], [xo - bw, yTop, -wz], [xo - bw, yBot, -wz], [xo + bw, yBot, -wz], 0.38);
    quad(
      [xo + side * bw, yTop, wz],
      [xo + side * bw, yTop, -wz],
      [xo + side * bw, yBot, -wz],
      [xo + side * bw, yBot, wz],
      0.6,
    );
  }
  return faces;
}
