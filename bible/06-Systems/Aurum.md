# Aurum and the daily wares (AURUM)

> Design page and record (2026-10-29). Where the page and the code disagree, the code's headers and the pins are what
> runs. Not a DFU member: Daggerfall Unity has no accounts, no shop and no currency outside the game (Port-Ledger
> section A, AURUM). The shop is `06-Systems/Storefront.md`; the pass is `06-Systems/Battle-Pass.md`.

## 1. What was asked

The owner, 2026-10-29: *"Implement a currency that can be earned ingame and through the past + purchased to be used to
purchase a selection of rotating items daily"*, with *"Ensure the reward tracks make sense. No overbundence of titles and
profile icons"* and *"For profile icons no figures should be used. Ensure some are fully animated amd go beyond with
detail"*. "The past" is read as the pass - the Battle Pass.

PASS-PANELS, the owner, 2026-10-30: *"a free panel track and a premium panel track using our new currency to both unlock
tracks and buy the items"*, earned by *"Deeds and world finds"* and *"Also Aurum caches"*. So the pass's tracks are
bought with Aurum, and the pass no longer gives it (`Battle-Pass.md` section 3).

## 2. The currency

**Aurum** is the account's, on every character, and buys cosmetics alone: it is never traded, never gold and never
power (THE CEILING HOLDS, `Home.md`). Its name means gold. A Sigil Stone, a Soul Cake and a Deadlands Ember stay what
they are - each earned in its own place for its own shop.

**A balance is never stored.** It is counted at every ask (`server-account/src/aurum.js` AURUM_BALANCE_SQL): what the
paid packs gave (`shop_orders.aurum` where the order is paid) and the sum of the ledger's lines (`aurum_ledger`). A
line is keyed by its account, kind and ref, so none is written twice:

| Kind | Ref | Amount |
| --- | --- | --- |
| `find` | the UTC day | the day's finds, 100 at most |
| `challenge` | `<season>:<challenge>` | the challenge's Aurum, once |
| `deed` | `<deed>:<week>` | the week's deed, once |
| `cache` | the cache's id | a cache's Aurum |
| `buy` | the daily ware | its price, negative |
| `track` | `<season>:premium` | the premium track's price, negative |
| `panel` | `<season>:<item>` | the item's price, negative |

So a refund or a dispute takes a pack's Aurum back by its order's status alone, and nothing has to be written back. A
balance can fall below nothing when a pack's payment goes back after it was spent; it then buys nothing until it rises
again. What it bought stays bought.

## 3. Earned

**Deeds and challenges.** A deed the pass hears - a foe killed, a quest done, a breach closed - finds 1 to 20 Aurum, 100
a UTC day at most, and each stage's five challenges pay 60 to 200 once (`Battle-Pass.md` section 4). The finds never
stop with a season.

**The week's deeds.** The first of each witnessed kind an account does in a UTC week, from Monday, pays once:

| Deed | Aurum | The receipt that strikes it |
| --- | --- | --- |
| Close a Dagon's Breach | 30 | `gate_kills`, not a gate closed by a rite |
| Take an Elite Breach Redoubt | 30 | `eg_redoubts` the week paid (`paid` 1) - a Rehearsal is not |
| Kill a sea serpent | 25 | `serpent_kills` |
| Hold a fallen star | 20 | `stars_held` |
| Defend a town | 15 | `raid_cleanses` |

Each is struck by a trigger on the receipt's own row (migration 0196), in the claim's own batch: a claim rolled back
strikes nothing, and no client asks for Aurum. A receipt is the relay's signed word the service already counts, so the
week's 120 Aurum a player can earn is held by the same checks those claims are.

## 4. Bought

Four packs, sold through Stripe like every ware (`src/net/shopLaw.js`, kind `aurum`): 500 for $4.99, 1,100 for $9.99,
2,400 for $19.99 and 3,900 for $29.99 - 10, 20 and 30 more in a hundred than the smallest pack's rate
(`aurumLaw.js` aurumBonusOf). A pack is never held: bought again, it gives again. Its order keeps its Aurum from its
checkout, so a refund, a dispute and a dispute won move the balance with the order. A pack is sold only while
`AURUM_OPEN` is `on`; `dev` opens Aurum to the developers alone, and `off` closes it.

