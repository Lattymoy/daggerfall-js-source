// TREES-SEATED (FIELD BUGS 2026-10-03b): THE RMB RESOURCE PACK'S HILLS, MEASURED - and since FIELD BUGS 2026-10-05
// HILL-SHAPES the shapes the port's stand-ins are drawn at (src/world/rmbrpHillShapes.js; they had been the catalogue's
// Small/Medium/Large mounds).
//
//   git clone --depth 1 https://github.com/drcarademono/rmb-resource-pack <dir>   (GIT_LFS_SKIP_SMUDGE=1 is enough)
//   node tools/rmbrpHills.mjs <dir>
//
// Reads, for each hill id the port stands in: its prefab (Prefabs/Hills/{Grass,Stone}/<id>.prefab), the .blend its mesh
// lives in (found by the guid in Assets/**.blend.meta), the mesh's vertices and faces out of the .blend itself (Blender's
// own SDNA - no Blender needed), and the scale the prefab stands it at: the .blend object's own (0.01 - the mesh is in
// centimetres) unless the prefab sets one (the Medium prefabs 0.005, the Small 0.0025). Prints each hill's half-extents,
// top and base in metres. Nothing of the pack is written or kept - the clone is the user's, and the numbers are a
// measurement of it (the rocks, stalls and docks were measured the same way).
//
// FIELD BUGS 2026-10-05 HILL-SHAPES ("Houses in Ipsham are floating"; "this particular structure is frequently
// flying"): `--shapes` prints src/world/rmbrpHillShapes.js - each hill MEASURED as a polar profile, the shape the port's
// stand-in is drawn at (townStandIns.js hillMesh). The mesh is read as Unity imports it (x mirrored - the orientation
// under which all 33 of TVRNAS03's and all 7 of TEMPASH3's authored trees lie within 0.75 m of its surface) at the
// prefab's scale; its top surface sampled on a grid; the centre the raised footprint's centroid; along SHAPE_BEARINGS
// bearings (every 22.5 degrees from +x towards +z) the reach - the 98th percentile of the surface's distance in that
// sector - and SHAPE_RINGS heights out along it, each the median of the surface in its cell (the rim the mesh's base).
// Sixteen bearings by ten rings - not the mesh, which is a sculpt of thousands of faces: the median of each cell, so a
// lump smaller than a cell is not in it.
//   node tools/rmbrpHills.mjs <clone>            the table: half-extents, top, base, the shape's fit
//   node tools/rmbrpHills.mjs <clone> --shapes   MEASURES, then WRITES src/world/rmbrpHillShapes.js whole (its header
//                                                kept, the grid and the table new) - `--bearings K --rings N` another grid
// AUDIT FB1005 H1: it printed the table alone, and imported the grid from the module a shell redirect had just emptied.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RMBRP_HILLS, RMBRP_PIECES } from '../src/world/townStandIns.js';

const root = process.argv[2];
const SHAPES = process.argv.includes('--shapes');
const argN = (flag, dflt) => { const i = process.argv.indexOf(flag); return i >= 0 ? Number(process.argv[i + 1]) : dflt; };
/** The grid the module is measured on - the module's own (16 bearings, 10 rings) unless asked for another. */
const SHAPE_BEARINGS = argN('--bearings', 16), SHAPE_RINGS = argN('--rings', 10);
const MODULE = join(dirname(fileURLToPath(import.meta.url)), '../src/world/rmbrpHillShapes.js');
if (!root || !existsSync(join(root, 'Prefabs/Hills'))) {
  console.error('usage: node tools/rmbrpHills.mjs <a clone of drcarademono/rmb-resource-pack> [--shapes]');
  process.exit(1);
}

/** Every file under `dir` whose name ends in `suffix`. */
function walk(dir, suffix, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, suffix, out); else if (n.endsWith(suffix)) out.push(p);
  }
  return out;
}

