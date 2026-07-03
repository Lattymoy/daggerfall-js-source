// Vendored from project-final's Rewrite Engine (rewrite/rig/body.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json
// (captured from rewrite/rig at vendor time). Do not hand-diverge:
// upstream first, then re-vendor + re-capture.
// Shared limb rig. Holds the analytic 3D two-bone IK that every limb runs:
// the first-person legs today, and the third-person body's arms and legs later.
// One solver means a knee, an elbow, or a netcode-driven other-player's limb all
// bend with the same proven math.
import { P, clamp8 } from './palette.js';
import { tprism, rseg } from './geometry.js';
import { sub, add, mul, mad, cross, len, mix, norm } from './math.js';

// Solve a two-bone chain: root R to end target F, bone lengths l1 (root->joint)
// and l2 (joint->end). The joint swings toward `pole` (the side the elbow/knee
// bends to). The end is clamped to the chain's reach. Returns [joint, end].
function solveTwoBone(R, F, l1, l2, pole = [0, 0, 1]) {
  let dx = F[0] - R[0], dy = F[1] - R[1], dz = F[2] - R[2];
  let dl = Math.hypot(dx, dy, dz);
  if (dl < 1e-6) { dx = 0; dy = -1; dz = 0; dl = 1; } // degenerate target AT the root: a zero direction would collapse both bone lengths - default the reach DOWN (limbs hang) and let the fold clamp take it
  let d = dl;
  const dMax = l1 + l2 - 0.005, dMin = Math.abs(l1 - l2) + 0.005;
  if (d > dMax) d = dMax; else if (d < dMin) d = dMin;
  const ux = dx / dl, uy = dy / dl, uz = dz / dl;
  let px = pole[0], py = pole[1], pz = pole[2], dp = px * ux + py * uy + pz * uz;
  let ex = px - ux * dp, ey = py - uy * dp, ez = pz - uz * dp, el = Math.hypot(ex, ey, ez);
  if (el < 1e-3) { dp = -uy; ex = -ux * dp; ey = -1 - uy * dp; ez = -uz * dp; el = Math.hypot(ex, ey, ez) || 1e-4; } // pole parallel to bone: fall back to a stable perpendicular
  ex /= el; ey /= el; ez /= el;
  let cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  if (cosA > 1) cosA = 1; else if (cosA < -1) cosA = -1;
  const a = Math.acos(cosA), ca = Math.cos(a), sa = Math.sin(a);
  const joint = [R[0] + l1 * (ca * ux + sa * ex), R[1] + l1 * (ca * uy + sa * ey), R[2] + l1 * (ca * uz + sa * ez)];
  const end = [R[0] + ux * d, R[1] + uy * d, R[2] + uz * d];
  return [joint, end];
}

// The four skin tones scaled by a brightness multiplier. One ramp shared by the
// legs, the viewmodel hands/forearms, and (later) the third-person body, so every
// piece of skin matches.
function skinRamp(tone = 1.09) {
  const t = (c) => [clamp8(c[0] * tone), clamp8(c[1] * tone), clamp8(c[2] * tone)];
  return { SK: t(P.skin), SKL: t(P.skinL), SKM: t(P.skinM), SKD: t(P.skinD) };
}

