# Roleplay & Realism: Items 1.3 - Hazelnut & Ralzar (ported 1:1, in slices)

**Roleplay & Realism: Items 1.3** for Daggerfall Unity, by **Hazelnut &
Ralzar** (Nexus mod 61; every script's header: MIT). The mod's own
description: "Modular roleplay and realism: item, loot and gameplay
modifications." ContactInfo: https://forums.dfworkshop.net.

Mac (Lattymoy) handed the shipped zip
(`RoleplayRealism-Items-1.3-61-1-3-1707669833.zip`) over on 2026-09-23:
"lets also get this integrated alongside this".

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line. The code is
MIT by every script's header; the 280 sprites are the authors' own art
and carry no licence line of their own.]**

## What is here

- `roleplay-realism-items.dfmod.json` - the bundle's manifest, verbatim
  (title `RoleplayRealism-Items`, version 1.3, authors, DFUnity 1.0.0,
  GUID `68589945-3fbb-4d58-81a3-3066f3f08539`, the 517 files it was
  built from).
- `modsettings.json` - the shipped settings: one section, eleven
  modules.
- `ItemTemplates.json` - the fourteen custom item rows (513-526) and the
  twenty patches to classic rows the mod merges at load.
- `RoleplayRealismItemsModData.csv` - the string table: the three name
  prefixes and the nine new spells' names.
- `Scripts/` - the fifteen scripts, verbatim from the authors'
  repository (`ajrb/dfunity-mods` @ `0af2ec9`,
  `RoleplayRealismItems/Scripts/`): the mod (`RoleplayRealismItemsMod.cs`,
  1,178 lines) and the fourteen item classes. The shipped bundle
  carries the compiled DLL and no source; its manifest, settings,
  templates and string table were diffed against the repository's and
  are identical, so the repository's source at that commit is taken as
  the shipped 1.3.

## Where the art is

The bundle's 280 textures - the fourteen items' inventory and paper-doll
sprites in every metal (`520_10-0_Iron`, the bare name for leather),
the helmet's paper-doll masks (`522_13-0_Mask`) and the two weapons'
two records - ship with the port under `public/art/roleplay-realism-
items/`, by the exact name Daggerfall Unity asks for, the way Diverse
Weapons' do: re-encoded from the bundle's Texture2D objects by
`tools/rriExtract.mjs` as indexed PNG where the picture fits one (99
of them) and RGBA where it does not, each file read back and compared
to its texel before the next is written - every drawn pixel identical.
The `<rect>` beside 232 of them (the paper-doll placement
`TextureReplacement.OverridePaperdollItemRect` reads) is written into
`src/systems/rriIndex.js` beside each sprite's size. What the folder
may hold is this manifest's own file list (`test/doctrine.test.js`
derives the folder's membership from it).

## What is ported, and where

- **RRI1** (2026-09-23): the fourteen item classes as
  `src/systems/rriItems.js` (DFU's virtuals, dispatched from each of the
  port's law sites), the template rows and patches, the art on the
  texture-replacement door, the random makers' custom slots
  (`newWeapons`, `newArmor`). `bible/06-Systems/Roleplay-Realism-Items.md`
  is the page.
- The mod's other nine modules (loot tables, bandaging, condition
  prices, store condition, enemy kits, starting kits and spells, weapon
  balance, alchemist potions) follow in RRI2.
