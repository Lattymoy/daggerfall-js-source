# FIELD BUGS 2026-09-25

# PERF-SCALE — slow outdoors on a good GPU, and a counter that could not say why (2026-09-25)

**Report** (two players, relayed by Mac): "One user is reporting fps issues
in the exterior but fine in the interior ... GPU is NVIDIA GeForce RTX 4060
Ti", and a second, "me too my friend.. don't know why. I got a RX6600".
Mac: "It has nothing to do with our updates" - it is not new: FPS1
(2026-09-11) had already heard "the outside still has optimization
issues".

**Cause.** Not the cards. The world rendered at the window's full CSS size
(`Renderer.beginFrame` - `clientWidth` x `clientHeight`) with no cap and no
render-scale setting, so a player on a 1440p, 4K or ultrawide window, with
DSR/VSR, or with the browser zoomed below 100% paid two to four times a
1080p player's per-pixel exterior work (the sky's march, the air's
passes, the lit ground under the whole screen). And the browser may run
WebGL on the wrong adapter (an integrated GPU, a software rasterizer):
nothing in the game showed which GPU it drew on, and the FPS counter
showed neither the GPU nor the render size.

**Fix.** A RENDER SCALE - the Features home's Sight row "Render scale",
100% (the default: nothing changes, the frame is today's call for call),
85%, 75%, 67%, 50%, the player's own online, live on the next frame. Below
100% the world (every 3D pass, on either lane) draws into an image of the
world rect x the scale and is presented LINEAR to the full rect; the HUD,
the menus and the first-person overlay stay at the canvas's resolution.
It is RETRO1's image path generalised - one home for a world drawn
smaller and shown - and Retro Picture Mode wins over it. And the FPS
counter names the GPU the browser actually uses (read once, when the
renderer is made) and the frame's size (world image, canvas,
`devicePixelRatio`, scale), on screen while it is on and on
`window.__fpsStats` for a probe. `07-Rendering/Rendering.md` PERF-SCALE has
the law; Ledger A row PERF-SCALE.

**What to tell the players.** Turn on the FPS counter (Enhanced pane) and
send a screenshot: the `gpu` line says whether the browser is on the
card, and the size line says how many pixels the world costs. If the
world is large, Features > Sight > Render scale at 75% is roughly half the
per-pixel work; 50% a quarter.

