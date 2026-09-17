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

## EL2 - shadows (SHIPPED 2026-09-17)

`render/shadowPass.js`. The renderer has no scene graph - the hosts issue
every world draw from their own culled lists - so the pass RECORDS what
the world pass draws (each mesh with a copy of its matrix, each terrain
surface, each billboard batch list; a pooled list, `SHADOW_RECORD_MAX`
6000, minted once and reused by index) and at the top of the NEXT frame's
`beginFrame`, before the clear, replays it depth-only from the light. The
maps are current with this frame's light and eye; only the caster list is
a frame old. No host changes its draw order or draws twice.

**Two maps, one per kind of scene**, chosen per frame off the lighting the
host already set (`shadowKind`: a sun with scale and height, else the
cube): outdoors a two-cascade orthographic map centred on the eye - 40
units at 2048^2 for the street, 240 for the town - as a depth texture
array with hardware compare, texel-snapped so the edge holds still as the
camera walks (`sunCascadeMatrices`, pinned: the eye at the centre, the
radius at the edge, the world origin on the texel grid, a sub-texel step
of the eye moving a world point by a whole texel or none); indoors a cube
map of six 512^2 depth faces from the nearest lantern that is not the
eye's own (`pickShadowCaster`: the Light effect's candle sits at the
camera and its shadows hide behind their own occluders), the shader's
depth reference being the face's own projected depth of the major axis
(`cubeDepthRef`, pinned equal to the face matrix's output on and off the
axis). The lane's shaders read them through `SHADOW_GLSL`: the sun map on
the sun term beside the cloud's shadow, 3x3 PCF over the hardware
compare, a normal offset of a texel and a half and a constant bias; the
cube on the one lantern it belongs to (`uShadowIndex`), five taps. A
flat reads its shadow half a unit up its placement base (`vBBBase`, a
varying the classic vertex shader now writes and the classic fragment
shader ignores), once for the whole sprite - a sprite in its own map
would shadow itself.

**The depth programs** are the renderer's own vertex shaders (handed to
the pass at construction; the pass imports nothing of the renderer or the
lane) over two tiny fragment shaders: nothing for a solid, the 0.5 cutout
for a flat, so a tree's shadow is its silhouette. The flats face the
light for the replay (right = up x lightDir for the sun; toward the
lantern per flat for the cube), the wind's lean rides along. Culling is
off under the light's projection (it is not the world's mirrored one,
and an open model must cast from both faces); colour writes are off.

**The renderer's half.** `setLightingLane` builds one `ShadowPass` for a
lane that asks (`EL_LANE.shadows`), once, kept across swaps; the three
draw paths record behind one gate (`_casting`: a lane with shadows,
outside a panel frame - the automap's and a preview's draws are not
casters, and a panel frame drops the records it inherited); a wireframe
draw records nothing; `destroyMesh` and the two batch destroys mark the
object `_dead` so a record from the last frame skips it; the receiver's
six uniforms ride the lane's per-program table and go up with the lane's
own (`_uploadEl`), the maps bound on units 13 and 14 (the cloud shadow's
15 beside them).

**Known limits, recorded:** a caster the frame did not draw casts nothing
- the hosts' frustum culling (EV3) means a tower behind the camera throws
no shadow into the view; the character rigs (the Morrowind body, the
peers, the first-person arm) cast none; the water surface receives none;
the moon casts none (the map is the sun's, and at night the lanterns are
the light). EL3 or a later pass owns those.

**Pinned** (`test/el2_shadows.test.js`, 8): the constants; the cascades'
geometry and snap; the cube faces against the depth reference; the caster
pick and the kind; the receiver block, the depth shaders, the five lane
shaders' use of them and the classic shaders' innocence; the fake-GL
lifecycle (the pass built with the lane and kept, two cascade
framebuffers and six faces, three records a frame, the maps drawn before
the clear under the sun then under the cube, the records spent and
released, a destroyed mesh and a concealed flat skipped, a panel frame
recording nothing, the classic set recording nothing); the bounded and
reused pool; the renderer's wiring. Campaign `tools/mutants/el2.json`: 40
mutants, 40 killed (the one first-run survivor, a flipped cube face's up
vector, is why the six face orientations are pinned by name now).
**NOT SEEN ON A GPU** - the depth
array and cube formats, the compare mode and the face convention are
WebGL2's by the book, and the book has been wrong before.

## EL3 - depth and air (SHIPPED 2026-09-17)

