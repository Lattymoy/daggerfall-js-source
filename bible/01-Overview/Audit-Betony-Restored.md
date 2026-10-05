# AUDIT BET1 - Betony Restored, 2026-10-05

The owner, of BET1 (`03-World/Betony-Restored.md`, head `46bb6e1a`): *"Audit this"* - of the integration asked for
as *"This is the next mod I would like to integrate"*. Four lenses read it, each against the real data (the shipped
`.dfmod`, DFU's source and an ARENA2, all kept out of the repository): fidelity to the mod and to DFU (A); the hosts,
the lifecycle, the cost and online (B); the doors BET1 shares with every other mod (C); and the pins, the records and
the process rules (D). Every finding was reproduced before it was fixed. No finding needed the owner's choice; one
fix is a departure, recorded in the Port-Ledger (B2, BET-FIX 2).

Each fix is pinned in `test/bet1_betony.test.js` (BET1's own file: 24 tests to 32, three of them run with
`ARENA2_PATH`) or in the pin it moved (AUDIT 26's E3, NUDE-FLATS, WD3's loader, KEEP-PLUNDER's hooks, the doctrine's
rows). Mutation-proven: `tools/mutants/bet1.json`, 74 records (31 new, six re-aimed where this pass moved their code),
every one dead; one record of `nudeflats.json` re-aimed, and it and the fifteen records of thirteen other lists whose
code this pass touched run again - all dead. The boot-order walker (`test/bootorder.test.js`, BOOT-TDZ2) was checked
to redden on the dead zone a first draft of these fixes had (B2).

Severity: **High** breaks the owner's ask or the suite; **Medium** a wrong outcome for some; **Low** a nit, a cost or
a word. A finding two lenses made is listed once, under the first, with the other's id.

## A - fidelity to the mod and to DFU

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Low | **The update ran in fewer places than DFU's.** The mod's `IsPlayerInTown(false, true)` reads `PlayerGPS.currentLocationType`, which DFU writes only on a map pixel that has a location (PlayerGPS.cs:627) and never clears - it starts at the enum's 0, TownCity, and outlives a walk into the wilderness. The port handed in the pixel's own type, 0xffff with none: past a town's edge a dawn changed no one in the streets still standing behind the player. And DFU runs the update on every load (`WeatherManager.OnLoad` -> `SetWeather` -> `OnWeatherChange`). (B6.) | `createBetonyLocationType`: TownCity before any location, noted each frame from the pixel's own and never cleared; the update reads it. The load is B2's: a pixel's people take the hour as they stand. Pinned: the type's every step, the update in the wilderness after a village and not after a dungeon's pixel, the context by value. |
| A2 | Low | The port raises the location rect's entry on every teleport (AUDIT 26's F062 seam); DFU only on a new game, a load and a fast travel. | Recorded below. |
| A3 | Low | The roads' reason was wrong: "the mod loads after its dependencies" - Basic Roads is no dependency of Betony's manifest. Basic Roads reads its arrays through `ModManager.TryGetAsset` (BasicRoadsTexturing.cs:126-139), which answers from the mod loaded LAST; DFU's default order is the mods folder's listing (`basicroads.dfmod` before `betony restored.dfmod`), so the island's arrays answer, as the readme expects. (D10.) | The comment (`withBetonyRoads`) and the page say so; the port takes the default. |
| A4 | Low | A misc light flat (archive 210) with a faction would be a street person here, where DFU's `AddMiscBlockFlats` passes every 210 over (RMBLayout.cs:340-344). None is placed: Daggerfall's 920 RMB blocks and the three packs carry none. | Recorded below. |
| A5 | Low | BET-FIX can fire on no vendored data: the away arm acts on individuals alone (a faction of type 4), and no street person of Daggerfall's, of this mod's or of the town mods' carries one. | The departure is said to be DEFENSIVE (the module, the page, the ledger): a block a later mod lays may carry one. |

