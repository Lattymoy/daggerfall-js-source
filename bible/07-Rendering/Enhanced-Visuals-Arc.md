# Enhanced Visuals (EV) - the world overhaul arc

ACTIVE. Mac (2026-08-31): "boost the enhanced version... improve the
visuals of the world... improve the interior/exterior lighting. I want
sunlight and moonlight to matter, reduce the jitterness of the outside
world and improve the distant terrain... while also improving
performance at the same time."

Three exploration lanes read the whole render path before a line
changed - lighting, jitter/streaming/distance, and the frame's
performance anatomy - and this page is their consolidated record plus
the slice plan. The reference clones consulted: DFU at the sparse
checkout the R5/R12 slices already cite, OpenMW a042cd3 for nothing
here (the MW lane's, listed for completeness).

## What the lanes established (the findings that shape the arc)

THE JITTER IS THE MOTOR, NOT THE FLOATS. The port carries DFU's
floating origin verbatim (streamingWorld.js, fuzz-pinned in
streaming.test.js:139 - `|pixelTranslation(current)| < 1e-6` over
2000 steps); worst-case uploaded coordinates are ~3276 units, f32 ulp
0.24mm. What judders is TIME: motor.js runs a fixed 1/60 accumulator
(the mobile-hotfix shape, motor.js:61-74) with NO render-time
interpolation - the eye advances 0, 1 or 2 steps per rendered frame
while the look filter, the head bob and the nod are all render-rate
smooth. Perfectly smooth rotation over stepped translation is the
most visible judder there is, and it is worst outdoors because the
terrain field is the highest-frequency thing on screen. DFU has the
same fixed step and does not judder because Unity interpolates
rendered transforms; the port reproduced the step without the
smoothing. Amplifier: ~10^3 typed-array allocations per frame in the
matrix/draw path (GC spikes riding the beat).

FOUND ON THE WAY, both real: a recenter injects 819.2 units into
footsteps' stride accumulator (a spurious footstep at every map-pixel
crossing, footsteps.js:123), and `_playerStill` reads one moving
frame per crossing (world.js:4909-4911).

frame per crossing (world.js:7012-7014).

THE DISTANCE IS FOG-BOUND, NOT STREAM-BOUND. Linear fog ends at 2400
units (weather.js:33-40, DFU's own number) while the default 7x7
stream reaches 2867 - so everything a higher Land View Distance buys
is drawn fully fogged. No LOD exists: every pixel is 32,768 triangles
at every distance, ~1.6M/frame, unculled. The travel map already
builds a one-vertex-per-map-pixel relief of the whole province
(overworldModel.js) - the natural far-land raw material, later.
Chunk-edge normals degenerate to one-sided differences (no ghost
rows, terrainSurface.js:92-95): a permanent lighting lattice at every
819.2-unit seam, visible at grazing sun.

THERE IS NO CULLING AND NO MEASUREMENT. Zero frustum tests anywhere;
~1045 drawMesh calls in a city with per-call useProgram + per-submesh
double texture binds and a template-string key allocated per submesh
per frame (renderer.js:1792 - thousands of strings/frame, the single
largest GC source). No FPS counter, no draw counter; the proven
measurement pattern is window.__renderer + probe monkeypatching
(hudCrosshairProbe), exposed today by the dungeon host alone.

THE LIGHTING IS HALF-BUILT, WELL. Outdoors already has a real
per-fragment N-L sun (R5) driven by the SunlightRig curve; ambient is
PlayerAmbientLight verbatim; 16 per-color point lights; window
emission. The enhanced sky computes sun elevation, BOTH moon
directions, phases, visibilities and cloud cover every frame -
and lighting consumes none of it except the ES1d cloud shadow.
Indoors the directional channel exists and is multiplied by zero
(INTERIOR_LIGHT_DIR, a recorded dead vector). Billboards - every
enemy, NPC, tree, loot - have NO NORMALS and can only take a scalar
tint term without a vertex-format change across ~20 call sites.

## Hard constraints (the tripwires, so no slice trips them)

- Source-text pins count GLSL substrings (perlightcolors.test.js:125,
  handedness, the fparm studio borrow) and audit18_bible_docs pins
  Rendering.md's literal "directional light 0.45 + 0.55*diffuse" -
  shader math changes move the doc in the same commit.
- `_clockLit` (renderer.js:562) is a regression latch: set once,
  never cleared. Flats' tint path must keep it.
- No sRGB anywhere; lighting happens on palette bytes; the enhanced
  sky's posterise pass and NEAREST/REPEAT cutout laws stay.
- The CPU/GPU cloud twin is pinned line-for-line
  (enhancedSky.test.js:310); a light term reading the cloud field
  reads THAT field.
- streaming.test.js:181 pins the literal text of world.js's
  StreamingWorldState construction line; terrain.test.js:144 pins
  generateSamples to 1e-6 - LOD work stays in buildTerrainGrid /
  buildTerrainIndices, which have no direct pins.
- Character meshes draw with culling OFF (inconsistent winding); a
  stronger key light shows their backfaces. Recorded, watched.
- Three passes change programs behind the renderer's back (both
  skies, precipitation); any GL state shadowing resets at beginFrame
  and at those seams, or it recreates the recorded R9 bug.
