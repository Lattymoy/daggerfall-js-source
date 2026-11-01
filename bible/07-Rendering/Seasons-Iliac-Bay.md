# Seasons of the Iliac Bay

Seasons of the Iliac Bay (RosyTheRascal, version 1.1) gives the woodland, hills, haunted-woodland and
mountain nature flats (TEXTURE.504 to 510) autumn colour in Fall, flowers in Spring and snow in Winter, drawn at 3.1
times their classic size. We port its script 1:1. Its textures are repaints of Daggerfall's flats, so the player
supplies them from their own copy of the mod; without it the mod is inert. Our code is the record:
`test/systems/seasonsIliacBay.test.js` holds the manifest's identity and its 372 texture names as a literal table, and
the release's record is in `01-Overview/Own-Work.md`.

## How it works

### The script

`SeasonHelper` ships only as a compiled DLL, read off its IL method by method. Ported as `src/systems/seasonsIliacBay.js`
`SeasonHelper`:

| DFU method | What it does | Port |
|---|---|---|
| `ApplyCurrentSeason(force)` | season from `WorldTime.Now.SeasonValue`; same season returns; else install and refresh | `apply` |
| `EnsureSeasonalAtlasesInstalled` | vanilla atlases restored, the season's managed archives get their seasonal atlas | `ensureSeasonalAtlasesInstalled`, the cache the hosts read through `lookup` |
| `GetManagedArchivesForSeason` | Fall and Spring 504, 506, 508, 510; Winter 505, 507, 509; Summer none | `managedArchivesForSeason` |
| `ArchiveForSeason` | the eleven texture prefixes | `archivePrefix` |
| `TryBuildSeasonalAtlas` | records 1..n-1 must all be present, else the archive stays vanilla; slot 0 takes record 1; size x 3.1 | `seasonalRecordSet`, `seasonalBillboardSize` |
| `RefreshLoadedNatureBatches` | re-applies every batch on a managed archive | the hosts' refresh (below) |
| `OnPostFastTravel`, `OnLoad`, `OnNewMonth`, `OnInstantiateTerrain` | forced or unforced applies | `onPostFastTravel`, `onLoad`, `tick`, `onNewMonth`, `onTerrainInstantiated` |

Quirks kept: the season is DFU's four-valued `SeasonValue`, so it changes on month boundaries only; record 0 draws
record 1's texture; one missing record leaves the whole archive vanilla for that season, with the mod's warning; only a
successful build is cached; 511 (mountain snow) and 500 to 503 never change; the size is `Math.fround(3.1)`
(`BILLBOARD_SCALE`) through the classic billboard size.

Methods unreachable in 1.1 (a per-billboard position jitter and a per-batch remap nothing calls) are not ported. The
bundle's `ModVersion` is compared to 1.1 and a mismatch warned.

### The textures

`src/systems/seasonsIliacBayAssets.js` is the registry. The player's **Your own textures** pick stores either the mod's
`.dfmod` (any `.dfmod` whose name says "season", identified by its manifest's GUID or title and read by
`src/formats/unity/unityBundle.js`) or its `Textures/` folders as loose PNGs. The bundle is opened once, when a host first
asks whether the mod is installed; no pixel decodes until a season asks for its prefix.

### In the hosts

- **Flats.** Each nature flat asks `seasons.lookup(archive, record)`. A seasonal record uploads the mod's texture under
  a key carrying the installed season, at `seasonalBillboardSize`, one frame, with no mip chain (as the mod builds its
  atlas). One site uploads it for every host: `src/world/naturePicture.js`.
- **Refresh.** Our batches are baked, so the refresh rebuilds a pixel, and only one that was built under an older
  install and carries a batch on a managed archive. A pixel records the install generation its lookups read.
- **Events.** Boot is `OnLoad`; each pixel build is `OnInstantiateTerrain`; the day poll that finds a month boundary
  is `OnNewMonth`; only the travel popup's fast travel raises `OnPostFastTravel` (other teleports raise the load or the
  terrain events, as in DFU); a quickload raises `OnLoad`. The fixed city builds its flats once and hears only the load
  and its one terrain.
- Low Poly Trees and Windfall read the installed season too (`Low-Poly-Trees.md`, `Windfall.md`).

## Rules

- The textures are the player's to supply. A re-shaded sprite that keeps the original silhouette is game data under
  Port-Doctrine, so no pixel of the mod is in the repository; the author's permission covers the script.
- The switch is the mod setting `seasons-iliac-bay` `Enabled`, on by default (a DFU mod is on by being installed).
- Online it is the player's own (`src/systems/online/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`).
- The far rings' size rule is a world-unit size test, so the 3.1x seasonal flats stand at more rings in Fall, Spring and
  Winter. That is the mod's cost. If it matters, the lever is a screen-size rule for every flat, never a seasonal height.

## Daggerfall Unity

Translations, not departures:

1. The refresh rebuilds the qualifying pixels, filtered by install generation and by archive; DFU re-applies materials
   in place. Same visible result.
2. No atlas: each record is its own texture, as every classic flat is, with the same sizes.
3. The textures come through the pick, not the mod system; the manifest's file list still drives the prefix filter.
4. Our refresh reaches every qualifying standing pixel. DFU's walk sees only active batches, so a terrain inactive at
   the month turn keeps the old season until a later turn.

Recorded differences: a month boundary crossed indoors is heard on the first exterior frame, where DFU's fires indoors
(interiors have no nature flats). `OnUpdateTerrainsEnd` is raised once at a teleport's tail; later pixels take the
installed cache.

## Code and tests

- `src/systems/seasonsIliacBay.js` - `SeasonHelper` and its pure laws
- `src/systems/seasonsIliacBayAssets.js` - the registry, `seasonsInstalled`, `loadSeasonsTextures`
- `src/formats/unity/unityBundle.js` - reads the `.dfmod` (UnityFS, LZ4, type tree; RGBA32, ARGB32, RGB24, Alpha8,
  DXT1, DXT5)
- `src/world/naturePicture.js` - which picture a nature flat stands as
- `src/scenes/world.js` - the five seams; `src/scenes/exterior.js` - the load and its one terrain

## Open

- The all-or-nothing rule is unchecked against ARENA2's real record counts for TEXTURE.504 to 510, and no probe draws
  the mod.
- The permission record for the ported script is open (`01-Overview/Own-Work.md`).
- LZMA bundles, stripped type trees and other texture formats are refused with a clear error.
