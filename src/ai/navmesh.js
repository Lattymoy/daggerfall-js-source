// In-house navmesh (Recast / Detour in spirit), baked from the arena colliders at load. The AI talks to
// exactly one entry point - findPath(chf, start, goal) -> waypoints | null - so the pathing internals can
// grow slice by slice behind it without the AI ever changing. Built up across Stage 4:
//   4.1 (done): solid heightfield - voxelize the colliders (boxes + ramps) into per-cell solid spans.
//   4.2 (done): walkable filter (clearance + max-slope + climbable step) + radius erosion -> compact hf.
//   4.3: 4.3a regions (done) -> 4.3b contours (done; boundary trace + Douglas-Peucker, portal neighbours)
//        -> 4.3c poly mesh (done; ear-clip + convex merge + portal adjacency) -> 4.3d detail height (done;
//        snap verts onto the surface + a surfaceY-query height layer, since we keep the surface source).
//   4.4 (done): locate endpoints -> poly-graph A* -> funnel (string-pull) the corridor into taut waypoints.
//   4.5+: enemies path via findPath + repath + local avoidance.
// ENHANCED AI 1 (2026-09-02): THIS IS project-final's navmesh.js, PORTED WHOLE.
// Mac's own code, brought across byte-for-byte but for two lines, so that
// everything proven there - the pipeline, the funnel, the obstacles, the
// bake - is what runs here. Do not re-derive; a change is made in both
// repos and said in both.
//
// THE TWO LINES. (1) project-final imports surfaceY from its terrain
// module; that function is four lines and is inlined here EXACTLY. (2)
// bakeNavData/hydrateBakedNav use Buffer/btoa/atob, which are host
// globals - declared for the linter, unchanged in behaviour.
//
// THE GROUND NEEDS NO SEAM: buildNav already takes `ground` - { at(x, z),
// min } - and lays the implicit floor from ground.at when one is given
// (project-final's terrain worlds). Daggerfall's Collider.heightAt IS
// that, and the caller hands it in as { at: heightAt, min: <lowest> }.
/* global Buffer, btoa, atob */
// project-final/src/game/terrain.js:17-22, verbatim: a box's top, or a ramp's plane at (x, z).
function surfaceY(c, x, z) {
  if (!c.ramp) return c.top;
  const span = c.axis === 'x' ? (x - c.x0) / (c.x1 - c.x0) : (z - c.z0) / (c.z1 - c.z0);
  const t = span < 0 ? 0 : span > 1 ? 1 : span;
  return c.yLo + (c.yHi - c.yLo) * t;
}

// Agent params - set ONCE here, never per level; the bake adapts to whatever geometry it is handed.
// radius / height / maxStep / maxSlope drive the walkable filter (4.2+); cs / ch are the voxel sizes.
export const AGENT = {
  radius: 0.4, // player collision radius (the move-resolve R) - the walkable area is eroded by this in 4.2
  height: 1.7, // standing clearance needed above a surface to walk it
  maxStep: 0.4, // STEP_UP - max height jump between adjacent walkable cells
  maxSlope: 0.7, // max walkable rise/run (~35 deg); steeper voxel surfaces are not floor
  cs: 0.25, // xz cell size
  ch: 0.2, // y voxel height
};

// ── 4.1: solid heightfield ──────────────────────────────────────────────────────────────────────
// Voxelize the colliders into a grid of columns; each column is a sorted list of solid spans
// { smin, smax } in voxel units (solid from ymin + smin*ch up to ymin + smax*ch). The implicit ground
// plane (y = 0) is laid down as a floor under every cell. Ramp columns sample terrain.surfaceY - the same
// plane the mover and the bullet rays read - so the nav's ground and the game's ground are one source.
// Bound the nav grid for very large maps: an open field (the Atoll ~300m) at 0.25m cells is ~600k cells,
// a multi-second bake. Once the raw count clears BUDGET (set well above every arena/dive, so they keep
// AGENT.cs and stay byte-identical) coarsen cs to land near TARGET. Open terrain does not need fine cells.
export function coarsenAgent(colliders, agent = AGENT, budget = 250000, target = 80000) {
  let xmn = Infinity, xmx = -Infinity, zmn = Infinity, zmx = -Infinity;
  for (const c of colliders) { if (c.rayOnly) continue; if (c.x0 < xmn) xmn = c.x0; if (c.x1 > xmx) xmx = c.x1; if (c.z0 < zmn) zmn = c.z0; if (c.z1 > zmx) zmx = c.z1; }
  const raw = ((xmx - xmn) / agent.cs) * ((zmx - zmn) / agent.cs);
  if (raw <= budget) return undefined;
  const cs = Math.min(1.05, agent.cs * Math.sqrt(raw / target)); // capped at structure scale: coarser than ~1m and one erosion ring seals doorways, bridge decks, and stall gaps - the cap trades bake time for a nav that can still enter buildings
  return { ...agent, cs };
}

export function buildNav(colliders, agent = AGENT, holes = [], ground = null) {
  const { cs, ch } = agent;
  // bounds from the colliders (the perimeter walls set the extent) + the tallest solid
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity, top = 0;
  for (const c of colliders) {
    if (c.rayOnly) continue; // overhead cover (roofs) is ray-only: no nav footprint, no extent contribution
    xmin = Math.min(xmin, c.x0); xmax = Math.max(xmax, c.x1);
    zmin = Math.min(zmin, c.z0); zmax = Math.max(zmax, c.z1);
    top = Math.max(top, c.ramp ? Math.max(c.yLo, c.yHi) : c.top);
  }
  let ybase = 0; if (ground) { ybase = ground.min ?? -6; } // a terrain world's floor can sit below 0 (seabed)
  const ymin = ybase - ch, ymax = top + ch; // one voxel below the lowest ground; cover the tallest solid
  const nx = Math.max(1, Math.ceil((xmax - xmin) / cs));
  const nz = Math.max(1, Math.ceil((zmax - zmin) / cs));
  const ny = Math.max(1, Math.ceil((ymax - ymin) / ch));
  const cells = Array.from({ length: nx * nz }, () => []);

  // add a solid span [y0,y1] (world) to a cell, coalescing with any it touches (spans stay sorted).
  // `topW` is whether the surface forming this span's TOP is walkable by slope; on a merge the higher
  // of the two tops owns the flag (you stand on the highest surface), so a flat box top over the ground
  // keeps `true` while a too-steep ramp top stamps `false` onto its column.
  const addSpan = (ix, iz, y0, y1, topW) => {
    let smin = Math.floor((y0 - ymin) / ch), smax = Math.ceil((y1 - ymin) / ch);
    if (smin < 0) smin = 0;
    if (smax > ny) smax = ny;
    if (smax <= smin) return;
    const list = cells[ix + iz * nx];
    let lo = smin, hi = smax, top = topW, i = 0;
    while (i < list.length) {
      const s = list[i];
      if (s.smax < lo) { i++; continue; } // entirely below
      if (s.smin > hi) break; // entirely above -> insert here
      if (s.smax > hi) { hi = s.smax; top = s.walkable; } // absorbed span is taller -> its top surface wins
      lo = Math.min(lo, s.smin); list.splice(i, 1); // touches/overlaps -> absorb
    }
    list.splice(i, 0, { smin: lo, smax: hi, walkable: top });
  };

  // ground floor under every cell, EXCEPT over a kill-zone hole: supportY drops to -depth there so nav ground must vanish too, else agents walk the void (a causeway's own span below keeps bridges walkable).
  const inHole = holes.length ? (x, z) => holes.some((h) => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1) : null;
  // the implicit floor: y=0 for arenas, or the TERRAIN SURFACE when a terrain world provides one (the
  // seabed wades, the beaches slope, and there is no phantom plane to walk on over open water).
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const cx = xmin + (ix + 0.5) * cs, cz = zmin + (iz + 0.5) * cs;
    if (inHole && inHole(cx, cz)) continue;
    addSpan(ix, iz, ymin, ground ? ground.at(cx, cz) : 0, true);
  }

  // colliders -> solid columns (conservative: every cell the footprint touches, so thin walls never leak)
  for (const c of colliders) {
    if (c.rayOnly) continue; // roofs block rays only; they must not stamp a solid column (you walk freely under them)
    const base = c.ramp ? Math.min(c.yLo, c.yHi) : (c.bottom != null ? c.bottom : (c.top < 0 ? ymin : 0)); // E1: `bottom` makes a collider solid only from there up, so the column keeps the space beneath and addSpan's multi-span machinery models a real second floor - it always could; only this line prevented it. No bottom = the old rule, exactly. A below-zero top (seabed terraces) is solid from the world's base, or its span inverts away
    // box tops are flat (walkable); a ramp top is walkable only if its rise/run is within maxSlope.
    // noNavTop stamps FALSE outright: solid for movement and rays, never floor for the nav - the map
    // synth's rock massif wears it, because a walkable massif ROOF is a giant component the
    // largest-component rule can prefer over the real interiors (a gate top once WELDED two roof
    // fragments into the map's biggest 'floor' and every room died - the census that found it lives
    // in the Map-Synthesis arc doc).
    const slopeOK = c.noNavTop ? false : c.ramp ? Math.abs((c.yHi - c.yLo) / (c.axis === 'x' ? c.x1 - c.x0 : c.z1 - c.z0)) <= agent.maxSlope : true;
    const ix0 = Math.max(0, Math.floor((c.x0 - xmin) / cs)), ix1 = Math.min(nx - 1, Math.ceil((c.x1 - xmin) / cs) - 1);
    const iz0 = Math.max(0, Math.floor((c.z0 - zmin) / cs)), iz1 = Math.min(nz - 1, Math.ceil((c.z1 - zmin) / cs) - 1);
    const ob = c.obb; // a rotated collider's x0..x1/z0..z1 is the WIDENED broad-phase box: stamping it verbatim
    // bleeds the block diagonally past its true footprint (an angled bridge rail once striped noNavTop
    // across its own deck). Test each cell centre against the OBB, dilated by the cell's half-diagonal
    // so the stamp stays conservative (every cell the true footprint touches, none it does not).
    const dil = ob ? cs * 0.71 : 0;
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const cx = xmin + (ix + 0.5) * cs, cz = zmin + (iz + 0.5) * cs;
      if (ob) {
        const rx = cx - ob.cx, rz = cz - ob.cz;
        const lu = Math.abs(rx * ob.cs + rz * ob.sn), lw = Math.abs(-rx * ob.sn + rz * ob.cs);
        if (lu > ob.hu + dil || lw > ob.hw + dil) continue; // outside the true footprint
      }
      const sx = cx < c.x0 ? c.x0 : cx > c.x1 ? c.x1 : cx; // clamp the sample into the footprint (edge cells)
      const sz = cz < c.z0 ? c.z0 : cz > c.z1 ? c.z1 : cz;
      addSpan(ix, iz, base, surfaceY(c, sx, sz), slopeOK); // box: flat top; ramp: the plane height here
    }
  }
  return { agent, cs, ch, xmin, zmin, ymin, nx, nz, ny, cells };
}

