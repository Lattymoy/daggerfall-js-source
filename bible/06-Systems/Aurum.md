# Aurum

Aurum is the account's currency, shared by every character, and buys cosmetics only: every ware in the shop
(`06-Systems/Storefront.md`), the Battle Pass's tracks and items (`06-Systems/Battle-Pass.md`), and five daily deals.
It is earned in play (deeds, weekly feats, a coffer in every dungeon that fills each week), paid to Patreon supporters, given as gifts,
and bought in packs. The player meets it in the shop's head (a coin and a number), its **Daily Deals** and **Aurum**
sections, and the coffers in dungeons. DFU has no accounts, shop or out-of-game currency.

## How it works

**The balance is never stored.** It is counted at every ask (`server-account/src/aurum.js` `AURUM_BALANCE_SQL`): the
Aurum of paid pack orders (`shop_orders.aurum`) plus the sum of the `aurum_ledger` lines. A line is keyed by account,
kind and ref, so none is written twice:

| Kind | Ref | Amount |
| --- | --- | --- |
| `find` | the UTC day | the day's finds, at most 100 |
| `challenge` | `<season>:<challenge>` | the challenge's Aurum, once |
| `deed` | `<deed>:<week>` | the week's deed, once |
| `cache` | `<cache>:<week>` | a coffer's Aurum, once a week |
| `patreon` | `<Patreon user>:<total>` | what that total adds |
| `gift` | the gift's key | the gift's Aurum, once |
| `buy` | the ware | its price, negative |
| `track` | `<season>:premium` | the premium track's price, negative |
| `panel` | `<season>:<item>` | the item's price, negative |

A refund or dispute moves a pack's Aurum with its order's status alone. A balance can fall below zero when a spent
pack's payment goes back; it then buys nothing until it rises. What it bought stays bought.

**Given back by staff.** An Admin can give back one Aurum buy (`/v1/staff/aurum/refund`, `server-account/src/staffAurum.js`).
The preview lists the account's buys, newest first, and what would leave the account. The confirm names the buy, a
reason and a note. It deletes the buy's `buy` line, so its Aurum is back and a later buy pays again. The ware leaves the
row as a money refund takes it (`heldRevoked`): what another order or buy still covers stays. A bundle sold less a ware
already held never gave that ware, so giving back that ware's own buy takes it off. The player gets a letter, and the
act is in the audit log.

**Earned.**
- *Finds.* A deed the pass hears finds Aurum by its source (`src/net/battlePassLaw.js` `PASS_SOURCES`, from 1 for a foe
  to 20 for an endgame deed), at most `PASS_DAY_AURUM` (100) a UTC day. Finds never stop with a season.
- *The week's deeds.* The first of each witnessed kind in a UTC week (from Monday) pays once (`src/net/aurumLaw.js`
  `AURUM_DEEDS`): close a Dagon's Breach 30, take an Elite Breach Redoubt that pays 30, kill a sea serpent 25, hold a
  fallen star 20, defend a town 15. Each is struck by a trigger on the relay-signed receipt's own row, in the claim's
  batch; no client asks for it.
- *Coffers.* Every dungeon in every theatre holds one Aurum coffer, opened once a UTC week (from Monday) per account,
  keyed by `aurumWeekOf` as the week's deeds are. It pays 5 to 10 Aurum by a hash of its id
  (`src/net/aurumCacheLaw.js` `aurumCacheAurumOf`), the same for every player. Its id is the dungeon's key
  (`src/scenes/dungeonIdentity.js`): a Bay dungeon's pixel id, or the whole map id past the Bay. Made levels, Abyss
  Dungeons, the arena and zone halls hold none. The coffer stands beside a treasure pile chosen by hash, clear of other
  boxes, the same spot for every client (`src/scenes/aurumCacheHost.js` `aurumCacheFoot`). The HUD says one is hidden;
  the activate key opens it and says what it paid ("+7 Aurum"). An emptied coffer stands open for that account until
  Monday 00:00 UTC, then fills again. The device keeps only this week's, on the shared clock while one stands.
- *Patreon.* A cent of a patron's lifetime support (`campaign_lifetime_support_cents`, from the link and the member
  webhook) is an Aurum. The line pays only what the total adds past every line that Patreon user was ever paid, on any
  account, so a repeated or reordered total pays nothing more and an unlink takes nothing back. A `Refunded` or `Fraud`
  charge takes its fall back. Only this campaign's total counts (`server-account/src/patreon.js`).
- *Gifts.* `src/net/giftLaw.js`: a gift is held once by its key. The `thanks` gift is 500 Aurum and the Crystal Spurs
  for every account that stood at its migration, with a letter in the post.

