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
| `Awake` | subscribes `DaggerfallTerrain.OnInstantiateTerrain`, `WorldTime.OnNewMonth`, `SaveLoadManager.OnLoad`, `DaggerfallTravelPopUp.OnPostFastTravel`, `StreamingWorld.OnUpdateTerrainsEnd` | the five seams in `scenes/world.js` (the fixed city hears only `OnLoad` and its one `OnInstantiateTerrain` at boot, and - as with its own winter re-skin - nothing after: the month turn is the streaming host's) |
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
and the unwooded sets (500-503) never change (AUDIT 65 XL-2, refuted as a defect and recorded here: MAC1's far-flat rule is a WORLD-UNIT size test, so a seasonal atlas - whose plants really are 3.1x taller - admits most of archives 504-510 at every ring in Fall, Spring and Winter; that is the mod's cost, not a hole in the rule, and the lever if it ever matters is a screen-size criterion applied uniformly, never a season-conditional height); the size is 3.1x the
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
and a loader. The bundle is opened once, when a host first asks whether
the mod is installed (its blocks decompressed and its object table
read, to find the manifest and identify it by GUID or title); no
texture's pixels decode until a season asks for its prefix, and the
loose folders are read only per prefix. Only the mod's own `.dfmod`
(by name) is stored from the pick - a whole DFU Mods folder would
otherwise put every bundle in the browser. Without either source the
mod is inert.

## How it meets the port

- **The flats.** Both climate hosts' flats consumers ask the cache per
  flat (`seasons.lookup(archive, record)`): a seasonal record uploads
  the mod's texture under a key that carries the installed season and
  draws at `seasonalBillboardSize`; a classic record takes the path it
  always took. The seasonal record has one frame, as the mod's atlas
  does, so it is never armed for animation. AUDIT 61: the upload has
  NO mip chain - the mod builds its atlas `new Texture2D(size, size,
  RGBA32, mipChain: false)`, `Apply(updateMipmaps: false)`, filtered
  Point, where DFU's own nature atlas is mipped
  (`TextureReader.cs:31/:521`) - so the seasonal flat is one NEAREST
  level at every distance while the classic flats keep their chain
  (`uploadTexture(..., { mips: false, variant: '' })`: the un-mipped
  upload keeps the plain batch key, which only the item icons had
  re-keyed to `#ui` before).
- **The refresh.** DFU's `RefreshLoadedNatureBatches` re-applies every
  batch in place, which is free. This host bakes its batches, so the
  refresh is answered with the same destroy-and-requeue sweep
  `tickSeason` already runs for the winter flip - and only when a pixel
  stands on an OLDER install than the current one (each pixel records
  the `generation` it was built under) AND carries a batch on an
  archive the mod has ever managed, which is DFU's own filter (AUDIT 62
  F4). A season turn the climate season does not share (Summer to Fall,
  Spring to Summer) reaches the standing world that way; the winter
  flip's own rebuild finds every pixel fresh and rebuilds nothing twice.
  AUDIT 61: the generation a
  pixel records is the one its lookups READ (captured right after its
  `OnInstantiateTerrain`), not the one standing when it publishes -
  a build's texture fetches yield, and a forced apply on a quickload
  or a teleport whose destination ring keeps the pixel can land in
  between; and a pixel that publishes across such an install raises
  the re-skin itself, since the stamp scan cannot see a pixel that is
  not published yet. That is what `RefreshLoadedNatureBatches`'s
  forced walk over every ACTIVE batch (`FindObjectsOfType` with no
  `includeInactive`, il.txt 0x08a4) guarantees in DFU for the batches
  it can see - translation 4 records the ones it cannot.
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

1. **The refresh is a rebuild of the qualifying PIXELS, filtered by
   install generation AND by archive** - DFU re-applies materials in
   place; the port's batches are baked, and the winter flip already
   rebuilds. Same visible result; the generation filter is what keeps a
   season turn to one rebuild, and the archive filter (AUDIT 62 F4,
   below) is DFU's own - `RefreshLoadedNatureBatches` touches only
   batches whose archive the mod has ever managed. Both filters decide
   PER KEY (ROAD-H H3, below): the seam marks the pixels that qualify
   and the driver rebuilds those alone, as the reference re-applies the
   batches that qualify and no others. The whole-grid sweep belongs to
   the CLASSIC winter flip, a different and older law. What the rebuild
   reaches that DFU's re-apply does not is translation 4.
