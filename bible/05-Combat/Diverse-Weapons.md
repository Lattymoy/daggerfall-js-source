# Diverse Weapons 1.7.3 - RealAKP (DW1)

*2026-09-23. Mac, with the shipped zip over a Drive link: "Its a mod
integration."*

**Diverse Weapons** (Nexus 242; script by RealAKP & Kirk.O, MIT) -
"Changes weapon sprites depending on their type." A first-person sprite
set **per weapon template** where the classic art has one per weapon
*class*: eighteen weapons, ten metals, plain and enchanted, every
record and frame; Weapon Widget's double-scale idle for each; the
inventory and paper-doll icons in every metal; the Wabbajack's own set.
12,624 sprites, 58 MB.

## The mod is one line

```csharp
FPSWeapon.moddedWeaponHUDAnimsEnabled = true;   // DiverseWeaponsMain.cs:37
```

Everything that line switches on is Daggerfall Unity's own. So this is
a port **of DFU**, gated on a vendored mod's switch, plus a door that
reads the sprites off the player's copy of the bundle. Nothing in the
port is the mod's code.

## The law, and where it lives

| DFU | port |
|---|---|
| `FPSWeapon.moddedWeaponHUDAnimsEnabled` (FPSWeapon.cs:97) - a static, false until a mod sets it | `moddedWeaponHUDAnimsEnabled()` - the mod's `Enabled` switch (`combat/diverseWeapons.js`) |
| `WeaponBasics.GetModdedWeaponFilename(item)` - three tables: the named artifact CIFs, `<NAME>MAGIC.CIF`, `<NAME>.CIF`; a custom template answers `""` | `moddedWeaponFilename(item)`, verbatim, the Staff arm's loop included |
| `FPSWeapon.GetWeaponTextureAtlas` :637-644 - the per-template name when the flag is on and a weapon is in hand, else `GetWeaponFilename` | `atlasFileName(item, classic)` |
| :647 - `TryImportCifRci(name, record, frame, metalType)` for every frame; a hit replaces that frame | `loadFpsWeaponArt` (base lane) and the widget clone's `customTexture` |
| :398-399 - an imported frame is drawn into the **classic record's** box | `loadFpsWeaponArt` keeps `size.width/height` from the CIF |
| `TextureReplacement.GetNameCifRci` :795-801 - `<FILE>_<record>-<frame>_<Metal>`, None unsuffixed | the spelling in both lanes; `MATERIAL_NAMES` is `MetalTypes` index for index |
| `WeaponManager` :1090/:1097/:1107 - `SpecificWeapon` is the readied hand's item | the rig's `playerWeapon.weapon`, handed to the loader and read by the clone |

**Two lanes, one law.** The port draws the first-person weapon down
its own `FPSWeapon` (`combat/fpsWeapon.js`) and down the Weapon Widget
clone that is the default renderer (`combat/weaponWidget.js`). In DFU
both read the same static and the same texture folder; here both call
`atlasFileName` and ask `customWeaponImage`.

**The art cache grew a key.** The rig cached art by
`${type}:${material}`. Under this flag a longsword and a broadsword are
the same `WEAPON_TYPES.LongBlade` with different sprite sets, an
enchanted one a third, and the flag going off mid-game a fourth - so
the key carries the name the atlas is asked by.

## The sprites ship with the port (DW2)

Mac, the same day: "this needs to be in the codebase, not an attachable
file". So the 12,624 sprites are under `public/art/diverse-weapons/`,
by the exact name DFU asks for, the way Shield Widget's 600 are under
`vendor/shield-widget/Textures/`: re-encoded from the bundle's
Texture2D objects by `tools/diverseWeaponsExtract.mjs` as indexed PNG
where the picture fits one and RGBA where it does not, each file read
back and compared to its texel before the next is written - every drawn
pixel identical, every hidden pixel hidden. Under `public/` rather than
`vendor/` because that many files through the bundler's `new URL` glob
is a 12,624-entry map in a chunk; `public/` is served as it is, and the
URL is computed off the app root (`systems/appRoot.js`, the held map's
shape). What the folder may hold is the mod's own manifest:
`tools/diverseWeaponsIndex.mjs` derives the door's index from it (1,298
stems with a bitmask over MetalTypes' order - 39 KB where the names are
350) and `test/doctrine.test.js` derives the folder's membership from
it, so a name the set lacks is a miss without a fetch and a file the
bundle did not ship cannot land there. The player's own `.dfmod`,
attached, still answers first - a newer version's art wins.

