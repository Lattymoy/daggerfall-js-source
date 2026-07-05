// Argonian tail: a long, curved, tapering tube that roots at the lower
// back and drops down + back, with a dorsal spine-fin running its
// length, raised scale bumps over the surface, and wider ventral scutes
// underneath. Built in FINAL (compressed) body space and tagged 'body'
// so it moves with the pelvis. Highly detailed - the focus piece.

function shadeTail(faces, ramp) {
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  const snap = (t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
  for (const f of faces) { const it = Math.min(1, Math.max(0.08, (f.n[0]*Lx + f.n[1]*Ly + f.n[2]*Lz) / Ln * 0.9 + 0.18)); f._i = it; f.c = snap(it); }
  return faces;
}

export function buildTail(skin, kind = 'argonian') {
  const faces = [];
  const quad = (a, b, c, d, g = 'body') => {
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const L=Math.hypot(nx,ny,nz)||1;
    faces.push({ p:[...a,...b,...c,...d], n:[nx/L,ny/L,nz/L], g });
  };
  const tri = (a, b, c) => quad(a, b, c, c);

  // Spine: roots at the pelvis back (y~0.90, z-0.11), sweeps back + down,
  // bellies out, then curls back up to a fine tip. (compressed space)
  const spine = (kind === 'khajiit' ? [
    { y: 0.930, z:  0.010, r: 0.040 }, // root - buried INSIDE the pelvis
    { y: 0.968, z: -0.068, r: 0.038 }, // emerging, lifting (cats carry it up)
    { y: 1.004, z: -0.140, r: 0.037 },
    { y: 1.024, z: -0.220, r: 0.036 }, // crest of the arch
    { y: 1.010, z: -0.302, r: 0.035 }, // starting down
    { y: 0.958, z: -0.376, r: 0.034 },
    { y: 0.882, z: -0.436, r: 0.033 },
    { y: 0.796, z: -0.478, r: 0.031 },
    { y: 0.706, z: -0.498, r: 0.030 }, // gentle S
    { y: 0.620, z: -0.494, r: 0.029 },
    { y: 0.544, z: -0.468, r: 0.030 }, // curling forward
    { y: 0.486, z: -0.428, r: 0.033 }, // bushy tip swells
    { y: 0.452, z: -0.380, r: 0.034 }, // bushiest
    { y: 0.436, z: -0.332, r: 0.024 },
    { y: 0.430, z: -0.292, r: 0.008 }, // tip
  ] : [
    { y: 0.930, z:  0.010, r: 0.104 }, // root - buried INSIDE the pelvis (front of the ring is well inside)
    { y: 0.958, z: -0.078, r: 0.100 }, // emerging through the lower back, arching up
    { y: 0.968, z: -0.166, r: 0.093 }, // crest of the arch
    { y: 0.940, z: -0.252, r: 0.084 }, // starting down
    { y: 0.878, z: -0.336, r: 0.074 }, // descending  (the "\")
    { y: 0.792, z: -0.416, r: 0.064 },
    { y: 0.700, z: -0.492, r: 0.055 },
    { y: 0.624, z: -0.568, r: 0.046 }, // leveling out
    { y: 0.572, z: -0.648, r: 0.037 }, // trailing back  (the "_")
    { y: 0.538, z: -0.730, r: 0.028 },
    { y: 0.516, z: -0.812, r: 0.019 },
    { y: 0.502, z: -0.892, r: 0.011 },
    { y: 0.496, z: -0.960, r: 0.004 }, // tip, trailing behind
  ]).map((p) => ({ x: 0, ...p }));

  // Tangent per node.
  const T = spine.map((p, i) => {
    const a = spine[Math.max(0, i-1)], b = spine[Math.min(spine.length-1, i+1)];
    let t = [b.x-a.x, b.y-a.y, b.z-a.z]; const l = Math.hypot(...t) || 1; return [t[0]/l, t[1]/l, t[2]/l];
  });
  // Planar curve (x=0): width axis = X; dorsal axis = tangent x X, flipped
  // so it points up. No twist.
  const side = [1, 0, 0];
  const frame = T.map((t) => {
    let d = [t[1]*side[2]-t[2]*side[1], t[2]*side[0]-t[0]*side[2], t[0]*side[1]-t[1]*side[0]];
    if (d[1] < 0) d = [-d[0], -d[1], -d[2]]; const dl = Math.hypot(...d) || 1; d = [d[0]/dl, d[1]/dl, d[2]/dl];
    return { s: side, d };
  });
  const N = 10; // sides around the tube
  const ringPt = (i, k) => {
    const p = spine[i], { s, d } = frame[i], a = (k / N) * 2 * Math.PI, c = Math.cos(a), sn = Math.sin(a);
    // slightly taller than wide (oval), belly flattened a touch
    const rw = p.r, rh = p.r * 1.06;
    return [p.x + rw*c*s[0] + rh*sn*d[0], p.y + rw*c*s[1] + rh*sn*d[1], p.z + rw*c*s[2] + rh*sn*d[2]];
  };
  const rings = spine.map((_, i) => Array.from({ length: N }, (_, k) => ringPt(i, k)));

  // Tube surface.
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < N; k++) {
    const j = (k + 1) % N; quad(rings[i][k], rings[i][j], rings[i+1][j], rings[i+1][k]);
  }
  // Tip cap.
  const last = spine[spine.length - 1];
  const tipC = [last.x, last.y, last.z];
  for (let k = 0; k < N; k++) { const j = (k+1)%N; tri(tipC, rings[rings.length-1][j], rings[rings.length-1][k]); }

  if (kind === 'argonian') {
  // Dorsal spine-fin: a triangular sail-spine at each segment along the
  // TOP (dorsal dir), tallest near the base, shrinking to the tip.
  for (let i = 1; i + 1 < spine.length; i++) {
    const p = spine[i], { d } = frame[i], t = T[i];
    const top = [p.x + d[0]*p.r, p.y + d[1]*p.r, p.z + d[2]*p.r]; // surface top
    const h = Math.max(0.006, p.r * 1.5); // fin height
    const apex = [top[0] + d[0]*h - t[0]*p.r*0.5, top[1] + d[1]*h - t[1]*p.r*0.5, top[2] + d[2]*h - t[2]*p.r*0.5]; // raked back
    // front + back faces of the fin, plus a slight side thickness
    const w = Math.max(0.003, p.r * 0.18);
    const fL = [top[0]+w, top[1], top[2]], fR = [top[0]-w, top[1], top[2]];
    const bpt = spine[i+1]; const back = [bpt.x + frame[i+1].d[0]*bpt.r, bpt.y + frame[i+1].d[1]*bpt.r, bpt.z + frame[i+1].d[2]*bpt.r];
    tri(fL, apex, fR);                 // one side
    tri(fR, apex, back);               // trailing edge to next
    tri(back, apex, fL);               // leading wrap
  }

  // Ventral scutes: wider raised plates on the UNDERSIDE (belly, -dorsal),
  // banded across the tail like a snake's belly.
  for (let i = 1; i + 1 < spine.length; i += 1) {
    const p = spine[i], { s, d } = frame[i];
    const by = -1; // ventral
    const cz = [p.x + d[0]*by*p.r, p.y + d[1]*by*p.r, p.z + d[2]*by*p.r];
    const wsc = p.r * 0.9, lift = p.r * 0.10;
    const n = [d[0]*by, d[1]*by, d[2]*by];
    const L = [cz[0] + s[0]*wsc + n[0]*lift, cz[1] + s[1]*wsc + n[1]*lift, cz[2] + s[2]*wsc + n[2]*lift];
    const R = [cz[0] - s[0]*wsc + n[0]*lift, cz[1] - s[1]*wsc + n[1]*lift, cz[2] - s[2]*wsc + n[2]*lift];
    const np = spine[i+1], nf = frame[i+1];
    const czn = [np.x + nf.d[0]*by*np.r, np.y + nf.d[1]*by*np.r, np.z + nf.d[2]*by*np.r];
    const wn = np.r * 0.9;
    const Ln = [czn[0] + nf.s[0]*wn + nf.d[0]*by*np.r*0.10, czn[1] + nf.s[1]*wn + nf.d[1]*by*np.r*0.10, czn[2] + nf.s[2]*wn + nf.d[2]*by*np.r*0.10];
    const Rn = [czn[0] - nf.s[0]*wn + nf.d[0]*by*np.r*0.10, czn[1] - nf.s[1]*wn + nf.d[1]*by*np.r*0.10, czn[2] - nf.s[2]*wn + nf.d[2]*by*np.r*0.10];
    quad(L, R, Rn, Ln); // scute band (raised, catches light as a ridge)
  }

  // Scale bumps: small raised pyramids around the tube (skip dorsal +
  // ventral where the fin/scutes already are), brick-offset per ring.
  for (let i = 1; i + 1 < spine.length; i++) {
    const p = spine[i], { s, d } = frame[i], t = T[i];
    if (p.r < 0.02) continue; // too fine near the tip
    const off = (i % 2) * 0.5;
    for (let kk = 0; kk < N; kk++) {
      const k = kk + off, a = (k / N) * 2 * Math.PI;
      const upness = Math.sin(a); if (Math.abs(upness) > 0.7) continue; // leave top/bottom
      const c = Math.cos(a), sn = Math.sin(a);
      const nx = c*s[0] + sn*d[0], ny = c*s[1] + sn*d[1], nz = c*s[2] + sn*d[2];
      const base = [p.x + p.r*nx, p.y + p.r*ny, p.z + p.r*nz];
      const bump = Math.max(0.004, p.r * 0.16);
      const apex = [base[0] + nx*bump, base[1] + ny*bump, base[2] + nz*bump];
      // small quad-ish scale around the base using tangent + a circumferential step
      const a2 = ((k + 0.9) / N) * 2 * Math.PI, c2 = Math.cos(a2), s2 = Math.sin(a2);
      const nx2 = c2*s[0] + s2*d[0], ny2 = c2*s[1] + s2*d[1], nz2 = c2*s[2] + s2*d[2];
      const side2 = [p.x + p.r*nx2, p.y + p.r*ny2, p.z + p.r*nz2];
      const fwd = [base[0] + t[0]*p.r*0.5, base[1] + t[1]*p.r*0.5, base[2] + t[2]*p.r*0.5];
      tri(base, side2, apex); tri(side2, fwd, apex); tri(fwd, base, apex);
    }
  }
  } // end argonian decorations

  if (kind === 'khajiit') {
    // FUR: short soft tufts all around the tube, angled back along the
    // tail, denser than scales -> a fuzzy silhouette. Bushier near the tip.
    for (let i = 1; i + 1 < spine.length; i++) {
      const p = spine[i], { s: sd, d } = frame[i], t = T[i];
      const bushy = i > spine.length - 5 ? 1.7 : 1.0; // fluff the tip
      const M = 7;
      for (let m = 0; m < M; m++) {
        const a = (m / M) * 2 * Math.PI + (i % 2) * 0.4, c = Math.cos(a), sn = Math.sin(a);
        const nx = c*sd[0] + sn*d[0], ny = c*sd[1] + sn*d[1], nz = c*sd[2] + sn*d[2];
        const base = [p.x + p.r*nx, p.y + p.r*ny, p.z + p.r*nz];
        const len = p.r * 0.85 * bushy;
        // tuft points outward and sweeps back along the tail
        const tip = [base[0] + nx*len - t[0]*len*0.7, base[1] + ny*len - t[1]*len*0.7, base[2] + nz*len - t[2]*len*0.7];
        const w = p.r * 0.16;
        const a2 = a + 0.5, c2 = Math.cos(a2), s2 = Math.sin(a2);
        const sx2 = c2*sd[0] + s2*d[0], sy2 = c2*sd[1] + s2*d[1], sz2 = c2*sd[2] + s2*d[2];
        const b2 = [p.x + p.r*sx2, p.y + p.r*sy2, p.z + p.r*sz2];
        tri(base, b2, tip);
      }
    }
  }

  return shadeTail(faces, skin);
}
