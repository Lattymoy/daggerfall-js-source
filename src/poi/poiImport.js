// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-4 (2026-10-14) - A MODEL INTO THE STORE: FROM THE FILE A BUILDER CHOSE TO PARTS THE EDITOR PLACES.
//
// Mac: "the ability to import models, texture, UV map" (bible/06-Systems/POI-Editor-Arc.md POI-4). The glTF reader
// (poi/gltfImport.js) reads the file and bakes its parts in the game's frame; this takes them the rest of the way:
//
//   - PREPARED (`prepareImport`): each part's mesh held to the realm's law (poi/poiMesh.js encodePoiMesh) - a part past
//     a limit is refused by its code, not uploaded half-made - and its glTF materials as the document's (poiMaterialOf:
//     the textures still the images' indices). Each image read by its own header (poi/poiImage.js): one the store
//     would refuse is set aside with a warning, and the materials that wore it go plain.
//   - UPLOADED (`uploadImport`): every mesh and every image put once, by its sha256 (poi/poiService.js poiPutAsset - the
//     store answers `existed` for bytes it has, so a model imported twice costs nothing the second time), the
//     materials' image indices turned into the pictures' names, each meta kept for the law's asset check
//     (poiAssetProblems). A refusal stops the import and says which part, in the store's word.
//   - THE ASSET (`{ name, parts, lights }`): what the editor places (scenes/poiEditorHost.js placeAsset) - each part's
//     mesh, its submeshes, its materials and where it stands from the model's origin; the model's point lights where they
//     stand from it (gltfImport.js poiLightOf).
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { encodePoiMesh, poiMeshError } from './poiMesh.js';
import { poiImageMetaOf } from './poiImage.js';
import { poiMaterialOf, poiLightOf } from './gltfImport.js';
import { lawName, newLight } from './poiEdit.js';

/**
 * A baked model as an import: its parts held to the mesh law, their materials the document's, its images read by their
 * headers. `{ name, parts: [{ name, position, bytes, submeshes, vertices, triangles, materials }], lights, images,
 * warnings, refused }` - `refused` the parts past a limit (`{ name, code }`), never uploaded.
 * @param {any} model readGltf's @param {any[]} baked bakeGltf's
 */
export function prepareImport(model, baked) {
  const warnings = [...(model.warnings ?? [])];
  const images = (model.images ?? []).map((im, i) => {
    const meta = poiImageMetaOf(im.bytes);
    if ('error' in meta) { warnings.push({ code: 'image-format', image: i, why: meta.error }); return null; }
    return { index: i, name: im.name, bytes: im.bytes, meta };
  });
  const parts = [], refused = [];
  for (const p of baked) {
    // a part the bake would not build past a limit comes with the law's code already (gltfImport.js bakeGltf)
    const code = p.refused ?? poiMeshError(p.mesh);
    if (code) { refused.push({ name: p.name, code }); continue; }
    const materials = p.materials.map((mi) => {
      const m = poiMaterialOf(model.materials?.[mi]);
      // a picture the store will not take: the material plain (its colour kept)
      if (m.texture !== null && !images[m.texture]) m.texture = null;
      if (m.emissive !== null && !images[m.emissive]) m.emissive = null;
      return m;
    });
    parts.push({
      name: lawName(p.name) || lawName(model.name),   // none: the editor keys it `part`, and the builder names it
      position: [...p.position],
      bytes: encodePoiMesh(p.mesh),
      submeshes: p.mesh.submeshes.length,
      vertices: p.mesh.positions.length / 3,
      triangles: p.mesh.indices.length / 3,
      materials,
    });
  }
  // AUDIT POI G7: the model's point lights come with it - a light written out by this editor as it was
  const lights = (model.lights ?? []).map((l) => poiLightOf(l, newLight()));
  return { name: lawName(model.name), parts, lights, images, warnings, refused };
}

/**
 * Upload a prepared import: every image the parts wear and every mesh, once each, by name. Answers
 * `{ ok: true, asset: { name, parts, lights }, metas }` (metas: sha -> the store's meta, `kind` beside it) or
 * `{ ok: false, error, why?, part? }` - the store's word, and the part it stopped on.
 * @param {ReturnType<typeof prepareImport>} prep
 * @param {(bytes: Uint8Array, kind: 'mesh' | 'texture') => Promise<any>} put poiPutAsset over the session's door
 * @param {(done: number, of: number) => void} [progress]
 */
export async function uploadImport(prep, put, progress = () => {}) {
  const metas = new Map();
  const worn = new Set();
  for (const p of prep.parts) for (const m of p.materials) { if (m.texture !== null) worn.add(m.texture); if (m.emissive !== null) worn.add(m.emissive); }
  const total = worn.size + prep.parts.length;
  let done = 0;
  const shaOfImage = new Map();
  for (const i of worn) {
    const im = prep.images[i];
    const r = await put(im.bytes, 'texture');
    if (!r.ok) return { ok: false, error: r.error, ...(r.why ? { why: r.why } : {}), image: im.name };
    shaOfImage.set(i, r.data.sha);
    metas.set(r.data.sha, { kind: 'texture', ...r.data.meta, bytes: im.bytes.byteLength });   // AUDIT POI S6: its bytes, for the budget
    progress(++done, total);
  }
  const parts = [];
  for (const p of prep.parts) {
    const r = await put(p.bytes, 'mesh');
    if (!r.ok) return { ok: false, error: r.error, ...(r.why ? { why: r.why } : {}), part: p.name };
    metas.set(r.data.sha, { kind: 'mesh', ...r.data.meta, bytes: p.bytes.byteLength });
    parts.push({
      name: p.name, mesh: r.data.sha, submeshes: p.submeshes, t: p.position,
      materials: p.materials.map((m) => ({ ...m, texture: m.texture === null ? null : shaOfImage.get(m.texture), emissive: m.emissive === null ? null : shaOfImage.get(m.emissive) })),
    });
    progress(++done, total);
  }
  return { ok: true, asset: { name: prep.name, parts, lights: structuredClone(prep.lights ?? []) }, metas };
}
