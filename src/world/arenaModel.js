// @ts-check
// ARENA1 (2026-10-02): THE COLOSSEUM, MODEL 864102 - Kamer's "Daggerfall Arena" 1.0, read back off the files
// tools/daggerfallArenaExtract.mjs wrote (vendor/daggerfall-arena/Models/), and rebuilt into the port's model shape.
//
// Mac, 2026-10-02: "The new arena. This is to be a centerpoint that fits in the middle of Daggerfall city." The
// prefab is one mesh in DFU's own model space (metres, +Y up, left-handed, Unity's winding - world/meshReader.js
// mints every classic model in that frame, so the bundle's numbers are used as they stand), its 23 submeshes wearing
// the classic pictures DFU's RuntimeMaterials puts on them (ApplyClimate 0: no climate, no season), and a
// non-convex MeshCollider of the same mesh.
//
// TWO HALVES, ONE MODEL:
// - KAMER'S OWN: the walls, the tiers, the floor, the roofs - 93% of the triangles, carried in Models/864102.bin.
// - DAGGERFALL'S OWN: the undercroft's passages are copies of Daggerfall's dungeon models (62009..72006) on its
//   3.2 m grid. A copy of an ARCH3D record is never carried (the bed-alias law, world/customModels.js), so the
//   vendored file lists them as PIECES - a model id, a turn, a place, the triangles that stand - and each is read out
//   of the player's own ARCH3D here (`arenaPieceModel`) and merged in (`composeArenaModel`). The tool compared every
//   triangle it left out against the same rebuild, so the merged model is the prefab's mesh again.
//
// The geometry is the pipeline's to build (scenes/dataPipeline.js asks world/customModels.js customCompositeFor):
// this module is pure - no fetch, no ARCH3D of its own - so a node test rebuilds exactly what the game draws.

/** The prefab's id - DFU's MeshReplacement answers it before ARCH3D (DFARENA.RMB places it). */
export const ARENA_MODEL_ID = 864102;
/** A piece's turns: 0-3 a quarter turn about +Y (x, z) -> (-z, x) each; 4-7 the same after a mirror in x. */
export const PIECE_TURNS = 8;

/**
 * A point (or a normal) of a classic piece under its turn - the mirror first (x -> -x), then the quarter turns.
 * @param {number[]} v [x, y, z]
 * @param {number} turn 0..7
 * @returns {number[]}
 */
export function pieceTransform(v, turn) {
  const x = turn >= 4 ? -v[0] : v[0], y = v[1], z = v[2];
  switch (turn & 3) {
    case 0: return [x, y, z];
    case 1: return [-z, y, x];
    case 2: return [-x, y, -z];
    default: return [z, y, -x];
  }
}

/**
 * Kamer's own half, out of the vendored index and binary, in the model shape world/meshReader.js mints (32-bit
 * indices - the renderer draws UNSIGNED_INT; no doors - a custom prefab gets none, as in DFU: the DOOR submesh is
 * decoration).
 * @param {any} index Models/864102.json
 * @param {Uint8Array} bin Models/864102.bin
 */
export function decodeArenaModel(index, bin) {
  const a = index.attributes;
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const n = index.vertexCount;
  const positions = new Float32Array(buf, a.position.offset, n * 3);
  const normals = new Float32Array(buf, a.normal.offset, n * 3);
  const uvs = new Float32Array(buf, a.uv0.offset, n * 2);
  const indices = Uint32Array.from(new Uint16Array(buf, a.indices.offset, a.indices.count));
  const subMeshes = index.submeshes.filter((s) => s.count > 0).map((s) => ({
    textureArchive: s.archive, textureRecord: s.record, startIndex: s.start, primitiveCount: s.count / 3,
  }));
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices, subMeshes, doors: [] };
}

/**
 * One piece rebuilt from its classic model (dfMeshToModel's shape, read out of the player's ARCH3D): the triangles
 * it keeps, turned and placed, a mirrored piece's wound back the right way out, a retextured triangle under its
 * picture. Answers the model shape.
 * @param {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array, subMeshes: any[] }} classic
 * @param {{ model: number, turn: number, at: number[], keep: 'all' | number[], retexture?: Record<string, number[]> }} piece
 */
