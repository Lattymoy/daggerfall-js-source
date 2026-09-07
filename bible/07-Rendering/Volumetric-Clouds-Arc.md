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
| **VC2** | THE RENDER TARGET AND THE NOISE. A render-to-texture helper in `render/renderer.js` that obeys the upload law (an upload path never draws, binds a framebuffer, clears or leaves a binding - the FBO work is a DRAW path with its own marker); a 3D Perlin-Worley shape noise (128^3, RGBA: Perlin-Worley + three Worley octaves) and a 32^3 Worley detail noise, both GENERATED ON THE GPU into `TEXTURE_3D` layers at boot, and a 2D curl/weather-domain noise; the cloud lab door in `sky.html` and a probe that reads the noise back. No cloud drawn yet. | next |
| **VC3** | THE CLOUDS. A raymarched cloud slab (base and top altitudes in world units, flat-earth with a horizon curve) rendered NOT per screen pixel but into a SKY-SPACE MAP - an equirectangular hemisphere texture, camera-independent because the clouds are at infinity for translation - refreshed a stripe per frame (a full sweep every N frames) with blue-noise march jitter and an exponential temporal blend in that space; composited over the dome by direction after `sky.draw`, before the world, transmittance in alpha so stars and the sun disc show through the gaps. Shape from the eased row: cover -> coverage threshold, soft -> erosion, grey -> darkness/ambient, lit/shade -> the two light colours, and a per-weather PROFILE (sunny: scattered towers; cloudy: broken; overcast: a low grey deck; rain/thunder: dark, tall, dense; snow: flat grey; fog: a low uniform lid). Motion: the one drift integral moves the domain (same number the ground reads), a slow altitude shear turns the tops. Light: sun with a short light march (Beer + powder), Henyey-Greenstein forward scatter for the silver lining, ambient from the dome's own zenith/horizon colours, EV5's moon term at night, DS1-style flash under thunder from the host's lightning light. The 14 s / front-stretched ease is the ONLY clock the shape reads. | |
| **VC4** | THE SHADOWS, REAL. A world-space shadow map (transmittance along the sun ray through the SAME slab, a square around the player snapped to the 819.2 pixel grid so a recenter never jumps it) refreshed in stripes like the sky map; sampled by the terrain, the models, the billboards, the water, the grass and the far ring through one shared GLSL block, replacing the terrain-only noise shadow; `sunOcclusion` becomes the slab's transmittance toward the sun so the key light, the disc and the ground agree. The moon casts none (as now). | |
| **VC5** | THE CLOSE. Quality knobs by machine (map size, steps) with a `?clouds=` door for the probes, `?clouds=off` the kill switch; the lab panel; the probes (a stormy sky is darker and lower than a sunny one, the sun disc dims behind a bank, the shadow map darkens where the map is dense, a front builds cover over its lead); the pins; the Ledger row; the adversarial review; this page closed. | |

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
