# Vanilla Enhanced (VE1-VE4, 2026-10-05)

Asked 2026-10-05: "I want to implement the vanilla enhanced textures but the
file is way too large to post here."

The file never had to be posted. carademono's **Vanilla Enhanced** (Nexus
Mods, Daggerfall Unity mod 273, 3.5.0 there) keeps its whole source in a
public repository, github.com/drcarademono/vanilla-enhanced (its manifests
read 3.4.7), and the session read the mod's shapes off that tree.

VE1-VE3 had the player attach it, because Port-Doctrine kept it out. Mac then
approved carrying it: he chose "Bundle the files in the repo", answered
"Approved and yes", and said "Put it in the codebase". **VE4 ships three of
its mods** under the one exception the doctrine records (below).

## What the mod is, and why it needed an exception

Five manifests stand in its tree:

| Manifest | Depends on | What it carries |
|---|---|---|
| Vanilla Enhanced - Base | World of Daggerfall - Biomes, World of Daggerfall, RMB Resource Pack (all optional) | the eleven terrain tile sets (002-004, 102-104, 302-304, 402-403) TWICE - each a `<archive>-TexArray` (BC7, GraphicsFormat 108, 256 px, 56 slices) and its 56 PNGs; the nature flats 500-511 and the flats of 005, 105, 106, 194, 195; the city walls 017/018 in four climates; twenty dungeon archives; ten Materials and their rock pictures, over World of Daggerfall's and the RMB Resource Pack's models - 1,268 files |
| Vanilla Enhanced - Masked Roads | Base (required), World of Daggerfall - Biomes (optional) | the eleven tile sets again, and records 46, 47 and 55 of 103/303/403 |
| Vanilla Enhanced - Snowless Swamps and Jungles | Base (required), Masked Roads and World of Daggerfall - Biomes (optional) | 402 and 403 again, array and records, and the winter records of twelve swamp architecture archives (408-470) |
| Vanilla Enhanced - Winter Tracks | Base (required) | thirty winter records of 103, 303 and 403 |
| Kokey's Temperate | nothing | TEXTURE.302's 56 records, no array |

Its pictures are Daggerfall's own, repainted. The manifest calls them
"Remastered vanilla textures", and its flats' readme says "repainted by me,
keeping as close to the original art as possible". That is Port-Doctrine's
own case (A RENDER OF GAME DATA IS GAME DATA; `test/doctrine.test.js` holds
`public/` to it). An author's permission cannot answer it alone, because the
art underneath is not the author's to give. Nor can the port BUILD the
pictures, the way DS1 and LPT1 rebuilt their borrowed pictures from the
player's own records (`formats/derivedTexture.js`): a spec paints a copy, a
crop or an edit laid on a record, and a repaint is none of those.

