# The Portal Stone - PORTAL1

The owner, 2026-10-04: *"So with the removal of fast travel, I want to implement a new item available at all shops,
this should cost weykar shards (from dismantling gear with rarity). These should always be readily available. When
using this item, it opens a portal allowing you to traverse to anywhere on the map. This is a one use item that stays
open for a short time, allowing multiple players to traverse."* Then: *"Audit this. It needs to be perfect. Also every
current player should recieve x10 of these. They should stack."* (AUDIT PORTAL1, `01-Overview/audits/Audit-PORTAL1.md`;
PORTAL-GIFT, below.)

"Weykar shards" are the **Welkynd Shards** LOOT9 shipped (`06-Systems/Loot-Arc.md` section 11): what salvaging a
laddered piece breaks it into - a Magic 1, a Rare 3, a Legendary 8, an Exalted 15. TRAVEL-ONLINE took instant travel
off the online map (`06-Systems/Travel-Options.md` item 9); IT1 brought it back as a carriage's fare
(`06-Systems/Immersive-Travel.md`). The Portal Stone is the third road: anywhere on the map, for shards, and anyone
near may follow.

Not a DFU member - the port's own (Ledger A, PORTAL1).

## What shipped

| File | What it is |
|---|---|
| `src/systems/gate/gateSpoils.js` | the stone's row: template 572 beside the shard's 571 - bound, stacking with its own kind, the Diamond's art (TEXTURE.254 record 3), miscellany (`UselessItems2`) and never a gem: every Gems piece is a crystal a slot takes, so a gem stone was WORN from the hotbar. `PORTAL_STONE_SHARDS` (5) and the price off it; `portalStones(n)` mints a stack; the gift (`givePortalGift`) |
| `src/net/realm/realmTradeLaw.js` | `BOUND_TEMPLATES` names 572 - the realm's trade service refuses it as the client does |
| `src/systems/portalStone.js` | the laws: the sale (PORTAL-BULK: `buyPortalStones` - `buyPortalStone` is its count of one - `portalStoneMax`, `portalStoneRoom`, `portalStoneRefusal`, `portalStoneRefusalText`, `shardsKept`), the Use's registered arm (`openPortal`), one stone spent, THE HOLDS (`portalHold`), where a portal opens (`portalPlace`), the step in (`portalStepIn`), the wire (`portalWire`, `validPortalRecord`), the words (`PORTAL_TEXT`, `PORTAL_HOLD_TEXT`), the card's lines, every number below |
| `src/systems/reforge.js` | the purse spends a shard unlocked AND unworn (AUDIT PORTAL1 I1) |
| `src/scenes/portalGates.js` | the host's pool: the portals in the WORLD frame, COMPANION-PORTAL's vortex held for each one's time, the step and its forgetting, mine on the wire and a peer's landed |
| `src/scenes/portalFx.js` | the vortex takes `holdMs` (a hold of its own) and `fixed` (stands where it opened), and `remove` - the companions' defaults unchanged |
| `src/ui/merchant/merchantServiceWindow.js`, `src/ui/merchant/merchantRepairWindow.js` | the classic popups' port row under the art (`portalRowRect`, key P, `drawPortalRow`) - the Reforge row's law and its one dark (`guildServiceWindow.js` `REFORGE_ROW_BG`) |
| `src/ui/merchant/merchantServiceDoor.js`, `src/ui/merchant/merchantRepairDoor.js` | the Enhanced Plus panel's button, above Exit |
| `src/ui/native/nativeInventory.js`, `src/ui/enhanced/enhancedInventory.js`, `src/systems/quickslots.js`, `src/systems/useItem.js` | the `openPortal` result routed on every reader - the pack closes and hands the stone to the host's door; a host with none says `USE_PENDING.openPortal` |
| `src/systems/item/itemInfo.js` | the stone's card: what it does and how long it stands, on both skins |
| `src/systems/save/save.js` | the gift's mark (`portalGift`), the gift given at the restore, and `restoresSoFar` - the count every load moves |
| `src/scenes/worldModes.js` | the shop popups' rows built once (`worldModes.js:"  const shopRows = createShopRows({ say: (l) => say(l), mountInterior: (w) => mountInterior(w), mountService: mountServiceWindow });"`) and spread into both popups |
| `src/scenes/shopRows.js` | APPEARANCES (2026-10-27, `04-Characters/Wardrobe.md`): THE COUNTER's row and the counter built once, moved out of `createWorldModes` with the Wardrobe's row beside it (`createShopRows`: `of`, `portalCounter`) - every shop a row, every other building none |
| `src/scenes/portalCounter.js` | PORTAL-BULK: THE COUNTER'S QUESTION AND ITS SALE (`createPortalCounter`: `ask`, `buy`; `portalCountField`) - moved out of `createWorldModes` (HOST-SPLIT), its ceiling down by them |
| `src/systems/inventory.js` | PORTAL-BULK: `findExistingStack` - AddItem's own find (ItemCollection.FindExistingStack), exported so the sale reads the room on the stack it lands on |
| `src/scenes/world.js` | THE USE AND THE PORTALS: `portalHoldNow`, `portalDoorRefusal`, `openPortalStone`, `standPortal`, `portalArrive`, the pool (`portalGates`), its tick and draw, a load's end of it, `portalWord` and the peers' landing, the gift said |
| `src/scenes/exteriorFoes.js` | the foes frame's `pg` field past the room test (`setOnPortals`); an heir's list lands unbound (AUDIT PORTAL1 I4) |
| `src/scenes/exterior.js` | the standalone street's own words |

