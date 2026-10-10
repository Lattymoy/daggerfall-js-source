# Physical Combat And Armor Overhaul - the mod, 1:1 (PCO1, 2026-09-12)

Mac: "So next up, I want to implement this as our next integrated mod.
The goal is 1:1 with complete parity" - handing over
`Physical_Combat_Overhaul_v1.44_-_DFU_v1.1.1_76_1.44_2026-06-26T01-53Z.7z`.

**Physical Combat And Armor Overhaul v1.44** for Daggerfall Unity 1.1.1,
by Kirk.O (Nexus; source github.com/magicono43/DFU-Mod_Physical-Combat-
And-Armor-Overhaul). "Armor Reduces Damage Taken Instead of Reducing
Chances of Being Hit, Also Much More." Its data is vendored under
`vendor/pcaao/` (the manifest, the shipped modsettings, a README with
the provenance and the permission line), it is credited on the About
screen, and it is ported as `src/combat/pcaao.js` (every formula) and
`src/combat/pcaaoMeanerMonsters.js` (its Meaner Monsters table), on
DFU's own RegisterOverride shape grown into `combat/formulas.js`. It is
the player's choice in the Mods pane - `Enabled` was off by default, as
DFU without the mod listed, until MO1 (2026-09-12, Mac: "All mods
should be enabled by default") turned it on - and while it is on, both lanes fight by
its formulas.

## The source the port reads

The shipped bundle carries a compiled DLL (45,056 bytes) and no source.
The repository's last single-file source is **v1.40** (commit `6e19023`,
2021-08-04) and its master is the v2.0 rewrite in progress, so the port's
law is **the shipped 1.44, decompiled** (ILSpy 8.2.0.7535 on .NET 6,
2,575 lines), with the v1.40 source naming what the decompiler numbered
(an enum member, a skill id, a race). The four versions between them
are in the DLL and nowhere in git: the silver-weakness six (Werewolf,
Ghost, Wraith, Vampire, Mummy, Wereboar), the Vanilla Combat Event
Handler mirror, the second and third monster damage pairs in the
Meaner Monsters table, the Ring of Namira dispatch. Neither the DLL
nor the decompiled text is carried in the repo; every function in
`pcaao.js` names the C# method it restates.

## What the mod is, and where each part landed

A MonoBehaviour that REPLACES FormulaHelper's combat formulas through
`FormulaHelper.RegisterOverride`, one override per module switch in
its `modsettings.json`:

