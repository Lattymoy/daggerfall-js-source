# The naval crew and ship-life hand-off, 2026-09-30

Mac's six-part ask for the sea, 2026-09-29:

> 1. Ships should be improved AI, actively port at docks and depart, sail
>    out in open waters and naturally do their own thing. I really want to
>    give intelligence and agency to the AI
> 2. Walking on the deck gives water sounds, hunting notifications appear
>    when sailing, shooting cannons should have attack canceling.
> 3. Improve the overall mobility and maneuverability of ships
> 4. Crew members shouldnt be the static sprites and instead the enemy type
>    sprites with multiple animations, they should navigate the deck, talk
>    with each other, blurb, sing chantys, etc
> 5. Boarding scenarios should be seamless, with crew naturally getting
>    into position and fighting enemies. There's an issue where
>    enemies/allys can navigate on the railing of ships.
> 6. Ally crew member's should have green health bars above their head,
>    and not be able to engage in friendly fire.

It was cut into five slices. Three are on the naval PR (#456, branch
`ccr-08848d60-ieuci5`). The fourth was finished and parked, and the fifth
is designed but not built. On 2026-09-30, with slice D finished and
verified but not yet committed, Mac said: "Lets pause before slice D and
log it for another session". This page is that log.

Later that day Mac said to the next session: "Just wanna pick up where the
naval session left off. Slice D". That session brought main in and landed
slice D. The PR's branch is its author's, so both ride a branch of their
own, `claude/exciting-keller-prkcjt`: the PR's A to C, then main, then D.

| Slice | Mac's items | State |
|---|---|---|
| A - DECK-FIELD | 2 | on the PR, `0d41a1fb3` |
| B - HELM-WAY | 3 | on the PR, `735f0c447` |
| C - DECK-WALK and SHIPMATES | 5 (the rail), 6 | on the PR, `304ec692d` |
| D - LIVING CREW | 4, 5 (seamless boarding) | **landed** 2026-09-30, `7feab89ff` merged onto `claude/exciting-keller-prkcjt` (`c394e9520`) |
| E - SHIP-LIFE | 1 | **landed** 2026-09-30 (Mac: "Do it") - `systems/naval/shipLife.js`; `03-World/Naval-Combat.md` SHIP-LIFE. The design below is kept as the reading that shaped it |

## First: the PR was behind main - brought in 2026-09-30

**Done.** Merge `2ac2fc5b4` on `claude/exciting-keller-prkcjt`. By then
main was 38 commits ahead: #464, REP1-REP6, had landed too. The merge
conflicted in 79 files:
- 75 were citation numbers only, a hunk whose two sides differ in digits
  alone, and none of them a number in code. They took main's side.
- 4 were real. `Active-Arcs.md` keeps both sides' entries. `Systems.md`
  keeps both sides' modules, with the census at the tree's own 324.
  `court.js` and `regionConditions.js` keep main's REP rewrite of the
  banishment comment, which the PR had only re-numbered.

Then the recipe below, as written. citeMerge moved 182 cites. CD4 named
seven `world.js` cites, re-pointed by content. mutantdrift named two
survtiers3 records, re-aimed and dead. The suite line was recounted. The
full suite: 16090 tests, 15828 pass, and the one failure was those two
records.

Main moved again while slice D landed: #463 (FB0930-FOE-RAYS) and #459
(MW-BRIG3, WERE-FRIGHT and its audit). Merge `4ed3f598b` brought them in
the same way. 52 of its 53 conflicted files were citations only, and
`Active-Arcs.md` keeps both sides' entries. citeMerge moved 125 cites and
CD4 named six. The full suite: 16131 tests, 15870 pass, 0 fail.

The page as first written:

When this page was written, `main` (`066fe8a5c`) was 31 commits ahead of
the PR: #444, #457, #458, #460, #461 and #462. A trial merge conflicted in
72 files:
- the bible's citations;
- citation comments in `src/`;
- the pins and mutant records that quote them.

