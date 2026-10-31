# AUDIT POTION-MIGHT - POTION-CLOCK and EG-MIGHT read cold, 2026-10-31

The owner, of POTION-CLOCK (`11-Multiplayer/Elite-Gates.md` section 17.4) and EG-MIGHT (section 21.1), the day they were
written: *"Audit this"*. Four cold lanes read commit `3ccdcd7fb` in two frozen worktrees. Each was given the feature, the
owner's ask and the files, never a conclusion, and had to prove every finding with a script over the real modules, the
real account Worker or the real relay Room. The fixes went into the branch while the lanes read the snapshots. A lane
that mutates got its own worktree (Home.md, DO NOT FIX WHILE THE VERIFIER IS READING).

| Lane | Read | Found |
|---|---|---|
| A | the might's law and the account service: the judge, the verdict, the mint, the rollback | A1-A6 |
| B | the relay and the Spire's fight: admission, the purse, the shares, the stand-ins, the receipt | B1-B6 |
| C | the potion clock in play: every way to drink, the fight's count, the HUD, the thirteen languages | C1-C7 |
| D | the record and the pins: every claim, every number, 37 mutants of its own | D1-D11 |

Severity: HIGH a hole a forged client or an honest player meets; MED a wrong result; LOW an edge, a word or the record.

