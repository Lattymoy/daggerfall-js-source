#!/usr/bin/env node
// FIELD BUGS 2026-10-04d QUEST-MARKERS: THE TOWN PACKS' QUEST MARKERS, MEASURED - the list the port's curation carries
// (src/systems/quest/markerCuration.js CURATED_QUEST_MARKERS), made from the player's own data, as tools/rmbrpHills.mjs
// measured the RMB Resource Pack's hills.
//
//   ARENA2_PATH=<the player's arena2> node tools/townQuestMarkers.mjs           print the list
//   ARENA2_PATH=<...> node tools/townQuestMarkers.mjs --check                   compare it with the committed list (exit 1)
//   ARENA2_PATH=<...> node tools/townQuestMarkers.mjs --classic                 and measure Daggerfall's own BLOCKS.BSA
//
// Every building interior the two vendored town packs lay out - each pack's RMB blocks, rebuilt over the player's own
// BLOCKS.BSA as the world-data door rebuilds them - is laid out by world/interiorLayout.js over the models the port's
// pipeline builds for it (scenes/dataPipeline.js buildGpuMesh: the town stand-ins and the alias beds, Kamer's
// machinery, the seams patched, the rest out of the player's ARCH3D), and every quest marker in it (editor flats 199.11,
// a spawn, and 199.18, an item) is measured against that geometry by the two tests the town-mods audit used:
//   - THE RAY. Straight down from 0.3 m over the marker, and out of it 1 m up in eight directions: VOID when nothing is
//     below it or two of the eight leave the room; INSIDE A SOLID when the first face below is not a floor facing up,
//     or four of the eight strike a face from behind.
//   - THE WALK. From the interior's enter markers (199.8, and 199.4 where DFU accepts it), over a 0.25 m grid of
//     floor a person stands on (1.7 m of headroom, a step of at most 0.65 m, nothing at knee or chest height in the
//     way): REACHABLE when a floor cell the walk reaches lies within 2.5 m of the marker with a clear sight of it.
// A marker both condemn - void or inside a solid, and unreachable - is listed, with the FLOOR SPOT it stands at instead:
// the walk's nearest floor cell to it on a storey (a floor height the walk covers four square metres of - never a table
// it climbed onto from a bench) with half a metre of the same floor all round, in the block's own units. Nothing of the
// packs or of ARENA2 is written; the numbers are a measurement of the player's data.
//
// FIELD BUGS 2026-10-05 SEALED-CELLAR ("Can't access building basement to continue quest" - Tigonus, The Possessed
// Child: "Supposed to be stairs down"): THE HATCHES. The packs' cellars and lofts are reached by a stair the author
// shut with a floor tile laid over its head (GEMSAL00 #7: stairs 40018 under floor 1000 and its ceiling 2000, a rug on
// top) and marked with a pair of editor markers no game reads - 199.14 on the floor over the plug, 199.13 at the other
// side. DFU lays the plug as the port does (AddModels places every record), so a quest marker past one stands where no
// player walks, on a sound floor: THE RAY passes it and the list above never held it. A marker THE WALK does not reach
// from the entrance but does from the far side of a hatch (a 199.14 or 199.13 the walk reaches, its partner the nearest
// marker of the other number) is listed too, its floor spot the walk's nearest to the hatch's near side - the person,
// the foe or the item stands by the shut stair, in the room the player can enter.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** MeshReader.GlobalScale - one block unit, in metres. */
export const UNIT = 0.025;
const SPAWN = 11, ITEM = 18, ENTER = 8, REST = 4, EDITOR = 199;
/** SEALED-CELLAR: the packs' hatch markers - 199.14 over the plug, 199.13 at the stair's other side. */
export const HATCH = Object.freeze([14, 13]);
/** AUDIT FB1005 S1: how far a hatch's spot stands from the room's entrance (its enter and rest markers), in metres. */
export const HATCH_DOOR_CLEAR_M = 1.5;
export const VENDORS = Object.freeze([['beautiful-villages', 10], ['beautiful-cities', 20]]);
/** The walk's person and its reach (the audit's): a 0.25 m grid, 1.7 m of headroom, a 0.65 m step, 2.5 m of reach. */
export const WALK = Object.freeze({ cell: 0.25, head: 1.7, step: 0.65, reach: 2.5, clear: 2 });

