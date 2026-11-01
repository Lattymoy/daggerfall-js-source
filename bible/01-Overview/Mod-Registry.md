# Mod Registry

One row for each directory in `vendor/`: the outside work the game still carries, where it came from, its version
and its permission (`Own-Work.md` says why each stays). Each folder's README is the long form; this table is the
index. `test/systems/hard4_registry.test.js` derives the row list from the filesystem, so a new vendor directory
cannot arrive without its row. A folder that left the tree has its row in `Own-Work.md`, "Retired from vendor/".

`vendor/` holds 19 directories and 4 of their READMEs still carry an unfilled permission line, each shown as
`RECORD OPEN` below.

## What `RECORD OPEN` means, and what it does not

It does **not** mean the work is used without permission. In every case the README records that permission was
given, and that sentence is Mac's word, which settles whether the game may carry the files.

It means the evidence was never pasted in: the README's permission line still holds its `[Mac: ...]` prompt
instead of the author's own words or a link to them. Filling it is the job of the person who holds the messages.

## The registry

`parity` is the date the port was last read against the upstream work.

| vendor | what the port takes | upstream | version | read from | licence / permission | port slice | parity | bible |
|---|---|---|---|---|---|---|---|---|
| `warm-ashes-ships` | manifest, the compiled script byte for byte and its IL dump (`il/`, the port's law - the bundle carries no C# source), the quest list and four quests verbatim (`Quests/`), and the author's EDIT of each ship block in each of its three variants (`WorldDataPatches/`, WD1, the classic ship subrecords he copied carried as COPY ops) - the blocks rebuilt at load from the player's `BLOCKS.BSA` | Kamer | 1.1 | shipped `.rar` `Warm_Ashes_High_Seas_-_Ship_Encounters-985-1-1-1744179804`; `tools/worldDataPatch.mjs` checks each patch rebuilds the shipped file's canonical sha256; behaviour off the IL | granted (Mac handed the archive over 2026-09-25) - **RECORD OPEN** | WA1, WD1 | 2026-09-25 | `03-World/Warm-Ashes-Ships.md` |
| `world-events-raiding-parties` | manifest verbatim, the compiled script byte for byte and its IL dump (`il/`, the port's law - the bundle carries no C# source); nothing else - the mod ships no settings, art, sounds or quests | Kamer | 1.1 | shipped `.dfmod` `world_events_-_raiding_parties.dfmod` (11,820 bytes, sha256 `3129926f...b9815988`); behaviour off the IL, with the mod's own bugs fixed as recorded departures | granted - made by Kamer for this port (Mac, 2026-09-27: "Kamer made this for us") | RAID1 | 2026-09-27 | `03-World/Raiding-Parties.md` |
| `project-legacy` | manifest and settings verbatim, the compiled script byte for byte and its IL dump (`il/`, the port's law - the bundle carries no C# source); NOT the seven pictures, whose stone panels and unused talk window read as cuts of the classic interface - no window draws them; every skin has the Enhanced Plus Family tab | Lattymoy, Ghð§† and Positronico | 0.4.1 | shipped `.7z` `Genealogy_Update-1012-0-4-1-1774616989` (`project legacy (6).dfmod`, 144,062 bytes, sha256 `220c9cb5...160093fd`); behaviour off the IL, every bug fixed as a recorded departure | the author's own - Mac is Lattymoy (2026-10-05, "this is actually my DFU mod that I want to integrate") | LEGACY1-LEGACY7 | 2026-10-05 | `06-Systems/Legacy-Arc.md` |
| `dfu-books` | data | Daggerfall Unity (Interkarma and contributors) | - | `Assets/Resources/books.txt` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `10-UI/UI-Arc.md` |
| `dfu-icons` | the sixteen interaction-mode icons (four sets x steal/grab/info/talk) | Daggerfall Unity (Interkarma and contributors) | - | `Assets/Resources/Icons` @ `2343305d` | MIT | HUD-ICON1 | 2026-09-24 | - |
| `dfu-cursor` | the default cursor, Cursor2.png (the 32x32 blue arrow, ProjectSettings' defaultCursor) | Daggerfall Unity (Interkarma and contributors) | - | `Assets/Resources/Cursor2.png` @ `2343305d` | MIT | CLASSIC-CURSOR | 2026-10-03 | - |
| `dfu-quests` | data | Daggerfall Unity (Interkarma and contributors) | - | `Assets/StreamingAssets/{Quests,Tables}` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `06-Systems/Quest-Arc.md` |
| `dfu-settings` | data | Daggerfall Unity (Interkarma and contributors) | - | `defaults.ini.txt` + `Text/GameSettings.txt` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `10-UI/Settings-Screen-Spec.md` |
| `dfu-text` | data | Daggerfall Unity (Interkarma and contributors) | - | `Text/Master Localization CSV Files/Internal_RSC.csv` @ `master`, fetched 2026-09-18 | MIT | route (a) | 2026-09-18 | - |
| `raum-book` | the animated book itself | Mac (Lattymoy), project-raum | - | `Lattymoy/project-raum` @ `7fa7119e` | Mac's own work, at his word 2026-09-12 | the enhanced book | 2026-09-12 | `10-UI/UI-Arc.md` |
| `grimoire-ui` | the whole loose-file pack, byte for byte (`public/art/grimoire-ui/`): 93 `Img/*.IMG.png` screens at 3x, `CifRci/BUTTONS.RCI_0-37`, the save window's eight colour textures and `Fonts/FONT0002-SDF.ttf` / `FONT0003-SDF.ttf`; `grimoire-ui.files.json` is the archive's own listing (generated from the zip, sha256 beside it) - a loose-file pack has no `.dfmod` | LordSquacquerone | 1.2 | shipped zip `GrimoireUI-1222-1-2-1780429570` (Nexus Daggerfall Unity mod 1222) | **the pictures and fonts carry no licence text** - granted (Mac handed the zip over 2026-09-24) - **RECORD OPEN** | OVH2 | 2026-09-24 | `10-UI/Overhauls.md` |
| `silkscreen-five` | one glyph (U+0035), 520 bytes | The Silkscreen Project Authors | - | `googlefonts/silkscreen`, subset with `pyftsubset` | SIL OFL 1.1 (`OFL.txt` beside it) | the enhanced skin's digits | 2026-09-08 | `10-UI/UI-Arc.md` |
| `pixelify-glyphs` | two glyphs (U+0032, U+005A), 416 bytes | DFO (drawn for the port) | - | `tools/pixelifyGlyphs.py` | the port's own | the enhanced skin's 2 and Z | 2026-10-18 | `10-UI/UI-Arc.md` |
| `layered-armor` | the Layered Gearing look's worn-armor strips (male, female), cloak layer, hood fixes and held weapons, 7,788 PNGs, ~98 MB on disk | DFO (made for the game) | - | `tools/layered-armor/` (from the hand-cleaned frame packages) | the owner's exception for art drawn from Daggerfall's own (2026-10-19; `Port-Doctrine.md`) | LAYERED-GEAR | 2026-10-18 | `04-Characters/Layered-Gearing.md` |
| `windmills-kamer` | five `.dae` meshes + placements | Kamer | 2.0 | `WindMills.rar`, supplied by Mac 2026-08-29 | granted by the author, confirmed by Mac 2026-08-29 | WM1 | 2026-08-29 | `03-World/Windmills.md` |
| `daggerfall-arena` | manifest verbatim; the colosseum (model 864102) as data - his own 4,773 triangles, the 23-slot RuntimeMaterials table, the collider record, and 18 placements of Daggerfall's own dungeon models rebuilt from the player's ARCH3D; ARENADAG.RMB cut from his DFARENA.RMB; his 32-block dungeon; no texture (both are Daggerfall's own) | Kamer | 1.0 | `daggerfall_arena.rar` (one `.dfmod`), supplied by Mac 2026-10-02; `tools/daggerfallArenaExtract.mjs` writes every file but the README | granted by the author, relayed by Mac 2026-10-02 | ARENA1 | 2026-10-02 | `11-Multiplayer/Arena.md` |
| `world-of-daggerfall` | manifest, the eight C# sources (carried inside the bundle as TextAssets, so nothing here is a decompile), the 65 prefab layouts verbatim, and the 2,413 instance lists read through the ported reader into one pack per region folder with every source file's sha256 recorded | Kamer | 2.0 | shipped `.rar` `World_of_Daggerfall_WindowsLinux-181-2-0-1773339543`, handed over by Mac 2026-09-23; `tools/worldOfDaggerfallAssets.mjs` reproduces every vendored file byte for byte | granted by the author (the grant that covers his windmills), confirmed by Mac 2026-09-23 | WOD1-WOD5 | 2026-09-23 | `03-World/World-Of-Daggerfall.md` |
| `low-poly-trees` | manifest, and the author's geometry - every mesh's positions, normals and uv0 and its submeshes' indices, each prefab's mesh, root scale and materials, each material's cut, faces and colour - with each texture as an ATLAS SPEC (the records it copies and where, never a texel) | SquidKamer | 5 | shipped `.rar` `LowPolyTrees_V5-380-v5-1669847452` (one `.dfmod`), handed over by Mac 2026-10-05; `tools/lowPolyTreesExtract.mjs` rebuilds every vendored file but the README from it and the player's ARENA2 | handed over by Mac 2026-10-05 - **RECORD OPEN** | LPT1 | 2026-10-05 | `07-Rendering/Low-Poly-Trees.md` |
| `daggerfall-enemy-expansion` | manifest, settings, the six tables, the spell records and the troll corpse prefab verbatim (CRLF kept), the 1,130 xml files as one name-to-text table, the eight scripts verbatim from the authors' repository and the compiled assembly byte for byte; 5,500 sprites - the authors' own under `public/art/daggerfall-enemy-expansion/`, the 774 Port-Doctrine's fourth exception carries (AUDIT DEX B1: the Royal Knight's sixty among them) under `public/art/daggerfall-enemy-expansion-repainted/`; the 858 that ARE Daggerfall's records (the five rider sets, the Will-o'-wisp) rebuilt from the player's ARENA2, never carried | Kamer & Kab | 1.3.4 | shipped `.7z` `Daggerfall Enemy Expansion-372-1-3-4-1708711071 (1)` (the bundle alone), split by `tools/dexExtract.mjs` against every TEXTURE record; scripts from `SquidKamer/DaggerfallBestiaryProject` @ `c187c97`, proved against the DLL; the tables are the bundle's, which no commit of the repository is (`vendor/daggerfall-enemy-expansion/README.md`) | granted (Mac handed the archive over 2026-10-19: "Yes, record my word") - **RECORD OPEN** | DEX0 | 2026-10-19 | `04-Characters/Enemy-Expansion.md` |

## Known deviations, per row

Only the ones a maintainer would be surprised by. Each README carries the full account; this is the index to it.

- **`low-poly-trees`** - no picture of the mod is carried. Its thirty textures are Daggerfall's own sprites (the five
  small ones whole, each larger atlas 75-91% classic records copied texel for texel), and a render of game data is
  game data, so each is vendored as a SPEC and painted at runtime from the player's TEXTURE.500-511 - or from Seasons
  of the Iliac Bay's seasonal pictures while it re-skins the tree's own archive. The regions no record copies (the
  author's top-down crowns, snow-capped on the winter atlases, and some larger side views) are FILLS the game makes
  from the same record: near the author's, not his. DFU stands the models only within one terrain of the player and
  its classic flats beyond; the game stands the same model's far picture beyond (`07-Rendering/Low-Poly-Trees.md`).
- **`world-of-daggerfall`** - the mod's 2,413 instance files (61.0 MB of XML) are NOT carried as files. Each region
  folder is one pack of the ported reader's output, in the mod's own load order, and `locations.json` lists every
  source file with its sha256 and instance count, so the archive re-derives each pack byte for byte. The 65 prefabs
  and the eight C# sources ARE verbatim.
- **`raum-book`** - the one intentional change from Mac's original is marked `PORT` in the files: Raum's hand-drawn
  journal face is replaced by `BOOK.inscribe`, a seam pointed at the game's own glyph painter, so the book's words are
  Daggerfall's in Daggerfall's FNT faces.
- **`windmills-kamer`** - the meshes are Kamer's; the seven placements and the turning are the game's.

## What the gate holds

`test/systems/hard4_registry.test.js`, derived rather than listed:

1. Every `vendor/*/` has exactly one row, and every row names a directory that exists.
2. Every version and author cell matches the vendored `*.dfmod.json` manifest, where one ships.
3. `RECORD OPEN` and the README's permission prompt agree, both ways.
4. Every row's bible page exists, and every vendor directory has a README.
5. Every vendor key in `src/systems/modSettings.js` (a mod the player can switch on) has a row here, or, retired
   from `vendor/`, its row in `Own-Work.md` and no folder.
