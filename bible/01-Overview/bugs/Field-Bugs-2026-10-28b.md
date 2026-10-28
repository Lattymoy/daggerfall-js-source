# FIELD BUGS 2026-10-28b - the Tamriel integration: ships in circles, voyages stuck on the coast, coastal cities with no port

Three reports of the Tamriel integration, handed over by the owner in a session. Read on main's `c9651c3c8` with the
freeware's data (`tools/fetch-data.sh`). The pins are `test/world/worldWide/fb1028b_seasquare.test.js`, the mutants
`tools/mutants/fb1028b_seasquare.json` (15, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Ships dont navigate the coastline correctly. They go in circles" | A lane's roadstead past the Bay stood on land at the scale a hull floats on: 7 of the 26 lore ports' (capitals aside). A packet met the coast short of it, swung off and came back, round and round | SEA-SQUARE |
| 2 | "Port to port fast travel gets you stuck on coastlines" | A voyage's sailed runs past the Bay crossed land between their marks, on coasts and along the Niben; the helm made no way, the journey stopped and the passage's master tried again and again | SEA-SQUARE |
| 3 | "Several costal cities do not have ports" | Only a city the lore flags was a port. Six the picture stands beside the sea had no flag | COAST-PORT |

## The cause of 1 and 2: a byte is its square's corner (SEA-SQUARE)

WHAT DFU DOES. TerrainHelper's samples for map pixel (x, y) interpolate the small heightmap's control points between
columns x - 1 and x and rows y - 1 and y (`world/terrain/terrainSampler.js` kernelTerms). A WOODS byte is the height at
its square's south-east corner. The square's middle is the four corners' ground.

WHAT THE PORT DID. The lanes past the Bay (`scenes/naval/worldLanes.js` worldLaneWater) and the voyage planner
(`systems/travel/travelRoute.js`) read byte (x, y) as square (x, y)'s water. In open sea that is the same. On a coast,
in a cove or in a channel one byte wide it is not. Measured on 972 coastal squares past the Bay: a square its own byte
calls water is 76.5% water tiles, its middle water 68.4% of the time; a square whose four corner bytes are water is 100%
and 100%. The Niben below Lake Rumare is one byte wide: along it each square is about 40% water and its middle land.

A probe in Node builds each pixel's tiles with the game's kernel (`generatePixelTerrain`). Checked against the running
game's own build of seven pixels (Gilane's roadstead, the Niben, Rihad's and Haven's water, a Bay town), it agreed tile
for tile.

## Ships going in circles (1)

FOUND. Real lane packets were driven through the naval host (`test/navalSea.mjs`) over those tiles. Gilane's roadstead,
the middle of pixel (337, 693), stands 250 m inside the land: 13% of that square is water. A packet bound there met the
coast a kilometre short, swung 115 degrees off, came back, and turned through 190 to 240 degrees again and again. She
never came within LINER_PORT_M (500 m) of her leg's end, so she never made port and never left. The roadsteads of
Gilane, Rihad, Necrom, Haven, Southpoint, Lilmoth and Soulrest all stood on land.

FIXED. Past the Bay a pixel is the lanes' water where its four corner bytes are (`terrainSampler.js` squareCornersAll).
The Imperial City's lake, which its plan stamps, counts at a corner. A roadstead past the Bay is the roomiest pixel of
its ring (`systems/naval/seaLanes.js` roadsteadOf `roomy`). The Imperial City's first nearest sat on its canal's west
bank, and its lanes to Senchal and Torval found no way. The Bay's lanes and roadsteads are as they were.

MEASURED AFTER. Every roadstead past the Bay floats a hull. A packet stood every 8 km along every lane's way, both ways,
and 3 km short of every port: none circles and none touches land. The lanes that find no way are the two they were
(Vivec - Ebonheart, Senchal - Torval). The probe's terrain does not stamp the Imperial City's mouth, so the last
kilometre into its lake is RUMARE-WATER's own pin, not this one.

## Voyages stuck on the coast (2)

