# Enhanced lighting (EL, opened 2026-09-17)

**Mac (2026-09-17), on the fog Better Ambience brought into the dungeons:
"So I do notice with the new fog. We might need to update our enhanced
lighting" and then "Or we can take it a step further an enhance our
lighting system tenfold" - tiers "1, 2, and 3".** Ledger section A, row
EL1.

## The map before the design (the survey, EL0)

The renderer (`render/renderer.js`) lights every world pass in one shape:
Lambert on the mesh, terrain and character programs, ambient-plus-half-sun
on the billboards, up to sixteen point lights with a squared-linear falloff
to the range (`(1 - d/range)^2`, the port's recorded equivalence to Unity's
point light), the player-following indirect light on the same shape, the
sun and moon as directional terms, the cloud deck's shadow on the sun
(VC4), Better Ambience's trilight on the mesh program (BA1), emission
subtracted before the light and added after it (AUDIT 39r R17), fog
blended in at the end in four modes. Everything happens in DISPLAY space:
a texel is read as the number the palette stored, the scene's numbers are
tuned against that reading, the products and sums go straight to the
canvas. No shadows, no tonemap, no sRGB, no post pass, no depth texture.
One `Renderer` per page (`main.js`), built once, shared by every scene.

Why that could not simply be tuned for the fog: light that adds in display
space adds wrong (two half-lights make more than one full light), the
falloff is a shape chosen to look right on that wrong scale, there is no
headroom (a torch three feet from a wall clips to white where a flame
would bloom), and sixteen slots fill on any lit street. Better Ambience's
dungeon trilight sits at roughly three times DFU's flat 0.12 ambient, and
the Dungeon Brightness knob is inert under the mod - a symptom of a
pipeline with no exposure.

## EL1 - foundations (SHIPPED 2026-09-17)

