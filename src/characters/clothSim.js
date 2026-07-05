// Verlet cloth simulation for draped garments. Pure (no renderer): it
// integrates a pinned particle grid under gravity + wind, satisfies
// distance constraints, and COLLIDES every particle against the body
// each iteration so cloth physically cannot pass through it. Trailing,
// billow, and drape are all emergent - nothing is hand-authored. Runs
// headless (tested) and is inlined into the viewer for rendering.

// Build a per-height body collider from the measured core half-extents
// [[y, halfX, halfZ], ...] (descending y). Returns coreFn(y) -> [hx, hz].
export function makeCoreFn(CORE) {
  return function core(y) {
    if (y >= CORE[0][0]) return [CORE[0][1], CORE[0][2]];
    const last = CORE[CORE.length-1];
    if (y <= last[0]) return [last[1], last[2]];
    for (let i = 0; i+1 < CORE.length; i++) { const a = CORE[i], b = CORE[i+1]; if (y <= a[0] && y >= b[0]) { const t = (y-a[0])/(b[0]-a[0]); return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; } }
    return [0.2, 0.1];
  };
}

// grid: { rows, cols, wrap, pos:Float32Array(rows*cols*3), faces }
export function buildCloth(grid) {
  const V = grid.rows * grid.cols;
  const pos = Float32Array.from(grid.pos), prev = Float32Array.from(grid.pos), base = Float32Array.from(grid.pos);
  const pinned = new Uint8Array(V);
  for (let c = 0; c < grid.cols; c++) pinned[c] = 1;      // row 0 pinned to the body
  const idx = (r, c) => r * grid.cols + c;
  const con = [];
  const add = (i, j, stiff) => { const o=i*3, p=j*3; con.push([i, j, Math.hypot(pos[o]-pos[p], pos[o+1]-pos[p+1], pos[o+2]-pos[p+2]), stiff]); };
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    if (r+1 < grid.rows) add(idx(r,c), idx(r+1,c), 1.0);                 // structural: down
    const cw = grid.wrap ? (c+1)%grid.cols : (c+1 < grid.cols ? c+1 : -1);
    if (cw >= 0) add(idx(r,c), idx(r,cw), 1.0);                          // structural: around
    if (r+2 < grid.rows) add(idx(r,c), idx(r+2,c), 0.5);                 // bend: down
    const cw2 = grid.wrap ? (c+2)%grid.cols : (c+2 < grid.cols ? c+2 : -1);
    if (cw2 >= 0) add(idx(r,c), idx(r,cw2), 0.5);                        // bend: around
  }
  return { V, rows: grid.rows, cols: grid.cols, wrap: grid.wrap, pos, prev, base, pinned, con, faces: grid.faces };
}

