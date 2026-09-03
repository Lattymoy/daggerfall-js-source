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
(settings default 1), 0.9, curve); window style Night when IsNight (the
ChangeClimate call-site rule); DaggerfallLight flicker per light (14
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
swallows the sky, mix = 1 - exp(-density * 800)). EQUIVALENCES: the R2
Fog WINDOW style is wired to WeatherType.Fog (DFU defines it, never
wires it); outdoor fog COLOR is DaggerfallSky.SetSkyFogColor's cameraClearColor
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
18, the moons' phases are gameDate's DFU ladder with its offsets, the
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
fillColor roles, the phases coming from the CLASSIC clock so one day is
one phase, a moon under the world not drawn, an unknown weather falling
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

## ES1e - THE RETRO PASS (2026-08-27, Mac's call) - SHIPPED

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

## ES1f - NO POLE, NO CIRCLE (2026-08-27, Mac's report) - SHIPPED

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
the thunder weather, and a season's hand on the palette.


## TR1 THE TREES - our partner's meshes, wearing the player's own sprite (2026-09-03)

Mac: "I want to work on how we could texture this and implement it as a
proper replacement for trees, along with having them interact with the
wind system." The pack is our partner's: a Unity project of Collada
leaf-card meshes, one per classic nature flat (115 models, 26k tris
across archives 500-511), each archive with a 1024² atlas.

**The atlas is Daggerfall's own tree sprites** - TEXTURE.500's records
cut out and packed, with a synthesised top-down of each crown beside
them. Port-Doctrine's second non-negotiable, A RENDER OF GAME DATA IS
GAME DATA, means it cannot ship, whoever packed it. The GEOMETRY is
ours and can.

So the mesh wears the player's own sprite. `tools/treesConvert.mjs`
reads the atlas for one thing - which opaque island each card's UVs
land on - and re-bases the card's UVs onto that island's box; the
shipped `public/trees/<archive>.json` is positions, UVs and card tags,
and a pin proves it holds nothing that could be a pixel. At runtime
`render/treeModels.js` draws the mesh instanced at the flat's positions
in the record's own texture - the billboard path's own upload - with
the record's opaque box measured once from the same DFBitmap, and the
billboard's fog and light law (BB_FS) for the fragment. The mesh is
scaled to the billboard's height and stood on the flat's bottom edge:
the switch changes what a tree IS, not how big or where.

**The wind is the grass's, term for term** - `labGrass.js`'s wdir,
along, gust and push, pinned byte-exact - weighted by the square of the
height above the base so trunks stand and crowns sway, with a phase
off the tree's position so twins differ. The host's wind vector, which
lived inline in the grass block, is hoisted to one object built once a
frame that the grass and the trees both read; `?grass=off` can no
longer take the trees' wind with it. (The rain still builds its own
copy of the vector, with the pre-WIND1 gust envelope - pre-existing,
named, not touched here.)

Enhanced-only under the grass's pref, `?trees=off` to escape. Only
nature flats with a model become trees; a built tree skips its flat, a
failed one falls back to it, and the pixel frees its trees with
everything else. Archive 500 ships 7 of its 31 records modelled; the
rest stay billboards.

**Two things recorded rather than assumed.** The numbers the partner
painted on the atlas and the file names disagree (500_16.dae does not
wear the sprite labelled 16). The file name is the flat the model
replaces and is taken as authoritative; the runtime should sanity-check
the record's opaque aspect against the island's - not yet done. And
the converter is verified by a software render of the converted meshes
sampling the islands as the runtime will sample the record - every
card wore the right piece - but the GL renderer has NOT run in a
browser. It goes to Mac's eyes.

15 mutants, 15 dead. Next: TR2 synthesises the crown-top cards from the
sprite (a 4-way radial of the crown; the cards ship tagged and are
skipped today); TR3 the other archives and the seasons' swaps.

## TR2 + TR3 - the crown from above, and every climate (2026-09-03)

