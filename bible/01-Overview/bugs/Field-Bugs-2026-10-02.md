# FIELD BUGS 2026-10-02 - the shards over Hadus; and the climb out of a dungeon's pit, the hunt under the foes, the net at the helm, the boat's loop; and the climb audited on Daggerfall's dungeons; and the rocks that held a ship, the sea that read as land, the crew's words over each other; and the Basket's cursor

*The same date, four times (the merges of main into `ccr-563257f1-ggcmg4`, into `ccr-a6a7383a-8i95b3` and into
`ccr-a853eeda-b59kud`, 2026-10-02): ROCK-SUNK was written on main (PR #521) while part two - three #bug-reports
threads, a relayed line and Mac's ask, then its audit - was written on `ccr-563257f1-ggcmg4`, part three - Mac's
sailing, the rocks, the sea and the crew's words, audited the same day as `Field-Bugs-2026-10-02b.md` - on
`ccr-a6a7383a-8i95b3`, and part four - the Basket's cursor, and its audit - on `ccr-a853eeda-b59kud`, each under the
same name. The merges keep all four here, so every cite of this page stands; part one's number (1), part two's (1-5),
part three's (1-3) and part four's (1, 2; its audit's A-D), their tags and their pins' `fb1002_` are each their own.*

A #bug-reports thread through Mac (a screenshot, 2026-10-02): maya, *"Insane glitched geometry over at Hadus"* -
*"yea.."* under a frame of dark, faceted slabs hanging in the sky over the desert east of the town - and Ashley:
*"yeahhh mountains be buggin rn"*.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Insane glitched geometry over at Hadus"; "mountains be buggin rn" | WOD-BUSH (2026-10-01) stood every placement of World of Daggerfall's model 60610 on the drawn ground, taking it for the camps' shrub; 157 of its 202 placements are the rock fields' boulders, set into the outcrops on purpose, and it raised them as dark shards up to 377 m tall | fixed (ROCK-SUNK) |

## ROCK-SUNK: a rock field's boulder keeps the mod's height (1)

**Reproduced first**, on the game's own data and the real renderer (SwiftShader): the streamed world at Hadus
(Myrkwasa, map pixel 295,427), standing just north of the town and facing east (pixel-local 330, 650, 84 degrees),
draws the report's frame - a giant dark slab over the left of the view with sky under it, another over the right,
darker shards over the outcrops between.

**What it was not.** Not the mountains: no `WOD_Mountain_` site stands within nine pixels of Hadus; the outcrops are
World of Daggerfall's rock fields (`WOD_Rocks_Large_03`, `_04r2`, `_00r1` and the smaller fields), ARCH3D pebbles
scaled hundreds of times into piles hundreds of metres across. Not WOD-ROCK's retexture (`Field-Bugs-2026-10-01.md`
part five): the same views with the models' own UVs draw the same shards. Not the port's reading of the mod: the
transform is `LoadObject`'s T * R * S in Unity's frame, the meshes are `MeshReader`'s (X, -Y, Z) * 0.025, every
layout's tags read one to one, the pebbles decode as whole rocks, and a layout stood alone on flat ground is a coherent
pile with its spire rising out of it. Not the terrain or the roads: Hadus stands on a 310-330 m plateau with a 140 m
escarpment to the south-east, but as the mod places them - and after ROADS-CLEAR takes the pieces over a road - every
piece round the town touches the ground or the rocks it is set into.

**Why.** The shards are model 60610, whose texture (41.0) is the darkest grey in the frame. WOD-BUSH
(`Field-Bugs-2026-10-01c.md`) stood that model's mesh foot on the lowest drawn ground under it, taking all of its
202 placements for the shrub - read off the layouts, without ARCH3D, and never seen on a GPU. 45 are the shrub: the
bandit camps' 29, the nature spot's 14 and two ruins', at 1.7 to 14.6 times the model and never deeper than 28 m. The
other 157 are the rock layouts' boulders - 150 in the fields the 'Rocks' instances stand (34 of them at 81 to 95 times
the model) and 7 in the cave layout no instance names - scaled 5.6 to 95 and set into the outcrops, 63 of them more
than 50 m deep (as deep as 346 m). Standing them on their lowest corner raised 86 by more than 50 m and 70 by more
than 100 m (as much as 510), each then standing its whole height, up to 377 m, out of a pile meant to bury most of it.
WOD-BUSH reached main with #513 at 21:50 (UTC-4) on 2026-10-01; the thread is from the same night.

**The fix** (`world/worldOfDaggerfall/wodLocationObjects.js` `isWodShrub`, `WOD_ROCK_SITES`; `scenes/world.js`, the WoD loop): only the
shrub is stood - a 60610 of a site the mod names 'Rocks' or 'Mountains' keeps the mod's height, as every other rock
piece does. The mod's own site names part the layouts exactly (every 'Rocks' or 'Mountains' instance stands a
`WOD_Rocks_` or `WOD_Mountain_` layout, and no other instance does), and Mining's rock pieces (PROF2's `rockPick`) read
the same list. Seen on the real renderer at the reporter's place: the sky over Hadus is clear and the outcrops stand as
the mod lays them.

`test/world/worldOfDaggerfall/fb1002_rocksunk.test.js` (5; the lift off the real mesh with ARENA2_PATH); the source pins of
`test/world/terrain/wodbush.test.js`, `test/world/worldOfDaggerfall/roadsclear.test.js` (the shrub's block between a piece's box and its road test) and
`test/net/prof2_client.test.js` (`rockPick`) re-aimed; `tools/mutants/fb1002_rocksunk.json` 5, 5 dead;
`tools/mutants/wodbush.json` re-aimed, 7, 7 dead. World.js is line-neutral: no cite moves.

## Part two - the climb out of a dungeon's pit, the hunt under the foes, the net at the helm, the boat's loop; and the climb audited on Daggerfall's dungeons

Three #bug-reports threads relayed as screenshots, a line relayed under them, and Mac's own ask beside them:

> 1. Reports of audio cutting when taking helm of a ship
> 2. Enhanced climbing needs a further perfection audit

The rule of the last batches stands (`Field-Bugs-2026-09-30b.md` part two): every report root-caused on the real modules
with a reproduction before anything changed, each fix pinned red on the code before it and mutation-checked. Three
lanes read the hunt, the net and the loop while the climb was reproduced. The climb had never been run in a dungeon,
so this batch did that: on the reporter's own dungeon, then on 24 more, using the freeware ARENA2 (`tools/fetch-data.sh`).

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Stuck after Climbing Rework" - "A two blocks wall is too high for my character to climb up, so Im stuck in this hole. Luckily I have levitate. Its 'Ruins of Old Carololda's Farm'"; "I would have been able with old climbing mechanics" | Chilloutman | Daggerfall's dungeon walls are stacked in 3.2 m units. Where the unit above has a jamb a hand's width over the climber, the head met its underside 1.4 m up the first unit and the free climb stopped; the classic climb's resolve slid it out from under. On the same walls, three more faults the classic climb never had: the free climb's deep press slid it down along a big face's diagonal seam (at Climbing 0 it never left the floor); a 2.5 cm crack between stacked pieces read as a lip (hang, let go, fall, repeat); and a piece set back 20 cm over the one below stopped the climb at the step; in a narrow corner the start could take the side wall and climb on past the front wall's top | fixed (SEAM-STEP, HUG-TOUCH, CRACK-LIP, STEP-BACK, CORNER-TOP) |
| 2 | "Enemies attacking during travel events" - "when an event occurs while traveling (Track a group of animals type stuff) and you press YES, enemies can attack you while the result loads"; "During this enemies can still attack you" | Aru | the hunt's box holds the player's motor and WINFOE1 runs the foes under every window: a foe that came near during the ask or the 4-8 s search hit a player who could not move. At the turn to the result, the search's minutes went through the encounter tick and could stand a wanderer 10-20 m away, facing a player the result page still held | fixed (HUNT-FOES) |
| 3 | "New fishing context pop up clashes with come sail away!" - "Gets in the way especially when trying to aim bow guns" | Cruor | at sea the net's water is everywhere (`netHasWater`: the Ocean's climate, the sea region), so CAST-LOOK's cast stood under the crosshair at the helm and over the guns' aim, and E or a click there cast the net | fixed (HELM-NET) |
| 4 | "Reports of audio cutting when taking helm of a ship" | (relayed) | every crossfade of a boat's two loops played the loop it was fading out again, and the host restarts a played source from its first sample. The first stroke past the wake's threshold (0.5 m/s), and every slowing under it, cut the boat's sound. Separately, a boat placed while another's fade-in ran stopped that fade at nothing and left the loop playing silent | fixed (HELM-HUSH) |
| 5 | "Enhanced climbing needs a further perfection audit" | Mac | the climb on 25 real dungeons, Forward held square to every wall with a top at Climbing 100: every wall the classic climb topped, the free climb tops, apart from slopes past 50 degrees and a lip with no landing right behind its edge (Jump pushes off, Back climbs down, Crouch lets go) | audited (AUDIT CLIMB-DUNGEON), then audited again (the audit, below) |

