# The Overworld (Travel View)

A raised, tilted camera over the real streamed world for travelling between places: click or tap to journey by road or
across country, hold the movement keys to travel fast, and watch other travellers, roaming foes, camps, dungeons,
ships and the weather as they really are. It is the real world seen from above, never a second world. The player opens
it from the held map's **Overworld (O)** button, the **O** key on the sheet, or the `TravelView` action (unbound by
default); past the Veil the Eltheric chart wears the same door. Enhanced lane only: the classic lane keeps DFU's map and
fast travel. Its working name in code is the Travel View; "Overworld" is the player's word.

## How it works

**The camera** (`src/player/travelCamera.js`, pure). Height `TV_HEIGHT_MIN`..`TV_HEIGHT_MAX` (150-450 m, default 260),
never above the cloud base less `TV_CLOUD_MARGIN`; tilt 15 to 75 degrees down (default 52); at least `TV_GROUND_CLEAR`
(25 m) above the ground under the eye and a ridge between. It rises in `TV_RISE_S` and falls in `TV_FALL_S` from the
body's own camera. `cam.pos` stays on the player, so streaming, weather sampling, rain, grass and wind all follow the
player; only the render eye is lifted. The fog is measured from the traveller's head (`src/render/fogGlsl.js`
`FOCUS_GLSL`), and the shadow cascades centre on the same point. Flats lean back by half the tilt. The host's machine is
`src/scenes/travelView.js` `createTravelView`; the readout is `src/ui/travel/travelViewHud.js`.

**Seen through the trees** (`src/render/lowPolyTreesGlsl.js` `TREE_SEE`, in `LPT_FS_TEXEL`, both lanes). A 3D tree
between the eye and the traveller's head keeps a quarter of its fragments, by `bayer4`'s screen-door. The window is a
cone about the sight line to the head, open to 0.11 rad and shut by 0.17, easing whole between 12 and 2 m short of the
traveller. It opens only from 3 m over the head, so a bush stays whole, and only as the eye climbs from 12 to 30 m off,
so the rise from a third-person eye pops nothing. Every crown is still drawn and still casts. It cuts every 3D tree on
the renderer's four tree slots, in every province: Low Poly Trees, the jungle, the graht-oaks and the landmarks past
the Bay. A flat (Daggerfall's own trees, a 3D tree's far picture) is drawn whole.

Open: the window clears only the line to the traveller, and the crowns still cover most of the picture from above. How
much more of the canopy to open is the owner's call.

**A click** (a press that moves under 6 px) is a ray from the view's own eye met with the built ground
(`src/player/travelPick.js`). A town or a marker is reached by the roads (`src/systems/travel/travelRoute.js`
`planRoute`, over Hazelnut's Basic Roads masks); open ground is walked straight with Travel Options' steered walk. A
journey on a road walks the road's lane as the terrain paints it, smoothly round its curves. In a town the journey slows
and follows the town's paths. The plan runs in slices of cells across frames (`src/systems/travel/planSlices.js`), never
one long task.

**Pace** (`src/systems/travel/travelPace.js`). Two dials, Speed and Foe-near: `PACE_STEPS` x5 to x100; x100 only on a
road (`ROAD_PACE_MAX`), x60 off it (`OPEN_PACE_MAX`), dropping back at once on leaving the road; the open zone caps
them (`WILD_PACE_CAP`). The dials are available while standing still. Holding a movement key while the view is up and no
journey drives runs the clock at the travel speed. A load governor (`src/systems/travel/travelGovernor.js`) holds the
pace to what the world can stream without holes.

**Foes** (`src/systems/travel/travelThreat.js`). Wilderness foes notice a fast traveller by distance and a stealth check:
an alerted foe wears an exclamation mark and slows the journey to `JOURNEY_FOE_PACE`; an unalerted one does not.
Roaming bands spawn in varying numbers and are shared between players; a camp shows on the Overworld. A chase is seen as
far as its band is drawn (`src/systems/travel/regionChase.js`).

**A band that catches the traveller** stands as foes where it reaches them and stops the journey there
(`src/systems/travel/travelBands.js`). Under the Overworld it stands at `BAND_CONTACT_M` (30 m), on the bearing it was
watched coming from. With the view down it is `BAND_STAND_M` (45 m): every member 33-57 m off, inside its own 60 m sight
(`CAMP_SIGHT_RADIUS`) and past DFU's 10-20 m wilderness ring (`src/systems/encounters.js` `SPAWNER_ARMS`). It keeps its
own bearing only while that lies outside the view, else it stands just outside the view's edge on its own side
(`bandStandBearing`). The edge is the horizontal half-view at the frame's aspect, plus the pack's spread and the
anchor's jitter. In third person the eye stands behind the feet, so the edge turns out further by how far behind.

**Other travellers.** Region-wide from the start: each traveller's mark (pixel, place within it, heading, foot, horse,
cart or ship, and whether a journey drives them) is told on the region's channel, so travellers across the region are
seen, named as in play. A party can travel together.

**The weather** is the real weather field for each place at the shared minute: rain curtains stand under every falling
cell (`src/render/rainCurtains.js`), so two players see the same storm in the same place.

**What is marked.**
- Far places past the streamed grid as edge markers (`src/systems/travel/travelFarPlaces.js`).
- Dungeons within range as their own model, enlarged to a fixed screen size (`src/scenes/travelViewDungeonModels.js`),
  a found one with a plate and a journey, an unfound one a "?" until within a kilometre; past the Bay the land's lairs
  too.
