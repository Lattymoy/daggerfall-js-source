// AUTO-EMISSIVE TEXTURES - verbatim TextureReader.emissiveTextures
// (TextureReader.cs:809-1023) with IsEmissive/IsEmissiveArchive
// (:1042-1058). These are the records DFU self-illuminates: a lit
// lantern, a fireplace, a brewing potion, a fire daedra. The material
// law on top of the table is MaterialReader.cs:419-423 (IsEmissive ->
// createEmissionMap) with TextureReader.cs:301-308 ("Just reuse albedo
// map for basic colour emission") and MaterialReader.cs:448-453
// (EmissionColor = Color.white) - so the emission map IS the albedo and
// it wears no tint, which is what separates this from the window table
// in climateSwaps.isExteriorWindow.
//
// COMMENTED-OUT ENTRIES STAY OUT, exactly as in the C#: archive 101
// record 10 (the glass globe), 380/434 record 5 (UI). The two sets are
// disjoint today - no emissive record is also an exterior window - and
// the upload arms are written as the C# writes them (`&& !isWindow`).

/** archive -> the records of that archive which are self-illuminated. */
const EMISSIVE = new Map([
  [87, [0]],                                              // fireplace
  [101, [2, 3, 5, 6, 7, 8, 9, 11, 12]],                   // lights (which are on/lit)
  [190, [3, 4, 5]],
  [200, [7, 8, 9, 10]],
  [202, [2]],                                             // statue
  [208, [2]],                                             // brewing potion
  [210, [0, 1, 2, 3, 4, 5, 6, 8, 9, 11, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29]],
  [253, [10, 17, 18, 19, 22, 41, 48, 49, 50, 51, 52, 75, 77]],
  [273, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]],   // ghost
  [278, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]],   // wraith
  [280, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]],   // frost daedra
  [281, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]],   // fire daedra
  [290, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]],   // fire atronach
  [356, [0, 2, 3]],                                       // Mantellan Crux fire textures
  [375, [0, 1]],                                          // spell missiles
  [376, [0, 1]],
  [377, [0, 1]],
  [378, [0, 1]],
  [379, [0, 1]],
  [380, [3]],                                             // magic decorative effects
  [400, [3, 2]],                                          // frost/fire daedra corpses (table order)
  [405, [2]],                                             // fire atronach corpse
  [434, [3]],
  [473, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]],   // Lysandus
]);

/** TextureReader.cs:38/:303 - the Mantellan Crux fire walls take the
 *  GetFireWallColors32 arm instead of "reuse the albedo", and only when
 *  a reference texture is present; the port has neither, so the table
 *  stays verbatim and the upload arm skips this archive. */
export const FIRE_WALLS_ARCHIVE = 356;

/** Verbatim TextureReader.IsEmissiveArchive. */
export function isEmissiveArchive(archive) {
  return EMISSIVE.has(archive);
}

/** Verbatim TextureReader.IsEmissive. */
export function isEmissive(archive, record) {
  const records = EMISSIVE.get(archive);
  return records ? records.includes(record) : false;
}
