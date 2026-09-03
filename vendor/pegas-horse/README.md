# Pegas Horse Ranch - the horse (vendored, with the author's consent)

The files under `meshes/`, `textures/` and `sound/` are from **Pegas
Horse Ranch v3.1 by MADMAX and Team (September 2004)** for Morrowind -
the rigged, animated horse Morrowind itself never shipped. Per the
mod's own credits, **the horse model is Cait's** ("thanks to Cait for
giving us such a wonderful horse model. And, Kagrenac for letting me
use the horse models that were specially created for him by Cait");
the readmes beside this note carry the full team credit and are copied
across whole.

**Consent: the author's written consent, confirmed by Mac 2026-09-03.**
The readme's disclaimer says: "You may NOT modify any of the files or
use this mod to 'add' to your mod without my written consent. This is
Freeware. ... You may distribute this file freely as long as its
contents are kept original and intact." Both halves are met here: the
consent is the author's, and every vendored file is **byte-identical
to the mod's** - `manifest.json` records each file's size and sha256
and `test/mwd50_vendoredhorse.test.js` pins the tree to it both ways.
Record of the consent:

> [Mac: paste the text of the consent, or the link to it, here.]

That is what makes these files admissible where MW-D41 first took the
other route. The port shipped the horse (2026-08-31) reading ONLY the
player's own copy at runtime, on the disclaimer's "without my written
consent" - so nothing was bundled until the consent was in hand.

## What is here, and what deliberately is NOT

Here: exactly the set the enhanced ride resolves for ONE coat variant
(1, the mod's default) - the mesh `xhorse1.nif`, its clips
`xhorse1.kf`, the coat the mesh names (`cait_horse1x.dds`, read out of
the .nif by the vendoring script rather than guessed from a filename),
and the four hoof/voice clips the ride swaps in (trot, gallop, idle,
roar). About 1.2 MB, fetched lazily on the first mount and never
before.

Not here: the other nineteen coats and the unicorn (a variant picker
is recorded as unbuilt in Morrowind-Rules MW-D42), the ranch, the
stables, the saddle skirts, the banners, the books and their art, the
music, the icons, and the `.esm`/`.esp` plugins. The port uses none of
them, so none is carried. Re-running the script with `--variants`
brings more coats across, each proven before it is written.

## How it reaches the game

`src/systems/pegasVendor.js` globs this tree at build time and serves
it as ONE loose archive - the same `{has, get}` duck the player's own
attached Morrowind data arrives through (MW-D40). `src/scenes/world.js`
ranks the player's attach AHEAD of it, the engine's data-files-over-
archive law, so a coat or a newer build the player attaches through
the enhanced settings' "Attach data" door still wins. The assembly
(`src/systems/pegasHorse.js`) never knows which set answered.

Enhanced skin only. The classic lane rides Daggerfall's own CFA sprite,
byte-identical to before.

## Regenerating

    node scripts/vendorPegas.mjs <extracted copy of the mod> [--variants 1,2,...]

The script finds the data-files frame itself, selects the set above,
**assembles the horse through the runtime path before writing a byte**
(coat hung, all three gaits armed - it refuses otherwise), copies the
files verbatim under their canonical lowercase loose paths, copies the
readmes, and rewrites `manifest.json`.
