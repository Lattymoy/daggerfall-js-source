# Volumetric Clouds - the arc (VC, opened 2026-09-07, CLOSED 2026-09-07; REOPENED and CLOSED again 2026-09-18 for VC6; REOPENED 2026-09-23 for VC7)

**Mac (2026-09-07): "one thing I want to do pertaining to our enhanced
environments is to remove the pixelated sky look and overhaul the
cloud visuals. I really want to keep our current cloud functionality
and expand on it. True volumetric clouds that move across the sky,
build during weather, etc on top of real cloud shadows that reflect
on the ground."**

## What the tree had when the arc opened

Mapped before a line was written (the map is the design's ground):

- **The default enhanced sky was the Dynamic Skies mod (DS1)**, on by
  being installed. Every pixelated element on that lane is the mod's:
  its 512x512 cloud sheets magnified with NEAREST across the dome, its
  `REDUCE_COLOR` colour posterise (`ceil` per channel, a step of 0.015
  on a sunny day), its point-filtered moons. Those are the mod's look,
  ported 1:1 with the authors' permission - not ours to change.
- **Under the mod the ground had NO cloud shadow at all**: the deck the
  controller hands the terrain carries `amount: 0` there ("the mod
  casts none, and its clouds are textures the ground cannot sample").
- **Our own dome (ES1)** draws two decks of five-octave value-noise
  cloud, eased over the weather rows (cover/soft/grey/lit/shade), drifted
  by the one wind integral (WIND2), with the sun disc occluded by the
  same field (`sunOcclusion`) and a cloud shadow on the terrain - the
  same noise, a DIFFERENT projection (one deck, world XZ x 0.0038, a
  plane 260 units up the sun ray), so the shadow is stylistically the
  sky's field but not the bank overhead's projection. Only the terrain
  takes it; grass, models, billboards, water and the far ring take a
  global `sunFactor` dim instead. And the dome snapped to ES1e's retro
  pixel (pi/512 on an equi-angular cube, 26 Bayer levels) by default.
- **The weather already arrives slowly**: a 14 s ease (2.8 game minutes
  since CLK1, 2026-09-08 - the same look at the default scale, and on
  the world clock), stretched ~64x
  across a front's three-game-hour lead (fifteen real minutes at the default scale), so cover BUILDS over a quarter
  of an hour and the wind leads it. The new clouds inherit that clock.
- **No offscreen machinery**: the world draws straight to the default
  framebuffer at DPR 1. A cloud pass that is amortised or reprojected
  is the first thing in the tree that needs a render target.
- **The laws** (Enhanced-Environments-Arc.md, Audit-47.md): one switch
  for the whole outdoors, no sub-toggles (URL doors are probe doors);
  the classic lane untouched byte for byte; every uniform declared in
  its own template (the AUDIT 47 sweep); the host marks foreign passes
  (EV6, the count pinned); one wind integral for everything that
  drifts; the probes stay green; the floating origin (819.2) reaches
  every world-space field.

## The plan

| Slice | What | State |
|---|---|---|
| **VC1** | THE PIXELATED LOOK GOES. Our dome is the lane's default sky again, smooth by default (`?sky=retro` the door back to ES1e's pixel); the Dynamic Skies mod becomes a choice in the Mods pane (its `Enabled` default false), 1:1 as ever for whoever wants it. Nothing else moves. PS1 (2026-09-12): Mac asked for the pixelated sky back - the dome's retro pass is on by default again behind the Enhanced pane's Pixelated sky switch (`?sky=retro`/`?sky=smooth` still the doors); MO1 the same day put the mod's `Enabled` back to true with every mod's, so the mod's skybox is the lane's sky until its switch is turned off; PS2 the same day took the pixel to the mod's skybox and to the clouds' composite (`render/retroPixel.js`). | SHIPPED 2026-09-07 |
| **VC2** | THE RENDER TARGET AND THE NOISE. `render/renderTarget.js` - a 2D target and a 3D volume, creation under the upload law (it sizes, parameterises and binds no framebuffer), the framebuffer work on named DRAW paths that leave the default framebuffer and the caller's viewport behind and never ask GL. `render/cloudNoise.js` - a 128^3 SHAPE volume (R a Perlin-Worley, the billows dilated by the low-frequency cells; G/B/A Worley at 8/16/32) and a 32^3 DETAIL volume (Worley at 4/8/16), both tiling on every axis (every lattice taken modulo its period), GENERATED ON THE GPU one layer per draw, mipped; the lab's slice viewer (`?noise=`) and tools/cloudNoiseProbe.mjs (10 checks: the volumes draw, are fields, tile with a quiet seam, wrap and vary along z, the octaves rise). No cloud drawn yet. | SHIPPED 2026-09-07 |
| **VC3** | THE CLOUDS. A raymarched cloud slab (base and top altitudes in world units, flat-earth with a horizon curve) rendered NOT per screen pixel but into a SKY-SPACE MAP - an equirectangular hemisphere texture, camera-independent because the clouds are at infinity for translation - refreshed a stripe per frame (a full sweep every N frames) with a per-texel march jitter that is FIXED - a hash of the texel, never the clock, so the dithered banding is stable and needs no temporal blend (the design first promised one; VC3 found the fixed jitter enough and shipped without it); composited over the dome by direction after `sky.draw`, before the world, transmittance in alpha so stars and the sun disc show through the gaps. Shape from the eased row: cover -> coverage threshold, soft -> erosion, grey -> darkness/ambient, lit/shade -> the two light colours, and a per-weather PROFILE (sunny: scattered towers; cloudy: broken; overcast: a low grey deck; rain/thunder: dark, tall, dense; snow: flat grey; fog: a low uniform lid). Motion: the one drift integral moves the domain (same number the ground reads), a slow altitude shear turns the tops. Light: sun with a short light march (Beer + powder), Henyey-Greenstein forward scatter for the silver lining, ambient from the dome's own zenith/horizon colours, EV5's moon term at night, DS1-style flash under thunder from the host's lightning light. The 14 s / front-stretched ease is the ONLY clock the shape reads. | SHIPPED 2026-09-07 - `render/volumetricClouds.js`, the lab drawing them, tools/volumetricCloudsProbe.mjs (9 checks). Seen in the lab: scattered cumulus on a blue noon, a grey mottled lid at overcast, a dark storm, a warm cloudy dusk, an overcast midnight hiding the stars. Left for VC5: the towers' undersides could be darker still and their edges crisper (the erosion's weight), the lid's mottling stronger, the strobe's flash on the clouds unseen (no storm strobe in the lab), a `?clouds=` tier for weak machines chosen by measurement. |
| **VC4** | THE SHADOWS, REAL. A world-space shadow map (transmittance along the sun ray through the SAME slab, a square around the player snapped to the 819.2 pixel grid so a recenter never jumps it) refreshed in stripes like the sky map; sampled by the terrain, the models, the characters and the flats through one shared GLSL block (`CLOUD_SHADOW_GLSL`, now the map and not a noise), replacing the terrain-only noise shadow; the global `sunFactor` dim stands down (the disc dims through the sky map's own transmittance, the ground through its map - one field, no dim on top). The moon casts none. The sky map marches from the camera's own world position, so a walk moves the bank overhead and the shadow under it together; the floating origin's recenters are handed to the clouds (`sky.offsetOrigin`) and both marches sample the field at the ABSOLUTE position (`uShift`, the shifts accumulated - the review's first finding: the periods being whole pixels does NOT make a one-pixel shift invisible, a shift is invisible only when it is a whole number of PERIODS), the shadow square moving with the world and its map kept; a pixel crossing without a recenter (the fixed city) shifts the map by whole texels with a blit and marches only the uncovered strip. The first sky sweep is striped like every other (no stall); the shadow targets start all light and the ground samples nothing before the first march; the studio's sprite borrow and an interior's frame carry no deck. The square is SIXTEEN pixels a side (13.1 km, the near edge 6144 m out, past the far fog): a pixel is a whole number of the map's texels at every tier, which the crossing's texel shift depends on (twelve, tried first, left 0.67 of a texel behind at every crossing - the review). Under a STORM the map is black: a 3.7 km deck at density 1 is 22 optical depths, no direct sun reaches the ground and the row's ambient lights it - the law, pinned by the probe. NOT reached: the grass (its shader is pinned byte for byte to the lab's), the far ring (outside the square by construction - it takes `farSunFactor`, a cover-derived dim on the slab's own coverage law, cover^1.6), the dungeon water. | SHIPPED 2026-09-07 - the probe's five shadow checks (a sunny noon mostly lit with dark patches, an overcast noon dark everywhere, a storm darker still, the morning's map another than noon's, midnight all light) |
| **VC5** | THE CLOSE. The tiers (`?clouds=lo|hi`, `?clouds=off` the kill switch, since VC3) made visible on the lab's panel (a Clouds select and a Shadow-map box that rewrite the query and reload - a tier is a set of targets, not a live knob); the probes grown to fifteen (the sun's disc a compact white disc on the bare noon sky and a glow many times its size under the overcast lid - it dissolves, the forward scatter through the lid; every sky claim paired against a bare-dome shot so it fails with the clouds off; the storm's black map stated as the law; the sun's angle a texel-for-texel picture diff); the pins (all THREE marched programs under the two-way uniform pin, `shadowOrigin` by value, the extent and the whole-texel law per tier); the Ledger row; the adversarial review (below); this page closed. NOT done, said so: the tier choice by measurement - SwiftShader's frame times do not transfer to a real GPU, so the default tier is a judgment (1024x256, 56 steps) and the measurement is Mac's machine's to make; a front building cover over its lead is pinned (the profile eases on the row's own exponential, the front-stretched dt is WIND2's) and not pictured (the lab has no front). | SHIPPED 2026-09-07 |

| **VC6** | THE SECOND PASS, on four reports in one message (Mac 2026-09-18). **(a) THE REPEAT.** "clouds repeat pretty consistently when its partly cloudy" - and it was two numbers: the shape volume tiles every 12288 m and the coverage field that is meant to break it up tiled every 13107 m, seven per cent apart, so the two grids stayed in phase and the same bank came round inside ONE visible sky (the march reaches 24 km). The variation goes to EIGHTY pixels (65536 m), which is also the truer number - how much cloud there is varies over tens of kilometres of land. Its four channels now do four jobs instead of one: R and A two frequencies of coverage, G and B a vector that WARPS the sample's position before the shape is read, so the lattice arrives bent by up to 2458 m and the straight edges the eye locks onto are not there to find. No texture read was added. And the field had only ever had ONE THING TO SAY - one flatness, one ceiling, for the whole zone - so the profile gains `vary`: where there is more cloud there is flatter, deeper cloud, where there is less there are shallow towers with room above them. A lid weather takes 0 and is untouched. CLK1's wrap still holds: every period divides the field's. **(b) THE GOLDEN HOUR.** "in the evening when the sun is setting and the sky is golden, clouds arent influenced by the sun" - the cloud's light died at a sun 2.5 degrees UP, because its window (`sunDir.y + 0.02) / 0.08`) was fitted by eye. It is geometry: a deck whose middle stands 2300 m up sees sqrt(2h/R) - a degree and a half - past the ground's horizon, so it holds the sun until the sun is that far BELOW the player's, and holds it in the ember the palette gives a sun at that elevation. Three terms in the march, every one weighted by how low the sun is and all of them dead at noon: the sky is two colours at dusk (gold toward the sun, the zenith's blue away from it, both taken through a hue() that normalises to luminance one so a tint can never be a brightness cheat); a low sun lights the cloud's SIDE, so the ambient's height ramp rolls from top-lit to whole-lit and the underside is what burns; the direct gain opens 0.7 -> 1.05. The palette joins it: the clouds were a quarter of the way to night at the horizon and only a quarter of the way to the sun's colour. **(c) THE SHAFTS.** "when the sun is covered by clouds, there shouldnt be sky rays or sky rays coming through trees/flora" - the shaft mask was SKY DEPTH ALONE, so a sun behind a bank threw full-strength rays and a canopy cut a hard silhouette out of a beam that should not have been there. A shaft is scattered DIRECT sunlight, and how much of that reaches the player is exactly what the cloud shadow map already holds at their feet: the pass reads it there, squared (a shaft needs a beam). One field, three consumers - the sky, the ground and now the rays - so they cannot disagree. The block moved to its own leaf (`render/cloudShadow.js`) because the air pass cannot import from the renderer that imports it. **(d) THE FRAME.** Free wins, no visual change: `density()` returns before its first texture read outside the band (both marches walk the UNION slab, so under a sunny zone with a thunderhead on the horizon every ray was paying two 3D reads a step over 3700 m of air to be told 0); the sky march strides three times as far after four empty steps and BACKS THE STRIDE OUT on the step that finds cloud, so an edge is never resolved coarsely; the light march stops once exp(-sum) is two parts in a thousand. And a readout, because this session cannot see Mac's GPU: `?perf=zones` breaks the frame into the passes that make it - shadow, world, sky, air - as spans that TILE it (the extension holds one timer at a time, so they cannot nest; each begins where the last ended, and their sum is the frame). | SHIPPED 2026-09-18 - 9 pins at test/vc6_clouds.test.js, `tools/mutants/vc6.json` (45 dead), `tools/vc6ShaftProbe.mjs` (6 checks on a real GPU), and the arc's own 15 picture checks still green. **THREE THINGS THE GATE COULD NOT SEE, AND A PROBE DID.** (1) `flat` is a RESERVED interpolation qualifier in GLSL ES 3.00: heightGradient's new parameter took the whole sky down at boot, and every pin passed. (2) The warp at three pixels FOLDED the lattice - its own field's features are the variation volume's ~2 km Worley cells, so an amplitude of 2458 m is larger than the gradient it rides, q -> q + A*f(q) stops being one-to-one, and the sky grew a smeared fan at the zenith that the bare field never had; one pixel, chosen against the same shot on the tree before the change. (3) The deck reached the shafts as NULL every frame of the real game: `beginFrame` clears the deck (a deck is a frame's) and `prepare` runs inside beginFrame, while both exterior hosts set the frame's deck AFTER beginFrame returns - so the gate could never have fired. It is read at the RESOLVE now, with the cleared deck held exactly long enough for an image the pass still owes. No pin could have caught any of the three: the pins drive no frame and compile no shader. **THE AUDIT (2026-09-18, after the slice) FOUND TWO MORE, BOTH MINE.** (4) `uLightDir` IS NOT ALWAYS THE SUN - once the sun is down it is the brighter visible MOON's, and VC6b's `low` was a smoothstep on it, so a moon near the horizon read as 'the sun is low': it lit the undersides at midnight, opened the direct gain and tinted half the sky, a swing that came and went as the moon crossed seventeen degrees, driven by the wrong body. The weight is a pure CPU law now (`duskWeight(sunY, dayWeight)`, the SUN's own direction and the SUN's own weight), uploaded as `uDusk`, and is exactly 0 at night - so the whole of VC6b is off and a night sky is the one it was before the slice. (5) `hue()` on a colour with no light in it answered `c / 1e-4`, a BLACK tint, which would have darkened the cloud it was asked to colour; it answers white, the tint that changes nothing. Both pinned by value. The audit also found one of its own mutants re-aimed WRONG - the replacement truncated `&& world)` and made a syntax error, so it was dying for a reason that was not its law. **MEASURED, not asserted:** VC6d's stride changes no picture - the sky read back with the skip on and with it forced off is BYTE-IDENTICAL under cloudy and thunder (a dense sky never strides) and differs by a mean of 0.06 of 255 levels under sunny, with 0.4 per cent of channels off by more than two, which is the dither's own jitter at a cloud's edge. NOT measured: the frame's win is Mac's machine's to see - that is what the zone line is for. |

## The adversarial review (Opus, four reviewers, verified per finding)

Run against VC1-VC4 at `e98f6cce`; every finding verified by a second
agent against the tree as it stood when the verdict was written, which
by then carried the fixes - so every first-round verdict reads
"refuted: stale, the fix is at HEAD". What the reviewers found and the
tree took (VC4b-VC4e):

- **CONFIRMED, HIGH - the floating origin.** A recenter slid the whole
  field 819.2 m over the land: the periods being whole pixels does NOT
  make a one-pixel shift invisible (a shift is invisible only when it
  is a whole number of PERIODS). Answered by `sky.offsetOrigin` and
  `uShift` - every sample at the ABSOLUTE position, the shadow map
  kept across a recenter, a pixel crossing a whole-texel blit (VC4c).
- **CONFIRMED - GL.** `ONE, SRC_ALPHA` on the alpha channel too left
  the buffer's alpha at 2T (`blendFuncSeparate`, the alpha untouched);
  a `gl.clear` on the shadow targets made the renderer's JS shadow of
  the clear colour a lie (the targets are born all light by UPLOAD);
  the lightning flash rode the march and lit one stripe (moved to the
  composite, the whole sky for the frame); the deck's rect was
  published a frame before the crossing's blit (`mapOrigin`, the corner
  the map HOLDS).
