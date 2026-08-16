// Dungeon enemies - data layer (Characters C3).
// 1:1 translation of DFU RDBLayout.AddFixedEnemies / AddRandomEnemies /
// AddRandomRDBEnemyClassic / ChooseRandomEnemyType / AddEnemy (MIT,
// Daggerfall Workshop), classic selection path. Verbatim:
//   - Fixed enemies: editor flats record 16; type = factionOrMobileId
//     & 0xff ("garbage data in the 8 MSBs"), typeValue 99 skipped.
//   - Random enemies: editor flats record 15. DFRandom.srand(the
//     dungeon's LocationId), then 256 non-water picks from
//     EncounterTables[dungeonType] and 256 water picks from table 19
//     via ChooseRandomEnemyType (playerLevel banding on
//     random_range_inclusive). Per flat: usingWater when the block
//     waterLevel < raw classic YPos (greater y = lower); slot = flags,
//     slot 0 rerolls on Range(1,7) - DFU seeds that Unity stream with
//     DateTime.Now.Ticks (a TODO upstream); we seed a xorshift with
//     the LocationId for determinism (Ledger A departure).
//   - Water-species veto: Slaughterfish/Dreugh/Lamia skipped when
//     waterLevel == 10000 or waterLevel - 20 > raw YPos.
//   - Reaction: Hostile unless the raw action byte == 99 (Passive).
//   - Gender: types > 43 read flags bits (Female 1, Male 2).
//   - Placement: (X, -Y, Z) * GlobalScale.
// playerLevel comes from the live player entity at the call site
// (wired audit 2026-08-16; the classic path ignores monsterPower).

import { srand, randomRangeInclusive } from '../formats/dfRandom.js';
import { ENCOUNTER_TABLES } from './encounterTables.js';
import { MOBILE_TYPES } from './mobileTypes.js';

const FIXED_RECORD = 16;
const RANDOM_RECORD = 15;
const UNDERWATER_TABLE = 19;
const PASSIVE_ACTION = 99;
const GENDER_FEMALE_FLAG = 1;
const GENDER_MALE_FLAG = 2;
const WATER_SPECIES = new Set([
  MOBILE_TYPES.Slaughterfish, MOBILE_TYPES.Dreugh, MOBILE_TYPES.Lamia,
]);

// Deterministic stand-in for DFU's UnityEngine.Random slot reroll
// (upstream seeds DateTime ticks - a TODO); xorshift32 over the
// LocationId. Range semantics mirror Unity: max EXCLUSIVE.
export function makeSlotRng(seed) {
  let s = (seed >>> 0) || 1;
  return (min, maxExclusive) => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return min + (s % (maxExclusive - min));
  };
}

/** Verbatim ChooseRandomEnemyType (classic level banding). */
export function chooseRandomEnemyType(table, playerLevel) {
  let minTableIndex = 0;
  let maxTableIndex = table.length;
  const random = randomRangeInclusive(1, 100);
  if (random > 95 && playerLevel <= 5) {
    maxTableIndex = playerLevel + 2;
  } else if (random > 80) {
    maxTableIndex = playerLevel + 1;
  } else {
    minTableIndex = playerLevel - 3;
    maxTableIndex = playerLevel + 3;
  }
  if (minTableIndex < 0) {
    minTableIndex = 0;
    maxTableIndex = 5;
  } else if (maxTableIndex > 19) {
    minTableIndex = 14;
    maxTableIndex = 19;
  }
  return table[randomRangeInclusive(minTableIndex, maxTableIndex)];
}

/**
 * Collect every enemy of one dungeon, classic path.
 * @param blockLayouts - [{markers, waterLevel, originX, originZ}] in
 *   dungeon block order (layoutDungeon output rows).
 * @param opts {{locationId:number, dungeonType:number,
 *   playerLevel?:number}}
 * @returns {Array<{x,y,z,mobileType,fixed:boolean,reaction:'hostile'|'passive',
 *   gender:'unspecified'|'female'|'male',spawnDistanceType:number}>}
 */
export function collectDungeonEnemies(blockLayouts, { locationId, dungeonType, playerLevel = 1 }) {
  // Verbatim table fill: one classic stream per dungeon.
  srand(locationId);
  const nonWater = new Array(256);
  const water = new Array(256);
  // Verbatim fill: DFU indexes EncounterTables[dungeonType] with no
  // guard here (out of range throws before any flat, same as C#); the
  // per-flat range check below mirrors AddRandomRDBEnemyClassic.
  for (let i = 0; i < 256; i++) nonWater[i] = chooseRandomEnemyType(ENCOUNTER_TABLES[dungeonType], playerLevel);
  for (let i = 0; i < 256; i++) water[i] = chooseRandomEnemyType(ENCOUNTER_TABLES[UNDERWATER_TABLE], playerLevel);
  const slotRng = makeSlotRng(locationId);

  const out = [];
  const emit = (marker, block, mobileType, fixed) => {
    // Verbatim water-species veto against the BLOCK water level.
    if (WATER_SPECIES.has(mobileType)
      && (block.waterLevel === 10000 || block.waterLevel - 20 > marker.rawY)) {
      return;
    }
    // AddEnemy's useGenderFlag is TRUE only for FIXED enemies (audit
    // 2026-08-16): on random markers the flags byte IS the slot, so
    // reading gender bits out of it was wrong data reuse.
    let gender = 'unspecified';
    if (fixed && mobileType > 43) {
      if ((marker.flags & GENDER_FEMALE_FLAG) === GENDER_FEMALE_FLAG) gender = 'female';
      if ((marker.flags & GENDER_MALE_FLAG) === GENDER_MALE_FLAG) gender = 'male';
    }
    out.push({
      x: marker.x + block.originX,
      y: marker.y,
      z: marker.z + block.originZ,
      mobileType,
      fixed,
      reaction: marker.actionByte === PASSIVE_ACTION ? 'passive' : 'hostile',
      gender,
      spawnDistanceType: marker.soundIndex,
    });
  };

  for (const block of blockLayouts) {
    for (const marker of block.markers) {
      if (marker.record === FIXED_RECORD) {
        const typeValue = marker.factionOrMobileId & 0xff;
        if (typeValue === 99) continue;
        emit(marker, block, typeValue, true);
      } else if (marker.record === RANDOM_RECORD) {
        if (dungeonType >= ENCOUNTER_TABLES.length) continue; // verbatim per-flat guard
        const usingWater = block.waterLevel < marker.rawY;
        let slot = marker.flags;
        if (slot === 0) slot = slotRng(1, 7);
        emit(marker, block, (usingWater ? water : nonWater)[slot], false);
      }
    }
  }
  return out;
}

