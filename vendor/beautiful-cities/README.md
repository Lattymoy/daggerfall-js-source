# Beautiful Cities of Daggerfall 0.5.0 - carademono (ported 1:1; the author's edits vendored as one world-data pack, every city rebuilt from the player's own data)

**Beautiful Cities of Daggerfall 0.5.0** for Daggerfall Unity 1.1.1, by
**carademono** (Nexus mod 720 by its archive's name; GUID
`9827d938-f296-461f-b9c1-b4963cbb0e6b`; ContactInfo "Lysandus' Tomb
Discord server"). The mod's own description: "This mod overhauls the
cities of the Iliac Bay."

Mac (Lattymoy) handed the shipped archive over on 2026-10-01, beside
Beautiful Villages of Daggerfall: "These are the next mods I'd like to
implement (We have permission) and ensure this doesn't conflict or
regress anything (For example housing customization). For anything
missing I need you to curate, like textures. I want you to be as detailed
as possible and take your time".

**Permission: [Mac: record the author's permission, or the link to it,
here - Mac confirmed on 2026-10-01 that it was given ("We have
permission"); the earlier mod records carry the author's own words or a
link in this line.]**

| file | sha256 (first 16) |
|---|---|
| the archive, `Beautiful_Cities_of_Daggerfall-720-0-5-0-1749441603.7z` | `da1e1773301a93f2` |
| `Mods/beautiful cities.dfmod` (a Unity AssetBundle, the archive's one file) | `030ea4873b95587b` |

## What the mod is

No code (the manifest lists no script). World data, as the World Data
Editor writes it:

- **410 location files** - every city of the Iliac Bay (every
  `TownCity` location MAPS.BSA holds) laid out again: districts, walls,
  gates, markets and docks, a new block grid and new building lists;
- **611 RMB blocks** - 178 of them Daggerfall's own blocks by name,
  rebuilt, and 433 new ones, 388 of those COMPOSITES the author named for
  their two parents (`WALLAA04.FARMBA01.RMB`: a city-wall block and a farm
  block made one, so the farmland runs up to the wall);
- the same eighteen bed prefabs as Beautiful Villages (`42069`-`42086`),
  twenty materials and twenty-one textures - and in this bundle not even
  the meshes: **the prefabs point at no mesh and no material**, so in
  Daggerfall Unity they draw nothing. The textures are the classic
  bedclothes (`TEXTURE.090` 5, 6 and 7) recoloured - game data, which the
  port never carries. The port draws the beds the author placed as its own
  stand-ins (`src/world/townStandIns.js`).

## What is here

- `beautiful-cities.dfmod.json` - the manifest, verbatim (1,099 file
  names; the dependency list below).
- `WorldDataPack/beautiful-cities.pack.json.gz` - every world-data file of
  the mod as the author's EDIT of Daggerfall's own data
  (`src/formats/worldDataPack.js`, WD3;
  `bible/02-Formats/World-Data-Patches.md`): a location as the edit of the
  location MAPS.BSA holds, a classic-named block as the edit of the block,
  a composite as the edit of a parent, a new block as the edit of the
  classic block nearest it - every subrecord or building half the author
  copied out of Daggerfall named by reference (`$c`: its block's index in
  BLOCKS.BSA and its path in that block, the block checked by its name,
  `classicNames` below), never written out; the piece's sha256 is only the
  builder's key for finding it (AUDIT PRE-MERGE 1003 WD3).
  1,021 files in 4,339 content-addressed nodes, 2.17 MB gzipped (the
  files themselves are 285 MB of text). Built by:

  ```
  node tools/worldDataPackBuild.mjs <ARENA2> "Mods/beautiful cities.dfmod" beautiful-cities \
    vendor/beautiful-cities/WorldDataPack/beautiful-cities.pack.json.gz \
    --title "Beautiful Cities of Daggerfall" --author carademono --version 0.5.0
  ```

  Every classic block a reference reads is named beside its index
  (`classicNames`, AUDIT WD3 P5) - a BLOCKS.BSA in another order refuses the
  file rather than read another block's pieces. The builder writes them; the
  pack built before it did had them laid in by
  `node tools/worldDataPackNames.mjs <ARENA2> vendor/beautiful-cities/WorldDataPack/beautiful-cities.pack.json.gz`.

  The tool refuses to write a pack that does not rebuild every one of the
  author's files exactly, checked through the runtime's own reader, and the
  build is deterministic.

## Its dependencies, and what the port does about each

| dependency | manifest | in the port |
|---|---|---|
| RMB Resource Pack 0.2.1 | peer | not carried - the port's own stand-ins for the hills, rocks, towers' domes, temple platforms, foundations and the crop fields the composite farms lay out (Daggerfall's own crop billboards, sown as the pack's own field script sows them); Cliffworms' Items, archive 1210, are Detailed Ships' pictures of them (the same author's, carried with his leave). Not stood in: its stone bridges (two meshes each under transforms the published files do not settle), its wall piece `53210` (224 placements, every one against a classic wall that already stands) and its winter-smoke markers |
| Daggerfall Expanded Textures 0.6.5 (Ninelan) | peer | not carried - the port's own stand-ins (DS1's `detStandIns.js`, grown for the towns: chimneys, pillars and beams, tapestries and banners, vanes, pots, stumps, rugs; its food, animals and tools drawn in code); not its chimney smoke, nor the few pieces no catalogue names |
| DET Harvestable Crops | peer | not carried - the temple garden rows (archive `10035`, TEMPAAE0) stand as Daggerfall's own garden plants (`TEXTURE.301`) |
| Diep - Rosy's Resources | peer | not carried - its paintings as Daggerfall's own framed paintings, its small hangings and rugs drawn in code; not its fireplace dressing (`69465`), whose classic hearth stands |
| New Paintings | peer | not carried - Daggerfall's own framed paintings, each hung as its placements hang it |
| Windmills of Daggerfall (Kamer) | load after | vendored already (`vendor/windmills-kamer`) - and as the manifest orders, this mod's farms are the ones read: a farm block served from world data stands the mills its own records place, and Kamer's placements stand on Daggerfall's own farms only (`src/world/rmbLayout.js`) |
| Fixed Desert Architecture | load after | not in the port - nothing to order against |
| Finding My Religion | load after | not in the port - nothing to order against |

## Beside Beautiful Villages

Both mods ship `FIGHBM00.RMB`, and the two differ. Daggerfall Unity serves
the file of the mod loaded later; this mod is the later of the two, and the
port orders them so (`scenes/modWorldData.js` `WORLD_DATA_PRIORITY`).

## A save's towns

A house bought, a room rented, a quest's building, an item at a smith and a
Recall anchor set indoors keep the layout their city was in when they were
made (`src/systems/layoutPins.js`; `bible/03-World/Beautiful-Towns.md`).
Online the switch is the room's, and every online home keeps the layout
its city was bought in, server-wide.
