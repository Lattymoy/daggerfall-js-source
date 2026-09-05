// SEASONS OF THE ILIAC BAY 1.1 (RosyTheRascal) - SeasonHelper, ported 1:1.
//
// The mod ships one script, SeasonHelper (in `Seasons of the Iliac
// Bay.dll`, 25,600 bytes; the `.cs` is in its manifest and not in the
// bundle), and 372 textures in eleven folders (the manifest's 374
// entries add the script and the manifest itself). What the script DOES,
// read off its IL (method by method, cited by name below):
//
//   Init          - AddComponent<SeasonHelper> on a new GameObject.
//   Awake         - subscribes DaggerfallTerrain.OnInstantiateTerrain,
//                   WorldTime.OnNewMonth, SaveLoadManager.OnLoad,
//                   DaggerfallTravelPopUp.OnPostFastTravel and
//                   StreamingWorld.OnUpdateTerrainsEnd.
//   ApplyCurrentSeason(force) - season = WorldTime.Now.SeasonValue; if
//                   force, forget the installed season; if the season
//                   is the installed one, return; else
//                   EnsureSeasonalAtlasesInstalled(season) and
//                   RefreshLoadedNatureBatches().
//   EnsureSeasonalAtlasesInstalled(season) - put every VANILLA atlas it
//                   has ever displaced back into MaterialReader's cache;
//                   installedSeason = season; for each archive the
//                   season manages, build (once, cached per season and
//                   archive) a seasonal atlas from the mod's textures
//                   and put THAT into the cache under the vanilla key.
//   TryBuildSeasonalAtlas(archive, prefix) - the vanilla atlas must
//                   exist (its record count is n); the mod's textures
//                   whose names start with the prefix are indexed by
//                   the number after it; n must be >= 2 and records
//                   1..n-1 must ALL be present or the archive is left
//                   vanilla with a warning; slot 0 takes record 1's
//                   texture; every record's size is its texture's
//                   (width, height) * 3.1f with a zero scale and one
//                   frame.
//   RefreshLoadedNatureBatches - every DaggerfallBillboardBatch in the
//                   scene whose archive this mod has ever managed gets
//                   SetMaterial(archive, force) + Apply(): rebuilt from
//                   whatever atlas the cache now holds.
//   GetManagedArchivesForSeason / ArchiveForSeason - the tables below.
//   OnPostFastTravel - ApplyCurrentSeason(true), then a flag that makes
//                   the next OnUpdateTerrainsEnd refresh the batches.
//   OnLoad        - ApplyCurrentSeason(true), then a coroutine that
//                   applies again (unforced) one frame later.
//   OnNewMonth, OnInstantiateTerrain - ApplyCurrentSeason(false).
//
// UNREACHABLE IN 1.1, so not ported: ProcessPendingTerrainRemaps,
// OnLocationGameObjectUpdated, HandleLocationUpdated,
// GuardAndRemapTerrainBatch, RemapBatchToCustomTextures,
// ReplaceBillboardArchiveForTerrain, GetTerrainTextureArchive,
// LoadTexturesFromFiles, GetOrganicTerrainOffset and Hash01 (a per-
// billboard organic position jitter and a per-batch custom-material
// remap at 3.5x). Nothing subscribes or calls into them: the pending
// list is never added to and the location event is never wired. They
// are recorded here so a later version that wires them is a known
// delta, not a surprise.
//
// THE TEXTURES ARE NOT IN THIS REPOSITORY. They are seasonal repaints
// of Daggerfall's own nature flats - the same rocks, trees and plants
// with autumn colour, spring flowers and snow - and the port's doctrine
// is that a re-shaded sprite keeping the original silhouette is game
// data. They reach the game the way ARENA2 does: from the player's own
// copy of the mod, through `systems/seasonsIliacBayAssets.js`.

import { SEASONS } from './gameDate.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';

/** The mod, as its manifest names it. */
export const SEASONS_MOD = Object.freeze({
  vendor: 'seasons-iliac-bay',
  title: 'Seasons of the Iliac Bay',
  version: '1.1',
  author: 'RosyTheRascal',
  guid: '25064a75-7e50-40b0-9d08-e2c3418f0940',
});

/** SeasonHelper.NoInstalledSeason. */
export const NO_INSTALLED_SEASON = -1;

