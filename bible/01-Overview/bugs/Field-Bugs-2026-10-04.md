# FIELD BUGS 2026-10-04 - a gatherer's goods in the pack, past its weight; the Materials Bag on every shelf, it and the Campfire never sold out, and one bag to a character

Mac, from play the day after BAG1 shipped: *"People are doing gathering without a crafting bag and theyre not seeing
the materials in their inventory"*, then *"Also nobody can find material bags in store"*, then *"I want the gathering
bag to be unlimited purchases in stores. It shouldnt run out, same with campfires"*, then *"Right, you shouldnt be able to
hold multiple gathering bags"*. Each fix below is pinned by
tests that fail on the code before it, and its pins are mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "People are doing gathering without a crafting bag and theyre not seeing the materials in their inventory" (Mac) | a carried harvest (BAG1) was minted into the bag, then the pack up to its weight, and the rest was "left where it was gathered" - counted carried by the service and never made. A DFU pack is carried to its limit (every loot take is weighed against it), and with no bag the pack is all there is, so a loaded character gathered goods it never saw | PACK-OVER |
| 2 | "Also nobody can find material bags in store" (Mac) | the bag stood on a General Store's first shelf alone and was left off a shelf stocked by a character who carried one; the first shelf is just the first model the building lists, and online a shelf's stock is the room's for the day, so one bag-owner's open hid it from everyone | BAG-SHELF |
| 3 | "I want the gathering bag to be unlimited purchases in stores. It shouldnt run out, same with campfires" (Mac) | a shop shelf is a container: a purchase took its one bag and its two to four Campfires off for the day, and online a shelf is the whole building's | ENDLESS-STOCK |
| 4 | "Right, you shouldnt be able to hold multiple gathering bags" (Mac) | with a bag on every shelf that never sells out, nothing stopped a character buying one after another - BAG1 had kept a second off the shelf for its stocker alone, and BAG-SHELF rightly undid that | ONE-BAG |

## PACK-OVER (1)

`net/profBook.js` mintHarvest; `net/bagLaw.js` goodsWhere, BAG_WORDS.overWeight; `scenes/gatherHost.js` the haul
card's line. Ruled out first: the account service had taken BAG1 (`acct74` on `/v1/health`, migration 0076 applied - the
deploy's red is a smoke step after it, `/v1/auth/guest` answering 500), the realm's checkpoint judges a first save
alone, the item lands in DFU's own tab, and the world host's hands are the module's one `playerEntity`. With room in the
pack every unit came. Without it, none did: a strength-50 character 3 kg under its 75 kg gathered four Oak Logs and was
handed one; one AT its limit gathered herbs through the real Worker and was handed none, the service counting every one
as carried.

BAG1 had written the law down (Materials-Bag.md 3: "what has no room is left where it was gathered, and said") and kept
the opposite for every other door: a withdrawal's and a smelt's units go into the pack past its weight (the audit's B5,
the second's K4/H5 - `giveCarried`, "a unit the service counted as carried and the save never got was lost to the
character"). DFU's Foraging mod, which the professions' acts are built on, does the same - its finds are
`Player.Items.AddItem` with no weight in it (`systems/foraging/foragingInstall.js` give), and its one weight rule is the act's
refusal to START when fully encumbered (foragingLaw.js `encumbered`). So the harvest is the withdrawal's now: the book
mints through the hands' `give` - the bag, the pack, then the pack past its weight - and its `put` says `over`. The
node's own refusal stands as it was (`carryFull`: no room for one unit, "No room in your bag or pack"), which is the
mod's refusal to start; what an act yields is never weighed again. Hands with no `give` (an older host's shape) still
mint through `mint`, `left` and `lost` naming what could not be made - now only a thing with no pack form.

