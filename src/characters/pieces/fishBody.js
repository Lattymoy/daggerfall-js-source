// A FISH: a body that tapers to a tail, with fins instead of limbs.
//
// The last thing in ENEMY_BASICS the existing builders cannot say. A
// quadruped tapers nose to rump and stands on four legs; a fish tapers
// the same way and stands on NOTHING, and the difference is not a
// parameter — a leg length of zero leaves you with a barrel lying on the
// floor, not a fish.
//
// WHAT MAKES IT READ IS THE FINS, and a fin is a thin vertical sheet
// rather than a box: a tail fin is two triangles meeting at the spine, a
// dorsal is one standing on it. Boxes would give a submarine.
//
// IT ALSO SERVES A LAMIA, which is a woman to the waist and a fish
// below — the centaur's composition with a different animal on the back
// of it. So the tail can start anywhere along the body rather than at
// its own nose, which is what `from` is for.
//
// Built in FINAL (compressed) body space and tagged 'body'.

import { HSCALE } from './pieceLoft.js';

/** Cold scales: green-grey, and light enough to keep a silhouette. */
export const SCALE_RAMP = [
  [46, 60, 54],
  [70, 92, 82],
  [98, 124, 110],
  [128, 154, 138],
  [158, 182, 166],
  [188, 208, 194],
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

/**
 * @param {number[][]} ramp
 * @param {object} s
 *   len    — nose (or waist) to the fork of the tail
 *   girth  — how deep through the body at its thickest
 *   at     — height of the spine
 *   from   — where along the body it starts: 0 is its own nose, and a
 *            lamia hands it a waist instead
 *   fin    — tail fin size
 *   dorsal — dorsal fin height; 0 for none
 *   jaw    — 0 none, 1 a slaughterfish's
 */
export function buildFishBody(ramp = SCALE_RAMP, s = {}) {
  const { len = 0.9, girth = 0.14, at = 0.5, from = 0, fin = 0.16, dorsal = 0.1, jaw = 0 } = s;

  const faces = [];
  const quad = quadder(faces, ramp);
  const y = at * HSCALE;
  const z0 = from;

  // ── THE BODY ────────────────────────────────────────────────────
  // Rings down the length, each narrower than the last, joined as a
  // tube. A fish is a taper and nothing else — the moment it has a
  // constant section it is a pipe.
  const RINGS = 6;
  const ringAt = (i) => {
    const t = i / RINGS;
    // Fattest a third of the way back, then away to nothing.
    const w = girth * (0.45 + Math.sin((0.2 + t * 0.8) * Math.PI) * 0.75) * (1 - t * 0.72);
    return { z: z0 - len * t, w };
  };
  for (let i = 0; i < RINGS; i++) {
    const a = ringAt(i);
    const b = ringAt(i + 1);
    const shade = 0.92 - (i / RINGS) * 0.3;
    // Four sides, so the section is a diamond rather than a box: it
    // catches light along the flank the way a fish does.
    quad([0, y + a.w, a.z], [a.w, y, a.z], [b.w, y, b.z], [0, y + b.w, b.z], shade);
    quad([-a.w, y, a.z], [0, y + a.w, a.z], [0, y + b.w, b.z], [-b.w, y, b.z], shade * 0.82);
    quad([a.w, y, a.z], [0, y - a.w, a.z], [0, y - b.w, b.z], [b.w, y, b.z], shade * 0.5);
    quad([0, y - a.w, a.z], [-a.w, y, a.z], [-b.w, y, b.z], [0, y - b.w, b.z], shade * 0.44);
  }

  // ── THE TAIL FIN ────────────────────────────────────────────────
  // Two triangles off the fork, one up and one down. A thin sheet, not
  // a box: the whole point of a fin is that it has no thickness.
  const tz = z0 - len;
  for (const up of [1, -1]) {
    quad(
      [0, y, tz],
      [0, y + up * fin, tz - fin * 1.1],
      [0, y + up * fin * 0.25, tz - fin * 1.5],
      [0, y, tz],
      up > 0 ? 0.9 : 0.6,
    );
  }

  // ── THE DORSAL ──────────────────────────────────────────────────
  if (dorsal > 0) {
    const dz = z0 - len * 0.3;
    quad(
      [0, y + girth * 0.5, dz + len * 0.16],
      [0, y + girth * 0.5 + dorsal, dz],
      [0, y + girth * 0.5, dz - len * 0.2],
      [0, y + girth * 0.5, dz + len * 0.16],
      0.86,
    );
  }

  // ── THE JAW ─────────────────────────────────────────────────────
  // A slaughterfish is mostly teeth, and the gape is what says so.
  if (jaw > 0) {
    const jw = girth * 0.5 * jaw;
    quad(
      [0, y + jw * 0.2, z0],
      [jw, y - jw * 0.6, z0 + jw * 1.6],
      [-jw, y - jw * 0.6, z0 + jw * 1.6],
      [0, y + jw * 0.2, z0],
      1,
    );
    quad(
      [0, y - jw * 0.4, z0],
      [-jw, y - jw * 1.1, z0 + jw * 1.3],
      [jw, y - jw * 1.1, z0 + jw * 1.3],
      [0, y - jw * 0.4, z0],
      0.42,
    );
  }

  return faces;
}