| the mod's | does | lives here as |
| --- | --- | --- |
| `Awake` / `InitMod` | reads the seven switches, resolves the dependent ones (fading needs enhanced wear; critical, condition and soft-material need the redone armour formula), registers the overrides, reads Roleplay Realism's `advancedArchery` and Meaner Monsters' presence | `pcaaoModules(read)` - the ladder, read LIVE from the Mods pane store; `installPcaao()` - the three registrations, called from `systems/worldTick.js` for every host; each registered arm declines (returns `undefined`) when its switch is off so the stock formula stands |
| `DamageModifier` | `(STR - 50) / 10`, floored | `pcaaoDamageModifier`; registered on `formulas.damageModifier` (the character sheet and DFU's own damage path read it too, as in DFU); the overhaul's own arithmetic always uses it, being the class's static |
| `CalculateAttackDamage` | the whole blow: the enemy's weapon-vs-natural swap, the material gate (or the soft-material multiplier), the 150% skill (the player's in the mod; every striker's since BAL2, the fourth departure), the critical strike, the player's swing/proficiency/racial/backstab terms, the struck part, the hand-to-hand / monster-loop / weapon branches, the crit and material multipliers, the natural resistance, the shield roll, the condition multiplier, the wear, the armour reductions, the Ring of Namira, the VCEH event | `pcaaoAttackDamage`; registered as `calculateAttackDamage`'s CORE - the port's tail (concealment, the Strikes payload, the racial hit hook, the struck hook that IS the Ring of Namira here, the HUD report) is DFU's callers' work and runs after either core |
| `CalculateSwingModifiers` | DFU's own table | the callers' `damageMod`/`toHitMod` (playerAttackOptions, SWING_MODS) - the same numbers |
| `CalculateProficiencyModifiers` / `CalculateRacialModifiers` | stat-driven per weapon skill and race, on the C#'s else-if ladders | `pcaaoProficiencyModifiers`, `pcaaoRacialModifiers` |
| `CalculateWeaponToHit` | material x2 + 2 ("+14, not +60") | `pcaaoWeaponToHit` |
| `CalculateArmorToHit` / `AdrenalineRush` / `StatDiffs` / `Skills` / `Adjustments` / `SuccessfulHit` | the player 100 less the enchantment channels, a class enemy 60, a monster its part; a sixth of health and +8/+12; luck/10, agility/4, speed/8 less the target's luck rounded; dodging halved; +50 for a monster target, -50 always; the sum, its 3..97 clamp (DISCARDED by the C#, APPLIED here - the first departure, below), Dice100 | `pcaaoArmorToHit` ... `pcaaoSuccessfulHit` |
| `CalculateStruckBodyPart` | twenty slots, feet likelier than the head | `PCAAO_BODY_PARTS`, `pcaaoStruckBodyPart` |
| `CriticalStrikeHandler` | luck's `Mathf.Floor((luck-50)/25f)` term (clamp discarded) bending the divisor | `pcaaoCriticalStrike` |
| `GetBonusOrPenaltyByEnemyType` | willpower's `Random.Range(0, n)` bonus and the level penalty on the career's Bonus/Phobia bits, the Humanoid arm on GetEnemyGroup | `pcaaoBonusOrPenaltyByEnemyType` |
| `CalculateHandToHandAttackDamage` / `CalculateWeaponAttackDamage` | the strength term, the Skeletal Warrior's halving and the silver six's doubling, a two-handed non-bow doubling the strength term | `pcaaoHandToHandAttackDamage`, `pcaaoWeaponAttackDamage`, `SILVER_DOUBLED_CAREERS` |
| `AdjustWeaponHitChanceMod` / `AdjustWeaponAttackDamage` | Roleplay Realism's archery: the bow's draw time in ms bends hit and damage; registered on FormulaHelper whatever the armour module says (AUDIT PCO1) | Roleplay Realism's own `rrAdjustWeaponHitChanceMod`, `rrAdjustWeaponAttackDamage` (rrRealism.js - one export, AUDIT 68), registered on `formulas.adjustWeaponHitChanceMod` / `adjustWeaponAttackDamage` - DFU's two no-op hooks, grown into the stock core at the C#'s two sites (AUDIT PCO1); the draw timer is `playerWeapon.lastDrawMs` (below) |
| `AlterDamageBasedOnWepCondition` / `AlterArmorReducBasedOnItemCondition` | the condition bands | `pcaaoAlterDamageBasedOnWepCondition`, `pcaaoAlterArmorReducBasedOnItemCondition` |
| `ArmorMaterialIdentifier` / `ArmorMaterialModifierFinder` / `EqualizeMaterialConditions` / `SpecificWeaponConditionDamage` | the four material ladders | the four `pcaao*` of the same names |
| `DamageEquipment` + `ApplyConditionDamageThrough*` + `MaterialDifferenceDamageCalculation` + `WarningMessagePlayerEquipmentCondition` | "Believable Equipment Characteristics And Durability": the weapon wears by its kind, the struck side by the material difference, a fist wears the piece; the fading module destroys the player's enchanted piece; the player is warned in the mod's words | `pcaaoDamageEquipment` and the helpers; `equip.lowerCondition` grew LowerCondition's `removeFromCollectionWhenBreaks`; registered on `formulas.damageEquipment` for DFU's own path |
| `PercentageReduction*` / `ShieldDamageReductionCalculation` / `CalculateArmorDamageReduction*` | the eight reduction tables (armour material 1..10 x fist/blunt/edged x piece/shield, plus the two averages), the natural resistance subtracted, the condition factor under each cap | `PCAAO_REDUCTION_ROWS` and the `pcaao*` reducers, every term a float32 and every round half to even |
| `PercentageReductionCalculationForMonsters` | the monsters' hides (the Skeletal Warrior 0.8, the Gargoyle 1.21 blunt / 0.71, the Spriggan 0.66 / 1.26, the Daedroth 0.95, the Frost Daedra 1.04 / 0.84, the Daedra Lord 0.95, the Ice Atronach 1.4 blunt, the Iron Atronach 0.6 blunt / 0.9) | `pcaaoPercentageReductionCalculationForMonsters` |
| `SpecialWeaponCheckForMonsters` / `MonsterWeaponAssign` | seventeen monsters whose blow is treated as a weapon's, each assigned the weapon its sprite carries | `SPECIAL_WEAPON_MONSTERS`, `MONSTER_WEAPON`, `pcaaoMonsterWeaponAssign` (ItemBuilder.CreateWeapon = `enemyEquipment.createWeapon`) |
| `ShieldBlockChanceCalculation` / `CompareShieldToUnderArmor` / `ArmorStruckVerification` | the shield's roll by template and the six stats (clamps discarded), and the shield only when its average reduction beats the piece under it | the three `pcaao*` |
| InitMod's Meaner Monsters branch | forty-two `EnemyBasics.Enemies[i]` rows overwritten | `pcaaoMeanerMonsters.js`; `characters/enemyEntity.makeEnemyEntity` mints from `meanerMonstersRow` |
| `MirrorVCEH` / `OnAttackDamageCalculated` / `OnSavingThrow` | the Vanilla Combat Event Handler's two events, mirrored to relay to OTHER mods | not carried - no consumer here (README) |
| `Debug.LogFormat("matReqDamMulti")` | a Unity console line | not carried |

## The first departure: the hit chance's floor (DISC19-D, Mac's call 2026-09-24)

`CalculateSuccessfulHit` computes `Mathf.Clamp(num, 3, 97)` and never
assigns it, so under the mod a sum below zero was a certain miss. With a
monster's Dodging at 5 x level + 30 (halved) and the soft-material rule
replacing DFU's "ineffective" refusal, a skill-30 character with steel
landed 0 of 2000 blows on a Vampire or a Lich and was told nothing
(Discord: "In a dungeon that I cant hurt enemy's"). Offered the clamp, the
bug as shipped, or both mods off by default, Mac chose the clamp.
`pcaaoSuccessfulHit` applies it - DFU's own FormulaHelper clamp, the one
the stock core applies and the mod's author wrote - in both directions:
every blow lands at least 3 in 100 (55 of 2000 on that Vampire, 51 on the
Lich) and misses at least 3 in 100, a monster's on the player included.
Ledger A's PCO1 row records it; `test/pcaao.test.js` pins it.

## The second departure: the wear modules ship off (WEAR-VANILLA, 2026-10-01)

The repair triage: "Disable the modded feature that increases durability
loss. Vanilla values work fine. Weapon degradation done improperly is
extremely agitating if done wrong." `equipmentDamageEnhanced` wore a
weapon about 2.8x DFU per landed hit - more, the better its metal - and a
struck piece about 15x, by a monster's claws too, which DFU never lets wear
armour; `fadingEnchantedItems` destroyed a player's broken enchanted piece.
BALANCE1's 0.6 on every blow softened it without undoing it. Both ship OFF
in the port now (the mod ships them on), with Roleplay Realism's
`equipDamage` (armour x5, the arm that answers when this one is off), and
the wear scale is back at 1. A switch alone was not enough: the mod's own
core (`CalculateAttackDamage` under the redone armour formula) calls the
class's own `DamageEquipment` and wears gear its way whatever
`equipmentDamageEnhanced` says. So `pcaaoAttackDamage` follows the switch -
a departure from the mod's code as well as its defaults: off, the blow
wears what FormulaHelper's DamageEquipment says (`formulas.js`
`damageEquipment`), with the weapon it was struck with, never the stand-in
the core assigns a monster's natural attack (DFU has no such weapon). The rest of the overhaul - the redone armour
formula, the criticals, condition-based effectiveness, soft materials, the
strength fix - is untouched. Offline the switches are the player's (a
value saved under the old default is let go once, `SWITCH_RESETS`);
online the room reads the port's defaults. Measured through `calculateAttackDamage` (a level-20 player,
skills 70, level-10 foes, a quality-10 smith; repair prices unchanged): a
Daedric longsword's repair 17.5-25.2 gold a landed hit -> 4.8-6.9, a
Daedric cuirass's 6.4-10.6 a monster's blow -> 0 and an armed foe's 6.4 ->
0.9; Ebony 4.4-6.7 -> 1.3-2.0 and 2.0-3.5 -> 0-0.3. Ledger A, WEAR-VANILLA; `test/wear_vanilla.test.js`.