// world height of a cell's top solid surface (top of its highest span), or null if the cell is empty
export function cellTopY(nav, ix, iz) {
  const list = nav.cells[ix + iz * nav.nx];
  if (!list || !list.length) return null;
  return nav.ymin + list[list.length - 1].smax * nav.ch;
}

// ── debug-draw: the top solid surface of each column as an up-facing quad, height-coloured ──────────
// "Seen, not trusted" - this shows what the voxelizer captured (floor, box tops, the ramp as ch-stepped
// bands, the plateau, the wall strips), lifted a hair off the real surface to avoid z-fighting.
export function navDebugFaces(nav) {
  if (!nav) return []; // a hydrated (compiled) map keeps no raw heightfield - the __nav overlay simply has nothing to draw
  const { cs, ch, xmin, zmin, ymin, nx, nz } = nav;
  const out = [];
  const lo = [40, 90, 140], hi = [245, 130, 60]; // height ramp: low -> high
  let maxTop = ymin + ch;
  for (let i = 0; i < nx * nz; i++) { const y = cellTopY(nav, i % nx, (i / nx) | 0); if (y != null && y > maxTop) maxTop = y; }
  const span = maxTop - ymin || 1;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const yTop = cellTopY(nav, ix, iz);
    if (yTop == null) continue;
    const t = (yTop - ymin) / span, y = yTop + 0.02;
    const col = [lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t];
    const x0 = xmin + ix * cs, x1 = x0 + cs, z0 = zmin + iz * cs, z1 = z0 + cs;
    out.push({ p: [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], n: [0, 1, 0], c: col });
  }
  return out;
}

// ── 4.2: compact heightfield - walkable surface + step links + radius erosion ─────────────────────
// Invert the solid spans into the open surface above each one: a compact span sits on a solid top with
// `clear` voxels of headroom. It is walkable when that headroom fits the agent AND its source surface is
// within maxSlope (tagged at voxelize); walkable spans link to neighbours within one climbable step; then
// the area is eroded by the agent radius so a routed path's centre keeps clear of walls. A chamfer
// distance field drives the erosion (and feeds 4.3's watershed).
// Thin tops dissolve here for free: walls, dividers and the railing are all <= 0.5m strips the radius
// erosion eats entirely. Chunky disconnected surfaces survive 4.2 though - a 2m plateau crate top keeps
// a walkable core, and nothing links down to it (the step up is too big), so it is an unreachable island
// left for 4.3's region min-size to cull. The reachable surface is ground + ramp + plateau.
const DX = [1, 0, -1, 0], DZ = [0, 1, 0, -1]; // dir 0:+x  1:+z  2:-x  3:-z

export function buildCompact(nav, agent = nav.agent) {
  const { cs, ch, nx, nz, ny, xmin, zmin, ymin, cells } = nav;
  const climb = Math.floor(agent.maxStep / ch); // climbable step between cells, in voxels (matches the mover's STEP_UP)
  const headroom = Math.ceil(agent.height / ch); // standing clearance needed above a surface, in voxels
  const spans = Array.from({ length: nx * nz }, () => []);

  // one compact span per solid top: the open column above it, up to the next solid - or unbounded
  // (open to the sky) for the topmost solid, so a high flat surface like the plateau is not falsely
  // ceilinged by the grid top (ny only covers the tallest solid, not the headroom an agent needs there)
  for (let i = 0; i < nx * nz; i++) {
    const col = cells[i];
    for (let k = 0; k < col.length; k++) {
      const floor = col[k].smax, clear = (k + 1 < col.length ? col[k + 1].smin : ny + headroom) - floor;
      spans[i].push({ floor, clear, walkable: clear >= headroom && col[k].walkable, dist: 0, reg: 0, con: [-1, -1, -1, -1] });
    }
  }

  const span = (ix, iz, s) => spans[ix + iz * nx][s];

  // link walkable neighbours when the step is climbable and the shared headroom still fits the agent
  const link = () => {
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) for (const a of spans[ix + iz * nx]) {
      a.con = [-1, -1, -1, -1];
      if (!a.walkable) continue;
      for (let d = 0; d < 4; d++) {
        const jx = ix + DX[d], jz = iz + DZ[d];
        if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const nb = spans[jx + jz * nx];
        for (let t = 0; t < nb.length; t++) {
          const b = nb[t];
          if (!b.walkable || Math.abs(b.floor - a.floor) > climb) continue;
          if (Math.min(a.floor + a.clear, b.floor + b.clear) - Math.max(a.floor, b.floor) < headroom) continue;
          a.con[d] = t; break;
        }
      }
    }
  };

  // chamfer distance field: a walkable span missing any link is a border (0); interiors grow over two
  // sweeps (axial cost 2, diagonal 3). Faithful to Recast so the values feed the 4.3 watershed unchanged.
  const calcDist = () => {
    for (let i = 0; i < nx * nz; i++) for (const a of spans[i]) {
      if (!a.walkable) continue;
      a.dist = a.con[0] < 0 || a.con[1] < 0 || a.con[2] < 0 || a.con[3] < 0 ? 0 : 0xffff;
    }
    const sweep = (ix, iz, pairs) => { for (const s of spans[ix + iz * nx]) { if (!s.walkable) continue;
      for (const [d, e] of pairs) {
        if (s.con[d] < 0) continue;
        const jx = ix + DX[d], jz = iz + DZ[d], b = span(jx, jz, s.con[d]);
        if (b.dist + 2 < s.dist) s.dist = b.dist + 2;
        if (b.con[e] < 0) continue;
        const c = span(jx + DX[e], jz + DZ[e], b.con[e]);
        if (c.dist + 3 < s.dist) s.dist = c.dist + 3;
      } } };
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) sweep(ix, iz, [[2, 3], [3, 0]]); // forward: -x,-z + their diagonals
    for (let iz = nz - 1; iz >= 0; iz--) for (let ix = nx - 1; ix >= 0; ix--) sweep(ix, iz, [[0, 1], [1, 2]]); // backward: +x,+z + their diagonals
  };

  link();
  calcDist();
  const erodeThr = (agent.radius / cs) * 2; // axial cost is 2 per cell, so (radius in cells) * 2
  for (let i = 0; i < nx * nz; i++) for (const a of spans[i]) if (a.walkable && a.dist < erodeThr) a.walkable = false;
  link(); // re-link over the eroded set
  calcDist(); // final field, for the debug colour + the 4.3 watershed

  return { agent, cs, ch, xmin, zmin, ymin, nx, nz, ny, spans, climb, headroom };
}

// ── debug-draw: the walkable surface after erosion, coloured by the distance field (edge -> interior) ─
export function compactDebugFaces(chf) {
  const { cs, ch, xmin, zmin, ymin, nx, nz, spans } = chf;
  let maxD = 1;
  for (let i = 0; i < nx * nz; i++) for (const a of spans[i]) if (a.walkable && a.dist < 0xffff && a.dist > maxD) maxD = a.dist;
  const edge = [70, 200, 90], mid = [240, 220, 70]; // near a wall (low dist) -> deep interior (high dist)
  const out = [];
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) for (const a of spans[ix + iz * nx]) {
    if (!a.walkable) continue;
    const t = Math.min(1, a.dist / maxD), y = ymin + a.floor * ch + 0.03;
    const col = [edge[0] + (mid[0] - edge[0]) * t, edge[1] + (mid[1] - edge[1]) * t, edge[2] + (mid[2] - edge[2]) * t];
    const x0 = xmin + ix * cs, x1 = x0 + cs, z0 = zmin + iz * cs, z1 = z0 + cs;
    out.push({ p: [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], n: [0, 1, 0], c: col });
  }
  return out;
}

