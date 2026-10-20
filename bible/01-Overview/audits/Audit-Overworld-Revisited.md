# AUDIT OW-REVISITED (2026-10-20) - the Overworld revisited, audited

The owner, of THE OVERWORLD REVISITED's six slices (`06-Systems/Travel-View.md`: OW-QUEST, OW-DUNGEON-SIZE, OW-FORECAST,
OW-CHASE-RANGE, OW-ROAD-TRUE, OW-TOWN-WALK): **"Audit this and ensure perfection"**. This page is the findings, each with
its verdict; what the audit changed is written into the record as it now stands (`06-Systems/Travel-View.md` THE
OVERWORLD REVISITED, its Port-Ledger rows), each change marked AUDIT OW-REVISITED and its id in the code.

## How it was run

Six cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at cbd9c5a50 - the six slices merged
onto main - per Home.md's DO NOT FIX WHILE THE VERIFIER IS READING), each told to prove a finding by a node script over
the real modules before reporting it, over Daggerfall's own data (ARENA2, `tools/fetch-data.sh`); then every finding was
reproduced again on the live tree, fixed, and pinned by a test a recorded mutant fails:

| Lane | Over | How |
|---|---|---|
| L1 - the town walk | OW-TOWN-WALK: the way, the walk, the gates, the pace, the host's grids | the host's own `createTownWalk` over a real `StreamingWorldState`, every city's real CityNavigation and gates, the real autopilot walking each way at motor.js's step |
| L2 - the road | OW-ROAD-TRUE: every routed leg against the road the painter draws | the real planRoute, routeLegs, town ring, Travel Options, autopilot and steering over 400 real routes at x1 to x100, 20 to 60 fps and a 0.25 s hitch; the base (ed376d558) flown beside |
| L3 - the forecast | OW-FORECAST: every word against the sky the traveller will stand in | 200-route fleets on Hazelnut's roads at the real per-leg pace, offline and online, against `sampleWeatherField` on arrival |
| L4 - the chase | OW-CHASE-RANGE: the wire, the relay, the hearing, older clients and relays | a word through a real Room to a real OnlineSession; the base's client (`git archive`) reading the new frames |
| L5 - the quests and the dungeons | OW-QUEST and OW-DUNGEON-SIZE | the real marks module over the real tracker; all 15,251 places and 4,238 dungeon entrance models measured |
| L6 - the record, the pins, the merge | every sentence of the record, every pin under its own mutants, the repo's laws, the merge with main | the six mutant lists re-run, the gates, HOST-SPLIT's counts, every world224 pin |

The scratch scripts are the session's (`scratchpad/audit/`); none is committed.

## The design calls

- **A held strafe on a road leg** (L2-5): TRAVEL-STRAFE kept the hand's sidestep; OW-ROAD-TRUE's pursuit pulled it back
  before the steering saw it. While the key is held the run's own bearing is walked, the body beside the line where the
  hand put it; let go, the pursuit takes it back to the road - the owner's "it should never offset" read as the route's
  law, the strafe as the hand's moment. Made in the audit without the owner's word; one line to turn round
  (`travelSteer.js steerDrive`).
- **The chase words beside the mark, not in it** (L4-1): a mark of eight keys was refused whole by every older client,
  so the traveller vanished from their book; the words (`bd`, `sr`) ride beside the mark, the mark stays TV3's seven.
  RELAY_VERSION world225 was re-hashed in place (never deployed); merged with main the same day, it is world230.