### The counter

Every shop's keeper - `shopStock.js` `isShop`'s nine kinds (alchemist, armorer, bookseller, clothier, furniture, gem
store, general store, pawn shop, weaponsmith) - carries a row on their popup when its art stands: **Portal Stone (5
shards)**. Both popups a keeper puts up carry it, the plain shop's (GNRC01I0) and the repair shop's (REPR01I0); on the
classic skin it is the port's own row just under the art (neither 130-wide panel has room), key P, closing the popup
first as its sisters do; on Enhanced Plus a button above Exit. A bank's teller and a street merchant with a mod's
service (Immersive Travel's driver) never carry it. A session with no popup art (no ARENA2: the never-trap fallbacks
straight to the trade window) has no row.

A press asks **how many** (PORTAL-BULK, below): the split popup's field - DFU's own howManyItems, "Pick how many items
(max N)?", N the most the purse and the stack allow - seeded with 1, then the offer in DFU's Yes/No box, "Buy 3 Portal
Stones for 15 Welkynd Shards? You carry 23.", and Yes is the sale: five shards a stone the purse may spend out of the
pack (UNLOCKED - a lock is the player's word to keep them - and UNWORN: a shard is a gem a slot can take; `reforge.js`
`shardsHeld`), the stones in as one stack. With one stone to be had the field is skipped and the offer is PORTAL1's,
"Buy a Portal Stone for 5 Welkynd Shards? You carry N."; a purse already short is told at once, naming the shards it
keeps ("You carry 3 you may spend (2 more are locked or worn)"). **Always in stock**: nothing stands on a shelf -
every sale mints its stones - so no keeper runs out, no restock waits a day, and no haggle, holiday or theft touches
it. No carry gate: a stone (0.25 kg) weighs less than its five shards (0.5 kg), so the sale lightens the pack (the
rows' weights, pinned).

### PORTAL-BULK - the count (2026-10-24)

The players, +7: *"I hate that I have to buy portal shards one by one; it would be better to be able to bulk buy
them."* The owner: *"No band aids."* So the count is the sale's own law, not a loop of single sales, and the question
is the one DFU already asks for a count.

- **ONE SALE LAW** (`portalStone.js:"export function buyPortalStones"`): `n` stones for exactly `n` times
  `PORTAL_STONE_SHARDS`, all of it or none of it - `n` a whole number from 1 to the most (`'count'` else), the shards
  (`'shards'`: 5n-1 refuses n, nothing taken), the stack (`'stack'`). `buyPortalStone` is its count of one
  (`portalStone.js:"export const buyPortalStone"`), never a second law.
- **THE MOST** (`portalStone.js:"export function portalStoneMax"`): the floor of the spendable shards over
  the price, and no more than the room left on the stack the stones land on (`portalStoneRoom`): `LOOT_STACK_MAX`
  (`loot.js`, 65,535) less that stack. `addItem` merges with no cap, and `itemLaw.js` flags a stack past
  `LOOT_STACK_MAX` (`'stack'`) - a bulk sale over it would have held an honest player's trading. The stack is read
  off AddItem's own find, `inventory.js:"export function findExistingStack(list, item) {"`
  (ItemCollection.FindExistingStack, exported for it): a LOCKED stack of stones is never landed on, so its room is not
  the sale's - a fresh stack starts beside it. A full stack says so ("Your stack of Portal Stones holds no more than 65,535.").
- **THE QUESTION** (`scenes/portalCounter.js`, `createPortalCounter` - built once by the interior host, HOST-SPLIT:
  `askPortalStone` and `buyPortalStoneNow` left `createWorldModes`, its ceiling down by the 17 logical lines that left).
  The chain is the tavern's room rental's - DaggerfallTavernWindow's field then Yes/No, run by U24's
  `ServiceFlowWindow` (`guildServiceWindows.js:"export class ServiceFlowWindow {"`), as
  `tavernWindow.js:"export const DAYS_FIELD"`
  rents a room. The field is the split popup's (`itemTransfer.js:"export const HOW_MANY_ITEMS"`, its parse
  `parseSplitAmount`: "0", past the most and "3x" end the chain with nothing taken, as SplitStackPopup_OnGotUserInput
  moves nothing), **seeded with 1**. Escape on the field, No or Escape on the offer, take nothing. Both skins take the
  count from the one window: the field box is THE ONE DaggerfallInputMessageBox (`inputMessageBox.js`, in the
  enhanced field's face under Enhanced Plus) and the offer DFU's message box (the enhanced dialog there); the popups'
  row and the panels' button are unchanged - they close and call `onBuy`.
- **DEPARTURES, NAMED.** DFU sells no such item - the Portal Stone, its counter and its count are the port's own
  (Ledger A, PORTAL1). The field departs from the split popup it borrows in one thing: DFU seeds that box with its max
  (TransferItem, DaggerfallInventoryWindow.cs:1523-1536), so a stray Return moves what the player still owns; here a stray
  Return would spend a purse, so the seed is the tavern's day count's, 1 (DaggerfallTavernWindow.cs:166-168).
- **WORDS** in the player's language: `portal.buy.ask`, `portal.buy.bought` and `portal.buy.full`, their counts ICU
  plurals; the field's label is DFU's own `howManyItems`. Drafted in-session in all 25 languages.

NOT ON A SHELF, AND WHY. A shelf is the gold trade's: the price, the haggle, the steal, the counter's cost strip and
the online room's shared shelf all speak gold, and a bound piece on a shelf is stripped from the room's record
(`itemBound.js` unbound). A shard price inside the trade window would have meant ten gold-only seams on two skins; a
row on the keeper's popup is the Reforge's and the Broker's shape - an item purse beside the gold one.

The row stands with Loot Rarity off too (the owner: "always readily available"): offline with the ladder off nothing
salvages, so it asks and refuses; online the ladder is the room's and on.

### The holds

One ladder (`portalHold`), asked by the door, by the pick and by the step, in its order: **dead or a move under way**
(said at the door and the pick, silent at the step - a teleport's own frames), **a duel** (an arena bout's hold with
it), **a siege's room** (its wards: Teleport, Recall and Levitate do nothing there), **an enemy near** (the travel map's
own pool: the street's foes and watch, a hostile ship), **a journey** (Travel Options' autopilot or the Overworld's
view). A portal is never a way out of what the travel map refuses to leave.

