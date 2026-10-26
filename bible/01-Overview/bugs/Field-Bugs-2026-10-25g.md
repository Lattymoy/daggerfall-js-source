# FIELD BUGS 2026-10-25g - a trader's two pieces bought: the gold gone, the pieces never come

One report, handed over in a session: "I just tried purchasing two items from another users store. The game took a
while to process the trade, but crashed before or as it happened and on BOTH occasions it took ALL my gold and BOTH the
items I tried purchasing." Read on main's `df1a2f8d8c`. Named 25b: main's `Field-Bugs-2026-10-25.md` (an artifact's doll layer, and the
company's word) took 25 while this branch was open. The pins are `test/net/fb1025_vendorlost.test.js`, the mutants
`tools/mutants/fb1025_vendorlost.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "crashed before or as it happened and on BOTH occasions it took ALL my gold and BOTH the items" | A gold buy at a home's trader (HOME-VENDOR) landed on the service - the buyer's record paid, the listing sold, the piece a delivery - and its answer was lost. Asked again, the service said `seq` before it looked the sale up, the realm session ended, and nothing collected the piece | VENDOR-LOST |

## VENDOR-LOST (1) - `server-account/src/market.js`, `src/net/marketBook.js`, `src/ui/vendor/vendorTab.js`

FOUND. Reproduced through the real Worker before the fix: a trader's buy that landed, asked again with the same body
(realmGoldAct's retry: the same id, the same `where`), was answered 409 `{ error: 'seq', seq: 2 }`. The buyer's record
held 950 of its 1,000 gold and no piece, the delivery stood uncollected, the listing `sold`. Through the market book
over the real realmGoldAct: the session ended `unknown`, and the settle after the join let the kept buy go on its repeat
and asked to collect nothing.

WHAT THE PLAYER SAW. A trader's buy is two realm acts: the buy, then the collect of its delivery (vendorBuy, `src/scenes/vendorHost.js` since this fix).
realmGoldAct takes the price out of the purse as the service is asked. The answer did not come - the door's 15 s
(ACCOUNT_ACT_WAIT_MS), or a 503 after the batch had landed, under the account database's overloads of 2026-10-13 and
2026-10-19; which one is not measured. The retry was told `seq`, and the player was sent to the title with "The realm
did not answer about a trade in progress. Join again to see how it ended." - the crash. After the join: the record paid,
no piece in the pack, the piece gone from the stall. The gold taken is the two prices and no more: payFromSave and the
wallet's payUndoable each take the amount (the purse, its letters, then that region's account), so a price past what
the purse held emptied it.

WHY. AUDIT REALM L1-F2 answers where the record stands before any other word, so a lost answer asked again reads "one
on" as its act, landed - realmGoldAct's reading, for an act that needs no answer. A buy needs its answer
(`needsAnswer`: the piece, the delivery), so "one on" ended its session instead. The sale's own row (`market_sales`, by
buyer and id) said it had landed, and a retry never reached it. And the one settle that asked a kept buy again was the
Market tab's, which collected only what a read of the road named: the trader's stall, where its buyer comes back,
settled nothing.

FIXED.
- **The service** (`market.js` marketBuy and buyWithGold; ACCOUNT_VERSION acct191, acct177 on its branch). A record one on from where the tab
  asked, under its lease, with a sale this id made, is that sale, landed: it is answered as the repeat with the record's
  sequence (`realm.seq`). A DEPARTURE FROM L1-F2, for a buy alone. It is said only to a tab that asks for it (`landed`):
  an older tab reads every repeat as a sale paid before it asked, so its settle would checkpoint its purse unpaid over
  the record. One on with no sale of the id, or two on, is `seq` as before. A retry whose own batch is refused because
  the first asking's batch landed while it ran is answered with that sale the same way.
- **The book** (`marketBook.js`). A gold buy asks with `landed`. A settle's ask pays for a repeat that names the record's
  sequence (its own sale, its first answer lost) and never for one made before it. A kept buy whose answer names a
  delivery here is collected on that answer. A delivery collected is off the road the last read named: the stall
  settles with no read behind it, and asked it again (`market-gone`, said to a player who had the piece).
- **The stall** (`vendorTab.js`, `vendorHost.js` openHomeVendorWindow). A trader's stall opened settles the book's kept acts
  through the window's door, beside its read. HOST-SPLIT: the home traders' block (the stall, the board's Vendors tab,
  the Vendor page's helpers) moved verbatim out of `bootWorld` to `src/scenes/vendorHost.js` createVendorHost by
  `tools/hostMove.mjs`, so the wiring lives there and `bootWorld` loses 138 logical lines net, its ceiling 36,251
  (`hostceiling.test.js`).

NOT CHANGED.
- The collect (`market.js` collectGood) keeps L1-F2's order: its lost answer still ends the session, with the piece in
  the record, where the join reads it. The book abandons the session on a collect's repeat (`marketBook.js`
  collectGood's `apply`), so answering one the same way would send the player to the title all the same - its own change.
- Collecting a trader's takings (marketGoldCollect): a lost answer ends the session too, and the gold is in the record
  at the join.
- vendorBuy says "Bought" when the buy answered and its collect did not; the piece waits for the next settle (the
  stall's now, or the Market tab's).

DEPLOY. The service and the client in either order. An old service ignores `landed`: a lost answer ends the session, as
before. An old client beside the new service sends no `landed` and is told `seq`, as before.

NOT VERIFIED. In the running game: the stall's settle, and the report's two pieces coming back. On the service they are
`market_deliveries` rows with `item IS NOT NULL`, `collected = 0` and the buyer's character's `char_id`. The Market
tab's settle collects them as it did (its read names the road); the stall's settle collects them through the kept buy,
which is kept on the device that pressed Buy.

PINNED. `test/net/fb1025_vendorlost.test.js` (7); mutants `tools/mutants/fb1025_vendorlost.json` (16, all dead).
`goldmarket_client.test.js`'s repeat after a join names no sequence, as the service answers one.
