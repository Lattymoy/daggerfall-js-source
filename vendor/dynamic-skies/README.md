# Dynamic Skies 2.3.4 - BadLuckBurt and carademono (vendored, with the authors' permission)

The files beside this note are **Dynamic Skies 2.3.4** for Daggerfall
Unity, by **BadLuckBurt** (the shader and the mod's code) and
**carademono** (the visuals and further code) - Nexus mod 376, source at
github.com/drcarademono/dynamic-skies (commit `04506e2`, "Fix
lightning", which is the 2.3.4 the `.dfmod` bundle was built from: the
manifests are identical and every preset here is byte-identical to the
repository's). The mod's own credit: the shader extends Feral Pug's
skybox tutorial (feralpug.github.io, "Extending Unity's Skybox").

**Permission: granted by the authors to Mac (Lattymoy), 2026-09-04.**
Record of the permission:

> [Mac: paste the text of the permission, or the link to it, here.]

## What is here

Exactly what the mod's runtime reads, as the shipped bundle carries it:

- `dynamic-skies.dfmod.json` - the mod's manifest (title, version,
  authors, contact, GUID, file list). `modsettings.json` - its two
  settings sections, which `src/systems/modSettings.js` restates.
- `SkyboxSettings/Skybox{Sunny,Cloudy,Overcast,Fog,Rain,Thunder,Snow}.json`
  - one preset per DFU WeatherType. (The repository also carries
  `Resources/*Night.json` variants; they are NOT in the shipped manifest,
  so the mod never loads them and they are not carried.)
- `FogSettings/Fog{Sunny,Overcast,HeavyFog,Rainy,Snowy}.json` - the five
  WeatherManager fog settings the mod installs.
- `LightCurveSettings/LightCurve.json` - the SunlightManager light curve
  the mod installs.
- `Textures/` - the nineteen textures the seven presets (and the pixel
  snow) actually name: CdMSunny, CdMSunny2, CdMCloudsNormal, CdMCloudy,
  CdMRain, CdMOvercast2, CdMThunder, CdMSnow, VanillaStars,
  VanillaStarsTwinkleMask, NLstarsHighlight, DefaultStars,
  DefaultStarsTwinkleMask, DefaultStarsTwinkleNoise, NLStarsBlack,
  NLStarsThiefTwinkleMask, PixelMars, PixelEnceladus, PixelSnow. These
  are decoded from the `.dfmod` AssetBundle rather than copied from the
  repository, because what the player sees is Unity's IMPORT of each
  file: `CdMCloudsNormal` is Unity's converted normal map (128x128,
  heightScale 0.15, x in alpha) where the repository holds the
  grayscale source; `NLStarsBlack` is scaled to 1024 where the source
  is 876. The import settings (Point filter, Repeat, mipmaps, sRGB) are
  restated in `src/systems/dynamicSkies.js` TEXTURE_IMPORTS.
- `Shaders/BLBProceduralSkybox.shader` and `Shaders/Includes/*.cginc` -
  the shader sources, for reading beside the port. They are not
  compiled; `src/render/dynamicSkiesRenderer.js` is their GLSL
  translation.

## What is deliberately NOT here

- The C# (`BLBSkybox.cs`, `Scripts/*.cs`): ported to
  `src/systems/dynamicSkies.js` and `src/systems/dynamicSkiesRuntime.js`,
  cited by file and line, as DFU's own C# is.
- The eight textures in the shipped bundle that no preset names
  (CdMClouds, CdMOvercast, CdMPixelClouds, CdMPixelClouds2, DefaultMars,
  DefaultEnceladus, NLStarsThief, NLStarsThiefMask) and the ten more in the
  repository the manifest never ships (the HD and Pixel variants,
  DefaultStarsBlack, VanillaStarsHighlight) - eighteen in all; the
  `Resources/*Night.json` presets, the two alternative skybox materials
  (NoSun, Simple - unreachable, the material suffix is commented out),
  the sun-shafts scripts and shaders (not wired by the mod), the
  `Docs/`, and the compiled `.dll`.
- The preset-mod door (FindPresetMod: another mod carrying its own
  SkyboxSettings takes over): the port has no other mod to find.

## A question for the record

Two texture families name Daggerfall: `VanillaStars` /
`VanillaStarsTwinkleMask` ("the vanilla stars") and the `CdM*` cloud
sheets, which the mod's Nexus page says were "created with Daggerfall's
vanilla skies and palettes". The doctrine's rule is that a render of
game data is game data, and that Bethesda's art is Bethesda's to
waive. Whether these are re-creations in the vanilla STYLE or
derivations of the SKY??.DAT / NITE??I0.IMG pixels cannot be settled
from here (no ARENA2 in this container); they are carried on the
authors' permission as the mod ships them, and the question is Mac's to
rule on. Swapping a family out is a preset edit (the file names), not
a code change.

The evidence, for what it is worth (measured from the PNGs here, so it
is evidence and not proof): `VanillaStars` and its twinkle mask are
2048x2048 fields of single-pixel stars over a flat navy ground, with
1154 and 359 colours; the `CdM*` sheets are 512x512 (Overcast2 is
1024x1024) grayscale cloud CUTOUTS - two alpha levels - with 217 to
1670 colours each. The classic files are 320x200 (`NITE??I0.IMG`) and
512x220 (`SKY??.DAT`), paletted to 256 colours, and carry no alpha. A
resampled, greyscaled cutout of a classic frame could still produce
those numbers, which is why the question stays open.

Every texture here has a row on the doctrine allow-list in
`test/doctrine.test.js` (the pin that fails on any tracked raster it
cannot explain): ten rows say "the mod's own art", the nine above say
"PROVENANCE OPEN, Mac's ruling pending". The windmills precedent
(`vendor/windmills-kamer/README.md`) left textures OUT when they were
provably Daggerfall's own art exported to PNG; these are neither
provably that nor replaceable without changing what the player sees.

## How it reaches the game

`src/systems/dynamicSkiesAssets.js` globs this tree at build time (the
JSON as text, the textures as URLs). `src/scenes/shared.js`
createSkyController builds the pass when the mod's `Enabled` switch is
on under the enhanced environments (`?sky=dynamic` forces it,
`?sky=enhanced` forces the port's own dome, `?sky=classic` the
panorama). The mod's own settings are in the Enhanced menu's Mods pane.
Enhanced skin only; the classic lane keeps Daggerfall's painted sky.

## Regenerating the textures

The bundle's textures were decoded with UnityPy (`Texture2D.image`)
from `Mods/dynamic skies.dfmod` (Unity 2019.4.40f1, OSX build) and
written as PNG; the material and shader tables were read from the same
bundle (`Material.m_SavedProperties`, `Shader.m_ParsedForm`).