export function arenaPieceModel(classic, piece) {
  const keep = piece.keep === 'all' ? null : new Set(piece.keep);
  const mirrored = piece.turn >= 4;
  /** @type {Map<string, number[]>} */
  const groups = new Map();   // "<archive>_<record>" -> [classic triangle index]
  for (const sm of classic.subMeshes) {
    for (let t = sm.startIndex / 3; t < sm.startIndex / 3 + sm.primitiveCount; t++) {
      if (keep && !keep.has(t)) continue;
      const to = piece.retexture?.[t] ?? [sm.textureArchive, sm.textureRecord];
      const k = `${to[0]}_${to[1]}`;
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
  }
  const pos = [], nor = [], uv = [], idx = [], subMeshes = [];
  for (const [k, list] of groups) {
    const [archive, record] = k.split('_').map(Number);
    const startIndex = idx.length;
    for (const t of list) {
      const corners = [0, 1, 2].map((c) => classic.indices[t * 3 + c]);
      if (mirrored) corners.reverse();
      for (const v of corners) {
        const p = pieceTransform([classic.positions[v * 3], classic.positions[v * 3 + 1], classic.positions[v * 3 + 2]], piece.turn);
        const nn = pieceTransform([classic.normals[v * 3], classic.normals[v * 3 + 1], classic.normals[v * 3 + 2]], piece.turn);
        idx.push(pos.length / 3);
        pos.push(p[0] + piece.at[0], p[1] + piece.at[1], p[2] + piece.at[2]);
        nor.push(...nn);
        uv.push(classic.uvs[v * 2], classic.uvs[v * 2 + 1]);
      }
    }
    subMeshes.push({ textureArchive: archive, textureRecord: record, startIndex, primitiveCount: list.length });
  }
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint32Array.from(idx), subMeshes, doors: [] };
}

/**
 * Kamer's half and the pieces, one model: the vertex buffers end to end, each part's indices moved past the vertices
 * before it - and ONE SUBMESH A PICTURE (ARENA-FIX 5, 2026-10-02: the parts' own submeshes were kept side by side, 85
 * of them for 23 pictures, so a host that draws the model by its submeshes - the city host, a dungeon's unbatched pass
 * - paid 85 draws where 23 say the same). Every triangle is kept with its corners, its winding and its picture; only
 * the order the triangles are listed in changes: each picture's triangles together, the pictures in the order they
 * are first met (Kamer's own submesh order first), each picture's triangles in the parts' order.
 * @param {any[]} parts models in the meshReader shape
 */
export function composeArenaModel(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.positions.length / 3; ni += p.indices.length; }
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
  /** @type {Map<string, { archive: number, record: number, runs: { part: number, start: number, count: number, v0: number }[], n: number }>} */
  const byPicture = new Map();
  let v0 = 0;
  parts.forEach((p, pi) => {
    positions.set(p.positions, v0 * 3);
    normals.set(p.normals, v0 * 3);
    uvs.set(p.uvs, v0 * 2);
    for (const s of p.subMeshes) {
      const k = `${s.textureArchive}_${s.textureRecord}`;
      if (!byPicture.has(k)) byPicture.set(k, { archive: s.textureArchive, record: s.textureRecord, runs: [], n: 0 });
      const g = byPicture.get(k);
      g.runs.push({ part: pi, start: s.startIndex, count: s.primitiveCount * 3, v0 });
      g.n += s.primitiveCount;
    }
    v0 += p.positions.length / 3;
  });
  const subMeshes = [];
  let at = 0;
  for (const g of byPicture.values()) {
    const startIndex = at;
    for (const r of g.runs) {
      const src = parts[r.part].indices;
      for (let i = 0; i < r.count; i++) indices[at++] = src[r.start + i] + r.v0;
    }
    subMeshes.push({ textureArchive: g.archive, textureRecord: g.record, startIndex, primitiveCount: g.n });
  }
  // an index no submesh names (none in a part this module makes) is kept at the tail, as it stood
  if (at < ni) {
    let base = 0;
    for (const p of parts) {
      const named = new Uint8Array(p.indices.length);
      for (const s of p.subMeshes) named.fill(1, s.startIndex, s.startIndex + s.primitiveCount * 3);
      for (let i = 0; i < p.indices.length; i++) if (!named[i]) indices[at++] = p.indices[i] + base;
      base += p.positions.length / 3;
    }
  }
  return { positions, normals, uvs, indices, subMeshes, doors: [] };
}

