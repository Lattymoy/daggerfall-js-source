# AUDIT LW-III - THE LIVING WORLD, AUDITED WHOLE, AND THE CARAVANS' WAGONS, 2026-10-11

Mac: *"Can we audit the living world system. Additionally, I think there are issues with AI caravans clipping with
their wagons"*, of main at `314ff136`: the whole living world (`06-Systems/Living-World.md` LW0-PERF-WAYS1,
`06-Systems/Living-World-II.md` LW9-LW16) and, first, the caravans' wagons.

## The method

- **Find.** Four independent reviewers over a frozen snapshot of the head (a detached worktree), read-only, every claim
  reproduced by a script of its own against the real modules on the tests' synthetic towns and map (no game data):
  - **T - the living town** (LW1-LW2, LW-STAND to LW-STIR, PERF-WAYS1);
  - **R - the roads, trouble and outlaws** (LW3, LW4, LW4b, LW-DRY, LW9, LW12);
  - **C - the caravan's door, the deeds, the patrons and the word** (LW7, LW11, LW15 and its service, LW16);
  - **D - the deep, the ports and the companies** (LW5, LW6, LW13, LW14).
- **W - the caravans' wagons** (LW10, the ask's own), by the lead: a probe laying every party of the synthetic map as
  the roads' layer lays it - the train on the march, the fight's ring at a halt, the camp's ring and its parked teams -
  minute by minute, and counting what stands in what (the Small Cart's footprint and the pool's horse box).
- **Fix.** By the lead, after every lane reported (DO NOT FIX WHILE THE VERIFIER IS READING). Each fix pinned in
  `test/systems/livingWorld/auditlwiii_wagons.test.js` (8), `test/systems/livingWorld/auditlwiii_road.test.js` (2), `test/systems/livingWorld/auditlwiii_town.test.js` (4),
  `test/scenes/auditlwiii_deep.test.js` (3) and one new test in `test/systems/livingWorld/lw4b_roadFights.test.js`, and mutation-proven in
  `tools/mutants/auditlwiii.json` (50: 48 dead, 2 equivalent as recorded). A pin elsewhere a fix moved says so where it
  stands (`PIN MOVED (AUDIT LW-III)`); the 26 earlier records a fix moved are re-aimed by content, their names kept,
  all dead.

## W - the caravans' wagons (`test/systems/livingWorld/auditlwiii_wagons.test.js`, 8)

The probe, four synthetic days (1,012 trips, 652 with a team), before and after:

| what stood in what | before | after |
|---|---|---|
| a wagon in another party's wagon (minutes) | 464 (9 pairs; 240 at shared camps, 217 walking one way, 7 met) | 0 |
| another party's people in a wagon | 82 pairs, 130 minutes | 0 |
| a hold-up's ring or its foes in a wagon / a horse | 14 / 48 | 0 / 0 |
| a parked horse's body in its own cart | every camp minute | 0 |
| a wagon's shafts off its horse at a corner | up to 31 degrees | 0 |

All FIXED:

- **W1 - every party walked the road's one line** (the way is the road's middle), so two that met drove through each
  other, and two caravans that stayed in one town and set out home at one dawn at one pace walked one inside the other
  for every mile their ways shared. FIXED - KEEP RIGHT: a party on the march walks LANE_N (2 m) right of the road's
  middle, the way it goes (`wagons.js trainOf`'s `lane`, `livingRoads.js partyPlaces`'s), so a party met passes side by
  side; and ABREAST (`livingRoads.js roadLanes`): of two on one stretch walking one way, the faster - at one pace the
  later trip - walks ABREAST_N (3 m) farther right while their files are within ABREAST_GAP_N, easing over
  ABREAST_EASE_N along and across, so nobody jumps aside. Both on the road's 12.8 m (travelPaths.js P_SIZE): a wagon's
  far side at most 6.2 m off its middle. A drawing's law, like the camps': no timeline moves.
- **W2 - a lane round a corner** jumped (wayAt's heading turns at the corner's point, and a point beside it jumped
  `2 side sin(turn / 2)`) or, inside the corner, folded back on itself. FIXED: `trips.js laneAt` rounds the way's line
  over LANE_EASE_N (10 m) either side of a corner - the quadratic curve with the corner its middle control, tightest
  at `LANE_EASE_N / sqrt 2` (7 m) for a right angle, wider than any lane - and lays the lane off that.
