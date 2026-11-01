# Real Windows

Real windows make house glass see-through both ways and let it light the ground. From the street, every house window
shows a lit room behind it, different per building and glowing at night. From inside a building, the windows show the
real street outside. At night the mock rooms' lamps throw window-shaped pools of light onto the street, and by day the
sun or moon shines in through the glass. DFU's windows show and light nothing, so this is our own presentation over
DFU's window table, on the enhanced skin only.

## How it works

### From the street: a mock room

Every exterior window texel (`climateSwaps.isExteriorWindow`, its glass mask uploaded by the pipeline) draws a room
behind the glass in both mesh shaders (`src/render/realWindows.js` `realWindowsGlsl`). One tile of window texture is
one room's facade (`ROOM_BOX`, depth 0.9 x width, held to 2 to 7 m). A ray from the eye is marched out of the box and
the face it leaves through is painted from `src/world/windowRoomArt.js` (eight styles of room, furniture, curtains on
half the windows, painted from numbers). The seed is the glass's tile and its wall's plane in the model's frame, so a
street's houses differ and the floating origin changes nothing.

By day the room takes 0.7 of the ambient with the glass's reflection over it (Fresnel). At night 62% of rooms burn a
lamp in the window style's amber; the rest stay dark. The room fades to the classic glass from 70 to 160 m. Rooms are
per frame: an exterior host asks for them after its `beginFrame` (`renderer.setWindowRooms(realWindowsMode())`), so
interiors, dungeons, panels and maps never draw one.

### From inside: the street

The interior arm (`src/scenes/worldModes.js`) asks `viewOutFrame` once the room's light is set. The glass the previous
interior frame met (`renderer.takeGlassRect`), padded, is the crop. At Full, the exterior host's street is drawn
(`renderer.outsideViewFrame`) into its own target at half the world image's pixels, depth to 2400 m, and redrawn when
the view moves or every 250 ms (`VIEW_MAX_AGE_MS`).

The pass is a bracket that puts every state back: the lighting lane
is suspended (the classic set draws it), the shadow pass records nothing, and the street is lit by the last exterior
frame's terms with the clock and weather now. The building's own panes are drawn again as depth, so nothing on the
room's side of a pane shows through. `renderer.setGlassView` then paints the picture inside the crop as the frame's
background and cuts the glass texels. Unwanted for 10 s, the target is freed. `src/scenes/world.js` walks one ring of
pixels for it (`VIEW_RINGS`).

### Which interior texels are glass

A building interior set is five records, and record 2 is the window wall, its twin record 1.
`src/world/interior/interiorGlass.js` `windowGlassTexels` declares glass where a texel is the glass index, or is new
against the twin, in the palette's blue run (96 to 109) and in dense new art; then keeps only real panes. Lead and frame
stay. Every window wall of the 36 interior archives has its glass found, and none of the paperdoll's clothes. A pack's
picture of a window wall is cut by the classic mask. A context that is not ARENA2's uses
`renderer.uploadTexture(..., { cutout: true })` or `renderer.uploadGlassMask`.

### The windows' light

Each tile of window glass is a light shaped by that glass (`src/render/windowLight.js`): a fragment follows its ray back
to the window's plane and reads the glass mask there, so lead and frame cast shadow, with a penumbra from the source's
footprint.

- **Street, night:** a lit mock room's lamp shines out, 1.8 m behind the glass, reaching 12 m (`WL_LAMP_RANGE`). A dark
  room throws nothing; a curtain narrows the shape and passes 0.3 of the glow.
- **Inside:** the sun or moon shines in through glass that faces it, through the sun map where the lane draws one. The
  moon's gain (`WL_MOON_GAIN` 0.3) is a third of the sun's (`WL_SUN_GAIN` 0.9).
