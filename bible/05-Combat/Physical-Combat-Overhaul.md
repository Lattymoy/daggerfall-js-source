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
| `CalculateAttackDamage` | the whole blow: the enemy's weapon-vs-natural swap, the material gate (or the soft-material multiplier), the 150% player skill, the critical strike, the player's swing/proficiency/racial/backstab terms, the struck part, the hand-to-hand / monster-loop / weapon branches, the crit and material multipliers, the natural resistance, the shield roll, the condition multiplier, the wear, the armour reductions, the Ring of Namira, the VCEH event | `pcaaoAttackDamage`; registered as `calculateAttackDamage`'s CORE - the port's tail (concealment, the Strikes payload, the racial hit hook, the struck hook that IS the Ring of Namira here, the HUD report) is DFU's callers' work and runs after either core |
| `CalculateSwingModifiers` | DFU's own table | the callers' `damageMod`/`toHitMod` (playerAttackOptions, SWING_MODS) - the same numbers |
| `CalculateProficiencyModifiers` / `CalculateRacialModifiers` | stat-driven per weapon skill and race, on the C#'s else-if ladders | `pcaaoProficiencyModifiers`, `pcaaoRacialModifiers` |
| `CalculateWeaponToHit` | material x2 + 2 ("+14, not +60") | `pcaaoWeaponToHit` |
| `CalculateArmorToHit` / `AdrenalineRush` / `StatDiffs` / `Skills` / `Adjustments` / `SuccessfulHit` | the player 100 less the enchantment channels, a class enemy 60, a monster its part; a sixth of health and +8/+12; luck/10, agility/4, speed/8 less the target's luck rounded; dodging halved; +50 for a monster target, -50 always; the sum, its clamp DISCARDED, Dice100 | `pcaaoArmorToHit` ... `pcaaoSuccessfulHit` |
| `CalculateStruckBodyPart` | twenty slots, feet likelier than the head | `PCAAO_BODY_PARTS`, `pcaaoStruckBodyPart` |
| `CriticalStrikeHandler` | luck's `Mathf.Floor((luck-50)/25f)` term (clamp discarded) bending the divisor | `pcaaoCriticalStrike` |
| `GetBonusOrPenaltyByEnemyType` | willpower's `Random.Range(0, n)` bonus and the level penalty on the career's Bonus/Phobia bits, the Humanoid arm on GetEnemyGroup | `pcaaoBonusOrPenaltyByEnemyType` |
| `CalculateHandToHandAttackDamage` / `CalculateWeaponAttackDamage` | the strength term, the Skeletal Warrior's halving and the silver six's doubling, a two-handed non-bow doubling the strength term | `pcaaoHandToHandAttackDamage`, `pcaaoWeaponAttackDamage`, `SILVER_DOUBLED_CAREERS` |
| `AdjustWeaponHitChanceMod` / `AdjustWeaponAttackDamage` | Roleplay Realism's archery: the bow's draw time in ms bends hit and damage; registered on FormulaHelper whatever the armour module says (AUDIT PCO1) | `pcaaoAdjustWeaponHitChanceMod`, `pcaaoAdjustWeaponAttackDamage`, registered on `formulas.adjustWeaponHitChanceMod` / `adjustWeaponAttackDamage` - DFU's two no-op hooks, grown into the stock core at the C#'s two sites (AUDIT PCO1); the draw timer is `playerWeapon.lastDrawMs` (below) |
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

## What is kept bug for bug

- `Mathf.Round` rounds half to EVEN (`unityRound`), and every float the
  C# computes is a float32 (`Math.fround` at each step), so `15 * 0.9f`
  is `13.5f` and rounds to 14 where a double would say 13.
- Four `Mathf.Clamp` calls whose result the C# DISCARDS: the hit
  chance's 3..97 (a 300 always hits, a -300 never), the natural
  resistance's +-0.2 (moot - three stats of 100 reach exactly 0.2),
  the critical strike's luck term, the shield chances. Not clamped here
  either.
- C# integer division truncates toward zero; where an operand can be
  negative (a stat below 50, a level difference) the port truncates.
- The archery hit table's `> 8000` arm sits behind `> 5000` and never
  fires; carried as written.
- The warnings repeat while a piece sits at exactly 48% or 15%.
- The soft-material multiplier and the crit multiplier apply to the
  WHOLE blow, backstab included, before the wear and the reduction; the
  wear is charged on the PRE-reduction damage.
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
  default as shipped (all on). Mac's to flip.
- **The two derived arms read the OTHER mods' own switches** (MM1, Mac:
  "there shouldn't be compatibility switches between mods"; they were
  switches of this mod's from PCO1 to MM1). `meanerMonsters` is
  `meanerMonsters/Enabled` - Ralzar's mod, vendored
  (`04-Characters/Meaner-Monsters.md`); `rolePlayRealismArchery` is
  `roleplayRealism/advancedArchery`, undefined (not loaded) until that
  mod is vendored. `modSettingIfDeclared` is the read. With both mods
  on, Ralzar's row lands first and this mod's edit over it, as DFU
  Awakes the dependency first.
- **The bow's draw time.** DFU hands `weaponAnimTime` (FPSWeapon's
  animTime, ms) to CalculateAttackDamage. The port's classic bow now
  times its draw: `playerWeapon.lastDrawMs` starts when the drawback
  begins (StrikeUp) and reads at the release; the instant shot is 0
  (the archery arms gate on `> 0`). Enemy archers pass 0, as DFU's
  EnemyAttack does.
- **`item.customMagic`.** The warning's name picks the short name for a
  custom-enchanted item, the long name otherwise; the port's items
  carry no such field, so the long name stands.
- **The Meaner Monsters edit takes effect on monsters spawned after
  the switch** - DFU rewrites the table at Awake; the port overlays the
  row at mint.

## Pinned (`test/pcaao.test.js`, 24)

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
