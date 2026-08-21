// ═══════════════════════════════════════════════════════════════════
// THE BEAST BODY
//
// A quadruped, built to a spec. Head, neck, barrel, four legs, tail —
// and the proportions between them are the whole difference between a
// rat and a bear, so they are parameters rather than three files.
//
// WHY THIS IS NOT THE CENTAUR'S HORSE. That piece is a horse HALF: it
// has no head and no neck, because the human rig supplies both and the
// animal starts at the withers. An animal has to bring its own
// everything, and the human rig has to get out of the way completely —
// which the centaur's collapse mechanism already does, now applied to
// every group rather than the legs.
//
// ONE BUILDER, SEVERAL ANIMALS. A rat is long and low with a pointed
// head and a bare tail; a bear is a mountain on short legs; a tiger is
// the same length as the bear on longer ones and carries its head lower.
// Those are numbers, not geometry, and the moment they are numbers the
// next quadruped costs a design rather than a file. Which is the same
// bet the class file made and won.
//
// Built in FINAL (compressed) body space and tagged 'body', so the whole
// animal rides the rig's torso through a swing rather than staying put
// while it turns.

import { HSCALE } from './pieceLoft.js';

/** A brown coat. Each design overrides it; this is the fallback. */
export const PELT_RAMP = [
  [38, 30, 22],
  [62, 50, 36],
  [88, 72, 52],
  [116, 96, 70],
  [146, 122, 92],
  [176, 150, 116],
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

/** A box between two corners: six faces, lit brightest on top. */
function box(quad, x0, y0, z0, x1, y1, z1, top = 0.95, side = 0.66, under = 0.3) {
  quad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], side);
  quad([x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], side * 0.7);
  quad([x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], side * 0.85);
  quad([x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], side * 0.85);
  quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top);
  quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], under);
}

/**
 * @param {number[][]} ramp coat colours, dark -> light
 * @param {object} s the animal, in numbers
 *   back    — height of the spine off the ground
 *   len     — nose to rump
 *   girth   — how wide through the ribs
 *   legs    — leg thickness
 *   crouch  — 0 stands tall, 1 slings the belly low (a rat, a lizard)
 *   head    — head size relative to the body
 *   snout   — how far the muzzle runs forward
 *   tail    — length; 0 for none
 *   tailUp  — 0 drags, 1 carried high
 */
export function buildBeastBody(ramp = PELT_RAMP, s = {}) {
  const {
    back = 0.62,
    len = 0.9,
    girth = 0.17,
    legs = 0.05,
    crouch = 0.3,
    head = 0.12,
    snout = 0.1,
    tail = 0.3,
    tailUp = 0.3,
  } = s;

  const faces = [];
  const quad = quadder(faces, ramp);

  const spine = back * HSCALE;
  const belly = spine - girth * (1.5 - crouch * 0.5);
  const half = len / 2;

  // ── THE BARREL ──────────────────────────────────────────────────
  // Three segments: deepest at the shoulder, drawing in at the haunch.
  // A single box is a crate on legs, which is the same mistake the
  // centaur's horse taught.
  for (const [z0, z1, f] of [
    [half * 0.55, half * 0.05, 0.86],
    [half * 0.1, -half * 0.45, 1.0],
    [-half * 0.4, -half, 0.84],
  ]) {
    box(quad, -girth * f, belly, z1, girth * f, spine, z0);
  }

  // ── NECK AND HEAD ───────────────────────────────────────────────
  // The neck runs forward and slightly up from the shoulder; the head
  // sits on the end of it and the snout runs on from that. A head stuck
  // straight onto the barrel reads as a bus.
  const neckZ = half * 0.55;
  const headZ = neckZ + head * 1.4;
  const headY = spine - girth * 0.15 + head * 0.2;
  const nw = girth * 0.42;
  box(quad, -nw, spine - girth * 0.7, neckZ, nw, spine + head * 0.1, headZ - head * 0.5, 0.9, 0.62);
  box(quad, -head, headY - head, headZ - head * 0.7, head, headY + head * 0.6, headZ + head * 0.5, 0.95, 0.66);
  if (snout > 0) {
    const sw = head * 0.5;
    box(
      quad,
      -sw,
      headY - head * 0.75,
      headZ + head * 0.4,
      sw,
      headY + head * 0.05,
      headZ + head * 0.4 + snout,
      0.85,
      0.58,
    );
  }

  // ── FOUR LEGS ───────────────────────────────────────────────────
  // Fore pair under the shoulder, hind under the haunch, and thinner
  // than the barrel by a long way: that contrast is what makes a body
  // read as a body rather than a block.
  for (const [side, z] of [
    [-1, half * 0.4],
    [1, half * 0.4],
    [-1, -half * 0.6],
    [1, -half * 0.6],
  ]) {
    const x = side * girth * 0.66;
    box(quad, x - legs, 0.02 * HSCALE, z - legs, x + legs, belly + 0.02, z + legs, 0.7, 0.6, 0.35);
    // A paw, wider than the leg, or the animal stands on pins.
    box(
      quad,
      x - legs * 1.5,
      0,
      z - legs * 1.4,
      x + legs * 1.5,
      0.03 * HSCALE,
      z + legs * 1.8,
      0.4,
      0.34,
      0.24,
    );
  }

  // ── THE TAIL ────────────────────────────────────────────────────
  if (tail > 0) {
    const tw = girth * 0.16;
    const y0 = belly + (spine - belly) * (0.4 + tailUp * 0.5);
    box(quad, -tw, y0 - tw, -half - tail, tw, y0 + tw, -half + 0.02, 0.6, 0.5, 0.3);
  }

  return faces;
}

/**
 * A TAIL ON ITS OWN, for a body that is otherwise human.
 *
 * The first cut of this reused buildBeastBody with everything but the
 * tail set near zero — which still built a barrel, a head and four legs
 * to get one appendage: 84 faces for something that needs six, and all
 * of them somewhere behind the wearer's knees.
 *
 * Tagged 'body' so it rides the hips rather than the skull.
 *
 * @param {number[][]} ramp
 * @param {{len?:number, up?:number, thick?:number, at?:number}} s
 *   at — height of the root, in the rig's own (uncompressed) units
 */
// NAMED beastTail, NOT buildTail. pieces/tail.js already exports a
// buildTail — the Khajiit and Argonian tails, which are part of a race
// rather than a piece bolted onto one — and two of that name in the
// payload is a SyntaxError that takes the whole module down.
export function buildBeastTail(ramp = PELT_RAMP, s = {}) {
  const { len = 0.3, up = 0.3, thick = 0.03, at = 0.98 } = s;
  const faces = [];
  const quad = quadder(faces, ramp);
  const y = at * HSCALE;
  // Two segments, the second thinner and lower: a tail that is one box
  // is a plank, and a tail that does not droop is a broom handle.
  const drop = (1 - up) * len * 0.5;
  box(quad, -thick, y - thick, -len * 0.55, thick, y + thick, -0.01, 0.7, 0.55, 0.34);
  box(
    quad,
    -thick * 0.7,
    y - thick * 0.7 - drop,
    -len,
    thick * 0.7,
    y + thick * 0.7 - drop,
    -len * 0.5,
    0.62,
    0.48,
    0.3,
  );
  return faces;
}
