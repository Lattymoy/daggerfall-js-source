// Shared geometry for armour pieces on the neutral rig. ONE correct
// loft so the outward-normal flip (the thing that makes shading face
// the right way) lives in a single place - the per-piece copies kept
// dropping it, which inverted the front/back shading.
export const SEG_DEFAULT = 24;

// super-ellipse ring; p<1 = squarish (plated), p=1 = round.
const sq = (u, p) => Math.sign(u) * Math.pow(Math.abs(u), p);
const ring = (cx, y, cz, rx, rz, i, seg, p, a0 = 0, aSpan = Math.PI * 2) => { const a = a0 + (i / seg) * aSpan; return [cx + rx * sq(Math.cos(a), p), y, cz + rz * sq(Math.sin(a), p)]; };

// Loft `rows` into `faces`, centred at (cx, cz-per-row), normals forced
// OUTWARD from the ring centre. rows: {y, rx, rz, p?, cz?}.
export function loftPiece(faces, rows, { cx = 0, seg = SEG_DEFAULT, group, capTop = true, capBottom = true, arc = null } = {}) {
  const a0 = arc ? arc[0] : 0, aSpan = arc ? (arc[1] - arc[0]) : Math.PI * 2;
  if (arc) { capTop = false; capBottom = false; }
  const R = rows.slice().sort((a, b) => a.y - b.y);
  // cap an end ring with a triangle fan to its centre so the tube isn't
  // see-through. `up` = +1 for the top ring, -1 for the bottom.
  const cap = (row, up) => {
    const cz = row.cz ?? 0, p = row.p ?? 1;
    const c = [cx, row.y, cz];
    for (let i = 0; i < seg; i++) {
      const a = ring(cx, row.y, cz, row.rx, row.rz, i, seg, p, a0, aSpan);
      const b = ring(cx, row.y, cz, row.rx, row.rz, i + 1, seg, p, a0, aSpan);
      // wind so the normal faces along the axis (up/down)
      const tri = up > 0 ? [c, b, a] : [c, a, b];
      faces.push({ p: [...tri[0], ...tri[1], ...tri[2], ...tri[2]], n: [0, up, 0], g: group });
    }
  };
  if (capBottom) cap(R[0], -1);
  if (capTop) cap(R[R.length - 1], +1);
  for (let k = 0; k + 1 < R.length; k++) {
    const a = R[k], b = R[k + 1]; if (Math.abs(a.y - b.y) < 1e-6) continue;
    const pa = a.p ?? 1, pb = b.p ?? 1, az = a.cz ?? 0, bz = b.cz ?? 0;
    for (let i = 0; i < seg; i++) {
      const p0 = ring(cx, a.y, az, a.rx, a.rz, i, seg, pa, a0, aSpan), p1 = ring(cx, a.y, az, a.rx, a.rz, i + 1, seg, pa, a0, aSpan);
      const p2 = ring(cx, b.y, bz, b.rx, b.rz, i + 1, seg, pb, a0, aSpan), p3 = ring(cx, b.y, bz, b.rx, b.rz, i, seg, pb, a0, aSpan);
      const ux = p1[0]-p0[0], uy = p1[1]-p0[1], uz = p1[2]-p0[2];
      const vx = p3[0]-p0[0], vy = p3[1]-p0[1], vz = p3[2]-p0[2];
      let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx/=L; ny/=L; nz/=L;
      // force outward: flip if pointing toward the ring centre (cx, cz)
      const mx = (p0[0]+p2[0])/2 - cx, mz = (p0[2]+p2[2])/2 - (az+bz)/2;
      if (nx*mx + nz*mz < 0) { nx=-nx; ny=-ny; nz=-nz; }
      faces.push({ p: [...p0, ...p1, ...p2, ...p3], n: [nx, ny, nz], g: group });
    }
  }
}

// Bake per-face colour: metal ramp by normal (upper-right key), snapped.
export function shadePiece(faces, ramp) {
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  const snap = (t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
  for (const f of faces) {
    const it = Math.max(0.05, (f.n[0]*Lx + f.n[1]*Ly + f.n[2]*Lz) / Ln * 0.9 + 0.15);
    f.c = snap(Math.min(1, it));
  }
  return faces;
}

// Body vertical compress - mirror src/characters/neutralBody.js.
export const HSCALE = 0.9;
export function compress(faces) { for (const f of faces) for (let i = 0; i < 4; i++) f.p[i*3+1] *= HSCALE; return faces; }

export const STEEL_RAMP = [[38, 40, 46], [64, 68, 78], [102, 108, 120], [146, 152, 166], [184, 192, 206], [214, 222, 236]];
// Linen/tan cloth (procedural; item dye colours come from data later).
export const CLOTH_RAMP = [[58, 48, 38], [86, 72, 54], [118, 100, 74], [150, 128, 96], [180, 158, 122], [206, 186, 150]];
// Chain mail (darker, cooler than plate) and leather (brown).
export const MAIL_RAMP = [[32, 34, 40], [52, 56, 64], [80, 86, 96], [112, 120, 132], [146, 154, 168], [180, 188, 202]];
export const LEATHER_RAMP = [[40, 28, 20], [62, 44, 30], [88, 62, 42], [116, 84, 56], [146, 110, 76], [176, 140, 100]];
