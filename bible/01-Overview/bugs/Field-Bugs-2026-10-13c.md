# FIELD BUGS 2026-10-13c - "Even the port quests sending you to non port places"

The owner's report, 2026-10-13, in a session: "Bug: Even the port quests sending you to non port places". Read on the
code as it stands at main's `3f66ff06`, and measured on the real ARENA2 (the freeware DaggerfallGameFiles,
`tools/fetch-data.sh`, outside the tree).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Even the port quests sending you to non port places" (the owner) | the harbourmaster's board (CAPT-BOARD) read Travel Options' port table - every place a ship may put in at - as the map's ports: 223 of its 378 are tombs, farms, inns, temples, manors, graveyards and ruins, and 31 of the region capitals on it stand with no sea within six pixels. Of the cargoes the towns' boards posted, 71% went where no harbourmaster keeps a quay | fixed (PORT-TOWNS) |

## PORT-TOWNS: a port is a town, and a cargo goes to one on the sea (1)

`src/scenes/world.js` navalPortList; `src/systems/portPlaces.js` isPortTownType; `src/systems/naval/harbourBoard.js`
deliveryPort, advance; `src/scenes/harbourOffice.js` tick, event; `src/systems/naval/captainLedger.js` contractEvent.

THE REPORT. The port's quests are the harbourmaster's contracts (`03-World/Captains-Sea.md` CAPT-BOARD), and of their
five kinds the cargo is the one that names a place: "Cargo for X - to X's harbourmaster within N days". A bounty and a
salvage are sited in open water off the board's own port, a hunt and a survey in the crown's waters.

FOUND. The board's ports - the port a captain lies at (`navalPortHere`, the nearest within a map pixel), a cargo's
destinations (`boardFor`'s `ports`), a treasure chart's port - were `navalPortList`: every entry of Travel Options'
`portLocationIds` (`systems/travel/travelPorts.js`), read as "every port of the map". That table is not the map's harbours:

- Its main block is exactly MAPS.BSA's 343 locations whose PortTownAndUnknown byte is not nought, and the byte flags any
  place on the coast. Of the table's 378 distinct entries 223 are not towns: 39 labyrinths (Corranoth's Tomb, the
  Masoleum of Darkivaron, the Prison of Grictke), 33 farms, 27 manors and halls, 27 inns and taverns, 22 ruins, 21 shacks
  and hovels, 19 keeps, 17 temples, 10 graveyards and 8 cult sites. 155 are cities, towns and villages.
