// ═══════════════════════════════════════════════════════════════════
// WOD3 - WORLD OF DAGGERFALL: THE SPAWN POINTS.
//
// LocationEnemySpawner.cs (vendor/world-of-daggerfall/Scripts/), the
// MonoBehaviour every spawn MARKER carries - the invisible bandit,
// bear, warrior and "good" flats, the kidnap marker and the treasure
// container (world/wodLocationObjects.js says which is which). It is a
// state machine over one number, the player's distance, so it is ported
// as one: `tick(dist, rolls)` is one Unity frame for the marker - Start
// on the first, Update on every one - and answers what to stand, never
// how. The streaming host stands it.
//
//   Start (:45-62)   - a marker the player is within 300 of when it
//                      comes into being deactivates for good: a camp
//                      that streams in around you never springs.
//   Update (:86-154) - within 100: the SpawnType's arm.
//   OnLoad (:69-84)  - the same 300 test after a load. The port tears
//                      the world down and builds it again on every load,
//                      so every marker meets the test in its own Start.
//
// THE ROLLS ARE UNITY'S, and their order is the C#'s. Random.Range on
// ints EXCLUDES its maximum, which is load-bearing three times over:
// Range(1, 3) never answers 3, so the thief arm's Barbarian can never
// stand; Range(1, 6) never answers 6, so the warrior arm's Healer can
// never stand; Range(1, 100) answers 1..99, so "SpawnTrue >= 50" is 50
// chances in 99, not a coin. Inside CreateFoeGameObjects the gender is
// rolled (Range(0f, 1f) < 0.55 male) BEFORE the caller's Rotate rolls
// the facing, so the port rolls them in that order too.
//
// A LEAF apart from the one Random.Range port (systems/unleveledLoot.js).
// ═══════════════════════════════════════════════════════════════════

import { rangeInt } from '../systems/unleveledLoot.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { WOD_SPAWN_TYPE, WOD_ENEMY_ID } from './wodLocationObjects.js';

/** Update's radius (LocationEnemySpawner.cs:91). */
export const WOD_SPAWN_RADIUS = 100;
/** Start's and OnLoad's (:53, :74). */
export const WOD_STAND_DOWN_RADIUS = 300;
/** CreateFoeGameObjects' gender roll (GameObjectHelper.cs): male under 0.55. */
export const FOE_MALE_CHANCE = 0.55;
/** That roll, one draw off the stream (WOD4's Hold makes its foes the same way). */
export const createFoeGender = (rolls) => (rolls() < FOE_MALE_CHANCE ? 'male' : 'female');

/** SpawnThieves / SpawnGoodThieves' three arms (:253-276), by EnemyType. */
const THIEF_ARMS = Object.freeze([MOBILE_TYPES.Thief, MOBILE_TYPES.Rogue, MOBILE_TYPES.Barbarian]);
/** SpawnWarriors' six (:348-395). */
const WARRIOR_ARMS = Object.freeze([
  MOBILE_TYPES.Warrior, MOBILE_TYPES.Sorcerer, MOBILE_TYPES.Ranger, MOBILE_TYPES.Mage, MOBILE_TYPES.Knight, MOBILE_TYPES.Healer,
]);

export class WodSpawner {
  /**
   * @param {{spawnType:number, enemyID:number, questID:number}} spec -
   *   the fields LocationHelper's Add*Spawn set (wodLocationObjects.js)
   */
  constructor({ spawnType, enemyID = 0, questID = 0 }) {
    this.spawnType = spawnType;
    this.enemyID = enemyID;
    this.questID = questID;
    this.spawnFinished = false;   // :25
    this.active = true;           // the GameObject's own activeSelf
    this.started = false;         // Unity runs Start once, before the first Update
  }