## B - the hosts, the lifecycle, the cost and online

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | Medium | Online, a missing Betony pack refused every home. (C1.) | C1. |
| B2 | Medium | **The market was the events this client had seen.** (a) A dawn passed indoors left the street as it was until the next edge - DFU's own behaviour; (b) the port builds and rebuilds pixels where DFU keeps its GameObjects (a season's flip, the roads arriving, a pin's town), and a rebuilt street stood every trader up at any hour; (c) two players in one room saw two markets. | **BET-FIX 2, a recorded departure** (Port-Ledger A): THE STATE, NOT THE HISTORY - a pixel's people take the mod's hours and rain as they stand (after the quest's pass: its word stands), and the street takes them again on the way out of a building (`onTransitionExterior`). Pinned on world.js's own stand, run over a test host: a market stood at night draws no one who hides by night, by day the others, and everyone as laid while the mod is not loaded. The host state this reads is declared before the start pixel stands - the fix's first draft read it from three thousand lines below the start pixel's build, a dead zone at every boot with the mod on; BOOT-TDZ2's walker and BET1's own pin both redden on it. |
| B3 | Low | **Init ran before the loader on one boot path.** The classic skin's splash boots the audio, and every Init with it, before any world is read: Init found the latch unanswered, latched the switch itself and registered Lord Mogref - in a game whose pack then did not land, and the save kept him. | Init WAITS for the loader's latch (answered nothing while it is unanswered) and the loader calls it once every pack is latched (`scenes/modWorldData.js`). Every host runs the loader before its chargen and its load (world.js, exterior.js, interior.js, dungeon.js), so a new character's dictionary still takes him. Pinned: unanswered - no faction, no word, no latch of its own; latched off - nothing; latched on - the faction and the two lines, once; the loader's call after the latch. |
| B4 | Low | Every edge stood a market of a hundred again from nothing - 96 batches freed and 80 built at a dawn. | The stand plans over the batches standing (`exteriorNpcs.js` `planNpcBatches`): a group whose people are the same keeps its batch, the rest are built, the gone freed - held by their group's signature (the picture and every centre, in order) until they are, never written on a batch (PERF-EXT10's shape law caught a first draft that did). Pinned: keep, build and free over a market's changes; the signature's order. |
| B5 | Low | The rule also schedules Beautiful Villages' markets (279 flagged street people) and Beautiful Cities' (71) - DFU-faithful for a player of all three, and said nowhere. | Said on the page and in the registry. |
| B6 | Low | The sticky location type. | A1. |
| B7 | Low | **Two stands over one pixel's batches at once**, and a re-stand's promise left unhandled. Reproduced on the shipped stand: a re-stand asked for while the pixel's own stand awaited its picture drew both stands' people - the trader dusk took down stood on until the next edge. | ONE STAND AT A TIME: every stand of a pixel takes its turn (`npcStandTurn`) and gives it back, failed or not; a stand that fails part-way leaves nothing standing that the next cannot see; one whose turn comes after its pixel's teardown touches nothing; Betony's re-stand says its failure. Pinned on world.js's own stand: the later stand's people alone, nothing standing that nothing holds, the turns in order, a failed stand's turn given back, nothing freed twice on a pixel already gone - each wait bounded, so a broken queue fails rather than hangs. |
| B8 | Low | Outside the slice, UNVERIFIED: a sweep that rebuilds the player's own pixel may raise the rect's exit and entry (the crime clear). | Recorded below. |