**Bought.** Four packs are the only thing sold for money (`src/net/shopLaw.js`, kind `aurum`, through Stripe): 500 for
$4.99, 1,100 for $9.99, 2,400 for $19.99, 3,900 for $29.99. Bigger packs carry a bonus over the smallest's rate
(`aurumBonusOf`). A pack can be bought again and again.

**Spent.** Every ware costs its dollar price at `SHOP_AURUM_PER_DOLLAR` (100), never past `SHOP_AURUM_CAP`. A bundle
costs its Aurum less the share already held, never under 50. A buy (`/v1/aurum/buy`, `buyWare`) sends the price the
page showed; a moved price is refused with the new one (`aurum-price`) before anything is spent. It is one D1 batch:
the ledger line is written only while the balance covers it, and the ware is added only while the row is the one read.
Buy is pressed twice (arm, then buy; it disarms after six seconds). Short of the price, **Get Aurum** opens the packs.

**Daily deals.** Each UTC day five wares are a quarter off (`AURUM_DEAL` 0.75): two effects, one name visual and two
profile icons (`AURUM_DAILY_SLOTS`), drawn from `AURUM_DAILY`. Season items never appear. The rotation
(`aurumDailyOf`) is the same on every machine from `AURUM_DAILY_FROM`: in each slot the ware longest unseen comes
first, nudged by a hash of the day. A ware appears only while on sale, after its drop, and inside any limited window.
A slot short of wares hands its count to the next; a tie goes to the ware on the shorter run. The service decides the
day.

**Profile icons** draw no figure. Six of the eight daily icons move; each draws still under reduced motion
(`src/ui/icons/dailyIconArt.js`).

## Rules

- Aurum buys cosmetics only: never traded, never gold, never power (the owner).
- Nothing costs money but Aurum packs; $1 = 100 Aurum; daily deals are a quarter off (the owner).
- A coffer fills again each UTC week: one per dungeon, once a week per account (Mac).
- A coffer pays 5 to 10 Aurum, and no daily cap holds the claims (Mac).
- Patrons are paid their Patreon lifetime total in Aurum, a cent an Aurum (the owner).
- Coffers are secured against cheating (the owner): a claim (`/v1/aurum/cache`, `server-account/src/aurumCache.js`
  `claimCache`) needs the relay's Ed25519 proof that this account was welcomed into that dungeon's room, good
  `CACHE_PROOF_TTL_S` (six hours) (`src/net/cacheProof.js`). Each account claims a cache once a week; nothing else
  bounds the claims. It is a progression claim, asked of the seated realm character.
- `AURUM_OPEN` is `on`, `dev` (developers only) or `off`; off, nothing sells, links and webhooks pay nothing, and
  claims are refused.
- Aurum is never given or traded between players: a currency that moves is a market, and a market is power.
- Only the dungeon hosts stand coffers: `dungeonContext.js` builds it, the dungeon loot ladders carry the `aurum:` key.
  `world.js` and `exterior.js` stand none.

## Code and tests

- `src/net/aurumLaw.js` - deeds, packs, deals, the rotation
- `src/net/aurumCacheLaw.js`, `src/net/cacheProof.js` - coffers and their proof
- `src/net/giftLaw.js` - gifts
- `server-account/src/aurum.js` - balance and buys; `server-account/src/aurumCache.js` - coffer claims;
  `server-account/src/patreon.js` - Patreon payments; `server-account/src/staffShop.js` `shopDemand` - staff demand
- `src/scenes/aurumCacheHost.js`, `src/world/aurumCofferArt.js` - the coffer in the dungeon
- `test/net/aurum_law.test.js` - rotation, packs, weeks
- `test/server/aurum_service.test.js` - balance, every line kind, deeds, buy and guards, the switch
- `test/ui/aurum_shop.test.js` - sections, balance, two-press Buy
- `test/net/aurum_cache_law.test.js`, `test/server/aurum_cache_service.test.js`, `test/net/cache_proof.test.js`,
  `test/scenes/aurum_cache_world.test.js`, `test/world/aurum_coffer_art.test.js` - coffers, claims, proof, placement
  in the Bay and past it, art
- `test/server/patreon_link.test.js`, `test/server/thanks_post.test.js` - Patreon and the gift

## Open

- A script that says hello into a dungeon room is welcomed, so the proof raises the bar but does not end it. With no
  daily cap, such a script can take each coffer it is proved in, once a week.
- The Terms of Service do not name Aurum; that text is the owner's to add.
- The staff demand reads shop buys only, not pass spending.
