# Performance

Performance is a standing priority (the owner): the game must hold its frame rate in crowded towns, with many players
and placed objects about, at long render range, and on first launch. This page holds how performance is measured, the
laws every change keeps, and the mechanisms that keep the boot, the world frame and the crowds cheap. The exterior's
render frame is `Performance-Exterior.md`; the characters' bodies are `Performance-Rig.md`.

## How it is measured

- **In the game:** `?perf` prints the GPU frame time and the lighting lane's counts (`src/render/perfMeter.js`);
  `?perf=zones` tiles the frame into passes; `?perf=cpu` splits the main thread into spans. A span closes at the next
  mark, so the span before the present includes the vsync wait. The FPS counter (`src/ui/fpsCounter.js`) shows draws,
  the view-out and shadow draws, the GPU's name, and what holds the frame rate when it is not the default.
- **Probes:** `tools/frameProbe.mjs` (the real game on SwiftShader, a scene a run) and `tools/frameAb.mjs` (two trees
  compared); `tools/onlineFrameProbe.mjs`; `tools/bootFreezeProbe.mjs` (the boot's long tasks); `tools/owHitchProbe.mjs`
  (the overworld); `tools/compileStallProbe.mjs`; `tools/realGpu/realGpuProbe.mjs` (shader compiles and uploads on a real
  driver). SwiftShader's milliseconds are relative; GL call counts are exact.
- `sh tools/fetch-data.sh` puts the freeware ARENA2 in place, so a measure is taken in the real game.

## Rules

- Measure first, in the real game where it can be run. A cost is found by a profile, not a guess.
- A change that moves the picture (a cull past the fog, a cap, a coarser step) is the owner's call. Every other change
  keeps the picture byte for byte.
- No allocation in a hot frame path: reuse arrays, fill in place, key by number rather than by a minted string.
- The world host's frame functions stay under V8's optimization ceiling, and under three quarters of it
  (`test/scenes/perfv8.test.js`); growth moves into helper modules (HOST-SPLIT).
- Everything drawn is culled to the view, every pool alike: yards, teams, wagons, peers, boats.
- A pass never waits on its own compile (below).
- Work that does not fit a frame takes a budget and resumes (the stream's breather, the snow's `budgetMs`, the grass rim).
- Far things run on a cadence the eye cannot tell from every frame.
- Settings are read once a search, never parsed per frame: `src/systems/pageQuery.js` `pageParam`.

## How it works

### Boot and compile

- **Programs start together, off the main thread.** Where the driver compiles in parallel
  (`KHR_parallel_shader_compile`), the boot starts every program play will meet while it works
  (`src/render/bootPrograms.js`, `src/render/warmPrograms.js`, `src/render/playPrograms.js`). The passes play meets are
  started one at a time, a wanted one moved to the front (`src/render/glProgram.js` `startProgramsInTurn`).
- **A pass never waits.** `compiledPass` builds a pass the first frame its program is done; a fault is that pass's alone,
  warned and not drawn. The clouds arrive when their programs are done (`src/render/cloudsArrival.js`). Auras use one
  program a look, so each compiles small.
- **First visit.** Answers whose inputs never change between launches (the Bay's fit on the Tamriel picture, port sites,
  ground tiles, ship builds, ship stand-ins, land pieces) are kept in the player's IndexedDB under a key naming the
  computation's pin and its inputs (`src/systems/firstVisit/firstVisitStore.js`), so a stale answer is never read.
- **Boot reads.** The network is asked beside the boot's work; a MAPS region's records are read where MAPS.BSA holds them
  (`src/formats/mapsFile.js`); the rect walks read each block once; the Bay's fit counts 32 cells a word
  (`src/world/tamriel/tamrielLand.js`); a town file's edits are laid on its own base (`src/formats/worldData/`).
- **Desktop store.** The installed app answers a storage read from memory (`app/lib/fileStorage.cjs`).

### Online and crowds

- **Peer range.** Past a distance the player chooses (`src/net/peer/peerRange.js` `PEER_RANGE_TIERS` 150, 300, 600 or
  all; default 300 m) another player is neither stepped nor drawn. **Players shown at once** can cap a crowd to the
  nearest 12 or 24 (`src/net/gate/gateCrowd.js`).
- **Others' things.** Another player's team, the road's teams and the town's wagons are culled
  (`src/scenes/horseCartPool.js`, `src/world/road/roadTeams.js` `WAGONS_DRAWN`); a standing team's harness rests; a
  far ship stands no hull, whether another player's or my own sea's (`src/scenes/naval/navalHost.js`).
- **Yards.** Others' yards are drawn as far as the player says (`src/net/yardRange.js` `YARD_DRAW_M` 300); a yard's
  models are merged into one mesh and its flats of one picture into one batch (`src/scenes/yardBlockMerge.js`); its
  pieces are culled as the town's models are.
- **Names** move by their transform, each value compared before it is written.
- **Horses and boats.** A 3D horse is posed only where it is seen (`src/world/horseView.js`); a far boat, my own
  included, lives on the far law every `FAR_LIFE_EVERY` (4) frames (`src/scenes/comeSailAway/farLife.js`); a far
  captain keeps her watch on the same cadence; a held boat is drawn from what her walk found. A horse's look is dyed a
  few pictures a frame.
- **The living world.** Its ways, trips, holy days and road plans give the same answers for less work
  (`src/systems/livingWorld/ways.js`, `trips.js`, `src/systems/holidays.js`); a roads' day not ready is asked once a tick.
- **The chat roster** is derived once, not once a frame (`src/net/roster.js`); the movable HUD sweeps on one clock.

### Placed objects, colliders and memory

- The shadow pass remembers a mesh's copies by place (`src/render/shadowPass.js`).
- A streamed pixel's collider buckets are filed by place; a boat's are asked only where she stands
  (`src/player/collider.js`).
- The cover index is typed columns, not sets (`src/ai/cover.js`).
- The trading windows draw only the rows on screen (`src/ui/virtualRows.js`).
- Every pixel, place, window and session lets go of what it held when it ends; a long-lived cache is measured before
  a bound is set on it.

### The overworld

Walking the overworld gives the same answers for less; the dry-ground answer is read only until it is certain
(`src/world/spawnedDungeons.js`); the snow's sweep and integration keep to the snow's frame budget
(`src/scenes/snowCoverHost.js`).

## Code and tests

- `src/render/perfMeter.js`, `src/ui/fpsCounter.js` - the readouts
- `src/render/glProgram.js`, `src/render/bootPrograms.js`, `src/render/playPrograms.js` - compile scheduling
- `src/systems/firstVisit/firstVisitStore.js` - kept answers
- `src/net/peer/peerRange.js`, `src/net/yardRange.js` - distance tiers
- `test/scenes/perfv8.test.js` - the frame functions under V8's ceiling
- `test/render/shaderstall.test.js`, `test/render/compilequeue.test.js`, `test/render/bootcompile.test.js`,
  `test/render/firstuse.test.js` - no pass waits on its compile
- `test/systems/peerrange.test.js`, `test/scenes/perfyard.test.js`, `test/scenes/yardmerge.test.js`,
  `test/systems/naval/navfarai.test.js`, `test/systems/firstVisit/fv_versions.test.js`, `test/systems/memaudit.test.js`,
  `test/ai/coverCompact.test.js`, `test/tooling/storecache.test.js`, `test/scenes/ow_wide.test.js`

## Open

These would move the picture, so they are the owner's:

- Pixels past the fog's end are still drawn wholly fogged; a cull there must read the live fog row and move the far
  ring's hole with it.
- Within the peer range there is no cap by default, so a large crowd is every one of its sprites unless the player
  picks a cap.
