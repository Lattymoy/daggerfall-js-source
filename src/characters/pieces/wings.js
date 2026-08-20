// WINGS.
//
// The last body plan in the game that nothing else can express. A
// quadruped is a spine with legs, an arachnid is a ring of them, and a
// werebeast is a man with the wrong head — all of them things that
// stand on the ground. `behaviour: Flying` is the one category in
// ENEMY_BASICS that is neither foot nor fin, and it needs a surface
// rather than a limb.
//
// A WING IS A MEMBRANE ON FINGERS. That is the whole of it, and it is
// why a wing cannot be built out of the boxes everything else here is
// made of: what the eye reads is the SHEET between the bones, not the
// bones. So this is panels — a fan of triangular quads running from a
// shoulder root out to a row of tips — and the fingers are drawn on top
// as thin ribs rather than being the structure.
//
// FOLD IS A PARAMETER, NOT A POSE. A bat at rest is wrapped in its own
// wings and a bat in flight is twice as wide as it is long, and the
// difference is one number rather than two pieces. It also means the
// same wing serves an imp, which is a small man who happens to have a
// pair, at a fold nothing like a bat's.
//
// Built in FINAL (compressed) body space and tagged 'body', so the wings
// ride the torso rather than staying put while it turns.

import { HSCALE } from './pieceLoft.js';

/** Membrane: darker than fur and warmer than chitin, and thin enough
 *  that light is behind it as often as on it. */
export const MEMBRANE_RAMP = [
  [52, 36, 34],
  [80, 56, 50],
  [110, 78, 68],
  [140, 104, 90],
  [170, 132, 114],
  [198, 162, 142],
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
 *   span   — how far each wing reaches from the shoulder
 *   at     — shoulder height, in the rig's own (uncompressed) units
 *   fold   — 0 spread wide, 1 wrapped in against the body
 *   fingers— how many ribs the membrane hangs on
 *   droop  — how far the tips fall below the shoulder line
 *   rib    — rib thickness
 */
export function buildWings(ramp = MEMBRANE_RAMP, s = {}) {
  const { span = 0.55, at = 1.34, fold = 0.2, fingers = 4, droop = 0.24, rib = 0.012 } = s;

  const faces = [];
  const quad = quadder(faces, ramp);
  const y0 = at * HSCALE;

  for (const side of [-1, 1]) {
    const rootX = side * 0.1;
    const rootZ = -0.02;

    // The tips, fanned from forward-and-out to back-and-in. Folding
    // swings the whole fan backwards and pulls it in against the body,
    // which is what a wrapped bat actually does — it does not shrink its
    // wings, it puts them behind itself.
    const tip = [];
    for (let i = 0; i <= fingers; i++) {
      const t = i / fingers;
      const spread = (1 - fold) * (0.95 - t * 0.5) + fold * 0.12;
      const backness = t * 0.9 + fold * 0.8;
      const x = rootX + side * span * spread;
      const z = rootZ - span * backness * 0.75;
      const y = y0 - droop * (t * 0.7 + 0.15) * (1 - fold * 0.5);
      tip.push([x, y, z]);
    }

    // THE MEMBRANE, panel by panel between neighbouring tips. Each panel
    // is a quad from the root to two tips — it is a sheet, so it has no
    // thickness and is drawn from both sides by the double-sided
    // material the rest of the rig uses.
    for (let i = 0; i < fingers; i++) {
      const a = tip[i];
      const b = tip[i + 1];
      // Shade darkens along the wing: the far end is thinner and further
      // from any light, and a flat membrane reads as cardboard.
      const shade = 0.86 - (i / fingers) * 0.36;
      quad([rootX, y0, rootZ], a, b, [rootX, y0, rootZ], shade);
      // The same panel a shade darker at its trailing edge, so the sheet
      // has a gradient across it rather than a flat tone.
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - droop * 0.12, (a[2] + b[2]) / 2];
      quad(a, mid, b, a, shade * 0.72);
    }

    // THE FINGERS, drawn on top as thin ribs. They are not the
    // structure — the membrane is — but without them a wing is a flag.
    for (const t of tip) {
      const dx = t[0] - rootX;
      const dy = t[1] - y0;
      const dz = t[2] - rootZ;
      const L = Math.hypot(dx, dz) || 1e-6;
      const px = (-dz / L) * rib;
      const pz = (dx / L) * rib;
      quad(
        [rootX - px, y0 + rib, rootZ - pz],
        [rootX + px, y0 + rib, rootZ + pz],
        [rootX + dx + px, y0 + dy + rib, rootZ + dz + pz],
        [rootX + dx - px, y0 + dy + rib, rootZ + dz - pz],
        0.95,
      );
    }
  }

  return faces;
}