// ── 4.3a: regions - watershed partition of the walkable surface (Recast rcBuildRegions in spirit) ──
// Flood the distance field from its ridges down to the borders, growing regions one water level at a
// time, so the walkable area splits into a handful of well-shaped chunks (rooms / corridor runs) whose
// contours 4.3b will trace. Slivers merge into their largest neighbour; disconnected components (the
// unreachable crate tops the audit flagged) are culled. Writes span.reg (1..M, 0 = none) and clears
// walkable on culled spans, so the surface that remains is exactly the reachable floor.
export function buildRegions(chf, opts = {}) {
  const { nx, nz, spans, cs } = chf;
  const mergeArea = opts.mergeRegionArea ?? Math.round(2 / (cs * cs));    // merge regions below ~2 m^2 into a neighbour
  const minComponent = opts.minComponentArea ?? Math.round(4 / (cs * cs)); // cull disconnected components below ~4 m^2

  // flatten the walkable spans into gids + neighbour gids (the watershed wants flat arrays). g is a temp
  // index on each span; set on ALL spans first so the neighbour pass can read across cells, deleted at end.
  let N = 0;
  for (let i = 0; i < nx * nz; i++) for (const s of spans[i]) s.g = s.walkable ? N++ : -1;
  const dist = new Int32Array(N), reg = new Int32Array(N), buf = new Int32Array(N);
  const nbr = new Int32Array(N * 4).fill(-1);
  const owner = new Array(N);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) for (const s of spans[ix + iz * nx]) {
    if (!s.walkable) continue;
    const g = s.g; dist[g] = s.dist; owner[g] = s;
    for (let d = 0; d < 4; d++) { const t = s.con[d]; if (t >= 0) nbr[g * 4 + d] = spans[(iz + DZ[d]) * nx + ix + DX[d]][t].g; }
  }

  // grow existing regions outward into unassigned cells with dist >= lvl (double-buffered; bounded iters,
  // or unbounded when maxIter < 0). Each cell takes the neighbouring region whose own dist is closest.
  const expand = (maxIter, lvl) => {
    const fringe = [];
    for (let g = 0; g < N; g++) if (reg[g] === 0 && dist[g] >= lvl) fringe.push(g);
    for (let iter = 0; maxIter < 0 || iter < maxIter; iter++) {
      for (const g of fringe) {
        if (reg[g] !== 0) { buf[g] = 0; continue; }
        let r = 0, best = 0x7fffffff;
        for (let d = 0; d < 4; d++) { const n = nbr[g * 4 + d]; if (n >= 0 && reg[n] !== 0 && dist[n] + 2 < best) { best = dist[n] + 2; r = reg[n]; } }
        buf[g] = r;
      }
      let changed = 0;
      for (const g of fringe) if (reg[g] === 0 && buf[g] !== 0) { reg[g] = buf[g]; changed++; }
      if (!changed) break;
    }
  };

  // flood a fresh region from a seed at the given water level, refusing any cell that already touches a
  // different region (those stay 0 and get absorbed by the next expand, keeping a 1-cell seam between regions).
  const stack = [];
  const flood = (seed, lvl, r) => {
    const fl = lvl >= 2 ? lvl - 2 : 0;
    stack.length = 0; stack.push(seed); reg[seed] = r;
    let count = 0;
    while (stack.length) {
      const g = stack.pop();
      let touchesOther = false;
      for (let d = 0; d < 4; d++) { const n = nbr[g * 4 + d]; if (n >= 0 && reg[n] !== 0 && reg[n] !== r) { touchesOther = true; break; } }
      if (touchesOther) { reg[g] = 0; continue; }
      count++;
      for (let d = 0; d < 4; d++) { const n = nbr[g * 4 + d]; if (n >= 0 && reg[n] === 0 && dist[n] >= fl) { reg[n] = r; stack.push(n); } }
    }
    return count > 0;
  };

  let maxDist = 0; for (let g = 0; g < N; g++) if (dist[g] > maxDist) maxDist = dist[g];
  let level = (maxDist + 1) & ~1, regionId = 1;
  while (level > 0) {
    level = level >= 2 ? level - 2 : 0;
    expand(8, level);
    for (let g = 0; g < N; g++) if (reg[g] === 0 && dist[g] >= level) { if (flood(g, level, regionId)) regionId++; }
  }
  expand(-1, 0); // unbounded final fill: assign the seam cells the floods left at 0

  // ── region stats: cell counts + adjacency graph ──
  const nreg = regionId;
  const count = new Int32Array(nreg);
  const adj = Array.from({ length: nreg }, () => new Set());
  for (let g = 0; g < N; g++) { const r = reg[g]; if (!r) continue; count[r]++;
    for (let d = 0; d < 4; d++) { const n = nbr[g * 4 + d]; if (n < 0) continue;
      if (reg[n] && reg[n] !== r) adj[r].add(reg[n]);
      else if (!reg[n]) for (let d2 = 0; d2 < 4; d2++) { const m = nbr[n * 4 + d2]; if (m >= 0 && reg[m] && reg[m] !== r) adj[r].add(reg[m]); } // a watershed SEAM cell (reg 0, 1 cell by construction) can be the whole bottleneck: bridge adjacency THROUGH it, or two cell-linked regions never meet and the cull severs a connected world (the tide trail died at exactly such a squeeze)
    } }

  // remap[] folds merged/culled regions onto a survivor; resolve() follows the chain
  const remap = new Int32Array(nreg); for (let r = 0; r < nreg; r++) remap[r] = r;
  const resolve = (r) => { while (remap[r] !== r) r = remap[r]; return r; };

  // merge slivers (regions below mergeArea) into their largest connected neighbour, smallest first
  for (const r0 of [...Array(nreg).keys()].filter((r) => r > 0).sort((a, b) => count[a] - count[b])) {
    const r = resolve(r0); if (r === 0 || count[r] >= mergeArea || count[r] === 0) continue;
    let best = 0, bestC = -1;
    for (const m0 of adj[r]) { const m = resolve(m0); if (m !== r && count[m] > bestC) { bestC = count[m]; best = m; } }
    if (!best) continue;
    remap[r] = best; count[best] += count[r]; count[r] = 0;
    for (const m0 of adj[r]) { const m = resolve(m0); if (m !== best) { adj[best].add(m); adj[m].add(best); } }
  }

  // connected components over the post-merge region graph. The walkable navmesh is the LARGEST component (the
  // reachable play area); every other component is unreachable on foot (no climbable link bridges it) and is
  // culled regardless of size. A size-only rule missed large unreachable islands - the bowl's crystal-core TOP
  // (a 3.6m platform with no ramp) and a sealed floor pocket behind the west ramp both cleared the old area
  // threshold and showed up as phantom walkable surface. minComponent still drops tiny slivers.
  const comp = new Int32Array(nreg).fill(-1), compArea = [];
  for (let r = 1; r < nreg; r++) { const rr = resolve(r); if (count[rr] === 0 || comp[rr] >= 0) continue;
    const id = compArea.length, q = [rr]; comp[rr] = id; let area = 0;
    while (q.length) { const x = q.pop(); area += count[x];
      for (const y0 of adj[x]) { const y = resolve(y0); if (count[y] > 0 && comp[y] < 0) { comp[y] = id; q.push(y); } } }
    compArea.push(area);
  }
  let largestComp = 0; for (let i = 1; i < compArea.length; i++) if (compArea[i] > compArea[largestComp]) largestComp = i; // the reachable play area
  // FOUNDRY S3: an optional ANCHOR beats raw size. Size-only picked the WRONG side of a closed boss
  // seal the moment the sealed chamber out-areaed the playable world (a 1-arena core dive culled the
  // mouth + the arena + every corridor - the whole pre-gate game). The navmesh exists to serve agents
  // in the SPAWN's world: when the caller names an anchor, its component is the play area; no anchor
  // (or an anchor standing on culled/rock ground) falls back to the old size rule byte-for-byte.
  // FOUNDRY S3 -> the EXPERIMENT INTEGRATION: anchored component election, now a UNION.
  // History: size-only picked a sealed boss chamber over the playable world (S3); a single spawn
  // anchor then picked the strike's one-way balcony (the 25% share guard fixed that); the procedural
  // dungeon experiment finally presented a LEGITIMATELY SEGMENTED world - lethal shaft rooms whose
  // stepping islands wall the ground lane, so the dive's rear half shares no component with the
  // spawn and single-election starves it either way. The resolution: callers name EVERY place agents
  // live (the spawn + each fight's entry); the union of those components IS the play area. Scenery
  // still dies for the old reasons - no anchor ever stands on a moat, a massif roof, or an apron.
  // No anchors (or none landing) = the old size rule, byte-for-byte.
  const anchors = opts.anchors ?? (opts.anchor ? [opts.anchor] : null);
  const keep = new Set();
  if (anchors) {
    for (const a of anchors) {
      const ax = Math.floor((a.x - chf.xmin) / chf.cs), az = Math.floor((a.z - chf.zmin) / chf.cs);
      if (ax < 0 || az < 0 || ax >= chf.nx || az >= chf.nz) continue;
      let pick = null, pickDy = Infinity; const ay = a.y ?? 0;
      for (const s of chf.spans[ax + az * chf.nx]) { if (s.g === undefined || s.g < 0) continue; const rr = resolve(reg[s.g]); if (!rr || count[rr] <= 0 || comp[rr] < 0) continue; // mid-function, region ids live in the flat reg[] keyed by the temp s.g
        const dy = Math.abs((chf.ymin + s.floor * chf.ch) - ay); if (dy < pickDy) { pickDy = dy; pick = comp[rr]; } } // NEAREST the anchor's height, not first-in-list (an abyss floor 22m down is the column's first span)
      if (pick != null && compArea[pick] >= minComponent) keep.add(pick);
    }
  }
  if (!keep.size) keep.add(largestComp);
  const culled = new Uint8Array(nreg);
  for (let r = 1; r < nreg; r++) { const rr = resolve(r); if (count[rr] > 0 && (!keep.has(comp[rr]) || compArea[comp[rr]] < minComponent)) culled[rr] = 1; }

  // ── write back: compact surviving ids to 1..M; drop culled spans off the walkable set ──
  const finalId = new Int32Array(nreg); let M = 0;
  for (let r = 1; r < nreg; r++) { const rr = resolve(r); if (count[rr] > 0 && !culled[rr] && finalId[rr] === 0) finalId[rr] = ++M; }
  for (let g = 0; g < N; g++) { const s = owner[g], rr = resolve(reg[g]);
    if (!rr || culled[rr]) { s.walkable = false; s.reg = 0; } else s.reg = finalId[rr]; }
  for (let i = 0; i < nx * nz; i++) for (const s of spans[i]) delete s.g;

  chf.nreg = M;
  return chf;
}

