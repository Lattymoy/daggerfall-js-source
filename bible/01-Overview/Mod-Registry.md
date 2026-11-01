# The vendored-work registry (HARD4, 2026-09-15)

> **The counts in the next two sections are HARD4's own moment and are
> left as it wrote them.** They were true of the fifteen rows that
> existed on 2026-09-15 and they are the record of what putting those
> rows side by side found. The live numbers are derived, not written:
> `vendor/` holds 19 directories and 4 of their READMEs still carry an
> unfilled permission line, each shown as `RECORD OPEN` in the table
> (2026-10-29: two directories removed, both with permission, so the open count stands;
> MUDEX1, 2026-10-20: Ralzar's `mudex`, the sixty-first - Meaner Monsters' own form beside DEX, vendored on Mac's
> approval ("Approve MUDEX"), the author's own words not yet, so the open count rises by one;
> DEX0, 2026-10-19: Kamer & Kab's `daggerfall-enemy-expansion`, the sixtieth (the fifty-eighth on its branch,
> renumbered past LAYERED-GEAR's two at the merge) - Mac's word of permission recorded ("Yes, record my word"), the
> authors' own words not yet, so the open count rises by one;
> LAYERED-GEAR and the 2 and the Z, 2026-10-19: `pixelify-glyphs` and `layered-armor`, the fifty-eighth and the
> fifty-ninth, both the game's own work with their permission written, so the open count stays;
> KG3, 2026-10-13: the unnamed author's `kings-gambit`, the fifty-seventh - the owner's word of permission
> recorded ("We also have permission"), the author's own words not yet - the bundle names no author - so the open
> count rises by one;
> THE ENVIRONMENT MODS, 2026-10-08: demifiend000's `heat-haze`, `windfall` and `snowfall` and the
> unnamed author's `sands-of-the-alikr`, the fifty-second to the fifty-fifth - Mac's word of permission recorded
> ("We have permission to use and implement everything into the codebase"), the authors' own words not yet, so the
> open count rises by four;
> PI1, 2026-10-07: demifiend000's `physical-items`, the fifty-first - Mac's word of permission
> recorded ("permission has been granted"), the author's own words not yet, so the open count rises by one;
> LEGACY1, 2026-10-05: Mac's own `project-legacy`, the fiftieth - the author's own permission
> written in its README, so the open count stands;
> VE4, 2026-10-05: carademono's `vanilla-enhanced`, the forty-ninth - Mac's word of permission
> recorded ("Approved and yes"), the author's own words not yet, so the open count rises by one;
> LPT1, 2026-10-05: SquidKamer's `low-poly-trees`, the forty-eighth - its archive carries the
> bundle alone, no readme, and its manifest no licence, so the open count rises by one;
> IT1, 2026-10-04: kkgobkk's `immersive-travel`, the forty-seventh - its zip carries the
> bundle alone, no readme, so the open count rises by one;
> THE MERGE of main's FIELD BUGS 2026-10-03 into the arena branch: CLASSIC-CURSOR's `dfu-cursor`, the forty-third
> on main, is the forty-sixth here - Daggerfall Unity's own cursor under its MIT licence, so the open count stands;
> ARENA1, 2026-10-02: Kamer's `daggerfall-arena`, the forty-fifth - his permission relayed by Mac
> and written in its README, so the open count stands;
> WD3, 2026-10-01: carademono's `beautiful-villages` and `beautiful-cities`, the forty-third and
> forty-fourth - Mac's word of permission recorded ("We have permission"), the author's own words
> not yet, so the open count rises by two;
> THE MERGE of main into the professions branch, 2026-09-28, counted them again: FORAGE1's
> `foraging`, the thirty-eighth on its branch, is the forty-second - Harbinger451's Foraging, Mac's
> word of permission recorded, the author's own words not yet, so the open count rises by one;
> RAID1, 2026-09-27: `world-events-raiding-parties`, the forty-first at the merge with the
> sea update - Kamer made the mod for this port and Mac recorded it, "Kamer made this for
> us", so the open count stands;
> CSA-A, 2026-09-27: `come-sail-away` the thirty-ninth - its zip carries
> the bundle alone, no readme, so the open count rises by one - and
> `vorbis-fsb-setups` the fortieth, two licensed codebook headers whose
> licences travel with them, so it stands;
> OH-A, 2026-09-26: `ocean-holes` the thirty-eighth - its archive carries
> no readme either, so the open count rises by one;
> the sea update's merge with main, 2026-09-25, counted them again: main's
> SKIN2 added `class-skins`, the thirty-third, its record open; the sea update's
> four follow it - two since removed (their permission recorded, so the open
> count stood), WA1's `warm-ashes-ships` the thirty-sixth
> (its archive carries no readme, so its permission line waits for Mac and
> the open count rises by one) and DW-A to DW-D's `iliac-puddle-no-more` the
> thirty-seventh (no readme either, so it rises by one again);
> AUDIT BRANCH (WoD), 2026-09-23, counted them again after the merge
> brought `horse-cart-and-cargo`, the twenty-seventh; WOD1 had counted 26
> and 13 when it added the twenty-sixth;
> the sentence had read 19 and 11 since ORL1 and nothing checks it, so
> re-count rather than trust it). ORL1 (2026-09-17) added the nineteenth, and the first vendored MOD
> that is not a Daggerfall Unity one - an OpenMW Lua mod for Morrowind.
> It carries no `*.dfmod.json`, so the gate below reads no version or
> author cell for it and its own suite checks both instead; its row in
> *Known deviations* says so. (Eight of the nineteen directories carry no
> manifest. Six of the other seven are not mods at all - Daggerfall
> Unity's own shipped data, a font, a road table, Mac's own project - and
> the seventh, `windmills-kamer`, is a Daggerfall Unity mod shipped as
> loose meshes rather than as a bundle.)