The words: the line says "+4 Oak Logs to your pack - your pack is over its weight"; on the enhanced skin the haul card
counts all four and the line beside it says "Your pack is over its weight. Put materials in your Stores in any town, or
carry them in a Materials Bag." The weight's consequences are DFU's own and the player's to clear: the next act refuses
to start while the pack is full, and the Stores page's Put in (or a Materials Bag) takes the load off.

The four hosts: the gathering acts run in `scenes/world.js` alone (its one `createGatherHost`, whose hands are
`carryHands` - `give` is `giveCarried(playerEntity, ...)`, pinned by BAG1's wired test); `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` run no harvest (a dungeon's veins are world.js's gather host
too). `test/net/fb1004_packover.test.js`; `tools/mutants/fb1004_packover.json` (6, all dead), with `tools/mutants/bag1.json`
(89, all dead) run beside it. BAG1's own page restated (Materials-Bag.md 3, 7, 13).

## BAG-SHELF (2)

`systems/shopStock.js` stockShopShelf. BAG1 shelved the bag only where `shelfIndex === 0` (the second audit's H8: "a
bag on each one sold one bag several times over") and only for a stocking character with no bag of its own. A player
buys shelf by shelf, and shelf 0 is just the first shelf model `interiorCtx.shelves` lists - nothing marks it. Online a
shelf's roll is published to the building (`worldModes.js` interiorPublishLoot) and is the room's until the game day
turns, so a bag-owner who opened that shelf first stocked it without a bag for everyone in the building. The bag stands
on every General Store shelf online now, whoever stocks it, as the horse and the cart do; offline none, as before (one to
a character: ONE-BAG). A shelf already stocked this game day keeps that stock
until its restock. The four hosts: shelves are stocked in `scenes/worldModes.js` alone (openShelf, openMerchantSell);
exterior.js, world.js and dungeonContext.js stock no shop shelf. Pinned in `test/systems/bag1_client.test.js` (BAG1 bought: a
bag-owner's shelf and a second shelf both shelve it); `tools/mutants/bag1.json`'s shelf records retargeted (the first
shelf alone, none to a bag-owner, offline) - 89, all dead.

## ENDLESS-STOCK (3)

`systems/shopStock.js` isEndlessStock, restockEndless; `scenes/worldModes.js` commitTrade, doBuy. A shelf's rows are its
stock until the game day turns (A2's restock law), and a purchase splices the bought rows off it - so a General Store
sold its bag (one a shelf, BAG-SHELF) and its Campfires (two to four, REST2; a Pawn Shop's 0-2) and had none until the
next day, and online that shelf is the building's (WORLD6a), so one buyer emptied it for everyone. The Materials Bag and
the Campfire are endless now: both purchases - the counter's (commitTrade's Buy arm) and the keyed list's (doBuy) -
after they take the bought rows off the shelf, put a fresh one back for each endless row - minted as the shelf mints it (the bag through `setItemFields`, the Campfire through
`createSurvivalItem`, full), never the record the buyer took. A Campfire is the survival group's template 541; neither
stacks, so one row bought is one row back. No other door calls it: a row taken from a closed shop's shelf is stolen
(PT1) and is not put back, and the horse, the cart and the rest of a shelf sell out as before. It is the online game's
alone (the audit's F4): offline a shelf sells out as Daggerfall's does. And online no shop buys a bag or a Campfire back
(`shopBuysItem`, the audit's F1/F2): the only endless rows on a shelf are those it stocked itself, so a Pawn Shop that
rolled no Campfire still has none to sell. Online the restocked shelf is what the window's close publishes to the
room. The four hosts: shop shelves are stocked and bought from in `scenes/worldModes.js` alone. Pinned by
`test/systems/fb1004_endless.test.js` (6: the bag bought five times and still one on the shelf, a fresh record; ten Campfires
bought and the shelf as stocked, three in one purchase three back, fresh and whole; nothing else restocked; the two
purchases' calls and no other, by source; no buy-back online, DFU's offline; no restock offline);
`tools/mutants/fb1004_endless.json` (11, all dead). DECOR2b's counter pin
reads `decorDeliver` straight after the purchase's loop, so the restock stands after it.

## ONE-BAG (4)

`net/bagLaw.js` holdsOtherBag, BAG_WORDS.second; `systems/item/itemTransfer.js` planTake, REFUSAL.secondBag;
`scenes/worldModes.js` doBuy, buyItem. BAG1 kept a second bag from a character by not shelving one to a stocker who
held one - which online hid it from everyone (BAG-SHELF), and which never stopped a purchase. One bag to a character is
the take's rule now: the take ladder (planTake) - a pickup, quick loot, a container, a wagon, a ship's hold, and both
trade windows' Buy basket (their `bag` is the pack and the basket together) - refuses a Materials Bag while another is
held in the pack, that basket or the wagon, in "You already have a Materials Bag." The bag being taken is never
"another", wherever it sits, and one out of the character's own wagon is never refused (the audit's 1: two held from
before, both carted, were locked in the wagon for good). The keyed shelf, which runs no ladder, refuses it in doBuy
before the gold and the row are taken, and says the same words. The bag is no decor piece (`decorItems.js`
decorStandOf - the audit's 2: a piece leaves the pack and comes back past the ladder, so one set out and a second bought
made two). Nothing else is refused for a bag, and a character holding two from before keeps them (no save is
rewritten). Not closed, and why: a companion's pack forced back into the player's (`navalTransfer.js` with `force`)
takes whatever it held, a bag beside a bag among it - a second bag adds no room (the bag's list and its 300 kg are the
character's), so it is a bag held twice, not a gain. The four hosts: every
trade and keyed shelf is `scenes/worldModes.js`'s; the take ladder is the one module every host's windows call.
Pinned by `test/systems/professions/fb1004_onebag.test.js` (6); `tools/mutants/fb1004_onebag.json` (8, all dead). The 97 line cites into
worldModes.js that ENDLESS-STOCK and ONE-BAG moved, re-resolved by `tools/citeShift.mjs` (struck ones kept, but the
one CD4 gates).

## The audit (2026-10-04, Mac: "Audit when your done")

Three readers, one a fix - the gathering, the shelves, the one bag - each finding reproduced against the real modules
before it was fixed, then pinned and its fix mutated.

| # | Found | Fixed |
|---|---|---|
| ENDLESS F1 | Online a Campfire's asking price is halved (`essentialPrice`) and a shop's buy-back cap is not, so one bought at a cheap shop sold dear at another for +4 to +13 gold, without end once the stock never ran out (the bag +20 a trip) | No shop buys back what never sells out, online (`shopBuysItem`) |
| ENDLESS F2 | One sold to any shop landed on its shelf and made that shelf endless - a Pawn Shop that rolled none, a General Store's second shelf | The same: nothing endless is bought back online |
| ENDLESS F3 | "a second bag bought is the buyer's choice" outlived ONE-BAG | The sentence deleted |
| ENDLESS F4 | The restock ran offline too | Online alone, as the bag is |
| ONE-BAG 1 | Two bags held from before, both carted, could never leave the wagon, and none could be bought | A bag out of the character's own wagon is never refused |
| ONE-BAG 2 | The bag stood as a decor piece: out of the pack past the loaded-bag rule, back past the take ladder - two held | No decor piece |
| PACK-OVER A/B | No pin held the overflow's rot words or C&C, nor the world's save for a harvest wholly past the weight | Pinned (`fb1004_packover`, its audit tests) |
| PACK-OVER C | A pump settling five kept harvests over the weight said the long line five times, a rank's rise pushed out | Said once in ten seconds (`OVER_SAID_MS`) |

Not changed, and why: a companion's pack forced back (ONE-BAG, above); and a swimmer with a max carry under 62.5 kg who
starts a cast with room for one fish can be carried past DFU's afloat limit by the haul (motor.js afloatMessageStep) -
DFU's own Foraging net does the same, and the weight's consequences are DFU's (PACK-OVER).
