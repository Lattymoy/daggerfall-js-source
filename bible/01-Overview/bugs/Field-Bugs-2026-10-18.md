# FIELD BUGS 2026-10-18 - twelve threads from the bug-reports channel, each read to its root

Twelve threads from the Discord's #bug-reports, handed over as screenshots with "No band aid fixes". FOUR ARE RECORDED
HERE; the other eight are not yet - the first pass's work on two of them never reached the branch, and their
screenshots are not in the tree (AUDIT FB1018 (`01-Overview/audits/Audit-Field-Bugs-2026-10-18.md`), L4-9). Read on the code as it stands at main's `d5732cf97` (merged
forward to `cd2705d92`). Each was traced on the real modules first, and a fix lands only where the cause is proven;
where it is not, the record says so and what would prove it. The pins are `fb1018_*`, the mutants
`tools/mutants/fb1018_*.json`. AUDIT FB1018 (`01-Overview/audits/Audit-Field-Bugs-2026-10-18.md`) read all of it cold; what it changed is marked here and in the code.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Nauya, "Companions and Open Wagon": "when they dismount from the wagon, they just drop down inside of it, and they get stuck in your wagon unable to help you or move out of it ... the temporary fix is to just respawn your wagon every single time you run into an encounter" | The companions' seat was read by the motor alone, so a seat that went (the wagon parked) left the body where it sat, and it fell through the bed. The parked box, kept from closing round the player's capsule only, then stood round it. Its two-sided faces push no body out | fixed (WAGON-ALIGHT) |
| 2 | MADMAN0037, "Performance tank in specific area": "The Mouse and Fawn tavern in Sentinel, graphics settings preset ultra, Gpu fans turn into jet turbines" - the counter: 198 fps, 5.1 ms, "draws 67 binds 77", an RTX 5070 at 2560x1391 | The counter counted the room's own pass alone. The view out through the windows (the street, drawn before the room's frame) and the shadow maps' replays were nowhere on it, and nothing said what held 198 fps. VSync is on by default on the desktop, and the frame is GPU-bound. Which pass costs it is not proven | counted (PASS-COUNT); the cost itself open, below |
| 3 | Anon-e-moose, "Gradual FPS loss then crash": "When in interior cells, and especially in combat, the FPS gradually slows down over 5 mins or so, until it eventually freezes and either never recovers or actually hard crashes" (a video: a dungeon, a Skeletal Warrior, the screen red with damage) | Not proven. Five simulated minutes of the real renderer over a recording GL, the real hit effects and blood, and the real foe motor, attack and tactics against the player all stayed flat. No game data in the container to run the real scene. Two real leaks were found on the way, neither enough alone | two leaks fixed (LOOT-FLATS, HUD-HEAD) and a splash in the wrong pool (PVP-BLOOD); the cause open, below |
| 4 | Phayezorix, "DFO Client Travel Map": "the travel map being laggy as hell ... removed all mods ... The only thing that 'worked' was completely re-installing DFO + adding mods back. After a few hours (maybe 3-4hrs) the travel map just lags again ... Browser does NOT have the travel map issue" | Not found. The desktop client serves the same files the browser does (`app/main.cjs` handleDagger, one `fileResponse`, every channel file sha256-checked). A reinstall clears only `<userData>/Game`, never the saves or prefs. The map's reads are cached in memory | open: what would find it, below |

## WAGON-ALIGHT: the companions get down as a rider does

`src/systems/wagon/wagonSeats.js` (getDownPoint, GET_DOWN_STEP and GET_DOWN_REACH, moved into the law),
`src/scenes/wagon/wagonRiders.js` (the player's getting down calls it), `src/scenes/crewAshore.js` (getDown, capsules),
`src/scenes/horseCartPool.js` (capsuleInBox over `bodyCapsules`), `src/scenes/world.js` (one dep line).

FOUND. Reproduced end to end in Node on Mac's Open Wagon bake, the real collider, the cart runtime, the seats
(wagonRiders.js companionSeat), the companion layer and the foe motor. Two companions seated while the wagon trailed,
then parked with the player six metres off: both stood inside the box thirty seconds later, the player's own
get-down point clear of it for every seat. Two defects together:

- **The step down never happened.** The streaming host's `wagonCarriesCompanions` (now the pool's own question,
  `horseCartPool.js:"function carriesCompanions() {"`, moved there to keep `bootWorld` under its ceiling) is true only
  while the wagon trails or follows. Parked, `companionSeats` answers -1, so the seat handle answers null. The only reader of the
  seat is the motor (`enemyMotor.js:"const seat = this.seat?.();"`). With a seat it pins the feet, without one it goes
  on from where the feet are: the seat in the bed. Wagons.md promised "they step down and walk at heel", and nothing
  took the step. A player rider is stepped out (`wagonRiders.js` getDown, GET_DOWN_STEP over the side).
