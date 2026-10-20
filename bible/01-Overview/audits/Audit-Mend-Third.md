# AUDIT MEND-THIRD (2026-10-19) - a mend sells for a third, audited

Mac, of pull request #1058 (MEND-THIRD, `06-Systems/Economy-Arc.md`): **"Audit this"**. MEND-THIRD answered the
Discord's #feature-feedback "Bring back loot price based on the condition!" by crediting a third of every mend past a
found piece's mark on its online sale, and claimed that a smith's whole repair stayed a loss on the sale. This page is
the findings, each with its verdict; what the audit changed is written into the arc's record as it now stands
(`06-Systems/Economy-Arc.md` MEND-THIRD, Port-Ledger A's SELL-AS-FOUND row), each change marked AUDIT MEND-THIRD and its
id in the code.

## How it was run

Four cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 4e6a9c500, per Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding by a node script over the real modules before reporting it;
then every finding that moved the design, and every HIGH one, was reproduced again on the live tree before it was acted
on, and the design calls were put to Mac:

| Lane | Over | How |
|---|---|---|
| L1 - the doors | every door a sale or a repair goes through: guild discounts, the keyed repair, the Sell and SellMagic arms, the keyed shelf, patrons, the market, LAW-3, the online cap, stacks, wagons, buy-repair-sell loops, edge inputs | `tradeCost` and `getTradePrice` online, counters chosen apart, every rank of the Fighters Guild |
| L2 - the numbers and the faucets | every number the record stated, re-derived; what a player could mint per hour and per rest that SELL-AS-FOUND gave nothing for | 2,000,000-lot random grids, the real magic rounds through a rest, every metal's kit |
| L3 - the mark's life | every producer that hands over a worn piece, every transform of a piece, any way to lay the mark again | 7,440 bodies through the body chain, 3,200 room bases and their personal bonus, 200 new characters, the stack law, the re-mints |
| L4 - the record, the pins and the words | every sentence of the record against the code, the pins under 28 mutants of the lane's own, every word a player sees, the bible's gates | `tools/mutate.mjs --jobs` on a private copy; the 27 locale tables |

The scratch scripts are the session's (`scratchpad/audit/`); none is committed.

## The design calls (Mac, 2026-10-19)

- **"Only your own mends"** (L1-1, L1-2, L2-1, L2-2): a smith's paid repair adds nothing to a found piece's sale; a Repair
  Kit, Repairs Objects and the Varla Stone - its owner's own mends - sell for a third of what they put past the mark.
  No share closes the smith's door short of about 1/60, which would have taken the kit and the ring with it.
- **"Keep a third"** (L2-3): the ring of Repairs Objects stays at a third - the deliberate faucet, recorded with its
  real numbers.
- **"Fix it here"** (L1-4): a patron values a piece at the condition a counter reads, in this pull request, the account
  service with it.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1-1 / L2-2 | HIGH | **The smith's third paid again across counters.** The claim held at ONE counter: a repair priced at a cheap smith and a sale at a dear counter (shop quality, region index - 1.77x apart on an average online day) put a smith's whole repair back in profit: a Daedric cuirass found at 20%, Mercantile and Personality 100, a quality-1 smith and a quality-20 counter in one region +10,433; across the record's own regions +17,703 at Mercantile 30. SELL-AS-FOUND had shut it | FIXED (Mac: "Only your own mends"): the owner's own mends alone are credited (`systems/item/foundMark.js` - `selfMended`, `creditOwnMend`, `foundSalePercentage`); a smith's mend sells as found at every counter |
| L1-2 / L2-1 | HIGH | **The Fighters Guild's rank discount paid at one counter.** `guildServiceRepair` hands the guild's `reducedRepairCost` to the same walk: rank 6 +201, rank 9 +9,383 on that cuirass at Mercantile 30 | FIXED by the same: a discounted smith's mend credits nothing |
| L3-1 | HIGH | **An enchanted found piece fenced whole.** The SellMagic arm prices with no condition (DFU's), and the item maker enchants a found piece for one side effect at no gold: a Daedric cuirass found at 47% sold for 22,350 and fenced, unmended, for 47,553. Older than MEND-THIRD - SELL-AS-FOUND never covered the fence | FIXED: online a marked piece fences through its mark (`tradeModes.js` SellMagic arm); an unmarked piece and every piece offline fence as DFU's |
| L1-4 | LOW | **A patron read no condition.** `patronWorth` is the judge's floor, condition-blind: a found Daedric cuirass at 20% was worth its whole 153,600 (a cap of 92,160, the best counter paying 25,344 as found). Older | FIXED (Mac: "Fix it here"): through Roleplay & Realism: Items' condition price at the condition a counter reads (`net/patronLaw.js` patronWorth) - 30,720 now; deploy the account service (`foundMark.js` listed in `account-deploy.yml`) |
| L2-3 | MED | **Repairs Objects is the largest new faucet, and the record undersold it** (a steel longsword's 4 to 8 gold): one 8-hour rest over six Daedric cuirasses found at 47% adds 37,092 to their sale; a piece the ring mends whole sells about 37% above as found | RECORDED (Mac: "Keep a third"): the real numbers in `Economy-Arc.md`, bounded by the loot - no piece's credit passes a third of its room above the mark |
| L3-2 | MED | **PARTY-LOOT's personal bonus handed worn pieces over unmarked.** A foe's class kit wears every piece it adds (`combat/rriEnemyEquipment.js` wornCondition); PLAIN-LOOT's keep lets the sidearms go before the body's roll marks, and the bonus cloned them: 43 worn and unmarked of 3,200 room bases, each a smith's repair from selling whole. Older | FIXED: the kit's pieces are marked as they are worn - 0 now; the mod's dice unmoved |
| L1-5 / L3-3 | LOW | **A found book's stack merge and split handed it over whole.** Books stack; a merge keeps the held copy's condition and a split mints the part whole (DFU's): two copies found at 20% merged and split sold 247 against 49 | FIXED: a found book stacks only with its like (`inventory.js` stacksWith), and a split keeps a found book stack's condition and mark (splitStack). Arrows, which the roll marks too, still stack: no mend reaches an arrow, so its mark buys nothing, and a quiver takes every arrow found |
| L3-4 | LOW | **There's a Hole in the Bottom of the Ocean's re-mint kept a stale mark** on a piece it hands over whole: an Ebony longsword marked at 31% became a whole Orcish one that sold at 51% (against the player) | FIXED: the non-enchanted re-mint is unmarked (`world/oceanHoles.js`); the enchanted arm keeps condition and mark together |
| L1-6 / L2-6 / L3-5 | LOW | **A temper moved the maximum and left the mark**: a Daedric cuirass found at 47% sold at 43% after the gold its temper cost (against the player) | FIXED: the mark and the owner's mends move by the maximum's share (`smithItems.js` temperItem through `scaleFoundMark`, which WEAPON-POOL's repool now walks too) |
| L3-6 | LOW | **A new character's worn kit and the questions' dagger were unmarked**: repaired at a smith, a few gold a piece, once per character | FIXED: marked as they are worn (`rriKits.js`, `conditionRepair.js` repairUnmintedConditions) |
| L2-7 | LOW | **The Varla Stone is a free mend the record did not list** | FIXED with the design: the stone is its user's own mend, credited a third (`ayleidStones.js`); in the record |
| L4-6 | LOW | **A surviving mutant**: the third left fractional read one point high (two points of a mend past a Daedric cuirass's mark read 20, not 19) | FIXED: pinned (`mend_third.test.js`), mutant `MEND-THIRD-credit-fractional` dead |
| L4-1 / L4-2 / L4-3 / L4-4 / L4-5 | MED-LOW | **The retired law in present tense**: the Sell arm's comment, the sale's headline, an import's note (`tradeModes.js`), the keyed shelf's (`worldModes.js`), the moved pins' titles and an assertion message | FIXED: each rewritten for the law as it stands; the moved pins are SELL-AS-FOUND's own again (a smith's mend sells as found), so their original words are true |
| L4-7 | LOW | **The pull request's patch note overclaimed** "about nine tenths" for every smith repair | FIXED: the note rewritten for the rule as it stands - a smith's repair adds nothing to the sale |
| L1-3 / L2-4 / L2-5 / L2-9 / L4-8 | LOW-NIT | The first build's same-counter bounds ("never a gold over", "at most 0.899", the 0.90-2.76 range's ends) held on its grid alone - up to 3 gold over, 0.9015 off it | SUPERSEDED: a smith's mend is credited nothing, so the bounds are gone from the record |
| L2-8 | NIT | The kit's framing was loose - a kit pays from Moonstone and Dwarven up, and a Daedric Ingot is worth more forged into a cuirass (7,926 an ingot) than spent as a kit (3,804); a piece takes three smith's kits or four field kits to its ceiling | FIXED: the record says so |
| L3-7 | NIT | The record's coverage claims (every unmarked worn piece "handed over whole or found before this"; the mark through a chest and the market; the fence) | FIXED with L3-1 to L3-6; the classic save's imported pieces stay unmarked, recorded - the player writes that file |
| L3-8 | NIT | The wire accepts a mark over the maximum, or none | RECORDED, not changed: the sale is the client's own reckoning, so a modified client that can write a mark can drop it; no honest producer writes one |
| L3-2 (aside) | NIT | 44 of PARTY-LOOT's bonus pieces are loot-table rejects the body's roll never wore, handed over whole | RECORDED, consistent: a piece handed over whole sells whole - the law's own; wearing them would move the bonus's seeded stream |
| L1 (lead) | - | A guild repair asked from the street with no building reads `b?.quality ?? 0` and region 0's index (`worldModes.js` repairPrice) | NOT REPRODUCED without the world host; moot for the sale - a smith's mend is credited nothing wherever it is priced |

## What was sound

Every number the record stated re-measured true on its own grid (L2, L4); every Sell door walks `tradeCost`'s Sell arm
(L1); LAW-3 caps a counter-bought piece's mended resale, so the buy-repair-sell loop loses (L1); a held piece is never
re-rolled, so the mark cannot be laid again higher (L3); the import cycle `repairService.js` -> `tradeModes.js` reads
nothing at load (L1, seven load orders); the bible's gates passed on the snapshot (L4).

## Pins

`test/systems/mend_third.test.js` (3: the shape; a smith's mend at every counter, region and Fighters Guild rank; the
kit, the ring through a rest and the stone), `test/systems/auditmendthird.test.js` (7: L3-1, L3-2, L3-3, L3-4, L1-6,
L3-6, L1-4). `tools/mutants/mend_third.json` (10, 10 dead), `tools/mutants/auditmendthird.json` (14, 14 dead). Re-aimed
by content: `sellasfound.json` (two, to `foundMark.js`), `auditweaponpool.json` P1, `craftworth.json`'s SellMagic,
`fb1016b_stolengoods.json`'s merge, `mend_worn.json`'s two.
