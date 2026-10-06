# The Wallet - WALLET1

Mac, 2026-10-05: *"We need to develop a wallet item that holds forms of currency and sits in the inventory."*

Every character carries a **Wallet** in its pack. It holds the currency PIECES - DFU's letters of credit, the gate's
Deadlands Embers and the Welkynd Shards salvage gives - and counts the two currencies that are no pieces at all: the
purse's gold (E4's counter, `entity.goldPieces`) and, online, the account's silver (the marks book's balance).

Not a DFU member - the port's own (Ledger A, WALLET1).

## The one decision: an organizer, never a second list

The pieces the wallet holds STAY IN THE PACK'S OWN COLLECTION (`entity.items`). What the wallet changes is where the
enhanced pack shows them: in the wallet's sheet, not on its pages. A second list (the Materials Bag's shape,
`entity.bagItems`) would have blinded every door that reads a currency where it has always been - the bank's letters
and the court's fines (`systems/banking.js`, `systems/court.js` deductGold), the Broker's embers (`sigilBroker.js`), the
Reforge's and the Portal Stone's shards (`reforge.js`), the save, the realm's customs and its gold law
(`net/realmGoldLaw.js`) - and the BAG1 audit is the record of what that costs. Kept in `items`, every one of them reads
the wallet's pieces unchanged, and no spender, save or service changed for it.

## What shipped

