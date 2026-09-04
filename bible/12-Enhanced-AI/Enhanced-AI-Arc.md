# Enhanced AI - the arc

Mac, 2026-09-02: "completely overhauling enemy AI using a custom navmesh
I built in my other repo project-final ... we need to be as exact as
possible and do this right. This will be called Enhanced AI and live in
the enhanced tab."

## The decisions, locked

1. **The classic motor is untouched.** `characters/enemyMotor.js` is a
   verbatim port of DFU's classic path and stays byte-for-byte. Enhanced
   AI never edits it; it replaces one step - how an enemy MOVES toward
   its target - behind a switch, and falls back to the classic step
   whenever it has no answer. Senses, decisions, attacks, sounds: classic.
2. **Off by default, in the Enhanced tab.** `uiPrefs.enhancedAI`, a row
   beside Enhanced environments. DFU's own EnhancedCombatAI is the
   precedent: the port's departure from 1:1 is opt-in.
3. **The navmesh is project-final's, ported whole.** `src/ai/navmesh.js`
   is Mac's file byte-identical from `// Agent params` to the end; the
   header differs only by the four-line `surfaceY` inlined verbatim from
   project-final's terrain.js and a linter global. A change is made in
   both repos and said in both. The ground needs no seam: buildNav's own
   `ground` = { at(x, z), min } is what Daggerfall's Collider.heightAt is.
4. **Triangles become his colliders, not his code.** Daggerfall's level
   is a triangle soup; his voxelizer stamps boxes and ramps.
   `src/ai/triRaster.js` turns triangles into one box per (cell, span) -
   the cell's footprint, the triangle's y-range within it, the top
   walkable only within the agent's slope - and lets his addSpan merge
   them. Recast-faithful: a vertex on a cell boundary spills into that
   cell, conservatively.

## ENHANCED AI 1 - the port, the voxelizer, the switch (2026-09-02)

Landed: the navmesh whole (pinned byte-identical), the voxelizer (a
floor walks, a wall stands, a ramp within slope walks and a steeper one
does not), a room of triangles baked end to end with a path bending
around a wall, the switch present and off.

**The first real finding, from his own code.** `buildPolyMesh` skips
hole contours - "arena has none; hole-merging into the outer loop is
future work." A wall that reaches a region's boundary bends a path; a
pillar standing FREE in a room is a hole and is not cut into the mesh,
so a path runs straight through it. project-final's arenas never had
free-standing obstacles. Every Daggerfall dungeon room has pillars.
Pinned as the known limit, and it is the next slice's first job.

**Two calling conventions, learned the hard way:** buildRegions is
ANCHORED - `{ anchor: { x, z } }`, the component holding the agents'
home survives and the rest is dropped, so a bake must always be told
where the enemies live; and findPath's points are `[x, y, z]` arrays.

## ENHANCED AI 2 - holes (2026-09-02)

Made in project-final first (9f5e323) and ported, the body still
byte-identical from the agent params on. Recast's mergeRegionHoles:
each hole, leftmost first, bridged to the nearest outer vertex by a
diagonal that crosses no edge of the outer or of any hole - the
ear-clip's own O'Rourke intersect, which is why it lives inside
buildPolyMesh's closure - the hole's vertices spliced in around the
bridge, walked twice, once each way; a hole that cannot be bridged is
left out as Recast leaves it. The pillar room: polys 9 -> 27, the path
two points through the pillar -> four around it. The pin walks every
segment, because a two-point path through an obstacle has no waypoint
inside it and that is exactly how AI 1's check was fooled.
project-final's god-file guard: raised 1041 -> 1075 on purpose, with
the reason in its own idiom.

## ENHANCED AI 3 - a level bakes from its own collider (2026-09-02)

`src/ai/navBake.js`, pure: the Collider's buckets hold every triangle
in world space - the ones the player collides with - and the bake
reads them back, so the nav's ground and the game's ground are one
source. An anchor is required, always. THE PHANTOM FLOOR: his buildNav
lays an implicit floor - y = 0 for arenas - and a dungeon has none; the
ground handed in sits ten metres below the lowest triangle, unreachable
from any real floor, and the anchored election drops it as an island.
Found on the way, in his file, fixed there first (8ba9100) and ported:
the height layer's surfH started at y = 0 and took only tops above it,
so a floor at -5 answered 0 - buildNav's ground-aware floor had never
reached the query. The nav now carries its ground to chf and surfH
falls back to it; arenas answer byte-identically. Pinned on a room at
y = -5 through the height query, with two mutants dead. The ARENA2-
gated Privateer's Hold pin is written and skips until the archives are
here; Mac chose not to upload them, so the first real bake is his to
see. Not yet: the worker, the cache, the dungeon host's call (3b).