**The open zone** (AUDIT TESA II Z5): a stone's portal is a teleport, and PVPDUNGEONS' law holds every teleport of any
kind out of Cyrodiil's zone, online - the guild's, Recall's, a party's journey to its leader (`world.js` wildTeleportRefused,
`Wild-Zone.md` section 25). So the door refuses inside the zone, the pick refuses a place in it, and THE STEP refuses a
portal into, out of or inside it whoever opened it - each traveller's own journey, said in the zone's words, nothing spent
at a refused door or pick. Since TESA-NO-FAST the stone's portal is the
way past the Bay, and Cyrodiil's cities are its picks; until this the stone was the one teleport the zone's law never
asked. The Veil's own refusal stands beside it (AUDIT CAPTAIN'S SEA P6). THE FOUR HOSTS: `scenes/world.js` wired (the door,
the pick, the step - its alone); `scenes/worldModes.js` and `scenes/dungeonContext.js` open no portal (a building's pack
refuses in words, a dungeon's has no door) and `scenes/exterior.js`'s street says its own - none to wire.

**The settlements** (WILD-CITY-PORT, 2026-10-28; `Wild-Zone.md` section 28): a city, town or village in the zone is the
exception - its streets or a building of it a door, its place a pick and a step's end. On the stone's map a press on a
city in the zone picks it, where ZONE-ZOOM had opened the zone map. Its open country, its halls and its dungeons stay
refused, in words that name the open ends ("In Cyrodiil you can teleport only to or from a city, town or village. Walk
or ride its roads.").

**PVP-PORTAL** (2026-10-30, the owner: "they need to work all over"; `PvP-Rework.md` PVP-PORTAL): the two paragraphs
above are history for the stone. It asks none of the zone's law, flagged or not - door, pick and step, into, out of
and inside the zone (`portalStoneHost.js:"const teleportRefused = (to) =>"`). In the zone it is held only by the combat
lock and a monster alerted to me ("agro or flag time cool down"; the owner's pick "Only one attacking me"). The
guild's teleport and Recall keep the zone's law.

### The use

The pack's Use - either skin - or a hotbar press hands the stone to the host's `openPortal` door. Only the open world
has one (`world.js`): a building's pack is that host's too, and refuses - "A portal can only be opened under the open
sky."; a dungeon's has no door, and the reader says the same; the standalone street says its own. The door asks the
holds, then: not in the water, not on a boat's deck (a portal stands in the world's frame and would be sailed away
from), one portal of mine at a time, a map to choose on.

The travel map opens in TELEPORT mode - the Mages Guild's, classic or held, with no Travel Options fee (the stone is the
fare) - so the picks are the places the map shows. The pick asks the whole door again (the world moved on while the
map stood), then finds the place (`portalPlace`): `PORTAL_AHEAD` (2 m) along the camera's forward, brought in short of a
wall by `PORTAL_WALL_GAP` (0.6 m) but never nearer than `PORTAL_MIN_AHEAD` (1.2 m - else "no room"), on the ground
found within `PORTAL_GROUND_PROBE` (3 m) under a metre over the feet (else "no ground"). Any refusal spends nothing.
Then ONE stone is spent - from the list it came from: the pack, the wagon, a companion's storage - the rest of the
stack kept, and the portal tears open. The classic teleport box smashes the screen to black for an arrival; there is
none yet, so that black lifts; the held map smashes nothing and nothing is faded there.

### The portal

COMPANION-PORTAL's violet vortex (`portalFx.js`), fixed where it opened and held for `PORTAL_OPEN_MS` (30 s): it tears
open, stands, and seals as its time runs out. It is kept in the WORLD frame (the camps' wire converters), so the
floating origin moves nothing and a portal behind a teleport stays where it was.

**Anyone who walks into it arrives** - within `PORTAL_REACH` (0.9 m) across the ground and `PORTAL_REACH_Y` (2 m) in
height - through the Mages Guild's arrival (`world.js` teleportTo: free, at once, a start marker of the place), the
screen black at once and the teleport a microtask on (off the frame's own draw), the following team's cache around it
(HCC), and a failed arrival lifting the black. An entry is a STEP from outside to inside (`portalStepIn`), and THE STEP
IS FORGOTTEN across any gap: frames more than `PORTAL_STEP_GAP_MS` (250 ms) apart - a building, a dungeon, where the
frame returns before the portals - feet that jumped `PORTAL_STEP_JUMP` (1.5 m) between frames - a door, a teleport, a
respawn - and every change of place the host makes (`forgetSteps`). So a portal that opens on top of someone, or stands
outside the door they come out of, takes nobody: only a step in. The opener stands outside their own (it opens at least
1.2 m away, reach 0.9) and walks in like anyone. A sealing portal (its last `PORTAL_MS.close`) takes nobody. A step in a
hold is said ("You cannot use a portal with enemies nearby.").

**A load ends every portal standing** - the save's pack is the truth. Every load, whichever host runs it, passes the
one door (`save.js` restorePlayer), which counts it (`restoresSoFar`); the world's frame ends the portals on the
count's move.

### Online

The opener's foes frame carries the portal - `pg`, `portalWire`'s shape: its id, where it stands (the world frame),
the destination's PIXEL and the milliseconds left - on every FULL frame while it stands and the opener stands within
`PORTAL_SAY_REACH` (32 m) of it, and opening one owes the next frame full, so the cell hears of it at once. It is the
camps' and the duel ring's road: the relay reads nothing inside a foes frame, so no relay change and no RELAY_VERSION.
The frame reaches the players the relay fans it to - in range of the opener (3 map pixels), across a cell's edge by the
halo - and goes quiet while the opener is alone in the room.

A peer's word lands through `validPortalRecord` - a field outside its law refuses the record whole - and is BELIEVED
only within `PORTAL_PEER_REACH` (40 m) of the opener's own feet as this player sees them (no feet, no portal: AUDIT
PORTAL1 O1 - a crafted peer stood portals in front of walking players). The destination is NAMED off the receiver's
own map (`mapDirectory.js` locationSummaryAt, the location's own name); a pixel with no place refuses it. One portal
an opener: another id while the first stands is refused; the same id said again keeps its look and never runs longer
than first said (O2: a word said again had kept one open for ever, unseen). A peer's portal stands on this player's own
ground when that is found within `PORTAL_REGROUND` (4 m) of the opener's height. **A peer's copy is kept to its own
time**: the opener stepping through, walking off or going indoors closes nothing for the rest - a frame without `pg`
leaves the copy to run out. A late arrival in the cell learns of a portal only while its opener still stands within
32 m of it.

### An event's gate keeps its way clear (RPT1026-EVENTS GATE-WAY, 2026-10-26)

Two private reports: players opened portals at the mouth of a breach or another event to carry the arriving crowd elsewhere, and
one walled a breach's gate with a parked wagon and laid a portal in it as the gate opened, more than once. A portal takes
whoever steps in (above), and a crowd running at a
Dagon's Breach as it opens runs into whatever stands before its fire.

**The rule.** While an event's gate stands on this screen, no Portal Stone's portal stands within `EVENT_GROUND_M`
(40 m, on the ground) of it:
- **The opener's pick refuses the place** - `portalStonePlace` (portalPlace's place, then the ground asked) answers
  `refused: 'event'`, *"A portal cannot open this close to an event's gate."*, and no stone is spent. The world host's
  pick asks it (`scenes/world.js` standPortal).
- **A peer's word of one there is not believed** (`scenes/portalGates.js` applyOwner) - a modified opener's pick is not
  the law on another screen.
- **One already open closes** when a gate rises beside it, taking nobody (portalGates.js tick: dropped before its step
  is asked).

**The gates.** Each pool that stands an event's gate says where it stands, under its own name, once
(`systems/eventGround.js` `setEventGround`): the Dagon's Breach (`scenes/gate/gatePool.js` - the gate's foot, rising to
collapsing), an Elite Breach's arch (`scenes/eliteGates/egArch.js` - every arch the pool stands) and a fallen star's
heart (`scenes/starfall/starfallHost.js` - falling and fallen). The laws ask `eventGroundAt`. A leaf, the construction
seam's shape (`systems/questlines/qlActs.js`'s sink): no host grew for it.

