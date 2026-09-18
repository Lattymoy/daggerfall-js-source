// SURV2 - WHAT THE DEAD LEAVE TO EAT. An animal's corpse carries raw
// meat by its kind (a rat one, a bear up to ten and luck); a
// slaughterfish carries raw fish; a humanoid sometimes carried food.
// After Climates & Calories' EnemyDeath_OnEnemyDeath (GetMeatAmount,
// FoodLoot - the IL, Systems-Arc SURV), on the port's own death
// registry (scenes/corpseMarker.js raiseEnemyDeath, the UL1 seam).
import { registerEnemyDeathHandler } from '../../scenes/corpseMarker.js';
import { MOBILE_TYPES } from '../../characters/mobileTypes.js';
import { TEMPLATE } from './food.js';
import { createSurvivalItem, spoilFood } from './items.js';

export const SURVIVAL_LOOT_HANDLER = 'survival';
/** [min, max] raw meat by mobile type; the max grows by the luck mod. */
export const MEAT_BY_TYPE = Object.freeze({
  [MOBILE_TYPES.Rat]: [1, 1], [MOBILE_TYPES.GiantBat]: [1, 1], [MOBILE_TYPES.GrizzlyBear]: [6, 10],
  [MOBILE_TYPES.SabertoothTiger]: [4, 8], [MOBILE_TYPES.Spider]: [2, 2], [MOBILE_TYPES.GiantScorpion]: [2, 3],
});
export const FISH_BY_TYPE = Object.freeze({ [MOBILE_TYPES.Slaughterfish]: [2, 3] });
export const DEFAULT_ANIMAL_MEAT = Object.freeze([1, 2]);
/** A humanoid carried food on a 1..20 + luck mod - 5 above 17: rations
 *  most often, then meat, fish, bread, fruit, water. */
export const HUMANOID_FOOD_ABOVE = 17;
export const HUMANOID_SECOND_ABOVE = 19;

// AUDIT VC6 (2026-09-18): THE LUCK READER IS GONE, because it was never
// set. `setSurvivalPlayerReader` had no caller anywhere in the tree, so
// `_player()` answered null at every kill and the luck modifier read 50
// for every player in the game - the whole of Climates & Calories' luck
// term was dead, and a seam that looks wired is worse than one that is
// plainly absent. The three pools that raise a death hand their own
// player's luck in `opts` now (cityGuards, exteriorFoes, dungeonContext),
// which is where it was always available; 50 is the floor for a caller
// that has none, as it always was.
const luckMod = (luck) => Math.trunc((luck ?? 50) / 10);
const range = (min, max, rolls) => min + Math.floor(rolls() * (max - min + 1));

export const isAnimal = (entity) => entity?.basics?.affinity === 'Animal' || entity?.mobileType === MOBILE_TYPES.Slaughterfish;
export const isHumanoid = (entity) => (entity?.mobileType ?? 0) >= 128 || entity?.basics?.team === 'Orcs' || entity?.basics?.affinity === 'Human';

/** What one corpse carries: raw meat or fish for an animal, sometimes a
 *  meal for a humanoid. Pure: returns the items. */
export function corpseFood(entity, { luck = 50, rolls = Math.random } = {}) {
  const out = [];
  if (!entity) return out;
  const lm = luckMod(luck);
  if (isAnimal(entity)) {
    const id = entity.mobileType;
    const fish = FISH_BY_TYPE[id];
    const [min, max] = fish ?? MEAT_BY_TYPE[id] ?? DEFAULT_ANIMAL_MEAT;
    const n = range(min, max + Math.max(0, lm - 5), rolls);
    for (let i = 0; i < n; i++) {
      const item = createSurvivalItem(fish ? TEMPLATE.RawFish : TEMPLATE.RawMeat);
      if (item && rolls() < 0.5) spoilFood(item);   // half of it is already turning
      if (item) out.push(item);
    }
    return out;
  }
  if (isHumanoid(entity)) {
    const roll = range(1, 20, rolls) + lm - 5;
    if (roll > HUMANOID_FOOD_ABOVE) out.push(humanoidFood(rolls));
    if (roll > HUMANOID_SECOND_ABOVE) out.push(humanoidFood(rolls));
  }
  return out.filter(Boolean);
}

export function humanoidFood(rolls = Math.random) {
  const r = range(1, 10, rolls);
  if (r <= 4) return createSurvivalItem(TEMPLATE.Rations, { stackCount: range(1, 3, rolls) });
  if (r === 5) return createSurvivalItem(TEMPLATE.Meat);
  if (r === 6) return createSurvivalItem(TEMPLATE.CookedFish);
  if (r <= 8) return createSurvivalItem(TEMPLATE.Bread);
  if (r === 9) return createSurvivalItem(rolls() < 0.5 ? TEMPLATE.Apple : TEMPLATE.Orange);
  return createSurvivalItem(TEMPLATE.Waterskin, { water: 1.0 });
}

let _installed = false;
/** Once per boot: the death handler adds the corpse's food to the
 *  entity's items, which the corpse container is. */
export function installSurvivalLoot({ enabled = () => true } = {}) {
  if (_installed) return false;
  _installed = true;
  registerEnemyDeathHandler(SURVIVAL_LOOT_HANDLER, (entity, opts = {}) => {
    if (!enabled() || !entity || !Array.isArray(entity.items)) return;
    const luck = opts.luck ?? 50;   // AUDIT VC6: the raiser's own player, or the floor
    for (const item of corpseFood(entity, { luck, rolls: opts.rolls ?? Math.random })) entity.items.push(item);
  });
  return true;
}
export function uninstallSurvivalLoot() { registerEnemyDeathHandler(SURVIVAL_LOOT_HANDLER, null); _installed = false; }
