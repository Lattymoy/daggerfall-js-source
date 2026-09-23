// ═══════════════════════════════════════════════════════════════════
// WOD4 - WORLD OF DAGGERFALL: THE CAMP AT PRIVATEER'S HOLD.
//
// MainQuestLocationOverhaul.cs makes one GameObject carrying
// DungeonExterior (vendor/world-of-daggerfall/Scripts/), whose Update
// looks for "DaggerfallBlock [CUSTAA30.RMB]" EVERY FRAME
// (DungeonExterior.cs:180-191) and gives the first ACTIVE one it finds a
// PrivateersHold component, once. CUSTAA30 is Privateer's Hold's own
// 1x1 exterior block (ui/exteriorAutomapWindow.js has the MAPS.BSA
// sweep that lists it). The component's Start (PrivateersHold.cs:21-432)
// is the whole camp, built in the BLOCK's frame under an "Extra_Detail"
// child at its origin:
//
//   - 33 models (CreateDaggerfallMeshGameObject: the mesh and its
//     collider), each at a local position and `Rotate(0, deg, 0)`;
//   - 17 flats (CreateDaggerfallBillboardGameObject), CENTRED on their
//     local position - nothing calls AlignToBase;
//   - a "FireLight" under each of the five 210 flats: a Unity point
//     Light one unit above the flat's centre, range 20, intensity 1,
//     colour (0.95, 0.91, 0.63), burning at every hour;
//   - seven foes, each on its own Random.Range(0, 30) > 20 - 9 chances
//     in 30 - made by CreateFoeGameObjects (its gender roll first), then
//     re-parented to Extra_Detail at (x, 1, z) - which overwrites the
//     ground align CreateFoeGameObjects ran at the block's origin - and
//     turned by the caller's Rotate(0, Range(0, 180), 0).
//
// The loot containers are commented out (:394-430), and
// KamerCreateLootContainer (:434-486) has no caller.
//
// This module is that Start as data plus its rolls. The hosts stand it.
// ═══════════════════════════════════════════════════════════════════

import { rangeInt } from '../systems/unleveledLoot.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { createFoeGender } from './wodSpawner.js';
import { objectMatrix } from './wodLocationObjects.js';

/** The block DungeonExterior finds by name (:183). */
export const PRIVATEERS_HOLD_BLOCK = 'CUSTAA30.RMB';

const f = Math.fround;   // the C#'s float literals
const at = (x, y, z) => Object.freeze([f(x), f(y), f(z)]);
const model = (modelId, pos, yawDeg = 0) => Object.freeze({ modelId, pos, yawDeg: f(yawDeg) });   // Rotate takes floats
const flat = (archive, record, pos, fireLight = false) => Object.freeze({ archive, record, pos, fireLight });

/** Start's models, in its own order (:70-206). */
export const HOLD_MODELS = Object.freeze([
  // Ruins
  model(43508, at(95.87001, 0.8100098, 5.839978), 104.997),
  model(43509, at(45.55, 4.71, 5.41), -210),
  model(43506, at(66.7, 1.6, 21.5), -89.99001),
  model(43506, at(98.47, 1.61, 14.74), -89.978),
  model(43502, at(80.03, 2.75, 9.24), -89.96201),
  model(43506, at(55.12, 1.609995, 5.689998)),   // its Rotate is commented out (:92)
  model(43513, at(74.6, 1.1, 64.1)),
  model(43512, at(65.7, 1.1, 82.1)),
  model(43509, at(91.8, 4.699997, 84.99999)),
  model(43509, at(45.8, 4.7, 84.2), -95.994),
  model(43514, at(49.16428, 1.339999, 67.65283), -90.00001),
  model(43506, at(42.5, 1.6, 49.6), -89.978),
  model(43506, at(85.8, 1.599994, 51.77939)),
  model(43506, at(66.97934, 1.599994, 87), -179.99),
  // Pillars
  model(41731, at(66.1, 3.099442e-06, 34.2), -179.99),
  model(41732, at(75.95, 0, 47.85), -179.99),
  // Rocks
  model(41717, at(54.4, 0, 44.3), -179.99),
  model(41716, at(79.8, -0.1, 26.2), -179.99),
  model(41713, at(95.8, -0.1, 65.8), -179.99),
  // Daggerfall Flag
  model(42560, at(77.89, 3.41, 10.95), -89.99001),
  // Tents
  model(41606, at(49.26, 0.7300018, 23.581), 31.751),
  model(41606, at(81.16119, 0.7300018, 70.47822), -43.755),
  model(41606, at(82.32, 0.73, 35.23)),
  model(41606, at(82.56, 0.73, 45.26)),
  model(41607, at(84.37, 1.33, 58.86)),
  model(41607, at(50.84, 1.329993, 13.68979), -30.578),
  model(41610, at(89.94, 2.45, 41.31), 90.00001),
  // Boxes
  model(41834, at(45.12, 0.7999939, 4.83), 39.961),
  model(41834, at(90.05, 0.8, 37.8)),
  model(41834, at(92.65, 0.8, 62.82)),
  model(41832, at(89.9, 2.1, 37.84)),
  model(41832, at(92.26, 0.8, 37.14)),
  // Wagon
  model(41214, at(90.97985, 1.010001, 32.9853), -49.868),
]);

