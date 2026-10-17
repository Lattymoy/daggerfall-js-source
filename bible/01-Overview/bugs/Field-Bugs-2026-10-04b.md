# FIELD BUGS 2026-10-04b - a companion walks the player's own trail; companions and Lysandus' ghost quieter

Mac, from play: *"Companion pathing is really rough. They're also walking towards to the wall, next to the exit that
leads to outside"*, then *"Reduce companion noises, they are way too persistant"*, then *"Reduce Lysandus VENGENANCE
audio"*. Each fix is pinned by tests that fail on the code before it, and its pins are mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Companion pathing is really rough. They're also walking towards to the wall, next to the exit that leads to outside" (Mac) | a companion with no foe walked STRAIGHT at the player (`enemyMotor.js _followGoal` answered the leader's feet) - the street, a building and a dungeon without the pathing motor have no navmesh, and the pathing motor is off by default - and stopped to turn whenever its way was more than 5.625 degrees off (the pursuit's gate), so it stuttered round every bend; through a doorway it met the wall beside the door and DFU's detour slid it along that wall and back for as long as the player stood within 40 m. A foe's walk (5 m/s at Speed 50) is slower than the player's run (about 8), so on a long run it fell back to the catch-up's portal | COMPANION-TRAIL |
| 2 | "Reduce companion noises, they are way too persistant" (Mac) | a companion is a foe body, and every pool ticks DFU's attract cadence on it (EnemySounds.cs: a bark or a move sound every 3 to 9 s while the player is inside 16 m) - a foe announcing itself, played by a body that is always beside the player: a sworn revenant barked every six seconds on average for as long as it walked with you. And the whole party arrives through a portal at every door, each portal its own cast sound | QUIET-COMPANIONS |
| 3 | "Reduce Lysandus VENGENANCE audio" (Mac) | S0000977, the ghost of King Lysandus in Daggerfall at night: `play sound vengence 5 0` - every five game minutes for as long as the player is in the city at night (about every 25 real seconds at the classic time scale), at full volume and with no position, on the quest machine's one 2D source | QUIET-VENGEANCE |

## COMPANION-TRAIL (1)

