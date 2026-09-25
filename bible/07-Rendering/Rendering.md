# Rendering

Started with World-Arc milestone 1. Presentation is ours per Port-Doctrine;
this section owns renderer specifics.

Current (`src/render/`) - one bullet per module, pinned against the real
directory by `test/audit18_bible_docs.test.js`:
- `deepWatersRender.js` - DW-C: Iliac Puddle No More's own passes (jet082's shaders, term for term): the SEAFLOOR (opaque, unlit, both faces - the depth band's sand/mid/deep ramp, the climate's texture and palette, the night's ambient boost, the scene tint while the camera is over the sea, the world fog, and the column's share of the top's alpha carried onto it), the SURFACE's top and underside (the top gone while the fog's presentation is under, the underside only then), and the DISTANCE FOG's sky share - a far-plane triangle, multiply then add, over the pixels no program fogs (the fog itself is `fogGlsl.js`'s `dwWaterFog`, in every world program); `03-World/Deep-Waters.md`
- `duelWall.js` - DUEL1: the duel ring's holographic wall - a cylinder of light added onto the frame (see-through, no depth written, cut by the ground), a grid and rising bands on the cylinder's own coordinates, fogged as the ground is; drawn for the duellists and every onlooker (net/duelSession.js the ring)
- `gatePass.js` - WB2: the Oblivion Gate's fire and beacon, one foreign pass on the world host. The MEMBRANE: a vortex of fire masked to the arch's own opening (`world/gateModel.js gateArchProfile`, measured off the built mesh), turned without an angle (no branch cut to seam it), premultiplied so it hides what stands behind it as much as it glows - an ember sealed, a blaze open. The BEACON: a column of red light added onto the frame from over the gate's crown, soft across its width, widening with its distance so it never thins to a hair, fogged but never out (`BEACON_FOG_FLOOR`). Both on the duel wall's law - fixed geometry, placement by uniforms, every rate whole cycles over `GATE_CLOCK_PERIOD`. `tools/gatePassProbe.mjs` compiles, links and draws it in a real WebGL2 context.
- `gateTelegraph.js` - WB4a: the Burning Court boss's telegraph, one foreign pass on the world host drawn in the dungeon arm (after the court's billboards, before drawFoes' screen quads). One quad over the court's floor and the attack's shape as the fragment's question - a cone that always holds his body, a disc about him or under each target, the lane his charge runs, the nova's ring, the whole floor - dim at the word, filling toward its edge as the wind-up runs, bright at the landing. `telegraphField` is the shader's own reading in JS, held by the pins to `net/gateStrike.js inAttack` at every point of the floor. The duel wall's law: added onto the frame, no depth written, fogged, a polygon offset off the floor it lies on. `tools/gateTelegraphProbe.mjs` compiles, links and draws it over the court in a real WebGL2 context.
- `gateVeil.js` - WB6c: the step through an Oblivion gate - a vortex of fire over the whole screen, painted per pixel on one triangle on a canvas of its own (`ui/gateVeil.js` holds the canvas, its loop and its sounds): flame arms spiralling into a white-hot eye (log-polar value noise tiled round the circle, so no seam where the angle wraps), pouring inward and turning, embers streaking with them, soot between the arms and a dark throat round the eye. Its inner edge - the FRONT, ragged with tongues of flame - stands where `veilAt` says: closing, from past the corners to past the centre by all its raggedness; shut, the eye breathing; opening, from the centre past the corners. What the fire has not taken is tinted toward the Deadlands' red with the cover. Premultiplied; no pass of the renderer's is touched. `tools/gateVeilProbe.mjs` compiles, links and draws it in a real WebGL2 and steps the real layer through a real page.
- `lightningBolts.js` - BOLT: a ground strike's channel drawn as ribbons of light, never thinner than a line far away, past the far plane along its own sight line (systems/lightning.js the strike)
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
- `contract.js` - HARD3 THE RENDERER'S CONTRACT, types only and no code:
  `BillboardBatch`, `MeshBundle`, `Color32` and `RendererLike`, the shapes
  that cross the boundary between a host and this folder. It exists
  because this is the one boundary in the port where a wrong SHAPE throws
  rather than misbehaves (the Weapon Widget crash), and because the batch
  in particular is written by eight files outside `render/` - its
  `origin`, `sway`, `conceal` and `frame` are the CALLER'S fields and
  until now nothing said so. Exports `{}`, so the bundle never carries it.
- `airPass.js` - EL3 THE AIR PASS: off the frame's own depth (EL6 - a depth
  texture on the frame image; before it a replay of the shadow pass's records
  from the camera), at the resolve: the ambient occlusion the resolve multiplies
  the frame by, the bloom sourced from the emitters (each occluded by that
  depth) and the lanterns' glares, and the sun's shafts; EL4: the frame image
  the whole world draws into, the eye's adaptation off its mean luminance,
  bloom from its bright pass, the vignette, the contrast in display space and
  the dither in the resolve; EL8: two depth textures on the frame image,
  ping-ponged, so the lane's contact shadows (`AIR_CONTACT_GLSL`) march
  through the previous frame's depth; BUGS-5: the march reprojects its
  point first (a surface the previous frame did not see is not marched),
  four steps within seven tenths of a range, the glare's band a quarter
  unit. `?air=off`, `?contact=off`. See
  `07-Rendering/Enhanced-Lighting-Arc.md`.
  HQ1 (2026-09-23): the occlusion is horizon-based (GTAO's arc, two slices,
  six steps a side), no kernel (`Enhanced-Lighting-Arc.md`, HQ1).
- `characterMesh.js` - the voxel character mesh path.
- `characterSprite.js` - the classic-visuals sprite pass (one fixed
  CHAR_SPRITE_RT_SIZE target).
- `bounds.js` - EL5 THE BOUNDS AND THE CULL: a bundle's bounding sphere
  (`boundsOf`, computed at upload for a mesh and each sub-mesh, a terrain
  surface, a billboard batch), the record's world sphere
  (`transformSphere`), the frustum's normalised planes (`spherePlanes`,
  over frustum.js's extraction) and the sphere test the shadow and air
  replays cull by. A leaf: no GL. See `07-Rendering/Enhanced-Lighting-Arc.md`.
  AUDIT 68: `batchSphere` is a billboard batch's lifted sphere, the one home
  batchVisible, shadowReachBatch and the shadow cache's scans all take.
- `billboardKey.js` - AUDIT 68: a billboard batch's texture key
  (`archive_record`, `#frame` for an animated flat), re-minted whenever the
  archive, record or frame moved. The billboard pass, the shadow replay and
  the air pass's emission replay all key through it, so a batch recorded for
  the maps without being drawn (SHADOW-REACH) casts its current frame. A
  leaf: no GL, no imports.
- `cloudShadow.js` - EE5 / VC4 THE CLOUD SHADOW BLOCK: the uniforms and
  the reader (`cloudShadowAt`) that answer how much sun reaches a point
  on the ground, off the map `volumetricClouds.js` writes. Its own leaf
  since VC6c, because a GLSL declaration is visible only inside its own
  compilation unit and TWO passes interpolate it now - every renderer
  program that lights by the sun, and the air pass's shafts, which
  cannot import from the renderer that imports them. No GL, no imports.
  See `07-Rendering/Volumetric-Clouds-Arc.md`.
- `fogGlsl.js` - AUDIT 68 THE FOG BLOCK: `FOG_GLSL`, the one `fogFactorAt`
  every world pass interpolates - renderer.js's seven programs, the water
  surface and the lighting lane's five (DS1's exp2 had been added to nine
  copies). Each shader declares its own fog uniforms; `setFog` feeds them.
  No GL, no imports.
- `glProgram.js` - AUDIT 68 ONE COMPILE AND LINK: `buildProgram(gl, vs, fs,
  label)`, which the renderer's `_buildProgram` and every foreign pass's
  program go through (the sky, the rain, the wisps, the clouds and their
  noise, the far ring, the bolts, Dynamic Skies, the grass, the enhanced
  sky); a fault throws the driver's log, a constructor fault the boot probe
  sees. No imports.
- `shadowPass.js` - EL2 THE SHADOW PASS: records what the world pass draws and
  replays it depth-only from the light at the top of the next frame - a
  two-cascade sun map outdoors, a cube map from the nearest lantern indoors -
  with the receiver block the lane's shaders read (`SHADOW_GLSL`); the depth
  programs are the renderer's own vertex shaders (EL7: three cascades, the
  rigs recorded too, the water surface a receiver; EL8: the caster table
  `uCasterOf`, the far cascade and the far casters on a cadence; BUGS-5:
  the light in the hand never casts (by its `carried` flag - MAC-T1; LIGHT-NEAR1 removed the 1.5 camera-distance proxy that dropped the lamp overhead too), a
  thing on the ground is no standing card (`noShadow`, archive 216, flats
  under half a unit), a cascade skips casters under two of its texels).
  See `07-Rendering/Enhanced-Lighting-Arc.md`.
  SC1 (2026-09-23): the static casters are drawn ONCE - every record classified
  static or dynamic as it is recorded, each caster slot's statics cached in a
  second depth array and blitted under the movers, sticky slots by position,
  `?shadowcache=off` the old path (`Enhanced-Lighting-Arc.md`, SC1).