2. **No atlas.** DFU packs the season's textures into one atlas
   (`PackTextures`, padding 2, 2048 or 4096 with asset injection) and
   the batch reads UV rects; the port uploads each record as its own
   texture, as it does every classic flat, so the rects are moot and
   the sizes are the same numbers.
3. **The textures come through the pick, not the mod system** - see
   above; the manifest's file list is still what the prefix filter
   runs over when the bundle is present.
4. **The refresh reaches every standing pixel THAT QUALIFIES; DFU's
   reaches the ACTIVE batches, over a substrate that never re-skins a
   standing terrain** (AUDIT 61, two skeptics, recorded as they agreed;
   ROAD-H H3 narrowed "every standing pixel" to the qualifying ones,
   which does not touch what this translation is about - the port
   reaches an INACTIVE pixel's batch where DFU's walk cannot see it, not
   that it reaches batches the filter would have skipped).
   `RefreshLoadedNatureBatches` walks
   `FindObjectsOfType<DaggerfallBillboardBatch>()` (il.txt 0x08a4),
   which skips inactive objects, and `DaggerfallBillboardBatch.
   SetMaterial` returns early on `archive == currentArchive && !force`
   (`DaggerfallBillboardBatch.cs:283-284`) with `Clear()` never
   resetting `currentArchive`, while `StreamingWorld.UpdateTerrainNature`
   re-materialises a recycled pool slot UNFORCED (`StreamingWorld.cs:
   1269`). So a batch that was inactive at the instant of the month
   turn - a terrain in flight - keeps the old season through every
   later recycle until it is active at a later turn; and a month turn
   taken indoors (`DisableAllParents` has `ExteriorParent` off) installs
   the atlases and refreshes nothing, the town's OWN flats taking the
   new season on the first exterior frame through `DaggerfallLocation.
   Update`'s four-valued season poll (`DaggerfallLocation.cs:113-129`,
   :277-282) while the streamed terrain around them keeps the season it
   was streamed in. That last is DFU's substrate, mod or no mod: DFU
   raises `updateData`/`updateNature` only in `PlaceTerrain`
   (`StreamingWorld.cs:905-906`), so a standing terrain's ground atlas
   and nature batch keep their season until the pixel re-streams. The
   port's `tickSeason` rebuilds the whole standing grid on a CLIMATE
   season change - the ROAD A1 season law, older than this mod and
   pinned by `test/seasoncalendar.test.js` - and on the mod's own
   refresh it rebuilds every standing pixel the filter marks, whether
   that pixel is the one under the player or one at the far edge of the
   ring, active or not; this host has no pooled batch and no cached
   batch material (translation 2), so the mod's refresh here converges
   on the installed season everywhere on the first exterior frame. A known difference, the port's and not the mod's:
   the port never shows DFU's split.

## Verification

`test/seasonsIliacBay.test.js` (17 tests): the tables, the filename
parse, the record-set checks with the mod's own messages, the size law,
the state machine (install once, force, failed build retried, the
racing applies), the events, the LZ4 and DXT vectors, the UnityFS
reader over a bundle built in the test (stored and LZ4 blocks, the
common-string table, a bottom-up flip, a DXT5 texture, a text asset,
the refusals), the asset key and registry, the hosts' seams, the
vendor tree without a raster. The real bundle was read in this session
and matched the reference extraction 374 of 374; a live world render
needs ARENA2, which the container lacks.

## AUDIT 62 (2026-09-07) - the seasonal flat's row order, the refresh's archive filter, and two pins that could not fail

