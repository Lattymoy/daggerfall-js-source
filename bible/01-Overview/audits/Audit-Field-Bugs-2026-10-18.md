# AUDIT FB1018 (2026-10-18) - the 2026-10-18 field bugs, read cold

Mac, of pull request #1012 (`01-Overview/bugs/Field-Bugs-2026-10-18.md` at f0172f58): **"Audit everything we have so
far"**. This page is the audit: the five fixes on the branch (WAGON-ALIGHT, PASS-COUNT, LOOT-FLATS, HUD-HEAD,
PVP-BLOOD), their pins, their mutants and their records. Each finding has its verdict here. What it changed is written
into the pages it touched, marked `AUDIT FB1018` with the finding's id, and in the code beside the fix.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN head (f0172f58, detached worktrees - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING; the mutation lane had a worktree of its own, since a mutant edits files in place), told to
reproduce a finding before reporting it and to end on what it checked and found sound:

| Lane | Over | How |
|---|---|---|
| L1 | WAGON-ALIGHT: the law's geometry, every path that empties a seat, the seat's bookkeeping, the box law over every body, the moved `carriesCompanions`, THE FOUR HOSTS | 5 findings; the pin's own ride driven with options in node - a recentre, a wall, four companions, a summoned wagon - and the pre-fix copies beside it |
| L2 | PASS-COUNT: every frame shape of the view out's count, the shadow count, the counter's text, the record's facts | 6 findings; the real Renderer over a stub GL with the real ShadowPass, viewOutFrame and counter |
| L3 | LOOT-FLATS, HUD-HEAD, PVP-BLOOD: every free and remint, the head's key race, whether the PvP blow can bleed off the street | 6 findings; scratch copies of HEAD and of the pre-fix sources, the HUD's first load under module mocks |
| L4 | the pins, the mutants and the records across all five | 10 findings; the 28 recorded mutants and the 13 older records the diff touched, 34 new one-site mutants of its own, every claim and cite in the records, 133 test files around the change |