- **W3 - a wagon faced the road's heading at its axle**, so for the hitch's 3.8 m past every corner its horse walked
  out of its shafts, and the wagon turned all at once as its axle crossed. FIXED - THE TRAILER'S LAW (`chordBehind`):
  each axle stands its hitch STRAIGHT behind its horse, on its lane - the first such point back along it - and faces
  it; the next team WAGON_TAIL_N straight behind the axle. A wagon now turns at most 0.66 degrees between two frames
  0.05 of a minute apart (it was 4.5).
- **W4 - two caravans of one shared camp parked round its fire each its own way**, and stood their wagons in one
  another. FIXED - ONE CAMP, ONE PARK: `campGroups` gives each party its slots of the camp's teams (`k0`, `teams`,
  turned the first's way) and `campTeam` stands them round one park, grown to CAMP_TEAM_ARC_N (5 m) a team
  (`livingRoads.js campParkOf`, the layer's one door). A lone camp parks as LW10 did.
- **W5 - a parked horse faced out from its cart's side** (a quarter turn), and its 2.6 m reached back into the bed.
  FIXED: tied alongside, facing the fire as its wagon does.
- **W6 - a hold-up's ring stood about its leader**, a stride before the first horse, and its foes 4.75 m out: the
  unarmed stood in the horse, the foes behind in the cart; the live fight's foes (FOE_STAND_M, 7-13 m) rose inside a
  great house's second wagon's box on the collider. FIXED - CLEAR OF THE TEAM (`wagons.js clearOfTeam`): a body in a
  wagon's footprint (the Small Cart's own, MEASURED.cart) or a horse's (the pool's HORSE_BOX_SIZE) goes out by the
  nearest side, BODY_CLEAR_N beyond - the drawn ring and foes (`foePlaces`' `team`), and the live stand's bodies (the
  roads' layer hands each beset party's team to `roadFights.frame`).

Seen and not changed: two parties whose roads CROSS walk through each other at the crossing for a stride or two
(one way each, at a right angle, the abreast law reads neither); a moving wagon still claims no box on the collider (a
box that moves under the player traps them - WAGONS3's own "spawning the wagon can trap you").

## R - the roads (`test/systems/livingWorld/lw4b_roadFights.test.js`, `test/systems/livingWorld/auditlwiii_road.test.js`)

- **R1 (HIGH) - the pool's relevance cull ended a stood road fight**: a fight is stood within LIVE_M (150 m) and kept
  to LIVE_KEEP_M (260 m), and its bodies were spawned unmanaged, so exteriorFoes.js's cull (ENCOUNTER_CULL_DISTANCE,
  120 m) marked every one dead - and the fight read each ally a hand death at the player's side, its foes fallen and
  the fight won, its fated spared. The same in roadStands.js (KEEP_M 200 m): a culled hostile was slain (a crime the
  caravan reports), a culled friend dead at the player's side. AUDIT LW-II C3 had fixed this for the hideouts alone.
  FIXED: both spawned `managed` (their own reach lets them go), and KILLED, NOT GONE - a body is down only where it was
  killed (hideouts.js `killed`: dead with a corpse, or executed); one gone without a kill is neither a fall nor a win.
- **R2 - a party halted across nightfall** with an inn or wet ground ahead stepped out of its halt as far on as it would
  have walked meanwhile - 167 m in a minute at a pedlar's pace. FIXED: the walk on to the night's stop counts the
  minutes walked since dusk, the halt's own out (`trips.js partyAt`'s `held`). The lane's fuzz over 4,700 trips with
  roadside inns: 7 jumps at the calendar's pace and 9 at online's, none after.
- **R3 (open) - an inn's place on its way is the first route pixel within reach**, not the nearest, so the way out and
  the way home stand one inn at two places a pixel apart. The pin (`lw9_traffic` "where the way first comes within a
  pixel") and the doc ("where the way comes nearest it") disagree; a lodged party is indoors either way. Mac's call.

## C - the caravan's door and the patrons (`test/systems/livingWorld/lw11_caravan.test.js`, `test/systems/livingWorld/auditlwiii_road.test.js`)

- **C1 - the escort's door read the caravan's future**: a trip is fated as it is minted, and the door refused any trip
  `turned` - so the caravan the dice would turn home never offered "hire on", a day before its trouble: the one an
  escort could save (a fight won turns the fate), and its missing row told the player which caravans the road would
  meet. FIXED: offered until it turns - its way out ends at its trouble's minute, and the escort's step reads the turn,
  unpaid (AUDIT LW-II C5c).
- **C2 - a trader's read scanned its town's whole patron history**: `idx_patron_sales_town` is (map, hour) and the read
  was bounded on `at` alone, so every stall opened read MARKET_KEEP_DAYS of sales (8,640 at the ceiling) to answer its
  last day's. FIXED: bounded on the hour too (`patronsTold`; a sale's `at` is its hour's, so the bound drops none).
- **C3 - PINNED: after a load the robbery holds** - the hold-up's `robbedOf` guard (the session's `yielded` gone) had
  no pin of its own.
