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
kill door.

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
