# AUDIT CRAFT-WRITS (2026-10-22) - CRAFT-PAYS, POT-THIN and CRAFT-WRITS, read cold

The owner asked, of the branch `ccr-4d19145b-ln41a1` at 1180a2395 (main's 0df2d87eb and two commits: CRAFT-PAYS and
POT-THIN, `06-Systems/Professions-Arc.md` section 48; CRAFT-WRITS, section 49; no pull request yet): **"Audit this"**.
This page is the audit: the laws, the service, the client, the pins, the mutants, the records and the gates. Each finding
has its verdict here. What the audit changed is written into the pages it touched, marked `AUDIT CRAFT-WRITS` with the
finding's id, and into the code beside each fix.

## How it was run

Four lanes. Each was a cold adversarial reader of a FROZEN head, 1180a2395, in a detached worktree of its own
(`Home.md`'s DO NOT FIX WHILE THE VERIFIER IS READING; a mutant edits files in place, so no lane shared the working
tree). Each was told to reproduce a finding before reporting it and to end on what it checked and found sound. Nothing
was fixed until the lane that found it had reported.

| Lane | Over | How |
|---|---|---|
| S | The account service: `craftWrits.js`, migration 0144 (0145 since the merge with main), the brew's `witnessed`, the routes, the sweep | 6 findings. Each bug reproduced on the real Worker over node:sqlite with inline scripts; SQLite's name resolution checked plain; EXPLAIN QUERY PLAN on the sweep; every bind index read against its SQL; a modified client's every field tried |
| E | The law and the economy: `craftWritLaw.js`, the pay, the draw, POT-THIN's numbers, the food | 8 findings. Every product's writ looped through the law; a Monte Carlo of the draw over 4,000 days for one character and six; the Court's per-tier maximum over every material its table holds; a silver loop costed per potion; the draw at every rank, NaN and Infinity |
| C | The client: `craftWritHost.js`, `profBook.js` craftDeliver, the Work tab, the words | 9 findings. The real host, `realmGoldAct` and `mountNoticeBoard` driven against the real Worker; the checkpoint order, the retries, a character switch mid-act; every locale's 25 keys formatted at n = 1, 2, 5 and 21 |
| T | The pins, the mutants, the records and the gates across both commits | 7 findings and the low ones. 1,014 tests over every file the change touches; each mutant run in memory through a loader hook; every record's number re-measured; the bible gates, `hostceiling`, `regenOpenFlags --check` |