- The motor's fixed step is pinned (audit18_player.test.js:79,
  motorStairs, enemymotor) - SIMULATION pins, not presentation.
  Interpolation adds a read-side accessor and changes no step.

## The slices

- EV1 THE JUDDER: prevPos/alpha in the motor, `eyeAt(alpha)` read by
  every host camera, `offsetOrigin` so a recenter shifts prev with
  pos (no 819-unit lerp frame), a teleport snap guard, the footstep
  recenter guard, `_lastPlayerPos` offset. The single biggest feel
  win in the arc, near-zero risk.
- EV2 THE ALLOCATION SWEEP + THE COUNTER: mat4.multiply's double
  allocation dies; the per-pixel matrix caches on the built entry;
  drawMesh's per-submesh string key becomes a generation-stamped
  texture cache; nearestLights becomes an allocation-free stable
  top-16 selection; the thirteen `[0,1,0]` literals hoist;
  precipitation stops querying CURRENT_PROGRAM (the R9 law says the
  next pass owns its binding anyway); heightAt computes its pixel
  directly instead of scanning 49. (AUDIT EV: the sweep found
  twenty-two up-axis literals, not the thirteen this plan line first
  guessed - the RECORD below and the test carry the real count.) And renderer.stats (draws, program
  binds, texture binds, VAO binds - reset per beginFrame) plus
  __renderer on every host, so every later slice lands against
  numbers.
- EV3 THE FRUSTUM: pure plane-extraction and AABB tests (unit-tested
  exhaustively, no GL), then per-pixel terrain skip, per-placement
  drawList skip off build-time AABBs, per-batch billboard skip.
  ?cull=off is the escape hatch. Expected: 60-70% of terrain and a
  comparable placement fraction culled - the headroom EV4 spends.
- EV4 DISTANT LAND: the fog end scales with the LIVE terrain distance
  at the host seam (the weather table stays byte-identical - DFU's
  2400 remains the d=3-ish base); outer-ring chunks build at stride 4
  (33x33 - a 16x triangle cut) from the same pinned samples; ghost
  rows make chunk-edge normals true central differences and retire
  the seam lattice.
- EV5 MOONLIGHT AND THE NIGHT: the second directional term. Moon
  direction/phase/visibility from the enhanced sky's own state (the
  masser leads; secunda rides the ambient), N-L on the three
  normal-bearing programs, a scalar on the flats' tint, hard-gated to
  the enhanced sky so classic keeps DFU's hard-off night. The
  Rendering.md formula string moves in the same commit.
