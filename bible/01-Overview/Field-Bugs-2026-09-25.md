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

# PERF-EXT — the same report, answered in code (2026-09-25)

**Report** (the same two players): "fps issues in the exterior but fine
in the interior", "me too my friend.. don't know why. I got a RX6600".
Mac, after PERF-SCALE: "Why are you so avoidant when it comes to
addressing performance issues? I am not getting another player to do the
work that youre suppose to do".

**What changed.** The exterior's own cost, found by hunters on a harness
(the real renderer and shadow pass over a counting GL, driven by
`world.js`'s frame walk on a synthetic town) and re-measured by provers
told to disprove each win. The flats and the frame's CPU:

- **PERF-EXT10** - every flat batch is born with every field it will
  carry, so the world's flats share ONE hidden class instead of 3-15; the
  per-flat loops stop paying polymorphic lookups. Render-side JS on the
  harness 1.62 -> 1.20 ms a frame by day, 2.28 -> 1.41 at night (node,
  relative; the picture cannot change - no computed value does).
- **PERF-EXT11** - a flat's size and origin are uploaded when they
  change, in the flats pass and in every shadow replay: 6,243 -> 5,279
  GL calls a frame by day and 4,992 -> 4,265 at night on the harness,
  every draw seeing the same values.
- **PERF-EXT12** - the far-flat rule is asked with three numbers, not
  an object for every flat batch of every pixel every frame: about
  70 KB less young garbage a frame (1,299 -> 1,074 scavenges over
  3,065 harness frames with a 1 MB young space).
- **PERF-EXT13** - every visible pixel's water in one call: the frame's
  water block goes up once, not once a water pixel - 34 pixels 2,421 ->
  308 GL calls on the real renderer, every draw's state identical to
  the base's (a coastal or lakeside view is where it pays).

`07-Rendering/Performance-Exterior.md` has the measurements, the pins
and the mutants. Not seen on a GPU - there is no game data in the
container.

## AUDIT PERF-EXT10-13 (the review)

One finding from the adversarial read of the flats and the frame's CPU,
reproduced in node on the real Renderer and ShadowPass before it was
changed.

- **R1: the one shape made the shadow record allocate.** PERF-EXT10
  minted the shadow record's origin, `_shOx`/`_shOy`/`_shOz`, as
  undefined with the other twenty. V8 keeps a field in the
  representation of the first value it holds, and undefined is not a
  number, so the three were tagged slots, and every fractional origin
  `recordBillboards` stored - every batch, every frame - was a new heap
  number: about 120 KB of young garbage a frame over 3,000 flats, which
  the base (its fields born with their first double) never made. On the
  producer-mix harness it gave back most of what the one shape had saved
  in scavenges. The triple is born NaN now, a double slot written in
  place; nothing reads it before `_shSeen`, so no value changes and the
  picture cannot. Producer mix, scavenges with a 1 MB young space over
  3,000 frames (two runs' mean), the first cut -> now: 1,298 -> 1,210 by
  day, 1,244 -> 1,172 at night (the base's 1,297 and 1,304).

Pins: `test/perfextb.test.js` 11 (the new one weighs the record against
a control and fails with `src/` at `1d05f5374`). Mutants:
`perfextb.json` 36 - 35 dead, 1 recorded equivalent; its 5 re-aimed.

## PERF-EXT1-5 - the shadows

The Enhanced Lighting shadow pass, the sun's cascades and the lanterns'
cube maps (`07-Rendering/Performance-Exterior.md`, THE SHADOWS):

- **PERF-EXT1** - a pixel-wide flat batch (a wood, a climate's flora
  record) reaches a shadow by its PLACEMENTS, not its 400-unit sphere: a
  lantern is no longer held on the sway's beat by trees none of which
  stand in its reach, and the near cascades skip a wood with no tree in
  them. Shadow draws a frame on the harness town 297 -> 10 at night,
  568 -> 193 at dusk, 271 -> 183 by day (at real density 616 -> 5,
  983 -> 201, 373 -> 198), every quad of every skipped batch proven
  beyond a clip plane (67.8 million of them). What moves: a walker
  leaving a lantern's reach loses its shadow the next frame, as it does
  in calm weather, not at the sway's next beat.
- **PERF-EXT2** - a static batch's sub-meshes whose index ranges meet
  are one depth draw: a pixel's merged block models were one draw per
  texture in every cascade and every lantern face (40 in the harness's
  city pixel). With PERF-EXT1, shadow draws a frame on the harness town
  297 -> 8 at night, 568 -> 81 at dusk, 271 -> 73 by day (the night's
  worst frame, a cache rebuild, 934 -> 36). The same triangles.