/** Start's flats (:216-300), each at its CENTRE. */
export const HOLD_FLATS = Object.freeze([
  // Horses
  flat(201, 0, at(52.6, 1.309998, 23.8)),
  flat(201, 0, at(87.98, 1.309998, 45.02)),
  flat(201, 1, at(90.46, 1.309998, 45.43)),
  flat(201, 1, at(86.12, 1.309998, 47.58)),
  // Misc
  flat(205, 0, at(80.4, 0.61, 33.67)),
  flat(205, 0, at(91.12, 0.6, 68.49)),
  flat(205, 0, at(91.95, 0.6, 67.45999)),
  flat(205, 0, at(92.07, 0.5999908, 68.26999)),
  flat(211, 20, at(95.33, 1.309998, 15.51)),
  flat(211, 20, at(95.38, 1.309998, 19.10001)),
  // armor
  flat(207, 14, at(82.25, 0.51, 43.41)),
  flat(207, 15, at(84.24, 0.25, 43.77)),
  // Light
  flat(210, 1, at(84.04, 0.76, 40.92), true),
  flat(210, 17, at(50.57, 2.044, 67.112), true),
  flat(210, 17, at(77.889, 2.88, 8.46), true),
  flat(210, 1, at(84.04, 0.76, 65.5), true),
  flat(210, 1, at(47.3, 0.76, 18.84), true),
]);

/** The "FireLight" each 210 flat carries (:249-256 and its four copies):
 *  a child at local (0, 1, 0) of the flat's centre. */
export const HOLD_FIRE_LIGHT = Object.freeze({ lift: 1, range: 20, intensity: 1, color: Object.freeze([f(0.95), f(0.91), f(0.63)]) });

/** Start's seven foes (:307-389), each at its local transform - the
 *  sprite's CENTRE, one unit over the block's floor. */
export const HOLD_FOES = Object.freeze([
  Object.freeze({ mobileType: MOBILE_TYPES.Thief, pos: at(83.2, 1, 38) }),
  Object.freeze({ mobileType: MOBILE_TYPES.Assassin, pos: at(81.2, 1, 43) }),
  Object.freeze({ mobileType: MOBILE_TYPES.Thief, pos: at(90.2, 1, 67) }),
  Object.freeze({ mobileType: MOBILE_TYPES.Thief, pos: at(45.2, 1, 18) }),
  Object.freeze({ mobileType: MOBILE_TYPES.Rogue, pos: at(49.2, 1, 21) }),
  Object.freeze({ mobileType: MOBILE_TYPES.Thief, pos: at(85.2, 1, 15) }),
  Object.freeze({ mobileType: MOBILE_TYPES.Rogue, pos: at(88.2, 1, 35) }),
]);

const UNIT_SCALE = Object.freeze({ x: 1, y: 1, z: 1 });

/**
 * A model's matrix in the BLOCK's frame: `localPosition = pos`, then
 * `Rotate(0, deg, 0)` from the identity (the block and Extra_Detail
 * carry no rotation), which is Quaternion.Euler(0, deg, 0).
 * @param {{pos:number[], yawDeg:number}} m
 * @returns {Float32Array}
 */
export function holdModelMatrix(m) {
  const half = (m.yawDeg * Math.PI) / 360;
  return objectMatrix(m.pos, { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, UNIT_SCALE);
}

/**
 * The FireLights in the block's frame, in Start's order.
 * @returns {Array<{pos:number[], range:number, color:number[]}>}
 */
export function holdFireLights() {
  const L = HOLD_FIRE_LIGHT;
  const color = [L.color[0] * L.intensity, L.color[1] * L.intensity, L.color[2] * L.intensity];
  return HOLD_FLATS.filter((h) => h.fireLight).map((h) => ({ pos: [h.pos[0], h.pos[1] + L.lift, h.pos[2]], range: L.range, color }));
}

/**
 * Start's seven rolls, in the C#'s order: the chance, and for a foe
 * that stands CreateFoeGameObjects' gender and then the caller's facing.
 * @param {() => number} [rolls] - UnityEngine.Random's stream, [0, 1)
 * @returns {Array<{mobileType:number, pos:number[], gender:string, yawDeg:number}>}
 */
export function rollHoldFoes(rolls = Math.random) {
  const out = [];
  for (const foe of HOLD_FOES) {
    const enemyChance = rangeInt(0, 30, rolls);
    if (!(enemyChance > 20)) continue;
    const gender = createFoeGender(rolls);
    const yawDeg = rangeInt(0, 180, rolls);
    out.push({ mobileType: foe.mobileType, pos: foe.pos, gender, yawDeg });
  }
  return out;
}
