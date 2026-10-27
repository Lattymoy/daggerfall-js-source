# AUDIT BAY-LEFT: NO SYSTEM LEFT BEHIND IN THE BAY (2026-10-26)

The owner: *"Lets do one last deep comprehensive audit on everything and ensure no system is left behind in the bay.
Take your time and be thorough and detailed"*.

**Tree audited:** the PR #1321 head (3f3f2dd) with the base branch's 16 new commits merged in. That merge was staged
in the working tree then, and committed after as `e77eadc58f`. The base's commits are main's archery and lockpick work, migrations 0177-0181, and
QUEST-FABRIC.

**How it was run.** Six cold lanes read the code, and every finding was reproduced on the real code. Most were
reproduced with a node probe on the freeware data (`/home/claude/dfdata/arena2`, the freeware trace and fit, TESA's
907 listed places registered).
- A: world events.
- B: the living world, towns, people and quests.
- C: travel, the sea and the maps.
- D: the ground, ambience and the wild.
- E: the relay, the account service and the saves.
- F: a cold correctness review of PR #1321's own work.

The lead (me) re-ran or re-read every HIGH finding and the top findings of each lane. Five findings were found
independently by two lanes: B2 = E1, B5 = C8, B8 = E3, C7 = E2, and A3 = C's note.

Every lane worked read-only. Nothing in the repository was changed by this audit. The probes, the lanes' brief
and ledger, and the fix brief are kept on the branch `ccr-e60534fb-hlob1p-handoff`, under `handoff/audit-left-in-the-bay/`
(`probes/<lane>/`).

**Line numbers.** A line named below is the audited tree's, written as a plain number (`world.js` line 16836): a record
of where the code stood, not a cite (`Home.md`, A CITE NAMES WHAT IT POINTS AT).

**Terms used below:**
- **"Past the Bay"** means Tamriel round the Iliac Bay: pixels outside 0..999 x 0..499, the provinces as regions
  62..70, theatres 1..9, and TESA's places.
- **"Recorded"** means written down as a deliberate exclusion in `bible/03-World/World-Wide.md` or a slice's record.

## Where each finding stands (2026-10-27)

The owner, after the audit: **"Every single thing here needs to be addressed. No exceptions."** Every finding is built,
the owner's calls with it. The calls, as taken:
- Gate lanes 1..8 open; Cyrodiil's lane never (the open zone).
- Site-bound world events (gates, covens, Hollows, the ketch, raids) stand nowhere in the open zone.
- One Sky-Ketch station per province, at its crown capital.
- A province's covens are authored as content.
- Online spawns past the Bay stand in a world id lane.
- A harbourmaster past the Bay keeps the nearest Bay crown's board.
- The Bounty edict past the Bay pays on hideouts and lairs.
- The landforms' sites past the Bay come from places every client stands (GROUND-AGREE).
- A vampire bloodline is mapped per province.

On PR #1321 before the packages (`5e2d374204`, CI green):
- **F1** (item 2), FIXED: the bake reads the city's water off the plan's law and keeps it - a promote at the Waterfront
  1.0 s, the others 36-137 ms (`03-World/Tamriel.md` RUMARE-WATER, AUDIT BAY-LEFT F1).
- **F2** (item 4), FIXED: the curved painter lays TS9's half tiles past the Bay - 72 of 72 (`03-World/Town-Shapes.md`
  TS9, AUDIT BAY-LEFT F2).
- **F3** (item 5), FIXED: URBANIZER's fabric shut carries the walk shut's key (`03-World/Town-Shapes.md` TS10, AUDIT
  BAY-LEFT F3).
- **Stale lines**, retired where they stood (`ab6d033f41`): World-Wide.md WW1's crime line, WW3's Deep Waters, WW-R's
  town-bound books, WW-C1's Motherlodes and its writs, the "Not yet" capitals' quests; Tamriel.md TAMRIEL2's Deep Waters
  promotions and its region reading; Arena-Provinces.md's port byte.

The rest, in nine packages, each finished on its own branch from `e77eadc58f` and merged into this PR. Every finding is
FIXED, each with its pins and its mutants (all dead, or `equivalent` with its reason), recorded where its system lives:

- **WP1 gates** (`03-World/World-Wide.md` WW-GATES-EVERYWHERE, `11-Multiplayer/Sky-Ketch.md` section 22):
  - A2 (item 24): gate lanes 0..8 stand (`net/wire.js` `GATE_LANES_OPEN`), Cyrodiil's never; a province's site names its
    province's region, its court laid there. The scans found ground in all eight provinces, none in the open zone.
  - A2b: a province gate's kill credits its province's seats (`scenes/gate/gateSeat.js`; the account's refusal
    `'not-its-region'`) - three agreeing claims on a Skyrim gate, 300 influence to the guild pledged at Solitude.
  - A2c: the province scans in the page's idle moments, a few ring pixels a slice (`theatreGateScanner`) - one task of
    5.4 s cold before (the machine loaded), slices of 33-37 ms warm after.
  - A4 (item 34): a Sky-Ketch station at each province's crown capital - Daggerfall (the Bay's own), Sentinel, Solitude,
    Mournhold, Alinor, Falinesti, Torval, Helstrom; Cyrodiil's lane none.
  - WW2's two stale lines retired.