## The report (1) - measured on the reporter's dungeon

"Ruins of Old Carololda's Farm" is the Daggerfall region's location 383. Its thirteen blocks are B0000007, B0000002,
B0000008, B0000009, N0000090, W0000015, N0000035, B0000012, B0000014, N0000085, B0000010, B0000014 and B0000002. The
collider was built as `scenes/dungeonContext.js` builds it (every placement and every enabled action door, at each
block's origin). From every floor point 1 m apart, every wall within 1 m that has a top between 2.4 m and 16 m with
standing room was climbed. The climber held Forward square to the wall and 8 degrees either side, at Climbing 100 so
the grip could not decide the result. Each failure was run again on the classic lane with every roll passing.

The reporter's "two blocks" is two dungeon units, 6.4 m. On N0000035's and N0000090's 6.4 m walls the free climb
stopped with the feet 1.42 m up, while the classic climb went over. Sectioned (level rays every 2 cm up, across the
body's width), the wall above 3.2 m has an opening beside the climber whose jamb, a single face across the wall, stands
0.10 m inside the 0.35 m body. The head's sphere met the jamb's lower edge. The collider's resolve pushed the body out
along the wall, as it does for the classic climb, and the free climb's across clamp
(`_fcMove`: "across the wall the body goes as far as it was asked and no further") put it straight back.

## SEAM-STEP: stuck going up, the hands move along the wall to where the body rises (1)

`player/motor.js` `_fcSidestep`. When the free climb is stuck going straight up (Forward held, no Left or Right), the
nearest place along the wall where the body fits 0.1 m higher with the wall still at its hands is searched, every
5 cm both ways out to `PARKOUR_SIDESTEP_MAX` (0.45 m, a hand's width past a body's half). The hands go there along
and up at the climb's diagonal pace, and the climb carries on from it. Still stuck there, the search goes on the
same way within what is left of the 0.45 m. The way and the distance are kept until the climb has risen
`PARKOUR_SIDESTEP_CLEAR` (0.3 m) past where it stuck, so one obstruction moves the hands that far at most, and a long
slope cannot walk the climber along the wall. With nothing that near (a slab over the whole width, the top of a
shaft) the climber stays where it is, as under any top it cannot take, and the failed search is kept, not asked
again every frame, until Back, Left or Right, or 0.3 m of rise.

## HUG-TOUCH: the free climb presses to the face, not through it (1)

Found when the probe was run at Climbing 5. On N0000090's 25 m by 3.2 m wall (two triangles, the seam running from the
floor at one end to 3.2 m at the other) the free climb took hold and never left the floor. `_fcMove` pressed the body
into the face by the classic hug's whole step (Speed x dt, 7 cm a step at Speed 50). The resolve then pushed it out
along the nearest feature, and where that is the seam between two coplanar triangles the push leans along the face:
there, 1.3 cm a step lost going up out of Climbing 5's 1.8 cm, and the climb rose 2 cm and stood. The loss is the
press's, not the pace's, so the slowest climbers lost the most. The box test climb2 already pinned showed the same
seam in reverse: its climb ran 0.5 cm a step fast as it came up to the diagonal (2.995 m where the box gave 3.07 at the
same step). The across half of this slide was found before (the clamp above, after "a box's diagonal edge took a climb
down 2.8 m sideways"). Its up-and-down half was not.

The press is now the gap to the face plus `PARKOUR_HUG_PRESS` (1 cm), and never more than the classic step. The gap
is the wall contact's own distance, read each step (`w.gap`). PIN MOVED: `climb2.test.js`'s "up past the face's own
seam" climbs 165 steps, not 150, at the honest pace.

## CRACK-LIP: a crack between a wall's pieces is no lip (1, the audit)

The Pit of Sahoth's N0000008: the climb took hold, rose 0.4 m, and fell back, every 0.5 s while Forward was held.
Daggerfall's stacked wall pieces stand a unit apart (2.5 cm: 21.425 to 21.450 there). A level ray passes through the
slot over the lower piece's own top. The free climb's `senseGrip` read it as a lip, the climb switched to a hang, and
the hang asked the hold again from the new height, found nothing and let go. Where the rungs missed the slot, the
eave law (AUDIT CLIMB-FIELD E1: "not over a plain wall") saw a rung that was not on the face and reached out to an eave
that is not there.

`player/parkour.js` `faceGoesOn`: the slot is measured, its top (level rays 2.5 mm apart, up to `PARKOUR_CRACK`,
3 cm, at the depth the face had) and its foot (within the rung below). A slot no taller than 3 cm and two of those
steps is a crack. `plainGrip` takes no lip there, `scanFace` scans on past it, and `senseGrip`'s plain-wall test
counts a rung through a crack as the wall's. A 6 cm slot is a hold.

## STEP-BACK: going up, a face set back from the hands is reached for (1, the audit)

The Mordywyr Mines' and the Convocation of Elona's N0000033: a lower piece to 5.75 m, the piece above set 0.2 m back.
Its top is too shallow to stand on, so it is no ledge. The free climb's contact (the radius and 0.15 m) ended at the
step and the climb stopped there. Where the step-back runs high (0.2-0.3 m back at 2.4, 3.0 or 5.75 m, the wall going
on to 9 m) the climber hung from the step, found no way up, let go and fell, over and over. Going up (straight, or
across with Left or Right held too), a face that steps back from the hands, turned within the hold's 30 degrees, is
now climbed on to the way CLIMB3 climbs past a sill: the step's top is found (`_fcFaceTop`, level rays 2 cm apart), the body rises straight past it unpressed
(`w.past`), and then the grab's reach (0.5 m, `w.seek`) brings it to the face above. A face turned across the wall (a
corridor's side) is not reached for.

AUDIT of the batch (the review, before it was finished): the first cut reached for the face at once, and its press
lifted the body onto the step's edge while it was still below it. Strafing there lifted it too, and Back then left it
standing on the edge, off the floor. The climb past, unpressed, closed both. Climbing down past a step it passed now
stops on the wall above it, as it does above a window sill (CLIMB2: "A ledge too narrow to stand on ... stops you on
the wall above it"). Crouch lets go and Jump with Back pushes off. From under the step's top, Back climbs down to the
floor (the audit, B2).

## CORNER-TOP: in a corner, the top the look is turned to (1, the audit)

N0000090's pit, traced by hand at 5.49 radians: the start took the side wall, which runs on past the front wall's lip
to the ceiling, and the climb went on up it under the front wall's top and stopped at the ceiling. At 5.5 radians it took
the front wall and topped out. The reporter's pit is a narrow shaft. Going up, with the look turned 20 degrees or more
along the held wall as the hands took it, a face on that side within the climber's contact is the corner's other wall,
and its top in reach is climbed onto as the held wall's is (`_fcCornerSide`, `_fcCornerWall`, `PARKOUR_CORNER_LOOK`).
The side is read once per hold (the audit, A1): a view turned during the climb asks nothing. How square that face must
stand is the ledge sensor's own law (50 degrees), asked by the top-out along it.

## AUDIT CLIMB-DUNGEON (5)

The probe above (`tools/climbDungeonProbe.mjs`), on the reporter's dungeon and on 24 more picked across the realm with no two having the
same set of N/W/S blocks: Castle Lhishen, The M'ell Graveyard, The Pit of Sahoth, Ruins of Old Vyctyn's Place, Ruins
of Tach Manor, Ruins of Old Glerpja's Place, Ruins of Old Evelabyth's Shack, The Mordywyr Mines, Sekthrac, The
Convocation of Elona, Castle Kingwing, Castle Faallem, Copperwing's Hold, Gaerwing's Guard, Ruins of Old Evelolda's
Hovel, The Hold of Buckingsmith, Theodastyr Laboratory, The Citadel of Woodford, Ruins of Tower Darhtin, The Assembly of
C'ircba, Thercrn's Hold, The Fortress of Verpe, The Abbey of Baleusulla and The Haunt of Viscount Lithovon. Square and
8 degrees either side, at Climbing 100.

| | Before | After (the final code, the audit's included) |
|---|---|---|
| walls with a top in reach (25 dungeons) | 3,214 | 3,214 |
| climbs (each wall square and 8 degrees either side) | 9,642 | 9,642 |
| topped (stood on: still on the top a second later, nothing held) | 7,946 | 8,050 |
| failed where the classic lane topped | 81 | 45 |
| the reporter's dungeon: topped / failed where the classic topped (402 climbs) | 267 / 5 | 284 / 0 |

The 45: N0000011's ridges (21; Thercrn's Hold, 64 degrees on the near side and 68 on the far, no flat at all),
N0000014's 53-degree ramps (14; Castle Lhishen, the Abbey of Baleusulla), N0000041's 55-degree tops (4; Gaerwing's
Guard), N0000008's 67-68 degree peaked top (3; the Pit of Sahoth), and the lips with no landing behind them
(N0000034, 2; N0000026, 1). The batch's own run, before the audit, said 8,062 and 33. The difference is the audit's
turn law (B1 below): where the contact met a face the hold does not hold along, the batch's hands let go, and at the
lip of a ridge past 50 degrees the feet landed on it and stood (the base did the same: 13 of N0000011's were classic-
only there, 21 now). The same let-go dropped B1's climber 11 m from under a leaning top. The final code holds at the
lip, as the 50-degree law has it; Jump pushes off, Back climbs down, Crouch lets go. One more, at Thercrn's Hold, the
batch passed by letting go under an overhang's lip and catching again; the base fails it too.

The climbs that neither lane topped and that never took hold within 1 m of where they started (1,457 after) are
approaches that slid along the wall, a top that was not what the probe guessed (a slope, a void behind a thin top), or
a start in a void outside the level. The classic lane, with every roll passing, failed them too.

**What still stalls, and why it is no trap.** A top past 50 degrees: N0000014's 53-degree ramps over their walls
(Castle Lhishen, the Abbey of Baleusulla), N0000011's 64-68 degree ridges (Thercrn's Hold), N0000041's 55-degree tops
(Gaerwing's Guard) and N0000008's peaked top (the Pit of Sahoth).
This is AUDIT CLIMB-FIELD's own limit (`PARKOUR_TOP_MIN_NY`, chosen to take in Daggerfall's 45-48.7 degree roofs). The
classic climb ends up standing on such a slope only because Unity's controller grounds a body on a steep slope. The
other stall is a lip with no landing right behind its edge: Castle Kingwing's N0000034 (a pillar's corner 0.5 m
behind it) and Castle Faallem's N0000026 (a thin top with a gap behind it). The climber hangs there and can shimmy
along. In every case Jump pushes off, Back climbs down and Crouch lets go.

**Approaches 20 degrees or more off square** slide along the wall, on both lanes (the classic start's 0.12 m horizontal
tolerance and the free start's are the same), and start no climb. That is not a fault.

**The grip, at low skill and tired** (recorded, not changed, because it is Mac's "Free-climb on grip"). The free climb's
height is its pace times its grip (`gripSeconds`, `freeClimbSpeed`, Speed 50). Climbing 5 at Fatigue 34% (the reporter's
screenshot shows 34%) holds 4.1 s at 1.08 m/s, 4.4 m. Fresh, it holds 7.2 s, 7.8 m. Climbing 30 at Fatigue 34% holds
7.5 s at 1.30 m/s, 9.8 m. So a 6.4 m dungeon wall is out of reach only for a near-untrained climber who is also tired. The classic climb
had no grip, only a roll every 0.82 s that, when it failed, slipped the climber down the wall.

**Not run:** the hang's shimmy, the leaps and the catches on dungeon walls (the probe holds Forward only). Corners were
traced by hand only (CORNER-TOP above).

## HUNT-FOES: a foe come near closes the hunt (2)

**RETIRED by HUNT-OUT (2026-10-04)**: the text hunt is removed whole, and this fix with it - its tests and its
mutant records went with the hunt (`06-Systems/Climates-Calories.md`). The record below is what shipped.

**Reproduced first** (`test/scenes/fb1002_fieldbugs.test.js`, on surv6's composed hunt): the box opens, a foe comes near, and
the box stays. On Yes the search runs its 4-8 s with the player frozen. At the turn to the result, `onSearched` called
`advanceMinutes`, whose encounter tick (`world.js` `runEncounterTick(feet, true)`) replays 30-60 minutes of wanderer
rolls at once and stands a hit 10-20 m away, facing the player (`_standEncounterFoe`), while the result is on screen.
`scenes/hunting.js`'s own header already said the beast stands "when the box closes" for this reason. The encounter
wanderer was the case it missed.

**The fix.** `createHunting` takes the host's `enemiesNear`, and the window's `interruptWhen` asks it on the ask page as
well as the busy page (FORAGE4's door, which the hunt had never used). A foe coming near ends either page as a No:
nothing searched, nothing charged, no minute passed, the player's hands back. The result page is left alone, because
its outcome is already given and is the player's to read. The search's minutes pass when the box closes
(`onClosed`), before the beast stands. A box taken from under a given result (a death screen, a load) spends them
quiet: the clock alone, no encounter roll, and no beast (the audit, C1). A load closes the box before the save is
read. The world host's `huntFoesNear` counts a duel's foe (`duelEnemyNear`, a peer in no pool), a foe that sees the
player (`areEnemiesNearby`), or a foe still loading within 30 m (`HUNT_PENDING_NEAR_M`; `exteriorFoes.pendingFeet()`: `spawnFoe` is async, and the frame's encounter roll
runs before the hunt's). It feeds both the roll and the box. The first cut counted every foe loading anywhere, and the
review found that a site's garrison streaming in far away closed the box. The encounter's own stand is 10-20 m off.

**Not changed.** WINFOE1 (Mac: "enemies should still be able to do damage") and QUEST-POPUP-PAUSE ("Pause them offline",
a quest box only). The hunt's box does not pause the foes. It gets out of the player's way instead, offline and
online alike.

## HELM-NET: no cast while the hands are the ship's (3)

`scenes/fishHost.js` `looseNodesOf`: the kind's host gives a `busy` check, and while it holds there is no cast, so no
plaque, no E, no click and no Fishing-Net's Use there. The world host's is
`csaRuntime.isSailing() || naval.aiming || naval.boarding`. An act already running when the player takes the helm ends
with the act's "stopped" line, because the gathering host asks for the cast again every frame. A deck stood on still
fishes (Professions-Arc's "stand at sea on a boat or pier"). This is narrower than taking the helm out of the gathering
host's `active`, which would have hidden every profession node from a helm. HELM-KEYS' `choice` gate is kept.

## HELM-HUSH: a playing loop goes on; a stopped fade lands (4)

**Reproduced first** (the CSA runtime harness, `test/csaScene.mjs`): place a boat, let its fade finish, take the helm
and get under way. `PlayFast`'s crossfade calls `audioPlay` on the slow loop, which was already playing, and that
counts a new play. The host's `csaAudioFrame` reads a changed `plays` as "from the clip's start", stops the channel
and starts a new one. Slowing under 0.5 m/s does the same to the fast loop. No music, ambience, master gain or
listener change happens at the helm (the helm lane ruled each out).

**The fix** (`systems/comeSailAway/comeSailAway.js`, a Ledger A departure). `audioPlay` counts a play only from silence: a source
already playing goes on where it is (Unity's `AudioSource.Play` restarts it). The one `fading` handle is every boat's
(kept), but when a new fade stops the running one, the stopped fade now lands where it was going: played at its
target volume, or stopped if it was fading to nothing. A stopped crossfade lands too: the loop it was bringing up
heard whole, the other stopped (the audit, C3). Before, it was left where it stood, and a boat placed (a load,
a launch, a reposition) while another's fade-in was at its first step left that loop playing at volume 0.

## The audit (Mac: "Audit this")

Four lenses over the batch as committed (2bbbc12c), each against the base (66e98091) on its own snapshot, nothing
changed while they read: A the climb's mechanics, traced on boxes; B the climb on real geometry in the modes the
Forward-only probe never ran (8 dungeons and 551 walls, 3 town blocks and 241 walls, about 30 scripted runs a wall a
tree: Back from every height, strafes, jump catches, leaps, the hang's shimmy, 15-45 degree approaches, Climbing 5
tired, and Back pressed every 0.15 m up the wall); C the hunt, the net and the loop, read; D the records and their
pins. Every finding was reproduced on the code first, fixed, pinned red in `test/world/fb1002_audit.test.js` and its mutant
killed.

| | Finding | Fix |
|---|---|---|
| A1 | CORNER-TOP read the look every step. A view turned 20 degrees during a climb, toward a crate, a 1.6 m garden wall or a lower side wall within contact, mantled the climber sideways onto it on the next frame (the held wall ran on to 12 m); toward a 1.2 m fence it clambered over into the next yard | the side is the look's as the hands take the wall (`w.look` at `_wallBegin`, `w.corner` read once) |
| A2 | SEAM-STEP asked a failed search again every frame while stuck: 18 places, each a body's fit and a wall's. Under Carololda's slabs, 311 collider calls and 1.05 ms a frame, against the base's 59 and 0.27 ms | the failed search is kept until Back, Left or Right, or 0.3 m of rise |
| A3 | A save in STEP-BACK's pass loaded holding at contact, not at the grab's reach: the hands let go and the climber fell 5.84 m, or stood on the step's edge | `_pkRetake` reaches as the grab does (`w.seek`) |
| A4 | Forward with Left or Right at a step-back fell, caught, fell, on both trees (STEP-BACK asked for straight up) | the step is passed on the across climb too |
| A5 | (the audit's own, found fixing A2) A jamb over the body's middle: the search's fit admitted the touch of its edge, the resolve refused it, and the climb stood 0.2 m along | still stuck where the search said, it searches on the same way within what is left of 0.45 m |
| B1 | The Pit of Sahoth's N0000008, 15-45 degrees off square to an 11.5 m wall whose top rolls back into a 68-degree lean: the base topped it (its 7 cm press shoved it up the lean); the batch let go at 10.96 m (about 29 HP), and again with Forward held. The contact switched to the corner's sloped other face, and the next check along that face missed | the hold turns to a new face only when that face is met along its own normal (`PARKOUR_TURN_HOLDS`); else it keeps the face it had. It now stalls under the lean, no fall: a top past 50 degrees, the stall below |
| B2 | Back just past N0000033's step-back (Elona, Mordywyr) froze at 5.27 m until the grip ran out, or let go 5.45 m up: 6 of 338 runs. The profile is a 12 cm recess 0.25 m deep under an 11 cm band; the lowest contact ray, the one still on the wall, crossed the recess and met nothing | climbing down reaches as the grab does (`w.down`, for the contact and for the move's hold). From under the step's top Back reaches the floor; from over it the climb stops on the wall above the step (CLIMB2) |
| B3 | A strafe into a narrow face set at 43 degrees (Sahoth, 1 of about 1,100 dungeon strafes) let go 3.8 m up | B1's turn law: the strafe stops at the face, held |
| B4 | Climbing 5 at Fatigue 34% ran out of grip 0.17 m short on two marginal walls (Castle Kingwing, Tach Manor) that the base mantled with 1% grip left, on the old press's boost at the start and at the 3.2 m seams | not changed: the honest pace (HUG-TOUCH) and the grip are Mac's. 2 worse, 7 better, 165 more runs higher. At Climbing 5 fresh, grip-outs above the 5 m damage line went from 16 to 33: walls that stalled low are climbed to about 7.8 m before the grip ends (about 14 HP) |
| C1 | F11 works under any overlay, and the load never emptied the slot: a result left open across a quickload charged the loaded save the search's minutes and replayed 30-60 minutes of wanderer rolls at the loaded spot. A death under the result rolled them over the corpse | a load (quickload, classic import) closes the box before the save is read; a box taken away spends its minutes quiet (`advanceMinutes(n, { quiet })`: the clock alone) |
| C2 | `huntFoesNear` missed a duel: every other "enemies near" gate in world.js asks `duelEnemyNear()`. Mid-duel the hunt could open and hold a duellist the peer kept hitting | it asks the duel first |
| C3 | HELM-HUSH's "a stopped fade lands" covered fades, not crossfades: a boat placed during a 2 s crossfade left both loops playing part-way (0.75 and 0.25), and the wake asks only for a silent loop, so never again (as on the base) | the crossfade lands too |
| D | The records: the grip figures (3.8 s at 1.2 m/s; 6.6 s fresh), HUG-TOUCH's "more than Climbing 0's pace", "four faults" over a five-row table, the Ledger CLIMB row's audit text in its Approved-via cell, Climates-Calories' loading foe without its 30 m and a corrected sentence left standing (also Foraging and huntWindow.js's header), the STEP-BACK pin's claim of the top it never asserted, Faallem's gap left out, the patch notes' overclaims, and a probe cited (`pits.mjs`, `seam.mjs`) that was in no tree | each made true; the probe is committed (`tools/climbDungeonProbe.mjs`) |
| D | Survivors of new one-site mutants: the ask page's busy gate (an unanswered ask ran its wait, searched and turned to the result by itself, unpinned), the sidestep's diagonal pace, its 5 cm probe, the crack's 3 cm probe height (slots to 13 cm read as cracks), CORNER-TOP's face test, STEP-BACK's "straight up" | the busy gate, the pace and the probe pinned; the crack slot measured (below); the face test left to the ledge sensor's law; the across climb passes (A4) |

**The crack, measured.** The first cut read a slot as a crack by where its rung fell: slots to 4 cm always, 4-9 cm
on some frames. `faceGoesOn` now measures the slot's top and foot (CRACK-LIP above): a 2.5 cm crack is no lip
wherever it is asked; 6 and 8 cm slots are holds.

**Changed and right (CRACK-LIP).** Castle Kingwing's N0000034: the hang's shimmy stops where a 1.1 m parapet stands
flush on the lip, where the base shimmied 6.4 m along the 2.5 cm gap under it and round two corners. A side leap at
the Mordywyr Mines no longer catches the gap at the 3.2 m seam and pushes off instead (1.8 m down).

**What still stalls, with no fall.** B1's leaning top (past 50 degrees). The niche 2 m tall and 0.4 m deep (lens A):
the climb goes up its back wall and hangs with the head on the lintel, 0.2 m over the niche's floor, where the base
fell and caught over and over; neither mantles into it from the hang. Back, Crouch or Jump get off.

**Better than the base** (lens B, before A-C's fixes): Forward at Climbing 100 topped 529 walls against 515, Climbing 5
fresh 499 against 356, jump catches 517 against 503, 45-degree approaches 59 against 43, Back from the top hang
reached the floor 504 times against 498, and 25 heights where Back froze on the base now climb down. Equal: Back from
mid-wall, the stalled climb's ways off, the shimmy, Jump with Back or a side, and the town blocks. 67 freezes on Back
near N0000008's floor are on both trees.

**Not covered.** The world host's 30 m law and HELM-NET's `busy` wiring are pinned by source only (the host is not
composed in a test). Leaps were run from mid-wall only, at Jumping 50.

Pinned: `test/world/fb1002_audit.test.js` (12), the last on ARENA2 (CRACK-LIP on N0000008, STEP-BACK on the Mordywyr
Mines' N0000033, CORNER-TOP in the reporter's pit, and no fall at B1's three yaws). `tools/mutants/fb1002_audit.json`
(19), all dead.

## Pins and mutants

- `test/player/fb1002_climb.test.js` (7): SEAM-STEP (the jamb on either hand; a slab it cannot step out from holds it in
  place), HUG-TOUCH (Climbing 0 up the real wall's two triangles, at its pace), CRACK-LIP (the climb past a 2.5 cm
  slot; no grip and no ledge at the slot; a 10 cm sill still a hold), STEP-BACK (past 0.2 and 0.3 m step-backs to the
  top of a 9 m wall with no let-go; the reach never lifts the body onto a step's edge; a face turned across the wall
  not reached for), CORNER-TOP (either hand, 45 and 60 degrees), the laws by source, and the reporter's two walls on
  ARENA2.
- `test/scenes/fb1002_fieldbugs.test.js` (8): HUNT-FOES (the ask, the busy page, the result left alone, the minutes at the
  close and under a dropped box, by source), HELM-NET (a deck fishes, the helm does not; by source), HELM-HUSH (both
  crossfades leave the playing loop alone; a second boat placed under the first's fade).
- `test/world/fb1002_audit.test.js` (12): the audit's (above).
- Red on the code before, every test. `tools/mutants/fb1002_climb.json` (15), `tools/mutants/fb1002_fieldbugs.json`
  (12) and `tools/mutants/fb1002_audit.json` (19), all dead. After the audit's changes the eight lists its code touches
  (those three, `surv6`, `csa_time`, `forage4`, `climbfield`, `climb3`) were run again on the final code: 208 dead,
  3 equivalent as recorded, none stale; the records the audit moved re-aimed by content (fb1002_climb's SEAM-STEP
  three, CRACK-LIP two and CORNER-TOP two, HUNT-FOES-the-minutes-lost-with-the-slot, CLIMB3-sill-pass-held-short and
  the two free-climb-jump records back to their text on the base, SURV6-the-minutes-never-pass). Then every record in
  any list aimed within 30 lines of a line the audit changed (99, from 17 more lists): 95 dead, one equivalent as
  recorded, two survivors that survive on the base too (below), and one record stale since the batch:
  AUDITCLIMB2-G1-climb-steps, recorded equivalent, now dies. HUG-TOUCH's press stops at the face, the resolve no
  longer holds the body off a plinth, and without the climb's `noStep` a climb across beside a 0.8 m plinth steps up
  7 cm in a step. The flag is now that plinth's one guard; the record is a law (Parkour-Arc's AUDIT CLIMB2 row says so).
- PIN MOVED: `climb2.test.js` (HUG-TOUCH, above); `surv6_hunting.test.js`'s composed hunt (the minutes at the close)
  and its source pin (`huntFoesNear`). Mutant records re-aimed by content on the moved source: `climb3.json`
  (CLIMB3-sill-pressed-into, CLIMB3-sill-pass-held-short), `climbfield.json` (E1-no-eave, E1-eave-up-every-wall),
  `csa_time.json` (CSA-G-play-no-restart), `forage4.json` (FORAGE4-3), `prof8.json` (PROF8-kind-dry-land),
  `surv6.json` (SURV6-the-search-runs-every-tick-after, SURV6-the-minutes-never-pass); all dead. The cites the change
  moved were re-resolved (`tools/citeShift.mjs --base 66e98091`, 122, and seven struck ones by hand). Four real-data
  tests fail on the base as well as here (audit18 social F2, court's AUDIT 21 F1 and F8, field_csa2's Bay): not
  this change's.

## Found on the way, not changed

- CLIMBDOWN-45-degree-eave-refused and CLIMBDOWN-45-degree-slab-refused (`tools/mutants/climbdown.json`) survive, on
  the base as here: the rays' scatter margin under the 50-degree top limit (`PARKOUR_TOP_MIN_NY - PARKOUR_RAY_SCATTER`)
  is pinned by no test. Not this batch's.

- Using the Fishing-Net from the hotbar at the helm finds no cast and says Foraging's general line about where nets
  work, which tells a player already at sea to stand at sea. A helm-specific line would be polish.

## Part three - the rocks that held a ship, the sea that read as land, the crew's words over each other

Mac, testing sailing: *"I notice ships get stuck in the world of daggerfall ocean rocks, your ship can get stuck at sea
in place, your crew mates speaking sometimes seems like gibberish"*. Each was reproduced on the real modules before it
was fixed, pinned by tests that fail on the code as it stood, and mutation-proven.

> **Audited** the same day (FIELD BUGS 2026-10-02b, Mac: "Audit this" - `01-Overview/bugs/Field-Bugs-2026-10-02b.md`).
> SEA-SHOAL below is STRUCK: Deep Waters' real carve never took the lifted sea, so it changed nothing; the sea is kept
> at the flatten now (SEA-LEVEL). ROCK-FREE's nine-ray sweep, its `pass`, and the host's "beneath" rule are gone - the
> sphere is swept exactly, a keel line stands for the rule, an overlap counts once, and a boat never holds; each sweep
> reaches her own end (ROCK-REACH). CREW-SAY merges only what is sung or shouted, keeps a stack's order and eases it
> down, and draws no lifted bubble off the screen's top. The record below stands as it was written.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "ships get stuck in the world of daggerfall ocean rocks" | the hull's sweep read a pixel's whole ground as ONE collider: a ledge under her answered the zero point and hid every other rock of the pixel, so she sailed into the rock ahead; inside it, both faces of its walls held her for good; and every rock in her sweep, ahead or astern, held her to a metre a second even as she sailed away from it | fixed (ROCK-FREE, ROCK-AWAY) |
| 2 | "your ship can get stuck at sea in place" | World of Daggerfall levels a site's ground after the tiles are read, lifting its whole pixel's sea over Come Sail Away's 34 m line: with Deep Waters on, every node read land and she was beached at sea; a beached boat's nodes are never read again; and a bow run onto a shore could not back off it | fixed (SEA-SHOAL, BEACH-READ, ASTERN) |
| 3 | "your crew mates speaking sometimes seems like gibberish" | the lines over the crew's heads stood over each other - the chorus up to six deep, each copy behind its own name; a talk's two lines side by side; a bubble's foot over a mate's name - translucent, the farther painted over the nearer | fixed (CREW-SAY) |

## ROCK-FREE: a rock is met from outside, collider by collider (1)

**Reproduced first** (`test/systems/comeSailAway/fb1002_rocks.test.js`: Come Sail Away's runtime over the vendored hulls, the real `Collider`,
world.js's own `csaSphereCastAll` lifted from its source; a Small Ship under sail, the wind astern). A shelf 3 m under the
sea's line, under her where she starts, and a rock standing out of the sea 80 m ahead, both of one pixel: in 90 s she
sailed through the rock and on, 855 m, to (22.1, 1055.7); without the shelf the rock held her off at (99.3, 245.8). A hull
standing inside a rock - a 120 m one or a 300 m one, closed or open beneath - was still inside it after 90 s, sailing on,
turning or backing.

**Why.** CheckCollision sweeps the hull collider's half-beam sphere along her length both ways (SphereCastAll). The host
answered it off `Collider.sphereCastAll`, Unity's SphereCastAll over a BUCKET as one collider - and a static bucket is a
pixel's whole ground, every World of Daggerfall rock of it in one. A collider the sphere overlaps where the sweep starts
answers Unity's zero point and nothing more (CSA-D's kept bug: the push is a direction from the scene's origin), so a
shelf under her made the whole pixel answer that one zero point: no ray was cast at the rock ahead. And the collider reads
no winding (both faces of every triangle are met), so from inside a rock every ray met its inner walls and pushed her
back in, where Unity's sweep reads no back face.

**The fix.** `player/collider.js` `hullSweepAll`, which the host now asks (`scenes/world.js` `csaSphereCastAll`). A
bucket's PARTS are its colliders - each `addMesh` one, as a World of Daggerfall object or a model is its own MeshCollider
(CreateDaggerfallMeshGameObject) - and each answers once, as Unity's SphereCastAll answers a collider:
- a part her sphere OVERLAPS where the sweep starts answers at its overlap, where it touches - the nearest point of its
  faces her whole sphere reaches - never the zero point, and nothing more (so a shelf she rides over is never met again
  as a rock ahead when the swell pitches her sweep onto it);
- a part that holds her sphere's CENTRE answers nothing (`partsHolding`: a line straight up crosses a closed skin an odd
  number of times from inside it, its crossings at one height once; a rock open beneath, as a model standing in the
  ground is, holds what is under its crown) - she leaves as she likes;
- every other part is met by the sweep: nine spokes over the sphere's cross-section, the centre's to the sphere's front
  at the sweep's end and the rim's eight to the rim's own (the rim's had reached a radius past the swept sphere, so what
  else stood in the bucket - its box the sweep's cull - decided whether they met anything there).
A boat's collider is a mover and never holds a hull: its overlap answers. `raycastHit` takes `pass`, a bucket's parts to
pass through (the sweep's alone; no other caller). The host drops an overlap deeper under her centre than it is off it -
a shelf beneath her has no side to push her from (flattened, it is any way at all). After: over the shelf she is held off
the rock ahead exactly where open water holds her, frame for frame; out of either rock she sails as over open water.

**A departure** (the Port-Ledger row): an overlap's push is from where it touches, not from the scene's origin, for the
world's ground and its boats alike. CheckCollision itself (its two sweeps, the zero-point arm it keeps for the first)
is the C#'s still; the ground probe's own zero point at a carved floor (below) is untouched.

## ROCK-AWAY: what she met takes only her way into it (1)

**Reproduced first** (the same rig, ROCK-FREE in). Sailing off the shelf's far end, its face astern stood in her backward
sweep: she crawled at a metre a second for 20 s (310 to 330 m) and ended 90 s at 927 m, where open water ran to 1,350 m.

**Why.** LateUpdate's response (`systems/comeSailAway/comeSailAway.js` `lateUpdateSailing`) projects her way off the CollisionVector
and adds it back at one metre a second - taking her way OFF what she met as well as into it. In a World of Daggerfall rock
field, with a sweep reaching a hull's length and more fore and aft, any rock astern of a ship under sail held her to a
crawl (at the oars, whose pace astern is that metre, it set her to it at once).

**The fix (a departure).** Under way away from what she met she keeps her way; at rest, or into it, the C#'s push. The
current is taken only where it carries her onto what she met. After: off the shelf, and backing off the rock, she keeps
open water's track frame for frame; rowing into a rock she is held off it as before.

## SEA-SHOAL: a carved sea is water (2)

**Reproduced first** (`test/world/terrain/fb1002_seaheld.test.js`: the sampler's own sea, World of Daggerfall's own flatten, Unity's
SampleHeight, world.js's `csaTerrainOf` mounted, the carve's floor read and the runtime). The open sea reads 33.994 m,
6 mm under the line (FIELD-CSA2). A headland standing 34 m over the sea in the pixel's far corner, with a site levelled on
it (`wodLocationLoader.js` `flattenForLocation`), lifted every sea point probed - 100 to 990 m from the site - to
34.229-34.523 m: land. A Small Ship there, Deep Waters on: all five nodes land, beached; the oars moved nothing. A site
7 m over the sea lifted them to 34.053 m; one 1.7 m over left the far sea at 33.994.

**Why.** LocationLoader.AddLocation runs after the tile's heights are pushed (WOD's "The flatten"): it lerps EVERY sample
of the tile from row 1 to 127 toward the site's mean by 1 / (distance + 1), so the tile's far corner moves about a 180th
of the way - and the sea is 0.4 of a heightmap step from reading land (579.105, held as 579; 580 is 34.053 m). Its tiles stay water (read before), so Deep Waters carves and
draws a sea there; Come Sail Away's node law, with Iliac Puddle No More on, reads `Terrain.SampleHeight` - the heightmap
under the hole - and read land.

**The fix.** `scenes/world.js` `csaTerrainOf`'s `sampleHeight` answers a carved cell's seafloor (DW-B's law: the host's
`heightAt` already stands every capsule, foe and probe on it), the heightmap elsewhere. The node law, the placing's and
the Overworld's probes and the lost-boat check read it: a boat set down near such a site is no longer packed as lost
under the ground. A sea Deep Waters has not carved reads its heightmap as before (the shore's law, FIELD-CSA2's).

## BEACH-READ: a beached boat is read again (2)

**Reproduced first** (the same rig, the carve not yet come - DW-A's bake read on its worker, the floor built after it):
beached, and after the carve came she lay beached for good.

**Why.** LateUpdate reads the nodes only when the boat moved or turned, and a beached boat never moves.

**The fix (a departure).** A beached boat lying still has her nodes read again each frame, and her collision with them
the frame she comes off. Not where the player stands on no built terrain: nothing is read (the C#'s throw is a moving
boat's, kept). A beach stays a beach - on real ground every reading is land, every frame.

## ASTERN: back asks the stern's node (2)

**Reproduced first** (a straight shore north of her, her bow's node on it): back refused, forward allowed - the centre's
water rowed her on in.

**Why.** The oars ask the node one along (CSA-D's kept bug): back the BOW's.

**The fix (a departure).** Back asks the STERN's, the water she backs into: she backs off the shore (18 m in 20 s), and a
stern on a shore refuses back. Forward still asks the centre's; the strafes keep the C#'s nodes (below).

## CREW-SAY: the words never over each other (3)

**Reproduced first** (`test/systems/naval/fb1002_crewsay.test.js`: the real crew life, its tables' own lines, projected from the helm's
eye; the HUD's own layout and DOM). Nothing scrambles a crewman's words - every line is crewLife.js's and shipCrew.js's
English. Over ten minutes of two crews of sixty, two or more lines were up in 5,103 of 12,000 frames, and in 2,843 of
them bubbles stood over each other: the chorus is every hand at once (sung by two or more in 1,225 frames, up to six
deep), each copy behind its own name and so wrapped at its own words; a talk's two lines stood side by side over two
hands side by side; a bubble's foot, 6 px over the head point, covered a mate's name and health bar. At 0.62 of an opaque
ground, the farther painted over the nearer, they read through each other.

**The fix.** `ui/naval/navalHud.js` `layoutCrewLines`, which `drawCrewLines` lays: a line said by two or more at once is laid
once, over the nearest of them and by no name (it is theirs together; world.js hands a speaker's first name beside his
line, never in it); a line said alone keeps its speaker's name; each foot CREW_SAY_LIFT (26 px) over the head, clear of a
mate's bar and the name over it by the sheet's own numbers; each farther bubble lifted over every nearer one it would
cover, CREW_SAY_GAP apart, in whole pixels; the nearest drawn over the rest. A bubble's box is read off its words
(`crewSayBox`): the sheet's content box - its words to max-width, its padding and ring outside them. After: none of the
12,000 frames has two bubbles meet.

## Said, not fixed

- **The crew's names** are DFU's own (NameHelper's banks: a Redguard crew's read strange to an English eye) - the port's
  names, unchanged.
- **The strafes' nodes** stay the C#'s (the right strafe the stern's, the left the starboard's, the port node never):
  a half-speed crawl sideways, held by none of the reports.
- **A node over the next pixel** reads the player's pixel's edge (CSA-J's clamp, Unity's GetInterpolatedHeight).
- **The ground probe at a carved floor** answers the zero point when the sweep starts under it (`DeepWaters_Seafloor` is
  no Terrain, so CheckCollision keeps it): not reproduced in the field, kept as it stood.
- **A turn beside what she met** is refused by the sign of the side it lies on (CanTurnLeft/Right), so one dead ahead or
  astern refuses whichever side its rounding leans to: the C#'s, kept.
- **In irons.** A ship turned head to wind under sail stops and her rudder with her (the mod's sail law; HELM-KEYS' tell
  says how out): seen in the reproduction, not a trap.
- **Cargo.** A ship's speed falls with her load (the Cargo modifier, its messages): the mod's law, and plunder is tens of
  kilograms against a hull's threshold.

## Found on the way, not changed

Re-judging every record the change can move (the four moved pins' and every record on `player/collider.js`,
`systems/comeSailAway/comeSailAway.js` and `ui/naval/navalHud.js`: 869 - 863 dead, 4 equivalent as recorded) left two survivors, and each
survives on this tree's base (d96bdc123) alike - older than this work, in code it does not touch, reported for their own
fix: `auditdisc28_motion.json` AUDIT-DISC28-MO2-rest-kills-PH1 (`player/collider.js` `lowOneWay`, PH1 at rest, against
`test/player/disc28_swim.test.js`) and `fb0929h_lostboat.json` LOST-BOAT-a-crewed-hull-packed (`systems/comeSailAway/comeSailAway.js`
`recoverLostBoats`' crewed-hull exemption, against `test/systems/comeSailAway/fb0929h_lostboat.test.js`).

## The pins and the mutants

`test/systems/comeSailAway/fb1002_rocks.test.js` (6), `test/world/terrain/fb1002_seaheld.test.js` (3), `test/systems/naval/fb1002_crewsay.test.js` (3), each red on the
code before. `tools/mutants/fb1002_rocks.json` (25), `fb1002_seaheld.json` (4), `fb1002_crewsay.json` (20) - all dead.
PINS MOVED, each by content: `csa_sailing` (back asks the stern; the pin's title), `csa_close` (the sampler's clamp line),
`colliderkeys` (four cell lookups: ROCK-FREE's two), `perfcol1` (three module scratch Sets: the hull sweep's two, made
once), `livingcrew` (a bubble's transform). Records re-aimed by content, all
dead: `csa_close.json` CSA-J-host-terrain-unclamped, `field_csa2.json` FIELD-CSA2-host-reads-the-drawn-ground,
`csa_sailing.json` CSA-D-back-node-stern - now CSA-D-back-node-bow, the C#'s node ASTERN leaves -
`navaudit_frame.json` NAVF-sweep-box-unturned (by the comment only sphereCastAll's cull has), and `livingcrew.json`'s
SAY-every-line and SAY-never-hidden. Not seen in a browser.

## Part four - the Basket's cursor

A #bug-reports thread through Mac (a screenshot, 2026-10-02), and Mac's ask under it:

> miö, "Herbalism minigame bugged": *"Doesn't make mouse appear when the minigame starts, so cant click on the
> targets."*
>
> Mac: "Also check the other minigames"

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Doesn't make mouse appear when the minigame starts, so cant click on the targets" | miö | the Basket's glints stand about the crosshair (`ui/professions/profReticle.js` `BASKET_SPREAD`, up to about 40 px off it at HUD scale 1), drawn as targets with "tap the glint" under them. The mouse stayed locked to the look, so moving it toward a glint turned the view and the glint turned with it: no glint could be put under the pointer. A press anywhere while a glint showed did find it (ACT-CLICK), but nothing on the screen said so, and a press during the gap spends the next glint (AUDIT 29 C9) | fixed (HERB-CURSOR) |
| 2 | "Also check the other minigames" | Mac | every act read for what it needs of the mouse: the mine's points, the knife's line and the net's throw (the school its release lands in - the audit, C1) are aimed by the look itself, and a cursor the player had freed (FreeMouse; Enter only offline, or with the chat put away) left them unaimable by the mouse; the chop's ring, the hand and the steady hold need neither; the stations (the heat, the stitch, the plane, the chisel) are Stores-page sections, under the pause window's free cursor | fixed (HERB-CURSOR); the rest checked, unchanged |

## HERB-CURSOR: the act says what it needs of the mouse (1, 2)

**The law** (`scenes/gatherHost.js` `ACT_POINTER` and `actPointer`, by the act machine's kind): the Basket `cursor`,
the mine, the trace and the net `look`, every other act nothing; an act played gently needs nothing, but for the net,
whose gentle throw is still aimed (the audit, C2). The host asks its `pointer` seam as an act starts, in the press's
frame, and calls the release the seam answered as the act ends, however it ends: its end, Escape, walking off, a window
over it, the professions shut, `dispose` (which no host calls yet - a new host's boot clears a hold left over). It syncs
at the change where the host makes it, and at every frame's start and end (`syncPointer`); leaving a dungeon is synced
by the next frame (a dungeon's acts are the mine's and the trace's, which hold nothing).

**The hold** (`player/pointerLock.js` `holdCursor`). Not the player's toggle (`cursorActive` - its freed mouse is the
large HUD's, the hotbar's mouse mode and the pad's pointer mode, none of them the Basket's): a hold of its own. Taken,
it lets the lock go; while any stands, `requestLook` refuses (a click's relock arm, a window's close, the look gate,
PL3's net), a lock the browser grants late is let go (AUDIT OW5 V1's listener), and the FreeMouse toggle is refused
(the audit, A2). The release is once-only and says whether it let go of the last. A host's boot clears any left over,
as it resets the toggle (PL3).

**The world's seam** (`scenes/world.js`, line-neutral). `cursor`: the hold - none with a pad in hand, whose trigger
strikes (C8) - and at its release the look asked back unless something else holds the mouse: the player's own freed
cursor, a paused window, a surface (the chat, the friends panel), a modal window, an enhanced overlay, the travel view.
When an Escape ended the act, the look is asked on that Escape's keyup (A1). `look`: a cursor the player freed is
taken back (`setCursorActive(false)`), the lock asked under the same gates (A4); no release - the look stays.

**The relock.** Chromium and the desktop app grant it without a fresh gesture, the page having let the lock go itself.
A browser that asks a recent gesture of every lock (Firefox: about five seconds) may refuse it at the end of a search
whose last glints ran out unclicked; the cursor then stays until the next click, which relocks and activates nothing
(the canvas arm's click delay).

The Basket's rules are unchanged: any press while a glint shows finds it, and a press in the gap spends the next (5, 8;
AUDIT 29 C9). A pad's trigger and a finger's tap strike as before (ACT-TOUCH). The cursor is now free to click the
glint itself, and the hint says so: "click the glint" (C3).

## Pins and mutants (part four)

- `test/systems/foraging/fb1002_herbcursor.test.js` (6): the law; the hold (refused requests, the last release, once-only, the late
  lock, the boot's reset); the report, answered (the Basket's search through the real host and herbKind: the cursor
  asked in the press's frame, held through the three glints, every clicked glint found, the look handed back once);
  every end (Escape, walking off, a window, the professions shut, `dispose`); the other acts (a vein asks the look; a
  common herb's hand and, stood again at tier 2, the Sickle's steady hold ask nothing); the world's seam, by source.
- `tools/mutants/fb1002_herbcursor.json` (17, with the audit's let-go-before-the-end), all dead.
- PIN MOVED: `test/net/chat1.test.js`'s source pin on world.js's `pointerLock.js` import (holdCursor joined it). Six
  records re-aimed by content to the two lines of `pointerLock.js` the hold changed - one each in `menurelock1.json`
  and `freemouse1.json`, three in `fb0929_overworld_mouse.json`, one in `ow5.json` - each killed by the tests its
  original was (their four lists, 55, all dead). The cites the change moved were re-resolved (`tools/citeShift.mjs
  --base 1d2e8ce8`, 4: the range into `pointerLock.js` from the toggle's flag to `bindCursorToggle`).
- Every other list aimed at `scenes/gatherHost.js` or `player/pointerLock.js` (21) run on the final code: 779 dead,
  7 equivalent as recorded, none stale; four survivors that survive on the base too (below).

## The audit of part four (Mac: "Audit this")

Four lenses over the batch as committed (8e5dcbe2), each against the base (1d2e8ce8), nothing changed while they read:
A the mouse and the lock in a browser (a fake one with Chromium's and Firefox's lock rules - asynchronous grants, the
page-released exception, the post-Escape cooldown, Escape's unlock on its keyup - over the real `pointerLock.js` and
gathering host); B the host's acts and the click (every start and end, the real activation gate); C every other
minigame and station, on both skins, with a mouse, FreeMouse, a pad and a finger; D the records. Every finding was
reproduced red in `test/systems/fb1002_herbcursor_audit.test.js` first - world.js's own lines (the seam, the Escape's keyup,
the street ladder's two clicks) lifted out of the source and run over the real modules - then fixed and its mutant
killed.

| | Finding | Fix |
|---|---|---|
| A1 | Escape ending the Basket asked the lock back inside its own keydown. The lock landed before the key came up, and both browsers end a lock on Escape's keyup: the cursor came back free anyway, and with Escape held 300 ms or more ESC-LOCK read the loss as a second Escape and opened the pause (AUDIT 29 D1's "the pause waits for the next press" broken) | the relock is kept for that Escape's keyup (`escRelock`, under the same gates); the act's other ends ask at once |
| A2 | FreeMouse pressed mid-Basket latched unseen (the cursor was already free); at the end the release saw the player's freed cursor and left it, and every click's relock was refused until FreeMouse was pressed again | the toggle is refused while a hold stands |
| A3, B1 | The hold was let go only at the end of the host's frame. world.js swallows a frame's throw: a throw on the frame an act ended kept the cursor free a frame, and a throw every frame (the HUD's, a node's list) kept it free for the session, every relock refused | `syncPointer` at the frame's start too, before anything of it can throw |
| A4, B4 | `look` asked the lock with no gate: a FreeMouse under the friends panel or the F-menu (both surfaces), then a Pick-Axe from the hotbar's mouse mode, took the lock from under the panel (AUDIT SOC B6's dead panel) | the flag cleared, the lock asked under the release's gates; the surface's close relocks |
| A5 | Firefox (no page-released exception) cannot relock without a gesture in the last five seconds: a search nobody clicks ends with the cursor free until a click | recorded (above); C2's gentle search, the one that is never clicked, no longer holds |
| B2 | Pre-existing, found here: the release of the click that found the Basket's last glint pressed the patch's lit "Pick" row - `nodeClicked` was asked before the act's click (CLICK-LIFT) and without it - and played a second act nobody asked for, a harvest and the Sickle's wear. The free cursor's 0.3 s click delay hid it for a quick click, not for one held 0.3 s | the street ladder asks the act's click first and the node's click is refused on it, as the dungeon's ladder already did |
| C1 | The net's throw is aimed by the look (`fishAct` `schoolAt`, the school its release lands in: a school's catch is bigger), so "the net needs neither" was wrong and FreeMouse left the throw unaimable by the mouse | the net takes the look (`fish: 'look'`) |
| C2 | Gentle acts unread: a gentle Basket (nothing to press, its finds plain) freed the cursor for its whole search under "tap the glint", and a gentle vein or body took a freed cursor for no aim | an act played gently needs nothing (`actPointer`; the herb act's state says `gentle`, as the mine's and the trace's did), but the net's throw, still aimed |
| C3 | Pre-existing: "tap the glint" over a cursor now free to click it, and over a gentle search with nothing to press | "click the glint"; a gentle search says "searching..." |
| C8 | A pad in hand had the lock let go too, and the OS pointer stood mid-screen through the search (Enhanced Plus hides it; the other skins did not) | no hold with a pad in hand (`controllerLook`); its trigger strikes |
| D | The records: Enter named as freeing the mouse online (the chat takes it there), "778 dead" (779 - one ran under the full suite's load and survived; alone it dies three times in three), the six re-aimed records only in a commit message, the hand pinned and recorded as the steady hold, the "(mutants: ...)" titles against the list, the index and the page's title without this part, a cite-shaped record citeShift would move, `dispose` called "the page gone" (no host calls it), "after every change of the act" (the dungeon left is the next frame's), the precedence comment in `requestLook`, the patch notes' "Fishing doesn't use the mouse cursor" and their missing "the look stays" | each made true |

**Checked and sound.** Every caller of `requestLook` (the street, the exterior, the dungeon, interiors, talk, books,
the dial, the pause, the shell) is refused under a hold, so nothing takes the lock mid-search; a lock asked before the
hold lands and is let go as the page's own release (no synthetic Escape); the travel view, the chat and the friends
panel, a key-opened window and the classic list window all end the search and leave the relock to their own close; a
click with the cursor free reaches the act once (the window's `mousedown`) and nothing else - no swing, cast,
activation, hover or target change; the glints, meter and prompt ignore the pointer; touch has no lock; the pad's
pointer mode keys on the player's toggle, not the hold. Every act's kind is in the law, and every station opens under
the pause window's free cursor on both skins (a home's piece through `togglePause({ at: 'stores' })`, a shop's through
the Professions key).

**Not changed.** The steady hold reads the view's turn to bruise; with a cursor the player freed, the mouse cannot
turn the view, so it cannot bruise (the turn keys and the feet still do) - pre-existing, and keeping still is the
act. Taking the look for a mine, a trace or a net is one-way: the player frees the mouse again if they want it.

Pinned: `test/systems/fb1002_herbcursor_audit.test.js` (10). `tools/mutants/fb1002_herbcursor_audit.json` (14), all dead. On
the final code, the two lists with every record any other list aims at the files the audit changed (`pointerLock.js`,
`gatherHost.js`, `herbHost.js`, `herbAct.js` and `profReticle.js` whole, world.js within 30 lines of its changes: 242):
272 dead; VEIN-NEED-press-keeps-nothing survives, on the base too (below).
PIN MOVED: `test/systems/prof1_client.test.js` (the ladder's order: the act's click before the node's),
`test/systems/fb0930b_toolsaid.test.js` (the node's click refused on the act's; the Basket's words); STEADY-SAID-the-key-never-named
(`fb1001_nodes.json`) re-aimed to the new words (its list, 9, all dead). The audit's cites re-resolved (`tools/citeShift.mjs`
against 8e5dcbe2, 4: the same range, grown by A2's refusal); world.js stayed line-neutral (the ladder's two lines
traded places).

## Found on the way, not changed (part four)

- Four records survive on the base as here, none in this change's code: VEIN-NEED-press-keeps-nothing
  (`fb0929h_veinneed.json`), TOOL-SAID-the-basket-names-no-choice-key (`fb0930b_toolsaid.json`), PROF4-ram-kit-made
  and PROF4-ram-kit-asked (`prof4.json`). Not this batch's.
- ESC-LOCK's twin of A1, on the base: a window the look gate let the lock go for, closed by a held Escape, relocks
  inside the keydown and the keyup's unlock opens the pause (lens A's `windowEscClose`). Not this batch's - its fix is
  ESC-LOCK's (a loss while the real Escape is still down is that press).
- The first harvest's "where the Stores are" line names the Professions key's label, '?' when it is unbound
  (`gatherHost.js` `storesWhereLine`); its fallback names the pause menu's Stores page, which the Classic pause has not.