- **The box law was the player's alone.** `horseCartPool.js:"standWagonCollider(parked && !capsuleInBox(parked, myParts)"`
  read `playerCapsule` only (WAGONS3's spawn trap, written for one body - THE ONE CONSTRUCTION SEAM). The catch-up
  fires past CATCH_UP_M (40 m), so a boxed companion was held exactly while the player stayed near: during the fight.
  Respawning the wagon freed it because `standBox` takes the box down and stands it at the new pose.

Every path that empties a seat reaches the same frame: the player getting down (Trailing to Deployed), a following
team told to wait, a horse lost (through `commitDeployment`, or set Deployed directly where no following pose is
live: `horseCart.js:"else { wagonState.Mode = WAGON_MODE.Deployed; wagonState.HorseMode = HORSE_MODE.None;"`), a
player given a companion's seat on the road (pinned by the audit, L1-4: the last companion gets down beside the wagon
still moving), the wagon dismissed. A door, a fast travel or a load changes the place's key and lifts the bodies, so none of those
leave one in a bed.

FIXED.
- **One get-down point.** `getDownPoint(seat)` in the law: GET_DOWN_STEP behind the seat's yaw. The player's getting
  down and the companion layer's both call it, and nothing else in `src/` works the step out
  (`test/scenes/fb1018_wagonalight.test.js` sweeps for a second copy).
- **The companion layer takes the step.** Each frame `crewAshore.js` keeps the seat a body sits in (`s.sat`). The
  frame its seat goes, the body is stood at that seat's get-down point. The step is swept from the seat by the
  place's `spot`, so it never lands in a wall, and the motor is stood afresh there (resumeLive). A body further than
  GET_DOWN_REACH from its seat was moved by something else and stays where it is, the player's own guard.
- **The box law covers every body of mine.** capsuleInBox reads `bodyCapsules` beside `playerCapsule`, and the
  streaming host hands it both companion layers' capsules, the crew's hands and the sworn
  (`world.js:"bodyCapsules: () => [...crewAshore.capsules(), ...revenantAshore.capsules()],"`). That covers a
  companion getting down and one at heel where a summoned wagon is laid.

THE FOUR HOSTS: `world.js` wired. `exterior.js` stands no companion layer, so it has nothing to wire (its box reads my
capsule, as before). `worldModes.js` and `dungeonContext.js` draw no wagon. Our own feature, so no DFU member moves.

Why no test saw it: `test/scenes/wagons1_seats.test.js` asserted `companionSeat(0, false)` is null ("parked: they
walk") - the seat's answer, never where the body then stood, nor the box round it.

AUDIT FB1018, two edges RECORDED, not fixed: a recentre of the floating origin on the very frame the wagon parks
leaves a companion standing in the bed - the seat the layer kept is not moved with the world, so the reach guard reads
the body as moved by something else (L1-1; its fix wires the layer into the host's recentre, and `bootWorld` stands at
its ceiling). The box stays down round it and it walks out at heel. And a wagon summoned where a companion idles at
heel inside its footprint stands no box until that companion walks off it (L1-2): the wagon can be walked through
meanwhile, and nobody is held.

Pins: `test/scenes/fb1018_wagonalight.test.js` (7: the audit's three - the seat given on the road, the step swept by a
wall, who rides - and the reach on both axes and the host's two seat lines). Mutants:
`tools/mutants/fb1018_wagonalight.json` (12, all dead).

## PASS-COUNT: the counter counts the passes it missed

`src/render/renderer.js` (stats.viewDraws, stats.shadowDraws), `src/ui/fpsCounter.js` (drawsLine, paceLine).

FOUND.
- **VSync is on by default on the desktop.** `settingsDefaults.js` ships `"VSync": "True"`, and the shell adds
  `disable-gpu-vsync` and `disable-frame-rate-limit` only for a player who saved it off (`app/lib/frameRate.cjs`). The
  Frame Rate Cap is off by default, DFU's own. 198 is a GPU-bound frame (2.5 ms of script in 5.1), not the client
  running uncapped by default.
- **"draws 67" was the room's pass alone.** In a building, `worldModes.js` asks `viewOutFrame(...)` before the room's
  `renderer.beginFrame(...)`. Real Windows "Full" is the Features default and is in the High and Ultra presets. The
  view out's `renderer.outsideViewFrame` runs its own beginFrame and draws the street, and the room's beginFrame then
  zeroed `renderer.stats`. Its count, `_rwViewDraws`, was read only by `tools/realWindowsProbe.mjs` (the audit's
  L2-1: this record said nothing, and the fix zeroed it under the probe, which now reads `stats.viewDraws`). The
  shadow maps keep their own stats
  (`shadowPass.js`), and a tavern's lamps all cast (`renderer.everyLightCasts`).

FIXED. The room's beginFrame takes the view out's draws into `stats.viewDraws` (the view out's own nested begin takes
none), and the lane's shadow render writes `stats.shadowDraws`. The view out counts as it closes: the street since
its begin and the panes' depth drawn before it (AUDIT FB1018 L2-3: up to VIEW_PANES_MAX a redraw, zeroed by that
begin), and what went out before a throw (L2-4). The counter prints `view N  shadow M` on its draws line when a
figure's mean is at least half a draw a frame (L2-6), and a pace line when the pace is not the default: `vsync off`
where the shell lifted the display's wait, and the Frame Rate Cap's fps where one is set. At the defaults the counter
reads as before. Still on no line (L2-5): the shadow cache's copies (`stats.blits`), the bloom pass's own replays of
the glowing sub-meshes (its `emitDraws`), and the view out's binds (the room's begin zeroes them).

