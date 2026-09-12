# Meaner Monsters 1.5.2 - Ralzar (ported 1:1)

The files beside this note are the data of **Meaner Monsters v1.5.2**
for Daggerfall Unity, by **Ralzar** (the source header: "Copyright (C)
2020 Ralzar", "Author: Hazelnut & Ralzar"; forums.dfworkshop.com - the
manifest's ContactInfo; source at github.com/Ralzar81/Meaner-Monsters).
The mod's own description: "Buffs many monsters. Debuffs rats, bats and
zombies."

**Licence:** MIT, per the source file's header ("License: MIT License
(http://www.opensource.org/licenses/mit-license.php)"). Mac (Lattymoy)
handed the shipped zip over on 2026-09-12 to integrate 1:1.

## What is here

- `MeanerMonsters.dfmod.json` - the shipped bundle's manifest (title,
  version 1.5.2, author, contact, DFUnity 1.0.0, GUID, the forty-seven
  files it was built from, one optional dependency: Unleveled Mobs).
  Identical to the repository's.
- `xml/Werewolf/264_<0..14>-0.xml`, `xml/Wereboar/269_<0..14>-0.xml`,
  `xml/AlternateDragon/295_<0..14>-0.xml` and `096_0-0.xml` - the
  forty-six sprite-scale files, verbatim from the bundle's TextAssets:
  `<info><scaleX>..</scaleX><scaleY>..</scaleY></info>`, 1.2 for the
  werewolf and wereboar, 2.5 for the dragonling, 2 for its corpse.

## What is NOT here, and where it went

The mod's code. The shipped bundle carries a compiled `Meaner
Monsters.dll` (10,752 bytes); the repository carries the
`MeanerMonsters.cs` it was compiled from (master = 1.5.2), and the DLL
decompiled agrees with it row for row. Neither is carried; the port is
`src/characters/meanerMonsters.js` (InitMod's table, folded as its loop
folds it, the xml table, the switch) applied at the row a foe is minted
from, and `src/world/billboardXml.js` (DFU's SetBillboardScale). The
page is `bible/04-Characters/Meaner-Monsters.md`.

Not carried: the Unleveled Mobs arm (two wilderness encounter tables
rewritten when that mod is loaded) and the DEX warning boxes - neither
mod is in the port; the arm's condition becomes Unleveled Mobs' own
switch the day it is integrated.
