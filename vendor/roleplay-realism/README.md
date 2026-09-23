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

## Not vendored yet

The seven `197_N-0` textures (the variant shop and tavern NPCs, RR2),
the three quests and the quest list (RR3), the two world-data files
and the building variant (the Northrock Fort and the master armorer's
shop, RR3).

## What is ported, and where

- **RR1** (2026-09-23): the formula overrides and the rule modules -
  `src/systems/rrRealism.js` (the laws), `src/systems/rrInstall.js`
  (InitMod's registrations at the scene boot), the seams they hang on
  in formulas, climbing, the weapon rig, banking, the ship, the magic
  round, potions, the guilds, the interior context and the world host.
  `bible/06-Systems/Roleplay-Realism.md` is the page.
