# AUDIT-TESA (2026-10-13) - the Arena arc, audited

The owner, of everything the Arena arc had built (`03-World/Arena-Provinces.md`: TESA1 to TESA10d - Arena's places,
the provinces' names and people, the roads and their crossings, the ports, the countryside, the lairs and the seven
capitals): **"Lets do a comprehensive audit across everything so far. Additionally, fast travel shouldnt be a thing
since we use portal stones online or the player can traverse using the overworld"**. The second half was done first, as
its own change (TESA-NO-FAST, `03-World/Arena-Provinces.md` TESA2's journey: the map past the Bay is a portal's end on
the teleport map alone). This page is the audit's findings, each with its verdict. What the audit changed is written into
the arc's page as it now stands, under the finding's id, and the code says the same at every site (`AUDIT-TESA <id>`).

## How it was run

Seven lanes, each a cold reader of the arc at the TESA-NO-FAST head (dbf19b5eb), told to reproduce a finding before
reporting it and to cite the code by its text:

| Lane | Over |
|---|---|
| A1 - the data and the wire | Arena's files (the doctrine's second game), what of them a save, the relay or a shared map carries; the card, the notices |
| A2 - quests, the world's doors | a quest's site past the Bay, the portal, the rise after a death, the people's names, every read keyed by a Bay pixel's id |
| A3 - the roads | TESA4 and TESA5: the towns routed, the layer's stamps, the crossings, the paint |
| A4 - the ports | TESA6: the harbours, the docks' book, the ships' gates, the capital's pixel search |
| A5 - the countryside and the lairs | TESA7 and TESA8: the ground they stand on, the land moving under them, the deeds |
| A6 - the capitals' ground | TESA10 to TESA10c: the plans, the blocks, the landmarks against the blocks they stand over |
| A7 - the hosts and the record | the boot, the loads, the sweeps, the ink, the switches, the costs, the pages and the pins |

The lead verified every finding again against the tree before it was fixed, and fixed it in three waves by severity.

## The findings

**Wave 1 - high: a promise broken where the player stands.**

