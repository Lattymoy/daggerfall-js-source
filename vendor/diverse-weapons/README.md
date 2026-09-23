# Diverse Weapons 1.7.3 - RealAKP (ported: the flag, and the law it switches on)

**Diverse Weapons 1.7.3** for Daggerfall Unity, by **RealAKP** (Nexus
mod 242; the script header names **RealAKP & Kirk.O** and the MIT
licence). The mod's own description: "Changes weapon sprites depending
on their type." Its manifest's ContactInfo is the author's Nexus user
page.

Mac (Lattymoy) handed the shipped zip (`Diverse Weapons-242-1-7-3`)
over on 2026-09-23 through a Drive link: "Its a mod integration."

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line. The script is
MIT by its own header; the sprites are the author's paintings and carry
no licence line of their own.]**

## What is here

- `DiverseWeaponsMain.cs` - the mod's one script, verbatim (1,433
  bytes, MIT). It does one thing: `FPSWeapon.moddedWeaponHUDAnimsEnabled
  = true;` in `Start`.
- `diverse-weapons.dfmod.json` - the bundle's manifest, verbatim
  (title, version 1.7.3, author, DFUnity 1.1.1, GUID
  `8e83d67c-a0ac-4935-a8c5-6b18c9f35bfc`, and the 12,937 files it was
  built from: the script, this manifest, the preset below, and 12,934
  textures).
- `weapon-widget-preset.json` - the "Diverse Weapons" settings preset
  the bundle carries FOR WEAPON WIDGET, verbatim: "Recommended settings
  for DW". The readme says "For Weapon Widget users, select Diverse
  Weapons settings preset in Weapon Widget mod options."
  `src/combat/diverseWeapons.js` restates it as the store's own keys
  and lays it over the player's Weapon Widget settings while the mod's
  `WeaponWidgetPreset` switch is on (their own values kept underneath).
- `Readme.txt` - the zip's own readme, verbatim.
- This note.

## What is NOT here, and why

**The 12,934 textures.** They are the whole of the mod - a first-person
sprite set PER WEAPON TEMPLATE (eighteen weapons, ten metals, plain and
enchanted, every record and frame: `LONGSWORD.CIF_3-2_Dwarven`), Weapon
Widget's double-scale idle for each (`w_LONGSWORD.CIF_0-0_Iron`), the
inventory and paper-doll icons in every metal (`233_5-0_Elven`,
`234_5-0_Elven`), the Wabbajack's own set and its artifact icon
(`WABBAJACK.CIF`, `432_25-0`, `433_25-0`), and replacements for the
classic flail and battle-axe archives (`WEAPON06.CIF`, `WEAPON08.CIF`)
that another mod's custom weapons fall back on. 58 MB.

They reach the game the way Weapon Widget's and Seasons of the Iliac
Bay's do: FROM THE PLAYER'S OWN COPY OF THE MOD, at play time. Attach
the mod's `.dfmod` through the textures pick (the Mods page), and
`src/combat/diverseWeaponsAssets.js` opens the bundle by its GUID and
answers each name Daggerfall Unity asks for. Without the bundle the mod
runs as it runs in DFU with no textures installed: every ask misses,
and the classic frame draws.

The doctrine reason is `bible/01-Overview/Port-Doctrine.md`: the port
ships no mod's art and reads it off the player's copy. (These sprites
are the author's own paintings rather than renders of ARENA2, so the
"a render of game data is game data" ruling that keeps Weapon Widget's
and Seasons' repaints out is not what keeps these out; the size is, and
the same door already existed.)

**Two archives the port never asks for.** The bundle carries
`513_*` and `514_*` (two records, ten metals each) - custom-item
archives another mod (Roleplay & Realism: Items) registers; the port
has no such items, so nothing resolves to them. And a handful of `w_`
names with typos in the mod's own file list (`w_BROADSWORDD.CIF`,
`w_DAIKATANAGIC.CIF`, `w_DCLAYMORE.CIF`, `w_LBROADSWORDMAGIC.CIF`,
`w_LCLAYMOREMAGIC.CIF`) - dead files in the bundle, asked for by
nobody.

## What the port carries, and where

The mod's flag and Daggerfall Unity's own law behind it - the record is
`bible/05-Combat/Diverse-Weapons.md`:

| DFU | port |
|---|---|
| `FPSWeapon.moddedWeaponHUDAnimsEnabled` (FPSWeapon.cs:97) | `moddedWeaponHUDAnimsEnabled()` - the mod's `Enabled` switch |
| `WeaponBasics.GetModdedWeaponFilename` | `moddedWeaponFilename(item)` - the three tables, verbatim |
| `FPSWeapon.GetWeaponTextureAtlas` :637-644 (the name choice) | `atlasFileName(item, classic)` |
| `GetWeaponTextureAtlas` :647 (`TryImportCifRci` per frame) | `loadFpsWeaponArt` (the base lane) and the widget clone's `customTexture` |
| `TextureReplacement.GetNameCifRci` :795-801 | the `<FILE>_<record>-<frame>_<Metal>` spelling, in both |

**Not yet carried: the inventory and paper-doll icons** (`233`/`234`
by metal, `432`/`433` for the Wabbajack). DFU asks for those through
`ItemHelper.GetItemImage` with the item's dye in the name
(`TextureReplacement.GetName` :725-736, `233_5-0_Elven`); the port's
replacement index is keyed without a dye today, so that half is a
second slice on the icon pipeline, recorded in the bible.