| File | What it is |
|---|---|
| `src/systems/walletItem.js` | the piece: template 580, its row (DFU's Small Sack's picture and price - TEXTURE.205 record 18, 1 gold - no weight, one to a slot, `bound`, `packOnly`), `mintWallet`, `isWalletItem`; WHAT IT HOLDS (`WALLET_HOLDS`: templates 275, 570, 571; `walletHolds`); `walletContents` (the gold, the silver, the letters and the gold they are worth, the embers, the shards, the pieces in the pack's order, worn ones aside) and `walletLines` (the words both skins say); the silver's door (`setWalletSilver`, `walletSilver`, `refreshWalletSilver`); the gift (`giveWallet`, `WALLET_GIFT`, `giveWalletGift`); the card's lines; the Use's registered arm (`wallet`) |
| `src/systems/itemBound.js` | `isPackOnly` (the row's `packOnly`) and `packOnlyText`: a pack-only piece is refused by every place, the player's own wagon and storage too |
| `src/systems/decorItems.js`, `src/systems/revenant.js` | AUDIT 625 W1/W2: the two doors out of the pack that are no place - a home's decoration (`decorStandOf`) and a revenant's theft (`revenantMayTake`) - refuse a pack-only piece too |
| `src/net/realmTradeLaw.js` | `BOUND_TEMPLATES` names 580 - the realm's trade service refuses it as the client does (acct84) |
| `src/ui/packPages.js` | the wallet's page is Valuables; and the letter of credit's (below) |
| `src/ui/enhancedInventory.js` | `packModel`: what the wallet holds leaves the pages (`paged`) and rides `model.wallet`; the wallet's SHEET in its card's body (`walletSheet`); a held piece's way back (`walletBack`); the Use's arm (`pickWallet`); the pack-only refusal |
| `src/ui/nativeInventory.js` | the Use's arm: DFU's own click-anywhere box, the wallet's lines; the pack-only refusal |
| `src/systems/quickslots.js` | a wallet pressed on the hotbar says its figures on the HUD's line |
| `src/systems/itemInfo.js` | the wallet's card |
| `src/systems/save.js`, `src/systems/startingGear.js` | the gift (below) |
| `src/scenes/world.js` | the silver's door, online |

## What it holds, and where

- **The enhanced pack** (the port's own screen, both enhanced skins): while the pack holds a wallet, the letters, the
  embers and the shards leave the pages and the wallet stands on Valuables. Picked (or Used), its card's body is its
  SHEET: the gold, the silver, the letters and what they are worth, the embers, the shards - `walletLines`' words - and
  each piece it holds as the PACK'S OWN ROW (`itemRow`, the page's tile, its tier's frame and all - AUDIT 625 W3: it was
  a button that only opened the card). Every act a piece had on its page it has there: the click that opens its card
  (its lock, its Stow, the bound law's refusals - and a way back to the wallet), Shift into the store beside it, the
  double click that wears a crystal, the drag, the right click's menu, the pad's quick act. The pages and the wallet
  together are still a partition of what the pack holds unworn (PX31's law, extended). A worn crystal (an ember or a
  shard in a crystal slot) is the doll's, as the pages leave it. The account's silver is asked afresh of the marks book
  once a mount, as the sheet first shows.
- **The classic window** is DFU's and keeps DFU's four tabs, every currency piece where it always was. The wallet
  stands on Clothing & Misc, and its Use says its lines in DFU's own click-anywhere box.
- **The hotbar**: a wallet pressed says its figures on the HUD's line, and asks the silver afresh for its next press, as
  the classic box asks it for its next look - one ask in flight at a time (AUDIT 625 W5: it never asked).
- **The silver's words** where no figure is counted say why (AUDIT 625 W5 - every case once said the offline words):
  offline "kept by your account online"; online and not known yet "asking your account" (every look asks); an account
  that holds none - a guest's, or the counting-houses not striking yet - "none".
- **Not held**: the Portal Stone (a thing used, not spent); gold, which is E4's counter and never a piece; silver, the
  account's (shown, never a piece).

THE LETTER OF CREDIT'S PAGE, a bug found on the way. `ui/packPages.js` promised "Currency (letters of credit)" on
Valuables since PX31, but DFU's letter is MiscItems 275, so its group alone filed it under Misc; and the pin that said
otherwise (`test/packPages.test.js`) asked about a `Currency` 276 - DFU's Gold Pieces, a shape no producer mints
(TEST THE SHAPE THE PRODUCER MINTS). `pageOf` names the letter now, and the pin asks about `letterOfCredit()`'s own.

## The piece

Template 580, beside the gate's 570-572 and below the professions' reserved 600 (`Professions-Arc.md` 4.8). DFU's
Small Sack's picture and price (ItemTemplates 86): the picture is DFU's own, and the price is the one every minted item
carries (`test/startinggear.test.js`'s 17e F2 law) - it is never sold. No weight (`hasNoEncumbrance`, the Small Cart's
column), so a wallet costs a pack nothing; the pieces it holds weigh what they always did. `UselessItems2`, the
Materials Bag's group.

**BOUND** (`systems/itemBound.js` SS1): never dropped, traded or sold, and the realm's service refuses it in a realm
trade. **PACK-ONLY** (WALLET1): not even the player's own wagon or storage take it - a wallet that left the pack would
leave what it holds back on the pages. Both windows refuse it in its own words: "Wallet stays in your pack." AUDIT 625:
and the two doors out of the pack that are no window's place - a HOME'S DECORATION (the decorate panel lists no row
for it: `decorItems.js decorStandOf`, beside the Materials Bag - W1) and a REVENANT'S THEFT (RVN8's pick passes it by:
`revenant.js revenantMayTake` - W2; one that escaped would keep it, and the gift is given once).

## The gift

PORTAL-GIFT's shape (`06-Systems/Portal-Stone.md`): a new character's starting kit holds a wallet - the port's own
tail (`startingGear.js` addSurvivalProvisions), which DFU's kit and a mod's (RRI2's) both ride, whatever the switches -
and every character made before the wallet is given one, ONCE: a save's `walletGift` mark says it has had it, a save
from before the wallet carries none, and the gift is given as the save is restored (`save.js` restorePlayer, below the
relinks - the wallet joins the pack's end, so no index above it moves - every load, offline and online, the realm's
boot among them). A round trip gives none: `snapshotPlayer` writes the mark.

## The four hosts

- `scenes/world.js` - the silver's door, online alone: the marks book's balance, and its refresh as the wallet's sheet
  opens. Every mode of the streaming page reads it (its interiors, its dungeons).
- `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` (dungeons) - no door of their own: the wallet lives
  in the pack, and the pack's windows are the same windows. AUDIT 625 W1: the interiors host one more way out of the
  pack - the decorate tool's (`packTake`, a home's own things) - and its panel lists rows through the shared
  `decorOwnEntry`, which stands no pack-only piece; a home's yard lists no pack at all (`homeYards.js`).
- `scenes/exterior.js` (the offline town page) - no silver door: offline the wallet says the silver is kept online.

## Calls made here, put to the owner

- An organizer, not a second list (above) - so no currency changed where it is spent.
- The classic window keeps DFU's four tabs; only the enhanced pack gathers the pieces into the wallet.
- Pack-only: the wallet never goes to the wagon or the player's storage.
- The Portal Stone is not a currency: it is spent by its Use, not by a counter.
- The letters' page: Valuables, as the page's own words always said.

## Pinned

`test/audit625_wallet.test.js` (4 - AUDIT 625's: the decoration and the revenant pass it by, the sheet's rows the pack's
own with every gesture and frame, the silver's words and the hotbar's ask). `test/wallet1.test.js` (10 - the piece, the
gift, the pack-only law on both skins and the service's bound row, what it holds,
the silver's door, the enhanced pack's partition, the sheet driven through the mounted pack, the sheet's silver - asked
once a mount, an answer that lands while a piece is picked kept for the way back - the Use on both skins and the
hotbar, the hosts). Moved: `test/packPages.test.js` (the letter's page, the pages' list), `test/auditrealm.test.js`
(the twelfth registrar, its bound row), `test/audit17f.test.js` and `test/settings.test.js` (DFU's bag, the wallet set
aside). `tools/mutants/wallet1.json` (54, all dead).
