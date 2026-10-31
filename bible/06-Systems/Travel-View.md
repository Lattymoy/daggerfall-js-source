# Travel View - THE DESIGN, before any code (TV0, 2026-09-27)

Mac: *"So now I want to talk about expanding travel options to something a lot more
player friendly. My idea is a sort of zoom out to an overworld style that utilizes
travel options. Not a large scale zoomout, but something that fits. Allowing the player
to traverse between towns, through the environment, being able to see other players
traveling also. Even adding the option to tap/click to move to a specific location.
This is something ive wanted to do for a really long time and I want to do it justice
as it opens the door for a lot of possibilities. When opening the map, there should be a
toggle to go to the overworld style map. Every detail like weather patterns, should be
1:1 in this mode."*

**The working name is TRAVEL VIEW.** "Overworld" already means the exterior streaming
world in the code (`net/remotePlayers.js`, `11-Multiplayer/Multiplayer.md`'s "billboard
pass in the overworld"), and U61's retired relief map was called THE OVERWORLD; a third
meaning would be one too many. The name on the player's screen is Mac's to pick.

## Mac's four calls (2026-09-27)

Asked, with the trade-offs laid out:

1. **Height: below the clouds** - about 150-450 m up, tilted. The clouds stay overhead,
   so the sky, the fog and the rain stay the real ones with the least rework.
2. **Click to move: both, by target** - a town or a marker routes along the roads; open
   ground walks straight, Travel Options' own steered walk.
3. **Speed: capped to what loads cleanly** - a limit where the world streams without
   holes and the others see smooth movement, the same online and offline.
4. **Other players: region-wide from the start** - a new low-rate relay feed, so the
   first release shows travellers across the region, not only the ~2.5 km the pose
   reaches.

## What it is, and what it is not

**It is the real world, seen from above.** The streamed terrain, the real locations, the
real weather field, the real Travel Options journey - the player's own body walking or
riding across real ground, with a camera lifted over it. Nothing is a stand-in.

**It is not U61 again.** U61's OVERWORLD (`10-UI/UI-Arc.md`, 2026-08-26) was a SECOND
world - a WOODS relief at one vertex per map pixel, climate tints, a painted cloud veil
hiding the swap, and a camera that flew the route while the clock jumped. MAP1 retired
it for the held sheet (`10-UI/Held-Map-Arc.md`); no complaint about its look or speed is
recorded - the change was one of direction - but its record carries the lessons: 5,658
draw calls at rest, drawn mirrored in its first cut, never shown correct on real data.
Travel View draws no second world, so there is no swap to hide.

**Enhanced lane only.** DFU has no raised travel camera; the classic lane keeps DFU's
own map and fast travel whole. The Port-Ledger's "Ledger A (continued)" row THE TRAVEL VIEW
names the departure (TV1, 2026-09-28).

## The seams it stands on (measured 2026-09-27, four read-only lanes)

- **The journey exists.** `systems/travel/travelOptions.js` runs Travel Options' Update in its
  own order: the autopilot (`systems/travel/travelAutopilot.js`) turns and drives the real
  motor, `systems/travel/travelSteer.js` casts three feelers round obstacles (TRAVEL-NAV),
  `systems/timeScale.js` scales the step, and a journey stops for enemies, a window, a
  disease, the ocean, arrival (`interruptTravel` keeps the destination for the resume
  prompt). The held map already starts a walked journey at a bare pixel
  (`beginTravelToCoords`, MAP2).
- **Roads exist; a route planner does not.** Hazelnut's four 500,000-byte masks, one
  compass byte per map pixel (`vendor/roads-hazelnut/`, `systems/travel/travelPaths.js`), and
  the follow key walks junction to junction; a named trip goes straight
  (`Travel-Options.md` TO-FIELD: "The mod does not route along roads to a named
  destination and never did"). The pieces for a planner are in the tree:
  `ui/overworldModel.js traceChains` (1,508 road chains, 4,289 track chains) and
  `world/road/roadNetwork.js route()` (a pixel-grid A* that refuses water and prices climbs).
- **The raised eye exists.** The render eye (`mwv.eye`) is already separate from
  `cam.pos` (`scenes/world.js`), and `cam.pos` is what streaming, the ±500 m vertical
  re-centre, the weather sample, rain, grass and the wind follow. The travel camera is a
  RENDER eye; `cam.pos` stays on the player, so the world keeps streaming and the
  weather keeps being read where the player is. The tap ray unprojects through the last
  frame's projection and view, so a click works from any camera.
- **The weather is a field.** WEATHER3's `weatherAt(x, z, minute)`
  (`systems/weather/weatherMap.js`): 400-700 systems born, drifting, growing and dying over the
  bay, calibrated to DFU's odds table. A player query is 0.12 ms, the sky's 40 km read
  0.2 ms. Cloud shadows (VC4) are already a world-space map that reads correctly from
  above.
- **The ground it can hold.** Enhanced land view is radius 5 by default (121 pixels,
  about 4.1 km guaranteed each way), 6 at most; the far ring reaches 48 pixels at true
  height (`render/farRing.js`). From 450 m at a 45 degree tilt that is enough land.

## The constraints, named before they bite

1. **Streaming cannot keep up with Travel Options' top speed.** At the default limit a
   horse makes about 650 m/s - a map pixel every ~1.3 s, where the builder completes
   well under one a second (PERF-EXT24: 3-6 ms of build a frame). At ground level fog
   hides the edge; from above the unbuilt pixels are holes. Hence Mac's call 3: the cap
   is MEASURED (TV2), not guessed, and the builder may take a bigger slice while the view
   is up (no combat, no HUD work). HORSE-WALK (2026-10-12) keeps that horse at that pace:
   horse care's walk is never the road's - under the view and on a journey the ride keeps
   its own pace (`06-Systems/Horse-Care.md` THE WALK, ON THE ROAD THE RIDE KEEPS ITS PACE).
2. **Online the clock cannot be sped up.** WORLD5: the clock is computed from wall time
   and nobody keeps it. Offline the cap speeds the calendar too (Travel Options' law);
   online it speeds the body only, as TO-ONLINE's journey already does. At the cap a pose
   moves under the 102.4 m snap, so the others see a rider, not hops.
3. **Everything that draws weather assumes a ground-level eye.**
   - **Fog:** plain distance from the eye, no height term (`render/fogGlsl.js`); from
     400 m in rain the ground below shows at about 30%.
   - **Clouds:** marched from `(x, 0, z)` and composited behind the world
     (`render/volumetricClouds.js`).
   - **Rain and snow:** a 42 m box round `cam.pos` (`render/precipitation.js`).
   - **Shadows:** cascades of 12/48/240 m round the eye (`render/shadowPass.js`).
   - **Grass:** a 300 m disc round `cam.pos`.
   - **Billboards:** turn about the vertical only, so from above they go edge-on.
   - **The far ring:** skipped under any exponential fog and carries no locations.

   Below the clouds (call 1) keeps the cloud march and the sky dome sound; each of the
   others needs an altitude-aware version.
4. **A far player is invisible today.** A pose reaches peers within `RANGE_PIXELS` = 3
   (about 2.5 km), inside 16-pixel cells. Only the party pose travels world-wide (the
   hub, once a second at most). Call 4 needs a new feed.

## The slices

**TV1 - THE VIEW.** A button on the held map's foot row, beside Ports, and a registry
key (KB1: a new action, drawn in Controls). The EM1 tab strip is a 2D-sheet contract and
this is a camera, not a sheet. The sheet lowers the way it always does (MAP-FIELD7) and
the camera rises from the player's eye to its band:
- about 150-450 m, clamped under the local cloud base, tilted 45-60 degrees;
- wheel or pinch to zoom within the band, drag to orbit, recentring on the player;
- the player's own body drawn with a ring and a heading so it reads from 450 m.

Outdoors only; a door, a dungeon or a building closes it. Escape, the same key, or any
Travel Options interrupt (enemies above all) drops the camera back to the eye.

The altitude-aware passes land with TV1, because the view is not 1:1 without them:
- **Fog:** density keeps DFU's value at the ground and thins with height, so rain still
  greys the valley and the ridge stands out.
- **Billboards:** tilt to face a raised eye in this view only.
- **Shadows:** cascades centred on the ground point the camera looks at, not the eye.
- **Grass:** stays with the player; from 450 m it is not drawn.
- **The surf:** Come Sail Away's breakers are not drawn (FIELD BUGS 2026-09-30b TV-SURF) - from 150-450 m a strip
  laid for a ground eye is seen whole, a half-tone sheet over open water.
- **Precipitation:** a column over the player's own ground.
- **Cloud march:** its origin at the eye's height.

Pins run on the pure pieces: the camera band and clamp, the fog law, the billboard
basis. The frame is proven by a probe on the fixture rig, not by eye.

**TV2 - CLICK TO MOVE, AND THE CAP.**
- **Open ground:** a click starts Travel Options' walked journey to that point
  (`beginTravelToCoords`, finer than a pixel centre).
- **A town, a dungeon or any marker:** routes along the roads. A planner over
  Hazelnut's masks: roads cheaper than tracks, tracks cheaper than the open, water
  refused. It is built from `traceChains` and `route()` rather than a third copy.
- **The route as it runs:** drawn on the terrain as a line, and the journey follows it
  pixel by pixel through `travelPaths.js`' own path walk.
- **The speed cap:** measured on a probe that rides a long road at rising acceleration
  and counts unbuilt pixels in view. The cap is the highest rate that shows none, less a
  margin. The builder's budget while the view is up is measured the same way.
- **Controls:** the Travel Options strip (speed, camp, exit) rides along, the spinner
  clamped to the cap.

**TV3 - THE TRAVELLERS, REGION-WIDE.** A new directed-to-the-region frame on the
region channel the client already holds (`chat:region.N`), under the relay's discipline
end to end.
- **The frame:** a TRAVELLER MARK `{px, py, fx, fy, h, m, tv}` - the map pixel, a
  byte-fraction within it, a heading byte, the mode (foot, horse, cart, ship) and
  whether a journey is running. At most once per 5 s while moving and on each pixel
  crossing, once per 60 s standing, nothing indoors.
- **On the relay:** kept on the socket's attachment (under the 2 KiB budget) and fanned
  to the region room at a room-wide and byte budget. A late joiner gets the current
  marks in the welcome.
- **Trust:** the name comes from the verified token (`badged`), never the frame. The
  shape law is `validTravellerMark` in `net/wire.js`; a new RELAY_VERSION past world121
  with a `TRAVELLER_RELAY_MIN` gate; the SLAM8 row appended; the client's inbound gate;
  pins and mutants on both ends.
- **Drawing:** within the pose range the traveller is their real body, as today. Beyond
  it, a marker with their name set on the ground at WOODS height, and an edge arrow for
  one outside the view. The held map draws the same marks, in `partyMapMarks.js`' shape.
- **Cost:** every frame wakes the region's object - measured against RELAY-H1's free-tier
  figure before merge.

**TV4 - THE WEATHER, SEEN FROM ABOVE.** The field is already there; this slice draws
it where it is.
- Cloud shadows over the whole view (VC4's map).
- Rain and snow curtains standing under the systems `weatherAt` reports raining inside
  the view, not only round the player.
- Lightning striking where the storm really is (WEATHER3d's distant strikes, per
  DISC20-D).
- The far ring kept under light weather with its haze.

The one rule: nothing is invented - every curtain, shadow and strike answers
`weatherAt` for its own ground at the shared minute. So two players in the view see the
same storm in the same place.

**TV5 - THE GROUND AT DISTANCE.** Far-ring silhouettes for the locations beyond the
grid (a town is a cluster of roofs at its real pixel before its blocks build), and
whatever the TV2 probe says the builder still needs.

**Release gate: TV1-TV4.** Call 4 puts the travellers in the first release, and Mac's
"every detail like weather patterns, should be 1:1" puts TV4 there. TV5 follows. *(TV5 as
built: edge markers, Mac's call - see "TV5 - SHIPPED".)*

## TV1 - SHIPPED (2026-09-28)

Mac, 2026-09-28: "Your the lead and this is your baby." The open items below were decided
as lead and are recorded as such; each is one line to change if Mac calls otherwise.

**The pieces.**
- `src/player/travelCamera.js` - the camera's LAW, pure: the band, the ceiling, the eye,
  the ground clearance, the wheel, the drag, a frame's easing, the rise and fall, the lean.
- `src/scenes/travelView.js` - the HOST'S MACHINE: `createTravelView(deps)` owning the
  state (`off` / `rising` / `up` / `falling`), the input while up, and every way out. Its
  header is THE FOUR HOSTS RULE's record.
- `src/ui/travel/travelViewHud.js` - the READOUT: the traveller's ring and chevron on the
  projected feet, the compass, the bar (title, place, hints, Return). Keyed marks
  (`marks`) are its seam for TV2's route and TV3's travellers.
- `src/render/fogGlsl.js` `FOCUS_GLSL` + `renderer.setFocus` - THE FOCUS: one uniform
  (`uFocus`, w 1 set, w 0 the camera) the fog measures from; the shadow pass renders its
  cascades about the same point and hands the receivers `uSunOrigin` to pick them by.
- `src/player/mwView.js` `mwViewHoldThird` - the body held third-person for the view, and
  handed back as it was found.
- The door: `Overworld (O)` on the held map's foot, KeyO on the sheet, and the
  `TravelView` action (KB1: appended, Windows group, shipped UNBOUND). The held map is the
  Enhanced map: a player who turns it off has DFU's own map windows, which carry no door -
  the bound key is their way in (AUDIT DEEP2 F7; said in the patch notes).

**The numbers, and why.**

| Law | Value | Why |
|---|---|---|
| Height band | 150-450 m, default 260 | Mac's call 1; 260 frames a town and its gates |
| Ceiling | cloud base (VC_PROFILE[weather].base) less 60 m, floor 40 m, none = 450 | "Below the clouds" - the deck the sky really draws; a lid weather still leaves a view |
| Tilt | 15-75 degrees down, default 52 (30-75 until OW-HORIZON, 2026-10-20) | the design's 45-60 widened so a drag can look out to the far ring or straight down on a town; OW-HORIZON lowered the floor so a drag looks out to the horizon |
| Clearance | 25 m over the ground under the eye AND over a ridge halfway to the traveller | the eye never inside a hill, the traveller never behind one |
| Focus | eased at rate 10; a move past 60 m taken whole | a fast travel or respawn is a cut, never a sweep over unbuilt leagues |
| Rise / fall | 1.2 s / 0.8 s, smoothstepped from the head's own eye | out of and back into the body's camera, whichever mwView answers |
| Flats | leaned back by HALF the tilt, pivoting on their FOOT (BB_VS anchors a flat there - AUDIT DEEP R-10: this row said centre); shadows upright | full tilt lies them face-up; half keeps a readable silhouette from 450 m |
| Click | a press that moves under 6 px is a pick | a drag is an orbit and picks nothing |

**What departed from the TV0 design, and why.**
- **The fog does not thin with height.** A thinning law invents a density DFU never had.
  Instead the fog is MEASURED FROM THE TRAVELLER'S HEAD (`uFocus`): every fragment is
  fogged exactly as the traveller standing there sees it - DFU's own density, DFU's own
  distance, from DFU's own eye. The ground at the feet is clear in a rain fog; the hills
  a league off are grey. The probe reads it off pixels.
- **The shadows stand about the traveller, not the look point.** The traveller is the
  look point by construction (the eye stands back along its heading), so the cascades
  are rendered about the same focus; the receivers pick a cascade about `uSunOrigin`, the
  point the pass itself rendered about, so the pick and the maps can never disagree.
- **The cloud march needs no change.** The volumetric deck marches from the
  traveller's head (`sky.use({ pos: player.pos })` - AUDIT DEEP R-10: this said the frame's
  raised eye; from 30 degrees down or more little sky is in the picture either way); the grass, the streaming and the
  weather sample stay on `cam.pos`, which never left the traveller. Grass is not drawn
  from the air (under a pixel at 150 m). What FALLS does not (OW-WEATHER, FIELD BUGS 2026-10-01 #9: "it only
  happens around the player at small scale"): the rain's, the snow's and the sand's boxes and the wind's wisps
  wrap round the eye they are handed, and round the head they were a little cube of weather about the sprite
  seen from 330 m outside it - they wrap round the view's own eye now (world.js `wxEye`), so the air in front
  of the camera is full of it, as it is when you stand in it. RPT1026-WORLD RAIN-EYE (2026-10-20, a private
  report: at sea in a storm, the camera scrolled out, the rain fell in a small box round the ship alone): on the
  ground too - `wxEye` is the view's eye (`mwv.eye`) in every frame, where OW-WEATHER had kept the head's off the
  Overworld, and a camera drawn from behind the head (the third person's, a helm's scrolled out over her
  stern, the broadside's aim) stood outside the box round the head. Pinned by
  `test/net/peer/fb1001_overworld.test.js` (OW-WEATHER's pin, moved).

**The way in, and every way out.** In: the map's button, KeyO on the sheet, or the
`TravelView` key if bound. The gate (world.js `travelViewAllowed`): the enhanced lane, a
walking body in the open air, alive, above the water - each refusal said on the notice
line; a foe near refuses as the map's own travel does. Out: Escape (through the
registry, never reaching the pause), Return, the key again (AUDIT DEEP X-2: it only ever
entered until then); a window opening, a door out of the open air, a video or a death CUTS
it at once (AUDIT DEEP X-1: the door and the video are cut by the host above the returns
that skip the exterior frame - `allowed()` alone waited for the heartbeat); a foe near
brings it down.

**The heartbeat.** Every frame the host draws re-arms a 600 ms timer (the world plaque's
own law, AUDIT-WH2 L3-F2). Frames that stop - a throw downstream, a video holding the
frame - bring the view down and hand the input back; a loop a later boot killed is left
quietly (the listeners and the readout, never the successor's cursor); a hidden tab keeps
the view. So P0's one unwind line in the host stays the plaque's alone.

**The input.** While up the view owns the canvas on the window's CAPTURE phase: a click
is a pick (TV2's seam: `onPick(x, y)`), a drag orbits and tilts, the wheel zooms, the
right button and the context menu never reach the host. The look keys turn the view,
not the traveller. Movement keys walk the traveller camera-relative (the traveller
turns toward the way the keys point at 6 rad/s the short way, and faces it - OW-FACE, FIELD BUGS 2026-10-01 #10:
it turned to the VIEW's heading and walked every key from there, so its sprite showed its back whatever was held;
`travelView.steer` turns it to `keysHeading`, and the host turns the keys' axes onto the body, `axesToward`, so
the walk is the keys' way while it turns) while no journey drives - and,
since TV-WASD (below), at the travel speed. The DOM beside the canvas keeps its own
events.

**Proof.** `test/render/tv1_travel_view.test.js` (18), the heldmap door pin (+1),
`tools/mutants/tv1.json` (17 dead), and `tools/travelViewProbe.mjs` (17 checks in a real
browser on a synthetic valley - CI has no ARENA2 - including the fog and shadow
discriminations read off pixels, real pointer events, and the bar on a phone).

**Other pins, re-aimed because their law grew (never loosened).** The sky's and the flats'
anchors now read the view's spelling - `sky.draw(tvf ? tvf.yaw : cam.yaw, ...)` and
`drawBillboards(..., camRight, bbUp)` - in PERF2, PERF-ZONE2, EV8, DW-C, WATER1,
INVIS-LOOK, SHADOW-REACH and BLOOD1a, every ordering they assert unchanged; DISC14-A's
gate is the walk block's AND not the view's; AUDIT 58's cursor guard ORs the view in on the
world host; I1 and QS2 count the appended, unbound `TravelView`; LA-COST1 classes `_focus`
as an input and counts the two new uploads (+2 on each first call); AUDIT SOC C10/D5 reads
the foot row with the Overworld button after Ports; U42 counts the readout's module.
Every spelling P0, FPS-CAP1, PERF1, AUDIT 39 and AUDIT-WH hold on the frame's first lines,
and the mwViewFrame call's length AUDIT-EOTB F3b reads, is kept as it was.

**Decided as lead (was "Open, for Mac").**
- **The name:** "Overworld" to the player (Mac's own word); TRAVEL VIEW in the code, so
  it never collides with the code's `overworld` (the map pixel grid, U61's retired
  scene).
- **A second door:** the `TravelView` action exists and ships unbound; the map stays the
  front door. A player who wants a direct key binds one in Controls.
- **Being seen:** decided at TV3 (below), with the switch on by default as proposed.

## TV2 - SHIPPED (2026-09-28)

Mac's calls: **"Both, by target"** and **"Cap it to what loads cleanly"**.

**A click, from the air.** The press the view takes as a pick (under TV_CLICK_SLOP) is a ray
from the view's OWN eye through the frame's own matrices (`player/tapRay.js`
rayDirFromScreen, the canvas's pixels) met with the BUILT ground by a march and a
bisection (`player/travelPick.js` groundHit - nothing in the tree met a slanted ray with
the terrain: the collider answers meshes, and outdoors the ground is not one). What it
lands on decides the journey (`classifyPick`):

| Under the click | Journey | Said |
|---|---|---|
| a known place (its rect grown 1.5 blocks) | by the roads, to the place | the trip line: "To X, by the road" / "across country" |
| open ground | straight there | "To the marked spot" |
| the water | none | "You cannot walk out onto the water." |
| ground not yet built | none | "That lies beyond what you can see from here." |
| the sky | none | - |

A place is only a place once DISCOVERED - DFU's own law, the travel map's
(`checkLocationDiscovered`): an undiscovered town is walked to as the ground it stands on.
The known places about the traveller wear PLATES (the grid's own radius, rebuilt on a pixel
change), and a plate's click is the same journey as a click on the town. No Travel Options
(the mod switched off) is said, not silently ignored; foes near refuse it in the mod's words.

**By the roads** (`systems/travel/travelRoute.js`). A* over the 1000x500 grid on Hazelnut's bytes -
the very bytes Travel Options' follow key walks - with a step ON the road only where both
ends carry the edge; a road 1, a track 1.6, the open 3.5 (x sqrt 2 diagonally); the sea
refused (roadsProducer's WATER_BYTE) - but under his road (RPT1026-WORLD CAUSEWAY, 2026-10-26, a
private report: on the bridge the guide turned off it and left the traveller stuck in the water, on the
Grayidge-Westwall road): his road crosses 42 pixels whose byte is the sea's, and his painter
paves each a strip of road tiles with the water either side (`world/road/roadPainter.js`
ROAD_TILES), so a step ON his road is taken into the sea and through its corners (`pavedStep`);
it had been refused, and the route left the road at the inlet's foot for the open pixel beside,
across the water. A track's is not - his painter lays water over a track (a ford). Pinned by
`test/systems/travel/rpt1026_world_causeway.test.js`. A straight run on one kind of ground folded into one
leg. It walks roads; `world/road/roadNetwork.js route()` lays them - two laws, one compass.

**The journeys are Travel Options'.** Two of the port's own (Ledger A, "THE TRAVEL VIEW'S
JOURNEYS"), built from the mod's parts: `beginTravelAlongRoute` (each leg a pixel's middle,
the SAME autopilot re-aimed leg after leg - BeginPathTravel's own InitTargetRect - a road leg
reckless, a track or the open cautious, the last leg the place itself with the arrival
buffer; a NAMED journey, so LocationPause and the resume prompt know it; interrupted, it
resumes from the nearest leg ahead) and `beginTravelToPoint` (a path's width about the spot).
Every stop the mod's Update makes still stops them. Under the view the arrival is SAID on the
notice line, not boxed: a box is a window, and a window brings the view down.

**The cap, measured live** (`systems/travel/travelGovernor.js`). TV0 planned a probe riding a long
road for the highest clean rate; the probe needs ARENA2, CI has none, and one machine's
number is wrong on every slower one. So the measurement runs on the player's machine, every
journey: while the view is up over a running journey the host counts the pixels inside the
view's reach (where the picture's top edge meets the ground, never past the grid) that are
not built. Any for 0.25 s halves the clock (to the spinner's step of five); clean for 4 s it
climbs a step back; walking pace is the floor; the spinner stays the player's and the
travel panel reads `×20 / ×40` while held. Governed BEFORE the frame reads its scale, and
handed back whole when the view comes down or the journey ends.

**The way, drawn.** The route's line is an SVG path through its points (each leg sampled
four times on the ground), broken behind the eye, under the plates and the destination flag
- a readout, never occluded by the hills it crosses (a world-space line would need a line
pass the renderer does not have; handheldTorches.js says the same).

**Proof.** `test/systems/travel/tv2_click_to_move.test.js` (17), `tools/mutants/tv2.json` (20 dead),
`tools/travelViewProbe.mjs` (TV2's four checks: the plate's click is a journey and not a
pick, the route drawn, the trip in the bar, the held clock on the panel).

## TV3 - SHIPPED (2026-09-28) - needs a relay deploy (world122)

Mac: "being able to see other players traveling also"; his call **"Region-wide from the
start"**.

**The frame.** A TRAVELLER MARK `{px, py, fx, fy, h, m, tv}` - the map pixel, where within it
to a 256th each way (3.2 m), the heading to a 256th of a turn, the way (foot, horse, cart,
ship), and whether a Travel Options journey drives them - told on the REGION's channel every
online client already holds (`chat:region.N`). `validTravellerMark` refuses anything else
whole, an eighth key included. The name is the relay's, off the verified token (`badged`).

**The relay** (`server/src/index.js`, world122). The region's channel alone
(`isRegionRoom` - the world channel's mark is junk); its own cooldown per socket
(`travHubGate`, half the client's floor); the latest kept on the attachment (`tm`, stamped -
~70 bytes of the 2 KiB) or taken out by a null; fanned to the room under its own budget
(`TRAV_ROOM_HZ_MAX` 20 a second - over it the mark is kept, not fanned); and a joiner's
welcome carries the fresh ones (`tr`, at most 256, none older than TRAV_STALE_MS). A leave
takes a traveller off every screen through the room's own `leave`.

**The client.** The session (`net/online.js`) sends only through a relay at world122 or
later (an older one closes the socket on the frame), only in a region's channel, never
sooner than TRAV_SEND_MIN_MS (10 s); the welcome's marks REPLACE the book, a mark in is
gated at the room's own budget and never my own. The host (`scenes/world.js`,
`systems/travellerMarks.js`) sends when it is due: the first mark, a pixel crossed, a
change of way or journey, a refresh every 2 minutes standing - never from indoors, never
with the switch off, and NEVER WHILE ALONE in the region (the session's count; the room's
join says when someone arrives, and the new mark goes then).

**Drawn.** In the view, a traveller beyond the pose range is a mark with their name at their
ground (the far ring's height where the grid has not built), a party member in the party's
green, one on a journey arrowed, and one outside the picture HELD AT ITS EDGE pointing their
way (`edgeHold`). Inside the pose range they are their own body, named over their head, as
today. *(Named by a marker under the view since OVERWORLD NAMES below: the names over the heads
could not be seen from the view's eye.)* The held map draws the same book - a smaller verdigris ring under the party's, and a
legend row.

**Being seen - decided as lead.** "Show me to travellers in my region" (`showToTravellers`),
ON by default, on the Mods screen's Other players card, the player's own say online (never
forced by the room). Off: only the party (its own marks) and players within the pose range
(their own eyes, as today) know where they are; they still see those who show themselves. No traveller mark is ever sent from inside a building or a dungeon (the party's own pose rides from indoors, as it always has - AUDIT DEEP2 C5).
AUDIT DEEP T3-4/T3-7 - what the switch really promises, now in its own words: the mark goes
to the REGION'S CHANNEL, and the relay cannot know which region a socket stands in, so a
modified client that joins another region's channel reads that region's marks too (the
welcome's `tr`); the name stays in the region's chat roster with the switch off; and the
switch is kept per device (browser storage), so a new device shows the player again until
they say no there. The classic skin sends no mark at all (AUDIT DEEP X-4: it can neither
draw one nor reach the switch). T3-8, recorded: a peer id is the client's own, so a player
who learns a party member's id can hello into a region that member is NOT in under it and
be drawn in party green, under their own name - there is no cheap fix at the relay.

**THE COST, measured against RELAY-H1's figure.** RELAY-H1 priced a room awake for an hour at
~460 GB-s (the free tier's 13,000 GB-s a day was ~7 player-hours at ~4 rooms each). A mark
wakes the region's object, and the object stays in memory for the runtime's idle window
after it (taken here as W = 10 s). With N players in one region each sending at rate r, the
object is awake a share of about 1 - e^(-N r W):

| Who is in the region | Rate per player | Region awake | GB-s per player-hour | vs ~1,840 a player's 4 rooms |
|---|---|---|---|---|
| one player, alone | none (alone law) | 0% | 0 | +0% |
| 2 walking | a pixel per ~100 s | 18% | 42 | +2% |
| 5 walking | a pixel per ~100 s | 39% | 36 | +2% |
| 10 walking | a pixel per ~100 s | 63% | 29 | +2% |
| 2 on fast journeys | the 10 s floor | 86% | 198 | +11% |
| 10 standing | the 2-min refresh | 56% | 26 | +1% |

The lone traveller - the common case at today's population - costs nothing; a busy region
costs a few per cent on top of what its players already cost; the worst case (everyone on a
fast journey) is bounded by the 10 s floor at about a tenth. The constants are named
(`TRAV_SEND_MIN_MS`, `TRAV_KEEPALIVE_MS`) and can be raised in one line if the bill says so.

**What departed from the TV0 design** (AUDIT DEEP2 F15): TV0 sketched a mark every 5 s on the
move and every 60 s standing; as shipped, a 10 s floor (`TRAV_SEND_MIN_MS`) and a 2-minute
refresh (`TRAV_KEEPALIVE_MS`) - the cost table above is what set them.

**Deploy.** The relay deploys from main (`.github/workflows/relay-deploy.yml`), and a deploy
drops every connected player for a moment. Until world122 is live every client sends no mark
and draws none - nothing closes.

**Proof.** `test/scenes/tv3_travellers.test.js` (15, over a real Room through `test/fakeRoom.mjs`),
`tools/mutants/tv3.json` (20 dead), the SLAM8 row for world122 in
`test/net/relayversion.test.js`.

## TV4 - SHIPPED (2026-09-28)

Mac: "Every detail like weather patterns, should be 1:1 in this mode." The one rule held:
nothing is invented - every curtain, shadow and strike answers the weather map for its own
ground at the shared minute, so two players in the view see the same storm in the same place.

**The curtains, stood in the world** (`render/rainCurtains.js`). VC7c hangs a veil under
every falling cell - into the SKY MAP, composited on far-plane pixels alone. From 450 m the
ground fills the picture, so a storm three leagues off was a dark patch in the deck with
nothing under it. Now the same veil stands in the world under the view: VC7c's own constants
(CURTAIN_SHARE of the cell's radius, CURTAIN_EXT a metre at the cell's grown fall,
CURTAIN_STREAKS, CURTAIN_INTO), a cylinder from under the traveller's ground (the world's
depth cuts its foot where the hills stand) up into the base; its optical depth the CHORD the
line of sight takes through the solid cylinder, so it reads dense through its middle and
thin at its rims (measured in real GL by the probe) - measured across the GROUND plane
(AUDIT DEEP2 D9: from a steep eye the true path is longer by 1/cos of its elevation, so a
veil reads a little thinner from high over it than it would; weighed and kept - the foot and
the fog already bound it); fogged from the traveller; thinning to
nothing as the eye comes over it (the rain the traveller stands in is their own particles',
VC7c's `near`). The cells are the ones the clouds DRAW - `sky.drawnCells()`, picked by importance and capped by the cloud quality (AUDIT DEEP2 D3: the field's every cell once stood veils under a sky that drew none of them), the field's where the volumetric clouds are off. One foreign pass
on the world host, drawn only under the view: at the eye the sky map's curtains already
stand on the horizon, and drawing both would be the storm twice.

**The cloud shadows over the whole view - measured, unchanged.** The clouds' shadow map is a
13.1 km square on the traveller's pixel (SHADOW_EXTENT), its nearest edge 6,144 m off. The
view's fog ends at most 4,800 m out (the linear rows at the furthest grid) and the eye
stands back at most 779 m (450 m at 30 degrees): 5,579 m, inside the square. Under an exp
fog nothing is seen past the edge at all. So every shadow on the ground in the view is
already the clouds' own; the pin holds the arithmetic. (Superseded by OW-HORIZON, 2026-10-20: under the view a linear
row's haze now runs to the far ring's rim and the tilt goes down to 15 degrees, so the ground past the square is seen -
it takes the far ring's own cover law there, the map easing into it over the square's rim; below.)

**Lightning where the storm is - the strikes were already placed there** (WEATHER3d's
distant storms, DISC20-D, from the weather map's thunder systems). What was wrong was the
view's: `stormLights.frame` measured a strike's column from the frame's eye, so under the
view every channel's foot hung 448 m above the ground. It measures from the traveller's head
now (`eye: tvf ? cam.pos : mwv.eye`); the bolts are still DRAWN from the view's own eye.

**The far ring under light weather - measured, unchanged.** The ring stands under the linear
rows (sunny, cloudy, overcast) with its haze, as ever. Under an exp row its nearest edge at
the default grid (4 km) is already fog (rain: e^-12), so its gate hides only fog.

**Pins amended, their laws grown.** BOLT wired (the strikes stand round the eye the view is
built from - and under the travel view round the traveller's head; the ribbons still face the
view's eye); EV6 and PERF2 count the world host's foreign seams at twelve; AUDIT 39r counts
seventeen host call sites across thirteen passes.

**Proof.** `test/render/tv4_weather_above.test.js` (8), `tools/mutants/tv4.json` (12 dead),
`tools/travelViewProbe.mjs` (TV4's four checks).

## AUDIT TV - the lead's audit before the arc closed (2026-09-28)

Four read-only lanes, one a slice, each finding re-read in the source before it was
fixed; every fix pinned and every pin made to FAIL (`tools/mutants/tv1.json` 30,
`tv2.json` 25, `tv3.json` 25, `tv4.json` 18 - all dead).

**TV1 - the view (B1-B9).**
- **B1 (high) the focus leaked.** `setFocus` was set by the exterior frame alone, so a door
  taken while the view was up left the street's focus on the renderer: the interior's (a
  dungeon's) fog measured from outside. The focus is now a FRAME'S: the host sets it every
  frame BEFORE `beginFrame` (whose lane replay and sun maps read it), and a `beginFrame` no
  `setFocus` came before clears it (`render/renderer.js` `_focusArmed`). Proven in a browser
  too: `tools/travelViewProbe.mjs` draws the view's frames and then a host that never sets
  the focus - the street's fog came through (139,134,128 against the camera's 109,115,128)
  until the fix.
- **B2 a refused hold stuck.** `mwViewHoldThird(true)` answers false when no body can leave
  the head (a mount) but keeps an empty hold; the view released only a hold that answered
  true, so every later ask was refused for good. The view now releases what it ASKED.
- **B3 touch.** The view takes pointer events; `ui/touch/touch.js` listens to TOUCH events on the
  same canvas, so a drag that orbited the view also swung the weapon or walked the stick. The
  view takes a canvas `touchstart` in the capture phase while up - the START only, so a
  finger down before the rise ends as the touch layer's own and its stick lets go.
- **B4 stuck keys and buttons.** The view swallowed every release of a look key or a canvas
  button - including one the HOST saw pressed before the rise, which then stayed held in its
  Set (the traveller turned on after the view was gone). A release is the view's only when
  its press was (`keysTaken`, `buttonsTaken`).
- **B5 the chat relocked.** A chat opened over the view clears the free cursor; its close
  asked for the lock, under the view. Closed over the view, it gives the cursor back to it.
- **B6 one frame from the sky.** `mwViewFrame` was handed last frame's view eye; the frame a
  window CUT the view in drew from 450 m with the head's look - the pause's backdrop. A frame
  without the view draws from the body's own eye (`ownEye`).
- **B7 typing.** Escape in the chat box took the view down (and the arrows turned it); a key
  typed into a box is the box's.
- **B8 the readout's presses.** Return and the plates are DOM, and the host's window
  `mousedown` counts any press as Mouse0 - an activation or a swing on every click. The
  readout stops its presses.
- **B9 the small ones.** A `pointercancel` is no pick; the cursor is handed back as the view
  found it (a player who freed it keeps it free); a view caught falling rises without asking
  the body or the cursor twice.

**TV2 - click to move (A1-A5).** The trip's line one point a LEG, so `route.i` cuts it where
the traveller is (A1); the governor holds under what the MOD asked - a ring walk's own x15,
never the spinner's x30 (A2, `travelAsked`); a road journey resets the ring walk's
path-crossing watch that stopped it at the first pixel middle (A3); every other journey
clears the view's route, and a stopped SPOT journey is over (A4); a click in a town's margin
that falls on the neighbour pixel still takes the town (A5, the 3x3 asked). (OW-TOWN-ROUND, 2026-10-23: the town's
journey is asked at its MIDDLE alone - a click elsewhere on it is a spot walked round the town, unless it is the
middle, a fine-move click or the traveller stands in the town; with Travel Options' places alone, a click anywhere on
it still takes the town - AUDIT UPDATE T1/T2.)

**TV3 - the travellers (C1-C6).** A welcome resets what the relay holds of me - a new socket's
attachment holds nothing (C1); a CLEAR is always said, even over the room's budget, or a
player who went in stood on every screen for `TRAV_STALE_MS` (C2); a party mark asks the
hub's account for the peer (C3); never a mark into the region just LEFT, which the Region
link holds for `CHAT_REGION_HOLD_MS` after a crossing (C4); offline, the book is emptied
(C5); the welcome's `tr` is read below the halo's `else` it had split (C6).

**TV4 - the curtains (D1-D3).** The rise faded the curtains' LIGHT at full opacity - black
veils over the land while the camera climbed; it fades their opacity (D1). A traveller inside
a veil with the eye still outside was seen through the whole cylinder's chord; the veil fades
for the traveller as it does for the eye (D2). The foot stood 300 m under the traveller's
ground, so a storm over a deeper valley hung in the air; it reaches 40 m under the lowest land
at the veil's centre and rim - the grid's, the far ring's past it (D3, `lowestGround`).

## AUDIT DEEP - the whole arc, five reviewers (2026-09-28, Mac: "Let do a deep audit on everything so far")

Five read-only reviewers, one lane each (the view and its input; click to move; the
travellers, the relay and privacy; rendering; the seams, the evidence and the docs), each
told what AUDIT TV had already fixed. Every finding was re-read in the source before it was
fixed; each fix is pinned and each pin made to fail. The Proof lines above are each slice
AS SHIPPED; the arc's evidence now: `test/render/tv1_travel_view.test.js` 26,
`tv2_click_to_move` 20, `tv3_travellers` 18, `tv4_weather_above` 10; `tools/mutants/tv1.json`
63, `tv2` 40, `tv3` 37, `tv4` 29 - all dead; `tools/travelViewProbe.mjs` 26 checks, B1's
street-fog leak among them.

**The view (T1, X).**
- **T1-1 (high) travellers behind the eye all stood in one corner.** `projectToScreen`
  answers (0,0) for a point behind the camera, and the edge hold turned THAT round: every
  traveller in the rear half was held at the bottom-right with one arrow. The view asks
  for the mirror (`projectToScreen(..., behind = true)` divides by the negative w); the
  pin projects through the host's own mirrored lens.
- **X-1 a door, a teleport, a load inside or a video left the view up** for its heartbeat
  (the readout over the room, a click a pick, Escape the view's, the traveller turned by
  the keys): its only cut read the host's mode inside the exterior frame, below the
  returns that skip it. The host cuts it above the mode's return and on the video hold's
  own return.
- **T1-3 a fast journey snapped the focus** frame after frame (past ~650 m/s the eased
  lag passed TV_FOCUS_SNAP): a jump is the FEET's now, and the lag is held to the snap
  distance. **T1-4 a slope steeper than the tilt put the eye inside the hill** (two lifts
  never caught it): lifts until clear, then the view steepens (`clearView`), the camera
  keeping the player's tilt. **T1-8** one frame of fog lost the player's zoom for good.
  **R-8** the fall from a half-round orbit rolled through the pole: the look blends by its
  angles.
- **T1-5** coming down under an open chat locked the pointer under it; **T1-7** a look key
  let go in a text box kept the view turning; **X-9** one long task (a quicksave) took the
  view down - a second silent beat does now; **X-2** the bound key only entered; **T1-9**
  the enhanced crosshair stood at the centre of a camera 450 m up; **T1-10** in the
  Morrowind lane the rise began at the borrowed third-person camera and the fall snapped
  back (`mwViewHoldChanged`); **T1-12** the hint said WASD and Esc whatever was bound;
  **X-3** a save under the view recorded the borrowed third person, and a load under it was
  overridden when the view let go (`mwViewSaveCamera`; a load cuts the view first).

**Click to move (T2, X).** **T2-1** a road journey's resume aimed at the nearest leg in a
straight line - across the bay the road goes round, into the mod's ocean stop, again and
again: the leg it aimed at, or a later one reached over dry ground. **T2-2** the governor
counted the grid's outermost ring, queued anew at every crossing and fogged, and learned a
ceiling of x1 from walking pace: never that ring, nothing learned at x1. **T2-3** a view
journey was always reckless, so low health never stopped it: the player's own map choice.
**X-7** the arrival was a line even after the player came down: asked AT the arrival.
**T2-4** the plates outlived a load; **T2-5** the planner swam a corner of the sea; **T2-6**
the panel counted to the next bend; **T2-7** the planner walked the port's generated roads
with Basic Roads off; **T2-8** the mod's coordinate targeting was ignored, the climb went
1, 6, 11, a new click kept the old ceiling. **X-6** the held rate's reason was written and
never shown (the panel's title now).

**The travellers (T3, X).** **T3-1** the client gated clears with the marks, so in a busy
room the one frame over budget was the clear and the player who went in stayed drawn;
**T3-2** the relay fanned a clear from a socket that never marked, on the marks' budget
(a flood cost no strike and starved the marks): a clear takes out a mark that is THERE, on
its own budget; **X-8** a clear waited the 10 s floor: it goes at once (the relay takes it
past the cooldown - one a mark); **T3-3** a reconnect that replaced its own socket said no
leave, and its old mark stood five minutes: a join takes it out; **T3-5** `travOk` outlived
the socket; **T3-6** a welcome's marks were stamped fresh: rows carry their age. **T3-9** the
held map drew a party member twice; **X-4** the classic skin shared a position it could
neither show nor switch off. The relay's changes ride world122, still undeployed - its
law row rewritten in place.

**Rendering (R).** **R-1** the Deep Waters seabed, decorations and fish, the gate's fire and
the duel wall fogged from the raised eye (a fogged sea beside a clear beach): they upload
the focus, and a law test names every fogged program and who sends it. **R-2** the
traveller's own sprite went edge-on as the view orbited: its quad turns to the view.
**R-3** the sun's cascades stopped 216 m round the traveller: x4 under the view
(`SHADOW_VIEW_SCALE`, radii and depth), the maps redrawn on a scale change - the probe's
block now casts a real shadow from the air. **R-4** a storm off a coast hung 300 m of veil
through clear water: the foot stands on the lowest land, the sea's surface over water.
**R-5** the traveller's own storm vanished from the air: thinned to `CURTAIN_OWN_ALPHA`.
**R-6** veils past the fog's end or their storm's disc: not stood. **R-7** leaned tree tops
popped at the screen's edge: the cull sphere grows by h sin(lean). **R-11** the red storms
stood round an orbiting camera, and each peer showed the traveller's picture, not the
view's.

**Left, on purpose (each weighed):**
- The curtain's chord ignores ground inside the cylinder (a line of sight that meets a hill
  inside the veil is given the whole chord): the pass has no depth to read; a depth-aware
  chord is TV5-sized work.
- Blood decals z-fight past ~130 m from the air (a pixel or two): a larger near plane under
  the view would fix it, but every pass that reads the projection would have to be proven
  first - not worth two pixels.
- The per-frame costs (the heartbeat's re-arm, a score of small arrays, the route's path
  string, the marks' styles): measured small; left for a profile that shows them. *(Since
  profiled - PERF-TV below: the marks' styles were not small.)*
- The governor's reach assumes flat ground at the traveller (a ridge over a valley may see
  a pixel it does not count) - plausible, unmeasured.
- Mac's call 3 as TV0 records it includes "the others see smooth movement": the poses snap
  102 m a tick past about x94 at POSE_HZ 10, which the governor does not address - a
  departure, recorded here, for the relay's own arc.

## TV5 - DESIGNED, MEASURED, NOT BUILT (2026-09-28) - and the stage for what comes next

*Superseded the same day: Mac chose **edge markers** over these silhouettes ("TV5 - SHIPPED"
below). The ring-span design stays here as the record, should town shapes on the horizon be
wanted later.*

**The measurement that decides it.** The design said far-ring silhouettes for the places
beyond the grid. The world pass cannot draw them: its linear fog is EV4's `2400 x TD/3` metres
from the traveller, and the grid's edge is `TD x 819.2` - at every Land View of 3 or more the
fog ends 100 m INSIDE the grid (TD 5: fog 4,000 m, grid 4,096 m). Whatever stands past the
grid is fog in the world pass, from the eye or from the air. The far ring shows the province
past it only because it is its own pass with its own haze (EV8: its own projection out to
~60 km, `RING_HAZE_HOLD`), drawn after the sky at the far plane (`gl_FragDepth = 1`).

**So TV5 is a ring-span pass, and it needs one thing the ring does not have: depth.** A town's
roofs drawn in the ring's span would show through the ring's own hills, because the ring
writes the far plane for every fragment. The build, in order:
1. **The ring writes its OWN depth** in its own projection (a second depth attachment, or the
   ring's fragments at a depth mapped into the far slice the world never reaches), so
   anything else drawn in that span is occluded by the ring's hills. Pinned by the EV8
   tests that hold its far-plane law today (`test/ui/farring.test.js`, `test/render/perf2.test.js`).
2. **The towns**: for every location whose pixel lies between the grid's edge and
   `RING_RADIUS`, a cluster of boxes in its own rect (`locationWorldRect`), seeded by its map
   id, its block count its footprint, the climate's roof colour, lit by the frame's sun, in
   the ring's haze - a DISCOVERED place's plate on it under the view (TV2's plates).
3. **Measured**: the draw calls at the ring's full radius (one instanced call; the ring
   already builds its vertex grid off the same pixels).

**What the arc leaves ready for later content** - each a seam that exists now, named:
- **Journeys that leave from the air.** `beginTravelAlongRoute` takes any list of legs;
  a party's journey (PARTY-TRAVEL) or a ship's could hand it one, and the view's line and
  flag draw whatever `tvTrip` holds.
- **Marks for anything placed on the map.** The readout's keyed marks (`marks`, `pick`,
  `edge`) take a world point and a kind: quest targets, a party leader, a world boss's omen
  (WB1's ring), a hub (HUB1) can be marks the same way the places and travellers are. (OW-QUEST, 2026-10-19: the quest
  targets are.)
- **Travellers who say more.** The TV3 mark is seven keys and the relay refuses an eighth -
  on purpose (still so: OW-CHASE-RANGE's chase words ride BESIDE the mark, never in it - AUDIT OW-REVISITED L4-1, an
  eighth key had every older client refuse the traveller whole). A later field (a guild tag's colour, "looking for company") is a new relay
  version and a new key, never a squeeze into these.
- **The weather forecast from the air.** `forecastAt` (WEATHER3) is a pure function of place
  and minute; the view could hang a system's next hour under its curtain. (OW-FORECAST, 2026-10-19: the way's, here's and
  a place's card.)
- **Encounters seen coming.** The governor's unbuilt-ground count is per pixel; the same
  window could carry the foes a Travel Options journey will meet (its `enemiesNearby`).

## TV5 - SHIPPED (2026-09-28): the far places, marked at the edge

Mac, choosing between the ring-span silhouettes above and a mark: **"Edge markers"**. The
measurements behind the call: at the default tilt (52 degrees) and field of view (65) the
view's top edge meets the ground about 531 m ahead, and the horizon is in the picture only
at a tilt of FOV/2 or less - so a town's roofs past the grid would mostly be drawn where the
camera cannot see them. A mark can be seen wherever the town lies.

**What the player sees.** Every DISCOVERED settlement (a city, a town or a village - DFU's
town trio; not a dungeon, a temple or a farm) beyond the streamed grid and within
`TV_FAR_RANGE` (24 map pixels straight-line, about 20 km every way - AUDIT DEEP2 F8: it was a square, its corners 28 km off), the nearest `TV_FAR_MAX` (10) of them, as a
plate: in the picture, on the town; outside it, held at the screen's edge with an arrow
pointing its way. Its distance hangs under the name (tenths of a kilometre under ten, whole
kilometres past - the tenths would only flicker). A click on it is a journey there by the
roads - TV2's own planner and route; the journey's own end wears the flag, not a plate.
The grid's own places keep TV2's plates on the land; the far places start where the grid
ends, so no town is marked twice.

**How** (`systems/travel/travelFarPlaces.js`, pure): `settlementPixels` gathers the Bay's
settlements once from the host's pixel index, and past the Bay the host asks a near query each
time (`scenes/mapPlacesHost.js` tvFarSettlements, BAY-LEFT-MAPS below); `farPlaces` picks them by Chebyshev distance
(beyond the grid's radius, within the range), keeps the discovered ones (`tvPlaceSummary`,
DFU's discovery law: an undiscovered place has no name to go to), nearest first. The host
(`travelViewFarPlaces`) rebuilds the list only when the traveller's pixel or the grid's
reach changes, and a load empties it (BOOT-TDZ: declared above its readers). One pixel is
`PIXEL_KM` = 0.8192 km (MapsFile.WorldMapTerrainDim x GlobalScale).

**EDGE-DECLUTTER (2026-09-28, Mac: "Just #1").** Two towns - or a town and a rider - in much
the same direction were held at the same spot on the edge, one plate over the other and over
its click. Now the marks held at each edge keep their order along it and slide apart just
enough: down a side by their boxes' heights, along the top or the foot by their widths (the
click boxes, so no two clicks overlap). Each run of touching marks is centred on where its
marks would stand, so no arrow drifts far from its town, and each arrow still points its own
way. More than an edge holds (about ten plates down a side): spaced evenly along it, on
the screen. Measured: the readout stays inside PERF-TV's budgets (0.44 / 1.02 / 0.04 ms).

**EDGE-FURNITURE (2026-09-28, Mac: "Fix this bug").** A mark behind the camera is held at the
FOOT of the screen - and the foot is where the view's bar stands, drawn over the readout's
canvas, over the game HUD's vitals and hotbar (the HUD stays up under the view); its name hung
below its arrow, off the bottom. Roughly half of all directions are behind the camera, so many
far towns and riders were unseen (TV3's riders since TV3). At the top they sat on the compass
and, on a journey, under the travel panel (AUDIT DEEP2 E14: the stacking said right). Now the readout MEASURES what stands in the top and the
bottom half (`.hud-top`, `.hud-bottom`, `.travelpanel-bar` and its own bar; a layout read, so
at most twice a second and again each time the view opens - never per frame or per mark) and
`edgeHold` holds marks inside that clear room: a point under the furniture is held at its edge
as one off the screen is. At the foot the name and distance stand ABOVE the arrow and the click
box with them; down a side, a low mark's label is kept off the bar. The pieces' classes are
pinned against the style sheet, so a rename cannot leave a mark under one unseen. Measured in
the browser probe against the real bar - and since AUDIT DEEP2 against the HUD's real vitals
too; the readout stays inside PERF-TV's budgets. (AUDIT DEEP2 grew the measure: below.)

**Proof.** `test/ui/travel/tv5_far_places.test.js`, `tools/mutants/tv5.json` (the TV5, EDGE-DECLUTTER and
EDGE-FURNITURE records), `tools/travelViewProbe.mjs` (a far place held at the right edge, its
plate on the screen, a click on it a journey).

## PERF-TV - the Overworld's own frame cost, made golden (2026-09-28)

Mac: "I also want to ensure performance is golden." Measured in a real browser
(`tools/travelViewPerf.mjs`, Chromium): the update's JavaScript plus the style and layout it
owes, forced inside the timer so nothing hides in the next paint. The frame is 16.7 ms at
60 Hz; the view's own share must be a rounding error.

| The readout, a frame | Before | After | Budget |
|---|---|---|---|
| 20 places + 64 travellers, moving | 5.8 ms | 0.38 ms | 0.60 ms |
| 20 places + 256 travellers, moving | 35.7 ms | 0.91 ms | 1.50 ms |
| 20 places + 64 travellers, at rest | - | 0.05 ms | 0.15 ms |

**What was slow.** Every mark was a DOM node moved by style each frame, and each mark held
at the edge read the screen's size AFTER the previous mark's writes - a forced layout per
held mark. 256 travellers cost two frames.

**What changed.**
- **One canvas.** Every mark - dots, plates, edge arrows, the destination's ring - is drawn
  on the readout's one canvas (`ui/travel/travelViewHud.js` `drawMarks`); each label is a sprite
  drawn once and reused (`SPRITES_MAX` 512, dropped when the display face arrives). The
  screen's size is read ONCE a frame, before any write. A picture that did not change (a
  camera at rest) is not drawn again - the frame's signature is compared first.
- **Clicks by position.** The canvas takes no pointer; a plate's click is found where it was
  drawn (`travelViewHudPickAt`, the one on top), asked by the view before it picks the
  ground. A plate held at a side edge keeps its whole box on the screen.
- **The world host keeps what did not move.** The ground's generation (`tvGroundGenNow`:
  a pixel built or dropped, the floating origin re-anchored, and every half second besides)
  keys: the marks' scene points (`tvSceneKept`), the route's legs past the one being walked
  (hundreds of terrain reads a frame on a long road), the cap's unbuilt count, and the rain
  curtains' lowest land. The curtains ask the land only under the veils kept
  (`CURTAINS_MAX`, not every raining cell in reach), and a veil is asked again only when its
  centre drifts into a new `CURTAIN_MEMO_M` (32 m) cell.

**Proof.** `tools/travelViewPerf.mjs` (the budgets; exits 1 on a blown one),
`test/ui/travel/tv5_far_places.test.js` (the screen read counted, the redraw skipped at rest and taken
on a move, the click boxes, the curtains' samples counted), `tools/mutants/tv5.json` (the
PERF-TV records).

**FB0929 - THE ROUTE LINE, BY ITS FRAMES (2026-09-29, the Discord through Mac: "The moment I go
to my Travel Map and select a far away destination, the game drops to sub-10 FPS").** The timer
above holds the update and the layout it owes, never the paint, and its route was 120 points on
the screen. A pick on the travel map is a line of a hundred legs and more (400 pixels of
Hazelnut's roads: 139 legs, 557 points), and a point of it beside the eye's plane projects
hundreds of thousands of pixels out: the dashed brass line ran 1.5 million px, and the browser
laid its 100,000 dashes, off the screen too, and rastered them again every frame the camera
moved - 383-433 ms a frame in Chromium (the median, two runs; turned half round, 217-267), where a
click in the view drew in 16.7. The JavaScript was never the cost (the update 0.1-0.4 ms; the
plan is made once, at the pick). `routePath` now cuts the line to the screen grown by
`ROUTE_CLIP_PX` (16 px, past the casing's round cap), a new stroke where it comes back on: the
same line on the screen - byte for byte when it lies wholly there, its first stroke the old one's
from the feet to the edge, dashes and all - and the far pick at 16.7 ms a frame. Where the line
comes back onto the screen its dash pattern starts at the edge. The readout is world.js's alone
(travelView.js names the FOUR HOSTS).
**Proof.** `test/world/fb0929_farroute.test.js` (4: the planner on the vendored roads, the host's line
lifted from world.js, the view's own camera and the readout), `tools/mutants/fb0929_farroute.json`
(13, all dead), `tools/travelViewPerf.mjs` (a journey's line timed by its frames: 20 ms).

## AUDIT DEEP2 - the whole branch again, six reviewers, before the merge (2026-09-28, Mac: "Do another deep audit on everything before we decide to merge")

Six read-only reviewers, one a lane (the view and its input; journeys; the region's
travellers online; rendering under the raised camera; the readout, TV5 and PERF-TV; the
records), each finding verified by reading and most reproduced in a scratch script, the
browser's among them. About sixty findings; every one below fixed, pinned, and each pin made
to fail (`tools/mutants/tv1.json`..`tv5.json`), or weighed and left, said why.

**The one HIGH (E1).** The Overworld's own bar sat ON the HUD's health, magicka and fatigue at
every screen size - same layer, built after them, so it painted over them: the vitals could
not be read while the view was up. And on a phone the touch layer's buttons stood over its
Return (E2). The bar is now LIFTED clear of what stands under it - a band across its middle
(the vitals, the buttons mid-foot) and anything under its Return; never a corner block its far
end only reaches (on a narrow phone that put it mid-screen) - measured with the rest of the
furniture (`measureFurniture`), and it takes its own clicks (E13: a press missing Return by a
hair walked the traveller to ground hidden under the bar). The probe now stands the HUD's own
vitals up and checks both. On a narrow portrait phone the bar still covers the quick-slot
diamond's lower cells - weighed: the alternative was a bar mid-screen over the picture.

**The readout** (E3-E15, F11): the furniture grew to the quick-slot block, a journey's junction
disc and a phone's buttons, sorted into BANDS (middle third: the marks at that edge stand clear)
and CORNERS (a side third: the marks along that edge stop short; a side's own marks stand over
it); the two bands of an axis shrink together only past three quarters of the screen (E6: a
per-band cap put the marks ahead inside a phone's travel panel); a bar whose words change is
measured again the next frame. EDGE-DECLUTTER's lone mark is clamped before it is weighed (E3,
a regression of EDGE-FURNITURE's); a mark on the top or the foot whose box reaches a side's
line stands on that side (E4: the corners were never parted); every run's boxes stay in their
stretch (E8). The arrow is notched (E5: a near-equilateral head read the same turned a third);
a far town in the picture wears its distance above its dot (E9); labels in the --data face
(E11); the sprite cache drops its oldest one at a time (E12: a clear redrew every label in one
frame, 3-4 ms); a lifted finger leaves no hover (E10); the drawn places are said in words to a
screen reader (E15, a visually hidden list, written when the set changes); a NaN mark is placed
nowhere; the screen is read once, before the frame's writes (F11). The Plus gauntlet stays the
one cursor over a plate (E10 - Plus's own law; the plate lights brass instead).

**The view's input** (A1-A9): the travel panel's own presses stop there (A1: a click on + or
Exit also activated what stood before the traveller's head); a pad is a cursor under the view
and the world's activation and swing are never pressed from under it (A2); an enhanced overlay
over the view (the Tab dial) has the keys, and the fall never relocks under it (A3); the wheel
zooms by its size (A4: a trackpad crossed the whole band in a flick); the key never repeats,
nor Escape past the fall (A5); a repeat of a key held before the rise is the host's (A6); a lost
focus holds nothing (A7); the bound key answers indoors (A8); a live duel refuses the view and
its clicks (A9/B-4).

**Journeys** (B-1..B-6): a far town's journey keeps its destination - the flag is held at the
edge with its distance, and a click on it takes the journey up again after a stop (B-1); the
governor counts every ring of the grid but its edge, always, and a second cut waits 2 s
(`TV_GOV_SETTLE_S`) for the first to show (B-2 - reviewer B's toy of the host's own queue: the
reach measured down the top edge's middle missed the corners, and one pixel building took x40
to x1 inside a second; V2 at 2 s left no hole on the screen at 0.4, 0.6 and 1.0 s a build, the
best clean average of the variants tried); the place caches key on what is discovered (B-3);
water is where the click landed, against the sea's own height (B-5); the planner widens its box
until no route outside it could be cheaper (B-6: 6.6% of real trips cost more than they should).

**Online** (C1-C5; relay world122 rewritten in place - still undeployed): a clear with no mark
behind it is metered as a mark (C1: a free flood); a clear over the room's budget is OWED and
said on its next pass (C2), a new mark or a leave making it moot; the client's gate takes twice
the room's burst (C3: a bunched room dropped honest marks); a Region link that moves empties the
book (C4); the switch's words say the region's channel, not the party's pose (C5); a welcome
never lists a socket already closing.

**Rendering** (D1-D9): the veil stands in its storm's own outline and weighs its front's clip
across the rim, as the sky's does (D1: a circle, and a clip that shrank a storm to a 50 m
column); the view follows the floating origin (D2: a lurch at every pixel crossed, 37 m at
400 m/s); the veils stand under the cells the sky draws (D3); the sea clamps a veil's foot at
every point (D4); an undrawable veil takes no slot (D5); the riders and walkers take the view's
eye (D6); the cascades grow half way up, not on the rise's first frame (D7); a door resets the
flats' lean (D8); the chord's plane is said (D9).

**The records** (F1-F15, E14): probe counts, test titles and rows, four mutant notes, the
patch notes' promises (the band, the shadows' reach, "only when the land changes", the Enhanced
map's door, the 20 km), the stacking claim, the memo's step, TV3's cadence - each said true.
Five order pins that passed on a missing line (`indexOf` of -1) now demand both lines.

**Left, on purpose (each weighed):**
- Marks are not refused off the room's region (a lying client can put its mark anywhere on the
  bay): the name is the token's, so no harm beyond a wrong dot was shown; the receiver could
  filter by the political map later.
- The book can grow past the welcome's 256 in a very busy region (to the channel's 2048): PERF-TV
  measured 256; a draw cap waits on a region that busy.
- Id squatting in a region's channel (a peer id read off the world roster) predates this arc
  (CHAT1); its own slice.
- `clearView`'s lift on a 70-degree face 2 km tall doubles the face's height (A-S1): no real
  Daggerfall face is that long at that slope.
- The chord across the ground plane (D9), and the air's haze marched from the raised eye (D-S3,
  estimated three display levels or fewer).

**Proof.** `test/render/tv1_travel_view.test.js` 30, `tv2_click_to_move` 21, `tv3_travellers` 21,
`tv4_weather_above` 11, `tv5_far_places` 16; `tools/mutants/tv1.json` 80, `tv2` 47, `tv3` 45,
`tv4` 36, `tv5` 61 - all dead; `tools/travelViewProbe.mjs` 35 checks (the HUD's vitals among
them); `tools/travelViewPerf.mjs` inside its budgets.

## OVERWORLD NAMES - every player named as in play (2026-09-28, Mac: "Full, like in play")

Mac asked whether players' names, titles and party names show in the Overworld as they do in
play. Read off the code, they did not, in two ways:
- **The players nearest had no name at all.** TV3 left a player within the pose range
  (`RANGE_PIXELS`: 3 map pixels, floored to the pixel - up to about 3.3 km along an axis) to their
  body, "named over their heads" - but the names over the heads are culled past `NAME_RANGE` (60 m)
  from the frame's EYE, and the view's eye stands 40-780 m back from the traveller (its height over
  the tilt's tangent; about 200 m as it opens). So a party travelling together - the common case -
  was, but at the steepest and lowest, a handful of unnamed specks.
- **The far ones wore a bare name.** The relay stamps a traveller's mark with the title, the
  glyphs, the Renown and the guild's tag (`badged`), but the client's door read the title and the
  glyphs alone (`readBadge`), and the marker drew the name alone.

Now EVERY player drawn here - within the pose range, their bodies standing, the concealed and the
veiled never (`online.drawable()` less `_hiddenPeers` and `_veils`, as this frame's `onlineFrame` sifted
them) - is a marker over their head as the region's travellers are, held
at the edge off the picture; the names over the heads STAND DOWN while the view is up
(`drawPeerNames`: one name a player, never two - and with them the chat bubbles over the heads:
under the view a line said nearby reads in the chat log alone); and every player's marker is their name as it
reads in play (`badgeSprite`, off `ui/playerBadge.js`, `net/renown.js`, `net/guild/guildLaw.js` - the
same law both name faces read): the title its own line ABOVE in its own colour (a gradient title
across its letters; never the party's green - ACC3), then one row centred - the Renown in its amber
box, the name (my party's in `PARTY_GREEN_CSS`, a stranger's the bone), the guild's tag in steel,
the glyphs in theirs. The traveller frame now reads the Renown and the tag at the door
(`readRenown`, `readGuildTag` - a bad one is nothing) and the book keeps them. A badge that changes
at rest is drawn again (the picture's signature carries it). The held map keeps names alone.

**The audit (AUDIT NAMES, 2026-09-28).** Four more, each pinned and each pin made to fail:
- **N2-1 - the badge never reached the readout.** `drawHud` (scenes/travelView.js) rebuilt each
  mark field by field and left `badge` behind, so in play every marker was the bare name; the
  readout's own test had called `updateTravelViewHud` directly. It carries the badge now, and the
  test drives the real `createTravelView` through `drawHud`.
- **N2-2 - THE SWITCH HOLDS.** A player within the pose range is named wherever they stand only
  when they are of my party or the region already has their mark (they share where they are with
  it). One who shares nothing ("Show me to travellers in my region" off) is named only as close as
  play names them - `NAME_RANGE` from where I stand - and never held at the edge: the switch's
  words ("only your party and players close enough to see you know where you are") stay true.
- **N2-3 - the invisible share nothing.** The region's mark was sent while I was concealed
  (invisible, blending, a shade), though within the pose range no concealed player is marked; the
  switch's gate (`shown`) now reads `concealBits`, and the clear goes the frame it takes.
- **The journey's arrow** - a player on a journey who comes within the pose range keeps the arrow
  their region mark wore (its `tv`).

And the marker's face, measured in a browser with the real fonts (N1):
- **N2-4 / N1-7 - over the head, and clear.** A player's name in the picture stands OVER their
  head (NAME1: never across the body it names - it hung under the point, over the body), its foot
  `NAME_ABOVE` (8 px) up; and a party side by side (heads 1.5 m apart are 2-7 px at 1080p) wears
  its names STACKED, each moved up past the ones drawn before it (`clearOfNames`, in the marks'
  own stable order) - they printed one over another.
- **N1-1 - no stall.** A busy region's first frame (or a font arriving, which lets every image go)
  made every badge at once, 70-175 ms at 256; now `BADGE_BUILDS_PER_FRAME` (16) a frame, the rest
  their bare name meanwhile, and the picture drawn again until all are made.
- **N1-5 - the box is the badge drawn.** The layout estimated a badge's width 30-75% wide: a
  titled player ahead on a phone was sent to a side, two that fitted were spread evenly across
  each other. The badge is made (or found) before the layout and its own size is the box.
- **N1-6 - the corners.** The top and the foot are spread first, and a side's run starts under the
  top's labels (ends over the foot's) that reach into it - a titled label at the top lay across
  the side's first name.
- **N1-2/N1-3/N1-4 - the face as in play.** The gradient title (Shadow Fang) is painted as the DOM
  face paints it (`titlePaint`, AUDIT A4/A5) - no blurred shadow, an edge of its own colour and
  black under the gradient - where "Sh" was unseen on dark ground; the wolf's red eye
  (`GLYPH_DETAIL`), the stroked glyphs at the name face's 1.6, the Renown under the row's shadow;
  and the badge in the face names wear in play (`PIXEL_STACK`).
- **N1-8 - memory.** The kept images are capped by their pixels (6 M, ~24 MB) as well as their
  count: 512 badges at a phone's dpr 3 came to ~95 MB.
- **N1-10** - the region's travellers' party colour asks `isPartyPeer`, as play's names do: my
  own other tab is never my party's green.

Measured after: 64 moving 0.33 ms, 256 moving 1.39 ms, 64 at rest 0.05 ms (budgets 0.60 / 1.50 /
0.15; `tools/travelViewPerf.mjs`).

**Proof.** `test/scenes/tv3_travellers.test.js` (the wire, the book, the host's marks and the names
standing down), `test/ui/travel/tv5_far_places.test.js` (the marker's face: the title above in its colour,
the Renown amber, the party's green, the tag's steel, a stranger's bone, a title won at rest
redrawn); `tools/mutants/tv3.json` and `tv5.json` (the OVERWORLD-NAMES records).

## OW FIXES - the first field report on the Overworld (2026-09-28, Mac)

- **RESUME-OUT** ("option persists"): the held map asked "Resume your journey to ...?" at EVERY open while a
  stopped journey was pending - the mod's own behaviour (TravelOptionsMapWindow.cs: No closes the box and keeps
  `DestinationName`), with no way to be rid of it. The prompt now has a third answer, **Forget it**, which ends the
  journey through the mod's own `ClearTravelDestination` (`onForgetTravel`); Resume and Not now are the mod's.
- **OW-THEME** ("The overworld ui needs to follow enhanced ui theme"): the bar (`.tview-bar`, the journey bar's
  window role), its Return (`.tview-back`, a button) and its compass (`.tview-compass`, a well) are in the Enhanced
  Plus frame roles (`ui/enhanced/enhancedFrame.js` FRAME_ROLES - paint only), and the canvas's plates are drawn in the
  theme's own stone (`themePlate`: the page's `--slate` at 0.78 alpha, read at each open; a new stone lets
  the old plate images go).
- **OW-BIG** ("The player sprite needs to appear larger. Like it shouldnt be at the tiny scale"): under the view the
  traveller's own sprite is drawn `tvOwnGrow(distance)` times its size (`player/travelCamera.js`: one more for every
  `TV_OWN_GROW_M` = 32 m from the eye to the feet, never past `TV_OWN_GROW_MAX` = 12, 1 near the ground) - about
  40-50 px tall at 1080p at every zoom, a Mount & Blade party's icon. The view hands the step (`frame().grow`), the
  host passes it on the body's `face`, and the sprite lane (`player/eyeOfTheBeholder/eotbBody.js`) makes its batch again at each whole
  step; a grown sprite casts no giant's shadow (`selfCard` off) and hangs no lantern on a waist that moved.
- **OW-PEERS** (FIELD BUGS 2026-10-01 #11, "you cannot see other player's sprites"): OW-BIG grew the traveller
  alone, so every other player stood at their own size - a speck at 330 m under the name that stood over them. Each
  is grown by the same law at their own feet (world.js `peerGrow`, `tvOwnGrow` of the view's eye to them): the
  riders, the beasts and the walkers (`net/peer/peerRiders.js`, its size, offset and reach), the dolls and the class
  sprites (`net/remotePlayers.js`), the Morrowind bodies (`net/peer/peerBodies.js`, `drawThird`'s `grow` and the view's
  lean, culled by their grown reach); their names over the grown heads; none casts a giant's shadow, no walker hangs
  a lantern. `test/net/peer/fb1001_overworld.test.js`.
- **OW-WAGON** (WAGON-HITCH, 2026-10-04, Mac: "the wagon when attached to the horse should show in the overworld if
  attached"): the cart's trailing wagon is drawn grown with its rider, about the point it hangs from - mine by the
  view's own step (`frame().grow`, handed to `hcc.draw` as `selfGrow`), another player's by `peerGrow` at their rider.
  A wagon at its own size hung a speck under the grown horse. Only the draw grows; the pose the runtime keeps, parks,
  saves and sends is the wagon's own. Its AUDIT (WAGON-HITCH B1/B2/B7): the grown wagon casts no giant's shadow (the law
  above), finds its ground with a probe that rises with its reach (a hill its own length tall swallowed the mod's fixed
  8 m), and its grown wheels turn g times slower for the same road. `06-Systems/Horse-Cart-And-Cargo.md` WAGON-HITCH, `test/systems/horse/wagonhitch.test.js`.

**Proof.** `test/ui/heldmap.test.js`, `test/ui/travel/tv5_far_places.test.js`, `test/player/eyeOfTheBeholder/eotb_body.test.js`,
`test/render/tv1_travel_view.test.js`; `tools/mutants/ow1.json` (14 records, all dead).

## OW ROUND 2 - no ground travel, the road walked on, no mountains (2026-09-28, Mac)

- **OW-ONLY** ("Remove the ground travel alltogether. Now selecting a location should immediately transition you to the
  overworld"): on the enhanced interface a pick on the map (`beginAcceleratedTravel`) is the Overworld's OWN journey - a
  place by the roads (`travelViewRouteTo`), a spot by `travelViewWalkTo` - refused, with the view's own reason, where the
  view may not rise; any Travel Options journey raises the view the first frame no window, foe or gate forbids it
  (`tvJourneyUp`, silently); and a view the PLAYER brings down (Return, Escape, the key: `onLower`) stops the journey -
  through the panel (the mod's Camp, `messages.pauseTravel` - AUDIT OW3 J1; it was a bare `interruptTravel`), the
  destination kept, so the map's Resume takes it up again, in the view. A cut (a door, a window,
  a death, a foe) is not the player's choice and is never counted. The classic skin keeps Travel Options exactly, and
  so does First-Person Travel, the switch that gives the first-person journey back (OW-TOGGLE, below; off by default).
- **OW-ROADSIDE** ("Sometimes routes do follow roads, but appear traveling alongside it"): the first leg ran from wherever
  in the start pixel the traveller stood (up to 400 m off the road) to the far end of the road's first straight run -
  beside the road the whole way. A route whose first step is a road's or a track's now JOINS it first
  (`travelRoute.js joinPoint`: the nearest point of that run's line, clamped to it; the leg's own `at`, which
  `startRouteLeg` aims the autopilot at), and the drawn route joins where the walk does.
- **OW-MOUNTAINS** ("Bumping into a mountain can cause insane lag and cause you to take character damage. You shouldnt be
  able to navigate mountains"): the planner refuses an OPEN step into the Mountain climate (226) or up or down more than
  `TV_STEEP_RISE` (16, the small heightmap's units) between two pixels (`openStepBlocked`); a road or a track goes where
  it was laid (over the passes); the step out of the start and onto the goal are never refused. A spot journey is now
  routed too (to the spot's pixel round the peaks, then to the spot), and a spot among the peaks is refused ("The
  mountains cannot be crossed on foot.").
  RETIRED 2026-10-08 by the owner, in the Wrothgarian zone's merge (MOUNTAINS WALKABLE): `openStepBlocked` refuses
  no step and the ground calls no pixel a peak - the mountains are walked on foot everywhere
  (`11-Multiplayer/Wild-Zone.md` section 19).

**Proof.** `test/systems/travel/tv2_click_to_move.test.js` (three more), `tools/mutants/ow2.json` (18 records, all dead).

## THE OVERHAUL - a living Overworld (TV6-TV8, DESIGN, 2026-09-28)

Mac (2026-09-28): "Random encounters and nearby dungeons implemented should somehow be detailed implemented into the
new overworld. Like think mount and blade and how you can see enemies in the overworld. Like a true overhaul for the
new overworld." His calls, the same day: **Roaming parties**, **Discover on approach**, **Leader drives**, **Shared per
area**. Enhanced interface only (the Overworld's lane); the classic skin keeps DFU exactly.

**TV6 - THE DUNGEONS, DISCOVERED ON APPROACH.** Every dungeon (`formats/mapsFile.js` LOCATION_TYPES: Labyrinth,
Keep, Ruin, Graveyard, Coven - DFU's travel-map "dungeons" filter) within `TV_FAR_RANGE` (24 pixels, ~20 km) stands on
the Overworld: a discovered one is a plate with its name and distance, held at the edge and clicked for a journey, as
the far towns are; an UNDISCOVERED one is an unnamed mark (no name, no journey) at its place. Coming within
`TV_DUNGEON_FIND_M` (1 km) of an undiscovered dungeon, outdoors on the enhanced interface, DISCOVERS it (the port's own
store, `discoverLocation`) and says so on the screen ("You have found <name>."). A departure from DFU, Mac's call: DFU
discovers on the location's rect (PlayerGPS.PlayerLocationRectCheck) and says nothing. The held map and the Overworld
read the same store, so a dungeon found either way is named on both.

**TV7 - THE ROAMING BANDS.** Enemy bands roam the wilderness and can be seen from above, as a Mount & Blade party is.
- *Where and what:* a band is BORN of the land and the shared clock - a pure function of (map pixel, time bucket) and
  WORLD_SEED on the shared minute (`sharedClassicMinutes`), as TV4's storms are - so every player in an area computes
  the same bands with nothing sent. Its members come from Daggerfall's own tables: the climate x day/night table
  (`encounters.js` resolveEncounterTableIndex - none in a town's rect by day), the group filled by
  `rollGroupComposition` (2-5; as built it rerolls solitary types away, so no band is one), rolled from the band's own seed.
- *How they move:* a band WANDERS a seeded path until it SPOTS a player (the sight radius from the band's kind, longer by
  day); then it CHASES, and the chase is simulated by the chased player's client (the port's owner model - WORLD6b) and
  streamed to the others under a key of its own in the foes frame (validated outside `wire.js`, the WoD camps' way: no
  relay change). A chase gives up past a leash; a band that gave up or fought is spent for its bucket for everyone.
- *Contact:* at `TV_BAND_CONTACT_M` the Overworld comes down (the view's own `danger`) and the band's members stand as
  real foes around the traveller (`exteriorFoes.spawnFoe`, placed) - exactly the band that was seen. On a Travel Options
  journey the band is the journey's `enemiesNearby`: the stop, and on a cautious journey the mod's own avoid roll
  (luck + Stealth - 50) - success: the journey takes up again, at walking pace while the band's foes still stand near
  (AUDIT OW4 J5); the foes that stood stay. (AUDIT OW5: "the band loses the trail" was never so.)
- *Seen from above:* each band is a marker in the Overworld - as built a red point (TV7 BUILT below), not a grown sprite -
  with its kind and number ("Orc, 4"), red; a chasing band is drawn as any other in the picture (AUDIT OW5: "wears the
  chase" was never so) and held at the edge off it. In play (the view down) a band is met only when it was chasing
  already - seen from above - and stands its foes at BAND_STAND_M; one never seen from above is never met in play
  (AUDIT OW5: "a band within the pose range stands as its foes" was never so).

**TV8 - GROUP TRAVEL, THE LEADER DRIVES.** A party leader's Overworld journey (a town or a spot) is PROPOSED to the
members through the party pose (PARTY-TRAVEL's own shape, a walked journey this time - a new field, so a relay version,
world124 - world123 on its branch, THE MERGE took world123 for the raids); a member gathered with the leader (within PARTY_REST_RADIUS) who accepts starts the same journey (the same
route legs) and travels it beside the leader. A stop for one is a stop for all - a stamp that only moves forward, as
PARTY-REST5's `restEnemyAt` is; the leader's resume resumes them. A band that makes contact with one halts them all (as built: the member's stop is the party's).

**Order of the build:** TV6 (self-contained), TV7 (the bands, no relay change), TV8 (the party's journey, world124).

**TV6 BUILT (2026-09-28).** `systems/travel/travelDungeons.js` (pure: `dungeonPixels`, `nearDungeons`, `dungeonToFind`,
`TV_DUNGEON_MAX` 12, `TV_DUNGEON_FIND_M` 1000); the host's `travelViewDungeons` (kept between pixels and finds, a load
forgets it) and `dungeonFindFrame` (four times a second, the enhanced interface outdoors: `discoverLocation`, then
"You have found <name>." on the screen); a found dungeon past the grid is a far plate (its name, its distance, a
journey - within the grid TV2's own plate), the rest are the readout's LAIR look - a dull red point and a "?", no
journey, never held at the edge. Proof: `test/systems/travel/tv6_dungeons.test.js`, `tools/mutants/tv6.json` (14 records, all dead).

**TV7 BUILT (2026-09-28).** `systems/travel/travelBands.js` (pure): a cell of BAND_CELL_PX (2) map pixels holds a band in a
life of BAND_LIFE_MS (12 real minutes on the shared clock) at 0.30 by day and 0.45 by night, born at a seeded point
the land allows (the host's `bandOk`: no water, no place's pixel); it WANDERS 75 s legs at 1.3 m/s, each bent up to a
quarter turn, turned back off the land's edge - every client computes the same bands in the same places, nothing sent.
Its make is the camps' themed group (`rollGroupComposition`, now exported) rolled from its own seed off its birthplace's
table. Under the Overworld a band that sees the traveller (320 m by day, 190 by night) CHASES at 5.2 m/s times the
journey's time scale (a slow walker is caught; a quick one, a runner or a rider gets away); at 30 m (with the view down, 140 m) it STANDS as those
foes around the traveller on its own bearing (`_standCampEncounter`, now taking the band's `yawRad`) - and the view's
`danger` and the Travel Options journey's own enemy stop (and its cautious avoid roll) do the rest; past 900 m, or two
minutes without closing a metre, it loses the trail and is gone for its life. Seen from above: a red point with its kind and
number ("Orc, 4"); a chaser held at the edge. **Online** the bands themselves are shared - born, placed and wandering the same for everyone - and TV7b (below) shares
the chase. What a band IS scales to who sees it, as Daggerfall's encounters do (`rollGroupComposition` reads the
viewer's level): two players of different levels can read different members off one band; the fight is the chaser's.
Proof: `test/systems/travel/tv7_bands.test.js`, `tools/mutants/tv7.json` (19 records, all dead).

**TV7b BUILT (2026-09-28) - THE CHASE, SHARED.** The chaser's client says its chases on its own cell foes frame under
`bd` (`[[id, x, z, 1]]`, the band's place in native units) and the bands spent there (`[[id, 0, 0, 2]]`), at most
BANDS_WIRE_MAX (8) - validated at the reader (`validBandWord`), as the World of Daggerfall camps' `st`/`sp` are, never by
the relay (NO relay change). A chase asks for a frame (`bandMoved`, as a moving boat's word does). A reader shows a
peer's chase where it runs (for BAND_WORD_MS after the word; then the band wanders on), never starts its own chase of
that band, and spends every band a peer spent - one band, one fight, everyone's. Two players who saw one band in the
same breath: the lower id keeps it (`chaseYields`), alike on every client.
Proof: `test/systems/travel/tv7_bands.test.js`, `tools/mutants/tv7.json` (33 records, all dead).

**TV8 BUILT (2026-09-28) - GROUP TRAVEL, THE LEADER DRIVES.** `systems/party/partyWalk.js` (pure). A party leader's Overworld
journey (a place, or a spot) with a member gathered within PARTY_WALK_RADIUS_M (60 m) is a WALK on the leader's party
pose - `tw` `{x, y, sx?, sz?, at, go, h}` (net/wire.js validPartyPose, **world124**, PARTY_WALK_RELAY_MIN 124 - AUDIT OW5: it read world123, the raids' relay: offered
only through a hub that carries it). A gathered member is asked ("<leader> leads the party to <place>. Travel with
them?", ui/yesNoBox.js, within PARTY_WALK_ASK_MS); on a yes they walk the same journey in their own Overworld (a place
by the roads - a place they have not found themselves walked to as a spot - or the spot itself). The leader's stop
HALTS the walk (`h`) and every member stops with it; the leader's journey taken up again (the map's Resume) SETS OUT
again (`go`) and every member who said yes takes theirs up again, from where they stand. A member's OWN stop - a foe, a
band's contact - is said on their pose (`ts`), and the leader halts on a stop newer than the last set-out: a stop for
one is a stop for all. An arrival ends the walk; a member's arrival is never a stop. **Deploy:** world124 must ship to
the relay before the walk is offered (an older relay strips `tw` and `ts`; nothing breaks).
Proof: `test/systems/travel/tv8_party_walk.test.js`, `tools/mutants/tv8.json` (17 records, all dead), `test/net/relayversion.test.js`
(the world124 law).

**AUDIT OW3 (2026-09-28) - everything since the merge, audited in five lanes, verified, fixed.**
- *Journeys (J):* the view brought down stops its journey through the panel (`pauseTravel`, the mod's Camp), so the
  held map offers Resume, and `tvJourneyUp` raises the view only while the autopilot drives. On the enhanced interface
  a walked trip the Overworld refuses is refused (`tvOwnsJourneys`), never fast-travelled; a coordinate pick on the sea
  is refused in the view's words. A resume rejoins the road: `route.join` is the nearest point of the run taken up
  (`joinPoint`), aimed in its own pixel before the leg, and the view's line goes through it. Both journeys draw one
  point per leg (`routeDrawPoints`). The peaks rule is the ground's: every step out of a Mountain pixel is walked and
  none into one; no start exemption; the goal step is exempt only for a place (`goalExempt`), so a plateau spot is
  refused. The Morrowind body grows with OW-BIG (`drawThird` `grow`, sprite depth `max(4, halfW + boxH + 1)`).
- *Dungeons (D):* the pure list is `dungeonRows` (map rows, gathered once), `spawnedPixels` (the live index),
  `nearDungeons` (filtered, THEN capped at 12: a row with no named place, a spawn's pixel, a found dungeon inside TV2's
  grid spends no slot), `dungeonApproach`, `dungeonToFind`. SPAWNED dungeons (Mac's "nearby dungeons implemented")
  stand as `spawn:<map id>` once the spawned feature has told of them: a "?" until filed, then a named far plate whose
  click is TV2's spot journey to 20 m outside the exterior; the find never takes a spawn. The find and the bands stand
  down while `worldMoveBusy()` (an arrival's feet lie).
- *Bands (T7):* a contact tries the band's bearing, a quarter turn either way, then behind, and the band is spent only
  once it STOOD (BAND_STAND_RETRY_MS 1500, BAND_STAND_TRIES 5); every chase is stepped on its own band (a life's
  turn no longer strands it); a chase gives up BAND_GIVE_UP_MS after its last metre gained (`gainAt`), not two minutes
  in; the make rolls from `bandMakeSeed` (its own stream - the birth's first draw is under the spawn chance, so
  Daggerfall's roll over 80 never came) by the night its life began in (read once a life) [AUDIT TIME: the night at the life's middle, online on the sky]; a wander leg's way is
  chosen by its whole end (no mid-leg jumps); water, a door or a town's rect ends a chase SPENT; a peer's word is kept
  only for a band that can be about me (`bandNearMe`) and the tables are pruned each life.
- *Group travel (P):* every halt stops through the panel, and "journeying" is the panel with an autopilot under it. A
  walk's END is Travel Options' own `cleared` count (an arrival, Exit, Forget it, a load), never the destination
  fields, so a spot walk's stop is a halt. When the walk ends members are released and walk on to the same place;
  halts come only from `h`. Taking the halted walk's own place up again sets it out again in the same round. A member
  is asked, and set out, only when free (outdoors, alive, no window, no foe, no duel); the question comes down with its
  round, its 30 s or danger; a yes dies with its round; the leader's walk is believed PARTY_WALK_GRACE_MS (10 s)
  without a pose. The wire is unchanged (world124).
- *Known, not changed:* the relay fans a cell's foes frame 3 pixels out (`RANGE_PIXELS`) while bands are drawn 6
  (BAND_REACH_PX) - a player 4-6 pixels off hears a chase or a spent band only on coming nearer (the spent list rides
  every full frame) (this limit alone answered: OW-CHASE-RANGE, 2026-10-19, below). Members' paces are their own clients' (a member at x1 behind a leader at x10 falls behind).
  A band's make reads the viewer's level (TV7 BUILT). A traveller on a plateau ringed by cliffs outside the mountains,
  with no road off it, is told there is no way by land.
- Proof: `test/systems/travel/tv2_click_to_move.test.js` (28), `test/systems/travel/tv6_dungeons.test.js` (11), `test/systems/travel/tv7_bands.test.js` (10),
  `test/systems/travel/tv8_party_walk.test.js` (12), `prbow1_bow`, `mwhead1_window`, `eotb_view` (+1 each); `tools/mutants/ow3j.json`
  (28), `ow3d.json` (27), `ow3t.json` (18), `ow3p.json` (36) - all dead; the older sets re-aimed.

**AUDIT OW4 (2026-09-28) - the second full audit of the branch (five lanes, the OW3 fixes included), verified, fixed.**
- *Bands (B):* the bands were asked for at the MAP pixel, whose y runs the other way from their rows - every band stood
  at the mirror of its latitude and almost nobody met one (`bandPixelOf`, in the list and in a peer's word). The land a
  band may stand on is the maps' own places taken at boot (`_bandPlacePixels`), never the live index a spawn joins per
  client. A stand counts only with a member placed; the bearing is kept from the first contact; a door ends every chase,
  spent; death or a window HOLDS a chase, a boat ends it; no band drawn with the camps off; the spent list pruned by
  life; the sight read by the bands' night. bandFrame/bandStand/bandHear are lifted from world.js and RUN in the tests.
- *Journeys (J):* only the traveller's OWN peaks are left freely: `planRoute` flood-fills the start's connected
  Mountain area (`peakAt`), and `openStepBlocked(..., leaving)` frees only its steps - a range entered by a road is
  walked no further. The ladder ends on the whole map (`ROUTE_MARGINS` [6, 20, 60, 1000]); the ground is read once
  (`routeGround`) and its land pieces answer "no way by land" once the first box misses. A won avoid roll takes the SAME
  route up again (a spot's became "Following a road"). The map's Resume re-plans on the enhanced interface
  (`travelViewResume`; a spawn's walk resumed is its door). An Overworld journey with its view down runs at x1 until the
  view rises. A new disease stops through the panel. The grown Morrowind body's quad leans by the view's up.
- *Dungeons (D):* a spawn's plate walks as a place's DOOR (`travelViewWalkTo` `{ door }`: never refused for the peaks,
  its own pixel's step exempt), its edge facing where the route's last leg starts (`lastLegStart`); an expired spawn
  (`tvSpawnGone`) is never listed; a load clears the announced spawns; found spawns past the stream stand again after a
  reload (`filedSpawns`, `tvSpawnAt`, the shared `_spawnCloneAt`); the list keyed on the index's generation
  (`_locIndexGen`); the cap of twelve taken found-first.
- *Group travel (P, X):* a spot re-aimed in its pixel sets out again (members re-routed); a halt lapses after
  PARTY_WALK_HALT_MS (5 min) and drops off the pose; a stop meaning the journey cannot run (WALK_BALKS: low health or
  fatigue on cautious travel, stuck, blocked, the sea) halts the party once, then the leader's Resume passes that member
  by until their own; a member stopped by a halt who takes the journey up leaves the walk; the question is tracked through
  the window stack, withdrawn if buried, and an answer counts only while the round stands; nobody sets out mid-arrival.
  A member walking to a place they have not found, or to a spawn, walks it as its door. The wire is unchanged (world124).
- *Known, not changed:* some towns among the peaks with no road reaching them are now "no way by land" (the peaks' law
  holds); the "historical" example numbers in test/scenes/citedrift.test.js move with every citation shift, as they always have.
- Proof: `test/systems/travel/tv2_click_to_move.test.js` (32), `tv6_dungeons` (19), `tv7_bands` (15), `tv8_party_walk` (22),
  `to1_travelOptions` (+1), `prbow1_bow` (+2); `tools/mutants/ow4j.json` (26), `ow4d.json` (38), `ow4t.json` (14),
  `ow4p.json` (25), `ow4x.json` (3) - all dead; the older sets re-aimed.

## OWS - THE SEA ON THE OVERWORLD - SHIPPED (2026-09-28, the player's asks)

The player, on the Overworld: *"1. You should transition to your boat if traveling across water then back onto land
when hitting land 2. The pirate quest system should work like how we're changing enemies and nearby dungeons. Like mount
and blade, being able to see other players sailing in the overworld and other enemy ships"*.

Built on this branch's Overworld (TV1-TV5, main's). The Overworld round's own branch (TV6-TV8: the dungeons found on
approach, the roaming enemy bands, group travel) had not merged; the raiders below take the bands' shape - a seeded
cell a life, a course that is a function of the shared clock, a chase the chased traveller's own - in their own module,
`systems/seaRaiders.js`. The two walks are one law waiting to happen: whichever lands second FOLDS them (Active-Arcs).
Read off that branch on the way: its bands are born about map row `499 - py` (`bandsNear` counts cells from the
traveller's south-counting pixel row, `bandOf` places a band's native z from the same number as a north-counting row),
so away from row 250 none comes within sight - recorded here for that branch; the raiders keep MapsFile's own two laws
(`pixelOfNative`/`nativeOfPixel`, pinned against `worldCoordToMapPixel` and the traveller mark's).

### OWS1 - the ships on the map

- **The way the frame always carried.** TV3's traveller mark has `m` - foot, horse, cart, ship - and nothing sent the
  ship: `player.transportMode` is never Ship (TRANSPORT_MODES.Ship is "not a real player transport mode", and Come Sail
  Away holds the transport on foot at its helm). A traveller at a helm, or aboard another's boat (CSA-K), now sends
  `ship`, headed as the boat's bow (`csaBoatUnderMe`, `csaBoatYaw`); `travellerDue` sends a changed way at once. The
  relay's shape law already took 0-3: no relay version.
- **Drawn as a ship.** The readout draws a mark whose kind says `ship` as a hull under a sail (`drawShipMark`, upright
  as a map draws its ships) in its look's colour - a stranger's verdigris, my party's green - its name standing over the
  sail (`SHIP_MARK_RISE`); one off the picture keeps the arrow. The held map inks the same (`inkShip`; the host's rows
  say `ship`). A ship's mark rides the sea's top, never the seabed Deep Waters carves under it (`tvSceneKept`'s
  `onSea`). Within the pose range a sailor is their body on their own boat (CSA-J, CSA-K), marked over their head.

### OWS2 - the crossing

- **The boat to hand** (`tvSeaMeans`): at its helm now (the route starts afloat), mine moored within 60 m (boarded at
  the journey's start - the mod's StartSailing, "You control the boat!"), or a packable boat's PARTS in the pack (the
  route starts ashore). A boat crosses when it has sails or a crew's oars: the Rowboat's lone rower spends 11 fatigue each
  second at its oars (OAR_FATIGUE) - a character of 50 Strength and 50 Endurance holds 6,400 ((Str + End) x 64), about
  ten minutes of rowing, little more than a kilometre at the oars' 2 m/s - so it is no crossing's boat; the Carrack makes no
  way under the Classic helm - the mod divides its cargo by a Cargo modifier it lacks (kept, CSA-D) - and crosses under
  the Responsive one, the default, which gives her a hold (AUDIT NAV2 F16: she was refused under the helm she sails
  best under). No boat: the sea is refused as it always was, and
  a route a boat would have made is said ("There is no way there by land. You need a boat to cross the water.").
  SHIP-SAIL (2026-09-28, Mac: "Shouldn't it already function as such?"): unless the place is one the map's ship
  passage sails to from here - then the passage is OFFERED ("Sail there by ship?", its fare and days) and, on Yes,
  taken as the map takes it (`01-Overview/bugs/Field-Bugs-2026-09-28e.md`). The passage is Daggerfall's, so it is offered
  with this mod off too (AUDIT 28e); the boat's line is this mod's, said only with it on.
- **The planner's sea** (`systems/travel/travelRoute.js`, `sea`): three layers of the grid - ashore with the boat to hand,
  afloat, ashore with it left behind. A step from a land pixel into the water is the LAUNCH (`embark`), steps between
  water pixels are SAILED (`sea`: 1.2 a step - a little dearer than a road; 1.5 beside the land, so a route stands off a
  wide sea's shore and still threads a strait), a step out onto land the LANDFALL (`landfall`); each launch and landfall
  costs `shore` (6) on top of its step, so no route hops in and out of the water. A packable boat is to hand again after
  its landfall (it packs); a crewed ship is left where it landed, so its journey crosses once. Afloat, a boat never
  sails through a corner of the land. A spot on the water is reached afloat - a bay in a land pixel too - and a place
  on the water's pixel (a harbour town) is walked into, as ever. The heuristic's road cost stays under every step.
- **The legs.** Each launch, sailed run and landfall is a leg of its own (`routeLegs` folds a straight sailed run); a
  sailed leg arrives in the middle quarter of its water pixel (`SEA_LEG_SIZE`, 205 m - a boat under sail comes about in a
  hundred metres, it never threads a road's 12.8 m), a spot on the water in its own 51 m square (`SEA_SPOT_SIZE`).
- **The launch** (`tvSeaLaunch`): on a leg that puts to sea, ashore, every quarter second - the first water on the way
  to the leg's mark (and fanned 30 and 60 degrees about it) within 40 m, the boat's root pushed out past it by the
  hull's reach, and all five of its nodes on water by the nodes' own law (`nodeReadingAt`, the pool's `hullRig`); there
  the parts go in (`LaunchFromParts`: "Boat placed!", the parts' UID and packed cargo aboard, the parts spent) and the
  helm is taken. Not at the water yet: walked on.
- **The sea legs** (`tvSeaSail`, `systems/seaHelm.js`): the journey's hand on the helm, through the one input seam
  (`csaJourneyHelm` beside the keys' and CSA-L's panel's): the rudder keys toward the course, the ToggleSail key's
  edge, the oars' autorun - the mod's own code moves the boat. Under sail the course is the leg mark's bearing, unless
  the mark lies inside the rig's no-go cone about the wind's eye - 35 degrees with a lateen aboard, 68 for square sails
  alone (where GetSailPower's pull times the course's share toward the mark is best) - where the boat BEATS, a tack
  held until the mark's bearing swings 20 degrees past the eye, then about. The oars: to turn the boat more than 30
  degrees (the mod turns a boat under sail by the way it makes - one head to wind never comes round - where the oars
  turn it twenty degrees a second), in a calm (a wind under 0.25), for 20 s after the sails made no way for 8, within
  120 m of a landfall's shore (the sails come down and the oars take it in), and away from land close ahead on a leg
  that does not land there (hard over to the freer hand); and whenever a crew's oars are the faster (the Large
  Galley's crew rows at eight against its one square sail's four or five - a crew rows for nothing, a lone rower pays,
  so a crewless boat sails). A sailed leg that comes no 20 m nearer its mark in 180 game seconds stops the journey
  ("Your boat can make no way toward its mark."); a boat beached on a leg that does not land stops it ("Your boat has
  run aground.").
- **The landfall** (`tvSeaLand`, `tvSeaAshore`): on the landfall leg, beached - or 10 m off the shore and all but
  stopped - the helm is left by the mod's own disembark key ("You stop controlling the boat!", the sails lowered); when
  its second's hold is over the traveller is set on the first dry ground ahead of the bow, else about the boat, within
  60 m, and a packable boat with none aboard is packed (the mod's own PackBoat, "You store the boat in your
  inventory") - else it is left moored ("Your boat is left moored where it landed."). The land legs are walked on.
- **Afloat, Travel Options stands down twice**: its ocean stop (it is for a traveller who walked into the sea) and the
  walk's steering (the helm's hand steers). Its other stops are its own: foes, the cautious traveller's health and
  fatigue, a place under LocationPause. A journey that ends at sea - arrived at a spot on the water, or stopped - takes
  its hand off the helm and lowers the sails.
- **The words.** The trip's line says a crossing ("To Wayrest, by sea"); a passenger aboard another's boat is refused
  a journey ("its helmsman sets the course"); the route's line rides the sea's top.
- **Measured** at the mod's own helm, by these keys alone (the port's runtime over the vendored hulls, open water, the
  wind at 1.5, a mark 1,500 m due north; game seconds, the wind blowing toward the bearing given):

  | hull | 0 (running) | 45 | 90 (beam) | 135 | 180 (dead into it) | 225 | 270 | 315 |
  |---|---|---|---|---|---|---|---|---|
  | Large Boat (a lateen, no crew) | 390 | 417 | 383 | 542 | 697 (253 fatigue) | 463 | 328 | 356 |
  | Small Ship (two lateens, crewed) | 207 | 219 | 202 | 275 | 366 | 237 | 176 | 190 |
  | Large Galley (the crew rows) | 220 | 220 | 220 | 220 | 220 | 220 | 220 | 220 |

  Pinned at 600 m in `test/systems/travel/ows2_crossing.test.js`.

### OWS3 - the raiders, seen coming

- **Seeded, never sent** (`systems/seaRaiders.js`): a cell of 6 x 6 map pixels holds at most one raider a life (20
  minutes of the shared clock; a chance of 0.35), rolled from the cell and the life alone, born on the OPEN sea (its
  pixel and all eight about it water, the ocean's climate - never a lake or a bay's mouth). It sails its own course at 3
  m/s, bending up to a quarter turn each two-minute leg, turning about at land and lying to with none either way - a
  function of its seed and the clock, so every player in the region sees the same sails at the same minute.
- **Marked** (the host's `travelViewRaiders`, read each half second over the cells within 12 pixels): a raider within the
  grid's reach is a ship in the cinnabar, "Pirates" under it (the raid quest's own word); one giving chase is marked
  wherever it is, held at the edge off the picture.
- **The chase** (`raidFrame`): a traveller at sea (at a helm or aboard) under the view is sighted by a raider within
  1,000 m by day, 500 by night (DFU's night hours), one at a time; the chase sails 4.2 m/s at the world's time scale -
  the Large Boat before a fair wind outsails it, becalmed or beating it is caught - and is lost past 3,000 m, after
  three minutes of the world's clock without a metre gained, or when land stands in its way; lost, it sheers off for
  its life. Ashore, every chase is given up. A chase begun under the view goes on in play (alongside at 120 m there,
  60 under the view). A load ends them. The chase is the chased traveller's own (TV7's way): nothing is sent.
- **Alongside** (`raidContact`): the mod's own raid (`raidAtSea`) - OnPreFastTravel's sailing arm (`armRaid`, its one
  home: the ambush armed, a player without a ship lent the large one, both ship blocks `_smallraid`) and
  CheckforEncounters' coroutine, so TransportToShipWithDelay starts WAQ_SHIP_SMALLRAID and boards the ship as the fast
  travel's ambush does ("You've been attacked by pirates..."); the journey stops ("Pirates come alongside!"). Refused
  as the mod refuses (an ambush armed or boarding, a lent ship out), the raider sheers off unheeded. Come Sail Away's
  helm is left by the load, as any load leaves it; the quest's Leave Ship puts the traveller back where they boarded -
  their boat's deck. The fast travel's own roll stands beside it, whole. Warm Ashes off: no raiders.

### AUDIT OWS - the lead's audit of the three (2026-09-28, the player: "Audit this")

Four read-only lenses were sent over the frozen tree (the planner and the helm, the crossing's host, the raiders and
the marks, FAR-CLIP1) and all four stopped at a usage limit before reporting; the audit was finished by hand:
- **The planner, differential.** 400 random grids (water, roads, both ends random), the old planner against the new
  with no boat: pixels, kinds and cost identical, every one. 300 more with a boat to hand: the crossing's cost never
  above the land route's, and never none where land had one.
- **A1 - a load kept the crossing's hand on the helm.** The journey's rudder keys and oars were let go only on the
  next exterior frame's `tvSeaFrame`; a load mid-crossing into a dungeon (whose water Come Sail Away sails too) left
  the rudder held for the next helm taken there. A load now lets them go and forgets the crossing; the state is
  declared above the load and the ocean stop's `atSea` that read it (BOOT-TDZ - it had been declared 8,000 lines
  below them).
- **A2 - a landing left behind held the ocean stop down.** A journey that ended during the landing's second left
  `phase` at 'landing', and `atSea` read it: Travel Options' ocean stop stood down for every journey after, the
  map's own included. The journey's end now forgets the landing.
- **A3 - the spent raiders grew for the session.** Each life's sails are new ids; a new life now forgets the last
  life's spent ones (a chase still running is kept).
- **Read and kept:** the raid's boarding records the traveller's place at the helm (`boardOrDisembark`'s
  `shipMemory`), so Leave Ship sets them back on their boat's deck - if the pool has not stood the boat again by the
  time the ground is built, they land in the water beside it and climb its ladder. Not verified in a browser.
  FAR-CLIP1's lens did not report; its own tests and 27 mutants stand.
Each pinned (`test/systems/travel/ows2_crossing.test.js`, `test/systems/ows3_raiders.test.js`) and each pin made to fail.

### What it is not

- The raiders are marks: no hull is drawn for them in the world (the pool's peer path could stand one; a later slice).
- The raid's fight is the mod's own, on its ship's deck - the ship boarded - not the open sea.
- The classic lane has no Overworld: DFU's map, its fast travel and Warm Ashes' roll, whole.

## FB0929 - the mouse captured under the Overworld (2026-09-29, a field report)

Satranath (Discord, relayed by Mac): "Y doesn't free the mouse on overworld until after you press Escape." OW-ONLY's
rise came on the wrong frame for the lock: a journey begun or resumed on the map raises the view on the frame after the
map goes down (`tvJourneyUp`), the very frame whose look gate has just asked for the lock back on the map's close edge.
A browser answers that request a task later, so the view's `freeCursor` found nothing to release and the lock landed
under a view whose cursor is its own - the mouse captured, Y refused under the view (TV1's law, which stands), until the
browser's own Escape ended it. The map's Overworld button never raced: its commit raises the view a frame before the
gate asks, and the freed cursor refuses. `player/pointerLock.js` now lets go of a lock that lands while the cursor is
free. AUDIT OW5 V1 (below) landed the same law on main the same day, in `requestLook`'s one page-wide listener; the
merge kept that one and dropped this branch's copy in the toggle's listener, and `test/scenes/fb0929_overworld_mouse.test.js`
(3) drives it in every host that binds the toggle (world.js, with worldModes.js and dungeonContext.js under it;
exterior.js; dungeon.js), every pin made to fail.

## TV-WASD - THE KEYS TRAVEL - SHIPPED (2026-09-28, Mac: "Also need to add the ability to travel faster with WASD")

Under the view the movement keys walked the traveller at walking pace (TV1) - a crawl from 260 m up, beside a click's
journey at Travel Options' x10. Now, while the view is UP (not rising or falling) and no journey drives, a held movement
key runs the world's clock at the travel speed, and the traveller covers the land as a journey does.

- **The speed is the spinner's.** The Travel Options panel's own `timeAcceleration` - DefaultStartingAccel (x10) until
  the player turns it on a journey's strip, never past the limit in force (`accelerationLimit()`). Travel Options off:
  no spinner, no speed - the keys walk at walking pace, as the view's clicks refuse ("Turn on Travel Options...").
- **The clock, not the legs.** The keys set `timeScale` as a journey does: offline the calendar runs with the walk (the
  road costs its hours, Travel Options' law), online the body alone (TO-ONLINE); the motor's fixed step scales with it.
- **Governed as a journey is.** `travelViewGovern` hands TV2's load governor the keys' rate where a journey hands it
  the mod's ask (`want = journey ? travelAsked : walk`), so the clock runs no faster than the land raises the ground
  the view can see; the bar says it - "Travelling at ×10", "Travelling at ×5 of ×10" while held - on the trip line a
  journey's words take when one runs.
- **x1 at once** when the keys are let go, a journey begins (its own ask wins), the view falls or is cut, a window
  opens, the body swims, or it stands at a helm or aboard a boat (the keys are the sea's there: the helm has its own
  time keys). The frame's two nets - "a scale with no panel behind it is a journey over", above every mode gate and
  after the mod's update - spare the keys' scale only while the view that runs it is up
  (`tvWalkHoldsTimeScale`), so a door that cuts the view (AUDIT DEEP X-1) resets it on the same frame.
- **The walk waits for the ground** (TO-FIELD's sentence for the journey): while the keys travel, the axes are held
  when the ground the way they move the body is missing and still coming - the body's heading turned by the axes
  (`cam.yaw + atan2(strafe, forward)`; the motor's right is (cos, 0, -sin)).
- **DECIDED AS LEAD** (Mac, TV1: "Your the lead and this is your baby"): the Overworld alone, not the first-person walk
  (a raised speed on the street is a different game); the spinner's speed, not a new setting; the hint still says
  "to walk". Each is one line to change.

Pieces: `scenes/travelView.js` `travelWalkRate`, `TRAVEL_VIEW_TEXT.travelling`; `scenes/world.js` `travelViewGovern`,
`tvWalking`, `tvWalkHoldsTimeScale`, the two nets, the trip line, the keys' ground gate. Proof: `test/systems/travel/tv_wasd.test.js`
(6: the law gate by gate, the words, the world's own governor MOUNTED over the real governor and clock, the nets and the
gate by source), `tools/mutants/tv_wasd.json` (13 dead - two of them on to1's K2 pin, re-aimed because the one strafe
zero in the host is now this gate's, never the journey's). TV2's three pins on the governor's lines and the trip line, and its A2
mutant, re-aimed to the grown lines (never loosened). Ledger A (continued): THE OVERWORLD'S MOVEMENT KEYS TRAVEL.

## TV-PACE - THE OVERWORLD STOPS AT ×10, AND AT ×20 ON A FED MOUNT (2026-10-19) - REVERTED (2026-10-22, below; this is the record of what it did)

The request (#1059): limit Travel view to ×10, and let a fed horse run at ×20; then, the same for a cart and a caravan,
nobody faster than ×20, on foot never past ×10, and Hungry or Starving at ×10 instead of a food percentage.

What it did: while the view was up, the host's frame set a ceiling each frame (setTravelViewPaceCap, from the upkeep's
travelViewCap for the transport), and the speed dial ran under it and kept the number the player chose (TV_PACE_FOOT
×10, TV_PACE_MOUNT ×20 in `systems/travel/travelPace.js`). On foot, aboard, or swimming the keys, ×10. A horse, a small
cart, an open wagon or a caravan at Fed could run at ×20 (steedCare's mountHunger: the horse ridden, or the hungriest
horse of the team that pulls). Hungry and Starving held it at ×10. Bringing the view down gave the road's ×100 and the
open ground's ×60 back. The near-enemies dial was not this ceiling.

**TV-PACE REVERTED** (2026-10-22, the owner, at BOARD-SIFT's merge: "Do me a favor and also revert the change made from
one of my developers along with this merge. They changed speeds"). The Overworld runs at the dials again, as PACE-DIALS
and WILD3 set them: the road's ×100 and the open ground's ×60, under a wild zone's cap where one stands. Out: the frame's
ceiling line (bootWorld's ceiling 36,256 -> 36,255, `test/scenes/hostceiling.test.js`), the ceiling and its two
constants in `systems/travel/travelPace.js`, the stepper's two titles and their two keys in every language
(`travel.pace.viewFoot`, `travel.pace.viewMount`), steedCare's mountHunger, the upkeep's travelViewCap, and their pins
(`test/systems/travel/tvpace_mount.test.js` (DELETED), the TV-PACE test in `test/systems/travel/pacedials.test.js` - PIN MOVED
back, its host regex to the two ground lines). `tools/mutants/waypoints_pace.json`'s three PACE records are aimed at
`paceNow`'s and `paceCanRise`'s own lines again. SPAWN-THIN, merged in the same pull request (#1059), is not reverted: it is the owner's own
ask (`06-Systems/Systems-Arc.md`, SPAWN-THIN), and the relay's world224 stays its version. Horse-Care's road section
reads as before TV-PACE.

## OW-TOGGLE - FIRST-PERSON TRAVEL, A SWITCH - SHIPPED (2026-09-28, Mac: "bring back the original travel option as a toggle. Off by default.")

Mac, the same day: *"Travel Options was changed. The normal first person travel accelerated was removed in favor of the
overworld travel"* - OW-ROUND 2's OW-ONLY. It comes back as a switch; OW-ONLY stays the default.

- **The switch:** `GeneralOptions.FirstPersonTravel`, the port's own key on Travel Options' pane (AvoidObstacles'
  shape: the vendored `modsettings.json` does not carry it and its words say so), OFF, curated onto the mod's tile so it
  is reachable, and READ LIVE - a flip takes effect at once (AUDIT OW5 T1: read with the mod's other settings at boot,
  it waited for the page to load again - a save loaded in play kept the old answer - under the tile's "Takes effect
  when the world next loads", which stays the mod's other keys' law; the key's own words say "Takes effect at once").
- **On:** a journey picked on the travel map is Travel Options' own, in first person, as before OW-ONLY (with its
  roads on, the Overworld's route instead, still in first person: TO-ROADS, below). `tvOwnsJourneys` answers no, and
  every door that asks it follows: the map's pick begins the mod's journey on the ground (`beginTravel` /
  `beginTravelToCoords`, the popup's estimate along), never refused for the Overworld's reasons (the peaks, the water),
  and its refusals fall through as before (onTravel, onTravelToCoords); the view does not rise with a journey
  (`tvJourneyUp`); a view the player brings down stops nothing (the view's `onLower`); and the journey under a lowered
  view runs at the speed asked, not AUDIT OW4 J5's x1 (`travelViewGovern`). The map's Resume of the mod's journey is
  the mod's; a ROUTE the Overworld planned is planned again from where the traveller stands, either way (AUDIT OW5 J1:
  `travelViewResume` asks the route, not the switch). The Overworld itself is untouched: raised by hand, its own clicks
  still begin its own journeys - routes, round the peaks and across the water - the load governor holds them, and
  brought down they walk on, on the ground (a crossing keeping its journey's clock: AUDIT OW5 G5). GROUP TRAVEL (TV8) is
  the Overworld's: under the switch a leader's map pick asks nobody, as before the Overworld (PARTY-TRAVEL's `propose`
  never takes a walked trip) - a routed one leads, TO-ROADS; a click in the view raised by hand still leads the party.
- **Off:** OW-ONLY exactly.

Proof: `test/systems/travel/ow_toggle.test.js` (6: the key; the host's doors MOUNTED from their own source over the real settings
store, both ways; the live read; the governor mounted both ways), `tools/mutants/ow_toggle.json` (7 dead). TV2's three
OW-ONLY pins (`tvOwnsJourneys`, `onLower`, `tvJourneyUp`), to1's key-set pin, and four mutant records (ow2
OW-ONLY-down-and-on, ow3j J1 and J2, travelnav TN-switch-off-the-tile) re-aimed to the grown lines, never loosened.

## TO-ROADS - FIRST-PERSON TRAVEL FOLLOWS THE ROADS, A SECOND SWITCH - SHIPPED (2026-09-29, FIELD BUGS 2026-09-29d, SylviaBun on the Discord: "Travel Options First Person doesn't follow roads like Overworld Travel Options does")

SylviaBun: *"When traveling in first person, however, the travel route always just goes the straightest shot to your
destination running you through the forest etc. A way to toggle this behavior to match or not would be nice."*
Reproduced first, on the host's own code: under First-Person Travel a map pick is Travel Options' own journey, its
autopilot aimed at the destination's rect from the first frame, through whatever the road goes round. That is the mod's
(TO-FIELD: it "does not route along roads to a named destination and never did"), and OW-TOGGLE asked it back as
exactly that - so it stays the default, and the road is a second switch.

- **The switch:** `GeneralOptions.FirstPersonTravelFollowsRoads` ("First Person Travel Follows Roads"), OW-TOGGLE's
  shape - the port's own key on the mod's pane (not in the vendored `modsettings.json`, its words say so), OFF, on the
  tile right after the switch it serves, read LIVE ("Takes effect at once"). Online the player's own - the room holds
  only the mod's switch, its two journey dials and its ports rule (TRAVEL-ONLINE, `ONLINE_ROOM_MOD_KEYS`).
- **On, with First-Person Travel on:** the map's pick is ROUTED. `scenes/world.js` `tvRoutesJourneys` grows from
  `tvOwnsJourneys` (every Overworld journey is routed) and is what the map's three forks ask (`beginAcceleratedTravel`,
  `onTravel`'s refusal line, `onTravelToCoords`). The routed arm is the Overworld's, whole - THE ONE CONSTRUCTION SEAM:
  its gates, a place to `travelViewRouteTo` and a spot to `travelViewWalkTo` (the planner, OW-ROADSIDE's join,
  OW-MOUNTAINS, OWS2's water, `beginTravelAlongRoute`'s legs on the one autopilot). The view's own doors ask who OWNS the
  journey, never this, so it is walked in first person: `tvJourneyUp` raises nothing, a view raised by hand and brought
  down stops nothing (`onLower`), and it runs at the speed asked, never AUDIT OW4 J5's x1 (`travelViewGovern`).
- **Its life** is the mod's first-person journey's and the route's at once: the mod's panel, Camp and every stop its
  Update makes (a place's route is a named journey); the arrival in the mod's box (`tvQuiet`: the view is down); the
  map's Resume plans it AGAIN from where the traveller stands (AUDIT OW5 J1 asks the route, not the switch); a jump
  stops it (J2); a route that puts to sea is sailed as OWS2's, its clock kept (G5 - the code a view-raised route brought
  down already walks, not re-proved here). The panel counts the distance: the popup's estimate is the straight walk's.
- **The route's refusal is the answer:** no way by land, the peaks, the water - said in the Overworld's words
  (SHIP-SAIL's passage offered where the ship reaches) and done: never the straight walk the player switched away from,
  never DFU's fast travel (AUDIT OW3 J2's two doors, asking `tvRoutesJourneys`).
- **Group travel (TV8):** a leader's routed pick leads the party gathered, as the Overworld's does (`partyWalkBegin`
  rides `travelViewRouteTo`) - the same legs for everyone, each member walking by their own switches. The roads key off,
  First-Person Travel's pick asks nobody (OW-TOGGLE).
- **Off (the default), or First-Person Travel off:** OW-TOGGLE and OW-ONLY exactly. **The classic skin** keeps Travel
  Options exactly (`isEnhanced()`). **THE FOUR HOSTS:** `scenes/world.js` alone, as TO1's seam; `scenes/exterior.js` has
  no travel map, roads or journey; `scenes/worldModes.js` and `scenes/dungeonContext.js` are indoors, where the map's door
  refuses first (IsPlayerInside) and a door ends a journey (AUDIT-TO1 G2) - named, not wired.
- **DECIDED AS LEAD**, each one line to change: the refusal is the route's, never a fall back to the straight walk (the
  player asked for the road, a silent beeline is the report itself, and the switch is the way back to it); a routed pick
  leads the party; the classic skin untouched; the key name, whose row reads "First Person Travel Follows Roads".
- **Known, not changed:** the route's gate is the view's (`travelViewAllowed`), so a pick made under the water is
  refused in the view's words ("You cannot survey the land from under the water."), as the Resume of any route already
  is (AUDIT OW5 J1); and a spot's panel reads the Overworld's "The marked spot", not the mod's map coordinates.

Proof: `test/systems/travel/fb0929d_toroads.test.js` (6: the key; REPRODUCED and fixed on world.js's doors and the Overworld's route
LIFTED from its source and run over the real planner, a real Travel Options and the real settings store, on a map of its
own - a road bent round a square of forest, a peak, an island; the journey's life and the governor; the refusal; both
switches both ways, the classic skin and the live read; the seam swept in the source), `tools/mutants/fb0929d_toroads.json`
(16: 14 dead, 2 equivalent as recorded). TV2's three fork pins, to1's two and its key-set pin, OW-TOGGLE's rig, and five
mutant records (ow2 OW-ONLY-ground-travel, ow3j's two J2, ow_toggle and travelnav off-the-tile) re-aimed to the grown
lines, never loosened. Not seen in a browser.

## AUDIT OW5 - the Overworld audited before the merge, seven lenses (2026-09-29, Mac: "Before we merge. Can we do a comprehensive audit on the overworld, just want to make sure it's perfect.")

Seven read-only reviewers on one snapshot (`ce2b154d`): journeys and routing, the clock and the load, the view's life
and its input, the living map, online and the party, rendering and cost, and the toggle with the words and the record.
Every finding was verified by the lead against the code before it was fixed; each fix is pinned where it can be run
(`test/player/eyeOfTheBeholder/ow5_audit.test.js`, 14, beside the suites below) and each pin fails under its mutation (`tools/mutants/ow5.json`).

**Fixed.**
- **D1 THE FIND ASKS EVERY UNFOUND DUNGEON IN REACH** (MAJOR). The find searched the plates' list, TV_DUNGEON_MAX with the
  found first (AUDIT OW4 D7): a traveller who had found a dozen within 24 pixels never found another on approach. Its own
  uncapped list now (`travelViewFindList`, TV_FIND_REACH pixels, the game's own dungeons, kept per pixel). AUDIT OW5b D1 (below) found the same: this list is the one the
  merge kept, and OW5b's own half - an unfound one in the grid spends none of the twelve plates - stands beside it.
- **R1 A WINDOW HOLDS THE PIRATES' CHASE** (MAJOR). `raidFrame` read a window as ashore: any window gave every chase up
  and spent its raider - a free escape. A window or a death holds it now, the bands' law (AUDIT OW4 B9). AUDIT OW5b S2 found the same (with the
  quarry's own deck, and S6's world being moved): one line since the merge.
- **J2 A JUMP STOPS A ROUTE'S WALK** (MAJOR, two lenses). A fast travel taken from the map mid-journey, a teleport, a
  Recall, a respawn, `/leader`, `/tp`: the route journey walked on from the new place straight at its old leg, the
  Overworld risen over it. `_teleportToPixel` stops a route journey through the panel (the Camp, the destination kept),
  and the map's Resume plans it again; a journey of the mod's own aims on at its destination as the mod does.
- **V1 A LOCK GRANTED AFTER THE CURSOR WAS FREED IS LET GO** (MAJOR). A journey begun or resumed from the map raised the
  Overworld on the frame after the map closed, over the look gate's relock - the lock landed under the view (no cursor,
  a drag turned the head, a click picked where Begin had been). `player/pointerLock.js` releases such a grant.
- **V2 THE HEAD'S ACTIVATION IS NEVER PRESSED FROM UNDER THE VIEW** (MAJOR). E (Interact), F on a body (SocialInteract)
  and the loot keys' tap reached the hidden head's ray - a door took the traveller inside, a townsperson opened talk.
  Each refuses while the view is up; the journey panel's own E is taken above them.
- **P1 A MEMBER SETS OUT ONLY WHERE THE OVERWORLD WOULD** (MAJOR). TV8's set-out skipped the view's doors: a passenger
  said Yes and was walked off the leader's deck; a classic-skin member was walked a route. `walkFree` asks the view's
  own gate and a passenger's refusal.
- **S3 A MOORED BOAT ONLY WHERE THE ROUTE SAILS** (MAJOR). A boat moored in reach started every search afloat: a trip
  inland boarded it, landed at once and packed it. A plan that never sails is planned again on land (`tvMooredDry`).
- **S4 AN OWN-PIXEL SEA SPOT IS SAILED TO** (MAJOR). From the helm, a spot on the sea in the traveller's own pixel planned
  no leg; the crossing read land, landed the boat mid-sea and packed it from under the traveller. One sea leg now.
- **J3 THE WHOLE MAP'S RUNG IS NEVER CUT SHORT** (MAJOR). The planner's last rung stopped at 200 000 of the map's 500 000
  cells: a far pick round a range with no road to help was told "no way by land" by the rung meant to find it.
- **R2 THE GIANT CASTS NO SHADOW** (MAJOR, cosmetic, on by default). OW-BIG's grown sprite still cast into the sun's
  cascades (a fifty-metre shadow at a low sun) and the lamps' maps: `selfCard` off was never that. `noShadow`.
- **S1 THE OCEAN STOP IS STOOD DOWN FOR THE CROSSING ALONE**. A journey of the mod's own begun at a helm (First Person
  Travel, the classic skin) ran on unsteered at speed; the mod's own stop ends it now.
- **J1 THE RESUME RE-PLANS ANY ROUTE**, under First Person Travel too (a click in the view raised by hand, a party's walk).
- **T1 THE SWITCH IS READ LIVE** - a save loaded in play kept the old answer under "the world next loads".
- **G1 THE BAR SAYS WHY THE CLOCK IS HELD** - AUDIT OW4 J5's ground hold read "while the land loads"; now "until the
  Overworld rises".
- **G2 THE OVERWORLD'S LINES OUTLAST ITS CLOCK** - "You have found X." at x10 was up half a second; its own lines are held
  the time asked at the scale they are said at (`tvSay`).
- **G3/G4 THE KEYS' TRAVEL** (TV-WASD, this branch's own): the bar shows the keys' speed over a stopped route kept for the
  Resume; and the keys' travel lets go when the page loses the focus (a key held then never sends its keyup, and the
  clock ran on at the spinner's rate).
- **G5 A FIRST-PERSON CROSSING KEEPS ITS CLOCK** - Come Sail Away's landfall reset left x1 under a panel asking x10.
- **B1 A HOLD CARRIES THE BAND'S PATIENCE** - two minutes in a window lost every chase the frame after. AUDIT OW5b B4 found the
  same; the merge kept B4's own chase clock (`_bandClock`, standing still on every frame a chase does not step - a world
  being moved too) and retired `bandHold`, and this audit's pin steps at the frame's clamp, so it fails either way back.
- **B2 THE BANDS FROM THE GAME'S OWN ROWS** - a world-data mod's rows (each client's Replace Game Artwork) barred pixels
  on one client and not another. AUDIT OW5b B3 the same; this fill is the one kept.
- **P3/P4/P5/P6 THE PARTY**: a sea spot walked as the sea (by the planner's byte - the walk's record carries no word and
  a new one is a relay's); a stop stamped from the future halts nothing (PARTY_WALK_TS_SKEW_MS); a halt is said ("The
  party has stopped.") and the question reads "to the marked spot"; my party on the Overworld wherever they are, from
  the party's own poses as the held map draws them, never twice.
- **J4 A DOOR WALK ARRIVES** - an unfound place that fills its pixel put the approach 20 m into the next pixel, where a
  spot's arrival is never asked (`pixelBox`).
- **V3 A DOOR'S POV ROW OUTLASTS THE VIEW'S HOLD** (Eye of the Beholder, armed).
- **R3 THE PLACES IN WORDS** are written when the set changes, a distance alone at most every five seconds (AUDIT DEEP2
  E15's own law; a journey's ticking tenths rebuilt the list on a third of the frames).
- **R4 THE SHADOW PASS KEEPS NO HISTORY OF THE ORIGIN** - one entry a crossing for the session; each object keeps its own.
- Words and record: this section's own; TV7's design text (three sentences the code never kept); TV8's relay (world124,
  not the raids' world123); OW-ONLY's stop (through the panel since AUDIT OW3 J1); OW-TOGGLE's (every door named,
  group travel); the view's header (seven keys, not five); `timeScale.js`'s readers.

**Not changed, and said.**
- **The bands' stand with the view down** (MINOR, a design call for Mac): a chase met with the view down stands its pack
  18-32 m off, where the band was 140 m; stood where it was (CAMP-FAR's 100-150 m) it would stand past its own 60 m
  sight and never come on.
  **Decided at the merge** by AUDIT OW5b B2 (below): stood WHERE IT IS - Mac's CAMP-FAR stands a group 100-150 m
  off ("far too sudden and overwhelming" beside the player), and such a band waits to be come across as a camp does. For
  Mac to confirm.
- **The badge cache at a phone's dpr 3** (MINOR): 256 titled players outgrow SPRITE_PIXELS_MAX (AUDIT NAMES N1-8's
  memory cap) and the names flicker; holding a frame's sprites whole costs the memory the cap was set to spare - Mac's.
- **A far pick's half second** (MINOR): a pick past ~60 road pixels searches the whole map's rung for the cheapest way
  (AUDIT DEEP2 B-6's law): 200-500 ms at the click. Skipping it when a way is found trades the best route for the time.
- **The follow key's clock before its half limit** (MINOR): Travel Options' own order (TravelOptionsMod.cs :521-534,
  :705), kept 1:1.
- **The helm's time-step label over a crossing** (PLAUSIBLE, unverified on screen).
- **AUDIT OW4 X2's resume of a spawn's walk** has no player path today (a spot journey keeps no destination to offer
  Resume on); the branch stays for when it does.

## AUDIT OW5b - THE ENEMIES, THE DUNGEONS AND THE ENEMY SHIPS (2026-09-28, the player: "do a detailed audit on their functionality and ensure everything is perfection")

(Named AUDIT OW5 on its branch; OW5b since the merge - main's own AUDIT OW5, the audit before the merge, landed first,
and some of its finding ids are this audit's too. Where the two found the same bug, the merge kept one fix: said at
each finding below.)

Mac's field report, streamed the day the bands went out: *"So enemy dont work right ... Close ... Need to get pullout of
fast travel little sooner for encounters. U run thru them."* Measured first; then three read-only lanes (the bands, the
dungeons, the sea) were sent over the tree, and every finding was verified against the code before a line changed.

- **The encounters (E1, Mac's).** A Travel Options journey stopped for enemies only when its frame's sweep
  (AreEnemiesNearby) saw them - a foe that had SEEN the traveller, or stood inside the classic spawn band (1094 x
  GlobalScale: 27 m outdoors). In DFU that answer comes within a fraction of a metre: the spawn stands in its frame and
  Time.timeScale runs the foes' senses with the journey. In the port it came late twice over - the foe stands only after
  its career and sprites load (spawnFoe's awaits), and it senses on its own REAL-time classic tick (1/16 s), because the
  port scales the traveller alone (TO1's clock, the slice's one departure). At x40 on foot that is 16-40 m; on a horse
  40-100 m; at x100, or with a sprite not yet loaded, more - and a band's members stand 18-32 m off, see 60 m
  (CAMP-SIGHT) and "would be spawned" only within 27 m, so a traveller carried past them before their first tick was
  never met at all. That is "U run thru them". Now **the encounter asks the journey the moment it meets the traveller**:
  Travel Options' enemies arm has one home (`enemiesStop`: the panel's Camp, a cautious traveller's avoid roll, the
  reckless one's box), asked by the frame's sweep as ever and by the new `encounter()` - null with no journey walking,
  'ignored' while a won roll's grace runs, 'avoided', or 'stopped'. The band's contact asks it before a member stands
  (`journeyMet`): stopped, the band stands and the box brings the view down; a won roll, the band loses the trail -
  spent, never stood (TV7's own words, "success, the band loses the trail", made true: it had stood, and the traveller
  walked away from it at x1); the grace, the chase runs on and asks again. A band the full foe pool cannot stand
  (`bandRoom`) meets nobody - no stop, no box, for a band that never comes. DFU's own wanderer (`_standEncounterFoe`)
  asks it once placed beside the traveller, and stands nobody with the pool full. Camps (100-150 m out) and the World of
  Daggerfall's are come across, not met: the sweep answers for them as before.
- **Bands (B).** B1: the chase stepped on a clock of its own, clamped at 0.25 s against the frame's 0.1 - below ten
  frames a second (a phone's hitch, the frame after an arrival) a band gained up to 2.5 times the ground the traveller
  could put between them; `bandFrame(now, dt)` takes the frame's. B2: every band stood at 18-32 m - one met with the
  view down at BAND_STAND_M (140 m, Mac's CAMP-FAR: no pack lands beside the player out of nowhere) was brought a
  hundred metres nearer; it stands WHERE IT IS now (`bandStand(mk, yaw, dist)`, never nearer than BAND_STAND_MIN_M) -
  AUDIT OW5 left this Mac's call; the merge keeps it, by CAMP-FAR's own 100-150 m.
  B3: the land a band may stand on took every row of the index at boot, a world-data mod's additions with it (Roleplay
  & Realism's Northrock Fort, on only where the mod is) - two players with different switches were born different
  bands about it; the base rows alone now (HUB1's law, GATE-SEEN's, RAID2's; AUDIT OW5 B2 the same - its fill kept). B4: a held chase's patience ran on the
  shared clock, which a hold never stops - two minutes of a death screen or a window and its first frame back gave the
  band up, spent and said to everyone; the chases keep their own clock (`_bandClock`, the frames they step; AUDIT OW5 B1 the same - its
  `bandHold` gave way to this clock at the merge). B5: a step
  could close onto the feet themselves, and a bearing read there was float noise (a fast frame head-on; a band riding
  along through a won roll's grace): `bandChaseStep` closes to the contact's ring and no nearer.
- **Dungeons (D).** D1: the find read the Overworld's twelve, and AUDIT OW4 D7 took them found first - with twelve
  found within the far range, not one "?" stood and nothing was found by approach again (the pixel's entry filed it,
  silently). The find reads its own list (every undiscovered map dungeon in reach, uncapped - AUDIT OW5 D1 found the
  same, and the merge kept its `travelViewFindList` for this audit's own), and an unfound one within the grid - the ground the view shows - spends none of the twelve, as a found one there (TV2's plate)
  spends none. D2: an expired spawn was never removed. The build took the index's word for a spawn it held (no clock
  asked), and at a rebuild buildPixel's probe expired it and FORGOT its ledger row - and the roll is a pure hash, so the
  build's own ask stood the same dungeon again on a fresh seven days, while the Overworld (tvSpawnGone) had it gone. The
  row is kept now (its clocks keep it gone, and the save carries it), the build asks every spawn its clocks
  (`_locationToBuild`), and the Overworld calls one gone only once it is off the ground (never while the ground built
  before its time ran out still carries it - SPAWN-PLATE, FIELD BUGS 2026-09-29h: "off the ground" is the build's word,
  the pixel's `location`, since a pixel built after the clock ran out is built EMPTY and "built" had kept its plate over
  bare grass). TTL1's rule, the creator's relayed by Mac: "Spawned Dungeons should expire/removed". D3: a walk's door was read
  off the live index on the map's Resume and by a party member - a far found spawn's walk (its pixel never built)
  resumed as a spot ("the mountains cannot be crossed"), a spot clicked on a place's pixel resumed as that place's door,
  and a member following the leader to a spawn their own pixels never built walked a bare spot; the door rides the
  walk's point, and a member asks what stands there (`tvLocationAt`: the index, else the spawn its roll would stand).
  D4: every Overworld reset of a load sat in applyPose past `if (!pose) return;` - a save without a pose (an older
  envelope) loaded with the last run's chases running and its rudder held; `overworldLoadReset` runs first, every load.
- **The sea (S).** S1: the raid boarded by a teleport, which is no load and says nothing to Come Sail Away - the next
  frame's sail stood the player back at their boat's helm (its drive position, in the ship pixel's frame now), on no deck
  at all, the pirates on the one they had been carried to; the fast travel's ambush lets go of the helm first (CSA's
  OnPreFastTravel before Warm Ashes' own). `raidContact` now asks the mod's refusals first (`raidRefusal`, raidAtSea's
  one home for them) and lets go (StopSailing, the crossing's hand off it) BEFORE the raid arms - so a ship the helm lent
  (a crewed boat's Small) is handed back and the raid lends its own Large, as the fast travel's does. S2: a window read
  as "ashore" and spent the raider for its life, and so did stepping off the helm onto one's own deck; a pause holds
  every chase (its clock with it), and the quarry is a traveller at sea on their OWN boat - its helm, or its deck (CSA's
  own "I'm On A Boat") - never a passenger aboard another's (its helmsman is the one run down, and the raid's Leave Ship
  would set a passenger back in the water the boat had sailed on from). (AUDIT OW5 R1 the same, and a death holding it too: one line since the merge.) S3: a chase whose raider's life turned over left
  the list and came alongside unseen; it is marked wherever it is (the bands' T7-2). S4: a part-sailed leg asked its own
  moving end, and flipped the moment it touched land - a raider jumped up to 700 m in a breath, into a lookout's sight -
  and a full leg asked only its end, and sailed across a cape; a leg's way is chosen by the whole leg now, water all
  along it (RAIDER_LEG_PROBES), and kept while it is sailed (the bands' T7-6). S5: off the map read as water - a raider was
  born a pixel past the edge and sailed off the world; the raiders' sea is on the map (ETHER-OW, 2026-10-13: or the
  Eltheric Ocean's box). S6: a world being moved holds the
  chase (the bands' D2). S7 is D4. S8: no Come Sail Away, no boat to be at sea in - no raider is drawn (the bands' B6).
- **Known, not changed** (the first two since answered: OW6's raider word and OW6L's cell ledger, below). A raider's
  chase is still the chased traveller's own and not said to the others (TV7b's word has no sea half): a helmsman and a friend on their own boat nearby may each be chased by the same sail. The spawn
  ledger is one client's memory (TTL1's own note): two players can disagree whether a spawn is gone, and gone is now for
  good on the client that saw it go. With the view down no band first sees anyone or stands but a chase it began (TV7
  BUILT); a band stood 140 m off with the view down sees 60 m, so it waits to be come across as a camp does. A wanderer's
  position stays a quarter second old when the shared clock steps backward (`_bandPos`), and the marks' preventEnemySpawns
  hide seldom fires (the flag lives a frame) - both harmless.
- Proof: `test/systems/travel/to1_travelOptions.test.js` (+1), `tv7_bands` (+7: the contact asked first, an x40 journey stopped the
  frame the band reaches it on foot, riding and at x100 at 30 fps, the full pool, the frame's clock, the ring, where it
  stands, a held patience), `encounterplace` (+1), `tv6_dungeons` (+1), `spawneddungeons` (+1), `tv2_click_to_move`
  (+1), `tv8_party_walk` (+1), `ows3_raiders` (+6: the host's raider code lifted and RUN); `tools/mutants/ow5e.json`
  (11), `ow5b.json` (6; 5 since the merge), `ow5d.json` (12; 11), `ow5s.json` (12) - all dead (the merge retired the two
  whose code gave way to AUDIT OW5's, its records covering the kept code); 26 older records re-aimed by content (ow3d,
  ow4d, ow4j, ow4t, ow4x, ows3, tv6, tv7, hub1, enhnotice3, and survtiers3's two cite records after the shift), and
  every list naming an edited test run again on a passing baseline (31 lists), none surviving.

## OW6 - THE OVERWORLD SHARED, ALIVE AND SEEN COMING (2026-09-29, the player, after AUDIT OW5b)

The player's four asks, whole: *"Everything needs that persistence between players in the overworld. Enemies should
spawn in varying numbers and roam more often. If a player is traveling very fast, they should slow if enemies become
close. If a camp is spawned, it should show in the overworld."* Five research lanes read the tree first (the bands'
generation, the camps' life, the online transport, the speed governor, and every rule of Mac's on record - CAMP-FAR,
CAMP-SIGHT, CAMP-TRAVEL, CAMP-NOTIMER, TTL1, WORLD1's "True persistance"); the design keeps every one of them.

- **The bands vary and roam (systems/travel/travelBands.js).** BAND_CHANCE_DAY 0.3 -> 0.45 and BAND_CHANCE_NIGHT 0.45 -> 0.6
  (half as many again by day, a third more by night); BAND_WANDER_MPS 1.3 -> 2 on BAND_LEG_MS 75 s -> 50 s legs (a band
  at 1.3 m/s read as standing still from 150-450 m up). A band's NUMBER is its own roll now, `bandSizeOf` off its own
  stream, one to six by BAND_SIZE_WEIGHTS [12, 20, 24, 20, 14, 10] - it was the camp's or the pack's range (2-5); the
  themed group takes a caller's size (campEncounters.js rollGroupComposition `ctx.size`), and a band of ONE is alone
  already, so a solitary kind may be it (a giant on the road, an imp, a mummy abroad by night) - a group still never
  leads with one. A lone band's words are its kind alone ("Giant"). A warband of six met by a full party grew past the
  eight-foe pool and stood nothing: every group's growth has one home now (world.js `campMembers`), bounded by
  MAX_ACTIVE_ENCOUNTER_FOES - the widest camp, five and three, is exactly the bound, so no camp changes.
- **One band for every player (the first ask).** A band's make read the VIEWER's level (and its label the viewer's
  party), so two players looking at one band read two different creatures and numbers over it. Online it reads the
  BAND's own level now - `bandLevelOf`, 1 + floor(20 u^2) off its own stream: half of all bands level 6 or under, a
  quarter 12 or over, the label saying which is which - and its label its own number (PSCALE1's growth still comes at
  the stand, with the party that meets it). Offline there is one player, and the band reads theirs, as Daggerfall does.
- **The journey slows as enemies close (systems/travel/travelThreat.js; the third ask).** The clock is held so the traveller
  always has THREAT_WARN_S (0.6 s: 5 at launch, 2 at OW6-LATE, 1.2 at OW6-NEAR, FB 29g, 0.6 at OW6-HALF, FB 2026-10-01c) of real time before the nearest enemy's REACH along their way - a band's sight, a
  raider's lookout (at sea), any hostile foe's sight (a camp's sixty metres, CAMP-SIGHT), or, for a chaser, its contact
  ring from any side at its own pace too (`metresToReach`, `threatCap`); stepped down the spinner's own ladder (1, 2, 3,
  4, 5, then fives), never under walking pace (the encounter stops a journey - AUDIT OW5b E1 - the governor only slows
  it). An enemy the way passes by, or one behind, holds nothing; inside a reach the journey is held while the way goes
  deeper and free as it leads out. Under the view the lower of TV2's ground cap and this one holds; on the classic skin
  (no governor there before) the mod's own ask under the enemies' cap alone, handed back whole with nothing near. The
  panel says why it is held (TRAVEL_HELD_WHY: "while the land loads", "with enemies near", and "until the Overworld
  rises" for AUDIT OW4 J5's walking pace with the view down, which had said the land was loading), and a line is said
  once as an enemy begins to hold the journey ("Enemies are near. You slow your pace."). Since the merge with main: its
  reasons are AUDIT OW5 G1's words with this one beside them (`TRAVEL_HELD_WHY`: 'load', 'ground', 'foes'), and TV-WASD's
  keys' travel under the view is held the same way - fast travel too - along the way the keys last moved (`_tvWalkYaw`);
  a First-Person crossing's restore (AUDIT OW5 G5) asks the governor's rate, never over its hold. THE MERGE with the sea
  fight (NAV-H, NAV-R; `03-World/Naval-Combat.md`): every hostile ship afloat is a reach too, on either skin - the ring
  where she is an enemy nearby and the journey stops, or her lookout past it until she sights the traveller, closing
  at her pace once she comes (`navalHost.js threats`) - and a raider stood as a ship is that ship, never her seeded
  sail as well. A rider flown at x40 straight at a
  band now comes into its sight at walking pace, the last half kilometre taking more than THREAT_WARN_S; it took under a
  second. The bible's own open idea, "Encounters seen coming", is this.
- **Camps on the Overworld, the same for everyone (world/campShared.js; the fourth ask).** Every group standing about -
  a camp, a pack, a band once it has stood (`campKind`: 'camp' / 'pack' / 'band') - is one mark where its living members
  stand, with its kind and number ("Orc camp, 4"), a tent in the ember (`#d9622b`); its last member down, the mark goes.
  A camp's members already rode their owner's cell foes frame as bare records; the frame carries the camp tags `cz` now
  (`[[i, campId, kind]]`, a live member's alone; no relay change), a reader keeps the tag on the puppet - and learns it
  from a later frame when the member rode once before its camp was set - so every player within the relay's range sees
  the same camp. The camp numbers have one counter, the pool's (`newCampId`).
- **A camp stays a camp between players.** The handover (PDEATH-FOES, a door or a death) turned every camp into loose
  wanderers at infighting: the heir's `adopt` takes it as ONE camp of its own - one number for all of it, its kind, its
  sixty metres' sight, its alert radius, CAMP2's exemption - and marks it. And a camp its owner WALKED AWAY from was
  culled from under the friend fighting it (CAMP-CULL, 200 m): past three quarters of its cull distance from its owner,
  with a player nearer it, it is handed to them foe by foe (`handOverWalkedAway`, the door's own handover); nobody
  nearer, the cull takes it as it always did.
- **The raiders' chase, shared (systems/seaRaiders.js).** OWS3 said "nothing is sent", and AUDIT OW5b left it known: a
  friend watched the sail that ran them down wander on, and could be chased by it too. The chaser's frame carries `sr`
  now - the band word's own law, one home (travelBands.js `chaseWordOf` / `validChaseWord`, each chaser's own ids): the
  raiders chasing it where they sail, and each spent - so every reader draws the chase where it runs, none gives chase
  to a sail a peer's chase holds (two chasing one: the lower id keeps it), and none meets a spent raider again. With
  the sea fight on (NAV-R, `03-World/Naval-Combat.md` "THE MERGE with main's OW6") the raiders are its ships: the ships a
  client's sea stands ride the same word as held, a ship sunk, taken or given the slip is spent through the same spend
  (said, and owed to the cell's ledger), no sea stands a raider a peer's word holds, and a journey slows for every
  hostile ship before the ring where she stops it (NAV-H's enemy nearby) - a raider ship counted as the ship.
- **The cell keeps the Overworld's ledger (OW6L, the relay - world127; net/overworldLaw.js).** (AUDIT SCALE II R3-3 (c), SCALE5d: the cell's place alone - a layer's word is dropped, and a band killed there stands again for the layer's next joiner.) What stays true after the
  moment: a band or raider spent, and a spawned dungeon's clocks. TV7b's word reached three pixels, that minute - a band
  fought was back for whoever came later in its life - and the spawn ledger was each client's own (TTL1's own note: two
  players disagreed for days whether a spawn stood). Each CELL ROOM now keeps a ledger: the spent ids (their own life
  and the next), and a row a spawned pixel - `[px, py, seen, cleared?]` in shared classic minutes, MIN-MERGED, so the
  earliest sight and the earliest clear anyone had win (the spawn ledger's `merge`), kept sixty real days (SPAWN-REBIRTH,
  2026-10-12, `01-Overview/bugs/Field-Bugs-2026-10-12h.md`: a row is a first ENTRY now, kept until its spawn stands again -
  its death and twenty-four real hours - and the same dungeon stands then on fresh clocks). A player's
  spends and first sights and clears are owed to the cell until it takes them (world.js `overworldLedgerFrame`: said a
  second apart, what was not taken said again, nothing to an older relay), and every change is said to everyone in the
  cell - and the whole ledger to a player who walks in later, in its welcome (a halo's too, for the seam). The relay
  checks each word against the cell's square (8 pixels of margin), the spawn roll itself and the clocks, on its own
  bucket and fan budget, and answers a speaker whose row is BEHIND with its own (RAID3's law). Its numbers are pinned
  equal to their homes rather than imported (gateLaw.js's own way), so the relay's graph stays flat. RELAY_VERSION
  world127 - 125 was VOICE1's and 126 DISCORD-GATES', never reused; a client reads `relaySupportsOverworld` and says
  nothing to an older relay (which would close the socket on the frame): it needs the relay deploy that ships with it.
- **Known, not changed.** (The first answered by OW-CHASE-RANGE, 2026-10-19, below: the chaser's region mark carries it.) A live CHASE's place still rides the foes frame alone - the relay fans it three pixels while
  bands are drawn to six (TV7b's own recorded limit) - so a viewer between three and six pixels from a chaser sees the band at its own
  wander; that it was spent reaches them through the cell. The relay cannot verify when a pixel was first seen: a
  modified client could make its cell's spawns run out early (bounded by the margin, the roll, the keep and the bucket).
  A raider dragged far past its own cell by a long chase is not told to the escaping player's cell (the session leaves
  out what the cell would strike). A camp is shared with the players its owner's frames reach (the relay's three
  pixels), and its mark is drawn where its living members stand. One pre-existing mutant survivor was found on the way,
  outside this work: auditqp.json's AQP-touched-cell-my-roll (the owner's record already carries the maximum it resets).
- Proof: `test/systems/travel/ow6_bands.test.js` (6), `ow6_slowdown` (8: the law, a rider at x40, the host governor run on both skins),
  `ow6_camps` (7: two real pools over their frames, the handover, the walk-away), `ows3_raiders` (+4: the raider word,
  the host's run), `ow6_ledger` (18: the law, the wire, the relay over the real Room, the session, the spawn ledger's
  merge, the host's owed and heard words, END TO END - A spends, B hears, C is told in its welcome);
  `tools/mutants/ow6b.json` (14), `ow6s.json` (22; 27 since the merge - the keys' travel, the line through tvSay, the crossing's restore and the helm's
  step added, the view-down word's record AUDIT OW5 G1's), `ow6c.json` (19), `ow6r.json` (10), `ow6l.json` (33), `ow6h.json`
  (12) - all dead; 19 older records re-aimed by content, every list naming an edited test re-run on a passing baseline.

## OW-WOD - the massifs' lag, the massifs on the route, the towns' ring (2026-09-29, Mac)

Mac: *"There's an issue with the overworld. 1. When near mountains from WOD, the game lags insane 2. Pathing doesnt go
around mountains 3. Pathing doesnt follow the road around cities"*. Three root causes, each measured before it was
fixed. "Mountains from WOD" are World of Daggerfall's nine `WOD_Mountain_*` layouts, not the terrain: 8 to 36 of model
60711-60720's rocks each, scaled by hundreds and thousands, reaching over a kilometre from the site - and object 2,
the rock scaled by a million 83 km under it (`03-World/World-Of-Daggerfall.md`, AUDIT BRANCH B1).

- **OW-WOD-LAG, the lag (1).** The collider filed a WIDE triangle (over 64 fine cells) on a 64-unit XZ grid (AUDIT
  BRANCH B1's memory fix), so a sphere query near a massif took every face over its 192-unit column, above and below
  alike, and tested each exactly: 150 to 1,700 faces a query on a stand-in rock over the real prefab transforms, 1.2%
  of them within reach in three dimensions. The player's and every nearby foe's `move()` runs several spheres a 1/60
  step: 1.5 to 5.7 ms a body a step, against 0.04 for one boulder, and a slow frame runs more steps. Now each wide face
  carries its own 3-D box and each bucket a bounding-volume tree over its wide faces (binned surface-area splits;
  `player/collider.js` wideTree), which a sphere or a ray walks for the faces it can reach: 0.1 to 0.37 ms a `move()` on
  the same bench. Exact as the grid was - 0 mismatches against brute force over spheres, rays and a body standing on
  the faces, the giant's included (`test/world/worldOfDaggerfall/audit_wod_branch.test.js`, `test/player/colliderkeys.test.js`, `test/world/worldOfDaggerfall/ow_wod.test.js`).
  One entry a face however wide, so B1's memory law holds. The tree is built inside the pixel's build
  (`collider.settle`, 7 to 32 ms warm on the stand-in's 2,880 and 11,497 faces), never by a frame in play; a later mesh
  raises it again on the query that needs it. And the road-clearance walk (`world/road/roadClearance.js boxNearPath`) asks
  only the map's own pixels: the giant's box spans thousands of pixels each way, mostly off the map, and the walk took
  46 to 121 ms of main thread a mountain pixel's build.
- **OW-WOD-PATH, the route through the massif (2).** The Overworld's planner (`systems/travel/travelRoute.js`) knew only the
  MAPS climate's peaks (OW-MOUNTAINS: Mountain, 226, and a steep step), so a route walked straight into a WOD massif and
  the walker ground against its rocks - where the lag was. `WodWorld.mountainPixels` marks the pixels a Mountains
  instance names (2,492 on the shipped list; three more lie off the map), the host drops those a road or a track crosses
  (the mod never stands a site on a path's pixel, LocationLoader.cs:146-151), and `routeGround.setRocks` makes them
  peaks: an open step into one is refused, the start's own is walked out of, a spot inside one is refused as among the
  peaks. The rock fields are not massifs (their pieces within ~350 m; a tenth of the map) - the traveller's steering
  rounds them. A massif's rocks reach past its pixel; the pixel is what the planner refuses, the steering the rest.
  RETIRED with OW-MOUNTAINS 2026-10-08 (MOUNTAINS WALKABLE): the host still hands `setRocks` its table, and the
  planner no longer reads it (`11-Multiplayer/Wild-Zone.md` section 19).
- **OW-TOWN-RING, the road round the town (3).** Basic Roads' bytes meet at the hub of a location's pixel - Daggerfall
  (207,213) and Wayrest (859,244) are N|SE|W - while the painter stops the arms at the town and paves its border ring.
  The route's legs were aimed at pixel middles, so a route through a town pixel aimed a leg at the town's heart.
  Travel Options itself never does: a followed leg into a location pixel is aimed at its border rect (BeginPathTravel
  :700) and the follow key walks the ring corner to corner (CircumnavigateLocation :753-797). A route through a
  location's pixel now walks its ring (`routeLegs` `ringAt`; `travelOptions.js ringPassPoints`): in on the side it
  arrives from, round the shorter way through the mod's corners, out on the side it leaves by; the run before it ends
  at the pixel before. The rects are the mod's own (`locationRectsOf`) over the tile rect the pixel's build stamps
  (`setLocationTiles`, from the location's blocks when the pixel is not built yet). A resume in the town's pixel skips
  no ring point, and no ring point is taken for a road join.

**Left as it is, recorded.** (Since 2026-10-08 the planner has no terrain law at all - MOUNTAINS WALKABLE, above.)
The planner still prices no climb on open ground: its terrain law is OW-MOUNTAINS' - the
Mountain climate and a steep step (TV_STEEP_RISE 16) between two pixels' small-heightmap bytes. MountainWoods (230),
a rise under 16 a pixel however long, and the large heightmap's relief inside a pixel pass it. The heightmaps are the
player's own (WOODS.WLD); none is in this workspace, so no threshold was tuned blind. A journey that starts inside a
town joins its first road from the pixel's middle, as before.

**Proof.** `test/world/worldOfDaggerfall/ow_wod.test.js` (10), `tools/mutants/owwod.json` (18, all dead); the collider's own pins moved to the
tree (`test/world/worldOfDaggerfall/audit_wod_branch.test.js`, `test/player/colliderkeys.test.js`), the hosts' lifted code and pins to the new lines.

## Open, for Mac

All three were DECIDED AS LEAD on 2026-09-28 (Mac: "Your the lead and this is your baby"),
each one line to change:

- **The name** - "Overworld" to the player, TRAVEL VIEW in the code (TV1).
- **Being seen** - the switch, on by default, nothing on the region's channel from indoors (TV3; the party's own pose still rides from indoors, as it always has - AUDIT DEEP2 C5).
- **A second door** - the `TravelView` action, shipped unbound; the map stays the door (TV1).
- **A band met with the view down** (2026-09-29, at the merge of AUDIT OW5 and OW5b) - stood WHERE IT IS, about 140 m off
  (AUDIT OW5b B2, by CAMP-FAR's own 100-150 m: come across, not landed on); AUDIT OW5 had left it Mac's call. One line
  to change back: `bandStand`'s distances.

## GATHER-OW - the professions' groups on the Overworld (2026-10-02, Mac)

Mac: *"allow them to appear in the overworld without being overwhelming, maybe a glyph marker showing where a group of
them are"*; asked, "Groups nearby". One mark a profession a stood pixel (`gather <profession>`): a diamond in the
profession's compass colour (`ui/nodeMarks.js`) at the middle of its nodes not yet worked today, its count beside it,
the nearest twelve within 3 km, read again twice a second (`scenes/gatherHost.js` overworldGroups); a sixth filter,
Gathering (`systems/travel/travelViewFilters.js`); drawn by `ui/travel/travelViewHud.js` (look `gather`, `m.color`); fed beside the
camps in `scenes/travelViewMarks.js` travelViewMarks (HOST-SPLIT 1 moved it out of world.js). Not pickable - a click there falls to the ground and walks to it. See
`06-Systems/Professions-Arc.md` (MORE-NODES, GATHER-OW). Pins `test/scenes/gatherow.test.js`.

## OW-CROWD - the region's travellers decluttered (2026-10-02, Mac)

Mac: *"Can we also find a way to reduce the overwhelming player markers that flood the screen? I like it, dont get me
wrong, but there must be a way to make it where its not overwhelming"*. Every player of the region was their own mark
wearing their whole badge (the title, the Renown, the name, the guild's tag, the glyphs - OVERWORLD NAMES), and each off
the picture their own arrow at the edge. Now, as the marks are placed on the screen (`ui/travel/travelViewHud.js`
declutterTravellers, between the placement and the edges' spread): travellers drawn within TV_CROWD_PX (36 px) of one
another are one mark at their middle, a larger dot named "N travellers"; arrows at the edge within TV_CROWD_EDGE_PX
(56 px) one arrow, the nearest's place and way; and of those still alone in the picture only the TV_BADGES_MAX (6)
nearest my own mark wear their badge - the rest their name. My party (kind `party`), the places, the dungeons, the
enemies, the gathering groups and the journey's end are never folded nor stripped. The Travellers filter's count is
still every traveller. Pins `test/ui/travel/owcrowd.test.js`; mutants `tools/mutants/owcrowd.json`.

AUDIT OW-CROWD (Mac: "Audit thid"): the badges were made before the crowds were folded - the frame's sixteen builds
(BADGE_BUILDS_PER_FRAME) spent on players a crowd or the cap then dropped, the badges kept late a frame or more, and a
crowd's arrow laid out by its lead's badge rather than its own words; they are made after now, for the marks still
wearing one. And a lone arrow at the edge wore its whole badge, uncapped, round the screen - it wears the name alone now
(my party's keeps its badge). PIN MOVED: `tv5_far_places` N1-8 feeds the cache six a frame, N1-5 and N1-6 ask the held
badge's box of my party's arrows.

AUDIT GATHER-OW and OW-CROWD, second pass (Mac: "Audit thid"): the groups were kept in scene coordinates for half a
second, so a recentre of the floating origin threw every diamond off by the shift until the next read - they are kept
by their pixel now and placed through its translation each call, and a pixel torn down (or stood again) since the read
drops its group. The diamond stood at the nodes' mean, which in a scattered pixel is open ground or inside a rock - it
stands on the node nearest that mean now. `scenes/travelView.js` copied every mark but its colour, so every diamond was
brass in play - the colour is carried. And the decluttered travellers went last in the draw order, a crowd's dot over
my party's - every mark keeps its order now, a crowd where its first member stood.

## OW-NODE-KM, OW-HUBS, OW-KIN, OW-WHO, SEAT-TIP, HORSE-FACE (FIELD BUGS 2026-10-04e)

TOWN-ECON (2026-10-16, `06-Systems/Town-Economy-Arc.md` section 3): the seat's card is now every town's - its economy and prices above, a seat's own lines below (a held seat's Charter line left out: its holder line names the guild) - made by `systems/town/townEcon.js` (`tipAt`, and `tipFnAt` for the Overworld's plate); `scenes/world.js` seatTipAt is gone.

The Overworld's block gains a Players section (Friends, Guild, Others, the least Renown) and the node reach (any, 0.5,
1, 2 km) - one store with the travel map's (`systems/travel/travelViewFilters.js`); a friend's name is drawn in the friends'
blue and a guild-mate's in violet; a town whose gate stands a carriage driver wears a brass wheel; a seat's plate under
the pointer shows its card (who holds it, this week's battle) - made only for the hovered plate, measured once, never
over the block's own controls, and not on a touch screen (no hover there). On a touch screen the filters scroll within
their section. Every new field a mark carries rides `scenes/travelView.js`
through to the readout. The rider's Eye Of The Beholder sprite faces its travel again: a gallop under the time scale had
been read as a placing every frame (ARENA-FIX 14's -1, painted as orientation 7). The record:
`01-Overview/bugs/Field-Bugs-2026-10-04e.md`.

## WILD-ALERT - the wilderness notices a fast traveller, or it does not (2026-10-04, Mac)

Mac: *"Wilderness enemies now approach/non approach based on distance and a stealth check. Enemies alerted are given an
exclamation point and slow down as they do now, non alerted enemies do not slowdown or bother the player."* Before it a
band chased the moment the traveller crossed its sight (TV7: distance alone), every hostile foe standing about held the
journey's clock for its sight whether it had seen anyone or not (OW6), and DFU's own sweep stopped a journey for any foe
within the classic band (27 m) unaware or not. Now:

- **The check** (`systems/wild/wildAlert.js`, the port's own). An enemy within its reach of a fast traveller - a band's sight
  (320 m by day, 190 by night), a foe's own (a camp's 60 m, a wanderer's 102.4) - is UNAWARE until it NOTICES them, on a
  stealth check a classic game minute apart on the traveller's clock (`WILD_ROLL_S`, five scaled seconds: at x60 a
  twelfth of a real second, so a fast traveller is checked as often per metre as a walker), the first the moment it
  comes within reach. The check is DFU's own formula (FormulaHelper.CalculateStealthChance, `enemyMotor.js`
  `stealthChance`) with the reach laid onto the formula's own 25.6 m (`noticeChance`): at the reach's edge the traveller
  stays unseen with twice their Stealth in a hundred, at half the reach with their Stealth, close in almost never; past
  it, no check. Out of reach and back is a fresh first check; an alerted enemy stays alerted (a band's chase and a foe's
  own senses give up as they always did).
- **A band** within its sight under the view is stepped by the check (`bandFrame`), and chases only once it has
  noticed (the two-chaser cap and a peer's hold stand); unaware, it wanders on. Its notices go with its life
  (`bandPrune`).
- **A foe** - mine (a peer's puppet is its owner's), hostile, out in the wilderness (inside a town's rect the town's law
  stands) - is checked each frame a fast traveller crosses the wilds (`wildFoesFrame`: a journey driving, or the
  Overworld's movement keys, out of doors), and until it notices the pools leave the traveller off its list
  (`wildGated` -> the senses' `wildUnaware` -> `exteriorFoes.js` `_armed`: the target machine's own noTargetMode,
  CAMP-REST's switch, with the same "not already on the player" clause). One already on the traveller is alerted. A
  wanderer DFU stands beside a fast traveller is met (AUDIT OW5b E1's stop at its placement) only if its first check at
  the spot it was placed notices them; unnoticed it stands checked and unaware, and the journey runs on. Not fast
  travelling, there is no gate: DFU's senses, as ever.
- **Alerted holds the clock; unaware holds nothing.** `journeyThreats` asks a band's chase (a band that noticed) and an
  ALERTED foe alone (`systems/encounters.js` `foeAlerted`: hostile, its target me - the motor's latch, a puppet's
  stream - and seeing me or still hunting me blind on GiveUpTimer) - OW6's cap and ENEMY-PACE's floor as before ("slow
  down as they do now"). The journey's own enemy stop and the view's `danger` count no gated foe (`wildSeen`).
- **The "!"** (`WILD_MARK`). On the Overworld a chase's mark reads "! Orc, 4" and a camp a member of which is alerted
  "! Orc camp, 4" (mine, or a peer's by its frames' tag - `wildCampKeys`). In play, over each alerted wilderness foe's
  head (`ui/wild/wildMarks.js`, both skins, the HUD lines' outlined gold in the pixel face): it pops in as the foe notices,
  stands while a fast traveller's clock is held for it, and in plain play for `WILD_MARK_S` (3 s) from the notice; never
  in a town, under a window or under the Overworld (whose marks carry it). The layer owns its own end: a standing mark
  arms a watchdog each frame, and a frame that does not come (a host's loop gone) takes it down.

Not changed: the sea's raiders and hostile ships (their lookout is the sea fight's own reach, NAV-H/OWS3), the rest's
enemy check and the travel map's refusal (no journey runs - DFU's own sweep), the city watch. Pins
`test/scenes/wildalert.test.js` (10: the law, the store, `foeAlerted`, the gate, the band's notice, the marks lifted and run, the
layer); re-aimed `ow6_slowdown` (a wandering band holds nothing, a chase does; an unaware foe holds nothing), `tv7_bands`,
`encounterplace` (the wanderer's placement check), `camproll`, `camp1_groups`, `waterfoes`, `ow6_camps`, `nav_h_host`,
`tv1_travel_view`, `roadh_missiles`, `exteriorfoes`; `tools/mutants/wildalert.json` (32, all dead); seven older records
re-aimed by content and dead, OW6-S-spent-band-slows retired with the wandering bands' arm it killed.

INVIS-SWING (2026-10-15): the notice is EnemySenses' stealth roll, which DFU makes behind BlockedByIllusionEffect - an
Invisibility blinds every enemy but the thirteen seers. The gate rolled the stealth formula alone; `wildAlert.js`
noticeRoll now passes the illusion gate first, and both of world.js's checks hand it the traveller's concealment and the
enemy's sight through it. `01-Overview/bugs/Field-Bugs-2026-10-15f.md`.

## WILD-ALERT-FIX - the deep audit's five (2026-10-05)

The deep audit of the branch (each finding verified against the code before the fix) found WILD-ALERT's notice half
done; each is fixed and pinned (`test/systems/wildalertfix.test.js`, `tools/mutants/wildalertfix.json`).

- **A foe that notices comes** (`exteriorFoes.js noticedPlayer`, `wildFoesFrame`). The check only lifted the gate; the
  "!", the hold of the clock and the meeting all read `foeAlerted` - the foe already on the player - and nothing put it
  there but its own target pass, once a second by its own eyes. A rider at x60 passing a camp forty metres off was
  noticed and gone before the camp looked: no "!", no slowing, no meeting. Noticed, a foe is now handed the player as
  its target at the feet it noticed them at (MakeEnemyHostileToAttacker's bookkeeping, the blind pursuit's
  GiveUpTimer), and its campmates are woken as a member's own notice wakes them (CAMP1).
- **A band that caught the traveller stands on them** (`bandStand`). Its members stood unaware - the gate held them off
  the player, and the Overworld's keys ran on through them. Each is stood alerted and comes, as a noticed foe does.
- **A band's notice goes with its chase.** A chase handed to a peer kept its notice, so a stale peer word made it a
  chase again from anywhere, unchecked; a load kept every notice, so a band that chased the abandoned run chased again
  on the first frame - and, past nine hundred metres, was lost at once and spent for everyone in the cell. The yield
  forgets it (`bandHear`), and a load forgets them all (`overworldLoadReset`; the store stands above its readers).
- **The checks keep the game's clock** (`wildFoesFrame`). A window holding the game kept a journey's scale (Travel
  Options keeps a journey alive under a pause), so a camp beside the road rolled twelve to twenty times a real second
  while the calendar stood. The checks hold while the game is paused.
- **The gate drops the traveller alone** (`enemyTargets.js` `dropLocal`, the port's own). It rode DFU's noTargetMode,
  which drops every player - so while the owner fast travelled, their unaware wilderness foes stopped fighting the peer
  beside it. The gate leaves the local player off the list and no one else.

Recorded, not changed: the check is the owner's - a peer fast travelling past my foes is seen on DFU's senses (their
notice of a peer would need the peer's Stealth and journey on the wire).

## CLIMB-TRAVEL - nothing climbs at a journey's pace (FIELD BUGS 2026-10-07b)

Shabalako on the Discord, "Overworld Travel can be used to exploit climbing levelling": *"There are many spots in
cities where if you keep walking forward into a home can make your character climb and let go of the surface at an
extremely fast rate, making levelling climbing a joke. An easy fix could be disabling climbing during overworld
travel."* - and Sahh, of House R'is: *"would also reduce the mortality rate of travellers falling from mountains at
60x speed"*. `01-Overview/bugs/Field-Bugs-2026-10-07b.md`.

The time scale grows the motor's fixed step, never its count (`systems/timeScale.js`): at x60 a step is a second of
game time, and every climb timer - the classic climb's 0.77 s start and 0.82 s checks, the free climb's start and its
wall tally - fell due every step or two. Measured on the world host's own motor (motorStats, climbingDeps, parkourDeps;
Climbing 40, two real seconds walking into a wall): at walking pace one hold and one or two Climbing rolls; at x60 the
free climb's 8 holds, 94 rolls and 7 falls of more than five metres, and the classic climb's 59 to 62 rolls (its rolls
left to chance, 6 to 16 holds and 4 to 8 such falls).

While a journey runs or the keys travel under the view (`scenes/world.js` wildTravelling - the same "fast traveller"
WILD-ALERT's gate reads), neither climb takes a wall: the motor's `travelling` (`player/motor.js`) is a third thing
that holds no wall, beside levitation and the saddle - the classic climb's abort ladder (`player/climbing.js`) and the
free climb's `unheld`, so no climb begins (no walk-in start, no jump's grab, no lower and no mantle; a move already
under way finishes) and a hold the journey finds lets go. The keys' travel walks at walking pace while the hands hold a
wall (TV-WASD's `onFoot`), so a climber is never put to a journey's pace by the keys. The four hosts: world.js wired
(its one motor, the street's, a building's and a dungeon's - worldModes.js drives it indoors); exterior.js builds its
own motor and has no travel; dungeonContext.js builds no motor (the standalone `scenes/dungeon.js` builds its own and
writes no time scale).

AUDIT FB1007b (`01-Overview/audits/Audit-FB1007b.md`): the motor's journey is out of doors alone (`travellingOutdoors`, C1 -
only the exterior frame's governor clears the keys' travel, so a load taken with the keys held left it standing and no
wall indoors climbed); a hold a load carried is no body on foot until the step takes it again (the motor's
`holdPending`, C3 - the keys' travel sped up under it and let it go); and no journey sets out from a wall
(`climbingNow`, C2 - the view's click and the map's walked trip refuse it, `TRAVEL_VIEW_TEXT.climbing`).

- **Pinned**: `test/systems/fb1007b_climbtravel.test.js` (7); `tools/mutants/fb1007b.json` (its CLIMB / ENHANCED / HOST / KEYS
  records and the audit's C records).

## OW-DUNGEONS - each dungeon's own model, enlarged (2026-10-08, Mac)

Mac: *"Also with dungeons on the overworld it doesnt show a dungeon model."* Asked where: *"Overworld view"*; which:
*"Check it all"*; and, shown that past the streamed grid only TV6's plate or "?" stands (no geometry is there, a town's
neither) and that inside it a dungeon's real entrance - one small ruin, crypt or tower block most often - is a few
pixels from the eye 450 m up, his look: *"Its own model, enlarged"* (Mount & Blade's map icons) over one icon model for
all or the real scale alone.

**What the player sees.** Under the view, the dungeons about the traveller each stand as their own entrance model,
where the real one stands, grown so it reads from the eye - a little over half again the traveller's own icon (OW-BIG):
about 40 m tall at the view's 450 m, some 75 px at 1080p, at every zoom (superseded: OW-DUNGEON-SIZE, 2026-10-19 - 24 m
in the world whatever the distance; at the view's 450 m and the default tilt the old law stood it 51 m, AUDIT
OW-REVISITED L5-9). The map's own dungeons (TV6's
TV_DUNGEON_TYPES), the spawned dungeons online the Overworld knows of (AUDIT OW3 D1's law: said, or filed), and a
standing Abyss Dungeon (known from its rise - its column of light stands from then). The plates and "?" are TV6's as
they were. Down in play nothing changes: the world's own entrance is the model.

**The law** (`systems/travel/travelDungeonModels.js`, pure):
- *The set* (`dungeonModelSet`): TV6's own law (`travelDungeons.js nearDungeons`, uncapped) with nothing left to TV2's
  grid - a found dungeon in the grid is a speck from the eye too - the nearest TV_DUNGEON_MODELS_MAX (12), ties by key.
- *The model* (`dungeonEntranceModel`): of the location's laid blocks (`world/locationLayout.js layoutLocation`, the
  pixel build's own), the first placed model whose ARCH3D mesh carries DFU's dungeon-entrance door
  (`meshHasDungeonEntrance` - LoadVertices' door law, now in one home, `world/meshReader.js subMeshDoorType`, which
  dfMeshToModel reads its doors through: archive 56, or 331 past its stone record); with none, the exterior's largest by
  its triangles. Its matrix is the build's own: the location's tile origin, the block's origin, the model's own matrix,
  the location's level at 0. An enhanced-only model stands on the enhanced skin alone, as in the build.
- *The grow* (`owDungeonGrow`): TV_DUNGEON_ICON_K (0.09) of the eye's distance tall, over the model's own height above
  its level; never smaller than itself, never past OW-BIG's twelve (TV_DUNGEON_GROW_MAX = TV_OWN_GROW_MAX). Smooth, not
  OW-BIG's whole steps: a mesh drawn by a matrix makes no batch again. (OW-DUNGEON-SIZE, 2026-10-19: one height in the
  world since, TV_DUNGEON_ICON_M, whatever the distance - "THE OVERWORLD REVISITED" below.)
- *The matrix* (`grownModelMatrix`): grown about its foot - the middle of its plan on its level - which stands on the
  scene point given, so its base stays where the real one's is and the real one stands inside it.
- *Over a built pixel* (`owDungeonDrawn`): only once grown past TV_DUNGEON_GROWN_MIN (1.05) - at its own size it is the
  world's own drawn twice, fighting for the same surfaces as the view rises or falls; past the grid always.

**The host** (`scenes/world.js`; moved to `scenes/travelViewDungeonModels.js` by OW-DUNGEON-SIZE's HOST-SPLIT move): `tvDungeonModelList` (read again when TV6's is: the pixel, the finds, the index's
churn, a spawn in the set gone); `tvDungeonModelLoad` (the blocks laid as the build lays them, the model held by its own
place - PLACE-LRU kind `owdungeon`, twelve kept warm - and dressed in its location's climate and the season as its pixel
would be, a climate-free model in its own pictures - the bounty farm's way; one that left the set while it loaded is
never made ready, nor dressed once gone); `drawTvDungeonModels` (the set kept in step, each drawn grown with the eye's
distance (OW-DUNGEON-SIZE: to one height, never with the eye's distance) about its foot - over a built pixel on the real model's own level, past the grid on the far ring's ground,
`tvGroundAt`, asked again only as the ground moves, as TV3's `tvSceneKept` asks - casting no giant's shadow,
WAGON-HITCH B2's law), from the exterior frame beside the grown wagon, under the view alone. Its matrix is written in
place (`grownModelMatrix`'s `out`), so a frame's draw makes no garbage. A load forgets them, releasing every hold.

**The four hosts.** `scenes/world.js` WIRED (the one host with the view). `scenes/exterior.js` NOT WIRED on purpose
(TV1's rule: no streaming grid under a camera 450 m up). `scenes/worldModes.js` and `scenes/dungeonContext.js` have no
sky - a door closes the view before either draws a frame.

**Not measured on real ARENA2 data** (none in this container): the models' look in each climate and the grow's feel
are the law's; Mac's eye is the check. Each model is one draw (a texture's run each); twelve at most.

**Proof.** `test/world/owdungeons.test.js` (9 - the door law and the reader's doors through it; a mesh's way in against the
reader's own doors; the model's pick and place; the grow; the matrix and the drawn rule; the set; the host's list, load
and draw run over stubs); `tools/mutants/owdungeons.json` (45, all dead). RE-AIMED BY CONTENT, each still dead: `ow3d.json`
(`OW3D3-spawns-snapshotted`) and `ow4d.json` (`OW4D4-filed-dropped`) - TV6's spawns line has a twin in the models' list,
so each names TV6's own by the `isFound, spawns:` beside it.

**TV-BURST and TV-PIN (FIELD BUGS 2026-10-09, Shabalako: "The first time I open the overworld travel the game has a big
freeze").** The view's first frame started all twelve loads at once, inside its draw - each one's blocks laid and its
ARCH3D meshes read on that frame, then its model built and its pictures and its climate's uploaded. Now the loads start
ONE A FRAME, the nearest first, and none until the view is fully up (`systems/travel/travelDungeonModels.js`
`startDungeonLoads`, `TV_DUNGEON_LOADS_PER_FRAME`; the host hands the view frame's `fullyUp`); what left the set is
still let go every frame. The view down lets every model go to its place's shelf (`dropTvDungeonModels` - they were
held, undrawn, until a load), so the next view starts its own. And the climate's pictures went up through the host's
PINNED door (`dataPipeline.js` pinnedUpload): every climate and season picture of every dungeon the view ever stood
stayed on the GPU for the session. They go through the place's own hold now (`remapSubMeshes` handed `getTexture` and
the hold's `uploadRecord`), and are freed with it - proved on the real pipeline and renderer over a counting GL in
`test/scenes/fb1009_travelperf.test.js` (with `tools/mutants/fb1009_travelperf.json`); `owdungeons.test.js`'s draw pin and
four of its records re-aimed by content, each still dead.

**TV-BEYOND (FIELD BUGS 2026-10-09 #9, maya: "CRASH (2) RangeError: invalid array length" from a click on the Overworld
past the Alik'r).** The planner's search box was clamped to the map, and TAMRIEL2 streams the land past it: two ends
past one edge turned the box inside out and its typed arrays threw; one end past it began the route on the box's far
side. The box's bounds are the map and the two ends now (`systems/travel/travelRoute.js` `planRoute`); `routeGround` asks the
host's `beyond` for the ground past its table (kept a pixel at a time, `BEYOND_CACHE_MAX`) where it called it all the
sea; `apart` leaves an end past the table to the search; a step past the table reads no road's byte of the Bay's table (it
reads the roads past the Bay's own layer since VOYAGER2.1, below). The host hands it
`tvWater`'s own answer, which is the ground's where TAMRIEL2 composed the reader and the sea off the map where it did
not (`scenes/world.js`). The record, and the wire's half: `01-Overview/bugs/Field-Bugs-2026-10-09.md` TV-BEYOND;
`test/systems/travel/fb1009_beyond.test.js`, `tools/mutants/fb1009_beyond.json`.

## ETHER-OW - the Overworld past the Veil (2026-10-13, the owner)

*"Also allow the player to zoom out into the overworld like in the Iliac Bay for easy travel. Enemies should show on
the world map just like in the bay"*. The record is `03-World/Eltheric-Ocean.md` ETHER-OW; what it moved here:
- **The door.** TV1's Overworld door stood on the held map alone, and past the Veil the map's answer is the Eltheric
  chart: it wears the same door now (its button and its key O, the words `scenes/travelView.js` TRAVEL_VIEW_BUTTON -
  moved out of `ui/heldMap.js`, which re-exports it).
- **The places.** `tvPlaceSummary` answers an isle's place past the Veil (known by the captain's charts or found);
  TV5's far list takes the port isles within its range and TV6's lists the ruin isles (`tvDungeonRowsAt`,
  `tvDungeonAt` - one pair the three lists read). The settlements gathered once never keep an isle's place.
- **The load.** TV2's governor reads the stream's own law (`StreamingWorldState.streams`) for what is owed: off the map
  is no longer built where the world streams (the continent's frame, the Eltheric's box).
- **The enemies.** TV7's bands (`bandOk`) and OWS3's raiders (`tvRaidOpen`, `tvRaidSea` - S5's edges kept, by the point's own
  pixel floored) are born on the Bay's map or the Eltheric's box (`world/ethericSea.js` `onBayOrEther`) - a raider past
  the Veil only where the sea fight stands her as a ship (AUDIT ETHER-OW C2-3) - and TV7b's chase word holds a place
  anywhere on the world's pixels (`chaserPlaceOk`, the wire's `worldPixelOk`).
- **What is known** (AUDIT ETHER-OW C2-2). The lists' keys (`tvPlates`, `tvFar`, `tvDng`, `tvFind`, `tvDngModels`) are
  `tvKnownGen` - DFU's finds and the captain's charts - so an isle charted on the pixel the traveller stands on is a
  plate at once, as AUDIT DEEP2 B-3 made a find.
`test/systems/travel/ether_ow.test.js`, `tools/mutants/ether_ow.json`; the pins moved are the Eltheric page's list.

## LOAD-OWED - the land loading is what the stream owes (2026-10-14, the bug-reports channel)

*"When traveling using Overworld, the speed randomly drops and gets locked at 1x after traveling for a while. There are
no enemies or threats nearby to trigger this slowdown. To get back to 100x speed, I have to cancel the travel and
restart it manually"* - "tested and reproduced ... on foot, on horseback, and with the cart" (seven upvotes, a second
player's confirmation).

**Every hold on a journey's clock, and what lets it go** (traced on the code as it stands, each add beside its release):

| Hold | Down to | Let go when |
|---|---|---|
| the land loading (TV2, the view's branch of `travelViewGovern`, world.js:"function travelViewGovern") | halved, to x1 | the counted grid clean for TV_GOV_CLEAR_S, a step at a time (travelGovernor.js:"if (clear >= TV_GOV_CLEAR_S)"); a journey begun or the view down forgets the ceiling |
| enemies near (OW6, `journeyThreats`) | the near-enemies dial, x5 at its lowest (`foePaced`, travelThreat.js:"export const foePaced") | read afresh each frame from the live sets - a band's chase (lost, stood, spent, a town, a load), an alerted foe (culled, dead, its hunt given up), a raider, a hostile ship |
| a stranger in the open zone (PVPNEAR, world.js:"const rate = g.dist") | x1 at 100 m | its 250 ms list - and at 100 m the view comes down and stops the journey |
| the view down under an Overworld journey (AUDIT OW4 J5, world.js:"if (worldTimeScale() !== 1) setWorldTimeScale") | x1 | `tvJourneyUp` (world.js:"function tvJourneyUp") raises the view once no window, foe or duel stands - a window's pause, a danger exit (travelView.js:"&& deps.danger?.()") or two silent heartbeats (travelView.js:"function stalled") brought it down |
| Travel Options' own stops (interruptTravel, travelOptions.js:"function interruptTravel"; an encounter) | x1 | none: the journey is over (the panel's Camp), and a resume asks its rate afresh |
| the helm's time keys (CSA-G), no panel (the frame's nets) | the helm's; x1 | the helm; a journey |

**FOUND.** Only the first can hold a journey at x1 with the view up and nothing near: the enemies' hold never goes under
the near-enemies pace, a stranger's and Travel Options' stop the journey, and the view down is the ground's. And the
land's hold outlived its cause. The count (world.js:"uc.n = unbuiltAround") asked whether the world streams a pixel and whether it is
built. A build that THROWS is let go by the stream - the pump's catch frees what it made and takes the key off the
stream's books (it called `state.release`, AUDIT 49faf853 B1; `state.fail` since BUILD-RETRY, below) - and the stream asked for a pixel only when the traveller crosses
into a new map pixel (streamingWorld.js:"load = this._loadList"). So the pixel read "loading" with nothing building it: the governor halved
the clock to x1 in about eight seconds and held it there, the journey crept at walking pace toward the crossing that
would ask for the pixel again - minutes away on foot - and a build that threw again held it again. A restart forgot the
ceiling (AUDIT DEEP T2-8), and its x100 crossed a pixel before the halving came back down: the players' way out.
Measured on the host's own code (the stream, the pump, the view's governor and its count, lifted out of
`scenes/world.js`): a journey on foot past one pixel of the grid that cannot be built - the clock at x1 for 540 s of
the next 900, the pixel asked for again at four crossings and failing at each, let go only when the traveller had
walked it out of the counted grid; now 4 s, then the climb to x100.

Not this: an enemy unloaded with its ground while it counts. A foe whose pixel leaves the grid is held, not stepped
(FALL-HOLD, exteriorFoes.js:"if (groundStands && !groundStands(f.ai.feet[0], f.ai.feet[2]))"), and a placed one is never culled, so one that was hunting the traveller keeps its
hunt - `holdFrame` (enemyMotor.js:"holdFrame() {") clears its senses, not its GiveUpTimer - and stays alerted (encounters.js:"export function foeAlerted"),
in the threat list at its frozen place. It cannot hold the clock: past the grid's edge it is two and a half kilometres
off, and at x100 THREAT_WARN_S bites only within sixty times the traveller's own pace (about a kilometre for a rider,
300 m on foot); come back within reach and its ground is built and it steps again.
Recorded, not changed.

**FIXED.** The count is the stream's own books: a pixel is owed while the stream holds it (`state.loaded`, built or
building) and has not built it. ETHER-OW's law stands inside that (the stream loads nothing where the world streams
nothing). A hold for the land ends when its build does, whichever way it ends. The failed pixel itself: BUILD-RETRY, below.

**The four hosts.** `scenes/world.js` wired - it alone streams the world and raises the Overworld. `scenes/exterior.js`
streams nothing (one fixed city) and has no Overworld, so no governor; `scenes/worldModes.js` (a building) and
`scenes/dungeonContext.js` (a dungeon) run no journey - a door ends one (AUDIT-TO1 G2).

`test/systems/travel/ow_loadowed.test.js` (2), `tools/mutants/ow_loadowed.json` (4, all dead). PIN MOVED: `ether_ow` (the count's line
run over a real stream), `tv2_click_to_move` (the line's text) and `tv_wasd` (its rig's grid on the stream's books);
`tools/mutants/ether_ow.json` EOW-governor-off-map-built re-aimed by content. The lists naming those suites (audit_etherow,
ether_ow, ow2, ow3j, ow4j, ow4x, ow5, ow5d, ow6s, ratelaw, tv2, tv3, tv5, tv_wasd and this one) re-run: 435 dead; the five
that live (OW6-S-reason-unshown, EDGE-FURNITURE-stale-on-show, AUDIT-DEEP2-E6-bands-unshared, -E7-corner-piece-ignored and
-E8-foot-ends-overlap) live on main's tree as well,
untouched here.

## BUILD-RETRY - the build that threw, and the hole it left (2026-10-15, after LOAD-OWED)

*"Under NO BAND AIDS the failing build itself is still the bug: a hole in the world until the next crossing"* (the
lead, on Mac's rule). LOAD-OWED let the clock go when a pixel's build threw; this is the throw, and the pixel it left
unbuilt.

**THE SWEEP** (`tools/pixelBuildSweep.mjs`, on a player's own ARENA2 - nothing of it kept, nothing of it rendered to a
file: Port-Doctrine). The world host booted in headless Chromium (SwiftShader) in shot mode, its frame held so nothing
else runs, and the pump's own build driven pixel by pixel through the host's probe door
(worldShotHooks.js:"window.__pixelBuild"): the stream re-centred on the pixel as a teleport re-centres it, then
`buildPixel`, a throw caught as the pump's catch catches it and kept with its stack. The places: every town of the
location index (city, town, village, hamlet, a mod's row) and every fourth other place, the Bay's wilderness on a
ten-pixel lattice (every region, every climate) and its sea on every other point of it, the land past the Bay in
TAMRIEL2's frame, and the Eltheric Ocean's isles and open sea past the Veil.
- **Every pixel, once, as the stream builds it:** 12,792 - 8,031 places, 3,158 of the Bay's wilderness and 460 of its
  sea (all ten climates; 45 of the 46 regions on the map, and the 46th's two pixels after), 523 past the Bay in
  TAMRIEL2's frame, 481 Eltheric isles and 139 of its open sea. All stood: none threw, none timed out, no page error
  (builds on SwiftShader: half under 144 ms, 99 in 100 under 3.4 s, the slowest 83 s).
- **Rebuilt after release** (`--again`: built, torn down and built again, as a re-skin or a return rebuilds), 1,348 of
  every kind: all stood. **Under winter's sets** (`--query season=winter`), the same 1,348: all stood. **The season's
  flip in one session** (`--swap`: the rebuild under the other season, both seasons' sets in the caches), 450: all
  stood.
- **A journey in the browser** (`--journey`: the frame running, its draws stubbed, the Overworld raised and the
  movement key held): not drivable on this box. One run raised the view and lost its renderer to the box's
  out-of-memory killer at once (the sandbox's memory at its limit under four browsers); on every other the view came
  down by its own law inside two seconds - SwiftShader's frames on a shared box ran one to three seconds apart, and two
  silent 600 ms heartbeats lower it (travelView.js:"function stalled", AUDIT DEEP X-9). The journey's own path - the
  stream, the pump, the frame's re-ask and the governor at x100 - is run on the host's own code in Node instead
  (`test/systems/travel/ow_loadowed.test.js`, `test/scenes/ow_buildretry.test.js`).
- **A read refused** (`--fail TEXTURE.002 --fail-count 1`: the first read of the desert's ground archive dropped, as a
  dropped fetch drops it), six desert pixels: all six threw `Failed to fetch` (getBytes, under loadGroundSet) - the
  five after the first without reading at all. Now the first throws and the five after it read again and stand.

So no pixel's build throws on whole data, in any season, built once or again: there is no deterministic failure to fix.
What throws is a READ that failed - and the port kept such a failure as its answer for the session, so one dropped read
made every later build that needed the file throw. Three such keeps stood on a pixel's build path, each the
cached-rejection shape AUDIT VE R12 took out of the tile sets:
- **The texture** (dataPipeline.js:"texturePromises.set(archive, asked)"): an archive's ask stood as its answer when it
  rejected - every later pixel of that climate, every town wearing that picture, threw without reading. A failed ask is
  forgotten now and the next one reads (the law of getGpuMesh's in-flight map). The one door every host reads its
  textures through (`createDataPipeline`: the world, the city, the interior, the dungeon).
- **The people's pictures** (world.js:"const ensurePersonTex = () =>"): one load of every person archive, which every
  populated pixel's build waits on, kept by `??=` - one failed archive and every town threw for the session. A failed
  load is forgotten; the next town loads again.
- **The store's connection** (dataSource.js:"d.onclose = () =>"): the IndexedDB connection was opened once and kept.
  Once the browser closed it under the game (its storage failing, the site's data cleared) every read threw on it and
  fell through to the server - on the deployed site, no game data: a 404 - so every file not yet in memory failed. Its
  close is heard now and the next read opens another; a read that meets the connection closing before its close is
  heard asks once more on a fresh one (dataSource.js:"async function idbRead(key)").

**THE RETRY LAW.** Those failures are transient - the next read would not have them - so the stream asks for a failed
pixel again by its own law, not at the next crossing alone. The pump's catch lets the pixel go through `state.fail`
(streamingWorld.js:"fail(px, py, now) {") where it called `release`, and the frame asks
(world.js:"queue.push(...state.retryDue(performance.now()))") for the pixels whose wait is over
(streamingWorld.js:"retryDue(now) {"): still in the grid, not listed again by a crossing meanwhile, taken back on the
stream's books and queued nearest first. The waits are BUILD_RETRY_MS (streamingWorld.js:"export const BUILD_RETRY_MS"):
2, 4, 8, 16 and 32 real seconds after each failure, five asks in about a minute; past the fifth the pixel waits for a
crossing that lists it, as every failed pixel waited before. A pixel that stands forgets its failures
(world.js:"else state.stood(next.px, next.py)"), one that leaves the grid is forgotten, and a new grid (`init`, a
teleport) forgets them all. The port's own: DFU's builds read local files and do not fail.

A re-ask is owed while it builds (LOAD-OWED's count: on the stream's books, not built), so TV2's governor holds for it as
it holds for a crossing's row - bounded with it. Measured on the governor alone (a journey otherwise built, x100 asked):
a pixel whose read failed once costs one build's hold; one that could never be built, each build a second long, keeps the
clock under x100 for about two minutes (at x20 lowest, the halvings and the climb's +5 a step) and holds nothing after
its fifth ask.

Recorded, not changed: loads that keep a failure but throw in no build - the snowfall's masks (snowfallHost.js:"failed = true;": no snow) and the helm's
art (world.js `_csa*Load ??=`) - a session's look lost, not a hole in the world. Low Poly Trees' door no longer keeps
one: since AUDIT BANTHA1 TREE-6 it is asked again on this backoff (lowPolyTreesAssets.js:"failedUntil = now() + (BUILD_RETRY_MS[tries] ?? Infinity);"),
the trees flats meanwhile.

**The four hosts.** `scenes/world.js` wired - it alone streams pixels (the pump, the frame's re-ask, the person
pictures). `scenes/exterior.js` (one fixed city, built once), `scenes/worldModes.js` (a building) and
`scenes/dungeonContext.js` (a dungeon) stream no pixels; the texture and the store are the shared pipeline's and the
data source's, every host's.

`test/scenes/ow_buildretry.test.js` (5), `tools/mutants/ow_buildretry.json` (11, all dead). PIN MOVED: `audit_wod_branch` (WOD6: the
catch's last line is `state.fail`), `tools/mutants/auditwod.json` WOD6-failed-build-stays-arrival and
`tools/mutants/ow_loadowed.json` LOAD-OWED-failed-kept-on-the-books re-aimed by content.

## QUEUE-OWED - the queue builds only what the stream still owes (2026-10-18, a player through LostMyLeg)

*"the world isnt loading at times in the overworld and when it doesnt load his overworld speed goes down to 1x"*
(LostMyLeg on Discord, of another player, handed over as a screenshot).

**What holds the clock.** With nothing near, only the land's hold can take a journey to x1 (LOAD-OWED's table): TV2's
governor halves the clock while a pixel of the counted grid is owed and not built, and climbs back a step for each
TV_GOV_CLEAR_S clean. Since LOAD-OWED a pixel is owed only while the stream holds it, and since BUILD-RETRY a build that
threw is asked for again. What was left is how long the stream takes to build what it owes, and what it spends the time on.

**FOUND.** The host's build queue is first in, first out, and nothing took a pixel off it when the stream let it go. A
crossing queues the grid's new edge (streamingWorld.js:"load = this._loadList") and lets go what left the grid (the
frame's unload: `destroyPixel`, `state.release`). A pixel let go while it still waited in the queue stayed there, and the
pump built it whole and then threw it away - its teardown after the build (AUDIT 24's, the line above
world.js:"else state.stood(next.px, next.py);") was written for a pixel let go while its build was in flight. DFU never
builds one: UpdateTerrains collects first and builds only the terrains still active (StreamingWorld.cs:654-657). Under
the Overworld at x100 the stream falls behind, which is why the governor exists, and on a road that turns the backlog's
pixels leave the grid behind the traveller before their turn comes. Each was a build the grid round the traveller
waited on: holes in the view, and the clock held at x1 while the land loaded.

Measured on the host's own code (the stream, the pump, the view's governor and its count, lifted out of
`scenes/world.js` as LOAD-OWED's test lifts them): a journey under the view at x100, nothing near, every build a fixed
real time, one at a time, 300 s. A turning road turns a right angle every 20 s.

| Journey | Build | x1 before | x1 now | Builds begun for a let-go pixel, before |
|---|---|---|---|---|
| on foot (5 m/s), diagonal | 1 s | 18.6 s | 9.4 s | 22 of 273 |
| on foot, turning | 1 s | 34.3 s | 13.1 s | 56 of 279 |
| horse (12 m/s), diagonal | 0.5 s | 14.6 s | 10.1 s | 60 of 554 |
| horse, turning | 0.5 s | 25.1 s | 10.1 s | 91 of 551 |
| horse, diagonal | 1 s | 96.1 s | 24.2 s | 38 of 292 |
| horse, turning | 1 s | 126.5 s | 56.4 s | 78 of 292 |

None is begun now. A straight road is unchanged (on foot 4.9 s, a horse 39.9 s at 1 s a build): there the backlog never
outlives the grid, and what holds the clock is the machine's build rate - TV2's cap as designed ("Cap it to what loads
cleanly"). Recorded, not changed.

**FIXED.** The pump asks the stream's books before it starts a build and as one ends (streamingWorld.js:"owes(queue) {",
world.js:"if (building || !state.owes(queue)"): the let-go pixels at the queue's head are dropped unbuilt, the
rest keep their order, and with nothing owed the stream's run is over (PERF-EXT24's `_streamSince`). Both asks are
needed - the one as a build ends catches what left the grid while it built, the one before a build what the frame's own
crossing let go before the pump's turn. A pixel let go while its build is in flight is still torn down when it lands. The
pump is no longer than it was (HOST-SPLIT). Every producer that queues a pixel puts it on the books - the init's and a
crossing's load lists, BUILD-RETRY's re-ask, and the rebuild sweeps (the roads, World of Daggerfall's late regions, the
hollow, the gate's clearing, the season's re-skin, a layout pin), each of a pixel standing in `built` - so nothing of
theirs is dropped while the stream holds it.

Recorded, not changed: the terrain worker chains a job that arrives while the roads network loads on `pendingRoads`
(terrainGenWorker.js:"if (m.t === 'job' && pendingRoads)"), and nothing clears it if the network's build throws - every
later job, and the stream with it, would wait for ever. No such throw is known, and that stall would hold every pixel
from the network's arrival on, not "at times". The cause on the player's machine is not proven: no game data is in the
container and no log came with the report. The stream's own line (`stream: entered X,Y (load N, unload M)`) and any
`pixel X,Y failed` error in their console would show whether the stream fell behind or stopped.

**The four hosts.** `scenes/world.js` wired - it alone streams pixels (the pump). `scenes/exterior.js` builds one fixed
city once; `scenes/worldModes.js` (a building) and `scenes/dungeonContext.js` (a dungeon) stream no pixels and keep no
build queue.

`test/systems/travel/ow_queueowed.test.js` (3), `tools/mutants/ow_queueowed.json` (4, all dead). PIN MOVED: `buildslice`
(PERF-EXT24: the stream ends with what the queue still owes); `tools/mutants/perfextc.json`
PERF-EXT24-the-stream-never-ends-so-its-age-guard-trips-at-once-next-time re-aimed by content.

## OW-BUILD - the Overworld's ground first (2026-10-18, the owner, after QUEUE-OWED)

QUEUE-OWED took the wasted builds out of the stream and left this standing: on a machine that builds a pixel more slowly
than a journey crosses them, TV2's governor still holds the clock down to x1, on a straight road as on a turning one.
Offered three ways on - build the ground faster during Overworld travel, a softer floor under the governor, or both - the
owner chose the first: *"1"*.

**What paced the ground.** A streamed pixel's build breathes (systems/buildBreather.js, PERF7): a slice of work a frame,
then it gives the frame back. PERF-EXT24 sized the slice to what the display's frame left - 3 to 6 ms - so that a
streaming frame still made its beat. Under the Overworld that is the wrong trade. The traveller is watching the land from
the sky with the clock at up to x100, and what holds that clock is the ground the stream has not built.

**FIXED.** While the view is up the host's budget says so (world.js:"overworld: !!travelView?.active"), and
frameFitBudget sizes the slice against a frame of 30 a second instead of the display's
(buildBreather.js:"export const BUILD_OVERWORLD_FRAME_MS"). The slice is what that frame leaves past the frame's own
script and the margin, up to 20 ms (BUILD_SLICE_OVERWORLD_MS) and never less than the ordinary 6. A light frame drops to
30 a second while ground is owed. A frame already under 60 loses nothing. A frame too heavy to leave 6 is sized as an old
stream always was. With the view down, or nothing queued, nothing changes.

Measured: the real breather over a pixel's work on a 60 Hz display, and the journey rig QUEUE-OWED measured with (the
host's own stream, pump, governor and count; a horse at x100, 300 s). The work is set so that a pixel takes 1 s on the
ordinary slice at 8 ms of frame script.

| Frame script | Slice | Frame rate | Pixel build | x1, straight road | x1, turning road |
|---|---|---|---|---|---|
| 4 or 8 ms | 6 -> 20 ms | 60 -> 30 | 1.00 -> 0.60 s | 39.9 -> 11.4 s | 56.4 -> 12.9 s |
| 12 ms | 6 -> 18.8 ms | 30 -> 30 | 2.00 -> 0.67 s | 133.1 -> 13.1 s | 162.9 -> 19.7 s |
| 20 ms | 6 -> 10.8 ms | 30 -> 30 | 2.00 -> 1.13 s | 133.1 -> 46.8 s | 162.9 -> 91.8 s |

Not measured: the frame's own script under the Overworld on a player's machine, and how much of a pixel's build is the
breather's slices rather than the terrain worker's round trip or a cold read (there is no game data in the container).
Only the slices are made faster. The governor is unchanged (TV2: "Cap it to what loads cleanly"), and so is its floor.

**The four hosts.** `scenes/world.js` wired - it alone streams pixels and raises the Overworld. `scenes/exterior.js`
builds one fixed city once, through no breather; `scenes/worldModes.js` (a building) and `scenes/dungeonContext.js` (a
dungeon) stream no pixels and raise no Overworld.

`test/systems/travel/ow_buildpace.test.js` (3), `tools/mutants/ow_buildpace.json` (7, all dead). PIN MOVED: `buildslice`
(the host's budget line carries the view; its lifted budget is handed one); `tools/mutants/perfextc.json`
PERF-EXT24-review-awaited-is-inferred-from-an-idle-pump-again re-aimed by content. The record of the slice it changes:
`07-Rendering/Performance-Exterior.md` PERF-EXT24.

## TIME-DILATION - the sea's AI never on the journey's clock (2026-10-17, the owner)

The owner: *"fix a pre existing issue where AI can actually use the overworld as time dilation"*. The record is
`03-World/Naval-Refit.md` TIME-DILATION; this page's part of it:

- **OW6's cap holds the clock at x1 inside a hostile ship's hold** (`systems/travel/travelThreat.js foeRate`, `threatCap`'s
  `held`): the sea fight is stepped on the world's clock, so ENEMY-PACE's floor (the 'foe' dial, x5 to x60) ran a pirate's
  guns at that rate on a traveller under the Overworld, where none can be fired. Both of `travelViewGovern`'s paths call
  `foeRate` where they called `foePaced`; a land foe holds no ring (TO1: it keeps its own pace), so every OW6, ENEMY-PACE and
  PACE-DIALS law ashore is as it was. The tests that mount the governor mount `foeRate` beside `foePaced`.
- **The view comes down for a hostile ship, never rises over one and refuses a click near one**: its `danger`,
  `tvJourneyUp` and `travelViewCanGo` ask `navalHostileNear()` (NAV-H's enemy nearby) beside the land's foes and a duel.

`test/systems/naval/timedilation.test.js` (3), `tools/mutants/timedilation.json` (16, all dead).

## OW-RISE - the Overworld rises over a foe that has not noticed the traveller (2026-10-17)

*"the overworld travel randomly slows down from speed multiplier even without enemies nearby"*. The view down under an
Overworld journey walks it at x1 until `tvJourneyUp` raises the view again (AUDIT OW4 J5) - and the rise asked every
hostile foe in classic spawn reach (`areEnemiesNearby(exteriorFoePool())`), where the view's own `danger` asks only the
foes WILD-ALERT lets through (`wildSeen`). So once the view came down (a window, an alerted foe passed), an unaware camp
beside the road kept it down and the journey at x1 with nothing coming. The rise asks the danger's pool now.
`test/systems/travel/ow_rise.test.js` (1). PIN MOVED: `tv2_click_to_move` (the rise's gate), the rise's stubs in `ow_toggle`,
`fb0929_overworld_mouse` and `fb0929d_toroads`.

## OW-LEAD - the land's hold is how near the hole is, not how long it has stood (2026-10-17)

*"iam 100% sure it even slowed down to 1x without enemies in 500m nearby ... it almost always [goes] down to 1x and
after a while it goes up again"*. After LOAD-OWED and BUILD-RETRY the land's hold still did it with every build
standing: TV2's halving cut again every TV_GOV_SETTLE_S while ANY pixel of the counted grid was building, and a slower
clock builds nothing faster - a crossing's row the pump took eight seconds over (a town or two in it) took the journey
50, 25, 10, 5, 1; the climb back was a step every TV_GOV_CLEAR_S, eighty seconds to x100; and at x100 the next crossing's
row did it again. What slowing buys is the traveller NOT REACHING a pixel before it stands. So the host hands the
governor the owed pixels themselves (`unbuiltAround`'s `out`, `uc.owed`), the feet (native) and the motor's pace, and
the clock is held to the rate at which the traveller takes TV_GOV_LEAD_S of real time to reach the nearest owed pixel's
square (travelGovernor.js `owedMetres`, `leadCap`; OW6's law for an enemy's reach, with the stream's books for the
enemies), on the spinner's ladder, never under walking pace, and let go the frame the last build stands. The halving
still answers a bare count (no host hands one now). TV_GOV_LEAD_S = 4, from the host's own code over builds of 0.3 - 3 s
a pixel, rider and walker: nearly all of 2's pace where builds are quick, and where they are slow a deep queue held off
the traveller (a few seconds at x1 where 2 had most of a minute). A rider at x100, every build a second: the halving
31 s of 120 at x1, this none, and further on. `test/systems/travel/ow_lead.test.js` (2). PIN MOVED: `ow_loadowed` (P in flight
held by its nearness, never entered), `tv_wasd` (a hole half a pixel off holds the keys at x20 from the first frame),
`ow6_slowdown` (the hole underfoot), `ether_ow` and `tv2_click_to_move` (the count's line hands `uc.owed`).

## THE OVERWORLD REVISITED - six slices (2026-10-19, the owner)

Asked how the Overworld could be improved ("Its been awhile since we've touched it"), six gaps were laid out from this
page's own open notes; the owner's answers, whole: *"1. Do it 2. Actually shrink dungeons slightly, and ensure their size
doesnt grow.or.shrino based on distance 3. I like this idea, but do it right 4. Fix it 5. Routes should always follow the
road if planned, it should never offset 6. When in a town, slow down overworld navigation and have it navigate properly
on town pathways instead of bumping into buildings"*. Every one is the enhanced lane's (the classic skin has no
Overworld); DFU has no raised travel camera, so each is a departure in the sense THE TRAVEL VIEW's ledger row gives -
the two that change a DFU member's behaviour (OW-ROAD-TRUE and OW-TOWN-WALK: Travel Options' autopilot,
PlayerAutoPilot.cs) carry their own `01-Overview/Port-Ledger.md` rows. HOST-SPLIT: `bootWorld` had three logical lines
of room; OW-DUNGEONS' list, load and draw moved out first (`scenes/travelViewDungeonModels.js`, `tools/hostMove.mjs`,
86 lines freed), and every slice's behaviour is a module the host wires. **Audited the next day** (AUDIT OW-REVISITED,
2026-10-20, the owner: "Audit this and ensure perfection" - `01-Overview/audits/Audit-Overworld-Revisited.md`): six cold
lanes over a frozen snapshot, every finding reproduced on the live tree and fixed, pinned or recorded. The sections below
are the law as it now stands, each audit change marked with its id.

### OW-QUEST - where the quests point, on the Overworld (1)

The held map marked every active quest's place (GUIDE5) and the compass the followed one (TRACK-ONLY); the Overworld,
where a traveller sets out from, marked none. Now `scenes/travelViewMarks.js` stands the held map's own marks
(`ui/quest/questMarks.js questMapMarks` - only a place on the player's map, two quests at one place one mark) at their
PLACE's middle - the host's own place law (`tvPlaceRect` of `tvPlaceSummary`: where the plates, the journey's end and a
dungeon's model stand), the pixel's middle where it answers none (AUDIT OW-REVISITED L5-1: the main quest's eight CUST
dungeons stand off their pixel's middle, and the diamond stood ~100 m outside them) - a diamond in the journal's gold
(`ui/travel/travelViewHud.js questGlyph`): the followed quest's filled and held at the screen's edge with its distance -
never while the live journey's end stands at it (L5-5: one arrow for one place) - the rest hollow where they lie. The
words (`questMarkWords`): the first quest's title cut at a word to QUEST_OW_TITLE_MAX (40), how many more stand there, and
under it the distance and the first quest's time left (L5-7: the followed one's where it stands here) - in the player's
language (L5-6: the quest faces' one phrase, `ui/quest/questRail.js timeLeftWords`, through the text core, `quest.remain.*`;
the held map's card for several quests too, `quest.mark.*`); the hover card is the held map's. Pressed, a journey there
by the Path switch's way (`scenes/world.js onTravelViewMark`, `travelViewRouteTo`: the roads by default, across country on
FREE - L5-7), its place's summary from the pixel, wherever on the map it lies. Never filtered by the map's switches (a
quest is the point, not clutter); under the quest marks' own switch (`marksOn`). The four hosts: `scenes/world.js` WIRED
(the one host with the Overworld); `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` raise
none. Proof: `test/ui/travel/owquest.test.js` (6 - TRACK-ONLY with nothing tracked, the exact distance, the hold freed,
the gold, one arrow, the words in German: L5-2 to L5-6), `tools/mutants/owquest.json` (17, all dead).

### OW-DUNGEON-SIZE - one height in the world (2)

OW-DUNGEONS grew each dungeon's model to TV_DUNGEON_ICON_K (0.09) of the eye's distance - the same size on the screen at
every zoom, so it swelled as the view drew back and shrank as it came in. Now every dungeon's model stands
TV_DUNGEON_ICON_M (24 m) tall whatever the distance (`systems/travel/travelDungeonModels.js owDungeonGrow(h, blend)`):
four fifths of what the old law stood at the view's default (260 m up at 52 degrees, 330 m from the traveller - 30 m;
51 m at the view's top, AUDIT OW-REVISITED L5-9), so slightly smaller there, and from then on nearer as the view zooms in
and farther as it draws back, as the land round it is. Still never under its own size nor past OW-BIG's twelve - so not
quite every dungeon (L5-8, measured over all 4,238 entrance models): the 123 keeps' flat door model (43600, 0.58 m)
stops at twelve times itself, 6.9 m, and 30 models taller than 24 m (to 32.25 m, Castle Hawkston's) stand their own
height; the old law met the same cap, and none of the three varies with the eye. It grows from the world's own as the
view rises and shrinks back as it comes down (`blend`, the view frame's own), so no grown model ever stands over a
traveller on the ground. The four hosts as OW-DUNGEONS. Proof: `test/world/owdungeons.test.js` (the grow and the host's
draw re-pinned: the same matrix with the eye near or far), `test/scenes/fb1009_travelperf.test.js` and
`test/systems/travel/ether_ow.test.js` (reading the moved code through `test/hostText.mjs`); `tools/mutants/owdungeons.json`
(49, all dead - the grow's four re-aimed, four new: the blend unread, unclamped, the host grown by distance, the blend
unhanded), `fb1009_travelperf.json` and `audit_etherow.json` re-aimed by the move.

### OW-FORECAST - the weather ahead (3)

The owner: *"I like this idea, but do it right"*. Right is TV4's rule: nothing invented. The weather is a map (WEATHER3) -
a pure function of place and minute - so it can be asked of a place and a minute not yet come, and the answer is the
one the traveller will stand in. `systems/weather/owForecast.js` (the law) and `scenes/overworldForecastHost.js` (the
host's half) say it in three places, every word `weatherAt` for its own ground at the minute it names, through the
host's own ground law (`mapGround`: what falls is the air's), on the shared minute online:
- **The way ahead**, while a journey drives: the way still to walk - the drawn line's own (`systems/travel/travelRoute.js
  wayStillToWalk`: the town's streets still ahead, never those walked - AUDIT OW-REVISITED L3-2 - a rejoin, then each
  leg's point), cut where the traveller would leave the ground they stand on (a sea leg ahead of a walker, the shore
  ahead of a sailor) - sampled every ROUTE_STEP_M (400 m - L3-5: weather between 1.6 km samples was missed) to
  ROUTE_AHEAD_M (40 km) and its end, ROUTE_SAMPLES_MAX (101) at most, each asked at the minute the traveller reaches it:
  EACH STRETCH AT ITS OWN PACE (L3-1: the whole way was asked at the pace of the moment, while a road runs at x100, the
  open ground at x60, a road reckless and a track cautious, a town's streets at x5 - a third of the "ahead" lines untrue
  on arrival offline, four in five at an online journey's start). Travel Options says each stretch's force and rate
  (`wayPace`); the pace MEASURED now (`paceMeter`: field metres a real second and the weather's clock a real second, the
  first measure taken whole, then a mean over PACE_TAU_S; started again after a gap past PACE_GAP_S or a clock step past
  PACE_CLOCK_STEP_MIN - L3-9) is scaled to each by its force against the walk's now, and online by its rate against the
  clock's (`wayMinuteAt`: offline the calendar runs with the rate, which so cancels). The first change that matters is
  said ("Rain ahead - 2.4 km, in 20 min" - the language's own figures, L3-12), or what falls now giving out
  ("Thunderstorm clears 6.4 km ahead"), or the same the whole way ("Fair weather all the way to Daggerfall": fair is no
  rain, snow, storm or fog - the sky's look is never news, and its four words, never shown, are gone - L3-11). A pass is
  begun every FORECAST_EVERY_MS (2 s) and at once when the journey changes, read FORECAST_SLICE (4) places a frame (L3-10:
  a whole pass took up to 26 ms of one frame); the line said is the last pass's, never one of a journey that ended (L3-8).
- **Here**, standing - or stopped (L3-3: a stopped journey forecast at the pace it no longer had for twenty seconds), or
  while a new journey's first pass reads its way: the next HERE_HOURS (6) at the traveller's place AT THEIR HEIGHT (L3-4:
  the ground's mean height named the other phase of what was falling on them; the way's far places still read at the
  ground's), a word every HERE_STEP_MIN (15) (`forecastAt`), the minute a change comes found to the minute (L3-7: a
  bisection inside the quarter hour) - "Rain - clearing in about 2 h", "Thunderstorm in 9 min", "Fair for the next 6 h".
- **A place's card**: its own next hours first ("Weather: ..."), then TOWN-ECON's card under it (or the weather alone),
  kept a minute of the weather's clock (`placeLine`, FORECAST_CARDS_MAX places).
The line stands under the journey's in the Overworld's block (`tview-sky`, shown only when it says something). Off the
map's lane (`weatherMapOn`: the classic skin, `?wxmap=off`) the sky is DFU's day roll per climate, which has no tomorrow
to read - and nothing is said; nor while an event holds the sky (L3-14: Sun Baby's sun). The four hosts:
`scenes/world.js` WIRED (the one host with the Overworld); `scenes/exterior.js`, `scenes/worldModes.js` and
`scenes/dungeonContext.js` raise none (L6-6). Proof: `test/systems/weather/ow_forecast.test.js` (9 - the law, the
samples, the meter, the way, the card, the wiring; a traveller flown at a steady pace through the host over a woodland
map, told the map's own answer), `test/systems/weather/audit_owrevisited_forecast.test.js` (6 - over the REAL map where
ARENA2 is, a journey of a road and then the open ground flown through the host, its line the one a PHYSICAL walk of
each stretch makes, offline, online and with the clock held; the stop, the gap and the clock's step; the slices; here at
the traveller's height and the event's sky; the figures; a walk resumed); `tools/mutants/ow_forecast.json` (26) and
`tools/mutants/audit_owrevisited_forecast.json` (31: 30 dead, one recorded equivalent). Every word is the player's
language's (L10N4: `t`, `forecast.*` in Port_Strings - a weather word said after another its own row, `forecast.turn.*`,
never a lowercased one; drafted in-session for the 25 languages, machine-made until a person's lands; "Fair" re-drafted
where it read as "sunny").

### OW-CHASE-RANGE - a chase seen as far as its band is drawn (4)

TV7b's recorded limit (AUDIT OW3's "Known, not changed", OW6's): a chase rode the chaser's cell foes frame, which the
relay fans RANGE_PIXELS (3) about its sender, while the Overworld draws the bands BAND_REACH_PX (6) about the viewer - a
player three to six pixels off saw a chased band at its own wander, and its spending only through the cell's ledger.
The region already has a word that reaches past the cell: each traveller's frame (TV3). Now the chaser's trav frame
carries its chase words BESIDE its mark (`net/wire.js`: `{ t: 'trav', p, bd, sr }` - AUDIT OW-REVISITED L4-1: first an
eighth key of the mark, which every older client refused whole, so the chaser vanished from their book; the mark stays
TV3's seven keys): `bd` the bands', `sr` the raiders' - the foes frame's own two words, each its own BANDS_WIRE_MAX slots
(`systems/travel/regionChase.js regionChaseWords`: the chases first, then the spent of this life and the last - L4-6:
one shared word let the bands' spends crowd the raiders' out, and spends of lives gone by fill it). Each word is checked
apart at the relay's door (`validTravWords`: an id once, a chase on the world's pixels both ways, a spent one at none -
L4-7 pinned the z bound and the spent place), a bad word dropped alone (L4-9: one bad entry refused the whole mark); kept
beside the mark (the Room's attachment `tm`) and fanned with it, live and in a welcome's rows. The client says them
(`systems/travellerMarks.js travellerDue`) when a chase begins or ends or a band is spent (`chaseWordKey`: who, never
where), and again every TRAV_CHASE_REFRESH_MS (the session's own floor) while a chase RUNS (L4-8: a standing raider ship
had a moored traveller send a mark every ten seconds). A reader hears them (`scenes/regionChaseHost.js
createRegionChaseHearing`, the host's wiring of it) through the bands' and the raiders' own hearing, the word standing
TRAV_BAND_HOLD_MS (25 s, a missed refresh and still drawn):
- at every distance its sender could share a band with the reader (L4-4: past the cell's reach only, a chase went unseen
  up to seven seconds at the hand-over), a fresh cell word for the same id preferred; never from a sender farther than
  REGION_BANDS_NEAR_PX (9) for the bands, REGION_RAIDERS_NEAR_PX (19) for the raiders (L4-5: any traveller in the region
  could spend every band about a reader);
- WITHDRAWN when the chaser's next mark no longer names it, their mark is cleared, they leave, or a welcome no longer
  lists them; a welcome's row heard with its age gone from its word (L4-2 / L6-2: a far chase stood drawn 25 s after it
  ended);
- never of one the reader's map hides (L4-3: WILD1's open zone - a stranger's mark is drawn to no one, and the band beside
  it was drawn where they rode).
RELAY_VERSION **world230** (world224 on its branch, renumbered past LAYERED-GEAR's world224 at one merge, then world225,
its law hash moved in place with the words' place, never deployed, renumbered past GAUNTLET-SLAIN's world225 to WB14b's
world229 at the next). The widest frame (the widest mark, both words at their longest)
fits the runtime's 2 KiB attachment.
- **What it is not.** A mark is said only by a traveller who shows themselves to the region ("Show me to travellers",
  on by default) and only in their region's channel: a chaser who hides, or one across a region's border, is heard as
  before, within the cell's three pixels. A chase's place is the mark's, refreshed at most once a TRAV_CHASE_REFRESH_MS.
  A band spent as its chaser goes indoors is cleared with the mark, unsaid to the region - the cell's ledger (OW6L)
  carries it.
- **Deploy.** Nothing breaks in either order: an older relay ignores the words beside the mark, an older client reads
  the mark and ignores them. The relay at world230 is what fans them.
The four hosts: `scenes/world.js` WIRED (the one host with the region's travellers); `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` hear no region (L6-6). Proof:
`test/systems/travel/ow_chaserange.test.js` (7: the wire - the mark seven keys and no eighth, the law an older client
reads it by, the words checked apart; the relay over a real Room; the session; the client's law; the region's words and their reach; a word end to end through
the real doors; the host's hearing run - withdrawn, aged, hidden, a cell word preferred); the TV3 pins
(`test/scenes/tv3_travellers.test.js`: seven keys again, the hearing's wiring); `test/net/relayversion.test.js` (the
world230 law); every `RELAY_VERSION` pin at world230; `tools/mutants/ow_chaserange.json` (23) and
`tools/mutants/audit_owrevisited_chase.json` (22), all dead.

### OW-ROAD-TRUE - a planned road is walked on the road (5)

The owner: *"Routes should always follow the road if planned, it should never offset"*. OW-ROADSIDE joined the road at the
start; the walk after it was still the mod's: PlayerAutoPilot.cs's Update re-aims only when the map pixel under the
player changes (:92-96). With Avoid Obstacles off, whatever turned the body off the road's line was carried at that
bearing for up to a pixel (819 m) beside the road; with it on (the default), TRAVEL-NAV1's BACK TO THE LINE took the body
back - but to the leg's OWN line, from wherever the leg began, and a leg that began off the road (past a corner a
frame's step at a hundred times walking pace overshot, a five-degree swing taken for an arrival, a resume) walked beside
the road the whole leg: knocked near a corner, 102 m off it (AUDIT OW-REVISITED L2-6 restates it: the first record named
the mod's carry alone, which the default never meets). Now a routed leg on a road or a track walks its LANE
(`systems/travel/travelOptions.js routeLane`: its last leg's pixel middle to its own - the road's own line, travelPaths.js:
middle to middle; on and off a town's ring from the ring's own point, L2-3 / L2-7): every frame the body aims at the
point a short way ahead of its own projection onto the line (`systems/travel/travelAutopilot.js lanePursuit`,
`pathPursuit`), LANE_LOOK_MIN (a path's width, 512) ahead at the least and LANE_LOOK_STEPS (3) frames' steps at speed,
never past LANE_LOOK_MAX (a block) - back on the road within a few frames and on it to the leg's end; a frame's force is
cut so it lands on a run's end rather than past it, down to LANE_CORNER_FORCE_MIN (0.25 - L2-4: at 20 fps a corner was
overshot 26 m; a hitch past that floor still carries the body over, back within frames). No five-degree bearing latch: a
swing is no arrival. The place and the spot:
- **A place's last leg** walks the road up to it, and on to the place's middle where the lane ends outside its rect
  (`finalPath`); it is arrived at only in its rect (L2-1: arrived at the lane's end wherever the body stood - 51 m outside
  Privateer's Hold, whose rect stands off its pixel's middle).
- **A spot's last road leg** walks the road to the point on it nearest the spot, then leaves it (`travelRoute.js
  finalRoadVia`, `finalPath`; the drawn line through that point, `routeDrawPoints`' `via`) - L2-2: it was walked on one
  bearing, 280 m beside the road for a click 300 m off it, a bend cut by 231 m.
- **A town's ring on a diagonal** passes where the road's diagonal through the town's middle crosses the band
  (`ringPassPoints`), the corner square walked round where the walk passes it - L2-3: the band's corner stood up to 72 m
  off the road's diagonal, on 245 of 400 real routes.
The steering keeps the walk's own line (`systems/travel/travelSteer.js`: a leg that walks a line hands its run's end for
the feelers' line, and its bearing is the way wanted). A held strafe (TRAVEL-STRAFE) walks the run's own bearing while the
key is held, the body beside the line where the hand put it; let go, the pursuit takes it back to the road (L2-5: the
pursuit pulled the strafe back before the steering saw it - a design call of the audit's, the road the route's law and the
strafe the hand's moment). Open ground, a join and the sea walk as before; the mod's own journeys (a place straight, the
follow key, the coordinates) keep its re-aim exactly. A departure from PlayerAutoPilot.cs Update (:76-105): Port-Ledger
row OW-ROAD-TRUE. The four hosts: `scenes/world.js` WIRED (its journeys are Travel Options'); `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` walk no routed leg (L6-6). Proof:
`test/systems/travel/ow_roadtrue.test.js` (5: the law; the walk flown over the real autopilot - the mod's re-aim beside it,
the lane back on it; no swing an arrival; the look ahead; the legs handed a lane by the real Travel Options),
`test/systems/travel/audit_owrevisited_walk.test.js` (the place, the spot, the ring's diagonal, the corner's force, the
strafe); `tools/mutants/ow_roadtrue.json` (16: 15 dead, one recorded equivalent) and
`tools/mutants/audit_owrevisited_walk.json`.

### OW-TOWN-WALK - a town walked by its streets, at a town's pace (6)

The owner: *"When in a town, slow down overworld navigation and have it navigate properly on town pathways instead of
bumping into buildings"*. A journey aims straight at its next point and the steering feels its way round what stands in
front - across country enough; in a town, at a hundred times walking pace, a walk into walls: the journey that starts at
a tavern door, the spot clicked in a market square, the resume in the street a fight stopped it in. DFU walks its
townsfolk on the town's own grid (CityNavigation.cs: 1.6 m cells, a building's footprint none, the ground weighted by its
tile), and the port already paths its residents over it (`systems/livingWorld/townPaths.js`, LW1). A journey in a town now
takes the same way:
- **The way** (`systems/travel/townWalk.js townWayCells`): from the street cell nearest the traveller (`snapCell`, within
  TOWN_SNAP_CELLS) to the street cell nearest the leg's point - or, the point outside the town, to the nearest edge
  street a way reaches (`exitCells`, TOWN_EXIT_TRIES of them, nearest first, of the traveller's own PIECE of the grid -
  `componentsOf`, the street cells flooded four neighbours at a time as the walkers step, kept on the grid) - by the
  residents' A* (`findTownPath`, its heuristic weighted TOWN_WAY_H_WEIGHT = 1.5: a way at most 1.5 times the cheapest,
  measured 2.7% dearer and about 1.6 times as quick - AUDIT OW-REVISITED L6-7 re-measured "twice"; the residents' own
  searches stay the cheapest, `hWeight` 1), its four-neighbour staircase STRING-PULLED to the straight runs the grid can
  see along (`simplifyWay`, `clearLine`) - every run TOWN_WAY_MARGIN (0.3 of a cell) clear of every covered cell, so the
  body's capsule, not its centre, keeps to the street (L1-2: runs grazed the footprints, and riding at 30 fps went 1.6 m
  into a building). A point in another piece (behind a shut gate, a yard the houses close in) is met at this piece's cell
  nearest it, the way said not `reached`.
- **The gates** (`gatePassage`, `carveNav`, `scenes/townWalkHost.js journeyGrid`): a walled city's gate is a closed
  footprint on its grid (LW-WALLS - its residents never walk out), so its inside and its fields are two pieces and no
  way left the inside - 1,776 of 1,920 doors of the twelve greatest cities found no way out, each failed search ~200 ms.
  The JOURNEY's grid is the town's with each OPEN gate (the pixel's `cityGates`, DaggerfallCityGate's placements, open
  while their model is 446) carved through: from the gate model's middle, the axis along which its covered cells end in a
  street BOTH sides within GATE_REACH_CELLS (the shorter where both do), the cells between made road (weight 15). A copy,
  the walkers' occupancy flags left out - the town's grid never written; kept a town and its gates' state
  (JOURNEY_GRIDS_MAX - ~8 MB each with the search's scratch, a rebuilt pixel's dropped: L1-7), so a gate swung at dusk
  makes it again. A way that falls short BECAUSE a gate is shut - it would reach with the gates open (offline at night;
  online the gates stand open) - stops the journey before it walks into the wall: "Paused the journey since the city
  gates are shut for the night." (TRAVEL_NAV_TEXT.MsgGatesShut; L6-3: any way short at night was blamed on the gates, a
  yard the houses close in among them - such a way is walked as far as it reaches, by day or night). Over every city of
  the game (410; twelve doors each toward four sides, gates open; re-measured at the audit): all 19,680 ways found, every
  run clear with the margin, 6.9 ms on the mean, 61 ms at the worst.
- **The town** (`scenes/townWalkHost.js`): a built pixel's populated place - DFU's seven location types, every one whose
  build stands a CityNavigation on its `population` - in the location frame the pixel's translation carries; `townKey`
  where a point stands in a grid, `townWay` the way as natives, its first run checked from where the traveller really
  stands (their own cell left out only when that run is clear - L1-2), `townPace` whether the traveller stands in the
  town's streets (below).
- **The walk** (`systems/travel/travelOptions.js streetRun`): at a leg's start in a town - the journey's own start, a
  resume, or a town walked into on the way (the watch in `update`, a spot clicked in its square; a town left is
  forgotten, so one walked into again on the same leg is walked by its streets again - L1-9) - the street way first, once
  a leg and a town, walked as ONE line of runs (`pathPursuit`, OW-ROAD-TRUE's law: the run moves on while the body
  stands nearer the next run - L1-1: past a turn sharper than a right angle the walk hovered at the corner for ever, 37%
  of the game's ways - with STREET_LOOK, a cell and a half, never past it at any frame's step, so a corner is turned at
  the corner, never cut across the building it goes round), then the leg from where it ends. The steering asks its
  corridor to the run's end, never nine metres past the corner the street turns at (L1-3). A line's leg arrives only on
  its last run (L1-9: a way bending back arrived across a wall). Never on a town's ring (walked round, outside), never at
  sea, never across the place the journey is bound for (arrived at its edge, as ever). A gates-shut word is forgotten
  when a journey begins, resumes or is interrupted (L1-5: it stopped the next journey, anywhere and by day). The
  Overworld's route line is drawn down the streets still ahead.
- **The pace**: TOWN_PACE_MAX (x5; IC-PACE, below: the Imperial City's IMPERIAL_PACE_MAX) - a street run asks the clock
  no more (`applyRate`), and under the view the governor
  holds the keys' travel (TV-WASD) and any journey to it while the traveller stands in a town's STREETS (`townPace`: a
  walled city's fields, where its ring runs, are not the town - L1-4: every walk round a city's ring was held at x5; a
  wall that does not close counts as all town), the panel saying why ("in town", TRAVEL_HELD_WHY - the whole held line
  in the player's language, L1-8).
- **The four hosts**: `scenes/world.js` WIRED (it alone streams towns and walks journeys through them);
  `scenes/exterior.js` (the fixed city: no Travel Options journey crosses it), `scenes/worldModes.js` (a building) and
  `scenes/dungeonContext.js` (a dungeon) walk none.
- **Known, not changed.** A way is searched whole at its leg's start (`findTownPath`, not sliced as the residents' book
  slices it): the worst of the game's 19,680 measured ways took 61 ms - once a leg, never a frame; the worst is a grid's
  FIRST ask, which labels its pieces once (`componentsOf`: 62-114 ms in the greatest cities on a shared machine, L6-9), in
  the frame the leg starts. Moving bodies (residents, wagons) are no cells of the grid: the steering meets them as before;
  nor are the 19 windmills, which stand on cells the grid reads as street (L1-9). A spot clicked deep in a building is
  walked to from the street cell nearest it (L1-9: 2.2% of covered cells stand over 6.4 m from a street).
A departure from Travel Options' journeys (PlayerAutoPilot.cs walks straight; DFU's own fast travel never walks a town):
Port-Ledger row OW-TOWN-WALK. Proof: `test/systems/travel/ow_townwalk.test.js` (12: the law, the way, the line walked, the
journey over the real Travel Options, a town walked into, the host's half over a real CityNavigation, the steering, the
wiring, the walls and their gates, the host's gates and the shut stop - its word pinned (L6-4), the game's own cities
over ARENA2, the search's reach), `test/systems/travel/audit_owrevisited_walk.test.js` (11, with OW-ROAD-TRUE's: the
hairpin, the margin and the first run, the corner's force, the steering's corridor, the ring's pace, the gates blamed
only when they are the reason and the grids kept, the journey's words forgotten and a town walked into again, the last
run's arrival); the governor's mounts given the town (`ow6_slowdown` - run IN a town, L6-10: x5 "in town", a chasing
band's x20 no reason, the ground's lower cap the reason - `ow_lead`, `ow_loadowed`, `ow_queueowed`, `ow_toggle`, `tv_wasd`,
`fb0929d_toroads`) and `tv2_click_to_move`'s route-line and cap pins moved; `tools/mutants/ow_townwalk.json` (46) and
`tools/mutants/audit_owrevisited_walk.json` (35: 34 dead, one recorded equivalent).

### IC-PACE - the Imperial City's streets at sixty (2026-10-26, the owner)

The owner, on the tamriel branch: *"For the Imperial City specifically, the travel speed should be 60x instead of 5"*.
TS5 made the Imperial City forty-nine pixels (5.7 km across, `03-World/Town-Shapes.md` TS5), and IC-GRAND 625 (20.48
km, `03-World/Arena-Provinces.md`), all of it a town's streets, and OW-TOWN-WALK held every journey and the keys' travel
there to x5 - at forty-nine pixels already a quarter of an hour of real time to cross it. Its streets are still walked as a town's (the way, the gates, the steering); only the clock's ceiling is the
city's own:
- **The ceiling** (`systems/travel/townWalk.js` IMPERIAL_PACE_MAX, 60 - the dials' own top on a road).
- **The town's pace** (`scenes/townWalkHost.js` paceAt): the Imperial City's on every one of its slices
  (`world/tamrielCapitals.js` capitalOnPixel), TOWN_PACE_MAX everywhere else - every other capital and town. `townPace`
  answers it (where it answered the town's key: null still out of a town's streets), and `townWay` carries it.
- **The journey** (`systems/travel/travelOptions.js` streetRun, `applyRate`, `wayPace`): a street run is walked at its
  own town's pace (a way that says none, TOWN_PACE_MAX); the forecast asks it the same.
- **The keys' travel** (`scenes/world.js` tvTownPace, where `tvInTown` was): the governor holds the clock to the pace the
  town answers, none out of a town.
Pinned: `test/systems/travel/icpace.test.js` (5; PIN MOVED at the merge of IC-GRAND: its 625 slices, the pixel past its
edge thirteen from its centre); `tools/mutants/icpace.json` (9, all dead). PINS MOVED: `ow_townwalk`
(the host's wiring), `audit_owrevisited_walk` (`townPace` answers the pace), and the governor's mounts (`ow6_slowdown`,
`ow_lead`, `ow_loadowed`, `ow_queueowed`, `ow_toggle`, `tv_wasd`, `fb0929d_toroads`: `tvTownPace` for `tvInTown` and
TOWN_PACE_MAX); `ow_townwalk.json` and `audit_owrevisited_walk.json` re-aimed by content, all dead.

IC-STUTTER (2026-10-27, the owner: *"Traveling in the Imperial City at x60 presents really bad stuttering"*;
`03-World/Arena-Provinces.md` IC-STUTTER, where the whole fix is recorded): at x60 a journey crosses a slice every two or
three seconds, and its way through each slice (`scenes/townWalkHost.js` townWay: the slice's pieces flooded and up to six
searches of its 512 by 512 grid) was one task of 12-215 ms on this machine. The way is searched a few thousand cells a
step now (`systems/travel/townWalk.js` townWayCellsSteps, on a scratch of its own), the host walking WAY_STEPS_AN_ASK
steps an ask and answering `pending` until it is found; the journey asks again every frame (`systems/travel/
travelOptions.js` streetWait) and walks its leg meanwhile, then its streets - the pace, the way and the gates as before.
The pieces themselves are flooded by the slice's build before it stands (componentsSteps), so the traveller's pace asks
none.

## OW-HORIZON - as far as the eye can see, from the air (2026-10-20, the owner)

The owner: "the overworld map as it stands doesnt allow you to see as far as the eye can see, this needs to change
without impacting performance". Measured over the real ARENA2 (Daggerfall, 13:00, clear): from the Overworld's eye
every league past the fourth kilometre was one pale wash, and the camera would not look up past 30 degrees down.

**Why the view stopped short - three laws, each right for the eye it was made for** (`scenes/travelHorizon.js` header):
- **The haze.** DFU's sunny and overcast rows are a LINEAR fog, 0 to 2,400 m - the edge of its draw distance, tuned for
  TerrainDistance 3 (EV4 grew it to 2,400 x TD/3: 4,000 m at the default Land View). TV1 measured it from the traveller
  (the weather is the traveller's), so it closed about 100 m inside the streamed grid, and the far ring past it (EV8)
  stood at its 85% haze hold. Right at the eye, where the grid's edge is the horizon; from 260-450 m up, a wall.
- **The lens.** The world is drawn through a 6,000 m far plane. From a raised eye standing back from the traveller the
  grid's far corners lie past it - hidden only because the haze had already closed.
- **The tilt.** The camera stopped at 30 degrees down, so as not to show that wall (TV1's own reason).

**The law - the haze is the horizon's under the view.** `horizonFog(row, view)`: under the view, and only for a LINEAR
row, the fog's end runs out to TV_HAZE_END - the far ring's nearest rim (`render/farRing.js` RING_RIM_END, 28,016.64 m),
where the ring already closes its land into the sky. So the streamed land, the far ring and the sea past it fog by ONE
ramp from the traveller to the horizon (`render/horizonHaze.js` horizonHaze, FAR-SEA1's law, which the streamed sea
already takes). `horizonPlanes` / `horizonProj`: the lens's far plane grows to TV_LENS_FAR (12,000 m: the grid's
farthest corner at the widest Land View is 8,110 m from the traveller, the eye at most 1,739 m back from them at the new
floor) and its near plane to TV_LENS_NEAR (2 m: the eye keeps 25 m over its ground, so nothing stands nearer but the
rain wrapped round it - the depth step 8 km out is 1.9 m, against 4.8 m at 4 km through the eye's 0.2). All of it eases
with the view's rise and fall (`viewShare`, the eye's own smoothstep of its blend), so nothing pops as the camera
leaves the head or comes back to it. The host (`scenes/world.js`) takes the row and the lens through them - the lens now
after the view's frame, which says how far up the view stands.

**The camera** (`player/travelCamera.js`). TV_TILT_MIN is 15 degrees: at 15 and DFU's 65-degree lens the horizon stands
about a third of the way down the picture, the traveller still at its centre. Looking out that low, the line of sight
from the eye to the traveller is 1.7 km long and skims the land, so the clearance (TV1 / AUDIT DEEP T1-4) asks its far
half - from its middle to the eye - every TV_CLEAR_SPAN (100 m, `clearSteps`) where it asked the middle and the eye
alone: a hill three quarters of the way back stood between the eye and the traveller with the middle clear. The near
half is still not asked (a point a share s along rises s for every metre the eye does - a crest at the traveller's feet
is no lift's to clear; asking it steepened the default view on 93 of 403 rolling-hill samples, the far half alone on
none, and a cliff's lift is the same).

**The clouds' shadows past their square** (`render/cloudShadow.js`). The clouds' map is a 13.1 km square on the
traveller's pixel; TV4 measured every shadow in the view inside it - true while the haze closed at 4.8 km. Past it every
program now takes the far law, `uCloudShadowFar` (the deck's `far`: `scenes/shared.js` farCoverSun, the far ring's own
cover law, cover^1.6 - the same number its dim always was), and inside the square's rim (CLOUD_SHADOW_RIM, from 80% of
its half-side, 5.24 km) the map eases into it, so a cloud's shadow never ends on a straight line. A program never told
(the air's shafts, the grass about the eye) reads (0, 0): full sun past the square and the map to its edge, as before.
The renderer tells every program that lights by the sun (the terrain, the meshes, the characters, the flats, the
decals, the ground's snow, the water).

**The far ring - hazed from the traveller, shaded by the clouds, standing where the grid is not yet**
(`render/farRing.js`, `render/enhancedLighting.js` EL_FAR_RING_FS):
- Its haze is measured from the point the world's fog is (`uHazeFrom`: the renderer's focus while the view is up, the
  eye otherwise), so the ring and the land beside it read one distance.
- It takes the clouds' map where the map knows the ground and the far law past it (`RING_CLOUD_GLSL`, `ringSun`) - its
  sea too (`ringSea`'s sun scale). It had one flat dim, a dappled grid against a flat ring, hidden only by the haze.
- Its hole is the BUILT pixels' (`inHole`, `footprintBuilt`): a pixel the stream still owes is the ring's until its own
  ground stands - drawn at the far plane, so its coarse cell shows only through the gap, where the sky showed before.
  The hole is punched again when the built set's keys change (`BuiltPixels`, the host's `built`: a Map counting a key
  added or removed - its size alone stood still when one pixel dropped and another landed between two frames).

**The click reaches the land the view shows** (`horizonHit`, TV_PICK_REACH = TV_HAZE_END): a ground pick out to the
haze's end over `tvGroundAt(x, z, false)` - the built grid's ground and the far ring's heights past it, the sea's own
surface left to the curtains - where it reached the lens's old 6,000 m over the built grid alone, so a click on a
distant field said "beyond what you can see". The click and the waypoint menu's.

**What is not changed.** An EXPONENTIAL row is weather - rain, snow, fog, a sandstorm - and stays the traveller's,
exactly as TV1 measured it (the ring stands down under it, as ever). On the ground every function in
`travelHorizon.js` hands back what it was given - the same row object, the same 0.2 / 6,000 lens - and the fog closes
at most 4,800 m out, inside the square's rim, so the far law is never seen there. Two things change at the eye too, both
the same fix: the ring's nearest leagues inside the clouds' square take the map's shadow (under the ring's 85% hold),
and a pixel the stream still owes shows the ring's coarse ground instead of the sky.

**The cost.** Nothing new is drawn: the haze and the lens are numbers the frame already sends, the ring's pass (one
draw) was drawn under the view before, the far law is one uniform and one smoothstep in shaders that already read the
map, and the ring's fragment shader reads the map once. The camera's clearance asks at most ten points a pass where it
asked two. A hole re-punch is 0.38 ms on the CPU (measured, 400 punches) and comes once a pixel built or dropped -
beside a pixel's own build, which is tens of milliseconds.

A departure from TV1's haze (DFU has no raised camera; its own eye's fog is untouched): Port-Ledger row OW-HORIZON.
Proof: `test/render/owhorizon.test.js` (10: the haze, the lens, the camera's far half, the shadows' far law and its rim,
the ring's sun and haze, the ring's hole and its key, the click, the host's wiring), `tools/mutants/owhorizon.json`
(32, all dead); pins moved with their laws (TV_TILT_MIN 15 in `tv1_travel_view`, the lens line, TV4's shadow
arithmetic rewritten as the far law, every `_csLoc` a triple - `blood1_decals`, `el1_enhancedlighting`, `el4_frame`,
`enhancedSky`, `grasslit2`, `vc7b_shafts`, `volumetricClouds`, `water`, `dwf_audit`, `weatherfront`, `tv2_click_to_move`,
`farring`, `audit_farsea1`, `farsea1`).

## OW-HITCH - the Overworld's hitches (2026-10-21, the owner)

The owner: "Theres still a lot of hitching in the overworld. Can you please fix this properly". An Overworld journey in
the real game (W held at x60 from Knightstale, the freeware ARENA2) was profiled frame by frame, and what froze its frames
was taken out - the grass freeing every cell the journey left behind in the frame the view came down, the collector's
pauses (the grass's and the snowpack's garbage), the blood sheet built in the first blow's frame, a ground set met at a
new climate built in one task, the Living World's towns-near book cleared inside one trip, the music's window walked
from the song's start. The record, the figures and the pins: `07-Rendering/Performance-Priority.md` OW-HITCH.

**The four hosts.** `scenes/world.js` wired - it alone streams pixels, raises the Overworld and holds the grass, the
snow and the ground sets (`scenes/groundSets.js`, its module). `scenes/exterior.js` (the fixed city) builds its one
ground set once at its boot, through the renderer's `uploadTileArray` and the marks' whole-run names, which answer as
before; `scenes/worldModes.js` and `scenes/dungeonContext.js` stream no ground and raise no Overworld. The blood sheet's
prewarm and the music's window are every host's alike.

## LONG-VOYAGE - a voyage past the Bay, by the sea lanes (2026-10-24, START2)

`06-Systems/Alternate-Starts-Arc.md` section 10: a province's start sends its player to Daggerfall by ship (PASSAGE's
writ, `03-World/Passage.md`), and the planner (`systems/travel/travelRoute.js` planRoute) searches a box that never
leaves the map and its two ends (TV-BEYOND's bounds). A port past the Bay lies round a province from the Bay's -
Winterhold round all of High Rock, Vivec through the Inner Sea's narrows and the Sea of Ghosts - so measured on the
freeware's trace at its fit, nineteen of TESA12's twenty-eight ports had no water way to Daggerfall inside the box, and
the whole map's rung searched every cell of it to say so. (AUDIT STARTS P14: Solitude, the example this page first gave,
is one of the nine the box does route - in some 8 seconds.)

**The lanes** (`planSeaLanes`). A crossing from a helm (`sea.start` 'sea') with an end past the Bay's table sails them
first - a booked voyage's and a boat of the player's own alike (AUDIT STARTS V6: the box's ladder took 2 to 17 seconds
to sail one the lanes sail in a fifth of one); a traveller ashore with a boat to hand never. A lane the first box holds
none of is asked once more over LANE_MARGIN_WIDE (2,400 pixels - V5: north to south round a province, Solitude's to
Haven's west of Hammerfell and Sumurset); a booked voyage the lanes cannot sail is no voyage, said at once (V4: the box
never sails round a province, and its whole map's rung froze the page for seconds before it said so), where a boat of
the player's own still asks the box. From her helm:

- **the ends flooded** over the water a boat sails (never through a corner of the land - the search's own step law), out
  to LANE_END_REACH (256 pixels) about each: from her pixel, and from the water within VOYAGE_LANDFALL_PX of her port -
  a harbor's channel, a lake's mouth, an inner sea's narrows reached by the floods themselves;
- **A* over the lanes' grid**: cells of LANE_CELL (8 pixels), open water where the middle pixel is, two joined where the
  straight run of pixels between their middles is sailed water; the ends' box grown LANE_MARGIN (960 pixels - High
  Rock's north coast and the Inner Sea's mouth lie past 480 of their ports); leaning on its goal by LANE_GREED (1.5: a
  lane at most that much longer than the shortest, for a search that does not flood an ocean to prove it); a cell's
  water and joins kept a ground in tiles (the ground is the world's, fixed for the session);
- **the route**: the first flood's way into the lane, the lane's straight runs, the second flood's way out to the water
  by her port, and the landfall the box planner's own (`voyage`: ashore within VOYAGE_LANDFALL_PX of the port). Every
  step sailed is one the box planner sails; the kinds are the planner's (`sea`, then `landfall` and the walk ashore).
- **ashore** (AUDIT STARTS V4): at the port's own pixel or, where the trace's coast stands it on water (Lillandril,
  Firsthold, Skywatch, Woodhearth: every neighbour water too, so no landfall can end on it), the nearest dry ground
  within VOYAGE_LANDFALL_PX of it. The landfall's box reaches VOYAGE_LANDFALL_PX x 2 past an end beyond the table
  (`planRoute` `endPad`): TV-BEYOND's bounds stopped at the port's own row and column, and Winterhold's shore lies north
  and east of it. The shore is the one the lane's last cell leads to: the audit had also tried every other water about
  the port, and measured on the freeware no voyage either way ever needed one, so it went.

**Measured** on the freeware (`test/systems/starts/start2_provinces.test.js`, `auditstarts.test.js`): from the open
water by every one of the twenty-eight ports past the Bay, a voyage to Daggerfall - Solitude 1,757 pixels of sea (some
1,440 km), Vivec 3,492, Lilmoth 4,068 - and from Daggerfall's harbor a voyage to every one of them, from each of the 22
water pixels within 4 of the city. A plan takes 0.15 to 0.95 seconds on a cold ground (the slowest Senchal's and Archon's from
Daggerfall); the pins hold every plan under a second and a half. AUDIT STARTS V4: before the landfall's fix six ports
were no voyage at all from Daggerfall (Winterhold, Lillandril, Firsthold, Skywatch, Woodhearth, Archon), each refusal a
freeze of 3 to 13 seconds; and the first cut of the fix, which tried every water about the port at its own pixel before
dry ground, took 4 to 5.6 seconds a plan at the three Sumurset ports on water. The water within 3 pixels of a port is sometimes a
pond of the trace's coast, one to three pixels (by Northpoint, Gilane, Solitude, Dawnstar, Necrom, Alinor, Shimmerene,
Skywatch and Southpoint): no voyage leaves one and no ship berths in one (P14: Rihad's first water, which this page called
a pond, is its harbor's sea).

**The four hosts.** No host changed: the world host's journey asks `planRoute` as before (`travelViewRouteTo`, its
`tvSeaAsk`), and the lanes are the planner's. `scenes/exterior.js` sails nowhere; `scenes/worldModes.js` and
`scenes/dungeonContext.js` stand no sea. Ledger A (START2).

**Taut (SEA-TAUT, `01-Overview/bugs/Field-Bugs-2026-10-29g.md`; a player: "it takes forever to get to the fights that
aren't near to the shore").** The ends' floods went breadth first, a diagonal step counted as one, so open water due
east sailed as a "Λ": forty voyages past the Bay sailed a median 1.173 of the straight line, p90 1.364, max 1.403 (the
planner at main's 043338ef6). The floods now count a step's own length (buckets a pixel wide, exact here), and the
sailed stretch is pulled taut (`seaTaut`) over open water - each pixel of a run water and all eight about it, since a
run past a land pixel's corner can go ashore between the middles (SEA-SQUARE). A coast keeps the route's own steps. A
sailed step is a straight run now, as a FREE walk's is. After: median 1.001, p90 1.004, max 1.039. Pinned by
`test/systems/travel/fb1029g_seataut.test.js`.

**The pull in slices (SEA-TAUT; AUDIT FB1029g F2).** The pull ran as one block, its water in a string-keyed map and
none of it in the plan's tally: on ten of twelve long voyages the last slice held the frame 67 to 147 ms (warm, the
least of three runs). It is a generator now (`seaTautSteps`): each pixel a line asks is one cell of the tally, a
yield comes between two lines once PLAN_YIELD_CELLS are asked, and the water and the open ground are typed arrays over
the route's box. The same voyages' last slice takes 5 to 30 ms, and their longest slice anywhere 54 ms (the floods' and
the lanes' own). The pull's cells are the plan's: a long voyage plans in a slice or two more (Solitude to Elden Root
27 slices, 26 before). Pinned by the same file; mutants `tools/mutants/audit_fb1029g_sea.json` (AFB-SEA-F2).

## VOYAGER2.1 - the roads past the Bay walked as roads (2026-10-26, KPbICA's spec, forwarded by the owner)

KPbICA: *"Roads at current state does not behave like roads for Pathfinding system in Overworld view"*. Measured first:
past the Bay's table every step of `planRoute`'s search was `open` (3.5 a step, ROUTE_COST) - TV-BEYOND's step read no
road's byte there, rightly, since the Bay's arrays end at the table - so a click to a town past the Bay walked the field
straight across beside the road TESA14 had built, and a road's crossing onto the Bay (TESA5's join) was open ground
from the Bay's edge.

- **The law** (`systems/travel/travelRoute.js`): `routeGround` carries the reader of the installed layer of the roads past
  the Bay (`travelRoute.js:"get pathsBeyond()"`
  - `world/arenaRoads.js` arenaRoadByte, none while no layer is installed, so a plan with no roads past the Bay reads
  nothing), and `planRoute` hands it to the search only when it walks roads (`travelRoute.js:"const beyond = roads"`
  - FREE mode, which hands no road, reads none). A step past the table, or within JOIN_DEPTH of its edge where a
  crossing's join carries a Bay road out, asks the layer (`stepKind`'s beyondKind: the road's bit out of the one pixel and
  its back bit into the other, the Bay's own byte ORed with its join on the table): a road's step 1, a track's 1.6, as on
  the Bay. The legs fold a road past the Bay as one run (`routeLegs`, unchanged).
- **The host** grows no line: `scenes/world.js`'s `tvRouteGround()` is already spread into every Overworld plan. The
  living world's trips past the Bay walk the same layer through their own planner's window (`03-World/World-Wide.md`
  WW7-7, `systems/livingWorld/beyondWays.js`).
- **The four hosts**: `scenes/world.js` as above; `scenes/exterior.js`, `scenes/worldModes.js` and
  `scenes/dungeonContext.js` plan no Overworld route.
- **Measured** (the pins' grids): a town past the Bay reached by the road round, not the field across; a plan along a
  road past the Bay priced a road's (where it walked the open ground beside it at three and a half times it); the
  crossing, the Bay's road to its edge and its join past it, walked as one road.
- **OPEN** (closed by ROAD-FOLLOW, below - the walk and the line on the painted curves): the walk aims pixel middle to
  pixel middle (OW-ROAD-TRUE's lane), and past the Bay a road is drawn as a curve (`03-World/Roads.md` VOYAGER2), so on
  a bend the walker cuts up to 0.125 of a pixel inside it; the curve's apex is `roadCurves.js` curveApex, not wired into
  the lane.
- Pins `test/systems/travel/voyager21_beyond.test.js` (5); mutants `tools/mutants/voyager.json` (VOYAGER2.1's). PIN
  MOVED: none; TV-BEYOND's road-byte record re-aimed by content (`tools/mutants/fb1009_beyond.json`).

## ROAD-BEYOND - a journey past the Bay planned by its roads, in a bounded spend (2026-10-26, the owner)

The owner: *"road travel in the overworld needs to work properly outside of tamriel for overworld travel. I dont think it
works currently"* - everywhere in Tamriel past the Iliac Bay's table, and the Bay still as it was.

**Measured first**, through the host's own wiring: `routeGround` built as `scenes/world.js` tvRouteGround builds it (the
climate, the composed ground's heights, WATER_BYTE, its `beyond` from tvWater), Hazelnut's arrays in ROADS mode, the
places past the Bay where `world/arenaPlaces.js` stands them, and the roads past the Bay laid region by region as
`scenes/tamrielRoadsHost.js` lays them (all 48 regions, the regions' worker state driven in-process). Two faults, and
their cost:

- **THE BOX STOPPED AT AN END PAST THE TABLE.** `planRoute`'s bounds (TV-BEYOND) are the map and the two ends, so past the
  table no rung reached beyond the farther end's own row and column. The Imperial City's ground is closed by Lake Rumare
  to its north, east and west, and its way out runs south of its own row: the Imperial City to Bruma, to Chorrol, to
  Cheydinhal and to Mournhold were **no way** (a breadth-first walk of the same ground joins them).
- **THE LADDER FLOODED THE FIELD.** Its A* prices the heuristic at a road's step (1) and the field at 3.5, so a long plan
  past the Bay expanded every field near its line - capped at 200,000 cells a rung (the whole map's rung never is on the
  Bay; past it no rung is the whole map) and four rungs over. Plans of 300 to 1,400 pixels took **1 to 24 seconds**, and
  Kvatch to Leyawiin, Skingrad to Riften were **no way** after 20 and 24 seconds - their routes past the spend.

**What holds now** (`systems/travel/travelRoute.js`; a plan with both ends on the table is the Bay's, unchanged):

- **The roads first** (`searchByRoad`). A plan with an end past the table, handed the roads (ROADS mode, the layer
  installed - VOYAGER2.1's `beyond`) and walking the land (no boat, or one to hand with a goal ashore), searches the roads
  and tracks alone - the Bay's arrays on the table, the layer past it, stepKind's law and TV2's prices (a road 1, a track
  1.6) - with the open ground (3.5) walked only about its two ends: BY_ROAD_REACH (24 pixels), or out past the nearest
  road or track to an end in the wilds (within BY_ROAD_SEEK, 96). (ROAD-FOLLOW, below, retired BY_ROAD_REACH: a way by
  the roads cut a field's corner anywhere within it - each end's own leg and a gap's crossing now.) Its cells are kept by pixel (no table's edge), a step
  away from the ends leaves by a road's or a track's edge (no other neighbour is asked), it leans on its goal by
  BY_ROAD_GREED (1.25: a way at most a quarter dearer than the roads' cheapest), and it gives up after
  BY_ROAD_MAX_EXPANSIONS cells (100,000). **TV2's law kept**: a way by the roads dearer than the straight walk across
  the field (`ROUTE_COST.open` a step) is asked of the ladder too, and the cheaper kept. (ROAD-FOLLOW, below, retired
  it: a way by the roads is kept, the ladder asked only where none joins the two.)
- **The ladder past the table** (no way by the roads, FREE, a crossing): its box reaches `margin` past an end beyond the
  table (`reachOf` - the Imperial City walks out south of its lake), no rung wider than BEYOND_MARGIN (240 pixels: the
  whole map's rung there allotted a box of millions of cells for a spend that walks a hundred thousand), its whole spend
  BEYOND_MAX_EXPANSIONS cells (100,000) over every rung, and a plan with no road, track or boat in it leans on the
  field's own price (`hCost` 3.5: the straight walk, a few cells a pixel). A plan by the roads that neither found walks
  across country (the FREE plan's own) - never "no way" for a field the spend did not reach. So a plan past the Bay
  expands at most 100,000 + 2 x 100,000 cells, an op count the pins hold (`tally`), never a clock.
- `routeGround`'s keep of the ground past the table is keyed by number (`beyondKey`) and holds 2^18 answers.

**The journeys** (the merged head's ground and places, the layer as the 48 regions lay it; one machine, four cores
shared with other builds - load average about 25, so every time here is several times an idle machine's; under it
AUDIT STARTS V4/V7's timing pin (a voyage planned in under a second and a half) fails before this change and after it -
its slowest voyage 3.2 s on the head's planner, 2.4 s on this one; START2's three seconds passes run alone):

| from | to | before: way, road share, time | after: way, road share, cells, time |
| --- | --- | --- | --- |
| Daggerfall | Wayrest (the Bay) | 767 px, 100%, 1.5 s | the same plan, 1.3 s |
| Daggerfall | Elinhir (the Bay to Hammerfell past it) | 1,442 px, 99%, 3.3 s | 1,943 px, 100%, 55,600 cells, 1.1 s |
| Sentinel | Kvatch (the Bay to Cyrodiil) | 1,707 px, 98%, 19.6 s | 1,871 px, 100%, 38,600 cells, 0.9 s |
| Imperial City | Bruma | **no way**, 1.0 s | 511 px, 97%, 4,800 cells, 0.07 s |
| Imperial City | Kvatch | 441 px, 97%, 1.6 s | 441 px, 97%, 1,900 cells, 0.13 s |
| Kvatch | Leyawiin | **no way**, 20.3 s | 1,225 px, 100%, 25,700 cells, 0.64 s |
| Bruma | Leyawiin | 1,058 px, 100%, 17.0 s | 1,067 px, 100%, 1,700 cells, 0.02 s |
| Whiterun | Riften (Skyrim) | 665 px, 97%, 8.4 s | 757 px, 100%, 18,400 cells, 0.40 s |
| Solitude | Whiterun | 474 px, 93%, 3.4 s | 580 px, 100%, 4,900 cells, 0.06 s |
| Mournhold | Tear (Morrowind) | 446 px, 95%, 4.7 s | 498 px, 98%, 8,600 cells, 0.14 s |
| Ald'ruhn | Vivec (Vvardenfell) | 229 px, 90%, 1.0 s | 232 px, 99%, 1,600 cells, 0.03 s |
| Dragonstar | Elinhir (Hammerfell) | 457 px, 99%, 4.7 s | 633 px, 100%, 3,800 cells, 0.07 s |
| Rimmen | Senchal (Elsweyr) | 630 px, 97%, 4.5 s | 711 px, 100%, 12,700 cells, 0.30 s |
| Stormhold | Gideon (Black Marsh) | 461 px, 96%, 5.8 s | 503 px, 99%, 6,200 cells, 0.14 s |
| Silvenar | Elden Root (Valenwood) | 491 px, 99%, 5.9 s | 527 px, 98%, 10,900 cells, 0.36 s |
| Alinor | Cloudrest (Summerset) | 487 px, 94%, 8.7 s | 578 px, 98%, 9,500 cells, 0.43 s |
| Skingrad | Riften (Cyrodiil to Skyrim) | **no way**, 24.4 s | 1,110 px, 100%, 24,500 cells, 0.68 s |
| Imperial City | Mournhold (Cyrodiil to Morrowind) | **no way**, 0.16 s | 1,550 px, 98%, 45,900 cells, 1.6 s |
| Elinhir | Kvatch (Hammerfell to Cyrodiil) | 630 px, 97%, 9.4 s | 725 px, 100%, 11,100 cells, 0.34 s |
| the wild (2200, 800) | Imperial City | 205 px, 87%, 1.0 s | 207 px, 88%, 4,500 cells, 0.35 s |
| the wild (1700, 400) | Chorrol | 233 px, 97%, 1.3 s | 293 px, 100%, 4,800 cells, 0.29 s |
| Mournhold | Ebonheart (Vvardenfell, over the Inner Sea) | no way, 4.4 s | no way, 200,000 cells, 3.7 s |

**The walk**: a plan's legs (`routeLegs`) walked by the real Travel Options (`createTravelOptions`, its autopilot, a body
flown along each frame's drive - `audit_owrevisited_walk.test.js`'s rig): the Imperial City to Bruma (109 legs) and
Dragonstar to Elinhir (87) arrived at their places, never more than a pixel off the planned route's pixels. Nothing in
the walk asks the Bay's table.

- **The four hosts**: none grows - `scenes/world.js`'s journeys ask `planRoute` with `...tvRouteGround()` as before;
  `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` plan no Overworld route. Nothing crosses
  the wire: a route is each player's own plan (the party walks its leader's - TV8 - as before).
- **The departure, named**: DFU has no Overworld and no planner (Travel Options' follow walks Hazelnut's bytes); TV2 is
  our own. Past the Bay a journey by the roads is the roads' way within a quarter of their cheapest, where TV2's ladder
  is the cheapest of all - so a gap in the roads far from both ends is walked round by the roads, not stepped across the
  field: Dragonstar to Elinhir is 633 pixels by the road (cost 720) where the old plan stepped five pixels across a gap
  in the road there (457, cost 543), Daggerfall to Elinhir 2,284 where it was 1,781. Within the same law's limit (the
  roads' way dearer than the straight walk across the field) the ladder is asked and the cheaper kept.
- **OPEN**: a refusal past the Bay (an island with no boat to hand: Mournhold to Ebonheart) spends the whole 300,000
  cells before it says so, a few seconds on a loaded machine - a land's pieces past the Bay (`apart`'s, the Bay's alone
  today) would say it at once. And the roads' search does not bridge a gap in the roads past the Bay; the regions'
  roads that leave one (Hammerfell's at (1154, 233)) are the roads' build's to join (`03-World/Roads.md`).
- Pins `test/systems/travel/road_beyond.test.js` (10, the last with ARENA2: the Imperial City to Bruma and Bruma to
  Leyawiin on the freeware's own ground); mutants `tools/mutants/road_beyond.json` (13, all dead). PIN MOVED: none;
  no record displaced (`mutantdrift`).

## FAST-REFUSAL - no way by land past the Bay said at once (2026-10-26, the owner: "Take care of exclusions and gaps")

ROAD-BEYOND bounded a plan past the Bay by a count of cells; a refusal spent all of it (300,000 cells, 1 to 4 seconds on a
loaded machine) before it said "no way". The Bay's own refusals are its land's pieces (`routeGround` `apart`, AUDIT OW4
J3); past the table there were none.

- **The pieces** (`systems/travel/landPieces.js` apartPastBay). The land past the Bay is the trace's smooth law
  (`world/tamriel/tamrielLand.js` landLaw): a point is land only in a square of the picture's centres with a land
  centre at a corner (a square of four sea centres is the sea whole). Two neighbouring pixels stand in one square or in
  two that touch, so their squares' land centres lie within PIECE_REACH (2) centres of each other: the trace's land
  centres joined to every one within two are pieces no way on land crosses between. The Bay's own ground, its seam and
  its blend (`tamrielGround.js` SEAM_PX, BLEND_PX) are one piece with every centre within BAY_PAD (3) of the Bay's
  rectangle - the Bay's land is Daggerfall's, not the trace's. Made once a land (the trace's object and the fit's
  numbers), 64,000 centres and a dozen joins each - milliseconds; every ask after it is a lookup. An end whose square
  holds no land centre (the sea, an isle the trace does not draw) is in no piece known here and is never refused.
- **The plan** (`planRoute`): an end past the table, no boat in the search (THE MERGE: a crossing is none of the land's
  pieces), the host's ground handing its pieces (`apart`) - two ends in pieces that share none is `null` before a cell
  is expanded. Alinor to the Imperial City: refused in a millisecond, where it spent the whole count.
- **CLOSED by EXACT-PIECES (below)**: a split finer than the trace's grid is not a piece here. Mournhold to Ebonheart is one: Ebonheart's ground
  (some 200,000 pixels and more) is cut from the mainland's (4,000,000 flooded, Ebonheart never reached) by water
  narrower than two of the picture's centres, so the trace joins them and the plan still spends its count (1.8 s, load
  average 25) before it refuses. Exact pieces need the ground's own pixels labelled - the roads' regions read every
  pixel of the land as they are laid (`world/tamrielRoads.js`), the place to label them. The coordinator's other way -
  the plan's search run in slices across frames (a per-frame count of cells, the view saying it is planning until the
  plan lands, the plan the same as the one call's) - needs the hosts' journeys to wait on a plan, and was not built in
  the day: a refusal of this kind is 200,000 cells, 1.8 to 3.7 seconds measured at load averages of 20 to 40 on four
  shared cores (no idle machine was to be had to measure it unloaded). CLOSED by PLAN-SLICES (below): the plan is made
  a slice of cells a frame.
- The four hosts: none changes. Pins `test/systems/travel/fast_refusal.test.js` (4, the last with ARENA2); mutants
  `tools/mutants/fast_refusal.json` (6, all dead).

## EXACT-PIECES - the land's pieces at the pixel, so every water-cut pair is refused at once (2026-10-26, the owner: "No band aids")

FAST-REFUSAL's OPEN, closed: its pieces are the trace's, and a strait narrower than two of the picture's centres is one
piece there. Mournhold to Ebonheart is one such pair - labelled whole on the freeware (the frame's 4,960 x 3,100 pixels by
the planner's own water law, 31 pieces), Mournhold stands on the mainland's and Ebonheart on another - and the plan spent
its whole count (200,000 cells) before it said "no way".

- **The law** (`world/tamrielLandPieces.js` labelLand): the planner refuses a step onto water and a diagonal between two
  waters, so a diagonal with a dry pixel beside it is two steps through that pixel - two dry pixels are one piece where
  dry pixels side by side (FOUR-connected) join them. A region's core labelled so, its rows as runs (a few thousand runs a
  region where there are 240,000 pixels), and its RING - whether each pixel just outside the core is dry.
- **Where** (`world/tamrielRoads.js` regionLand, tamrielRegionSteps): the roads' regions read every pixel of their grids as
  they are laid, so each labels its core off the bytes it has just read (the Bay's own pixels read there too, the Bay's
  byte its water law as the planner's is) and its answer and its cache entry carry the labels beside its layer
  (`world/tamrielRoadsWorker.js`, `world/tamrielRoadsClient.js`). The build now lays every region whose core meets the
  Bay's table as well as every one with land past it (`regionWanted`: the Bay's west and its middle are labelled; their
  roads are the Bay's network's, none laid there). TAMRIEL_ROADS_VERSION 7 - the same release's one rebuild.
- **The joins** (`systems/travel/landPieces.js` resetExactPieces, addExactPieces, apartExact, handed by
  `scenes/tamrielRoadsHost.js` as each region lands): a region's pieces joined to its landed neighbours' where a dry pixel
  of one stands beside a dry pixel of the other across their edge; a dry pixel of its edge beside a dry ring pixel in a
  core the build lays nothing in (the sea as the build sees it), or past the lattice, joined to the one UNKNOWN piece,
  which is never told apart from anything. The answer is the union's, whatever order the regions land in.
- **The refusal** (`planRoute`): once every region of the build has landed with its labels, an end past the table, no
  boat, the host's ground handing its pieces - two ends whose pieces share none (an end on the water stands on its dry
  neighbours' pieces; an end in no landed region is never refused) is `null` before a cell is expanded. On the freeware:
  Mournhold to Ebonheart refused with no cell expanded (where it spent 200,000); Mournhold to Vivec, the Imperial City to
  Bruma and Daggerfall to Kvatch not; Alinor to the Imperial City and Daggerfall to Alinor apart (FAST-REFUSAL's too).
  Until the build has landed whole, FAST-REFUSAL's trace pieces answer what they can.
- The four hosts: none changes (the roads host is wired by the places host, `scenes/tamrielPlacesHost.js`, as before).
  Nothing crosses the wire.
- Pins `test/systems/travel/exact_pieces.test.js` (4, the last with ARENA2 - every region the build lays, labelled as it
  labels them); mutants `tools/mutants/exact_pieces.json` (13, all dead). PIN MOVED (EXACT-PIECES): TAMRIEL_ROADS_VERSION
  6 -> 7 (`test/tesa14_roads.test.js`, `test/world/road/voyager1_land.test.js`, `test/world/road/river_fords.test.js`), a
  region's steps one more (the labelling's, `test/world/audittesa2r_roads.test.js` R8); VOYAGER1's version record and
  TESA15's two records on the worker's message and the cache's hit re-aimed by content (each dead).

## PLAN-SLICES - a journey's plan made a slice of cells a frame, never one long task (2026-10-26, the owner: "No band aids")

FAST-REFUSAL's other OPEN, closed: the planner ran as one call, and a plan that found no way, or a long one past the Bay,
spent its whole count inside one frame (a refusal past the Bay 200,000 cells; a voyage by the sea lanes up to 393,000;
the Bay's own FREE walk with no road, the whole map's rung - AUDIT OW5 J3 never cuts it short).

- **The planner a generator** (`systems/travel/travelRoute.js` planRouteSteps): planRoute's own body, and the box's
  search, the roads' search and the sea lanes (their two floods and their A*) inside it, yield every PLAN_YIELD_CELLS
  (1,024) cells; the floods and the lanes now count their cells in the plan's `tally` too. `planRoute`, `searchByRoad` and
  `planSeaLanes` are the same generators run to their end (`drainPlan`) - every caller that asks them is unchanged.
- **The slicer** (`systems/travel/planSlices.js`): the world host's two journeys (`scenes/world.js` travelViewRouteTo,
  travelViewWalkTo - each `return planJourney(() => { ... })`) run through it, and the host's `planRoute` is its own
  (`planRouteSliced`, imported under the planner's name). A
  plan asked inside a journey runs a slice of PLAN_FRAME_CELLS (20,000) cells at once: the Bay's short plans, and most
  past it, end inside that slice and the journey goes on in the same call as it always did. A plan its slice does not
  finish throws PLAN_PENDING out of the journey before any of it is done (the host's journeys ask their plans first),
  the journey answers "taken up", the Travel View's readout says `Planning the way...` (`scenes/travelView.js`, while
  `planning()`, through the text core: `travelView.planning`), and the plan goes on a slice a frame; when it lands the journey's function runs again from its start,
  each plan it had already asked answered at once (keyed by its goal and its ask - never its start, which a traveller
  still walking moves), and goes on. A journey begun while one is planning takes its place.
- **The same plan**: the slice's answer is the generator run to its end - planRoute's own. Measured on the freeware
  against the planner before the generators: Daggerfall to Wayrest, Daggerfall to Sentinel (FREE), the Imperial City to
  Bruma, Kvatch to Leyawiin, Whiterun to Riften, Mournhold to Ebonheart, Alinor to the Imperial City, Daggerfall to
  Elinhir, Ald'ruhn to Vivec (FREE) and Wayrest to Daggerfall with a boat to hand: ten of ten the same plan, pixel for
  pixel, and the same sliced (1 to 14 slices).
- **The wall clock's pins re-pinned by cells** (PIN MOVED, PLAN-SLICES): AUDIT STARTS V4/V7's "each planned in under a
  second and a half" and START2's "under three seconds" were wall-clock bounds - flakes on a shared runner (both failed
  at load averages of 20 to 40, the planner unchanged), and a plan is no longer one task. They hold each voyage's cells
  now: VOYAGE_CELLS_MAX 450,000 (measured 392,822 and 393,363 - some twenty slices).
- **The host**: bootWorld grows no line - OWS2's two asks of the planner (tvMooredDry, tvSeaAsk) moved out to
  `systems/travel/seaAsk.js` under the same names, and its ceiling lowered to the count measured on the merged head,
  35,888 (`test/scenes/hostceiling.test.js`). The four hosts: `scenes/world.js` as above; `scenes/exterior.js`,
  `scenes/worldModes.js` and `scenes/dungeonContext.js` plan no Overworld route. Nothing crosses the wire.
- **Not sliced**: a plan asked outside the two journeys (the living world's ways, the passage host's own checks) is the
  one call's, as before; a journey's "no way" said after its plans is said when they land.
- Pins `test/systems/travel/plan_slices.test.js` (7); mutants `tools/mutants/plan_slices.json` (10, all dead). PIN MOVED
  (PLAN-SLICES): the four harnesses that lift the host's journeys (`ow5_audit`, `fb0929d_toroads`, `tv6_dungeons`,
  `passagehost`) hand them the slicer and the two moved asks; AUDIT STARTS V5's and ROAD-BEYOND's records re-aimed by
  content.

## ROAD-GAPS - the roads past the Bay joined where they meet (2026-10-26, the owner: "Take care of exclusions and gaps")

ROAD-BEYOND's record left OPEN a gap in the roads past the Bay, Hammerfell's at (1154, 233): Dragonstar to Elinhir walked
633 pixels round by the roads where the head's planner had stepped five pixels across the field (457). Measured again:

- **That gap was the layer's, not the build's.** ROAD-BEYOND's journeys ran on the merged head's ground with a roads
  layer laid before SMOOTH-LAND moved the coasts (GROUND_ROLL_VERSION 3); at (1155, 232) - (1158, 236) that layer's road
  stands on what is now water (the ground's byte 0), and the planner never steps a road onto water. Laid again on the
  head's land (regions (2, 3) and (2, 4), as the host lays them), the road there is dry and whole: Dragonstar to Elinhir
  is 455 pixels, every step a road's. The stale layer stood 2,519 of its 747,052 path pixels on the new water; a player
  never sees one (the regions' key carries GROUND_ROLL_VERSION, so every region is laid again on the land it stands on).
- **The gaps that are the build's: where the Bay's roads meet the land past it** (`world/arenaRoads.js` arenaJoins,
  JOIN_SPACING). The Bay brings eighteen roads to its north, south and east edges (a road running along an edge one),
  and TESA5 stood seven crossings for them: a crossing took every road within JOIN_SPACING (60 pixels, 49 km) of the
  last along the edge, so the other eleven ended at the edge with the land going on past it, and a journey off the Bay
  walked the field from their ends to the next crossing's road. JOIN_SPACING is 12 now (10 km): fourteen crossings on
  the freeware's Bay - seven north, five south, two east - each a gate the regions' build routes to (TESA5's law
  unchanged: the road nearest the edge, its run out to the gate on land), 47 join pixels on the Bay where there were 19.

- **The gaps inside a region's own network** (`world/road/roadGaps.js` linkGaps, `world/tamrielRoads.js`
  tamrielRegionSteps). A region's build routes its places a route at a time, and some of what it lays stands as pieces
  no bit joins to the rest - on Hammerfell's two regions laid fresh, 339 pieces, 52 pairs of them (20 pixels and more
  each) within three pixels of each other: a village's tracks a pixel off the road they were meant for, two roads' ends
  side by side. The build now links them: the region's network as one graph by its bits, its pieces, and each path
  pixel of the region's core in reading order linked to the nearest pixel of another piece within LINK_GAP (3) whose
  straight way is dry land the build walks (no water it refuses, no pixel it routes round, no other path between) - a
  road where both ends are roads, else a track. Laid again: 173 pieces, 2 pairs within three pixels (the two regions'
  seam - each region links its own network alone, the same on every client whatever order the regions land in).

**Measured** on Hammerfell's (2, 3) and (2, 4), laid on the head's land as the host lays them, before the links and
after: Dragonstar to Elinhir 455 pixels by the road either way (3,100 cells), Grecher to Dragonstar 725 and Bourner to
Elinhir 456, every step a road's or a track's. A plan from the Bay into Hammerfell needs the regions past the Bay's east
edge laid too ((1, 3), (1, 4)); a build of the whole continent with the links and the fourteen crossings was not run
here (four builds at a load average near 40 took over three minutes a region) - ROAD-BEYOND's journeys stand on the 48
regions as laid before them.

- The four hosts: none changes (the crossings are the roads host's inputs, `scenes/tamrielRoadsHost.js`, as before).
  Nothing crosses the wire: each client lays its roads from its own files, the same for every player.
- TAMRIEL_ROADS_VERSION 6 (RIVER-FORDS moved it to 5 in this release; the links and the crossings change what a region
  lays): the roads past the Bay are laid again once - the same one rebuild as SMOOTH-LAND's GROUND_ROLL_VERSION 4.
- Pins `test/world/road/road_gaps.test.js` (2); mutants `tools/mutants/road_gaps.json` (8: 7 dead, 1 recorded
  equivalent - a path pixel on the way is itself a nearer candidate). PIN MOVED (ROAD-GAPS): `test/tesa5_join.test.js`
  JOIN_SPACING 60 -> 12, the synthetic edge's runs re-spaced, the freeware's fourteen crossings and 47 join pixels;
  TAMRIEL_ROADS_VERSION 5 -> 6 (`test/tesa14_roads.test.js`, `test/world/road/voyager1_land.test.js`,
  `test/world/road/river_fords.test.js`); TESA5's spacing record and VOYAGER1's version record re-aimed by content.

## MID-RING and FAR-FIELD - the horizon in layers, out to the mountains 300 km off (2026-10-26, the owner)

The owner: "we need to find a way to expand the overworld view distance without killing performance. Currently tiles
visibly load in with distance". And BREATHTAKER 1 of KPbICA's spec, through the owner: "render landscapes and landforms
way further than actual distance to load. To see the mountain from 300km for example by rendering it's simplified
version".

**What stood past the streamed grid.** The grid (Land View 5: 4.5 km round the traveller) and then the far ring alone
(EV8, `render/farRing.js`): a vertex a map pixel, 819 m apart, at the byte's macro height - the large heightmap's noise
and the ground's own left out - its land closed into the sky over 16.8-28.0 km (RING_RIM_START..RING_RIM_END). So a
pixel the stream built stood up out of a flat-faceted lowland as it landed, every hill at once (the owner's "tiles
visibly load in"), and nothing at all stood past 28 km.

**The layers, by distance** - each drawn in the far ring's one pass at the far plane (PERF2: after the ground; depth
tested, never written, so each shows only where everything nearer drew nothing), farthest first so a nearer layer is
painted over a farther one (`FarRingRenderer.draw`):

| layer | cells | reach | its ground |
|---|---|---|---|
| the streamed grid | 128 a pixel (6.4 m) | Land View (4.5 km at 5) | the pixel's whole build |
| THE MIDDLE RING (`render/midRing.js`) | 8 a pixel (102.4 m) | MID_RADIUS 14 pixels (11.9 km to its corner's edge) | the stream's own kernel at whole samples |
| the far ring (EV8) | 1 a pixel (819 m) | 48 pixels (39 km) | the byte's macro height (`ringHeight`) |
| THE FAR FIELD (`render/farField.js`) | 1 a FAR_CELL of 8 pixels (6.55 km) | FAR_RADIUS 60 cells (393 km) | a cell's highest byte, the far ring's law |

- **The middle ring** (`world/terrain/midRingGrid.js`, built on the terrain worker - never on the frame). Each vertex is
  the pixel's own kernel (`terrainSampler.js` sampleKernel: the small heightmap's bicubic, the large one's, the ground
  noise, the ocean's floor, and with the Landforms row the landforms' shaping) at a whole sample - the ground the stream
  will build there, coarse - so a pixel built lands on the hills already standing. A pixel's seam samples are its
  neighbour's first (the kernel's own seam law), read once. Its colour is the far ring's (overworldTint at the pixel
  centres, read bilinearly: the two rings one field of colour), its light, haze, sea and clouds' shadows the far ring's
  program. Where the stream has built a pixel the ring leaves it out by RUNS of its ordered index list (a built pixel
  cuts a run; the buffer is never rewritten for it), and the far ring is holed for the middle ring's whole footprint -
  the sea's fill inside the hole stays the streamed grid's (FAR-SEA1), since the middle ring has its own sea.
- **Its rim eases onto the far ring** - a geomorph in the rings' one vertex program (`aCoarse`, the far ring's surface
  under each middle-ring vertex through the far ring's own triangles; `uMorph`): over MID_MORPH_START..MID_MORPH_END
  (7.4-9.0 km, Chebyshev from the traveller - the haze's own point, `renderer.focus`) its ground slides onto the far
  ring's, so where the far ring takes over the two are one surface, and the band moves with the traveller, never with
  a rebuild (MID_MORPH_END is the rim the traveller's farthest drift from its base still leaves: MID_RADIUS -
  MID_REBUILD_DRIFT pixels).
- **The far field** (BREATHTAKER 1). The heightmap a cell at a time - FAR_SAMPLES (nine pixels a cell, the highest
  kept: a range's silhouette is its peaks', none lost to a 6.5 km average) off the heightmap's own reader,
  `woods.getHeightMapValue` (the Bay's bytes, the continent's authored ground past them, the Eltheric Ocean's - the reader
  every kernel reads), its height the far ring's own law (`ringHeightAt`, the landforms' lift with the row and the
  continent's past the Bay - BREATHTAKER2 below), its sea where
  more than half its samples are at the sea's floor or its centre is the ocean's climate. It reads the terrain's law
  and holds no copy of it: when the ground's generation changes (BREATHTAKER 2-3) the far field shows the change. A vertex
  a cell on the cell's own centre, world-fixed - a rebuild (every FAR_REBUILD_DRIFT cells, 13 km) adds cells at the rim,
  past the haze, and moves none. The far ring's footprint is left to it (`farFieldOrder`'s `covered`).
- **The haze runs on.** While the far field stands the rings' rim law closes over FAR_RIM_START..FAR_RIM_END (217-361
  km) instead of 16.8-28.0 km, and the rings' lens reaches FAR_LENS_FAR (600 km); the land holds the far ring's 85% haze
  (RING_HAZE_HOLD) all the way out, so a range is a pale silhouette, as distance makes it - a range 2 km high 300 km off
  stands some 0.4 degrees over the horizon (no curvature is drawn): a few pixels of the 65-degree lens, as it would be. Weather (an EXPONENTIAL row) stands every ring down, as ever.
- **Why geometry and not sprites.** The spec asks for "multilayered 2D sprite composition". The far field is that
  layered composition built as geometry: 14,641 vertices in one draw cost less than the impostor cards it would take to
  show the same ranges, and they stay still where a card does not (a card re-baked as the traveller moves shimmers;
  these vertices are world-fixed). The layers by distance are the table above.
- **A just-built pixel eases out of the ring's tint** (`render/pixelFade.js`, a leaf). The ring showed the pixel's shape
  in the far ring's tint a frame before its build, and the build laid the ground's own tiles over it at once: the shape
  held but the colour popped. A pixel published PIXEL_FADE_RING (2) or more from the traveller carries its arrival and
  its centre's tint (`scenes/pixelBuild.js`, enhanced lane, middle ring on), and both lanes' ground programs mix the tint
  over its tiles by a smoothstep share over PIXEL_FADE_MS (1.2 s) - a colour, never a discard, so the ground keeps its
  early depth test (GROUND-LAST). The renderer uploads the share only while it moves (`_terrainFade`).

**How the frame pays for it.** The heights, the far field's bytes and its cells' climates past the Bay are the terrain
worker's (`terrainGenWorker.js` 'midring', 'farfield'), asked a band at a time (HORIZON_BAND_ROWS: 4 pixel rows, 16 cell
rows; the next band posted as the last lands) so the stream's own pixel jobs run between bands, and kept by pixel and cell
across rebuilds (HORIZON_KEPT: 4,096 pixels and 32,768 cells, each book two of its grounds - one 8,192-entry book for
both let every far cell go before the next rebuild asked it again; let go whenever what they read moves). A far cell's
climate past the Bay is read there (`world/terrain/farClimate.js`) as the main thread's reader reads it (the continent's, `groundClimateIndex`; on the
Bay and in the Eltheric Ocean's box FAR_CLIMATE_ASK, the main thread's own map): measured on the freeware's ground, the
continent's first climate read works its biomes out in some 150 ms and a cold centre costs some 16 microseconds after,
so a first far field read on this thread ran a step of its build to 196 ms. One ask at a time per layer; the ask stands
until its ground is laid, and an answer for a base let go is dropped.

On this thread a landed ground's vertices are laid
a step at a time (the middle ring MID_ROWS_A_STEP 12 rows, its tints a row of 31 pixel centres; the far field
FAR_CELLS_A_STEP 32 cells, its normals FAR_NORMAL_ROWS 8 rows) under HORIZON_BUDGET_MS (2 ms a frame, one step at the
least), and the painter's order is written once a pixel (the middle ring) or a cell (the far field) the traveller
crosses. Measured in node on this shared four-core machine, loaded to 30 runnable threads (the figures rank; they are not
a player's): the far field's 474 steps on the freeware's ground with the worker's climates, 28-53 ms in all, p95 0.04-0.16
ms a step (its longest steps, 6-150 ms, the machine's preemption: they moved from run to run); a middle ring's vertices
64 ms in all; a middle ring's order 1.6-7.9 ms a pixel crossed, the far field's 2.2-2.5 ms a cell (its cells walked off
one list of offsets sorted once - sorting the cells each crossing was 16-30 ms); the runs 0.07 ms. On the worker a cold
far field is 0.3-1.7 s (the continent's authored ground some 6 microseconds a pixel, nine pixels a cell), 80-190 ms warm;
a cold middle ring 0.15-0.8 s of kernel without the landforms, a rebuild after three pixels' drift some 170 new pixels of
its 841. The GPU: the middle ring 54,289 vertices and 107,648 triangles in a handful of runs, the far field 14,641
vertices and some 28,500 triangles in one draw, their buffers 2.4 MB and 0.6 MB; their fragments only where nothing
nearer stands.

**The doors.** `?midring=off` and `?farfield=off` (read once as the ring is made) stand either layer down - the far ring
then holes and closes as before - and with no worker (`?terrainthread=off`, a dead one) neither is asked: the client
answers null, never computes them on this thread. `tools/horizonProbe.mjs` photographs one view with the layers and
with both doors shut (the A/B in one tree; the probes' read is `__horizonRings`, behind the shot gate - AUDIT ANTICHEAT
A2 - and let go with the ring).

**A city's skyline** (the Imperial City at some 20 km, stream A): the hook is FAR-LANDMARK, below.

A departure from Daggerfall Unity (its terrain ends at its TerrainDistance, its far view a flat fog; no layer past it):
Port-Ledger row MID-RING. Proof: `test/render/midring.test.js` (10: the heights against the kernel's own samples with
the landforms and without; the vertices' frame, tints, sea and their ease's ground; the painter's order and its runs;
the mesh; the far ring's asks, stepped laying, hole, ease and origins; the worker's bands and kept pixels, the client's
bands, its errors and the worker's death; the wiring; the pixel's ease out of the tint; the far field's vertices and
order; the far ring's far field, its rim, its lens and its drift; the worker's climates and the client's far bands; the
steps' sizes), `tools/mutants/midring.json` (88, all dead). PIN
MOVED: `test/ui/farring.test.js`, `test/render/el1_enhancedlighting.test.js`, `test/render/owhorizon.test.js` (the host's
line: the far ring handed the terrain's client), `test/render/boot2.test.js` (the boot's reach 86: `render/pixelFade.js`,
a leaf the renderer reads), `test/scenes/perfcol2.test.js` (the ocean holes' pits moved out of bootWorld for the room),
`test/world/terrain/terrainworker.test.js` (the worker's imports: the horizon's grounds, the landforms and a far cell's climate). The four hosts: `scenes/world.js` wires it (the far ring handed the terrain's client, one
logical line; HOST-SPLIT made the room - `01-Overview/Host-Split.md` MID-RING); `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` draw no far ring.

## BREATHTAKER2 ON THE HORIZON, THE RIVERS' WATER, FAR-LANDMARK (2026-10-26, the coordinator, after stream G's terrain)

The coordinator: "render/farRing.js ringHeight still ignores G's new lift above byte 127 ... so the far ring and far
field show the old squashed peaks - read the land through G's law ... rather than a copy, for the far ring, the middle
ring's coarse surface and the far field; pin it"; "check the overworld's far field shows a wide river where it should";
"Build the city-skyline hook you proposed ... with a pinned test landmark, so stream A can hand in the Imperial City's
silhouette".

**BREATHTAKER2 on the horizon.** A pixel's macro height is `ringHeightAt(x, y, byte, relief, fade)`
(`render/farRing.js`): `ringHeight` with the continent's share at the byte's node, `byteBeyond(x, y)`
(`world/landforms.js` - 0 on the Bay, its seam band and the Eltheric Ocean's box), so `reliefByteHeight` carries stream
G's lift past byte 127 (CONTINENT_LIFT; G's figures: 15.6 m a byte, Skyrim's spine 3,131 m) exactly as the streamed
kernel does. It is G's function, called; no copy of the law. Four readers take it: the far ring's grid (both relief
branches, the clamped pixel's and the own-ground's), the far field's cells (at each cell's centre pixel, the far field's
`heightOf(byte, x, y)`), the middle ring's eased rim (its `coarse` is the far ring's grid under each vertex), and the
travel view's ground past the built grid (`scenes/world.js` tvSceneOf, so the plates and veils stand on the peaks the
ring shows and are not buried in them). With the Landforms row off every reader stands the plain law, as the kernel does.

**The rivers' water on the horizon.** G's rivers and lakes (`world/tamriel/tamrielWaters.js` waterAt) are water in the
streamed ground, so the middle ring marks them as its sea marks its own (the far ring's water look on those vertices):
`world/terrain/farClimate.js` midRingWet asks waterAt at each of a pixel's samples on the terrain worker, beside the
heights, and the flags are kept with them by pixel (26-37 ms a ring on the worker, measured on the freeware's ground; the
Bay and its seam band never asked - G's law runs no water there). On the freeware's trace the Lower Niben, some 419 m
across, stands three samples wide at the middle ring's 102.4 m. The far ring (819 m a vertex) and the far field (6.55
km a cell) are coarser than any river G carves - a river there would be one vertex's blot, stepping a cell at a time as
the traveller moves - so they draw none: a wide river shows out to the middle ring's rim (some 12 km) and the hills
beyond it go on. Checked by the pins and on the freeware's trace in node; not seen in a running frame (every browser
probe of the world page on this shared machine was killed for memory).

**FAR-LANDMARK - a silhouette on the horizon** (`render/farLandmarks.js`; stream A's Imperial City at some 20 km):

```js
const handle = farRing.addLandmark({
  px, py,                 // the map pixel it stands on
  mesh: {
    positions,            // Float32Array, x y z a vertex: x east and z north from pixel (px, py)'s south-west corner,
                          //   world units (TERRAIN_SIZE a pixel); y the world's own height (the streamed ground's)
    indices,              // optional Uint16Array | Uint32Array triangles (sequential when absent)
    normals,              // optional Float32Array (made from the faces when absent)
    colors,               // optional Uint8Array, rgb 0-255 a vertex (LANDMARK_GREY when absent)
  },
  key,                    // optional name
});
handle.remove();          // lets it go, every buffer with it
```

`landmarkBox({ x, z, w, d, y, h, color })` makes a box (a tower, a run of wall: ten triangles, the floor open) in the
same frame - the pins' landmark, and the part a silhouette is built of. The far ring's program draws it: its light, its
haze, its clouds' shadows; never eased (`uMorph` off for it), its sea attribute off. While the stream has built pixel
(px, py) it stands down - the city's own models stand there - so a city wider than one pixel hands one landmark a pixel,
each the silhouette's part over its own pixel.

How it is ordered: the far pass stands at the far plane (`depthRange(1, 1)`, depth tested against the world's, never
written - AUDIT FAR-SEA1 P1), so its layers are put in front of one another by the painter's order. The far ring's cells
are now written farthest first from the traveller's pixel too (`writeRingCells`, a list of offsets sorted once, each
cell's distance kept), the middle ring's pixels and the far field's cells already were. A landmark takes its place by its
distance: the far field, the ring's cells farther than it, the landmark, the nearer cells and the sea's fill, then the
middle ring's pixels cut the same way at a landmark inside its footprint (`MidRingMesh.drawRange`). Its own triangles are
sorted farthest first from the traveller each pixel the traveller crosses (`FarLandmark.reorder`: one sort of its
triangles, uploaded), so a tower behind a wall is drawn before the wall.

A departure from the proposal it was asked for ("the far-plane pass's own depth sub-range with depth writes"): no depth
range of its own. The world's lens writes depths up to its far plane, within a few 24-bit steps of 1.0 for the distant
ground, so any range [r, 1] the far pass wrote into would sort a far hill in front of the world's own far ground there,
and the world's framebuffers carry no stencil to keep the two apart. The painter's order is the pass's law already and
holds for a landmark at the cost of one sort of its triangles a pixel crossed. Its limit: a landmark's triangles are
ordered among themselves by their centres, so two parts that interpenetrate can draw in the wrong order from some angles
- a silhouette of boxes and walls, seen from kilometres off, is the case it is built for.

Proof: `test/render/farlandmark.test.js` (the height law at the pixel, the grid's and the far cell's; the far field
under the Landforms row; the ring's cells farthest first with the hole left out; a landmark between the ring's cells at
its distance, at its pixel's origin, never eased, its triangles farthest first, two in sequence, one nearer than every
cell after the ring, every draw with its own array bound, stood down where built, let go; the middle ring cut at a
landmark, its ease put back), `test/ui/mapwaters.test.js` (the middle ring's water and the client's bands; with ARENA2,
the Lower Niben), `tools/mutants/farlandmark.json` (24, all dead). PIN MOVED: `test/scenes/tv3_travellers.test.js`,
`test/world/terrain/auditlandforms.test.js`, `test/render/farsea1.test.js` (the travel view's ground past the grid at its
pixel); `test/world/tamriel3.test.js` (the waters' ask follows the trace to the worker); `test/render/la_cost.test.js`
(LA-COST1's law classes `_tFade`, the pixel fade's last-uploaded share, a GL-state shadow beside `_tSnowOn`: the terrain's
frame block forgets it, `_terrainFade` uploads it per draw, and `_installWorldSet` looks its location up again with the
set's programs). Daggerfall Unity has no layer past its TerrainDistance to put a landmark in: Port-Ledger row MID-RING.

**The first landmarks handed in: the Imperial City's** (stream A, `03-World/Arena-Provinces.md` IC-GRAND, "The city from
afar"): `scenes/capitalSkyline.js`, wired through `scenes/tamrielSweepsHost.js` (the world host hands it `farRing`),
hands one landmark a slice of the city's 625 (`world/imperialImpostor.js` imperialLandmarkMesh - 259 stand something, 76
triangles on the median) while the traveller is within the ring's radius and the span's half of its centre, a 3 ms budget
a frame, each stood on the ring's own ground at its pixel - `FarRingRenderer.groundAt(px, py)`, the ring's grid read at
the pixel's centre (IC-GRAND's one line in this file), null before a build or off the grid, so a slice there waits for
the ring to move. Pinned in `test/world/icgrand_lod.test.js` and `tools/mutants/icgrand.json`.

## FAR-FLORA - the woods past the streamed grid (2026-10-26, the owner)

The owner: "I really want to improve the draw distance without impacting performance, its better but the graphical
fidelty farther out is still not to my liking", and then: "on top of distant view, no flora/trees show. Its just a plain
green flat texture. No band aids for any of this".

**What the far views drew** (measured on the freeware's ground, the game's own far pass in one headless Chromium on
SwiftShader, at 4359d3fed0 - `FarRingRenderer` with both lanes' programs and the stepped laying; the streamed grid not
drawn). The middle ring had 54,289 vertices and 107,648 triangles, the far ring 9,409 and 16,864 outside the middle ring's
footprint, and the far field 14,641 and 28,558. That is some 153,000 triangles in three draws plus the middle ring's runs,
3.5 MB on the GPU. Every land vertex was `overworldTint`, one skin colour a climate with rock over byte 64 and PEAKS1's
snow, and every tree stopped at the streamed grid's edge, 4.5 km out at Land View 5: the owner's "plain green flat
texture" and its tree line.

**The woods by the near law** (`world/terrain/floraCover.js`, worker-safe). The streamed grid stands its trees a tile at a
time (`terrainNature.js` layoutNature: FOREST1's field and chances, or DFU's scatter with Real forests off and on a desert).
`midRingFloraPixel` reads the same law at each of the middle ring's samples (102.4 m, every 16th tile), on the terrain
worker beside the heights and kept by the pixel with them:
- the forest field at the sample's own world tile (`forestAt`);
- the ground classes `tileDataAt` lays at four corners a quarter-step about it;
- a corner grows nothing under the beach line or on a face over `MAX_STEEPNESS`.
`treesPerTile` lays the climate on where the vertex is built:
- with the woods' law, FOREST1's chance by the field and the ground's share (`forestTiles`);
- else DFU's chances by tile, the WOODS byte's elevation scale, `DESERT_NATURE_SCALE`, and the share of the archive's 31
  records that are Trees.
`canopyCover` turns that into the share of the ground the crowns hide seen from afar: one minus the chance a line across
the woods meets no crown, at FLORA.grazing crowns' widths. The far ring (819 m) and the far field (6.55 km) stand past the
field's waves, so they take the law's expectation, `expectedTrees`: FOREST1's 45% wooded land on grass. The middle ring
eases its own woods, and the ground's shares, onto that expectation over MID_FLORA_EASE, the geomorph's band. So where the
far ring takes the ground over, it takes the woods over too.

**In the trees' own art** (`render/farFlora.js`). A climate's Trees are its summer nature archive's Tree records
(`TREE_RECORDS`).
- Colour: the mean of their opaque texels, weighted by each picture's texels. The picture is the one drawn near: a decoded
  replacement first (Vanilla Enhanced's), else the classic record through the pipeline's `classicRgba`
  (`textureDeriveContext`, a new export of `systems/textureReplacement.js`). FAR-TREES (below) moved the canopy's mix into
  the program, under the flats' own light.
- Height: their billboards' mean (`scaledBillboardSize`). The canopy stands at FLORA.lift of it times the cover, so a
  wood's edge stands up and its normals lean.
- The ground under the canopy is the near ground's own three tiles (`groundArt`: DIRT 1, GRASS 2, STONE 3 of the climate's
  ground archive) mixed by their shares. The far views take FLORA.ground's shares, measured over 200,000 corners of the
  Bay's land: 5.4% dirt, 92.7% grass and 1.9% stone.
- Read once an archive, off the frame. Until a climate's art is read its woods are not drawn; the book's `version` moves
  when one lands, and the far ring, the middle ring and the far field are built again with it.
- On the freeware's classic art TEXTURE.504's Trees are rgb (62, 68, 44), 11.8 m high and 9.2 m wide.

**The grain** (`render/horizonHaze.js` FLORA_GLSL, both lanes' far-ring programs). A vertex's canopy rides location 5
(`aCanopy`, four normalized bytes since FAR-TREES: its cover and the trees' art; the middle ring, the far ring and the far
field upload it, and a landmark leaves it off at the attribute's constant, no cover). `floraGrain` darkens and lightens the
canopy about its colour with two value noises on the world's own metres: crowns at
FLORA_CROWN_M (9 m, FOREST1's half a Tree a 6.4 m tile) and groves at FLORA_GROVE_M (46 m). Each fades out as its cells
fall under a fragment (`fwidth`), so it never shimmers and a far wood is its mean.

**The knob.** The woods stand at Land View FLORA_MIN_LAND_VIEW (4) and up: Medium, High and Ultra
(`systems/graphicsPresets.js`). Low's 3 keeps the far views of before: no woods asked of the worker, no attribute, the
grain one uniform test (`uFlora.x` 0). `?farflora=off` stands them down.

**The cost.**
- GPU: four bytes a vertex since FAR-TREES (one at this slice), 313 KB across the three layers. The fragment shader gains
  eight hashed corners, two smoothsteps and two `fwidth`s, and the flats' light beside the ground's.
- The worker: a pixel's woods 0.48-0.90 ms beside its heights' 0.34-0.50 ms (node, the synthetic world, this machine
  loaded to 30 runnable threads). A cold middle ring is some 0.4-0.7 s more there; a rebuild's 170 new pixels some 80-150 ms.
- This thread: the middle ring's laying, warm, is 37 ms against 23 ms without the woods. It is spread over 89 steps against
  70 (`midRingVertexSteps` lays half as many rows a step with them), p95 0.37 ms a step under HORIZON_BUDGET_MS. The far
  ring's grid, rebuilt every 12 pixels' drift, reads one `floraOf` and one cover a vertex; the far field one a cell, in its
  steps.

**Seen.** The game's own far pass on the freeware's ground, in one headless Chromium (a scratch bench of the session's,
not committed), A/B in one tree by `?farflora=off`. From 350 m over Cyrodiil's Nibenay valley and over the Bay's north
coast, the plain green has become FOREST1's woods: dark crowned patches with fields and dirt between them out to the
middle ring's rim, and the woods' mean beyond. Skyrim's foothills over the Jerall stand over PEAKS1's line and are white
either way. The images are the session's, never the repo's (Port-Doctrine).

**Not done, and named.**
- The woods past the grid are a canopy, not trees: the instanced billboard band from the game's own tree art, crossfaded
  with the near flats' cut, is the next lever (BILLBOARD BAND).
- The art is the summer archive's; the near flats' season (and Seasons of the Iliac Bay's) is not followed past the grid.
  PEAKS1's snow whitens the woods over its line as it whitens the ground.
- A town's clearing and a place's pull (FOREST1 `placesPull`) are not read past the grid: a town's own pixel there is the
  woods' law.
- The jungle's own layout (BANTHA1 `jungleLayout`) and the graht-oaks stand as their climate's Trees (Rainforest's
  TEXTURE.500).

A departure from Daggerfall Unity, which has no ground past its TerrainDistance: Port-Ledger row FAR-FLORA. Proof:
`test/render/farflora.test.js` (9 tests: the sample against the near law's own field and classes, the beach and the face;
the trees a tile grows under both laws and the cover; a vertex's ground and canopy; the middle ring's woods - its pixel,
its lift into its normals, its ease and its ground's, its step; the far ring's and the far field's; the knob, the job, the
rebuild on art, `groundAt` the ground's, the kill door; the worker's answer and the client's bands; the art's means and the
book; the program's attribute and grain in every lane), `tools/mutants/farflora.json` (46, all dead).
PIN MOVED:
- `test/render/midring.test.js`: the middle ring's ask carries `flora`.
- `test/render/farsea1.test.js`: the classic ring's land line under the canopy (moved again by FAR-TREES, the mix).
- `test/render/audit_farsea1.test.js`: the evaluator takes FLORA_GLSL, off.
- `test/world/terrain/terrainworker.test.js`: the worker imports `floraCover.js`.
Displaced mutant records re-aimed by content (each killed again):
- `midring.json`'s four asks' drifts and its transfer;
- `icgrand.json`'s `groundAt` column;
- `peaks1.json`'s ring whiten.
The four hosts: `scenes/world.js` builds and draws the far ring as before (no line changed); `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` draw no far ring.

## FAR-TREES - the near trees carried past the streamed grid (2026-10-26, the owner, through the coordinator)

The owner: "on top of distant view, no flora/trees show. Its just a plain green flat texture. No band aids for any of
this". The coordinator: the billboard band from the game's own tree art, crossfaded with the near flats, so the tree line
at the grid's edge is gone. The owner held the release for it.

**What stood at the grid's edge.** The streamed grid stands every Tree of its pixels: FOREST1's woods, or DFU's scatter.
Past its two nearest rings only the tall flats draw, every Tree among them (`world/flatDistance.js`). Past its edge, 4.5
km out at Land View 5, the far views stood FAR-FLORA's canopy alone (above). Seen from over the grid, the trees stopped in
a line and a smooth wood of their colour began. Where the stream still owed a pixel inside the grid, the same line ran
round the hole.

**The band** (`render/farTrees.js`). Two sets of pixels make it (`bandPixels`):
- the ring of pixels past the grid (BAND_RING, 1);
- every pixel inside the grid the stream has not built (its `built` map, read at each pixel the traveller crosses).
Each band pixel stands its own trees. The pixel's layout runs on the terrain worker (`world/terrain/floraCover.js`
`bandTreesPixel`): its kernel samples with the landforms the worker holds, its ground classes and their squares, and the
nature's own `layoutNature`. That is FOREST1 with the switch, else DFU's scatter, which a desert always takes; the result
is kept to the archive's Tree records. So a band tree is the very flat the built pixel will stand: its own dice, its
place, its record and its size. The band is drawn in the far ring's pass at the far plane, so a built pixel's ground (and
its own flats) cover the band's trees by depth. When the stream builds a pixel nothing moves.

**What a band pixel leaves out** (named, each a tree or a few where the built pixel differs):
- a location's clearing and flattening;
- the roads' paint and their track mask;
- a World of Daggerfall site;
- a neighbour climate's tiles at a border (ECOTONE1);
- the jungle's own layout and the graht-oaks (BANTHA1, GRAHT1);
- the season's art: the summer archive's pictures, as FAR-FLORA's.

**The crossfade, both sides by one rim.** Over BAND_FADE (0.5 to 1.45 pixels past the grid's radius, Chebyshev from the
centre of the pixel the band was laid round), two things happen together:
- the band's trees dither out: a byte a tree, `treeHash`, against a smoothstep;
- the far ring's program lays the canopy back over the ground (`uCanopyBand`, `uCanopyFrom`: under the band its own
  trees stand on the ground, and the canopy's colour would count them twice).
From the grid's edge outward, the trees stand at the near law's density, thin over the band ring, and hand over to the
canopy as it comes in. The near flats needed no fade of their own: the band continues them tree for tree, at the same
places, so the grid's edge is no edge. The coordinator's permission to give the billboard program a distance fade
(render/renderer.js) was not used, and renderer.js is untouched.

**The canopy, lit as the trees are.** FAR-FLORA's canopy colour moved into the program. A vertex's canopy is now four
bytes at location 5: its cover, then the trees' art (`plantCanopy`). The ground's colour stays the vertex's own. Both
lanes' far-ring programs mix the two by the cover: the ground under its own light, and the canopy under the flats' light
(`horizonHaze.js` `floraLight`: the ambient and half the moon, half the sun under the clouds' shadow - renderer.js BB_FS's
`uTint` and `uBBSun`), grained (`floraGrain`). A far wood is therefore the aggregate of the band's trees, which take the
same light (`farTrees.js` TREE_LIGHT), and FLORA.shade, the canopy's stand-in for the flats' light, is gone. PEAKS1's snow
whitens the canopy's colour as it whitens the ground's: a mix of the two whitened is the mix whitened.

**How it is drawn.** One draw of points, by the band's own program (classic, the lane's, and the classic-shadow lane's look
over the lane's - `treesFsFor`):
- **The sprite.** A tree is a screen square the side of its billboard's larger extent, projected through the pass's lens
  and the world viewport's height, standing on its foot.
- **The picture.** The record's own, laid bottom-centred into a TREE_LAYER (64) layer of one mipmapped array texture
  (`layerPicture`, up to TREE_LAYERS 48). It is the picture drawn near: a decoded replacement, else the classic record
  (`farFlora.js` `pipelinePictures`). TESA-LANDS (AUDIT, `03-World/Tamriel-Lands.md` "The far views"): a picture is read
  where a wanted pixel's tree is of it - not every Tree of its archive - and the layers are LENT: a full atlas gives a
  picture the layer of one no wanted pixel, no drawn set and no set being laid is of, and asks a picture it turned away
  again when the drawn set moves (the Bay's eight archives hold 60 Trees: a journey had outgrown the 48 and left a
  province's band trees out for the session).
- **Cutout, light and haze.** Cut out at the flats' own 0.5, lit by `floraLight`, hazed as the far ring is.
- **Sub-pixel trees.** A tree under a pixel is drawn by its share of one (its byte against its area), so a far wood keeps
  its coverage and never becomes a blot of one-pixel points.
- **Placement.** The instances sit in the band's frame (`bandInstanceSteps`: x east and z north from the base pixel's
  south-west corner), 16 bytes each: x, y, z, the layer and the dither byte.

**The knob and the doors.** The band stands with the woods: Land View FLORA_MIN_LAND_VIEW (4) and up, with a terrain
worker. Low's 3 asks nothing, lays nothing and draws nothing. `?fartrees=off` stands the band down and leaves the canopy;
`?farflora=off` stands both down.

**The cost.**
- **Points.** The band's are the near law's own count, about 3,600 Trees a pixel on the freeware's Cyrodiil (612,326 over
  the bench's 169 pixels). Land View 5's ring of 48 pixels is about 175,000 points, 2.8 MB, one draw. The grid's unbuilt
  pixels add their own until built.
- **The GPU.** Each point is one vertex: a matrix and a few comparisons. Each fragment of it is one texture fetch, the
  light and the haze. Trees at the band's distance are 1-3 pixels, so the band is some hundreds of thousands of
  fragments, most of them under the built ground's depth and rejected before the shader.
- **The worker.** About 40 ms a pixel: the kernel 30, the tiles 7, the layout 5 (node, the synthetic world, this loaded
  machine). The work is kept by the pixel in the horizon's book, asked BAND_PIXELS_AN_ASK (4) pixels an ask, the next as
  the last lands, so the stream's own jobs run between them. A cold band is about 2 s there; a pixel crossed asks its new
  ring's 13 or so.
- **This thread.** At each pixel crossed the instances are laid one pixel per step under the far ring's
  HORIZON_BUDGET_MS. They are uploaded one 512 KB slice per step (UPLOAD_SLICE) into a buffer of their own, and swapped in
  whole when the last slice is up. The atlas is written once per archive. Nothing is per frame beyond the draw.

**Seen** (the game's own far pass on the freeware's ground, the scratch bench of FAR-FLORA). No streamed grid is drawn
there, so the bench stands the grid's own trees by the same law; that is the stand-in, named. From 900 m over the grid's
north edge in Cyrodiil, the near trees alone stop in a line. With the band they run on a ring and thin into the woods'
canopy, with no line. From the travel view's eye the forests read as forests out to the band, and as their canopy past
it.

A departure from Daggerfall Unity, whose trees end with its streamed terrain: Port-Ledger row FAR-FLORA. Proof:
- `test/render/fartrees.test.js` (8): the band's pixels; a pixel's trees against the stream's own layout under both
  laws; the instances' frame, layer and bytes; the layer picture; the book - its asks, the archive, the art once, the
  steps, the slices, the swap, the draw, the rim, dispose; the worker's band and the client's asks; the programs; the far
  ring's gate, knob, draw and the canopy's crossfade.
- `tools/mutants/fartrees.json` (40, all dead).
PIN MOVED: `test/render/farsea1.test.js` (the classic ring's land line, the canopy's mix) and `test/render/farflora.test.js`
(FAR-FLORA's own pins: the canopy four bytes, its colour in the program). The four hosts: `scenes/world.js` builds and draws
the far ring as before (no line changed); `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` draw
no far ring.

### FLORA-GROUND - the band over built pixels, and the ground it stands on (FIELD BUGS 2026-10-27)

What the player saw (the owner: "floating flora ... can be seen off the ground in first person"). Read off the code (NOT
SEEN ON A GPU: this session's software renderer could not boot the world under the machine's load): after a load or a
teleport, band trees with no trunk could stand against the sky over towns, roads and clearings near the player, and
flat tree pictures beside the 3D trees.

The cause. The band's pixels (`bandPixels`) were read at each pixel the traveller crossed. A grid pixel the stream built
after that read kept its band trees until the next crossing, and after a load or a teleport that was the whole grid.

The band is drawn at the far plane, so the built ground and its own flats covered a band tree wherever they stood in
front of it, but not where the band tree stood against the sky. The band's layout keeps no town clearing, road or World
of Daggerfall site (above), so a crown stood over each of them. A band tree is also a flat sprite of the classic record,
and it showed round the 3D tree that stands in its place. And the band's trees were kept by the pixel on this thread
for the session. When the ground's inputs moved (Basic Roads' network landing, the landforms' tables, the sites past
the Bay, the continent's trace and its relief - the messages the worker drops its own kept grounds on), the kept trees
stayed on the old heights and the middle ring under them did too, until the traveller drifted three pixels.

The fix.
- Each instance carries its pixel's slot about the base pixel (`bandSlot`: BAND_REACH pixels either way, the Land
  View's most and the ring - the instance's two spare bytes). The program drops an instance whose slot the stream has
  built (`uBuilt`, a bit a slot, `bandBuiltBits`). The bits are written the frame the built map changes
  (`FarTreesBand._builtNow`, keyed by the map's `changes` and the drawn base). Nothing is laid again for it.
- The terrain client counts the ground's inputs (`TerrainGenClient.groundEpoch`: setRoads, setRoadsData,
  setLandformTables, setLandformBeyond, setTamriel). When it moves, the band lets every kept pixel go, drops an answer
  on its way and asks the worker again (`_groundNow`), and the middle ring under it is asked again too
  (`FarRingRenderer._groundStale`). A tree is never taken away before its new ground is laid: the drawn buffer stands
  until the new one swaps in.
- A band tree's height is the walk law's (`terrainSurface.js` walkGroundAt, through `layoutNature`), the ground the
  player will stand on when the stream builds the pixel (`03-World/World-Arc.md` FLORA-GROUND).

Pins: `test/world/terrain/floraground.test.js` (the slots, the bits, the program's drop, the book's frame and epoch, the
middle ring's re-ask). Mutants: `tools/mutants/floraground.json`, all dead; `tools/mutants/midring.json`'s
MID-RING-ask-every-frame and MID-RING-drift-late re-aimed by content (the ask's line grew the ground's test), dead. The
four hosts: `scenes/world.js` draws the
far ring and its band; `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` draw none.

## HORIZON-TREES - the band's trees cut at the nearer ground's skyline (2026-10-27, KPbICA through the owner)

KPbICA on the DFO Online Discord, forwarded by the owner (2026-10-27): "Strange projections above the horizon line"; the
owner, the same day: "No band aids or half assed work". RELIEF-PEAKS named the cause and left it to this file's slice
(`03-World/Tamriel.md` RELIEF-PEAKS, Cause 7).

- **What the player saw.** Tree sprites standing over a hill's skyline at the edge of the streamed world - from the
  Overworld most of all. The far pass (`render/farRing.js` draw) is depth-tested against the streamed world and writes no
  depth (PERF2, FAR-SEA1 P1: every fragment at the far plane by `depthRange(1, 1)`), so its own layers stand in front of
  one another by the painter's order alone: the far field, the far ring, the middle ring, and the band (FAR-TREES) last.
  A band tree behind a nearer hill of the middle ring was drawn over that hill whole.
- **Measured** (`tools/horizonTreesProbe.mjs`, the freeware, Bay pixel 2046,325, the eye 300 m up, Land View 5): of the
  band ring's 185,688 trees, 45,068 (24.3%) stood wholly behind the middle ring's ground and 16,110 (8.7%) behind it in
  part (a 12 m tree) - every one drawn whole over the hill before.
- **The fix** (`render/farTrees.js:"float skyline(vec3 eye, vec3 foot)"`): the middle ring keeps the heights it draws
  (`render/midRing.js` groundHeights, `MidRingMesh.build`), and the far ring hands them to the band's draw with their corner
  in the band's frame (`farRing.js:"_bandGround(origin) {"`). The band uploads them once a ring as a half float a vertex,
  filtered, on GROUND_UNIT (`farTrees.js:"_ground(ground) {"`). Its vertex program takes the eye from the view and reads
  the ground at HORIZON_STEPS - 1 points between the eye and each tree's foot - a point in a pixel the stream has built
  left to the depth test its ground already passes (FLORA-GROUND's slot bits), a point past the ring not read - and the
  highest line the ground lifts at the tree, less GROUND_SLACK (1.5 m: the drawn triangles against the heights'
  bilinear, the half float's step), is the tree's cut: a tree under it whole is not drawn, and both fragment programs draw
  a sprite above it alone. The JS twin (`farTrees.js:"export function skylineAt"`)
  is the law the pins and the probe read; the vertex program was run against it in WebGL2 by transform feedback (64 trees
  over a synthetic ridge with two built pixels: every whole-hidden verdict the same, the cut within 0.004 of a tree's
  height). The frames checked on the freeware: the ring's height under each band tree's foot is the tree's own ground
  within 1.6 m at the median, 8.3 m at the 95th centile.
- **The cost.** 23 filtered texel reads a tree in the vertex program (Land View 5's band some 190,000 trees: about 4.4
  million reads a frame); one upload of 50,625 half floats each time the middle ring is built again (every
  MID_REBUILD_DRIFT pixels). Nothing on the main thread a frame but four uniforms.
- **The departure** (Port-Ledger A, with FAR-TREES): DFU stands no trees past its streamed terrain, so it has no band to
  cut. THE FOUR HOSTS: the far ring is `scenes/world.js`'s alone (the Overworld and the streamed world); `exterior.js`,
  `worldModes.js` and `dungeonContext.js` draw no far pass.
- Pins `test/render/fartrees.test.js` (3: the skyline law; the programs; the band's ground and the far ring's hand-off).
  Mutants `tools/mutants/horizontrees.json` (22, all dead).

## TVD-WORLD - the Overworld's dungeons past the Bay (2026-10-27, the audit NO SYSTEM LEFT BEHIND IN THE BAY)

The audit's item 29 (C4); the owner: "Every single thing here needs to be addressed. No exceptions." (2026-10-26). TV6
stands every dungeon within the far range - a found one a plate and a journey, the rest a "?", found within a kilometre -
and OW-DUNGEONS its model. But its dungeons were MAPS.BSA's rows (`dungeonRows`): past the Bay no lair (TESA8, the land's
dungeons there) was plated, marked, found or drawn. The found spawns past the stream (`filedSpawns`) were read on the
Bay's 1000 x 500 alone.

What stands now:
- **The lairs about the traveller** (`systems/travel/travelLairs.js` createTravelLairs): the places host's own lairs
  (`provinceQuestPlaces` lairAt, lairCloneAt - the law the build stands), nearest cell first. A cell's first read is its
  plateau and its plan, and the far range holds some forty, so a call reads at most four new cells (TV_LAIR_READS) and its
  `gen` moves while any cell in reach is unread: the lists fill in over a few frames. Kept under the places host's stamp
  (the trace landing reads them again). The Bay's own cells are never asked: the Bay's dungeons are the map's rows.
- **The rows** (`scenes/travelViewDungeonsHost.js`): the map's and the lairs'. A lair's pixel not built stands its lair laid
  out, marked and never built (`tvDungeonAt`). A lair found by its own id is a plate whose summary journeys to it
  (`tvDungeonSummary`, `tvDungeonFound`), the find's found test the same pair. The list and the models' list
  (`scenes/travelViewDungeonModels.js`) are keyed on the index's generation and the lairs' `gen`.
- **The found spawns past the stream** (`systems/travel/travelDungeons.js` filedSpawns) are read on the world's grid, where
  SPAWN-WORLD (`06-Systems/Systems-Arc.md`) stands spawns past the Bay.

Measured over the freeware (the places host over the player's own data): about Windhelm's road (2215,-371), Bravil
(2170,485) and Black Marsh (2900,900) the Overworld listed 0 dungeons before; now 9 of the 9 lairs in reach, 13 of 25 and
12 of 23 (twelve past the grid, the grid's own "?" besides), settled in 7-8 frames.

THE FOUR HOSTS (Home.md): `scenes/world.js` hands the places in (one entry) and keeps the find's found test and key in
place; `scenes/worldModes.js`, `scenes/dungeonContext.js` and `scenes/exterior.js` have no Overworld. A departure from
nothing in DFU, whose travel map has no Overworld (Port-Ledger, the Overworld's row: OURS).

Proof: `test/systems/travel/tvdworld.test.js` (6; with ARENA2 every lair in reach listed). Mutants:
`tools/mutants/tvdworld.json` (19, dead). PIN MOVED: `tv6_dungeons.test.js` (the circle's corners on the world's grid; the
key and the found test; the lifted rows run through `tvDungeonFound`), `ow5_audit.test.js`, `owdungeons.test.js`,
`ether_ow.test.js` (the lifted rows). Re-aimed by content, all dead: `audit_etherow` AEOW-T-find-rows-bay and
AEOW-T-find-loc-index, `ether_ow` EOW-far-ruins-unread, `ow4d` OW4D4-off-the-map-y, OW4D4-off-the-map-x and
OW4D5-size-again.

## BAY-LEFT-MAPS - the Overworld's places past the Bay by their summary (2026-10-27, AUDIT LEFT IN THE BAY C3; C10's dots, C11's wheels)

The owner, after AUDIT LEFT IN THE BAY (2026-10-26): *"Every single thing here needs to be addressed. No exceptions."*

**What stood.** `tvPlaceSummary` read the location index alone past the Bay, and the index holds a place past the Bay only
once its pixel has built. So a passage booked to a port past the Bay, saved and loaded, never resumed: her master asked
every 20 s (`scenes/naval/passageHost.js` frame) and was answered nothing. A port past the Bay found in an earlier session
was off her masters' lists (`passageDestinations`' `known`). TV5's far plates were one snapshot of the index at the view's
first ask - the Bay's rows and whatever stood past it then - so no country town, and none of a province not built yet,
ever reached the edge (lane C's p5: a mean of 0.00 far plates about a town past the Bay). A quest's diamond past the Bay
did nothing: its key's pixel was unread west and north of the Bay's corner (`^quest:(\d+),(\d+)$`), and its place unfound.

**What it is now** (`scenes/mapPlacesHost.js` createMapPlaces - moved out of bootWorld verbatim by HOST-SPLIT first):
- **A place known and not standing yet is its row's summary.** On a pixel past the Bay with no location, the place there
  is its row's summary (`rowAt`: the registry's list, else the countryside's roll and the lair on its cell - the rolls the
  build stands, so the same id, name, region, location and type), known by its kind (OW-BEYOND-KNOWN, below) or found -
  the row's own id the one found. Its location stands the first
  time something reads `summary.loc` (a journey's arrival and its door - `standAt`, the build's own order), never to answer
  a list: standing one is the build's own 24-152 ms. Until then a plate stands over its row's block grid (`lightRect`,
  which `scenes/world.js` tvPlaceRect reads first).
- **A place a quest names** (`named`: OW-QUEST's press, and its diamond's middle in `scenes/travelViewMarks.js`) is its
  summary found or not - past the Bay a quest's site is on the map either way (START3) - and the press reads a key west and
  north of the Bay's corner (`-?\d+`).
- **TV5's settlements** (`tvFarSettlements`): the Bay's gathered once (the index's Bay rows - never an isle's, never a place
  past the Bay the index held then), and wherever the edge's circle leaves the Bay a near query each ask - the registry's
  listed towns in range (a capital once, by its centre slice: the Imperial City is 625 of them), kept by the registry's
  generation, and the countryside's towns the roads' regions laid there (`world/pastBayPlaces.js` pastBayPlacesIn).
  `farPlaces` keeps the known ones.
- **The junction map's dots** (C10, `junctionPlaceAt`, the host's `locationAt`): on the Bay its row and DFU's discovery
  law as the host read it; past the Bay the place known there, its type its row's, nothing stood.
- **The carriage towns** (C11, `carriageTown`): by the place's own key - a Bay place by its pixel id (DFU's mask,
  `y * 1000 + x`), a place past the Bay by its whole id (`systems/discovery.js` discoveryKeyOf) where the registry stands
  it, and only when the place standing there is that id's. It read every map id as the Bay's pixel id, so a walled city
  past the Bay never showed its wheel (lane C's p12: 283 listed places asked, each on an aliased Bay pixel with no listed
  place).

**Measured** (the freeware, `test/scenes/bayleft_places.test.js`): an Arena village, Solitude and a country hamlet of
Skyrim, found and not built, are the summaries their locations carry once stood; a passage booked to an unbuilt port past
the Bay resumes after a save and a load, and the port is on her masters' lists; about a village of Skyrim the edge marks
its found settlements (ten, its most), none stood, under 100 ms a pixel.

**Decisions.** A list never stands a place - a far plate, a dot, a master's list; only a read of the location does. A Bay
place is answered as before, byte for byte, and the isles' and the halls' arms are unchanged.

**The four hosts.** `scenes/world.js` wires the module (handed `provinceQuestPlaces` and `worldPlaces`; the junction map's
`locationAt`, the far list's settlements, tvPlaceRect's light rect and the quest press are in-place edits);
`scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` hold no Overworld and no passage.

Pins `test/scenes/bayleft_places.test.js` (8, three on the freeware). Mutants `tools/mutants/bayleftmaps.json`: BLM-C3-*
(15), the carriage key's three BLM-C11 records and the junction dots' two BLM-C10 records - all dead. PIN MOVED
(BAY-LEFT-MAPS): `test/systems/travel/ether_ow.test.js` and `test/systems/audit_etherow.test.js` (the lifted near query,
`named`), `test/ui/travel/owquest.test.js` (the press), `test/ui/travel/tv5_far_places.test.js` (the settlements),
`test/audit_tesa.test.js` A2-3 (the dot, `named`), `test/ui/fb1004e_overworld.test.js` OW-KIN (the carriage key).
Re-aimed by content and run, all dead: AOWR-L5-1-mark-at-pixel-middle, AUDIT-TESA-A2-3-summary-undiscovered,
EOW-settlements-isles, OWQ-press-unread, OWQ-pixel-swapped. A departure from DFU, whose places are MAPS.BSA's: Port-Ledger
A, BAY-LEFT-MAPS.

## RELIEF-PEAKS ON THE HORIZON - the far views on the kernel's own ground (2026-10-27, KPbICA through the owner)

KPbICA: *"5) Strange projections above the horizon line. Probably because of the part of the renderer that draws
details further than loading distance"*. The whole slice is `03-World/Tamriel.md` RELIEF-PEAKS; the far views' part is
here.

- **What stood.** The far ring stood each vertex (a pixel's centre) at its own byte's height, and that law left the
  kernel's second term out (the large map, a third of the land's height) - so it stood 410 to 500 m off the kernel's
  mean ground in the continent's ranges, the Bay's Dragontails some 470 m under it, and every byte half a pixel from
  its own node. The far field stood each cell at the highest of its nine samples' bytes by that law: past the Bay up to
  105 m over the ground at its place (29 m on the mean), on the Bay 266 m under it on the mean and up to 253 m over it.
- **The law now** (`render/farRing.js` ringHeight, ringGroundAt; `world/landforms.js` nodeGround, centreGround,
  nodeGroundAt): the far ring's vertex is the kernel's mean ground at its pixel's centre - the small term's cubic over
  the pixel's window, the large map by its law (`tamrielGround.js` largeOfByte), the lift faded by its nodes' fades,
  the continent's share, the ranges. Its grid reads the bytes once into a padded grid and the nodes' fades once a node.

  The far field's vertex stands on the node its cell's centre is (`world/terrain/midRingGrid.js` farFieldCell's
  `ground`): worked out on the terrain worker under the Landforms row, kept by the cell, transferred and assembled a
  band at a time. The travel view past the grid (`scenes/world.js` tvSceneOf) reads the ring's ground. Measured: within
  2 m of the kernel's mean ground past the Bay, within 35 m on the Bay (the law against WOODS.WLD's own cells); the far
  field within 2 m past the Bay and 45 m on it.
- **The ring's sea** stands where the ring's ground stands at the sea's height. A lone island byte now stands at its
  node, the corner of four pixels, as the streamed ground stands it, so the four are its shore (FAR-SEA1's pins moved).
- **The skyline.** At six viewpoints 300 m up (180 bearings each), the drawn skyline against the ground's own: before,
  under one pixel over it everywhere; now the ranges' ridges stand under the ring's 819 m vertices, so the ring's skyline
  is a few pixels under the ground's on the mean and at most 3.9 pixels over it at 5 bearings of one viewpoint (1080p,
  65 degrees). The middle ring draws the ridges to 11.5 km.
- **Not fixed here: FAR-TREES' band over the middle ring's hills.** The band is drawn last in the far pass with no depth
  among the far layers, so a band tree behind a middle-ring hill is drawn over it: from Bay pixel 2046,325, 300 m up,
  Land View 5, 442 of 3,072 band tree points (14.4%; 21.0% of those the streamed grid leaves). The fix is the band's
  vertex shader marching its sight line over the middle ring's heights (handed as a texture with their frame and the
  eye) and dropping a tree the ground hides - in `render/farTrees.js`, FLORA-GROUND's file, left to it.
- **Pins:** `test/world/reliefpeaks.test.js` (the far views on the kernel's ground; their wiring; with ARENA2 the far
  ring on the freeware's ground). PIN MOVED: `test/render/farlandmark.test.js`, `test/render/farsea1.test.js`,
  `test/render/midring.test.js`, `test/ui/farring.test.js`, `test/scenes/tv3_travellers.test.js`,
  `test/systems/naval/auditcaptsea.test.js`, `test/systems/landform.test.js`,
  `test/world/terrain/auditlandforms.test.js`. Mutants: `tools/mutants/reliefpeaks.json` (the far views' records), and
  the far views' records of `farlandmark.json`, `midring.json`, `auditcaptsea.json`, `auditlandforms.json` and
  `terrainscale1.json` re-aimed by content. Port-Ledger A, RELIEF-PEAKS.

## ROAD-FOLLOW - a road journey keeps to the roads, walked on the road as it is painted (2026-10-27, the owner)

The owner's field report, item 6: *"Road travel is not following roads properly in overworld travel"*; then *"No band
aids or half assed work"* - road travel follows the roads everywhere. Its walled towns' gates are the same record's other
half (`03-World/Town-Shapes.md` ROAD-FOLLOW).

**Measured first** on the freeware (ARENA2, every region of the roads past the Bay laid as the roads' worker lays them,
the host's own route ground, the plan's legs as Travel Options walks them; the share of a walk on the painted road is
its length within a tile of the road the terrain paints - the Bay's straight bands, VOYAGER2's curves past it). Two
faults, both past the Bay; the Bay's plans were 100% on the road and are unchanged.

- **THE WALK AND THE LINE CUT EVERY BEND.** A road leg walks its lane pixel middle to pixel middle (OW-ROAD-TRUE), and the
  drawn line joins the same middles - Basic Roads' geometry, a band from the middle to each edge. Past the Bay a bend is
  painted as one curve (VOYAGER2), 0.125 of a pixel (102 m) inside the middle at 45 degrees and 0.177 (145 m) at a right
  angle, and the road is two tiles (12.8 m) wide: the party walked the grass inside every bend. 12 to 17% of every road
  journey's walk past the Bay lay off the painted road (Kvatch to Leyawiin 88.1% on it, the Imperial City to Bruma 84.7%)
  where the plan's own steps were 97 to 100% road; the real Travel Options walk of a road bending four times stood 16
  tiles off it at every bend. VOYAGER2.1's OPEN, above.
- **THE PLAN LEFT THE ROADS NEAR ITS ENDS.** The roads' search (ROAD-BEYOND) walked the open ground anywhere within
  BY_ROAD_REACH (24 pixels, 20 km) of either end, at 3.5 a step against a road's 1: of 30 journeys between random places
  past the Bay, 17 left the roads mid-way - 25 stretches across a field, 23 of them where one piece of the roads joined
  both sides (the roads round them 3.3 to 133.5 times the field's length), every one within 24 pixels of an end. TV2's
  law did the same on the Bay's ladder (a field's hop taken over a road round it more than three and a half times
  longer), and past the Bay it asked the ladder whenever the roads were dearer than the straight walk and kept its cut.

  The 2 stretches left were gaps: Adavi's and Tiberdes' roads (14 and 22 pixels) join no other road. Bemitor to Saurtja
  (the Bay to Hammerfell's south) walked 413 pixels across country - the roads' search ran out its spend against the
  Taneth network's gap, and the ladder too.

**What holds now.**

- **The walk on the curves** (`systems/travel/roadLine.js`): a route's pixel past the Bay that it turns in, one road (or
  one track) in and out, is walked on the curve its byte paints between the two edges it crosses
  (`roadLine.js:"export function routeCurveAt"`): the leg that ends there ends at the curve's apex,
  and the next walks the curve's second half before its straight run - each such leg carries its `line`, the painted
  road's native points (`roadLine.js:"export function roadLineLegs"`, from
  `travelRoute.js:"return roadLineLegs"`). Travel Options walks a
  line's points as its lane (`travelOptions.js:"return { ax: a.x"`,
  the autopilot's `path`, OW-ROAD-TRUE's pursuit), aims a leg at its line's end (`legEnd`), rejoins a curve at its
  nearest point (`travelOptions.js:"const near = lane?.pts"`) and walks a last
  leg's line to its place or its spot. The drawn line and the forecast run the same points (`routeDrawPoints`' `via`,
  `drawRouteRuns`, `drawOwnRun`). A pair the byte paints no curve for (a T's stem, a junction's turn sharper than 45
  degrees), a way straight through, the Bay's pixels and the route's two ends are the middles they were - on the road.
- **The plan keeps to the roads** (`travelRoute.js:"export function* roadEndsSteps"`). A plan handed the roads
  walks the open ground only on its ends' own legs and across a gap in them:
  - **each end's leg**: none about an end on a road or a track (its pixel carries one - it starts or ends on the road), out
    to ROAD_END_SLACK (2) rings past the nearest road about an end off them (a spot in the field, a dungeon off the road);
  - **the roads' pieces**: the roads are flooded from both legs at once, ROAD_PIECE_CAP (8,192) pixels a side at most. A
    side whose flood runs out first, never meeting the other's, holds roads that join none of the other's - **a gap**: the
    narrowest crossing of the land from them to a road they do not hold (the shortest walk, a diagonal sqrt 2, out to
    BY_ROAD_SEEK) is the plan's to walk (`bridges`), and the flood goes on from its far side.

    Measured: the roads past
    the Bay are 801,136 pixels in 1,820 pieces - the land's network 671,973, the islands' own (Summerset's 58,286,
    Vvardenfell's 24,016, Auridon's 10,046), Taneth's network (4,399, Taneth, Rihad, Saurtja and Tlarpka) and Necrom's
    (3,911) joined to no other; 28 places' roads join no other road, their narrowest crossing 2 to 9 pixels (Taneth's 4,
    Necrom's 2); 11 on islands none within 400.
  - **the searches** walk those legs and crossings alone: the roads' search past the Bay
    (`travelRoute.js:"if (kind < 0 || (kind === 2 && !endLeg(cx, cy, nx, ny)))"`) and the ladder on the Bay
    (`travelRoute.js:"if (kind < 0 || (kind === 2 && endLeg && !endLeg(cx, cy, nx, ny)))"`). A way by the roads
    is kept however much dearer than the straight walk (`travelRoute.js:"if (byRoad) return"`).
  - **no road joins the two** (an end no road comes within BY_ROAD_SEEK of; an island's roads with no crossing; every box
    the ladder holds without a way by them): TV2's cost law, the plan's own again with `costLaw`
    (`travelRoute.js:"if (!best && endLeg)"`),
    then the walk across country as before. FREE mode hands no road and walks the cost law as it did.

**Measured after** (the same sampling, seed 7: 60 tries a set, journeys of 20 to 900 pixels; "no way" a pair the land does
not join or the spend did not reach):

| set | journeys | open steps | open mid-way | walked line on the painted road |
| --- | --- | --- | --- | --- |
| the Bay | 38 / 38 | 0.05% / 0.02% | none / none | 100% / 100% |
| past the Bay | 48 / 49 | 0.99% / 0.13% | 262 in 27 journeys / 43 in 4, every one a gap's crossing | 83.4% / 98.8% |
| the Bay to past it | 53 / 57 | 1.17% / 0.20% | 192 in 22 / 115 in 7, every one a gap's crossing | 89.5% / 99.1% |

The 30 journeys of the first count: 17 left the roads mid-way, 2 now; of 25 stretches across a field 23 were within
one piece of the roads and none is now - the 3 left cross gaps: Adavi's stub to the land's network (5 pixels), and
Tiberdes' stub by another to it (5 and 4). Bemitor to Saurtja walks 728 pixels, 96.5% of its walk on the painted road
(3.2%), the gap to Taneth's network crossed in 19 pixels along a lake's north shore. The walk on the curves (the real Travel Options, at a hundred times walking pace and at walking
pace) keeps within a tile of the road at every bend, where it stood 16 tiles off.

**The spend**: the two floods cost a plan by the roads up to 16,384 pixels, more on a gap's crossing (Bemitor to Saurtja
56,000); a Bay plan's ladder walks fewer cells, the field off every box's roads (Daggerfall to Wayrest 92,850 cells to
37,793; Wayrest to Ykalon 193,259 to 57,639); a plan past the Bay more (Kvatch to Leyawiin 49,019 to 63,211; the
Imperial City to Bruma 5,086 to 20,095) - PLAN-SLICES' cells a frame, the same plan.

- **The four hosts**: none grows. `scenes/world.js`'s two lines that draw the route call `roadLine.js` drawRouteRuns and
  drawOwnRun in place of their loops (the same logical lines); `scenes/exterior.js`, `scenes/worldModes.js` and
  `scenes/dungeonContext.js` plan no Overworld route. Nothing crosses the wire.
- **The departures, named**: DFU has no Overworld planner (Travel Options' follow walks Hazelnut's bytes, which the Bay's
  plans walk as before). TV2's cost law - *a road worth a detour of three and a half times its length and no more* - is
  retired where the roads join a journey's two ends: the road round a field is the way (TV2's own pin of a hop across a
  field moved); it stays the law where no road joins them, and FREE's. ROAD-BEYOND's BY_ROAD_REACH and its *TV2's law
  kept* are retired the same way (below, PIN MOVED).
- **A river under the road** (ROAD-LOOK, `03-World/Roads.md`): the plan's water is the map's own water pixels; a river
  CYRODIIL-WATERS carves inside a pixel is none of them, so a road over one is the plan's step as any road's, and walked on
  ROAD-LOOK's bridge where the river is wider than a ford. A water pixel under the Bay's own road (a causeway) is
  stepped onto by that road alone (`travelRoute.js:"=== 0 && isWater"`,
  main's RPT1026-WORLD CAUSEWAY), never a track's ford; roadEndsSteps' crossing of a gap walks no water pixel.
- **OPEN**: a turn the painter draws no curve for (VOYAGER2's junction law pairs only turns of 45 degrees or less) is
  walked through the middle, as the lane walked it - off the paint by up to half the road's width at a sharp junction
  turn (ROAD-SMOOTH, below, measured it: up to 10 tiles, at 9% of the turning pixels past the Bay - the painter's to
  close). Woodhearth's road grazes two pieces of its wall (`03-World/Town-Shapes.md` ROAD-FOLLOW).
- Pins `test/systems/travel/road_follow.test.js` (6), `test/systems/travel/tv2_click_to_move.test.js` (ROAD-FOLLOW route,
  and the U's hop PIN MOVED), `test/systems/travel/road_beyond.test.js` (PIN MOVED: the dials - BY_ROAD_REACH gone,
  ROAD_END_SLACK and ROAD_PIECE_CAP; the road round the field kept, not the ladder's cut; the roads' own search crossing a
  broken road's gap; the roads first only where they join). Mutants `tools/mutants/road_follow.json` (52); re-aimed by
  content: AOWR-L2-2-line-drawn-straight, AOWR-L2-3-ring-approach-unlaned, OW-ROADSIDE-join-ignored, OW-ROADSIDE-drawn-beside,
  ORT-lane-from-the-joins-point, ROAD-BEYOND-no-roads-first, ROAD-BEYOND-the-ends-open-ground-everywhere,
  ROAD-BEYOND-the-seek-unasked, TV2-a-new-autopilot-each-leg, VOYAGER2.1-the-reader-unread; ROAD-BEYOND-the-dearer-road-kept
  (its law retired) now ROAD-FOLLOW-the-cut-across-the-field-kept.

## OW-BEYOND-KNOWN - the Overworld's places past the Bay, known as the Bay's are (2026-10-28, the field)

The field, the day TESA shipped: *"travel nodes dont exist outside the bay in overworld, so you cant click on a town node
to travel"*.

**What stood.** A plate on the Overworld - TV2's grid, TV5's edge, the junction map's dot - is a known place
(`mapPlacesHost.js:"const tvPlaceSummary"`). On the Bay that is DFU's law: MAPS.BSA's baked
Discovered bit, which every town of the Bay carries. Past the Bay no place is a row of MAPS.BSA, so only a place the
player had walked into was known, and the land past the Bay wore no plate to click.

**What it is now.** A place past the Bay is known by its kind, as the Bay's rows bake it
(`discovery.js:"export const BAKED_KNOWN_TYPES"`): every kind MAPS.BSA bakes found on every one of its 15,251 rows - city,
town, village, farm, manor, poor home, inn, temple, cult and ship. A labyrinth, a ruin, a keep and a coven are never baked
found, and a graveyard 191 times in 774, so each is still found first. Not a DFU member: DFU's map stops at the Bay.

- A CAPITAL IS ONE TOWN (IC-GRAND, `livingIndex.js:"export const capitalStreet"`): known by its centre alone, its other
  slices its streets - the Imperial City one plate, never 49.
- A place not standing is read off its row for its kind (a roll, kept a pixel), and nothing is stood to answer a list.
  Measured on the freeware: a cold grid of 49 pixels 4 ms, a warm one 0.4 ms, the countryside's rates 87 ms once. The
  ids-only precheck (`idsOnPixel`) is retired with it: every pixel past the Bay could hold a countryside place.
- THE HOSTS: `scenes/world.js` reads it through the places host (travelViewPlaces, travelViewFarPlaces, the junction map,
  a passage's master); no other host keeps an Overworld.

Pins: `test/systems/travel/owbeyondknown.test.js` (the law on MAPS.BSA's own rows; the summary over every kind, standing or
not; on the player's data a village of Skyrim's grid and edge with nothing found, and the Imperial City one plate) -
`tools/mutants/owbeyondknown.json` (5, all dead). PINS MOVED: `test/scenes/bayleft_places.test.js` (the found law a lair's;
the real village, Solitude's centre and hamlet known by their kinds), `test/audit_tesa.test.js` (A2-3's source); records
re-aimed by content: `bayleftmaps.json` (5), `audittesa.json` (1), all dead.

## ROAD-SMOOTH - a road journey walked smoothly on its curves, with no stop at a leg (2026-10-28, the owner)

The owner, after the Tamriel update: *"Road pathfinding is still very lanky"* - janky - and no more said. Finding it was
ours.

**Measured first** (`tools/roadWalkProbe.mjs`, the freeware): the roads past the Bay laid as the roads' worker lays them,
every region with land (272,967 road and 568,822 track pixels); the Bay's arrays; the host's route ground; seed 7's
journeys - 30 past the Bay, 25 on the Bay and 28 from the Bay past it with a way by land, and five named (the Imperial
City to Bruma, Kvatch to Leyawiin, Whiterun to Riften, Skingrad to Bravil, Mournhold to Tear). Each was walked by the real
Travel Options through its own `update`, a body flown 433 units a frame (a hundred times walking pace at 60 frames a
second) and 1,300 (a slow frame). The plan was sound: its cost within 0.15% of the roads' cheapest on average (1.8% at
the worst), and no open step past the Bay between two ends on the roads. The walk was not.

- **A CUT EVERY 120 METRES.** ROAD-FOLLOW walks a painted curve as its 32 runs, and the lane cut the force to land on
  every run's end - AUDIT OW-REVISITED L2-4's law, made for a corner: 8.45 cut frames a km past the Bay against the
  Bay's 0.09, the pace 0.958 of a whole walk's (0.870 at a slow frame).
- **THE HEADING SWUNG BACK AND FORTH.** The look ahead was three of the last frame's steps, so a cut step shortened the
  next look and turned the aim back: 6.09 reversals of the heading a km past the Bay where the Bay has 0.24, the walk
  turning 22.8 degrees a km where the road turns 15.8 (31.0 at a slow frame).
- **A FRAME STOOD AT EVERY LEG.** A leg's arrival drives nothing (the host walks no step on it), and past the Bay every
  bend is a leg: 0.31 frames stood a km. Each new leg forgot the body's step, so its first frame looked a path's width
  ahead - a jerk at every leg.
- **A ROAD ONTO A TRACK AT A BEND** walked the pixel's middle, off both: 78 of the 153 such pixels in the journeys had
  one of the two painted through both edges, up to 24 tiles off.

**What holds now** (`systems/travel/travelAutopilot.js`, `systems/travel/travelOptions.js`, `systems/travel/roadLine.js`):

- **A corner is a turn** (`travelAutopilot.js:"export const LANE_CORNER_TURN"`): a point of a road's line that
  turns 22.5 degrees or more. Basic Roads' kinks turn 45 or 90; a painted curve's runs turn under 4. The force is cut, and
  the aim stopped, at a corner alone (`travelAutopilot.js:"const cut ="`). A street's line (OW-TOWN-WALK)
  keeps every point a corner, as it was.
- **A whole frame's reach** (`travelAutopilot.js:"measureWalk(worldX, worldZ) {"`): the step over the share of the force
  the walk asked, kept while the body stands. It is one body's walk, handed from leg to leg (`walk`), a place's and a
  spot's last leg too.
- **On through a curve's apex**: a leg that ends inside a curve is handed the next leg's line
  (`travelOptions.js:"const after = lane"`); its end is no
  corner then, and the aim looks on along it (`travelAutopilot.js:"export function pathPursuit"`).
- **No stop at a leg** (`travelOptions.js:"k = 0; drive.arrived"`): a routed
  leg's end goes on to the next leg's drive in the same frame, up to LEG_CHAIN_MAX (8) legs. The mod's own journeys keep
  their stop.
- **Either kind's paint** (`roadLine.js:"for (const kind of new Set([a, b, a === 'road' ? 'track' : 'road']))"`): at a
  turn, the curve the road or the track paints through both edges, the step in's kind first.

**Measured after** (the same journeys; before / after):

| journeys (a frame's step) | the pace kept | frames cut a km | frames stood a km | turning, degrees a km (the road's) | the heading's reversals a km |
| --- | --- | --- | --- | --- | --- |
| past the Bay, 30 (433) | 0.958 / 1.000 | 8.45 / 0.01 | 0.31 / 0 | 22.8 / 16.3 (15.8) | 6.09 / 0.19 |
| past the Bay, 30 (1,300) | 0.870 / 0.999 | 7.81 / 0.03 | 0.31 / 0 | 31.0 / 16.2 (15.8) | 8.22 / 0.19 |
| the five named (433) | 0.962 / 1.000 | 7.36 / 0.01 | 0.25 / 0 | 18.6 / 12.6 (12.6) | 5.76 / 0.16 |
| the Bay to past it, 28 (433) | 0.975 / 1.000 | 4.49 / 0.04 | 0.30 / 0 | 18.7 / 15.2 (15.0) | 3.49 / 0.19 |
| the Bay, 25 (433) | 0.996 / 1.000 | 0.09 / 0.08 | 0.34 / 0 | 17.3 / 17.3 (16.9) | 0.24 / 0.24 |

The pace is the share of a whole walk's distance kept (a track's leg at its own pace). The Bay's corners are still cut to
land on, as they must be. Within a tile of the painted road past the Bay: 98.7% of the walk before, 98.9% now - the rest
is the OPEN below.

- **The four hosts**: `scenes/world.js` WIRED, no line changed - its journeys are Travel Options' (`travelViewRouteTo`,
  `travelViewWalkTo`), and First-Person Travel's routed journeys (TO-ROADS) walk the same lane; `scenes/exterior.js`,
  `scenes/worldModes.js` and `scenes/dungeonContext.js` walk no routed leg. Nothing crosses the wire.
- **The departures, named**: PlayerAutoPilot.cs Update returns at an arrival before it applies the force (:80-84); a
  routed leg's end now goes on in the frame. OW-ROAD-TRUE's force cut is a corner's alone. Port-Ledger row ROAD-SMOOTH.
- **OPEN, the painter's**: 494 of the journeys' 5,412 turning pixels past the Bay (9.1%) turn where VOYAGER2's junction
  law paints no way between the two arms - a turn sharper than 45 degrees whose arms both run on in curves (161 of them
  hairpins of 135 degrees). The walk crosses the junction's paved middle, up to 10 tiles (64 m) off the paint:
  ROAD-FOLLOW's "half the road's width" was low. 75 more turn from a road onto a track that neither paints through both
  edges. A way for every turn the network makes is the painter's to draw (`roadCurves.js` curvesOf: an arm to the hub
  for every bit at a junction) - a change to every junction's look past the Bay, for the owner to choose.
- Pins `test/systems/travel/road_smooth.test.js` (7); mutants `tools/mutants/road_smooth.json` (14, all dead). PIN MOVED
  (ROAD-SMOOTH): `test/systems/travel/road_follow.test.js` - a road onto a track, both painted through the bend, walks
  its curve. Records re-aimed by content, each dead: AOWR-L2-4-force-never-cut, AOWR-L1-2-look-uncapped,
  AOWR-L2-1-place-line-ends-at-road, AOWR-L2-2-spot-unlaned, ORT-look-never-grown, ORT-look-no-ceiling,
  ORT-step-unmeasured, ORT-last-leg-unlaned, OTW-aim-stops-at-corner, TV2-a-new-autopilot-each-leg, RF-the-kinds-unread
  (road_smooth's pins added). Every record on the three files judged again: 198, all dead but the two recorded
  equivalent.

## GREEDY-BEYOND - a long walk past the Bay leans on its goal when its count runs out (2026-10-28, the owner)

The owner, of the Imperial City refused from Daggerfall (OW-PLACE-WALK's OPEN, `03-World/Arena-Provinces.md`): *"Yes fix
that"*.

**What stood.** An all-open plan past the Bay is A* at the field's price, and on open ground every monotone path costs the
same: the cells between the two ends form a parallelogram of equal estimates. When a detour near the goal makes the true
cost even a little dearer, A* must expand all of it. Daggerfall to the Imperial City, round Lake Rumare's west arm, costs
7,574 and needs 529,694 cells; the count past the Bay is 100,000 (ROAD-BEYOND), so it said "There is no way there by
land." On the freeware's ground with no roads past the Bay landed, 105 trips between the cities: 76 refused, 21 of them
truly (no land joins them, by a flood under the planner's step law), about 55 falsely.

**What it is now.** A plan past the Bay with no boat that spent its whole count asks once more, as a weighted A*
(`travelRoute.js:"export const BEYOND_GREED"`), with its own count, in the widest rung's box. A plan that finds its
way inside the count is the same plan at the same count; a box that held no way is not searched again. Measured: Daggerfall
to the Imperial City 7,900 (the cheapest 7,574), Bruma, Solitude, Windhelm and Leyawiin to it as well; of the 105 trips, 42
false refusals answered and 13 left, where a lean of 2 left 25. On 40 random trips over land, whose cheapest was measured
uncapped, the worst detour was 9.7 per cent; on a wall across the goal's own row, open 200 pixels above it, 18 (the
pin's wall, open 80 above, 7.3).

- **OPEN**: the 13 left are the box's, not the count's: their only way runs more than BEYOND_MARGIN (240 pixels) outside
  both ends - Anvil to Bravil and Torval to Leyawiin round the Niben's water, uncapped no way inside the box. Widening it
  is the owner's call (a wider rung is a dearer refusal).
- The hosts: none changes; the planner is the Overworld's, the held map's journey and its own click alike.
- Pins `test/systems/travel/greedy_beyond.test.js` (4, the last with ARENA2); mutants `tools/mutants/greedybeyond.json`
  (7, all dead). PIN MOVED: ROAD-BEYOND's spend (`road_beyond.test.js`): a no-way plan's count adds the lean's.

## FAR-RINGS - a far route rung by the footprints past the Bay, never their stamps (2026-10-28, the owner)

The owner: *"when planning a really far away route, the game comes to a halt and really lags"*. Measured in the game on
the freeware (a CPU profile of Daggerfall to the Imperial City): one task of 17.7 s as the plan landed, 14.5 s of it in
`routeLegs` asking every pixel of the route for its town's ring (OW-TOWN-RING) - `tvTownRects` stamped each place's tiles to
read its rect, and past the Bay a place not built yet has its blocks generated to be stamped (the Imperial City's slices,
its districts and fabric, 11.9 s).

Past the Bay a place not built is now rung by its footprint (`terrainTiles.js:"export function locationFootprintRect(dfLocation) {"`,
LANDFORM4's: the block grid and the clearance, off the map table), which holds every tile the stamp could. The Bay's places
keep their stamped rect (their blocks are BLOCKS.BSA's, and the painted ring roads follow it), a built pixel its build's.
`bootWorld` does not grow. Pin `test/scenes/far_rings.test.js`. PIN MOVED: OW-TOWN-RING's host rect (`ow_wod.test.js`) - the
merge missed it, and main's deploy failed on it.

GREEDY-BEYOND's mutants' sweep (its fallback asked of the planner's 126 records): one record its own (no-walk-across-country,
killed by the lean asked of an all-open plan alone); two old ones killed by new pins (ROAD-BEYOND-no-greed on a road lattice,
-no-layer-still-searched over the Bay's roads); four recorded equivalent with why (TV-BEYOND's two box records, ROAD-BEYOND's
step edge, AUDIT STARTS V4's pad). OPEN: road_follow's RF-the-ends-legs-everywhere hangs its tests on main too (an end's leg
of Infinity loops), so it is no verdict; its record wants a finite mutant.
