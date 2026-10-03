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
is recorded: a mesh at the matrix it was drawn with last frame, its
vertices as they were, is static; one that moved, or whose vertices a bake
moved (updateMeshVertices' generation - a sail re-baked in place: AUDIT
PRE-MERGE 0928 R1), is dynamic - and stays dynamic for
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

## VOL1 - THE LANTERNS' GLOW THROUGH THEIR SHADOWS (2026-09-23, Mac: "Continue" - the second arc's last step; BOUNCE1 shipped beside it and was withdrawn by its audit)

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

**The bounce, withdrawn.** BOUNCE1 shipped with VOL1 as a share of a
lantern's attenuated colour weighted by facing the ground, read through
the lantern's shadow a reach off the surface, and the audit the same
day (AUDIT REACH, below) found the model unsound rather than mistuned:
a bounce with no visibility from the bounce source (the lit floor)
either leaks through walls - unshadowed, and every lantern past the
eight casters has no map to shadow it by, so walls popped as lanterns
took and lost their slots - or fills nothing it was meant to fill (a
pillar's flat back is deeper in the umbra a reach off; a wall between
rooms is dark either way) and adds only where the light already lands.
The term is gone, the reason stands in enhancedLighting.js where it
stood, and real bounce is its own step: a reflective shadow map, a
colour and a normal beside the depth in the cube pass.

