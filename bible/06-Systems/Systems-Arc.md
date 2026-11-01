# Core systems

The role-playing systems ported from Daggerfall Unity: items and inventory, character creation and advancement, the
magic effect library and casting, diseases and poisons, saves, shops and trade, factions and guilds, the calendar and
holidays, fast travel, random encounters, curses, artifacts, region conditions and faction powers. Each is read off
DFU's C# and restated as the port's own module; departures are named. Around them stand the port's own additions to
the open world: wilderness camps and packs, spawned dungeons and elite foes. The map of `src/systems/` is
`06-Systems/Systems.md`.

## How it works

**Items and inventory.** Items are DFU's templates (`src/systems/item/itemTemplates.js`, `createItem.js`), with the
port's own rows registered above DFU's range. The pack (`src/systems/inventory.js`) is DFU's `ItemCollection`, with
exact weights and stacks; containers and treasure piles (`containers.js`, `containerLoot.js`) hold their own lists;
equip (`equip.js`) follows DFU's slots and the career's equip restrictions. Using an item goes through one door
(`useItem.js`). Dungeon treasure and enemy loot come from DFU's loot tables (`src/systems/loot/loot.js`), with the
rarity ladder on top (`06-Systems/Loot-Rarity.md`).

**Character.** Creation (`chargen.js`, `chargenSession.js` `finishChargen`) is the one construction seam every new
character passes, so derived health, magicka, fatigue, tallies and the level-up anchor are always minted fresh. Skills
advance by use (`skills.js`, `advancement.js` `skillUsesForAdvancement`) and level the character on DFU's skill sum,
or on the Oblivion-style bar when chosen (`06-Systems/Oblivion-Remaster-Leveling.md`). A character is an id, not a name
(`characterId.js`), so a new character never overwrites an old one's save.

**Magic.** The effect library (`effects.js`, `effectBroker.js`) restates DFU's effects family by family: damage and
heal, the attribute and Fortify layer (`statMods.js`), drains and transfers, the SpellPoints family, Mysticism
(`mysticism.js`: Silence, Dispel, Soul Trap and the rest), concealment (`concealment.js`), Free Action, Paralyze,
absorption (`absorption.js`) and Recall (`teleportAnchor.js`). Casting (`spellcast.js`, `playerCasts.js`) covers
touch, target, area and caster ranges in every host, above ground and below; costs are DFU's formula (`spellcost.js`)
with its saving throws. Enemies cast from DFU's spell lists (`enemySpells.js`). Magic items carry DFU's enchantment
catalogue (`enchantments.js`, `enchantmentCatalogue.js`), cast when used, held or struck, and wear by condition; the
item maker and spell maker are DFU's. Potions brew from DFU's recipes (`potions.js`, `potionRecipes.js`).

**Diseases and poisons** (`diseases.js`, `poisons.js`). DFU's diseases are caught from foes' hit riders and progress by
day; poisons ride weapons and foes; the Cure family and temples cure them.

**Saves** (`src/systems/save/save.js`). The player snapshot and the world snapshot (the scene cache's permanent set,
`sceneCache.js`) save and restore together; a load is the saved truth, never a merge. A quicksave works above ground.
A classic Daggerfall save can be imported (`classicSave.js`). Online characters are the realm's
(`06-Systems/Realm-Arc.md`).

**Shops and trade** (`shopStock.js`, `tradeModes.js`). DFU's shop templates and stock by building quality, browse and buy
from the shelf, sell at the counter with DFU's haggle (online the half-price ceiling, `06-Systems/Realm-Arc.md`). A
building greets the player with its kind and its people (`buildingGreeting.js`). Repairs, banking and loans are DFU's
(`repairService.js`, `banking.js`).

**Factions and guilds.** The faction store (`src/systems/faction/factionRep.js`) is DFU's `PersistentFactionData` over
FACTION.TXT, with the relation mutators and ally/enemy spread (`factionRelations.js`). Past the Bay, each province has
its own Province, ruler, Court and People factions (`provinceFactions.js`), added through DFU's custom-faction door,
and the faction powers walk them too. Guilds (`src/systems/guild/`) are DFU's: membership and rank, variant-keyed
guilds, services by rank (training, spells, item making, teleport, the guild store), knightly gifts
(`knightlyGifts.js`) and the crime guilds' invitations (`crimeGuilds.js`). Promotion reveals guild halls on the map.
Law and standing are `06-Systems/Standing-Arc.md`.

**Time.** The calendar (`gameDate.js`) is DFU's; holidays (`holidays.js`, `holidayTables.js`) bring their effects and
festival notices; the day change has one home in the world tick (`worldTick.js`).

