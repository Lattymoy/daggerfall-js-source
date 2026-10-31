# Aurum, every ware and the daily deals (AURUM)

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

AURUM-ONLY, the owner, 2026-10-30: *"So nothing should cost money money anymore. Aurem should now be the main way to buy
all items. Aurem purchase itself should be the only thing."* Asked, the owner chose $1 = 100 Aurum and daily deals at a
quarter off. So every ware in the shop is bought with Aurum, and money buys the packs alone (sections 4 and 5). With
it: *"ensure the aurem caches are balanced"* (section 3a, Balance), then caches with no clock (CACHES-ONCE, section 3a),
and patrons paid their Patreon total in Aurum (PATRON-AURUM, section 3b), and the update's gift (THANKS-POST, section 3c).

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
| `patreon` | `<Patreon user>:<total>` | what that Patreon total adds |
| `gift` | the gift's key | the gift's Aurum, once |
| `buy` | the ware bought | its price, negative |
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

Each is struck by a trigger on the receipt's own row (migration 0201), in the claim's own batch: a claim rolled back
strikes nothing, and no client asks for Aurum. A receipt is the relay's signed word the service already counts, so the
week's 120 Aurum a player can earn is held by the same checks those claims are.

## 3a. Earned: the caches (AURUM-CACHES, 2026-10-30)

The owner, asked whether "world finds" meant deeds alone or "also Aurum caches placed in the world (dungeon chests,
points of interest) that a player picks up, each one server-checked and under a daily cap": *"Also Aurum caches"*.
CACHES-ONCE, the owner, 2026-10-30: *"Is there a way we can make it non time gated"*. Asked, the owner chose one coffer
in every dungeon, opened once ever by an account, its Aurum tuned so the total does not flood the economy.

**Where they stand.** Every dungeon holds one Aurum coffer, the same for every player (`src/net/aurumCacheLaw.js`). Its
id is the dungeon's key, the professions' (`src/scenes/dungeonIdentity.js`): a Bay dungeon's pixel id, and the whole map
id of a lair, a ruin, a spawned dungeon or an abyss past the Bay, so every theatre has its caches. A made level (the
Burning Court, the Shattered Hour, the Spire, the ketch), an Abyss Dungeon, the arena's floor and undercroft and a zone
hall hold none. Before CACHES-ONCE one dungeon in four held one each UTC day, by a hash of the day and the key.

