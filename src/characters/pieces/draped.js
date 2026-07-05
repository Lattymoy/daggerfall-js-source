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
// Shawl: a wide wrap sitting over the shoulders, draping the back + sides
// + around the front (small front gap), to mid-torso. One cohesive piece.
function shawlRows() {
  const rows = [], topY = 1.560, hemY = 1.040, steps = 10;
  for (let k = 0; k <= steps; k++) { const t = k/steps, y = topY - t*(topY-hemY), grow = Math.pow(t, 0.65);
    const [rx, rz] = clip(y, 0.190 + grow*0.070, 0.140 + grow*0.085); rows.push({ y, rx, rz }); }
  return rows;
}
const SHAWL_ARC = [Math.PI/2 + 0.55, Math.PI/2 - 0.55 + Math.PI*2];
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
  'Wrap':            { rows: shawlRows(), wrap: false, seg: 28, arc: SHAWL_ARC },
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
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const norm=(a)=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
  const T = [];
  for (let r = 0; r < R; r++) T.push(norm(sub(center[Math.min(R-1,r+1)], center[Math.max(0,r-1)])));
  // stable start frame; then PARALLEL-TRANSPORT it so the ribbon never flips
  let p0 = cross(T[0], [0,0,1]); if (Math.hypot(p0[0],p0[1],p0[2]) < 0.1) p0 = cross(T[0], [1,0,0]);
  const P = [norm(p0)];
  for (let r = 1; r < R; r++) { const prev = P[r-1], d = dot(prev, T[r]); P.push(norm([prev[0]-d*T[r][0], prev[1]-d*T[r][1], prev[2]-d*T[r][2]])); }
  for (let r = 0; r < R; r++) { const p = center[r], w = P[r], hw = Array.isArray(halfW) ? halfW[r] : halfW;
    for (let c = 0; c < cols; c++) { const u = (c/(cols-1) - 0.5) * 2 * hw, i = (r*cols+c)*3;
      pos[i] = p[0] + w[0]*u; pos[i+1] = p[1] + w[1]*u; pos[i+2] = p[2] + w[2]*u; }
  }
  const faces = [];
  for (let r = 0; r+1 < R; r++) for (let c = 0; c+1 < cols; c++) faces.push([r*cols+c, r*cols+c+1, (r+1)*cols+c+1, (r+1)*cols+c]);
  const pin = new Uint8Array(R * cols);
  for (const r of pinRows) for (let c = 0; c < cols; c++) pin[r*cols + c] = 1;
  return { rows: R, cols, wrap: false, pos, faces, pin };
}


// Sash: a wide band from the right shoulder diagonally across the chest to a
// knot at the left hip, then a tapering tail hanging free below the knot.
function sashGrid() {
  const c = [
    [0.150, 1.505, 0.095], [0.108, 1.395, 0.116], [0.048, 1.280, 0.124], [-0.020, 1.165, 0.122], // R shoulder -> chest
    [-0.082, 1.050, 0.112], [-0.128, 0.955, 0.108],                                               // down to the waist
    [-0.158, 0.878, 0.168], [-0.150, 0.850, 0.176], [-0.172, 0.828, 0.166],                        // KNOT: bulges forward, pinched
    [-0.188, 0.712, 0.120], [-0.194, 0.590, 0.092], [-0.188, 0.470, 0.068], [-0.176, 0.352, 0.050], // tail, free
  ];
  const hw = [0.052,0.055,0.058,0.056, 0.054,0.056, 0.082,0.090,0.078, 0.050,0.044,0.040,0.052];   // knot fat, tail tapers then frays
  return stripGrid(c, hw, 5, [0, 6, 7, 8]);   // pin shoulder + the knot rows
}

/** Cloth grid for a garment: pinned top row (row 0), ring rows down to
 *  the hem. { rows, cols, wrap, pos (rows*cols*3), faces (quad indices) }.
 *  null for garments with no flowing grid (surcoat/toga/sash/wrap). */
