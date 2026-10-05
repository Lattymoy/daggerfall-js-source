# PERF-UPD — "performance seems to be worse after some updates" (2026-09-29)

*Mac: "Can we look into increasing performance? I'm recieving reports after some updates, performance seems to be
worse and I want to be detailed in my approach to fix everything".*

The reports this answers, as the field pages recorded them: SCRIPT-SPLIT's two counters outdoors (09-26, script 107.5
and 203.6 ms), FIELD 2026-09-26c's "ship encounters you drop to 1 fps", Regi's "FPS are TANKING when my character loads
into the outdoors" (`01-Overview/Field-Bugs-2026-09-28e.md`, in frame 63.8 ms) and Skeptikali's dungeon at 99.9% CPU
(`01-Overview/Field-Bugs-2026-09-28f.md` DISC29-D). The updates they followed, by the merge that put each on `main`:

| merged | PR | what |
|---|---|---|
| 09-24 18:17 | #373 | Retro mode |
| 09-25 17:42 | #390 | the Sea Update's deep sea (Iliac Puddle No More, the fish, the sunken loot), Warm Ashes - Ships |
| 09-28 12:02 | #413 | Come Sail Away, There's a Hole in the Bottom of the Ocean |
| 09-28 12:39 | #419 | the Travel View (the Overworld) |
| 09-28 15:37 | #421 | Raiding Parties |
| 09-29 09:02 | #437 | Improved Interior Lighting (only with its `.dfmod` attached), texture mods |

## How the pass was run

The REAL game, measured - not a harness. Headless Chromium (the provisioned chromium-1194) on SwiftShader, over the
freeware ARENA2 (`sh tools/fetch-data.sh`, outside the tree), driven by probes in the session's scratch. Every scene is
the world host with the player standing (`?world&...&shot&play` - `?shot` alone turns the motor off, and with it every
system gated on walking), the settings a fresh profile's, 480x270.

- **Script time is measurable here, the frame rate is not.** SwiftShader draws a frame in about a second, so the frame
  rate is the software GPU's; the main thread's JavaScript is the game's, and it is what these numbers are. What the
  counter calls `before` is NOT the game's here: every JS callback outside the host's frame totals ~0.2 ms (the FPS
  counter, the draw watchdog, audio callbacks; the music pump is ~3.6 ms a SECOND), and the rest of `before` is the
  headless compositor's own readback (SCRIPT-SPLIT's audit names it).