OWN-WORK1 (2026-10-31) retired twelve directories, eight of them open, OWN-WORK2 four more and OWN-WORK3 two more,
all six open, so the counts above fell from 59 and 37. OWN-WORK4 (wave 3, the same day) retired twenty-one more and the two Vorbis headers. Their rows moved to `Own-Work.md`, "Retired from vendor/", and an open one stays open
there.

The fourth slice of `01-Overview/Hardening.md`. One row per directory in
`vendor/`, and `test/systems/hard4_registry.test.js` derives the row list from
the filesystem, so a fourteenth entry cannot arrive without one.

## Why a registry and not fourteen READMEs

The READMEs are good, and they stay: each is the long form, and the
registry links to it rather than replacing it. What a README cannot do
is be **read together with the other thirteen**. Two facts about this
tree were invisible until these rows were put side by side:

1. **Seven of the fifteen carry an unfilled permission line.** Each is a
   literal `[Mac: paste the text of the permission, or the link to it,
   here.]` sitting under a sentence that says permission was granted -
   so the README reads as settled, and only the placeholder says it is
   not. Six is not one oversight; it is the shape of a record nothing
   checks. They are the `RECORD OPEN` rows below, and the gate now holds
   the two in step: a README with the placeholder MUST show `RECORD OPEN`
   here, and a README without it must NOT.
2. **One port is built from a version its upstream source does not
   cover.** PCAAO's shipped bundle is 1.44; the last single-file source
   in its repository is 1.40. The port's law is the decompiled 1.44 with
   the 1.40 source naming what the decompiler numbered - which is the
   right call and is written down in the README, but it is the kind of
   fact that belongs where a maintainer looks first.

Neither is a defect in the port's behaviour. Both are exactly the
"correct system delivered incorrectly by its caller" shape this program
was written for, pointed at provenance instead of at code.

## What `RECORD OPEN` means, and what it does not

It does **not** mean the work is used without permission. In every case
the README records that permission was given - to Mac, by the author, on
a dated day - and that sentence is Mac's word, which settles the
question of whether the port may carry the files.

It means the EVIDENCE was never pasted in. The line exists to hold the
author's own words or a link to them, and it is still a prompt. Anyone
who has to answer a licence question later - or anyone who takes this
repository over - would find a promise and no receipt. Filling the seven
lines is a five-minute job for the person who holds the messages, and it
is nobody else's job, which is why the rows say who.

## The registry

`parity` is the date the port was last read against the upstream work,
not the date the slice shipped, where those differ.

