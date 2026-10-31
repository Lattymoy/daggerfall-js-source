# Real windows (RW1, 2026-10-09)

Mac: "The implementation of the real window overhaul, allowing players to see inside/outside of house windows."
Asked to choose, Mac picked: from OUTSIDE every house window shows a FAKE ROOM (interior mapping - a lit room,
different per building, glowing at night, cheap enough for whole cities); from INSIDE every window shows the REAL
outside world. The law, the shader text and the view out's arithmetic live in `src/render/realWindows.js`; the rooms'
art (eight styles, seven pieces, six cloths, painted from numbers - no ARENA2 raster) in `src/world/windowRoomArt.js`.
Not a DFU member: the port's own presentation over DFU's own window table.

## From the street: a room
Every exterior window - `climateSwaps.isExteriorWindow`, its 0xff mask uploaded by the pipeline's exterior arm, now
marked `{ window: true }` - draws a room behind its glass texels in BOTH mesh shaders (the classic FS and EL_MESH_FS
interpolate one block, `realWindowsGlsl`, and its four main lines). The wall's texture frame comes off the screen
derivatives; one tile of window texture is one room's facade (`ROOM_BOX`: two tiles wide, centred, its depth
0.9 x its width held to 2..7 m); a ray from the eye is marched out of the box; the face it leaves through is painted
at 12 texels a metre; a piece of furniture on the back wall, curtains for half the windows. The seed is the glass's
tile and its wall's plane in the model's own frame, so a street's houses differ and a floating origin moves nothing.
The light is the window style's own (`roomLightFor`): by day the room takes 0.7 of the ambient and the glass keeps
its day blue on top as the reflection (0.34 head-on, Schlick toward a grazing look); at night (the style's amber)
62% of rooms burn a lamp of that amber at 1.35, the rest stand dark. The room fades to the classic glass from 70 to
160 m and stands under the scene's fog. The rooms are a FRAME's: `beginFrame` drops them and an exterior host asks
after its own (`renderer.setWindowRooms(realWindowsMode())`), so an interior, a dungeon, a panel or a map never draws
one; the panel bracket saves and restores the frame's switches.

## From inside: the street
The interior arm (`worldModes.js`) asks `viewOutFrame` once the room's light and air are set, before its lamps: the glass the previous
interior frame met (`renderer.takeGlassRect` - spheres of the glass and cutout sub-meshes, a static batch's per-model
`pieces`) padded by 0.06 NDC is the crop; with the row at Full the exterior host's street is drawn
(`renderer.outsideViewFrame`) into a target of its own at half the world's pixels under the room's lens with its
depth taken to 2400 m, cropped so the rectangle is the pass's whole clip space; it is kept while the camera is still
and redrawn every 250 ms. The pass is a bracket (the panel's shape, everything put back in a `finally`): the lane is
suspended (a picture through glass is drawn on the classic set - no shadow maps, no light grid, no air pass), the
shadow pass records nothing, the street's light is the last exterior frame's (kept by `setWindowRooms`) with the
host's clock over it, nothing on the room's side of a pane is drawn (PANE-CLIP, `01-Overview/bugs/Field-Bugs-2026-10-12g.md`:
the last watched frame's glass and cutout sub-meshes drawn again, depth alone, under the view out's lens -
`renderer._rwDrawPanes`, the depth read on unit 22 - and a street fragment at or before that depth discarded; the
building's own walls seen from inside are back faces, so its other wing, a second model of it and a neighbour's wall
against it are drawn, as the reporter at The Savage Goat expected), the neighbours' windows show their rooms. After the interior's `beginFrame`, `renderer.setGlassView` paints the picture
(and the sky - the fog colour to a deeper zenith - where the street drew nothing) inside the rectangle only, as the
frame's background, and cuts the glass texels inside it; the interior draws over it with normal depth. Unwanted 10 s,
the target is freed. World.js walks VIEW_RINGS = 1 ring of pixels.

**PASS-COUNT (`01-Overview/bugs/Field-Bugs-2026-10-18.md`).** MADMAN0037: "The Mouse and Fawn tavern in Sentinel,
graphics settings preset ultra, Gpu fans turn into jet turbines", over an FPS counter that read 198 fps and "draws 67".
The view out is drawn before the room's `beginFrame`, and that frame's reset of `renderer.stats` lost its draws, so a
building's counter never showed the street it drew through the glass. The shadow maps' replays were counted only in
their own pass's stats. The room's frame now takes the view out's count (`stats.viewDraws`) and the lane's shadow
render writes its own (`stats.shadowDraws`) - the view out's count takes the panes' depth draws and a part-drawn
street too (AUDIT FB1018 L2-3, L2-4). The counter prints each on its draws line when its mean is half a draw a frame or more
(`src/ui/fpsCounter.js` drawsLine), and prints what holds the frame rate when it is not the default
(`vsync off` where the desktop shell lifted the display's wait, the Frame Rate Cap's fps). OPEN, for the owner: the
street is redrawn whenever any entry of the view matrix moves past VIEW_MOVE_EPS (1e-4), which is every frame of
mouse-look, and from inside a city it draws each pixel's whole static batch the crop meets. In a city the size of
Sentinel that is most of the city again - once a frame over the one rectangle the glass covers, never once a pane
(AUDIT FB1018 L2-6). Standing still it is redrawn every VIEW_MAX_AGE_MS (250 ms), so `view` is read while turning
the mouse. No measurement on the player's machine says this is the tavern's cost - the counter's `view` figure will. If it is, the levers move the picture: a redraw budget, or one
wider picture per position sampled by direction.

## Which interior texels are glass, and the door for a room that is not ARENA2's
An exterior window record drawn inside a building is glass (DFU lays interiors out with the same table under
WindowStyle.Disabled). A building interior set's WINDOW WALL - record 2, read against its twin wall, record 1 - has
its panes declared glass by the pipeline's last arm (`world/interior/interiorGlass.js` `interiorGlassMask`, after the
auto-emissive arm; a pack's picture of it too, cut by the classic mask): the rule, read off a real ARENA2, is GLASS-ALL
below. A context that is not ARENA2's has two doors:
`renderer.uploadTexture(archive, record, color32, { cutout: true })` - every solid pass discards the texels under half
alpha (drawMesh, a static batch's sub-mesh, the shadow casters' replay); indoors the hole shows the street, or with the
street off the sky - and `renderer.uploadGlassMask(archive, record, mask)` (white texels glass, never an emission).
`renderer.outsideViewSkip` (a mesh the street pass leaves out - unused today: the caravan the player sits in is left out by where it stands, `src/scenes/horseCartPool.js` drawOutside, since its meshes are every caravan's) and
`renderer.outsideViewDraws` (a draw the street pass also makes) are the street pass's hooks.

## The switch
Settings > Graphics > View distance & detail: Real windows - Full, Rooms only (no street pass), Off. A preset row:
Low Off, Medium Rooms only, High and Ultra Full (High is how the game ships). Enhanced skin only; `?windows=` the
kill door. The card's drawer holds Window light - On, Day only, Off - the light the glass throws (WINDOW-NIGHT, below).

## THE FOUR HOSTS
- `src/scenes/exterior.js` - WIRED: asks rooms after its beginFrame; hands the modes its town as the street (and,
  since the WAGONS2 final audit, its wagons through `outsideViewDraws`).
- `src/scenes/world.js` - WIRED: the same, its pixels out to VIEW_RINGS.
- `src/scenes/worldModes.js` - WIRED (interior arm: the view out and the glass); its dungeon arm FLAGGED: none - no
  window to the street.
- `src/scenes/dungeonContext.js` - FLAGGED: none - a dungeon asks no rooms and draws no view out; its exterior-window
  records keep the R2 'day' style as before.

## Unverified (no ARENA2 in the container)
The interior glass is no longer among them (GLASS-ALL, below: a real ARENA2 read). The rooms' scale against real window tiles, the view out's cost in a real town, and the pane clip
on a real building (PANE-CLIP) were seen only in `tools/realWindowsProbe.mjs`'s synthetic street (SwiftShader) - its
`inside-wing` shot stands a wall of the building past the glass (35208 of its pixels seen through the panes, none at
HEAD's box) and one before it (none seen, either way).

## The caravan (WAGONS2)

Mac's ask named the new wagon too: "allowing players to see inside/outside of
house windows + the new wagon". The caravan's room is its own model
(`06-Systems/Wagons.md`), and its windows' glass is a cutout picture
(`uploadTexture(..., { cutout: true })` - `src/scenes/caravanRoom.js`
paintCaravanRoom, `src/scenes/horseCartPool.js` uploadWagonPicture). From
inside, the holes show the street through the view out, as a house's glass
does. The street pass draws the wagons standing in the street too - mine and
the others', ungrown (`src/scenes/horseCartPool.js` drawOutside, handed to
the pass by `src/scenes/world.js` through `outsideViewDraws`) - but never the
caravan whose room the player stands in (`OUTSIDE_SKIP_REACH` of the room's
pose): its own body would stand between the pane and the street. From
outside, the caravan's room is drawn inside its body (NO_SHADOW), seen
through the same holes.

## Pins

`test/render/windows1_rooms.test.js` (the rooms), `test/render/windows1_view.test.js` (the
view out); mutants `tools/mutants/windows1.json`; PROBE
`tools/realWindowsProbe.mjs` (a synthetic street on SwiftShader - its lane
runs report GL error 1282 from the Enhanced Lighting air pass's replay as it
stands at HEAD, not the view out's).

## The audit (RW1 AUDIT)

- **The street as it stands now.** The view out's setup re-lights the kept
  street by the clock: its fog colour (`clockFogColor` - the classic haze's
  day factor from the light it was kept at to the light now, so the sky
  behind the glass darkens through an evening indoors), and the town's
  lanterns when the clock lights them - never the player's own torch or
  candle, which stays indoors with them.
- **The water.** The street pass draws the seafloor under a carved cell's
  holes and the water's surfaces over the bed, on the last street frame's
  uniforms; a waterfront looked out on showed dry bed, the sea the sky.
- **The target.** Kept while a pane shrinks (it reallocated at every 64 px
  step down), and freed with the building, its last glass forgotten - both
  ways out (`dropViewOut`).
- **The bracket.** Its `finally` puts the draw baseline back
  (endPanelFrame's: colour mask, depth mask, blend, depth test, cull,
  scissor), and it holds its own target past its frame's begin.
- **The switch.** A kill-door value it does not know (`?windows=0`) is no
  door; the row's word stands.
- **The shader.** The room's seed rounds the wall's plane to the native (at
  half metres a wall at 0.25 m sat on the boundary and the floating origin
  flipped its look); the Fresnel term never takes the pow of a negative.
- **Before this arc.** The Enhanced Lighting air pass's emission replay drew
  its first mesh from the quads' VAO (the images bind theirs behind the
  renderer's shadow): GL error 1282 in the probe's lane runs. The replay now
  forgets the shadow first (`src/render/airPass.js` _replayEmission).

## The final audit (WAGONS2, after the merge of main)

- **The weather.** The view out is lit by the street frame's own terms - the
  clock's minute and the weather's sun and the cloud's (`viewOutLight`,
  `src/world/worldClock.js`; the moon's ambient the host's). It was lit as a
  clear day: a rainy noon looked out on at five times the street's ambient, a
  storm's at sixteen, and `clockFogColor`, handed a clear sun against the
  dimmed one the street was kept at, brightened the air with no minute gone.
- **The sea.** Deep Waters (on by default) as the street frame draws it: a
  pure-ocean pixel kept for its seafloor (its ground and its water sheet
  hidden), the floors' own programs told to the renderer (`markForeignPass`),
  and the carved sea's top drawn last over the pass's own pixels
  (`drawDeepWatersSurfaces(nowMs, cells)`). A harbour-front window showed the
  bed dry and the open sea as sky.
- **A dark room glows nowhere.** The room's lit seed is one text
  (`RW_SEED_GLSL`), read by the room and by the air pass's emission replay,
  which blooms an exterior pane only where its room is lit (`uRoomsLit`). The
  replay had bloomed every pane amber, the 38% drawn dark among them. The two
  programs and both mesh lanes were compiled and linked in Chromium.
- **The target.** Kept at the larger of each side (a wide pane and a tall one
  looked between remade it at every turn), let go the moment the street is
  off (a cutout's holes kept a Full target wanted), and sized by the world's
  own image - the retro or render-scale picture, a docked HUD's rect - never
  the canvas (a retro 320 x 200 world on a 1080p canvas drew one pane at up to
  960 x 540).
- **A pin made to bite.** The bracket's frame target is checked against a
  lane's own target standing, not the null the test defaulted to.
- **Known limit.** Glass counts as in view while it is in the frustum;
  interiors are drawn whole, so a window in another room behind walls keeps
  the pass running while the player moves. Bounded (VIEW_SCALE,
  VIEW_MAX_SIDE, one pass a frame); an occlusion query on the glass is the
  fix, not made blind here.

## GLASS-ALL (2026-10-11): the interior glass, read off the data

Mac: "Windows inside interiors are not see through", then "Bruh all windows should be see through". The renderer was
not the fault - `tools/realWindowsProbe.mjs`'s room, re-run at HEAD on both lanes, cut its declared glass to the street
- the RULE was. RW1 read interior glass off palette index 0xff, unverified; against a real ARENA2 (DaggerfallGameFiles,
read in a scratch folder and never committed - Port-Doctrine) `node tools/windowGlassScan.mjs` found it in ONE window
of the 36 building interior archives (the temple's stained glass, 063) and took eight records of TEXTURE.237 and .240,
the paperdoll's clothes, which share the sets' numbers. Every other window wall's glass is plain palette colour, so
nothing was cut and every pane stood opaque.

What the data says. Each building interior set (`BUILDING_INTERIOR_SETS`, in the four climates an interior is laid out
in - ApplyClimate's bases 0, 100, 300, 400; never 2xx) is five records: a wall twice (0 and 1), a WINDOW WALL (2 - the
same wall with a window in it), a floor and a ceiling. ARCH3D's 882 interior models hold 97 that wear a window wall.
The two castles break the layout: the desert castle (011) has no window, the mountain castle's (111) is record 1
against record 0 - and no building interior wears a castle set. The glass is the window wall's NEW art (where it
differs from its twin) painted in the palette's blue run, 96-109 (the sky's blue down to the slate a pane is shaded
with); where a window carries no glass, the opening's fill (a farm's and a village's hole in a desert wall, 222 and
223; the castles' arched opening, 86, and arrow slit, 216); and the glass index wherever it stands.

The rule (`world/interior/interiorGlass.js` windowGlassTexels, one home - the pipeline and the scan tool ask it): a texel is
glass when it is the glass index, or new against the twin, in the ramp and in dense new art (80% of the 5 x 5 square
about it - a twin wall differs from its window wall by a speckle of noise, and 428's wall panels are painted in the
same blues); then only the panes are kept - a texel with three glass neighbours, joined across lead three texels wide,
24 of them to a window - with their edges. The lead of a lattice and the frame are other colours and stay: the street
is seen through the panes. Every window wall of the 36 has its glass found (35 - 011 has none to find), none of the
clothes; the counts are pinned (`test/render/windows1_view.test.js`, gated on `ARENA2_PATH`). Two known looks: 440 (the swamp
manor) paints the band its window stands in with the glass's own blues, so the band opens with it, a wide window; 128
and 140 (the mountain farm and manor) shade their panes with grey strokes in the lattice's own greys, which stay.

The pipeline's arm now asks it of a pack's picture of a window wall too (it was `!swap`), cut by the classic mask as
the exterior arm cuts a pack's window - a repaint keeps the window where it stood. Pins: `test/render/windows1_view.test.js`
V8 (a synthetic window wall - its panes, its lead, its frame, the wall's speckle, a half-repainted wall and a stray blob)
and the gated corpus test; mutants `tools/mutants/windows1.json` GLASS-ALL-* (13, all dead).

## WL1 (2026-10-29): the windows' light

The owner: "So all windows on the outside/inside should be see through. The outside should show a mock inside. Windows
should have shadowed lightening that shows on the ground at night and also light on the inside should show on the
ground, all depending on time of day. Performance needs to not take a hit". Not a DFU member: DFU's windows light
nothing. The law is `src/render/windowLight.js`; a mesh's glass, tile by tile, is `src/render/windowApertures.js`.

**The light.** Each tile of window texture that holds glass is a light shaped by that glass. A fragment follows its
ray back to the window's plane and reads the glass's mask there, so the lead and the frame fall as shadow. The edge
softens by the source's own footprint on the glass (twice the lamp's 0.1 m radius, or the sun's 0.0093 rad, times the
way to the glass), and the aperture test widens by the same, so a pool's outline is as soft as its lead.

**Two sources.** By night on the street a lit mock room's lamp shines out: over the glass by half its height and
0.45 m, 1.8 m behind it, 8 m of reach. In a building the outside's sun or moon shines in through the glass that faces
it, read through the sun map where the lane draws one. Every pane glows as a small area light out to 6 m
(`WL_SPILL_REACH`). The rooms are the mock rooms' own seed, in whole numbers on both sides (`world/windowRoomArt.js`
roomSeedBits, realWindows.js rwSeedBits its twin): a dark room throws nothing, a curtain narrows the shape and passes
0.3 of the glow it covers.

**The block and the masks.** The lights ride one uniform block (128 lights of 7 vec4s, 14 KB, binding 3), bound from
the renderer's first frame, and LC1's grid, in a second band of its two textures (grid rows 24 to 47, lists past
65536). The masks are an R8 array of 64 layers of 128 x 128 on unit 24, which no other pass binds (the snow's
pictures stand on 16 to 20 in the snow terrain program, which holds the block too); it is the one sampler added, and
the lane's terrain and snow programs reach 15 of 16. A mask is kept with its bytes and goes up onto a layer when a
light first reads it; with every layer taken, the one read least lately and not this frame gives way, and comes back
when read again. An evicted picture frees its layer.

**The gather.** A mesh's glass is filed in 24 m cells (`windowApertures.js` APERTURE_CELL), so a frame walks only the
cells near the eye: a city pixel of 52,000 window tiles costs 0.6-0.8 ms a night frame with the eye in it (node, warm),
and a placement past the 72 m reach one check. A cell's world data is built when first walked, the nearest first and at
most 384 tiles a frame (`WL_BUILD_TILES`), and lit that frame. A frame keeps the windows drawn in the last 20 s,
the nearest 128 of them, and fades the farthest at a cut that eases, each kind its own. A mesh drawn within 2 m of a
placement not yet drawn that frame has moved there, so a ship's windows go with her.

**The work.** A street by day has no lamp: nothing is built and `uWinOn` skips the walk. A sun beam's ball runs half
its 24 m into the room from the glass; a pane the sun does not face is only its glow's 6 m ball. When the cells still
ask more than the band's list holds, the nearest lights that fit stand and the cut comes in to the first left out -
never none. Indoors the sun map is drawn only while glass the frame could light faces the sun or the moon, the panes
cut out of it (shadowPass.js `DEPTH_GLASS_FS`, warmed with the other depth programs). A static batch measures its
glass in its sliced merge (PERF-EXT23), a tile's two triangles mapped a millimetre apart merged into one window.

**The frame's kind** (`renderer._wlKindOf`). A world frame whose host said the Real windows row (setWindowRooms, or
captureOutsideLight) is 'street' when the window style glows and 'inside' when DFU disables it, as it does indoors; the
view out's street is 'street'. A building's frame reads the outside through the view out's step (realWindows.js
viewOutFrame asks `renderer.captureOutsideLight` - the exterior host's own `setup` in a bracket, every 250 ms). The view
out's street takes the hour's moon (enhancedSky.js lightStreetAt). The mock rooms take the sun as well: followed back
from the face a ray meets to the glass, the pane's mask lights a patch on the room's floor and walls (`ROOM_SUN_SHARE`
0.85), none behind a curtain. `?windowlight=off` is the kill door - nothing read, measured or kept; the row Off lights
none.

**The glass DFU's rule misses.** Twelve exterior window records hold glass that is not the palette's 0xff, so they
showed no room, no street and no glow. `tools/exteriorGlassScan.mjs`, run on a real ARENA2, finds glass in 103 of the
104 window records DFU's table names in a building's climate; 036 #3 is a wall. `world/exteriorGlass.js` names the
twelve's glass colours and keeps their panes (a speck inside a pane filled, a diagonal lead kept) - a DEPARTURE from
GetWindowColors32.

**THE FOUR HOSTS.** `src/scenes/exterior.js` and `src/scenes/world.js` - WIRED through the renderer (their frames, and
their view out's street lit by lightStreetAt). `src/scenes/worldModes.js` - WIRED: the interior arm reads the outside
through viewOutFrame; its dungeon arm FLAGGED: none. `src/scenes/dungeonContext.js` - FLAGGED: none - no window to the
street.

**Known limits.** The classic set has no sun map: the sun through glass stops a storey down (2.5 m under the glass's
bottom, `WL_STOREY`), but passes an inner wall on its own floor, and a clerestory's patch more than a storey down is
lost. A pane's glow is never shadowed, on either set. A lit tile is one lamp; the mock room's hearth lights nothing
outside. A placement drawn within 2 m of one culled that frame takes its record. The gains were tuned on SwiftShader's
synthetic street (`tools/windowLightProbe.mjs`, both sets), not on a player's machine.

**AUDIT (WL1, 2026-10-29).** Three independent reads, then fixes. Found and fixed: the masks' unit was the snow's 16
(every snow draw would have failed); the 64 mask layers lost a picture for good; the band's list overflowed in a big
hall and every window light went out; a city pixel's 55,000 tiles cost about 6 ms a night frame; the lamp's penumbra
was taken on the receiver (pools two mip levels too soft) and the outline was a hard step; a quad's two triangles
counted one window twice; slivers took light slots; a mover left its light behind; the outside was read twice a frame
while the view out drew; the off door still measured glass; a panel dropped the frame's window light.

**WL1 on main (2026-10-29).** WL1 merged while its suite still ran, and 14 tests failed on main, so nothing deployed.
One was a real cost: a flat read the sun map in its fragment shader for the sun through glass, where TREES1 and
LA-COST3 hold that read to once a quad. The flat's vertex stage now reads it when `uWinOn` is 2 (a window's sun stands
in the map, indoors, where the flat's own sun is none), and the billboard program's block (`windowLightGlsl`, `shadow:
'flat'`) takes that word and reads no map. WL1's renderer fields are optional on the methods a harness drives without
the constructor, as their neighbours' are. `exteriorGlass.js` names its speck fill `fillPaneSpecks` (audit24: one name,
one meaning). The rest were pins whose quoted text WL1 moved, re-aimed as PIN MOVED.

**Pins.** `test/render/wl1_windowlight.test.js` (W1-W22; the corpus test gated on ARENA2_PATH); LA-COST3's window sun
(`test/render/la_cost.test.js`); mutants `tools/mutants/wl1.json` (87: 86 dead, one equivalent as recorded); PROBE
`tools/windowLightProbe.mjs`.

## LIGHT-REACH (2026-10-29): the windows' light farther, for less

The owner: "Increase distance for street and window lighting in overworld without killing performance", and "Both" -
farther from each window and drawn farther from the player. The record is `Enhanced-Lighting-Arc.md` LIGHT-REACH.

**What changed here.** A window's lamp reaches 12 m (`WL_LAMP_RANGE`, 8 above). A light is listed in LC1's grid by the
box of its beam and its glow (`windowLightBox`), not of its reach's sphere: an eighth of the volume for a lamp's light,
which pays for the reach. Past the near tier's 128 tiles, a street's lit windows are gathered out to 160 m as far rows:
each a storey's run of one wall's tiles, every tile lit by its own lamp through its own glass. The rows ride a second
block (`WinFar`, binding 4) and a third band of the grid; on a busy street their 127 fill by 110 to 125 m. A tile is the
near tier's inside its cut and the row's past it, by the one fade. A row has no glow, and its curtains stand at their
mean edges.

**AUDIT LIGHT-REACH.** The near cut is cut to the first tile the block or the list leaves out in the frame it happens,
and the rows read that cut, so no tile loses its light at the hand-over (W1, W2). A row's box is its weighed tiles' alone
(W6). A curtained room's lamp hangs behind the whole glass, here as in the row (W3): a curtain hides the lamp, it does
not move it. A release lets the free layers go with the rest (W7). The record is `01-Overview/audits/Audit-Light-Reach.md`.

**Pins.** `test/render/lightreach.test.js` (LR1-LR9) and `test/render/audit_lightreach.test.js`; W6, W8, W18 and W20
above moved, each marked PIN MOVED.

## WINDOW-NIGHT (2026-10-31): the night tamed, and a part to choose

A player, Discord #feature-feedback: "It gets way to bright at night for me. I still want to see outside but not be
blasted by the light so it destroys the dark and light in the room during day and night. Before this update i didnt
have this problem". Not a DFU member: the light is WL1's own.

**What was wrong.** By night the moon lit through the glass at `WL_MOON_GAIN` 1, above the sun's 0.9, and every pane
glowed at `WL_SKY_GAIN` 0.5 of the outside's ambient at every hour, about 28% of its noon glow. Against a room's own
night ambient (`INTERIOR_NIGHT_AMBIENT`, 0.20 / 0.18 / 0.20), a full Masser's patch - the beam where it lands square
and the glow at the glass, in luminance - added 4.2 times the ambient on the Enhanced lane and 1.6 times on the
classic set. The one switch was the Real windows row, and its Off drops the view out too.

**The gains.** The moon's gain is 0.3, a third of the sun's. By night (`_sunLight`'s `day` test) the panes glow at
`WL_SKY_NIGHT_GAIN` 0.1, and the day keeps 0.5. The same patch, a full Masser at 21:00 through the pass's own lights
on each lane's decode, now adds 1.1 times the room's ambient on the Enhanced lane (beam 0.89, glow 0.25) and 0.4 on
the classic set (0.23, 0.16): a dim patch, the room's dark kept round it. The glow eases between the two gains as the
sun sets and rises (AUDIT FB1031 L1, below).

**The part.** Window light (the pref `windowLight`, `realWindows.js` windowLightMode): On, the default, Day only and
Off. The renderer's frame kind reads it (`renderer._wlKindOf`, `windowLight.js` wlKindFor). Off lights no window at
any hour. Day only lights a building's glass while the day has a share (`wlDayShare`, AUDIT FB1031 L1), faded by it,
and never a street's lamp, which is a night's light. Neither drops the view out or the street's rooms: those are the Real windows row's.
`?windowlight=off` stays the kill door.

**THE FOUR HOSTS.** No host reads the part. `src/scenes/exterior.js`, `src/scenes/world.js` and
`src/scenes/worldModes.js` - WIRED through the renderer's frame kind, unchanged. `src/scenes/dungeonContext.js` -
FLAGGED: none, no window light.

**Pins.** `test/render/windownight.test.js` (WN1-WN6); `tools/mutants/windownight.json` (14, all dead); WL1's
kind mutant re-aimed by content.

**AUDIT FB1031 L1 (2026-10-31): the dusk eased.** The same player: "not be blasted by the light so it destroys the dark
and light in the room during day and night". The glow's gain stepped from 0.5 to 0.1 in one capture at 17:49, when the
sun fell under `wlSunUp`'s 0.05, eleven minutes before the room's own night ambient at 18:00: a pane's glow lost 0.59
of the room's ambient in a frame on the classic set and 0.84 on the Enhanced lane. Day only cut all its light there. Now
`wlDayShare` is a smoothstep over the sun's first `WL_DUSK_RISE` (0.15) of height, 0 from 18:00 to 06:00. The glow's
gain runs from the night's to the day's by it (`wlGlowGain`), and Day only fades its whole light by it and takes no
moon (`WindowLightPass.frame`'s `dayOnly`, handed by `renderer._wlFrame`).

Measured minute by minute through the renderer's capture of the host's view-out terms, a pane's glow steps at most 0.04
of the room's ambient on the classic set and 0.09 on the Enhanced lane, from 17:20 to 18:10 and from 05:50 to 06:40.

**Not changed.** The moon's beam keeps its law: it is the key from `wlSunUp` down. The sun's beam still begins at
`wlSunUp` at the sun's own scale: on a pane facing it, 0.09 of the room's ambient at 06:12 on the classic set and 0.51
on the Enhanced lane (Day only takes 0.28 of that). THE FOUR HOSTS: as WINDOW-NIGHT, no host reads it. Pins:
`test/render/fb1031_light.test.js` (L1, four tests) and `tools/mutants/fb1031_light.json`; WINDOW-NIGHT's glow and
renderer mutants and WL1's moon and kind mutants re-aimed by content.
