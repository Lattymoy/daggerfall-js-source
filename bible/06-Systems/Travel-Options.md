# Travel Options (Hazelnut) - TO1

**Travel Options 1.11**, by **Hazelnut**, Nexus mod 122 - "Travel
options allowing for time accelerated travel as well as standard fast
travel". Mac (Lattymoy) handed the shipped zip over on 2026-09-17:
*"This is the next daggerfall mod we are to implement 1:1"*, with two
additions of his own - *"an enhanced version of the UI for enhanced
mode"*, and *"ensure the compatibility is sound with basic roads"*.

The vendored record is `vendor/travel-options/README.md`. The mod's
code is MIT; the three textures are re-encodes out of its bundle and
their permission line is still open (`01-Overview/Mod-Registry.md`).

## What it is

Daggerfall's fast travel is a menu and a fade: pick a town, watch the
days tick past on a black screen, arrive. Travel Options keeps that and
adds the other thing - a journey the player WALKS, with the game
running at up to sixty times speed, the terrain streaming past, a
control panel across the top of the screen, and encounters, locations,
wounds and the sea all able to interrupt it.

Which of the two a trip takes is decided by the travel popup's own
three choices against the player's settings, and by nothing else -
`TravelOptionsPopUp.IsPlayerControlledTravel` (:80-83), ported in
`src/ui/travelPopUp.js`:

```
(CautiousTravel || !SpeedCautious) && (StopAtInnsTravel || !SleepModeInn) && !TravelShip
```

Read it as *"cautious is mine, or you did not choose cautious"*. With
both Player Controlled settings off, the only walked trip is reckless,
on foot, camping out - which is the readme's *"selecting recklessly by
foot/horse with camp out options will always initiate time accelerated
travel"*. A ship is never walked.

The second half is **Basic Roads**. With Hazelnut's own road mod on -
and the port has it, vendored, as `vendor/roads-hazelnut/` - the travel
map draws his network at five texels a map pixel and the follow key
walks it: stand on a road, face the way you mean to go, press the key,
and the journey runs to the next junction on its own.

## The files

| File | What it is |
|---|---|
| `src/systems/travelOptions.js` | `TravelOptionsMod.cs` - the settings, the state, the journey machine and the Update loop in its own order |
| `src/systems/travelAutopilot.js` | `PlayerAutoPilot.cs` (Jedidia) - the steering: a yaw and a forward force per frame, and the arrival test |
| `src/systems/travelPaths.js` | the compass, the map-pixel bands and the direction arithmetic - a leaf, no DOM and no world |
| `src/systems/travelPorts.js` | `portLocationIds`, the 417-entry hand-written table of harbours |
| `src/systems/travelOptionsText.js` | `TravelOptionsModData.csv`, restated; the vendored file is the record and a pin holds them equal |
| `src/systems/timeScale.js` | Unity's `Time.timeScale`, which the port did not have |
| `src/ui/travelControlUI.js` | `TravelControlUI.cs` - the 320x27 strip, rect for rect |
| `src/ui/travelJunctionMap.js` | the junction mini-map panel |
| `src/ui/travelPathsOverlay.js` | `DrawPath` / `DrawLocation` / `DrawMapSection` - the three routines the map and the mini-map share |
| `src/ui/travelMapOptions.js` | what the mod adds to the travel map: the ports button, the five-texel page, the info box, the resume prompt, the teleport charge |
| `src/ui/enhancedTravelControl.js` | **the port's own** - the enhanced lane's travel panel (Mac's addition, not the mod's) |

The travel map and the popup keep their own homes
(`src/ui/travelMapWindow.js`, `src/ui/travelPopUp.js`): DFU's law lives
there and the mod's additions call into `travelMapOptions.js`.

## The journey, step by step

`TravelOptionsMod.Update` is ported statement for statement and in its
own order, because the order is the behaviour - an encounter that fires
before the health check stops the journey differently from one that
fires after. The order (`:1325-1470`):

1. a window that stopped travel is closed once it is on top again;
2. `H` over the panel opens the help;
3. the autopilot updates, and **returns early while the game is paused** -
   which is what lets the travel map be opened mid-journey;