It was left alone because of Mac's pause. Bring it in before anything
else. Follow the recipe this branch's earlier merges used:
1. Merge `origin/main`.
2. Resolve each hunk by content, not by number.
3. On the conflict-free tree, run `node tools/citeMerge.mjs origin/main
   <our-head> --apply` once, before the merge commit.
4. Fix whatever CD4 names.
5. Recount the Testing page's suite line.
6. Run the full suite.

## Slice D - LIVING CREW, landed 2026-09-30

**Where it is.** On `claude/exciting-keller-prkcjt`, merge `c394e9520`.
The branch `ccr-08848d60-ieuci5-living-crew` was merged there after main
came in. It holds the single commit `7feab89ff`, pushed with Mac's
approval and cut from `304ec692d`, the PR head at the time.

**What it does.** A ship's crew stands on her deck as DFU's own mobile
units: each crew class's sprite, idle and walking, turned to the eye as
`characters/mobileUnit.js` turns every mobile. They work the deck. They
have stations and walk between them on the deck model's A* paths. They
talk in pairs, call out blurbs by faction and by battle, and sing three
original chanties. When the grapnels fly they muster at the rail. Within
`CREW_RANGE` (110 m) of the eye, the hull's people flats on or above her
main deck stand down and the living crew stands in their places. Beyond
`CREW_KEEP` (130 m) the flats stand again. A galley's rowers below her
deck are never touched. Boarding becomes seamless: the muster and the
hands are the crew already standing on deck. `crewOf` takes each man
where he stands, with his own class and sex. The landing is a deck point
next to the player. A party going over the rail is dealt rail spots
(`deck.rail(side, z)`, the outermost deck cell of that row).

**The files.**
- `src/systems/naval/crewLife.js` (new): the pure crew brain. It holds the
  roster, stations, walks, talk, blurbs, chanties, the grapple muster and
  take/trim.
- `src/scenes/navalCrew.js` (new): the host. It stands the flats down,
  draws the sprites and gives the speech with each speaker's head point.
- `src/systems/naval/navalDeck.js`: adds `rail(side, z)`.
- `src/scenes/navalHost.js`:
  - boarding takes the muster, hands and party off the crew (`crewOf`,
    `landing`, `railSpots`);
  - adds `crewShips()`, `myCrew()` and `boatOf()`.
- `src/scenes/world.js`:
  - the board deps;
  - `navalCrewFrame`, which runs after the foe pools move and before the
    town watch;
  - the crews' batches in the people pass;
  - the speech drawn by `navalHud`'s `drawCrewLines`.
- `src/scenes/comeSailAwayPeers.js`: a peer's boat carries its `peerKey`,
  which seeds its crew.
- `test/livingcrew.test.js` (13 tests) and
  `tools/mutants/livingcrew.json` (54 records).
- Docs:
  - the Naval-Combat "LIVING CREW" section;
  - the Port-Ledger "THE CREW LIVES" row;
  - the Testing row and suite line;
  - the patch notes' "A living crew".
- `node tools/citeShift.mjs --apply` moved every citation that the
  source moves shifted. That is why the commit touches about fifty
  bible and source files by a line or two each.

**How it was verified on its own tree.**
- The full suite: 16003 tests, 15740 pass, 2 fail, 261 skipped. Both
  failures were pins the slice itself moved, and both are fixed in the
  commit and re-run green:
  - disc19's host-order pin was re-aimed for the crews' frame, which sits
    between the pools and the watch.
  - MACRO-7's read-site census failed because the crew's speech API was
    first named `lines()`. The census reads every `.lines(` in `src/` as a
    TEXT.RSC record read, so the API is `speech()` now.
- The gates were run: citedrift, mutantdrift, ledger, doctrine,
  audit24_onehome, boot2, audit18, landing, manifest, relayversion.
- eslint and `npm run types` are clean.
- `tools/mutants/livingcrew.json`: 54 of 54 dead.
- `tools/mutants/deckwalk.json`: 60 of 60 dead.

