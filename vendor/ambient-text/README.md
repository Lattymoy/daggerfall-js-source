# Ambient Text 1.8 - Regnier (ported 1:1, its text table vendored)

**Ambient Text 1.8** for Daggerfall Unity 1.1.1, by **Regnier** (GUID
`ce0210ee-89cc-4ad7-a0d5-908fde918ce9`; the manifest's ContactInfo is
`forums.dfworkshop.net`). The mod's own description: "Environmental and
locational unobtrusive ambient text popups. For immersion."

It is two files of C# - `AmbientTextMod` (the MonoBehaviour: a tick, a
chance roll, and the key it builds out of where and when you are) and
`AmbientText` (the mod entry point that reads the settings and the
table) - and one table of 918 lines of prose.

Mac (Lattymoy) handed the shipped archive
(`Ambient_Text-303-1-8-1774575578.7z`) over on 2026-09-15: "I now want
to implement this as our next mod. 1:1."

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line.]**

## What is here

- `ambienttext.dfmod.json` - the shipped bundle's manifest, verbatim
  (title, version 1.8, author, contact, DFUnity 1.1.1, GUID, and the
  four files it was built from: two scripts, this settings file and the
  manifest).
- `modsettings.json` - the one section the bundle ships, `AmbientText`,
  and its four `SliderIntKey`s: `textChance` (0..100, 33), `interval`
  (60..600, 200), `postTextInterval` (60..600, 500) and
  `textDisplayTime` (1..10, 3). `src/systems/modSettings.js` restates
  every key under the vendor key `ambient-text`, with the port's own
  `Enabled` in front - DFU enables a mod by listing it and the port has
  no mod list, so the switch lives there, as it does for every other
  vendored pack.
- `ambientTexts.json` - **the mod's own writing**, 918 lines of prose
  under 918 keys, verbatim as the bundle ships it. This is the mod: the
  code around it is forty lines of arithmetic, and what a player reads
  is this file.

## The table's shape, and why the port derives its keys rather than listing them

Every key is `{family}{index}`, `index` 0..9. Two families:

- **Inside a dungeon**, the family is the `DFRegion.DungeonTypes` name
  - `Crypt`, `OrcStronghold`, `VolcanicCaves`, `Cemetery`, and so on.
    Nineteen of them, ten lines each.
- **Outside**, the family is the `DFRegion.LocationTypes` name of the
  location rect you stand in (or `None` - `0xffff` - for open country),
  followed by ONE of three tails: the climate (`Desert`, `Mountains`,
  `Swamp`, `Woods`, `Ocean`), the time of day (`Day`, `Night`), or the
  time of day and the weather (`DayRainy`, `NightClear`, ...). Which
  tail is a fresh `Random.Range(0, 3)` every time.

**THE TABLE IS SPARSE AND THAT IS THE DESIGN.** 233 families x 10 would
be 2330 keys; there are 918. `HomeYourShipsDayCloudy` has no line;
`ReligionTempleDay` has all ten. The mod handles this by ASKING - it
builds the key, and if the table does not carry it, nothing is said this
tick and `lastIndex` is left alone. So a family with one line speaks
rarely and a family with ten speaks often, and the sparseness IS the
frequency curve the author wrote. A port that filled the gaps, or that
picked from "the keys that exist", would be a different mod.

## What is deliberately NOT here

- **The compiled `AmbientText.dll`** and the AssetBundle it came in.
  The two scripts are ported to `src/systems/ambientText.js`, read off
  the disassembled IL method by method and cited there, as DFU's own C#
  is.
- **No textures, meshes or sounds** - the mod ships none. It draws
  through `DaggerfallUI.AddHUDText`, which is Daggerfall Unity's own
  pop-up line; the port's equivalent is `src/ui/hudText.js`.

## How it reaches the game

`ambientTexts.json` is imported as data by `src/systems/ambientText.js`.
The mod's own settings are on its tile on the Features home, under
"The world".

## Recovering the source

The `.7z` carries a Unity AssetBundle (`ambienttext.dfmod`, UnityFS
version 7, LZ4HC, BlocksAndDirectoryInfoCombined). The manifest, the
settings and the text table are `TextAsset`s inside it and come out as
their own bytes. The C# is only there compiled, in `AmbientText.dll`;
it was disassembled with `monodis` against stub `UnityEngine.CoreModule`
and `Assembly-CSharp` assemblies carrying the types it references, so
all thirteen methods resolve rather than the three that resolve without
them.