/**
 * The whole colosseum: Kamer's half and every piece out of the player's ARCH3D. `classicOf(id)` answers a classic
 * model in dfMeshToModel's shape, or null when the player's ARCH3D has no such record (that piece is not drawn - the
 * rest of the arena still stands).
 * @param {any} index Models/864102.json
 * @param {Uint8Array} bin Models/864102.bin
 * @param {(id: number) => any} classicOf
 */
export function buildArenaModel(index, bin, classicOf) {
  const parts = [decodeArenaModel(index, bin)];
  for (const piece of index.pieces ?? []) {
    const classic = classicOf(piece.model);
    if (classic) parts.push(arenaPieceModel(classic, piece));
  }
  return composeArenaModel(parts);
}

// ── THE STAIRS, WALKABLE (ARENA-FIX 1, 2026-10-02) ────────────────────────────────────────────────────────────────
// Visual QA walked the gate courtyard's stair up to the ring and failed it: its first riser stands 0.62 m over the
// courtyard's ground (the mesh's foot floats 0.22 m over the city's terrain) - past the controller's stepOffset 0.5 -
// and every riser after it is 0.37 m on a 0.40 m tread (43 degrees), so the capsule (radius 0.35) caught on the risers'
// lips and the enhanced climb took them for a wall (GRIP). Unity's CharacterController climbs Kamer's stairs because
// DFU's prefab carries them as one MeshCollider and PhysX slides the capsule's round foot over a lip; the port's
// collider resolves a riser as a face. So every stair run of the mesh is given a RAMP - collider faces only, never
// drawn - laid over its nosings, the way a stair's collider is made in any engine: the capsule walks the slope (under
// the motor's slopeLimit 70), the eye rides it, and the stair is still the stair to the eye.
//
// THE RUNS ARE READ OFF THE MESH, not listed by hand: a RISER is a vertical face (|n.y| under 0.05) between STAIR_RISER_MIN
// and STAIR_RISER_MAX high and at least RUN_W_MIN wide; a run is risers that stand one on another (the next one's foot at the
// last one's top), parallel, a tread apart (TREAD_MIN..TREAD_MAX) the same way, side by side over RUN_W_MIN - and at
// least RUN_MIN of them. The ramp is the upper hull of the run's nosings (no nosing stands above it, none is cut
// short), a hair over them (RAMP_LIFT), the width the run's risers share; at its foot it runs on down its first slope
// RAMP_BELOW under the first riser's foot, so a stair whose foot floats over the ground (the gate's) is met by its
// ramp under the ground. Surveyed (test/arena_fix.test.js): five runs - the gate's two flights to the ring (19 and 14
// risers, 7.35 m wide), its twin on the east (14), and the two flights to the upper terrace on the south side (10
// each). The parapets' 0.58/0.72 m steps on the wall walk are not stairs (over STAIR_RISER_MAX) and stay as they are.

/** A riser's height, metres: under STAIR_RISER_MIN is a lip, over STAIR_RISER_MAX a wall or a seat - not a stair's step. */
export const STAIR_RISER_MIN = 0.1;
export const STAIR_RISER_MAX = 0.48;
/** A tread's depth (one riser's plane to the next's), metres. */
export const TREAD_MIN = 0.15;
export const TREAD_MAX = 0.8;
/** A stair's least width, and its least number of risers. */
export const RUN_W_MIN = 0.5;
export const RUN_MIN = 3;
/** The ramp's lift over the nosings, and how far under the first riser's foot it runs on. */
export const RAMP_LIFT = 0.02;
export const RAMP_BELOW = 0.6;

/**
 * THE STAIR RUNS of a model in the meshReader shape (the drawn triangles - its submeshes'). Each run:
 * `{ up: [x, z]` the way up, `side: [x, z]` along the steps, `t0, t1` its width along `side`, `nosings: [{ s, y }]`
 * each riser's top edge (`s` along `up`), `foot` the first riser's foot `}`. Pure.
 * @param {{ positions: ArrayLike<number>, indices: ArrayLike<number>, subMeshes: any[] }} model
 */
