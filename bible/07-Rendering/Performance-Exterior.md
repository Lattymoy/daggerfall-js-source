# PERF-EXT — the exterior's frame, made fast in code

*2026-09-25. Two players, relayed by Mac: "fps issues in the exterior but
fine in the interior" (an RTX 4060 Ti), and "me too my friend.. don't know
why. I got a RX6600". PERF-SCALE (`01-Overview/Field-Bugs-2026-09-25.md`)
gave them a render scale and a counter that names the GPU; Mac then: "Why
are you so avoidant when it comes to addressing performance issues? I am
not getting another player to do the work that youre suppose to do".*

Every change on this page was found by one lane and re-measured by
another that was told to disprove it, and landed only with the same
harness re-run on the change. There is no game data in the container, so
the harnesses drive the real modules over synthetic scenes. The GPU ones
run in headless Chromium on SwiftShader, a software rasterizer: its
milliseconds are not a graphics card's, and the RATIOS and the pixel
diffs are the claim. The harnesses were the pass's scratch and are not in
the tree; the numbers are quoted as they ran.

## Cluster D — the shaders

Two slices, one idea: a shader that multiplies its answer by nothing
should not compute the answer. Both are picture-neutral by construction -
the skipped work is added at weight 0 or reads an image that is black -
and both were diffed pixel for pixel against the base on the real
modules: **0 bytes differ**, in every sky, day and night, lanterns lit
and not.

**The honest scale, first.** Counted against the cards' published texel
rates (RTX 4060 Ti 344.6 GTexel/s, RX 6600 223 GTexel/s) these are tens of
microseconds a frame at 1080p - two to four times that at 1440p and 4K,
and more on an integrated GPU. PERF-TOWN1 measured the exterior
CPU-bound (nine to nineteen milliseconds of JavaScript), and these do not
change that: they are the fill-rate share, which is what a player at a
high resolution, or on the wrong adapter, pays.

### PERF-EXT30 — the sky stops drawing clouds it has been told to hide

**What the frame paid.** Under the volumetric clouds - the default since
VC3, over either sky since DS2 - each sky is told to stand its own clouds
down, and each did it by weight, not by skipping:

- **Dynamic Skies, the default sky** (`OUTDOORS_DEFAULT = 'dynamic'`,
  `world/outdoors.js`; the mod's `Enabled` on by default). `draw()`
  uploads `_CloudTopOpacity` and `_CloudOpacity` as 0, and each of the
  mod's two sheets still ran whole on every sky pixel - two diffuse taps
  and two normal-map taps, two `UnpackNormal`, a `BlendNormals`, the
  remaps, `hsmoothstep` and the sun's rim - to end in
  `mix(col.rgb, sheet, x * 0)`: the colour it was handed. Eight taps and
  about 120 ALU a pixel, multiplied by nothing.
- **The port's own dome** (the "dome" tier). VC3 hands it `uCloudCover`
  0, and every pixel above the horizon still ran both fbm decks - forty
  hashes, ten noise blends, the rim's three pows. With cover 0 each deck
  is `smoothstep(1, 1 + soft, fbm)`, and fbm cannot reach 1: five octaves
  of a hash in [0, 1) weighted 1/2 down to 1/32 sum under 0.96875. So the
  cover was 0, exactly, every time.

**The change.** Each is gated on its weight: the mod's sheets on
`_CloudTopOpacity > 0.0` and `_CloudOpacity > 0.0` (the three locals
both sheets write are declared above the pair, where the second can see
them), the dome's decks on `dir.y > 0.0 && uCloudCover > 0.0`. The mod's
lines inside the gates are its own to the character, left at their
indentation so they still read against the vendored shader. The gates
are uniforms, so the taps' implicit derivatives stay defined.

**Why the picture cannot move.** `mix(c, s, 0)` is `c` for any finite
`s`, and every shipped preset's sheet is finite: `AlphaMax` is above
`AlphaTreshold` on both sheets of all seven (so `hsmoothstep` never
divides by 0), the top sheet's boost divides by 1 (the float3 quirk,
uploaded as 0), and the Cloudy low sheet's boost of 1.0 divides by 0 into
a `saturate`. The dome's deck at cover 0 is 0 for any `soft` above 0, and
the smallest weather row's is 0.18. `?clouds=off` gives a sheet its
preset's opacity (0.25 to 1.0) and a deck its row's cover, and both run
as they always did.