/** The player's towns: the door holding both packs, BLOCKS.BSA, MAPS.BSA, and a model getter as the pipeline builds. */
export async function openTownData(arena2) {
  const bytes = (f) => new Uint8Array(readFileSync(join(arena2, f)));
  const W = await import('../src/formats/worldDataReplacement.js');
  const { setValue } = await import('../src/systems/settings.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const { openWorldDataPack } = await import('../src/formats/worldDataPack.js');
  const { dfMeshToModel } = await import('../src/world/meshReader.js');
  const { patchSeams } = await import('../src/world/arch3dSeams.js');
  const { MACHINERY, MACHINERY_MODEL_ID } = await import('../src/world/windmillMesh.js');
  const { installTownStandIns } = await import('../src/world/townStandIns.js');
  const { customModelFor, customAliasFor } = await import('../src/world/customModels.js');
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  W._resetWorldDataReplacement();
  setValue('Enhancements', 'AssetInjection', 'True');
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
  const packs = {};
  for (const [v, priority] of VENDORS) {
    packs[v] = openWorldDataPack(JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString('utf8')), { blocks });
    W.registerWorldDataPack(packs[v], () => true, { priority });
  }
  W.latchWorldDataDoor(); W.quietLocationOverrides(true);
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  installTownStandIns(() => true);
  const size = () => ({ width: 64, height: 64 });   // a geometry measure: the UVs are never read
  const classicModel = (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : dfMeshToModel(arch.getMesh(i), size); };
  const models = new Map();
  /** buildGpuMesh's order: Kamer's machinery, a registered model, an alias's classic model, ARCH3D - seams patched. */
  const getModel = (id) => {
    if (models.has(id)) return models.get(id);
    let m = null;
    if (id === MACHINERY_MODEL_ID) m = MACHINERY;
    else {
      m = customModelFor(id, { classicModel });
      if (!m) {
        const cid = customAliasFor(id)?.model ?? id;
        const i = arch.getRecordIndex(cid);
        m = i === -1 ? null : dfMeshToModel(patchSeams(cid, arch.getMesh(i)), size);
      }
    }
    models.set(id, m);
    return m;
  };
  /** A block of a pack as the door serves it - the pack's own rebuild over the player's BLOCKS.BSA. */
  const packBlock = (vendor, name) => {
    const index = blocks.getBlockIndex(name);
    return { dfBlock: W.blockFromJson(packs[vendor].rebuild(`${name}.json`, maps), index), index };
  };
  return { blocks, maps, packs, getModel, packBlock };
}

/** The triangles of a laid-out interior: [ax,ay,az, bx,by,bz, cx,cy,cz, nx,ny,nz] each, the normal turned to the
 *  mesh's own stored normal (the face the model shows). */
export async function interiorTriangles(getModel, dfBlock, blockIndex, recordIndex) {
  const { layoutInterior } = await import('../src/world/interiorLayout.js');
  const warn = console.warn; console.warn = () => {};
  let layout;
  try { layout = layoutInterior(dfBlock, blockIndex, recordIndex, getModel); } finally { console.warn = warn; }
  const tris = [];
  for (const p of layout.placements) {
    const m = getModel(p.modelIdNum);
    if (!m) continue;
    const M = p.matrix, P = m.positions, N = m.normals, I = m.indices;
    const at = (k) => [M[0] * P[k] + M[4] * P[k + 1] + M[8] * P[k + 2] + M[12], M[1] * P[k] + M[5] * P[k + 1] + M[9] * P[k + 2] + M[13], M[2] * P[k] + M[6] * P[k + 1] + M[10] * P[k + 2] + M[14]];
    for (let t = 0; t < I.length; t += 3) {
      const a = at(I[t] * 3), b = at(I[t + 1] * 3), c = at(I[t + 2] * 3);
      let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const l = Math.hypot(nx, ny, nz);
      if (!(l > 1e-9)) continue;
      nx /= l; ny /= l; nz /= l;
      if (N) {
        const k = I[t] * 3;
        const sx = M[0] * N[k] + M[4] * N[k + 1] + M[8] * N[k + 2], sy = M[1] * N[k] + M[5] * N[k + 1] + M[9] * N[k + 2], sz = M[2] * N[k] + M[6] * N[k + 1] + M[10] * N[k + 2];
        if (nx * sx + ny * sy + nz * sz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      }
      tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], nx, ny, nz);
    }
  }
  return { tris: Float64Array.from(tris), layout };
}

