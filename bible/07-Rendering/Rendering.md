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
- `characterMesh.js` - the voxel character mesh path.
- `characterSprite.js` - the classic-visuals sprite pass (one fixed
  CHAR_SPRITE_RT_SIZE target).
- `bounds.js` - EL5 THE BOUNDS AND THE CULL: a bundle's bounding sphere
  (`boundsOf`, computed at upload for a mesh and each sub-mesh, a terrain
  surface, a billboard batch), the record's world sphere
  (`transformSphere`), the frustum's normalised planes (`spherePlanes`,
  over frustum.js's extraction) and the sphere test the shadow and air
  replays cull by. A leaf: no GL. See `07-Rendering/Enhanced-Lighting-Arc.md`.
- `cloudShadow.js` - EE5 / VC4 THE CLOUD SHADOW BLOCK: the uniforms and
  the reader (`cloudShadowAt`) that answer how much sun reaches a point
  on the ground, off the map `volumetricClouds.js` writes. Its own leaf
  since VC6c, because a GLSL declaration is visible only inside its own
  compilation unit and TWO passes interpolate it now - every renderer
  program that lights by the sun, and the air pass's shafts, which
  cannot import from the renderer that imports them. No GL, no imports.
  See `07-Rendering/Volumetric-Clouds-Arc.md`.
- `shadowPass.js` - EL2 THE SHADOW PASS: records what the world pass draws and
  replays it depth-only from the light at the top of the next frame - a
  two-cascade sun map outdoors, a cube map from the nearest lantern indoors -
  with the receiver block the lane's shaders read (`SHADOW_GLSL`); the depth
  programs are the renderer's own vertex shaders (EL7: three cascades, the
  rigs recorded too, the water surface a receiver; EL8: the caster table
  `uCasterOf`, the far cascade and the far casters on a cadence; BUGS-5:
  the light in the hand never casts (`SHADOW_CASTER_MIN_DISTANCE` 1.5), a
  thing on the ground is no standing card (`noShadow`, archive 216, flats
  under half a unit), a cascade skips casters under two of its texels).
  See `07-Rendering/Enhanced-Lighting-Arc.md`.
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
  the 46 cells qualify. Together: **8.45M to 3.54M, 58% off.** Height is
  54 to 38 on Mac's word, range 200 to 250, and the tint is pulled
  toward a low-frequency world-space noise so the sward has patches
  instead of reading as one flat carpet of per-blade noise.
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
  lab's text plus THREE named edits, exported as `GRASS2_VS_EDITS` and
  applied by the pin to the lab's own slice before comparing - so a
  fourth change, or a fourth edit nobody declared, still fails. The
  fragment stage is untouched.
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
- `perfMeter.js` - EL8 THE PERF READOUT: `?perf` - the frame's GPU time on
  `EXT_disjoint_timer_query_webgl2` and the lane's counts, one console line
  every PERF_EVERY world frames. A leaf: no renderer, no lane. See
  `07-Rendering/Enhanced-Lighting-Arc.md`.
- `orderedDither.js` - what remains of the retro pass after FT3 (2026-09-14,
  Mac: "Remove our version of pixelated sky"): `ringSnap` (ES1g's ring grid,
  used now only to name a world-fixed cell a third of a degree across) and
  `bayer4`, read by PS3's dither over Dynamic Skies' own colour reduction.
  It was `retroPixel.js`, the pass's shared GLSL, until the pass went.
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
