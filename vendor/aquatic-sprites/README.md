# Aquatic Sprites 1.0 - Cliffworms (ported 1:1; the author's edits vendored, the blocks rebuilt from the player's own data)

**Aquatic Sprites 1.0** for Daggerfall Unity 0.13.4+, by **Cliffworms**
(Nexus mod 276; GUID `18bca36a-7dab-463b-8d4c-dd9a95898cf0`). The
mod's own description: "Adds aquatic sprites to submerged caverns." Its
readme says more: "Aquatic Sprites adds several of the unused underwater
sprites in submerged cavern dungeons. These sprites are present in the
game files, but are never used."

Mac (Lattymoy) handed the shipped archive
(`Aquatic_Sprites_1.0-276-1-0-1642914017.zip`) over on 2026-09-25, with
five other sea mods: "All mods attached are to be compatible and
implemented 1:1."

**Permission: the author's own readme, section 6, verbatim - "The mod may
be distributed/translated without my authorization as long as I am
credited as the author. Spread the love!"** Cliffworms is credited here,
in the registry row, and on the credits screen.

## What the mod is

Three world-data files and nothing else - no code, no art. Each is a whole
wet dungeon block, `W0000000.RDB`, `W0000008.RDB` and `W0000023.RDB`, as
DFU's World Data Editor writes one, with the author's additions in it:

| block | BLOCKS.BSA index | sprites added | of archive 105 / 106 |
|---|---|---|---|
| `W0000000.RDB` | 1016 | 32 | 10 / 22 |
| `W0000008.RDB` | 1024 | 48 | 12 / 36 |
| `W0000023.RDB` | 1039 | 39 | 9 / 30 |

The sprites are Daggerfall's own underwater flats (`TEXTURE.105` and
`TEXTURE.106` - the weed, coral and shells the classic game ships and never
places). They are drawn from the player's ARENA2 like every other flat;
the mod names them and places them.

Two things in the files are the editor's, not the author's hand, and ride
along because they are in what DFU loads: the root list is cut from
sixteen entries to ten (the six dropped were empty in the classic block),
and seven room models come back rotated by one to three units of 2048
(under half a degree) from the editor's round trip through Unity's Euler
angles.

## What is here, and what deliberately is NOT

- `aquatic-sprites.dfmod.json` - the shipped manifest, verbatim (the
  bundle names it `UnderwaterSprites.dfmod`).
- `Readme_AquaticSprites.txt` - the shipped readme, verbatim.
- `WorldDataPatches/W00000xx.RDB.json` - **the author's edit of each
  block, and only the edit.** A whole RDB block is Daggerfall's layout -
  game data, which this repository never carries (Port-Doctrine; the
  windmills-kamer README refused whole blocks for the same reason). So
  `tools/worldDataPatch.mjs` took each shipped file against the classic
  block out of `BLOCKS.BSA`, serialised exactly as the editor serialises
  it (`src/formats/worldDataJson.js`), and kept the difference: 68, 93 and
  74 ops, 21-31 KB against the shipped 190-330 KB. Each patch records the
  sha256 of the author's file in canonical form.
- **Not here: the three shipped `.RDB.json` files.** At load the port
  reads the three classic blocks out of the player's own `BLOCKS.BSA`,
  lays the patches on and hands the result to the world-data door under
  the files' own names (`src/formats/worldDataPatch.js`,
  `src/scenes/modWorldData.js`) - from there it is the mod's file, served
  as DFU's `WorldDataReplacement.GetDFBlockReplacementData` serves it
  (which is also why the port now reads RDB blocks out of JSON at all:
  AUDIT-RR2 G14 had refused them; WD1 ported the RDB half).

To re-derive the patches from the shipped archive:

    node tools/worldDataPatch.mjs <arena2> vendor/aquatic-sprites/WorldDataPatches \
      <extracted>/W0000000.RDB <extracted>/W0000008.RDB <extracted>/W0000023.RDB

(the three TextAssets out of `aquatic sprites.dfmod`, under their asset
names). The tool refuses to write a patch that does not rebuild the
author's file sha256 for sha256.