  /**
   * One frame for the marker, at `dist` from the player (Vector3.Distance
   * of PlayerMotor's transform and the marker's). Answers null, or one
   * action: `{ kind: 'foe', mobileType, hostile, allied, gender, yawDeg }`,
   * `{ kind: 'loot', record }` or `{ kind: 'billboard', archive, record }`.
   * @param {number} dist
   * @param {() => number} rolls - UnityEngine.Random's stream, [0, 1)
   */
  tick(dist, rolls = Math.random) {
    if (!this.active) return null;
    if (!this.started) {
      this.started = true;
      if (dist <= WOD_STAND_DOWN_RADIUS) { this.active = false; return null; }   // Start, :53-56
    }
    if (!(dist <= WOD_SPAWN_RADIUS)) return null;
    // :94-151 - the arms are separate `if`s, but every one that acts
    // deactivates the object, so at most one ever runs.
    switch (this.spawnType) {
      case WOD_SPAWN_TYPE.Quest: return this._quest(rolls);
      case WOD_SPAWN_TYPE.Enemy:
        if (this.enemyID === WOD_ENEMY_ID.Bandits) return this._thieves(rolls, true);
        if (this.enemyID === WOD_ENEMY_ID.Bears) return this._bears(rolls);
        if (this.enemyID === WOD_ENEMY_ID.Warriors) return this._warriors(rolls);
        return null;
      case WOD_SPAWN_TYPE.Good:
        // Only the bandit arm is live; the bear and warrior arms are
        // commented out (:133-140) and leave the marker ACTIVE, doing
        // nothing, for as long as the player stands near it.
        if (this.enemyID === WOD_ENEMY_ID.Bandits) return this._thieves(rolls, false);
        return null;
      case WOD_SPAWN_TYPE.Loot: return this._loot(rolls);
      default: return null;   // 1, "Billboard Person", is an empty arm
    }
  }

  /** CreateFoeGameObjects' own gender roll, then the caller's Rotate. */
  _foe(mobileType, hostile, rolls) {
    const gender = createFoeGender(rolls);
    const yawDeg = rangeInt(0, 180, rolls);   // transform.Rotate(0, Random.Range(0, 180), 0)
    return { kind: 'foe', mobileType, hostile, allied: !hostile, gender, yawDeg };
  }

  /** SpawnThieves (:244-280) and SpawnGoodThieves (:282-318): the good
   *  ones are MobileReactions.Passive and alliedToPlayer. */
  _thieves(rolls, hostile) {
    const enemyType = rangeInt(1, 3, rolls);
    const spawnTrue = rangeInt(1, 100, rolls);
    let out = null;
    if (!this.spawnFinished && spawnTrue >= 50) out = this._foe(THIEF_ARMS[enemyType - 1], hostile, rolls);
    this.spawnFinished = true;
    this.active = false;
    return out;
  }

  /** SpawnBears (:320-337): Range(1, 100) >= 40, a Grizzly. */
  _bears(rolls) {
    const spawnTrue = rangeInt(1, 100, rolls);
    let out = null;
    if (!this.spawnFinished && spawnTrue >= 40) out = this._foe(MOBILE_TYPES.GrizzlyBear, true, rolls);
    this.spawnFinished = true;
    this.active = false;
    return out;
  }

  /** SpawnWarriors (:339-399). */
  _warriors(rolls) {
    const enemyType = rangeInt(1, 6, rolls);
    const spawnTrue = rangeInt(1, 100, rolls);
    let out = null;
    if (!this.spawnFinished && spawnTrue >= 50) out = this._foe(WARRIOR_ARMS[enemyType - 1], true, rolls);
    this.spawnFinished = true;
    this.active = false;
    return out;
  }

  /** SpawnLoot (:190-211): half the time (1..50 of 1..99) a dropped-loot
   *  container at a random treasure record, 0..46. */
  _loot(rolls) {
    const spawnTrue = rangeInt(1, 100, rolls);
    const out = spawnTrue <= 50 ? { kind: 'loot', record: rangeInt(0, 47, rolls) } : null;
    this.active = false;
    return out;
  }

  /** SpawnQuest (:156-188), questID 0 "Captured Person": Range(1, 40)
   *  picks the flat stood in the marker's place - the captive (357.6) at
   *  1..10, a merchant (182.0) at 20..29, a prisoner (184.31) at 30..39,
   *  nobody at 11..19. */
  _quest(rolls) {
    const spawnTrue = rangeInt(1, 40, rolls);
    let out = null;
    if (this.questID === 0) {
      if (spawnTrue < 11) out = { kind: 'billboard', archive: 357, record: 6 };
      if (spawnTrue > 19 && spawnTrue < 30) out = { kind: 'billboard', archive: 182, record: 0 };
      if (spawnTrue > 29 && spawnTrue < 40) out = { kind: 'billboard', archive: 184, record: 31 };
    }
    this.active = false;
    return out;
  }
}

/** CreateLootContainer's roll for the pile (LocationEnemySpawner.cs:233):
 *  LootTables.GenerateLoot(loot, 3) - dungeon type 3's key, "N". */
export const WOD_LOOT_LOCATION_INDEX = 3;

/** SpawnLoot's AlignBillboardToGround(corpseloot, new Vector2(0, 1f), 2)
 *  (:201): the pile's CENTRE goes to hit + 0.52 whatever the sprite's
 *  own height (world/groundAlign.js). */
export const WOD_LOOT_ALIGN = Object.freeze({ sizeY: 1, distance: 2 });