4. any OTHER window stops the journey;
5. the follow key stops a followed journey;
6. a path crossed while walking a town's ring stops it;
7. cautious travel checks health, then fatigue;
8. a location nearby stops it (under LocationPause "nearby");
9. the sea stops it;
10. enemies stop it - cautiously, with a chance to slip past;
11. a new disease stops it and raises the health box;
12. and with no journey running, the follow key starts one;
13. last, the junction map's own upkeep.

**The avoid roll** is `min(luck + Stealth - 50, MaxChanceToAvoidEncounter)`
(`:1199-1213`). The mod's own readme says "luck + stealth - 20"; the
code says 50, and the code is what runs - carried as written.

## Path following

`FollowPath` (`:614-679`) asks three questions in order: is the player
standing ON one of the edges leaving this map pixel (`IsPlayerOnPath`,
:577-604, whose geometry is the 512-unit bands and diagonals in
`travelPaths.js`)? Then does the FACING match one of them - or, failing
that, the direction they came FROM, which is what turning round on a
road does? Otherwise, is the player in the border ring of a town, in
which case the journey walks AROUND it (`CircumnavigateLocation`,
:753-797, four corner rects and an eight-branch pick)? Otherwise the
key says there is no path here, or flips the junction map.

A leg that arrives asks `SelectNextPath` (:722-751): at a pixel with
exactly TWO ways out the journey carries straight on, and anything else
is a junction, where it stops and puts the mini-map up. The
"carry on" pick includes the mod's own XOR-and-shift recovery walk for
the case where the facing matches neither edge - *"should work 99% of
the time"* in its own comment, kept as written, and exercised in the
field by the thirteen non-reciprocal half-edges in his own track data.

## Basic Roads compatibility, checked

The port draws roads **either way**: Hazelnut's four vendored arrays
when Basic Roads is enabled, and its OWN generated network when it is
not or when his files cannot be read (`03-World/Roads.md`). Nothing the
network was handed to could tell the two apart, because
`terrainGenClient` rebuilt the object without the source. That is now
an explicit `source` field set at all FOUR assembly sites (the worker's
answer, `setRoads`, `setRoadsData`, `_roadsFallback`) - the AUDIT 58 F3
/ BR3 lesson, that a field added to one of them is silently inert on
the path the game takes.

**Path following is handed the network only when it is his**
(`scenes/world.js`, the `roads:` dep). Following the port's own
generated tracks would be offering a feature the player never switched
on, and the two networks are measurably different: his junctions are
4.4% of road pixels to the port's ~9%, his roads bend at 45 degrees
98.3% of the time, his tracks run 30k pixels to the port's 23k.

The eight compass bits are the same in both (`sameCompass()` says so
out loud and a pin asserts it), which is what lets the mod's geometry
read the port's arrays unchanged.

## The time scale

The mod accelerates a journey with Unity's `Time.timeScale`, and - in
the same method, for the reason its own comment gives - with
`Time.fixedDeltaTime = timeScale * baseFixedDeltaTime` (`:382-390`).
Both halves matter. The port's motor steps a fixed accumulator at 1/60
(`player/motor.js`), so scaling the frame alone would ask for fifty
times the STEPS at x50 - three thousand capsule sweeps a second, which
is a freeze rather than a fast walk. `src/systems/timeScale.js` is the
port's `Time.timeScale`, and the motor reads it itself, exactly as
Unity's physics reads the global clock: its callers hand it the real
frame and none of the four hosts changed. `MAX_FRAME_DT` is Unity's
`maximumDeltaTime`, an UNSCALED bound, so it is applied before the
scale and not after.

**THE ONE DELIBERATE DEPARTURE.** Unity's `timeScale` accelerates
everything; the port accelerates TWO things - the traveller and the
calendar - and leaves the encounter pump, the foe pools, the weather
front and every animation on real time. At x50 a scaled encounter pump
would roll fifty times the ambushes a real second, and the terrain
build queue would be asked for fifty pixels in the time it can raise
one; the mod's own readme warns about exactly that failure ("raising
this can cause players to fall off the terrain and into the void"). The
journey the player sees is the same - the ground goes past at the
acceleration and the clock keeps up with it - and what interrupts a
journey interrupts it on its own honest clock.

## What the travel map gains

- the **PORTS** filter (`TOportsOff/On`, 45x11 at 231,180) while the
  mod restricts ship travel to ports, and the shuffle it performs on
  the two arrow buttons when a region pages - the ports button up seven
  pixels, both arrows down eight (`:199-220`);
