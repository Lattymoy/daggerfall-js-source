# Physical Combat and Armor Overhaul (PCAAO)

Kirk.O's DFU mod Physical Combat And Armor Overhaul 1.44, ported from its shipped DLL: armour reduces the damage taken
instead of the chance to be hit, plus critical strikes that add damage, condition-based effectiveness, soft-material
requirements and a strength fix. It is on by default in the Mods pane; while on, the player and foes both fight by its
formulas. The vendored record is `vendor/pcaao/`.

## How it works

- **Overrides.** The mod replaces FormulaHelper's combat formulas through `RegisterOverride`; the port does the same
  through `registerFormulaOverride` in `src/combat/formulas.js`. Every function in `src/combat/pcaao.js` names the C#
  method it restates; its Meaner Monsters table is `src/combat/pcaaoMeanerMonsters.js`.
- **Modules** (`pcaaoModules`, settings in `src/systems/modSettings.js`): `armorHitFormulaRedone`,
  `criticalStrikesIncreaseDamage`, `conditionBasedEffectiveness`, `softMaterialRequirements`,
  `fixedStrengthDamageModifier` (all on), `equipmentDamageEnhanced` and `fadingEnchantedItems` (off). Dependent modules
  resolve as the mod resolves them. Offline the switches are the player's; online the room reads the defaults.
- **The blow** (`pcaaoAttackDamage`): the enemy weapon-or-natural swap, the material gate or soft-material multiplier,
  the 150% skill, the critical, the swing, proficiency, racial and backstab terms, the struck part (`pcaaoStruckBodyPart`,
  feet likelier than the head), then armour reduction by material, weapon kind and piece or shield, and the monsters'
  hides. Seventeen monsters' blows count as the weapon their sprite carries (`SPECIAL_WEAPON_MONSTERS`).
- **Shields.** A shield is DFU's `GetIsShield` (`isShield`); every read of the left hand goes through
  `leftHandShield`, so a weapon in the left hand never blocks as a shield.
- **Other mods.** Its Meaner Monsters arm reads Meaner Monsters' own switch; its archery arm reads Roleplay & Realism's
  `Enabled` and `advancedArchery` (`modSettingIfDeclared`). With Meaner Monsters on, its row lands first and this mod's
  edit over it. The bow's draw time (`lastDrawMs`) feeds the archery arm.
- **Wear and repair.** With the mod's wear off, a blow wears gear as DFU's `DamageEquipment` says
  (`damageEquipment`), with the weapon actually used. Repairs Objects mends what is worn first, most worn first, then the
  pack (`repairsObjectsTarget`, `mendOrder`), a fiftieth of a piece's condition a tick, never less than DFU's point
  (`repairsObjectsMend`, `src/systems/enchantments.js`); a magic item's uses keep DFU's point. Weapons share one
  condition pool (`repoolWeapon`, `src/systems/conditionRepair.js`).

## Rules

- Integrated 1:1 with complete parity, and every mod on by default (Mac).
- Departures from the mod, each the decision named:
  1. The hit chance is clamped to 3..97, the clamp the C# computes and discards (Mac).
  2. The two wear modules ship off and the mod's core follows the switch: vanilla durability values (the repair
     triage, Mac's call).
  3. The condition bands above 75% stand only while the mod's wear stands (`sharpEdge`, `Balance-Arc.md`).
  4. One hit and crit rule for every striker (`Balance-Arc.md`).
  5. A beast's claws add their worn gauntlets' metal (`Balance-Arc.md`).
  6. A weapon in the left hand is no shield.
  7. A bow doubles the strength term as a two-handed weapon does.
- Kept bug for bug: Unity's round-half-to-even and float32 arithmetic (`unityRound`, `Math.fround`); the other
  discarded clamps; C# integer truncation; the unreachable archery arm; a class enemy's bare fists deal nothing.
- Not carried: the Vanilla Combat Event Handler mirror (no consumer) and a debug log line.
- Repair stops trying to match DFU's single point (the owner); a tick mends 2% of any piece.

## Daggerfall Unity

DFU's own formulas are `FormulaHelper.cs`; the mod overrides them. The port reads the shipped 1.44 decompiled, with the
v1.40 source naming what the decompiler numbered.

## Code and tests

- `src/combat/pcaao.js` - every formula; `src/combat/pcaaoMeanerMonsters.js` - its monster table
- `src/systems/enchantments.js`, `src/systems/conditionRepair.js` - Repairs Objects, weapon condition pools
- `test/systems/pcaao.test.js` - the formulas, the departures, the shield
- `test/systems/wear_vanilla.test.js` - the wear modules off
- `test/systems/mend_worn.test.js`, `test/systems/weaponpool.test.js`, `test/systems/itemwalk.test.js` - repair, pools,
  save walks

## Open

- The permission record is open in the Mod-Registry (Mac handed the bundle over; the repository states no licence).
