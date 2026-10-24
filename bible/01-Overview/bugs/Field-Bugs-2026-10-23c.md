# FIELD BUGS 2026-10-23c - a spell cast at the ground outdoors flies through it

One report, from the owner: "spells cast at the ground outdoors don't collide with it at all and sail straight
through". Read on main's `b0765ab21`; audited the same day (AUDIT GROUND-BOLT, at the foot). The pins are
`test/scenes/groundbolt.test.js` (and the moved ones named below), the mutants `tools/mutants/groundbolt.json` (29, all
dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "spells cast at the ground outdoors don't collide with it at all and sail straight through" | The streamed world and the fixed city handed the cast engine a collider proxy that carried `raycast` alone, and a missile's flight asked that ray alone. That ray walks the collider's MESHES; outdoors the ground is not a mesh but the host's `heightAt` sampler (`player/collider.js` surfaceHit's own note, MAC-BUG W5). A bolt met a building and never the ground: a Fireball at the grass went under it and on until its lifespan ran out, its blast never thrown. A foe's missile the same | GROUND-BOLT |

## GROUND-BOLT (1) - `src/scenes/hostMagic.js`, `src/scenes/world.js`, `src/scenes/exterior.js`

DFU: DaggerfallMissile.cs:337-339 casts the missile's displacement into the scene's physics, and a Unity terrain has
its own TerrainCollider - DFU's missiles meet the ground, so this is no departure and no Ledger row is owed.

THE CHANGE (as the audit left it):

- The flight's stop is `flightStop` (`hostMagic.js:"export function flightStop(collider, pos, unit, reach, stepLen) {"`),
  the one law of both flights (this engine's and `dungeonContext.js`'s): the mesh ray at the step's whole reach, cover
  (TACT1) by touch, and the terrain by touch - `groundHit`, AUDIT TECH1's march (`player/groundRay.js`, a leaf since
  the audit: the techniques, the engine and a foe's shot ask the one march). It meets a rise as well as a fall, so a
  level bolt into a hillside stops on it (the collider's `surfaceHit` meets the ground on the way down alone).
- `liveCollider` (`hostMagic.js:"export function liveCollider(live) {"`) is the collider a host hands the engine:
  whichever of its colliders the player stands in, asked at each call, whole - its mesh ray and what that ray struck,
  its ground (`heightAt`, `surfaceAt`, `surfaceHit`, `groundNormal`) and its cover. Both exterior hosts hand it in place
  of the bare proxy, one entry for one entry (THE HOSTS DO NOT GROW).
- What else reads the ground: an impact's chunks land on the ground under it (`impactGround`), and its shockwave lies on
  what it struck, a hillside's slope included (`struckSurface`); a Resurrect aimed at the grass beside a fallen mate
  finds the body; a burst does not reach over a crest (`burstClear`); a spell given to a mate or a companion is not
  given across a hill; and a foe behind a ridge finds no clear shot (`enemyMotor.js` hasClearPathToShootProjectile). A
  sky fireball (SUNBABY2) is met by my ground too; its count still lands it where the throw said, where no ground is
  streamed under it.

THE FOUR HOSTS: `world.js` and `exterior.js` wired. `worldModes.js` (interiors) casts through the world's engine, whose
collider follows the door to `interiorCollider` - a room has no ground sampler (`-Infinity`), so the flight's terrain
never moves there; what does is the room's meshes and cover now reaching the engine whole (an impact's floor and plane
are the room's meshes', as the dungeon's engine already had them, and a bolt meets the room's cover). `dungeonContext.js`
builds its engine on its own Collider: no ground sampler underground, its flight `flightStop` now (the same law, the
meshes and cover alone there).

## AUDIT GROUND-BOLT (2026-10-23) - the slice, read cold

The owner: "Audit this". Five lanes, each a cold reader of the frozen snapshot (`dbb684e51`) in its own worktree - the
repository untouched while they read (DO NOT FIX WHILE THE VERIFIER IS READING) - each told to prove a finding by a repro
over the real code before reporting it: A where the ground is (the world's samplers, the sea, decks, the spaces the world
host builds, the modes), B the cast engine's behaviour (every reader of its collider, every missile arm, the cost), C the
report's reach and the four hosts (everything else that flies or aims across open ground), D the record, the pins and
the process, R the real game (the streamed world in Chromium on the freeware ARENA2, the snapshot against the base
`b0765ab21`). Every finding was reproduced by its lane's own script before it was acted on; every fix is pinned, each
pin failing on the code before it (`tools/mutants/groundbolt.json`, 29, all dead).

R's twelve casts in the real world: every stop on the drawn ground (`|y - surfaceAt| < 1e-3` - a town street, the street
before the city wall, a hillside of grade 0.43 struck level, a high place, the seafloor), every miss its full lifespan,
no invisible ground; on the base the same casts ended 16 to 56 m under the street and 31 to 40 m inside the hill. The
slice answers the report. After the fixes, lane B's real-terrain probe (Fireballs at 72 headings and 4 pitches, three map
pixels, 864 in all): a floor handed 1 m or more under the ground 0 of 864 (288 of 288 at each pixel before), no plane
0 of 864 (19 and 25 of 288 at the hilly pixels before).