Every finding was verified against the code before anything was fixed. L3-5 was reproduced by mapping a dungeon's own
coordinates through `worldCoordToMapPixel` (the map's corner pixel, every time); L3-3 by L3's own test, which fails at
f0172f58 and passes at the fix; L2-3 by the count a view out reports against the GL draws it issued (40 against 42);
L4's gaps by their surviving mutants.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| L1-1 | A floating-origin recentre on the very frame the wagon parks leaves a companion standing in the bed: the seat the layer kept (`s.sat`) is not moved with the world, so the reach guard reads the body as moved by something else | RECORDED: rare (the recentre and the park on one frame), and nobody is held - the box law keeps the box down round the body and it walks out at heel. Its fix wires the layer into the host's recentre, and `bootWorld` stands at its ceiling (21,186 code lines). Written into the record and `06-Systems/Wagons.md` |
| L1-2 | A wagon summoned where a companion idles at heel inside its footprint stands no box until that companion walks off it | RECORDED: not a trap; the wagon can be walked through meanwhile. `Wagons.md` says so |
| L1-3 | "Nothing else in `src/` works the step out" was swept over two files | FIXED: the pin sweeps the whole of `src/` for the constant or its 1.6 behind a yaw |
| L1-4 | Of the paths that empty a seat, only the player getting down was pinned | FIXED: a player given a companion's seat on the road is pinned - four companions, a peer seated first, the last one down at its seat's get-down point beside the wagon still trailing, then on the ground. The one path where the wagon moves and no box stands |
| L1-5 | Two record nits: `crewAshore.capsules()` "the sworn's included" (the sworn's are `revenantAshore.capsules()`), and "a horse lost (both through `commitDeployment`)" | FIXED in `Wagons.md` and the record (the horse lost with no following pose sets Deployed directly) |
| L2-1 | `tools/realWindowsProbe.mjs` read `_rwViewDraws` after the room's frame, which the fix now zeroes there (7 on main, 0 at f0172f58); the record said it "was read by nothing" | FIXED: the probe keeps the largest `stats.viewDraws` over its frames; the record corrected. The probe needs a browser and was not run here |
| L2-2 | PASS-COUNT's renderer pin was regexes "because its constructor needs a real GL" - it does not (`fb1012g_paneclip` builds one over a stub); one recorded mutant was behaviourally equivalent and died to a regex alone | FIXED: the pin executes the real Renderer over a stub GL, every count checked against the GL draws really issued; the redundant guard that mutant flipped is gone, and its record with it |
| L2-3 | The panes' depth draws, issued before the view out's own begin zeroes the stats, were never counted (up to VIEW_PANES_MAX a redraw) | FIXED: `_rwDrawPanes` answers how many drew, and the view out adds them |
| L2-4 | A view out that throws mid-street counted nothing it sent | FIXED: the count is taken in the `finally`, once the view out's own begin has run. An orphan view out (the interior arm throwing between it and the room's frame) is one frame's miscount and is left |
| L2-5 | GPU work still on no line: the shadow cache's copies (`stats.blits`), the bloom pass's replays (its `emitDraws`), the view out's binds | RECORDED: named in the record as not counted |
| L2-6 | "Most of the city again behind each pane" - it is one pass a frame over one rectangle; "when a second held any" - the figure prints at a mean of half a draw a frame; standing still the street is redrawn every 250 ms, so `view` reads about a fiftieth of it | FIXED: the record, `07-Rendering/Real-Windows.md` and the counter's comment say so, and the record's OPEN asks for `view` read while turning the mouse |
| L3-1 | LOOT-FLATS' sweep case seeded a container, which the sweep deactivates - the sweep's own free was pinned by source text alone | FIXED: a player's pile swept, in the behaviour pin |
| L3-2 | The dungeon's teardown freed its piles by hand, past the animator - against "a batch is now freed one way" (harmless: the pool dies with the context) | FIXED: the teardown calls the pool's own `restorePiles(null)` (dead first, then out of the animator, then the batch), one line where two stood; `resourcesafety.test.js`'s pin moved with it |
| L3-3 | The bar's FIRST head took the key read as the bar landed, not the one it was loaded for: a helm put on while the first head rendered was never asked for | FIXED: the key is read before the load; pinned by text (the suite runs no module mocks) and by a mutant |
| L3-4 | HUD-HEAD's test named a mutant ("the bar installing by hand") no record held | FIXED: recorded, dead |
| L3-5 | PVP-BLOOD's failure could not happen: a duel is outdoors only, and in the zone's dungeons EVERY PEER WAS REFUSED - wildFair asked whether the peer's pose stands in the zone, and a dungeon's pose is the dungeon's own frame, the map's corner pixel. PVPDUNGEON (the owner: "players should be able to attack each other in dungeons too in the pvp zone") never worked underground | FIXED: in a dungeon a room's peer is fair by the place (wildCan's `wildHere` is the door's pixel, and the room is that place's). The relay's half was read, not run: it judges each fighter's zone by the client's own `zone` word and the reach between two poses in the one room. The record's PVP-BLOOD paragraph rewritten to say what was wrong, and `11-Multiplayer/Wild-Zone.md` |
| L3-6 | The PVP-BLOOD sweep missed `hitEffects?.showBloodSplash(`, and took the trample's street-only path on trust | FIXED: the optional call counted; the trample's one door pinned in the exterior arm |
| L4-1 | WAGON-ALIGHT's sweep by the place's `spot` and the reach on z were unpinned (no pin had a wall; the far case moved bodies along x) | FIXED: a wall stopping the sweep half way, and the reach along z |
| L4-2 | The moved `carriesCompanions` (a following team) and the host's two seat lines were unpinned | FIXED: who rides, on the pool; both seat lines pinned |
| L4-3 | Five counter survivors: the shadow threshold, the `?? 0`s, the probe's two fields | FIXED: pinned |
| L4-4 | LOOT-FLATS' fake batch started at frame 0, the real one at null; a removed pile's free, a still pile's frame and two piles reminting were unpinned | FIXED: the fake as the real one; each pinned |
| L4-5 | = L2-1 | FIXED there |
| L4-6 | = L2-2 | FIXED there |
| L4-7 | Report 4's "the page has no branch on how it was served" - it branches on the shell (`appStorage.js`, `frameCap.js`, `settings.js`, `pointerLock.js`, `dataSource.js`) | FIXED: the files are the same, the page is not quite, and a client-only cause is not ruled out |
| L4-8 | "A reinstall resets `<userData>/Game`" holds only for a new seed version | FIXED: the condition written in |
| L4-9 | The record's opening said twelve threads, each traced; it holds four | FIXED: four recorded, the other eight not yet |
| L4-10 | Report 3's five-minute measurements have no committed script; the hudhead law builds its own named heads | RECORDED: the record says the figures cannot be re-run from the tree; the head's name is pinned by its producer's text, the house's form for a host's wiring |

Found and left, as the record already said: a dungeon's targeting builds a fresh candidate list per armed foe per
classic tick (a cost, not a leak). L4's mutants it left alive and recorded nowhere: four equivalent (`_restGrounded`
kept - resumeLive clears it; the step's height unset; the rebind's frame from the old batch - the tick writes it;
the same head released - every load answers a new object) and two with no reliable pin in this harness (the reach at
its boundary, `>=`; the motor's resume dropped).

## After

Tests: `fb1018_wagonalight` 7 (4 before), `fb1018_passcount` 3, `fb1018_lootflats` 3, `fb1018_hudhead` 2,
`fb1018_pvpblood` 3 (2). Mutants: 49 records, 49 dead (28 before - one equivalent dropped with its guard, 22 new, among
them L4's 13 survivors). Code: `renderer.js` (the panes and a part-drawn street counted, one guard gone), `hudLarge.js`
(the first head's key), `world.js` wildFair (one line, no line added - `bootWorld` stands at its ceiling),
`dungeonContext.js` (the teardown through the pool, a line shorter), `tools/realWindowsProbe.mjs`. Not checked here:
a live game (no ARENA2 data in the container) and the relay end to end.
