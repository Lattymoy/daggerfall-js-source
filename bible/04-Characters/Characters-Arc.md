# People and Foes

The data layer behind every person and monster in the world: who stands in a building, a street or a dungeon, what
they are called, which team they fight for and how they find a target. The player meets it as shopkeepers, townsfolk,
the watch and the monsters of the wilds and the dungeons. How they look is other pages' work: Morrowind bodies
(`Morrowind-NPCs.md`), DFU's billboards, and the mod pages for monsters.

## How it works

- **Standing people.** A building's people come from its interior records (`collectInteriorPeople`,
  `src/characters/interiorPeople.js`), shown or hidden by the building's hours (`peopleAreVisible`,
  `updateNpcPresence`). In the street, a flat with a non-zero faction id is a StaticNPC (`collectExteriorNpcs`,
  `src/characters/exteriorNpcs.js`); any other person's flat is scenery. `staticNpcData` and `staticNpcName`
  (`src/characters/staticNpc.js`) give each one its DFU data, race (`raceFromFaction`) and name.
- **Names.** `src/characters/nameHelper.js` is DFU's `NameHelper` with its `NameGen.txt` banks (as
  `src/characters/nameGen.json`); each region of the Bay names its people from one bank (`getNameBankOfRegion`).
- **Dungeon foes.** `collectDungeonEnemies` (`src/characters/dungeonEnemies.js`) reads each block's foe markers; a
  random marker rolls from the dungeon's encounter table at the player's level (`chooseRandomEnemyType`).
- **Foe hosts.** The open world's foes and the watch are two pools the world host owns: `createExteriorFoes`
  (`src/scenes/exteriorFoes.js`) and `createCityGuards` (`src/scenes/cityGuards.js`). The dungeon host builds its own
  (`src/scenes/dungeonContext.js`). Interiors use the same factory as the exterior pool.
- **The enemy.** `src/characters/enemy/` holds DFU's enemy whole: the entity (`enemyEntity.js`), its motor and senses
  (`enemyMotor.js`), attacks (`enemyAttack.js`), casting (`enemyCasting.js`) and sounds.
- **Teams and targets.** `getTargets` and `runTargetMachine` (`src/characters/enemy/enemyTargets.js`) port DFU's
  target choice: a foe may target another foe, an ally or the player by team (`MOBILE_TEAMS`). Infighting follows
  DFU's own Enhancements setting (`enemyInfightingEnabled`). A foe keeps three team fields: the shared static row, its
  own copy, and its live team, which an ally summon or a struck ally changes.
- **Weapon timing.** `src/characters/weaponStates.js` owns a swing's time with DFU's frame rate,
  `3 * (115 - Speed) / 980` seconds a frame, bounded so a frame is never zero.

## Rules

- Hidden staff are no one to a foe (STAFF-UNSEEN). A staff member hidden from players is never seen, heard or detected
  by a foe, and pursuit gives up at once (`playerUnseen` in `enemyMotor.js`, set from `staffHidden` in
  `src/scenes/shared.js`). The travel view counts no foe near them as danger.
- The static team row (`ENEMY_BASICS[id].team`) is never written; only the per-foe copy and the live team change.
- A foe catches up at most three fixed steps of game time a frame (`FOE_MAX_FRAME_DT`), so a slow frame slows the
  foes a little instead of snowballing into seconds near 1 fps (Mac). The player's own motor is not capped.
- Without Morrowind's data attached, townsfolk and monsters are DFU's billboards; a Morrowind body is drawn over that
  baseline, never instead of the data layer.

## Tamriel

Past the Bay, people take their province's races (`PROVINCE_FOLK`, `src/characters/provinceFolk.js`) and names
(`src/characters/regionNames.js`, `Region-Names.md`). The data readers are the same everywhere.

## Daggerfall Unity

The port follows DFU's `StaticNPC`, `RMBLayout`, `RDBLayout`, `EnemyEntity`, `EnemyMotor`, `EnemySenses` and
`EnemyAttack`. Departures: hidden staff (above), which DFU has no state for; foe lanes and bodies (other pages).

## Code and tests

- `src/characters/staticNpc.js`, `exteriorNpcs.js`, `interiorPeople.js` - standing people
- `src/characters/nameHelper.js` - name banks
- `src/characters/dungeonEnemies.js` - dungeon foe markers and random rolls
- `src/characters/enemy/` - entity, motor, senses, attacks, casting, targets
- `src/scenes/exteriorFoes.js`, `src/scenes/cityGuards.js` - the world's foe and watch pools
- `test/characters/enemy/` - the enemy port: motor, targets, infighting, attacks, hidden staff
  (`staffunseen.test.js`)
