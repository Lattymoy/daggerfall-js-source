// @ts-check
// WG2 THE ARTIST'S PIPELINE (bible/03-World/World-2-Canon.md, "Prefabs"): a prefab record and, for an artist's glTF,
// the file's own numbers - its triangles, its materials, its bounds and its textures' sides - read off its JSON and
// held to the budgets (data/prefabs.json `budgets`), with its licence and provenance required. A model of the player's
// own ARENA2 (`arch3d`) is named by id and never shipped (Port-Doctrine).
import { PREFAB_BUDGETS } from '../settle/settlementGen.js';
import { ROLES } from '../settle/buildingRecord.js';

/** A prefab record's problems, as words. @param {any} p */
export function prefabProblems(p) {
  const out = [];
  if (!/^[a-z0-9-]+$/.test(p?.id ?? '')) out.push('id');
  if (!ROLES[p?.role]) out.push('role');
  if (!(Array.isArray(p?.footprint) && p.footprint.length === 2 && p.footprint.every((v) => v > 0 && v <= PREFAB_BUDGETS.footprintMax))) out.push('footprint');
  if (!Array.isArray(p?.styles) || !p.styles.length) out.push('styles');
  const kind = p?.source?.kind;
  if (!['massing', 'arch3d', 'gltf'].includes(kind)) out.push('source');
  if (kind === 'arch3d' && !Number.isSafeInteger(p.source.id)) out.push('arch3d id');
  if (kind === 'gltf' && !/^art\/[a-z0-9/_-]+\.gl(tf|b)$/.test(p.source.file ?? '')) out.push('gltf file (public/art/...)');
  if (typeof p?.licence !== 'string' || p.licence.length < 4) out.push('licence');
  if (!Array.isArray(p?.doors) || !p.doors.every((d) => Array.isArray(d) && d.length === 3 && d.every(Number.isFinite))) out.push('doors');
  return out;
}

/** A glTF's numbers, read off its JSON: triangles (each triangle-list primitive's index or vertex count / 3), materials,
 *  the bounds of its POSITION accessors (metres) and its images' declared sides. @param {any} gltf */
export function gltfNumbers(gltf) {
  let triangles = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of gltf.meshes ?? []) for (const prim of mesh.primitives ?? []) {
    if ((prim.mode ?? 4) !== 4) continue;
    const pos = gltf.accessors?.[prim.attributes?.POSITION];
    const count = prim.indices !== undefined ? gltf.accessors?.[prim.indices]?.count ?? 0 : pos?.count ?? 0;
    triangles += Math.floor(count / 3);
    if (pos?.min && pos?.max) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos.min[a]); max[a] = Math.max(max[a], pos.max[a]); }
  }
  return { triangles, materials: (gltf.materials ?? []).length, size: max.map((v, a) => v - min[a]), textureSide: Math.max(0, ...(gltf.images ?? []).map((im) => im.extras?.side ?? 0)) };
}

/** A glTF's problems against the budgets and its prefab's footprint (its ground no wider than the prefab says). @param {any} gltf @param {any} prefab */
export function gltfProblems(gltf, prefab) {
  const n = gltfNumbers(gltf), out = [];
  if (n.triangles > PREFAB_BUDGETS.triangles) out.push(`${n.triangles} triangles, over ${PREFAB_BUDGETS.triangles}`);
  if (n.materials > PREFAB_BUDGETS.materials) out.push(`${n.materials} materials, over ${PREFAB_BUDGETS.materials}`);
  if (n.textureSide > PREFAB_BUDGETS.textureSide) out.push(`a ${n.textureSide} texture, over ${PREFAB_BUDGETS.textureSide}`);
  if (!n.size.every(Number.isFinite)) out.push('no bounds');
  else if (n.size[0] > prefab.footprint[0] + 0.5 || n.size[2] > prefab.footprint[1] + 0.5) out.push(`its ground ${n.size[0].toFixed(1)} x ${n.size[2].toFixed(1)} m is wider than the prefab's`);
  if (!gltf.asset?.extras?.licence) out.push('no licence in asset.extras');
  return out;
}