// ── debug-draw: the walkable surface coloured by region id (golden-ratio hue spacing -> distinct rooms) ─
export function regionDebugFaces(chf) {
  const { cs, ch, xmin, zmin, ymin, nx, nz, spans } = chf;
  const colour = (r) => { const h = ((r * 0.61803398875) % 1) * 6, x = 1 - Math.abs((h % 2) - 1);
    const [R, G, B] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
    return [55 + R * 185, 55 + G * 185, 55 + B * 185]; };
  const out = [];
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) for (const s of spans[ix + iz * nx]) {
    if (!s.walkable || !s.reg) continue;
    const y = ymin + s.floor * ch + 0.04;
    const x0 = xmin + ix * cs, x1 = x0 + cs, z0 = zmin + iz * cs, z1 = z0 + cs;
    out.push({ p: [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], n: [0, 1, 0], c: colour(s.reg) });
  }
  return out;
}

// ── 4.3b: contours - trace each region's boundary and simplify it to a polygon outline ──
// Walk the region/void edges of a region into a closed CCW loop of cell-corner vertices (Recast
// walkContour, dir convention adapted to ours: on a boundary edge add the corner + turn CW, on an open
// edge step into the neighbour + turn CCW), then Douglas-Peucker the loop within maxError - keeping any
// vertex where the neighbouring region changes, since those are the portals 4.3c stitches. Each contour
// vertex stores the region across the edge that starts at it (0 = void / wall). A region that wraps an
// obstacle traces an extra inner (CW) loop. Output is grid-corner coords (exact); world is for the draw.
export function buildContours(chf, opts = {}) {
  const { nx, nz, spans, ch, ymin } = chf;
  const maxError = opts.maxError ?? 0.5; // Douglas-Peucker deviation threshold, in cells. <= 0.5 keeps the
  // simplified boundary within half a cell of the true one, so it never crosses a cell centre - the poly mesh
  // then tiles the walkable surface exactly (no cell mis-covered, no poly overhanging a wall). Audit-chosen.
  // trace in our own dir convention throughout (module DX/DZ, con indexed by dir directly) - dir 0:+x 1:+z 2:-x 3:-z

  // boundary flag per walkable span: bit rdir set when the neighbour across rdir is a different region or void
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) for (const s of spans[ix + iz * nx]) {
    if (!s.walkable || !s.reg) { s.cf = 0; continue; }
    let f = 0;
    for (let rd = 0; rd < 4; rd++) {
      const t = s.con[rd]; let rn = 0;
      if (t >= 0) { const nb = spans[(iz + DZ[rd]) * nx + ix + DX[rd]][t]; rn = nb.walkable ? nb.reg : 0; }
      if (rn !== s.reg) f |= 1 << rd;
    }
    s.cf = f;
  }

  // walk one boundary loop from (ix,iz,s) on its first set edge, clearing edges as it goes -> raw vertices
  const walk = (ix, iz, s) => {
    const raw = [];
    let rd = 0; while ((s.cf & (1 << rd)) === 0) rd++;
    const startDir = rd; let cx = ix, cz = iz, cur = s;
    do {
      if (cur.cf & (1 << rd)) {
        let px, pz; // CCW corner for this edge (derived for our dir layout)
        if (rd === 0) { px = cx + 1; pz = cz; } else if (rd === 1) { px = cx + 1; pz = cz + 1; }
        else if (rd === 2) { px = cx; pz = cz + 1; } else { px = cx; pz = cz; }
        const t = cur.con[rd]; let rn = 0;
        if (t >= 0) { const nb = spans[(cz + DZ[rd]) * nx + cx + DX[rd]][t]; rn = nb.walkable ? nb.reg : 0; }
        raw.push({ x: px, z: pz, y: ymin + cur.floor * ch, rn });
        cur.cf &= ~(1 << rd);
        rd = (rd + 1) & 3;
      } else {
        const t = cur.con[rd];
        cx += DX[rd]; cz += DZ[rd]; cur = spans[cz * nx + cx][t];
        rd = (rd + 3) & 3;
      }
    } while (!(cur === s && rd === startDir));
    return raw;
  };

  // squared perpendicular distance from p to segment a-b in the xz plane (cell units)
  const distSq = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    let t = 0; if (d2 > 0) t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / d2));
    const ex = a.x + t * dx - p.x, ez = a.z + t * dz - p.z; return ex * ex + ez * ez;
  };

  // simplify a raw loop: keep the region-change vertices as anchors, then Douglas-Peucker the runs between them
  const simplify = (raw) => {
    const n = raw.length;
    let anchors = [];
    for (let i = 0; i < n; i++) if (raw[i].rn !== raw[(i + n - 1) % n].rn) anchors.push(i);
    if (anchors.length < 2) {
      // a loop entirely against void (no portal): seed two opposite extremes so DP has a baseline
      let lo = 0, hi = 0;
      for (let i = 0; i < n; i++) { const v = raw[i];
        if (v.x < raw[lo].x || (v.x === raw[lo].x && v.z < raw[lo].z)) lo = i;
        if (v.x > raw[hi].x || (v.x === raw[hi].x && v.z > raw[hi].z)) hi = i; }
      anchors = lo < hi ? [lo, hi] : [hi, lo];
    } else anchors.sort((a, b) => a - b);
    const keep = new Set(anchors), me2 = maxError * maxError;
    for (let a = 0; a < anchors.length; a++) {
      const run = []; for (let k = anchors[a]; ; k = (k + 1) % n) { run.push(k); if (k === anchors[(a + 1) % anchors.length]) break; }
      const dp = (lo, hi) => {
        if (hi <= lo + 1) return;
        let mk = -1, md = me2;
        for (let k = lo + 1; k < hi; k++) { const p = raw[run[k]], d = distSq(p, raw[run[lo]], raw[run[hi]]);
          // tie-break ties by (x,z) so the kept vertex is independent of traversal direction - the two regions
          // sharing this boundary walk it in opposite orders, and an index-order tie-break would pick different
          // points on each side (a staircase has many equidistant points), splitting the portal in 4.3c
          if (d > md || (d === md && mk >= 0 && (p.x < raw[run[mk]].x || (p.x === raw[run[mk]].x && p.z < raw[run[mk]].z)))) { md = d; mk = k; } }
        if (mk >= 0) { keep.add(run[mk]); dp(lo, mk); dp(mk, hi); }
      };
      dp(0, run.length - 1);
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep.has(i)) out.push({ x: raw[i].x, z: raw[i].z, y: raw[i].y, rn: raw[i].rn });
    return out;
  };

  // signed area (shoelace) in cell units - positive = CCW (outer), negative = CW (hole)
  const area2 = (v) => { let a = 0; for (let i = 0, j = v.length - 1; i < v.length; j = i++) a += v[j].x * v[i].z - v[i].x * v[j].z; return a; };

  const contours = [];
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) for (const s of spans[ix + iz * nx]) {
    if (!s.walkable || !s.reg || s.cf === 0) continue; // no unvisited boundary edge here
    const raw = walk(ix, iz, s);
    if (raw.length < 3) continue;
    const verts = simplify(raw);
    if (verts.length >= 3) contours.push({ reg: s.reg, verts, rawLen: raw.length, hole: area2(verts) < 0 });
  }

  for (let i = 0; i < nx * nz; i++) for (const s of spans[i]) delete s.cf;
  chf.contours = contours;
  return contours;
}

// ── debug-draw: the simplified contour polygons as thin ribbons + corner pips, coloured per region ──────
export function contourDebugFaces(chf) {
  const { cs, xmin, zmin, spans } = chf;
  void spans;
  const colour = (r) => { const h = ((r * 0.61803398875) % 1) * 6, x = 1 - Math.abs((h % 2) - 1);
    const [R, G, B] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
    return [55 + R * 200, 55 + G * 200, 55 + B * 200]; };
  const out = [], W = 0.05, LIFT = 0.07;
  for (const c of chf.contours || []) {
    const col = colour(c.reg), v = c.verts;
    for (let j = 0; j < v.length; j++) {
      const a = v[j], b = v[(j + 1) % v.length];
      const ax = xmin + a.x * cs, az = zmin + a.z * cs, ay = a.y + LIFT;
      const bx = xmin + b.x * cs, bz = zmin + b.z * cs, by = b.y + LIFT;
      let dx = bx - ax, dz = bz - az; const len = Math.hypot(dx, dz) || 1; const px = (-dz / len) * W, pz = (dx / len) * W;
      out.push({ p: [ax + px, ay, az + pz, bx + px, by, bz + pz, bx - px, by, bz - pz, ax - px, ay, az - pz], n: [0, 1, 0], c: col });
      // a small pip at each corner so the simplified vertices are visible
      out.push({ p: [ax - W * 2, ay + 0.01, az - W * 2, ax + W * 2, ay + 0.01, az - W * 2, ax + W * 2, ay + 0.01, az + W * 2, ax - W * 2, ay + 0.01, az + W * 2], n: [0, 1, 0], c: [250, 250, 250] });
    }
  }
  return out;
}

