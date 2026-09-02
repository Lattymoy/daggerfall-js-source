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
 Feed the Collider's buckets
  through triRaster at load, in a worker, anchored at the player's
  entry; cache with bakeNavData in IndexedDB keyed on the location. The
  budget/coarsen rule sizes the cells (a twenty-block dungeon is ~800k
  columns at 0.25 m; expect ~0.5 m). First ARENA2-gated pin: Privateer's
  Hold, path queries between known rooms.
- **ENHANCED AI 4 - the motor reads the switch.** In TakeAction's
  pursuit: findPath to the target, follow waypoints, repath on his
  cadence with his per-frame budget and stuck watchdog; classic
  steering when there is no path (never-traps). Doors as obstacles via
  the action system; other enemies via syncNavObstacles and RVO.
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
