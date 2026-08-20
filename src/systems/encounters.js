// RANDOM ENCOUNTERS (E-slice; AUDIT 23 entity-14's spawner half).
// RandomEncounters.cs + PlayerEntity.IntermittentEnemySpawn +
// FormulaHelper.RollRandomSpawn_* verbatim (MIT, Daggerfall
// Workshop). The tables are BAKED from the C# source - 45 lists of
// 20 mobile ids: 0-18 by dungeon type, 19 underwater, 20-37 by
// climate x location-rect x day/night, 38 unused, 39-44 by building
// type. Class enemies ride their 128+ ids.
//
// The spawner half that consumes chooseRandomEnemy above ground
// needs the exterior mobile-foe mount (the ledger row); the dungeon
// REST arm is live through the alert state.

import { CLIMATES } from '../formats/mapsFile.js';

export const ENCOUNTER_TABLES = Object.freeze([
  [0, 15, 3, 0, 15, 3, 19, 15, 6, 17, 18, 17, 17, 18, 18, 23, 23, 28, 30, 32],
  [0, 3, 7, 12, 4, 7, 15, 7, 12, 5, 16, 21, 6, 21, 24, 20, 27, 20, 21, 24],
  [144, 136, 0, 4, 141, 133, 3, 129, 8, 145, 144, 136, 143, 24, 141, 23, 129, 21, 144, 28],
  [3, 0, 134, 15, 135, 6, 133, 6, 143, 138, 37, 138, 139, 17, 133, 36, 23, 18, 17, 135],
  [3, 1, 132, 140, 131, 15, 13, 140, 19, 140, 21, 22, 23, 27, 29, 140, 25, 26, 34, 31],
  [0, 3, 4, 6, 15, 6, 133, 7, 12, 16, 138, 16, 144, 38, 36, 26, 138, 28, 133, 30],
  [0, 3, 4, 5, 4, 6, 7, 9, 143, 13, 14, 16, 20, 21, 18, 144, 140, 143, 34, 32],
  [1, 3, 128, 131, 13, 133, 10, 37, 35, 36, 10, 27, 131, 129, 29, 26, 130, 128, 25, 31],
  [0, 0, 3, 6, 9, 133, 15, 15, 18, 19, 23, 18, 28, 23, 28, 28, 30, 28, 30, 30],
  [1, 128, 131, 130, 17, 128, 131, 37, 130, 38, 35, 36, 22, 27, 131, 32, 128, 131, 32, 33],
  [0, 144, 3, 13, 3, 13, 15, 6, 135, 13, 20, 21, 133, 13, 136, 28, 29, 13, 29, 31],
  [0, 3, 144, 7, 15, 6, 12, 9, 145, 14, 17, 16, 145, 18, 23, 144, 145, 32, 33, 30],
  [0, 3, 3, 6, 15, 2, 142, 6, 20, 136, 13, 6, 138, 18, 19, 6, 23, 6, 139, 32],
  [0, 4, 5, 7, 16, 12, 20, 16, 14, 16, 24, 20, 21, 16, 27, 26, 34, 16, 24, 25],
  [0, 3, 8, 135, 20, 9, 145, 13, 6, 22, 131, 10, 133, 128, 145, 28, 130, 138, 33, 31],
  [144, 143, 0, 3, 144, 8, 136, 141, 9, 143, 141, 14, 6, 144, 28, 136, 143, 30, 131, 33],
  [3, 1, 5, 5, 143, 35, 13, 14, 16, 18, 20, 36, 35, 128, 36, 23, 27, 26, 31, 33],
  [0, 3, 6, 15, 20, 138, 20, 17, 1, 18, 20, 22, 23, 132, 20, 133, 29, 20, 27, 31],
  [0, 0, 3, 0, 138, 3, 15, 3, 7, 141, 7, 1, 7, 1, 17, 19, 134, 136, 0, 0],
  [11, 11, 15, 11, 11, 41, 41, 11, 17, 41, 11, 38, 11, 41, 42, 41, 42, 17, 23, 18],
  [0, 3, 138, 139, 9, 136, 14, 144, 138, 137, 136, 135, 130, 128, 144, 138, 7, 28, 20, 139],
  [0, 5, 5, 8, 10, 34, 13, 16, 136, 20, 21, 139, 138, 144, 24, 129, 134, 136, 139, 145],
  [3, 3, 5, 6, 7, 133, 139, 9, 13, 14, 19, 20, 35, 24, 36, 144, 133, 28, 145, 34],
  [0, 3, 136, 7, 139, 129, 9, 145, 14, 144, 128, 131, 135, 138, 140, 141, 144, 143, 136, 139],
  [4, 2, 136, 7, 10, 13, 12, 16, 145, 21, 140, 141, 143, 24, 36, 136, 142, 28, 145, 139],
  [3, 4, 2, 8, 139, 142, 9, 34, 12, 16, 18, 21, 131, 22, 130, 23, 129, 28, 142, 145],
  [0, 138, 0, 3, 133, 3, 13, 14, 134, 143, 136, 138, 144, 141, 139, 130, 133, 28, 144, 145],
  [0, 4, 5, 6, 138, 13, 136, 16, 142, 20, 144, 145, 138, 143, 142, 141, 137, 134, 128, 129],
  [3, 3, 5, 6, 129, 136, 9, 13, 14, 16, 18, 20, 9, 5, 23, 139, 27, 133, 144, 130],
  [0, 135, 138, 140, 131, 134, 136, 144, 133, 138, 137, 142, 141, 28, 143, 144, 128, 129, 139, 145],
  [0, 1, 4, 5, 8, 10, 34, 16, 138, 20, 144, 131, 133, 136, 145, 130, 140, 138, 143, 133],
  [3, 4, 5, 6, 17, 9, 14, 13, 18, 20, 144, 133, 4, 143, 139, 130, 134, 133, 32, 139],
  [0, 3, 135, 134, 136, 141, 9, 137, 14, 144, 130, 135, 140, 136, 133, 139, 138, 28, 145, 130],
  [0, 4, 2, 7, 8, 34, 12, 14, 16, 141, 21, 134, 143, 24, 130, 139, 142, 136, 145, 129],
  [3, 4, 6, 17, 133, 145, 9, 34, 14, 16, 142, 22, 129, 140, 134, 136, 142, 133, 145, 131],
  [3, 133, 135, 17, 136, 140, 14, 143, 18, 131, 144, 139, 23, 145, 130, 138, 136, 28, 143, 30],
  [1, 4, 2, 6, 8, 10, 34, 13, 16, 131, 21, 22, 145, 24, 36, 130, 139, 141, 142, 145],
  [3, 4, 6, 17, 15, 9, 34, 14, 16, 37, 18, 35, 6, 23, 25, 36, 27, 28, 30, 32],
  [0, 0, 138, 0, 0, 3, 3, 17, 18, 0, 139, 3, 136, 0, 3, 0, 3, 0, 0, 28],
  [138, 144, 135, 144, 135, 134, 144, 137, 135, 136, 138, 144, 135, 133, 136, 144, 135, 138, 144, 136],
  [128, 1, 130, 132, 133, 129, 128, 131, 130, 132, 35, 129, 128, 131, 130, 133, 129, 128, 29, 130],
  [140, 140, 145, 140, 140, 140, 140, 145, 140, 140, 140, 140, 140, 145, 140, 140, 140, 140, 140, 145],
  [144, 141, 134, 129, 145, 144, 145, 144, 141, 134, 129, 145, 144, 145, 144, 141, 129, 145, 144, 145],
  [134, 144, 136, 138, 144, 129, 135, 136, 140, 128, 133, 137, 144, 134, 132, 131, 138, 28, 136, 144],
  [0, 0, 135, 138, 134, 140, 134, 132, 136, 140, 135, 138, 134, 136, 142, 135, 138, 134, 140, 136],
].map(Object.freeze));

