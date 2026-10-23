# HOLDINGS - the pause menu's Holdings tab: the Stable, the Fleet, a ship's refits and her name, the ports' quays (the port's own)

Opened 2026-10-03. Mac, on PR #549 (TOUGHER-SHIPS): *"Lets add a new tab to the pause menu as the stat page is starting
to get bloated. Lets organize everything appropriately. Under the new tab add a page that allows you to see your
currently owned mounts ships and carts. You can summon your horse/cart from this page/send away much like the companion
system. You can also do this with ships instead of relying on a deed item. Ships show their values, current health, and
option to repair if theres crew (even if youre away) etc. Introducing the new ship upgrade system. Allowing you to
improve capacity, speed, health, damage, etc. This can utilize foraging items used within the world. Loaned ships
shouldnt be able to be upgraded until the loan is paid off. This also introduces the ability to change your ship name
for others to see ... Ship deeds can now be replaced in favor of the new enhanced plus UI tabs on the pause menu. Take
your time."*

Nothing here is DFU's or a mod's: it is the port's own, over Come Sail Away (`03-World/Come-Sail-Away.md`), Horse Cart
and Cargo (`06-Systems/Horse-Cart-And-Cargo.md`) and the sea fight (`03-World/Naval-Combat.md`), whose laws it calls and
never restates.

Not THE HOLDINGS ARC of the hubs, homes and guilds (`06-Systems/Online-Arc.md`): this arc is named for the pause
menu's Holdings tab. Audited the same day (`01-Overview/audits/Audit-Holdings.md`, AUDIT HOLDINGS): what follows is the
audited build.

## 1. The tab (HOLDINGS)

The enhanced pause window's tabs are **Quests, Stats, Growth, Holdings, Family, Tutorials, System** (`ui/enhanced/enhancedMenu.js` `PAUSE_TABS`; GROWTH1's Growth tab, `10-UI/Growth.md`; a landing
names any of them - `PAUSE_TAB_IDS`, the strip's own list). The Stats rail is the character sheet again - Character,
Attributes, Skills, Advantages, Standing, Effects, and online the Professions page. The Holdings rail (`pauseHoldings`,
PX6's rail-and-detail bones a fourth time) holds what the player owns and who follows them, each page while it has a
thing to show:

| Page | Module | Shown |
|---|---|---|
| Stable | `ui/holdingsPages.js` | whenever a host provides it - owning nothing is a thing it says, and where to buy |
| Fleet | `ui/fleetPage.js` | while Come Sail Away runs in the world host |
| Captain | `ui/captainPage.js` (CAPT-LOG, `03-World/Captains-Sea.md`) | once a captain has a standing, a log, a contract or a chart - each crown's regard and rank, the letter, the contracts held, the treasure charts marked, the log (the Eltheric Ocean's lines among it: the isles charted, the deepest waters, the legends ended - `03-World/Eltheric-Ocean.md`) |
| Companions | `ui/companionRoster.js` (moved off the Stats rail) | anyone sworn or at the player's side |
| Revenants | `ui/revenant/revenantPage.js` (moved) | revenants made, or any remembered |
| Stores | `ui/professions/profPages.js` (moved; the Professions page stays on Stats) | online, the professions this account's |

A home station's press that opened the Stores page lands on the Holdings tab there; the Professions key on the Stats tab.
Every visit opens the rail on its first page and forgets the pages' words (an act's answer, an open name field, a panel).
The pages' cards are the Companions page's: the stone-and-brass kit's roles (`ui/enhanced/enhancedFrame.js` FRAME_ROLES - a card a
panel, a picture a well, a state a chip), the sheet writing geometry and its words' colours alone.

**THE PROVIDER.** The pages touch no runtime: the host hands them `setHoldingsProvider({ stable, stableAct, fleet })`.
THE FOUR HOSTS: `scenes/world.js` provides both pages; `scenes/exterior.js` (the `?exterior` dev host, no Come Sail Away)
the Stable alone - both through ONE constructor, `stableProviderFor` (THE ONE CONSTRUCTION SEAM); `scenes/worldModes.js`
(interiors) and `scenes/dungeonContext.js` stand no runtime of their own - the world host's provider answers over them,
and a summon or a send away there is refused by the runtimes' own indoor laws.

## 2. The Stable

The horse (DFU item 94) and the wagon (93), each a card with the item's own inventory picture: owned or not; where it is
- **Riding**, **In harness** / **Driving**, **Following**, **Waiting** (where it was left, how far), **Hitched** to the
parked wagon, **Parked** (how far), **With you** (beside a player on foot and never sent away - the mod's WithPlayer,
which the next door leaves outside), **Stabled** (sent away - WAGON-STABLED, below); with the mod off, or its physical
persistence off, the classic transport's **With you**; the wagon's load against its 750 kg.

- **SUMMON** is Horse Cart and Cargo's own (`HandleSummonTransport`), its line ANSWERED now rather than said
  (`summonTransport`: the page says it under the cards, the hotkey on the HUD - one body).