**Measured** (SwiftShader, 960x540 full-screen sky, A/B alternating, real
syncs; A is `e9dd612e7`'s module, B the tree's, each built by its own
constructor; the default sky with all its vendored textures loaded):

| sky, case | median A -> B | min A -> B | bytes differ |
|---|---|---|---|
| Dynamic Skies, noon, cloudy, looking up | 211.2 -> 198.2 ms (-6.2%) | 201.0 -> 184.2 (-8.4%) | 0 of 2,073,600 |
| Dynamic Skies, noon, sunny, level | 219.3 -> 202.9 (-7.5%) | 202.3 -> 178.4 (-11.8%) | 0 |
| Dynamic Skies, 01:00, clear, looking up | 218.9 -> 199.8 (-8.7%) | 201.7 -> 174.9 (-13.3%) | 0 |
| Dynamic Skies, `?clouds=off` (control) | 208.4 -> 210.5 (+1.0%) | 155.9 -> 153.1 | 0 |
| port dome, noon, cloudy, looking up | 78.7 -> 65.9 (-16.3%) | 74.0 -> 59.9 (-19.1%) | 0 |
| port dome, noon, clear, level | 72.7 -> 65.0 (-10.6%) | 64.8 -> 55.7 (-14.0%) | 0 |
| port dome, 01:00, clear, looking up | 86.0 -> 72.6 (-15.6%) | 76.9 -> 67.4 (-12.4%) | 0 |
| port dome, real cover (control) | 77.8 -> 77.2 (-0.8%) | 69.9 -> 68.0 | 0 |

In the whole synthetic exterior frame (the real `Renderer`, the air pass,
the clouds, 3x3 streamed terrain pixels, 2,400 flats) the dome's pass fell
69.1 -> 62.8 ms by day and 52.6 -> 45.0 at night, 0 of 518,400 pixels
different. The provers' own runs, on the base with the change
substituted: Dynamic Skies -7% to -10%, the dome -12% to -17%, 0 bytes.
On the cards: about 25-30 us a frame on a 4060 Ti and 40-45 us on an RX
6600 for the default sky at 1080p with 40% of the screen sky; the dome
tier about 55 and 140 us.

**Pinned** (`test/perfextd.test.js`, the shaders RUN in float32 by
`test/glsl.mjs`): the mod's sheets - their own text between `// Clouds`
and `// REDUCE_COLOR` - on the uniforms the real runtime and the real
renderer upload for four weathers and hours, against the same text with
the gates taken out: at opacity 0 nothing is read and the colour out is
the ungated one to the bit; at the preset's opacity both run, eight reads,
the same bit; one sheet on, its own two textures alone. The dome's FS on
the real renderer's uploads, its fbm counted: at cover 0 no noise is
called and every pixel is the ungated dome's to the bit; at a real cover
both decks run and agree. And the premises: every preset's sheets finite
and drawn under `?clouds=off`, fbm's weights and octaves, no deck bias,
no zero softness. Both tests fail with `src/` at `e9dd612e7`.
`tools/mutants/perfextd.json`, 11 of 11 dead: each gate dropped, opened at
0, crossed onto the other sheet or closed before its mix; the locals put
back inside the first sheet; the opacity not zeroed under the clouds; an
fbm weight raised; a deck given a bias.

### PERF-EXT31 — the resolve stops reading images that were not drawn

**What the frame paid.** The air pass's last draws read two images the
frame may never have drawn. The lanterns' glow (VOL1) is cleared black on
every frame it is not marched - no lantern lit, which is every day
outside without a torch, the door shut, or a frame the pass was not
prepared for - and the shafts' image on every frame with neither the
beams nor the haze, which is every night. The resolve still read both on
every world pixel (a tap and an sRGB decode, three `pow`s, for the glow; a
tap for the shafts), and the bright pass read the glow on every
quarter-resolution pixel - to add exactly 0: `airDecode(0)` is 0 and
`0 * uGrade.y` is 0.