export function drapedGrid(name) {
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

export const DRAPED_NAMES = [...Object.keys(GRIDSPEC), 'Sash'];

/** Standoff faces for a draped garment name, shaded with `ramp`. [] if not draped. */
export function drapedPiece(name, ramp) {
  const g = drapedGrid(name);
  return g ? shadePiece(facesFromGrid(g), ramp) : [];
}

// Per-garment MATERIAL: a colour ramp (dark->light, for the normal shade)
// plus sheen (specular highlight -> silk/satin) and rim (edge light). Gives
// every drape a distinct look instead of one shared grey cloth.
export const DRAPE_MATERIAL = {
  'Short Skirt':      { ramp: [[52,44,32],[86,74,54],[122,106,78],[158,140,104],[190,174,138],[214,202,172]], sheen: 0.03, rim: 0.0 },
  'Long Skirt':       { ramp: [[30,32,20],[54,58,34],[82,86,50],[114,118,74],[150,154,106],[186,188,146]], sheen: 0.04, rim: 0.0 },
  'Casual Dress':     { ramp: [[12,34,36],[22,62,64],[34,96,96],[56,134,132],[104,172,168],[164,206,200]], sheen: 0.14, rim: 0.05 },
  'Strapless Dress':  { ramp: [[34,16,38],[64,30,68],[98,50,102],[138,84,140],[178,130,178],[212,180,210]], sheen: 0.20, rim: 0.08 },
  'Plain Robes':      { ramp: [[38,28,20],[70,52,36],[102,78,54],[140,110,78],[176,146,108],[206,180,140]], sheen: 0.04, rim: 0.0 },
  'Priest Robes':     { ramp: [[18,20,42],[32,34,72],[50,54,108],[78,84,150],[120,128,186],[168,176,214]], sheen: 0.16, rim: 0.06 },
  'Priestess Robes':  { ramp: [[60,54,38],[104,92,60],[150,134,88],[192,176,120],[220,208,160],[240,232,200]], sheen: 0.22, rim: 0.08 },
  'Kimono':           { ramp: [[46,12,18],[92,24,32],[140,40,48],[186,64,72],[214,110,112],[236,168,166]], sheen: 0.35, rim: 0.15 },
  'Mummy Wrappings':  { ramp: [[46,40,30],[78,70,54],[110,100,78],[142,130,102],[172,160,130],[198,188,160]], sheen: 0.0, rim: 0.0 },
  'Casual Cloak':     { ramp: [[16,16,18],[32,32,36],[52,52,58],[76,76,84],[104,104,114],[140,140,150]], sheen: 0.02, rim: 0.03 },
  'Formal Cloak':     { ramp: [[10,22,16],[20,42,30],[32,66,46],[50,96,68],[84,130,98],[132,170,138]], sheen: 0.08, rim: 0.05 },
  'Toga':             { ramp: [[70,68,62],[112,110,102],[152,150,140],[190,188,178],[216,214,206],[238,236,230]], sheen: 0.06, rim: 0.04 },
  'Dwynnen Surcoat':  { ramp: [[52,14,16],[96,26,28],[142,44,44],[184,74,72],[212,120,116],[234,170,166]], sheen: 0.06, rim: 0.05 },
  'Anticlere Surcoat':{ ramp: [[12,20,48],[22,38,86],[36,60,128],[62,92,166],[110,140,196],[166,190,222]], sheen: 0.06, rim: 0.05 },
  'Wrap':             { ramp: [[54,34,40],[92,60,66],[130,88,96],[168,120,128],[200,158,164],[224,196,200]], sheen: 0.10, rim: 0.05 },
  'Sash':             { ramp: [[54,42,14],[96,76,24],[140,112,36],[184,152,56],[214,190,104],[238,222,168]], sheen: 0.42, rim: 0.20 },
};
