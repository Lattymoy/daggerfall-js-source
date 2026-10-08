# Sands of the Alik'r 2 (a loose texture pack; its author is not named in the archive)

**Sands of the Alik'r**, version 2, a loose texture pack for Daggerfall
Unity (Nexus mod 1390). The archive Mac handed over
(`Sands_Of_The_AlikR_1390_2_2026-09-14T18-24Z_bWMMNpOWt.7z`) carries a
folder `Sands of the Alik'r/` with `Textures/` - 47 PNGs - and
`Mod Screenshots/` - fifteen before-and-after screenshots - and no
manifest, readme or licence. Its author is not named anywhere in it.

Mac (Lattymoy) handed it over on 2026-10-08 with Heat Haze, Windfall and
Snowfall: "We have permission to use and implement everything into the
codebase. These should be on by default and integrate into our enhanced
environments seamlessly."

**Permission: [Mac: record the author's name and their permission, or the
link to it, here - Mac confirmed on 2026-10-08 that it was given ("We have
permission to use and implement everything into the codebase").]**

## What the pack is

TEXTURE.002 - the desert's ground, which Daggerfall wears all year in the
Desert, Desert2 and Subtropical climates - records 1, 2, 4 to 28, 34 to 49,
51 to 53 and 55, each 64 x 64 under DFU's loose name `002_<record>-0.png`:
a pale dune sand with ripples, laid over Daggerfall's own desert tiles (the
water, the dirt and the paving at their edges are the original's). Records
0, 3, 29 to 33, 50 and 54 are not replaced.

## What is here

- `sands-of-the-alikr.files.json` - the listing of
  `public/art/sands-of-the-alikr/`, where the 47 PNGs ship byte for byte,
  each file's sha256. They are a render of game data; Port-Doctrine carries
  them as its second exception, on Mac's word.
- `sands-of-the-alikr.index.json` - the texture door's index of the pack
  (`src/systems/shippedTexturePacks.js`).
- NOT the screenshots: they are pictures of the game, not the pack.

Every file here but this note is made by
`node tools/environmentModsExtract.mjs`.

## The port

`bible/07-Rendering/Sands-Of-The-Alikr.md` is the record.
