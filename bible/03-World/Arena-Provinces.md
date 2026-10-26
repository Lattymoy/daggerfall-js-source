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
| the province order | High Rock, Hammerfell, Skyrim, Morrowind, Summurset Isle, Valenwood, Elsweyr, Black Marsh, the Imperial Province | the file; the picker's race order (`world/tamriel/tamrielLand.js` PROVINCE_OF_ID, 1-9) |

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
TAMRIEL1's (capitals at any zoom, the rest once in to the Bay's own scale). AUDIT TESA II M7: the glyph is the kind's
classic bucket (`ui/tamrielInk.js` tamrielCityBucket - a capital the city, a city-state the hamlet, a town and a village
the village), so the place is under the map's filters and in MAP-KEY's hue as the Bay's own towns are - the Towns filter
hid the Bay's towns and the countryside's past it, and not these - and the hover and the press take only a city the sheet
inks (on the continent the capitals alone). The hover names the kind: "Skyrim :
Labyrinthian (dungeon, beyond the Bay)". The ink keeps the land's version as `version` and Arena's beside it as
`arenaVersion`, and `tamrielInkFor` rebuilds when either moves; the held map's static key carries both, so a pick or a
removal while the sheet is up repaints it.

## The door (`scenes/dataSource.js`, `ui/enhanced/enhancedMenu.js`, `scenes/world.js`)

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
  for everything else (PIN MOVED in `test/ui/tamriel.test.js`). AUDIT TESA II P4 (2026-10-25): the map's press was one
  door of several - a party's journey to its leader (PARTY-TRAVEL) and a rider's in its owner's wagon (WAGONS2) set out
  for a pixel past the Bay by the same fast travel, the map never asked, and `/unstuck` sent a player past the Bay to a
  Bay city a continent away (P2). The law is the journey's own now, at the gate every journey passes
  (`systems/travel/pastBayTravel.js` pastBayJourney, asked by `scenes/world.js` fastTravelTo's wildTravelGate): a
  journey whose end lies past the Bay is refused ("No road the Bay knows leads there. The land past the Iliac Bay is
  walked, or reached through a Portal Stone."), the open zone's own journeys inside Cyrodiil its own (PVPJOURNEY).
  OWNER (recorded, not built): a journey FROM past the Bay TO the Bay is still DFU's fast travel - the travel map opens
  past the Bay (and Immersive Travel's driver's and captain's maps in a town past the Bay) and journeys to any Bay place.
  The owner's words ("fast travel shouldnt be a thing ... the player can traverse using the overworld") read for both
  ways; the recommendation is to refuse that leg too (the same law, its `from` asked as its `to` is - the zone's
  journeys excepted), so the land past the Bay is left as it is reached: walked, sailed, or through a stone.
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
chapters, receipts), `net/townSeatLaw.js` seatRegionOk, the banks' BANK_REGION_COUNT, `systems/region/regionConditions.js`
REGION_COUNT (prices, flags, stock) and the save's 62 legal reputations - an index of 62 or past it is refused or
silently off in each, and the bare `REGION_NAMES[r]` / `REGION_RACES[r]` reads answer undefined. Nine more regions is the
save's shape, the services' and the relay's at once - its own arc, and the owner's to call. So the province answers what
the player READS and whose NAMES they hear, and never a region index.

- **The province** (`world/tamriel/tamrielLand.js` provinceKeyBeyondBay): a Bay pixel past the Bay answers the province its
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

**RETIRED IN PART BY TESA14** (below): the window, the drawing, the cache's key, the terrain worker's build and the host's
hand-over are gone - the network is the Bay's own law at the Bay's own scale a region at a time now. The grade, the layer,
who reads it, when it lands and the four hosts stand as written; the rest is kept as it stood, its history.

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
routing (AUDIT-TESA A3-1) move them; they are not measured again here. The data test that held them retired with TESA4's
network (TESA14), and AUDIT-TESA A7-2's half with it: RETIRED, AUDIT TESA II R12.)

## TESA5 - the crossings onto the Bay's roads (2026-10-12)

The owner, on the next item ("joining Arena's roads to the Bay's roads at its edge, and ports"): *"Do it"*. Measured
first: none of the Bay's roads leaves its edge (Basic Roads' arrays carry no arm off the map - nor does the port's own
network), but 165 road pixels lie within six of its north edge, 99 of its south and 12 of its east, where the land goes
on past it (766, 863 and 489 of the edges' pixels land on both sides; the west is the Eltheric's).

- **A crossing** (`world/arenaRoads.js` arenaJoins): where the Bay's ROADS (never its tracks) come within JOIN_DEPTH (8)
  of its edge, each run of them along the edge - runs nearer than JOIN_SPACING (12 since ROAD-GAPS, `06-Systems/Travel-View.md`; it was 60) one run - is one crossing, at the road
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
- **When** (TESA14: `scenes/tamrielRoadsHost.js`, the joins first with the layer reset, each gate a road node of every
  region it falls in): the host hands the crossings over with the towns (`handArenaRoads`), found on the Bay's own network in use -
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
- **The host's ports past the Bay** (`world.js` arenaPortAt, arenaPortNear, arenaPortOf - ETHER-PORTS' shape; AUDIT TESA
  II P7/P5: TESA's places are the world's registry's since, and the port test, the port here, the nearest port and the
  waters' distance past the Bay are WW3's over them - `03-World/World-Wide.md` "Folded into TESA"; the harbour book's town
  is still `arenaPortNear`'s): Come Sail
  Away's port town (`csaIsPortTown`, and with it `navalNearPort`), the naval host's port here (`navalPortHere` -
  `{ key, name, px, py, region, crown: null }`: no crown's writ past the Bay, the region the pixel's own read), the
  harbour book's town (`navalHarbourNear` - its harbour sounded as any port's, its quays by QUAYS' law), the nearest
  port's name and way past the Bay (`csaNearestPort`), and the waters' distance to a port (`navalPortPx`). An Arena port
  trades the one good its key draws (`portTrade`: no crown's table). The harbour office's contract board lists them
  (AUDIT TESA II P7: the board's list is the Bay's and the world's - `worldPorts.withBay`); the travel window's ship
  passage is Travel Options' hand-written list.
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
  discovery never marks a place of the Bay found. AUDIT TESA II P6: but the low 20 bits named a farm and every farm a
  multiple of 64 rows from it (a lane is 64 of the grid's rows), a lair and a farm - one found, the others found; the
  store keys a place off the Bay's pixel ids by its whole id (`systems/discovery.js` discoveryKeyOf), and a save's old
  key of one is let go (the place found again by entering it). Its location index counts
  down from -COUNTRY_INDEX_BASE (-2,000,000), past Arena's. A pixel off the grid stands none.
- **The host** (`scenes/world.js` countryLocationAt): `_locationToBuild` asks of a pixel past the Bay Arena's place
  first (TESA2), else the country's. It stands none on water (WOODS.WLD's byte at or under the beach, the land past the
  Bay's law), or where the sea's edge would flatten it onto sand (SPAWN-SHORE's
  dry-plateau law, `createCountryGround`, kept under the pixel's own key - the spawns' key is a Bay pixel's and two
  pixels past the Bay would share it). TESA14 retired a third law - none on a pixel an Arena road or track crossed
  (SPAWN-ROADS'): the roads are laid round the places now (`world/tamrielCountry.js` countryStandsAt, the roll's one home). Stood in the index once, and cloned again when what the pixel stands moves (the
  trace landing moves a climate). Arena attached late: the Arena sweep builds the pixel again and Arena's place
  takes it. No house is sold in a country place and no deed read in one (`scenes/worldModes.js`, the isles' and Arena's
  rule: every one answers the clamp's region). `/tp` names a stood one; `__tesaPlace` reads its `country` and kind.
- **What a country place is not yet**: a row of the world's registry (AUDIT TESA II P7: the cities, towns and villages
  and the capitals are, `world/pastBayRows.js`; the countryside's pixel provider is not - a district's walk through its
  roll was 276 ms on the page's thread - so the rise and `/unstuck` read the country towns a session stood, and the
  zone's halls ask its roll itself, `zoneHallsHost.js` standsToo); on no map (the held map and the travel map ink the Bay's places and Arena's),
  on no road until TESA14 (the roads between Arena's places alone - TESA4's network at five pixels a cell took cities,
  hamlets and villages, and the countryside's 226,068 were past its scale; TESA13 inks them, TESA14 routes to them), and
  in no quest (the quest machine's
  sites are MAPS.BSA's rows). Its layout is its template's: the Bay's own block layouts under a new name, never a layout
  made of the blocks.
- **Online, apart**: a pixel the countryside stands and a player's known Arena stands too is Arena's for that player and
  the country's for one without Arena - TESA-ONLINE's divergence (a player without Arena sees no Arena place), no wider.
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
- **Its own map** (`systems/automap/automap.js` automapKeyOf): DFU keys a dungeon's automap by region and name, and a lair's
  name repeats in the clamp's region; its key takes its map id after it - the game's places keep DFU's key exactly
  (`scenes/dungeonContext.js`, `scenes/worldModes.js`' beacon read). No spawn ever clones one (`spawnTemplates`).
- **The host** (`scenes/world.js` lairLocationAt): `_locationToBuild` past the Bay asks Arena's place, else the
  country's (TESA7, which leaves a lair to its own), else the lair's - on its cell's site, on the countryside's ground
  law (no water, no sea's edge - TESA14: no road law, the roads go round it; `world/tamrielDungeons.js` lairStandsAt), named off its province's people (the clamp's region's bank
  without one), stood in the index once, and taken out when the cell's roll moves. Its rates share the countryside's
  count of the Bay's land, read once. `?country=off` stands neither.
- **Online, apart**: as TESA7's - Arena's place and its roads are each player's own. A lair's room is its full map id
  (`net/online.js` roomKeyFor `dungeon:m<id>`), one a lair. Its dungeon's identity may meet an isle's ruin's (the
  isles' 500,000 and up) - two dungeons a world apart, never two lairs.
- **What a lair is not yet**: on no map (TESA13 inks it), in no quest (START2: a province's start begins in one - the
  nearest to its capital of the kinds its story wants, a quest item's marker in it, `06-Systems/Alternate-Starts-Arc.md`
  section 8; its own lair's clone made apart from its standing, `tamrielPlacesHost.js` lairCloneOf), at no road's end
  (TESA14 routes round it, as the Bay's roads go round a dungeon - ROADS 1).
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
  (TAMRIEL1's CITIES, `world/tamriel/tamrielGeography.js` - the port's own reading of the picture) on the live fit: the Imperial
  City's (171, 99) is Bay pixel (2069, 658) on the freeware's fit (IC-RING, below: (178, 96) and (2177, 612) before). Every client's the same pixel, Arena attached or not.
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
  location's list drawn by type in grid order (`systems/talk/talkTopics.js` drawNamedBuildings); a capital's list is each
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
  answers, no dungeon (WW7-4: the centre's its castle's halls - World-Wide.md WW7-4),
  no harbour, `capital`, and Arena's slot where Arena's place stands on it. A place the port made:
  no house is sold in it and no deed read (`isCountryPlaceId`).
- **The doors** (`world/capitalModels.js` installCapitals, from `scenes/modWorldData.js` beside installArena - behind no
  switch, as the arena's block is): the six port blocks at fixed indices from 900200 (900400 since AUDIT-TESA - past the
  Shadow Realm's 900200; 901000 since AUDIT TESA II C13 - 900400 was the Sky-Ketch's, `world/ketch/ketchShip.js`
  KT_SHIP_BLOCK_INDEX, and every fixed block index in the tree is swept apart by `test/world/audittesa2c_capitals.test.js`),
  the four models (climate-free), the six pictures. `?capitals=off` stands none: Arena's place of the name stands as any.
- **The host** (`scenes/world.js` capitalLocationAt): `_locationToBuild` past the Bay asks the capital first, then Arena's
  place, the countryside and the lairs. Stood in the index once; stood again when Arena's place on it changes.
- **The rim** (AUDIT TESA II C1, 2026-10-25 - A RECORDED DEPARTURE from DFU's SetLocationTiles): Daggerfall's blend round
  a location (`world/terrain/terrainTiles.js` blendLocationTerrain, DFU's BlendLocationTerrain) flattens its rect and
  blends the land outside it to the pixel's edge. Daggerfall's own 8 x 8 cities lay no ground on their outer tiles (their
  wall blocks' records 63), so their rect is tiles 11 to 116 and they meet every neighbour with no seam (0.00 m measured
  at Daggerfall, Sentinel and Wayrest). A capital's plan laid ground to its pixel's edge - its lake, its sea, its
  gardens - so its rect was the whole pixel, no land was left to blend, and every capital met its neighbours in a cliff
  of 27 to 51 m on the drawn grid. Every capital now leaves its outer CAPITAL_RIM_TILES (11 tiles, CAPITAL_RIM_M 70.4 m)
  no ground of its own on its span's outer sides (`world/tamrielCapitals.js` inCapitalRim: CAPITAL_NO_GROUND, closed to
  the walkers, treeless - in its own blocks, its gardens and the lakes of its plan's outer ring, each its own block,
  capitalLakeName); the Imperial City's inner seams keep their ground and meet level. The departure: DFU's three tiles of
  clearance past where a location's ground ends are not taken on a capital's outer sides (setLocationTiles' capital arm),
  so the land blends from the city's height over the whole rim, where DFU's clearance would stand a strip of the land's
  own at the city's height. No landmark stands in the rim on a side of land (the Imperial City's piers end at 1140 m,
  Talos Bridge comes down to the rim's inner edge, Solitude's east wall stands at 530 m). Measured on the freeware: every
  capital's seams to its neighbours and between its own slices 0.000 m.
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
  (`world/tamriel/tamrielLand.js` provinceKeyBeyondBay: the trace's, or the authored shape's where none is set), and, for a
  capital on the shore (`shore`), one of whose eight is the sea (the Bay is no sea); none where none is in reach.
  AUDIT TESA II C9 (2026-10-25): "one of its eight" took a diagonal sea and asked no side - on the authored shape
  Solitude's water faced north and west with its only sea north-east, Alinor's and Torval's south with theirs
  south-west. Every side its plan's water faces (`sea`) is the sea along its whole edge now - the heights Daggerfall lays
  that edge from (spanSideBytes: a pixel's patch runs from its north-west neighbour's height to its own) - and a sea
  slice (C2, TESA10c below) is the sea itself.
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
  blocks in its districts (nineteen since TESA-LORE - AUDIT TESA II C11): the Avenues (the shops, the Winking Skeever's tavern), the Bards College (a library), the
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
- **Moved by TESA-LORE** (below): Castle Dour to just within the main gate, its two gates and the temple on its grounds;
  the Bards College and the Hall of the Dead the Avenues'.
- **Moved by AUDIT TESA II** (2026-10-25): its plan's water sides north and west (`sea`, C9); its ground the sea's floor
  (C2: the kernel's ocean clamp, 34.0 m - its sea and the Karth stood 16.2 m over the sea beside them along both edges);
  its east wall in from the rim (C1: 604 to 530 m), the docks' piers to -230 m; the main gate (TESA14's road end) onto
  its lane between the tavern's block and Castle Dour's west curtain (C10: 300 to 318.4 m - 8 of its 10 m opened onto
  the tavern, 11 m in).


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
  shore (1922, 1704), the sea south. AUDIT TESA II C2: Alinor and Torval each over two pixels now, their land and the
  sea pixel off their harbours - (7, 1534) and (1922, 1705), named Alinor Harbour and Torval Docks (their district's),
  their plans' last eight rows all water but the slice's own block S0, its carrier (its start markers on the quay). Tested on TAMRIEL1's shape where no trace is set: each on its own province's
  land, the shore capitals beside the sea, no two on one.
- **Measured**: their landmarks draw in the stand-in view as laid. Not yet seen in the game.
- **Moved by TESA-LORE** (below): Falinesti's city into its boughs (the walkway up the trunk, hide houses on its
  platforms and its limbs' forks); Torval's palace in its walled estate of sugarcane with the Mane's palanquin, crescent
  moons on its domes; Helstrom in the heart-mud, its Hist grown greater among standing stones.
- **Moved by TESA-LORE** (below): Alinor's Crystal Tower retired (Summerset's, not Alinor's); its palace on three
  terraces with a grand stair; a river across its south under two bridges, out to the sea in the east.
- **Moved by TESA-LORE** (below): Mournhold onto Tribunal's plan - the Temple Courtyard and the High Fane north, the
  palace at the middle, Godsreach west, the Great Bazaar east, Plaza Brindisi Dorom south a garden round the statue of
  Almalexia and Mehrunes Dagon (its fountain and column retired).
- **Moved by AUDIT TESA II** (2026-10-25): a shore capital's ground the sea's floor (C2, `world/terrain/terrainGen.js`
  SEA_FLAT: Alinor's harbour and river stood at 78.4 m and Torval's bay at 93.4 m, the neighbour's shared edge dry land);
  Alinor's and Torval's north gates (TESA14's road ends) onto their lanes - 158 m and 160 m east, off the palace's blank
  height (29 m from it) and the estate's closed back (26 m) - a tower either side (C10); Alinor's east bridge onto the
  Merchants' Ward's street north (C10: 153.6 to 85.6 m east - it landed 3.6 m from a pawnshop's front); Helstrom's
  hummocks before its two gates, the north and south rows' middle cells (C6: they opened onto the marsh's water, 82 m of
  it to the pixel's edge); Falinesti's walkway clear to its platforms (C4, TESA-LORE below); the plans' measures in BLOCK_M
  (C15). The crystal picture deleted (lane K's K15: no model wore it since TESA-LORE).

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

- **Arena's names** (A1-1, A1-2): an Arena place's automap key is its map id (`systems/automap/automap.js` automapKeyOf), the
  party pose and a discovery carry no name of it - a capital's name is the port's and stays.
- **A quest's site past the Bay** (A2-1): `scenes/world.js` placeByName - MAPS.BSA's, else the place the world stands.
- **The capitals' ground** (A6-1 to A6-5): start markers on each carrier block; each capital's gardens its own blocks
  (`capitalGardenName`, `TESG<tag><row><column>.RMB`), and every block of a capital closed where its models stand at a
  body's height (`world/capitalModels.js` capitalFootprint), its trees off them - built when first read; the blocks
  from 900400 (901000 since AUDIT TESA II C13); the Imperial City's wall at 317 and Solitude's walls out of the houses' blocks, Helstrom's walks to the
  banks; an inland capital's CUST blocks its dry ones (`dryKinds`); a closed cell's byte 0xfe (`CAPITAL_CLOSED_BYTE`).
- **The world host** (A7-1, A2-3, A2-4, A2-5, A4-F2 to A4-F4, A5-F3): the load's wait whenever a place past the Bay
  stands; the countryside and the lairs rolled again when the land moves; the rise past the Bay at the nearest town
  standing there (AUDIT TESA II P3: the nearest town of the world at any distance - the index's within 48 pixels left a
  death at sea past the Bay where it fell, in the water); the province's people's names in its towns and buildings; a capital's pixel never cloned over; the
  harbour book by map id; the Bay's pixel ids read on the Bay alone; a ship's port past the Bay its Arena place's; no
  deed read in a place the port made.
- **The roads** (A3-1): a shore town's cell its land. **The switches** (A7-8): `?capitals=off` and `?country=off`
  offline alone - AUDIT TESA II P9: and `?tamrieltrace=off` (`scenes/shared.js` tamrielTraceOn), which A7-8 missed: online
  it took every place past the Bay off one client and stood its capitals and countryside on the authored coasts.

## TESA11 - the Imperial City over nine pixels (2026-10-13)

The owner: *"the imperial city needs to be much larger and be split into distinct districts with the tower very large.
The entire city also needs to be lore accurate to daggerfall"*; asked, *"3x3 pixels"* and *"Canon layout, DF era"*. It
supersedes TESA10's 8 x 8 Imperial City (its plan, its Tower to 292 m, its walls and bridges, and AUDIT-TESA A6-3's wall
at 317 m); Solitude and the other five stand as they were. SUPERSEDED in its measures by TOWN-SHAPES TS5 (`03-World/Town-Shapes.md`): seven pixels a side; and by IC-GRAND (below, 2026-10-26): twenty-five pixels a side, its Colosseum Daggerfall's arena, its districts' streets the port's own fabric.

- **Nine pixels, nine locations** (`world/tamrielCapitals.js` capitalSpan, capitalCentre, capitalSliceOrdinal,
  capitalSliceName): Daggerfall's engine stands one location on a pixel, eight blocks a side at most. The city stands on
  three pixels a side (`world/imperialCity.js` IMPERIAL_SPAN, 2.46 km across), each pixel's 8 x 8 slice of one 24 x 24
  plan its own location - its own map id and index (the slice's ordinal, the centre 0), its buildings' seeds its own (64
  a slice) - named for its district: Elven Gardens District, Prison District, Market District (north row, west to east),
  Talos Plaza District, Imperial City, Arena District, Temple District, Waterfront District, Arboretum.
- **Where**: the pixel law over nine - the centre the nearest pixel to TAMRIEL1's point all nine of whose pixels are the
  Imperial Province's land (the 8 x 8 city's pixel when its eight neighbours are land too). With Arena attached, the pinned place of the name stands on the centre and no other Arena place on any of the
  nine (`world/arenaPlaces.js` standArenaPixels' `reserved`: the next free pixel).
- **One ground** (`world/terrain/terrainGen.js` flattenAt): a location flattens its pixel to the pixel's own average height,
  so nine slices stood nine levels with walls at every seam. Every slice is flattened to its centre pixel's average (cached
  by its inputs), so the nine meet level; the outer edge steps to the land as any city's does. AUDIT TESA II C1: it did
  not - its ground ran to its pixels' edges and left the blend no land, 45 m over its neighbours; its outer sides leave
  Daggerfall's rim to the land now (TESA10's rim), so it meets the land level (0.000 m measured). A shore capital's every
  slice is flattened to the sea's floor (AUDIT TESA II C2: `flattenAt`'s `sea`).
- **The layout is the city's canon** - the wheel the later games mapped, in Daggerfall's day (3E 405, Uriel Septim VII)
  and of Daggerfall's own blocks (`world/imperialCity.js`, every cell decided from the metres about the city's middle):
  City Isle in Lake Rumare (1010 m from the middle - since IC-RING the city's own ring of water, a moat in the trace's
  isle: recorded below); at the heart the White-Gold Tower on its plaza, Green Emperor Way's lawns round it
  and the emperors' eight tombs, inside the palace wall (300 m, six gates); within the city wall (900 m, four gates,
  a tower every ten degrees) the six districts on their sectors, each walled from the next with a gate - the Market
  District north-east, the Arena District east, the Arboretum south-east, the Temple District south-west, Talos Plaza
  west, the Elven Gardens north-west; outside the wall on the isle the Prison District (north of north-east, so it stands
  in the north pixel), the Arcane University south-east and the Waterfront on the lake's south shore; Talos Bridge west to
  the mainland (IC-RING: west over the moat to the isle's own land - AUDIT TESA II C12). Recorded as the port's placing: no source the port can read gives the Waterfront's compass, nor the
  Prison's bearing finer than "beside the Market".
- **The districts are Daggerfall's blocks** (IMPERIAL_MIX, IMPERIAL_SIGNATURE): 86 of the game's city blocks by trade,
  off the cell's hash - the Market's general stores, armorers, jewellers and alchemists, the Arena District's armorers
  and the Fighters Guild, the Temple District's temples, Talos Plaza's bank and houses, the Elven Gardens' tavern and
  houses, the Waterfront's Thieves Guild and two general stores, the Arcane University's two Mages Guild blocks (AUDIT
  TESA II C11: the record said "the Waterfront's pawnbrokers, taverns and the Thieves Guild, the Arcane University's
  Mages Guild and a library", and TESA-LORE's causeway had taken the University's second cell - 85; the causeways to the
  compounds' gates gave it back); each signature once. The rest of the grid: 217 cells of lake (the ring's outer cells
  its own blocks since AUDIT TESA II C1), 19 of garden (the Arboretum's, its own blocks; the record said 22), 254 the
  city's own (the record said 251) (`I<row><column>` base 36: the plaza's and Green Emperor Way's stone and lawns, a wall's foot, a
  landmark's ground, a shore) - closed where a model stands at a body's height, its gates open.
- **The landmarks** (`world/capitalImperial.js`, the port's own make, each carried by the slice it stands in -
  IMPERIAL_CARRY, `capitalModelCarriers`): the WHITE-GOLD TOWER - an octagon over a plinth 172 m across, its shaft
  tapering from 56 m to 38 m banded in gold every 60 m, eight fins to 340 m, a gallery at 494 m, a crown to 548 m and a
  gilt spire to 680 m; the palace wall; the tombs; the city wall; the district walls; the Colosseum (east, its stands in
  three tiers and its ways in); the Temple of the One (south-west, a dome and two towers); the statue of Talos on its
  plaza (west); the Imperial Prison (north, a bastion to 64 m); the Arcane University (south-east, its walls, its hall and
  a spire to 120 m); the Waterfront (its piers and lights); Talos Bridge. Twelve models (910200 to 910211), their
  pictures CAPITAL_ARCHIVE's. No game data. AUDIT TESA II C1: the Waterfront's piers end at 1140 m and Talos Bridge's deck
  comes down over its last 40 m to the rim's inner edge (`bridgeLine`), where the land blends down to the road from the
  west (TESA14's 'W' gate) - it stood to the city's west edge, 41.5 to 43.6 m over the road's end (AUDIT-TESA A3-2, closed).
- **Every slice's arrivals** (AUDIT TESA II C7): each slice's carrier lays its own start markers (`capitalSliceMarkers`;
  the Imperial City's `imperialSliceMarkers`: on a 25.6 m lattice of the slice's open ground, `imperialOpenAt`, inside
  the city wall where the slice has any, the nearest to each side's middle - worked the first time a carrier is built).
  Only the centre slice carried any (AUDIT-TESA A6-1 had not been laid by slice): a death's rise at the nearest slice
  landed by DFU's markerless law 10 m outside a random side - on a district wall, across the moat, at the wall's foot.
- **The city's laws worked once** (AUDIT TESA II C5): `imperialTile` and `imperialClosed` asked every landmark's point
  of `polar` and `divinePlinths` at every cell; its points are worked once a set of measures now (`geoOf`), each ring of
  them asked near its own radius alone. Measured on the freeware (node, its 273 blocks built the first time they are
  read, the footprint apart): 2.36-2.52 s (8.6-9.2 ms a block, 0.14-0.48 s a slice) before, 0.86-1.43 s (3.2-5.2 ms a
  block, 0.04-0.39 s a slice) after; the heap the blocks hold 42.4 to 35.9 MiB (C8: the JSON no longer kept beside a
  block read from it - `make`).
- **The causeways to the compounds' gates** (AUDIT TESA II C3): the ways to the Prison and the Arcane University ran on
  their bearings into a square compound's corner tower and ended inside its curtain, 73.5 m and 44.8 m from a gate; each
  ends at its compound's gate now (`prisonGates`, `universityGates`, `compoundGateAt` - the curtain's own, one home), the
  University's two gates each its own way.
- **Moved by TESA-LORE** (below): the Prison to the isle's north-eastern shore (bearing 45, the lore's), so the north
  row's slices read Elven Gardens District, Market District, Prison District; the city wall's watch towers and the
  Arboretum's Nine Divines added.
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

- **The cities** (`world/tamrielPlaces.js` makeTamrielPlaces): TAMRIEL1's 67 (`world/tamriel/tamrielGeography.js` CITIES - the
  lore's own, placed by the port's reading of the lore map: Windhelm and Whiterun, Anvil and Kvatch, Vivec and Necrom,
  Senchal, Woodhearth, Lilmoth and the rest, the seven capitals among them), each in its province's slots from 0 in
  TAMRIEL1's order, on its point where that is its province's land, else on the nearest of it within SNAP_REACH (24
  picture pixels - the lore map's coasts lie wider than the picture's: Thorn, the farthest, 22.6). A capital's stands
  on the capital (TESA10's pin), so its roads, its ink and a portal's end lead to the city the port built.
- **The ports**: a city TAMRIEL1 sets on the sea (`port`, 30 of them: the Sea of Ghosts' four, the Abecean's, Summerset's
  and Valenwood's coasts, Lilmoth, Archon, Soulrest, Necrom, Ebonheart, Vivec on the Inner Sea) stands on its province's
  shore within SHORE_REACH (100 Bay pixels; `world/arenaPlaces.js` standArenaPixels) and is a port - AUDIT TESA II P8:
  on the nearest shore pixel whose plateau stands above the beach within SHORE_DRY_REACH (12) of the shore's first ring
  (plateauDry over the continent's own ground; six of the 28 had stood on a plateau under the beach line, a city on
  sand, where the Bay's own ports do so 7 times in 155; five moved 1 or 2 pixels, Solitude's pin keeps its pixel); one with no shore in
  reach stands as any place and is none - on the freeware's picture Anvil and Leyawiin (no Gold Coast and no Topal Bay
  there), so 28 ports. A.EXE's coastal list is not read.
- **The towns and villages** (made): eight towns and sixteen villages a province (PLACE_COUNTS: Arena's shape of a
  province - a count, no data), each a quarter inside a cell of its province's land off the Bay's rectangle and
  BAY_MARGIN, the farthest of PLACE_TRIES (24) draws off the province's hash from every place before it; named by the
  province's people (`world/tamrielCountry.js` countryName: a hamlet's or a village's stem off the province's DFU name
  bank, TESA3's), no name twice nor a city's. AUDIT TESA II P10: on the GAME'S OWN banks and tavern words whatever a
  translation installed (`characters/nameHelper.js` withGameNameBanks; the tavern words read in DFU's English, `systems/textManager.js` withBaseText) - a pack's
  NameGen.txt renamed 24 of the 283 for its player alone; the countryside's names and the lairs' with them. A town clones a hamlet, a village a village (TESA2's templates). Arena's
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
  centres and softened as the Bay's roads are (`ui/ink/inkMap.js` pathChains), a ROAD_TILE (64) tile at a time - the layer
  spans the continent, and one mask of it would be fifteen million bytes for 34,000 road pixels. A tile's mask has a
  pixel's margin round it: traceChains follows a pixel's last bit over the tile's edge into it, so the tiles either side
  both draw that step and a road's halves meet. Stroked by the Bay's law (`inkMap.js` strokePaths, the Bay's and the
  continent's one home now): the roads at every band, the tracks dotted and never at far, each under its filter. The
  ink is made again when the layer lands (`arenaRoadsVersion` beside the land's and the places'), and the held map's
  window repaints - AUDIT TESA II M9: off its tick (the roads' and the places' versions as a word, `heldMap.js:"const pastBay = "`),
  the tiles the landing reached painting again by their words (TESA15); the static key carries neither, where it had
  stroked the whole sheet and the marks' bake again on each landing, up to ninety-six times as the forty-eight landed.
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
  map's filters (`ui/travel/travelMapWindow.js` getPixelColorIndex), the band's kinds (inkMap BAND_MARKS: at mid the dungeons,
  temples, taverns and towns, at near every kind), the glyph (markKind), every halo before every glyph (MAP-FIELD6) and
  each kind's hue (MAP-KEY). None at far and none out on the continent, where the atlas is not asked. The hover names
  one - "Skyrim : The Sacred Oracle (temple, beyond the Bay)", its kind in MacroHelper.LocationTypeName's word
  (`systems/travel/travelOptions.js` locationTypeName). No press: TESA-NO-FAST keeps a portal's ends to the cities.
- **A recorded departure - no discovery law.** The Bay's map marks a place once it is discovered (DFU's
  checkLocationDiscovered); every place past the Bay is inked, as TESA1's cities, towns and villages are. The discovery
  store keys a place by its map id's low twenty bits (DFU's MapId & 0xfffff), and the countryside's sixty-four lanes and
  the lairs' share those bits (`world/tamrielCountry.js` countryPlaceId, `world/tamrielDungeons.js` lairPlaceId), so a
  discovery law past the Bay needs a key of its own first.
- **THE FOUR HOSTS.** `scenes/world.js` wired as above, at the one map seam. `scenes/worldModes.js` (interiors) and
  `scenes/dungeonContext.js` open the world host's map - nothing to wire. `scenes/exterior.js`, the single-town bench,
  traces no picture and stands no countryside: nothing to ink.
- **Measured** (the freeware's data, `tools/tesa13MapProbe.mjs` (RETIRED by TESA15: `tools/tesa15MapProbe.mjs`), the travel map opened in Daggerfall): Arena's roads
  land as 33,991 path pixels, inked as 1,336 road and 314 track chains; 520 x 400 pixels north of the Bay hold 3,423
  places of the countryside's and the lairs', rolled whole in 7.1 s through spawnPlateauFloor and 1.4 s through
  plateauDry - the same 3,423 - and again in 0.6 ms from the kept tiles; the sheet in to the Bay's own scale over High
  Rock north of the Bay (184 x 112 pixels) filled in with its 1,310 in three frames; zero page errors.

## TESA14 - the roads past the Bay, the Bay's own law at its own scale (2026-10-24)

The owner, of the land past the Bay: *"I notice some of the roads cut off the map, theres no pathways like daggerfall
has and roads intersect with some of the capital cities water sources"*; asked, *"Full Daggerfall network"*. Measured
first, TESA4's network on the freeware's data: 12 roads stopping in the open (Farrun's at (711, -340) ran on two pixels
into the sea to its cell's centre - a road reads the ground once a five-pixel cell and runs centre to centre), 76 tracks
the same, 71 road pixels over water, a road across every capital's pixels and its lake or harbour, and no way at all to
the countryside's 226,068 places or the lairs.

- **The law** (`world/tamrielRoads.js`): the port's road builder (`world/road/roadNetwork.js` buildRoadNetwork, ROADS 1-21,
  the dials untouched) at the Bay's own scale - a pixel a cell - a REGION at a time. The continent's frame is cut into
  cores of REGION_CORE_W x REGION_CORE_H (800 x 300) Bay pixels from its north-west pixel (regionLattice); a region's
  grid is its core with REGION_APRON (100) round it - the builder's own 1000 x 500, the apron past a road's reach (70)
  and a track's (24). The regions built are those with land past the Bay in their core (a pixel every LAND_LOOK, 8),
  nearest the player first, ties north then west (regionsByNearness). The Bay's own pixels are water to every region:
  its ground is its own network's.
- **A region's places**: everything its grid holds - the countryside's and the lairs' roll (TESA7, TESA8), Arena's places
  past the Bay that stand as towns (`scenes/world.js` tamrielRoadTowns: arenaRoadTowns over the places with a template;
  a capital's own place is its gates while the capitals stand), the capitals' gates and the crossings' gates (TESA5).
  Graded as the Bay's (ROAD_TYPES, TRACK_TYPES): a city and a hamlet a road node; a village, an inn, a temple, a manor, a
  shrine and a coven a track node; a farm, a poor home and every dungeon a place a route goes round (ROADS 1). A node
  stands on its own pixel's land whatever its byte reads (a port on the shore, a gate on a bank - AUDIT-TESA A3-1's law);
  a road node takes a pixel before a track node does (TESA5's). The places in one order, north then west, whatever order
  they come in - the builder is order-bound (each route merges into the ones before it) and the atlas hands them tile by
  tile in the order it was asked.
- **Whose edge** (buildRoadNetwork `owns`, a region's core): a neighbours' edge is the region's whose core holds its first
  end (north, then west) - that region sees every node within a road's reach of it; a spanning-tree edge that is no
  neighbours' edge (a bridge between two webs, past the reach) either end's, so no region strands a town for want of the
  other's view - the one pair two regions may both route; a track link its first end's; a track's spur its node's. Each
  route is whole, into the apron where it runs there, so the regions either side of a seam route each edge once and their
  layers meet.
- **Two searches made fast**: nearestWithin (each node's k nearest within reach over a grid of reach-wide cells - a
  region's ten thousand villages were a hundred million pairs) answers the brute force's lists to the tie, and primEdges
  (Prim's walk, O(n^2) with no list of pairs) a least tree of Kruskal's length - not always Kruskal's own tree, where
  edges tie (AUDIT TESA II R12: 921 of 2,427 random trees); the Bay keeps Kruskal's. A thick region's build went from
  29 s (12 of them the pairs, 6 the sort) to 21 s.
- **The capitals** (`world/tamrielCapitals.js`): every pixel of a capital's span is an obstacle no route crosses
  (capitalSpanPixels), so no road runs over its walls, its lake or its harbour. Its roads end at its GATES: each plan's
  own sides (the Imperial City W - the bridge; Solitude S; Mournhold N E S W; Alinor N E W; Falinesti N E S W; Torval N E
  W; Helstrom N S), the pixel just past the span at the side's middle (capitalGates), a road node of every region that
  holds it, with the step into the city on the gate's own byte alone - painted to the city's edge, laid by every region
  whose roads reach the gate (AUDIT TESA II R7: the road to a gate may be the next region's edge, its first end in that
  region's core, which stepped no gate but its own core's). A gate on water or on the Bay is none. AUDIT TESA II R2
  (2026-10-25): on the freeware's data with the relief on, Solitude's one gate (S, (1565, -433)) was sealed - the
  capital's pixel north of it, the beach line's water (R1) east, south and west, and its one land diagonal a corner no
  road cuts - so the capital of Skyrim had no road. Its fix is two laws: the beach line's floor (lane G's R1, land over
  WATER_BYTE) and the gate walked out (lane C's): the first pixel out from the side's middle, within GATE_REACH (4), that
  is ground the roads walk with a neighbour that is too; a capital with no such gate is said once a land. On the
  freeware's trace the gates moved so: Solitude's S (1565, -433) to (1565, -431), Alinor's W (6, 1533) to (3, 1533),
  Torval's E (1923, 1704) to (1924, 1704) and W (1921, 1704) to (1920, 1704); Alinor's and Torval's spans two pixels
  (C2), the rest as they were. The roads' host walks them over its own ground (`scenes/tamrielRoadsHost.js` start: a
  `walkable` of the composed height it builds on - land over the beach line, past the Bay, on no capital's pixel - where
  capitalGates' default reads the authored height, the Bay's blend not in it). `test/world/audittesa2r_roads.test.js`
  holds the host to that walk and every capital to a road it reaches.
- **The roll, carried** (rollSpec, rollTypeAt): a worker holds no game rows, so the roll goes over as numbers - the
  countryside's rates and template counts, the lairs' rates, each lair template's dungeon type and plan size, each pool's
  sizes - and answers every pixel as the host does (`world/tamrielCountry.js` countryStandsAt, then
  `world/tamrielDungeons.js` lairStandsAt with lairPlanned: the host's own laws, lifted out of `scenes/world.js` to one home).
- **Where it is built** (`world/tamrielRoadsWorker.js`): one to four workers of its own (roadsWorkerCount: the cores less
  two, one at the least), off the terrain worker whose jobs stream the ground, each composing the continent's ground as every host does
  (groundWoods over WOODS.WLD's bytes, the trace and the fit) and rolling its places through a TESA13 atlas.
  `world/tamrielRoadsClient.js` keeps them busy a region each, the nearest first; asks the roads' cache first
  (`world/roadsCache.js` idbStore, regionKey: the region, the law's version, the builder's, GROUND_ROLL_VERSION and the
  inputs' print - every byte of WOODS.WLD's height map and every relief cell (AUDIT TESA II R6: a seventh of each was
  read), the fit, the trace's land, the roll's numbers, the nodes, obstacles, gates and held pixels and the dials) and
  keeps each fresh region there; re-orders what is left as the player crosses into another region (`near`); drops every
  answer of a build a new one superseded. AUDIT TESA II:
  - **R6** GROUND_ROLL_VERSION is the version of the laws the build runs that no input carries - the ground's height,
    the seam's blend, the dry plateau, the countryside's and the lairs' rolls - held to their answers by a fingerprint
    recorded beside it (`test/world/audittesa2r_roads.test.js`): a law moved and the number not fails that pin. 2 since
    lane G's beach-line floor (R1).
  - **R3** the cache's hits land a budget a task (LAND_BUDGET_MS, 8 ms, one at the least), each a task of its own: the
    forty-eight landed in one, 1.3 s in node and 2.5 s measured in the game, a frozen page on every warm boot.
  - **R4** the workers are let go once nothing is left to build and made again by the next build - each kept its copy
    of WOODS.WLD, its ground and its atlas for the session (31 MB of heap and 47 MB of buffers a worker, measured idle
    after ten regions). A build all from the cache makes none. THE FOUR HOSTS: `scenes/world.js` alone makes the roads'
    host (`scenes/tamrielPlacesHost.js`), and its life is the page's - bootWorld runs once a page, a load reloads it - so
    no teardown reaches `dispose`, and with the pool let go when idle none has to; `scenes/exterior.js`,
    `scenes/worldModes.js` and `scenes/dungeonContext.js` make none.
  - **R8** a dead worker is terminated and another made in its place (WORKER_DEATHS, 4, in a client's life), the region it
    held given back only to the build it was of; with no worker that can run - none could start, or four died - the
    page's own thread builds each region a budget a task (the builder a step at a time: `road/roadNetwork.js`
    roadNetworkSteps, `tamrielRoads.js` tamrielRegionSteps, the worker's `steps` - its init `inThread`, installing
    nothing) and says so once: TESA4's recorded fallback, its intent kept.
  - **R10** a fresh region lets go of its entries under every other print, and of TESA14's and TESA15's keys, as it is
    kept (regionPrefix: a key begins with its region); a keep that fails - no room, a private window - is said once,
    as is a page with no IndexedDB.
- **When it lands** (`scenes/tamrielRoadsHost.js`, wired on the world host's frame): once the places past the Bay stand
  and the Bay's own network is known (TESA5's wait), the crossings' joins go to the terrain client first with the layer
  reset, then each region's layer as it lands (`world/terrain/terrainGenClient.js` addArenaRoads: each add an epoch, merged into
  the installed layer on this thread and on the terrain worker - bits OR'd where two regions meet), and the host paints
  again the built pixels each one reaches (`scenes/world.js` arenaRoadsLanded; a reset repaints every pixel Arena's roads
  had painted). A move of the places that stand starts the build again. WW7-9 (`03-World/World-Wide.md`): the host's word
  of each region landed - its build's number (`build`), each region told with its grid (`onRegion`), and whether the land
  past the Bay on a box is the build's whole (`landedIn`) - so the living world wakes a region at a time.
- **Retired**: TESA4's network - the window five pixels a cell, the drawing centre to centre, buildArenaNetwork,
  arenaRoadsKey, the terrain worker's build and the host's hand-over - and TESA7's and TESA8's road law (no place on a
  pixel an Arena road crosses): the places stand first and the roads go round them, so the atlas's stamp reads no road.
- **Online** (TESA-ONLINE's law): the build is pure and its places in one order, so every client with the same release
  and the same files lays the same roads - each from its own files, nothing on the wire.
- **THE FOUR HOSTS.** `scenes/world.js` wired as above (the host module its own, HOST-SPLIT). `scenes/exterior.js` runs no
  tile pipeline (`Roads.md`); `scenes/worldModes.js` and `scenes/dungeonContext.js` paint no terrain - nothing to wire.
- **Measured** (the freeware's data, `tools/tesaRoadsAtlas.mjs`: every region with land, built in node one after another
  as a worker builds it): 48 regions in 314 s on one core, the thickest 19 s; 266,468 road and 534,627 track pixels; no
  path stops in the open, none crosses water, none crosses a capital; of the 163,640 places a road or track serves
  (hamlets, villages, temples, inns, manors, shrines, covens) 55 are on none. A bridge routed by either end was every
  tree edge over a seam at first, routed twice on two regions' different webs: as a neighbours' edge is the first end's
  alone, 1,009 road pixels of second ways went. Those are TESA14's numbers, on the ground before TAMRIEL-RELIEF and
  without TESA15's held pixels. AUDIT TESA II R12, again with the atlas laying the game's own inputs (the relief on,
  the held pixels and the crossings' runs, the towns with their templates - R5), on AUDIT TESA II's merged head (lane
  G's floor, lane C's gate walk and spans, lane M's map): 48 regions in 204 s on one core (the slowest 10 s); 264,115 road
  and 549,478 track pixels; no path stops in the open, none crosses water, none crosses a capital; of the 168,576 places a
  road or track serves, 21 are on none; every capital's every gate on land (eighteen) reached by a road. Before the floor
  the beach line's ponds had left 570 of 164,795 on none (AUDIT TESA II R1: SHORE_BYTE was WATER_BYTE, so land at the
  shore's byte was water to a road - 78,355 pixels of it under the relief) and Solitude with no road (R2).
- **In the game** (headless Chromium, the freeware's data, `tools/tesa14RoadsProbe.mjs`): booted in Daggerfall, the build
  started with 48 regions (300 towns and gates, 7 crossings) and the nearest six landed from the roads' workers within
  95 s of the page's life, 0.3 to 7.6 s a region on a busy machine; the held map's ink held 1,796 road and 5,360 track
  chains; no page error.
- **VOYAGER** (2026-10-26, `Roads.md` VOYAGER): the regions' routes pay the land's law (the grade squared on the smoothed
  height, the height, the shore, a ford over two pixels of water at the most, the land's grain; a dear road asks the
  wider box), Cyrodiil's eight named roads (the Red Ring Road round the Imperial City from its own span and gates, the
  Gold, Black, Silver, Orange, Blue, Yellow and Green Roads) are planned coarse and routed in legs after the towns' roads,
  the painter draws the layer as curves and the Overworld walks it as roads. TAMRIEL_ROADS_VERSION 4; the land's dials and
  the named roads' legs in the inputs' print (`tamrielRoads.js` inputsPrint).

## TESA15 - the map past the Bay at the world's fidelity (2026-10-24)

The owner, of the held map in the game against TESA14's picture of the whole network: *"I think the map itself ingame
doesnt match the image you just sent me. Like the fidelity of it"*; asked which of four differences, *"You make the best
decision. No band aids"*. Measured first, in the game on the freeware's data with every region landed: the roads drew at
every band but the tracks at mid and near alone (two track pixels past the Bay to every road's); the countryside's and
the lairs' marks stood only where the page's own second roll had reached (TESA13's atlas, a frame's six milliseconds at a
time - a view in to the Bay's scale filled over seconds); and the network was dear to draw: the ink walked every road
pixel again on each of the forty-eight landings (6 to 13 s a landing on the page's thread), and stroked whole it was
0.7 s a frame out on the continent and 0.2 s at far (a CPU canvas, 1150 x 720). The fix is the cause, not a dial.

- **One roll** (`world/pastBayPlaces.js`): a region's build answers its places beside its roads - the rolled ones its core
  holds that stand (`world/tamrielRoads.js` buildTamrielRegion `places`) - packed across the thread and kept in the roads'
  cache with its layer (TAMRIEL_ROADS_VERSION 2; 3 since AUDIT TESA II R7 and R9); the host resets them as a build starts and keeps each region's as it
  lands, a ROAD_TILE bin at a time, before its roads (`scenes/tamrielRoadsHost.js`); the map reads them whole
  (`tamrielPlacesIn`), and the hover's name is the host's own roll of that one pixel (`scenes/world.js` tamrielPlaceName).
  The page's second roll is retired, its budget with it (`world/tamrielAtlas.js`'s one reader is the roads' worker).
- **The host's order, kept where the places are rolled**: the build is handed every pixel an Arena place with its
  template stands (`held`: world.js tamrielRoadHeld). No rolled place stands on it or on a capital's pixel, and one that
  is no node - a dungeon's - is routed round (ROADS 1). AUDIT TESA II R9: so are the crossings' runs past the Bay, their
  gates' pixels but (`world/arenaRoads.js` joinRunPixels, handed with the held pixels by `scenes/tamrielRoadsHost.js`) -
  a village at (394, 503) and a poor home at (1000, 300) stood on two of the freeware's seven, their join painted through
  them. TESA14 had rolled a country place onto an Arena dungeon's pixel
  for the roads and let a road cross it: `_locationToBuild` stands the Arena place there.
- **The roads' ink a tile at a time** (`world/arenaRoads.js` arenaRoadTiles, arenaRoadTilePixels; `ui/tamrielInk.js`
  arenaRoadInkAt): each install stamps the ROAD_TILE tiles it moves and keeps each tile's pixels - an add merged into the
  installed layer (a region landing: `terrainGenClient.js` addArenaRoads hands it on) moves only the tiles it touches, and
  the first add into a layer works the whole of it out while it is small. A tile is walked into chains when its stamp
  moved and kept; the continent's ink (`buildTamrielInk`) holds no road.
- **Kept tiles** (`ui/tamrielTiles.js`): the roads, the tracks and the marks past the Bay painted once onto TILE_PX (256)
  device-pixel tiles at the view's LEVEL (LEVEL_STEPS, four a doubling) and drawn after, edge to edge on whole device
  pixels. A tile is painted again when its WORD moves (`pastBayStamp`: the roads' installs and the places' adds over its
  pixels and a tile's rim round them) or the paint's KEY does (the band, the continent, the filters, the hues); TILES_KEPT
  (160) or the view's own count where it wants more, the one drawn longest ago let go first - AUDIT TESA II M1: a view of
  more tiles than that (a 2560 x 1440 screen at two pixels a point wants up to 216) let go of the very tiles it drew, the
  ones nearest its middle, and painted 8 ms of them again every frame, never settling. A frame paints the tiles nearest
  the view's middle first until TILE_BUDGET_MS (8) is spent - a STEP of a tile's paint at a time, one at the least: AUDIT
  TESA II M10, `paintPastBay` answers a tile's paint as steps (PAST_BAY_STEP, 2,048 rects or runs, or the pixels walked to
  make them), each translucent pass laid solid on the tile's scratch and down once at its pen's alpha so the steps read
  as the one fill or stroke they were, and a tile mid-paint is owed and partial and shows its last whole paint - out on
  the continent one tile had been a path of 302,205 rects, a frame of a quarter of a second whatever the budget. A tile
  still owed shows its last paint, else the nearest level's tiles over it within STAND_IN (two doublings either side: a
  zoom's jump - AUDIT TESA II M3: a level kept as its whole number of quarter-doublings, `tileLevelIndex`; the stand-in
  had sought a float an ulp off the painted one, and missed at 27% of the levels it looked in, every half-doubling zoom
  out on the continent among them), and the window paints again next frame (heldMap.js's tick, takePending). The window
  owns them, and lets them go on close, the road ink's walked chains, runs and dots with them (AUDIT TESA II M11,
  `releasePastBayInk`; the walked chains are kept to ROAD_INK_KEPT, 512 road tiles, the one read longest ago let go -
  they had no bound, and a pan over the continent at mid or near kept 40 MB of them for the session); a canvas with no
  2D context is painted straight onto the sheet, as the window's own kept layer.
- **The painter's levels** (`ui/tamrielInk.js` paintPastBay, the one painter): in to the Bay's scale the walked chains,
  softened as the Bay's own; at far each pixel's steps as they lie (`arenaRoadSteps`: centre to centre, each step from
  the end it leaves east or south of, or from its one end - a gate's step into its city; a straight run one chain on its
  road tile - AUDIT TESA II M12: a run is cut where it leaves its tile, so a far tile, which reads its road tiles' runs
  and a tile's rim, strokes every step that crosses it; on the freeware's network the longest run is 37 pixels and none
  was lost, but nothing held it) - out
  there a walked chain and its pixels' own run are the same stroke, and the walk is seconds; below DOTS_BELOW (0.7 paper pixels a Bay pixel) each pixel
  a dot of the far pen's width, a kind's dots one filled path. A mark whose glyph reaches a tile from just outside it is
  painted on it too (MARK_REACH_PX), so a tile's edge cuts no glyph.
- **The tracks at far are a hair** (`ui/ink/inkMap.js` strokePaths, FAR_TRACK_PEN 0.6 in the soft pen), not left off - the
  Bay's and the continent's one law, so the Bay's own far band draws its tracks too: a recorded change to
  `10-UI/Held-Map-Arc.md`'s far band (MAP-FIELD6: "the far band draws neither ... skipping the tracks"). The far band
  still inks the cities alone of the marks (BAND_MARKS), as the Bay's.
- **THE FOUR HOSTS.** `scenes/world.js` wired as above (its map seam, its roads module's `held`). `scenes/worldModes.js`
  and `scenes/dungeonContext.js` open the world host's map; `scenes/exterior.js` stands nothing past the Bay.
- **Online**: as TESA14's - each client lays and rolls from its own files, the same for every client; nothing on the wire.
- **Measured** (headless Chromium on a CPU canvas - `--disable-accelerated-2d-canvas`; the software GPU this machine has
  runs an accelerated canvas ten times slower, no GPU's measure - 1150 x 720 paper, the freeware's network: 37,417 road and
  115,026 track chains, 302,990 places): a pan with the tiles kept 26.6 ms a frame out on the continent (915 ms with no
  tiles), 28.2 ms at far (187), 3.8 ms at mid (19), 4.5 ms near (9); a view's first paint 1.4 s over 13 frames out on the
  continent (the worst 299 ms), 0.8 s over 18 at far (the worst 96 ms - 537 before a straight run was one chain), 0.25 s
  over 15 at mid, 46 ms over 4 near. The forty-eight regions land from the cache in 2.5 s (then in one task - AUDIT TESA II R3: a budget a task); the held map in the game, out on
  the continent, at far, mid and near over Skyrim, zero page errors (`tools/tesa15MapProbe.mjs`). AUDIT TESA II M10: the
  budget held a frame only between tiles, so "the worst 299 ms" was one tile's paint whatever TILE_BUDGET_MS said - out
  on the continent's contain at one pixel a point a tile is 1,448 Bay pixels a side and its dots one path of 302,205
  rects. Measured again in node (the window's driver over the freeware's whole network onto contexts that build the
  paths and raster nothing; the process's CPU a frame, on a shared machine - the browser's raster not measured again):
  the snapshot's worst frame 288 ms on the contain at one pixel a point (113 at two), 83 ms at far (21 at two), its
  median 37 ms there; with the steps a frame's median 5 to 17 ms and its worst 25 to 48 ms, the collector's pauses among
  them. TILE_BUDGET_MS is a frame's share of steps: a frame runs past it by the one step it began (PAST_BAY_STEP, 2,048
  rects or runs, or the pixels walked to make them).

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
  the coastal cities ports; TESA13 inks them on the held map; TESA14 lays them by the Bay's own law to every place past
  the Bay. Still to come: the landforms' cut along the roads, the classic travel map's ink of them, Arena's ports on the
  contract board and the ship passage.
- **The capitals, the rest** - Solitude (Skyrim: the arch over the Karth's mouth, the Blue Palace, Castle Dour, the docks),
  then Mournhold, Alinor, Falinesti, Torval and Helstrom, each its own plan and landmarks; the Imperial City's
  Waterfront docks and its Arena's colosseum (both TESA11's now); houses for sale in a capital (its own region's deed key first).
- **Morrowind of Morrowind's own** (TESA9) - set aside by the owner, 2026-10-12: "Dont worry about morrowind".
- **The countryside and the lairs, the rest** - their places on the classic travel map (TESA13 inks them on the held
  map, TESA15 from the regions' own roll), a discovery law of their own (TESA13's departure), and quest sites in them.

## TESA-LORE - the capitals refined toward the lore (2026-10-24)

The owner, of the capitals TESA10 to TESA11 built: *"polishing and refining each capital city design and bringing them
more in line with lore and the mainline games"* (worked beside TESA13 and TESA14 on one branch, so named apart from
their numbers). Each capital read again against the lore - UESP's pages on the city and on the games that show it
(Oblivion's, Skyrim's, Tribunal's, Online's), read through a search, the site turning the port's own fetch away - and
each place the port's city stood apart from that reading moved to it. The shapes stay the port's own (TESA10's law: never
another game's mesh or level design), the districts Daggerfall's blocks, the pictures CAPITAL_ARCHIVE's. Daggerfall
Unity has no capital past the Bay to read: the departure is TESA10's (`01-Overview/Port-Ledger.md`).

- **The Imperial City** (`world/imperialCity.js`, `world/capitalImperial.js`):
  - **The Prison on the isle's north-eastern shore** - UESP: "a fortified district northeast of the main city walls
    serving as the Imperial Legion's headquarters and city prison", "found on the northeastern shore of City Isle". TESA11
    stood it north of north-east (bearing 12, "no source the port can read gives ... the Prison's bearing finer than
    'beside the Market'"); it stands at 45 now, in the north-east pixel - that slice is the Prison District, the north one
    the Market District (the Market's north half), the city wall's gate to it and its causeway on the bearing (AUDIT
    TESA II C3: to its gate in the middle of its south side - on the bearing it ran into the compound's corner tower and
    ended inside its curtain, 73.5 m from the gate).
  - **The watch towers** - the city wall's six, where the district walls meet it (UESP's sewers: the North Watch Tower
    between the Elven Gardens and the Market, the North-East between the Market and the Arena District, the South-East
    between the Arena District and the Arboretum, the South-West between the Temple District and Talos Plaza, the
    North-West between Talos Plaza and the Elven Gardens): `watchTower` on `watchTowersAt`, a drum of 18 m radius over a
    batter to 70 m, a parapet of merlons and a turret under a slate cone, in the ten-degree tower's stead - the wall band
    the city's own holds their ground.
  - **The Arboretum's Nine Divines** - UESP: "the city park, and features statues of the Nine Divines including a statue
    of Talos in the center". A paved court (46 m about the sector's middle, bearing 150 at 600 m; its cells the city's
    own, its plinths closed); eight robed figures of marble on their plinths in a ring of 28 m, each facing the middle in
    one of four poses (`world/capitalShapes.js` robedFigure: hands before it, an arm raised, both raised, a staff); Talos at the middle
    armoured on a stepped plinth, his gilt sword raised, his shield on his arm, facing the White-Gold Tower; a kerb round
    the court open toward the palace gate. Model 910212 (`nineDivines`), carried by the south slice.
  - **Read again and kept** - the six districts on their sectors (UESP: the Elven Gardens north-west, the Market
    north-east, Talos Plaza west, the Temple District south-west; the Arena District and the Arboretum between them, by
    the watch towers they share), the Arcane University south-east ("a fortified district southeast of the main city
    walls"), Talos Plaza's statue ("a dragon statue at its center"), Talos Bridge west toward Weye. The Waterfront's
    compass is still unread: TESA11's placing stands.
- **Solitude** (`world/tamrielCapitals.js` SOLITUDE, SOLITUDE_PLAN, SOLITUDE_DISTRICTS; `world/capitalSolitude.js`):
  - **Castle Dour just within the main gate** - UESP: "Castle Dour sits just within the city's main gate", "Castle Dour
    has two gateways", the Temple of the Divines on its grounds. TESA10b stood it in the city's east, 200 m from any gate;
    its square is the four blocks east of the south gate's lane now (centre (409.6, 307.2), a curtain of 80 m half-side,
    corner towers to 26 m), the gate's lane along its west curtain - its gates west to that lane and north to the city,
    the Temple of the Divines (Daggerfall's temple block) before the north gate on its grounds; the keep (36 x 44 m, to
    28 m under a slate gable) with a turret at each corner; the Emperor's Tower (56 m) in the yard's north-west. The
    walkers' gates are the model's.
  - **The Avenues** - UESP: "the Bard's College ... the Hall of the Dead, and the sumptuous Blue Palace" are the
    Avenues', the palace "right on the tip of the arch, directly above the Karth River" where they end. The Bards College
    and the Hall of the Dead (a library and a graveyard of Daggerfall's) are no districts of their own now but the
    Avenues', the Hall of the Dead beside the palace's terrace; the palace on its stack wholly over the river (kept).
  - **Read again and kept** - the Blue Palace at the arch's tip above the Karth, its arch from the city's west terrace,
    the docks and the East Empire Company's warehouse on the coast below the city, the main gate south (TESA14's road).
- **Mournhold** (`world/capitalPlans.js` MOURNHOLD, MOURNHOLD_PLAN, MOURNHOLD_DISTRICTS; `world/capitalMournhold.js`) -
  on Tribunal's plan, the nearest in time to Daggerfall's (3E 427). UESP: the Temple "in the center of a large and
  decorative courtyard, which lies at the northern end of Mournhold"; "the Royal Palace forms the center of the city";
  Plaza Brindisi Dorom "the southernmost quadrant of Mournhold, a public garden dominated by a great statue at its
  center", the statue "of Almalexia in battle with Mehrunes Dagon", its gates west to Godsreach, east to the Great
  Bazaar, north to the palace; Godsreach's "manors, The Craftsmen's Hall, a tavern, and the Mournhold Museum of
  Artifacts". TESA10c had the plaza at the middle, the palace north, the Fane east and the bazaar south-west.
  - **The plan**: the Temple Courtyard across the north (its own blocks F0-F3 round the High Fane, the temple's block
    of Daggerfall's on it), the Royal Palace on the middle four (R0-R3, the anchor its middle), Plaza Brindisi Dorom on
    the south four (P0-P3), Godsreach the west two columns (a tavern, a library for the museum, the guilds' halls,
    houses), the Great Bazaar the east two (its stalls on B0 and B1 before the shops). The ochre walls and their four
    gates unmoved (TESA14's roads).
  - **Plaza Brindisi Dorom**: its own ground a garden (grass, paved round the statue, along its two axes and at its ring
    wall's foot), its trees one tile in five of its grass (the own blocks' `tree` law, ownBlocks' fifth argument);
    the ring wall open on its four axes; the statue on a stepped plinth - Mehrunes Dagon on its west half (`dagonFigure`:
    legs astride, horned, four arms, his axe raised the statue's top) facing Almalexia on its east (robedFigure, her arm
    raised with Hopesfire gilt). Bronze both, 13 m and 10 m over a 5 m plinth.
  - **The High Fane** in the courtyard's middle (its plinth 72 m, drum 25 m, dome to 61 m with its lantern), its porch
    turned south to the courtyard and the palace; two long pools in marble kerbs either side of the way and four
    braziers along it (closed where they stand, the way between open).
  - **The Royal Palace** at the middle: a domed tower at each corner, its doors south to the plaza and north to the
    courtyard. The start markers on the plaza's ways and the courtyard, off the palace.
- **Alinor** (`world/capitalPlans.js` ALINOR, ALINOR_PLAN; `world/capitalAlinor.js`). UESP's Alinor: "located in the
  temperate southwest coast of Summerset Isle"; "reaching higher and higher will eventually lead to the Alinor Royal
  Palace, where the whole city can be surveyed from a wide vantage point"; "a great river runs through Alinor's southern
  portion and empties into the Sea of Pearls". And of the Crystal Tower: "a large structure found on the northern tip of
  Summerset" - no part of Alinor.
  - **No Crystal Tower**: TESA10c stood it on an isle in Alinor's harbour (179 m of crystal); the tower, its isle and
    its model (910131) are gone. Its picture stayed in CAPITAL_ARCHIVE, unworn, until AUDIT TESA II (lane K's K15)
    deleted it.
  - **The palace on its height**: three terraces of white stone (190 m to 5 m, 150 m to 10 m, 110 m to 15 m), each with
    a gilt course on its south face, cut on the south by the grand stair from the street (its foot at 97 m) to the top
    (`alinorStairY`: 15 m over 42 m, walkable; a low wall either side); the keep, wings, spires and great tower on the top,
    its door at the stair's head - the city's highest point over the sea. The height closed whole to the walkers; the
    start markers at the stair's foot and on the quay.
  - **The river**: the plan's row above the quay all water, from the city's west edge across the city and out under
    the east wall to the sea (the plan's south-west corner land now, so it meets the sea in the east alone); two
    bridges of white stone (`buildAlinorBridges`, model 910134) at the second and fifth columns, bank to bank, their decks
    arched 6 m over the water (walkable), parapets, piers between; the walls open where the river runs under them, a
    tower on either bank (`alinorRiverGaps`). The Merchants' Ward is the row north of it; the quay - Alinor Harbour -
    the far bank, reached by the bridges (AUDIT TESA II C10: the east one at 85.6 m now, onto the Merchants' Ward's
    street north). The houses, the tavern, the CUST block and the thieves' block of the row the
    river took went with it, the thieves' block into the Merchants' Ward.
- **Falinesti** (`world/capitalPlans.js` FALINESTI; `world/capitalFalinesti.js`). UESP: "the city sits in the boughs of
  a giant Elden Tree"; of the graht-oaks, "in their mighty boughs, Bosmer live alongside the ape-like Imga in a mobile
  ecosystem, coaxing the living wood into pathways winding around hide structures nestled in hollows". TESA10c's oak held
  three bare platforms over a city on the ground; the city is in its boughs now:
  - **The walkway** winding up the trunk from the ground - a turn a level (`spiralAt`), its inner edge clear of the
    bark (`spiralInner`), its deck, outer face and rail - to each platform and on to a fourth (30, 62, 94, 126 m; 12 m
    wide now). Walkable throughout; where it rises from the ground it runs through the buttress roots, as living wood.
    AUDIT TESA II C4: it was not - it climbed into the underside of every platform it reached (a body's headroom down to
    0.17 m over its last 9 to 14 m) and through the roots at its foot (0.18 m). Each platform's deck is open over the
    walkway's last 45 degrees to it (`platformGap`, `platformOpen`), the roots stand on the arc its first rise has cleared
    (`rootArc`), the huts round from the landing (`hutFrom`), the limbs from above the highest platform (`limbFrom`): a
    body's 2 m over its deck across its width, from the ground to the fourth platform.
  - **Hide houses** (`hideHut`: a cone of hide on its poles - the new picture `hide`, tanned panels stitched) six on
    every platform, clear of the walkway's landing, and two on a timber deck at every limb's fork (`limbForks`, 130 to
    175 m up, under the crown). Daggerfall's blocks stay at its foot - the engine's city - the oak's own above them.
- **Torval** (`world/capitalPlans.js` TORVAL, `estateBeds`; `world/capitalTorval.js`). UESP: "its ruler's palaces stand
  among gardens of sugarcane laid out in symmetry, where the Mane meditates on a palanquin", the estates kept from
  outsiders, moon sugar being sacred. TESA10c's palace stood bare on its blocks:
  - **The Mane's estate** (`buildManeEstate`, model 910154): the palace's four blocks walled in low sandstone, one gate
    south to the temple; its ground grass (the estate's own tile law) with the palace's axis paved; sugarcane (the new
    picture `cane`) in beds mirrored about that axis - twelve rows a side beside the palace and four a side north of it
    - closed to the walkers, the ways between them open; the Mane's palanquin on its dais on the axis north of the
    palace, its litter, posts, carrying poles and canopy of cloth.
  - **The moons**: a gilt crescent (`crescent`, two arcs crossed, thick at the foot and thin at the horns) where a spike
    stood on the palace's dome and its four minarets, and one on each of the Temple of the Two Moons' domes, Masser's
    and Secunda's - the Khajiit's moons over their own temple.
- **Helstrom** (`world/capitalPlans.js` HELSTROM, `histStones`; `world/capitalHelstrom.js`). UESP: "found in the
  impenetrable center of Black Marsh"; "the marsh of Helstrom is very dense and heavily consumed by Heart-Mud, which is
  reportedly very dark in color". The city's own ground is the heart-mud now (Daggerfall's dirt, record 1, the marsh's
  dark ground) but the paving at the Xanmeer's foot (58 m about it); the Hist, the heart of an Argonian city, grown from
  44 m to 64 m (its trunk 9 m, its crown 30 m) and ringed on its isle by eight standing stones of mossy stone under
  their capstones, closed, the ways between them open.
- **The pictures and their texels, at vanilla's detail** (`world/capitalModels.js` capitalArt, `vanillaTexels`; the
  owner: *"ensure all new textures your adding fall in line with the detail of vanilla textures. Same resolution and
  all"*). Measured on the freeware (the player's ARENA2; nothing of it kept):
  - **Resolution**: Daggerfall's wall and ground textures are 64 texels wide - 1,087 records 64 x 64 and 521 64 x 128
    of 6,713 (the rest flats and odd sizes). Every capital picture is 64 x 64, as it was.
  - **Detail**: its 475 wall and ground textures 64 texels wide (TEXTURE.002 to .099) hold a few dozen colours a picture
    (the tenth to the ninetieth percentile 16 to 84, median 42), each texel apart from the next on its row (mean |dL|
    5.4 to 18.4, median 10.9), their luminance spread 11.3 to 41.6 - painted off a palette's ramp, every stone bevelled.
    The capital pictures were smooth noise and flat masonry: marble 1.4 from texel to texel, gold 0.5, timber 1.1,
    bronze 0.7; gold, bronze and the leaves 119 to 154 colours of gradient. All twenty-one (twenty since K15's crystal went) are painted again in
    Daggerfall's manner, not only the two this slice added (`hide`, `cane`): a tone law quantized to its material's
    ramp of 28 shades (`ramp`) through a 4 x 4 ordered dither with a texel's own grain (`painted`); masonry laid stone by
    stone (`masonry`: courses and stones of random length summing to the side, each stone its shade, mottled, lit on its
    top and left edges, shadowed on its bottom and right, chipped here and there, the joints dark); slate and terracotta
    in shingles and barrel tiles; timber in planks with grain and knots; crystal in facets; leaves in lit clusters; cane
    in stalks ringed at their nodes. Every one of them within the freeware's band but the doors' dark; every law tiles
    (noise at whole multiples of the texel, courses, rows and stripes dividing the side - the timber, bark, gold,
    terracotta, hide and bronze laws did not, and do now).
  - **Texel density**: the freeware's ARCH3D faces (34,982, through MeshReader's law) carry 40.9 texels a metre under a
    64 x 128 wall texture, 22.8 under a 64 x 64 one, 39 on a floor - the middle half 22.5 to 41. The capitals' shapes laid
    their pictures at repeats of their own: most faces 10.7 texels a metre, the White-Gold Tower's 5, the Graht-Oak's
    leaves 3.6 - a quarter of the detail of Daggerfall's houses. Every capital model is mapped again as it is installed
    (`vanillaTexels`, on the model door's build): each triangle on the axis plane its face turns to most, a picture every
    `CAPITAL_TEXEL_METRES` (1.6 m) - 40 texels a metre, 30.4 the least on a face tilted from its plane. The shapes' own
    texture coordinates stay the stand-in view's. AUDIT TESA II C14: the plane is its face's - a quad's two halves turned
    to their planes by their own rounding, and 230 of the models' 63,907 planar quads (a wall at 45 degrees, a cone's
    sliver half; the audit's 732 counted the oak's twisted quads too, two faces each) were mapped on two, a seam down the
    diagonal: a quad's second half takes its first's plane wherever that turns
    it within the bound, and a near tie between a triangle's two greatest axes is broken by its face's normal. None is
    split now.

## TESA-BIOME - the land past the Bay, each province its own country (2026-10-24)

The owner: *"Each region recieves its own biome. Cyrodil receives the unique jungle biome we developed. Every biome must be
lore accurate and have lore accurate fauna attached. As detailed as possible."* Its page is `03-World/Tamriel-Biomes.md`.
What it moves here: the ground past the Bay is a province's ZONE's climate, not the province's (`tamrielGround.js`
tamrielClimateAt over `world/tamriel/tamrielBiomes.js`), so the countryside's and the lairs' rolls (TESA7, TESA8 - the
Bay's own count of each kind on a climate) read the zone's - a hamlet of the Rainforest's in the Nibenay, of the Desert's
in the Alik'r - and so do the capitals' climate swaps; the Imperial City stands in the Nibenay Valley's grassland
(Woodlands), ringed by the jungle (AUDIT TESA-BIOME, `01-Overview/audits/Audit-Tesa-Biome.md`). The capitals, the places and
the roads are otherwise as they were.

## IC-RING - the Imperial City in the middle of Lake Rumare's ring (2026-10-24)

The owner: *"the imperial city is wrongly placed. Should be placed in the middle of the circle river type landmark."*
Daggerfall's map draws Lake Rumare as a ring of water in the Imperial Province (the trace's 49-pixel lake, picture x
163-177, y 95-101, its isle inside, open to the south toward the 11-pixel lake), and TAMRIEL1's point for the city,
(178, 96), stood on the ring's east rim - Bay pixel (2177, 612) on the freeware's fit, the lake at its west door.

- **The point** (`world/tamriel/tamrielGeography.js` CITIES and `world/tamrielCapitals.js` CAPITALS, one point in both):
  (171, 99), the middle of the ring's isle (its land x 167-175, y 97-101) - Bay pixel (2069, 658) on the freeware's fit,
  the nine pixels well inside the isle. The authored shape draws no ring; the capital's pixel law takes the point there as
  it took the old one.
- **The valley with it** (`world/tamriel/tamrielBiomes.js`): the city is the Nibenay Valley's seed, and the Nibenay
  Jungle's five hearts ringed the old point - moved with the city (-7, +3), the one that fell in the trace's lake
  ((181, 111)) at (183, 110) - so the grassland is round Lake Rumare and the jungle round it still. BIOMES_VERSION 4.
- **What moves with it:** the roads past the Bay (the capital's gates are its nodes; laid again), the city's pin for
  Arena's place of its name, its map mark, and AUDIT-TESA A3-2's road end on the lake (the city no longer stands at the
  water). (AUDIT TESA II C1: the road ended at the 'W' gate, but 41.5 to 43.6 m under Talos Bridge's end - closed with
  TESA10's rim, TESA11 above.)
- **A RECORDED DEPARTURE** (AUDIT TESA II C12, 2026-10-25): the trace's isle inside Lake Rumare's ring is about 110 x 60
  km; the city moved 39 pixels (32 km) inside it from the ring's east rim, so the city's own lake - the plan's 217 cells,
  its outer ring - is a moat 2.5 km across in the isle's middle, and Talos Bridge crosses it to the same isle, not to a
  mainland. The lore's City Isle in Lake Rumare is the picture's ring round the isle; the city's own water is its moat.
  TESA11's "City Isle in Lake Rumare" and "Talos Bridge west to the mainland" read so. IC-GRAND (below): at twenty-five
  pixels the city's own lake is a ring 2.1 km across between City Isle's shore (7.9 km) and its far shore (10 km), the
  whole city 20.5 km across inside the trace's isle.

PINS MOVED: `test/tesa10_capitals.test.js` (the pixel, the host's ask, the sweep: (2069, 658) and (1315, 495) on the
pins' second fit), `test/tesa11_imperial.test.js` (the pixel law over nine, the west-slice fixture at column 172),
`test/world/tesabiome_biomes.test.js` (the four-pixel fixture at the new corner, read on the Nibenay's zones;
BIOMES_VERSION 4), `test/world/tamrielrelief.test.js` (the version).

## MAP-LINES - the zones' borders, Cyrodiil's zone on the map, and a faster zoom (2026-10-24)

The owner: *"Theres no visible region lines, and cyrodil doesnt have the same detauled flavor of the wrothgarian pvp
zone. The map also is slow to load when zooming in and out Like the entire middle region should have.the fire outline
wrothgarian does"*.

- **REGION-LINES** (WITHDRAWN 2026-10-25): the 43 biome zones' borders (`zoneChains`, made a slice a frame) were drawn
  dotted for a day. The owner: *"Those are just random lines"* - unnamed and wandering through the land, they told a player
  nothing - and then, with a map of Tamriel each province cleanly parted: *"This is what I mean by region lines. Each
  region distinctly separated (ignore the colors)"*. REGION-LINES 2 below replaced them; their code and pins are gone.
- **ZONE-OFFLINE** (`scenes/world.js`, the window's `wildMask`): the map's open zone was `wildMapMask`, Cyrodiil's mask
  online and none offline, so a player offline saw no fog, red line or rings on Cyrodiil. The map now reads
  `cyrodiilMask` online and off; the zone's rules (`wildMapMask`) stay online's, and the map says them online alone
  (AUDIT TESA II M5, `heldMap.js:"_zoneLaws() {"` - off the host's halls, null where wildMapMask is): offline the key's
  tip says the zone is open PvP online and that none of its laws runs here, its door's title names no loot, a press on
  the zone is the world map's (a Portal Stone's to Cyrodiil's cities among them - the zone map had taken it), and the
  zone map's legend gives the rings without their loot and one line for the laws (`ui/wild/wildZoneMap.js` ZONE_MAP_TEXT,
  through the text core). Its travel law is Cyrodiil's online too: no fast travel and no carriage reaches it or runs
  inside it (the Wrothgarian zone's carriages and journeys have no town there - `03-World/World-Wide.md`, What stays).
  The fire is still the hover's alone
  (the owner's rule, 2026-10-18: "the border only burns when you hover over it on the world map not when youre already
  zoomed in on the zone") - it now burns on Cyrodiil's border offline too.
- **ZONE-NAMES** (`ui/heldMap.js` _zonePlaces): the zone map named only the Bay's places; it names the continent's cities
  inside the mask too (a city-state a city, a town a village), and its hover answers past the Bay. Its fog is painted by
  the continent's layer under the cities and names (`opts.under`, ZONE-NAMES-OVER), so the names read through it. AUDIT
  TESA II: on the zone map a city inside the zone is named by the zone map alone (M6, `nameless` - both had lettered it,
  in two sizes four pixels apart, and Hide place names hid one); the zone's halls, the Bay painter's own marks, are inked
  over the fog beside it (M4 - under it their doors were 0.78 fogged); the names under the map's filters (M7); and the
  kinds pinned (K5: a capital and a city-state the city, a town the village).
  The zones themselves are not named on the map: a new name a player reads needs its translations (L10N), recorded.
- **ZOOM-FAST**: measured on the freeware's whole network (a CPU Skia canvas at two pixels a point), a far band's first
  paint was 1867 ms at scale 0.69 and 3673 ms at 0.3. Three changes:
  - the far painters' work kept a road tile at a time (`ui/tamrielInk.js` arenaRoadSteps and the dots, ROAD_KEPT_TILES
    1536, dropped when the roads' layer moves): 909 ms and 2048 ms - AUDIT TESA II M11: the dots kept to ROAD_KEPT_TILES
    2048, past the freeware's 1,702 road tiles (the contain view's dots kept whole, 6.5 MB), the runs to ROAD_RUNS_KEPT
    768 (a far view reads some 530 road tiles; the whole network's runs are 85 MB), each the one read longest ago let go
    and no empty tile kept - the contain view asks all 5,546 of the frame's, and at 1536 the caches filled and were
    dropped whole mid-view. Measured over the freeware's network after a pan over every road tile: the walked chains
    47.4 MB kept for the session before, 14.7 MB after (512 tiles); the runs 35.2 MB (768); all of it 0.2 MB once the
    window shuts;
  - the world sheet in three parts (`ui/heldMap.js` paintStatic) while the land past the Bay is in the view (AUDIT TESA II
    M11: on the Bay alone none - they were two canvases of the sheet's own size, 23 MB each at 1728 x 1117 at two
    pixels a point, for no frame saved): the Bay's ink and the continent's land kept on one
    canvas, what stands over the roads (the borders, the zone, the cities, the names, the zone map's wash) on another,
    and the road tiles between - a frame whose only news is a tile painted is two drawImages and the tiles, where it was
    the whole sheet stroked again;
  - a zoom still going (the scale moved within ZOOM_SETTLE_MS 150 - AUDIT TESA II K3: a law of its own,
    `heldMap.js:"export function createZoomSettle"`, pinned; answering yes forever painted no road tile ever, and no test
    failed) paints no road tile and bakes no marks layer; a tile
    owed shows a stand-in, sought under the last key too (`ui/tamrielTiles.js`), so crossing a band keeps the roads up.
  Not measured end to end in a browser.

### REGION-LINES 2 - each province distinctly parted, and one icon a kind across Tamriel (2026-10-25)

The owner, with the map: *"This is what I mean by region lines. Each region distinctly separated (ignore the colors).
Also, daggerfall's clustered icons need to be fixed amd standardized across tamriel with this change"*.

- **The provinces' line** (`ui/tamrielInk.js` PROVINCE_PEN, provinceLines): every province's border a solid stroke in
  the shore's ink (2.6 px) on an 8 px halo of the parchment, over the roads' web, at every zoom - it was dashed in the
  region's faint ink. Each province's name on a halo too, 18 px out on the continent (15, bare, was lost in the web).
- **Cyrodiil's line** (ZONE-LINE, 2026-10-26, `11-Multiplayer/Wild-Zone.md` section 27; the owner: *"Also ensure the pvp
  border outlines cyrodil perfectly, currently it doesnt"*): Cyrodiil's borders and its open coast are the open zone's
  own line (`cyrodiilZone.js:"export function zoneLineOf("`) - the province's outline on the traced picture, unsmoothed,
  the red line drawn on it - where TAMRIEL4's corner cut had drawn them up to 12 pixels off the province's law at a
  corner. `tracedChains` keeps no border with Cyrodiil on one side and leaves its open coast to that line; a lake inside
  it and every other province's line are drawn as before, a neighbour's coast and border ending on the line's corner.
- **On the Bay**: High Rock and Hammerfell need no drawn line - on Daggerfall's own map the Bay's water and the Bjoulsae
  at its eastern tip part them (a fill over the Bay's land from the kingdoms of each finds no shore where they meet). The
  continent's High Rock - Hammerfell border runs on past the Bay's frame.
- **The icons** (`inkMap.js` paintInkMarks, `tamrielInk.js` bayCapitals, ARENA_KIND_GLYPHS): out on the continent the
  Bay inked every port's anchor, carriage wheel, hub's and seat's ring at every band - thousands of glyphs piled into
  smudges where the Bay is a hand's width. There the Bay now inks none of its own; its three kingdoms' capitals (Daggerfall,
  Wayrest, Sentinel - `systems/region/regionHubs.js` HUB_CAPITALS) stand in the continent's layer as every province's
  capital does, glyph and name; the player's own mark stays. Its sixty-two region borders are not drawn there either (no
  province past it shows its inner lines). One glyph a kind across Tamriel: Arena's city-state is a city as the Bay's
  TownCity is, its town a hamlet, its village a village (it drew a city-state as a hamlet and a town as a village); the
  zone map's kinds the same.
- **Recorded:** in to the Bay's own scale its marks keep their bands (far inks its 410 cities, with the ports' anchors and
  the wheels at every band - PORT-MAP, OW-HUBS); the Bay's town names stay off (MAP-FIELD2) while the places past it are
  named. The Bay's roads at the continent's zoom are its own pens; the continent's are its dots (TESA15).

Pins: `test/ui/regionlines.test.js` (3: the provinces' line, solid, none drawn within the Bay; the Bay's icons on the
continent and one glyph a kind; the wiring by source),
`test/tesa15_mapfidelity.test.js` (two ZOOM-FAST tests: the tiles unforced and the last key's stand-ins; the road steps
kept). Mutants `tools/mutants/regionlines.json` (11, all dead), `tools/mutants/tesa15.json` (three ZOOM-FAST, all dead).
PINS MOVED: `test/ui/tamriel.test.js` (the line solid, the name 18 px haloed, the rectangle test's arm),
`test/tesa12_places.test.js` (one glyph a kind), `test/world/worldWide/wwc2_zone.test.js`, `test/tesa15_mapfidelity.test.js`,
`test/tesa13_mapink.test.js`, `test/ui/mappan.test.js` (the sheet's parts); mutant records re-aimed by content in
`tesa15.json` (4) and `wwc2.json` (1), all dead.

Section A, MAP-LINES (OURS: DFU's map stops at the Bay's edge; the land past it, its zones and the open zone are the
port's own).

AUDIT TESA II, lane M (2026-10-25): the held map past the Bay, read cold - its findings and their fixes are marked
`AUDIT TESA II M<n>` in the code beside each, and named above where they changed a sentence (M1, M3, M10, M11, M12 in
TESA15; M9 in TESA13; M7 in TESA1's map; M2, M4, M5, M6, M11, M13, K3, K5 here; M8: bare land past the Bay answers with
the host's own ore card off its maps, `heldMap.js:"_pastBayHover(mx, my) {"`, so WW-C1's "Cyrodiil holds every
province's ores and metals" is read where it was written for; M14: a glyph past the Bay answers from the Bay's side of
the seam, `tamrielInk.js:"export function tamrielHoverAt"`). Pins: `test/ui/audittesa2m_tiles.test.js` (11: the view's own
tiles kept, the stand-ins at every level and the level a scale paints at, a dense tile in steps and its walk a step's work, the far steps' passes, the
caches bounded and let go, a long run across a far tile, the zones' ends on the coast, the cities under the filters and
in their hues, `nameless`, the seam, the Bay's own far tracks a hair through the one pen) and `test/ui/audittesa2m_window.test.js` (8: the zones and the face landing, the
halls over the fog, the zone offline and online, the zone map's names once and their kinds, a landing far off, the
parts on the Bay and the release on close, the settle, and with ARENA2 the ore card past the Bay off the producer's
own maps). The dense-tile pin is a 128 x 96 block, its rect lists compared by count and by a boolean (a deep diff of two
unequal 73,728-rect lists cost node's assert 11 GB). Mutants `tools/mutants/audittesa2m.json` (43, all dead) and
`tesa15.json`'s three settle records (K3). PINS MOVED: `test/tesa15_mapfidelity.test.js` (the kept count, the static key,
the paint's seam), `test/tesa13_mapink.test.js` (the hover, the roads' landing), `test/ui/regionlines.test.js` (the
tick, the coast, the hover, the zone map's names), `test/ui/tamriel.test.js` (the hover, the press, the layer's one
import of the maps file's type table), `test/tesa2_arena.test.js` (the cursor), `test/world/worldWide/wwc2_zone.test.js`
(the zone over the continent), `test/ui/heldmap.test.js` (the face), `test/world/road/roads.test.js` (the paths' one pen, `pathPen`),
`test/ui/ink/portmap.test.js` (the Bay's marks apart from the halls), `test/systems/l10n4_hardcoded.test.js` (heldMap.js
42 -> 41, wildZoneMap.js 17 -> 15); records re-aimed by content in `map1.json` (2), `regionlines.json` (5),
`tamriel.json` (3), `tesa13.json` (8), `tesa15.json` (16, and one added: the level a scale paints at), `tesa2.json` (1) and `fb1011_oremap.json` (1). THE FOUR
HOSTS: no host's wiring moved - `scenes/world.js`'s map seam as it stood (the zone's laws read off its `wildDungeons`,
null where `wildMapMask` is); `scenes/worldModes.js` and `scenes/dungeonContext.js` open the world host's map;
`scenes/exterior.js` stands nothing past the Bay. Online: nothing on the wire moved.

## IC-GRAND - the Imperial City at twenty-five pixels: its districts, its rooftops, its sewers, Daggerfall's arena (2026-10-26)

The owner (Mac, 2026-10-25): *"Imperial city needs to be larger. Im thinking 10km."* - *"Each district needs to be
distinct with more varying layouts. Its time we also develop proper city-like scapes with parkouring opprotunities."* -
*"The arena in daggerfall needs to replace the collisium we currently have in IC. Dont remove it from daggerfall."*; then
(2026-10-26) *"Lets do 20km"*; and he forwarded the team's spec (KPbICA's) for the city: the White Tower *"500m+ height,
like 150-200m diameter in the foundation and like 60-70m diameter in the shaft"*, *"Walls should be higher. Like 35-40
meters"*, *"Roads should circle around the White Tower with wide long straights every"* (the sentence ends there), ten
districts by name each in its own lore style, buildings in cut stone, brick and half-timbering, inner yards and
backyards, a street hierarchy (wide main streets with pathways, side streets, alleys, dead ends), and *"Sewage system
(that will be used for creating Sewers in the future)"*. It supersedes TS5's seven pixels in every measure
(`03-World/Town-Shapes.md` TS5) and TESA11's Colosseum; the six other capitals stand as they were.

DFU's reference: a city is its MAPS.BSA row's grid of RMB blocks, one location a map pixel, eight blocks a side at most
(RMBLayout, DaggerfallLocation) - TESA11's slices are that law nine times over. DEPARTURES (named, Port-Ledger section A,
IC-GRAND): the Imperial City's own blocks stand streets and buildings no block of Daggerfall's carries (the fabric);
its far slices stand a view of their own (no building, no dungeon, no walker); its blocks and models are families made
when first read; the city past the stream's reach is drawn on the far ring's pass.

- **Twenty-five pixels, 20.48 km a side** (`world/imperialCity.js` IMPERIAL_SPAN 25, IMPERIAL_CELLS 200): the owner's
  20 km at 819.2 m a pixel is 24.4 pixels; 25 (20.48 km) is an ODD span - the slice law needs a centre slice whose
  middle is the city's anchor (TESA11's capitalCentre, the anchor at the plan's middle grid point) - and 24 (19.66 km)
  would put the city's middle on a pixel's corner. Six hundred and twenty-five slices, each its own location, its map
  id and index its ordinal's (capitalSliceOrdinal - the lane's 0x80000 bit holds 625 ordinals); the outskirts' round
  towns fifty pixels from the centre (IMPERIAL_OUTSKIRTS, TS5's law at the new span). WW7-11 (`03-World/World-Wide.md`): to the living world the city is
  ONE town, its centre slice's (`scenes/livingWorld/livingIndex.js` capitalStreet) - the other 624 its streets, in no town's
  list near and sending no traveller - so a town by the city has one town more near it, never 625.
- **The wheel at its new size** (IMPERIAL): the White-Gold Tower on its plaza (300 m), Green Emperor Way's ring road
  (2140-2180 m), the twenty-four emperors' tombs on its inner verge at 2.08 km (TESA11's 1.4 km on the lawns - moved by
  the Palace District below), the palace wall at 2.3 km round the PALACE DISTRICT (the team's list names it; TESA11's
  "Green Emperor Way" is its ring road's name now), the city wall at 6.9 km (TS5's
  1.95), City Isle's shore at 7.9 km, Lake Rumare's far shore at 10 km, the land past it Rumare Shore (TS5's open
  ground). Each district on its sector as TESA11 laid them (the Market north-east, the Arena District east, the
  Arboretum south-east, the Temple District south-west, Talos Plaza - the team's Nobles District - west, the Elven
  Gardens north-west), its heart on its avenue at 4.6 km: the Market's great square, the arena, the Nine Divines,
  the Temple of the One, Talos's dragon, the Elven Gardens' pool. Outside the wall on the isle the Prison (45 degrees,
  7.4 km, its compound 600 m), the Arcane University (135 degrees, 7.5 km, 680 m), the Waterfront (158-202 degrees, its
  quay at 8.1 km, twenty-one piers to 8.45 km); Talos Bridge west from the city wall's gate to the far shore's landing
  (10.04 km); a lake cell a landmark crosses (the bridge, the piers) the city's own block, so a slice of open lake the
  bridge runs over carries its part. The plan: 10,267 cells of lake, 9,716 open, 19,345 the city's own, 671 of
  Daggerfall's blocks (each district's trade along its avenue, round its heart, scattered; TESA11's signatures), one
  Daggerfall's arena. The slices' names: Lake Rumare 174, Rumare Shore 152, City Isle 41, the Market 40, the
  Arboretum 39, Talos Plaza 36, the Arena District 36, the Elven Gardens 34, the Temple District 33, the Palace District
  20, the Waterfront 14, the University 3, the Prison 2, and the centre the Imperial City.
- **The White-Gold Tower** (IMPERIAL.tower; `world/capitalImperial.js` buildImperialTower). The team's spec gave 760 m
  (*"500m+ height, like 150-200m diameter in the foundation and like 60-70m diameter in the shaft"*); DEPARTED FROM BY
  THE OWNER (2026-10-26, a reference picture of another game's tower with it - shapes of the port's own, nothing traced):
  *"the imperial city tower model needs to be much larger and taller like this with the surrounding gate have large
  pillars like the image shows"*. So: ROUND (48 faces, not TESA11's octagon), TS5's 1360 m to its gilt spire's tip; out
  of the palace's ROTUNDA - a wide, low drum 320 m across and 56 m high under a low dome 44 m higher, an arcade of
  twenty-four dark arches round its wall, twelve little gilt domes on its rim, the palace's door on its east face; the
  shaft 144 m across at its foot (the 60-70 m of the spec gone, the owner's call) tapering to 108 m, FLUTED - every
  other corner of its 48 standing 4.5% in, ribs like clustered columns - in TIERS of 126 m each ringed by a cornice
  (every other one a gilt, crenellated balcony); its gallery at 1090-1120 m, crenellated; its crown, fluted, to 1210 m,
  crenellated; the gilt spire to 1360 m. 7.7k triangles; still wholly in the centre slice (its plaza 300 m round the
  rotunda, the start markers at 220 m on it). The far views carry it (`world/imperialImpostor.js`: the rotunda, its
  dome, the shaft in bands, the gallery, the crown, the spire - the far landmark and capitalSkyline's), and its foot's
  closed ground is the rotunda's (imperialClosed).
- **The walls 38 m** (the spec's 35-40; TS5's 28): the city wall 14 m thick, a tower every two degrees (52 m), the six
  watch towers 100 m where the district walls meet it, nine gates (the six avenues', the Prison's, the University's,
  the Waterfront's); the palace wall 20 m, six gates; the district walls 16 m, three gates each where the ring roads
  cross them.
- **The roads** (IMPERIAL.roads, `imperialRoads`; the spec's sentence cut off after "every", read as: ring roads round
  the tower joined by long straight radial roads at a regular interval): Green Emperor Way round the tower inside the
  palace wall and three ring roads in the districts (3.45, 4.6 and 5.75 km, 20 m wide); out from each palace gate to the
  city wall a grand avenue at its sector's middle (30 m) and a radial either side of it at its quarters (16 m) - a
  straight road every fifteen degrees, eighteen in all. The roads are the city's stone, kept clear of every block.
- **Each district its own, and its neighbourhoods each their own** (`world/imperialFabric.js` IMPERIAL_STYLES, hoodAt):
  a frame of streets a district - the Market a grid of dense arcaded blocks round open squares (ochre, brick and white
  walls, terracotta roofs), the Arena District rings and spokes round the arena and round circuses of its own (timber,
  brick, ochre), the Arboretum a park of groves, lawns and paths with villas at its edges and its statues (white lime
  and cut stone, blue slate), the Temple District long processional blocks on its avenue's axis (cut stone and white,
  slate), Talos Plaza the nobles' tall cut-stone ranges on spokes round its dragon, the Elven Gardens winding lanes on a
  warped grid with canals and garden courts (white and stone, blue slate), the Waterfront warehouses in rows to the quay
  (timber and brick). Each district is cut into five rings out from the palace wall (HOOD_RINGS) and each ring but the
  heart's into four between the radials - seventeen neighbourhoods, each its own frame off its own seed (its turn, its
  blocks' sizes within 14%, its heights a half storey up or down, a polar district's circus a grid now and then, the
  Arboretum's villas by its walls).
- **The urban fabric** (makeBlock, fabricCell): a block of streets ringed by its buildings round a court where it is wide
  enough, else a row through it; the court parted into backyards by garden walls (YARD_WALL), a shed in one yard in
  three; one alley end in three closed by a wall across it (a dead end); its walls the street hierarchy's - an alley
  (ALLEY 3.2 m), a lane, a side street and a main street (10 m and up) whose fronts carry a pavement a step up
  (PAVEMENT); the Elven Gardens' every third street a canal; the Arboretum's statues on their plinths. The fabric's
  buildings are facades - no door, no inside (Daggerfall's blocks are the city's houses, shops, temples and guilds).
- **The Palace District** (the coordinator's review of the renders, 2026-10-26: *"THE PALACE DISTRICT reads empty ...
  the palace at the tower's foot, Green Emperor Way's gardens and paths, the emperors' tombs as real monuments along the
  way, walls/gates of the palace wall dressed, and trees and statuary - so from the air and from the street it reads as
  the heart of the Empire, not a lawn"*; `world/imperialCity.js` IMPERIAL.palace, .gardens, .tombs; `world/capitalImperial.js`
  buildImperialPalace, buildPalaceGardens, buildEmperorsTombs, buildPalaceWall). THE IMPERIAL PALACE round the tower's
  plaza: twelve marble wings from 312 to 352 m (24 m to their gilt cornice, hipped roofs of slate, two storeys of windows
  on both faces), a gate 26 m wide and 16 m high through each wing a palace gate faces - the tower's door's, east, among
  them - under a gilt pediment; and THE OWNER'S "LARGE PILLARS" (2026-10-26, above): a great round pillar-tower 32 m
  across and 64 m high - well over the wings - its gilt band at the eaves, a corbelled band and a crenellated top, on
  each outer corner and either side of each gate (twenty-four: palacePillars); a paved terrace round it; 15.6k triangles,
  carried by the centre slice (910213). GREEN EMPEROR
  WAY'S GARDENS (910214): a paved path out from the terrace to the Way every thirty degrees (14 m - the six on a
  district's bearing run on through its palace gate), ring walks at 900 and 1,500 m (8 m), a fountain where a path
  crosses a walk (24: a marble basin 9 m round with its water, a pedestal, two bowls and a gilt finial, a paved round
  about it), the emperors' statues along every path facing it (240: a marble plinth, a robed emperor in bronze crowned in
  gold, 160 m apart either side), a row of trees beyond them on both sides of every path and either side of the walks
  (a tree every other tile), groves on the lawns between and a lone tree now and then (24.7k trees in all - the lawns'
  random one in seven, 52k, gone); 24k triangles over 21 slices, each part built of its own monuments alone (PART_BUILDS).
  THE TOMBS along the Way's inner verge (2.08 km), two either side of every garden path's end: each a marble mausoleum
  26 m square on its podium and its step, its cella, a portico of six columns under a gilt-banded entablature before its
  door, a stepped pyramid over all to 34 m and a gilt cap - turned to face the Way, a paved walk out to it. THE PALACE
  WALL'S GATES DRESSED: each a gatehouse - a marble arch over it from its lintel to 3 m over the walk, a gilt frieze, the
  gilt crest over its middle on both faces - its passage open under it. Each ground's law the law's own (imperialTile:
  the paths, walks, rounds, podiums and walks stone; imperialClosed: the palace's wings but their gates' passages, its
  pavilions, the basins, the plinths, each tomb's podium in its own frame); and seen from afar - the centre slice's
  silhouette carries the palace's wings and domes, the tombs' slices their tombs (imperialImpostor.js). Drawn without a
  browser: from Green Emperor Way the tower over the palace's ring and domes, the paths' statues and rows of trees, the
  fountains on the walks, the tombs facing the Way.
- **Courts courtyard-sized, no lot left bare** (the same review: *"BLOCK INTERIORS and VOIDS ... Courtyards should be
  courtyard-sized (yards, gardens, sheds, wells, trees), streets and plazas paved, and large empty lots either built,
  planted (gardens, orchards in the Elven Gardens/Arboretum) or made squares with something in them"*;
  `world/imperialFabric.js` makeBlock, BACK, WELL, SQUARE_FOUNTAIN, ORCHARD, fabricTreeOf). A court 30 m or more across
  both ways stands a BACK RANGE in its middle - the house behind the house, a workshop, a coach house, a storey or two
  under the ring's lowest and its own roof - 9 m in from the ring all round (the yards round it), split across its longer
  way into pieces near 24 m long, 5 m apart; the garden walls then run from the ring to its faces (never through it); a
  well in one court in two (its round stone kerb, two posts and a little roof - closed ground); a square's middle stands a
  fountain (its basin, its water, a column and its bowl); the stone yards a tree one tile in eleven; the Arboretum's park
  and the Elven Gardens' garden courts ORCHARDS where their patches stand (one 96 m patch in three: a tree every other
  tile each way, in rows). Six to eight per cent more triangles a slice. FOUND AT THE PIN: a block's garden walls, dead
  ends, sheds, wells and statues closed only the cell its middle stood in - a dead end's wall across an alley into the
  next cell was walked through there; the cell's ground now asks every near block's (its `ground` list), the block whose
  middle is the cell's drawing them once. The streets, squares and paths were already the city's stone; the dark lots in
  the scratch's renders were Daggerfall's own blocks, which the rasterizer does not draw (in the game they stand).
- **The rooftops are a way** (FABRIC_LAWS - every number the movement's own, `player/parkour.js` and `player/motor.js`):
  a roof beside a roof at most ROOF_STEP (1.6 m, a jump and a catch at Climbing 0: 1.5 m reach, 0.15 m in the air, the
  jump's 0.51 m rise) higher - the height a walk round its block, half a storey at a time (a tower two storeys over its
  neighbours, a climb of its own); an alley under the running leap's shortest flight (3.2 m under 4.0); a parapet (0.9 m)
  and a way up's crates (1.2 m steps) under a vault; a ledge along a street front at 2.6 m (a wall run's reach at
  Climbing 0) and balconies over it; a bridge from a flat roof to a flat roof within a step across a street too wide to
  leap; every pitch a top the hands keep (under 50 degrees); a kerb under a step. The collider is the model's own mesh:
  every face drawn is solid (scenes/pixelBuild.js files every placed model the model door calls solid). FOUND AT THE PIN:
  the ring's north and west runs were laid in the wrong order (`.reverse()` on a run already laid from its own corner
  back) - twenty breaks of two half storeys in 577 neighbours sampled; none now.
- **The walls' pictures** (`world/imperialArt.js`, CAPITAL_ART 21-27): cut stone, brick, half-timbering, ochre stucco and
  white lime a storey each, and a shopfront and an arcade for the ground floor - each vanilla's own 64 x 128 wall
  (TESA-LORE's measure: 1.6 by 3.2 m at 40 texels a metre), a window a bay (BAY 1.6 m), laid a storey down from the
  eave so a window sits where a window is; painted by the capitals' own kit (a material's ramp through the ordered
  dither), each inside the freeware's band (16-84 colours, 5.4-18.4 from texel to texel, a spread of 11.3-41.6) and
  tiling without a seam. Drawn right side up and never cut since BLD (below).
- **The sewers, as a law and its data** (`world/imperialSewers.js`): a main under each avenue and radial from its head
  to the city wall (its invert 5 m down at Green Emperor Way, falling 1 in 500 outward), its culvert on under the isle to
  the lake (eighteen outfalls, each its mouth on the shore); the ring roads' and Green Emperor Way's mains in runs from
  between two radials to each (1 in 1000, into the radial 0.6 m over its invert); branches under the districts' lanes and
  wider (never an alley), 2.6 m down, each to its nearest main; a manhole every 60 m on a main with a grate at each kerb,
  and one every 40 m on a branch - the covers in the cells' models. No tunnel stands yet: a later slice walks them.
- **Daggerfall's arena in the Arena District** (`11-Multiplayer/Arena.md` IC-GRAND): TESA11's Colosseum of the port's
  own is gone - its model (910205), its builder, its ground law and its gate; the Arena District's heart cell lays
  Kamer's ARENADAG.RMB (`world/arena/arenaCity.js` ARENA_BLOCK, the same port block Daggerfall's is - index 900100, no
  copy), its colosseum, props, lights, gate people and its 43600 stair, the undercroft's door there too
  (`standsArena`). Daggerfall's own arena stands as it did.
- **Near and far** (`world/imperialBlocks.js`, `world/tamrielCapitals.js` capitalBuildView, `scenes/tamrielSweepsHost.js`
  sweepCapitalLod): a slice within NEAR_RING (1) of the player's pixel is built near - its own blocks with their fabric
  models, Daggerfall's blocks, its walkers, yards and ports - a near one kept near one pixel further (NEAR_SLACK); the
  rest far - every cell but the lake's, the open shore's and the arena's its far block (the ground's tile and the lawns'
  trees, nothing closed) and its carrier a skyline model (its fabric's blocks as masses, drawn, no collider), no building,
  no dungeon, no walker. The index's location is always the near one (its buildings, quests and map). The sweep walks
  only the built pixels and only when the player's pixel or the built set moves: a slice coming near built again at the
  queue's head, one going far at its tail.
- **The families** (`formats/worldData/worldDataReplacement.js` registerPortBlockFamily, `world/customModels.js`
  registerCustomModelFamily): forty thousand cells register no block up front - a block is made on the world-data door
  when first read under its fixed index (own, far, lake: 2,060,000 / 2,100,000 / 2,200,000 plus the cell - past the walled towns' blocks; its models from 7,000,000, past the town walls' and the towns' fabric's) and kept an
  LRU (IMPERIAL_KEEP: 1024 blocks, 768 fabric models, 192 skylines, 48 slices' footprints); a long wall's part is built
  of its runs near its slice alone (`imperialPartBuild`: the city wall is 43 km round, 179k triangles whole).
- **The city from afar** (`world/imperialImpostor.js` imperialLandmarkMesh, `scenes/capitalSkyline.js`; stream B's
  FAR-LANDMARK hook, `render/farLandmarks.js` and `06-Systems/Travel-View.md`): from the city wall the tower is 8.4 pixels
  off - past the stream (its land view a few pixels each way) and the world's 6 km far plane. The far ring draws a
  silhouette a pixel where the stream has built none, in its own painter's order, light and haze; the city hands it one a
  slice - the landmarks whose middles stand in it (the tower to its spire, the walls and their towers, the temple, the
  compounds, the bridge) and its streets as a few masses (each cell keyed by its neighbourhood's walls, roof and height a
  storey at a time - a park's groves a 2 x 2 of cells one in two - the cells of a key merged into rectangles, a box each:
  six on the median slice, seventeen at the most). 259 of the 625 slices stand something (the lake and the open shore
  none), 76 triangles on the median, 19.4k in all; each stood at the city's ground - the ring's at the centre pixel
  (FarRingRenderer `groundAt`, the ring's own grid), as the stream flattens every slice to the centre's - its feet (every
  corner at its ground) down to the ring's lowest round its pixel, never above the city's (AUDIT RELEASE R1-4, 2026-10-26:
  it stood each slice on the ring's ground at its own pixel, 100 to 140 m on the freeware against the centre's 140 m, so a
  slice rose up to 40 m as the stream built it). Off the grid the centre's ground is the ring's at the city's slice on it
  nearest the centre, and every slice is stood again once the centre is on it. Handed in while the traveller is within SKYLINE_REACH (the ring's 48 pixels and the
  span's half) of the centre pixel, a 3 ms budget a frame and the nearest first, each made once; let go out of reach, on
  another ring or when the ring disposed them; a slice off the ring's grid waits for it to move. Enhanced skin alone (the
  ring's own lane). AT THE MERGE OF THE STREAMS' HEAD (2026-10-26) this replaced IC-GRAND's own impostor pass on the ring
  (`render/ringImpostors.js`, 61k quads in a counting sort, retired): one hook for every far silhouette, stream B's.

Measured in node on this machine (four cores shared with five other streams, load 17-30 - the times are relative): the
plan a slice 0.3-17 ms when first asked (all 625: 0.7-0.8 s; TS5's whole 56 x 56 plan at load was 100-125 ms); an own
block 40-480 ms, its slice's carrier (its footprint and its markers) 0.4-1.1 s (1.1-1.5 s before the markers' search
was made lazy); a far block 1-3 ms; a cell's fabric model 27 ms on the mean (the worst 140-250 ms), a slice's 57-64
cells 1.3-1.7 s and 86-112k triangles; a slice's skyline 0.2-0.5 s, 3.5-7k triangles; the far landmarks' meshes 0.23-0.29 s
for all 625 (the slowest slice 14-16 ms, under the sweep's 3 ms budget a frame mostly two or three a frame); the
pictures 0.24-0.29 s once.

SEEN WITHOUT A BROWSER (2026-10-26): the browser on this machine shared a 14 GB memory cgroup with the other streams'
browsers and tests (96 kills logged; the probe's renderer was taken twice in Daggerfall's boot), so the city's own meshes
were first looked at through a software rasterizer of the scratch's (perspective, a z-buffer, the port's own pictures
sampled, a sun): each near cell's fabric model, the slices' skylines and the landmarks' parts past them, and past those
the far landmarks (imperialLandmarkMesh) - Daggerfall's own blocks undrawn, their cells dark lots. Seen: the Market's
dense ochre, brick and white blocks under terracotta, arcades and shopfronts down its streets, flat roofs with parapets
and gables a half storey apart; the Elven Gardens' white and stone ranges under blue slate round green garden courts and
their garden walls; the Temple District's long stone blocks on its axis; Talos Plaza's cut-stone ranges; the Arena
District's rings and spokes; the Arboretum's lawns, paths, statues and villas; the Waterfront's warehouses in rows to the
quay, its piers and its light out into Lake Rumare; the tower over the Palace District's lawns and tombs; from the city
wall the tower at the avenue's end, drawn by the far landmarks; and from 13.5 km across the lake the city a low band on
the water with the tower over it. The fabric's built share of a district's own ground (every third cell): the Market 46%,
the Waterfront 49%, the Arena District 42%, the Elven Gardens and Talos Plaza 40%, the Temple District 37%, the Arboretum
25% (a park); kept clear by the roads, walls and landmarks 6-11% - the rest its streets, courts, yards and squares.

SEEN IN THE GAME (`tools/imperialCityProbe.mjs`: headless SwiftShader at 800 x 450, the land view one pixel, this machine
at load 10-30 - its times only relative): Daggerfall's own arena stands in its city as it did (Kamer's colosseum on cell
(4, 3)), before the streams' merge and after it; the jump to the city's centre pixel built its nine near slices and went
idle in 214-282 s; the page's heap there 1.45 GB before the merge and 2.6 GB after it (the merged streams' layers with
it - not attributed); the tower's top seen from 1.4 km over it, the Palace District's lawns round it. On the streams' head
without IC-GRAND (TS5's city at seven pixels, every block of it registered up front) the same jump was not idle in 900 s.
NOT SEEN in the game: a district's streets and roofs at street level, the city's arena, the far landmarks - a district's
nine near slices were not built within the probe's 900 s here (before the merge and after it), and three runs lost their
renderer to the shared memory. After the merge the first frame looking down over the centre held 88 s of script in the
frame (4 s of frame, 77 ms of script before it): the far landmarks' 625 meshes take 374 ms in the page and the sweep makes
them 3 ms a frame, so it is not their making - FOUND (IC-GRAND's perf pass, below): the living world's trips.

IC-GRAND'S PERF PASS (2026-10-26, the coordinator: *"Your two open performance problems are not acceptable to ship for a
20 km city ... (1) THE 88 s FRAME ... find the cause with a CPU profile in the running game ... (2) A DISTRICT'S NINE NEAR
SLICES NEVER FINISHED within 900 s ... make arrival and crossing workable"*). Measured with Chrome's own sampler over CDP
in the running game (`tools/imperialCityProbe.mjs` PROFILE; its summaries a scratch's), the machine shared as above:
- **THE 88 s FRAME WAS THE LIVING WORLD** (stream I's `scenes/livingWorld/livingIndex.js`, its trips
  `systems/livingWorld/trips.js`). Every place of a populated type is a town of the living world, and every town within
  TRIP_REACH_PX (18) of a town is among its visitors' sources: the Imperial City's 625 slices were each a place of the
  capital's type (each its own location - the slice law), so 625 cities of 64 blocks stood within each other's trip
  reach, and the frame that first asked the trips over the centre walked visitorsOf -> townTrips -> ownTrip ->
  roadChoices for each of them - 52.4 s of the profiled frame's script (88 s in the coordinator's run), 51.6 s of the
  jump's 75 s of script. Ruled out by the same profile: the far landmarks (0.37 s for all 625, a 3 ms budget a frame),
  stream H's town fabric, B's mid ring, far field and pixel fade, G's landforms and rivers, J's zone mask and F's curved
  roads (none among the jump's forty heaviest stacks, none in the frame: the frame's 50.2 s under framePopulation -> the living towns' trips). The fix where it lives, minimal (`world/tamrielCapitals.js`
  capitalSliceAside; livingIndex.js `townOf` - one line of stream I's): a family capital's slice but its centre is a part
  of its city and no town of its own; the centre's place is the Imperial City's one town. AT THE MERGE into the TESA branch
  (2026-10-26) stream I's WW7-11 had already made every capital one town (`scenes/livingWorld/livingIndex.js` capitalStreet:
  no square, area or town's list names a street, a street sends no traveller, a street's own record stands for a reader
  on it - the soundscape's and the wagon warden's townAt), so this line and capitalSliceAside retired for WW7-11's law
  (`test/world/icgrand_living.test.js` PIN MOVED). AFTER: the same frame 118 ms of
  script (its 2.9 s the SwiftShader frame's), the trips 0.09 s of it; the jump's trips 0.7 s; the page's heap there
  1.46 GB.
- **THE ID RUNS** (FOUND here): the city's own blocks stood at 2,000,000 and its fabric's and skylines' models at
  3,000,000 and 3,100,000 - inside TS4's walled towns' block indices (1,000,000 plus twenty bits of a map id) and their
  walls' model ids (3,000,000 plus the same). Moved past them (2,060,000; 7,000,000 and 7,100,000) and pinned apart.
- **A NEAR SLICE, TIMED IN THE GAME WITH ITS FRAME HELD** (the probe's BUILDS: `scenes/shared.js` holdFrame, so
  SwiftShader's frame is out of it and an animation frame comes at the display's pace; the pump's own build of the
  slice's pixel, `window.__pixelBuild`): BEFORE - a Market slice 7.5 s (206 frames; 103k triangles of fabric), its east
  neighbour 4.0 s (131k), the Arena District's 7.0 s (86k), the Elven Gardens' 4.7 s (68k), the Temple District's 4.1 s
  (68k), a Palace District slice 1.9 s; the worst task 0.9-1.8 s in every one (the 99th percentile frame 73-682 ms); the
  heap 1.47 GB rising to 1.95 GB over the six. The profile: the city's own blocks made on the world-data door 5.3 s of
  the builds' 20 s of script (imperialBlockJson - each block's 4,096 closed cells asked of the fabric), the fabric's
  models 1.5 s, the model boxes the merchant yards ask of them 1.5 s more, and setLocationTiles reading a slice's
  sixty-four blocks in ONE task - the 1-1.8 s frame. So the 900 s was two things: SwiftShader's seconds a frame times a
  build that lends each frame its 3-6 ms (a slice is a couple of hundred breaths), and on any machine a slice of seconds
  of the page's thread with a second-long frame in it.
- **OFF THE PAGE'S THREAD** (`world/imperialPrebuild.js`, `world/imperialPrebuildWorker.js`,
  `world/imperialPrebuildClient.js`, `scenes/capitalPrebuild.js`): the city's blocks and its fabric's models are pure
  work of their rows and columns, so a worker of the city's own makes them for the slices the player is coming near -
  told by the capitals' sweep on the frame when the player's pixel moves (within NEAR_RING of it near, the player's own
  first; the ring past them far: their far blocks and skylines), in the order the pixel's build asks them (blocks, then
  models), each handed back as made (its buffers moved). The world-data door and the models' family ask it first
  (`world/capitalModels.js`): a piece it made is taken once - the same bytes as the door's own, pinned
  (IC-FOOTPRINT-OFF-THREAD, below: the landmarks' footprint laid there, the slices' parts made there); a piece it has not
  made yet is made on the page as before and the worker told to skip
  it. No worker (node, a factory that throws, a worker that dies): every piece the page's, as it always was. Let go out of
  the city's reach. And the pixel's build reads a family capital's slice's blocks a breath at a time before
  setLocationTiles reads them all (`scenes/pixelBuild.js`, two lines of the host's module). AFTER: the page's own share of a near slice's city work, timed in node with the worker's pieces held as the page holds them
(`ictake`, a scratch's; the machine at load 30-38 - every number about five times this machine's quiet one): a Market
slice's 59 blocks and 59 models 7.5 s made on the page, 0.7 s taken (a block's median 67 ms -> 0.3 ms); its east
neighbour 7.7 s -> 1.0 s; the Arena District's 5.9 s -> 14 ms; the Elven Gardens' 7.2 s -> 33 ms; the Temple
District's 4.1 s -> 0.39 s; a Palace District slice 4.0 s -> 1.8 s. What is left in it is each slice's first block's
landmarks' footprint (capitalFootprint over its and its neighbours' parts, their first build with it): 0.03-0.43 s a
slice at load 5 (the centre slice the most: the tower's 7.7k triangles and the palace's 15.6k), 0.47-1.6 s at load 38 -
the worst unit of the city's own left on the page. The rest of a slice's build is the stream's own (its uploads, its
colliders, its yards' and walkers' places - about 2 s of the page's thread a slice in the profile), a breath at a time.
The worker's own heap over the jump's list (the centre and two rings, 2,192 pieces): 61 MB of modules and 47 MB of its
fabric's caches; what it hands the page, 22 MB of blocks held until taken.

IC-FOOTPRINT-OFF-THREAD (2026-10-26, the release's second pass - the follow-up named below, done): the worker builds the
landmarks on a model door of its own (`installCapitals` in the worker, no picture) and makes each slice's landmarks'
parts (`capitalModels.js:"export function imperialPartModel(id) {"`, first of a slice's models, near or far) and lays the
landmarks' footprint on the blocks it makes (`capitalModels.js:"export function imperialSliceFootprint(s) {"`, moved out
of installImperialFamilies so both threads lay it alike); the page takes a block as it comes and a part off the worker
before its model door builds one. A block the page makes itself lays the footprint as before. Measured in node at load
28 (the cost the page no longer pays, on a slice's first block): the centre's footprint 1.38 s (its three parts and its
neighbours' - the tower, the palace, the gardens), a Palace District slice's 0.27-0.52 s, a Market slice's 0.12 s; the
worker's whole centre near slice (131 pieces) 2.1 s on its own thread. Pinned in `test/world/icgrand_prebuild.test.js`
(PIN MOVED: the footprint was laid on the page, `imperialBlockFootprint`, retired with its three mutants);
`tools/mutants/icgrand.json` IC-FOOTPRINT-* (5).

THE FABRIC'S HOMES AND A TOWN OF QUARTERS (2026-10-26, the owner walking the city: "Seems like NPCs arent navigating
the entirety of the city"; "No band aids for any of this"). The living town makes its people from its slice's buildings
(`systems/livingWorld/census.js` townCensus: households from its houses, trades from its shops, its taverns' keepers) and
walks them between their doors over the one street net most of its doors open onto (`places.js` doorsNet) - and the
city's own blocks carried no building (the fabric's facades have no door): 425 of the 625 slices stood nobody but the
watch and its travellers, the 200 with Daggerfall's blocks people only about those blocks' doors. Two causes, both fixed:
- **The fabric's homes** (`src/world/imperialHomes.js:"export function fabricHomesIn(s) {"`): each near slice's fabric hands
  its living town one plot with a street front in HOMES_EVERY (16; 24 to 160 a slice - a district its density by its
  buildings), picked off the plot's own key (the same people on every client), each a house, a shop (one in five, its
  kind off its key) or a tavern (one in twelve), with its door on the widest of its street fronts whose ground before it
  is open (`src/world/imperialHomes.js:"export function doorOf(p) {"` - the fabric's own law and the landmarks', as the walkers' grid
  reads them) and inside the slice's own grid. Keyed by the plot's own key (past Daggerfall's keys, FABRIC_HOME_KEY_MIN)
  within the slice's map id: the BLD stream gives the same buildings building records and doors keyed by the same plot
  key, and where it does the census takes its records - `cityHomesOf` is the one door the swap goes through
  (`scenes/pixelBuild.js` hands them to the slice's LivingTown beside Daggerfall's blocks' buildings and doors).
- **A town of quarters** (`systems/livingWorld/places.js`, stream I's module, the coordinator's word): a slice is cut from
  the city at its pixel's lines, so it holds pieces of several of the city's street nets - a district wall whose gate
  stands in the next slice splits it, and the one net left the other side's streets empty. A capital's slice
  (`livingTown.js`: its town's map id a capital's) walks every component QUARTER_MIN (3) of its buildings open onto, each
  a QUARTER: the town's places over its own street alone (its square, corners, shops, exits), its people its own
  households (`src/systems/livingWorld/census.js:"export function quarterCensus(town, buildings, opens) {"` - the town's own quarter's as
  townCensus mints them, each other quarter's on slots of their own), and every one's day planned over its home's
  quarter (`livingTown.js` `_placesFor`), so every walk has its way. A Bay town is one town on one net, as the field's
  law keeps it (no quarters asked).
Measured over 40 slices (their own blocks' grids, Daggerfall's cells shut): 1,706 homes; on the one net 1,427 (84%), on
the quarters 1,493 (88%) - and with the doors on open ground (doorOf), over ten of them 841 of 907 (93%); a Palace
District slice a wall splits (341) walked 109 homes' doors on one net and 142 on its two quarters. The rest stand off
any street (a court's pocket, a stair's foot): DFU's law for a doorless house - its people at home. Pinned in
`test/world/icgrand_living.test.js` (THE FABRIC'S HOMES, A TOWN OF QUARTERS - a real LivingTown over a slice's own
grid: every quarter its people, every walk of their day within one street component); `tools/mutants/icgrand_people.json`
(12).

IN THE GAME AFTER: not measured today - the shared machine's memory cgroup took the probe's browser in its boot or its jump on five of the six runs after the before one (the sixth stopped by its own time limit, still booting) (the kernel's OOM killer, the renderer at 3.6-5.4 GB among the other streams' browsers and tests, load 25-38); the in-game before above stands, the after is node's (IC-PROBE-AFTER below). The in-game shots of the streets, the roofs, the Palace District, the city's arena and the far landmarks at a clear noon with the boot's pages put away (the probe's SHOTS: each slice built with the frame held, then shot) were not taken for the same reason; the city was seen in the scratch's rasterizer instead (its palace, gardens, tombs, gatehouses, the new tower from 3.6 km and from its foot, the courts, the squares' fountains and the Arboretum's orchards).

OPEN - THE NAMED FOLLOW-UPS (IC-GRAND, at the release of 2026-10-26; none half-done in the code):
- ~~IC-FOOTPRINT-OFF-THREAD~~: DONE the same day (the paragraph above).
- **IC-STREAM-SHARE**: the stream's own share of a near slice - its uploads, its colliders over ~100k triangles of
  fabric, the yards' model boxes - about 2 s of the page's thread a slice, a breath at a time; a slice's fabric merged
  into fewer, larger models would cut the colliders' and the uploads' units.
- **IC-PROBE-AFTER**: the probe's BUILDS run with the worker standing, on a machine of its own - here the shared memory
  cgroup took the browser (the probe's and the other streams') on every run but the before one this afternoon.
- **IC-TOWER-LOD**: the tower's 7.7k triangles and the palace's 15.6k stand whole in the centre slice; past the stream they
  are the far landmark's few prisms.
- **IC-PALACE-PATHS** (a later content release, the owner's call 2026-10-26): the gardens' paths and walks are laid at
  the ground's own resolution (6.4 m tiles), stepped on a diagonal - a path model of its own would smooth them.
- **IC-SQUARES** (a later content release): the Market's squares stand their fountain alone - stalls, trees and benches
  round it are owed.

TESA11, IC-RING and TS5 read on: the pixel law the same (the nearest centre all of whose 625 pixels are the Imperial
Province's land, on the trace's isle inside Lake Rumare's ring); the flatten the same (every slice to the centre's
ground); the parts the same law at 1,024 a slot (217 parts of the fourteen landmarks - the palace and its gardens with them).

### BLD - the fabric's buildings as the GL draws them: right side up, no window cut (2026-10-26)

The owner (Mac, 2026-10-26, having walked the city): *"The new building layouts in the city look like some windows are
upside down, clip into the ground and into the roofs, no doors/interiors, and no lighting sources like the original
layouts"*; and on all of the city's work: *"No band aids for any of this."* This record covers the windows and the
clipping (`world/imperialFabricModels.js`, `world/imperialArt.js` FACADE_PLAIN; pinned by `test/world/icbld_fabric.test.js`,
mutants `tools/mutants/icbld.json`). The doors, the interiors and the lights follow in their own records.

- **Upside down: every face of the fabric, not some.** A picture reaches the GL bottom-up. The stand-in door converts
  each built picture with toColor32 (`formats/color32Order.js`: row 0 of the buffer is the picture's BOTTOM row), the
  upload leaves it unflipped, and Daggerfall's own models lay v = -(texel row / height) (`world/meshReader.js`), so v
  RISES up a wall (measured on the freeware's ARCH3D: 46,324 of the 46,856 wall triangles of 434 house models). The fabric had laid v rising DOWN the wall (a top-down raster's rows). So every wall, shopfront,
  arcade, gable and roof of it drew upside down, on every facing in every district: sills over windows, the arcades'
  arches on their heads, the shopfronts' stall boards at their tops. The scratch rasterizer that checked IC-GRAND read
  the raw top-down picture at v and showed them right - Home.md's Process rule (an orientation check compares what is
  drawn against the raw art) caught too late. Now v falls down the wall from a picture's top row (wallFace, the slopes,
  the well's roof). The pin samples the GL's own path: the color32 order, the row at a hand under an arcade's top and
  a hand over the street.
- **Clipping: the picture law, not the ground or the roofs.** Measured on 5,230 buildings in 147 cells: no two footprints
  overlap (no roof runs into a neighbour's), and the city's ground is flattened (every slice to the centre's). What
  clipped:
  - half the eaves stand an odd half storey up, and the storeys were counted down from the eave to the ground, so the
    lowest windows of half the city stood half under the street, and over a shopfront a half storey cut a window against
    its fascia;
  - every gable (2,471, each rising more than 1.4 m) wore the wall's picture, its windows cut by the roof's slopes;
  - 9,687 of the 14,639 inner walls are party walls against a neighbour, their windows under the neighbour's roof;
  - a wall was no whole number of bays, so the last window was cut at every corner.
  Now a wall's storeys are whole, counted down from its eave, and a whole number of bays along it (wholeBay). Whatever is
  less than a storey - the plinth at the foot, the mezzanine over a shopfront, every gable (in half-storey bands from the
  eave up) and every party wall (partyEdges: the ground a hand out from an inner edge under another building) - is laid
  in the picture's PLAIN ROWS (FACADE_PLAIN: from the sill's shadow, row 92, through the wrap to the cut stone's lintel
  cap, 57 rows - no glass, shutter, frame, sill or lintel in any of the five walls; the half-timbering's framing
  stands in it). Every wall's foot is half a metre under the street. A balcony stands on a floor line (BALCONY_FLOORS:
  4.8 m over an odd eave's mezzanine, 6.4 m over an even one's second storey), never across a window. The far masses
  (the skylines) take the same law.
- **Seen**: the scratch's GL-faithful rasterizer (the pictures in color32 order, REPEAT, backfaces culled), before and
  after, of an arcade front, a timber street and the gables and party walls over a block.
- **Found beside it, its own record below**: `world/capitalModels.js` vanillaTexels lays every capital landmark's
  pictures (and URBANIZER's yard and dead-end walls) with the same inverted sign - masonry lit from below.

## MAP-WHOLE - the map past the Bay whole from its first frames (2026-10-26)

The owner: *"The held map still struggles to load everything at once"*.

**Why it came in a piece at a time** (the kept tiles above, read with the freeware's continent):
- **The continent's dots.** Out on the continent (`view.scale` under DOTS_BELOW) each road's and track's pixel past the
  Bay is a dot of the far pen's width, painted as a canvas path of rects - 302,205 in one tile at the contain view. M10
  sliced the path into PAST_BAY_STEP steps so no frame froze, but the canvas's rasteriser still walks every rect as a
  sub-path: 300,000 dots took 370 to 1,500 ms a tile on a CPU canvas (measured here, a shared machine), so a view of
  two dozen tiles under an 8 ms budget a frame filled one tile at a time for seconds.
- **The holes.** A tile still owed shows the nearest level's within STAND_IN (two doublings); a first open, a jump past
  two doublings or a view over ground never painted had nothing kept to show, and showed the paper - the sheet "loading
  in" tile by tile.

**The fixes:**
- **The dots rasterised by hand** (`ui/inkRaster.js`, `ui/tamrielInk.js` rasterPass). A dots pass is one solid pen laid
  down whole at its alpha (layDown) - a union of squares, each pixel's ink its covered share - so it is stamped into a
  COVERAGE MASK (RASTER_SS, four by four samples a device pixel, a sample inked when its centre is inside a square: the
  canvas's own non-zero union, to the sample), summed a 32-bit word a row (`coveragePixels`), put on the tile's scratch
  once as the pen's colour under that alpha and laid down as before. The same 300,000 dots in 28 ms; the alpha within
  4.4 of 255 of the canvas's on the inked pixels (mean). A step of the raster is eight times PAST_BAY_STEP dots
  (RASTER_STEP_SHARE). The job's mask is the tiles' own (a megabyte, pooled - COV_SPARE), and one RGBA buffer serves
  every job. A canvas that takes no pixels (no putImageData, no ImageData) paints its path of rects as before. The far
  band's runs stay the canvas's strokes: a capsule rasterised a sample at a time measured three times slower.
- **THE BASE** (`ui/tamrielTiles.js` BASE_SCALE, `ui/tamrielInk.js` baseOf). The whole continent's frame painted at one
  coarse level (a quarter of a paper pixel a Bay pixel: the freeware's 6,000-pixel frame 1,500 device pixels, 24 tiles,
  6 MB), out on the continent under the view's own filters and hues, BEFORE any of the view's tiles - and the stand-in of
  last resort under every tile owed, at any zoom and any key (`standBase`). So the sheet past the Bay is never paper:
  from the base's first frames a tile owed shows the continent's roads and places, coarse, until its own lands. Its
  words are read again only when the roads' installs or the places' adds move (`base.version`), never counted against
  TILES_KEPT, and let go with the window. A frame that settles (`settling`: budget 0) paints none of it, as it paints
  none of the view's.
- **The probe's read** (`stats()`, `__heldMapLoad` - behind the shot gate, AUDIT ANTICHEAT A2): each draw's tiles - wanted, painted, stood in for and HOLES (owed
  with nothing to show) - and the window's paint's milliseconds; `tools/heldMapLoadProbe.mjs` sets a list of views (the
  continent, far, mid, near, home and a wheel's zoom out and in) in the real game and counts the frames to COMPLETE (the
  first with nothing owed) and the holes on the way.

Proof: `test/ui/mapwhole.test.js` (4: the mask - its edge rule, the union, the share, the word sum; the dots rasterised,
one put a pass at the pen's alpha, a canvas with no pixels as before; the base - painted first, the stand-in under every
tile owed, its words by its version, kept apart and let go on close, the window's base; a job's mask pooled),
`tools/mutants/mapwhole.json` (24, all dead). PIN MOVED: `test/tesa15_mapfidelity.test.js` (the window's tiles' draw
hands the base). The four hosts: the held map is the world host's alone (`ui/heldMap.js`); `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` open no map past the Bay.

## MAP-WATERS - Cyrodiil's rivers and its lakes' smooth shores on the held map (2026-10-26)

The coordinator, after stream G's terrain: *"The held map should draw G's Cyrodiil rivers and smoothed lake shores:
src/world/tamriel/tamrielWaters.js exports tamrielWaters() (river lines with widths, lake outlines) ... ink them with the
map's own pens (rivers as lines scaled by width, lakes by outline), cached like the rest"*.

- **The map's copy of the law** (`world/tamriel/watersInk.js`). G's law compiles in some 0.6-0.7 s on this machine, too
  long for the main thread at a map's open, so the terrain worker compiles it: the client posts `{ t: 'waters' }` after
  the trace (`setTamriel`), and the worker answers `watersInk` - each river's points and widths and each lake's ring, in
  Float32, transferred (`packWatersInk`). The client installs it (`setWatersInk`), each install a new version; with no
  worker this thread compiles its own.
- **Inked a tile at a time, under the roads** (`ui/tamrielInk.js` paintWaters, the first part of a tile's paint past the
  Bay). A river is drawn as RUNS of one width (`riverRuns`): its metres at the view's scale in half-pixel steps
  (RIVER_PEN: a 0.9 hairline at the least, 14 at the most), each run's last point the next one's first so the line never
  breaks, thinned to a third of a paper pixel (a river's points stand some 100 m apart: forty to a paper pixel out on
  the continent), made once a scale. Each run's wash first (`PEN.wash`, twice its width and one), then its line at its
  width (`PEN.line`) - the shore's own hand. A lake's ring is drawn as the coast is (its wash, then a 1.3 line). A river or
  lake whose box the view does not reach is not walked at all (`watersInView`).
- **Cached like the rest.** The tiles' word (`pastBayStamp`) and the base's version carry `watersInkVersion()`: an install
  paints every kept tile again, and nothing else does.
- **The lakes at the ground's own shore** (`lakeShoreChains` - SUPERSEDED by SMOOTH-LAND, `03-World/Tamriel.md`: every
  coast past the Bay, a lake's among them, is the land's one smooth law's line, drawn by `tracedChains`; the lake ink and
  LAKE_INK_SS are gone). The trace's coast chains drew Cyrodiil's lakes as the picture's staircase. A coast chain most of
  whose points (60%) lay beside a lake's picture pixel (G's `lakeShores`) was dropped, and each lake traced again at
  LAKE_INK_SS (4) samples a picture pixel through G's `lakeShoreAt` - the shore the stream itself stood - contoured and
  smoothed as the coast was. Once a trace, with the rest of the static ink.

Proof: `test/ui/mapwaters.test.js` (6: the store and the packing; a river's runs - the scale, the step, the floor, the
shared point, the thinning; the paint - the wash under the line at its width, the lake in the coast's hand, the cull, the
word; a lake's shore the land's smooth law's on a synthetic trace (PIN MOVED, SMOOTH-LAND); the middle ring's water and the client's bands - `06-Systems/Travel-View.md`
BREATHTAKER2 ON THE HORIZON; with ARENA2 the Lower Niben on the freeware's trace), `tools/mutants/mapwaters.json` (19,
all dead; SMOOTH-LAND retired the four on the lake ink - 15). PIN MOVED: `test/world/tamriel3.test.js` (the waters' ask follows the trace to the worker),
`test/world/terrain/terrainworker.test.js` (the worker's imports: `../tamriel/watersInk.js`). Not seen in a running
frame here (every browser probe of the world page on this shared machine was killed for memory): pinned by recorded
strokes. Daggerfall Unity's map has no land past the Bay to draw a river on: Port-Ledger row TESA13.

## Pins

`test/world/audittesa2c_capitals.test.js` (16, AUDIT TESA II lane C): the rim (eleven tiles, 70.4 m, the span's outer
sides alone - the Imperial City's seams none; every own block's, garden's and ring lake's rim tiles no ground, closed,
treeless; the rect's capital arm); no landmark vertex in the rim on a side of land, Talos Bridge's west end at its inner
edge down at 0.3 m; a shore capital's every slice flattened to the sea's floor (the kernel's ocean clamp; an inland one
its own ground), Alinor's and Torval's sea slices and their carrier S0; the side law's bytes (spanSideBytes); the
causeways ending within a gate's width of their compound's gates, outside the curtain, the way on through the gate open
in the models' footprint; Falinesti's walkway 2 m clear over its deck at three lanes across it from the ground to the
fourth platform, no hut over a deck's open arc; the Imperial City's closed law against the plain law at every 0.4 m about its tombs, plinths, court,
Bastion and temple; Helstrom's gates onto ground to the plan's edge; every slice's start markers on open ground, off
the rim and the models, the Imperial City's in their own slice and inside the wall, a sea slice's on its quay; Alinor's
and Torval's north gates off their blank backs with a tower either side; no fixed block index in the tree in another's;
no planar quad of any capital model mapped on two planes, a 45-degree wall its normal's; a capital's point its TAMRIEL1
city's, no block multiple written out; the gate walk (the side's pixel, the next out, an islet passed over, none past
GATE_REACH, said once; CAPITAL_GATE_REACH since AUDIT TESA III, where the gate pool's GATE_REACH had the name twice). With ARENA2: every capital's seams to its neighbours and inside 0.00 m, its rect 11..116 on its
outer sides, the shore capitals at 34.0 m with the sea along their water's sides; the gates' lanes clear of Daggerfall's
buildings within 9 m (Solitude's main gate, Alinor's and Torval's north gates, Alinor's bridges' north ends); every
capital a gate the roads reach, each the first such pixel out. Mutants `tools/mutants/audittesa2c.json` (52: 51 dead, 1
recorded equivalent - the points' cache, speed alone). PIN MOVED: `test/tesa10_capitals.test.js` (the pixel law's shore
fixtures on the side law, the ring's lakes), `test/tesa10c_capitals.test.js` (Alinor's and Torval's sixteen rows, their
north gates at `northGate`, the crystal gone), `test/tesa11_imperial.test.js` (Talos Bridge to the rim, an inland
capital's one-pixel flatten), `test/tesalore_capitals.test.js` (the walkway's floor sampled between the turns' ends),
`test/audit_tesa.test.js` (every slice's carrier's markers, `make`, Alinor's north gate, the rim's closed cells and
ground, the ring walk against the side law), `test/tesa14_roads.test.js` (the gate's pixel on open ground, its step into
the span); `tools/mutants/audittesa.json` (9), `tesa10.json` (5), `tesa10c.json` (3), `tesa11.json` (10),
`tesalore.json` (8) and `tesa14.json` (1) re-aimed by content.

`test/tesa15_mapfidelity.test.js` (16, TESA15 and ZOOM-FAST): the layer's tiles (a whole install, an add's own tiles, another layer, the
first add's whole) and their pixels; the roads' ink a tile at a time, kept by its stamp, a rectangle's and its rim's; the
far view's steps, each once, a one-sided one from its end; the paint's word; the regions' places (the bins, the
rectangle, the reset, packed and back; the core's alone, none on a capital's or an Arena place's pixel, a gate's
standing, an Arena dungeon routed round, one order); the worker, the client and the host carrying them, the held pixels
routed round; the terrain client's add; the kept tiles (the level, painted once, the word and the key, a dense sheet, the
budget, the stand-ins, said once, the count, no context); the painter's levels and its glyphs' reach; the window's and the
world's wiring. Mutants `tools/mutants/tesa15.json` (52, all dead). PIN MOVED: `test/tesa13_mapink.test.js` (two tests
retired with the page's own roll, the host's and the window's pins moved), `test/tesa14_roads.test.js`,
`test/world/road/roads.test.js`; `tesa13.json`'s eleven records on the retired roll and the whole-layer ink deleted with them, and
`tesa13.json` (9), `tesa14.json` (3), `map1.json`, `tamriel3.json`, `tesa10.json` and `tesa8.json` (1 each) re-aimed by
content, all judged dead again. Browser: `tools/tesa15MapProbe.mjs`.

`test/tesalore_capitals.test.js` (15, TESA-LORE): the Imperial City's Prison (bearing 45, the north-east pixel named for it
and carrying it, the gate to it open, its causeway stone); its watch towers (on the sectors' bearings, over the wall's
other towers' cones and none between, their feet the city's own); the Arboretum's Nine Divines (eight plinths in their
ring each with its figure, Talos the tallest over the middle, the eight below him; the court paved, closed at its plinths
and open between, treeless, the city's own; installed, carried in its pixel); Solitude's Castle Dour (within 45 m of the
main gate, its corners on the city's own and its district's, its west and north gates open in the model and the walkers'
law, walled between and east, the temple before its north gate on its grounds, the keep's turrets under the Emperor's
Tower) and its Avenues (the college and the Hall of the Dead theirs, the hall beside the terrace, the palace wholly over
the river); Mournhold on Tribunal's plan (the districts by compass, the temple's block on the courtyard, Godsreach's
tavern and library, the Fane, the palace and the plaza on their districts and one way, the stalls the Bazaar's) and its
plaza (grass, paths and court, trees on grass alone and off the court, the plinth closed, two figures, Dagon's axe the
top, Hopesfire raised; the Fane's porch south, the pools closed and their water, the way between open, the braziers;
the palace's two doors); Alinor (no Crystal Tower in its models or CAPITAL_MODELS; its terraces a step in and up,
closed whole, the street round them open; the stair walkable, on its slope, clear above, the terraces beside it; the
palace's door at its head) and its river (a row of water across the city to the sea, the city and the quay its banks;
two bridges bank to bank, the water clear under their arches, walkable; the walls open at the river, walled north of it,
a tower on either bank); Falinesti in its boughs (hide houses on every platform and on every fork's deck, the walkway
from the ground a turn a level, its floor facing up at every sample, its decks walkable); Torval's estate (its beds
mirrored, within its wall, off the palace and the palanquin, closed with the ways between open; its grass, its axis
path; the estate wholly on the palace's own blocks, its gate south, walled elsewhere; the palanquin's dais and canopy;
installed) and its moons (gilt over the palace's dome, its four minarets and both temple domes, the palace's horns off
its axis); Helstrom in the heart-mud (the mud, the paving, the isle, the canal; the Hist grown; its stones on its isle,
closed, their pillars, the way between open; its crown over its trunk); the pictures at vanilla's detail (each 64 x 64;
each but the doors' dark within the freeware's band of colours, texel-to-texel |dL| and spread; each tiling, its wrap no
stronger than its strongest inner joint) and vanilla's texel density (the law on a wall; every face of every installed
model 30.4 to 40 texels a metre). Mutants `tools/mutants/tesalore.json` (64, all dead; the watch towers' own ground rule
survived as the wall band's twin and went; the bridges' flat deck survived a first pin, made the arch's own; the
walkway's top survived a first pin through its underside, made the floor's own; the shingles' wrap shifted survived the
seam pin - their own gaps hide it - and was not kept: tiling there rests on its construction). PIN MOVED: `test/tesa10_capitals.test.js` (Solitude's own blocks' cells, its 19 city
blocks, the college's district, the Hall of the Dead's cell), `test/tesa10c_capitals.test.js` (Mournhold's middle cells,
its districts, its closed ground, its first own block's law, its plaza's ring, statue and porch - the porch's pin made
specific: it passed with the porch turned; Alinor's palace's top on its terraces, the Crystal Tower's pins retired with
it, its closed ground; Torval's palace and temple tops their crescents') and `test/audit_tesa.test.js` (Mournhold's start markers, through A6-1's own
law); `tools/mutants/tesa10.json`'s curtain-gate record and `tesa10c.json`'s five Mournhold records re-aimed (two
renamed, `statue-open` and `fane-porch-turned`) and two of Alinor's, its `crystal-no-tip` deleted with its law, and two of
Torval's (its quay's water, its dome's finial), and `tesa10.json`'s marble, install and turning records after the
pictures and the texel law, all judged dead but the plaza's recorded equivalent;
`test/tesa11_imperial.test.js` (the Prison's bearing, the slices' names, the Arboretum's grass off the court, the city
wall's reach to its watch towers); `tools/mutants/tesa11.json`'s slice-names record re-aimed by content, judged dead.

`test/tesa14_roads.test.js` (18, TESA14): the builder's obstacles and `owns` (a neighbours' edge the first end's, a
bridge either end's, a link its first end's, a spur its node's), nearestWithin the brute force's lists and primEdges a
least tree; the lattice, the regions with land and their order; a region's network in one order, graded as the Bay's,
round the Bay's corner; a seam's edge routed once and whole; a capital's pixels, its gate's step and a roadless gate;
the gates' sides; the roll carried as numbers answering as the host's; the print and the key; the worker, the client
(the cache, the inputs first, a superseded or stopped build, `near`, a dead worker), the terrain client's merge, the host
module and the world's wiring; with ARENA2_PATH a region built the same in two orders with no end in the open, no wet
pixel and none on a capital. Mutants `tools/mutants/tesa14.json` (54, all dead). PIN MOVED: `test/tesa13_mapink.test.js`,
`test/scenes/perfv8.test.js` (frameWeatherDrain), `test/tesa4_roads.test.js` (eight retired), `test/tesa5_join.test.js`, `test/tesa7_country.test.js`,
`test/tesa8_lairs.test.js`, `test/audit_tesa.test.js`; the stale records of `tesa4.json` (29), `tesa5.json` (4),
`tesa7.json` (1) and `tesa8.json` (1) deleted with their laws, and `tesa4.json` (2), `tesa5.json` (4), `tesa7.json` (2),
`tesa8.json` (4), `audittesa.json` (1) and `tesa13.json` (1) re-aimed by content, all judged dead again. Tool:
`tools/tesaRoadsAtlas.mjs`. Browser: `tools/tesa14RoadsProbe.mjs`. PIN MOVED (AUDIT TESA II): the version (3), the
print's WOODS.WLD its real shape and the key's order (R6, R10), and with ARENA2_PATH every hamlet and village on a path,
counted, the capitals' gates and pixels in its inputs (R11 - red on lane R's branch until the beach line's floor: one
hamlet, (139, 590), off a path; green on the merged head); `test/world/tamrielrelief.test.js`'s print line (every cell); re-aimed and dead:
`tesa14.json` (8; TESA14-the-worker-no-places judged by the new file too, as no synthetic roll of tesa14's stands a
place), `tamrielrelief.json` (1); `tesa4.json`'s TESA4-one-end-unstamped and TESA4-the-bay-stamped, which survived on the
audit's base (TESA14 left their drawing to the crossings' runs alone), judged by `test/tesa5_join.test.js` too and dead.

`test/world/audittesa2r_roads.test.js` (12, AUDIT TESA II lane R): the builder a step at a time - drained, the Bay's
network and a region's to the byte, a step a road searched; a region's ground a step every REGION_STEP_ROWS rows; the
worker's steps its message (R8); a gate the neighbouring region routes to, stepped (R7); the crossings' runs held, the
host handing them (R9); the print's every height byte and relief cell, the laws' version in the key, and the laws'
fingerprint recorded under GROUND_ROLL_VERSION (R6 - 2 and its fingerprint since lane G's floor); the cache's hits a budget a task (R3); the workers let go when idle, made again (R4); a
dead worker's region, its replacement, the page's own thread's build with no worker (R8); one print a region, a failed
keep said once (R10); the host's gates walked over its own ground, a gate whose one land neighbour is the city walked
past (R2, lane C's ask); with ARENA2_PATH every capital a road reaches, the build's inputs the roads' host's own (R2 -
red on lane R's branch until lane G's floor: Solitude; green on the merged head). Mutants `tools/mutants/audittesa2r.json`
(36, all dead, judged with ARENA2_PATH on the merged head; the seam's record re-aimed by content to lane G's line). PIN MOVED: `test/tesa14_roads.test.js`'s host source pin (the
walk); `tesa14.json`'s TESA14-a-gate-in-the-water re-aimed to the walk and dead. `test/memoryIdb.mjs`: its delete takes a
key range, its connection a close.

`test/tesa13_mapink.test.js` (13, TESA13): plateauDry's answer spawnPlateauFloor's over the sea, the land, every coast, a furrow and a field about the threshold; the layer's key both ways; the roads walked a ROAD_TILE at a time and meeting
over a tile's edge east-west and north-south, roads and tracks apart; the ink made again when the layer lands, painted in
the Bay's pens under its filters and band; the atlas (a tile rolled once, never on the Bay, the asked pixels alone, the
stamp; the budget's middle-first rolling, owed once; ATLAS_TILES_KEPT, the oldest read let go first); the marks (the
buckets, glyphs, bands, filters, the pixel's centre, the frame; none at far nor on the continent; the hover's nearest
and its words; halos first, each kind's hue); the host's read in `_locationToBuild`'s order and the one roll; the
window's paint, hover, static key and the owed repaint. Mutants `tools/mutants/tesa13.json` (41, all dead). PIN MOVED:
`test/tesa7_country.test.js` and `test/tesa8_lairs.test.js` lift the roll beside the build's ask; `test/ui/tamriel.test.js`'s
hover pin; `test/world/road/roads.test.js`'s four stroke pins (`inkMap.js` strokePaths); re-aimed and dead: `map1.json` (3), `tamriel.json` (1), `tamriel3.json` (1), `tesa10.json` (1), `tesa7.json` (7), `tesa8.json` (5).
Browser: `tools/tesa13MapProbe.mjs` (RETIRED by TESA15 with the page's own roll it watched fill in - grown into `tools/tesa15MapProbe.mjs`).

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
on the live fit - (2069, 658) on the freeware's since IC-RING, (2177, 612) before - one capital a pixel, kept a fit and moved with it) and the pin (Arena's
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
build's order; the capitals' lane a place the port made), `test/world/spawneddungeons.test.js` (the build's window 640 -> 700,
its harness's `_capitalBase`), `test/world/fb0929h_spawnplate.test.js` (its harness's `_capitalBase`); `tools/mutants/tesa2.json`'s
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
`tools/mutants/tesa8.json` (70, all dead). PIN MOVED: `test/world/spawneddungeons.test.js` (the build's window 600 -> 640),
`test/systems/automap/roadc_automap_interior.test.js` (the beacon's read through automapKeyOf, DFU's string for the game's places),
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
(Arena's, else the country's, the Bay its own). Mutants `tools/mutants/tesa7.json` (65, all dead - AUDIT TESA-BIOME P13: TESA7-host-not-deleted had survived until tesa7_country pinned a pixel that stops standing a place). PIN MOVED:
`test/systems/naval/auditcaptsea.test.js`, `test/systems/houses.test.js`, `test/world/housecontainers.test.js` and `test/tesa2_arena.test.js` (the
deed's one reading: nor a country place's), `test/tesa2_arena.test.js` (the build past the Bay: Arena's, else the
country's), `test/world/fb0929h_spawnplate.test.js` and `test/world/spawneddungeons.test.js` (their harnesses lift
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
the list too), `test/systems/comeSailAway/fb0929h_deedport.test.js` (its harness lifts the port test and the nearest-port finder: Arena's
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

`test/tesa4_roads.test.js` (13, TESA4 - five since TESA14 retired the coarse network's eight): the grade (the clone's, a dungeon none); the window (the margin, the extent's
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
`tools/mutants/tesa4.json` (49, all dead; 18 now - TESA14 deleted 29 with the coarse network, and AUDIT TESA II K4 moved the two on the crossings' runs, TESA4-one-end-unstamped and TESA4-the-bay-stamped, to `tesa5.json`: since TESA14 `arenaRoads.js` stampRun is TESA5's joinLayer's alone, `test/tesa4_roads.test.js` no longer reached it and both survived there; against `test/tesa5_join.test.js` both die). PIN MOVED: `test/world/terrain/terrainworker.test.js` (the worker's imports take `arenaRoads.js`),
`test/systems/disc20.test.js` (DISC20-C's window 10200 -> 10400, the entry's `arenaRoadsEpoch` line);
`tools/mutants/verge1.json`'s VERGE1-north-the-row-below re-aimed by content (the row is read on its own line now),
judged dead again.

`test/tesa3_provinces.test.js` (5, TESA3): the province past the Bay (the centre's, none on the Bay's own ground with
land under it or at sea, the authored shape without a trace); the people's banks for all nine (GetNameBank's, the
Imperial arm, none for none); the stranger's draw equal to getRandomFullName's over six seeds and a Nord's -sen; the
host by source (provinceAt's gates, the pin's exception, the loading screen, the Overworld, the new region and its edge,
every name site, the town talk told, the player's region index untouched, the land module free of characters/); with
ARENA2_PATH, Winterhold's pixel Skyrim's, Mournhold's Morrowind's, Daggerfall none. Mutants `tools/mutants/tesa3.json`
(13, all dead). PIN MOVED: `test/systems/audit58_magic.test.js` (the talk's and the stranger's names through nameBankHere and
getRandomFullNameOfBank) and `test/systems/talk/macro6_talk.test.js` (the town talk's %fn/%mn through the province's bank first).

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
`tools/mutants/tesa2.json` (28, all dead). PIN MOVED: `test/ui/tamriel.test.js` (a press beyond the Bay picks an Arena place
the world stands, and nothing else) and `test/systems/naval/auditcaptsea.test.js` (the house rule names an Arena town beside an isle's).
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
PIN MOVED: `test/systems/features.test.js`, `test/systems/org2_options.test.js` and `test/ui/settings/settingsUI.test.js` name the Arena card in
Your files and in the card table. Re-aimed by content, each judged dead again: `tools/mutants/mwa4.json`'s
MWA4-the-card-off-the-head-of-the-files-page (the files row now ends with the Arena card), `tools/mutants/tamriel.json`'s
TAMRIEL1-one-model-a-call and `tools/mutants/tamriel3.json`'s TAMRIEL3-the-ink-never-rebuilds (the ink's cache now asks
one `stale` predicate, the land's version and Arena's).

`test/world/icgrand_fabric.test.js` (7, IC-GRAND): the rooftops laid to the movement's own numbers (the step under the
reach, the alley under the leap, the parapet and the crates under a vault, the ledge in a wall run's reach, the garden
wall caught, the kerb stepped, every pitch a top); the height walk (a building beside a building a step at most, a
tower aside - 577 neighbours in 20 sampled cells); each district its own (seven looks, six frames, fifteen neighbourhoods
and ten frames a district at the least, one heart); the street hierarchy (an alley and a main street in every district
but the park, a lesser street, fronts on main streets); the urban fabric (yards, sheds, dead ends, ways up, bridges and
courts in the sampled cells, the Arboretum's statues, the Elven Gardens' canals, cut stone, brick and half-timbering;
every way up's last step within a vault of its roof's edge, every bridge over a street too wide to leap with a body's
headroom under it); a building clear of what keeps the fabric off, on its own ground, the avenues kept clear; the walls'
pictures at vanilla's 64 x 128 and 40 texels a metre. `test/world/icgrand_sewers.test.js` (3): the mains, their falls,
their culverts to the water and the rings' drops; the covers on their roads at their spacing, none past the wall; the
branches under the streets (never an alley) to a main, their covers in the cell's model. `test/world/icgrand_lod.test.js`
(8): near and far (the ring, the slack); the far view (its blocks, the arena kept, no building, made once, the index
untouched, other capitals as they are); the families (the indices, the door's LRU, the model door's solid and LRU, the
city's installed, a far block closing nothing); every slice's arrivals on its carrier and the rim on the family's blocks
(PIN MOVED here from `test/audit_tesa.test.js` A6-1 and `test/world/audittesa2c_capitals.test.js` C1); the sweep (walked
only when the pixel or the set moves, near at the head, far at the tail); the build's view, its far gates and the
collider's word; the city from afar (PIN MOVED at the merge of the streams' head - the impostor's two pins retired with
it: a landmark a slice, the tower to its spire over the centre pixel's middle, the temple's dome where its pixel's frame
holds it with z north, the masses merged - six boxes a slice on the median - none on the lake); the city on the horizon
(handed one a slice, a budget a frame, the nearest first, on the ring's ground at its pixel, let go out of reach, on
another ring and when the ring disposed them, a slice off the grid waiting for it to move, none on the classic skin; the
sweep wired and the world host's ring handed; the ring's `groundAt` row by row). `test/world/icgrand_arena.test.js` (4): the Colosseum
gone; Daggerfall's arena in the Arena District's heart cell, the same port block, the fabric off it, the district's
avenue and ring road at it; its stair the undercroft's door (`standsArena`); Daggerfall keeps its own (cell (4, 3), the
edit Daggerfall's alone, the gate people's factions recorded). `test/world/icgrand_lod.test.js` also THE FAMILIES APART
(IC-GRAND's perf pass: the own, far and lake blocks' indices past TS4's walled towns', the fabric's and skylines' model ids
past the town walls' and the towns' fabric's). `test/world/icgrand_living.test.js` (1): the Imperial City one town - a
family capital's slice but its centre no town of its own, the centre the town, another capital's slices as they were.
`test/world/icgrand_prebuild.test.js` (5): a slice's pieces in the order its build asks them (the landmarks' parts
first of its models); the worker's pieces the page's to the byte, the landmarks' footprint laid there (a far block
closing nothing), its parts the model door's and taken by it, its models the family's; each
handed over once, the worker told what the page made itself, a new list replacing the last, no worker or a failed one
the page's own work; the door and the family asking it first and the pixel's build reading a slice's blocks a breath at
a time; the sweep telling it the slices coming (the player's own first, near then far), letting it go out of reach, wired
before the city's near and far sweep. `test/world/icgrand_palace.test.js` (6): the palace (its ring round the plaza, a
walk through each gate meeting no face and through a wing a wall, its pavilions standing out past its wings, the plaza
and the start markers clear, its pictures), the gardens' ground (the paths, the walks, the fountains' basins and rounds,
the statues facing their paths, the rows of trees and the lawns' groves), its monuments (each part built of its own),
the tombs on the Way's verge facing it (their doors, their podiums, their walks), the palace wall's gatehouses (a marble
arch, gilt, the passage open) and the district from afar. `test/world/icgrand_fabric.test.js` also COURTS
COURTYARD-SIZED (a wide court's back range inside it with its yards round it, lower than its ring, the garden walls never
through a building, the wells and the squares' fountains closed, the stone yards' trees, the orchards in rows). Mutants
`tools/mutants/icgrand.json` (91: the impostor's six retired with it at the merge, ten for the far landmarks, three for
the living world, two for the ids, fifteen for the worker, seventeen for the Palace District, two for the owner's tower,
eight for the courts).
PINS MOVED (IC-GRAND's Palace District and perf pass): `test/tesa11_imperial.test.js` (the owner's tower: round, 1360 m,
its rotunda, fluted, in tiers ringed by cornices - TESA11-tower-short and IS-a-part-missed re-aimed by content),
`test/tesa10_capitals.test.js` (the centre slice's parts the
tower's, the palace's and the gardens'), `test/world/audittesa2c_capitals.test.js` C5 (each tomb's podium in its own
frame, turned to face the Way - its mutant AUDIT-TESA-II-C5-tombs-band-narrow re-aimed by content),
`test/world/icgrand_lod.test.js` (the capitals' sweep tells the city's worker first, then its near and far sweep and its
skyline); re-aimed by content: IC-GRAND-no-yard and IC-GRAND-no-statue (the block's answer, the park's statue's).
PINS MOVED
(IC-GRAND): `test/tesa11_imperial.test.js` (the plan by its law at 200 x 200, the Palace District, 625 slices, the
pixel law twelve a side, every slice's location and the arena's one, the ground's laws at the new wheel and the
Arboretum's grass the fabric's, the port blocks on the family's door and the parts, the tower to the spec, the walls at
38 m with nine gates and the district walls' three, the Colosseum retired from the landmarks and the install),
`test/world/imperialscale.test.js` (the span 25 and odd, the slices' names along the middle row, column and diagonal, the
centre slice 312, the outskirts fifty pixels), `test/tesa10_capitals.test.js` (the east slice 313, the anchor block
I2r2r from the door, the centre's part the tower's alone, the classic slice 110, the pictures 64 x 128 for the street
walls, the sweep's LOD call stubbed), `test/tesalore_capitals.test.js` (the Prison's slice among its compound's four, the
city wall asked near its probes, the park round the Divines off its avenue and ring road and by the cell's own laws, the
pictures' detail at 64 x 128, a float32 sliver kilometres out not measured), `test/audit_tesa.test.js` (the family's
markers and rim moved to the LOD pins, the plan by its law, the own blocks' law in the location's source),
`test/world/audittesa2c_capitals.test.js` (the plan's width, the family's rim, the closed law without the Colosseum and
with the pool, one slice in seven's markers by their cell's laws, the four slices the city wall crosses on the axes
taking theirs inside it), `test/world/worldWide/ww7_castles.test.js` (the kinds by the slices' plans),
`test/world/arena/arena1_city.test.js` (the door's family name), `test/world/arena/arena1_undercroft.test.js` and
`test/world/audit68_worldjs.test.js` (the stair asks `standsArena`), `test/world/spawneddungeons.test.js` (the build's
ask through capitalBuildView), `test/systems/shipyards1_found.test.js` (no yard nor port on a far slice),
`test/tesa10c_capitals.test.js` (the port blocks without the family's) and `test/world/audittesa2p_world.test.js` (with
ARENA2: the rows past the Bay 631 slices, the Imperial City's 625); and at the merge of the streams' head,
`test/world/breathtaker.test.js` (stream G's CYRODIIL-WATERS: the lake inside the span's own half - every river clear of
the 25 x 25, the ring round it and the lake's 10 km on the freeware's trace), `test/world/urban/urban3_stand.test.js`
(stream H's: the walkers' gate asks the far view first) and the capitals' sweep's sandbox in
`test/tesa10_capitals.test.js` (the skyline's sweep beside the LOD's). The tesa11 slices' pin had lost, at the
migration, its cross-slice seeds check (each slice's buildings named apart from another's in the same cell of their
grids): restored. Re-aimed BY CONTENT (each record's `note` says how; each judged again): `tools/mutants/tesa11.json`
(eighteen - the span, the plan's laws, the slices' names, plans, hash and seeds, the tower, the walls' gates and
lintels, the piers; its four Colosseum records at their successor's laws: the arena's cell kept for its block, read
off its point, the street the fabric leaves round it, the stair to the undercroft wherever its block stands),
`tesalore.json` (three: the Prison's gate, the watch towers built and tall), `imperialscale.json` (three: the open
shore, the garden names' width, and its Colosseum way at the arena's own block), `audittesa2c.json` (C1's piers short
of the rim; C7's markers inside the wall first, in `world/imperialBlocks.js` now), `audittesa.json` (A6-4),
`tesa10.json` (the own blocks laid), `arena1.json` (the port block's door and index beside the families'), `ow5d.json`
(the build's one ask) and `rockclear.json` (the models' collider). Two are RECORDED EQUIVALENT at twenty-five pixels,
measured: TESA11-shore-a-house (the whole plan with and without the guard: 0 of 40,000 cells differ - no cell holding a
shore is a trade's) and TESA11-no-signature (every district draws its signature off the hash elsewhere too).