- **SEND AWAY** is its other half (`sendTransportAway`, the port's own): whatever of the pair stands in the world - a
  parked wagon, a horse waiting or following - leaves it, or is beside a player on foot without having been sent away,
  and the pair is STABLED: the record the persistence switch's turning on makes (`resolvePersistenceEnabledState` for a
  player on foot - the mod's WithPlayer), with the record's two words of the port's own set (WAGON-STABLED, below).
  Stabled, the pair is mounted from the Transport window as the mod's WithPlayer state always was, or summoned again.
  Refused indoors and aboard (as the summon is), while riding or driving, with the persistence off, and with nothing
  out.
- **RENAME HORSE** in place, by the name prompt's own law (`renameHorse` - `resolveHorseNameInput`).

**WAGON-STABLED** (FIELD BUGS 2026-10-15d, `01-Overview/bugs/Field-Bugs-2026-10-15d.md`; Fay, 2026-10-14: "Wagon appears outside of buildings/dungeons when stabled - I
keep sending my wagon away, but every time I enter a building or dungeon it appears outside again"). Stabled WAS the
mod's WithPlayer and nothing more - the state of a pair beside a player on foot - and the mod's HandlePreTransition
[IL_98f0] parks a WithPlayer wagon at every door such a player goes through and stands a WithPlayer horse behind them
there: the pair sent away came back at the next door. The save record (`systems/horse/horseCartLaw.js` newSaveData) carries
two words of the port's own beside the mod's fifteen fields, `WagonStabled` and `HorseStabled`, set by Send away alone:

- **A stabled pair stays away.** `handlePreTransition` parks no stabled wagon and stands no stabled horse at the door;
  a horse mounted from the Transport window leaves a stabled wagon at the stable (`deployWagonBeforeHorseTravel`); a
  fast travel does not take it (`wagonGoesOnJourney` - no wear, no riders' seats).
- **What takes it out of the stable lets the word go**: a summon (the page's, the key's - `commitDeployment`,
  `setHorseLoose`) or any park; a mount (`leaveStable` - the horse ridden, the wagon driven with its horse: the
  runtime's set, the game's once observed, and the mode a door is gone through in, so a pair driven or ridden through
  a door is parked there as the mod parks one); the record laid afresh (`resetWagonState`, `zeroHorse` - one sold and
  another bought, the persistence switch turned); a new game and a load's start. A wagon parked at a door with its
  horse still at the stable (a wagon bought after the horse was sent) keeps the horse's word.
- **Saved** with the record and read back only as `true`: a save from before the word loads NOT stabled - the mod's
  WithPlayer, parked at the next door as before, which the card calls With you and offers to send away.
- **The words follow it**: the card says Stabled only for what was sent away, and the keep feeds only that horse at
  the stable (`systems/upkeep/upkeepRuntime.js` horseWhereOf, `06-Systems/Horse-Care.md`); a horse beside its owner unsent
  is with its owner.
- **Unchanged**: a stabled wagon's load is reached outdoors, and the pair mounted from the Transport window anywhere,
  as the mod's WithPlayer pair's always were. A peer sees nothing of a stabled pair (`scenes/horseCartPool.js`
  parkWord reads a parked wagon and a waiting horse alone), and the town watch throws only a parked wagon.

## 3. The Fleet - a ship's title is a ledger's, not an item's

**THE LEDGER** (`systems/fleet.js`) keeps every ship the player holds title to, by her number - the UID her deed placed
her by, Come Sail Away's own (`GetPlacedBoatWithUID`): her hull and rig, her worth, her name, her refits, the bank's
claim while the loan she was bought on stands, the port she was last laid up at. Its own save slot, `Fleet` (carried
whether Come Sail Away runs or not - AUDIT REALM2 C3's law), read as a hand-made save may be (AUDIT HOLDINGS F7): one
record a number, a variant her hull has, her worth within [0, SHIP_VALUE_MAX], a port's name printable, FLEET_MAX (256)
records. An older build drops the slot: a save made now and loaded there loses its laid-up ships (the patch notes say so).

**THE BOOK** is her title. A deed (Come Sail Away's item 1321) no longer rides in the pack: it is entered in the book, a
collection of the same deed items by the same UIDs, and every one of the mod's laws that asked the pack for a deed finds
it there (`deedInPack` reads the book too):

- **Bought** at a counter, a deed goes to the book (`worldModes.js` commitTrade, after the furnisher delivers), stamped
  with the port she waits at; the HUD says where, and where to look. A deed off the keyed shelf goes to the book as the
  counter's does (F8). (SHIP-CREDIT WITHDRAWN, 2026-10-08: no purchase is on the bank's credit, so none stamps her
  claim - `titleDeed` takes none, and `creditShip`, F5's stamp on parts, is gone.)
- **A prize** claimed at sea (`navalHost.js` claimPrize) has her title entered by the world host's `packDeed`; a claim that
  fails to place her forgets her record with her title (`forgetShip` - F8).
- **An older save's deed** - or the console's - is entered the first time the Fleet page reads the pack (`titleDeedsIn`).
- **Picked up** (SHIP-PACK's Steal at her helm, a fast travel at her helm), her title LEAVES the book with her: her parts
  are her - sold, she is sold; chested or dropped, she lies there (AUDIT HOLDINGS F1: a title kept while her parts lay
  anywhere but the pack was summoned while the parts stood a second boat of her number, and paid her worth each round).
  Her parts placed are spent and her title made again in the book (`takePlaceItem` through the host's `retitle`); no
  deed comes back into the pack. Parts whose boat already stands are refused - `StartPlacing` says so, `LaunchFromParts`
  stands none. Without the book's seam the mod's own swap stands.
- **A small boat's** title (the Large Boat's) is spent on placing, as the mod spends its deed; laid up, it is made again.
  Summoned while she lies afar with no berth known, she is placed from a deed of the moment in a list of its own, never
  entered in the book (F2), and the page's sweep never takes the deed a placing holds.
- **A bank ship's cabin** links to a ship by her title in the book as it did by her deed in the pack
  (`world.js` legacyCabinItems hands boatCabinOwnership the book beside the pack and the wagon - CABIN-TITLES,
  `03-World/Come-Sail-Away.md`): without it a ship laid up was no candidate, and the large bank cabin went to the one
  large ship afloat while another lay laid up.
- **Her rig** as she stands is her record's and her title's (a Large Boat's picked again - F3): read at every sweep and as
  she is sent away, so she is laid up and called back in it.

**WHERE SHE IS** is never stored: it is read off the world each time (`scenes/fleetHost.js` `whereIs`) - **At your helm**,
**Afloat** here (how far) or elsewhere (how far, which way), **Made fast** at a port's quay (section 7 - here, her own
place; afar, the last port the Fleet heard of her), **Packed** (her parts in the pack), **Laid up** (her title and
nothing of her standing). A ship with none of these draws no card: sold, purged - or her parts lying anywhere but the
pack, where she is (F1).

**THE CARD** (`ui/fleetPage.js`): her name, her hull and rig, her worth, the bank's claim while it stands, where she is,
her hull, canvas and crew against their whole (the sea fight's own numbers - `navalHost.js` `fleetStatus`), a wreck, a
fire, her carpenter's stores, her refits, and the acts below. A refused act says why on its title and, pressed, under her
card.

| Act | What it does | Refused |
|---|---|---|
| Summon | brought round to the free berth nearest the player of a harbour the sea fight knows (`freeBerth`) by Come Sail Away's `SummonBoat` - alongside its quay for her hull and made fast there (section 7), moved there if she stands anywhere (out of a dungeon's water shown outdoors - F6), placed from her title if laid up; with no berth known (a Large Galley never has one), the deed's own placing (a door: the water clicked); her port of before cleared | already here, packed, indoors, at a helm, fighting, away from any port (`IsNearPort` at the setting's PortLocationSearchRange - F8) |
| Send away | she sails for the port nearest the player and is laid up there (`LayUpBoat`: her hold into PackedCargoes under her number, placed again it is aboard) | laid up, packed, at her helm, fighting, another player aboard; a boat with no crew not here |
| Repair | her hands, wherever she lies (below); the boat underfoot, her captain's order Make repairs | no crew, packed, no hands aboard, nothing to mend, her hands fighting her |
| Shipwright | a door to the yard's window (`navalYardWindow.js`) for a ship laid up or lying here, at a port | away from a port; she elsewhere; fighting |
| Hold | CARGO-ANYWHERE (2026-10-17, `03-World/Naval-Refit.md`): her hold's window, wherever she lies - here, away, laid up (PackedCargoes, live) or packed (her parts weighed again as it shuts) - a door handed to the menu (`scenes/holdDoor.js openShip`) | a Rowboat (no hold) |
| Colours | SHIP-COLOURS (2026-10-17, `03-World/Naval-Refit.md`): her flag - its shape, its field and division, its border, its device and that device's colour, or her captain's guild's arms - drawn as she will fly it; Hoist sets it on her record (`systems/fleet.js setShipColours`, kept in the save), Strike gives her the mod's pennant again; her word said again (`changed`) | a Rowboat (no masthead), a flag the door refuses |
| Paint | SHIP-LIVERY and CABIN-LOOK (2026-10-17, `03-World/Naval-Refit.md`): her paint - each part her hull takes (a port-built hull's strakes, trim and gilding and sails; a Large Galley's wood stain and sails; a Rowboat's stain) and, where she has a cabin, her cabin's wood, each one of fourteen paints or as built - drawn as she will wear it; Paint her sets both on her record (`systems/fleet.js setShipLivery`, `setShipCabin`, kept in the save), Strip her paint gives her her build's again; her word said again (`changed`) | a paint the door refuses (her hull's and her cabin's read before either is set) |
| Deck | DECK-PROPS (2026-10-17, `03-World/Naval-Refit.md`): the plan of her deck (`ui/deckPlanWindow.js`, a door handed to the menu), its count on the button; Fit her out sets her fittings on her record (`systems/fleet.js setShipFittings`, kept in the save); her word said again | her deck not known yet (she has not stood in the world this session) |
| Refit | the panel below | below |
| Rename | the field below | - |

**A LAID-UP SHIP'S STAND-IN** - `{ uid, hull, variant, crewed, Cargo: { Items }, laidUp }`, her hold Come Sail Away's
PackedCargoes under her number, live (`laidUpHold`, made where none is) - is what the sea fight's state, the yard and her
stores read of a boat, so a laid-up ship is repaired, provisioned and refitted as one afloat is.

## 4. Repairs made away

Mac: *"option to repair if theres crew (even if youre away)"*. `navalHost.js` `repairAway`: what QUICK-REPAIRS' hands do
over the quiet, done at once where she lies - her hull and canvas mended free to FIELD_MEND_CAP of each whole (the free
mending's own reach), the rest paid out of her carpenter's stores by `seaRepair`'s law (her hull first, her spare work
spent first, a store STORE_POINTS of work), her fires put out, a wreck refloated. A crewed ship with a hand aboard, never
one fighting. Her First Mate answers by name.

## 5. Refits

Four lines, three tiers each of the shipwright's own - and REFIT-ORES (2026-10-17, `03-World/Naval-Refit.md`), nine of
metal past them, twelve in all - bought from a shipwright at a port for gold and materials from the pack and her hold (all
or none):

| Line | Betters | A tier | Built of |
|---|---|---|---|
| Hold | the threshold her load is weighed against (Come Sail Away's UpdateBoatCargoMod) | +20% | Timber, Iron |
| Rigging | her way under sail and its coming on (moveSpeed, moveAccel - never her oars) | +4% | Timber, Pitch |
| Hull | her hull's and canvas's whole (myBoatState's build) | +10% | Timber, Pitch, Iron |
| Guns | her balls' hull and canvas harm (landHit - never a fire barrel's) | +8% | Iron, Pitch - a hull that carries guns |

A tier costs a Small Ship 600 / 1,500 / 3,500 gold and 3 / 6 / 10 of each material, times her hull's share
(`HULL_UPGRADE_SCALE`: Rowboat 0.5, Large Boat 0.75, Small Ship 1, Large Galley 1.75, Carrack 2.5). The materials are
things of the world (Mac: *"can utilize foraging items"*):

| Material | Offline | Online (a Stores good withdrawn) |
|---|---|---|
| Timber | Wood Bundle (1604) - Foraging's Wood-Axe | planks (645-651), logs (635-641) |
| Iron | Iron (71) - an alchemist's | Iron Ingot (620), Steel Ingot (621) |
| Pitch | Pine Branch (14) - an alchemist's, the Sickle's quests | Resin (653) |

**THE METALS** (REFIT-ORES): past the third tier each is a metal of DFU's ladder, asking a captain's level (CAPTAIN-TREE's,
earned at sea) and bettering her by half a shipwright's tier:

| Tier | Metal | Captain's level | Gold (a Small Ship) | Metal | and |
|---|---|---|---|---|---|
| IV | Steel | 3 | 6,000 | 4 | her line's first store, 10 |
| V | Silver | 5 | 9,000 | 4 | 10 |
| VI | Elven (Moonstone) | 8 | 13,000 | 5 | 10 |
| VII | Dwarven | 11 | 18,000 | 5 | 10 |
| VIII | Mithril | 14 | 24,000 | 6 | 10 |
| IX | Adamantium | 17 | 32,000 | 6 | 10 |
| X | Ebony (and Warforged Steel) | 20 | 42,000 | 7 | 10 |
| XI | Orcish (Orichalcum) | 24 | 55,000 | 7 | 10 |
| XII | Daedric | 28 | 70,000 | 8 | 10 |

A metal is the forge's ingot of it (621-630), or a weapon or a piece of plate of it melted down - a plain piece alone:
never one worn, locked, bound, a quest's, an artifact, a sigil's, a player's make, enchanted, graded past Common or
socketed (Naval-Refit.md REFIT-ORES); the ingots go first. A store is counted once for a refit's two (a steel
ingot is Steel's and Iron's both). Her CAPTAIN'S STARS (CAPTAIN-TREE) better her refits again where they are read: her
hold, her way, her hull and her guns' harm, with her oars and her helm.

The refits are read WHERE THE RATES ARE READ (`deps.refit`, the ledger by her number), never written into the prefab's
modifiers a variant's change walks again. A refit never heals her nor hurts her: her hull and canvas are set on her new
whole the share of it they were, and nothing else of her is touched (`refitBoat`, `navalDamage.js rewhole` - AUDIT
2026-10-17: her state was built again, so a captain's stars accepted mid-fight loaded every battery and let the brace and
her mending's quiet go); a save keeps her on her first build's scale (TOUGHER-SHIPS) and reads her on her refitted whole.

**THE BANK'S CLAIM** (Mac: *"Loaned ships shouldnt be able to be upgraded until the loan is paid off"*): a ship bought on
the bank's credit takes no refit while the loan that bought her stands - her region's bank owed anything at all
(`loanOwed`). Borrowing more (its due date put later) or the Empire calling the debt in (its due date now) never lifts it
(AUDIT HOLDINGS F4: the due date was read, and either lifted her claim with the loan unpaid). The claim is cleared for good
once the Fleet sees that bank owed nothing (`settleCredit`, at each sweep of the page), so a later loan there is no claim
of hers. Repaid, she is refitted. A boat bought as parts on credit carries it as a deed does (F5). A ship bought before
the ledger carries no stamp and is free (nothing recorded which loan bought her). SHIP-CREDIT WITHDRAWN (2026-10-08,
Mac: *"Remove ship buying loan from the bank"*; `03-World/Naval-Combat.md`): no ship is bought on credit now, so the
claim comes only from a save made while it stood (`restoreFleetSaveData`), and holds until that bank is owed nothing.

## 6. A ship's name

Mac: *"the ability to change your ship name for others to see"*. A name is printable ASCII, its runs of spaces closed,
SHIP_NAME_MAX (24) at most, and passes the filter every player's name passes (`net/nameFilter.js` checkName); empty, she
is called by her hull again. She is named on her card, on the plaque over her (`world.js` `csaHoverName`), and to every
other player: the boats' word carries **`n`**, a name for each boat of `b` ('' for none), only while one is named - an
unnamed fleet's record is the older build's to the letter, and a renamed boat is said at once (`csaRecordKey`). A reader
takes each name through the same law; a bad `n` never drops the boats, a refused name reads as none, and an older
reader ignores the key (`systems/comeSailAway/comeSailAwayWire.js`; `scenes/comeSailAway/comeSailAwayPeers.js` `nameAt`).

## 7. Quays and docking

Mac: *"Completely revamp port towns with actual piers and docking ports. I want these places to feel alive and connected
with the oceans of daggerfall, along with having them appear when sailing and close to a port."* Daggerfall's port towns
stand no piers and its data names no dock: a harbour is found off the terrain (SHIP-LIFE's `findHarbour`,
`03-World/Naval-Combat.md`), berth by berth along the town's shore. Each berth now stands a QUAY, and a ship of the
player's docks at it.

**THE QUAY** (`systems/naval/quays.js` `planQuay`, pure; `world/quayModel.js`) is laid in its berth's frame - +x to the
land against the shore's normal, +z along the shore (`quayFrame`, the trs yaw `theta`). The berth is sounded for the
Carrack, and the quay's FACE stands her widest and QUAY_GAP (0.8 m) off her; it runs QUAY_ENDS (3 m) past her bow and her
stern, QUAY_WIDTH (4.5 m) deep, its plank deck QUAY_DECK_UP (1.6 m) over the sea's top, on piles every PILE_STEP (4 m)
down to the bed (PILE_DEPTH, 6 m, at most), none where the ground stands at the deck. Behind it the shore is walked at her
waist in JETTY_STEP (1 m): a bank that meets the deck within STEP_M takes a railed JETTY of JETTY_WIDTH (3 m) JETTY_LAND
(2 m) onto it; dry ground under the deck (a beach) the jetty to it and a RAMP down to the ground at RAMP_SLOPE (0.45) at
most, RAMP_MAX (10 m) long; no land within JETTY_MAX, no jetty - the quay stands alone, a stage moored to a bar.
JETTY_MAX is Iliac Puddle's whole shore fit (SHORE_TERRAIN_FIT_METERS, 180 m) and JETTY_BEACH (20 m) - HARBOUR-BOOK,
below: the jetty is a pier as long as the shelf asks.
A harbour's quays never cross (QUAY-CROSSING, `01-Overview/bugs/Field-Bugs-2026-10-12.md`): a later berth's jetty ends where it
meets an earlier berth's pier (`planQuay`'s `others`, laid in the berths' order by `scenes/quayPool.js`), and
`findHarbour` sounds no berth whose ship and quay overlap an earlier one's (`quayBox`, `boxesMeet`).
On it: a kerb along its face, three iron bollards by her stern, her waist and her bow, a lantern post at each landward
corner with its lantern hung out over the quay, and the port's cargo on its back - crates (some two high) and barrels,
drawn off the harbour's key and the berth's number on QUAY_SALT, clear of the jetty's mouth, the gangway's lane at her
waist (GANGWAY_LANE, 1.6 m each side - AUDIT HOLDINGS Q1), its ends and its face, so every player in the port sees the
same quay. Its ground is read off full-detail pixels alone (the world's `groundAt` - NaN on a coarser stride, the berth
laid again later: Q6), and its harbour is sounded only once every pixel the sounding reads is built (`harbourNear`'s
`ready` - O1: a pixel not built reads as land, and two players coming by different roads found different berths). One
difference stands: Iliac Puddle's Deep Waters is each player's own setting and changes the water a harbour is sounded
off - two players with it set differently find different berths and stand different quays. The model wears the classic ship's own textures (her planking 67_0, its
darker plank 67_8, iron 0_79, a lamp's glass 0_10) out of the player's ARENA2. A ground not built yet lays nothing; the
berth is laid again QUAY_RETRY_S (2 s) later.

**THE PIER'S DRESS** (SHIPYARDS, 2026-10-11, Mac: *"This should also come with a detailed overhaul to piers"*;
`systems/naval/quays.js` `pierDress`, `world/quayModel.js`; `03-World/Shipyards.md`). What a working quay stands besides,
all in its berth's frame: each pair of neighbouring piles in a row crossed by two braces from under the deck's timbers
down toward the water (to 1.1 m under the sea's top at the deepest - BRACE_LOW's 1.2 and a hand; never across a gap where
a pile stood on the bank); joists every JOIST_STEP (1.2 m) under the quay's deck and the jetty's, stringers along their edges; fender piles
about every FENDER_STEP (3 m) down the face past the water (FENDER_DOWN); two iron ladders down into the sea, one each
side of her waist between its bollards, their stiles standing LADDER_GRAB (0.6 m) over the deck to be taken hold of;
iron cleats at the face's ends and by each ladder; a coil of rope by each bollard (the rigging's own 0_77); on a
harbour's first berth a CARGO CRANE at one end of the quay's back - its post clear of the jetty's mouth and the cargo,
its jib swung along the quay toward its middle, its fall and hook hung over two crates stacked (CRANE_HOOK_UP), a winch
at its foot; and on a long jetty a lamp post every JETTY_LAMP_STEP (22 m), the first that far out, on its rails by turns,
each lantern hung in over the jetty and lit with the quay's own two (`lanternLights`, the quays' nearest within their
reach). Every piece on the face keeps its BODY out of the gangway's lane and DRESS_LANE (0.6 m) past it - a fender pile by
its width (FENDER_W, 0.26 m), a coil by its round (AUDIT SHIPYARDS L5-6: a fender's stood 0.055 m in) - so a plank run out
to a ship touches none of it. The dress draws its few turns off its own stream (PIER_SALT): the cargo's load is the one it
always was (pinned to main's own numbers, L5-4). The timbers under the decks (the joists, the stringers, the braces) and
the deck's small fittings (the cleats, the coils) are drawn and never collided - the model's `collider` is the rest, the
bucket the pool files at every recentre (L5-5: all of it went in, 2.5-3.8 times the undressed quay's). A berth's
lanterns' light is made once and again only as the berth moves, off its LIVE place (L5-5: made every night frame, and off
the plan's - where the berth lay when laid, which a recentre left behind).

**THE POOL** (`scenes/quayPool.js`, the world host's): a harbour the world's book holds (`systems/naval/harbourBook.js`
`list` - HARBOUR-BOOK, below) stands
its quays while its mouth is within QUAY_STAND_M (1,600 m) of the player - so they are there as a ship sails in, before
she makes her berth - and comes down past QUAY_LEAVE_M (2,000 m), when the harbour is forgotten or found again (a
transition, a fast travel), indoors, at a re-anchor and at a load. A quay a berth: its mesh drawn in the world pass, its
collider a still bucket of its own - its triangles baked where its berth lies on the sea's top (AUDIT HOLDINGS Q7: a
mover's bucket is never filed in the broadphase, so every ray and sweep asked each quay), stood again where the berth lies
after a recentre (`offsetAll`, after the book's and the naval host's); the player walks its deck, its jetty and its ramp, and a hull
swept against its piles is stopped by them as by a rock. A quay whose mesh would not build is laid again QUAY_RETRY_S
later (Q9). In the lanterns' hours (17:00-08:00) the nearest QUAY_LIGHTS_MAX (6) lanterns within QUAY_LIGHT_REACH
(120 m) light the quay (QUAY_LIGHT_RANGE, 14 m) - scene lights in the boats' own selection (`csaLit`), never the
player's extras, which are never cut (Q3: they took the town's nearest lanterns' slots). Nothing is saved or sent: the
harbour is every client's own off the same terrain.

**ALONGSIDE** (`shipLife.js` `alongside`): every hull lies with her side the gap off the face - a narrower one in toward
the quay by the beams' difference, a galley out - but no quay takes a Large Galley (DOCK_REFUSED - AUDIT HOLDINGS Q2:
93 m against a Carrack's berth, she lay into the next one): she is never warped in nor brought round to one, as the sea's
own galleys never moor. The harbour's own moored ships are stood and eased there (`harbourFrame`, `stepErrand`'s moor), a
packet lying in port too, and a ship summoned from the Fleet is brought round alongside for her own hull
(`freeBerth(hull)`) - "brought round to Sentinel's quay and made fast". No ship of the sea moors into a berth a boat of
the player's or another player's lies at (`berthFree`; one of the player's sailing by takes none), and a ship coming in
looks at her berth again on the way: taken since she chose it, another free berth, else out to sea (Q5 - online, a
`putOff` never reaches a ship another player stands). The berth the player's ship is warped in to is taken from the
warp's first step.

**DOCKING** (`navalHost.js` `warp`, Come Sail Away's `warp` seam in `lateUpdateSailing` - the mod has no quays): at the
helm, her sails struck and no oar pulling, her way under DOCK_WAY (2 m/s) and no hostile ship near, a ship whose
alongside place at a free berth lies within DOCK_REACH_M (25 m), her bow within DOCK_ANGLE (40 degrees) of its line
either way (`dockFor`), is WARPED IN by her hands - eased onto it at DOCK_EASE a second, never faster than WARP_SPEED
(2 m/s), her heading brought round with her, her way and her swing off, the bodies aboard carried. "Your hands warp her
in alongside Sentinel's quay." A ship of the sea only coming in to that berth is sent to another (`putOff`). Within FAST_M
(1.5 m) and FAST_DEG (6 degrees) she lies MADE FAST - "Made fast at Sentinel's quay." - and the Fleet hears it: her card
reads **Made fast** at that port's quay, how far, and from afar the last port it heard of her (`dockPorts`, the world's
`dockedPort`) - "nowhere" said only where it is known, a known harbour's mouth within HARBOUR_STAND of her or she under
way (Q8: harbours are forgotten at every door and jump). A sail set, an oar pulled, she is her helm's again; she casts
off as she gathers way.

**THE GANGWAY** (`gangwayOf`, `quays.js` `gangwayFoot`): while she lies made fast at a quay that is laid (`quayLaid`), a
plank with its lines runs SQUARE to her side at her waist - from where GANGWAY_SIDE says it meets her, measured off her
own colliders: a ship's at her main deck's entry port just off her side, down to the quay's deck in from its face as
far as a climb of GANGWAY_SLOPE (30 degrees) asks, never nearer the face than GANGWAY_CLEAR (2 m - over its kerb and the
bollard at her waist) nor its back than GANGWAY_BACK (1 m) - Mac's galleon's, whose main deck stands 6.2 m up, stops
there and climbs 47.3 degrees (GALLEON-HOLDINGS, `03-World/Come-Sail-Away.md`; `gangwaySide` keeps the mod's galleon's
while she stands in); a boat's from the kerb's outer edge down over the water onto
her gunwale (a Rowboat's lies 1.1 m under the quay: some 49 degrees). Every edge, face and rope of it clears her colliders
and the quay's (AUDIT HOLDINGS Q1: laid to her innermost rail cell, it climbed into her side under her deck on every hull
but the Rowboat's). On foot within GANGWAY_REACH (3 m) of its foot, looking at her, **Activate goes aboard** - over her
rail onto her deck (the boarding's own `landing`, her rail cell by it); on her deck within GANGWAY_ASHORE (1.5 m) of
that rail cell, looking at the land, **Activate steps ashore** onto the quay past its foot, facing the land. The look
within GANGWAY_FACING (cos 0.7) of square. Its word is said once each time the player comes to it, whatever the look
("The gangway to the Sea Witch - Activate to go aboard."). The press is the sea's (`takesActivate`), a struck ship
alongside first - but never over her own helm, hold or door under the ray (Q4: `boatTrigger`, Come Sail Away's trigger
first). Under way, no gangway.

**A SHIP OUT OF SIGHT KEEPS HER BERTH** (BERTH-HIDDEN, 2026-10-04 - found chasing Mac's "The classic style ship is
broken. its two ships clipped inside of eachother", which was the sailing cabin's: `Come-Sail-Away.md` CABIN-HULL). Come Sail Away hides a boat more than a map pixel off, and every boat while the player is
indoors (`UpdateBoatVisibility`); she lies where she lay all the same (FIELD-CSA1: she rides the origin in sight or not).
The berths asked only the boats it shows (`myBoats`), so a ship made fast at a quay was a free berth to the port's roll,
which stands from HARBOUR_STAND (1,200 m off the mouth - two pixels from her, coming in): it moored its own ship at her
berth, and she stood again inside it as the player came within a pixel. A berth asks of every boat of mine placed
outdoors, shown or not (`berthBoats` - a dungeon's, `inside`, lies in its own place), and of another player's boat
hidden under its owner at its helm (`comeSailAwayPeers.js` O4: it stands nowhere and is posed all along) - the roll, the
sea's errands, Summon (`freeBerth`) and the warp (`dockFree`) through `boatAtBerth`. The shots, the fires and the crew
still read the shown ones. `test/systems/naval/berthhidden.test.js`, `tools/mutants/berthhidden.json`.

**THE DOCKS WERE MISSING** (HARBOUR-BOOK, 2026-10-04 - from the field: players reporting the port towns' new docks
missing). Two causes, both fixed at the root. (1) THE HARBOURS WERE THE SEA FIGHT'S: the naval host kept them and sounded
them in its frame alone, which runs only while Come Sail Away and Naval Combat do (`world.js navalOn`) - a player with
either off stood no quay in any port. The harbours are the world's now (`systems/naval/harbourBook.js`
`createHarbourBook`, made once in `world.js` off `navalHarbourNear` and `navalIsWater`): sounded every exterior frame
before the quays stand, whatever runs on the water, moved with the floating origin before the sea and the quays read them,
emptied with the sea at a transition, a jump and a load (`navalTransition`); the pool stands off its `list`, and the naval
host is handed it (`deps.harbourBook`) and reads it - its moored ships, its docking, its errands - never sounding,
moving or emptying it; its own clear forgets which harbours it rolled (their ships went with it), so they stand again.
A naval host made without a book (the suites' sea) keeps one of its own and steps, moves and empties it as before.
(2) THE QUAYS STOOD OUT ON THE WATER: a berth is sounded where the deepest keel floats (4.7 m, GALLEON-2 GN1), and under
Iliac Puddle's Deep Waters - on by default - the floor is lifted toward the sea's top for SHORE_TERRAIN_FIT_METERS
(180 m) off the coast: 3.2 m of water only ~69 m out, 4.7 m ~80. Every berth lay ~92 m off the land, its quay's back ~79,
and the 40 m walk found no shore - every quay a stage alone out on the water, nothing at the town's waterfront (GN1's
40-52 m read the depth without the fit; `03-World/Naval-Combat.md`). JETTY_MAX spans the whole fit now: past it the floor
is carved no shallower than min(11.2 m, Water Depth) (`deepBathymetry.js`), so the deepest keel's berth lies within it at
any Water Depth over her draft. Measured off the real bathymetry and the floor's fit on a straight coast at Water Depth
5-250 m and four bearings: every port a harbour, every quay a pier to the land, the longest 166 m; Deep Waters off, a
9 m jetty as before. `test/systems/naval/harbourbook.test.js`, `tools/mutants/harbourbook.json`.

**A HARBOUR TOWN WITH NO HARBOUR** (FB1020c HARBOUR-REACH, 2026-10-20 - the field: *"a lot of harbor towns dont have harbors
dispite being along the coast"*). Two laws read one sea at two distances. A port town is one the open sea bears on within
SEA_RING (2) map pixels (`world/portSites.js` portTownOnSea - its shipyard, its lighthouse, the harbour board's port), and
its harbour was sounded on the ground the game builds within HARBOUR_REACH (420 m) of its footprint alone. DFU's kernel
(`DefaultTerrainSampler.cs` GenerateSamples, `TerrainHelper.cs` BlendLocationTerrainJob) lays a high coast's shore far
into the sea's pixel, and flattens a town's whole pixel to its mean: measured on the real map (Deep Waters off, the
TileMap's water), 37 of the 106 port towns sounded no harbour at all - Daggerfall, Sentinel and Wayrest among them,
their nearest berths 1,542 m, 721 m and 1,118 m off their footprints; Holwych's town stands at 272 m over a sea pixel
whose shore the kernel lays 1.1 km off. A Bay port whose own shore gives no berth is sounded again out to the ring its
port law read (`systems/naval/harbourBook.js` portRingReach: the pixels within SEA_RING of the town's -
`harbourBook.js:"if (e && !e.harbour && !e.far && far > own && near.ready?.(far) !== false) { e.harbour = sound(far); e.far = true; }"`),
once every pixel of that ring is built (the world's `ready` at any reach - O1's law: never "no harbour" off a
half-streamed ring, the port waits and is asked again each step), and once a book's life (its scan is some five times
the near one's; the B7 retry asks the near reach alone). 36 of the 37 then stand a harbour, its quays at the nearest
shore - up to some 1.6 km from the town. Aldbrugh (Shalgora) sounds none still: OPEN, its port kept. An isle past the
Veil sounds its own reach alone (AUDIT CAPTAIN'S SEA H1). Two things it leaves: the ring's ground is built about a player
within a pixel of the town at TerrainDistance 3 (DFU's default), so a ship come in from the sea to a far shore 2 pixels
off - Daggerfall's - stands its quays once the player has been to the town, never before; and under Deep Waters (on by
default) a berth lies some 80 m farther out, which Daggerfall's 97 m inside the ring's edge was not measured against.
`test/systems/naval/fb1020c_harbourreach.test.js` (the 37 and the one, on ARENA2 - `test/portTerrain.mjs`, the pixel's
TileMap as the build makes it), `tools/mutants/fb1020c_harbourreach.json`.

THE FOUR HOSTS: `scenes/world.js` keeps the harbours, stands the quays and hands the warp; a building's frame
(`worldModes.js`) and a dungeon's (`dungeonContext.js`) have no sea, and the standalone street (`exterior.js`) no harbour.

## 8. Crew roles

Mac: *"Named crew companions should be able to be assigned to certain roles, and be positioned accordingly to their
role"*. A crewed ship's card has a **Crew** panel: her named hands, each with his post, and a list to give him another
(`systems/naval/shipCrew.js` `assign`): `CREW_ROLES` - First Mate, Bosun, Gunner, Carpenter, Lookout, Cook, Deckhand - and
a Bard's calling, which only a Bard keeps and is given back. She has one First Mate: the one she had stands down to
Deckhand. Her roster is signed on for the panel where she has never stood (a laid-up ship's - `navalHost.js`
`crewHands`, crewStep's own sync said to nobody), and her posts ride her crew's record in the save.

**WHERE EACH STANDS** (`systems/naval/crewLife.js` ROLE_POSTS, `postOf`) - on her main deck, each a place of its own
(POST_APART from every other post and from her hatch, where the watch goes below):

| Role | Post |
|---|---|
| First Mate | aft, by her helm, facing forward |
| Bosun | amidships before her mainmast, facing forward |
| Carpenter | beside her hatch, facing it |
| Cook | forward, at her galley's stove, facing aft |
| Gunner | at her guns along her waist - starboard, port, in turn, three a side - facing out over the rail; one past her guns beside one of them |
| Lookout | her bow (SHIP-WATCH, as ever - the first named Lookout; with none, a hand with no post, else the one whose post matters least: LOOKOUT_YIELD - a Gunner, her Cook, her Carpenter, her Bosun - never a First Mate made from her hands while another will do; no roles at all, her first hand past her captain as ever). Never a Bard: `assign` refuses him it and his list leaves it off |
| Deckhand, Bard | where they will (a Bard leads the songs by his calling) |

A second holder of a post stands beside the first; a holder gone (ashore, fallen) holds no place - the next stands at the
post (AUDIT HOLDINGS C8). An idle hand with a post goes back to it most of the time
(POST_SHARE 0.8) and stands there longer (POST_STAND), facing his work; the rest are his own - a job, a talk, a walk -
and nobody draws a man at his post into a talk. Under fire her Gunners hold their own guns while the rest run from post
to post; a muster takes every hand to the rail, the night every hand but the watch below, her colours struck every post
left, as before. With no roles handed in - the sea's ships, another player's - the crew walks where it will, as it did.
Roles are the owner's alone: they ride no word, so on another player's screen her hands walk where they will (O2).
Measured over five minutes on the Small Ship's deck: a hand at his post 40-94% of the time, the same crew with no roles
at those places 0-3%.

**HER FIRST MATE ANSWERS FOR HER** (`navalHost.js` `mateOf`): the hand made First Mate, aboard, speaks her repairs' words
and her orders' answers; with none aboard, her first hand aboard as before.

## 9. Files, tests

`systems/fleet.js`, `scenes/fleetHost.js`, `ui/holdingsPages.js`, `ui/fleetPage.js`, `systems/naval/quays.js`,
`world/quayModel.js`, `scenes/quayPool.js`, `systems/naval/harbourBook.js`; seams in `systems/horse/horseCart.js`,
`systems/comeSailAway/comeSailAway.js` (SummonBoat, LayUpBoat, laidUpHold, the book's seams, the refits' reads),
`systems/comeSailAway/comeSailAwayWire.js`, `scenes/naval/navalHost.js` (fleetStatus, repairAway, refitBoat, freeBerth, the refits' reads),
`scenes/world.js`, `scenes/exterior.js`, `scenes/worldModes.js`, `ui/enhanced/enhancedMenu.js`, `ui/enhanced/enhancedFrame.js`; the quays'
in `systems/naval/shipLife.js` (`alongside`), `systems/comeSailAway/comeSailAway.js` (`warp`), `world/deepWater/deepWaterFloor.js`
(`SHORE_TERRAIN_FIT_METERS`, exported for JETTY_MAX) and `scenes/naval/navalHost.js` (the book read, the docking, the
gangways).

`test/systems/horse/holdings.test.js` (the tab, the Stable, the runtime's summon and send away), `test/systems/horse/fb1015_wagonstabled.test.js`
(WAGON-STABLED: a stabled pair through the real runtime's doors, mounts, summons, sales and saves), `test/systems/naval/fleet.test.js` (the ledger, the
book under Come Sail Away's real runtime, the refits on the helm and the sea, the away repairs, the host half's every act
and refusal, the word's names, the page), `test/systems/naval/crewroles.test.js` (the posts given, their places on the deck and the
crew keeping them against a no-roles control, the First Mate's voice, the Crew panel), `test/systems/naval/quays.test.js` (the quay off a
berth, the shore walked, what stands on it, its model, alongside, docking's law, the pool, the real host's docking and
gangway, Come Sail Away's seam, the Fleet's word, the world's wiring), `test/systems/naval/auditholdings.test.js` (AUDIT HOLDINGS,
`01-Overview/audits/Audit-Holdings.md`: a pin a finding), `test/systems/naval/berthhidden.test.js` (BERTH-HIDDEN: a ship out of sight keeps
her berth), `test/systems/naval/harbourbook.test.js` (HARBOUR-BOOK: the book, the sea reading the world's, the pier across the shelf,
the world's wiring); `tools/mutants/holdings.json`, `tools/mutants/fb1015_wagonstabled.json`, `tools/mutants/quays.json`, `tools/mutants/auditholdings.json`,
`tools/mutants/berthhidden.json`, `tools/mutants/harbourbook.json`.