/** A .blend's file blocks and its SDNA (Blender's own description of its structs). */
function readBlend(path) {
  const b = readFileSync(path);
  if (b.toString('latin1', 0, 7) !== 'BLENDER') throw new Error(`${path}: not a .blend`);
  const ptr = b[7] === 0x2d ? 8 : 4, le = b[8] === 0x76;
  const i32 = (o) => (le ? b.readInt32LE(o) : b.readInt32BE(o)), u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const i16 = (o) => (le ? b.readInt16LE(o) : b.readInt16BE(o)), f32 = (o) => (le ? b.readFloatLE(o) : b.readFloatBE(o));
  const blocks = [];
  for (let o = 12; o < b.length;) {
    const code = b.toString('latin1', o, o + 4), size = i32(o + 4), sdna = i32(o + 8 + ptr), count = i32(o + 12 + ptr), data = o + 16 + ptr;
    blocks.push({ code, size, sdna, count, data });
    if (code === 'ENDB') break;
    o = data + size;
  }
  const dna = blocks.find((k) => k.code === 'DNA1');
  let p = dna.data + 4;
  const strings = () => { const n = i32(p + 4); p += 8; const out = []; for (let k = 0; k < n; k++) { const e = b.indexOf(0, p); out.push(b.toString('latin1', p, e)); p = e + 1; } return out; };
  const align = () => { p = (p + 3) & ~3; };
  const names = strings(); align();
  const types = strings(); align();
  p += 4; const tlen = types.map((_, k) => i16(p + k * 2)); p += types.length * 2; align();
  p += 4; const nStructs = i32(p); p += 4;
  const structs = [];
  for (let k = 0; k < nStructs; k++) {
    const t = i16(p), nf = i16(p + 2); p += 4;
    const fields = [];
    for (let f = 0; f < nf; f++) { fields.push([types[i16(p)], names[i16(p + 2)]]); p += 4; }
    structs.push({ name: types[t], fields });
  }
  /** byte offset of `field` in struct `name`, and the struct's index */
  const offset = (name, field) => {
    const si = structs.findIndex((s) => s.name === name);
    let o = 0;
    for (const [type, fname] of structs[si].fields) {
      if (fname === field) return { si, o };
      const isPtr = fname.startsWith('*') || fname.startsWith('(*');
      const dims = [...fname.matchAll(/\[(\d+)\]/g)].reduce((m, x) => m * Number(x[1]), 1);
      o += (isPtr ? ptr : tlen[types.indexOf(type)]) * dims;
    }
    throw new Error(`${path}: ${name}.${field} not in this .blend's SDNA`);
  };
  const rows = (name, field, read) => {
    const { si, o } = offset(name, field), out = [];
    for (const k of blocks) if (k.sdna === si && k.code === 'DATA') { const stride = k.size / k.count; for (let r = 0; r < k.count; r++) out.push(read(k.data + r * stride + o)); }
    return out;
  };
  const verts = rows('MVert', 'co[3]', (o) => [f32(o), f32(o + 4), f32(o + 8)]);
  const loops = rows('MLoop', 'v', (o) => u32(o));
  const starts = rows('MPoly', 'loopstart', (o) => i32(o)), totals = rows('MPoly', 'totloop', (o) => i32(o));
  const ob = (() => { try { return offset('Object', 'scale[3]'); } catch { return offset('Object', 'size[3]'); } })();   // Blender 3.0 names it size[3]
  const objScale = blocks.filter((k) => k.code.startsWith('OB') && k.sdna === ob.si).map((k) => f32(k.data + ob.o));
  return { verts, loops, polys: starts.map((s, k) => [s, totals[k]]), objScale: objScale[0] ?? 1 };
}

const metas = walk(join(root, 'Assets'), '.blend.meta');
const blendOfGuid = (guid) => metas.find((m) => readFileSync(m, 'utf8').includes(`guid: ${guid}`))?.slice(0, -'.meta'.length) ?? null;

