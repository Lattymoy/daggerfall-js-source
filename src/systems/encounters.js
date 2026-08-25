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
import { ENCOUNTER_TABLES } from '../characters/encounterTables.js';

// AUDIT 24 (wave 23): this module used to carry its OWN copy of the
// 45x20 table, character for character identical to the generated one
// in characters/encounterTables.js and maintained by hand beside it.
// Two copies of 900 cells is one typo away from two different games,
// and only one of them could ever be gated. There is one table now;
// this is the re-export the rest of the system already imports.
export { ENCOUNTER_TABLES };

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

// ---- GameManager.AreEnemiesNearby (:684-732), one home ---------------

/** The RESTING test's shorter distance (:687). The spawn-band one is
 *  the foe's own `wouldBeSpawned`, which the AI already answers. */
export const RESTING_DISTANCE = 12;

/**
 * AreEnemiesNearby, verbatim over a list of foes carrying the port's
 * AI shape ({ dead, ai: { detected, inSight, wouldBeSpawned, _dist } }).
 *
 * The C# walks every active enemy behaviour and asks two questions in
 * this order:
 *   enemyCanSeePlayer = Target is the player AND TargetInSight (:698)
 *   if RESTING and it cannot see you and it is further than 12, SKIP
 *     it entirely (:701-702) - this is the whole point of the resting
 *     variant, and using the strict one instead refuses rest for any
 *     unaware foe anywhere in the 1024-unit spawn band
 *   otherwise it counts if it can see you OR would have spawned in
 *     classic (:705)
 *
 * S40 gave this a home because three hosts needed it at once and the
 * two above ground had been answering a much coarser question - "is
 * ANY guard alive" - which for rest is not an approximation but a
 * different rule: a guard spawned across town blocks sleep forever,
 * since guards persist until the crime clears.
 *
 * FLAGGED, both from the tail of the C#: the pacified/team test
 * (`IsHostile && Team != PlayerAlly`, :710) pends the pacify effect,
 * and the FoeSpawner sweep (:721-728) pends quest spawners carrying a
 * live position.
 */
export function areEnemiesNearby(foes, { resting = false } = {}) {
  for (const f of foes ?? []) {
    if (!f || f.dead || !f.ai) continue;
    const canSee = !!(f.ai.detected && f.ai.inSight);
    if (resting && !canSee && (f.ai._dist ?? Infinity) > RESTING_DISTANCE) continue;
    if (canSee || f.ai.wouldBeSpawned) return true;
  }
  return false;
}