With no sprite for a name (the classic `WEAPON04.CIF` archives nothing
was painted for, `w_` past record 0) the ask misses and the classic
frame draws, exactly as in DFU with no texture installed.

## The door

`combat/diverseWeaponsAssets.js`, the widget door's shape: a name list
and a loader from the textures pick, the bundle opened once by its
manifest's GUID (`8e83d67c-a0ac-4935-a8c5-6b18c9f35bfc`), a texture by
name. Two things differ from the widget's:

- **The textures are indexed at open.** 12,934 of them; the widget's
  `find` per ask would walk them all for every frame of every weapon.
- **`customWeaponImage(name)` walks both doors**, this mod's first.
  DFU has one folder every mod's files land in; the port has one door
  per mod. This mod carries whole animation sets; Weapon Widget carries
  double-scale idles for the classic archives. The first that carries
  the name answers.
- **The open runs in a Worker.** The bundle is 58 MB of LZ4 around
  1.69 GB of pixels in one serialized file (12,934 textures inline, no
  `.resS`), and indexing it is ~10 s of decompression. Two changes
  carry it: `formats/unityBundle.js` keeps the blocks COMPRESSED (a
  file is a byte source, `read(offset, length)` decompresses only the
  blocks a range spans through a 32-block LRU - the whole bundle is
  never in memory), and `formats/unityBundleClient.js` opens it in a
  module Worker (`formats/unityBundleWorker.js`) in the terrain
  worker's shape: the bytes cross as a copy, the index (text assets
  whole, textures by name and size) comes back, and each texture's
  pixels cross on demand, transferred, and are flipped into color32
  order on this side. The fallback is the same reader on this thread
  (no Worker, a factory that throws, a worker dead before its index,
  `?bundlethread=off`); a worker dead after its index makes every ask
  a miss, which is the classic frame. Weapon Widget's small bundle
  keeps its in-thread door.

Driven on the real bundle when written: opens in ~10 s (node, in-thread), 12,624
textures indexed, `LONGSWORD.CIF_0-0_Iron` 60x86,
`LONGSWORD.CIF_3-2_Daedric` 320x99, `w_LONGSWORD.CIF_0-0_Iron` 120x172,
`233_5-0_Elven` 56x17; a name nothing carries misses. The filename
tables regenerate cell for cell from `WeaponBasics.cs` (the pin skips
without a DFU checkout, PY1's way).

## The `w_` ask falls through - a reading, said out loud

Weapon Widget's atlas arm asks with the `w_` prefix under
DoubleScaleTextures and the plain name otherwise. Its own bundle has
`w_` idles only, so under the module a strike frame's ask misses and
the classic draws - which is what the mod does alone.

Diverse Weapons ships whole animation sets under the **plain** names
and `w_` idles beside them, and its readme sends Weapon Widget users to
a preset that turns DoubleScaleTextures **on**. Under an either/or that
preset would discard every strike frame the mod paints. So the `w_`
ask falls through to the plain one (`customTextureNames`), and the
preset means what its author meant.

The port's evidence, since Weapon Widget's IL is not carried: its
record (`Weapon-Widget.md`) names `GetWeaponFilename` and
`TryImportCifRci` among the members the clone calls and does not name
`GetModdedWeaponFilename`; but the clone's own atlas cache is keyed on
the weapon's **template** (`LoadWeaponAtlas` 0x29a8,
`currentTemplateIndex`), which a per-class atlas would have no reason
to be. Taken as the clone reading the same static, gated the same way.

## The preset

The bundle carries a "Diverse Weapons" TextAsset - a **Weapon Widget
settings preset**: "Recommended settings for DW". Nine modules on,
TrueTextureSize at factor 1 so the frames draw at their painted size,
DoubleScaleTextures for the `w_` idles, a bob of 142, recoil on every
condition. The readme: "For Weapon Widget users, select Diverse Weapons
settings preset in Weapon Widget mod options."