// The climate-band table indexes (ChooseRandomEnemy:1370-1467):
// [inRect-night, wild-day, wild-night] per climate family.
const CLIMATE_TABLE = new Map([
  [CLIMATES.Desert, [20, 21, 22]], [CLIMATES.Desert2, [20, 21, 22]],
  [CLIMATES.Mountain, [23, 24, 25]],
  [CLIMATES.Rainforest, [26, 27, 28]],
  [CLIMATES.Subtropical, [29, 30, 31]],
  [CLIMATES.Swamp, [32, 33, 34]], [CLIMATES.MountainWoods, [32, 33, 34]], [CLIMATES.Woodlands, [32, 33, 34]],
  [CLIMATES.HauntedWoodlands, [35, 36, 37]],
]);
// The building-type table indexes (:1348-1364). BuildingTypes:
// GuildHall 10, Temple 11, House1 17, House2 18, House3 19, Palace 15.
const BUILDING_TABLE = new Map([[10, 40], [11, 41], [15, 42], [17, 42], [18, 43], [19, 44]]);

// PlayerEntity.IntermittentEnemySpawn:549-552 - minimum spawn
// distances from the player by place.
export const MIN_DUNGEON_SPAWN_DISTANCE = 8;
export const MIN_LOCATION_SPAWN_DISTANCE = 10;
export const MIN_WILDERNESS_SPAWN_DISTANCE = 10;

/** The 144-minute cadence (:559): a spawn WINDOW opens on the game
 *  minutes where (minutes/12) % 12 == 0 - twelve minutes in every
 *  144, exactly classic's integer arithmetic. */
export const timeForSpawn = (gameMinutes) => (Math.trunc(gameMinutes / 12) % 12) === 0;

// FormulaHelper.RollRandomSpawn_* (:1765-1813): 0 spawns, >0 does
// not. The dungeon roll runs ONLY under an active enemy alert.
export const rollLocationNight = (roll01 = Math.random()) => Math.floor(roll01 * 24);
export const rollWildernessDay = (roll01 = Math.random()) => Math.floor(roll01 * 36);
export const rollWildernessNight = (roll01 = Math.random()) => Math.floor(roll01 * 24);
export const rollDungeon = (enemyAlertActive, roll01 = Math.random()) =>
  enemyAlertActive ? Math.floor(roll01 * 36) : 1;

