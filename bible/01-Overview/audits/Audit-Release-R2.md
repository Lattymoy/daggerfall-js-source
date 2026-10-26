# AUDIT RELEASE, lane R2 (2026-10-26) - the Bay's assumptions in every other system, past the Bay

The owner, before the release that carries TESA (the land past the Iliac Bay, all of Tamriel - branch
`ccr-f9503f62-d9h2m1` at 367cf11766): **"I want to do a comprehensive audit to ensure everything is perfect and that
everything is covered for a smooth release that expands our world seamlessly. All systems should be integrated
precisely"**. The game was built for Daggerfall's Iliac Bay - one map of 1000 x 500 pixels, 62 regions, MAPS.BSA's
fifteen thousand places - and a player can now walk, ride, sail or be carried to any province. Lane R2 read every system
for what it still assumes of the Bay, and held each against what this branch's records already decided past it
(`03-World/World-Wide.md` - WW-R's provinces as regions 62..70, WW1's areas, WW7's people; `03-World/Arena-Provinces.md` -
TESA3, TESA-NO-FAST, TESA12's places; `03-World/Tamriel.md` - the frame). Lane R1 read the seams between the eleven streams
the branch merged; three streams were still changing their files (the Imperial City, the coast's smoothing, R1's seams), so a
finding there would be routed, not fixed - none was. The code says what each fix changed at its site, marked
`AUDIT RELEASE R2-<n>`.

## How it was run

- **The order a player meets it past the Bay** (the coordinator's, for a release the same day): saves and their load,
  death and the rise, travel and the map, quests and their givers, shops, banks and guilds, courts and the watch, then
  the rest. A release blocker (a throw, a softlock, a lost save or item, a socket closed) first.
- **A mechanical sweep for the Bay's bounds**: `62`, `< 61`, `regionCount`, `REGION_COUNT`, `BAY_REGION_COUNT`, the tables
  indexed by region (`REGION_TEMPLES`, `REGION_CELEBRATING_HOLIDAY`, `MENU_KEY_BY_REGION`, `REGION_BACKGROUND_CHARS`,
  `KNIGHTLY_ORDER_REGIONS`), `maps.getRegion(r)` without a guard, `y * 1000 + x`, `0, 999` / `0, 499` on every validator of
  `src/net/` (the relay's and the account service's law), `MAX_MAP_PIXEL_X`, and `spawnedMapId`'s throw - then each hit
  read to its consumer and decided with evidence.
- **Probes at the capitals' pixels** (the authored fit, as the suite runs it): Solitude (1688, -488) north of the Bay,
  the Imperial City (2344, 881) east of it, Alinor (-150, 1912) west and south - every axis past the Bay's rectangle once.
  Each finding's pin builds its fixture there, through the producer the game runs (the wire's own projection, the relay's
  parse, a real `OnlineSession` over the fake socket, the quest layer `createQuestWorld` makes, the talk's `TopicTree`).
- **SMOOTH-LAND landed mid-audit** (ad2a8d71de, merged in): the provinces' labels are the land's law now
  (`world/tamriel/tamrielLand.js` landLaw), and land that names no province is NO_PROVINCE - which `theatreAt` would read
  as the sea's theatre, and the politic map then as POLITIC.PAK's off-map answer (a region of the Bay's by the clamp).
  Measured on the freeware's own picture (ARENA2, the fit (38, 57) x 15.5), every map pixel of the frame past the Bay:
  5,989,200 land pixels, none of them without a theatre. Every finding here reads the region through the theatre, and
  every pin and probe was run again on the merged head.

## The findings

| Id | Sev | Finding | Status |
|---|---|---|---|
| R2-1 | MED | Staff could not `/tp` to a player past the Bay - Cyrodiil's open zone among them: the target's game answered `unavailable`, and a where note there was a note "this build could not place" | FIXED and pinned |
| R2-2 | MED | An Elite Breach opened past the Bay staked its Weir Key (or the day's Rehearsal) and never sent its `open`: the wire refused the arch's site, and the key came back by its void a minute later | FIXED and pinned |
| R2-3 | LOW | GRAVE-PARTY's own field bug, past the Bay: a lair's headstone there was owed to no cell, so a partymate searched it again | FIXED and pinned |
| R2-4 | MED | The quest layer's region name was `''` past the Bay: no NPC there knew a quest's place or person there (START3's province starts among them), and "Where am I?" in a lair said "in ." | FIXED and pinned |
| R2-5 | MED | A quest giver past the Bay has no remote site to give: every quest that wants another town or a dungeon parses to no work (a guild's "no work", a Daedra's "no task here, keep your gold") | TAKEN - the proposal built, FIXED and pinned (below) |
| R2-6 | LOW | A vampire turned past the Bay is not carried to a cemetery (the region's MAPS rows are the transfer's search) | RECORDED (DFU throws where a region holds none) - proposal below |
| R2-7 | LOW | A staff event cannot be staged past the Bay: its place's pixel is the Bay's (`staffEventLaw.js`), the place picker lists no province's places, and the event runs as a raid, which is the Bay's until WW6 | RECORDED - WW6's |
| R2-8 | LOW | A POI (the builder's tool) stands on the Bay's map alone: its law, its id `py * 1000 + px` and its feed's key | RECORDED - proposal below |
| R2-9 | NOTE | A deed in one of a capital's slices (the Imperial City is 25 pixels, each slice its own map id) is DFU's (region, key) law: a house of the same key in another slice of the same capital would read as owned | NOT REPRODUCED - routed to the Imperial City's stream |

And the older relay, for R2-1 to R2-3 (part of each fix): the relay before the world-wide one reads the Bay's map alone in
these three words and closes the socket on one that names a pixel past it. The session says each only to a relay that
reads it (`src/net/online.js:"export const bayMapPixel"`, `worldPixelsOk` - `relaySupportsWorldWide`, the branch's one
world-wide number): a staff answer past the Bay is `unavailable` there, an arch past the Bay is refused at the key before
anything is staked ("There is no room for it here."), and a headstone past the Bay is not said.

### R2-1 - staff /tp past the Bay (FIXED)

`src/net/staffTeleport.js:"const pixel = (v) => v && worldPixelOk(v.x) && worldPixelOk(v.y);"`. STAFF-TP's destination law
held a pixel to 0..999 x 0..499. Past the Bay the target's game built its destination and threw it away
(`scenes/world.js` staffDestination's `validStaffDestination`, then `{ error: 'unavailable' }`), the hub's where note there
was "a pixel off the map" (`notePlace`), and the relay's projection of an answer (`wire.js parseClient` ->
`validStaffTeleportIn`) would have refused it whole. So no Admin, Shadow Fang or Dungeon Master could reach a player in
Cyrodiil's open zone - the one place past the Bay where the release puts players against each other. The pixel is the
world's (`wire.js worldPixelOk`, WORLD_PIXEL_BOUND either side of the Bay's corner - TV-BEYOND's, the pose's own), on the
client and the relay alike; the landing was already the world's (`_teleportToPixel` streams the land past the Bay, and
an unstreamed pixel lands where the world stands). The Abyss destination keeps the Bay's map: the Hollows are the Bay's
(WW-R).

### R2-2 - an Elite Breach past the Bay (FIXED)

`src/net/wire.js:"export function egSite(s) {"`, `src/net/online.js:"egSiteOk(site) {"`. The arch stands where the opener
stands (`egArchPlace`, the Portal Stone's place ahead of them) and the host names its site at any pixel
(`scenes/world.js` egKeyFacts), but the wire's site law was the Bay's map. Past the Bay: the key's refusals all passed,
the account service staked the key (`account.open`), and the hub's `open` failed `validEgIn` in the session itself
(`sendEg` answers false), so it was asked again each frame and never sent; EG-ZA's void handed the key back after
EG_VOID_WAIT_MS ("The breach failed to hold. Your key is returned."). Nothing was lost, but the breach the owner's
world-wide arc means to open anywhere could not be opened past the Bay at all. The site is the world's pixel now - the
open, the call the hub signs (`egCallSig.js` signs the pixel as it is), the room's kept site, a stranger's arch word -
and the cast-out's landing at the site is the world's teleport. Decided here (the owner's to overrule): an arch may
stand anywhere the world streams; WW-R's and WW7's law is that what lives on the Bay lives past it.

### R2-3 - a headstone past the Bay (FIXED)

`src/scenes/searchPartyHost.js:"export const GRAVE_LOC_RE"`, `src/net/wire.js:"export function owGraveIn(r) {"`. TESA8's
lairs include graveyards past the Bay, and their headstones are searched as the Bay's are (SEARCH1). GRAVE-PARTY owes a
search to the cell (`[px, py, n]`), read back from the stone's place `g<px>,<py>` - by a pattern of three unsigned digits,
so `g-150,1912` was no row and owed nowhere; and the wire's row was the Bay's map, so it would have been refused whole.
A partymate searched the stone again, the field bug GRAVE-PARTY closed on the Bay. Both are the world's pixel now.

### R2-4 - the quest layer's region name past the Bay (FIXED)

`src/scenes/questWorld.js:"currentRegionName: () => { const r = _questRegionIndex();"`. PlayerGPS.CurrentRegionName was
`maps.getRegion(r)?.name` - MAPS.BSA's record, which a province's region (WW-R, 62..70) does not have - so `''` past the
Bay, while every place there names its province's region (`scenes/tamrielPlacesHost.js`, the clones' `where`). The talk's
gates compare the two (TopicTree.checkNPCcanKnowAboutTellMeAboutTopic and checkNPCisInSameBuildingAsTopic, TalkManager
:2995 and :3018): a quest's place or person past the Bay was never known to anyone there - START3's province starts are
quests whose every site is past the Bay - and "Where am I?" underground formatted the region as empty. It answers the
province's region's name past the Bay now; on the Bay the loaded region's, and an empty Bay region's `''` as DFU's empty
DFRegion. (The fixed bench, `scenes/exterior.js`, keeps its own - it stands no land past the Bay.)

### R2-5 - a quest giver past the Bay (TAKEN - the proposal built, FIXED and pinned)

`src/systems/quest/place.js:"_selectRemoteTownSite(world, requiredBuildingType) {"`. A remote site is drawn from the
questor's region's MAPS.BSA rows (Place.SelectRemoteTownSite, SelectRemoteDungeonSite, SelectRemoteLocationExteriorSite);
a province's region has none, so the draw fails, the parse throws, and DFU's own catch answers - a guild's Get Quest says
it has no work, a social giver the same, a Daedra summoned past the Bay "has no task for you in this region. You keep your
gold." No crash, no gold lost; a local site (the giver's own town, START3) works. WW7-4 recorded it ("the capitals'
quests - none of the Bay's quest places resolve there") and TESA15's "still to come" lists "quest sites in them".
PROPOSED: the quest layer's maps (`scenes/questWorld.js`, the `Object.create(maps)` it already wraps) answer a
province's region from the world's registry - `getRegion(62..70)` a DFRegion of the theatre's listed places
(`world/worldWide/worldPlaces.js inTheatre`: the cities, towns, villages and lairs, their `location`'s map row and name),
`getLocation(r, i)` the place's built location (`scenes/tamrielPlacesHost.js`, as the pixel build stands it) - so a
Skyrim questor's courier goes to another town of Skyrim and its dungeon to a lair of Skyrim, walked (TESA-NO-FAST). The
smaller-dungeon law and the START3 `worldPixel` already carry a site past the Bay. The owner decides whether quests past
the Bay are the province's own (this) or stay local-only until the arc that writes them.
TAKEN (2026-10-26, the coordinator for the owner: the proposal, as written): `scenes/quest/questProvinceSites.js` builds
it - the theatre's listed towns on its politic region, its nearest lairs (16 within a Bay region's span, at most 40
first rolls a table - the coordinator's bound on the one task a quest offer adds), a name the table misses found by
the site's own pixel (START3); the Imperial City at first left out, then a destination slice by slice under
a quest name of its own (R2-5b, the owner: "Take care of exclusions and gaps"). DFU's three draws
run over it unchanged. End to end on the freeware: a Fighters Guild, a Mages Guild, a temple, a commoner and a Daedra
at Solitude, Mournhold and the Imperial City each offer work whose remote sites are built places of that province, on
the held map by their pixel, their targets placed on arrival, the same places after a load from the Bay; the Bay's
draw unchanged. `06-Systems/Quest-Arc.md` "AUDIT RELEASE R2-5"; Port-Ledger A; `test/systems/quest/auditrelease_r25.test.js`;
`tools/mutants/questsites.json`.

### R2-6 - a vampire's crypt past the Bay (RECORDED)

`src/scenes/world.js:"function transferToCemeteryArm() {"`. The transfer reads the current region's MAPS.BSA rows for a
cemetery (PlayerGPS.CurrentRegionIndex, GetRandomCemetery); past the Bay there are none, so it is skipped with its
warning (DFU throws where a region holds none) and the vampire wakes where they turned. PROPOSED (a host change - its own
module): the nearest Graveyard among the theatre's lairs (`world/tamrielDungeons.js` LAIR_TYPES).

### R2-7 - a staff event past the Bay (RECORDED - WW6's)

`src/net/staffPlaces.js:"export function staffPlaces(maps, r) {"`. The event's place is a Bay pixel by its law (the
account service, the relay and the game read one copy), the picker lists a region's MAPS.BSA places (none for 62..70),
and an event runs as a town's raid runs (RAID2/RAID3), whose words are the Bay's until WW6 ("the raids past the Bay").
Staff can stage an event on the Bay only; the panel's list for a province is empty rather than wrong. The three move
together with WW6.

### R2-8 - a POI past the Bay (RECORDED)

`src/poi/poiLaw.js:"export const poiPixelId"`. A builder's POI is held to MAPS.BSA's 1000 x 500 by its law (the account
service refuses one past it), its id is `py * 1000 + px` and the feed files it by the same key (`poi/poiFeed.js`
atPixel), which aliases past the Bay. PROPOSED: the place's pixel the world's grid, its id the world's key
(`world/worldWide/worldGrid.js worldPixelKey`, as WW1 moved every other system off MapsFile's id), a migration for the
stored id if one is kept. Not built: a POI past the Bay is new content, not a broken one.

### R2-9 - a deed across a capital's slices (NOT REPRODUCED - routed)

`src/systems/banking.js:"export function isHouseOwned(houses, regionIndex, buildingKey) {"`. WW-R gave each capital its
province's region, and no rule keeps a capital's houses off the market (the isles', Arena's and the countryside's are -
`scenes/worldModes.js` currentHousesForSale), so a house in Solitude is a deed in Skyrim's slot - one house a region, as
DFU's. A deed is DFU's (region, key) law, which on the Bay aliases a key across one region's towns; the Imperial City is
25 slices, each its own map id over its own blocks, so a key bought in one could own a building of the same key in
another. Not reproduced here (it needs the city's slices built). Routed to the Imperial City's stream: either the slices'
building keys are unique across the city, or the deed is held to its own map id there (`isHouseOwned` asked with the
slot's `mapId` for a capital's slice).

## What works past the Bay (read and decided)

- **Saves and their load**: the player's pixel is the world's; the region stores are WW-R's 71 and a save's 62 padded
  (`banking.js padRegionTable`, `regionConditions.js restoreRegionConditions`); the law's book is keyed by region, no
  bound (`court.js legalRepOf`); a classic save's 62 accounts restore through the same padding. A save in Cyrodiil loads
  where it was (TESA2's wait for the trace, START3).
- **Death and the rise**: past the Bay the nearest safe place of the world (AUDIT-TESA A2-4, AUDIT TESA II P3); in the
  open zone the zone's own rise (WILD1).
- **Travel and the map**: a journey whose end lies past the Bay is refused at the one gate every journey passes
  (`systems/travel/pastBayTravel.js`, TESA-NO-FAST); one from past the Bay to the Bay is DFU's (the owner's recorded
  question, AUDIT TESA II P4); the Travel View's spawned dungeons and filed spawns are clamped to the Bay's map, where
  spawns stand (`travelDungeons.js filedSpawns`); a spawn's id throws only for a Bay-less pixel, and no pixel past the
  Bay asks it (`world.js _locationToBuild` hands those to the places past the Bay first, and `spawnedDungeonAt` catches).
- **Courts, the watch, banishment**: region 62..70's own law, standing and banishment (`standing.js`, the 71 conditions);
  a province's People faction is none (FACTION.TXT), which the court's paths take as their no-faction arm.
- **Shops, banks, guilds**: prices and stock per region over the 71 (`worldTick.js`, `shopStock.js`); a province has no
  Province faction, so no price tilt walks it (WW-R); a bank's account and a letter of credit the province's region's; a
  tavern's menu by the climate where the region names none (`tavernMenu.js regionMenuDay`); a temple's divine and a
  knightly order by the building's faction where the region's table names none (`REGION_TEMPLES` padded with 0); the
  Mages Guild's scrying refuses where no region table loads (`lootScry.js scryRefusal`).
- **Names and people**: WW-R's banks and races (`REGION_NAME_BANKS`, `REGION_RACES` + 1 is DFU's Races: a Nord in Skyrim),
  TESA3's province names on the loading screen, the Overworld and Travel Options.
- **The calendar**: the Empire's holidays (`0xFF`, every region) fall past the Bay; a regional holy day is DFU's table's
  and a province keeps none (WW1, recorded).
- **The paper doll's backdrop**: a region past `REGION_BACKGROUND_CHARS` takes the race's, DFU's own fallback.
- **The servers**: the account service's town books and nodes are any region's (WW7-5, WW-C1); the Watch's ground and the
  grants are the world's (WW7-5, AUDIT TESA II Z6); the Abyss census, the Hollows, the raids, the stars and World of
  Daggerfall's camps are the Bay's by their records (WW-R, WW5, WW6).

## Findings in other streams' files

None needed a change in the files three streams hold (the Imperial City's, the coast's smoothing, lane R1's seams).
R2-9 is routed to the Imperial City's stream above.

## Owner decisions taken

1. **R2-2**: an Elite Breach's arch may stand anywhere the world streams - the Bay's map is no longer its bound.
2. **R2-1 and R2-3**: staff reach, and a party's headstone lock holds, wherever a player stands.
3. **R2-4**: past the Bay, the quest layer's region is the province's region by name (WW-R's 62..70).

## Pins and mutants

`test/net/auditrelease_r2.test.js` (6): the probes past the Bay on every axis; R2-1 a destination there lossless on the
client, through the relay's projection both ways, and a where note there placed, the wire's grid its bound; R2-2 the
arch's site there through the open (`validEgIn`, `parseClient`) and a member's word; R2-3 a stone's place read back and
its row through the word, the cell's fold and its word back; the older relay - each of the three words past the Bay
said only to a relay that reads it, over a real session, a Bay pixel to both; R2-4 the quest layer's name for every
province's region, the Bay's loaded and empty regions as before, and the talk's gate over it. Mutants
`tools/mutants/auditrelease_r2.json` (20, all dead).

PINS MOVED (AUDIT RELEASE R2-1, R2-3): `test/net/staffTeleport.test.js` (a destination's pixel: (-1, 0), (1000, 0) and
(0, 500) are land past the Bay now - (8192, 0) and (0, -8192) are past the wire's grid), `test/net/staffpanel5hook.test.js`
(a note "off the map" at pixel 8192, not 5000), `test/systems/fb1016b_graveparty.test.js` (a stone's row past the wire's
grid, not at pixel 1000). One mutant record re-aimed by content (dead): `fb1016b_graveparty.json`'s
GRAVE-PARTY-the-session-asks-no-margin (the session's cell margin, beside the older relay's gate).

## Versions

Relay `world260` re-hashed in place, undeployed (its row in `test/net/relayversion.test.js` names the bytes before it):
R2-1, R2-2 and R2-3 are the relay's law. No frame changes shape; the client says a word past the Bay only to the
world-wide relay. The account service is unchanged (acct189 stands); no migration.

## What this lane could not check

- The running game past the Bay (no browser here): a staff /tp landing in Cyrodiil, an arch raised in Skyrim and its
  halls entered and left, a lair's headstone searched by two partymates, a START3 province start's "tell me about".
  Each is pinned at its law and its session; the scene halves are the code they always were.
- The quest machine past the Bay end to end (R2-5) - since driven in Node over the freeware when the proposal was
  taken (above); in the running game still not. At the audit: its failure is read from the code (`offerFlow.js` - the parse's
  catch, `_failGetQuestMessage`), not driven through a guild hall past the Bay.
- Every system the sweep did not name above was read only as far as its region and pixel reads; the categories the
  coordinator listed are all covered by a verdict here.