- **WP2 WW5** (item 26; `03-World/World-Wide.md` WW5, `11-Multiplayer/Starfall.md` section 16, `Super-Dungeons.md` WW5):
  a coven night and a Hollow in every province but the open zone - eight province covens authored, three stars a night
  in each, 48 province Hollows standing on the freeware; a halo socket says its own relay's word.
- **WP3 WW6** (item 27; `03-World/World-Wide.md` WW6, `03-World/Raiding-Parties.md` WW6, `11-Multiplayer/Staff-Events.md`
  section 6): raids at towns in every province but Cyrodiil, keyed on the world's grid at both ends; a staff town event
  past the Bay.
- **WP4 dungeons** (`03-World/World-Wide.md` WORLD-LANES, `06-Systems/Systems-Arc.md` SPAWN-HOLE and SPAWN-WORLD,
  `03-World/Ocean-Holes.md` PITS-WORLD, `06-Systems/Travel-View.md` TVD-WORLD, `06-Systems/Bounty-Boards.md` section 13):
  - A1 (item 1): no hole in the ground past the Bay - 39 pixel builds threw in the Skyrim box, 0 now.
  - A3 (item 25): online spawns past the Bay in a world id lane (`SPAWN_WORLD_LANE` 0x380), Elite among them - 894 of
    3,000 dry pixels (29.8%, 23.3% Elite) where none stood; the Bay's 869 unchanged.
  - The pits (item 35): Ocean Holes past the Bay, the abyss in its own lane (0x600) - 152 of 152 pit pixels open.
  - C4 (item 29): the Overworld's dungeons past the Bay (`systems/travel/travelLairs.js`) - 0 listed before; 9 of 9,
    13 of 25, 12 of 23 at three places.
  - The quarry (item 37): a bounty board's quarry the land's own wild (`systems/bounty/bountyQuarry.js`), Bay-wide.
- **WP5 quests** (`06-Systems/Legacy-Arc.md`, `06-Systems/Quest-Arc.md`, `06-Systems/Talk-Arc.md` and
  `03-World/Arena-Provinces.md` BAY-LEFT-B):
  - B1 (item 3): a Legacy heir born at a seat past the Bay by its kept map id once the world stands, the Online page's
    waiting house's seat carried; a house with no seat bears its heir in the world's nearest town.
  - B3 (item 15) `%di`; B4 (item 16) the talk's regional "Where is", a place's own MapTable key (`world/locationKey.js`,
    every one of MAPS.BSA's 15,251 rows matched); B5 = C8 (item 17) the map reveals; B6 (item 18) scrying; B7 (item 19)
    `%lp` - regions 64-69 said "Hammerfell" and 70 "High Rock", now each its own province.
  - Item 32: houses sold, deeded and given in every town the port made.
  - Audit-Release-R2.md's scrying line retired.
- **WP6 courts** (item 33; `03-World/World-Wide.md` PROVINCE-COURTS): each province its Province, its named ruler, its
  Court and its People (content - FACTION.TXT has none); `%rn` its ruler where it read "Random Ruler"; the vampire
  clans' regions guarded at every lookup by region alone; a bloodline a province (clans 150-158 over regions 62-70).
- **WP7 maps** (`10-UI/Held-Map-Arc.md`, `06-Systems/Travel-View.md`, `06-Systems/Travel-Options.md` and
  `03-World/Come-Sail-Away.md` BAY-LEFT-MAPS, `03-World/Arena-Provinces.md` BAY-LEFT-MAPS C7):
  - C1 (item 6): every mark over the sheet's box (`ui/heldMap.js` `_marksBox`) - the party, travellers, the trader's
    coin, the serpent, the Motherlodes past the Bay drawn.
  - C2 (item 8): waypoints and the remains flag on the world's grid.
  - C3 (item 12): a passage to a port past the Bay resumes after a load; far plates; the quest press.
  - C7 = E2 (item 11): a town's book of buildings keyed `<region>:<name>#<mapId>` past the Bay - 907 places on 296
    books before, 907 books now; the Bay's keys byte for byte.
  - C9 (item 13): the Find box finds 296 of 296 names past the Bay (0 before).
  - C10 (item 14): Travel Options' roads past the Bay - 1,593 of 1,593 road pixels read (0 before).
  - C11 (item 21): port anchors, the Ports filter, the teleport card's province, the carriage wheel.
  - C12 (item 38): Come Sail Away's reading on TMAP00I0 past the Bay (a DEPARTURE).
  - Travel-View.md VOYAGER2.1's stale line retired.
- **WP8 sea** (`03-World/World-Wide.md` BAY-LEFT-SEA and the pages its table names):
  - C5 (item 30): a harbourmaster at every one of the 29 ports past the Bay, on the nearest Bay crown's board.
  - C6 (item 31): Solitude, Alinor, Torval and the Waterfront stand a shipyard, crew hall, lighthouse and Docks, and their
    banks sell ships (a capital's landmark measured by its footprint).
  - B2 = E1 (item 7): the market's hubs a province's crown seat - a Solitude courier fills a Daggerfall order.
  - B8 = E3 (item 20): the Bounty edict past the Bay pays on hideouts and lairs.
  - E4 (item 23): staff `/town audit` lists a province's capitals first, 400 a page.
  - D4 (item 22): weather born at sea past the Bay is the sea's - the Sea of Ghosts' winter snow 142 of 400 before, 62
    after.
  - WW3's crowns line retired.
- **WP9 ground** (`03-World/Landforms.md`, `03-World/Snowfall.md` and `06-Systems/Living-World.md` BAY-LEFT-GROUND):
  - D1 (item 28): the landforms' sites past the Bay (`landformSitesBeyond`), from places every client stands (GROUND-AGREE,
    proved on the freeware) - a town's edge step past the Bay median 39.1 m and p90 104.0 m before, 15.1 m and 37.0 m
    after; the Bay's byte for byte. GROUND_LAW 2.
  - D2 (item 9): road trouble's foes the land's own fauna - at Helstrom 322 of 1,200 Orcs or Centaurs before, none after.
  - D3 (item 10): the Snowfall mod past the Bay - deep snow, tracks, hollows and the roads' berms.
  - D5 (item 36): `landformLiftAt` on the whole world grid, past the Bay the build's own place; every height a record
    writes carries its ground frame.

**The packages at their merge.** Each merged clean of its own checks; their meeting needed these, each pinned:
- WW5's theatres asked the gate's `scanOf` in one idle moment, undoing A2c - the gate's scans answer `wholeScan` and the
  events wait on them (`test/world/worldWide/bayleft_scanseam.test.js`, `tools/mutants/bayleft_scanseam.json`).
- SPAWN-WORLD made the account Worker bundle the roads layer and the traced map through the living world's seed - the
  seed takes `hash32` from its leaf (`tools/mutants/bayleft_merge.json`).
- WW6 and BAY-LEFT-MAPS each added `readRaidMarksIn` to `ui/eventMapMarks.js` - merged with no conflict, the module did not
  load; one kept, WW6's pin strengthened.
- SPAWN-WORLD moved `_locationToBuild` and `_liftLocationAt` out of `bootWorld`; WW5's Hollow-first clause and
  BAY-LEFT-GROUND's D5 lift were carried into the moved modules (`scenes/spawnStandHost.js`, `scenes/spawnGroundHost.js`).
- The held map's Hollows and Ketch stations are lists read over BAY-LEFT-MAPS' sheet.
- BAY-LEFT-GROUND's sites stand between the isles' templates and the classic rows' letting go (`etherplaces.test.js`,
  PIN MOVED).