// ── 4.3c: poly mesh - triangulate + merge the contours into convex polygons with portal adjacency ──────
// For each region: ear-clip its (CCW, integer-corner) contour into triangles, then greedily merge triangles
// into convex polygons up to nvp verts (longest shared edge first, Recast-style). Vertices dedupe globally
// by (x,z) so a portal corner shared by two regions collapses to ONE index - which is what lets the per-edge
// adjacency pass match an A-poly edge (u,v) to the B-poly edge (v,u) across a region boundary. Output is a
// convex-poly navmesh: mesh.verts (shared), mesh.polys[{verts, neis, reg}] with neis[e] = the poly across
// edge e (-1 = solid/void border; a neighbour in another region is a portal). 4.4 runs A* + funnel on this.
export function buildPolyMesh(chf, opts = {}) {
  const nvp = opts.nvp ?? 6;
  const maxArea2 = 2 * ((opts.maxArea ?? 12) / (chf.cs * chf.cs)); // twice-area poly cap in grid units² (opts.maxArea = world m²). The Slice-9 overlay blocks WHOLE polys, so poly size is every obstacle's blast radius: open rooms baked as mega-polys (a 144 m² dig-face floor) and one boss disc severed the arena - alert adds with no path stood still. The cap bounds any block's reach; corridors/ledges (already small) are untouched.
  const contours = chf.contours || [];

  // global vertex dedupe by (x,z); y from first sighting (detail height is 4.3d)
  const verts = [], vmap = new Map();
  const vid = (v) => { const k = v.x + ',' + v.z; let i = vmap.get(k);
    if (i === undefined) { i = verts.length; verts.push({ x: v.x, z: v.z, y: v.y }); vmap.set(k, i); } return i; };
  const V = (gi) => verts[gi];

  // ── exact integer predicates (O'Rourke) ──
  const area2 = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
  const collin = (a, b, c) => area2(a, b, c) === 0;
  const left = (a, b, c) => area2(a, b, c) > 0;
  const leftOn = (a, b, c) => area2(a, b, c) >= 0;
  const xorb = (p, q) => (!!p) !== (!!q);
  const between = (a, b, c) => !collin(a, b, c) ? false : (a.x !== b.x ? (a.x <= c.x) === (c.x <= b.x) : (a.z <= c.z) === (c.z <= b.z));
  const intersectProp = (a, b, c, d) => (collin(a, b, c) || collin(a, b, d) || collin(c, d, a) || collin(c, d, b)) ? false
    : xorb(left(a, b, c), left(a, b, d)) && xorb(left(c, d, a), left(c, d, b));
  const intersect = (a, b, c, d) => intersectProp(a, b, c, d) || between(a, b, c) || between(a, b, d) || between(c, d, a) || between(c, d, b);

  // is the diagonal (i,j) a valid internal diagonal of the simple polygon `poly` (array of vert objs, CCW)?
  const diagonalie = (poly, i, j) => { const n = poly.length, a = poly[i], b = poly[j];
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; if (k === i || k1 === i || k === j || k1 === j) continue;
      if (intersect(a, b, poly[k], poly[k1])) return false; } return true; };
  const inCone = (poly, i, j) => { const n = poly.length, a = poly[i], a1 = poly[(i + 1) % n], a0 = poly[(i + n - 1) % n], b = poly[j];
    return leftOn(a, a1, a0) ? (left(a, b, a0) && left(b, a, a1)) : !(leftOn(a, b, a1) && leftOn(b, a, a0)); };
  const diagonal = (poly, i, j) => inCone(poly, i, j) && inCone(poly, j, i) && diagonalie(poly, i, j);

  // ear-clip a CCW simple polygon (array of vert objs) -> triangles of vert objs; shortest diagonal first
  const triangulate = (pts) => {
    const poly = pts.slice(), tris = [];
    while (poly.length > 3) {
      const n = poly.length; let best = -1, bestLen = Infinity;
      for (let i = 0; i < n; i++) { const i2 = (i + 2) % n;
        if (diagonal(poly, i, i2)) { const a = poly[i], b = poly[i2], len = (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
          if (len < bestLen) { bestLen = len; best = i; } } }
      if (best < 0) { for (let i = 0; i < n; i++) if (left(poly[i], poly[(i + 1) % n], poly[(i + 2) % n])) { best = i; break; } } // degenerate guard
      if (best < 0) break;
      const i1 = (best + 1) % poly.length;
      tris.push([poly[best], poly[i1], poly[(best + 2) % poly.length]]);
      poly.splice(i1, 1);
    }
    if (poly.length === 3) tris.push([poly[0], poly[1], poly[2]]);
    return tris;
  };

  // ── greedy convex merge of polys (arrays of global vert indices) within one region ──
  const sharedEdge = (pa, pb) => { for (let i = 0; i < pa.length; i++) { const a0 = pa[i], a1 = pa[(i + 1) % pa.length];
    for (let j = 0; j < pb.length; j++) if (a0 === pb[(j + 1) % pb.length] && a1 === pb[j]) return [i, j]; } return null; };
  const polyArea2 = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = V(p[i]), r = V(p[(i + 1) % p.length]); a += q.x * r.z - r.x * q.z; } return a; }; // twice the signed area (shoelace, integer grid coords; CCW -> positive)
  const mergeValue = (pa, pb) => {
    const s = sharedEdge(pa, pb); if (!s) return -1;
    const la = pa.length, lb = pb.length; if (la + lb - 2 > nvp) return -1;
    if (polyArea2(pa) + polyArea2(pb) > maxArea2) return -1; // area cap: the union's area is exactly the sum across the shared edge - a merge that would breach the cap is refused, never shrunk
    const [ea, eb] = s, va = pa[ea], vb = pa[(ea + 1) % la];
    const paPrev = pa[(ea + la - 1) % la], paNext = pa[(ea + 2) % la];
    const pbPrev = pb[(eb + lb - 1) % lb], pbNext = pb[(eb + 2) % lb];
    if (!leftOn(V(paPrev), V(va), V(pbNext))) return -1; // convexity at the two seam corners
    if (!leftOn(V(pbPrev), V(vb), V(paNext))) return -1;
    const A = V(va), B = V(vb); return (A.x - B.x) ** 2 + (A.z - B.z) ** 2;
  };
  const mergePolys = (pa, pb) => { const [ea, eb] = sharedEdge(pa, pb), la = pa.length, lb = pb.length, out = [];
    for (let k = 0; k < la - 1; k++) out.push(pa[(ea + 1 + k) % la]);
    for (let k = 0; k < lb - 1; k++) out.push(pb[(eb + 1 + k) % lb]); return out; };

  // slice every tri against ONE global grid-line lattice (pitch ~= sqrt(cap)): the merge cap alone can't
  // bound polys - the ear-clip SEEDS room-spanning triangles (a D-P contour has few verts) - and per-poly
  // cuts mint T-junctions that kill the edge-key portal match. One lattice = identical cuts on both sides
  // of every shared edge, vid welds them, adjacency pairs every sub-edge. Steiner y is a placeholder -
  // buildPolyMeshDetail owns real heights.
  const pitch = Math.max(2, Math.floor(Math.sqrt(opts.maxArea ?? 12) / chf.cs)); // lattice pitch in grid cells
  const clipHalf = (ring, ax, c, keepLE) => { // Sutherland-Hodgman vs one axis line: keep the <=c (or >=c) side
    const out = [], side = (v) => (ax ? v.z : v.x) - c;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], sa = side(a), sb = side(b);
      const inA = keepLE ? sa <= 0 : sa >= 0, inB = keepLE ? sb <= 0 : sb >= 0;
      if (inA) out.push(a);
      if (inA !== inB) { const t = sa / (sa - sb), s = (v) => Math.round(v * 8) / 8; out.push(ax ? { x: s(a.x + (b.x - a.x) * t), z: c, y: a.y } : { x: c, z: s(a.z + (b.z - a.z) * t), y: a.y }); } // minted verts snap to the 1/8-cell lattice so the same geometric point on both sides of a shared edge welds to ONE vid (contour verts are integers - already on it)
    }
    return out;
  };
  const sliceTri = (tri) => { // tri: vert objects -> convex cells of the lattice ∩ tri, as id rings
    let cells = [tri];
    for (const ax of [0, 1]) {
      const lo = Math.min(...tri.map((v) => ax ? v.z : v.x)), hi = Math.max(...tri.map((v) => ax ? v.z : v.x));
      for (let c = Math.ceil(lo / pitch) * pitch; c < hi; c += pitch) {
        const next = [];
        for (const r of cells) { const A = clipHalf(r, ax, c, true), B = clipHalf(r, ax, c, false); if (A.length >= 3) next.push(A); if (B.length >= 3) next.push(B); }
        cells = next;
      }
    }
    const clean = (ids) => { const o = []; for (const gi of ids) if (o[o.length - 1] !== gi) o.push(gi); while (o.length > 1 && o[o.length - 1] === o[0]) o.pop(); return o; }; // collapse consecutive dupes + the closing repeat only
    const unpinch = (r) => { for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i] === r[j]) return [...unpinch(r.slice(i, j)), ...unpinch([...r.slice(0, i), ...r.slice(j)])]; return [r]; }; // a ring that revisits a vert (a lattice-corner pinch) is TWO loops sharing a point - split them; deleting the vert bowtied the ring and dropped it, minting mesh holes
    return cells.map((r) => clean(r.map(vid))).flatMap(unpinch)
      .filter((r) => r.length >= 3 && polyArea2(r) > 0)
      .flatMap((r) => r.length > nvp ? triangulate(r.map(V)).map((t) => t.map(vid)) : [r]); // a cell ∩ tri can carry up to 7 verts - ear-clip back under the nvp contract (internal diagonals, no T-junction risk)
  };

  // build convex polys region by region
  const polys = [];
  for (const c of contours) {
    if (c.hole) continue; // arena has none; hole-merging into the outer loop is future work
    let rp = triangulate(c.verts).flatMap(sliceTri);
    for (;;) { let bi = -1, bj = -1, bv = -1;
      for (let i = 0; i < rp.length; i++) for (let j = i + 1; j < rp.length; j++) { const v = mergeValue(rp[i], rp[j]); if (v > bv) { bv = v; bi = i; bj = j; } }
      if (bv < 0) break;
      const m = mergePolys(rp[bi], rp[bj]); rp.splice(bj, 1); rp.splice(bi, 1); rp.push(m);
    }
    for (const p of rp) polys.push({ verts: p, reg: c.reg, neis: new Array(p.length).fill(-1) });
  }

  linkPolyNeighbours(polys);

  chf.mesh = { verts, polys, nvp };
  buildLocateIndex(chf.mesh); // Slice 1 (AI-Engine-Arc): the uniform-grid locate index, built from whatever mesh just baked - zero authoring, every applyArena/buildArenaFromMap room gets it automatically
  return chf.mesh;
}

