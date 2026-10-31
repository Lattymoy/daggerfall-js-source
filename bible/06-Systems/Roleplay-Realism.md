# Roleplay & Realism

Hazelnut's Roleplay & Realism 1.8 for Daggerfall Unity (Nexus mod 16, MIT), ported: eighteen switchable gameplay
modules, an enhanced-riding component, a refined training window, and the Master Armorer quest line with its own fort.
Its companion mod, Roleplay & Realism: Items, has its own page (`Roleplay-Realism-Items.md`). The player meets it
through the Features home and the Mods pane, on horseback, at guild trainers, and in the Fighters Guild's quest line.
The record is `vendor/roleplay-realism/` (manifest, settings, presets, string table and the scripts verbatim).

## How it works

**The source.** The shipped bundle has a compiled DLL and no source; the author's repository at the 1.8 commit carries
the same manifest, settings and string table, and is taken as the shipped version. Every function in
`src/systems/roleplayRealism/rrRealism.js` names the C# member it restates. `rrInstall.js` runs `InitMod`'s
registrations after Items'. Each switch is read at the call, so a pane toggle takes effect at the next roll; the class
enemies' appearance applies when the game next loads.

**The modules**, each at the port's own seam for DFU's hook:

| Module | What it does | Seam |
|---|---|---|
| advancedArchery | archery hit and damage | `src/combat/formulas.js` overrides |
| climbingRestriction | no climbing with a melee weapon drawn | `climbing.js` `registerClimbingChanceOverride` |
| weaponSpeed | swing speed blend (only when Items' weaponBalance is off) | `weaponStates.registerMeleeWeaponAnimTime` |
| weaponMaterials | to-hit by material | `formulas.js` `calculateAttackDamage` |
| equipDamage | armour wear on a hit | `formulas.js` `damageEquipment` |
| classicStrengthDamageBonus | classic strength bonus display | `formulas.js` `damageModifier` |
| loanAmountPerLevel | bank loan by level | `banking.registerMaxBankLoan` |
| shipPorts | ships only from port towns | `ship.setShipAvailable` |
| encumbranceEffects | speed and fatigue penalty past 75% of the pack's ceiling | the magic-round hook, `entityMaxEncumbrance` |
| autoExtinguishLight | the light doused leaving a dungeon | `worldModes` at the exit |
| purificationPotion | the purification recipe heals and cures poison | `potions.overridePotionRecipes` |
| enemyAppearance | eight class enemies redrawn | `applyEnemyAppearance` at install |
| underworldExpulsion | Thieves Guild and Dark Brotherhood expel, and send a squad | `guilds.setUnderworldRule` |
| bedSleeping | beds as rest points | interior beds run `toggleRest` |
| variantNpcs, variantResidents | shopkeepers by quality, residents by face and outfit | `src/systems/roleplayRealism/rrVariants.js` |

**Enhanced riding** (`src/systems/roleplayRealism/rrRidingHost.js`). No gallop with the cart; back and sideways movement
limited on horseback; the mount sprite follows the terrain's slope; riding at a run tramples walkers (blood, a cry, the
watch called, Assault) and charges foes. A journey driven by the Overworld or Travel Options never tramples.

**Refined training.** At a guild trainer, the skill picker opens first; the price falls with the skill under variable
pricing, and under intensive training a skill under 46 may be trained for five days at once.

**The Master Armorer quest line** (`src/systems/roleplayRealism/rrQuestLine.js`). Three quests (Mountain Rumors at
Fighters Guild rank 9, The Master Armorer, A Careless Price), three factions and a custom armour service, vendored
verbatim. Northrock Fort, a new location in the Wrothgarian Mountains, and the master armorer's shop come through
DFU's `WorldDataReplacement`, ported whole (`src/formats/worldData/worldDataReplacement.js`).

## Rules

- **Ported 1:1 beside Roleplay & Realism: Items** (Mac).
- **Departures from the mod's defaults:**
  - `shipPorts` ships off: on, every boat owner lost boarding from anywhere without choosing to. It is a curated row on
    the Features home.
  - `equipDamage` ships off, with gear wear at DFU's amount (`06-Systems/Economy-Arc.md`).
  - `GallopingInTowns` ships on (Mac, "Remove forced horse walking in towns").
- **fightersTeachHandToHand is retired** (Mac): Hand-to-Hand is in the base guild lists.
- **Swing speed** reads the weaponSpeed blend through the game's own bounded swing law, not the mod's
  `3 * (115 - blend)` (Mac, "swing speed is insane").
- **The encumbrance penalty reads the pack's real ceiling**, weight allowances included.
- **Residents take their region's race**, as the street does.
- Bandaging is Items' alone: this mod's handler only registers without Items, and Items is always here.

## Daggerfall Unity

The mod hangs on DFU's hooks: `FormulaHelper.RegisterOverride`, `TransportManager.ShipAvailiable`,
`EntityEffectBroker.OnNewMagicRound`, `GuildManager.RegisterCustomGuild`, `PlayerActivate.RegisterCustomActivation`,
`QuestListsManager.RegisterQuestList`, `PlacesTable` and `FactionsTable.AddIntoTable`, and `WorldDataReplacement`. The
port had none of the quest-line hooks, so they were ported from DFU too. Where two mods register the same formula, DFU
keeps the last; the port chains them, so switching this mod's arm off returns the one before.

## Code and tests

- `src/systems/roleplayRealism/rrRealism.js` - the laws
- `src/systems/roleplayRealism/rrInstall.js` - the registrations
- `src/systems/roleplayRealism/rrVariants.js`, `rrRidingHost.js`, `rrQuestLine.js` - sprites, riding, the quest line
- `src/formats/worldData/worldDataReplacement.js` - DFU's world data replacement
- `test/systems/rr1_realism.test.js`, `test/systems/rr2_realism.test.js`, `test/systems/quest/rr3_questline.test.js`,
  `test/systems/talk/rr3b_worlddata.test.js`, `test/systems/auditrr.test.js`, `test/systems/auditrr2.test.js`

## Open

- The shipped bundle was not diffed against the repository commit taken as 1.8.
