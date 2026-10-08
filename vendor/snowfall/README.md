# Snowfall 1.0.5 - demifiend000 (ported off the assembly and its compiled shader)

**Snowfall 1.0.5** for Daggerfall Unity 1.1.1, by **demifiend000** (Nexus
mod 1401; the zip is labelled 1.0, its manifest says 1.0.5; the bundle's
file is `snowfall.dfmod` and its manifest `dynamic-snow.dfmod`; GUID
`cc075137-bc42-4469-907c-dd49072f269e`; the manifest's ContactInfo is the
author's e-mail, kept out of this note). The mod's own description:
"Terrain-conforming winter snow with persistent player and NPC tracks plus a
streamed-terrain distance blanket."

Mac (Lattymoy) handed the shipped zip
(`Snowfall_1401_1.0_2026-09-26T01-46Z_Z0nnzkJTn`, one file,
`snowfall.dfmod`) over on 2026-10-08 with Heat Haze, Windfall and Sands of
the Alik'r: "We have permission to use and implement everything into the
codebase. These should be on by default and integrate into our enhanced
environments seamlessly."

**Permission: [Mac: record the author's permission, or the link to it,
here - Mac confirmed on 2026-10-08 that it was given ("We have permission to
use and implement everything into the codebase").]**

## What the mod is

In winter, outside the desert climates, real snow lies on the ground: a
surface conforming to the terrain, raised by a snowpack that deepens 0.1 m
every three hours of snowfall and melts 0.1 m every 72 clear hours, between
0.2 and 0.4 m at Daggerfall's own locations and 0.4 and 0.8 m in the wild
(feathered 8 m past a location's rectangle). Where a winter tile shows no
snow - water, rock, a road - its surface mask (56 records of 64 x 64
coverage bytes a winter archive) leaves the ground bare, and steep ground
sheds it (tapering over the 10 degrees below 55). The player and every
grounded foe and townsperson press tracks into it; the tracks persist (0.5 m
cells, 65,536 at most, in the save) and refill over 12 game hours, 1.5 in
falling snow; a body presses a hollow. Three tiers draw it: a 161 x 161
deformable window 88 m across round the player, a 257 x 257 middle ring out
to 160 m, and a 65 x 65 blanket over every loaded terrain tile, which shows
the tracks by shading out to 320 m.

## What is here

- `snowfall.dfmod.json` - the shipped manifest, verbatim.
- `modsettings.json` - the eleven sections as the bundle ships them.
  `src/systems/modSettings.js` restates every key under the vendor key
  `snowfall`, section and name joined with a dot.
- `DynamicSnow.dll` - the shipped assembly, byte for byte, and
  `il/DynamicSnow.il.txt` - every method body as CIL (`tools/ilDump.py`).
  The port cites it by class and member (`SnowpackState.Advance`).
- `BasicRoadsNotice.md` - the bundle's own notice for the Basic Roads
  predicates it adapts (Hazelnut's MIT licence), verbatim.
- `shaders/DynamicSnow.glsl` - the mod's surface shader (DXBC only) read
  back as GLSL with every constant named (`tools/dxbcGlsl.py`).
- `snowfall.files.json` - the listing of `public/art/snowfall/`, every
  file's sha256: the 168 winter ground records the bundle packages
  (TEXTURE.103, .303 and .403 - Daggerfall's winter tiles under the
  author's snow), `snow_albedo.png` and the three surface masks
  (`snow_surface_masks_<archive>.bytes`). The records are a render of game
  data; Port-Doctrine carries them as its second exception, on Mac's word.
- `snowfall.index.json` - the texture door's index of the shipped records
  (`src/systems/shippedTexturePacks.js`).

Every file here but this note is made by
`node tools/environmentModsExtract.mjs` and the two Python tools.

## The port

`bible/03-World/Snowfall.md` is the record.
