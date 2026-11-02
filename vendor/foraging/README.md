# Foraging 1.7 - Harbinger451 (ported 1:1; its quests, its script, its script's IL and its textures vendored)

**Foraging 1.7** for Daggerfall Unity 1.1.1, by **Harbinger451** (the
shipped archive is `Foraging_1260_1.7`, Nexus mod 1260 by its name; GUID
`603e3883-dbdc-4a5f-8683-6c57e14a331b`; the manifest's ContactInfo is the
author's e-mail, kept out of this note). The mod's own description: "In
the Wilderness "use" a Wood-Axe to chop Wood, a Pick-Axe to mine Gems or
Metals, a Sickle to cut Plants, a Spade to Rob Graves, a Fishing-Net to
Fish, and a Basket to Forage for Food."

Mac (Lattymoy) handed the shipped zip over on 2026-09-28 - "Heres this
for life skills" - and, asked whether the port has the author's
permission, answered "Yes, permission" the same day. It is ported 1:1 as
its own mod (`bible/06-Systems/Foraging.md`, FORAGE0-FORAGE2), and its
tools are to be the online professions' tools
(`bible/06-Systems/Professions-Arc.md`, PROF0).

**Permission: [Mac: record the author's permission, or the link to it,
here - Mac confirmed on 2026-09-28 that Harbinger451 gave it ("Yes,
permission"); the earlier mod records carry the author's own words or a
link in this line.]**

It needs **Quest Actions Extension** (Jagget, 2.0.0,
`github.com/Jagget/QuestActionsExtension` at `56a407e`) for four quest
actions. Nothing of that mod is carried: the port restates the four
actions' behaviour, each cited to it, and credits Jagget.

## What is here

Every file below is the shipped bundle's (`Mods/foraging.dfmod`, a Unity
AssetBundle), taken out of it with UnityPy and kept byte for byte, except
the textures, which the bundle holds as Texture2D and are written here as
PNG at their own size.

| File | sha256 (first 16) |
|---|---|
| the zip, `Foraging_1260_1.7` | `bee577545f5325f2` |
| `Mods/foraging.dfmod` | `29394c1887d0e098` |
| `Foraging.dll` | `3834aa3a313f545c` |

- `foraging.dfmod.json` - the manifest, verbatim: title, version 1.7,
  author, DFUnity 1.1.1, the GUID, and the 33 files it was built from
  (`ForagingMain.cs`, the item templates, 23 quest-pack files, seven
  textures, itself).
- `ItemTemplates.json` - the twelve item templates, 1600-1611, verbatim.
- `Foraging.dll` - the compiled `ForagingMain.cs` (38,912 bytes; the
  bundle carries the build, not the source), byte for byte. The port's
  law is its IL.
- `il/Foraging.il.txt` - that IL, dumped with `tools/ilDump.py`
  (6,551 lines). Every rule the port restates names the offset it was
  read at.
- `Quests/` - the quest list `QuestList-ForagingQuests.txt` and its 22
  quests, verbatim and named as the manifest names them. The six fixes
  the port makes (FORAGE-FIX): four quest-text patches in a table in the
  port's own module (Q7, Q8, Q9, Q13), applied as the quests and the
  list load, and two in the port's own code (Q10, Q11); these files are
  never edited.
- `Textures/` - the mod's seven textures, the author's own pixel art (no
  Daggerfall record): `11600_0-0.png` Wood-Axe, `11601_0-0.png`
  Pick-Axe, `11602_0-0.png` Sickle, `11603_0-0.png` Fishing-Net (128 x
  128), `11604_0-0.png` Wood Bundle, `11605_0-0.png` Egg, `11606_0-0.png`
  Spade (the others 64 x 64). The Fish, Basket, Apple, Orange and
  Mushroom borrow Daggerfall's own archives (211, 205, 213, 504), which
  are the player's and are never carried.
- `ForagingReadme.txt` - the archive's `Docs/ForagingReadme.txt`,
  verbatim.

## What the readme says that the build does not

The readme names four foods the 1.7 build does not carry (Onion, Oats,
Honey, Spice - there are no templates for them), and says Mining checks
Endurance; the build reads Agility (IL_147a). The port follows the build.
The rest are in the bible page's "The quirks".
