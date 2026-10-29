# AUDIT FULLER-LW - the fuller living world read cold, 2026-10-29

The owner: *"Audit"*, of `886f60826..ff6d927a2` - the six living-world asks of 2026-10-28 (`../../06-Systems/Living-World.md`
LW-DENSE, STAND-LIFE, LW-ANTICS, WATCH-LIFE; `Living-World-II.md` LW-WIDE; `../../03-World/World-Wide.md` HOVER-NAMES).
Three cold lanes read the commits against their base, each in its own copy of the tree, each given the files and one
brief (what to hunt, how to prove it), never a conclusion. Every finding below was proven on the real code by a probe
on both trees, and each fix was proven again here by the lane's own probe on the fixed tree.

| Lane | Read | Found |
|---|---|---|
| A | the runtime law: ids, rosters, the watch's duty, the caches, the chase, the quarters, the frame's cost | 11 |
| B | the player's view: what is seen and read on the street, by hour, in the game's own towns | 17 |
| C | the pins, the mutants and the record | cut off by a container restart before it reported; its brief was done here |

Several were found twice: A1 is B1, A2 is B2, A3 is B11, A9 is B6 and B12, A11 is B3. Each fix in code carries an
`AUDIT LW-ANTICS`, `AUDIT STAND-LIFE` or `AUDIT WATCH-LIFE` comment. The fixes are pinned in
`test/systems/livingWorld/lwantics_street.test.js` and `standlife_street.test.js` and `test/world/ic_stutter.test.js`.
Their mutants are `tools/mutants/auditlwantics.json`: 25 of 25 dead. 21 older records the fixes moved were rewritten
by content, and all 21 die.

## The cutpurse

**A1, B1 (bug). The thief who "got away" walked back and stood beside the one robbed.** The lift was laid at the end of
the overlap, not of the thief's stay, and after its words the thief was handed back their stand, FACE_M from the
victim. Before: of 59 synthetic lifts the thief stayed on up to 603 s, and 13 of 14, traced frame by frame, came back
within 3 m of the one robbed.

Now the lift falls at the end of the thief's stay, the one robbed staying on. The thief stands where the run ended to
the end of the stay (`livingTown.js _runOf` `over`, `_ranTo`), and their next walk is taken up where its line passes
within JOIN_M of them (`_heldRun`). The run heads toward where they walk next, or off to that side of the victim, never
through them. After: at most 9.9 s held where they ran; 2 of 14 pass within 3 m on their way on; a run against the way
on 3 of 45 (25 of 59 before).

**A2, B2 (should-fix). In a narrow lane the thief never ran.** No bearing clear for the full 12 m meant no run at all
(19 of 190 lifts over six cities, Sentinel 11 of 57). Now the lane is run as far as it holds, 4 m or more
(`_chaseWayOf` `best`, RUN_MIN_M; `cutpurseRun`'s `reach`). After: 0 of 61 lifts without a run (the synthetic city,
Ripmarket).

**B3, A11 (should-fix). A caught thief walked free after "Tell it to the magistrate."** The caught line now says what
the street shows: "Give it back. Now go, and stay off my street." **Recorded:** the chase stays rare in the game's own
towns (Daggerfall 0 of 11 lifts, Ripmarket 1 of 21), as a watch must stand at the spot through it. A thief avoids the
watch; widening it is the owner's call.

**A9, B12 (note).** The lift's "by day" read the stay's start (5 of 154 after six); dice and a flirt the stay's start
too. Now each the incident's own minute (`stir.js hourOf`): after, no lift after six.

## The watch's word

**A3, B11 (bug). "None where it stopped a stranger" could never fire.** The check read a watchman's id in a set of
strangers' ids, and 34 of 1,516 stops had a word as well as a challenge. Now the stop is kept when a challenge is laid
(`stoppedAt`). After: 0 of 994.

**B6, A9 (should-fix). "Morning, {b}. Quiet night?" at any hour** (9 of 138 in Daggerfall, at 16:31 to 19:59). The
morning's words are their own pool (`morningWatchWords`), said from five to eleven (MORNING_HOURS). After: 0.