- **"Fair"** (L3-11): kept in English, the forecaster's word for "no rain, snow, storm or fog"; re-drafted where a
  translation read as "sunny" (German, Polish).

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1-1 | HIGH | **The street walk never passed a turn sharper than a right angle**: a body on the next run still projects inside this one, so the run never moved on and the walk hovered at the corner - 37% of the game's ways have such a turn; 21% never arrived, steering on 41 of 93 stopped "stuck" or "blocked" | FIXED: the run moves on while the body stands nearer the next run (`travelAutopilot.js pathPursuit`) |
| L1-2 | MED | **The walked line kept the body's centre on the street, not its capsule**: runs grazed footprints (86% within 0.35 m), the first run from the body unchecked, the look three frames' steps past STREET_LOOK (riding at 30 fps 1.6 m into a building) | FIXED: runs string-pulled TOWN_WAY_MARGIN (0.3 of a cell) clear of every covered cell (`townWalk.js clearLine`, `simplifyWay`); the first run checked from the body, its own cell kept when it is not clear; a street walk's look capped at STREET_LOOK (`lookMax`) |
| L1-3 | MED | **The steering fought the street walk at every corner**: it asked nine metres of corridor along the run's bearing, past the corner the street turns at | FIXED: a line's leg asks its corridor to the run's end (`travelSteer.js steerDrive`) |
| L1-4 | MED | **Every walk round a city's ring held at x5, "in town"**: the ring runs inside the city's grid, in the fields outside its walls - 100% of 2,296 ways round | FIXED: the governor's town is the street piece within the walls (`townWalkHost.js townPace`); a wall that does not close counts as all town |
| L1-5 | MED | **A gates-shut word leaked into the next journey** when another stop ended the journey the same frame | FIXED: cleared at a journey's begin, resume and interrupt (`travelOptions.js`) |
| L1-6 | MED | **Seven pins could not fail** (the grids' eviction and stale base, the sea, arrival's buffer, the aim, the pieces' cache, the run's start) and one assertion read an array never written | FIXED: pinned (`audit_owrevisited_walk.test.js`), all seven dead |
| L1-7 | LOW | **A kept journey grid cost ~8.3 MB, not "256 KB"**, and kept a rebuilt pixel's grid alive | FIXED: the comment says ~8 MB; a grid keyed by its town and gates, a rebuilt pixel's dropped (`journeyGrid`, `gridsKept`) |
| L1-8 / L3-13 / L6-8 | LOW | **The held line half translated**: "Held to ×5 of ×100 in der Stadt" | FIXED: the whole line and its four reasons through the text core (`travel.held.*`), drafted for the 25 languages |
| L1-9 | LOW | Edge cases: a way bending back arrived across a wall (121 of 2,426); a town re-entered on the same leg walked straight; a spot clicked deep in a building walked to straight from the way's end (2.2% of covered cells over 6.4 m from a street); all 19 windmills on cells the grid reads as street; a gate swung at dusk mid-walk | FIXED the first two: a line's leg arrives only on its last run (`laneUpdate`), the town watch forgets a town on leaving. KNOWN: the deep click (the way ends at the street cell nearest it; the steering meets the wall) and the windmills (the steering meets them). NOT REPRODUCED: the gate's swing |
| L2-1 | MED | **A place's last road leg arrived at the lane's end wherever the body stood** - 51 m outside Privateer's Hold, 150 m on a resume past the pixel's middle (a regression) | FIXED: the leg's line runs on to the place's middle when the lane ends outside its rect, and a place is arrived at only in its rect (`finalPath`, `laneUpdate`) |
| L2-2 | HIGH | **A spot journey on the roads never walked its last road run on the road** - 46 to 280 m off it, 231 m across a bend | FIXED: the last road leg walks the road to the point nearest the spot, then leaves it (`finalPath`, `finalRoadVia`); the drawn line through it (`routeDrawPoints`) |
| L2-3 | HIGH | **A route through a town on a diagonal left the road at the ring**: a diagonal side's pass point was the band's corner, up to 72 m off the road's diagonal - 245 of 400 real routes | FIXED: the pass point on the road's diagonal through the town's middle (`ringPassPoints`), the corner square walked round when the walk passes it; the legs on and off a ring laned from the ring point (`routeLane`) |
| L2-4 | MED | **The laned drive overshot corners at speed** - 10.8 m at 30 fps, 26 m at 20, 105 m on a 0.25 s hitch | FIXED: the force cut so a frame lands on the run's end, down to LANE_CORNER_FORCE_MIN (0.25). KNOWN: a hitch frame past that floor still carries the body over, back within frames |
| L2-5 | MED | **TRAVEL-STRAFE undone on laned legs** - a held strafe settled 12.8 m out and snapped back (the player-reported bug again) | FIXED (design call above): the run's bearing walked while the key is held (`runYaw`) |
| L2-6 | LOW | **The record misstated the defect it fixed**: the 819 m carry is the mod's with Avoid Obstacles off; on (the default) BACK TO THE LINE took the body back to the leg's own line - beside the road when the leg began off it (102 m near corners) | FIXED: restated (record, `travelAutopilot.js`) |
| L2-7 | MED | **Two pins could not fail**: the lane after a ring, a track as a place's last leg | FIXED: pinned; the reinit's `lastAt` recorded equivalent |
| L2 (aside) | LOW | ROAD-BRIDGE's "the traveller never left the road" is false once: 923,244 to 928,257 bridges an open leg 578 m from any painted road. Outside this diff | RECORDED in its comment (`travelOptions.js bridgedRoadLeg`) |
| L3-1 | HIGH | **The forecast did not come true once the pace changed along the way**: the whole 40 km asked at the pace of the moment (a road x100, the open ground x60, a track's cautious force, a town's x5) - 35% of "ahead" lines untrue on arrival offline, 81% at an online journey's start | FIXED: each stretch at its own pace (`wayAhead`, Travel Options' `wayPace`, `wayMinuteAt`), scaled from the pace measured; pinned against a physical walk over the real map |
| L3-2 / L6-1 | MED | **Streets already walked stayed in the way ahead** (+1.5 km) | FIXED: the drawn line and the forecast share one way still to walk (`travelRoute.js wayStillToWalk`) |
| L3-3 | MED | **A stopped journey forecast at the pace it no longer had**, ~20 s | FIXED: here said the frame nothing drives; the meter starts again |
| L3-4 | MED | **The air read at the ground's mean height**, the sky at the traveller's feet: "Rain - snow in 45 min" under falling snow (2.5% in mountains) | FIXED: here and the way's now at the traveller's height (`weatherAt`/`forecastAt` `alt`, `lawAir`); far places at the ground's |
| L3-5 | MED | **Weather between samples missed** at a 1.6 km step | FIXED: ROUTE_STEP_M 400 (ROUTE_SAMPLES_MAX 101), read a few a frame |
| L3-6 | MED | **The "real map" pin used a woodland map**, its "comes true" re-asked the law's question; ten mutants survived | FIXED: the real map and a physical walk (`audit_owrevisited_forecast.test.js`), the ten dead; the old pin's claim corrected |
| L3-7 | LOW | **A card frozen a 15-minute bucket**, "in 15 min" for a change six minutes off | FIXED: kept a minute; the change found to the minute (a bisection) |
| L3-8 | LOW | **The line outlived its journey** by up to 2 s, into the next | FIXED: never said of a journey that ended; here while a new one's first pass reads |
| L3-9 | LOW | **A forward clock step inflated the ETAs ~6x** | FIXED: a step past PACE_CLOCK_STEP_MIN, or a gap past PACE_GAP_S, starts the meter again |
| L3-10 | LOW | **A pass took up to 26 ms in one frame** | FIXED: FORECAST_SLICE places a frame |
| L3-11 | LOW | **Four words never shown**, "Fair" translated as sunny | FIXED: the four removed with their rows; "Fair" re-drafted (design call) |
| L3-12 | LOW | **"2.4 km" in German** | FIXED: the language's own figures (`kmWords`) |
| L3-14 | LOW | **Sun Baby's sun, and the forecast still announcing storms** | FIXED: nothing said while an event holds the sky (`held`) |
| L4-1 | HIGH | **An older client dropped every traveller whose mark carried `bd`** - for the rest of a session after one band encounter | FIXED (design call above): the words beside the mark; an older relay ignores them too, so no relay gate (`relaySupportsTravBands` gone) |
| L4-2 / L6-2 | MED | **A far chase never withdrawn**: drawn 25 s after it ended, through a clear or a leave; a welcome's row heard whatever its age | FIXED: withdrawn when the mark no longer names it, a clear, a leave, a welcome that no longer lists them; a row's age taken from its word (`scenes/regionChaseHost.js`). KNOWN: a band spent as the chaser goes indoors is cleared with the mark, unsaid to the region - the cell's ledger (OW6L) carries it |
| L4-3 | MED | **WILD1 leak**: a hidden zone traveller's chase drawn where they rode | FIXED: nothing heard of one the map hides |
| L4-4 | MED | **A chase unseen for up to 7 s at the cell's edge** | FIXED: heard at every distance, a fresh cell word for the same id preferred |
| L4-5 | MED | **A chase word not tied to its sender's place**: anyone in the region could spend every band about a reader | FIXED: heard only from a sender within REGION_BANDS_NEAR_PX (9) / REGION_RAIDERS_NEAR_PX (19) - as near as the cell's word's trust |
| L4-6 | LOW | **One 8-slot word**: band spends crowded out raider spends; dead lives filled it | FIXED: two words, each its own slots; a spent one of a life gone by never said |
| L4-7 | MED | **Two door checks unpinned** (the z bound, a spent one's place) | FIXED: pinned, dead |
| L4-8 | LOW | **A moored traveller near any raider ship sent a mark every 10 s** | FIXED: refreshed only while a chase runs |
| L4-9 | LOW | **One bad entry in my word refused my whole mark** | FIXED: each word checked apart, a bad one dropped alone |
| L5-1 | MED | **The quest diamond ~100 m off every main-quest dungeon** (the eight CUST places stand off their pixel's middle) | FIXED: at the place's middle, the host's own place law (`tvPlaceRect`), the pixel's as fallback |
| L5-2 / L5-3 / L5-4 | MED-LOW | **Pins that could not fail**: TRACK-ONLY on the Overworld, the distance, the hold's release, the gold | FIXED: pinned, dead |
| L5-5 | LOW | **Two edge arrows for one place** on a journey to the followed quest | FIXED: the quest mark not held at the edge where the journey's end stands |
| L5-6 | LOW | **The mark's time line English in every language** ("1 day 1 hour left"), and the held map's "N quests", "+N more" | FIXED: through the text core (`questRail.js remainWords`, `timeLeftWords`; `questMarks.js`), drafted for the 25 languages |
| L5-7 | LOW | **Two record sentences untrue**: a press follows the Path switch, not "the roads"; the time is the first quest's, not "the followed one's" | FIXED in the record and the code's comment |
| L5-8 | LOW | **"One height for every dungeon"** is false for 155: 123 keeps' entrance model (43600, 0.58 m) stands 6.9 m at OW-BIG's twelve; 30 models stand over 24 m (to 32.25 m) | RECORDED, not changed: OW-BIG's cap and "never under its own size" are the owner's |
| L5-9 | LOW | **Two stale comments** in `travelDungeonModels.js` | FIXED |
| L6-3 | MED | **"The city gates are shut" for any way short at night** - a yard the houses close in blamed on the gates (53 of 82 cities have such a piece) | FIXED: `shut` only when the gates open would have let the way through; else the way walked as far as it reaches |
| L6-4 | MED | **The shut word unpinned** | FIXED: the word pinned, dead |
| L6-5 | LOW | **Two forecast assertions could not fail** | FIXED: both removed |
| L6-6 | LOW | **Three slices' records did not name the four hosts** | FIXED in the record |
| L6-7 | LOW | **Stale sentences**: TV5's "eighth key", OW-DUNGEONS' host and grow, `townWalk.js`'s `gatePassages`, "twice as quick" (1.6x re-measured), "1,776 of 1,920" (the twelve greatest cities' doors), the governor list without `ow_lead`, the TV7b note, Host-Split's count | FIXED in the record and the code |
| L6-9 | LOW | **"67 ms at the worst, once a leg"** hid that a grid's first ask labels its pieces (62-114 ms) in the frame the leg starts | RECORDED: re-measured (19,680 of 19,680 ways, every run clear with the margin, 6.9 ms mean, 61 ms worst) and said |
| L6-10 | LOW | **The town cap pinned by source text alone** | FIXED: the governor run in a town (`ow6_slowdown`) |

## What was sound

The location-frame transform, the gates (all 1,640 open by day, every passage three cells through the arch), the shut
stop both ways at night and never by day, arrival at a town's edge, the cost per frame (L1); the lane is the road -
laned offsets median 0, p99 under 33 units over 40 routes - and boulders and walls on the road walked round and back (L2);
the forecast's word equals the sky's at a steady pace on 750 real routes, the meter's resets, the way's slicing (L3); a
word end to end through the real Room, the attachment under 2 KiB at its widest, rate limits unmoved, the relay's version pins
(L4); no size left that depends on distance, the quest marks' place law and press (L5); every committed mutant dead, the
gates, HOST-SPLIT's counts and the merge's world224 pins (L6).

## HOST-SPLIT

The audit's fixes grew the region's hearing past three lines, so it moved out: `scenes/regionChaseHost.js`
(`createRegionChaseHearing`), wired by `bootWorld`. `bootWorld` 36,181 at the snapshot, 36,205 after the audit (the
hearing's wiring, the forecast's new inputs, the bands' and raiders' preference for a fresh cell word) - under its 36,233.

## Pins

`test/systems/travel/audit_owrevisited_walk.test.js` (11: L1-1, L1-2, L1-3, L1-4, L1-5, L1-6, L1-9, L2-1, L2-2, L2-3,
L2-4, L2-5, L6-3, L6-4), `test/systems/weather/audit_owrevisited_forecast.test.js` (6: L3-1, L3-3, L3-4, L3-6, L3-7, L3-8,
L3-9, L3-10, L3-12, L3-14), `test/systems/travel/ow_chaserange.test.js` (7, rewritten for L4), `test/ui/travel/owquest.test.js`
(6: L5-1 to L5-6), `test/systems/travel/ow6_slowdown.test.js` (the governor in a town, L6-10). `tools/mutants/audit_owrevisited_walk.json`
(35: 34 dead, 1 recorded equivalent), `audit_owrevisited_forecast.json` (31: 30 dead, 1 equivalent), `audit_owrevisited_chase.json`
(22, dead); re-aimed and grown: `ow_chaserange.json` (23), `owquest.json` (17), `ow_forecast.json` (26), `ow_roadtrue.json`
(16: 15 dead, 1 equivalent), `ow_townwalk.json` (46) - every one dead.