**The authority is every screen's.** A portal is its opener's word in the foes frame, which the relay never reads, and
what a portal does is done on the screen that steps into it. So each screen judges by the gates it stands, and a modded
opener cannot reach a screen past that screen's own law. The relay is not touched.

**Not the call's portal.** An Elite Breach's call opens its own portal by `portalPlace` alone, and its pool keeps no
ground (`createPortalGates({ eventGround: false })`, `scenes/eliteGates/egCall.js`): it is the way into the event.

**A caravan.** A peer's wagon never walls anything (PR-WAGON1: no peer's wagon stands in my collider), but parked
across a gate it hid the fire and the portal laid inside it. Another player's parked wagon on an event's gate's ground
is not drawn on this screen, nor its team, nor pressed (`scenes/horseCartPool.js` `offGround` - as a concealed owner's
are not). My own parked there draws: it is mine to move. (`06-Systems/Horse-Cart-And-Cargo.md`, GATE-WAY.)

Not a DFU member: Daggerfall has no portals, no world events and no other players. Ledger A (GATE-WAY). Pinned by
`test/scenes/rpt1026_events_gateway.test.js` (7): the law; the real gate pool's ground; the stone's pick refused and
the call's kept; a peer's word refused, a standing one closed, past the ground believed; a peer's parked wagon in the
gate not drawn while mine and a far one draw; the real arch pool's ground from a signed call; the real starfall
host's ground while a star stands fallen. `tools/mutants/rpt1026_events.json` (GATE-WAY, 11).