- **Every pane** glows as a small area light out to 6 m (`WL_SPILL_REACH`), at 0.5 of the outside's ambient by day
  (`WL_SKY_GAIN`) and 0.1 by night (`WL_SKY_NIGHT_GAIN`). The glow eases between the two over the sun's first 0.15 of
  height (`wlDayShare`, `wlGlowGain`). So a full Masser's patch at night adds about 1.1 times a room's own ambient on
  the Enhanced lane and 0.4 on the classic set: a dim patch, the room's dark kept round it.
- The lights ride a uniform block of 128 (`WL_MAX_LIGHTS`, binding 3) and a band of the light grid; masks are an R8
  array of 64 layers of 128 x 128 on unit 24, evicting the least recently read.
- Glass is filed in 24 m cells (`src/render/windowApertures.js`), so a frame walks only cells near the eye; cells build
  at most 384 tiles a frame (`WL_BUILD_TILES`). Past the near 128, a street's lit windows are gathered to 160 m as far
  rows (`WL_FAR_GATHER`, a second block at binding 4), one row a storey's run of a wall.
- By day on the street there is no lamp, so nothing is built. Indoors the sun map is drawn only while glass faces the
  sun or moon.

## Rules

- From outside every window shows a mock room; from inside every window shows the real world (Mac).
- Windows outside and in are see-through, and their light shows on the ground by time of day.
- The switch is **Real windows** (Settings, Graphics): Full, Rooms only (no street pass), Off; pref `realWindows`,
  default Full, the player's own online. Presets: Low Off, Medium Rooms only, High and Ultra Full. `?windows=` is the
  kill door (`realWindowsMode`); an unknown value is ignored.
- The card's **Window light** part chooses the light the glass throws (pref `windowLight`, `windowLightMode`, the
  player's own online): On, the default, Day only and Off. Off lights no window. Day only lights a building's glass
  while the day has a share, faded by it, and takes no moon and no street lamp (`src/render/windowLight.js`
  `wlKindFor`). Neither drops the view out or the rooms. `?windowlight=off` is the light's kill door.
- No ARENA2 raster ships: the rooms are painted from numbers.

## Code and tests

- `src/render/realWindows.js` - the room shader, `realWindowsMode`, the view out (`viewOutFrame`, `createViewOut`)
- `src/world/windowRoomArt.js` - the rooms' art and seed
- `src/world/interior/interiorGlass.js` - `windowGlassTexels`, `interiorGlassMask`
- `src/render/windowLight.js`, `src/render/windowApertures.js` - the windows' light and the glass's cells
- `src/scenes/exterior.js`, `src/scenes/world.js` - ask for rooms, hand the street (and wagons, through
  `outsideViewDraws`) to the view out
- `src/scenes/caravanRoom.js`, `src/scenes/horseCartPool.js` - the caravan's cut-out glass; the street pass draws other
  wagons but not the one the player stands in
- `test/render/windows1_rooms.test.js`, `test/render/windows1_view.test.js` - rooms, view out and glass (a corpus test
  gated on `ARENA2_PATH`)
- `test/render/wl1_windowlight.test.js`, `test/render/lightreach.test.js`, `test/render/audit_lightreach.test.js`,
  `test/render/windownight.test.js`, `test/render/fb1031_light.test.js` - the light, its night gains and the Window
  light part
- `tools/realWindowsProbe.mjs`, `tools/windowLightProbe.mjs`, `tools/windowGlassScan.mjs` - probes

## Open

- The street behind the glass is redrawn on every frame of mouse-look (any view entry past `VIEW_MOVE_EPS`), and from
  inside a city it draws most of the city's static batches again. Whether this is a tavern's cost on a player's machine
  is unmeasured; the FPS counter's `view` figure will say.
- Glass counts as in view while it is in the frustum, so a window in another room behind walls keeps the pass running.
  An occlusion query on the glass is the fix.
- The classic set has no sun map: sun through glass stops a storey down (`WL_STOREY`) but passes an inner wall. A pane's
  glow is never shadowed. The gains are tuned on SwiftShader, not on a player's machine.
- `src/scenes/dungeonContext.js` asks no rooms and draws no view out.
