// SIB1 / ROAD-H H3: WHICH PIXELS A SEASON RE-SKIN REBUILDS.
//
// Seasons of the Iliac Bay answers a season install with
// `RefreshLoadedNatureBatches`: it walks every DaggerfallBillboardBatch
// in the scene (`FindObjectsOfType<DaggerfallBillboardBatch>()`, the
// DLL's il.txt 0x08a4) and calls `SetMaterial(archive, force)` on the
// ones whose archive it has ever managed. ONE filter is the mod's, and
// it is the ARCHIVE: a batch on an archive the mod never took over is
// never even asked. The walk itself re-applies every batch it does ask,
// the just-built included, and it must - `SetMaterial`'s early return
// tests `archive == currentArchive` (DaggerfallBillboardBatch.cs:
// 283-284), and `currentArchive` is the archive INDEX
// (DaggerfallBillboardBatch.cs:73 `int currentArchive = -1;`, :360
// `currentArchive = archive;`), which does NOT change when the mod
// swaps a seasonal atlas in under that same index. An unforced walk
// would therefore return at :283-284 for every batch it asks and
// re-skin nothing at all; the refresh is forced.
//
// This host bakes its batches into GL uploads, so its answer to the
// refresh is the destroy-and-requeue sweep the winter flip already runs
// (translation 1). A re-apply is free in DFU and a teardown here, so
// this port adds a filter the reference has no reason to want: the
// install `generation` a pixel was built under, so a pixel already
// wearing the installed atlas is not torn down to be handed the atlas
// it already has (translation 1, AUDIT 61). AUDIT 62 F4 gave the sweep
// DFU's archive filter but left it ALL-OR-NOTHING: one pixel anywhere
// in the grid standing on an older install with a managed batch tore
// down and cold-rebuilt every pixel, where the reference re-applies
// only the batches its archive filter admits. This collector is the
// per-KEY form. The seam marks the pixel keys that qualify; the driver
// takes them and rebuilds those alone.
//
// The CLASSIC winter flip is not this and never was: `refreshSeason`
// going from Summer to Winter changes the ground atlas, the tile set
// and the climate swaps of EVERY pixel (the ROAD A1 season law, older
// than this mod - DaggerfallLocation.Update's lastSeason test), so it
// still marks the whole grid. Two different laws, one sweep, and the
// collector is what keeps them apart.

/**
 * The pending re-skin: a set of pixel keys, plus the whole-grid flag
 * the classic season flip raises.
 */
export function createSeasonReskin() {
  const keys = new Set();
  let all = false;
  return {
    /** One pixel key qualifies (a build that published across an
     *  install asks for its own re-skin this way). */
    mark(key) { keys.add(key); },
    /** The refresh's filter over a built grid: a pixel on an OLDER
     *  install (`generation`) that ALSO carries a batch on an archive
     *  the mod has ever managed (`manages`, vanillaAtlasByArchive).
     *  The ARCHIVE half is DFU's - it is the set the mod's walk
     *  filters by (AUDIT 62 F4). The GENERATION half is this port's
     *  translation, not a law read off `SetMaterial`: DFU's forced
     *  walk re-applies the just-built batches too, which is free
     *  there and a teardown here (translation 1, AUDIT 61). */
    markStale(seasons, built) {
      for (const [key, p] of built) {
        if (p._seasonsGen !== seasons.generation && p.batches.some((b) => seasons.manages(b.archive))) keys.add(key);
      }
    },
    /** The classic winter flip: every key, as before. */
    markAll() { all = true; },
    /** Is there anything to re-skin at all? */
    get pending() { return all || keys.size > 0; },
    /** The teleport's quiet path: a real unload rebuilds everything
     *  anyway, so the frame's own re-skin has nothing left to re-skin. */
    clear() { all = false; keys.clear(); },
    /** The keys to rebuild now, and the pending state spent. A marked
     *  key that has since left `built` (streamed out, or torn down by a
     *  teleport) is dropped: there is no batch there to re-apply, which
     *  is what `FindObjectsOfType` not returning it means. */
    take(built) {
      const out = all ? [...built.keys()] : [...keys].filter((k) => built.has(k));
      all = false;
      keys.clear();
      return out;
    },
  };
}
