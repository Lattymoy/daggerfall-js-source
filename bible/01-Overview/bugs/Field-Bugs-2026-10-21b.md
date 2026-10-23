# FIELD BUGS 2026-10-21b - the Discord's bug-reports, read to their roots

Five threads from the Discord's #bug-reports (2026-10-21), handed over as screenshots with no word beside them: from
Dûmorîkh, grayhatharry, LEGALISE ARO..., 4M and Boar, and Prefixo. Each was traced end to end on the real producers, with
the freeware's data (`tools/fetch-data.sh`) where the map decides. Read on the code as it stands at main's `4bba28c6c`.
The calls the reports left open are taken here, under the owner's standing word on these threads (Mac, 2026-10-19: "Stop
with the decisions for me"); each section says which it took and why. The pins are `fb1021b_*`, the mutants
`tools/mutants/fb1021b_*.json`. (This record was written as 2026-10-21 and took the next letter at its merge: #1113's
SNOW-FACE, LANE-TURN, DEX-HIDES and OFFLINE-ROAD reached main first, as `Field-Bugs-2026-10-21.md` and `fb1021_*`.)

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Dûmorîkh: "Sailing Vessels Sometimes Have No Propulsion" - "This is only with sails. Oars work fine." | A save made below ground keeps the indoors' wind - none - and a load that lands outdoors (online a dungeon save wakes at a temple or town) restored it on the open sea: no way and no pull under sail, the oars untouched, until the game's next hour; a restart's exit save kept it | SAIL-WIND |
| 2 | grayhatharry: "I had a quest that wanted me to sail from one port to another ... he informed me I hadn't sailed at all" | "Under Sail" counted a voyage from the LAST berth heard, and a slow boat (a Rowboat, a Large Boat in a light wind) berths every step in her port's waters: her departure followed her out, and between near ports the quarter league never lay. A boat run aground or the helm let go at speed never berthed; a load forgot the departure; Pencart's water was all Longham's | VOYAGE-HOLD |
| 3 | LEGALISE ARO...: "Equipping the lantern with O still puts it into your shield slot and not the lantern slot" | The world hangs a lit lantern at the hip whenever Handheld Torches' waist switch says so (shipped on), and the inventory read the belt's mark alone: the O key's lantern was drawn in the shield's hand, the lantern slot empty | BELT-WAIST |
| 4 | 4M and Boar: "Crashing every minute" - "No message just black", "when I enter dungeons or traveling overworld" | The one black, silent failure in the tree: the desktop app's page dying after its version's trial, met by nothing. Two faults on the reported paths, each measured: the snow year's origin named two origins in one year, and a pixel build waited on the snow forever (the world built nothing again); the Snowfall mod's blanket queue held every pixel destroyed behind a travelling player, 1.8 MB of heap each | SNOW-YEAR, SNOW-HOLD, RENDERER-GONE |
| 5 | Prefixo: "Soul Cake stopped dropping" - "still stuck at 122" | The day's cap (120 a UTC day), reached in under an hour of undead, answered every find past it with a miss's own `{ found: 0 }`: nothing said there was a cap, or when it ends | CAKE-CAP-SAID |

## SAIL-WIND: a load outdoors lays the outdoors' wind (1)

`src/systems/comeSailAway/csaLoadWind.js` (`windStaleOutdoors`), `src/systems/comeSailAway/comeSailAway.js` (OnLoad).

FOUND. Both screenshots read the helm's panel with the sails up - its first button is "Stow sails" (the toolbar is
`helmButtons`' order) - at 0.1 knots in a Small Ship and 0.0 in a Large Boat, online (no time dial). Under the Responsive
helm (the default) a ship under sail makes nothing at exactly one wind: none. Driven over every hull, all seven Large Boat
rigs and 24 headings at the base wind, the slowest was 1.47 m/s and no heading is in irons; a wind of a millionth still
drives a Small Ship at 4.31 m/s; a wind of nought drives nothing, because the sails' way and their pull both read it
(`helmWay.js:"export const seaWind = (windLen) => (windLen > 0 ? WIND_RATED * windShare(windLen) : 0);"`) - so whatever
way she had when the sail went up is all she keeps. The oars read no wind, which is "Oars work fine".

