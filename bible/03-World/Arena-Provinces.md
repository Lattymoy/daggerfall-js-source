# The Arena provinces - The Elder Scrolls: Arena on Daggerfall's Tamriel (TESA1, TESA2, TESA-ONLINE, TESA3)

Opened 2026-10-12. The owner: *"I think I want to begin implementing Elder Scrolls arena into our world of tamriel"*.
Asked how, they chose **Arena's map, our engine** (Arena's cities, towns, villages and named dungeons stand on the
continent at their Arena places, built in time from Daggerfall's own pieces, as the Etheric Sea's are) over a port of
Arena itself, and **the player's own ARENA folder** (its CITYDATA read at runtime, the way ARENA2 is) over an authored
list. TESA1 is the first slice: the reader, the door, the placement and the map. Nothing is walked or travelled yet.

TAMRIEL1-4 (`03-World/Tamriel.md`) laid the continent round the Bay and TAMRIEL2 streamed its land, and left it empty -
"no towns, roads, dungeons or regions - the later use". Arena is that use: it is the one Elder Scrolls game that laid
out the whole of Tamriel, nine provinces of named places.

## The decisions, taken 2026-10-12

1. **Arena's map, our engine.** Arena's places are Arena's - their names, their kinds, where they stand - and everything
   built on them is the port's: Daggerfall's blocks, Daggerfall's dungeons, Daggerfall's rules. No Arena art, sound or
   level is read. The reference for Arena's formats is OpenTESArena (MIT, The OpenTESArena Developers), which is to Arena
   what Daggerfall Unity is to Daggerfall (Port-Doctrine, Attribution).
2. **The player's own ARENA folder.** Bethesda released Arena as freeware (2004), and like ARENA2 it is not
   redistributable: it never enters the repo or the build (Port-Doctrine, Non-negotiables, the Arena paragraph). The
   player attaches it on the Arena card; nothing of it is uploaded.
3. **Seen on the held map first.** TESA1 inks the places on the enhanced world sheet's continent, in place of TAMRIEL1's
   sixty-seven authored cities. Standing them in the streamed land is the next slice.
4. **No cost on the Bay.** The placement is made once a trace (~90 ms, off the boot's critical path, beside TAMRIEL4's own
   ~0.4 s fit), and the ink is TAMRIEL1's: one rectangle test while the sheet shows the Bay.

## The file (`formats/arenaCityData.js` - retired by TESA12, deleted)

CITYDATA.65 is the world map as a new character starts it (BinaryAssetLibrary::initWorldMapDefs reads the .65; the .0x
files are a save's copy, whose random dungeons carry the names that save rolled). A translation of OpenTESArena's
CityDataFile and the location laws beside it (ArenaLocationUtils):

| Constant | Value | Source |
|---|---|---|
| PROVINCE_COUNT x PROVINCE_BYTES | 9 x 1228 = 11,052 | CityDataFile::init; the freeware file's own size |
| a province | a 20-byte name, its world-map rectangle (four u16), 48 locations | CityDataFile::init |
| a location (LOCATION_BYTES 25) | a 20-byte name, a point on the province's own 320 x 200 map (two u16), a visibility byte | initLocation |
| the location ids | 0-7 city-states, 8-15 towns, 16-31 villages, 32 the staff dungeon, 33 the staff map dungeon, 34-47 dungeons | getLocationData, getCityType, getDungeonType |
| the province order | High Rock, Hammerfell, Skyrim, Morrowind, Summurset Isle, Valenwood, Elsweyr, Black Marsh, the Imperial Province | the file; the picker's race order (`world/tamrielLand.js` PROVINCE_OF_ID, 1-9) |

`arenaGlobalPoint` is getGlobalPoint verbatim, the integer arithmetic and all (`(x * trunc(w * 100 / 320)) / 100 + x0`);
`arenaGlobalCityId` is getGlobalCityID's `(province << 5) + city`; `arenaLocationVisible` the dungeons' 0x02. The reader
refuses any length but 11,052.

What the freeware file holds: 401 placed slots, 273 of them named. The Imperial Province is the Imperial City and sixteen
dungeon places with no names, every other slot zeroed. The fourteen dungeons of every province have places and no
names - Arena rolls a name for each when a character is made. The two staff dungeons a province have theirs (the Crypt
of Hearts, Labyrinthian, Dagoth-Ur, the Crystal Tower ...).

## The one grid - measured

Arena's world map is 320 x 200, and so is Daggerfall's picture of Tamriel (TMAP00I0, its picker TAMRIEL2). The race
screen's map was drawn on Arena's: measured on the freeware releases of both, Arena's nine province masks (TAMRIEL.MNU,
the world map's click regions) lie on the picker's provinces (the TAMRIEL4 trace) at 82-97% overlap (intersection over
union) with no shift and no scale, and no shift or scale improves any province by more than a pixel's worth. So an
Arena world point is a picture point, and a picture point is a Bay point by the frame's own fit (`tamrielFrame.js`
pictureToBay). Matching Arena's places to Daggerfall's by name was tried first and refused: the two games' Iliac Bays
disagree (Arena puts Wayrest north of Daggerfall, Daggerfall puts it south), and only five of Arena's High Rock and
Hammerfell names are places of Daggerfall's.

## The placement (`world/arenaPlaces.js`)

A place is stored on its province's own map and projected by the province's rectangle - and that projection is coarse:
Skyrim's north-coast cities land in the Sea of Ghosts, Elsweyr's northern towns in Valenwood, Summurset's in the
Abecean. The province maps were not drawn to the rectangles' edges. So:

- **The point in fractions** (`arenaWorldPoint`): getGlobalPoint's ratio without its truncation - a world pixel is 15 km,
  and the province map's own resolution is about four times finer.
