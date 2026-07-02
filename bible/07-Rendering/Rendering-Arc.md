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

## Queue

Owned by `Rendering.md`. Next up: sky (SKY??.DAT).
