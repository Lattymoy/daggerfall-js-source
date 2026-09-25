# Iliac Puddle No More 1.2.2 - jet082 (ported 1:1 off the assembly; the coastline rebuilt from the player's own world)

**Iliac Puddle No More 1.2.2** for Daggerfall Unity 1.1.1, by **jet082**
(Nexus mod 1304; GUID `f1e8a1b3-8a4f-4f4e-bb6e-3d3a8a1b3f1e`; the
manifest's ContactInfo is empty). The mod's own description: "The Iliac
Puddle is now the Iliac Bay" - its assembly's namespace calls it
*Deep Waters*: the sea is carved out of the terrain and given depth, a
floor, a surface you can see through from both sides, open-water
swimming with your breath to watch, fish, weed and coral, wrecks and
sunken loot, and what lives down there. It is the required dependency
of jet082's *There's a Hole in the Bottom of the Ocean*.

Mac (Lattymoy) handed the shipped archive
(`Iliac_Puddle_No_More_1304_1.2.2_2026-07-11T17-49Z_psKKacHpq.7z`) over
on 2026-09-25, beside the Ocean Holes archive that needs it: "All mods
attached are to be compatible and implemented 1:1."

**Permission: granted (Mac handed the archive over 2026-09-25) - the
archive carries no licence text and no readme.**

> [Mac: paste the text of the permission, or the link to it, here.]

## What is here

- `iliac-puddle-no-more.dfmod.json` - the shipped manifest, verbatim (the
  bundle carries it as `deep-waters.dfmod`, the mod's working name).
- `modsettings.json` - the shipped settings, verbatim: one section,
  General, twenty-four keys. `src/systems/modSettings.js` restates them
  key by key (`General.<Name>`), with the port's own `Enabled` in front.
- `Iliac Puddle No More.dll` - the shipped assembly, byte for byte
  (sha256 `80eda507...be86`). The bundle carries no C# source; the port's
  law is this assembly, read back to C#, and the port's modules cite the
  C# by class and member name (`OutdoorSwimDriver.PostPhaseRestore`,
  `DeepBathymetry.SampleDepthMeters`...).

## What is NOT here, and why

- **`DistanceBake` and `DistanceBakeVanilla`** (356,000,018 bytes each) -
  the coastline: for every map pixel, how far it lies from the shore and
  which of its cells are sea. The mod computes them from WOODS.WLD,
  MAPS.BSA and BLOCKS.BSA, so each is a derivative of Daggerfall's own
  data, which never enters this tree. The port builds the same planes on
  the player's machine from the player's own files, by the rules the
  file proves (`src/world/deepWatersBake.js`, DW-A), and caches them; with
  the mod's own bake at hand `test/dwa_bake.test.js` checks the two agree.
- **The shaders** - seven programs in the bundle (the seafloor, the
  surface's top and underside, the clipped terrain, the decorations, the
  distance fog). Read back to GLSL and restated in the port's own
  renderer (`src/render/deepWatersRender.js`, `src/render/fogGlsl.js`),
  uniform for uniform - the decorations' program with the slice that
  places them (DW-E); the compiled blobs are not carried.
- **The fish art and the fish items** (seven PNGs under `Flats/`,
  `Assets/ItemTemplates.json`) - they arrive with the slice that ports the
  fish (DW-E), not before anything reads them.

The page for the whole port is `bible/03-World/Deep-Waters.md`.