## Fixed - the might (lane A, lane D)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | HIGH | The might summed the whole pack: every carried piece's lines, every set piece in any slot, every Legendary and Gilded power at 100% whatever it did. A pack of guard Legendaries and six helms reached 1000 with a blow of x1.00; copies of one uid counted five times. | The kit WORN AT ONCE: one piece a place by the equip table's own classes, a ledger key's copies and a Legendary's record once, one weapon in hand, its slayer lines of one foe's kind (`kitMight.js:"function wornBest("`). Each power by what it adds to a blow (`powerBlows.js:"export const POWER_BLOW = Object.freeze({"`), a guard power none. |
| A2, D2 | HIGH | A Master's work counted as a 100% power; it has none. A forged work held trade and still signed `mg`. | No Master's work power. A kit the law holds signs none (`verdict.js:"might: lawHolds > 0 ? null : judged.might,"`). |
| A3 | MED | Any `martialPath` string added 40%; an unmastered skill at 200 added its climb. | A path held with both its skills mastered; the climb of a mastered skill alone (`kitMight.js:"return mastered.includes(s) && Number.isFinite(v) ?"`). |
| A4 | MED | A staff rollback left the rolled-away might on the row, and the next join signed it. | The rollback clears the arms and the might (`review.js:"arms_top = NULL, arms_bow = NULL, might = NULL"`). |
| A5, D1 | MED | Blow sources underrated or missed: sets beyond the largest, the sky (12 stars held 30% where the Renown's share gave 7%), Enhances Skill, an heirloom's generations, a Rare's imprint, spells. | Sets together in the nine places at their pieces' stage; the sky's blow off the character's own tree, read in the checkpoint's batch; Enhances Skill's +15, blessings, a set tier's and the sky's skill points; heirloom generations; imprints (`lootRarity.js:"export const powerIdsOf ="`); a spell's whole beside the blow's. |
| A6 | LOW | The sky's part was 1% at Renown 1, where no star is held. | Gone with A5: the mint signs the judged might (`mightLaw.js:"export const mightSigned ="`). |
| D8 | LOW | The weapon gear's numbers were copies pinned equal, and Short Blade's climb was paid where the client pays none. | One home, `systems/powerBlows.js`, the client's and the judge's; Short Blade's climb none. |
| D3 | MED | 20 of lane D's mutants survived: the might's rounding and its price, the kit's laws, Spillover's factor, the pip's seconds. | Each pinned or recorded below; `tools/mutants/egmight.json` and `auditpotionmight.json` all dead. |

## Fixed - the relay and the fight (lane B)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | HIGH | A re-entry took the newest token's might while the hall kept the health it woke with: a hall woken on no might, then a token of 1000, killed in 1.25 s against 14.25 s. | The first entry's might is kept, as the level is (`egBrain.js:"if (B.mem[sub]?.in) { B.mem[sub].seenAt = now; return null; }"`). |
| B2 | MED | STAND_IN_WHOLE at 9,750 left a bout's spell 250 of its 10,000: a Disintegrate beside a Damage Health was refused. | The Spire's stand-ins stand at their own whole (`gateBoss.js:"export const EG_STAND_IN_WHOLE ="`), every other at 975. |
| B3 | MED | The receipt and a hall's part compared raw damage, so a bare member of a geared company lost the Redoubt's receipt. | Damage at the reference (`egMight.js:"export const egRefDealt ="`). |
| B5 | LOW | A Spire spell's number read the Vestiges' factor alone. | It reads my token's might beside them (`online.js:"get might() {"`). |
| B6 | LOW | The relay's half was pinned by source text alone. | The fake room carries `mg`; socket, admission, purse and `pot` run through the real Room. |

## Fixed - the clock (lane C, lane D)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1, D4 | HIGH | A Purification's first effect is Cure Disease, so it waited on the `other` clock, yet it lands whole and heals as Heal True does: two heals every 15 s. | Where a bottle lands whole it is every kind it carries (`pvpPotions.js:"export function potionKindsOf(item, whole = !fight) {"`). |
| C2 | MED | A Heal True every 15 s outran the count's line: the relay felled members whose screens stood at 67%. | The room is told (`pot`) and believes the heal on its own 15 s clock, outside the budget (`egBrain.js:"export function egPotion("`). |
| C3, D6 | LOW | The retired law was stated as current. | The opening list, the Ledger A summary and the shouted rules say THE POTION CLOCK; the made law's record names it beside THE POTION LAW. |
| C4, C5, D9 | LOW | The pip was desktop only, and three kinds overflowed its chip. | Every layout; the chip wraps between kinds, never inside one. |
| C6 | LOW | The tile's seconds were not plural-aware in Czech, Russian, Romanian and Bulgarian. | ICU plurals in all four, pinned at 1, 3, 15 and 21. |
| C7 | LOW | A Levitation or a Slow Falling drunk where flight is banned was spent for nothing, its clock started. | Kept and refused in the level's words (`spireKit.js:"export function flightBottleRefusal("`). |
| D5, D7, D10, D11 | LOW | Deploy order, the four hosts, the sets' wording and the stand-in's cap were not said as the code does. | Said in sections 17.4 and 21.1 and at `standInBlowCap`. |

## Recorded, not changed

| ID | Sev | Finding | Why it stands |
|---|---|---|---|
| B4 | LOW | The purse's depth grows by the whole might, so a hall's opening blows fall at the whole. | Kept: a geared blow says its whole number, the owner's ask. Said in 21.1. |
| A5 | LOW | Flat adds (an elemental line, Venom, PotentVs's +5) are not read. | A few points a blow beside a purse refilled at three times the reference. |
| A5 | LOW | A kit past ten times lands ten times (the ceiling's own kit is x15.5). | MIGHT_MOST is the top; past it a breach's health share would outgrow its bodies. |
| A3 | LOW | The character law bounds a skill by SKILL_HARD_CAP alone at any level. | The might reads a mastered skill's climb only; a level's bound on skills is the character law's, for every reader. |
| C7 | LOW | A reload empties the screen's clock. | The room's health clock does not reset (C2), so the early bottle heals nothing the count believes. |
| D3 | - | The two seam joins' `mg` and the mimic's fight survive mutation. | Equivalent in play: the door closes at the first wake and a recall comes at a rest, so a member is always in the hall's shares; no pin drives a Kyn Mimic anywhere (before this audit too). |

Pins: `test/net/eliteGates/auditpotionmight.test.js`, `egmight.test.js`; moved: `fb1019f_standinwhole`, `potionclock`.
Mutants: `tools/mutants/auditpotionmight.json`, `egmight.json`, `potionclock.json`, every one dead; re-aimed by content:
`loot5`, `loot10`, `weapon_gear`, `martial`, `bal9`, `power-ceiling`, `fb1019f_standinwhole`, `egaudit3_client`,
`egaudit3_count`, `egint`, `egz_lords`, `egplay`, `egpres_hud`.
