#!/usr/bin/env node
// ARENA1 (2026-10-02): DAGGERFALL ARENA 1.0 (Kamer) - THE COLOSSEUM AS DATA, OUT OF THE SHIPPED BUNDLE.
//
//   node tools/daggerfallArenaExtract.mjs "<path-to>/daggerfall arena.dfmod" [outDir] --arena2 <ARENA2> [--scan]
//
// Default outDir is vendor/daggerfall-arena. Mac, 2026-10-02: the arena "is to be a centerpoint that fits in the middle
// of Daggerfall city" - bible/11-Multiplayer/Arena.md "1. The building". The bundle is read with
// tools/lib/unityScene.mjs (Come Sail Away's reader) and what the port carries is written down as data:
//
// - `daggerfallarena.dfmod.json` - the mod's manifest, the bundle's own TextAsset byte for byte.
// - `Models/864102.json` + `Models/864102.bin` - prefab 864102 ("Castle"): Kamer's own mesh - positions (f32 x3),
//   normals (f32 x3, the bundle's half floats widened), uv0 (f32 x2) and 16-bit indices - in the prefab's own space,
//   which is Unity's and so the port's (DFU's model space verbatim: metres, +Y up, LEFT-HANDED, Unity's winding;
//   world/meshReader.js mints every classic model in the same frame, which is why no axis is negated here - the
//   windmill's DAEs needed X negated only because COLLADA is right-handed and Unity's importer converts on the way
//   in, scripts/bakeWindmill.mjs). Its 23 submeshes keep their slot order, each with the classic (archive, record)
//   DFU's RuntimeMaterials puts into that slot at Awake (ApplyClimate 0 on all 23: no climate, no season). The
//   prefab's MeshCollider (the same mesh, non-convex) is recorded as `collider`.
// - MINUS THE TRIANGLES THAT ARE DAGGERFALL'S OWN: the undercroft passages under the floor are copies of
//   Daggerfall's dungeon models placed on its 3.2 m grid. A copy of an ARCH3D record is never carried (the bed-alias
//   law, world/customModels.js), so each is found in the player's ARCH3D, every triangle of it compared - the same
//   three corners (5 mm), the same uv at each (dfMeshToModel's, 0.02), the same winding - and the triangles that
//   match are left out of the mesh and written as a `pieces` list instead: the model id, how it is turned (a mirror
//   in x, then quarter turns about +Y), where it stands, and which of its triangles stand (a piece Kamer trimmed keeps
//   only those). Where Kamer gave a copied triangle another of Daggerfall's pictures it is still the classic
//   triangle - the piece names the picture (`retexture`). The runtime rebuilds each from the player's own ARCH3D
//   (world/arenaModel.js) and gets these triangles back exactly. A triangle whose uv Kamer moved is his, and stays
//   in the mesh.
// - `Arena/ARENADAG.RMB.json` - the port's own block, built from the mod's DFARENA.RMB: its 118 classic props, the
//   864102 placement, its 29 light flats, its ground and its automap, and no building. DFARENA is a re-saved
//   ZLNDFLAT and carries that block's leftovers (its name and index, BlockPositions, OtherNames, BlockDataSizes, the
//   header counts) - none of it is written: blockFromJson derives the counts and positions, and the name is the
//   port's.
// - `Arena/undercroft.json` - Kamer's 32-block dungeon off the mod's `locationnew-*-17.json`, as the arena's
//   undercroft (world/arenaCity.js): the dungeon's blocks and its location id. The file is not strict JSON - a
//   trailing comma closes its exterior's block list - and is read leniently (the one comma before a `]` or `}`). His
//   exterior (DFARENA + WYRSAA44, two map pixels north of the city) is not carried: the arena stands IN the city.
//
// NOTHING ELSE. The bundle's two textures (`0-0`, `4-0`) are Daggerfall's terrain water and TEXTURE.002 record 4
// saved through DXT1 (bible/11-Multiplayer/Arena.md "What the mod is") - game data - and RuntimeMaterials replaces
// both at Awake, so DFU never shows them either: the tool REFUSES to write any texture, and its 23 materials are
// editor placeholders. The output is a function of the bundle and the player's ARCH3D.BSA and TEXTURE files alone.
//
// `--scan` searches every ARCH3D record of twelve vertices or more for a copy (about 40 s); without it the search
// runs over PIECE_MODELS, the records the scan finds - and the scan says if it ever finds one PIECE_MODELS lacks.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isMain } from './lib/isMain.mjs';
import { openScene, bundleContainer, decodeMesh, UCLASS } from './lib/unityScene.mjs';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { ARENA_MODEL_ID, PIECE_TURNS, pieceTransform } from '../src/world/arenaModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLASS_TEXT_ASSET = 49;