## C - the doors BET1 shares

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Medium | **A pack of new places counted as a town pack.** `worldDataPacksMissing` named every packed mod whose pack did not land: online, a missing Betony pack (the network, a browser with no DecompressionStream) refused every home, hall and yard in every town for the session (world.js `homeLayoutsHeard`, `homeTownsMissing`, the yards' `heard`) - though Betony moves no building of any town. (B1.) | `isLayoutPack` (the layout pins' own `LAYOUT_MODS`): the gate names the town packs alone. Pinned by value and on the loader. |
| C2 | Low | The same predicate switched the town mods' stand-ins on with both town mods off and Betony's pack alone on the door, and quieted every location's line for the session. | Both read `isLayoutPack`: the 25 new places are said as any location is. |
| C3 | Low | Latent case collisions under one case-blind key: (a) a registration naming no mod (a loose file, WD1's) replaced a different spelling's; (b) `findAssets` read only the key's first live entry - a higher-priority mod's `.JSON` hid a lower mod's `.json` new place. | (a) such a registration replaces one of its own spelling only; (b) FindAssets takes the first LIVE entry whose own spelling ends so. Pinned: two loose spellings - the `.json` place stands; two mods - the quiet one's place. |
| C4 | Low | A stand-in's frames were counted off the port's registry alone: an attached mod's animation over a stand-in's still picture stood still, and the page said otherwise. | `vendorFrameCount` counts the frames any tier answers (the port's, a loose file, an attached mod's), to the first missing one, as DFU imports them (TextureReplacement.cs:537-546). Pinned: an attached mod's frames 1-3 over the stand-in's 0, and Replace Game Artwork off. |

## D - the pins, the records and the process rules

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | High | **The integration's head was red.** `doctrine: no raster of game data is tracked anywhere in the repo` failed on the author's 66 pictures, which had no row: the gate reads git's index, and the integration's own suite ran before its files were added (its log has the gate passing) - AUDIT-TO1 F3's trap, a fourth time. | The vendoring tool writes its listing (`vendor/betony-restored/betony-restored.files.json` - every file under `Textures/`, the bundle's sha256), and the doctrine's `BUNDLE_ART` holds the directory to it both ways, Come Sail Away's way (the port carries less than the bundle names). Re-run from a fresh unzip, the tool wrote every other vendored file byte for byte. Pinned: the listing is the directory, and the row reads it. |
| D2 | Medium | A PIN MUST FAIL: the context the update reads was pinned on its rain alone - an inverted day or indoors test survived. | Pinned by value (the context line, the sticky type), and the update's outcome on world.js's own stand (B2). |
| D3 | Low | ONE DFU MEMBER, ONE EXPORT: `isClassicArchive` (`<= 511`) restated the port's last classic archive. | The mod's own archives by its own list (`BETONY_ARCHIVES`). |
| D4 | Low | "Fifteen of DET's flats" - twelve (`10010_0`, `_2`, `_8`, `_9`, `_26`, `_29`, `_32`, `_37`, `_39`, `_41`, `10025_1`, `10027_2`). | `world/detStandIns.js`'s head, Active-Arcs and the ledger. |
| D5 | Low | "58,812 bytes from the bundle's 4.4 MB" - the 39 files are 6,290,798 bytes of JSON in the bundle; 4,473,168 is one of the bundle's two files. | The page and the README. |
| D6 | Low | "The 437 models ... the 343 flats" - distinct model ids and flat records, not placements. | Said so. |
| D7 | Low | `'TFAC00I0.RCI'` written in `betonyRestored.js` beside the talk window's `PORTRAIT_ARCHIVE.CommonFaces` - a leaf that cannot import the window (its closure is five hundred modules). | Named once (`BETONY_PORTRAIT_FILE`) and held equal to the window's export by the test. |
| D8 | Low | `45187` "by every sign the chimney behind the wall" - the measurement does not carry the guess: three of its nine stand 248 units below their fireplace. | The page states what is measured, and that what it is is not known. |
| D9 | Low | TEST THE SHAPE THE PRODUCER MINTS: the street update was pinned on hand-made people; the producer's records carry the gender repair's bit 32 beside the mod's three. | The update over `collectExteriorNpcs` / `exteriorNpcRecord`'s own records. |
| D10 | Low | The roads' reason. | A3. |

## Recorded, not fixed

- **A teleport arms the rect's entry** (A2): the port raises `OnEnterLocationRect` on every teleport where DFU raises
  it on a new game, a load and a fast travel - AUDIT 26's F062 seam, every rect listener's, not Betony's to move. A
  teleport into a town stands its market by the hour either way (B2).
- **The boot's own stand, before the first frame** (A1): the start pixel's people stand before any frame has noted the
  player's pixel, so the type they read is the enum's TownCity, where DFU's starts. Wherever the player starts, the
  hours reach only flagged street people, and no non-town location of Daggerfall's carries one (of 5,878, one block
  has a flagged faction flat - Your Ship's `SHIPAA00.RMB` `199_10`, an editor flat neither DFU nor the port stands).
- **Misc light flats with a faction** (A4): none placed anywhere (measured over BLOCKS.BSA and the three packs); the
  port would stand one as a street person where DFU passes it over.
- **The crime clear on a rebuild of the player's own pixel** (B8): outside the slice and not reproduced; noted for the
  rect's own owner.
- **A face the RMB Resource Pack would carry**: with Flat Replacer and without the pack's pictures, DFU's talk window
  reaches for a record past TFAC00I0.RCI's 503 (`DaggerfallTalkWindow.SetNPCPortrait`, :360-382) - not run in DFU; the
  port gives DFU's own pick there, the graceful side, recorded.
