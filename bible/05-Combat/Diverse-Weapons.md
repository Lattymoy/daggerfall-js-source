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

## Not carried, said plainly

**The icons.** `233`/`234` by metal and `432`/`433` for the Wabbajack
are asked for in DFU through `ItemHelper.GetItemImage` with the item's
**dye** in the name (`TextureReplacement.GetName` :725-736,
`233_5-0_Elven`; `TryImportTexture(archive, record, 0, item.dyeColor,
...)` :240-243, no undyed fallback). The port's replacement index keys
without a dye (`textureKey`) and its icon doors ask without one
(`decodedTexture(archive, record, 0)`), and two dyed names differing
only in dye collide there today. That is a second slice on the icon
pipeline - a dye-aware key, the item's dye at the three icon doors, and
the bundle's icons registered as vendor entries - and not this one.

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

## Record

`vendor/diverse-weapons/` - the script verbatim, the manifest verbatim
(12,937 files), the preset verbatim, the zip's readme. Campaign
`tools/mutants/dw1.json` (21: 20 dead, 1 equivalent as recorded). Suites
`test/dw1_diverseweapons.test.js`, `test/unitybundleworker.test.js`,
`test/dw2_shipped.test.js`. The shipped set: `public/art/diverse-weapons/`
(12,624 PNGs), `src/combat/diverseWeaponsIndex.js` (generated), the two
tools.