/** The bundle's container paths the tool reads. */
export const BUNDLE_PATHS = Object.freeze({
  manifest: 'assets/game/mods/daggerfallarena/daggerfallarena.dfmod.json',
  prefab: 'assets/game/mods/daggerfallarena/models/864102.prefab',
  block: 'assets/game/mods/daggerfallarena/worlddata/dfarena.rmb.json',
  location: 'assets/game/mods/daggerfallarena/worlddata/locationnew-daggerfall_arenaofdaggerfall-17.json',
});
/** The ARCH3D records `--scan` finds copied into the mesh (2026-10-02): Daggerfall's dungeon corridors and rooms. */
export const PIECE_MODELS = Object.freeze([62009, 62109, 62209, 63000, 63001, 63003, 63004, 63005, 63007, 63024, 63028, 63035, 63100, 63101,
  63103, 63104, 63105, 63107, 63124, 63128, 63135, 63200, 63201, 63203, 63204, 63205, 63207, 63224, 63228, 63235, 72006, 72011, 72012]);
/** How near two corners must be to be one (metres), and two uvs (texture repeats). */
export const POS_TOLERANCE = 0.005;
export const UV_TOLERANCE = 0.02;
/** The smallest record the search compares: a smaller one (a lone quad) matches anything flat. */
export const PIECE_MIN_VERTICES = 12;

/** JSON with each top-level value on its own lines and each row of an array of objects on one line - a file a reader can diff. */
export function jsonRows(obj) {
  const rows = Object.entries(obj).map(([k, v]) => {
    const body = Array.isArray(v) && v.every((x) => x && typeof x === 'object')
      ? `[\n${v.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n ]`
      : JSON.stringify(v);
    return ` ${JSON.stringify(k)}: ${body}`;
  });
  return `{\n${rows.join(',\n')}\n}\n`;
}

/** The bundle's TextAsset bytes by container path. */
function textAsset(scene, cont, path) {
  const ptr = cont.get(path);
  const t = ptr ? scene.get(ptr) : null;
  if (!t || t.classId !== CLASS_TEXT_ASSET) throw new Error(`the bundle has no text asset ${path}`);
  const s = t.v.m_Script;
  return typeof s === 'string' ? new Uint8Array(Buffer.from(s, 'utf8')) : new Uint8Array(s);
}
/** The mod's location file is read as DFU's FullSerializer reads it: a comma before a closing bracket is no element. */
export const lenientJson = (text) => JSON.parse(text.replace(/,(\s*[\]}])/g, '$1'));

/** The classic texture sizes (dfMeshToModel's divisor) out of the player's ARENA2, each archive read once. */
function textureSizes(arena2) {
  const files = new Map();
  return (archive, record) => {
    if (!files.has(archive)) {
      const name = TextureFile.indexToFileName(archive);
      const t = new TextureFile();
      if (!t.load(new Uint8Array(readFileSync(join(arena2, name))), name)) throw new Error(`${name} did not load`);
      files.set(archive, t);
    }
    const t = files.get(archive);
    return { width: t.getWidth(record), height: t.getHeight(record) };
  };
}

const q = (x) => Math.round(x / POS_TOLERANCE);
const posKey = (x, y, z) => `${q(x)},${q(y)},${q(z)}`;

/**
 * The search: every placement of a classic model whose every corner is a corner of the mesh, under a mirror and a
 * quarter turn (PIECE_TURNS). Answers [{ model, turn, at, classic }], `classic` the model as dfMeshToModel mints it.
 */
