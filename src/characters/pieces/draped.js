// Draped garments - standoff cloth that HANGS off the body (skirts,
// robes, cloaks, dresses, surcoats, togas, sashes, wraps, mummy wraps).
// Unlike body-hugging clothing (displacement), these are separate meshes
// that flare/drape outside the silhouette. Tagged 'body' so they move
// with the torso. Anchored to the measured body profile: waist ~y0.98
// (rx~0.17, rz~0.115), shoulders ~y1.52 (back z~-0.09).
import { loftPiece, shadePiece } from './pieceLoft.js';

const B = 'body', P = 0.85;

// Body-core half-extents (torso+legs, NO arms), measured from the rig.
// Drapes are clamped OUTSIDE this + a cloth standoff so they never clip.
const CORE = [[1.55,0.072,0.084],[1.50,0.205,0.090],[1.45,0.215,0.088],[1.40,0.215,0.096],[1.30,0.208,0.098],[1.20,0.182,0.092],[1.05,0.160,0.082],[0.95,0.168,0.088],[0.90,0.178,0.100],[0.85,0.202,0.120],[0.80,0.202,0.120],[0.75,0.194,0.114],[0.65,0.178,0.100],[0.55,0.168,0.090],[0.50,0.154,0.080],[0.45,0.158,0.088],[0.40,0.152,0.072],[0.30,0.166,0.088],[0.20,0.142,0.063],[0.10,0.137,0.050]];
const STANDOFF = 0.038;
function core(y) {
  if (y >= CORE[0][0]) return [CORE[0][1], CORE[0][2]];
  if (y <= CORE[CORE.length-1][0]) { const l = CORE[CORE.length-1]; return [l[1], l[2]]; }
  for (let i = 0; i+1 < CORE.length; i++) { const a = CORE[i], b = CORE[i+1]; if (y <= a[0] && y >= b[0]) { const t = (y-a[0])/(b[0]-a[0]); return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; } }
  return [0.2, 0.1];
}
// clamp a ring's rx/rz to sit outside the body core at height y
function clip(y, rx, rz) { const [cx, cz] = core(y); return [Math.max(rx, cx + STANDOFF), Math.max(rz, cz + STANDOFF)]; }

function quadInto(faces, a, b, c, d, g = B) {
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
  let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const L=Math.hypot(nx,ny,nz)||1;
  faces.push({ p:[...a,...b,...c,...d], n:[nx/L,ny/L,nz/L], g });
}

// A flared cloth cone from `topY` (snug) to `hemY` (wide) - the core of
// skirts / robes / dress skirts / mummy wraps. Open top + hem.
function flare(faces, topY, hemY, topRx, topRz, hemRx, hemRz, seg = 26) {
  const rows = [], steps = 7;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, y = topY - t * (topY - hemY), e = t * t; // ease -> falls straight then flares
    const [rx, rz] = clip(y, topRx + e * (hemRx - topRx), topRz + e * (hemRz - topRz));
    rows.push({ y, rx, rz, p: P });
  }
  loftPiece(faces, rows, { group: B, seg, capTop: false, capBottom: false });
}

// Cape: clasped at the NECKLINE (a tight collar ring at the throat), then
// flows down over the shoulders + back to a wide flowing hem. Open at the
// front (a narrow throat gap). Clip-clamped so it rides outside the body.
function cloak(faces, hemY = 0.45, wide = false) {
  const rows = [], steps = 10, neckY = 1.585, W = wide ? 1.16 : 1.0;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, y = neckY - t * (neckY - hemY);
    // near the neck it hugs (small), then widens toward the hem
    const grow = Math.pow(t, 0.85);
    const [rx, rz] = clip(y, (0.088 + grow * 0.230) * W, (0.100 + grow * 0.185) * W);
    rows.push({ y, rx, rz, p: P });
  }
  // open at the front (+z, a=PI/2): cape covers the back + sides
  const GAP = 1.25;
  loftPiece(faces, rows, { group: B, seg: 26, capTop: false, capBottom: false, arc: [Math.PI/2 + GAP, Math.PI/2 - GAP + Math.PI*2] });
}

