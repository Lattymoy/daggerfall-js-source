# Deeds and Talents - minor skills serve the party, the advantages priced by what they buy, and advantages earned in play (DEEDS)

> Design page and record (2026-10-23). The arc ships in one pull request, in four parts (DEEDS0-DEEDS3), each verifiable
> without the next. Where this page and the code disagree, the code's own headers (`src/systems/talents.js`,
> `src/systems/partyTalents.js`, `src/systems/deeds.js`) and the pins are what runs.

## 1. What was asked

The owner, 2026-10-23:

> *"I wanna take a look at minor skills, disadvantages and advantages. Giving more online functionality to minor skills,
> balancing advantages/disadvantages and introducing more power fantasy advantages through gameplay (Not overpowered)"*

Measured first (section 2), then four questions put to the owner, and the owner chose:

- **Minor skills online:** *party utility* - Medical heals and revives party members, Stealth hides the party, a language
  calms foes for the whole party, Etiquette and Streetwise improve the party's prices and quest rewards.
- **The balance:** *buff the weak, reprice the cheap* - weak advantages get effects worth their cost, the bargains get
  new costs.
- **The power fantasy:** *Deeds* - chargen-style advantages earned through play, capped at a few slots, and a
  disadvantage overcome by facing it.
- **The mode:** *both modes, with a switch; online always on* - Master Skills' shape (`masterSkills.js`): one rule in
  both modes, the player's switch offline, forced on online.

## 2. What was measured

Read through the real code before anything changed (tools in the author's scratchpad, not shipped; every number
reproduces from the functions named).

**The advantages, against what they buy.** Through `combat/combatStats.js` computeCombatStats (the stats card's exact
expectation, pinned against the real roll code by `combatStats.test.js`), Balance-Arc section 2's level-12 and
level-20 builds, a longsword of steel and of ebony, damage a swing against the four reference foes:

| advantage (DFU's cost) | what it adds, classic core | what it adds, overhaul (online's) |
|---|---|---|
| Expertise In (2) | +33% to +114% (one armoured outlier +517%) | +38% to +93% (armoured +78% to +482%) |
| Bonus to Hit, a group (3-6) | +80% to +167% against that group | +74% to +151% against that group |
| Adrenaline Rush (4) | +0% at a sixth of health (classic's bar is an eighth) | +0% to +19% (armoured +154%), only under a sixth of health |

Bonus to Hit is `+level` damage a landed blow (`formulas.js` bonusOrPenaltyByEnemyType - DFU's name says "to hit", the
law adds damage), and its ladder has no arm for a humanoid MONSTER: an orc or a giant takes no bonus, only a foe of
Human affinity does. Counted that way over every encounter table (`characters/encounterTables.js`, lists 0-18 and
20-37, `combat/enemyGroups.js` enemyEntityGroup):

| group | dungeons | outdoors | all |
|---|---|---|---|
| Human foes | 24.7% | 50.6% | 37.3% |
| Animals | 23.4% | 18.1% | 20.8% |
| Undead | 20.5% | 7.8% | 14.3% |
| Daedra | 6.8% | 0.8% | 3.9% |
| none of the four | 24.5% | 22.8% | 23.6% |

So DFU's equal 6 for Human foes, Animals and Undead and 3 for Daedra are near the dungeons' shares, a little cheap for
Human foes. **Expertise In is the outlier**: two points for about what Bonus to Hit Human buys, against every foe the
weapon meets instead of a third of them.

**The weak ones**, read from their laws:

- **Regenerate Health** - 1 health every 4 game minutes (`passiveSpecials.js` REGENERATE_AMOUNT), at DFU's TimeScale 12
  a point every 20 real seconds. General costs 14, the dearest pick in the table; a level-12 body of 130 regrows 2% of
  itself a minute, an online one of 300 1%.
- **Acute Hearing** - an enemy's sounds carry x1.25 (`enemySounds.js` acuteHearingMultiplier). Nothing else.
- **Adrenaline Rush** - the table above: to hit only, under a sixth (overhaul) or an eighth (classic) of health.
- **Athleticism** - +10% jump (`skills.js` jumpSpeedMultiplier) and x0.9 fatigue (`shared.js` fatigueLossMultiplierFor).

**Two claims put to the owner were checked and one did not hold:** Damage from Sunlight (-10) is close to free since
HOOD-CAREER (a raised hood shields the burn and the day's travel); forbidding iron or steel is **not** free late - steel
is half of every random weapon at every level (`combat/enemyEquipment.js` randomMaterial: 49-51% from level 1 to 30;
iron 40% falling to 10%), so DFU's -10 for steel tracks the loot and stands.

**Minor skills online** (a lane over every read of the 22 non-combat skills):

- The nine languages are read in one place, the first-meeting calm roll (`formulas.js` calculateEnemyPacification), and
  only for the foes this client runs - a party mate's foe (a puppet) never rolls against my tongue.
- Stealth is read by the foes' senses (`shared.js` sensesContext), again only my own foes'.
- Medical heals only a rest's hours (`rest.js`), and a Roleplay & Realism bandage when that module is on.
- Etiquette and Streetwise move talk and the court, and the calm roll of class foes; Mercantile moves every price.
- Every PvP blow is rolled against a neutral sheet (`duelCombat.js` DUEL_STAND_IN): no defender's skill is read there.

## 3. The switch (DEEDS0)

One row on the Features page, **Deeds and Talents** (`features.js`, prefs key `deedsAndTalents`, group *Your
character*): on by default, forced on online (`online: true` - the lane's answer, `onlineLane.js`). `talents.js`
talentsInForce is the one read: an entity playing online answers true whatever the shelf says, as
`masterSkillsActive` does; anything else reads the switch. Off is Daggerfall's table, its four weak effects, no party
talent and no deed folded on (section 6.4 - nothing earned is lost).

## 4. The balance (DEEDS1)

### 4.1 The prices

With the switch on, a pick costs the DFO column (`specialAdvantages.js` DFO_DIFFICULTY; a pick missing from it keeps
DFU's price). Phobia, one price in DFU (`SECONDARY_BLIND`), is priced by its group here, at DFU's own ratio of a phobia
to a bonus (4 to 6):

| pick | DFU | DFO | why |
|---|---|---|---|
| Expertise In (any weapon) | 2 | 8 | buys what Bonus to Hit Human buys, against every foe the weapon meets |
| Bonus to Hit Human foes | 6 | 6 | 37% of foes; the anchor |
| Bonus to Hit Animals | 6 | 4 | 21% |
| Bonus to Hit Undead | 6 | 4 | 14% (20% in dungeons) |
| Bonus to Hit Daedra | 3 | 2 | 4% (7% in dungeons) |
| Phobia, Human foes | -4 | -4 | two-thirds of its bonus |
| Phobia, Animals | -4 | -3 | |
| Phobia, Undead | -4 | -3 | |
| Phobia, Daedra | -4 | -1 | |
| Damage from Sunlight | -10 | -4 | a raised hood shields it (HOOD-CAREER) |
| Acute Hearing | 1 | 3 | it now marks foes on the compass (4.2) |

### 4.2 The four weak advantages, made worth their price

| advantage | DFU | with the switch on |
|---|---|---|
| Regenerate Health | 1 health every 4 game minutes | 2% of maximum health every 4 game minutes (at least 1) |
| Acute Hearing | an enemy's sounds carry x1.25 | and every foe within its sound's reach shows on the compass, as Detect Enemy shows it: DFU's own attract radius (16 m) times the hearing multiplier - 20 m, 24 m with Improved Acute Hearing |
| Adrenaline Rush | to hit, under a sixth (overhaul) or an eighth (classic) of health | under a quarter of health in both cores, and the blows land 20% harder (30% with Improved Adrenaline Rush) |
| Athleticism | +10% jump, x0.9 fatigue | and +15 Running and +15 Climbing for the motor's reads, x0.8 fatigue (x0.7 improved) |

### 4.3 The career keeps its price

The table prices a class when the builder makes it. The chargen window prices every pick with the table in force
(`talents.js` pickDifficulty), and a custom class built with the switch on carries `advPricing: 'dfo'`: it is charged
DFO's prices while the switch is on, and DFU's when it is off (a class built online and played offline). Every other
career keeps the multiplier it carries - the eighteen stock classes, whose multipliers are CLASS.CFG's own and were set
by hand rather than by the table, and every class built before DEEDS. Of the stock classes only the Archer carries a
repriced pick (Expertise in Missile Weapon); charged at DFO's 8 its x0.83 would have been x1.14, and an existing
Archer's skills would have slowed by a third overnight, so it stands. `talents.js` careerAdvancementMultiplier is the
one read `advancement.js` takes: the stored multiplier plus 2.7 / 52 a point (CreateCharCustomClass's own slope,
`customClass.js` advancementMultiplier) for every point the career's specials cost now, as they stand after any
disadvantage a deed overcame, minus what they cost when the class was made, clamped to the builder's 0.3 to 3.0.

## 5. Minor skills serve the party (DEEDS2)

### 5.1 The talents a pose carries

The party pose (`net/wire.js` validPartyPose) carries `tk`: thirteen whole numbers, a member's live Medical, Stealth,
Etiquette, Streetwise and the nine tongues in `SKILLS` order (`partyTalents.js` TALENT_SKILLS), each 0 to 200. A member
is **near** when the pose's place is mine (`partyTalents.js` samePlace, moved out of `world.js` - the party rest's own
law) and this client draws their body within 40 m (`world.js` distanceToPartyAccount). Each read below is the best of
mine and every near member's; solo it is my own.

### 5.2 What each skill does for the party

| skill | the party's best | where it is read |
|---|---|---|
| Medical (care) | out of a fight (no hurt for 15 s), 1% of maximum health every 4 game minutes for every 50 points of the best Medical near (2% at 100, 4% at 200) - Regenerate's cadence | `partyTalents.js` careRound, a magic round hook (`worldTick.js` registerMagicRoundHook); never where regeneration is barred (`courtRules.js` regenBarred) |
| Medical (revival) | a Resurrect raises a fallen member at 30% of their health plus a fifth of the caster's Medical (50% at 100, at most 60%) | `resurrect.js` rezFor reads the caster's pose; `rezHealthPct` |
| Stealth (cover) | my Stealth against my foes' senses is the better of my own and three quarters of the best near | `shared.js` sensesContext, through `partyTalents.js` partySkill |
| The tongues | the first-meeting calm roll takes the best near speaker's tongue - one speaker calms the foes every member's client runs | `formulas.js` calculateEnemyPacification, through partySkill |
| Etiquette, Streetwise (the haggle) | every price is haggled with a tenth of the best Etiquette or Streetwise near added to Personality - inside the online haggle's own ceiling (`shopStock.js` ONLINE_HAGGLE_MAX), so no buy-and-sell loop opens that the best haggler did not already meet | `partyTalents.js` haggleOf, the one door every shop, guild, repair and spell price now takes (seven copies of the literal retired) |
| Etiquette, Streetwise (rewards) | a quest's gold reward is raised by a tenth of a percent a point of the best near (+10% at 100, +20% at 200), before the party's split | `quest/actions.js` GivePc, `partyTalents.js` rewardGold |

The pose's field is new on the wire: the relay is **world251**. A relay before it strips `tk`, and every member reads as
carrying no talent - each player's own skills still count for themselves.

## 6. Deeds (DEEDS3)

### 6.1 What is earned

A deed is a chargen advantage earned by doing the thing it names. `deeds.js` keeps the tallies on the character
(`entity.deeds`, saved) while the switch is on:

| deed | the advantage | earned by |
|---|---|---|
| Bane of Men | Bonus to Hit Human foes | 250 Human foes slain by my own blow |
| Bane of Beasts | Bonus to Hit Animals | 150 animals slain |
| Bane of the Dead | Bonus to Hit Undead | 100 undead slain |
| Bane of the Daedra | Bonus to Hit Daedra | 30 daedra slain |
| Last Stand | Adrenaline Rush | 20 foes slain while under a quarter of my health |
| Tempered: Fire / Frost / Shock / Poison / Magic | Resistance to it | 40 of its damaging spells (and poisons) endured |

The kills are the player's own (`playerKills.js` reportPlayerKill: my blow felled it), never the City Watch or an
ally, grouped by the same ladder the bonus reads (a Human-affinity foe, else `enemyEntityGroup`) - so an orc counts for
no Bane, as no Bane would ever strike it harder.

### 6.2 The slots

**Three.** A deed takes a slot the moment it is earned, while one is free, and keeps it for good - the order a
character earns them in is its story. A deed earned with every slot full is recorded and shown, not granted. A deed is
never earned for what the character already carries (the chargen pick, or the race's), nor against a pick it cannot sit
beside (`specialAdvantages.js` cannotAdd's own pairs: no Bane where its Phobia stands, no Tempered over a weakness,
an immunity or a resistance already there).

### 6.3 A disadvantage overcome

No slot, and the price is repaid: an overcome disadvantage no longer discounts the career's multiplier (4.3 counts the
career as it stands after it), at the price the career is charged - DFU's for a stock class.

| overcome | becomes | by |
|---|---|---|
| Phobia of a group | gone | a third of that group's Bane: 80 Human foes, 50 animals, 35 undead, 10 daedra |
| Critical Weakness to an element | Low Tolerance | 40 of its spells endured |
| Low Tolerance to an element | gone | 40 more |

So a character born with a phobia of the dead can, by facing them, lose the fear and then become their Bane; one born
with a critical weakness to fire can climb from it to Tempered: Fire. Every step after the first counts from the step
before.

### 6.4 How a deed lands

Folded onto the career (`deeds.js` applyDeeds): the career's chargen flags are kept as `deedBase` the first time, and
each fold writes the base and lays the deeds over it - so every reader that already reads the career (the bonus ladder,
the rush, the tolerances, the duel's sheet, the character sheet's specials) reads a deed with no second door. The fold
runs every magic round, at a load and at an earning. Off (offline), the base is written back: nothing earned is lost,
and turning it on again folds it again. The save writes the base, never the fold (`save.js` - an older build loading a
newer save sees the class as it was made), and `deeds` beside it.

The HUD says each earning and each overcoming. The enhanced character sheet lists the deeds, earned and on the way,
under the advantages; the classic HISTORY box (GetClassSpecials) shows the folded career as it shows any.

## 7. Departures, and what is recorded rather than built

- **Port-only, all of it.** Daggerfall has no deed, no party skill and no second price table; Port-Ledger A records the
  arc. DFU's members it departs from: `CreateCharSpecialAdvantageWindow.InitializeAdjustmentDict` (the prices),
  `PassiveSpecialsEffect.RegenerateHealth`, `DaggerfallEnemy.Start`'s hearing, `FormulaHelper.CalculateAdrenalineRushToHit`,
  `AcrobatMotor.jumpSpeedMultiplier`'s neighbours, `FormulaHelper.CalculateEnemyPacification`, `FormulaHelper.CalculateTradePrice`'s
  inputs (not the formula), `EnemySenses`' stealth read.
- **The materials stand** (section 2).
- **Recorded, not built:** choosing which earned deed takes a slot (a later slice could offer the choice as Master Skills
  offers a mastery); deeds for the other advantages (Acute Hearing, Athleticism, Rapid Healing, Regenerate); a party
  member's talent read by a client that does not draw their body (beyond 40 m, or a stream not yet loaded).

## 8. The slices

| slice | what |
|---|---|
| DEEDS0 | the switch: the Features row, `talents.js` talentsInForce |
| DEEDS1 | the prices, the four effects, the career's live multiplier |
| DEEDS2 | the pose's `tk` (world251), care, revival, cover, tongue, haggle, reward |
| DEEDS3 | the tallies, the slots, the fold, the overcomings, the save, the sheet |

## 9. Pinned

`test/systems/deeds_talents.test.js` - the switch, both price tables and the live multiplier, the four effects, the
party's reads, the pose's validator, the deeds' tallies, slots, fold and save.