/** The first face along a ray, either side: { t, nx, ny, nz } or null. */
export function rayHit(tris, o, d, maxT = 200) {
  let best = maxT, hit = -1;
  for (let i = 0; i < tris.length; i += 12) {
    const e1x = tris[i + 3] - tris[i], e1y = tris[i + 4] - tris[i + 1], e1z = tris[i + 5] - tris[i + 2];
    const e2x = tris[i + 6] - tris[i], e2y = tris[i + 7] - tris[i + 1], e2z = tris[i + 8] - tris[i + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-12 && det < 1e-12) continue;
    const inv = 1 / det;
    const sx = o[0] - tris[i], sy = o[1] - tris[i + 1], sz = o[2] - tris[i + 2];
    const u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t > 1e-6 && t < best) { best = t; hit = i; }
  }
  return hit < 0 ? null : { t: best, nx: tris[hit + 9], ny: tris[hit + 10], nz: tris[hit + 11] };
}

const AROUND = Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), 0, Math.sin(k * Math.PI / 4)]);
/** THE RAY: 'void' | 'insideSolid' | 'buried' | 'floating' | 'ok' for a marker at `p` (metres, y up). */
export function rayVerdict(tris, p) {
  const down = rayHit(tris, [p.x, p.y + 0.3, p.z], [0, -1, 0]);
  let escape = 0, back = 0;
  for (const d of AROUND) {
    const r = rayHit(tris, [p.x, p.y + 1.0, p.z], d, 400);
    if (!r) { escape++; continue; }
    if (r.nx * d[0] + r.ny * d[1] + r.nz * d[2] > 0) back++;
  }
  if (!down || escape >= 2) return 'void';
  if (!(down.ny > 0.3) || back >= 4) return 'insideSolid';
  const floor = down.t - 0.3;
  if (floor < -0.05) return 'buried';
  if (floor > 0.6) return 'floating';
  return 'ok';
}

/** THE WALK from `starts` (metres): every floor cell a person reaches, whether one SEES a point, and the nearest cell to
 *  a point with `clear` cells of the same floor all round. */
