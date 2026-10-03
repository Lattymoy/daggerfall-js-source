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

const _models = new Map();   // id -> { build, isOn, cached, climateFree, needs, buildSliced }

/** Register a model for `id`: `build(ctx)` answers { positions, normals, uvs, indices, subMeshes, doors }.
 *  ARENA1: `climateFree` - DFU's RuntimeMaterials with ApplyClimate off: the hosts never swap its pictures for the
 *  climate or the season (scenes/world.js, scenes/exterior.js); `needs` - the classic models its build reads out of
 *  the player's ARCH3D (`ctx.classicModel(id)`, dfMeshToModel's shape), whose textures the pipeline loads first. */
export function registerCustomModel(id, build, isOn = () => true, { climateFree = false, needs = [], buildSliced = null } = {}) {
  _models.set(Number(id), { build, isOn: typeof isOn === 'function' ? isOn : () => true, cached: null, climateFree: !!climateFree, needs: Object.freeze([...needs].map(Number)), buildSliced: typeof buildSliced === 'function' ? buildSliced : null });
}
/** AUDIT PRE-MERGE 1003 W6: the model registered for `id` (customModelFor's), built a breath at a time where its
 *  registration can (`buildSliced(ctx, breathe)` - the colosseum's seal, world/arenaCity.js) and the caller breathes
 *  (scenes/dataPipeline.js getGpuMesh, handed a streamed pixel's breather by scenes/world.js); else customModelFor's own
 *  build. Built once either way. */
export async function customModelBuilt(id, ctx = null, breathe = null) {
  const m = _models.get(Number(id));
  if (!m || !m.isOn()) return null;
  if (m.cached || !breathe || !m.buildSliced) return customModelFor(id, ctx);
  const built = await m.buildSliced(ctx, breathe);
  return (m.cached ??= built);
}
/** ARENA1: whether a registered model wears its pictures whatever the climate (RuntimeMaterials, ApplyClimate 0). */
export const isClimateFreeModel = (id) => !!_models.get(Number(id))?.climateFree;
/** ARENA1: the texture table a climate-free model is drawn and merged by - empty, so no swap a host made for the
 *  models around it reaches it. Never written. */
export const NO_CLIMATE_REMAP = new Map();
/** ARENA1: the classic models a registered model's build reads, or none. */
export const customModelNeeds = (id) => _models.get(Number(id))?.needs ?? [];
export function unregisterCustomModel(id) { _models.delete(Number(id)); _aliases.delete(Number(id)); }

// WD3 (2026-10-01): A MODEL THAT IS A CLASSIC ONE WITH OTHER PICTURES ON IT. Beautiful Villages' and Beautiful Cities'
// eighteen beds (42069-42086) are Daggerfall's own three beds (41000-41002) under blankets of six colours; the bundle's
// meshes are copies of the ARCH3D records, which the port never carries. An ALIAS names the classic model to read out
// of the player's ARCH3D and the textures to swap on it - `remap`, `"<archive>_<record>"` -> [archive, record] - so the
// geometry is the player's own and only the swap is the port's (world/townStandIns.js).
const _aliases = new Map();   // id -> { model, remap, isOn }
/** Register `id` as classic `model` with its textures swapped (`remap`). */
export function registerModelAlias(id, { model, remap = {} }, isOn = () => true) {
  _aliases.set(Number(id), { model: Number(model), remap: Object.freeze({ ...remap }), isOn: typeof isOn === 'function' ? isOn : () => true });
}
/** The alias registered for `id` while its switch is on - { model, remap } - else null. */
export function customAliasFor(id) {
  const a = _aliases.get(Number(id));
  return a && a.isOn() ? a : null;
}
/** The swap an alias makes on a classic model's sub-meshes (dfMeshToModel's shape): a copy, the classic one untouched. */
export function aliasSubMeshes(subMeshes, remap) {
  return subMeshes.map((sm) => {
    const to = remap?.[`${sm.textureArchive}_${sm.textureRecord}`];
    return to ? { ...sm, textureArchive: to[0], textureRecord: to[1] } : sm;
  });
}
/** The ARCH3D record a model id is measured by - its own, or an alias's classic model (a size, a radius, an icon). */
export const classicModelIdOf = (id) => customAliasFor(id)?.model ?? Number(id);

/** The model registered for `id` while its switch is on, built once; else null. */
export function customModelFor(id, ctx = null) {
  const m = _models.get(Number(id));
  if (!m || !m.isOn()) return null;
  return (m.cached ??= m.build(ctx));
}
export const hasCustomModel = (id) => !!_models.get(Number(id))?.isOn();

/** GetModelData's `false`: a model with nothing in it - no geometry, no doors. */
export function emptyModel() {
  return { positions: new Float32Array(0), normals: new Float32Array(0), uvs: new Float32Array(0), indices: new Uint32Array(0), subMeshes: [], doors: [] };
}
/** Test seam. */
export function _resetCustomModels() { _models.clear(); _aliases.clear(); }
