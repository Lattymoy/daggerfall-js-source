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
   not wait. You arrive now, and no inn is paid" - is DFU's fast travel
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
    forgets the name as the other two do (`travelOptions.js:512`).
17. **The recovery walk's give-up is a junction** (`:727-1050`, ROAD-CRASH
    below). When `SelectNextPath`'s nine shifts narrow nothing, the mod
    hands `GetTargetPixel` a multi-bit mask whose `default` arm is the
    pixel the player stands in: a leg arrived before it starts, forever.
    The port stops at a junction instead (`travelOptions.js:579`).

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
> refuses outright on `resting` (`hunting.js:114`). One flag reached
> three laws nobody had asked it to reach. That is the lesson worth
> keeping out of this whole exchange.

- **Instant exhaustion - the port's own needs charged at the mod's
  clock.** The vanilla band asks only whether the minute CHANGED this
  frame and pays ONE minute whatever the jump
  (`PlayerEntity.cs:402-418`, and `systems/worldTick.js` verbatim), so
  the journey's vanilla drain IS DFU's - and Travel Options watches that
  very number with its own cautious stop (`TravelOptionsMod.cs:1079`,
  ported at `travelOptions.js:783`). The NEEDS are this port's own
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
  and sunburn ticks (`needs.js:480`), and, for a traveller who is also
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
(`:658-664`; `travelOptions.js:495-515`). Unlike the two path arms
before it, it never forgot the named destination, and `InterruptTravel`
"leaves current destination active" (`:1273`) - so a ring walked after
ANY stopped journey (a foe, low fatigue, CAMP, the map's own stop near
a town) ran with that name still set. That is the one condition under
which `InitLocationRects` keeps refreshing the rects MID-journey
(`:606-612`, `autopilot == null || destinationName != null`;
`travelOptions.js:443-446`). A town's ring reaches into its neighbour
pixels; the crossing fired `OnMapPixelChanged`, the host's
`locationTileRect` answered null for the neighbour (world.js:7212 -
null both for a pixel not yet built and for one with no location),
`SetLocationRects` nulled both rects (`:602-604`), and the walk's own
`OnArrival` (`circumnavigateLocation`, `:753-797`) read
`locationRect.zMax` off null on the ring's edge branch. In Unity that
is a NullReferenceException logged per frame and the mod stalls with
the panel up; this host's frame loop dies on it, and `main.js`'s
overlay prints the stack in red. Three fixes, at the root:

- **The ring arm forgets the name** (`travelOptions.js:512`), as the
  two path arms do. With the name gone the rects hold for the whole
  walk exactly as they do for every path leg, and everything else that
  reads `destinationName` now reads the walk as the followed path it
  is: the follow key stops it (`:1358-1362`), an avoided encounter
  resumes IT rather than the old named journey (`:1210`), the
  LocationPause "nearby" arm stays out of it, and `isPathFollowing` is
  true. Departure 16.
- **The walk guards its rects** (`travelOptions.js:609-613`) - the
  seam's own guard for a state the mod cannot survive either. A walk
  whose rects are gone ends where it stands, as a junction's does
  (`:1063`, CloseWindow, whose host onClose is InterruptTravel; a host
  whose panel is already down is interrupted outright), and the follow
  key asked again answers "no path here" through `FollowPath`'s own
  rect test.
- **The recovery walk's give-up is a junction** (`travelOptions.js:579`).
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

## Pins

`test/to1_travelOptions.test.js`. `tools/mutants/to1.json`.
`test/roadcrash.test.js`, `tools/mutants/roadcrash.json` (ROAD-CRASH).