// per-edge adjacency: match poly edge (u,v) to another poly's (v,u) - internal seams + cross-region
// portals. Shared by buildPolyMesh (fresh bake) and hydrateBakedNav (a map that ships a precomputed
// mesh rebuilds neis here rather than serialising it - the linking is deterministic from the winding).
function linkPolyNeighbours(polys) {
  const edgeMap = new Map();
  for (let pi = 0; pi < polys.length; pi++) { const pv = polys[pi].verts;
    for (let e = 0; e < pv.length; e++) { const a = pv[e], b = pv[(e + 1) % pv.length], k = Math.min(a, b) + ',' + Math.max(a, b);
      let l = edgeMap.get(k); if (!l) { l = []; edgeMap.set(k, l); } l.push({ pi, e, a, b }); } }
  for (const [, l] of edgeMap) if (l.length === 2 && l[0].a === l[1].b && l[0].b === l[1].a) {
    polys[l[0].pi].neis[l[0].e] = l[1].pi; polys[l[1].pi].neis[l[1].e] = l[0].pi; }
}

// ── precomputed-nav I/O ─────────────────────────────────────────────────────────────────────────
// The full bake (buildNav -> compact -> regions -> contours -> polymesh) is ~11s for a 600m field and
// DETERMINISTIC from the map geometry. Re-running it in every player's browser on load is the whole of
// the slow-load stall. A compiled map bakes ONCE (tools/bake-nav.mjs) and ships the result; the runtime
// hydrates it in ~1ms. Only the two things the runtime actually queries are serialised: the convex poly
// mesh (findPath) and a per-cell walkable bitmask (navWalkable). Everything else - neis, the locate
// index, vertex heights - is cheap to rebuild here from those two, so it is NOT stored.
const _u8ToB64 = (u) => (typeof Buffer !== 'undefined' ? Buffer.from(u).toString('base64') : btoa(String.fromCharCode(...u)));
const _b64ToU8 = (s) => { if (typeof atob === 'function') { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(s, 'base64')); };

// serialise a fully-baked chf into the compact form the map ships. Runs in the compiler (node) only.
export function bakeNavData(chf) {
  const mesh = chf.mesh, v = [];
  for (const vert of mesh.verts) v.push(vert.x, vert.z); // grid coords (integers); heights are re-snapped at load
  const walk = new Uint8Array(Math.ceil((chf.nx * chf.nz) / 8)); // 1 bit per cell: a walkable, regioned span exists
  for (let i = 0; i < chf.nx * chf.nz; i++) { for (const s of chf.spans[i]) if (s.walkable && s.reg) { walk[i >> 3] |= 1 << (i & 7); break; } }
  return { v, p: mesh.polys.map((p) => p.verts), reg: mesh.polys.map((p) => p.reg ?? 0), walk: _u8ToB64(walk), cs: chf.cs, xmin: chf.xmin, zmin: chf.zmin, nx: chf.nx, nz: chf.nz, nvp: mesh.nvp };
}

// rebuild a queryable chf from shipped nav data + the (cheaply rebuilt) collider set. Runs at load.
export function hydrateBakedNav(baked, colliders) {
  const verts = new Array(baked.v.length / 2);
  for (let i = 0; i < verts.length; i++) verts[i] = { x: baked.v[i * 2], z: baked.v[i * 2 + 1], y: 0 };
  const polys = baked.p.map((vs, pi) => ({ verts: vs, reg: (baked.reg && baked.reg[pi]) || 0, neis: new Array(vs.length).fill(-1) }));
  linkPolyNeighbours(polys); // adjacency rebuilt from the winding (identical to the fresh bake's edge-match)
  const mesh = { verts, polys, nvp: baked.nvp };
  buildLocateIndex(mesh); // the uniform-grid locate index (a query accelerator; a linear scan is the fallback)
  // NB: vertex heights (v.y) are left at 0 - findPath samples surfH(colliders) at the final path points, so
  // it never reads v.y. Only the nav DEBUG overlay uses v.y, and snapping all ~18k verts here costs ~3s
  // (surfH is O(colliders) each). The overlay snaps them lazily instead (navMeshNeedsHeights).
  return { mesh, cs: baked.cs, xmin: baked.xmin, zmin: baked.zmin, nx: baked.nx, nz: baked.nz, colliders, obstacles: new Map(), navEpoch: 0, walkmask: _b64ToU8(baked.walk), _flatHeights: true };
}

// ── Slice 1: uniform-grid locate index ──────────────────────────────────────────────────────────────
// locatePoly was an O(polys) scan per findPath endpoint - fine at bowl scale, the first thing that
// buckles on a bigger generated room. This buckets poly AABBs (grid space, B cells per bucket) so a
// query touches only the handful of polys near the point. Derived data only: it is NOT serialized into
// the golden (the golden pins geometry + paths; this must never change either), and buckets hold poly
// ids ASCENDING so the indexed query's first-inside / strict-< nearest tie-breaks are IDENTICAL to the
// linear oracle (test/game/navIndex.test.js proves it point-for-point across a dense sweep).
const LOC_B = 8; // grid cells per bucket side
function buildLocateIndex(mesh) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const v of mesh.verts) { if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z; }
  if (!mesh.verts.length) { mesh.index = null; return; }
  const bx = Math.max(1, Math.ceil((x1 - x0) / LOC_B)), bz = Math.max(1, Math.ceil((z1 - z0) / LOC_B));
  const buckets = new Array(bx * bz); for (let i = 0; i < buckets.length; i++) buckets[i] = [];
  const clampB = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  for (let pi = 0; pi < mesh.polys.length; pi++) { // ascending pi -> ascending bucket lists (the tie-break invariant)
    const pv = mesh.polys[pi].verts;
    let px0 = Infinity, pz0 = Infinity, px1 = -Infinity, pz1 = -Infinity;
    for (const vi of pv) { const v = mesh.verts[vi]; if (v.x < px0) px0 = v.x; if (v.x > px1) px1 = v.x; if (v.z < pz0) pz0 = v.z; if (v.z > pz1) pz1 = v.z; }
    const i0 = clampB(Math.floor((px0 - x0) / LOC_B), bx), i1 = clampB(Math.floor((px1 - x0) / LOC_B), bx);
    const k0 = clampB(Math.floor((pz0 - z0) / LOC_B), bz), k1 = clampB(Math.floor((pz1 - z0) / LOC_B), bz);
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) buckets[k * bx + i].push(pi);
  }
  mesh.index = { x0, z0, bx, bz, buckets };
}

// a hydrated mesh ships with v.y = 0 (findPath never reads it). The dev overlays below DO draw at v.y,
// so snap the verts onto the surface on first use and clear the flag - dev-only cost, zero on load.
function ensureMeshHeights(chf) {
  if (!chf._flatHeights || !chf.colliders) return;
  const { cs, xmin, zmin, colliders } = chf;
  for (const v of chf.mesh.verts) v.y = surfH(colliders, xmin + v.x * cs, zmin + v.z * cs);
  chf._flatHeights = false;
}

// ── debug-draw: filled convex polys (per-region hue, per-poly lightness) + white edge ribbons ───────────
export function polyMeshDebugFaces(chf) {
  const mesh = chf.mesh; if (!mesh) return [];
  ensureMeshHeights(chf);
  const { cs, xmin, zmin } = chf;
  const colour = (r) => { const h = ((r * 0.61803398875) % 1) * 6, x = 1 - Math.abs((h % 2) - 1);
    const [R, G, B] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
    return [40 + R * 175, 40 + G * 175, 40 + B * 175]; };
  const out = [], LIFT = 0.05;
  for (let pi = 0; pi < mesh.polys.length; pi++) {
    const p = mesh.polys[pi], base = colour(p.reg), j = 0.65 + 0.35 * ((pi * 0.61803398875) % 1);
    const col = [Math.min(255, base[0] * j), Math.min(255, base[1] * j), Math.min(255, base[2] * j)];
    const wp = p.verts.map((gi) => { const v = mesh.verts[gi]; return [xmin + v.x * cs, v.y + LIFT, zmin + v.z * cs]; });
    for (let k = 1; k + 1 < wp.length; k++) out.push({ p: [...wp[0], ...wp[k], ...wp[k + 1], ...wp[k + 1]], n: [0, 1, 0], c: col }); // fan fill
    for (let e = 0; e < wp.length; e++) { const a = wp[e], b = wp[(e + 1) % wp.length];
      const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, px = (-dz / L) * 0.03, pz = (dx / L) * 0.03;
      out.push({ p: [a[0] + px, a[1] + 0.02, a[2] + pz, b[0] + px, b[1] + 0.02, b[2] + pz, b[0] - px, b[1] + 0.02, b[2] - pz, a[0] - px, a[1] + 0.02, a[2] - pz], n: [0, 1, 0], c: [245, 245, 245] }); }
  }
  return out;
}

// ── 4.3d: detail height - the nav's height layer ────────────────────────────────────────────────────
// Recast triangulates a detail mesh at this stage because it discards the source geometry: the nav must
// carry its own height surface. We keep terrain.surfaceY - the exact, deterministic plane the mover already
// walks - so baking a lossy triangle mesh would only re-encode (with cracks + boundary-edge subdivision to
// get right) data we already hold perfectly. The height layer queries the surface instead: buildPolyMeshDetail
// snaps every poly-mesh vertex onto the true surface (curing the ~0.4m voxel/dedup stepping the flat mesh
// carried) and stashes the colliders, so polyHeight(poly, x, z) returns the exact draped height the agent
// rides. surfaceY is a pure function of the shared colliders, so every client computes identical heights (the
// "identical baked nav" the migration story relies on), and 4.1 already reads the colliders - no new coupling.
export function buildPolyMeshDetail(chf, colliders) {
  const mesh = chf.mesh; if (!mesh) return null;
  const { cs, xmin, zmin } = chf;
  for (const v of mesh.verts) v.y = surfH(colliders, xmin + v.x * cs, zmin + v.z * cs); // snap onto the real surface
  chf.colliders = colliders; // the height query samples the surface directly
  return mesh;
}

// the highest walkable-surface height at world (wx,wz): the draped height the agent rides across a poly.
// (`pi` is reserved for picking among stacked walkable surfaces later; this arena has none, so highest wins.)
export function polyHeight(chf, pi, wx, wz) {
  void pi;
  return chf.colliders ? surfH(chf.colliders, wx, wz) : null;
}

