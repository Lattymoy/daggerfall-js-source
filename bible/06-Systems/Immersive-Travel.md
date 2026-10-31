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

**OWN-WORK2 (2026-10-31, the owner).** vendor/immersive-travel is retired: the
manifest, the settings file, `ImmersiveTravel.dll`, its IL dump, the README and
the author's edit of the four gate blocks left the tree, with
`tools/immersiveTravelPatches.mjs` (RETIRED). No gate block is edited now. A gate needs one
thing for Fast Travel: a driver in faction 8642 outside it, on open ground and
off its way out. Our own stand (`world/immersiveTravelGates.js` CARRIAGE_STAND)
puts a carriage, two horses, hay, a signpost and the driver 26 m along each
gate's wall. TS7, TS4 and the capitals carry it to their gates; on a town mod's
gate file the layer moves it the least step clear of that file's houses, props,
roads and lane. `systems/immersiveTravel.js` stays the law and
`systems/immersiveTravelTables.js` its tables, which
`test/systems/guild/it1_immersivetravel.test.js` holds by literal digests. Git
history holds the vendored copy (commit `c2fbbbbfa`); the provenance is
`01-Overview/Own-Work.md`'s.

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
| `tools/immersiveTravelPatches.mjs` | RETIRED (OWN-WORK2): the four gate patches out of the shipped bundle |
| `src/ui/travel/travelMapWindow.js`, `src/ui/travel/travelPopUp.js` | the classic skin: the CarriageMap's five-texel page, its refusal box, the mod's three popups |
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

**CUT AGAINST BLOCKS.BSA (ARENA2-IT, 2026-10-29).** The first four were read off
the files alone, with no ARENA2: the author's records past the header's counts
(6, 5, 7 and 10) and the round trip the files show (AUDIT IT1 G1: 28 building
slots removed, a scale on the two classic models). The run with the freeware
ARENA2 failed all four sha256 checks: the editor had also zeroed WALLAA08's
automap ground-flat byte and written WALLAA09-11's subrecord rotations (and on 09
and 10 a classic model's) as their negative equivalents. The four are now WD1's
diff (`node tools/immersiveTravelPatches.mjs <immersivetravel.dfmod> <arena2>`),
each rebuilding the author's file sha256 for sha256; the loader checks it again,
and `test/formats/worldData/it1_worlddata.test.js` with `ARENA2_PATH` set.

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

The mod is the room's (`systems/online/onlineLane.js`): its switch for the floor's
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
    (`immersiveTravel.js` `IT_DRIVER_FACE`). `test/systems/fb1009b_driverface.test.js`.
13. **A town past the Bay is a carriage's** (TRAVEL-EVERYWHERE, 2026-10-28, the owner: "the travel services won't take
    you to other provinces", then "Like how it works in the bay should be how it works everywhere"). The mod's map is
    DFU's, and DFU's stops at the Bay. On the enhanced sheet a driver's map picks a city, town or village past the Bay,
    where the world knows it (AUDIT TRAVEL-EVERYWHERE), and the mod's own laws ask it as a Bay place: its type, and
    region-locked its province's region and capital to capital both ways (a capital past the Bay is its pixels - the
    capitals' table is the Bay's 40). The trip is DFU's fast travel at the mod's fare, as
    any driver's (`03-World/Arena-Provinces.md` TRAVEL-EVERYWHERE). A captain's map keeps the Bay's docks, and the
    classic skin's map is the Bay's alone. `test/ui/travel_everywhere.test.js`.
14. **A capital past the Bay stands its carriages** (CAPITAL-CARRIAGES, 2026-10-29, the owner: "Ensure all capitals
    and cities outside the bay properly have the wagon transport at their gates"). A walled city carries each template
    gate's records to its own gates (TS4, TS7, `03-World/Town-Shapes.md`; AUDIT CAPITAL-CARRIAGES: off its roads, a
    fifth gate dressed). The seven capitals are our own plans with no WALLAA gate, so their 18 road gates had no driver.
    Each now takes the records of the Daggerfall gate that faces the way they stand (outside, its side's: WALLAA08 north
    to 11 west; inside, the opposite side's), carried as TS7 carries them (`world/capitalCarriages.js`). They move the
    least step that stands every record on the capital's gardens or open ground, off its rim, clear of its models, its
    approach and the gate's lane, and a model level on the ground as drawn.
15. **Inside the gate where the ground outside is too narrow.** Mournhold's, Alinor's and Torval's walls stand 6 to 8 m
    in from their rim, whose ground is blended to the land's. Their carriages stand just inside each gate, facing in, on
    the garden ring. Falinesti has no wall: its carriages stand inside its own ground where each road reaches it. The
    Imperial City's (Talos Bridge's landing, on a level apron - `world/rumareWaters.js` RUMARE_LANDING), Helstrom's and
    Solitude's stand outside. Solitude's slope fell half a metre a metre under its main gate, so its relief has a level
    stand west of the Gate Road's last run (`world/solitudeRelief.js` SOLITUDE_CARRIAGE_STAND). Each gate's records go on
    the block of its cell, with no tree and no walker under them. The maps' wheel marks a capital's slice with a road
    gate in it (`isCarriageTown`): the Imperial City's west slice of its 625.

## Pins

`test/systems/guild/it1_immersivetravel.test.js` (13), `test/formats/worldData/it1_worlddata.test.js` (5, one
with `ARENA2_PATH`), `test/systems/travel/it1_heldmap.test.js` (4), `test/systems/it1_classicmap.test.js`
(2); `tools/mutants/it1.json` (35, all dead; AUDIT IT1 W3 retired IT1-26). AUDITED the same day (AUDIT IT1,
`01-Overview/audits/Audit-IT1.md`): `test/systems/auditit1.test.js` (16) and
`tools/mutants/auditit1.json` (30, all dead). Not seen in a browser: no ARENA2,
no GPU in this container.

CAPITAL-CARRIAGES: `test/world/capitalcarriages.test.js` (8, three with `ARENA2_PATH`: the gate frames off BLOCKS.BSA and
the 407 city templates; every capital's records on the ground the terrain kernel draws; a walled city's gates on their
roads, on the Bay and past it); `tools/mutants/capitalcarriages.json` (16) and `tools/mutants/audit_capitalcarriages.json`
(32, two equivalent as recorded), all dead with `ARENA2_PATH` set. Audited the same day:
`01-Overview/audits/Audit-Capital-Carriages.md`. PINS MOVED: `test/audit_tesa.test.js` (the install line),
`test/world/baywalls.test.js` (the carrier's furniture), `test/ui/fb1004e_overworld.test.js` (the map's wheel);
re-aimed by content: AUDIT-TESA-A6-2-own-law-alone, AUDIT-TESA-A6-2-garden-open, AUDIT-TESA-A6-2-install-no-footprint,
AUDIT-TESA-II-C7-the-centre-carrier-alone, TESA10-models-every-block, TB-the-carrier-bare, TB-the-fallback-unlaid,
FB1028-Y1-the-carrier-laid-as-today. A driver's click not seen in a browser (the audit's lane P): pinned on the game's own reader and router.