So VE3 went the way Seasons of the Iliac Bay's re-shaded flats and DREAM
went: the player attached their own `.dfmod` files through the texture-mod
door DFMOD1 built (`systems/dfmodTextures.js`, PR #437), and the Texture
Overhaul card wore them. VE4 replaces the attach with the shipped pack, on
Mac's approval. The doctrine's exception paragraph names
`public/art/vanilla-enhanced/` and nothing else (VE4, below).

Reading the mod against that door found it two laws short of DFU. Both
belong to the door, not the mod, so every texture mod gets them, shipped or
attached.

## VE1 - DFU's load order

**THE DEFECT.** Where two attached mods carried one name, the door kept the
FIRST by file name, and it read no dependency at all. DFU answers with the
mod loaded LAST: `ModManager.TryGetAsset` walks `EnumerateEnabledModsReverse`
(ModManager.cs:404-415, :1146-1153), and `AutoSortMods` (:1059-1082) loads
every mod after the mods it depends on. Vanilla Enhanced's add-ons are BUILT
on that law: Masked Roads and Snowless Swamps carry the Base's own names -
all eleven arrays, 402 and 403, records 46/47/55 - to replace them. Under
the old door the Base won every one, and both add-ons did nothing.

**THE LAW, PORTED** (`dfmodLoadOrder`):

- the base order is the Mods folder's listing - `Directory.GetFiles` gives
  the initial `LoadPriority` (:563-592) - by file name;
- `AutoSortMods` is `TopologicalSort` (:1261-1288) over each mod's
  dependencies `where !dependency.IsPeer`, resolved by `GetModFromName`
  (`Mod.FileName`, the `.dfmod`'s name without its extension -
  `GetModNameFromPath` :1236-1241) with the missing dropped. An OPTIONAL
  dependency that is attached orders too - only peers are free. The visit
  is depth-first in the base order, a mod's dependencies first;
- a cycle throws in `TopologicalSort`, `AutoSortMods` catches it and keeps
  the order it had - here the base order, with a warning;
- the lookup is TryGetAsset's: every door is filled walking the mods
  switched on LAST-LOADED FIRST, and the first to carry a name keeps it -
  the textures, the billboard xml (XMLManager seeks it by its OWN name,
  whichever mod drew the picture), the IMG and CIF/RCI pictures, and the
  ground's names (VE2).

The stored name index (`dfmod-index/<file>`) carries the manifest's
`Dependencies` as `[name, isOptional, isPeer]` (`manifestDeps`), at index
version 3; a version-2 index is refused and rebuilt in the background, as
GROUND1's version 2 was. The packs card lists the mods in load order, and
says so when more than one is attached.

**VE3's Mod.Enabled rides the same walk.** DFU's mod window switches a mod
off without removing it, and TryGetAsset reads only the mods switched on.
`setDfmodEnabled` switches attached mods on or off and puts every door back
at once; a mod switched off keeps its place in the order and has its bundle
closed (DFU unloads it). The keys switched off live on the port's prefs
shelf (`dfmodOff`); a fresh attach is on (`forgetDfmodOff`, at the attach
and at both removals), and the boot's warm opens only what is on. A set
with every mod switched off puts nothing on the doors and is STILL a
registration: the door's idempotency read its count's truthiness, so the
Classic look would have registered again at every host's boot, bumping
the generation every cache of mod pictures keys on (`_registered !== null`
now).

## VE2 - the ground's tile set, 1:1

GROUND1 read a mod's terrain only as a `<archive>-TexArray`, and kept the
first mod by name. DFU's law is `TextureReader.GetTerrainTextureArray`
(TextureReader.cs:757-803) over `TextureReplacement.TryImportTextureArray`
(TextureReplacement.cs:325-352):

1. **A LOOSE RECORD 0 GOES FIRST.** `!TextureExistsAmongLooseFiles(archive,
   0, 0)` (:847-851) is what lets the mods be asked at all; a folder pick
   that carries `<archive>_0-0.png` sends the archive straight to its
   records.
2. **THE FIRST MOD TO CARRY EITHER NAME DECIDES.** The mods are asked for
   `<archive>-TexArray` and `<archive>_0-0` at once, in load order
   (`TryGetAsset(string[] names)`, :429-442): the first mod carrying either
   decides, its array before its record. Its array at the archive's depth
   EXACTLY (`textureArray.depth == depth`) is the set; an array of another
   depth is logged and refused - GROUND1 cut a deeper one down.
3. **OTHERWISE THE RECORDS.** Each record is sought loose-then-mods
   (`TryImportTexture`, :984-1005), the set made at record 0's size
   (TryMakeTextureArrayCopyTexture :1085-1149) or, when no record 0 is
   replaced, at the classic size (GetTerrainTextureArray's own loop
   :776-795).

`groundSource` answers the decision, `dfmodGroundLayers(archive, tex)` the
set - the hosts hand it the classic TEXTURE file, whose records size the
set when no record 0 is replaced and stand for the records nothing
replaces. The records decode `PRELOAD_CONCURRENCY` (8) at once, as an
archive's preload does - an HD pack's 56 decoded together would all be
held at once. The set is cached per archive and keyed on the loose pick's
generation (`looseTextureGeneration`), so a new folder pick builds it again;
a new mod set empties it.

**WHAT VANILLA ENHANCED DOES WITH IT, ACCORDING TO DFU'S OWN LOOKUP.** The
Base's arrays decide all eleven archives. Masked Roads' arrays decide over
the Base's when it is on - but its 403 array is 57 deep and refused, so 403 is
made of records: its own three road records (46, 47, 55) and the Base's.
Snowless Swamps' 402/403 decide over both.
Winter Tracks carries neither `103-TexArray` nor `103_0-0` (its records
start at 10), so TryGetAsset passes it and meets the Base's array: over
this Base its records are never asked - in DFU as here. Kokey's Temperate
lists BEFORE the Base by file name, so the Base's 302 array decides over it
in DFU's default order, as it does here.

**THE FOUR HOSTS.** `scenes/world.js` and `scenes/exterior.js` - the two
that draw ground - hand `groundTex` and upload what comes back (the grass's
colours are taken off the same cached set, GRASS-LIT2's law).
`scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` are
FLAGGED here and need nothing: they draw no ground, and every other picture
reaches them through the texture door whose order VE1 set.

## VE4 - shipped with the port

**THE EXCEPTION.** Port-Doctrine's A RENDER OF GAME DATA IS GAME DATA now
carries one paragraph, THE ONE EXCEPTION - VANILLA ENHANCED. It records Mac's
approval and names one directory, `public/art/vanilla-enhanced/`.
`test/doctrine.test.js` lists the pack's three directories as BUNDLE_ART rows
like every vendored bundle, each answering both ways to a listing. They are
the first rows whose pixels are a render of game data, so each carries the
mark `derived`. The gate fails in four cases: a derived row outside the
directory the paragraph names, a named directory without a derived row, a row
inside it that does not say derived, and an allow-list row inside it. A second
derived pack needs its own approval, written in the doctrine.

**THE PACK** (`vendor/vanilla-enhanced/README.md`).
`tools/vanillaEnhancedVendor.mjs` reads the repository at commit
`c0c9041c101ba8b57feb93258dda7a37be1b9433` and writes three mods, each in its
own directory: the Base (its manifest's 1,246 PNGs), Masked Roads (its own 9)
and Snowless Swamps and Jungles (its 160). That is 1,436 pictures, 22.4 MB,
byte for byte. Each directory also gets a generated listing of every file's
repository path and sha256, which is the doctrine's authority, and each mod
gets a name index in `buildDfmodIndex`'s shape. Run without `--write`, the
tool checks the committed tree against a clone.

**THE ARRAYS SHIP AS THEIR PICTURES.** The tool decodes every BC7 slice and
looks for the picture it was made from: the mod's own record PNG, else the
repository's source picture for that slice. It carries a slice only within
BC7's error of that picture (mean channel error 1.5, worst channel 48).
Measured at the pin, every slice carried is at most 0.82 / 34 from its
picture. The nearest a road tile comes to the Base record it replaces is
5.20 / 78, so the bounds sit in that gap.
- **Base:** 616 slices, all its own records.
- **Snowless Swamps:** 112 slices, all its own records.
- **Masked Roads:** 533 slices are the Base's records pixel for pixel, 6 are
  its own records, and 21 are road tiles no shipped PNG draws. Those 21 are
  carried as `<archive>-TexArray_<slice>.png` from the repository's sources.
- **Masked Roads' 403 array:** 57 deep. DFU refuses it, so it is indexed with
  its depth and no slices, and the door refuses it as DFU does.

**LEFT OUT:**
- **Winter Tracks:** never reached over the Base's arrays (above).
- **Kokey's Temperate:** Kokey's own mod.
- **Every Material:** Ledger C, A MOD'S MATERIALS.

**THE DOOR** (`setShippedDfmods`). DFU reads these as mods: behind Replace
Game Artwork, after the loose folder, in the order their manifests'
dependencies make. So they register IN the texture-mod door beside the
attached mods, in one AutoSortMods order and one TryGetAsset walk. An add-on
the player attaches that is built on the shipped Base loads after it.
`systems/vanillaEnhancedPack.js` hands the door each mod's index and a client
in unityBundleClient's shape:
- `rgba` fetches the port's own file and decodes it at the texture detail as
  the mip a bundle would pick (`mipFitSize`, mipLevelFor's halving).
- `layers` answers an array from its slices, `PRELOAD_CONCURRENCY` at once.
- **The decode is a worker's** (AUDIT VE P1,
  `systems/vanillaEnhancedDecodeWorker.js`): the fetch, the readback and the
  detail's fit run off the main thread, as an attached bundle's decode does in
  its own worker, and the pixels come back moved, not copied. A browser with no
  OffscreenCanvas in a worker decodes on the page's thread instead - the same
  pixels.

The rules around them:
- **Shadowing:** an attached `.dfmod` under the same key, or with the same
  Title (AUDIT VE R9: DFU loads one mod a Title, so the browser's "(1)"
  download counts), shadows the shipped mod once it is registered (R5), so a
  newer copy from Nexus is the one read. **One switch a mod** (R3, DFU's
  Mod.Enabled by Title): the copy wears the shipped mod's switch, attaching it
  switches it on, and removing it leaves the shipped mod on that switch.
- **On by default (AUDIT VE, Mac: "Ensure this is on by default"):** a
  shipped mod stands at its own default until the player chooses. The Base
  ships ON, as a mod in DFU's Mods folder is; its add-ons ship OFF until they
  are picked on the card. The player's choice, either way, is kept as
  `{ key: on }` on its own shelf entry (`dfmodShipped`); an attached mod's
  switch is still the keys switched off.
- **A clear keeps them:** clearing the attached mods leaves the shipped ones.

The pack goes into the door before anything reads it: the boot seam
(`scenes/shared.js`) and the store's registration (`registerTextureStore`)
do it before the attached mods register. The packs card and the card's own
reads (`doorMods`) do it too, so a menu opened before any host has booted
still finds it. Nothing is fetched until a picture is drawn. The paper doll's
HD compose (DFMOD4) counts the mods the player attached, never the shipped
ones, which carry no doll art.

## VE3/VE4 - the Texture Overhaul card

OVH1b left the card standing empty "until the first texture pack". Vanilla
Enhanced is that pack, beside **Classic** (`systems/vanillaEnhanced.js`,
`systems/overhauls.js`):

- **Classic** is in use when Replace Game Artwork is off, or when no texture
  mod is on and no loose texture pack is attached. Wearing Classic switches
  every texture mod off and keeps it registered; the shipped mods' off is the
  player's choice, kept through every boot after. It never touches the lighting mod, which
  rides the same store and is not a texture mod (the packs card's own split).
  A loose pack has no switch; while one is attached the card reads Custom and
  says where the packs are.
- **Vanilla Enhanced** is in use when its Base is on and Replace Game Artwork
  is on - a fresh game's look (AUDIT VE): the shipped Base is on by default,
  and Replace Game Artwork is on by default, as DFU's own default is. The Base
  is the shipped one, or the player's own copy over it, and the card names
  that copy's version. Wearing it switches on the Base,
  Replace Game Artwork (`Enhancements/AssetInjection`), and the add-ons it was
  last worn with. Other texture mods are left as they are.
- **Its add-ons** are the family's other mods: the shipped Masked Roads and
  Snowless Swamps and Jungles, and any the player attached. While the look is
  worn they stand on the card as On/Off switches (`setVeAddon`), in the PLUS
  rows' shape. Classic remembers which were on (`veAddons`), so the next wear
  brings them back. A fresh game wears the Base alone.
- The effect line is the card's own: it takes effect when the world next
  loads. What is drawn keeps its pictures until its area loads again, and a
  tile set already uploaded stays until PLACE-LRU lets it go (true of every
  texture mod since DFMOD1). What is drawn after a switch is the switch's
  (AUDIT VE R1): a decoded picture answers only the entry it came from, and a
  scene's next ask of an archive it holds decodes what answers now.
- **The store is read before the card** (AUDIT VE R2): the main menu runs
  before any host, so the card and the packs card begin the store's one
  registration and offer no Use until it lands. With a loose texture pack
  attached, Classic says it cannot be worn by a switch (R10). `?nomods`
  registers no attached mod from anywhere; the shipped pack registers either
  way (R11).
- The packs card carries a **Switch off / Switch on** for every texture mod.
  An attached mod also has a Remove; a shipped one says it ships with the
  game.

Online it is the player's own: a texture mod is a picture on one machine,
and nothing of it reaches the wire.

## The departures (Ledger A, the VANILLA ENHANCED row)

1. **The order is always AutoSortMods'.** DFU asks the player to sort when a
   dependency stands below its dependent (`ModLoaderInterfaceWindow
   .CheckDependencies`), and its mod window moves a mod by hand; the port
   has no mod window, so its order is the listing's under AutoSortMods,
   always.
2. **A dependency's name is matched lower case.** DFU's match is Ordinal;
   the store keeps every key lower case (`dfmodStoreKey`), so case cannot be
   told - a mod builder writes the names lower case either way.
3. **A record a records-built set does not replace, or carries at another
   size, is the classic record at the set's size.** DFU leaves that slice
   unset (TryMakeTextureArrayCopyTexture logs it) or throws (SetPixels32 of
   another size) - a hole in the ground either way.
4. **A mod's ground record is decoded at the texture detail** (DFMOD2), with
   no deadline, as the arrays are - the ground is uploaded once.
5. **Mod.Enabled lives on the prefs shelf** (`dfmodOff`), not in a
   Mods.json; a fresh attach is on.
6. **Wearing Vanilla Enhanced turns Replace Game Artwork on.**
7. **Vanilla Enhanced's add-ons ship off** (VE4; AUDIT VE). A mod in DFU's
   Mods folder is on until the player switches it off. The Base ships so - on
   by default (Mac: "Ensure this is on by default") - but Masked Roads and
   Snowless Swamps and Jungles change the roads and the swamps' winters, and
   wait to be picked on the card. Each shipped mod's switch is the player's
   choice either way, on its own shelf entry (`dfmodShipped`).
8. **The terrain arrays draw from the pictures they were compressed from**
   (VE4). DFU decodes the BC7 slices. The port serves each slice from the
   PNG the vendoring proved it within BC7's error of: the same picture,
   without the compression's error.

## Not done

- **The mod's ten Materials** (`2003_4-0`, `2005_2-0`, `2006_0-0`..`2006_7-0`
  - its rocks over World of Daggerfall's and the RMB Resource Pack's
  models). TryImportMaterial seeks a Material by name before any texture;
  the port has no Material reader and indexes none. Ledger C, A MOD'S
  MATERIALS.
- **The 3.5.0 bundles themselves were not read in this session**: Nexus
  refuses this session's network, and the GitHub tree is the Unity project,
  not the built bundles. The port ships the tree's 3.4.7 (VE4); a player's
  3.5.0 copy attaches over it and shadows it. The formats are DREAM's - the
  arrays' GraphicsFormat 108 is the one GROUND1 decodes, and the vendoring
  decoded every one of the tree's arrays - so the shapes are known; a probe
  over a player's real copy is owed.

## Pins

**Tests:**
- `test/ve1_vanillaEnhanced.test.js` (9): the load order against DFU's laws
  and Vanilla Enhanced's own manifests, the index, the walk on every door,
  the switch, the ground's decision and its records' set, the hosts, the card
  with the player's own copies shadowing the shipped ones, and the menu.
- `test/ve4_vanillaEnhancedShipped.test.js` (7): the pack's files, bytes and
  proofs; the index; the door's shipped mods, shadowing and load order; the
  ground over the REAL index, slice by slice, down to which file drew each
  one; the client's detail and concurrency; the card's add-ons; and the
  wiring.
- `test/doctrine.test.js`: two pins on the exception's bound.
- Re-aimed: DFMOD1's door pin (it pinned the first mod by name), its wiring
  pin, GROUND1's door pin (the classic file handed in, the depth law),
  GRASS-LIT2's host pin, OVH1's panel pin and the credits' reachability.

**Mutants:**
- `tools/mutants/ve1.json`: 35, all dead. VE3's three on the attach retired
  with it.
- `tools/mutants/ve4.json`: 24, all dead.
- `tools/mutants/overhauls.json`: its texture-panel record re-aimed by
  content.

**Browser:** `tools/overhaulsProbe.mjs` checks the card in Chromium: Classic
in use on a fresh game, Vanilla Enhanced worn at once, and its add-ons
switched on the card. It also corrects one check that had read plain
Enhanced on the UI card since PLUS-ONLY renamed it Enhanced Plus, and had
failed on every run since.
