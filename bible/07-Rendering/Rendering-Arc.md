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
As-written DFU quirk kept: size.y is the SCALED billboard size added to
native units before the scale multiply (contributes size.y * 0.025) - and
the light Y intentionally differs from the billboard's blockFlatsOffsetY.
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
afternoon uses frame 63 - n MIRRORED ([mirror(west)|mirror(east)] - the
mirror law is pinned as a test against real frames 6/57); the fill above
the strip is west pixel 0; night swaps to the NITE0?I0.IMG of the sky
group (0-7 -> 3, 8-15 -> 1, 16-23 -> 2, else 0) duplicated across both
halves. Presentation is ours (documented equivalence): one fullscreen
cylindrical pass - each 512-wide half spans 180 degrees (anglePerPixel
PI/512, so the strip covers ~77.3 degrees of elevation), azimuth 0 (+X,
map east) starts the east half - replacing DFU's screen-space scrolled
quads with identical angular coverage. `src/render/skyRenderer.js`;
program/state saved and restored around the pass. Wired into the
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

## Queue

Owned by `Rendering.md`. Next up: exterior groundMesh conversion to
the tilemap shader, classic dungeon water texture, weather (owns the
Fog window style), spectral/firewall emission colors when spectral
enemies land.
