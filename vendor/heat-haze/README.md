# Heat Haze 1.0.1 - demifiend000 (ported off the assembly and its compiled shader)

**Heat Haze 1.0.1** for Daggerfall Unity 1.1.1, by **demifiend000** (Nexus
mod 1397; GUID `51bf7e5b-26b1-4a2d-a88e-92aba7cec1df`; the manifest's
ContactInfo is the author's e-mail, kept out of this note). The mod's own
description: "World-space heat shimmer for sunny and cloudy daytime desert
exteriors, with opt-in subtropical support." The same author's Windfall and
Snowfall are `vendor/windfall/` and `vendor/snowfall/`; their Physical Items
is `vendor/physical-items/`.

Mac (Lattymoy) handed the shipped zip
(`Heat_Haze_1397_1.0.1_2026-09-16T04-08Z_HnXXiG7ni`, one file,
`heat-haze.dfmod`) over on 2026-10-08 with Windfall, Snowfall and Sands of
the Alik'r: "We have permission to use and implement everything into the
codebase. These should be on by default and integrate into our enhanced
environments seamlessly."

**Permission: [Mac: record the author's permission, or the link to it,
here - Mac confirmed on 2026-10-08 that it was given ("We have permission to
use and implement everything into the codebase").]**

## What the mod is

One MonoBehaviour, `HeatHazeMod`, and its rules class `HeatHazeEligibility`.
Outdoors in the two desert climates (223 + 1 and + 2: Desert, Desert2; and
Subtropical, 229, when `AllowSubtropical` is on), by day, under a sunny or
a cloudy sky, a vertical ring 400.4 m round the player - a 128-sided
cylinder, 1006 m tall, its foot 1.5 m above the player's - is drawn after
the opaque world with a GrabPass. Its shader bends what lies BEHIND the ring
by up to 1.5 screen pixels with two scrolls of a 64 x 64 value noise
(`System.Random(1212701233)`), so the far land and the sky shimmer and the
near world does not. Sunny is the full strength, cloudy half; the day fades
in over the thirty minutes after 06:00 and out over the thirty before
18:00; the strength eases toward its target with a 0.8 s time constant.

## What is here

- `heat-haze.dfmod.json` - the shipped manifest, verbatim (the bundle's
  `heat-haze.dfmod` TextAsset).
- `modsettings.json` - the one section as the bundle ships it (Enabled,
  AllowSubtropical, Intensity, FullStrengthDistance, RingHeight, NoiseScale,
  AnimationSpeed). `src/systems/modSettings.js` restates every key under the
  vendor key `heat-haze`, section and name joined with a dot, the section's
  `Enabled` as the mod's switch.
- `HeatHaze.dll` - the shipped assembly, byte for byte, and
  `il/HeatHaze.il.txt` - every method body as CIL (`tools/ilDump.py`). The
  bundle carries no C# source; the port cites the assembly by class and
  member (`HeatHazeEligibility.GetDaylightStrength`).
- `shaders/HeatHaze.glsl` - the bundle's one shader (`Daggerfall/Mods/
  HeatHaze`, DXBC only) read back as GLSL with every constant named, by
  `tools/dxbcGlsl.py`. Read beside `src/render/heatHaze.js`, which is its
  translation; nothing compiles it.

Every file here but this note is made by
`node tools/environmentModsExtract.mjs` (the four archives in, `--write` to
write, without it the tree is checked) and the two Python tools.

## The port

`bible/07-Rendering/Heat-Haze.md` is the record.
