# Port Doctrine

The constitution of the project. Changes to this page need Mac's explicit approval.

## Scope: our own game, DFU the reference (SCOPE1)

DFO Online is its own game (Mac). Parity with Daggerfall Unity is not the goal, and a difference from DFU is not a
defect in itself. DFU stays the reference:

- **Look there first.** Before building a system DFU has, read DFU's version and grep the tree for its name and its
  constants. Keep one copy of any DFU member we port (ONE DFU MEMBER, ONE EXPORT).
- **Readers stay exact.** The player's ARENA2 is the data DFU reads. Every format reader (`02-Formats/Readers-Arc.md`)
  reads it exactly as DFU does, and their corpus gates stand.
- **Name the departure.** A change that leaves DFU's behaviour says so in a comment at the site: the DFU member it
  departs from (`FormulaHelper.CalculateX`) and why. A cite to DFU stays after we move past it.
- **A pin follows the rule we chose.** A test that pins a DFU law pins it because we still follow it. A deliberate
  change edits the pin in the same change.
- **The native-window rule.** A window that keeps DFU's layout cites the DFU source of every drawn element. A window
  redesigned on purpose cites its own design page instead.

## The whole of Tamriel (TAMRIEL-WIDE)

The owner: development is for "the entirety of tamriel", not just Daggerfall. The world is the Iliac Bay and the nine
provinces round it, and the Bay is one theatre of ten:

- **Every province, or say which.** A system that reads a place, a pixel, a region, a person or the ground works past
  the Bay as it does on it. Where it does not, `03-World/World-Wide.md` lists the exclusion and the owner's call.
- **The world's keys and bounds.** Key a pixel with `worldPixelKey`, bound it with `worldPixelOk`, find a place with
  `worldPlaces` (never a walk of MAPS.BSA alone). Regions are 0..70; a grouping is an area (`areaAt`). MapsFile's
  `y * 1000 + x`, its 62 regions and its rows are the Bay's own data: read them behind `inBay`, with a `BAY-OWN:`
  comment that says why.
- **Tested past the Bay.** Pins hold a case past the Bay beside the Bay's, and probes stand in a province too.
- **Player text names where the player is.** No string says "the Iliac Bay" or "Daggerfall" for a place that can be
  anywhere in Tamriel.
- **DFU is the Bay's reference.** Past the Bay the reference is the lore (UESP) and Arena through OpenTESArena.
- **Held by a test.** `test/tooling/tamrielwide.test.js` holds `src/`, `server/src/` and `server-account/src/` to
  `tools/tamrielWideBaseline.json`, which only goes down (`node tools/tamrielWide.mjs`).

## What we ported from DFU

- Binary format readers: BSA containers, TEXTURE, IMG/CIF, ARCH3D, BLOCKS, MAPS, sound and music.
- Game math: FormulaHelper (damage, skills, levelling, resistances, loot tables).
- World assembly: block layout, location generation, dungeon assembly, climate and season textures.
- Systems: the quest machine, items, magic and the spellmaker, guilds, calendar, banking, crime.

When a change ports a DFU member as DFU has it: read the C#, translate the logic, keep constants and tables
byte-exact. Structure may be simpler; behaviour may not change unless the change is a named departure.

## What we rebuilt on our stack

1. Renderer: hand-rolled WebGL2. No engine, no framework.
2. Characters: a Morrowind-style 3D replacement for the paperdoll, items, weapons, and in time NPCs and enemies, the
   player's own first- and third-person look first (Mac). The rules are in `02-Formats/Morrowind-Rules.md`. The
   voxel system stays where it stands until each piece's 3D replacement lands.
3. Runtime: browser, Vite, Node ESM. Desktop first, with a touch layer for phones (Mac): an analog stick, a
   height-normalised look, gyro aim, haptics, fullscreen and a home-screen manifest, each a pref of our own.

## Our own work (OWN-WORK)

The owner: "Our goal is no latching onto other mod authors or needing permissions. A proper 1 to 1 recreation for
everything." A feature that came from an outside mod keeps its switch, settings and behaviour, but its pictures,
sounds, models, data and words are DFO Online's own:

