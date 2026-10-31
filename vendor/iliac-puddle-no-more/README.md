# Iliac Puddle No More 1.2.2 - jet082 (its fish pictures only; the rest is our own code)

**Iliac Puddle No More 1.2.2** for Daggerfall Unity 1.1.1, by **jet082**
(Nexus mod 1304; GUID `f1e8a1b3-8a4f-4f4e-bb6e-3d3a8a1b3f1e`; the
manifest's ContactInfo is empty). The mod's own description: "The Iliac
Puddle is now the Iliac Bay". Its assembly calls it *Deep Waters*: the sea
carved out of the terrain, with a floor, fish, weed, wrecks and what lives
down there.

Mac (Lattymoy) handed the shipped archive
(`Iliac_Puddle_No_More_1304_1.2.2_2026-07-11T17-49Z_psKKacHpq.7z`) over
on 2026-09-25: "All mods attached are to be compatible and implemented 1:1."

**Permission: granted (Mac handed the archive over 2026-09-25) - the
archive carries no licence text and no readme.**

> [Mac: paste the text of the permission, or the link to it, here.]

## What is here, and why

- `Flats/<name>.png` - the seven fish, the author's own pictures, decoded
  from the bundle's Texture2D objects at their first mip. No classic
  record covers any of them (`tools/iliacPuddleAssets.mjs` measures each
  against every TEXTURE record and refuses one a record covers).
- `iliac-puddle-no-more.files.json` - our listing of those seven, each
  with its sha256, written by the same tool. It is what
  `test/tooling/doctrine.test.js` admits under `Flats/`.

They stay until wave 3 of the owner's arc (OWN-WORK, "removing mods from
outside authors and instead replacing them with our own work"), which
replaces outside art with our own. Wave 2 replaced the mod's data and
words.

## What left the tree (OWN-WORK3, 2026-10-31)

The manifest, the settings (one section, 24 keys), the seven item
templates and the compiled assembly. The behaviour was already ported, and
the coastline is rebuilt from the player's own files. Our code is the
record now:

- the fish rows and names: `src/systems/deepWater/deepWatersFishRows.js`;
- the settings: `src/systems/modSettings.js` (`iliac-puddle-no-more`),
  their words our own;
- the sea itself: the modules `bible/03-World/Deep-Waters.md` lists.

The commit before OWN-WORK3 still holds the files.
