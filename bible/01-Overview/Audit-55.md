# AUDIT 55 - THE SWITCH'S REACH (2026-09-03)

Mac: "Do a comprehensive audit. I also think enhanced AI is affecting
NPCs. I noticed they were hovering and walking around in mid air."

## Why this shape

The Enhanced AI arc shipped five slices in two days and the first
thing a player saw of AI 4 was a bug the suite could not see (every foe
a floating billboard - a temporal dead zone inside a per-foe try). The
second playtest found a bake that was not height-invariant. So this
audit does two things: it takes the NPC report as a hypothesis and
tests it for a MECHANISM rather than for plausibility, and it sweeps
the arc's own new seams for the fault shapes those two bugs had - a
value produced in one place and read in another, and an assumption
that only held at the origin.

Eight sweeps. Two findings. The NPC report is **unreproduced, with no
mechanism found** - and that is a result, stated as one.

## The sweeps

| # | Sweep | Result |
|---|---|---|
| 1 | Every reader of `enhancedAI` / `EnhancedEnemyAI` / `enhancedNav` in src | four files: `ai/enhancedMotor.js`, `scenes/dungeonContext.js`, `systems/uiPrefs.js`, `ui/enhancedMenu.js`. **None is an NPC path.** `mobilePerson.js`, `world.js`, `exterior.js`, `cityGuards.js`, `exteriorFoes.js` and `enemyMotor.js` cannot see the switch. **Pinned** (`AUDIT 55: the switch's reach`) |
| 2 | The townsperson's ground against the terrain's: `world.js` hands `groundY: () => locOrigin[1]`, a constant; `locOrigin[1] = avg * worldHeight + 0.05`; `heightAt` reads the same flattened `samples * worldHeight` | consistent by construction - persons stand on the plane `blendLocationTerrain` planes the rect to. The standalone exterior hands `collider.heightAt`. **clean** |
| 3 | Today's wind (WIND1, GR2) against the billboard batches persons render through | the wind reaches `tUCloudWind` and the grass instancing; no billboard shader or batch carries a wind term. **clean** |
| 4 | The EE ground revert rebuilt `renderer.js` from EE2 with EE5 and the automap replayed - anything else in that window would be silently gone | the ROAD-C flight-2 review's automap work (`uLight3Dir`, `WATER_MAP_COLOR`) is present; no billboard, flat, anchor or sprite change touched `renderer.js` in the window. **clean** |
| 5 | Every code line changed in `world.js` since the Wave E merge | grass only (GR2's walk, GR4's root colour, WIND1's slider). Nothing near persons, the floating-origin translation, or heights. **clean** |
| 6 | The bake's origin assumptions, after 4b-pre found one (the anchor at y=0) | `navmesh.js:114`'s "no bottom = solid from y=0" arena rule is dead for us: every triRaster box carries `bottom` (`triRaster.js:84`). The phantom ground is `minY - 10`, relative. `xmin`/`zmin` come from the input's extent. **clean**, with 4b-pre's fix pinned at 0, 25 and -40 |
| 7 | The extra opts (`nav`, `navWorld`, `navSeed`) handed to a CLASSIC `EnemyAI` when the switch is off | the base constructor destructures named keys; nothing leaks onto a classic foe. **clean** |
| 8 | Every classic flag the enhanced motor's own code reads or relies on | **F1** |

## The findings

**F1 - the nudge's fall probe was silenced by the stuck foe's own
obstacle flag.** `_fallCheck` returns "no fall" WITHOUT CASTING when
`obstacleDetected`, `foundUpwardSlope` or `foundDoor` is set
(`enemyMotor.js:938`). A foe the watchdog fires on is stuck against
something, so it has `obstacleDetected` set almost by definition - the
probe 4b-pre added answered false in exactly the case it was added
for. The nudge now clears the three classic flags for the probe and
restores them; the drop answer is taken before `fallDetected` is put
back to false. Pinned with the real `_fallCheck` under a spy, all three
flags set going in, all three restored coming out.

**F2 - the NPC report has no mechanism in the tree.** Sweeps 1-5. The
switch cannot reach a townsperson; the ground it stands on is the plane
its terrain is planed to; nothing that landed today moves a billboard
or a height. This audit cannot reproduce it and does not claim it is
not happening. What it can say: if it is happening, it is not Enhanced
AI, and it is not today's world.js. Two things would date it - whether
it reproduces with the switch off, and whether it is the streaming
`?world` host or the standalone exterior, which ground persons
differently (sweep 2). Left open, not closed.

## What this audit did not do

Nothing here ran in a browser or a real dungeon. Every sweep is a read
of the tree and every pin a node test. The arc's own note stands:
"nothing here has been seen in a real dungeon" is still true of every
line of AI 4 that a test cannot reach, and the two playtests so far
each found something the suite could not.
