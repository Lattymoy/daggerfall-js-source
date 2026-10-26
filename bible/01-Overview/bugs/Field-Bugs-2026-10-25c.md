# FIELD BUGS 2026-10-25c - a big purse dropped into a shared chest made it unreadable for everyone else

Found in passing by CHAMP-BASE (Lattymoy/daggerfall-js-source#1230, its record `Field-Bugs-2026-10-25.md`, FOUND IN
PASSING): a sweep of every honest producer through `validLootList` refused only gold piles of 300,000 to 1,000,000. Read
on main's `80eafd01ff`. The pins are `test/systems/loot/goldwire.test.js` (4), the mutants `tools/mutants/goldwire.json`
(9, all dead). The letter is `c`: `Field-Bugs-2026-10-25.md` is ART-DOLL's on main, and two open pull requests (#1230 and #1232) each add one of that name too.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Gold piles past `LOOT_STACK_MAX` (65,535) are refused by `wireLootItem`/`validLootList` | Online, a purse dropped into a container the room shares - a dungeon's room container, a building's cupboard - was laid in as ONE gold stack, and a stack past the wire's bound is no item on the wire. The room's word about that container then failed `validRoomWord` whole wherever it was read: put in by the room's host, every other player saw "Something in here is from a newer version of the game. Reload to open it." (no reload mends it); put in by anyone else, the host marked the container so for itself, and the put was said again every 1.5 s and never answered | GOLD-WIRE |

## GOLD-WIRE (1) - `src/systems/item/itemTransfer.js`, `src/systems/loot/roomCarriedList.js`, `src/scenes/roomLootHost.js`, `src/world/interior/interiorRoomLoot.js`

THE TRACE, producer by producer (the sweep's piles):

- A purse dropped on the GROUND never rides the wire: a drop is the dropper's (AUDIT WORLD B3), and the room's memory
  carries none. A pile of 1,000,000 there is honest and stays.
- The open zone's remains (`wildDropLaw.js` takeWildGold) are minted by the coin's count up to `GOLD_INT_MAX`, never
  through `validLootList` (REMAINS-GOLD, `Field-Bugs-2026-10-20h.md`; `wildRemains.js:"const mintOne = (/** @type {any} */ r) => {"`),
  and the relay bounds no stack. Already answered.
- The legacy remains' gold is at most `REMAINS_GOLD_MAX`, 2,500 (`legacyLaw.js`). Never past the bound.
- A purse dropped INTO A SHARED CONTAINER is the one that broke. The drop (`planDropGold`, then `addItem(remote,
  goldStack(n))` in both windows) merges into one stack; the room module's settle reads it as a put; the host's
  `judgeRoomClaim` stores it as it comes, and its word's stored record (or the putter's put) fails `validLootList`, which
  makes `validRoomWord` answer null for the whole word. A peer foe's body is not affected: a piece the wire refuses never
  rides it (`bodyLoot.js` shareableRecord).

THE CHOICE (the owner, 2026-10-25, asked between widening gold's bound on the wire and clamping the drop): "Clamping the
drop wouldn't affect players selling items to other players through containers would it? If not, and it's explicitly
only containers that are *shared* with other players and not for example every container in a player's house, then I
think clamping the drop is fine." Both conditions hold: players sell to each other through the market, a home's trader
and the patrons (`net/marketLaw.js`, `net/vendorLaw.js`, `net/patronLaw.js` - the account service's listings), never
through a container; and a home's or an owned house's cupboards keep no room (HOME1, `interiorShared.js` mintInteriorShared).
Splitting the gold into several stacks at the producer cannot work: `addItem` merges them back before the settle reads
the list. Widening the wire's bound for gold would let a forged word land 2.1 billion gold per pile in a shared chest,
where 65,535 lands today.

THE CHANGE:

- The room modules MARK the list they compose (`roomCarriedList.js` markRoomCarried) - the dungeon's at
  `roomLootHost.js:"markRoomCarried(list);"`, a cupboard's at `interiorRoomLoot.js:"markRoomCarried(t.items);"`. That
  list alone is read for puts (a list some load replaced is not, and carries no mark). A leaf module: the planner reaches
  it without the room modules, whose import graph reaches back to the windows.
- `planDropGold` asks whether the remote list is marked (`shared`, by default `isRoomCarried(remote)`) and clamps the
  amount to the room left on the gold stack it lands on (`itemTransfer.js:"export function sharedGoldRoom(remote) {"`:
  `LOOT_STACK_MAX` less the stack `addItem` merges into - PORTAL-BULK's `portalStoneRoom` law, for coin), with a box that
  names the room left, as the wagon's clamp does; a full stack refuses (`sharedGoldFull`) and says so. Both windows
  already show the plan's notice, so neither changed. The ground, the wagon, the bag, a companion's pack, a home's
  cupboard and every offline container take the whole amount, as DFU's do (DaggerfallInventoryWindow.cs:1269-1303).
- The two new lines are the port's own words (`items.gold.sharedRoom`, `items.gold.sharedFull`, `locales/en/Port_Strings.csv`),
  drafted in-session for every other language through `tools/l10nInSession.mjs` (recorded as the machine's).

DFU: DropGoldPopup_OnGotUserInput takes any amount up to the purse into any remote list (DaggerfallInventoryWindow.cs:1269-1303);
DFU has no other player to share a container with. The clamp is a departure, Ledger A (GOLD-WIRE).

THE PINS (`test/systems/loot/goldwire.test.js`): each runs the real chain - the room module (`createRoomLoot`, the bag's
`createInteriorRoomLoot` through `mintInteriorShared`) composes and marks the list, the drop is planned and laid in as
the windows do, the module's frame says the room's word, and `validRoomWord` reads it as another client does. With the
clamp off (mutant `GOLD-WIRE-clamp-off`) the word reads null, the report's symptom. The one link the pins do not run is
the window's: the mark is by the list's identity, and both hosts hand the window the composed list itself - the
dungeon's `openInventory` its `source` (`items: () => lootItems`), a cupboard's arm `items: () => c.items`. The three
PARTY-LOOT harnesses that mount `createRoomLoot`'s text over a scope of its imports (`test/systems/partyloot.test.js`,
`test/net/partyloot_wire.test.js`, `test/scenes/fb1018d_seatloop.test.js`) are handed `markRoomCarried` (PIN MOVED).

NOT CHANGED: a host still stores a put as it comes (`judgeRoomClaim`); no other producer lays a gold stack in a room's
list, so no second check was added there.