DFU's preset picker **overwrites** the player's values. The port lays
the preset over them while the mod's `WeaponWidgetPreset` switch is on
(`withDiverseWeaponsPreset`, at `readWidgetSettings`) and leaves their
own underneath, so turning it off gives them back; Weapon Widget's
`Enabled` is never in it. **Off by default** - a preset nobody selected
is not selected. `flattenModPreset` is the general reader for DFU's
`{ Values: { Section: { Key: "string" } } }` shape, coercing by the
declared key's kind ("False" is `false`, not a non-empty string).

## The icons (DW3)

`233`/`234` by metal and `432`/`433` for the Wabbajack are asked for in
DFU through `ItemHelper.GetItemImage` with the item's **dye** in the
name: `color = (int)item.dyeColor` (:402), then
`TryImportTexture(archive, record, 0, item.dyeColor, Albedo)` (:458),
whose name `TextureReplacement.GetName` (:725-735) spells
`archive_record-frame[_Dye][_Map]` - the dye for every value but
`Unchanged`, and `Unchanged` **is 18, which is `Silver`**, so a silver
weapon asks by the bare name and a `_Silver` file can never be asked
for. An imported texture is assigned as it is - no `ChangeDye`, no mask
strip - and there is no bare fallback for a dyed ask.

The port's replacement key dropped the dye (`textureKey` was
`archive_record-frame[_map]`, so a pack's `233_5-0_Iron` and
`233_5-0_Daedric` collided on one entry), and none of its three icon
doors carried one. DW3:

- `characters/dyes.js` `DYE_NAMES` / `dyeToken` - GetName's dye arm;
  `systems/textureReplacement.js` `textureKey(archive, record, frame,
  map, dye)`, and `hasTextureReplacement` / `decodedTexture` /
  `decodedTextureTopDown` ask by it; a vendor entry may carry a `gate`
  read at lookup.
- `systems/itemDye.js` `itemDyeColor(item)` - `DaggerfallUnityItem
  .dyeColor` as the port's items carry it: a weapon's `dyeColor`
  (CreateWeapon :412), an armor's by material (CreateArmor :510,
  `armorDyeColor` verbatim), clothing's `dye`, an artifact's `Unchanged`
  (SetArtifact :611, the last writer), else `Unchanged` (SetItem :559).
  `inventoryItemImage` carries it as `dye`.