- `bootWorld` measured at each merge, its ceiling at its measure (`test/scenes/hostceiling.test.js`): 35,799 at the
  packages' base, 35,368 merged.
- The relay's law re-hashed once, world270 in place (`test/net/relayversion.test.js`), and the version notes written on
  `RELAY_VERSION` and `ACCOUNT_VERSION` (acct196): deploy the relay first, then the account service, then the site.

---

## TIER 1 - BROKEN: things that fail or stall today

### 1. A1 - Rural pixels past the Bay fail to build online, and leave permanent holes in the ground
- **Severity:** HIGH. **Status:** CONFIRMED by probe (re-run by the lead) and by reading.
- **Where it came from:** the base branch's merge of main at 27a58c6ef7, which brought in GROUND-AGREE. It is not this
  PR's code, but it is in this PR's head and in its base.
- **What happens:**
  1. `scenes/pixelBuild.js` line 243 asks `spawnGroundPlace.groundLocationAt` on every build.
  2. When the spawn roll lands on dry, empty land, `world/spawnGroundPlace.js` `spawnAt` calls the host's `_spawnCloneAt`.
  3. That reaches `spawnedMapId`, which throws `RangeError: pixel X,Y` for any pixel past the Bay
     (`world/spawnedDungeons.js` line 192).
  4. The pump's catch (`scenes/world.js` line 16836) destroys the pixel, and BUILD-RETRY asks for it again. It throws every
     time, so the pixel never stands: no terrain and no collider.
- **Probe:**
  - A 40 x 20 box of Skyrim: 800 pixels asked, 39 threw.
  - The same box on the Bay: 0 threw.