export function walkFloor(tris, starts, { cell, head, step, reach, clear } = WALK) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i += 12) for (let k = 0; k < 9; k += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], tris[i + k + a]); hi[a] = Math.max(hi[a], tris[i + k + a]); }
  const B = 1.0, bx0 = Math.floor(lo[0] / B), bz0 = Math.floor(lo[2] / B), bw = Math.floor(hi[0] / B) - bx0 + 1;
  const buckets = new Map();
  const bucketAt = (x, z) => (Math.floor(x / B) - bx0) + (Math.floor(z / B) - bz0) * bw;
  for (let i = 0; i < tris.length; i += 12) {
    const xs = [tris[i], tris[i + 3], tris[i + 6]], zs = [tris[i + 2], tris[i + 5], tris[i + 8]];
    for (let x = Math.floor(Math.min(...xs) / B); x <= Math.floor(Math.max(...xs) / B); x++) {
      for (let z = Math.floor(Math.min(...zs) / B); z <= Math.floor(Math.max(...zs) / B); z++) {
        const k = (x - bx0) + (z - bz0) * bw;
        (buckets.get(k) ?? buckets.set(k, []).get(k)).push(i);
      }
    }
  }
  const subOf = new Map();
  const sub = (...keys) => {
    const key = [...new Set(keys)].sort((a, b) => a - b).join(':');
    let v = subOf.get(key);
    if (!v) {
      const ids = new Set(keys.flatMap((k) => buckets.get(k) ?? []));
      v = new Float64Array(ids.size * 12);
      let j = 0;
      for (const i of ids) v.set(tris.subarray(i, i + 12), (j++) * 12);
      subOf.set(key, v);
    }
    return v;
  };
  const floorsAt = (x, z) => {
    const t = sub(bucketAt(x, z));
    const out = [];
    let y = hi[1] + 1;
    for (let guard = 0; guard < 12; guard++) {
      const h = rayHit(t, [x, y, z], [0, -1, 0], y - lo[1] + 1);
      if (!h) break;
      const fy = y - h.t;
      if (h.ny > 0.5 && !rayHit(t, [x, fy + 0.02, z], [0, 1, 0], head)) out.push(fy);
      y = fy - 0.01;
    }
    return out;
  };
  const cells = new Map();
  const floors = (i, j) => { const k = `${i},${j}`; let v = cells.get(k); if (!v) { v = floorsAt(lo[0] + i * cell, lo[2] + j * cell); cells.set(k, v); } return v; };
  const seen = new Set(), queue = [], reached = [];
  const enqueue = (n) => { const k = `${n.i},${n.j},${n.h.toFixed(2)}`; if (!seen.has(k)) { seen.add(k); queue.push(n); } };
  for (const p of starts) {
    const i0 = Math.round((p.x - lo[0]) / cell), j0 = Math.round((p.z - lo[2]) / cell);
    let best = null;
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
      for (const h of floors(i0 + di, j0 + dj)) if (Math.abs(h - p.y) < 0.7 && (!best || Math.abs(h - p.y) < best.d)) best = { i: i0 + di, j: j0 + dj, h, d: Math.abs(h - p.y) };
    }
    if (best) enqueue(best);
  }
  while (queue.length) {
    const n = queue.pop();
    reached.push(n);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = n.i + di, j = n.j + dj;
      for (const h of floors(i, j)) {
        if (Math.abs(h - n.h) > step) continue;
        const x0 = lo[0] + n.i * cell, z0 = lo[2] + n.j * cell;
        const t = sub(bucketAt(x0, z0), bucketAt(x0 + di * cell, z0 + dj * cell)), d = [di, 0, dj];
        if (rayHit(t, [x0, Math.max(h, n.h) + 0.45, z0], d, cell) || rayHit(t, [x0, Math.max(h, n.h) + 1.3, z0], d, cell)) continue;
        enqueue({ i, j, h });
      }
    }
  }
  const at = (n) => ({ x: lo[0] + n.i * cell, y: n.h, z: lo[2] + n.j * cell });
  const byCell = new Map();
  for (const n of reached) (byCell.get(`${n.i},${n.j}`) ?? byCell.set(`${n.i},${n.j}`, []).get(`${n.i},${n.j}`)).push(n.h);
  // a STOREY is a floor height the walk covers four square metres of - the room's floor, never a table, a bed or a
  // landing it climbed onto (the walk steps onto a bench, and from it onto the table)
  const level = (h) => Math.round(h * 10) || 0;
  const perLevel = new Map();
  for (const n of reached) perLevel.set(level(n.h), (perLevel.get(level(n.h)) ?? 0) + 1);
  const storey = (h) => (perLevel.get(level(h)) ?? 0) * cell * cell >= 4;
  return {
    reached: reached.map(at),
    /** A reached cell within `reach` of `p` with a clear sight of it (eye 1.5 m over its floor, `p` 0.3 m over its own). */
    sees(p) {
      for (const n of reached) {
        const c = at(n);
        if (Math.hypot(c.x - p.x, c.z - p.z, (c.y + 1.0) - (p.y + 0.3)) > reach) continue;
        const o = [c.x, c.y + 1.5, c.z], v = [p.x - o[0], p.y + 0.3 - o[1], p.z - o[2]], L = Math.hypot(...v);
        if (!rayHit(tris, o, v.map((e) => e / L), L - 0.05)) return true;
      }
      return false;
    },
    /** The nearest reached cell to `p` on a storey, with `clear` cells of the same floor (within 0.1 m) all round it,
     *  or null. SEALED-CELLAR: `passes`, where given, a further test the cell must pass (the hatch's spots: THE RAY's floor -
     *  by a shut stair the nearest clear cell can stand under its rail). */
    clearSpot(p, passes = null) {
      let best = null;
      for (const n of reached) {
        let ok = storey(n.h);
        for (let di = -clear; di <= clear && ok; di++) for (let dj = -clear; dj <= clear && ok; dj++) {
          ok = (byCell.get(`${n.i + di},${n.j + dj}`) ?? []).some((h) => Math.abs(h - n.h) <= 0.1);
        }
        if (!ok) continue;
        const c = at(n), d = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
        if (passes && best && d > best.d + 1e-9) continue;
        if (passes && !passes(c)) continue;
        if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && (n.i < best.n.i || (n.i === best.n.i && n.j < best.n.j)))) best = { d, n, c };
      }
      return best?.c ?? null;
    },
  };
}

