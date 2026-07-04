// Vendored from project-final's Rewrite Engine (rewrite/rig/bodySpec.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json.
// Do not hand-diverge: upstream first, then re-vendor + re-capture.
// ── body spec (proportion seam) ──────────────────────────────────────
// Trunk prisms, limb anchors, and bone spans as DATA - the solver and
// assembly are shared; a consumer supplies its own proportions (e.g. a
// spec extracted from Daggerfall's PAPERDOL body) and every piece of
// the body + everything seated on it reads the same numbers. Voxlight's
// spec is the previous literals verbatim - the 78-case parity fixture
// holds byte-identical. Head stays literal in v1 (not outfit-seated);
// the seam extends when a consumer needs it.
export const VOXLIGHT_SPEC = {
  pelvis: { y0: 0.84, y1: 1.0, rx0: 0.195, rz0: 0.1176, rx1: 0.23, rz1: 0.1323 },
  chest: { y0: 0.92, y1: 1.4, rx0: 0.2125, rz0: 0.125, rx1: 0.25, rz1: 0.1903 },
  upperChest: { y1: 1.52, rx1: 0.33, rz1: 0.174 },
  neck: { y0: 1.45, z0: 0.011, y1: 1.63, z1: 0.014, rx0: 0.115, rz0: 0.098, rx1: 0.072, rz1: 0.072 },
  deltoid: { x0: 0.17, y0: 1.545, x1: 0.24, y1: 1.45, rU0: 0.0738, rV0: 0.09, rU1: 0.0801, rV1: 0.0945 },
  hipX: 0.14,
  pelvisY: 0.98,
  leg: { thigh: 0.51, calf: 0.415, thighR: 1, calfR: 1 },
  // v2 (full-body seam): every remaining proportion, optional - a
  // consumer omitting a field gets the engine literal (parity holds).
  head: { scale: 1.24, lift: -0.065 },
  arm: { shoulderX: 0.235, shoulderY: 1.5, upper: 0.385, fore: 0.335, r: 1 },
  handScale: 1,
  foot: { ankleH: 0.06, footL: 0.18 },
  // torsoRows: [{ y, rx, rz }, ...] - when present, the trunk lofts
  // through these measured rows instead of the three fixed prisms.
  // hairRows: [{ y, rx, rz }, ...] - when present, a head/hair/traps
  // mass lofts over the shoulders (centred slightly back so the face
  // prisms emerge in front); replaces the neck prism.
};

/** Torso half-extents at height y (piecewise through the trunk prisms). */
export function torsoProfile(spec, y) {
  const lerp = (a, b, t) => a + (b - a) * t;
  // Measured-loft consumers get the SAME numbers the trunk builds
  // from - piecewise through torsoRows when present.
  if (spec.torsoRows) {
    const R = spec.torsoRows;
    if (y <= R[0].y) return { rx: R[0].rx, rz: R[0].rz };
    for (let i = 0; i + 1 < R.length; i++) {
      if (y <= R[i + 1].y) {
        const t = (y - R[i].y) / (R[i + 1].y - R[i].y);
        return { rx: lerp(R[i].rx, R[i + 1].rx, t), rz: lerp(R[i].rz, R[i + 1].rz, t) };
      }
    }
    return { rx: R[R.length - 1].rx, rz: R[R.length - 1].rz };
  }
  const seg = (y0, y1, rx0, rz0, rx1, rz1) => {
    const t = (y - y0) / (y1 - y0);
    return { rx: lerp(rx0, rx1, t), rz: lerp(rz0, rz1, t) };
  };
  const c = spec.chest, u = spec.upperChest, pv = spec.pelvis;
  if (y >= c.y1) return seg(c.y1, u.y1, c.rx1, c.rz1, u.rx1, u.rz1);
  if (y >= c.y0) return seg(c.y0, c.y1, c.rx0, c.rz0, c.rx1, c.rz1);
  return seg(pv.y0, pv.y1, pv.rx0, pv.rz0, pv.rx1, pv.rz1);
}


/** Loft consecutive prisms through measured torso rows (y ascending;
 * rest-shape symmetric - the paperdoll stance supplies the lean). */
export function loftTorso(out, tprism, X, Z, rows, col) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1];
    // Disjoint intervals do not bridge: at a split<->merged transition
    // the traced interval jumps sideways, and a bridging prism would
    // poke across the real gap between parts.
    if (b.brk || Math.abs((b.cx ?? 0) - (a.cx ?? 0)) > a.rx + b.rx) continue; // brk: the emitter marks transitions that must not bridge
    tprism(out, [a.cx ?? 0, a.y, a.cz ?? 0], [b.cx ?? 0, b.y, b.cz ?? 0], X, Z,
      a.rx, a.rz, b.rx, b.rz, 12, col);
  }
}

/** Loft a left/right pair of measured row traces (arms, and any other
 * paired parts): { neg, pos } keyed by x sign. */
export function loftPair(out, tprism, X, Z, pair, col, overlay) {
  loftTorso(out, tprism, X, Z, pair.neg, col);
  loftTorso(out, tprism, X, Z, pair.pos, col);
  if (overlay) loftTorso(out, tprism, X, Z, overlay, col); // additive extra trace (e.g. the tucked-hand overlay - a subset of the sprite run)
}