`render/airPass.js`. Three screen-space effects on EL1's light and EL2's
shadows, all fed by one new thing: a DEPTH IMAGE of the world from the
camera, drawn at the top of the frame from the shadow pass's records (the
same replay under the camera's view-projection). Off that depth:

1. **Ambient occlusion** (SSAO at half resolution): the view-space
   position reconstructed from the depth with the projection's four
   numbers (`projInfo`, `viewDepth` - pinned against the perspective
   matrix itself, mirrored and not), the normal from the derivatives and
   flipped to face the eye whatever the mirror did, a hemisphere of twelve
   samples (`aoKernel`, a fixed seed, denser near the origin) rotated per
   pixel by a hash, each projected back and tested against the depth
   image with a range check and a bias, then a 4x4 box blur. The lane's
   mesh, terrain and character shaders read the image by screen position
   (`AIR_AO_GLSL`, unit 12) and multiply their AMBIENT term alone - the
   light that has no direction is the light a crevice loses; the sun and
   the lanterns keep theirs. The flats and the far ring take none.
2. **Bloom** (quarter resolution): sourced from what emits - every
   window's emission map and every self-lit record, the records replayed
   with an emission-only program (the sub-mesh's resolved mask, the window
   colour or white), the flats' masks behind their cutout - and a GLARE
   SPRITE at each lantern sized by the square root of its range, hidden
   when the depth image holds a surface in front of its centre (the
   vertex shader reads the depth); additive into a quarter target, then a
   separable 9-tap gaussian twice.
3. **Light shafts** (quarter resolution, outdoors): the sky's mask (depth
   at the far plane) weighted toward the sun's screen position
   (`sunScreenUV`: a directional light is a point at infinity, null behind
   the camera; pinned dead centre when looked at and east-is-right under
   the mirrored projection), radially blurred toward it over 32 taps with
   decay, in the sun's colour; drawn only with a sun that has scale and
   height and is in front of the camera.

The bloom and the shafts are COMPOSITED additively by the frame's first
screen-space draw (`drawScreenQuad` / `drawScreenQuadRun`, where the 2D
pass begins and the world pass and every foreign pass have ended) over the
world viewport, once a frame; the 2D pass then gets the full canvas back.
`?air=off` keeps EL1 and EL2 and drops the three (`airOn`, read by
`syncLightingLane`, handed to `Renderer.setAir`; the pass rides a lane
that asks for it AND the door, built once and kept).

**THE DEPARTURE FROM THE PLAN, recorded and then CLOSED (EL4, below).**
The plan named an RGBA16F target for the whole world with the tonemap
moved to a final composite; EL3 shipped without it on the claim that six
foreign passes restore `bindFramebuffer(null)` behind the renderer's back.
Mac: "The goal isnt a half visioned system." The survey that followed
found the claim wrong - TWO restore sites in the whole tree - and EL4
built the frame.

**The renderer's half.** One `_renderPasses` at the top of `beginFrame`,
after the viewport is set and before the clear: the shadow maps, then the
air's images, then the records are dropped and the world viewport comes
back. The shadow pass no longer drops its own records (the air needs
them); the billboard record carries the camera basis the batch was drawn
with, for the emission replay. The receiver's two uniforms ride the lane's
per-program table. `setAir` and `_syncAir` decide the pass from the door,
the lane's `air` flag and the presence of the shadow pass.

**Known limits, recorded:** the AO, the bloom source and the depth image
are a frame old in geometry (the records), current in camera; a caster
the frame did not draw is absent from all three; the character rigs are in
none; the bloom adds in display space over a tonemapped frame (an HDR
composite is the later pass above); a classic panorama sky drawn as a
screen quad (`?sky=classic` on the enhanced skin) would trigger the
composite before the world's flats.

