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
   terms at every sample both marches take under a union slab - so a
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
  minutes so every player online sees the same sky:
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
  mid-afternoon, settling at dusk. It lives in the towers' HEIGHT; the
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
  the whole row CONVECTION_LAG_MINUTES (150) after the sun is highest,
  and settles toward dusk. The first cut also moved the cover (its daily
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
  exactly as they were, all cloud takes them away, and a half-cloudy one
  leaves half. VC6c's gate is untouched: Mac's "when the sun is covered by
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
  bright as away from it. AIR_HAZE_GAIN (1) was chosen against 0.5 (the
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

### VC7c - rain shafts

- A raining or storming cell hangs a curtain from its base to the ground:
  density that falls off toward its rim, streaked vertically and moving
  with the cell, in the same field both marches read. From afar it is a
  grey veil under the storm, where the weather map puts it; it fades as
  the player comes under it, where the falling rain itself takes over.
- Only what falls hangs one (rain, thunder, snow; a sandstorm is already a
  wall on the ground), with its intensity from the same law as the rain.

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