function findPlacements(points, pointSet, arch, size, ids, report) {
  const found = [];
  for (const id of ids) {
    const index = arch.getRecordIndex(id);
    if (index < 0) throw new Error(`ARCH3D has no record ${id}`);
    const classic = dfMeshToModel(arch.getMesh(index), size);
    const P = classic.positions;
    const verts = [];
    const seen = new Set();
    for (let i = 0; i < P.length; i += 3) { const k = posKey(P[i], P[i + 1], P[i + 2]); if (!seen.has(k)) { seen.add(k); verts.push([P[i], P[i + 1], P[i + 2]]); } }
    if (verts.length < PIECE_MIN_VERTICES) continue;
    for (let turn = 0; turn < PIECE_TURNS; turn++) {
      const T = verts.map((v) => pieceTransform(v, turn));
      const a = T[0], b = T[Math.floor(T.length / 3)], c = T[Math.floor((2 * T.length) / 3)];
      for (const p of points) {
        const t = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
        if (!pointSet.has(posKey(b[0] + t[0], b[1] + t[1], b[2] + t[2])) || !pointSet.has(posKey(c[0] + t[0], c[1] + t[1], c[2] + t[2]))) continue;
        if (!T.every((v) => pointSet.has(posKey(v[0] + t[0], v[1] + t[1], v[2] + t[2])))) continue;
        found.push({ model: id, turn, at: t.map((x) => Math.round(x * 1e4) / 1e4), classic });
      }
    }
  }
  report?.push(`search: ${found.length} placements of ${new Set(found.map((f) => f.model)).size} models`);
  return found;
}

/**
 * The bundle as the port's files, and a report.
 * @param {Uint8Array} bundleBytes the shipped `daggerfall arena.dfmod`
 * @param {string} arena2 the player's ARENA2 folder (ARCH3D.BSA and the TEXTURE files)
 * @param {{ scan?: boolean }} [opts]
 */