## ENHANCED AI 3b - the worker, the cache, the host (2026-09-02)

`navWorker.js` bakes off the frame in navBake's exact order and posts
bakeNavData's compact form; the compact heightfield the motor queries
every tick lives on the main thread, because findPath is synchronous by
his design. `navClient.js` fingerprints the soup (tris, y-range, agent),
asks IndexedDB, else the worker, else bakes here (node), hydrates on
this thread by re-cutting the boxes deterministically at the baked cell
size, and PUTS THE GROUND BACK - his hydrateBakedNav rebuilds a
heightfield without one, its maps being arenas at zero; the dungeon's
constant floor rides the cache metadata, so a cached dungeon answers
the same heights as a fresh bake, with no third change to his file. The
dungeon host asks once, with the Enhanced tab's switch on, the moment
the player's feet are known - the feet are the anchor - and exposes
the bake on `api.enhancedNav` for the motor.

## The slices ahead
- **ENHANCED AI 4b - doors and the crowd.** Action doors as obstacles;
  other foes via syncNavObstacles and his RVO avoidHeading.
- **ENHANCED AI 5 - exteriors and interiors.** The streamed world's
  pixel-local buckets and the terrain floor; RMB interiors.
- **ENHANCED AI 6 - the debug faces.** His navDebugFaces/pathDebugFaces
  through the port's renderer, behind the test room, so a bake can be
  LOOKED at.

Moving platforms and action-driven geometry: out of scope until 4 is
proven.

## A standing law, written after three audits were filed as 49 in one day

Audit numbers are taken by CREATING THE FILE, and `cat >` overwrites
without asking - which is how three lanes each filed an Audit 49 on
2026-09-02 and two of them silently overwrote a predecessor. Both are
recovered from history (52 the roads calibration, 53 the road-to-1:1
campaign; 49 stays with the grass audit that holds the file now). The
law: before filing an audit, `ls bible/01-Overview/Audit-*.md` and take
the next free number; never write an audit file that already exists.

## ENHANCED AI 4 - the motor reads the switch (2026-09-02)

`src/ai/enhancedMotor.js`: `EnhancedEnemyAI extends EnemyAI`. Decision
#1 to the letter - `enemyMotor.js` is byte-for-byte untouched, pinned.
The classic tick calls `this._getDestination` by dynamic dispatch and
everything below it keys off `this.destination` (the 5.625° gate, the
obstacle probe, the fall check, gravity, speed), so the subclass
answers one question differently: where is this foe walking to right
now. Its answer is the next corner of a `findPath` to the classic
destination's own target (`predictedTargetPos`); the classic answer
whenever there is no bake, no route, or the classic detour is running.

The follow laws are project-final's at 8ba9100 - enemyShared.js
`repathToward` and `stuckWatch` re-homed on `this`, enemyMelee.js
htClose's `WP_REACH` advance, main.js:236 `navWalkable`, enemy.js:402
`PATH_BUDGET_PER_FRAME` - constants and comments verbatim, pinned.
The host chooses the motor by the pref at both construction sites,
hands it the bake as a THUNK (a foe built before the bake lands is
classic until it does) and the host's one `navWorld`, and refills the
budget each frame (his enemy.js:404).

**Two adaptations, both forced by the port's shape, neither touching how
a route is chosen or held.** (1) His chase measures its stop against
the player and steers at the waypoint; the classic tick has ONE
destination doing both, and out of sight - the common case with a
route - it measures the stop against the destination. A corner inside
2.25 m would halt the foe at every corner. The corner is projected
along its own direction to stopDistance+0.05: the yaw gate reads
direction alone, so steering is byte-identical, and the stop cannot
fire on a corner; the goal is never projected, so the foe stops there
as classic stops at its LKP. (2) His nudge writes e.x/e.z; the port's
feet move only through the collider, so the nudge is his vector, his
side, his walkable gate, resolved by `collider.move`.

**Proven on a room, not a claim.** A real Collider room with a divider
and a gap at one end, baked by AI 3's own `bakeNavFromCollider`: the
enhanced motor goes round the gap and closes to melee; the classic
motor, driven through the same room as the control, is stopped by the
wall; an enhanced motor with no bake walks exactly where the classic
one walks.

**Found on the way.** V4's TDZ sweep caught the host's first draft
reading `enhancedNav` seven hundred lines before its declaration - the
lazy import block runs first - a real ReferenceError. The round-the-
wall pin passed alone and failed in the suite: the classic control's
detour hand came off `Math.random`; rolls pinned. Three pins were
wrong and were rewritten rather than loosened: the fail back-off tested
an off-map TARGET, but the goal is the foe's belief and it correctly
paths to where it last saw you; the watchdog pin ran out of steps while
the foe was still turning in place; the fault pin used a mesh-less chf,
which `findPath` answers with null - that is never-traps working - and
needed a Proxy that throws.

