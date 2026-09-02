# Rendering

Started with World-Arc milestone 1. Presentation is ours per Port-Doctrine;
this section owns renderer specifics.

Current (`src/render/`) - one bullet per module, pinned against the real
directory by `test/audit18_bible_docs.test.js`:
- `renderer.js` - WebGL2, two programs: lit solid geometry (MVP, directional
  light 0.45 + 0.55*diffuse, alpha < 0.5 discard) and Y-locked billboards
  expanded in the vertex shader. EV5 added a SECOND directional term to
  the three normal-bearing programs (mesh, character, terrain):
  uMoonColor * uMoonScale * N.L, scale 0 by default so classic scenes,
  interiors and dungeons are untouched; the flats take its
  Lambert-average half on the tint, inside the `_clockLit` latch; the
  studio borrow zeroes it. Driven only by the exterior hosts through
  `setMoonlight` (see `07-Rendering/Enhanced-Visuals-Arc.md`). Textures per (archive, record), REPEAT +
  NEAREST, uploaded bottom-up exactly as getColor32 emits (matches GL texel
  order; DFU's negative-V UVs rely on REPEAT). ALL ground - exterior blocks
  and terrain alike - runs through this file's `drawTerrain` tilemap pass.
- `characterMesh.js` - the voxel character mesh path.
- `characterSprite.js` - the classic-visuals sprite pass (one fixed
  CHAR_SPRITE_RT_SIZE target).
- `skyRenderer.js` - painted skies (R4) + the night sky.
- `labGrass.js` - GR1 the LAB'S GRASS: grass-proto.html's blade shaders
  verbatim, its placer law, and a renderer of its own beside the world's,
  drawn on grass records of the near ring outside winter. GR2 darkened
  it, billboarded the blades, time-sliced the walk and rescaled the
  wind. **GR3 (2026-09-02, Mac: "the wind still isn't working ingame"):
  it never was.** The host read the wind off `sky.cloudShadow`, and
  `sky` is the CONTROLLER `createSkyController` returns, which never
  carried that key - EE5 publishes the deck on the DOME, one level down
  under `renderer`. Every reader got undefined: the grass took wind
  [0,0] and a slider of 0, the enhanced rain fell as classic, and the
  ground's cloud shadows were set to null - three features dead from one
  missing key, the suite green throughout, because nothing pinned the
  VALUE that reached the shader. GR2 measured a million blades placed
  and never one moving. The controller carries a live getter now, and
  `test/gr3_wind.test.js` pins the value (sunny is the lab's 70, not 0)
  and a blade's actual tip travel on real placer output (29% of its
  height over half a gust) - the two assertions GR2 lacked.
- `enhancedSky.js` - ES1 the ENHANCED SKY: one fullscreen procedural
  pass, no textures and no game data - a palette record keyed by the
  sun's elevation, the port's own sun arc, DFU's lunar phases placing
  the two moons, stars and weather-driven clouds. Behind the enhanced
  skin (`?sky=classic` opts back to the painted pass); the classic pass
  above is untouched. Its lab is `sky.html` + `src/tools/skyLab.js`,
  its eye `tools/enhancedSkyProbe.mjs`.
- `overworldRenderer.js` - U61 the OVERWORLD pass: the whole-bay relief,
  its location markers, the route line and the cloud deck behind the
  enhanced travel map (self-contained, save/restore, mirrorProjectionX
  on its camera like every world pass - see `src/ui/overworldMap.js`
  for the window that drives it).
- `underwaterFog.js` - ROAD-B B3: UnderwaterFog.UpdateFog, the submerged fog/tint law shared by the dungeon and exterior hosts
- `windowEmission.js` - R2 window emission.
- `precipitation.js` - R13 rain/snow + storm lightning.
- `flatAnimation.js` - FA1 the ANIMATED FLATS: DaggerfallBillboard's
  AnimateBillboard loop verbatim (the wrap test before the draw, the increment
  after it) on a FIXED 1/fps step, the three speeds (general 5, ANIMALS 5,
  LIGHTS 12), and the one arming seam all four static-flat batch sites call so
  the four hosts cannot drift.
- `farRing.js` - EV8 THE FAR PROVINCE RING: the province's mountains
  on the horizon, one vertex per map pixel over woods.heightMapBuffer
  at the streamed terrain's own UN-exaggerated height law, tinted by
  overworldTint, lit by the live sun, faded toward the fog colour with
  a hold so peaks read through haze. Self-contained pass drawn inside
  the world host's sky-to-markForeignPass span (depth untouched - the
  streamed grid repaints everything nearer; the hole in the index
  buffer covers the one case painter's order cannot). Enhanced only;
  `?ring=off`. See `07-Rendering/Enhanced-Visuals-Arc.md`.
- `frustum.js` - EV3 FRUSTUM CULLING, the pure half: Gribb/Hartmann
  planes off the combined proj*view (the handedness mirror rides inside),
  the conservative p-vertex outside test with an offset form for the
  streamed world's pixel-local boxes, and the build-time AABB
  constructors (localAabb, transformedAabb, flatBatchAabb). Hosts:
  world.js (pixel/model/batch grains) and exterior.js (per-drawList-row,
  per-batch); `?cull=off` is the escape hatch. Simulation never gates -
  see `07-Rendering/Enhanced-Visuals-Arc.md`.

AUDIT 18 deleted a `groundMesh.js` bullet from this list: R10 had already
deleted that module, and the bullet tagged it "(ledgered departure)" when
Ledger A has no ground-mesh row of any kind - a citation to a Ledger row
that does not exist, which is the exact 17m shape. The page contradicted
itself further down, where "R10 retired groundMesh.js" already stood.

Milestone log: `07-Rendering/Rendering-Arc.md` (R1 climate swaps,
R2 window emission, R3 city lanterns, R4 painted skies, R5 day/night
cycle, R6 dungeon lighting, R7 dungeon water, R8 interior lights, R9 terrain tilemap shader - all SHIPPED).

AUDIT 2026-07-06: the character-sprite pass renders into ONE fixed
CHAR_SPRITE_RT_SIZE (256) target (viewport sub-rect + UV-extent
sampling) - the per-size reallocating cache is gone (it thrashed
FBO/texture/renderbuffer per character per frame under C8's foes).
Presentation-side, ours (Port-Doctrine); no ledger entry needed.

Owned queue: EMPTY. The spectral row SHIPPED 2026-07-06 under the
classic-visuals direction (Mac): spectral enemies land as billboards,
so the two owed BaseImageFile helpers ported verbatim and the
billboard pass gained emission + a blended spectral phase (180 alpha,
red eyes, V^1.9 body glow) - full record in Characters-Arc E4.
GetFireWallColors32 stays unported until a firewall consumer exists
(a two-line lerp). Live visual sign-off open (Mac). R13 shipped precipitation + verbatim storm
lightning. R10 retired groundMesh.js - all ground
(exterior + terrain) runs the verbatim tilemap shader.

See `Enhanced-Environments-Arc.md` for the Enhanced Environments arc plan (second attempt): its laws, its slices in order, and the gate each one must pass.

`EE9-Surface-Field-Design.md` is the surface field's design - snow that builds, deforms and melts, on the chunker's own grid - written before its code, per the arc's law.
