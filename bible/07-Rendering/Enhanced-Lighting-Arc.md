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

## EL8 - THE CONTACT AND THE CADENCE (2026-09-17, Mac: "1. Screen space contact shadows 2. Continue to find ways to improve performance while retaining quality")

**Contact shadows.** Six lanterns hold caster slots; the forty-two
others lit through every wall (EL5's lantern behind the gate, at a
smaller scale: the strip at a wall's foot, lit from the far side). Now
every lantern WITHOUT a slot marches toward its light through the
frame's depth: `contactShadow(wp, n, toLight, dist)` (`AIR_CONTACT_GLSL`,
after `SHADOW_GLSL` in the four lane shaders) takes `AIR_CONTACT_STEPS`
(6) along the light ray over `AIR_CONTACT_LENGTH` (0.6 units, or the
distance to the light if nearer), reprojects each point into the
PREVIOUS frame (`uPrevVP`, `uPrevProjInfo`) and, where the depth there
is in front of the point by less than `AIR_CONTACT_THICKNESS` (0.8), the
lantern is shadowed down to `AIR_CONTACT_FLOOR` (0.15). The previous
frame's depth because the world pass writes this frame's as it goes: the
frame image carries TWO depth textures and `beginFrameTarget` ping-pongs
them (`depthIndex`, `prevDepth`, cleared at birth; `prevVP` kept by
`prepare`), and the first frame, with no previous, marches nothing
(`prevValid`). It is a contact shadow: a lantern behind a wall still
lights the room's far side, and only the 0.6 units nearest an occluder
darken - a foot, a sill, a doorframe's edge - which is the part the eye
reads. The march runs only in the lane's world frames: never from the
sprite or studio targets nor the saved panel (`_uploadNoContact` puts the
zero params and a bare image on the unit). `?contact=off` the door,
`setContact` the renderer's switch.

**The caster table.** `shadowOfLight` and the lit block walked the
caster slots per light (six compares per lantern per fragment, forty-eight
lanterns). `uCasterOf[48]` carries light i's slot, -1 for none, one
lookup; the shadow pass fills `casterOf` as it assigns slots.

**The cadence.** Per frame the shadow pass drew three cascades and six
lanterns' six faces: thirty-nine depth replays of the visible world. Now
the far cascade (the town, 240 units) redraws every
`SHADOW_FAR_CASCADE_EVERY` (2) frames and keeps its matrix until it does
(`_sunVPNew` holds the new one, `sunVP` the drawn one; the receiver
reads what was drawn); the casters beyond `SHADOW_NEAR_CASTERS` (2)
redraw every `SHADOW_FAR_CASTER_EVERY` (3) frames, staggered
`(frameNo + k) % 3` so at most two far lanterns draw in one frame - and
at once when the slot's light changed (`_slotLight`: a lantern that
walked in, a slot re-assigned), so no frame reads another lantern's
faces. Twenty-two and a half replays a frame on average where it was
thirty-nine;
the near cascade and the two nearest lanterns every frame, so what is
close is never stale. `stats.cascadesDrawn` and `stats.facesDrawn`
count it.

**`?perf`.** `render/perfMeter.js`: the frame's GPU time from
`beginFrame` to the resolve on `EXT_disjoint_timer_query_webgl2` (Chrome
has it; where the browser does not the line carries the counts alone)
and the lane's counts - draws, cascades and sun draws, casters, faces and
lantern draws, culled records, emitters, glares, shafts - one console
line every `PERF_EVERY` (120) world frames. This session cannot see Mac's
GPU; this is how Mac can.

**The probe's check.** A and B with no caster slot (six dim lanterns
beside the eye take the six): the strip at the wall's foot on the eye's
side, lit through the wall by A, reads 0.2019 with the march off and
0.1060 with it on; the open floor, the glares (446 with the flame, none
without) and the wall's far side unchanged.

**Pins:** test/el8_contact.test.js (4); the el2/el3/el5 pins re-aimed
(the table's uniform, two depth textures on the frame, the cadence's
counts). tools/mutants/el8.json (32).