**TR2.** A horizontal card is what a crown looks like from underneath -
from the ground, looking up - a view Daggerfall never drew. Our partner
painted one per record into the atlas: the side sprite's crown, turned
four times about its own centre into a pinwheel. That picture is game
data by the doctrine (it is the sprite, rotated), so it is not shipped;
it is REMADE at runtime by the same construction, from the record the
player supplied. `synthesizeCrownTop` finds the crown by width - the
first row from the bottom at least CROWN_WIDTH_FRACTION as wide as the
widest is where the trunk ends - and turns it CROWN_TURNS times; the
raster uploads under `record#top`, the frame-key shape
uploadRecordFrame already mints, and the top cards draw after the side
cards in it. Seen in a software render on four sprite shapes: a pine
becomes a four-point star, an oak a round crown, exactly what the
partner drew. Pinned square, four-fold, and trunk-free.

**TR3.** The converter reads each triangle block's Collada material
binding through to its image, because the archives are not one atlas
each: 502 binds four, 504 binds its opaque twin for half its cards, two
archives bind files the partner renamed, and three of 501's models bind
nothing at all. The alpha and opaque twins share a layout to 99.9%,
black-matted, so the alpha one's islands serve both; a block with no
binding takes the archive's own named atlas.

And a self-check rides along, because ten archives is more than the eye
will inspect: COVERAGE, how often a side card's centroid, re-based,
lands on its island's opaque pixels. It runs 0.79-1.00 across the
pack. A record under 0.5 is REFUSED - the flat stays a flat rather
than wear the wrong picture - and three were: 501_16, 502_14, 511_12.
511 ships nothing. Ten files, 112 models, 2.5 MB, fetched one per
climate; a binary format is a later slice if the size ever matters.

Not seen in a browser. Nothing in TR1-3 has drawn through GL.

### TR4 - the GL run (2026-09-03, Mac: "Can I see it")

Nothing in TR1-3 had drawn through GL. `tools/treesProbe.mjs` runs the
shipped `public/trees/<archive>.json` through the REAL
`render/treeModels.js` in headless Chromium's WebGL2, with the island
the partner cut from each classic sprite standing in for the record -
the pixels the runtime will get from the player's own TEXTURE.500 -
and films it: 28 trees of archive 500's seven records on a ring, the
camera orbiting, the wind rising from calm to a gale over twelve
seconds. The pack is read from a path; nothing from it is written
anywhere but the frames.

Seen: the shaders compile and link; the record texture, the opaque-box
remap and the crown-top upload go through the real build()/draw();
every card wears its piece; the tops sit on the crowns; instancing
draws each record's trees in one call; the crowns lean with the wind
and the trunks stand. 360 frames, no GL errors (the two Chromium
notices are the SwiftShader deprecation and ReadPixels stalls from the
capture). The island rule the converter uses moved to
`tools/lib/treeAtlas.mjs` so the probe reads the same one.

**And the probe found the lean was wrong.** Its first film drove the
wind at |windV| 1.7, ten times gentler than the sky ever does, and the
crowns swayed nicely. Calibrating the probe to the sky's own range -
0.0046..0.0308 through labWindSlider and the host's 0.16 gives |windV|
4.8 calm, ~11 sunny, 32 storm - showed TREE_LEAN 0.018 bending a 16 m
crown 2.9 m on a sunny day and 12 m in a storm. It is 0.003 now: half
a metre sunny, two in a storm, pinned as a fraction of height against
the range. The probe's first measurement was also wrong - it compared
frames a second apart and the orbiting camera swamped the wind - and
now measures a fixed camera at one instant, calm against calm (zero)
and calm against storm. And it judges: it could not fail before, which
T2's law forbids, and it was pushed once in that state.

Still not seen: the trees IN THE GAME - the host's flat loop swapping a
billboard for a mesh, the record uploaded by the pipeline, the sky's
own wind. That is the walk Mac takes.
