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
host's clock over it, the building the player stands in is left out by its model's box (`uViewClipMin/Max`), the
neighbours' windows show their rooms. After the interior's `beginFrame`, `renderer.setGlassView` paints the picture
(and the sky - the fog colour to a deeper zenith - where the street drew nothing) inside the rectangle only, as the
frame's background, and cuts the glass texels inside it; the interior draws over it with normal depth. Unwanted 10 s,
the target is freed. World.js walks VIEW_RINGS = 1 ring of pixels.

## Which interior texels are glass, and the door for a room that is not ARENA2's
An exterior window record drawn inside a building is glass (DFU lays interiors out with the same table under
WindowStyle.Disabled). A building interior set's record (`BUILDING_INTERIOR_SETS`) whose bitmap carries 24+ texels of
0xff and no more than 60% of them is declared glass by the pipeline's last arm (`world/interiorGlass.js`
`interiorGlassMask`, after the
auto-emissive arm, never a mod's picture). A context that is not ARENA2's has two doors:
`renderer.uploadTexture(archive, record, color32, { cutout: true })` - every solid pass discards the texels under half
alpha (drawMesh, a static batch's sub-mesh, the shadow casters' replay); indoors the hole shows the street, or with the
street off the sky - and `renderer.uploadGlassMask(archive, record, mask)` (white texels glass, never an emission).
`renderer.outsideViewSkip` (a mesh the street pass leaves out - the caravan the player sits in) and
`renderer.outsideViewDraws` (a draw the street pass also makes) are the street pass's hooks.

## The switch
Settings > Graphics > View distance & detail: Real windows - Full, Rooms only (no street pass), Off. A preset row:
Low Off, Medium Rooms only, High and Ultra Full (High is how the game ships). Enhanced skin only; `?windows=` the
kill door.

## THE FOUR HOSTS
- `src/scenes/exterior.js` - WIRED: asks rooms after its beginFrame; hands the modes its town as the street.
- `src/scenes/world.js` - WIRED: the same, its pixels out to VIEW_RINGS.
- `src/scenes/worldModes.js` - WIRED (interior arm: the view out and the glass); its dungeon arm FLAGGED: none - no
  window to the street.
- `src/scenes/dungeonContext.js` - FLAGGED: none - a dungeon asks no rooms and draws no view out; its exterior-window
  records keep the R2 'day' style as before.

## Unverified (no ARENA2 in the container)
FLAGGED in `src/world/interiorGlass.js`: interior glass read off 0xff in a building interior's own records, and DFU's
window records drawn indoors taken as glass - `node tools/windowGlassScan.mjs <ARENA2> [--all]` lists the candidates.
The rooms' scale against real window tiles, the view out's cost in a real town, and the clip box (the door's matrix
naming the building's model) were seen only in `tools/realWindowsProbe.mjs`'s synthetic street (SwiftShader).

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

`test/windows1_rooms.test.js` (the rooms), `test/windows1_view.test.js` (the
view out); mutants `tools/mutants/windows1.json`; PROBE
`tools/realWindowsProbe.mjs` (a synthetic street on SwiftShader - its lane
runs report GL error 1282 from the Enhanced Lighting air pass's replay as it
stands at HEAD, not the view out's).

