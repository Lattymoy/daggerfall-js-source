# Unleveled Loot 1.1.2 - Ralzar (ported 1:1)

The files beside this note are the data of **Unleveled Loot v1.1.2** for
Daggerfall Unity 1.1.1, by **Ralzar** (the source header: "Copyright
(C) 2020 Ralzar"; the manifest's ContactInfo:
https://www.nexusmods.com/daggerfallunity/mods/135; source at
github.com/Ralzar81/Unleveled-Loot). The mod's own description: "Makes
loot and shop stock materials not scale to your level."

**Licence:** MIT, per the source file's header ("License: MIT License
(http://www.opensource.org/licenses/mit-license.php)"). Mac (Lattymoy)
handed the shipped zip over on 2026-09-12 to integrate 1:1.

## What is here

- `UnleveledLoot.dfmod.json` - the shipped bundle's manifest (title,
  version 1.1.2, author, contact, DFUnity 1.1.1, GUID, the three files it
  was built from, and two REQUIRED dependencies, roleplayrealism 1.0.0
  and roleplayrealism-items 0.5.0 - nothing in the code reads either;
  the dependency orders the mod after Roleplay Realism so its two
  FormulaHelper overrides register last).
- `modsettings.json` - its one section, `MaterialSwitching`, ten
  MultipleChoiceKeys (Iron .. Daedric, each defaulting to itself), as
  the bundle ships it, trailing commas and all, which
  `src/systems/modSettings.js` restates under the vendor key
  `unleveledLoot` (plus the port's `Enabled`).

## What is NOT here, and where it went

The mod's code. The shipped bundle carries a compiled `Unleveled
Loot.dll` (11,264 bytes); the repository carries `UnleveledLoot.cs` at
1.1.1. The port's law is the 1.1.2 DLL decompiled, with the source
naming what the decompiler numbered; where they differ (the armour
drop's construction and its condition) the DLL stands. Neither is
carried; the port is `src/systems/unleveledLoot.js`. The page is
`bible/06-Systems/Unleveled-Loot.md`.
