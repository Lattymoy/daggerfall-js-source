# AUDIT HOME-PRICE - the online home's price, before the merge, 2026-10-04

The ask: *"Audit this"*, of HOME-PRICE (a873afbac, `06-Systems/Economy-Arc.md`: an online home priced by the ground its
model stands on and its town's size, 5,000-250,000, the service holding the range; the sale box asking what the sale
pays; the Empire's account named and every sum with its thousands). Four lenses read a frozen snapshot (5c15daed6, a
worktree nobody wrote to while they read - DO NOT FIX WHILE THE VERIFIER IS READING): the law and the service (L), the
client and the four hosts (C), the economy and what players see (E), and the records, the tests and the mutants (D) -
the last throwing 24 mutants of its own at the new code, eleven of which survived. Main (#586) was merged before the
fixes (29e8a89c4, every conflict a line cite, `tools/citeMerge.mjs`).

Every finding below was read again on the tree before it was fixed. The new code is mutation-proven:
`tools/mutants/homeprice.json` 56 of 56 dead (26 before the audit, every survivor the lenses found among the new 30),
and the records the fixes moved were re-aimed by content and killed again (PIN MOVED, below). One older survivor came
with it: `auditrealm.json` AUDIT-REALM-L1F3-the-price-refunded, alive since AUDIT REALM because every fixture paid its
price, dies under `test/systems/homeprice.test.js`'s home whose price and payment differ (D2).

The one decision asked: C1, a knightly order's free house sold back online - "Online price".

## The law and the service (L)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| L1 | Minor | The account service's law changed (the range on a claim and a hall, the town's `refund`) and `ACCOUNT_VERSION` stayed acct74 - so `deploy.yml`, which publishes the site once `/v1/health` answers the version, could have put HOME-PRICE's client in front of acct74's service: no `refund`, the box falling back to the new price's share of a home bought at the old one. | acct75 (`service.js`, `wrangler.toml`); the twelve tests that pin the live version re-aimed, and `gatekeys.json`'s record. |
| L2 | Minor | "A build from before is asked to update" held only where Daggerfall's price fell outside the range: an old build bought any house whose radius x 1280 landed inside it, at that price (reproduced: 124,544 seated). | `homePriceOk` takes whole hundreds alone - the law's own rounding; Daggerfall's price is a whole hundred about one house in a hundred. `realm6`'s refusal moved a hundred over the floor. |
| L3 | Minor | The town's `refund` went to every home of the account (`mine`): a home from before the realm (its `price`'s share) and another character's - neither a sale that character's door can make (realmRelease's DELETE names the acting record; reproduced: 404 `no-home` on both); the record said the first was sold at it. | Told only to the named character's own realm home that a record paid for (`realmSaleOf`); the homes.js comment and the Economy-Arc corrected. |
| L4 | Nit | `realmGoldLaw.js`'s customs comment, edited by HOME-PRICE, still said a Daggerfall house costs "tens of thousands" and 100,000 is "the top of that range". | Rewritten from the field's prices, and the online buy-back's cap beside them (with E5). |

Checked and sound: no stored price is ever validated (a 1,000,000 home still sells, moves out of the arena and sells
as a hall); `home-update` is 426 on both routes and never counted against the hour's claims; the law fuzzed over a
million inputs never answers anything but 0 or a whole hundred in the range.

## The client and the four hosts (C)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Minor (older than HOME-PRICE) | **A knightly order's free house was gold online.** "Receive House" at rank 9 has no online gate and hands a Daggerfall deed not marked `crossed`; the bank's online sale bought it back at radius x 1280 - up to a million, four times the dearest home, once an order a character - into the Empire account. And the grant could name a building another player owns online (HOME1: one owner a building). | Asked; "Online price": the bank buys the deed back at the deed share of the same online price (`deedSellPrice`, `sellHouse`'s caller-named `price`, `townBlocks` on both hosts' directories), at most 212,500; the grant skips every player's home and waits for the town's homes to be read. |
| C2 | Nit | A claim answered `repeat` wrote the client's row from `home.price` and dropped `crossed`: for a home customs carried in, the box asked "Sell your home for 510,085 gold?" until the town was read again (the service then refused it). | The claim's answer says what its sale pays (`refund`) or that it is `crossed`; the client writes the row from it. |
| C3 | Nit | The box named the deed's share alone; the sale pays the rent held on the home too. | The town tells the named character's own home its `rentDue`; the box asks "... and the R gold of rent you have not collected?" The pieces' half stays said in words. |
| C4 | Nit | Home-adjacent lines kept bare numbers and the region's account: the rent's, the decorator's collection, a sold deed's pieces, the arena move's refund. | With E4. |

Checked and sound: every price the client shows or sends is one chain (`homeOfferPrice` - `homeListPrice` -
`homeOnlinePrice`); both hosts that build a door's record set `townBlocks` (WD3's relayouts and streamed neighbours
read their own location); Daggerfall's meshes are centred on x and z (RMBLayout.cs:874), so the box's origin inflates
nothing; one `getMesh` a door-text recompute, as the radius was.