**Pins.** `test/perfscale.test.js` (8), every one failing on the base;
`test/features.test.js` (the row list and the notes' budget),
`test/ft8_combatvisuals.test.js` (the Enhanced count),
`test/mwarms_fps.test.js` (main.js's mount). Mutants
`tools/mutants/perfscale.json` (29 dead); `retro1.json` and
`auditretro1.json` re-aimed.

## AUDIT PERF-SCALE (the review)

Seven findings from the adversarial read; each was reproduced in node on
the real Renderer and the fake GL before it was changed.

- **R1: 100% after 75% kept the memory.** The world frame that went back
  to no image freed only retro's LUT; the image, its depth and the lane's
  image-sized frame stayed for the session (on a 4K canvas at 75%, 36 MiB
  classic, 89 MiB under the lane). That frame frees them now, after the
  owed present (`Renderer._dropWorldImage`), and retro off does the same.
  The lane's canvas-sized frame is kept: menus, maps and videos draw into
  it.
- **R2: a stored "0.750" ran at 75% under a tile showing 100%.**
  `renderScaleOf` matched a tier by its number; the Features tile matches
  by its string. It matches by the string now, so the two can't disagree.
- **R3, recorded and not changed: below 100% the glow spreads wider.** The
  bloom's blur and the bolts' minimum width are sized in the image's
  pixels, so 50% of a canvas looks like a half-size window stretched. That
  is how the renderer already treats window size: a 1080p window's glow is
  twice as wide on screen as a 4K one's. Sizing the kernels in canvas
  pixels would leave gaps between a quarter-size bloom's taps and put a
  bolt under one image pixel. `07-Rendering/Rendering.md` PERF-SCALE says
  so.
- **R4, R5: the counter's details were unpinned.** No pin covered
  frameInfo's host-rect arm (the docked strip at 100%), the probe's `retro`,
  "gpu unknown" or the dpr's rounding. All four are pinned now.
- **R6: two readings of "the scale is on."** The warm built the present
  for a source answering 0, which the frame refused. Both ask
  `Renderer._scaleOn` now. The comments name one home for the law,
  `_retroBegin`.
- **R7: a paraphrase in quotation marks.** The comment and the bible quote
  the report as written.

Pins: `test/perfscale.test.js` 10 (S5's string rule and both S7 pins fail
with `src/` at the slice's commit; the counter and frameInfo pins guard
code that commit already had). Mutants: `perfscale.json` 43 dead;
`auditretro1.json`'s D5 re-aimed.

# PERF-EXT, cluster C — the frames that freeze around a crossing (2026-09-25)

**Report** (the same two players): "fps issues in the exterior but fine in
the interior", "me too my friend.. don't know why. I got a RX6600". And
Mac, after PERF-SCALE: "Why are you so avoidant when it comes to
addressing performance issues? I am not getting another player to do the
work that youre suppose to do".

**Cause, this cluster's share.** The streaming world's work is paid on the
frames around a map-pixel crossing and on the road into a town, and none
of it shows in `?perf=cpu`, which measures the steady frame. An interior
streams nothing, which is the "fine in the interior" half.

**Fixes** (each proven by a find-and-prove pass before it was written,
and re-measured on the change; `07-Rendering/Performance-Exterior.md`
cluster C has the numbers and the laws):

- **PERF-EXT-C1** - the grass field's slot count (an 11-33 ms sweep, paid
  by every field built - every crossing, teleport and load) is swept once
  and warmed at mount.
- **PERF-EXT-C2** - the grass field survives the floating-origin shift.
  Every map-pixel crossing threw it away and regrew it: the grass
  vanished (2 slots of 357 drawn on the crossing frame), regrew
  nearest-first over ~3 s at +5-7.5 ms a frame and came back reshuffled.
  The field has an origin of its own now and follows the scene's in
  place (0.2-0.3 ms, no upload); every stale-cell heal the rebuild gave
  by accident is said on purpose (every publish, every promotion), and a
  teleport or a load - which never emptied the field - does.
- **PERF-EXT-C3** - a walk places its grass rim a slice a frame. A cell
  arriving at the 300 m rim was placed whole on the frame it arrived, a
  4-8 ms spike on 5-17% of frames while moving; it is placed 1,500
  candidates a frame now, byte for byte the same cell (walking p99 4.4-6.6
  ms -> 1.4-1.8 ms). A boot or a teleport still fills whole cells at the
  old pace.
- **PERF-EXT-C4** - a pixel's publish tail breathes. After its last
  model, a town or city pixel merged its static batch and measured its
  spheres in one piece - 39-66 ms of one frame on a synthetic city, 8-22
  ms on a town. The merge yields between models, sphere ranges and
  texture groups now (no unit over ~0.3 ms warm) and hands createMesh the
  spheres, byte for byte the same.
- **PERF-EXT-C5** - the stream's build slice is what the frame left. A
  flat 6 ms slice sat on top of the frame in the same rendering
  opportunity, so every streaming frame over ~8.7 ms of script missed
  vsync (12 ms of script ran at 55 fps while a pixel built, 18 ms at 41);
  it lends the frame interval less the frame's script less 2.5 ms now,
  3-6 ms (60 and 47 fps), and the counter and `?perf=cpu` see the stream
  for the first time. The trade-off, for Mac: a heavy frame builds at up
  to half pace for at most two seconds, so the far ring's notch over a
  pixel still building stays open longer in clear weather.
- **PERF-EXT-C6** - a collider cell's key is a number. The collider
  minted a string per cell a streamed triangle covered and per cell a
  query read; the key is one exact multiply-add now, and the insert of a
  synthetic city pixel's 300,000 triangles fell from ~1.07 s to ~0.76 s
  of main thread (-27-30%), every answer the same bits.
