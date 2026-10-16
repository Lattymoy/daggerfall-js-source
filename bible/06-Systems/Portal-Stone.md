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
| `src/systems/portalStone.js` | the laws: the sale (`buyPortalStone`, `portalStoneRefusal`, `shardsKept`), the Use's registered arm (`openPortal`), one stone spent, THE HOLDS (`portalHold`), where a portal opens (`portalPlace`), the step in (`portalStepIn`), the wire (`portalWire`, `validPortalRecord`), the words (`PORTAL_TEXT`, `PORTAL_HOLD_TEXT`), the card's lines, every number below |
| `src/systems/reforge.js` | the purse spends a shard unlocked AND unworn (AUDIT PORTAL1 I1) |
| `src/scenes/portalGates.js` | the host's pool: the portals in the WORLD frame, COMPANION-PORTAL's vortex held for each one's time, the step and its forgetting, mine on the wire and a peer's landed |
| `src/scenes/portalFx.js` | the vortex takes `holdMs` (a hold of its own) and `fixed` (stands where it opened), and `remove` - the companions' defaults unchanged |
| `src/ui/merchant/merchantServiceWindow.js`, `src/ui/merchant/merchantRepairWindow.js` | the classic popups' port row under the art (`portalRowRect`, key P, `drawPortalRow`) - the Reforge row's law and its one dark (`guildServiceWindow.js` `REFORGE_ROW_BG`) |
| `src/ui/merchant/merchantServiceDoor.js`, `src/ui/merchant/merchantRepairDoor.js` | the Enhanced Plus panel's button, above Exit |
| `src/ui/native/nativeInventory.js`, `src/ui/enhanced/enhancedInventory.js`, `src/systems/quickslots.js`, `src/systems/useItem.js` | the `openPortal` result routed on every reader - the pack closes and hands the stone to the host's door; a host with none says `USE_PENDING.openPortal` |
| `src/systems/item/itemInfo.js` | the stone's card: what it does and how long it stands, on both skins |
| `src/systems/save/save.js` | the gift's mark (`portalGift`), the gift given at the restore, and `restoresSoFar` - the count every load moves |
| `src/scenes/worldModes.js` | THE COUNTER: `portalRow` / `askPortalStone` / `buyPortalStoneNow` |
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

A press asks first - DFU's Yes/No box, "Buy a Portal Stone for 5 Welkynd Shards? You carry N." - and Yes is the
sale: five shards the purse may spend out of the pack (UNLOCKED - a lock is the player's word to keep them - and UNWORN:
a shard is a gem a slot can take; `reforge.js` `shardsHeld`), a fresh stone in. A purse already short is told at once,
naming the shards it keeps ("You carry 3 you may spend (2 more are locked or worn)"). **Always in stock**: nothing
stands on a shelf - every sale mints a stone - so no keeper runs out, no restock waits a day, and no haggle, holiday or
theft touches it. No carry gate: the stone (0.25 kg) weighs less than its five shards (0.5 kg), so the sale lightens
the pack (the rows' weights, pinned).

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
  load's end of the portals, the gift said.
- `scenes/worldModes.js` - WIRED: the counter (interiors). A building's pack is world.js's, whose door refuses indoors.
- `scenes/dungeonContext.js` - by design no door: a portal is the open sky's; the reader says why. Its own loads pass
  the restore's count, so they end the portals outside too.
- `scenes/exterior.js` - the standalone `?exterior` street has no streamer and no travel map (its Recall refuses
  another pixel for the same reason): its door says its own words.

## Calls made here, put to the owner

- **The price: 5 shards** - five Magic pieces salvaged, or two Rares (with one over). The Reforge's Magic line is 2,
  a Rare's 4. A constant (`PORTAL_STONE_SHARDS`).
- **The time: 30 seconds** (`PORTAL_OPEN_MS`).
- **The destinations: the places the map shows** - the guild teleport's picks; a bare pixel of wilderness is not one.
- **Bound**: the shards that buy it are, so the stone never carries their worth to another player.
- **No sun rule, no quest offer**: the guild teleport asks neither, and the portal arrives through it.
- **The holds**: a portal opens and is entered under the travel map's own refusals (enemies, a duel) and a siege's
  wards and a journey's; it is no escape from them.
- **The gift is for characters that exist**: a character made after it is born past it, as the amnesty's.

## Pinned

`test/systems/portal1_stone.test.js` (12): the row, the counter (the boundary, the locked and the worn, the words), the use on
every reader, the numbers and the holds and the place, the step, the wire (the producer's own record in the host's
units), the vortex held, the pool (mine through the host's own x40 frame and a moving origin, the step forgotten, the
holds; a peer's believed near its opener, one an opener, never longer, on my ground), the door, the pick and the
arrival run from world.js's own source, the classic popups' row and the panels' button, and the hosts.
`test/systems/portal1_gift.test.js` (3): the gift's law, its mark through the save, and the hosts. `tools/mutants/portal1.json`
(92, all dead). Along the way (PORTAL1 and its audit), pins moved by content: the two mounted foes streams
(`test/systems/csa_together.test.js`, `test/scenes/audit0928_online.test.js`) stub `portalWord` as they stub every word on the line;
U61's count of openers gated on the travel map's door is four (`test/ui/heldmap.test.js`); AUDIT REALM F1's bound list
reads the row (`test/systems/auditrealm.test.js`); and mutant records re-aimed - `auditrealm.json`'s and `loot9.json`'s bound
lists, `loot9.json`'s purse and spend at the one `spendable` law, `survtiers.json`'s potion cite and
`survtiers3.json`'s two world-seed cites and its rest-window cite (each a cite the shift moved).

NOT SEEN: the portal in a browser, two players stepping through one, and the classic row on screen. No ARENA2 in the
container that built it.
