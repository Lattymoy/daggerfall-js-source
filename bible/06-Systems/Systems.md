# Systems

The game's rules live in `src/systems/`: items and loot, the character, magic, saves, guilds and factions, quests,
travel, survival, professions, online laws and the ported mods. A system is pure law wherever it can be, read by the
four scene hosts (`world.js`, `exterior.js`, `worldModes.js`, `dungeonContext.js`) and, where the account service or
the relay must agree, imported by them too. This page maps the folder; each system's own page is in `06-Systems/` or
the folder named. The core RPG systems ported from Daggerfall Unity are described in `06-Systems/Systems-Arc.md`.

## How it works

**The map of `src/systems/`.**

| Area | Where | Page |
|---|---|---|
| Items, inventory, equip | `inventory.js`, `equip.js`, `containers.js`, `useItem.js`, `src/systems/item/` (fields, bound, dye, ids, transfer) | `Systems-Arc.md` |
| Loot and rarity | `src/systems/loot/` (`loot.js`, `lootRarity.js`, `lootCurse.js`, `lootScry.js`, `gemGrades.js`, `lootLevelGate.js`), `eliteFoes.js`, `champions.js`, `reforge.js`, `gems.js` | `Loot-Arc.md`, `Loot-II-Arc.md`, `Loot-Rarity.md`, `Gem-Sockets.md` |
| Character | `chargen.js`, `chargenSession.js`, `skills.js`, `advancement.js`, `races.js`, `biography.js`, `oblivionLeveling.js`, `levelClimb.js` | `Systems-Arc.md`, `Oblivion-Remaster-Leveling.md` |
| Magic | `effects.js`, `effectBroker.js`, `spellcast.js`, `spellcost.js`, `enchantments.js`, `diseases.js`, `poisons.js`, `src/systems/spell/` | `Systems-Arc.md` |
| Saves | `src/systems/save/` (`save.js`, `saveSlots.js`, `saveTransfer.js`), `classicSave.js`, `cloudSaves.js`, `realmSaves.js`, `characterId.js` | `Accounts-And-Cloud-Saves-Arc.md`, `Realm-Arc.md` |
| Law and standing | `crimes.js`, `court.js`, `standing.js`, `legalBands.js`, `theft.js`, `stolenGoods.js` | `Standing-Arc.md` |
| Factions, guilds | `src/systems/faction/`, `src/systems/guild/`, `knightlyGifts.js`, `crimeGuilds.js` | `Systems-Arc.md` |
| Quests | `src/systems/quest/`, `src/systems/questlines/`, `src/systems/starts/`, `src/systems/bounty/` | `Quest-Arc.md`, `Questlines-Arc.md`, `Bounty-Boards.md` |
| Time and calendar | `gameDate.js`, `holidays.js`, `worldTick.js`, `timeScale.js`, `skyCalendar.js` | `Systems-Arc.md`, `Lived-Time.md` |
| Travel and transport | `src/systems/travel/`, `transport.js`, `riding.js`, `src/systems/horse/`, `src/systems/wagon/`, `src/systems/upkeep/`, `portalStone.js`, `portalBook.js` | `Travel-View.md`, `Travel-Options.md`, `Wagons.md`, `Wagon-Upkeep.md`, `Portal-Stone.md` |
| Survival, rest | `src/systems/survival/`, `src/systems/rest/` | `Climates-Calories.md`, `Rest-Arc.md` |
| Professions, bag | `src/systems/professions/`, `materialsBag.js`, `smithItems.js`, `cookItems.js` | `Professions-Arc.md`, `Materials-Bag.md` |
| Living world | `src/systems/livingWorld/`, `src/systems/town/`, `src/systems/region/`, `encounters.js`, `roadEncounters.js` | `Living-World.md`, `Town-Economy-Arc.md` |
| Families and legacy | `src/systems/legacy/` | `Legacy-Arc.md` |
| Revenants | `src/systems/revenant/`, `foeTitle.js`, `harmMark.js` | `Revenants.md` |
| Online laws | `src/systems/online/` (`onlineLane.js`), `src/systems/party/`, `src/systems/pass/`, `src/systems/wild/`, `src/systems/festival/` | `Online-Arc.md`, `Battle-Pass.md`, `Social-Party-Arc.md` |
| Events | `src/systems/gate/`, `src/systems/eliteGates/`, `src/systems/starfall/`, `src/systems/serpent/`, `src/systems/superDungeon/`, `src/systems/dragon/`, `src/systems/arena/` | the `11-Multiplayer/` pages |
| Sea | `src/systems/naval/`, `src/systems/sea/`, `src/systems/comeSailAway/`, `src/systems/deepWater/` | the `03-World/` sea pages |
| Homes | `src/systems/decor/`, `homeRent.js`, `vendorHouses.js` | `03-World/Holdings.md` |
| Ported mods | `handheldTorches.js`, `physicalItems.js`, `foraging/`, `roleplayRealism/`, `roleplayRealismItems/`, `enemyExpansion/`, `immersiveTravel.js`, `weaponSheathing.js`, `modSettings.js` | each mod's page; `01-Overview/Mod-Registry.md` |
| Weather and sky | `src/systems/weather/`, `src/systems/wind/`, `src/systems/dynamicSkies/`, `src/systems/snowfall/`, `windfall.js`, `heatHaze.js` | the `07-Rendering/` and `03-World/` pages |
| Audio | `audio.js`, `music.js`, `src/systems/soundscape/`, `src/systems/song/`, `footsteps.js` | `08-Audio/Audio.md` |
| Settings and input | `src/systems/settings/`, `features.js`, `uiPrefs.js`, `inputActions.js`, `gamepad.js`, `keyCodes.js` | `10-UI/Controls.md` |
| Talk and text | `src/systems/talk/`, `textManager.js`, `localeCatalog.js`, `src/systems/grammar/` | `Talk-Arc.md`, `Localization-Arc.md` |
| Messages | `notify.js` (every message box goes through one door), `worldHover.js`, `worldTooltips.js` | `10-UI/` |

## Rules

- A system is a module the hosts wire, never new behaviour grown inside a host (HOST-SPLIT,
  `01-Overview/Host-Split.md`).
- A law the account service or the relay also reads stays a leaf with no imports that pull in the UI, so the Worker's
  bundle stays small.
- TAMRIEL-WIDE: a system keys a pixel by the world's key and reads regions 0..70; a Bay-only answer is marked where it
  stands.
- Every module the port adds that DFU has not got is a declared departure (`01-Overview/Port-Doctrine.md`).

## Code and tests

- `src/systems/` - the systems, mapped above
- `test/systems/` - their tests, one folder per area where an area has many
