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

## Queue

Owned by `Rendering.md`. Next up: spectral/firewall emission colors
(with spectral enemies), weather (owns the Fog window style), dungeon
water plane, terrain atlas pass (+ retire ?terrain), interior 210
point lights.