- **The cloud's fit** (`fitProvinceCloud`): each province's places, as one cloud, onto that province's land on the
  trace (`provinceLand`, provinceKeyAt's own reading over one mask a province) - one scale about the rectangle's
  centre (FIT_SCALES, 0.60 to 1.10) and one shift (FIT_SHIFTS, -12 to 12 picture pixels), the Bay's own fit's shape
  (TAMRIEL4 refused a scale a side). THE COUNT'S BIAS: a cloud shrunk far enough stands every place on some land, so
  the most places on their land does not choose the fit alone - of the fits within FIT_SPARE (1) of the most, the one
  that moves the places least wins. Arena's own rectangle is trusted until the land disagrees.
- **The snap** (`snapToProvince`): a place still off its land moves to the nearest point of its own province within
  SNAP_REACH (8 picture pixels, a circle), SNAP_INSET (0.1) inside the pixel it lands in; past that it is left off and
  counted (`lost`).

On the freeware data, on the TAMRIEL4 trace: **392 of 401 stood by the fit, 9 snapped (3.3 picture pixels at most),
none lost.** Every province fits within the search, Summurset at its edge (0.60, shifted 6 west and 10 south): Arena
spreads Summurset's places far wider than the picture draws its isles, and they stand on the main isle.

| Province | scale | shift (x, y) | on its land by the fit |
|---|---|---|---|
| High Rock | 0.90 | -2, 4 | 47 / 48 |
| Hammerfell | 0.95 | 0, 3 | 47 / 48 |
| Skyrim | 0.85 | 0, 4 | 47 / 48 |
| Morrowind | 1.05 | 2, 5 | 47 / 48 |
| Summurset Isle | 0.60 | -6, 10 | 47 / 48 |
| Valenwood | 0.80 | 0, 2 | 47 / 48 |
| Elsweyr | 0.80 | -4, 3 | 47 / 48 |
| Black Marsh | 0.80 | 2, 2 | 47 / 48 |
| Imperial Province | 0.95 | 1, 2 | 16 / 17 |

**On the trace only.** The one grid is the picture's. TAMRIEL1's authored shape was drawn from the lore map, not on
Arena's grid, and with it the places stand nowhere and the authored cities stand as before - `?tamrieltrace=off`, or the
moment before the trace lands. The model is made once a trace (`arenaPlaces`, keyed on the land module's version) and
the installed city data has a version of its own (`arenaPlacesVersion`).

## The map (`ui/tamrielInk.js`, `ui/heldMap.js`)

On the trace with Arena attached, the continent's cities ARE Arena's (`arenaInkCities`): every named place beyond the
Bay's rectangle - 248 on the freeware data. A place inside the rectangle is Daggerfall's ground and its own places stand
there (the Bay's painter inks them); an unnamed dungeon has no name to ink. A capital is one where TAMRIEL1 named one, by
name in its province - all eight are Arena city-states (Hegathe, Solitude, Mournhold, Alinor, Falinesti, Torval,
Helstrom, the Imperial City; High Rock's, Daggerfall, is the Bay's). The glyph is the kind's (ARENA_KIND_GLYPHS: a
capital the city's, a city-state the hamlet's, a town and a village the village's, a dungeon the dungeon's), the zoom law
TAMRIEL1's (capitals at any zoom, the rest once in to the Bay's own scale). The hover names the kind: "Skyrim :
Labyrinthian (dungeon, beyond the Bay)". The ink keeps the land's version as `version` and Arena's beside it as
`arenaVersion`, and `tamrielInkFor` rebuilds when either moves; the held map's static key carries both, so a pick or a
removal while the sheet is up repaints it.

## The door (`scenes/dataSource.js`, `ui/enhancedMenu.js`, `scenes/world.js`)

- **The store.** `arena`, a store of its own beside the Morrowind one (the database at version 6, the upgrade additive
  as every arm of it is). Not ARENA2's: KEEP's diet and `clearStoredData`'s recovery wipe never see it. A folder pick
  keeps ARENA_FILES alone - CITYDATA.65, by its uppercase name wherever it sits in the folder.
- **The one registration** (`registerArenaData`, the texture store's law, AUDIT VE R2): the stored file read, parsed and
  installed for every reader - by the world host at its boot, by a pick, by the card. No file, no IndexedDB or a file
  the reader refuses installs nothing, and the authored cities stand. `clearStoredArena` empties the store and takes
  the places off at once.
- **The Arena card** - Mods & files, Your files, after the packs: "The Elder Scrolls: Arena", one line, the data's
  reading, Attach data and (attached) Remove data behind the confirm. Attached is on (MWA4's law); the picker says
  "Arena's places will stand on the map of Tamriel" or that the folder held no CITYDATA.65. The menu runs before any
  host, so the card asks the store itself, once a page.
- **The host.** `scenes/world.js` registers the data at its boot, beside the trace's preload, and stands the places when
  both have landed (whichever lands second), saying once how many stood. `?arenaplaces=off` (`scenes/shared.js`
  arenaPlacesOn) installs nothing - a door for a day the fit reads a place wrong, no Features row.
- **THE FOUR HOSTS.** `scenes/world.js` wired as above. `scenes/worldModes.js` (interiors) and
  `scenes/dungeonContext.js` run inside the world host's page and open the same held map over the same installed
  places - nothing to wire. `scenes/exterior.js`, the single-town bench, traces no picture (TAMRIEL3), so its sheet
  shows no continent places: nothing to stand them on.

## Recorded departures and readings

- Daggerfall shows nothing past the Bay and DFU the same; Arena's places on Daggerfall's continent are the port's own
  (Port-Ledger section A, TESA1). The reader is OpenTESArena's, verbatim.
- The placement keeps getGlobalPoint's fractions where the game truncates (a world pixel is 15 km), and fits each
  province's cloud onto the picture's land; the verbatim integer law is exported and pinned beside it.
- The fourteen dungeons a province (and the Imperial Province's sixteen) stand without names until a later slice ports
  Arena's name roll; they are in the model and not on the map.
- Summurset's cloud fits at the edge of the search; Auridon carries none of its places.

## TESA2 - the places stand (2026-10-12)

The owner: *"Continue building"*. Arena's 248 named places beyond the Bay now stand in the streamed land - a town to walk
into, a dungeon to go down - and the held map takes the player there.

- **The pixel** (`world/arenaPlaces.js` standArenaPixels, PIXEL_REACH 3): a place stands on the Bay pixel under its point
  (the live fit's pictureToBay) where that pixel's CENTRE is its own province's land on the trace and no place before it
  (the model's order: province, then slot) took it; else the nearest such pixel within three, ring by ring and the
  nearest centre in a ring; else none. The Bay's own ground stands none (Daggerfall's places stand there), and a nameless
  dungeon none. `arenaPixels` keeps the set once a trace and a fit and makes it again when either moves;
  `arenaPlaceOnPixel` is the build's ask. On the freeware data all 248 stand on the pixel under their own point - none
  moved, none shared, none left. (Since TESA10 a capital's place stands on the capital the port built instead - its pin;
  AUDIT-TESA A7-2 moved the data test to say so.)
- **The clone** (`world/arenaLocations.js`): a NON-MUTATING clone of one of Daggerfall's own places - the Etheric Sea's and
  the spawned dungeons' law (`world/etherPlaces.js`, `world/spawnedDungeons.js`) - by the place's kind: a city-state a CITY
  (MAPS.BSA's TownCity, 30 to 49 blocks: 407 of them), a town a HAMLET (TownHamlet, 4 to 12: 1,200), a village a VILLAGE
  (TownVillage, 2 to 4: 1,834), a staff dungeon a LABYRINTH (1,500) and a staff map dungeon a KEEP (843), each a dungeon's
  with its blocks. Never a main-story place (`isMainStoryDungeon`), never a town with a dungeon under it (the three
  capitals' castles), never a place the port made (a spawn, an isle's, an Arena place's own). The rows are the game's as
  MAPS.BSA holds them (HUB1's law), the template picked off `hash32(ARENA_PLACE_SALT, province, slot, 3)` in map-id order:
  the same town every session. Winterhold stands a 6 x 7 city of 243 buildings. The clone keeps the template's blocks
  and buildings by reference and carries Arena's name, its own MapId, its own location index, the pixel's longitude and
  latitude, the region and climate the pixel answers (the climate the province's, TAMRIEL2; the region the clamp's
  until TESA3), no harbour, and `arena` (province, slot, kind).
- **The id**: ARENA_PLACE_SALT (0xa7) in the high 12 bits, apart from every other lane, and ARENA_PLACE_BASE (500000)
  plus the place's ordinal (province x 48 + slot) in the low 20 - past every Bay pixel id, so no Arena place shares an id
  with a spawn under any salt, an isle's place or a place of the Bay. The location index counts down from
  -ARENA_INDEX_BASE (-1,000,000), past the isles' (-1000 to -403,194: 806 x 499 cells).
- **The host** (`scenes/world.js`): `arenaStands` - the land beyond the Bay streamed (TAMRIEL2) and `?arenaplaces` open.
  TESA2 stood them offline alone; TESA-ONLINE (below) stands them online too, from a release the room knows.
  `_arenaTemplates` is made off the game's rows before they go; `_locationToBuild` asks
  `arenaLocationAt` of every pixel past the Bay, which stands the clone in the index once (and takes an Arena place's
  clone out of the index when its place has gone); the built pixel keeps its Arena slot (its entry's
  `arenaSlot` - beside the colosseum's own `arena`, ARENA2).
- **Late, and changed** (`sweepArenaPixels`, sweepSdLate's shape): on the frame, when the pixels' set moves (the trace or
  the data landing after a pixel built, the Arena card's Attach or Remove), every built pixel past the Bay whose
  Arena slot is not the place standing on it now is built again.
- **A save made in an Arena town** loads into it: with the player's Arena attached, the boot's load waits for the data and
  the trace (`arenaTraced`), ARENA_LOAD_WAIT_MS (8 s) at most.
- **The journey** (`ui/heldMap.js` `_pickAt`, `ui/tamrielInk.js` tamrielCityAt): where a host stands the places
  (`setArenaStanding`, the world host's word at its mount) each inked place carries the pixel it stands on, and a press
  on one ON THE TELEPORT MAP (the Portal Stone's, the guild's) picks that pixel for the portal; the cursor points at a
  place the portal reaches. TESA-NO-FAST (2026-10-13, the owner: "fast travel shouldnt be a thing since we use portal
  stones online or the player can traverse using the overworld"): on the travel map a press beyond the Bay is no
  journey - the land past the Bay is walked or reached through a stone's portal (`06-Systems/Portal-Stone.md`). TESA2
  had made it the coordinates' own trip; that is gone. TAMRIEL1's law that a press beyond the Bay picks nothing stands
  for everything else (PIN MOVED in `test/tamriel.test.js`).
- **What an Arena town is not yet**: no house is sold in one (`scenes/worldModes.js`, the isles' rule, AUDIT CAPTAIN'S SEA
  P9 - every Arena town answers the clamp's region until TESA3, so a deed's key would own the same key in all of them);
  no spawn ever clones one (`spawnTemplates`, AUDIT CAPTAIN'S SEA P3's law); its port byte is 0. `/tp` names Arena's
  places, stood or not yet. Shot mode's probe hooks `__tesaJump` and `__tesaPlace` jump to a pixel and read what it
  stands.
- **THE FOUR HOSTS.** `scenes/world.js` stands them. `scenes/worldModes.js` (interiors - an Arena town's buildings are its
  template's, entered the same way) and `scenes/dungeonContext.js` (an Arena dungeon's halls are its template's, built
  as any clone's) run in the world host's page over the same index; `worldModes.js` keeps the house rule above.
  `scenes/exterior.js`, the single-town bench, streams no land beyond the Bay: no place stands there.

## TESA-ONLINE - one Tamriel a room (2026-10-12)

The owner: *"yes online support for everything"*; asked how a room should agree on Arena's places when the places are
each player's own copy's, *"Whatever is best and doesnt get us in legal trouble"*. Three ways were weighed: committing
the place list (401 names and points out of CITYDATA.65 - Arena's data in the repo, a render of game data under the
doctrine: refused), keeping a player without Arena off the land past the Bay online (no wall exists to keep them, and
the open Abecean and the Etheric Sea's crossing lie past the Bay's west edge: refused), and the one taken: **each player's
own copy, and a room that agrees which copy**.

- **The print** (`world/arenaPlaces.js` ARENA_CITYDATA_PRINTS, arenaCityDataPrint, isKnownArenaPrint): CITYDATA.65's
  SHA-256 as Bethesda shipped it. Measured: the 2004 freeware (1.06) and a 1996 install (another A.EXE, 170,871 bytes
  against 174,021) hold the file byte for byte, so one print covers the releases seen. A print is not game data - no
  byte of the file is in it, and nothing can be made back from it. `registerArenaData` prints the stored file and
  installs the data with `known`.
- **The room** (`setArenaRoom`, the world host's word at its mount): online, `arenaPixels` answers null unless the data
  is a known release - so every player in a room who has Arena stands the same places, on the same pixels, with the same
  ids, and their towns' and dungeons' rooms on the relay are one room (`net/wire.js` WORLD_ROOM admits an Arena
  place's `dungeon:m<id>` and `interior:m<id>.<n>`, nine digits). A copy the room does not know (a mod's, a damaged
  file) keeps its places on its own map and stands none online; offline it stands them as before. The Arena card says
  which: "CITYDATA.65 attached", or "... - not a release a room knows: its places stand offline alone".
- **Nothing of Arena crosses the wire.** No name, no point and no pixel is sent: a player's places are their own file's.
- **A player without Arena**, online, is told once a session as they first cross onto the land past the Bay (never at
  sea, on the Bay or past the Veil; `arenaBeyondNotice`, on the frame's crossing): "Players with The Elder Scrolls: Arena
  attached see its cities and dungeons in these lands. Attach your own copy (free from Bethesda) in Mods & files."
  Recorded reading: where they walk through an Arena town, the players who stand it see them pass through its walls,
  on ground the town's own flattening has moved a little; the town's people, its shops and its dungeons are the
  holders' alone, as every room's are.

## TESA3 - the province's name and its people (2026-10-12)

The owner: *"Continue"*. Past the Bay the region read is still `getRegionIndexAt`'s clamp, the Alik'r Desert (TAMRIEL2),
and every town of Skyrim said so and named its people as Redguards.

**WHY NOT A REGION OF ITS OWN.** A sweep of every region read (world.js's 35, and the rest of `src/`) found the 62
regions are a wall the whole online game stands on: `net/wire.js` CHAT_REGION_COUNT and the relay's CHAT_ROOMS whitelist,
`net/hubShards.js` REGION_CHANNELS, `net/nodeLaw.js` regionOk (professions, the market, writs, contracts, cards, halls,
chapters, receipts), `net/townSeatLaw.js` seatRegionOk, the banks' BANK_REGION_COUNT, `systems/regionConditions.js`
REGION_COUNT (prices, flags, stock) and the save's 62 legal reputations - an index of 62 or past it is refused or
silently off in each, and the bare `REGION_NAMES[r]` / `REGION_RACES[r]` reads answer undefined. Nine more regions is the
save's shape, the services' and the relay's at once - its own arc, and the owner's to call. So the province answers what
the player READS and whose NAMES they hear, and never a region index.

- **The province** (`world/tamrielLand.js` provinceKeyBeyondBay): a Bay pixel past the Bay answers the province its
  CENTRE stands on (provinceKeyAt - the trace's, else the authored rings'), or null on the Bay's own pixels (Daggerfall's
  regions answer there) and at sea. Pure: the worker's land module (it reads nothing of characters/).
- **The host** (`scenes/world.js` provinceAt, provinceHere): the province where the land beyond the Bay streams, never on
  the Bay, at sea or past the Veil. It names:
  - the loading screen and a kept screenshot's place (LOAD1's `placeAtPixel`: a location, else the province, else the
    sea or the region);
  - the Overworld's line;
  - Travel Options' new region (`regionName`), and its EDGE: the region key of the crossing is the region and the
    province together, so walking from Skyrim into Morrowind past the Bay is a new region's word.
- **The people** (`world/tamrielPeople.js` provinceNameBank): each province's DFU name bank off its race through
  GetNameBank - High Rock Breton, Hammerfell Redguard, Skyrim Nord, Morrowind Dark Elf, Sumurset High Elf, Valenwood Wood
  Elf, Elsweyr Khajiit, Black Marsh the IMPERIAL bank (DFU's own law: "Imperial names appear where one would expect
  Argonian names", NameHelper.cs:50), the Imperial Province, which no race claims, Imperial. `nameBankHere` is the one
  answer - the province's past the Bay, else GetNameBankOfRegion, verbatim - and a raid's pinned region (AUDIT NAV1)
  names by its region. It answers the talk's names and %fn/%mn (`talkFullName`, the town talk's `nameBank`), the
  stranger's name (`randomFullName`: getRandomFullName's own draw from a bank in hand, `nameHelper.js`
  getRandomFullNameOfBank, which getRandomFullName now calls - the same coin, the same stream), the quest machine's
  people (`nameBankOfCurrentRegion`), the oath's race (`raceOfCurrentRegion`) and the town's building names (the town
  talk's nameOpts).
- **What stays the region's**: everything keyed by region index - chat and presence, banks, law and the guards, prices
  and stock, seats, the services, the quest machine's local sites (place.js picks from the region's MAPS rows), the
  quest macros' own name banks, the townsfolk's sprites (REGION_RACES: Breton and Redguard art alone). Recorded: a
  traveller in Skyrim talks to Nords whose law, prices and region chat are the Alik'r Desert's.
- **Online**: names are drawn on each client, as every talk name is - nothing crosses the wire; the province is read off
  each player's own trace of Daggerfall's picture.

## TESA4 - the roads between Arena's places (2026-10-12)

The owner: *"Continue"*. The arc's third item. The places stood with no way between them; past the Bay the land carried
no road at all (and, until ROAD-BEYOND, fragments of the Bay's own - `Roads.md`).

**OUR LAW ON ARENA'S MAP.** `world/arenaRoads.js` runs the port's own road builder (`roadNetwork.js` buildRoadNetwork,
ROADS 1-21, the dials untouched) over Arena's places and draws what it routes onto the Bay pixels the painter paints:

- **The grade is the clone's** (`arenaLocations.js` arenaRoadTowns): a city-state stands as a city and a town as a
  hamlet - road nodes; a village as a village - a track node; a dungeon gets none (ROADS 1: a road to a labyrinth tells
  the player where it is). The node is the place's own pixel.
- **The window.** The builder's grid is the Bay's 1000 x 500. It is laid over the places' extent and ARENA_ROAD_MARGIN
  (40) Bay pixels round it at the least integer scale that fits - five Bay pixels a cell on the freeware's places. A
  cell's ground is the ground at its centre, read once (the continent's, `tamrielGround.js`, on the trace and the fit);
  the beach line is the Bay's (`roadsProducer.js` WATER_BYTE); the Bay's own cells are water to it, so no Arena road
  crosses the Bay's land, whose network is its own. Two places in one cell: the first is its node. The dials are the
  Bay's, kept: measured, Arena's road towns stand a median 25 cells from their nearest (Daggerfall's 1,610 stand 5.4
  pixels from theirs), inside the road reach (70), so each still takes its nearest; but a village farther than the track
  reach (20 cells, 100 Bay pixels) from a town gets no track - 56 tracks for 115 villages, where the Bay's web reaches
  most of its own. Recorded, not tuned: a dial moved for Arena would be a second law.
- **The drawing.** Each step the network takes, cell to cell, is the straight run of Bay pixels from centre to centre,
  every pixel step's compass bit on both its ends (ROADS 1's layout); each place's pixel is joined to its cell's centre
  in the grade its cell carries. The layer is a sparse map of Bay pixel to byte, roads and tracks, holding no pixel of
  the Bay.
- **Who reads it.** The painter, at the kernel's seam, for any pixel off the Bay - east, west, north and south of it -
  each byte and its corners (`terrainGen.js:"const arena = !inBay(px, py);"`), the kernel saying whether Arena's roads
  reached its paint; and the verge, which keeps the wild's flats and the Low Poly crowns off a road
  (`roadVerge.js` roadRoom). What follows the painter follows it: the grass keeps off the tiles it wrote (GRASS-PATH1),
  the Low Poly crowns off its tiles (LPT-FIT). Not read: the landforms do not cut the land along it (`landforms.js`
  armsAbout asks the Bay's pixels alone), Snowfall's tracks are Basic Roads' alone, the Bay's travel map draws the Bay.
- **Where it is built.** On the terrain worker, on its own ground, synchronously in its message loop - the jobs' answers
  keep their order. The client asks the roads' cache first (`roadsCache.js`, keyed by the generator's version and dials,
  this layer's own version, the towns, the window, WOODS.WLD's length, the fit and the trace's land): a hit's network
  goes over to be drawn, a miss's towns to be built - about two seconds on the freeware's places, once. The worker
  installs the layer for its jobs and posts it back packed; this thread installs its own copy (the verge, the fallback
  kernel). With no worker, or one that died before it answered, this thread builds it.
- **When it lands.** Each ask is an epoch. Every job posted from the ask on is built with its layer, and the host stamps
  the epoch on the pixel it posts; when a layer lands, every built pixel off the Bay posted under an older one - whose
  paint Arena's roads reached, or which the new layer reaches on it or beside it - is built again, and a pixel in flight
  is asked as it publishes (`world.js` arenaRoadsLanded, sweepArenaRoads: sweepSdLate's shape). The towns go over each
  time the places that stand move - the trace or the data landing, the Arena card's Attach or Remove, the room's word -
  on the frame, building or not (`world.js` handArenaRoads): the build is the worker's, and gated on a gap between
  builds it waited as long as the stream did (measured headless: never, while the queue kept streaming).
- **Measured in the game** (headless Chromium, the freeware's data): the layer landed 10-12 s after the places stood,
  24,530 pixels as the node build's; a straight stretch north-east of Winterhold (2155, -308) built under it painted 256
  road tiles - two wide across the pixel - seen from above. The probe surface: `window.__tesaPlace`'s `roads` (the
  epoch a pixel was painted under, whether Arena's roads reached it, the tiles the painter wrote).
- **A mount starts with none** on this thread (`world.js`: the last world's layer is not this one's); the next ask
  installs it.
- **Online** (TESA-ONLINE's law): the roads are drawn from each player's own places - none where a room does not know
  their copy - and the same for every player with the same release. Nothing crosses the wire.
- **The four hosts**: `world.js` streams the land past the Bay and is the one wired; `exterior.js` runs no tile pipeline
  (`Roads.md`), and `worldModes.js` and `dungeonContext.js` paint no terrain.

On the freeware: 233 towns and villages, 150 roads and 56 tracks routed (four pairs not - Vvardenfell's, an island), 19,563
road pixels and 5,813 track pixels, none on the Bay. Recorded: the roads stop at the Bay's edge and at the coast - no
road joins the Bay's network yet, and no port. (Those counts are TESA4's. The capitals' pins (TESA10) and the shore towns'
routing (AUDIT-TESA A3-1) move them; they are not measured again here - the data test holds TESA4's numbers until the
player's own files run it: AUDIT-TESA A7-2, open.)

## TESA5 - the crossings onto the Bay's roads (2026-10-12)

The owner, on the next item ("joining Arena's roads to the Bay's roads at its edge, and ports"): *"Do it"*. Measured
first: none of the Bay's roads leaves its edge (Basic Roads' arrays carry no arm off the map - nor does the port's own
network), but 165 road pixels lie within six of its north edge, 99 of its south and 12 of its east, where the land goes
on past it (766, 863 and 489 of the edges' pixels land on both sides; the west is the Eltheric's).

- **A crossing** (`world/arenaRoads.js` arenaJoins): where the Bay's ROADS (never its tracks) come within JOIN_DEPTH (8)
  of its edge, each run of them along the edge - runs nearer than JOIN_SPACING (60) one run - is one crossing, at the road
  pixel nearest the edge (of those, the nearest the run's middle). Its GATE stands JOIN_OUT (8) straight past the edge,
  so its window cell's centre is past the Bay at any scale to eight; the run is every pixel from the road out to the
  gate, and a crossing stands only where all of it is land - the Bay's own water law on the Bay (`isWaterPixel`, the
  fit's), the ground's beach line past it (`world.js` arenaJoinLand).
- **The gate is a road town** of Arena's network (a city's grade), so the Bay's road law routes it to Arena's towns. A
  road node now takes its window cell before a track node does: a village stood in the cell of one gate, and the first
  town a cell took was the village (TESA4's law, which had no gate to lose).
- **The run is drawn** (rasterArenaRoads): its pixels past the Bay into the roads, its Bay pixels into the layer's
  `join` - the ONE part of the layer a pixel on the Bay reads: the painter ORs it into the pixel's road byte (no corner -
  a run is straight out of the Bay), the verge asks it beside the Bay's own network (`roadRoom`), and the stale law takes
  a Bay pixel a join reaches (a pixel off the Bay's or on it). On the Bay nothing else of Arena's is read.
- **When**: the host hands the crossings over with the towns (`handArenaRoads`), found on the Bay's own network in use -
  Basic Roads' or the port's own - once that network is known (`terrainGen.roads()`); while it is still on its way
  (`hasRoads` and none yet) the towns wait for it, and a world with no Bay network joins none.
- **Online**: the crossings are each player's own Bay network's - a player with Basic Roads off crosses where the port's
  network comes near the edge. Roads are drawn on each client and never shared; nothing crosses the wire.

On the freeware with Basic Roads: seven crossings - three north (366, 548, 726), three south (169, 394, 639), one east
(row 300) - every gate on Arena's roads, 19 join pixels on the Bay; 158 roads and 54 tracks routed past the Bay.
Recorded: the joins are not drawn on the Bay's travel map, not cut by the landforms, not read by Snowfall or by World of
Daggerfall's road clearance (its camps are the Bay's, and a join is a few pixels at its edge).

## TESA6 - the ports (2026-10-12)

The owner, on the same item: *"Do it"*. Arena marks its coastal cities in the executable, not in CITYDATA: CityGeneration's
CoastalCityList, 58 global city ids (OpenTESArena's ExeData, its address maps `aExeStrings.txt` 0x3FEA8 and
`acdExeStrings.txt` 0x401E2 - the freeware is the first), and Arena's coastal city is built round the water.

- **The file** (`formats/arenaExe.js` - retired by TESA12, deleted): A.EXE (ACD.EXE on the CD) is PKLITE-packed; unpackArenaExe is OpenTESArena's
  ExeUnpacker law for law (the spec's two prefix tables, the 0x011100 special, a byte of data XORed with 16 less the flags
  read of its word) - byte-identical to it on the freeware's A.EXE, 19 ms. arenaCoastalCities reads the 58 ids at either
  release's offset where the city templates' names follow at once ("town%d.mif"), which is how a file is known to be a
  release the list is read from. The folder pick keeps A.EXE and ACD.EXE beside CITYDATA.65 (`dataSource.js`
  ARENA_FILES); nothing of the file is kept in memory but the list.
- **Measured first**: the cloud's fit draws a province's coastal ring in from the coast (Summurset's cloud fits at 0.6),
  and Arena's coastal cities stood a median 70 Bay pixels inland - 247 at the farthest (Soulrest) - none of them a harbour.
- **A coastal city stands on its shore** (`arenaPlaces.js` standArenaPixels): on the nearest pixel of its own province's
  land beside the picture's sea (one of its eight neighbours off the trace's land or off the picture - never the Bay's,
  never another province's land), ring by ring out to SHORE_REACH (320), and is a PORT (`port`); with none in reach, or
  no list, it stands as any place. A dungeon is never one. The shore search starts at the ring of the province's nearest
  coast cell (a picture pixel of its land beside the sea): the freeware's pixels take 160 ms with the shore, once a trace.
  On the freeware: all 248 places still stand, 51 of them ports, each beside the ground's own sea; the 51 moved 1 to 247
  pixels. Arena says the city is on the coast; the coast is the picture's.
- **The clone answers a harbour** (`arenaLocations.js`: `portTownAndUnknown` 1, `arena.port`), so what a port of the Bay
  has by its byte it has: its shipyard and its lighthouse on its seaward ground (SHIPYARDS, `world/portSites.js`), the
  docks off its harbour, a ship for sale at its bank. A city made a port is cloned again (`arenaLocationAt`) and its
  pixel built again (the sweep's slot carries the port).
- **The host's ports past the Bay** (`world.js` arenaPortAt, arenaPortNear, arenaPortOf - ETHER-PORTS' shape): Come Sail
  Away's port town (`csaIsPortTown`, and with it `navalNearPort`), the naval host's port here (`navalPortHere` -
  `{ key, name, px, py, region, crown: null }`: no crown's writ past the Bay, the region the pixel's own read), the
  harbour book's town (`navalHarbourNear` - its harbour sounded as any port's, its quays by QUAYS' law), the nearest
  port's name and way past the Bay (`csaNearestPort`), and the waters' distance to a port (`navalPortPx`). An Arena port
  trades the one good its key draws (`portTrade`: no crown's table). Not yet: the harbour office's contract board lists
  the Bay's ports alone, and the travel window's ship passage is Travel Options' hand-written list.
- **Online** (TESA-ONLINE's law, widened): the list moves places, so a room stands Arena's places only from a known
  CITYDATA.65 AND a known list - its print the LIST's SHA-256 (ARENA_COASTAL_PRINTS), never the file's, so a CD and the
  freeware that hold one list are one Tamriel. A copy attached before TESA6 kept CITYDATA alone: attaching the folder
  again reads A.EXE (the card's Ports row says so).
- **Measured in the game** (headless, the freeware's CITYDATA.65 and A.EXE): Solitude stands on Skyrim's north shore at
  (1691, -341), its clone a port, its build standing both of the port's places, and Arena's roads at its gate.

## TESA7 - the countryside (2026-10-12)

The owner: *"Populating the world with unique and smaller towns, farms, etc"* (the third of four asks; the dungeons, a
Morrowind of Morrowind's own and the capitals hand-built are TESA8-10). Arena's 248 places are 48 a province; the Bay
stands 15,251 on a sixth of the land. Between Arena's places the land past the Bay now stands the hamlets, villages,
farms, homes, inns, temples and shrines the Bay stands, as thick on the ground.

- **The rate is the Bay's** (`world/tamrielCountry.js` countryCounts, bayLand, countryRates): each climate stands what
  the Bay stands on its land of that climate - of each kind, the game's rows of that kind on a pixel of that climate,
  over the Bay's land pixels of it (CLIMATE.PAK and WOODS.WLD's water law, `ui/overworldModel.js` isWaterPixel). Counted
  from the player's own files at the first pixel past the Bay that asks (the Bay's half a million pixels, 11 ms on the
  freeware); nothing of the count is kept in the port. On the freeware, places a thousand land pixels: Woodlands 50.8,
  MountainWoods 46.1, HauntedWoodlands 46.6, Subtropical 44.9, Rainforest 42.1, Swamp 41.2, Mountain 19.0, Desert 12.3,
  Desert2 5.5 - Hammerfell's deserts as empty as the Alik'r.
- **The kinds**: TownHamlet, TownVillage, HomeFarms, ReligionTemple, Tavern, HomeWealthy, ReligionCult, HomePoor
  (COUNTRY_TYPES, the roll's order). Never a city (Arena's city-states are the cities) and never a place with a dungeon
  under it, a labyrinth, a keep, a ruin, a graveyard or a coven (TESA8's).
- **The roll** (countryRoll, countryPick): a pixel's own hash, `hash32(COUNTRY_SALT, x, y, 1)`, under its climate's
  ceilings names the kind; `hash32(.., 2)` the template in map-id order. Pure in the pixel and the game's rows: every
  client and every session stand the same countryside, online too (`?country=off` the kill door). Over a 500 x 500
  Woodlands window the roll stands 51.4 a thousand against the rate's 50.8.
  Over the whole continent past the Bay (the freeware's trace at its fit, (38, 57) x15.5: 5,991,777 land pixels) the roll
  stands 226,068 - 26,452 hamlets, 42,771 villages, 36,848 farms, 18,989 temples, 36,287 inns, 30,539 manors, 9,311
  shrines, 24,871 poor homes - before the water, the shore and the roads take theirs; the Bay holds 15,251 of every kind.
- **The clone** (countryTemplates, synthesizeCountryLocation): the Etheric Sea's, the spawns' and Arena's law - a
  NON-MUTATING clone of one of the game's own places of its kind as MAPS.BSA holds it (an exterior, no dungeon, never a
  main-story place nor one the port made: 1,200 hamlets, 1,834 villages, 1,841 farms, 1,043 temples, 1,646 inns, 1,399
  manors, 475 shrines, 1,158 poor homes on the freeware), its blocks and buildings the template's by reference; its own
  id, its own index, the pixel's longitude and latitude, the region and climate the pixel answers (the climate the
  province's, TAMRIEL2; the region the clamp's, as Arena's), no harbour, and `country` (its pixel, kind and template).
- **The name is the province's** (countryName): a frame of the kind's - "The %s Farmstead", "Old %f's Farm", "%s Manor",
  "Shrine of %f", "The Old %s Place" - round stems from the province's people's bank (`world/tamrielPeople.js`, DFU's
  NameGen: a Nord's in Skyrim, its 'sen' cut from a place's stem; a Redguard's first names, the bank having no
  surnames), an inn's from DFU's own tavern words (`world/buildingNames.js` TAVERNS_A and TAVERNS_B, then Tavern, Inn,
  Pub, Hostel or Lodge), a temple's an epithet and a noun of one of the Eight. The frames are the port's own words in
  the shape the Bay's names take, not MAPS.BSA's names. Drawn on DFRandom off `hash32(.., 3)` with the stream's state put
  back after (`characters/nameHelper.js` draws on the global stream). A pixel past the trace's provinces names off the
  clamp's region's bank.
- **The id** (countryOrdinal, countryPlaceId): the pixel's ordinal on a fixed grid (COUNTRY_GRID: 8,192 x 4,096 from
  (-1024, -1024), the continent's frame at the shipped fit inside it), its high bits one of 64 lanes from 0x300 (apart
  from the spawns' 1, the zone halls' 7, Arena's 0xa7, the isles' 0xe7, the Ocean Holes' 0x600 and the Abyss Dungeons'
  2049-4095), its low 19 bits the lane's number with 0x80000 set: past every Bay pixel id, so a country place's
  discovery (`systems/discovery.js` keys on the low 20) never marks a place of the Bay found. Its location index counts
  down from -COUNTRY_INDEX_BASE (-2,000,000), past Arena's. A pixel off the grid stands none.
- **The host** (`scenes/world.js` countryLocationAt): `_locationToBuild` asks of a pixel past the Bay Arena's place
  first (TESA2), else the country's. It stands none on water (WOODS.WLD's byte at or under the beach, the land past the
  Bay's law), on a pixel an Arena road or track crosses (SPAWN-ROADS' law - the roads land late: the roads sweep builds
  the pixel again and it stands none then), or where the sea's edge would flatten it onto sand (SPAWN-SHORE's
  dry-plateau law, `createCountryGround`, kept under the pixel's own key - the spawns' key is a Bay pixel's and two
  pixels past the Bay would share it). Stood in the index once, and cloned again when what the pixel stands moves (the
  trace landing moves a climate, a road). Arena attached late: the Arena sweep builds the pixel again and Arena's place
  takes it. No house is sold in a country place and no deed read in one (`scenes/worldModes.js`, the isles' and Arena's
  rule: every one answers the clamp's region). `/tp` names a stood one; `__tesaPlace` reads its `country` and kind.
- **What a country place is not yet**: on no map (the held map and the travel map ink the Bay's places and Arena's),
  on no road (the roads between Arena's places alone - TESA4's network at five pixels a cell takes cities, hamlets and
  villages, and the countryside's 226,068 are past its scale), and in no quest (the quest machine's
  sites are MAPS.BSA's rows). Its layout is its template's: the Bay's own block layouts under a new name, never a layout
  made of the blocks.
- **Online, apart**: a pixel the countryside stands and a player's known Arena stands too is Arena's for that player and
  the country's for one without Arena, and a pixel an Arena road crosses stands none for the one and the country's for
  the other - TESA-ONLINE's divergence (a player without Arena sees no Arena place), no wider.
- **Measured in the game** (headless, the freeware's ARENA2, no Arena attached): at (2198, -356) in Skyrim the roll
  stands a village, and the jump lands in it - Asgorn, a Nord's name, a 2 x 2 village of 18 buildings cloned off one of
  the Bay's, its streets and houses standing in Skyrim's ground; the eight pixels round it stand none, as the rate
  says they mostly will.

## TESA8 - the lairs (2026-10-12)

The owner: *"Populating the world with its own dungeons"* (the fourth ask). Past the Bay the land now stands its own
labyrinths, keeps, ruins and graveyards - the lairs - as thick as the Bay's, and none is a copy of a Bay dungeon:
each is laid out to a plan of its own from Daggerfall's dungeon blocks.

- **One a cell** (`world/tamrielDungeons.js` lairCellOf, lairSite): a lair an 8 x 8 cell of the countryside's grid at most
  (2^19 cells), on the one pixel of the cell its hash names. So its cell's index is its identity: the lairs' one lane
  (LAIR_LANE, 0x340, after the country places' 64) with the cell in its low 19 bits and 0x80000 set - no two lairs share a
  dungeon's identity (`net/nodeLaw.js` DUNGEON_ID_MAX, DFU's MapId & 0xfffff: a profession's veins, PROF2's witnessed
  dungeon), none a Bay place's. Its location index counts down from -LAIR_INDEX_BASE (-40,000,000), past the
  countryside's. `isCountryPlaceId` answers for it too: no house is sold and no deed read in a keep's grounds.
- **The rate is the Bay's** (lairPick): the site's climate's count of each kind over the Bay's land (TESA7's count and
  land, `countryRates` over LAIR_TYPES), times the cell's 64 pixels, at most 1; the kind in proportion; the template off
  the cell's hash in map-id order. On the freeware, lairs a thousand land pixels: MountainWoods 20.2, HauntedWoodlands
  16.3, Woodlands 15.9, Subtropical 15.0, Rainforest 14.5, Swamp 13.1, Mountain 10.9, Desert2 10.3, Desert 7.2 - a
  cell's chance 1.00 for the first three (the cap: a lair a cell). Over the continent 78,093: 28,404 labyrinths, 15,133 keeps, 20,733 ruins,
  13,823 graveyards, where the countryside stands none.
- **The kinds** (LAIR_TYPES, lairTemplates): DungeonLabyrinth, DungeonKeep, DungeonRuin, Graveyard - the game's rows of
  each with an exterior and a dungeon with an interior block (1,500, 843, 1,112 and 774 on the freeware), never a
  main-story place nor one the port made. MAPS.BSA's covens have no dungeon blocks, and none stands.
- **The plan is its own** (lairPools, lairLayout - GenerateSmallerDungeon's law widened, `world/smallerDungeons.js`): the
  template's own count of interior blocks (Daggerfall's sizes for that kind: a labyrinth 1 to 9, a keep or a ruin 2 to
  4, a graveyard 1), grown block by block from the starting block at (0, 0) into one connected shape - each step a laid
  block's side, both drawn on DFRandom seeded on the map id as GenerateSmallerDungeon seeds it, the stream's state put
  back after - each block from the pool of every interior block MAPS.BSA lays for the template's DUNGEON TYPE (79 to
  133 a type, the cemeteries' 9: so its foes and its look are the type's), none laid twice while the pool allows; the
  starting block one MAPS.BSA starts a dungeon in; every open side closed by one of the type's border blocks. Over 60
  seeds a nine-block plan is 60 different shapes. The exterior (the entrance's ground) is the template's; the dungeon
  record's header carries the lair's id and its new block count. Smaller and medium dungeons and the online sizes
  re-lay it from its own list, as any dungeon.
- **The name** (lairName): a labyrinth or a graveyard its dungeon type's frame (LAIR_NAME_FRAMES, all 19 types: "The
  Barrow of %m", "The Gaol of %s", "The Cabal of %w", "The %m Web") round the province's people's stems (`%s`, `%w`) or
  DFU's monster banks (`characters/nameHelper.js` monsterName: Monster1 for the orcs' holds and the nests, Monster2 for
  the caves and the desecrated temples, Monster3 for the crypts and the vampires' houses); a keep a castle's frame
  whatever its type; a ruin "Ruins of" a country place's name (a farm, a manor, a hovel) or a keep's. The frames are the
  port's own words in the shape MAPS.BSA's names take.
- **Its own map** (`systems/automap.js` automapKeyOf): DFU keys a dungeon's automap by region and name, and a lair's
  name repeats in the clamp's region; its key takes its map id after it - the game's places keep DFU's key exactly
  (`scenes/dungeonContext.js`, `scenes/worldModes.js`' beacon read). No spawn ever clones one (`spawnTemplates`).
- **The host** (`scenes/world.js` lairLocationAt): `_locationToBuild` past the Bay asks Arena's place, else the
  country's (TESA7, which leaves a lair to its own), else the lair's - on its cell's site, on the countryside's ground
  law (no water, no Arena road or track, no sea's edge), named off its province's people (the clamp's region's bank
  without one), stood in the index once, and taken out when the cell's roll moves. Its rates share the countryside's
  count of the Bay's land, read once. `?country=off` stands neither.
- **Online, apart**: as TESA7's - Arena's place and its roads are each player's own. A lair's room is its full map id
  (`net/online.js` roomKeyFor `dungeon:m<id>`), one a lair. Its dungeon's identity may meet an isle's ruin's (the
  isles' 500,000 and up) - two dungeons a world apart, never two lairs.
- **What a lair is not yet**: on no map, in no quest, at no road's end.
- **Measured in the game** (headless, the freeware's ARENA2): at (2179, -359) in Skyrim the cell's site stands a keep,
  Ulrik's Hold - a Nord's name, a castle's frame - on its template's castle ground (CASTAA06.RMB, 18 entrance doors);
  the player walks in through its gate and stands in its dungeon: its own plan built, one exit, 140 action objects.

## TESA10 - the capitals, built by hand (2026-10-12)

The owner: *"Can we redesign each capital city as close to 1:1 with other games. For example, oblivion's capital, skyrims
solitude, etc"*; asked whether to build from another game's files, *"You build them yourself. No files needed"*. A capital
past the Bay is no clone of a Bay city: its grid is laid out by hand, its districts of Daggerfall's own city blocks (the
player's BLOCKS.BSA - every house, shop, guild and temple with its interior and its people) round landmarks of the port's
own. Each capital's signatures in a layout of the port's own - never a copy of another game's level design or meshes. The
Imperial City is the first; Solitude (its arch over the water, the Blue Palace, Castle Dour) is next.

- **Where** (`world/tamrielCapitals.js` capitalPixel, capitalOnPixel): the capital's point on Daggerfall's map of Tamriel
  (TAMRIEL1's CITIES, `world/tamrielGeography.js` - the port's own reading of the picture) on the live fit: the Imperial
  City's (178, 96) is Bay pixel (2177, 612) on the freeware's fit. Every client's the same pixel, Arena attached or not.
  With Arena attached, Arena's place of the capital's name and province stands on it too (`world/arenaPlaces.js`
  standArenaPixels' `pinned`, capitalPin: before any other place takes it, `pinned: true`), so Arena's roads (TESA4), its
  map ink and a portal's end all lead to the city the port built (TESA-NO-FAST: no journey from the map). The fit moving (the trace landing after a pixel built)
  builds the capitals' pixels again (`scenes/world.js` sweepCapitalPixels, sweepArenaPixels' shape).
- **The Imperial City's plan** (IMPERIAL_CITY_PLAN): an island city in a ring of water. The 8 x 8 grid's outer ring is the
  lake (port blocks all water); inside it a 6 x 6 city; its four corners and the Arboretum gardens (port blocks of grass
  and the climate's trees); the 2 x 2 at its heart the White-Gold Tower's grounds (port blocks: the plaza's stone round the
  Tower's foot, Green Emperor Way's grass, the street's stone outside the ring wall); round them 26 of Daggerfall's city
  blocks by district - the Market District (a general store, an armorer, a jeweller, an alchemist, the bank), Talos Plaza
  District (a tavern, a general store and its streets of houses), the Waterfront District (a pawnbroker, a tavern and the
  thieves' block), the Arena District (the Fighters Guild, an armorer), the Temple District (a temple), the Elven Gardens
  District (houses), and the Arcane University (the Mages Guild, a library, a bookseller). Each block of a district's kind
  off the cell's hash among every block of that kind the game's cities lay (cityBlockNames: never a wall or a palace).
- **The buildings are the blocks' own** (capitalBuildings): Daggerfall names, staffs and serves a building off its
  location's list drawn by type in grid order (`systems/talkTopics.js` drawNamedBuildings); a capital's list is each
  classic block's own records (its RMB's building data - its guild's faction, its temple's, its shop's quality) in that
  order, the named ones alone, under name seeds of the capital's - so every building draws its own record, named afresh.
  On the freeware: 45 named buildings, the Mages Guild (40), the Fighters Guild (41) and a temple among them.
- **The landmarks** (`world/capitalModels.js`, the port's own models in metres, every one's origin the city's middle on
  its ground, laid as misc models of the heart's first block by DFU's own record law): the WHITE-GOLD TOWER - an octagon
  from a 36 m plinth, its shaft tapering from 25 m to 18 m and banded in gold every 40 m, eight buttress fins climbing its
  corners to 150 m, a gallery at 200 m, a crown and a gilt spire to 292 m, a dark door on the east; the OUTER WALL - eight
  sides at 311 m from the middle (just outside every city block), its corners cut across the four corner gardens, a round
  tower at every corner and at the middle of the north and west sides, its gates east and south between two towers each
  under their lintels; the RING WALL round the grounds at 96 m, open on its four axes, a turret by each gate; the BRIDGES -
  east from Talos Plaza and south from the Arena District, a deck a hand over the lake to the pixel's edge, parapets and
  piers. Their pictures are the port's own, made at boot from noise (CAPITAL_ARCHIVE 38400: marble, gold, wall stone,
  roof slate, bridge stone, the door's dark). No game data. The walkers' navgrid is closed under the Tower's foot and the
  ring wall's band (the grounds' automap), its gates open.
- **The location** (synthesizeCapitalLocation): the plan's grid on a city's shape (capitalBase: the first plain TownCity
  of the game's rows in map-id order), its own id (CAPITAL_LANE 0x341, after the lairs', the ordinal in the low 20 with
  0x80000), its own index (-41,000,000 and down), the pixel's longitude and latitude, the region and climate the pixel
  answers, no dungeon, no harbour, `capital`, and Arena's slot where Arena's place stands on it. A place the port made:
  no house is sold in it and no deed read (`isCountryPlaceId`).
- **The doors** (`world/capitalModels.js` installCapitals, from `scenes/modWorldData.js` beside installArena - behind no
  switch, as the arena's block is): the six port blocks at fixed indices from 900200 (900400 since AUDIT-TESA - past the
  Shadow Realm's 900200), the four models (climate-free), the
  six pictures. `?capitals=off` stands none: Arena's place of the name stands as any.
- **The host** (`scenes/world.js` capitalLocationAt): `_locationToBuild` past the Bay asks the capital first, then Arena's
  place, the countryside and the lairs. Stood in the index once; stood again when Arena's place on it changes.
- **Measured** (2026-10-13, the freeware with the trace's fit (38, 57) x15.5, in the browser): the pixel (2177, 612)
  stands the Imperial City - 8 x 8 blocks, 45 named buildings (the Mages Guild, the Fighters Guild and a temple among
  them), its port blocks resolving at their indices (TESALAKE 900200, TESAWGT0 900202); 7170 water tiles in its tilemap
  (the lake ring's 28 blocks). Not yet seen rendered in the game; the landmarks render in a stand-in view.
- **Superseded by TESA11**: the Imperial City above (its 8 x 8 plan, its Tower to 292 m, its walls and bridges) is
  the nine-pixel city now; Solitude and the other five stand as below.
- **Fixed in TESA10b**: Daggerfall's block rows run from the SOUTH (DFU lays a location's block row y at Unity +z,
  north; the port keeps +z north) and the plan's rows are written north to south, so the city first stood mirrored north
  to south of its plan's names; TESA10b lays the plan's rows into the grid from its last and turns the landmarks north.


## TESA10b - Solitude, and the capitals' pixel law (2026-10-13)

The owner: "skyrims solitude". The second capital, and the laws the next ones need.

- **The pixel law** (capitalPixel): a capital stands on the nearest pixel to its picture point's centre - ring by ring out
  to CAPITAL_REACH (320), in each ring the nearest centre - whose centre is its OWN province's land past the Bay
  (`world/tamrielLand.js` provinceKeyBeyondBay: the trace's, or the authored shape's where none is set), and, for a
  capital on the shore (`shore`), one of whose eight is the sea (the Bay is no sea); none where none is in reach.
  TAMRIEL1's points are drawn from memory of the lore map and the trace is the player's own picture: Solitude's point
  is at sea (the shore three picture rows south), Torval's on Valenwood's land. The Imperial City's own point is
  Imperial land: it stands where TESA10 stood it. Kept a fit and a land (`tamrielLandVersion`), and the host sweeps when
  either moves. On the freeware with its trace: Solitude (1565, -434), the sea to its north and west.
- **A plan reads as a map** (capitalBlockNames): its first row the north; the grid's row y is the plan's row
  (height - 1 - y). The landmarks are drawn as the map reads (+z south) and turned into the world's frame where they
  are installed (`world/capitalModels.js` northward: every z and normal's z negated, every face's winding turned back).
- **A capital's own blocks** (`blocks`, by the plan's cell; capitalPortBlocks): the port's own blocks whose ground,
  trees and closed cells are laws of the metres from the capital's ANCHOR (a column and a row of the plan's lines; x
  east, z south - anchorMetres), the first of them whose square has the anchor on it (capitalCarrier) carrying its
  models there. The lake and the garden stay every capital's; the Imperial City's grounds are its own blocks now, their
  indices unmoved (900202-900205), Solitude's after them (900206-900214).
- **Solitude** (SOLITUDE_PLAN, SOLITUDE): the Sea of Ghosts along the grid's north row and the Karth down its west two
  columns; the city walled on the land between them, fields south of its wall. In the river's mouth a sea stack
  (30 m) with the Blue Palace on it - its long hall under a gable of blue slate, the wing across its east end with its
  door, a square tower with a blue spire and a gilt finial, round turrets at its corners; the great arch from the stack
  to a terrace inside the city's west wall, its deck falling from the stack's top to the terrace's (14 m), its opening
  over the river (14 m at its crown), rough rock flaring to its foot, a parapet either side, and the terrace's ramp down
  to the street. The walls dark stone with square towers - the north gate down to the docks, the main gate south, the
  west side open where the arch meets it. Castle Dour in the east: a square curtain with corner towers and its gate to
  the city, the keep under a slate gable, the Emperor's Tower (46 m) in its yard. The docks on the quay below the north
  wall: its kerb, two timber piers out over the sea, the trading company's warehouse. Twenty of Daggerfall's city
  blocks in its districts: the Avenues (the shops, the Winking Skeever's tavern), the Bards College (a library), the
  Castle Dour District (the temple beside the castle), the Hall of the Dead (a graveyard), the Well District (houses,
  the guilds, the bank). The walkers' navgrid closed under the terrace and its ramp, the north and east walls, the
  warehouse, the curtain (its gate open), its towers, its keep and the Emperor's Tower. Its pictures the port's own
  again (rock, blue slate, timber, dark stone). No game data; never another game's level design or mesh.
- **Measured** (the freeware, its trace, the fit (38, 57) x15.5, node and a stand-in view): Solitude's port blocks
  resolve; its landmarks draw in the stand-in view as laid. Not yet seen in the game.
- **Arena's coastal place pinned beside the sea stays a port** (standArenaPixels: A.EXE's list, and the sea among the
  pinned pixel's eight): Solitude's place is a port on its docks. The capital's own harbour byte stays 0 - its ships
  are not yet.
- **Then**: TESA10c, the other five.


## TESA10c - Mournhold, Alinor, Falinesti, Torval and Helstrom (2026-10-13)

The owner: "Can we redesign each capital city as close to 1:1 with other games". The five capitals past the Bay that
stand nowhere yet, each by TESA10b's laws (`world/capitalPlans.js`: their plans, districts, own blocks and measures;
`world/capitalMournhold.js`, `capitalAlinor.js`, `capitalFalinesti.js`, `capitalTorval.js`, `capitalHelstrom.js`: their
landmarks), each its signatures in a layout of the port's own - never another game's level design or mesh - its city
blocks Daggerfall's own, its pictures the port's own (ochre, bronze, cloth, crystal, bark, leaves, sandstone, red tile,
mossy stone). No game data.

- **Mournhold** (Morrowind, inland): Plaza Brindisi Dorom at the heart - a ring of low white wall open on its four axes
  round a fountain, the column at its middle with a gilt winged figure on it; the High Fane east of it, its great
  bronze dome on its drum with a gilt lantern, four domed pavilions at its plinth's corners, its porch west to the
  plaza; the Royal Palace north, three bronze domes along its roof and two domed towers at its front; the Great
  Bazaar's stalls under striped awnings in the south-west; Godsreach's houses, the Craftsmen's Quarter, the temple
  district; an ochre wall round the six by six with a gate in each side and domed round towers.
- **Alinor** (Summerset, on the south shore): the Royal Palace of white stone at the city's north - its keep banded in
  gold, gilt-gabled wings, four corner spires under gold cones and its great tower with a gilt crown (about 100 m); the
  Crystal Tower on its isle in the harbour - six faces of crystal to 179 m, six lesser shards round it; the harbour's
  quay and four piers; white walls on the three landward sides with slender gold-capped towers, the harbour open.
- **Falinesti** (Valenwood, inland): the Great Graht-Oak at the heart of the city - its trunk from 34 m across its foot,
  ten buttress roots over the grounds round it, nine great limbs out over the streets, a crown of leaves 320 m across
  above the whole city, and three timber platforms round its trunk; no wall but the forest.
- **Torval** (Elsweyr, on Topal Bay): the Mane's Palace - crenellated sandstone under a great red-tiled dome with a
  gilt finial, a minaret at each corner; the Temple of the Two Moons on three terraces south of it, Masser's dome red
  and the greater, Secunda's white, a stair north to the palace; the quay and piers on the bay; sandstone walls with
  domed square towers on the landward sides.
- **Helstrom** (Black Marsh, inland): the Great Xanmeer - five tiers of mossy stone to 30 m, a stair up each face, a
  shrine on its top; the Hist on its isle in the canal that crosses the city, twisted, its sap gilt on its bark; two
  boardwalks over the canal; marsh water and hummocks round the city, and a palisade of sharpened logs broken for its
  north and south gates and the canal, a watchtower on stilts at each corner.
- **Their pixels** (the freeware's trace): Mournhold (3293, 550) and Falinesti (1247, 1449) and Helstrom (3355, 1108)
  on their own points; Alinor (7, 1533) on the shore, the sea south; Torval moved off Valenwood's land to Elsweyr's
  shore (1922, 1704), the sea south. Tested on TAMRIEL1's shape where no trace is set: each on its own province's
  land, the shore capitals beside the sea, no two on one.
- **Measured**: their landmarks draw in the stand-in view as laid. Not yet seen in the game.

## TESA10d - a capital on the map, Arena or none (2026-10-13)

The owner: "Do we really need Arena attached?" - no. The capitals stand on their own (the port's plans and landmarks,
Daggerfall's blocks). Where a host stands the capitals (`world/tamrielCapitals.js` setCapitalsStanding, from the world
host's boot: the land past the Bay and the capitals' door open), each capital the held map inks - TAMRIEL1's cities with
no Arena, Arena's places with it - stands on the capital's pixel, and on the teleport map a press on it is a Portal
Stone's portal there (`ui/tamrielInk.js` capitalStandsAt, `ui/heldMap.js`'s press as TESA2's - TESA-NO-FAST: never a
journey from the travel map). The ink is made again when the standing changes. In the game: use a Portal Stone, zoom
out past the Bay, press the capital; or walk.

## AUDIT-TESA - the arc, audited (2026-10-13)

The owner: "Lets do a comprehensive audit across everything so far". `01-Overview/Audit-TESA.md` is the record - seven
lanes, every finding's verdict. What it changed here, by id:

- **Arena's names** (A1-1, A1-2): an Arena place's automap key is its map id (`systems/automap.js` automapKeyOf), the
  party pose and a discovery carry no name of it - a capital's name is the port's and stays.
- **A quest's site past the Bay** (A2-1): `scenes/world.js` placeByName - MAPS.BSA's, else the place the world stands.
- **The capitals' ground** (A6-1 to A6-5): start markers on each carrier block; each capital's gardens its own blocks
  (`capitalGardenName`, `TESG<tag><row><column>.RMB`), and every block of a capital closed where its models stand at a
  body's height (`world/capitalModels.js` capitalFootprint), its trees off them - built when first read; the blocks
  from 900400; the Imperial City's wall at 317 and Solitude's walls out of the houses' blocks, Helstrom's walks to the
  banks; an inland capital's CUST blocks its dry ones (`dryKinds`); a closed cell's byte 0xfe (`CAPITAL_CLOSED_BYTE`).
- **The world host** (A7-1, A2-3, A2-4, A2-5, A4-F2 to A4-F4, A5-F3): the load's wait whenever a place past the Bay
  stands; the countryside and the lairs rolled again when the land moves; the rise past the Bay at the nearest town
  standing there; the province's people's names in its towns and buildings; a capital's pixel never cloned over; the
  harbour book by map id; the Bay's pixel ids read on the Bay alone; a ship's port past the Bay its Arena place's; no
  deed read in a place the port made.
- **The roads** (A3-1): a shore town's cell its land. **The switches** (A7-8): `?capitals=off` and `?country=off`
  offline alone.

## TESA11 - the Imperial City over nine pixels (2026-10-13)

The owner: *"the imperial city needs to be much larger and be split into distinct districts with the tower very large.
The entire city also needs to be lore accurate to daggerfall"*; asked, *"3x3 pixels"* and *"Canon layout, DF era"*. It
supersedes TESA10's 8 x 8 Imperial City (its plan, its Tower to 292 m, its walls and bridges, and AUDIT-TESA A6-3's wall
at 317 m); Solitude and the other five stand as they were.

- **Nine pixels, nine locations** (`world/tamrielCapitals.js` capitalSpan, capitalCentre, capitalSliceOrdinal,
  capitalSliceName): Daggerfall's engine stands one location on a pixel, eight blocks a side at most. The city stands on
  three pixels a side (`world/imperialCity.js` IMPERIAL_SPAN, 2.46 km across), each pixel's 8 x 8 slice of one 24 x 24
  plan its own location - its own map id and index (the slice's ordinal, the centre 0), its buildings' seeds its own (64
  a slice) - named for its district: Elven Gardens District, Prison District, Market District (north row, west to east),
  Talos Plaza District, Imperial City, Arena District, Temple District, Waterfront District, Arboretum.
- **Where**: the pixel law over nine - the centre the nearest pixel to TAMRIEL1's point all nine of whose pixels are the
  Imperial Province's land (the 8 x 8 city's pixel when its eight neighbours are land too). With Arena attached, the pinned place of the name stands on the centre and no other Arena place on any of the
  nine (`world/arenaPlaces.js` standArenaPixels' `reserved`: the next free pixel).
- **One ground** (`world/terrainGen.js` flattenAt): a location flattens its pixel to the pixel's own average height,
  so nine slices stood nine levels with walls at every seam. Every slice is flattened to its centre pixel's average (cached
  by its inputs), so the nine meet level; the outer edge steps to the land as any city's does.
- **The layout is the city's canon** - the wheel the later games mapped, in Daggerfall's day (3E 405, Uriel Septim VII)
  and of Daggerfall's own blocks (`world/imperialCity.js`, every cell decided from the metres about the city's middle):
  City Isle in Lake Rumare (1010 m from the middle); at the heart the White-Gold Tower on its plaza, Green Emperor Way's lawns round it
  and the emperors' eight tombs, inside the palace wall (300 m, six gates); within the city wall (900 m, four gates,
  a tower every ten degrees) the six districts on their sectors, each walled from the next with a gate - the Market
  District north-east, the Arena District east, the Arboretum south-east, the Temple District south-west, Talos Plaza
  west, the Elven Gardens north-west; outside the wall on the isle the Prison District (north of north-east, so it stands
  in the north pixel), the Arcane University south-east and the Waterfront on the lake's south shore; Talos Bridge west to
  the mainland. Recorded as the port's placing: no source the port can read gives the Waterfront's compass, nor the
  Prison's bearing finer than "beside the Market".
- **The districts are Daggerfall's blocks** (IMPERIAL_MIX, IMPERIAL_SIGNATURE): 86 of the game's city blocks by trade,
  off the cell's hash - the Market's general stores, armorers, jewellers and alchemists, the Arena District's armorers
  and the Fighters Guild, the Temple District's temples, Talos Plaza's bank and houses, the Elven Gardens' tavern and
  houses, the Waterfront's pawnbrokers, taverns and the Thieves Guild, the Arcane University's Mages Guild and a library;
  each signature once. The rest of the grid: 217 cells of lake, 22 of garden (the Arboretum's, its own blocks), 251 the
  city's own (`I<row><column>` base 36: the plaza's and Green Emperor Way's stone and lawns, a wall's foot, a
  landmark's ground, a shore) - closed where a model stands at a body's height, its gates open.
- **The landmarks** (`world/capitalImperial.js`, the port's own make, each carried by the slice it stands in -
  IMPERIAL_CARRY, `capitalModelCarriers`): the WHITE-GOLD TOWER - an octagon over a plinth 172 m across, its shaft
  tapering from 56 m to 38 m banded in gold every 60 m, eight fins to 340 m, a gallery at 494 m, a crown to 548 m and a
  gilt spire to 680 m; the palace wall; the tombs; the city wall; the district walls; the Colosseum (east, its stands in
  three tiers and its ways in); the Temple of the One (south-west, a dome and two towers); the statue of Talos on its
  plaza (west); the Imperial Prison (north, a bastion to 64 m); the Arcane University (south-east, its walls, its hall and
  a spire to 120 m); the Waterfront (its piers and lights); Talos Bridge. Twelve models (910200 to 910211), their
  pictures CAPITAL_ARCHIVE's. No game data.
- **The host** (`scenes/world.js` capitalLocationAt): a slice stood once on its pixel and again when it moves; the
  terrain job carries the slice's `flattenAt`.
- **Seen** (a stand-in view of the twelve over the plan's ground, scratch): the wheel, the districts behind their walls,
  the Tower, the Colosseum with its gate, the statue, the Prison north, the University south-east, the Waterfront south,
  the bridge west. Not yet walked in the game.


## TESA12 - the places past the Bay, the port's own (2026-10-13)

The owner: *"So with all these changes. I want to make it where attaching the arena file isn't needed (Elder Scrolls 1:
Arena). How can we do that"*; asked, *"Canon + generated"* and *"Remove it"*. Nothing of Arena is read any more: the
places TESA1 to TESA6 stood from the player's own CITYDATA.65 and A.EXE are the port's own, made on the trace from the
player's Daggerfall files, the same Tamriel on every client, online and off.

- **The cities** (`world/tamrielPlaces.js` makeTamrielPlaces): TAMRIEL1's 67 (`world/tamrielGeography.js` CITIES - the
  lore's own, placed by the port's reading of the lore map: Windhelm and Whiterun, Anvil and Kvatch, Vivec and Necrom,
  Senchal, Woodhearth, Lilmoth and the rest, the seven capitals among them), each in its province's slots from 0 in
  TAMRIEL1's order, on its point where that is its province's land, else on the nearest of it within SNAP_REACH (24
  picture pixels - the lore map's coasts lie wider than the picture's: Thorn, the farthest, 22.6). A capital's stands
  on the capital (TESA10's pin), so its roads, its ink and a portal's end lead to the city the port built.
- **The ports**: a city TAMRIEL1 sets on the sea (`port`, 30 of them: the Sea of Ghosts' four, the Abecean's, Summerset's
  and Valenwood's coasts, Lilmoth, Archon, Soulrest, Necrom, Ebonheart, Vivec on the Inner Sea) stands on its province's
  shore within SHORE_REACH (100 Bay pixels; `world/arenaPlaces.js` standArenaPixels) and is a port; one with no shore in
  reach stands as any place and is none - on the freeware's picture Anvil and Leyawiin (no Gold Coast and no Topal Bay
  there), so 28 ports. A.EXE's coastal list is not read.
- **The towns and villages** (made): eight towns and sixteen villages a province (PLACE_COUNTS: Arena's shape of a
  province - a count, no data), each a quarter inside a cell of its province's land off the Bay's rectangle and
  BAY_MARGIN, the farthest of PLACE_TRIES (24) draws off the province's hash from every place before it; named by the
  province's people (`world/tamrielCountry.js` countryName: a hamlet's or a village's stem off the province's DFU name
  bank, TESA3's), no name twice nor a city's. A town clones a hamlet, a village a village (TESA2's templates). Arena's
  staff dungeons are gone with it - the lairs (TESA8) are the land's dungeons.
- **The lane** keeps TESA2's: a province's 48 slots (PLACES_PER_PROVINCE, the provinces in the picker's order, the
  Imperial Province ninth - it stands its own cities now, Kvatch to Leyawiin), the cities from 0, the towns from 16, the
  villages from 24. The module names keep TESA's (`arenaPlaces`, `arenaPixels`, `isArenaPlaceId`): the host's seams and a
  save's ids are the same lane.
- **No Arena**: `formats/arenaCityData.js` and `formats/arenaExe.js` are deleted; the Arena card is gone from Your files;
  the prints, the room's word and the notice to a player without Arena went with them (every client stands the same
  places). The store a copy was attached to stays in the database's schema (its arms are additive) and among the asset
  stores, so a wipe still sweeps it, and the world's boot empties it once (`scenes/dataSource.js` clearRetiredArena): no
  copy of Arena's files stays in a browser. `?arenaplaces=off` is offline alone now, as the countryside's door. A town
  past the Bay is named on the wire (AUDIT-TESA A1-1's guard kept Arena's names off it; these are every client's);
  the automap key and the save's discovery still name it by its map id.
- **Measured** (the freeware's trace, the fit (38, 57) x15.5): 283 places - 67 cities (none lost), 216 towns and villages -
  ~60 ms once a trace; all 283 stood on a pixel of their own (7 pinned on the capitals, 28 ports); the roads between
  them 180 road and 51 track edges routed (20 pairs across the water not), and every one of TESA5's seven crossings on
  the roads to a town past the Bay.

## TESA13 - the land past the Bay on the held map (2026-10-24)

A tester saw nothing past the Bay "reflected on the map"; the owner: *"Does it render on the map or not. The real roads,
locations. Etc"*, then *"Yes"*. TESA1 inked the places past the Bay - the cities, towns and villages, the capitals at any
zoom and the rest in to the Bay's own scale - and nothing more: the roads TESA4 paints and the countryside and lairs
TESA7 and TESA8 stand were on the ground and nowhere on the sheet. The enhanced held map draws them now, by the Bay's own
laws.

- **The roads** (`ui/tamrielInk.js` arenaRoadInk): the layer the kernels paint (`world/arenaRoads.js`: a Bay pixel's
  byte its compass bits, the Bay's own masks' layout; `beyondPixel` the key's inverse) walked into chains on pixel
  centres and softened as the Bay's roads are (`ui/inkMap.js` pathChains), a ROAD_TILE (64) tile at a time - the layer
  spans the continent, and one mask of it would be fifteen million bytes for 34,000 road pixels. A tile's mask has a
  pixel's margin round it: traceChains follows a pixel's last bit over the tile's edge into it, so the tiles either side
  both draw that step and a road's halves meet. Stroked by the Bay's law (`inkMap.js` strokePaths, the Bay's and the
  continent's one home now): the roads at every band, the tracks dotted and never at far, each under its filter. The
  ink is made again when the layer lands (`arenaRoadsVersion` beside the land's and the places'), and the held map's
  kept layer with it (its static key).
- **A recorded narrowing**: the Bay's map never inks the port's own generated network (`10-UI/Held-Map-Arc.md`;
  `03-World/Roads.md` ROADS 22) - on the Bay it is the fallback for Basic Roads' arrays, and the map draws the mod's.
  Past the Bay there are no arrays: Arena's network is the only road the world paints, and the map draws it. The
  crossings' Bay pixels (TESA5's joins) are not drawn: the Bay's ink is the Bay's.
- **The countryside and the lairs** (`world/tamrielAtlas.js`): no list of them exists - the host rolls a pixel as it
  builds (226,068 country places and 78,093 lairs on the freeware's continent). The roll is its own function now
  (`scenes/world.js` countryRollAt, lairRollAt and lairBlocksOf: it reads the world and writes nothing), the build's
  countryLocationAt and lairLocationAt stand on it, and the map's read is the same roll in `_locationToBuild`'s order -
  no place on a capital's pixel or on an Arena place's with a template, none past the Veil, a lair only with its plan.
  The atlas keeps it a 32-pixel tile at a time (ATLAS_TILES_KEPT, 2,048, the one read longest ago let go first) and
  rolls a tile again when what the roll reads moves (atlasStamp: the land, the fit, the places standing, Arena's roads,
  the capitals). THE ROLL IS DEAR: a candidate's ground is the terrain kernel's mean (`world/spawnedDungeons.js`
  spawnPlateauFloor, 129 x 129 samples, half a millisecond) - measured, 7.1 s for a 520 x 400 view north of the Bay. Two
  answers: the ground is read through `plateauDry`, the same answer with the sum stopped once it is known (every sample
  lies between the ocean's clamp and 1, so once the sum is past the threshold even if every sample left were the
  ocean's, or short of it even if every one were 1, the rest cannot move it; the columns summed a sixteenth at a time,
  spread over the pixel; a sum ending within DRY_MARGIN of the threshold asks spawnPlateauFloor) - the countryside's
  ground alone (`world/tamrielCountry.js` createCountryGround), the spawns' own (`createSpawnGround`) untouched; and an
  ask carries a frame's budget (ATLAS_BUDGET_MS, 6): the tiles nearest the view's middle are rolled first until it is
  spent, the atlas says more is owed (takePending), and the world sheet's tick paints the kept layer again - the marks
  fill in over the next frames. The one map seam hands it to the window
  (`buildTravelMapWindow`'s `tamrielPlacesIn` and `tamrielPlacesPending`).
- **Their marks** (`ui/tamrielInk.js` tamrielMarksIn): the Bay's own laws for its marks - the classic bucket under the
  map's filters (`ui/travelMapWindow.js` getPixelColorIndex), the band's kinds (inkMap BAND_MARKS: at mid the dungeons,
  temples, taverns and towns, at near every kind), the glyph (markKind), every halo before every glyph (MAP-FIELD6) and
  each kind's hue (MAP-KEY). None at far and none out on the continent, where the atlas is not asked. The hover names
  one - "Skyrim : The Sacred Oracle (temple, beyond the Bay)", its kind in MacroHelper.LocationTypeName's word
  (`systems/travelOptions.js` locationTypeName). No press: TESA-NO-FAST keeps a portal's ends to the cities.
- **A recorded departure - no discovery law.** The Bay's map marks a place once it is discovered (DFU's
  checkLocationDiscovered); every place past the Bay is inked, as TESA1's cities, towns and villages are. The discovery
  store keys a place by its map id's low twenty bits (DFU's MapId & 0xfffff), and the countryside's sixty-four lanes and
  the lairs' share those bits (`world/tamrielCountry.js` countryPlaceId, `world/tamrielDungeons.js` lairPlaceId), so a
  discovery law past the Bay needs a key of its own first.
- **THE FOUR HOSTS.** `scenes/world.js` wired as above, at the one map seam. `scenes/worldModes.js` (interiors) and
  `scenes/dungeonContext.js` open the world host's map - nothing to wire. `scenes/exterior.js`, the single-town bench,
  traces no picture and stands no countryside: nothing to ink.
- **Measured** (the freeware's data, `tools/tesa13MapProbe.mjs`, the travel map opened in Daggerfall): Arena's roads
  land as 33,991 path pixels, inked as 1,336 road and 314 track chains; 520 x 400 pixels north of the Bay hold 3,423
  places of the countryside's and the lairs', rolled whole in 7.1 s through spawnPlateauFloor and 1.4 s through
  plateauDry - the same 3,423 - and again in 0.6 ms from the kept tiles; the sheet in to the Bay's own scale over High
  Rock north of the Bay (184 x 112 pixels) filled in with its 1,310 in three frames; zero page errors.

- **The provinces as regions of their own** - their own chat rooms, banks, law, prices and quest sites. The save's shape,
  the relay's whitelist and the account services' validators move together: the owner's call.
- **The dungeons' names** - Arena's own roll for the fourteen a province, so they stand too. What is known (2026-10-12):
  CITYDATA.65 leaves all fourteen nameless in every province (and the Imperial Province's staff and map dungeons too);
  Arena names one when a rumour sets it visible (OpenTESArena's ProvinceDefinition: "they are renamed when set
  visible"), TEMPLATE.DAT's quest text reads the name as `%tan`, and the unpacked A.EXE holds two noun lists beside the
  NPC title table (Mines, Dungeon, Cavern, Labyrinth, Catacombs, Hole, Crypt, then Fortress or Cellar). The rule that
  joins them and the seed it draws from are not in OpenTESArena or any reference this port has; reading them out of
  A.EXE's code would be a guess no test could check against the game. Left until a reference exists - a nameless
  dungeon stands nowhere, as Arena's own map shows none until it is found.
- **Roads, the rest** - TESA4 stands the roads between Arena's places, TESA5 joins them to the Bay's and TESA6 makes
  the coastal cities ports; TESA13 inks them on the held map. Still to come: the landforms' cut along the roads, the
  classic travel map's ink of them, Arena's ports on the contract board and the ship passage.
- **The capitals, the rest** - Solitude (Skyrim: the arch over the Karth's mouth, the Blue Palace, Castle Dour, the docks),
  then Mournhold, Alinor, Falinesti, Torval and Helstrom, each its own plan and landmarks; the Imperial City's
  Waterfront docks and its Arena's colosseum (both TESA11's now); houses for sale in a capital (its own region's deed key first).
- **Morrowind of Morrowind's own** (TESA9) - set aside by the owner, 2026-10-12: "Dont worry about morrowind".
- **The countryside and the lairs, the rest** - their places on the classic travel map (TESA13 inks them on the held
  map), a discovery law of their own (TESA13's departure), roads to them, and quest sites in them.

## Pins

`test/tesa13_mapink.test.js` (13, TESA13): plateauDry's answer spawnPlateauFloor's over the sea, the land, every coast, a furrow and a field about the threshold; the layer's key both ways; the roads walked a ROAD_TILE at a time and meeting
over a tile's edge east-west and north-south, roads and tracks apart; the ink made again when the layer lands, painted in
the Bay's pens under its filters and band; the atlas (a tile rolled once, never on the Bay, the asked pixels alone, the
stamp; the budget's middle-first rolling, owed once; ATLAS_TILES_KEPT, the oldest read let go first); the marks (the
buckets, glyphs, bands, filters, the pixel's centre, the frame; none at far nor on the continent; the hover's nearest
and its words; halos first, each kind's hue); the host's read in `_locationToBuild`'s order and the one roll; the
window's paint, hover, static key and the owed repaint. Mutants `tools/mutants/tesa13.json` (41, all dead). PIN MOVED:
`test/tesa7_country.test.js` and `test/tesa8_lairs.test.js` lift the roll beside the build's ask; `test/tamriel.test.js`'s
hover pin; `test/roads.test.js`'s four stroke pins (`inkMap.js` strokePaths); re-aimed and dead: `map1.json` (3), `tamriel.json` (1), `tamriel3.json` (1), `tesa10.json` (1), `tesa7.json` (7), `tesa8.json` (5).
Browser: `tools/tesa13MapProbe.mjs`.

`test/tesa12_places.test.js` (7, TESA12): the cities (TAMRIEL1's in their slots, on their points or snapped within
SNAP_REACH, SNAP_INSET inside, else lost; the lore's ports); the made places (PLACE_COUNTS from TOWN_SLOT and
VILLAGE_SLOT, off the Bay's rectangle and BAY_MARGIN, the best of PLACE_TRIES, the province's names none twice); the
lane; the installed set; the ink; no Arena (no reader, no card, the retired store emptied once, the door online, the
wire's name); with ARENA2 the freeware's 283 places and 28 ports. Mutants `tools/mutants/tesa12.json` (18, all dead).
RETIRED: `test/tesa1_arena.test.js` and `test/tesa2_online.test.js` with Arena's data, below as they stood.

`test/tesa11_imperial.test.js` (14, TESA11): the plan (24 x 24, its anchor the middle grid point; the lake, the city's
own and a district's mix by the metres, the signatures once); the districts on their sectors; the slices (nine, their
names, ordinals, ids and indices); the pixel law over nine and Arena's places off the city's pixels; a slice's location
(its eight by eight, its seeds, `flattenAt`); the ground's laws; the port blocks (each landmark carried by its own slice
at that slice's middle, the lawns treed); the Tower (680 m, its plinth, its fins, marble and gold); the walls' gates; the
districts' landmarks; the install (twelve, turned north); one ground (the slices flattened to the centre's average, the
cache keyed by its inputs); the host. Every model finite, its normals unit, every face wound along its normal. Mutants
`tools/mutants/tesa11.json` (45: 44 dead, 1 recorded equivalent - a shore cell's house). PIN MOVED: `test/tesa10_capitals.test.js`
(the Imperial City's plan, Tower and walls retired to this suite; its pixel, pin, blocks, port blocks and location tests
read the nine-pixel city) and `test/audit_tesa.test.js` (the footprint's gates, A6-3's Imperial City asserts retired);
`tools/mutants/tesa10.json` (19 retired, 13 re-aimed), `audittesa.json` (2 retired, 2 re-aimed), `auditlandforms.json` (2)
and `tesa2.json` (1) re-aimed by content, each judged dead again.

`test/tesa10_capitals.test.js` (14, TESA10): the id (the capitals' lane after the lairs', the ordinal in the low 20 with
0x80000, a place the port made, nothing past it, the index past the lairs'); the pixel (TAMRIEL1's own point, its centre
on the live fit - (2177, 612) on the freeware's - one capital a pixel, kept a fit and moved with it) and the pin (Arena's
place of the capital's name and province, no other, nor a capital not yet built); standArenaPixels' `pinned` (the pinned
place first on its pixel, the place that had it moved to the next, a pin on the Bay ignored, no pin no change, the
installed set wired to capitalPin); the plan (the lake ring, the four corner gardens, the heart's four, 26 classic blocks
of fifteen kinds, every cell of the city but its corner gardens one district); the blocks (the cities' names by kind,
sorted, never a wall or a palace, nor a hamlet's; the port's own names for lake, garden and grounds, a classic off the
cell's hash, none for a missing kind); the buildings (each block's own named records to its count in grid order under the
capital's seeds, its sector and location; houses and walls none; the block untouched); the port blocks (their indices
from 900200, the lake's water, the garden's grass and a tree in about five, the grounds' plaza stone, Green Emperor Way's
grass and the street's stone by the distance from the middle, the Tower's foot and the ring band closed with four gates
open, the landmarks in the heart's first block at the city's middle by the classic layout law, a misc record's units,
the stamp's two flips pinned at their source and through the block converter); the location (its grid and buildings,
its ids in the row, the exterior and its record, the pixel's longitude and latitude, the host's region, no dungeon, no
harbour, `capital`, Arena's slot or none, none without a base or with a kind missing, the base untouched, capitalBase's
first plain city in map-id order); the Tower (its height, its reach, marble, gold and the door's dark on the east), the
walls (the eight corners, outside every block, the gates open under their lintels, the west side's tower, the ring wall's
four gates) and the bridges (both ways to the pixel's edge, from the wall) - every model finite, its normals unit, every
face wound along its normal; the pictures (six, 64 x 64, opaque, deterministic, the marble pale, the gold warm) and the
install (the blocks, models and pictures once, the loader's call beside installArena); the host by source (the door,
the rows before they go, the capital before Arena's place) and run (stood once, the pixel's region, Arena's slot when it
lands and stood again, none on another pixel, out when the fit moves, the door shut) and its sweep (a moved fit builds
again the pixels a capital came to or went from, the Bay's never, once a fit). Mutants `tools/mutants/tesa10.json`
(76, all dead). PIN MOVED: `test/tesa2_arena.test.js`, `test/tesa7_country.test.js`, `test/tesa8_lairs.test.js` (the
build's order; the capitals' lane a place the port made), `test/spawneddungeons.test.js` (the build's window 640 -> 700,
its harness's `_capitalBase`), `test/fb0929h_spawnplate.test.js` (its harness's `_capitalBase`); `tools/mutants/tesa2.json`'s
TESA2-no-arm and TESA2-the-nameless-stand, `tesa7.json`'s TESA7-host-arena-last, TESA7-host-no-country,
TESA7-host-not-indexed and the three id records, and `tesa8.json`'s TESA8-host-no-lairs re-aimed by content, all judged
dead again.

`test/tesa8_lairs.test.js` (10, TESA8): the cell (8 x 8 of the countryside's grid, 2^19 of them, its four edges and a
point none, its site inside it off its hash); the id (the lairs' lane after the country places', the cell in the low 20
with 0x80000, past every Bay pixel id, one a cell, a place the countryside made, no country place in its lane; the index
past the countryside's); the templates (labyrinths, keeps, ruins and graveyards in map-id order with an interior block,
no main-story, spawned, isle's, Arena or country place); the pools (each dungeon type's interior, starting and border
blocks once in map-id order, a starting block an interior one too, a border block by its B either case); the pick (64
times the rate at most 1, the kind in proportion, the template's hash, none past the chance, for no climate, off the
grid or with no template; the rates realised over 20,000 cells, every cell under a chance past 1); the plan (its count
from the start at the origin out of the starting pool, one connected shape, none laid twice, every open side closed by
one border block and nothing else, the same seed the same plan, 60 seeds 60 nine-block shapes, the stream put back, a
pool of one laid again, none without a pool or a count); the name (all 19 dungeon types' frames, an orc hold one word,
a keep a castle whatever its type, a ruin "Ruins of", deterministic, varied, an unknown type none, the stream put back);
the clone (non-mutating, its id in the row, the exterior and both records, the pixel's longitude and latitude, its own
plan and the header's count, the host's region, `country` with its cell and `dungeon`); no spawn clones a lair and its
automap is its own (DFU's key for the game's places, both callers through automapKeyOf); the host by source (the rows
before they go under the countryside's door, the Bay's land read once for both rates, the build's order, the
countryside leaving a lair alone) and run (on its cell's site alone, stood once under its province's name and its
template's size, a climate with none takes it out, water and a road none, a road landed late takes it out). Mutants
`tools/mutants/tesa8.json` (70, all dead). PIN MOVED: `test/spawneddungeons.test.js` (the build's window 600 -> 640),
`test/roadc_automap_interior.test.js` (the beacon's read through automapKeyOf, DFU's string for the game's places),
`test/tesa7_country.test.js` (the lairs' lane is no country place's, the Bay's land read once, the lair's ask after the
country's), `test/tesa2_arena.test.js` (the build's order); `tools/mutants/tesa7.json`'s TESA7-is-id-lane-floor,
TESA7-is-id-lane-ceiling, TESA7-is-id-low-bit, TESA7-host-rates-dry, TESA7-host-arena-last, TESA7-host-no-country,
TESA7-host-road and TESA7-host-shore and `tesa2.json`'s TESA2-no-arm re-aimed by content, all judged dead again.

`test/tesa7_country.test.js` (11, TESA7): the id (the grid's four edges, a point none, the 64 lanes from 0x300, the low
20 bits past every Bay pixel id, one a pixel, never an Arena place's, an isle's or a spawn's under any salt; the index
past Arena's); the templates (a list a kind in map-id order, no city, dungeon, spawn, isle's, Arena's or country place,
no main-story place); the Bay's count by its row's pixel's climate, its land over every Bay pixel once; the rates
(cumulative in COUNTRY_TYPES order, a climate with no land or no kind none); the pick (the roll's ceilings, the
template's hash, the same answer every ask, a kind with no template none, the rates realised over 40,000 pixels); the
name (deterministic, the global DFRandom stream untouched, every farm frame and nothing else, DFU's tavern words and an
inn's kind, an epithet of the Eight, a Nord's stem no son, a Redguard's a first name, a city none); the clone
(non-mutating, its ids in the row, the exterior and its record, the pixel's longitude and latitude, the host's region,
no harbour, `country`, none off the grid); the ground (the dry-plateau law under the pixel's own key, kept); the host by
source (the door, the rows before they go, the rates' water law, Arena's first, the probe, the deed rules) and run
(stood once under the province's bank, the clamp's region's without a province, a moved climate cloned again, water, an
Arena road and the sea's edge none, a road painted late takes it out, the door shut none) and the build's order
(Arena's, else the country's, the Bay its own). Mutants `tools/mutants/tesa7.json` (66, all dead). PIN MOVED:
`test/auditcaptsea.test.js`, `test/houses.test.js`, `test/housecontainers.test.js` and `test/tesa2_arena.test.js` (the
deed's one reading: nor a country place's), `test/tesa2_arena.test.js` (the build past the Bay: Arena's, else the
country's), `test/fb0929h_spawnplate.test.js` and `test/spawneddungeons.test.js` (their harnesses lift
`_locationToBuild`: the countryside off, the Bay's pixels theirs); `tools/mutants/auditcaptsea.json`'s ACS-P9-deed and
`tesa2.json`'s TESA2-no-arm re-aimed by content, judged dead again.

`test/tesa6_ports.test.js` (10, TESA6): the unpacking against the spec's tables (a stream made here: data, a copy of 2, a
high byte, the long special, 0xFE, the counts past 12) and its refusals (the last word, a byte or a copy past the length,
a copy before the start, a short file); the list at either offset and its templates' check; the shore (straight to the
coast, off the list and a dungeon unmoved, never across another province's land, none in reach); the clone's harbour;
the installed list (58 or none, its print, at once, online a known list too, the version); the store and the card's
Ports row; the host by source (each port reader, no crown, the clone's and the sweep's port); with ARENA_PATH the real
A.EXE's list known; with ARENA2_PATH and ARENA_PATH 248 stood, 51 ports, each beside the ground's sea. Mutants
`tools/mutants/tesa6.json` (33, all dead). PIN MOVED: `test/tesa1_arena.test.js` (DELETED by TESA12) (ARENA_FILES, the card's Ports row),
`test/tesa2_arena.test.js` (`arena.port`, the clone's cache, the sweep's slot), `test/tesa2_online.test.js` (DELETED by TESA12; online needs
the list too), `test/fb0929h_deedport.test.js` (its harness lifts the port test and the nearest-port finder: Arena's
ports past the Bay, the Bay's on it); `tools/mutants/tesa1.json` (DELETED by TESA12)'s TESA1-a-registration-installs-nothing, `tesa2.json`'s TESA2-one-fit-ever,
TESA2-a-harbour-kept and TESA2-the-index-keeps-it, `tesa_online.json`'s TESA-ONLINE-any-copy-online re-aimed by content,
all judged dead again.

`test/tesa5_join.test.js` (9, TESA5): the crossings (the depth, the spacing, the nearest, the middle, the gate's reach,
all four edges, never a track, the land); the drawing (the join's Bay pixels, the gate's run past the Bay, neither in the
other's map); the network (the gate a road node, before a village in its cell; the Bay's road walks to the town); the
painter and the verge on the Bay (the join read, the flag; a join byte past the Bay never); the layer (packed and back,
the touch); the client (the joins to the worker and drawn here, none without towns); the real worker (a job on the join
paints it); the host by source (the land's two laws, the wait for the Bay's network, the gate's grade, the stale law's
Bay pixel); with ARENA2_PATH and ARENA_PATH, the freeware's seven crossings and 19 join pixels. Mutants
`tools/mutants/tesa5.json` (23, all dead). PIN MOVED: `test/tesa4_roads.test.js` (the hand-over, the stale law, the
verge's line, the packed layer's join); `tools/mutants/tesa4.json`'s TESA4-the-towns-handed-once,
TESA4-the-verge-unasked, TESA4-the-verge-asks-the-bay-of-the-layer, TESA4-the-flag-blind-to-corners,
TESA4-one-end-unstamped and TESA4-the-bay-stamped re-aimed by content, all judged dead again.

`test/tesa4_roads.test.js` (13, TESA4): the grade (the clone's, a dungeon none); the window (the margin, the extent's
last pixel, the least scale, the taller way, a cell and its centre); the drawing (each step once, both ends, the spur in
its cell's grade, none on the Bay); the network (two towns joined and walked, the Bay's cells water, the ground at a
cell's centre, two towns a cell); the installed layer (a byte, the corners as the mod's, the touch's reach, the version,
packed and back); the cache's key (each term, the installed fit and trace); the painter past the Bay on all four sides
(a road, a track, a corner each way, the flag; a Bay pixel never reads it); the verge (on the line, beside it, from the
next pixel, none without a layer, the Bay's own network alone on the Bay); the client with no worker (a miss built and
kept, a hit drawn, a superseded ask dropped) and with one (the post and its epoch, a stale answer dropped, the network
kept, a copy across, a death answered here); the real worker (built and installed for its jobs, cleared, a held network
not built again, a failure its own message); the host by source (the hand-over, on the frame building or not, the epoch read as the job is posted,
the stale law, a pixel in flight, the sweep, the mount's clear); with ARENA2_PATH and ARENA_PATH, the freeware's counts. Mutants
`tools/mutants/tesa4.json` (49, all dead). PIN MOVED: `test/terrainworker.test.js` (the worker's imports take `arenaRoads.js`),
`test/disc20.test.js` (DISC20-C's window 10200 -> 10400, the entry's `arenaRoadsEpoch` line);
`tools/mutants/verge1.json`'s VERGE1-north-the-row-below re-aimed by content (the row is read on its own line now),
judged dead again.

`test/tesa3_provinces.test.js` (5, TESA3): the province past the Bay (the centre's, none on the Bay's own ground with
land under it or at sea, the authored shape without a trace); the people's banks for all nine (GetNameBank's, the
Imperial arm, none for none); the stranger's draw equal to getRandomFullName's over six seeds and a Nord's -sen; the
host by source (provinceAt's gates, the pin's exception, the loading screen, the Overworld, the new region and its edge,
every name site, the town talk told, the player's region index untouched, the land module free of characters/); with
ARENA2_PATH, Winterhold's pixel Skyrim's, Mournhold's Morrowind's, Daggerfall none. Mutants `tools/mutants/tesa3.json`
(13, all dead). PIN MOVED: `test/audit58_magic.test.js` (the talk's and the stranger's names through nameBankHere and
getRandomFullNameOfBank) and `test/macro6_talk.test.js` (the town talk's %fn/%mn through the province's bank first).

RETIRED by TESA12 (the file deleted): `test/tesa2_online.test.js` (5, TESA-ONLINE): the print (SHA-256 in hex, every byte two digits, the one list, case
held), the room (online only a known release stands; offline any copy; the switch's version), the registration and the
card's three readings, the host by source (online and off, the room's word, the notice's gates and its once, on the
crossing) and the relay's rooms for an Arena dungeon and building; with ARENA_PATH, the freeware's file is the release
the room knows. Mutants `tools/mutants/tesa_online.json` (DELETED by TESA12) (12, all dead). PIN MOVED: `test/tesa2_arena.test.js` (the
host stands them online too) and `test/tesa1_arena.test.js` (DELETED by TESA12) (the card's reading names the release); TESA2's
TESA2-online-too record retired with the law it held; `tools/mutants/tesa1.json` (DELETED by TESA12)'s TESA1-a-registration-installs-nothing
re-aimed by content (the install now carries `known`), judged dead again.

`test/tesa2_arena.test.js` (8, TESA2): the pixel (under the point, the centre's land deciding where the corner's would not,
the next nearest free one for a pixel taken, the reach in rings, the Bay's ground and a nameless dungeon none); the
installed pixels (once a trace and a fit, again when the fit moves, the switch moving the version once); the id (the lane,
the base, all 432 slots apart, never a spawn's under the same salt, past the isles' indices); the templates (the five
kinds' types, the dungeon test, the exclusions, map-id order, the province's own hash, and a spawn never cloning an Arena
place); the clone (every id field, the pixel, the region handed, no harbour, the template untouched); the map (the pixel
carried only where a host stands them, the hit, the press's arm by source); the host by source (online and off since TESA-ONLINE, the arm, one
clone a pixel, the key, the sweep, the load's wait, /tp, no house); and, where ARENA_PATH and ARENA2_PATH name the data,
all 248 stood under their own points (a capital's on the capital since AUDIT-TESA A7-2), MAPS.BSA's five template counts and Winterhold's 6 x 7 city. Mutants
`tools/mutants/tesa2.json` (28, all dead). PIN MOVED: `test/tamriel.test.js` (a press beyond the Bay picks an Arena place
the world stands, and nothing else) and `test/auditcaptsea.test.js` (the house rule names an Arena town beside an isle's).
Re-aimed by content, each judged dead again: `tools/mutants/auditcaptsea.json`'s ACS-P3-spawn-filter and ACS-P9-deed
(each still drops the isles' own exclusion alone), `tools/mutants/tamriel.json`'s TAMRIEL1-the-hover-names-the-bay-too
(the hover's city read is `tamrielCityAt` now) and TAMRIEL1-window-hover-silent-beyond-the-bay (its line carries the
cursor). The boot load's wait stands above the save's own parse, so MWEARLY's record stands as it was.

**Seen in the game** (the freeware ARENA2 served by the dev middleware, CITYDATA.65 in the Arena store, headless
Chromium on SwiftShader, a scratch probe through `__tesaJump` and `__tesaPlace`): the trace landed, 401 places stood on the
picture, the jump to Winterhold's pixel (2200, -360) built in 59 s of software rendering, and the pixel stood
"Winterhold" - Arena key 2|2, a 6 x 7 city of 243 buildings, the region the clamp's (the Alik'r Desert) - with no page
error.

RETIRED by TESA12 (the file deleted): `test/tesa1_arena.test.js` (11): the file's layout field by field over a CITYDATA minted by the format's own law (a full
twenty-byte name, the last slot of a province, a zeroed slot, any other length refused); the location laws (the 49 kinds,
getGlobalPoint's truncation on a case the exact ratio moves, the city id's shift, the visibility bit, the province
order); the cloud's fit (a shift found, the count's bias held by FIT_SPARE and taken without it, the identity on a
tie); the snap (the inset, the corner, the reach a circle on the diagonal); the model (an empty slot, a lost place, the
keys, no trace no places); the installed set (the version, the trace gate, one model a trace); the ink (Arena's named
places beyond the Bay, the capitals, the kinds' glyphs and words, the rebuild, the authored cities back); the store (its
own, the version, the filter, a registration with no IndexedDB) and the doors (the host's two warms, the static key, the
card's rows and buttons); and, where ARENA_PATH and ARENA2_PATH name the data, the freeware CITYDATA.65 (401 placed, 273
named, the provinces and rectangles) and the placement on the real trace (392 by the fit, 9 snapped, none lost, 248
inked, the eight capitals). Mutants `tools/mutants/tesa1.json` (DELETED by TESA12) (33, all dead).
PIN MOVED: `test/features.test.js`, `test/org2_options.test.js` and `test/settingsUI.test.js` name the Arena card in
Your files and in the card table. Re-aimed by content, each judged dead again: `tools/mutants/mwa4.json`'s
MWA4-the-card-off-the-head-of-the-files-page (the files row now ends with the Arena card), `tools/mutants/tamriel.json`'s
TAMRIEL1-one-model-a-call and `tools/mutants/tamriel3.json`'s TAMRIEL3-the-ink-never-rebuilds (the ink's cache now asks
one `stale` predicate, the land's version and Arena's).