const rawOf = (p) => [Math.round(p.x / UNIT), Math.round(-p.y / UNIT) || 0, Math.round(p.z / UNIT)];
/** One interior's quest markers: [{ record, at: [xPos, yPos, zPos], ray, reachable, to: [xPos, yPos, zPos] | null }] -
 *  `to` the floor spot of a marker both tests condemn. */
export async function measureInterior(getModel, dfBlock, blockIndex, recordIndex) {
  const flats = dfBlock.rmbBlock.subRecords[recordIndex].interior.blockFlatObjectRecords.filter((f) => f.textureArchive === EDITOR && (f.textureRecord === SPAWN || f.textureRecord === ITEM));
  if (!flats.length) return [];
  const { tris, layout } = await interiorTriangles(getModel, dfBlock, blockIndex, recordIndex);
  const entries = layout.markers.filter((m) => m.type === ENTER || m.type === REST);
  const walk = walkFloor(tris, entries);
  const sealed = hatchesOf(layout.markers, walk);
  // AUDIT FB1005 S1: a hatch's spot is a floor (THE RAY) and not the entrance - a quest foe stood there meets the player
  // at the door (TEMPASF0 #7's stood 0.95 m from its one enter marker)
  const hatchSpotOk = (c) => rayVerdict(tris, c) === 'ok' && entries.every((m) => Math.hypot(c.x - m.x, c.z - m.z) >= HATCH_DOOR_CLEAR_M);
  return flats.map((f) => {
    const p = { x: f.xPos * UNIT, y: -f.yPos * UNIT, z: f.zPos * UNIT };
    const ray = rayVerdict(tris, p), reachable = walk.sees(p);
    const condemned = (ray === 'void' || ray === 'insideSolid') && !reachable;
    // SEALED-CELLAR: past a shut hatch - the walk from its far side reaches it - it stands by the hatch's near side
    const hatch = !condemned && !reachable ? sealed.find((h) => (h.walk ??= walkFloor(tris, [h.far])).sees(p)) : null;
    const spot = condemned ? walk.clearSpot(p) : hatch ? walk.clearSpot(hatch.near, hatchSpotOk) : null;
    return { record: f.textureRecord, at: [f.xPos, f.yPos, f.zPos], ray, reachable, ...(hatch ? { sealed: true } : {}), to: spot ? rawOf(spot) : null };
  });
}

/** SEALED-CELLAR: an interior's hatches the entrance's walk reaches - `{ near, far }`, a 199.14 or 199.13 it reaches
 *  and the nearest marker of the other number (metres) - in the layout's marker order. */
export function hatchesOf(markers, walk) {
  const out = [];
  for (const near of markers) {
    if (!HATCH.includes(near.type) || !walk.sees(near)) continue;
    const other = HATCH.find((t) => t !== near.type);
    let far = null, best = Infinity;
    for (const m of markers) {
      if (m.type !== other) continue;
      const d = Math.hypot(m.x - near.x, m.y - near.y, m.z - near.z);
      if (d < best) { best = d; far = m; }
    }
    if (far && !walk.sees(far)) out.push({ near, far });
  }
  return out;
}

const designOf = (sub) => createHash('sha1').update(JSON.stringify([sub.interior.block3dObjectRecords, sub.interior.blockFlatObjectRecords, sub.interior.blockDoorRecords])).digest('hex');
/** Every pack's buildings whose quest markers include a condemned one, grouped by interior design: the curation list
 *  ({ design, where: [[vendor, block, record], ...], markers: [{ record, at, to }] }), sorted. `only` limits the walk
 *  to those [vendor, block, record]s (the gated test re-measures the list it pins). */