| Id | Finding | Verdict |
|---|---|---|
| A1-1 | An Arena place's NAME rode the wire: the party's shared automap keyed an Arena dungeon by its name (`automapKeyOf`), and the party pose sent `loc: loc.name` from inside one - the doctrine's "nothing of it crosses the wire" | FIXED - an Arena place keys by its map id (`arena#<id>`), the pose sends none; a capital's name is the port's own and stays |
| A1-2 | ...and rode SAVES: entering an Arena place, or a quest revealing one, discovered it under its name (the realm's and the cloud's records) | FIXED - discovered by its map id alone |
| A2-1 | A quest's site past the Bay was asked of MAPS.BSA alone: the reveal threw (an Arena town's guild job was removed with it), the clock had no travel time, the respawn no site | FIXED - `placeByName`: MAPS.BSA's first, else the place the world stands (an isle's, an Arena place, the countryside's, a lair, a capital), for the reveal, the clock and the respawn |
| A6-1 | No capital carried a start marker - a portal's or a load's arrival fell to the block's middle, in the Imperial City onto the Tower's foot | FIXED - every capital's carrier block carries three or four editor flats on its own open ground; since AUDIT TESA II C7 every slice's carrier its own (the Imperial City's outer eight carried none) |

**Wave 2 - medium: wrong in a corner a player reaches.**

| Id | Finding | Verdict |
|---|---|---|
| A7-1 / A5-F1 / A2-6 | A load waited for the trace only when Arena's places stood - a capital or the countryside built on the authored shape and moved under the player; the land moving re-rolled no country place or lair; the countryside's ground kept its reads across fits | FIXED - the wait whenever any place past the Bay stands; the sweep rolls them again once the land moves; the ground's cache kept a fit and a land |
| A2-4 / A7-3 / A5-F2 | A death past the Bay rose by the clamp's region, the Alik'r Desert's, a continent away; an underground wake likewise | FIXED - the nearest town the world stands past the Bay (48 pixels' reach), else where they fell; a dungeon's wake at its own door |
| A3-1 / A4-F1 | A town on the shore whose road window's cell centre was the sea was never routed - most of TESA6's ports, and the shore capitals | FIXED - a town's own cell is its land at its own height (`ARENA_ROADS_VERSION` 2) |
| A4-F2 | A capital's pixel could be cloned over by its own Arena place; its slot kept a stale port; the harbour book asked the Arena place, not the capital | FIXED |
| A4-F3 | The harbour book keyed an Arena port by a string the Docks row and the wait never read back | FIXED - by its map id, as `docksBerthOf` reads it |
| A2-2 | A Portal Stone's record past the Bay was refused by the wire's Bay bound; its name read a Bay row | FIXED - the world's bound (`worldPixelOk`); named by the place standing there, else its province |
| A2-3 | Reads keyed by a Bay pixel's id (`y * 1000 + x`) answered a Bay row for a pixel past the Bay - the living towns, the ports, the travel summaries | FIXED - every such read asks the Bay's pixels alone; past the Bay the place itself answers, once discovered |
| A2-5 | Past the Bay a town's walkers, a building's people and a tavern's regulars were named by the clamp's region's bank - Redguards in Skyrim | FIXED - TESA3's province bank, the region's on the Bay |
| A6-2 | A capital's walls stood over its garden blocks - one garden block shared by every capital, open ground under the walls, trees in them - and, found wider on fixing, over its own blocks where their hand-written laws missed a wall's line | FIXED - each capital's gardens its own blocks; every one of its blocks closes its automap where its models stand at a body's height (`capitalFootprint`: the steep faces cut at 0.5, 1 and 1.6 m, diagonals joined) and keeps its trees off them; the gates measured open. Every block is built when first read, so the boot pays none of it (A7-6) |
| A7-2 | The data tests (run where ARENA_PATH and ARENA2_PATH name the player's files) still held TESA2's "every place under its own point" and TESA4's road counts | tesa2's FIXED (a capital's place on the capital); tesa4's road counts RETIRED (AUDIT TESA II R12) - TESA14 retired TESA4's network and the pin that held its counts |

**Wave 3 - low: the record, the costs, the edges.**

| Id | Finding | Verdict |
|---|---|---|
| A1-3 | `.gitignore` named ARENA2 but not Arena's folder or files | FIXED - `/ARENA/`, `CITYDATA.*`, `A.EXE`, `ACD.EXE` (the root's folder alone: `vendor/daggerfall-arena/Arena/` is the port's own) |
| A1-4 | `test/tesa1_arena.test.js` carries a few of CITYDATA.65's rectangles as literals | THE OWNER'S CALL - a handful of numbers to check a reader against is how every reader here is pinned, but they are read out of Arena's file; kept until the owner says; RESOLVED by TESA12 (2026-10-13): the file DELETED with the reader it pinned, Arena unread |
| A1-5 | The Arena card says the data is attached under `?arenaplaces=off` | STANDS - it is attached; the door is a URL's for a day the fit reads a place wrong, not a player's switch, and the card cannot read it without the scene module |
| A1-6 | The attach notice said nothing when the folder held no A.EXE | FIXED - it says what that costs: no ports, and online no places |
| A3-2 | The road to the Imperial City ends at its pixel's corner, on the lake | FIXED by AUDIT TESA II C1 (2026-10-25) - the road ends at the city's 'W' gate (TESA14, IC-RING), and Talos Bridge comes down to the rim's inner edge, where Daggerfall's blend runs the land down to the road's end with no seam (it stood 41.5 to 43.6 m over it; `03-World/Arena-Provinces.md` TESA10's rim) |
| A3-3 | The roads' layer stamp on a built pixel | OPEN - re-read: the stamp is set as the layer is posted to the worker, ahead of every job after it; no pixel stamped newer than its paint was reproduced - left for a probe, not a fix |
| A3-4 | With Basic Roads on, Arena's roads wait for the Bay's network with no end | CLOSED (AUDIT TESA II R12) - the wait ends: TESA14's host waits only while the Bay's network is on its way (`hasRoads` with none yet), and `hasRoads` drops when our build answers none; a dead terrain worker's build is `_roadsFallback`'s |
| A3-5 | A road can paint a tile of the sea at a shore town | RECORDED |
| A4-F4 | Under Travel Options a ship past the Bay was asked of its hand-written ports - none there | FIXED - by its Arena place's port |
| A4-F5 / A7-5 | A capital's pixel search walked the whole square of every ring - (2r + 1)^2 a ring, out to 320 | FIXED - the ring's own cells, the same in the same order |
| A5-F3 | The quest layer's house read (`ownsHouse`) was not gated as the interior's is | FIXED - no deed read in a place the port made |
| A6-3 | The Imperial City's wall towers stood up to 5.8 m into a house's block, Solitude's walls 2 m, Helstrom's boardwalks 4 m | FIXED - the apothem 317, Solitude's walls out, the walks half a metre onto each bank; pinned by every vertex below 30 m |
| A6-4 | An inland capital laid a CUST block with its canal (Mournhold) | FIXED - an inland capital's CUST kept to its dry blocks (`dryKinds`) |
| A6-5 | A closed automap cell's byte was 1 - BuildingType 0 + 1, drawn and pressed as a shop on the town map | FIXED - `CAPITAL_CLOSED_BYTE` 0xfe, in no quarter |
| - | The capitals' port blocks sat at 900200, the Shadow Realm's | FIXED - from 900400; from 901000 since AUDIT TESA II C13 (900400 was the Sky-Ketch's on main, `world/ketch/ketchShip.js` KT_SHIP_BLOCK_INDEX; every fixed index in the tree swept apart, `test/world/audittesa2c_capitals.test.js`) |
| A7-4 | With Arena, a capital's place was inked at its own point, a pixel or more from the city | FIXED - inked on its pixel |
| A7-6 | `installCapitals` built every capital's blocks at boot | FIXED by A6-2 - the blocks are built when read; the install is 7.5 ms |
| A7-7 | Pages and comments still said the map journeys past the Bay | FIXED - Port-Ledger, Active-Arcs, Arena-Provinces, Testing.md's tesa2 row, tesa2's title, the comments |
| A7-8 | The capitals' and the countryside's kill doors shut online too - one player's land unlike the room's | FIXED - offline alone, as the forests' door. Arena's places stay the player's own: attached or not is already each player's |
| - | The Etheric isles' docks key has A4-F3's mismatch | NOT THIS ARC'S - on main too; recorded for the Etheric Sea's page |

Found while fixing, not by a lane: a shore capital is a port only through its Arena place (`csaIsPortTown` past the Bay
asks Arena's ports), so without Arena attached Solitude, Alinor and Torval have docks no ship sails from. OPEN - the
owner's call whether the capitals are ports of their own. RESOLVED (AUDIT TESA II, 2026-10-25): since TESA12 the places
past the Bay are the port's own and stand Arena or none, and the place pinned on each shore capital is a port; with C2
their harbours meet the sea (at its floor, over the sea pixel off Alinor's and Torval's harbours).

## The pins

`test/audit_tesa.test.js` (20): each fixed finding by its behaviour where it can be run (the automap key, `placeByName`
and the rise lifted out of `scenes/world.js` and run, the start markers read back through the flats' reader, a shore
town routed, the gardens' names and indices, the footprint on made faces and on every capital's models, the gates open,
the markers off the walls, every block's closed cells and trees, the ring walk against the square's, every landmark
vertex clear of a house's block, the dry kinds, the closed byte's quarter) and by source where it is a host's wiring.
`tools/mutants/audittesa.json` (56, all dead; 54 since TESA11, which retired the 8 x 8 Imperial City's two - its wall at 317 m is the nine-pixel city's wall at 900 m now, `03-World/Arena-Provinces.md` TESA11). PIN MOVED, each by its finding: `test/systems/audit23_hosts.test.js`,
`test/systems/audit26_talk.test.js`, `test/systems/auditrr2.test.js`, `test/systems/superDungeon/sd2d_castout.test.js`, `test/ui/seat2b_peace_client.test.js`, `test/systems/quest/audit28_smallerdungeons.test.js`, `test/systems/naval/auditcaptsea.test.js`,
`test/systems/quest/auditdisc28_quests.test.js`, `test/scenes/citedrift.test.js`, `test/systems/travel/disc28e_shipport.test.js`,
`test/world/etherplaces.test.js`, `test/systems/portal1_stone.test.js`, `test/systems/quest/qrepair.test.js`, `test/tesa1_arena.test.js` (DELETED by TESA12),
`test/tesa2_arena.test.js`, `test/tesa6_ports.test.js`, `test/tesa10_capitals.test.js`, `test/tesa10c_capitals.test.js`.
Re-aimed by content, each judged dead again: seventeen records in `auditcaptsea`, `auditdisc28_quests`, `etherplaces`,
`portal1`, `tesa1`, `tesa6`, `tesa7`, `tesa10` and `tesa10c`.