**F26 (high, within the mod's lane): every seasonal tree, rock and
plant drew UPSIDE-DOWN.** The port's texel convention is bottom-up:
`getColor32` writes `dstRow = (height - 1 - y) * width`
(`baseImageFile.js:123`, `BaseImageFile.cs:250`), `uploadTexture`
uploads as-is with `UNPACK_FLIP_Y_WEBGL` off (`renderer.js:1834`), and
`BB_VS` samples the quad's TOP at v=1, i.e. the LAST row
(`renderer.js:301-304`). The seasonal record arrived in PNG raster
order instead - `decodeTexture2D` flips Unity's bottom-up rows to
top-down for its own consumers, and the loose arm is a canvas
`getImageData` - and `world.js:1161` / `exterior.js:786` handed that
straight to `uploadTexture`. So a seasonal flat drew mirrored against
the classic flat uploaded five lines later in the same batch loop. In
DFU there is nothing to reconcile: the mod's asset is a Unity
`Texture2D` and so is every texture `TextureReader` builds from
`GetColor32`, both bottom-up. Fixed at the mod's own door -
`loadSeasonsTextures` now reverses rows into getColor32 order on both
arms (`toColor32Order`), so `decodeTexture2D` and `decodePng` keep the
PNG raster order each states as its contract and neither upload site
changes (see F28 below on what that leaves the reader's own doc
saying). Pinned behaviourally: a 1x2 picture shipped as the mod ships
it (a Unity `Texture2D`, bottom row stored first) goes through the
bundle reader, `SeasonHelper.lookup` and the hosts' upload expression
into a recording GL, and the bytes at `texImage2D` must equal, byte
for byte, what `TextureFile.getColor32` produces for the same picture,
with `UNPACK_FLIP_Y_WEBGL` false. The door's own row-order pin, which
asserted top-down, is inverted with the fix.

**F4 (medium): `manages()` had no caller - a whole grid torn down where
DFU refreshes nothing.** `RefreshLoadedNatureBatches` re-applies only
the batches whose archive is in `vanillaAtlasByArchive` (`manages`).
The host's `refresh` seam tested the install generation alone, and
`ensureSeasonalAtlasesInstalled` bumps that generation on EVERY
install including the Summer one that manages nothing - so in every
climate whose nature set is 500-503 (rainforest, subtropical, swamp,
desert: archives no season manages) all four season turns tore down
the whole grid, armed the `_seasonHoldKey` motor hold on the standing
player and cold-rebuilt a world that does not change by one texel,
where DFU touches no batch at all. `refresh` now takes DFU's filter as
well: stale install AND a batch on an archive the mod has ever
managed. The set is cumulative and is filled inside
`tryBuildSeasonalAtlas` before `apply` calls `refresh`, so a pixel
still standing on the summer archive 504 at the Winter install (which
manages 505/507/509) is still re-skinned, as DFU re-skins it. NOT
narrowed further at the time: `tickSeason` rebuilt all of `built` once
any pixel qualified, and that sweep is shared with the classic winter
flip - a per-key refresh was its own step. **That step is ROAD-H H3,
below.**

**F5 (low, pin): the `OnNewMonth` pin matched the member, not the
call.** `assert.match(world, /seasons\.onNewMonth\(\)/)` matched the
body of the one-caller wrapper `seasonsMonthTurn`; deleting the day
poll's hand-over to it left every pin green while the streaming host
went deaf to every month turn (a standing world would keep the
previous season's atlases until a load or a teleport). Replaced with
two caller-shaped assertions: `refreshSeason` hands each latched day
boundary to `seasonsMonthTurn`, and that wrapper is
`WorldTime.OnNewMonth` (`WorldTime.cs:139/:226`). The `tick` and
`onUpdateTerrainsEnd` pins are NOT the same shape - their matched text
IS their sole call site - and were left alone.

**F36 (medium, pin): "slot 0 holds record 1" could not tell record 1
from a record 0.** `textures[0] = dict[1]` deliberately discards a
present record 0, and every fixture that asserted slot 0 was built
from record 1 up, so `byRecord.get(0) ?? byRecord.get(1)` passed the
whole file. The mod really ships a record 0 for 9 of its 11 prefix
folders (`TempW/K0.png`, `TempS/J0.PNG`, ...) and nothing filters it
out on the way in, so the discarded branch is the production path.
Pinned with a K0-bearing fixture at both arms: `seasonalRecordSet` and
a `SeasonHelper` whose winter set carries K0 must both answer
`K1.png` at slot 0.

## AUDIT 62 review round (2026-09-07) - F28

**F28 (low, doc): `decodeTexture2D`'s JSDoc stated a rationale F26 had
falsified.** The reader's header read "TOP ROW FIRST (Unity stores its
rows bottom-up; **every consumer here wants the raster order a PNG
decodes to**)". After F26 that parenthetical is false: the reader has
exactly one consumer in `src/`
(`seasonsIliacBayAssets.js:196`, `toColor32Order(tex.rgba())` - the helper itself moved to `formats/color32Order.js` at ROAD-H H4, where the M-TEX door takes it too) and it
reverses every row straight back, so the composition is the identity
on every `TextureFormat` arm. The comment was left claiming the
opposite of what the delta did - the same class of defect F27 corrects
at `renderer.js`. The doc now states the reader's PNG-order CONTRACT
for a general bundle consumer and says outright that the port's upload
order is getColor32, pointing at the seasons door that converts, the
way the door's own header already points back at the reader; the
door's closing line drops "for their other consumers" with it, and so
does F26's paragraph above. The BEHAVIOUR is untouched: the reader's
row-order pin (`test/seasonsIliacBay.test.js:539-543`, which asserts
the top row of the image is the LAST row Unity stored) still holds and
was rightly left alone by F26, and the end-to-end
`texImage2D`-vs-`getColor32` pin is what fixes the order that reaches
the GL. Dropping the reader's flip instead (one fewer `Uint8Array`
copy per texture, 372 per install on the real bundle) was NOT taken:
it changes the reader's published contract for any future bundle
consumer and would have to move that pin, which is a behavioural step,
not a comment fix.