export function arenaStairRuns(model) {
  const P = model.positions, I = model.indices;
  /** @type {{ hx: number, hz: number, dist: number, ylo: number, yhi: number, t0: number, t1: number }[]} */
  const risers = [];
  const near = (a, b, e) => Math.abs(a - b) <= e;
  for (const sm of model.subMeshes) {
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(n[0], n[1], n[2]);
      if (!(l > 1e-9) || Math.abs(n[1] / l) > 0.05) continue;
      const ylo = Math.min(P[a + 1], P[b + 1], P[c + 1]), yhi = Math.max(P[a + 1], P[b + 1], P[c + 1]);
      if (yhi - ylo < STAIR_RISER_MIN || yhi - ylo > STAIR_RISER_MAX) continue;
      let hx = n[0], hz = n[2];
      const hl = Math.hypot(hx, hz);
      hx /= hl; hz /= hl;
      if (hx < -1e-6 || (Math.abs(hx) <= 1e-6 && hz < 0)) { hx = -hx; hz = -hz; }   // facing-blind: one normal a plane
      const dist = P[a] * hx + P[a + 2] * hz;
      const ts = [a, b, c].map((v) => P[v] * -hz + P[v + 2] * hx);
      const t0 = Math.min(...ts), t1 = Math.max(...ts);
      // the riser's two triangles (and a back face) are one riser: the same plane, the same heights
      const same = risers.find((r) => near(r.hx, hx, 0.01) && near(r.hz, hz, 0.01) && near(r.dist, dist, 0.02) && near(r.ylo, ylo, 0.02) && near(r.yhi, yhi, 0.02) && t0 <= r.t1 + 0.02 && t1 >= r.t0 - 0.02);
      if (same) { same.t0 = Math.min(same.t0, t0); same.t1 = Math.max(same.t1, t1); } else risers.push({ hx, hz, dist, ylo, yhi, t0, t1 });
    }
  }
  const wide = risers.filter((r) => r.t1 - r.t0 >= RUN_W_MIN);
  /** the riser standing on `a`'s top, a tread on the way `sign` (or either, for the first), sharing its width */
  const nextOf = (a, sign) => {
    let best = null;
    for (const b of wide) {
      if (b === a || !near(a.hx, b.hx, 0.01) || !near(a.hz, b.hz, 0.01) || !near(b.ylo, a.yhi, 0.03)) continue;
      const d = b.dist - a.dist;
      if (Math.abs(d) < TREAD_MIN || Math.abs(d) > TREAD_MAX || (sign && Math.sign(d) !== sign)) continue;
      const ov = Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0);
      if (ov < RUN_W_MIN) continue;
      if (!best || ov > best.ov) best = { b, d, ov };
    }
    return best;
  };
  const taken = new Set();
  for (const a of wide) { const n = nextOf(a, 0); if (n) taken.add(n.b); }   // a riser something stands under starts no run
  const runs = [];
  for (const a of wide) {
    if (taken.has(a)) continue;
    const first = nextOf(a, 0);
    if (!first) continue;
    const sign = Math.sign(first.d);
    const chain = [a];
    for (let n = first; n && !chain.includes(n.b); n = nextOf(n.b, sign)) chain.push(n.b);
    if (chain.length < RUN_MIN) continue;
    const t0 = Math.max(...chain.map((r) => r.t0)), t1 = Math.min(...chain.map((r) => r.t1));
    if (t1 - t0 < RUN_W_MIN) continue;
    runs.push({
      up: [sign * a.hx, sign * a.hz], side: [-a.hz, a.hx], t0, t1,
      nosings: chain.map((r) => ({ s: sign * r.dist, y: r.yhi })), foot: a.ylo,
    });
  }
  return runs;
}

/** The upper hull of a run's nosings (`s` rising): the least ramp no nosing stands above. Pure. */
export function nosingHull(nosings) {
  const pts = nosings.slice().sort((p, q) => p.s - q.s);
  const hull = [];
  for (const p of pts) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2], b = hull[hull.length - 1];
      if ((b.s - a.s) * (p.y - a.y) - (b.y - a.y) * (p.s - a.s) >= 0) hull.pop(); else break;   // b under the chord a-p
    }
    hull.push(p);
  }
  return hull;
}

/**
 * THE RAMPS over a model's stair runs: triangles, in the model's frame - each run a strip along its nosings' upper hull
 * (lifted RAMP_LIFT), the run's width wide, its foot carried on down the first slope RAMP_BELOW under the first riser's
 * foot. `{ positions, indices, runs }`. Pure.
 */