## BUGS-5 - THE FIELD'S FIVE (2026-09-17, Mac: "1. ... when thrusting with a weapon, it can be glitchy 2. Objects on the ground can sometimes have standing shadows 3. When you peak around corners, a large shadow moves around 4. Bloom circle disconnected from light sources and still reports of light bloom balls appearing behind floors/ceilings 5. We need to improve the performance of not just the interior but especially the outside world", then "#3 is when the torch is equipped")

Five reports, five mechanisms. F1 is the Weapon Widget's (recorded in
`05-Combat/Weapon-Widget.md`); F2-F5 are the lane's.

**F2 - the standing card.** A flat is a camera-facing card, and the sun
map replayed every flat as one: a loot pile, a dropped bottle, a coin
heap - things LYING on the ground - each drew the shadow of a card
standing on its point. Three rules in the billboard replay
(`shadowPass.js`): a batch a host marks `noShadow` casts nothing
(`scenes/droppedLoot.js` marks both of its batches), the treasure
archive casts nothing (`SHADOW_NO_CAST_ARCHIVES`, 216 - every loot
pile), and a flat shorter than `SHADOW_FLAT_MIN_HEIGHT` (0.5 - a key, a
potion, a heap) casts nothing; its shadow was a sliver anyway and a
wrong one. Standing flats (a tree, a villager, a lamp post) are as they
were. The flame flats keep EL6's own law (never from a lantern, still
from the sun).

**F3 - the light in the hand.** Handheld Torches puts the flame 0.34
left, 0.7 below and 0.25 ahead of the eye - 0.8 away - and with
`SHADOW_CASTER_MIN_DISTANCE` at 0.25 it was the NEAREST caster every
frame: six 512^2 faces from a light a hand's width from every wall, its
penumbra a metre wide, the whole map re-aimed with each step of the bob.
Peeking round a corner the corner's near face is centimetres from that
light, and its shadow - the "large shadow" - swept across the far wall
as the eye moved. DFU's PlayerTorch is a Unity light that casts no
shadows. The distance is a unit and a half now - the glare's own hand
distance (`AIR_GLARE_MIN_DISTANCE`, EL7) - so the hand's light lights
and never casts; a lantern a unit and a half off still does. The same
law in the lit block skips the contact march for such a light. And the
march itself had a second corner fault: it reads the PREVIOUS frame's
depth, and a wall just revealed round a corner was not in it - its
pixels reproject onto the corner's near face, every sample lands
"behind" that, and the whole wall wore a contact shadow that swam with
the turn. `contactShadow` now reprojects the POINT first (the self
check in `AIR_CONTACT_GLSL`): only a point the previous frame saw where
it stands - its depth there within the thickness - is marched; a
disoccluded surface is lit until the next frame has it.

**F4 - the glare's band.** `AIR_GLARE_SLACK` was a unit either side of
the light's planar depth. A flame flat is a camera-facing quad THROUGH
the light, so its opaque texels sit at the light's own depth exactly; a
unit of slack took a ceiling 0.4 in front of a hanging lantern (the ball
through the floor above) and a wall 0.5 behind a bare light (the ball
beside a light with no flat) for "a flame". A quarter unit holds the flat
and nothing else. The probe's new scene: lantern B behind a panel 0.3
in front of it, the bloom source sums 0.