Every finding was checked against the code before anything was fixed: a bug by a pin that fails on 1180a2395 and
passes at the fix; a gap by its surviving mutant, re-run; a doc finding by the line it misstates.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| S1 (= T1) | HIGH. A potion writ was refused after ANY other crafting writ was filled. The decision passed `craft_writs.product` into `brewedLeftSql`, and inside its subquery `FROM craft_writs` SQLite read it as the subquery's own row: the product test always true, every writ the character had filled, of any product, subtracted from its brews. The board bound the product and showed the right count, so the card offered Deliver and the service answered `craft-unbrewed`. Reproduced (a stew writ, then two Healing brews: `brewed: 4`, 409) | FIXED: the product bound (`?11`, the slot the potion form leaves free - a 13th bind the piece form never named threw the whole batch, found while fixing). Pinned: a stew writ, then a potion writ filled. One mutant, dead |
| S2 | The board listed pieces the decision refuses: `pieceOkSql` aliased its own subquery `pr`, the board's outer alias, so `pr.provenance = pr.provenance` asked only whether ANY eligible piece existed - a listed, bought-back or homed piece was offered beside a good one | FIXED: its own alias (`pk`). Pinned: listed, gold-walled and eligible side by side, the eligible alone named. One mutant (the alias shared), dead |
| S3 (= C2) | HIGH for a cook. The card's pieces were the OLDEST twenty made - rows outlive eaten dishes and spent kits - so a seasoned cook's pack was never named and Deliver never lit (23 stews, the newest 3 kept: `made: 0`); the service took the same three asked directly | FIXED: newest first (`made_at DESC, rowid DESC`), sixty at most. Pinned (the order, and the dish test's three newest first). Two mutants, dead |
| S4 (= C1's service half) | A writ filled before, asked under a NEW request id, answered `ok, repeat` with no `realm` (the Court writ's AUDIT 29 A16 rule, safe for Stores units, not for a record's goods): `realmGoldAct` read "no seq" as "nothing moved" and the client kept the goods it took out | FIXED: refused `craft-writ-filled` (409), nothing moved; the refusal in words (`account.refusal.craftWritFilled`, thirteen languages). Pinned. One mutant (the old repeat), dead |
| S5 | A same-request race over two writs, or a batch that failed after another act, answered `craft-unbrewed` though the request had filled the other writ | FIXED for the race: the request id read again after the batch (deliverWrit's own `byRid`). Pinned with a proxy that hides the row once. One mutant, dead. LEFT: another act moving the record to exactly this act's sequence still reads as this act's refusal - the goods are put back right, only the words are wrong, and `disenchantPiece` has the same pattern |
| S6 | The hour's sweep scanned the whole table, which grows for good (a filled writ stays) | FIXED: `idx_craft_writs_open` (migration 0145, unshipped). Pinned by its query plan. One mutant, dead. LEFT as measured: `pieceOkSql`'s `prof_crafts` OR is per candidate piece, bounded by the player's crafts; the board's read is five or six statements more |
| E1 | HIGH (economy). The cap was counted per account, but each living character was asked three of its own: an account of six chose its best three of eighteen (six Novices averaged 120 a day; rank 10, 340 mean and 468 at most). The record's maxima were one character's, "under the gatherer's at every tier" false at tier 2 (Restore Power 156 against a tier-2 Court writ's best 96), and its two named knobs barely moved the pay: 24 of 32 products pay the floor | FIXED: the draw is the ACCOUNT's - three a day from its own dice at its best crafter's ranks, posted on the first board read by any of its characters, filled by any of them with its own goods (`filled_char`, `UNIQUE (day, player, slot)`; the deleted-character line in `realm.js` gone - nothing of the writs is a character's). The record's faucet re-measured (60 to 74 below rank 10; 60 to 216 from rank 10; 300 to 380 for a Master), the floor named as the lever. Pinned: the account's draw, a second character reading the same three, the filler's own brews and XP. Five mutants, dead; `svc-cap` judged equivalent (the schema holds the day's three). RECORDED for the owner: a Court writ is a raced, shared supply; a crafting writ is every account's, so the faucet grows with the players |
| E2 | A silver loop: the Apothecaries sell at a reagent's value, a brew of bought reagents is witnessed, and the pay marked every input up half again - Restore Power is 92% counter goods by value, Heal True 94%; every writ potion netted silver with every reagent bought (Purification +106 a writ) | FIXED: the goods only a counter sells (`COUNTER_ONLY`) paid at cost, the gathered half again. Restore Power four for 108 (156), Healing 32 (42), Resist Fire 68 (90), Heal True 76 (111). The table re-pinned. One mutant, dead |
| E3 | A potion recipe SHEET (MiscItems 278) carries the potion's key, so a writ counted and took it as a bottle | FIXED: a bottle is DFU's potion template (`UselessItems1[1]`). Pinned (a sheet, a sheet's key on the wrong group). One mutant, dead |
| E4 | The Daedric Repair Kit was drawn (a fifth of a Master smith's kit writs) and nothing yields its ingot | FIXED: no kit of an UNYIELDED metal. Pinned. One mutant, dead. The record's "a Daedric one 140" and its 400 struck |
| E5 | POT-THIN's records: Loot-Arc's RENOWN-LOOT table at its old potion numbers; the `*_BEFORE` constants no longer the live game's; offline cut too, unsaid; SEARCH1's searchables unnamed | FIXED in Loot-Arc section 20, `healingSupply.js`, `renownLoot.js` and Professions-Arc 48.2. The constants' names kept, so every pin and record reads them as they stood |
| E6 | `craftWritOf` took any count (a stew writ of 1,000 asked 33, past the table's CHECK, and its INSERT OR IGNORE would drop the row); `craftWritsFor(day, id, null)` threw | FIXED: the count bounded at 20 (`CRAFT_WRIT_QTY_MAX`), a null read as no ranks. Pinned. Two mutants, dead |
| E7 | The kits' margins unrecorded: three Iron kits of bought leather at a public forge come some 7 silver under their pay; the kit's `cost` counts Cured Leather at its value, not the smith's price | RECORDED in 49.3 - every kit pays its floor, so the leather's value moves none |
| E8 | 48.1's "a cooked meal feeds 240 minutes" (a Cooked Fish 200); `healingSupply.js`'s "carries one 9 times in 100" (an expected count) | FIXED in both |
| C1 | HIGH. A second press on a filled writ destroyed its goods: the window never marked the card filled before the list was read again, and an `ok, repeat` with no realm kept the goods taken out | FIXED in four places: the service refuses (S4); the host puts the goods back on an `ok` that moved no record; the card is marked filled at once; the book reads a list asked while the fill was answered again. Pinned on each. Three mutants, dead |
| C3 | A LOCKED piece or bottle (LOCK1) was handed over - the disenchant's list and the market refuse one | FIXED: never locked, in the shared law (client and service pick alike). Pinned. One mutant, dead |
| C4 | A realm act that LANDED (its answer lost) refreshed nothing: no track, no Renown, until the next read | FIXED: the book read again at once (the disenchant's own, AUDIT PROF-541 R2-C1), and a record moved under the ask marks it stale. Pinned. Two mutants, dead |
| C5 | "a Adamantium Repair Kit", "a Ebony Repair Kit" | FIXED: "one {name}"; the thirteen languages re-drafted. Pinned. One mutant, dead |
| C6 | The realm's silence said as "Could not reach the account service"; `elsewhere` as the generic error | FIXED: their own words (`notice.craftWrit.unknown`, `notice.craftWrit.elsewhere`). Pinned. Two mutants, dead |
| C7 | The card's `brewed` and `pieces` stood a minute behind the station, Deliver dark | FIXED: a brew, a dish or a kit lets the Work list go. Pinned on the real Worker. One mutant, dead |
| C8 | The day's three filled said only on Deliver's title (a phone has no hover); every card's button named only "Deliver" | FIXED: on the card and in the button's accessible name too. Pinned. One mutant, dead |
| C9 | Whole records put back at the pack's foot; no try/finally (a throw would hold the board busy); `piecesOf` could offer what the pick refuses | FIXED: back where they stood; a throw puts the goods back and frees the board; `piecesOf` reads the law's `pieceOf`. Pinned. Three mutants, dead |
| T2 | MEDIUM. A kit writ refused every kit of bought leather: `bought_with IS NULL` refused `'marks'`, which is also a piece made of goods bought for silver (AUDIT PROF-541 B7), and every Repair Kit takes the Cured Leather the smith sells - reproduced (`pieces []`, 409) | FIXED: only gold's wall refuses (`bought_with IS NOT 'gold'`); a sold piece is its buyer's and a bought one keeps its maker's, so "never sold nor bought" still holds by `owner` and `char_id`. Pinned. Two mutants, dead |
| T3 | Lines with no pin: the sweep's filled guard and its day's grace (a sweep of filled writs would hand their brews back to pay again), the brews' character, five piece guards, the outbound hold, Renown on a track held, the crafter's limit, the Chapters gate, the Marks shut on both doors, the progress claim | FIXED: pinned, each with its mutant (fourteen, dead), and the two lane T ran in memory carried into the list (`T3-early-count`, `T3-brews-any-character`, dead) |
| T4 | The book's delivery had no behavioural test - a regex over its source | FIXED: a test against the real Worker - the kept id after a lost answer, the card's move, the reread, the generation, the slot guard |
| T5 | Records: "PIN MOVED `int16_progress`" (never moved); "prof12.json 209 dead" (212 records, one equivalent unsaid, so 210); test titles naming mutants that do not exist; the Work tab's count, the day's three's Deliver and "Filled by you" untested; `svc-room`'s why named the trigger (it is the marks table's CHECK); a vacuous `.every` | FIXED in each (the tab's count pinned, one mutant, dead) |
| T6 | Economy claims: "a Novice's about 100", "under the gatherer's at every tier", "Renown ... the Court writ's ratio" (a Court writ's Renown is `writRenown(tier, units)`) | FIXED in 49.3 (with E1) |
| T7 | Docs left stale by the change: Loot-Arc's table (= E5), the RENOWN-LOOT ledger row and `renownLoot.js`, Economy-Arc's potion numbers, section 37's "50 gold a brew" and "one below Journeyman", the transmutation fee halved unsaid, `items.js`'s "a quarter" (the Fish lost a third) | FIXED in each |
| T-low | `lootease.json`'s why strings at old numbers; Port-Status's "seventeen" (eighteen); `world.js`'s PROF8 comment trailing the new import; `fb1013e`'s docblock above the wrong function; a test comment on the wrong assertion | FIXED in each. LEFT: `aim` turns posted rows by hand - within the law's reach, and the board's posting is pinned to the law's draw |

## What it checked and found sound

- **No double pay, no gold to silver, no pay without the goods** (S): the decision's `filled_at IS NULL` and the request
  id's guards; the ledger's `UNIQUE (actor, 'craft:' || id)`; every write keyed on the nonce, so pay means the goods
  left and the rows went; a refused decision rolls the record's step back. Brews never spend gold; `witnessed` is decided
  in the brew's own INSERT before its loose units are spent; a modified client's ids, pieces and counts all fail.
- **Lost answers** (S, C): a retry at the same position reads `seq` and lands; a batch that landed and threw is read by
  its nonce; `dropIfUnnamed` keeps its object. The checkpoint goes first on the pick's own snapshot; goods leave once.
- **The draw** (E): three valid writs at every rank (NaN, Infinity and strings too); tier 1 always holds every kind;
  slot 2 never repeats slot 0; the kit slot follows `smithed`.
- **Client and service pick the same records** (E, C): one law, the plain bottles before the Potent on both ends, a
  stack giving part of itself alike; `potionRecipeKey` matches for all twenty potions.
- **POT-THIN's and the food's numbers** (E): every chance at every stage; 9 and 11 in 100; the dish weights and the
  vendored README's nine columns; the satiety reasoning against `eatLaw`.
- **The translations** (C): the thirteen whole locales carry every key, their placeholders the English's.

## After the fixes

- `test/net/craftwrits_law.test.js` 7, `craftwrits_service.test.js` 13, `craftwrits_client.test.js` 7 - all pass.
- `tools/mutants/craftwrits.json` 91 (50 of them the audit's; `delete-keeps-open` retired with the line it mutated):
  89 dead, 2 equivalent as recorded (`svc-room`, `svc-cap`), none survived. Nine re-aimed by content.
- The tests that read the changed code (2,203 across 210 files: the account Worker, the books, the Work tab, the realm
  routes, the deploy filter, the loot and survival rows, the locales): 2,201 pass, 2 skipped, none fail. Lint, types,
  the bible gates, `cites --check` (3,036 anchors) and `hostceiling`: clean. The whole suite is CI's (`verify`).