export function daggerfallArenaAssets(bundleBytes, arena2, { scan = false } = {}) {
  const scene = openScene(bundleBytes);
  const cont = bundleContainer(scene);
  const out = {};
  const report = [];

  // ---- refused: every picture the bundle holds is Daggerfall's (bible/11-Multiplayer/Arena.md "What the mod is") ----
  for (const t of scene.ofClass(UCLASS.Texture2D)) report.push(`texture ${t.v.m_Name} (${t.v.m_Width}x${t.v.m_Height}): Daggerfall's own through DXT1 - not written`);

  // ---- the manifest, verbatim ----
  out['daggerfallarena.dfmod.json'] = textAsset(scene, cont, BUNDLE_PATHS.manifest);

  // ---- the prefab: one node, its mesh, its RuntimeMaterials, its collider ----
  const goPtr = cont.get(BUNDLE_PATHS.prefab);
  if (!goPtr) throw new Error('the bundle has no prefab 864102');
  const go = scene.get(goPtr).v;
  const comps = go.m_Component.map((c) => scene.get(c.component));
  const tr = comps.find((c) => c.classId === UCLASS.Transform).v;
  const ident = tr.m_LocalPosition.x === 0 && tr.m_LocalPosition.y === 0 && tr.m_LocalPosition.z === 0
    && tr.m_LocalRotation.x === 0 && tr.m_LocalRotation.y === 0 && tr.m_LocalRotation.z === 0 && tr.m_LocalRotation.w === 1
    && tr.m_LocalScale.x === 1 && tr.m_LocalScale.y === 1 && tr.m_LocalScale.z === 1 && tr.m_Children.length === 0;
  if (!ident) throw new Error('864102: the prefab root is not an identity transform with no children - the mesh would not be its space');
  const filter = comps.find((c) => c.classId === UCLASS.MeshFilter).v;
  const collider = comps.find((c) => c.classId === UCLASS.MeshCollider)?.v ?? null;
  const rm = comps.find((c) => c.classId === UCLASS.MonoBehaviour)?.v ?? null;
  const renderer = comps.find((c) => c.classId === UCLASS.MeshRenderer).v;
  const meshObj = scene.get(filter.m_Mesh);
  if (!rm || !Array.isArray(rm.Materials)) throw new Error('864102: no RuntimeMaterials on the prefab');
  const mesh = decodeMesh(meshObj.v, (p, o, s) => scene.resource(p, o, s));
  if (mesh.submeshes.length !== renderer.m_Materials.length) throw new Error(`864102: ${mesh.submeshes.length} submeshes, ${renderer.m_Materials.length} materials`);
  const slots = mesh.submeshes.map((_, i) => {
    const e = rm.Materials.find((m) => m.Index === i);
    if (!e) throw new Error(`864102: RuntimeMaterials names no texture for slot ${i}`);
    if (e.ApplyClimate) throw new Error(`864102: slot ${i} applies climate - the port's model is climate-free`);
    return { archive: e.Archive, record: e.Record, material: scene.get(renderer.m_Materials[i])?.v?.m_Name ?? '' };
  });
  if (rm.UseDungeonTextureTable) throw new Error('864102: RuntimeMaterials uses the dungeon texture table');
  const colliderOut = collider ? {
    mesh: scene.get(collider.m_Mesh)?.v?.m_Name ?? null, sameAsDrawn: scene.get(collider.m_Mesh)?.pathId === meshObj.pathId,
    convex: !!collider.m_Convex, isTrigger: !!collider.m_IsTrigger, enabled: !!collider.m_Enabled, cookingOptions: collider.m_CookingOptions,
  } : null;
  if (!colliderOut?.sameAsDrawn) throw new Error('864102: the collider is not the drawn mesh');

  const P = mesh.channels.position.data, N = mesh.channels.normal.data, U = mesh.channels.uv0.data;
  const nDim = mesh.channels.normal.dim, uDim = mesh.channels.uv0.dim;
  // the mesh's triangles, each with its slot's picture
  const tris = [];
  mesh.submeshes.forEach((sm, slot) => {
    for (let j = sm.start; j < sm.start + sm.count; j += 3) {
      const v = [0, 1, 2].map((o) => mesh.indices[j + o] + sm.baseVertex);
      tris.push({ slot, v, keys: v.map((i) => posKey(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])), copy: null });
    }
  });
  const byCorners = new Map();
  for (const [i, t] of tris.entries()) {
    const k = [...t.keys].sort().join('|');
    byCorners.set(k, [...(byCorners.get(k) ?? []), i]);
  }
  const pointSet = new Set();
  const points = [];
  for (let i = 0; i < P.length; i += 3) { const k = posKey(P[i], P[i + 1], P[i + 2]); if (!pointSet.has(k)) { pointSet.add(k); points.push([P[i], P[i + 1], P[i + 2]]); } }

  // ---- the copies of Daggerfall's own models ----
  const arch = new Arch3dFile();
  if (!arch.load(new Uint8Array(readFileSync(join(arena2, 'ARCH3D.BSA'))))) throw new Error('ARCH3D.BSA did not load');
  const size = textureSizes(arena2);
  const ids = scan ? Array.from({ length: arch.count }, (_, r) => arch.getRecordId(r)) : PIECE_MODELS;
  const placements = findPlacements(points, pointSet, arch, size, ids, report);
  if (scan) {
    const extra = [...new Set(placements.map((p) => p.model))].filter((id) => !PIECE_MODELS.includes(id));
    report.push(extra.length ? `scan: models PIECE_MODELS lacks: ${extra.join(', ')}` : 'scan: PIECE_MODELS is complete');
  }
  // every classic triangle of every placement against the mesh's: exact (corners, uvs, winding, picture), or the
  // same triangle under another of Daggerfall's pictures
  const matchOf = (pl) => {
    const { classic, turn, at } = pl;
    const out2 = [];
    for (const sm of classic.subMeshes) {
      for (let j = sm.startIndex, tri = sm.startIndex / 3; j < sm.startIndex + sm.primitiveCount * 3; j += 3, tri++) {
        const cv = [0, 1, 2].map((o) => classic.indices[j + o]);
        const w = cv.map((i) => { const p = pieceTransform([classic.positions[i * 3], classic.positions[i * 3 + 1], classic.positions[i * 3 + 2]], turn); return [p[0] + at[0], p[1] + at[1], p[2] + at[2]]; });
        const keys = w.map((p) => posKey(p[0], p[1], p[2]));
        for (const ti of byCorners.get([...keys].sort().join('|')) ?? []) {
          const t = tris[ti];
          const order = keys.map((k) => t.keys.indexOf(k));
          if (order.some((o) => o < 0)) continue;
          // a mirrored piece turns every triangle inside out, so the rebuild reverses it - and so must the mesh's
          const forward = (order[1] - order[0] + 3) % 3 === 1;
          if (forward !== (turn < 4)) continue;
          const uvOk = cv.every((ci, c) => {
            const kv = t.v[order[c]];
            return Math.abs(U[kv * uDim] - classic.uvs[ci * 2]) <= UV_TOLERANCE && Math.abs(U[kv * uDim + 1] - classic.uvs[ci * 2 + 1]) <= UV_TOLERANCE;
          });
          if (!uvOk) continue;
          const same = slots[t.slot].archive === sm.textureArchive && slots[t.slot].record === sm.textureRecord;
          out2.push({ tri, ti, same });
        }
      }
    }
    return out2;
  };
  // one order whatever order the search met them in: the placement that copies the most triangles with their own
  // pictures first (the fewest pieces), then by model, turn and place
  const at3 = (a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1] || a.at[2] - b.at[2];
  const matches = placements.map((pl) => ({ pl, m: matchOf(pl) }))
    .map((x) => ({ ...x, exact: x.m.filter((c) => c.same).length }))
    .sort((a, b) => b.exact - a.exact || a.pl.model - b.pl.model || a.pl.turn - b.pl.turn || at3(a.pl, b.pl));
  // claimed in two passes - the triangles a placement copies with their own picture first, then those Kamer gave
  // another - each mesh triangle and each placement's triangle once, the placements in model order
  const claimed = new Map();   // mesh triangle -> { p, tri, same }
  const usedTri = new Set();   // `${p}:${tri}`
  for (const pass of [true, false]) {
    matches.forEach(({ m }, p) => {
      for (const { tri, ti, same } of m) {
        if (same !== pass || claimed.has(ti) || usedTri.has(`${p}:${tri}`)) continue;
        claimed.set(ti, { p, tri, same });
        usedTri.add(`${p}:${tri}`);
      }
    });
  }
  const pieces = [];
  matches.forEach(({ pl }, p) => {
    const mine = [...claimed.entries()].filter(([, c]) => c.p === p).sort((a, b) => a[1].tri - b[1].tri);
    if (!mine.length) return;
    const total = pl.classic.indices.length / 3;
    const retexture = {};
    for (const [ti, c] of mine) if (!c.same) retexture[c.tri] = [slots[tris[ti].slot].archive, slots[tris[ti].slot].record];
    pieces.push({
      model: pl.model, turn: pl.turn, at: pl.at,
      keep: mine.length === total ? 'all' : mine.map(([, c]) => c.tri),
      ...(Object.keys(retexture).length ? { retexture } : {}),
    });
    for (const [ti] of mine) tris[ti].copy = pieces.length - 1;
  });
  const copied = tris.filter((t) => t.copy != null).length;
  const retextured = pieces.reduce((a, pc) => a + Object.keys(pc.retexture ?? {}).length, 0);
  report.push(`pieces: ${pieces.length} placements of ${new Set(pieces.map((pc) => pc.model)).size} models carry ${copied} of ${tris.length} triangles (${retextured} under another picture) - left out of the mesh`);

  // ---- Kamer's own triangles, compacted ----
  const own = tris.filter((t) => t.copy == null);
  const remap = new Map();
  const order = [];
  const submeshes = [];
  const indices = [];
  for (let slot = 0; slot < slots.length; slot++) {
    const start = indices.length;
    for (const t of own) {
      if (t.slot !== slot) continue;
      for (const v of t.v) {
        if (!remap.has(v)) { remap.set(v, order.length); order.push(v); }
        indices.push(remap.get(v));
      }
    }
    submeshes.push({ slot, material: slots[slot].material, archive: slots[slot].archive, record: slots[slot].record, start, count: indices.length - start });
  }
  if (order.length > 0xffff) throw new Error(`${order.length} vertices - past a 16-bit index`);
  const nv = order.length;
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2);
  order.forEach((v, i) => {
    for (let k = 0; k < 3; k++) { positions[i * 3 + k] = P[v * 3 + k]; normals[i * 3 + k] = N[v * nDim + k]; }
    uvs[i * 2] = U[v * uDim]; uvs[i * 2 + 1] = U[v * uDim + 1];
  });
  const idx = Uint16Array.from(indices);
  const parts = [positions, normals, uvs, idx];
  const offsets = [];
  let total = 0;
  for (const a of parts) { offsets.push(total); total += a.byteLength; total = (total + 3) & ~3; }
  const bin = new Uint8Array(total);
  parts.forEach((a, i) => bin.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), offsets[i]));
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { bounds.min[k] = Math.min(bounds.min[k], P[i + k]); bounds.max[k] = Math.max(bounds.max[k], P[i + k]); }
  out['Models/864102.bin'] = bin;
  const modelIndex = {
    model: ARENA_MODEL_ID, mesh: mesh.name,
    frame: 'the prefab root\'s - Unity\'s, so the port\'s model space: metres, +Y up, left-handed, Unity\'s winding (front faces clockwise seen from outside), uv0 as DFU\'s MeshReader mints it (V negative, REPEAT)',
    source: { vertices: mesh.vertexCount, triangles: tris.length, submeshes: mesh.submeshes.length, aabb: mesh.aabb, bounds },
    collider: colliderOut,
    vertexCount: nv,
    attributes: {
      position: { offset: offsets[0], type: 'f32', dim: 3 }, normal: { offset: offsets[1], type: 'f32', dim: 3 },
      uv0: { offset: offsets[2], type: 'f32', dim: 2 }, indices: { offset: offsets[3], type: 'u16', count: idx.length },
    },
    submeshes,
    pieces,
  };
  out['Models/864102.json'] = jsonRows(modelIndex);
  report.push(`mesh: ${tris.length - copied} of ${tris.length} triangles are Kamer's, ${nv} vertices, ${bin.length} bytes`);

  // ---- the block: DFARENA's props, lights, ground and automap, under the port's name ----
  const dfarena = JSON.parse(Buffer.from(textAsset(scene, cont, BUNDLE_PATHS.block)).toString('utf8'));
  out['Arena/ARENADAG.RMB.json'] = arenaBlockJson(dfarena, report);

  // ---- the undercroft: Kamer's dungeon ----
  const loc = lenientJson(Buffer.from(textAsset(scene, cont, BUNDLE_PATHS.location)).toString('utf8'));
  out['Arena/undercroft.json'] = undercroftJson(loc, report);

  out['daggerfall-arena.files.json'] = `${JSON.stringify({
    ModTitle: 'Daggerfall Arena', ModVersion: '1.0', ModAuthor: 'Kamer',
    Bundle: 'daggerfall arena.dfmod', BundleSha256: createHash('sha256').update(bundleBytes).digest('hex'),
    Note: 'Every file tools/daggerfallArenaExtract.mjs writes - generated, not written by hand. No texture is among them: the bundle\'s two are Daggerfall\'s own (see README.md).',
    Files: Object.keys(out).filter((p) => p !== 'daggerfall-arena.files.json').sort(),
  }, null, 2)}\n`;
  return { out, report };
}

