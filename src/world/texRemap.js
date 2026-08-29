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
 */
export async function remapSubMeshes(subMeshes, texRemap, remapArchive, { getTexture, uploadRecord }) {
  for (const sm of subMeshes ?? []) {
    const swapped = remapArchive(sm.textureArchive, sm.textureRecord);
    if (swapped === sm.textureArchive) continue;
    const key = `${sm.textureArchive}_${sm.textureRecord}`;
    if (texRemap.has(key)) continue;
    const t = await getTexture(swapped);
    if (sm.textureRecord >= t.recordCount) continue;
    uploadRecord(swapped, sm.textureRecord);
    texRemap.set(key, `${swapped}_${sm.textureRecord}`);
  }
}