- Quests: the held map's quest marks as gold diamonds, the followed one held at the screen's edge with its distance
  (`src/scenes/travelViewMarks.js`); pressed, a journey there.
- The sea: a crossing moves the traveller onto their boat and back onto land; other players' ships and enemy ships are
  seen.

**The horizon** (`src/scenes/travelHorizon.js`). From the air the view reaches far past the streamed grid in layers: the
far ring, a mid ring and a far field out to mountains some 300 km off, with far flora and trees, all on the kernel's own
ground (`src/render/midRing.js`, `src/render/farField.js`, `src/render/farFlora.js`, `src/render/farTrees.js`).

**Past the Bay.** A journey past the Bay is a Bay journey; only the open zone and the Veil refuse one
(`src/systems/travel/pastBayTravel.js`). A road journey there is searched a road chain at a time, to its network's edge,
and walked on the road's curves (`src/systems/travel/roadLine.js`). A trip with no way by land (across water with no
boat) is refused at once from the land's pieces (`src/systems/travel/landPieces.js`). A long voyage from a province uses
the sea lanes.

**At sea.** A sailed leg arrives anywhere in its window, and a leg across the kernel's land gets marks of its own round
it (`src/systems/travel/seaLegsMend.js`). In the Eltheric Ocean a byte over the sea's height is land, a port isle with
no dry ground in reach is landed on itself, and a plan with one end past the Veil is none. Ashore with a boat to hand,
a plan may walk to the nearest shore and sail the lanes; a boat plan that finds nothing is planned again on foot. The
no-way clock follows a detour, and a dead end ends after 900 game seconds of detours (`src/systems/seaHelm.js`).

**First-person travel.** `GeneralOptions.FirstPersonTravel` (off) brings back Travel Options' accelerated first-person
journey instead of the Overworld; `GeneralOptions.FirstPersonTravelFollowsRoads` (off) makes that journey follow the
roads, as the Overworld's does. Both are on the Travel Options tile and read live.

## Rules

- Mac's four calls: the camera stays below the clouds; a click routes by road to a town or marker and walks straight on
  open ground; the speed is capped to what loads cleanly, the same online and offline; other players are seen
  region-wide from the start.
- Every detail like the weather is 1:1 in this mode (Mac): nothing is invented.
- Travel faster with WASD (Mac).
- First-person travel returns as a switch, off by default (Mac); a second switch follows the roads.
- Speed steps 5 to 100, with 100 only on a road and 60 off it (the players, through the owner).
- A fast traveller slows as alerted foes close; unalerted foes do not bother the player (Mac).
- Each dungeon shows its own model, enlarged, at a fixed size (Mac, the owner).
- Planned routes always follow the road; in a town the Overworld slows and follows the paths (the owner).
- See as far as the eye can see, without hurting performance (the owner).
- Road travel works everywhere in Tamriel (the owner).
- The traveller is seen through the trees over them (Mac).
- The Overworld is wired in `scenes/world.js` alone; the other hosts raise no Overworld.

## Daggerfall Unity

DFU has no raised travel camera, roaming bands or trees seen through. The Overworld drives the port of the Travel
Options mod (`src/systems/travel/travelOptions.js`, `travelAutopilot.js`, `travelSteer.js`). Departures: the mod does
not route a named trip along roads; here a road journey follows the roads and, in a town, the paths (Travel Options'
`PlayerAutoPilot` behaviour changed). The mod's first-person journey is kept behind a switch.

## Code and tests

- `src/scenes/travelView.js`, `src/player/travelCamera.js`, `src/player/travelPick.js` - the view, camera and pick
- `src/systems/travel/` - routes, pace, governor, threats, far places, past-the-Bay law, road lines, plan slices
- `src/scenes/travelHorizon.js`, `src/scenes/travelViewMarks.js`, `src/scenes/travelViewDungeonModels.js` - the
  horizon, quest marks and dungeon models
- `test/systems/travel/tv2_click_to_move.test.js`, `test/systems/travel/tv_wasd.test.js`,
  `test/systems/travel/pacedials.test.js` - clicks, keys, pace
- `test/systems/travel/ow6_slowdown.test.js`, `test/systems/travel/ow6_bands.test.js`,
  `test/systems/travel/tv7_bands.test.js`, `test/systems/travel/ow_chaserange.test.js` - foes and bands
- `test/systems/travel/bandnear.test.js`, `test/characters/fb1031iii_band.test.js` - where a band that caught the
  traveller stands
- `test/render/canopysee.test.js`, `tools/canopySeeProbe.mjs` - the trees seen through (the probe in real WebGL2)
- `test/systems/travel/tv6_dungeons.test.js`, `test/systems/travel/tvdworld.test.js` - dungeons, in the Bay and past it
- `test/systems/travel/ows2_crossing.test.js` - the sea crossing
- `test/systems/travel/ow_toggle.test.js`, `test/systems/travel/fb0929d_toroads.test.js` - first-person switches
- `test/systems/travel/ow_roadtrue.test.js`, `test/systems/travel/ow_townwalk.test.js`,
  `test/systems/travel/road_follow.test.js`, `test/systems/travel/road_smooth.test.js` - roads and towns
- `test/systems/travel/road_beyond.test.js`, `test/systems/travel/road_graph.test.js`,
  `test/systems/travel/fast_refusal.test.js`, `test/systems/travel/plan_slices.test.js`,
  `test/systems/travel/ether_ow.test.js` - past the Bay and the Veil
- `test/systems/travel/tv8_party_walk.test.js` - travelling as a party
