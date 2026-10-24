// THE DRAW-TIME TEXTURE REMAP, in one place (WM3).
//
// Four hosts remap a mesh's textures without touching its UVs: the
// exterior location scene, the streaming world, interiors (all three
// through ClimateSwaps.ApplyClimate) and dungeons (through the RDB's own
// per-dungeon texture table). The shape is identical in all four - it is
// DFU's MaterialReader.ChangeClimate / SetDungeonTextures pattern:
// pixels come from the SWAPPED archive, UVs stay the original's, so the
// swap is a table `renderer.drawMesh` consults and never a re-upload of
// geometry.
//
// It lived as four copies until WM3 needed a fifth for the windmill and
// the doctrine's ONE DFU MEMBER, ONE EXPORT said no. The remap FUNCTION
// still belongs to each caller - the climate hosts pass ApplyClimate,
// the dungeon passes its table - because that is the part that actually
// differs. Everything below it is the shared law.
//
// THE PRUNE IS LOAD-BEARING (R1 audit, 27 corpus pairs): a swapped
// archive can be SHORT of the record the original had, and uploading a
// record past the end draws garbage. Such a pair is left unmapped, so
// the mesh keeps its original texture rather than a wrong one.

/** MENU-ORDER (AUDIT MENU-ORDER C3): THE LAW A TABLE WAS BUILT IN, by name - the climate and season its swaps were made
 *  for - so a picture drawn through one table is known again through another built the same way (a house entered again
 *  builds its table anew, and the decorator's model pictures were drawn again each visit, each copy kept). Kept beside
 *  the table, never in it: drawMesh reads its every entry. A table no builder named has none (`remapLawOf` null). */
const remapLaws = new WeakMap();
/** @param {Map<string,string>} texRemap @param {string} law @returns {Map<string,string>} */
export function markRemapLaw(texRemap, law) {
  if (texRemap && typeof texRemap === 'object') remapLaws.set(texRemap, String(law));
  return texRemap;
}
/** @param {any} texRemap @returns {string|null} */
export function remapLawOf(texRemap) {
  return texRemap && typeof texRemap === 'object' ? remapLaws.get(texRemap) ?? null : null;
}

/** AUDIT PRECIP HOST-7: A TABLE'S RECIPE - every mesh asked of it under a law that can turn (`lawKey`: a climate, whose
 *  season the table is re-skinned in), each once. Kept beside the table, as its law's name is. */
const recipes = new WeakMap();
/** AUDIT PRECIP HOST-7: whether a table was asked anything under a law that can turn - one that never was is the same
 *  table in every season. */
export const remapAsked = (texRemap) => (recipes.get(texRemap)?.size ?? 0) > 0;

/**
 * Fill `texRemap` for one mesh's submeshes.
 *
 * @param {Array<{textureArchive:number, textureRecord:number}>|undefined} subMeshes
 *   The mesh's submeshes. `?? []` guards the VALUE and not the RECEIVER:
 *   a model id an archive lacks arrives here as undefined, which is why
 *   this reads `subMeshes ?? []` and not `subMeshes.length`.
 * @param {Map<string,string>} texRemap - "archive_record" -> "swapped_record".
 * @param {(archive:number, record:number) => number} remapArchive
 *   The caller's law: ApplyClimate bound to a climate/season, or the
 *   dungeon's texture table.
 * @param {{getTexture: (a:number)=>Promise<any>, uploadRecord: (a:number,r:number)=>void}} deps
 * @param {any} [lawKey] AUDIT PRECIP HOST-7: the key of the caller's law (a climate) when the table can be re-skinned
 *   (reskinRemap) - the mesh is kept in the table's recipe under it; null (the default) for a table that never turns.
 */
export async function remapSubMeshes(subMeshes, texRemap, remapArchive, { getTexture, uploadRecord }, lawKey = null) {
  if (lawKey !== null && subMeshes) {   // AUDIT PRECIP HOST-7: the table's recipe - what was asked of it, by whose law
    let recipe = recipes.get(texRemap);
    if (!recipe) recipes.set(texRemap, (recipe = new Map()));
    let asked = recipe.get(lawKey);
    if (!asked) recipe.set(lawKey, (asked = new Set()));
    asked.add(subMeshes);
  }
  for (const sm of subMeshes ?? []) {
    const swapped = remapArchive(sm.textureArchive, sm.textureRecord);
    if (swapped === sm.textureArchive) continue;
    const key = `${sm.textureArchive}_${sm.textureRecord}`;
    if (texRemap.has(key)) continue;
    const t = await getTexture(swapped);
    if (sm.textureRecord >= t.recordCount) continue;
    uploadRecord(swapped, sm.textureRecord, { opaque: true });   // a mesh material: alphaIndex -1 (MaterialReader.cs:352)
    texRemap.set(key, `${swapped}_${sm.textureRecord}`);
  }
}

/**
 * AUDIT PRECIP HOST-7: A TABLE RE-SKINNED - a new table (`law` its name, markRemapLaw's), every mesh its recipe holds asked
 * again under its own key's law now (`lawOf(lawKey)`: the climate's, in the new season), the recipe carried. DFU's
 * ApplyClimateSettings re-reads each standing mesh's materials for the season (DaggerfallLocation.cs:133-148); a NEW table,
 * never the old one written over: what draws through it is cached by its identity (render/renderer.js EV2), and a frame
 * between two of its writes would draw half a season. Handed the table it began (`next`), it asks only what the standing
 * table was asked since (a yard's model, a farm's, while the rest of the re-skin was under way) - until nothing is owed, so
 * a caller that swaps the tables in the same step as this answers leaves no mesh behind.
 * @param {Map<string,string>} texRemap the standing table
 * @param {string} law the new table's name
 * @param {(lawKey: any) => (archive: number, record: number) => number} lawOf
 * @param {{getTexture: (a:number)=>Promise<any>, uploadRecord: (a:number,r:number)=>void}} deps
 * @param {Map<string,string>|null} [next] the table this re-skin began, to bring up to date
 * @returns {Promise<Map<string,string>>}
 */
export async function reskinRemap(texRemap, law, lawOf, deps, next = null) {
  const out = next ?? markRemapLaw(new Map(), law);
  for (let owed = true; owed;) {
    owed = false;
    for (const [lawKey, asked] of recipes.get(texRemap) ?? []) {
      const had = recipes.get(out)?.get(lawKey);
      for (const subMeshes of asked) {
        if (had?.has(subMeshes)) continue;
        owed = true;
        await remapSubMeshes(subMeshes, out, lawOf(lawKey), deps, lawKey);
      }
    }
  }
  return out;
}
