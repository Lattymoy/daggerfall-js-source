# Sands of the Alik'r

Sands of the Alik'r is a texture pack of our own, on by default. It dresses Daggerfall's desert ground, TEXTURE.002,
as pale rippled dune sand. The player sees it in the Desert, Desert2 and Subtropical climates, which wear 002 all
year; the water, green, grey and dark dirt at its edges are Daggerfall's own. It keeps the key, title and switch of the
loose pack of that name (OWN-WORK, the owner; the release's record is in `01-Overview/Own-Work.md`).

## How it works

- The pack names 47 records of TEXTURE.002 at 64 x 64 (`src/systems/ownTextures/ownTexturePacks.json`,
  `002_<record>-0`). Records 0, 3, 29 to 33, 50 and 54 are not in it and stay classic.
- Each record is our desert rule over the player's own record (`src/systems/ownTextures/ownTextureRules.js` `desert`),
  built when it is first drawn. The record's stray hues - its violet specks - go first (`groundHue`). Where a texel is
  sand - a warm tan, light enough, over its 5 x 5 - it is graded toward a pale dune sand that keeps the record's own
  light and dark, so a pebble in it is darker sand. It is rippled by a north-west wind by 6%, whole cycles across the
  tile so it repeats. Water, green, grey and dark dirt stay the record's own. On a road record the paving is the side
  darker over its 7 x 7: all of 46, and the paved lower-right half of 47 and 55; the paving stays the record's.
- It is a pack in the texture door: `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` `ENVIRONMENT_PACK_MODS`
  registers it beside Snowfall, and `src/systems/dfmodTextures.js` `setShippedDfmods` takes every pack as one load
  order.
- It has its own switch on the **Replacement packs** card. Its index names Vanilla Enhanced's Base as a dependency, so
  choosing Classic turns it off with the Base's other add-ons, and a return to Enhanced brings it back.

## Rules

- On by default and part of the enhanced environments (Mac); our own rule over the player's records (OWN-WORK, the
  owner).
- A loose pack decides its ground archive: the index names 002 in `looseGround`, and `src/systems/dfmodTextures.js`
  `groundSource` returns that pack's records at its place in the walk. The set is the player's loose file first, then
  the pack's record, then Daggerfall's own, at the classic size. A mod loaded after it still decides first.

## Daggerfall Unity

DFU builds a terrain archive from the first mod in its walk that carries the archive whole (`<archive>-TexArray` or
record 0); loose records count only while no array claims the archive (`TextureReplacement.cs`
`TryImportTextureArray`, called from `TextureReader.cs` `GetTerrainTextureArray`). Vanilla Enhanced's Base carries
`002-TexArray`, so under DFU's rule the Base would hide every record of this pack. Departure: `looseGround` lets the
pack decide 002 as DFU's loose folder would with no array over it, so a pack and a Base both on by default both show.

## Code and tests

- `src/systems/ownTextures/ownTextureRules.js` `desert` - the rule; `ownTexturePacks.json` - the records and sizes
- `src/systems/dfmodTextures.js` - `groundSource`, `hasDfmodGround`, the door's walk
- `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` - `ENVIRONMENT_PACK_MODS`, the environment packs
- `test/systems/environs_texturePacks.test.js` - the pack's records, its switch and the loose-ground rule
- `test/systems/ownwork4_textures.test.js` - the rule; `test/systems/groundhue.test.js` - its violet taken away