- the region page at **five texels a map pixel** with his roads and
  tracks drawn as lines under the dots, and each dot a 5x5 or 3x3
  square by its type (`:593-696`);
- the **middle click** marks a location, drawn as a ring in
  `MarkLocationColor`;
- **I** over a selected place lists the named buildings the player has
  discovered in it, guild halls named on their own line;
- **H** anywhere opens the mod's help;
- a click on an EMPTY map pixel opens the popup on those bare
  coordinates, which can only ever be walked to;
- opening the map mid-journey goes straight to the player's region;
  opening it with a destination still set asks whether to resume;
- the mages guild's teleport service charges `(8 - rank) * 200` gold
  when Paid Teleportation is on.

## The enhanced lane (Mac's addition, not the mod's)

`src/ui/enhancedTravelControl.js` is the port's own: the same five
controls in the enhanced skin's brass and bone, at the screen's own
resolution, with what a 320-pixel strip had no room for - the hours and
minutes still to run, how far the destination is, whether the journey
is following a road, and the junction map as a real canvas rather than
a hundred stretched texels. Like the enhanced HUD it is a readout
painted from `drawHud` and it registers with no overlay stack; unlike
the HUD it has buttons, so its controls alone opt back into pointer
events (the touch-quickslot pattern). It is NOT in the port's overlay
slot, and that is load-bearing: an overlay holds the motor and the
world clock, which is the one thing a journey must not do.

## Recorded departures

1. **Hidden Map Locations** (`:284-293`, `:1264-1266`, and
   `TravelOptionsMapWindow.checkLocationDiscovered`'s own arm) - a mod
   the port does not have. Its discovery set, its "reveal ports" arm
   and the popup's `hasVisitedLocation` gate are not ported.
2. **Real Grass** (`:1227`, `:1258`) - likewise: a
   `SendModMessage("Real Grass", "toggle")` pair with nothing to send
   to. The setting is carried and reads as a no-op.
3. **`SDFFontRendering`** (`:1256`, `TravelOptionsPopUp.cs:126-133`) -
   DFU picks between two help texts and two travel-time formats by
   which font renderer is on. The port's text is neither of DFU's two,
   so it takes the SDF arm of both and carries the other strings.
4. **The four path toggle buttons** (`TravelOptionsMapWindow.cs:221-279`)
   - the mod ships no art for them and `SetupPathButtons` returns
   without making a button when the player has not supplied it, so a
   player who installs only the mod has no toggles. The port already
   has those four flags in its shared store, flipped from the enhanced
   map's chip row (ROADS 12/24).
5. **`exteriorAutomapBuildingType`** (`:432-433`) - DFU reads the
   building type's display name out of its own text table; the port has
   the enum and no such table, so the enum's own name is spaced out
   ("GeneralStore" becomes "General Store").
6. **The ports filter does not outlive the window.** The mod's is an
   instance field on a window DFU keeps alive; the port mints a window
   per open, so the filter resets on each M press. The four DFU filters
   and the four roads filters live in the shared store and do outlive
   it.
7. **The junction map's Trilinear filter mode** maps to linear: the
   port's renderer has nearest and linear, and a 100x100 HUD texture
   never samples a mip.
8. **No save state.** The mod clears the destination on load and on a
   new game (`:381-383`), so there is nothing to persist - which is
   also why no `travel-options` block was added to the save envelope.
9. **Online the journey does not run.** The shared clock is the
   world's (WORLD5) and a trip that takes real hours of it cannot be
   one player's business, so `beginAcceleratedTravel` stands down under
   `sharedClockOn()` and the trip falls back to DFU's own, which online
   already arrives at once.

## The four hosts

The journey is wired in `scenes/world.js` ALONE, and the other three
are named: `scenes/exterior.js` (`?exterior`) has no roads and no
travel map and says so itself (`03-World/Roads.md`);
`scenes/worldModes.js` and `scenes/dungeonContext.js` are the INDOOR
hosts, and the mod's own follow key refuses indoors
(`:1439-1440`, `PlayerEnterExit.IsPlayerInside`). An accelerated
journey is an exterior thing and lives with the exterior.

## Pins

`test/to1_travelOptions.test.js`. `tools/mutants/to1.json`.
