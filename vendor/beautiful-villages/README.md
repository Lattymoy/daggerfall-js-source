# Beautiful Villages of Daggerfall 1.4.2 - carademono (ported 1:1; the author's edits vendored as one world-data pack, every town rebuilt from the player's own data)

**Beautiful Villages of Daggerfall 1.4.2** for Daggerfall Unity 1.0.0, by
**carademono** (Nexus mod 566 by its archive's name; GUID
`b2324db6-7557-499a-aa25-d5e99014331d`; ContactInfo "Lysandus' Tomb
Discord server"). The mod's own description: "Overhauls villages across
the Iliac Bay".

Mac (Lattymoy) handed the shipped archive over on 2026-10-01, beside
Beautiful Cities of Daggerfall: "These are the next mods I'd like to
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
| the archive, `Beautiful_Villages_of_Daggerfall-566-1-4-2-1749441651.7z` | `4325d73efe8e5464` |
| `Mods/beautiful villages.dfmod` (a Unity AssetBundle, the archive's one file) | `550ebb02f1a765c7` |

## What the mod is

No code (the manifest lists no script). World data, as the World Data
Editor writes it:

- **7,317 location files** (`location-<region>-<index>.json`) - every
  village (1,834), hamlet (1,200), farm (1,841), wealthy home (1,399) and
  temple (1,043) of the Iliac Bay laid out again: a new block grid, new
  building lists, new names where a grid cell holds a new block;
- **209 RMB blocks** - 156 of them Daggerfall's own blocks by name, rebuilt
  (every roadside tavern among them, so the 1,646 tavern locations change
  through their blocks alone), and 53 new ones (the `DA*` variants, more
  farms, more hamlet blocks);
- two TextAssets no Daggerfall Unity name reaches (`objectgroup.json`,
  `temple stairs - straight.json` - the author's editor leftovers; DFU
  never reads them, and neither does the port);
- eighteen bed prefabs (`42069`-`42086`) with eighteen meshes,
  twenty-four materials and thirty textures. **The shipped prefabs point
  at no mesh and no material** (every reference is null in the bundle), so
  in Daggerfall Unity they draw nothing. Their meshes are Daggerfall's own
  beds (`model41000-node`, `41001`, `41002`, six copies each) and their
  textures are the classic bedclothes (`TEXTURE.090` 5, 6 and 7)
  recoloured blue, brown, grey, orange, purple and yellow - game data,
  which the port never carries. The port draws the beds the author placed
  as its own stand-ins: the player's own bed, its blanket recoloured in
  code (`src/world/townStandIns.js`). Which classic bed each id is reads
  off the placements - every `42069 + 3k` stands where a `41000` stands
  on a floor, `+1` a `41001`, `+2` a `41002` (their origins sit 10, 9 and
  41 units over the floor, as the three beds' own do).

## What is here

- `beautiful-villages.dfmod.json` - the manifest, verbatim (7,637 file
  names; the dependency list below).
- `WorldDataPack/beautiful-villages.pack.json.gz` - **every world-data file
  of the mod as the author's EDIT of Daggerfall's own data**
  (`src/formats/worldDataPack.js`, WD3; `bible/02-Formats/World-Data-Patches.md`).
  A location file is the edit of the location MAPS.BSA holds; a block that
  replaces a classic one is the edit of that block; a new block is the edit
  of the classic block it was made from, or carried whole where it is the
  author's own. Anything the author copied out of Daggerfall - a subrecord, a
  building's exterior or interior half - is named by reference to the classic
  record (by its sha256) and never written out. 7,526 files in 2,712
  content-addressed nodes, 2.58 MB gzipped (the files themselves are 154 MB of text).
  Built by:

  ```
  node tools/worldDataPackBuild.mjs <ARENA2> "Mods/beautiful villages.dfmod" beautiful-villages \
    vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz \
    --title "Beautiful Villages of Daggerfall" --author carademono --version 1.4.2
  ```

  Every classic block a reference reads is named beside its index
  (`classicNames`, AUDIT WD3 P5) - a BLOCKS.BSA in another order refuses the
  file rather than read another block's pieces. The builder writes them; the
  pack built before it did had them laid in by
  `node tools/worldDataPackNames.mjs <ARENA2> vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz`.

  The tool refuses to write a pack that does not rebuild every one of the
  author's files exactly - checked through the runtime's own reader
  (`openWorldDataPack`), sha256 for sha256 over FullSerializer's text - and
  the build is deterministic (the same bundle and ARENA2 give the same
  bytes). At load the pack is opened over the player's `BLOCKS.BSA` and
  `MAPS.BSA`, each file is rebuilt the first time a town asks for it, and a
  sample is checked again in the background.

## Its dependencies, and what the port does about each

The manifest names eight. None of them is carried; Mac's DS1 answer for a
peer the port does not have was "Build your own", and the user's handover
asks the same ("For anything missing I need you to curate").

| dependency | manifest | in the port |
|---|---|---|
| Windmills of Daggerfall (Kamer) | peer | vendored already (`vendor/windmills-kamer`): the six farms of this mod that place Kamer's mill (model `41600`: FARMAA04, 05, 07, FARMBA05, 08, 09) stand the port's mill where they place it, when Windmills of Daggerfall is on |
| RMB Resource Pack 0.1.10 | peer | not carried - the port's own stand-ins for the hills, rocks, market stalls, docks, temple platforms, foundations and domes, and crop fields the blocks place (the docks measured off the pack's meshes, their ramps and steps landing where the author's do); Cliffworms' Items, archive 1210, are Detailed Ships' pictures of them (the same author's, carried with his leave). Not stood in: its wooden bridges (their rails are in the pack's published files, their decks are not, so neither shape nor size can be read), its stone bridges (`53132`, `53134`: two meshes each under transforms the published files do not settle) and its winter-smoke markers - the streams stand bridgeless and the chimneys smokeless, as in DFU without the pack |
| Daggerfall Expanded Textures 0.6.3 (Ninelan) | peer | not carried - the port's own stand-ins (DS1's `detStandIns.js`, grown for the towns: chimneys, pillars and beams, tapestries and banners, vanes, pots, stumps, rugs; its food, animals and tools drawn in code); not its chimney smoke, nor the few pieces no catalogue names |
| DET Harvestable Crops | peer | not carried - the temple gardens' rows (archive 10035, in no catalogue) stand as Daggerfall's own garden plants |
| Diep - Rosy's Resources | peer | not carried - its paintings as Daggerfall's own framed paintings, its small hangings and rugs drawn in code; not its fireplace dressing (`69465`), whose classic hearth stands |
| New Paintings | peer | not carried - Daggerfall's own framed paintings, each hung as its placements hang it |
| Fixed Desert Architecture | load after | not in the port - nothing to order against |
| Finding My Religion | load after | not in the port - nothing to order against |

## Beside Beautiful Cities

Both mods ship `FIGHBM00.RMB`, and the two differ. Daggerfall Unity serves
the file of the mod loaded LATER; Beautiful Cities (0.5.0, built for DFU
1.1.1) is the later of the two, and the port orders them so
(`scenes/modWorldData.js` `WORLD_DATA_PRIORITY`). No other name is shared.

## A save's towns

A house bought, a room rented, a quest's building, an item at a smith and a
Recall anchor set indoors all name their building by its KEY, and a key
names a building only in one layout of its town. A town holding such a
record keeps the layout it was made in, whatever the switch says since
(`src/systems/layoutPins.js`; `bible/03-World/Beautiful-Towns.md`).
Online the switch is the room's, and every online home keeps the layout
its town was bought in, server-wide.
