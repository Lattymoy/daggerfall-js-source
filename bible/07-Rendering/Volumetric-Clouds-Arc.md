# Volumetric Clouds - the arc (VC, opened 2026-09-07, CLOSED 2026-09-07)

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
- **The weather already arrives slowly**: a 14 s ease, stretched ~64x
  across a front's 15-real-minute lead, so cover BUILDS over a quarter
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
| **VC1** | THE PIXELATED LOOK GOES. Our dome is the lane's default sky again, smooth by default (`?sky=retro` the door back to ES1e's pixel); the Dynamic Skies mod becomes a choice in the Mods pane (its `Enabled` default false), 1:1 as ever for whoever wants it. Nothing else moves. | SHIPPED 2026-09-07 |
| **VC2** | THE RENDER TARGET AND THE NOISE. `render/renderTarget.js` - a 2D target and a 3D volume, creation under the upload law (it sizes, parameterises and binds no framebuffer), the framebuffer work on named DRAW paths that leave the default framebuffer and the caller's viewport behind and never ask GL. `render/cloudNoise.js` - a 128^3 SHAPE volume (R a Perlin-Worley, the billows dilated by the low-frequency cells; G/B/A Worley at 8/16/32) and a 32^3 DETAIL volume (Worley at 4/8/16), both tiling on every axis (every lattice taken modulo its period), GENERATED ON THE GPU one layer per draw, mipped; the lab's slice viewer (`?noise=`) and tools/cloudNoiseProbe.mjs (10 checks: the volumes draw, are fields, tile with a quiet seam, wrap and vary along z, the octaves rise). No cloud drawn yet. | SHIPPED 2026-09-07 |
| **VC3** | THE CLOUDS. A raymarched cloud slab (base and top altitudes in world units, flat-earth with a horizon curve) rendered NOT per screen pixel but into a SKY-SPACE MAP - an equirectangular hemisphere texture, camera-independent because the clouds are at infinity for translation - refreshed a stripe per frame (a full sweep every N frames) with a per-texel march jitter that is FIXED - a hash of the texel, never the clock, so the dithered banding is stable and needs no temporal blend (the design first promised one; VC3 found the fixed jitter enough and shipped without it); composited over the dome by direction after `sky.draw`, before the world, transmittance in alpha so stars and the sun disc show through the gaps. Shape from the eased row: cover -> coverage threshold, soft -> erosion, grey -> darkness/ambient, lit/shade -> the two light colours, and a per-weather PROFILE (sunny: scattered towers; cloudy: broken; overcast: a low grey deck; rain/thunder: dark, tall, dense; snow: flat grey; fog: a low uniform lid). Motion: the one drift integral moves the domain (same number the ground reads), a slow altitude shear turns the tops. Light: sun with a short light march (Beer + powder), Henyey-Greenstein forward scatter for the silver lining, ambient from the dome's own zenith/horizon colours, EV5's moon term at night, DS1-style flash under thunder from the host's lightning light. The 14 s / front-stretched ease is the ONLY clock the shape reads. | SHIPPED 2026-09-07 - `render/volumetricClouds.js`, the lab drawing them, tools/volumetricCloudsProbe.mjs (9 checks). Seen in the lab: scattered cumulus on a blue noon, a grey mottled lid at overcast, a dark storm, a warm cloudy dusk, an overcast midnight hiding the stars. Left for VC5: the towers' undersides could be darker still and their edges crisper (the erosion's weight), the lid's mottling stronger, the strobe's flash on the clouds unseen (no storm strobe in the lab), a `?clouds=` tier for weak machines chosen by measurement. |
| **VC4** | THE SHADOWS, REAL. A world-space shadow map (transmittance along the sun ray through the SAME slab, a square around the player snapped to the 819.2 pixel grid so a recenter never jumps it) refreshed in stripes like the sky map; sampled by the terrain, the models, the characters and the flats through one shared GLSL block (`CLOUD_SHADOW_GLSL`, now the map and not a noise), replacing the terrain-only noise shadow; the global `sunFactor` dim stands down (the disc dims through the sky map's own transmittance, the ground through its map - one field, no dim on top). The moon casts none. The sky map marches from the camera's own world position, so a walk moves the bank overhead and the shadow under it together; the floating origin's recenters are handed to the clouds (`sky.offsetOrigin`) and both marches sample the field at the ABSOLUTE position (`uShift`, the shifts accumulated - the review's first finding: the periods being whole pixels does NOT make a one-pixel shift invisible, a shift is invisible only when it is a whole number of PERIODS), the shadow square moving with the world and its map kept; a pixel crossing without a recenter (the fixed city) shifts the map by whole texels with a blit and marches only the uncovered strip. The first sky sweep is striped like every other (no stall); the shadow targets start all light and the ground samples nothing before the first march; the studio's sprite borrow and an interior's frame carry no deck. The square is SIXTEEN pixels a side (13.1 km, the near edge 6144 m out, past the far fog): a pixel is a whole number of the map's texels at every tier, which the crossing's texel shift depends on (twelve, tried first, left 0.67 of a texel behind at every crossing - the review). Under a STORM the map is black: a 3.7 km deck at density 1 is 22 optical depths, no direct sun reaches the ground and the row's ambient lights it - the law, pinned by the probe. NOT reached: the grass (its shader is pinned byte for byte to the lab's), the far ring (outside the square by construction - it takes `farSunFactor`, a cover-derived dim on the slab's own coverage law, cover^1.6), the dungeon water. | SHIPPED 2026-09-07 - the probe's five shadow checks (a sunny noon mostly lit with dark patches, an overcast noon dark everywhere, a storm darker still, the morning's map another than noon's, midnight all light) |
| **VC5** | THE CLOSE. The tiers (`?clouds=lo|hi`, `?clouds=off` the kill switch, since VC3) made visible on the lab's panel (a Clouds select and a Shadow-map box that rewrite the query and reload - a tier is a set of targets, not a live knob); the probes grown to fifteen (the sun's disc a compact white disc on the bare noon sky and a glow many times its size under the overcast lid - it dissolves, the forward scatter through the lid; every sky claim paired against a bare-dome shot so it fails with the clouds off; the storm's black map stated as the law; the sun's angle a texel-for-texel picture diff); the pins (all THREE marched programs under the two-way uniform pin, `shadowOrigin` by value, the extent and the whole-texel law per tier); the Ledger row; the adversarial review (below); this page closed. NOT done, said so: the tier choice by measurement - SwiftShader's frame times do not transfer to a real GPU, so the default tier is a judgment (1024x256, 56 steps) and the measurement is Mac's machine's to make; a front building cover over its lead is pinned (the profile eases on the row's own exponential, the front-stretched dt is WIND2's) and not pictured (the lab has no front). | SHIPPED 2026-09-07 |

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