**Below the reduction (AUDIT ECON W1, 2026-10-01).** DFU's member is handed
the damage the blow DEALT - after the overhaul's armour reduction, as the
duel already read it (`scenes/world.js`, the defender's own damage - INT8, 2026-10-09: the duel's blow is the relay's
since, and its wear the striker's on what the referee let land). DFU's
armour turns a blow aside, and the blow wears nothing; the redone formula
lets nearly every blow land (a Knight's on a steel-clad player 0.70 -> 0.97
of his swings) and takes its share off instead, so the share it took wears
nothing either. Fed the damage before the reduction - after the critical
multiplier - gear wore 1.3-2.5 times DFU's rate a swing (a level-20 player
in Daedric lost 2.5 times DFU's armour to a Knight's swing); below it,
armour 0.71-0.86 times and a blade 1.17-1.22 times (`calculateAttackDamage`
over the same seeded fights, steel at level 10 and Daedric at level 20,
against every mod off). The module on keeps the mod's own wear, before the
reduction, as the mod has it.

**Twice DFU's amount (WEAR-TWICE, 2026-10-02, the field: "maybe we overdid
it too much ... I still want there to be some challenge"; of four levers,
"Faster wear").** DFU's member wears twice its amount - the 20% floor roll's
1 included - on every path it serves (the overhaul's core and DFU's own),
and a duel's blade the same (`systems/equip.js` `DFU_WEAR_MULTIPLE`,
`dfuBlowWear`). At DFU's own amount a steel longsword lost about 6.5% of
itself to a hundred swings and armour hardly wore; at twice it, 13%, and
per swing armour wears 1.4-1.7 times DFU's and a blade 2.3-2.5 times (the
same seeded fights). With REPAIR-RATE's third, a Daedric longsword's repair
is 3.3-6.4 gold a landed hit (`06-Systems/Economy-Arc.md`). The mods' own
wear modules, turned on offline, keep their own amounts.

