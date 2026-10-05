# FIELD BUGS 2026-10-05b - the decorator's missing pieces, its low-poly trees, and the nude figures Show Nudity missed

The owner's two reports of the day:

> 1. There seems to be a lot of missing decor items with house decoration, plus elements should recieve the low poly overhaul style like trees got
> 2. Even with nudity turned off. Players can see and have access to nude vendors

Asked which pieces were missing (three gaps were traced in the catalogue) and which elements should take the low-poly
style, the owner chose all three gaps - the town mods' furnishings, the outdoor pieces for a yard, the dungeons'
furnishings - and, for the style, a placed tree or plant standing as Low Poly Trees' own 3D tree, as the world's do.
Each change below is pinned by tests that fail on the code before it, and its pins are mutation-checked. Nothing here
was seen in a browser, so every claim is the suites'; the game's own data (ARENA2, fetched into the session's scratchpad
and never the repository) was read for the two measures alone - the dungeons' things and the town mods' pieces.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "a lot of missing decor items with house decoration" - the town mods' furnishings | the catalogue read Daggerfall's own blocks alone (WD3): nothing Beautiful Villages, Beautiful Cities or Detailed Ships furnish - the coloured beds, the paintings, tapestries and banners, the set tables and stocked shelves - could be set in a house, and the Detailed Ships flats DECOR-MODFLATS had made placeable had gone with them | DECOR-MODS |
| 1 | "a lot of missing decor items with house decoration" - the dungeons' furnishings | the catalogue read the town blocks' rooms alone: nothing Daggerfall stands only in its dungeons - a throne, a cage, a coffin, a statue, chains - could be set in a house | DECOR-DUNGEON |
| 1 | "a lot of missing decor items with house decoration" - the outdoor pieces for a yard | a yard offered the rooms' furniture alone: none of what Daggerfall stands in its streets - a fence, a well, a fountain, a cart, a lamp - and none of its trees and plants | DECOR-OUTDOOR |
| 1 | "plus elements should recieve the low poly overhaul style like trees got" - placed trees and plants | a yard's tree or plant stood as its classic picture, at the classic size, where Low Poly Trees stood the town's own as 3D trees | DECOR-LPT |
| 2 | "Even with nudity turned off. Players can see and have access to nude vendors" | HOME-VENDOR made every person Daggerfall stands in a room a catalogue piece a week after NUDE-FLATS, and no seam of the decorator asked NUDE-FLATS' table: the nude figures were offered, and one placed stood, flew and showed as itself; the Arena's tiers seat two of the table's figures, unasked too | NUDE-HOSTS |

## NUDE-HOSTS (2)

**Why.** NUDE-FLATS (2026-09-27, `Field-Bugs-2026-09-26b.md`) put Show Nudity over the world's people by asking its table
(`characters/nudeFlats.js` `drawnFlat`) at every host that stood a person ON THAT DAY, pinned by source. Two hosts came
after and never learned the rule:

- **The decorator** (HOME-VENDOR, 2026-10-03). The catalogue's Vendors are every person Daggerfall stands in a room
  (`systems/decorCatalogue.js` collectDecor reads the rooms' `blockPeopleRecords`) - the Temple of Kynareth's pair, the
  houses' and taverns' nude figures among them. The catalogue OFFERED them whatever the setting said, a placed one stood
  in the room as itself (`scenes/decorRoom.js` put), flew as itself when moved (`scenes/decorTool.js` the ghost) and
  showed as itself in the panel's lists (its thumbnails) - in every house, ship, online home, yard and hall, and to
  every visitor of a home whose owner placed one.
- **The Arena's tiers** (ARENA2). The crowd's own table (`systems/arenaCrowd.js` CROWD_PEOPLE) seats 182.48 ("blond
  whore", among the entertainers) and 184.6 ("bare-breasted wench", among the commoners), drawn as themselves.

**The fix.**

- **What is offered** (`decorRoomEntries`): while Show Nudity is off, no nude figure (`nudeFlats.js` `isNudeFlat` - the
  table's own keys) is offered in any room. Its clothed stand-in is a person of its own and stays offered, as itself.
  A figure chosen would stand as itself to every visitor whose setting is on - a piece its owner never saw.
- **What is drawn**: a placed figure stands as its stand-in while the setting is off - the stand-in's picture at its
  own size, on the piece's own base (`decorRoom.js` put); the ghost flies it so (`decorTool.js` beginPlacing); the
  panel's picture of it is the stand-in's (`thumbOf`), kept under its own key (`thumbKeyOf`, `ui/decorPanel.js`): the
  panel keeps its pictures for the session, so a setting turned off after the figure's own picture was drawn went on
  showing it in "In this room". The piece itself is unchanged - its key, name, price and station: a trader is still a
  trader, as NUDE-FLATS keeps a person's identity.
- **The crowd** (`scenes/arenaBouts.js` buildCrowd): a seat draws its picture through `drawnFlat`.
- **The sweep** (`test/nudedecor.test.js`). A rule each new host must remember is the rule the next one forgets (THE ONE
  CONSTRUCTION SEAM's lesson), so every file of `src/` that batches a billboard is NAMED in the test: a person host
  imports `nudeFlats.js` and asks `drawnFlat`; any other says what it draws instead (blood, loot, torches, foes and
  peers as mobile units, ...). A new file that batches a billboard fails there the day it lands until someone answers
  "does it draw a person?". Come Sail Away draws its vendored prefabs' people exactly as the mod lays them; the test
  holds those prefabs to the table (none of its figures).

Read when a scene is built, as NUDE-FLATS reads it: a room, a yard or a crowd stood before the setting turned is
redrawn by the next one; the decorator's own lists follow the setting at once.

`test/nudedecor.test.js` (5); `tools/mutants/nudedecor.json` 10, 10 dead (the tenth DECOR-OUTDOOR's: the decorator's one picture door, `drawnHere`). The decor pins' fakes (`test/decorFakes.mjs`)
take a room's people and per-record sizes.

## DECOR-DUNGEON (1)

**Why.** "Everything Daggerfall furnishes" (DECOR1) was read as the furniture of its houses: the scan read BLOCKS.BSA's
town blocks (RMB) and their rooms alone (`systems/decorScan.js`, `systems/decorCatalogue.js` collectDecor). Whatever
Daggerfall stands only in its 187 dungeon blocks (RDB) was no piece.

**The fix.** The scan reads the dungeon blocks too, where its host says which they are (`isDungeonBlock`). A dungeon
block has no PROP type of its own (a room's furniture is its type-3 models; an RDB model is just a model), so a
dungeon's furnishing is told from the dungeon itself by its FAMILY: the furniture and props, ARCH3D 41000-43999, where the
dungeon's corridors, rooms, stairs and vaults are 50000-98999 (the seam census's own split, `tools/seamCensus.mjs`
isArchitecture). Some things Daggerfall keeps outside the families stand free all the same, and are named
(`DECOR_FREE_STANDING`, 37) - MEASURED, not borrowed (below). A model is a piece only where it stands doing nothing: one
that acts (a lever, the throne that casts, a lid that swings) or is a door (DFU's IsActionDoor, the exit door) never is -
the same throne standing still elsewhere is. A flat is a piece but an editor's marker (foes, treasure, quests), a flat
that acts, or the climate's nature; a dungeon's people are people.

**The things outside the families, measured.** The list first shipped as World of Daggerfall's outdoor placement palette
(`LocationHelper.cs`'s `models` table, its ids among the architecture's): measured over the 187 dungeon blocks of
BLOCKS.BSA, 20 of its 34 ids no dungeon stands doing nothing (eleven rocks, two arches, the obelisk, a pillar, the slab,
the anvil, the sickle - and the claymore and the spike, which stand only acting), so they offered nothing and said what
was not so; and of the things the dungeons do stand it named 14 and missed 23 - four of the eight statues (the
commonest, 62323, stands 26 times), a second sword, a crossbow, a pedestal, a column, the casket and the coffins, the
hangings, the beams, the boulders, the arcane cage and an arrow. The dungeons stand 731 models doing nothing
outside the families: 536 under a corridor's or a room's code (C0K, R01, L5W - the corridors and rooms themselves), and
195 under a name of their own (a statue's ST1, a sword's SWD, a wall's W01), each of those looked at one by one -
rendered from the player's own ARCH3D in the scratchpad (a render of game data is game data, and never leaves it) - and
the THINGS kept: a statue, a sword, a pedestal, a hanging, a coffin - never the dungeon itself,
its structure (a wall, a stair, a floor, a platform, a pit, a cave's cone of rock), its passages (a door, a trapdoor, a
portcullis, a ramp, a bridge) or its mechanisms (a lever and its housing). 37 are: the boulders (60512, 60520), the
marble arch (62317), the wooden beams (62318, 62319, 62321), the eight statues (62323-62330: a figure standing and one
seated, small and large, in pale stone and in dark), the marble columns (74009, 74201), the stone casket (74069), the
marble coffins and their lid (74071-74073), the pedestals (74082, 74086, 74091, 74237), the domed pavilion (74094), the
arms and armour (74221 the great crossbow, 74224-74228), the arcane cage (74229), the hangings (74800, 74804, 74806,
75800) and an arrow (99800). Each is named in the source by the tag Daggerfall's own dungeon editor gave its reference
(BLOCKS.BSA's model list: ST0-ST3, SWD, PED, LRG...) and how many times it stands still; `test/decordungeon.test.js`
measures both again over the player's own blocks where ARENA2 is at hand.

A piece found only in a dungeon is **Dungeon furniture** - unless the game files it already (a bed, a chest, a shelf, a
light, a treasure). A piece a house's room stands too is the room's reading, every placement counted.

**No name moves.** A shared name is numbered in id order; numbered all together, a dungeon's pieces renamed the rooms'
(a room's lone "Vendor" became "Vendor 1" the day a dungeon's prisoner joined it, and a dungeon's light of a lower
record renumbered every "Light" above it). Each place's pieces are now numbered among themselves and after the earlier
places' (a room's first, `DECOR_FROM`): the rooms' names are exactly as they were, the dungeons' continue them.

**One constructor.** The interior host and the yards each built the scan's deps by hand; they now call one
(`systems/decorScan.js` decorScanDeps), so what the scan grows is never remembered in one host and forgotten in the
other (THE ONE CONSTRUCTION SEAM). THE FOUR HOSTS: `worldModes.js` (rooms) and `world.js` (yards) WIRED, both through the
constructor; `exterior.js` stands no decorator; `dungeonContext.js` stands no decorator - the dungeons are only read.

A dungeon's piece draws in a house as its own model, in its base textures: the room's climate table carries only the
room's own models' swaps, and a dungeon's texture table is its dungeon's.

`test/decordungeon.test.js` (5, one over the player's own ARENA2); `tools/mutants/decordungeon.json` 14, 14 dead (one
puts back the palette's four statues). Moved: `test/decor1d.test.js`'s host pin
(the measures are the constructor's), `decor1d.json`'s dungeon-block record re-aimed (still dead), `test/decor1.test.js`'s
kinds (15). `world/rdbLayout.js` exports its walk (`rdbObjects`), its action test (`rdbModelActs` - renamed: an input
binding's `hasAction` already held the name) and `EXIT_DOOR_MODEL_ID` (the census's - the catalogue's own test of it was
dead, AUDIT 05b A10).

## DECOR-OUTDOOR (1)

**Why.** HOME-YARD (2026-09-30) put the decorator outdoors on the same catalogue as the rooms - Daggerfall's indoor
furniture, doors aside. Nothing Daggerfall stands in its streets was a piece: no fence, well, fountain, statue, bench,
cart or lamp post, and none of the trees, bushes, flowers and rocks of the climate.

**The catalogue** (`systems/decorCatalogue.js`):

- **The street.** Each town block's own models (`misc3dObjectRecords`) - all but a mill (its sails turn), a city's gate,
  the town's board (GUILD1e: the hall's own piece) and the ladder (`isStreetPiece`) - and its flats, the block's own
  (`miscFlatObjectRecords`) and each building's outside (`exterior.blockFlatObjectRecords`), but an editor's marker or
  the climate's nature. A street's person is a person (Vendors, under Show Nudity). Found only in a street, a piece is
  "Outdoors" - but a light, a crate, a person, as the game files them.
- **The nature.** Every climate's set (its SUMMER archive - `formats/mapsFile.js` CLIMATE_NATURE, now exported once) and
  every record Daggerfall stands of it, 1 to 31 (the wilderness lays them all, `world/terrainNature.js` layoutNature;
  record 0 is a marker), joined whole (`addDecorNature`, the scan's `nature` - its hosts' constructor says so). "Trees
  and plants": a tree of its set's TREE_RECORDS is a "Tree", any other a "Plant", each numbered among its own set.
- **Where they stand.** The street's and the nature's pieces are a yard's alone; a yard is offered the nature of its own
  climate (`room.natureBase`, the set its pixel names) - none where it knows none. The names of every earlier place
  stand as they were (DECOR_FROM: the rooms, the dungeons, then the street, then the nature).

**The yard** (`scenes/homeYards.js`, `scenes/yardNature.js`, `scenes/decorRoom.js`'s two new doors):

- **Its town's climate.** A yard's models were drawn with the pixel's climate table, which holds only the swaps of the
  models the town itself stood: a fence the town never stood drew in another climate's wood. A yard's model now writes
  its own swaps into that table - its town's climate and season, as the town's models do (`world/texRemap.js`
  remapSubMeshes under `applyClimate`) - before it stands (`prepareModel`); the pixel publishes its town's climate
  (`townClimate`).
- **Its town's animals.** A street's cow or a flame moves with the pixel's own animator, ticked with it (`flatAnims`).
- **Its town's nature, drawn as the pixel draws its own** (`standFlat` -> `yardNature.js`): the season's archive of its
  set (the woodlands' winter twins), Seasons of the Iliac Bay's picture of the record where the mod re-skins it now
  (uploaded under the install's key, without mips - the pixel's own choice, `world/naturePicture.js` since AUDIT 05b
  A12), else the classic record - at the piece's own
  scale, mirrored when turned half round, leaning with the wind (WIND3 - by its record's height, DECOR-LPT below).
- **Stood again with its pixel.** A pixel built again (a season's turn, an install, a painted home leaving the merge)
  stands its yards again in the new table, animator and season - that very frame, as a recentre is.
- **The decorator** shows a tree in its season: the ghost, and the panel's pictures (kept under their own key while the
  season makes them another picture).

THE FOUR HOSTS: `world.js` WIRED (the yards, and the pixel's `townClimate`, the seasons' helper); `worldModes.js`'s rooms
offer neither (the catalogue's offer, `decorRoomEntries`); `exterior.js` and `dungeonContext.js` stand no yard.

`test/decoroutdoor.test.js` (8); `tools/mutants/decoroutdoor.json` 21, 21 dead. Re-aimed by content: `guild1e.json`'s
scan record, `survtiers3.json`'s two world.js cites (moved by the cite shift), and `fb1001_yard.json`'s YARD-RECENTRE
record now names one site (the room's solid model, `solid`, stands once for both paths); `test/decor1.test.js`'s kinds
(17) and `test/decordungeon.test.js`'s DECOR_FROM moved with the table; `test/nudedecor.test.js` names `yardNature.js`.

## DECOR-LPT (1)

**Why.** Low Poly Trees (LPT1, `07-Rendering/Low-Poly-Trees.md`) stands the climate's trees as the mod's 3D trees near
the eye and as their own far pictures beyond - the world's pixels' and the `?exterior` host's. A yard's placed tree
(DECOR-OUTDOOR) was drawn by its own door, `scenes/yardNature.js`, which never asked the mod: in a wood of 3D trees, the
trees a player placed stood as the classic pictures, at the classic size.

**The fix** (`scenes/yardNature.js` picture and stand, `scenes/homeYards.js`, `scenes/world.js`). A placed tree or plant
the mod has a tree for stands as the world's do:

- **Far, its own picture**: a batch of the yard's, sized for the tallest tree with the piece's scale on its corner, giving
  way near the eye to its 3D tree (`lptProto`) - its handle HELD while the piece stands and let go with it, as a pixel
  holds its own (EVERY ALLOCATION HAS AN OWNER). A yard's flats stand outside MAC1's far rings (`world.js` lists them
  apart), so it carries no far height (AUDIT 05b A9 struck the `farH` this slice set).
- **Near, the tree itself**: in the yard's near set (`yardTreeSet`, a pixel's own shape) at the yard's place now
  (`homeYards.js` treeSets - a recentre moves it with its pieces), gathered with the pixels' (`world.js`
  lowPolyTreesFrame). Its scale is the piece's (a location's tree stands at the prefab's own size, scale 1), its turn
  the piece's (`yardTreeYaw`: the record's yaw, the way a model turns), its lean its far picture's (recorded for its
  prototype as the pixel's is, `_lptSway`). A tree turns in earnest, so its picture never mirrors (DECOR-FLIP mirrors a
  flat turned half round).
- **Its lean is its record's** (WIND3's rule: a tall record sways whole, a short one six tenths). The yard read the
  height at the piece's scale, so a bush scaled up leaned as a tree - fixed for every yard piece, the mod on or off.
- A record the mod has no tree for, or the mod off (its switch, `?trees=off`, data that will not load), stands as before.

**The ghost.** The decorator asks the host for the picture a flat it stands its own way WILL stand as (`decorTool.js`
flatPicture; a yard answers with `yardNature.js` picture - the one door its pieces ask), so the tree placed is the tree
that stands, never mirrored, its handle held while it is placed and let go when the placing ends. The same door fixes
DECOR-OUTDOOR's ghost under Seasons of the Iliac Bay: it showed the classic record of the season's archive where the
piece stands as the mod's picture. The panel's list keeps the record's own icon - the tree it names.

THE FOUR HOSTS: `world.js` WIRED (its Low Poly Trees handed to the yards, their near sets gathered with its pixels');
`exterior.js`, `worldModes.js` and `dungeonContext.js` stand no yard.

`test/decorlpt.test.js` (8); `tools/mutants/decorlpt.json` 14, 14 dead. The yard rig moved to `test/decorFakes.mjs`
(`yardWorld`, shared with `test/decoroutdoor.test.js`, which pins the lean by record now). Re-aimed by content:
`decoroutdoor.json`'s three tree records and `fieldbugs27g.json`'s DECOR-FLIP ghost record (both still dead).

## DECOR-MODS (1)

**Why.** DECOR1's law was "everything Daggerfall furnishes ... nothing carried over from a mod", and WD3 (2026-10-01) kept
it when the town mods came: the scan reads BLOCKS.BSA past the world-data door (`systems/decorScan.js`), so the 1,400
interiors Beautiful Villages and Beautiful Cities redecorate would never renumber the catalogue nor leave it when a mod
went off. The owner asked for the mods' furnishings. WD3's rule also took back what DECOR-MODFLATS (2026-09-27) had made
placeable - Detailed Ships' own flats, which the scan had read out of its ships through the door.

**The pieces** (`systems/decorMods.js`) are the port's own stand-ins for what the mods place (`world/townStandIns.js`,
`world/detStandIns.js`, `systems/detailedShips.js`), MEASURED over both packs and Detailed Ships' two ships rebuilt from
the player's BLOCKS.BSA: 297 - 223 a room's (any of it stands inside: offered in every room, and a yard) and 74 a
street's (all of it stands outside: a yard's alone) - each counted as the mods place it (the panel's "most common
first"). The beds (18), the paintings (62), Rosy's hangings and rugs, DET's tapestries and banners (the regions', the
Eight's, the decorative), its pillars, ensign staff, stump, flower pot, wind vane, column drum, sea chest, weapon rack
and rugs; Cliffworms' bottles and his statuette; the galley's food, the stores' odds and ends, the towns' set tables and
stocked shelves; outside, the boulders, the market stalls, a column's head, the fowl, sheep, cattle, horses and doves,
the grain, a temple's garden rows. Never the town's own structure - its hills, a temple's platform and foundation, the
roofs' domes, the docks and their ramp and steps, the city wall's fill, a chimney - nor the crop fields (a field sown by
id, no model), nor the dolphins (drawn to break the sea's surface, half their picture under it). Two ids the port stands
in alike are offered once (`DECOR_MOD_TWINS`, the count both's), and DET's old archive numbers are their new ones'.

**While they stand.** A piece is offered while the port stands it - its stand-in's own switch, the one the mods' towns
are drawn by (a town mod loaded for the game, or a save's town pinned to one; Detailed Ships' own switch for its ships'
pieces; online the town mods are on for every player) - and a piece placed stands while its mod does, as the mod's
towns do: a mod switched off offline is a mod never loaded, its pieces with it. AUDIT 05b A3: every piece is in the
catalogue whatever is on, and the switch is asked as the piece is offered (`decorModsLive`, `decorRoomEntries`) - the
slice asked it once, when the catalogue was read.

**Named and filed** as the port names them: a bed by its colour (`Blue bed 1-3`, filed with the beds - its classic
bed's kind, `as`), a hanging by its picture (`world/townPictures.js` - "Tapestry of Glenpoint", "Banner of Akatosh"), a
drawn sprite by its drawing (`world/standInSprites.js` - "Dove", "Cheese wheel"), a flat that stands in as one of
Daggerfall's by that one's kind (a jar on a shelf among the Boxes and bottles); else "Town mods' furnishings" (a new kind)
or, outside, "Outdoors". Numbered AFTER every place of Daggerfall's (`DECOR_FROM`: the mods' rooms, then their streets),
so no name of Daggerfall's moves - Daggerfall's boxes keep their numbers, and the mods' are numbered after them.

**Measured, so priced.** The scan measures a stand-in off its own model (its farthest point from its origin -
`standInRadius`; one built over the player's own models is the pipeline's to build, never the scan's) and a coloured
bed off its classic bed (`classicModelIdOf`).

THE FOUR HOSTS: the catalogue is the decorator's (`worldModes.js`'s rooms and ships, `world.js`'s yards - both through
the one constructor, `decorScanDeps`); `exterior.js` and `dungeonContext.js` stand no decorator.

`test/decormods.test.js` (5, one over the player's own ARENA2 - every stand-in the mods place offered with the count and
the place measured, or left out by why); `tools/mutants/decormods.json` 12, 12 dead. Moved: `test/decor1.test.js`'s
kinds (18), `test/decordungeon.test.js`'s DECOR_FROM; re-aimed by content: `decoroutdoor.json`'s tree-name record,
`guild1e.json`'s board record and `homevendor.json`'s people record (all still dead). `03-World/Beautiful-Towns.md`'s two
notes that kept the stand-ins out are amended.

## AUDIT 05b

The owner, of this record's pull request (#620): *"audit this"*. The code-review pass read the whole diff against its
merge base with main, ran its pins and gates, and re-read the catalogue against the real game data in the session's
scratchpad (none of Daggerfall's 312 existing names or kinds moves; no house uses a tree picture; every climate's tree
set has the 32 records the catalogue assumes). Thirteen findings; each was read against the code, A1 and A2 reproduced
by a throwaway test, and every fix below is pinned by a test that fails on the code before it (its mutant dies).

Severity: **Medium** a wrong outcome a player meets; **Low** a cost, a leak on a failure path, a nit, or dead code.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Medium | **A tree landed a recentre off its yard.** The room hands a host-stood flat the origin it stands from (`decorRoom.js` standOwn), and `restand()` moves only a batch already standing: a tree whose picture was still loading when the world recentred stood at the old origin - 100 m from its own 3D tree - until the yard was set again. | An answer landing after a `restand()` is moved by the recentre it missed (`standOwn`). Pinned: `test/decorlpt.test.js`; `DECORLPT-late-unshifted`. |
| A2 | Low | **A placed tree's row showed "De".** The placed list read an entry's `count` as "found in the catalogue"; a tree, a plant and a hall's board are the catalogue's own at a count of 0. | `decorTool.js` asks the catalogue for itself (`catalogued`); the fallback stays the fallback. Pinned: `test/decoroutdoor.test.js`; `DECOROUTDOOR-placed-uncatalogued`. |
| A3 | Medium | **The mods' pieces were fixed once a session.** The switch was asked when the scan finished and the scan is built once: a mod turned off left its pieces for sale (bought, never drawn); one turned on, or a pack landing later, was never offered or priced until a reload. | Every piece catalogued whatever is on (no name moves with a switch); `decorRoomEntries` offers a mod's piece by the keys standing now (`decorModsLive`), asked as the panel opens and every `DECOR_MODS_LIVE_S`; a piece standing only later is measured then (`decorScan.js` remeasure) and the list redraws as it lands (`lateSized`). Pinned: `test/decormods.test.js` (the scan, the real decorator); four new records in `decormods.json`, three re-aimed. |
| A4 | Medium | **A yard rebuilt under the open decorator stood the town's answer.** DECOR-OUTDOOR's rebuild skipped HOME-YARD's hold: a hall's other keeper's write the panel held back stood under the decorator mid-edit. | While the owner writes the yard, a move or a rebuild stands it again as it stands, and the town's answer waits (`homeYards.js` sync, `holding`). Pinned: `test/decoroutdoor.test.js`; `DECOROUTDOOR-rebuild-unheld`, `DECOROUTDOOR-rebuild-sig-taken`. |
| A5 | Low | **A model's ghost flew in the base climate.** A model's swaps reach the yard's table only when a piece of it stands (`prepareModel`); the ghost was drawn with the table before, and the panel's preview with none. | The decorator asks the host's law once for each table it draws a model with (`decorTool.js` inLaw, `prepareModel`); the yard hands its `climateOf` and its table to the preview too. Pinned: `test/decoroutdoor.test.js` (the yard's ghost, the preview's law); four records. |
| A6 | Low | A tree's ghost held its far picture for the session when the classic texture would not load: one failed ask threw the three answers away together. | Each ask fails on its own (`decorTool.js`). Pinned: `test/decorlpt.test.js`; `DECORLPT-ghost-leaks`. |
| A7 | Low | The offer, read every frame the panel is up, built a key for every flat to ask NUDE-FLATS' table. | Each entry says once whether it is nude (`decorCatalogue.js` `nude`). `NUDEDECOR-flag-unset`; `NUDEDECOR-offer-ungated` re-aimed. |
| A8 | Low | A hanging was named off its built model - every stand-in's geometry built in the scan's last step (36 ms cold), and none named while its switch was off. | One table of the pictures, read by the builder and the name alike (`detStandIns.js` DET_PICTURES, `townStandIns.js` ROSYS_PICTURES); a coloured bed filed by its table (`townBedOf`). All 297 names and kinds are the slice's, on, off or uninstalled. Pinned: `test/decormods.test.js`; three records. |
| A9 | Low | The yard's tree set `farH`, which nothing reads (a yard's batches never meet the far rings), and a pin asserted it. | Struck; the pin says it is none; `DECORLPT-far-rings-unread` retired. |
| A10 | Low | The dungeon walk's test of the exit door was dead (70300 is no furnishing). | Struck from the catalogue; the census keeps the export (`rdbLayout.js`). Two `decordungeon.json` records re-aimed. |
| A11 | Low | `addDecorMods` wrote the key's format out again. | `decorKey`. `DECORMODS-key-own-format`. |
| A12 | Low | **Three copies of one choice** (THE ONE CONSTRUCTION SEAM): the town's pixels, a location's flats and DECOR-LPT's yard each chose a nature flat's picture - Low Poly Trees', the season's (its key, its upload), the record - the yard's copy already short of the town's. | `world/naturePicture.js`, every host's one choice; `test/naturepicture.test.js` sweeps `src/` (no other file writes the season's key or asks the door for a far picture); SIB1's and TEX1's host pins moved to it; `tools/mutants/naturepicture.json` 7. |
| A13 | Process | The pull request conflicted with main (#629): no workflow runs on a conflicted head. | Main merged in (`2990a2de`), every cite moved by `citeMerge`; and again with this audit, main's #621 and #628 (the cite-only conflicts taken from main, every cite moved by `citeMerge`, the Suite line recounted, survtiers3's two seed records re-aimed by content). |

`test/decorlpt.test.js` 10, `test/decoroutdoor.test.js` 12, `test/decormods.test.js` 8, `test/naturepicture.test.js` 3
(new). `tools/mutants/`: `decorlpt.json` 15, `decoroutdoor.json` 28, `decormods.json` 20, `nudedecor.json` 11,
`naturepicture.json` 7 - every one dead; re-aimed by content and still dead: `decor1d.json` 1, `decordungeon.json` 2,
`guild1e.json` 1. The rigs: `decorFakes.mjs` `toolRig` takes a pin's scan deps, host law, texture door and picture door;
`yardWorld` a town answer and a clock that move, a model's box, and the models drawn. 251 cites moved by the cite shift.
