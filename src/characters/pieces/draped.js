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

function quadInto(faces, a, b, c, d, g = B) {
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
  let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const L=Math.hypot(nx,ny,nz)||1;
  faces.push({ p:[...a,...b,...c,...d], n:[nx/L,ny/L,nz/L], g });
}





// Sash: a thin diagonal band shoulder-to-hip.
function sash(faces) {
  const w = 0.028;
  const a=[-0.140,1.520,0.030], b=[0.150,1.010,0.060];
  const dir=[b[0]-a[0],b[1]-a[1],b[2]-a[2]]; const n=[0,0,1];
  const off=[dir[1]*n[2]-dir[2]*n[1], dir[2]*n[0]-dir[0]*n[2], dir[0]*n[1]-dir[1]*n[0]];
  const L=Math.hypot(...off)||1; const o=[off[0]/L*w,off[1]/L*w,off[2]/L*w];
  quadInto(faces, [a[0]-o[0],a[1]-o[1],a[2]-o[2]], [a[0]+o[0],a[1]+o[1],a[2]+o[2]], [b[0]+o[0],b[1]+o[1],b[2]+o[2]], [b[0]-o[0],b[1]-o[1],b[2]-o[2]]);
}


// Garment name -> builder. Robes/kimono are tall near-columnar flares;
// dresses start at the chest; skirts at the waist; mummy = full wrap.
// Sash is a thin rigid band (barely drapes) - the only non-grid garment.
const BUILD = {
  'Sash': (f) => sash(f),
};

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
  // shoulder shawl: a short arc over the shoulders + upper back
  'Wrap':            { rows: [{ y: 1.560, rx: 0.150, rz: 0.120 }, { y: 1.475, rx: 0.180, rz: 0.150 }, { y: 1.395, rx: 0.190, rz: 0.152 }, { y: 1.315, rx: 0.188, rz: 0.150 }], wrap: false, seg: 22, arc: [Math.PI/2 + 0.75, Math.PI/2 - 0.75 + Math.PI*2] },
};

/** Cloth grid for a garment: pinned top row (row 0), ring rows down to
 *  the hem. { rows, cols, wrap, pos (rows*cols*3), faces (quad indices) }.
 *  null for garments with no flowing grid (surcoat/toga/sash/wrap). */
export function drapedGrid(name) {
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

export const DRAPED_NAMES = [...Object.keys(GRIDSPEC), ...Object.keys(BUILD).filter((n) => !GRIDSPEC[n])];

/** Standoff faces for a draped garment name, shaded with `ramp`. [] if not draped. */
export function drapedPiece(name, ramp) {
  const g = drapedGrid(name);
  if (g) return shadePiece(facesFromGrid(g), ramp);
  const b = BUILD[name];
  if (!b) return [];
  const faces = [];
  b(faces);
  return shadePiece(faces, ramp);
}
