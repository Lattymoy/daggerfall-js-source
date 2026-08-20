// AN ARACHNID: eight legs, and no spine to hang them off.
//
// The quadruped builder assumes a BACKBONE — a barrel running nose to
// rump with a leg near each corner — and every animal it makes is a
// variation on that. A spider has no such axis. Its legs radiate from a
// single joint in a ring, its body is two lumps rather than a tube, and
// the whole thing is wider than it is long.
//
// So this is a different builder rather than more parameters on the old
// one. The test of whether a mechanism is right is what happens when
// something does not fit it: the beasts stretched from a rat to a bear
// on numbers alone, and an arachnid does not stretch at all.
//
// A SCORPION IS THE SAME PLAN WITH THINGS ADDED. Claws forward, and a
// tail that arches up and over rather than dragging — which is why the
// tail here is a chain of shrinking segments on an arc, and not the
// beast tail's two boxes.
//
// Built in FINAL (compressed) body space and tagged 'body'.

import { HSCALE } from './pieceLoft.js';

/** Dark chitin. Bright enough to keep its silhouette — the wereboar
 *  taught that a dark thing on a dark ground has no shape at all. */
export const CHITIN_RAMP = [
  [44, 38, 34],
  [70, 60, 52],
  [98, 84, 72],
  [128, 110, 94],
  [158, 138, 118],
  [186, 166, 144],
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
    faces.push({ p: [...a, ...b, ...c, ...d], n: [nx / L, ny / L, nz / L], c: [...c3], g: 'body', _i: shade });
  };
}

function box(quad, x0, y0, z0, x1, y1, z1, top = 0.95, side = 0.64, under = 0.3) {
  quad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], side);
  quad([x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], side * 0.7);
  quad([x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], side * 0.86);
  quad([x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], side * 0.86);
  quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top);
  quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], under);
}

/** A limb segment between two points, as a thin box aligned to the run. */
function limb(quad, ax, ay, az, bx, by, bz, r, shade) {
  const dx = bx - ax,
    dz = bz - az;
  const L = Math.hypot(dx, dz) || 1e-6;
  // Perpendicular in the ground plane, so the segment has width across
  // its own run rather than across the world.
  const px = (-dz / L) * r,
    pz = (dx / L) * r;
  quad([ax - px, ay + r, az - pz], [ax + px, ay + r, az + pz], [bx + px, by + r, bz + pz], [bx - px, by + r, bz - pz], shade);
  quad([ax + px, ay - r, az + pz], [ax - px, ay - r, az - pz], [bx - px, by - r, bz - pz], [bx + px, by - r, bz + pz], shade * 0.4);
  quad([ax + px, ay + r, az + pz], [ax + px, ay - r, az + pz], [bx + px, by - r, bz + pz], [bx + px, by + r, bz + pz], shade * 0.72);
  quad([ax - px, ay - r, az - pz], [ax - px, ay + r, az - pz], [bx - px, by + r, bz - pz], [bx - px, by - r, bz - pz], shade * 0.72);
}

/**
 * @param {number[][]} ramp
 * @param {object} s
 *   span     — how far the legs reach from the body
 *   ride     — how high the body sits off the ground
 *   thorax   — the front lump, where the legs join
 *   abdomen  — the back lump; a spider's is the bigger of the two
 *   legR     — leg thickness
 *   arch     — how high the knee rises above the body (0 splays flat)
 *   claws    — 0 none, 1 a scorpion's pair
 *   sting    — 0 none; otherwise how far the tail arches over
 */
export function buildArachnid(ramp = CHITIN_RAMP, s = {}) {
  const {
    span = 0.34,
    ride = 0.16,
    thorax = 0.1,
    abdomen = 0.13,
    legR = 0.016,
    arch = 0.5,
    claws = 0,
    sting = 0,
  } = s;

  const faces = [];
  const quad = quadder(faces, ramp);
  const y = ride * HSCALE;

  // ── THE TWO LUMPS ───────────────────────────────────────────────
  // Cephalothorax forward, abdomen behind and larger. One box would be
  // a beetle.
  box(quad, -thorax, y - thorax * 0.7, 0, thorax, y + thorax * 0.7, thorax * 1.7, 0.92, 0.62);
  box(
    quad,
    -abdomen,
    y - abdomen * 0.75,
    -abdomen * 2.0,
    abdomen,
    y + abdomen * 0.8,
    -abdomen * 0.1,
    0.88,
    0.58,
  );

  // ── EIGHT LEGS, RADIALLY ────────────────────────────────────────
  // Four a side, fanned from the thorax. Each is TWO segments with a
  // knee above the body: a spider's legs go up before they come down,
  // and legs that run straight out read as a starfish.
  const n = 4;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      // Fan from forward-ish to backward-ish along the body's side.
      const t = i / (n - 1);
      const ang = (-0.75 + t * 1.9) * side + (side < 0 ? Math.PI : 0);
      const dirX = Math.sin(ang) * (side < 0 ? -1 : 1);
      const dirZ = Math.cos(ang);
      const rootX = side * thorax * 0.8;
      const rootZ = thorax * (1.1 - t * 1.1);
      const kneeX = rootX + dirX * span * 0.5;
      const kneeZ = rootZ + dirZ * span * 0.5;
      const kneeY = y + span * arch * 0.55;
      const footX = rootX + dirX * span;
      const footZ = rootZ + dirZ * span;
      limb(quad, rootX, y, rootZ, kneeX, kneeY, kneeZ, legR, 0.8);
      limb(quad, kneeX, kneeY, kneeZ, footX, 0.01 * HSCALE, footZ, legR * 0.75, 0.62);
    }
  }

  // ── CLAWS ───────────────────────────────────────────────────────
  if (claws > 0) {
    const cr = thorax * 0.34 * claws;
    for (const side of [-1, 1]) {
      const x = side * thorax * 1.1;
      limb(quad, side * thorax * 0.7, y, thorax * 1.4, x, y, thorax * 2.4, legR * 1.4, 0.74);
      box(quad, x - cr, y - cr * 0.7, thorax * 2.3, x + cr, y + cr * 0.7, thorax * 2.3 + cr * 2.4, 0.9, 0.6);
    }
  }

  // ── THE STING ───────────────────────────────────────────────────
  // A chain of shrinking segments on an arc, up and over the back. The
  // beast tail's two boxes cannot do this: a scorpion's tail is the one
  // part of it that is not on the ground.
  if (sting > 0) {
    const segs = 5;
    let px = 0,
      py = y + abdomen * 0.4,
      pz = -abdomen * 1.9;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const a = t * Math.PI * 0.72;
      const nx2 = 0;
      const ny2 = py + Math.sin(a) * sting * 0.34;
      const nz2 = pz + (1 - Math.cos(a)) * sting * 0.2 + sting * 0.06;
      limb(quad, px, py, pz, nx2, ny2, nz2, legR * (2.1 - t * 1.2), 0.82);
      px = nx2;
      py = ny2;
      pz = nz2;
    }
    // The barb, forward over the back.
    box(quad, -legR * 1.4, py - legR * 1.4, pz, legR * 1.4, py + legR * 1.4, pz + sting * 0.16, 1, 0.8, 0.5);
  }

  return faces;
}