/** The port's ARENADAG.RMB out of DFARENA.RMB: what Kamer placed, and no leftover of the block he saved over. */
export function arenaBlockJson(dfarena, report = null) {
  const rmb = dfarena.RmbBlock;
  const fh = rmb.FldHeader;
  if ((rmb.SubRecords ?? []).length || (fh.BuildingDataList ?? []).length) throw new Error('DFARENA.RMB stands buildings - the arena block stands none');
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
  const block = {
    Name: 'ARENADAG.RMB', Type: 'Rmb',
    RmbBlock: {
      FldHeader: {
        BuildingDataList: [],
        GroundData: { Header: fh.GroundData.Header, GroundTiles: fh.GroundData.GroundTiles, GroundScenery: fh.GroundData.GroundScenery },
        AutoMapData: fh.AutoMapData,
        Name: 'ARENADAG.RMB',
      },
      SubRecords: [],
      Misc3dObjectRecords: rmb.Misc3dObjectRecords.map((m) => pick(m, ['ModelId', 'ModelIdNum', 'ObjectType', 'XPos', 'YPos', 'ZPos', 'XScale', 'YScale', 'ZScale', 'XRotation', 'YRotation', 'ZRotation'])),
      MiscFlatObjectRecords: rmb.MiscFlatObjectRecords.map((f) => pick(f, ['Position', 'XPos', 'YPos', 'ZPos', 'TextureArchive', 'TextureRecord', 'FactionID', 'Flags'])),
    },
  };
  report?.push(`block: ${block.RmbBlock.Misc3dObjectRecords.length} models (${block.RmbBlock.Misc3dObjectRecords.filter((m) => m.ModelIdNum === ARENA_MODEL_ID).length} the colosseum), ${block.RmbBlock.MiscFlatObjectRecords.length} flats; DFARENA's ZLNDFLAT leftovers (${dfarena.Name}, index ${dfarena.Index}, ${(fh.OtherNames ?? []).filter(Boolean).length} OtherNames) dropped`);
  // one record a line: a block a reader can diff
  const lines = (arr) => `[\n${arr.map((x) => `   ${JSON.stringify(x)}`).join(',\n')}\n  ]`;
  const fld = block.RmbBlock.FldHeader;
  return `{\n "Name": "ARENADAG.RMB",\n "Type": "Rmb",\n "RmbBlock": {\n  "FldHeader": {\n   "BuildingDataList": [],\n   "GroundData": {\n    "Header": ${JSON.stringify(fld.GroundData.Header)},\n    "GroundTiles": ${JSON.stringify(fld.GroundData.GroundTiles)},\n    "GroundScenery": ${JSON.stringify(fld.GroundData.GroundScenery)}\n   },\n   "AutoMapData": ${JSON.stringify(fld.AutoMapData)},\n   "Name": "ARENADAG.RMB"\n  },\n  "SubRecords": [],\n  "Misc3dObjectRecords": ${lines(block.RmbBlock.Misc3dObjectRecords)},\n  "MiscFlatObjectRecords": ${lines(block.RmbBlock.MiscFlatObjectRecords)}\n }\n}\n`;
}

