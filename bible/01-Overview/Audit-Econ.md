# AUDIT ECON - the economy triage, before the merge, 2026-10-01

The field: *"lets audit this and ensure it's perfect"*, of the economy triage on `claude/pensive-gauss-tk2ahf` -
WEAR-VANILLA (86e06a80), ECON-PLAN with REPAIR-RATE, KIT-CEILING, POTION-COMMON and COMPANION-WEIGHT (825ee2f4), and
7acf7b5b's repairs to the five test files main's last merge left unparseable. Six lenses read the snapshot (825ee2f4,
frozen) on the repo's own harnesses: wear (W), repairs and kits (R), the potions (P), the companions' packs (C), the
online lane, the services and persistence (O), and the records, tests and mutants (D) - the last throwing mutants of its
own at the new code. The fixes ride the same branch, in two commits: e2da5f29 (part 1: P1, C1, C2, C5, C3 and P2-P4's
records and pins) and this one (the rest).

Every finding was re-run before it was fixed and is pinned by a test that fails on the code as it stood. The new code is
mutation-proven: `tools/mutants/sellasfound.json` 6 of 6 dead, `wearvanilla.json` 18 of 18, `repairrate.json` 20 of 20,
`potioncommon.json` 14 of 14, `companionweight.json` 21 of 21 - every one the lenses saw survive now dies - and the ten
older records the fixes moved were re-aimed by content and killed again (PIN MOVED, below, beside the two of
`wearvanilla.json`'s own that W1 moved).

## The online lane (O)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1 | Major | **Repairing worn loot to sell it paid every player online.** Roleplay & Realism: Items' condition prices are the room's and its rolls hand loot over at 20-75%, so a sale climbs with a repair; at REPAIR-RATE's third the repair cost less than the sale it added. A value-1000 piece found at 20% at a quality-10 counter: -97 at the old two thirds, +102 now (Mercantile 30 / Personality 40), +180 for a top haggler; a Daedric longsword +2,592. | **SELL-AS-FOUND**: each of the mod's rolls (a pile's, a body's, a shelf's) leaves the condition it set as `foundCondition`, and online the Sell arm reads a piece no higher (`tradeModes.js saleConditionPercentage`). A repair or a kit is for using a piece; wear after the find still lowers the sale; a piece handed over whole is untouched; offline the mod's prices stand. Ledger A. `test/sell_as_found.test.js`. |
| O2 | Minor | WEAR-VANILLA reversed REALM P0.2's own decision - `fadingEnchantedItems` off was a hole the room closed - and recorded it in the Ledger only; `onlineLane.js` still called the room's rule a hole, and said every forced key is the mod's shipped default (`equipDamage` is the port's). | `onlineLane.js` and `06-Systems/Realm-Arc.md` record the reversal: the item sink given up by choice. |
| O3 | Nit | No deploy note, and the account service redeploys on `net/recipeLaw.js` to a byte-identical bundle. | "Deploy: none" on each row; this commit touches no file either service bundles (esbuild's inputs, both entries). |

## Wear (W)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W1 | Major | **Gear still wore 1.3-2.5 times DFU's rate a swing.** The overhaul's redone armour formula (on as shipped, forced online) lets nearly every blow land, and DFU's member was handed the damage before the armour's reduction: a level-20 player in Daedric lost 2.5 times DFU's armour to a Knight's swing. | DFU's member is handed the damage the blow DEALT, below the reduction, as the duel read it already: armour 0.71-0.86 times DFU a swing, a blade 1.17-1.22 times, the same seeded fights. The module on keeps the mod's own wear. A Daedric longsword's upkeep 1.65-3.20 gold a landed hit. |
| W2 | Minor | Roleplay Realism's `equipDamage` has no screen, so the patch note's way to turn it back on could not be followed; were it on, its x5 would now ride the overhaul's path. | The patch note names only the overhaul's tile; the reach is recorded (Ledger, `05-Combat/Physical-Combat-Overhaul.md`). |
| W3 | Minor | The core's wear call was pinned circularly (the expected wear read off whatever the member was handed): seven mutants survived - the damage before the reduction or doubled, the held sabre before the natural-attack swap, the struck part dropped, a foe's blows wearing nothing, the rolls or the voice dropped, the module's stand-in lost. | An armed Knight's blows through the core on an iron-clad player: the member handed each blow's dealt damage, DFU's amount on his weapon and the struck piece, every draw off the handed rolls (Math.random throws), a break said; an Orc with a sabre his own row out-hits wears nothing. |
| W4 | Nit | Turning the old wear back on is harsher than the old default (the mod's own rate, not BALANCE1's 0.6). | The patch note says so. |
| W5 | Nit | The overhaul's shield roll can block on a part the shield does not cover, and DFU's routing then wears the piece under it. | Decided: DFU's routing, recorded. |
| W6 | Nit | Stale comments in `onlineLane.js` (O2's); fading alone shows On and does nothing - the mod nests it under its wear module, and that predates this. | Fixed (O2); the nesting recorded, unchanged. |

## Repairs and kits (R)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | Minor | **The ceiling brought back MEND-AIM's complaint.** A worn cuirass at 80% left the chooser and a lone flail carried to sell at 20% took the kit unasked. | One target while the ceiling holds another back asks: one row, and Keep. A lone piece alone is still mended unasked. |
| R2 | Minor | A piece a kit took to the ceiling stood a point under it a blow later and came first again: a whole kit for a point ("75% to 75%"), from the hotbar, the no-art fallback and the chooser's focused row; the chooser rounded where the card truncates. | A kit gives more than a hundredth of a piece's condition or passes it by (`kitGives`); the rows and the mend's words read the card's percentage. |
| R3 | Minor | The hotbar struck gold under a kept kit - now the answer for any gear between three quarters and whole. | Each refusal is a refusal; the slot says what its arm left unsaid (`quickslots.js`; Foraging's tool line marks itself said). |
| R4 | Minor | Unpinned: the ceiling's rounding (every test piece divisible by 4), the refusal read off the wagon instead of the pack, the floor under the third (only a Fighters Guild discount reaches it), the discount's order. | An Iron Dagger 37 of 50; a wagon's kit; a rank-5 member's 1 gold; 280, never 279. |
| R5 | Nit | The smallest pieces stop at 74% and were refused as "past 75%". | "A kit mends nothing past three quarters." |
| R6 | Nit | 9,216 is the pre-haggle figure; a blunt weapon's normal band runs to 91%; "never past whole" stale. | `06-Systems/Economy-Arc.md`, `smithItems.js`, `06-Systems/Professions-Arc.md`. |

## The potions (P)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | Major | Every shelf model is a container stocked whole, so a five-shelf alchemist stocked five days' potions. | Part 1: the counter's shelf alone (shelf 0, `openMerchantSell`'s). |
| P2 | Minor | Roleplay & Realism: Items' alchemist potions already sold Healing at twice the price; "no ordinary shop sold one" was false as shipped. | Part 1: the record says so. Both stacks merge at the first one's value - cosmetic, a potion never sells. |
| P3 | Minor | "Dungeon treasure piles" - five of the nineteen dungeon types key their piles outside J-O. | Part 1: "most dungeons". |
| P4 | Minor | Five mutants survived: the potion registered under the kit's name (field kits gone from piles), the install before the smithing install, the piles widened to I-P, both counts rounded. | Part 1's pins; 14 of 14 dead now. |
| P5 | Nit | `potions.js` cited the shelf's painting code for the recipe arm (wrong at base too). | Re-aimed to `shopStock.js:237-244`. |
| P6 | Nit | In a mixed-version rollout an older client restocking first leaves a day's alchemist without them. | Transient; no relay version moves. Recorded. |

## The companions' packs (C)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Minor | A refused store into a full pack still marked a quest item dropped - DroppedItemAtPlace fired while the letter stayed in the bag. | Part 1: the room is asked above the quest arm. |
| C2 | Minor | The classic skin never showed his load. | Part 1: the remote panel reads "carried / limit kg". |
| C3 | Minor | "About 90 kg for a typical hand" is a Warrior's; a crew's Bard carries 67. | Part 1: 67-97 kg by class. |
| C4 | Minor | Pins read the source with comments in, on two-field bodies and weight overrides; seven mutants survived. | Part 1: both windows driven with minted bodies and items; this commit: the last three survivors pinned, 21 of 21 dead. |
| C5 | Nit | The limit was read off the body captured at the open; after a quickload a companion gone from the party still took items into a list nothing kept. | Part 1: read by his key at every look; a gone companion takes nothing - now a weightless quest piece too, above the quest arm. |

## The records (D)

D1 is W3. D2's survivors are P4's, C4's and R4's. D3-D6, every stale sentence: `05-Combat/Physical-Combat-Overhaul.md`
(two departures, not one; the scale 1; the mod's wear before the reduction, DFU's below it), `09-Testing/Testing.md`
(pcaao, repair_ease, modsonline, balance1's present-tense 2.8x and doubled count), `test/modsonline.test.js`,
`01-Overview/Audit-Watch-Kit.md`'s answered pack line rewritten, the patch notes as a player reads them, the four hosts
named in `03-World/Naval-Combat.md`, `06-Systems/Economy-Arc.md`'s Mercantile line (MERC-RISE). D9: `HEALING_RECIPE_KEY`
is loot.js's `CLASSIC_RECIPE_KEYS[2]`, one export. And the lens's own catch: wear_vanilla's "repairable" was never
checked - it is now, under AllowMagicRepairs as shipped. The market's wear is the client's word: under KIT-CEILING a lie
about it buys a smith's work for the listing fee - re-decided in `06-Systems/Professions-Arc.md` and the arc: gold such a
client can write for itself, read by the Phase 1 ledger.

**Found while fixing.** Part 1's shelf index broke two source pins it never ran (`rri2_realism` and `csa_items` counted
the counter's call alone); both read either door now.

## Kept as they are

- **D7, the cite shift's narrative quotes.** `tools/citeShift.mjs` moves a cite inside prose that narrates an old stale
  number (`10-UI/UI-Arc.md`'s pairs, `07-Rendering/Performance-Updates.md`'s reading of 09-25) as it moves any other:
  every run before this one did, and the numbers carry no claim a test reads. Changing the tool is its own slice.
- **D8.** 7acf7b5b's message counts 99 tests in the five repaired files; they declare 93 (herald's 6 make 99). A pushed
  message is not rewritten.
- **Offline shelves restock** on every map-pixel crossing, as every shelf good does; a potion bought is gold spent.
- **Main's own failures**: citedrift CD4 and CD8, and four mutant records QS6 F7 names (soc1 S38, survtiers x3) - red on
  the base before any of this.

## PIN MOVED (re-aimed by content, killed again)

`fb0929.json` FB0929-the-sale-counts-pieces and `jan1.json` JAN1-the-sell-arm-reads-the-value-raw (the Sell arm's
condition read); `fb0930b_toolsaid.json` TOOL-USE-the-way-unsaid-on-the-hud and TOOL-USE-the-way-strikes-gold (the tool
line's `said`); `forage1.json` FORAGE1-30-a-refused-press-strikes-gold (the refused arm says its words);
`mend_aim.json` MEND-AIM-never-asks and `prof3.json` PROF3-kit-not-spent (the kit's lone row and its percentages);
`potioncommon.json` POTION-COMMON-shelf-loop-dropped (the first shelf); `companionweight.json`
COMPANION-WEIGHT-split-lost and COMPANION-WEIGHT-refusal-unnamed (part 1's gone pack); `wearvanilla.json`'s two core
records (the call moved below the reduction).

## The deploy

None. No file of this commit is in the relay's or the account service's bundle (esbuild's inputs from both entries);
`ACCOUNT_VERSION` and `RELAY_VERSION` stay where they are. The new item field rides the wire as a declared whole number
an older client carries through untouched.