**Pinned** (`test/el3_air.test.js`, 7; EL4 re-aimed the composite pins to
the resolve): the door and the constants
(four reserved units in a row); the reconstruction against the
perspective matrix, mirrored and not, and the GLSL's arithmetic; the
sun's screen position (the centre, above, east-is-right facing north,
null behind, the direction's not the eye's); the kernel (hemisphere, unit
ball, denser near the origin, the fixed seed's first sample); the
receiver block and the shaders (the ambient alone, once, in the three lit
shaders; none on the flat and the ring; the emitters; the glare hiding;
the sky mask; additive twice; a leaf); the fake-GL lifecycle (built behind
the door and kept, the images sized to the viewport and kept while it
holds, the three depth clears before the frame's, the emitters counted,
the rangeless light no glare, the shafts with the sun, the viewports and
the framebuffer and the clear colour restored, the composite once on the
first screen quad with ONE ONE and the full canvas after, none indoors at
night for the shafts, none with the door closed, none inside a panel);
the renderer's wiring. Campaign `tools/mutants/el3.json`: 38 mutants, 38
killed; the five first-run survivors (an unseeded kernel, a reallocation
every frame, a flat without a map emitting, a rangeless glare, an alpha
composite) each made to bite. **NOT SEEN ON A GPU** - the SSAO's
reconstruction and the glare's depth read are by the book; the look
(radius, strengths, the shaft's reach) is Mac's eye and the doors are
`?air=off` and the constants.

## EL4 - the frame (SHIPPED 2026-09-17)

**Mac, mid-arc: "Im expecting Polished and exceptional detail. Proper
darker dungeons. The goal isnt a half visioned system. Its something that
will really blow everything out of the water."** Two things were half
done: EL3's recorded departure (no frame, no adaptation), and EL1's
dungeons, which the tonemap had left at 0.145 for DFU's 0.12 - a shade
brighter, not darker.

**The frame-target law** (`render/renderTarget.js` `setFrameTarget` /
`frameTarget`). The survey found the restore sites: `withTarget` and
`finishVolume` in the helper, the clouds' blit in `volumetricClouds.js`,
and the renderer's own sprite pass - nothing in the skies, the
precipitation, the grass, the water or the far ring, which draw into
whatever is bound. All four now restore the frame target: the canvas by
default, the lane's frame image while the renderer has one bound. That
is the whole of what EL3 had called impossible.

**The frame image** (`airPass.js` `beginFrameTarget`): with the air on,
`beginFrame` binds a canvas-sized RGBA8 image with a 24-bit depth
renderbuffer before the clear, and the world pass - the renderer's draws
and every foreign pass - lands in it. The frame's first screen-space draw
RESOLVES it (`composite`, which is the resolve now): the frame decoded to
linear, the bloom and the shafts added over the world rect, a vignette
(`AIR_VIGNETTE` 0.28 at the corners of the world rect), a touch of
contrast about mid-grey (`AIR_CONTRAST` 1.04), encoded once. A panel frame
keeps the canvas; the door closing mid-frame releases the target.

**Eye adaptation.** The resolve measures the frame's mean log luminance
over the world rect (a 32x32 image, its mip chain's top; the 8-bit log
encodings `packLog` / `unpackLog` over 16 stops of luminance and 4 of
multiplier, pinned as inverses) and steps a 1x1 image toward
`AIR_ADAPT_KEY / luminance` (`adaptStep`, the JS of `ADAPT_FS` term for
term): the eye OPENS into the dark at 0.6/s and CLOSES into the light at
3/s, the step bounded to a tenth of a second, the multiplier clamped to
[0.7, 1.8]. Every lane shader and the far ring multiply their exposure by
it (`elAdapt`, `uAdapt` on unit 11). The loop is closed on the exposed
image, so it half-corrects (the fixed point is the square root of the
correction) and never flattens a scene to grey. A walk from noon into a
dungeon goes near-black and opens over seconds; the ceiling is what keeps
the dungeon dark once it has.

**Proper dark dungeons** (`EL_DUNGEON_AMBIENT_SCALE` 0.35, `dungeonAmbient`
/ `dungeonTrilight`): the standalone dungeon and the world's dungeon mode
hand the lane their ambient - DFU's flat 0.12 and Better Ambience's
trilight alike, the Dungeon Brightness setting still on top - scaled to
a third. The light between the torches is the light the torches throw;
the far end of a hall is dark; the eye opens into it and stops. An
interior (a shop, a tavern) keeps its daylight ambient.

**Bloom from the frame.** The bright pass of the decoded frame (above
`AIR_BRIGHT_THRESHOLD` 0.85 in luminance) joins the emitters and the
glares in the bloom source before the blur, so a sunlit wall and a flame
both glow, not only what carries an emission map. The blur runs at the
resolve, once the frame is whole.

**The lanterns' glints** (`EL_SPEC_GLOSS` 24, `EL_SPEC_STRENGTH` 0.12): a
Blinn-Phong term in every lantern's contribution on the mesh, terrain and
character shaders, under the lantern's own shadow and falloff - wet stone
under a torch. A flat has no normal and no glint.

**What the frame is not.** 8-bit and display-encoded, not RGBA16F: the
lane's forward tonemap keeps the headroom (a torch's near field still
blooms to white inside EL1's shoulder), and the foreign passes keep
writing the display values they always wrote. A float frame would need
every one of their shaders to output linear, which is the one thing this
tier does not touch; the resolve works in linear on the decoded frame.

**Pinned** (`test/el4_frame.test.js`, 6): the constants and the encodings
(inverses, the midpoint byte); the adaptation step (slow open, fast close,
both clamps reached, mid-grey at rest, the bounded step, the GLSL's same
lines); the frame-target law (the helper's two restores, the clouds' blit,
the sprite pass's three, and the seven passes that bind nothing of their
own); the dark dungeons (the scale, once, the trilight with it, the three
host sites, the interior untouched) and the glints (the half vector, the
gloss and the strength, under the lantern's colour, none on a flat); the
eye in every lane shader and the far ring (with the bare 1x1 image for a
lane frame without the air); the fake-GL lifecycle (the frame bound for
the world pass and its clear, a foreign restore handed the frame, the
luminance and the mip chain, the eye's images swapping, the first resolve
integrating no time and a five-second gap the bound, the bright pass, the
grade, the canvas at the resolve and the target released, the door
closing mid-frame, a panel frame on the canvas, a resize reallocating).
Campaign `tools/mutants/el4.json`: 35 mutants, 35 killed (the one
first-run survivor, the eye images' starting byte, pinned). **NOT SEEN ON
A GPU** - the adaptation's rates, clamps and key, the dungeon scale, the
vignette and the contrast are Mac's eye's; every one is a named constant.

## AUDIT-EL (2026-09-17, Mac: "Audit")

Four lanes: two unanchored reviewer reads handed the code and not my
conclusions (the GL and shader lane; the host wiring and light data flow),
and two of my own (the frame lifecycle under real WebGL semantics; the
classic lane's byte-identity against the merge base - the ten classic
shaders compared template for template, the one difference the `vBBBase`
varying EL2 added, which the classic fragment shader ignores). Twenty
findings, every one fixed and pinned (`test/audit_el.test.js`, 11;
campaign `tools/mutants/audit_el.json`, 33 mutants, 33 killed; the four
tier campaigns re-run over the audited code).

**The ones that would have shown on the first GPU frame.**
- F12 (GL lane, HIGH): with `?air=off` the terrain drew NOTHING. The lane's
  terrain shader carries `uAO`, a `sampler2D`, and with the air off nothing
  bound it - so it sat at unit 0 beside `uTileArr`, a `sampler2DArray`.
  Two samplers of different types on one unit is INVALID_OPERATION at
  every draw. The AO sampler is on unit 12 always now, with a bare image
  and a zero rect when there is no image.
- F1 (mine): every lane shader samples `uAdapt`; with the air off nothing
  bound it either, and it read the diffuse texture's centre texel as an
  exposure - a different exposure per material. A bare 1x1 image holding
  the multiplier 1 is bound whenever the air is off, and in the studio
  bake (the item icons, the inventory's body), where the world's eye would
  have made an icon baked in a dark dungeon brighter than one baked at
  noon.
- F5 (wiring lane, HIGH): the enhanced travel map vanished. It opens a
  SECOND `beginFrame` after the host's HUD; with the air on that rebound
  and cleared the frame image, the relief drew into it, and nothing after
  it drew a screen quad in the 'map' phase - so the map's frame was never
  resolved and the canvas kept the world. `beginFrame` takes a world flag
  now (`WORLD_FRAME`, the six host sites): a world frame replays and
  spends the records; any other frame - the map, a video, a menu - first
  resolves the frame still owed, keeps the world's records for the world's
  next frame, and draws into a frame of its own that its first screen
  draw or `resolveFrame()` (the map calls it after its relief) resolves.
- F4 (mine, then the wiring lane): FORTY-EIGHT LANTERNS NEVER REACHED THE
  SHADER. `withPlayerLights` cut the scene's lights to sixteen minus the
  player's whatever set was installed - the classic cap restated in the
  composer. It keeps every light now; the renderer's `setPointLights` cuts
  to the installed cap with the player's first, which drops the farthest
  of the scene's - light for light what the old arithmetic dropped on the
  classic set (three older pins re-aimed to say so).
- F13 (GL lane): the camera's depth image drew every flat edge-on - the
  replay used the sun's basis for the air pass too - so the AO ignored
  every tree and foe, the glares shone through them and the shafts
  streamed through every canopy. The record carries the basis the flat was
  drawn with; the camera replay uses it.
- F14 (GL lane): the lane's billboard shader declared `uShadeDark` and
  nothing uploaded it - every shade-concealed foe a black cut-out. The
  constant is interpolated as the classic shader does.

**The ones that would have looked wrong.**
- F6 (wiring lane): Better Ambience's fog colour was not scaled with the
  dungeon's ambient, so the far end of a foggy hall was BRIGHTER than its
  near walls - the inverse of the dark. `dungeonFog` scales it with the
  same constant; the underwater override is untouched.
- F7 (wiring lane): the automap's unlit bracket and the bank's preview
  drew through the lane's tonemap and the world's eye - a map whose
  brightness drifted with the dungeon the player had just stood in. A
  panel frame suspends the lane and draws on the classic set.
- F15 (GL lane): the shadow biases were constants in non-linear depth -
  the cube's 0.002 was half a world unit at five units and four at
  fifteen (an occluder within four units of a wall cast nothing near a
  lantern's range), the sun's 0.0004 half a unit over the 1200-unit box.
  Both are in the space they mean now: 0.04 world units off the major
  axis, 5e-5 of the box (0.06 units), the normal offsets kept.
- F16 (GL lane): the eye measured its own output - the fixed point was the
  square root of the intended correction - and off a single bilinear tap
  per texel, so a torch crossing a tap moved the mean a stop. The
  luminance pass divides the current multiplier out and takes sixteen taps
  per texel.
- F2 (mine): the AO image is read by `gl_FragCoord` against the world
  rect; the sprite pass's 1024^2 target and a panel read a stranger's
  occlusion. A foreign rect takes none.
- F3 (mine): the water surface is a classic-space program with sixteen
  slots; it took the lane's forty-eight and, on the lane, decoded colours
  that dimmed every lantern's reflection. Sixteen, raw.
- F10 (wiring lane): the eye adapted to the clear colour behind a video or
  a menu and swung back on return. A frame the world never drew (the
  passes saw no records) is not measured.
- F11 (wiring lane): Dynamic Skies' lightning flash (range 500..1000 over
  the player) became the cube map's caster - six 512^2 replays of the town
  to a far plane of a thousand, for a frame - and an eleven-unit glare. A
  light past 120 units of range is neither.
- F20 (GL lane): the emitters bloomed in display space beside linear
  glares. Decoded.

**The small ones.** F8 the records survive a panel frame (a dead branch
removed; F5 made a panel no world frame); F17 two variables named `step`
hid the built-in (renamed); F18 a hidden canvas allocated a 0x0 image
(guarded); F19 the passes' last VAO was left bound under a shadow set to
null (a real unbind through `markForeignPass`); F9 the castle and special
areas darken with the dungeon under the lane - the ratio AUDIT 26 F183
set (five times the dungeon) holds, the absolute is the lane's - a
judgement, recorded and kept.

**Performance, recorded, not measured:** a city frame replays its ~1000
records three times outdoors (two cascades and the depth image) and seven
indoors (six faces and the depth image), one matrix upload and one draw
per record; the fake harness cannot show the CPU cost. The doors are
`?air=off` (drops the depth image and its three effects, keeps the
shadows) and `?lighting=classic`.

**NOT SEEN ON A GPU** - still; the two reviewers read the code as a GPU
would, which is the most this session can do. Mac's eye is the gate.

## EL5 - THE FIELD (2026-09-17, the first report from the game)

**The report.** A player at a town gate at night, on Discord (bug-reports,
4:22 AM): "whoa... what the - the lights from inside the city are all
bleeding through, tanking my framerate too", with a frame: the gate
passage, orange glare blobs on the passage's inner wall where the city's
lanterns stood behind it, the passage floor lit through the stone. Mac
(6:09 AM): "Testing the new enhanced lighting. Will look into this", and to
this session: "There see some major issues with the new enhanced lighting.
No questions please investigate and ensure this is perfect", then: "Town
gateways count as entrances for interior lighting?"

**The answer to the question.** No. A gate passage is the exterior host's
geometry under the exterior host's lighting; nothing about it is an
interior. What the frame showed was two of the arc's own laws failing on a
GPU - the audit's last line ("NOT SEEN ON A GPU - still") was the warning.

**The two laws, and a third the harness found.**

- THE GLARE'S OCCLUSION WAS A HYPERBOLIC CONSTANT (the bleeding). EL3's
  glare quad hid itself by comparing the lantern's depth to the depth
  image with 0.002 of slack IN THE DEPTH BUFFER'S OWN UNITS - the same
  mistake AUDIT-EL F15 found in the cube map's bias, in the one place the
  audit did not look. A perspective depth buffer spends most of its range
  on the first few units: past twenty units the wall and the lantern
  behind it differ by less than the slack, and every lantern in the town
  glared through every wall. The test is in world units now
  (`AIR_GLARE_SLACK` 0.5 - the flame sits on its post), the texel's view
  depth reconstructed the way the AO's is, at five taps so a lantern half
  behind a post is half a glare.
- EVERY REPLAY DREW EVERY RECORD (the framerate). Six cube faces, two
  cascades, the depth image and the emitters each walked the whole record
  list - ten draws of the town for one frame of it, a thousand draw calls
  each, and at night the cube map's six were of the WHOLE town to a
  lantern's 18-unit range. `render/bounds.js`: every bundle carries a
  bounding sphere (`Renderer.createMesh` computes one for the mesh AND one
  per sub-mesh - a static batch is a whole block in one mesh, so the
  block's sphere is useless and its walls' are what cull; the terrain
  surface and the billboard batch theirs), every record its world sphere,
  every replay its frustum's planes (frustum.js's EV3 extraction,
  normalised); a record, a sub-mesh or a batch outside is not drawn. In
  the probe's room a lantern's six faces draw 24 sub-meshes and cull 36.
- ONE LANTERN CAST (the passage lit through the stone). EL2 gave the
  nearest lantern a cube map; the other twenty lit the inner walls
  through them. Up to `SHADOW_POINT_CASTERS` (4) lanterns cast now, the
  nearest to the eye, sun or no sun, each into six layers of ONE depth
  array (`sampler2DArrayShadow`; the cube's face is selected by hand in
  `pointShadowAt(k, ...)` from a basis generated off `CUBE_FACES`, so the
  receiver and `pointFaceMatrices` cannot disagree - `faceBasis`, pinned
  both ways). One texture unit for any number of casters; the culling
  above is what makes 24 face replays cheap. `shadowOfLight(i, ...)` gives
  each light its caster's shadow, after a range early-out that spares the
  shadow taps, the glint and the pow for every light out of its window.
- THE RESOLVE CRUSHED THE DARKS (the harness's find). EL4's contrast,
  1.04 about 0.18 IN LINEAR LIGHT, sent everything under 0.007 linear
  (byte 18) to black: six pixels in ten of a dungeon frame, half of a
  night street. The same 1.04 about mid-grey of the ENCODED value is a
  grade, not a gate.

**THE HARNESS: `tools/enhancedLightingProbe.mjs`.** The arc's pins run on a
fake GL that compiles anything and draws nothing; this session has no
game data. The probe draws a synthetic room and a street through the real
renderer on a real WebGL2 context (headless Chromium, ANGLE over
SwiftShader): classic and lane, dungeon and exterior, day and night, a
lantern behind a wall and one in the open, a flat. It reads the pixels
back, writes the PNGs (`scratch/el5/`, ignored), and FAILS on: a program
that does not compile, a black or white frame, a lantern whose glare
reaches the wall in front of it (the wall's pixels with and without the
lantern: 0.005 of difference now, the bleed gone), a wall that casts no
shadow from the lantern behind it (the floor in its shadow at 0.05 against
the classic's unshadowed 0.11), replays that cull nothing. Every lane
program compiles and links; the frames read as the design meant them:
warm lantern light with the wall's shadow, sun shadows of the pillar, the
wall, the crate and the flat's cutout on the street, the night street's
lanterns with their glares.

**Known limits, seen in the probe and recorded:** a hairline of light at
the junction of a sun-facing wall and the ceiling above it in a roofed
room under the sun (the PCF's outer taps fall past the occluder's
silhouette) - the classic contact leak of every shadow map, mitigated not
cured by the normal offset; a dungeon has no sun, so it shows outdoors
under eaves and arches. The eye's image, the shafts and the AO were not
re-judged here beyond "they run and the frame is right".

**Pins:** test/el5_field.test.js (8): the sphere planes and the sphere
test on an ortho box, a perspective frustum and the six faces; boundsOf
and transformSphere; the casters' pick; the face basis against
pointFaceMatrices on every face, and the shader's constants; every lane
shader's early-out and `shadowOfLight`; the bundles' bounds; the replays'
culling on the fake GL (two casters, a far sub-mesh, a far terrain, a far
batch, a bare bundle); the glare, the resolve and the probe's own checks
as text. tools/mutants/el5.json (33). The el2/el3 pins re-aimed to the
array and the array uploads; four el2/el3 records re-aimed.

## EL6 - THE FIELD'S FOUR (2026-09-17, Mac's second list)

Mac, on the EL5 push: "Wanted to add. Just in case youre unaware 1. Some
shadows (like campfire) are wonky 2. Textures in the dark look weird 3. All
lighting sources can be seen through walls 4. Need to comprehensively make
this where it doesnt tank performance". Each mapped to a cause the harness
could show, then fixed at the source.

1. **THE CAMPFIRE'S SHADOW** - the flame flat is the lantern. A point
   light sits AT its flat (the torch, the campfire, the candle: archive
   210, `SHADOW_LIGHT_FLATS`), so a cube face drawn from the light's
   position saw that flat first in every direction and shadowed a wedge of
   the room - turning with the flat's basis, which the replay recomputes
   toward the light. A light flat casts from the sun (a tree's cutout
   shadow is right) and never from a lantern.
2. **TEXTURES IN THE DARK** - two sources. The SSAO's per-pixel rotation
   was a hash: grain the 4x4 box blur never cancelled, and in the dark,
   where the ambient is the only light, the grain was all a texture had.
   It is a 4x4 ORDERED pattern now, and the blur averages exactly one tile
   of it. And every dark gradient - a lantern's falloff across a floor -
   was eight-bit bands; both encodes (the lane's `elFinish`, the resolve)
   are dithered at the byte (`DITHER_GLSL`, a Bayer threshold).
3. **LIGHTS THROUGH WALLS** - the glare was EL5's; what remained was the
   BLOOM'S EMITTERS. The bloom source is a quarter-res colour target with
   no depth of its own, so every emissive flat and every window drew into
   it whatever stood in front - a torch two rooms away bloomed through the
   stone. Each emitter fragment now asks the frame's depth at its own
   screen position and discards when a nearer surface is there
   (`AIR_EMIT_SLACK` 0.15 - it is in that image itself). The probe puts an
   emitter flat behind the wall: the wall's pixels no longer change.
4. **PERFORMANCE, COMPREHENSIVELY** - after EL5's culling the largest cost
   left was THE CAMERA DEPTH REPLAY: the whole scene drawn a third time
   each frame, one frame stale, only to feed the AO, the glares and the
   shafts. The frame has a depth of its own. The frame's depth attachment
   is a TEXTURE now, and the air's images are drawn at the RESOLVE off it:
   the replay is gone (a full walk of the town per frame), the AO left the
   world shaders (one texture fetch fewer per fragment; the resolve
   multiplies the decoded frame once, `AIR_AO_RESOLVE` 0.75 of it, over the
   world rect; AUDIT-EL F2/F12's sampler cases cannot recur), and the
   emitters replay THIS frame's records, exact, and culled (EL5). Beside
   it: the in-scatter loop skips a lantern the ray cannot reach (its
   distance from the eye past the ray's length plus its range - the loop
   ran a closed-form integral for all forty-eight), and the point-light
   loop's early-out (EL5) stands. The casters went to six
   (`SHADOW_POINT_CASTERS`): a gate passage has that many lanterns in
   reach, and the culled faces are cheap.

**What a frame costs now, in draws of a town of N records:** the main pass
N; the two cascades, culled by their boxes (the near one a street's worth);
six casters' thirty-six faces, each the records within the lantern's range
and in front of the face; the emitters, frustum-culled. Before EL5: 10N.
The fill: two 2048^2 depth cascades, 36 x 512^2 faces cleared and mostly
empty, the half-res AO, the quarter-res bloom and shafts, the 32x32
luminance, one resolve.

**The order of a frame now.** beginFrame: resolve any frame still owed;
the shadow pass draws its maps from last frame's records and drops them;
`AirPass.prepare` takes the frame's inputs (nothing drawn); the frame image
is bound. The world pass draws and records. The first screen draw (or
`resolveFrame()`): `_images` off the frame's depth (AO and its blur, the
bloom source - emitters and glares - the shafts), then the eye, the bright
pass and the blur, then the frame to the canvas with the AO, the vignette,
the contrast in display space, the dither.

**Pins:** the el3, el4, el5 and audit_el files re-aimed to the order above
(no image before the frame, the images and their counts at the resolve, the
frame's depth bound for each, the AO on the resolve's unit at its mix, the
flames never drawn from a lantern, the emitters replayed from this frame's
records with their basis); test/el6_field.test.js (2) for the pins the
EL6 campaign found no test could fail; tools/mutants/el6.json (26). The probe's new check:
the emitter behind the wall.

**The probe, sharpened.** Its with/without comparisons carried the eye:
the adaptation's state ran on from scene to scene and every difference
was a hundredth of exposure drift, not the scene's. The eye's clock is
frozen in the probe now (`_now` constant, as the el4 pin does it), the
air's counts are read after the resolve (they are the resolve's), and
the bleed thresholds are five times tighter. The emitter behind the wall
changes the wall's pixels by 0.0000; the same emitter in front of it
fills the bloom source and lays its halo on the wall - the occlusion
discriminates, it does not discard all.

**Still not seen on Mac's GPU** - the harness is SwiftShader, the frames
are synthetic. The four are fixed at their causes; the field decides.

## EL7 - THE POLISH (2026-09-17, Mac: "Lets do #7 + I notice a bug with light sources, that have this bright translucent ball that isnt connected to the source")

**The ball.** The lane's lantern glare is a camera-facing quad at the
light's position, and the light is not where the flame is: a city light
sits at the TOP of its flat (`collectCityLights`: `-yPos + size.h`), a
dungeon light at its flat's centre, and the torch in the player's hand
and the Light spell's candle have no flat at all - a bright ball half a
unit ahead of the eye, floating. Three laws: A GLARE NEEDS A FLAME UNDER
IT (the frame's depth within `AIR_GLARE_SLACK` (1.0) of the light at
seven taps over the footprint - the centre, one and two half-sizes above
and below it, either side, because a flat stands on its point and the
light may sit at its base or its top; presence, not "nothing nearer", so
a light in open air draws nothing and a light behind a wall draws
nothing); no glare for a
light within `AIR_GLARE_MIN_DISTANCE` (1.5) of the eye; and the glare is
a flame's size (`AIR_GLARE_SIZE` 0.25 - 0.35 was a unit and a half across
at a lantern's range: a ball).

**#7, the four.**
- THE AO BLUR IS DEPTH-AWARE: a tap counts while its view distance is
  within the AO radius of the centre's; a wall's occlusion no longer
  smears into the sky beside it nor a pillar's into the floor behind.
- THREE CASCADES by view distance (`SHADOW_CASCADES` 12, 48, 240: the
  room, the street, the town; `uSunTexel` carries the three texel sizes).
  The near cascade's texel is 1.2 cm; the eave hairline EL5 recorded is
  four times thinner than the 40-unit cascade left it.
- THE RIGS CAST: `createCharacterMesh`'s bundle carries a bounding sphere
  (`boundsOf` with the rig's stride, refreshed by `updateCharacterMesh`),
  `drawCharacter` records it (`recordCharacter`; never from the sprite
  target or the studio bake - a rig drawn to a 1024^2 target in a studio
  view is no caster), and the shadow pass replays it with its own depth
  program over CHAR_VS, the visible ranges alone.
- THE WATER RECEIVES: `waterSurfaceFs(cloud, SHADOW_GLSL)` puts the sun
  map on the water's sun term; the renderer builds the lane's water
  program once with the lane (`waterSurfaceProgramLane`, its own uniform
  table through `_waterLocs`) and `drawWaterSurface` takes it, with the
  maps, whenever the lane and the shadows are on. A quay's shadow lies on
  the harbour.

**The probe's catch.** `${AIR_GLARE_SLACK}` with the slack at 1.0 reached
the shader as `1` - an int, and "'<=' : wrong operand types" on a real
GPU; the fake GL compiles anything. `glslFloat` is the one door a
whole-number constant takes into a shader. The probe's lantern B now has
a flame flat under it, in view: the glare shows with the flat, not
without, and not for a torch added in the hand.

**Pins:** test/el7_polish.test.js (3); the el1/el2/el3/el5 pins re-aimed
(three cascades, the compile counts, the glare's presence test and size,
the rig's record from drawCharacter alone). tools/mutants/el7.json (26).