**F5 - the outside world.** Three cuts, none visible. The far cascade
(240 units, a 23 cm texel) replayed every record its frustum held - a
rock, a weed, a sign, each shadowing two texels for a replay; a caster
under `SHADOW_CASCADE_MIN_RADIUS_TEXELS` (2) of a cascade's texel is not
replayed into it (`replay`'s `minRadius`, from the record's sphere or
the batch's bounds - never a rig, a person is always drawn; the near
cascade's rule is under 3 cm and skips nothing a player could see). The
contact march takes `AIR_CONTACT_STEPS` 4 (a step every 15 cm under a
thickness of 80 finds what six found) and runs only within
`AIR_CONTACT_RANGE_FRACTION` (0.7) of the light's range - past it the
windowed falloff has the light under a tenth and its contact shadow was
invisible, and a town's forty lanterns each reached every fragment in
their window with six depth taps. `?perf` (EL8) reads the cuts.

**The probe.** Two scenes added: `dungeon-lane-panelB` (the glare
through a panel: 0) and the `carried` scene now asserts the hand's light
holds no caster slot; the contact scene's six dummy lanterns moved out
to two units (at 0.4 they were "the hand's" under the new distance, and
A and B took the maps - the march was no longer what it measured). All
checks pass on the real GL (WebKit/SwiftShader): the wall's foot 0.1948
off / 0.0924 on, B's glare 446 / 0 bare / 446 carried / 0 panelled.

**Pins:** test/bugs5_field.test.js (3 - the constants and the picker,
the no-cast rules on the fake GL, the far cascade's radius rule),
test/ww1_weaponwidget.test.js's F1 pin; the el2/el3/el5/el7/el8 pins
re-aimed at the new numbers and the self check. tools/mutants/bugs5.json (20, all dead).

## LIGHT-NEAR1 - THE LAMP OVERHEAD (2026-09-23, kurkku on Discord, with video: "shadows disappear seemingly when you're too close to the light source")

A tavern: the player walks toward the hanging lamp and the shadows it
casts vanish. The cause was F3's proxy, still standing beside the flag
that replaced it. F3 kept the light in the hand out of the caster slots
by "within 1.5 of the eye" (`SHADOW_CASTER_MIN_DISTANCE`), the lit
block's contact march read the same number, and the glare had its own
copy (`AIR_GLARE_MIN_DISTANCE`, EL7). MAC-T1 then wrote the fact BY
NAME - the torch and candle records say `carried`, every host with a
player light composes through `withPlayerLights`, the renderer lifts the
mask off the array, and the pick, the march (-2 in the caster table) and
the glare skip a carried light in any camera - and left the proxy in
place. It was never the hand's alone: a hanging lantern sits 2.6-3.2 up
and the eye at 1.7, so within about a unit of it the nearest, brightest
light in the room lost its cube map, its contact march and its glare in
the same step.

**The rule is gone, in all three places.** `pickShadowCasters(lights,
eye, max, carried)` and `pickShadowCaster(lights, eye, carried)` have no
minimum-distance argument; the lit block's fallback reads the caster
table and the range share alone; the glare loop reads the flag alone.
A scene light's distance to the eye is not a reason to drop its shadow;
the hand's light is excluded by its flag. The two constants are deleted
rather than zeroed, so no pin can read a dead knob.

Pinned: `test/lightnear1.test.js` (4) - the lamp overhead is the nearest
caster and the hand's light is passed over by its flag alone; on the fake
GL a lantern a hand's width from the eye draws its glare and the carried
torch beside it does not; the shader and the glare loop by text; every
host that composes a player light does it through `withPlayerLights`.
`bugs5_field`, `el2_shadows`, `mact_bugs`, `el5_field` and `el7_polish`
re-aimed where they pinned the number.

## LC1 - CLUSTERED LIGHTS (2026-09-23, Mac: "We need to take a chance and also make some insane improvements to our lighting system. Its already really good, but it could be much better while also improving performance")

The first step of the second arc, and the foundation the rest stand on.

**The cost it removes.** Every lit fragment of the lane walked ALL of the
frame's lights - up to `EL_MAX_LIGHTS` (48) - and asked each one "am I in
your range" before doing any work. On a 1080p frame that is two million
fragments times forty-eight lengths and compares, for a question whose
answer is "no" for nearly all of them: a tavern's fragment is in range of
three lanterns, a street's of one or two. And the cap was the loop's, so
the world could never carry more lights than a fragment could afford to
ask.

**The shape.** `render/lightClusters.js`. The view frustum is cut into
16 x 9 x 24 cells - a tile of the screen by a slice of depth, the slices
exponential over [0.25, 256] so a cell is roughly a cube in world units
at every distance. Once a frame, on the CPU, every light's view-space
bounding box (its eight corners, clamped to the near plane, put through
the frame's own projection - the mirrored one the hosts pass) is written
into the cells it touches. The lists go up as two small integer
textures on units 9 and 10: the GRID (RG16UI, 144 x 24: an offset and a
count per cell) and the LIST (R8UI, 256 wide: the light indices in cell
order). The shader (`EL_CLUSTER_GLSL`, at the head of the lantern loop
in all five lane programs) reads its cell off `gl_FragCoord` and the
view depth (`uCamFwd`: the view's third row negated, so a dot and an add
is the depth) and walks that cell's list alone - the same loop body,
over two or three lights instead of forty-eight. The in-scatter loop is
untouched: a glow along the whole view ray is no one cell's.

**An acceleration, not a law.** Conservative: a fragment inside a light's
sphere is inside its box, so its cell lists the light; a fragment inside
the box but outside the sphere still runs the range test, which says no
as it always did. Nothing lights that did not, nothing that lit goes
dark. And OFF - every light, exactly as before LC1 - inside the
character-sprite pass, the studio bake and a panel bracket (other views,
other viewports: `uClusterOn` 0 under the contact block's own gate), on a
frame whose lists would overflow `CLUSTER_LIST_CAP` (forty-eight lights each
covering the whole screen), and behind `?clusters=off`. There is no third
behaviour.

**Seen on a GPU.** `tools/lightClusterProbe.mjs` draws
enhancedLightingProbe's room and a night street of forty lanterns through
the real renderer on SwiftShader, the grid on and off, and reads both
back: the room pixel-identical (3 lights; a fragment walks 1.46 of them
on average), the street within the dither's byte (max |diff| 2, no
channel over; 12.9 of 40 walked). The build is a few hundred microseconds
of JS for forty lights.

**What it opens.** The loop's cost is now the lights IN RANGE of a
fragment, not the frame's count - so the cap can rise (every candle a
light) without the fragment paying for the ones across the room. That is
the next step's door; this one changes no picture.

Pinned: `test/lc1_clusters.test.js` (7). `el2_shadows`' wiring window
grew for the build line.

## SC1 - THE STATIC CASTERS ARE DRAWN ONCE (2026-09-23, Mac: "make some insane improvements to our lighting system ... while also improving performance")

The second step, and the one the shadow draws were waiting for.

**The cost it removes.** A lantern's cube map was replayed - six faces
of everything in its range - every frame for the two nearest slots and
every third for the rest (EL8's cadence), whether or not anything in
that range had moved. Performance-Town.md's readout was about 1,700
shadow draws a frame, most of them lanterns. In a tavern nothing has
moved: the walls, the tables and the beams stand where they stood, and
the only things that ever change a lantern's shadow are the light
itself, a door on its swing, a rig walking through, a foe.

**The shape.** `render/shadowPass.js`. Every record is CLASSIFIED as it
is recorded: a mesh at the matrix it was drawn with last frame is
static, one that moved is dynamic - and stays dynamic for
`SHADOW_DYNAMIC_HOLD` (60) recorded frames after it stops, so a door that
swings and stops or a walker who pauses does not redraw every cache in
reach at each step; a rig is always dynamic; a flat is dynamic while its
origin moves, per batch, remembered on the batch. Each caster slot keeps
a CACHE of its static casters - a second depth array of the same shape,
six layers per slot - drawn only when the light itself or the SET of
static casters in its reach changes: `_staticSignature`, an order-free
fold over the identities and positions of the still records whose
spheres touch the light's (the hosts' draw order is the culling's and
must not count). The live layers are then the cache BLITTED
(`_blitSlot`: six depth blits, no rasterisation) with the dynamics
drawn on top at EL8's cadence - and nothing at all when no dynamic is
near. A still room costs zero shadow draws a frame.

**Sticky slots.** A light keeps the slot it had while it stays among the
picked, matched by its POSITION and not its index (the hosts re-sort
their lights by distance every frame, so an index is no name); a walk
past a lamp does not throw its cache away. The cadence's "nearest two"
reads the light's rank by distance, whatever slot it holds.

**The door.** `?shadowcache=off` (`renderer.setShadowCache`) is the old
path whole: every caster in range into the live layers at the cadence,
no cache, no blit.

**Seen on a GPU.** `tools/shadowCacheProbe.mjs` draws
enhancedLightingProbe's room with a walker crossing it through the real
renderer on SwiftShader, the cache on and off, eight frames, and reads
both back frame by frame: pixel-identical; the cache's point draws fall
to the walker alone while it crosses, and to zero when it is gone,
while the old path draws the room every frame.

**Memory.** The cache doubles the casters' depth storage: two arrays of
6 x 6 x 512^2 x 24-bit, about 75 MB together. The lane is the enhanced
skin's, on the desktop GPU it was built for.

Pinned: `test/sc1_shadowcache.test.js` (7). `el8_contact`'s cadence pin
drives a walking mesh now; `el2_shadows`/`el5_field` count the cache's
layers and storage; `weeds1_flatcasters`' replay signature carries the
filter.

## HQ1 - THE COLOUR THROUGH THE CURVE, THE HORIZONS, EIGHT CASTERS (2026-09-23, Mac: "Go" - the visible step of the second arc)

**The colour through the curve** (`elTonemapRGB`, enhancedLighting.js).
Per-channel Reinhard bends HUE as it compresses: a torch's warm light
(r > g > b) has its red on the shoulder while its blue is still on the
slope, so the brighter the flame the more it went yellow-white and then
flat white, and a sunlit red wall lost its red before it lost its light.
The lane's finish, the in-scatter glow and the far ring take the
luminance-preserving blend now ("Reinhard-Jodie"): the curve on the
LUMINANCE keeps a colour's ratios, the curve PER CHANNEL is what the eye
expects at the very top (light desaturates toward white), mixed by the
per-channel result itself - so the dark and the mid-tones take the
first and only the highlights the second. Every law of the curve holds
(`elTonemap` is the same function): 0 to 0, identity in the dark end,
the white point to display white, monotone, a grey unchanged. A flame at
three times white reads (0.91, 0.77, 0.54) now against (0.89, 0.78, 0.60)
before: orange, not straw.

**The horizons** (`AO_FS`, airPass.js). EL3's occlusion scattered twelve
points through a hemisphere and counted the ones the depth image put
behind a surface - a coin toss per sample, so a crevice's darkness was a
speckle the blur then smeared, and a flat floor beside a wall took as
much as the corner itself. The ground-truth form now (GTAO, Jimenez
2016): in each of `AIR_AO_DIRECTIONS` (2) screen-space slices through the
pixel, a quarter turn apart and turned by EL6's ordered rotation, march
`AIR_AO_SAMPLES` (6) steps out each way to the radius, keep the highest
horizon either side (each step's claim weighted down by its distance, so
the radius is a soft edge), clamp the two to the hemisphere about the
projected normal, and integrate the cosine-weighted visibility of the arc
in closed form. Smooth where the surface is flat, dark where two
surfaces meet, no more depth reads than before. The depth-aware blur
(EL7) stands.

**Eight casters.** SC1 made a still caster nearly free, so
`SHADOW_POINT_CASTERS` is 8: a tavern's every lamp throws its shadow.
The two depth arrays are 100 MB together at 512^2.

Pinned: el1/el4 (the finish through `elTonemapRGB`), el3 (the horizon
shader by text, the constants), el2/el5/el6/el8 (eight slots). Seen on
SwiftShader by `tools/enhancedLightingProbe.mjs` - every assertion
standing - and the scenes' PNGs beside EL5's for the eye.

## AUDIT LIGHTING - THREE LENSES OVER THE DAY'S FIVE (2026-09-23, Mac: "Before we do that can we audit everything so far")

Three read-only lenses over LIGHT-NEAR1, QL-WEIGHT1, LC1, SC1 and HQ1
before the second arc's last step, and what they found paid in one
commit. Ranked as found.

**QL-WEIGHT1 refused every quest item (HIGH).** The take goes through
`planTake`, and the plan's quest arm refuses a quest item it cannot
resolve (DFU's :1489, `getQuest: null`) - and no loot hooks carry a
resolver, so a "kill X and bring back Y" corpse said "You cannot remove
this item." through the quick door and, the refusal being truthy,
never opened the window either. `quickLootTake` takes the host's own
resolver beside the hooks now (`{ getQuest }`, the same closure each host
hands the inventory window), seven calls in four hosts. And QuickLootAll
says WHY the rest stayed on the one line with the count.

**HQ1's horizons, four ways wrong (HIGH).** The committed shader's
horizon sides were assigned against the projected normal's sign for the
horizontal slice (right on floors, where gamma is 0; a corridor wall
seen obliquely read 0.17 where 0.9 was due); the aspect on the y step
was upside down (a vertical slice reached a third of the radius); a
depth read landed on a whole texel while the point was reconstructed at
the sample's own coordinate, so a flat floor stood a hair above and
below its own plane and shaded itself (0.73 far off); the bias was a
distance guard, not a plane guard; a slice the normal had no part in
added a whole unoccluded slice. Now: the point is the texel's (`texelUV`
snaps to the canvas pixel), the plane guard is `dot(s, n) > bias`, the
march is a circle in view space (`dir.y` carries |proj[5] / proj[0]|),
the slice's plane is exactly the marched step's (`sliceDir` = the view
step a uv step is, through the terms `posAt` divides by - the sign and
the aspect fall out), an empty slice adds nothing, the falloff is the
reference's share of the radius (`AIR_AO_FALLOFF` 0.6), the rotation is
a quarter turn (a slice is a line; sixteen levels over a whole turn were
four orientations said four times, which paired rows on the probe). And
the last of them, found by the probe's flat floor still reading 0.97: a
slice's unoccluded visibility is |np| (cos gamma + gamma sin gamma),
which is one only AVERAGED over every slice direction (0.2 to 1.55 for
one slice of a floor seen at a grazing angle), so two slices of one
pixel read 0.87 to 1.09 by the pixel's rotation - and clamping each
pixel to one before the blur averaged the losses and kept none of the
gains. The pixel stores its share unclamped at half scale
(`AIR_AO_STORE`) and the blur, which averages exactly one tile of
rotations, is where one is one again and where the strength and the
clamp are applied. A normal from the nearer neighbour each way (the
silhouette mitigation the lens asked for) was tried and read worse on
SwiftShader (the flanks 0.71 / 0.95), so the quad's derivative stands
with the depth-aware blur guarding its edges. `tools/aoProbe.mjs` (new)
reads the picture back on SwiftShader: the open floor 1.000 at every
depth, the crate top 0.996, its two flanks symmetric (0.960 / 0.971
where the old kernel read 0.910 / 0.959) and a little darker than the
open floor (seen edge-on, the march barely meets them), its front - the
wall that faces the eye - darker by a sixth (0.843).

**LC1's near band (MEDIUM).** A light whose sphere reached in front of
the near slice (depth - r < 0.25) was written to no cell a fragment
nearer than 0.25 could land in - a hole an arm's length from the eye.
`cellsOfSphere` flags `nearFull` and the build writes such a light to
every tile of slice 0.

**SC1's classifier (MEDIUM, perf).** The motion memory was one matrix
PER MESH, and the hosts draw one GPU mesh at many matrices - a dungeon's
action doors share a model, the windmills, the city gates - so two doors
of one model read as moved on every draw and every lantern near them
paid the blit and the dynamic replay forever; the "still room costs
zero" claim failed in any dungeon with two doors of one model near a
lamp. The memory is per PLACEMENT now (`_shInst`: a draw matched to the
remembered placement nearest its translation within
`SHADOW_INSTANCE_REACH` 2, up to `SHADOW_INSTANCE_MAX` 64, and past that
dynamic - never a wrong shadow). Four more in the same pass: a batch
built dynamic (`_dyn`, the gibs) is dynamic from its first sight; a
flat's FRAME is in the memory (an animated flat froze in the cache); the
floating origin's crossing is TOLD to the pass (`shadowOriginShift` from
world.js's recentre block; a generation and cumulative offsets rebase
each remembered placement on its next draw) where before every still
caster read as moved for `SHADOW_DYNAMIC_HOLD` frames - a near-empty
cache per slot, the whole town replayed as dynamic for a second, then
rebuilt again; `_dynamicNear` skips what the replay skips (a moving
flame, a no-cast archive, a short flat, a ghost); the cache's fifty
megabytes are made on the first frame that wants them, not under
`?shadowcache=off`. Two were kept as known at first - the wind's sway not
in the signature, and the hosts' culling of casters to the view frustum -
and are paid in SHADOW-REACH below.

**LIGHT-NEAR1's snapshot (LOW, latent).** The panel-frame snapshot
stored the lights without their carried mask and restored them through
`setPointLights`, which cleared it - and with the distance rule gone the
mask is the ONLY thing keeping the hand's torch out of the caster slots.
Every host sets its lights right before `beginFrame`, so it never bit;
the snapshot carries `pointCarried` now.

Checked and clean: the tonemap's JS and GLSL twins term for term, every
caster-sized array following `SHADOW_POINT_CASTERS`, the carried mask
through every host that composes a player light, the shadow cache's GL
state (READ/DRAW bindings reset, blit legality, no sampler on the cache),
the hold, the signature's order-freedom, slot refills, the door both
ways.

Pinned: `test/audit_lighting.test.js` (the two doors, the crossing, the
gib and the frame, the flame that is no reason, the lazy cache, the
mask through a panel, the curve's laws), quickloot (the ring through the
door, the seven calls), lc1 (the near band), el3 (the shader by text).
Campaign: `tools/mutants/auditlight.json`, 22 mutants, 22 dead.

## SHADOW-REACH - THE CASTERS THE VIEW CULL REJECTS, AND THE SWAY (2026-09-23, Mac: "Can you tackle the 2 limitations")

The audit's two known limitations, paid.

**The reach.** The exterior hosts cull what they draw to the view
frustum (EV3: the pixel, then each model and flat batch of a visible
pixel; PERF-CROWD: the townsfolk), and the shadow maps are replayed from
what they drew. So a tree behind the camera cast no sun shadow into the
view although the sun stood behind it too; a wall just off screen cast
none from the lantern beside it; and SC1's caches churned as the camera
turned, because the still set in a lantern's reach changed with the view
- a rebuild per affected lantern per frame of rotation, which is the
churn the audit wrote down. The pass answers a new question now,
`reaches(box)` (and `reachesSphere`): would a caster here cast into THIS
frame's maps - inside a sun cascade's frustum (the cascade is an
orthographic box about the eye reaching `SHADOW_SUN_DEPTH` 600 toward
the light, so what stands between the sun and the view is inside it) or
within a point caster's range - against the casters `render()` picked
from this frame's lights. The records are a frame old by design (EL2),
and so is the reach. The renderer exposes it (`shadowReach`,
`shadowReachBatch` on the sphere `batchVisible` builds) beside three
RECORD-ONLY seams - `recordShadowMesh`, `recordShadowTerrain`,
`recordShadowBillboards`: the record `drawMesh`, `drawTerrain` and
`drawBillboards` make, with none of their draw - and both exterior hosts
ask at every cull gate: world.js's pixel gate (an off-screen pixel in
reach records its ground, its merged statics and its odd models), its
model, sail, flat-batch and crowd gates, and exterior.js's draw list,
sails and flat batches. The flats the gates reject collect and are
recorded after the crowd's draw, on the frame's wind. What the cull
rejects and no shadow reaches costs what it did: one box test more,
against at most eight spheres and three frusta. Interiors and dungeons
cull nothing and needed nothing.