/** TryBuildSeasonalAtlas: `recordSizes[i] = new Vector2(w, h) * 3.1f`.
 *  A float32 literal, so the product is rounded the way Unity's is. */
export const BILLBOARD_SCALE = Math.fround(3.1);

/**
 * GetManagedArchivesForSeason (the iterator's MoveNext): a C# switch
 * whose `case Fall: case Spring:` arm yields 504, 506, 508, 510, whose
 * `case Winter:` yields 505, 507, 509, and whose default (Summer, or
 * anything else) yields nothing. The lowered range test is UNSIGNED
 * (`ble.un 1`), so a negative season - NoInstalledSeason - is not
 * "below Spring": it falls through to the Winter test and out. Written
 * as the switch, so it answers the same. Mountains in snow (511) and
 * the four non-woodland sets (500-503) are never managed.
 */
export function managedArchivesForSeason(season) {
  if (season === SEASONS.Fall || season === SEASONS.Spring) return [504, 506, 508, 510];
  if (season === SEASONS.Winter) return [505, 507, 509];
  return [];
}

/**
 * ArchiveForSeason(season, archive) -> the texture-name prefix, or
 * null. The table is the method's own if-chain, in its order.
 */
export function archivePrefix(season, archive) {
  if (season === SEASONS.Winter) {
    if (archive === 505) return 'K';
    if (archive === 507) return 'F';
    if (archive === 509) return 'C';
    return null;
  }
  if (season === SEASONS.Fall) {
    if (archive === 504) return 'I';
    if (archive === 506) return 'D';
    if (archive === 508) return 'A';
    if (archive === 510) return 'G';
    return null;
  }
  if (season === SEASONS.Spring) {
    if (archive === 504) return 'J';
    if (archive === 506) return 'E';
    if (archive === 508) return 'B';
    if (archive === 510) return 'H';
    return null;
  }
  return null;
}

/** The manifest's folder for each prefix - documentation of where the
 *  mod keeps them. The script itself matches names by PREFIX ONLY, over
 *  the whole file list, and never reads a folder. */
export const PREFIX_FOLDER = Object.freeze({
  A: 'HauntedF', B: 'HauntedS', C: 'HauntedW',
  D: 'HillsF', E: 'HillsS', F: 'HillsW',
  G: 'MountainF', H: 'MountainsS',
  I: 'TempF', J: 'TempS', K: 'TempW',
});

const baseName = (p) => String(p).slice(Math.max(String(p).lastIndexOf('/'), String(p).lastIndexOf('\\')) + 1);
const withoutExtension = (b) => { const d = b.lastIndexOf('.'); return d > 0 ? b.slice(0, d) : b; };
const startsWithIgnoreCase = (s, prefix) => s.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();

/**
 * ParseRecordFromFilename(fileName, prefix): the name without its
 * extension must start with the prefix (StringComparison 5,
 * OrdinalIgnoreCase); what follows must parse as an Int32 or the answer
 * is -1. `Int32.TryParse(string, out int)` is NumberStyles.Integer: an
 * optional sign, and leading or trailing whitespace of .NET's own
 * definition - U+0009..U+000D and U+0020 only, NOT the no-break space
 * or the rest of Unicode's White_Space that JavaScript's trim() takes.
 */
const DOTNET_WHITE = /^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g;
export function parseRecordFromFilename(fileName, prefix) {
  const stem = withoutExtension(baseName(fileName));
  if (!startsWithIgnoreCase(stem, prefix)) return -1;
  const rest = stem.slice(prefix.length).replace(DOTNET_WHITE, '');
  if (!/^[+-]?\d+$/.test(rest)) return -1;
  const n = Number(rest);
  if (n > 2147483647 || n < -2147483648) return -1;
  return n;
}

/**
 * LoadTexturesFromMod's filter: the manifest's file list reduced to
 * basenames, kept when the name without extension starts with the
 * prefix (case-blind). The order is the list's own.
 */
export function filesForPrefix(fileNames, prefix) {
  const out = [];
  for (const f of fileNames ?? []) {
    const base = baseName(f);
    if (startsWithIgnoreCase(withoutExtension(base), prefix)) out.push(f);
  }
  return out;
}

