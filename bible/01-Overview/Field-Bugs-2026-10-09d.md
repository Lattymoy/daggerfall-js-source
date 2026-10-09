# FIELD BUGS 2026-10-09d - "People cannot craft from their bag"

One report, from Mac: "People cannot craft from their bag". Asked whether a station should spend what the service
never counted - the door law 3 closes - Mac: "I just want players to also be able to craft from their inventory, not
just the store."

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "People cannot craft from their bag" | a station read the Stores and the service's carried count (`book.held`), never the bag's items: anything the service had not handed out read (0) and a press said `materials-short` | fixed (BAG-CRAFT) - a station works the bag and the pack, counted or not |

## What was found

Traced end to end before anything changed. With the count's own goods the path was whole: a Steel Longsword from a
bag of counted raw goods (6 Iron, 3 Pine Logs, 1 Copper, 2 Rat hides) made in one press through the real Worker - the
chain smelted, burnt and cured, each shortfall put in from the bag. The item-to-material map round-trips every
withdrawable material (140 mints, both of a food's skins), and every station page read `book.held`.

What broke was the count. `book.held` is the Stores and `carriedUsable` - the service's carried count cut to what the
bag and the pack hold (BAG1, `06-Systems/Materials-Bag.md` 5). A unit the service never handed out was in the bag and
nowhere a station looked: a log withdrawn before the bag (2026-10-03), a herb looted or bought at a DFU shop, a stack
traded from a friend, an heir's inheritance, and goods left in a house's chest while the same material was gathered
again (every carried act cuts the count to what the pack holds, never raises it). The Stores page said them carried
(`carriedHeld`, the bag's items) while the station beside it said (0).

## BAG-CRAFT: a station works what is carried, counted or not

- `net/bagLaw.js`: `DEPOSIT_ORDERS.work` - a station's put-in, `spend`'s counted order and then the units the count
  does not hold (`looseOrder`), into the Stores as `LOOSE_ORIGIN` (loose, since the audit - below); `carriedWorkable` - every unit held but the
  gold-bought ones the count still names.
- `server-account/src/professions.js` depositStores: a `work` deposit moves past the count, as many as `held` names
  past it once cut, into the Stores as loose, the count untouched for them; the answer's `loose`. ACCOUNT_VERSION
  `acct101`, migration `0097_loose_origin.sql` (the audit's).
- `net/profBook.js`: `workable` (a station's read); `ensureInStores(inputs, { work })` - a craft (and its chain), a
  brew, a smelt and a temper by `work`; a Court writ, a guild writ and the market by `spend`, as before.
- `ui/profPages.js` workOf: every station's read, one home.

Found on the way and fixed before it shipped: the service's statement bound `held` as `?9` for every order, and a
`spend` or `all` deposit - every writ's, the market's and the Stores page's - answered `server` ("column index out of
range"). `?9` is bound only where `work` reads it.

What it gives up - the owner's call, recorded at `06-Systems/Professions-Arc.md` law 3 and `Materials-Bag.md` 14: a
station's put-in takes the client's word for what the pack holds, so a modified client can craft from goods it never
had, and earn the craft's XP. Since the audit, nothing more.

Pinned by `test/fb1009d_bagcraft.test.js`; `tools/mutants/fb1009d_bagcraft.json` (21, all dead). Nine mutant records
of BAG1, CRAFT1, CRAFT4, PROF4, KNIGHT-HOUSE and GATEKEYS re-aimed by content to the lines this moved.

## AUDIT BAG-CRAFT (same day, Mac: "Audit this")

The record is `06-Systems/Materials-Bag.md` section 15. **A1 (HIGH)**: the `work` put-in's units went into the Stores
as bought, and a `work` put-in is a request any client may send - reproduced against the real Worker, 200 Mithril Ore
no pack held listed for Drakes and withdrawn counted as carried, and by the same reads open to a Court writ, the guild
Stores, a guild writ and a Drakes order. Fixed by the stations' wall: the Stores' fourth origin, `loose` (migration
`0097_loose_origin.sql`), spent by a station alone and first, read by no writ, guild or Drakes door, given back to the
pack uncounted; a smelt's products of it loose, a piece of it walled to gold. **C1**: source pins a comment could
satisfy, now on lines of code. **C2**: the audit's own survivor, a writ's put-in reading the loose units as in, pinned.
**B1 (LOW)**: a refused craft's put-in stays in the Stores - kept, loose there and the next station's.
`test/auditbagcraft.test.js` (4); `tools/mutants/auditbagcraft.json` (23, all dead); 23 records of BAG1, CRAFT1,
CRAFT4, GOLD-MARKET, PROF2, PROF12 and BAG-CRAFT re-aimed by content (41 with BAG-CRAFT's own list, all dead).