**Inside.** The coffer stands beside the random treasure pile the cache's hash picks, or the next pile in the layout's
order where that one has no room (`src/scenes/aurumCacheHost.js` aurumCacheFoot). Its box stands 0.15 m clear of the
pile's, by the pile's size in the archive (never a texture mod's), and clear of every other pile's, door's and mover's
box, on the pile's floor, with no wall or ceiling near enough to cut its picture. A pile on a mover is passed. Every
client stands it in the same spot. Where no pile has room no coffer stands: the pin holds that under one dungeon in
fifty that has a pile (AUDIT-STOREFRONT III lane D, on the freeware over the Bay and every theatre).

**Found and opened.** Where the account has not emptied the coffer, the HUD says "An Aurum coffer is hidden in this
dungeon." The coffer is an oak chest bound in gold, the Aurum coin's sun on its lock plate (`src/world/aurumCofferArt.js`,
a billboard as Daggerfall's treasure is). The activate key opens it at a treasure pile's reach: the page asks the
service, and on a yes the coffer stands open and empty and the HUD says "+10 Aurum". A refusal says why. A coffer the
account emptied stands open for it on every visit, for good. The device keeps a note of each, and the service's answer
is what counts. A coffer the service does not know (a page and a service of two laws) is taken away.

**The claim.** `/v1/aurum/cache` `{ id, proof }` (`server-account/src/aurumCache.js` claimCache) takes a cache's id,
`d<dungeon>`, in its one spelling, and the relay's proof that the account stood in that dungeon. One statement writes a ledger line of 10
Aurum, kind `cache` and ref the id, only while the account has claimed fewer than ten today; the line's key makes a
second claim of one id write nothing, ever. The balance needs nothing new: it sums the ledger. It refuses a guest, a
closed Aurum (`AURUM_OPEN`), a bad id, a cache already taken and a day's bound met, and it is a progression claim
(`progress.js`): asked of the seated realm character, as the Maul's day is.

**The proof** (AUDIT AURUM-CACHES E1, 2026-10-31, the owner: *"Ensure security on aurem caches so nobody can dupe or
cheat"*). The service holds no map, so before it a script could claim any dungeon's coffer by its id. Now a dungeon
room's welcome carries `cp`, the relay's Ed25519 proof that this account was welcomed into that map's room, good six
hours (`src/net/cacheProof.js`, signed with the relay's receipt key, `GATE_SIGNING_KEY`). The page keeps the last one
for its room and the coffer's claim carries it. The service pays only a proof it verifies with `GATE_PUBLIC_KEY`, for
this account and for the cache's own dungeon: anything else is `cache-proof`, and a cache already held is still said
held. A guest is proved nothing. The claim goes under the account the coffer was stood for, so a sign-in changed
since is `no-session` (lane 3 F2).

**What still holds it.** A script that says a hello into a dungeon's room is welcomed, so the proof raises the bar and
does not end it. The day's bound is the floor: ten claims a UTC day, so no account earns more than 100 Aurum a day
from caches, which is a day's finds. Play meets it only with ten new dungeons in a day. A coffer past it is not lost:
it stays shut, the refusal says to come back after midnight, UTC, and it opens then.

**Balance** (CACHES-ONCE BALANCE). AURUM-CACHES BALANCE had set 25 Aurum in one dungeon in four, three a day (15 in one
in five before it). Now every dungeon pays once, so a coffer is 10 Aurum, one quest's finds. Modelled for a casual, a
regular and a dedicated player (one, four and ten dungeons a day, three in five of them new), caches pay 6, 24 and 60
Aurum a day, against 6, 25 and 62 before. So the flow stays where it was and only the clock is gone. The Bay alone holds
4,232 dungeons. `test/net/aurum_cache_law.test.js` holds the ratios, not only the numbers.

**The four hosts.** `dungeonContext.js` stands the coffer at the end of its build, and its takeLoot presses it; the loot
arms of `worldModes.js`'s dungeon ladder and the standalone `dungeon.js` carry the `aurum:` key there, as DELVE II's
`delve:` key is carried. No host grew: `castleBlockAt` reads the block lookup the context already kept (`blockAtXZ`),
which freed the context's three lines. `world.js` and
`exterior.js` stand none: the streets' points of interest are the POI editor's placements (`POI-Editor-Arc.md`),
another slice. Not a DFU member (Port-Ledger section A, AURUM-CACHES).

## 3b. Paid on Patreon (PATRON-AURUM, 2026-10-30)

The owner: *"All current patreons should be granted aurem amounts according to their purchase amount on patreon."*
Asked, the owner chose the lifetime total read off Patreon. A cent paid is an Aurum, the packs' $1 = 100 Aurum.

**Where the total comes from.** The link asks Patreon for the member's `campaign_lifetime_support_cents`, and Patreon's
member webhook states it on each charge (`server-account/src/patreon.js`). A figure that is not a whole count of cents,
or is past $10 million, is not read.

**What is paid.** One statement writes a ledger line `patreon` `<user>:<total>` to the account linked to that Patreon
user now, for what the total adds past every line that user was ever paid, on any account. So a total said twice or out
of order pays nothing more, a link moved to a new account pays it only what Patreon adds after, and an unlink or a
refund takes nothing back. The confirm page says a cent becomes an Aurum; the page after it says what Patreon has paid.

**Guarded** (AUDIT PATRON-AURUM, 2026-10-31). A link pays only this campaign's total: the member of PATREON_CAMPAIGN_ID
where the config names it, else only where Patreon granted the `identity` scope alone (a widened grant lists other
campaigns' totals). A charge Patreon calls `Refunded` or `Fraud` takes its fall back; a fall it does not explain takes
nothing, so a word out of order cannot. Refs carry `:<n>`, so a total reached again pays again. The confirm page names
the Aurum and that it stays. With `AURUM_OPEN` shut, neither the link nor a webhook pays; the next word after it opens
pays what is new.

**Who.** Every linked patron. A patron linked before PATRON-AURUM is paid at their next charge, or at once by pressing
Link Patreon again. A patron granted a title by name is paid once they link. `test/server/patreon_link.test.js`;
`tools/mutants/patron_aurum.json`.

## 3c. The update's gift (THANKS-POST, 2026-10-30)

The owner: *"every current player should be grant 500 free aurem on the update to their inbox and a free arm armoury
aura"*, with the letter's words to clean up. Migration 0202 runs once, with the deploy. Every registered account standing
then holds the gift `thanks` (`src/net/giftLaw.js`): its key on `players.gifts`, a ledger line `gift` of 500 Aurum, and
the Crystal Spurs to wear (`04-Characters/Aura-Armory.md`). A letter from The DFO Team in the post names both, "On your
account", with nothing to claim. The letter's words are frozen in `tools/sendServerPost.mjs` (THANKS_POST, `--migration
thanks`), which holds the migration's statement. Each write is once an account. A guest, or an account made after, holds
none. `test/server/thanks_post.test.js`; `tools/mutants/thanks_post.json`.

## 4. Bought

Four packs, the only thing sold for money (AURUM-ONLY; `src/net/shopLaw.js`, kind `aurum`, through Stripe): 500 for $4.99, 1,100 for $9.99,
2,400 for $19.99 and 3,900 for $29.99 - 10, 20 and 30 more in a hundred than the smallest pack's rate
(`aurumLaw.js` aurumBonusOf). A pack is never held: bought again, it gives again. Its order keeps its Aurum from its
checkout, so a refund, a dispute and a dispute won move the balance with the order. A pack is sold only while
`AURUM_OPEN` is `on`; `dev` opens Aurum to the developers alone, and `off` closes it.

## 5. Spent: every ware, and the daily deals

**Every ware** in the shop is bought with Aurum (AURUM-ONLY): its price is its old dollar price at $1 = 100 Aurum, to the
whole dollar - 200 Aurum (an icon or the Origin glyph) to 3,000 (the Lord of Oblivion bundle), so none passes the $30 cap
(`shopLaw.js` SHOP_AURUM_CAP). A bigger pack's bonus makes every ware cheaper bought in bulk. A bundle costs its Aurum
less the share of it already held, never under 50. The packs are bought with money alone, and never with Aurum.

**The daily deals.** Each UTC day five wares are a quarter off (`aurumLaw.js` AURUM_DEAL): two effects (a kill effect, a
portal skin or a mount look), one name visual and two profile icons, drawn from `AURUM_DAILY` (nine effects, three titles,
eight icons). A deal costs three quarters of the ware's price, 150 Aurum to 1,875 (the Daedric Warhorse). A season's items
never come round: its tracks are how those are had.

**The rotation** (`aurumLaw.js` aurumDailyOf) is decided the same on every machine from 1 October 2026: in each slot,
the wares longest unseen come first, each nudged by a hash of the day so the same pairs do not come round together. Over
a year no ware shows two days running, and each is back within six days (a title within four). A ware comes round only
while `SHOP_ON_SALE` names it, its drop has come (`SHOP_FEATURED`) and, where the schedule marks it limited, on a UTC day
its window holds whole. The service alone decides the day; the account read carries it.

**A short sale** (AUDIT-STOREFRONT III A2). Before every drop has come, a slot can hold fewer wares than it shows. A slot
short of wares hands its count to the next, so a day still shows five (no title yet: a third icon). A slot with three
wares for two places must show one twice running: a tie goes to the ware on the shorter run, so each shows two days and
rests one, in turn. Before, one effect won every tie by its id and showed fourteen days running.

**A buy** (`/v1/aurum/buy`, `server-account/src/aurum.js` buyWare) takes any ware but a pack: one sold now, or among the
day's deals at its deal price. The page sends the price it showed, and a price that moved since (a deal turned at
midnight, a bundle's share) is refused with the new one (`aurum-price`) before anything is spent. It is one D1 batch: the
ledger's line written only while the balance - the packs and lines as they stand then - covers the price, and the ware
put on the row only while the row is the one read. A row moved meanwhile is read again, three times. It refuses a guest,
a closed Aurum, a pack, a ware not sold now, one held and a short balance, each with its own word.

## 6. The window

The shop's head carries the balance beside the title, a coin and a number, while Aurum is open to the account. Every
ware's panel shows its price in Aurum (a deal's or a bundle's share with the full price struck beside it). The **Daily
Deals** section stands after the Folios (the pass): when the deals turn, the week's deeds - each its Aurum or done - and a
panel for each deal, tagged "Today's deal". Buy is pressed twice: the first press arms it and says the price
again, the second buys, and left alone for six seconds it goes back to Buy. Short of the price, the panel says how much
more is needed and offers **Get Aurum**, which opens the **Aurum** section: the balance, what Aurum is for and what it
never is, and the four packs.

## 7. The profile icons

No icon draws a figure (`test/ui/storefront_badges.test.js` holds the art to it). The festival's four and the season's
three were drawn again as things and places; the shop brings eight more - Dagon's Breach, the Aurbis, an Elder
Scroll, Azura's Star, Red Mountain, an hourglass, a black-red rose and the White-Gold Tower - each in its bezel
(`src/ui/icons/dailyIconArt.js`). Six of the eight move: fire turns, spheres orbit, script lights line by line, ash
rises, and the hourglass turns over when its last grain falls. Each is drawn still for less motion
(`profileIcons.js` profileIconNode, `still`).

## 8. Staff

The staff panel's shop demand (`server-account/src/staffShop.js` shopDemand) counts each day's buys for Aurum and the
Aurum spent beside each ware's orders, and lists each day's wares beside its featured windows.

## 9. Not built, and why

- **Giving or trading Aurum.** Never: a currency that moves between players is a market, and a market is power.
- **Aurum for the bundles.** Built with AURUM-ONLY: a bundle is bought with Aurum, as every ware is.
- **The pass's spending in the staff demand.** The ledger keeps it (`track` and `panel` lines); the demand reads the
  shop's wares alone.
- **The Terms of Service.** They do not name Aurum yet. They are the owner's legal text, so this arc leaves them as
  they are and says so here: a line on a currency with no cash value is the owner's to add.
- **A daily ware held already.** Not offered: the panel says Owned and offers Wear.

## 10. Pins

`test/net/aurum_law.test.js` (the rotation, the packs, the weeks, the card),
`test/server/aurum_service.test.js` (the balance and every line's kind, the deeds, the buy and its guards, the switch),
`test/ui/aurum_shop.test.js` (the sections, the balance, the two-press Buy, the flow) and
`test/server/storefront_service.test.js` (the demand). The mutants are `tools/mutants/aurum.json`.

The caches (section 3a): `test/net/aurum_cache_law.test.js` (the numbers, the balance, the id, the spot),
`test/server/aurum_cache_service.test.js` (the claim, the day's bound, a repeat, a forged id, the guards, the proof),
`test/net/cache_proof.test.js` (the proof's room, its cache, its signature, the relay's welcome, the page's keep),
`test/scenes/aurum_cache_world.test.js` (which dungeons, the spot, the press; a Bay dungeon and a lair of Cyrodiil on
the freeware) and `test/world/aurum_coffer_art.test.js` (the pictures). The mutants are `tools/mutants/aurum_caches.json`
and, for AUDIT-STOREFRONT III lane D (the coffer's room, its late yes), `tools/mutants/storefront_audit3_caches.json`;
for the proof, `tools/mutants/cache_proof.json`.
`tools/aurumCacheProbe.mjs` renders and presses a coffer in a place past the Bay (`--spawn`) or a Bay dungeon (`--bay`).
