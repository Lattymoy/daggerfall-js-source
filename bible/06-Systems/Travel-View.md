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

- **The journey exists.** `systems/travelOptions.js` runs Travel Options' Update in its
  own order: the autopilot (`systems/travelAutopilot.js`) turns and drives the real
  motor, `systems/travelSteer.js` casts three feelers round obstacles (TRAVEL-NAV),
  `systems/timeScale.js` scales the step, and a journey stops for enemies, a window, a
  disease, the ocean, arrival (`interruptTravel` keeps the destination for the resume
  prompt). The held map already starts a walked journey at a bare pixel
  (`beginTravelToCoords`, MAP2).
- **Roads exist; a route planner does not.** Hazelnut's four 500,000-byte masks, one
  compass byte per map pixel (`vendor/roads-hazelnut/`, `systems/travelPaths.js`), and
  the follow key walks junction to junction; a named trip goes straight
  (`Travel-Options.md` TO-FIELD: "The mod does not route along roads to a named
  destination and never did"). The pieces for a planner are in the tree:
  `ui/overworldModel.js traceChains` (1,508 road chains, 4,289 track chains) and
  `world/roadNetwork.js route()` (a pixel-grid A* that refuses water and prices climbs).
- **The raised eye exists.** The render eye (`mwv.eye`) is already separate from
  `cam.pos` (`scenes/world.js`), and `cam.pos` is what streaming, the ±500 m vertical
  re-centre, the weather sample, rain, grass and the wind follow. The travel camera is a
  RENDER eye; `cam.pos` stays on the player, so the world keeps streaming and the
  weather keeps being read where the player is. The tap ray unprojects through the last
  frame's projection and view, so a click works from any camera.
- **The weather is a field.** WEATHER3's `weatherAt(x, z, minute)`
  (`systems/weatherMap.js`): 400-700 systems born, drifting, growing and dying over the
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
   is up (no combat, no HUD work).
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
- `src/ui/travelViewHud.js` - the READOUT: the traveller's ring and chevron on the
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
| Tilt | 30-75 degrees down, default 52 | the design's 45-60 widened so a drag can look out to the far ring or straight down on a town |
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
  of the camera is full of it, as it is when you stand in it.

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

**Proof.** `test/tv1_travel_view.test.js` (18), the heldmap door pin (+1),
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

**By the roads** (`systems/travelRoute.js`). A* over the 1000x500 grid on Hazelnut's bytes -
the very bytes Travel Options' follow key walks - with a step ON the road only where both
ends carry the edge; a road 1, a track 1.6, the open 3.5 (x sqrt 2 diagonally); the sea
refused (roadsProducer's WATER_BYTE); a straight run on one kind of ground folded into one
leg. It walks roads; `world/roadNetwork.js route()` lays them - two laws, one compass.

**The journeys are Travel Options'.** Two of the port's own (Ledger A, "THE TRAVEL VIEW'S
JOURNEYS"), built from the mod's parts: `beginTravelAlongRoute` (each leg a pixel's middle,
the SAME autopilot re-aimed leg after leg - BeginPathTravel's own InitTargetRect - a road leg
reckless, a track or the open cautious, the last leg the place itself with the arrival
buffer; a NAMED journey, so LocationPause and the resume prompt know it; interrupted, it
resumes from the nearest leg ahead) and `beginTravelToPoint` (a path's width about the spot).
Every stop the mod's Update makes still stops them. Under the view the arrival is SAID on the
notice line, not boxed: a box is a window, and a window brings the view down.

**The cap, measured live** (`systems/travelGovernor.js`). TV0 planned a probe riding a long
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

**Proof.** `test/tv2_click_to_move.test.js` (17), `tools/mutants/tv2.json` (20 dead),
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

**Proof.** `test/tv3_travellers.test.js` (15, over a real Room through `test/fakeRoom.mjs`),
`tools/mutants/tv3.json` (20 dead), the SLAM8 row for world122 in
`test/relayversion.test.js`.

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
already the clouds' own; the pin holds the arithmetic.

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

**Proof.** `test/tv4_weather_above.test.js` (8), `tools/mutants/tv4.json` (12 dead),
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
- **B3 touch.** The view takes pointer events; `ui/touch.js` listens to TOUCH events on the
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
that falls on the neighbour pixel still takes the town (A5, the 3x3 asked).

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
AS SHIPPED; the arc's evidence now: `test/tv1_travel_view.test.js` 26,
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
   tests that hold its far-plane law today (`test/farring.test.js`, `test/perf2.test.js`).
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
  (WB1's ring), a hub (HUB1) can be marks the same way the places and travellers are.
- **Travellers who say more.** The TV3 mark is seven keys and the relay refuses an eighth -
  on purpose. A later field (a guild tag's colour, "looking for company") is a new relay
  version and a new key, never a squeeze into these.
- **The weather forecast from the air.** `forecastAt` (WEATHER3) is a pure function of place
  and minute; the view could hang a system's next hour under its curtain.
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

**How** (`systems/travelFarPlaces.js`, pure): `settlementPixels` gathers the world's
settlements once from the host's pixel index; `farPlaces` picks them by Chebyshev distance
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

**Proof.** `test/tv5_far_places.test.js`, `tools/mutants/tv5.json` (the TV5, EDGE-DECLUTTER and
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
  on the readout's one canvas (`ui/travelViewHud.js` `drawMarks`); each label is a sprite
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
`test/tv5_far_places.test.js` (the screen read counted, the redraw skipped at rest and taken
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
**Proof.** `test/fb0929_farroute.test.js` (4: the planner on the vendored roads, the host's line
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

**Proof.** `test/tv1_travel_view.test.js` 30, `tv2_click_to_move` 21, `tv3_travellers` 21,
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
reads in play (`badgeSprite`, off `ui/playerBadge.js`, `net/renown.js`, `net/guildLaw.js` - the
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

**Proof.** `test/tv3_travellers.test.js` (the wire, the book, the host's marks and the names
standing down), `test/tv5_far_places.test.js` (the marker's face: the title above in its colour,
the Renown amber, the party's green, the tag's steel, a stranger's bone, a title won at rest
redrawn); `tools/mutants/tv3.json` and `tv5.json` (the OVERWORLD-NAMES records).

## OW FIXES - the first field report on the Overworld (2026-09-28, Mac)

- **RESUME-OUT** ("option persists"): the held map asked "Resume your journey to ...?" at EVERY open while a
  stopped journey was pending - the mod's own behaviour (TravelOptionsMapWindow.cs: No closes the box and keeps
  `DestinationName`), with no way to be rid of it. The prompt now has a third answer, **Forget it**, which ends the
  journey through the mod's own `ClearTravelDestination` (`onForgetTravel`); Resume and Not now are the mod's.
- **OW-THEME** ("The overworld ui needs to follow enhanced ui theme"): the bar (`.tview-bar`, the journey bar's
  window role), its Return (`.tview-back`, a button) and its compass (`.tview-compass`, a well) are in the Enhanced
  Plus frame roles (`ui/enhancedFrame.js` FRAME_ROLES - paint only), and the canvas's plates are drawn in the
  theme's own stone (`themePlate`: the page's `--slate` at 0.78 alpha, read at each open; a new stone lets
  the old plate images go).
- **OW-BIG** ("The player sprite needs to appear larger. Like it shouldnt be at the tiny scale"): under the view the
  traveller's own sprite is drawn `tvOwnGrow(distance)` times its size (`player/travelCamera.js`: one more for every
  `TV_OWN_GROW_M` = 32 m from the eye to the feet, never past `TV_OWN_GROW_MAX` = 12, 1 near the ground) - about
  40-50 px tall at 1080p at every zoom, a Mount & Blade party's icon. The view hands the step (`frame().grow`), the
  host passes it on the body's `face`, and the sprite lane (`player/eotbBody.js`) makes its batch again at each whole
  step; a grown sprite casts no giant's shadow (`selfCard` off) and hangs no lantern on a waist that moved.
- **OW-PEERS** (FIELD BUGS 2026-10-01 #11, "you cannot see other player's sprites"): OW-BIG grew the traveller
  alone, so every other player stood at their own size - a speck at 330 m under the name that stood over them. Each
  is grown by the same law at their own feet (world.js `peerGrow`, `tvOwnGrow` of the view's eye to them): the
  riders, the beasts and the walkers (`net/peerRiders.js`, its size, offset and reach), the dolls and the class
  sprites (`net/remotePlayers.js`), the Morrowind bodies (`net/peerBodies.js`, `drawThird`'s `grow` and the view's
  lean, culled by their grown reach); their names over the grown heads; none casts a giant's shadow, no walker hangs
  a lantern. `test/fb1001_overworld.test.js`.
- **OW-WAGON** (WAGON-HITCH, 2026-10-04, Mac: "the wagon when attached to the horse should show in the overworld if
  attached"): the cart's trailing wagon is drawn grown with its rider, about the point it hangs from - mine by the
  view's own step (`frame().grow`, handed to `hcc.draw` as `selfGrow`), another player's by `peerGrow` at their rider.
  A wagon at its own size hung a speck under the grown horse. Only the draw grows; the pose the runtime keeps, parks,
  saves and sends is the wagon's own. Its AUDIT (WAGON-HITCH B1/B2/B7): the grown wagon casts no giant's shadow (the law
  above), finds its ground with a probe that rises with its reach (a hill its own length tall swallowed the mod's fixed
  8 m), and its grown wheels turn g times slower for the same road. `06-Systems/Horse-Cart-And-Cargo.md` WAGON-HITCH, `test/wagonhitch.test.js`.

**Proof.** `test/heldmap.test.js`, `test/tv5_far_places.test.js`, `test/eotb_body.test.js`,
`test/tv1_travel_view.test.js`; `tools/mutants/ow1.json` (14 records, all dead).

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

**Proof.** `test/tv2_click_to_move.test.js` (three more), `tools/mutants/ow2.json` (18 records, all dead).

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

**TV6 BUILT (2026-09-28).** `systems/travelDungeons.js` (pure: `dungeonPixels`, `nearDungeons`, `dungeonToFind`,
`TV_DUNGEON_MAX` 12, `TV_DUNGEON_FIND_M` 1000); the host's `travelViewDungeons` (kept between pixels and finds, a load
forgets it) and `dungeonFindFrame` (four times a second, the enhanced interface outdoors: `discoverLocation`, then
"You have found <name>." on the screen); a found dungeon past the grid is a far plate (its name, its distance, a
journey - within the grid TV2's own plate), the rest are the readout's LAIR look - a dull red point and a "?", no
journey, never held at the edge. Proof: `test/tv6_dungeons.test.js`, `tools/mutants/tv6.json` (14 records, all dead).

**TV7 BUILT (2026-09-28).** `systems/travelBands.js` (pure): a cell of BAND_CELL_PX (2) map pixels holds a band in a
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
Proof: `test/tv7_bands.test.js`, `tools/mutants/tv7.json` (19 records, all dead).

**TV7b BUILT (2026-09-28) - THE CHASE, SHARED.** The chaser's client says its chases on its own cell foes frame under
`bd` (`[[id, x, z, 1]]`, the band's place in native units) and the bands spent there (`[[id, 0, 0, 2]]`), at most
BANDS_WIRE_MAX (8) - validated at the reader (`validBandWord`), as the World of Daggerfall camps' `st`/`sp` are, never by
the relay (NO relay change). A chase asks for a frame (`bandMoved`, as a moving boat's word does). A reader shows a
peer's chase where it runs (for BAND_WORD_MS after the word; then the band wanders on), never starts its own chase of
that band, and spends every band a peer spent - one band, one fight, everyone's. Two players who saw one band in the
same breath: the lower id keeps it (`chaseYields`), alike on every client.
Proof: `test/tv7_bands.test.js`, `tools/mutants/tv7.json` (33 records, all dead).

**TV8 BUILT (2026-09-28) - GROUP TRAVEL, THE LEADER DRIVES.** `systems/partyWalk.js` (pure). A party leader's Overworld
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
Proof: `test/tv8_party_walk.test.js`, `tools/mutants/tv8.json` (17 records, all dead), `test/relayversion.test.js`
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
  every full frame). Members' paces are their own clients' (a member at x1 behind a leader at x10 falls behind).
  A band's make reads the viewer's level (TV7 BUILT). A traveller on a plateau ringed by cliffs outside the mountains,
  with no road off it, is told there is no way by land.
- Proof: `test/tv2_click_to_move.test.js` (28), `test/tv6_dungeons.test.js` (11), `test/tv7_bands.test.js` (10),
  `test/tv8_party_walk.test.js` (12), `prbow1_bow`, `mwhead1_window`, `eotb_view` (+1 each); `tools/mutants/ow3j.json`
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
  holds); the "historical" example numbers in test/citedrift.test.js move with every citation shift, as they always have.
- Proof: `test/tv2_click_to_move.test.js` (32), `tv6_dungeons` (19), `tv7_bands` (15), `tv8_party_walk` (22),
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
  a route a boat would have made is said ("There is no way there by land - a boat would carry you across the water.").
  SHIP-SAIL (2026-09-28, Mac: "Shouldn't it already function as such?"): unless the place is one the map's ship
  passage sails to from here - then the passage is OFFERED ("Sail there by ship?", its fare and days) and, on Yes,
  taken as the map takes it (`01-Overview/Field-Bugs-2026-09-28e.md`). The passage is Daggerfall's, so it is offered
  with this mod off too (AUDIT 28e); the boat's line is this mod's, said only with it on.
- **The planner's sea** (`systems/travelRoute.js`, `sea`): three layers of the grid - ashore with the boat to hand,
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

  Pinned at 600 m in `test/ows2_crossing.test.js`.

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
Each pinned (`test/ows2_crossing.test.js`, `test/ows3_raiders.test.js`) and each pin made to fail.

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
merge kept that one and dropped this branch's copy in the toggle's listener, and `test/fb0929_overworld_mouse.test.js`
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
`tvWalking`, `tvWalkHoldsTimeScale`, the two nets, the trip line, the keys' ground gate. Proof: `test/tv_wasd.test.js`
(6: the law gate by gate, the words, the world's own governor MOUNTED over the real governor and clock, the nets and the
gate by source), `tools/mutants/tv_wasd.json` (13 dead - two of them on to1's K2 pin, re-aimed because the one strafe
zero in the host is now this gate's, never the journey's). TV2's three pins on the governor's lines and the trip line, and its A2
mutant, re-aimed to the grown lines (never loosened). Ledger A (continued): THE OVERWORLD'S MOVEMENT KEYS TRAVEL.

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

Proof: `test/ow_toggle.test.js` (6: the key; the host's doors MOUNTED from their own source over the real settings
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

Proof: `test/fb0929d_toroads.test.js` (6: the key; REPRODUCED and fixed on world.js's doors and the Overworld's route
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
(`test/ow5_audit.test.js`, 14, beside the suites below) and each pin fails under its mutation (`tools/mutants/ow5.json`).

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
  born a pixel past the edge and sailed off the world; the raiders' sea is on the map. S6: a world being moved holds the
  chase (the bands' D2). S7 is D4. S8: no Come Sail Away, no boat to be at sea in - no raider is drawn (the bands' B6).
- **Known, not changed** (the first two since answered: OW6's raider word and OW6L's cell ledger, below). A raider's
  chase is still the chased traveller's own and not said to the others (TV7b's word has no sea half): a helmsman and a friend on their own boat nearby may each be chased by the same sail. The spawn
  ledger is one client's memory (TTL1's own note): two players can disagree whether a spawn is gone, and gone is now for
  good on the client that saw it go. With the view down no band first sees anyone or stands but a chase it began (TV7
  BUILT); a band stood 140 m off with the view down sees 60 m, so it waits to be come across as a camp does. A wanderer's
  position stays a quarter second old when the shared clock steps backward (`_bandPos`), and the marks' preventEnemySpawns
  hide seldom fires (the flag lives a frame) - both harmless.
- Proof: `test/to1_travelOptions.test.js` (+1), `tv7_bands` (+7: the contact asked first, an x40 journey stopped the
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

- **The bands vary and roam (systems/travelBands.js).** BAND_CHANCE_DAY 0.3 -> 0.45 and BAND_CHANCE_NIGHT 0.45 -> 0.6
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
- **The journey slows as enemies close (systems/travelThreat.js; the third ask).** The clock is held so the traveller
  always has THREAT_WARN_S (0.6 s: 5 at launch, 2 at OW6-LATE, 1.2 at OW6-NEAR, FB 29g, 0.6 at OW6-HALF, FB 2026-10-01c) of real time before the nearest enemy's REACH along their way - a band's sight, a
  raider's lookout (at sea), any hostile foe's sight (a camp's sixty metres, CAMP-SIGHT), or, for a chaser, its contact
  ring from any side at its own pace too (`metresToReach`, `threatCap`); stepped down the spinner's own ladder (1, 2, 3,
  4, 5, then fives), never under walking pace (the encounter stops a journey - AUDIT OW5b E1 - the governor only slows
  it). An enemy the way passes by, or one behind, holds nothing; inside a reach the journey is held while the way goes
  deeper and free as it leads out. Under the view the lower of TV2's ground cap and this one holds; on the classic skin
  (no governor there before) the mod's own ask under the enemies' cap alone, handed back whole with nothing near. The
  panel says why it is held (TRAVEL_HELD_WHY: "while the land loads", "with enemies near", and "until the Overworld
  rises" for AUDIT OW4 J5's walking pace with the view down, which had said the land was loading), and a line is said
  once as an enemy begins to hold the journey ("Enemies near - you slow your pace."). Since the merge with main: its
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
- **The cell keeps the Overworld's ledger (OW6L, the relay - world127; net/overworldLaw.js).** What stays true after the
  moment: a band or raider spent, and a spawned dungeon's clocks. TV7b's word reached three pixels, that minute - a band
  fought was back for whoever came later in its life - and the spawn ledger was each client's own (TTL1's own note: two
  players disagreed for days whether a spawn stood). Each CELL ROOM now keeps a ledger: the spent ids (their own life
  and the next), and a row a spawned pixel - `[px, py, seen, cleared?]` in shared classic minutes, MIN-MERGED, so the
  earliest sight and the earliest clear anyone had win (the spawn ledger's `merge`), kept sixty real days. A player's
  spends and first sights and clears are owed to the cell until it takes them (world.js `overworldLedgerFrame`: said a
  second apart, what was not taken said again, nothing to an older relay), and every change is said to everyone in the
  cell - and the whole ledger to a player who walks in later, in its welcome (a halo's too, for the seam). The relay
  checks each word against the cell's square (8 pixels of margin), the spawn roll itself and the clocks, on its own
  bucket and fan budget, and answers a speaker whose row is BEHIND with its own (RAID3's law). Its numbers are pinned
  equal to their homes rather than imported (gateLaw.js's own way), so the relay's graph stays flat. RELAY_VERSION
  world127 - 125 was VOICE1's and 126 DISCORD-GATES', never reused; a client reads `relaySupportsOverworld` and says
  nothing to an older relay (which would close the socket on the frame): it needs the relay deploy that ships with it.
- **Known, not changed.** A live CHASE's place still rides the foes frame alone - the relay fans it three pixels while
  bands are drawn to six (TV7b's own recorded limit) - so a viewer between three and six pixels from a chaser sees the band at its own
  wander; that it was spent reaches them through the cell. The relay cannot verify when a pixel was first seen: a
  modified client could make its cell's spawns run out early (bounded by the margin, the roll, the keep and the bucket).
  A raider dragged far past its own cell by a long chase is not told to the escaping player's cell (the session leaves
  out what the cell would strike). A camp is shared with the players its owner's frames reach (the relay's three
  pixels), and its mark is drawn where its living members stand. One pre-existing mutant survivor was found on the way,
  outside this work: auditqp.json's AQP-touched-cell-my-roll (the owner's record already carries the maximum it resets).
- Proof: `test/ow6_bands.test.js` (6), `ow6_slowdown` (8: the law, a rider at x40, the host governor run on both skins),
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
  the faces, the giant's included (`test/audit_wod_branch.test.js`, `test/colliderkeys.test.js`, `test/ow_wod.test.js`).
  One entry a face however wide, so B1's memory law holds. The tree is built inside the pixel's build
  (`collider.settle`, 7 to 32 ms warm on the stand-in's 2,880 and 11,497 faces), never by a frame in play; a later mesh
  raises it again on the query that needs it. And the road-clearance walk (`world/roadClearance.js boxNearPath`) asks
  only the map's own pixels: the giant's box spans thousands of pixels each way, mostly off the map, and the walk took
  46 to 121 ms of main thread a mountain pixel's build.
- **OW-WOD-PATH, the route through the massif (2).** The Overworld's planner (`systems/travelRoute.js`) knew only the
  MAPS climate's peaks (OW-MOUNTAINS: Mountain, 226, and a steep step), so a route walked straight into a WOD massif and
  the walker ground against its rocks - where the lag was. `WodWorld.mountainPixels` marks the pixels a Mountains
  instance names (2,492 on the shipped list; three more lie off the map), the host drops those a road or a track crosses
  (the mod never stands a site on a path's pixel, LocationLoader.cs:146-151), and `routeGround.setRocks` makes them
  peaks: an open step into one is refused, the start's own is walked out of, a spot inside one is refused as among the
  peaks. The rock fields are not massifs (their pieces within ~350 m; a tenth of the map) - the traveller's steering
  rounds them. A massif's rocks reach past its pixel; the pixel is what the planner refuses, the steering the rest.
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

**Left as it is, recorded.** The planner still prices no climb on open ground: its terrain law is OW-MOUNTAINS' - the
Mountain climate and a steep step (TV_STEEP_RISE 16) between two pixels' small-heightmap bytes. MountainWoods (230),
a rise under 16 a pixel however long, and the large heightmap's relief inside a pixel pass it. The heightmaps are the
player's own (WOODS.WLD); none is in this workspace, so no threshold was tuned blind. A journey that starts inside a
town joins its first road from the pixel's middle, as before.

**Proof.** `test/ow_wod.test.js` (10), `tools/mutants/owwod.json` (18, all dead); the collider's own pins moved to the
tree (`test/audit_wod_branch.test.js`, `test/colliderkeys.test.js`), the hosts' lifted code and pins to the new lines.

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
Gathering (`systems/travelViewFilters.js`); drawn by `ui/travelViewHud.js` (look `gather`, `m.color`); fed beside the
camps in `scenes/world.js` travelViewMarks. Not pickable - a click there falls to the ground and walks to it. See
`06-Systems/Professions-Arc.md` (MORE-NODES, GATHER-OW). Pins `test/gatherow.test.js`.

## OW-CROWD - the region's travellers decluttered (2026-10-02, Mac)

Mac: *"Can we also find a way to reduce the overwhelming player markers that flood the screen? I like it, dont get me
wrong, but there must be a way to make it where its not overwhelming"*. Every player of the region was their own mark
wearing their whole badge (the title, the Renown, the name, the guild's tag, the glyphs - OVERWORLD NAMES), and each off
the picture their own arrow at the edge. Now, as the marks are placed on the screen (`ui/travelViewHud.js`
declutterTravellers, between the placement and the edges' spread): travellers drawn within TV_CROWD_PX (36 px) of one
another are one mark at their middle, a larger dot named "N travellers"; arrows at the edge within TV_CROWD_EDGE_PX
(56 px) one arrow, the nearest's place and way; and of those still alone in the picture only the TV_BADGES_MAX (6)
nearest my own mark wear their badge - the rest their name. My party (kind `party`), the places, the dungeons, the
enemies, the gathering groups and the journey's end are never folded nor stripped. The Travellers filter's count is
still every traveller. Pins `test/owcrowd.test.js`; mutants `tools/mutants/owcrowd.json`.

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

The Overworld's block gains a Players section (Friends, Guild, Others, the least Renown) and the node reach (any, 0.5,
1, 2 km) - one store with the travel map's (`systems/travelViewFilters.js`); a friend's name is drawn in the friends'
blue and a guild-mate's in violet; a town whose gate stands a carriage driver wears a brass wheel; a seat's plate under
the pointer shows its card (who holds it, this week's battle) - made only for the hovered plate, measured once, never
over the block's own controls, and not on a touch screen (no hover there). On a touch screen the filters scroll within
their section. Every new field a mark carries rides `scenes/travelView.js`
through to the readout. The rider's Eye Of The Beholder sprite faces its travel again: a gallop under the time scale had
been read as a placing every frame (ARENA-FIX 14's -1, painted as orientation 7). The record:
`01-Overview/Field-Bugs-2026-10-04e.md`.

## WILD-ALERT - the wilderness notices a fast traveller, or it does not (2026-10-04, Mac)

Mac: *"Wilderness enemies now approach/non approach based on distance and a stealth check. Enemies alerted are given an
exclamation point and slow down as they do now, non alerted enemies do not slowdown or bother the player."* Before it a
band chased the moment the traveller crossed its sight (TV7: distance alone), every hostile foe standing about held the
journey's clock for its sight whether it had seen anyone or not (OW6), and DFU's own sweep stopped a journey for any foe
within the classic band (27 m) unaware or not. Now:

- **The check** (`systems/wildAlert.js`, the port's own). An enemy within its reach of a fast traveller - a band's sight
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
  head (`ui/wildMarks.js`, both skins, the HUD lines' outlined gold in the pixel face): it pops in as the foe notices,
  stands while a fast traveller's clock is held for it, and in plain play for `WILD_MARK_S` (3 s) from the notice; never
  in a town, under a window or under the Overworld (whose marks carry it). The layer owns its own end: a standing mark
  arms a watchdog each frame, and a frame that does not come (a host's loop gone) takes it down.

Not changed: the sea's raiders and hostile ships (their lookout is the sea fight's own reach, NAV-H/OWS3), the rest's
enemy check and the travel map's refusal (no journey runs - DFU's own sweep), the city watch. Pins
`test/wildalert.test.js` (10: the law, the store, `foeAlerted`, the gate, the band's notice, the marks lifted and run, the
layer); re-aimed `ow6_slowdown` (a wandering band holds nothing, a chase does; an unaware foe holds nothing), `tv7_bands`,
`encounterplace` (the wanderer's placement check), `camproll`, `camp1_groups`, `waterfoes`, `ow6_camps`, `nav_h_host`,
`tv1_travel_view`, `roadh_missiles`, `exteriorfoes`; `tools/mutants/wildalert.json` (32, all dead); seven older records
re-aimed by content and dead, OW6-S-spent-band-slows retired with the wandering bands' arm it killed.

## WILD-ALERT-FIX - the deep audit's five (2026-10-05)

The deep audit of the branch (each finding verified against the code before the fix) found WILD-ALERT's notice half
done; each is fixed and pinned (`test/wildalertfix.test.js`, `tools/mutants/wildalertfix.json`).

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