- **Made by our code.** The painter (`src/art/ownPainter.js`), the synth (`src/audio/synth/`) and the mesh builders.
- **Or by our rules over the player's ARENA2.** A picture that is a classic record is a spec: the record and its
  palette, never a pixel (`src/systems/classicArt.js`, `src/formats/classicPictures.js`). A spec carries no edits, since
  an edit is an author's pixel (`test/tooling/doctrine.test.js`). Texture packs are our rules over the player's records
  (`src/systems/ownTextures/`).
- **What stays.** Daggerfall Unity's MIT data (the six `dfu-` folders under `vendor/`), GrimoireUI, Layered Gearing and
  Kamer's and Kamer & Kab's work stay by the owner's word. `Own-Work.md` lists the outside work the tree carries, why,
  and the record of each folder that left.

## Non-negotiables

- Original game data (ARENA2) is freeware but not redistributable. It never enters the repo; `.gitignore` blocks it.
  Readers load the player's data at runtime or from a local uncommitted directory (`sh tools/fetch-data.sh`).
- **A render of game data is game data.** A screenshot, gallery frame, derived raster or re-shaded sprite that keeps
  the original's silhouette falls under the rule above. `test/tooling/doctrine.test.js` enforces it, since
  `.gitignore` cannot recognise a PNG of the same art. Probe galleries are generated locally and gitignored.

  **THE THIRD EXCEPTION - LAYERED GEARING, `vendor/layered-armor/` (the owner: "Approve as an exception").** The
  armour strips, cloak layer and hood fixes were drawn for the game over Daggerfall's class sprites and enemy frames,
  DFO's own work (the owner: "Layered Gear is ours"). Each file is listed with its sha256 by
  `tools/layered-armor/listing.mjs`. On by default (the owner); the profile's Skin card turns it off. That directory
  only.

  **THE FOURTH EXCEPTION - THE ENEMIES' REPAINTED SPRITES, `public/art/daggerfall-enemy-expansion-repainted/`** (Mac:
  "Approve 3rd exception", "Yes, cover all of them"). Daggerfall Enemy Expansion's repaints, Kamer & Kab's, ship there.
  `tools/dexExtract.mjs` refuses any picture that is a TEXTURE record exactly (those are built from the player's files
  by `src/formats/derivedTexture.js`) or follows a record's outline outside that directory. That directory only.

  The first and second exceptions are retired: our own rules build Vanilla Enhanced's, the desert's and the winter's
  looks from the player's records, so no repaint ships for them. The two left keep their numbers, which every row of
  their art carries. `test/tooling/doctrine.test.js` holds each row to its own exception's mark, so a new pack needs
  its own approval written here.
- **Arena's data (TESA1).** The Elder Scrolls: Arena is freeware and not redistributable either. The player attaches
  their own ARENA folder (the owner) and the game keeps only the files it reads (`src/scenes/dataSource.js`
  `ARENA_FILES`), in the browser. Arena's formats are translated from OpenTESArena with constants byte-exact. Online,
  rooms agree on Arena's places by SHA-256 prints only; nothing of a file crosses the wire.
- Every reader validates against the real files (ARENA2, or `ARENA_PATH` for Arena) before anything builds on it.
- No mock or placeholder data ships silently.

## Attribution

Format knowledge and game logic derive from Daggerfall Unity (MIT) and the UESP and dfworkshop format documentation.
Arena's formats derive from OpenTESArena (MIT). `LICENSE` carries the notice of every MIT work the tree ships or
ports, and the build ships it as LICENSE.txt, beside Silkscreen's licence as OFL-Silkscreen.txt (`vite.config.js`
`licenceFiles`).

**No credits (CREDITS-OUT, the owner).** "Remove all mentions of DFU, Interkarma and the nexus community. No more
credits." Nothing a player or a site visitor reads credits a work or names Daggerfall Unity, DFU, Interkarma or Nexus:
not the game, the site, the desktop app or the Discord bot. A licence's notice is not a credit, and the two licence
files are shown and linked nowhere. DFU stays the engineering reference in comments, cites and this bible (Scope
above). `test/systems/credits.test.js` holds every language free of the four names, and every `vendor/` folder to a
README of its source and terms.