## The economy and what players see (E)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | Minor | The home sink shrank and is capped (three homes at most 750,000 where the field's reached about 2.1-2.5 million; a hall 375,000 where one asked 1,274,880), and holding a home costs 15% of its price - eighteen exclusive buildings an account, cheaply. The record never said so against its own guardrail ("a sink that scales with wealth is a prestige one"). | Said in the Economy-Arc ("The sink this leaves"): the prestige sink is decor, the look and the stations; a floor, a per-account cap or upkeep are open numbers if squatting shows. Nothing changed - the range is the ask's. |
| E2 | Minor | An out-of-date build (an old desktop copy) still buys at Daggerfall's price inside the range, and its sale box still quotes 85% of the old price; its refusal says "Reload", which a desktop copy cannot. | L2 closes the buy for all but one house in a hundred. The box and the words are the old build's own - the service sends only a word - so they are said, not fixed: the gold is the service's sum either way, and the line after the sale says it. |
| E3 | Minor | The patch notes stated invented sizes as prices ("a large house in Daggerfall costs about 120,000"), and the cap binds from 303 m2 in an 8 x 8 city: a large city house may well sit at 250,000. | The notes and the record give them as examples ("a 12 x 12 m house in Daggerfall is 118,800") and say where the cap binds. Unmeasured: no ARENA2 here. |
| E4 | Minor | At one door: "Buy it: 45,000 gold" beside "Rent a room: from 10000 gold a day"; the sale's "your account at the Bank of the Empire" beside the rent's "this region's bank account" - online the rent lands in the Empire account too. | `systems/homeWords.js`, one spelling: the rent's rows, window, confirmation and shortfall, the decorator's offer and collection, a sold deed's pieces (`accountWords`, the account the half went into), the arena's refund. The guild founding line (`ui/socialPanel.js`) is not a home's and is left. |
| E5 | Nit | The old range was cited three ways ("tens of thousands", "over a million" of a house, 706,000 uncited). | One reading everywhere: a few thousand to over 800,000 a house (706,000 is FIELD BUGS 2026-09-30 #1's 600,100 at 85%; 849,920 is HALL-GOLD's hall less its half), a hall over a million. |
| E6 | Nit | Comments still described the old sale and the region's account (`worldModes.js`, `onlineHomes.js`). | With D7. |
| E7 | Nit | The record called the sale box a standing bug; before HOME-PRICE the client's price and the paid one were one number. HOME-PRICE made them two, and the fix closes the gap it made. | The Economy-Arc and the pull request say so. |

Checked and sound: no faucet - the sale pays 85% of what was paid; an old home sold and bought again cheaper is a
rebate of gold already spent; every example number recomputed; "Bank of the Empire" is where both ends move the gold.

## The records, the tests and the mutants (D)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Minor | The hundred's rounding could round up: the one non-hundred case rounded up under either. | `homeOnlinePrice(36.1, 1)` is 10,800 (a ceiling says 10,900). |
| D2 | Minor | "The refund off the price" survived its own pin: the fixture paid its price. | A home bought at 706,000 and paid 600,100; it kills AUDIT REALM's older survivor too. |
| D3 | Minor | The rent clause's thousands were unpinned (every rent case was 40). | 1,500 of held rent, pinned. |
| D4 | Minor | The hall's range was pinned only by its source's text. | `guild1d_service`: a hall at 600,100 and at 20,050 refused `home-update`, the treasury untouched. |
| D5 | Minor | The door's chain never ran: reading the model by another key priced every house at 0 and survived. | `houseFootprintM2`, `homeListPrice` and `deedSellPrice` lifted from `worldModes.js` and run over a fake ARCH3D. |
| D6 | Nit | A refund of nothing (a record that paid 1 under the old law) was unpinned at three sites. | Pinned at the service, the registry and the offer. |
| D7 | Minor | RETIRING A FLAG DELETES THE SENTENCE: the region's account in `Online-Arc.md` (twice), `worldModes.js` (four comments), `onlineHomes.js`, `homes.js`; "Daggerfall's bank's" price in `halls.js`; a test message and a garbled comment. | Each replaced. |
| D8 | Minor | "Priced off that model's radius ... what Daggerfall's bank asks" for the door: `talkTopics.js`, `Active-Arcs.md` HOME1, `Beautiful-Towns.md`, `home1`'s title. | Each says the door's online price and the bank's offline one. |
| D9 | Minor | A SLICE CLOSES ITS LEDGER ROW: `Port-Ledger.md` REALM P2.2b's OPEN and `Realm-Arc.md` P2.2b's "a client that names a low price buys cheap" stood whole. | Both NARROWED: a home's price is held to the range in whole hundreds; a piece's is still the client's. |
| D10 | Nit | "Customs' count of a deed reads Daggerfall's own price" - customs counts every deed at `CUSTOMS_HOUSE_PRICE`. | Corrected in the Economy-Arc and `homeLaw.js`. |
| D11 | Nit | "Every sum a home's lines say carries its thousands" was too broad. | The rent's now do (E4); the decorator's piece lines (mostly hundreds) are said to print bare. |

Also from D's list: `HOME_TOWN_BLOCKS_MAX` pinned equal to the automap's `EXT_NUM_MAX_BLOCKS` squared; the range test
asserts nothing was paid as well as nothing seated. Checked and sound: every cite moved by citeShift and citeMerge
names the same line content before and after (201 of 201; the one difference a Ledger cite into `motor.js` that was
already wrong on main, F067, left as main has it).

## Said, not fixed

- Sentences from before EMPIRE-ACCOUNT that still name the region's account outside the home's own lines - the
  Ledger, Testing.md, the Accounts and Realm arcs, Online-Arc's rent and decor sections, `rent.js`, `decor.js`,
  `homeYards.js`, `decorTool.js`'s header - are EMPIRE-ACCOUNT's to close, not this change's.
- Unmeasured without ARENA2: the spread of real house footprints over the range (how many sit at the floor or the
  cap); whether any Beautiful Villages/Cities house record carries WD1's x/z scale, which the footprint ignores as the
  radius did; whether the crafting stations' fees were set against the old home prices.
- A realm claim that lands on acct74, loses its answer, and is asked again of acct75 at a price off the hundreds
  would be answered `home-update` rather than `seq`; the next checkpoint's `seq` ends the session and the record
  stands. Two service versions at once; not reproduced.

## PIN MOVED

`home1` (the town read names no character - no `refund`; the claim's answer carries one), `homerent` (the collected
rent goes to the Empire's account), `realm6` (a hundred over the floor), the twelve live-version pins (acct75),
`auditrealm2_service`'s message. Mutant records re-aimed by content: `home1.json` HOME1-price-bound-off-by-one (the
hundreds), `realm6.json` REALM6-second-press-pays (the repeat's sale), `empireaccount.json`
EMPIRE-ACCOUNT-house-sold-to-the-branch (the sale's price its caller's), `gatekeys.json` GATEKEYS-the-empty-var-back
(acct75), and main's two `survtiers3.json` cite records at the merge.

The tests: `test/systems/homeprice.test.js` (8), `test/net/guild1d_service.test.js` (D4), and the moved pins above.