// the one surface sampler: the tallest collider top whose footprint covers (wx,wz), else the ground at 0.
function surfH(colliders, wx, wz) {
  let y = 0;
  for (const c of colliders) {
    if (c.rayOnly) continue; // overhead cover is not a standable surface
    if (wx < c.x0 || wx > c.x1 || wz < c.z0 || wz > c.z1) continue;
    const sy = surfaceY(c, wx, wz);
    if (sy > y) y = sy;
  }
  return y;
}

// ── debug-draw: every walkable cell as a quad at its four corners' true heights, per-region hue - so the
//    ramps read as draped inclines where __polys shows only flat convex tops ─────────────────────────────
export function detailDebugFaces(chf) {
  const mesh = chf.mesh; if (!mesh || !chf.colliders) return [];
  const { cs, xmin, zmin, nx, nz, spans } = chf, cols = chf.colliders, LIFT = 0.06;
  const colour = (r) => { const h = ((r * 0.61803398875) % 1) * 6, x = 1 - Math.abs((h % 2) - 1);
    const [R, G, B] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
    return [40 + R * 175, 40 + G * 175, 40 + B * 175]; };
  const wy = (gx, gz) => [xmin + gx * cs, surfH(cols, xmin + gx * cs, zmin + gz * cs) + LIFT, zmin + gz * cs];
  const out = [];
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    let reg = 0; for (const s of spans[ix + iz * nx]) if (s.walkable && s.reg) { reg = s.reg; break; }
    if (!reg) continue;
    out.push({ p: [...wy(ix, iz), ...wy(ix + 1, iz), ...wy(ix + 1, iz + 1), ...wy(ix, iz + 1)], n: [0, 1, 0], c: colour(reg) });
  }
  return out;
}
// ── 4.4: query - locate endpoints, A* the poly graph, funnel the corridor into a taut path ──────────
// findPath(chf, start, goal) is the AI's one entry point. World start/goal ([x,y,z], y ignored) ->
// [[x,y,z]...] waypoints (heights sampled off the true surface so the path rides ramps) | null when an
// endpoint is off the mesh or no corridor connects them.

// the poly under world (wx,wz): the one that contains it, else the nearest poly within ~1m (covers an
// agent standing in the radius-eroded margin, just off the mesh edge). Grid coords. Returns index | -1.
function locatePoly(chf, wx, wz) {
  const mesh = chf.mesh, { cs, xmin, zmin } = chf, gx = (wx - xmin) / cs, gz = (wz - zmin) / cs;
  const idx = mesh.index;
  if (!idx) return locateScan(mesh, gx, gz, null); // no index baked (defensive) -> the full linear scan
  // gather candidates from every bucket the snap disc (radius 2 grid units) can touch - any poly outside
  // those buckets has an AABB, hence an edge, farther than 2, so it can never win the snap. Ascending +
  // deduped, so the first-inside / strict-< tie-breaks match the linear oracle exactly.
  const clampB = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  const i0 = clampB(Math.floor((gx - 2 - idx.x0) / LOC_B), idx.bx), i1 = clampB(Math.floor((gx + 2 - idx.x0) / LOC_B), idx.bx);
  const k0 = clampB(Math.floor((gz - 2 - idx.z0) / LOC_B), idx.bz), k1 = clampB(Math.floor((gz + 2 - idx.z0) / LOC_B), idx.bz);
  let cand;
  if (i0 === i1 && k0 === k1) cand = idx.buckets[k0 * idx.bx + i0]; // the common case: one bucket, already ascending
  else { const seen = new Set(); cand = [];
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) for (const pi of idx.buckets[k * idx.bx + i]) if (!seen.has(pi)) { seen.add(pi); cand.push(pi); }
    cand.sort((a, b) => a - b); }
  return locateScan(mesh, gx, gz, cand);
}

export const __locatePolyIndexed = (chf, wx, wz) => locatePoly(chf, wx, wz); // test seam: the indexed production query, for the equivalence sweep only

// exported ONLY as the equivalence oracle for test/game/navIndex.test.js - the pre-index linear scan,
// byte-for-byte the old locatePoly. Production queries go through the indexed locatePoly above.
export function locatePolyLinear(chf, wx, wz) {
  const mesh = chf.mesh, { cs, xmin, zmin } = chf;
  return locateScan(mesh, (wx - xmin) / cs, (wz - zmin) / cs, null);
}

// the shared kernel: containment + nearest-edge snap over a candidate id list (null = all polys).
// EXACTLY the old loop body - first inside wins; strict < keeps the lowest id on distance ties.
function locateScan(mesh, gx, gz, cand) {
  const cross = (a, b) => (b.x - a.x) * (gz - a.z) - (gx - a.x) * (b.z - a.z);
  let best = -1, bestD = Infinity;
  const n = cand ? cand.length : mesh.polys.length;
  for (let c = 0; c < n; c++) {
    const pi = cand ? cand[c] : c;
    const v = mesh.polys[pi].verts; let inside = true, d = Infinity;
    for (let i = 0; i < v.length; i++) { const a = mesh.verts[v[i]], b = mesh.verts[v[(i + 1) % v.length]];
      if (cross(a, b) < -1e-6) inside = false;
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz; let t = l2 ? ((gx - a.x) * dx + (gz - a.z) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      d = Math.min(d, Math.hypot(gx - (a.x + t * dx), gz - (a.z + t * dz))); }
    if (inside) return pi;
    if (d < bestD) { bestD = d; best = pi; }
  }
  return bestD <= 2 ? best : -1; // snap within ~0.5m (covers the radius-eroded margin; tighter than the 0.5m walls)
}

// ── Slice 9 (AI-Engine-Arc): dynamic nav obstacles ──────────────────────────────────────────────────
// Runtime circles that BLOCK or COST-scale polys without touching the baked mesh: the boss's body, a
// bulwark corpse while it physically exists. Host-local like the mesh itself (never replicated - clients
// don't path). Registry lives on chf; every add/remove bumps chf.navEpoch, and the per-poly overlay
// (blocked flag + cost multiplier + the blocking obstacle's numeric id) rebuilds LAZILY on first use
// after a bump - O(polys x obstacles), and bumps are rare by design (the mobile boss re-registers only
// after moving >1.5m, wired in main). A* consumes the overlay: blocked polys can't be ENTERED
// (the start poly is always exitable, so an enemy standing inside a freshly-dropped disc walks out
// instead of stranding), edge costs scale by the max of the two polys' multipliers, and a per-query
// `ignore` id lets the boss path without dodging its own footprint. Path holders re-solve via the epoch
// (repathToward compares e.pathEpoch) - invalidation without a per-path geometry test.
export function addNavObstacle(chf, id, x, z, r, opts = {}) {
  if (!chf.obstacles) chf.obstacles = new Map();
  chf.obstacles.set(id, { x, z, r, block: opts.block !== false, costMul: opts.costMul || 1, num: hashObstId(id) });
  chf.navEpoch = (chf.navEpoch | 0) + 1;
}
export function removeNavObstacle(chf, id) {
  if (chf.obstacles && chf.obstacles.delete(id)) chf.navEpoch = (chf.navEpoch | 0) + 1;
}
function hashObstId(id) { let h = 0; const s = String(id); for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h || 1; } // a stable nonzero numeric tag for the ignore check (0 = unblocked)

// One idempotent per-frame sweep, host-side (called from main before updateEnemies): boss bodies while
// active (re-registered only after moving >1.5m, so the mobile crawl bumps the epoch a few times a roam,
// never per frame) and bulwark corpses while they physically exist (dead + deathT draining), removed at
// the shatter's end. Adds/removes bump chf.navEpoch; path holders invalidate via their epoch stamp.
export function syncNavObstacles(chf, bosses, enemies) {
  let ni = 0;
  for (const b of bosses) {
    const id = b.navId || (b.navId = 'boss:' + (ni++) + ':' + (b.encId || 'x'));
    const on = !b.dead && b.phase !== 'dormant';
    const prev = chf.obstacles && chf.obstacles.get(id);
    if (on && (!prev || Math.hypot(prev.x - b.x, prev.z - b.z) > 1.5)) addNavObstacle(chf, id, b.x, b.z, 2.6);
    else if (!on && prev) removeNavObstacle(chf, id);
  }
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]; if (e.role !== 'bulwark') continue;
    const id = 'corpse:' + i, on = e.dead && e.deathT > 0;
    const prev = chf.obstacles && chf.obstacles.get(id);
    if (on && !prev) addNavObstacle(chf, id, e.x, e.z, 1.4);
    else if (!on && prev) removeNavObstacle(chf, id);
  }
}