/** The undercroft out of the mod's location: its dungeon and the location id it is known by. */
export function undercroftJson(loc, report = null) {
  const d = loc.Dungeon;
  if (!d?.Blocks?.length) throw new Error('the mod\'s location has no dungeon');
  const header = d.RecordElement?.Header ?? {};
  const out = {
    Name: loc.Name, LocationId: header.LocationId, DungeonType: loc.MapTableData?.DungeonType, Unknown2: header.Unknown2 ?? 0,
    Blocks: d.Blocks.map((b) => ({ X: b.X, Z: b.Z, IsStartingBlock: !!b.IsStartingBlock, BlockName: b.BlockName, WaterLevel: b.WaterLevel ?? 0, CastleBlock: !!b.CastleBlock })),
  };
  if (out.Blocks.filter((b) => b.IsStartingBlock).length !== 1) throw new Error('the undercroft has not one starting block');
  report?.push(`undercroft: ${out.Blocks.length} blocks, start ${out.Blocks.find((b) => b.IsStartingBlock).BlockName}, location id ${out.LocationId}`);
  return `{\n "Name": ${JSON.stringify(out.Name)},\n "LocationId": ${out.LocationId},\n "DungeonType": ${JSON.stringify(out.DungeonType)},\n "Unknown2": ${out.Unknown2},\n "Blocks": [\n${out.Blocks.map((b) => `  ${JSON.stringify(b)}`).join(',\n')}\n ]\n}\n`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--arena2');
  const arena2 = at >= 0 ? args.splice(at, 2)[1] : process.env.ARENA2_PATH;
  const si = args.indexOf('--scan');
  const scan = si >= 0;
  if (scan) args.splice(si, 1);
  const [bundlePath, outDir = join(ROOT, 'vendor/daggerfall-arena')] = args;
  if (!bundlePath || !arena2) {
    console.error('usage: node tools/daggerfallArenaExtract.mjs "<daggerfall arena.dfmod>" [outDir] --arena2 <ARENA2> [--scan]');
    process.exit(2);
  }
  const { out, report } = daggerfallArenaAssets(new Uint8Array(readFileSync(bundlePath)), arena2, { scan });
  for (const line of report) console.log(`  ${line}`);
  for (const [path, body] of Object.entries(out)) {
    if (/\.(png|tga|dds|jpe?g|bmp)$/i.test(path)) throw new Error(`${path}: the tool writes no picture`);
    const full = join(outDir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  console.log(`wrote ${Object.keys(out).length} files to ${outDir}`);
}