- **C4 (open) - "reckoned late, the same sales" (Living-World-II.md 8.2) is false for one seller with traders in two
  towns**: the reckoning runs town by town, then hour by hour, and once the seller's day ceiling binds the two orders
  sell different pieces (hourly A 8 / B 5, late A 10 / B 3). Mac's call: the doc amended, or late catch-ups reckoned
  hour by hour across the towns.
- Not counted: a caravan's shelf's materials read the character's level (the places stand, two of 24 materials change
  after a level-up and a load); the counter's mark is the client's (already recorded). The lane found no gold or item
  duplicated, no escort paid twice and no sale a client could forge.

## T - the living town (`test/systems/livingWorld/auditlwiii_town.test.js`, 4)

- **T1 - what one reader alone has moved other people**: one lent to the watch was left out of the spot's deal (every
  circle after theirs re-paired, in 186 of 186 lends), and a trample or a strike-down freed its circle's places, so
  everyone alone at the spot stood anew (59 of 140 tramples in an open town, 98 of 140 close-built, up to 15 people).
  LW-TALK and LW-SPACE say every reader deals and lays alike; AUDIT LW-STIR B2 had fixed it for the incidents alone.
  FIXED: the lent are dealt still, in the census's order (and left out); the deal's whole laying is taken
  (`_circled`); one left of a circle short of two, and the left out, hold their place in the deal (`_holding`). After:
  1 of 186 (the lent's own circle re-dealt in a new round), 0 of 140, 0 of 140.
- **T2 - two of a three-circle stood 0.63 m apart** where nothing about its middle was open: the line along the way out
  clamped each member on their own. FIXED: laid whole (`meetups.js circleStands`), drawn back from the way's hold or
  spread its length.
- **T3 - a walker in early stood in no street and no room**: the plan budgets a walk at more than its line takes,
  `where` had them in through the door and `insideAt` not until the walk's planned minute - 657 of 761 walks into a
  room, 7.9 minutes on average. FIXED: in with the stay they walked to.
- **T4 (open) - a household beyond the census** (a Legacy house's own, LW's `extraPeople`) is dealt into its player's
  town's circles, which another player's reader does not have: 183 of 400 beats dealt apart. The fix (deal without
  them, pair them among the alone) is a design call, Mac's.
- **T5 (open) - neighbouring spots are laid on their own**: the square's points stand 9.6 m apart and a spot's circles
  reach 8.5 m, so two circles of neighbouring points stood 0.43 m apart for 13.8 clock minutes (42 of 720 beats in nine
  towns). Laying a beat's spots together breaks `circlesStands`' per-spot cache; left for its own slice.
- Unpinned, not changed: a pair alone at a spot talking (`_tick`'s `< 2`), the greeting's reach, the alone ring's
  inward step - each survives a one-line mutant.

## D - the deep (`test/scenes/auditlwiii_deep.test.js`, 3)

- **D1 (HIGH) - remains laid before a save made inside the dungeon were laid again on the load**, beside the pile the
  load restored - the same weapon, armour, purse and keepsake, one more set each save and load, and emptying the
  restored one marked nothing. FIXED - ONE PILE A BODY: the pile tagged with its remains' key (`dungeonContext.js
  layRemains`), kept through the save's row and `droppedLoot.js restorePiles`, and adopted by the layer
  (`deepRemains.js pileOf`) instead of laid.
- **D2 - online, a reader that lost the divers' election kept its companies**, and the reader elected met them again
  at their stop: every member twice in the room. FIXED - the outlaws' AUDIT LW-II-2 C13, here: asked each frame, and
  the loser gives up every company not drawing on it.
- **D3 - the way out's last leg was walked at the first stop's floor**: both hosts dropped the entry's y. FIXED.
- Unpinned, not changed: the route's nearest-next chain against a sort by distance, the walking leg's floor, a hostile
  body arriving after its company was let go, a town of exactly COMPANY_CITY_ADVENTURERS, the holy day's departure
  modulus - each survives a one-line mutant on the lane's eleven files. A pending way read could, in principle, end a
  company still inside (57,600 reads, none did).

## The record

- Each lane's "checked and found sound" lists are its own; the lanes' scripts are not committed (they read the
  snapshot by path).
- Living-World-II.md section 3 (LW10) and 4.5, and Living-World.md LW6b, carry the laws above where they stand.