OPEN, for the owner. The street is redrawn whenever any view-matrix entry moves past VIEW_MOVE_EPS (1e-4), which is
every frame of mouse-look. From inside a city it draws every pixel's whole static batch the crop meets
(`world.js:"const drawOutsideStreet = (r, planes) => {"`), which in Sentinel is most of the city again - once a frame,
over the one rectangle all the glass covers, never once a pane (AUDIT FB1018 L2-6). Standing still it is redrawn every
VIEW_MAX_AGE_MS (250 ms), so `view` reads about a fiftieth of it at 198 fps, and the whole of it under mouse-look.
That this is the tavern's cost is suspected, not measured. The player's counter now says it: `view` read while
turning the mouse, then Real windows at Rooms only, then Enhanced lighting off, each against the `view` and `shadow`
figures. If the view out is the cost, the
levers move the picture (a redraw budget, or one wider picture per position sampled by direction) and are the
owner's to choose (`07-Rendering/Real-Windows.md`, PASS-COUNT).

Why no test saw it: `test/systems/perf3.test.js` drove the counter with the room's stats alone, and no test asked what
a frame with a view out counts.

Pins: `test/systems/fb1018_passcount.test.js` (3; AUDIT FB1018 L2-2: the renderer's pin executes the real Renderer
over a stub GL - it read its source back before, and the record's one equivalent mutant with it). Mutants:
`tools/mutants/fb1018_passcount.json` (18, all dead).

## Report 3: the slowdown in interiors - two leaks and a stray splash fixed, the cause open

NOT PROVEN. Measured in Node over five simulated minutes of a fight (scripts, not pins - and not committed, so these
figures cannot be re-run from the tree: AUDIT FB1018 L4-10):
- the real `Renderer` over `test/retroGl.mjs`'s recording GL, with hit splashes, a full ring of blood marks, six
  animating foe batches, the damage flash and the blood lens: live GL objects, `renderer.textures.size` and the GL calls
  per frame all flat, and the heap flat after a collection;
- the real hit effects and blood (`createHitEffects`, `createBloodMarks`): splash batches made equal those destroyed,
  each pool at its cap;
- the real foe motor, attack, tactics and blows (a Skeletal Warrior at the player for five minutes): its boards, blows
  and keys flat, and its cost per update falling.

The freeze and crash point at memory (a heap that thrashes, or GPU memory lost with the context) on a path that needs
the game's data to run: the online room's puppets, Physical Items' bodies, the Morrowind arm and bodies. What would
name it: the counter (now with PASS-COUNT's `view` and `shadow`), and three heap snapshots with `renderer.textures.size`
at 0, 2.5 and 5 minutes of the fight, from the player's machine (`?perf` prints the renderer's frame line).

**LOOT-FLATS** (`src/scenes/droppedLoot.js` freeBatch and remintBatch, `src/render/flatAnimation.js` rebind). Five of the
pool's nine frees of a pile's batch - both restores (every room left and every load) and the sweep of emptied piles -
destroyed it and left its entry in the flat animator, which ticked the dead batches of every animated pile the pool had
held for the rest of its life. A pile reminted where it now lies (a recentre, a moved ground) stood still, its entry on
the batch it replaced. A batch is now freed one way, out of the animator first, and a reminted batch takes over its
entry and its clock. Pins: `test/scenes/fb1018_lootflats.test.js` (3). Mutants: `tools/mutants/fb1018_lootflats.json`
(9, all dead; AUDIT FB1018 L3-1, L3-2, L4-4: the sweep's player pile, the dungeon's teardown now the pool's own free, a
removed pile, two piles reminting, a still one's frame).

**HUD-HEAD** (`src/ui/hud/hudLarge.js` swapHudHead). With Morrowind's data attached the large HUD's head is a picture of
its own (PORTRAIT3D), loaded again whenever the head's key moves - every helm put on or taken off - and the one it
replaced stayed on the GPU. Two loads in flight landed in the order they finished, so a slow one could put the helm
just taken off back on the bar. A head now goes up only while its key is the one the bar asks for, and the picture it
replaces - or a late answer's own - is released by its name. Pins: `test/ui/hud/fb1018_hudhead.test.js` (2). Mutants:
`tools/mutants/fb1018_hudhead.json` (6, all dead; AUDIT FB1018 L3-3: the bar's first head now carries the key it was loaded
for - read as the bar landed, a helm put on while it rendered was never asked for).

**PVP-BLOOD** (`src/scenes/world.js` duelHpIn, wildHpIn and wildFair), found in the first pass and left there, fixed in
the second, and corrected by AUDIT FB1018 (L3-5). A duel's blow of mine and the open zone's splashed into the street's
pool (`hitEffects`), whose frame is the exterior arm of the loop (`world.js:"// is the EXTERIOR arm of the cadence loop"`);
off the street the splash would sit frozen and undrawn and its mark go into the street's ring. Both now take the pool
I stand in (`worldModes.js:"liveHitEffects() {"`), as a peer's blow already did (PEERFX2). WHAT THE FIRST WRITING GOT
WRONG: neither could bleed off the street. A duel is outdoors only (`world.js:"if ((modes?.mode ?? 'exterior') !== 'exterior') return 'outdoors';"`),
and the open zone fights outdoors and in its dungeons (PVPDUNGEON) - where EVERY PEER WAS REFUSED: wildFair asked
whether the peer's pose stands in the zone, and in a dungeon a pose is the dungeon's own frame
(`world.js:"const nativeFrame = overworld || !!privateInteriorOf(key);"`), which the map reads as its corner pixel.
No blow, swing, shaft or spell landed between players in the zone's halls. Fixed: in a dungeon the place is the zone
(wildCan's `wildHere`, the door's pixel) and the room is that place's, so a room's peer is fair by the place
(`world.js:"return modes?.mode === 'dungeon' || wildAtWire(duelWorldOf(peerId));"`). Now the zone's halls fight, and
their blood is the dungeon's pool's; the duel's half keeps the one seam for a path that cannot run today. The only
splashes `world.js` still sends straight to the street's pool are on the street's own paths: a road traveller struck
down (refused off the exterior) and a horse's trample (asked in the exterior arm alone). Pins:
`test/scenes/fb1018_pvpblood.test.js` (3; source pins - bootWorld does not run in Node - and the corner pixel
executed). Mutants: `tools/mutants/fb1018_pvpblood.json` (4, all dead).

Found and left: a dungeon's targeting asks each armed foe for a fresh candidate list every classic tick (O(n²)
garbage at 16 Hz with many foes - a cost, not a leak, and not proven to be this report's cause). Its list is built in
`buildDungeonContext`, which does not grow (HOST-SPLIT), so a fix moves the list into a module of its own.

## Report 4: the desktop travel map - not found

The clues do not meet the code. What it rules out:
- **The client serves the browser's game.** The same files through one `fileResponse` (`app/main.cjs` handleDagger),
  a channel version's files checked by sha256 (`app/lib/gameChannel.cjs` decodeFile). The files are the same; the
  page is not quite (AUDIT FB1018 L4-7): under the shell it saves and keeps prefs through the shell's file store
  (`appStorage.js`), paces frames itself when VSync is off (`frameCap.js`), and reads the shell in `settings.js`,
  `pointerLock.js` and `dataSource.js`. A client-only cause is not ruled out by the files.
- **A reinstall cannot clear the player's data.** `main.cjs` pins `userData` to `Daggerfall JavaScript` under the
  app-data folder. Saves, prefs, IndexedDB and caches all live there, and the installer does not delete them. What a
  reinstall does reset is `<userData>/Game`, and only when it brings a new seed version (`app/lib/gameStore.cjs`: a new
  seed resets the channel's state and deletes every version folder; the same version's reinstall keeps `state.json`
  and the channel's version - AUDIT FB1018 L4-8). The installer's own copy then plays until the hourly check brings the next release, which
  would fit "fine for 3-4 hours". But a channel version runs the same code (above).
- **The map's per-frame reads are cached.** Waypoints, filters, masks and the static ink are held in memory, and the
  classic map releases its last textures. The desktop store answers a read from memory (STORE-CACHE). A rescan
  costs 0.65 ms at ten save slots and nothing calls one per frame. The lag stays with every filter off, so the marks'
  count is not it.

What would find it, from the player: their VSync and Frame Rate Cap settings (VSync off runs the page uncapped, near a
thousand frames a second, and the counter now says so), `%APPDATA%\Daggerfall JavaScript\Game\state.json`, whether
deleting that `Game` folder alone (no reinstall) clears it, and a performance trace while panning the map
(View > Toggle Developer Tools).

