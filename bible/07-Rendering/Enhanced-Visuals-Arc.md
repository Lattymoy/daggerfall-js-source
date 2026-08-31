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
frame per crossing (world.js:4781-4783).

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
per frame (renderer.js:1772 - thousands of strings/frame, the single
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
- `_clockLit` (renderer.js:560) is a regression latch: set once,
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
  directly instead of scanning 49. And renderer.stats (draws, program
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