/** The hill as it stands: its triangles in metres, x mirrored as Unity imports a .blend, at the prefab's scale. */
function hillTriangles(id) {
  const prefab = ['Grass', 'Stone'].map((d) => join(root, 'Prefabs/Hills', d, `${id}.prefab`)).find(existsSync);
  if (!prefab) return null;
  const text = readFileSync(prefab, 'utf8');
  const guid = /m_SourcePrefab: \{fileID: -?\d+, guid: ([0-9a-f]+)/.exec(text)?.[1] ?? /m_Mesh: \{fileID: -?\d+, guid: ([0-9a-f]+)/.exec(text)?.[1];
  const blend = guid ? blendOfGuid(guid) : null;
  if (!blend) return null;
  const m = readBlend(blend);
  const override = /m_LocalScale\.x\s*\n\s*value: ([\d.e-]+)/.exec(text)?.[1] ?? /m_LocalScale: \{x: ([\d.e-]+)/.exec(text)?.[1];
  const s = override != null && Number(override) !== 1 ? Number(override) : m.objScale;
  const tris = [];
  for (const [a, n] of m.polys) {
    const L = m.loops.slice(a, a + n).map((k) => [-m.verts[k][0] * s, m.verts[k][1] * s, m.verts[k][2] * s]);
    for (let k = 1; k + 1 < L.length; k++) tris.push([L[0], L[k], L[k + 1]]);
  }
  return { tris, scale: s, blend };
}

/** The highest of the triangles over (x, z), or null. */
function surfaceOf(tris) {
  const T = tris.map(([a, b, c]) => ({ a, b, c, x0: Math.min(a[0], b[0], c[0]), x1: Math.max(a[0], b[0], c[0]), z0: Math.min(a[2], b[2], c[2]), z1: Math.max(a[2], b[2], c[2]) }));
  return (x, z) => {
    let top = null;
    for (const { a, b, c, x0, x1, z0, z1 } of T) {
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
      if (top === null || y > top) top = y;
    }
    return top;
  };
}

const median = (a) => { a.sort((p, q) => p - q); return a.length ? a[a.length >> 1] : null; };
const r2 = (v) => Math.round(v * 100) / 100;

/** HILL-SHAPES: the polar profile of one hill - `{ c: [x, z], top, reach: [K], rings: [K][N] }` (rmbrpHillShapes.js). */
function measureShape(tris) {
  const surf = surfaceOf(tris), vs = tris.flat();
  const base = Math.min(...vs.map((v) => v[1]));
  const [x0, x1, z0, z1] = [Math.min(...vs.map((v) => v[0])), Math.max(...vs.map((v) => v[0])), Math.min(...vs.map((v) => v[2])), Math.max(...vs.map((v) => v[2]))];
  const step = Math.max(0.25, (x1 - x0) / 160), samples = [];
  for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) { const y = surf(x, z); if (y !== null) samples.push([x, y, z]); }
  const raised = samples.filter((p) => p[1] > 0.05);
  const cx = raised.reduce((a, p) => a + p[0], 0) / raised.length, cz = raised.reduce((a, p) => a + p[2], 0) / raised.length;
  const K = SHAPE_BEARINGS, N = SHAPE_RINGS;
  const bearing = (p) => Math.round(((Math.atan2(p[2] - cz, p[0] - cx) / (2 * Math.PI)) * K + K) % K) % K;
  const dist = (p) => Math.hypot(p[0] - cx, p[2] - cz);
  const reach = Array.from({ length: K }, (_, k) => { const d = samples.filter((p) => bearing(p) === k).map(dist).sort((a, b) => a - b); return d.length ? d[Math.floor(d.length * 0.98)] : step; });
  const cells = Array.from({ length: K }, () => Array.from({ length: N + 1 }, () => []));
  for (const p of samples) {
    const k = bearing(p), j = Math.round((dist(p) / reach[k]) * N);
    if (j <= N) cells[k][j].push(p[1]);
  }
  const top = median(cells.flatMap((row) => row[0]));
  const rings = cells.map((row) => row.slice(1).map((cell, j) => (j === N - 1 ? base : median(cell) ?? base)));
  return { c: [r2(cx), r2(cz)], top: r2(top), reach: reach.map(r2), rings: rings.map((row) => row.map(r2)) };
}

if (SHAPES) {
  const out = [];
  for (const id of Object.keys(RMBRP_HILLS)) {
    const h = hillTriangles(id);
    if (!h) throw new Error(`${id}: no mesh in the clone`);
    const s = measureShape(h.tris);
    out.push(`  ${id}: { c: [${s.c.join(', ')}], top: ${s.top}, reach: [${s.reach.join(', ')}],\n    rings: [${s.rings.map((r) => `[${r.join(', ')}]`).join(',\n      ')}] },`);
  }
  // the module whole: its header as it stands (the record's), then the grid and the table measured now
  const was = readFileSync(MODULE, 'utf8'), head = was.slice(0, was.indexOf('export const SHAPE_BEARINGS'));
  if (!head) throw new Error(`${MODULE}: no header before SHAPE_BEARINGS - restore it from git first`);
  writeFileSync(MODULE, `${head}export const SHAPE_BEARINGS = ${SHAPE_BEARINGS};\nexport const SHAPE_RINGS = ${SHAPE_RINGS};\n\n`
    + `/** id -> { c: [x, z], top, reach: [SHAPE_BEARINGS], rings: [SHAPE_BEARINGS][SHAPE_RINGS] } (the tool's own print). */\n`
    + `export const RMBRP_HILL_SHAPES = Object.freeze({\n${out.join('\n')}\n});\n`);
  console.log(`${MODULE}: ${out.length} hills, ${SHAPE_BEARINGS} bearings by ${SHAPE_RINGS} rings`);
  process.exit(0);
}

console.log('id     half-extents (m)   top (m)  base (m)   the shape against the surface: median and 90th percentile miss (m)');
for (const id of Object.keys(RMBRP_HILLS)) {
  const h = hillTriangles(id);
  if (!h) { console.log(`${id}  no mesh found`); continue; }
  const vs = h.tris.flat(), surf = surfaceOf(h.tris);
  const ext = (k) => [Math.min(...vs.map((v) => v[k])), Math.max(...vs.map((v) => v[k]))];
  const [x0, x1] = ext(0), [y0, y1] = ext(1), [z0, z1] = ext(2);
  // the stand-in as the pipeline builds it, against the pack's surface over the hill's raised ground
  const drawn = RMBRP_PIECES[id](), dp = drawn.positions, di = drawn.indices, dt = [];
  for (let t = 0; t < di.length; t += 3) dt.push([0, 1, 2].map((q) => [dp[di[t + q] * 3], dp[di[t + q] * 3 + 1], dp[di[t + q] * 3 + 2]]));
  const standIn = surfaceOf(dt), miss = [];
  for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) { const y = surf(x, z); if (y !== null && y > 0.05) miss.push(Math.abs((standIn(x, z) ?? 0) - y)); }
  miss.sort((a, b) => a - b);
  console.log(`${id}  ${((x1 - x0) / 2).toFixed(1).padStart(5)} x ${((z1 - z0) / 2).toFixed(1).padEnd(5)}      ${y1.toFixed(2).padStart(6)}   ${y0.toFixed(2).padStart(6)}     ${miss[miss.length >> 1]?.toFixed(2)} / ${miss[Math.floor(miss.length * 0.9)]?.toFixed(2)}   (${h.scale}, ${h.blend.split('/').slice(-2).join('/')})`);
}
