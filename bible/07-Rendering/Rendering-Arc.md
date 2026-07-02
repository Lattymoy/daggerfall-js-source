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

## Queue

Owned by `Rendering.md`. Next up: window emission materials.
