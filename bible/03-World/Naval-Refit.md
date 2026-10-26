# Naval Refit - the sea's second refit (NAVAL-REFIT, 2026-10-17)

The owner, 2026-10-17: *"This will be a naval improvement session."* - nine items, each taken as a slice of its own:

1. "Cargo should be able to be accessed at any time. Currently it cannot be."
2. "In that when pirates attack but your first boat (the one that is assigned to be your cabin if you press T > ship)
   You spawn and fight in land which is cool and way better than being teleported to a ship a mile away. Anyway the
   actual bug is that after you defeat the pirates they keep spawning but passive"
3. "Different cannon shot types, for example a grape shot to thin out crew, Chain to try to take down their sail, etc"
4. "Improve and polish combat and visuals"
5. "Let us board a ship without weakening it.. like just ram and board"
6. "When out of combat, the ship should traverse 15% faster"
7. "Can you make it so each island does sell atleast one normal exchange product so you could feasibly live and trade
   out in the veil"
8. "Letting players customize the exterior and interior textures of the ship. Allowing prop placement on the ship itself
   and inside if not already enabled."
9. "Finally, a fully customizable flag with the option to use your guild insignia."

And: *"No band aids, I want you to be as detailed as possible."*

The owner, later the same day, to the queue: *"I also want the ability to have a name plaque on the ship itself for those
who want to show off their ship name. Additionally, enemies and merchants should have their own unique liveries, flags
hosted, etc"* - two slices more, SHIP-PLAQUE (12) and SEA-COLOURS (13). And after them: *"Please once more audit
everything and ensure perfection. Also fix a pre existing issue where AI can actually use the overworld as time
dilation"* - AUDIT 2 and TIME-DILATION (14). And last: *"please reformat the text to not refer to the ship as "Her".
Text needs to be mundane, readable and not AI-like"* - SHIP-IT (15).

The owner, the same day, to the queue: *"A firmament styled captain skill tree along with making improvements to the
ship upgrade system"* - and a player's ask beside it: a skill tree for the ship *"integrated with leveling"*, levels that
*"unlock upgrading with ores from steel to Ebony and beyond"*, the Firmament's *"Master and commander sections"*, and
*"connect current stats to ship behaviour"* - taken as two slices more, CAPTAIN-TREE (10) and REFIT-ORES (11). The
player's dwemer submarines were out of this session's scope (said to the owner).

**THE PORT'S OWN**, as the sea fight is (`03-World/Naval-Combat.md`): Daggerfall has no sea and Daggerfall Unity none
either. Where a slice leaves a vendored mod's own law (Come Sail Away's, `03-World/Come-Sail-Away.md`) it says so here
and in `01-Overview/Port-Ledger.md` section A.

## The slices

