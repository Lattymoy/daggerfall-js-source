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
- `enhancedSky.js` - ES1 the ENHANCED SKY: one fullscreen procedural
- `dynamicSkiesRenderer.js` - DS1: Dynamic Skies' own skybox (BLBProceduralSkybox, translated line for line), the enhanced lane's sky while the vendored mod's switch is on; the same draw contract as `enhancedSky.js`.
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

See `Dynamic-Skies.md` for DS1: BadLuckBurt and carademono's Dynamic Skies mod, vendored 1:1 with permission and standing beside the dome as the enhanced lane's sky (2026-09-04).

See `Seasons-Iliac-Bay.md` for SIB1: RosyTheRascal's Seasons of the Iliac Bay mod, ported 1:1 with permission - the woodland's autumn, spring and winter on the nature flats, its textures read from the player's own copy of the mod (2026-09-05).

`EE9-Surface-Field-Design.md` is the surface field's design - snow that builds, deforms and melts, on the chunker's own grid - written before its code, per the arc's law.
