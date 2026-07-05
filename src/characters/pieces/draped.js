// Draped garments - standoff cloth that HANGS off the body (skirts,
// robes, cloaks, dresses, surcoats, togas, sashes, wraps, mummy wraps).
// Unlike body-hugging clothing (displacement), these are separate meshes
// that flare/drape outside the silhouette. Tagged 'body' so they move
// with the torso. Anchored to the measured body profile: waist ~y0.98
// (rx~0.17, rz~0.115), shoulders ~y1.52 (back z~-0.09).
import { shadePiece } from './pieceLoft.js';

const B = 'body', P = 0.85;

// Body-core half-extents (torso+legs, NO arms), measured from the rig.
// Drapes are clamped OUTSIDE this + a cloth standoff so they never clip.
export const BODY_CORE = [[1.55,0.072,0.084],[1.50,0.205,0.090],[1.45,0.215,0.088],[1.40,0.215,0.096],[1.30,0.208,0.098],[1.20,0.182,0.092],[1.05,0.160,0.082],[0.95,0.168,0.088],[0.90,0.178,0.100],[0.85,0.202,0.120],[0.80,0.202,0.120],[0.75,0.194,0.114],[0.65,0.178,0.100],[0.55,0.168,0.090],[0.50,0.154,0.080],[0.45,0.158,0.088],[0.40,0.152,0.072],[0.30,0.166,0.088],[0.20,0.142,0.063],[0.10,0.137,0.050]];
const STANDOFF = 0.038;
export function coreHalfExtents(y) {
  if (y >= BODY_CORE[0][0]) return [BODY_CORE[0][1], BODY_CORE[0][2]];
  if (y <= BODY_CORE[BODY_CORE.length-1][0]) { const l = BODY_CORE[BODY_CORE.length-1]; return [l[1], l[2]]; }
  for (let i = 0; i+1 < BODY_CORE.length; i++) { const a = BODY_CORE[i], b = BODY_CORE[i+1]; if (y <= a[0] && y >= b[0]) { const t = (y-a[0])/(b[0]-a[0]); return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; } }
  return [0.2, 0.1];
}
// clamp a ring's rx/rz to sit outside the body core at height y
function clip(y, rx, rz) { const [cx, cz] = coreHalfExtents(y); return [Math.max(rx, cx + STANDOFF), Math.max(rz, cz + STANDOFF)]; }







// Garment name -> builder. Robes/kimono are tall near-columnar flares;
// dresses start at the chest; skirts at the waist; mummy = full wrap.