**How it landed.**
1. **Merged, not cherry-picked.** This page said to cherry-pick onto the
   PR head, then run `citeShift`. With main in, `world.js` had moved about
   a hundred lines under the slice. A cherry-pick carries the slice's own
   new cites (the Naval-Combat section's, the Ledger row's) at its old
   tree's numbers, and `citeShift`, which reads HEAD against the working
   tree, never reads them as stale. Merging the parked branch lets
   `citeMerge` map every line from the side it came from, the slice's new
   lines off the slice's head. That is the case the tool was written for,
   and the history keeps `7feab89ff` as it was.
2. **The conflicts.** 68 files conflicted:
   - 66 were citation-only. They took our side, the merged head's
     numbers, for `citeMerge` to move through the slice's code.
   - In `court.js` and `regionConditions.js` the slice had only
     re-numbered the comment main's REP rewrote, so main's was kept.
   - The slice's code, tests and doc sections merged clean.
3. **The cites.** `node tools/citeMerge.mjs
   origin/ccr-08848d60-ieuci5-living-crew <merged head> --apply` moved 169
   cites. CD4 named the same seven `world.js` cites again, re-pointed, and
   the modal-frame range's close. mutantdrift named the two survtiers3
   records again, re-aimed at `world.js:5590` and dead. Every change the
   cites took is digits alone, checked line by line. The suite line: 16071
   tests across 1695 files.
4. **Verified on the merged tree.**
   - The full suite: 16103 tests, 15842 pass, 0 fail, 261 skipped.
   - The gates above, eslint, `npm run types` and the build.
   - `tools/mutants/livingcrew.json` 54 of 54 dead, and
     `tools/mutants/deckwalk.json` 60 of 60.

**The laws the slice keeps, which must stay kept.**
- Nothing in `server/src`, `src/net/*` or `src/world/mat4.js` changes,
  not even a comment. The relay's bundle hash covers them (SLAM8). At
  landing, none of them differed from main.
- No method named `lines` or `rows` (MACRO-7).
- `combat/friendlyFire.js`'s `isShipmate` stays the only spare test.
  DISC19 W5's defenders depend on it.

Its row in the table above is closed. Its line in `Active-Arcs.md` stays
open until slice E lands.

## Slice E - SHIP-LIFE, landed 2026-09-30

Mac's item 1. Built to the shape below, with what the build found on the
way: the berth's approach stands out in open water (on the berth's own line
the captains' lookout swung her off the shore for good), the last leg into
a sounded berth is free of that swing, a ship warps into or out of a
harbour on her sweeps when the wind is in her teeth, a stalled ship takes a
detour abeam, a harbour's ships are seeded by the port and the day (never
the stander's id) and are never the sea's density, and the director's
traffic gets errands only while a harbour is known. The record is
`03-World/Naval-Combat.md` SHIP-LIFE. The reading that shaped it:

### What the sea does today

- **The director** (`systems/naval/navalDirector.js`):
  - It launches ships on `SPAWN_RING` (650 to 1000 m) around a player,
    never within `SPAWN_CLEAR` (450 m) of any player.
  - It only does so while a player is on the water: navalHost's `onWater`
    gate, which calls `director.reset()` otherwise.
  - Each ship is set on a slant across the player's waters and let go
    past `DESPAWN_BEYOND` (1900 m).
  - Faction weights shift toward merchantmen and the navy when a port
    town is within a pixel. world.js `navalNearPort` asks `csaIsPortTown`,
    which reads the location's `exteriorData.portTownAndUnknown`.
  - SEA-PEACE adds pairs launched already fighting: `plunder` and
    `patrol`.
- **The captain's cruise** (`systems/naval/navalAI.js` `cruiseCourse`):
  - A random waypoint `WAYPOINT_DIST` (900 to 2300 m) away in any
    direction, sounded clear in a straight line, then a new one on
    arrival.
  - It has no purpose. Only a NAV-R raider's `ship.course` overrides it.