- The three doors ask by it: the GL lists (`ui/itemScroller.js`,
  `ui/nativeInventory.js` -> `dataPipeline.uploadRecord(..., { dye })`,
  which uploads a dyed swap under its own `#ui_<Dye>` variant and answers
  which; the size stays the classic record's, ItemListScroller.cs:440),
  the DOM screens (`ui/textureCanvas.js requestIcon(..., { dye })`, the
  replacement arm before the classic one), and the paper doll
  (`ui/paperDoll.js loadRecord(..., dye)`: the import arm first, blitted
  as RGBA as the vendor arm is, the remap untouched).
- `combat/diverseWeaponsIcons.js` registers the shipped icons off the
  index as vendor entries by dye (the bare stem for the silver ask; the
  one `_Silver` file skipped, since keyed by its dye it would be the
  bare key; `513`/`514` skipped, no template here draws them), loaded
  from `public/art/diverse-weapons/` when the archive is first drawn -
  `preloadTextureArchive` runs in eight lanes now, 280 icons on 233 -
  and gated on the mod's switch at lookup, so the switch takes effect
  without a reload. Installed at the scene boot (`scenes/shared.js`),
  not at `worldTick`'s module scope, where the mod's law sits in an
  import cycle (a TDZ, caught by `test/tdz.test.js`'s kind of failure
  on the first run).

## Not carried, said plainly

**Two archives nothing asks for.** `513`/`514` are another mod's
custom-item archives (Roleplay & Realism: Items); the port has no such
items. A handful of `w_` names with typos in the mod's own file list
are dead in the bundle.

**The open is still ~10 s of work**, once, the first time a weapon
draws after the bundle is attached - now in the worker, so the frame
keeps painting and the classic frames draw until the index lands. The
reader parses 25,868 objects, half of them Sprites the port never
reads; a reader that skips the Sprite class, or an index cached across
sessions, would shorten it and is left for a follow-up.

## AUDIT-DW (2026-09-23) - the audit of DW1, DW2 and DW3

Mac: *"a proper audit of your previous work."* Three lenses over the
three slices: DFU's law re-read (`FPSWeapon.cs` whole around the atlas,
`WeaponBasics.GetModdedWeaponFilename`, `ItemHelper.GetItemImage`,
`TextureReplacement.GetName`/`GetNameCifRci`), the port's own seams (the
rig's cache, the widget clone's draw, the three icon doors, the pipeline's
icon upload, the boot order of the icon install against the archives),
and the player's view on a site where every sprite is a fetch. Checked
and standing: the filename tables (44 cases regenerated against the C#,
with `DFU_PATH`), the atlas name choice and its `SpecificWeapon != null`
gate, the per-frame ask's spelling and `MetalTypes.None`, the classic
box an imported frame is drawn into, the attached-then-shipped-then-miss
order of the door, the index against the manifest both ways, the dye
arm's one exception (Silver is Unchanged), the item's dye at the doll
(the artifact's Unchanged), the install's site. Four findings:

- **F1 - the icon door decoded the whole archive before the first
  classic icon.** `getTexture(233)` awaits `preloadTextureArchive` before
  it publishes the archive, and DW3 had registered 280 icons on it, so
  the first inventory drew nothing - not even the classic icons - until
  all 280 had come down (measured at eight lanes: seconds on a phone).
  DFU imports an icon when `GetItemImage` asks and never earlier. A vendor
  entry may be `lazy` now: the archive preload skips it, and
  `preloadTextureRecord(archive, record, frame, map, dye)` decodes ONE
  record on demand (idempotent, the asks in flight share a fetch, a
  gated-off icon costs none). The three doors make that ask per record:
  the GL lists through the pipeline's `preloadRecord` before the upload,
  the DOM door in its replacement arm, the doll before its blit. A pack's
  entries (not lazy) preload with the archive as before. Pinned by
  execution on the list drawer (the order of the three calls) and on the
  door (three records, three fetches, nothing else).
- **F2 - a weapon's custom frames were fetched one after the other.**
  `loadFpsWeaponArt` awaited each frame's ask inside the loop - a
  longsword's 26 frames were 26 round trips in a row, and the rig has no
  art to draw until the loader returns, so the weapon was invisible for
  the whole run. `customFrames` asks every frame together and answers
  `[record][frame]`; a rejected ask is that frame's miss. Pinned by
  execution: six asks out before the first answers.
- **F3 - a plain name through the `w_` fall-through drew doubled.** The
  clone doubles a custom idle's box under DoubleScaleTextures because a
  `w_` texture IS double size; DW1's fall-through can answer the plain
  name where a `w_` is missing (a metal the mod skipped), and that
  texture then drew at twice its size. A hit carries which name answered
  (`doubled`), and only a `w_` texture takes the doubled box. Pinned on
  the clone's bench, both ways.
- **F4 - named, not changed: DFU keeps the first template's custom frames
  within a class and metal.** `FPSWeapon` reloads its atlas only when
  `WeaponType` or `MetalType` change (`FPSWeapon.cs:138`) and caches the
  custom animation by the CLASSIC file name and metal (`:743-750`, two
  slots), so in DFU a steel broadsword drawn after a steel longsword
  wears the longsword's Diverse Weapons set until the class or metal
  changes. The port keys the rig's cache by the name the atlas is asked
  by (`weaponRig.js`), so each template draws its own - the mod's
  purpose over DFU's cache slot. Recorded at the key, and here.

Suite `test/auditdw.test.js` (5). Mutants: the archive preload taking
lazy entries, a frame awaited alone, the doubled flag ignored, the
per-record ask dropped - all dead.

## Record

`vendor/diverse-weapons/` - the script verbatim, the manifest verbatim
(12,937 files), the preset verbatim, the zip's readme. Campaign
`tools/mutants/dw1.json` (21: 20 dead, 1 equivalent as recorded). Suites
`test/dw1_diverseweapons.test.js`, `test/unitybundleworker.test.js`,
`test/dw2_shipped.test.js`, `test/dw3_icons.test.js`, `test/auditdw.test.js`. The shipped set: `public/art/diverse-weapons/`
(12,624 PNGs), `src/combat/diverseWeaponsIndex.js` (generated), the two
tools.