## ROAD-H H3 (2026-09-07) - the refresh, per KEY

**The seam raised ONE flag and the driver rebuilt the WHOLE grid.**
AUDIT 62 F4 gave the streaming host's `refresh` seam DFU's archive
filter and left it there: the seam scanned `built` and, on the FIRST
pixel standing on an older install with a batch on a managed archive,
set `_reskinPending` and returned. `tickSeason` then tore down and
cold-rebuilt every key in `built`. One qualifying pixel at the edge of
the ring therefore cost the player the pixel under his feet - the whole
destroy-and-requeue sweep, the `_seasonHoldKey` motor hold, a cold
refetch of every archive in the grid - for a turn that changes nothing
on most of those pixels.

**The reference decides PER BATCH, and its filter is the ARCHIVE.**
`RefreshLoadedNatureBatches` walks
`FindObjectsOfType<DaggerfallBillboardBatch>()` (the DLL's il.txt
0x08a4) and asks only the batches whose archive is in
`vanillaAtlasByArchive` - every batch the archive filter skips is not
touched at all. Every batch it DOES ask is re-applied, the just-built
included, and the call is forced: `SetMaterial`'s early return is
`archive == currentArchive && !force`
(`DaggerfallBillboardBatch.cs:283-284`) and `currentArchive` is the
archive INDEX (`DaggerfallBillboardBatch.cs:73` `int currentArchive =
-1;`, `:360` `currentArchive = archive;`), which does not change when
the mod installs a seasonal atlas under that same index - so an
unforced walk would return at :283-284 for every batch it asks and
refresh nothing at all. (The unforced call this page cites at
`:283-284` in translation 4 is a DIFFERENT call site: `StreamingWorld.
UpdateTerrainNature`'s `dfBillboardBatch.SetMaterial(natureArchive)`,
`StreamingWorld.cs:1269`, which recycles a pool slot without the mod
in the loop. It is not the mod's own refresh.)

**So only ONE of the port's two filters is the reference's.** The
ARCHIVE filter is DFU's (AUDIT 62 F4). The install-GENERATION filter
is this port's translation 1, recorded in AUDIT 61 and unchanged by
this section: DFU's forced walk re-applies the batches that already
wear the current atlas because a re-apply is free there, and this host
would have to tear a pixel down and cold-rebuild it to hand it the
atlas it is already wearing. Both filters happen to decide per KEY,
which is what this section narrows the sweep to; only the first is a
law read off the reference.

**The fix.** `src/world/seasonReskin.js` is the collector.
`markStale(seasons, built)` is the filter over the built grid - older
install (the port's half) AND a batch on an archive the mod has ever
managed (DFU's half) - collecting KEYS; `mark(key)` adds one; `markAll()` is the classic flip's
whole-grid flag; `pending` is "is there anything to re-skin"; and
`take(built)` hands the driver the keys and spends the pending state,
dropping any marked key that has since left `built` (there is no batch
there to re-apply, which is what `FindObjectsOfType` not returning it
means); `clear()` is the teleport's quiet path. In `scenes/world.js`
the seam is now `refresh: () => _reskin.markStale(seasons, built)`, the
AUDIT 61 publish-across-install arm marks **its own** key rather than
the grid, `tickSeason` takes the keys instead of `[...built.keys()]`,
and `_reskin.clear()` at the teleport keeps exactly the meaning
`_reskinPending = false` had there. The `building` gate, the generation
stamps and the nearest-first rebuild order are untouched. One thing
follows from the narrowing: the motor hold is armed only when the
player's own pixel is among the keys going down - a re-skin that leaves
it standing takes no ground from under him, and arming the hold there
would re-anchor a fall for nothing. The collector is declared ABOVE the
`SeasonHelper` whose seam marks into it: the boot's forced apply can
land during any await between that block and the frame loop, and a
`const` still in its temporal dead zone would have thrown inside
`seasonsReady`'s catch and left the mod silently inert.

**The classic winter flip still sweeps every key**, and must: the
two-valued climate season turns the ground atlas, the tile set and the
climate swaps of every pixel (the ROAD A1 law, `DaggerfallLocation.
Update`'s `lastSeason` test), which is not the mod's per-archive
question at all. `refreshSeason()` returning true calls `markAll`.

**The fixed city is unchanged**: `scenes/exterior.js` builds its flats
once and answers `refresh` with `() => {}`, as it did - there is no
grid there to narrow.

**Pinned** in `test/roadh_seasons_tex.test.js`, behaviourally, through
the seam: a three-pixel grid at the moment of `OnUpdateTerrainsEnd`'s
after-travel refresh - one stale on a managed archive, one stale on the
unmanaged 503, one built under the current install - yields exactly one
key, and `markAll` then yields all three. `test/seasonsIliacBay.test.js`'s
F4 pin drives the same collector rather than restating the seam.
Mutation-proven both ways: `markStale` raising the whole-grid flag, and
`markAll` marking nothing, each kill it.

### ROAD-H H3 review round (2026-09-07)

**R1 (medium) - the stated reference law was INVERTED.** The first
draft of this section, the collector's header, `world.js`'s driver
comment, the Testing.md row and the pin's own comment all said the
mod's refresh leaves a batch alone when it already wears the current
season, citing `DaggerfallBillboardBatch.cs:283-284`. It does not.
`currentArchive` is the archive INDEX
(`DaggerfallBillboardBatch.cs:73` `int currentArchive = -1;`, `:360`
`currentArchive = archive;`), and a nature batch's archive number does
not change when the mod installs a seasonal atlas under it - so if
`RefreshLoadedNatureBatches` passed `force = false`, `archive ==
currentArchive` would be true for every batch it asks and the mod could
never re-skin anything. The walk is FORCED and re-applies every batch
on a managed archive, the just-built included, which is exactly what
this page already said in two older places
(`systems/seasonsIliacBay.js`'s `generation` comment, and AUDIT 61 F11:
"walks EVERY batch after every apply, the just-built included"). The
`:283-284` citation that DOES belong on this page is translation 4's,
about a different call site entirely - `StreamingWorld.
UpdateTerrainNature`'s unforced `dfBillboardBatch.SetMaterial(
natureArchive)` at `StreamingWorld.cs:1269` - and the draft repurposed
it as the mod's own. Consequence: the ARCHIVE half of the per-key
narrowing is genuinely DFU's, but the GENERATION half is the port's
translation 1 (AUDIT 61), and the draft had recorded it as the
reference's decision in five places, the pin comment included. All five
corrected; the behaviour is unchanged, because the SET the port
rebuilds was right for the right reason on the archive half and for a
stated-wrong reason on the generation half.

**R2 (low) - the motor-hold guard shipped unpinned.** The narrowing
arms `_seasonHoldKey` only when the player's own key is among the keys
going down, and the draft deferred a behavioural pin claiming the
source-order pin covered it. It did not: `test/seasoncalendar.test.js`
matched only the assignment substring, which survives deleting the
guard (mutation: rewrite the line back to `if (walkMode &&
playerSpawned)`; 34/34 stayed green). The ROAD-Ar R0 pin now matches
the WHOLE condition inside the `tickSeason` window it already slices,
and that mutation kills it.

## SIB2: the audit (2026-09-08, Mac: "ensure the seasons mod we have integrated is 1:1 and working correctly")

An Opus explorer mapped the integration whole against the page's own
method table (every method, every seam, every pin) and listed twenty
things to look at. Sixteen are the record's own translations or the
mod's own faithful oddities, already on this page (the per-pixel
refresh, no atlas, the pick as the mod system, the far ring reached,
the shipped record-0 files never drawn, the size asymmetry against the
mountain snow archive 511 the mod never manages, the fixed city's two
events). Four were gaps, fixed:

1. **The bundle by its manifest, not by one guessed file name.** The
   door stored a `.dfmod` only under the exact name `seasons of the
   iliac bay.dfmod`, which nothing in the tree evidences - the mod's own
   manifest names its manifest "4 Seasons.dfmod.json", and Nexus renames
   downloads. A mod's identity is its manifest (the GUID, then the
   title), which `seasonsBundle` already read; now any `.dfmod` whose
   name says "season" is stored and the manifest decides (the name test
   stays only so a whole Mods folder is not decompressed).
2. **The load event on a load.** A quickload and a classic import go
   through the teleport core, which raised the mod's
   `OnPostFastTravel`; DFU raises `SaveLoadManager.OnLoad` there - the
   forced apply now and the unforced one a frame later. The core takes
   `modEvent: 'load'` from both.
3. **The travel event from the travel popup alone.** Every teleport -
   the court release, the ship, the recall, the teleport service, a
   quest's respawn, the cemetery - raised `OnPostFastTravel`: a forced
   apply and a rebuild of the season's atlases on each. In DFU only
   `DaggerfallTravelPopUp` raises it; the others' terrains raise
   `OnInstantiateTerrain`, which the per-pixel build already does. The
   core takes `modEvent: 'travel'` from `fastTravelTo` alone.
4. **A later version says so.** The port is 1.1's IL; the bundle's
   `ModVersion` is compared to it and a mismatch warned, since a later
   build may wire what 1.1 leaves unreachable (the organic jitter, the
   per-batch remap).

Recorded, not changed: a month boundary crossed indoors is heard on the
first exterior frame (the day poll), where DFU's `OnNewMonth` fires
indoors - interiors have no nature flats, so nothing differs on screen;
`OnUpdateTerrainsEnd` is raised once at the teleport's tail, after the
first destination pixel, where DFU raises it after every terrain update
- nothing is missed, later pixels take the installed cache; the
`?season` pin (a dev door) moves the drawn archive and not the mod's
season, so under it the classic flats draw. Unverified in this
container: the all-or-nothing rule against the REAL record counts of
`TEXTURE.504`-`510` (the mod's sets reach records 31-37 per prefix; the
counts need ARENA2, which the container lacks), and any picture at all
- there is no probe for this mod. **Mac: the permission record in
`vendor/seasons-iliac-bay/README.md` is still the placeholder line.**
