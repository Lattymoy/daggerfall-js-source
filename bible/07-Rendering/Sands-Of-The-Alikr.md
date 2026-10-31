# Sands of the Alik'r

Sands of the Alik'r (version 2, Nexus 1390) is a loose texture pack for Daggerfall Unity that we ship on by default. It
repaints Daggerfall's desert ground, TEXTURE.002, as pale rippled dune sand. The player sees it in the Desert, Desert2
and Subtropical climates, which wear 002 all year; the water, dirt and paving at its edges are Daggerfall's own.

## How it works

- The pack is 47 pictures of TEXTURE.002 (64 x 64, DFU's loose name `002_<record>-0.png`). Records 0, 3, 29 to 33, 50
  and 54 are not in it and stay classic.
- The pictures ship byte for byte under `public/art/sands-of-the-alikr/`. `vendor/sands-of-the-alikr/` holds the file
  listing (sha256 each) and the texture door's index, both written by `tools/environmentModsExtract.mjs`, which checks
  the tree against the archive.
- It is a shipped mod in the texture door: `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` `ENVIRONMENT_PACK_MODS`
  registers it beside Snowfall, and `src/systems/dfmodTextures.js` `setShippedDfmods` takes every shipped pack as one
  load order. A picture is fetched when it is first drawn.
- It has its own switch on the **Replacement packs** card. Its index names Vanilla Enhanced's Base as a dependency, so
  choosing Classic turns it off with the Base's other add-ons, and a return to Enhanced brings it back.

## Rules

- On by default and part of the enhanced environments, shipped on Mac's word of permission (Mac).
- The pictures ship under Port-Doctrine's second exception (a render of game data is game data); the directory is held
  there by `test/tooling/doctrine.test.js`.
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

- `src/systems/dfmodTextures.js` - `groundSource`, `hasDfmodGround`, the door's walk
- `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` - `ENVIRONMENT_PACK_MODS`, the shipped environment packs
- `tools/environmentModsExtract.mjs` - writes the listing and index from the archive
- `test/systems/environs_texturePacks.test.js` - the pack's records, its switch and the loose-ground rule

## Open

- The archive names no author. `vendor/sands-of-the-alikr/README.md` waits for Mac to record the author's name and
  permission.
