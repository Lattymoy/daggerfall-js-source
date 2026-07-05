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
export function buildCloth(grid, pinRows = 1) {
  const V = grid.rows * grid.cols;
  const pos = Float32Array.from(grid.pos), prev = Float32Array.from(grid.pos), base = Float32Array.from(grid.pos);
  const pinned = new Uint8Array(V);
  if (grid.pin) { pinned.set(grid.pin); }                 // explicit pin mask (strip garments)
  else { for (let r = 0; r < Math.min(pinRows, grid.rows); r++) for (let c = 0; c < grid.cols; c++) pinned[r*grid.cols + c] = 1; } // else top rows
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

// Resolve a limb capsule with TRUE 3D distance (correct for a tilted /
// swinging leg), but respond HORIZONTALLY so cloth can never ratchet up
// the leg. Detection uses the real closest point on the segment in 3D;
// the vertex keeps its height and its xz is moved so the 3D distance to
// that point equals the (tapered) radius - h = sqrt(R^2 - dy^2).
function pushCapsule(px, py, pz, C, SO) {
  const p0 = C.p0, p1 = C.p1;
  const abx = p1[0]-p0[0], aby = p1[1]-p0[1], abz = p1[2]-p0[2];
  const l2 = abx*abx + aby*aby + abz*abz || 1e-9;
  let t = ((px-p0[0])*abx + (py-p0[1])*aby + (pz-p0[2])*abz) / l2; t = Math.max(0, Math.min(1, t));
  const cx = p0[0]+abx*t, cy = p0[1]+aby*t, cz = p0[2]+abz*t;
  const R = (C.r0 + (C.r1 - C.r0)*t) + SO;
  const dx = px-cx, dy = py-cy, dz = pz-cz;
  if (dx*dx + dy*dy + dz*dz >= R*R) return null;          // true 3D: already clear
  let hx = px-cx, hz = pz-cz; let hd = Math.hypot(hx, hz);
  if (hd < 1e-6) { hx = 1; hz = 0; hd = 1; }
  const h2 = R*R - dy*dy;                                  // horizontal radius at this height
  const hTarget = h2 > 1e-8 ? Math.sqrt(h2) : R;           // beyond the cap: push to full R
  const f = hTarget / hd;
  return [cx + hx*f, py, cz + hz*f];                       // y unchanged (no climbing)
}
// One fixed-timestep step, in order: verlet integrate (gravity gx/gy/gz,
// per-step clamp maxStep) -> pin top rows (shifted by pinDX/DY/DZ to follow
// the body) -> distance constraints (iters) -> anti-pop clamp -> BONE-DRIVE
// (opts.bones, leg-drapes follow the legs) -> COLLISION (opts.capsules +
// body ellipse `core` + groundY, collisionPasses, standoff SO), which runs
// last so cloth always ends outside the body. `core` = makeCoreFn(BODY_CORE).
export function stepCloth(cloth, dt, opts, core) {
  const { pos, prev, base, pinned, con, V } = cloth;
  const start = pos.slice();
  const gx = opts.gx||0, gy = opts.gy ?? -7.0, gz = opts.gz||0;
  const damp = opts.damp ?? 0.985, SO = opts.standoff ?? 0.030, iters = opts.iters ?? 6;
  const pinDX = opts.pinDX||0, pinDY = opts.pinDY||0, pinDZ = opts.pinDZ||0;
  const dt2 = dt*dt;
  const maxStep = opts.maxStep ?? 0.035;   // clamp per-step move -> no verlet spikes
  for (let i = 0; i < V; i++) { if (pinned[i]) continue; const o=i*3;
    const px=pos[o], py=pos[o+1], pz=pos[o+2];
    let mvx = (px-prev[o])*damp + gx*dt2, mvy = (py-prev[o+1])*damp + gy*dt2, mvz = (pz-prev[o+2])*damp + gz*dt2;
    const mv = Math.hypot(mvx, mvy, mvz); if (mv > maxStep) { const f = maxStep/mv; mvx*=f; mvy*=f; mvz*=f; }
    pos[o]=px+mvx; pos[o+1]=py+mvy; pos[o+2]=pz+mvz;
    prev[o]=px; prev[o+1]=py; prev[o+2]=pz;
  }
  for (let i = 0; i < V; i++) if (pinned[i]) { const o=i*3; pos[o]=base[o]+pinDX; pos[o+1]=base[o+1]+pinDY; pos[o+2]=base[o+2]+pinDZ; prev[o]=pos[o]; prev[o+1]=pos[o+1]; prev[o+2]=pos[o+2]; }
  // satisfy distance constraints (no collision here - collision runs once
  // after, so it can't ratchet the cloth up the body)
  for (let k = 0; k < iters; k++) {
    for (let ci = 0; ci < con.length; ci++) { const c=con[ci], i=c[0], j=c[1], rest=c[2], stiff=c[3], oi=i*3, oj=j*3;
      let dx=pos[oj]-pos[oi], dy=pos[oj+1]-pos[oi+1], dz=pos[oj+2]-pos[oi+2];
      const d = Math.hypot(dx,dy,dz) || 1e-6, diff = ((d-rest)/d) * 0.5 * stiff;
      dx*=diff; dy*=diff; dz*=diff;
      if (!pinned[i]) { pos[oi]+=dx; pos[oi+1]+=dy; pos[oi+2]+=dz; }
      if (!pinned[j]) { pos[oj]-=dx; pos[oj+1]-=dy; pos[oj+2]-=dz; }
    }
  }
  // anti-pop: clamp the verlet+constraint move (the pop source) BEFORE
  // collision - collision then runs unclamped so it always fully ejects.
  const cap = opts.maxStep ?? 0.05;
  for (let i = 0; i < V; i++) { if (pinned[i]) continue; const o=i*3;
    let mx=pos[o]-start[o], my=pos[o+1]-start[o+1], mz=pos[o+2]-start[o+2]; const mm=Math.hypot(mx,my,mz);
    if (mm > cap) { const f=cap/mm; pos[o]=start[o]+mx*f; pos[o+1]=start[o+1]+my*f; pos[o+2]=start[o+2]+mz*f; } }
  const B = opts.bones;
  if (B) {
    const legX = B.legX, hipY = B.hipY, kneeY = B.kneeY, ankleY = B.ankleY, strength = B.strength ?? 0.9, bobv = B.bob ?? 0;
    const rot = (y, z, pY, a) => { const c=Math.cos(a), s=Math.sin(a), dy=y-pY; return [pY + c*dy - s*z, s*dy + c*z]; };
    // rigid-skin a vertex's OWN (ry,rz) to a leg: bend about the knee then
    // swing about the hip (exactly the rig's leg transform). This keeps a
    // constant offset from the leg surface, so it cannot clip.
    const xform = (leg, ry, rz) => { let y = ry, z = rz; if (ry < kneeY) { const r = rot(y, z, kneeY, leg.bd); y = r[0]; z = r[1]; } return rot(y, z, hipY, leg.sw); };
    const span = (hipY - ankleY) || 1;
    for (let i = 0; i < V; i++) { if (pinned[i]) continue; const o=i*3; const ry = base[o+1]; if (ry >= hipY) continue;
      const w = Math.min(1, (hipY - ry) / span) * strength;
      const rx = base[o], rz = base[o+2];
      const sL = Math.max(0, Math.min(1, (legX - rx) / (2*legX))), sR = 1 - sL;
      const tL = xform(B.legL, ry, rz), tR = xform(B.legR, ry, rz);
      const tx = rx, ty = sL*tL[0] + sR*tR[0] + bobv, tz = sL*tL[1] + sR*tR[1];   // bone target (x kept -> no buckle)
      pos[o]   += w*(tx - pos[o]); pos[o+1] += w*(ty - pos[o+1]); pos[o+2] += w*(tz - pos[o+2]);
      prev[o] = pos[o]; prev[o+1] = pos[o+1]; prev[o+2] = pos[o+2];
    }
  }

  // Collision resolve, ITERATED (collision-only - no constraints between,
  // so it converges the 3D response on tilted limbs without ratcheting).
  const caps = opts.capsules, groundY = opts.groundY ?? 0.02, cpasses = opts.collisionPasses ?? 6;
  for (let cp = 0; cp < cpasses; cp++) {
    for (let i = 0; i < V; i++) { if (pinned[i]) continue; const o=i*3;
      if (pos[o+1] < groundY) pos[o+1] = groundY;
      if (caps) for (let ci = 0; ci < caps.length; ci++) { const hit = pushCapsule(pos[o], pos[o+1], pos[o+2], caps[ci], SO); if (hit) { pos[o]=hit[0]; pos[o+1]=hit[1]; pos[o+2]=hit[2]; } }
      { const ext = core(pos[o+1]), A = ext[0]+SO, C = ext[1]+SO;
        let px=pos[o], pz=pos[o+2]; let e = (px*px)/(A*A) + (pz*pz)/(C*C);
        if (e < 1) { if (e < 1e-9) { px = A; pz = 0; e = 1; } const f = 1/Math.sqrt(e); pos[o]=px*f; pos[o+2]=pz*f; } }
    }
  }

}

// Build the leg collider (2 legs, each a 2-segment tapered capsule: thigh
// + shin) for a pose, using the SAME transform the rig uses - the shin
// bends about the knee, then the leg swings about the hip. Arms are NOT
// collided: they hang outside these garments (skirts/robes aren't sleeves).
// g = { legX, hipY, kneeY, ankleY, legR:[thigh,knee,ankle] }; ang = per-leg
// { sw (swing), bd (bend) }. Returns capsules for stepCloth's opts.capsules.
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
