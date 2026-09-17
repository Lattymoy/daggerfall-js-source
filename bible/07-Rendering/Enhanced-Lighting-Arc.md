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

**THE DEPARTURE FROM THE PLAN, recorded.** The plan named an RGBA16F
target for the whole world with the tonemap moved to a final composite.
Six foreign passes (both skies, the clouds, the precipitation, the grass,
the far ring) restore `bindFramebuffer(null)` behind the renderer's back -
the render-target helper's own law - so a world drawn off-screen would
lose every one of them to the canvas. The scene stays forward-tonemapped
(EL1); the bloom is sourced from the emitters themselves, which is the
bloom that means something; a later pass that teaches the six about a
current target can move the tonemap. Nothing shipped here needs a float
target.

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

**Pinned** (`test/el3_air.test.js`, 7): the door and the constants
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
