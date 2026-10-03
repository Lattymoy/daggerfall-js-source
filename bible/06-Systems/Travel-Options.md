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
| `src/systems/travelSteer.js` | **the port's own** (TRAVEL-NAV, below) - the walk round what stands in the way: the feelers through the collider, the fan, the stand-off, the stop |
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
an explicit `source` field set at the THREE assembly sites (`setRoads`,
`setRoadsData`, `_roadsFallback`) plus the stats fallback - the AUDIT 58
F3 / BR3 lesson, that a field added to one of them is silently inert on
the path the game takes. (AUDIT-TO1: this paragraph said "FOUR" and
named the worker's answer, which assembles nothing; the pin counts
`source: ` four times because the stats fallback carries one too.)

**Path following is handed the network only when it is his**
(`scenes/world.js`, the `roads:` dep). Following the port's own
generated tracks would be offering a feature the player never switched
on, and the two networks are measurably different: his junctions are
4.4% of road pixels to the port's 6.5% (ROADS 17/18, `03-World/Roads.md`),
his roads bend at 45 degrees 98.3% of the time, his tracks run 30,472
pixels to the port's 26,944 (ROADS 21's "ours now" - AUDIT-TO1: this
sentence had copied ROADS 16's superseded 23k and ~9%).

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

## BOOT-TDZ (2026-09-18) - the mod is declared above the stream that reads it

Mac, on the deployed build: *"boot failed: can't access lexical
declaration 'yn' before initialization"*. `bootWorld` built the mod near
its end (`const travelOptions = travelOptionsOn ? createTravelOptions(...)`)
and the PIXEL BUILDER, three and a half thousand lines above it, calls
AUDIT-TO1 B3's second hook on every pixel it finishes:

    if (_isPlayersPixel && dfLocation) travelOptions?.initLocationRects(playerTravelPixel());

The boot awaits its own first build - `const playerPixel = await
buildPixel(first.px, first.py)` - long before that `const` runs, so the
read landed in the binding's TEMPORAL DEAD ZONE and threw. Optional
chaining is no guard against one: `a?.b` evaluates `a` and throws exactly
as `a.b` would; it only softens `null` and `undefined`, which a binding
that has not been initialised is not. Every character whose first pixel
carries a location - which is every ordinary save, and every new game
that starts in a town - died at boot; a character standing in open
wilderness did not, which is why the slice's own browser probes (no
location under them) and every headless pin missed it.

The bindings the stream reads now stand above the stream, declared null
and ASSIGNED where the mod is built: `travelOptions`, `_travelRegionSeen`
(the region-crossing edge the topic sync reads), `_travelUIHolder` (F2's
holder) and J1's two `_travelWeatherOff`/`_travelSoundsOff` switches,
which had already been hoisted once for the mount rig and not far
enough. Every reader above the build already guarded on null - the same
guard a player with Travel Options switched off needs - so nothing else
changed.

### BOOT-TDZ2, the same day - the line's own test read three more

Hoisting the mod was half of it. The same line decided whether the pixel
was the player's with `px === playerTravelPixel().x`, and
`playerTravelPixel` reads `walkMode`, `player` and `cam` - three more
bindings the boot walk declares below its own first build. So the boot
died again, one binding along, on exactly the same save.

The builder ASKS THE MOD FIRST now:

    if (travelOptions && dfLocation) {
      const here = playerTravelPixel();
      if (px === here.x && py === here.y) travelOptions.initLocationRects(here);
    }

With no mod there is nothing to initialise, so the mod is both the
cheaper test and the only one that is safe that early - and the pixel is
read once per build rather than three times. Before TO1 the pixel
builder reached none of those bindings; this call was the slice's own.

The gate this deserved is `test/bootorder.test.js`: it walks the boot's
statements up to and including the first build, follows every call into
the functions `bootWorld` declares, and names every binding they reach
that the boot walk has not declared yet. Eight names stand on an
allow-list, each reachable only down a branch a first build cannot take
and each older than this arc; a ninth fails the suite rather than a
player's browser.

Pinned in `test/to1_travelOptions.test.js` as a LAW rather than a
literal: every one of those bindings must be declared before the line
`const playerPixel = await buildPixel(first.px, first.py)`, and the mod
must be assigned there, never re-declared. Mutants
`tools/mutants/to1.json`: `travel-options-declared-late`,
`region-seen-declared-late`, `holder-declared-late`.

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
   per open, so the filter resets on each M press. The four DFU filters,
   the four roads filters AND the middle-click mark (AUDIT-TO1 G4: it
   is `markedLocationId` on that same persistent window, and the
   junction map steers by it after the map has closed) live in the
   shared store and do outlive it.
7. **The junction map's Trilinear filter mode** maps to linear: the
   port's renderer has nearest and linear, and a 100x100 HUD texture
   never samples a mip.
8. **No save state.** The mod clears the destination on load and on a
   new game (`:378-379`), so there is nothing to persist - which is
   also why no `travel-options` block was added to the save envelope.
   AUDIT-TO1 G1: the load half of that hook was NOT wired until the
   audit - `worldQuickLoad` now clears the destination and resets the
   scale before its first await. The new-game half is moot here: a new
   game reloads the document.
