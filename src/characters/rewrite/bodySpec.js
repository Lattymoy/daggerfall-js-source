// Vendored from project-final's Rewrite Engine (rewrite/rig/bodySpec.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json
// (captured from rewrite/rig at vendor time). Do not hand-diverge:
// upstream first, then re-vendor + re-capture.
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
  leg: { thigh: 0.51, calf: 0.415 },
};

/** Torso half-extents at height y (piecewise through the trunk prisms). */
export function torsoProfile(spec, y) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (y0, y1, rx0, rz0, rx1, rz1) => {
    const t = (y - y0) / (y1 - y0);
    return { rx: lerp(rx0, rx1, t), rz: lerp(rz0, rz1, t) };
  };
  const c = spec.chest, u = spec.upperChest, pv = spec.pelvis;
  if (y >= c.y1) return seg(c.y1, u.y1, c.rx1, c.rz1, u.rx1, u.rz1);
  if (y >= c.y0) return seg(c.y0, c.y1, c.rx0, c.rz0, c.rx1, c.rz1);
  return seg(pv.y0, pv.y1, pv.rx0, pv.rz0, pv.rx1, pv.rz1);
}

