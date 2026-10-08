# Windfall 1.0.0 - demifiend000 (ported off the assembly and its compiled shaders)

**Windfall 1.0.0** for Daggerfall Unity 1.1.1, by **demifiend000** (Nexus
mod 1396; the zip is labelled 1.0.1, its manifest says 1.0.0; GUID
`895b7c6a-f7f1-4d9c-bf86-afaa26200bdf`; the manifest's ContactInfo is the
author's e-mail, kept out of this note). The mod's own description:
"Deterministic environmental wind with vegetation sway, gusts, leaves,
audio, and snow flurries."

Mac (Lattymoy) handed the shipped zip
(`Windfall_1396_1.0.1_2026-09-14T23-37Z_gMVVlF1MJ`: `windfall.dfmod` and
`README-Windfall-Console-Commands.txt`) over on 2026-10-08 with Heat Haze,
Snowfall and Sands of the Alik'r: "We have permission to use and implement
everything into the codebase. These should be on by default and integrate
into our enhanced environments seamlessly."

**Permission: [Mac: record the author's permission, or the link to it,
here - Mac confirmed on 2026-10-08 that it was given ("We have permission to
use and implement everything into the codebase").]**

## What the mod is

`WindMod` (the controller) with `WindNaturalPlanner`, `WindRecordWeights`,
`WindEnvironmentEffects` and `WindBatchOwnership` beside it:

- **A deterministic day of wind.** Each map cell of 8 x 8 pixels, each day,
  each climate is a hash (`StableHash`: FNV-1a with a fold); it rolls
  whether a windy period comes (the season's authored chance times the
  geography's, at most 35%, times every frequency slider and a cooldown of
  the days since the last), when (a window of 3 to 6 hours, or 1 to 3 when
  it escalates, at 8%, to a windstorm), and the day's heading. Thunder is
  always a storm. The cooldown rides the save (`WindfallSaveData_v1`).
- **Vegetation sway.** Every stock nature batch (TEXTURE.500-511) is drawn
  with `Windfall/BillboardBatch`, which moves each billboard's crown by a
  slow sway and a fast shiver, a hash of its world place phasing both, its
  record's own response (`WindRecordWeights`: 0, 89, 166 or 255 for each of
  32 records of 12 archives) scaling it, the wind's heading in the
  billboard's plane.
- **Gusts.** Scheduled from a `System.Random` seeded with the day's context
  (normal days every 45-105 s, windy 14-35 s, storms 6-16 s); each rises
  over a quarter of its 3-10 s and falls over the last 55%, blending the
  profile toward the Gust settings and turning the heading up to 20 degrees.
- **Sound.** Gust one-shots, long windy/storm passages, foliage ruffles -
  intermittent, never a loop.
- **Leaves and snow.** Two leaf systems (gust-driven and ambient) in
  eligible climates and seasons, and drifting canopy snow round winter
  trees.
- **A console command**, `windfall <auto|normal|windy|storm|gust|bright|
  ruffle|leaves|status>` (`README-Windfall-Console-Commands.txt`).

## What is here

- `windfall.dfmod.json` - the shipped manifest, verbatim.
- `modsettings.json` - the nine sections as the bundle ships them.
  `src/systems/modSettings.js` restates every key under the vendor key
  `windfall`, section and name joined with a dot, with the port's own
  `Enabled` (the mod's `General.Enabled`) in front.
- `README-Windfall-Console-Commands.txt` - the zip's own note, verbatim.
- `Windfall.dll` - the shipped assembly, byte for byte, and
  `il/Windfall.il.txt` - every method body as CIL (`tools/ilDump.py`). The
  port cites it by class and member (`WindMod.StartGust`).
- `shaders/BillboardBatch.glsl`, `shaders/Particles.glsl` - the mod's own
  shaders (DXBC only) read back as GLSL with every constant named
  (`tools/dxbcGlsl.py`). `Windfall/BillboardBatchNoShadows` differs from
  `BillboardBatch` in its passes only and is not carried; the two
  `Legacy Shaders/*` in the bundle are Unity's.
- `Textures/` - the three pictures `CreateEnvironmentalEffects` loads:
  `spring_summer_leaves.png` and `fall_leaves.png` (8 x 8 sheets of leaves)
  and `snowflake.png`. RGBA32 with one mip: each PNG is the texture exactly.
  The author's own pixels. `windfall.files.json` lists them (the authority
  `test/doctrine.test.js` holds `Textures/` to).
- `Sound/` - the 27 clips, each the bundle's FSB5 Vorbis packets remuxed
  into Ogg untouched (`tools/lib/fsb5Vorbis.mjs`, the door Come Sail Away's
  clips came through; both setup headers they name are
  `vendor/vorbis-fsb-setups/`'s), and `sounds.json` - each clip's channels,
  rate, length and header.

Every file here but this note is made by
`node tools/environmentModsExtract.mjs` and the two Python tools.

## The port

`bible/07-Rendering/Windfall.md` is the record.