FOUND. A booked passage, or a boat's own journey, sails the planner's legs (OWS2, PASSAGE-IN). PASSAGE-IN aimed a leg at
its square's middle, or at the nearest water there that floats her. Planned between every pair of ports a lane joins
past the Bay, the straight runs between those marks crossed land in 31 of the 70 voyages, up to kilometres of it (along
the Niben, 53 km; Rihad to Taneth, 25 legs). The helm turns off land and back to its mark. After 180 s with no gain the journey stops ("Your boat can make no
way toward its mark"), and the passage's master tries again every 20 s.

FIXED. Past the Bay a sailed leg, and a launch, is aimed in a window a pixel wide centred on its byte
(`systems/travel/seaMark.js` seaLegWindow). The planner's water is the byte's, so a byte's own point is water.
PASSAGE-IN's fallback (the nearest 5 by 5 tiles that float her) works inside the window. Its ground is built when the
four squares about that point are (`seaLegBuiltAt`), and Travel Options asks the same before it aims a leg again
(`travelOptions.js` seaLegBuilt). On the Bay a leg is aimed as before.

MEASURED AFTER. The same 70 voyages, through the real aim: no sailed run over land. A landfall's
run ends on its shore, as it should.

NOT CHANGED. The route's drawn line still joins the pixels' middles, a little off the course on a coast. The Bay's
voyages keep PASSAGE-IN's square: the byte's corner is DFU's there too, and moving them is the owner's call.

## Coastal cities with no port (3) (COAST-PORT)

FOUND. A place past the Bay was a port only where TAMRIEL1 flags it (`world/tamriel/tamrielGeography.js` CITIES'
`port`). Six cities the picture stands beside the sea had no flag: Farrun, Shornhelm, Blacklight, Tear, Thorn and Elden
Root. They had no harbour, no shipyard, no packets and no passage.

FIXED. A place the open sea bears on is a port, whatever the lore says (`world/arenaPlaces.js` standArenaPixels): the
picture's sea, its lakes left out, within SEA_RING (2), the ring the shipyard and the harbour board read
(`net/fortLaw.js` seaBears). It stands where it stood. 35 places are ports (28 before), 36 with the Imperial City's
Waterfront: the six cities and Silinorin, a village of Sumurset. Each has a voyage to and from Daggerfall, and six
berths whose ships stand clear of its walls on water (PORT-SHIPS). The lanes
past the Bay with a way go from 20 to 31.

NOT CHANGED. Ald'ruhn stands three pixels from the sea, past the ring. Anvil and Leyawiin stay inland on this picture
(`03-World/Arena-Provinces.md` TESA12). The relay and the account service read no port past the Bay.

## Pins

`fb1028b_seasquare.test.js` (9): the kernel's square and the corner law, the lanes' water, the roomy roadstead (and the
crossing lanes'), the aim's window and Travel Options' aim; the coast's ports; and on the freeware every roadstead,
three voyages, a packet bound for Gilane and the seven new ports.

PINS MOVED: `audittesa2p_hosts.test.js`, `auditstarts.test.js`, `start2_provinces.test.js`, `tesa12_places.test.js`,
`tesa2_arena.test.js` and `tesa6_ports.test.js` (a lore port on its shore, a coast port where it stood),
`portships_real.test.js` (every new harbour's six berths stand; Silinorin, a village, has no walls to keep),
`audittesa2p_world.test.js`, `nibensea.test.js` and `rumarewater.test.js` (the host's roomy roadstead),
`smoothland.test.js`, `bayleftsea_harbour.test.js` and `ww7_cross.test.js` (a sandbar's eleven bytes shut twelve
squares). Mutant records re-aimed by content: `audittesa2p.json`, `fb1021d_passage.json`, `ows2.json`,
`rumarewater.json`, `sealanes.json`, `tesa12.json`, `tesa6.json` and `ww3.json`.

`01-Overview/Port-Ledger.md` A, SEA-SQUARE and COAST-PORT.