`scenes/crewAshore.js` (`drop`, `TRAIL_STEP_M`, `TRAIL_MAX`, `TRAIL_JUMP_M`, the follow handle's `trail`);
`characters/enemy/enemyMotor.js` (`_followGoal`, `_trailGoal`, `_crumbFrom`, `_nearestCrumb`, `_clearLine`, `_followTicks`,
the grounded walk's pace, `FOLLOW_SIGHT_S`, `FOLLOW_SIGHT_TRIES`, `FOLLOW_CRUMB_REACH`, `FOLLOW_SIGHT_RADIUS`,
`FOLLOW_SIGHT_DY`, `FOLLOW_CRUMB_FAR`, `FOLLOW_YAW_GATE_DEG`, `FOLLOW_RUN_M`, `FOLLOW_RUN_PACE`); `ai/enhancedMotor.js`
(`_followGoal`). Reproduced first, in the shape of the report: two rooms, the wall between them, a 1.2 m doorway at its
south end, the companion at the north end of the first room and the player walking down to the door, through it and up
the far room. On the code before, the companion stood pressed to the wall beside the door (x 5.55, the wall at 5.9) for
the full thirty seconds the probe ran.

The fix is the trail the player actually walked. The companion layer drops a crumb every 0.75 m the leader walks on a
floor (none in a jump's arc, a swim or a levitation), keeps the newest 64 (48 m - past the 40 m catch-up), and begins it
again in a new place or when the leader moves 8 m in one frame (a teleport, the floating origin's recentre - a motor
that recentres drops its crumb too). The motor's follow, every quarter second: the leader, while a capsule cast at the
obstacle probe's height reaches within 0.8 m of the leader and the leader is no more than 1.2 m above or below; else the
newest crumb in sight, looked for newest first with at most six casts spread over the crumbs newer than the one it holds
(none further than 50 m is looked at); between looks it walks the crumb it holds, and the next one once it is within
0.8 m. Lost - no line to the leader or a crumb - it walks from the nearest crumb. With no trail (a host that hands none)
it walks straight at the leader as it always did. The pathing motor asks the trail first and routes on the navmesh only
when the trail has nothing (the walked way through a doorway is the way the bake's erosion trims), the nearest crumb
when there is no route. The walk: a follower walks on while its way is within 30 degrees, turning on the classic ticks
as it goes, and further than 8 m from the leader it walks at 1.6 times its pace (8 m/s at Speed 50 - the player's run).
Through the same doorway the companion is at heel the moment the player stops; the pathing motor asks for no route.

Found on the way: the wider walk gate alone lets DFU's detour work a companion round the one wall of
`test/systems/naval/crewcompanions.test.js`'s divided room (it pinned him at 6.87 m before), so that test's last pin - "the classic
motor walks straight at the wall" - was no longer true; it is restated as the time to heel (the route about 2.7 s, the
straight line about 5.5 s). It is still the trail that takes him through the doorway.

The four hosts: the companion layer is `scenes/world.js`'s alone (its two `createCrewAshore`, the crew's and the
sworn's, whose follow handles carry the trail); the motor's follow runs in the pools of `scenes/worldModes.js` (a
building's, `exteriorFoes.js`) and `scenes/dungeonContext.js` (classic or the pathing motor) with nothing of theirs
changed; `scenes/exterior.js` FLAGGED - the dev host stands no companions. Pinned by `test/scenes/fb1004b_companions.test.js`
(the doorway through the layer's own trail and without it, the line, the pathing motor's trail-first, the trail's law,
the walk) and `test/systems/naval/crewcompanions.test.js` (re-pinned).

## QUIET-COMPANIONS (2)

`characters/enemy/enemySounds.js` (`COMPANION_ATTRACT_SCALE`, `EnemySoundSource.tick`'s `companion`), `scenes/hostCombat.js`
(`tickEnemySound`'s `companion`), `scenes/exteriorFoes.js` and `scenes/dungeonContext.js` (each of their two bark sites
passes `companion: f.companion != null` - my companions and another player's alike); `scenes/portalFx.js`
(`PORTAL_SOUND_GAP_MS`). A companion's attract wait is six times the one it rolled - 18 to 54 s where DFU's foe waits 3
to 9 - read at the tick, so a body that turns companion after its first roll is quiet from that tick; its attack sound
is DFU's. A pool's portals ring once in 1.5 s, every portal still opening: the party arriving at a door is one cast, not
three. The sworn's spoken words were already rare (`world.js BARK`: twenty seconds across the party, a minute each) and
are unchanged. The four hosts: the street's and a building's pools are `exteriorFoes.js`'s (world.js, worldModes.js, and
exterior.js's street through the same factory), the dungeon's `dungeonContext.js`'s - every bark site wired; the city
watch (`cityGuards.js`) is never a companion. Port-Ledger A (end of file).

## QUIET-VENGEANCE (3)

`systems/audio.js` (`QuestAudioSource.playQuestSound`, `QUIET_QUEST_SOUNDS`); `scenes/world.js` and
`scenes/exterior.js` (the `playSound` hook is that one body now, where each host wrote the busy skip out). `386,
vengence` plays at 0.4 of its volume and no sooner than a minute after its last play: inside the minute the hook answers
false exactly as a busy source does (PlaySound.cs:110-116), so the action keeps its interval due and plays the moment the
minute is out - over ten real minutes at the classic 12x, nine or ten times where DFU rang twenty-four. No other quest
sound changes (the corpus's other six are one-shots, or the Mages' ball lightning a minute apart). The four hosts: the
two that own a quest machine (world.js, exterior.js) call the one body; worldModes.js and dungeonContext.js are handed
their bridge. Port-Ledger A (end of file).

`tools/mutants/fb1004b.json` (25, all dead). Three records of `tools/mutants/crewcompanions.json` and
`tools/mutants/auditcrew.json` re-aimed by content (the place key's reset, the follow handle, the layer's clear). The
line cites the source edits moved re-resolved by `tools/citeShift.mjs` (48), and the ten struck ones CD4 gates by hand.