// Detailed bare foot at ankle A, pitched about the ankle by `pitch` (toe-up = +):
// heel, instep, sole + forefoot, four small toes + big toe, two ankle bones. dims
// carries the leg's ankle height + foot length + skin ramp so it matches the leg.
function buildFoot(out, A, pitch, dims) {
  const { ankleH, footL, SK, SKL, SKM, SKD } = dims;
  const ax = A[0], ay = A[1], az = A[2];
  const c = Math.cos(pitch), s = Math.sin(pitch);
  const rot = (p) => [p[0], ay + (p[1] - ay) * c + (p[2] - az) * s, az - (p[1] - ay) * s + (p[2] - az) * c]; // ankle pitch
  const soleY = ay - ankleH;
  const heelZ = az - 0.085, ballZ = az + footL * 0.6, toeZ = az + footL;
  const inn = ax >= 0 ? -1 : 1; // medial (big-toe) side points toward the centerline
  rseg(out, rot([ax, ay - 0.005, az - 0.01]), rot([ax, soleY + 0.022, heelZ]), [1, 0, 0], 0.05, 0.052, 0.056, 0.046, 8, SK); // heel
  rseg(out, rot([ax, ay - 0.008, az]), rot([ax, soleY + 0.05, ballZ]), [1, 0, 0], 0.058, 0.05, 0.064, 0.034, 8, SK); // instep (top of foot)
  rseg(out, rot([ax, soleY + 0.014, heelZ + 0.02]), rot([ax, soleY + 0.01, ballZ]), [1, 0, 0], 0.06, 0.026, 0.074, 0.024, 8, SKD); // sole + forefoot (contact shadow)
  rseg(out, rot([ax - inn * 0.014, soleY + 0.02, ballZ]), rot([ax - inn * 0.02, soleY + 0.015, toeZ]), [1, 0, 0], 0.058, 0.022, 0.05, 0.018, 8, SKM); // four small toes
  rseg(out, rot([ax + inn * 0.048, soleY + 0.022, ballZ + 0.005]), rot([ax + inn * 0.052, soleY + 0.017, toeZ + 0.012]), [1, 0, 0], 0.028, 0.026, 0.024, 0.021, 7, SKM); // big toe
  rseg(out, rot([ax - 0.055, ay + 0.006, az]), rot([ax - 0.032, ay + 0.006, az]), [0, 0, 1], 0.018, 0.02, 0.018, 0.02, 6, SKL); // ankle bone (outer)
  rseg(out, rot([ax + 0.032, ay + 0.006, az]), rot([ax + 0.055, ay + 0.006, az]), [0, 0, 1], 0.018, 0.02, 0.018, 0.02, 6, SKL); // ankle bone (inner)
}