// One fixed-timestep step. opts: { gy, gx, gz, damp, standoff, iters,
// pinDX, pinDY, pinDZ } - pin* shift the pinned top row (follow the body).
// Resolve a limb capsule (segment p0->p1, radii r0->r1): push the vertex
// to the nearest point on the capsule surface. Local, so cloth wraps the
// limb (a skirt drapes over the legs) with no radial spikes.
function pushCapsule(px, py, pz, C, SO) {
  const p0 = C.p0, p1 = C.p1;
  const abx=p1[0]-p0[0], aby=p1[1]-p0[1], abz=p1[2]-p0[2];
  const l2 = abx*abx + aby*aby + abz*abz || 1e-9;
  let t = ((px-p0[0])*abx + (py-p0[1])*aby + (pz-p0[2])*abz) / l2; t = Math.max(0, Math.min(1, t));
  const cx=p0[0]+abx*t, cy=p0[1]+aby*t, cz=p0[2]+abz*t;
  const R = (C.r0 + (C.r1 - C.r0)*t) + SO;
  let dx=px-cx, dy=py-cy, dz=pz-cz; const d = Math.hypot(dx, dy, dz);
  if (d >= R) return null;
  if (d < 1e-6) { dx = 0; dy = 0; dz = 1; }
  const f = R / Math.hypot(dx, dy, dz);
  return [cx + dx*f, cy + dy*f, cz + dz*f];
}
export function stepCloth(cloth, dt, opts, core) {
  const { pos, prev, base, pinned, con, V } = cloth;
  const gx = opts.gx||0, gy = opts.gy ?? -7.0, gz = opts.gz||0;
  const damp = opts.damp ?? 0.985, SO = opts.standoff ?? 0.030, iters = opts.iters ?? 6;
  const pinDX = opts.pinDX||0, pinDY = opts.pinDY||0, pinDZ = opts.pinDZ||0;
  const dt2 = dt*dt;
  for (let i = 0; i < V; i++) { if (pinned[i]) continue; const o=i*3;
    const px=pos[o], py=pos[o+1], pz=pos[o+2];
    pos[o]   = px + (px-prev[o])  *damp + gx*dt2;
    pos[o+1] = py + (py-prev[o+1])*damp + gy*dt2;
    pos[o+2] = pz + (pz-prev[o+2])*damp + gz*dt2;
    prev[o]=px; prev[o+1]=py; prev[o+2]=pz;
  }
  for (let i = 0; i < V; i++) if (pinned[i]) { const o=i*3; pos[o]=base[o]+pinDX; pos[o+1]=base[o+1]+pinDY; pos[o+2]=base[o+2]+pinDZ; prev[o]=pos[o]; prev[o+1]=pos[o+1]; prev[o+2]=pos[o+2]; }
  for (let k = 0; k < iters; k++) {
    for (let ci = 0; ci < con.length; ci++) { const c=con[ci], i=c[0], j=c[1], rest=c[2], stiff=c[3], oi=i*3, oj=j*3;
      let dx=pos[oj]-pos[oi], dy=pos[oj+1]-pos[oi+1], dz=pos[oj+2]-pos[oi+2];
      const d = Math.hypot(dx,dy,dz) || 1e-6, diff = ((d-rest)/d) * 0.5 * stiff;
      dx*=diff; dy*=diff; dz*=diff;
      if (!pinned[i]) { pos[oi]+=dx; pos[oi+1]+=dy; pos[oi+2]+=dz; }
      if (!pinned[j]) { pos[oj]-=dx; pos[oj+1]-=dy; pos[oj+2]-=dz; }
    }
    const caps = opts.capsules, trunkLo = opts.trunkLo ?? 0.80, trunkHi = opts.trunkHi ?? 1.56;
    for (let i = 0; i < V; i++) { if (pinned[i]) continue; const o=i*3;
      // limbs FIRST (bent legs + swinging arms)...
      if (caps) for (let ci = 0; ci < caps.length; ci++) { const hit = pushCapsule(pos[o], pos[o+1], pos[o+2], caps[ci], SO); if (hit) { pos[o]=hit[0]; pos[o+1]=hit[1]; pos[o+2]=hit[2]; } }
      // ...then the torso ellipse LAST (the body core wins - cloth ends outside it)
      const py = pos[o+1];
      if (!caps || (py >= trunkLo && py <= trunkHi)) {
        const ext = core(py), A = ext[0]+SO, C = ext[1]+SO;
        let px=pos[o], pz=pos[o+2]; let e = (px*px)/(A*A) + (pz*pz)/(C*C);
        if (e < 1) { if (e < 1e-9) { px = A; pz = 0; e = 1; } const f = 1/Math.sqrt(e); pos[o]=px*f; pos[o+2]=pz*f; }
      }
    }
  }
}

// Build the articulated limb collider (2 legs + 2 arms, each a 2-segment
// tapered capsule) for a pose. Applies the SAME transform the rig uses:
// the shin bends about the knee, the forearm about the elbow, then the
// whole limb swings about its root. g = geometry (joint Ys, x offsets,
// radii [thigh,knee,ankle] / [upper,elbow,wrist]); ang = per-limb
// { sw (swing), bd (bend) }. Returns an array of capsules for stepCloth.
export function articulatedCapsules(g, ang) {
  const rot = (y, z, pY, a) => { const c=Math.cos(a), s=Math.sin(a), dy=y-pY; return [pY + c*dy - s*z, s*dy + c*z]; };
  const caps = [];
  const leg = (x, sw, bd) => {
    const [ay, az]  = rot(g.ankleY, 0, g.kneeY, bd);   // shin bends about the knee
    const [ky, kz]  = rot(g.kneeY, 0, g.hipY, sw);     // then the leg swings about the hip
    const [ay2, az2] = rot(ay, az, g.hipY, sw);
    caps.push({ p0: [x, g.hipY, 0], p1: [x, ky, kz], r0: g.legR[0], r1: g.legR[1] });
    caps.push({ p0: [x, ky, kz], p1: [x, ay2, az2], r0: g.legR[1], r1: g.legR[2] });
  };
  // Legs only: arms hang OUTSIDE these garments, so the cloth must not
  // wrap them (skirts/robes/capes are not sleeves).
  leg(-g.legX, ang.legL.sw, ang.legL.bd); leg(g.legX, ang.legR.sw, ang.legR.bd);
  return caps;
}