- `skyRenderer.js` - painted skies (R4) + the night sky.
- `lightClusters.js` - LC1 CLUSTERED LIGHTS (2026-09-23): the frustum cut into
  16 x 9 x 24 cells once a frame on the CPU, each light written into the cells
  its view-space box touches, uploaded as two integer textures (the grid's
  offset and count per cell, the list of indices) that the lane's lantern loop
  reads to walk the fragment's own cell's lights instead of the frame's
  forty-eight. Conservative, and off (every light) in the sprite pass, the
  studio bake, a panel bracket, an overflowed frame and behind `?clusters=off`
  (`Enhanced-Lighting-Arc.md`, LC1).
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
  **GRASS2 (2026-09-18, Mac: "improve grass, improve grass performance,
  and also have it be seen at long ranges... I also want to shorten the
  grass length"): THE FADE IS PAID ON THE HOST.** Measured first, on a
  real GL context through `tools/grassFieldProbe.mjs` (this container has
  no ARENA2, so the field is driven over a synthetic all-grass plane -
  the blade COUNTS are exact and deterministic, the milliseconds are
  SwiftShader's and are never quoted): 46 cells in frustum, 281,612
  blades, **8.45M vertex shader invocations a frame**. The same field at
  range 110 costs 3.31M and shows 2.1% fewer lit pixels - so 61% of the
  vertex work was buying 2% of the grass. The cause: the fade discarded
  blades INSIDE the vertex shader (`gl_Position = vec4(2,2,2,1)`), so a
  blade culled at 180 m cost exactly what one at 5 m cost, and the band
  where that happens is 70% of the field's area. Two changes, and the
  picture does not move (67,833 lit pixels to 67,846). **(1)** The
  fade's threshold is the blade's INDEX rather than a hash of its phase.
  Same distribution - the placer already emits a cell's blades in random
  order, so the first k are a uniform random k - but an index is
  knowable to the HOST, which can then submit only the prefix that can
  survive and decline the rest before they cost anything. The bound is
  taken at the cell's NEAREST corner, so it never cuts a blade the
  shader wanted. **(2)** Cells past half the range bind a ONE-QUAD
  blade instead of the lab's five stacked quads: the five exist so the
  stalk can curve, and at that distance the curve is not resolvable.
  Same instance buffers, same shader, a different vertex array. 30 of
  the 46 cells qualify. Together, like for like at the lab's own 200 m:
  **8.45M to 3.54M, 58% off.** AND WHAT ACTUALLY SHIPS, which is the
  number that matters to a player: the range is 250 m, where the frame
  submits **4.97M** - still 41% under what the old field cost at 200 m,
  while seeing a quarter further. (It submits slightly MORE blades there,
  290k against 282k; the vertices fall anyway because two thirds of the
  cells are on the one-quad blade.) Height is 54 to 38 on Mac's word and
  the tint is pulled toward a low-frequency world-space noise so the
  sward has patches instead of reading as one flat carpet of per-blade
  noise.
  THREE THINGS THIS COST, all caught by pins and probe rather than by
  eye. Widening the span THINNED the grass, because `density` is a count
  over the window and not a rate - `densitySpan` now holds the lab's own
  420 m so blades-a-square-metre is the invariant. The noise variable
  could not be called `patch`: that is a reserved word in GLSL ES 3.00
  and took the whole program down, which is the trap that took the sky
  down at VC6 under the name `flat`. And GR5's own pin caught that the
  new span was not a whole number of cells, so the window's two edges
  floored out of phase and a step that added one column dropped two -
  the lab's 210 was a multiple of the cell by luck, 270 is by intent.
  WHAT IS NOT DONE, and why, so nobody re-derives it: the range stops at
  250 m because the DRAW cost no longer tracks the area but the STORAGE
  still does. Every cell holds near-field density at 48 bytes a blade
  whether it is underfoot or at the horizon - 75 MB of GPU buffer at
  200 m, 106 MB at 250, 169 MB at 320. 320 m is what "long range" really
  wants, and reaching it needs the instance data PACKED (twelve floats a
  blade is mostly byte-sized information) or the far ring stored sparser
  than the near one. Either is its own slice; neither is a reason to
  ship 169 MB quietly. GR1'S LAW IS DEPARTED FROM, on the record: the
  vertex stage is no longer the lab's text byte for byte. It is the
  lab's text plus the named edits, exported as `GRASS2_VS_EDITS` and
  applied by the pin to the lab's own slice before comparing - so a
  change, or an edit nobody declared, still fails. (Three at GRASS2,
  five after GRASS5, four after GRASS6 took the tint back to the placer;
  GRASS-PX laid a second list over both stages, so the fragment stage is
  the lab's under `GRASSPX_FS_EDITS` now - GRASS AUDIT 1 corrected this
  sentence, which had said "three" and "untouched" through all of it.)
  **GRASS4 (2026-09-18): THE PLACER'S COST WAS A STRING.** Opened as a
  sweep of the whole outdoor frame for GRASS2's defect - work submitted
  whose output is discarded - and the frame turned out to be well swept
  already: flats culled by ring and frustum (MAC1, EV3), terrain by
  pixel, the sun's cascades by texel radius (EL8), the lanterns gated to
  17:00-08:00, the AO at half resolution and the bloom at a quarter. The
  one that was left is on the CPU, in the placer: `pieceIndex` answers
  once per blade CANDIDATE - six thousand a cell, two cells a frame
  while the eye walks - and it built a template string for each of them.
  Twelve thousand strings a frame, hashed, looked up and dropped; the
  allocation was the work and the answer never needed it. `pieceKey` is
  `px * 65536 + py` now, injective three orders of magnitude past the
  Daggerfall map, and the placer went from 1.22 ms a cell to 0.40 - 67%
  off, output byte-identical. AND ONE CHANGE MEASURED AND NOT MADE:
  `ground()` repeats `keep()`'s lookup for every kept blade, which looks
  like the same class of waste and is not - caching it across the two
  saves nothing once the key is a number, because the duplicate was only
  ever expensive because of the string. It was written, measured,
  reverted, and `world.js` carries a comment saying so, because the next
  reader will see the duplicate too.
  **GRASS-PATH1 / GRASS-WET1 (2026-09-19): THE PLACER WAS ASKING THE
  WRONG THING.** Mac, two bugs in one breath: "The grass is causing
  issues with dirtroads etc it just overgrows them. Grass shouldnt be on
  dirt paths", and "some textures not taking the water tile ... might be
  because it registers as ground". They are one fault. The placer keeps a
  blade where the tile's RECORD is in `grassRecordsOf`'s set - and the
  record cannot answer either question. A TRACK across grass writes
  10/11/12/51 (`roadPainter.js` TRACK_TILES, the grass column), and those
  are the very records `createLookupTable`'s dirt-grass ring writes for a
  natural field edge, so excluding them by number would have stripped the
  grass off every dirt boundary in the world to clear one path. And the
  WATER-GRASS shore records a stream or a town's own ground tiles write
  (20-22, 49) are mostly-grass by texel count, so `grassRecordsOf` took
  them and blades grew straight up out of the water - a green mottled
  patch in a pond, which is what "not taking the water tile" looks like
  from the ground. Two laws, each asked of the thing that owns it: the
  painter now MARKS the tiles it writes (`opts.paths`, one byte a tile,
  set at the moment of the write - it is the only thing that knows), and
  the water question goes to `waterCorners.js`, the one table the water
  pass and the player's feet already read. No blade stands on a painted
  tile, and none stands on a tile with ANY corner in water. **The lesson:
  the record was never the question. It had been answering a THIRD one -
  "what does this tile look like" - and two different callers had been
  reading that as "is it a path" and "is it dry" for as long as the
  field has existed.**
  **PERF10 (2026-09-19): THE WINDOW WAS A SQUARE AND THE DRAW WAS A
  DISC.** Mac: "when youre further out in the wilderniss it loaded many
  chunks and grass the performance still degrades." Three costs, all
  paid for nothing. `createGrassField` filled the SQUARE
  [eye - span, eye + span], and PERF2's draw skips any cell whose nearest
  point is past `range` - so the square's corners, out at 445 m against a
  300 m fade, were placed (6,122 `keep()` lookups apiece), packed,
  uploaded and then skipped every frame of their life: 484 slots of which
  92 could never draw a fragment. A cell is filled inside `range` and
  held out to `span` now - the same hysteresis the square had along its
  axes, so nothing churns while the eye stands still - and the field is
  392 slots, 8.6 MB less held on the GPU, with the world's first fill 360
  cells rather than 484. Second: the `live` map was keyed by
  `${cx},${cz}` and the free sweep ran `key.split(',').map(Number)` over
  every live cell EVERY frame - four hundred odd string splits, arrays
  and boxed numbers a frame to decide that nothing had moved. GRASS4's
  own lesson one level up: the key is a number and cx/cz ride the entry.
  Third, and the one that actually grows with "many chunks": the host
  spread every streamed pixel into an array, mapped it into a second one
  and built a `pieceIndex` Map over it every frame, whether or not the
  field had a cell to place - and `keep`/`ground` are called ONLY from
  `placeLabGrassCell`. One lazy memo a frame: a frame that fills nothing
  now allocates nothing. Not one blade changes where it stands.
  **The lesson: GR5's cell budget made the FILL cheap and nobody went
  back to ask whether the frame was still paying to decide what to fill.**
  **GRASS-PX (2026-09-21, Mac: "with the grass model, is there a way we
  can turn the grass into a pixel art design ... Let's see how detailed
  you can be"): THE TUFT IS A SPRITE, AS EVERY OTHER LIVING THING IN
  THIS WORLD IS.** Daggerfall draws its trees, its people and its
  monsters as hand-set flats, and the lab's million smooth, tapered,
  gradient-lit blades were the one thing outdoors not drawn by that
  hand. The pixel style keeps the WHOLE of the field - the placer, the
  packed lanes, the cells, the host-paid fade, the wind, the time of day
  - and changes what a blade LOOKS like, in five places, each a
  `mix(lab, pixel, uPixel)` or a branch on it so that at zero the
  arithmetic is the lab's to the last operation: the quad wears a
  16x32 tuft (8x16 since GRASS-PX4, below) from a sheet of eight (built at boot from a seed in
  `render/grassPixelArt.js` - three to five one-texel stalks curving as
  height squared, the lab's own bend law; a two-texel base on half of
  them; a seed head on a tall one now and then; alpha 0 or 255 and never
  between); the sprite's four tones - root, mid, tip, and ONE highlight
  texel at the tip of a blade tall enough to clear the sward - stand in
  for the gradient, with the sun's rim landing on that one texel as a
  whole step of light; the sway reads a clock stepped at 8 Hz and a
  lean snapped to 24 steps, so a gust hops through poses; the distance
  fade is a 4x4 ORDERED DITHER against the screen (the Bayer matrix as
  four bit operations, evaluated from the shader text by the pin) rather
  than a transparency; and the lit colour is snapped to an eight-step
  luminance ramp with the patch tint in four bands - hue kept, so a dusk
  field is still the colour of dusk. The texel carries three things
  beside its tone: how far up ITS OWN blade it sits (the root-to-tip
  light and the sward shade read that, not the quad), and which blade
  of the tuft it is (the blades of one tuft shade apart). THE MIP CHAIN
  IS COVERAGE, NOT AN AVERAGE: a sprite that is a quarter blade and
  three-quarters air averages under a half at the first level and an
  alpha test throws the whole tuft away, so every level takes the MAX
  alpha of its block and the tone that carried it, uploaded by hand
  down to 1x1 (a chain that stops short is an incomplete texture, which
  samples black). Both styles live in ONE program and the row flips a
  uniform, so `Grass style` (Pixel by default, Smooth the lab's blade)
  takes effect at once, read every frame at the draw. Measured on the
  probe's real GL: the pixel field takes 62 distinct colours where the
  gradient field took 4,300, 771 blade texels reach the GPU with zero
  soft-alpha texels (GRASS AUDIT 1: this line first said 806, which was
  never what the probe printed), both stages compile and draw through
  SwiftShader.
  8 pins in test/grasspx.test.js (the sheet byte for byte and hard-
  edged, the tone law's round trip through the shader's decode, the
  stalk laws over 200 seeds, the chain's coverage at every level, the
  two edit lists each landing exactly once with the lab's text untouched,
  the shader audit over the game's stages, the Bayer form evaluated, the
  renderer's uploads on a stub GL, the row and the host); 20 mutants,
  20 dead. **The lesson: a style is not a second renderer. The lab's
  field is the field; what the eye is shown is a handful of declared
  edits over it, and the pin that held the lab's text byte for byte now
  holds the departures the same way.**
  **GRASS-PX2 + GRASS6 (2026-09-21, Mac: "would it help performance?"
  "Do it"): THE TWO BAKES THAT PAY.** Baking the SWAY would not have: it
  is one sine per vertex, and every vertex is transformed every frame
  whatever pose it holds. What the probe's shipped frame actually spends
  is 6.8M vertex invocations, and two things in each were work for a
  constant. **GRASS-PX2**: the lab's near blade is five stacked quads so
  that it can curve, and the pixel style's sprite carries its own curve
  - so in the pixel style every cell binds the one-quad array the far
  cells already use. The near cells are 30 of 98 slots and hold most of
  the blades that survive the fade, so the pixel frame goes from 6.80M
  vertices to 2.39M, 65% off, same picture (69,607 green px against
  69,768 before - GRASS AUDIT 1 corrected a 70,785 here that matched no
  frame - the tuft on a straight tilted quad rather than a bent one). **GRASS6**: GRASS2's clump - two value noises in the scene's
  floating-origin frame (GRASS AUDIT 1: "world space" was the word here
  and in the code, and it is not; the origin is a corner of the player's
  map pixel and the whole field, patches with it, is re-placed at every
  crossing - the GPU read the same frame, so nothing moved) pulling the
  tint toward its neighbours', the thing that makes a field read as
  patches - was in the VERTEX stage, evaluated on every vertex of a
  blade every frame (thirty in the smooth style, six in the shipped
  pixel one), eight hashes and their blends each time, for a value that
  is a function of the root's position and nothing else. It is the placer's now, once a blade at placement,
  riding the tint lane the pack already had; the vertex stage compiles
  the lab's OWN `vTint = aInst2.z;` again and GRASS2's edit list is four,
  not five. The noise is the prelude's term for term in doubles rather
  than floats, so the patches are the same shape at the same scales and
  not the same bits - and nothing held the bits. This one applies to
  Smooth too. 2 pins (test/grasspx.test.js: a near cell is five quads
  in smooth and one in pixel, on the slot rig, and the style is read
  every draw; test/labGrass.test.js: the lab's tint line back, no noise
  in the body, the twin's constants against the prelude's, the noise's
  range and continuity, and the placer's first blade carrying exactly
  the pulled tint with the random stream undisturbed); 8 mutants, 8
  dead, GRASS2's tint mutant re-aimed at the placer. **The lesson: the
  vertex stage is the wrong place for anything that is the same number
  every frame - and the sway, the thing that LOOKS like the work, is
  the cheapest term in it.**
  **GRASS-PX3 (2026-09-21, Mac: "I miss the way the grass flowed with
  the wind smoothly"): THE SWAY IS THE LAB'S AGAIN.** GRASS-PX stepped the
  pixel style's clock at 8 Hz and snapped its lean to 24 poses, on the
  argument that a hand-animated flat hops through frames. Mac's eye said
  otherwise, and the eye is right: the wind is the one thing in the
  field that should never look drawn frame by frame - a sprite can be a
  sprite and still move like grass. The two edits, their two uniforms
  and their two constants are gone; the pixel style's edit list is four,
  and the pin holds the whole sway block of the compiled vertex stage
  byte-identical to the lab's. Nothing else about the tuft moved.
  **GRASS-PX4 (2026-09-22, Mac: "have grass have larger pixels"): THE
  TUFT IS 8x16.** A tuft's texel is the thing the eye reads as a pixel,
  and the quad is sized off the blade's drawn height (GRASS AUDIT 1 F2:
  width is half the height, per blade), so a texel's size on screen is
  the height over sixteen now where it was the height over thirty-two -
  every pixel twice as tall and twice as wide, a quarter as many a
  tuft. The change is the sheet's size and nothing else: the shader is
  byte-identical (the pin still holds the four-edit vertex stage and
  the fragment stage's texel snap against the lab's text), the quad,
  the placer, the mip chain and the tones are untouched. What HAD to
  move was every law written as a texel count for a 16x32 tuft - a
  two-texel margin, a blade at least eight tall, the highlight on a
  blade of twenty or more, the lean up to six columns - and each is a
  FRACTION of the tuft now (`PX_TUFT_MARGIN`, `PX_BLADE_MIN`,
  `PX_HIGHLIGHT_MIN`, the lean scaled by w/16), so the 16x32 sheet
  still builds through `buildTuftSheet({ w: 16, h: 32 })` and
  `LabGrassRenderer`'s `tuft` option, and the pins hold the old size's
  laws through that door beside the new one. The 8x16 sheet covers 32%
  of its texels where the 16x32 covered 20% (a one-texel stalk is a
  larger share of a smaller tuft); the coverage chain is seven levels
  to 1x1. Measured on the probe's GL, same field, same style, the old
  sheet beside the new: 66 colour edges a row in the near band against
  100, 61,072 green pixels in 66 colours against 44,623 in 65 - the
  field reads the same and its pixels are larger. Two probe checks and
  two screenshots (tools/shots/grasspx4-old-16x32.png and -new-8x16);
  the six size-bound pins rewritten to the fractions; 39 mutants, 39
  dead (the renderer-constructor record re-aimed at the `tuft` door).
  **AUDIT GRASS-PX4 (same day, Mac: "Audit before merging"): ONE LENS
  OVER THE SHEET, SEVEN FINDINGS, FOUR PAID.** (F1) `paintTuft` carried a
  SECOND copy of the highlight threshold's formula, and a sheet built
  from a copy is pinned by neither: `h * 21 / 32` in that copy survived
  every pin and took the highlight off three of the shipped tufts. The
  three laws are ONE function each now (`tuftMarginFor`, `bladeMinFor`,
  `highlightMinFor`), read by the constants and by layTuft/paintTuft
  alike, and the shipped sheet's highlight count (39 texels) is pinned
  beside the 19/20 and 9/10 edges through paintTuft. (F2) The "shortest
  blade" clamp NEVER FIRED - the height law's own floor, floor(0.45 h),
  is above it at both sizes, so `PX_BLADE_MIN` described a law the sheet
  never exercised (and had since 16x32). The clamp is gone and the
  constant is the law's floor (7 of 16, 14 of 32), with a pin that a
  blade reaches it and none goes under, over 3000 seeds. (F3) "No tuft
  on its edge column" was a property of the eight shipped seeds, not of
  the code: the seed head is two texels wide to the tip's RIGHT, and a
  headed tip one column short of the edge painted the edge column on
  6% of tufts at 8x16 (3% at 16x32) - a reseed or a ninth variant would
  have failed the pin. A headed blade's lean is clamped one column
  further in, the way the tip already was; pinned over 3000 seeds at
  both sizes, column 0 and column w-1 empty. (F4) `layTuft` recomputed
  the margin instead of reading the constant - same fix as F1. The
  16x32 door still reproduces the OLD sheet byte for byte (the lens
  compared it against HEAD~1's module: 128x32 and every mip level, 0
  bytes differ), because none of the shipped old seeds had a head at
  the edge. Noted, not paid: the head, the base and the two-row
  highlight are texel-sized and so relatively larger at 8x16 (a quarter
  of the width where they were an eighth) - consistent with "a texel is
  a pixel", but "the sheet's size and nothing else" overstated it; the
  lean scale `(w / 16)` and `(h / 32)` are indistinguishable while a
  tuft is 1:2. Eight mutants added (the three thresholds, the head at
  the edge, the margin twice, the floor and the height law drifting
  apart).
  **GRASS AUDIT 1 (2026-09-21, Mac: "do an audit on this"): THREE
  LENSES OVER THE PIXEL GRASS, TWENTY FINDINGS, ALL PAID.** The sheet
  and the fragment stage; the vertex stage, the draw path and the
  settings wiring; the clump bake, the pin re-aims and the records. What
  the picture was actually doing, measured on the probe's GL with the
  lenses' own frames: (1) THE RAMP WAS BLACK. Eight linear luminance
  steps put the first rung at 1/16, and a lit blade lives under 0.4 by
  day and under 0.05 at night or in rain, so the mid and root tones -
  three quarters of every tuft - went to exact (0,0,0) after dark (44%
  of the field's pixels at night, 64% in a thunderstorm, opaque, over a
  ground still lit at 0.25) and a moonlit midnight mid tone came out the
  same 25,39,14 as clear noon: WIND4's bug, re-made in the default
  style. The steps are taken in gamma space now and the lowest rung is
  the first step; the pin evaluates the rung out of the shader text.
  (2) THE WIDTH IGNORED THE HEIGHT. The tuft was three blade-widths
  wide whatever its height, and the placer draws the two independently,
  so texels were squashed 0.46x..2.36x blade to blade and a buried blade
  was a flat opaque bar; the width is half the DRAWN height now, per
  blade. (3) THE MIP CHAIN WAS A WALL. Max-alpha per block took the
  sheet from 19% covered to 88% by level 3 and 100% from level 4, of the
  ROOT tone (the tie-break took the lowest row), so the far field was
  solid dark blocks - and the pin REQUIRED coverage to grow. The chain
  preserves the base coverage now (the alpha-test mip law), each block
  toned by its highest covered texel, one texel per tuft floored; a far
  tuft is as dense as a near one and reads as its tips. (4) THE TINT
  BAND TRUNCATED: floor(x*4)/4 never reached 1 and dragged the mean 5%
  dark, clipping the bright patches GRASS6 had just baked; it rounds to
  band centres now. (5) THE RIM HAD NOWHERE TO LAND: twelve highlight
  texels in 771, half of them under the blade's own seed head; the head
  paints first and the highlight is the top two texels of a tall blade
  (40 now). (6) THE SPRITE WAS THE GUST PHASE: the variant came off the
  phase lane, so every tuft of one sprite hopped in unison; it is a
  hash of the root now. (7) ONE TUFT PER BLADE WAS FOUR TIMES THE
  SWARD: the pixel style submits half of each cell (a third read sparse
  at the feet), the fade fraction over that half. (8) The lab-scatter
  path ignored the one-quad switch; (9) the sheet was bound on unit 4
  in the smooth style too; (10) the row did not say what it is inert
  without (FT7's law); (11) `__grassStats.verts` named the near blade in
  a pixel frame; (12) the bake was paid before keep() decided, so a road
  cell paid 0.43 ms of noise for candidates it threw away - and the
  record had called the bake a pure win when it is +0.56 ms a cell on
  the placer against the GPU's saving; (13) hash(0,0) is exactly 0 in
  the prelude and the twin alike, so both octaves bottomed out at the
  scene origin and a patch 25 m across sat 11% darker at a corner of the
  player's map pixel (GRASS2 had it too) - the sample is off the lattice
  corner now; (14) the u8 tint lane - the tint's ONLY carrier since
  GRASS6 - had never had a packed byte read back, and a mutant that
  wrote every blade the same tint survived the suite; (15) three GRASS6
  mutants died to a source regex where the bilinear, the smoothstep and
  the second octave could each be executed, and two more (the corners
  transposed, the second axis blended by the first fade) survived
  outright; (16) the records: 806 blade texels was never measured, 70,785
  matched no frame, "world space" was the wrong frame, "thirty vertices"
  was five times the shipped figure, the pin's own title still said
  "five edits" and the record said "three" and "untouched" through all of
  it; (17) a pin assertion was `false !== 0` waiting for a 32-texel
  blade. AND ONE THE FIXES FOUND: gating the step-count uniforms behind
  the pixel style set them to zero in smooth, a divide by zero in the
  pixel arm, and mix(lab, NaN, 0) is NaN - the whole field vanished, and
  only the probe's picture said so. The counts go up in every style; only
  the sheet's bind is the pixel style's. THE EXECUTED PINS THE LENSES
  ASKED FOR, all on the probe's readback: the smooth style drawn beside
  the LAB's own program over the same field is byte-identical (the
  renderer takes its stages, the probe hands it the lab's); zero exact
  black by day, at night and in a storm; the pixel field within 20% of
  the smooth one's brightness by day and at night (with a night sky, or
  the smooth blades' translucent bases let a noon sky through); night
  darker than day; the nearest band's highest grass pixel brighter than
  its lowest, so the sheet is the right way up; the field no denser
  than the smooth one, and the band under the horizon no denser (68.5%
  against 87.0%, where the wall had been 97.5% against 88.4%); and the
  dither's Bayer-rank histogram monotone at range 60 and flat at 300.
  The shipped pixel frame is 1.20M vertices now, 82% under the smooth
  6.80M; 66 colours against 4,255; 771 texels, zero soft. 38 mutants in
  grasspx.json and 13 in grass6.json, all dead; 22 probe checks. **The
  lesson: a text pin proves a line was typed; only a picture proves it
  draws. Two of the three worst findings (the black ramp, the wall) were
  lines the pins held exactly, and the one bug the fixes introduced was
  invisible to every pin and loud on the first readback.**
  **DISC20-A (2026-09-24, Mac: "Grass isnt affected by fog"): THE BLADES
  TAKE THE GROUND'S FOG.** The lab's program had no fog term, GR1 carried
  it byte for byte, and the renderer's fog reaches only its own programs,
  so under every fog row the ground takes the field was drawn out to its
  300 m fade, dimmed but never fogged: in heavy fog the ground is the
  fog's colour past 60 m and the grass stood out of it to 165. A THIRD
  EDIT LIST, `GRASSFOG_VS_EDITS`/`GRASSFOG_FS_EDITS`, laid after the pixel
  style's (so the fog is not snapped to a ramp step): the vertex hands
  down its world point, the fragment blends to the fog colour by the
  terrain's own `fogFactorAt` (`FOG_FACTOR_GLSL`, TERRAIN_FS's text
  verbatim, pinned equal to it), the renderer uploads the five fog
  uniforms from `light.fog` (mode 0 - the lab's picture - when a host
  hands none), and `world.js` hands the fog the ground took this frame
  from the view's own eye. The fragment stage is the lab's under
  `GRASSPX_FS_EDITS` then `GRASSFOG_FS_EDITS`; run through `test/glsl.mjs`
  in both styles, no fog is the old picture to the bit and each fog mode
  is exactly the terrain's blend (`test/disc20.test.js`).
- `grassPixelArt.js` - GRASS-PX THE TUFT SHEET: eight 8x16 tufts (GRASS-PX4; 16x32 until 2026-09-22, and the laws are written as fractions of the tuft so the old size still builds through `buildTuftSheet({ w, h })`) built at boot from a seed (one-texel stalks bending as height squared, four tones with one highlight texel, alpha 0 or 255), their coverage mip chain (max alpha per block, never an average, down to 1x1), the pixel style's numbers (8 Hz sway, 24 lean steps, 3x tuft width, 8-step ramp, 4 tint bands) and `pixelGrass()`, the row's word; the shader edits themselves are `GRASSPX_VS_EDITS` / `GRASSPX_FS_EDITS` in labGrass.js.
- `spoilsGlow.js` - WB5: a fallen boss's spoils at rest, each in a BEAM of its tier's colour rising from a HALO on the floor (Loot Rarity's own colours - the first place a rarity is drawn in the world), a Legendary's and an Artifact's taller and pulsing. One foreign pass drawn beside the Burning Court's telegraph (the same seam), on the duel wall's law: fixed geometry placed by uniforms, added onto the frame, no depth written, fogged.
- `deadlands.js` - WB6a: the Deadlands round the Burning Court - THE SKY, painted per pixel on one triangle at the far plane (a churning overcast lit from below; Oblivion's VORTEX over the great tower, turning whole and pouring inward; the BEAM up into its eye; black Daedric TOWERS with horns and a crown; three rings of JAGGED RIDGES hazier the further, with falls of fire; seeded LIGHTNING in the deck), and THE SEA, a disc of moving fire (crust plates on molten channels, glowing cracks, a slow pulse) whose rim becomes exactly the sky's horizon, so no edge is ever seen. One foreign pass in the dungeon arm after the court's solid geometry and before its flats (PERF2's law: the sea depth-tested, the sky tested at the far plane and never written); and the court's own light (`courtLighting` - a trilight red above and fire-orange below, the vortex's key light from behind the boss). WB6b: THE AIR'S LIFE (`drawLife`, after the telegraph in the court's pass - one vertex a mote: embers off the sea from past the court's edge and off its braziers, turning with the drift of the air, and ash falling through it; depth-tested and never written, the ash laid over premultiplied and the embers added; the world image's own height sizes the motes, RETRO1's `worldViewportPx` as the bolts read it); a strike LIGHTS THE COURT (`courtLighting(flash)`: the trilight's sky flares and the key swings toward it); `flashOfSlot`, the one answer the sky's flash and the thunder (scenes/deadlandsAir.js) read, on slots whole over the period; and the hosts hand the relay's clock (world.js `deadlandsSeconds`), so it is one moment on every screen. The land and the floor's shards round the court are court draws, not this pass (world/deadlandsLand.js, stood by worldModes' `standDeadlands`).
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
- `systems/windDrive.js`, `render/windWisps.js`, `systems/windAudio.js`,
  the flats' sway in `render/renderer.js` - **WIND3 (2026-09-14) THE WIND
  SEEN AND HEARD.** Mac: "World space wisps that indicate the direction
  of wind and wind audio without being too loud or overbearing; tree and
  flora sprite movement with wind." Three consumers at once, and the
  root first: the wind→units mapping (the lab's slider, the rate in
  metres a second, the unit direction, the gust, the travel integrated
  over the frame) stood written out three times in the hosts - twice for
  the rain and once for the grass, the rain still on the fixed three-sine
  gust WIND1 had replaced - and a fourth, fifth and sixth copy is the
  fault WW2 had just closed on the motion bag. `windDrive(sky, tsec, dt)`
  is the ONE home now, read once a frame by each exterior host (`wd`),
  and the rain, the grass, the wisps, the loop and the flats take its
  numbers by construction (the rain gained WIND1's gust in the move).
  THE WISPS: faint streaks of air stretched along the wind's velocity,
  born and gone on their own phase, in a 90 m box that follows the eye
  and wraps by the lab's law, travelling by the integrated step (never
  wind x time); their count (2,400 at a gale, a twelfth of that as the
  floor so the direction stays readable in a calm) and their alpha
  follow the strength. Drawn after the rain as a foreign pass, no depth
  write, unfogged. THE LOOP: one named loop ('wind', the riding loop's
  shape - a clip swapped at its end, never restarted) on DAGGER.SND's own
  wind clips, which DFU draws only as dungeon one-shots - the moan under
  0.62 of the strength, the blow from there; the gain is a smoothstep of
  the strength breathing with the gust, slew-limited so a front is a
  rise and a gust never pops, and capped at 0.18 - "not too loud" as a
  pinned number. Not AmbientEffects (DFU's player, bug for bug, stays
  so): ticked beside it on the exterior frame and STOPPED on every modal
  frame, as the mills' hum is - the port's own sounds fall silent
  indoors. THE SWAY: BB_VS takes the wind (`uFlatWind`, one upload a
  call) and a share per batch (`uSway`, uploaded when it changes), and
  leans the quad by the grass's own wave - the lab's 1.7 / -along*0.35
  gust running across the field, the 0.55/0.75 push - weighted by the
  square of the height up the quad so the root stands and the crown
  moves, scaled to a trunk (a few percent of the height at a gale). Only
  the climate's nature archive is tagged (`floraSwayOf`: a tree whole, a
  bush six tenths; people, lights, signs, foes and every indoor flat 0),
  which is the shader's off switch, so an interior or a dungeon that
  never sets the wind draws as before. Three rows on the Features home
  (`wind-wisps`, `wind-sound`, `flora-sway`; on by default, the player's
  own online), read every frame; `?wisps=off`, `?windaudio=off`,
  `?sway=off` the kill doors. ENHANCED ONLY: under the classic sky the
  mapping answers nothing and nothing moves, blows or sounds. Not seen:
  no ARENA2 here - the wisps' size and alpha, the loop's ceiling and the
  sway's amplitude go to Mac's eyes and ears by the Incident's law.
  `test/wind3_windworld.test.js`.
- `systems/weatherFront.js` - **WX2 (2026-09-03) THE FRONT REACHES THE
  GROUND.** Mac: "Instead of rain/snow starting and stopping immediately,
  I want it to fade in and out slowly, how the grass prototype handles
  it... snow and rain shouldn't always be a downpour. It can sprinkle, or
  lightly snow." The tree's state before it: the sim cuts its word
  between two ticks (Daggerfall's law, untouched), the enhanced sky eases
  toward the new row over WIND1's three-hour lead - and everything UNDER
  the sky snapped on the frame of the cut: all 26,000 drops, the sun
  scale (x0.45), the fog row, the grass dim and the rain loop, a quarter
  of an hour before the deck had darkened. The Enhanced-Environments arc
  had recorded the lab's front as "not ported" because the sky eased;
  that was true of the sky alone. Now the GROUND crosses on the same
  front: the wind model answers `arrival()` - 0 at the cut, 1 when the
  front lands and 1 from then on (unlike frontProgress, which falls as
  the WIND leaves while the weather stays) - and the hosts blend the sun
  scale, the fog row and the grass dim from what was ON SCREEN at the
  cut toward the incoming weather's on it (a second cut mid-front starts
  from the half-crossed value; a fog row that changes mode switches at
  the midpoint, under a deck already half turned). The DROPS are the
  lab's own law, `Math.round(wx.n * wsky.fall)`: the renderer's count is
  the profile times an intensity the front walks - filling in over the
  arrival's last stretch (0.55..0.95), so the rain starts when the sky
  already looks like rain, and thinning out over the first (0.15..0.60)
  when the incoming weather has none, so a sunny word tapers the rain
  under a sky still opening rather than stopping it dead. A change of
  kind (rain to snow) drains the old before the new fills; rain into
  storm walks the peak across with no gap; a twelve-second smoothing
  rides on top so a jump in the clock never steps the count. THE
  EPISODE: every precipitating cut rolls a PEAK from its mode's range -
  rain 0.25..1.0 (a sprinkle to a downpour), storm 0.6..1.0, snow
  0.2..0.85 - seeded on the cut's minute as WIND1 seeds its front, and
  the intensity WANDERS under the peak (0.6..1.0 on two slow periods) so
  a shower is never one number for an hour. The ear follows what FALLS:
  the rain loop's gain is the intensity (a `setVolume` on the engine's
  loop handle, `rainGain` on AmbientEffects) and its preset is the shown
  mode - a rain word with nothing down yet is a cloudy day; the outgoing
  rain keeps its loop while it tapers. ENHANCED ONLY and a recorded
  departure (Port-Ledger WX2): the classic path takes the row's numbers
  whole, draws DFU's cap, and never reads the module; the lab's shaders
  are untouched (WX1's byte-exact pins hold - the fade is in the count,
  not the fragment). Not seen: no ARENA2 here; it goes to Mac's eyes by
  the Incident's law, with `?wseed` replaying a day's rolls. `?front=off`
  is the slice's kill switch: the row's numbers whole and DFU's cap on
  the cut under the enhanced sky, for gates and shots that want WX1's
  volume. **WX2a (AUDIT 57, 2026-09-03): five findings in WX2, all
  mine.** F1 the storm's FLASH began at the sim's cut - the player was
  built there - and lit a sky that was still mostly clear for the whole
  three-hour lead, then went on after the storm had cleared while the
  last drops drained; the thunder one-shots already followed the shown
  mode through the ambience preset, and the flash follows the same word
  now (the player still ticks every frame on both skins). F2 the slice
  had no kill switch where every slice in the arc has one: `?front=off`.
  F3 THE PLAYER ARRIVING IS NOT THE WEATHER ARRIVING: WIND1 built a
  three-hour front at every change of the word, and DFU's own paths hand
  it changes the player was not present for - a load, a fast-travel
  landing, a teleport's respawn roll, a day's roll drained on the first
  frame back out of a dungeon. WX2 made the cost visible: a rainy save
  loaded dry for a quarter of an hour. The sim stamps those (a load
  always; a landing, a respawn roll and a drain more than thirty minutes
  after its roll when they change the word; a LIVE day roll never), the
  hosts read the stamp once a frame, the controller drops its eased row
  (the first-call law takes the new one whole) and the wind its front,
  and the ground takes the word whole - no crossing, no taper, the drops
  down on the frame. A live roll under the sky is still a front. F4 the
  WX2 record claimed `?wseed` replays a day's rolls; it reached the sky's
  Rain1/Rain2 pick and the episode's peak and never the wind's own roll -
  the controller seeds the wind model from it now. F5 the record's
  numbers were not pinned to the module's - the ranges and the windows
  quoted here and in the Ledger row are held against PRECIP_PEAK,
  PRECIP_IN and PRECIP_OUT. Sound under the lanes walked: the tick order
  (the front reads the model one frame behind the sky, and the jump is
  told to the sky first); the classic path byte-identical in every term;
  WX1's byte-exact shaders untouched; both hosts wired alike; `?weather=`
  still pins the sim and a pinned boot is never a front; the stub audio
  handles. Still unseen: all of it, in a browser, with ARENA2.
- `enhancedLighting.js` - EL1 THE ENHANCED LIGHTING LANE: five fragment shaders
  (mesh, billboard, terrain, character, far ring) the renderer installs as a
  unit over its classic set - sRGB decode, linear light, windowed inverse-square
  lanterns x48, exposure + extended Reinhard, fog in-scatter, sRGB encode - and
  the pure functions that ARE their terms; the switch (`enhancedLightingOn`),
  the host's one call (`syncLightingLane`), the flame colour. See
  `07-Rendering/Enhanced-Lighting-Arc.md`.
- `enhancedSky.js` - ES1 the ENHANCED SKY: one fullscreen procedural
- `dynamicSkiesRenderer.js` - DS1: Dynamic Skies' own skybox (BLBProceduralSkybox, translated line for line), the enhanced lane's sky while the vendored mod's switch is on; the same draw contract as `enhancedSky.js`.
- `dynamicSkiesBridge.js` - DS2: the mod's state in the port's shapes - `dynamicMoonState` (the world's moonlight off the mod's orbits, DS1) and `cloudsStateUnderMod` (the volumetric clouds' six fields off the mod's sun, moons and horizon over the port's colours); one home the controller and the sky lab both import.
  pass, no textures and no game data - a palette record keyed by the
  sun's elevation, the port's own sun arc, DFU's lunar phases placing
  the two moons, stars and weather-driven clouds. Behind the enhanced
  skin (`?sky=classic` opts back to the painted pass); the classic pass
  above is untouched. Its lab is `sky.html` + `src/tools/skyLab.js`,
  its eye `tools/enhancedSkyProbe.mjs`.
- `waterSurface.js` - WATER1 THE WATER SURFACE: the enhanced pass over the
  exterior water tiles - the terrain grid drawn again and lifted, the
  water-corner table that inverts the marching squares, the swell, foam, Fresnel,
  glint and rain shader (`drawWaterSurface` in renderer.js), drawn after
  every opaque pass of a pixel and before the first flat, in both exterior
  hosts. Switch `enhancedWater`, `?water=off`. `07-Rendering/Water-Arc.md`.
- `underwaterFog.js` - ROAD-B B3: UnderwaterFog.UpdateFog, the submerged fog/tint law shared by the dungeon and exterior hosts
- `windowEmission.js` - R2 window emission.
- `precipitation.js` - R13 rain/snow + storm lightning. TWO PROFILES,
  TWO PROGRAMS (AUDIT 58 f3/render): the classic pass is DFU's cap on
  its own shader, byte for byte as it stood before EE8, and the
  enhanced lane is WX1's lab program, entered on `draw()`'s first
  line. EE8's mixed `uEnh` arms - unreachable from the day WX1 landed
  - and the 26,000-particle buffer they sized are gone; the lab's
  program is built for the lane that draws it (`sky.enhanced`, at
  construction), never on the classic skin.
- `flatAnimation.js` - FA1 the ANIMATED FLATS: DaggerfallBillboard's
  AnimateBillboard loop verbatim (the wrap test before the draw, the increment
  after it) on a FIXED 1/fps step, the three speeds (general 5, ANIMALS 5,
  LIGHTS 12), and the one arming seam all four static-flat batch sites call so
  the four hosts cannot drift.
- `windWisps.js` - WIND3 THE WISPS: the wind, seen - faint streaks of air
  stretched along the wind's velocity in a box that follows the eye and
  wraps by the lab's law, travelling by the one integrated step, their
  count and alpha the wind's strength. A sibling of the rain's program,
  drawn after it as a foreign pass; the `wind-wisps` row, `?wisps=off`.
  The record is WIND3 under `systems/wind.js` below.
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
- `staticBatch.js` - PERF4 STATIC BATCHES PER PIXEL: a streamed pixel's static RMB
  models merged once at build time into one mesh grouped by resolved texture, one
  draw call per texture instead of one per sub-mesh per model; the gates and the
  mills stay individual draws (test/perf4.test.js).
- `renderTarget.js` (EL4: also the FRAME TARGET every pass restores to - the canvas, or the lane's frame image) - VC2 THE RENDER TARGET: a 2D colour target and a 3D
  volume, creation under the upload law (it sizes, parameterises and binds
  no framebuffer), the framebuffer work on named DRAW paths that leave the
  default framebuffer and the caller's viewport behind and never ask GL.
- `cloudNoise.js` - VC2 THE CLOUD NOISE: a 128^3 shape volume (Perlin-Worley
  + Worley at 8/16/32) and a 32^3 detail volume (Worley at 4/8/16), tiling on
  every axis, generated on the GPU one layer per draw; the lab's slice viewer
  (`?noise=`) behind tools/cloudNoiseProbe.mjs.
- `warmPrograms.js` - PERF-WARM THE COMPILE THAT NO LONGER HAPPENS MID-FRAME:
  the idle driver for the programs a renderer builds ON DEMAND. Five of
  renderer.js's were compiled inside a draw call (the particle effects' on the
  first spell, the character-sprite quad's on the first classic sprite, the
  screen quad's, the instanced screen quad's and the overlay's), and a
  compile-and-link is a DRIVER stall of tens of milliseconds that nothing here
  can make cheaper - only MOVE. `renderer.warmSteps()` names them, one step
  each; this walks them behind `requestIdleCallback`, one per callback, the
  shape `ui/enhancedChunk.js` settled on and for the same reason. Both exterior
  hosts add the rain's whole renderer to the walk. A leaf: no renderer type,
  no lane, no GL.
- `perfMeter.js` - EL8 THE PERF READOUT: `?perf` - the frame's GPU time on
  `EXT_disjoint_timer_query_webgl2` and the lane's counts, one console line
  every PERF_EVERY world frames. A leaf: no renderer, no lane. See
  `07-Rendering/Enhanced-Lighting-Arc.md`.
- `orderedDither.js` - what remains of the retro pass after FT3 (2026-09-14,
  Mac: "Remove our version of pixelated sky"): `ringSnap` (ES1g's ring grid,
  used now only to name a world-fixed cell a third of a degree across) and
  `bayer4`, read by PS3's dither over Dynamic Skies' own colour reduction.
  It was `retroPixel.js`, the pass's shared GLSL, until the pass went.
- `retroPass.js` - RETRO1 DFU'S RETRO MODE, THE PASS (2026-09-24, Mac: "Can
  we get retro mode from DFU ported over?"): a WORLD frame drawn into a
  320x200 or 640x400 image (320x154 / 640x308 over a docked large HUD) with
  its own depth texture, presented point-sampled through DFU's 640x400
  presentation target, posterized or palettized on the way (art_pal's 258
  colours through InitLut's LUT, FastColorPalette's k-d tree answers), the
  "-sky" pair leaving the far plane alone; under the lane the lane's frame
  is made that small and resolves into the image. A leaf - the settings
  and the sizes are `systems/retroMode.js`'s, handed to the renderer by
  main.js (`setRetroSource`); the pillarbox reaches it through each host's
  `setWorldViewport(worldViewportRect(...))`. AUDIT RETRO1: DFU's own
  gamma round trip, the LUT built a slice a frame, nothing of the image
  left bound; its second pass: the LUT stepped a block at a time (at most
  `RETRO_LUT_MAX_BLOCKS` a frame) and streamed into a texture allocated
  up front, a z-slab at a time (`texStorage3D` + `texSubImage3D`), a
  failed allocation caught through getError and retried when the shift
  or retro mode changes. See `07-Rendering/Retro-Mode.md`. PERF-SCALE
  (2026-09-25): the render scale's image is this pass's too, presented
  `smooth` (LINEAR, unsnapped, no effect); retro wins. The law of a world
  drawn smaller and shown is `Renderer._retroBegin`'s - see PERF-SCALE
  below.
- `volumetricClouds.js` - VC3 THE VOLUMETRIC CLOUDS: a raymarched slab between
  two altitudes, shaped by the VC2 volumes, lit by the sun (the moon at night)
  with a short light march, driven by the eased weather row, a per-weather
  profile eased on the same clock and the one drift integral; marched into a
  sky-space hemisphere map a stripe per frame and composited over the dome by
  transmittance (`?clouds=off|lo|hi`); VC4: and the SAME field marched from
  the ground along the sun's ray into a world-space shadow map, a square of
  sixteen pixels snapped to the 819.2 grid, which the terrain, the models, the
  characters and the flats sample through renderer.js's CLOUD_SHADOW_GLSL;
  VC5: the arc closed after an Opus review (Volumetric-Clouds-Arc.md).

RETIRED from this list (MAP1, 2026-09-18): `src/render/overworldRenderer.js`, the U61 OVERWORLD pass (the whole-bay relief, its markers, route line and cloud deck behind the enhanced travel map) - gone with the relief map itself (`src/ui/overworldMap.js`, RETIRED the same day) when the enhanced map became the held parchment (`src/ui/heldMap.js` + `src/ui/inkMap.js`, a 2D canvas that draws through no renderer pass; bible/10-UI/Held-Map-Arc.md).

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

See `Dynamic-Skies.md` for DS1: BadLuckBurt and carademono's Dynamic Skies mod, vendored 1:1 with permission and standing beside the dome as the enhanced lane's sky (2026-09-04).

See `Seasons-Iliac-Bay.md` for SIB1: RosyTheRascal's Seasons of the Iliac Bay mod, ported 1:1 with permission - the woodland's autumn, spring and winter on the nature flats, its textures read from the player's own copy of the mod (2026-09-05).

`EE9-Surface-Field-Design.md` is the surface field's design - snow that builds, deforms and melts, on the chunker's own grid - written before its code, per the arc's law.

## WISPS-RETURN - THE WIND WISPS ARE STREAKS AGAIN (2026-09-25)

Mac, 2026-09-25: *"I want to return to the original wind wisps before
our current design."*

- **The design goes back to WIND3's.** "Our current design" was WIND5's
  flourish (below): each wisp a 40-segment ribbon along an arched or S
  stroke that ended in a tightening curl, swelling and thinning like a
  pen, soft across like ink, drawn on and off along its path. "The
  original" is the streak WIND3 shipped and WIND4 thinned: one thin quad
  stretched along the wind's velocity, faced to the eye, faint at its
  tail and brightest toward its head, fading in and out whole on its own
  clock. `render/windWisps.js` draws that streak again - WIND3's two
  stages, its six-corner quad and its streak length (`WISP_LOOK.len`
  1.6 m plus up to 2.4, times a half plus the strength, where WIND5 took
  2.6 plus up to 2.0 to hold a curl).
- **WIND5's swirl is retired whole, not kept beside it.** Mac asked for
  the design back, not for a choice, so there is one design in one
  program, as WIND3 had: `swirl()`, the pen, the ink, the draw-on,
  `ribbon()`, the `uCurl` uniform, the looks' `curl` and the nine
  WISP_SEGMENTS to WISP_DRAW_TAIL constants are gone from the tree.
- **Kept, because they were not the design.** DISC17-A's two numbers were
  Mac's asks about the amount and the visibility, made while the
  flourish stood but not about its shape: `WISP_MAX` 120 at a gale and
  10 in a calm (WIND4's streaks were 650 and 52), and `WISP_LOOK`'s alpha
  0.20/0.24, twice WIND3's. A streak at its darkest is therefore 0.44 in
  a gale and 0.20 in a calm - WIND4's were 0.22 and 0.10; the flourish's
  ink peaked at 0.70 on a thinner, soft-edged line. The later fixes stay
  too: AUDIT-VC7 (G6)'s whole clock (the wobble and the life's rate in
  whole cycles over `WISP_CLOCK_PERIOD`, the clock handed wrapped), AUDIT
  68's exact wrap (the gust in whole 1/`WISP_GUST_DIV` steps, the travel
  wrapped at the box times `WISP_GUST_DIV`) and its one compile and link
  (`buildProgram`). The sandstorm's grains were always the straight quad
  (WIND5 gave them a curl of 0) and draw exactly as they did.
- **Pinned** by `test/wispsreturn.test.js` (3, each failing on the
  base), on the real renderer's uploads run through both shaders' own
  main()s (`test/wispShade.mjs`): a wisp's whole length on one line down
  a diagonal wind at its look's length for the strength, one width end
  to end, square to the wind and to the eye's ray, in the wind's look and
  the sand's; WIND3's fade along it, whole across its width, times the
  look's alpha and the life; one six-corner draw a wisp, every declared
  uniform uploaded and nothing else, the flourish's exports gone.
  `disc17.test.js` reads DISC17-A's darkest through the same pipeline;
  `wind3_windworld.test.js` has its streak and clock lines back and holds
  AUDIT-VC7's clock and the count's ramp, moved from the retired
  `wind5_swirls.test.js`; `weather2d_sandstorm.test.js` holds the looks
  without a curl. Mutants: `tools/mutants/wispsreturn.json` (13, all
  dead); `wind5.json` retired; `auditvc7.json`'s six swirl records
  retired with the code they mutated and its seven other wisp records
  re-aimed at the suites that hold their laws now. Drawn on a real GPU by
  `tools/wispStreakProbe.mjs` (WIND5's probe, renamed, its checks the
  streak's: one quad a wisp, ink at a gale and less in a calm, moving,
  and running along the wind). On SwiftShader, 7/7: a gale's ink runs
  34.6 px along the wind to 1.5 px up it. A calm's ten wisps in the 90 m
  box are often out of one view at one moment - over four headings and
  three moments they laid 482 px against a gale's 9747 - so if a calm
  should read at a glance, `WISP_FLOOR` is the dial. Not seen in the game
  here (no game data in the container).

## PERF-SCALE - A RENDER SCALE, AND THE COUNTER NAMES THE GPU (2026-09-25)

Two players, relayed by Mac: "One user is reporting fps issues in the
exterior but fine in the interior ... GPU is NVIDIA GeForce RTX 4060 Ti",
and "me too my friend.. don't know why. I got a RX6600". Mac: "It has
nothing to do with our updates" - FPS1 (2026-09-11) had already heard
"the outside still has optimization issues".

**What the two reports share is the frame's SIZE, not the card.** A 4060
Ti is no weak GPU. `Renderer.beginFrame` sizes the canvas at its CSS size
(`clientWidth` x `clientHeight`) and every world pass - the opaque world,
the sky and its march, the water, the air's AO, bloom and shafts, the
flats, the Morrowind and Eye Of The Beholder bodies - ran at that size
with no cap and no dial. A 1440p window is 1.8 times a 1080p one's
pixels, a 4K or ultrawide one 2 to 4 times, and so is a browser zoomed
below 100% or a driver's DSR/VSR; the exterior is where the per-pixel
work is, the interior is small and dark. And nothing on screen said
which GPU the browser drew on - a laptop's browser on its integrated
chip, or on SwiftShader, reads exactly like "fps issues in the exterior
but fine in the interior".

**THE LAW: ONE HOME FOR A WORLD DRAWN SMALLER AND SHOWN.** RETRO1's image
path already drew the world into a small image and presented it
(`Renderer._retroBegin`, `_presentRetroFrame`, `render/retroPass.js`).
PERF-SCALE generalises it rather than writing a second copy:

- The frame's world image is `kind: 'retro'` or `kind: 'scale'`
  (`Renderer.retroFrame.kind`). With retro off and the scale below 1 the
  image is the host's world rect in canvas pixels (the whole canvas when
  it set none; a docked bar's strip when it did) x the scale, rounded
  (`_scaledImage`). Every world pass draws into it - on the classic set
  straight into the image, under the Enhanced Lighting lane into the
  lane's frame at the image's size (its passes at that size too), which
  resolves into the image. The first screen quad, the first-person
  overlay, a panel or the next frame presents it, as a retro image.
- **The present is LINEAR** (`RetroPass.present({ smooth: true })`):
  sampled at the pixel's own spot, no 640x400 presentation snap, no
  effect, the image's filter switched to LINEAR where it is sampled and
  back to Point for a retro frame (only when the kind changes). An image
  over the whole canvas writes every pixel and takes no clear; one over a
  docked strip is drawn over a black canvas, as retro's.
- **RETRO WINS.** The retro config is asked first; a retro frame never
  reads the scale, and its 320x200 / 640x400 image is the world's.
  Retro off with the scale on hands the world to the scale (the palette's
  LUT is freed, as retro off always freed it).
- **100% IS TODAY'S FRAME.** No image, no framebuffer, no pass, no
  present: at a scale of 1 the frame's GL calls are the frame with no
  scale source, call for call (`test/perfscale.test.js` S1). A session
  that tried a smaller scale gives its memory back: the world frame that
  draws without an image (the scale back at 100%, or retro off) frees the
  image and its depth (`RetroPass.dropTarget`) and the lane's image-sized
  frame (`AirPass.dropFrame('retro')` on the renderer's KEPT pass, so the
  frame goes even when the lane was turned off in between), after the owed
  present (`Renderer._dropWorldImage`; S7). The lane's canvas-sized frame is kept
  under a scale frame - a menu, a map or a video over the world draws
  into it.
- **Screen-space kernels are the image's.** The bloom's blur and the
  bolts' minimum width are sized in the image's pixels (the AO's radius is
  in world units and moves with nothing), as in any window of the image's
  size: X% of a canvas looks like a window X% as large at 100%,
  stretched. At 50% the glow spreads twice as far on screen
  as at 100% on the same canvas - exactly as a 1080p window's glow already
  spread twice a 4K one's. Sizing them in canvas pixels would put a 2-tap
  gap into a quarter-size bloom and a bolt under one image pixel.
- **The UI is not scaled.** The HUD, the menus, the windows and the
  first-person overlay are the 2D pass's, drawn after the present on the
  canvas at its own size. Everything that maps a canvas pixel into the
  world already maps through the host's rect, which the frame keeps
  (`worldViewportRect` - the tap ray, the crosshair, the muzzle, the name
  labels), and the passes that restore the world viewport restore the
  image's (`worldViewportPx`: the sky, the clouds' map, the bolts' pixel
  width, the lantern grid's rect). A sprite sized in canvas pixels is
  sized in the image's (`retroImageSpan`, AUDIT RETRO1 C6's law, now for
  either kind). The screenshot and the save thumbnail read the canvas
  after the present.
- **The setting** is the Features home's Sight row "Render scale"
  (`systems/features.js` `render-scale`: 100%, 85%, 75%, 67%, 50%; 100%
  the default; the player's own online - it is this screen's pixels).
  `systems/renderScale.js` `renderScaleSetting` reads it (and a probe's
  `?renderscale=` door, once a page) and is the renderer's source
  (`setRenderScaleSource`, wired by `main.js` beside `setRetroSource`),
  asked once per WORLD frame, so the tile's press lands on the next. The
  row has no Off, and its `classic` is 100%: Daggerfall's own frame is the
  whole window (DFU's resolution is the browser's canvas here), so FT18's
  All off takes it there and Restore brings the player's tier back.

**THE COUNTER NAMES THE GPU AND THE PIXELS.** `gpuNameOf` reads
`WEBGL_debug_renderer_info`'s `UNMASKED_RENDERER_WEBGL` where the browser
hands it out, `gl.RENDERER` otherwise (a masked browser answers a generic
name there), ONCE, in the Renderer's constructor (`Renderer.gpuName`).
`Renderer.frameInfo` is the frame's size: the world image, the canvas,
`devicePixelRatio` and the scale ("retro" under retro mode). The FPS
counter (`ui/fpsCounter.js`) shows two more lines while it is on -
`gpu <name>` and `world WxH  canvas WxH  dpr N  scale N%` - read once a
second, never while hidden; `window.__fpsStats` adds `gpu`, `world`,
`canvas`, `dpr`, `scale` and `retro` when a probe asks. So one screenshot
of the counter answers "which GPU" and "how many pixels". The box is
capped at the window less its margins, and a long line wraps inside it
(the GPU name is shown whole; `tools/fpsCounterProbe.mjs` measures it).

**Not done, and why.** The canvas is still sized in CSS pixels, not
device pixels - the port never rendered at `devicePixelRatio`, so a HiDPI
screen was already spared 1.5-2x; the size line shows the ratio so a
report can say so. No automatic scale: the dial is the player's, and a
frame-time governor would move the picture under them. Ledger A row
PERF-SCALE. Pinned: `test/perfscale.test.js` (10); `tools/mutants/perfscale.json`
(47, all dead). Record: `01-Overview/Field-Bugs-2026-09-25.md`.

**The review (2026-09-25).** Seven findings; six fixed, one recorded. A
return to 100% (or retro off) held the image and the lane's image-sized
frame for the session (36 MiB classic, 89 MiB under the lane, on a 4K
canvas at 75%) - freed now, above. `renderScaleOf` matched a tier by its
NUMBER while the Features tile matches by its STRING, so a stored
"0.750" ran at 75% under a tile showing 100% - it matches by the string
now. The warm had its own copy of "the scale is on" and built the present
for a source answering 0 - both ask `Renderer._scaleOn` now. The
frameInfo's host-rect arm, the probe's `retro`, the counter's
"gpu unknown" and the dpr's rounding were unpinned - pinned. A paraphrase
stood in quotation marks as the report - the report is quoted as
written. Recorded, not changed: the screen-space kernels (above).

**AUDIT BRANCH-0925 (2026-09-25, the pre-merge audit, Mac: "Audit before we
merge").** Three findings, all fixed and pinned, each pin failing before
its fix:

- **PS-A1: All off left the render scale where it was.** The row had tiers
  and no Off and no `classic`, so FT18's `classicSegment` answered -1 and All
  off - "Every mod and enhancement goes to Off, or to Daggerfall's own where
  a row has no Off" - skipped it: after All off the world was still drawn at
  50% and stretched. The row's `classic` is 100% now (above, The setting),
  and `test/ft18_features.test.js`'s All off test drives a 50% tile to 100%
  and back on Restore, the renderer's source reading both.
- **PS-A2: the lane's image-sized frame survived a lane turned off.** The
  review's drop asked the INSTALLED air pass (`Renderer._air`), which is
  null while the lane or the air is off, while the pass itself is kept
  (`_airPass`, built once) with its frames. Enhanced Lighting on at 75%,
  then off, then 100%: the 1440x810 frame (a colour image, two depths,
  three framebuffers) was never freed, even after the lane came back, since
  `_retroFrame` was null from then on. The drop asks the kept pass now; S7
  walks it.
- **PS-A4: the counter's box ran off a phone.** `white-space:pre` and no
  width cap on a box anchored top-right: the report's own ANGLE name
  ("ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Ti (0x00002803) Direct3D11
  vs_5_0 ps_5_0, D3D11)") made it 728px wide - nine tenths of an 800px
  window, 346px off a 390px phone's left edge, cutting off the "gpu" line's
  start. Even the size line alone overflowed a phone. Capped and wrapping
  now (S6 pins the style; `tools/fpsCounterProbe.mjs` measures twelve
  window and GPU pairs in Chromium - four ran off the edge before, none
  after).

Also: `01-Overview/Field-Bugs-2026-09-25.md` sent players to an "Enhanced
pane" that FT12 removed - the counter's row is Settings > Interface (or
`?fps`).

## WIND5 - THE WIND'S FLOURISHES (2026-09-23)

**Retired 2026-09-25 by WISPS-RETURN (above).** The design below is no
longer in the tree; this is the record of what was drawn. Its suite,
mutant list and probe went with it or were re-aimed there, and
DISC17-A's count and alpha stand.

Mac, with a sheet of calligraphic wind flourishes: "lets reduce the
amount of wind streaks and change their design to be more swirly like
the image".

- **Fewer.** WISP_MAX 240 at a gale (WIND4's 650), the floor the same
  share - a couple of dozen in a calm. A flourish is a bigger, more
  deliberate mark than a streak, and a few read as wind where the
  streaks needed numbers. DISC17-A (2026-09-24, Mac: "I really want to
  give the wisps more opacity and reduce the amount of wind wisps"): 120
  at a gale and 10 in a calm, each twice as dark (WISP_LOOK's alpha
  0.20/0.24, where it was 0.10/0.12).
- **The flourish.** `render/windWisps.js`: a wisp is a RIBBON of
  WISP_SEGMENTS (40) segments along a path - an arched or S stroke down
  the wind (`sin²`, so it leaves level and meets its curl level) for the
  first WISP_STROKE (0.55) of it, then a spiral from the stroke's end,
  heading down the wind, WISP_CURL_TURNS (1.6) turns, closing to
  WISP_CURL_TIGHT (0.3) of its radius. The tightening is eased in (k²):
  a linear one kinked the join by four degrees, which the path pin
  measured. Each swirl leans its curl's plane off the vertical about the
  wind by up to WISP_LEAN (1.05 rad) and curls up or down, so the air
  holds a varied hand, not one stamp.
- **The pen and the ink.** The ribbon faces the eye across the path's own
  tangent, swells in from its tail and thins into the curl, is soft
  across its width, and is DRAWN ON - the head runs the path over the
  first WISP_DRAW_HEAD of the wisp's life, the tail follows it off from
  WISP_DRAW_TAIL - riding the same wind integral, wrap and wobble as
  before. Its alpha is the look's own (doubled by DISC17-A).
- **The sand keeps its streak.** A look carries `curl`; the sandstorm's
  is 0, so its 7000 grains are one straight quad each, as they were.
- Pinned by `test/wind5_swirls.test.js` (RETIRED by WISPS-RETURN; the path mirrored term for term:
  continuous and level at the join, heading down the wind on both sides,
  the curl's turns and tightening measured; `tools/mutants/wind5.json` (RETIRED)
  19/19 dead), and drawn on a real GPU by `tools/wind5SwirlProbe.mjs` (RETIRED: renamed `tools/wispStreakProbe.mjs`)
  (6/6: compiles and links, the ribbon's vertex count drawn, a gale's
  ink, a calm's lighter, the sand's one quad, the flourishes moving;
  `--bold` for a picture of the shape).

## WIND4 - THE WISPS' COUNT, THE SKY'S DIRECTION, THE GRASS AT NIGHT (2026-09-15)

Mac, three in one message, on the wind and weather work: *"1. The wind
wisps are far too many and the amount should be reduced. 2. Clouds dont
follow on the world timer with the direction of the wind. 3. Grass
doesnt get darker at night"*. Three different shapes of fault.

**(1) A NUMBER.** `WISP_MAX` was 2400 in a 90 m box - about one wisp
per three cubic metres of the air in front of you at a gale, which
reads as a fog of streaks rather than as wind. The field's job is to
make the DIRECTION legible, and a few streaks moving together do that.
650 at a gale now, and the calm floor 0.08 rather than 0.12, so a still
day is nearly clear (52 wisps, where it used to draw 288). Under one
wisp per 1000 m3 at the top, pinned as that measure rather than as a
bare constant. The SANDSTORM keeps its own 7000: a wall of sand is
meant to be a wall.

**(2) A SIGN** - and the one sign that cannot be seen from inside the
shader. The cloud field is sampled at an ABSOLUTE position: the
floating origin's recenter is added, because `setState` does
`shift -= offset` precisely so that `p + shift` is where the point
really is. The drift is not a position - it is how far the AIR has
travelled - and it was added on the same line. A field sampled at
`p + d` shows the cloud that was at `p + d` standing at `p`, so the
whole sky crept UPWIND at exactly the wind's own speed. It is
subtracted now, in both places the field is read (the density march and
the ambient mottle).

The clock half of Mac's sentence was already right and is pinned so it
stays that way: `dt` at the drift seam is GAME MINUTES off the world
clock, so an hour's rest moves the sky an hour, and the wind it
integrates is the live model's vector rather than the weather row's
table value. The wisps had the direction right all along - they advance
the wisp's POSITION by the same offset - which is why the sky and the
ground disagreed in the open.

**(3) TWO MISSING TERMS.** Every other surface in the world lights as
ambient, plus the sun's colour times its SCALE times the lambert, plus
the moon's the same way - one formula in four programs
(`render/renderer.js`, `farRing`, `waterSurface`). The sward used the
sun's COLOUR and dropped its SCALE, which is the term that goes to zero
when the sun sets, and had no moon term at all. At midnight the ground
went dark and the grass stayed lit by a sun that was not there. The
scale rides the sun now (the tip's rim included - it goes out with the
sun), the moon lights the blades as it lights the tile they stand in,
and the host hands all five terms instead of three. A host that hands
neither new field gets the old look rather than a black field: a
missing light must not read as night.

GR1's law holds: the grass shaders are byte-identical to
`grass-proto.html`, so the lab carries the same text and sets the new
uniforms its own way (no night in the lab - scale one, moon off). The
new varying is appended to both declaration lists rather than inserted,
so the lab's own locator still finds the line it slices on.

One comment had to be reworded on the way in: the tree's shader audit
reads a GLSL comment as code, so naming the renderer's uniforms while
explaining the formula counted them as used by this shader.

Ledger row WIND4. Pinned: `test/wind4_windweather.test.js` (4) - the
wisp curve and its density measure, the drift's two subtractions and
the arithmetic that says a cloud is drawn downwind by exactly the
drift, the grass's scaled sun and moon with the host's hand-off and the
lab's copy. Compiled and linked in a browser:
`tools/wind4ShaderProbe.mjs` (10 checks) - both programs link, every
new grass uniform survives the link, both cloud marches compile, and
every use of the drift in the shared field is a subtraction.
