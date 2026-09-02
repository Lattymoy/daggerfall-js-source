# ENHANCED ENVIRONMENTS - THE ARC (second attempt, 2026-09-01)

Mac: reattempt the arc with precision, no rushing. Proper research and
integration, and the grass prototype makes it in 1:1, barring
pre-existing bugs.

This document is the plan. Nothing in it is code yet. Each slice
below names what it changes, what it must not touch, and the gate
that proves it before it ships. A slice that cannot name its gate is
not ready to be a slice.

## Why the first attempt failed, as laws

The first attempt shipped a black world, then broke every texture in
the game, then was reverted whole. Each failure has a cause and each
cause is a law here:

1. **A shader change is not gated by eslint, the node suite or a vite
   build.** None of them compiles GLSL. EE4 put its uniform
   declarations outside both shaders and every gate said pass. LAW:
   every slice that touches a shader runs `tools/bootProbe.mjs` AND
   the world render gate (below) before it commits.

2. **The game page was never rendered by any gate.** The lab's gate
   loaded grass-proto.html, which needs no data; the game needs
   ARENA2. LAW: `tools/worldRenderGate.mjs` (slice 0) boots
   `?exterior&shot` against ARENA2_PATH and reads real pixels. Every
   slice runs it.

3. **An upload path drew.** AUDIT 47's probe bound textures on unit
   0 to draw one pixel and never restored them; every pass after it
   inherited the wrong binding. LAW: an upload may create, fill and
   parameterise an object. It may not draw, bind a framebuffer,
   clear, change the pipeline, or leave a binding behind.
   `renderer.js` has a bind-shadow (`_use`, `_bindVao`,
   `markForeignPass`) and a draw counter (AUDIT 39 F50); every new
   GL call goes through them.

4. **Theories about drivers I do not have.** Three diagnoses of the
   black world were about a real GPU's behaviour, tested on
   SwiftShader. LAW: when a report cannot be reproduced here, the
   slice gets a URL kill switch and the report is not "fixed" until
   Mac sees it fixed. No fourth theory.

5. **Frequencies as multipliers seam.** Periodic noise wraps on its
   integer lattice; `P * 0.9` is 4.5 cells and a tile with that step
   carries a seam. LAW: every surface frequency is a whole number of
   cycles per tile, per axis. (Solved in the first attempt's EE7 and
   kept as a law.)

6. **A shared file with two authors is edited by hunk, not by
   checkout.** The revert had to strip the arc's lines out of
   world.js, exterior.js, shared.js and enhancedMenu.js because
   parallel sessions had touched them too. LAW: every hunk this arc
   adds to a shared file is marked `EE<n>:` on its first line, so it
   can be found and removed without touching anything else.

## What the lab is, by system

grass-proto.html carries seven systems. The ledger of what each needs
in the game:

| system | lab | game today | needs |
| --- | --- | --- | --- |
| sky | the game's shader + 2 fixes + sunset band + horizon fix | the shader, none of the fixes (reverted) | a diff to enhancedSky.js |
| ground texels | drawn surfaces, 128px, masked through the original tiles | 64px NEAREST from the archive | groundSurfaces.js + upload path |
| ground sampling | mips + anisotropy | none | sized format + sampler, enhanced only |
| ground lighting | normal map + detail tiling + cloud shadow | one per-vertex normal | a second texture + shader terms |
| cloud shadows | sampled from the sky's own deck | none | uniforms on the terrain FS from skyState |
| grass | instanced blades, 3 per quad, lit, wind | none - no instanced draw exists | a new draw path |
| weather | volume of drops/flakes round the camera | precipitation billboards (separate pass) | replace or extend that pass |
| surface field | puddles, snow, deformation, melt | none | the chunker's vertices |

The lab's FRONT (eased weather) is NOT ported: `shared.js` already
eases weather (ES1c `easeWeather`) and feeds it to the sky. The lab's
front gives way to the game's.