### The gift (PORTAL-GIFT)

*"Every current player should recieve x10 of these. They should stack."* Every character that already exists is
given **ten** Portal Stones (`PORTAL_GIFT_STONES`), once - LOAN-AMNESTY's shape (`banking.js` forgiveLoans). A
character's `portalGift` says which gift it has had: a save written before the gift carries no mark (0) and every
save written after carries the mark (`save.js` snapshotPlayer), so a character made after the gift is born past it, and
one given it is never given it again. Given as the save is restored (`save.js` restorePlayer - every load, offline and
online, the realm's boot among them), below the relinks and the stones' fold, onto the pack's own unlocked stack of
stones (`addItem`: they stack; a locked stack is left alone and the gift is its own stack beside it), and said once the
world stands: "You have been given 10 Portal Stones. Use one to open a portal to anywhere on the map." Client only, as
the amnesty is: a bound piece the realm's service never weighs (`realmGoldLaw.js` counts gold alone), and the stones
reach it with the next checkpoint. Offline, each slot is its own timeline: a slot saved before the gift gives its ten
the first time it is loaded.

### The four hosts

- `scenes/world.js` - WIRED: the open world's door, the pool, the step, the frame's word and the peers' landing, a
  load's end of the portals, the gift said. Since PORTAL-BAY the door, the pick and the step's arrival are
  `scenes/portalStoneHost.js` (`createPortalStoneHost`), which world.js constructs where they stood and hands its own
  teleport and gates.
- `scenes/worldModes.js` - WIRED: the counter (interiors - the streaming world's and the fixed city's, both built by
  it; PORTAL-BULK: its question and sale in `scenes/portalCounter.js`, built once here). A building's pack is world.js's,
  whose door refuses indoors.
- `scenes/dungeonContext.js` - by design no door: a portal is the open sky's; the reader says why. Its own loads pass
  the restore's count, so they end the portals outside too.
- `scenes/exterior.js` - the standalone `?exterior` street has no streamer and no travel map (its Recall refuses
  another pixel for the same reason): its door says its own words.

## PORTAL-BAY - a teleport is no journey (2026-10-26)

The owner, 2026-10-26, playing the release branch: *"attempting to teleport anywhere outside the bay with the portal
stone leads to a black screen and a prompt telling you cannot travel"*, then *"it wasnt letting the user teleport to a
city either"*, and for the fix: *"No band aids for any of this."*

**The cause.** AUDIT TESA II P4 (2026-10-25, `03-World/Arena-Provinces.md` TESA-NO-FAST) put the journey's law past the
Bay (`systems/travel/pastBayTravel.js` pastBayJourney) at the gate every journey passes (`world.js` wildTravelGate). The
guild's teleport (`teleportTo`) passes that gate too - WILD3 had made it ask the open zone's journey law - and the
Portal Stone's step arrives THROUGH teleportTo, and Recall asks the same gate. So from P4 on, every teleport to a pixel
past the Bay was refused as fast travel, each of the seven capitals the stone's map offers among them: "No road the Bay
knows leads there. The land past the Iliac Bay is walked, or reached through a Portal Stone." - the very road the line
names. The order made it a black screen: the pick never asked that gate (the stone spent, the portal open), the step
blacked the screen (`portalArrive`), and teleportTo refused and returned without throwing - and only a throw lifted the
black. Reproduced in Node over world.js's own portalArrive, teleportTo, wildTravelGate and pastBayJourney: a pixel of the
Bay jumped; 1800,600 said the refusal, jumped nowhere and left the screen at full black.

**The fix.** A teleport's verdict past the Bay is not a journey's: `pastBayTravel.js` teleportJourney answers the open
zone's own verdict (its into-and-out-of law stays PVPDUNGEONS', `wildTeleportRefused`; the Veil's stays the Veil's), and
`wildTravelGate` takes the law as its third argument - a journey's (`pastBayJourney`) unless the caller is a teleport.
teleportTo and Recall hand `teleportJourney`; fast travel, a party's journey to its leader, a rider's in a wagon and the
Overworld pass since TRAVEL-EVERYWHERE. The stone's host asks ONE gate (`portalStoneHost.js` teleportRefused -
teleportTo's own three, in its order) where a refusal still costs nothing: at the pick, before a stone is spent, and at
the step, BEFORE the black - said, and the screen never blacked. teleportTo answers whether it arrived, and an arrival
that does not come (the world moved on between the step and the teleport) lifts the black. A stone's portal to a city past
the Bay now arrives as one in the Bay does: the step blacks the screen, the world is rebuilt at the city's pixel and the
player stood by its start markers (`_teleportToPixel` with RandomStartMarker, the guild's own arrival), the black fades
in, "You arrive at Imperial City." HOST-SPLIT: the stone's door, pick and step (`portalHoldNow`, `portalDoorRefusal`,
`openPortalStone`, `standPortal`, `portalArrive`) moved out of `bootWorld` verbatim (`tools/hostMove.mjs`) to
`scenes/portalStoneHost.js`, and the change went in there (`01-Overview/Host-Split.md` PORTAL-BAY).