## 5. Spent: the daily wares

Each UTC day the shop sells five wares for Aurum: two effects (a kill effect, a portal skin or a mount look), one name
visual and two profile icons, drawn from `AURUM_DAILY` (nine effects, three titles, eight icons). The effects and titles
are sold for money too; the eight icons are sold for Aurum alone. A season's items never come round: its tracks are how
those are had. Prices run from 200 Aurum (an icon) to 2,200 (the Daedric Warhorse): a ware sold for money too costs a
little under its price at the smallest pack's rate, so no daily ware is dearer than the shop's $30 cap.

**The rotation** (`aurumLaw.js` aurumDailyOf) is decided the same on every machine from 1 October 2026: in each slot,
the wares longest unseen come first, each nudged by a hash of the day so the same pairs do not come round together. Over
a year no ware shows two days running, and each is back within six days (a title within four). A ware comes round only
while `SHOP_ON_SALE` names it, its drop has come (`SHOP_FEATURED`) and, where the schedule marks it limited, inside its
window. The service alone decides the day; the account read carries it.

**A buy** (`/v1/aurum/buy`, `server-account/src/aurum.js` buyDaily) is one D1 batch: the ledger's line written only
while the balance - the packs and lines as they stand then - covers the price, and the ware put on
the row only while the row is the one read. A row moved meanwhile is read again, three times. It refuses a guest, a
closed Aurum, a ware not among the day's, one held and a short balance, each with its own word.

## 6. The window

The shop's head carries the balance beside the title, a coin and a number, while Aurum is open to the account. The
**Daily Wares** section stands after the Battle Pass: when the wares turn, the week's deeds - each its Aurum or done -
and a panel for each ware with its price in Aurum. Buy is pressed twice: the first press arms it and says the price
again, the second buys, and left alone for six seconds it goes back to Buy. Short of the price, the panel says how much
more is needed and offers **Get Aurum**, which opens the **Aurum** section: the balance, what Aurum is for and what it
never is, and the four packs.

## 7. The profile icons

No icon draws a figure (`test/ui/storefront_badges.test.js` holds the art to it). The festival's four and the season's
three were drawn again as things and places; the daily wares bring eight more - Dagon's Breach, the Aurbis, an Elder
Scroll, Azura's Star, Red Mountain, an hourglass, a black-red rose and the White-Gold Tower - each in its bezel
(`src/ui/icons/dailyIconArt.js`). Six of the eight move: fire turns, spheres orbit, script lights line by line, ash
rises, and the hourglass turns over when its last grain falls. Each is drawn still for less motion
(`profileIcons.js` profileIconNode, `still`).

## 8. Staff

The staff panel's shop demand (`server-account/src/staffShop.js` shopDemand) counts each day's buys for Aurum and the
Aurum spent beside each ware's orders, and lists each day's wares beside its featured windows.

## 9. Not built, and why

- **Giving or trading Aurum.** Never: a currency that moves between players is a market, and a market is power.
- **Aurum for the bundles.** Not asked; they stay money's. Aurum buys the daily wares and the pass's tracks.
- **The pass's spending in the staff demand.** The ledger keeps it (`track` and `panel` lines); the demand reads the
  shop's wares and the daily wares alone.
- **The Terms of Service.** They do not name Aurum yet. They are the owner's legal text, so this arc leaves them as
  they are and says so here: a line on a currency with no cash value is the owner's to add.
- **A daily ware held already.** Not offered: the panel says Owned and offers Wear.

## 10. Pins

`test/net/aurum_law.test.js` (the rotation, the packs, the weeks, the card),
`test/server/aurum_service.test.js` (the balance and every line's kind, the deeds, the buy and its guards, the switch),
`test/ui/aurum_shop.test.js` (the sections, the balance, the two-press Buy, the flow) and
`test/server/storefront_service.test.js` (the demand). The mutants are `tools/mutants/aurum.json`.
