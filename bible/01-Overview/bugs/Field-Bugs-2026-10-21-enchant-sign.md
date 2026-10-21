# Field bugs 2026-10-21: ENCHANT-SIGN - Strengthens Armor made its wearer easier to hit under the overhaul

GitHub issue #1096 (GrimmLiddell, 2026-10-21), read from the source and not played: "Strengthens Armor increases enemy
hit chance in PCAAO". Checked against the mod's own C# (PhysicalCombatOverhaulMain.cs:2087, v1.50, fetched from the
author's repository; the line is unchanged from the v1.44 the port restates) and DFU's (FormulaHelper.cs:1158,
StrengthensArmor.cs:25). It holds, and it is the mod's bug, carried 1:1.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | #1096: a Strengthens Armor item raises the enemy's chance to hit under PCAAO | The mod's player term is `100 - Increased - Decreased`, added into the attacker's chance; Strengthens writes Increased = -5, so the term answered 105. The stock core adds the channels (FormulaHelper.cs:1158) and answered 95 for the same ring | fixed (ENCHANT-SIGN) - the seventh departure from the mod, `05-Combat/Physical-Combat-Overhaul.md`; awaiting Mac's approval |

## ENCHANT-SIGN: the channels add

`src/combat/pcaao.js` (`pcaaoArmorToHit`). The one line: `100 - entityEnchantArmorMod(target)` becomes
`100 + entityEnchantArmorMod(target)` (combat/pcaao.js:"if (isPlayer(target)) result = 100 + entityEnchantArmorMod(target)"). The port's
points on the struck part (AUDIT SET P-M1) keep their sign; the 100, the class foe's 60 and a monster's part are untouched.
The record and the reasoning are the departure's own section on the PCAAO page.

Not taken here: #1097 (Weakens Armor is inert - `5 < 0` from a zeroed channel, DFU's own bug, DFU PR #2616 the
reference fix). With this change in, that one becomes a change to the SETTER alone, and Weakens will answer 105 under
both cores the day it bites; the pin for that cell is already written (`test/systems/pcaao.test.js`, "a Weakens channel of +5").

**Pinned.** `test/systems/pcaao.test.js` (the Strengthens cell 101 -> 91 beside four points; a Weakens cell, 101; both
channels, 96); `test/systems/bal_arc.test.js` and `test/systems/rf1_entitymods.test.js`'s source pins re-aimed onto the
new line. `tools/mutants/enchant_sign.json` +2 (the mod's subtraction back; the channels dropped), 2/2 dead;
`tools/mutants/auditsetd.json`'s points mutant re-aimed, dead.

**Verified.** The three test files, the mutants, lint, types and the bible's gates, here. Not played: the number is a
cell in a formula, and the reporter's own report is from the source too. A player with a Strengthens Armor item can
feel it from the chair under the overhaul: fewer blows land.