Where the nought comes from: Come Sail Away lays no wind indoors (`comeSailAway.js:"if (deps.isPlayerInside()) {"`, both
vectors zeroed), its save keeps the wind as it stands (`comeSailAway.js:"data.windVector = v3(state.windVectorCurrent);"`),
and its load restores it (`comeSailAway.js:"state.windVectorCurrent = arr3(data.windVector);"`) with no new roll - OnLoad
(ComeSailAway.cs 1943-1950) only shows the boats and the waves. In Daggerfall Unity that is whole: a save made indoors
loads indoors, and the next door lays the outdoors' wind. Here a load can land OUTDOORS from a save made below ground -
online a dungeon save always wakes at the nearest temple, town or graveyard (`world.js` ONLINE-UNDERGROUND-LOAD1), and a
dungeon that cannot be entered or found, or a save made elsewhere, is restored outside - and the mod loop then laid the
indoors' none on the open sea. Nothing laid a wind until the game's next hour (OnNewHour: two and a half real minutes
online, five offline), a change of weather or a door; and a restart inside that window re-saved the nought at the exit
(`exitAutosave`) for the next load - "restarts have been attempted". The chat's tip ("the local map to travel a bit")
worked because travel moves the clock past an hour. Measured on the real runtime (`test/csaScene.mjs`): saved below ground,
loaded outdoors - a Small Ship's W, W (a quarter second at the oars, then sail) held 0.12 knots for two minutes; a Large
Boat raised sail from rest and made 0.00; one rung down to the oars, 1.94 and 3.89; after OnNewHour, 19.89 and 6.63.

