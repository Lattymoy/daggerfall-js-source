# FIELD BUGS 2026-10-12c - the spell that cost 5

One Discord message, handed over as a screenshot: a player casting Area Around Caster buffs over and over, the HUD's
effect column full of ~600-round buffs. Read on the code as it stands at main's `a7e7ea64`.

> dude is going around AoE buffing infinitely still - creating negative spell costs which makes things only cost 5 LOL
> wild what people find

| | Report | What it was | Done |
|---|---|---|---|
| 1 | AoE buffs cast without end; "negative spell costs", everything "only cost 5" | DFU's `(110 - skill)` cost term reads a magic school past 110 - a mastered school (SOFTCAP1, up to 140 in a formula) with gear on top - and prices an effect under nothing; the cast falls to the floor of 5 | fixed online (SPELL-COST-PAST) |

## SPELL-COST-PAST: online, a skill past 100 never prices a spell under nothing (1)

`src/systems/spellcost.js` `skillScaledCost`, `SPELL_COST_SKILL_REFERENCE`, `effectCost`, `calculateCastCost`,
`classicCastingCost`.

**Reproduced first**, on the real modules: a chargen'd mage, Restoration mastered through `masterSkill`, an Area Around
Caster Fortify Strength of 1740 gold. At Restoration 100 the effect is 43 spell points and the cast 86. At 120
(effective 105) it is 21 and 42; at 150 (effective 117) the effect is -30 and the cast 5; at 200 (effective 140) the
effect is -130 and the cast 5. The settings editor's own label (`spellMaker.js` editedEffectCost, no floor - DFU's
UpdateCosts) prints the -30 and the -130: the "negative spell costs" of the report.

**Why.** CalculateEffectCosts prices an effect's spell points as `gold * (110 - skill) / 400`, and CalculateCastingCost
(the classic-reversed formula: an item's Cast-When-Held bill) as `* (110 - skill) / 100`, at the caster's live skill in
the effect's school. In Daggerfall that term runs from 110 at skill 0 to 10 at 100, and nothing reads a school much past
100. Here three things do: Master Skills lets a mastered school read up to 140 in a formula (SOFTCAP1,
`skillSoftcap.js` effectiveSkill), and worn gear adds on top without bound - Enhances Skill +15 a piece
(`enchantments.js`), the rarity affixes' skill lines (`entityMods.js`), Mora's Forbidden Lore on every school
(`sigilSetPowers.js`). At an effective 110 an effect is free; past it, under nothing - summed with the spell's other
effects it takes their cost off, and the cast stops at the floor of 5 (`CAST_COST_FLOOR`). An Area Around Caster buff
for 5 magicka is cast as fast as the hands move. STACK-CAP (2026-10-11) had already made a re-cast renew rather than
bank rounds, so the report's "still" is the price: nothing kept the buffs from being renewed forever, for 5 each.

**The fix.** One home for DFU's term in both formulas, `skillScaledCost`. Online (`onlineLane.js` isOnlinePage, as
MERC-CAP reads it), past `SPELL_COST_SKILL_REFERENCE` (100) a spell costs what it costs at 100 times 100 / skill - one
division, so an exact quotient stays exact. Every point past 100 is still cheaper and none is free: the field's cast is
82 at 120, 74 at 150 and 62 at 200, and a school dressed to 200 casts at half its price at 100. An effect never prices
under nothing, so a spell with more effects never casts cheaper. Offline and to 100, DFU's term stands. Every door
that prices a spell goes through it: the ready's price and the cast's spend (`hostMagic.js` readySpell), the spellbook
and the spell maker, a foe's cast (`enemyCasting.js`, priced at the player's skills - its recorded quirk), an
absorb's refund (`absorption.js` effectCastingCost) and a held item's equip bill (`enchantments.js` assignHeldSpell).
The port's own cost modifiers (SET2's sets, LOOT15's focus) run after it, unchanged.

`test/systems/fb1012c_spellcost.test.js` (3): the field's cast to the point in both lanes, through the ready's price and the
spell maker's two labels with the page online; the term swept online and off (two divisors, nine values, skills -50 to
2000 - never under nothing, never rising with the skill, DFU's to 100, 100 / skill past it, half at 200, the page's
switch the default); and a second effect never makes a spell cheaper online, with the held-item bill above the floor
and the enchantment arm (skill 50) unmoved. `tools/mutants/fieldbugs1012c.json` (10, 10 dead). Port-Ledger A's
SPELL-COST-PAST row.

## For Mac

- **Effective 100 to 110 costs more online.** DFU's term falls by a tenth of the price at 100 for every point past it,
  to nothing at 110; any curve that never reaches nothing has to be flatter there. A mastered school at raw 104 to 131
  (effective 101 to 109) paid DFU's steep slope before - the field's cast was 42 at effective 105 and 8 at 109 - and
  pays 82 and 78 now. Past 110 it paid the floor and pays its price. The curve is the one call here: 100 / skill keeps
  every point worth something and stays sane under any amount of gear (half at 200, a third at 300). A steeper one
  (DFU's slope at 100, bent so it never reaches nothing: a fifth at effective 140) would keep the 100-110 band cheap,
  but stacked gear walks it back down to the floor.
- **Offline, Daggerfall's term stands.** A school at 100 with one Enhances Skill piece reads 115 and prices under
  nothing there too - DFU's own quirk - and offline Master Skills (the player's switch) reaches 140. Should offline
  read the same curve (SPELL-COST-PAST without its `online`), or stay Daggerfall's?
