// Cuirass (chest armour) as designed 3D geometry on the neutral rig -
// INSPIRED by the classic plate cuirass, not a 1:1 sprite-shell. Wraps
// the torso zone (shoulders -> waist) sitting just outside the body
// surface, with a neckline opening, shoulder caps and a waist hem.
// Colour is baked per face (metal ramp + snapped normal shade, the
// blocky look). Sprites are kept for the inventory icon, not this.
//
// NOTE: the torso Y band + HSCALE mirror src/characters/neutralBody.js
// so the piece aligns to the visible body. Keep in sync until the rig
// exposes its profile.
const HSCALE = 0.9;

export function buildCuirass(ramp) {
  const SEG = 28;
  const faces = [];
  const sq = (u, p) => Math.sign(u) * Math.pow(Math.abs(u), p);
  const ring = (cx, y, cz, rx, rz, i, p = 1) => { const a = (i / SEG) * Math.PI * 2; return [cx + rx * sq(Math.cos(a), p), y, cz + rz * sq(Math.sin(a), p)]; };
  const loft = (rows) => {
    const R = rows.slice().sort((a, b) => a.y - b.y);
    for (let k = 0; k + 1 < R.length; k++) {
      const a = R[k], b = R[k + 1]; const pa = a.p ?? 1, pb = b.p ?? 1;
      const az = a.cz ?? 0, bz = b.cz ?? 0;
      for (let i = 0; i < SEG; i++) {
        const p0 = ring(0, a.y, az, a.rx, a.rz, i, pa), p1 = ring(0, a.y, az, a.rx, a.rz, i + 1, pa);
        const p2 = ring(0, b.y, bz, b.rx, b.rz, i + 1, pb), p3 = ring(0, b.y, bz, b.rx, b.rz, i, pb);
        let nx = 0, ny = 0, nz = 0;
        const ux = p1[0]-p0[0], uy = p1[1]-p0[1], uz = p1[2]-p0[2];
        const vx = p3[0]-p0[0], vy = p3[1]-p0[1], vz = p3[2]-p0[2];
        nx = uy*vz-uz*vy; ny = uz*vx-ux*vz; nz = ux*vy-uy*vx;
        const L = Math.hypot(nx, ny, nz) || 1;
        faces.push({ p: [...p0, ...p1, ...p2, ...p3], n: [nx/L, ny/L, nz/L], g: 'cuirass' });
      }
    }
  };

  // Plate body: broad over the chest, tapering to the waist, flaring at
  // a hem. Slightly squarish (p<1) for a hard plated read. Offset out
  // from the torso surface so it sits ON the body.
  const P = 0.62;
  loft([
    { y: 1.605, rx: 0.190, rz: 0.098, p: P },  // neckline shoulder line
    { y: 1.560, rx: 0.232, rz: 0.116, p: P },  // upper chest / pauldron shelf
    { y: 1.480, rx: 0.236, rz: 0.120, p: P },  // chest (broadest)
    { y: 1.380, rx: 0.220, rz: 0.114, p: P },  // lower chest
    { y: 1.270, rx: 0.192, rz: 0.100, p: P },  // upper waist
    { y: 1.180, rx: 0.178, rz: 0.094, p: P },  // waist (cinch)
    { y: 1.120, rx: 0.198, rz: 0.104, p: P },  // hem flare
  ]);

  // apply the body's vertical compress so it aligns to the visible rig
  for (const f of faces) for (let i = 0; i < 4; i++) f.p[i*3+1] *= HSCALE;

  // ── shade: metal ramp by normal (upper-right key), snapped (blocky) ──
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  const snap = (t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
  for (const f of faces) {
    const it = Math.max(0.05, (f.n[0]*Lx + f.n[1]*Ly + f.n[2]*Lz) / Ln * 0.9 + 0.15);
    f.c = snap(Math.min(1, it));
  }
  return faces;
}

// Cool steel plate ramp (procedural, dark -> bright). Leather/chain get
// their own ramps when those pieces land.
export const STEEL_RAMP = [[38, 40, 46], [64, 68, 78], [102, 108, 120], [146, 152, 166], [184, 192, 206], [214, 222, 236]];