/**
 * TryBuildSeasonalAtlas's record assembly, over already-loaded
 * textures. `textures` is the prefix's file list as objects carrying
 * `name` (the file name), `width` and `height` (and whatever image the
 * caller keeps on them); `recordCount` is the vanilla archive's record
 * count (the length of its atlas indices).
 *
 * Answers `{ ok: false, reason }` exactly where the mod warns and keeps
 * the vanilla atlas:
 *   - no textures for the prefix;
 *   - a record count below 2 ("invalid record metadata");
 *   - any record in 1..recordCount-1 missing ("Atlas replacement was
 *     skipped so stock billboard batching remains valid").
 * Otherwise `records[i]` is record i's texture, with SLOT 0 HOLDING
 * RECORD 1 (`textures[0] = dict[1]`) - record 0 is never placed by the
 * nature layout, and this is what a block that does place it draws.
 * A later file with the same record number overwrites an earlier one,
 * as the dictionary's indexer does.
 */
export function seasonalRecordSet(prefix, archive, recordCount, textures) {
  if (!textures || !textures.length) {
    return { ok: false, reason: `SeasonHelper: No textures found for prefix '${prefix}' and TEXTURE.${String(archive).padStart(3, '0')}.` };
  }
  const byRecord = new Map();
  for (const t of textures) {
    const rec = parseRecordFromFilename(t.name, prefix);
    if (rec >= 0) byRecord.set(rec, t);
  }
  if (recordCount < 2) {
    return { ok: false, reason: `SeasonHelper: TEXTURE.${String(archive).padStart(3, '0')} has invalid record metadata.` };
  }
  for (let r = 1; r < recordCount; r++) {
    if (!byRecord.has(r)) {
      return { ok: false, reason: `SeasonHelper: Missing ${prefix}${r}.png for TEXTURE.${String(archive).padStart(3, '0')}. Atlas replacement was skipped so stock billboard batching remains valid.` };
    }
  }
  const records = new Array(recordCount);
  records[0] = byRecord.get(1);
  for (let r = 1; r < recordCount; r++) records[r] = byRecord.get(r);
  return { ok: true, records };
}

/**
 * The size a seasonal record draws at: the mod's recordSizes entry is
 * (width, height) * 3.1f with a zero recordScale, and the batch then
 * runs GetScaledBillboardSize over it - the same law every classic
 * flat takes (BlocksFile.ScaleDivisor, MeshReader.GlobalScale), which
 * `scaledBillboardSize` already is.
 */
export function seasonalBillboardSize(width, height) {
  return scaledBillboardSize(
    { width: Math.fround(width * BILLBOARD_SCALE), height: Math.fround(height * BILLBOARD_SCALE) },
    { width: 0, height: 0 },
  );
}

/** SeasonAtlasKey (Season, Archive), as a map key. */
export const atlasKey = (season, archive) => `${season}:${archive}`;

/**
 * SeasonHelper's state, over two seams the host provides:
 *   `currentSeason()`       - DaggerfallDateTime.SeasonValue now;
 *   `recordCount(archive)`  - the vanilla archive's record count (may
 *                             be a promise: the port loads TEXTURE.5xx
 *                             on demand);
 *   `load(prefix)`          - the mod's textures for a prefix (may be a
 *                             promise), each `{ name, width, height,
 *                             image }`, or an empty list;
 *   `refresh()`             - RefreshLoadedNatureBatches: rebuild what
 *                             stands from the current cache;
 *   `warn(message)`         - Debug.LogWarning.
 * `lookup(archive, record)` answers what MaterialReader's cache would
 * hand a batch for that archive right now: a seasonal record `{ texture,
 * size }` while the archive's seasonal atlas is installed, null when the
 * cache holds the vanilla one.
 */
export class SeasonHelper {
  constructor(deps) {
    this.deps = deps;
    this.installedSeason = NO_INSTALLED_SEASON;
    this.vanillaAtlasByArchive = new Set();   // the archives whose vanilla atlas was ever displaced
    this.seasonalAtlasByKey = new Map();      // atlasKey -> { records } | null (null: the build failed, and stays failed)
    this.cache = new Map();                   // archive -> records[] installed over the vanilla atlas
    this.refreshNatureBatchesAfterTravel = false;
    this._refreshAfterLoad = false;
    this._applying = null;
    /** Counts every install (EnsureSeasonalAtlasesInstalled past its
     *  early return). A host that bakes its batches can stamp each one
     *  with the generation it was built under and answer `refresh` with
     *  only the batches that stand on an older cache - DFU's refresh
     *  re-applies every batch, including the ones just built, which is
     *  free there and a teardown here. */
    this.generation = 0;
  }