| vendor | what the port takes | upstream | version | read from | licence / permission | port slice | parity | bible |
|---|---|---|---|---|---|---|---|---|
| `warm-ashes-ships` | manifest, the compiled script byte for byte and its IL dump (`il/`, the port's law - the bundle carries no C# source), the quest list and four quests verbatim (`Quests/`), and the author's EDIT of each ship block in each of its three variants (`WorldDataPatches/`, WD1, the classic ship subrecords he copied carried as COPY ops) - the blocks rebuilt at load from the player's `BLOCKS.BSA` | Kamer | 1.1 | shipped `.rar` `Warm_Ashes_High_Seas_-_Ship_Encounters-985-1-1-1744179804`; `tools/worldDataPatch.mjs` checks each patch rebuilds the shipped file's canonical sha256; behaviour off the IL | granted (Mac handed the archive over 2026-09-25) - **RECORD OPEN** | WA1, WD1 | 2026-09-25 | `03-World/Warm-Ashes-Ships.md` |
| `world-events-raiding-parties` | manifest verbatim, the compiled script byte for byte and its IL dump (`il/`, the port's law - the bundle carries no C# source); nothing else - the mod ships no settings, art, sounds or quests | Kamer | 1.1 | shipped `.dfmod` `world_events_-_raiding_parties.dfmod` (11,820 bytes, sha256 `3129926f...b9815988`); behaviour off the IL, with the mod's own bugs fixed as recorded departures | granted - made by Kamer for this port (Mac, 2026-09-27: "Kamer made this for us") | RAID1 | 2026-09-27 | `03-World/Raiding-Parties.md` |
| `project-legacy` | manifest and settings verbatim, the compiled script byte for byte and its IL dump (`il/`, the port's law - the bundle carries no C# source); NOT the seven pictures, whose stone panels and unused talk window read as cuts of the classic interface - no window draws them; every skin has the Enhanced Plus Family tab | Lattymoy, Ghð§† and Positronico | 0.4.1 | shipped `.7z` `Genealogy_Update-1012-0-4-1-1774616989` (`project legacy (6).dfmod`, 144,062 bytes, sha256 `220c9cb5...160093fd`); behaviour off the IL, every bug fixed as a recorded departure | the author's own - Mac is Lattymoy (2026-10-05, "this is actually my DFU mod that I want to integrate") | LEGACY1-LEGACY7 | 2026-10-05 | `06-Systems/Legacy-Arc.md` |
| `dfu-books` | data | Daggerfall Unity (Interkarma and contributors) | - | `Assets/Resources/books.txt` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `10-UI/UI-Arc.md` |
| `dfu-icons` | the sixteen interaction-mode icons (four sets x steal/grab/info/talk) | Daggerfall Unity (Interkarma and contributors) | - | `Assets/Resources/Icons` @ `2343305d` | MIT | HUD-ICON1 | 2026-09-24 | `01-Overview/Port-Ledger.md` |
| `dfu-cursor` | the default cursor, Cursor2.png (the 32x32 blue arrow, ProjectSettings' defaultCursor) | Daggerfall Unity (Interkarma and contributors) | - | `Assets/Resources/Cursor2.png` @ `2343305d` | MIT | CLASSIC-CURSOR | 2026-10-03 | `01-Overview/bugs/Field-Bugs-2026-10-03.md` |
| `dfu-quests` | data | Daggerfall Unity (Interkarma and contributors) | - | `Assets/StreamingAssets/{Quests,Tables}` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `06-Systems/Quest-Arc.md` |
| `dfu-settings` | data | Daggerfall Unity (Interkarma and contributors) | - | `defaults.ini.txt` + `Text/GameSettings.txt` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `10-UI/Settings-Screen-Spec.md` |
| `dfu-text` | data | Daggerfall Unity (Interkarma and contributors) | - | `Text/Master Localization CSV Files/Internal_RSC.csv` @ `master`, fetched 2026-09-18 | MIT | route (a) | 2026-09-18 | `01-Overview/bugs/Mac-Bugs-U.md` |
| `raum-book` | the animated book itself | Mac (Lattymoy), project-raum | - | `Lattymoy/project-raum` @ `7fa7119e` | Mac's own work, at his word 2026-09-12 | the enhanced book | 2026-09-12 | `10-UI/UI-Arc.md` |
| `grimoire-ui` | the whole loose-file pack, byte for byte (`public/art/grimoire-ui/`): 93 `Img/*.IMG.png` screens at 3x, `CifRci/BUTTONS.RCI_0-37`, the save window's eight colour textures and `Fonts/FONT0002-SDF.ttf` / `FONT0003-SDF.ttf`; `grimoire-ui.files.json` is the archive's own listing (generated from the zip, sha256 beside it) - a loose-file pack has no `.dfmod` | LordSquacquerone | 1.2 | shipped zip `GrimoireUI-1222-1-2-1780429570` (Nexus Daggerfall Unity mod 1222) | **the pictures and fonts carry no licence text** - granted (Mac handed the zip over 2026-09-24) - **RECORD OPEN** | OVH2 | 2026-09-24 | `10-UI/Overhauls.md` |
| `silkscreen-five` | one glyph (U+0035), 520 bytes | The Silkscreen Project Authors | - | `googlefonts/silkscreen`, subset with `pyftsubset` | SIL OFL 1.1 (`OFL.txt` beside it) | the enhanced skin's digits | 2026-09-08 | `10-UI/UI-Arc.md` |
| `pixelify-glyphs` | two glyphs (U+0032, U+005A), 416 bytes | DFO (drawn for the port) | - | `tools/pixelifyGlyphs.py` | the port's own | the enhanced skin's 2 and Z | 2026-10-18 | `10-UI/UI-Arc.md` |
| `layered-armor` | the Layered Gearing look's worn-armor strips (male, female), cloak layer and hood fixes, 7,369 PNGs, ~94 MB | DFO (made for the game) | - | `tools/layered-armor/` (from the hand-cleaned frame packages) | the owner's exception for art drawn from Daggerfall's own (2026-10-19; `Port-Doctrine.md`) | LAYERED-GEAR | 2026-10-18 | `04-Characters/Layered-Gearing.md` |
| `windmills-kamer` | five `.dae` meshes + placements | Kamer | 2.0 | `WindMills.rar`, supplied by Mac 2026-08-29 | granted by the author, confirmed by Mac 2026-08-29 | WM1 | 2026-08-29 | `03-World/Windmills.md` |
| `daggerfall-arena` | manifest verbatim; the colosseum (model 864102) as data - his own 4,773 triangles, the 23-slot RuntimeMaterials table, the collider record, and 18 placements of Daggerfall's own dungeon models rebuilt from the player's ARCH3D; ARENADAG.RMB cut from his DFARENA.RMB; his 32-block dungeon; no texture (both are Daggerfall's own) | Kamer | 1.0 | `daggerfall_arena.rar` (one `.dfmod`), supplied by Mac 2026-10-02; `tools/daggerfallArenaExtract.mjs` writes every file but the README | granted by the author, relayed by Mac 2026-10-02 | ARENA1 | 2026-10-02 | `11-Multiplayer/Arena.md` |
| `world-of-daggerfall` | manifest, the eight C# sources (carried inside the bundle as TextAssets, so nothing here is a decompile), the 65 prefab layouts verbatim, and the 2,413 instance lists read through the ported reader into one pack per region folder with every source file's sha256 recorded | Kamer | 2.0 | shipped `.rar` `World_of_Daggerfall_WindowsLinux-181-2-0-1773339543`, handed over by Mac 2026-09-23; `tools/worldOfDaggerfallAssets.mjs` reproduces every vendored file byte for byte | granted by the author (the grant that covers his windmills), confirmed by Mac 2026-09-23 | WOD1-WOD5 | 2026-09-23 | `03-World/World-Of-Daggerfall.md` |
| `low-poly-trees` | manifest, and the author's geometry - every mesh's positions, normals and uv0 and its submeshes' indices, each prefab's mesh, root scale and materials, each material's cut, faces and colour - with each texture as an ATLAS SPEC (the records it copies and where, never a texel) | SquidKamer | 5 | shipped `.rar` `LowPolyTrees_V5-380-v5-1669847452` (one `.dfmod`), handed over by Mac 2026-10-05; `tools/lowPolyTreesExtract.mjs` rebuilds every vendored file but the README from it and the player's ARENA2 | handed over by Mac 2026-10-05 - **RECORD OPEN** | LPT1 | 2026-10-05 | `07-Rendering/Low-Poly-Trees.md` |
| `daggerfall-enemy-expansion` | manifest, settings, the six tables, the spell records and the troll corpse prefab verbatim (CRLF kept), the 1,130 xml files as one name-to-text table, the eight scripts verbatim from the authors' repository and the compiled assembly byte for byte; 5,500 sprites - the authors' own under `public/art/daggerfall-enemy-expansion/`, the 774 Port-Doctrine's fourth exception carries (AUDIT DEX B1: the Royal Knight's sixty among them) under `public/art/daggerfall-enemy-expansion-repainted/`; the 858 that ARE Daggerfall's records (the five rider sets, the Will-o'-wisp) rebuilt from the player's ARENA2, never carried | Kamer & Kab | 1.3.4 | shipped `.7z` `Daggerfall Enemy Expansion-372-1-3-4-1708711071 (1)` (the bundle alone), split by `tools/dexExtract.mjs` against every TEXTURE record; scripts from `SquidKamer/DaggerfallBestiaryProject` @ `c187c97`, proved against the DLL; the tables are the bundle's, which no commit of the repository is (`vendor/daggerfall-enemy-expansion/README.md`) | granted (Mac handed the archive over 2026-10-19: "Yes, record my word") - **RECORD OPEN** | DEX0 | 2026-10-19 | `04-Characters/Enemy-Expansion.md` |

## Known deviations, per row

Only the ones a maintainer would be surprised by. Each README carries the
full account; this is the index to it.

- **`low-poly-trees`** - no picture of the mod is carried. Its thirty
  textures are Daggerfall's own sprites (the five small ones whole, each
  larger atlas 75-91% classic records copied texel for texel), and a
  render of game data is game data, so each is vendored as a SPEC and
  painted at runtime from the player's TEXTURE.500-511 - or from Seasons
  of the Iliac Bay's seasonal pictures while it re-skins the tree's own
  archive. The regions no record copies (the author's top-down crowns,
  snow-capped on the winter atlases, and some larger side views) are
  FILLS the game makes from the same record: near the author's, not his
  (`01-Overview/audits/Audit-Low-Poly-Trees.md` measures how near). DFU stands the models only within one terrain of
  the player and its classic flats beyond; the port stands the same
  model's far picture beyond (`07-Rendering/Low-Poly-Trees.md`).
- **`world-of-daggerfall`** - the mod's 2,413 instance files (61.0 MB of
  XML) are NOT carried as files. Each region folder is one pack of the
  ported reader's output, in the mod's own load order, and
  `locations.json` lists every source file with its sha256 and instance
  count, so the archive re-derives each pack byte for byte. The 65
  prefabs and the eight C# sources ARE verbatim.
- **`handheld-torches`**, **`shield-widget`**, **`diverse-weapons`**, **`roleplay-realism-items`** and
  **`roleplay-realism`** - their compiled DLLs were never vendored. Behaviour was read method by method (IL, or the
  upstream source) and rewritten; the port's own files are the law. OWN-WORK4 (2026-10-31) retired all five: their
  rows are in `Own-Work.md`.
- **`raum-book`** - the one intentional change from Mac's original is
  marked `PORT` in the files: Raum's hand-drawn journal face is replaced
  by `BOOK.inscribe`, a seam pointed at the port's own glyph painter, so
  the book's words are Daggerfall's in Daggerfall's FNT faces.
- **`windmills-kamer`** - the meshes are Kamer's; the seven placements
  and the turning are the port's.

## What the gate holds

`test/systems/hard4_registry.test.js`, and like every gate in this program it is
derived rather than listed:

1. **Every `vendor/*/` has exactly one row, and every row names a
   directory that exists.** Add a mod and the gate is red until it is
   registered; delete one and the stale row is named.
2. **Every version cell matches the vendored manifest.** Where a
   `*.dfmod.json` is present, its `ModVersion` and `ModAuthor` are read
   and compared. A bundle refreshed to a new upstream version without
   the row being touched fails here.
3. **`RECORD OPEN` and the README placeholder agree, in both
   directions.** A README still carrying `[Mac: ...]` must show
   `RECORD OPEN`; one without must not. Filling a permission line and
   forgetting the row - or the reverse - is caught.
4. **Every row names a bible page that exists**, and every vendor
   directory has a README.
5. **Every mod the port exposes as a switch is registered.** The vendor
   keys in `systems/modSettings.js` are read out and each must have a
   row, so a mod cannot become player-visible without its provenance
   being written down. A key retired from `vendor/` (OWN-WORK1) has its
   row in `Own-Work.md` instead, and the gate holds it there: no
   directory, no row here.
