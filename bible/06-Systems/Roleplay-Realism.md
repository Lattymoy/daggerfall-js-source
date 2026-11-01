# Roleplay & Realism

Hazelnut's Roleplay & Realism 1.8 for Daggerfall Unity (MIT), ported: eighteen switchable gameplay
modules, an enhanced-riding component, a refined training window, and the Master Armorer quest line with its own fort.
Its companion mod, Roleplay & Realism: Items, has its own page (`Roleplay-Realism-Items.md`). The player meets it
through the Features home and the Mods pane, on horseback, at guild trainers, and in the Fighters Guild's quest line.
The release's scripts are restated in our code, its MIT notice in `LICENSE`. Every line the player reads, the quest
line's world and the keepers' pictures are ours; the release's record is in `01-Overview/Own-Work.md`.

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

**The keepers** (`src/systems/roleplayRealism/rrKeepers.js` `RR_KEEPERS`). Each keeper is our rule over the player's
own tavern and shop folk: one record of TEXTURE.182 for the body, another's head, a cloth moved to another of the
palette's ramps, and for the tavern's own keeper a third record's bottles. Six bodies and six heads, no two shared: a
working man, a shopkeeper's wife, an elder merchant with his purse, a lady, a young barkeep and the tavern's keeper.
Each keeps the aspect of the classic keeper it stands in for (`RR_KEEPER_OF`), so the scale table sets its size, and
stands as big as that keeper. Record 4 is Daggerfall's own, built from a spec
(`src/systems/roleplayRealism/rrDerivedArt.json`). The week button ("5 Days") is ours
(`src/systems/roleplayRealism/rrKeeperArt.js`); the other relabelled buttons are asked for by nothing.

**Enhanced riding** (`src/systems/roleplayRealism/rrRidingHost.js`). No gallop with the cart; back and sideways movement
limited on horseback; the mount sprite follows the terrain's slope; riding at a run tramples walkers (blood, a cry, the
watch called, Assault) and charges foes. A journey driven by the Overworld or Travel Options never tramples.

**Refined training.** At a guild trainer, the skill picker opens first; the price falls with the skill under variable
pricing, and under intensive training a skill under 46 may be trained for five days at once.

**The Master Armorer quest line** (`src/systems/roleplayRealism/rrQuestLine.js`). Three quests in our words on the
release's QBN (`src/systems/roleplayRealism/quests/`): Talk of a Missing Smith at Fighters Guild rank 9, The Smith in
the Keep, Blood Owed. Three factions and a custom armour service; the names are Lord Edric Vane, Captain Moira Dunn and
Brannoc Hale. The world is ours (`src/systems/roleplayRealism/rrWorld.js`), through DFU's `WorldDataReplacement`
(`src/formats/worldData/worldDataReplacement.js`):

- **The keep.** Grayhold, at the release's pixel (938, 51, beside the Aldleigh its logic names), a wealthy home on the
  map. Its block is the player's own PALAGA04.RMB, the court stood down and fourteen quest markers where the court
  stood (`rrKeepMarkers`). The building is House6, Lord Vane's, quality 16.
- **The armory.** The player's own ARMRAM03 record 14, an Armorer of faction 1022, quality 18, seed 1022, with Brannoc
  Hale at its quest marker. Kept as facts: the location and faction ids, the files' DFU names and the three towns the
  logic sends the smith to. BAY-OWN: the logic sets the line in the Wrothgarian Mountains.

## Rules

- **Ported 1:1 beside Roleplay & Realism: Items** (Mac); every word, the keep, the armory and the keepers ours
  (OWN-WORK, the owner). Each quest message was held to the release's with `tools/ownQuestCheck.mjs`: the QBN's
  sha256, every message's macros, PLAIN-TEXT and no six-word run of DFU's or ARENA2's quest text.
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
- `src/systems/roleplayRealism/rrKeepers.js`, `rrWorld.js`, `quests/` - our keepers, world and quests
- `src/formats/worldData/worldDataReplacement.js` - DFU's world data replacement
- `test/systems/rr1_realism.test.js`, `test/systems/rr2_realism.test.js`, `test/systems/quest/rr3_questline.test.js`,
  `test/systems/talk/rr3b_worlddata.test.js`, `test/systems/auditrr.test.js`, `test/systems/auditrr2.test.js`,
  `test/systems/rr_nobethesda2.test.js`; mutants in `tools/mutants/rr2.json`

## Open

- The shipped bundle was not diffed against the repository commit taken as 1.8.