  /** ApplyCurrentSeason(force). Serialised: a second call while one is
   *  still loading textures waits for it, then runs. */
  async apply(force = false) {
    if (this._applying) await this._applying;
    const run = (async () => {
      const season = this.deps.currentSeason();
      if (force) this.installedSeason = NO_INSTALLED_SEASON;
      if (season === this.installedSeason) return false;
      await this.ensureSeasonalAtlasesInstalled(season);
      this.deps.refresh?.();
      return true;
    })();
    this._applying = run;
    try { return await run; } finally { if (this._applying === run) this._applying = null; }
  }

  /** EnsureSeasonalAtlasesInstalled(season). */
  async ensureSeasonalAtlasesInstalled(season) {
    if (season === this.installedSeason) return;
    // Restore vanilla for everything displaced, whatever the season.
    this.cache.clear();
    this.installedSeason = season;
    this.generation++;
    for (const archive of managedArchivesForSeason(season)) {
      const prefix = archivePrefix(season, archive);
      if (!prefix) continue;
      const key = atlasKey(season, archive);
      let atlas;
      if (this.seasonalAtlasByKey.has(key)) {
        atlas = this.seasonalAtlasByKey.get(key);
      } else {
        atlas = await this.tryBuildSeasonalAtlas(archive, prefix);
        // The mod only caches a SUCCESSFUL build; a failed one is retried
        // on the next install, with its warning, which is kept here.
        if (atlas) this.seasonalAtlasByKey.set(key, atlas);
      }
      if (!atlas) continue;
      this.cache.set(archive, atlas.records);
    }
  }

  /** TryBuildSeasonalAtlas(archive, prefix) -> { records } or null. */
  async tryBuildSeasonalAtlas(archive, prefix) {
    // GetCachedMaterialAtlas answering false - an archive the reader
    // could not load - is the warning below and the next archive, so a
    // rejecting count is read as no count.
    let recordCount = 0;
    try { recordCount = await this.deps.recordCount(archive); } catch { recordCount = 0; }
    if (!(recordCount > 0)) {
      this.deps.warn?.(`SeasonHelper: Could not load the native atlas metadata for TEXTURE.${String(archive).padStart(3, '0')}.`);
      return null;
    }
    this.vanillaAtlasByArchive.add(archive);
    const textures = await this.deps.load(prefix);
    const set = seasonalRecordSet(prefix, archive, recordCount, textures);
    if (!set.ok) {
      this.deps.warn?.(set.reason);
      return null;
    }
    return { records: set.records };
  }

  /** What the material cache holds for (archive, record) now. */
  lookup(archive, record) {
    const records = this.cache.get(archive);
    if (!records) return null;
    const t = records[record];
    if (!t) return null;
    return { texture: t, size: seasonalBillboardSize(t.width, t.height) };
  }

  /** Is this archive one the mod has ever taken over? (What
   *  RefreshLoadedNatureBatches filters batches by.) */
  manages(archive) { return this.vanillaAtlasByArchive.has(archive); }

  // ---- the events Awake subscribes ----

  /** DaggerfallTerrain.OnInstantiateTerrain. */
  onTerrainInstantiated() { return this.apply(false); }
  /** WorldTime.OnNewMonth. */
  onNewMonth() { return this.apply(false); }
  /** SaveLoadManager.OnLoad: a forced apply now and an unforced one
   *  next frame (RefreshSeasonAfterLoad). */
  async onLoad() {
    await this.apply(true);
    this._refreshAfterLoad = true;
  }
  /** DaggerfallTravelPopUp.OnPostFastTravel. */
  async onPostFastTravel() {
    await this.apply(true);
    this.refreshNatureBatchesAfterTravel = true;
  }
  /** StreamingWorld.OnUpdateTerrainsEnd: the after-travel refresh. */
  onUpdateTerrainsEnd() {
    if (!this.refreshNatureBatchesAfterTravel) return false;
    this.refreshNatureBatchesAfterTravel = false;
    this.deps.refresh?.();
    return true;
  }
  /** The frame after a load (the coroutine's second half). */
  tick() {
    if (!this._refreshAfterLoad) return null;
    this._refreshAfterLoad = false;
    return this.apply(false);
  }
}
