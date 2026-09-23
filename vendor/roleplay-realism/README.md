# Roleplay & Realism 1.8 - Hazelnut (ported 1:1, in slices)

**Roleplay & Realism 1.8** for Daggerfall Unity, by **Hazelnut** (Nexus
mod 16; every script's header: MIT). The mod's own description:
"Modular roleplay and realism: gameplay modifications." ContactInfo:
https://forums.dfworkshop.net.

Mac (Lattymoy) handed the shipped zip
(`RoleplayRealism-1.8-16-1-8-1721491697.zip`) over on 2026-09-23:
"lets also get this integrated alongside this".

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line. The code is
MIT by every script's header; the seven NPC textures under Textures/
are the author's own art and carry no licence line of their own.]**

## What is here

- `roleplay-realism.dfmod.json` - the bundle's manifest, verbatim
  (title `RoleplayRealism`, version 1.8, DFUnity 1.0.0, GUID
  `d828b782-46e9-40e7-8ae6-19cde308032e`, the 51 files it was built
  from).
- `modsettings.json` - the shipped settings: three sections (Modules,
  EnhancedRiding, RefinedTraining), 28 keys; `modpresets.json` the
  mod's presets; `indexButtons.txt` the training window's button
  index.
- `RoleplayRealismModData.csv` - the string table: the fort's three
  texts, the armorer's, the climbing refusal, the three faction names,
  the two guilds' expulsion lines, the training window's.
- `Scripts/` - the seven scripts, verbatim from the author's
  repository (`ajrb/dfunity-mods` @ `0af2ec9`, `RoleplayRealism/
  Scripts/`, 2024-07-21 - the day after the Nexus 1.8 upload):
  `RoleplayRealism.cs` (1,096 lines), `EnhancedRiding.cs`,
  `GuildServiceTrainingRR.cs`, `FightersGuildRR.cs`,
  `ThievesGuildRR.cs`, `DarkBrotherhoodRR.cs`, `CureDiseasePotionRR.cs`.
  The shipped bundle carries a compiled DLL and no source; the
  repository's source at that commit is taken as the shipped 1.8 (the
  bundle's own manifest, settings and string table are what is
  vendored here, from the same repository - RECORD OPEN: the zip was
  not on disk in the session that vendored this, so the diff Items'
  record carries has not been run for this one).

## The textures (RR2)

`Textures/197_N-0.xml` (seven) are the mod's own billboard scales,
verbatim; the seven `197_N-0.png` sprites (the variant shop and tavern
keepers) and the seventeen `Textures/Buttons/BUTTONS.RCI_21..37-0.png`
records (the training window's "5 Days" and the rest of `indexButtons.
txt`) ship under `public/art/roleplay-realism/`, the PNG bytes the
source tree carries at `0af2ec9`, unchanged. They carry no licence
text of their own (the MIT header is the scripts') - granted, as the
Mod-Registry row records. Both are what the mod's manifest names.

## The quests (RR3a)

`Quests/QuestList-RoleplayRealism.txt` and `Quests/RRMSTARM0-2.txt`,
verbatim from the source tree (MIT, the mod's own header). The pack
loader globs them beside DFU's own (`src/scenes/questData.js`).

## The world data (RR3b)

`WorldData/locationnew-RRfort01-16.json`, `WorldData/RRFORT01.RMB.json`
and `WorldData/ARMRAM03.RMB-765-building14_master.json`, verbatim from
the source tree - DFU's WorldDataReplacement JSON (a new location, its
block, a building variant), read by `src/formats/worldDataReplacement.js`
through `src/scenes/modWorldData.js`'s glob. Everything the mod ships is
vendored now.

## What is ported, and where

- **RR3b** (2026-09-23): the Master Armorer quest line's world data -
  WorldDataReplacement.cs ported whole (`src/formats/worldDataReplacement.js`
  + `worldDataDoor.js`), MapsFile and BlocksFile asking it, RMBLayout's
  replacement arm in the building merge, the variants on the save.
- **RR3a** (2026-09-23): the Master Armorer quest line's registrations -
  `src/systems/rrQuestLine.js` (the tables, the factions, the fort's
  tracks, the shop's discovery, the custom armor service) over four DFU
  mod hooks ported for it: `registerCustomFaction`, `registerQuestList`,
  `registerMerchantService`, `systems/worldDataVariants.js` + the
  quest machine's WorldUpdate.
- **RR2** (2026-09-23): the NPC sprite variants (`src/systems/
  rrVariants.js`), EnhancedRiding and RefinedTraining (laws in
  `rrRealism.js`; the mount rig, the look filter, the move axes, the
  guild training flow and the world host carry the seams).
- **RR1** (2026-09-23): the formula overrides and the rule modules -
  `src/systems/rrRealism.js` (the laws), `src/systems/rrInstall.js`
  (InitMod's registrations at the scene boot), the seams they hang on
  in formulas, climbing, the weapon rig, banking, the ship, the magic
  round, potions, the guilds, the interior context and the world host.
  `bible/06-Systems/Roleplay-Realism.md` is the page.
