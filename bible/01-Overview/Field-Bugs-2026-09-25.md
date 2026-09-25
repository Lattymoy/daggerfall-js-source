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