export async function measureTownPacks(data, { only = null, log = () => {} } = {}) {
  const designs = new Map(), measured = new Map();
  const wanted = only ? new Set(only.map(([v, b, r]) => `${v}|${b}|${r}`)) : null;
  for (const [vendor] of VENDORS) {
    const names = data.packs[vendor].names().filter((n) => n.endsWith('.RMB.json')).map((n) => n.slice(0, -5)).sort();
    for (const name of names) {
      if (wanted && ![...wanted].some((w) => w.startsWith(`${vendor}|${name}|`))) continue;
      const { dfBlock, index } = data.packBlock(vendor, name);
      const rmb = dfBlock.rmbBlock;
      for (let rec = 0; rec < rmb.subRecords.length; rec++) {
        if (wanted && !wanted.has(`${vendor}|${name}|${rec}`)) continue;
        const sub = rmb.subRecords[rec];
        if ((rmb.fldHeader.buildingDataList[rec]?.buildingType ?? -1) === -1 || !sub.interior?.header?.num3dObjectRecords) continue;
        const key = designOf(sub);
        if (!measured.has(key)) measured.set(key, await measureInterior(data.getModel, dfBlock, index >= 0 ? index : 99999, rec));
        const bad = measured.get(key).filter((m) => m.to);
        if (!bad.length) continue;
        const d = designs.get(key) ?? designs.set(key, { buildingType: rmb.fldHeader.buildingDataList[rec].buildingType, where: [], markers: bad.map(({ record, at, to }) => ({ record, at, to })) }).get(key);
        d.where.push([vendor, name, rec]);
      }
      log(`${vendor} ${name}`);
    }
  }
  return [...designs.values()]
    .map((d) => ({ design: `${d.where[0][1]}#${d.where[0][2]}`, ...d }))
    .sort((a, b) => b.where.length - a.where.length || a.design.localeCompare(b.design));
}

/** Daggerfall's own BLOCKS.BSA measured the same way: [{ block, record, record type, at, ray }] of every condemned marker. */
export async function measureClassic(data, { log = () => {} } = {}) {
  const out = [], measured = new Map();
  for (let b = 0; b < data.blocks.count; b++) {
    const name = data.blocks.getBlockName(b);
    if (!name?.endsWith('.RMB')) continue;
    const dfBlock = data.blocks.readClassicBlock(b);
    const rmb = dfBlock?.rmbBlock;
    if (!rmb) continue;
    for (let rec = 0; rec < rmb.subRecords.length; rec++) {
      const sub = rmb.subRecords[rec];
      if ((rmb.fldHeader.buildingDataList[rec]?.buildingType ?? -1) === -1 || !sub.interior?.header?.num3dObjectRecords) continue;
      const key = designOf(sub);
      if (!measured.has(key)) measured.set(key, await measureInterior(data.getModel, dfBlock, b, rec));
      for (const m of measured.get(key)) if (m.to) out.push({ block: name, rec, ...m });
    }
    if (b % 200 === 0) log(`classic ${b}`);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2 || !existsSync(join(arena2, 'ARCH3D.BSA'))) {
    console.error('usage: ARENA2_PATH=<the player\'s arena2> node tools/townQuestMarkers.mjs [--check] [--classic]');
    process.exit(1);
  }
  const say = console.log;
  console.log = () => {};
  const data = await openTownData(arena2);
  const list = await measureTownPacks(data, { log: (s) => process.stderr.write(`\r${s.padEnd(60)}`) });
  process.stderr.write('\n');
  if (process.argv.includes('--check')) {
    const { CURATED_QUEST_MARKERS } = await import('../src/systems/quest/markerCuration.js');
    const same = JSON.stringify(list) === JSON.stringify(CURATED_QUEST_MARKERS);
    say(same ? `the committed list is the measure: ${list.length} designs` : 'the committed list differs from the measure:');
    if (!same) { say(JSON.stringify(list, null, 2)); process.exit(1); }
  } else {
    say(JSON.stringify(list, null, 2));
    say(`// ${list.length} designs, ${list.reduce((n, d) => n + d.where.length, 0)} buildings' interiors, ${list.reduce((n, d) => n + d.markers.length, 0)} markers`);
  }
  if (process.argv.includes('--classic')) {
    const classic = await measureClassic(data, { log: (s) => process.stderr.write(`\r${s.padEnd(60)}`) });
    process.stderr.write('\n');
    say(`// Daggerfall's own BLOCKS.BSA: ${classic.length} condemned quest markers${classic.length ? `: ${JSON.stringify(classic)}` : ''}`);
  }
}