export function arenaStairRamps(model) {
  const runs = arenaStairRuns(model);
  const pos = [], idx = [];
  for (const r of runs) {
    const hull = nosingHull(r.nosings);
    const [h0, h1] = hull;
    const k = (h1.y - h0.y) / (h1.s - h0.s);
    const drop = h0.y - r.foot + RAMP_BELOW;
    const line = [{ s: h0.s - drop / k, y: h0.y - drop }, ...hull].map((p) => ({ s: p.s, y: p.y + RAMP_LIFT }));
    const at = (s, t) => [r.up[0] * s + r.side[0] * t, r.up[1] * s + r.side[1] * t];
    const base = pos.length / 3;
    for (const p of line) {
      const a = at(p.s, r.t0), b = at(p.s, r.t1);
      pos.push(a[0], p.y, a[1], b[0], p.y, b[1]);
    }
    for (let i = 0; i + 1 < line.length; i++) {
      const v = base + i * 2;
      idx.push(v, v + 1, v + 3, v, v + 3, v + 2);
    }
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx), runs };
}

/**
 * The model with its stair ramps: the ramps' vertices after its own (an upward normal, no uv) and their triangles
 * after every submesh's - in no submesh, so no host draws them (a host draws a model by its submeshes, the static
 * batches merge submeshes, the automap's wire walks submeshes), while every collider built from the model's whole
 * index list (`collider.addMesh(key, cpu.positions, cpu.indices, ...)`, all four hosts) stands on them.
 * `colliderOnlyFrom` the first index that is the collider's alone. Pure.
 */
export function withStairRamps(model) {
  const ramps = arenaStairRamps(model);
  const nv = model.positions.length / 3, nr = ramps.positions.length / 3;
  const positions = new Float32Array((nv + nr) * 3), normals = new Float32Array((nv + nr) * 3), uvs = new Float32Array((nv + nr) * 2);
  positions.set(model.positions); positions.set(ramps.positions, nv * 3);
  normals.set(model.normals);
  for (let i = 0; i < nr; i++) normals[(nv + i) * 3 + 1] = 1;
  uvs.set(model.uvs);
  const indices = new Uint32Array(model.indices.length + ramps.indices.length);
  indices.set(model.indices);
  for (let i = 0; i < ramps.indices.length; i++) indices[model.indices.length + i] = ramps.indices[i] + nv;
  return { ...model, positions, normals, uvs, indices, colliderOnlyFrom: model.indices.length, stairRuns: ramps.runs.length };
}

// ── THE SEAMS CLOSED (ARENA-FIX 6, 2026-10-02) ────────────────────────────────────────────────────────────────────
// Visual QA saw a hairline of sky down a wall-and-gatehouse junction and light streaks on an inner wall. Both are the
// mesh's own, and both are the rasteriser's to show, not the modeller's to see in Unity's editor:
// - T-JUNCTIONS (552 in the 5,138 triangles): a corner of one face standing on the EDGE of another (a wall's course
//   meeting a long tower edge mid-way). The long edge and the two short ones are rasterised apart, the corner is never
//   exactly on the long edge after projection, and a sub-pixel crack opens along it - showing whatever is behind,
//   the sky. Closed the way such a mesh is closed: each face with corners on its edges is cut at them (a fan from its
//   opposite corner when they lie on one edge, from its centroid otherwise), every new corner taking the face's own
//   interpolated uv and normal, so the surface, its pictures and its light are what they were.
// - COPLANAR OVERLAPS (7 same-facing pairs): two faces in one plane overlapping (a 109_0 course over a 109_1 wall,
//   three 171_3 boards laid twice) - equal depths, so which one is drawn flickers pixel by pixel (z-fighting: the
//   streaks). The overlap is settled: the face of the picture the plane wears less of (the second of two in the same
//   picture) is set back SINK_M behind the other, so the plane shows one picture there, steadily.
// - NEAR CORNERS: corners a hair apart (T_EPS) welded into one, so two edges meant to meet do.
// Zero-area triangles are dropped (they draw nothing). Pure; the triangle count grows (each cut face is several).

/** A corner this near a face's edge stands on it, metres (Kamer's mesh is exact to the millimetre). */
export const T_EPS = 0.004;
/** How far an overlapped face is set back (past T_EPS, so a set-back corner is never taken for one on an edge). */
export const SINK_M = 0.006;

/**
 * The model with its T-junctions cut and its coplanar overlaps settled (meshReader shape in, out; one submesh a
 * picture kept; un-indexed - each triangle its own corners). `stats` `{ tjunctions, cut, sunk, dropped, welded }`. Pure.
 */
