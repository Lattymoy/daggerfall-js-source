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
- `treeModels.js` - TR1 THE TREES: our partner's leaf-card meshes, one per nature flat, drawn instanced in the classic record's own texture (the billboard's upload) with the billboard's fog and light law, leaning in the grass's wind
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
  height over half a gust) - the two assertions GR2 lacked. **GR4
  (2026-09-02): THE ROOT IS THE GROUND.** RedRoryOTheGlen, in the
  Discord, on Mac's screenshot: "the base of the grass blending into
  the ground and all you can make out are the tips through a gradient -
  reminds me of how the older Novalogic games handled grass." He is
  describing a real technique (ground-colour bleed, in modern terms)
  aimed at the one tell that makes billboard grass read as quads stuck
  on: the hard line where a blade of a fixed colour meets ground of
  another. Our root was a fixed olive. Now a fourth instance attribute
  carries THE GROUND'S OWN COLOUR under each blade, the root is that
  colour darkened as a sward's shade would (the olive arrives by the
  mid), and the alpha fades in from the base so what reads as a blade is
  its upper part. The lab bakes it from its own drawn ground's pixels;
  the game from each TILE RECORD'S MEAN colour, averaged once where the
  texels are already on the CPU for the tile array, and looked up by
  keep's own tile maths so the root takes the colour of the very tile
  keep let it stand on. No ground callback hands back the old olive, so
  a host without one draws GR2's grass unchanged. The shader changed IN
  THE LAB and the game copied it, string for string - the GR1 pin holds.
  Period-correct, as it happens: Daggerfall and Comanche are the same
  year. Seen in the lab before/after; the GAME side is a never-rendered
  path and goes to Mac's eyes by the Incident's law. **GR5 (2026-09-03,
  Mac: "it sometimes hitches and switches while walking, a slight pop
  in/pop out"): THE FIELD IS ANCHORED TO THE WORLD.** Both were one
  design: GR2 placed every blade relative to the EYE from one seed, so
  when the eye moved 60m and the scatter rebuilt, every blade in the
  field moved with it (the switch) and the rebuild's finish uploaded
  all 1.2M blades in one call (the hitch). Now the world is cut into
  30-unit CELLS, each seeded from its own coordinates, so a patch of
  ground grows the same blades whoever is looking; walking fills cells
  at the leading edge and frees them at the trailing one, two a frame,
  inside the range fade. Each cell owns a fixed SLOT in the buffers
  (padded with zero-height blades), so a cell arrives by one
  bufferSubData and leaves by one write of zeros - no repack, no
  whole-field upload, ever. The blade laws are unchanged. Measured
  headless: five metres of walking touches nothing; forty frees one
  edge column of 15 cells and fills the other, of 225 live.
- `systems/wind.js` - **WIND1 (2026-09-02) THE WIND IS ITS OWN THING.**
  Mac: "wind should be something different from the weather. Imagine a
  time-lapse, seeing a storm rolling in as the wind kicks up, and the
  front rolling away as the wind kicks down." Daggerfall has no wind;
  the enhanced sky gave each weather ROW a fixed vector, so every sunny
  day blew alike and a shower and a storm differed only in raindrop
  count. Now a model of its own, in game minutes, with the weather as an
  INFLUENCE: a CALM per day (rolled, drifting over its hours, blended
  in from yesterday's over the morning so a day boundary is never a
  snap); a FRONT at every weather change - Daggerfall's own once-a-day
  cut is the front's arrival, the wind rises over a three-hour lead,
  holds an hour and rolls away over two, its strength the incoming
  weather's violence times a roll, and it turns the wind; and GUSTS
  shaped by the strength, so a storm gusts sharp and often while a
  breeze breathes slow - a shower and a storm, a flurry and a blizzard,
  fall out of the number rather than being cases. It plugs in at WM2b's
  ONE seam - the eased row's `wind` - so the clouds' drift, the ground's
  shadows, the grass, the rain and snow and the windmills all rise with
  the wind before the sky finishes turning; and the sky's own ease
  stretches to the front's lead while one is up, so from the ground the
  wind gets up first and the sky darkens behind it. No shader changed.
  Time-lapse, headless: a sunny evening at 77 on the lab's slider, the
  thunder front at 64 -> 133 -> 200 over three hours, a brisk storm-day
  around 110, and the storm leaving at 114 -> 102 -> 75 -> 60 -> 42 over
  five. ENHANCED ONLY - the classic sky never reaches the row. Not
  seen: no ARENA2 here, and this lights every wind consumer at once, so
  it goes to Mac's eyes by the Incident's law. **WIND2 (AUDIT 56,
  2026-09-03): two faults in WIND1, both mine.** Every cloud consumer
  formed its drift as wind x time, so a wind that moved every frame
  threw the field across the sky at every front - the controller
  integrates one drift now and every deck reads it. And the ease
  stretched only while the front's factor was strictly between 0 and
  1, which is 0 at the change, so the sky turned in fourteen seconds
  and the wind followed - `inLead()` stretches it for the whole lead.
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