// Surcoat: flat front + back tabard panels hanging from the shoulders to
// mid-thigh, open at the sides.
function surcoat(faces, hemY = 0.62) {
  const topY = 1.520, hw = 0.135, zF = 0.130, zB = -0.130;
  const panel = (z, sgn) => {
    const tl=[-hw, topY, z], tr=[hw, topY, z], bl=[-hw*1.15, hemY, z*1.05], br=[hw*1.15, hemY, z*1.05];
    if (sgn > 0) quadInto(faces, tl, tr, br, bl); else quadInto(faces, tr, tl, bl, br);
  };
  panel(zF, 1); panel(zB, -1);
  // shoulder yoke connecting the two over the top
  quadInto(faces, [-hw, topY, zB], [hw, topY, zB], [hw, topY, zF], [-hw, topY, zF]);
}

// Toga: a diagonal drape over the LEFT shoulder across to the right hip,
// plus a short skirt drape below.
function toga(faces) {
  const a=[-0.150,1.560,-0.020], b=[0.020,1.545,0.140], c=[0.175,1.010,0.060], d=[0.010,0.995,-0.150];
  quadInto(faces, a, b, c, d);
  quadInto(faces, b, a, d, c); // back the panel
  flare(faces, 1.010, 0.360, 0.180, 0.120, 0.300, 0.210, 22); // skirt under
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

// Wrap / shawl: an arc over the shoulders and upper back.
function wrap(faces) {
  const rows = [ { y: 1.560, rx: 0.150, rz: 0.120, p: P }, { y: 1.470, rx: 0.180, rz: 0.150, p: P }, { y: 1.360, rx: 0.190, rz: 0.150, p: P } ];
  const GAP = 0.75;
  loftPiece(faces, rows, { group: B, seg: 20, capTop: false, capBottom: false, arc: [Math.PI/2 + GAP, Math.PI/2 - GAP + Math.PI*2] });
}

// Garment name -> builder. Robes/kimono are tall near-columnar flares;
// dresses start at the chest; skirts at the waist; mummy = full wrap.
const BUILD = {
  'Short Skirt':      (f) => flare(f, 0.980, 0.560, 0.175, 0.115, 0.270, 0.190),
  'Long Skirt':       (f) => flare(f, 0.980, 0.130, 0.175, 0.115, 0.320, 0.220),
  'Casual Dress':     (f) => flare(f, 1.320, 0.180, 0.150, 0.110, 0.320, 0.220),
  'Strapless Dress':  (f) => flare(f, 1.300, 0.200, 0.150, 0.110, 0.310, 0.215),
  'Plain Robes':      (f) => flare(f, 1.545, 0.120, 0.160, 0.120, 0.300, 0.210),
  'Priest Robes':     (f) => flare(f, 1.545, 0.110, 0.165, 0.125, 0.315, 0.220),
  'Priestess Robes':  (f) => flare(f, 1.545, 0.110, 0.165, 0.125, 0.315, 0.220),
  'Kimono':           (f) => flare(f, 1.520, 0.220, 0.175, 0.135, 0.290, 0.220),
  'Mummy Wrappings':  (f) => flare(f, 1.560, 0.060, 0.155, 0.120, 0.190, 0.150),
  'Casual Cloak':     (f) => cloak(f, 0.480, false),
  'Formal Cloak':     (f) => cloak(f, 0.360, true),
  'Dwynnen Surcoat':  (f) => surcoat(f, 0.640),
  'Anticlere Surcoat':(f) => surcoat(f, 0.600),
  'Toga':             (f) => toga(f),
  'Sash':             (f) => sash(f),
  'Wrap':             (f) => wrap(f),
};

export const DRAPED_NAMES = Object.keys(BUILD);

/** Standoff faces for a draped garment name, shaded with `ramp`. [] if not draped. */
export function drapedPiece(name, ramp) {
  const b = BUILD[name];
  if (!b) return [];
  const faces = [];
  b(faces);
  return shadePiece(faces, ramp);
}
