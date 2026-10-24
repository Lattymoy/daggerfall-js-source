# FIELD BUGS 2026-10-14 (INLAND-PORTS) - "Shipyard & light house near pond"

A thread from the bug-reports channel, 2026-10-14, handed over as two screenshots: the travel map over Ilessan Hills
("ILESSAN HILLS - The Charter of Ilessan Hills", the region's capital and a palace seat, its anchor drawn), and a night
scene of a lighthouse and a shipyard's timber standing beside a small pond. A second player: "That's actually kind of
awesome lol". Read on the code as it stands at main's `7c291d36`, and measured on the real ARENA2 (the freeware
DaggerfallGameFiles, `tools/fetch-data.sh`, outside the tree).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Shipyard & light house near pond" | the shipyard law stood the port's places in every town that is a port BY ITS DATA - and the data is no coast: Daggerfall's PortTownAndUnknown byte marks the region capitals with 0x10, Travel Options' table copied the byte's list, and a town with no sea stood both at its middle. 36 capitals in the hills and the deserts and 13 towns by a lake or a pond inland stood a shipyard and a lighthouse | fixed (INLAND-PORTS) |

## INLAND-PORTS: a port town is one the open sea bears on (1)

`src/world/portSites.js` openSeaOf, seaBears, portTownOnSea; `src/scenes/world.js` openSea, portOnSea, townPlacesFor,
navalPortList; `src/systems/portPlaces.js` (its words).

THE REPORT. Ilessan Hills is a city of the hills: no water of the map's within eight pixels of it (6.5 km). It stood the
SHIPYARDS places - its shipyard with the crew hall inside its fence, and "The Ilessan Hills Light" - at its middle,
where its own blocks hold ponds (eight of its forty-nine, the Mages Guild's beside the market at its middle).

FOUND. The shipyard law asked whether a town is a port and nothing else (`03-World/Shipyards.md` "Which towns"):
`isPortTown(dfLocation, portByData(dfLocation))`, the host's `portByData` being `portTownByData` - Travel Options'
harbours (`travelPorts.js hasPort`) or the byte not nought (`portPlaces.js:"export const portTownByData = (loc, hasPort) =>"`).
That reads DFU's own port-town data the way DFU reads it - `DaggerfallBankingWindow.cs` sells a ship wherever the byte
is not nought, the one read of it in DFU (`worldModes.js:"isPortTown: () => (buildingDirectory?.()?.portTownAndUnknown"`,
left as it is) - but a bank's ship is a deed, and a shipyard is timber on a shore. The byte is two things (FIELD BUGS
2026-10-13c measured it): its low four bits name the sides of a place water lies on, and 0x10 is the region capitals'
mark, on 39 cities. Hazelnut's table is the byte's 343 locations and 35 more, so it says the same. Then where the town
holds no sea of its own and the map shows none within SEA_RING, the placement's field fell to the town's middle
(`portSites.js:"return { kind: 'middle', at: (gx, gy) => Math.sqrt("`) and stood both there - in Ilessan Hills beside its
blocks' ponds. FIELD BUGS 2026-10-13c had named the 31 capitals with no sea within six pixels and left them to the owner;
the report is that case, played.

And the coast the map does show is not always the sea. The one water law (`overworldModel.js isWaterPixel`: CLIMATE.PAK's
Ocean or a WOODS.WLD height at sea level) is every water pixel the map draws - the Bay and the ocean, and 81 lakes and
ponds inland, one pixel to 54. A byte's low bits name a lake's side as readily as the sea's: Antyphyllos (a capital) and
Kaluhbia stood their shipyards against a one-pixel pond, Morascubia and Isfeho against a lake of 40 pixels no ship of the
Bay can reach.

FIXED, at the root:

- THE OPEN SEA (`portSites.js:"export function openSeaOf(isWater, width, height) {"`): the one water law's pixels flooded
  eight-way from the map's border - the flood Deep Waters' bake makes of the sea (`world/deepWater/deepWatersBake.js` COARSE: "the
  8-connected flood of candidates from the map's border - one component in the file, every inland lake left out"), a
  map pixel at a time. On the real map: one body of 179,926 pixels; the 81 lakes and ponds none of it. The host floods
  it once, the first time a town that is a port by its data asks (`world.js:"_openSea ??= openSeaOf(seaPixel, MAP_WIDTH, MAP_HEIGHT);"`,
  about 40 ms over the 500,000 pixels in Node), declared above the stream beside `seaPixel` (BOOT-TDZ); past the Veil it
  is the Eltheric Ocean's own water round its isles (each isle a hill of land in open water, `ethericSea.js isleByte`), so
  a freeport's town keeps its places.
- A PORT TOWN IS ONE THE OPEN SEA BEARS ON (`portSites.js:"export function portTownOnSea(loc, hasPort, isSea) {"`): a
  port by its data (`portTownByData`, unchanged) with a pixel of the open sea within SEA_RING of its own
  (`fortLaw.js:"export function seaBears(px, py, isSea) {"`, re-exported by `portSites.js` since FB1020c BERTH-RING) - the ring the placement reads its bearing off, so every
  port town has a seaward edge, Mac's "Town's seaward edge". The host asks it in both places a town's places are decided
  (`world.js:"const portOnSea = (dfLocation) =>"`: the pixel's build and `townPlacesFor`), and the bearing is read off the
  open sea too (`world.js:"const bearing = seaBearing(lp.x, lp.y, openSea);"`), so a lake behind a coastal town never
  turns its yard. The middle's field stays the yards' law for the case it was written for - the sea all round evenly - and
  no port town of the real map reaches it.
- THE HARBOUR BOARD'S PORTS ARE THE SAME TOWNS (`world.js:"if (!seaBears(at.x, at.y, openSea)) continue;"`): PORT-TOWNS
  made them the towns that stand the port's places, and they stay so - no harbourmaster keeps a board in a capital in the
  hills or by a lake inland.

WHAT MOVES, on the real map. Of the 155 towns that are ports by their data, 106 stand the port's places (and the board's
ports are those 106); 49 stand none now:

- 36 of the 39 capitals the byte's 0x10 marks (Daggerfall, Sentinel and Wayrest, two pixels off the sea, keep theirs):
  the 31 with no water within six pixels - Alik'ra, Alcaire, Anticlere, Abibon-gora, Ayasofya, Bhoriane, Daenia,
  Dragontail, Dwynnen, Ephesus, Gavaudon, Glenpoint, Glenumbra, Ilessan Hills, Kairou, Kambria, Koegria, Kozanset,
  Lainlyn, Menevia, Mournoth, Myrkwasa, Northmoor, Phrygias, Santaki, Satakalaam, Shalgora, Tigonus, Totambu,
  Wrothgaria, Ykalon - and Antyphyllos (a pond a pixel off), Bergama and Urvaius (lakes three and four off), Pothago and
  Tulune (the sea four and five off). Every one but Antyphyllos, which faced its pond, stood its places at its middle.
- 13 others: Cathlech, Isfeho, Kaluhbia, Mogahanu, Morascubia, Tuncart, Warvale, Whitebrone Hall, Whitewych Commons,
  Zagyry-Thar and Singbrugh by a lake or a pond inland (their bytes name its side - Singbrugh's on the Isle of Balfiera,
  the sea five pixels off); Blackhead on Balfiera and Whitefort on Betony, Hazelnut's extras, the sea five and four
  pixels off (Blackhead's own water reached its block grid's edge, with no bearing to tell it from a lake's).

No kept town's bearing moves (every one of the 106 reads the same bearing off the open sea as off the one water law), so
no standing shipyard moves. The harbour board's cargo ports - its ports with the sea within a pixel - go from 113 to 101:
the twelve by a lake.

WHAT A SAVE HOLDS. Nothing of a port's places is kept where they stood: a ship is laid up by her title in the Fleet's
book, `port` her last port's name alone (`fleet.js` setShipPort), and a laid-up ship is at hand at ANY shipyard
(`shipyardHost.js` "a laid-up ship is brought round"), so a ship bought at Ilessan Hills is fetched at the next port; one
afloat lies where she was placed. A recruit signed on is her deck's. A cargo held for one of the twelve lake ports is
void at the harbour office's next tick, no regard lost, and said ("Contract void - Cargo for Morascubia. No ship can make
port there." - PORT-TOWNS' `unported`, its own law). A shipyard found and marked on the map is a discovery of a key no
Daggerfall building holds: the town map letters the places that stand (`ports: b.portSites`), and the travel map's info
never counts it (`travelMapOptions.js` locationInfoRows asks IsNamedBuilding). Online, no service holds a port's place:
every client stands the same ones. Nothing to migrate.

THE HARBOUR OFFICE'S SEA (2026-10-15, Mac: "Fix harbour seaAt too"). The office's `seaAt` - a bounty's and a
salvage's site in open water off the board's port (`harbourBoard.js siteFor`), a treasure chart's cache
(`treasureCharts.js chartSite`), the sea beside a cargo's port (`deliveryPort`) and a held cargo's void - read the one
water law, lakes and all. It is the open sea now (`world.js:"seaAt: openSea,"`), and AUDIT CAPTAIN'S SEA B10's edge -
past the map only where the land beyond the Bay stands, the continent's sea, no lake in it (`tamrielGround.js
authoredHeightByte`: a province's land is SHORE_BYTE and up) - is the open sea's own
(`world.js:"if (!(x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT)) return tamrielLand"`). On the real map, with the
board's ports the 106, no site, cache or cargo port lay on a lake already (21,200 sites and 3,000 charts drawn, none);
the law asked a lake's water, and it no longer can.

EVERY READER OF THE SEA, read for the same fault (a lake taken for the sea):

- CHANGED: the shipyard law and the harbour board's ports (above); the harbour office's `seaAt` (above).
- CHECKED, NO LAKE ON THE REAL MAP: a raider's birth (`world.js` tvRaidOpen) and the serpent's site
  (`systems/serpent/serpentSite.js` over the lanes' water) ask a three by three of Ocean-climate water, which no lake holds - none
  of 174,723 birth pixels and none of 3,650 days' sites lies on one. Left as they stand.
- LEFT, THE LAKE HARBOURS (Mac, 2026-10-15: kept): the packet lanes' water (`world.js` laneOpen - the Ocean climate at
  the shore's byte) admits the 331 lake pixels that carry the Ocean climate, so the towns on a lake run packets on it (26
  lanes sail a lake, Morascubia's and Isfeho's among them) - their harbours' own traffic; its comment said "never a
  lake's" and says what it is now. Routing it through the open sea would drop 72 lanes - the 26 on a lake, and 46 that
  pair a lake's roadstead with another and were never sailed - and add 8 on the coast. The seats' Harbour (`net/fortLaw.js` coastalAt over the
  one water law, or a port of the mod's) - a members' harbour, a lake harbour where the water is a lake's (on the real
  map Eastcastle alone is coastal by a lake), and a funded work the account service holds.
- LEFT, NOT A SEA TEST: the maps' and the far ring's water drawn (`inkMap.js`, `farRing.js`, `overworldModel.js` - a lake
  is water to see), the Oblivion gate's land (`gateSite.js` - a lake is no land either), the crossing's distance to land
  (`world.js` crossLandPx - CROSS_LAND_PX, 20, is more than any lake's breadth), the Bay fitted to the picture
  (fitBayToPicture), the ships' own water (`navalIsWater`, the terrain's - a lake harbour's boats sail it), DFU's ship
  travel time and the professions' sea (`systems/travel/travel.js`, `foragingLaw.js`, `net/nodeLaw.js haulAtSea` - CLIMATE.PAK's
  Ocean, the service's law too), and Deep Waters' encounters (already the ocean's: `isOceanConnected`).

DECIDED NO (Mac, 2026-10-15) - each that law's own, and to stay so:

- Travel Options' table: the travel map's PORTS filter and its ship travel, the held map's anchors (PORT-MAP,
  `heldMap.js:"isPort: (s) => hasPort(s?.mapID ?? s?.mapId),"` - the anchor in the report's first screenshot) - the
  mod's own harbours, 1:1. Ilessan Hills keeps its anchor and its passage by ship.
- The lake harbours: Come Sail Away's port (`world.js:"const csaIsPortTown = (x, y) => {"`, DEED-PORT) - a deed
  placed, the merchantmen's water, the harbour book's soundings - so a lake town's harbour is sounded and a quay laid on
  its lake where the terrain holds one, the docks row with it, and its packets sail the lake (above). An inland
  capital's has no water within reach and none is sounded.
- DFU's bank (above).

THE FOUR HOSTS. `scenes/world.js` decides and stands the port's places (wired, above); `scenes/exterior.js`, the
single-town bench, stands no port (its own FLAGGED line in `scenes/portHost.js`); `scenes/worldModes.js` (interiors)
reads DFU's byte for the bank's ship alone (untouched); `scenes/dungeonContext.js` stands no town.

`test/systems/naval/fb1014_inlandports.test.js` (7): the open sea's flood (a channel round a corner the sea, a lake and a pond not,
every edge seeded); the ring (two off the sea, three not, its own pixel); the report's town - a capital on the table with
a pond beside it no port, Daggerfall's shape a port, a lake village none, a tomb on the sea none; the host's open sea
lifted off world.js and run (flooded once, the ether's water past the Veil, the continent's past the edge only with the
land beyond the Bay, nothing off the map else); the host's wiring and the board's list lifted and run; the harbour
office's `seaAt` lifted and run - 300 days of a board's bounties and salvages and 200 charts off a port with a lake in
their reach, never on it, and no cargo for a port by the lake; and on the real map (ARENA2_PATH) the counts above, the 49 by name, the kept towns'
bearings, and Ilessan Hills' old field - the town's middle - and its ponds. `test/systems/naval/fb1013c_porttowns.test.js` and
`test/systems/shipyards1_found.test.js` PIN MOVED (the board's ports and the shipyard law's towns the open sea's; the host's
words), and `test/systems/naval/auditcaptsea.test.js` (B10's edge the open sea's). `tools/mutants/fb1014_inlandports.json` 15/15 dead
(`auditcaptsea`'s ACS-B10-sea-at re-aimed at the open sea's edge, dead, and the 11 other records of `captboard`,
`capttrade`, `fb1013c_porttowns` and `shipyards1_audit` on the office's sea and the host's port test run again, dead); `shipyards1_audit`'s AUDIT-SHIPYARDS-the-host-asks-no-data
and -the-docks-wait-the-yards-test re-aimed by content, and the 26 records of `shipyards1`, `shipyards1_audit`,
`fb1013c_porttowns` and `carpyard1` aimed at the files this changed run again: all dead.