// A gripping hand built from an options bag `o` (axis, fwd, wrist, wrapSign, size,
// curl, spreads, handedness, skin colors). Self-contained; the viewmodel and the
// third-person body both pose it by filling `o`.
function hand(out, o) {
  const a = norm(o.axis); // fingers spread along this
  let w = norm(cross(a, norm(o.fwd)));
  if (o.wrapSign < 0) w = mul(w, -1);
  const f = norm(cross(w, a)); // clean forward (perp to axis + wrap)
  const s = o.size || 1;
  const cl = (o.curl == null ? 0.85 : o.curl) * (o.curlMul == null ? 1 : o.curlMul);
  const fSpr = o.fingerSpread == null ? 1 : o.fingerSpread; // splay of the 4 fingers
  const fLenM = o.fingerLen == null ? 1 : o.fingerLen; // overall finger length
  const tCl = (o.curl == null ? 0.85 : o.curl) * (o.thumbCurl == null ? 1 : o.thumbCurl); // thumb curl, independent
  const tSpr = o.thumbSpread == null ? 1 : o.thumbSpread; // how far the thumb sits out
  const ch = o.mirror ? -1 : 1; // handedness: flips thumb side + finger order
  const skin = o.color;
  const skinL = o.colorL || skin;
  const skinM = o.colorM || mix(skin, skinL, 0.5); // fingertip mid
  const skinD = o.colorD || mix(skin, [0, 0, 0], 0.3); // occlusion / shadow

  // ── hand mass: one rounded prism wrist -> knuckles (absorbs the heel),
  //    oval section (wide along a, thin along w), widening toward knuckles ──
  tprism(out, mad(o.wrist, f, -0.1 * s), mad(o.wrist, f, 0.4 * s), a, w, 0.225 * s, 0.125 * s, 0.265 * s, 0.135 * s, 10, skin);
  // thenar bulge: thumb-side muscle, rounded so it blends into the palm
  tprism(out, add(mad(o.wrist, f, 0.0 * s), mul(a, ch * 0.16 * s)), add(mad(o.wrist, f, 0.26 * s), mul(a, ch * 0.18 * s)), a, w, 0.085 * s, 0.1 * s, 0.06 * s, 0.085 * s, 8, skin);

  // ── knuckle ridge: rounded band along the knuckle line (bright) ──
  const kn = add(mad(o.wrist, f, 0.42 * s), mul(w, 0.03 * s));
  tprism(out, add(kn, mul(a, -0.25 * s)), add(kn, mul(a, 0.25 * s)), f, w, 0.06 * s, 0.05 * s, 0.06 * s, 0.05 * s, 8, skinL);

  // ── 4 fingers: 3 rounded phalanges, progressive curl, PIP knuckle bumps ──
  const fLen = [0.95, 1.0, 0.93, 0.78]; // index, middle, ring, pinky
  const fWid = [1.0, 1.0, 0.94, 0.82];
  for (let i = 0; i < 4; i++) {
    const off = (-0.225 + i * 0.15) * ch * fSpr * s;
    const L = fLen[i] * fLenM,
      FW = fWid[i];
    const root = add(add(kn, mul(a, off)), mul(f, 0.02 * s));
    const pf = norm(mad(f, w, 0.5 * cl)); // proximal
    const pEnd = mad(root, pf, 0.27 * s * L);
    rseg(out, root, pEnd, a, 0.05 * s * FW, 0.062 * s, 0.046 * s * FW, 0.057 * s, 6, skin);
    const mf = norm(mad(pf, w, 0.9 * cl)); // middle
    const mEnd = mad(pEnd, mf, 0.2 * s * L);
    rseg(out, pEnd, mEnd, a, 0.046 * s * FW, 0.057 * s, 0.042 * s * FW, 0.052 * s, 6, skin);
    // PIP knuckle bump (rounded, sits at the proximal/middle joint)
    rseg(out, mad(pEnd, pf, -0.02 * s), mad(pEnd, mf, 0.02 * s), a, 0.05 * s * FW, 0.058 * s, 0.05 * s * FW, 0.058 * s, 6, skinL);
    const df = norm(mad(mf, w, 1.15 * cl)); // distal (tip tone)
    const dEnd = mad(mEnd, df, 0.16 * s * L);
    rseg(out, mEnd, dEnd, a, 0.042 * s * FW, 0.052 * s, 0.032 * s * FW, 0.043 * s, 6, skinM);
  }

  // ── thumb: 3 rounded segments; spread seats it laterally, curl wraps it ──
  const tBase = add(add(mad(o.wrist, f, 0.08 * s), mul(a, ch * (0.1 + 0.16 * tSpr) * s)), mul(w, 0.0 * s));
  const tf0 = norm(add(add(mul(f, 0.55), mul(a, ch * -0.05 * tSpr)), mul(w, 0.5))); // metacarpal up+fwd
  const t0e = mad(tBase, tf0, 0.2 * s);
  rseg(out, tBase, t0e, w, 0.085 * s, 0.095 * s, 0.072 * s, 0.082 * s, 7, skin);
  const tf = norm(add(add(mul(f, 0.5), mul(a, ch * -0.1)), mul(w, 0.85 * tCl))); // proximal curls in
  const t1e = mad(t0e, tf, 0.17 * s);
  rseg(out, t0e, t1e, w, 0.072 * s, 0.082 * s, 0.062 * s, 0.07 * s, 7, skin);
  const tf2 = norm(add(tf, mul(w, 0.7 * tCl))); // distal (tip tone)
  const t2e = mad(t1e, tf2, 0.12 * s);
  rseg(out, t1e, t2e, w, 0.062 * s, 0.07 * s, 0.048 * s, 0.056 * s, 7, skinM);
}

// A bare forearm: rounded, tapered skin from the (off-frame) elbow into the
// wrist, with a faint crease where the hand takes over.
function forearm(out, elbow, wrist, rWide, rThin, skin, skinD) {
  const dir = norm(sub(wrist, elbow));
  let U = cross([0, 1, 0], dir);
  if (len(U) < 1e-4) U = cross([1, 0, 0], dir);
  U = norm(U);
  const Vv = norm(cross(dir, U));
  const wristP = mad(wrist, dir, -0.06);
  // rounded, tapered bare forearm (10-gon, oval section flatter top/bottom)
  tprism(out, elbow, wristP, U, Vv, rWide, rWide * 0.88, rThin, rThin * 0.88, 10, skin);
  // wrist crease: a thin slightly-pinched darker ring at the hand junction
  tprism(out, mad(wristP, dir, -0.02), mad(wristP, dir, 0.05), U, Vv, rThin * 1.02, rThin * 0.9, rThin * 0.96, rThin * 0.84, 10, skinD);
}

export { solveTwoBone, skinRamp, buildFoot, hand, forearm };
