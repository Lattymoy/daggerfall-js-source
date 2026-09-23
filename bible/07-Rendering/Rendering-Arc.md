# Rendering Arc

Milestone log for the rendering build queue owned by
`07-Rendering/Rendering.md`. Same rules as the World-Arc log: one
feature at a time, verbatim data logic with documented equivalences,
pins baked as tests, audits appended to the shipped section.

## Milestone R1 - climate texture swaps + seasons (SHIPPED)

`src/world/climateSwaps.js` is a 1:1 port of ClimateSwaps.cs:
applyClimate (door-frame tapestry archive%100==74/record 3 exempt;
swamps keep marble floors; deserts never winter; C# precedence
preserved so the castle record>3 winter kill applies in EVERY climate,
not just swamp; 82/record>1 and 77 never winter; {75,76,77,79,80,82,83}
suppress the climate rebase; archives < 500 rebase to
climateBase + archive%100 + weather (Winter 1 / Rain 2 when supported);
500+ keep their archive with the winter bump), getClimateTextureInfo
(full exterior/interior/nature classification with winter/rain flags),
isExteriorWindow (verbatim table, consumed by the window-emission queue
item later), getNatureArchive (winter +1 for 504/506/508/510),
getGroundArchive ({0:2, 100:102, 300:302, 400:402} + Winter 1/Rain 2).
EQUIVALENCE documented in-file: we take the API ClimateBaseType values
(0/100/300/400) directly instead of round-tripping DFU's Unity-side
ClimateBases enum - the exact integers FromUnityClimateBase produces.

Renderer: drawMesh(mesh, matrix, texRemap) takes an optional
"archive_record" -> "archive_record" substitution map - pixels bind
from the swapped archive while UVs stay original-archive (the
SetDungeonTextures pattern; snow variants share record dimensions by
design). Wired into the exterior scene (?region&loc&season) and the
streaming world (per-pixel climate + season, remap built during pixel
build, stored on the pixel entry). Ground and nature archives run
through the seasonal getters in both scenes.

KEY FINDING: ARCH3D meshes store MIXED archives - base-set values
(9 Castle, 29 Fences, 69 Roofs, 74 Doors, 85 Base...) alongside
temperate 3xx - so Daggerfall's castle had been rendering DESERT
textures (archive 9) in every scene until R1; applyClimate(9,
temperate) -> 309 fixes it. The pre-R1 exterior console pin (261
textures) reflected that defect.

Verification: Daggerfall summer (52 swaps, ground 302) vs winter
(74 swaps, ground 303, snow roofs/walls/ground/nature) split-shot;
Sentinel desert (climate 0, ground 2, sand + palms + desert palace);
streaming world winter (per-pixel snow ground 303, nature 505, swapped
building textures) with the summer console pin unchanged. Corpus sweep
pinned: 735 distinct mesh (archive,record) pairs x 4 climates x 3
seasons = 8820 combos, 6538 identity, 2282 swapped, 0 missing TEXTURE
files. Pins in test/climate.test.js.

## Milestone R2 - window emission materials (SHIPPED)

The iconic glowing windows. Data side is verbatim MaterialReader:
WINDOW_STYLES day (89,154,178)x0.5 / night (255,182,56)x0.8 / fog
(117,117,117)x0.5 / custom (200,0,200)x1.0, applied emission =
color * intensity (ChangeWindowEmissionColor); glass texels are palette
index 0xff via the already-ported getWindowColors32; which
(archive, record) pairs are windows comes from R1's isExteriorWindow
table, evaluated on the RESOLVED (post-climate-swap) pair. Renderer:
solid program gains an emission sampler on unit 1 (1x1 black for
non-windows, branchless) and `lit + mask.rgb * uEmissionColor`;
uploadEmissionTexture / setWindowEmission; every scene's uploadRecord
auto-uploads masks for window pairs; style from ?window=day|night|fog|
custom set once in the dispatcher (DFU GetMaterial defaults to Day).
`src/render/windowEmission.js`, pins in test/window.test.js (312/3 =
638 glass texels, 358/3 = 1440, 309/3 = 0 - real data variance).
Daggerfall night shot: amber leaded windows across the whole city.
NOTE tools/screenshot.mjs queries ride SHOT_QUERY env, not argv - a
session tripped on the old contract; the usage header documents it.
AUDIT NOTE (post-R5 audit): three closures. (1) DFU interiors
climate-swap their models too (DaggerfallInterior.DoLayout ->
dfMesh.SetClimate(climateBase, season, WindowStyle.Disabled)) - the
?interior scene now applies the remap; a standalone block has no
location so ClimateBases.Temperate is the verbatim field default,
?climate=desert|mountain|temperate|swamp overrides, emission stays dark
(Disabled). MAGEAA00 pin: 7 swaps. (2) 27 corpus swap combos target
archives that LACK the record (e.g. 122_5 -> 322 with 5 records); the
exterior scene set those remaps anyway and drawMesh silently dropped
the submesh - both exterior and interior now prune such remaps so the
submesh keeps its original texture (the streaming scene always
guarded). (3) 15 swap combos land on records with DIFFERENT dimensions
(124_3 -> 24, 168_6 -> x68 family); DFU stretches identically because
mesh UVs are normalized against the original archive - shared
classic-data quirk, Ledger B row. Record-level pins (27/15) baked into
the corpus test.

## Milestone R3 - city lantern point lights (SHIPPED)

One point light per archive-210 flat, verbatim RMBLayout AddLights/AddLight
positions on both paths: misc flats at (X, -Y + size.y, Z + 4096) * scale
and exterior-subrecord flats with the unrotated (subX, 0, -subZ) offset.
size.y is DFU's GetScaledBillboardSize, which returns NATIVE units
(MeshReader.cs:549-568), added inside the vector that is then scaled - so
a record-29 lantern lands at (4 + 160) * 0.025 = 4.1, not 0.2. Our
getScaledSize returns world units, so the port adds it after the multiply.
The light Y intentionally differs from the billboard's blockFlatsOffsetY.
Light properties from the DaggerfallLight [City] prefab: point, range 18,
intensity 1, white. Renderer: solid program gains a 16-slot point-light
loop (world-position varying, N.L, squared linear falloff to range -
documented equivalence to the Unity point light + its distance culling);
per-frame nearest-16 selection (cityLights.nearestLights). Wired into the
exterior scene (world-space) and the streaming world (pixel-local lights
placed under the current compensation each frame). EQUIVALENCE: lights are
gated on ?window=night, standing in for the prefab's night-only enable
script until the day/night cycle lands; the Animate flicker flag is queued
with that cycle. MAGEAA00 pins: 3 lights, the shared lantern cross-checks
flat y -0.05 (offset -6) vs light y 0.2 (-Y + size.h 4) on real data.
Daggerfall city: 155 lights; before/after diff pools 28k pixels on walls
and cobbles - subtle in daylight, correct until night ambient drops.
`src/world/cityLights.js`, pins in test/world.test.js.

## Milestone R4 - painted skies (SHIPPED)