- EV6 GL STATE SHADOWING + THE SPRITE RT: _lastProgram/_lastVao/
  _lastTex shadows (reset at beginFrame and the three foreign-pass
  seams), drawList sorted by mesh at build, the sprite pass's
  getParameter and full-RT clear retired. After EV2's counter exists,
  so the collapse is a measured number, not a hope.

LATER, RECORDED: worker-side terrain generation (the one structural
thing DFU's Jobs system has that this port lacks - all four kernels
are pure functions over typed arrays and transfer cleanly); a far
province relief ring beyond the streamed grid built from the travel
map's grid; per-glyph HUD text batching (a UI-arc slice).
2026-08-31: the first two graduate to slices EV7/EV8 below; the HUD
batching stays a UI-arc item.

## The second wave (EV7-EV8), planned off two fresh lanes

- EV7 THE WORKER: a pixel build runs ~84,000 perlinNoise calls
  (33k in generateSamples, up to 50k in generateTileData - the tile
  classifier out-costs the heightmap itself) plus ~166k cubic
  interpolations and 16k atans in layoutNature, all inside ONE task:
  every await in buildPixel is a cache-warm microtask, so the whole
  body lands on the frame the pixel was enqueued - the crossing
  hitch. The cut: a pure generatePixelTerrain kernel (samples ->
  location blend -> tileData/assignTiles -> grid+ghost -> nature -
  the exact inline sequence, oracle-testable), a worker shell that
  owns its OWN WoodsFile from a COPIED byte buffer (the RA1 road-bake
  law, recovered from 55e4382^: transferring the reader's plane would
  detach the buffer the session still reads), and a client with an
  injectable factory, a FIFO (teleport can overlap pump's build), the
  same-thread kernel as the fallback-not-failure, and
  ?terrainthread=off in the cullDisabled shape. setLocationTiles
  (BlocksFile/MapsFile) stays main-side and its tilemap+rect ride
  INTO the job; GL uploads, location layout, collider and the single
  atomic built.set publish stay main-side after the reply. Pins that
  hold: pump's `await buildPixel(next.px, next.py)` text (audit24),
  the teleport's first-900-chars needles (travelmap), streaming's
  constructor literal; the distantland ghostSampler needle moves
  deliberately (restride keeps the main-thread call).
- EV8 THE PROVINCE RING: real mountains on the horizon. A pure
  builder over woods.heightMapBuffer at one vertex per map pixel -
  UN-exaggerated heights (max(byte*8, 27.2) * 1.5 - the streamed
  law itself, not the travel map's x24 skin), real central-difference
  normals, overworldTint(climate, byte) vertex colours (the port's
  one documented map-pixel-to-ground-colour law, ocean-swamp trap and
  all), pixel-corner coordinates relative to a base pixel so ONE
  pixelTranslation(base) placement survives every recenter for free.
  Drawn by a self-contained pass (src/render/farRing.js, the
  overworldRenderer/skyRenderer shape: own ~40-line program,
  proj/view as arguments, the U61 save/restore contract) with its OWN
  projection (the world's far plane is 6000 = 7.3 pixels) and its own
  distance fade toward the live fog colour capped short of 1 (the
  world's linear fog ends at 2400/3200 - drawing the ring through it
  would be an invisible wash; distant peaks reading through haze is
  the point). Slot: between sky.draw and the existing
  markForeignPass, where the depth buffer is still empty - painter's
  order lets the streamed grid overdraw the ring wherever they
  overlap, and the HOLE (the streamed rect, re-punched in the index
  buffer per crossing - vertices rebuilt only when the player drifts
  far from the ring base) exists for the one case painter's order
  cannot fix: a coarse ring peak spiking above the streamed
  silhouette from inside it. Skipped under exp fog (weather owns the
  air) and at night it simply goes dark (it takes the live ambient
  and sun). Enhanced-only beside lodOn; ?ring=off is the hatch.

## Verification doctrine for this arc

This container carries no ARENA2, so: every law lands with pure unit
tests (interpolation math, selection stability, plane math, stride
indices, curve math); renderer behavior lands against the Proxy-GL
counting pattern (audit26_dungeonfoes' stubGl precedent) and
renderer.stats; the moving pictures - judder before/after, the far
haze, moonlit nights - are owed to a data-bearing session through the
existing probe seams (__frame sync, __renderer counts, ?tod=). Each
slice records what it could and could not see, per the house rule.

## Records

EV1 (2026-08-31): THE JUDDER. eyeAt(alpha) - prevPos latched per
STEP inside the accumulator (a zero-step frame keeps the last real
span and advances alpha, the 120Hz case), lerped read-side with eye's
own bob/eye-level math; every host camera and all three MW-rig camera
deps read it (the arm must ride the camera's eye or it swims); `eye`
itself untouched for rays/audio/probes. offsetOrigin shifts both ends
of the span so the recenter never lerps 819.2 units; SNAP_SPAN (2
units - no legal step covers it) snaps placed positions. The two
recenter misses fixed: footsteps.rebase (the spurious per-crossing
footstep) and _lastPlayerPos following the origin. Simulation
untouched by construction - every fixed-step pin passed unedited;
the five source pins that quoted the old camera spellings moved with
the design (audit18_hosts_outer's order law, mwanimsource's dep
regex, playerdeath's two DC1 needles, and the dungeon death-drop).
motorinterp.test.js pins the six laws on the real motor over
motorStairs' own floored collider. The moving picture is owed to a
data-bearing session; the arithmetic is not.

EV2 (2026-08-31): THE ALLOCATION SWEEP + THE COUNTER. drawMesh's
per-sub-mesh `${archive}_${record}` string (thousands per frame, the
top GC source) became a per-sub-mesh resolved-texture cache stamped
by a texture GENERATION (bumped on every texture/emission upload - a
streaming texture is re-looked-up, a miss is never cached) and the
texRemap's identity. mat4.multiply's unconditional Float32Array(16)
became a module scratch (aliasing law kept and pinned). The streamed
draw loop caches the pixel frame matrix on the built entry and each
model's world matrix beside it, refreshed only when the translation
actually changes (a recenter); pixelTranslation gained an out param.
nearestLights became a bounded STABLE insertion - proven against the
old map/sort/slice verbatim as oracle over a tie-heavy fixture,
including ties at the cut. The twenty-two `[0,1,0]` up-axis literals
are one exported UP_Y. precipitation stopped querying CURRENT_PROGRAM
and stopped restoring it (the R9 law: every draw entry point owns its
binding). heightAt inverts pixelTranslation to ONE Map.get instead of
scanning 49 pixels inside the collider's substeps. And the
measurement the arc's later slices land against: renderer.stats
(draws/programBinds/vaoBinds/texBinds, reset per beginFrame) plus
window.__renderer on the world and exterior hosts (the dungeon's U38
precedent). renderalloc.test.js pins each behavior identical AND each
allocation gone, through the audit26 Proxy-GL counting precedent.

EV3 (2026-08-31): THE FRUSTUM. src/render/frustum.js is the pure
half - Gribb/Hartmann planes off the combined proj*view (unnormalized;
the outside test only reads the sign, and the handedness mirror is
inside the matrix so it is inside the planes), the p-vertex outside
test with the conservative direction as law (straddling/surrounding
always draws - the worst failure mode is drawing the invisible), an
OFFSET form so the streamed world tests pixel-local boxes with three
additions instead of materializing world boxes per frame, and the
build-time constructors (localAabb once per model ARCHETYPE,
transformedAabb's eight corners per placement, flatBatchAabb off
createBillboardBatch's base-anchor law with w/2 on both horizontal
axes because the quad yaws). The hosts: world.js seeds each pixel's
bounds from the terrain grid's own vertices and grows them by every
model box and flat batch, then gates per frame at THREE grains -
pixel (terrain + everything), per-model, per-batch; exterior.js
carries a world-space box per drawList row and per billboard batch
(refilled into one persistent visible list - the EV2 lesson).
SIMULATION NEVER GATES: advanceRotor, the mill's hum, flatAnims.tick,
the population, magic missiles and live persons all run/draw
untouched; the windmill boxes pad 30 units for the sails' sweep.
?cull=off is the escape hatch, read once at build. frustum.test.js
pins the math on the real matrix pipeline and pins the WIRING SHAPE
itself (the hum outside the pixelVisible gate). The culled fraction
in a live city is owed to a data-bearing session through
renderer.stats/__renderer (EV2's counter exists for exactly this);
the plane math is not.

EV4 (2026-08-31): DISTANT LAND. Three moves. THE FOG: the linear
0..2400 haze is tuned for TerrainDistance 3, so a raised Land View
Distance streamed land it then painted fully fogged; weather.js's
scaleFogForDistance stretches the LINEAR rows by distance/3 at the
world host's two fogForWeather reads (identity - the same frozen
object - at 3 and below; exp rows are WEATHER and never stretch; the
table itself byte-identical). THE SEAM LATTICE: terrainSampler grew
sampleKernel (generateSamples' loop body factored verbatim - the
numeric pins hold bit-for-bit through fround) and ghostSampler, which
answers out-of-range sample coordinates from the correct neighbor's
kernel via the sampler's own edge-continuity law (the large
heightmap's y DESCENDS in the file - the fake woods in the tests had
to share the reader's orientation before the law would hold); with
ghosts, buildTerrainGrid's edge normals are true central differences
and the permanent lighting lattice at every 819.2-unit seam dies. RAW
ghosts: a neighbor's location BLENDING is not reflected, so a blended
pixel's rim can still shade a hair off its neighbor - strictly better
than the halved one-sided slope it replaces, recorded here. THE FAR
RING: buildTerrainGrid/buildTerrainIndices take a stride (4 = 33x33,
a 16x triangle cut) plus a perimeter SKIRT dropped TERRAIN_SKIRT_DEPTH
(40) and stitched both windings - the T-junction crack cover where the
ring abuts the full-res core; world.js builds chebyshev-distance >= 3
pixels strided (ENHANCED ONLY - the 1:1 lane keeps DFU's full
resolution at every distance), restrideTerrain swaps a surviving
pixel's surface in place when the walk reclassifies it (models,
flats, collider, population all stay; the grid rebuilds from the
pixel's own cached BLENDED samples), and the EV3 culling box drops by
the skirt depth at build so either class fits it. The renderer's
terrain index buffer, silently first-set-wins since R9, now keys per
index SET. Simulation untouched: the collider and heightAt read
SAMPLES, never the render grid, so the far ring is presentation all
the way down. distantland.test.js pins all of it; the moving picture
(the far haze at distance 4, the vanished seam lattice at grazing
sun) is owed to a data-bearing session.

EV5 (2026-08-31): MOONLIGHT AND THE NIGHT. The enhanced sky computed
both moons' directions, phases and visibilities every frame since ES1
and the world's light consumed none of it - now it does. The pure
half (enhancedSky.js): phaseLitFraction folds the 0..7 phase ring at
Full; moonlightTerm derives the term from skyState's OWN output - the
MASSER leads (MOONLIGHT.masser 0.25 x phase-lit x vis, where vis is
already daylight- and cloud-dimmed by the same eased cover the dome
is drawn with - the cloud tripwire satisfied by construction), and
SECUNDA rides the ambient (0.06 lift, her colour) because she is too
small for a readable second shadow direction; null by day, null when
neither contributes. The renderer: uMoonDir/uMoonScale/uMoonColor +
a second N.L term in exactly the three normal-bearing programs (the
pinned "0.45 + 0.55*diffuse" base is UNCHANGED - the term is
additive, scale 0 by default); the flats (no normals) take the
Lambert-average half on the tint INSIDE the _clockLit latch; the
studio borrow zeroes and returns the scale so UI read-backs stay
moonless; setMoonlight(null) is the off switch. The seam: shared.js's
sky.moonlight() answers from enhancedSky.state - the classic sky has
no moon state, so the 1:1 lane keeps DFU's hard-off night VERBATIM by
having nothing to answer with; interiors and dungeons never call
setMoonlight at all. Both exterior hosts set the key and fold
secunda's lift into the ambient (withMoonAmbient, in place - the
EV2 allocation law). Magnitudes: night ambient is 0.25, so a clear
full Masser (scale ~0.22, warm #d39a86) roughly doubles a moonlit
face and a storm mutes it through the vis law - a dimmer, not a
switch. moonlight.test.js pins the fraction table, the formula
against the state's own numbers, the day/new-moon/cloud gates, the
in-place fold, and the wiring shape; the moonlit picture is owed to
a data-bearing session (?tod= at night, phases from the calendar).

EV6 (2026-08-31): GL STATE SHADOWING + THE SPRITE RT. The frame ran
~1045 useProgram calls and as many VAO binds for a handful of
distinct programs. Now every program/VAO bind in renderer.js funnels
through _use/_bindVao, which skip the call when the shadow says it is
already bound; drawMesh no longer unbinds its VAO, and both exterior
hosts SORT their draw lists by mesh at build (exterior's drawList by
modelIdNum, the streamed pixels' models likewise), so one archetype's
placements draw back to back and the shadow makes the repeats free.
The shadows reset at beginFrame and at markForeignPass - the R9 law's
other half: an entry point may only trust a binding it can account
for, and five passes change programs behind the renderer's back (GR1: the lab's grass is the fifth).
Those four (both skies, precipitation, and - since F55 - the OVERWORLD
MAP's own pass) now all follow the same law: the getParameter
(CURRENT_PROGRAM) save/restore is RETIRED (two synchronous driver
queries per frame gone - the class EV2 killed in precipitation, and
F55 took the overworld renderer's pair the same way) and the hosts
mark the seam after each - five call sites across the four passes
(`world.js` sky and rain, `exterior.js` sky and rain,
`ui/overworldMap.js`). The one
element-buffer upload that owns no VAO (_terrainIndices) unbinds
first, or it would capture its buffer into whatever drawMesh left
bound. THE SPRITE RT: the borrow-and-return of the clear colour (the
F034 law) now restores from a JS shadow (_clearColor) instead of a
getParameter(COLOR_CLEAR_VALUE) round-trip per sprite frame, and the
clear is SCISSORED to the sprite's own pw x ph corner instead of
wiping the full 512x512 target; the F034 pin moved with the
mechanism, the law intact. glstate.test.js pins the collapse against
a COUNTING Proxy-GL stub (three same-mesh draws = zero useProgram,
one VAO bind, stats agreeing) and the funnel/seam/sort shapes as
source pins. The arc's recorded slices are now ALL SHIPPED; the
measured frame numbers in a live city (stats before/after) are owed
to a data-bearing session, as is every moving picture above.

EV7 (2026-08-31): THE TERRAIN WORKER. buildPixel's CPU prologue -
samples, location blend, tileData/assignTiles, the ghost-row grid,
nature - moved WHOLE into terrainGen.js's generatePixelTerrain, one
pure function in the exact inline order (the oracle test proves it
bit for bit, location blend included). terrainGenClient.js runs it on
a module Worker (terrainGenWorker.js owns its OWN WoodsFile from a
COPIED byte buffer - transferring the reader's plane would detach
what heightAt, the restride's ghosts and the travel map keep reading;
the recovered RA1 road-bake law, 55e4382^) with an injectable
factory, a FIFO (the teleport core can overlap pump's build), job
tilemaps crossing by CLONE so a dying worker falls back over intact
inputs, and THE FALLBACK IS THE OLD PATH: no Worker, a throwing
factory, a dead worker, a failed job and ?terrainthread=off all run
the same kernel on this thread. What stays main-side: setLocationTiles
(BlocksFile/MapsFile do not cross postMessage - its tilemap + rect
ride INTO the job), every GL upload, the location layout, the
collider, and the single atomic built.set publish. The pinned build
contracts stand untouched (pump's await text, the teleport needles,
the streaming constructor literal); the distantland ghost needle
moved deliberately (the restride keeps its main-thread call, the
kernel carries the build-time one). terrainworker.test.js pins all
of it through a hand-rolled fake worker; the FELT result - a
map-pixel crossing that no longer stutters while up to 13 pixels
stream in - is owed to a data-bearing session.

EV8 (2026-08-31): THE FAR PROVINCE RING. src/render/farRing.js -
real mountains on the horizon, from the same WOODS.WLD plane the
travel map renders, at the streamed terrain's OWN un-exaggerated
height law (max(byte*8, ocean)*1.5 world units - generateSamples'
macro-shape; the travel map's x24 relief stays display skin). One
vertex per map pixel, RING_RADIUS 48 (~39 km), overworldTint colours
(the ocean-swamp trap already handled at its one home), real
central-difference normals so the ring takes the live sun and
ambient. Placement is pixel-corner units relative to a BASE pixel +
one pixelTranslation(base) per draw - recenters cost nothing, the law
every hand-offset consumer in world.js exists for having broken. The
HOLE: the index buffer skips exactly the streamed rect's cells,
re-punched per crossing (indices only; the vertex grid re-centres
when the player drifts past RING_REBUILD_DRIFT=12 pixels - painter's
order hides every overlap, the hole exists for the coarse-peak-above-
the-silhouette case it cannot). The FADE is the pass's own: the world
fog's ramp capped at RING_HAZE_HOLD 0.85 through the middle distance
(silhouettes read through haze - the point) and closed to 1 at the
rim, into the same live fog colour the sky fades to; drawn through
renderer.setFog it would have been an invisible wash past 2400. Drawn
between sky.draw and the EV6 seam mark (depth untouched, own
projection - the world's 6000-unit far plane is 7.3 pixels; no
save/restore, the shared mark resets the shadows), skipped under exp
fog (weather owns the air), dark at night by construction (it takes
the frame's own light state). Enhanced-only beside lodOn; ?ring=off.
farring.test.js pins the laws, the hole, the Proxy-GL pass lifecycle
and the wiring; the horizon itself is owed to a data-bearing session
(the Wrothgarians from Daggerfall's walls, ?tod= at dusk).

AUDIT EV (2026-08-31): the whole arc audited by three adversarial
lanes - simulation/async, rendering, test/pin/doc integrity - and
every confirmed finding fixed in the same change. The full record is
`01-Overview/Audit-EV.md`; the headline pair: MOONLIGHT LEAKED
INDOORS (one shared renderer, the modal frames never cleared it - the
AUDIT 26 F001 windowEmission class exactly; both modal arms and the
automap now go dark explicitly, the stale R12 indirect with them) and
A TELEPORT OVERLAPPING AN IN-FLIGHT BUILD DOUBLE-BUILT THE PIXEL
(EV7 stretched the window from a microtask to a worker round trip;
buildPixel is now a cache-then-in-flight-map front, one build per
pixel ever in flight). Also fixed: the far ring's half-pixel hole
asymmetry (a sky-gap strip on two rims), its rim fade that never
closed at edge midpoints, its missing moon term, the stranded-worker
init edge, the never-executed worker shell (the job now crosses as a
spread + the real shell's error arms run in node), the tautological
kernel-equivalence test (an independent sampler-loop re-statement is
the oracle now), the two-home byte*8 constant, and a handful of doc
drifts. Watched, not fixed: SNAP_SPAN vs terminal fall speed, and the
hole's symmetric half-pixel spike exposure. The escape hatches, in
one line: ?cull=off, ?terrainthread=off, ?ring=off - each read once
at scene build, each falling back to the pre-slice path.
