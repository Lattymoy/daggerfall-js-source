// DEX3 (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 7) - DAGGERFALL ENEMY EXPANSION'S ENCOUNTER TABLES AS
// IT PICKS THEM (BestiaryMod.cs:1728-1871), on the port's encounter table door (characters/encounterTableDoor.js):
//   - A DUNGEON'S (SelectDungeonTable, :1728-1753): on PlayerEnterExit.OnPreTransition into it (:1768-1782 - a door and
//     a load alike, PlayerEnterExit.cs:914 and :975), one of its type's tables and one of the water's, each by
//     `DFRandom.srand(Unknown2 ^ (region << 8))` and one `rand() % count` - the same pick on every visit and every machine.
//     The transition always comes before the layout, and the port's layout reads the two tables first
//     (dungeonEnemies.js collectDungeonEnemies), so the pick is made at that read. DFU leaves the generator where the
//     pick left it; the port's read stands inside the population, so the pick puts it back.
//   - A CLIMATE'S (SelectClimateTables and PlayerGPS_OnEnterLocationRect, :1784-1871): on a climate change or leaving a
//     location's rect, the climate's day and night tables; on entering one, its city-night table - each
//     UnityEngine.Random.Range over the index's tables (`random`), on PlayerGPS's events (world/playerGps.js).
// What a pick writes stands until the next (`ref ... EncounterTables[index]`): the player's later rolls read it. A table
// whose ids would not parse stays in its index's list, as ParseEncounterTables leaves it, and a pick that lands on it
// writes nothing: the C#'s `enemyIds.Select` throws before the write. (Thrown in a PlayerGPS handler it takes the rest
// of that frame's PlayerGPS.Update with it, and the next frame raises the same event again - the port does not copy a
// broken table's frame-long stall.) Nor is such a table a choice for a roll every machine agrees on.
// PreTransition's `Enum.IsDefined(DungeonTypes, ...)` guard has no arm here: every dungeon in MAPS.BSA has a defined
// type (4,232 of them, 0-18 - test/systems/enemyExpansion/dex3_encounters.test.js).

import { srand, rand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { CLIMATE_TABLE } from '../encounters.js';

/**
 * The mod's selector over `read` (`{ byIndex: index -> [{ enemyIds }] }`, dexTables.js readEncounterTables with the
 * defaults added): `{ table(index, place), choices(index) }` for registerEncounterTableSelector, and `gps` - its handlers
 * for onPlayerGpsEvents. `random` is UnityEngine.Random.value's seam.
 */
export function createDexEncounterSelector(read, { random = Math.random } = {}) {
  const written = new Map();   // index -> enemy ids, as the C#'s `table.Enemies = ...` left it
  const tablesAt = (index) => read.byIndex.get(index) ?? [];
  const write = (index, table) => { if (table.enemyIds) written.set(index, table.enemyIds); };
  /** SelectTable (:1755-1766): Random.Range(0, Count) over the index's tables. */
  const selectTable = (index) => {
    const tables = tablesAt(index);
    if (tables.length) write(index, tables[Math.floor(random() * tables.length)]);
  };
  /** SelectDungeonTable's pick (:1738-1748), the generator restored after it. */
  const selectDungeonTable = (index, { unknown2, region }) => {
    const tables = tablesAt(index);
    if (!tables.length) return;
    const was = getSeed();
    srand((unknown2 & 0xffff) ^ ((region & 0xff) << 8));   // (ushort)Unknown2 ^ ((byte)region << 8)
    const pick = rand() % tables.length;
    setSeed(was);
    write(index, tables[pick]);
  };
  /** SelectClimateTables (:1784-1824): the climate's day and night. */
  const selectClimateTables = (climateIndex) => {
    const band = CLIMATE_TABLE.get(climateIndex);
    if (band) { selectTable(band[1]); selectTable(band[2]); }
  };
  return {
    table(index, place) {
      // the transition's pick, at the population's read of the dungeon's type and the water's (a pure function of the
      // dungeon, so a second read for it picks the same)
      if (place?.dungeon) selectDungeonTable(index, place.dungeon);
      return written.get(index) ?? null;
    },
    /** Every table the mod may pick for `index` - what a roll every machine must agree on reads one of. */
    choices(index) {
      const ids = tablesAt(index).map((t) => t.enemyIds).filter(Boolean);
      return ids.length ? ids : null;
    },
    gps: {
      climateIndexChanged: selectClimateTables,   // PlayerGPS_OnClimateIndexChanged (:1826-1829)
      exitLocationRect: selectClimateTables,      // PlayerGPS_OnExitLocationRect (:1831-1834), at CurrentClimateIndex
      /** PlayerGPS_OnEnterLocationRect (:1836-1871): the climate's city night. */
      enterLocationRect: (climateIndex) => { const band = CLIMATE_TABLE.get(climateIndex); if (band) selectTable(band[0]); },
    },
  };
}
