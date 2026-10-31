# The Wallet

Every character carries a **Wallet** in the pack. It holds the currency pieces - DFU's letters of credit, the gate's
Deadlands Embers and the Welkynd Shards that salvage gives - and shows the two currencies that are not pieces: the
purse's gold (`entity.goldPieces`) and, online, the account's silver. It is the port's own item; DFU has none.

## How it works

**An organizer, not a second list.** The pieces stay in the pack's own collection (`entity.items`). The wallet only
changes where the enhanced pack shows them. So every spender reads them where it always did - the bank, the court's
fines, the Broker, the Reforge, the save, the realm's customs and gold law - and none of them changed for it.

**The enhanced pack** (both enhanced skins). While the pack holds a wallet, letters, embers and shards leave the
pages and the wallet stands on Valuables. Its card's body is a ledger (`walletLedger`) in two parts: **Coin** (gold,
silver) and **In the wallet** (letters with their worth in gold, embers, shards). Figures share one column; an empty
holding says `none`. Each held piece is listed as the pack's own row, with every act it has on its page (card,
Shift-stow, wear a crystal, drag, right-click menu, the pad's quick act). The pages and the wallet together still
cover everything the pack holds unworn. A crystal worn in a slot belongs to the doll.

**Weight.** The wallet weighs nothing; the pieces it holds weigh what they always did. The wallet's row and card show
the weight of what it holds, and each ledger row shows its holding's weight. The carry weight counts each piece once.
In another window (a shop, a trade) the wallet's card shows its own weight only, since those list the pieces as rows.

**The classic window** keeps DFU's four tabs, with every currency piece where DFU puts it. The wallet sits on
Clothing & Misc, and its Use shows its lines in DFU's click-anywhere box. Both skins read the same rows
(`walletLines`), so they cannot disagree.

**The hotbar.** Pressing the wallet shows its figures on the HUD line and asks the account's silver again for the next
press, one request at a time.

**Silver.** Asked of the marks book when the sheet opens. When no figure is known it says why: offline "held in your
online account", online and not known yet "checking your account", an account that holds none "none".

**Not held.** The Portal Stone (used, not spent), gold (a counter, never a piece), silver (shown, never a piece).

## Rules

- The wallet is an organizer, never a second list (Mac asked for the wallet; the organizer shape stands). `src/systems/walletItem.js` `WALLET_HOLDS`.
- The card shows the weight of what the wallet holds, and no weight changes (the owner).
- Template 580, group `UselessItems2`, DFU's Small Sack picture, no weight, one to a slot. `src/systems/walletItem.js`
  `WALLET_TEMPLATE`, `WALLET_ROW`.
- Bound: never dropped, traded or sold; the realm's trade service refuses it. `src/net/realm/realmTradeLaw.js`
  `BOUND_TEMPLATES`.
- Pack-only: no place takes it, not even the player's own wagon or storage, a home's decoration or a revenant's theft.
  Every refusal says "Wallet stays in your pack." `src/systems/item/itemBound.js` `isPackOnly`, `packOnlyText`.
- The gift: a new character's kit holds a wallet (`src/systems/startingGear.js`), and a character from an older save
  is given one once, at the pack's end, as the save is restored. The save's `walletGift` mark records it.
  `src/systems/save/save.js` `restorePlayer`.
- Letters of credit (MiscItems 275) file under Valuables. `src/ui/packPages.js` `pageOf`.

## Code and tests

- `src/systems/walletItem.js` - the item, what it holds, `walletContents`, `walletLedger`, `walletLines`, the silver's
  door (`setWalletSilver`, `refreshWalletSilver`), the gift
- `src/systems/item/itemBound.js` - the pack-only law
- `src/systems/decor/decorItems.js` `decorStandOf`, `src/systems/revenant/revenant.js` `revenantMayTake` - the two
  doors out of the pack that refuse it
- `src/ui/enhanced/enhancedInventory.js` - `packModel`, the wallet's sheet, its weight
- `src/ui/native/nativeInventory.js` - the classic Use box
- `src/systems/quickslots.js` - the hotbar line
- `src/scenes/world.js` - the silver's door, online; the other hosts need none
- `test/systems/wallet1.test.js` - the item, the gift, pack-only on both skins, the partition, the sheet, the hosts
- `test/systems/audit625_wallet.test.js` - decoration and revenant refusals, the sheet's rows, the silver's words
- `test/systems/wallet_ui.test.js` - the ledger and the classic lines
- `test/systems/wallet_weight.test.js` - the weights on the card, the ledger and another window's card