**The change.** The two passes are built for what the frame drew:
`bright[glow]` and `resolve[glow][shafts]`, each the full pass less
exactly the reads of the images it is not given; `bright[1]` and
`resolve[1][1]` are `e9dd612e7`'s texts character for character.
`composite()` picks them after `_images()` or `_blank()` has run, from the
flags that decided the draws - `stats.vol` (the glow marched) and
`stats.shafts || stats.haze` (the beams or the haze drew into the shafts'
image) - so a lantern's glow is never gated off. The luminance image
reads the glow either way (sixteen taps a texel of a 32x32 image, 16,384
a frame: nothing to save). No uniform is added, so the frame's GL calls
are the base's to the call (199 by day, 352 at night with thirty
lanterns). Six programs where there were two, built once with the rest of
the pass, which the renderer keeps for its life.

**Not a uniform `if`.** The provers' form was `if (uVolOn > 0.5)` around
each read, and it was built and measured first: SwiftShader flattens a
branch that small and pays the read anyway - the resolve 4-6% faster by
day and nothing at night, against 16% with the read compiled out - and a
GPU's compiler is as free to predicate a four-instruction block. So the
reads are compiled out instead.

**What could differ.** The arithmetic is exact: a black read adds +0 and
the shorter pass computes the same sum without it, and SwiftShader gave
0 of 2,073,600 bytes different in every case. A driver that fuses the
shorter sum differently from the longer one (an FMA where there was a
multiply and an add) could move a float by an ulp - below a byte of the
encoded output except where it sits on a rounding edge. It was never
seen.

**Measured** (SwiftShader, 960x540; A is the full pass - the base's -
and B the one the frame takes, 40 rotating full-screen draws with real
textures at the pass's sizes; then the whole synthetic exterior frame,
A drawing through the full passes every frame as the base did):

| case | resolve, median A -> B | min A -> B | bytes differ |
|---|---|---|---|
| day: glow black, shafts drawn | 27.9 -> 23.4 ms (-16.1%) | 25.7 -> 22.2 (-13.6%) | 0 of 2,073,600 |
| night, lanterns: glow drawn, shafts black | 27.8 -> 25.5 (-8.3%) | 26.1 -> 23.8 (-8.8%) | 0 |
| neither drawn | 27.9 -> 21.2 (-24.0%) | 26.4 -> 20.2 (-23.5%) | 0 |
| both drawn (control: the same program) | 27.9 -> 27.7 (-0.7%) | 25.3 -> 24.0 | 0 |

In the frame, by day: the resolve 31.1 -> 23.8 ms (-23.5%; min -22.1%),
the bright pass 1.2 -> 0.7 (-42%), 0 of 518,400 pixels different, 199
GL calls both. At night with thirty lanterns: the resolve's min 17.8 ->
16.5 (-7.3%), the glow drawn and 0 pixels different, 352 calls both. The
provers' run on the base with the reads removed: the resolve -17.4%, the
bright pass -27%, 0 pixels. On the cards: about 2 million taps and 12
million transcendental ops a frame at 1080p by day, some 15 us on a 4060
Ti and 25 us on an RX 6600, and a tap a pixel more at night.

**Pinned** (`test/perfextd.test.js`, two more): the six fragment sources
as the renderer links them - each variant is the full pass less exactly
its reads, the full pass carries both - RUN in float32 over every frame
the pass can make (each image drawn or black): a variant reads the glow
and the shafts only where they were drawn, and its pixel is the full
pass's to the bit; and on the fake GL, the passes each frame draws
through - a lantern in fog the glow's, a day with no light the bare
ones, the beams or the haze the shafts' resolve, a night the glow's
without the shafts, a menu's frame the bare ones. Both fail with `src/`
at `e9dd612e7`. `tools/mutants/perfextd.json` 13 more, all dead: a read
always in or never in, the shafts' term re-spelled, the choice stuck,
made before the images, blind to the haze, or always the full pass. Re-
aimed by content: `vol1_glow.test.js`'s bright-pass and resolve-bind
pins, `el3_air.test.js`'s program count (seventeen),
`auditretro1.test.js` and `auditretro2.test.js`'s rect reads (the bare
passes those frames take), and the records in `vol1.json`, `el3.json`,
`el4.json`, `el6.json`, `auditretro2.json` and `audit68_render_a.json`
that name the renamed lines (175 dead across the six).
