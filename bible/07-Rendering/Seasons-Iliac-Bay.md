# Seasons of the Iliac Bay - the mod, 1:1 (SIB1, 2026-09-05)

**Mac's call (2026-09-05): "The next mod I want to implement 1:1 is
this. also have permission."** RosyTheRascal's **Seasons of the Iliac
Bay 1.1** for Daggerfall Unity (Nexus 1377): "implements custom textures
and behavior for Spring, Autumn and Winter seasons". The woodland,
hills, haunted-woodland and mountain nature flats - the trees, rocks
and plants of `TEXTURE.504` to `TEXTURE.510` - take autumn colour in
Fall, flowers in Spring and snow in Winter, and draw at 3.1 times their
classic size. Ledger row SIB1; the permission record and the doctrine
ruling on its textures are in `vendor/seasons-iliac-bay/README.md`.

## What the mod is

One script and 372 textures. The script, `SeasonHelper`, ships only as
a compiled DLL (25,600 bytes; the `.cs` its manifest names is not in
the bundle), so it was read off the IL method by method. What it does
in 1.1:

| Method | What it does | Port |
|---|---|---|
| `Awake` | subscribes `DaggerfallTerrain.OnInstantiateTerrain`, `WorldTime.OnNewMonth`, `SaveLoadManager.OnLoad`, `DaggerfallTravelPopUp.OnPostFastTravel`, `StreamingWorld.OnUpdateTerrainsEnd` | the five seams in `scenes/world.js` (the fixed city hears the first three at its one boot) |
| `ApplyCurrentSeason(force)` | `season = WorldTime.Now.SeasonValue`; a force forgets the installed season; the same season returns; else install and refresh | `SeasonHelper.apply` |
| `EnsureSeasonalAtlasesInstalled` | every displaced vanilla atlas back into MaterialReader's cache, then the season's managed archives get their seasonal atlas (built once per season and archive) under the vanilla key | `ensureSeasonalAtlasesInstalled`, the `cache` map the hosts read through `lookup` |
| `GetManagedArchivesForSeason` | Fall and Spring: 504, 506, 508, 510; Winter: 505, 507, 509; Summer: none | `managedArchivesForSeason` |
| `ArchiveForSeason` | the eleven prefixes: Winter K/F/C, Fall I/D/A/G, Spring J/E/B/H | `archivePrefix` |
| `TryBuildSeasonalAtlas` | the vanilla atlas's record count n; the mod's textures whose names start with the prefix, indexed by the number after it; n >= 2 and records 1..n-1 all present or the archive stays vanilla with a warning; slot 0 takes record 1; `recordSizes[i] = (w, h) * 3.1f`, zero scale, one frame; a new atlas and material | `seasonalRecordSet`, `seasonalBillboardSize`, `tryBuildSeasonalAtlas` |
| `RefreshLoadedNatureBatches` | every billboard batch on an archive the mod has ever managed: `SetMaterial(archive, force)` and `Apply()` | the hosts' `refresh` seam (below) |
| `OnPostFastTravel` | a forced apply, then a flag that makes the next `OnUpdateTerrainsEnd` refresh | `onPostFastTravel`, `onUpdateTerrainsEnd` |
| `OnLoad` | a forced apply, then an unforced one a frame later | `onLoad`, `tick` |
| `OnNewMonth`, `OnInstantiateTerrain` | an unforced apply | `onNewMonth`, `onTerrainInstantiated` |

**Unreachable in 1.1, not ported:** `ProcessPendingTerrainRemaps`,
`OnLocationGameObjectUpdated`, `HandleLocationUpdated`,
`GuardAndRemapTerrainBatch`, `RemapBatchToCustomTextures`,
`ReplaceBillboardArchiveForTerrain`, `GetTerrainTextureArchive`,
`LoadTexturesFromFiles`, `GetOrganicTerrainOffset`, `Hash01`. They are
a per-billboard organic position jitter and a per-batch custom-material
remap at 3.5x; nothing subscribes or calls into them (the pending list
is never added to, the location event never wired). Recorded so a
later version that wires them is a known delta.

**Quirks kept:** the four-valued season is DFU's `SeasonValue` (Fall 0,
Spring 1, Summer 2, Winter 3 - the port's `gameDate.seasonValue`), so
the swap happens on month boundaries and nowhere else; record 0 draws
record 1's texture (the layout never places record 0, a block might);
one missing record leaves the WHOLE archive vanilla for that season,
with the mod's own warning; a failed build is retried on the next
install and only a successful one is cached; mountains in snow (511)
and the unwooded sets (500-503) never change; the size is 3.1x the
texture's pixels through the same `GetScaledBillboardSize` every
classic flat takes, with `3.1f` rounded as a float32.

