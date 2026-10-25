# FIELD BUGS 2026-10-20c - the Discord's bug-reports, read to their roots

Five threads from the Discord's #bug-reports (2026-10-20), handed over as screenshots with no word beside them: twelve
reports in all, from æther, Baffle and homotroglodytes. Each was traced end to end on the real producers. Where the map,
the blocks or the bodies decide, it was traced with the freeware's data (`tools/fetch-data.sh`) and Daggerfall Unity's
own C# beside it. Read on the code as it stands at main's `469dc0ed5`. The calls the reports left open are taken here,
under the owner's standing word on these threads (Mac, 2026-10-19: "Stop with the decisions for me"); each section says
which it took and why. The pins are `fb1020c_*`, the mutants `tools/mutants/fb1020c_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | æther: "This hill is very steep, between Vanwood and The Silver Hedgehog Pub" | Daggerfall's own ground: the pub stands on the face of Menevia's sea cliff, its pixel the fourth steepest of all 15,251 sites in DFU's own data. The landforms make it worse: a small site is levelled twice (LANDFORM4's pull, then DFU's blend), and gives its rise back in less run than either alone | open - ONE-LEVEL, below: every one-levelling law tried trades the pub for regressions elsewhere |
| 2 | æther: "Fountain inside a tree in Crossleigh behind a house west of The Emperor's Gear Store" | Daggerfall's block stands a scenery tree 1.58 m from its own fountain. Low Poly Trees stands that tree's trunk 3.42 m about its root, and nothing kept a trunk off a town's solid things | TRUNK-FIT |
| 3 | Baffle: "With the recent update ive received 4 different notes from townsfolk asking me to do things while in a town for 5 minutes" | The questlines' runner spaced the lines' starts an hour apart. GivePc holds a letter until a town by day, so the letters of every line begun at night, indoors or in the wild landed together | LETTER-PACE |
| 4 | æther: "Burning Doors quest NPC spawned too close to other NPC ... had to be precise to get to interact with her" | Daggerfall's own Mages Guild hall (MAGEAA11 #0, MAGEAA12 #18) lays a quest spawn marker 0.20 m from the guild's questor, and DFU stands a Person on its marker whoever stands there | CROWD-CLEAR |
| 5 | homotroglodytes.: "raw fish cant be cooked over fires" | A netted fish goes into the Materials Bag first (BAG1), and the fire's Cook food list read the pack alone | BAG-COOK |
| 6 | homotroglodytes.: "the crafting station in towns dont have any craft buttons, just buttons to store goods" | The joinery's station question measured the feet from the bench's middle alone. The carpenter (8.55 m) and the board (9.55 m) stand past its reach, so a press on either opened the workbench Away | BENCH-DOORS; and TEMPER-CARRIED, found on the way |
| 7 | homotroglodytes.: "storing your goods makes the buttons get stuck for a long time" | Each put-in waited for a checkpoint of the whole game to land, in series, one material at a time | ONE-SAVE |
| 8 | homotroglodytes.: "ships drift off if you fast travel without full sails" | The Overworld's crossing rows through the autorun and never took the oar rung HELM-LADDER keeps: a helm left on her oars rowed on unsteered past the journey's end, and one left backing water turned the crossing's rudder about | OAR-RUNG |
| 9 | homotroglodytes.: "a lot of harbor towns dont have harbors dispite being along the coast" | A port town is one the sea bears on within two map pixels, but its harbour was sounded within 420 m of its footprint alone: 37 of the 106 port towns - Daggerfall, Sentinel and Wayrest among them - stood no quay | HARBOUR-REACH |
| 10 | homotroglodytes.: "citisens who mark locations on your map dont leave a mark" | The mark itself was whole. The Enhanced town sheet dropped every name its solver could not place, where DFU letters it "*", and the world map's window never held the streets | STAR-PLATE; STREETS-TAB |
| 11 | homotroglodytes.: "during the tutorial quest where you need to sail from one harbor too another the objective doesnt register as complete" | The berth that marks a voyage asked for a board port within one map pixel, and twelve of them have no water a ship lies in within it: a voyage into or out of one never counted | BERTH-RING |
| 12 | homotroglodytes.: "you can despawn pirates by entering your cabin on a ship" | The cabin is an interior, and every interior transition empties the sea; its door was the one way off the sea that never asked whether a hostile ship was near | CABIN-FOES |

## LETTER-PACE: a questline's letter waits for the last one (3)

`src/systems/questlines/qlLineRunner.js` (letterOnItsWay, mayBegin, lettered), `src/systems/questlines/qlLayer.js`
(the letter arm).

FOUND. The "recent update" is QUESTLINES (#1047, #1073; `06-Systems/Questlines-Arc.md`). Every questline opens with a
courier's letter (`Clock _courier_`, then `give pc <letter> notify 1012`). GivePc holds a letter until the player
stands in a town, outdoors, by day (GivePc.cs:78-97, ported as it is). It then hands each letter over 40 to 500 ticks
later, a spread DFU's own comment gives as "so messages don't all arrive at once". The runner began one line an hour of
the character's time (AUDIT QUESTLINES LINES-17), but it read only when each line BEGAN. A line begun at night, indoors,
in a dungeon or in the wild kept its letter until the next town by day. So did every line begun after it, an hour
apart, and online the sky's night is half of every real hour. On the real bridge, online at level 20, a player in town
throughout got six notes between 30m11s and 30m47s at a dawn. A player stepping out after 25 minutes indoors got five
within 35 seconds. Eleven lines can open at once for a character of level 12 or more. Nothing ran twice, and the units
were right: the runner's pace was the starts' when it had to be the letters'.

FIXED. A line begins only when no begun line's first letter is still on its way, and an hour after the last letter
arrived as well as the last line begun. `letterOnItsWay` reads the step quest's real GivePc (its letter-type item, not
given, the quest running and not set aside). `lettered` is stamped by the layer's letter arm at GivePc's moment and kept
by the save. Online, the letters now come about seven real minutes apart: the character's hour (five real minutes)
plus the courier's short wait. No two lines' first letters are ever held at once. GivePc stays DFU's, and the runner is
the port's own, so this departs from nothing DFU has.

PINS. `test/systems/questlines/fb1020c_letterpace.test.js` (5):
- every line's first step hands over one letter-type item, "on its way" while held and not once given or set aside;
- the runner holds every other line while a letter waits, then counts the hour from the letter;
- a set-aside step blocks nothing;
- the save keeps `lettered`;
- the real bridge: the gaps between letters were 2112, 444, 996 and 48 s of the character's clock before, and are all at
  least `STEP_GAP_S` now.

Mutants `tools/mutants/fb1020c_letterpace.json` (10, all dead). `ql3_rewards.json`'s letter-rule record re-aimed by
content at the arm's new line.

NOT CHANGED. The pace itself, about one letter every seven real minutes online while lines open, is the arc's
decision.

RE-AIMED (QL-OFFERED, 2026-10-25; `06-Systems/Questlines-Arc.md` section 4, THE RUNNER). A questline is taken, never sent
now: no line begins unasked, and a first step's letter is in hand at the take, so the pace is the couriers' of the later
steps of the lines the player took - `mayBegin` became `courierMay`, and a courier counts only once it is sent (its clock
running, or its task fired). The pins are six, re-aimed to those couriers, with the real bridge's own: a character in a
town by day all day is sent no questline letter at all. Mutants 13, all dead.

## CROWD-CLEAR: a quest Person never stands inside a resident (4)

`src/systems/quest/sceneMount.js` (crowdingPerson, buildingStandSpot, siteMarkerSpots' `items`),
`src/scenes/worldModes.js` (the building stand and interiorStandSpots, replaced in place - `createWorldModes` did not
grow).

FOUND. The Burning Doors (QLBD01, `Place _hall_ remote magery`) and seven more steps of two questlines stand Ysolde
Marnhel in a Mages Guild hall. Daggerfall's own hall of MAGEAA11 #0 and MAGEAA12 #18 (Beautiful Cities lays the same
hall) holds two quest spawn markers. One stands 0.20 m from the guild's questor (182.15, faction 63), the other 2.86 m
from anyone. DFU draws a Person's marker at random (Place.cs GetSiteMarker) and stands the Person on it
(GameObjectHelper.AddQuestNPC), whoever DaggerfallInterior.AddPeople stood there. The port did the same. The real Place's
draw over the real blocks took the crowded marker 49.8%, 51.7% and 49.4% of the time, and the two 0.95 m pick boxes
overlapped by 0.75 m. MAGEAA11 stands in 48 towns and MAGEAA12 in 36: 84 of the world's 710 MAGE* blocks. QUEST-NAME-ONE
(`Field-Bugs-2026-10-20.md`) changed this stand's name, never its place.

FIXED, a departure. A Person whose spot shares a standing person's pick box stands at the site's nearest other spawn
marker that has a floor and shares none. Each box is the billboard's width, square on the floor, on the same storey.
With none clear, the Person keeps DFU's own marker; it never takes an item's marker or the room's door. Items stay
where DFU puts them, and the Person's layout data (its name, its click) is still its drawn marker's. Over every
interior of BLOCKS.BSA and both town packs, the rule moves a Person of Ysolde's width in that hall alone. 89 buildings
whose only spawn marker shares a resident's box (24 of Daggerfall's, 18 of Beautiful Villages', 47 of Beautiful
Cities') keep DFU's stand. Port-Ledger A: the QUEST-MARKERS row, widened.

PINS. `test/systems/quest/fb1020c_crowdclear.test.js` (5), run over `worldModes.js`'s own stand code, lifted, on a real
floor:
- moved off the questor, with the letter and the layout data kept;
- the nearest clear spawn marker taken, never an item's, and with none clear DFU's own marker, not the door;
- a hidden, unstood or upstairs person, or one 2 m off on either axis, crowds nothing;
- a floorless clear marker passed over;
- with ARENA2, the census: exactly classic and Beautiful Cities' MAGEAA11 #0 and MAGEAA12 #18, each moved off 182.15.

Mutants `tools/mutants/fb1020c_crowdclear.json` (13, all dead). Pin moved: `fb1004d_questmarkers.test.js`'s lifted
stand reads `buildingStandSpot`, and its `QUEST-MARKERS-enter-markers-unsorted` record was re-aimed by content.

## STAR-PLATE and STREETS-TAB: a marked building shows on the map the player opens (10)

`src/ui/town/townSheet.js`, `src/ui/nameplateLayout.js` (STAR_PLATE), `src/ui/exteriorAutomapWindow.js`. STREETS-TAB:
`src/scenes/exteriorAutomapToggle.js` (townHere, travelTown), `src/ui/town/townMapDoor.js` (townSheetBag),
`src/scenes/world.js` (toggleTravelMap's door).

FOUND. The mark itself is whole. An answer's record 7332 carries `%loc`, which discovers the building
(TalkManager.MarkKeySubjectLocationOnMap, PlayerGPS.DiscoverBuilding; `answerPipeline.js`, `discovery.js`), and the
town sheet's ladder names it. That was driven over every Where-is row of 701 towns in three regions: 6,446 rows, every
one marked and named. Three ways remained for the player to see no mark:
- **The crowded plan.** The Enhanced town sheet DROPPED every name plate its collision solver surrendered. DFU letters
  such a plate "*" where the solver left it, with its building's name as a tooltip shown at once
  (DaggerfallExteriorAutomapWindow.cs:870-878, :900-904; ExteriorAutomap.cs:1365-1376), and the classic window always
  did. On Daggerfall with both packs and 152 others found, the sheet lettered 85 of its 153 names at rest, and the shop
  an NPC had just marked was not among them. With 40 to 80 buildings found, a random marked shop went missing in 3 to 6
  of 60 trials.
- **The other map.** The town plan was the town key's (M) alone. The world map's window - the travel key, the dial's
  Map, the journey's map button - held the world sheet only, so the player who opened it saw no building at all. The
  Enhanced map's tab law (`systems/map/mapTabs.js`) already offers a town's streets beside the bay, and the held window
  already holds both sheets (EM4); only the travel key's door handed it no streets.
- **A building already found.** Looking at a door within reach discovers it (World Tooltips' law), so a mark on a
  building the player had already looked at changes nothing on the plan. That is DFU's with the mod, and stands.

FIXED.
- **STAR-PLATE**, DFU's own law, which the sheet had left. A surrendered plate is lettered `STAR_PLATE` - one home, in
  `nameplateLayout.js`, which both town maps read - where the solver left it, ticked and inked as any name. The pointer
  over it reads its building's name.
- **STREETS-TAB**, the Enhanced skin's own (DFU's travel map holds no town plan). In the town key's module
  (`scenes/exteriorAutomapToggle.js`, which main's STAR0 moved out of `bootWorld`), `townHere` builds the town the player
  stands in once, for either key: `toggleExteriorAutomap` is the M key as before, and `travelTown` hands the travel
  key's window the streets. `toggleTravelMap` spreads it after its
  whole ladder (indoors, enemies, an offer, the sun), so the bay keeps every guard and the streets need none. Both keys'
  streets are one bag (`ui/town/townMapDoor.js` townSheetBag): the same summaries, the same discovery record, the same
  yards laid on. The window opens on the bay with the streets one tab away. In the wild, indoors and in a dungeon it is
  the bay alone, and the classic travel window takes no streets and stays DFU's. The bay from the town key stays EM4's
  open call. The slice first moved the town map's group out of `bootWorld` itself. At the merge of main, STAR0 had
  moved the same toggle to `scenes/exteriorAutomapToggle.js`, so the streets were built on that one home instead of a
  second module: `bootWorld` gains one live getter (`modes`), within its ceiling.

PINS. `test/ui/ink/fb1020c_starplate.test.js` (4): three names on one anchor, the third a painted, haloed "*" whose
hover names its building; the sheet, the classic window and the one home read by source; and, with ARENA2, classic
Daggerfall through the real `createTownMapWindow` with every named building found: 158 named, 128 plates, 40 stars, all
painted, and a building with no plate before its discovery painted as "*" and named after it. Mutants
`tools/mutants/fb1020c_starplate.json` (6, all dead). `em34.json`'s EM4-20, recorded equivalent while no fixture overran
the solver, was re-aimed by content at the star and dies now. STREETS-TAB: `test/ui/town/fb1020c_streetstab.test.js`
(4): in a town the travel window holds the streets and the bay and opens on the bay, elsewhere the bay alone; a building
marked through `discoverBuilding` stands on both keys' streets with the same plates; the door by source and THE FOUR
HOSTS (`bootWorld` wired - every travel-map press goes through its door; `bootExterior` mounts no travel map; the
interior and dungeon hosts refuse the travel key); with ARENA2, Daggerfall's travel-key streets match the M key's plate
for plate before and after a mark. Mutants `tools/mutants/fb1020c_streetstab.json` (12, all dead), re-aimed at STAR0's
module at the merge.

## TRUNK-FIT: a town's tree fits its trunk's room (2)

`tools/bakeLptCrowns.mjs` (lptTrunks), `src/world/lptCrowns.js` (LPT_TRUNKS, regenerated by the tool),
`src/world/road/roadVerge.js` (lptTrunkCap), `src/scenes/pixelBuild.js` (standFlatGroups).

FOUND. Crossleigh is Anticlere's location 659, at the map pixel (401, 175): blocks GENRAS01 and RESIAS02, the scenery
Daggerfall's own under Beautiful Villages. GENRAS01's ground scenery stands TEXTURE.504's tree 12 at (38.40, 12.80) in
the block, and its misc flat #23 - a fountain, TEXTURE.212 record 2 - at (39.95, 12.50): 1.58 m apart, due west of the
house between it and The Emperor's Gear Store. `RMBLayout.AddNatureFlats` reads no misc flat, so DFU stands both, as the
port did. Under the classic pictures the fountain stood by the tree's foot. Low Poly Trees (on by default) stands
prototype 504_12 there, its trunk 3.42 m about its root where it meets the ground, and the fountain stood inside it.
LPT-FIT kept a tree's crown off the roads and streets. Nothing kept its trunk off the town's own things. Of BLOCKS.BSA's
5,964 scenery trees with a Low Poly prototype, 46 had a trunk reaching one of their block's solid flats, about fifteen
of them fountains or wells. Not a scatter of the port's: Real Forests clears the whole location rect.

FIXED, a departure (LPT-FIT's sibling). The bake measures each prototype's trunk where it meets the ground: its solid
(one-sided) sub-meshes cut by the root's plane, rounded up. A location's Low Poly tree is drawn no wider than the room
its root has to the nearest solid flat body of its pixel (PROP-BODIES' bodies, less each one's foot) over that trunk.
The fit is the lesser of that and LPT-FIT's, never under `LPT_FIT_FLOOR`: a scale, never a move. The wild's trees are not
asked (FOREST1's clearings and VERGE1 stand them clear already). Crossleigh's tree draws at 0.418 of its prototype, its
trunk 1.43 m about its root, clear of the fountain. Port-Ledger A: a row of its own.

PINS. `test/world/road/fb1020c_trunkfit.test.js` (4): the bake (the module equals the tool's output, a prototype of
cards alone 0, every value rounded up); the cap's laws; with ARENA2, Crossleigh's scenery, fountain, distance and
caps (504_12 0.4178, and 504_18 by a crate 0.6755); the host by source. Mutants `tools/mutants/fb1020c_trunkfit.json`
(14, all dead). Pin moved: `lpt1_lowpolytrees.test.js`'s host pin reads the trunk's line after the crown's.

## BAG-COOK: a netted fish cooks at the fire, from the bag as from the pack (5)

`src/scenes/camps.js` (openCook), `src/systems/survival/camp.js` (cookFood), `src/ui/professions/profPages.js` (the
fire's words).

FOUND. A haul's answer mints its fish through the hands' give, which puts it in the Materials Bag before the pack
(`materialsBag.js` mintCarried, BAG1, 2026-10-03). The fish is C&C's own Raw Fish (template 535), exactly the food the
fire cooks. But the fire's Cook food list - a placed campfire's and a world fire's alike - read the pack alone. It was
written before BAG1 (SURV3, HEARTH1), and BAG1 wired the bag into DFU's potion maker but missed the fire. On the real
pool, two netted fish in a bag got "You have nothing to cook.", where the same haul without a bag listed both. On the
classic skin, which draws no bag, only Empty your bag into your pack reached them. The fire's own page still said every
gathered thing went to the Stores.

FIXED. The list holds the pack's raw food, then the bag's, while the pack holds a bag - as DFU's potion maker reads the
wagon after the pack (DaggerfallPotionMakerWindow.cs Refresh). The cooked food goes into the pack: a cooked food is no
material, and the bag holds materials alone. The fire's words say where gathered goods go, redrafted in every language
that holds them. DFU has no cooking (C&C is a mod) and no bag, so this departs from nothing DFU has.

PINS. `test/systems/fb1020c_bagcook.test.js` (4): the producer's own fish; the real pool's list and pick (the bag keeps
one Raw Fish, the pack gains a Cooked Fish); the `into` law; the words. Mutants `tools/mutants/fb1020c_bagcook.json` (6,
all dead). Pin moved: `prof9_client.test.js`'s cook line.

## BENCH-DOORS: a joinery's workbench is there wherever its doors answer (6)

`src/scenes/merchantYardsHost.js` (workbenchNear, targetsOf).

FOUND. The joinery (CARP-YARD, `03-World/Merchant-Yards.md`) is the one crafting station standing in a town's street.
A press on its carpenter, its board or its bench opens the Stores page on The Workbench. The page then asks whether the
player stands at it, and that question measured the feet from the bench's middle alone, against `YARD_REACH` (6.4 m,
DFU's static NPC reach, PlayerActivate.cs:87). The carpenter stands 8.55 m from that point and the board 9.55 m. So
every press in front of the carpenter, in the gateway or at the board outside the gate opened a page whose Workbench
read Away. The page offered no saw and no craft, only the Stores' Put in and Take out, with words sending a player who
stood in a joinery to one. Over a quarter-metre grid round the yard, with no wall in the way, 5,690 of 12,637 answered
presses (45%) opened it so - the bench's own among them, pressed on its end from six metres.

FIXED. Every box of a joinery is a door: its press opens the bench whatever part it meets, and a joinery stands no horse
and no wagon. The station question measures each at its nearest point across the ground. These are the press's own
boxes (`targetsOf`, built once), so a press answered from where the feet stand is a station answered there. Not a
departure: the joinery is the port's own.

PINS. `test/scenes/fb1020c_benchdoors.test.js` (3): the doors are exactly the carpenter, the board and the bench; a sweep
at two yard turns finds no answered press that leaves the bench Away; nothing past every door, over the roof or at a
Stable. Mutants `tools/mutants/fb1020c_benchdoors.json` (6, all dead). Pin moved: `carpyard1.test.js` test 6's reach,
measured from the bench box's end; three of `carpyard1.json`'s records re-aimed.

TEMPER-CARRIED, found on the way. Temper at the Anvil and Temper at the Loom (CRAFT4) stood only in the station list of
a book that carries nothing. Every live book carries since BAG1, and its page (`profPages.js` drawCarryStores) listed
neither, so tempering was drawn nowhere in the game though the host supplies it. The carrying page lists both beside
the anvil and the loom. Pinned by `test/ui/fb1020c_tempercarried.test.js` (2: a carrying book at a forge and at a loom);
`tools/mutants/fb1020c_tempercarried.json` (2, both dead).

## ONE-SAVE: a batch of put-ins waits on one save (7)

`src/net/profBook.js` (depositMany, deposit, ensureInStores, askDeposit), `src/ui/professions/profPages.js` (Put in, Put
everything in, BAG_PAGE_WORDS.kept), `src/scenes/world.js` (the deposit provider).

FOUND. A put-in waits for the save holding its take to land before it is asked (`06-Systems/Materials-Bag.md` section
7, AUDIT2 BAG1 H2), and that save is a realm checkpoint of the whole game. Put everything in asked one deposit a
material, in series, and every take and answer queued another checkpoint the next material's had to wait behind. With
the real realm session and save-soon, twelve materials cost eighteen checkpoint uploads on the press's path, about 1.75
a material. Every button read "Sending..." until the last: 2,105 ms busy at a simulated 100 ms upload and 40 ms ask.
Under load a realm checkpoint has been measured at ten seconds (`11-Multiplayer/Scale-Arc.md`). A station's shortfalls
did the same, one save an input.

FIXED. The take and its save live in one place, `depositMany`:
- every put-in of a batch is taken and stamped, then ONE checkpoint lands, then each is asked;
- a refused checkpoint gives every take back whole (`deposit-unsaved`);
- the first unanswered put-in leaves the rest unasked and kept for the next settle (`deposit-kept`), their takes in the
  landed save;
- `deposit` is a batch of one, with every guard and word it had;
- a craft's shortfalls go in as one batch;
- the Stores page's Put in and Put everything in each hand the host one plan, with no loop of their own left.

The kept words have one home (`BAG_PAGE_WORDS.kept`). On the same model, the press is busy 660 ms, with one checkpoint
on its path. H2's law stands: no ask before the save holding its take has landed.

PINS. `test/systems/professions/fb1020c_onesave.test.js` (6): one save before every ask, every asked id in it; a refused
save undoes all; a silence keeps the rest for the settle; the batch of one's every word; a craft's inputs under one
save; the page's one plan a press. Mutants `tools/mutants/fb1020c_onesave.json` (12, all dead). Pins moved:
`bag1_client.test.js` (D3, the refusal's line, two providers), `fb1009c_uncounted.test.js` (Put in, Put everything in,
the host's wiring) and `townecon_audit2.test.js` (PRICE-2's counter rule, now on the plan's line - CI caught it).
Records re-aimed in `bag1.json`, `fb1009c_uncounted.json` and `fb1009d_bagcraft.json`, all dead.

NOT CHANGED. The page's own wrapper holds no `try`/`finally`. A provider that threw would leave "Sending..." up until a
reload, but no such throw is proven. A realm upload asks with no timeout of its own. ONE-SAVE takes the press from many
uploads to one, so one stalled upload still holds it.

## OAR-RUNG: the oars handed back after a journey (8)

`src/systems/comeSailAway/comeSailAway.js` (the stroke's read, in `createComeSailAwayRuntime` - 2,488 of its 2,783).

FOUND. "Fast travel" at sea is the Overworld's crossing from the helm (OWS2, `06-Systems/Travel-View.md`). Its hand
drives the helm through three inputs - the sail toggle, the rudder and the autorun (`seaHelm.js`'s `row`, which rows
whenever it does not want sail) - and the stroke reads `state.oarThrottle > 0 || toggleAutorun`. HELM-LADDER
(2026-10-04, newer than the crossing) KEEPS the oars' rung: W pressed once leaves them pulling, S from the last sail
leaves them backing, and only raising sail or leaving the helm resets them. The crossing never touched the rung, and its
end strikes the sails and lets go of the autorun - so a helm left on her oars, "without full sails", rowed on with
nobody steering. Driven on the real runtime and hand (a mark 900 m off, wind 1.5 m/s): a Large Galley from "Oars:
pulling ahead" arrived and then ran 931 m in the next two minutes at 7.76 m/s. Full sail and rest left only Come Sail
Away's own current, 0.75 m/s. From "backing water" no hull ever arrived: backing, the helm answers the other way, so the
rung turned the hand's rudder about while the autorun rowed her ahead. The drift shows when a journey ends at sea - foes
near, a spot on the water, no way made; a landfall's disembark stops her.

FIXED. While the autorun pulls she has no rung of her own: it is cleared just before the stroke is read, so when the
autorun lets go she rests, as the mod's held MoveForwards let go left her. The player's own autorun clears a W-kept
rung the same way. The reversed rudder's law (`oarThrottle < 0`) is left as HELM-LADDER wrote it: with the rung cleared
under the autorun no case of this report reaches it. The kept rung is the port's own (Port-Ledger A, THE ARROWS ARE THE
HELM, amended).

PINS. `test/systems/comeSailAway/fb1020c_oarrung.test.js` (4), over ows2's crossing harness (moved to
`test/csaCrossing.mjs`, its `sailTo` taking a starting rung and the let-go): a galley from every rung (rest, oars, all
sail, struck, backing) arrives with the rung at nought, and two minutes after the let-go has under 0.05 m/s of way and
has run under 400 m; from backing water hulls 1 to 3 arrive with the mark astern; the player's autorun clears a W-kept
rung; the source. Mutants `tools/mutants/fb1020c_oarrung.json` (3, all dead). Pin moved: `ows2_crossing.test.js` imports
the harness.

## HARBOUR-REACH: a port's harbour sounded within the port law's own ring (9)

`src/systems/naval/harbourBook.js` (portRingReach, the far sounding), `src/scenes/world.js` (`navalHarbourNear`'s
`ready`, a reach of its own - line neutral).

FOUND. A port town is one the open sea bears on within SEA_RING map pixels (`world/portSites.js` portTownOnSea): its
shipyard, its lighthouse, its harbour board. Its harbour - the quays, the docks on the town map, the moored ships - was
sounded on the built ground within HARBOUR_REACH (420 m) of its footprint (`shipLife.js` findHarbour). Two distances for
one sea. DFU's kernel (DefaultTerrainSampler, TerrainHelper.BlendLocationTerrainJob) carries a high coast's ground far
out to sea, and on the real map 37 of the 106 port towns sounded no harbour at all:
- cities: Daggerfall (its nearest berth 1,542 m off), Sentinel (721 m), Wayrest (1,118 m), Ripmore, Eastwold,
  Bubissidata;
- among the rest: Holwych, Midbrugh, Wilderham, Longwich End, Isfakabi, Mesiton, Aldingshire, Chardale, Crossleigh,
  Gallocart, Pencart and Aldbrugh.

Holwych's pixel stands at height byte 34 and the sea beside it at 2, and the kernel carries that cliff some 800 m into
the sea's pixel. FIELD BUGS 2026-10-13c PORT-TOWNS measured the same shores (Sentinel 683 m, Wayrest 1,074 m) and kept
those towns ports.

FIXED, the port's own (DFU has no harbours). A port whose own reach finds no berth is sounded again out to the ring the
port law read (`portRingReach`: SEA_RING and a half pixels less half the footprint):
- only once every pixel of that ring is built (`ready(r)`), never cached as "no harbour" over unbuilt ground (an unbuilt
  pixel reads as land);
- once a book's life, its scan being some five times the near one's;
- an isle past the Veil keeps its own reach (AUDIT CAPTAIN'S SEA H1).

The world's terrain sampler cannot answer an unbuilt pixel cheaply (the classic TileMap needs the pixel built - its
location tiles, its blend, its roads - and Deep Waters' floor its bake), so the sounding waits for the build. 36 of the
37 stand a harbour; their docks may stand up to about 1.5 km from the town. Port-Ledger A, the HOLDINGS row, amended.

PINS. `test/systems/naval/fb1020c_harbourreach.test.js` (5): the ring's reach; a far shore found; never sounded over
unbuilt ground, and sounded once; an isle's own reach; the source; with ARENA2, the 37 named, and after the book only
`Aldbrugh` without. Mutants `tools/mutants/fb1020c_harbourreach.json` (9, all dead). Pins moved: `auditholdings.test.js`
O1 and `auditcaptsea.test.js` H1 (the reach's seam).

OPEN. Aldbrugh (Shalgora) sounds no berth within the ring and keeps its port without a quay. Daggerfall's far berth
lies 97 m inside the ring's edge; under Deep Waters a berth lies some 80 to 92 m farther out, not measured here. At the
default TerrainDistance a shore two pixels off is sounded once the player has come within a pixel of the town.

## BERTH-RING: a voyage counts at every port (11)

`src/scenes/world.js` (navalPortHere, `where`'s `port` - line neutral), `src/scenes/naval/navalHost.js` (inPortWaters),
`src/systems/naval/harbourBoard.js` (deliveryPort).

FOUND. The tutorial is QLIS01 "Under Sail" (`ql act port-reached 1`; QLOC02 "The Packet Lanes" asks two). The act is
heard only from the harbour office (`harbourOffice.js`), when a ship berths at a port other than the one she last
berthed at, 1,207 m or more of sailing later. A berth is the naval host's: at her helm, slow, no hostile ship near, in a
port's waters. A port's waters were a map pixel about the player (`navalPortHere`, `navalNearPort`). On the real map,
twelve of the 106 board ports have no water a Small Ship lies in within a pixel: Aldbrugh, Daggerfall, Gallocart,
Holwych, Isfakabi, Longmore Field, Longwich End, Pencart, Ripmore, Wartale, Wayrest and Wilderham. They are HARBOUR-REACH's
towns: a ship summoned there stands on water up to three pixels off, out of the berth's ring. A voyage begun or ended
there never named the port - the departure went unmarked (a log's first berth only marks where she lies, by the office's
own law) or the arrival was taken for one - and the objective never registered. On the real host, office and ledger, a
voyage from port pixel to port pixel heard the act; from a ship lying past the ring, never. The delivery contract's port
(`deliveryPort`) read the same pixel, so Daggerfall, Sentinel and Wayrest took no cargo.

FIXED. A port's waters are the ring the port law reads, SEA_RING, imported from its one home:
- the port lain at (`navalPortHere`), handed over by `where()` whether or not Come Sail Away's own one-pixel `nearPort`
  is set;
- the naval host's one question, `inPortWaters`: the berth, the shipwright (`yardHere`), the crew's in port and at sea,
  and CC-D1's two readers;
- a cargo's port (`deliveryPort`, `seaBears`): the cargo ports become all 106.

`SEA_RING` and `seaBears` live in `net/fortLaw.js`, beside the coast's other law (`coastalAt`), and `world/portSites.js`
re-exports them. CI caught the first cut: `harbourBoard.js` is bundled into the account Worker, and importing them from
`portSites.js` pulled its whole placement graph into the Worker's bundle, where a change to it would not deploy
(`test/server/accountdeploy.test.js` ACC1-CI). The coast law was already the Worker's.

Left at a pixel, each for its reason: `navalNearPort`'s other readers - the sea's traffic weights (the navies' and the
merchantmen's, SEA-EASE) and CAPT-WATERS' `watersOf` - ask who sails near a port, not whether she lies in one; and the
harbour's sounding ring, HARBOUR-REACH's. No two board ports stand closer than 1,638 m, past the voyage's 1,207 m, so
the wider ring makes no false voyage. Port-Ledger A, THE CAPTAIN'S SEA row, amended.

PINS. `test/systems/naval/fb1020c_berthring.test.js` (4): a voyage on the real naval host, office and ledger from
Daggerfall's ring to Sentinel's hears `port-reached`, and with no port in reach no berth is made; `deliveryPort` at two
pixels against three; the source; with ARENA2, every one of the 106 has water within SEA_RING, and exactly the twelve
above had none within a pixel. Mutants `tools/mutants/fb1020c_berthring.json` (7, all dead). Pin moved:
`fb1013c_porttowns.test.js` (the delivery ring two pixels; cargo ports 106). Records re-aimed by content:
`auditcaptsea.json` (ACS-C11-cook, ACS-H1-book), `auditcrew.json` (CC-D1-port-repairs, -port-order), `captcrew.json`
(CC-host-cook), `navaudit_helm.json` (NAV1H-the-port-unread), `fb1013c_porttowns.json` (PORT-TOWNS-the-sea-anywhere).

## CABIN-FOES: no cabin with enemies near (12)

`src/systems/sailingCabin.js` (CABIN_REFUSAL.enemies, cabinEntryRefusal's `hostile`), `src/scenes/sailingCabin.js`,
`src/scenes/world.js` (the deck door's deps, and Transport > Ship's door - net one logical line fewer).

FOUND. The sailing cabin (SAILING-CABINS) is an interior, and every interior transition empties the sea
(`world.js` navalTransition, then `naval.clear()` - NAV-H): its ships dropped, a boarding raid withdrawn. The cabin's
door asked whether the boat was hers, whether she stood on it and whether she held the helm, and never whether a hostile
ship was near. On the real naval host, a bold Pirate Brigantine 120 m off: the door opened, the sea held no ship, and
back on deck a minute later the pirate was gone for good. Every other way off the sea - the rest, the journey, the
time scale, the shipwright - asks the hostile question (`hostileNear`, HOSTILE_NEAR_M).

FIXED, a departure. Both doors into the cabin - the deck's and Transport > Ship's to a linked bank cabin - refuse
while a hostile ship is near: "You cannot enter the cabin with enemies nearby." It is asked after the helm and the
boarding refusals, and reads the same question the rest asks (`navalHostileNear`). DFU keeps a building's exterior and
its foes inactive behind the door and active again past it (PlayerEnterExit.cs DisableAllParents /
EnableExteriorParent). Keeping the sea waiting below decks was the other choice. It was not taken: it would let a
player rest mid-fight, the cabin being off the deck. Another player's cabin is reached by a staff landing only, never
from a deck, so no third door needed the law. The refusals are not in the language tables, so none was added there.
Port-Ledger A, the SAILING-CABINS row, amended.

PINS. `test/systems/comeSailAway/fb1020c_cabinfoes.test.js` (3): the refusals' order; the real naval host with a bold
pirate brigantine at 120 m - the door refuses, no room is entered, and the pirate is still on the sea (after `clear()`
the door opens); both doors by source. Mutants `tools/mutants/fb1020c_cabinfoes.json` (5, all dead). Pins moved:
`sailingcabins.test.js` and `fb1003b_cabinhull.test.js` (their rigs read the runtime and the hostile seam).

## Found on the way, not fixed here

- **A rowing animator that never returns** (`src/world/unityAnimator.js`). The Rowing 2D blend tree measures 2.98e-8
  seconds long when RowX and RowZ are both nought while rowing. Its time then runs away, and `eventsCrossed` loops
  millions of times. A zero oar input in the Rowing state brings it on, and it is reproduced at `469dc0ed5`.
  `fb1020c_oarrung.test.js` is written past it. It is the next field-bug record's to trace into the running game.
- **Two mutant survivors on main**, neither in code this record changed; both survive at `469dc0ed5`.
  `auditships_sail.json`'s AUDIT-SHIPS-A5-the-gain-on-every-coast (`comeSailAway.js` coastAccel, `!(share > 0)` dropped) is
  equivalent: `share` never leaves 0 to 1, and at 0 the partial branch is the whole coast. `passage.json`'s
  PASSAGE-sea-stood-again-after-a-door (`passageBerths.js`) is not killed by `passagesea.test.js`. Each is its own
  arc's to re-aim or mark.
- **Three ARENA2 pins** fail at `469dc0ed5` with the freeware's data: `fb1004d_cratefree`'s every-RDB-block pin (an
  extra `N0000005.RDB` quest marker), and IT1 and WD1, whose gate patches' sha256 differ from the fetched data. They are
  ARENA2-gated, so CI does not run them.
- **Seventeen mutant survivors in `auditdisc28_quests.json`** (AD28Q-J-host-no-party-word and the sixteen
  AD28Q-J2-cell-* records, on `world.js` partyPeer and the exterior foes' kept record) survive at `469dc0ed5` too. They
  are a hole an earlier change left, owed a re-aim in their own arc.


## ONE-LEVEL: the hill is Daggerfall's, and our second levelling makes it steeper - open (1)

FOUND. The Silver Hedgehog Pub (Menevia's location 96, a tavern, the map pixel (800, 181)) stands on the face of
Menevia's sea cliff, about 1.4 km tall in WOODS.WLD: sea to its west and north, a rim plateau along x = 800, the land
past it lower. Vanwood (location 128, a village, (801, 191)) stands on the plateau ten pixels south. The pub's pixel is
the fourth steepest of all 15,251 sites in DFU's own data (69.0 degrees at the 51 m grade, where the median site is 7.1
and the 99th percentile 30.9). The three steeper are its neighbours on the same rim. DFU's blend levels the pub to its
pixel's mean, a third of which is sea, so it stands on a ledge about 450 m below the plateau. On DFU's own ground the
walk from Vanwood drops 1,096 m, its steepest 3.2 m step 58.7 degrees.

What the port adds, measured on the full pipeline:
- LANDFORM1's lift adds about 271 m of descent. That is its design.
- A small site is levelled TWICE. LANDFORM4's pull (a 1x1's reach 68.5 samples) runs in the kernel, and DFU's
  `BlendLocationTerrainJob` (a ramp of 54 samples to the pixel's edge) runs again after it. Their combined weight, 1 -
  (1 - m)(1 - s), stays near one further out than either alone but must still reach nought at the pixel's edge, so the
  rise is given back in less run - about 1.4 times DFU's grade. DFU's own contract is one levelling, never two
  (DaggerfallTerrain.cs runs the blend only `if (!TerrainSampler.IsLocationTerrainBlended())`, TerrainSampler.cs:65-71).
  `03-World/Landforms.md` LANDFORM4 says DFU's blend "finds its pixel all but level at that mean". That holds from 4x4
  sites up, not for the small ones.
- The walk's steepest step is 66.4 degrees where DFU's is 58.7. The pub's pixel holds 761 samples past the motor's 70
  degree limit, where DFU's ground has none. Map-wide, 3,368 samples past 70 at seven sites (all 1x1), against DFU's 489
  at three. On the walked line itself no step passes 70, so nobody falls on that walk.
- The Overworld's free route never weighs a slope (`travelRoute.js`, MOUNTAINS WALKABLE), and "Enemies are near. You
  slow your pace." in the screenshot is OW6's threat governor, not the hill.

NOT FIXED. One levelling was built and measured over every site and 4,471 neighbour pixels, against five criteria: the
pub's pixel back to DFU's count; no more ground past 70 than shipped; no site steeper than shipped by more than one
degree; the big towns LANDFORM4 was built for no worse; and every existing pin passing or moving for a reason. No design
met all five. The census:

| Design | The pub past 70 | Past 70, all sites | Sites steeper > 1 / > 3 degrees | Towns moved > 5 m |
|---|---|---|---|---|
| shipped | 761 | 3,368 | - | - |
| one levelling toward the pull's level | 0 | 640 | 365 / 79 | 936 (the pub +123 m) |
| one levelling toward the blend's mean | 0 | 646 | 598 / 311 | 0 |
| an agreed target, one levelling, the reach widened | 0 | 293 | 66 / 13 (and 12 capitals worse) | 0 |
| an agreed target, DFU's blend, the reach widened | 0 | 1,028 | 93 / 22 | 0 |
| DFU's contract taken literally (no ramp) | 188 | - | 284 sites with a wall over 5 m at the rect's edge | - |

The two closest gentle 13,564 and 13,797 sites. But they steepen 66 to 93 others (Gothway Garden 18 to 44 degrees), and
they move the rim's give-back into its neighbouring cliff pixels (102 samples past 70 there become 723). The reason is
the laws' own:
- the pull's level is the land alone (AUDIT LANDFORMS III D4) and leaves the water's valleys out (C1);
- the town's height is the pixel's whole mean;
- the two disagree by more than 3 m at 1,156 sites (255 with the sea beside them, 169 a river);
- the stacked blend is what keeps those gentle.

OPEN, and the owner's. Either the no-regression bar becomes an aggregate (gentler at about 13,600 sites, steeper at 66
to 93), or three laws change together: the site's level reads what the town's mean reads (the valleys and the coast),
LANDFORM4's handover between two sites' levels spreads over the whole span between them (C5), and the rim's cliff pixels
get a rule of their own. The cliff and the ledge themselves are DFU's data and stand. No code changed for this report.
