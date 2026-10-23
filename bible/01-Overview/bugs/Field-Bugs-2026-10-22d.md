# FIELD BUGS 2026-10-22d - a shop's shelf heard a sale the record never saw

One private report, handed over by the owner as a screenshot of a direct message with no word beside it (SECURITY.md: an
exploit is told privately and recorded with its fix, never before). The reporter: "If you make a save before selling an
item, sell it, then alt+f4, a save will fail to occur. Then, once you reload, you still obtain the item, and a duplicate
will be available on the shelves in exchange for gold", and "This also works the reverse way to remove an item from
stores without having to buy it. Which is a possible griefing method." The reporter and their accounts are not named
here. Read on main's `a61d01901`. Named 22d: main's `-22`, `-22b` and `-22c` took the first three. The pins are
`test/world/interior/fb1022d_shelfhold.test.js`, the mutants `tools/mutants/fb1022d_shelfhold.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | A piece sold, the game closed: the piece back in the pack and on the shelf for gold | Online a building's shelf is the room's and its word reached the relay at once; the character's pack is the realm record's and reached it at the next checkpoint, which a closing window cuts off. A close between left both holding the piece | SHELF-HOLD |
| 2 | "The reverse way": a piece bought, the game closed, gone from the shelf for nothing | The same two clocks the other way: the take reached the room, the purchase never reached the record | SHELF-HOLD (checkpointed at once; the cost recorded) |

## SHELF-HOLD (1, 2) - `src/world/interior/shelfHold.js`, `src/world/interior/interiorShared.js`

FOUND. Read against the code, then reproduced over the real doors before the fix: a sale at a shop's counter, its
window closed, and every word the room can hear of the shelf read - the window's close, the seat's memory, a refused
act's heal - each said the sold piece, while the only checkpoint asked was the next periodic one.

WHY. A building's shelf is the room's (WORLD6a, `06-Systems/Online-Arc.md`): its whole list goes to the relay at the
window's open and close (`interiorShared.js` publishWhole), in the room's memory, which the seat publishes on its clock
and once more as the page hides (`world.js:"try { worldPublish(performance.now(), true); }"`), and which the relay keeps
for the next visitor; a sold piece lands on that shelf (`stolenGoods.js` landSold, Port-Ledger T2: what makes a sold
piece buyable back). The character's pack and purse are the realm record's, written by a checkpoint - every five minutes
(CHECKPOINT-5) and as the page hides, whose put a closing window cuts off. So Alt+F4 sent the farewell over the open
socket and lost the record's put: the relay's shelf held the sold piece and the record still held it - a copy, on sale
to every player, the reporter's two accounts among them. `onlineCheckpoint.js`'s own header counted "a local shop's buys"
among what a crash may cost the character, which was true of the character - but the shelf is not the character's, and
it outlived the crash on the relay. The reverse is the same order: the purchase's take reached the room, the record never
had the purchase, and the shelf lost the piece for nothing.

DFU has nothing to depart from: `DaggerfallTradeWindow`'s shop belongs to one player and one save, and a sale and its save
are one. The law is the port's own.

THE CALL:

- **A put waits for the record.** A piece put on a shop's shelf FROM THE PLAYER'S OWN LISTS - a sale at the counter
  (Sell, SellMagic: `worldModes.js` commitTrade), the keyed list's sale (doSell), a piece left on a shut shop's shelf -
  is held out of every word of that shelf (one door: `interiorShared.js` interiorLootRecords, which the window's act,
  the memory and so the farewell, and the heal all read) until a checkpoint composed after the put has LANDED - the
  realm's answer to the put that carried it (`world.js` onlineCheckpointLanded, handed to the interior host as
  `checkpointLanded`), never the moment the save is handed over. Then the shelf is said whole and the memory pushed.
  Killed between, the room never heard the piece and the record still holds it: both stand where they stood. A stack a
  put merged into is said at its count before the put.
- **A deal is checkpointed at once** - a sale and a purchase alike (`interiorShelfDealt`), one checkpoint out at a time;
  a change while one is out asks again once it is answered (the one out was composed before it); a refusal (a duel, a
  journey, the death screen) or a put the service did not take asks again every `SHELF_HOLD_RETRY_MS` (30 s) while the
  building stands - never faster, since a put is the account primary's busiest write.
- **A take is said at once, as it was.** Holding a purchase's take as a sale is held would make the copy this record
  closes: RESCUE-SAVE keeps the newest save the session was handed on the device as the page hides, and the next join
  plays it - so a purchase's checkpoint, once composed, can land late, and a held take would leave the piece on the
  shelf and in the record. The take said at once costs, at worst, the shop's piece until its next restock, and only when
  the purchase's checkpoint never lands AND its device copy is never played (a close inside the round trip, then a join
  from another device): nobody gains a piece or a coin. That is the reverse report's remainder, recorded as the cost.
- **The shut shop's window is watched.** It is the pack beside the shelf with no basket (`SetShopShelfStealing`), so
  every piece the shelf gains while it is open came out of the player's lists: it is looked at every frame, and a piece
  taken, a save pressed (F9 is a checkpoint online) and the piece put back is a put. A counter's window is not watched -
  Buy's basket puts the merchant's own pieces back on the shelf - and its sales are told by the deal itself.
- **A put still held when the visit ends** (the player out of the building before its checkpoint landed) never reaches
  the room: the farewell says the shelf as the record then backed it, the sale stands in the record, and the piece is
  the merchant's, unseen - DFU's own end for a sold piece.

`checkpointLanded` moved to `systems/online/onlineCheckpoint.js`, its one home (`onlineHomes.js` hands it on). The hosts:
`bootWorld` one logical line (the door, at its ceiling), `createWorldModes` seven (the bag's door, the three deal doors,
the shut shelf's watch, the heal's hold).

NOT THIS CHANGE. The same order at a room's cupboard (a put claimed to the seat, OUTDOOR-LOOT) and a dungeon's
container: a giver killed after the hand-off, which the ledger already locks as the receiver's copy
(`06-Systems/Integrity-Arc.md`, AUTO-HOLD). A steal at an open shop's counter is a take, as a purchase is. The report
also asked for two accounts to be deleted; that is the owner's call, not code.

PINS. `fb1022d_shelfhold.test.js` (16), over the real doors on a bare context: the report (a sale, the page killed -
nothing the room can hear says it, and the checkpoint is asked at the deal), the landing (said whole, the memory pushed;
an open window's close says it), a refusal and the retry's clock, a second sale while the first checkpoint is out, a
purchase, a stolen piece, the shut shelf (a piece left, a stack merged into, a take then F9 then the piece back, a second
put asked at once), a counter's basket, no door at all, the visit over, the ledger's order, the one home of the landed
answer, and the wiring. Pins moved, each marked: `auditworld6a.test.js` (A1's bag, A5's open), `world6.test.js` (the
shut shelf's open, the frame's settle, the heal). MUTANTS: `tools/mutants/fb1022d_shelfhold.json` (41, all dead - one
survived its first run, a second put asked only on the retry's clock, and was pinned).

NOT SEEN IN GAME. Executed over the real `interiorShared.js` doors with a scripted checkpoint, not against a live relay
and account service.