The lab's RAY CONVENTION fix is NOT ported: it was a lab bug. The game
builds its ray from a host passing its own camera's yaw and pitch.

## The slices, in order, each with its gate

**EE0 - the world render gate.** `tools/worldRenderGate.mjs`: boots
`?exterior&shot&novideo&nofoes` with ARENA2_PATH, waits for
`window.__frame` to advance, screenshots, and asserts: no page error;
the lower half of the frame is not black (mean > 20) and has more than
8 distinct colours; the upper half is not black. Proven by
re-introducing a known fault (a bad uniform name in TERRAIN_FS) and
watching it fail. No game code changes. GATE: itself.

**EE1 - the switch.** `enhancedEnvironments` pref replacing
`proceduralSky`, with the one-way migration, the row's prose, the
read in shared.js, the menu probe updated, and every pin re-taught.
Everything else in the arc hangs from it. GATE: check + bootProbe +
worldRenderGate + enhancedMenuProbe.

**EE2 - the sky's fixes.** Into enhancedSky.js: the horizon
projection cap; the star cell/offset fix; the four sunset keys; the
horizon thinning; and the CPU occlusion kept in step with the shader's
thinning. GATE: check + bootProbe + worldRenderGate at three times of
day via `__setWorldMinutes` (dawn, noon, night) and sky pixels sampled
for each.

**EE3 - ground sampling.** RGBA8 allocation; mipmaps + anisotropy
behind the switch; NEAREST for classic byte-for-byte; mode in the
cache key; `?ground=classic|tiles` kill switch. GATE: check +
worldRenderGate in BOTH modes, ground sampled non-black in each.

**EE4 - the drawn surfaces.** groundSurfaces.js (whole-cycle
frequencies, wrap pinned per axis, per surface) and the tile builder
masked through the original tiles, wired at upload behind the switch;
`?ground=drawn` joins the kill switch. GATE: check + worldRenderGate
in all three modes + the builder run against the real TEXTURE.302.

**EE5 - cloud shadows.** Uniforms on TERRAIN_FS from the sky's own
skyState (one field), declared INSIDE the shader, `uShadowAmt = 0`
for classic and interiors. GATE: check + bootProbe (this is the slice
that black-screened last time) + worldRenderGate under overcast via
the weather door.

**EE6 - ground lighting.** The normal texture (Sobel off the surfaces'
own height) and the detail read, both behind the switch. GATE: check
+ worldRenderGate, and a pixel-variance measure that rises with the
slice.

**EE7 - the grass.** The instanced draw path, through `_use` /
`_bindVao` / the draw counter; placement keyed to terrain chunks;
lit by the same uniforms; `?grass=off` kill switch. GATE: check +
worldRenderGate + a draw-count check that the grass reports.

**EE8 - weather particles.** The lab's volume in place of (or over)
the existing precipitation pass, through `markForeignPass` as that
pass already does. GATE: check + worldRenderGate under rain.

**EE9 - the surface field.** Last, because it must feed the chunker's
own vertices. Design first, as its own doc, before any code: see
`EE9-Surface-Field-Design.md`, written during EE8 so it is reviewable
before a line of it is coded.

Mac's direction, recorded here so it shapes EE9 and is not lost: WINTER
IS NOT A TEXTURE. The lab retired the snow tile in favour of snow that
ACCUMULATES on whatever ground is there, deforms underfoot, and melts.
So in the game the winter archives (x03) should not drive a "snow"
surface at all: the ground keeps its summer materials - grass, dirt,
stone - and the FIELD lays snow on them, with a per-climate warmth
function deciding how much stays and how fast it melts (a desert
winter holds none, a mountain winter holds it all). EE4's snow
identification is the bridge until then: it makes today's winter look
right, and EE9 replaces it rather than building on it.

## Not in this arc

Pixel-art blades (removed from the lab at Mac's direction). The lab's
front. The lab's ray fix. Anything the doctrine tests forbid: no
raster of game data ships; every tile is built on the machine that
has the game.