- The byte is two things. Its low four bits name sides of a place the sea lies on - east 1, south 2, west 4, north 8:
  every one of the 304 locations that carry one has the sea on each side its bits name (291 exactly the sides it has).
  0x10 is the region capitals' mark: 39 cities, none of them carrying a low bit, and 31 of them with no sea within six
  pixels (Wrothgaria, Dragontail, Alik'ra, Dwynnen...); Daggerfall, Sentinel and Wayrest stand two pixels off it. DFU's
  `PortTownAndUnknown != 0` reads every one of them as a port, and Hazelnut's table copied the byte's list.
- So a cargo was drawn among the six nearest of those "ports" DELIVERY_PX_MIN or more off. Over 30 days of every town's
  board (155 boards, 3,271 cargoes): 1,980 (60.5%) for a place that is no town - The V'uchin Farmstead, Kieran Theatre,
  Djen Lodge, the Moorwing Cemetery, the Grave of Lithogheon - 351 (10.7%) for a town with no sea beside it (Glenumbra
  among the most), and 940 (28.7%) for a port on the sea. A cargo for a tomb on the coast could be delivered by lying
  slow within a pixel of it (the berth asks only that her boat lie slow in a port's waters, `navalHost.js yardHere`, and
  a flagged tomb's are a port's to Come Sail Away); one for an inland capital never could, and failed at its term with
  STANDING_FAILED.
- And a board stood at such a place: the nearest of the 378 within a pixel was the port lain at, so a captain off a
  tomb's or a farm's water read the tomb's name over its harbourmaster's tab.

FIXED, at the root of each:

- THE BOARD'S PORTS ARE TOWNS. `navalPortList` keeps the table's cities, towns and villages (`portPlaces.js
  isPortTownType`, PORT_TOWN_TYPES - the half of the shipyard law's `isPortTown` a map summary answers alone). Every
  entry is a port by its data (the table is `hasPort`), so the list is exactly the towns that stand the port's places -
  the shipyard, the crew hall, the lighthouse and the docks the player sees on the maps: 155, pinned on the real map both
  ways. A tomb's or a farm's water has no harbourmaster now.
- A CARGO GOES TO A PORT ON THE SEA. `harbourBoard.js deliveryPort`: a board port whose own map pixel or one of the
  eight about it is sea (`seaAt`, the world's - `isWaterPixel`; `net/fortLaw.js coastalAt`, the coast's one law, the
  seats' Harbour's), where a ship lies within the berth's reach of one pixel. 113 of the 155, and every one of them
  answers to its own name from a sea pixel beside it (`navalPortHere`'s nearest, no neighbouring port first). A cargo is
  drawn among those alone, and a board with none far enough posts none.
- A CARGO ALREADY HELD FOR NO SUCH PORT IS VOID. A save holds the board's cargoes two days and more of the captain's own
  clock, and one for a tomb could not be delivered now. The harbour office's tick voids each - `advance`'s
  `{ type: 'unported', port }`, the bounty's void beside it (AUDIT CAPTAIN'S SEA B4): off the list, no regard lost - and
  says it: "Contract void - Cargo for Corranoth's Tomb. No ship can make port there." (the text core's
  `sea.board.cargoVoid`, drafted in the thirteen whole languages). It asks only once the map's ports and the sea stand.

After: the same 30 days, the same 3,271 cargoes, every one for a port on the sea.

THE LINE DRAWN. The berth's reach is a map pixel, and the map can promise a ship there only where a sea pixel lies
within it. Measured against the terrain (DFU's kernel as the port runs it - `world/terrain/terrainSampler.js` generateSamples,
`world/terrain/terrainTiles.js` generateTileData - which Deep Waters carves only where it put water): 111 of the 113 have water
within a pixel. The two that do not, Kaluhbia and Whitewych Commons, face a one-pixel pond the map marks as sea and the
kernel smooths away - the one water law's own reading, left as it stands. Sentinel and Wayrest stand two pixels off the
sea and the kernel puts water within a pixel of both (683 m and 1,074 m off their footprints); Daggerfall's is 1.5 km
off. The three stay the board's ports - a captain who lies there reads their boards - and take no cargo: the map cannot
tell Sentinel's inlet from Daggerfall's dry shore.

NOT TOUCHED - the same table and byte read by other laws, each that law's own:

- Come Sail Away's deed (DEED-PORT, `csaIsPortTown`), the merchantmen's water (`navalNearPort`) and the harbour SHIP-LIFE
  sounds (`navalHarbourNear`) read the table and the byte as the mod does: a ship may be put in the water, and a quay is
  sought, at a flagged farm or tomb on the coast.
- The shipyard law (`isPortTown`) stood a shipyard and a lighthouse in every town on the table - the 31 inland capitals
  among them, at the town's middle where no sea bears on it. Closed by INLAND-PORTS
  (`01-Overview/bugs/Field-Bugs-2026-10-14-inland-ports.md`, a player: "Shipyard & light house near pond" - Ilessan Hills):
  a port town is one the open sea bears on, and the board's ports are the same towns - 106 of the 155 here, 101 of them
  taking a cargo.
- CAPT-WATERS' distance from the nearest port (`navalPortPx`) reads the table's pixels.

`test/systems/naval/fb1013c_porttowns.test.js` (6): the host's port list and port-here lifted off world.js over eight of the table's
harbours - three towns its ports, no tomb, farm, inn, temple or graveyard; the delivery law and 300 days of a board; a
held cargo's void, said once and in French; the world's wiring; and on the real map (ARENA2_PATH) the counts above and
the byte's two readings. `tools/mutants/fb1013c_porttowns.json` 13/13 dead. Re-aimed by content, all dead: auditcaptsea
ACS-B4-said, captboard BOARD-delivery-near, shipyards1 SHIPYARDS-every-town-a-port; the 161 records aimed at
harbourBoard.js, harbourOffice.js, portPlaces.js and captainLedger.js run again, all dead.