- **A way round land exists for a boarding** (AUDIT NAV2 F22, `navalAI.js`
  `routeTo`/`wayRound`/`legClear`): one sounded waypoint round a spit to
  a berth, the berth itself sounded (`berthOpen`), and a boarding that
  gains nothing in CHASE_GIVE_UP_S given up. It is a single detour, not
  a path - a harbour's approach still wants the water grid below - but
  its sounding is the one to reuse.
- **No dock data exists.** A port town is only a flag in its exterior
  data. A harbour has to be found from the terrain: take the town's
  footprint (`world/streamingWorld.js` `locationWorldRect` in native
  units, into scene coordinates with `localFromWorld`) and the host's
  `isWater(x, z, hull)`.
- **A moored look already exists.** Come Sail Away's `Boat` has
  `IdleObject` and `ActiveObject`, and navalHost's pose code stows a sea
  ship's sails whenever her `sails` is 0.5 or less. A moored ship is
  `sails` 0 with the idle object shown.
- **The floating origin.** Sea ships live in scene coordinates, and
  navalHost's `offsetAll` shifts every ship and its `waypoint`. Any berth,
  harbour or path point a ship keeps must shift there too, or be kept in
  native coordinates.
- **Online:**
  - The stander launches the ships. `standsSea` delegates to
    `amGroupRollOwner`, and the seeds are salted with the stander's id.
  - The naval word's ship record (`systems/naval/navalWire.js` `s`, not
    navalAI's `shipWireState`, which only a test reads) carries position,
    yaw, speed, sails, heel, damage, state, seed, fire, the run-out, the
    handover count and the region; since AUDIT NAV2 its `k` key carries
    each ship's temper, captain's mode and the ship she struck to. It
    carries no errand.
  - An errand need never be sent: the client that adopts a ship
    re-derives it from her seed and where she is. (The relay law is not
    what forbids one - the naval word sits outside `src/net/*`, and a new
    field rides a key of its own, as `k` does, so an older build's door
    passes the word whole.)

### The shape

1. **`systems/naval/shipLife.js`, pure:**
   - `findHarbour({ rect, isWater, hull })` places berths along the
     town's shore. A berth's hull footprint is all water; she lies
     parallel to the shore; berths are spaced by hull length. It also
     picks the harbour's mouth, the approach point out in open water.
   - A lazy water grid with a bounded A*: cells of about 24 m, one cell
     of clearance from the land, a node cap so a query's cost is fixed,
     and line-of-sight smoothing.
   - The errands:
     - `moored`: at her berth, sails stowed, for a seeded dwell.
     - `depart`: berth to the mouth to open water.
     - `voyage`: to another port, or out of the world on a bearing.
     - `arrive`: mouth to berth, shortening sail and easing her way off
       to a stop.
     - `patrol`: the navy's loop across a port's approaches.
     - `lurk`: a pirate off the trade lanes, where merchantmen pass.
2. **navalAI:** the cruise branch asks the errand for its plan: `want`,
   `goal`, and `sails`, with the berth approach easing her way off.
   Hostility still decides first. A navy ship at her berth answers a
   pirate, and a merchantman flees from one. When the fight ends the
   errand resumes with a re-planned path.
3. **navalDirector:**
   - Errands are handed out at launch, by faction and waters.
   - A harbour roll stands a port's moored ships. It is seeded per port
     and per day, so every player in that port sees the same ships, and
     the ships come from a harbour budget apart from the sea's density.
   - Departures follow each ship's dwell, and arrivals take the free
     berths.
4. **navalHost:**
   - The harbour's traffic runs near a port even while the player is
     ashore. The sea's general traffic keeps its on-water gate.
   - `offsetAll` shifts the harbour and path points.
   - Handover (`adopt` and `rekey`) re-derives each errand.
5. **Tests:**
   - Run it all on a synthetic coast with a bay, a headland and a town
     rect.
   - Add a mutation list.
   - Write the docs: a Naval-Combat section, a Port-Ledger row, the
     Testing row and the patch notes.
