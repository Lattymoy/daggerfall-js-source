// DS1 (2026-09-25): MODELS NO ARCH3D CARRIES - the port's door for them.
//
// DFU asks MeshReplacement.ImportCustomGameobject before it reads a
// model out of ARCH3D.BSA, which is how a mod stands a model Daggerfall
// never had. The port's mill machinery (41601) was the first such model
// and was answered by a special case in the pipeline; Detailed Ships
// names ten more (the pieces it borrows from Daggerfall Expanded Textures,
// which the port stands in itself - world/detStandIns.js), so the door is
// a registry now: a model id, a builder that answers the dfMeshToModel
// shape (metres, Unity's frame, UVs over the named classic textures), and
// the switch it stands behind.
//
// A model id no ARCH3D record and no registration answers is DFU's
// GetModelData returning false: nothing is drawn and no door is taken
// from it (RDBLayout.cs:634-638) - never a thrown scene
// (`emptyModel`).

const _models = new Map();   // id -> { build, isOn, cached }

/** Register a model for `id`: `build()` answers { positions, normals, uvs, indices, subMeshes, doors }. */
export function registerCustomModel(id, build, isOn = () => true) {
  _models.set(Number(id), { build, isOn: typeof isOn === 'function' ? isOn : () => true, cached: null });
}
export function unregisterCustomModel(id) { _models.delete(Number(id)); }

/** The model registered for `id` while its switch is on, built once; else null. */
export function customModelFor(id) {
  const m = _models.get(Number(id));
  if (!m || !m.isOn()) return null;
  return (m.cached ??= m.build());
}
export const hasCustomModel = (id) => !!_models.get(Number(id))?.isOn();

/** GetModelData's `false`: a model with nothing in it - no geometry, no doors. */
export function emptyModel() {
  return { positions: new Float32Array(0), normals: new Float32Array(0), uvs: new Float32Array(0), indices: new Uint32Array(0), subMeshes: [], doors: [] };
}
/** Test seam. */
export function _resetCustomModels() { _models.clear(); }
