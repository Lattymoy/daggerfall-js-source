# AUDIT 59 - ENHANCED AI, BEFORE THE MERGE (2026-09-04)

Mac: "Lets do a comprehensive audit on enhanced AI before we merge."

## Why this shape

The arc (ENHANCED AI 1-4b-pre, `12-Enhanced-AI/Enhanced-AI-Arc.md`)
was reverted whole on 2026-09-03 and came back on 2026-09-04 by
reverting the revert onto the Wave F / AUDIT 58 tree. Its two suites
were green before and after, and AUDIT 55 had already swept the
switch's reach and the arc's new seams for the two fault shapes its
own history produced. So this audit does the thing neither the suites
nor AUDIT 55 could: it reads the arc against the PRODUCTION BUILD and
against today's host lifecycle, and it measures the costs the arc's
notes describe in words. Nine sweeps. Four findings, all fixed here,
each pinned in `test/audit59_enhancedai.test.js`. Two flags recorded
with numbers, not fixed. Nothing here ran in a real dungeon: the
container has no ARENA2, so the sweeps are reads, node runs on
synthetic levels, and one look at `dist/` after `vite build`.

## The sweeps

| # | Sweep | Result |
|---|---|---|
| 1 | The built bundle: does `dist/assets` carry a nav worker chunk? | **NO.** Only `terrainGenWorker-*.js`. `navClient.js` spelled the worker `new WorkerCtor(new URL(...))`, and Vite bundles a module worker only from the literal `new Worker(new URL('./x.js', import.meta.url), { type: 'module' })` - the rule `terrainGenClient.js:10` records and `terrainworker.test.js:258` pins for the terrain worker. **F1** |
| 2 | The host lifecycle: `buildDungeonContext` is built per entry (`worldModes.js:4417` / `:6828` destroy) and `enhancedNav` with it - so a second dungeon never reads the first's bake. But `destroy()` never touched `enhancedNav.client`. | **F2** |
| 3 | The Enhanced tab's row against what ships. | "(Landing slice by slice; not yet driving the motor.)" two slices after AI 4 made it drive; "each dungeon, town and interior" for an arc that bakes dungeons only. **F3** |
| 4 | Adaptation 3's premise (`enhancedMotor.js`): "the port's live chf never has colliders, so every waypoint sat at y = 0". `hydrateHere` re-cuts the boxes and hands them to `hydrateBakedNav`; the 3b pin reads the hydrated FLOOR through them and asserts the path's last point sits on it. | The premise was wrong; the LAW it produced (a corner takes the foe's y, the goal the goal's) is right for a better reason - surfH answers the phantom floor wherever no box top exists. Comment corrected, law pinned directly. **F4** |
| 5 | The TDZ that floated every foe (4a): is `enhancedNav` still declared above every mint on today's host? | `:549` declares, `:756` and `:833` mint, both inside `buildFoeAt`; the world is made at `:613` in the lazy block. **clean** |
| 6 | Every foe construction site in src against the switch. | The two dungeon sites read the pref; `cityGuards.js:208` and `exteriorFoes.js:161` construct classic `EnemyAI` unconditionally - the exterior hosts are slice 5, recorded on the arc page, not a defect. **clean** |
| 7 | The pause and paralysis paths through the enhanced step. | `_stuckWatch` runs only when `this.moving`, which `_classicTick` (`:1276`) and `_step` (`:1492`) clear on pause and paralysis, so the nudge cannot creep a frozen foe; `_repathToward` still decrements its timer and may spend budget while paused - wasted, harmless. **clean** |
| 8 | The three bake sites (`navBake`, `navClient.bakeHere`, `navWorker`) for a drift in coarsening: `bakeHere` calls `coarsenAgent(cols, agent)` with no budget/target where the other two pass 250000/80000. | `coarsenAgent`'s own defaults (`navmesh.js:54`) are 250000/80000 - identical. **clean** |
| 9 | The switch mid-dungeon. | The bake request is re-read every frame (`!enhancedNav.requested && getPref(...)`), so turning it ON mid-dungeon bakes then; foes already minted keep the motor they were born with until re-entry. Consistent, now SAID on the row (F3). **clean** |

## The findings

**F1 - the worker never shipped; every real bake froze the main
thread.** Sweep 1. In production the worker URL 404'd, `onerror`
rejected the pending bake, the `.catch(() => null)` answered null, and
`bakeHere` ran synchronously on the frame. Measured in node on
synthetic multi-room levels (rooms with pillars, doorways, stepped
floors and ramped corridors): 1.1 s at 2.2k triangles, 3.0 s at 10k,
6.9 s at 31k (coarsened to cs 0.47). That is the freeze on dungeon
entry with the switch on - the first thing a player would have met.
Fixed: the real worker is spelled the literal way; a test double still
comes in through `WorkerCtor` with a plain path, so exactly one
`new URL('./navWorker.js', import.meta.url)` exists for the bundler.
`dist/assets` now carries `navWorker-*.js`. Pinned on the spelling,
its count, and a double built through the override.

**F2 - the nav worker was never terminated.** Sweep 2. Each dungeon
entry made a `new NavClient()` and `destroy()` never disposed it, so
once F1 let a worker exist every visit would have left one running.
Fixed: `destroy()` disposes the client and drops the handle, right
after NT1's dead latch. A bake in flight resolves onto a dead
context's `chf` that nothing reads. Pinned on order and on the single
construction site.

**F3 - the row lied twice.** Sweep 3. It now says: dungeons, the
motor live, towns/interiors/doors still to come, bunching until the
crowd slice, effect on the next dungeon entered, Off = the 1:1 motor.
Pinned on the joined string.

**F4 - the adaptation's premise.** Sweep 4. Comment corrected; the law
pinned directly on a route whose y is the phantom floor and then
nonsense: a corner answers the foe's y, the goal the predicted
target's.

## Flags, measured and left

- **The hydrate's re-cut on the main thread.** Even with the worker,
  `hydrateHere` re-rasterises the whole soup on the main thread to hand
  `hydrateBakedNav` a collider list: 0.19 s at 2.2k triangles, 0.68 s
  at 10k, 0.33 s at 31k (coarser cells). After F4 the motor never reads
  the heights those colliders produce; `navWalkable` reads the hydrated
  walkmask. An empty collider list would make the hydrate near-free -
  but the 3b pin reads the hydrated floor through `polyHeight`, and
  his `findPath` samples `surfH` at the path's ends, so that is a
  change to make with the pin and the arc page, not inside an audit.
- **Doors are baked closed.** Action doors are their own collider
  buckets and the bake reads every bucket, so a room behind a door is
  unreachable on the mesh until 4b: `findPath` answers null, the foe
  backs off `REPATH_FAIL` and walks classic. Degrades, never traps;
  the arc page already names 4b as the next slice.

## What this audit did not do

Nothing ran in a browser against a real dungeon. The worker fix is
proven by the bundle and by a double, not by a bake in Chromium; the
freeze numbers are node's on synthetic levels, and a capital's
dungeon may be larger. The first real bake, with the switch on and the
console open (`[enhanced-ai] navmesh: N polys, cs C, Nms`), is Mac's.