Pins: 14 in `test/enhancedAI4.test.js`. Campaign: 20 mutants, 20
killed against a green baseline; two survived the first pass (a stale
route steering one tick after the bake vanished; a route surviving
non-pursuit) and are pinned.

**Not in this slice, stated:** doors as obstacles through the action
system; other foes via `syncNavObstacles` and his RVO `avoidHeading`;
cityGuards and exteriorFoes (AI 5). Nothing here has been seen in a
real dungeon - the ARENA2-gated Privateer's Hold bake is still Mac's
to run.

### ENHANCED AI 4a - the floating billboards (2026-09-02, Mac's report)

Mac, with the switch on: "the enemies dont move attack or anything.
They just animate above the ground."

`buildFoeAt` runs in `buildDungeonContext`'s top-level flow at :861 and
reads `enhancedNav.world` AT CONSTRUCTION - not through a thunk - while
AI 4's first cut declared `enhancedNav` at :1289. Every foe hit the
temporal dead zone inside `buildFoeAt`'s own per-foe try, which is
built to skip a bad foe and keep the dungeon: no motor, so no gravity,
no landing, no pursuit, no attack - a floating billboard, animating,
exactly as reported. V4's sweep had caught the SAME class of bug one
line earlier (the `??=` at :572) and I fixed that one by moving the
declaration DOWN - past the mint - which is how the second one was
made. V4 did not catch it because the read sits inside a function it
cannot date.

The declaration is beside `foes` now, above every mint; the world is
made in the lazy block. Pinned by ORDER in the source - the only pin
available, since no node test can run this host without ARENA2. Which
is also the honest gap: AI 4 shipped with "nothing here has been seen
in a real dungeon", and the first thing seeing it found was this.

### ENHANCED AI 4b-pre: the bake was not height-invariant (2026-09-03, Mac's playtest)

Mac: foes that disappear, foes that clump, one in a ceiling (that last
with the switch off too - not this arc's).

Chasing the disappearance found a bake defect that outranks it.
`buildRegions` elects the kept component by the span NEAREST THE
ANCHOR'S HEIGHT - his FOUNDRY S3 rule, "an abyss floor 22m down is the
column's first span" - and defaults the anchor's y to 0 when none is
given. AI 3 passed `{ x, z }` at all three bake sites. Every bake was
anchored at y = 0. Our rooms were at 0, so the real floor won by
accident; a room at y = 25 elected the PHANTOM ground (minY - 10 = 15,
nearer to 0 than 25), culled every real floor - the walls' included, so
the walls read as walkable - and the route ran straight through the
divider. Real dungeons are not at 0. `regionAnchor` builds the anchor
with its y at all three sites and a pin reads all three; a room at 0,
25 and -40 now bakes the same mesh and the same corners.

Two more, and the disappearance is most likely the first: the live chf
is hydrated without colliders (3b, by design), so `findPath` has no
surface to sample and every waypoint sat at y = 0; a flyer moves along
`_dir3(destination)` and never comes inside stopDistance of a point
ten metres above or below it. The route supplies x and z now; a
corner's y is the foe's own and the goal's is the predicted target's -
the y classic's destination carries. And the stuck nudge asks classic's
`_fallCheck` on its own heading before it moves; a nudge that skipped
it could side-step a foe off a ledge the nav's cells never saw.

Clumping is expected until 4b: every foe now solves the same optimal
route, and nothing pushes them apart. That is his `separation` and RVO
`avoidHeading`, next.

### Reverted, then re-landed (2026-09-03 / 2026-09-04)

Mac reverted the arc whole on 2026-09-03 (e409bfda, beside the 3D
trees' revert), and asked for it back on 2026-09-04: "can we
reintegrate the enhanced AI we also reverted." The re-landing is the
revert reverted onto the Wave F / AUDIT 58 tree - nothing rewritten.
What that tree had moved underneath it: the dungeon host, the
Enhanced tab and the pref all merged clean by git's own three-way;
`enemyMotor.js` had not changed a byte since AUDIT 55, so decision #1's
pin still holds as written; both suites pass unchanged (27 pins, the
one ARENA2-gated Privateer's Hold bake still skipping). AUDIT 55's F1
(the nudge's fall probe) comes back inside the motor, since the revert
had removed it with the motor. The switch is where it was: OFF by
default, in the Enhanced tab, the classic motor the 1:1 law. Nothing
here was seen in a real dungeon on the way back either - the
container has no ARENA2 - so 4b-pre's own last line still stands: the
first playtest is Mac's, with the switch on and then off.