**The sway.** A flora batch leans with the wind (WIND3: the crown moves
by the wind's rate times the batch's `sway`, on a clock that runs every
frame), so while a wind blows its silhouette is never twice the same -
a lantern's cached shadow of it held one phase. `recordBillboards`
reads the record's wind: a batch with `sway` under a wind with any rate
is a DYNAMIC for as long as the wind lasts (drawn over the cache at
EL8's cadence, the cache holding no lean) and still the moment it
drops, with no hold - it did not move, it was moving. A batch without
sway stands in the cache under any wind.

Pinned: `test/shadowreach.test.js` - the reach against a lantern's
quantised far (the corner nearest the light), a translated box, the sun's
cascades (behind the eye toward the light within the depth, across the
light within the far radius, and past both), the classic set; the
record-only seams (five records, not one GL call, replayed into the
cube; silent in a panel); the sway (a tree dynamic while the wind blows,
still the frame it drops, a post never); both hosts' gates by source.
Campaign: `tools/mutants/shadowreach.json`, 11 mutants, 11 dead.
`tools/shadowCacheProbe.mjs` and `tools/enhancedLightingProbe.mjs` still
green on SwiftShader.

## VOL1 / BOUNCE1 - THE LANTERNS' GLOW THROUGH THEIR SHADOWS, AND THEIR BOUNCE (2026-09-23, Mac: "Continue" - the second arc's last step)

**The glow, marched.** EL1's glow (`elInScatter`) was one closed-form
integral per lantern per FRAGMENT, in every world shader, walked over
every light of the frame (LC1 left that loop unclustered) - and it knew
nothing of what stood between a lantern and the air: a lamp behind a
pillar glowed through it, a lantern in the next room lit this room's
air. The glow is the air pass's now (`volFs`, airPass.js), at the
bloom's size: per pixel, the view ray is cast through `posAt`'s own
terms into the world, and each lantern's overlap with it is walked in
`AIR_VOL_STEPS` (8) steps jittered by EL6's ordered pattern, each step's
share of the same integrand the closed form integrates (1 / (h^2 +
s^2), `elScatter`'s) let through by the lantern's own cube map - one
tap, `pointShadowOne` in the shadow block, no normal (the air has no
surface to bias against); a lantern with no map (the hand's light, one
past the eight) keeps the closed form. The sum is tonemapped as
`elFinish` tonemaps the glow it adds - the lane's curve, the exposure
and the eye - blurred once over the jitter's tile BY DEPTH (a plain
blur put the bright air past a near wall's edge onto the wall that
hides the lantern; the lighting probe read that wall a third brighter),
and added to the display-linear frame at the resolve. The lane's own
glow is 0 on a world frame the air pass glows for and stands where the
pass draws nothing - a panel, a sprite pass, a bake, `?volumetrics=off`
- the gate the contact block and the grid already take. The air pass
is a leaf still: the lane hands it its curve and its integral
(`EL_TONEMAP_GLSL`, `EL_SCATTER_GLSL` - one law, now shared and not
copied) and the renderer the shadow block. Fewer pixels walk the lights
(a sixteenth), and a wall throws its shadow into the air.

**The bounce.** A lantern's light lands mostly on the floor and the
walls about it and comes back diffusely, so nothing near a lamp is
pitch black on the side that faces away and a ceiling over a lamp is
warm. `EL_BOUNCE` (0.18) of the light's attenuated colour, weighted by
how much a surface faces the lit ground (0.5 - 0.5 n.y: a ceiling
most, a wall half, a floor least - it faces the ceiling, which is lit
least), through the lantern's shadow read a REACH off the surface
(`EL_BOUNCE_REACH` 1.5 along the normal, one tap of the cube map).
The first cut read no shadow at all, and a lantern in the next room
bounced light onto this room's wall - the lighting probe caught the
wall between the eye and lantern A a third brighter; shadowed at the
surface the bounce could fill no shadow, which is what it is for. A
reach off, a wall between rooms is still in the lantern's shadow
(dark), a pillar's back a reach behind a thin pillar is not (filled),
a ceiling a reach under itself over a lamp is lit (warm). A flat,
standing upright, takes a wall's half through its base's own shadow
(one value for the whole sprite, as its direct light). A lantern with
no map bounces unshadowed, as its direct light is. `?bounce=off` for
the eye.

Pinned: `test/vol1_glow.test.js` - the march by source (the leaf, the
three blocks handed in, the ray, the early-out, the closed form for a
lantern with no map, the integrand and the jitter, the tonemap, the
depth-aware tile blur, the resolve's add, the renderer's gate and the
gain in `prepare`); on the fake GL (the shader built with the three
blocks in its source, marched and blurred on a world frame with a
lantern in a fogged air, the lane's own glow 0 there and a panel
gated, the door shut clearing the image and handing the glow back);
the bounce (the loop lines, the flat's half, the upload on the lane
and 0 behind the door, the classic set silent). Campaign:
`tools/mutants/vol1.json`, 14 mutants, 14 dead. `tools/volumetricProbe.mjs`
(new) on SwiftShader: a crate between the eye and a lantern - the
crate's front, its air in the crate's own shadow, reads a sixth darker
through the march than under the closed form, and the floor whose air
is lit reads the same either way within a third of a percent (the march
sums the closed form's own integrand).