`render/enhancedLighting.js`. The lane (`EL_LANE`) is five fragment
shaders that REPLACE the renderer's mesh, billboard, terrain and character
fragment shaders and the far ring's, under the same uniform names the
renderer already uploads plus two of its own. Two profiles are two
programs (precipitation.js's doctrine): the classic shaders are untouched
to the byte, a classic page never compiles the lane, and a shader fault on
the lane is a boot fault at the host's mount.

What a fragment sees, in order:

1. **sRGB decode** of the texel (the IEC curve, exact - the textures stay
   the RGBA8 the classic lane uploads; NEAREST filtering samples one
   texel, so a post-sample decode is exact). The rig's vertex colours and
   the far ring's tint decode the same way.
2. **The scene's colours arrive decoded** - the renderer runs every colour
   it uploads (ambient, the trilight's sky and ground, sun, moon, the
   third light, the indirect light, the emission colour, every point
   colour, the billboard tint's two terms before they add) through the
   lane's decode while the lane is installed (`_c3`, `_pointColorData`).
   A pure-gamma pipeline with both ends decoded lands the one-light case
   where the classic lane put it, and the many-light case where physics
   puts it: lights add in linear space.
3. **Windowed inverse-square lanterns** (`elAttenuation`): `2 / (1 + 16
   (d/r)^2)` times `(1 - (d/r)^4)^2`. Hotter than the classic shape inside
   a fifth of the range (headroom the tonemap rolls off), within a third
   of it beyond, exactly zero at the range so a light entering or leaving
   the nearest-N pick never pops. **Forty-eight** of them (`EL_MAX_LIGHTS`;
   96 uniform vectors, under ES 3.0's guaranteed 224). The billboards keep
   the classic lane's attenuation-only term on the new shape.
4. **Exposure** (`EL_EXPOSURE` 1.4; `?exposure=` the tuning door,
   `Renderer.setExposure` the host's) then an **extended Reinhard**
   tonemap (`elTonemap`, white point 4): identity in the dark end - a 0.12
   dungeon ambient reads at ~0.145, where ACES's toe would have crushed it
   to black - and a soft shoulder over 1.0, so a torch's near field blooms
   to white instead of clipping there. Measured against the classic lane's
   numbers: 0.12 -> 0.145, 0.5 -> 0.52, 1.0 -> 0.82 (pinned).
5. **Fog in-scatter** (`elScatter`): the analytic single scattering of
   each point light along the view ray - `density * (atan((t1 - t0)/h) -
   atan((ta - t0)/h)) / h`, the ray clipped to the light's range about its
   foot on the ray, so the medium beyond a lantern's reach contributes
   nothing. The density is the fog's own (1/span for the linear mode,
   the density itself for exp and exp2, zero with the fog off), times
   `EL_SCATTER`. Clear air glows nowhere; Better Ambience's foggy dungeon
   shows every torch as a halo. Pinned against a numeric integration.
6. **sRGB encode.** The fog COLOUR is blended in decoded form and
   re-encoded, so a fully fogged fragment is bit-for-bit the fog colour,
   which is the sky's colour at the horizon, drawn by a program this lane
   does not touch.

**The renderer's half.** The world program set (mesh, character,
billboard, terrain) is built as a unit (`_buildWorldSet`) and installed as
a unit (`_installWorldSet`): every uniform location the draw paths read is
looked up again, and every "already uploaded" claim - the terrain's
frame-constant block, the cloud shadow stamps, the emission colour shadow,
the bound-program shadow - is dropped, because it was the old set's.
`setLightingLane(lane | null)` compiles a lane ONCE per key and keeps it
across swaps; the classic set is never rebuilt. The light cap is the
installed set's (`maxPointLights`: 16 classic, 48 on the lane), read by
`setPointLights`, the flash's one-slot-under composition, and every host's
`nearestLights` call - no literal sixteen remains in a host or the
renderer. A light list stored under one cap is re-cut on a swap.

**The hosts' half.** `syncLightingLane(renderer)` at mount in the four
scene hosts (the sky's pattern: a flip of the pref takes effect when the
world next loads; worldModes rides the world host's install). The white
lanterns of the city and the dungeon take the lane's flame
(`EL_FLAME_COLOR`, a ~1900 K blackbody at the host's own intensity: the
city's 1, the dungeon's 0.8) over the classic grey; the interior's lights
carry their own colours (LT1's `interiorLightProperties`) and keep them.
The far ring is built with the same lane and the same exposure, so the
horizon lights as the ground does - without it the ring stood a step
brighter than the streamed ground where the fog did not hide the seam.

**The switch.** `enhanced-lighting` on the Features home (group sight,
`enhancedLighting`, on by default, forced on online); the enhanced skin,
the pref, `?lighting=classic` the kill door - waterSurface.js's
`waterSwitchOn` composition, one home (`enhancedLightingOn`).

**Pinned** (`test/el1_enhancedlighting.test.js`, 11): the switch and its
doors; the row; decode/encode as the IEC curve and inverses; the falloff's
gain, zero, monotone and the classic comparison; the tonemap's toe,
white and shoulder with the three display numbers; the in-scatter
against a 20,000-step numeric integral, its window, its zeros, the
density per fog mode; the five shaders' 48-light arrays and lane
uniforms, the terms they keep, the classic shaders untouched (four at
sixteen, the classic falloff four times, no lane uniform, the renderer
not importing the lane); the compile counts on a fake GL (12 at boot, 8
on install, 0 on every swap after), program identity across swaps, the
cap re-cut, the flash under the cap, the water's cloud-shadow slot
surviving an install; every colour decoded on the lane and as given on
classic, the lane's uniforms on all four programs, the scatter gain
folded with the fog; the far ring's lane; the host wiring. The uniform
sweep (`test/glstate.test.js`) now reads `enhancedLighting.js` and
`farRing.js` and expands every interpolated block a file defines.
Campaign `tools/mutants/el1.json`: 41 mutants, 40 killed, 1 equivalent as
recorded (the range guard at exactly the range, where the window is
already zero); the four first-run survivors - the packed decode's last
channel, the window's shape (only its zero and its monotony were pinned;
the arithmetic at two distances is now), the same-lane no-op (the
lookups are counted now) - each made to bite.

**NOT SEEN ON A GPU.** The numbers are the classic lane's re-derived; the
look is Mac's eye. The tuning doors are `?exposure=` and
`?lighting=classic`.

Known seams left for the later tiers: the water surface
(`waterSurfaceFs`) and both skies still light and blend in display space
beside the lane; the Dungeon Brightness and Torch Brightness knobs scale
display values that the lane then decodes, which is the same monotone
order but a different curve.

## EL2 - shadows (OPEN)

A cascaded sun shadow map outdoors, a cube-map shadow for the nearest
point light indoors, depth-only programs per draw path, PCF.

## EL3 - depth and air (OPEN)

An RGBA16F HDR target with a depth texture, a depth prepass, SSAO
multiplying the ambient, bloom on emissive surfaces and flames, volumetric
light shafts, the tonemap moved to a final composite.
