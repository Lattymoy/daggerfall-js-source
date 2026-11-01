# Travel Options

Hazelnut's Travel Options mod (Nexus mod 122, version 1.11, MIT), ported: a journey the player walks with the game
running fast, the terrain streaming past and a control panel across the top of the screen, instead of a fade to the
destination. Encounters, places, wounds, disease and the sea can interrupt it. With Hazelnut's Basic Roads, the follow
key walks a road from junction to junction. The player meets it on the travel map and the follow key. The vendored
record is `vendor/travel-options/README.md`.

## How it works

**Walked or skipped.** The travel popup's three choices decide, as the mod's `IsPlayerControlledTravel` does
(`src/ui/travel/travelPopUp.js`): a cautious trip with the cautious setting on, or any trip with it off, stopping at
inns only if the inn setting allows, and never by ship. Offline a skipped trip is DFU's fade. Online, Travel Options is
on for everyone: every trip over land is walked, and ships sail only from ports.

**The journey.** `TravelOptionsMod.Update` is ported statement for statement in its own order
(`src/systems/travel/travelOptions.js`): close a window that stopped travel, the help key, the autopilot (which runs
under a paused window so the map can open mid-journey), any other window stops the journey, the follow key, cautious
health and fatigue checks, a place nearby, the sea, enemies (with a chance to slip past: luck + Stealth - 50, capped),
a new disease, then the junction map's upkeep. A death ends the journey and keeps the destination for the map's resume
prompt.

**Following a road.** Standing on a road and facing along it, the follow key walks to the next junction
(`FollowPath`, `SelectNextPath`); at a pixel with exactly two ways out it carries straight on, anywhere else it stops
and shows the junction map. In a town's border ring the journey walks round the town. The roads are Hazelnut's Basic
Roads network when that mod is on; the game's own generated roads are never followed. Past the Bay, a road's byte is
the roads past the Bay's own (`src/world/arenaRoads.js` `arenaRoadByte`, read through `src/world/road/pathData.js`),
so following, the junction map and the road rate work across Tamriel.

**Steering** is this game's own (`src/systems/travel/travelSteer.js`): feelers through the collider find a way round
what stands in the path, and the journey stops short and says so when there is none.

**Speed.** Two dials share one ladder, 5, 10, 20, 30, 40, 60 and 100 (`src/systems/travel/travelPace.js`): the
journey's speed, and the slowest the clock runs while an enemy holds it (default x5). x100 can be chosen only on a road
or track; off the road a dial at x100 runs at x60 and comes back to x100 on the next road. The land loading, a nearby
enemy, the view brought down and a town's ring walk (x15) all hold the clock lower. The dials are kept on the device,
never in a save.

**Time scale.** `src/systems/timeScale.js` is Unity's `Time.timeScale`, and the motor steps by it. Only the traveller
and the calendar are accelerated; encounters, foe pools, weather and animation stay on real time. Skills train on
real seconds, so a journey trains Running and Jumping as walking the same real minutes would.

**The travel map gains** the mod's ports filter, the region page at five texels a map pixel with roads drawn, a middle
click that marks a place, `I` to list a place's discovered buildings, `H` for help, a click on empty ground to walk
there, a resume prompt, and the Mages Guild teleport charge of `(8 - rank) * 200` gold when Paid Teleportation is on.

**The enhanced lane** has its own panel (`src/ui/enhanced/enhancedTravelControl.js`): the same controls at screen
resolution, with time left, distance, whether the journey follows a road, and the junction map on a real canvas. It
is drawn from the HUD, not an overlay, because an overlay holds the clock.

## Rules

- **The mod, ported 1:1** (Mac), with an enhanced panel and Basic Roads compatibility as his additions.
- **Road x100, open ground x60** (Mac) as the speed dial's ceilings; the dials and the road rule
  (`src/systems/travel/travelPace.js` `PACE_STEPS`, `ROAD_PACE_MAX`, `OPEN_PACE_MAX`) stand by the owner's word.
- **A journey's x100 survives a gap in the road** (Mac): the ground caps the dial and never rewrites it.
- **Fares haggle on the live Mercantile skill** (Mac), as every counter does.
- **On the player's own ship**, the ship laws read the place it was boarded, not the deck's pixel. Where no road leads
  and a passage sails there, the Overworld offers the passage (Mac).

## Daggerfall Unity

The mod's files map one to one: `TravelOptionsMod.cs` (`src/systems/travel/travelOptions.js`), `PlayerAutoPilot.cs`
(`src/systems/travel/travelAutopilot.js`), `TravelControlUI.cs` (`src/ui/travel/travelControlUI.js`),
`TravelOptionsMapWindow.cs` (`src/ui/travel/travelMapOptions.js`), `TravelOptionsPopUp.cs`, and the port table
(`src/systems/travel/travelPorts.js`). Departures, each for its reason:

- Hidden Map Locations and Real Grass are mods the game does not have; their hooks do nothing.
- The four path toggle buttons ship no art; the enhanced map's chips set the same flags.
- The ports filter resets each time the map opens, because the map window is made fresh each time.
- Only the traveller and the calendar are scaled, not Unity's whole clock, so encounters and the terrain build keep up.
- The mod's speed spinner and limit are replaced by the two dials above.
- Steering round obstacles and the ring arm's guards are this game's own.
- Past the Bay the path data reads the roads past the Bay; the mod's data is the Bay's alone.

## Code and tests

- `src/systems/travel/travelOptions.js` - settings, state, the journey machine
- `src/systems/travel/travelAutopilot.js`, `travelSteer.js`, `travelPaths.js` - steering, paths, compass arithmetic
- `src/systems/travel/travelPace.js`, `src/systems/timeScale.js` - the dials and the time scale
- `src/ui/travel/travelControlUI.js`, `travelJunctionMap.js`, `travelMapOptions.js`, `travelPopUp.js` - the panel,
  junction map, map additions, popup
- `src/ui/enhanced/enhancedTravelControl.js` - the enhanced panel
- `test/systems/travel/to1_travelOptions.test.js` - the port against the mod
- `test/systems/travel/pacedials.test.js`, `travel_speed_preference.test.js`, `ratelawfix.test.js` - speed
- `test/systems/travel/bayleft_paths.test.js` - roads past the Bay

## Open

- The three textures re-encoded from the mod's bundle still wait for their permission line
  (`01-Overview/Mod-Registry.md`).
- An enemy's lead-in slow-down starts farther out at x60 and x100 than at the mod's slower rates; a tuning for the
  owner.