export function sealArenaSeams(model) {
  const it = sealSteps(model);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
/**
 * AUDIT PRE-MERGE 1003 W6: THE SEAL, A BREATH AT A TIME. The colosseum is sealed where it is first asked for - in the
 * world host, inside a streamed pixel's build (scenes/dataPipeline.js getGpuMesh, scenes/world.js), which otherwise gives
 * the frame back every few milliseconds (PERF7, systems/buildBreather.js) - and the seal ran ~0.5 s in one piece there.
 * The same steps (sealSteps) with `breathe()` awaited between each unit, as PERF-EXT23's merge is
 * (render/staticBatch.js finishSliced): the bytes sealArenaSeams makes.
 * @param {() => Promise<void>} breathe the build's breather
 */
export async function sealArenaSeamsSliced(model, breathe) {
  const it = sealSteps(model);
  for (let r = it.next(); ; r = it.next()) {
    if (r.done) return r.value;
    await breathe();
  }
}
/** AUDIT PRE-MERGE 1003 W6: the faces a unit of the seal's heavy loops takes (the welds, the T-junctions' edges - each
 *  face a few dozen lookups), the light loops' sixteen times as many, the overlap test's pairs thirty-two
 *  times: a unit a millisecond or two. */
export const SEAL_UNIT = 32;
/** sealArenaSeams' work, yielding between its units (AUDIT PRE-MERGE 1003 W6) - the order of every step its own. */
function* sealSteps(model) {
  const P = model.positions, N = model.normals, U = model.uvs, I = model.indices;
  const LIGHT = SEAL_UNIT * 16;
  /** @type {{ p: number[][], n: number[][], uv: number[][], pic: number, fn: number[], d: number, area: number, sink: number }[]} */
  const tris = [];
  for (let pic = 0; pic < model.subMeshes.length; pic++) {
    const sm = model.subMeshes[pic];
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      if ((t / 3 + 1) % LIGHT === 0) yield;
      const v = [I[t], I[t + 1], I[t + 2]];
      const p = v.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      const e1 = sub(p[1], p[0]), e2 = sub(p[2], p[0]);
      const c = cross(e1, e2), l = Math.hypot(c[0], c[1], c[2]);
      if (!(l > 1e-9)) continue;   // zero area: draws nothing
      const fn = [c[0] / l, c[1] / l, c[2] / l];
      tris.push({ p, n: v.map((i) => [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]]), uv: v.map((i) => [U[i * 2], U[i * 2 + 1]]), pic, fn, d: dot(fn, p[0]), area: l / 2, sink: 0 });
    }
  }
  // ── the welds: corners a few millimetres apart are one corner (the modeller's snapping missed by a hair - two edges
  // that should meet stand T_EPS apart, a crack of their own), each taken to the first of its cluster
  const reps = new Map();
  let welded = 0;
  const weld = (q) => {
    const kx = Math.round(q[0] / T_EPS), ky = Math.round(q[1] / T_EPS), kz = Math.round(q[2] / T_EPS);
    for (let x = kx - 1; x <= kx + 1; x++) for (let y = ky - 1; y <= ky + 1; y++) for (let z = kz - 1; z <= kz + 1; z++) {
      for (const r of reps.get(`${x},${y},${z}`) ?? []) {
        if (Math.hypot(r[0] - q[0], r[1] - q[1], r[2] - q[2]) <= T_EPS) { if (r[0] !== q[0] || r[1] !== q[1] || r[2] !== q[2]) welded++; return r; }
      }
    }
    const k = `${kx},${ky},${kz}`;
    if (!reps.has(k)) reps.set(k, []);
    reps.get(k).push(q);
    return q;
  };
  yield;
  for (let i = 0; i < tris.length; i++) { tris[i].p = tris[i].p.map(weld); if ((i + 1) % SEAL_UNIT === 0) yield; }
  for (let i = tris.length - 1; i >= 0; i--) {   // a sliver the weld closed is no face
    if ((i + 1) % LIGHT === 0) yield;
    const T = tris[i], c = cross(sub(T.p[1], T.p[0]), sub(T.p[2], T.p[0])), l = Math.hypot(c[0], c[1], c[2]);
    if (!(l > 1e-9)) tris.splice(i, 1);
  }
  const dropped = I.length / 3 - tris.length;
  // ── the coplanar overlaps
  const planeArea = (A) => {
    const by = new Map();
    for (const X of tris) {
      if (dot(A.fn, X.fn) < 0.999 || Math.abs(A.d - X.d) > 0.01) continue;
      if (!boxesNear(A.p, X.p, 6)) continue;
      by.set(X.pic, (by.get(X.pic) ?? 0) + X.area);
    }
    return by;
  };
  let sunk = 0;
  const grid = new Map();
  const G = 4;
  for (let i = 0; i < tris.length; i++) {
    if ((i + 1) % LIGHT === 0) yield;
    const [mn, mx] = box(tris[i].p);
    for (let gx = Math.floor(mn[0] / G); gx <= Math.floor(mx[0] / G); gx++) for (let gz = Math.floor(mn[2] / G); gz <= Math.floor(mx[2] / G); gz++) {
      const k = `${gx},${gz}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
  }
  const seen = new Set();
  let pairs = 0;
  for (const list of grid.values()) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      if (++pairs % (SEAL_UNIT * 32) === 0) yield;
      const i = Math.min(list[a], list[b]), j = Math.max(list[a], list[b]);
      const key = i * 1e6 + j;
      if (seen.has(key)) continue;
      seen.add(key);
      const A = tris[i], B = tris[j];
      if (dot(A.fn, B.fn) < 0.999 || Math.abs(A.d - B.d) > 0.01 || !boxesNear(A.p, B.p, 1e-3)) continue;
      if (!(strictlyInside(centroid(B.p), A) || strictlyInside(centroid(A.p), B))) continue;
      let loser = B;
      if (A.pic !== B.pic) { const by = planeArea(A); loser = (by.get(A.pic) ?? 0) < (by.get(B.pic) ?? 0) ? A : B; }
      if (!loser.sink) { loser.sink = SINK_M; sunk++; }
    }
  }
  for (const T of tris) if (T.sink) T.p = T.p.map((q) => [q[0] - T.fn[0] * T.sink, q[1] - T.fn[1] * T.sink, q[2] - T.fn[2] * T.sink]);
  // ── the T-junctions: every corner, filed by a 1 m grid
  const corners = new Map();
  const cell = (x) => Math.floor(x);
  let filed = 0;
  for (const T of tris) for (const q of (T.sink ? [] : T.p)) {   // a set-back face's corners stand behind the plane - no edge in it carries them
    if (++filed % LIGHT === 0) yield;
    const k = `${cell(q[0])},${cell(q[1])},${cell(q[2])}`;
    if (!corners.has(k)) corners.set(k, []);
    const l = corners.get(k);
    if (!l.some((o) => Math.abs(o[0] - q[0]) < 1e-5 && Math.abs(o[1] - q[1]) < 1e-5 && Math.abs(o[2] - q[2]) < 1e-5)) l.push(q);
  }
  /** corners strictly inside the segment a-b, within T_EPS of it, by their place along it */
  const onEdge = (a, b) => {
    const d = sub(b, a), L2 = dot(d, d);
    const out = [];
    if (!(L2 > 1e-8)) return out;
    const [mn, mx] = box([a, b]);
    for (let x = cell(mn[0] - T_EPS); x <= cell(mx[0] + T_EPS); x++) for (let y = cell(mn[1] - T_EPS); y <= cell(mx[1] + T_EPS); y++) for (let z = cell(mn[2] - T_EPS); z <= cell(mx[2] + T_EPS); z++) {
      for (const q of corners.get(`${x},${y},${z}`) ?? []) {
        const t = dot(sub(q, a), d) / L2;
        if (t * Math.sqrt(L2) <= T_EPS || (1 - t) * Math.sqrt(L2) <= T_EPS) continue;
        const f = [a[0] + d[0] * t - q[0], a[1] + d[1] * t - q[1], a[2] + d[2] * t - q[2]];
        if (Math.hypot(f[0], f[1], f[2]) <= T_EPS) out.push({ t, q });
      }
    }
    return out.sort((u, v) => u.t - v.t);
  };
  let tjunctions = 0, cut = 0;
  const outByPic = model.subMeshes.map(() => []);
  let unit = 0;
  for (const T of tris) {
    if (++unit % SEAL_UNIT === 0) yield;
    const edges = [0, 1, 2].map((e) => onEdge(T.p[e], T.p[(e + 1) % 3]));
    const n = edges[0].length + edges[1].length + edges[2].length;
    const corner = (k) => ({ p: T.p[k], n: T.n[k], uv: T.uv[k] });
    if (!n) { outByPic[T.pic].push([corner(0), corner(1), corner(2)]); continue; }
    tjunctions += n; cut++;
    // the polygon round the face: each corner, then the corners standing on its next edge
    const ring = [];
    for (let e = 0; e < 3; e++) {
      ring.push(corner(e));
      for (const { t, q } of edges[e]) ring.push(lerpCorner(corner(e), corner((e + 1) % 3), t, q));
    }
    const busy = edges.map((l) => l.length > 0);
    if (busy.filter(Boolean).length === 1) {
      // one edge carries them: a fan from the corner opposite it (none of the fan's triangles is flat)
      const e = busy.indexOf(true), apex = (e + 2) % 3;
      const start = ring.indexOf(ring.find((c) => c.p === T.p[apex]));
      const seq = [...ring.slice(start), ...ring.slice(0, start)];
      for (let k = 1; k + 1 < seq.length; k++) outByPic[T.pic].push([seq[0], seq[k], seq[k + 1]]);
    } else {
      // corners on two or three edges: a fan from the face's incentre (a corner of its own, as far inside the face as
      // a point can stand - a sliver's centroid all but touches its long edge), its uv and normal by the same weights
      const w = [0, 1, 2].map((k) => Math.hypot(...sub(T.p[(k + 1) % 3], T.p[(k + 2) % 3])));
      const ws = w[0] + w[1] + w[2];
      const mix = (f) => f(0).map((_, i) => (w[0] * f(0)[i] + w[1] * f(1)[i] + w[2] * f(2)[i]) / ws);
      const c = { p: mix((k) => T.p[k]), n: norm3(mix((k) => T.n[k])), uv: mix((k) => T.uv[k]) };
      for (let k = 0; k < ring.length; k++) outByPic[T.pic].push([c, ring[k], ring[(k + 1) % ring.length]]);
    }
  }
  yield;
  const total = outByPic.reduce((s, l) => s + l.length, 0);
  const positions = new Float32Array(total * 9), normals = new Float32Array(total * 9), uvs = new Float32Array(total * 6), indices = new Uint32Array(total * 3);
  const subMeshes = [];
  let at = 0;
  for (let pic = 0; pic < outByPic.length; pic++) {
    const list = outByPic[pic];
    if (!list.length) continue;
    const startIndex = at * 3;
    for (const tri of list) {
      if ((at + 1) % LIGHT === 0) yield;
      for (let k = 0; k < 3; k++) {
        const v = at * 3 + k;
        positions.set(tri[k].p, v * 3); normals.set(tri[k].n, v * 3); uvs.set(tri[k].uv, v * 2);
        indices[v] = v;
      }
      at++;
    }
    const sm = model.subMeshes[pic];
    subMeshes.push({ textureArchive: sm.textureArchive, textureRecord: sm.textureRecord, startIndex, primitiveCount: list.length });
  }
  return { positions, normals, uvs, indices, subMeshes, doors: [], stats: { tjunctions, cut, sunk, dropped, welded } };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const centroid = (p) => [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const box = (p) => [[0, 1, 2].map((k) => Math.min(...p.map((q) => q[k]))), [0, 1, 2].map((k) => Math.max(...p.map((q) => q[k])))];
const boxesNear = (a, b, e) => { const [an, ax] = box(a), [bn, bx] = box(b); return [0, 1, 2].every((k) => an[k] <= bx[k] + e && bn[k] <= ax[k] + e); };
/** A point strictly inside a face (its own plane's sense), off its edges. */
function strictlyInside(q, T) {
  const s = [0, 1, 2].map((e) => dot(cross(sub(T.p[(e + 1) % 3], T.p[e]), sub(q, T.p[e])), T.fn));
  return s.every((v) => v > 1e-6) || s.every((v) => v < -1e-6);
}
/** A corner standing on the edge a-b at `t`: its own place, the edge's uv and normal there. */
function lerpCorner(a, b, t, q) {
  return { p: q, n: norm3([a.n[0] + (b.n[0] - a.n[0]) * t, a.n[1] + (b.n[1] - a.n[1]) * t, a.n[2] + (b.n[2] - a.n[2]) * t]), uv: [a.uv[0] + (b.uv[0] - a.uv[0]) * t, a.uv[1] + (b.uv[1] - a.uv[1]) * t] };
}