Pinned: `test/vol1_glow.test.js` - the march by source (the leaf, the
three blocks handed in, the ray, the early-out, the closed form for a
lantern with no map, the integrand and the jitter, the tonemap, the
depth-aware tile blur, the resolve's add, the renderer's gate and the
gain in `prepare`); on the fake GL (the shader built with the three
blocks in its source, marched and blurred on a world frame with a
lantern in a fogged air, the lane's own glow 0 there and a panel
gated, the door shut clearing the image and handing the glow back);
the bounce withdrawn (no term, no door, the reason in place). Campaign:
`tools/mutants/vol1.json`, 18 mutants, 18 dead. `tools/volumetricProbe.mjs`
(new) on SwiftShader: a crate between the eye and a lantern - the
crate's front, its air in the crate's own shadow, reads a sixth darker
through the march than under the closed form, and the floor whose air
is lit reads the same either way within a third of a percent (the march
sums the closed form's own integrand).

## AUDIT REACH - THREE LENSES OVER SHADOW-REACH, VOL1 AND BOUNCE1, AND THE AUDIT BEFORE THEM (2026-09-23, Mac: "let's do an audit")

Three read-only lenses, each on Opus 5.5, over the day's last three
commits; the findings paid in one.

**SHADOW-REACH (HIGH): the sway rule handed SC1's saving back.** The
wind outdoors is never zero under the enhanced sky (the deck's drift
drives it, a sunny day at 70 on the lab's slider of 200), a flora batch
spans its whole pixel, and `_dynamicNear` counted one, so every lantern
in a pixel with a tree paid the blit and six dynamic faces at EL8's
cadence - about the pre-SC1 draw count, for a lean of a few texels at
the crown. The lean is real (a sunny day moves an eight-unit crown four
texels at a lantern's range), so it is not dropped: a batch leaning
under `SHADOW_SWAY_STILL` (0.02, half a texel) at its crown is still
(`swayLean`, the shader's own push at the gust's peak), and one leaning
more is a dynamic on ITS OWN cadence - `SHADOW_SWAY_EVERY` (4) frames,
the sway being slow - while a mover near the same lantern keeps the
mover's. `_dynamicNear` answers three ways now (nothing, sway alone, a
mover). **(MEDIUM) The reach and the signature measured different
volumes**: the reach tested a lantern against the caster's box, the
cache's signature counts it by its bounding sphere, so a caster in by
the sphere and out by the box was recorded on screen and dropped off it
- the churn the reach exists to end. The lantern part of the reach
tests the box's enclosing sphere, a superset. **(LOW)** a pixel neither
seen nor reached walks no batch (the far-flat rule ran for every batch
of every pixel); online peers take the reach as every other flat does.
Accepted and written down: a lantern newly among the eight builds its
cache once more a frame later (the reach reads this frame's casters,
the replay is a frame old); the far cascade's planes can be a frame
stale on the first exterior frame after an interior; a frame with
nothing on screen reaches nothing for one frame.

**The audit commit (MEDIUM, three): the placement memory and the flat
memory.** `_moved` matched a draw to the NEAREST remembered placement
within the reach, so two still placements of one mesh closer than two
units - double doors, an arrow beside another - overwrote each other
every draw and read as moved for ever: the placement itself is matched
first (within the epsilon), a placement already claimed by a draw this
frame is never another draw's, and only a draw at no placement takes
the nearest as its own last step. The memory capped at 64 and never
evicted, on a mesh cache that is never destroyed - a session's dungeons
filled a door model's memory and every door after was dynamic: 128, and
a placement not drawn for a hold is evicted for a new one (with every
placement live the new one is dynamic, never wrong). The flat memory
watched `frame`, and a townsman's idle and a foe's swing rewrite
`record` (the texture key is record#frame) and turn by the sign of
`size.w` - the cache kept a stale silhouette: the record and the flip
are in the memory. **(LOW)** the records in hand at a recentre were
replayed against the moved lights and eye, so the crossing's frame had
no shadow and every cache was built twice: `shiftOrigin` moves the
matrices and spheres the pass copied (a batch's origin is the host's
own, already moved). And quick loot's count line guards a refusal with
no text.

**VOL1 (HIGH, the probe): the glow was too small a share of what the
probe read.** On a lit floor the glow is a two-hundredth of the pixel,
and the probe's checks passed with the glow dead (uScatter 0) and with
the ray wrong (the view's rotation untransposed). `tools/volumetricProbe.mjs`
reads three frames of one scene - BASE with no glow anywhere, the march,
the closed form - and checks the DIFFERENCES: the sky above the lantern
glows through the march by more than a byte (the closed form, with no
fragment on the sky, never did), a dark far floor's glow within a fifth
of the closed form's, the crate's shadowed front under a third. **(MEDIUM)
A stale world's images over a frame that is not the world's**: a menu's
or a video's frame binds the frame target too, and its resolve painted
the last world frame's glares, shafts and glow over it (the glow was the
first to show, a full-screen halo over a menu). The pass marks the frame
it was PREPARED for (`fresh`), draws its images for that frame alone,
blanks them and skips the measure otherwise, and the lane's own glow
gate reads it. **(MEDIUM) Tonemapping each pixel before the blur dimmed
the halo's core** by a quarter at a lantern's range of 14 (Jensen: the
mean of a concave curve's values is under the curve of the mean), and a
lantern's core changed brightness as it took or lost a caster slot: with
a float target (`EXT_color_buffer_float` or `_half_float`, RGBA16F) the
march stores LINEAR light, the tile's blur averages light, and a tone
pass curves the average once; without one the old path stands, said so.
**(MEDIUM) The eye and the bloom were blind to the glow** - it was added
after the luminance and the bright pass read the frame, so a foggy
lantern-lit street adapted to a darker frame than it showed and no halo
bloomed; both read the glow's image now. **(MEDIUM) The march walked a
slab** - the closed form's range either side of the closest point - so a
ray that missed a lantern's sphere glowed a little from air the light
never reaches, and paid eight taps for it; the march and the closed form
walk the ray's CHORD through the sphere (`elScatter` too, one law). A
shader the GL refuses costs the glow alone (`vol: null`), not the air
pass. Noted: the glow reaches the sky now, which is right, and runs to a
water's bed (water writes no depth), which is not - a water depth is its
own step. The march's cost is the quarter-res pixels times the casters
whose sphere the ray crosses, times eight taps.

**BOUNCE1 (HIGH): withdrawn** - see VOL1 above.

Pinned: `test/audit_reach.test.js` (the double door, the eviction, the
record and the flip, the crossing's records), `test/shadowreach.test.js`
(the sway's cadence and floor, a wind along z, the enclosing sphere, a
box above the lantern, a translated box against the sun, a sphere's
radius, a flat's lift, the no-caster guard, the seam's wind, the
off-screen pixel's models, the peers), `test/vol1_glow.test.js` (the
chord, the linear path and the tone pass, the fresh gate and the blank
frame, the eye and the bloom reading the glow, the guarded build, the
bounce gone). Campaigns: `tools/mutants/auditreach.json` 8, `vol1.json`
18, `shadowreach.json` 19 - all dead; fifteen records across nine lists
re-aimed by content.

## DISC6-E - THE CEILING LAMPS THAT FLASHED (2026-09-23, Discord through Mac: "in shops and taverns the point lights in ceilings make everything flash/flickering")

The nearest-`SHADOW_POINT_CASTERS` pick swapped near-ties on every step and head-bob, and the lamp that lost its
cube map lit through the ceiling for a frame. `render/shadowPass.js` `CASTER_KEEP_RATIO` (0.8): last frame's
casters (`holdCasters`, matched by position) are measured at 0.8 of their distance, so a newcomer must be clearly
nearer to take a map. Record: `01-Overview/Field-Bugs-2026-09-23.md`. Pinned in `test/disc6.test.js`; `tools/mutants/disc6.json`.

## DISC15 - EVERY LIGHT IN A ROOM CASTS (2026-09-24, Mac: "Constant reports of interior light flickering. Opus seemingly always considers it solved. Its not solved")

DISC6-E was not the cause, and this time the cause was MEASURED before a line changed. A harness (the real renderer on
SwiftShader, the real `buildInteriorContext` over ARENA2's TVRNGM03 - a tavern, twenty lamps of range 15-18 over a
building 25 x 18 on two floors - the interior arm's own light composition, a scripted walk, every frame read back)
found two things, both from the same root: only the eight lamps nearest the eye had a cube map.

- **The swap.** A lamp without a map lit through walls, floors and ceilings at full strength. Every walk across the room
  swapped lamps in and out of the eight - DISC6's keep margin only moved where the swap happened - and each swap lit or
  unlit whole surfaces through the ceiling: 30-98% of the screen moved by 12+ levels in one frame, at each of the nine
  caster changes of a 319-frame walk. 582 of the 4086 building interiors have more than eight lamps (the taverns, the
  guilds, the big shops - the rooms the reports named); 170 have more than sixteen.
- **The march.** A lamp without a map took EL8's contact march over the previous frame's depth, and on the first frame
  the eye moved after standing or turning it shadowed 40% of the screen dark for one frame (a grazing wall marched
  through a frame-old depth). `?contact=off` removed it; a stable light order did not (not an index bug).

**The lo tier** (`render/shadowPass.js`, DISC15): in a room its host draws WHOLE, every light the caster table can name
keeps its own cube map of the room's static casters at SHADOW_LO_SIZE (256), six layers of a second depth array on
SHADOW_LO_UNIT (8) - sticky by position like SC1's slots, drawn when the light arrives or moves, redrawn for a changed
static set SHADOW_LO_REBUILDS (2) a frame with the old map standing meanwhile. The eight keep their 512 maps with the
movers on top; every other light reads its lo map (`uCasterOf` = SHADOW_POINT_CASTERS + j; the lo map's light and far
are the light's own `uPointLights[i]` and `shadowFarFor` of its range, the same float arithmetic in JS and GLSL). A
change of the eight now changes a shadow's resolution, never whether the ceiling is there, and no indoor lamp is left
for the contact march. The same walk after: caster changes move at most 2% of the screen by 12+ levels (d1 <= 1.74),
and the one-frame flash is gone.

- **Who asks.** `renderer.everyLightCasts()`, each frame before beginFrame, from the two building hosts (the world's
  interior arm and `?interior=`) - the hosts that draw everything, so every static caster is in the records. A host
  that culls by view (the street) does not ask: its records miss what the view rejected, and a lo map of
  them would change as the camera turned. Consumed per world frame, so a host that does not ask never has it.
  (LA-SHADOW3, 2026-09-27: this line first counted the dungeon among the view-culling hosts. Neither dungeon host
  culls - each draws the level's static batch whole, every unbatched model and every mover - and both ask now; see LA
  below.)
- **The door.** The records a frame replays are the last frame's, so the first frame through a door had the street's:
  that frame drops them (nothing casts, once) and the tier runs from the next frame on the room's own. Before, the
  eight 512 maps were drawn from the street's walls for that frame.
- **The cost.** A tavern's twenty lo maps are 120 face replays on the second frame inside (about 3300 draws on
  TVRNGM03), then none while the room is still; the array grows by SHADOW_LO_STEP (8) slots - 24 for a tavern, 1.5 MB
  a slot (six 256 x 256 layers of 4 bytes), 38 MB - and is never shrunk. The lo maps hold no movers: a walker casts from the
  eight alone.
- **The look.** A corridor or a room with no lamp of its own is now lit by its ambient and what comes through its
  doors - it was lit before by the lamps in the rooms around it, through the walls, and that light is exactly what
  came and went as the eight changed.

Pins: `test/disc15.test.js` (8); the source pins that quote the lit loop, `shadowOfLight` and the air's march re-aimed
(el2, el5, el8, lightnear1, audit_reach, vol1, audit_lighting's array count). Mutants: `tools/mutants/disc15.json` 16,
all dead; el3/el5/el8/vol1 records re-aimed by content, all still dead.

## DISC7 - THE CONTACT MARCH READS THROUGH ITS RECT (2026-09-23, Mac: "fix the known gaps")

EL8's contact block sampled the previous frame's depth at the clip-space UV as if the world viewport were the whole
canvas; under a docked large HUD every sample came from the wrong row and near the bottom from the bar's cleared
strip. `holdPrevRect` keeps the rect the depth was written under (with the view-projection, in `prepare`) and
`prevDepthUV` maps through it, as DEPTH_GLSL's `depthAt` does for every other screen pass. Record:
`01-Overview/Field-Bugs-2026-09-23.md` (DISC7). Pins: `test/disc7.test.js`.

## LA - THE DEEP AUDIT: THE SHADOWS HOLD STILL (2026-09-27, Mac: "a deep audit on the enhanced lightning system, look for flickering issues, performance improvements and just a complete detailed overhaul to make this insanely better")

DISC15's lesson stands at the head of this one: a flicker is a number or it is a guess. `tools/lightFlickerProbe.mjs`
drives the WORLD host (the one players run) over ARENA2 in headless Chromium on SwiftShader, stands in a night street
before a tavern, walks into the tavern and into a dungeon, and reads EVERY frame back while the camera stands still,
walks (a pendulum along the room's most open heading) and turns: `c12`/`c4` the share of the screen whose luma moved
12+/4+ levels in a frame, `flip` the share that moved 8+ one way and 8+ back the next (a flicker's signature), `ms`
the frame callback's time, the GL calls by name, and the shadow pass's own counters. Nothing leaves the machine.

- **LA-SHADOW1 - the sun's grid is snapped beside the eye.** `sunCascadeMatrices` snapped the WORLD ORIGIN's texel,
  which makes a pure translation of the eye move nothing on the map - but the sun TURNS every frame, and a turn slides
  a point's texel phase by its distance from the snapped point times the angle. The floating origin recentres every
  819 units, so the ground under a player sat up to 400 units off it: up to half a cascade-0 texel a frame, every
  shadow edge beside a standing player crawling. The snap is taken at an anchor now - the eye rounded to
  SUN_ANCHOR_STEP (8), held until the eye is SUN_ANCHOR_HOLD (24) from it, carried by `shiftOrigin` - so the lever is
  a tenth as long or less (under 0.02 of a texel a frame at 400 units out, against the base's 0.2+). And the basis's
  up is the world's Z, which the sun's path (worldClock.js: x cos, y sin, z 0) never crosses: the old up flipped from
  Y to Z within eight degrees of the zenith, turning the whole grid ninety degrees in one frame at 11:28 and 12:32.
- **LA-SHADOW2 - the cascades hand over in a band.** The pick was a hard line at 0.9 of each radius: a shadow crossing
  it changed its texel four- or fivefold, its normal offset (an edge stepped sideways) and, at the far line, its
  kernel - a ring about the player that popped every shadow it swept, and a tree's whole sprite (a flat reads one
  value at its foot). Past the far box the shadows ended at its square edge, a line that turned with the sun. The one
  cascade's lookup is `sunCascadeTap` now; `sunShadowTap` mixes the next cascade in over the last SUN_CASCADE_BAND
  (0.2) of the reach before each line, and fades the far one to lit by distance, reading nothing past its fade. Two
  lookups only in a band.
- **LA-SHADOW3 - every dungeon torch casts.** DISC15 gave every light in a room its own lo map, but only where the
  host draws the room whole, and it counted the dungeon among the view-culling hosts. Neither dungeon host culls: each
  draws the level's static batch whole, every unbatched model and every mover. So a torch past the eight lit through
  the rock and the eight changing as the player walked lit and unlit whole walls - DISC15's tavern flicker, in every
  dungeon. Both dungeon hosts ask for the tier now (`renderer.everyLightCasts()` before beginFrame). The cost is
  DISC15's: each torch's lo map is drawn when it arrives and then served; a light that MOVES past the eight (a thrown
  torch, a burning foe, the court's glow on the boss) is a new light every frame it moves and redraws its six 256
  faces, as it has in the buildings since DISC15 - the player's own candle, torch and muzzle flash are carried and take
  no map. (LA-AUDIT A1 and A2 priced that and cut it: each face drew the whole level. And a peer's torch is carried too
  - PEERLIGHT1 marks it so to spare its glare - so it takes no map and lights through the rock: A3, recorded.)
- **LA-SHADOW4 - a torch's flicker is not a new light.** PERF-FLICKER rounds a shadow's far up to a quantum of 4, which
  swallows the town lantern's wobble (AnimateLight: 16.6 to 18.4, all 20) but not a dungeon's, where each light
  flickers about its own radius-derived range: a range of 12.3 wanders 10.9 to 12.7 and its far flipped 12 <-> 16 at
  every crossing - each such torch among the eight redrew its six static faces, and each lo map the same, unbudgeted.
  The probe caught it standing still: nine frames in forty redrew a static cache, with nothing in the dungeon moving.
  `heldShadowFar` keeps the far a map was drawn to while the range stays within it and under SHADOW_FAR_HOLD (8) short
  of it; the caster table's word carries a lo map's far above the slot's byte (`casterWord`; the shader's `loFarOf`,
  which derived it from the live range, is gone).
- **LA-LIGHTS1 - a lantern's flicker is its own.** world.js refills its lantern pool in `built`'s order and the pool
  INDEX named the animator slot, so a pixel streamed out moved every lantern after it onto another's range - each
  jumping up to 1.8 of its 18 at once, a pulse through half the town at every stream-out of a walk. The slot is named
  by the pixel now (`cityLights.js lanternSlot`) and the lantern's place in the pixel's list.
- **LA-LIGHTS2 - the cap fades, it does not cut.** The lane lights the nearest 48 lights and a town at night holds more
  (the probe's night street had all 48 taken on every frame): every step changed which lanterns made the cut, and the
  one that left went dark at once wherever it lit - a pool of light on a far street switching off, another on. On the
  lane the street now picks one lantern past the cap, and each kept lantern's colour takes its share of its light,
  falling to nothing over the last LIGHT_CAP_FADE (16) units before the first lantern the cap leaves out
  (`capFadeColors`) - so the one that leaves the set leaves it dark and the one that joins joins dark. The hand's
  lights (the torch, the candle, a peer's) are never faded; classic keeps DFU's hard cut. (LA-AUDIT A5/F4: the dungeons
  and the World of Daggerfall mod's selection, whose lights carry their own colours, fade by `capFadePairs` since.)

**Measured** (`tools/lightFlickerProbe.mjs` on SwiftShader, the world host over ARENA2: a night street before a
tavern, the tavern, a dungeon; 40 frames standing, 80 walking and turning; the base `e55e9c64` against the merged
`2661af4e`). Standing still, every scene moved 0% of the screen by 12+ levels a frame before and after. The dungeon's
shadow pass redrew 60 static cube faces in 40 frames standing still, 156 walking and 144 turning before (LA-SHADOW4's
far flip, with nothing in the dungeon moving); after, 0, 12 (and 42 lo faces as torches arrived) and 0, with all 48 of
its lights shadowed. Its frames were the same before and after at this spot - no light past the eight reached a
surface in view - and the tavern's were identical (its lamps do not flicker, it has no sun). The night street's lights
filled the lane's 48 slots on every frame (LA-LIGHTS2). The walk and turn passes differ between runs by the player
body's animation phase, not the lighting. At 09:00 the still street moved only in the sky (the clouds) and on the
player's body, before and after, so LA-SHADOW1/2 rest on their arithmetic (the pins). Two one-frame blips (a few
levels over part of the screen) were seen in 2 of 5 runs of the merged code, each on a frame that drew one extra UI
text quad and the same lighting draws; three re-runs of the same code and walk were clean - recorded, not closed, and
closed by the audit's lens D: BLOOD2e's bleed flash on a character the street had mauled, the same in both trees (AUDIT
(LA) below).

Pins: `test/la_shadow.test.js` (16); re-aimed by content: el2_shadows, perfexta, perfsun_fragment, perfon2_peercull,
disc15, shadowreach. Mutants: `tools/mutants/la_shadow.json` 27, all dead; eight older records re-aimed, all still dead.

## LA-POST - THE POST CHAIN, AUDITED (2026-09-27, Mac: "a deep audit on the enhanced lighting system")

Mac: "a deep audit on the enhanced lighting system, look for flickering issues, performance improvements and just a
complete detailed overhaul to make this insanely better". This package is the screen-space chain in
`render/airPass.js`: the bright pass, the glares, the bloom and shaft images, the eye, the AO blur and the contact march.
Past flicker fixes were declared solved when they were not, so every finding below was checked against the code and
MEASURED on the shader's own text before a line changed - the GLSL evaluator (`test/glsl.mjs`) running each pass
against synthetic frames and depths, with "the base" (the pass as it stood) run beside it on the same input.

1. **LA-POST1 - the bright pass read four pixels in sixteen.** The bloom image is a quarter of the frame each way, so
   a bloom texel's centre is the corner where the middle four pixels of its 4x4 block meet, and `brightFs`'s one
   bilinear read averaged those four and nothing else. A flame, a glint or a window under ~4 pixels bloomed only while
   it stood on the middle four: measured, a 3x3 flame bloomed WHOLE at 4 of its 16 sub-block places and not at all at
   the other 12 - a halo that popped with every sub-pixel step and every frame of the flame's animation, the camera
   still. Now four bilinear reads at the block's four inner corners (`AIR_BRIGHT_TAPS`, one full-resolution pixel out)
   average its four 2x2 quarters - every pixel once, a sixteenth each - and each quarter is thresholded BEFORE the
   average (`brightTap`), so a highlight that fills a quarter blooms the same wherever it stands: the same 3x3 flame
   puts exactly a quarter of its block's energy in the bloom at all 16 places. A lit field blooms exactly as before;
   the glow (VOL1's `uVol`) joins every quarter before its threshold, as it joined the one read. No Karis weight: the
   frame is display-encoded, a pixel decodes to 1 at most (2 with the glow), so there are no HDR fireflies to tame,
   and a luminance weight would make a lone highlight's share depend on what shares its block. Residue, said plainly:
   the threshold sees 2x2 averages, so a 1-2 pixel highlight still blooms by where it falls (1 pixel never did).
2. **LA-POST2 - the lantern glare blinked.** Three causes, all measured. (a) The size, and with it every tap's place,
   came from the LIVE range, which `CityLightAnimator` walks 0.4 at a time, 14 times a second, over
   [start - 1.4, start + 0.4]: a still lamp's taps slid across texel edges at 14 Hz. A light's glare is sized by a
   range HELD per light, found by its place (`glareKey`, an eighth of a unit a step): `heldGlareRange` takes a rise at
   once and a fall only past `AIR_GLARE_HOLD_BAND` (2, wider than the animator's 1.8), so the held range settles on
   the flicker's top and stays - measured, ten seconds of the real animator upload one size where the live range
   walked it by 0.036; a place unlit for 120 glare passes is let go, and `shiftOrigin` files each hold under its moved
   place. (b) EL7's seven taps were binary NEAREST answers, and three of them - the centre and the horizontal pair -
   stood ON THE LIGHT'S OWN ROW, which is the flat's top edge for every city light (its base for a dungeon light): a
   sub-pixel step of the eye flipped all three together. Measured on a flame wider than the arm, the head's bob moved
   the base's glare by 3/7 at a step. The footprint is EL7's still (two half-sizes above and below, one either side),
   sampled by 28 taps (`AIR_GLARE_TAPS`) that stand off the light's row (0.3 of a half-size at least), each on a row
   and a column of its own so no two cross a texel edge at the same step; each tap is soft in depth (whole within half
   the slack, none past it) and read over the four texels about its point, weighted by where it sits among them (a
   percentage-closer read, `filtered`). Measured over five-pixel slides across and up, near (10) and far (30), narrow
   and wide flames: the largest step is one tap's share, 1/28 - where the base stepped 1/7 across and 3/7 on the bob.
   Filtering cannot make a tap exactly on a moving edge continuous (it turns NEAREST's square wave into a sawtooth);
   keeping the taps off the known edge and on their own rows is what bounds the step. The level stays where EL7's
   footprint put it (0.4-0.5 on the probe's flames, where the base read 0.14-0.43 by sub-pixel phase). (c) JAN1's
   veto was one NEAREST texel zeroing the glare whole; it is the same filtered read, soft over [slack, 2 x slack] - a
   surface clearly nearer than the light at the light's own pixel still hides it whole (the attic floor is nearer by
   1.7 at every pitch of JAN1's geometry), and a beam sliding off the light gives the glare back over several frames,
   a column of the four texels at a time, where the base gave it back in one. A glare with nothing to show now leaves
   the clip volume whole (the doc comment always said "collapsed"; the quad was drawn at vis 0). F11 (the storm's
   flash) and MAC-T1 (the carried light) stand.
3. **LA-POST3 - the bloom and the shafts were bytes of linear light.** A byte of linear light is coarsest where the eye
   is finest: a halo's tail below half a step (~0.002) fell to 0 - four display levels once the resolve adds it at 0.6
   and encodes - so every halo in the dark ended in a hard ring that jumped as the flame under it flickered; one byte of
   the haze over a black ground is thirteen display levels. Where the GL renders to half floats (`volLinear`: the
   glow's own test, `EXT_color_buffer_float` or `_half_float`), `bloom`, `bloomB`, `shaft` and `shaftRaw` are RGBA16F;
   without one, bytes as before. Every writer (the emitters and the glares adding, the bright pass adding, the gaussians,
   the shafts and their tile) writes linear light and every reader (the gaussians, the resolve) reads it so. The
   emitters, the glare and the bright pass of one flame ADD past 1, where the byte image saturated - the gain was
   tuned on that - so `GAUSS_FS` holds its reads at 1 (for writers that add, min(1, sum) is exactly the byte image's
   answer; every later pass reads a blur under 1, where the hold is a no-op): the level is unchanged, the precision is
   new. The AO keeps its byte (a share, not light). `readTarget(name)` reads a target as the bytes a byte image held,
   whatever it is stored as - the probes' read (a half float refuses an UNSIGNED_BYTE readPixels).
4. **LA-POST4 - the eye was stuck in a byte.** The adapted multiplier was ONE byte of log2 over [-2, 2] - 4/255 of a
   stop a step - and a frame's step under half of one rounded back to where it stood. Opening (0.6/s) moves 1% of the
   gap a frame at 60 Hz, so the eye stopped dead with the target up to 55% away (measured: twenty seconds toward 1.5,
   stuck under 1.2); at 144 Hz it never opened at all (five seconds toward 1.1: not one step); a flash closed it by
   whole bytes (3/s) with nothing small enough to bring it back (ten seconds of mid-grey after, still closed). The state
   is sixteen bits (`AIR_ADAPT_STEPS` 65535): the high byte in R, the low in G of the same RGBA8 1x1 image - renderable
   on every GL, no extension. `ADAPT_FS` encodes (`packAdapt`, term for term), `airAdaptLog2` decodes in the eye's
   block (`AIR_ADAPT_GLSL`: every lane shader, the far ring, the glow and its tone pass), `LUM_FS` and `ADAPT_FS`
   (`unpackAdapt`); the images start at [128, 0] (the multiplier 1), and R = G = b decodes to b / 255, so the renderer's
   and the ring's bare [128, 128, 128] images read as they always did. `LUM_FS` held a black tap at log2(1e-9) = -29.9
   stops, eighteen under the range's floor: a cell a quarter black read 4.4 stops darker than its lit three quarters,
   and a dark floor dithered between the bytes 0 and 1 swung the mean with the dither. Each tap's log is held to the
   encoded range now (`lumTapLog`, [-12, 4]).
5. **LA-POST5 - the AO blur dropped far ground.** EL7's depth window was the AO radius (0.8) in absolute units, and the
   ground's view distance climbs ~d^2 / (eye height) per pixel up the screen: measured at 1080p from an eye 1.7 up, the
   tile's outer rows fell out at 30 units (the tile averaged across alone - the ordered rotation's pattern in 8-pixel
   stripes that swam with every step) and at 45 every tap did (no neighbour, the fallback: no occlusion at all). The
   window is `max(radius, AIR_AO_BLUR_SHARE (0.15) x the centre's distance)` - VOL1's blur's own rule, the radius its
   floor: the whole tile counts on ground at 8, 20, 30 and 45, and the sky beside a wall is still no neighbour (EL7's
   law). `tools/aoProbe.mjs` stays all green.
6. **LA-POST6 - the contact march.** (a) F3's check ("the surface was there last frame") held the point's depth to
   the occluder THICKNESS (0.8), so a wall revealed within 80 cm behind a pillar, a townsman or a door's edge passed it
   and marched through the pillar's frame-old depth into its shadow - reproduced on a ray-cast previous frame (a wall
   point 0.78 behind the pillar's face: the base put it at the floor). The tolerance is the surface's own:
   `AIR_CONTACT_SELF` (0.05) plus what one texel of the previous depth spans on this surface at this distance (its
   view distance x the texel's tangent, from `textureSize` and the projection's focal term, x the tangent of its slope
   to the eye, capped at `AIR_CONTACT_SLOPE_MAX` 16; the block reads its host's `uCamPos`, which every lane shader
   that takes it declares first). The revealed wall is lit; the floor at a wall's foot with a lantern behind the wall
   (grazing, ten units off) keeps its contact shadow. (b) Each step's verdict was all or nothing off one NEAREST
   texel per light; it is a claim now - rising over `AIR_CONTACT_RAMP` (0.08) past the 0.02 and easing out over the
   thickness's last quarter - and the strongest darkens toward the floor (`mix(1, floor, occ)`): an occluder eased past
   the thresholds eases the shadow in steps under a tenth where the base dropped from lit to the floor at once. (c)
   The march was NEVER invalidated. `AirPass.shiftOrigin(offset)` rebases the held view-projections for the floating
   origin's recentre (a point p is p + offset after it, `ShadowPass.shiftOrigin`'s convention, so VP' = VP x
   translate(-offset)) and the held eye with them, so a recentre is no cut; `renderer.shadowOriginShift` calls it.
   `invalidatePrev()` makes the next prepared frame march against nothing: the renderer calls it at DISC15's door edge
   (into a room drawn whole or out of one, beside the records' discard). `release()` (the air turned off) cuts too, so
   the air back on never marches a depth from before; `prepare` cuts on an eye that moved past `AIR_CONTACT_CUT` (4)
   since the last world frame (a teleport, a load); and `beginFrameTarget` cuts when the depth it would read as the
   previous was written by a frame that was not prepared (a menu's, a video's). `_images` replays the emitters under
   prepare's own view-projection now (the recompute is gone), so a resolve still owed at a recentre replays the moved
   records under the moved matrix. (d) The steps' clip positions are `c0 + i x dc` - a projection is linear in its
   point - so the march takes two products, not five (pinned equal to the direct product in JS).
7. **LA-POST7 - the glow's gate.** `renderer._airGlows()` zeroed the lane's own analytic glow on every prepared world
   frame, whether or not the air pass could march one: a GL that refused VOL1's shader (`programs.vol` null) was left
   with no glow at all. The gate asks whether the shader built.
8. **LA-POST8 - the perf items.** The frame keeps TWO framebuffers, the colour image with each depth, and binds the one
   it writes (`f.fbos[depthIndex]`) - it re-attached its depth every frame, and a changed attachment is a framebuffer the
   driver checks whole again. A night frame (no beams, no haze) no longer clears the shafts' image: its resolve is built
   without the read (PERF-EXT31), and a frame that draws them writes the image whole (the shaft probes read what the
   resolve adds - nothing - for such a frame; AUDIT VOL1's black images for a menu's frame stand). A frame the pass was
   not prepared for (a menu's, a video's - resolved at its first screen quad, before anything is drawn over its clear)
   runs no bright pass and no gaussians: five passes over nothing; its bloom is `_blank`'s black.

**The renderer.** Three wiring lines, nothing else: `shadowOriginShift` tells the air, the door edge invalidates it
(next to DISC15's discard), `_airGlows` asks for the built shader. The air's re-enable needed no renderer line -
`release()` carries the cut.

**Pinned:** `test/la_post.test.js` (10): the bright pass's footprint (every pixel a sixteenth) and the shader run on a
16x16 frame (a 3x3 flame's energy constant at all 16 places, the base's four-of-sixteen pop beside it, a lit field
unchanged, the glow blooming through the variant that reads it); the glare's taps (28, rows and columns distinct, off
the light's row, EL7's footprint, symmetric) and the vertex shader run on a ray-cast scene (a flame glares and a bare
light collapses its quad; slides across and up, near and far, narrow and wide, each step within one tap's share where
the base stepped a seventh and three sevenths; a beam fading the glare back over frames; a flat eased back through the
slack; the filtered read a half between a flame texel and a wall texel); the held range under the real
`CityLightAnimator` for ten seconds, a real fall followed, the hold by place, the sweep, F11 and MAC-T1; the half-float
targets with and without the extension, `readTarget`'s two reads, the gaussian's hold, the tail the byte image lost; the
eye's codec (the round trip within half a step, [128, 0], the bare images), the dead band at 144 Hz and 60 Hz and the
flash's recovery against the byte eye, `ADAPT_FS` run as `adaptStepStored` byte for byte, `LUM_FS` run on a quarter-black
cell; the AO blur run on ray-cast ground at 8-45 units (the base's two failures beside it) and a wall under the sky;
the contact block run on a ray-cast previous frame (the revealed wall, the real contact, the eased occluder, the stride's
equivalence); the previous-frame bookkeeping on the renderer frame by frame (the recentre no cut, a teleport, a stride
under the cut, the door both ways, the air off and on, a menu's frame between); the glow gate with the shader refused;
the two framebuffers, the night's untouched shafts, the menu's missing bloom. Re-aimed by content (the law kept, the
text new): audit_el (F16's divided eye), audit_lighting (the shift's forwarding), auditretro1 (D5 strengthened, below),
auditretro2 (a menu frame's rect, read by the resolve now), disc7 (the rect held with the cut), el3 (the glare's
presence, the footprint, the tap loop), el4 (the eye's decode and its starting bytes), el7 (the presence, the blur's
window), el8 (the stride, F3's tolerance, the
claim, the two framebuffers), jan1 (the soft veto, the footprint's taps, the centre read apart), perfextd (the bright
pass's glow line, no bright pass for a menu), perfscale (the frame's framebuffers), vol1 (the bright pass's glow, the
gate). Campaign: `tools/mutants/la_post.json`, 42 mutants, 42 dead; 23 records in twelve lists re-aimed by content
(audit_el, bugs5, disc7, el3, el4, el5, el6, el7, el8, jan1, vol1, auditretro2), all still dead. Every airPass.js record
of every list (211, the renderer's at the three wiring sites among them) was run again over the new code, and it found
two that the new code had quietly weakened: AUDIT RETRO1 D5 (the slot swap drops the previous-depth claim) survived
because the new world-depth record catches its menu-in-the-slot case too - its test now also drives two WORLD frames
alternating slots, where the swap is the one guard; AUDIT RETRO2 I6 (a menu's frame reads its whole image) survived
because the bright pass no longer runs for such a frame - re-aimed at the resolve's own upload, which is where that law
lives now. Both dead again.

**The probes** (SwiftShader, headless Chromium): `tools/enhancedLightingProbe.mjs` OK - every lane program compiles and
links, the bloom source a half float read through `readTarget`, the emitter behind the wall blooms nothing through it,
lantern B's glare shows with its flame (1090), not without it (0), not for the torch in the hand and not behind the
panel, the contact march still darkens the wall's foot (0.185 off, 0.083 on); `tools/vc6ShaftProbe.mjs` 6/6 and
`tools/vc7bHazeProbe.mjs` 12/12 on `readTarget`; `tools/aoProbe.mjs` all green. **NOT SEEN ON MAC'S GPU** - the steps
and the rings are measured on the evaluator and SwiftShader; the field decides, and every threshold is a named constant.

## LA-COST - THE LANE'S FRAME, PRICED (2026-09-27, Mac: "a deep audit on the enhanced lighting system")

Mac's whole ask was "a deep audit on the enhanced lighting system, look for flickering issues, performance
improvements and just a complete detailed overhaul to make this insanely better"; this is the package that priced the
lane's frame - what the CPU sends each draw and what the GPU runs each fragment - and paid all seven findings.
Every change but two is bit-identical by construction and held to it; the two that move a pixel say so (LA-COST4's
x^24, one byte in one pixel of the probe; LA-COST5, on purpose).

**LA-COST1 - the frame block goes up once a stamp, and the colours are decoded once a change.** `drawBillboards`,
`drawDecals` and `drawCharacter` each re-sent the frame's whole block on EVERY call: the camera, the fog, the scene's
light (the tint and the sun's half; the decal's and the rig's sun, moon, trilight and direction), forty-eight lights
and their colours - decoded to linear again each time, 144 `Math.pow` - the indirect, and the lane's own block
(`_uploadEl`: the exposure and the glow's gain, the three shadow arrays on their units, `uSunVP[3]`, the cascade
terms, `uPointShadowParams[8]`, `uShadowIndex[8]`, `uCasterOf[48]`, the eye's image, the contact block, the grid's two
textures and four uniforms). On the fake GL with the lane and the air on that is **95 GL calls a billboard call (of
the pin's three batches), 83 a decal call, 84 a body** (97, 85 and 86 since TV1, 2026-09-28: the travel view's `uFocus` rides the fog's upload and `uSunOrigin` the shadow block's) - of which only the basis, the wind and the batches' own, the
atlas and the picture flag, and the model matrix and ranges are the call's. An interior frame makes eight flat calls (its flats, the blood, the dropped torches, the placed
decor, the piles, the foes, the watch, the spells), a decal call per hung weapon (DECOR2c's mounts, every frame) and
the blood pool's, and one call per body - and nothing between them moved a value in the block. Now PERF3's terrain law
runs on all three programs: a per-program last stamp (`_bbFrameStamp`, `_dFrameStamp`, `_cFrameStamp` beside
`_tFrameStamp`), and the block goes up on the first call after `_frameStamp` moves - **28, 12 and 13 calls after
that** (LA-AUDIT F5: the pin compares these numbers now; they were quoted before main's HITFLASH1 and WEAPON-MOUNT gave
a batch and a decal call one uniform more each). A uniform is its PROGRAM's and survives any pass; a texture binding is its UNIT's and does not. So the stamp
moves at beginFrame, the panel's restore and a moved light (PERF3's three), at every setter that changes a value in
any of the four blocks (setFog, setWaterFog, setMoonlight, setAmbientTrilight - setLighting through it -,
setPointLights, setFlashLight, setIndirectLight, setExposure, setContact, setVolumetrics, `_syncAir` for setAir and the
lane), at every seam that forgets the units (`_forgetTextureShadows`: a foreign pass - the far ring binds its own 1x1
on unit 11 when the air is off (LA-AUDIT C3: not Dynamic Skies, whose 2D binds on units 0 to 8 leave unit 8's 2D array
alone) -, the resolve, whose `fresh` flip also moves VOL1's glow gate, the retro present, an
emission upload, a set install), and when the studio bake puts AUDIT-EL F1's bare eye on unit 11. The sprite pass draws
the character program alone under its own camera, fog and light, so it forgets that one block on its way in and on
its way out (`_cFrameStamp = -1`), and the world's other three blocks stand. The terrain's PERF3 block takes every
new word too, which it never had: a mid-frame setter used to leave it a frame stale. `_pointColorData` keeps its
decode (`_pointColorDec`, which it always wrote) under the colours' generation - moved by setPointLights,
setFlashLight and setLightingLane - and the lane that decoded it; fewer lights take the prefix. A 48-light decode is
8.4 us in node, and an interior frame paid it about fifteen times (beginFrame, the air's prepare, eight flat calls,
the decals, the bodies); now once.

**The proof is a differential, not a list.** `test/la_cost.test.js` drives a fake GL that keeps a driver's state (a
uniform is its program's, a binding its unit's, a location null where no attached shader declares the name) through
two frames of mesh, terrain, body, decal and flat draws with EVERY setter, borrow and seam above between them -
including a foreign pass that binds junk on all sixteen units - and snapshots, at every one of its 678 draws, the
bound program's every uniform and units 0..15. The same script on a renderer that re-sends every block at every draw
and decodes every time (the old calls) must snapshot the same, draw for draw; it does, with a third fewer uniform
uploads (12134 against 17796) in a script that moves a setter between nearly every group of draws - the stamp's worst
case, where a real frame moves it a handful of times. Beside it, the LAW READ OFF THE SOURCE: every `this._field`
the four blocks and their helpers read is classed (an input, or a location table, scratch, the memo's keys, a stamp),
and every method that writes an input moves the stamp, calls one that does, runs only inside beginFrame, or is a
borrow that forgets the block it draws - so a new setter cannot land without its word. **Left as it was:** the mesh
program's block is still beginFrame's alone (it never was re-sent at a draw), save the sea's fog (LA-COST6).

**LA-COST2 - the cutout pass sorts by bucket.** `opaque.sort` compared STRING keys: 216 us for 800 batches over sixty
keys (node). `billboardKey` now interns each key to a small integer when it mints it (`_bbKeyId`, minted with the
batch - PERF-EXT10's one shape), and `sortByKey` (billboardKey.js) counts the batches into one bucket per key, orders
only the DISTINCT keys, and places the batches back: **27 us** at 800 over sixty keys, 33 over 180, 91 for 3000 over 300
(879 before), and no worse at the degenerate end (800 distinct: 242 to 210). The audit said order within a key does not
matter to the cutout pass; read against the pass it is true except at an exact depth TIE - two overlapping coplanar
flats (every flat faces the same way, so any two whose origins stand at one depth are coplanar), where LESS keeps the
FIRST drawn. So nothing is relaxed: keys ascend as the string compare had them and a key's batches keep their order,
the order the stable sort gave - held to that sort over 300 random passes.

**LA-COST3 - the flat's sun is read once a quad.** EL_BB_FS read the sun map at the flat's base in every fragment -
the cascade pick, a mat4, TREES1's four compare taps - for the one value the whole quad wears (EL2: `vBBBase` is the
quad's centre, the same at all four corners). The lane now carries its additions to the billboard vertex shader
(`EL_BB_VS_EXT`; `bbVertexShader` in renderer.js puts the declarations before main and the read after every line that
places the corner, so EL1's law that the vertex shaders are the renderer's own stands, text and all), and the read -
the same point, the same `sunShadowSoftAt`, PERF-SUN2's night gate with it - happens per corner and reaches the
fragment `flat`. A tree of a thousand fragments paid a thousand reads; it pays four. The shadow and air passes keep
BB_VS itself. The real GL found the one catch no fake can: a vertex shader's ints default to highp and a fragment
shader's to mediump, and a uniform both stages declare (the receiver block's `uCasterOf`, `uShadowIndex`) must agree
or the program does not link - so the head declares `precision mediump int`. Held by the GLSL evaluator: all four
corners of sixty quads (lit, dark and on an edge, still and in the wind) equal the fragment's old read at the base,
to the bit in float32.

**LA-COST4 - the lantern loop's arithmetic.** (a) The glint's `pow(x, 24.0)` - a log2, a multiply and an exp2 for
every light in range of every lit fragment - is `x^16 * x^8`, four squarings and a multiply, GENERATED from
`EL_SPEC_GLOSS` (`powChainGlsl`), within 24 float32 roundings of the true power where GLSL's pow is only held to its
log2's error (about 8e-6 at this gloss). (b) The eye vector was normalised again for every light in range, inside
the loop (AUDIT BLOOD3 F5/F6 named it and left it there); it stands before the loop, once a fragment, and not at all
where the cell holds no light. (c) The glow's colour curve ran over a black glow in every fragment of every world
frame (uELScatter is 0 there - VOL1 glows in the air pass); it is gated on the gain. (d) `bayer4` built a sixteen-float
table per fragment in every program that dithers; a 4x4 Bayer matrix is a bit interleave of `x ^ y` and `y`, and the
table's sixteen values come out of four shifts. (b), (c) and (d) are equal to the bit, run against the texts they
replaced; (a) moved one byte of one pixel of the probe's eighteen scenes (swapped back to pow, that pixel is the
baseline's).

**LA-COST5 - the contact march is eased out, not cut.** EL8/BUGS-5 F5 marched a lantern's contact shadow to seven
tenths of its range and stopped there in one step, and CityLightAnimator walks a lantern's range in 0.4 steps fourteen
times a second - so the fragments on that shell went from shadowed (to AIR_CONTACT_FLOOR) to unshadowed and back at
14 Hz. Between `EL_CONTACT_FADE_START` (0.6) and the edge the shadow now eases to none (smoothstep); inside 0.6 nothing
moved, and past 0.7 the march still never runs (the hand's light neither). On the lane's own loop in the evaluator:
the step at the edge is gone, and the worst frame-to-frame change of an 18-unit lantern's term at any fragment falls
from 0.047 to 0.012 of the light. On the real GL, the probe's contact scene moved 64 pixels inside the band.

**LA-COST6 - the sea's fog reaches the buildings.** beginFrame clears Deep Waters' distance fog (a frame's) and
uploads the mesh program's fog; the world host sets the fog AFTER beginFrame (`beginDeepWatersFrame`), and setWaterFog
only stored it - the terrain, the flats and the bodies upload at their draws and wore the murk, and every building,
wall and model drew clear through it. setWaterFog sends `uDwFog` to the mesh program at once, setClipY's seam.

**LA-COST7 - a world set's locations are asked of GL once.** `_installWorldSet` runs at every lane swap and twice in
every panel frame (AUDIT-EL F7 puts the classic set in for the automap's bracket or the bank's preview and the lane
back after it), and each time it asked GL for all 270 of its uniform locations again - a string lookup and a fresh
`WebGLUniformLocation` apiece, for answers fixed when the programs linked: a world set's five programs are linked once,
when the set is built, and kept. The lookups now go through `_locations()`, `gl.getUniformLocation` behind a memo per
(program, name), nulls included, kept ON the set (a lane under a new key builds a new set, and brings its own) - so
every table line in the install, `_fogLocs` and `_decalLocs` reads as it did, and only a set's first install asks GL
anything. A panel frame's two installs asked 540 times and now ask nothing; on the real GL (headless Chromium,
SwiftShader) they fell from 172 us to 13 us. Held on a GL whose every lookup is a fresh object, as WebGL's are: through
swaps both ways, two panel frames and a second lane key, every field the install writes equals the field a renderer
that asks at every install builds.

**On the real GL** (`tools/enhancedLightingProbe.mjs`, SwiftShader, all eighteen scenes pixel-compared with the tree
before): identical, but the contact scene's band (LA-COST5) and the one x^24 byte; `tools/lightClusterProbe.mjs` still
pixel-identical grid against plain, and against the tree before but for 604 pixels, by at most 2 of 255, of its
forty-lantern street - LA-COST5's band again (with the hard edge put back, identical).

Pins: `test/la_cost.test.js` (10). Re-aimed by content: audit68_render_a (the import), audit_el (the glint), el1 (the
same lane's no-op, read off the stamp: an install looks nothing up now either), el2 (the march line, the flat's sun at
the corner), el4 (the eye vector, the lobe), el5 and el8 (the march line), glstate (the one forget), hard3 (the batch's
36 fields), lc1 (the loop head), perf3 (the stamp sites, the sort), perfsun_fragment (PERF-SUN2's and TREES1's flat),
volumetricClouds (the sprite's finally). Mutants: `tools/mutants/la_cost.json` (49, all dead); blood1, el1, el8,
macbugw4, perfextb and perfsun records re-aimed by content, all still dead; and the 109 records of every other list
that mutate code this package touched, run again on it - all dead, once el1's no-op pin was read off the stamp (LA-COST7
had made its lookup count blind: `renderer-lane-same-noop` survived until then).

## AUDIT (LA) - SIX LENSES BEFORE THE MERGE (2026-09-27, Mac: "Audit before we merge")

Six read-only lenses read the three packages (LA, LA-POST, LA-COST) at `62ecd090`, each proving its findings with a
driver script against the real modules, and nothing was fixed while they read: A the shadows and the lights (the real
ARENA2 dungeons on the fake GL), B the post chain (every shader through the GLSL evaluator), C the frame's cost and GL
state (a fake GL that keeps a driver's state), D the one-frame blip the Measured paragraph left open (the real game in
headless Chromium), E the merge with main (a trial merge, every check run on it), F the records, the pins and the
claims (mutants, the patch notes, the numbers).

**Fixed.**
- **A1 (the cost): every dungeon lo map drew the whole level, six times.** LA-SHADOW3 gave every dungeon light a lo
  map, and the level is PERF5's one mesh - one sub-mesh per texture, laid end to end, each across the level - so the
  replay's sub-mesh cull passed them all and each 256 face drew 0.85 of the level. Scourg Barrow's entry frame (22
  blocks, 30,377 triangles, 40 lights in range) replayed 23.1M indices, 253 levels (the base without the tier: 3.8M); a
  walk across it 82.6M in 1,200 frames, the worst frame 16.2M (the lo array growing, every slot redrawn); one light
  moving past the eight 455k a frame. `staticBatch.js`'s `shadowCells` sorts the same triangles by the 16-unit grid
  cell of their centroid into a second index buffer (`SHADOW_CELL_SIZE`, about a torch's reach), createMesh puts it on
  a second VAO over the same vertex buffers with each cell's sphere, and the shadow replays cull by cell; the lit
  pass's buffer is byte for byte what it was. The entry frame is 0.79M indices now (1,880 draws where 2,093 were), the
  walk 2.6M (its worst frame, the lo array growing, 0.65M), a mover 7.8k a frame; the CPU of a full redraw (every map
  afresh) is about what it was (4 to 8 ms either way on the fake GL, run to run). Proved on three real dungeons
  (Scourg Barrow, Privateer's Hold, Wayrest):
  over 1,380 faces not one triangle any part of which a face's frustum holds was left undrawn, the cells' buffer is a
  permutation of the lit one, and a face draws 3.5% of a large level (19.6% of a small one).
- **A5 / F4: the cap's fade was the street's alone.** The dungeons still cut at 48 (Scourg Barrow's cap cut at 128 of
  297 lights in range; its walk had 138 joins in 20 seconds, each at full strength) and so did the World of Daggerfall
  mod's towns. `capFadePairs` is capFadeColors for lights that carry their own colours; both dungeon hosts and the mod's
  arm take one light past the cap on the lane and hand the renderer the fade. The gate's court keeps its cut (its
  braziers ride after every light).
- **B1: the contact march's self-check had no term for its own lift.** The march starts 0.02 off the surface and the
  check reprojects that point, which along its own ray stands about 0.02 / cos(slope) nearer than the surface the
  previous depth holds (0.12 on the ground ten units off); LA-POST6's tolerance lacked it and its texel term shrinks as
  the resolution grows, so the floor's contact shadows fell out at 1080p (101 of 400 shadowed rows before a crate 4-30
  units off; 235 of 533 at 1440p, 19 of 269 at 720p, none at the pin's 320 x 200) and pulsed on a walk.
  `AIR_CONTACT_LIFT / ct` joins the tolerance: none lost at any of them, and the revealed wall is still refused.
- **B2: the shafts in half floats kept what the bytes clamped.** LA-POST3's "precision, not level" held for the bloom
  (its gaussian holds its reads at 1) but the shafts never pass through it: heavy fog's haze toward the sun came out
  2.46 times as bright, a sandstorm's 2.80. SHAFT_FS holds its output at 1, and the byte level is back exactly.
- **B3: the bright pass's blocks drifted off the pixel grid** on a rect whose side is not four bloom texels (1366
  wide, a docked HUD's 637 rows, a dpr-scaled window): the centres fell between corners and a 3x3 flame's energy ran
  0.25 to 0.5 at 94 of 1,359 places across a 1366-wide rect (41 of 630 down a 637-row one). Snapping each centre to its corner gathered the drift into a
  column read twice or a row read by none (a flame there bloomed 0); the blocks are whole 4x4s on one grid centred on
  the rect now, at most a pixel from where the image maps them - every interior place 0.25, only the grid's two edge
  blocks, held inside the rect, read a column twice.
- **B5: the eye's sixteen bits read through lowp samplers** (AUDIT-VC7 G2's lesson): a GPU that fetches them at half
  precision returns b / 255 to a part in 2,048, and times 65,280 the stored state came back up to 15.7 steps off every
  frame of the loop - at 144 Hz the eye settled 0.059 stops short. Each byte is rounded before it is scaled, which reads
  the state exactly through any fetch finer than half a byte (the fp16 loop now settles where the fp32 one does, 0.007
  stops), and the three samplers are highp.
- **B6: LA-POST5's share window let EL7's halo back** - a pillar a metre before a wall sat inside 15% of the wall's
  distance, and the wall's texel at the silhouette took the pillar's occlusion (0.737 where the base kept 1.000). The
  AO blur's window follows the surface now: per axis the parabola through the centre and its two neighbours when the
  three are one surface, the gentler side's line past an edge, no line at a ridge, and a tap counts while it is within
  the radius (or LA-POST5's share of the step the surface takes to it) of where that surface runs. The wall keeps its
  1.000; the far ground stays whole to 150 units at 1080p (LA-POST5's own stripes do not come back).
- **C1: the floating origin's shift moved a gated input without moving the stamp** - the air's held view-projection
  is one of the lane blocks' uploads, so a shift between beginFrame and a draw would have left the billboard, decal,
  character and terrain blocks the pre-shift matrix for the frame. Not live (the one host shifts before beginFrame);
  `shadowOriginShift` moves the stamp, so the order does not matter. **C2** (docs): setPointLights, setLighting and
  setFog keep the host's arrays, and the gated blocks read them when the stamp moves - a host writing one in place
  mid-frame must set it again (none does). **C3** (docs): the foreign pass the forget protects against is the far
  ring's 1x1 on unit 11 - Dynamic Skies' 2D binds on units 0 to 8 leave unit 8's 2D array, the lo tier, alone.
- **D: the one-frame blip the LA runs left open was the HUD's, not the lighting's.** It is BLOOD2e's bleed flash: a
  whole-canvas red quad at 0.05 on each drip while the player stands under half health - the runs whose street pass
  had mauled the character below it, and only those. Every blipped frame is the frame before it blended with red at
  0.050 (100.00% of 400,000 pixels within 1.5 levels, both trees; the frame after, -0.0526); forced with
  `playerDamageFlash.bleed()` at full health it reproduces the reported numbers exactly (the tavern c4 15.14%, mean
  1.84; the dungeon 0.90%, 2.07) on base and merged alike; and a character left at 43% health drips on its own and
  gives GL counts byte-identical to the original blip rows (912 and 898 over 895). No UI text reaches the canvas in
  either frame - the "extra text quad" was the flash's own drawScreenQuad. The quad arrives after the last world draw
  and resolves the frame itself; forced EARLIER (a screen quad before or amid the world draws) it is loud and local -
  the world drawn straight to the canvas with no AO or bloom, or a lantern through a ceiling - never a 2-level tint.
  The probe now starts each pass at full health, records the health and the HUD's flash on every row, and refuses a
  pass the HUD flashed in or the player lost health in.
- **F1: the flicker probe passed a black, frozen scene.** With world.js clearing the frame black and the pose door a
  no-op it stood at the spawn, read 0 everywhere, and said OK - it judged only the still passes' 12-level share, its
  boot wait fell through, a plan's exception went unread, and "street" was wherever the boot left it. The summary and
  the verdict are `tools/lightFlickerVerdict.mjs` now, pinned: a boot that never came (the world streams idle in about
  310 s on SwiftShader at night, so the wait is `--boot-s`, 900 by default), a street with no tavern, a pass in the
  wrong mode, black, short or thrown, a walk that did not walk and a turn that did not turn all fail. And the
  churn weighs each join and leave by the light's share (a faded join is no switch; the hand's lights and a recentre's
  frame weigh nothing) - the count could not see LA-LIGHTS2 at all.
- **F2: the street's lantern pool fill had no pin of its own** (LA-LIGHTS1's test ran a copy; a fill that forgot to
  grow its range array past 64 lanterns survived every pin). It is `cityLights.js`'s `fillLanternPool`, which world.js
  calls and the pins run.
- **F3: the Gate Reload patch notes promised an update on quit to every desktop app** - the Mac and the portable Windows
  build are only told a release exists; the note says so per build. **F4: the lighting notes overclaimed** (shadows
  that "hold still", menus that "open quicker", a sprite's sun "once per sprite"); reworded. **F5: stale records** - the
  LA-COST per-call counts and the differential's upload totals (they predated the merge with HITFLASH1 and
  WEAPON-MOUNT; the pin compares the counts now, where it only counted them), four Testing.md rows, two cites wrong
  since before LA. **F6: pins that read source text** - LA-SHADOW2's handover and the lo compare are driven through the
  evaluator now (F-H3: a lo lookup comparing at the live range's own quantum passed every pin).

**Declined, with the reason.**
- **A2: a light holding a 512 map keeps drawing its lo map** - six unread faces a frame for a mover in the eight. With
  A1's cells that is 7.8k indices a frame, and DISC15 keeps the eight's lo maps on purpose (a light that leaves the eight
  has its map, and the hand-over draws nothing); its pins hold that. Tried and reverted.
- **A1's other two cures** - the lo array blitted into its bigger self instead of redrawn, and a cadence for moving
  lights: with the cells the growth frame is 0.49M indices and a mover 7.8k, both under the base's entry frame.
- **A3: a peer's torch takes no map and lights through the rock.** PEERLIGHT1 marks it carried to spare its glare, and
  MAC-T1's carried lights take no map; casting it needs the peer's own sprite excluded from its map (the flame flats'
  EL6 arm) - a feature, recorded. **A4: a lightning flash drops the 48th lantern** at a share of at most 0.008, for the
  0.2 s of the flash.
- **B4: LA-POST4's tap clamp changes the eye** in scenes mixing lit and pure-black taps - a lit street with 5% black
  sits 0.54 stops less open. The base let four black taps outweigh twelve lit ones; the clamp is the fix, not a fault.
- **B7: the glare hold's keys** collide for lights within 1/16 unit and wrap at 16,384, a moving light never holds, and
  nothing sweeps the map while no light burns - bounded (8,832 entries at 48 moving lights). **B8:** the self-check
  refuses still surfaces past about 470 units outdoors (depth precision) - sub-pixel contact there. **B9:** no
  completeness check on the RGBA16F targets - EXT_color_buffer_float makes them renderable by its own terms, and a
  check would have every fake GL answer checkFramebufferStatus. **B10:** a room to a dungeon (both drawn whole) is not
  a cut - harmless while every indoor light holds a map.
- **C4: la_cost's differential** runs no screen quad, no resolve, no retro, render scale or docked rect - C's drivers
  ran 120 frames of those and 55 seams, all equal to the reference; recorded. **D's note:** nothing warns when a world
  draw lands after the resolve (WATER-D1 was one); a once-only dev warning would make the next one loud - recorded.
  **F-H4:** `_images` multiplies the
  frame's projection and view again (it matters only for a resolve owed across a recentre). **E's note:** the
  character caster ignores alphaCut, so fur and hair cards cast card-shaped shadows - as Morrowind hair always has.

**Measured after the fixes** (`tools/lightFlickerProbe.mjs` with the new verdict on the audited tree `cc22c8f0`, the
world host over ARENA2 on SwiftShader, the night street, the tavern and a dungeon, 40 frames standing and 80 walking
and turning): OK, nine passes. Standing still the street moved at most 0.43% of the screen by 12+ levels (a walker's
share), the tavern and the dungeon 0%; no pass drew a HUD flash or lost health. The dungeon redrew no shadow face
standing or turning, and 12 static and 42 lo faces walking (torches arriving); on that walk eight lights joined or
left the set of 48, weighing 0.02 of one light together - the cap's fade (A5) at work, where the base's hard cut
weighs every one of them whole. The world took 310-380 s to boot and stream idle.

**The merge (lens E).** Main (`71450b02`) touches no file under `src/render/`, adds no light, no setter and no
foreign pass; the trial merge's 34 conflicts were numbers only (cites, and the Suite line), every check passed on it,
and no relay file moved. Merged at `bceff1da` the same way (the 34 hunks re-checked against the audit's commit):
12,911 tests, none failing; lint, types and the build clean.

Pins: `test/la_audit.test.js` (12). Re-aimed by content: la_post (LA-POST1's blocks placed by the texel's
gl_FragCoord; LA-POST5's base and the far ground to 150; the recentre's stamp), la_shadow and perfon2_peercull (the
pool fill run), la_cost (the counts compared), and the source pins the fixes' text moved - a10_world_misc,
audit_lighting, auditdisc19, disc15, disc19, el4_frame, el7_polish, perf5. Mutants: `tools/mutants/la_audit.json` 42, all dead; fourteen older records re-aimed by content
(auditdisc19, el4, el5, el7, la_post 7, la_shadow, perfextb, perfon2), all dead.

## DISC29-E - A LAMP'S SHADOW OF A FLAT FACES IT FROM THE FLAT, AND AN IDLER CASTS INTO EVERY LAMP (2026-09-28, Kristian B)

"Interior lighting flickers, and shadows are cast through walls - worst in the Mages Guild." Traced on the real
renderer over the real MAGEAA00 and the Daggerfall Mages Guild (MAGEAA08) - held views, one input changed at a time,
and a CPU emulation of both map tiers against ray-cast truth. Two faults compounded, and a Mages Guild is where both
are largest: BLOCKS.BSA's 27 guild halls stand 9.7 people each, 44% of them idling (the 177.x mages), under 14.6 lamps
- floor braziers, whose silhouettes are large - where a tavern stands 6.1 people, 3% idling.

- **A flat faced the lamp from the world's origin.** A lamp's replay turned every flat to face it with ONE `right` a
  batch, from `b.origin || ZERO_ORIGIN` - and every interior flat is a `createBillboardBatch` batch with its centre
  baked into its vertices and no origin, so the card faced the lamp as if it stood at the world's origin: often
  edge-on (a sliver on the wall) and shadowing its own base, and a flat takes a lamp's light off one lookup half a
  metre above its base, so the whole sprite went dark for that lamp (a smith 29% darker in the probe). BB_VS turns each
  flat to face the lamp from its own centre now (`uFacePoint`, set by the lamp replays alone; w = 0 is BB_VS as it
  was in every other pass), and the player's card, DISC24-C's law, still casts in the basis it was drawn with.
- **An idler cast only into the eight.** Its silhouette changes, so it was a mover forever, and movers cast only into
  the eight 512 maps nearest the eye - DISC15's lo tier held the room's still casters alone. As the view turned a lamp
  left the eight and the idler's shadow left with it (12.5% of the screen popping in the probe, once the facing was
  right). A flat whose place is still for SHADOW_DYNAMIC_HOLD while its look changes is its own class (`_shAnim`), and
  the lo tier keeps it (`REPLAY_LO`) at whatever frame the map was drawn - its signature folds the idler by id and place
  and never its frame, so an idle is no rebuild; a walker, a sway and the player's card stay the eight's.
- **The player's card took the eye's two lamps.** It casts only into maps redrawn every frame (DISC24-C), and those were
  the two nearest the EYE: in third person the eye circles the player, so a turn of the camera moved the silhouette
  from lamp to lamp (twice in half a turn in the Daggerfall guild, the player not moving). The card's two are the two
  nearest the CARD (`_selfCardAt`), and they are redrawn every frame; the eye's two keep the cadence they had.

The record's two new fields, `_shPlacedAt` (the last frame a flat's place changed) and `_shAnim`, are born with the
batch: PERF-EXT10's law is that `createBillboardBatch` mints every field a batch will carry, so every batch keeps one
hidden class, and `render/contract.js` types them. The rerun of the render files' committed mutants caught them
gained after birth (PERF-EXT10's three pins failing), and an older survivor, `el2` glsl-point-off-dark - MUT-AIM's
recorded one: a regex over the whole shader that VOL1's `pointShadowOne` satisfied too. It is pinned by
`pointShadowAt`'s own head now, the record aimed at that one site and off CARRIED_AIM.

"Through walls": the maps do not leak - 0.05% of the lit energy reached an occluded surface in the emulation, and no
lamp lit through a wall or a floor in the browser. What does is a CARRIED light (a torch, a lantern, a Light spell's
candle, and a peer's), which has no map at all: a torch behind MAGEAA00's corridor wall lights 57.5% of the corridor
view through it. Recorded, not changed - a carried light's map redrawn every frame is a cost for Mac to weigh.
`test/disc29_lamps.test.js` (4); DISC24-C's walk re-aimed so the card walks with the eye; the SC1 and WEEDS1 source
pins re-aimed. `tools/mutants/disc29.json` (DISC29-E, 11); seven older records re-aimed by content (auditlight,
auditreach 2, el8, perfexta, perfextb, weeds1). `01-Overview/Field-Bugs-2026-09-28f.md` DISC29-E.

**AUDIT PRE-MERGE 0929 E1-E3** (`01-Overview/Audit-PreMerge-0929.md`, lens E, on the real ShadowPass).
- **E1 - a walker's ghost in the lo lamps.** "A flat whose place is still" was every flat an ORIGIN places, the moment
  it stood: a dungeon foe, a peer, the Warden. The lo tier's maps are rebuilt two faces a frame, nearest the eye first,
  so each time one walked on, the lamps outside the eight - the maps they read - kept its silhouette where it had stood:
  a ghost on 4.7% of the frames of a fight of three under fourteen lamps, 49% under thirty with six; and every stop and
  start rebuilt every lo map in its reach (+20% script time). Only a flat that cannot walk - its centre baked into its
  vertices, no origin - is in place now; a flat an origin places stays the eight's, as before DISC29-E. `_shPlacedAt`
  has no reader and is gone (39 fields a batch, `test/hard3_types.test.js`).
- **E2** - finding the player's card walked every batch of every record, every frame, lamp or none: recordBillboards
  notes it as it passes it (`_selfCard`), and the lamps read it only when one casts.
- **E3 - the card's lamps were the eye's.** The card's two were ranked among the eight nearest the EYE, so with the
  camera 4 m or more away the lamps nearest a still player were often not casters, and the silhouette still hopped as
  the camera circled (MAGEAA00: 12 of 39 spots at 6 m). The two casting lights nearest the card, by the pick's own
  measure and DISC6's hold, are made casters (`reserveSelfCasters`), each in place of the eye's farthest pick.
`test/disc29_lamps.test.js` (5), `test/lightnear1.test.js`'s source pin; `tools/mutants/audit0929_render.json` (4, all
dead).

## AUDIT FLICKER - THE SHADOWS THAT CHANGED WHEN NOTHING DID (2026-09-30, a player through Mac: "interior lights flickering and not casting right on nvidia gpu but not on amd build"; Mac: "investigate shadow flickering with enhanced lighting")

Four passes over the lane - the sun's cascades, the lamps' maps, the frame's records, the receivers - each looking
for a frame where a shadow moved, came or went with nothing in the world moving. The GPU vendor first: none of them
found a vendor-dependent path. No code branches on the renderer string; the pass's GL state is complete at every draw
(no feedback loop, no `polygonOffset`, no `gl_FragDepth`, the layer indices agree between writer and reader, the
NaNs guarded, fp32 margins wide). What differs between machines is the frame rate, and most of what follows is a
record replayed a frame late (EL2) - how far a flat moved in that frame, and how often a record lands dead, is a
matter of frames per second.

| # | What flickered | Why | Fix |
|---|---|---|---|
| S1 | a flat in the sun (a tree, a townsman) lost a third of its light, and stepped as the sun turned | the sun replay draws each flat as an upright card through the very base it reads at, and the soft kernel reaches 2.5 texels up it: past the constant bias once that reach times tan(elevation) passes it - on the far cascade (23 cm texels) any sun over six degrees | `sunCascadeTap`'s soft read lowers its reference by what its own card could hold over it: the kernel's reach up the card (tan(e) a texel), never more than the card above the point (sin(e) a unit up it, the flat's height `h` - `sunShadowSoftAt(wp, n, h)`, EL_BB_VS_EXT passing `uSize.y`) |
| S2 | the whole sun shadow shimmered once every 24-31 m walked | a re-anchor (LA-SHADOW1) took a fresh anchor at the eye rounded to 8 m: an arbitrary phase on the grid it replaced, so every cascade's grid jumped up to half a texel in one frame | `sunAnchorFor(eye, anchor, lightDir, texel)` moves the old anchor by whole far-cascade texels across the light (a far texel is whole in all three: 1 : 4 : 20) and freely along it |
| P1 | a flat walking away from a lamp lost that lamp's light, frame by frame | the flat read the lamp's shadow ON its own card, which the lamp's map holds where the flat stood a frame to three ago | the read is lifted `EL_FLAT_LAMP_LIFT` (0.35) toward the lamp, never past half the way, with no normal offset |
| P2 | in first person, turning in place hopped the player's shadow from lamp to lamp | the card stands a pace before the eye and circles the feet as the player turns; its two lamps were picked afresh every frame (a hall of ten lamps: 506 hops over 833 spots in one turn each) | `nearestRank(..., held, heldN)`: last frame's pair, by place, at DISC6's keep ratio |
| P3 | a lantern swapped into the eight for a frame at a floating-origin crossing (lit through its wall), every map redrawn | the kept copies (a Float32 slot, a Float64 hold) and the host's moved lights are sums in two precisions, matched exactly; and `shiftOrigin` moved none of them | `samePlace` (within SHADOW_STILL_EPS) for the hold, the sticky slots, the change test and the held far; `shiftOrigin` moves the hold, the card's pair, the slots and the lo slots |
| R1 | a mounted or walking peer's shadow strobed with its walk | its sprite batch was destroyed and made again at every animation frame, after the frame's records were taken: the next frame's replay met a dead batch | the new frame is written through the standing batch (archive, record, size, reach), as the foes' and the bands' are |
| R2 | on the crossing frame every tree, sign and passer-by cast nothing, and the far cascade kept the hole a frame more | the records are replayed at the next beginFrame, before the pixel loop writes the pixels' translations and the townsfolk's places again | the recentre re-makes each pixel's translation (its flats' origin) and moves the townsfolk's batches with the offset |
| R3 | a peer riding or walking, a band's monster or a yard's flat just off screen cast no shadow into the view | the four lists skipped the reach test the townsfolk have (SHADOW-REACH) | off screen, a batch in shadow reach still casts |
| R4 | stepping out of a room, the street's cascades held the room's walls for a frame or two | the replay was discarded on the way in only | discarded at the edge either way |
| F3 | ambient occlusion along a skyline, different from GPU to GPU | `AO_FS` returned for a sky pixel and then took `dFdx`/`dFdy` of the position: a derivative after non-uniform control flow is undefined (GLSL ES 3.00), so the partner lane held whatever the GPU left there - 9 of 120 rim pixels differed between three legal behaviours, NaN among them | the derivatives are taken before the return, in every pixel of the quad; a degenerate cross faces the eye |
| F4 | (latent, 16-bit GPUs) a dense night street's fragments lit by the wrong lanterns | the cluster list's offset (up to 55,259 on 48 lanterns at 8 m) passed through a fragment shader's default mediump int | `highp` from the cell's fetch to the list's |

The receivers and the screen passes (the fourth pass, run through the evaluator and on SwiftShader): with the camera
still every pass is frame-stable - 0 pixels change over 24 frames. What moves needs the camera to move, and the look
filter keeps a sub-pixel drift going for many frames after each input. Two findings there are recorded, not changed:
- **F1 - the contact march at night.** A lantern with no caster slot (a street's, past the eight) takes EL8's contact
  shadow off last frame's depth, and both its self-check and each step's claim read ONE nearest texel: as the view
  drifts the texel grid slides against the world - at 0.3 px a frame, 89 of 2614 shadowed receivers swing a tenth of
  the lantern's light or more, frame to frame (0.580 0.768 0.635 0.817...); 0 on exact depth. Tested: each step judged
  on the four texels about it and the claims blended bilinearly (a shadow compare's own filtering), the self-check
  passing when any of the four holds the surface - 96 flipping pixels to 10 on SwiftShader, LA-POST6's and LA-AUDIT
  B1's laws unchanged. Not shipped: 20 depth fetches a marched light where there were 5, on the exterior frame the
  players already call slow - for Mac to weigh. Interpolating the depth itself is worse (1,651 pixels): it invents a
  thin occluder at every outline. Never indoors: every light there has a map.
- **F2 - the emitters' bloom at a quarter of the resolution.** A small emitter covers a varying number of bloom
  texels as the view drifts (a lamp flat at 10 m: 1344 to 2026 of bloom energy), and under about four quarter-size
  pixels the implicit-LOD cutout reads the 2x2 mip and it drops out of the bloom. Drawn at full resolution, or
  multisampled and box-downsampled (LA-POST1's rule), with the cutout at `textureLod(..., 0.0)`, it would hold.

For the report itself (NVIDIA, a shop's hanging lamp): nothing found depends on the vendor indoors. The shadow
lookups sit in per-light loops, but all three maps have one level with MIN = MAG = LINEAR, so no LOD a GPU picks can
change a result; no index runs out of range; no noise from time or a frame counter. The one path left whose result a
driver decides is SC1's depth blit from the static cache into the live layers (`_blitSlot`, valid by the spec: the
same DEPTH_COMPONENT24, the same size, NEAREST) - unconfirmed, and not changed on a guess. What this section fixed
indoors is frame-rate dependent (P1, P2, R1, R4), and frame rate is what differs between two machines.

Recorded, not changed: a batch past 128 placements is treated as dynamic (raising the cap costs a pairwise walk); the
record pool stops at 6000; a boat's lantern follows the boat a frame behind; the player's own card, the corpses and the
flyers are not moved at a crossing (one frame); a cut from room to room inside one interior replays the last room's
casters for a frame; a peer's WB9h body out of view does not cast.
`test/audit_flicker.test.js` (7); fourteen older pins re-aimed at the new text (el2, perfsun_fragment, la_audit,
la_shadow, perfexta, la_post, sc1, disc15, el5_field, disc23b, la_cost, invislook; el3_air and lc1_clusters for F3
and F4). `tools/mutants/audit_flicker.json` (28, all dead).
