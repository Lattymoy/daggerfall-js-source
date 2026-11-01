# Sands of the Alik'r - the desert's ground (ALIKR1, 2026-10-08)

**The owner's call (2026-10-08), handing over four archives: "We have
permission to use and implement everything into the codebase. These should
be on by default and integrate into our enhanced environments seamlessly."**
**Sands of the Alik'r** version 2 (Nexus 1390), a loose texture pack for
Daggerfall Unity whose archive names no author. Ledger row ALIKR1; the
registry row and the permission line (Mac's word recorded, the author's name
and words still to come - `RECORD OPEN`) are `vendor/sands-of-the-alikr/`'s.

**OWN-WORK4 (2026-10-31, the owner).** "A proper 1 to 1 recreation for everything." The unnamed author's 47
pictures are retired with `vendor/sands-of-the-alikr/` and `public/art/sands-of-the-alikr/` (`01-Overview/Own-Work.md`).
The pack keeps its key, title, switch, its 47 records of TEXTURE.002 at 64 x 64, and the loose ground below. Each record
is our desert rule over the player's own record (`src/systems/ownTextures/ownTextureRules.js`, `desert`): where a texel
is sand - a warm tan, light enough - it is graded toward a pale dune sand that keeps the record's own light and dark,
and rippled by a north-west wind, whole cycles across the tile so it repeats. Water, green, grey and dark dirt stay
the record's own. Pins: `test/systems/environs_texturePacks.test.js`, `test/systems/ownwork4_textures.test.js`.

**OWN-WORK4 AUDIT (2026-11-01).** Read texel by texel, the rule paled a light speck in dark dirt to near white and the
light joints of a road's paving, so the shore and the road flanks came out speckled. Sand is now sand over its 5 x 5,
and a pebble in it is darker sand. On a road record the paving is the side darker over its 7 x 7: all of 46, and the
paved lower-right half of 47 and 55. The paving stays the record's, as the pack's README said. The ripple is 6%.

## What the pack is

47 pictures of TEXTURE.002 - the desert's ground, which Daggerfall wears all
year in the Desert, Desert2 and Subtropical climates (the desert's winter
archive, 003, is no terrain tileset) - records 1, 2, 4 to 28, 34 to 49, 51 to
53 and 55, each 64 x 64 under DFU's loose name `002_<record>-0.png`: a pale
dune sand with ripples laid over Daggerfall's own desert tiles (the water, the
dirt and the paving at their edges are the original's). Records 0, 3, 29 to
33, 50 and 54 are left as they are. No manifest, no readme, no script; fifteen
before-and-after screenshots, which are pictures of the game and are not
carried.

## The port

The pictures ship byte for byte under `public/art/sands-of-the-alikr/`, under
Port-Doctrine's SECOND EXCEPTION (a render of game data is game data; Mac
approved carrying it on his word of the author's permission), with a listing
of every file's sha256 and the texture door's index
(`vendor/sands-of-the-alikr/`, both written by
`tools/environmentModsExtract.mjs` (its Sands arm RETIRED, OWN-WORK4), which checks the tree against the
archive). The pack is a SHIPPED MOD in the texture door
(`systems/dfmodTextures.js` `setShippedDfmods`), registered beside Vanilla
Enhanced's by `systems/vanillaEnhanced/vanillaEnhancedPack.js` (`ENVIRONMENT_PACK_MODS`): one
load order, one walk, one fetch a picture as it is first drawn. It is ON BY
DEFAULT and a switch of its own on the Replacement packs card; its index
names Vanilla Enhanced's Base as a dependency, so it is one of the Base's
add-ons there (the Classic choice turns it off with the rest, and a return to
Enhanced brings it back).

## THE LOOSE GROUND (ALIKR1's departure)

DFU decides a terrain archive's ground by the FIRST mod in its walk that
carries the archive as a whole - `<archive>-TexArray` or its record 0 - and
sizes the records by that mod's record 0. A loose pack carries neither for
002 (it replaces records, not the archive), so under DFU's own rule the
Vanilla Enhanced Base, which carries 002 whole, would decide the desert's
ground and hide every one of the pack's records. The index names the pack's
archive in `looseGround` (`[2]`), and the door's `groundSource` stands its
records over the CLASSIC ones at the classic size - within the walk, so a mod
loaded after it still wins where it carries the record; a record the pack
lacks is the classic record (`recordOwners`, by the pack). Ledger A.

## Pins

`test/systems/environs_texturePacks.test.js` (4); `tools/mutants/alikr1.json` (7, all
dead); `test/tooling/doctrine.test.js` holds the directory to Port-Doctrine's second
exception.
