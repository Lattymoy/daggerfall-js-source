// A BEAST HEAD, for a body that walks upright.
//
// A Daggerfall werewolf is not a wolf on four legs. It is a man with the
// wrong head, and that distinction is the whole design: the human rig
// keeps its arms, its legs and its stance, and only the SKULL is
// replaced. So this is the narrowest collapse in the project — one group
// of six, where the beasts take all of them.
//
// WHICH MEANS IT SITS WHERE THE HUMAN HEAD SAT. The rig's own
// NECK_PIVOT_Y is 1.655 and everything that animates a head derives from
// it, so the muzzle is anchored there rather than at some height that
// happens to look right. A head pinned anywhere else swings wrong the
// moment the thing looks up.
//
// Built in FINAL (compressed) body space and tagged 'head', so it rides
// headPitch with the skull it replaced.

import { HSCALE } from './pieceLoft.js';
import { NECK_PIVOT_Y } from '../neutralBody.js';

/** Grey wolf. Each design overrides it. */
export const WOLF_RAMP = [
  [34, 32, 30],
  [56, 53, 50],
  [82, 78, 74],
  [110, 105, 100],
  [140, 134, 128],
  [170, 164, 157],
];

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
    faces.push({ p: [...a, ...b, ...c, ...d], n: [nx / L, ny / L, nz / L], c: [...c3], g: 'head', _i: shade });
  };
}

function box(quad, x0, y0, z0, x1, y1, z1, top = 0.95, side = 0.66, under = 0.32) {
  quad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], side);
  quad([x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], side * 0.68);
  quad([x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], side * 0.86);
  quad([x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], side * 0.86);
  quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top);
  quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], under);
}

/**
 * @param {number[][]} ramp coat colours, dark -> light
 * @param {object} s
 *   skull  — how big the cranium is
 *   snout  — how far the muzzle runs forward
 *   depth  — how deep the muzzle is (a boar's is blunt, a wolf's fine)
 *   ears   — 0 none, 1 tall and pricked
 *   tusks  — 0 none, 1 a boar's pair
 */
export function buildBeastHead(ramp = WOLF_RAMP, s = {}) {
  const { skull = 0.1, snout = 0.14, depth = 0.6, ears = 1, tusks = 0 } = s;
  const faces = [];
  const quad = quadder(faces, ramp);

  // ANCHORED ON THE RIG'S OWN NECK PIVOT, not on a height that looks
  // right. Everything that animates a head derives from this constant.
  const baseY = NECK_PIVOT_Y * HSCALE;
  const cy = baseY + skull * 0.55;

  // The cranium.
  box(quad, -skull, cy - skull * 0.9, -skull * 0.9, skull, cy + skull * 0.9, skull * 0.7);

  // The muzzle, running forward and DOWN — a head that points its snout
  // level reads as a crocodile.
  const mw = skull * (0.42 + depth * 0.34);
  const my = cy - skull * 0.36;
  box(
    quad,
    -mw,
    my - skull * depth * 0.9,
    skull * 0.5,
    mw,
    my + skull * 0.34,
    skull * 0.5 + snout,
    0.88,
    0.6,
  );
  // The nose, darker and blunter than the muzzle it ends.
  box(
    quad,
    -mw * 0.7,
    my - skull * depth * 0.75,
    skull * 0.5 + snout,
    mw * 0.7,
    my + skull * 0.12,
    skull * 0.5 + snout + skull * 0.12,
    0.3,
    0.24,
    0.18,
  );

  // Ears: up off the back of the skull, angled out.
  if (ears > 0) {
    const ew = skull * 0.26;
    const eh = skull * 1.1 * ears;
    for (const side of [-1, 1]) {
      const x = side * skull * 0.6;
      box(quad, x - ew, cy + skull * 0.7, -skull * 0.5, x + ew, cy + skull * 0.7 + eh, -skull * 0.5 + ew * 1.6, 0.9, 0.58);
    }
  }

  // Tusks: up out of the lower jaw, which is what makes a boar a boar.
  if (tusks > 0) {
    const tw = skull * 0.09;
    const tl = skull * 0.7 * tusks;
    for (const side of [-1, 1]) {
      const x = side * mw * 0.7;
      box(
        quad,
        x - tw,
        my - skull * depth * 0.7,
        skull * 0.5 + snout * 0.55,
        x + tw,
        my - skull * depth * 0.7 + tl,
        skull * 0.5 + snout * 0.55 + tw * 2,
        1,
        0.86,
        0.6,
      );
    }
  }

  return faces;
}

/**
 * HORNS, which are the one thing a daedra lord has that nothing else in
 * this project does.
 *
 * Swept back off the temples on an arc rather than straight up: a horn
 * that rises vertically is a party hat, and the sweep is what makes it
 * read as grown rather than worn.
 *
 * Tagged 'head' so they ride the skull, same as the ears and tusks.
 *
 * @param {number[][]} ramp
 * @param {{len?:number, thick?:number, sweep?:number, skull?:number}} s
 */
export function buildHorns(ramp = WOLF_RAMP, s = {}) {
  const { len = 0.22, thick = 0.022, sweep = 0.7, skull = 0.1 } = s;
  const faces = [];
  const quad = quadder(faces, ramp);
  const baseY = NECK_PIVOT_Y * HSCALE + skull * 0.55;

  const SEGS = 4;
  for (const side of [-1, 1]) {
    let px = side * skull * 0.72,
      py = baseY + skull * 0.5,
      pz = -skull * 0.2;
    for (let i = 1; i <= SEGS; i++) {
      const t = i / SEGS;
      // Up first, then back: the arc tips over as it goes.
      const a = t * Math.PI * 0.55 * sweep;
      const nx = px + side * len * 0.1 * t;
      const ny = py + Math.cos(a) * (len / SEGS);
      const nz = pz - Math.sin(a) * (len / SEGS) * 1.4;
      const r = thick * (1.1 - t * 0.75);
      // A tapering box per segment, laid along its own run.
      quad([px - r, py, pz + r], [px + r, py, pz + r], [nx + r, ny, nz + r], [nx - r, ny, nz + r], 0.92);
      quad([px + r, py, pz - r], [px - r, py, pz - r], [nx - r, ny, nz - r], [nx + r, ny, nz - r], 0.5);
      quad([px + r, py, pz + r], [px + r, py, pz - r], [nx + r, ny, nz - r], [nx + r, ny, nz + r], 0.72);
      quad([px - r, py, pz - r], [px - r, py, pz + r], [nx - r, ny, nz + r], [nx - r, ny, nz - r], 0.72);
      px = nx;
      py = ny;
      pz = nz;
    }
  }
  return faces;
}
