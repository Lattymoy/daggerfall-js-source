# Vanilla Enhanced

Vanilla Enhanced is our own enhancement of Daggerfall's textures: the terrain tile sets, the nature flats, city walls
and dungeon archives. It keeps the keys, titles, switches, dependencies, arrays, records and sizes of carademono's
three mods of that name - the Base, Masked Roads, and Snowless Swamps and Jungles - and builds every picture from the
player's own classic record by our rule (OWN-WORK, the owner; the release's record is in `01-Overview/Own-Work.md`). A
fresh game wears its Base. The player meets it as the **Texture Overhaul** card (Classic or Vanilla Enhanced, with
add-on switches) and the **Replacement packs** card. This page also holds the texture-mod door's laws, which every
texture mod, shipped or attached, obeys.

## How it works

### The pack

- `src/systems/ownTextures/ownTexturePacks.json` names each pack's records and sizes: the Base's 1,238, Masked Roads'
  9, Snowless Swamps' 160. The Base's names leave out eight rock textures of RMB Resource Pack's meshes
  (`Woodland_3-0`, `Desert_3-0` and six more): the game draws no such mesh, and its stand-in boulders wear the
  climate's rock record (`src/world/townStandIns.js` `RMBRP_ROCKS`), which the Base dresses.
- Each picture is built when it is first drawn, from the player's own classic record, by our rule
  (`src/systems/ownTextures/ownTextureRules.js`): the Base an edge-aware upscale (`upscaleEdgeAware`, a cubic held
  inside its four nearest texels), our grain and a gentle grade (`enhance`); Masked Roads the same, the paving's own
  stones raised and lit (`road`); Snowless Swamps' winter its summer record.
- `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` registers the packs in the texture-mod door
  (`src/systems/dfmodTextures.js` `setShippedDfmods`), beside the environment packs (Sands of the Alik'r, Snowfall).
  The rule runs in the pack's worker (`vanillaEnhancedDecodeWorker.js`), and a page with none builds on its own thread,
  the same pixels. A built picture is kept a while, and two asks share one build. A terrain set of 56 records at 256
  takes about 0.8 s of building on a loaded machine, shared by the pack's two workers. Nothing is fetched.

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

- Our own rules over the player's records (OWN-WORK, the owner), so no repaint and no render of game data ships
  (Port-Doctrine).
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
8. Every picture is ours, built from the player's own classic record.

## Code and tests

- `src/systems/dfmodTextures.js` - the door: `dfmodLoadOrder`, `groundSource`, `dfmodGroundLayers`, `setShippedDfmods`
- `src/systems/ownTextures/ownTextureRules.js`, `src/systems/ownTextures/ownTexturePacks.js` - the rules and the specs
- `src/systems/vanillaEnhanced/vanillaEnhancedPack.js` - the packs and their client
- `src/systems/vanillaEnhanced/vanillaEnhanced.js` - the card's Classic and Vanilla Enhanced, the add-ons
- `test/systems/ve1_vanillaEnhanced.test.js` - load order, index, the ground's decision and set, hosts, card
- `test/systems/ve4_vanillaEnhancedShipped.test.js` - the packs' builds, shadowing, the index slice by slice, the
  client, add-ons; mutants `tools/mutants/ve4.json`
- `test/systems/ownwork4_textures.test.js` - the rules; mutants `tools/mutants/ownwork4_textures.json`
- `tools/overhaulsProbe.mjs` - the card in Chromium

## Open

- The mod's ten Materials (its rocks over World of Daggerfall's models) have no twin: we have no Material reader.
- A player's own copy of the mod attaches over ours, by key or Title. A probe over a real bundle is owed.