// ---- Simulatable GRIDS: rows of ring points -> a pinned cloth mesh ----
function flareRows(topY, hemY, tRx, tRz, hRx, hRz) {
  const rows = [];
  const steps = Math.max(6, Math.min(24, Math.round((topY - hemY) / 0.055)));  // ~constant ring spacing
  for (let k = 0; k <= steps; k++) { const t = k/steps, y = topY - t*(topY-hemY), e = t*t; const [rx, rz] = clip(y, tRx + e*(hRx-tRx), tRz + e*(hRz-tRz)); rows.push({ y, rx, rz }); }
  return rows;
}
function capeRows(hemY, wide) {
  const rows = [], neckY = 1.500, W = wide ? 1.16 : 1.0;
  const steps = Math.max(6, Math.min(24, Math.round((neckY - hemY) / 0.055)));
  for (let k = 0; k <= steps; k++) { const t = k/steps, y = neckY - t*(neckY-hemY), grow = Math.pow(t, 0.85); const [rx, rz] = clip(y, (0.088 + grow*0.230)*W, (0.100 + grow*0.185)*W); rows.push({ y, rx, rz }); }
  return rows;
}
const CAPE_ARC = [Math.PI/2 + 1.25, Math.PI/2 - 1.25 + Math.PI*2];
const GRIDSPEC = {
  'Short Skirt':     { rows: flareRows(0.980, 0.560, 0.175, 0.115, 0.270, 0.190), wrap: true, seg: 24 },
  'Long Skirt':      { rows: flareRows(0.980, 0.130, 0.175, 0.115, 0.320, 0.220), wrap: true, seg: 24 },
  'Casual Dress':    { rows: flareRows(1.320, 0.180, 0.150, 0.110, 0.320, 0.220), wrap: true, seg: 24 },
  'Strapless Dress': { rows: flareRows(1.300, 0.200, 0.150, 0.110, 0.310, 0.215), wrap: true, seg: 24 },
  'Plain Robes':     { rows: flareRows(1.545, 0.120, 0.160, 0.120, 0.300, 0.210), wrap: true, seg: 26 },
  'Priest Robes':    { rows: flareRows(1.545, 0.110, 0.165, 0.125, 0.315, 0.220), wrap: true, seg: 26 },
  'Priestess Robes': { rows: flareRows(1.545, 0.110, 0.165, 0.125, 0.315, 0.220), wrap: true, seg: 26 },
  'Kimono':          { rows: flareRows(1.520, 0.220, 0.175, 0.135, 0.290, 0.220), wrap: true, seg: 26 },
  'Mummy Wrappings': { rows: flareRows(1.560, 0.060, 0.155, 0.120, 0.190, 0.150), wrap: true, seg: 22 },
  'Casual Cloak':    { rows: capeRows(0.450, false), wrap: false, seg: 26, arc: CAPE_ARC },
  'Formal Cloak':    { rows: capeRows(0.360, true),  wrap: false, seg: 26, arc: CAPE_ARC },
  // one-shoulder diagonal wrap: an arc covering ~270deg, open on one side
  'Toga':            { rows: flareRows(1.520, 0.330, 0.150, 0.115, 0.255, 0.190), wrap: false, seg: 24, arc: [Math.PI*0.12, Math.PI*0.12 + Math.PI*1.5] },
  // sleeveless over-tunics to mid-thigh
  'Dwynnen Surcoat': { rows: flareRows(1.500, 0.600, 0.150, 0.125, 0.205, 0.170), wrap: true, seg: 24 },
  'Anticlere Surcoat': { rows: flareRows(1.500, 0.560, 0.150, 0.125, 0.208, 0.172), wrap: true, seg: 24 },
};

// ---- Strip garments: a ribbon of cloth along a centreline path -----
// Builds a (rows x cols) grid by sweeping a width across each path point,
// perpendicular to the path and tangent to the body surface. Supports an
// explicit pin mask (which rows are fixed to the body). These give the
// detailed, asymmetric drapes (scarves, sashes) the ring grids can't.
function stripGrid(center, halfW, cols, pinRows) {
  const R = center.length, pos = new Float32Array(R * cols * 3);
  for (let r = 0; r < R; r++) {
    const a = center[Math.max(0, r-1)], b = center[Math.min(R-1, r+1)], p = center[r];
    let tx=b[0]-a[0], ty=b[1]-a[1], tz=b[2]-a[2]; const tl=Math.hypot(tx,ty,tz)||1; tx/=tl; ty/=tl; tz/=tl;
    let rx=p[0], rz=p[2]; let rl=Math.hypot(rx,rz); if (rl < 0.02) { rx=0; rz=1; rl=1; } rx/=rl; rz/=rl;   // radial (out from the body axis)
    let px=ty*rz - tz*0, py=tz*rx - tx*rz, pz=tx*0 - ty*rx; const pl=Math.hypot(px,py,pz)||1; px/=pl; py/=pl; pz/=pl;  // width dir = tangent x radial
    const hw = Array.isArray(halfW) ? halfW[r] : halfW;
    for (let c = 0; c < cols; c++) { const u = (c/(cols-1) - 0.5) * 2 * hw, i = (r*cols+c)*3;
      pos[i] = p[0] + px*u; pos[i+1] = p[1] + py*u; pos[i+2] = p[2] + pz*u; }
  }
  const faces = [];
  for (let r = 0; r+1 < R; r++) for (let c = 0; c+1 < cols; c++) faces.push([r*cols+c, r*cols+c+1, (r+1)*cols+c+1, (r+1)*cols+c]);
  const pin = new Uint8Array(R * cols);
  for (const r of pinRows) for (let c = 0; c < cols; c++) pin[r*cols + c] = 1;
  return { rows: R, cols, wrap: false, pos, faces, pin };
}