**What the stone's map offers past the Bay** (TESA13, TESA-NO-FAST): a portal's end at a city the world stands - the
seven capitals (Solitude, Mournhold, the Imperial City, Helstrom, Torval, Falinesti, Alinor) and, with the player's
Arena folder attached, Arena's places the world stands (`ui/tamrielInk.js` arenaInkCities); a press on bare land past the
Bay picks nothing. Online the Imperial Province is the open zone (Cyrodiil), and its places are refused at the pick, in
words, nothing spent. (Since PORTAL-ANYWHERE, below, any land past the Bay.)

## PORTAL-ANYWHERE - any land past the Bay (2026-10-26)

Asked, after PORTAL-BAY, whether the stone should reach any point past the Bay (the owner had said *"anywhere outside the
bay"*), the owner chose: *"Anywhere on land"*. And for how: *"No band aids for any of this."*

**A departure from TESA-NO-FAST, for the Portal Stone alone** (`01-Overview/Port-Ledger.md`, PORTAL-ANYWHERE). TESA13 kept a
portal's ends past the Bay to the cities; the stone's map now picks any land there. The guild's teleport map picks no
bare land (TRAVEL-EVERYWHERE, 2026-10-28: any place past the Bay, as a Bay place is), every journey past the Bay is a Bay
journey since TRAVEL-EVERYWHERE retired TESA-NO-FAST (`03-World/Arena-Provinces.md`), and the Bay's own map is the Bay's (its places are the stone's picks there; a bare pixel of the Bay's
wilderness is not one).

- **The pick** (`ui/heldMap.js` `_pickAt`): the stone's door builds its map with `portalLandPastBay`
  (`scenes/portalStoneHost.js`), and on it a press past the Bay that is no city's is the pixel under it where the land's
  own law calls it land (`systems/travel/pastBayTravel.js` portalLandAt - `world/tamriel/tamrielLand.js`
  provinceKeyBeyondBay, the law the world's ground and the sheet's ink read), named by its province ("Skyrim"), as a
  peer names a portal's end off its own map. The sea picks nothing. The hover points at it; a quest's place past the Bay
  (START3's pick) is a portal's end on it. Then the stone's road as PORTAL-BAY's: the teleport's gate at the pick (online,
  Cyrodiil's land is the open zone's and refused, nothing spent), one stone, the portal, the step, the black.
- **The arrival** (`scenes/world.js` `_teleportToPixel`): the world rebuilt at the pixel as every teleport's. A place standing
  there (a village of the land's, a lair, an Arena town) lands the traveller by its start markers as ever. Where none
  stands - DFU's PositionPlayerToLocation "fail back to terrain origin", the pixel's centre - the landing must be SAFE
  ground (`player/enterExit.js` safeGroundAt): at or above the water (the sea's floor, a lake's bed, is none), LEVEL (the
  terrain `LANDING_LEVEL_REACH`, 2 m, out on four sides within `LANDING_STEEP`, 1.5 m, of the feet - a cliff's face or lip,
  or a rock's top, is none) and open (UNSTUCK-OUT's law: no solid holding the feet or the head, the torso clear). Where it
  is not, the nearest that is, on UNSTUCK-OUT's rings out to 256 m (`safeGroundNear` - openGroundNear asked for level
  ground too); with none, the landing stands. Only a teleport's landing with no place (RandomStartMarker and no location)
  asks it: a place's start markers, a respawn, a load, a fast travel land as before. The ceiling: no logical line added
  to `bootWorld` (the question rides UNSTUCK-OUT's own).

What a player sees: use a Portal Stone, zoom out past the Bay, press anywhere on the land - "Skyrim" is picked, Yes, a
portal tears open; step in, the screen blacks, the world builds there and the traveller stands on dry, level ground near
the pixel's centre; "You arrive at Skyrim."

## Calls made here, put to the owner

- **The price: 5 shards** - five Magic pieces salvaged, or two Rares (with one over). The Reforge's Magic line is 2,
  a Rare's 4. A constant (`PORTAL_STONE_SHARDS`).
- **The time: 30 seconds** (`PORTAL_OPEN_MS`).
- **The destinations: the places the map shows** - the guild teleport's picks; a bare pixel of wilderness is not one.
  Past the Bay, since PORTAL-ANYWHERE (the owner: "Anywhere on land"), any land.
- **Bound**: the shards that buy it are, so the stone never carries their worth to another player.
- **No sun rule, no quest offer**: the guild teleport asks neither, and the portal arrives through it.
- **The holds**: a portal opens and is entered under the travel map's own refusals (enemies, a duel) and a siege's
  wards and a journey's; it is no escape from them.
- **The gift is for characters that exist**: a character made after it is born past it, as the amnesty's.
- **PORTAL-BULK: the count** - as many as the purse and the stack allow, asked before the offer, the field seeded with 1
  (never the most); no bulk price - five shards a stone, however many.

## Pinned

`test/systems/portal1_stone.test.js` (15): the row, the counter (the boundary, the locked and the worn, the words), the use on
every reader, the numbers and the holds and the place, the step, the wire (the producer's own record in the host's
units), the vortex held, the pool (mine through the host's own x40 frame and a moving origin, the step forgotten, the
holds; a peer's believed near its opener, one an opener, never longer, on my ground), the door, the pick and the
arrival run from world.js's own source, the classic popups' row and the panels' button, and the hosts. PORTAL-BULK's
three: the law (n prices exact for n = 1, 2, 3, 7, 5n-1 refused with nothing taken, the floor, the locked and the worn
untouched, the count's refusals, one stone the same law), the stack cap (the room, a full stack lawful and one past it
flagged, a locked stack never landed on) and the question run whole (the field and its seed, the offer, Yes buys n,
Escape and No take nothing, the parse's refusals, one stone skipping the field, none said at once, a sale refused at
the Yes). `test/systems/portal1_gift.test.js` (3): the gift's law, its mark through the save, and the hosts.
`tools/mutants/portal1.json` (110, all dead - PORTAL-BULK's 18 among them: price x n -> price at the refusal, the
spend and the offer, floor -> ceil, the cap off by one and off, the room off by one and read off the locked stack,
`portalStones(n)` -> `portalStones(1)`, a count of none, the field seeded with the most, the parse unbounded, one stone
asking the field, Yes buying one, No buying, the line said for one, the full stack said as short, the host's row
unwired; and three re-aimed by content: the refusal's boundary, the sale's spend, and the short purse at its new home).
PORTAL-BULK moved by content too: `findExistingStack` out of `addItem`, so `fb0929d_booksplit.json`'s,
`townecon5.json`'s and `auditlwii2_service.json`'s records on addItem's merge follow its lines (4 of 4 dead, with
`townecon.json`'s); `test/scenes/hostceiling.test.js`'s createWorldModes ceiling 11,039 -> 11,022; and
`test/systems/l10n4_hardcoded.test.js`'s portalStone.js count 23 -> 21. Along the way (PORTAL1 and its audit), pins moved by content: the two mounted foes streams
(`test/systems/csa_together.test.js`, `test/scenes/audit0928_online.test.js`) stub `portalWord` as they stub every word on the line;
U61's count of openers gated on the travel map's door is four (`test/ui/heldmap.test.js`); AUDIT REALM F1's bound list
reads the row (`test/systems/auditrealm.test.js`); and mutant records re-aimed - `auditrealm.json`'s and `loot9.json`'s bound
lists, `loot9.json`'s purse and spend at the one `spendable` law, `survtiers.json`'s potion cite and
`survtiers3.json`'s two world-seed cites and its rest-window cite (each a cite the shift moved).

PORTAL-BAY: `test/systems/portalbay_stone.test.js` (4) - every capital past the Bay the stone's map offers, from the Bay
and from one capital to another, run whole: the held map's press (`_pickAt`, teleport mode), the stone's host as world.js
constructs it, the portals' step, and world.js's own teleportTo and gates down to the rebuild (`_teleportToPixel`, asked
with the city's pixel and RandomStartMarker, under the black), the black fading in on "You arrive at"; a refused pick
(the zone's city online) said, nothing spent, never blacked; a refused step (the zone's, the Veil's) refused before the
black; an arrival that does not come lifting it; teleportTo's answer; Recall to an anchor past the Bay; the journeys still
refused; and the wiring. `tools/mutants/portalbay.json` (11, all dead). Pins moved by content: the PORTAL1 door, pick and
arrival pin reads the stone's host (`portal1_stone.test.js`), EG-H2's sweep finds the door there (`egmade_law.test.js`),
P4's wiring reads the gate's law argument (`audittesa2p_hosts.test.js`), AUDIT 68's busy question reads teleportTo's
`return false` (`audit68_worldjs.test.js`), AUDIT CAPTAIN'S SEA's Veil doors read the stone's host and its one gate
(`auditcaptsea.test.js`); mutant records re-aimed by content - `portal1.json`, `audittesa2z.json`, `auditcaptsea.json`,
`egmade.json`, `audittesa2p.json`, `hostsplit.json` (21 judged, all dead). PORTAL-ANYWHERE's two in the same file (6 in
all): the stone's map picks land beside three capitals and the portal goes there whole (the press, the stone, the step,
teleportTo, the rebuild under the black, "You arrive at Skyrim."), the sea picks nothing, the guild's map and the travel
map no land, a quest's place a portal's end on the stone's map alone, the hover, the zone's land refused at the pick; and
world.js's own landing cut whole over a terrain of the test's - off a lake onto the shore, off a cliff's lip onto level
ground, flat ground kept, a place's markers and a respawn's landing untouched - with the laws themselves.
`tools/mutants/portalbay.json` 25 (PORTAL-ANYWHERE's 14 among them), all dead. Pins moved by content: UNSTUCK-OUT's landing pin reads the question
both arrivals ask (`test/player/unstuckout.test.js`), TESA2's map pin the press's portal's end and the hover's pointer
(`test/tesa2_arena.test.js`) and TAMRIEL1's sweep the same arm (`test/ui/tamriel.test.js`); mutant records re-aimed by content - `unstuckout.json`, `tamriel.json`, `tesa2.json`,
`auditstarts.json` (6, all dead); `01-Overview/bugs/Field-Bugs-2026-10-19f.md`'s anchor on the landing re-anchored.

NOT SEEN: the portal in a browser, two players stepping through one, and the classic row on screen. No ARENA2 in the
container that built it. PORTAL-BULK: the count's field and the offer on either skin's screen - the chain is run whole
in Node, through the window both skins draw.