/** RandomEncounters.ChooseRandomEnemy (:1334-1516), verbatim. ctx:
 *  { underwater, dungeonType, buildingType, climateIndex, inLocationRect,
 *    isDay, playerLevel }. rolls() feeds Dice100 + the final pick.
 *  Returns a mobile id, or -1 (MobileTypes.None) when the place has
 *  no encounters (a location rect by day, an unknown climate). */
export function chooseRandomEnemy(ctx, rolls = Math.random) {
  let idx;
  if (ctx.underwater) idx = 19;
  else if (ctx.dungeonType != null) idx = ctx.dungeonType;
  else if (ctx.buildingType != null) idx = BUILDING_TABLE.get(ctx.buildingType) ?? 39;
  else {
    const band = CLIMATE_TABLE.get(ctx.climateIndex);
    if (!band) return -1;
    if (ctx.inLocationRect) {
      if (ctx.isDay) return -1;   // a town by day spawns nothing
      idx = band[0];
    } else idx = ctx.isDay ? band[1] : band[2];
  }

  // the level band (:1471-1507) - "assume enemy lists of length 20"
  const roll = Math.floor(rolls() * 100) + 1;   // Dice100.Roll 1..100
  const level = ctx.playerLevel ?? 1;
  let min, max;
  if (roll > 80) {
    if (roll > 95) {
      if (level <= 5) { min = 0; max = level + 2; }
      else { min = 0; max = 19; }
    } else { min = 0; max = level + 1; }
  } else { min = level - 3; max = level + 3; }
  if (min < 0) { min = 0; max = 5; }
  if (max > 19) { min = 14; max = 19; }

  const table = ENCOUNTER_TABLES[idx];
  if (!table) return -1;
  // DFU's short-list guard (not classic) survives for table edits
  if (max + 1 > table.length) {
    max = table.length - 1;
    min = max >= 5 ? max - 5 : Math.floor(rolls() * max);
  }
  return table[min + Math.floor(rolls() * (max + 1 - min))];   // Range(min, max+1)
}

/** IntermittentEnemySpawn (:547-618) as a pure decision: null, or
 *  { mobileType, minDistance }. ctx adds { inside, inDungeon,
 *  isResting, enemyAlertActive, gameMinutes } to chooseRandomEnemy's.
 *  The caller runs it per elapsed game minute (the catch-up loop)
 *  and stops on the first spawn, exactly as PlayerEntity.Update. */
export function intermittentEnemySpawn(ctx, rolls = Math.random) {
  if (!timeForSpawn(ctx.gameMinutes)) return null;
  const timeOfDay = ctx.gameMinutes % 1440;
  if (!ctx.inside) {
    if (ctx.inLocationRect) {
      if ((timeOfDay < 360 || timeOfDay > 1080) && rollLocationNight(rolls()) === 0) {
        const mobileType = chooseRandomEnemy({ ...ctx, isDay: false }, rolls);
        if (mobileType !== -1) return { mobileType, minDistance: MIN_LOCATION_SPAWN_DISTANCE };
      }
      return null;
    }
    const day = timeOfDay >= 360 && timeOfDay <= 1080;
    if (day ? rollWildernessDay(rolls()) !== 0 : rollWildernessNight(rolls()) !== 0) return null;
    const mobileType = chooseRandomEnemy({ ...ctx, isDay: day }, rolls);
    return mobileType === -1 ? null : { mobileType, minDistance: MIN_WILDERNESS_SPAWN_DISTANCE };
  }
  if (ctx.inDungeon && ctx.isResting) {
    if (rollDungeon(ctx.enemyAlertActive, rolls()) === 0) {
      const mobileType = chooseRandomEnemy(ctx, rolls);
      if (mobileType !== -1) return { mobileType, minDistance: MIN_DUNGEON_SPAWN_DISTANCE };
    }
  }
  return null;
}

// ---- THE ENEMY ALERT (PlayerEntity.SetEnemyAlert :297-302 + the
// 8-hour decay :380-384). Raised by a foe SEEING the player and by
// opening rest with enemies nearby; lowered by killing the foe that
// targets the player, or by the decay. Lives on the entity so every
// consumer (the dungeon rest roll, fast travel one day) reads one
// flag. ----
export const ALERT_DECAY_MINUTES = 8 * 60;
export function setEnemyAlert(entity, alert, gameMinutes = 0) {
  entity.enemyAlertActive = !!alert;
  if (alert) entity.lastEnemyAlertTime = gameMinutes;
}
export function decayEnemyAlert(entity, gameMinutes) {
  if (entity.enemyAlertActive && (gameMinutes - (entity.lastEnemyAlertTime ?? 0)) > ALERT_DECAY_MINUTES) {
    setEnemyAlert(entity, false);
  }
}
