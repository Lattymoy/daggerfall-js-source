# FIELD BUGS 2026-10-01b - another player's boat, walked through and never stood on; a vampire's day indoors

Mac, the same day, in one list: *"Players aren't colliding with other players' boats and can't stand on board"* and
*"Sunlight debuff applies in interior (Should be buffed in interiors) (Vampires)"*. Each was reproduced on the real
modules before it was fixed, pinned by tests that fail on the code as it stood, and mutation-proven.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Players aren't colliding with other players' boats" | CSA-K stood another player's boat in a player's collider only while that player was aboard it (PR-WAGON1's "Others' wagons don't block", carried over to boats; CSA-J had stood it in none): to everyone else her hull and her deck's furniture were walked and swum through | fixed (PEER-HULL) |
| 2 | "... and can't stand on board" | her deck was no floor to anyone not aboard - only her ladder's press or a drop onto it boarded her - and the aboard door took only the drop, so a body standing on her own colliders was never aboard and she would sail out from under it | fixed (PEER-DECK) |
| 3 | "Sunlight debuff applies in interior (Should be buffed in interiors) (Vampires)" | VAMP-DAY's -20 read the hour alone: a vampire in a building, a dungeon or a cell by day was 20 down on seven stats where DFU gives him 20 up | fixed (VAMP-SUN) |

## PEER-HULL, PEER-DECK: her boat is met and stood on as my own (1, 2)

**Reproduced first** (`test/scenes/fb1001b_peerboats.test.js`: Come Sail Away's pool over the vendored hulls, Ann's boat posed
off her word, the aboard machine, the real `Collider` and `PlayerMotor`, world.js's own `csaSyncColliders`,
`csaSphereCastAll` and `csaPeersFrame` lifted and run in the frame's order): a wader running at her Small Ship's beam
walked through her and ran on 40 m, where my own of the same hull stops him 3.45 m off her keel; a ray across her deck
met no mainmast; a body set down on her deck fell into it.

**Why.** CSA-K (13cf2088b, 2026-09-28) stood her colliders only for the one aboard her, and boarded only by her ladder or
a drop onto her deck (`scenes/comeSailAway/comeSailAwayAboard.js` frame: `ground == null`). It never worked; nothing recent broke it.

**The fix** (Mac's word sets PR-WAGON1's law aside for boats; a wagon's stands). `scenes/world.js` csaSyncColliders
stands every peer's boat that stands beside my boats and the sea's ships, aboard her or not, on the street alone; the
helm's sweep meets her as it meets a boat of mine. `scenes/comeSailAway/comeSailAwayAboard.js` boards by the module's own `on`:
standing on her colliders is aboard her, so her deck carries whoever stands on it as she sails (CSA-K's carry). THE
FOUR HOSTS: world.js wired; worldModes.js and dungeonContext.js stand no one's boat; exterior.js has no peers. No relay
or wire change.

**Not changed.** The mod's own rays (the placing, the riders) still meet the player's own boats alone, so a boat can
still be placed inside another's; a foe on her deck is not carried (CSA-K's declared limit, reachable now that her deck
is a floor). Every shown peer boat is solid (at most eight a player); a range limit was not added and a crowded port's
cost was not measured. Pins: `test/scenes/fb1001b_peerboats.test.js` (5); `tools/mutants/fb1001b_peerboats.json` 9, all dead;
`csa_together.json`'s two records re-aimed, all 93 dead. Not seen in a browser with two players.

## VAMP-SUN: out of the sun, a vampire is DFU's (3)

**Reproduced first** (`test/systems/fb1001b_vampsun.test.js`). The player, cursed by `createVampirismCurse`, ticked a minute at a
time through the hosts' own ticker. The real mode machine (worldModes, which world.js's street and exterior.js both
build) entered a real tavern by its own entry at noon; its seam answered that no sun reached him, and the curse's round
still wrote -20 on the seven stats. dungeonContext's own registration, lifted from src/, did the same in a crypt.

**Why.** VAMP-DAY (2026-09-26, `9901928e`) traded the sun's burn for 20 off the seven stats by day, keyed on
`isDayFromMinutes`: "wherever the vampire stands". The burn it replaced never reached indoors: since V2c (`c5a298f8`) it
fired only on `playerInSunlight` - DamageFromSunlight strikes `if (IsPlayerInSunlight)` (PassiveSpecialsEffect.cs:168),
which is IsDay && !IsPlayerInside && !InPrison (PlayerEnterExit.cs:371), IsPlayerInside raised by EnableInteriorParent
(:1086) and EnableDungeonParent (:1110). Out of the sun, ApplyVampireAdvantages gives +20 every round, everywhere
(VampirismEffect.cs:349-373). VAMP-DAY moved the cost and dropped the place.

**The fix.** `systems/vampirism.js` `vampireStatMod` asks the same flag: passiveSpecials.js `playerInSunlight`, the one
port of IsPlayerInSunlight and the seam every host registers. THE FOUR HOSTS, none changed: world.js's street and
exterior.js through the mode machine each builds, a building through worldModes, a dungeon through dungeonContext's own
registration. In the street from 06:00 to 18:00 the seven stats (and an Anthotis mind) are 20 down as before; indoors,
underground, in a cell or by night he has DFU's +20, and nothing past it - felt within a game minute of the door, DFU's
round. Unchanged: the skills' +30, holy ground, feeding, and the travel rules (CheckFastTravel reads the hour alone,
:195-208); the hood still lifts the travel rules only - OPEN for Mac: whether a raised hood in the street by day should
lift the -20 too. Pins: `test/systems/fb1001b_vampsun.test.js` (4); `tools/mutants/fb1001b_vampsun.json` 10, all dead;
`vampday.json`'s two records re-aimed (9, all dead); lived1, vamphood and HOOD-SAID re-run (62, all dead).
