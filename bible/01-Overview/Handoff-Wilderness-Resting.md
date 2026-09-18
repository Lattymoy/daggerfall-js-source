# The wilderness-resting hand-off, 2026-09-18

Mac handed over a zip, `WildernessRestingHOTHOTFIX`, and asked for it to
be implemented. It was not a mod: it was four files out of a working
tree - `src/scenes/world.js`, `src/scenes/exterior.js`,
`test/camp1_groups.test.js`, `test/restx2_online_rest.test.js` - carrying
**four separable features and a stale base**.

**The base predated JAN1.** Copied in as given, those two hosts would
have reverted five shipped laws: JAN1's terrain-floor `groundY` (the
villagers walking in the sky come back), JAN1's `syncTopics` on the world
origin (the classic talk box comes back), JAN1's `weaponPose` host-bag
pair in **both** exterior hosts (the fist under the torch comes back),
ECON1's world price tilt, and WATCH1's `watch` wiring in the online bag.
Fifty-two hunks; thirty-one of them were nothing but citation line
numbers renumbering against the older base. Each feature was therefore
lifted onto the current tree by hand rather than applied.

## What landed

### CAMP1-REST - no group roll under a rest

`runEncounterTick` takes a third argument in both exterior hosts, the
group roll stands down while it is set, and the rest deps set it.

**The hand-off's stated reason was wrong, and the record has to say so,
because the wrong reason is the one a future reader would re-derive.** It
read the interrupt as a distance law: camps stand at 14..26,
`RESTING_DISTANCE` is 12, therefore a camp can never be seen. But
`areEnemiesNearby`'s resting arm is **sight first** - a foe that has SEEN
the player is reported at any range, and the 12-unit test is only the
fallback for one that has not. And the world is **not** frozen while a
rest runs: WINFOE1 drives `exteriorFoes.update` on the frame's own `dt`
under a window, which is precisely so that a foe can walk up and break a
rest.

So the true shape is narrower and is about **facing**. A lone wanderer is
minted `LookAt player` and trips the sight arm on its first senses tick,
which is how rests have always been interruptible and what the dungeon's
own rest roll leans on deliberately. A campmate is minted facing the
**anchor**, and the band puts it past the fallback - so the group that
lands in silence is the one whose members happen to face away. Most
groups do wake the sleeper; the quiet minority is what reads as a bug.

That leaves two honest fixes: yaw the members at the sleeper, or stand
the roll down. **Mac's call is the second** - groups are a
walking-around feature - and that is a design decision, recorded as one,
not a bug fix. The one-line alternative is written down here so it can be
taken later without rediscovering it.

**The online cost, taken knowingly.** The group roll belongs to the
elected owner (`amGroupRollOwner`), and every client elects the same one,
so while the owner sleeps the whole cluster rolls no groups at all.
Handing the roll to the next waking peer needs a rest flag on the wire,
which a hotfix does not add.

**The leak that is covered by construction, not by the flag.**
`worldModes`' interior rest deps also drive `host.encounterTick()`, with
no flag. It is harmless only because `campGateOk` refuses `inside`
outright, so a roll from within a building can never reach a group. The
hand-off's own pin claimed that call site was "the ordinary walking
tick"; it is not, and both halves are pinned now.

### D-ONLINE2 - Privateer's Hold is not a respawn door

D-ONLINE1 respawns an online dungeon death at the dungeon's own pixel,
outside the door the player came in by. In the tutorial dungeon that is a
free pass out of the one dungeon the game means you to solve, so a death
there falls through to the ordinary safe-location search instead. Read
off the configured start cell (`Startup.StartCellX/Y`), never a hardcoded
pixel, so a custom start cell is honoured exactly as the classic start
honours it; and the search answers only a temple, a city or a graveyard,
so it can never bounce the player back inside.

Tagged **D-ONLINE2**, not PH1 as the hand-off had it: `PH1` is already
the collider's one-way floor, and one tag is one law.

## What was refused, and why

**CAMP2 - `suppressInfighting` on every campmate.** The bug is real:
group members are independent draws from one encounter table, so a group
mixes combat Teams routinely, and `EnemyInfighting` ships on, so groups
do fight themselves. But the patch is not ready, on three counts.
Its justification cites a `mobileFactions.js` and a "theme" system that
**do not exist in this tree** - it describes a different codebase.
The flag cuts **both** ways (`enemyTargets.js`): a flagged foe is not
merely off other foes' lists, it takes no foe target at all - so a
campmate also stops fighting the player's summoned ally, which is a
combat change nobody has weighed. And it is **not saved**:
`snapshotWorld` carries neither `suppressInfighting` nor `campId`, so a
quickload mid-ambush resumes the infighting and drops CAMP1's own group
shout. Worth doing; worth doing deliberately, with the save half and a
decision on the ally case.

**The RemotePlayers arguments.** `uploadRecordFrame` in the deps and
`{ dt, eye }` on `sync()` are inert here: `src/net/remotePlayers.js` has
no class-enemy billboard path at all, reads none of the three, and the
module is dolls, batches and name points only. Not a crash - every name
is in scope - just dead weight from a larger change set the zip does not
contain.

**`isOnlineWorldSession()`.** Dead on arrival: the hand-off's comment
says it exists for an in-place handler in `worldModes`, and no such
handler is in this tree. Zero callers anywhere, including in the zip.

## The campaign

`test/camp1_groups.test.js` (7 - two new), `test/restx2_online_rest.test.js`
and `test/donline1_respawn.test.js` re-aimed, plus `exteriorfoes` and
`roadb_guard_conversion`, whose anchors quoted the signature that grew.
`tools/mutants/camp1rest.json` (7 dead) and `tools/mutants/donline2.json`
(3 dead).

## Not seen on a GPU

Nobody has slept in a wilderness next to a camp. The bands, the interrupt
and the facing are driven in node against the real `areEnemiesNearby`.