| slice | item | what | modules |
|---|---|---|---|
| ISLE-TRADE | 7 | every Eltheric isle's freeport makes a good of the Bay of its own and sells it as made; the chart's card names it | `systems/naval/tradeGoods.js` (`isleGood`, `portTrade`, `exchangeOf`), `ui/etherChartWindow.js` |
| PEACE-WAY | 6 | out of a fight her way, and its coming on, PEACE_WAY (1.15) of what it is in one | `systems/comeSailAway/peaceWay.js`, `systems/comeSailAway/comeSailAway.js` (`peace`, the speed arms, `moveAccelOwn`), `scenes/world.js` (the runtime's `peaceWay`) |
| CARGO-ANYWHERE | 1 | a ship's hold opened from anywhere - the hold's key (F4), the helm's Hold, the Fleet page's Hold - at hand, last helmed or the fleet's first, wherever she lies; the hold two-way on the Enhanced skins | `scenes/holdDoor.js`, `systems/comeSailAway/comeSailAwayItems.js` (`cargoLootTarget`), `ui/enhanced/enhancedInventory.js` (`remoteModel`), `scenes/fleetHost.js` (`hold`), `ui/fleetPage.js`, `ui/enhanced/enhancedHelm.js` (`helmButtons`), `systems/inputActions.js` (`ShipHold`), `scenes/world.js` |
| RAM-BOARD | 5 | RETIRED by BOARD-MAGNET (2026-10-26) with the ram: a ram fouled her - for FOUL_S her way was held and she was boarded as she stood, her whole crew against me | `systems/naval/navalFoul.js`, `scenes/naval/navalHost.js` (`checkRams`, `boardingGap`, `footReach`, `stepHeaveTo`, `crewShips`, `word`, `targetCardOf`), `systems/naval/navalAI.js` (`stepCaptain`), `ui/naval/navalHud.js` (`cardState`) |
| BOARD-MAGNET | 5 | (2026-10-26) the ram retired - mine and a galley's, and RAM-BOARD's foul; a struck ship in the grapples' reach is "E: board" at any way, and the haul draws her alongside my ship as it lies each frame while my way comes off, side by side where I come to rest; the captain's ram stars reach farther | `systems/naval/navalBoarding.js` (`boardableState`, `berthHull`, `berthPose`, `haulBrake`, `haul`), `scenes/naval/navalHost.js` (`boardingGap`, `brake`, `wayScale`, `berthFor`, `startBoarding`, `stepBoarding`), `systems/naval/captainTree.js` (`reach`), `ui/naval/navalHud.js` (`cardState`, `navalPadPrompts`, the hint), `ui/captainTreeWindow.js`, `ui/shipyardWindow.js` |
| RAID-ASHORE | 2 | a voyage's raid fought where the player stands ends there: its crew and last raiders withdrawn, the quest ended; one raid at a time on the fast travel | `scenes/raidAshore.js`, `systems/warmAshesShips.js` (`LeaveShip`, `onPreFastTravel`), `scenes/world.js` (`raidAshore`, Warm Ashes' host, the quest's end) |
| SHIP-COLOURS | 9 | a ship flies a flag of her captain's design - its shape, its field and division, its border, its device and that device's colour, or the captain's guild's arms - as cloth at her masthead, in her pennant's place, seen by every player | `systems/naval/shipFlag.js`, `ui/flagArt.js`, `render/shipFlagPass.js`, `scenes/shipFlagHost.js`, `systems/fleet.js` (`colours`, `setShipColours`), `scenes/fleetHost.js` (`colours`), `ui/fleetPage.js` (`coloursPanel`), `systems/comeSailAway/comeSailAwayWire.js` (`f`), `scenes/comeSailAway/comeSailAwayPeers.js` (`flagged`), `ui/heraldryArt.js` (its device painter shared), `scenes/world.js` |
| CAPTAIN-TREE | 10 | a captain's level, earned at sea off the captain's log, buys a point a level for a sky of stars in the Firmament's dress - the Master's seamanship to the left, the Commander's war to the right - each star a share of a ship's own number read where that number is read: her way, oars, helm, hold, hull, repairs, trade, guns' harm, reload and aim, the shot locker's grape, chain and heated shot, her boarders, her ram and its foul | `systems/naval/captainTree.js`, `systems/naval/captainLedger.js` (`captain`, `tree`, `setTree`, `stats`, the save's `tree`), `ui/captainTreeWindow.js` (drawn by `ui/skyWindow.js` since RVN-STARS), `ui/captainPage.js` (the stars' card), `ui/naval/navalPlunderDoor.js` (`createCaptainStarsOverlay`), `ui/enhanced/enhancedMenu.js` (the Captain page's door), `scenes/fleetHost.js` (`refit`), `systems/comeSailAway/comeSailAway.js` (`rigOf`'s `oars`, `turn`), `scenes/naval/navalHost.js` (`crewStep`'s worth, `crewSkill`, `loadedGun`, `landHit`, `checkRams`), `systems/naval/shotKinds.js` (`shotFireChance`'s `k`), `systems/naval/navalFoul.js` (`foul`'s `more`), `systems/naval/tradeGoods.js` (`exchangeOf`'s `edge`), `scenes/harbourOffice.js`, `scenes/world.js` |
| REFIT-ORES | 11 | past the shipwright's three tiers, nine of metal - Steel to Daedric, DFU's own ladder - each asking a captain's level, its metal (ingots, or a weapon or a piece of plate of it melted down) and her line's first store | `systems/fleet.js` (`ORE_TIERS`, `MATERIALS`' metals, `refitMetalOf`, `meltable`, `materialCount`, `takeMaterials`, `meltCount`, `materialsFor`, `upgradeCost`, `refitShare`, `REFIT_NUMERALS`), `scenes/fleetHost.js` (`offer`, `act`'s refit), `ui/fleetPage.js` (`refitRowWords`, the refit panel), `ui/shipyardWindow.js` (its Refits tab) |
| SHIP-LIVERY | 8 | a ship painted by her captain - a port-built hull's strakes, trim and canvas, a classic-planked hull's wood stained and its sails tinted, each of fourteen paints or as built - drawn so wherever she is drawn, seen by every player | `systems/naval/shipLivery.js`, `world/ships/shipLiveryArt.js`, `scenes/comeSailAway/shipLiveryPaint.js`, `scenes/comeSailAway/comeSailAwayPool.js` (`liveryCodeOf`, the draw's remap), `systems/fleet.js` (`livery`, `setShipLivery`), `scenes/fleetHost.js` (`livery`), `ui/fleetPage.js` (`paintPanel`, `paintSvg`), `systems/comeSailAway/comeSailAwayWire.js` (`l`), `scenes/comeSailAway/comeSailAwayPeers.js`, `scenes/world.js` |
| CABIN-LOOK | 8 | her cabin below stained one wood, her windows lit as built | `scenes/cabinLook.js`, `scenes/interiorContext.js` (`restyle`), `scenes/sailingCabin.js` (the visit's `restyle`), `scenes/worldModes.js`, `systems/fleet.js` (`cabin`, `setShipCabin`), `scenes/fleetHost.js` (`livery`'s `cabin`) |
| DECK-PROPS | 8 | Daggerfall's crates and chests stood on her open deck by a plan of it from above - drawn with her, rocking with her, standing in her colliders, seen by every player | `systems/naval/deckFittings.js`, `scenes/comeSailAway/deckFittingsHost.js`, `scenes/comeSailAway/comeSailAwayPool.js` (`fitBoats`, `fitDeps`), `ui/deckPlanWindow.js`, `scenes/deckPlanDoor.js`, `ui/naval/navalPlunderDoor.js` (`createDeckPlanOverlay`), `systems/fleet.js` (`deck`, `setShipFittings`), `scenes/fleetHost.js` (`deck`, `deckPlan`), `ui/fleetPage.js` (Deck), `systems/comeSailAway/comeSailAwayWire.js` (`d`), `scenes/comeSailAway/comeSailAwayPeers.js`, `scenes/world.js` |
| COMBAT-FEEL | 4 | the fight felt at my rail: gun smoke carried by the air and hanging, a ball's fall a spout grown for the eye far off, a near pass whistling and a near fall drenching her, the side a blow came from and her hull bar's loss on her plate, a burning ship's magazine going up as she founders and the air boiling up off her, my battered boat smoking in a fight, her card's men and my volley's count of them, each battery's seconds to load | `systems/naval/navalEffects.js` (`step`'s air, `smoke`'s `hang`, `splash`'s `scale`, `spout`, `drench`, `founder`), `systems/naval/navalShots.js` (`pass`, `boxGap`, `segmentNearBox`), `scenes/naval/navalFeel.js`, `systems/naval/navalSounds.js` (`whistle`), `tools/navalSfx.mjs` (`naval-whistle`), `scenes/naval/navalHost.js` (the feel's wiring, `tallyMen`, the card's `crew`, the batteries' `left`), `ui/naval/navalHud.js` (`plateLoss`, the rose's blow, the batteries' seconds, the card's crew bar, the tally's men) |
| SHOT-KINDS | 3, 4 | four loads - round, grape, chain, heated - a battery group's own choice, each its own ball, blow, picture and word; pirates board with grape | `systems/naval/shotKinds.js`, `systems/naval/navalGunnery.js` (`aimSolution`, `volleyLaunches`, `reloadSeconds`, `createGunDeck` `setLoad`), `systems/naval/navalShots.js`, `scenes/naval/navalLoads.js`, `scenes/naval/navalHost.js` (`fire`, `fireFromWord`, `landHit`, `loadedGun`, `lookOnShip`, `aimStrikes`, `gunsRecord`, `hudModel`), `systems/naval/navalWire.js` (`o`), `systems/naval/navalAI.js` (`captainLoads`, `boarderBroadsides`, `gunnery`), `systems/naval/navalEffects.js`, `render/navalRender.js` (`ballPictures`), `ui/naval/navalHud.js`, `ui/enhanced/enhancedHelm.js`, `systems/inputActions.js` (`ShotCycle`), `scenes/world.js` |
| SHIP-PLAQUE | 12 | her name on her bows, where her captain shows it: a board of dark wood with her name cut in gilt in Daggerfall's own lettering, laid on each bow's planking below her rail and read the right way from alongside, seen by every player | `scenes/comeSailAway/shipPlaque.js`, `scenes/comeSailAway/comeSailAwayPool.js` (`hullSurface`, `plaqueNameOf`, the draw's boards), `systems/fleet.js` (`plaque`, `setShipPlaque`), `scenes/fleetHost.js` (`plaque`), `ui/fleetPage.js` (Show her name), `systems/comeSailAway/comeSailAwayWire.js` (`p`), `scenes/comeSailAway/comeSailAwayPeers.js` (`plaqueName`), `world/eliteGates/pseudoArchives.js` (PLAQUE_ARCHIVE), `scenes/world.js` (the pool's `plaqueOf`, `plaqueFont`; the word's `plaque`) |
| SEA-COLOURS | 13 | every ship of the sea in her own paint and under her own flag of cloth - a navy's crown, a merchant house, a pirate crew, a legend's own; a pirate under false colours painted and flagged as the house she passes for; her colours down once struck - the same on every screen, off who she is | `systems/naval/seaColours.js`, `scenes/naval/navalHost.js` (`seaWho`, `buildOne`'s paint, `seaFlags`), `scenes/shipFlagHost.js` (`seaFlags`), `render/shipFlagPass.js` (FLAGS_MAX), `scenes/world.js` (the flag host's `seaFlags`) |
| TIME-DILATION | 14 | the sea's AI never on the Overworld's clock against a traveller who cannot answer it: a journey held at x1 inside a hostile ship's reach (NAV-H's law, the helm's already), the Overworld brought down for her, and online a sea another player shares kept at real time | `systems/travel/travelThreat.js` (`foeRate`, `threatCap`'s `held`), `systems/naval/seaClock.js`, `scenes/naval/navalHost.js` (`threats`' `holds`, `frame`'s seconds), `scenes/world.js` (the governor's two paths, the view's `danger`, `tvJourneyUp`, `travelViewCanGo`) |
| SHIP-IT | 15 | the game's words call a ship "the ship", "this ship" or "it" - never "her" or "she" - and say it plainly: every refusal, notice, button, card and hint of the sea, the Fleet, the shipyard, the crew hall, the captain's stars, the tutorials and the crew's chatter; the thirteen drafted languages drafted again for the 104 keys whose English moved | the words of `scenes/fleetHost.js`, `ui/fleetPage.js`, `scenes/naval/navalHost.js`, `ui/naval/navalHud.js`, `ui/naval/navalPlunderWindow.js`, `ui/naval/navalYardWindow.js`, `ui/shipyardWindow.js`, `ui/captainTreeWindow.js`, `ui/captainPage.js`, `ui/deckPlanWindow.js`, `systems/shipyards.js`, `systems/crewHall.js`, `systems/naval/*` and `systems/comeSailAway/*` among others; `locales/*/Port_Strings.csv` |

## ISLE-TRADE - a living past the Veil (item 7)

FOUND. Every port isle of the Eltheric Ocean dealt the same board: the three Eltheric goods made (`tradeGoods.js
portTrade`'s ether arm), every good of the Bay WANTED at EXOTIC_K - and `exchangeOf` listed the other sea's goods only
where wanted, and sold none of them (`sells: exotic ? 0 : ...`). So no isle sold wine, grain, wool, iron, spices, silk,
silver or ivory, and since every isle made the same three, no Eltheric good paid from one isle to the next: the only
trade that paid crossed the Veil (CAPT-TRADE's "a reason to cross", `03-World/Captains-Sea.md`), and a captain who
wanted to live out there had nothing to buy.

CHANGED:
- **Each isle's own good** (`isleGood`): one of the Bay's eight, drawn off the port's key - `etherPortOf`'s `"px,py"`
  (`scenes/world.js`), the same on every client - on its own scrambled draw (`mulberry32` of the key's hash). A plain
  `hash % 8` gave neighbours the same few goods (Veilhaven and its five nearest: silver, iron, iron, wine, silver, iron);
  the draw spreads them evenly - the 234 port isles within 400 px of Veilhaven hold 19 to 34 of each good. Veilhaven's is
  spices.
- **Made there** (`portTrade`): an isle makes the three Eltheric goods and its own good of the Bay, and wants every
  other good of the Bay - so its own is priced MADE_K and dealt at DAY_STOCK's `makes` (30 sold a day, 4 bought), exactly
  as a port of the Bay deals what it makes.
- **Sold, and listed** (`exchangeOf`): the other sea's goods are listed where they are wanted or made (`neither` alone
  is left off), and a row is EXOTIC - "not sold here", hidden on the classic skin unless carried (B16's `etherGoods`) -
  only where it is the other sea's good and NOT made there. The Bay's boards are unchanged: an Eltheric good is always
  'wants' in the Bay.
- **On the chart** (`ui/etherChartWindow.js`): a port isle's card reads "A port - makes spices - 12 leagues west", its
  good drawn off the same key the world host gives its port, so a captain plans the Veil's trade on the chart.

What it makes possible, measured (`test/systems/naval/isletrade.test.js`): from every port isle within 120 px of
Veilhaven its own good is bought at its made price and sold in another isle's exchange within 64 px (eleven leagues -
the farthest buyer of those 23 isles is 60 px off) for more than half again what it cost - the Veil's own trade, no
crossing. The Eltheric goods stay made on every isle and wanted in the Bay, so the crossing keeps its reason.

`tradeGoods.js` rides the account service Worker's bundle (`itemLaw.js`), so the change redeploys it; it imports
nothing new (`test/server/accountdeploy.test.js`'s graph is unchanged).

## PEACE-WAY - her way out of a fight (item 6)

`systems/comeSailAway/peaceWay.js` holds the law; Come Sail Away's runtime reads it through one seam.

- **Out of a fight** is what the sea already reads as one: no enemy near her - the runtime's own `enemiesNearby`
  (AreEnemiesNearby over the street's foes and the city's guards, and the sea fight's hostile ship in reach: the word
  that already holds the helm's time scale) - no boarding under way (`navalHost.js boarding`, either side's) and no
  broadside laid (`aiming`). The world host answers the seam over exactly those three (`peaceWay()` beside `brake` in
  the runtime's deps, reading `this.enemiesNearby` - one word, never a second copy of it).
- **What it scales** (`comeSailAway.js`): both of `moveSpeed`'s arms - `oarSpeed` and `sailSpeed` - so her way under
  oars and under sail is PEACE_WAY (1.15) of what it is in a fight, and the journey's estimates (`sailWayOf`,
  `oarWayOf`, AUDIT SHIPS A4) say the way she makes; and the rates her way COMES ON at under oars and under sail
  (`moveAccelOwn`), so she reaches her new way in the time she reached her old (a galleon and a Carrack to 95% in the
  same quarter second as in a fight). A coast - her way lost with no sail set and no oar pulling - is left as it was, so
  when a fight begins she sheds the bonus at her own coast and no quicker. A heave-to's brake is the sea fight's own
  number and is not scaled.
- **Bounded** (`peaceShare`): the seam's answer is held to [1, PEACE_WAY]; none handed (a test scene, the Overworld's
  own runtime calls) or anything not a number is her own way - the mod to the letter.
- **Hers alone.** The captains sail their own law (`navalAI.js helm`; SAIL-FREE's record: scaling them broke the
  duels' tuning), so a fight's odds are unchanged and a ship that runs from her runs from the way she makes in a fight.
  Online her way is said by her measured velocity (`comeSailAwayWire.js`), so the bonus needs no word.

A departure from the mod's `moveSpeed` and `moveAccel` (ComeSailAway.cs 525-551), recorded in Port-Ledger section A.

## CARGO-ANYWHERE - the hold, at any time (item 1)

FOUND. Come Sail Away opens a hold one way - a press on the boat's cargo box (trigger 112402) within the mod's 3.2 m
(`comeSailAway.js` OpenBoatCargo -> OpenCargo -> the host's `csaOpenCargo`); BOAT-MENU's "Open storage" presses that
same box from anywhere on her hull, and nowhere else. So the hold was out of reach: at her helm (AUDIT BOAT-MENU C1 keeps
the list off a helm - the pad's d-pad steers there - and every hull's box stands 5.9 m (the Large Boat) to 28 m (the
Carrack) from its wheel); below deck in her cabin (CABIN-HULL: no boat answers a press in the room); from her quay a
step past 3.2 m; and for a ship laid up, packed or lying anywhere else, by any door at all. And on the Enhanced skins a
hold that did open was TAKE-ONLY: `cargoLootTarget` never said it was the player's own storage, so the window was the
pile's frame alone (MAC-M2 B's law for a body), with no pack beside it and no Store verb - SHIP-STORE
(`01-Overview/bugs/Field-Bugs-2026-09-26.md`) had given `storage: true` to the cabin's cupboards and the companions'
packs a day before Come Sail Away's cargo landed without it.

CHANGED:
- **Two-way** (`comeSailAwayItems.js cargoLootTarget`): `storage: true` - the Enhanced inventory opens the hold beside
  the pack with its Store verb, as the classic skin and the mod's own window always did; the box's own press is two-way
  too. A hold the door opens names itself on the window (`remoteModel`'s storage title): "Sea Wolf's hold", or "Ship's
  hold" for a ship with no name.
- **The hold's door** (`scenes/holdDoor.js createHoldDoor`, built once by the world host): THE SHIP AT HAND (`atHand`) -
  the one at whose helm I stand, the one whose deck I stand on (the sea fight's `boatInPlay`, else the deck's own
  bucket), the one whose cabin I am in (`modes.sailingCabin`); any ship of mine BY HER NUMBER (`openShip`) - afloat
  here or anywhere (her boat's hold), laid up (Come Sail Away's PackedCargoes under her number - `laidUpHold`, the very
  list her placing takes back aboard), or packed in the pack (the same list - her parts weigh her timbers alone, so
  nothing stowed or taken here weighs on them: PARTS-WEIGHT, `01-Overview/bugs/Field-Bugs-2026-10-18e.md`, retired the
  weighing as the window shut, which grew parts past what the bearer could lift; AUDIT 2: her parts stored in her own
  hold come back to the pack as it shuts). A Rowboat carries no hold of her own - the mod gives her no cargo
  box (`HULL_HOLDS`) - and is said so; AUDIT 2: unless the sea has put something aboard her (Come Sail Away gives every
  boat her Cargo, and a cask rowed through or a strand's salvage fills it), when hers opens as any hold does. The key
  passes over a Rowboat with nothing aboard, and over a ship with no door to her (not standing, her parts not in the
  pack, no title in the book).
- **Three ways in, every skin, every mode, in a fight too**: THE HOLD'S KEY (`ShipHold`, Come Sail Away's group,
  "Cargo", on F4 - the letters are spent and F1 and F3 are the browser's: `ui/input.js BROWSER_STEALS`) opens the ship at
  hand's hold, else the last whose helm I took (`frame` remembers it), else the first of my fleet with a hold, wherever
  she lies; THE HELM'S HOLD (`enhancedHelm.js helmButtons`, a hook button beside Orders on Enhanced Plus - the world
  host hands `cargo` for a hull with a hold); and THE FLEET PAGE'S HOLD (`fleetPage.js`, `fleetHost.js act('hold')`,
  every card of a ship with one), which hands the menu its door - the pause steps aside and the hold opens.
- Nothing about the cargo's law moves: its weight is still on her way whenever she sails (UpdateBoatCargoMod), the
  exchange still deals only from the hold of the boat at the quay, and the hold is the player's own save - online no
  one else's to see, so opening it from afar shares and spends nothing.

## RAID-ASHORE - the raid ends where it was fought (item 2)

THE REPORT, read: "your first boat (the one that is assigned to be your cabin if you press T > ship)" is the sailing ship
a bank ship's cabin is LINKED to (`systems/boatCabinOwnership.js`, `03-World/Come-Sail-Away.md` SAILING-CABINS): once
linked, Transport > Ship opens HER where she lies - and so does Warm Ashes' voyage ambush, whose boarding is that very
transport (`warmAshesShips.js transportToShip` -> world.js `shipTransportMode` -> `boardOrDisembark` ->
`enterLinkedBankCabin`). The raid is fought at her quay, by the land - "way better than being teleported to a ship a
mile away", as the owner says - its waves stood about the player on the open ground (world.js tryPlaceFoe; the naval
host places only the raids it started itself) or on the cabin's floor.

FOUND, by running the author's WAQ_SHIP_SMALLRAID through the port's real quest machine: once the boarders are down no
pirate spawns again. What keeps spawning is the raid's CREW. Every wave stands five `_ally_` Warriors with the
boarders, and `_callfriends_`, `_callfriends2_` and `_callfriends3_` call five more as five, ten and fifteen of them fall;
the `_setFoeInfight_` loop (`daily from 00:00 to 24:00`, re-armed by its own `clear`) sets their team back to the
player's on EVERY tick, so a crewman struck is an ally again a tick later and never fights back. Nothing in the script
removes `_ally_`; the quest ends only on its hour's clock (`_cooldown_`). On "Your Ship" - the sea's own region,
WA_SEA_REGION 31 - the IL's Leave Ship sails the player off the ship and its scene stays behind with the crew in it.
Ashore its other arm only completed the action: the player stayed beside five Warriors drawn and named as any foe, and
counted as enemies near, who never turned on them and came back five at a time as they were cut down - "they keep
spawning but passive" - for the rest of the hour.

CHANGED (DECLARED, Port-Ledger section A):
- **Leave Ship ashore** (`warmAshesShips.js LeaveShip.update`, the arm off region 31): the ship blocks back to `_base`
  (the IL resets them only at sea), the host's `raidAshore(quest)` withdraws the raid, and the quest ends as its own
  `end quest` ends one (`questBreak`, `endQuest` - the machine tombstones it after its two ticks of grace). Message 1014
  ("The attackers have been fought off") is the quest's own, said before. At sea the sea fight's gate answers (NAV-D) -
  and RAID-WON (2026-10-19, `01-Overview/bugs/Field-Bugs-2026-10-19.md`): a raid the sea fight WON ends the same way,
  through the naval host's win (`navalHost.js wonRaid` -> world.js endRaid's `won` -> `raidAshore.js won`): its living
  foes withdrawn, its `_ally_` among them, and its quest ended with `end quest`'s two ticks of grace (`endQuest`; AUDIT
  FB1019 D3: no break from outside a tick - the pirate attack's victory gong rides that grace), its uid the sea fight's
  until it ends (D1). It ran on, five Warriors on the deck counted as enemies near. Her ship gone from the sea under the
  fight, its crew goes home and her boarders fight on (`raidAshore.js crew`, D2).
- **The withdraw** (`scenes/raidAshore.js createRaidAshore`, built once by the world host before the quest bridge):
  every LIVING foe the quest stood (`questFoesOf`, the quest resource behaviour's UID - world.js endRaid's law) out of
  every pool it can stand in now - the street's (`exteriorFoes`) and, below deck, the room's (`modes.interiorPool()`) -
  the dead left lying to be looted. Its grace ticks can still place a wave a CreateFoe had in flight, so the quest's end
  (world.js `onQuestEnded`) sweeps again, for a raid ended ashore or won at sea, once; and a raid's wave that lands past
  both sweeps (its art or an online grant awaited) is withdrawn as it lands - on the deck, the open ground's ring and
  below deck (`raidAshore.js late`, a raid's foe alone; AUDIT FB1019 D1, D5).
- **One raid at a time on the fast travel too** (`onPreFastTravel`): the IL arms its ambush whatever runs, so a voyage by
  ship while a raid's quest ran started a second over the first. It answers 'busy' now, as `raidAtSea` and the sea
  fight's boarders already did (`raidRefusal`), the blocks left as the running raid set them.

Measured on the real machine (`test/systems/quest/raidashore.test.js`): each of the three outcomes - eight Rogues, eight
Barbarians, six Orcs and two sergeants - stands its five crew; won ashore, nothing of the raid stands, its dead lie
where they fell, the quest is tombstoned, and no crew is called in the hour it would have run. With the IL's arm alone
the same win leaves the five standing and the quest running, and five struck call five more.

Left as found: a transition while a wave is in flight (into the cabin and out) re-arms that wave - DFU's own CreateFoe
law (`onTransitionExterior`), the same for every quest; it is not this report.

## RAM-BOARD - ram her and board her (item 5)

RETIRED by BOARD-MAGNET (2026-10-26, below): the ram is gone, and the foul with it - this section is its record.

FOUND. Every way aboard another ship asked one thing: `state === struck` - her hull battered under STRUCK_AT (a quarter
of it) or every hand down. The helm's grapples (`navalHost.js boardingGap`), the rail on foot (`footReach`), the heave-to
beside her (`stepHeaveTo`) and the crews' muster toward her (`crewShips`, CREW-MUSTER's one law) each asked it, so the
only way to take a ship was to batter her first, and a ram - the stem put into her side at RAM_SPEED or more - was only
damage.

CHANGED (`systems/naval/navalFoul.js`, the law; the host wires it):
- **A ram fouls her** (`checkRams`): a ram that strikes home on a ship still afloat FOULS her for FOUL_S (20 s) - by me
  (`foul`, the rammer's id), renewed by a fresh ram - and says so ("Her bow is fouled in yours - board her before she
  breaks free!"). The ram's own law is as it was: its damage, its recoil, its act of fire (piracy on a lawful ship, a
  navy in sight provoked).
- **Boarded as she stands** (`boardableState`): every door that asked for struck asks for struck OR afloat and fouled BY
  ME - never one being boarded, a prize, or a ship going down. Her card reads "Fouled - E: board her" (or "heave to"
  coming up too fast - `navalHud.js cardState`; the card model says `fouled` only while it holds - `targetCardOf`). The
  boarding is the boarding there always was: grapples, the haul, her MUSTER over her crew's share - a sound ship's whole
  crew, MUSTER_MAX at most, her captain at their head (`navalBoarding.js musterOf`) - the fight, the prize and her fate.
  A ship fouled by another player is theirs to board.
- **Her way held** (`navalAI.js stepCaptain` -> `holdFouled`): while fouled her captain's helm runs as ever and then her
  way comes off at FOUL_DECEL to FOUL_WAY (1.2 m/s, under BOARD_SPEED - a boarding from her lee is never left behind)
  and her canvas comes in; her guns still answer - she has not struck.
- **Online** (AUDIT 2026-10-17): a ram on a ship another player stands says its FOUL to her stander with its blow
  (`navalWire.js navalHitData` `foul`, the hit's `u`: the seconds it holds her, FOUL_SAID_MAX at most), and her
  stander's AI holds her way (`navalFoul.js foulSaid`, fouled by the rammer) - the foul had been written in the rammer's
  copy alone, so her stander's word sailed her on out of the grapples' reach. A sound ship being boarded is said
  `afloat` on the room's word, her captain's mode `boarded` (`word`; `applyWord` reads either as boarded): no peer
  grapples her under the fight, and none reads her colours struck - said 'boarded' she was read struck, her colours down
  on every other screen and a win to any crew that had fired on her. The boarder adopts her at the grapple as ever.
- **Left**: a boarding of a sound ship given up past ABANDON_RANGE says "Her crew runs back to her guns" - she fights on.

The law, the muster, the haul and the prize are unchanged; the struck law stands for every ship not fouled.

## SHOT-KINDS - what the guns are loaded with (items 3 and 4)

FOUND. A gun was a bore and one load: navalShips.js GUNS gave each kind its muzzle speed, scatter, reload and its
harm to her hull, canvas and crew, and the load came with the bore - the broadsides, swivels and great guns threw round
shot and the Small Ship's and the Carrack's bow chasers chain (GUNS `chain` IS chain shot). The only choice a captain
had was where to look.

CHANGED (`systems/naval/shotKinds.js`, the law; the deck keeps it, the host and the captains read it):
- **Four loads** (`SHOT_ORDER`): ROUND SHOT (what every number of GUNS was tuned on), GRAPESHOT (slower, a cone 2.4
  times the scatter and a sweep 0.45 m wider - it meets what a ball would pass - a fifth of a ball's hole and FOUR times
  its men, close in: whole to GRAPE_FULL_S of flight, half by GRAPE_SPENT_S), CHAIN SHOT (a wider tumble, four times a
  ball's canvas, a fifth of its hole) and HEATED SHOT (a ball a little softer, slow to load - the furnace - that sets her
  alight 45% of hull hits where a cold ball's FIRE_CHANCE is 6%, and her canvas where it passes through her rig).
- **Every number is relative to the bore's own load** (`shotGun`): a gun loaded with its own load, or none said, IS its
  GUNS row - every captain's duels and odds stand as they were tuned; a chaser loaded with round shot throws a long gun's
  kind of ball (its chain's factors undone).
- **The load is the battery group's** (`navalGunnery.js LOAD_GROUPS`, `createGunDeck` `load`/`setLoad`): the two
  broadsides as one, the bow chasers, the stern guns - each its bores' own until changed (a group at its own load is
  said as none). A change draws a loaded battery and loads it again in SHOT_SWITCH (half) of the new load's reload; one
  reloading takes the new shot in, its clock scaled to the new load's. The fire barrels carry none. The save keeps the
  loads (navalHost.js `gunsRecord`, outside the host's own function: `loads` only when one is not her bores' own).
- **The aim and the volley are the load's** (`aimSolution` `shot`, `volleyLaunches`): laid with its muzzle speed (grape
  falls shorter and is laid higher), flown with its speed and scatter; the helm's look on a ship lays chain for her
  canvas whatever bore throws it (`lookOnShip`, `aimStrikes`).
- **The ball keeps it** (`navalShots.js`): swept with its load's radius, every event saying it, a hit its time aloft;
  the host strikes with the loaded gun (`captainTree.js struckGun` - grapeshot's men by its time aloft) and heated shot's fire.
- **The helm's choice** (`scenes/naval/navalLoads.js`): the group the guns are laid with, else the one the look bears on,
  else her first with guns. THE WHEEL while the guns are laid steps it on or back (one step a turn of it - again only
  after SHOT_WHEEL_S of quiet, on the real clock, so a trackpad's stream steps once; the camera's zoom waits); the helm panel's Shot button ("Broadsides: Grapeshot"); the
  ShotCycle key - appended to the actions, in Combat, unbound (the letters are spent; a mod's group would ship it a key,
  KB1 law 3) - and a pad button chosen for it. Each change is said: "Broadsides: Grapeshot - loading".
- **The HUD**: each battery's load under its count (the chasers named as the bore, "2 chasers", now chain is a load),
  coloured by load (hidden on a short screen); the aim's line names it ("Port broadside, grapeshot - 90 m").
- **The picture** (item 4): each load its own ball (`navalRender.js ballPictures` - grapeshot's ring of five small balls
  opening over its first 1.2 s, chain shot's two half-balls tumbling about each other with the chain between, heated
  shot red-hot in a glow trailing three fading glows), muzzle (grape's wider, lower smoke; heated shot's red flash),
  splash (grape's spatter of six small spouts over SPATTER_M; heated shot's hiss of steam), hull hit (grape's peppering;
  heated shot's embers) and canvas hit (chain tears twice the scraps and cracks a spar) - `navalEffects.js shotMuzzle`,
  `shotSplash`, `shotHit`, `shotTear`, the host's one door each.
- **The room** (`navalWire.js` `o`): a volley loaded with other than its bores' own says its load by SHOT_CODES, so
  every client flies the same balls and the victim's client judges the same blow; an older build's word says none - its
  bores' own.
- **The captains** (`navalAI.js captainLoads`): every captain fights her bores' own loads but a PIRATE who means to board,
  who loads her broadsides and chasers with GRAPE the moment she decides to (the guns drawn while she closes) - Black
  Flag's boarders sweep the deck they will take, and grape leaves the prize whole. Her chasers fire it as they bear, and
  the broadsides a boarder held fire it too (`boarderBroadsides`: round shot into a prize she means to take, never). She
  keeps it through the fight within GRAPE_KEEP of GRAPE_CLOSE_M and draws it once the fight is done or opened past
  that; her lay, lead and reach are her load's (`gunnery`, `batteryReach`). The dead zones (LAY_MIN) are sounded with
  the bores' own loads.

## COMBAT-FEEL - the fight at my rail (item 4)

FOUND (the gap survey of the sea fight, against Black Flag's picture the sea fight was built to): a broadside's smoke
DRAGGED TO STANDING STILL and was nudged by the wind at a third of Come Sail Away's wind STRENGTH - a number of 1 to 2,
not metres a second - so a fight's smoke hung where it was fired under half a metre a second and was gone in 4 to 8 s;
a ball's fall was a column the same size at 300 m as at 30 (only a hull hit's burst was grown for the eye far off); a
ball going by my rail was silent and one falling beside her threw nothing aboard; a hit on my own ship was a camera's
kick and her plate's bar sliding (the target's card read its loss, broke a piece off and flashed - mine did not), with no
word of where it came from; a ship going down afire only foamed; my own boat, battered, showed her fires and no smoke;
the target card read her hull and canvas, never her men - grape's whole point - and my volley's tally counted hits, holes
and rigging, never men; and a battery's seconds to load were said only for the side laid.

CHANGED:
- **SMOKE-WIND** (`systems/naval/navalEffects.js`): smoke's drag is toward the AIR's way - the wind at WIND_MPS (4 m/s) a
  unit of Come Sail Away's strength (a fair day's 1-2 a gentle to a moderate breeze, a storm's up to 16 m/s) - so a
  broadside's smoke leaves the muzzles along the shot, slows to the wind's speed and goes downwind as a bank, and a
  burning or battered hull's smoke leans away down the wind. A broadside's own smoke hangs GUN_SMOKE_LIFE (9-14 s) and
  swells to GUN_SMOKE_SWELL (6-10 m a unit of the gun's size); a hit's puff stays as it was. Nothing else rides the wind
  (a plank afloat drifts as the shot field's floaters do).
- **SPLASH-SPOUT**: a ball's fall throws a SPOUT out of its column's middle - a few drops nearly straight up at SPOUT_UP
  (a heavy ball's to about ten metres, a light one's five), the white post a fall of shot is read by at range; grape's bag
  of small balls throws its spatter and no spout. The whole splash grows for the eye far off as a hull hit's burst does
  (the host's `burstScale`, HIT_BURST_M): its drops larger, thrown higher, a few more of them, its ring wider.
- **NEAR-MISS** (`systems/naval/navalShots.js`): a ball going by a ship that HEARS it - a target marked `ear`, the
  player's own boats - within NEAR_MISS_M (8 m) of her hull's box, not striking her in that piece of its flight, is a
  'pass': once a ball a ship, told at its nearest (the gap's least along the piece, found by thirds - a box is convex).
  The host whistles it (`scenes/naval/navalFeel.js passed`): a new clip, `naval-whistle` (`tools/navalSfx.mjs`, the
  tenth: noise through a narrow band that FALLS as the ball passes - its Doppler - swelling to its nearest, a faint tone
  riding it), at the place it passed, louder the nearer, heard over NAVAL_SOUND_RANGE's 8 to 90 m. A ball of mine or of
  another player's never whistles at me: no fight between players at sea.
- **DRENCH** (`navalFeel.js splashed`): a ball falling into the sea within NEAR_SPLASH_M (6 m) of my boat's hull throws a
  sheet of its water over her rail (`effects.drench`, DRENCH_N drops toward her middle, half at the edge) and jars her
  (NEAR_SHAKE, harder alongside) - whoever's ball it was: the sea is the sea.
- **HULL-BLOW** (`navalFeel.js struck`, `ui/naval/navalHud.js`): a ball striking my boat is felt from a SIDE - her bow,
  her stern or a beam - read off the ball's way against her heading (`blowSide`): her plate's rose shows it for BLOW_S
  (1.4 s), that side of her little ship and its battery's frame red. Her own hull bar reads its loss as the card's does
  (`plateLoss`, ui/barLoss.js - the ghost where it was, a piece breaking off, the bar's flash).
- **MAGAZINE** (`navalFeel.js sinking`, `frame`): a ship going down while she burns may blow her magazine - MAGAZINE_CHANCE
  (0.55), decided by HER OWN SEED (`magazineOf`), so every player who sees her sees the same - once, 1.5 to 4.5 s into
  her going down, at her middle: a barrel's blast and its sound, and a jar for a boat of mine within MAGAZINE_SHAKE_M.
  A ship gone before it went up is forgotten. A ship another player stands is read going down off her stander's word
  (`applyWord`: her bubbles, her magazine by her seed and the word's fire - AUDIT 2026-10-17: only the screen whose blow
  sank her had heard her go or seen her powder go up).
- **FOUNDER-BOIL** (`effects.founder`): the air leaving a ship going down boils up where she is - small drops popping off
  the sea, BOIL_RATE (14) a second, each with its own little ring among her foam.
- **MY-SMOKE** (`navalFeel.js frame`): my own boat smokes along her deck as a sea ship does under SMOKE_FROM (0.6) of her
  hull - while a hostile ship is near her (`navalHost.js hostileNearBoat`: the fight's smoke, not a mooring's; asked of a
  boat under MY_SMOKE_FROM alone - AUDIT 2026-10-17: every boat of mine scanned the sea for it every frame).
- **CARD-CREW**: the target card reads her MEN (`crew`, a third bar under her canvas) once she is made out; my volley's
  tally counts the men it took (`scenes/naval/navalTally.js` `men` - her crew before and after each ball of it, or a
  peer's ship's as her stander will reckon them, shotMen) - "N of her men down", grape's work said. The tally is a
  module the host wires (AUDIT 2026-10-17, HOST-SPLIT: it had stood in createNavalHost).
- **RELOAD-SECS**: each battery says the whole seconds it still loads beside its load ("Grape 5s"); a loaded side and a
  barrel none (on a short screen the load's line is hidden, and the aim's line says it, as before).

DEPARTURE from nothing: Daggerfall has no sea, and Daggerfall Unity none; the screen's red damage flash (DFU's
ShowPlayerDamage) stays the player's own body's - a hit on her hull is her plate's, not the player's blood.

## SHIP-COLOURS - a flag of her captain's own, or the guild's arms (item 9)

FOUND. Come Sail Away's boats fly a PENNANT: her FlagObject's particle system streams small cubes downwind off her
masthead (the prefab's FlagEmitter; the mod aims the FlagObject down her wind, ComeSailAway.cs's flag rotation), drawn by
the world host's particle pass (`scenes/world.js csaParticleLists`, a sea ship's tinted her faction's - SEA-COLOURS gives
her cloth of her own). A captain could
neither choose it nor fly anything else; a guild's arms (`net/heraldryLaw.js`, GUILD1d/GUILD2c) flew on its hall's
banners alone.

CHANGED (`systems/naval/shipFlag.js`, the law; the art, the cloth and the host each a module of its own):
- **The flag** (`shipFlagOf`, its door): a SHAPE (flag, swallowtail, pennant, burgee), a FIELD of the heraldry's sixteen
  colours, divided or not by one of its eight divisions into a second colour, a BORDER of a colour or none, a DEVICE of
  the heraldry's forty or none and the colour it is painted in - a colour on neither part of the field. And FLY MY
  GUILD'S ARMS (`guild`): while the captain's guild has heraldry, the flag flies it - its field, division, border and
  device in its ink - in the flag's own shape, following the guild's arms when they change (`flownFlag`); a guild with
  none, or no guild, flies the flag's own colours.
- **Its designer** (the Fleet page's Colours, `ui/fleetPage.js coloursPanel`): the flag drawn as she will fly it (the
  guild's arms where they fly), and its choices - a stepper for the shape, the division and the device, a row of swatches
  for each colour (UI-CALM's selector) - each change made a flag at once (`fitFlag`: a choice that clashes with one made
  before it put right); Hoist (her record's `colours`, `systems/fleet.js setShipColours`, kept in the save with her),
  Strike (the mod's pennant again), Close. Every hull with a masthead (a Rowboat has none).
- **Its art** (`ui/flagArt.js`): the guild banner's own hand (`ui/heraldryArt.js` - its divisions, its device painter and
  each hole's two colours, now shared), on a 150 x 100 cloth: an SVG for the designer and a canvas for the cloth's
  texture - one picture.
- **The cloth** (`render/shipFlagPass.js`): FLAG_COLS by FLAG_ROWS quads, the hoist nailed at her FlagObject and the fly
  down its forward (her wind); a wave runs from the hoist to the fly, its throw growing to the free edge and with the
  wind; in a light air the sheet bends down toward the staff as a whole (an arc of its own length, FLAG_SLACK_BEND at a
  dead calm); its normal the wave's slope, so the folds catch the sun; lit and fogged as the banners are. Her hull's size
  (`flagSizeOf`: a Large Boat's 1.2 x 0.8 m to a Carrack's 3 x 2). Drawn after the banners on the weather's own wind.
- **Her pennant** (`scenes/shipFlagHost.js`, the world host's `csaParticleLists`): a boat flying a flag of cloth draws no
  cubes - where the cloth is drawn (the exterior's pass); on a dungeon's water she flies her pennant.
- **Every player sees it** (`comeSailAwayWire.js` `f`): a flag's seven numbers beside each boat of the owner's word (0
  her pennant), only while one flies a flag - the colours FLOWN (a guild's arms as their colours); a reader takes each
  through the flag's door (`flagOfCode`), one it refuses her pennant, never the boats dropped; an older build ignores it.
  The peers' boats fly it (`comeSailAwayPeers.js flagged`).

## CAPTAIN-TREE - the captain's stars (item 10)

FOUND. A captain's deeds at sea were written in the captain's log (`systems/naval/captainLedger.js newLog`: ships sunk and
taken by their trade, boarders thrown back, prizes, contracts, leagues, charts, isles) and read back as words on the
Captain page alone; the crowns' ranks (CAPT-LOG) were a standing with each crown, not a captain's own growth. Nothing a
captain learned at sea bettered a ship, and the ship's own numbers - her way, her helm, her guns - were her build's,
her refits' and her crew's posts' (CAPT-CREW) alone. The Firmament (`06-Systems/Firmament.md`) is a character's sky,
bought with Renown, online.

CHANGED (`systems/naval/captainTree.js`, the law; pure):
- **The level** is never stored: read off the log as it stands (`captainXpOf` - CAPTAIN_XP's weight a deed: a pirate
  sunk 40 and taken 60, a navy's 50 and 75, an Eltheric ship's 60 and 90, a legend's 300 and 400, a merchantman's 25 and
  40; a boarding thrown back 30, a prize claimed 20, a contract 50, a league 12, a chart raised 40, an isle charted 25, a
  band deeper 15, and an XP for every TRADED_GOLD (40) sold at the exchange - a merchant captain rises too), up
  100 x (L - 1)^1.6 (`xpForLevel`: level 2 at 100, 10 at 3,363, 20 at 11,117, 30 at 21,869) to CAPTAIN_LEVEL_MAX (30).
  A point a level past the first (`starPoints`: 29 at the top). The log is the save's, so the level follows the character.
- **The sky** (`CAPTAIN_STARS`, 38 stars, `CAPTAIN_EDGES`): the Firmament's shape made a sky of its own - THE HELM in the
  middle, held by every captain; THE MASTER's four paths to the left (her canvas to Master of the Wind; her oars and helm
  to Quick in Stays; her hold and trade to Merchant Prince; her shipwright's care to Ironsides), THE COMMANDER's four to
  the right (the guns' drill to Ship of the Line; their aim to Long Shot; the shot locker forking to Canister and Grape,
  Bar and Chain, and past grape the Hot Shot Furnace; the boarders and the ram to Boarders Away). Small stars run to a
  notable and on to a keystone that gives much and costs a little (Master of the Wind: +12% way under sail, -12% under
  oars). Neighbouring paths' notables are joined across (`CAPTAIN_CROSS`). 37 stars past the Helm and 29 points at the
  top: a captain chooses.
- **Holding stars** (`heldStars`, the door every sky comes in by): the Helm, known stars once each, each joined to the Helm
  through held stars, no more than the points - in an order a captain could have set them, whatever order asked (a fixed
  point: a sky with a star taken out of its middle keeps every star still joined round another way). A star is taken
  beside one held with a point left (`takeable`); the way to one further is its shortest (`wayTo`); a star given back
  takes with it every star joined to the Helm only through it (`takesBack`). Giving back is FREE, at any time - a
  captain's sky is relearned on the deck. DEPARTURE from the Firmament: no silver or gold, nothing online - the sky is the
  character's save's (`captainLedger.js` `tree`), so it stands offline as the sea does.
- **What the stars do** (`starStats`, CAPTAIN_STATS - each a share) is read WHERE THE SHIP'S OWN NUMBER IS READ, never
  written into her record, a peer's or the sea's ships reading none:
  - her refits (`scenes/fleetHost.js refit`, Come Sail Away's and the sea fight's one seam; a ship of mine's alone - a
    number the Fleet does not know reads her build's own): `cargo` her hold, `way` her way under sail and its coming on,
    `hull` her hull and canvas, `harm` her balls' harm, and `oars` and `turn` besides (`captainRefit`) - Come Sail Away
    reads them where it reads her Rigging (`comeSailAway.js rigOf(b, key)`: `oarSpeed`, and `turnSpeed` under oars and
    under sail);
  - her crew's worth (`captainWorth` over `shipCrew.js crewWorth`, the sea fight's `crewStep`): `reload` off the guns'
    reload (never under RELOAD_LEAST, a half), `repair` on her hands' mending, `boarders` more hands over the rail (the
    First Mate's seam, `myHands` - as many as her crew has men for, CAPT-CREW's own cap);
  - her guns' aim (`crewSkill` times `aim`, to 1 at the most);
  - the shot locker (`captainShot`, a ball of mine in `struckGun`): `grape` grapeshot's men, `chain` chain shot's canvas
    (a bow chaser's own chain too), `heated` heated shot's chance of fire (`shotFireChance`'s `k`, to FIRE_MOST, 0.9);
  - her ram (`checkRams`): `ram` its harm, `foul` seconds more she holds a ship fouled (`navalFoul.js foul`'s `more`) -
    BOARD-MAGNET (2026-10-26) retired both with the ram: the two stars reach farther instead (`reach`, below);
  - the exchange (`harbourOffice.js`, `tradeGoods.js exchangeOf`'s `edge`): `trade` the share of the SPREAD her dealing
    closes, to TRADE_MOST (0.75) - each price nearer the good's middle, the exchange still buying under what it sells.
- **The window** (`ui/captainTreeWindow.js` - the captain's sky as a descriptor; since RVN-STARS, 2026-10-17, drawn by the
  one sky window, `ui/skyWindow.js`, the sworn revenant's stars beside it: `06-Systems/Revenants.md` section 44), in the Firmament's own dress (`ui/firmamentWindow.js` - its sheet, its two
  palettes, its stars' sizes): the sky over the whole screen, the Master in the life ring's verdigris and the Commander in
  the battle ring's brass, the Helm drawn as a ship's wheel; a star hovered reads its name, its half and kind, its stats
  and what a press would do; pressed, the whole way to it is set while the points pay (refused, it says why); right-pressed
  (or held), it is taken back with those joined only through it; Accept gives the ledger the sky (`setTree`, through the
  law again) and tells the save. Every change is pending until then, and a close with one unaccepted asks once. Names are
  laid out where they cover no star and no other name. Opened from the Captain page's card through the sea's window door
  (`createCaptainStarsOverlay`, the pause put down first as the Fleet's doors do) - since GROWTH3 (2026-10-17, the owner:
  "instead of having ascend in one place and the firmament trees in another (including the new naval tree)"; `10-UI/Growth.md`
  section 6) the card's press opens the pause window's Growth tab on its Captain's Stars page, the sky drawn in the pane
  (its `embed` mode); a menu with no Growth tab still opens it over the world.
- **The Captain page** (`ui/captainPage.js`): a card above the crowns - her level, a meter of her XP from this level's
  floor to the next's, the stars set of her points, what the two halves better, and the door.

## REFIT-ORES - the metals past the shipwright's third refit (item 11)

FOUND. Four refit lines (Hold, Rigging, Hull, Guns), three tiers each, of timber, iron and pitch - every ship at her last
tier within a few voyages, and nothing a captain's growth or the world's ores could add. DFU's material ladder (Iron,
Steel, Silver, Elven, Dwarven, Mithril, Adamantium, Ebony, Orcish, Daedric - ItemEnums' WeaponMaterialTypes, plate's
ArmorMaterialTypes over it) and the forges' ingots (`net/professionLaw.js`, 620-630) stood beside it unused.

CHANGED (`systems/fleet.js`):
- **Nine tiers of metal** past the shipwright's three (`ORE_TIERS`; UPGRADE_TIERS 12, REFIT_NUMERALS to XII): Steel at a
  captain's level 3, Silver 5, Elven 8, Dwarven 11, Mithril 14, Adamantium 17, Ebony 20, Orcish 24, Daedric 28 - a
  captain's level is CAPTAIN-TREE's, earned at sea. A tier costs a Small Ship 6,000 to 70,000 gold and 4 to 8 of its
  metal, with her line's first store (timber, or a gun's iron) at the third tier's count, all times her hull's share. A
  metal tier betters her by ORE_PER (a half) of a shipwright's (`refitShare`): a Hold at XII carries 1 + 0.6 + 0.9 of
  her build's load.
- **A metal is its ingots, or a piece melted down** (`MATERIALS`' metals, `refitMetalOf`, `meltable`): the forge's ingot of it
  (Moonstone for Elven, Orichalcum for Orcish; the Warforged Steel ingot counts as Ebony), or a weapon or a piece of plate
  of that metal (an arrow, chain and leather never) - A PLAIN PIECE ALONE, because the refit takes it unasked: never one
  worn, locked, bound, a quest's, an artifact, a sigil's or a player's make (`provenance`); never enchanted, DFU's way or
  the item maker's (`customEnchantments`); never graded past Common (a rolled tier, its affixes, a Legendary's record,
  DFU's magic mark - `lootRarity.js rarityEligible`'s list) nor socketed (AUDIT 2026-10-17: a Legendary, a made piece or
  one with the maker's enchantments was melted). The shipwright takes every ingot first, in the pack and her hold, and only then melts a piece (`takeMaterials`); the refit
  says how many pieces it would melt (`meltCount`).
- **One store serves once** (`materialsFor`): a steel ingot is Steel and Iron both (the Iron store's own law), so a
  refit's stores are tried together on copies before anything is taken - a Guns tier of Steel no longer reads affordable
  on the same ingots twice, and never takes half its stores.
- **The refit's offer** (`scenes/fleetHost.js offer`): each row its share now and next, the level its next asks and
  whether her captain's is short (`locked` - refused pressed: *"The shipwright will not work Steel for a captain under
  level 3."*), each store's count held and melted; the Fleet page's refit panel and the shipyard's Refits tab say the same
  words (`ui/fleetPage.js refitRowWords`) - the line at its numeral, +now% and +next%, the stores with what the player
  holds, the pieces melted, the level asked - and the page says the captain's level once above them.

## SHIP-LIVERY - her paint (item 8, her outside)

FOUND. Every ship of a hull wore the same pictures. The port's three ships (the Large Boat, the Small Ship, the Carrack -
`world/ships/galleonArt.js`, `carrackArt.js`, `largeBoatArt.js`, PORT_SHIPS) are painted by the port's own painters
from a palette (the galleon's oxblood strake and gilt, the carrack's Bay blue and ochre, the large boat's sea green and
ochre, the fleet's one canvas) under their pseudo-archives; Come Sail Away's own hulls (the Rowboat, the Large Galley,
and a port hull's small things) wear Daggerfall's planks (TEXTURE.067) and its sailcloth (TEXTURE.050 record 7) as the
mod's ApplyGameTextures gives them. A captain could change nothing of it; the wagons' paint (WAGONS2, `systems/
wagonLooks.js`, drawn by `scenes/horseCartPool.js lookRemap`) was the port's one paint shop. Daggerfall Unity has no
ships to paint.

CHANGED (`systems/naval/shipLivery.js`, the law and the painter; pure):
- **A livery** (`liveryOf`, its door): four parts, each one of SHIP_PAINTS' fourteen - Oxblood, Crimson, Tar black, Navy, Bay
  blue, Teal, Sea green, Forest green, Ochre, Gold leaf, White lead, Slate grey, Tyrian purple, Tan, Daggerfall's own
  earths and dyes - or none (0, as built). Which a hull takes (`liveryPartsOf`): a port-built hull her STRAKE (her
  painted strakes, castles, galleries and lids), her ACCENT (their trim and gilding) and her SAIL; the Large Galley a
  STAIN (her planks) and her sail; the Rowboat a stain alone. A part her hull does not take is none; a field that is no
  paint refuses the whole livery, as the flag's door does.
- **A port ship repainted by her families** (`world/ships/shipLiveryArt.js liveryArtOf`, `paintFamilies`): each texel of
  her PAINTED pictures (her sides, castles, galleries, transoms, houses, rails, roof, lids, trim, gilt and doors -
  never her deck, spars, rigging, iron or bottom) read as the palette colour nearest it, and one of the strake's or the
  accent's family takes that part's paint at its own lightness against the family's base - her seams, her grain and her
  light kept, her oak, tar, wales and glass as built. Her canvas is shaded whole (`shadeCloth`: every texel the paint at
  its lightness against the cloth's own), its seams and dirt kept. Each picture then takes Daggerfall's look as her
  stand-ins do (`world/dfLook.js`, its own record's grain). A see-through picture is painted twice - by day its glass cut
  out, at night whole with its glow (the pool's own NIGHT_REMAP law) - so a painted gallery is see-through by day and
  lit at night.
- **A classic hull stained and tinted** (`stainPicture`, `tintPicture`): every plank record of TEXTURE.067 takes the
  stain at its lightness against the picture's mean, laid over the wood at STAIN_STRENGTH (0.62) - the plank still
  reads as a plank; her sailcloth the sail's paint at SAIL_TINT (0.85).
- **The paint shop** (`scenes/comeSailAway/shipLiveryPaint.js`): a livery's pictures painted and uploaded under
  LIVERY_ARCHIVE (38191, registered in `world/eliteGates/pseudoArchives.js`) the first time a hull wears it, and the remap she is drawn by - her paint's keys over the host's
  (the night's twins already in it while the lanterns are lit), one Map a pair so the renderer's cache holds. A boat
  whose paint is still being made is drawn as built; one whose paint failed is drawn as built for good and said once.
- **Drawn wherever she is drawn** (`comeSailAwayPool.js draw`, `liveryCodeOf`): the one draw every host's boats go
  through, so a painted ship is painted on the street, on a dungeon's water and in a peer's sight alike - mine by my
  Fleet ledger's record, a peer's by her owner's word, a sea ship by who she is (SEA-COLOURS, below). AUDIT 2: her paint
  is handed only to the meshes it repaints (`shipLiveryPaint.js remapFor`) - Daggerfall's models are shared by every boat
  that hangs them, and the renderer keeps each one's pictures by its remap.
- **Her captain chooses** (the Fleet page's Paint, `ui/fleetPage.js paintPanel`): her picture in the paint chosen
  (`paintSvg`), a row of swatches for each part her hull takes and, where she has a cabin, her cabin's wood
  (CABIN-LOOK); Paint her (`scenes/fleetHost.js livery` - her record's `livery`, `systems/fleet.js setShipLivery`,
  through the door with her hull, kept in the save), Strip her paint (as built), Close. The shipwright paints her
  wherever she lies, for nothing. A paint refused is refused whole: her hull's and her cabin's are read before either
  is set.
- **Every player sees it** (`comeSailAwayWire.js` `l`): a livery's one number beside each boat of the owner's word (four
  nibbles, `liveryCode`; 0 as built), only while one is painted; a reader takes each through the door (`liveryOfCode`),
  one it refuses as built, never the boats dropped; an older build ignores it. The peers' boats wear it
  (`comeSailAwayPeers.js`, at build and on every word).

## CABIN-LOOK - her cabin's wood (item 8, her inside)

FOUND. A ship's cabin below (SAILING-CABINS, `scenes/sailingCabin.js`) is the bank ship's interior (WA_SHIP_BLOCKS, a
Small or a Large), built by the interior builder (`scenes/interiorContext.js`) under the climate's texture swaps (DFU's
ClimateSwaps, as every interior's). Every cabin of a size was the same wood. INSIDE was enabled already for the rest:
the decorator furnishes her cabin as it does a house (DECOR1, `scenes/worldModes.js decorRoomHere`'s `ship`).

CHANGED (`scenes/cabinLook.js`):
- **The room's restyle** (`interiorContext.js`'s `restyle`, asked after the climate's remap and before the room's batch
  is made): each picture the room's models wear, its key as the climate resolves it, given a stained twin under
  CABIN_ARCHIVE (38192, registered beside it) - `tintPicture` at CABIN_STAIN (0.55), Daggerfall's look over it - and set in the room's remap in
  its place, once each. Her walls, floor, beams and built furniture are one wood, its grain kept. A picture that is
  glass (a window's mask, the renderer's own) is left as built, so her windows light as they did.
- **Her record's** (`systems/fleet.js` `cabin`, `setShipCabin`): one of the fourteen paints or none, chosen in the Paint
  panel beside her hull's paint and set by the same act (`scenes/fleetHost.js livery`, a hull without a cabin asked
  none); the visit below (`sailingCabin.js`) hands the room her stain, so it is made the next time her captain goes
  below.

## DECK-PROPS - fittings on her deck (item 8, prop placement)

FOUND. On her open deck nothing could stand: Come Sail Away's hulls carry the mod's own fittings alone (its ModelHelpers
- classic models hung in the prefab, SetupModelHelper's alignment), and the port's decorator places in rooms (DECOR1),
never on a boat in the world.

CHANGED (`systems/naval/deckFittings.js`, the law; pure):
- **A fitting** is `{ m, x, z, yaw }`: one of the classic models Daggerfall stands in its houses as containers
  (DECK_FITTINGS - World Tooltips' Crate group, 41815-41834, and its Chest group, 41811-41813, `systems/
  worldTooltips.js CONTAINER_NAME_GROUPS`), at a place of her deck in her MeshObject's frame (metres, to the decimetre)
  and turned a sixteenth of a turn at a step (YAW_STEPS). Its door (`fittingsOf`) keeps only known models at finite
  places within FITTING_REACH (40 m) of her middle, none nearer one before it than FITTING_GAP (0.6 m), at most
  DECK_FITTINGS_MAX (24).
- **Stood in her own tree** (`scenes/comeSailAway/deckFittingsHost.js standFittings`): under one node of hers,
  DECK_FITTINGS_NODE, under her MeshObject - the frame her deck is baked in (`systems/naval/navalDeck.js`) and the one
  the swell rolls - each fitting a classic model hung as the mod's ModelHelpers hang theirs (`comeSailAwayBoat.js
  createDaggerfallMeshGameObject`: a MeshRenderer and a MeshCollider over it), its foot on her deck's own height under
  its place and its middle over the place (the model's box, SetupModelHelper's centring), turned about up. So it is
  drawn with her (the pool's draw reads her tree), stands in her colliders (one walks round a crate and climbs onto a
  chest; the world's collider and the aboard ray read her tree's), and rocks and sails with her. A fitting whose place is
  no deck of hers (her deck baked otherwise since it was set) stands nowhere; one whose model is not loaded yet waits,
  its model asked of the pipeline once, and the boat is fitted again when it is.
- **The fitting-out** (`fitBoats`, a frame, `comeSailAwayPool.js frame`): each boat whose fittings are not the ones she
  stands with is fitted again - mine by my Fleet ledger's record, a peer's by her owner's word - and marked by her
  list's key (`fittingsKey`), so a frame does nothing while nothing changed; her deck is baked only for a boat that has
  fittings.
- **The plan of her deck** (`ui/deckPlanWindow.js`, from the Fleet page's Deck through `scenes/deckPlanDoor.js` and the
  sea's window door): her open deck seen from above - bow up, or laid bow to the right where that draws her larger (a
  long hull on a wide screen) - each cell by its height (her pool's baked deck, `comeSailAwayPool.js deckOf`), her
  fittings on it as their models' boxes, each turned as it will stand (a step clockwise from above, her bow toward
  starboard, as `quatAngleAxis` turns it); the fittings named as the decorator names the same pieces (Crate 1-20,
  Chest 1-3, in id order); a fitting chosen from the list and set with
  a click - refused off her deck, too near another or past the most, with why - one clicked taken up, dragged, turned
  (Q and E) and taken away (Delete); Clear her deck; Fit her out (`scenes/fleetHost.js deck` - her record's `deck`,
  `systems/fleet.js setShipFittings` through the door, kept in the save); Close leaves her as she was. A ship whose deck
  is not known yet (never stood in the world this session) says so.
- **Every player sees them** (`comeSailAwayWire.js` `d`): her fittings as four numbers each beside each boat of the
  owner's word (the model's place in DECK_FITTINGS, x and z in decimetres, its turn), only while one is fitted; a reader
  takes each list through the door (`fittingsOfCode`), one it refuses read as none; the peers' boats stand them.

## AUDIT - the refit audited (2026-10-17)

The owner, the same day: *"Lets do a comprehensive audit and ensure perfection."* A review of the whole refit at its
greatest reach found nineteen things; each was traced to a real caller before it was fixed, and each is fixed:

- **A Legendary melted for its steel** (REFIT-ORES `meltable`): the refit melts unasked, and its guard knew a worn piece,
  a quest's, an artifact, a sigil's and DFU's enchantments alone - a rolled tier, its affixes, a Legendary's record, the
  item maker's enchantments, a locked, bound or made piece and a socketed one all went to the furnace. A plain piece
  alone now (REFIT-ORES above).
- **A reload for a star** (CAPTAIN-TREE `restat` over HOLDINGS' `refitBoat`): a sky accepted mid-fight built her sea
  state again - every battery loaded at once, the brace let go, her last blow forgotten (her mending's quiet) - as often
  as the player liked. A refit now sets her hull and canvas on her new whole and touches nothing else
  (`navalDamage.js rewhole`).
- **A magazine one screen saw** (COMBAT-FEEL): a ship another player stood went down silent on mine; read off her
  stander's word now (MAGAZINE above).
- **A sound ship read struck** (RAM-BOARD): said `boarded`, she was read struck - her colours down on every other
  screen, a win to a crew that had fired on her; said afloat now, her mode `boarded` (RAM-BOARD Online above).
- **A foul in one copy** (RAM-BOARD): a ship another stood was fouled in the rammer's copy alone and sailed on by her
  stander's word; the foul rides the ram's blow now (RAM-BOARD Online above).
- **A tree made every frame** (DECK-PROPS `fitBoats`): while a fitting's model was not loaded her fittings' node was
  made again every frame - for ever, for a model that never loads. Made again only as one more comes in now.
- **A helm change read as a bite** (COMBAT-FEEL HULL-BLOW): the plate's bar kept one readout whoever's boat was behind
  it; it is the boat's now (her number on the plate, `navalHud.js barLoss` - the card's law and the plate's one
  function).
- **"Her hold is opened" when it was not** (CARGO-ANYWHERE, DECK-PROPS): a door that would not open left its card's word
  that it had (`fleetPage.js`); a refusal leaves none.
- **A canvas painted every frame** (SHIP-COLOURS): a flag that would not paint was painted again every frame; it is
  remembered, and asked again FLAG_REPAINT_S (5 s) on (`shipFlagPass.js textureOf`). A frame with no flags to draw
  prunes the idle textures too.
- **The aim cut by the smoke** (SHOT-KINDS, `navalRender.js draw`): a grape, chain or heated ball lays five quads, and a
  busy fight's balls and smoke could fill NAVAL_MAX_QUADS before the aim's zone, posts, strikes and arcs were laid. The
  aim's room is kept first; the effects take the rest, the farthest blended ones let go first.
- **Work every frame for nothing**: MY-SMOKE asked every boat of mine whether a hostile was near (a scan of the sea) -
  a boat under MY_SMOKE_FROM alone now; NEAR-MISS searched every ball's every piece of flight against every boat of
  mine - past her bounding sphere and NEAR_MISS_M only now (`navalShots.js`); PEACE-WAY's answer walked every foe, guard
  and ship several times a frame - held a PEACE_HOLD_S (0.1 s) now (`peaceWay.js heldPeaceWay`); the pool made its
  fitting-out's context every frame and keyed every boat's fittings and paint every draw - one context now, a list keyed
  only when it is another, a paint's code read again only when her record is another, the painted maps found by number
  (`comeSailAwayPool.js`, `deckFittingsHost.js`, `shipLiveryPaint.js`).
- **The hosts do not grow** (HOST-SPLIT): the struck gun (`captainTree.js struckGun`), my volley's tally
  (`scenes/naval/navalTally.js`, CARD-CREW's men with it) and the guns' save record (`gunsRecord`, beside `savedRecord`)
  are out of createNavalHost; the host wires them.
- **One law, written once**: the card's hull bar and the plate's were one law in two copies (`barLoss`); a classic
  record read for its picture was two copies too, the paint shop's without the cabin's guard on the record
  (`derivedTexture.js classicPictureOf`, both painters' one read); the paint shop's empty sentinel was dead
  (`shipLiveryPaint.js`).
- **The merge**: main moved under the branch (LOOT-BULK, HIEROPHANT-TIER); merged, its four doc conflicts kept both
  sides' lines and counts.

## SHIP-PLAQUE - her name on her bows (item 12)

FOUND. A ship's name (HOLDINGS' rename, `fleet.js renameShip`) was told in words alone - the Fleet's pages, the holdings,
the boats' word (`n`) read back for a hover - and never on the ship herself: alongside her, a stranger could not read it.

- **Her captain's choice** (`fleet.js setShipPlaque`, kept on her record and in the save): a named ship's alone - an
  unnamed one has none to show (the Fleet's act and page say so: *Name her first*), and a name taken off takes her board
  with it (`renameShip`), as a save that says one for an unnamed ship is never believed. Free, wherever she lies.
- **The board** (`scenes/comeSailAway/shipPlaque.js paintPlaque`): her name cut in gilt in Daggerfall's own lettering -
  FONT0003, the shops' face, read through `formats/fntFile.js` (its glyphs from ASCII 33, a space the fixed width less
  one, a pixel between glyphs, DaggerfallFont's own) - on dark planed wood in a raised, bevelled frame, PLAQUE_SCALE (3)
  texels a font pixel, the cut's shadow down and aft. Where FONT0003 is not to be had (no ARENA2 FONT file) her name is
  cut in the port's block letters (five by seven, a small letter its capital) and the pool says so once.
- **Laid on her planking, not hung in the air**: each hull's bows are read where they are DRAWN - the pool's `hullSurface`,
  her still meshes in her MeshObject's frame (her colliders, the deck's, stand a hull's walls too coarsely) - by rays cast
  in from her side. HER PLANKING is the mesh most rays into her lower bows meet first (never a gunport's lid, a cathead, a
  shroud stood off her or a bulkhead behind her); HER RAIL the highest her planking stands at a station, found to a
  quarter of a letter; the board's run starts aft of the stem's sharp turn, where her bow is PLAQUE_BREADTH (0.45) of her
  half-breadth out, and never runs aft of PLAQUE_AFT_SHARE (0.55) of her length; its top a tenth of a letter under the
  lowest rail along its run. It is a grid of those hits, stood PLAQUE_STANDOFF (3 cm) proud of her along each one's
  normal (a side wound either way faces out), so it follows a flaring bow - every port ship's and the mod's own
  fallbacks. Her letters are PLAQUE_LETTER (1.2%) of her length, 0.22 to 0.6 m; a name too long for her bow is cut
  smaller to fit, never stretched.
- **Her stern would not serve**: a port ship's is a rounded V (a flat board would stand 0.6 m off it at its ends) and the
  Large Boat's rudder stands in its middle - so her name is on each bow, as a ship's often is.
- **Read the right way from alongside**: the world is drawn left-handed (`render/cardTableDraw.js`'s note), so seen from
  her starboard her bow is to the right and that board runs aft to bow; the port board bow to aft. Each triangle is
  counter-clockwise about her outward side, the renderer's front, as every model's; its picture goes up bottom row first
  (`formats/color32Order.js`), so its top row is along her top edge.
- **Drawn with her** by the boats' one pool in her MeshObject's frame (her heel and pitch with it), in her dissolve, under
  a pseudo-archive of its own (PLAQUE_ARCHIVE, 38193, `world/eliteGates/pseudoArchives.js`): each hull's planking and bow
  stations read once a session, each name's picture painted once whatever hull shows it, a board's two meshes made once a
  hull and a name, and let go once not drawn for PLAQUE_IDLE_DRAWS (1800) - its picture with it once no board shows that
  name.
- **Seen by every player**: the boats' word says `p` (1: her name shown - a named boat's) only while one of mine shows it,
  and a peer reads it back to her name (`plaqueName`); a list not one a boat is never believed, and never a reason to drop
  the word. A sea ship shows none: her name is told by the target card (NAV-F).

DEPARTURE from nothing: Daggerfall has no sea, nor Daggerfall Unity; Come Sail Away's boats carry no name.

## SEA-COLOURS - the sea's ships in their own colours (item 13)

FOUND. A ship of the sea sailed as built (the pool's paint read a sea boat as none, `comeSailAwayPool.js liveryCodeOf`)
under the mod's pennant of cubes tinted by her faction alone (`navalHost.js buildOne`'s `flagColor`, NAVAL_FACTIONS'
`flag`): every pirate one black, every merchantman one gold, every navy one red - whatever crown she served or house she
sailed for. Her colours were said in words alone (`shipKnowledge.js coloursWords`: "Wayrest's royal ensign").

- **Who she is decides it** (`systems/naval/seaColours.js`, pure): her class (its faction and hull), her seed, the crown
  her flag says (`navalShips.js flagOf`: a navy's own, a merchantman's home port's or another's; the Isles' past the Veil),
  her legend's id, and the crown she passes for under false colours (`shipKnowledge.js falseFlagOf`, the host's
  `falseFlagFor`). Every client stands her off the naval word's class and seed, so every player sees the same ship and
  NOTHING NEW RIDES THE WIRE.
- **A navy** wears her crown's livery under white canvas and flies its royal ensign (CROWN_COLOURS): Daggerfall's azure
  and dagger, Wayrest's crimson and rose, Sentinel's gold and sun - the crowns' own metals (`net/townSeatLaw.js
  KINGDOM_BANNER_COLOURS`) and the charges the Bay's crowns are told by (the card table's suits, `render/cardFaces.js`).
- **A merchantman** is of one of eight MERCHANT_HOUSES, off her seed on its own stream (HOUSE_SALT): its house paint,
  and her crown's merchant colours - the crown's field parted with the house's colour, the house's device on it, a
  swallowtail. Past the Veil, the Isles' teal.
- **A pirate** is of one of six PIRATE_CREWS (CREW_SALT): its dark paint and its black flag - a skull, crossed blades, a
  serpent, a dagger, a bat. ONE UNDER FALSE COLOURS is painted as the merchant house she passes for, so her hull gives her
  away no sooner than her flag, and flies that house's colours in the crown she pretends until the black flag goes up
  (the host's `e.colours` 'false' to 'hers', as her pennant always turned).
- **A legend** wears and flies her own (LEGEND_COLOURS), whatever her class's faction: Sorrow's Wake's raven on ash, the
  Drowned Queen's crown on teal over sea-green planking, the Ninefold Hunger's wolf, the Lantern-Eater's flame on a black
  pennant, the Pale Regent's crown on purple, the Starless all black.
- **Her paint** is SHIP-LIVERY's, set on her boat as her hull is built (`buildOne`: `boat.livery`, the code a peer's word
  carries) and drawn by the pool as a peer's is - painted by the hull's own parts (`liveryOf(raw, hull)`: a galley takes
  her stain and canvas). The houses and crews are few by design: each pair of hull and paint is painted once a session
  (`shipLiveryPaint.js`), so the sea's variety costs a bounded set of pictures.
- **Her flag** is SHIP-COLOURS' cloth at her masthead (`seaFlagOf`): her own while her colours fly, the house's under
  false colours, none once struck, sinking or gone down; a prize flies her captor's pennant as before. The naval host
  says the frame's (`seaFlags`: within SEA_FLAG_M, 450 m - past it the cloth is a speck - the nearest first) and the flag
  host takes them after the players' own to the pass's cap (FLAGS_MAX, raised to 24), each waving on her seed's phase; a
  ship past the cap or the reach flies her pennant of cubes as before.

DEPARTURE from nothing: Daggerfall has no sea, nor Daggerfall Unity. The mod's pennant stays for a ship whose cloth is not
drawn (a dungeon's water, past the reach).

## TIME-DILATION - the sea's AI never on the Overworld's clock (14)

FOUND (the owner's report, *"AI can actually use the overworld as time dilation"*, traced with the real modules). The
Overworld's journeys and its keys run the world's clock at a time scale - x60 off the road, x100 on it (RATE-LAW,
`systems/timeScale.js`) - and the sea fight is stepped on that clock (`world.js navalFrame`: `dt * worldTimeScale()`,
AUDIT NAV1's "the sea keeps the world's time"). Land foes are not: they run at their own pace (TO1's departure, the foes'
`foeDt`), so on land the clock is the traveller's alone. At sea it was the AI's too:

- **A won avoid roll carried a journey past a pirate at x5 to x60.** A cautious traveller's journey stops at a hostile
  ship's HOSTILE_NEAR_M (700 m, NAV-H's enemy nearby) and rolls to slip by; a won roll passes encounters for fifteen
  seconds (TravelOptionsMod.cs AttemptAvoidEncounter), and the governor eased the clock down toward her under OW6's cap -
  floored at the near-enemy pace (ENEMY-PACE, the 'foe' dial: x5 by default, x60 at its top). Under the Overworld the
  guns cannot be fired (the view's own input, TV_WORLD_ACTIONS). Measured on the real naval host: a bold pirate brig
  wrecked a boat in four real seconds at the dial's top, and in fifteen at x20 from inside her ring; at x1 she fired twice.
- **The Overworld came up over a pirate and stayed.** Its `danger` (the view's fall), `tvJourneyUp` (its rise) and
  `travelViewCanGo` (its click) read the land's foes and a duel - never a ship, though NAV-H makes a hostile ship an enemy
  nearby wherever the game asks it outdoors.
- **Online my clock ran the AI against another player.** The sea is stood by one player for everyone within
  NAVAL_SHARE_RADIUS (the lowest id afloat, `launchesTraffic`), and its ships take on a peer's boat as well as mine;
  nothing of mine (my journey's threats, my helm's keys) asks about a ship hostile to them alone. Measured with two real
  hosts over the room's relay: a navy cutter hunting the peer fired 46 broadsides in twenty real seconds while her
  stander ran at x30, against 1 at x1.

FIXED:

- **x1 inside a hostile ship's hold** (`systems/travel/travelThreat.js foeRate`): each hostile ship's threat says the ring
  she holds the clock in (`navalHost.js threats`' `holds`, HOSTILE_NEAR_M); `threatCap` answers `held` while the traveller
  stands inside one, and both of the governor's paths (`world.js travelViewGovern` - the classic skin's journey on the
  ground and the Overworld's) run the clock at x1 there - outside it OW6's cap and ENEMY-PACE's floor as before, and a land
  foe holds no ring (TO1: it keeps its own pace). NAV-H's own law - Come Sail Away's helm keys already kept it
  (`comeSailAway.js`, the time scale reset with an enemy near).
- **The Overworld comes down for her**: the view's `danger`, its rise over a journey and its click each ask
  `navalHostileNear()` beside the land's foes - brought down, AUDIT OW4 J5's walking pace holds the Overworld's journey.
- **A shared sea keeps real time** (`systems/naval/seaClock.js`): online, a sea a peer shares (`sharedSea` - one within
  NAVAL_SHARE_RADIUS, on the water's plane) is stepped at real time whatever my clock (`seaSeconds`, the naval host's
  frame); alone - offline, or no peer near - it keeps the world's, as AUDIT NAV1 laid down. A captain's leagues are her
  own clock's still (CAPT-LOG's `sailed`).

Recorded, not changed: a band's chase measures its patience on the real clock while it closes at the world's (OW6's
bands, BAND_GIVE_UP_MS) - the leash bounds it and the chase is the chased traveller's own, so the band gains nothing a
traveller does not; the threat cap's pace at sea is the walking motor's, the boat's way a later refinement.

DEPARTURE from nothing: Daggerfall has no sea; Travel Options' own law (AreEnemiesNearby stops a journey) is kept.

## AUDIT 2 - the refit audited again (2026-10-17)

The owner, at the slices' end: *"Please once more audit everything and ensure perfection."* Four lenses over the whole
branch (the sea fight; the Fleet, the refits and the captain; how a ship looks; the hold, the raid, the way and the
docs) found thirty-one things, and the work a thirty-second (a ball into a moored boat of mine jarred my eye); each was
traced to a real caller and fixed, or is recorded below as why not:

- **The Fleet**: an accepted sky read the standing boats alone, and a laid-up ship sailed out on the stars given back
  (`fleetHost.js restat`: every ship of the Fleet, a laid-up one by her number); Create Item's steel paid a Steel tier
  (`meltable`: never conjured); a keystone's price under 1 was dropped by the sea fight (`refitBuild`, `gunsRefit`: any
  share but 1); an Iron store took the steel ingots ahead of iron ones, and a tier the stores could pay was refused
  (`takeMaterials`: a store's own ingots first; `takeOrder`, `takeAllMaterials`, `meltCounts`: the ingots-only stores
  first, the melt said the joint take's); the QuickDial key threw away the sky's unaccepted stars unasked
  (`navalPlunderDoor.js dialCloser`, the Firmament's own law); a cheap good at the tree's most was bought back at what it
  sold for (`exchangeOf`: buying under selling).
- **The sea fight**: a ball's fractional men were cut on the word, so chain shot took none of a peer-stood ship's crew
  (rounded on the ball's own roll); the wheel throttled where it should debounce, and on the sea clock (a turn of it a
  step, on the real clock); a near miss was told where it first came within NEAR_MISS_M (told where it passed nearest -
  kept on the ball while the gap falls); my tally counted a gun's men, not her stander's (her toughness's share, rounded
  once); a moored boat of mine struck flashed my plate's rose and jarred my eye, and a fall beside her shook me (the boat
  in play's alone); a copy first seen going down was heard going, her powder up again (never a fresh copy's); a ram
  said "board her" over a ship it sent down (her blow first); a ball's row was made each frame of its flight (once).
- **How she looks**: a hidden peer's boat sailed her name boards across the water (only where she is drawn); a fitting's
  model freed by a house's own hold took the crate and its collider from her deck (every model asked - the ask pins it);
  a boat past the flags' cap flew neither cloth nor pennant (the cap at the take), and a fading ship's cloth stood whole
  (SHIP-FADE's dissolve on the cloth); a painted ship's remap on a shared model missed the renderer's picture cache every
  frame (her paint only on the meshes it repaints); the name board's word waited for the full frame (`csaRecordKey`
  keys `p`); another's cabin wore my ledger's stain (as built); a crate could hang over her rail or stand in another
  (its turned box, every corner on her deck, none overlapping); the first named ship of a hull read her planking in the
  pool's draw (a grid of the planking's triangles, and every hull read in the preload) and the painter's base pictures
  the same (warmed in the preload).
- **The hold and the way**: a packed hold's take was weighed twice and refused (her timbers alone while it is open); her
  parts stored in her own hold lost her (back to the pack); a Rowboat's plunder had no door (it opens); the hold key fell
  back to a ship with no door (never); the peace bonus held while a ship that had sighted me gave chase from past
  HOSTILE_NEAR_M (a chase is a fight); a pad had no hold button (its row).
- **The docs**: the four hosts named for CARGO-ANYWHERE, RAM-BOARD and SHOT-KINDS (below); the Tests section's counts
  made true; SHIP-LIVERY's sea ships "as built", the wheel's law and the Rowboat's hold said as they are.

Recorded, not changed: a fitting's corners are read drawn in by FIT_INSET (5 cm), so a crate flush with her rail stands.

## SHIP-IT - the ship is "it" (15)

The owner: *"please reformat the text to not refer to the ship as "Her". Text needs to be mundane, readable and not
AI-like"*. Every string a player reads that called a ship "her" or "she" now says "the ship", "this ship" or "it", and
says it in plain words - about 300 strings, this branch's and the older sea's alike:

- **Refusals and notices** say what is wrong and what to do: `This ship is in your pack. Launch it from its parts.`,
  `Not while the ship is in combat.`, `This ship has no crew aboard. Hire crew at a shipwright.`, `Ship renamed to
  {name}.`, `Deck layout saved: 2 fittings.`, `The ships are locked together. Board before they break free!`
- **Buttons and labels** are the act alone: `Sell`, `Lay up`, `Bring here`, `Rename` (the Fleet's panel saves with
  `Save name`, apart from the card's `Rename` that opens it), `Claim`, `Scuttle`, `Raise flag`, `Apply paint`,
  `Save layout`, `Show name`.
- **The captain's stars** read as stats: `Gun damage`, `Turning speed`, `Cargo capacity`, `Guns reload 3% faster`;
  the sky's notes say what a star costs and what a level opens.
- **The crew's chatter** keeps its sailors' voice without the pronoun: `Steady as we go.`, `Coming about!`,
  `It'll hold, give it time.`
- **An unnamed ship** (a fallback the sea's named ships never reach) is `it`, one word, so the hard-coded English
  ratchet (`test/systems/l10n4_hardcoded.test.js`, which reads "the ship" as prose and "her" not) rises nowhere; the
  counts that fell are written down.

Kept: a woman is still "her" (a crew member paid off or knocked senseless, Ysolde and the other captains, the songs, the
NPCs of the Bay); Come Sail Away's own words (`You cannot pack a boat you are driving!`) stand as the mod has them; the
code's `'hers'` (a ship flying her own colours, `seaColours.js seaFlagOf`) is a value, not a word; the comments and this
bible keep their voice. The 104 keys whose English moved were drafted again for the thirteen machine-drafted languages
(`tools/l10nInSession.mjs`, TRANSLATE-BRIEF), the ship never a feminine pronoun there either beyond the noun's own
grammar. The tests pinning the words, the 39 mutant records aimed at them and the one bible anchor
(`Field-Bugs-2026-10-12d.md`) moved with them; the 39 mutants still die.

## BOARD-MAGNET - the ram retired, the grapples draw her in (2026-10-26)

The owner, 2026-10-26: *"I want to remove the ship ramming feature as its broken and instead with a ship is damaged
enough, a prompt to board should show within range and properly magnitize to the other ship."*

FOUND.
- **The ram** (`checkRams` at my helm, a galley's `checkShipRams`) was RAM-BOARD's one way aboard a sound ship, and the
  owner reports it broken in play. It is retired, not repaired.
- **The prompt asked a way under BOARD_SPEED** (2.5 m/s): at a fighting way - a Small Ship's 8.2 m/s under HELM-WAY,
  SAIL-FREE's 14 and more - a struck ship in reach read "E: heave to", a second press and up to HEAVE_TO_S of braking
  before it read "E: board".
- **The haul hauled her to where I lay when the lines went over**: `startBoarding` reckoned her berth once, and my boat
  sailed on through the GRAPPLE_S haul, stopping dead only at the fight's start (Come Sail Away's StopSailing at
  `leaveHelm`) - she lay astern of her berth by as far as I had run (5.5 m at BOARD_SPEED). And the berth was the two
  deck beams, root to root: a Large Galley's collider swells 2.4 m a side past her deck, so a Carrack berthed 0.87 m
  inside her planking, her middle 3.3 m out of level with the galley's.

CHANGED (`systems/naval/navalBoarding.js`, the law; `scenes/naval/navalHost.js` wires it):
- **The ram is gone** - mine and a galley's: a stem in a hull deals nothing and takes nothing back (the hulls are kept
  apart as ever, `separateHulls` and Come Sail Away's collider). RAM-BOARD's foul with it: `systems/naval/navalFoul.js`
  DELETED, the captains' held way (`navalAI.js` `stepCaptain`), the wire's `u` (an older build's ram blow that still
  says one is taken as the blow alone - `navalWire.js` `validNavalHit`), the card's "Fouled" lines and the five
  `naval.foul.*` words. The hull builds lose `ram`, and the shipwright's card its "a ram".
- **The prompt in reach, at any way** (`boardingGap`): a ship whose colours are struck (`boardableState` - struck, not
  boarded already) within BOARD_RANGE of my helm is "E: board" on the plate, her card and the pad whatever my way, and
  the crews muster for it (CREW-MUSTER's one law). The heave-to is retired with the gate it answered (`heaveFor`,
  `startHeaveTo`, `stepHeaveTo`, the HEAVE_TO numbers, `heaveToDecel`, `heaveToRun` - and BOARD_SPEED). Damaged enough is
  struck, as it always was: STRUCK_AT of her hull (`navalDamage.js`), or her crew gone. On foot, FOOT_BOARD_M as before.
- **The grapples draw her in** (`startBoarding`, `stepBoarding`; `haul`, `berthHull`, `haulBrake`): thrown at my way, my
  canvas is struck and my way comes off over the haul at `haulBrake` - all of it in GRAPPLE_S, CSA_BRAKE_MAX at most -
  on Come Sail Away's `brake` seam (the heave-to's), nothing driving her on (`wayScale` 0) while it brakes; and each
  frame of the haul her berth is reckoned from my boat as it lies then, so the frame the haul is done she lies in it,
  side by side where I came to rest. The berth (`berthPose`) is the two hulls' own: the beams and BERTH_GAP apart, never
  nearer than HULL_CLEAR (0.5 m) between their colliders' widest (`halfWidth`), middle to middle (halfway from `aftZ` to
  `bowZ`), on the side and the heading she chose when the lines went over. A pirate's grapple on me (the repel) is
  hauled the same way. AUDIT BOARD-MAGNET (below) drew the haul out to her berth's lane and along it, kept clear of my
  hull, and moved its wiring to `scenes/naval/navalHaul.js`.
- **The captain's stars** (`systems/naval/captainTree.js`): the ram's two keep their ids, which a saved sky names, and
  reach farther - `c_ram1` (Iron Beak, `ram` 0.2) is Long Lines, `reach` 0.15; Grappling Irons (`c_irons`, `foul` 8 and
  a boarder) `reach` 0.25 and the boarder - BOARD_RANGE times `statScale(reach)`. The stat reads "Grapple reach", and the
  Commander's lines say guns, shot and boarding, not ramming (`captain.page.what`, `captain.sky.commanderLore`,
  `growth.captain.lead`; drafted again in the thirteen whole languages - the twelve still drafting owe them as before).
- **Kept**: a sound ship being boarded - a pirate's repel now, the one way a ship afloat is boarded - is said afloat on
  the room's word with her captain's mode `boarded` (RAM-BOARD's online fix); its three records carried to
  `tools/mutants/boardmagnet.json`.

The port's own, as the sea fight is: Daggerfall and Daggerfall Unity have no sea, no ram and no boarding.

## AUDIT BOARD-MAGNET - the haul audited (2026-10-26)

The owner, on BOARD-MAGNET's pull request: *"Audit this."* An independent read of the diff found ten things, and the
audit's own read an eleventh - the worst: each was measured on the code and fixed, or is recorded below as why not.

FIXED:
- **The haul drove her through my hull** (the audit's own): the eased straight line from where she lay to her berth
  ignored my hull between them - from across my bow a galleon passed 16.7 m inside mine, a galley hauling a Carrack
  25.8 m, and over every start in reach of every pair of hulls the worst was 39.7 m (a galley across another's stern).
  The haul is drawn now (`navalBoarding.js` `drawHaul`, a frame of it): first across my keel to her berth's lane, then
  along it, her heading round the short way, HAUL_SPEED (30 m/s) and HAUL_TURN (120 deg/s) at the most - and kept out
  of my hull grown by HULL_CLEAR, by the push that keeps the sea's hulls apart (`hullOverlap`). Measured over the same
  23,909 starts (out to a captain's farthest reach, 30 frames a second): never within HULL_CLEAR, 2.1 m in a frame at
  the most (the straight line pushed out instead jumped 59 m in one, and fixed schedules - the lane first, the heading
  late - all still drove 29-36 m in). A haul round a hull is longer: the fight waits until she lies in her berth
  (`createBoarding` `step`: GRAPPLE_S and `arrived`) - about half lie in it by GRAPPLE_S, 95% by 3.5 s, the slowest (a
  galley lying across another's stern) in 5.3 s; HAUL_MAX_S (6 s) is a guard none of them reaches, laying her in her
  berth whatever held her (at 5 s it cut ten of those galleys 8.4 m short). Drawn straight at the berth without the
  lane, 775 wedged behind a stern.
- **Her side and heading flipped mid-haul** (F1): her berth's side of my keel and her heading were chosen afresh each
  frame against my live helm - lying near 90 degrees off my heading, a turning helm flipped her heading 28 degrees in a
  frame, and her side could flip across my keel. Chosen once now, when the lines go over (`berthPose`'s `lie`,
  `navalHaul.js` `start`), the rest reckoned from my boat as it lies.
- **A haul thrown at rest let the helm drive** (F3): nothing drove her on only while the brake was positive, and a throw
  from rest has none - the oars gathered way under the haul. The helm is held for the whole haul (`hauling`).
- **The haul's wiring was the host's own** (F6, HOST-SPLIT): the berth, the per-frame haul and the brake are
  `scenes/naval/navalHaul.js` `createNavalHaul` now, wired by `createNavalHost` (its ceiling down by the line it freed).
- **A dead reader** (F9): `createBoarding`'s `pose` read a fixed berth no caller asked for; it went with `haulPose`, the
  straight line.
- **Three copies of a hull's middle** (F10): `flatHull`, `hullGap`'s box and `berthHull` each worked it out -
  `navalShips.js` `hullMid`, `flatHull`, `hullOverlap` and `flatGap` are the one law now (`navalHost.js` re-exports the
  two its readers take from it; `navalAI.js hullGap` is `flatGap` of two).
- **The ledger's row** (F7): it still said boarding took a ship fouled by my ram, and that the stars fed a ram and a
  foul.
- **A float pin** (F8): `helmway.test.js` asked `haulBrake(8.2) * GRAPPLE_S === 8.2` exactly.

LEFT AS FOUND, and why:
- **A repel strikes my canvas** (F2): it does now under the haul - and the fight's start always did (`leaveHelm` is Come
  Sail Away's StopSailing, which lowers the sails and stops her dead); the haul only takes my way off over its seconds
  instead of in one frame.
- **The brake is sized once** (F4): at the haul's start, all of my way over GRAPPLE_S, nothing driving her on - she
  comes to rest by its end. Past CSA_BRAKE_MAX times GRAPPLE_S (44 m/s) it cannot, but no way the sea gives is that
  fast (a storm's Carrack makes 38.9), and a brake sized each frame binds at the same bound.
- **A prize's hold at the helm's plain reach** (F5): the stars' `reach` is the grapples' - a prize is never grappled
  again, and lies alongside once taken; her hold opens at BOARD_RANGE as it did.

Tests: `boardmagnet.test.js` (9) - the sweep over every start in reach (six pairs of hulls, every side and heading), a
turning helm, a throw from rest, a ship across my bow, a berth too far for HAUL_MAX_S; `nav_d_boarding.test.js`'s haul
and phases on `drawHaul` (the long way round, the haul that waits); `tools/mutants/boardmagnet.json` (25, all dead) and
`nav_d.json`'s side and short-way records re-aimed (dead).

## THE FOUR HOSTS RULE


- `scenes/world.js` - the one host that streams the sea and stands Come Sail Away's runtime: PEACE-WAY's seam is wired
  there; ISLE-TRADE's isles are its streamed world's, and its harbour office the one exchange.
- `scenes/worldModes.js` (interiors), `scenes/dungeonContext.js` - no runtime of their own: a dungeon's water is sailed
  by the world host's one runtime (KEEP-BOATS), and its `enemiesNearby` already reads the mode's own foes there
  (`modes.insideFoes`), so PEACE-WAY holds below ground by the same word; no isle's exchange stands indoors - FLAGGED.
- `scenes/exterior.js` (the fixed-city bench) - FLAGGED: no Come Sail Away runtime and no Eltheric Ocean; no linked
  ship and no voyage, so no raid ashore.
- CAPTAIN-TREE and REFIT-ORES: the captain's ledger, the Fleet and the sea fight are the world host's alone (one ledger
  a world host, CAPT-LOG); its two seams are wired there (the Fleet's `captain`, the sea fight's `captain.stats`) and the
  Captain page's door with them. `worldModes.js` (interiors) and `dungeonContext.js` (a dungeon's water) read the same
  runtime's refit seam, so a ship's stars sail below ground too; `exterior.js` (the bench) - FLAGGED: no Fleet, no
  ledger.
- SHIP-LIVERY, CABIN-LOOK and DECK-PROPS: the Fleet ledger and its page are the world host's (the pool's `liveryOf` and
  `fittingsOf`, the boats' word and the plan's door are wired there). The paint and the fittings are drawn and stood by
  the boats' one pool, so `worldModes.js` (interiors - a dungeon's water, and the sailing cabin's room, whose restyle it
  passes on from the visit) and `dungeonContext.js` (a dungeon's water) show them as the street does; `exterior.js` (the
  bench) - FLAGGED: no Come Sail Away runtime, no Fleet.
- COMBAT-FEEL: the sea fight is the naval host's (`scenes/naval/navalHost.js`), stood and stepped by the world host in its
  exterior frame alone (`world.js navalFrame`, after the modes' frame has returned for a room or a dungeon) - its effects,
  its shot field and its HUD with it. `worldModes.js` (interiors) and `dungeonContext.js` (a dungeon's water) - FLAGGED:
  no sea fight is fought indoors or below ground; `exterior.js` (the bench) - FLAGGED: no naval host.
- SHIP-PLAQUE: the Fleet ledger and its page are the world host's (the pool's `plaqueOf` and `plaqueFont`, and the boats'
  word's `plaque`, are wired there); the boards are drawn by the boats' one pool, so `worldModes.js` (interiors - a
  dungeon's water) and `dungeonContext.js` (a dungeon's water) show them as the street does; `exterior.js` (the bench) -
  FLAGGED: no Come Sail Away runtime, no Fleet.
- SEA-COLOURS: the sea's ships are the naval host's, stood and stepped in the world host's exterior frame alone; their
  paint is drawn by the boats' one pool wherever they stand, and their cloth by the exterior's flag pass (the world host's
  `seaFlags`). `worldModes.js` (interiors) and `dungeonContext.js` (a dungeon's water) - FLAGGED: no sea ship sails there;
  `exterior.js` (the bench) - FLAGGED: no naval host.
- TIME-DILATION: the journey's governor, the Overworld and the sea fight are the world host's exterior frame's alone
  (`travelViewGovern`, the view's deps, `navalFrame`); `worldModes.js` (interiors) and `dungeonContext.js` (a dungeon's
  water) - FLAGGED: no journey runs and no Overworld rises indoors or below ground (AUDIT DEEP X-1 cuts the view at the
  door), and their water is sailed by the world host's one runtime at the world's clock; `exterior.js` (the bench) -
  FLAGGED: no naval host, no Overworld.
- CARGO-ANYWHERE: the hold's key, the helm's Hold and the Fleet page's are the world host's, read above the modal
  return, so `worldModes.js` (interiors - the sailing cabin's room, a dungeon's water) and `dungeonContext.js` (a dungeon's
  water) open the same hold by the same door; `exterior.js` (the bench) - FLAGGED: no Come Sail Away runtime, no Fleet.
- RAM-BOARD and SHOT-KINDS: the naval host's, stood and stepped in the world host's exterior frame alone (as COMBAT-FEEL);
  `worldModes.js` and `dungeonContext.js` - FLAGGED: no sea fight is fought there; `exterior.js` (the bench) - FLAGGED: no
  naval host.
- BOARD-MAGNET: the naval host's, the same (its haul `scenes/naval/navalHaul.js`, the module it wires) - the world host
  hands Come Sail Away the haul's brake (`brake: () => naval?.brake()`) beside the runtime it stands; `worldModes.js` (interiors) and `dungeonContext.js` (a dungeon's water) -
  FLAGGED: no sea fight is fought there, so no grapples are thrown; `exterior.js` (the bench) - FLAGGED: no naval host.
- RAID-ASHORE's withdraw reads the world host's two pools - the street's and, through `worldModes.js`'s `interiorPool`,
  the sailing cabin's room; `dungeonContext.js` - FLAGGED: no voyage's raid is fought below ground.

## Tests

- `test/systems/naval/isletrade.test.js` (5) and `tools/mutants/isletrade.json` (8, all dead); `capttrade.test.js`'s
  two isle pins and `etherchart2.test.js`'s card pin moved (PIN MOVED), and `tools/mutants/capttrade.json`'s two isle
  records re-aimed at the lines they name now (42, all dead).
- `test/systems/comeSailAway/peaceway.test.js` (6) on Come Sail Away's real runtime, and `tools/mutants/peaceway.json`
  (15, all dead).
- `test/scenes/holddoor.test.js` (6) over Come Sail Away's real runtime and the Fleet's ledger and host, and
  `tools/mutants/holddoor.json` (16, all dead); the action list's pins moved for `ShipHold` (`inputactions`, `qs2_inputs`,
  `classicpages`, `viewtoggle`, `uicalm`) and the helm panel's (`shipcrew`, `auditnav2_helm`, `fb1011c_seatown`).
- `test/systems/naval/ramboard.test.js` (7; DELETED by BOARD-MAGNET, with its mutants) on the real naval host and pool, and `tools/mutants/ramboard.json` (29, all
  dead).
- BOARD-MAGNET: `test/systems/naval/boardmagnet.test.js` (7) on the law and the real naval host and pool, and
  `tools/mutants/boardmagnet.json` (17, all dead); AUDIT SHIPS A3 and AUDIT SHIPS 2 XA5 re-aimed at the haul's brake on
  Come Sail Away's real runtime (`auditships_sail`, `auditships2_sail`: full way off within GRAPPLE_S, in the rated wind
  and the storm's); CREW-MUSTER's two muster pins re-aimed at the reach (`fb1014_crewmuster`, its two records re-aimed,
  all dead); the ram's and the heave-to's pins and records retired with them (`navaudit_helm` H11, H16, XA5;
  `navaudit_captains` G9; `auditnav2_captains` F26; `auditrefit` the rammer's foul; `auditrefit2` the blow before the
  foul; `ferryclear`'s booked stem; `crewhold`, `tougherships`, `captaintree`, `seaset` and `helmway`'s ram and brake
  lines); the records left standing re-aimed by content (`nav_d`, `nav_f`, `navaudit_helm`, `ships2_carrack`, all dead).
- `test/systems/naval/shipcolours.test.js` (9) on the law, the art, the cloth's vertex law run in JS (`test/glsl.mjs`), the
  host over Come Sail Away's real runtime, the ledger and its save, the Fleet's act and page, the wire and the world's
  wiring, and `tools/mutants/shipcolours.json` (42, all dead); the cloth also seen drawn in headless Chromium in a fair
  wind and a calm. The pins it moved: the ledger's record (`fleet`), the banners' wind (`auditguild1d`: the banners' own
  line); the records re-aimed by content in `csa_together`, `holdings` and `auditguild1d` (all dead). THE FOUR HOSTS
  RULE: the cloth is drawn in the world host's exterior pass alone - `worldModes.js` (interiors) and `dungeonContext.js`
  (a dungeon's water) draw the mod's pennant, as before; `exterior.js` (the bench) - FLAGGED: no Come Sail Away runtime.
- `test/systems/naval/shotkinds.test.js` (10) on the law, the gunnery, the shots, the real naval host and pool, the wire,
  the helm, the captains, the HUD, the picture and the world's wiring, and `tools/mutants/shotkinds.json` (66, all
  dead); the pins it moved: the muzzle event's (`nav_a_guns`), the chasers' count (`nav_f_ui`), the hull hit's spy
  (`navaudit_presentation`), the boarder's held broadsides (`navaudit_captains`: held while round shot, grape alongside),
  the wheel's rung (`spyglass`, `audit24_wave37`), the helm panel's model (`holddoor`, `shipcrew`), the action list's
  (`inputactions`, `qs2_inputs`, `classicpages`, `viewtoggle`, `uicalm`, `tech1_hosts`, `modewheel`); the records re-aimed
  by content in `crewhold`, `holdings`, `navaudit_captains`, `navaudit_guns`, `navaudit_helm`, `navaudit_presentation`,
  `shipcrew` and `spyglass` (all dead).
- `test/systems/naval/captaintree.test.js` (14) on the law, the seams (pure and pinned where the hosts read them), the
  ledger and its save, the ore ladder, a piece melted down and the joint count, the refit's words, the window over a
  document of its own and the Captain page; `fleet.test.js`'s REFIT-ORES test on the Fleet's real host (the level's gate,
  the stores counted once, a blade melted, the stars on a ship of mine and never a stranger's), and
  `tools/mutants/captaintree.json` (88, all dead); the window also seen drawn in headless Chromium in both dresses and at a
  phone's width. The pins it moved: the ledger's new save (`captlog`), the Fleet's three tiers (`fleet`: twelve now), the
  crew's worth (`captcrew`), the Captain page's wiring (`captlog`); the records re-aimed by content in `auditcaptsea`,
  `captcrew`, `csa_sailing`, `holdings`, `navaudit_guns`, `navaudit_helm`, `peaceway`, `ramboard` and `shotkinds`.
- `test/systems/naval/shiplivery.test.js` (14) on the livery's law and word, the painter, a port ship's pictures repainted,
  the paint shop, the real pool (mine painted by my ledger, a peer's by her word, a sea ship as built - SEA-COLOURS: in her
  own once her code is set; fittings stood in
  her tree, drawn and in her colliders), the fitting-out, the fittings' law and word, the ledger and its save, the
  Fleet's acts and its Paint panel, the plan's door, the cabin's stain and its wiring, the deck plan's window and the
  paint's picture, and `tools/mutants/shiplivery.json` (135: 133 dead, 2 equivalent as recorded - a zero code's guard,
  and the painted pictures' list, which no livery of the 224 on any port ship reaches past today); the paint's texture
  sheets and the deck plan (wide and at a phone's width) also seen in headless Chromium. The pins it moved: the
  ledger's record (`fleet`: `livery`, `cabin`, `deck`), the
  sailing cabin's lifted scope (`sailingcabins`: `fleetShip`), the hard-coded strings' map (`l10n4`), the pseudo-archives'
  free number (`eglook_registry`: 38191 and 38192 taken), the Captain page's
  wiring (`captlog`, `captaintree`: its model moved out of the world host into `scenes/captainPageHost.js`, HOST-SPLIT);
  the records re-aimed by content in `auditcaptsea`, `csa_close`, `csa_together`, `livingcrew`, `navaudit_frame`,
  `perfsails1` and `shipcolours` (all dead).
- `test/systems/naval/combatfeel.test.js` (7) on the effects' law, the near miss in the shot field, the feel's module and
  the real naval host over the real pool (a pirate's ball by my side, its fall beside her, one into her starboard; her
  plate drawn; my volley into a merchant carrack and its men), and `tools/mutants/combatfeel.json` (68, all dead); the
  whistle's clip measured (its level swelling to the pass, its pitch falling through it). The pins it moved: the
  founder's foam (`nav_b_picture`: its boil's drops beside it), the clips' count (`nav_e_sounds`: ten), the provenance
  list (`doctrine`), the card's model (`nav_f_ui`: her `crew`, and her hull bar's bite flashing it), the HUD's class holes
  (`hudclass_sheets`: the plate's frames - `barLoss`'s since the AUDIT), the registry's English (`l10n4`: its two new rows); the records re-aimed by
  content in `nav_b` (the wind's line), `nav_h`, `navaudit_helm`, `navaudit_presentation`, `shipstance` and `shotkinds`.
- SEA-COLOURS: `test/systems/naval/seacolours.test.js` (6: a navy's crown, a merchant house, a pirate crew and her
  disguise, a legend's own, the colours down, every table through the flag's door and every hull's parts, the frame's
  flags nearest first and the flag host's cap, and the real naval host painting her as she is built - a peer's copy the
  same - and saying her flag until she strikes) and `tools/mutants/seacolours.json` (26, all dead); `shiplivery`'s pool
  test draws a sea ship in her own paint, `shipcolours`' wiring pin moved for the flag host's `seaFlags`.
- SHIP-PLAQUE: `test/systems/naval/shipplaque.test.js` (6: the lettering and the picture; every hull's bows (the rowboat's
  too) and the mod's own - her planking found, a board each side flush on her flare, under her rail, in her bows aft of the stem's
  turn, facing out, reading the right way and right way up, the sides a mirror, a long name cut smaller, a side wound
  either way and a bulkhead behind her planking; the boards made and let go; the real pool - mine by my ledger, a peer's
  by her word, a sea ship none, in her heeled hull's frame, FONT0003 and its fallback, swept once undrawn; the ledger, the
  Fleet's act and page, the word and its reader, and the world's wiring) and `tools/mutants/shipplaque.json` (54, all
  dead); the boards on all four port hulls, both sides, also seen in a software render. The pins it moved: the
  ledger's record (`fleet`: `plaque`), the world's pool line (`shiplivery`: `plaqueOf` follows it), the pseudo-archives'
  free number (`eglook_registry`: 38193 taken), the hard-coded strings' map (`l10n4`: the pool's fallback line, the
  registry's row); the record re-aimed by content in `shiplivery` (the word's `d`, all dead).
- TIME-DILATION: `test/systems/naval/timedilation.test.js` (3: the law - x1 inside a hold whatever the dial, the floor
  outside it, a land foe none; the real naval host's threats each her hold and a pirate at 160 m holding the journey at
  x1, the world's wiring of both paths and the view's three refusals; the shared sea at real time and alone at the
  world's, on the real host) and `tools/mutants/timedilation.json` (16, all dead). The pins and the mounted governors it
  moved: `ow6_slowdown`, `ow_loadowed`, `ow_toggle`, `tv_wasd`, `fb0929d_toroads` (each mounts `foeRate` beside
  `foePaced`), `tv2_click_to_move`, `enemy_pace`, `tv1_travel_view`, `wildalert` (the governor's lines, the view's
  danger), `fb0929_overworld_mouse`, `fb1007b_climbtravel` (`navalHostileNear` in the mounted view), `nav_r_raiders` (the
  threats' hold); the records re-aimed by content in `nav_r`, `ow6s`, `tv1`, `tv2` and `navaudit_captains`.
- AUDIT 2: `test/systems/naval/auditrefit2.test.js` (16, on the real modules - the Fleet's restat and the laid-up
  state, the stores and conjured steel, the QuickDial's ask, the exchange; the word's men on a peer-stood ship, the
  wheel, the near miss's nearest and a pass told as its ball goes, the boat in play's blow and jar, a fresh copy going
  down, the ram's order; the flags' cap and fade, the paint's meshes, the board's word, the guest's cabin, the hidden
  boat, a fitting's box and its pin; the packed hold, a Rowboat's plunder, the key's fallback, the chase's peace, the pad)
  and `tools/mutants/auditrefit2.json` (51: 49 dead, 2 equivalent as recorded - the planking's grid and the preload's
  priming, each the same answer sooner). The pins it moved: `shiplivery` (the fittings asked, the
  cabin's guest), `peaceway` (the chase), `tougherships` (the word's men), `captlog` (the leagues' own clock); the records
  re-aimed by content in `auditcaptsea`, `auditrefit`, `captaintree`, `captlog`, `combatfeel`, `csa_together`,
  `holddoor`, `holdings`, `navaudit_guns`, `shipcolours`, `shiplivery`, `shotkinds` and `tougherships` (38, all dead).
- AUDIT (2026-10-17): `test/systems/naval/auditrefit.test.js` (4: the near miss's sphere, a peer's magazine and her
  going down heard, the flag's cloth, the rammer's foul sent; 5 with the one classic read) and
  `tools/mutants/auditrefit.json` (16: 15 dead, 1 equivalent as recorded - the reject's clamp, which only tightens it);
  of the 71 records the fixes added or re-aimed elsewhere, all dead (one, the effects' own cap, after `nav_b_picture`
  was given an added layer past the buffer); the other fixes'
  tests in their slices' files - `captaintree` (a plain piece alone; the struck gun), `fleet` (a refit touches nothing
  else of her), `ramboard` (the word, the reader, the foul said and read), `shiplivery` (no tree made again while a
  model waits), `combatfeel` (the plate's bar by her number), `holddoor` (no word that a refused door opened),
  `nav_b_picture` (the aim's room), `peaceway` (the hold) - and their records in `captaintree`, `combatfeel`, `nav_b`,
  `peaceway`, `ramboard` and `shiplivery`. The pins and records the moves re-aimed by content: `nav_g_online` (a blow's
  `foul`), `tougherships` (the ram's blow), `serpent1_auditclient` (the tally's serpent line, in `navalTally.js`),
  `hudclass_sheets` (`barLoss`'s frames), `shipcolours` (the flags' draw), `auditnav2_online`, `holdings`,
  `navaudit_guns`, `navaudit_presentation`, `serpent1_audit`, `shipcrew` and `shotkinds`.
- `test/systems/quest/raidashore.test.js` (6) over the author's own quest and the real machine, and
  `tools/mutants/raidashore.json` (13, all dead); `wa1_warmAshesShips.test.js`'s Leave Ship pin moved (PIN MOVED: off
  the sea it now ends the raid).