- **CONFIRMED - the field.** The sun's light popped to the moon's at
  the horizon (`cloudLight` fades the sun's weight over its last
  degrees); a low sun's long slant through the shadow slab was
  undersampled (the steps follow the path, no coarser than 150 m); the
  32 km far clamp blanked the bottom degrees of the deck in a rim of
  bare dome (the clamp is on the marched SPAN, the aerial fade takes
  the rest); the far ring stood unshadowed beside a shadowed terrain
  (`farSunFactor`, a cover-derived dim on the slab's own law); the
  `?clouds=` door's `in` walked the prototype (`Object.hasOwn`).
- **CONFIRMED - the pins and the probe (the docs-pins reviewer).** The
  shadow march was the one program outside the two-way uniform pin
  (a renamed uniform is a silent no-op: a null location); `shadowOrigin`
  had no pin by value; the map shots were measured over half the map;
  two sky checks and the dusk floor passed with the clouds off; "a
  storm's darker still" could not tell a graded shadow from a black
  map; the sun's-angle check degenerated to "not bit-identical"; Home
  still said the mod was on by default; Home's VC5 clause restated
  VC3/VC4 and named surfaces the arc says are not reached; Port-Status
  section-A ordinals were one behind; the Ledger and Rendering.md said
  eight pixels after the extent moved. All taken (VC4e). One of them
  exposed a real bug in the extent change itself: TWELVE pixels a side
  was not a whole number of texels per pixel crossing at any tier,
  and the crossing's blit left 0.67 of a texel behind - SIXTEEN, and
  the whole-texel law pinned per tier.
- **CONFIRMED, after the close (the seam reviewer, the one finding of
  thirty-three that survived the skeptics against the closed tree).**
  `renderCharacterSprite` borrowed the fog off for its lens-local
  callers and not the deck: the first-person arm is drawn at the ORIGIN
  of a private lens space, so it read the cloud over the corner of the
  player's pixel (up to a kilometre away) and stepped in brightness at
  every recenter while nothing else in the picture did. The deck is now
  borrowed off under a `lensLocal` flag the arm passes; the world-space
  callers (the rig sprite box, the third-person arm) keep it, as the
  design row says the characters do. Pinned.
- **REFUTED.** The construction-time noise pass marks no foreign pass:
  no renderer entry point runs between the sky's construction and the
  first `beginFrame`, which resets the EV6 shadows (a comment records
  it). Testing.md's suite line "nine tests short": the manifest's law
  counts `test(` calls (6575), node's `# tests` line counts subtests
  too (6584) - the line follows the manifest, and the skeptics found
  the change breaks both the manifest and the landing pins. The
  first-frame stall (a full sky sweep) was gone before the review ran.

## Residue (honest, for whoever opens this next)

**VC6 (2026-09-18) settled three of these and added one.** The look
knobs VC3 left ("the towers' undersides darker, their edges crisper,
the lid's mottling stronger") are answered by the type variation and
the warp rather than by turning them - the sky had one cloud in it, and
a knob would have made one cloud look different, not made several. The
tier choice by measurement is still Mac's, but `?perf=zones` now tells
them which pass to spend it on. NEW residue: none of VC6 has been seen
on a real GPU either - the golden hour's three terms, the warp's bent
lattice and the empty-space stride are all arithmetic that a pin can
check and only an eye can judge, and the stride in particular changes
WHERE the field is sampled (never how), so a cloud whose edge lands
inside a backed-out stride is the one thing to look at first.

- Not seen in a real browser on a real GPU, and not with ARENA2: the
  lab's pictures are SwiftShader's, and the world hosts' shadow on the
  terrain, the models, the characters and the flats has been pinned
  and probed as a map, never looked at on the ground. The first thing
  Mac's eye will judge.
- The tier choice by measurement is Mac's machine's to make (above).
- The strobe's flash on the clouds is unseen (no storm strobe in the
  lab); the towers' undersides, the edges' crispness and the lid's
  mottling are taste knobs (`VC_PROFILE`, the erosion's weight).
- Not reached: the grass (pinned byte for byte to the lab's shader),
  the far ring (a cover-derived dim, not the map), the dungeon water.
- The zenith seam of the equirectangular map is handled by direction
  and unverified above pitch 78; no temporal blend (the fixed jitter
  was enough).

## Design decisions, and why

1. **Our dome, not the mod, is the base.** The mod's shader is a 1:1
   translation whose uniform set is pinned; its cloud layers cannot be
   switched off without editing its presets, and its look is the
   pixelation Mac named. The dome is ours to extend, already carries
   the scattering, the moons, the stars and the shadow deck, and the
   ease and the front already drive it. The mod stays 1:1 behind its
   switch, clouds and all; the new clouds do not draw under it.
   **DS2 (2026-09-08) reversed the last clause on Mac's word** ("the
   procedural sky mod doesn't apply our enhanced clouds"): the clouds
   ride the lane, the mod's sheets stand down under them, `?clouds=off`
   restores them - `07-Rendering/Dynamic-Skies.md` DS2.
2. **A sky-space map, not a per-pixel march.** Clouds are at infinity
   for translation, so a hemisphere map is camera-independent: the
   march can be spread across frames without reprojection, the
   resolution is decoupled from the screen, and a turn of the head
   costs one bilinear sample per pixel. The price is a fixed angular
   resolution (chosen so a texel is under the dome's old pixel) and a
   seam at the zenith the composite handles by direction.
3. **One field for the sky, the disc and the ground.** The shadow map
   and the sun occlusion are the SAME density function the map
   marches, on the same drift integral, so what darkens the ground is
   the bank overhead's projection. That is the "real" in Mac's ask.
4. **The ease is the clock.** No new weather state: the eased row
   (already stretched across the front) is what the shape reads, so
   the clouds build at the pace the rain, the wind and the ground
   already keep.
5. **No new toggle.** It rides Enhanced Environments, as the law says;
   `?clouds=off` is the kill switch.
6. **Cells (WEATHER2c).** The one field takes cells - a place, a
   radius, a rim and a profile of their own, blended over the zone's
   terms at every sample both marches take under a union slab (each ray's own spans since SLAB-SPAN) - so a
   thunderhead stands over the hills under a sunny zone and its shadow
   falls where it stands. The Weather arc's C
   (`07-Rendering/Weather-Arc.md`); `?cloudcell=` the door.

## VC7 - more immersive (the design, 2026-09-23)

Mac, alongside WEATHER3i: "I really want to improve the volumetric cloud
system to be more immersive." Asked which kinds, the answer was "All of
the above": living clouds, light shafts, rain shafts under storms and a
high cirrus layer. Each is a slice of its own, shipped with pins,
mutants and before/after renders from the sky lab (`sky.html`, SwiftShader
here, since there is no ARENA2 in the container).

**What the lab showed before.** A fair morning reads well. A cloudy
afternoon is a soft even blur, dusk an even cotton mottle, and a storm a
flat dark lid with no structure. Nothing ever changes shape: the field is
a fixed noise volume slid across the land by the wind integral, so a bank
is the same bank from the moment it comes over the horizon until it
leaves.

### VC7a - living clouds

- **They change as they pass.** Two clocks, both read from the game's
  minutes (AUDIT-VC7: so every player online sees the same boil; the cover's
  drift, like the whole field's, rides the session's own wind integral):
  - the shape volume is read through its own height as time passes, so
    the towers' structure rises through the cloud and the edges billow
    rather than slide;
  - the coverage field drifts at a fraction of the wind, not with it, so
    a place's cover changes under the air moving through it: banks build
    on the upwind side and dissolve on the downwind side as they travel.
  Both clocks wrap to the field's own periods, as CLK1's drift does, so a
  year of game time never outgrows a float.
- **The day's convection.** Fair-weather cloud (the sunny and cloudy
  rows) builds through the day: flat cumulus in the morning, towering by
  mid-afternoon, sinking through the evening to the night's floor. It lives in the towers' HEIGHT; the
  cover stays DFU's row. The first cut also redistributed the cover over
  the day (its daily mean kept), and the lab showed why not: this slab's
  scattered cumulus sits right at its coverage threshold, and a fair
  row's cover raised by a tenth turned the afternoon into a smeared haze.
- **A front thickens as it arrives.** A weather-map cell's cloud takes
  its system's envelope: a newborn front is a thin deck that deepens and
  darkens as it grows, and a dying one thins. The same numbers already
  drive the rain under it (WEATHER3i), so the cloud and the fall agree.
- One field still: the ground's shadow and the sun's disc read the same
  density, so a billowing bank's shadow billows with it.

**VC7a shipped (2026-09-23).** Pinned by `test/vc7a_living.test.js`
(`tools/mutants/vc7a.json` 22/22 dead).
- The sky state carries the game's minute (`skyState` `minutes`,
  `minuteOfDay`), and `cloudClocks` reads the three clocks from it: the
  shape read up its volume 120 m a game minute (an updraft's 2 m/s), the
  detail 300 m, and the coverage turning through its slice once a day,
  riding COVER_DRIFT_SHARE (0.6) of the air's drift. Every offset is
  wrapped to its own volume's period. The lab's `?t=` steps the clock at
  one sun, so the life can be watched apart from the day.
- In the lab, a cloudy afternoon sampled 20 and 40 game minutes apart
  reshapes rather than slides; a fair morning's arrangement reads as
  before.
- The day's convection is in the towers' HEIGHT only: `convection`'s
  depth runs from 0.4 of the row's through the night and the morning to
  the whole row CONVECTION_LAG_MINUTES (150) after the sun is highest
  (14:30), and sinks through the evening to the floor again by 20:30
  (AUDIT-VC7: it holds the floor until 8:30). The first cut also moved the cover (its daily
  mean kept); the lab showed a fair row's cover raised by a tenth smeared
  the afternoon into haze, and a cut with the boil off pinned the smear
  on the cover, not the boil. So the cover is DFU's row at every hour.
- A weather-map cell carries its system's envelope (`skyCells` `env`),
  and `cellOfField` grows its cloud by it (`grownCell`): at birth half
  the cover, 0.45 of the depth and 0.7 of the density, the whole profile
  at full growth.
- Seen and not changed here: a cloudy sky reads as a soft even blur and a
  storm as a flat lid, as they did before VC7. That is the slab at high
  cover and the sky map's texel (about five screen pixels at a 65-degree
  view), not the life; it is recorded for Mac as its own question.

### VC7b - light shafts

- **Through the gaps.** EL3's screen-space shafts take the sky mask from
  the depth alone, and VC6c turns them off when the deck covers the sun.
  The mask will carry the cloud map's own transmittance, so broken cloud
  in front of the sun throws beams through its gaps and a solid deck
  throws none, without a switch.
- **In the haze, away from the sun.** Shadow shafts slanting under a
  broken deck are seen from any direction, not only toward the sun. The
  world's fog gains an in-scattered sun term marched a few steps along
  the view ray through the air under the clouds, each step reading the
  same shadow map the ground reads (a point at height y sees the sun
  through the slab where its sun ray meets the ground). Where the sun
  reaches the air it glows; where the bank shades it, it does not. It
  scales with the air's haze (humid weather, low sun) and is off indoors.

**VC7b shipped (2026-09-23).** Pinned by `test/vc7b_shafts.test.js`
(`tools/mutants/vc7b.json` 33/33 dead), and drawn on a real GPU by
`tools/vc7bHazeProbe.mjs` (12/12), which is where the look is judged -
the pins run on a fake GL that draws nothing.
- **The beams through the gaps.** The deck the ground reads now carries
  the sky map too (`VolumetricClouds.shadow` `sky`, once a sweep has
  filled it), and EL3's mask reads its alpha - the slab's transmittance -
  in each tap's world direction, by the composite's own parametrisation.
  With the player in full sun, a sky map that is all gap leaves the beams
  exactly as they were, all cloud takes them away, and one half cloud in
  stripes leaves beams between the two (AUDIT-VC7: "half" was never
  measured). The alpha is the slab's, the curtains' and the ice's. VC6c's gate is untouched: Mac's "when the sun is covered by
  clouds, there shouldnt be sky rays" still decides first.
- **The sun in the haze.** `airPass.js` walks each shaft pixel's view ray
  AIR_HAZE_STEPS (12) jittered steps out to AIR_HAZE_REACH (3000 m); each
  step's sun is the cloud shadow map read where its sun ray meets the
  ground (the map's own ray), dimmed by the fog's own extinction (the
  lane's `scatterDensity`, handed over as `haze`) and weighted by a
  Henyey-Greenstein phase (g 0.6, a 0.3 isotropic share). VOL1's
  depth-aware tile averages the jitter into the shafts' image the resolve
  already adds. It runs only with a deck, the sun above the shadow map's
  own floor (0.05) and a fog with an extinction - so never indoors, never
  on the classic skin - and `?haze=off` shuts it.
- **Measured on the probe**, under the clear day's own fog (linear to
  2400): a solid deck leaves no haze; lanes of cloud shadow swing the air
  48% against a lit deck's image, pixel for pixel (0.0% for the lit deck
  against itself); toward a low sun the same air is fourteen times as
  bright as away from it. AIR_HAZE_GAIN (1 of the colour at the probe's key
  of 0.9; AUDIT-VC7 made it a share of the key, 1/0.9) was chosen against 0.5 (the
  lanes all but invisible), 1.5 (over-bright toward the sun, where the
  dome's glow and the beams already are) and 3 (the sky toward the sun
  white). The term is additive, so the lit-against-shaded contrast can
  never exceed what a fully lit day adds - a forward glow about the sun.
  Near ground takes little of it by construction (a short ray through thin
  haze scatters little), as the world fog leaves near ground clear.
- **Found on the way: VC6c's probe never drew its scene.** It described
  its mesh's sub-mesh as `{ archive, record, start, count }`; the renderer
  reads `{ textureArchive, textureRecord, startIndex, primitiveCount }`
  (tools/aoProbe.mjs has it right), so its ground and its pillar were
  never drawn. Its "the ground moves with the rays" check was reading the
  clear colour (177 / 174 / 174), moved only by the eye's adaptation. With
  the fields named, the scene draws and the check measures what it says
  (115.7 > 90.3 > 49.6); the other five checks held either way. VC6c's
  probe now sets `?haze=off`'s door, so it measures the beams alone.

### VC7e - cloud detail: the cloudy blur and the flat storm lid

Mac, on the question VC7a raised (a cloudy sky an even blur, a storm a
flat lid): "Whatever is the most visually detailed and immersive."

**Measured first.** The sky lab, with the march's first-hit optical depth
along the sun painted into the sky map: an overcast deck ran 0.56 to 0.80
across the whole view, a storm 5.1 to 6.3, a cloudy sky 0.56 to 1.3. The
3D noise averages out up a column, so a deck was the same thickness
everywhere - no lighting could draw structure that was not in the field -
and Beer's law alone, exp(-5) against exp(-6), made every point under a
storm the same black. The first try (the octaves below, un-normalised)
proved it: the whole sky brightened and no structure appeared.

**VC7e shipped (2026-09-23).** Pinned by `test/vc7e_detail.test.js`
(`tools/mutants/vc7e.json` 19/19 dead).
- **The deck's cells.** `columnAt` - everything density() knows before the
  shape read, now one function - takes the 32-cell Worley of the
  variation sample (two kilometres a cell, a stratocumulus's own size, and
  the same at every height, so it shapes whole COLUMNS) and thins the
  lanes between cells: the base lifts CELL_BASE_LIFT (0.07) of the band
  and the ceiling comes down CELL_THIN (0.55), scaled in with the cover
  (DECK_COVER 0.4 to 0.95). A lane keeps 45% of a core's depth: the cut
  that kept 20% went transparent in the lanes and opened holes to the
  dome under the overcast and the storm.
- **The octaves.** The sun's light through the deck is Wrenninge's
  multiple-scattering octaves: octave 0 the single scattering it always
  was, two more carrying half and a quarter of the light at 0.35 and
  0.1225 of the depth, their phase flattened halfway to isotropic
  (AUDIT-VC7: octave i by MS_C^i, the law the docstring named), the
  sum divided by 1.75 so no depth outshines an unshadowed path. At a
  storm's depth the single term is under 0.003; the octaves carry over
  twenty times that, and a thin place stays visibly lighter than a thick
  one. The light march stops where the last octave stops seeing.
- **The ambient through the column above.** The sky's light on a cloud
  comes down through the column over it (`columnAbove`, from the same
  `columnAt`), never along the sun's path - the first cut used the sun's
  depth, and at dusk that path runs sideways through kilometres of deck
  and blackened the gold VC6b gave it. It is weighted by the same deck
  amount, so a fair sky (none of it) and a cloudy one (under a fifth)
  keep the looks they were tuned with (AUDIT-VC7: the octaves were not
  weighted so, and brightened every fair cloud - they are now); its floor (0.15) sits under a
  storm core's light, where 0.35 had erased the contrast.
- **In the lab**: rain rolls dark and heavy with lighter gaps between; a
  storm has darker cores in the lid; an overcast has bands; a fair sky
  and a low sun's gold are what they were.

### VC7c - rain shafts

- A raining or storming cell hangs a curtain from its base to the ground:
  density that falls off toward its rim, streaked vertically and moving
  with the cell, in the same field both marches read. From afar it is a
  grey veil under the storm, where the weather map puts it; it fades as
  the player comes under it, where the falling rain itself takes over.
- Only what falls hangs one (rain, thunder, snow; a sandstorm is already a
  wall on the ground), with its intensity from the same law as the rain.

**VC7c shipped (2026-09-23).** Pinned by `test/vc7c_curtains.test.js`
(`tools/mutants/vc7c.json`). Two departures from the plan, both measured:
the curtain is ANALYTIC in the sky march alone, not a density in the field
both marches read (a ray against a cylinder costs arithmetic, a field
sample two texture reads, and the cloud above already shadows the ground
under it); and it is composited IN FRONT of the slab along the ray, since
it hangs below it.
- **The veil.** A cell whose word falls (`CURTAIN_FALL`: rain 1, thunder
  1.3, snow 0.7 and pale) hangs a cylinder of CURTAIN_SHARE (0.55) of its
  radius from the ground to its base. Its extinction is rain's own:
  Koschmieder's 3.0 over moderate rain's five-kilometre visibility, 0.0006
  a metre. The first cut took a fifth of that, and a storm's curtain was a
  smear on the horizon; at the real value a thunder core's chord passed
  under a twentieth (AUDIT-VC7: a tenth, once the chord is the integral of
  the declared profile, not the core's weight at its closest approach for
  its whole length), which is why a real shaft reads from thirty
  kilometres off. It thins to its rim, fades as the eye comes under it (the falling
  rain takes over there), and takes its own aerial perspective (40 km; the
  slab's 14 km handed three quarters of a far storm's curtain to the
  horizon). A system's rain is as grown as its cloud (`grownCell`).
- **The detail.** Streaks around the axis in two octaves, the shafts and
  three fibres to each, every octave faded to its mean where the sky map's
  texels could not hold it (so a far curtain on the low tier keeps its
  shafts and loses only its fibres, never shimmering). The rim's streaks
  stop short of the ground, each by its own amount - 0.6 of the base on
  the average at the rim, 0.9 at the most (virga); the core's reach it. The curtain rises CURTAIN_INTO (0.12) of
  its cell's depth into the cloud and thins to nothing there: a cloud's
  visible underside sits above its nominal base, and a curtain cut at the
  base left a strip of sky between the rain and the cloud it fell from.
- **Every row.** The march's two early rows (the horizon's own, and past
  its reach) answer through the same `underCurtains`, so the rain meets
  the ground instead of stopping a quarter-degree above it.

**FOUND ON THE WAY: VC7e BROKE VC6d's STRIDE.** A fair sky with a rain
cell showed specks of blue in the cloud's crown, a few before VC7e and
dashes of them after. Forcing the stride off removed them; a bigger step
budget did not. VC6d strode three steps on any zero, measured safe on
2026-09-18 because every zero then held for a stride. Three did not:
- VC7e's deck cells lift a lane's base and lower its ceiling every two
  kilometres, so a ray above a lane strode over the core beside it.
- A cell's rim blends its base, top and type into the zone's.
- The height ramp's foot (a tower's to 0.08 of its band, a lid's to 0.12)
  grows as the ray climbs, and every ray of the sky map climbs.
`density()` now says whether its zero holds (`fSkip`). It is always a
stride outside the band, except where a cell's rim is within one
(`resolveAt` flags it, `fReach` the march's own stride). It is never a
stride under a lane's lifted base, and never over a lowered ceiling where
anything moves. Under the coverage cut it strides only by SKIP_ROOM
(0.02), read on the shape BEFORE the height ramp wherever the ramp can
grow (a lid's thin top reads far under the cut where the shape itself is
not). And only a stride is backed out. Against the sky marched with no
stride at all (the lab, 960x540, pixels off by more than 8 levels; the
march's steps as a share of the no-stride count):

| sky | VC6d's stride | always the raw margin | **VC7c** |
|---|---|---|---|
| a rain cell under a fair sky, low | 1301 px (170 over 24), 0.48 | 85 px, 0.66 | **23 px (none over 24), 0.50** |
| a fair sky | 2 px, 0.66 | 0 px, 0.90 | **0 px, 0.66** |
| cloudy (a deck: it never strides) | - | - | **0 px, 1.00** |

The picture is the no-stride sky's, and the fair sky keeps VC6d's saving.

### VC7d - a high cirrus layer

- A thin layer of ice cloud at 8-10 km, far above the slab: a single
  sample per ray where the ray meets its altitude, from the noise volumes
  stretched along the wind into streaks, lit thin and bright in forward
  scatter.
- It uses VC6b's horizon dip at its own altitude, so it keeps the sun's
  colour for minutes after the deck below has gone grey: the last colour
  in a sunset sky.
- Fair and cloudy skies carry it; an overcast lid or a storm hides it
  behind their own cloud.

**VC7d shipped (2026-09-23; Mac: "Let's do the not done yet before we
merge").** Pinned by `test/vc7d_cirrus.test.js` (5 tests;
`tools/mutants/vc7d.json` 34/34 dead).
- **The shell.** One sample per sky-map texel, where the ray meets a sphere
  CIRRUS_ALT_M (9 km) up. It uses the stable root (no cancellation at the
  zenith), so the layer runs out to its own horizon 339 km off, where a
  flat earth ran to infinity, and fades into the haze over 120 km. It sits
  behind the slab along the ray, so a deck or a storm hides it by itself.
- **The jet, not the wind.** The first design laid the streaks along the
  surface wind. Its turning would have swung the whole field about the
  world's origin: a kilometre of slide for every half-degree. The streaks
  lie along the westerly jet instead, which is what upper air at these
  latitudes does whatever the surface wind is up to. They ride east on
  the game's clock at five times a fair day's surface drift (71 m a game
  minute, derived), so every player sees one ice sky. Every tile the ice
  reads divides the field's period (the floating origin's wrap, and now
  the jet's), so neither moves a streak.
- **Wisps, measured by eye four times.**
  - As parallel stripes of Perlin-Worley cut by the cover it was a sheet
    from horizon to horizon, its fibres aliasing to a dotted grain.
  - With patches and a bend it became marbling: dark contour lines round
    every streak. There were two causes. The cell borders of the
    Perlin-Worley are thin low valleys, and stretched 8:1 they read as
    cracks. And the veil, lit by the forward lobe alone, came out darker
    than the blue away from the sun.
  - As the fbm's ridge it drew every contour, so it was still marbling.
  - What shipped: a slow round patch field (the field's period) decides
    where the high air holds ice, and the cover sets how much. Inside a
    patch, wisps stand where the smooth fbm of the stretched volume (16:1,
    a mip soft) is in its upper tail. A gentle bend (2.5 km over ~49 km)
    curves them like mare's tails, and faint striations run down each
    one.
  - The light: a share of the sun follows the ice's hard forward lobe
    (g 0.7), the rest is isotropic, and the lit cloud colour is the sky's
    light on it. So from any side it is brighter than the blue behind it,
    which is pinned per channel.
- **The ice's own sun.** `cirrusLight` is cloudLight at 9 km, which sees
  3.04 degrees past the ground's horizon. It takes the palette's sun at
  the elevation the ICE sees it: the player's elevation plus that dip. At
  a sun 1.5 degrees down, the deck is out (dark mauve cumulus) and the
  streaks are still gold against the blue: the last colour in the sky,
  lit about 12 game minutes after the deck goes out.
- **In the lab.** At noon, sparse long white streaks curve east-west with
  blue between them. At dusk they are gold over a mauve deck. Under a
  cloudy deck they show only where it is thin, and at night there is
  nothing but stars.

### AUDIT-VC7 - five lenses over VC7a/b/c/e and WIND5, every finding paid (2026-09-23)

Mac asked "Is this ready?"; it was not - VC7d unbuilt, VC7 unaudited, never run in the game - and Mac: "Let's do the
not done yet before we merge". Five lenses read VC7a, b, c, e and WIND5: what a change reaches, what it broke, the
shaders' cost and portability, whether the pins derive, and whether the record says true things. Every finding below
was verified, paid at its root, pinned, and killed as a mutant (`tools/mutants/auditvc7.json`).

**The pins were the biggest finding.** Every old mutant died (230 of 230) because each record replaced the very line
a pin quoted; of 41 new mutants written against the lines AROUND the quotes, 35 survived, 31 of them real - a curtain
with Beer's law halved, a haze looking backwards, a wisp's curl dividing by zero for the sand. The fix is a tool, not
more quotes: `test/glsl.mjs` evaluates GLSL ES 3.00 in JS (types, swizzles, uint wrap, out parameters, fp32 on
request), and `test/cloudSky.mjs` hands it the march with cells packed by the source's own `packCells`. The laws now
run on the shader's OWN functions:
- the curtain's transmittance is exp(-tau) of a brute-force integral of its declared density (exact on a circle; on
  lobed outlines and clips within the quadrature's measured 2.4%), the veil's colour its tint over what it absorbs,
  its fade taken at the near entry, the chord toward the cell and still met at twenty kilometres;
- the octaves are Wrenninge's definition written out independently, at every depth, phase and deck weight;
- a stride's zero holds for every column a stride can reach (lanes and cores at one variation, 50 m apart over the
  stride), and a rim is flagged wherever the profile moves within one;
- the haze's phase integrates to one and peaks at the sun, its march covers the ray to the surface, its ray is the
  pixel's own, the key scales it, the eye's height moves nothing, the map's edge holds;
- the wisp's path is the shader's `swirl`, its ribbon square to the eye ray and the path, its pen and its ink read
  through both main()s, and its clock wraps whole.

**What the shaders got wrong, and what changed.**
- **(B1) The octaves brightened every fair cloud** - VC7e's claim "a fair sky unchanged" was false (+29% at depth
  0, a golden hour's chroma down 29%). The octaves are a DECK's: `lightOctaves(tau, phase, deck)` weighs them in by the
  deck weight, and a fair sky takes exactly the single scattering it was tuned with. Each octave now takes its own
  flattening (MS_C^i, the documented law - the code had one shared halfway flattening). The light march stops at
  exp(-6) of whichever term sees furthest there.
- **(B3) Fog and a sandstorm got lanes.** The deck weight ignored the type variation, which is 0 exactly for the two
  weathers that are one thing everywhere. `deckWeight()` - one function for the lanes, the stride's evidence and the
  octaves - eases in over DECK_VARY_FULL, the least vary any varying row takes (0.15, derived).
- **(G1, R4) The stride's evidence was a blanket.** Any cover over 0.4 held every step to the fine walk (+36 to 65%
  steps, no picture change), and every point inside a cell was "near a rim". `columnAt` now returns the SPAN a
  column's height can take between a lane's middle and a core (monotone in the cells' weight between them): over the
  profile's end a stride holds only if the span's foot is over it too. `resolveAt` flags a cell only where its weight
  can change within a stride - its own rim or its clip's - asking the outline itself (`rimReach`: the bearings a
  stride's disc spans, the outline's reach moving at most `shapeTurn` a radian, a rigorous bound from the shape's
  harmonics). **Found by the new law, not by any lens:** under the band a stride could climb into it and skip the
  band's lowest cloud; a stride there now holds only more than a stride below it. And density() starts every call
  at "no stride": only a branch that proves its zero vouches.
  **Measured, against the sky marched with no stride at all** (the lab, 960x540; the march's steps as a share of the
  no-stride count):

  | sky | pixels off by more than 8 levels (by more than 24) | steps |
  |---|---|---|
  | a rain cell under a fair sky, low | 50 (0) | 0.82 |
  | a fair sky | 0 | 0.62 |
  | cloudy | 0 | 0.96 |
  | overcast | 0 | 0.98 |
  | a storm cell under a cloudy sky | 0 | 0.90 |

  The picture is the no-stride sky's. The lens's "+36 to 65% steps" was measured against a stride that skipped cloud;
  a deck's lanes really do move within a stride, so what a deck can safely skip is small (2 to 4%), and the rain
  view gives back some of VC7c's saving (0.50 then) to the band the stride may no longer climb into blind.
- **(R1, B4, G4, G5) The curtains.** They ignored the cell's outline and its clip - 70.7% of a thunder curtain's area
  hung outside its front's rain core. The veil is now an integral along the ray of its density across the ground (the
  cell's own shape, inside its clip) times its weight up the column, by Simpson's rule over VEIL_PANELS (16) panels a
  piece, cut at the base. The old chord took the core's weight at its closest approach for its whole length - 3/2 of
  the declared profile's integral; the integral is the declared one now, so a thunder core's axis passes a tenth,
  not a twentieth. The ray is cut where the slab begins: the veil before it is laid over everything, the veil past it
  goes in at its depth among the slab's lit samples (it had been composited over a nearer low deck). The streaks'
  lattice is an integer hash (GLSL ES 3.00 defines unsigned wrap; a sine's large arguments are each GPU's own), and
  the bearing is taken only where the eye is off the axis (atan(0, 0) is undefined).
- **(B6, B7, R2, G2, G3) The haze.** It took the sun's COLOUR, never the key's scale - 10x the ground's light at 06:30,
  full under a storm's dimmed sun; it takes the key now, the gain retuned to the probe's own key (1/0.9). A low sun's
  ray meeting the ground past the shadow map read full sun; it reads the map's edge. Its height was the world's y; it
  is the height above the eye the maps are drawn from (no jump at a vertical recenter). The depth sampler was lowp by
  default (fp16 depth on mobile) - highp now, for every pass that reads it - and the depth and sky-map reads in the
  mask's loop take level 0 by name (no implicit derivatives under a branch).
- **(R3) A front passing jumped the tops a kilometre**: the convection was chosen by the target word and applied to the
  eased profile. How fair the zone is now eases on the profile's own span.
- **(G6) The wisps' clock** was the page's seconds in a float32 - a day in, a life's phase stepped by half a frame's
  advance. Every rate is now whole cycles over WISP_CLOCK_PERIOD (400 s) and the host hands the clock wrapped.

**Decided, not changed: (B2) the lanes shadow the ground.** The deck's lanes are cloud structure, and the one field
the sky and the ground's shadow read is this renderer's law (the sky you see is the cloud you stand under). Measured:
under a rain deck the direct sun reaching the ground rose from 3.7% to 12% on the average, an overcast's by 37% - the
light patches under a broken deck. Recorded here for Mac; a rain deck darker underfoot is a tuning of the rain row,
not a second field.

**The record, corrected.** Virga reaches up to 0.9 of the base at the rim (0.6 on the average), not "up to 0.6";
VC7e's depths were 5.1 to 6.3 along the sun (not "2 to 6"), and an overcast's 0.56 to 0.80 (not "a tenth"); a calm
draws 19 wisps (not "a couple of dozen", nor "~52"); a wisp is a 40-segment ribbon (not "a thin quad") and its alpha
1.6 times the look's; the sky map's alpha is the slab's, the curtains' and the ice's transmittance; a sky map half cloud in
stripes leaves the beams between all and none (not "half" - unmeasured); the boil is the game clock's and the same
for every player, but the cover's drift rides the session's own wind integral (WIND2), so "every player sees one
sky" is true of the boil and the ice, not of the cover.

WISPS-RETURN (2026-09-25, `Rendering.md` WISPS-RETURN) retired WIND5's ribbon: a wisp is a thin quad again and its
alpha the look's own (no 1.6), and a calm draws 10 since DISC17-A. The wisp law above - `swirl`, the ribbon, the pen
and the ink - went with it; the clock (G6) stands, pinned in `wind3_windworld.test.js`.

**In the game (2026-09-23).** The last of "the not done yet": the sky run in the real game, Daggerfall city, with
the player's own ARENA2 (SwiftShader, so pictures and relative cost only). Noon sunny, a storm at 16:00, rain at
11:00, golden hour at 17:20, dusk at 18:10 and an overcast at 13:00, each looking four ways. Three things came out of
it; the first two were bugs of this branch and are paid, the third is older and recorded.
- **The `?cloudcell=` door never stood in the game.** setState took the door's cell only in place of the host's list,
  and the game hosts always hand one (the map's, empty in clear air), so every curtain scene showed clear sky. The
  door's cell now joins the host's list (a behaviour test on the class; the old form a mutant in `auditvc7.json`).
  With it, the storm and its curtain stand where the door puts them.
- **SLAB-SPAN: a cell anywhere lowered every ray's slab.** Both marches walked the UNION of the zone's slab and every
  cell's (WEATHER2c). One low cell - a rain cell 14 km east, under a cloudy zone - started EVERY ray at its base, and
  at a grazing angle the sky march's 24 km ran out in the air under the zone's deck: a strip of bare dome round the
  whole horizon, saturated blue in every direction, where the cell was nowhere. WEATHER3 puts cells in most skies, so
  this was the common case, not a corner. The shadow march paid the same way, in coarser steps under a storm's
  union. Now each ray finds its OWN slab (`raySpans`, in the field both marches share): the zone's slab along the ray,
  and each cell's column where the ray is inside the disc its outline can reach, between the lowest base and the
  highest top its weight can blend a column to; sorted, merged, disjoint. The sky march walks the spans' first 24 km
  and jumps the air between them (no step spent); the shadow march lays the spans end to end under the midpoint rule.
  The aerial perspective followed: it was keyed to the ray's one entry, and a ray through a cell's empty outer disc
  entered near and faded the deck 80 km behind it as if it were near - a pale block the shape of the disc. Each
  span is now faded by where it begins, so a storm near and the deck far behind it on one ray each take their own
  distance's haze. **With no cells both marches are the old ones** (the sky within 1e-9 on 28 rays, the shadow
  exactly: the old shader run beside the new in node); with cells, the rows that read T = 1 read opaque, and toward
  a rain cell 9 km north the old sky had been 39% see-through at the horizon (the deck behind it never reached).
  `slabOf` and the two slab uniforms are retired. Laws on the shader's own functions (weather2c): no cloud can stand
  outside a span (the resolved profile over 120 rays through shaped, clipped cells of four kinds, and a lobe past its
  circle); a cell a ray never passes changes nothing in the sky or the shadow; the grazing rows opaque toward a storm
  and behind a thin low cell; an empty cell in front leaves the deck behind it its own colour; the horizon's share of
  a cloud is fade(entry) (1 - T); the shadow is the midpoint rule over the spans. `slabspan.json` 15/15 dead.
- **Recorded, not changed: the horizon's notched band.** Far cumulus at the horizon read as a dark scalloped band with
  bright dome between the clouds (16:00 sunny, clearest looking north). It is on main too (the same scene run from a
  main worktree), so it is not VC7's; the high tier (80 steps, a 2048x512 map) draws the same pattern finer, so it
  is not the march's sampling; and the sky lab, which has the dome and the clouds but not the game's own passes,
  draws that band light. So it sits in how the game's passes treat the cloud layer against the dome at the horizon -
  its own slice, with the pictures.

What the game showed right: the storm's anvil and its curtain from base to horizon; the rain and the deck around it;
the overcast's lid with the haze's shafts under it; the golden hour's gold on the cloud toward the sun; dusk's purple
lid with stars through its thin places; the cirrus at noon. **The cost, relative only** (SwiftShader has no GPU timer):
a cloudy 15:00 in the city, twelve seconds each way, 1815 ms a frame with the clouds, the haze and the wisps against
1203 ms with all three off (`?clouds=off&haze=off&wisps=off`) - the three together half again the frame on a software
rasterizer; the main thread's script 19.0 ms against 16.7. A real GPU's per-pass numbers are `?perf=zones` on Mac's
machine.