**Back to DFU's amount (WEAR-ONE, 2026-10-02, Mac: "we need to buff gear
durability because its really bad"; asked how much, "Daggerfall's rate
(1x)").** At twice, every landed blow cost at least 2 (the doubling came
after the floor roll's 1) and a 50-point dagger or bow broke in about 25
blows. `DFU_WEAR_MULTIPLE` is 1 again; the seam stays for a later tuning.
[SUPERSEDES WEAR-TWICE's 2.]

**One pool for every weapon (WEAPON-POOL, 2026-10-06, Mac: "So keep the
material disparity, but unify all the weapons types condition stat").**
WEAR-ONE set what a blow costs; this sets what a weapon holds. Daggerfall
mints a weapon's condition from its row's hitPoints through the material
ladder (x4 iron to x32 Daedric, over 4), and the rows run from 50 (Dagger,
Tanto, Short Bow) to 1,600 (Warhammer), so every flat cost picked a type:
a Cast-When-Strikes strike's 10 broke an iron dagger in 5 strikes and an
iron warhammer in 160, a Cast-When-Held spell's casting cost at its first
equip (5 at the least; the loot's held spells about 120-160,
`06-Systems/Loot-Rarity.md` watch item 9) broke an iron dagger the moment
it went on, before its 1 every four magic rounds (1 in 60 resting), and 25
blows of 20 damage broke an iron short bow. The stronger the player, the
deeper each blow's bill, and the light weapons and the bows spent more time
broken than drawn - a Legendary rolled on one carried its power for a few
blows or none: Worm's Tooth (a Dagger or a Tanto) its strike for five,
Nightwhisper on a Dagger or a Tanto its held Chameleon not past the equip. Every weapon type now mints from the Warhammer's
1,600, the deepest row, so no type has less than it had
(`characters/weapons.js` `WEAPON_CONDITION_POOL`, read by
`systems/itemTemplates.js` `mintCondition` in the row's place), and the
ladder over it as before: 1,600 iron, 2,400 steel and silver, 3,200
elven, 4,800 dwarven, 6,400 mithril, 8,000 adamantium, 9,600 ebony,
11,200 orcish, 12,800 Daedric. The rows stay Daggerfall's and every cost
stays DFU's. Roleplay & Realism: Items' weapon patches and its two
weapons, and the Thunderlock, take the pool too; ammunition keeps its row
(CreateWeapon's arrow arm runs no material pass), armour its own, a magic
item and an artifact their uses. A save's weapons move to the pool at the
same share - a broken piece stays broken - on load, and any piece the load
does not reach before its first wear (`systems/conditionRepair.js`
`repoolWeapon`, `systems/equip.js` `lowerCondition`; AUDIT WEAPON-POOL,
below). Ledger A, WEAPON-POOL; `test/weaponpool.test.js`.

A soft weapon still wears by what it deals: an iron blade on a Ghost does
nothing in DFU and wears nothing, and does a little under the soft-material
requirements and wears that little.

**Two things decided, not ported.** A blow the overhaul's shield roll
blocks on a part the shield does not cover (its weak-spot chance) wears
the piece under it - DFU's routing reads the shield's cover, not the
overhaul's roll - and a failed block over a covered part wears the shield:
DFU's, kept. Roleplay Realism's `equipDamage` has no screen (its tile
carries four dials); were it on, its slot inside DFU's member would take
its x5 on the overhaul's path too, as DFU does with both mods installed.

## The third departure: the sharp edge rides the wear (BAL1, 2026-10-10)

Mac, 2026-10-09: "bring up the difficulty without implementing a band aid
fix" (`05-Combat/Balance-Arc.md` section 3). Condition-based effectiveness
strikes with a blade at x1.3 at 92% condition and over and x1.1 at 76-91%
(a blunt weapon x1.1 at 92%), and lets a piece of armour over 92% reduce
at 0.85 (0.95 at 76-91%). The mod pays that for keeping gear sharp against
its own fast wear. With the second departure (above) the wear is DFU's,
every weapon sits on one pool (WEAPON-POOL - the Warhammer's 1,600 through
the material ladder), and a monster's
claws wear no armour at all - so a fresh steel longsword took 128 landed
hits on an Orc Warlord to fall under 92%, and the edge was every fight's.
`pcaaoAlterDamageBasedOnWepCondition` and
`pcaaoAlterArmorReducBasedOnItemCondition` take a `sharpEdge` (default the
mod's: on), and every caller hands them `modules.equipmentDamageEnhanced` -
the blow, the armour rows' `condOf`, the stats card. With the wear module
off, a weapon at 76% and over strikes at its own damage and a piece
reduces at its own factor; the bands under 76% (worn gear's cost) stand
whatever the wear. Turning the module on puts the mod back whole.

## The fourth departure: one rule for every striker (BAL2, 2026-10-10)

The mod gave the player's weapon skill x1.5 to hit and a foe's x1; rolled
the player's crit at `crit / (4 - luck)` and a foe's at `crit / (5 -
luck)`; and multiplied the player's landed crit by `1 + floor(crit / 5) *
0.05` (+`crit / 4` to hit) and a foe's by `1 + floor(crit / 5) * 0.025`
(+`crit / 10`). Without the crit module, the player rolled `crit / 3` for
`+crit / 3` and a monster rolled `crit`% for `+crit / 10`. A foe's Long Blade and
Critical Strike are the same skills as the player's, so they are read
the same way now: every striker takes the player's rule
(`Balance-Arc.md` section 4). The armour term is NOT made one rule. The
player reads a flat 100, a class enemy a flat 60 and a monster its part's
value, and every even version of that measured easier. That split is the
mod's premise: armour reduces damage and never the chance to be hit. The
fight against a foe at the 97% clamp moves through the crit (damage taken
about 14% more), and against a lower foe through the to-hit.

## What is kept bug for bug

- `Mathf.Round` rounds half to EVEN (`unityRound`), and every float the
  C# computes is a float32 (`Math.fround` at each step), so `15 * 0.9f`
  is `13.5f` and rounds to 14 where a double would say 13.
- Three of the four `Mathf.Clamp` calls whose result the C# DISCARDS:
  the natural resistance's +-0.2 (moot - three stats of 100 reach
  exactly 0.2), the critical strike's luck term, the shield chances. Not
  clamped here either. The fourth, the hit chance's 3..97, IS applied -
  the first departure (above).
- C# integer division truncates toward zero; where an operand can be
  negative (a stat below 50, a level difference) the port truncates.
- The archery hit table's `> 8000` arm sits behind `> 5000` and never
  fires; carried as written.
- The warnings repeat while a piece sits at exactly 48% or 15%.
- The soft-material multiplier and the crit multiplier apply to the
  WHOLE blow, backstab included, before the wear and the reduction; the
  mod's wear (its module on) is charged on the PRE-reduction damage -
  DFU's, the port's default, below it (the second departure, above).
- **BALANCE1 (2026-09-27, Mac: durability "drain[s] a little too fast")**:
  the scale on what a piece loses (`equip.js CONDITION_WEAR_SCALE`,
  through the one `wear` sink; a fraction rolled so the average is exact)
  is 1 since WEAR-VANILLA (above), which turned the mod's wear off instead;
  BALANCE1's 0.6 had softened that wear (~2.8x DFU's on a weapon per landed
  hit and ~15x on armour, measured first) without undoing it. Ledger A,
  `01-Overview/Field-Bugs-2026-09-27-phone-backup-drains.md`.
- A left-hand item that is not a shield still goes through the shield
  roll (the C# never asks IsShield there); `GetShieldProtectedBodyParts`
  answers nothing for it, so it rolls the weak spot.
- A CLASS enemy's bare fists deal NOTHING (AUDIT PCO1). The mod's
  `CalculateHandToHandAttackDamage` rolls the fist only for `player`;
  a non-player gets its `damageModifier` alone, and the mod's
  CalculateAttackDamage hands a class enemy 0 there (the swing,
  proficiency and racial terms are the player's) - `< 1` floors it to
  0 and the enemy-type term never adds. A monster's modifier is its
  summed natural damage, so monsters are unaffected; a knight whose
  sword the wear broke fights for 0 until it finds another. Carried.

## Port-side decisions, recorded

- **`Enabled` off by default.** DFU enables a mod by listing it; the
  port has no mod list, so the mod is a switch in the Mods pane (the
  Dynamic Skies precedent after VC1). ~~Off~~ ON by default since MO1
  (2026-09-12, Mac's law: every mod on; the pane is where it is turned off). The seven shipped module keys
  default as shipped (all on), but for the two wear modules, off since WEAR-VANILLA (above).
- **The two derived arms read the OTHER mods' own switches** (MM1, Mac:
  "there shouldn't be compatibility switches between mods"; they were
  switches of this mod's from PCO1 to MM1). `meanerMonsters` is
  `meanerMonsters/Enabled` - Ralzar's mod, vendored
  (`04-Characters/Meaner-Monsters.md`); `rolePlayRealismArchery` is
  `roleplay-realism/Enabled` and `roleplay-realism/advancedArchery` -
  RR1 vendored the mod under that id (the placeholder `roleplayRealism`
  key read undefined, so the arm was dead until AUDIT 68).
  `modSettingIfDeclared` is the read. With both mods
  on, Ralzar's row lands first and this mod's edit over it, as DFU
  Awakes the dependency first.
- **The bow's draw time.** DFU hands `weaponAnimTime` (FPSWeapon's
  animTime, ms) to CalculateAttackDamage. The port's classic bow now
  times its draw: `playerWeapon.lastDrawMs` is the machine's held
  StrikeUp ticks x the bow's 0.0625 s tick (GetAnimTime - game time,
  so a pause mid-draw does not count; AUDIT 68), written at every
  release, the touch button's included; the instant shot is 0 (the
  archery arms gate on `> 0`). Enemy archers pass 0, as DFU's
  EnemyAttack does.
- **`item.customMagic`.** The warning's name picks the short name for a
  custom-enchanted item, the long name otherwise; the port's items
  carry no such field, so the long name stands.
- **The Meaner Monsters edit takes effect on monsters spawned after
  the switch** - DFU rewrites the table at Awake; the port overlays the
  row at mint.

## Pinned (`test/pcaao.test.js`, 26)

The ladder; the half-to-even round through a float32 half; DamageModifier
and the material hit bonus; every hit helper against a hand-worked cell;
the unclamped hit; the body-part table; the luck-bent critical; the
enemy-type bonus and penalty; the damage helpers (the silver six, the
two-handed doubling, a bow's exception); the archery tables; the
condition bands; the four material ladders; the material-difference
arithmetic; the wear (weapon, piece, shield, a fist, the fading removal,
the warnings' words and delays); the reduction cells with the cap and
the natural resistance; the monsters' hides and their weapons; the
shield roll and the under-armour comparison; the natural resistance's
extremes; the proficiency and racial ladders; a whole blow through each
branch (a sword, the soft material's line, a monster's assigned axe
wearing the player's cuirass); the registry declining and accepting;
the Meaner Monsters row at mint; and the seams. Not run here: a game;
the numbers Mac feels from the chair are the next report.

## AUDIT PCO1 (2026-09-12, Mac: "do a 1:1 parity audit to ensure everything is perfect and working")

The port read against the decompiled 1.44 again, method for method, the
day it shipped. Checked and standing: `Awake`/`InitMod`'s ladder and
every register it makes; `CalculateAttackDamage` line for line (the
enemy's weapon-vs-natural swap, the material gate and the soft
multiplier, the 150% skill, the two critical arms, the player's four
terms, the three-attack monster loop with its reflex gate and its
assigned weapons, the poison, the max/round/round, the HUD line, the
natural resistance and its discarded clamp, the shield roll and the
under-armour comparison, the condition alter, the `< 1` return, the
class's own DamageEquipment, the monster/piece/shield reductions, the
Ring of Namira dispatch); every to-hit helper; the damage helpers; the
archery tables; the condition bands; the four material ladders;
`DamageEquipment` and its three wear paths, the warnings word for word;
the material-difference arithmetic; the eight reduction tables cell for
cell (eighty rows, the default row too); the monsters' hides;
`SpecialWeaponCheckForMonsters` and the seventeen weapons;
`ShieldBlockChanceCalculation` and `CompareShieldToUnderArmor`; the
twenty-slot body table; the backstab pair; `CriticalStrikeHandler`;
`GetBonusOrPenaltyByEnemyType`; the Meaner Monsters table value for
value (forty-two rows, a script diffing the C# assignments against
`MEANER_MONSTERS`: no difference); the enum facts (EnemyGroups None -1,
the body parts, the skill and race ids, the proficiency bits, the
equip slot); and that no port caller reaches an overridable helper
outside the core (so InitMod's fourteen per-helper registers need no
port-side twin: DFU's own callers of them are all inside
CalculateAttackDamage, which the mod replaces whole).

**Two findings, both fixed or recorded:**

1. **The archery arm's stock-path registers were missing.** InitMod
   registers `AdjustWeaponHitChanceMod` and `AdjustWeaponAttackDamage`
   on FormulaHelper under `rolePlayRealismArcheryModule` ALONE, and
   DFU's stock `CalculateAttackDamage` calls them (after
   `CalculateWeaponToHit`, and as `CalculateWeaponAttackDamage`'s last
   line - "Mod hook for adjusting final hit chance mod"; no-ops in
   FormulaHelper). So with the redone armour formula OFF and the archery
   arm on, DFU still bends a bow by its draw; the port's stock core had
   no such hooks, so it did not. `formulas.js` grew the two members
   (identity when nothing is registered) at the C#'s two sites, the
   stock weapon roll takes `weaponAnimTime`, and `installPcaao`
   registers the overhaul's copies under the archery switch. Pinned.
2. **A class enemy's bare fists deal 0** - a behaviour of the mod, not
   of the port; recorded above under bug for bug, and pinned so a later
   hand does not "fix" it.

Not changed, noted: the reflexes the monster loop reads are the
player's in the C# (`playerEntity.Reflexes`); the port's core reads the
same `playerReflexes`-or-target fallback its stock core does, which
hands the player's in every fight the player is in. The break message
on a foe's gear follows the stock port (DFU's ItemBreaks pops it for
any owner). Pins: 24 in `test/pcaao.test.js`.

## AUDIT WEAPON-POOL (2026-10-06, Mac: "Audit this") - WEAPON-POOL read again before it merges

Three independent lanes, each a cold read of the PR (#656) against its committed tree, with repros: who mints and who
reads a weapon's condition (every producer, every reader in points); the migration's reach (every place a save, the
relay or the account service keeps a weapon, every load path, the boot order, the fingerprint); and what the change
says and pins (every claim computed, every page it left, its pins mutated past their 23 records). Every finding was
reproduced before it was fixed. FOUND, each fixed and pinned (`test/auditweaponpool.test.js` 4, `test/weaponpool.test.js`
4; `tools/mutants/auditweaponpool.json` 6 of 6 dead, `weaponpool.json` re-aimed by content, 23 of 23):

- **MEDIUM - P1: SELL-AS-FOUND's mark stayed on the row's pool.** Roleplay & Realism: Items marks a found piece's
  condition as `foundCondition`, and online the counter pays no more than that share (`systems/tradeModes.js`
  saleConditionPercentage). The migration moved the condition and the maximum and left the mark: a dagger found at 25
  of 50 became 800 of 1,600 marked 25 - sold online at 1%, a 32nd of its share, mended or not. FIXED
  (`systems/conditionRepair.js` repoolWeapon): the mark moves by the same share.
- **MEDIUM - P2: a weapon outside the load's lists wore on its row's pool.** The load walks the lists its repairs walk,
  and a weapon came back into the pack mid-session, on its row's pool, from everywhere else: hung in a room (a scene's
  `decorOwn`), a revenant's take and its sworn companion's pack (mod data), a quest's prize (`snap.quest`), an heir's
  remains and bequest (Project Legacy - paid at the heir's birth, with no load at all), a living foe's or a guard's
  kit, and a record the account service or the relay hands back (a market good, a vendor's stock, the guild vault, a
  trade, the room's memory, an old build's mint). A Worm's Tooth a revenant handed back still broke in five strikes,
  before any load could move it. FIXED (`systems/equip.js` lowerCondition, the one door every blow, strike, held bill and
  duel wears through): a weapon still on its row's pool moves before a point is taken - the same law, idempotent, and
  nothing for a piece already moved. The load still moves the bulk; the rest moves at its first wear, and until then
  its share, its price and a kit's share of it are what they will be.
- **LOW - P3: a job booked before the update would have waited up to 13 times as long.** With Instant Repairs off, DFU
  re-derives every unfinished job's time from its missing points when another piece is left at the same smith, and a
  job never shortens (`systems/repairService.js` updateRepairTimes): moved onto the pool, a broken Daedric dagger booked
  for a day became 12.8 days' work, 13.3 stretched by the queue. FIXED: a piece at a smith (`repairData`) is left; it
  comes back whole on its row and moves at its first wear.
- **LOW - P4: a classic save's artifact could take the pool.** The guard read `magic` alone, and its comment said an
  artifact is minted magic too - the classic importer (`systems/classicSave.js` classicItemFromRecord) marks it
  `artifact` and never `magic`, so an artifact whose uses were what its row gave (a Daedric dagger's 400) moved, its
  uses x32. FIXED: `artifact` is read too.
- **MEDIUM - P5: the Cast-When-Held numbers were never reached in play.** "200 rounds and 6,400" pinned the payload on a
  piece never equipped; the first equip bills the spell's classic casting cost in condition (assignHeldSpell - 5 at
  the least, the loot's held spells about 120-160), so an iron dagger broke the moment it went on, and the pool's keeps
  1,600 less the bill and runs four rounds a point of the rest. FIXED: the law's comment, this page's WEAPON-POOL
  paragraph, the Ledger row, the Testing row, and the pin - through assignHeldSpell (159 billed, 1,441 left, 5,764
  rounds).
- **MEDIUM - P6: the weapons-only guard was pinned only against deletion.** Turned on armour alone it survived every
  suite that loads a save: a shirt's 200, an amulet's 800 and a torch's 50 would each have been read as a weapon on its
  row and moved to 1,600. FIXED: clothing, jewellery and a torch stand beside the cuirass in the pin.
- **LOW - P7: the classic row's fingerprint was pinned on a Tanto whose 50 is the Dagger's beside it** - a row read one
  off survived. FIXED: with the mod on, a classic Short Bow (beside a War Axe's 800) and a Wakizashi (beside a
  Shortsword's 300) move too.
- **LOW - P8: a page the change left was false.** `05-Combat/Dwarven-Thunderlock.md` gave the gun's condition as 90, and
  `systems/thunderlock.js` its reason; it holds 4,800 at Dwarven. FIXED.
- **LOW - P9: five sentences the change wrote, or left, were not true as written.** "Every weapon pool a multiple of
  400" (the repair_rate row and its pin's comment: a Fine dagger is 1,840 - a multiple of four, which is what keeps
  three quarters whole); Economy-Arc's "half that" upkeep stood on WEAR-TWICE's 3.3-6.4, which WEAR-ONE had already
  halved; its kit example (1,600 to 1,200) showed no rounding; the REPAIR-RATE row's pins still named the Iron Dagger's
  37 of 50; and the weapons suite's row and title said "verbatim DFU" over two assertions of the departure. FIXED, each
  in its place.

RECORDED, not changed - what a deeper pool does by design (Mac: "if we actually want to encourage different builds we
can't keep the numbers as is"), and what is left for another pass:

- **The overhaul's sharp edge lasts with the pool.** Condition-based effectiveness (on by default) strikes x1.3 at 92%
  and up and x1.1 at 76-91%, and blunts a blade below 61%; a share lasts as many more blows as the pool is deeper, so an
  iron dagger strikes at x1.3 for 65 blows of 20 damage (it was 3), and a long bow for 16 times its old count - as a
  warhammer always did. DONE (BAL1, 2026-10-10): the bands over 75% ride the mod's wear module - the third departure,
  above.
- **Two point-by-point enchantments scale the other way.** Repairs Objects mends 1 point every four rounds on the first
  piece below its condition in the pack, so a dagger found at 20% holds it 32 times as long; Item Deteriorates (a side
  effect that pays 3,000, 1,500 or 500 points) wears 1 every four rounds, so a dagger taking it lasts 6,400 rounds (it
  was 200) for the same credit. Repairs Objects DONE on Mac's word ("Now we just gotta fix the 'repairs objects' not
  working"): MEND-WORN, below. Item Deteriorates stands.
- **Repair days where repairs are not instant** (Instant Repairs is the default): 1,000 points a day, so a broken
  Daedric weapon of any type is 12.8 days (a Daedric dagger was one).
- **An enchanted piece There's a Hole in the Bottom of the Ocean raised a material** keeps its old material's pool -
  unless that number is what a row gave at the new one (a Battle Axe raised to elven or mithril, a Claymore to
  Daedric), and then it moves to the new material's pool, as the same piece unenchanted is re-minted.
- **A classic MAGIC.DEF piece** (enchantments, and neither mark) whose uses happen to equal an old mint still moves: it
  cannot be told from a classic piece the player enchanted.
- **Not this change's, for its own pass:** the load's other repairs (DISC21-A's mint, DISC29-B's names, RARITY-WEAR)
  walk the same lists, so they miss the stores P2 names - a piece is repaired at a later load once it is back in the
  pack, or never; and customs' walk (`net/realmGoldLaw.js` stashedItemLists) misses a revenant companion's pack. DONE
  in the same pull request, on Mac's word: ITEM-WALK, below.

Checked and found sound: every weapon mint runs through mintCondition (the loot factories, shops, enemies and Roleplay
& Realism's, quests, the biography, the starting kit, the smith, the spell, the trophy, the spoils, the Broker, the
Aetheric pieces, the Thunderlock and its pellet, the market's re-mint, the duel, the ocean's re-mint); no weapon reader
takes a template's hitPoints but the mint, the viewer and the migration, and every other reader takes a share; nothing
in `src/net` mints a condition, and neither service's bundle reaches a file WEAPON-POOL changed (ITEM-WALK C's, below, is the account service's); the templates the fingerprint
needs are registered before the first load (save.js reaches thunderlock.js, and Roleplay & Realism's rows are laid at
every host's start); an equipped weapon is the moved object (the repool runs before the equip table is rebuilt and the
held enchantments restarted); quickslots keep no condition; `quality` is the smith's alone; furnishings hold furniture
alone; a guild's shelf holds no weapon a mint gives.

## ITEM-WALK (2026-10-07, Mac: "Do them now within this PR") - the audit's two follow-ups, in the same pull request

AUDIT WEAPON-POOL left two gaps it did not cause for their own pass: the load's other repairs walked the lists the
weapon migration walked, and customs did not count a sworn revenant's pack. Mac asked for both in this pull request.
`test/itemwalk.test.js` (5), `tools/mutants/itemwalk.json` (25 of 25 dead).

- **A - one walk of every list a save holds** (`systems/save.js` savedItemLists, heldItemLists). The load's one-time
  item repairs (DISC21-A's mint, WEAPON-POOL's move, DISC29-B's names, WB12a's Embers, RARITY-WEAR's bases) ran over
  the pack's lists and customs' walk, and nowhere else. A piece kept anywhere else was repaired only once it was back
  in the pack and the game loaded again: a weapon by P2's door at its first wear, the others never. Now one walk holds
  every list: the character's own five (the pack, the wagon, the Materials Bag, the furnisher's deliveries and the
  repairer's shelf), every list customs reads (`net/realmGoldLaw.js` stashedItemLists), and every other one
  (heldItemLists):
  - in each cached scene, the owner's own things set out in a room (`decorOwn`; never a weapon or armour) and a guild's
    day's Buy shelves (`guildShelves`);
  - a living foe's kit and a guard's, in the world bag and in a building's half of the save (`interior`);
  - in the feud's record, what a revenant took;
  - in the quest block, each quest's item as its Item resource keeps it (`resourceSpecific.item`), and what a Foe
    resource will hand its spawns (`itemQueue`);
  - in Project Legacy's record, each member's bequest, the waiting Succession's, and each fallen member's remains, the
    list as it lies and as it was laid.

  Not walked, because they are pictures of items and not items: a Legacy member's `look` (a paperdoll's recipe of
  template, group and slot, which DISC21-A would read as an unminted piece) and a set-out piece's descriptor in the
  room (`decor[].item`).

  One runner (`repairItemLists`) holds the five repairs, and the load runs it over the walk before any host restores
  from the save. The furnisher's deliveries and a guild's shelves hold nothing any repair touches today; they are in
  the walk so the next repair reaches them.
- **B - a bequest and the remains are repaired as they leave the line's record** (`scenes/legacyHost.js`). Project
  Legacy keeps its record on the device as well as in a save, and plays the newer (`mergeFamily`). A bequest reaches
  its heir at birth, with no load at all, and the remains open where they lie. The runner now runs on each bequest
  piece as it is paid (`payEstateOf`) and on a remains list as it opens, before the claim's mark is taken, so opening
  a list still claims nothing.
- **C - customs counts a sworn revenant's pack** (`net/realmGoldLaw.js` stashedItemLists). The player stores into a
  sworn revenant's pack as into a crew hand's (`revenantCompanions.js` packOf), and AUDIT WK-P1 counted the crew's alone:
  a million gold in the revenant's pack crossed whole. Each sworn, undefeated record's `companion.items` is now counted
  and taken from as the crew's are, and the account service's first-save gate reads the same walk. A record the load
  keeps no pack for (not sworn, or defeated) counts nothing. What a revenant took is its own until it falls and is
  never counted. **Deploy:** the account service bundles `realmGoldLaw.js`, so `account-deploy.yml` redeploys it on
  merge; it holds no sockets and drops nobody. The relay reaches none of these files.

Recorded, not changed:
- **A rolled wand set out in a room before RARITY-WEAR** loads on its Amulet, and its piece keeps the Wand's picture and
  name where it stands. The room draws a piece from its own descriptor and matches the item to it by id alone, so this
  is only how it looks; taken down, the piece goes and the item comes back as the Amulet it is. An online home's
  pieces are the account service's, out of a save's reach.
- **Found beside it, older than this change:** `systems/quest/questRepair.js` goneOnPurpose knows an Item given to a
  Foe by the same object in the Foe's `itemQueue`, and a load restores the two as separate copies. After a load, the
  quest repair (`repairActiveQuests`) can place such an item at its marker again, while the foe still carries it.

Re-aimed: `test/disc21.test.js`'s pin on the load's repair line (the walk and the runner), and
`tools/mutants/audit0929_actions.json`'s D3 record (customs' walk dropped from savedItemLists).

## MEND-WORN (2026-10-07, Mac: "Now we just gotta fix the 'repairs objects' not working") - Repairs Objects mends what is worn

Repairs Objects ran, and it looked dead. DFU's law (MagicRound, `RepairsObjects.cs:69-102`) mends one point every fourth
magic round on the FIRST piece below its condition in the whole pack, in the pack's order. That is Interkarma's 2022
change, 6846029b4, "RepairsObjects should repair all items in inventory". From 2019 the loop walked the equip table,
which the class's own comment records as classic's: "Only equipped items will receive repairs ... Priority is based on
equip order enumeration". The port ran the 2022 law verbatim, and three things in the port made it invisible:

- **The pack.** Roleplay & Realism: Items is on by default. Its kit is worn to 30-75% (a runner's shoes ahead of the gear),
  and its loot and its shelves come at 20-75%, books among them. So the first damaged piece was rarely one the player
  wore. The pins' own fixture is the mod's kit for Running, Long Blade and Streetwise, put on: DFU's walk mends the shoes.
- **What a smith refuses.** The walk reads no `isNotRepairable`. DFU sets it on the Arrow (minted at 0) and the four
  lights, whose condition is their fuel, and the port sets it on the Dwemer Pellet, the Campfire and the rest items'
  doses (AUDIT REST II H7). A lit torch burns a point every twenty real seconds, which is a tick's own pace, so a torch
  first in the pack was refuelled as it burned.
- **The pool.** WEAPON-POOL's pools (1,600 to 12,800) left a weapon one point a tick, a 32nd of a dagger's old share: an
  iron blade 1% about every five real minutes, a Daedric one every 43.

The law now (`systems/enchantments.js` `repairsObjectsTarget`, `POOL_WEAPON_MEND`; `systems/itemTemplates.js`
`mendOrder`):

- **Which piece.** What is worn first, the most worn first (the lowest share of its condition left), then the pack's most
  worn; two at one share keep the pack's order. That is MEND-AIM's order for a repair kit (kurkku: "always repairing the
  most worn piece of equipment means fixing arrows or random loot you picked up most of the time"). It is one export now,
  `mendOrder`, read by the kit's `repairKitTargets` and by Repairs Objects.
- **Never what a smith refuses** as not repairable (the template's `isNotRepairable`, `repairService.js`
  repairRefusal's). An enchanted piece mends only under AllowMagicRepairs, which is DFU's gate (on by default and online,
  DISC22-A).
- **How much.** A weapon on the pool mends 32 a tick (Mac, asked: "Weapons as a classic dagger"). That is the classic
  Dagger's point of its 50, on the pool: iron 2% a tick, Daedric 0.25%. DFU's own yardstick, a Dwarven dagger battered
  to new in eight or nine hours, now holds for every weapon type: 123 ticks, about 8.2 game hours. A magic item's or an
  artifact's condition is its uses, not the pool (`loot.js`), so it keeps DFU's point, and so do armour and everything
  else.
- **Unchanged from DFU:** the cadence (every fourth round), the player alone, one piece a tick, and no synthetic-time
  gate. A weapon still on its row's pool moves to the one pool first (`repoolWeapon`), as `lowerCondition` does before a
  wear (AUDIT WEAPON-POOL P2).

Recorded, not changed:
- **A pool weapon now mends about as fast as a fight wears it.** It gets 32 a tick, every twenty real seconds, against a
  point or two a landed blow (WEAR-ONE). A classic dagger had the same share per tick and wore 32 times as fast.
- **Armour keeps the point:** an iron cuirass (4,096) mends 1% every 41 ticks, about 14 real minutes. The most worn
  piece takes every tick, so a blade waits behind a cuirass worn further than it: Roleplay & Realism's kit at 53% holds
  a blade at 69% back upwards of 630 ticks, 42 game hours. In play the blade is usually the most worn: it wears on every
  blow the player lands, a piece of armour only on the blows that strike it, and its pool is the smaller.
- **Camping Equipment** keeps its uses in its condition and a smith mends it, so it is mended once nothing worn wants
  it, as a smith would.
- **Item Deteriorates** still wears a point every four rounds (AUDIT WEAPON-POOL's recorded line, above).

Four hosts: none changed. The law runs in the one round pump (`systems/worldTick.js` runMagicRoundsFor, then
enchantmentMagicRound) that every host's ticker feeds: exterior.js, world.js and worldModes.js through
`scenes/shared.js` createPlayerTicker, and dungeonContext.js through tickPlayerMinutes. Deploy: none, since neither
service's bundle reaches these files. `test/mend_worn.test.js` (8); `tools/mutants/mend_worn.json` (15 of 15 dead, the
old walk restored among them). Re-aimed by content, because the kit's comparator moved into `mendOrder`:
`tools/mutants/mend_aim.json` MEND-AIM-loot-before-worn and `tools/mutants/prof3.json` PROF3-kit-least-worn (both dead).