// rebuild the overlay iff the epoch moved. Conservative overlap: the obstacle circle (grid units) vs the
// poly's vertex hull - any vertex inside the disc OR any edge within r OR the centre inside the poly
// flags it. Last writer's id tags multi-blocked polys (rare; an `ignore` on a multi-blocked poly
// under-blocks - documented, conservative-fail acceptable for a corpse under the boss).
function navOverlay(chf) {
  const mesh = chf.mesh;
  if (chf.ovEpoch === (chf.navEpoch | 0) && chf.polyBlocked) return chf;
  const N = mesh.polys.length;
  const blocked = chf.polyBlocked && chf.polyBlocked.length === N ? chf.polyBlocked.fill(0) : new Uint8Array(N);
  const costMul = chf.polyCostMul && chf.polyCostMul.length === N ? chf.polyCostMul.fill(1) : new Float32Array(N).fill(1);
  const blockId = chf.polyBlockId && chf.polyBlockId.length === N ? chf.polyBlockId.fill(0) : new Int32Array(N);
  if (chf.obstacles) for (const ob of chf.obstacles.values()) {
    const gx = (ob.x - chf.xmin) / chf.cs, gz = (ob.z - chf.zmin) / chf.cs, gr = ob.r / chf.cs, gr2 = gr * gr;
    for (let pi = 0; pi < N; pi++) {
      const v = mesh.polys[pi].verts; let hit = false, inside = true;
      for (let i = 0; i < v.length && !hit; i++) {
        const a = mesh.verts[v[i]], b = mesh.verts[v[(i + 1) % v.length]];
        if ((b.x - a.x) * (gz - a.z) - (gx - a.x) * (b.z - a.z) < 0) inside = false; // centre-in-poly (CCW)
        const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
        let t = l2 ? ((gx - a.x) * dx + (gz - a.z) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = gx - (a.x + t * dx), qz = gz - (a.z + t * dz);
        if (qx * qx + qz * qz <= gr2) hit = true; // an edge (hence the hull) grazes the disc
      }
      if (hit || inside) { if (ob.block) { blocked[pi] = 1; blockId[pi] = ob.num; } if (ob.costMul > costMul[pi]) costMul[pi] = ob.costMul; }
    }
  }
  chf.polyBlocked = blocked; chf.polyCostMul = costMul; chf.polyBlockId = blockId; chf.ovEpoch = chf.navEpoch | 0;
  return chf;
}


// distance; heuristic = straight line from a poly's centroid to the goal poly's centroid (admissible AND
// consistent: the straight line can only be shorter than the remaining centroid hops, which terminate at that
// same centroid - measuring to the goal point instead could overestimate). Returns the corridor [polys], or null.
function polyAStar(mesh, cen, startPi, goalPi, ov, ignore) { // ov (Slice 9): the { polyBlocked, polyCostMul, polyBlockId } overlay, or null (no obstacles - the original arithmetic byte-identical); ignore = an obstacle's numeric tag whose blocks this query walks through (the boss pathing over its own footprint)
  const N = mesh.polys.length, g = new Float64Array(N).fill(Infinity), f = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1), closed = new Uint8Array(N), h = (pi) => Math.hypot(cen[pi].x - cen[goalPi].x, cen[pi].z - cen[goalPi].z);
  g[startPi] = 0; f[startPi] = h(startPi); const open = [startPi];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === goalPi) break;
    if (closed[cur]) continue; closed[cur] = 1;
    const nb = mesh.polys[cur].neis;
    for (let e = 0; e < nb.length; e++) { const q = nb[e]; if (q < 0 || closed[q]) continue;
      if (ov && ov.polyBlocked[q] && q !== goalPi && !(ignore && (ignore === -1 || ov.polyBlockId[q] === ignore))) continue; // Slice 9: blocked polys can't be ENTERED (leaving the start's blocked poly stays legal - we gate q, never cur; a blocked GOAL is reachable so an enemy can still close on a target standing inside a disc, and the funnel's endpoint is the caller's clamp problem). ignore -1 = the steer-never-sever retry: every block waived, costMul still prices it.
      let ng = g[cur] + Math.hypot(cen[cur].x - cen[q].x, cen[cur].z - cen[q].z);
      if (ov) { const m = ov.polyCostMul[cur] > ov.polyCostMul[q] ? ov.polyCostMul[cur] : ov.polyCostMul[q]; if (m !== 1) ng = g[cur] + (ng - g[cur]) * m; } // cost-scaled transit (soft obstacles)
      if (ng < g[q]) { g[q] = ng; came[q] = cur; f[q] = ng + h(q); open.push(q); } }
  }
  if (startPi !== goalPi && came[goalPi] < 0) return null;
  const path = [goalPi]; let c = goalPi; while (c !== startPi) { c = came[c]; if (c < 0) return null; path.push(c); }
  return path.reverse();
}

// Simple Stupid Funnel: pull the start->goal line taut through the corridor portals. portals are (left,
// right) vertex pairs in travel order, with (start,start) first and (goal,goal) last. Returns the corner
// points (grid coords). triarea2 > 0 means c is left of a->b.
function funnel(portals) {
  const tri = (a, b, c) => (c.x - a.x) * (b.z - a.z) - (b.x - a.x) * (c.z - a.z); // signed area (Mononen's triarea2); > 0 = c left of a->b
  const eq = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
  const pts = [portals[0].left]; let apex = portals[0].left, left = portals[0].left, right = portals[0].right, ai = 0, li = 0, ri = 0;
  for (let i = 1; i < portals.length; i++) {
    const L = portals[i].left, R = portals[i].right;
    if (tri(apex, right, R) <= 0) {
      if (eq(apex, right) || tri(apex, left, R) > 0) { right = R; ri = i; }
      else { pts.push(left); apex = left; ai = li; left = apex; right = apex; li = ai; ri = ai; i = ai; continue; }
    }
    if (tri(apex, left, L) >= 0) {
      if (eq(apex, left) || tri(apex, right, L) < 0) { left = L; li = i; }
      else { pts.push(right); apex = right; ai = ri; left = apex; right = apex; li = ai; ri = ai; i = ai; continue; }
    }
  }
  const end = portals[portals.length - 1].left; if (!eq(pts[pts.length - 1], end)) pts.push(end);
  return pts;
}

// locate -> A* -> portals -> funnel -> world waypoints with true heights. { polys, points } | null.
function solvePath(chf, start, goal, opts) {
  const mesh = chf.mesh; if (!mesh || !mesh.polys.length) return null;
  const ov = chf.obstacles && chf.obstacles.size ? navOverlay(chf) : null; // Slice 9: overlay only when obstacles exist - the empty path is byte-identical to pre-slice
  const ignore = opts && opts.ignore ? hashObstId(opts.ignore) : 0;
  const { cs, xmin, zmin } = chf;
  const sPi = locatePoly(chf, start[0], start[2]), gPi = locatePoly(chf, goal[0], goal[2]);
  if (sPi < 0 || gPi < 0) return null;
  const autoIgn = !ignore && ov && ov.polyBlocked[sPi] ? ov.polyBlockId[sPi] : 0; // starting INSIDE an obstacle's block: that one obstacle is waived for this query (the same principle as the free exit below - a soft entity like a boss disc must never nav-TRAP a mover; a spawn in the disc's shadow walks out through it). A caller ignore wins; other obstacles still block.
  const sG = { x: (start[0] - xmin) / cs, z: (start[2] - zmin) / cs }, gG = { x: (goal[0] - xmin) / cs, z: (goal[2] - zmin) / cs };
  const cen = mesh.cen || (mesh.cen = mesh.polys.map((p) => { let x = 0, z = 0; for (const gi of p.verts) { x += mesh.verts[gi].x; z += mesh.verts[gi].z; } return { x: x / p.verts.length, z: z / p.verts.length }; })); // centroids are static once the mesh is baked - compute once + memoise on the mesh (a fresh bake = a fresh mesh object = recomputed); every findPath reused them
  let corridor = polyAStar(mesh, cen, sPi, gPi, ov, ignore || autoIgn);
  if (!corridor && ov && !ignore) corridor = polyAStar(mesh, cen, sPi, gPi, ov, -1); // obstacles STEER, never SEVER: a route that only exists through a blocked disc is taken rather than reported impossible (the frozen-add class - a spawn pocket sealed by a boss disc). -1 waives every block; costMul still prices the transit. A caller ignore already had its answer.
  if (!corridor) return null;
  // portals: the shared edge in the current poly's CCW winding -> left = edge head, right = edge tail
  const portals = [{ left: sG, right: sG }];
  for (let k = 0; k + 1 < corridor.length; k++) {
    const a = mesh.polys[corridor[k]], b = corridor[k + 1]; let e = -1;
    for (let i = 0; i < a.neis.length; i++) if (a.neis[i] === b) { e = i; break; }
    if (e < 0) return null;
    const head = mesh.verts[a.verts[(e + 1) % a.verts.length]], tail = mesh.verts[a.verts[e]];
    portals.push({ left: { x: head.x, z: head.z }, right: { x: tail.x, z: tail.z } });
  }
  portals.push({ left: gG, right: gG });
  const points = funnel(portals).map((c) => { const wx = xmin + c.x * cs, wz = zmin + c.z * cs; return [wx, chf.colliders ? surfH(chf.colliders, wx, wz) : 0, wz]; });
  return { polys: corridor, points };
}

export function findPath(chf, start, goal, opts) { // opts.ignore (Slice 9): an obstacle id this query may cross (the boss over its own footprint)
  return solvePath(chf, start, goal, opts)?.points ?? null;
}

// debug-draw a path query: the corridor polys tinted blue + the pulled path as a raised yellow ribbon
// with red waypoint pips, so a set start/goal shows the corridor and the taut path through it.
export function pathDebugFaces(chf, start, goal) {
  const sol = solvePath(chf, start, goal); if (!sol) return [];
  const mesh = chf.mesh, { cs, xmin, zmin } = chf, cols = chf.colliders, out = [];
  const W = (q, lift) => [xmin + q.x * cs, (cols ? surfH(cols, xmin + q.x * cs, zmin + q.z * cs) : 0) + lift, zmin + q.z * cs];
  for (const pi of sol.polys) { const v = mesh.polys[pi].verts.map((gi) => mesh.verts[gi]);
    for (let k = 1; k + 1 < v.length; k++) out.push({ p: [...W(v[0], 0.08), ...W(v[k], 0.08), ...W(v[k + 1], 0.08), ...W(v[k + 1], 0.08)], n: [0, 1, 0], c: [70, 110, 205] }); }
  const P = sol.points;
  for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1, nx = (-dz / len) * 0.13, nz = (dx / len) * 0.13;
    out.push({ p: [a[0] + nx, a[1] + 0.2, a[2] + nz, b[0] + nx, b[1] + 0.2, b[2] + nz, b[0] - nx, b[1] + 0.2, b[2] - nz, a[0] - nx, a[1] + 0.2, a[2] - nz], n: [0, 1, 0], c: [255, 228, 60] }); }
  for (const p of P) { const s = 0.2; out.push({ p: [p[0] - s, p[1] + 0.22, p[2] - s, p[0] + s, p[1] + 0.22, p[2] - s, p[0] + s, p[1] + 0.22, p[2] + s, p[0] - s, p[1] + 0.22, p[2] + s], n: [0, 1, 0], c: [255, 90, 90] }); }
  return out;
}