- **Second path:** the party walk's `tvLocationAt` (`world.js` line 27202) has no try around it.
- **Fix:** one line. `spawnAt` returns null when `!inBay(px, py)`. Past the Bay no spawn ever stands anyway
  (`_locationToBuild`'s branch past the Bay never asks `spawnedDungeonAt`), so the Bay is unchanged. Add a pin and a
  mutant. No relay change.

### 2. F1 - Arriving at the Imperial City stalls the world for 7-21 seconds
- **Severity:** HIGH. **Status:** CONFIRMED by probe (re-run by the lead on the working tree). This PR's own
  regression, from RUMARE-WATER.
- **Cause:**
  - `world/tamrielWatersBake.js` classes all 625 city pixels `PIXEL_MIXED`.
  - Every cell flood then calls `rumareWaterSampler` for each city pixel in its 64 x 64 window. That is a full
    `generateSamples`, a blend and `capitalSeaGround`, about 10-13 ms a pixel, and nothing is kept between cells. Fine
    masks pay it again.
  - The worker evicts planes past radius 12, which is the span's own half, so crossing the city floods again.
- **Measured:**
  - The lake's cell: 6,840 ms.
  - The other cells over the span: 18,085 ms.
  - Again after an eviction: 6,449 ms.
  - A Topal Bay cell, for comparison: 45 ms.
- **Why the player waits:** `scenes/pixelBuild.js` line 1361 awaits the near pixels' Deep Waters result with no timeout. The
  NIBEN-SEA voyage lands the player exactly there, at (2069, 668).
- **Fix:** one module.
  - Derive a city pixel's coarse and fine bits from the plan's law (`rumareSeaAt`), with the land's own heights only on
    the span's outer edge. At the least, keep them per pixel on the bake.
  - Class the isle's all-land pixels `PIXEL_LAND`.
  - The rumarewater and tamriel_deep tests already pin the bake against the ground.

### 3. B1 - Project Legacy cannot start an heir whose family seat is past the Bay; the page fails to boot
- **Severity:** HIGH. **Status:** CONFIRMED by probe and by reading (the lead read the seat and boot path). Project
  Legacy is on by default.
- **What happens:**
  1. The seat is the first town the house stands in (`scenes/legacyHost.js` line 1188). Places past the Bay enter the
     location index as they build, so it can be `{ region: 'Skyrim', loc: 'Solitude' }`.
  2. The birth boots with `?region=Skyrim&loc=Solitude`.
  3. `scenes/world.js` line 2795 looks it up with `maps.getLocationByName`, which reads MAPS.BSA only.
  4. It throws `location not found: Skyrim/Solitude`, so the page fails to boot. The URL keeps the birth's parameters,
     so a reload fails too. The Online page's waiting-house birth takes the same route (`main.js` line 249-255).
- **Also:** a house with no seat walks the Bay's 62 regions only (`systems/legacy/places.js` `nearestTownAnywhere`). An
  heir of someone who fell past the Bay is born hundreds of pixels away.
- **Fix:** about a module. Boot a seat past the Bay the way a save made there loads: by its kept mapId and pixel, once
  the trace has landed. Interim guard: the nearest Bay town.

### 4. F2 - TS9's blended ring edges never reach towns past the Bay
- **Severity:** MED. **Status:** CONFIRMED by probe and by reading. This PR's own; its record overstates it.
- **What happens:**
  - Past the Bay a pixel takes the curved painter (`world/road/roadPainter.js` line 128-131).
  - The curved painter's ring pass paves whole ring tiles only (`world/road/roadCurves.js` line 275, `rect.ring[t] === 1`).
  - The straight pass after it is handed road 0, so the half tiles are never laid.
- **Probe:**
  - On the Bay: 72 of 72 half tiles laid.
  - Past the Bay, at three pixels: 2 of 72.
- **Why the pin missed it:** the "past the Bay" freeware pin built its city on a Bay pixel
  (`test/world/terrain/townring.test.js` line 121), and Town-Shapes.md TS9 was measured the same way.
- **Fix:** a few lines. Lay the ring's NW/NE/SE/SW halves with DIAG_OUT turned by RING_HALF in roadCurves' ring pass.
  Move the pin onto a pixel past the Bay with a roads layer installed.

### 5. F3 - TS10's "yards placed again once the roads land" never fires, on the Bay or past it
- **Severity:** MED. **Status:** CONFIRMED by probe and by reading. This PR's own.
- **What happens:**
  - `townWalkShut`'s `.key` (`world/townWalls.js` line 673) is lost through URBANIZER's wrapper
    (`world/urban/townFabricStand.js` line 141 `fabricWalkShut` returns a new function with no key).
  - The yard memo's signature then reads `'shut'` whatever the paths are (`scenes/world.js` line 4234).
  - So a town built before its roads arrived keeps the Stable, Wagon Yard and joinery it placed then, which can stand
    on the roads painted on the rebuild.
- **Why the pin missed it:** the host pin only matches source text.
- **Fix:** one line. Carry `.key` onto the wrapper, and pin that a wrapped key survives.

---

## TIER 2 - LEFT BEHIND IN THE BAY: a system that works on the Bay, missing or wrong past it (clear fixes, low risk)

| # | Finding | What a player past the Bay sees | Code | Fix |
|---|---|---|---|---|
| 6 | **C1 Held map drops marks** | Party members, other players, the trader's coin, the serpent's ring and Motherlodes are never drawn past the Bay. Gates, bounties and quests are. | `ui/heldMap.js` line 613 `_size` is 1000x500 (no host passes `mapSize`); the readers at lines 2230-2293 | ~6 lines: read over `sheet` like bounties |
| 7 | **B2 = E1 Market has no road** | No buying, filling or bidding between a province board and any other region ("The couriers do not know the road there yet."), both ways. Confirmed with the real Worker over sqlite. | `scenes/world.js` lines 1912 and 2441 hubs from MAPS.BSA rows only; `server-account/src/market.js` line 170 | Client-side module: a hub per province (its crown seat, `townSeats` powers), made again as the seats move; no account bump |
| 8 | **C2 Waypoints** | Personal, party and guild waypoints can't be placed, shared or kept past the Bay. The open zone's remains flag (WILD-WAYPOINT) never plants, and the zone is all past the Bay since WW-C2. | `systems/map/mapWaypoints.js` line 75 `onMap` 1000x500 | 1 line: `worldPixelOk` |
| 9 | **D2 Road trouble's foes** | Living-world caravans past the Bay are beset by Bay foes: Orcs and Centaurs in Black Marsh, against TESA-BIOME's own recorded choice 4. | `scenes/world.js` line 3309 `livingTroubleWorld.foesOf` passes no `fauna`; `systems/livingWorld/trouble.js` line 139 | ~3 lines: pass px/py, `fauna: maps.getFaunaBand` |
| 10 | **D3 The Snowfall mod** | No deep snow, footprints, tracks or berms past the Bay, Skyrim included. The snow cover and the peaks' caps do stand. | `scenes/world.js` line 2905 `pixelOn` bound (and its `px*1000+py` key); `scenes/snowfallHost.js` line 390 and `systems/snowfallRuntime.js` line 121 clamps; `snowfallHost.js` line 347 roads | A few lines: world key, unclamp the boxes; later read TESA's roads for berms |
| 11 | **C7 = E2 Building discovery book** | Same-named places in one province share one book. Door plaques and the town map show another town's building names, the I-box counts the other town's shops, a lockpick failure blocks the same key everywhere, and quest re-stamps land on the wrong town. 907 places on 296 keys; the Imperial City's 625 slices on 14 names. | `scenes/world.js` line 29269 `${regionIndex}:${name}` (and lines 6619, 6634, 16678, 18948) | One key-maker: `#mapId` past the Bay (the automap already does this); Bay keys unchanged |
| 12 | **C3 Places by summary** | A booked passage to a port past the Bay, saved and reloaded, silently never resumes (every 20 s, aboard). Ports past the Bay found in an earlier session vanish from masters' lists. The Overworld's far plates are a one-time snapshot, so no countryside appears. Quest diamond presses do nothing. | `scenes/world.js` line 30068 `tvPlaceSummary` reads `locationIndex` only; `scenes/naval/passageHost.js` lines 176-177; `world.js` line 30725 | A host module: stand the place on demand (as `portalGates.destOf` does); a near query for TV5 |
| 13 | **C9 Find box** | The travel, Portal Stone and teleport maps' Find can't find Solitude, Whiterun, the Imperial City or any of the 296 place names past the Bay. | `ui/heldMap.js` line 3446 loops over MAPS.BSA's 62 regions | Small: add the registry's listed rows |
| 14 | **C10 Travel Options roads** | Follow Paths says "no path" on every road past the Bay, the junction map is blank, and a walk on a road runs at the open-ground rate (x60, not x100). | `world/road/pathData.js` line 66 `dataPoint` bound; `ui/travel/travelPathsOverlay.js` line 182 | A module: read `arenaRoadByte` past the table |
| 15 | **B3 Quest directions** | `%di` says "...never mind..." for every site past the Bay (28 DFU quests use it). | `scenes/questWorld.js` line 324 raw `maps`; `systems/talk/talk.js` line 189 `regionCount` 62 | 2 lines |
| 16 | **B4 Talk "Where is" (regional)** | Always "not found" past the Bay. | `scenes/world.js` line 18944 `maps.getRegion` is null for 62-70 | Small: the quest layer's province tables (and give their rows the `key`) |
| 17 | **B5 = C8 Map reveals** | A map item is used up with nothing revealed; the Thieves Guild's rank 6/8 and the Dark Brotherhood's promotion reveals do nothing. | `scenes/world.js` line 12922 | Small: the province's registry places |
| 18 | **B6 Mages Guild scrying** | Refused as "nowhere". The R2 record's reason ("no region table") is stale since R2-5. | `scenes/world.js` line 12950 | 1 line, the same table as B5 |
| 19 | **B7 `%lp`** | Says "Hammerfell" everywhere past the Bay ("High Rock" in Cyrodiil), for example in Mid Year Celebration's text. | `systems/quest/questMacros.js` line 767 | 1 line: `REGION_NAMES[r]` for a province |
| 20 | **B8 = E3 The Bounty edict** | A seat past the Bay may proclaim it, but it can never pay (World of Daggerfall's camps are the Bay's), so the week's edict is wasted. | `net/townSeatLaw.js` line 1077 `bountySitePixel` | Small: don't offer it past the Bay (an account change, folded into the undeployed acct196) |
| 21 | **C11 Held-map small gaps** | No port anchors or Ports filter past the Bay. The teleport card shows no province. `carriageTown` decodes a map id as `y*1000+x`, so walled cities past the Bay never show the Overworld's carriage wheel. | `ui/heldMap.js` lines 1331 and 3048; `scenes/world.js` line 30041 | Small each |
| 22 | **D4 Weather born at sea** | Storms at sea past the Bay (the Sea of Ghosts, the Topal Bay, the Padomaic) follow the nearest Bay edge's climate (Mountain: 35% snow in winter). The player's own roll is right. | `systems/weather/weatherMap.js` line 526-533 | 1 line (moves weatherMap pins) |
| 23 | **E4 Staff `/town audit`** | For a province it lists the wrong 400 towns (sorted by negative index). | `server-account/src/townEcon.js` line 171 | 1 line, an account change |

---

## TIER 3 - BIGGER: owner's calls or features

| # | Finding | Today | What it takes |
|---|---|---|---|
| 24 | **A2 Oblivion Gates past the Bay** | `net/wire.js` line 5127 `GATE_LANES_OPEN = [0]`: only the Bay's gate ever stands. The probe ran the real theatre scans over the registry and found real gate sites in all eight provinces (Cyrodiil's lane stays shut: the open zone). The records contradict each other: WW2 says a lane opens with the change that registers a province's places (WW7-1 did that), while TESA x AUDIT TESA II P7 keeps the Bay's lane alone for the scans' 453 ms. | (a) lanes 0..8; (b) the relay: re-hash world270 in place while it is undeployed, or split `GATE_LANES_RELAY_MIN` from `WORLD_WIDE_RELAY_MIN`; relay first, then the site; (c) slice the province scans across idle time (A2c: they all run at once on the page's thread today); (d) **A2b**: a province gate's kill credits no seat, because `scenes/world.js` line 23078 `gateSeatWord` sends a region for lane 0 only - one line, `regionOfTheatre(lane)` |
| 25 | **A3 Online spawned dungeons and the Elite tier** | On the Bay about 29% of empty land stands an online spawn, 7% of those Elite. Past the Bay only TESA8's lairs stand (~1-2% of land), none of them Elite. | The owner's call: Elite lairs by the same roll (small), or spawns under a world id lane (a module plus the relay's room law; needs A1 first) |
| 26 | **WW5: Starfall's covens and the Hollows** | One coven a night on the Bay (`systems/starfall/starfallSites.js` `W = 1000`; the wire's `px` 0..999). The Abyss census counts the Bay's 62. A player past the Bay never meets either. The blockers named then are gone. The thirteen covens are all the Bay's FACTION.TXT witches, so content is needed for a province's night. | WW5 as planned |
| 27 | **WW6: Raids past the Bay** | Raids walk MAPS.BSA's regions (`systems/raidingParties.js` line 210; the wire 0..999). The registry's towns by area, which the plan needed, now exist (WW7-1). Staff town events follow the raids. | WW6 as planned |
| 28 | **D1 Landforms' site pull (LANDFORM4)** | Towns past the Bay sit in their own levelling wall. No place past the Bay is a site (`world/landforms.js` lines 819, 895 and 897; the table is 1000x500 from MAPS.BSA). Worst edge-to-town step: median 39 m and p90 104 m past the Bay, against 7.6 m and 37.7 m on the Bay. | A module: a site source keyed by the world's key, made from the registry. Medium risk: GROUND-AGREE (clients standing different places stand different ground) and the heights past the Bay move |
| 29 | **C4 The Overworld's dungeons** | No lair plates, "?" marks, discover-on-approach or dungeon models past the Bay (`systems/travel/travelDungeons.js` line 48 `dungeonRows(mapDict)`). | A module: lairs near, bounded |
| 30 | **C5 Harbourmasters** | None of the 29 ports past the Bay has a Harbormaster tab: no contracts, letter of marque or Admiralty carrack (`world/worldWide/worldPorts.js` line 78 `crown: null`; `scenes/harbourOffice.js` line 170). The crowns past the Bay are the owner's recorded call; the lost board is not recorded. | Small: the nearest Bay crown's board (as the navy already flies it), or a crownless office |
| 31 | **C6 The capitals' harbours** | Solitude, Alinor, Torval and the Imperial City's Waterfront stand no shipyard, crew hall, lighthouse or Docks row, and their banks sell no ship (`world/tamrielCapitals.js` line 785 `portTownAndUnknown: 0`). | ~1 line, but each capital's laid plan has to find seaward ground: measure per capital |
| 32 | **House sales in Arena towns and the countryside** | No house for sale, no deed, and no rank-9 knight's house in any Arena town or country place. The recorded reason ("until TESA3") is stale. | ~1 line: extend R2-9's `deedHeldIn` by mapId |
| 33 | **A province's court and people** | FACTION.TXT has none. So palace nobles past the Bay offer commoner work, `%rn` is "Random Ruler", commoner reputation never moves, and a vampire turned there is a Lyrezi. WW7-3 now stands crown seats past the Bay that could carry the port's own. Latent: FACTION.TXT's nine vampire clans (150-158) carry regions 62-70, so guard any lookup by region alone. | The owner's call (content) |
| 34 | **A4 The Sky-Ketch** | One station, over Daggerfall's fields (the owner's KETCH wording). | The owner's call; a station per theatre needs no relay change but the sight |
| 35 | **Ocean Holes pits** | Bay-only, because the abyss id is a 20-bit Bay pixel id. TAMRIEL-DEEP now carves the continent's sea, so the key is the only thing in the way. | A world id lane |
| 36 | **D5 `landformLiftAt`** | Answers 0 past the Bay (`scenes/world.js` line 5510). A record written past the Bay and loaded with the Landforms row off keeps the lift (AUDIT LANDFORMS C1/B4's case). | 1 line, plus a stamp for records already written |
| 37 | **Bounty boards' quarry** (a note; Bay-wide too) | One global table by level, so a Black Marsh board posts Orc Warlords and Centaurs. | Read TESA-BIOME's rosters |
| 38 | **C12 Come Sail Away's own map** | The Bay's picture, so a boat past the Bay has no dot. | The mod's window; low |

---

## RECORDED EXCLUSIONS - verdicts

Still holding (deliberate, nothing to do):
- World of Daggerfall's sites, rocks and the gate's clearing are the Bay's.
- Cyrodiil's gate lane never opens.
- One serpent for the world (WW7-12); a serpent per sea theatre stays planned.
- TESA-NO-FAST, and the open owner item: a journey from past the Bay to the Bay is still DFU fast travel.
- Per-region holy days and REGION_TEMPLES stay DFU's tables.
- The Bay's three crowns, Tides and Marches; the navies are the owner's call.
- Classic SAVEVARS/MAPSAVE are the Bay's 62.
- The town economy's `py*1000+px` key phases the waves only.
- A province chat channel is never sharded.
- The naval wire's regions.
- The PvP arena is in Daggerfall city.
- The air law's latitude is held to the Bay's rows.
- Lairs roll DFU's dungeon tables.
- The classic lane's winters.
- `scenes/exterior.js` is the Bay's fixed scene.
- High Rock and Hammerfell past the Bay have no start of their own.
- The TAMRIEL-DEEP bake reads no location rect past the Bay (the carve cuts no town).
- A lake the picture draws is never seeded.
- RUMARE-WATER's not-done: no pier berths.
- NIBEN-SEA's picture guard.

**Stale.** The code moved on and the doc line still says the old thing. Doc edits:
- World-Wide.md WW1 (line 154): "a crime on the road is charged ... 0 past the Bay (reportOk 0..61)". It is 0..70 since
  WW-R.
- World-Wide.md WW2: "The seats. A gate past the Bay credits none." Superseded by WW7-3's `gateRegionOk`, though the
  client still sends none (A2b).
- World-Wide.md WW-C1 (lines 579-580): "Motherlodes, Court writs and chapters' hall writs ... the Bay's until WW7". Done by
  WW7-5.
- World-Wide.md WW3 (line 406): "Deep Waters is the Bay's". TAMRIEL-DEEP carves the continent.
- Tamriel.md TAMRIEL2: "Deep Waters' promotions held to the Bay". The same.
- Tamriel.md (line 186): "weather, quests and factions key on [the region] and see the Alik'r". Weather keys on climate,
  and the provinces are regions 62-70.
- World-Wide.md WW3 "The crowns ... until the provinces are regions (WW-R)". Re-recorded later as the owner's call.
- Arena-Provinces.md: "an Arena town ... its port byte is 0". TESA6 writes 1.
- Travel-View.md VOYAGER2.1: "its trips stay on the Bay". WW7-7 moved them.
- Audit-Release-R2.md line 224: scrying "refuses where no region table loads". The tables exist since R2-5 (see B6).
- World-Wide.md "Not yet": "the capitals' quests (none of the Bay's quest places resolve there)". Built by R2-5.
- WW2 "Opening a lane" against TESA x AUDIT TESA II P7 "the gates stay the Bay's lane alone". They contradict each other
  (see A2).

---

## COVERAGE - checked and world-correct

**A: world events.**
- Every lane's gate pieces: the omen, the timers, the board's rows, the hub's keys, the pixel laws and the rite.
- Elite Gates.
- The serpent (rolled over the world's lanes, the hub telling every game).
- The bounty boards' sites (LAIR-WORLD).
- Revenants' lairs.
- Treasure charts (off ports past the Bay).
- The wild zone, its halls and giants.
- Harvesting nodes and Motherlodes.
- Camp and road encounters.
- Live sky events.
- The firmament, the gambit and the herald.
- Crown sieges (bounded by 1e9).
- The Witches' Festival.
- The PvP arena (in Daggerfall by design).

**B: the living world, towns, people and quests.**
- The living world: its index, trips, ways, outlaws and hideouts, patrols, census names and walker races.
- The quest machine past the Bay: R2-5's sites, R2-4, START3, `%cn2`/`%reg`/`%crn`, QUEST-FABRIC.
- The law: the courts, arrests, standing and `reportOk`.
- Banks (71 regions), loans and the online Empire account.
- Shop prices (71), stock, the tavern menu by climate, yards and keepers named by the province's bank.
- NPC names and faces.
- Guild services, guild hall reveals, crime guild invitations, questline posts and racial quests.
- Festivals.
- Champions, professions, upkeep, renown and affiliations.
- Tavern rooms.
- Online homes (HOME_REGION_MAX 70).
- Seats, domains and castles (WW7-3/4/6).
- The town economy and the Watch (WW7-5, WW7-10).
- The rumour mill and the bulletin board.
- Starts.
- The universal holidays.

**C: travel, the sea and the maps.**
- Ports and lanes (the Bay's, the beyond's, the crossing's).
- Raiders' and the director's sea.
- Ship and crew names.
- The passage law.
- Come Sail Away's port test and harbour book.
- The Overworld planner and its ground past the Bay, and the lon/lat round trip.
- The Portal Stone and guild teleports.
- Teleport anchors.
- Location discovery by whole id, and its save round trip.
- The held map's hover, picks, gates, bounties, lairs and quests.
- The town walk.
- Stables and yards.
- Horses, riding, wagons and caravans.
- Traveller marks.
- Banking's letters of credit.
- The compass, hover and tooltips.
- The loading screen's place name.

**D: the ground, ambience and the wild.**
- Every raw climate, politic and height read (the host's readers are the composed ones; the workers compose their own).
- Biomes and climate.
- Every other encounter path (they pass `fauna`).
- The weather table and sim.
- The sky, NIGHT-FOG, dynamic skies, heat haze, lightning, storms and wind.
- The snow cover, snowpack and peak caps.
- Music, the soundscape, WORLD-AIR and ambience.
- Survival and temperature.
- Foraging, fishing, hunting, mining and herbs.
- Seasons of the Iliac Bay (archive-based).
- Death and respawn, the sea rise, `/unstuck` and resurrection.
- Dungeon and interior textures.
- The far views, FAR-FLORA and FAR-TREES.
- Deep Waters' continent frame.
- Underwater.
- The jungle.
- Diseases, lycanthropy and Daedra summoning.

**E: the relay, the account service and the saves.**
- Relay room keys, poses, cells and handover.
- Traveller marks, the party pose, trades, duels and the overworld band.
- The bounty pose, the living-world id, the wdun halls, sea rooms, gate sites and the serpent's word.
- The Watch receipt, sieges, staff `/tp`, the chat whitelist (71) and the wild referee.
- Account books: homes and halls, deeds, decor and rent, seats (71), domains, castles, guild halls, writs, contracts,
  cards, the sea bounty, wild falls and insurance, nodes, chapter halls, notice boards, POIs, the staff economy, the
  broker, letters and Discord.
- Saves: padded region tables, legal reputation and prices, location and automap keys, a world save past the Bay loading
  back at its pixel, dungeon and lair saves, realm, cloud and checkpoint.

**F: this PR's own work.**
- IC-PACE: x60 on all 625 slices, 5 round them.
- CLIMB-CREST.
- TS8.
- TS10's law (apart from F3).
- RUMARE-WATER: seams, caches, the shore capitals at 35 m, and the bake's rect equal to the streamed build's.
- NIBEN-SEA: the zone mask's cost unchanged, and no place stands on the canal.
- TAMRIEL-DEEP: both threads agree.
- Ports and lanes.
- The staged merge's QUEST-FABRIC: no clash (`bakeFabricSites --check` in step, questfabric 5/5, the worker purity pin
  green).

## Not covered, and why

- **The running game past the Bay.** The headless game crashes past the Bay (#1184's J6), so everything above was
  probed module by module on the real data.
- **Two-player online behaviour.** For example GROUND-AGREE between a client with the land and one without.
- **The account migrations against a real D1.**

## Checked again (2026-10-27)

CI runs no test with ARENA2, so the ARENA2 halves of F1-F3's pins were run again on PR #1321's head (`5e2d374204`) with
the freeware's data (`tools/fetch-data.sh`, `ARENA2_PATH`) when the branch was picked up:
- `rumarewater.test.js`, `townring.test.js` and `townpaths.test.js`: 23 of 23 pass, none skipped.
- The suites F1-F3 moved a pin or a mutant in, and their neighbours (`audittesa3e1.test.js`, `audittesa3e1_ring.test.js`,
  `townshapes.test.js`, `townfollow.test.js`, `nibensea.test.js`, `urban3_stand.test.js`, `urban3_fabric.test.js`,
  `tamriel_deep.test.js`, `hostceiling.test.js`): 55 of 55 pass, none skipped.
- `node tools/mutate.mjs tools/mutants/townring.json tools/mutants/townpaths.json tools/mutants/rumarewater.json`:
  townring 11 of 11 dead, townpaths 10 of 10, rumarewater 47 dead and its 2 `equivalent` as recorded, 0 survived (two
  rumarewater records judged in place: `audittesa2c_capitals.test.js` passes in no workspace).

## Found on the way, not this audit's

- `test/world/fb1009_yardfoot.test.js`'s ARENA2 half ("a point 2 m inside every door is still the house") fails 2,842 to 0
  on main, the tamriel branch and this PR alike; it passes at b50b68abdd and fails at db5f441691 ("decor: fix placement
  near roof overhangs", `scenes/homeYards.js`). CI runs no ARENA2 half, so nothing saw it.
- `fb1002_audit`'s ARENA2 step-back case (N0000033) fails on the PR's head before the packages too.
- The Eltheric isles' port towns stand in a levelling wall (median 54.9 m, p90 69.7 m over 60 ports): they are not
  landform sites. This audit's "past the Bay" is Tamriel; their sites would move the ground again (GROUND_LAW 3).
- A zone hall's map ids (top bits 0xf) overlap the Abyss Dungeons' salt lanes 0xf00-0xfff (WW-C2), named in
  `world/worldWide/worldLanes.js`'s header.
- Twenty mutant survivors in other arcs' lists, every one surviving on the PR's head without the packages: seventeen
  already owed (AD28Q-J and AD28Q-J2, `01-Overview/bugs/Field-Bugs-2026-10-20c.md`), three named for their arcs in
  `06-Systems/Legacy-Arc.md` (AD28Q-S4-grace-resynced, AUDIT-STARTS-V4-the-end-unpadded, TESA11-wall-band-unreserved).
- `tools/mutate.mjs` counts a test file the machine's memory limit kills as a death; under eight agents' load a death
  was checked against the run's own failing subtests where a package could (BAY-LEFT-GROUND did, for every one).