9. **Online the journey RUNS** (TO-ONLINE, 2026-09-19, Mac: *"travel
   options uses instant travel for the online mod, which shouldn't be
   the case"*). This item used to read "online the journey does not
   run", and its argument was that the shared clock is the world's
   (WORLD5) and a trip taking real hours of it cannot be one player's
   business. **That premise is not what the code does.** Under the
   shared clock `playerTicker` reads the relay and *fabricates nothing
   from `dt`* (`systems/worldTick.js`, WORLD5's own law) - so an
   accelerated journey cannot move the world's clock, and there was
   never anything there to protect. What the stand-down actually bought
   was its FALLBACK, and the fallback is DFU's fast travel under
   `noWorldTime`: a teleport that arrives at once and costs nothing.
   The rule refused a ride because it might be too cheap and handed the
   player something free.

   So `beginAcceleratedTravel` asks only whether the mod is there, the
   FOLLOW KEY asks the same question (AUDIT-TO1 I3 put a stand-down
   there because there was one at the map's door; the two must answer
   alike), and `coordsAllowed` opens wherever the journey runs - which
   is now everywhere the mod is on (AUDIT-TO1 I4's reason stands, it is
   just no longer narrowed by the clock). **The online world is
   untouched**: no clock moved, no new online rule, no cap invented.

   THE ONE THING THAT DIFFERS ONLINE, by the world's own arithmetic
   rather than by anything decided here: the acceleration. The online
   clock runs at exactly the offline rate (`wire.js`
   `ONLINE_MINUTES_PER_MS` is `CLASSIC_MINUTES_PER_SECOND / 1000`,
   pinned equal), so **at x1 the two are identical** - a three-day ride
   is six real minutes and three game-days pass on either clock. Above
   x1 they part, because `travelScale` reaches the traveller AND the
   calendar offline (the frame's `playerTicker.tick(dt * timeScaleMult
   * travelScale, ...)`) and online the calendar is the relay's and
   ignores it. Offline the spinner buys real time and charges game-days;
   online it buys both. Named here rather than capped: capping it would
   be an online rule, and this slice was asked not to make one.
   [SUPERSEDED for the character's clock by FIELD BUGS 2026-09-29h
   WALK-CLOCK (Mac: *"Dont worry abour DFU."*): online the journey's
   minutes past the world's are raised on the character's own clock
   (LIVED1), so the traveller lives the ride's days as offline; the
   world's clock still moves its real minutes alone.]

   AUDITED BEFORE MERGE, and one consequence named rather than fixed.
   The journey machinery itself is online-agnostic - `travelOptions`,
   `travelControlUI`, the junction map and the autopilot never ask about
   the shared clock - so nothing was put into an unhandled state by
   letting it run; a walked trip charges no fare online exactly as it
   charges none offline, and a SHIP trip is not player-controlled, so it
   still takes DFU's arm and still says the online line. What
   acceleration does stress is the WIRE: the online world is sharded
   into `WORLD_CELL` squares and a crossing is cheap only when the next
   cell was already hello'd as a halo (`net/online.js`, WORLD6b-iii(b)
   promotion). At x30 the player can outrun the halo, and each crossing
   is then a full join rather than a promotion. That is connection
   churn, not a correctness bug, and capping the spinner to stop it
   would be the online rule this slice was asked not to make - so it is
   written down here for whoever meets it.

   THE POPUP SAYS SO. `ONLINE_TRAVEL_LINE` - "the world's clock does
   not wait. You arrive now, and no inn is paid" [LIVED1: now "Online: the days pass
   on your own clock. You arrive in the world's present."] - is DFU's fast travel
   talking, and it was true of every online trip while the journey stood
   down. It is false over a walked one, so both skins now gate it off
   `walkedTrip` / `t.walked`; that branch already carries the mod's own
   `MsgPlayerControlled` and an hours:minutes estimate.
10. **A message box over the journey PAUSES it rather than interrupting
    it** (AUDIT-TO1 H1). DFU's `DaggerfallUI.MessageBox` pushes a window,
    so the mod's own help (`:1005-1014`) trips the "any other window"
    arm and the journey must be resumed from the map; the port's
    overlay slot holds the motor and the clock, so `gamePaused` returns
    early and the journey carries on when the box closes.
11. **An interior door ends the journey** (AUDIT-TO1 G2). The mod's Update
    runs indoors and its autopilot keeps pushing; the port's does not run
    under an indoor mode, so a panel still up when the mode changes is
    closed at the top of the frame (InterruptTravel) and a scale with no
    panel behind it is reset there - `timeScale()` is module-global and
    the motor reads it in every host.
12. **The mod's own enter-rect quirk is carried** (AUDIT-TO1 M1).
    `InterruptTravel` unsubscribes `PlayerGPS_OnEnterLocationRect` when
    LocationPause is "entered" (`:994-996`) and `Start` (`:381`) is the
    only `+=`, so after the first interruption of a session the
    "entered" stop never fires again. Kept as written
    (`st.enterRectDetached`).
13. **The classic strip's two tooltips are not drawn** (AUDIT-TO1 H3).
    `tooltipAt` answers them and the enhanced panel carries them as
    `title`; the classic HUD has no hover layer for the strip yet. The
    mod's `TravelControlUI.cs:129-140` shows them on hover.
14. **The five-texel region page keeps the mod's override, not DFU's
    base** (AUDIT-TO1 L6): the override computes `sampleRegion`
    (`TravelOptionsMapWindow.cs:614`) and never tests it, so a
    neighbouring province's discovered town inside the page rect is
    plotted. The classic page keeps DFU's containment.
15. **The held map's own five** (AUDIT-MAP U1-U5, `10-UI/Held-Map-Arc.md`):
    the coordinates click refuses a teleport visit; H works under the
    travel panel; the ship laws on a bare pixel see no destination
    (the C# consults the stale last-hovered summary); the resume prompt
    answers Enter and E too; the teleport fee is asked with the pick and
    deducted only with the teleport. The classic window carries none of
    these - they are the enhanced sheet's. AUDIT-MAP2 added four on the
    same sheet (`10-UI/Held-Map-Arc.md`, T1-T4): the poor-purse box has
    no yes (the classic's teleportpoor closes on any key; Y had teleported
    for free), Escape on the fee box is its No (the classic's one arm),
    the armed map offers only the teleport (the classic's popup factory
    returns the TeleportPopUp whenever the map is armed), and a "bare"
    pixel is one with no discovered place on it (the classic's
    locationSelected), not one the zoom band happens not to ink.
16. **The ring walk forgets the named destination** (`:658-664`, ROAD-CRASH
    below). The mod's two path arms write `DestinationName = null`; its
    ring arm does not, and an interrupt "leaves current destination
    active" (`:1273`), so a ring walked after any stopped journey ran
    under a stale name - the one condition that keeps `InitLocationRects`
    refreshing the rects mid-journey (`:606-612`). The port's arm
    forgets the name as the other two do (`travelOptions.js:764`).
17. **The recovery walk's give-up is a junction** (`:727-1050`, ROAD-CRASH
    below). When `SelectNextPath`'s nine shifts narrow nothing, the mod
    hands `GetTargetPixel` a multi-bit mask whose `default` arm is the
    pixel the player stands in: a leg arrived before it starts, forever.
    The port stops at a junction instead (`travelOptions.js:832`).
18. **The journey steers round what is in its way, and stops short of what
    it cannot pass** (TRAVEL-NAV, below). The mod's autopilot beelines and
    its body grinds against whatever stands on the line. The port's own
    steering sits between the autopilot and the motor, on the port's own
    switch on the mod's pane (`GeneralOptions.AvoidObstacles`, on); off,
    the journey is the mod's beeline exactly.
19. **The arrival buffer is an arrival across a pixel edge** (TRAVEL-NAV,
    with the switch). `PlayerAutoPilot.Update` asks about the destination
    rect only inside the destination pixel (`PlayerAutoPilot.cs:80`); a location eight blocks
    across fills its pixel, so its whole buffer lies in the neighbours and
    the traveller came up to the walls before the question was asked.
20. **On the ship, the ports rule asks of the port it was boarded at**
    (SHIP-PORT, 2026-09-28, below). `IsNotAtPort` (TravelOptionsPopUp.cs:87-91)
    reads `PlayerGPS.CurrentLocation`, which on the player's own ship is
    "Your Ship" (2,2 or 5,5) - in neither port list - so the mod refuses the
    passage from the deck, while DFU reckons every trip from the deck from
    the boarding pixel (TravelTimeCalculator.GetPlayerTravelPosition) and the
    mod's own `HasNoOceanTravel` (:93-96) names `IsOnShip`, the passage it
    meant. Ashore the rule reads exactly as the mod's. The boarding PLACE is
    what is read, not a harbour by fiat: a ship boarded in the wilderness
    (DFU boards anywhere) reads no port from its deck, as there (AUDIT 28e).

## AUDIT-TO1 (2026-09-18) - the audit of TO1, and what it found

Mac: *"Please do a comprehensive audit on this."* Fourteen finder agents
over the eight C# files against the port, three adversarial verifiers
per finding, and four exact table checks by hand. **The headline: the
slice's headline feature never ran.** Every pin passed because every
pin supplied the host's flags by hand.

**Part 1** (commit `68910ff`): the three of the mod's eight classes TO1
never read - `MagesGuildTO` (paid teleportation unreachable below rank
8, where it is free), `CastWhenHeldTO` (a walked journey billed a
held enchantment one condition every four game minutes; ~750 across a
crossing), and the doctrine row the three vendored pictures were owed.
`TravelTimeCalculatorTO` turned out to be carried by `_scaleTripCost`.

**Part 2**, by mechanism, each with its pin and its mutant:

- **A1 - the journey died on its first frame.** The host handed
  `isPlayerOnHUD: !overlayActive && !overlayHeld`, the exact complement
  of the `gamePaused` beside it; DFU's `IsPlayerOnHUD` is "the HUD is the
  top window" and the travel panel IS a pushed window (`:533`), so the
  property is false for the whole journey. The panel standing in for that
  window is the term. Everything past `:1040` in the ported Update was
  dead code in the shipping host.
- **B1/B2/B3 - the location rects.** `locationTileRect` called a method
  `MapsFile` never had (every rect null: no circumnavigation, no in-town
  follow arm, every leg aimed at a pixel centre inside the buildings);
  the rect it would have built was blocks x 8 tiles, half the town, with
  no ground-tile bound and `hasCustomPosition` hard-coded. It reads the
  BUILT pixel's `locationRect` (setLocationTiles' answer, extraClearance
  included) and `hasCustomLocationPosition` now. And none of the mod's
  five `Start` subscriptions had a caller: `OnMapPixelChanged` (+
  `InitLocationRects`), `OnEnterLocationRect`, `OnRegionIndexChanged`,
  `OnEncounter` and `OnUpdateLocationGameObject` are wired at the host's
  own edges.
- **C1/C2/C3 - the default skin.** TO1 wired the mod into the classic
  window alone, and the travel key opens the enhanced map (then
  `OverworldMapWindow`; `HeldMapWindow` since MAP1, 2026-09-18, carrying
  the same three laws) for every player who never chose a skin: no `playerControlled` on its commit (the
  mod unreachable from the map), no ship law (a landlocked village sold
  sea passage), no teleport fee. The popup's laws are pure exports now
  (`isPlayerControlledTravel`, `enforceShipRestriction`,
  `shipTravelRefusal`) and both skins run the same ones.
- **D1-D4 - the ship restriction was inverted.** `IsNotAtPort` was never
  told where the player stood (true at every one of the 378 harbours);
  OnPush's guard was ported and never called (every popup opened on SHIP);
  the wheel bypassed the click's check; the camp-out arms never cleared
  the ship. All four carry the mod's `:53-67`, `:182-232` now.
- **E1/E2/E3 - the art.** The strip and the two ports buttons were decoded
  and never UPLOADED, so `drawImg` found no `tex` and painted opaque white
  bars; the junction disc's `drawScreenQuad` put `{ filter }` in the
  SOURCE-RECT slot (four NaNs into `uSrc`). The filter is set at upload.
- **F1/F2 - the junction map.** Drawn only inside `if (isShowing)`, so it
  was invisible in the two moments it exists for (the stop at a junction,
  the off-path toggle). It is the HUD's now, off the mod's own flag, in
  both lanes - the enhanced mount keeps the disc with the bar hidden -
  and it honours the map's four location filters.
- **G1-G4 - lifetime.** A load never cleared the destination (a stale
  "resume?" over a save that never began it); the scale's only resets sat
  below the exterior gate (a building door mid-journey stranded x50 in the
  shop); NO on the resume prompt closed the whole map and the prompt came
  straight back; the middle-click mark died with the window.
- **H1/H2 - the help.** Sixteen lines pushed as ONE HUD row (centred at
  about x = -1265); the TravelExit / TravelMap placeholders printed empty
  (the bindings store is not an action->code map). A box a row a line,
  and the two real accessors.
- **I1-I6 - input.** The follow key shipped on F, SOC5's SocialInteract
  (one press did both) - K now, the one letter of the mod's six nothing
  answers, and the HT4 walk covers declared key choices and mod-vs-mod
  collisions; the strip's click router took clicks with the pointer
  LOCKED (frozen coordinates over the spinner or EXIT); the follow key ran
  online; the coordinates door swallowed its refusal; the popup's I did
  nothing; and the I key's discovery read used the numeric map id where
  every writer keys `region:name` - "no knowledge" of every place in the
  game.
- **J1 - weather and sound.** The two switches were written and never
  read: rain fell through a journey and the stride fired at the
  accelerated step rate. Rain, the classic and mod strides and the riding
  loop read them now (`TransportManager.RidingVolumeScale = 0`).
- **K1/K2 - the autopilot and the drive.** `InitTargetRect` zeroed the
  latched yaw (the C# never writes it; an interrupt in the same update
  snapped the camera north); the drive zeroed the strafe the mod leaves
  to the player.
- **L5/L7 - the enhanced panel.** Its ETA never rendered (nothing wrote
  `minutesLeft`; the popup's estimate rides `beginTravel` now and runs
  down on the world clock; null for a followed path); it painted over the
  enhanced map (`covered`, the HUD's own word).
- **MAP2 (2026-09-18, bible/10-UI/Held-Map-Arc.md).** The enhanced map
  is the held parchment now, and it carries every addition this window
  gained here through the SAME functions - `portsFilterAllows`/`hasPort`,
  `travelMapMarkedMapId`, `locationInfoRows`, `resumePrompt`, the popup's
  walked estimate, `onTravelToCoords` - so the default skin is the mod's
  map too. The junction disc stays this mod's own DrawMapSection in both
  lanes; it reads the same mark the sheet inks (from the STORE, since
  AUDIT-MAP). AUDIT-MAP D2: `_scaleTripCost` is the pure export
  `scaleTripCost` now and the held map's card bills it - the enhanced
  skin had charged the unscaled fare since the relief map, and this
  page's "faithful" was true of the classic popup alone until then.
- **The records.** Departures 6, 8, 9 corrected; five added (10-14); the
  source-gate paragraph's stale ROADS 16 numbers replaced; the mutant
  `map-section-roads-under-tracks` was a live survivor recorded as
  equivalent - a pixel with both a road and a track now pins the order.

**Clean, by exact diff rather than reading:** 417/417 port ids, 44/44
strings byte for byte, 51/51 settings on name, default, min and max, and
the autopilot method by method. The trip-cost calculator, the
circumnavigation speed limiter (its UI-number quirk included) and the
`_scaleTripCost` two-part split are faithful.

**Not seen in a browser**, still. The pins drive the host's own flag
expressions now (`AUDIT-TO1 A1` runs two frames with them), which is the
hole every earlier pin left.

## AUDIT-FIELD (2026-09-18) - the arc audited before it merged

Four adversarial lenses over BOOT-TDZ, BOOT-TDZ2, MAP-FIELD and
TO-FIELD, plus the browser probe. What it found about this page's own
subject is folded into the TO-FIELD section above; the two findings that
belong to the BOOT arc are here because they are the same story.

- **F5 - THE THIRD DEAD ZONE, and it was live.** `buildPixelNow` ends
  with an unconditional `await standPixelNpcs(entry)`, whose second line
  reads `questBridge?.machine` - a `let` declared five hundred statements
  below the boot's own first build. The `?.` is no guard, and the early
  return above it (`if (!entry?.npcs?.length) return;`) is the SAME
  town/wilderness split as the two crashes that shipped: a first pixel in
  the wilderness booted, a first pixel in a town threw. Reproduced on the
  exact shape, then fixed the way BOOT-TDZ fixed the first one - the
  binding is declared at the top of the boot now. The pass's own doc
  comment always said it means to run at boot with no bridge and read it
  as null; declaring it up there is what makes that sentence true.

- **F6 - and the gate that was meant to catch this did not.** Reverting
  BOOT-TDZ2's guard left `test/bootorder.test.js` GREEN, because the
  walker is name-based and cannot see conditions: `walkMode` was
  allow-listed, so it was blessed down every path. `questBridge` was
  allow-listed on a reason that was simply false - "quest placements
  only", where the real guard is `entry.npcs.length` - and the third dead
  zone sat behind that sentence. Each allow-list entry now carries the
  source its excuse rests on and fails with it; all three crashes are
  caught by the gate, checked by reverting each fix in turn.

## The four hosts

The journey is wired in `scenes/world.js` ALONE, and the other three
are named: `scenes/exterior.js` (`?exterior`) has no roads and no
travel map and says so itself (`03-World/Roads.md`);
`scenes/worldModes.js` and `scenes/dungeonContext.js` are the INDOOR
hosts, and the mod's own follow key refuses indoors
(`:1439-1440`, `PlayerEnterExit.IsPlayerInside`). An accelerated
journey is an exterior thing and lives with the exterior.

## TO-FIELD (2026-09-18) - the three the field found

Mac, on the shipped build: *"Using travel options spawns you under the
maps, doesn't travel on the road and you instantly collapse from
exhaustion"*, and then the term that settled the second: *"if you
actually look at the mod, its pure continous travel along roads instead
of an instant shift. So im not sure where this port went wrong"*.

**The model was never wrong.** The mod's own readme calls it "time
accelerated real travel", and the port runs exactly that: the player
walks, the calendar keeps up with the miles, and nothing on that path
ever teleports. Two of the three were real defects in the host; the
third was a thing the port never said out loud.

- **Under the maps - the walk did not wait for the ground.** The journey
  drove the motor at up to sixty times walking pace across a streamer
  that builds ONE pixel per call, and `heightAt` answers `-Infinity`
  over a pixel that is not built yet, which no collider clamp can catch.
  Every other player-moving path in this host already waits - the boot
  stand (`playerSpawned && built.has`), the ride-out (TSR4a, *"it just
  spawns me straight into the ground"*), the season re-skin, a teleport
  awaiting its pixel - and this one, the fastest of them, did not. The
  drive now holds while the ground under the feet OR
  `TRAVEL_LOOKAHEAD = 64` ahead of the bearing is missing AND the
  streamer is still bringing it; with nothing queued the ground is not
  coming and holding for ever would be its own bug, so it goes through.
  The wait is the ride-out's own sentence, deliberately, so the two read
  alike.

> **TO-FIELD3 (Mac, 2026-09-18) REVERSED THE TWO GAMEPLAY CHANGES BELOW.**
> "Remove the changes the past session did to the traveling system... the
> two gameplay changes - journeys no longer sit as resting (needs charge
> normally again, health ticks back), and hunting rolls fire during
> travel again."
>
> Both are gone. `survivalEnv` feeds the journey the world it is actually
> in (`world.js`, the same one sentence `exterior.js` reads), and the
> hunting roll is the overworld host's mode and nothing else. The bullets
> below are KEPT rather than struck, because their arithmetic is right
> and whoever reads this next should know exactly what was traded away
> and what it costs.
>
> **What the reversal restores, and it is not small.** The needs stack
> starving 4, parched 6 or dehydrated 12, exhausted 8, heat 6 and bare
> feet 4 on top of DFU's own 11 a minute, on a traveller who by
> construction never stops to eat, drink or sleep. A RECKLESS journey has
> no stop of its own and can collapse; a CAUTIOUS one is paused at the
> fatigue floor by the mod's own watch. The bare-skin health ticks and
> the byFire exposure damage run again. And the hunting roll fires once a
> GAME minute at up to a hundred times real time, opening a box the mod
> answers with `interruptTravel()` - so a long wilderness ride WILL be
> interrupted, often.
>
> That is the loop as Mac wants it played: camp out, stop at inns, or
> travel cautiously. The survival mod's own switch turns all of it off
> for a player who would rather ride through.
>
> **And one thing the change that set it never counted:** `resting` is
> not a fatigue knob, it is the needs' one word for "sat still", and
> FOUR laws read it - the two fatigue drains it was aimed at, the two
> health arms F12 later disclosed, and SURV6's hunting roll, which
> refuses outright on `resting` (`hunting.js:120`). One flag reached
> three laws nobody had asked it to reach. That is the lesson worth
> keeping out of this whole exchange.

- **Instant exhaustion - the port's own needs charged at the mod's
  clock.** The vanilla band asks only whether the minute CHANGED this
  frame and pays ONE minute whatever the jump
  (`PlayerEntity.cs:402-418`, and `systems/worldTick.js` verbatim), so
  the journey's vanilla drain IS DFU's - and Travel Options watches that
  very number with its own cautious stop (`TravelOptionsMod.cs:1079`,
  ported at `travelOptions.js:1083`). The NEEDS are this port's own
  addition, from a mod Travel Options has never heard of, and they
  charged on top of it on a traveller who by construction never stops to
  eat, drink or sleep. An accelerated journey is sat as `resting` now -
  the needs' OWN knob for exactly this. Every accrual (hunger's marker,
  thirst, sleep debt, wet, exposure) sits outside it, so the days really
  pass and the traveller still arrives as hungry as the ride made them.

  **AUDIT-FIELD corrected this bullet's own arithmetic, and it is worth
  keeping the correction visible.** The first cut of this record said the
  needs "charge several minutes of fatigue in the frame the vanilla band
  charges one". That is false. Game-minutes per frame are `dt * 0.2 *
  scale` with `dt` clamped to 0.1, so a frame carries 0.2 minutes at 60
  fps and the mod's default limit of sixty, and at most 2 at its ceiling
  of a hundred; `runSurvivalMinutes` walks `[last+1, now]` and the band
  asks "did the minute change" - **they run 1:1**. The surcharge is in
  MAGNITUDE: DFU's band is 11 a minute and the needs stack starving 4,
  parched 6 or dehydrated 12, exhausted 8, heat 6 and bare feet 4 on top
  of it once their stages are reached, roughly three times the drain.
  Nor does the fix make a journey endless, which the first cut also
  implied: 11 a minute empties a 6400 pool in 582 game-minutes whatever
  this line does. That is DFU's own number at DFU's own rate, and
  collapsing on a long RECKLESS ride is the mod's designed loop - camp
  out, stop at inns, or travel cautiously and be paused at the fatigue
  floor. What the line removes is the port's own surcharge on top, so an
  accelerated journey costs what it costs in DFU and no more.

  **And `resting` holds two HEALTH arms with the fatigue ones** (F12),
  which the first cut did not disclose: the bare-skin block's naked-cold
  and sunburn ticks (`needs.js:516`), and, for a traveller who is also
  `byFire`, the exposure damage at `:422`. Harm you cannot answer while
  the autopilot holds the controls is not a loss worth keeping. The law
  is executed now, not matched: `test/surv7_feed.test.js` runs ten game
  hours with the knob both ways and asserts fatigue held at zero while
  every accrual lands on the same number.

- **"Doesn't travel on the road" - nothing was broken; nothing said
  how.** The mod does not route along roads to a named destination and
  never did: an autopilot beelines, and PATH FOLLOWING is a separate
  mode the player starts with a key while standing on a path and facing
  the way they mean to go (readme: *"If a key is set, default 'F', then
  you can follow paths by standing on them and facing the direction you
  want to travel and pressing the key"*), which stops itself at a
  location or a junction of more than two ways. The port had to move
  that key off the mod's own F - this skin spends F on SOC5's
  SocialInteract (I1) - so it ships on K, the one of the mod's six
  letters nothing here answers. The only place the port named it was the
  help text INSIDE a running journey, which a player who has never
  started one cannot reach. The held map's travel card names it now,
  whenever roads integration is on and a key is set: *"On the road,
  press K to follow it."*

- **AUDIT-FIELD F10: and SURV6's hunting roll is held with them.** The
  wilderness roll fires once a GAME minute, so an accelerated ride rolled
  it every few real seconds, and every event opens a Yes/No box through
  `townTalk.showOverlay` - which the mod reads as a foreign window on top
  and answers with `interruptTravel()` (`TravelOptionsMod.cs:1348-1356`).
  A wilderness journey could not survive its own first minute. This fits
  "doesn't travel" better than anything else the arc found, and it is the
  same shape as the needs' surcharge: a thing the port added that Travel
  Options has never heard of, charged at the mod's clock.

- **AUDIT-FIELD F7: the look-ahead is a FLOOR, not the whole distance.**
  `TRAVEL_LOOKAHEAD = 64` was called "more than the fastest accelerated
  step", which is true of a fixed physics step and false of a FRAME: the
  motor moves `speed * min(dt, MAX_FRAME_DT) * scale` in one go, so a
  horse at the shipped default limit covers ~65 units in a 10 fps frame
  and ~120 at the mod's ceiling - past a 64-unit probe, off the built
  world, and once the motor is airborne `airControl` is false, so zeroing
  the drive on the NEXT frame no longer steers. `travelLookaheadFor`
  measures the frame that is about to run and keeps 64 as its floor.

- **AUDIT-FIELD F8: and the gate is a pure function now.** TO-FIELD
  pinned this whole fix with regexes over `world.js`'s own source, which
  pass iff the author's bytes are present and prove nothing about what
  the gate does - a sign flip on the bearing would have probed the ground
  BEHIND the traveller, always built, restoring the bug whole with every
  pin green. `travelDriveForward` and `travelLookaheadFor` live in
  `systems/travelAutopilot.js` beside the autopilot, for the reason that
  file is pure: the pins drive them on a table. Six mutants ride them.

Pinned in `test/to1_travelOptions.test.js` (TO-FIELD) with three
mutants - `travel-drive-ungated`, `needs-at-travel-scale`,
`follow-key-unsaid`. `tools/mutants/surv7.json`'s
`SURV7-the-world-feeds-the-dungeon-too` was re-aimed by content onto the
reader's new three arms.

## ROAD-CRASH (2026-09-23) - the ring walk's dead frame

Discord, through Mac: *"crashes while traveling on roads with travel
options"*. No crash text came with it; the whole follow path was read
for a throw the frame loop cannot survive, and there is one.

**The throw.** `FollowPath`'s third arm walks the border ring of a town
(`:658-664`; `travelOptions.js:747-767`). Unlike the two path arms
before it, it never forgot the named destination, and `InterruptTravel`
"leaves current destination active" (`:1273`) - so a ring walked after
ANY stopped journey (a foe, low fatigue, CAMP, the map's own stop near
a town) ran with that name still set. That is the one condition under
which `InitLocationRects` keeps refreshing the rects MID-journey
(`:606-612`, `autopilot == null || destinationName != null`;
`travelOptions.js:695-698`). A town's ring reaches into its neighbour
pixels; the crossing fired `OnMapPixelChanged`, the host's
`locationTileRect` answered null for the neighbour (world.js:12872 -
null both for a pixel not yet built and for one with no location),
`SetLocationRects` nulled both rects (`:602-604`), and the walk's own
`OnArrival` (`circumnavigateLocation`, `:753-797`) read
`locationRect.zMax` off null on the ring's edge branch. In Unity that
is a NullReferenceException logged per frame and the mod stalls with
the panel up; this host's frame loop dies on it, and `main.js`'s
overlay prints the stack in red. Three fixes, at the root:

- **The ring arm forgets the name** (`travelOptions.js:764`), as the
  two path arms do. With the name gone the rects hold for the whole
  walk exactly as they do for every path leg, and everything else that
  reads `destinationName` now reads the walk as the followed path it
  is: the follow key stops it (`:1358-1362`), an avoided encounter
  resumes IT rather than the old named journey (`:1210`), the
  LocationPause "nearby" arm stays out of it, and `isPathFollowing` is
  true. Departure 16.
- **The walk guards its rects** (`travelOptions.js:862-866`) - the
  seam's own guard for a state the mod cannot survive either. A walk
  whose rects are gone ends where it stands, as a junction's does
  (`:1063`, CloseWindow, whose host onClose is InterruptTravel; a host
  whose panel is already down is interrupted outright), and the follow
  key asked again answers "no path here" through `FollowPath`'s own
  rect test.
- **The recovery walk's give-up is a junction** (`travelOptions.js:832`).
  `nextPathDirection` returns the mod's RAW mask when its nine shifts
  narrow nothing (the reset at zero is not a rotate: from north the
  walk visits only N, NW and W, so a pixel with E and SE faced from the
  south is never narrowed), and `GetTargetPixel`'s `default` arm makes
  that a leg to the pixel the player stands in - arrived before it
  starts, `OnArrival` again next frame, the panel up and the clock
  racing until the player finds the key. A pick that is not one edge is
  a junction here: stop, say so, map up. Departure 17.

Pinned by execution in `test/roadcrash.test.js` (4): the interrupted
journey's stale name and the ring arm clearing it, the rects holding
across a crossing into a null-answering neighbour and the corner
arrival going on round the town; the null-rect state shown to throw in
`circumnavigateTarget` and the guarded walk ending cleanly, then "no
path"; a host with no panel stopped outright; the three-bit give-up
proved on `nextPathDirection` and answered as a junction, with the
two-edge carry-on untouched. Four mutants in `tools/mutants/roadcrash.json`
(`RC-ring-keeps-the-name`, `RC-walk-reads-null-rects`,
`RC-guard-closes-but-leaves-the-leg`, `RC-giveup-is-a-leg`), all dead.

## TRAVEL-NAV (2026-09-25) - the walk goes round, and stops short

Mac, before the merge: *"Improving travel options navigation to properly
route around objects and stopping before running into buildings.
Currently it could be so much better"*.

**What was there.** The autopilot answers ONE bearing - to the centre of
the target rect, latched at each pixel crossed - and the mod pushes the
body along it at up to a hundred times walking pace. Nothing between the
two knew anything stood in the way: a house, a city wall, a well or a
World of Daggerfall boulder on the line was walked into, and the body
ground against it with the clock racing until the player noticed. DFU's
CharacterController slides along the face, so the mod's own journeys do
the same, and this port's collider honours that controller's contract.

**What is there now** - `src/systems/travelSteer.js`, the port's own,
between the autopilot and the motor. The mod still decides where the
journey is going and when it has arrived; the steering decides only how
the body gets there this frame:

- **The feelers are the collider's.** A heading is a CORRIDOR: three
  feelers, the centre and two edges 0.45 either side (the capsule's 0.35
  and a hand's breadth), each cast through the host's own collider
  (`createColliderProbe`, `collider.raycastHit`) from the feet the motor
  moves, 0.6 over the ground - over any step the motor climbs, under
  anything it cannot. The terrain is not in the collider's buckets, so a
  level ray runs into a hill and passes under the house on top of it; the
  feelers follow the ground in eight-metre legs instead, and a face flatter
  than the slope limit is a ramp to walk up, not a wall - RIDDEN, so it
  hides nothing behind it (TRAVEL-NAV2, below).
- **An open road is the mod's journey to the bit.** While the way wanted
  is open the drive leaves the steering exactly as the autopilot made it -
  the bearing, the force, every last bit - and costs three feelers.
- **Round it.** When the way closes a DETOUR begins: a side is chosen (the
  nearer edge, found by trying both sides a step at a time; or the last
  detour's side for forty metres, so a row of trunks is passed on ONE side
  and not threaded left-right-left), and a fan of headings is laid out
  from the way wanted AS IT WAS - a fan that turned with the moving target
  swung the body back into the wall it was walking round, which is what
  the first cut did in the simulation. Each frame the steering tries the
  way the detour began (which is how a gap is found as the body passes in
  front of it, and a corner turned), then one offset closer, then keeps
  the offset it holds while that still has room for the frame (half its
  reach, never less than a step past the stand-off), and only then scans
  outward. Opening needs the whole look-ahead and keeping only that room:
  the gap between the two is the hysteresis.
- **The pocket.** A heading that closes on the line must be seen clear
  PAST the face that blocked it (the Bug2 leave rule), and a detour ends
  only on a view that really reaches past it - a heading so shallow that
  the cap stood in for the distance has seen nothing, and the first cut's
  long wall restarted its detour budget for ever on exactly that. Inside a
  U the way wanted is open for the depth of the U and no further, so the
  walk backs out and goes round the arm, once.
- **Back on the line.** The mod's bearing is latched until the next pixel,
  so a body left beside the line after a detour walked parallel to the
  road it was following. The steering keeps the line itself - where the
  leg began, to the target's centre - and pursues a point eight metres
  along it until the body is back within a quarter-metre, then hands the
  mod its own bearing back.
- **Short, at every acceleration.** A frame's reach is a BOUND
  (`travelFrameReach`: speed x scale x the frame clamped to Unity's
  maximumDeltaTime, plus the one fixed step the accumulator can carry),
  the feelers are cast that far, and the force is capped so the frame
  cannot carry the body past a metre short of what its corridor saw -
  at x100 a hitching frame moves a horse a hundred metres. The way wanted
  only has to be clear as far as the ARRIVAL RECT (`rectDistance`), so a
  town's walls behind its buffer are no reason to turn away from the town,
  and never less than a step past the stand-off, so a body can never park
  there with the clock racing.
- **Stop, and say so.** No heading on either side with room (the other
  side is tried once), a detour that has walked two hundred metres without
  getting past its obstacle, a body that stops moving while the drive
  asks it to (GRINDING - something the feelers cannot see; measured against
  the travel the host REALLY applied after its ground gate, so a drive held
  for the streamer is not grinding), or one that walks four hundred metres
  without once coming a metre nearer its target (NO HEADWAY, TRAVEL-NAV2,
  below) ends the journey the way the mod's own
  stops do: last in its Update, the panel closed (InterruptTravel - the
  destination stays for the map's resume prompt), a message box in the
  mod's voice - *"Paused the journey since the way ahead is blocked."* or
  *"...since you're making no headway."* (`TRAVEL_NAV_TEXT`, kept out of
  the mod's CSV table, whose pin says nothing was invented in it) - and the
  frame that stops it moves nothing.
- **Cheap.** Three feelers a frame on an open road, about five in a
  detour's frame, never more than sixteen: a scan that would cast more is
  resumed next frame with the body held for the one frame it waits. A
  feeler is not one ray (TRAVEL-NAV2's audit): the collider probe casts it
  a leg at a time, so a feeler to a hitching x100's look-ahead is dozens of
  `raycastHit` calls - measured over a forty-bucket town, 0.2 ms a frame at
  the worst pace and 0.06 at an ordinary one. The
  input, the output, the frame's scratch and the probe's origin, direction
  and hit are made once and reused (`raycastHit` gained an optional `out`
  for it - without one its answer is the one it always was). The walk over
  the collider's buckets inside `raycastHit` is older than this and still
  makes its Map iterator a ray; it is every ray caller's, not this one's.

**The arrival stand-off, checked.** A named location's rect is its RMB
footprint grown by `ARRIVAL_BUFFER` (800 world units, twenty metres), and
every building of a location stands inside its footprint, so a journey
that arrives in the buffer arrives outside the walls. A followed leg ends
at the town's BORDER rect, one or two tiles outside its ground tiles. Both
hold for a location smaller than its pixel - with one hole, departure 19:
the arrival question is asked only in the destination PIXEL, and a location
eight blocks across fills its pixel
(`getLocationTerrainTileOrigin` centres it at zero), so its buffer lies
wholly in the neighbours and the traveller walked up to the walls, crossed
into the pixel AT them and only then asked. With the switch on the buffer
is an arrival wherever it lies (`TravelAutopilot`'s `edgeArrival`) for a
NAMED destination. Flown on the table: outside the walls at x1, x60 and a
hitching x100, where the mod's own arm walks into the wall and never
arrives. A followed LEG into such a city is not given the same arm
(TRAVEL-NAV2's audit, left so on purpose): a leg's arrival hands
`SelectNextPath` the pixel the body stands in, and outside the city that
is a neighbour with no location, whose road leads straight back in - a
leg that arrived before it began, every frame. So a leg into a walled city
of eight blocks arrives through its gate, and at a gate shut for the night
the steering walks the wall and stops on its budget.

**The facing the mod reads is its own.** In DFU the autopilot writes the
camera's yaw every frame (`PlayerAutoPilot.cs:96-104`), so "the way the
player faces" during a journey IS the bearing, and the mod leans on that:
a leg's arrival picks the next edge by it (`SelectNextPath`,
`TravelOptionsMod.cs:722-751`), the ring walk its next corner, the
junction disc its pip. The steering turns the camera with the body, so on
a frame it did, `yawDeg` reads the autopilot's own bearing - otherwise a
leg that arrived while the body was backing out of a pocket read the
turned camera and sent the journey back the way it came.

**The switch.** `GeneralOptions.AvoidObstacles` is the port's own key on
the mod's pane (HT-WAIST's shape on Handheld Torches: the vendored
`modsettings.json` does not carry it, its words say so), ON by default,
curated onto the mod's tile so it is reachable, read at boot with the rest
of the mod's settings (the tile's "Takes effect when the world next
loads"). Off, the journey is the mod's beeline and its pixel-gated arrival,
exactly.

**The first-person switch (OW-TOGGLE, 2026-09-28).** `GeneralOptions.FirstPersonTravel`
is the port's own key on the same pane, the same shape, OFF by default and on
the tile - but read LIVE, not with the settings at boot: a flip takes effect
at once (AUDIT OW5 T1), and its words say so. The Overworld's OW-ONLY
(`06-Systems/Travel-View.md`) made every walked trip on the enhanced interface
the Overworld's; on, this switch gives the mod's own first-person journey back
- a map pick walked on the ground, the mod's resume for it, the view neither
raised with it nor stopping it (`test/ow_toggle.test.js`). A journey of the
mod's own begun at a boat's helm meets the mod's own ocean stop, as the mod
does (AUDIT OW5 S1: the Overworld's crossing alone stands it down).

**Its roads (TO-ROADS, 2026-09-29, FIELD BUGS 2026-09-29d).** `GeneralOptions.FirstPersonTravelFollowsRoads`, the
same shape again, OFF, beside it on the tile: with First-Person Travel on, a map pick is the Overworld's route - its
planner, its join, the peaks and the water, its refusals - walked by this mod's autopilot leg by leg, in first person.
A departure from the mod, which never routes to a named destination (TO-FIELD above) - off, it is the mod's beeline
again. `06-Systems/Travel-View.md` TO-ROADS (`test/fb0929d_toroads.test.js`).

**Not done, and said.** A gap barely wider than the corridor is threaded
when it is on the line, or found while the detour walks past it at a
stroll; at speed a body can step past a narrow gap to the side in one
frame, and the detour then goes round the wall or stops on its budget.
The feelers run at one height, so an overhang between chest and head is
not seen (grinding catches what it stops). The walking townsfolk, the
foes and the horses are not in the collider, so they are not steered
round - as before. And the mod's own overshoot arm (a bearing that swings
five degrees in one update is an arrival) can end a LEG early while a
detour turns hard close to its target at high acceleration; the next leg
starts from where the body is, which is the mod's own answer.

Pinned by execution in `test/travelnav.test.js` (19 of its 22 - TRAVEL-NAV2
added three): every layout the
request named - a building across the line, a wall with no gap, a U-shaped
pocket (and one deeper than the look-ahead), trunks across and along the
line, a narrow gap on the line and one off it, a wall behind the arrival
rect - flown on a table with a motor that steps as `motor.js` steps, at x1
to x100 and a hitching frame, walking and mounted; each flight asks
whether it arrived or stopped where it should, whether it EVER touched,
whether it dithered, and what each frame cost. Then the flip and the
dead-end stop, the tie toward the line, the committed side, grinding and
the host's held drive, the arrival stand-off with the real autopilot, the
door (`steerDrive`), the mod's stop and switch and facing on the mod's own
rig, the feelers through a REAL collider (a wall, a step, a ramp, a house
on a rise, a deck), `raycastHit`'s `out`, the switch's key, and the host's
wiring. Forty mutants in `tools/mutants/travelnav.json`, all dead; the
first campaign left two survivors (the stand-off margin on a frame capped
by clearance, and the goal cap) and the pins for them were written.

## TRAVEL-NAV2 (2026-09-25) - the review before the merge

Mac: *"Audit before we merge"*, of the slice above and its request -
*"Improving travel options navigation to properly route around objects and
stopping before running into buildings. Currently it could be so much
better"*. The review flew the steering over some fifteen hundred fuzzed layouts
(random buildings and trunks, every pace the mod allows, walking and
mounted) beside the table flights, and cast its feelers through a real
`Collider` at shapes the slice had not tried. Three things were wrong, and
are fixed in `src/systems/travelSteer.js`:

- **It could walk for ever.** In a tight layout - one building sending the
  detour one way, a second building's corner and two trunks catching it -
  a detour ended the moment the way wanted opened and a new one began a
  frame later, each with a fresh budget; grinding never fired because the
  body never stopped moving. The old steering walked the fuzzed case four
  thousand detours at x1 and two hundred kilometres at x60 without
  stopping, the clock racing the whole time. The slice's brief had named
  exactly the missing check - stuck detection as the distance to the target
  not shrinking over a window: now four hundred metres walked without once coming a metre
  nearer the target (a leg at a time) stops the journey with the slice's
  own *"Paused the journey since you're making no headway."* The budget
  is twice the detour budget, so a detour honestly going round a long wall
  still ends on its own budget and says *blocked*.
- **A ramp hid the wall at its head.** A feeler that met a face it could
  walk on gave up the rest of its eight-metre leg, so a wall standing at a
  ramp's top, or a boulder's steep face above its gentle one, was never
  seen and the body was driven into it at full force; and the next leg,
  back at the ground's height, started INSIDE the deck the ramp led onto
  and read the deck's far side as a wall 30 m out. The feeler now RIDES a
  walkable face (on from it, 0.6 over it, to the leg's end, so the next leg
  starts over the deck and meets its top again while it goes on) and goes
  on UNDER a face met from beneath - four faces a leg, after which the
  rest of the leg is taken as seen, which is all any face bought before.
  The ride is not carried past the next leg, so a fence in the dip after a
  mound is still met.
- **A jump was read as a walk.** The travel map is a window the journey
  runs under (`TravelOptionsMod.cs:1351`'s `DfTravelMapWindow` exception),
  and a ship taken from it teleports the body with the autopilot still
  set; the mod re-aims from the new pixel, but the steering kept its line
  from the old one and pursued it - sideways, for as far as the ship had
  carried the body - and a teleport mid-detour charged the whole distance
  to the detour's budget and stopped the journey as blocked. A body that
  moved further than 64 m and four times what the last frame could carry it
  was put there: the line starts again from where it landed, and nothing
  the jump covered counts as walked, grinding or headway.

Checked and left as they are: the per-frame cost (above, **Cheap** - a
feeler is a leg's worth of rays, and it is small); a followed leg into a
walled city of eight blocks (above, the arrival stand-off - its arm is not
the named destination's, on purpose); a gap barely wider than the corridor
off to the side at speed (**Not done, and said**). A try at dropping the
committed side when a detour begins again where the last one ended found
the fuzzed case's route, and lost five others in eleven hundred layouts, so it
was taken out again. The four hosts: the journey is wired in
`scenes/world.js` alone (## The four hosts) - `scenes/exterior.js` has no
travel map, and `scenes/worldModes.js` and `scenes/dungeonContext.js`
never run a journey.

Pinned in `test/travelnav.test.js` (three tests, each failing with
`src/` set aside while the other nineteen pass): no headway on its own, a
leg at a time, and the fuzzed layout flown at x1 and x10 (arrives or
stops, never touches, never for ever); a jump - the mod's bearing from
where it landed to the bit, the line started again, nothing charged, and a
hitching x100 frame's 150 m still a walk; the feelers through a real
`Collider` - a wall at a ramp's head, a closed ramp onto a deck read as
clear, a rail on the deck met where it stands, a wall behind a face met
from beneath and a low block on it met on the line, a fence after a mound,
and the rides bounded. Fourteen mutants in `tools/mutants/travelnav2.json`,
all dead; the forty of `tools/mutants/travelnav.json` re-run, all dead
(`TN-ramps-are-walls` re-aimed by content at the probe's new wall test).

## SPAWN-TRAVEL (2026-09-25) - the nearby pause beside a spawned dungeon

A crash report from play online: *"Error finding location Daggerfall : The
Jubul Monastery (208,189)"*, thrown out of the travel frame. The nearby
pause (`LocationPause` "nearby", `:1391-1400`) discovers the location the
autopilot stopped beside - `PlayerGPS.DiscoverLocation(CurrentRegionName,
CurrentLocation.Name)` in the mod - and the world host filed it BY NAME,
through the quest bridge's `discoverLocation`, which is C#'s throwing
lookup over the MAPS tables. An online spawned dungeon
(`world/spawnedDungeons.js`) is a template's clone named `"<name> (x,y)"`
and stands in no MAPS table, so the name could never resolve and the
throw took the frame down the moment the pause stopped beside one.

In DFU the name only ever resolves back to the location the player
stands in, and the hook already holds it (`currentLocation`, the music
arm's location with its `mapId`). So the hook now files that location by
its own id - `discovery.js` `discoverLocation(mapId, { regionName,
locationName })`, the very write the pixel-entry discovery makes - which
is the same record for every MAPS location and the right one for a
spawned dungeon, whose id is its own (the salt over the pixel). The quest
bridge's name path keeps its throw: a quest only ever names a MAPS
location, and `map_reveallocation` catches it as DFU's console does.

## TRAVEL-STRAFE (2026-09-26) - the hand's sidestep, and a detour that ends where it began

A player's report, verbatim: *"Can't move laterally after fast travel
pathing update - A and D no longer strafe while fast traveling after the
pathing update, making it impossible to avoid obstacles (pathing just runs
into them and goes back and forth)"*. Two faults, both TRAVEL-NAV1's.

**The sidestep was pursued back.** The strafe keys still reach the motor
during a journey (AUDIT-TO1 K2 keeps them, as DFU's InputManager goes on
collecting them under the panel's `pauseWhileOpened = false`), but BACK TO
THE LINE turned the drive toward a point PURSUIT metres along the line
the moment the body stood ONLINE off it: a held strafe settled about eight
metres out (the drive's pull and the strafe's push balance at 45 degrees)
and snapped back when let go - into what the player was stepping round.
Flown: D held five seconds on an open road stepped 6.5 m off at x1 and
came back; A held to step round a house touched it and stopped, stuck.
Now the host hands the steering the strafe the motor was given
(`travelNavFrame.strafe`, written after the motor as `asked` is;
`steerDrive` makes it the steer's `manual`), and while it is held the line
begins under the body, a detour running is ended, no detour starts (the
mod's bearing, its forward still capped by the stand-off - on the whole
corridor since AUDIT TRAVEL-STRAFE, below, which also says what the
strafe's own step does), and nothing walked counts as grinding or no
headway. Let go, the line runs from where the hand left the body to the
target's centre - the sidestep is kept and the walk converges on the
target from there. The same flights: 15.6 m off and kept; the house
stepped round by hand, no detour of the steering's own, never touched;
600 m walked by hand along a wall with no gap, held at the stand-off, and
never stopped.

**A detour ended behind its start.** The way wanted is judged open
against the look-ahead and the pocket rule; a body that backed off a
corner (the fan's heading going past 90 degrees) could see it open for a
frame while standing behind where the detour began, end the detour, walk
into the same face, and begin a fresh one - with a fresh budget and its
side re-chosen - for ever: one "back and forth", bounded only by the
headway budget (the other was inside one detour, and stayed until AUDIT
TRAVEL-STRAFE 3, below). TRAVEL-NAV2's fuzzed layout was pinned as "arrived, or
stopped for no headway" and it stopped: 886 detours and 470 m at x1. A
detour now ends only when the body is at or past where it began along the
line (`f.along >= s.sStart`). That layout arrives in two detours at every
pace; a fuzz of 339 random town layouts (dense boxes, trunks by their corners) at x1, x10 and x60 went from five
"stuck" flights and six of more than ten detours to none, and nothing
touched. It did add stops where the base arrived - a fuzz that size
did not show them, and AUDIT TRAVEL-STRAFE 2, below, counts them.

## AUDIT TRAVEL-STRAFE (2026-09-27) - the slice audited

A read-only audit of TRAVEL-STRAFE found five things. Three are fixed in
`src/systems/travelSteer.js`, one in the pins, one is said. **The fuzz**
below is the audit's: six kinds of layout (a town, a dense town, trees,
walls with a gap and U shapes, a pocket round the target, a target off to
the side), 400 seeds each, nine paces (x1, x10, x60 and x100 at 1/60 s
frames, x60 and x100 at 0.1 s, x100 at 0.25 s, x10 and x100 with a frame
in five hitching), walking and mounted: 43,200 flights to a target 100 m
on, and 28,800 to one 2 km on that pass when 30 m past the obstacles
(MID-JOURNEY - no arrival arm can hide a stop there).

**1. The frame the key is let go.** The host hands the steering the strafe
a frame late: `travelNavFrame.strafe` is written after the motor, and the
mod's update, where the steering runs, comes before the frame's axes are
read. Reading them sooner means moving `moveAxes.update` above the mod's
update, so the lag stays and the steering answers for it: the frame the
key is let go is still steered as the hand's while the motor walks
straight on. That frame was capped on `corridor(f.want, ..., openWant)`,
which answers on the first feeler short of the look-ahead - the centre
alone, when it is short - and outside the hand a short way starts a
detour, so it never mattered. House A across the line, house B up the
street behind A's left corner, A held along A's face and let go as the
body's centre cleared the corner: the centre feeler saw B seven metres on,
the right edge's never-cast feeler would have seen A's corner a metre off,
and the frame walked 0.73 m into a gap of 0.65. Flown with the host's lag
and `motor.js`'s diagonal, 101 let-go points each: 41 touched at x10, 23
mounted, 33 at x20, 11 at x60, 63 at x10 mounted with Realistic Riding's
0.4 strafe; none now. Under the hand the corridor is cast whole - three
feelers (`corridor(..., inp.manual ? 0 : openWant)`).

**2. The end rule's cost.** "A detour ends at or past where it began"
turned 102 stops into arrivals and 45 arrivals into stops near the target,
104 and 27 mid-journey. A detour now also ends when the body is no farther
from the target than where it began (`toGo <= s.goStart`, kept beside
`sStart`): one begun off the line, or past the target at a hitching pace
(the line ends at the target, so nothing on it is past - the fuzz's pocket
seed 43 at a hitching x100 stopped on its budget at 451 m), could not end
at all. That keeps the 102, turns 29 more stops into arrivals and none
back, and leaves 16 of the 45 and all 27 mid-journey; no one-line rule was
found for those. With 3 (below) in as well, the rule against no end rule
at all: 101 stops into arrivals and 17 back near the target, 102 and 27
mid-journey - five of the 17 at x1 or x10 (walls seed 304 and seed 21 at
x1, walking and mounted; dense seed 199 at x10), the rest at x60 and x100,
all but one in hitching frames. Dense seed 365 at x10, the audit's other
named cost, was 3's shuttle - the rule had turned the base's
end-and-begin-again into a shuttle inside one detour - and it arrives now
(169 m, two detours; the base 138 m). The known cost, pinned: walls seed
304, a U open to the east and a wall with a gap through it. The third
detour begins deep in the U, heading west; the way out is east round the
wall's far end, the rule makes it come back level with where it began, and
its two hundred metres run out ten short - it stops at 450 m, untouched,
where the base took a view from behind its start and arrived in 427 m and
four detours. Tried and not taken: a detour ends behind its start unless
the last one did within COMMIT metres. Against the base it lost 1 flight
for 94 gained near the target and 1 for 102 mid-journey, against
TRAVEL-STRAFE 11 for 47 and 5 for 29 (most of the losses at x100 in
hitching frames); with 3 in beside both, it gained 17 on the rule kept
here and lost 12 near the target, gained 27 and lost 5 mid-journey - too
little for a rule that takes a view from behind a start again.

**3. The other back and forth.** The report's "goes back and forth" had a
second cause, inside ONE detour and older than the slice. The fan tries
the way the detour began (REF) first every frame; held into a dead end it
closed, the scan found nothing open short of back the way the body came,
and a few metres back REF opened again - its only test was the view past
the FIRST face that blocked the line. The fuzz's dense seed 14 at x1: a
7.6 m shuttle about 26 times in 62 s and a stop as blocked, beside a slot
of 1.7 m no corridor fits from inside the channel. Six or more
REF-and-back switches in one detour, 1200 flights a kind (200 seeds, x1,
x10 and x60, walking and mounted): 12 dense, 14 walls, 8 pockets round the
target, on the base and TRAVEL-STRAFE alike. Now a held REF that closes
makes the face it met the one to get past (`sBlock`, moved on to it along
the line, never back): REF is taken again only when seen past it. Now 0, 1
and 7 - the seven are detours begun past the target, whose REF runs across
the line and is never held to its `past`. What it costs, flight by flight
(AUDIT TRAVEL-STRAFE2 2): every arrival TRAVEL-STRAFE made and this does
not make is 3's - 2 alone loses none against TRAVEL-STRAFE, and its "16 of
the 45" and "all 27" above are counted against the base. The two together,
against TRAVEL-STRAFE, turned 245 stops into arrivals and 30 arrivals into
stops near the target, 269 and 48 mid-journey; against the base, 317 and
45, 371 and 73. At the paces players use, the 30 and 48 are: none at x1;
one at x10 (walls seed 203, mounted, near the target and mid-journey); at
a hitching x10, 2 near the target and 3 mid-journey; at x60, 2 and 1. The
rest are at x100 - all but 5 and 4 of them in hitching frames, 26 of the
48 in 0.25 s frames, where a mounted frame carries 275 m and one sideways
step can spend a detour's whole budget - and one each at x60 in 0.1 s
frames. Mounted and mid-journey at x100 in 0.25 s frames is the one bucket
of pace and mount that ends below TRAVEL-STRAFE: 1,341 of 1,600 to 1,335
(the base 1,342). And the pockets round the target gained nothing: near
the target they arrived 4,832 times on the base, 4,832 on TRAVEL-STRAFE
and 4,831 now - the seven shuttles 3 leaves are theirs. All told, near the
target the base arrived 39,047 times, TRAVEL-STRAFE 39,104 and this
39,319; mid-journey 27,160, 27,237 and 27,458. Nothing in any flight
touched.

**4. The pins could not see 1.** The rig handed the steering the same
frame's strafe and walked a held pair at one speed; it now hands it a
frame late and walks both axes at `DIAGONAL_FACTOR` when both are live, as
the host and `motor.js` do - and the let-go frame is flown. Mutants that
passed the 25: the door taking only a full throw (Realistic Riding's 0.4,
a stick's throw and the MovementAcceleration ramp are strafes too), the
hand capped on the first feeler short, a detour let off after 50 m, the
hand's walk away from the target charged to headway once let go, and the
bounds moved a hair - all pinned now.

**5. The strafe's own step is not felt.** Said, not fixed. No frame casts
a feeler sideways, and the frame a key is pressed is still steered as the
journey's (the lag's other edge): at x60 a mounted 0.4 strafe is three
metres a frame, a hitching x60's held A nineteen. Beside house A, 101
flights each: at x60 mounted with a 0.4 strafe, 85 walked into it (9 with
the strafe handed on time); at x60 in 0.1 s frames with A held, 101 (81).
The collider slides the body along the face, as DFU's controller does. At
x10 and x20 the step is a metre or two, and none touched. A side feeler
would need the host to cap the strafe axis after the steering has run, the
frame's own strafe unknown to it and the diagonal step between the two
feelers unseen - a redesign, not a patch.

Pinned in `test/travelnav.test.js` (four tests - three failing on
TRAVEL-STRAFE's steering while the others pass, the fourth pinning what
was right and unpinned): the let-go frame and the whole corridor by the
numbers; the nearer end by the numbers, the detour begun past the target
(pocket seed 43, x100 in 0.1 s frames) arriving, and walls seed 304
stopping as the known cost; the channel (dense seed 14 cut down to its
three houses) and dense seed 365 gone round rather than shuttled, and the
face REF met by the numbers (never nearer, and a heading along the face
moving nothing); any strafe the door's `manual`, and a 600 m sidestep
charged nothing once let go. Fourteen mutants in
`tools/mutants/audittravelstrafe.json`, all dead; the lists of TRAVEL-NAV
(40), TRAVEL-NAV2 (14) and TRAVEL-STRAFE (7) re-run, all dead
(`TRAVEL-STRAFE-a-detour-ended-behind-its-start` re-aimed by content at
the end rule's new line).

## AUDIT TRAVEL-STRAFE2 (2026-09-27) - the audit audited

A second audit re-flew the first's fuzz, byte for byte, and ran more
mutants. 3's cost had been stated in part; it is stated flight by flight
now (3, above). Five mutants passed the 29 pins:

- **The hand cut at a step past the stand-off** (`inp.manual ? pass :
  ...`): the whole corridor was pinned only with the centre seeing past
  1.5 m, and a centre short of that still answered alone - up to half a
  metre nearer an edge's face than the stand-off. Pinned: a centre at
  1.3 m and an edge at 1.05, and the cap the edge's 0.05 m, not the
  centre's 0.3.
- **A held REF's face** moved by `c` rather than `c * fw`, only by a REF
  within 60 degrees of the line, or by any REF at all: every pin held REF
  straight up the line. Pinned: REF at 70 degrees to the line, the face it
  met 1.2 m on standing 1.2 cos 70 = 0.41 m up the line, and REF across the
  line (a detour begun past the target) moving nothing.
- **The hand clearing grinding.** That grinding still runs under the
  hand was said nowhere and pinned nowhere. What the hand walks is
  movement, so it never reads as grinding; a hand that moves nothing is no
  licence to grind. Pinned: a sill ahead and a kerb to the right, both
  under the feelers, D held into the kerb - stopped as stuck, as promptly
  as without the key.

Eleven records in `tools/mutants/audittravelstrafe2.json` - the five, and
six the pins already killed - all dead. And the cite shift had carried
stale `world.js` cites along, wrong before it; they name their lines by
content now: `travelAutopilot.js`'s `player.update` call,
`travelControlUI.js`'s `_overlayHeld` (it had named a `maps.getRegion`),
`Quest-Arc.md`'s two classic-spell reads, `Combat.md`'s
`onPlayerArrowHitFoe`, Port-Status' `currentWeatherKey` and, on the same
row, the `CleanupUntrackedObjects` sweep and its missile half in
`hostMagic.js`, and `test/qx1_exterior_host.test.js`'s
`getClassicSpellEffects`.

## RISE-STUCK (2026-09-27) - a death ends the journey

Ninilac, online: *"Was fast travelling ... my character just decided to climb a wall that was in the way and died. I
clicked "rise now" but the death screen didn't go away"*. The mod's autopilot runs under ANY paused window (:1343-1345,
written for the travel map over the journey), and the death screen is one - so through a death the journey kept the
x60 scale, the drive and its arrival test, and the respawn's teleport could read as the arrival and push `MsgArrived`
over the screen, burying it (`06-Systems/Online-Arc.md` RISE-STUCK has the rest). In DFU the question never comes up:
a death ends in the title menu three seconds later. The port's online death respawns, so the world host's death
presenter now sends the mod's own `pauseTravel` message (MessageReceiver, :1258-1320) once the screen is up, guarded
(AUDIT RISE-REST F4: the presenter runs inside the one damage door, and a throw from the stop must not cost the
screen) - the message another mod sends to stop a journey: CloseWindow -> InterruptTravel, the scale back to one, the autopilot
gone, the destination KEPT for the map's resume prompt. Not a departure: the mod's own door, from a caller DFU does
not have. Why the journey climbed the wall at all was not looked into (TRAVEL-NAV's steering means to stop short).

## SHIP-PORT (2026-09-28) - the deck is no port

The Discord through Mac: *"a player is at a port but unable to set sail"*. The batch's record is
`01-Overview/Field-Bugs-2026-09-28e.md`; the three this arc owns:

- **The deck.** A player who bought a ship and boarded it in a harbour stands on "Your Ship" (the bank's
  `SHIP_COORDS`, 2,2 or 5,5). The map's ship laws asked `IsNotAtPort` of that pixel, which neither list carries (the
  mod's 378 harbours, or the MAPS byte's 343 - measured against the retail MAPS.BSA: every one of the 343 is among the
  378, so the two lists never refuse a real port between them), so By ship was refused ("since there's no port") and
  knocked off as the map opened - while the trip it priced was reckoned from the boarding pixel (`playerTravelOrigin`).
  By land then walked from the deck onto the sea, into the mod's own ocean stop ("maybe you should travel on a ship").
  The one dep bag both maps and a party's fare read (`travelFareDeps`) now hands the ship laws `travelOriginMapId`:
  where the player stands, unless they stand on their own ship - then the place the ship was boarded at. Departure 20.
  DFU boards the ship anywhere (`ShipAvailiable = HasShip`), so a ship boarded in the wilderness reads the
  wilderness from its deck - no port, as it would ashore there (AUDIT 28e). A passage taken from the deck caches the
  deck's scene first, as `performFastTravel` does (:330-332), so what lies on the deck waits for the return.
- **The re-bill.** The enhanced map's card priced the trip, THEN ran the mod's OnPush guard, and never priced it again:
  a guard that knocked the ship off left By land showing over the ship's days and fare, and Begin gold-checked that
  fare - a walk refused for gold it does not cost. The classic window refreshes after its guard (`travelMapWindow.js`);
  the card now re-bills whenever the guard moved the ship.
- **The Overworld takes the passage (SHIP-SAIL).** The Overworld sails the player's own boats alone (OWS2) and the
  map sells DFU's passage; a place across the water with no boat to hand was refused with "a boat would carry you
  across the water" - at a port, read as no way to sail. Mac, asked whether the Overworld should take the passage
  itself: *"Shouldn't it already function as such?"* It does now: where the walk is refused and the passage sails
  there, the Overworld OFFERS it - "There is no way to Wayrest by land. Sail there by ship?", the fare's row and the
  days - priced by the map's own popup headless (`partyTripFare`, whose constructor prices the trip, so its guard sees
  the water: the ports rule, the guild's blessing, the fare, the two-sided gold gate), refused by the map door's own
  rungs (`partyTravelRefusal`: foes near, the sun, indoors), and on Yes taken as the map takes it - a party gathered
  asked first, then the fade and `fastTravelTo`. A purse that cannot pay is told so and not asked; where the passage's
  own law refuses the place (no port here), the boat's line stands (with Come Sail Away off, the plain refusal). The
  passage is Daggerfall's, so it is offered with that mod on or off (AUDIT 28e: the first version asked it only with
  the mod on). AUDIT 28e too: Yes ENDS the journey on the ground first (the mod's `ClearTravelDestination` - it drove
  on from the far shore back into the sea); No raises the Overworld the box cut down; a pending quest offer is handed
  over first (the map door's GiveOffer rung); a purse that holds the fare but not the inns' coin is told the coin. (A first draft of this record said the popup
  priced AFTER its guard and so read no ocean; the constructor's own refresh makes that false - corrected.)

## TO-FARE (2026-09-29) - the fare's haggle reads the Mercantile skill

Found on MERC-CAP's way (`01-Overview/Field-Bugs-2026-09-29f.md`), fixed at Mac's word: *"Fix the separate bug"*.
The mod scales a fast-travel fare and puts each half back through `FormulaHelper.CalculateTradePrice(cost, 10, false)`
(TravelTimeCalculatorTO.CalculateTripCost), which reads the traveller's live Mercantile SKILL (GetLiveSkillValue,
FormulaHelper.cs:1992/1998). `scaleTripCost` read `liveStat(e, 'mercantile')` - a stat by the skill's name, which no
entity has - so every scaled fare haggled at Mercantile 0: on a trip of 300 in inn nights and 400 in passage at x4 and
x3, a traveller at Mercantile 90 was billed a novice's 1686 for a 1068 fare. It reads `skillValue(e,
SKILLS.Mercantile)` now, the same read every counter makes, so a worn Enhances Skill haggles too. The split this page
called faithful was; its haggle's Mercantile was not. Both maps and a party's fare bill through it (`travelFareDeps`),
and the dials are the player's own online (`ONLINE_PLAYERS_OWN_MODS`), where MERC-CAP reads the skill no further than
100. Offline, past 233 the mod's own call bills under nothing, as a room does - put to Mac with MERC-CAP.

## Pins

`test/to1_travelOptions.test.js`. `tools/mutants/to1.json`.
`test/roadcrash.test.js`, `tools/mutants/roadcrash.json` (ROAD-CRASH).
`test/travelnav.test.js`, `tools/mutants/travelnav.json` (TRAVEL-NAV),
`tools/mutants/travelnav2.json` (TRAVEL-NAV2), `tools/mutants/travelstrafe.json` (TRAVEL-STRAFE, 7 dead),
`tools/mutants/audittravelstrafe.json` (AUDIT TRAVEL-STRAFE, 14 dead),
`tools/mutants/audittravelstrafe2.json` (AUDIT TRAVEL-STRAFE2, 11 dead).
`test/spawntravel.test.js`, `tools/mutants/spawntravel.json` (SPAWN-TRAVEL).
`test/risestuck.test.js`, `tools/mutants/rise_stuck.json` (RISE-STUCK).
`test/disc28e_shipport.test.js`, `tools/mutants/disc28e.json` (SHIP-PORT's ten, SHIP-SAIL's twenty-three).
`test/fb0929d_toroads.test.js`, `tools/mutants/fb0929d_toroads.json` (TO-ROADS, 14 dead, 2 equivalent).
`test/fb0929f_tofare.test.js`, `tools/mutants/fb0929f_tofare.json` (TO-FARE, 2 dead).
