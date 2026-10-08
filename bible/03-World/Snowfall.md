# Snowfall - snow that falls, lies and is walked through (SNOWFALL1, 2026-10-08)

**The owner's call (2026-10-08), handing over four archives: "We have
permission to use and implement everything into the codebase. These should
be on by default and integrate into our enhanced environments seamlessly."**
demifiend000's **Snowfall 1.0.5** for Daggerfall Unity (Nexus 1401). Ledger
row SNOWFALL1; the registry row and the permission line (Mac's word recorded,
the author's own still to come - `RECORD OPEN`) are `vendor/snowfall/`'s. Its
siblings from the same message: `07-Rendering/Heat-Haze.md`,
`07-Rendering/Windfall.md`, `07-Rendering/Sands-Of-The-Alikr.md`.

## The winter ground

The mod's bundle packages 168 winter ground records - TEXTURE.103, .303 and
.403, Daggerfall's winter tiles under the author's snow - with its snow albedo
and three surface masks (`snow_surface_masks_<archive>.bytes`, a byte a tile
corner saying where snow may lie). They ship under `public/art/snowfall/`
(mip 0 of each texture written losslessly), under Port-Doctrine's SECOND
EXCEPTION, written and checked by `tools/environmentModsExtract.mjs`. The
records are a SHIPPED MOD in the texture door, registered beside Vanilla
Enhanced's by `systems/vanillaEnhancedPack.js` (`ENVIRONMENT_PACK_MODS`), ON BY
DEFAULT and a switch of its own on the Replacement packs card. They carry each
archive's record 0, so they decide the winter archives' ground as a whole -
and the index names Vanilla Enhanced's Base as an optional dependency, so the
load order puts them after the Base and their winter ground stands over the
Base's (Ledger A: the mod's manifest names no dependency).

## Pins

`test/environs_texturePacks.test.js` (4); `tools/mutants/alikr1.json` (7, all
dead); `test/doctrine.test.js` holds `public/art/snowfall/` to Port-Doctrine's
second exception.