## The textures are the player's to supply

They are seasonal repaints of Daggerfall's own flats - the same
silhouettes with new colour - and the doctrine's own sentence names
that case: a re-shaded sprite that keeps the original silhouette is
game data. The windmills ruling (`vendor/windmills-kamer/README.md`)
left that mod's exported PNGs out for the same reason. So the textures
reach the game the way ARENA2 does, from the player's own copy of the
mod, through the **Your own textures** pick:

1. **the `.dfmod` itself** - `src/formats/unityBundle.js` reads the
   UnityFS container (version 7, LZ4/LZ4HC blocks via `formats/lz4.js`),
   the SerializedFile inside (version 21, little-endian, the object
   layout taken FROM the type tree the bundle carries, so the reader is
   not tied to one Unity version) and the `Texture2D` and `TextAsset`
   objects (RGBA32, ARGB32, RGB24, Alpha8, DXT1 and DXT5 via
   `formats/dxt.js`; rows flipped from Unity's bottom-up). Validated
   against a reference extraction of this mod's bundle: 372 of 372
   textures and both text assets byte for byte. LZMA bundles, stripped
   type trees and other texture formats (the Dynamic Skies OSX bundle's
   BC7, for one) are refused with a clear error; or
2. **the mod's `Textures/` folders** as loose PNGs, kept by folder.

`systems/seasonsIliacBayAssets.js` is the registry: the stored names
and a loader, nothing read until a season needs a prefix; a bundle is
opened once and identified by its manifest's GUID (or title). Without
either source the mod is inert.

## How it meets the port

- **The flats.** Both climate hosts' flats consumers ask the cache per
  flat (`seasons.lookup(archive, record)`): a seasonal record uploads
  the mod's texture under a key that carries the installed season and
  draws at `seasonalBillboardSize`; a classic record takes the path it
  always took. The seasonal record has one frame, as the mod's atlas
  does, so it is never armed for animation.
- **The refresh.** DFU's `RefreshLoadedNatureBatches` re-applies every
  batch in place, which is free. This host bakes its batches, so the
  refresh is answered with the same destroy-and-requeue sweep
  `tickSeason` already runs for the winter flip - and only when a pixel
  stands on an OLDER install than the current one (each pixel records
  the `generation` it was built under). A season turn the climate
  season does not share (Summer to Fall, Spring to Summer) reaches the
  standing world that way; the winter flip's own rebuild finds every
  pixel fresh and rebuilds nothing twice.
- **The events.** Boot is `OnLoad` (the forced apply, once the pick's
  registration has answered whether the mod is present); each pixel
  build is `OnInstantiateTerrain`; the day poll that finds a month
  boundary is `OnNewMonth`; the teleport core is `OnPostFastTravel`,
  reading the ARRIVAL month through the season latch the port already
  keeps for fast travel; the destination standing is
  `OnUpdateTerrainsEnd`; the frame after a load is the mod's coroutine.
  The fixed city (`?exterior`) builds its flats once and hears only
  the load and the one terrain.
- **The switch.** `MOD_SETTINGS['seasons-iliac-bay'].Enabled`, on by
  default (a DFU mod is on by being installed), in the Mods pane; the
  credits carry the row.

## Translations recorded (not departures)

1. **The refresh is a rebuild, filtered by install generation** - DFU
   re-applies materials in place; the port's batches are baked, and
   the winter flip already rebuilds. Same visible result; the
   generation filter is what keeps a season turn to one rebuild.
2. **No atlas.** DFU packs the season's textures into one atlas
   (`PackTextures`, padding 2, 2048 or 4096 with asset injection) and
   the batch reads UV rects; the port uploads each record as its own
   texture, as it does every classic flat, so the rects are moot and
   the sizes are the same numbers.
3. **The textures come through the pick, not the mod system** - see
   above; the manifest's file list is still what the prefix filter
   runs over when the bundle is present.

## Verification

`test/seasonsIliacBay.test.js` (15 tests): the tables, the filename
parse, the record-set checks with the mod's own messages, the size law,
the state machine (install once, force, failed build retried, the
racing applies), the events, the LZ4 and DXT vectors, the UnityFS
reader over a bundle built in the test (stored and LZ4 blocks, the
common-string table, a bottom-up flip, a DXT5 texture, a text asset,
the refusals), the asset key and registry, the hosts' seams, the
vendor tree without a raster. The real bundle was read in this session
and matched the reference extraction 374 of 374; a live world render
needs ARENA2, which the container lacks.