New format reader `src/formats/skyFile.js`, verbatim SkyFile.cs: 32
per-frame palettes at 776-stride (+8 header) from offset 0, 64 raw
512x220 indexed frames (record * 32 + frame) at 549120; record 0 EAST,
record 1 WEST; per-frame-palette getColor32 with the repo's bottom-up
convention. All 32 SKY files load; SKY16 frame sums pinned.
Consumer logic follows DaggerfallSky.cs: frames 0-63 across the day,
afternoon uses frame 63 - n with the halves SWAPPED (DFU's flip is a
hemisphere swap only; the extra reflection is ours, the equivalence our
azimuth convention needs - pinned against real frames 6/57). Two colors
come out of a panorama and are not the same: clearColor is verbatim
`colors.west[0]` = element 0 of the bottom-up array = the HORIZON row,
which is DFU's cameraClearColor and its fogColor; fillColor is the
zenith texel our cylinder paints ABOVE the strip, a region DFU's
screen-space layout does not have. Night swaps to the NITE0?I0.IMG of
the sky group (0-7 -> 3, 8-15 -> 1, 16-23 -> 2, else 0) duplicated
across both halves, with LoadVanillaNightSky's right-edge seam fix. Presentation is ours (documented equivalence): one fullscreen
cylindrical pass - each 512-wide half spans 180 degrees (anglePerPixel
PI/512, so the strip covers ~77.3 degrees of elevation), azimuth 0 (+Z,
map north) starts the east half - the shader's azimuth is
atan(dir.x, dir.z), which is 0 at +Z, so that half runs north -> east
-> south and is CENTRED on map east at u = 0.25 - replacing DFU's
screen-space scrolled quads with identical angular coverage. (F56
corrected this sentence: it read "+X, map east", a 90-degree-wrong
reference point for anyone checking the sky against classic.)
`src/render/skyRenderer.js`; the pass owns its own bindings and the
HOST marks the foreign seam afterwards - EV6 retired the
getParameter(CURRENT_PROGRAM) save/restore that used to wrap it. Wired into the
exterior scene (sky index = climate skyBase) and the streaming world
(per-pixel skyBase stored at build; panoramas swap async on climate
boundaries, one frame late). ?skyframe=0..63 (default DFU's 31),
?window=night for night skies. Verified: dawn 6 blood-red treeline,
dusk 57 its exact mirror, noon over the streaming world.

## Milestone R5 - day/night lighting cycle (SHIPPED)

`src/world/worldClock.js` drives everything staged in R2-R4 from one
clock. Verbatim: DaggerfallDateTime hours (Dawn 6, Dusk 18, LightsOn 17,
LightsOff 8; IsNight, IsCityLightsOn - lanterns burn past dawn until
8:00); SunlightManager sun (t = (minute - 360) / 720, euler (180t, -90)
gives toward-sun (cos, sin, 0)(PI t) - dawn from +X map east matching
the R4 sky seam; sun HARD OFF at night); the SunlightRig LightCurve
ported as its exact Hermite keys ((0,0), (0.08,0.36, slope 2.8928573),
(0.5,0.9), (0.92,0.36, -2.8928576), (1,0)) with Unity's clamped
Evaluate; rig intensity 0.6 and color (0.816, 0.954, 1);
PlayerAmbientLight exterior ambient = lerp(0.25 * NightAmbientLightScale
(settings default 1), 0.9, curve); window style Night when IsCityLightsOn
(AUDIT 64 F8: the two call sites that name it, DaggerfallLocation.cs:141-145
and DayNight.cs:90/:120, both read IsCityLightsOn - so the glass lights with
the lanterns at 17:00 and unlights with them at 08:00); DaggerfallLight flicker per light (14
ticks/s, target = rand(range - 1, range), step 0.4) on the approved
umRandom substitute (Ledger A). Renderer: solid lighting parametrized
(uAmbient + uSunColor * uSunScale * N.L; defaults reproduce the pre-R5
constants so interior/dungeon/terrain scenes are untouched);
setLighting(ambient, sunScale, sunColor); nearestLights takes per-light
flicker ranges; billboards gain a time-of-day tint (ambient + half the
sun term - DFU's ambient-lit billboards, documented equivalence).
EQUIVALENCES: DFU's SkyCurve asset was not extracted - sky frames
advance linearly across daylight (skyFrameForTime, t * 63, night ->
NITE); R3's ?window night gating is now the real clock (explicit
?window / ?skyframe still override for demos). Scenes: ?tod=HH:MM
(default noon), ?timescale=game-min/sec animates. Wired into exterior
and streaming. Proofs: 22:00 city (0.25 ambient, amber windows, lantern
pools, NITE sky), 6:30 dawn (blood sky, low east sun, lanterns still
lit - verbatim), streaming night skyline. Pins in test/clock.test.js.
AUDIT NOTE (R5 audit): every constant re-verified against source,
including the prefab-derived values - the SunlightRig LightCurve keys
(slopes 2.8928573 / -2.8928576), rig light 0.6 / (0.8161765, 0.954361,
1), and the [City] light (point, range 18, intensity 1, white) were
confirmed by reading the prefab YAML straight from the sparse clone's
object store (git show HEAD:Assets/Prefabs/...). DEFECT FIXED: the
billboard time-of-day tint used the renderer's default lighting in
scenes that never call setLighting, silently dimming clockless-scene
flats to 72.5% (0.45 + 0.55 * 0.5) - the dungeon vine betrayed it
against the M9 baseline. Billboards now stay full-bright until
setLighting installs the clock (_clockLit). Residual dungeon diff vs
the M9 baseline is 37 isolated single pixels at geometry silhouettes -
rasterization ownership jitter from the shader recompile, accepted.
UNPORTED (Ledger C row): SunlightManager's IndirectLight - a
player-following point light (the rig prefab's second light, white
0.6) scaled by the same daylight curve; our exterior ambient carries
the PlayerAmbientLight term only.

## Milestone R6 - dungeon lighting (SHIPPED)

`src/world/dungeonLights.js` collects verbatim RDBLayout.AddLight
lights: one per RDB object of resource type Light, at
(X, -Y, Z) * GlobalScale, range = LightResource.Radius * GlobalScale *
3. Properties from the DaggerfallLight [Dungeon] prefab (read via git
show): point, intensity 0.8, white, Animate ON - every dungeon light
flickers with the verbatim DaggerfallLight machine (CityLightAnimator
generalized to per-light start ranges; targets stay in
[start - 1, start] per light, pinned). Scene lighting is the verbatim
PlayerAmbientLight DungeonAmbientLight (0.12) with no sun; the
billboard program gains the same 16-light loop as solids
(attenuation-only - billboards have no normals, documented
equivalence). dungeonLayout block entries retain dfBlock for per-block
consumers. Shot hooks __move/__frame added to the dungeon scene (probe
parity with the world scene). Pins: S0000040 24 lights (first at 23.4,
33, 16, range 4.875), Privateer's Hold 71 across 5 blocks, prefab
constants. Console pin gains ", 71 lights". VERIFICATION NOTE: pools
are local by data - dungeon radii are 5-15 scene units and the art is
dark, so the start vantage is legitimately near-ambient (nearest light
9.9 units, range 7.5); the pool shot beside the range-15 brazier shows
the warm falloff. A live in-program uniform probe (gl.getUniform)
confirmed the full upload path before the vantage was understood.
AUDIT NOTE (R6-R8 audit): AddLights is called unconditionally from
CreateRDBBlockGameObject (no dungeon-type gating) - collection
matches. Corpus pin added: 4268 RDB Light objects across the 187
blocks. Side effect noted as verbatim-direction: the billboard
16-light loop now lights night flats near exterior/world lanterns
too, matching Unity's vertex-lit billboards.

## Milestone R7 - dungeon water planes (SHIPPED)

WATER-D1 (2026-09-21): the DRAW moved into `dungeonContext.drawFoes`,
ahead of the weapon overlay - on the enhanced-lighting lane the overlay's
screen quad resolves the frame, and a plane drawn after it (as both hosts
did) lands on the canvas against an empty depth buffer. The level law
below is untouched. `07-Rendering/Water-Arc.md`.

Verbatim RDBLayout.AddWater semantics: one plane per dungeon block
whose start-marker water level is not the 10000 sentinel, covering the
RDB footprint (51.2 x 51.2) at the block origin, surface at
y = -waterLevel * GlobalScale. The level itself was already shipped
verbatim on layout.waterLevel (-8 * start-marker soundIndex - the same
value DFU's FindMarkers copies from Billboard.Summary into
block.WaterLevel before AddWater). Renderer grew a small blended pass:
shared unit quad, per-quad rect uniform, alpha blend with depth test
on / depth writes off, drawn after all opaque geometry. The surface
color (0.10, 0.22, 0.32, 0.62) is a presentation choice - DFU uses a
modern water prefab, classic used a palette-animated surface; a
classic-texture upgrade is queued with the terrain atlas pass. Corpus
pins: 32 of 187 RDB blocks watered, W0000000 at -496; Maorn's Guard
(Alik'r Desert) pins 11 blocks with W0000011/-248, W0000015/-488,
W0000022/-144 - the flooded-chamber shot verifies the blend (543k
blue-blend pixels at the computed surface height). Console pin gains
", N water".
AUDIT NOTE (R6-R8 audit): plane anchoring verified against the
serialized scene values (DaggerfallUnityGame.unity: PlaneSize 10,
PlaneOffset 5) - Unity's 10x10 centred plane nets centre = corner +
25.6 with extent +/-25.6, i.e. exactly [origin, origin + 51.2]^2, our
quad. The source's offset.z * (1 / prefabScale.x) x-for-z quirk is
harmless at 10x10 and noted as-written.

## Milestone R8 - interior point lights (SHIPPED)

`src/world/interiorLights.js` is verbatim DaggerfallInterior.AddLight:
one light per archive-210 flat (AmbientLitInteriors default off), at
the billboard CENTRE - interior AddFlat raises the transform half the
scaled height above the flat position - plus the per-record vertical
offset table (0 -0.1, 2/3 +0.1, 5 +0.15, 6/20 +0.6, 9 +0.4, 11 -0.4,
13 -0.35, 17 +0.2, 22 -0.5, 24 -1.85, 25 -1.0, 27 -0.02; 14/15 +h/2;
21 +h/2.4; "todo" records add nothing). Properties from the [Interior]
prefab (git show): point, range 15, intensity 1, white, Animate OFF -
interior lights do not flicker. Scene ambient is the verbatim
InteriorAmbientLight 0.18 (night variant exported for the clock), no
sun. MAGEAA00:0 pins: 17 lights; the first (record-6 skull torch) at
flat y 12.9 + h 2.35 / 2 + 0.6 = 14.675, cross-checked end to end.
Console pin gains ", 17 lights"; brightness redistributes (0.18 base +
range-15 pools) at a near-identical mean to the old flat lighting -
the guild hall is densely lit by data.
AUDIT NOTE (R6-R8 audit): the offset switch was machine-extracted from
source - 30 cases (0-29), no default, exactly 17 valued offsets - and
matches the port 1:1. Corpus pin added: 37249 interior lights across
all 6832 building interiors. A first-wiring slip (city default range
18 instead of 15) was caught before ship and is pinned.

## Milestone R9 - terrain tilemap-shader pass (SHIPPED)

The streaming world's ground now renders the way DFU ships it: a
129x129 height grid per map pixel plus a 128x128 tilemap byte texture,
decoded per-fragment by the verbatim Daggerfall/TilemapTextureArray
law - tileIndex = data >> 2, transform = data & 3, four rotation
matrices + translations. `src/world/terrainSurface.js` carries the
data side: convertTilemap is TerrainHelper.UpdateTileMapDataJob 1:1
((byte)(tile * 4) + rotate + flip * 2, FF water sentinel back to
record 0 - ConvertWaterTiles defaults true, all pinned); the grid
mirrors the retired quad path's corner heights and central-difference
normals exactly, on the same (x,z)->(x+1,z+1) diagonal, with one
shared index buffer renderer-side. Ground archives upload once each
as a 64x64x56 TEXTURE_2D_ARRAY (every ground archive is uniform 56
records of 64x64, probed); the tilemap rides an R8UI texture and
texelFetch. Lighting matches solids (ambient + sun N.L + the 16-light
loop) minus window emission; NEAREST without mips per repo texel
convention (DFU's mip bias is presentation-side). The ?terrain
elevation-ramp scene is retired (router case removed, scene deleted).
As-shipped DFU semantics kept: the flip bit renders as a 180-degree
rotation and rotate+flip as 270 (the shader's transform table).
CAUGHT IN BUILD: DFU's HLSL float2x2 initializers are row-major -
GLSL mat2 is column-major, so the rotation tables are transposed in
our shader (rotated tiles sampled the wrong direction until a
screen-projection probe exposed it). VERIFICATION: a ground-truth
probe rebuilds the player pixel's tilemap + the exact scene camera in
Node, projects tile-relative points to screen, and reads the
framebuffer - pure tiles matched the old path texel-for-texel at 40/40
points; forced-transform tiles (a shot-mode tile-override hook)
confirmed t1/t2/t3 at 15/15 points against the verbatim law, and an
in-shader transform-bit visualization pass confirmed the decode.
DEFECT (caught by Mac, fixed in the follow-up commit): drawMesh
assumed the solid program was bound; interleaving drawTerrain before
the model loop silently ran every location mesh on the terrain
program - buildings and walls vanished from the streaming world.
Every draw entry point now owns its program binding. The R9-era claim
that the ~270k px pre/post diff was coplanar-depth behavior was a
misreading of that bug: with the fix the full frame matches the
retired quad path at 332 residual pixels (isolated tile-seam /
rasterization ties), buildings identical. FOLLOW-UP: the exterior scene's RMB groundMesh (city-block
ground quads) still uses the per-tile-quad path - converting it to
this shader is queued; the classic dungeon water texture rides the
same texture-array family.
AUDIT NOTE (R9 audit): rotBit 0x40 / flipBit 0x80 / WorldMapTileDim
128 re-verified against source; convertTilemap's mask-then-add is
proven equal to the C# add-then-(byte)-cast (record bits <= 252, +3
never overflows - extreme pinned at 254 -> 251). DFU's tile texture
array wraps CLAMP (TextureReader) - ours switched from REPEAT to
match; the ~340 px residual vs the retired quad path is boundary-tie
noise either way. Integer texelFetch replaces DFU's alpha * MaxIndex
+ 0.5 float round-trip exactly. destroyMesh confirmed compatible with
terrain surfaces (shared index buffer is renderer-owned and
survives). Dead terrainMesh.js (zero consumers post-R9) deleted. All
four draw entry points own their program binding and restore
cull/blend/depth state - the drawMesh assumption class is closed.

## Milestone R10 - exterior ground on the tilemap shader (SHIPPED)

The standalone exterior scene's ground now renders through R9's
verbatim tilemap-shader pass: raw RMB tile bytes gathered into ONE
location-wide tilemap (16 tiles per block side, square over max(w, h)
blocks - 128x128 for Daggerfall city, exactly the shader's clamp),
random markers >= 56 reset to grass 8 and zero bytes stored as the
0xFF sentinel exactly as buildGroundTilemap / setLocationTiles; one
flat 2-triangle surface at GroundOffset spanning the true extent
(padding never sampled), ONE drawTerrain call replacing 64 per-block
ground meshes (city placements 1109 -> 1045, textures 293 -> 255).
src/render/groundMesh.js DELETED and the Ledger A per-tile-quads
departure row retired: the port now matches DFU's ground path
outright. A/B against the retired quads surfaced a real defect in
them - rotated tiles turned 90 degrees the WRONG WAY (the shader's
transform table is the R9-audited verbatim one); the 1.8% pixel diff
is the old bug leaving. Exterior ground is now consistent with the
same city rendered in the ?world scene.

## Milestone R11 - classic dungeon water texture (SHIPPED)

R7's flat-color planes now sample the CLASSIC water picture: ground
archive record 0 of the dungeon location's climate - the same texture
the 0xFF tilemap sentinel resolves to on oceans (Alik'r dungeons get
desert 2/0, Daggerfall-region ones temperate 302/0). Water pass gains
the sampler: world xz -> UVs at the classic 6.4-units-per-tile scale
(the 51.2 plane is exactly 8 tiles), REPEAT wrap, slow diagonal scroll
(0.05 tiles/s - the classic flow, presentation-tuned), alpha 0.82 over
the R7 blend state; the pass stays unlit (full-bright surface). DFU
has NO classic path here (AddWater is a modern prefab), so the texture
SOURCE is the documented choice, grounded in the sentinel mapping.
Proof: Maorn's Guard pool 0 hovered via the new window.__pose probe
hook (dungeon + world scenes; SHOT_EVAL note in Testing.md) -
blue-dominant mean (64, 104, 153) with real texel variance vs R7's
flat fill. Scene fetches the climate ground archive and uploads
record 0; drawWater(quads, color, tex, scrollTiles).

## Milestone R12 - weather: fog, weather skies, sun dimming (SHIPPED)

`src/world/weather.js`, verbatim WeatherManager: WeatherType {Sunny,
Cloudy, Overcast, Fog, Rain, Thunder, Snow}; FogSettings table (Sunny/
Overcast linear 0..2400, Rainy exp 0.003, Snowy exp 0.005, Heavy exp
0.05 with the sky INCLUDED, Interior exp 0.001 and Dungeon exp 0.005
both sky-included with BLACK fog - SetFog's interior branch); the
SetWeather mapping exactly (Cloudy keeps sunny fog per the upstream
skybox TODO; Fog weather takes the RAIN sky + heavy fog); WeatherStyle
sky offsets Rain1 4 / Rain2 5 / Snow1 6 / Snow2 7 picked 50/50 on the
approved umRandom (SkyIndex = SkyBase + offset - groups are 8 wide so
NITE night mapping never crosses); SetSunlightScale (winter 0.65 first,
Overcast/Fog 0.65, Rain/Snow 0.45, Storm 0.25); IsSnowFreeClimate
{224, 225, 227, 229}. Renderer: distance fog in ALL world passes
(solid, terrain, billboard, water) - per-fragment length(world - cam)
with Unity's linear (end-d)/(end-start) and exponential exp(-density*d)
factors, camera position extracted from the view matrix each frame
(numeric round-trip verified); the sky pass gains a fogMix (heavy fog
swallows the sky, mix = 1 - exp(-density * 800)). AUDIT 64 F9: the R2 Fog WINDOW style is
NOT wired to WeatherType.Fog any more - DFU declares WindowStyle.Fog and
MaterialReader.cs:927-929 spends it, but no writer in the tree ever hands
it Fog (WeatherManager.cs names no window at all), so the port likewise
assigns only the clock's Day/Night and keeps the fog row for the ?window=
dev override, as it keeps Custom. EQUIVALENCES: outdoor fog COLOR is DaggerfallSky.SetSkyFogColor's cameraClearColor
(= west element 0, the sky horizon), verbatim; shadowStrength has no
consumer.
Scenes: exterior + world take ?weather= and ?wseed (deterministic sky
variant); dungeon and interior apply their verbatim always-on fog.
Proofs: heavy fog collapses the far band to the fog color (stddev 4.6
vs 58.1 sunny; sky top and horizon geometry converge on (90, 92, 99));
rain swaps the sky ((102, 105, 117) top vs sunny (243, 249, 248)).
Precipitation particles + storm lightning are the next milestone.
AUDIT (post-R12): the scenes' initial "off" shortcut for Sunny/Overcast
fog deviated from verbatim - DFU never disables fog (SetFog's Nystul
comment); Sunny IS active linear 0..2400, the classic distance haze.
Shortcut removed; band-diff vs the pre-R12 baseline shows a clean
gradient (horizon mean delta 45 tapering to 10 nearest, sky untouched).

## Milestone R13 - precipitation + storm lightning (SHIPPED)

Rain streaks and drifting snow: `src/render/precipitation.js`, a
shader-animated particle volume that wraps around the camera (mod-space
positions advance in the vertex shader - zero per-frame CPU), rain
quads stretched along the slanted fall direction, snow camera-facing
with per-particle sine drift, edge-faded to hide the wrap, blended and
depth-tested with no writes, drawn last, deliberately unfogged.
Presentation values are ours; the 1000-particle cap is the one number
anchored on the Rain_Particles prefab (maxNumParticles). Storm shares
the rain look. LIGHTNING is verbatim AmbientEffectsPlayer
.PlayLightningEffects in `weather.js` (LightningPlayer): strikes every
random.Next(4, 35) s, flash budget by clip class (Short 4-8, Thunder
5-10, ThunderRoll 20-30; the class is exposed for the Audio arc's
delayed thunder), each budget slot = one maybe-on frame (Random.value
< 0.6 -> SUN intensity x2) then one off frame - the coroutine's
WaitForEndOfFrame pairs, frame-quantized; the SkyColorScale flash is
deprecated upstream and skipped; at night the sun is off so flashes
are invisible, verbatim. Engine randomness on umRandom (Ledger A).
?flashtest pins the multiplier for shots. Proofs: rain adds 2984
streak pixels over the R12 rain baseline; snow shows 1449 bright-white
flakes; flashtest brightens the storm scene mean by 3.23. Strobe
determinism, the flash-then-off invariant, and clip classes are pinned
in test/weather.test.js.

## H1 (2026-08-23): THE HANDEDNESS LAW - the world was the mirror image (SHIPPED)

Mac's playtest: "signage is inverted." The trail led all the way down:
the world DATA is DFU's left-handed (x east, y up, z north; the layout
math is a 1:1 translation), and the hand-rolled renderer's RIGHT-handed
lookAt put world +x on screen-LEFT - so the port has presented the
MIRROR IMAGE of classic since M1. Every town flipped east-west, every
sign and wall text reading backwards, every sprite's handedness
swapped. Nobody could tell because the whole input layer (yaw sign,
strafe sign, fly right) had been tuned against the mirror, one
"felt swapped" fix at a time - the motor even carried a comment PROVING
the old screen side from the projection and reverting a prior flip. The
proof was true; the convention it proved was the mirror. Text was the
only asymmetric content in the world, and text told.

The fix is ONE mirror at the projection (`mirrorProjectionX`, mat4.js -
the law lives there) plus its consequences, each at its site: the world
meshes' front faces arrive clockwise (renderer init frontFace(CW); every
other pass brackets CULL_FACE off), and the input signs flip back to
Unity's own (yaw += dx, strafe/fly right = (cos, -sin), the exterior
shot-mode camRight). The billboard camRight and the SKY's screen ray
were ALREADY written to the correct convention - they had been
mismatching the mirrored world (the sky's east-west ran opposite the
meshes') and simply stop mismatching. The FP viewmodel keeps its own
unmirrored camera. MobileUnit's orientation/flip tables are verbatim
DFU and were never re-tuned, so enemies come out DFU-correct in the
same stroke.

Pinned in `test/handedness.test.js` at the matrix level (world +x ->
NDC x > 0, the input-web agreement, the deliberate viewmodel
exception).

THE FIRST ARENA2 EYES FOUND A REGRESSION, NOT THE MIRROR (2026-08-23,
the second playtest): the game opened to nothing but the clear color -
"a sky blue screen". frontFace(CW) is GLOBAL GL state, and two passes
drew with culling ON and CCW winding: the 2D screen-quad pass (the
ENTIRE UI - title screen, chargen, HUD, windows, fonts) and the sky's
fullscreen triangle. Both culled to nothing; the pale Iliac Bay
clearColor was all that survived. The init comment had asserted
"every other pass brackets CULL_FACE off around itself" - it was
wrong about exactly these two. Fixed with the brackets (the overlay
pass's own idiom), reproduced and verified at the real-GL level by
tools/cullProbe.mjs (headless chromium + swiftshader: draw one solid
quad through drawScreenQuad, read the pixel back - culled before,
draws after), and pinned in handedness.test.js. THE LESSON, arc law:
a global GL-state change is reviewed against EVERY draw site, not the
pass it was written for - node tests cannot see culling, so the probe
is the regression's real gate.

THE THIRD PLAYTEST REPORT (2026-08-23): "the entire dungeon layout
has flipped orientation." Verified NOT a bug - it is the mirror fix
SEEN FROM INSIDE. The dungeon pipeline's math is DFU-verbatim line
for line (checked against the source at report time: block grid
`block.x * RDB_SIDE, block.z * RDB_SIDE` = DaggerfallDungeon.cs:319;
object placement `(x, -y, z)` = RDBLayout's (XPos, -YPos, ZPos);
rotations `-x/-y/-z / RotationDivisor` = RDBLayout.cs:699-701; the
RMB row lookup `y * width + x` = MapsFile.cs:829-832), and no audit
ever baked a compensating flip into it. So pre-H1 the dungeons were
presented as classic's mirror image exactly like the towns; the one
mirror un-flipped them all in the same stroke. Towns carried signage
to witness the new presentation as correct - dungeons flipped with no
witness, and every layout memorized in this port before H1 now reads
mirrored, WHICH IS WHAT FIXING A MIRRORED WORLD MUST DO. The check
that settles it in-game: Privateer's Hold against DFU or a classic
map - the port now matches. Data space never changed (positions,
saves, colliders are untouched); only the camera's presentation did.

STILL NEEDS ARENA2 EYES: the mirror itself - re-shoot the
sprite-orientation close-ups and a signage crop; the historical
orientation crops were validated under the mirror, and the process
rule (compare against the raw record art) now finally has a
presentation that can match it.

## Queue

Owned by `Rendering.md`, which says EMPTY - and that is the answer.
~~Next up: spectral/firewall emission colors (lands with spectral enemies -
Characters arc dependency).~~ The spectral half SHIPPED 2026-07-06 (see
Characters-Arc E4); only GetFireWallColors32 is unported, and it waits on a
firewall consumer rather than sitting on a queue. AUDIT 18 struck this line:
two pages gave opposite answers to whether the Rendering queue was empty.

## Milestone R12 - the exterior indirect player light (SHIPPED 2026-08-16)

The Ledger C row from the R5 audit, closing the Rendering reopen.
Verbatim from SunlightManager + the SERIALIZED SunlightRig prefab
(git show Assets/Prefabs/World/SunlightRig.prefab - the Home rule):
IndirectLight is a POINT light, intensity 1.0, range 150, color
0.7058824 gray, parented to the rig and positioned at the player
every Update. (The Ledger's "white 0.6" note was the rig's
directional FILLS - the prefab is authority, recorded in worldClock.)

- SunlightManager behavior: intensity = saved x the SAME
  daylight-curve scale as the key light; the whole rig disables at
  night; weather dimming rides along (our weatherSun).
- Engine seam: uIndirect (player pos + range) + uIndirectColor
  uniforms across all four lit programs (mesh, terrain, character,
  billboard - attenuation-only on billboards like the lantern term),
  the same squared-linear falloff as the city lights (the documented
  Unity-point-light equivalence). Zeroed defaults make the term
  contribute exactly nothing in the unlit scenes (dungeon/interior
  keep their ambient model).
- Scenes: exterior + streaming world set it per frame at the eye
  (the 0.8 controller-center offset is <1% of the 150 range,
  documented).
- PROOF (the P9/R9 doctrine - framebuffer evidence, not theory):
  baseline-vs-R12 noon exterior shots through the provisioned
  Chromium; the near-ground band brightened 135.4 -> 153.3, the sky
  band stayed BYTE-IDENTICAL across separate boots (no pass lost -
  the R9 full-frame composition check), and the diff confined itself
  to the lit half of the frame.

Suite 312/75 green (no new unit surface - the proof is the shot
comparison; the scale/constants ride worldClock where clock.test's
LightCurve pins already gate the curve).

## ES1 - THE ENHANCED SKY (2026-08-27, Mac's call) - SHIPPED

Mac: "for the enhanced version of the game, I want us to develop our
own take on the procedural sky system mod from DFU."

Daggerfall's sky is 64 painted frames a day (SKY??.DAT) and one painted
night (NITE??I0.IMG), and R4 ported that verbatim - it stays, untouched,
and is what the CLASSIC skin draws. DFU's Enhanced Sky mod (Lypyl)
replaced the paintings with a real sky out of textures. THIS IS OUR
TAKE, and it is entirely procedural: one fullscreen pass, no textures
at all, so it ships with the port and needs no game data - a sky that
draws before the folder pick, on a phone, in 380 lines.

WHAT IS DFU'S AND WHAT IS OURS. The LAWS the sky reads are the port's
own verbatim ones - the sun's arc is worldClock's (dawn at map east,
noon overhead, dusk at map west, and the sky's sun IS the lit world's
sun while it is up, pinned), day and night are DawnHour 6 / DuskHour
18, the moons' phases are gameDate's 32-day ratio with its offsets -
since CLK3 taken as a CONTINUOUS number on the clock
(`lunarPhaseFractionsFromMinutes`), never the day-step ladder every
system still reads - the
weather is the weather sim's own types. Everything that turns those
into light is OURS: the palette, the moons' places, the stars, the
clouds, the glow.

THE PALETTE IS A RECORD. `SKY_KEYS` is a table keyed by the SUN'S
ELEVATION in degrees - deep night, astronomical twilight, the -4 band
where the horizon burns, the horizon itself, morning, noon - and every
colour on the dome is an interpolation of it; `WEATHER_SKY` is a row
per weather type (cover, edge softness, how far the dome greys, the
clouds' lit and shaded colours, a wind). The FRAGMENT SHADER CARRIES NO
COLOUR AT ALL - pinned - so there is exactly one place a colour lives
and "change a row, change the sky" is true.

THE MOONS' PLACES are ours with a physical spine, and they are the one
thing a player can catch a sky lying about. A moon sits on the sun's
own arc, BEHIND the sun by its phase: new beside the sun (so never seen
at night), a waxing crescent a little behind (in the west after sunset),
full opposite (rising as the sun sets, overhead at midnight), a waning
half three quarters behind (rising at midnight, high at dawn). So DFU's
phase and the moon you see agree - a lycanthrope's full moon IS a full
moon overhead at midnight - and the terminator is a lit sphere, not a
texture. Masser is the big red one, Secunda smaller, paler and tilted
off the arc so they do not overlap forever.

THE SEAM. `createSkyController` builds the enhanced pass when the skin
is enhanced and `?sky=classic` is absent, and exposes ONE `renderer`
field either way, so the hosts read clearColor and set fogMix/fogColor
without knowing which pass they hold. The classic path is untouched by
construction (skyRenderer.js contains the word "enhanced" nowhere), and
its panorama cache is never built for under the enhanced sky - which is
also ~29 MB of CPU pixels the enhanced skin now never allocates. Both
exterior hosts hand the weather and the classic clock through for the
clouds and the moons; the call is synchronous - numbers into uniforms,
nothing to load.

SEEN, NOT ASSERTED. A sky is judged by eye: `tools/enhancedSkyProbe.mjs`
opens `sky.html` (the lab, `src/tools/skyLab.js`) in a real WebGL
context at a set of hours, weathers and views, screenshots each, and
judges what a screenshot can - no page or GL error, no black frame,
noon brighter than midnight (174 vs 12), the sun's disc in the frame
looking up at noon, storm darker than overcast darker than clear
(95 < 137 < 174), points of light at midnight, and Masser's warm lit
disc where the law puts it on day 11. 7/7. The frames were eyeballed:
the noon blue with its horizon haze, the dawn burn from the east, a
midnight starfield, Masser half-lit among the stars, and a storm's
heavy overcast.

Pins: `test/enhancedSky.test.js`, 6 tests - the palette as an ordered
record interpolated in elevation with no colour in the shader; a
weather row per type the sim can produce, ordered in cover and grey;
the sun as worldClock's arc CONTINUED below the horizon (twilight is a
matter of degrees, and sunDirection clamps that away); the moons' places
against their phases (full up at midnight, new never seen at night, the
waning half high at dawn); the frame state (the hosts' clearColor and
fillColor roles, the phases coming from the CLASSIC clock as a NUMBER on
it since CLK3 - a day walking a quarter of a ring step, the morning within
a step of DFU's ladder - a moon under the world not drawn, an unknown weather falling
to clear); and the seam. 2 mutants, 2 dead.

FOUND ON THE WAY, AND CLOSED THE SAME DAY: below the horizon the dome
filled with the flat horizon colour AND took the full dawn glow (the
glow fell off with `exp(-e * 9)` where `e` is the CLAMPED elevation, so
everything under the line got `e = 0`, the maximum). At dawn that drew a
bright tan slab with a hard seam at the horizon - the one fault in the
first render. The dome keeps going down now: the horizon colour darkens
toward the nadir, and the glow falls off below the line as fast as above
it, so the horizon reads as a line rather than an edge. The darkening is
DELIBERATELY MILD (0.55 of the horizon colour at the nadir, eased): the
world's geometry covers this band in play, and where it does not - the
streamed world's far edge - a pale band blends into the distance haze
where a dark one would announce itself.

## ES1c - THE POLISH (2026-08-27, Mac's call) - SHIPPED

Mac, on the first sky: "how can we improve this". Five faults were put
to him off the frames and the code; he took four. The fifth - a moving
cloud's shadow on the ground - is a change to the WORLD's lighting, not
the sky's, and stays on the board.

THE BANDING. A dome is one enormous smooth gradient and eight bits is
not enough for one: 46% of the rows down the middle of a noon frame came
out byte-identical to the row above, which is a visible stair. A
sub-quantisation dither at the write breaks it. FLAT noise only took it
to 32%; TRIANGULAR noise - two hashes summed, the shape that fully
decorrelates the quantisation error from the signal - took it to 25%,
which is what a dithered gradient looks like. Two instructions.

THE CLOUDS WERE FLAT. One fbm sheet coloured by its own noise value: it
had no depth, because nothing moved against anything, and no idea where
the sun was, so a bank never had a bright rim or a dark belly. Now TWO
DECKS - a high one, smaller and slower and thinner, behind a low one,
larger and faster, which occludes it where it is - and both LIT: a rim
where the ray points near the sun (the light coming through a thin
edge, gated by uSunVis so it is nothing at night), the thick parts
darkening away from it. The probe judges it: under the same cloud at
mid-morning, looking east at the sun is 183 against 164 looking west.

THE WEATHER SNAPPED. The sim flips its type between two ticks and the
state was rebuilt from the type every frame, so the whole dome changed
in the time it takes to draw once. A weather row is a set of NUMBERS,
so the sky keeps its own and walks them - cover, softness, greyness,
wind and both cloud colours, one exponential on a 14-second constant
(`easeWeather`, pure, injectable). The first call takes the row whole:
a boot into rain is rain. The same lesson as the danger meter: a slow,
meaningful state should arrive slowly.

THE STARS STOOD STILL. The field was fixed in world space, so midnight's
sky was dusk's sky exactly - the one thing everybody has seen a night
sky do is turn. It turns now, about a POLE (north, leaned off the
zenith - ours; the Iliac Bay has no stated latitude), one revolution a
day on the same clock the sun rides, by Rodrigues in the shader. The
field is sampled in the TURNED frame but fades at the REAL horizon, so
a star sets where the horizon is. The probe fingerprints where the
bright points are: three hours on is a different sky, and still full of
stars.

Pins: 4 more in `test/enhancedSky.test.js` (10 now) - the ease
(exponential, monotone, whole on the first call, no time no move,
colours eased too, and the controller keeping one and walking it), the
wheel (a full turn a day, one way, a unit pole off the zenith, the
turned sample and the real fade), and the shader's decks, rim, belly
and triangular dither. 5 mutants, 5 dead. Probe: 9/9, with the lit
pair and the wheel added.

## ES1d - THE CLOUD IN FRONT OF THE SUN (2026-08-27, Mac's call) - SHIPPED

The fifth fault, taken next: "do it." A weather already scales the
world's sunlight (WeatherManager, verbatim), but an individual cloud
passing overhead changed nothing on the ground - the sky hid the sun's
disc and the ground did not notice.

IT IS ONE FIELD, ASKED TWICE. The shader already multiplies the sun's
disc by `1 - cloud` along the sun's own ray. `sunOcclusion(state)` is
that same number on the CPU: the shader's hash, value noise, fbm and
`deck` written in JS and evaluated at `state.sunDir`. So what you SEE
and what you FEEL cannot disagree - the disc goes and the ground goes
with it, because it is one field at one direction. The two texts are
pinned against each other line for line (the deck calls, the occlusion
sum, and the six magic numbers of the noise), because a drift here is a
sun that dims when the sky says it should not.

WHAT IT IS AND IS NOT. It is a DIMMING, not a projected shadow: the
dome is infinitely far, so the cover moves with the WIND (which a real
cloud shadow does) but not with the walker (which a real one also
does). Measured over 400 seconds at nine in the morning: a clear sky
occludes 0.02 on average, a broken one sweeps the whole range 0.00 to
1.00 - which is the point, a bank crossing the sun - and a solid deck
sits at 1.00.

AND IT TAKES THE KEY LIGHT ONLY. `CLOUD_SHADOW` is 0.55, and it
multiplies `sunScale * weatherSun * flash` in both exterior hosts and
NOTHING ELSE. Under a cloud the direct sun goes; the sky itself still
lights the ground, so the ambient and the indirect are untouched. Both
halves pinned.

## ES1e - THE RETRO PASS (2026-08-27, Mac's call) - SHIPPED, REMOVED (FT3, 2026-09-14, Mac: "Remove our version of pixelated sky")

Mac: "I really want to try and match the retro artwork aesthetic of
Daggerfall." A smooth 24-bit dome beside a chunky classic sprite was
the one thing in the enhanced sky that did not look like the game.
Two knobs, both the era's own techniques rather than a filter over the
top, and ON BY DEFAULT (`?sky=smooth` keeps the modern dome).

THE PIXEL IS THE PAINTED SKY'S PIXEL. Not a screen grid - the first
attempt snapped to 320x200 in NDC and it was wrong in three ways at
once. SKY??.DAT is 512 pixels across 180 degrees, which skyRenderer
already names SKY_ANGLE_PER_PIXEL (PI/512), and the ray's azimuth and
elevation are snapped to exactly that step BEFORE anything is computed.
So: the enhanced sky's pixels are the SAME SIZE as the painted sky's,
and the two skins read as one game; they are fixed to the WORLD, so
they stay put when you turn your head instead of crawling with the
camera, as a bitmap sky's do; and they do not move with the field of
view or the window, so a phone and a desktop see the same sky at the
same scale. Everything is drawn ON that grid - the sun's disc, the
moons' terminators, the stars, the cloud edges.

THE COLOUR IS A 1996 GRADIENT. Posterised to 26 levels a channel with
an ORDERED (Bayer 4x4) dither - the exact thing a 256-colour gradient
did in 1996, and the reason Daggerfall's own skies have that woven look
up close. The Bayer cell is indexed by the ANGULAR cell, not the screen
pixel: one dither cell per sky pixel, or it is a fine weave under a
coarse one, and it would crawl when the camera turned.

FOUND ON THE WAY: the SMOOTH pass's dither, added in ES1c, was
`hash21(gl_FragCoord.xy)` - which measured well (46% of identical rows
down to 25%) but is STRUCTURED at integer coordinates, a visible weave
under magnification, which is the one thing a dither must not be. It is
interleaved gradient noise now, the standard for exactly this.

ONE DOOR: `retroFor(search)` decides, and the game and the LAB both
call it, so the lab cannot show a sky the game does not draw - which it
did for one run, and the probe caught it (retro and smooth measured
identically because the lab never read the flag).

Pins: 2 more (12 now) - the occlusion (nothing at night, clear barely,
broken sweeping, solid whole; the two texts pinned against each other;
the key light dimmed in both hosts and the ambient NOT), and the retro
pass (the step IS SKY_ANGLE_PER_PIXEL, the levels a palette's not a
24-bit one, on by default and off with ?sky=smooth through one door
both callers use, the snap on the DIRECTION before the dome is
coloured, the Bayer indexed by the angular cell, and IGN on the smooth
pass). 6 mutants, 6 dead. Probe 10/10, with retro measured against
smooth: 124 changes and 8 levels across a row, against 376 and 69.

## ES1f - NO POLE, NO CIRCLE (2026-08-27, Mac's report) - SHIPPED, REMOVED (FT3, 2026-09-14, Mac: "Remove our version of pixelated sky")

Mac, looking up: "any way to get rid of the circle that everything
weaves into. The circle when you look up at the very middle."

He was looking straight at the projection's seam. ES1e snapped the ray
in AZIMUTH and ELEVATION, and a lat-long grid has its POLE at the
zenith: the elevation rings become concentric circles centred there and
the azimuth cells converge to nothing, so the sky wove into a bullseye
overhead - at every hour, in every weather, and in the star field too,
which had its own pole and piled its density onto it. (The painted sky
never shows this because its strip stops at 77 degrees and everything
above it is a flat fill; a dome that reaches the zenith has nowhere to
hide.)

A CUBE HAS NO POLE. The direction is projected onto whichever of six
faces it points at, snapped on that face's square grid, and rebuilt.
The zenith becomes an ordinary patch of an ordinary face. The star
field rides the same grid, so it has no pinwheel and an even density
(its scales were raised to keep the count: a cube covers the sphere
with far fewer cells than a lat-long grid does).

AND THE FACES ARE EQUI-ANGULAR, which was the second pass and the one
that finished it. A plain cube face is a TANGENT plane, so its cells
cover 2.6x less sky at the corners than at the centre - and a cell size
that varies across the frame beats against the screen's own grid and
draws curved moire rings. That is the pole's ghost rather than its
cure, and an amplified difference image showed it plainly. Warping each
face by atan (the equi-angular cubemap of 360 video) makes every cell
the same angle everywhere. It also makes the count exact: 90 degrees a
face over n cells at one step each is n = (PI/2)/step = 256 a face,
512 across 180 degrees - which is SKY??.DAT's own width, so the retro
pixel is now provably the painted sky's pixel rather than approximately
it.

Verified the way it was reported: looking straight up, at noon, at
dusk, under cloud and at night. The bullseye is gone from all of them,
and a 22x amplified deviation image - which is how the residual ring
was found in the first place - shows an even weave with no centre.
Pins: 1 more (13) - the lat-long snap gone root and branch, the cube's
face choice and its per-face cell ids, the atan/tan warp both ways, the
count landing exactly on 256 a face, and the star field on the same
cube. 3 mutants, 3 dead. The probe's retro-vs-smooth threshold was
retuned: the equi-angular cells are a touch smaller near the horizon
than the lat-long ones they replaced, so `changes` alone was the wrong
measure and LEVELS - 8 against 69 - is the decisive one.

ON THE HORIZON: the sky as a setting rather than a URL, lightning on
the thunder weather, and a season's hand on the palette. (DS1 took two
of the three another way: the sky IS a setting now - the Mods pane's
Dynamic Skies switch chooses between the dome and the mod - and the
thunder weather flashes, with the mod's own lightning.)

## DS1 - DYNAMIC SKIES, THE MOD, 1:1 (2026-09-04, Mac's call) - SHIPPED

Mac: "I want to implement this mod 1:1. We received permission from the
creator. I also want it to be compatible with our current
implementation." The whole account is `Dynamic-Skies.md` beside this
file; the ledger row is Port-Ledger A. The short of it: BadLuckBurt and
carademono's Dynamic Skies 2.3.4 vendored with permission, its C#
ported with its quirks and its shader translated line for line (in
DFU's LINEAR colour space, which decides how every colour and texture
reaches the GLSL), standing beside ES1's dome on the one controller
seam as the enhanced lane's sky while its own switch is on. Under it the
ease, the wind, the front, the rain, the grass, the mills and the
moonlight term keep working; the mod's fog table, light curve, fog
colour, lightning and pixel snow reach the world where the mod reaches
it in DFU. Seen on SwiftShader through the lab's new door
(`sky.html?sky=dynamic`, `tools/dynamicSkiesProbe.mjs`, 11/11): the
layered clouds over the scattering blue, the disc at sunset over an
orange sky, the twinkling star field. Pins: 20 in
`test/dynamicSkies.test.js`. One probe-found fault fixed before landing:
every weather rendered Sunny, because the mod's own OnWeatherChange
swallows the event that lands in Init's pending window and DFU's
OnLoad is what papers over it - the port's first word is a load now.
The boot probe and the world render gate need ARENA2 and are the next
machine's to run.


## SIB1 - SEASONS OF THE ILIAC BAY, THE MOD, 1:1 (2026-09-05, Mac's call) - SHIPPED

Mac: "The next mod I want to implement 1:1 is this. also have
permission." RosyTheRascal's Seasons of the Iliac Bay 1.1: autumn,
spring and winter repaints of the woodland, hills, haunted and mountain
nature flats at 3.1x. The whole account is `Seasons-Iliac-Bay.md`
beside this file; the row is Ledger A SIB1. The script (a compiled DLL,
read off the IL) is ported to `systems/seasonsIliacBay.js`; the
textures are re-shaded classic flats and stay OUT of the repository by
the doctrine's own sentence - they come from the player's own copy of
the mod, the `.dfmod` itself through a UnityFS reader written for it
(`formats/unityBundle.js`, validated 374/374 against a reference
extraction) or the mod's folders, through the texture pick. Both
climate hosts take the seasonal record per flat; the streaming host
answers the mod's batch refresh with the winter flip's own re-skin
sweep, filtered to pixels built under an older install.

## INCIDENT 2026-09-04 - THE SEE-THROUGH LINES IN DUNGEON WALLS (Mac's report) - SHIPPED

Mac: "Dungeon interiors have some sort of see through line in its
walls. Like it's not fully connected." The geometry was connected.
Four laws had drifted from DFU, and each one made the same one-texel
line worse.

**1. The mesh material was uploaded as a cutout.** The pipeline had one
upload door, `uploadRecord`, and it called `getColor32(bitmap, 0)` -
palette index 0 transparent - for models and flats alike, while the
model shader ended `if (tex.a < 0.5) discard;`. DFU builds a mesh's
material through `MaterialReader.GetMaterial(archive, record)` whose
`alphaIndex` defaults to -1 (`MaterialReader.cs:352`, reached from
`DaggerfallMesh.cs:141/:169`): NO cutout index, and
`DaggerfallDefault.shader` never clips. Only the billboard path
(`GetMaterialAtlas`, `GetMaterial(..., 0)`) makes index 0 transparent.
The mortar runs of a wall texture are index 0 in the classic art, so
every one of them became a slit the model shader discarded, and the
room behind showed through. Now: `uploadRecord(archive, record, {
opaque })` decodes at -1 for a mesh and 0 for a flat, every sub-mesh
site (the pipeline's model and part uploads, `texRemap`'s climate
swap, `interiorContext`'s swap) asks for the opaque material, the
renderer keys it `archive_record#opaque` (OUR device, not a DFU law -
see AUDIT 62 F27) and `_drawMeshBundle` looks there first with a fall-back
to the cutout upload, and the model fragment shader carries no alpha
clip. The billboard shader keeps its discard.

**2. The clear colour.** Every host cleared to the Iliac Bay's sky
blue, so what showed through a slit was a bright line.
`CameraClearManager.cs:23-25/:51-57` clears an interior to solid
BLACK and an exterior to depth only behind the sky. `setClearColor`
(idempotent through the renderer's Float32 shadow, which the panel
bracket restores from) with `SKY_CLEAR` / `INTERIOR_CLEAR`: the
dungeon and interior hosts set black at boot, world and exterior set
by mode before the frame.

**3. No mip chain.** `TextureReader` builds one on every classic
texture (`:31 mipMaps = true`, `:264 Apply(true)`) and samples it
point (`MaterialReader.cs:104/:437`, FilterMode.Point = nearest texel,
nearest mip). Without the chain a one-texel line keeps full contrast
at any distance and shimmers as the camera moves; with it the line
dissolves into the wall a few metres out, which is what DFU shows.
`uploadTexture` now generates the chain and sets
`NEAREST_MIPMAP_NEAREST` for every non-smooth upload; the smooth (UI)
upload keeps its single LINEAR level.

**4. One cache key for both.** With flats and meshes sharing
`archive_record`, whichever asked first decided the pixels the other
drew with. The `#opaque` key ends that.

Pins: 7 in `test/incident_dungeon_seams.test.js` (the alphaIndex
values, the pipeline's doors, the shader clip, the two-key cache and
the draw's preference, the mip chain and filters off the recorded GL
calls, the clear colour's idempotence and the four hosts). Two EV2
pins moved to the `#opaque` key and the texture-replacement pin to the
door's new signature. NO ARENA2 IN THE CONTAINER: the diagnosis is by
reading against DFU, and the four surfaces want Mac's eyes on the live
site - dungeon walls up close and at distance, the black backdrop
behind any remaining crack, the look of every classic texture at
distance now that a mip chain sits under it, and the exterior sky
still clearing blue.

### REVIEW 2026-09-05 - the adversarial round over PR #55

Six finder lenses over the merged diff, two refuters per finding; 23
confirmed, folding to four on this half:

- **The late-stood interior person never drew.** `interiorContext`'s
  `standPerson` upload had been sent through the mesh door too, and
  that site is a FLAT (`DaggerfallBillboard.cs:289-293`, alphaIndex 0)
  - `drawBillboards` reads the bare key only, so a person stood by the
  `UpdateNpcPresence` re-roll whose record no build-time batch had
  uploaded was invisible. Reverted; the pin that had forced it (the
  interior has no mesh door of its own - its swap rides
  `remapSubMeshes`) now says the opposite, and a Proxy-GL pin shows an
  opaque-only upload issuing no draw.
- **The world-hosted dungeon never cleared black.** `world.js`'s and
  `exterior.js`'s `setClearColor` sit AFTER their `modes.frame` early
  return, so in dungeon and interior modes the line was dead and the
  classic-start Privateer's Hold still cleared sky blue (only the
  standalone `?dungeon` host went black). `worldModes` now sets
  `INTERIOR_CLEAR` immediately before each of its two `beginFrame`s;
  the streaming hosts' call is the exterior's `SKY_CLEAR` only.
- **The mip chain reached UI art.** `ImageReader.GetTexture` builds
  with `mipChain false` (`ImageReader.cs:59`); the chain is now gated
  on a numeric TEXTURE.nnn archive (`{ mips }` overrides), so the
  string-keyed IMG/CIF/font/automap/video uploads keep one NEAREST
  level and the video no longer regenerates a chain per frame.
- **Emission maps had no chain** while the albedo they are subtracted
  from did (`TextureReader.cs:316/:328/:340` build them mipped,
  `MaterialReader.cs:448` samples them point): at distance the
  shader's `albedo - emission` mixed a coarse mip with a level-0 texel
  and a window shimmered. `uploadEmissionTexture` mips too.

Refuted (3): `releaseTexture` and the `#opaque` variant (it never
cached the variant it was accused of leaking), the video's per-frame
chain as a separate finding (folded into the gate above), and the
exterior automap layout upload (string-keyed - covered by the gate).

### REVIEW 2 - the round over PR #57 (2026-09-05)

One rendering finding survived: the inventory and item-scroller icons
come from TEXTURE.nnn item archives (numeric) through the same
`uploadRecord` door, so the world-art gate mipped them where DFU's
`ImageReader.GetTexture` builds UI art with no chain (`:59`), and a
minified icon on a small canvas would have sampled a box-filtered
level. The door takes `mips: false`, the renderer keys that variant
`#ui` beside the bare (mipped) key of the same record, `releaseTexture`
frees every variant, and the two icon drawers ask for and read it.

### AUDIT 62 F27 (2026-09-07) - the `#opaque` key's rationale cited a DFU law that does not exist

The comment at `renderer.js`'s `uploadTexture` key and the pin message
in `test/incident_dungeon_seams.test.js` both said "DFU caches
materials per alphaIndex". It does not. `MaterialReader`'s cache key is
`MakeTextureKey(archive, record, frame)` plus a key GROUP and nothing
else (`MaterialReader.cs:961`, the hit taken at `:387-392`);
`alphaIndex` never enters the key, and it is the FIRST requester that
fixes both the alpha treatment and the shader every later asker
receives (`:409`, `:429-432`). A mesh (`alphaIndex` -1, `:352`) and a
non-atlas flat (`alphaIndex` 0, `DaggerfallBillboard.cs:289-296`)
therefore share ONE entry in DFU. It is invisible there because
`GetColor32` keeps RGB and only zeroes the alpha
(`BaseImageFile.cs:257-260`) while `DaggerfallDefault.shader:24` is
`Opaque` with no clip, and because the ordinary flat rides the separate
atlas key group (`:553`).

The `#opaque` variant key itself stands and nothing behavioural
changed: OUR two shaders DO read that alpha channel differently - the
billboard shader discards on it - so one GL texture cannot carry both
treatments and the -1 and 0 uploads must key apart. What changed is the
citation: the comment and the pin message now name the real mechanism,
and the arc's own account of seam 1 above is corrected with them. The
file header's item 4 already described the port-side collision
correctly and is unchanged. Every assertion in the seams pin (two keys,
distinct textures, the mesh's preference for `#opaque`, the fall-back
to the bare key) is kept as it was.

### AUDIT 64 F8 (2026-09-08) - the town glass burned on the sun's flag, not the lanterns'

`windowStyleForTime` (`src/world/worldClock.js`) answered
`isNight(minuteOfDay) ? 'night' : 'day'` - DawnHour 6 / DuskHour 18.
Both writers of a window style in Daggerfall Unity read the OTHER
property. `DaggerfallLocation.ApplyTimeAndSpace`
(`Internal/DaggerfallLocation.cs:141-145`) is
`if (dfUnity.WorldTime.Now.IsCityLightsOn) WindowTextureStyle =
WindowStyle.Night; else WindowTextureStyle = WindowStyle.Day;`, and the
poll that re-runs it (`:120-129`) edges on `lastCityLightsFlag !=
Now.IsCityLightsOn`; the asset-injection twin,
`Utility/AssetInjection/Components/DayNight.cs:90` then `:120`, is
`WindowStyle style = lightsOn ? WindowStyle.Night : WindowStyle.Day`
over the same `IsCityLightsOn`. `Utility/DaggerfallDateTime.cs` keeps
the two properties apart: `IsCityLightsOn` is `Hour >= LightsOnHour(17)
|| Hour < LightsOffHour(8)` (`:155-157`), `IsNight` is `Hour <
DawnHour(6) || Hour >= DuskHour(18)` (`:171-173`). Nothing in the tree
selects a window style from `IsNight`.

So the port lit its town windows an hour late and unlit them two hours
early, while the city lanterns beside them - which both exterior hosts
read correctly off `isCityLightsOn` (`world.js`, `exterior.js`) - were
already burning. From 17:00 to 18:00 the streetlamps stood over
day-blue glass `(89,154,178)*0.5`; from 06:00 to 08:00 the glass went
day-blue while the lamps still burned, where DFU shows amber
`(255,182,56)*0.8`. Three hours of every in-game day, in every town, on
the plain classic path.

The function now answers `isCityLightsOn(minuteOfDay) ? 'night' :
'day'` - the predicate the same module already exported one screen
above, for the lanterns. No call site changed: the two exterior hosts
were already the only consumers. The old pin was non-discriminating
(22:00 and 12:00 answer the same under either law); `test/clock.test.js`
and `test/audit64_time_weather.test.js` now pin the four hours where
the two properties disagree (17:00 and 07:59 night, 16:59 and 08:00
day) and sweep the whole day asserting `windowStyleForTime(m) ===
'night'` exactly when `isCityLightsOn(m)` - the two halves of one flag,
pinned together rather than as four restated constants.

### AUDIT 64 F9 (2026-09-08) - the fog window style was wired to a weather DFU never wires it to

`windowStyleForWeather(weather)` returned `'fog'` for `WeatherType.Fog`
and both exterior hosts let that answer WIN over the clock's
(`windowStyleForWeather(weather) ?? windowStyleForTime(minute)`), so a
foggy town painted flat grey `(117,117,117)*0.5` where DFU paints the
day blue or the night amber. Fog is ordinary classic weather - the
swamp rolls it a quarter of all winter days - and the call sat behind
no `isEnhanced()` and no pref.

`WindowStyle.Fog` is DECLARED (`DaggerfallUnityEnums.cs:87-94`) and
SPENT (`MaterialReader.cs:927-929`, over `FogWindowColor` at `:113` and
`FogWindowIntensity` at `:117`) but never ASSIGNED. The whole tree's
writers are `DaggerfallLocation.cs:44/:143/:145` (Day default, then
`IsCityLightsOn ? Night : Day`), `DayNight.cs:120` (the same choice),
`DaggerfallInterior.cs:473/:517/:1270` (`Disabled`) and
`DaggerfallBankPurchasePopUp.cs:267` (`Day`). `Game/WeatherManager.cs`
does not contain the word "window": `SetWeather` sets fog settings, the
sky `WeatherStyle` and the IsRaining/IsStorming/IsSnowing/IsOvercast
flags, and stops. The departure had no Ledger A row - only a source
comment and a line on this page - so it was a classic-path behaviour
change asserted in prose, which is exactly what the Ledger's own header
forbids.

`windowStyleForWeather` is gone, with its imports at both hosts, and
each host's line is now
`setWindowEmission(windowEmissionRGB(params.has('window') ?
params.get('window') : windowStyleForTime(minute)))` - the `?window=`
dev override (DFU's inspector equivalent) and then the clock, with
nothing between. The `WINDOW_STYLES.fog` ROW STAYS: it is verbatim
`MaterialReader` data and still reachable through `?window=fog`,
exactly the standing of the `custom` row, which DFU also assigns
nowhere. It is the wiring that had no counterpart, not the table. The
old pin restated the departure (`windowStyleForWeather('fog') ===
'fog'`); the new pin is over the two hosts' call text and over
`weather.js` exporting no window-style rule at all.

## PERF2 - THE SKY AFTER THE GROUND, THE GRASS BY THE CELL (2026-09-11)

Mac: "I really just want you to find ways we can improve performance
without downgrading across the board." Two changes that draw the same
picture for fewer cycles, both read out of the frame rather than
measured - there is no GPU and no ARENA2 in the session - so the
counter's numbers on a real machine are what confirm them.

**The sky was the frame's first draw, and most of it was painted over.**
`beginFrame` cleared, the dome's full-screen triangle shaded every
pixel (stars, two moons, the decks, the retro step) and the clouds'
composite shaded every pixel again, and then the terrain, the models
and the far ring covered the lower half or more of them. Now the three
sky passes (`enhancedSky.js`, `skyRenderer.js`, `dynamicSkiesRenderer.js`)
and the clouds' composite (`volumetricClouds.js draw`) put their quad AT
the far plane - `gl_Position.z = w`, depth exactly 1.0 - and draw with
the depth test on, LEQUAL, mask off: a fragment lands only where the
buffer still holds the cleared 1.0, which is exactly where nothing
nearer drew. The hosts draw the block after the terrain, the models
and the body, before the water, so every blended pass after it (the
water, the flats, the rain, the grass) composes over the sky as it
did. `0.9999` would not have done: at near 0.2 and far 6000 that depth
is 1,500 m out, and the streamed terrain runs past it. The far ring
kept its law - "the streamed world repaints everything nearer" - by
DEPTH instead of by ORDER: `gl_FragDepth = 1.0` under the same test,
so it loses to any streamed pixel and paints over the sky. The three
`markForeignPass` seams moved with the block; glstate's count holds.

**The grass field went to the GPU whole, every frame.** One instanced
draw of every slot - the 420 m window's ~180 cells, the cells behind
the eye, and the window's corners, which at 1.4 x `uRange` the vertex
shader fades to nothing and then blends as nothing. `LabGrassRenderer`
now records each slot's box when a cell is written (x/z off the roots,
y from the lowest root to the tallest tip) and `draw` walks the slots:
a cell whose nearest point is past the range, or whose box is outside
the frustum (`render/frustum.js`, the EV3 helpers), is not submitted;
the rest are drawn one instanced call each with the four instance
pointers moved to the slot's byte run - WebGL2 has no base instance,
so the pointers are the offset; four calls, no upload. Facing forward
on an open meadow that is roughly a third of the blades the frame used
to carry; the culled ones drew no surviving fragment. The lab's whole
scatter (`set`) still draws whole. `window.__grassStats().drawn` says
what was submitted.

**Pinned** in `test/perf2.test.js` (3): the culling executes against a
stub GL that records the draws; the sky law and the hosts' order are
text. Not a departure: the same fragments reach the buffer.

## PERF3 - ONCE A FRAME, NOT ONCE A PIXEL; ONCE A TEXTURE, NOT ONCE A BATCH (2026-09-11)

Mac: "just do your job and look for opportunities." Three more that
change no pixel, read out of the renderer.

**The terrain program re-uploaded the frame's lighting for every
pixel.** `drawTerrain` set seventeen uniforms a draw - projection,
view, the fog block, the key light, the ambient, the sun, the moon,
the point lights, the indirect light, the two sampler slots - and a
streamed frame draws it forty-odd times. The mesh program never did:
`beginFrame` uploads its block once and the setters merely shadow
(`uploadLighting` is the one exception, for the automap's beacons).
The terrain block now sits behind a frame stamp that `beginFrame`,
`restoreState` and `setLightDir` bump: the first terrain draw after
any of them uploads, the rest skip. The model matrix and the tile
size stay per draw; the cloud deck keeps its own stamp.

**The cutout billboards bound their textures once a batch.** A batch
is one (archive, record) on one pixel, so the same tree record across
forty pixels bound its diffuse and emission textures forty times, and
minted its key string forty times. The cutout pass writes depth and
discards alpha with no blend, so its order is free: the batches are
sorted by key and a batch whose key the batch before wore binds
nothing. The key is cached on the batch per frame value (FA1 animates
`b.frame`). The blended pass (the spectral and the concealed) keeps
its back-to-front sort and only skips the repeats it happens to have.
`stats.texBinds` now counts the binds that happen.

**The counter shows the renderer's own numbers.** `stats.draws` and
`stats.texBinds` are per frame (`beginFrame` zeroes them); the counter
sums the sample it sees each tick and prints the per-frame mean under
the script line - the GL call count, which is the CPU side of the
GPU's work and the number the culls and the sort are meant to move.

**Pinned** in `test/perf3.test.js` (2). Not a departure.

**MAC4 (2026-09-11, Mac: "enemy animations are completely broken").**
The key cache above re-minted on a change of `frame` only - the field
FA1's animated flats tick. The mobiles never touch `frame`: a foe, a
guard or a townsperson animates by writing the RECORD, `record#frame`
(uploadRecordFrame's own key, the orientation record and the frame
folded into one), in `exteriorFoes.js`, `dungeonContext.js`,
`cityGuards.js` and the two hosts' people. Their key was minted once,
on the first draw, and every one of them stood on that first texture
for the rest of the session - no walk, no swing, no turn - from the
morning PERF3 landed until Mac met one. The key follows every field
it is made of now (record, frame, archive - a transformed seducer
swaps archives). `test/mac4_billboardkey.test.js` (2) drives the pass
over a stub context and reads the binds: a record change binds the
new texture, a frame change binds the new texture, a repeat binds
nothing; and the five producers are pinned to the shape that broke it.
The lesson is PERF3's own missed test: a cache keyed on one field
needs a pin on every producer that animates by another.

## PERF4 - ONE MESH PER PIXEL: THE STATIC MODELS BATCHED (2026-09-11)

The city frame's cost is its draw calls. A streamed pixel drew every
RMB model with its own `drawMesh` - one call per sub-mesh, a block's
fifty to a hundred models each in three to six pieces, a city pixel
of up to sixty-four blocks - and a WebGL draw call is tens of
microseconds of validation whatever it draws; two thousand of them
is the frame. EV6 had already sorted the models by id so the VAO
cache hit; the calls remained.

The models never move. A block's 3D objects are placed once, so
`render/staticBatch.js` merges them ONCE at build time: each model's
vertices transformed by its pixel-local matrix as it arrives (the
transform rides the build's own awaits, so a city pixel costs no
single hitch), normals rotated by the matrix's orthonormal upper
3x3, and at the end the index ranges regrouped by RESOLVED texture -
`keyResolver(texRemap)` is drawMesh's own resolution, so a climate-
swapped texture groups under the swapped archive and drawMesh, handed
the merge with no remap, finds the `#opaque` upload the remap made.
`renderer.createMesh` uploads the merge; the pixel draws it with the
pixel matrix as the model matrix, one call per texture, and the
per-model loop skips what the merge holds. Same triangles, same
textures; the fragment shader lights by world position and normal,
both of which the merge carries. Out of the batch: the city gates
(their entry's mesh swaps open/closed) and the mills (their rotor
turns), drawn as before. Per-model frustum culling is traded for the
pixel's: a visible pixel submits all its static vertices, which the
GPU clips for far less than the calls cost. `destroyPixel` frees the
mesh with the pixel; a season re-skin rebuilds it.

**Pinned** in `test/perf4.test.js` (3). Not a departure. Not measured
here (no data, no GPU): the counter's draws line in a city is the
number to read, before and after.

## PERF5 - THE LEVEL AS ONE MESH: THE DUNGEON'S STATIC MODELS BATCHED (2026-09-11)

PERF4's batch, for the dungeon. A level drew its `drawList` - every
placed block model, three hundred to eight hundred of them, each in
three to five sub-meshes - one call apiece, and no frustum test in
front of any of them, so a dungeon frame was a thousand to three
thousand draw calls whatever the eye saw. The block models never
move; the ones that do (the platforms, the special doors - `move` and
`specialDoor` placements) are `dynamicDraws` and `continue` past the
list. `dungeonContext` adds each static placement to a
`StaticBatchBuilder` beside its draw entry, after `ensureRemap` has
put the model's swaps in the level's map, and `staticBatch` merges
and uploads once on the first frame that reads it. Both hosts draw
the merge with the identity (the placement matrices are world space
already) before the per-model loop, which skips the batched entries;
the dynamic objects follow as before. `drawList` stays whole: the
automap reveals per model and walks it as it did. `destroy()` frees
the mesh with the level.

**Pinned** in `test/perf5.test.js` (2); the builder's arithmetic is
PERF4's. Not a departure. The interior contexts (a building's rooms,
a few dozen models) are left as they are.

## PERF6 - THE ROOM AS ONE MESH: THE INTERIOR'S STATIC MODELS BATCHED (2026-09-11)

PERF5's batch for the building interior. A room's placements are all
still except the doors (`dynamicDraws`) and the mill's machinery (its
own `rotors`); `interiorContext` remaps every model up front, before
the list is built, so the merge's keys resolve exactly as drawMesh's
do. Each placement goes to the builder beside its draw entry, the
merge uploads once on the first frame that reads `staticBatch`, the
host draws it with the identity before the per-model loop and skips
the batched entries, the doors and the machinery draw as before, and
`drawList` stays whole for the automap. `destroy()` frees it. A tavern
of a hundred models is a dozen calls.

**Pinned** in `test/perf6.test.js` (1). Not a departure.

## PERF7 - THE STREAM BUILD BREATHES (2026-09-11)

The hitch on the road into a town. A streamed pixel is built by an
async function that awaits per model, and an await on a promise that
is already settled continues as a microtask - it never gives the frame
back. On a cold load the fetches are real and the build spreads
itself; on a warm one (every model cached, which is every pixel after
the first few) a city pixel's whole loop - three thousand models, each
a collider insert of hundreds of triangles - ran in one task, and the
frame loop waited hundreds of milliseconds for it.

`systems/buildBreather.js` is a cooperative yield: `buildPixelNow`
resets its slice and awaits `breathe()` after every placed model; while
the slice has budget (`BUILD_SLICE_MS`, 6 ms) the breath resolves at
once, and when it is spent the build awaits the next animation frame -
the frame loop runs and draws, the build resumes after. The pixel
arrives a few frames later than it would have and every frame between
is drawn. Nothing about the pixel changes: a partially built pixel is
not in `built` and draws nothing, exactly as a cold-load pixel never
did. The dungeon and interior builds run behind a mode change and are
left as they are.

**Pinned** in `test/perf7.test.js` (2). Not a departure.

## PERF8 - THE PIECE UNDER A BLADE, BY ARITHMETIC (2026-09-11)

The grass placer asks `keep(x, z)` and `ground(x, z)` once per blade -
six thousand a cell, two cells a frame while the eye walks - and each
found the streamed pixel under the point by scanning every near pixel
for the square that holds it: fifty pixels, three hundred thousand
bounds tests a cell, every frame the field was filling. The pixels are
a grid: `pixelTranslation` is `(px - origin) * TERRAIN_SIZE` plus one
compensation shared by every pixel, so the pixel under a point is one
floor from any reference piece, and `labGrass.pieceIndex` answers it
at one Map read. Same answer as the scan - the squares do not overlap
and a point outside every piece is null either way - proven against
four thousand random points in the test. The two closures keep their
bodies and lose their loops.

**Pinned** in `test/perf8.test.js` (2). Not a departure.

## PERF9 - THE PERFORMANCE PROBE (2026-09-11)

PERF1 to PERF8 were read out of the frame with no GPU and no ARENA2 in
the room: each was argued from the code and pinned against its mutant,
none was measured. The probe closes that. `npm run perf` (with
ARENA2_PATH set) boots the real game under Vite and Playwright on the
?shot door with the FPS counter armed, for three scenes - Daggerfall
city, a random road spawn, and Privateer's Hold - waits until the
stream says the scene has settled, discards the settling second, and
then reads the counter's OWN numbers once a second: frames a second,
frame ms and worst, script ms and worst, draws and texture binds a
frame. The counter exposes them at `window.__fpsStats()` whether or
not its overlay shows; the overlay is still written only while it
does (FPS1's law). `HEADED=1` runs on the machine's GPU, which is the
number that matters; headless runs on SwiftShader, whose numbers are
only relative to each other. `OUT=perf.json` appends the rows so a
before and an after sit in one file.

A scene that never reports a second, throws on the page, or shows no
fps fails the run: a probe that prints a dash and exits 0 is the
disease probehygiene's T3 names.

**Pinned** in `test/perf9.test.js` (2). Not a departure.

## PERF-TEX - THE UNIT THAT WAS ALREADY BOUND (2026-09-19)

Mac: *"Receiving reports of heavy performance issues across the game... I
want players to get maximum performance with maximum quality. No
exceptions."* So: no setting, no tier, no preset. Deleted work, or
nothing.

**MEASURED, not read out of the frame.** PERF1-8 were argued from the
code because this session has no GPU; PERF-ON showed the way round that
for the part that is CPU - drive the REAL `Renderer` over a logging GL
stub and count what it actually calls. Over the batched static mesh path
(what PERF4/5/6 built, and the bulk of any scene's draws), 60 meshes of
four sub-meshes each:

| | GL calls | a draw | bindTexture | of which redundant |
|---|---|---|---|---|
| before | 1385 | 5.8 | 480 | **239 (50%)** |
| after | 1034 | 4.3 | 363 | 0 |

Half of every texture bind in the path set a unit to the texture it
already held. The cause is that `_evEmis` is `_blackTex` for everything
that is not a window or an auto-emissive record - which is nearly every
sub-mesh in a street or a dungeon - and the loop bound it, and switched
the active unit to reach it, unconditionally, for all of them.

**`drawBillboards` had already solved this.** It has skipped the whole
texture setup on `lastKey` since it was written, and the line directly
above the mesh loop's bind caches the emission COLOUR the same way
(`_emissionColorUp`, F49, cleared in `beginFrame`). The mesh loop simply
never got the treatment its neighbour and its own sibling already had.

So `_bindEmission(tex)` is EV6's `_use(program)` for a texture unit: bind
unless the shadow says it already is, and leave unit 0 active, which
every draw path expects on entry and on exit. The shadow is cleared
wherever something else can own unit 1 - `beginFrame`, `endWorldPass`,
a texture upload, a context rebuild, and `drawBillboards`, which owns the
unit while it runs and is left exactly as it was.

**IT MOVES NO PIXEL, AND THAT IS PROVEN RATHER THAN ASSERTED.** Binding a
texture that is already bound is a no-op by definition, but the argument
that matters is the one the suite makes: the GL log is replayed through a
state machine and what the GPU would SEE at every draw - the program, the
VAO, the texture on each unit, the draw's own arguments - is compared
against the same scene with the shadow defeated. 80 draws, identical, in
a scene whose emission maps deliberately change every few sub-meshes
where a real one barely changes at all. A faster path that moves a pixel
is a bug, not a faster path (PERF-ON's law).

**What this is worth.** GL call count is CPU-side driver cost, so it
converts to frames when a scene is draw-call bound - a streamed exterior
at the default land view of 5 (121 pixels) usually is - and not when it
is fill-bound. It is a floor raise, not a ceiling raise, and it is free.

**Pinned** in `test/glstate.test.js` (4, EV6's own home): no bind in the
path is redundant, the saving is real against the unshadowed 4-a-draw,
the effective GPU state is unchanged draw for draw, and every site in
`renderer.js` that binds unit 1 either goes through the helper or clears
the shadow - a source sweep, because a shadow that speaks for a unit it
no longer owns is a wrong texture on screen.

## PERF-TEX2 - THE ATLAS AND THE TILE SIZE, ONCE A WORLD (2026-09-19)

The same sweep over `drawTerrain`, which runs once per streamed pixel -
121 of them at the default land view of 5. 121 pixels, each with a model
matrix and a tilemap of its own as the streamer gives them, sharing the
world's one tile atlas:

| | GL calls | a pixel | redundant state writes |
|---|---|---|---|
| before | 1239 | 10.2 | **361 (29%)** |
| after | 879 | 7.3 | 0 |

Two values were being set 121 times to say one thing. The TILEMAP is the
pixel's own and always binds. The tile ARRAY is the world's single atlas -
the same object for every pixel of the frame. And the TILE SIZE is the
world's one number: PERF3 left it outside its frame-constant block as one
of "the per-pixel two", and it is passed per pixel, but it is 128 every
time.

Both are SHADOWED, not hoisted, and the distinction is the whole safety
argument. Hoisting either into PERF3's once-a-frame block would be wrong -
that block runs once, and a pixel's own model matrix belongs beside them -
so the guard stays where the upload was and only skips when the value is
already there. A world that really does change its atlas or its tile size
still uploads, which the suite proves by driving two.

**The third redundancy was left alone.** `drawTerrain` ends with
`_bindVao(null)`, which unbinds after every pixel - 121 extra binds a
frame. It is not a mistake: a dozen sites in `renderer.js` do the same,
and the foreign passes (the skies, precipitation) run against a context
they expect to find clean. 121 calls is not worth breaking a convention
the whole file keeps, and a subtle state bug is exactly the cost this
campaign is not allowed to pay.

**AND A GAP IN PERF-TEX, FOUND BY LOOKING FOR THIS ONE.** EV6's
`markForeignPass` forgets the program and VAO shadows when a pass outside
the renderer takes the context - and PERF-TEX's texture shadow had not
joined them. A sky that binds its own texture to unit 1 would have left
the shadow speaking for a unit it no longer owned: a wrong texture on
screen, from a change whose entire claim is that it cannot move a pixel.
All three shadows are cleared there now, and pinned to be.

**Pinned** in `test/glstate.test.js` (3): no redundant bind or upload in
the pixel loop, a world that changes either still uploads, and every
texture shadow is forgotten on a foreign pass. PERF3's own pin was
re-aimed: its law is that the two stay OUT of the frame-constant block,
which they do, and it now says that rather than quoting two lines.

## PERF-UI - THE SCREEN QUAD'S FOUR THAT ARE NOT A QUAD'S OWN (2026-09-19)

`drawScreenQuad` is the UI arc's primitive (U1), and the HUD draws a
hundred-odd of them a frame in EVERY scene there is - a dungeon and a
building interior included, which is where "heavy performance issues
across the game" lands, because none of the exterior's passes run there.

| | GL calls | a quad | redundant state writes |
|---|---|---|---|
| before | 2056 | 17.1 | **1071 (52%)** |
| after | 1342 | 11.2 | 357 |

More than half of every call set state that was already set:

- **the canvas size** is the FRAME's, not a quad's - `drawingBufferWidth`
  and `Height` are read and uploaded on every one.
- **the sampler binding** is a CONSTANT for the life of the program:
  `uTex` is unit 0 and has never been anything else. It goes up with the
  program now, once, instead of once a quad.
- **useTex, blendTex, rotOn and the colour** are the same for every quad
  of a RUN - a row of icons, a bar, a panel's backdrop, a page of a book.

PERF-ON gave the TEXT case one draw a string. This is the same saving for
every quad that is not text, and it needed no new API and no new call
shape: the three flags and the colour are shadowed ON VALUE, so a caller
that really changes one still uploads.

**What was left, and why.** 240 cap toggles and 242 VAO binds remain -
each quad disables DEPTH_TEST and CULL_FACE, draws, then re-enables both,
and binds and unbinds the same VAO. Removing them means not restoring the
state a quad found, which is a CONTRACT change: the world paths after it
would have to own their own caps. That is a real optimisation and a real
risk, and it does not belong in a slice whose whole claim is that it
cannot move a pixel.

**Proven, not asserted.** The scene the suite drives deliberately changes
each shadowed field at least twice - runs of same-colour icons, a tinted
bar, a solid untextured panel, a blended logo, a rotated needle - because
the colour and flag shadows are the ones that could bite: skip an upload
the caller meant and the quad draws in the last one's colour. Every
uniform and every texture at all 55 draws is compared against the same
scene with nothing remembered between quads. Identical.

**Pinned** in `test/glstate.test.js` (2): the canvas, sampler and shared
flags stop repeating while `dst` and `src` - which really are a quad's
own - still go up every single time; and the equality above.

## PERF-TEX3 - THE UNIT THAT WAS ALREADY ACTIVE (2026-09-19)

With the 2D bracket gone, the same frame was measured again and asked the
question PERF-TEX asked of unit 1: how much of what is left sets state to
the value it already holds?

| | calls | redundant |
|---|---|---|
| `activeTexture` | 121 | **117 (97%)** |
| `bindTexture` | 202 | **111 (55%)** |

**97% is not an accident.** Every path in `renderer.js` that reaches for a
unit above 0 puts unit 0 back the moment it is done - `_bindEmission`, the
contact and adapt uploads, the reserved cloud-shadow slot, the terrain's
tilemap. So unit 0 is what is active almost always, and almost every
`activeTexture` call re-selected it. The other half is texture locality
nobody was exploiting: a mesh bundle whose sub-meshes repeat an archive,
and a HUD drawing ninety quads off one sheet.

Two shadows, both the `_bindEmission` idiom:

- **`_activeTexture(unit)`** - a pure selector, so it cannot change a
  picture on its own; what it can do is go stale, which is why the funnel
  law allows exactly ONE raw `gl.activeTexture` in the file, inside it.
  27 call sites routed.
- **`_bindTex0(tex)`** - `_bindEmission` for the unit every pass shares,
  cleared at every point `_tex1Bound` is cleared at.

**Where it was NOT applied, and why.** `drawBillboards` clears the unit-0
shadow instead of sharing it. That path already skips on its own
`lastKey`, and routing it through the shared shadow is exactly what broke
MAC4's record key and PERF3's sorted-cutout pin the first time PERF-TEX
was written - a lesson worth paying for once.

| the same dungeon frame | GL calls |
|---|---|
| before PERF-2D | 1,760 |
| after PERF-2D | 1,043 |
| **after PERF-TEX3** | **640** |

**64% off the frame across the two slices**, and the frame now has no
redundant texture traffic left in it at all: the same measurement run
again answers 1 redundant call out of 640.

**Proved, not asserted.** A scene covering every pass the shadows can
touch - 20 terrain pixels sharing a world atlas, mesh bundles with
emission moving under unit 0, billboards, a character sprite quad, a HUD
with realistic locality, an instanced run, an overlay and a foreign seam -
replayed against the previous commit in a worktree, recording what is on
EVERY texture unit at every draw along with the program, the VAO and the
draw's own arguments. **462 draws, all identical.**

**Four existing pins were re-aimed, and all four were source-TEXT pins**
broken by the rename (`gl.activeTexture(` to `this._activeTexture(`) -
AUDIT 65 RS-3, PERF-TEX's own unit-1 law, WATER1's two-unit assertion and
PERF3's billboard key. None of them was a behavioural failure, which the
equality proof above is what establishes rather than the re-aiming.

### PERF-TEX3 AUDIT - THE LAW THAT WAS SKIPPED (same day, before merge)

PERF-TEX wrote this law for unit 1:

> and no site binds TEXTURE_2D to unit 1 outside the helper without
> clearing it

It is why that slice never shipped a wrong texture. **Its unit-0 twin was
not written**, and the audit found what that cost: **13 raw binds to unit
0 answered to nothing.** The repro is three lines of ordinary world pass -

```js
r.drawMesh(bundle, m);        // binds MESH_TEX through the shadow
r.drawCharacter(char, m);     // owns unit 0 raw, hands it back EMPTY
r.drawMesh(bundle, m);        // shadow still says MESH_TEX -> skips
```

→ **the model after the character drew with nothing bound.** Untextured
geometry in the world pass, every frame a character is on screen, which
is every frame.

`drawWater` would have handed the next model the water's texture;
`uploadTexture` and `uploadTilemapTexture` the same, mid-stream.

**Why the equality proof missed it.** The proof scene ran terrain, then
meshes, then billboards, then UI - it never put a path that owns unit 0
raw BETWEEN two paths that share the shadow, which is the only place the
bug lives. A proof is only as wide as its scene, and "identical across
462 draws" was true and useless. The scene is the world host's real shape
now - ground, models, a character, more models, an upload, billboards,
more models, six pixels of it - and both slices are proved against the
commit before PERF-2D on it: **672 draws, identical in caps, VAO,
program, every texture unit and every draw argument.**

**Fixed and pinned twice.** Every raw unit-0 bind clears the shadow
beside it; the twin law walks `renderer.js` tracking the active unit and
requires every TEXTURE_2D bind landing on unit 0 outside `_bindTex0` to
answer the shadow within four lines; and the repro is kept as its own
behavioural pin. Both were mutation-tested against the real fix - removing
one clear fails the law, removing all three of `drawCharacter`'s fails
both.

**The lesson, which is the same one this file keeps learning.** A state
shadow is only ever as good as the list of places that invalidate it, and
that list is not a thing to be reasoned out once - it is a law to be read
out of the source by a test. PERF-TEX knew that. PERF-TEX3 shipped the
shadow and skipped the law, and only an audit stood between that and a
merge.


## PERF-2D - THE BRACKET THAT WAS PER QUAD (2026-09-19)

PERF-UI ended by naming what it had left on the table and why:

> **What was left, and why.** 240 cap toggles and 242 VAO binds remain [...]
> Removing them means not restoring the state a quad found, which is a
> CONTRACT change: the world paths after it would have to own their own
> caps. That is a real optimisation and a real risk.

It was measured this time, and the number is why it is no longer being
left. A dungeon frame - 3 batched level meshes, 25 loose models and a
hundred-odd HUD quads, which is what a player is looking at in the scenes
where "heavy performance issues across the game" was reported:

| | GL calls | share |
|---|---|---|
| world meshes | 232 | 13% |
| billboards | 34 | 2% |
| **the HUD (120 quads)** | **1,494** | **85%** |
| whole frame | 1,760 | |
| *of which the per-quad cap/VAO bracket* | *763* | ***43%*** |

**The UI is the frame.** Not the terrain, not the models - the 2D pass,
in every scene there is, and 43% of the whole frame's GL traffic was one
bracket opened and shut around every single quad.

| | GL calls a frame | a quad |
|---|---|---|
| before | 1,760 | 12.4 |
| after | 1,043 | 6.5 |

**41% off the frame; 48% off the UI pass.** The bracket itself: 763 calls
to 46.

**It is NOT the contract change PERF-UI refused.** That one would have
made the world paths own their caps. The renderer still owns them here -
what changed is only WHEN the restore happens. `_open2D(vao)` disables
the caps and binds; `_close2D()` hands the baseline back; and `_close2D`
is called at the head of everything that needs it. The quad no longer
carries the bracket, the RUN does.

**The law it replaces was installed after a mutation campaign, so the
replacement had to be at least as strong.** `perfon_text_run.test.js`
says it plainly: deleting `gl.enable(gl.CULL_FACE)` from drawScreenQuad
*passed the entire suite* - "leaving it off means every back face in the
world pass that follows draws, for the rest of the session." Three things
carry that weight now:

1. **The source law.** Every method in `renderer.js` that issues a
   `gl.draw*` is one of the three 2D primitives or calls `_close2D()`
   first, and so do the five seams where foreign GL runs. Read out of
   the source, so it cannot go vacuous.
2. **The equality proof.** A mixed scene - UI runs interleaved with
   meshes, a character sprite quad, an instanced run, an overlay and
   foreign seams, because the transition OUT of an open run is the only
   thing this can break - replayed twice, once with the run and once
   with `_close2D()` forced after every quad, which IS the old bracket.
   The full effective state at every draw (program, VAO, both texture
   units, the caps, the draw's own arguments) is identical. Proved the
   same way against the previous commit in a worktree: **366 draws, all
   identical.**
3. **The gap, made loud.** The sky, the rain, the wisps, the sand and the
   grass are NOT in this file - the hosts hold `renderer.gl` and call
   them directly, and they assume the baseline (precipitation's draw sets
   BLEND and depthMask and never touches DEPTH_TEST, so an open run would
   give it rain that draws through walls). Today they cannot collide:
   every foreign pass runs in the world section and the first screen quad
   is what ENDS it (ROAD-E E5). But that is the hosts' running order and
   not a law. So `markForeignPass` - which a host calls AFTER its foreign
   pass - checks whether the run is still open, and if it is, says so
   once, naming `endUiRun()` as the remedy. The two regressions this
   bracket has already caused were both silent; this one would not be.

**The trap, and it is worth writing down.** `drawScreenQuad` calls
`_compositeAir()` at the head of EVERY quad. Putting `_close2D()` at the
top of `_compositeAir` - where every other guard goes - shuts the run a
hundred times a frame and hands the entire saving back, while every test
still passes, because nothing about the picture changes. It belongs after
that function's early return, and there is a pin that says so.

**What is left now.** 777 calls for 120 quads: `dst` and `src` per quad
(262), the texture binds (204), the draws (120). The next real cut is
batching same-texture quads into `drawScreenQuadRun`, which already
exists and already does one draw for a whole string - but that is a
CALLER change across some thirty UI files, not a renderer change, and it
wants its own slice.

## PERF-WARM - THE COMPILE THAT HAPPENS MID-FRAME (2026-09-19)

PERF-TEX, PERF-TEX2 and PERF-UI took redundant GL calls out of the steady
frame. This slice is about a different cost and the one a player actually
notices: a **hitch**. Seven programs were compiled the first time
something needed them, and "the first time" is always inside a draw call,
which is always inside a frame.

| program | the frame that paid for it |
|---|---|
| `particleProgram` | the first spell effect that draws |
| `charQuadProgram` | the first classic character sprite |
| `screenQuadProgram` | the first 2D blit of the session |
| `screenQuadRunProgram` | the first instanced 2D run |
| `overlayProgram` | the first full-screen overlay |
| the lab's `pixelProgram` | the first frame of Dynamic Skies' snow |
| the rain's whole renderer | the weather change that turns rain on |

A compile-and-link is not a few hundred small calls that add up - it is
ONE call into the **driver's own compiler**, which can hold the calling
thread for tens of milliseconds, and nothing in this codebase can make it
cheaper. The only thing that can be done with it is to **move it**: off
the frame that needs the program and onto time the browser was going to
spend idle.

**The refactor is the whole change.** Each `if (!this.xProgram) { ... }`
block came out of its draw function into an `_ensureXProgram()` method
byte for byte, guard included - so the draw path is EXACTLY what it was
for anyone who never warms, and warming twice costs one property read.
`renderer.warmSteps()` names the five; `render/warmPrograms.js` walks
them one per `requestIdleCallback`, the shape `ui/enhancedChunk.js`
settled on for MENU1 and for the same reason (five compiles back to back
in one callback is the stall this exists to remove, moved somewhere less
visible).

**The rain is the expensive one.** `applyWeather` built the whole
`PrecipitationRenderer` - a program, a 1000-particle vertex volume and its
index buffer - inside a game frame, the moment the weather turned. Both
exterior hosts add that construction to the idle walk. The draw gate is
the MODE and never the object (the draw site's own law, W1 review: "the
renderer outlives a clear-up"), so a renderer that exists before any rain
does draws nothing. The pixel-snow program joins `_buildLab` in the
constructor on the **enhanced lane only** - `drawPixelSnow` is reachable
only through `drawLab`, so AUDIT 58's rule that the classic lane compiles
nothing it cannot bind still holds, and `drawPixelSnow` keeps its own
on-demand build for the renderer handed the enhanced deck without the
lane's flag.

**WHAT THIS DOES NOT CLAIM.** Unlike the three slices above, the SIZE of
this win is not measured here and cannot be: `test/glstate.test.js` drives
a Proxy stub, and a stub does not compile shaders. The claim is
STRUCTURAL - the program is built before the first draw needs it rather
than during it - and the number belongs to whatever driver the player is
running. Saying otherwise would be inventing a figure, which is the one
thing the three measured slices above were careful not to do.

**Pinned** in `test/glstate.test.js` (6): `warmSteps` names exactly five
and warming builds every one; the steps are idempotent; an unwarmed
renderer still builds on the draw and a warmed one does not build again;
a step that throws does not take the rest of the warm with it; a warm
stops when its host is gone; and the pixel-snow program is the
constructor's on the lane that can draw it and nobody's on the lane that
cannot.

### PERF-WARM AUDIT (same day) - what held, and four things the section above got ahead of

**The refactor is proved, not asserted.** Each of the five blocks was
replayed out of the commit before and the commit after and compared line
for line: **all five byte-identical**, call sites in place and in order.
And the warm is proved harmless the way PERF-TEX/UI were - a logging GL
stub, a scene that exercises all five programs, once on a renderer nobody
warmed and once on one warmed BETWEEN FRAMES, where a real
`requestIdleCallback` lands. The steady-state frame is **call for call
identical**. It cannot be otherwise, and for a reason worth writing down:
`beginFrame` already forgets every shadow it owns ("whatever ran between
frames is not trusted"), `frame()` is synchronous with no `await` so an
idle callback can never land mid-frame, and every draw path - the video
player's own loop included - opens with `beginFrame`. Every ARRAY_BUFFER
upload in `src/` rebinds first (all 33 checked), so the dirty binding a
build leaves behind is nobody's input.

**1. Two of the five are probably already built before the warm fires.**
`requestAnimationFrame` outranks `requestIdleCallback`, and the world's
first frame draws the HUD. So `screenQuadProgram` and
`screenQuadRunProgram` are almost certainly compiled by frame 1, during
the boot, before the first idle callback runs. The table above reads as
if all seven moved; what actually moves is `particleProgram` (first
spell), `charQuadProgram` (first classic sprite), `overlayProgram` and
the rain's renderer. The other two were never the hitch a player feels -
they land in the loading screen either way.

**2. The warm compiles programs a session may never bind - the AUDIT 58
objection, not applied to the renderer's five.** Measured: 11 links
warmed against 10 unwarmed, for a scene that never draws a particle
effect. `charQuadProgram` is the CLASSIC sprite path, so an
enhanced-visuals player now compiles one they will never use; so is
`particleProgram` for a player who never casts. The section above cites
AUDIT 58 as the reason not to warm the lab's programs and then does not
hold itself to it. The trade is defensible - idle time is free and five
small programs is negligible VRAM - but it is a trade, and it was made
silently.

**3. A player who never sees rain now pays for the rain.** Precipitation's
constructor runs at boot instead of at the weather change: **~102 KB** of
GPU buffers on the classic lane (1,000 particles x 4 verts x 5 floats =
78 KB, plus 6,000 indices = 23 KB) and **~508 KB** on the enhanced one,
which adds `_buildLab`'s 26,000 instances x 4 floats = 406 KB. Before, that was paid only if the weather turned. It is the
right trade for a game where it rains, but it is a new steady cost and
the section above only counted the saving.

**4. `stats.programBinds` is incremented outside a frame.**
`_ensureScreenQuadProgram` ends in `this._use(...)`, which counts - so
one warm adds 1 to the frame counters after that frame reported and
before `beginFrame` zeroes them. Cosmetic, and `?perf` is the readout
PERF-TEX and PERF-UI were measured with, so it is worth knowing it can
be off by one for exactly one frame.

**Not a finding, checked anyway.** No leak: the hosts are one per PAGE
LOAD (a scene change is a navigation, and dungeons and interiors are mode
swaps inside `bootWorld`), so the warm's closure cannot outlive its
context and `alive` has nothing to guard. Normal play always routes
through `bootWorld` (`main.js`), so players are warmed; the standalone
`?dungeon`/`?interior`/`?shot` hosts are not, which is a dev and probe
path and arguably right - a probe wants no idle work.

**Fixed by the audit.** The pin for "an unwarmed renderer still builds on
the draw" was calling `drawScreenQuad(null, 0, 0, 10, 10)` against a
signature of `(tex, dst, src, color, opts)` - `src.u0`, `color[0]` and
`opts.blend` were all `undefined` and it passed only because the stub
swallows anything. It draws a real quad now.

## PERF-ON - ONE DRAW A STRING (2026-09-15)

Mac: *"Next thing I want to tackle is improving online performance. I
notice the more people that are online, the worse fps becomes."*

**Measured before anything was changed.** Every per-peer cost in `net/`
turned out to be bounded already: `peerBodies` caps the Morrowind rigs
at `BODIES_MAX` 8 and culls past `BODY_RANGE` 120, and a peer's doll is
one billboard batch created once, with only its `origin` written
afterwards. One cost had no cap at all - the NAME over each peer's
head. `drawText` issued one `drawScreenQuad` a glyph, and a
`drawScreenQuad` is a whole GL state setup: program, VAO, eight
uniforms, a texture bind, a draw. Driven against a real `Renderer` over
a logging GL stub, a nine-letter name is **153 GL calls, every frame,
every peer**, and nothing else in the online frame scales that way.

So the names were the slope, and the fix is the shape of the data. The
glyphs of one string share a texture and a colour, and cannot overlap
each other: they are a RUN. `renderer.drawScreenQuadRun(tex, quads,
color)` takes the whole string as instanced data - eight floats a quad,
dst x/y/w/h then src u0/v0/u1/v1, stride 32, both attributes at divisor
1 - and draws it with one `drawElementsInstanced`. The same name is now
**14 GL calls and one draw**, about eleven times fewer, at every peer
count.

Nothing about the frame moves around it. The run is issued at exactly
the point in `drawText` the per-glyph calls were, so draw ORDER is
unchanged. It is the NARROW case on purpose: no rotate arm, no blend
opt-in, no solid-fill arm - those stay `drawScreenQuad`'s and no art
path changes. It keeps the two brackets its sibling keeps, ROAD-E E5's
`endWorldPass` and the CULL_FACE handedness bracket, and it spends the
letterbox `_screenOffset` on its geometry as every other 2D primitive
does. And the per-glyph path stays: the run is a FEATURE-DETECTED,
optional renderer member, because the suite's stub renderers and the
glyph-recording font harness that reconstructs painted strings carry
`drawScreenQuad` alone and must read exactly what they always did.

**The campaign's own lesson, because two mutants survived on it.** The
headline pin compares the batched path against the per-glyph path quad
for quad - the right pin for a renderer change nobody here can SEE (no
GPU in the container, no ARENA2). But drifting `h: fnt.fixedHeight *
scale` by a pixel moved BOTH paths, because the mutation lands in the
`dst` they share, and they stayed equal. *An equality pin proves the
two paths agree; it cannot prove either is right.* The second survivor
was the F-SING lesson again: the pin on the letterbox offset matched
the source line that DECLARES `ox`, not the arithmetic that spends it -
*a source-text pin cannot tell a wired seam from a spelled one.* Both
are closed the only way they could be: the geometry is pinned
ABSOLUTELY (exact pixels, exact UVs, for a known string), and the
packing is pinned by RUNNING it - a real `Renderer` over the
glstate/audit26 Proxy-GL harness, with the instance floats read back
out of `bufferSubData` and the VAO's stride, offsets and divisors read
off the real calls.

**A side finding, closed with them.** Deleting `gl.enable(gl.CULL_FACE)`
from `drawScreenQuad` - the run's older sibling, five lines up the same
file - passed the ENTIRE suite. Nothing pinned that a 2D primitive
leaves GL as it found it, and a screen quad that leaves culling off
makes every back face in the world pass that follows draw, for the rest
of the session. It is a law now, and a generative one: replay both
functions' real enables and disables and require the net to be zero,
non-vacuously, so the blend arm's own toggle and any capability either
function learns to touch later are covered without being named.
`audit39` F50's draw-site sweep was made generative for the same reason
- it enumerated `Elements|Arrays|ArraysInstanced` and could not see
`drawElementsInstanced` at all.

**NOT SEEN ON A GPU.** There is no GL and no ARENA2 in this container,
so the geometry is argued from absolute expectations and from the
bytes that would reach the driver. Mac's eye is the next gate.

**Pinned** in `test/perfon_text_run.test.js` (7). Campaign: 13 mutants,
13 killed, plus the fourteenth against the sibling. Not a departure.

## PERF11 - one owner list a frame (2026-09-19)

Mac: *"Online mode needs further performance improvements"*.

PERF-ON capped the per-peer DRAW. This is a per-peer cost on the CPU
side of the same frame, and it is the plainest kind: the same answer
computed twice. `scenes/world.js`'s online frame runs two owner sweeps -
`exteriorFoes.pruneOwners` for the peers' foe puppets and
`camps.sweepOwners` for their camps - and each one opened with

```js
const near = peersNear(); if (near) ...(new Set(near.map((p) => p.id)), ...)
```

`peersNear()` walks every peer in the room, asks `peerBodies.heightOf`
for each and mints an object plus a scene-space triple apiece; the `.map`
mints an array and the `Set` a set. All of it, twice, every frame, for
one list that cannot differ between the two calls. A lazy per-frame memo
(`ownerIds()`) builds it at most once and hands the SAME Set to both, so
a room that is not a cell room still builds nothing at all. Both call
sites keep their own `isCellRoom(online.room)` gate, so the frame's
shape is unchanged.

**What this is not.** It is a constant factor on a list that is already
O(peers), not a change of slope; the slope in online mode is the peer
bodies and sprites, and both are capped and range-culled already. The
honest next step for "online is heavy" is a profile with a real room
behind it, not more guessing - there is no ARENA2 and no relay in this
container, so nothing here was measured the way PERF-ON's names were.
Said rather than implied.

**Pinned** in `test/grasspath.test.js`.
## BOOT2 - A CURSOR MUST NOT NEED THE HUD: ONE EDGE, 4.1 MB (2026-09-20)

**Where BOOT1 left the entry.** With the four hosts behind doors, the
entry's static graph was still 259 files and 4.9 MB of source, and the
bundle's boot set 28 chunks / 492 KB gzipped - `travel` (257 KB) and
`spellcast` (55 KB) the largest of them. The menu's own direct imports were
not the cause (no single one costs more than 88 KB exclusively); the cause
was a hub edge further down. Cutting edges one at a time on the entry's
graph and measuring each: **`ui/cursor.js -> ui/hud.js` carries 216 files
and 4,141 KB on its own** - `main.js` imports the cursor to install the
document pointer, the cursor imports ONE pure function from the HUD
(`bitmapToColor32`, an indexed bitmap through a palette), and the HUD
imports the enhanced HUD, which imports the world tick, which imports the
game. Cutting `worldTick -> weatherSim`/`diseases` instead saves nothing:
the same modules arrive through `court.js -> factionRep.js -> save.js`. The
edge that matters is the first one.

**The helper was in the wrong home.** A conversion from a palette is a
formats concern; the HUD was only where it happened to be written, and
eleven modules imported it from there. It lives in
`formats/color32Order.js` now - the file that already owns how a picture
becomes color32 (the row-order doors of AUDIT 62 F26 and HT3) - and every
importer takes it from the leaf, `hud.js` included. No re-export: a
re-export would put the hub edge back for whoever took the shortcut, and
`test/boot2.test.js` holds that as a law rather than a hope.

**Measured.** The entry's static reach: 259 files / 4,991 KB -> 43 files /
841 KB. What remains is the renderer, the settings, the data source and the
crash/stale-chunk law - the things an entry genuinely needs before it knows
which door it is going through. The bundle's boot set: 28 chunks / 492 KB ->
**12 chunks / 104 KB gzipped**.

**What did NOT move, said plainly.** The bytes a player waits for before the
MENU is interactive - the entry's set plus the menu chunk's own static
closure plus the intro - are ~656 KB gzipped, the same as before this slice.
The menu chunk reaches the world tick directly AND through
`ui/enhancedHud.js`, and reaches `travel` through `systems/saveSlots.js ->
save.js -> weatherSim.js`; with several roots, no single cut helps, which is
exactly what the exclusive-cost table said at the start. That is the next
lever and a different shape of work: the clock (`worldMinutes`,
`sharedClockOn`) split out of the world tick as a LEAF, so the nineteen
modules that only want the time stop importing the heartbeat.

**Three laws, derived, not listed.** One home (exactly one definition in the
tree, in the leaf; nobody under src/ or test/ imports it from hud.js; hud.js
exports it to nobody). The cursor is a leaf (its imports are read; none is
under ui/). The entry's reach touches neither hub and stays under a ceiling
the cut measured. 3 mutants, 3 killed.

## BOOT1 - THE GAME HOSTS BEHIND A DOOR: THE BOOT GRAPH UN-INVERTED (2026-09-20)

**INLINE1's "next lever" turned out to be the wrong lever.** The plan was to
make `weaponRig` lazy (96 KB gzipped on the boot path). Walking the entry's
static import graph first showed why that was small change: `src/main.js`
imported all four scene hosts - `bootExterior`, `bootInterior`,
`bootDungeon`, `bootWorld` - STATICALLY, and a static import of a host is the
host's whole graph at module-evaluation time. **623 files and 13.4 MB of
source were reached from the entry before `boot()` ran a line** - every
scene, every system, every window - while the menu a player actually sees
first (`ui/enhancedMenu.js`, `ui/introScreen.js`) was the thing loaded
dynamically. The boot graph was inverted. Over the built bundle: 54 chunks,
1,349 KB gzipped, had to arrive before the entry finished evaluating, and
`main` alone was 517 KB of it.

**The change is four lines, and every route reads as before.** Each host is
a door now - a dynamic import at the moment of use, bound to the SAME name
and called with the SAME shape the routes always used, so the routes and
the pins that hold them (classicstart, hard2s, macn) are untouched. The
hosts carry no import-time side effects (nothing at their top level runs),
so evaluating them later changes nothing but WHEN.

**And a warm-up.** Every door out of the enhanced menu ends in `bootWorld`,
so the world host's import is kicked off - not awaited - the moment the
menu branch is entered, behind the cinematic and the menu where the player
is looking at something else; Play then finds the chunks in cache instead
of paying for them at the click. It carries a `.catch`, and that is not
optional: a deploy between page load and Play renames every chunk
(`systems/staleChunk.js`), and a warm-up that rejected unhandled would be a
console error for a failure the real import at Play reports properly
through the same law.

**Measured over the build.** The chunks a browser must fetch before the
entry finishes evaluating: **54 -> 28; 1,349 KB -> 492 KB gzipped (-64%)**.
Total JavaScript is unchanged (1,959 KB) - nothing was removed, it moved
off the critical path. `test/boot1.test.js` walks the entry's static graph
itself, transitively, with the host set derived from the tree, and holds a
ceiling on the entry's reach so the graph cannot quietly re-invert. 3
mutants, 3 killed.

**And one thing the change found.** `test/moduleload_smoke.test.js` imports
every module under src/ in node and keeps a list of the eleven that cannot
load, each with its reason. `src/main.js` was on it as "import.meta.glob" -
and that was only ever true by inheritance: its static import of world.js
rejected the entry at LINK time, before a line of its body ran. With the
hosts behind doors the entry's body runs in node, `boot()` reached for
`document`, and its own catch reached for `document` again to report it -
an unhandled rejection after the test ended, for a page that does not
exist. The chain now starts from a resolved promise when there is no
document; the entry stays on the list for what it is genuinely excluded for
(the crash listeners at its module scope), and the "three modules fail for
the glob" count is two, held there so a static host import returning to the
entry reads as the regression it is.

**What is still on the boot path, and why.** `travel` (257 KB gzipped, the
largest chunk left) and `spellcast` (55 KB) are reached statically from the
menu floor - `ui/enhancedMenu.js`'s own static graph is 315 files and 6.2 MB
of source, and it pulls `world/windmillMesh.js` (250 KB) and 2.4 MB of
`systems/` for things a menu does not draw. That is the next lever, and it
is the menu's own import list, not the entry's.

## INLINE1 - NOTHING UNDER vendor/ IS INLINED: A MEGABYTE OFF FIRST PAINT (2026-09-20)

**Mac: "Want to talk about overall performance improvements."** The first
thing measurable from the tree, and the cheapest: the JavaScript on the
wire was 2,870 KB gzipped, and 1,002 KB of it was ONE chunk, `weaponRig`.
Its raw size was 1,921 KB, and 1,343 KB of that was **432 PNGs inlined as
base64** - Shield Widget's 275 under-4 KB sprites, Handheld Torches' 31,
Climates & Calories' 18 and the rest. Base64 is nearly incompressible, which
is why that chunk gzipped 1.9 -> 1.0 MB while `main` went 1.5 -> 0.5. And
`scenes/world.js` imports the rig STATICALLY, so the chunk is on the boot
path: every player pulled a megabyte of shield art before the menu drew.

**The rule that let it happen was an enumeration.** EOTB5 met this class
first - 3,035 sprites, a twelve-megabyte chunk - and excluded that mod's
folder from Vite's `assetsInlineLimit` by path, narrow on purpose: "every
other vendored texture keeps the default, because inlining a handful of
small files is a win and the problem here is only ever the COUNT."
AUDIT-IF F1 added Immersive Footsteps the same way. The premise was wrong -
a vendored mod is never a handful of files, it ships in the hundreds - and
the shape was the project's own named hazard: a rule enforced by memory.
Twenty vendor folders landed after the allow-list of three, and not one
joined it. The build exited 0 and said nothing, exactly as EOTB5 records it
did the first time.

**The rule is the class now.** `/[\/]vendor[\/]/` - nothing under
vendor/ is ever inlined; everything outside it keeps Vite's default (a rule
that inlined nothing anywhere would be the opposite mistake, and is pinned
against). The pins that held the old rule named the folders it held OUT -
"every other vendor asset keeps the default", with dynamic-skies and
handheld-torches as the examples - and are INVERTED rather than deleted.
The new pin, `test/vendorinline.test.js`, is GENERATIVE: it walks vendor/
itself, puts every file under the 4 KB default through the real rule read
out of vite.config.js, and holds that every one is refused and every vendor
folder is covered whether or not it has small art today. The next mod holds
without anyone remembering.

**Measured over a real build.** `weaponRig` 1,921 KB -> 596 KB raw, 1,002
KB -> 96 KB gzipped. Total JS on the wire 2,870 KB -> 1,945 KB (-32%). 357
more files emitted to `dist/assets` (2,074 -> 2,431 PNGs), zero base64 PNGs
left in any chunk. The sprites load the way EOTB's 2,000 and Immersive
Footsteps' 210 clips already did - as files, when the mod asks for them.

**What this does not do.** `weaponRig` is still 596 KB of code on the boot
path because `world.js` imports it statically; nothing in it is needed
before a game starts. Making the rig lazy is the next lever and is not
this slice. `tools/mutants/inline1.json`: 2 dead, 0 survived.

## AUDIT-AIR1 - THE SIXTH SEAM (2026-09-19)

> Mac, with a screenshot: *"the screenshot shows a bug where sometimes
> unsheathing, it spawns a weird water texture"*.

It was not water. It was the resolved frame buffer, pasted into the
weapon sprite's quad.

**PERF-TEX3's own trap, one seam further on.** That slice's audit found
13 raw unit-0 binds that answered to nothing, wrote the unit-0 twin of
PERF-TEX's law, and pinned it. What neither pass asked was the other
question: **who takes the context away from the renderer entirely?**
`markForeignPass` is the answer the file already had, and it forgets
every texture shadow for exactly this reason - its own comment says a
shadow that speaks for a unit it no longer owns is a wrong texture.

`_compositeAir` is the same kind of seam and never said so.
`airPass.composite()` is the post-processing resolve: it binds units 0
to 3 (frame, bloom, shafts, AO) and leaves its own unit selected.
`_compositeAir` forgot `_lastProgram` and `_lastVao` after it and **not
the texture shadows** - so the first screen quad after a resolve found

- `_activeUnit` still claiming `TEXTURE0`, when the resolve left unit 3
  selected, and
- `_tex0Bound` still naming the sprite the quad wanted.

Either one alone is a wrong texture. Together they are a guarantee: the
quad skipped its bind, or bound to unit 3, and sampled whatever the
resolve left on unit 0. On an unsheathe that is the weapon sprite
painted with a blurred picture of the room - a soft blue-grey smear with
the room's own edges in it, which is what a water plane looks like.

**Why "sometimes".** `_compositeAir` returns early unless
`this._air.pending`, and `drawScreenQuad` calls it at the head of every
quad - so only the FIRST quad after a resolve is ever wrong, and which
quad that is depends on what else the frame drew. It also needs the
enhanced lane on, since there is no air pass without it.

**The root cause is not the missing line, it is the six copies.** The
same six-field block was hand-written at five seams (the constructor,
`endWorldPass`, `_installWorldSet`, `markForeignPass`, `beginFrame`) and
a sixth was owed at `_compositeAir`. Six copies of a rule is five
chances to miss one, and one was missed. It is now
`_forgetTextureShadows()` and **seven** seams call it -
`uploadEmissionTexture` was a seventh hand-copy, clearing three of the
six, which the sweep also found.

**Proved by replay, not by grep.** The pin drives the real `Renderer`
over the logging GL stub with an air pass that binds what the real one
binds, replays the call log through the GL state machine, and asks what
the GPU would have on unit 0 - and which unit is selected - AT THE DRAW.
A source pin could not have caught this: every line it would have
grepped for was present and correct.

The three older pins that grepped for the hand-written block are
re-aimed at the call, with the helper's own contents pinned where it
lives, so neither half can go vacuous. The unit-1 source law now accepts
`_forgetTextureShadows` as a third way to answer, and only because the
assertion above it proves the helper really clears `_tex1Bound`.

`tools/mutants/audit_air1.json`: 7 mutants, 7 dead - including the
ordering (a forget BEFORE the composite is forgetting shadows the
resolve then invalidates again).

**What this says about the whole PERF arc.** Three slices, three audits,
three shipping bugs found after a green gate, every one of them a
*shadow that outlived its claim*. The shadows are still right and the
64% saving is still real, but the pattern is now explicit: **every new
shadow owes a list of who can take the thing it shadows away.** Both
audits found their bug by asking it; the gate never did.

## PERF-ON2 + PERF-CPU - the others are culled, and the frame can be timed on the clock it is losing (2026-09-19)

Mac: *"Online mode needs further performance improvements"*, then a
readout from the running game:

```
51 fps
19.7 ms   worst 40
script 23.3 ms   worst 44
draws 1365   binds 820
```

**A frame whose SCRIPT outruns its frame time is CPU-bound.** That one
line reorders everything: the cost is not the GPU finishing the work, it
is JavaScript issuing it.

### Measured first, and two hypotheses died

`tools/onlinePerfProbe.mjs` is the measurement that did not exist. Three
arms, all over the real modules:

| arm | what it measures | answer |
|---|---|---|
| session | `OnlineSession.tick()` + `drawable()` over a real session on `test/fakeSocket.mjs` | **0.04 ms/frame at 100 peers** |
| names | the real `namePoints` + the real `ui/nameLayer.js` over a counting document | **1.65 inline style writes a name a frame** |
| draw | `drawBillboards` under PERF-ON's own recording Proxy | **6.3 GL calls a peer a frame** |

The first arm killed a fix before it was written. The per-frame
allocation churn in `net/` - the peer map spread every tick, a fresh
pose object a peer a frame, half a dozen collections rebuilt - is real,
and it costs **0.04 ms at a hundred peers**. It is not the problem and
it is not worth touching.

The second arm was measured twice, because the first fixture was
dishonest: a camera that strafed a metre and a half on the spot changed
only each name's `left`, and reported 0.94 `left` against 0.04 `top` and
0.005 `fontSize`. A player walks and turns, which moves every name in x,
in y and in depth. Against an honest walk it is 1.65 writes a name.

Then `tools/nameLayerBrowserProbe.mjs` asked Chromium what those writes
COST, through `Performance.getMetrics` - and **refuted the fix**:

| mode | layout ms/frame | layouts in 600 frames |
|---|---|---|
| `left`/`top` + font-size (today) | 0.123 | 600 |
| `transform` + font-size | 0.119 | 599 |
| `left`/`top`, font-size fixed | 0.079 | 599 |
| `transform`, font-size fixed | **0.000** | **0** |

Moving to `transform` alone buys nothing, because the per-frame
`font-size` dirties layout by itself. Only moving BOTH takes the layer
off the layout path entirely - and the prize is 0.12 ms a frame at 72
names, which is under one per cent of a frame. **Recorded, not taken:
the win is real, small, and costs a visual change to how a name is
sized. It is not where 23 ms went.**

### What the measurement did find: the peers were never culled

Every world flat gets a frustum test against its own box before it is
submitted (EV3). The peers did not:

```js
if (remotePlayers) for (const b of remotePlayers.batches()) allBatches.push(b);
```

A peer behind the camera, or one at the far edge of the relay's range -
`RANGE_PIXELS` is 3 map pixels, nearly 2,500 units - was a draw, two
texture binds and its uniforms, every frame, whatever the camera was
looking at. At 6.3 GL calls a peer that is 630 calls a frame in a
hundred-peer room, and **every one of them is script time**, which is
the budget the readout says is gone.

PERF-ON passed over this in a line - *"a peer's doll is one billboard
batch created once, with only its `origin` written afterwards"* - which
is true of the batch's CREATION and says nothing about its per-frame
DRAW. The box is the billboard shader's own: bottom-anchored, standing
`size.h` up from the origin and reaching `size.w / 2` in any horizontal
direction, because the quad turns to face the eye. One scratch box,
reused, because the test runs once a peer a frame.

A culled peer casts no shadow while off screen - exactly what the
world's own flats have done since EV3, since the shadow pass reads the
list this builds.

### And the instrument that was missing

`?perf` times the frame on the GPU; `?perf=zones` breaks that number
into passes. **Neither can see a millisecond of JavaScript.** So a
script-bound frame could be investigated in this session only by reading
the code and guessing which half of the work was which - the exact trap
VC6d's own lesson names.

`?perf=cpu` tiles the same zones on the main thread's clock. Same
`mark(name)` call sites, no extension needed (so it answers on every
browser, including the ones the GPU timer refuses), and `markCpu(name)`
lets a host mark a phase that issues no GL at all - which is most of a
simulation frame. The world host now marks `online`, `sim`, `batches`,
`flats`, `people` beside the existing `grass` and `world`, and the line
names its clock so no reader can mistake a CPU zone for a GPU one:

```
[perf] cpu 16.00ms | world 8.00 | sim 5.00 | online 2.00 | grass 1.00 | draws 1365
```

The two clocks do not run together: under `?perf=cpu` the GPU clock
stands down, because the CPU arm reports before the GPU branch is
reached and a clock left running there pushes a sample a frame into a
list nothing drains.

**The lesson: PERF-ON measured the online name pass at 153 GL calls a
name and took it to 14 on 15 September. NAME1 landed twenty-six hours
later and moved the face a player actually sees off that pass entirely -
online forces the enhanced lane, the enhanced lane has a `document`, and
`nameFrame` returns through the DOM layer before `drawNamePoints` is
reached. The measured win is real and it is on a path players do not
take. Nobody re-measured, because there was no instrument that could.**

**Pinned** in `test/perfon2_peercull.test.js` (6). Mutants
`tools/mutants/perfon2.json`: 13 - 13 dead, 0 survived.


## PERF-FLICKER + PERF-LIGHTS - two costs the night was paying for nothing (2026-09-19)

Mac: *"I don't want more tests, I want actual performance fixes."* Fair.
Two, both on the frame's critical path, both found by reading the hot
path with the readout's own verdict in hand - script 23.3 ms on a
19.7 ms frame, so the CPU is the budget and GL calls issued from JS are
how it is spent.

### PERF-FLICKER - the lantern flicker was rebuilding every shadow cube, every frame

EL8 spends the point casters carefully. The nearest `SHADOW_NEAR_CASTERS`
redraw their six cube faces every frame; the rest every
`SHADOW_FAR_CASTER_EVERY`. Six casters, so about **twenty** face replays
a frame out of thirty-six. A slot also redraws when its light **changed**,
which is right - a new lantern in a slot needs its own map:

```js
const changed = !(sl[o] === pos[0] && sl[o+1] === pos[1] && sl[o+2] === pos[2] && sl[o+3] === far);
```

But `far` is the light's range, and **a lantern's range is animated**.
`CityLightAnimator` (world/worldClock.js) wanders every light's range
inside a one-unit band at fourteen steps a second - that is the flicker.
So `changed` was true for every caster on almost every frame, every slot
rebuilt all six faces, and EL8's whole schedule was dead: **thirty-six
face replays a frame instead of twenty**, each one a full replay of the
casters within that lantern's reach.

The saving was designed, measured, and then quietly given back by an
animation in another file. Nothing in either file was wrong on its own.

The fix is one line plus a law: the cube map's far plane is the light's
range **rounded UP** to `SHADOW_FAR_QUANTUM`, and the rounded value is
what the face matrices, the change test and `pointParams` all take - they
must agree, because the fragment stage reconstructs depth from `P.w`.
Rounding UP means the far plane is never inside the lantern's reach, so
no shadow is ever clipped short; the cost is depth spread over a slightly
longer range, which at 512 square on a 24-bit buffer is nothing. A
quantum of 4 swallows the whole one-unit wobble of an 18-unit lantern:
the pin drives the real animator for 600 frames, checks the range really
does move, and holds that every one of those frames maps to ONE far
plane.

### PERF-LIGHTS - a fresh object per lantern per frame, all night

The night branch built its light list from scratch every frame:

```js
const sceneLights = [];
for (const p of built.values()) {
  const t = state.pixelTranslation(p.px, p.py);        // a triple a pixel
  for (const l of p.lights) sceneLights.push({ x: …, y: …, z: … });   // an object a lantern
}
```

A town at night is hundreds of lanterns, sixty times a second, every one
of them thrown away the moment `nearestLights` had picked its sixteen -
in a frame that is already script-bound. The objects are refilled in
place now, the translation writes into one reused triple, and the live
count rides into the selector as a new trailing argument whose default
(`-1`) keeps every other caller's meaning exactly. A night frame
allocates nothing here at all.

The selection is untouched, and that is pinned rather than asserted: 60
random towns, each selected both ways - a freshly built list, and the
pool with stale entries past the live count - **identical every time**.

**Pinned** in `test/perfon2_peercull.test.js`. Mutants
`tools/mutants/perfon2.json`: 19 - 19 dead, 0 survived.

**The lesson: EL8's schedule and the lantern flicker were each correct,
and the pair was not. A cache key that includes an animated value is not
a cache, and nothing in either file could see the other.**


## PERF-CROWD + PERF-BASIS - the town was never culled, and the sun's basis went up once a flat (2026-09-19)

Continuing on fixes. Two more, both found by reading the submission path
with the readout's verdict in hand - 1365 draws, script 23.3 ms.

### PERF-CROWD - the whole live crowd was submitted uncut

PERF-ON2 culled the peers. It turns out they were not the only list the
host hands the renderer by hand:

```js
if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, UP_Y);
```

`livePersonBatches` is the townspeople, the city watch, the exterior
foes, the dropped ground piles, the blow effects, the dropped torches and
the camps. **Not one of them was frustum-tested.** Every townsman behind
the camera was a draw, two texture binds and its uniforms, every frame -
and in a town that list is most of the frame's billboards. The world's
own flats have had this test since EV3; these never did.

Same one-line shape as the peers, so both now take the same test, and the
peers' hand-rolled box is retired with it.

**The sphere had to be lifted, and that is the whole correctness of it.**
`createBillboardBatch` stores a sphere over the placement points with the
sprite's half-diagonal added to the radius. But the billboard vertex
shader is BOTTOM-ANCHORED - `uUp * ((aCorner.y + 0.5) * uSize.y)` - so a
sprite stands its full height ABOVE its placement point, and a sphere of
radius `hypot(w, h) / 2` about that point does not reach the top of
anything taller than it is wide. A person is exactly that shape: at
w = 1, h = 3 the stored radius is 1.58 against a head at 3.0. Culling by
the stored sphere would clip heads at the top of the screen. Lifting the
centre by half the height bounds the quad exactly, and the pin holds both
halves - that the unlifted sphere fails and the lifted one does not.

(The shadow replay's own `batchVisible` has the same unlifted sphere. It
is left alone: a shadow popping at a cascade edge is not a head
disappearing, and changing it would move EL5's pinned culling counts.
Recorded here rather than fixed quietly.)

### PERF-BASIS - two uniform uploads a flat, for two numbers that could not change

Inside the shadow replay's billboard loop:

```js
gl.uniform3fv(P.bb.right, recordBasis ? r.right : this._right);
gl.uniform3fv(P.bb.up,    recordBasis ? r.up    : this._up);
```

Four cases, and only ONE of them varies per flat. `up` is the constant
`[0,1,0]`, or the record's own basis which is fixed for the record.
`right` is the frame's sun basis, computed once in `frame()` before the
cascade loop - **unless** this is a lantern's replay, where each flat
turns to face the lantern (EL6). So a sun cascade was paying two uniform
uploads a flat for two numbers that could not change, three cascades
deep, every frame. On a script-bound frame a GL call that cannot change
anything is the purest waste there is.

Both are hoisted to once a record; the lantern arm keeps its per-flat
upload, because flattening every sprite's shadow to one direction is a
bug, not a saving. And the texture bind now skips its repeats, as the
main pass's has since PERF3.

**The campaign found a hole that was there before this change**: nothing
in the suite could fail a mutant that stopped the lantern's flats turning
to face it. It is pinned now.

**Pinned** in `test/perfon2_peercull.test.js`. Mutants
`tools/mutants/perfon2.json`: 22 - 22 dead, 0 survived.


## PERF-CROWD2 - the billboard pass culls, so no host can forget to (2026-09-19)

PERF-ON2 found the peers submitted uncut. PERF-CROWD found the whole town
beside them. Then the same shape turned up everywhere else:

| host | list |
|---|---|
| `dungeonContext.js:5335` | the mobiles, the drops, the spells |
| `worldModes.js:7081` | the dungeon's flats, camps, torches and peers |
| `worldModes.js:7263` | the interior's flats and peers |
| `worldModes.js:7269-7327` | blood, torches, drops, foes, guards - **five separate uncut calls** |
| `exterior.js:5097`, `world.js:12839` | the spell missiles |
| `exterior.js:5175` | the fixed city's townspeople |
| `interior.js:369`, `dungeon.js:1052` | the flats, the camps, the torches |

Seven call sites, and an eighth waiting to be written next year. **Fixing
them one at a time is how this bug got to be in eight places.** The test
belongs in the pass, so `drawBillboards` takes it and every host is
correct by construction.

**It culls AFTER the shadow record, on purpose.** `recordBillboards` runs
first and takes the whole list, so everything still CASTS - only the
drawing is culled. Nothing goes dark because its caster stepped off
screen. (The world host's own lists are culled a step earlier, before
they are even collected; that is EV3's existing behaviour for its flats
and the peers and crowd now match it.)

The planes are recomputed once a CALL rather than cached on the frame
stamp, because the panel bracket swaps `_proj`/`_view` without bumping
it - one 4x4 multiply a call against what it saves is not a trade worth
thinking about. The sphere is the batch's own, lifted half a height for
the bottom anchor, exactly as PERF-CROWD's is and for the same reason.
`?cull=off` turns it off with everything else, and `stats.bbCulled` says
how many the frame skipped.

**Pinned** in `test/perfon2_peercull.test.js`. Mutants
`tools/mutants/perfon2.json`: 28 - 28 dead, 0 survived.

**The lesson: the same one-line omission in eight places is not eight
bugs, it is one bug in the wrong layer.**


## GRAIN1 - the distant ground was unfiltered, and the shader is why (2026-09-19)

Mac: *"distance terrian has a weird grain look"* - and, before asking for
it, *"im not sure if we can tackle this without taking a performance
hit"*. **It costs nothing, and it may give some back.** *(GRAIN AUDIT 1: half right. Nothing on the CPU, measured; on the GPU the filter went from one fetch to eight-to-thirty-two per ground fragment, and the give-back is not real for an 896 KiB array that already lived in cache. See GRAIN AUDIT 1.)* That is worth
saying first because the worry was reasonable.

### What the grain is

Minification aliasing. The tile array was `TEXTURE_MIN_FILTER = NEAREST`
with no mipmap, so past a few tiles out a screen pixel covers a dozen
texels and NEAREST picks exactly one of them - a *different* one each
time the camera drifts a fraction. The ground boils. A mipmap is the
only cure for it.

### Why there wasn't one

Not an oversight. The terrain shaders sample a per-tile UV:

```glsl
vec2 tileUV = fract(unwrapped);          // jumps 1 -> 0 at every tile edge
vec2 tuv = ROT[t] * tileUV + TRANS[t];
texture(uTileArr, vec3(tuv, float(layer)));
```

`texture()` picks its mip from the screen-space derivative of the
coordinate it is handed. At each of those `fract` jumps the derivative is
a whole tile wide, the hardware reads that as *"this pixel covers the
entire texture"*, and it samples the coarsest mip. Turn mipmapping on
naively and you get a blurred line drawn around all 16,384 tiles of every
streamed pixel - far worse than the grain.

### The fix

`unwrapped` does not jump. Its derivative is the true footprint, and
`ROT[t]` is constant across the fragment, so rotating it gives that
footprint in the rotated tile's own frame:

```glsl
vec2 gx = ROT[t] * dFdx(unwrapped);
vec2 gy = ROT[t] * dFdy(unwrapped);
textureGrad(uTileArr, vec3(tuv, float(layer)), gx, gy);
```

One sample either way. Both terrain shaders take it, and so does the
water pass, which samples the same array through the same `fract` wrap
(its own rollover would have drawn the same line).

Then the texture side: `generateMipmap`, `LINEAR_MIPMAP_LINEAR` on
minification, and **`NEAREST` left exactly where it was on
magnification** - the near field is where Daggerfall's texels are meant
to be square and visible, a mipmap has no say there, and LINEAR would
smear the one place the art is read at full size. The distance is bought
and the near field is untouched.

A 2D ARRAY mipmaps each layer independently, so no tile can bleed into
another the way an atlas would - the other reason atlases ship unmipped
and this need not.

Anisotropy where the driver has it, capped at 4. Terrain is read at a
grazing angle almost everywhere, and an isotropic mip must take the wider
of the two footprints - so it over-blurs along the view and still aliases
across it. This is the one term that buys back the sharpness the mipmap
costs. Optional: a driver without the extension still draws, and the
mipmap alone already removes the grain.

### The cost, honestly

- `textureGrad` against `texture`: one sample either way. Explicit
  gradients can cost a little on some hardware; it is one instruction's
  worth, not a pass.
- The mipmap **reduces** texture bandwidth at distance. Unmipped
  minification is the worst case for a texture cache - every neighbouring
  pixel reads a scattered texel. Mipped, it reads a coherent block. At
  distance this is a saving, not a cost.
- Memory: +33% on the tile array. 56 layers at 64x64 RGBA is under a
  megabyte, so the chain is a third of that.
- Anisotropy at 4x is real fill-rate work, and it is the only line here
  that spends anything.

And the frame this ships into is **CPU-bound** - the readout that opened
this arc was script 23.3 ms against a 19.7 ms frame. GPU filtering is
not what it is short of.

**Verified in real WebGL2** (headless Chromium, not asserted from
memory): the construct compiles, and `EXT_texture_filter_anisotropic`
reports a maximum of 16 there.

**Pinned** in `test/grain1_terrainmip.test.js` (4). Mutants
`tools/mutants/grain1.json`: 10 - 10 dead, 0 survived.

**The lesson: "we cannot filter this" was true of the sampler it was
written against, and had been carried as a property of the terrain ever
since. The wrap was never the obstacle - handing the wrapped coordinate
to the hardware was.**

## GHOST1 (2026-09-19) - THE SPRITES THAT WERE CULLED WHILE THEY WERE ON SCREEN - SHIPPED

Two reports in `#bug-reports`, the same afternoon:

> **Clerical Error:** "loaded from a save and we have ghost campfires now"
> - with a screenshot of a flame that is a blurred glow and nothing else.

> **kurkku:** "sprites disappear and reappear at certain(?) angles"

One bug, in the billboard frustum cull PERF-CROWD and PERF-CROWD2 had
added the same day. Two things were wrong with it.

### 1. The planes were not normalised

`frustumPlanes` (EV3) returns its Gribb/Hartmann planes **unnormalised**,
on purpose and with its own note saying so: `aabbOutside` only reads the
SIGN of `a*px + b*py + c*pz + d`, and normalising would spend four square
roots a frame on nothing.

`sphereInPlanes` is not that test. It compares `dot + d < -r`, and that
is a world distance against a world radius **only when the normal is a
unit vector**. That is exactly why `spherePlanes` exists beside it, and
why the shadow replay and the air pass have always gone through it.

Both new culls skipped it. On a 60-degree frustum the side planes carry
`|n|` = 1.40 and the top and bottom exactly 2.00, so a sprite's radius
counted for as little as **half of itself** and the cull ate a band
around the frustum's edge proportional to the sprite's own size. Swept
over ~440,000 placements whose quad genuinely lands inside the clip box,
the raw planes throw some away at every sprite size tested; the
normalised ones throw away none. The band is widest where the planes
converge - close to the eye, which is where you stand when you look at a
campfire - and at the screen edge, which is what turning does to
everything else. Both reports, one cause.

### 2. The lift was in the wrong place, which is what made it a GHOST

A billboard's stored sphere is over the PLACEMENT points, and the vertex
shader is bottom-anchored (`uUp * ((aCorner.y + 0.5) * uSize.y)`), so the
quad stands its full height above that point. PERF-CROWD lifted the
centre half a height to bound it - correctly - and PERF-CROWD2 wrote the
same lift again in the renderer. Neither put it in `batchVisible`, which
is the copy the shadow replay and the **air pass's emission replay** cull
by.

So two passes asked different questions about one sprite. The main pass
dropped a flat the emitters kept, and what was left on screen was the
BLOOM of a sprite that never drew: a blurred, sourceless glow where the
fire should be. A ghost campfire, exactly as reported and exactly as
photographed.

The lift lives in `batchVisible` now and the two hand copies are gone -
`renderer._bbVisible` and `world.js`'s `billboardOutside` both delegate.
A negative height (`droppedTorches`' flame, drawn on a negated
`localScale.y`) lifts DOWNWARD by the same rule, which is where its quad
actually hangs.

### The change that had to be free

`world.js`'s `_planes` now serve both tests, so EV3's box culling reads
normalised planes too. Dividing four coefficients by a positive length
cannot move a sign, so every `aabbOutside` decision is bit-for-bit what
it was - pinned over 10,000 boxes rather than argued. The cost is six
square roots a frame.

**Pinned** in `test/ghost1_spritecull.test.js` (6) - the measurement of
`|n|`, the over-cull sweep from the outside (quad corners projected
through the same proj*view the shader uses), the conservative direction,
the lift and its one home, and the EV3 equivalence. Mutants
`tools/mutants/ghost1.json`: 10 - 10 dead, 0 survived. Four
`perfon2.json` records retired: their laws moved into `bounds.js` and
`ghost1.json` kills them there.

**The lesson: a helper that exists BECAUSE the other one is wrong for
your case is not interchangeable with it. `spherePlanes` sat next to
`frustumPlanes` with a comment saying precisely why, and two new callers
reached past it. And when two passes cull the same object by two copies
of one rule, the bug does not hide - it draws.**

## PERF-SUN (2026-09-19) - THE EXTERIOR WAS PAYING PER FRAGMENT, AND THE SKY PROVED IT

Mac: *"exterior shadows at a distance, tree sway at a distance, and
whatever else can cause insane performance issues. On the outside, I'm
receiving over 1000 calls and looking up in the sky restores frame
rate."*

### Looking up is the diagnosis

The sun cascades are built around the **eye**, not the view direction,
and each shadow replay culls by its own cascade's frustum. None of that
changes when the camera tilts. The air pass, the sky, the sim: all
unchanged. The one thing that collapses when you look at the sky is the
number of **shaded fragments**.

So the >1000 draw calls, whatever else they cost, are not what the sky
gives back. The exterior was spending itself per fragment, on ground
that fills nearly the whole screen.

### PERF-SUN1 - the far cascade took nine taps for a texel two pixels wide

`sunShadowAt` filtered 3x3 in every cascade. And each of those nine
samples is **already a 2x2**: the sun map is `COMPARE_REF_TO_TEXTURE`
with `LINEAR` filtering, so one `texture()` on it is a hardware bilinear
PCF over four texels and the loop was an effective 4x4 filter.

That is worth it where the texel is coarse against the pixel. Cascade 0
is 12 units over 2048 - a 1.2 cm texel, EL7's contact hairline, the
whole reason the near cascade exists. The **far** cascade is 240 units:
a 23 cm texel, which at a hundred metres on a 60-degree field is about
two pixels across. One hardware tap there is already a 2x2 over a
two-pixel texel; the other eight soften nothing anyone can see - over
**most of an outdoor screen**, because cascade 2 is everything past 48
units.

The nearest two cascades keep the kernel. The far one returns on one
tap, before the loop.

### PERF-SUN2 - the shadow was read where the sun cannot reach

Every lane shader wrote the sun term as one flat product:

```glsl
float diff = max(dot(n, uLightDir), 0.0) * cloudShadowAt(vWorldPos) * sunShadowAt(vWorldPos, n);
```

**GLSL evaluates every operand of a product.** A surface whose normal
faces away from the sun paid nine hardware-PCF compares and a cloud-deck
sample, and then multiplied them by the zero sitting in front of them.
Every north-facing wall, every back slope, and the whole world whenever
the sun is low.

`diff` reaches the light exactly once, as `uSunColor * (uSunScale *
diff)` - so gating it on `ndl > 0.0` **or** on `uSunScale > 0.0` cannot
move a pixel; it only skips arriving at the same zero. The `uSunScale`
half is a uniform branch, free and coherent, and it takes out dusk, dawn
and the whole night as well. A FLAT has no normal, so its gate is
`uBBSun` - the sun's entire share of the tint, and zero at night - which
stops every sprite in the world reading the sun map after dark.

Verified in a real WebGL2 driver rather than asserted:
`tools/perfSunShaderProbe.mjs` compiles all four lane shaders and both
water variants.

### The tree sway is cleared

It is not a per-frame cost. `floraSwayOf` runs once per BATCH when the
pixel is built, each host uploads **one** wind vector a frame for every
flat in the world, and the lean is a few instructions on four vertices a
sprite. Recorded so the next reader does not go looking.

What was wrong beside it: `floraSwayOn` minted a `URLSearchParams` and
parsed the query string **once a frame** to answer a question that
cannot change while the page is open. Read once now, as `?cull=off` is;
the pref beside it stays live, because the player can toggle that
mid-session.

### RECORDED, NOT FIXED - the >1000 draw calls

Named here because it is a real finding and this slice is not its fix.

A streamed pixel's static models are merged by PERF4 into one mesh with
**one sub-mesh per texture**, and that is where the draw count lives: a
town pixel with thirty distinct wall and roof textures is thirty draws,
times every visible pixel. The obvious saving - cull the merged batch
per sub-mesh, using the bounds `createMesh` already computes and the
shadow replay already tests - **does not work here**, and the reason is
worth writing down: a merged sub-mesh is one texture's geometry across
the WHOLE pixel, and a pixel is 128 tiles at 6.4 units, or 819 units
across. Its bounding sphere spans the pixel, so the test would almost
never fire.

**CORRECTED 2026-09-19, same day:** the remedy first written here -
merge per texture *and* per spatial cluster - is wrong, and the
arithmetic says so in one line. The current scheme is already the
MINIMUM draw count: one per distinct texture. Splitting a pixel into
sixteen cells turns thirty textures into up to 480 sub-meshes, and even
if only three cells are in the frustum that is ninety draws where there
were thirty. Clustering trades draw calls AWAY to buy vertex work; it is
a fill win and a draw-call LOSS, and this finding was about the draw
count.

What the draw count actually is, recounted: terrain is one per visible
pixel, the merged static batch is one per texture per visible pixel, and
**the flats are one per (archive, record) per pixel** - which across the
streamed grid is the largest single source, and the one MAC1 already
cut the small far ones out of. Collapsing those would need either a
texture array over an archive's records (so one draw covers many
records) or world-space centres merged across pixels (which costs the
per-pixel frustum cull that EV3 pays for). Both are real projects with a
real trade, and neither is a line of code. Recorded as an open question
rather than a plan.

**Pinned** in `test/perfsun_fragment.test.js` (4). Mutants
`tools/mutants/perfsun.json`: 15 - 15 dead, 0 survived. Two older
records re-aimed by content (`el2.json`, `el7.json`) and EL7's own water
pin with them.

**The lesson: "over 1000 calls" named the thing that was easiest to
count, and the sky named the thing that was actually being paid. A
product in a shader is not a series of conditions - it is a promise to
evaluate all of them.**

## PERF-FOG (2026-09-19) - A UNIFORM WAS BEING DECODED ONCE A FRAGMENT

Found by keeping on looking after PERF-SUN, in the same place and for
the same reason: what does every exterior fragment actually run?

`elFinish` is the lane's output - the tonemap, the fog blend, the
in-scatter, the encode, the dither - and it runs in **every lane shader
there is**: the terrain, the meshes, the rigs and every flat in the
world. It opened with:

```glsl
vec3 col = mix(elDecode(uFogColor), tm, fogFactorAt(wp));
```

`elDecode` is the piecewise sRGB curve - three `pow()` calls. **On a
uniform.** The value is identical for every pixel of the frame and it
was being recomputed for every one of them, all day, everywhere.

GLSL has nowhere to hoist a uniform-only expression to: there is no
per-draw stage between the uniform and the fragment. So the only place
it can be computed once is the host, and the only way to say that is to
send the colour already decoded. `uFogColorLin` is declared in the
shared block (so a fifth lane shader cannot be written without it),
`_fogLocs` looks it up with the rest of the fog, and `_uploadFog` sends
it only to a program that asked - a classic program does not declare it,
and a lane program that never calls `elFinish` has it optimised out, so
both read null and skip.

**The law is not restated.** The lane already carries the decoder the
shader compiles - `decode3` - and the renderer reaches it through the
lane it was handed, so there is no second copy of the sRGB constants
here, only a place to keep the answer. The cache is keyed on the display
triple it came from, starts at NaN (a zero triple would match a
legitimately black fog and never recompute), keeps its own scratch
rather than `_c3`'s (which is handed to whoever asks next), and is
invalidated on a lane swap - a cache keyed on its input alone cannot see
that the *function* changed.

The far ring pastes the same block but has its own finish and its own
upload path, so it keeps its own decode. Named so the asymmetry reads as
a decision.

**The failure this could not be allowed to have is a black fog.** A
uniform the optimiser drops reads back as null, the upload skips it, and
`elFinish` mixes toward black - which compiles clean and shows only on a
foggy day. Source cannot answer that, so `tools/perfSunShaderProbe.mjs`
links all four lane programs in a real driver and asks for the location.

**Pinned** in `test/perffog_uniform.test.js` (4). Mutants
`tools/mutants/perffog.json`: 11 - 11 dead, 0 survived. EL1's fog pin
and its `glsl-fog-blend-raw` mutant re-aimed by content: the law EL1
states - the fog is blended in linear and re-encoded, so a fogged
fragment IS the fog colour - is unchanged; only where the decode happens
moved.

**The lesson: a shader is the one place where "it's just a constant"
costs you two million times a frame. The exterior's real bill was never
in the things that were easy to count.**

## TREES1 (2026-09-19) - THE DARKENING ON THE TREES WAS PERF-SUN1 MEETING A SPRITE

Mac, the day PERF-SUN shipped: *"There's this weird darkening effect
happening to trees."*

Mine, and the argument that produced it was **half right**.

PERF-SUN1 gave the far cascade one shadow tap instead of nine, on this
reasoning: each tap is already a hardware 2x2, the far cascade's texel is
about two pixels at a hundred metres, so the extra eight soften nothing
anyone can resolve. That is an **antialiasing** argument, and it holds
perfectly for the terrain, the meshes, the rigs and the water - every one
of which shades **per fragment**, so neighbouring pixels smooth a coarse
filter whatever the lookup returns.

**A flat is not like that.** `EL_BB_FS` reads the sun map ONCE, at the
sprite's base, and wears that single value over the entire quad - which
is EL2's own decision, because a sprite sampled at its own fragment would
shadow itself. For a tree the kernel is therefore not softening an edge.
It is the only gradation the tree has.

So with one tap: a tree whose foot sits near a shadow edge stops being
*partly* shaded and becomes fully lit or fully dark, the whole sprite at
once - and jumps again at the cascade boundary as you walk toward it. A
weird darkening effect happening to trees.

`sunShadowSoftAt` keeps the kernel at every distance, and the flat is its
only caller. One body, one early return, behind `!soft`. The saving
stands almost entirely: the ground is where the fragments are, and flats
are a thin slice beside it.

**Pinned** in `test/perfsun_fragment.test.js`. The pin asks the CALL
SITES, not the shader text: every one of these shaders pastes
`SHADOW_GLSL` and therefore contains *both* function names, so "which
does this shader use" can only be asked of what is left when the block is
removed. It holds that the flat takes the soft one and never the cheap
one, that every per-fragment surface takes the cheap one and never the
soft one (or the saving goes), and that the body has exactly one early
return - a soft path that still fell through to the cheap tap would be
this very bug wearing the name of its own fix. 5 more mutants, all dead.
EL2's flat pin re-aimed by content: its law - the flat's sun term wears
both shadows, read at its base - is unchanged.

**The lesson: the optimisation was correct about the pixels and wrong
about one caller, because that caller does not have pixels in the sense
the argument assumed. "It's below the resolution of a pixel" means
nothing to a surface that takes one sample for ten thousand of them.**

## WEEDS1 (2026-09-19) - EVERY WEED IN THE WORLD WAS CASTING INTO THE 240-UNIT CASCADE

Mac, after TREES1: *"its better, what else can we do?"*

F5 already culls a caster too small to shadow a texel of the cascade it
is being replayed into. It has been there since the field report that
found the standing shadows. And for flats it was **dead**, for a reason
that is only obvious once said out loud:

> F5 measures the BATCH'S SPHERE. A billboard batch is every flat of one
> (archive, record) across a whole streamed pixel - and a pixel is 128
> tiles at 6.4 units, **819 across**.

So a batch of ankle-high weeds scattered over a pixel carries a bounding
sphere of several hundred units and sails straight through a test looking
for things under 47 cm, while every sprite in it is thirty centimetres.
Three orders of magnitude apart. Every weed, flower, pebble and ground
prop in the world was replayed into the far cascade, where its shadow is
one texel.

The right measure for a flat is the **sprite**, which the batch already
carries as `size`. This is MAC1's argument - *"all the billboards in the
distance ESPECIALLY ALL THE SMALL ONES"* - applied to the pass that never
got it.

### Four texels, and why that number confines the change

Against each cascade's texel:

| cascade | radius | texel | four texels |
| --- | --- | --- | --- |
| 0 | 12 | 1.2 cm | 4.7 cm |
| 1 | 48 | 4.7 cm | 19 cm |
| 2 | 240 | 23 cm | **94 cm** |

The near two land *below* the existing `SHADOW_FLAT_MIN_HEIGHT` of 0.5,
so they cannot move - the change is confined to the far cascade by
construction rather than by intent. There, nothing under about a metre
casts any more. A tree, a person and a fence post all clear it; a weed, a
flower and a small bush do not, and the largest shadow removed is a few
screen pixels at a hundred metres.

The **lantern** replays pass no texel and are untouched, which is right
and not merely convenient: a cube face is 512 over a range of about
eighteen units, so four of its texels is 28 cm - under the floor anyway.

### F5's batch line is retired with it

Once the sprite test exists, F5 can no longer decide anything about a
flat. A single-flat batch's radius is `hypot(w, h) / 2`, so F5 fired only
when `hypot(w, h) < 4 texels` - and that implies `h < 4 texels`, which is
the sprite test itself. A multi-flat batch's sphere spans its pixel and
F5 never fired on it at all.

**How that was found is the useful part.** F5's own behavioural pin in
`bugs5_field.test.js` kept passing after WEEDS1 landed - but for the
wrong reason: the same flat was now culled by the height test instead.
Its MUTANT survived, which is what said so. The pin is re-aimed onto
WEEDS1 with a WIDE short flat added (the one shape F5 could never catch),
and F5's test over MESHES and terrain, at the top of the replay loop, is
untouched and still live.

**Pinned** in `test/weeds1_flatcasters.test.js` (4), including the
subsumption checked arithmetically over five sprite shapes rather than
argued. Mutants `tools/mutants/weeds1.json`: 8 - 8 dead. Six `bugs5.json`
records re-aimed by content and one retired with the line it mutated.

**The lesson: a cull that measures the wrong extent is not a weak cull,
it is no cull at all - and it will sit there for months looking like one,
because the code that would have caught it is the code it is standing in
for.**

## GRAIN AUDIT 1 - "ensuring it doesnt degrade performance" (2026-09-21)

Mac: *"Can you audit the filtering enhancement we have implemented
ensuring it doesnt degrade performance."* Three Opus lenses, read-only:
the GL and texture side, the shader side, and the dial with its pins,
records and measurement story. Every number below was counted, diffed
or read back; SwiftShader's milliseconds were taken by nobody.

### The answer first

**On the CPU: nothing, measured.** A counting GL stub under the real
`Renderer`: one `generateMipmap`, four `texParameteri` and one
`texParameterf` per ground archive at upload, the extension and its
ceiling fetched once per renderer, and in a frame of 121 terrain draws
**zero** filter-related calls - the array binds once for the frame
under PERF-TEX2's shadow. `getPref` is read once per archive. Nothing
per layer, per streaming update or per map-pixel crossing.

**On the GPU: a real cost, small at the default, not measured on any
GPU, and GRAIN1's "it costs nothing, and it may give some back" was
half wrong.** The sampling *instruction* is one either way, as the
record said; the *filter* changed on the next line. Texel fetches per
ground fragment: pre-GRAIN1 `NEAREST` no chain, **1**; GRAIN1 "Off"
(trilinear, no anisotropy), **8**; Default (trilinear, 4x), **up to
32**; Maximum (16x), **up to 128** - on the pass that covers the most
screen, drawn FIRST with no depth prepass so its occluded fragments pay
too, and paid TWICE over water, which re-shades the same fragments from
the same array. The give-back is not real: the array is 56 layers of
64x64 RGBA, 896 KiB, 1.17 MiB with its chain (GRAIN2's "under a
megabyte with its chain" was wrong; GRAIN1's "the chain is a third of
that" was right) - a texture that already lived in L2 had no bandwidth
problem for a mipmap to solve, so the extra taps are pure cost.
Compiled through ANGLE, the shipping shaders carry +103 SPIR-V
instructions on the classic terrain stage (+15.6%) and +101 on the
enhanced (+4.6%) against a GRAIN1-reverted copy - an upper bound, most
of it folds - and two `dFdx`, two `dFdy`, four multiplies and two adds
that do not. On Mac's own machine (PERF-TOWN1: CPU-bound, script at or
over the frame) the honest estimate is *no measurable change*. On
integrated graphics at 1080p, running the classic lane, the ground
pass's sampler work is a real fraction of the frame and this multiplied
it; low single digits to low teens of a percent is the range, and no
one can narrow it without a GPU.

**What the artefact was worth.** On a synthetic perspective ground
plane the blurred-tile-edge line GRAIN1 was built to avoid touches
**0.15% of pixels**, on 16 of 240 scanlines, at up to 218 of 255 -
real, structured exactly as predicted, and O(perimeter) against a fix
paid O(area). The grain itself is gone: horizontal high-frequency
energy 45.0 -> 10.7 with the chain on. And the dial's shape is
vindicated: Off -> Default moves 25% of pixels (mean 18); Default ->
Maximum moves 6.3% (mean 1.5) for up to four times the filter work.
"Maximum" buys almost nothing.

### The findings, all paid

1. **THE DIAL DID NOT LAND.** `uploadTileArray` returns the cached
   array for any archive the page has seen, the cache lives as long as
   the renderer - the page - and the tier was read only at upload. So
   `groundSharpness` took effect on a page reload, or on the first
   archive of a climate not yet visited, leaving the world at two tiers
   when it did; a player who felt the cost and turned it Off kept
   paying until they reloaded the page. The row said "when the world
   next loads" and the pin asserted the sentence rather than the
   behaviour. Now: `applyGroundSharpness()` walks the cached arrays and
   re-sets the sampler state - a bind and two parameter calls per
   archive, no upload, no chain - and both exterior hosts call it at
   every world load. The sentence is true because of that line.
2. **"OFF" WAS STILL TRILINEAR.** GRAIN1's Off turned the anisotropy
   off and kept `LINEAR_MIPMAP_LINEAR`: eight fetches where the ground
   had cost one, and no tier on the dial went lower. The mipmap is what
   cures the grain, not the filter within a level. Off is
   `NEAREST_MIPMAP_NEAREST` now - one fetch, the pre-GRAIN1 cost with
   the boil gone, the texels square at every distance, and the filter
   every numeric archive in this renderer already used (FilterMode
   .Point over a chain, MaterialReader.cs:104). Measured on the near
   field: `LINEAR_MIPMAP_LINEAR` at 1x took a 3-colour patch to 444
   colours and changed 17.8% of its pixels; `NEAREST_MIPMAP_NEAREST`
   took it to 4 and 7.3%. Which also corrects GRAIN1's "spends nothing
   on the near field": `MAG = NEAREST` governs only where a texel is
   larger than a pixel, a couple of metres out at eye height, and past
   that the MIN filter blends. Default and Maximum keep trilinear,
   because anisotropy wants a linear filter within the level.
3. **NOTHING COULD MEASURE IT.** The port's one real-GPU instrument,
   `tools/perfProbe.mjs`, opens a fresh browser with an empty shelf, so
   it always measured Default and no run could ever say what a tier
   cost. There is a `?ground=off|default|max` door now (a junk word is
   the default, by `anisotropyFor`'s own law) and the probe takes
   `GROUND=`. The experiment is ten minutes: `HEADED=1 SCENES=road
   SECONDS=12 GROUND=off npm run perf`, again with `max`, and compare
   `frameMs` while `scriptMs`, `draws` and `binds` hold flat. Without
   the probe: set the dial, reload the WORLD (not the page, now), stand
   at a low grazing outdoor view and read the FPS counter; same camera,
   weather and hour. Note Mac's browser has no
   `EXT_disjoint_timer_query_webgl2` (PERF-TOWN1), so a GPU zone would
   read n/a for him; the frame time is the instrument.
4. The extension memo `||=` re-asked `getExtension` on every archive on
   exactly the drivers without it (a memo of null is falsy) - ten calls
   over ten uploads on the stub; `null` is "not asked" and `false` is
   "none" now, and the pin counts the calls.
5. The water pass took its derivatives after two `discard`s -
   undefined in non-uniform control flow, a garbage footprint on a
   shoreline quad under a driver that ends discarded lanes; hoisted
   above them.
6. The row said nothing about cost, at the only place a laptop player
   will look; it names which end is cheap now.
7. The pins held the GL sequence by regex only and the cache - the one
   law that makes this free per frame - not at all: deleting the
   early return survived every pin. The new pin runs `uploadTileArray`
   on a logging stub: one chain per archive after the layers, filter
   and anisotropy by tier, ZERO calls on a cached archive, the re-apply
   over both cached arrays with the anisotropy SET to 1 (not skipped -
   a cached 16x array has to come down), the shadow forgotten, the
   extension asked once with and without a driver that has it, both
   hosts' calls, the probe's door. `kinds` is pinned too - dropping
   `classic` had survived the campaign.
8. Records: the index still carried GRAIN1's retracted "verified 16" and
   no word of GRAIN2; GRAIN1's give-back and near-field sentences;
   GRAIN2's cache-residency argument, which bounds the memory cost of
   the taps and says nothing about their TMU throughput; the
   Enhanced-Environments plan still saying "enhanced only / NEAREST for
   classic" when both lanes mip the one array (the right call - DFU mips
   terrain - and unrecorded).

### Left on the record, not done

- **The ground is drawn first, with no depth prepass.** Every ground
  fragment under every building, tree and person is fully shaded - the
  filter included - and overwritten; in a town that is a large share of
  the pass, and it is the share GRAIN1 made dearer. Drawing the opaque
  static batch before the ground, or a depth prepass for it, is the
  highest-leverage change this audit found and it is not a filtering
  change. It waits on Mac's word.
- **The chain is built in sRGB space** by `generateMipmap` on an unsized
  RGBA array, and the enhanced lane decodes the filtered texel as if it
  were one texel (`elDecode(textureGrad(...))`); decode is convex, so
  distant ground in that lane reads slightly darker than it should, more
  so at higher tiers. An `SRGB8_ALPHA8` array would make the filter
  linear and exact, and free. Recorded, not changed.
- `textureLod` with a fragment-computed LOD was costed as the obvious
  cheaper shader: it is not cheaper (+94 against +104 SPIR-V) and it
  silently loses anisotropy, which would make the dial a no-op. A
  vertex-stage LOD cannot work either: the tile index and rotation are
  per fragment. There is no cheaper shader; every saving is sampler
  state (2) or draw order (above).

**The lesson: "one sample either way" was true of the instruction and
false of the taps, and the one setting built to let a weak machine opt
out neither reached the filter nor reached the machine without a page
reload. A dial that cannot be measured and does not land is a promise,
not a control.**

## GRAIN2 - "Why dont we crank it to 16?" (2026-09-19)

The honest answer to that question is: **4 was a guess, and the 16 I
quoted was not your hardware.**

GRAIN1 reported `EXT_texture_filter_anisotropic` at a maximum of 16,
"verified in real WebGL2". That WebGL2 is **SwiftShader** - ANGLE's
software rasteriser, which is the only GL this container has. It reports
16 because it can do 16 in software; it says nothing about any GPU, and
its cost profile for anisotropic taps is nothing like one. The number was
reported honestly and read further than it should have been.

So the two things worth knowing:

**Why not just set 16.** Anisotropy is paid in fill rate, on the pass
that covers more screen than any other. Most of the sharpness arrives by
4x and the curve flattens hard after it - but "flattens" is not "free",
and the machine that pays is not always the one asking. This is a
multiplayer port; a laptop on integrated graphics is a player too.

**Why 16 is probably fine anyway, on this texture.** The expensive case
for anisotropy is a large working set streaming from VRAM. The terrain
tile array is 56 layers of 64x64 - under a megabyte with its mipmap
chain, small enough to stay resident in cache. Sixteen taps of a texture
that never leaves L2 is a very different proposition from sixteen taps of
a 4K album. The folklore is about the latter.

Neither of those is a measurement, and this session cannot make one. So
the number stops being a number chosen once for everybody and becomes a
**dial**: `groundSharpness`, off / default (4x) / maximum, on the
Features page beside the cloud dial, the player's own online, landing on
the next world load as every quality dial does.

`anisotropyFor(tier, driverMax)` is the whole law and it is pure:
`off` is 1 (the extension's own word for none - not 0, which is not a
legal value), `max` is whatever the driver allows, `default` is 4 capped
by the driver, and an unknown tier - a pref written by a future build -
falls back to the default rather than to the maximum. A driver with no
extension answers 1 for every tier and the renderer then asks for
nothing at all.

**Pinned** in `test/grain1_terrainmip.test.js`. Mutants
`tools/mutants/grain1.json`: 15 - 15 dead, 0 survived.

**The lesson: a number nobody can measure should not be spelled into the
source as though somebody had. GRAIN1's 4 was defensible and its 16 was
a software rasteriser talking - the fix for both is the same, and it is
not a better guess.**

## DSH1 - "The far away horizon is still viewable even though it's cloudy" (2026-09-20)

A screenshot of an overcast evening: a grey lid from the zenith down, and
under it a **hard red line along the whole horizon**, the same colour in
every direction, with the tree line below it. The first read was that the
weather was not reaching the sky. That was right about the symptom and
wrong about the sky - because **the sky in that frame is not the port's**.

### The port's own dome cannot make this picture

Before touching anything, the dome was swept in the sky lab (`sky.html`,
no game data) across seven weathers and nine hours, sampling one pixel
just above the horizon and one just below. The below-horizon reading is
never more saturated than `(172, 144, 135)` and never red - `pal.horizon`
has no such colour in it, and `skyState` greys what it does have by the
weather before anybody reads it. **So the frame was not the port's dome**,
and the same sweep under `?sky=dynamic` answered in one run: `(231, 119,
48)`, `(211, 100, 48)`, `(82, 18, 40)` - saturated warm colours that do
not move when the weather does.

The sky was **Dynamic Skies**, which is `Enabled: true` by default and is
the third tier of the Enhanced Environments row, so a player who never
opened the mod's panel is running it.

### Two causes, one line

**1. The colour the deck fades into.** The volumetric march closes every
far bank on `uHorizonColor` (aerial perspective: `fade = 1 - exp(-t0 /
14000)`, which saturates within a couple of degrees of the horizon), and
`cloudsStateUnderMod` handed it `st.clearColor` - the mod's
`RenderSettings.fogColor` - unchanged. At dusk that colour is a saturated
red. The mod's own dome shows it only in the half-degree strip where
Unity's procedural skybox lerps sky to ground (`SKY_GROUND_THRESHOLD`,
0.01 in sine); the port's deck was painting it across the entire far ring.

The port's dome has never had this problem, and not by luck: `skyState`
greys its horizon by the row's `grey` before it becomes anything's
`clearColor`. So the mod's colour takes **the same greying**, toward the
deck's OWN shade rather than a fixed grey, because the far end of an
overcast lid is its near end seen through air. Sunny is `grey 0` and comes
through **1:1**, which is the whole point: this is not a rewrite of the
mod's sky, it is the port's own weather law applied to a number the port
was already choosing on the mod's behalf.

**2. The last half-degree.** With the colour fixed the line got fainter
and did not go away, because the lid stopped short of the ground twice
over: the composite `discard`ed at `el <= 0.0`, and the march answered its
own near early-out (`dir.y <= 0.004`) with `vec4(0, 0, 0, 1)` - "no cloud,
nothing absorbed" - so the dome came through the lid in the strip where
the mod's hot band lives. Both are closed: the near early-out gives
`vec4(uHorizonColor, 0.0)`, the same answer the FAR early-out beside it
already gave, and the composite carries the map's bottom row over a
**skirt** of `HORIZON_SKIRT` (0.012 rad) below the horizon before letting
the dome stand again.

A skirt, not a floor. An earlier cut held the bottom row all the way to
the nadir and it showed at once on a **clear** dusk: the deck is thin
above the horizon (yellow sky through the gaps) and the held row is fully
covering, so the ground half became a flat opaque slab with a hard edge -
a new artefact traded for the old one. The skirt is sized to the one strip
it exists to cover: Unity's 0.01, with room.

### What the lab was actually testing

Three earlier attempts changed nothing on screen, twice in the mod's own
shader and once in the composite, and none of them was checked before the
next was written. A **green marker** settled it in one run - paint below
the horizon pure green and screenshot - and it showed the red line
surviving ABOVE the green, which is the fact that pointed at the
composite's own bottom rows rather than at the mod's cloud fade. The
reverted work is not in the diff; the habit that produced it is the thing
worth recording.

**Pinned** in `test/dsh1_horizon.test.js` (5): the greying at 0, at 1 and
monotone between; `modHorizon` total against a missing shade, a missing
row and a greyness off either end; the EASED row winning over the
weather's name (the controller hands one and the name beside it is stale
mid-front); the skirt's bounds argued against the number it exists to
clear; and the two early-outs holding the same answer so the lid has no
seam. Mutants `tools/mutants/dsh1.json`: 18 - 18 dead. DS2's own horizon
pin re-aimed by content, and VC3's two composite pins with it.

**The lesson: the port chooses numbers on a vendored mod's behalf, and
those choices are the PORT'S, not the mod's - "1:1" covers the mod's
shader, not the state the port synthesises to feed its own passes. The
red line was in nobody's code and in one of our decisions.**
