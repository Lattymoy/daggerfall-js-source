# Volumetric Clouds - the arc (VC, opened 2026-09-07)

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
| **VC5** | THE CLOSE. Quality knobs by machine (map size, steps - the `?clouds=lo|hi` doors exist since VC3, the choice by measurement does not), `?clouds=off` the kill switch (since VC3); the lab panel; the probes (a stormy sky is darker and lower than a sunny one, the sun disc dims behind a bank, the shadow map darkens where the map is dense, a front builds cover over its lead); the pins; the Ledger row; the adversarial review; this page closed. | |

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