**B9 (should-fix). A beggar moved along stayed put, and the watch repeated itself.** 10 of 10 beggars kept their
pitch a median 162 game minutes on; one watchman said the same line to the same beggar twice in a day. Now "Move
along" is said at the end of the pitch, the watch there through it, and they go; a beggar who stays on has a word that
keeps them there (`beggarWords`). One word a day between a watchman and one of the town.

**B10 (should-fix). "A bite bought at a stall" was mostly bought from labourers** (60 of 79 in Daggerfall). A
labourer's or a courier's stint is a "stall" stay. Now from FOOD_SELLERS alone: fisher, farmer, carter, merchant.
After: 10 of 10 from a fisher.

**B8 (should-fix). WATCH-LIFE's extra patrols walked the same district** (Daggerfall, 180 shifts: 13 on an identical
beat, 76 sharing half their stops). Each patrol's beat is now drawn from the spots the shift's earlier beats left
(`dayPlan.js patrolBeat`). After: 0 and 0.

**B7 (should-fix, lore). Every sermon named Stendarr, and spoke of "this market" at a temple's door.** A sermon now
names its temple's own god, by the building's faction (`guildFactions.js DIVINES`; "the Divines" where none is known),
and "every crooked scale in {town}".

**B14 (note).** "Two coppers" and "A copper a letter": Daggerfall has no coppers. Now "coins".

## Standing

**B4 (should-fix). The "shift of weight" was half a stride walked on the spot, and the guard's axe flickered.** Frame 0
of a side record is a full stride, and 1 to 2 the other leg's. A side stand now holds frame 1 (legs together) and
shifts to 3 and back; front and back as before. The watch stands on 0, shifts to 2 front and back (its axe is drawn on
0 and 2 alone), and only glances side on (`residentWalker.js standFrameOf`, `shiftFramesOf`).

**B5 (should-fix). A glance turned talkers away from the one speaking** (11.8% of circle frames; 8.1% of speaking
lines). One attending a circle or an incident at their spot shifts their weight and never glances (`attending`). A
glance now turns 0.85 radians, past the wheel's sector: at 0.7 one in nine drew nothing new. After: 0 of 49,938
circle frames turned away.

## The quarters

**A5 (should-fix; older, now four times as often). Two quarters of a capital shared spot keys,** so incidents were
dealt between people across a district wall (23 in four days, 21 to 26 m apart). A later quarter's squares, corners
and exits now carry its tag (`places.js townPlacesSteps` `tag`: `q1.`, `q2.`).

**A4 (recorded, not fixed).** A quarter's resident id (`q`) is not one the wire's LIVING_ID_RE takes, so online a
capital's resident a watchman stands for sends no `lr`. Before these commits (IC-GRAND); the fix is a relay release.

**A8 (record corrected).** A town of quarters keeps CENSUS_CAP a quarter: Imperial City slice 112 holds 598.

## Notes kept

- **A6, B13.** The watchman's run is not checked for walls, keeps a little under its recorded pace, can greet the
  player mid-chase, and slides at its start; the robbed face the thief's empty stand. No teleport, no frame off the
  street. Left as they are.
- **A7, B17. The cost.** The great city's way in doubled (68-118 ms against 43-56 ms on a loaded machine); Ripmarket's
  street draws 125 bodies at 1.01 ms of script a frame (0.60 ms at DFU's cap). Taken up by the performance work
  (`../../06-Systems/Living-World.md` LW-DENSE): the carried word a traveller a slice (worst 4.3-6.2 ms, was 5.7-15.4),
  the day's deal 10-20% faster to the same incidents, a name 15% cheaper; the way in 36-49 ms on a quiet machine,
  inside its 60 ms. GPU cost of the fuller street was not measured here (no GPU).
- **A10.** LW-WIDE's pedlars, pilgrims and couriers join first-rank merchant trains, so some trains' fights can change
  outcome; no id or fated death moves. Accepted.
- **B15.** Every male priest's still picture is now one (181.2), as the record says of the blacksmith.
- **B16.** No path mints an empty name past the Bay. `tools/hoverNamesProbe.mjs` passes a place where half its plaques
  are named; the record's "32 of 32" was read by hand.
