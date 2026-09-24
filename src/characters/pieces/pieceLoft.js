// Shared geometry for armour pieces on the neutral rig. ONE correct
// loft so the outward-normal flip (the thing that makes shading face
// the right way) lives in a single place - the per-piece copies kept
// dropping it, which inverted the front/back shading. The same rule
// holds the key-light shade, the creature quad/box emitters and the
// weapon grip system below: one home each, never a per-piece copy.
import { ARM_X } from '../neutralBody.js';

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

// Ramp entry for intensity t (0..1), clamped to the ends.
const rampAt = (ramp, t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];

// Bake per-face colour: metal ramp by normal (upper-right key), snapped.
// AUDIT 68 S06-snap-shade-dup: the ONE key-light snap for every piece -
// hair (0.1/0.2) and tail/scales/fur/tusks (0.08/0.18) pass their own
// floor/bias instead of keeping a copy of the light.
export function shadePiece(faces, ramp, floor = 0.05, bias = 0.15) {
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  for (const f of faces) {
    const it = Math.max(floor, (f.n[0]*Lx + f.n[1]*Ly + f.n[2]*Lz) / Ln * 0.9 + bias);
    f._i = Math.min(1, it);
    f.c = rampAt(ramp, f._i);
  }
  return faces;
}

// One flat face ({p: 12 floats, n, g}) with its normal from the quad's
// edges (b-a) x (d-a); a triangle passes its last vertex twice. The
// key-lit pieces (tail, hair, scales, tusks, drapes) all emit through it.
export function pushQuad(out, a, b, c, d, g) {
  const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
  const vx = d[0]-a[0], vy = d[1]-a[1], vz = d[2]-a[2];
  const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
  const L = Math.hypot(nx, ny, nz) || 1;
  out.push({ p: [...a, ...b, ...c, ...d], n: [nx/L, ny/L, nz/L], g });
}

// AUDIT 68 S06-creature-quadder-box-dup: the creature pieces' hand-shaded
// quad emitter - pushQuad's face, colour snapped straight from `shade`
// (no key light). One home; `group` is the rig tag.
export function quadder(faces, ramp, group = 'body') {
  return (a, b, c, d, shade) => {
    pushQuad(faces, a, b, c, d, group);
    const f = faces[faces.length - 1];
    f.c = [...rampAt(ramp, shade)];
    f._i = shade;
  };
}

// Six-sided box through a quadder, front (z1) face at `side`. A piece
// family's own shading (default side/under, back and flank factors) is
// named ONCE in its boxer({...}) call instead of in a private copy.
export function boxer({ side: sideDefault = 0.66, under: underDefault = 0.3, back = 0.7, flank = 0.85 } = {}) {
  return (quad, x0, y0, z0, x1, y1, z1, top = 0.95, side = sideDefault, under = underDefault) => {
    quad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], side); // front
    quad([x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], side * back); // back
    quad([x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], side * flank); // right
    quad([x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], side * flank); // left
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top); // top
    quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], under); // underside
  };
}

// Body vertical compress - mirror src/characters/neutralBody.js.
export const HSCALE = 0.9;
export function compress(faces) { for (const f of faces) for (let i = 0; i < 4; i++) f.p[i*3+1] *= HSCALE; return faces; }

export const STEEL_RAMP = [[38, 40, 46], [64, 68, 78], [102, 108, 120], [146, 152, 166], [184, 192, 206], [214, 222, 236]];
// Linen/tan cloth (procedural; item dye colours come from data later).
export const CLOTH_RAMP = [[58, 48, 38], [86, 72, 54], [118, 100, 74], [150, 128, 96], [180, 158, 122], [206, 186, 150]];
// Chain mail (darker, cooler than plate) and leather (brown). STAGED (no
// consumer yet) with cuirass/greaves - the armour-material seam's colours.
export const MAIL_RAMP = [[32, 34, 40], [52, 56, 64], [80, 86, 96], [112, 120, 132], [146, 154, 168], [180, 188, 202]];
export const LEATHER_RAMP = [[40, 28, 20], [62, 44, 30], [88, 62, 42], [116, 84, 56], [146, 110, 76], [176, 140, 100]];

// ---- THE WEAPON GRIP SYSTEM (AUDIT 68 S06-weapon-grip-bake-dup: the
// sword, claymore, blade, hafted and bow builders each kept their own
// copy of all of this). Every weapon is authored pre-HSCALE at the LEFT
// fist, every face 'armL', and baked about the grip point in the fist.
export const LEFT_FIST_X = -ARM_X;   // left-fist column (neutralBody's arm axis)
export const GRIP_Y = 0.90;          // grip point inside the fist (pre-HSCALE)
// THE SEAT (Mac's reference photo, 2026-07-05): a sword is NOT held
// collinear with the forearm - the handle crosses the palm, so with
// the arm hanging the blade sweeps UP-FORWARD and the pommel sits low
// behind the fist. Mac: swd pitch +45deg baked (2026-07-05) - the
// near-horizontal point-forward carry, family-wide.
export const SEAT_PITCH = -2.40 + Math.PI / 4;
// The CLAYMORE-STANDARD two-hand grip block: stations at 0.90 (grip, the
// bake pivot) and 0.74 (the OFF-HAND station - the 2H pose/attack
// contract), real on-axis rings so each anchor reads as a ring centroid
// (the phantom-axis rule). Every 2H family lofts THESE rows.
export const TWO_HAND_GRIP_ROWS = Object.freeze([
  { y: 0.720, rx: 0.026, rz: 0.027 },
  { y: 0.740, rx: 0.028, rz: 0.029 },
  { y: 0.900, rx: 0.028, rz: 0.029 },
  { y: 1.058, rx: 0.026, rz: 0.027 },
].map(Object.freeze));

// Rotate faces (verts + normals) in the y-z plane by `angle` about the
// line y = pivotY, z = 0 - the grip bake, and the arrow's lay-down.
export function pitchAbout(faces, pivotY, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      const dy = f.p[i*3+1] - pivotY, z = f.p[i*3+2];
      f.p[i*3+1] = pivotY + c*dy - s*z;
      f.p[i*3+2] = s*dy + c*z;
    }
    const ny = f.n[1], nz = f.n[2];
    f.n[1] = c*ny - s*nz; f.n[2] = s*ny + c*nz;
  }
  return faces;
}