- **Three instruments.** A CPU profile per scene (V8's sampler, 0.2 ms), attributed per function and per caller BY
  SAMPLE COUNT (samples x the median interval, ~0.28 ms): the sampler's own thread is starved while SwiftShader's
  raster threads hold every core, ~1,000 of a profile's intervals run past 1 ms (up to 1.2 s), and weighting by the
  interval hands each gap to whatever JavaScript was on the stack when sampling resumed - a torch's key check read
  0.14 ms a frame off ONE such sample. Counts give each function its share with a Poisson error. Then an
  exact CENSUS of every WebGL call, `URLSearchParams`, `localStorage` read and DOM creation a frame (counts are
  machine-free, so they are what the pins hold); and a sampled heap profile for the allocations a frame.
- **Two probe-only transforms, the tree untouched.** The stream's build slice (6 ms a frame) paces the BOOT at ~1 fps,
  so the probes serve `buildBreather.js` with a 250 ms slice - a settled scene streams nothing, so no measured frame
  changes. And the grass field fills 2 cells a frame by design: a ~3 s transient at 60 fps that at ~1 fps ran through
  every measurement window (it read as 1.2 ms a frame of grass in a town that was still filling - no evictions, no
  invalidations, no frees: 280 of 394 slots and 80 cells still wanted). The probes let it fill at once and wait for it.

## THE WINDOW, MEASURED - three trees, five scenes

The same probe over three worktrees: `40fbf5d8` (09-25 16:47, the last merge before the Sea Update), `f4dc60ce`
(09-28 19:38, after Come Sail Away, Ocean Holes, the Travel View and the raids) and `90fd9a0f` (main, 09-29). Scenes:
Knightstale in the rain (15:00), Bubumbaret on the coast (noon), a tavern in Knightstale (20:00), Privateer's Hold
standing, and Privateer's Hold walking (W held). Milliseconds a frame, by sample count: JS is the profile's
JavaScript, GC the collector, busy the main thread's whole time (native included); layouts are forced layouts a frame;
nodes are CDP's DOM count over ~2 minutes. A run's own spread is about +-0.4 ms (the standing and the walking dungeon
moved in opposite directions between 09-28 PM and `main`).

| scene | 09-25 pre-Sea | 09-28 PM | main |
|---|---|---|---|
| town, rain | JS 17.0, busy 21.2, 3.27 layouts, nodes 323 -> 709 | JS 14.0, busy 18.3, 3.63 layouts, nodes 1545 -> 2282 | JS 14.6, busy 17.9, 0.68 layouts, nodes 544 -> 574 |
| coast | JS 10.4, GC 1.7, busy 14.3 | JS 10.4, GC 0.6, busy 14.4, 3.39 layouts, nodes 874 -> 3837 | JS 10.5, GC 0.2, busy 12.8, nodes 535 -> 592 |
| tavern | JS 3.7, GC 1.8, busy 6.6 | JS 2.3, busy 3.3 | JS 2.1, GC 0.1, busy 3.1 |
| dungeon | JS 6.6, GC 1.4, busy 9.0 | JS 2.0, busy 2.7 | JS 2.3, busy 3.1 |
| dungeon, walking | JS 9.2, **busy 225.6** | JS 2.2, busy 3.6, nodes 1084 -> 5026 | JS 1.9, busy 2.6, nodes 1032 -> 1104 |

(The town's JS carries the music pump, ~3.6 ms a second on its own timer - a frame's share of it at ~1 fps.) Draws were
equal in every scene (718, 885-886, 45, 217-221).

**What the window's players met, and what is already gone.** Two regressions show, and `main` carries the fix for both:
- **The walking dungeon at 226 ms a frame** (09-25) is native time, not JavaScript and not layout (214 ms of
  `(program)`, 0.08 ms of layout), in stretches of up to 0.8 s that begin right after the frame's last GL work (the
  air pass's composite) - the main thread waiting on the GPU, the shape the mechanism below describes. Gone by 09-28
  PM; this pass did not bisect which slice took it away.
- **The DOM churn** (09-28 PM: 3.4-3.6 forced layouts a frame, the node count climbing to 3,837 on the coast and 5,026
  walking the dungeon): DISC29-D's watchdogs tearing the eight DOM faces down and building them again on every frame
  slower than their timers - the slow frame made slower. Fixed on `main` 09-29 (#418).

With those gone `main` is under 09-25 in every scene and within a run's spread of 09-28 PM, and nothing drawn changed
in count.

**The boot - "FPS are TANKING when my character loads into the outdoors".** The same trees, profiled from the
navigation to a settled stream (town and coast, the build slice widened as above). On 09-25 the main thread spent
**53 s (town) and 24 s (coast) in `decodePng`** - texture replacements decoded through a GPU-backed canvas, every
`getImageData` a readback - at ~95% of the main thread for about a minute AFTER the world first drew: exactly the
reported shape. FIELD 2026-09-27 fixed it (`willReadFrequently` on the decode canvas, `textureReplacement.js`); on
`main` the whole boot's main thread is ~16-18 s here, split evenly around the first frame. What is left is WAITS -
single GL or canvas calls that stall until the GPU process drains the boot's backlog - and they land after the first
frame: the enhanced HUD's first weapon icon (`toDataURL` of a 56x17 canvas: 3.0-4.7 s in one call, three runs), the
book fonts' atlas upload (2.1 s, town), and the synchronous compile checks of the spoils glow (built at every boot,
used only in the gate court) and of deep waters' six programs at the first sea frame (3.4 s together, coast). On
SwiftShader the backlog is the software GPU's; on a player's card the waits are far shorter but sit on the same
frames. Not changed here: an A/B of the icon canvases as `willReadFrequently` was inconclusive (the HUD's first icon
ask does not happen on every boot), so it is listed for Mac below rather than guessed at.

**The GPU, per pass.** `?perf=zones` (VC6d) times each pass with EXT_disjoint_timer_query_webgl2, which SwiftShader
exposes; the probe serves `perfMeter.js` a 6-frame window (probe-only) and 960x540 (four times the pixels), and each
figure is the mean of four windows. Milliseconds of SwiftShader time a frame - relative only:

| scene | total: 09-25 / 09-28 PM / main | world | sky | air | shadow |
|---|---|---|---|---|---|
| town, rain | 1907 / 1669 / 1690 | 849 / 888 / 919 | 855 / 564 / 539 | 101 / 115 / 123 | 102 / 103 / 108 |
| coast | 1058 / 1080 / 1033 | 380 / 400 / 382 | 503 / 495 / 477 | 109 / 118 / 113 | 67 / 67 / 61 |
| town, 22:00 | 1210 / 1321 / 1372 | 614 / 696 / 703 | 445 / 466 / 498 | 133 / 142 / 156 | 18 / 17 / 16 |
| tavern | 888 / 886 / 853 | 741 / 732 / 714 | - | 133 / 141 / 128 | 15 / 13 / 12 |

RAIN-FPS made rain's sky a third cheaper, which carries the rainy town's total. The town at night reads 13% dearer on
`main` than on 09-25, but its four windows span 518-654 (09-25) and 614-754 (`main`) in the world pass alone -
inside the noise at four samples, so it is recorded here and not claimed. The sky (the dome, the cloud march and its
composite) is 40-50% of this GPU's frame outdoors, rain or shine.

**The sky, split.** The probe split the sky's span (probe-only marks in `shared.js`'s `draw`): the dome (the Dynamic
Skies renderer, the default outdoors), the cloud MARCH (`clouds.update` - a stripe of the 1024x256 sky map and of
the 512x512 cloud-shadow map a frame) and the cloud COMPOSITE. Means of four windows, `main` with PERF-URL, 960x540:

| scene | total | world | march | dome | composite | air | shadow |
|---|---|---|---|---|---|---|---|
| coast, noon | 1021 | 377 | 298 | 156 | 11 | 117 | 63 |
| town, rain | 1569 | 856 | 329 | 159 | 11 | 116 | 98 |
| town, 22:00 | 1223 | 647 | 268 | 150 | 12 | 132 | 15 |

The march is 21-29% of this GPU's frame outdoors in every weather and at night, and it is the one pass whose price
does not fall with the Render Scale: it is the tier's map (Default: 1024x256 texels, 56 steps, 5 light steps; Low:
512x128, 32, 4 - about a tenth of the work), re-marched over RAIN-FPS's sweep (8 frames fair, 16 covered, 32 under
storm cells). What would make it cheaper changes what the sky looks like - a longer fair sweep, a smaller map or
fewer steps at Default, or the tier chosen for a machine by its measured frame - so it is Mac's, below, not taken.

**The mechanism behind "script = frame" (SCRIPT-SPLIT's open hypothesis), seen here.** In isolation a WebGL call costs
the main thread 30-160 ns in this Chromium (a uniform 40-65, a VAO bind 115, a bind and a draw 160); inside the game's
frame the same `bindVertexArray` averaged 1.2-1.6 us. The difference is the command buffer: when the GPU process has
not drained the last frame's commands, the next frame's calls wait for room, and the wait is spent inside whichever GL
call hits the full buffer - so a GPU-bound frame reads as main-thread time, in `in frame`. Here SwiftShader is the
slow GPU; on a player's machine it is the card under the frame's passes. The levers for those reports are the GPU's
passes and the JavaScript the frame really runs - not the GL call count.

**Measured and not taken: redundant GL state.** A census that compares every state call with the value already set
counted 873 of the town's 4,491 GL calls a frame (19%) setting what was set - the Dynamic Skies renderer's uniforms
(~74 a frame), the shadow replay's per-record sampler unit, texture unit and basis (~190), the lit programs' shadow
and cluster uniforms re-sent to each of four programs (~80), the billboards' black emission map on unit 1 (31). At
30-65 ns a call that is ~0.04 ms of the main thread a frame: nothing a player would feel, against a refactor of the
shadow and lighting passes' state (what the GPU process does with a repeated uniform was not measured here). Recorded so the next pass does not
go looking again.

## PERF-URL — the page's query, parsed once a search

**Measured.** The census of a settled town (Knightstale, rain, 15:00) counted **84 `URLSearchParams` minted a frame**:
54 by the online lane's `isOnlinePage` (every `getPref` asks it for the forced keys, every `modSetting` once or twice),
24 by the skin's `skinOverride` (whatever draws asks `isEnhanced()`), and one or two each by the combat visuals', the
wind audio's, the blood marks', the wisps' and the first-person lighting's kill doors. In the frame's profile that was
0.61 ms of `URLSearchParams` a frame in the town and on the coast alike, and the doors around it 0.65-0.72 ms
together - for an answer that cannot change while the page is open.

**Why it kept coming back.** PERF-SUN (2026-09-19) paid this exact cost for ONE door - `swayDisabled` in
`systems/windDrive.js` keeps its answer until the search string changes (`cullDisabled`'s shape) - and every door
written since was written the old way again, because the fix lived in one file. There was no shared parsed view of the
page's query to reach for.

**The fix.** `systems/pageQuery.js`, the one home: `pageParam(name, search?)` and `pageHas(name, search?)` over one
parse, keyed on the search string they READ. Not a latch: the boot publishes the params it decided to the URL
(`publishBootParams`, MAC-N3) before the world boots, and a latch read before that would answer the menu's URL for the
whole session - the bug MAC-N3 fixed. Every other change to the URL in this port is a navigation, which starts a new
page. The parsed object never leaves the module, so no reader can edit what the next reader is served (`main.js` keeps
its own `URLSearchParams` for the boot, which it does edit). Twenty-four reads in nineteen files go through it - the online lane, the skin,
the UI pack, the air and contact doors, the shadow cache, the light clusters, the lighting, haze, volumetrics and
exposure doors, the ground tier, the water, the wisps, the wind audio, the blood marks, the first-person lighting, the
combat visuals, the lighting mod's test door, the dungeon map, the fonts, the window motion and the world's grass door.

**Held by count, and by a sweep.** `test/perfurl_doors.test.js` (4): a thousand reads of one search mint one parse;
eight of the frame's doors a hundred times each off one search mint one; the boot's published URL is the answer the
moment it lands; a window's own search is read, not the page's; and `new URLSearchParams(` appears in `src/` only at the
home, `main.js`'s boot params, `realmBootSearch`'s builder, PERF-SUN's own sway memo and the once-a-page latches
(`renderScale.js`, `weatherSim.js`'s four), each allowance counted so a stale one reddens. `tools/mutants/perfurl.json`:
8 mutants, all dead. After it the census counts 0 parses a frame in the same town, and the same 4,486 GL calls - nothing
drawn changed; the profile reads 0 ms of `URLSearchParams` and 0.02-0.05 ms for the doors.

Recorded with it: BOOT2's static-reach ceiling (`test/boot2.test.js`) had been reached exactly (60) by the renderer's
own growth since 2026-09-20; `pageQuery.js` is a leaf that imports nothing and makes it 61, and the ceiling moves to 64
with the reason beside it - the hub laws, which are what the ceiling was for, are untouched. And the grass probe hook
`window.__grassStats` had been answering without `cells` and `slots` since at least 2026-09-24: a comment sat in the
middle of its object literal (`scenes/world.js`, beside `labGrassField.update`) and the two keys were inside it. They
are code again, held by `test/perf2.test.js` through `codeOnly` (red on the old line).

## AUDIT PERF-URL — the PR read before it merges (2026-09-29)

Mac: "audit this". Nine findings came back from a reader over the branch's diff; each was checked against the tree
before anything moved, and each fix was pinned RED first - a mutant that survived the old pins and dies on the new
(`tools/mutants/audit_perfurl.json`: 7, all dead; five of them survived the pre-audit pins, the other two were live
in the tree).

**Fixed.**
- **A3 - the sweep saw one spelling.** It matched `new URLSearchParams(` on a line, and `render/frustum.js`'s
  `cullDisabled` had been sniffing `location.search` with a regex of its own all along; a URL object's
  `searchParams.get`, an alias or a constructor split over two lines passed too. The sweep now reads every spelling
  of a read (a URL BUILT - the menu's links, the overhauls' reload - reads nothing and is not swept), and
  `cullDisabled` reads through the home.
- **A4 - "ONE HOME" had a second.** PERF-SUN's `swayDisabled` kept its private search-keyed memo, allowed by the
  sweep. It reads `pageParam('sway', search)` now; PERF-SUN's pins hold it by source and by count, and AUDIT F1's
  declared-above-its-reader law moved with the state to `pageQuery.js`'s two `let`s. Three PERF-SUN mutant records
  re-aimed by content (25 of 25 dead).
- **A5 - the latches' reason was said, not held.** The allowance claimed the boot's publish "runs before any of them
  is asked" - unverified. What is true is that the publish writes `main.js`'s own params, which edit only the boot's
  door keys and, online, the refused power flags; the sweep now reads each latch's key off its line and holds it out
  of those sets, so a latch reads the same on either side of the publish. The latches stay: "read once a page" is
  their own slices' pinned contract (`test/perfscale.test.js`, `test/clockArc.test.js`).
- **A8 - a presence test passed as a reader.** AUDIT 58's knob pin (`test/doctrine.test.js`) had been loosened to
  accept `pageHas('k'`, and every knob there hands a VALUE: `pageParam('k'` only.
- **A2 - a URL's pathname is not a path.** `test/perfurl_doors.test.js` took its root from `.pathname`
  (percent-encoded); `fileURLToPath`, as the repo's other pins do.

**Not changed, and why.**
- **The cite quotes in `test/citedrift.test.js`'s comments moved (+1).** Pre-existing: `tools/citeShift.mjs` moves
  them on every run - the same sentence read `world.js:16385` on 09-25, `:21665` on 09-28, `:21907` before this PR -
  because it cannot tell a quoted stale cite from a live one (its own header says what it cannot do). Recorded for the
  tool's next pass, not re-derived by hand here.
- **The one-entry memo re-parses when two searches interleave.** The only reader of a search other than the page's is
  `windowMotion.js`'s per-window check, which runs as a window opens and, in the game, is handed the page's own window.
  A miss costs one parse - what every read cost before PERF-URL.
- **BOOT2's ceiling at 64, not 61.** The test's own design: the ceiling "leaves room for a real need and none for a
  hub", and the hub law is its own assertion; a ceiling at the exact reach would redden the next real leaf.
- **`test/perf2.test.js`'s hook slice.** The `-1` case is unreachable: the assertion before it matches the same prefix
  and fails first, with the right message.

## For Mac

- **The cloud march** is the largest outdoor GPU cost left (21-29% of this GPU's frame, every weather, and the Render
  Scale does not touch it). The levers change the sky's look - a longer fair sweep, a smaller map or fewer steps at
  Default, or the tier picked per machine by its measured frame - so they are yours.
- **The boot's waits** (above): three fixes are in reach and each is a behaviour of its own - the icon canvases made
  CPU-backed as FIELD 2026-09-27 made the decode canvas (`ui/bitmapCanvas.js`, `ui/textureCanvas.js` fitUrl; wants a
  deterministic A/B first), deep waters' six programs warmed through PERF-WARM's idle queue, and the spoils glow built
  at the gate court's first use instead of every boot.
- **The town at 22:00** reads 13% dearer on the GPU than on 09-25, inside four windows' noise - worth a longer run.
- **Pre-existing, not this slice's:** with ARENA2 present, `test/audit18_ui_native.test.js` F8/F9 and F10b fail on
  `main` too (`renderer.endUiRun is not a function` - the test's renderer stub predates `endUiRun`).
