# Beautiful Villages and Beautiful Cities (WD3, 2026-10-01)

carademono's two town mods, ported 1:1: **Beautiful Villages of Daggerfall
1.4.2** (7,317 villages, hamlets, farms, manors and temples, and every
roadside tavern through its blocks) and **Beautiful Cities of Daggerfall
0.5.0** (the 410 cities). Mac handed both over on 2026-10-01: "These are
the next mods I'd like to implement (We have permission) and ensure this
doesn't conflict or regress anything (For example housing customization).
For anything missing I need you to curate, like textures. I want you to be
as detailed as possible and take your time".

Provenance and what is carried: `vendor/beautiful-villages/README.md`,
`vendor/beautiful-cities/README.md`, `01-Overview/Mod-Registry.md`. The
format they ship in - one pack of the authors' edits over the player's own
`MAPS.BSA` and `BLOCKS.BSA` - is WD3, `02-Formats/World-Data-Patches.md`.
The audit (AUDIT WD3, 2026-10-02 - the IDs the code and the tests cite) is
`01-Overview/Audit-WD3.md`.

## What the player sees

| | Beautiful Villages | Beautiful Cities |
|---|---|---|
| locations | 7,317: villages 1,834, hamlets 1,200, farms 1,841, wealthy homes 1,399, temples 1,043 | 410: every `TownCity` |
| through blocks alone | 1,646 roadside taverns (their blocks rebuilt by name - but the author's `TVRNAS00` and `TVRNAS06` hold houses and no tavern, so the 274 roadside taverns standing on them keep Daggerfall's own: the port's curation, "Daggerfall's own laws the mods meet" below) | - |
| RMB blocks | 209 (156 of Daggerfall's own names rebuilt, 53 new) | 611 (178 of Daggerfall's names, 433 new - 388 composites like `WALLAA04.FARMBA01`, a wall and a farm made one) |
| untouched | dungeons, graveyards, poor homes, covens, cults, the two ship pixels | everything that is not a city |

Each is one switch in the Mods pane (Features, "Takes effect when the game
is next started (an in-game Load keeps the towns it started with). Offline it
also needs Replace Game Artwork."). The switch is read ONCE, when the
world-data loader runs as the game starts, and latched
(`scenes/modWorldData.js`, `latchModLoaded`): a town never moves under the
player's feet. Both default on. Offline the towns also
need Replace Game Artwork (DFU's AssetInjection), as in DFU; that gate is read
once for the game too (`latchWorldDataDoor`) - a closed door loads no pack, and
a house bought behind it is stamped with the Daggerfall town it stands in.

Both mods ship `FIGHBM00.RMB` and the two differ: Daggerfall Unity serves the
file of the mod loaded later, Beautiful Cities, and so does the port
(`WORLD_DATA_PRIORITY`, the door's per-name list - `formats/worldDataReplacement.js`
keeps every mod's entry of a name, highest load priority first, and the first
whose switch is on answers; a mod switched off never hides the one under it).

## The housing promise - a town keeps the layout a save's things were made in

The two mods do not edit Daggerfall's towns, they REPLACE them, and a building
is known to the game by WHERE it stands: DFU's building key, `(block x << 16) +
(block y << 8) + record`. Every record a save keeps by key would wake in
another building when a town's layout changes under it:

- the house you bought (banking's deed) and everything you did to it - the
  decor placed in its frame, the built-in furniture taken out by name, the
  chests filled, its yard, its painted look;
- a room rented at an inn, a quest's building and the markers its people stand
  on, a questor met indoors (the return to them asks the building), an item
  left at a smith, a Recall anchor set indoors, a save made inside
  a building;
- the buildings the automap knows by name.

DFU itself lets them wake in the wrong building. The port does not
(`src/systems/layoutPins.js`):

1. **Every such record is STAMPED with its town's layout when it is made** -
   which layout mods were changing that town then (`layoutStampOf`:
   `beautiful-villages@1.4.2`, joined by `+` for two), and nothing at all for
   Daggerfall's own town, so a game without the mods saves exactly what it
   saved before. A record from before WD3 carries none and is, correctly,
   classic. A stamp names only the mods that CHANGE that town (its location
   file, or a block its grid names - `layoutModTouches`), so a record made where
   a mod changes nothing never holds its town to that mod.
2. **A load pins each town its records hold** to that layout (`pinsFrom`; the
   strongest record of a town decides: a house, then a room, a quest site or a
   questor, an inside save or an anchor, a repair ticket). A pin turns a mod OUT of a town
   (a house bought before the mod was switched on keeps its classic town) or
   lets one IN (a house bought in a Beautiful Village keeps its village when
   the mod is switched off since - the mod's pack is fetched for that town
   alone). Everything else in the world follows the switches as they stand.
3. **The world-data door serves a pinned town its layout**: its location and
   the blocks laid out in it come with exactly the mods its pin names
   (`formats/worldDataReplacement.js`, the door asks the pin oracle; the
   block reads ask for the town whose grid named them - `MapsFile.getRmbBlockName`
   notes it, `systems/worldDataVariants.js` `readingLocationKeyOf`).
4. **A pinned town is read again and built again** when a load changes its
   answer (`world.js` `applyLayoutPins`, after the save's player and quests
   are restored and before its place is built - the world load and a dungeon's
   own same-dungeon load both).
5. **A deed sleeps where it cannot be honoured.** Where a deed's town stands in
   another layout all the same (offline, a pack that could not be loaded for
   it - Replace Game Artwork off, the network; online, a deed that came through
   customs from before the mods, which no home of the service's pins) its key
   names a stranger's house, a shop, a temple or nothing - measured over the
   real data, 58% a stranger's house, 31% nothing, 11% a shop or hall - so no
   building is the player's by it: no door opened, no cupboard theirs, no bed,
   no furniture taken out, no sale at the bank (`banking.js` `deedStands`, in
   `isHouseOwned`). It wakes when its town stands in its layout again.
6. **A town is released** once nothing holds it - the house sold, the room
   expired, the quest ended. The pins are set at a load, so the town stands
   as it is until the next load, which stands it as the mods would have it.

Two stores that are not records get the same law:

- **an interior's cached scene** (what you left in a shop, a chest opened)
  carries its town's layout and is restored only into that layout - an
  ordinary one cached in another layout goes, a permanent one (a house, a
  rented room) is kept unrestored for the layout it belongs to
  (`worldModes.js` `restoreInteriorScene`), and leaving the visit never writes
  the other layout's room over it: what the visit left (its chests, its floor)
  is kept BESIDE the house's scene for that layout (`layoutSceneName`) and given
  back on a visit in it, and the room is not its owner's to furnish there. A
  visit is stamped with the layout it began in, whatever lands while it lasts;
- **a town's discovered buildings** carry the layout they were found in, and a
  town whose layout moved forgets them at the load (the town itself stays
  found; `systems/discovery.js` `pruneDiscoveryLayouts`).

## Online

The two switches are the ROOM's (`systems/onlineLane.js`
`ONLINE_ROOM_MOD_KEYS`, forced on): two players who disagreed would walk two
towns, one through the other's houses, and a building key - an online home's,
a shared quest's - would name two buildings.

Every online home bought before WD3 was bought in Daggerfall's own towns. The
account service keeps the layout each home's town was bought in
(`homes.layout`, migration `0073_home_layout.sql` - 0046 on its branch, 0069 at the first merge onto main, 0071 past PROF9's and PROF12's 0069_cooking and 0070_alchemy at the second, 0073 past SILVER-WAYS' 0071_silver_ways and PROF2b's 0072_motherlodes at the third; NULL is Daggerfall's own -
exactly the layout every existing home was bought in). A claim stores the
layout its client's town stands in. A town that already holds a home keeps its
first home's layout: a claim from a client whose town stands in another layout
is REFUSED (409 `home-layout`, naming the town's layout; `net/homeLaw.js`
`homeLayoutsMatch`) - its building key names a building of the town that client
sees, and storing it under the other layout would hand the buyer a stranger's
house. The client hears the layouts again and builds the town as the room's. Every client reads
`/v1/homes/layouts` - each town holding a home and its layout - at its online
boot, before the first town is built, and pins those towns; online, a save's
own records pin nothing (one player's save would stand one town apart from the
room's). Until the service has answered AND its pins stand (the packs they let
in fetched, the towns rebuilt), no home is bought and no home's room or yard is
furnished (its pieces neither stood nor written), no discovery is forgotten, and
the asking goes on behind the play (`homeLayoutsHeard`); a room the player stands
in is furnished the moment they land. Of two answers in flight the later one's
pins stand (`applyLayoutPins`' generation). A client whose pack of a room's town
mod did not load (the network; a browser without DecompressionStream) stands
Daggerfall's towns, stamps nothing with a mod it does not show, and buys no home
(`worldDataPacksMissing`, "Reload the game to buy a home"). The service keeps a
town in one layout in the claim's own write, so two first claims at once in two
layouts seat one. The decor placed,
the look painted, the yard and the rooms let stay in the building they were
made for. A deed that crosses back through customs carries its town's layout
with it (`systems/realmCustoms.js`).

Deploy the account service (migration `0073_home_layout.sql`, `acct72`) before the client: an older
service drops the claim's layout and answers no `/v1/homes/layouts`, and the
client would ask on until it does.

A record whose town stands in another layout all the same (online, a realm
character's own record from before WD3 - only homes pin online; offline, a town
whose pack could not be loaded for its pin, which is said once: "Some of your
places could not be shown as you left them") is honoured, never misread
(`layoutPins.js` `recordStands`): a deed sleeps (above); an item at a smith is
handed over at any smith of its town; a rented room is honoured at any inn of
its town; a save or a Recall anchor made inside stands the player outside
rather than through a stranger's door; a quest's building site is chosen again
in the town as it stands, by the place's DECLARED P2/P3 and DFU's own house
fallback (FIELD BUGS 2026-10-04d RESEAT-DECLARED: the fallback's stored p2 of -1
had read as "any building", a house turned into a tavern or a shop), keeping
what was assigned to it (`Place.reseatMovedSite`, `QuestMachine.reseatMovedSites`),
and a site no building of its kind stands for is UNSEATED - its key none, its
record kept - until its town stands in its layout again or a building of its
kind is chosen at a later load, never left on a stranger's building (RESEAT-GAPS);
and a questor
met indoors is seated again in it (FIELD BUGS 2026-10-03b QUESTOR-MOVED,
`Person.reseatMovedQuestor`) - in the building the journal names as the town
now stands, else the first named building holding one of their faction and
look, on the person there of that faction and look, else of that faction - with
no roll, so a party's copies agree. The questor keeps their name and the NPC
answers to it (`movedQuestorName`, the interior's one name derivation); their
hall moves with them, never by a Place's own P2/P3 (its P2 of 0 read as
Alchemist); a party member's copy is mended as it arrives (a share, a resync),
once the towns' layouts are known. A town with no such building keeps the
record as it was.

Every claim SAYS its town's layout, Daggerfall's own as `null`; a claim that
names none is a build from before the town mods, and is refused (426
`home-update`, "This game is out of date. Reload it to buy a home."). A refusal
for the town's layout counts against no hour's claims, and the client asks the
layouts again at most once in `HOME_LAYOUTS_WAIT_MS`. A building's online ROOM
is its layout's: the layout mods serving its town ride in the room key's high
bits (`world/interiorShared.js` `layoutRoomKey` - Daggerfall's own town keeps
the rooms it always had), so two players whose towns stand in two layouts never
share a room, and a relay memory from before the mods lands on no other
building.

Online the world-data door is open whatever Replace Game Artwork says
(`worldDataDoorOpen`): the ground is the room's, and a player with the switch off
stood no town of the room's (Detailed Ships' decks and Roleplay & Realism's
fort had the same hole). The switch keeps the textures and the music it gates
elsewhere.

## Daggerfall's own laws the mods meet

- **A building's own outside, kept in its room.** Both mods leave a copy of a building's EXTERIOR model inside its
  room, its door facing out as every exterior door does. Where that door is the interior door nearest the enter
  marker, TransitionInterior's landing (the door, 0.75 along its normal) stood the player outside the room's
  one-sided shell over nothing, falling for good in the black: 146 of the packs' 10,309 entries (Warvale's `GENRAS00`
  #1, #2 and #7), and 18 of Daggerfall's own 11,452. Each of DFU's two landing arms takes only a spot with a floor
  under it now, in DFU's own order, so no landing DFU makes on a floor moves (`player/enterExit.js` `interiorLanding`'s
  `standsAt`); a room with nowhere to stand is refused in DFU's own words, "This house has nothing of value."; and a
  body ten metres under a room's lowest triangle is stood back at its door (FIELD BUGS 2026-10-04d VOID-ENTRY).
- **The port's curation: a temple with no house.** Beautiful Villages replaces the location files of 34 of Arkay's
  standalone temples with its `TEMPASA2` alone - the temple and 25 House5, none a house a quest seats anyone in - so a
  temple quest whose person takes a local home (half of them: Person.cs AssignHomeTown) could not be made, and the
  questor said "You're too late..." (C0B00Y01 505 times in 544, C0B00Y03 273). The 34 are kept Daggerfall's own BY
  THEIR LOCATION KEYS (`layoutPins.js` `CURATED_CLASSIC`'s second row, asked before any type or grid, since the mod
  replaces their files); the twelve villages laying `TEMPASA2` out among their own houses stay the author's (FIELD BUGS
  2026-10-04d TEMPLE-HOME).
- **The port's curation: quest markers no player reaches.** Six of the packs' interior designs (51 interiors, 1,105
  buildings in 665 towns) hold a quest marker no one can reach - under the floor, in an attic, inside a stair, outside a
  wall. Each of the eight stands at its measured floor spot, keyed by pack, block, record, kind and position
  (`systems/quest/markerCuration.js`, measured by `tools/townQuestMarkers.mjs`); a save's sites are mended at the load;
  and any building marker with no floor within 4 m under it stands its person, foe or item at the site's nearest marker
  that has one (FIELD BUGS 2026-10-04d QUEST-MARKERS). And fourteen more designs (128 buildings) hold one past a
  stair the author shut with a floor tile and marked with the editor's 199.14 and 199.13, which no game reads - eleven
  cellars, three lofts; each stands by the shut stair, off the room's entrance (FIELD BUGS 2026-10-05 SEALED-CELLAR,
  The Possessed Child in Tigonus). The list: 20 designs, 179 interiors, 22 markers - 13,084 buildings in 4,073 towns.
- **The port's curation: a tavern with no tavern.** Beautiful Villages rebuilds
  `TVRNAS00` and `TVRNAS06` as houses (the classic blocks hold three taverns
  each) and leaves the 274 roadside taverns standing on them (their location
  files not replaced) with no tavern - no room, no innkeeper, no tavern quest.
  The mod is kept out of a Tavern location whose grid names one of them
  (`layoutPins.js` `CURATED_CLASSIC`, a standing pin no save holds - its records
  stamped classic, a save's own pin winning); the 301 village cells laying
  those blocks out among their own are the author's.
- **A guild hall entry naming a guild this game does not carry.** Four of
  Beautiful Villages' villages write faction 1000 (the Archaeologists Guild's,
  its own mod's) on a guild hall entry; DFU without that mod hands it to the
  grid's first hall - Bubandanis' Mages Guild and Tulaedax's Fighters Guild
  answer "You get no response", Tulaedax's Mages hall takes the Fighters'
  faction. Such an entry draws for no hall (`talkTopics.js`
  `UNCARRIED_GUILD_FACTIONS`); each hall takes its own guild's.
- **A town's buildings wear its location's climate,** its terrain the pixel's
  (DFU's `ClimateUse.UseLocation`): the same for every classic town, the file's
  own for the 81 of Beautiful Villages' towns that name another.
- **The versions every stamp was made against** (`LAYOUT_MOD_VERSIONS`): a
  vendored pack of another version may move buildings under every stamped
  record, so updating one is a layout migration, held by test.

- **A street's people.** Only a flat in a person archive (334, 346, 357,
  175-184) is a person the activation ray can meet - DFU's `FlatTypes.NPC`,
  the trigger collider `DaggerfallBillboard` gives it alone. The mods' lamps,
  food and animals carry faction ids (43,181 flats in 1,371 towns) and stay
  scenery, as in DFU (`worldModes.js` - the same `isNpcFlat` the dungeons ask).
- **An inside save, and a Recall anchor set indoors,** find their building by
  its key: a block a mod adds is numbered past `BLOCKS.BSA` in the order a
  session first reads it, which another session does not repeat.

- **A town's dungeon.** Beautiful Cities replaces Daggerfall, Sentinel and
  Wayrest, whose castles are dungeons. A location served from JSON keeps its
  dungeon's `RecordElement` (DFU's `LocationDungeon.RecordElement`), whose
  `LocationId` every dungeon reader asks - the castles are entered, and saved
  in, as in Daggerfall (`formats/worldDataReplacement.js` `dungeonFromJson`).

- **Windmills.** Kamer's mill is DFU's replacement of model `41600` wherever it
  stands. Six of Beautiful Villages' farms (FARMAA04/05/07, FARMBA05/08/09) and
  34 of Beautiful Cities' blocks place model `41600`; a `41600`
  a block's OWN records place is the port's mill (tower, sails, collider, hum)
  on the enhanced skin with the Windmills switch, and a block served from world
  data stands no Kamer placement of its own name (Beautiful Cities loads after
  Windmills of Daggerfall; its farms are the ones read) - `world/rmbLayout.js`.
- **The Order of the Raven.** A block served from JSON keeps its
  `FldHeader.OtherNames`, so RMBLayout's `KRAVE01.HS2` guild hall fires in a
  knightly block of Beautiful Cities as it does in DFU.
- **Roleplay & Realism's Master Armorer.** RR hard-codes the shop's key by its
  cell in the three classic towns; Beautiful Villages moves `ARMRAM03` in two
  of them (Penmore's to (2,2), Pjiga's to (0,1)), and in DFU the two mods
  together name a neighbour's house "Dharjen Custom Armor". The key is read off
  the town's grid (`systems/rrQuestLine.js` `rrMasterArmBuildingKeyIn`) - a
  recorded departure.
- **The decor catalogue** reads `BLOCKS.BSA` past the door (`decorScan.js`),
  so 1,400 redecorated interiors never renumber it. DECOR-MODS (FIELD BUGS
  2026-10-05b, the owner asked for the town mods' furnishings): the pieces the
  port stands in for what the mods place join it after every place of
  Daggerfall's - every one whatever is on, so none renumbers it, and offered
  while the port stands it (asked as the offer is made, AUDIT 05b A3) -
  measured over both packs and Detailed Ships' ships, never the town's own
  structure (`systems/decorMods.js`; `01-Overview/Field-Bugs-2026-10-05b.md`).
- **Houses for sale.** Every building the bank or a door can sell in either
  mod stands on a classic model (measured: 1,658 village houses and 3,358 city
  houses), so every price reads the ARCH3D record: the bank's DFU's own `GetHousePrice` over its radius, a door's
  online price (HOME-PRICE) its ground - `06-Systems/Economy-Arc.md`.
  Beautiful Cities' 224 `House5` records whose one model is a wall piece
  (`53210`) and two `House2` with none have no exterior door and are no
  residence: nothing sells them - the bank's market skips a house with no model
  of its own in ARCH3D (`housesForSale` `stands`, the record's radius; the wall
  piece's stand-in below is the port's, and gives it none), as no door could
  open it.

## The pieces the mods borrow - the port's own stand-ins

Both mods place pieces of five peer mods the port does not carry - the RMB
Resource Pack, Daggerfall Expanded Textures (DET), Diep's Rosy's Resources,
New Paintings and DET Harvestable Crops - and eighteen beds of their own
whose prefabs point at nothing. Daggerfall Unity without the peers draws
nothing at all where they stand. Mac's answer for a peer the port lacks was
"Build your own" (DS1), and the handover asked it again: "For anything
missing I need you to curate, like textures". So every piece below is the
PORT'S OWN, made for the places the author put it - read off the placements
(thousands for most ids: where they stand, how they turn, what they stand
beside, how far from a wall) and off the peers' catalogues' names - never a
copy of a peer's file. The RMB Resource Pack's published files
(`drcarademono/rmb-resource-pack`) were MEASURED where a size or a shape was
needed (the rocks, the stalls, the docks), and nothing of them is carried.

All of it stands behind the town mods' load - installed when a town pack
opens, for the game or for a save's pinned town (`world/townStandIns.js`
`installTownStandIns`) - and costs a game with neither mod nothing. DET's
pieces and Cliffworms' pictures are shared with Detailed Ships: each id has
one stand-in, on while either mod that places it is loaded.

| piece | ids | placed | stand-in |
|---|---|---|---|
| the beds | `42069`-`42086` | 4,029 | Daggerfall's own bed (`42069 + 3k` a `41000`, `+1` a `41001`, `+2` a `41002`, read off where each stands) out of the player's ARCH3D, its three bedclothes (`TEXTURE.090` 5, 6, 7) recoloured in code blue, brown, grey, orange, purple or yellow - the green measured and moved, the sheet and the frame kept (an ALIAS, `world/customModels.js`; Roleplay & Realism rests on it as on its own) |
| Rosy's and New Paintings' paintings | `69420`-`69464`, `79010`-`79030` (62) | 4,237 | Daggerfall's own six framed paintings (`TEXTURE.048`, which the climate swap changes region by region as it does a classic wall's) on a dark board two units deep, hung as each id hangs - upright, on its side turned up by the author's X rotation, or lying face down - a pixel a unit |
| Rosy's small hangings and rugs | `69467`-`69469`, `69471`, `69472` | 586 | cloth drawn in code (`world/townPictures.js`): a hanging on its rod, either face out; a rug on the floor |
| DET's timbers | `45081`, `45110` (shared with Detailed Ships), `45111`-`45113`, `45129` | 44,522 | squared timbers four to ten units thick, a segment (85 units) long: every fireplace's mantel, every beamed hall's rafters |
| DET's chimneys | `45074`, `45076`, `45077` | 14,440 | the sloped base, the stackable flue (53 units square, 114 tall - the step 3,334 stacks climb by) and the topper - a corbelled cap and two pots |
| DET's tapestries and banners | `45008`-`45070`, `45134`-`45164` (40; `45145`, `45161`, `45162`, `45164` shared with Detailed Ships) | 1,476 | cloth drawn in code: the five regions' arms, the Eight Divines', fourteen patterns - two-sided on a rod, banners swallow-tailed |
| DET's other town pieces | stumps, planters, column drums and heads, rugs, vanes (`45087`) | 178 | built in code, classic textures |
| DET's flats | archives `10009`-`10028` (and the editor's old `1010`, `1021`, `1025`) | 8,916 | the player's own sprite of the same thing where Daggerfall has one (a cow, a horse, the Great Daenian dogs, sacks, crates, a goblet), drawn in code where it has none (`world/standInSprites.js`: fruit, cheeses, porridge, a cabbage, chickens and roosters, sheep, rats, doves, a monkey, firewood, an easel...) |
| Cliffworms' Items | `1210_10`-`_12`, `_17`-`_20` | 665 | Detailed Ships' pictures of them - the same author's set, which the RMB Resource Pack carries too ("Cliffworms' Items"; his bottles, and classic pieces he moved there), shared (`systems/detailedShips.js` `detailedShipsArtOn`) |
| DET pieces shared with Detailed Ships | `45082` (ensign staff), `45121` (dog vane), `45190` (sea chest), `45191` (weapon rack) | 1,364 | Detailed Ships' own stand-ins (`world/detStandIns.js`), which the towns share |
| the table clutter | archive `56790` (22 records) | 4,827 | no peer's catalogue names it; each record a piece of Daggerfall's own clutter of the kind its height says - tableware and books on the tables, jars, potions and books on shelves and ledges |
| the temple gardens | archive `10035` (7 records) | 151 | no catalogue names it either; rows of one record each on three temples' grounds - each a garden plant of Daggerfall's own (`TEXTURE.301`): cabbages, greens, lavender, flowers, a berry bush |
| the RMB Resource Pack's rocks | 23 ids | 245 | a boulder of the climate's rock (`302_3`), each the size of the pack's own mesh, measured |
| its hills | 23 ids | 47 | a hill of the climate's grass or rock at the pack's own shape (FIELD BUGS 2026-10-05 HILL-SHAPES, "Houses in Ipsham are floating"): a polar profile measured off each published mesh by `tools/rmbrpHills.mjs --shapes` (`world/rmbrpHillShapes.js`: the raised footprint's centre, 16 bearings each with its reach and ten rings' heights, each cell's median - the shape, not the sculpt; 0.03-0.32 m from the pack's surface at the median), so what the author stood on a hill stands on it - Ipsham's TEMPASH3 houses, TVRNAS03's gazebo. They were mounds of the catalogue's size, 1.7-4.5x too narrow and 2-7x too low, and those houses hung 4.1-4.2 m. TREES-SEATED's seat (`world/townStandIns.js` `blockHillSeat`) reads the hills drawn, so the six blocks' 130 trees stand on them (1 more than 1.5 m off, where 121 were). A measurement of the peer's mesh, as the docks' and domes' - Mac's to confirm |
| its market stalls | 17 ids | 32 | a stall the pack's size (3.2 m across the counter, 4.9 m along it), its awning the cloth each prefab names (`TEXTURE.049` or `449`) |
| its docks | `53140`-`53144` | 16 | measured off the pack's meshes: a plank deck whose top is the origin, five-sided piles 5 m below it and 1 m above, a ramp or five steps - which land where the author's do (GENRAS00's ramps at the long dock's two ends; TEMPASH3's three flights across the T-dock's wing) |
| its platform, foundation and domes | `53160`, `53170`, `53182`, `53187`, `53194` | 22 | stone blocks, classic textures, and the three domes at the pack's own profile (FIELD BUGS 2026-10-04d DOMES, measured off its HF Dome 03/04 meshes at the prefabs' 4.6875: an octagonal drum 4.8 m across on the ground to 3.63 m, the dome to 8.43 m, 03's spire to 10.75 m - they had been a 3.6 m cap over a drum sunk in the roofs they stand on) - the foundation the pack's 16 x 8 x 16 m block, its top the floor of the two temples it stands under (centred, as the pack's mesh is, it walled up their front doors; no stand-in covers any door of either pack's towns) |
| its crop fields | `53211`-`53214` | 252 | RMBCropBillboardBatch's own law (FIELD BUGS 2026-10-04d CROPS, read again off the component's source): a grid over C#'s integer halves (an 85 m field from -42 to 42, a 35 m one from -17 to 15) in the world's axes - the batch's turn is never read - a plant every 4 m nudged up to half a metre, at the field's own height, none within a metre of the block's models (IsOverlapping, `blockSolids`), each a random pick of the climate's crop billboard (`TEXTURE.301`: wheat in the woodlands, corn in the mountains, sunflowers in the south, vines in swamp and rainforest, the second desert's own record 20; `511_22` stubble in winter), seeded by the spot so a field stands the same every visit (`world/flatFields.js`, sown by `world/rmbFlats.js`) |
| its city-wall piece | `53210` | 224 | the middle 128 units of Daggerfall's own wall segment (`445`) out of the player's ARCH3D - its stone, its climate - cut and moved onto the piece's line (FIELD BUGS 2026-10-03c, below) |

**The city walls' corners** (FIELD BUGS 2026-10-03c,
`01-Overview/Field-Bugs-2026-10-03c.md`; Discord: "missing holes in the out
walls of Alik'ra", "Saw the same thing in Chesterwark"). Beautiful Cities turns
its walls round corners of its own - `WALLAA12` to `WALLAA15`, the 112
composites built on them. Each stands its corner tower (`444`) where
Daggerfall's corners stand it, 64 units in from where the two wall lines cross,
its edge where Daggerfall's walls begin, 448 units along each line; but each
line's first wall segment (`445`) stands a whole segment out from the tower and
begins at 576. The author closes the 128 units between with the RMB Resource
Pack's wall piece, `53210` - two a corner block, every one of the 224 - and
without it every city's wall stands open at every turn, wide enough to walk
through. Read off its placements (four corners, two lines each, both turns of
the piece along a line), its wall stands on the 445s' own line 128 units along
its `+z` and fills the gap centred 128 along its `+x`; the stand-in is exactly
that, cut out of the player's own 445 (`townStandIns.js` `cityWallFillModel`),
so it is solid as the wall is. A quarter of the placements (the two corners'
pieces along their north line) turn it the other way across the wall, as the
author did, so there the 445's inner face looks out - the stone is the same.

**Why the hole held a player** (FIELD BUGS 2026-10-04d CITY-WALLS; Discord: "small chunks of walls seem to be
missing in some cities ... I was stuck inside invisible walls after investigating the hole in the wall", posted
before CITY-WALL merged). Daggerfall's wall segment `445`, its gates `446`/`447` and the arms of its tower `444` are
HOLLOW: below the walkway each is two long faces and no ends. Through a corner's hole the player walked into that
corridor, which runs on through every segment and tower; inside, every face is seen from behind - the renderer culls
it, the collider (facing-blind) does not - so the walls stood unseen and held. The stand-in shuts the hole with the
445's own cross-section, so no opening into the corridor is left. Measured with the player's data through the port's
loader: all 410 rings shut, none open at either end of any line; every one of the 1,266 corner pieces is the middle of a
445 with nothing on its cut faces; Daggerfall's own corner towers reach exactly 448 from where their lines cross. The
author's farms stand inside the ring by design and reach at most 50 units into a wall piece (house `215` in
`WALLAA06/12/13.FARMAA01`), as Daggerfall Unity places them too: recorded, unchanged.

### Not stood in

What follows draws nothing, as in DFU without the peers - each because no
stand-in could be MADE for it from what is known, not because it was missed
(`test/wd3_standins.test.js` pins this list against every placement of both
packs):

| ids | placed | why |
|---|---|---|
| `69465` | 4,786 | Rosy's fireplace dressing - the classic fireplace it dresses stands |
| `52991` | 3,095 | the RMB Resource Pack's winter-smoke marker: an effect, no mesh |
| `45181` | 568 | DET's chimney smoke, at the flues' tops: an effect |
| `45179`, `45198`, `45205`, `45206`, `43756` | 286 | DET pieces no catalogue names, in few blocks |
| `53129`, `53130` | 18 | the pack's wooden bridges: their rails are in its published files, their decks are not, so neither shape nor size can be read - the six village blocks that place them stand bridgeless |
| `53132`, `53134` | 13 | its stone bridges: two meshes each under transforms the published files do not settle |
| `1210_13`, `_16`, `_24` | 75 | Cliffworms' items Detailed Ships does not carry - no picture of them is known |
| `1230_2` ... `1230_22` (8) | 39 | one record to each of the eight temple blocks' variants, a metre up - by every sign each temple's own deity statue (archive 1230 is King of Worms' and Zoran's statues); only Kynareth's (`1230_30`, Detailed Ships') is known, and it is none of these |
| `10025_1`, `1200_4`, `1200_9` | 11 | an uncatalogued DET flat; two of StarMadeKnight's NPC billboards |

A record of a stand-in archive that has no picture (the eight statues, the
three items) draws one clear pixel and is said once by name
(`scenes/dataPipeline.js`) - it used to throw the whole interior.

A stand-in YIELDS to the player's own picture of its record - a loose file or
an attached `.dfmod` (the real DET or RMB Resource Pack it only stands in for)
answers first, with Replace Game Artwork on. A stand-in's clear placeholder (no
picture at the time) is never its key's for good: a picture that lands later
takes its place.

The packs' memory is bounded: the door keeps the 192 blocks most recently served
and a pack the 1,024 nodes most recently read (a block let go is rebuilt when
next asked) - a walk over every block of both packs grew the heap by 259 MB
before, 84 MB now. Every classic block a pack's `$c` reads is named beside its
index (`classicNames`), refused by name on a BLOCKS.BSA in another order.

## Housing customisation with the mods

Mac's own example ("For example housing customization") is held by the
layout pins above, and by four more things the stand-ins needed:

- **A built-in piece can always be taken out.** BASE-HIDE names a room's
  own furniture `m<placement>:<model>` and `f<flat>:<archive>.<record>`, and
  a flat's archive had three digits - the town mods' interiors lay DET's food
  (`10021`) and the table clutter (`56790`), five. Online a room's whole
  taken-out list was refused for it, offline the piece came back at the next
  load. The name takes five digits now (`net/decorLaw.js`
  `DECOR_BASE_KEY_RE`), and every flat and model both packs' interiors lay
  is pinned to fit it.
- **The decor preview and the ghost** draw a stand-in or an alias bed as the
  room does - both ask the pipeline (`getGpuMesh`, `cpuModels`), which
  builds an alias from the player's own ARCH3D.
- **The decor catalogue** offers the stand-ins while they stand (above,
  DECOR-MODS): a piece placed stands while its mod does, as the mod's towns do.
  A hanging is named by the picture its builder wears - one table both read
  (`DET_PICTURES`, `ROSYS_PICTURES`, AUDIT 05b A8).
- **A bed is a bed.** Roleplay & Realism's rest-in-bed reads the classic
  model under an alias (`classicModelIdOf`), so a town's coloured bed rests
  the player as a classic one does - in DFU the null prefab is nothing to
  rest on (Port-Ledger, WD3).

## Proved

- `test/wd3_pack.test.js` - the pack's rows, reader, refusals and bytes; the
  vendored packs' form; with ARENA2 every one of the 8,547 files rebuilt
  sha256-exact.
- `test/wd3_door.test.js` - load priority, the packs on the door, the online
  gate, pinned towns and the reading town, OtherNames, the windmills, the
  Master Armorer, the decor catalogue, the loader.
- `test/wd3_layoutPins.test.js` - the stamps, the pins, every record stamped
  where it is made, the cached scenes and the discoveries, the load.
- `test/wd3_online.test.js` - the service's layouts on the real service over
  SQLite, the client's ask and the room's switches.
- `test/fb1003c_citywall.test.js` - the city walls' corners: the law off the
  pack (all 224 pieces filling 448-576 units off the crossing of their two
  lines, the tower 64 units in from it; the 210 on lines of the author's own
  segments, the segments beginning where it ends), the stand-in cut from a
  445 and its faces on the cuts, its install, and the real pipeline building
  it from ARCH3D for the renderer and the collider.
- `test/wd3_standins.test.js` - every stand-in above, its install and gates;
  with ARENA2 the coverage of both packs' every placement, the housing names,
  and the alias beds built from the player's own ARCH3D.
- Renders (the headless probe over the player's data): the beds in their six
  colours, the paintings on the walls, the hearths' mantels and the chimneys,
  the temples' tapestries and banners, the food and animals, the crops under
  snow, the market stalls, the docks - a footbridge of dock pieces (`53140`-`53144`) in Agibunu,
  the T-dock and its moored boat in Bubyrydata - and the temple garden in
  Atretturana.