// Wrap: a scarf draped over the back of the neck + both shoulders, with the
// two ends hanging down the front as tails. Pinned across the shoulders/nape.
function wrapGrid() {
  const c = [
    [-0.11, 0.86, 0.145], [-0.13, 1.02, 0.140], [-0.155, 1.20, 0.120], [-0.170, 1.40, 0.075], // L front tail -> L shoulder
    [-0.135, 1.520, -0.03], [-0.055, 1.545, -0.100], [0.055, 1.545, -0.100], [0.135, 1.520, -0.03], // over shoulders + nape (pinned)
    [0.170, 1.40, 0.075], [0.155, 1.20, 0.120], [0.13, 1.02, 0.140], [0.11, 0.86, 0.145], // R shoulder -> R front tail
  ];
  const hw = [0.052,0.058,0.066,0.072, 0.086,0.092,0.092,0.086, 0.072,0.066,0.058,0.052];
  return stripGrid(c, hw, 5, [4,5,6,7]);
}

// Sash: a wide band from the right shoulder diagonally across the chest to a
// knot at the left hip, then a tapering tail hanging free below the knot.
function sashGrid() {
  const c = [
    [0.155, 1.500, 0.095], [0.100, 1.380, 0.115], [0.030, 1.250, 0.120], [-0.045, 1.120, 0.115], // R shoulder -> chest
    [-0.110, 0.980, 0.100], [-0.150, 0.865, 0.130], // L waist -> hip knot (pinned ends: 0 and 5)
    [-0.170, 0.720, 0.110], [-0.170, 0.580, 0.085], [-0.155, 0.440, 0.060], // tail (free)
  ];
  const hw = [0.050,0.052,0.054,0.052, 0.050,0.064, 0.046,0.038,0.030];
  return stripGrid(c, hw, 4, [0, 5]);
}

/** Cloth grid for a garment: pinned top row (row 0), ring rows down to
 *  the hem. { rows, cols, wrap, pos (rows*cols*3), faces (quad indices) }.
 *  null for garments with no flowing grid (surcoat/toga/sash/wrap). */
export function drapedGrid(name) {
  if (name === 'Wrap') return wrapGrid();
  if (name === 'Sash') return sashGrid();
  const spec = GRIDSPEC[name];
  if (!spec) return null;
  const { rows, wrap, seg, arc } = spec, R = rows.length, cols = wrap ? seg : seg + 1;
  const pos = new Float32Array(R * cols * 3);
  const a0 = arc ? arc[0] : 0, a1 = arc ? arc[1] : Math.PI*2;
  for (let r = 0; r < R; r++) { const { y, rx, rz } = rows[r];
    for (let c = 0; c < cols; c++) { const t = wrap ? c/seg : c/(cols-1), a = a0 + (a1-a0)*t, i = (r*cols+c)*3;
      pos[i] = Math.cos(a)*rx; pos[i+1] = y; pos[i+2] = Math.sin(a)*rz; } }
  const faces = [];
  for (let r = 0; r+1 < R; r++) for (let c = 0; c < (wrap ? cols : cols-1); c++) {
    const c2 = (c+1) % cols; faces.push([r*cols+c, r*cols+c2, (r+1)*cols+c2, (r+1)*cols+c]);
  }
  return { rows: R, cols, wrap, pos, faces };
}
function facesFromGrid(g) {
  const f = []; const P = (k) => [g.pos[k*3], g.pos[k*3+1], g.pos[k*3+2]];
  for (const [a, b, c, d] of g.faces) quadInto(f, P(a), P(b), P(c), P(d));
  return f;
}

export const DRAPED_NAMES = [...Object.keys(GRIDSPEC), 'Wrap', 'Sash'];

/** Standoff faces for a draped garment name, shaded with `ramp`. [] if not draped. */
export function drapedPiece(name, ramp) {
  const g = drapedGrid(name);
  return g ? shadePiece(facesFromGrid(g), ramp) : [];
}