| # | Sev | Finding | Disposition |
|---|---|---|---|
| A1 | should-fix | A burst on the terrain stands at the first point the march found not above it, a hair under the ground, where `surfaceHit`'s way down never starts: every ground impact threw its chunks and its burst's floor 1.2 m into the ground (= B2, R1) | FIXED: `impactGround` answers the sampler; pinned (the finder, and the engine's chunks at rest) |
| A2 | nit | The fixed city's ground is a constant everywhere - past its drawn quad a spell bursts on an undrawn plane | NAMED: the bench (`?exterior`, `?region&loc`), whose capsule stands on the same constant; no player plays it |
| A3 | note | A missile in flight when the player takes a door flies on in the other collider | NAMED: the meshes swapped the same way before the slice; not its regression |
| B1 | should-fix | The ground at the step's whole reach (step + 0.45) met the grass behind a foe's feet a step early: 14 of 40 bolts aimed at the feet struck at 20 frames a second (= A4) | FIXED: the terrain met by touch, as cover is (AUDIT TACT B5), `flightStop`; pinned (40 of 40 at 20 and 30 frames, a foe's bolt at me no worse than with no ground at all) |
| B3 | nit, doc | The shockwave's plane: `surfaceHit` meets the ground on the way down alone, laid flat - a level bolt into a hill, a shallow one onto a grade, found none (R1's buried rings) | FIXED: `struckSurface`, the meshes and the terrain marched, its slope; pinned, the engine's own burst too |
| B4 | note | Foes see and hear through a hill (`canSeeTarget`, `canHearTarget` ask the mesh ray); their bolts now stop on it (= C1's senses) | NAMED (Found on the way): the shot is fixed (C1); a 102 m sight ray marched at every look is a cost and a change to how every foe outdoors notices - the owner's call |
| B5 | note | `rayHit` swallows the mesh ray's exceptions, so a broken collider let the flight go silently through everything | FIXED by B1's law: the flight asks `collider.raycast` itself again |
| B6 | note | A Fireball at one's own feet outdoors now hurts its caster (it did underground already) | Patch notes, at the pull request |
| B7 | note | A hole in the sampler at the crossing lets a missile under the ground | NAMED: the pixels about the player are built; not reached |
| C1 | should-fix | A foe behind a ridge found a clear shot through it, and spent the spell on the hill | FIXED: `hasClearPathToShootProjectile` marches the ground (DFU's sweep meets the TerrainCollider); pinned |
| C2 | should-fix | A spell given to a mate or a companion crossed a hill the same spell's missile now stops on | FIXED: both picks ask the ground, a body's breadth of grace at the feet; pinned |
| C3 | should-fix | Resurrect's aim never met the open ground (RESURRECT2's "aim at the ground beside the body") | FIXED: `rayHit`; pinned |
| C4 | nit | A burst reached over the crest of a hill (`burstClear`) | FIXED: `rayHit`; pinned; set3's two mutants re-aimed (dead) |
| C5 | doc | The record's cover gap named the two exterior hosts; buildings had it too | FIXED with D5 |
| C6 | nit | The dungeon's flight a second copy of the law the slice changed | FIXED: both flights take `flightStop`; pinned |
| D1 | tests | `liveCollider`'s mesh ray unpinned (a blind ray survived 42 files) | FIXED: walls pinned through the proxy and the engine |
| D2 | tests | The drawn ground (`surfaceAt`) never exercised | FIXED: the proxy mirrors the Collider's own members; pinned on a sampler and a drawn ground that differ |
| D3 | tests | SUNBABY2's pin built the old proxy | FIXED: retitled, and a world-shaped case where the thrower's ground and mine part |
| D4 | tests | The moved regexes accepted either ray in either file | FIXED: one law per file (`flightStop`), its body pinned |
| D5 | should-fix | Cover: the owner's word is on record (`12-Enhanced-AI/Tactics-Arc.md`: "stop arrows and spells", "Mac's call: sight and missiles"), and the arc claimed the hosts' bolts read it | FIXED: `liveCollider` hands the cover; pinned; the arc says since when |
| D6 | doc | "Nothing moves there" (interiors) was false: the room's meshes reach the impact now | FIXED in the record |
| D7 | nit | The test's comment numbers | FIXED |
| D8 | note | hostceiling red on main (createWorldModes) and the branch conflicting with main | Main raised the ceiling (`c7084e792`); main merged; patch notes owed at the pull request |
| R2 | doc | Water is not a surface: with Iliac Puddle (the default) a spell dives through the sea and bursts on its floor, where DFU's ocean is terrain at the water's height | NAMED for the owner: the mod's water has no collider, and the swimmer's capsule meets the same floor; before the slice the missile went through that floor too |
| R3 | note | 404s for `BOK00112.TXT` and `BOK00113.TXT` on both trees | Not the slice: the freeware data lacks them |
| R4 | note | No indoor cast in the real game (the harness's door left the camera on the street) | Not checked there; the pins cover the room |
| F1 | should-fix | Found fixing A1: `landFx`'s own floor still called the removed `groundUnder` - a ReferenceError inside its try, so a landing handed no floor (a self heal, a touch, a peer's) drew nothing (`npm run lint` found it; REZ-BLOODLINE's run failed on it) | FIXED; pinned |

Found on the way: AUDIT GRAVE-PARTY G5 (`test/systems/fb1016b_graveparty.test.js`) failed once in the 975-file run under
the real-game lane's load. Its file failed one test on `b0765ab21` too while that lane ran (which one, unrecorded), and
passes alone three times of three on both trees once the load was gone - a failure of load, not of the slice.

THE RUNS: every test file that names or imports a module the audit touched - 975 files, 10,710 tests - green but for
the three above (the ceiling, merged away; G5; REZ-BLOODLINE, F1's). The moved mutants: tact1's TACT1-bolt-through and
TACT1-shot-blind, set3's two, and tech1's three on the march (moved with it to `player/groundRay.js`) - all dead.
