# Immersive Travel (kkgobkk) - IT1

**Immersive Travel 1.5**, by **kkgobkk**, Nexus mod 986 - "Implements diegetic
fast-travel by adding carriages outside of city gates." The owner asked, on
2026-10-04, how instant travel could come back online "as an option but with a
cost" (Mac's TRAVEL-ONLINE had removed it the day before, `Travel-Options.md`
item 9), then handed the shipped zip over: *"Actually lets let this be the next
mod we integrate 1:1"*. Three calls were put to them and answered the same day:
the carriages are laid onto whichever gate block the town is served with
(Beautiful Cities' too), a driver's trip is Daggerfall's fast travel online with
the fare paid, and the gate edits are built now and checked against a
`BLOCKS.BSA` later.

The vendored record is `vendor/immersive-travel/README.md` (the permission line
is open: `01-Overview/Mod-Registry.md`).

## What it is

A carriage, its team or a cart, the horses, a hay bale or a crate and a
**driver** stand outside the gate of every walled city - Daggerfall's four gate
blocks, `WALLAA08` to `WALLAA11`, with the mod's records appended. The driver is
a person flat in faction **8642, Carriage Drivers**, which the mod registers as a
Merchant (`sgroup 1`) with a custom merchant service, **Fast Travel**: talk to
the driver and the merchant popup's button opens the driver's map. A place picked there is
refused by its type (the AllowedDestinations dials; as shipped, cities, hamlets
and villages), or - with RegionLockedCarriages - by region, or opens the mod's
popup: Daggerfall's own travel popup with the mod's calculator, a daily carriage
fee on top of the inn nights. Begin is Daggerfall's fast travel.

**Sailors** (8643, under Carriage Drivers) have a Fast Travel of their own - a
ship captain's map of the docks, a voyage at 51 minutes a map pixel with the
ship and her captain paid by the day - but **no block the mod ships stands a
sailor**. The port carries the captain whole (the map, the refusals, the popup,
the calculator, pinned), reachable the day a block stands one.

**Disable Normal Travel** makes the carriage the only fast travel: the player's
own map's popup is the mod's, and a trip to a place is refused outright - "You
must take a carriage to initiate fast travel."

## The law is the assembly

The bundle carries `ImmersiveTravel.dll` and no C# source. Every rule below is
read off its IL (`vendor/immersive-travel/il/ImmersiveTravel.il.txt`), cited by
offset in `src/systems/immersiveTravel.js`; the mod's own bugs are carried as it
ships them and named where they stand.

| File | What it is |
|---|---|
| `src/systems/immersiveTravel.js` | the mod: Init (the two factions, the two services), the settings, the carriage's laws (IsDestinationValid, BorderingRegionIndex, isCapital, the map's refusals, its calculator), the captain's (HasDock, NearDock, IsPlayerInTown, the refusals, the captain's calculator), the popups' OnPush and their toggle overrides, the trip each popup bills |
| `src/systems/immersiveTravelTables.js` | the three tables the static constructors fill out of field data: 40 capitals, 15 large docks, 382 dock pixels |
| `src/world/immersiveTravelGates.js` | the gate records as a layer on whichever gate block is served (below) |
| `tools/immersiveTravelPatches.mjs` | the four gate patches out of the shipped bundle |
| `src/ui/travelMapWindow.js`, `src/ui/travelPopUp.js` | the classic skin: the CarriageMap's five-texel page, its refusal box, the mod's three popups |
| `src/ui/heldMap.js` | the enhanced sheet: the same maps and popups as the sheet's card |
| `src/scenes/world.js` | `openImmersiveMap` (the services' push, and online the sun's refusal), PlayerGPS for the laws (`itHere`) |
| `src/scenes/worldModes.js` | a street merchant's popup in the street's slot, and the service's door (`enemiesNearby`, `openImmersiveMap`) |

### The carriage

- **Init** (IL_0298-0564): the two factions (type 15, sgroup 1, ggroup 16,
  power 100, the rest -1), then the two services - and the services only once
  BOTH factions went in (IL_047a-050b; else the mod logs its error and registers
  neither, AUDIT IT1 L3). The mod is **loaded for the game** (AUDIT IT1 W4): its
  switch is latched as Init runs at the start, because the faction dictionary is
  built at the load once a page, and the services, the gate patch and its layer,
  the driver's map and Disable Normal Travel all ask that latch - a switch
  flipped mid-game waits for the next start (an in-game Load keeps it).
