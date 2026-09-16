# MAC-M — the two numbers an item is for, 2026-09-17

Mac:

> Damage values arent showing on weapon tool tips. Also, not sure if
> armor has values either.

Both true. And the shape under them is one this port has now found four
times in a week: **the producer existed and had one reader.**

## What was already there

`systems/itemInfo.js` has had `weaponDamageString` and `armourModString`
since **U25**, both faithful to DFU:

| | port | DFU |
|---|---|---|
| iron dagger | `0 - 5` | `GetBaseDamageMin/Max` + `WeaponMaterialModifier`, and **iron is −1** |
| daedric claymore | `8 - 24` | the material moves *both* ends |
| iron cuirass | `+7` | `GetMaterialArmorValue`, the whole member — shield early return and artifact halving included |

The iron `−1` looked like an off-by-one and is not: it is
`FormulaHelper.CalculateWeaponMaterialModifier`, and iron weapons really
are worse than steel in Daggerfall. Checked against the port's own table
before it was called a bug.

## What was missing

Between them those two functions had **exactly one reader**:
`expandItemInfo`'s `%wdm` and `%mod`, which fill the **classic** popup's
TEXT.RSC record.

The enhanced skin's detail card — the panel most players actually read —
builds its rows from `ui/enhancedInventory.js`'s `itemLine`, and draws
**no record at all**. `itemLine` carried name, weight, condition,
material, stack, equipped, lit, broken. So the classic popup told a
player a dwarven longsword hits for 4-18 and the enhanced card told them
what it weighed.

Three hovers were affected, and the most literal reading of "tool tips"
was the worst of them:

- the **grid tile**'s `title` — the browser tooltip on every item in the
  pack, which said the name and nothing else;
- the **detail card**'s stat list;
- the **worn map**'s slot hover, which is where a player asks Mac's
  second question, because armour is the thing you are wearing.

## The fix: one producer, two presenters

The numbers are shared — `itemDamageLine` and `itemArmourLine` call the
same two functions the macro pass does, so **the card and the popup
cannot print different numbers for the same sword.** The pin drives both
and compares them.

The *question* is not shared, and the distinction is the point:

- the macro pass asks **"what does `%wdm` expand to"** and lets the
  record decide whether to print it — an arrow takes record 1011, which
  has no damage line at all;
- a card has no record, so it must ask **"should there be a Damage row"**.

That is why the arrow test lives in `itemDamageLine` and not in the
macro. The producer still answers for an arrow; the *presenter* declines,
exactly as DFU's record does.

And the three hovers share **one** suffix builder rather than each
spelling the `??`. Three copies of a rule is three chances to disagree,
which is the shape half of this month's findings had.

## The claim that was not checked

Mac's "**not sure** if armor has values either" is the important half of
that sentence. The answer — *the classic popup was always right* — was, at
the moment it was given, a **reading**. `%wdm` and `%mod` had no test
anywhere in the tree: the two macros a player picks a weapon by, unpinned
since U25.

They are pinned now, in `iteminfo.test.js`, along with the cross-check
that the two surfaces agree. **An answer to "not sure" that is itself
unverified is not an answer.**

## The campaign

**11 mutants, 11 killed** — including the two that are the bug itself
(each row dropped from the line), the one that puts a Damage row on an
arrow, the one that recomputes the rating instead of sharing the
producer, and the one that sinks the headline stat below weight.

## Not seen on a GPU

The numbers, the suffix and the ordering are driven in node. **Nobody has
hovered a sword.** Worth a pass: open the pack, hover a weapon in the
grid, click it, and check the worn map's armour slots.