**Travel and encounters.** Fast travel is DFU's travel map (`src/systems/travel/travel.js`): time, cost, inns, guild
discounts and skills raised on arrival. Online the instant land journey is refused (a ship's passage stays), and
carriages, the Portal Stone and the Overworld take its place (`06-Systems/Travel-Options.md`,
`06-Systems/Portal-Stone.md`, `06-Systems/Travel-View.md`). Random
encounters (`encounters.js`) are DFU's climate tables: a wandering foe in the wild or a dungeon, a resting encounter,
placed where DFU places one. Transport (`transport.js`) is DFU's horse, cart and ship.

**Curses.** Vampirism (`vampirism.js`) and lycanthropy (`lycanthropy.js`) are DFU's: the infection's three days
(`infection.js`), the racial override, passive specials (`passiveSpecials.js`), sunlight, the transformed form's laws,
the curse quests and their cures; a vampire may travel by day with a hood up.

**Artifacts and Daedra.** DFU's artifact payloads (`artifactEffects.js`) and Daedra summoning on their holy days, with
the summoning videos (`daedraSummoning.js`).

**Region conditions and faction powers** (`src/systems/region/regionConditions.js`, `regionPower.js`). DFU's per-region
records (famine, plague, crime waves, persecution, the war flags) for every region of Tamriel, and the faction powers'
moves between them.

**Wilderness camps and packs** (`campEncounters.js`, the port's own). When the single encounter roll comes back empty, a
second roll may stand a camp (`CAMP_SIZE` 3-5 close together) or a pack (`PACK_SIZE` 2-4 loose) from the same climate
table, `MIN_CAMP_SPAWN_DISTANCE` to `MAX_CAMP_SPAWN_DISTANCE` (100-150 m) away, never landed on. A member that notices
a target hands it to every campmate in reach.

**Spawned dungeons** (`src/world/spawnedDungeons.js`, the port's own). A pixel of wilderness may hold a spawned dungeon
(`SPAWN_CHANCE`) or an Elite one (`ELITE_CHANCE`, more foes, tougher, better loot), thinned by `SPAWN_KEEP`, never on a
road, the same on every machine by hash. A cleared one rests `CLEARED_TTL_DAYS`, any other `GENERAL_TTL_DAYS`, then may
stand again. The ground it levels is the roll's, so every player stands on the same ground. Past the Bay they stand on
the world's pixels too.

**Elite foes** (`eliteFoes.js`). One foe in twenty in the open world (`ELITE_FOE_OVERWORLD_CHANCE`), three or four in an
Elite Dungeon, and at most one, one time in five, in any other dungeon: five times the health (`ELITE_FOE_HEALTH_MULT`), three times the blows,
a quarter larger, glowing, with a gear drop of its own. Never under level 3, never the watch or an ally.

**The Test Room** (`testRoom.js`): a room for trying items, foes and effects; asked for online, it boots offline.

## Rules

- DFU is the reference: every ported system cites its C# member, and every departure is named (SCOPE1).
- The one construction seam: a character is made only through `finishChargen`.
- A load is the saved truth, not a merge.
- Fewer spawned dungeons: a quarter thinned (the owner).
- Wilderness camps and packs keep the world from feeling empty (Mac).
- TAMRIEL-WIDE: region conditions, faction powers and spawned dungeons cover the provinces past the Bay.

## Daggerfall Unity

Each system above restates its DFU counterpart (`ItemCollection`, `PlayerEntity`, `EntityEffectBroker`,
`FormulaHelper`, `PersistentFactionData`, `Guild`, `DaggerfallDateTime`, `RandomEncounters`, `RacialOverrideEffect`,
`DaggerfallTradeWindow`, `SaveLoadManager`). Port-wide departures: camps and packs, spawned dungeons and elite foes are
the port's own; online characters are held by the account service; online fast travel is by carriage, portal or the
Overworld.

## Code and tests

- `src/systems/` - the modules named above
- `test/systems/effects.test.js`, `test/systems/effectcoverage.test.js`, `test/systems/enemyspells.test.js`,
  `test/systems/concealment.test.js`, `test/systems/dispelmagic.test.js` - the effect library and casting
- `test/systems/enchantments.test.js`, `test/systems/enchanting.test.js`, `test/systems/artifacts.test.js` - magic items
  and artifacts
- `test/systems/chargen.test.js`, `test/systems/chargenseam.test.js`, `test/systems/advancement.test.js`,
  `test/systems/charid1.test.js` - character creation, advancement, ids
- `test/systems/diseases.test.js`, `test/systems/classicsave.test.js` - diseases, classic saves
- `test/systems/faction.test.js`, `test/systems/factionrep.test.js`, `test/systems/guild/guilds.test.js`,
  `test/systems/guild/guildservices.test.js` - factions and guilds
- `test/systems/encounters.test.js`, `test/systems/daedrasummoning.test.js`, `test/systems/disc10_vampire.test.js`,
  `test/systems/disc10_lycan.test.js` - encounters, Daedra, curses
- `test/systems/camp1_groups.test.js`, `test/systems/elite_spawn_audit.test.js`, `test/systems/testroom.test.js` -
  camps, elites, the Test Room