- **The service** (IL_0574-05b3): `AreEnemiesNearby(false, false)` says
  `cannotTravelWithEnemiesNearby`; otherwise it PUSHES the CarriageMap - past
  DaggerfallUI's travel-map door, so none of that door's refusals (the sun, a
  quest's offer) is asked: a vampire may take a carriage by day, as in DFU, and
  the arrival clamp lands them after dark. Online see departure 11.
- **IsDestinationValid** (IL_0a58-0b61): each type its own dial. **CARRIED BUG:**
  the three home types read *Dungeons* (IL_0adb), and no branch reads *Homes* -
  Homes on admits nothing, Dungeons on admits the homes.
- **BorderingRegionIndex** (IL_1398-1466): the region of the first neighbour that
  answers above 0 and not 31 ("High Rock sea coast"), asked at (x, y+1) TWICE -
  the second surely meant as another neighbour - then (x+1, y), (x, y-1),
  (x-1, y); -1 for none. **CARRIED:** region 0 (Alik'r Desert) is never an answer,
  and the player's own pixel is never asked.
- **The NPC map's popup** (IL_08f9-0a49): the type first ("The driver won't take
  you to this type of location."), then, region-locked, capital to capital
  anywhere, else the bordering region only - refused in two words by where the
  player stands ("To reach that location, you must travel to the capital..." from
  a capital, "This carriage won't travel outside the region..." elsewhere). Each
  refusal is a box with one OK whose click closes the box (CloseWindow pops the
  top); the map stays.
- **The calculator** (IL_1d44-1e46): DFU's inn nights, then the fee for every
  whole day off the ocean plus one, and on the ship toggle the ship (unless the
  player owns one) and her captain by the sea day plus one. The time is DFU's
  own CalculateTravelTime. As shipped: 1 gold a day. **CARRIED:** no ocean guard
  (IL_1dfb) - DFU pays the ship only for a leg at sea, the mod for any trip on
  the ship toggle, so a trip over land with the ship on pays a sea day (reachable
  only with DisableShipTravelOutsideDocks off).
- **The popup** (ImmersiveTravelPopUp): a NEW popup each time (`newobj`), so its
  defaults are DFU's own with the ship off under DisableShipTravelOutsideDocks -
  never the toggles the map remembers. Its transport handlers refuse whenever the
  ship is off and the rule is on - **a click on the lit By land button is refused
  too**, the override reading TravelShip, not the button - and its camp-out
  handlers drop the ship. T and N are DFU's foot/horse and inn buttons' toggles
  (`SetupButtons`), so the hotkeys run the same overrides.
- **The map** (CarriageMap): DFU's travel map with Travel Options' five-texel page
  as the mod copied it - roads and tracks by its own DrawRoads / DrawTracks with
  Basic Roads loaded, no water, no politic containment (Travel Options has none),
  no middle-click mark, a city or hamlet's dot large and the rest small under
  ClearerMapDots. It is also the player's own map while Travel Options is off
  (Init IL_03bf-03d2) - whose CreatePopUpWindow builds DFU's popup NEW at every
  pick (IL_0870-0885), so it opens on Cautious / By ship / At inns, never the
  remembered three (AUDIT IT1 C2). A driver's or a captain's map is a NEW window
  (`newobj`, IL_05a2): its own four filters with every place shown, no
  middle-click mark, and never Travel Options' ports filter (AUDIT IT1 C1).

### The ship captain

- **NearDock** (IL_185c-189d): a dock pixel on the place or one of its four
  neighbours. The table holds PIXEL ids, compared unmasked; every id asked is
  masked (`& 0xfffff`) first.
- **The NPC map's popup** (IL_1604-1792): no dock near the destination - "That
  location doesn't have a suitable dock."; with LimitedRangeInSmallDocks a small
  place sails within its region only - "This small boat..." - unless the player
  stands in a city, a hamlet, one of fifteen large docks or region 31, or no
  neighbour answers a region at all (IL_16d0: -1 sails anywhere).
- **The calculator** (IL_1bec-1d2e): 51 minutes a step of the longest axis, the
  terrain unread, halved reckless; the ship and her captain by the day plus one,
  the captain even on the player's own ship. **CARRIED:** it counts no ocean
  pixels, so Warm Ashes' hidden ambush roll (which reads them) never fires on a
  captain's voyage.
- **The popup** (SeafarersPopUp): ship and camping out forced; any transport press
  is "Cannot disable ship travel when travelling with a ship captain.", any sleep
  press while camping "There are no inns in the middle of the sea."
- **The map** (SeafarersMap): ShowLargerDocks sizes a dock's dot large,
  ShowOnlyDocks shows nothing else - not on the dots, the hover, the click or the
  find, the one checkLocationDiscovered they all ask (AUDIT IT1 C4).

### Disable Normal Travel

ImmersiveTravelPopUp.OnPush (IL_19c4-1aac), over a map no driver opened: a place
a carriage goes - "You must take a carriage...", a place none goes - "You cannot
travel to this type of location."; its OK plays the click and pops the box AND
the popup. A destination with no location summary is only logged, and the
popup stands.

## The gate blocks

`vendor/immersive-travel/WorldDataPatches/` holds the author's edit of each gate
block as a WD1 patch (`02-Formats/World-Data-Patches.md`), rebuilt at load from
the player's own `BLOCKS.BSA`.

**BUILT WITHOUT A BLOCKS.BSA.** No ARENA2 in this container. The tool read the
edit off the files alone: the editor appends the author's records and leaves the
header's counts at the classic block's (2 models, 1 flat in all four), so the
records past the counts are the author's - 6, 5, 7 and 10 of them. And the two
round-trip changes the editor makes to every block, which the files show on
their own (AUDIT IT1 G1): BuildingDataList written at its count where the
classic block reads 32 slots (28 removed - Warm Ashes' patches, diffed against a
real BSA, remove the same), and a scale of 1 on the two classic models, whose
records carry none (6 sets). What it cannot carry is any other round-trip change
to a classic record (an automap byte, a rotation's equivalent). The loader checks each rebuild against the
author's sha256 and says when it differs, and `test/it1_worlddata.test.js`
checks all four with `ARENA2_PATH` set. **OWED:** that run, on a machine with
the ARENA2 - and if it differs, `node tools/immersiveTravelPatches.mjs
<immersivetravel.dfmod> <arena2>`, which writes WD1's own diff, checked.

**THE LAYER - A RECORDED DEPARTURE** (the owner: "Add carriages to either").
Beautiful Cities ships the same four names, its own redrawn gates, and 52
composites on them - 24 farm, 24 tavern and 4 road (`WALLAA08.FARMAA00`,
`WALLAA09.TVRNAS02`, `WALLAA11.ROAD` and the rest) - at a higher
priority, and online it is the room's. DFU serves one mod's file a name, so there
the gates would carry no driver. Here the mod's appended records are a layer on
the world-data door (`registerWorldDataLayer`): laid onto whichever file is
served under a gate's name or a composite on it, in the block's own coordinates,
the header's counts left as the editor leaves them (DFU lays out by the arrays).
The mod's own patch already carries them, so the layer stands aside there. The
layer lays only a patch's inserts past the classic counts and passes every other
op over - the round trip above, or what WD1's diff finds against a real BSA - so
no op can stop a world loading (AUDIT IT1 G1/G2; the install is guarded too).
**NOT SEEN:** how the carriages sit among Beautiful Cities' own gate furniture.
AUDIT IT1 G4 measured it: BC's two gate props (models 42520 and 45181) stand 23
to 49 units - under a metre and a quarter - from the team or the horses at all
four gates, in every composite on them. Clipping is likely and unproven: the
owner's eyes, once.

## Online

The mod is the room's (`systems/onlineLane.js`): its switch for the floor's
reason (collidable carriages at every gate), and Disable Normal Travel held
**off** - so the map's trips stay Travel Options' walked journeys (TRAVEL-ONLINE
whole) and a driver's fare is fast travel over land (a port's ship passage the
other, TRAVEL-ONLINE item 9). Every fare and rule
is the room's at the mod's value (ONLINE_WHOLE_MODS) - a fee of 0, a dungeon on
the driver's list or the region lock lifted would be a free or wider teleport a
dial away; the map's looks stay the player's.

The trip: a driver's map has its own `onTravel` (`openImmersiveMap`), which
calls `fastTravelTo` itself - it never meets the travel map's fork, whose online
floor (AUDIT TRAVEL-ONLINE T7) stands as TRAVEL-ONLINE wrote it (AUDIT IT1 W3:
an exception for the mod's kind there was never reached, and would have let the
player's own popup through). It is `fastTravelTo`, as a ship's passage online:
the fare paid, the arrival in the world's present, the trip's days on the
character's own clock (LIVED1).

## Recorded departures

1. **Disable Normal Travel ships OFF** (the mod ships it on), on the owner's word
   that the carriage is instant travel *as an option* - TO-FIELD2's shape. On,
   the map refuses every trip to a place and Travel Options' journeys from the
   map go with it. Turning it on restores the mod's own default (offline; online
   the room holds it off).
2. **The gate layer** over Beautiful Cities (above).
3. **The settings are read as a map opens**, where the mod's static constructors
   read nine of them once a session (CarriageMap's four, SeafarersMap's three,
   the popup's two; Init reads DisableNormalTravel once more), and the fees and
   AllowedDestinations, which the mod reads live at every bill and every pick, are
   billed and checked from that same opening's read (AUDIT IT1 L4). Offline the
   same; online the room's values cannot move under an open map.
4. **Disable Normal Travel refuses the popup for a PLACE.** In DFU the mod's popup
   takes the place of Travel Options' by load order, and what Travel Options' own
   coordinates popup does then is that mod's code meeting a class it never
   expected; the port keeps the bare-pixel walk, the follow-road key and the
   Overworld - none of them the popup the mod replaces.
5. **A driver's trip is never a PARTY-TRAVEL round** - a hired carriage is the
   hirer's.
6. **Online the fare is the mod's, not halved** - ESSENTIALS-HALF is the port's
   word on DFU's and Travel Options' fares; the driver's price is the mod's.
7. **The enhanced sheet's card names the ride** ("A carriage ride", "A ship
   captain's passage") - the classic popup is DFU's art and says nothing; the
   sheet is the port's own. The sheet's dots are its own: ClearerMapDots and
   ShowLargerDocks reach the classic window; ShowOnlyDocks reaches both. On a
   driver's sheet the road and track chips start at the mod's DrawRoads /
   DrawTracks, and a flip of one is that sheet's alone (the mod has no path
   buttons; AUDIT IT1 C1).
8. **The refusal boxes wrap** (SS5's `fitBoxRows`) - the mod's lines are wider
   than the screen.
9. **Not ported:** Hidden Map Locations' arms (the mod is not in the port) and
   `TravelOptions_IT_compat` (a mod the port does not have).
10. **A street merchant's popup stands in the street's slot** - the port's
    merchant arm had only ever opened indoors (`interiorOverlay`), and a first
    click before any building was entered loads the popup's art and then lands
    (ASYNC NEVER DROPS).
11. **Online, a sun-averse traveller is refused a carriage by day** (AUDIT IT1
    W2). The mod asks nothing, because DFU's arrival clamp lands such a
    traveller after dark (DaggerfallTravelPopUp.cs:350, "regardless of travel
    type"); online that clamp is skipped - the world's clock - and the travel
    map's door refuses them by day instead (LIVED1), so the driver's map refuses
    the same, with the hour night falls.
12. **The WALLAA09 driver wears a face** (DRIVER-FACE, FIELD BUGS 2026-10-09b,
    "NPC Shrarton in Tasoparet face sprite missing."). WALLAA09's driver is the
    flat TEXTURE.357 record 3, which FLATS.CFG has no row for, under a faction
    with no flat of its own, so GetPortraitIndexFromStaticNPCBillboard stood its
    starting record 410 - TFAC00I0's grey "OOPS! Tell Mack NOW!" - in DFU with
    the mod as here, at every walled city's WALLAA09 gate. While the mod is
    loaded the flat wears classic's own bearded man's face (182.3, 429), written
    into FLATS.CFG's dictionary as Roleplay & Realism writes it
    (`immersiveTravel.js` `IT_DRIVER_FACE`). `test/fb1009b_driverface.test.js`.

## Pins

`test/it1_immersivetravel.test.js` (13), `test/it1_worlddata.test.js` (5, one
with `ARENA2_PATH`), `test/it1_heldmap.test.js` (4), `test/it1_classicmap.test.js`
(2); `tools/mutants/it1.json` (35, all dead; AUDIT IT1 W3 retired IT1-26). AUDITED the same day (AUDIT IT1,
`01-Overview/Audit-IT1.md`): `test/auditit1.test.js` (16) and
`tools/mutants/auditit1.json` (30, all dead). Not seen in a browser: no ARENA2,
no GPU in this container.