THE LAW NOW. A load that lands outdoors under a wind of nought asks the door's own call, UpdateWind, for the player's
weather (`comeSailAway.js:"if (windStaleOutdoors(deps.isPlayerInside(), state.windVectorCurrent)) UpdateWind(deps.weatherType?.() ?? WEATHER_TYPE.Sunny);"`).
Outdoors UpdateWind never lays a nought (a fog's tenth of 1 is its least), so a nought outdoors is only ever the indoors'
brought out; a load indoors keeps the indoors' none, and a wind its save carried stands. The world settles where the
player landed before the mod loop restores the runtime, so the runtime's OnLoad reads the landing. The same chain after:
19.89 knots and 6.63 under sail. A departure from ComeSailAway.OnLoad, named in Port-Ledger A (SAIL-WIND).

NOT THE CAUSE, measured and ruled out: the wind's heading under the Responsive helm, fog and storm (a share of 0.3 to 2),
hull damage (never under 0.35 of her way; a rig shot away lowers the sails and says so), the refits and crew, the
heave-to, cargo and the serpent (each stops the oars too), a beached or blocked boat (her sails come down: the button reads
"Raise sails"), the online wind (each machine rolls its own). Under the Classic helm (a player's own choice) the square-sail
assist stows a Large Galley's and a Large Boat VII's canvas with the wind ahead of the beam and a Small Ship has a dead band
about 30 degrees off the wind's eye - the Classic model as built, within the "In irons" hint's 40 degrees; the screenshots'
panels show no such hint.

`test/systems/comeSailAway/fb1021b_sailwind.test.js` (4): the chain on the real runtime, saved below ground and loaded
outdoors - a Small Ship under sail and a Large Boat raised from rest make way; a load indoors keeps none and a load outdoors
keeps the wind its save carried; the predicate. `tools/mutants/fb1021b_sailwind.json` (3, 3 dead). TIDY1's folder pin
moved (`test/tooling/tidy1_codemap.test.js`: the new module lives in `src/systems/comeSailAway/`, Code-Map rule 2).

## VOYAGE-HOLD: a voyage counts from where she last lay (2)

`src/scenes/harbourOffice.js` (`PORT_VOYAGE_M`, `berthed`), `src/scenes/naval/navalBerth.js` (`createBerthWatch`,
`BERTH_STILL`), `src/scenes/naval/navalHost.js` (`boatPose`, the berth's wiring), `src/systems/naval/captainLedger.js`
(`newLog`'s `departed`, `restoreDeparted`), `src/world/portSites.js` (`boardPortAt`), `src/scenes/world.js`
(navalPortHere), `src/systems/questlines/quests/QLIS01.txt`, `QLOC02.txt`.

FOUND. The quest is the harbourmaster's "Under Sail" (QLIS01): `ql act port-reached 1`, and "Sailed yet? No?" is said
`when _qgclicked_ and not _sailed_`. BERTH-RING (`Field-Bugs-2026-10-20c.md`, the same symptom's fix) merged the evening
before (#1085, `ccfb3c135`); what follows stands on the code after it. The act has one producer, the harbour office's berth law: a berth at
another port than the last berth heard, with a quarter league (1,207 m) logged at the helm since it. A berth is the boat
at my helm in a port's waters (a board port within SEA_RING) with her way 2.5 m/s or less (YARD_SPEED) and no hostile ship
near, said every sites step she is. Four ways a player who sailed from one port town to the next was told they had not:

1. A SLOW BOAT'S DEPARTURE FOLLOWED HER OUT. The departure was the LAST berth heard, and a slow boat berths every step she
   is in her port's waters: a Rowboat (4,000 gold, oars only) rows at 2.00 m/s, a Large Boat (8,000) makes 2.38 m/s
   close-hauled in a light wind. So her departure was where she left her port's waters, and the quarter league had to lie
   between the two ports' waters. On the real host, office and ledger: rowing 3,000 m out of one port's waters straight
   into the next's - no act; 819 m of open water between them - no act; 1,638 m - the act. On the real map 26 pairs of
   board ports have waters closer than that, and 43 of the 106 have such a port as their nearest neighbour
   (Sentinel-Mesiton 4.2 km apart, Pallaton-Sentinel 4.4 km): "a shy journey down the coast" in a first boat.
2. HER ARRIVAL WAS NEVER SAID. Run aground in the next port's waters, she berthed never: Come Sail Away moves a beached
   boat by none of her way and updates none of it, and the host's pose read her last (a Small Ship at the helm read
   9.86 m/s for twenty seconds aground, a Large Boat 5.00 - and logged 197 m of leagues while she lay). Brought in at speed
   and the helm let go, she berthed never either: StopSailingDelayed takes her way off at once and she is no longer at a
   helm, so no step after said a berth.
3. A LOAD FORGOT THE VOYAGE. The departure was the office's memory alone, and the ledger's restore lays a new log: a relog,
   a reload or a crash between the two ports - and the same day's threads report the game going black every few minutes
   (section BLACK-SCREEN) - and the next port counted nothing.
4. PENCART COULD NEVER BE REACHED. The port whose waters a pixel lies in was the nearest by the ring's squares, a tie to
   the list's first, and every pixel of Pencart's water tied it with Longham's: of the 106 board ports, Pencart alone named
   none. Longham-Pencart (2.5 km) counted in neither direction.

THE LAW NOW.

- She sailed from where she last LAY STILL: a berth now says whether she lies still - her own way under BERTH_STILL
  (0.5 m/s, the current none of it), or the helm let go - and only a still berth moves the departure
  (`harbourOffice.js:"if (!from || ev.still !== false) log.departed = { port: ev.port, sailed };"`). A slow berth under way
  is checked against the departure and moves nothing, so a Rowboat rowing out of one port and into the next is counted
  from the quay she lay at. A berth at another port a quarter league on is the port reached, and she lies there from then.
  A boat drifting where two ports' waters meet lies still in each in turn and never makes the quarter league between them;
  a loop sailed before a short hop home counts nothing once she lies at home again.
- Her arrival is said however she comes in: a boat aground lies still
  (`navalHost.js:"const local = boat === r?.state?.CurrentBoat && sailing() && !r.IsBeached?.(boat) ? (r.state.velocityCurrent ?? [0, 0, 0]) : [0, 0, 0];"`
  - and logs no leagues while she lies), and the helm let go in a port's waters with no hostile near is a berth, still
  (`navalBerth.js:"else if (!boat && helm && port && deps.clear()) deps.event({ type: 'berth', port: port.key, boat: helm.uid ?? null, still: true });"`).
  A cargo delivered there is delivered as well (QLIS02's `cargo-delivered`, the same berth).
- The departure is the log's own (`captainLedger.js` newLog `departed`, restored only where it lies within its log's way):
  a load keeps the voyage its save was on.
- The port a pixel lies in is the nearest within SEA_RING by the crow's flight, exact on every engine
  (`portSites.js:"export function boardPortAt(ports, x, y) {"`, the world's navalPortHere through it - code out of bootWorld). Inside a
  ring of two it differs from the squares on a tie alone: Pencart now names 5,923 squares of ship water, nine neighbours
  trade tied pixels, and no board port names none.
- The quest says what counts: QLIS01's letter, log and the harbourmaster's word now ask for "the harbor of another, a
  quarter league off or more", and QLOC02's log for each port "a quarter league or more from the last".

THE GENERAL CLAIM ("at least 70% of the time the npc tells me I didn't do something"): read against the quest machine and
the last fortnight's field passes, it names no second quest and is not reproduced as a fault of its own. What it can
stand on is fixed: this voyage (QLIS01, QLOC02, QLIS02's cargo), CROWD-CLEAR's quest Person stood on a questor's marker
(`Field-Bugs-2026-10-20c.md`) and QUEST-NAME-ONE's NPC answering to another name than the quest's (`Field-Bugs-2026-10-20.md`). Ruled out: a quest item never goes into the Materials Bag
(`materialsBag.js`), the acts' counts and their `from` are saved, and the online checkpoint and the exit save stand.

`test/systems/naval/fb1021b_voyagehold.test.js` (8): on the real naval host, harbour office and ledger - the report (a
Rowboat's pace out of one port's waters into the next's), the drift between two ports, the loop before a short hop, the
helm let go at speed (at sea and with a hostile near, nothing), aground at the helm (and no leagues logged), a load between;
`boardPortAt` on its own; and on the real map (ARENA2) every board port names water of its own, Pencart's tie read as the
squares read it. QL11's load pin moved (`test/systems/questlines/ql11_acts.test.js`: a load keeps the voyage), and
BERTH-RING's source pin and PORT-TOWNS' lifted host text (`fb1013c_porttowns.test.js`) moved to `boardPortAt`.
`tools/mutants/fb1021b_voyagehold.json` (11, 11 dead); `captboard.json`'s
HOST-berth-unsaid and `fb1020c_berthring.json`'s ring re-aimed by content (both dead, the ring's without ARENA2).

## BELT-WAIST: the lantern at the waist is the slot's (3)

`src/systems/beltLantern.js` (`waistLanternOf`), `src/ui/enhanced/enhancedInventory.js` (`equippedModel`, `lanternGroup`),
`src/systems/handheldTorches.js` (`lanternFirst`, `toggleLightPress`, `waistPress`), `src/systems/quickslots.js` (the
hotbar's light arm).

FOUND. O is Handheld Torches' TorchToggleLight (`inputActions.js:"['KeyO', 'TorchToggleLight'],"`), and its press lights
the pack's first lantern through PlayerEntity.LightSource's one door - it never marks one for the belt. BELT-LANTERN
(2026-10-20, `10-UI/UI-Arc.md`) gave the lantern its own socket and the item its mark (`beltLantern: true`), and the
inventory's hand row took a light only when it was NOT marked. But the world asks another question:
`playerTorch.js` lanternAtWaist is the mark OR Handheld Torches' "lanterns at the waist" switch, which ships on
(HT-WAIST-ON), and the hand law, the first-person sprite, the Morrowind body and the light itself all ask it. So with the
shipped settings a lantern lit by O hung at the hip in the world while the inventory drew it in L·Hand - the panel the
shield's slot shares - and the Lantern socket stood empty. The card's Light, a double-click (the pack's Use) and the
hotbar did the same. Measured with shop-minted items (`stockShopShelf`) and the real press (`createHandheldTorches`):
O -> lit, unmarked, at the waist, in the hand's row, the socket empty. DFU has no light slot (its GetEquipSlot answers
None for every light); the only DFU member here is PlayerEntity.LightSource, unchanged.

THE LAW NOW. One question, `beltLantern.js` waistLanternOf: the lit light where it hangs at the waist (lanternAtWaist),
else the lantern on the belt, unlit. The hand's row holds the lit light only when it is not that lantern
(`enhancedInventory.js:"const light = entity?.lightSource && waistLanternOf(entity) !== entity.lightSource ? entity.lightSource : null;"`),
and the socket draws it (`enhancedInventory.js:"const item = waistLanternOf(deps.entity);"`). Three more paths were wrong
the same way, found on the way:

- O lit the pack's first lantern even with another hung on the belt - the hung one stood dark while a second hung lit
  beside it. A press now lights the slot's lantern first (`handheldTorches.js:"const lanternFirst = () => beltLanternOf(ctx?.entity) ?? firstOf('UselessItems2', T.Lantern);"`),
  on the mod's ladder and its remembered-light branch alike.
- With the switch off, a hung lantern behind a shield and a drawn sword was refused ("You can't hold a light source right
  now"): the waist branch read the switch alone. BELT-LANTERN's own word is that a hung lantern takes no hand; the branch
  now runs with a lantern hung (`handheldTorches.js:"if ((w.s.lanternsAtWaist || beltLanternOf(ctx?.entity)) && !hasFreeHand() && waistPress()) return true;"`).
  An unhung lantern with the switch off still asks a hand.
- The hotbar's lantern slot took the shield off (SHIELD1's torch law) and an off-hand weapon refused it. A lantern at the
  waist takes no hand, so its slot does neither (`quickslots.js:"const atWaist = lanternAtWaist(hotbarView(entity)[i]?.item);"`);
  a torch's slot still takes the shield off first.

A torch and a candle are held, as Handheld Torches holds them, and stay the hand's row.

`test/systems/fb1021b_beltwaist.test.js` (8): the report through the real O press, the socket drawn lit in the mounted pane,
the pack's Use, a torch and a candle still in hand, the hung lantern first (and on the remembered light), the switch off
behind a shield and a drawn sword, the hotbar beside a shield and an off-hand weapon. `tools/mutants/fb1021b_beltwaist.json`
(9, 9 dead).

## BLACK-SCREEN: the world that stopped building, the pixels the snow held, and a stopped page said (4)

`src/systems/weather/snowpack.js` (`yearOriginOf`), `src/scenes/snowCoverHost.js` (`settle`) - SNOW-YEAR;
`src/systems/snowfallRuntime.js` (`_blanketTick`), `src/scenes/snowfallHost.js` (`terrainOf`) - SNOW-HOLD;
`app/lib/rendererGone.cjs`, `app/main.cjs` (the game window) - RENDERER-GONE.

FOUND. "No message just black" rules out the ordinary crash: a throw in the frame loop or an unhandled rejection puts
up the CRASH panel (`main.js`), and a lost WebGL context puts up its own ("the graphics stopped ... tap here to reload",
above the loading screen). One failure in the tree is black and silent: the desktop app's page dying after its
version's trial (DA13). Its handler gave the stop to the trial - `gameStore.rollback` - which answers null once the
version has proved itself, and returned: the window stood on its background colour with no word and no way back but
closing it. What kills a page is the question then, and the real game, driven headless with the freeware's data
(SwiftShader), found two faults on the reported paths. Neither is proven to be what 4M and Boar saw - nothing says which
build they play or what their machines log - but each is real, measured, and on the way to exactly that screen:

1. SNOW-YEAR - THE WORLD STOPPED BUILDING. The snow year's origin floored a midsummer carrying a fractional minute's float
   error onto the 180-minute grid it lies on: two minutes of one year named origins a step apart, 2.7% of fractional
   minutes, wherever the event minute is the sky's (offline; online the relay's sky mapping moves midsummer off the step,
   not measured against the live clock). A pixel build waits for the snow (`pixelBuild.js` settle), holding the minute it
   began at, while the frame's tick integrates the same window to the clock's minute: with two origins they reset each
   other's lattice points every pass. Caught in the debugger in the running game, about one pixel into a journey: the
   window's points new on every pass, 2.7 million steps skipped, the build never done - and the world's pump builds one
   pixel at a time, so it built none again that session (about one build in 37 offline). Shipped with #1053
   (2026-10-19).
2. SNOW-HOLD - THE PIXELS THE SNOW HELD. Built and torn down a hundred-odd times in the running game, the GL's objects and
   bytes stood flat, and the JS heap grew 1.8 MB a map pixel - the heap's snapshot traced it to the Snowfall mod's
   blanket queue: each queued tile's SnowTerrain closures hold the host's whole pixel entry (its verge, its cover items).
   The queue drained only while the local tier was not recentring, and a player on the move keeps it recentring (every
   6 m by default); it was pruned of nothing. Measured in Node over a world streaming about a player at 40 m/s: every
   one of 63 destroyed tiles held at 8 km, the queue growing with the road. And the host chained each rebuilt tile to
   the one before it (`replaced`). Snowfall is on by default in winter - a new character starts in Morning Star. A
   journey's pixels add up to the heap's end, and a page out of memory is a page gone: the black screen above.

THE LAW NOW.

- SNOW-YEAR: the sky's midsummer is a whole minute, so it is rounded to one before the floor
  (`snowpack.js:"const midsummer = eventMinuteOfSky(Math.round(sky - since));"`) - one snow year, one origin, at any
  fractional minute of it; and a build's wait asks the clock's minute on every pass, as the tick does
  (`snowCoverHost.js:"while (!at(px, py, now(), arriving?.() ? Math.max(SNOW_COVER.arriveMs, breather.left()) : breather.left(), true)) await breather.breathe();"`),
  so a wait across the year's real turn finishes too.
- SNOW-HOLD: the blanket's five-second prune lets a queued tile go with the overlays once it leaves the rings it draws
  (`snowfallRuntime.js:"if (B.queue.some((t) => !live.has(t))) { B.queue = B.queue.filter((t) => live.has(t)); B.queued = new Set(B.queue); }"`
  - `_blanketProcess` skips such a tile, so letting it go is the same), and a blanket going inactive lets its queue go
  (standing again queues every visible tile anew). The same walk now holds no destroyed tile and a queue of the 49 its
  rings draw. A host tile says THAT it replaced one; the old goes to the runtime through `promotions` alone. Departures
  from the Snowfall mod's ProcessBuildQueue and SetActive, named in Port-Ledger A (SNOW-HOLD).
- RENDERER-GONE: a page that stops after its trial is said - *"The game stopped. It ran out of memory. Your saves are
  kept - progress since your last save is lost."* - with Restart (the default) and Quit, and a page stopping three times
  in two minutes says so; the reason is kept in `crash.log` beside the saves (a GPU process gone too), so the next report
  can say why. A page that stops answering is offered Wait (the default and the cancel) or Restart, as Chromium's own
  "Page unresponsive" does. The trial's rollback is asked first, as DA13 has it.

NOT DONE, said: a browser tab that runs out of memory shows Chromium's own "Aw, Snap", which this game cannot draw over;
a page watchdog for a build that never ends, and recovery on `webglcontextrestored`, are not built - with SNOW-YEAR's
two causes gone no build is known to hang. Whether 4M's and Boar's crashes were these two is for the next report's
`crash.log` (or the browser's) to say; the record above is what the tree held.

`test/systems/weather/fb1021b_snowyear.test.js` (2): the running game's two minutes and 6,000 fractional minutes of three
years, one origin each; a build's wait across the year's turn with the frame's tick between its passes finishes.
`test/systems/fb1021b_snowhold.test.js` (3): a travelling player keeps the local tier recentring and the blanket holds no
destroyed pixel; a blanket going inactive lets its queue go; a host tile rebuilt holds none. `test/tooling/fb1021b_renderergone.test.js`
(4): the boxes, their defaults and answers, the stop count and the log, and the shell's wiring by source; DA13's pin moved
(`test/tooling/da13_gamechannel.test.js`). `tools/mutants/fb1021b_snowyear.json` (2, 2 dead), `fb1021b_snowhold.json`
(3, 3 dead), `fb1021b_renderergone.json` (7, 7 dead).

## CAKE-CAP-SAID: the day's cakes, said (5)

`server-account/src/festival.js` (`findFestival`, `festivalOf`), `src/systems/festival/festivalClient.js` (`learn`,
`festivalFindsToday`, `askFind`), `src/systems/festival/festivalWords.js`, `src/ui/wyrdWindow.js`,
`src/scenes/witchesHost.js`. Account service acct167 (acct166 on its branch, renumbered past FIELD BUGS 2026-10-20h's acct166 - ESSENCE-LOOSE and SOUL-LAW - at the merge), no migration.

FOUND. A find is decided by the account service's die and capped by the day (`06-Systems/Witches-Festival.md`):
`FIND_CAKES_PER_DAY` cakes a UTC day. Once the day's 120 were found, `findFestival` asked its die for nothing
(`want` was 0) and answered `{ found: 0 }` - word for word a miss. The refusal `capped` went out only once the day's
1,500 ASKS were spent, and the page said nothing for either: `askFind` speaks only when `found > 0`. Measured on the real
service over the real migrations (`test/accountDb.mjs`), an undead kill every 12 s from the release (21:10 UTC,
2026-10-20): the 120th cake at kill 231 (21:56 UTC), then 619 kills to midnight with none; from 00:00 UTC it found again.
Through the whole path - the kill listener, `askFind`, the Worker's route - 729 answers of `found: 0` and not a line.
Prefixo's 122 is the 120 found and two taken from others' Hearth Offerings (a take is no find). "Yesterday" was the
release's evening; the cap rolls at 00:00 UTC, 20:00 on the US east coast.

THE CALL: the cap stands, said. It is the service's guard against a forged client, and the Wyrd Sister's prices lean on
it - her whole stock, 865 cakes of the twenty wares, is 7.2 capped days of the festival's 19. What was wrong is that
nothing said it, and that the page kept asking: every kill past the cap was still a write to the service's primary.

THE LAW NOW.

- The service says the day: a find answers `today`, the cakes found this UTC day with its own, and `capped: true` once
  they are all found (`festival.js:"return { found, cakes: await cakesOf(db, player.id), today, ...(today >= FIND_CAKES_PER_DAY ? { capped: true } : {}) };"`);
  the account's festival answers `today` from the same row. A 200 still, so a page from before reads it as it did.
- The page learns it (`festivalFindsToday`: a count said on an earlier UTC day is today's nought), says the day's end ONCE
  a UTC day an account - *"You have found all 120 Soul Cakes a day allows. More can be found from 8:00 PM."*, the hour the
  player's own clock reads at the next UTC midnight - and asks nothing more until the day turns
  (`festivalClient.js:"if (festivalFindsToday().full) { sayDayFull(); return 0; }"`). The asks' own refusal ends the day
  the same way. A player back after the cap is told at the first kill.
- The Wyrd Sister's window counts it under her name: *"Found today: 87 of 120 Soul Cakes."*, and once spent *"Found
  today: all 120 Soul Cakes. More from 8:00 PM."* - and its watch repaints when the UTC day turns with it open.

The three lines are drafted in the thirteen whole languages (`festival.finds.*`).

`test/server/witch1_festival.test.js` (CAKE-CAP-SAID: a winning roll past the cap answers `capped`, the account's festival
counts the day, a new UTC day finds; the find pins moved to carry `today`); `test/systems/festival/fb1021b_cakecap.test.js`
(5): the find that ends the day and the day's end said once, nothing asked after, the next day asked again; the asks'
refusal; a player back after the cap; an older service (no `today`) asked and silent as before; the window's line and its
day-turn. `tools/mutants/fb1021b_cakecap.json` (10, 10 dead). The version's pins moved to acct167.
