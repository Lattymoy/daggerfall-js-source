# Vanilla Enhanced

Vanilla Enhanced (carademono, Daggerfall Unity mod 273) repaints Daggerfall's own textures: the terrain tile sets, the
nature flats, city walls and dungeon archives. We ship three of its mods, and a fresh game wears its Base. The player
meets it as the **Texture Overhaul** card (Classic or Vanilla Enhanced, with add-on switches) and the **Replacement
packs** card. This page also holds the texture-mod door's laws, which every texture mod, shipped or attached, obeys.

## How it works

### The pack

- `tools/vanillaEnhancedVendor.mjs` reads the mod's public repository at a pinned commit and writes three mods under
  `public/art/vanilla-enhanced/`: `base`, `masked-roads` and `snowless-swamps-and-jungles` (1,436 pictures, byte for
  byte), each with a file listing (path and sha256) and a name index. Run without `--write` it checks the tree.
- Terrain arrays ship as the pictures they were compressed from: each BC7 slice is carried only when it is within BC7's
  error of a source PNG. Masked Roads' 403 array is 57 deep, so it is indexed with no slices and refused, as DFU does.
- Left out: Winter Tracks (never reached over the Base's arrays, in DFU as here), Kokey's Temperate (Kokey's own mod)
  and every Material (we have no Material reader).
- `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` registers the shipped mods in the texture-mod door
  (`src/systems/dfmodTextures.js` `setShippedDfmods`), beside the environment packs (Sands of the Alik'r, Snowfall).
  Its client fetches a picture when first drawn and decodes it at the texture detail in a worker
  (`vanillaEnhancedDecodeWorker.js`); without OffscreenCanvas in a worker it decodes on the page's thread.

### The door's load order

`dfmodLoadOrder` follows DFU: the mod loaded last answers a name (`ModManager.TryGetAsset` over
`EnumerateEnabledModsReverse`), and every mod loads after the mods it depends on (`AutoSortMods`). Vanilla Enhanced's
add-ons depend on this: they carry the Base's own names to replace them. A mod the player attaches that is built on the
shipped Base loads after it. An attached `.dfmod` with the same key or the same Title shadows the shipped mod and wears
its switch.

### The ground's tile set

`groundSource` decides a terrain archive as DFU's `TextureReader.GetTerrainTextureArray` does:

1. A loose record 0 sends the archive to its records.
2. Otherwise the first mod in load order carrying `<archive>-TexArray` or `<archive>_0-0` decides, its array first. An
   array of the wrong depth is refused.
3. Otherwise each record is sought loose-then-mods, the set made at record 0's size or the classic size.

`dfmodGroundLayers` builds the set from the classic TEXTURE file the host hands in, decoding 8 records at once, cached
per archive. The result for Vanilla Enhanced: the Base's arrays decide all eleven archives; Masked Roads' arrays decide
over them when on (403 by records); Snowless Swamps' 402 and 403 decide over both. When Snowless Swamps decides 403, the
weather and Snowfall lay no snow on that ground (`winterGroundSnowless`).

### The Texture Overhaul card

`src/systems/vanillaEnhanced/vanillaEnhanced.js`:

- **Classic** is in use when Replace Game Artwork is off, or no texture mod is on and no loose pack is attached.
  Wearing it switches every texture mod off but keeps it registered. While a loose pack is attached the card reads
  Custom.
- **Vanilla Enhanced** is in use when its Base is on and Replace Game Artwork is on. Wearing it switches on the Base,
  Replace Game Artwork and the add-ons it was last worn with (`veAddons`, remembered under `VE_ADDONS_PREF`).
- While worn, the add-ons stand on the card as switches. The packs card has Switch off / Switch on for every texture
  mod; an attached one also has Remove.
- A change takes effect when the world next loads.

## Rules

- Shipping Vanilla Enhanced is Port-Doctrine's one exception to "a render of game data is game data" (Mac). The
  exception names `public/art/vanilla-enhanced/` and nothing else; `test/tooling/doctrine.test.js` marks its rows
  `derived` and fails a derived row outside that directory. A second derived pack needs its own approval.
- The Base is on by default (Mac); its add-ons ship off until picked, because they change the roads and the swamps'
  winters (`ON_BY_DEFAULT`). Each shipped mod's switch is kept as the player's choice (`dfmodShipped`).
- Replace Game Artwork is on by default, as DFU's is.
- Online it is the player's own: a texture is a picture on one machine and nothing reaches the wire.
- `?nomods` registers no attached mod; the shipped pack registers either way.

## Daggerfall Unity

Departures:

1. The order is always `AutoSortMods`'. DFU lets the player sort mods by hand; we have no mod window.
2. A dependency's name matches lower case, since the store keeps keys lower case (`dfmodStoreKey`).
3. A record a records-built set does not replace, or carries at another size, is the classic record at the set's size.
   DFU leaves a hole or throws.
4. A mod's ground record is decoded at the texture detail.
5. `Mod.Enabled` lives on the prefs shelf, not in a Mods.json; a fresh attach is on.
6. Wearing Vanilla Enhanced turns Replace Game Artwork on.
7. The add-ons ship off; in DFU a mod in the Mods folder is on.
8. Terrain arrays draw from the pictures they were compressed from, without BC7's error.

## Code and tests

- `src/systems/dfmodTextures.js` - the door: `dfmodLoadOrder`, `groundSource`, `dfmodGroundLayers`, `setShippedDfmods`
- `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` - the shipped mods and their client
- `src/systems/vanillaEnhanced/vanillaEnhanced.js` - the card's Classic and Vanilla Enhanced, the add-ons
- `tools/vanillaEnhancedVendor.mjs` - vendors and checks the pack
- `test/systems/ve1_vanillaEnhanced.test.js` - load order, index, the ground's decision and set, hosts, card
- `test/systems/ve4_vanillaEnhancedShipped.test.js` - the pack's files and proofs, shadowing, the real index slice by
  slice, the client, add-ons
- `tools/overhaulsProbe.mjs` - the card in Chromium

## Open

- The mod's ten Materials (its rocks over World of Daggerfall's models) are not read: we have no Material reader.
- We ship the repository's 3.4.7; a player's 3.5.0 copy attaches over it. A probe over a real 3.5.0 bundle is owed.
