# Better Ambience 0.1.4 - Joshua Steinhauer / joshcamas (ported 1:1, its sources and clips vendored)

**Better Ambience 0.1.4** for Daggerfall Unity 0.13, by **Joshua
Steinhauer** (joshcamas; Nexus mod 139). The Nexus archive handed over
is labelled 0.1.5 (`BetterAmbience-139-0-1-5-1666071806.zip`); the
manifest inside its `.dfmod` says 0.1.4, and that is the version this
note and the port name. The author's own description: "Adds camera
shaking, better footsteps, and dungeon fog + reverb." Six modules:
Better Footsteps (the player's stride with an armour clank), Dungeon
Reverb, Camera Shake, Dungeon Fog, Dungeon Lighting, Better Rain (the
particle tweaks and the indoor rain loop); DungeonSounds is an empty
MonoBehaviour.

Mac (Lattymoy) handed the archive over on 2026-09-16: "Next mod to
integrate 1:1 ensuring compatibility."

**Licence: MIT.** The author publishes the mod at
https://github.com/joshcamas/daggerfall-unity-mods under an MIT LICENSE
(`Copyright (c) 2020 Josh Steinhauer`), copied here as `LICENSE`. That
repository carries the 0.1.3 sources and the WAV clips; the sixteen
sources the port reads are the 0.1.4 ones the shipped bundle itself
carries as TextAssets.

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line.]**

## What is here

- `better-ambience.dfmod.json` - the shipped bundle's manifest,
  verbatim (title, version 0.1.4, author, DFUnity 0.13, GUID
  `d5655077-ba38-4dbc-a41f-2b358cb1d680` - the GUID Immersive
  Footsteps asks ModManager for - and the 71 files it was built from:
  sixteen scripts, the settings, the manifest, 51 clips, one texture,
  one material, one shader).
- `modsettings.json` - the six sections as the bundle ships them:
  Better Footsteps, Dungeon Reverb, Camera Shake, Dungeon Fog, Dungeon
  Lighting, Better Rain. `src/systems/modSettings.js` restates every key
  under the vendor key `better-ambience`, section and name joined with
  a dot (`Better Footsteps.enable` - the section names carry their
  spaces), with the port's own `Enabled` in front. ONE DEPARTURE:
  `Better Footsteps.enable` ships OFF here (the mod ships it on) -
  Immersive Footsteps' author rules that the two strides must not both
  run, and the port ships the pair as he says a player should run
  them; see modSettings.js and `bible/06-Systems/Better-Ambience.md`.
- `Scripts/` - the sixteen `.cs` files, byte for byte as the bundle
  carries them (Unity packs a mod's sources into the `.dfmod` as
  TextAssets; the port's UnityFS reader took them out). Every function
  in `src/systems/betterAmbience.js` names the method it restates and
  the lines it was read at.
- `LICENSE` - the author's MIT licence, from the repository.
- `Sound/` - the 29 WAV clips the mod asks for, from the author's
  repository: `sfx_footstep_wood_000..003`, `_stone_000..003`,
  `_armor_light_000..010`, `_crunchy-grass_000..003`,
  `_water_000,002..005` (the mod asks for six and `_water_001` exists
  nowhere - not in the bundle, not in the repository; the mod's
  TryImportAudioClips skips the miss and the list plays five), and
  `AmbientRaining.wav`, the indoor rain loop (29.5 s, stereo 44.1 kHz).
- This note.

## Why the clips ARE here

The bundle's 51 clips are Unity's Vorbis imports (FSB5 inside the
AssetBundle's `.resource`), which nothing in this tree can decode; the
author's repository ships the WAVs they were imported from, under the
same MIT licence. They are the author's own recordings - no DAGGER.SND
record is a boot on wood with a chain shirt over it - vendored the way
Immersive Footsteps' clips are, credited on the About screen. The 22
clips the mod never asks for (`mud`, `dirt`, `grass`,
`crunchy-grass-wet`, `crunchy-grass_004`) are not carried.

## What is NOT here, and why

**The DLL.** The bundle's compiled assembly is the sources' build and
is not carried. **The rain texture, material and shader**
(`tex_part_weather_rain`, `mat_weather_rain`, the shader): Better Rain
retunes Unity's `Rain_Particles` and `Snow_Particles` ParticleSystems
and hands them that material. The port's precipitation is its own
presentation (Port-Doctrine; `src/render/precipitation.js`), with no
ParticleSystem to retune, so the two `Better Rain` switches are declared
for the pane and do nothing - recorded as NO TWIN. **The NPC and enemy
footstep components** are in the bundle and nothing adds them (the two
hooks are commented out in BetterFootstepsMod.Start): dead in 0.1.4,
not ported. **Travel Options** is not vendored, so the stride's
accelerated-travel check never disables it.
