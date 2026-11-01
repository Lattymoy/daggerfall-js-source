# Mod Support

The port runs Daggerfall Unity mods by porting each one into the tree, not by loading `.dfmod` bundles. A mod's code is
restated in `src/`, and its pictures, sounds, models, data and words are our own (OWN-WORK, the owner;
`bible/01-Overview/Own-Work.md`), coming in through the same injection doors DFU uses. The player meets mods in the
Mods pane, where each has its switches. The outside work the tree still carries is under `vendor/<mod>/`, each listed
in `bible/01-Overview/Mod-Registry.md`; the record of every mod whose files left is in `Own-Work.md`.

## How it works

### The injection doors

DFU's asset injection (`Utility/AssetInjection`) has these doors, each ported:

- **Textures** - `src/systems/textureReplacement.js`, DFU's `TextureReplacement` with its exact
  `{archive:000}_{record}-{frame}.png` naming, behind DFU's `AssetInjection` gate.
- **Music** - `src/systems/musicReplacement.js`, the same shape for songs.
- **World data** - `src/formats/worldData/worldDataReplacement.js`, DFU's `WorldDataReplacement`: a new location, a
  replaced location, a block served from JSON, or a building record replaced inside a block, by DFU's file names. A mod
  registers its files (`registerWorldDataAsset`, `registerWorldDataPack`); `registerWorldDataLayer` lays records onto
  whatever block is served. A block edit is vendored as a WD1 patch (`src/formats/worldData/worldDataPatch.js`), the
  edit only, rebuilt against the player's own BLOCKS.BSA (`bible/02-Formats/World-Data-Patches.md`).
- **Models** - `src/world/customModels.js`, DFU's `MeshReplacement.ImportCustomGameobject`: a model id, a builder in
  the port's mesh shape, and the switch it stands behind (`registerCustomModel`, `registerModelAlias`).

### Settings and saves

`MOD_SETTINGS` in `src/systems/modSettings.js` declares each mod's settings as its `modsettings.json` does (booleans,
ints, floats, choices, text, tuples, colours), read live with `modSetting(vendor, key)`. The Mods pane draws them. A
mod's own save data registers through `src/systems/modSaveData.js` `registerModSaveData`, as DFU's
`IHasModSaveData`.

### Delivery

DFU loads a baked `.dfmod` bundle; the port reads the mod's source files where the author ships them, or its DLL's IL
where only the DLL ships (as for Ambient Text and Immersive Travel), and restates each C# member it ports, naming it.
A mod's art is extracted by a tool into `public/art/` when its terms allow, or read from the player's own files.

## Rules

- Every mod is on by default (Mac). The Mods pane is where a mod is turned off.
- No compatibility switches between mods; each reads the other's own switch.
- A suite that pins Daggerfall Unity's own numbers runs with every mod off: it imports `test/modsOff.js` first.
- A mod's bugs are reproduced as it ships them, and named where they stand, unless a departure is recorded.
- Every vendored mod has a row in `bible/01-Overview/Mod-Registry.md` naming its author, version, permission and page;
  a mod whose files left the tree has its row in `bible/01-Overview/Own-Work.md`.

## Daggerfall Unity

DFU's `ModManager` loads `.dfmod` bundles and their DLLs at run time; the port has no mod loader and ports each mod as
code. The injection doors keep DFU's file names and gates, so a mod's data files work as they stand.

## Code and tests

- `src/systems/textureReplacement.js`, `src/systems/musicReplacement.js` - textures and music
- `src/formats/worldData/` - world data replacement, WD1 patches, packs
- `src/world/customModels.js` - custom models
- `src/systems/modSettings.js` - every mod's settings
- `src/systems/modSaveData.js` - mod save data
- `test/modsOff.js` - turns every mod off for a suite that pins DFU's numbers
- `test/player/macfive.test.js` - every mod on by default
