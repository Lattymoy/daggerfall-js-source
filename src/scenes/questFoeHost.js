// B1 (AUDIT 25 blocker 1): the HOST half of quest foe spawning.
//
// The quest machine has declared the spawn seams since Q3-iii -
// world.createFoeGameObjects(foe, count) and world.tryPlaceFoe(handle)
// (contract in systems/quest/machine.js) - and the placement law,
// PlaceFoeFreely, has sat fully ported in sceneMount.js with NO
// CALLER. This module is the wiring both foe pools share:
//
//   mintQuestFoeWave     - GameObjectHelper.CreateFoeGameObjects
//                          (GameObjectHelper.cs:1243-1305): mint
//                          `count` INACTIVE handles, one behaviour
//                          each, activation deferred to placement
//   bindQuestFoeHost     - the QuestResourceBehaviour host handle
//                          over a live pool foe (the `enemy` surface
//                          resourceBehaviour.js documents)
//   placeFoeEnv          - the placeFoeFreely env adapter over the
//                          port's collider ([x,y,z] arrays in, the
//                          law's {x,y,z} objects out)
//   questFoeGender       - the Foe resource's own 0.55-male humanoid
//                          gender (Foe.cs:290, rolled at construction
//                          and already ported in quest/foe.js), the
//                          same read sceneMount's marker stand uses
//
// DFU builds each enemy GameObject whole and inactive, then
// TryPlacement positions + activates one per machine tick. The port's
// foe build is async (textures), so a handle here is DATA until
// placement finds a spot; the pool's async build then stands the foe
// a beat later. A build that fails after placement (a missing
// CLASS*.CFG) logs loudly and the foe never appears - DFU's
// equivalent failure throws at mint. Recorded runtime difference.

import { QuestResourceBehaviour } from '../systems/quest/resourceBehaviour.js';
import { applySpell } from '../systems/effects.js';
import { GENDERS } from '../characters/nameHelper.js';

export function questFoeGender(foe) { return foe.gender === GENDERS.Female ? 'female' : 'male'; }

/** CreateFoeGameObjects' mint loop (:1248-1305), data-side: one
 *  handle + one QuestResourceBehaviour per instance (AddComponent +
 *  AssignResource, :1276-1280), count clamped 1..8 (:1248 - foe.js
 *  clamps spawnCount at parse too; kept for direct callers).
 *  behaviour.start() waits for placement: the C# objects are
 *  SetActive(false), so Unity defers Start until activation. The
 *  resource's own questResourceBehaviour field couples in
 *  behaviour.update() ("coupling is otherwise lost"), so a wave of
 *  several instances ends owned by the last updated - C#'s shape. */
export function mintQuestFoeWave(machine, foe, count) {
  const total = Math.min(Math.max(count, 1), 8);
  const handles = [];
  for (let i = 0; i < total; i++) {
    const behaviour = new QuestResourceBehaviour(machine);
    behaviour.assignResource(foe);
    handles.push({ foe, behaviour });
  }
  return handles;
}

/** The behaviour's host handle over a live pool foe `f` (the pool
 *  record shape both pools share: { entity, ai, dead, corpse }).
 *  pool supplies: removeFoe(f) - Destroy(gameObject) (the isHidden
 *  teardown); zeroFoeHealth(f) - the DeathTrigger zeroing routed
 *  through the pool's own death door so corpse/loot/alert all run;
 *  spellsByIndex() + foeSinks(f) + rolls - the CastSpellQueue drain.
 *  Called at PLACEMENT (the activation moment), so behaviour.start()
 *  runs here - Unity defers Start on an inactive object. */
export function bindQuestFoeHost(f, behaviour, pool) {
  const host = {
    // Person hide/show only in core - no Foe caller reaches setActive
    // (behaviour.update tears a hidden Foe DOWN via destroy instead)
    setActive: () => {},
    destroy: () => pool.removeFoe(f),
    enemy: {
      get currentHealth() { return f.entity.health; },
      get maxHealth() { return f.entity.maxHealth; },
      setCurrentHealth: (n) => { if (n <= 0) pool.zeroFoeHealth(f); else f.entity.health = n; },
      setNonHostile: () => { if (f.ai) f.ai.isHostile = false; },
      // wave 31/32: every port entity runs the broker's magic rounds,
      // so the manager always stands - the queue never parks here
      hasEffectManager: () => true,
      /** CastSpellQueue's per-entry drain (QuestResourceBehaviour.cs:
       *  293-351): resolve the classic record and AssignBundle with
       *  BypassSavingThrows; the bundle's caster is the foe ITSELF
       *  (enemyEntityBehaviour), so casterLevel is the foe's level. A
       *  record the seam cannot resolve - custom keys included, the
       *  port has no custom effect registry - is skipped, never
       *  retried, C#'s own `continue`. */
      assignSpellBundle: (ref) => {
        if (ref?.customKey) return;
        const record = pool.spellsByIndex?.()?.get?.(ref?.classicId);
        if (!record) return;
        applySpell(record, f.entity.level ?? 1, f.entity, pool.foeSinks(f), pool.rolls ?? Math.random, null, { bypassSavingThrows: true });
      },
      // The port's corpse loot IS the entity's items (both pools'
      // takeLoot reads them), so the corpse and live arms of
      // AddItemQueue land in the one place and this stays false.
      hasCorpseLootContainer: () => false,
      addItemsToEntity: (items) => { if (items) (f.entity.items ??= []).push(...items); },
    },
  };
  f.questBehaviour = behaviour;
  behaviour.bindHost(host);
  behaviour.start();
  return host;
}

/** placeFoeFreely's env over the port collider. isOccupied(point,
 *  radius) is the host's entity term: characters are not in the
 *  collider's triangle soup (its own comment says so), where Unity's
 *  OverlapSphere sees their capsules - the caller supplies foe and
 *  player proximity. */
export function placeFoeEnv({ collider, playerFeet, playerYawRad, fovDegrees, rolls = Math.random, isOccupied = null }) {
  const toObj = (p) => ({ x: p[0], y: p[1], z: p[2] });
  return {
    playerPosition: toObj(playerFeet),
    playerYawRadians: playerYawRad,
    fovDegrees,
    rolls,
    raycast: (origin, dir, maxDist) => {
      const o = [origin.x, origin.y, origin.z];
      const d = [dir.x, dir.y, dir.z];
      const h = collider.raycastHit(o, d, maxDist);
      if (!Number.isFinite(h.dist) || h.dist > maxDist) return null;
      return {
        point: { x: o[0] + d[0] * h.dist, y: o[1] + d[1] * h.dist, z: o[2] + d[2] * h.dist },
        normal: h.normal ? { x: h.normal[0], y: h.normal[1], z: h.normal[2] } : { x: -d[0], y: -d[1], z: -d[2] },
        distance: h.dist,
      };
    },
    overlapSphere: (p, r) => collider.sphereOverlaps([p.x, p.y, p.z], r) || (isOccupied?.(p, r) ?? false),
  };
}

/** The occupancy term over a foe list + the player: DFU's
 *  OverlapSphere(0.65) catches character capsules; the port tests
 *  centre distance against the test radius + the capsule radius the
 *  pools stand foes at (~0.45). feetOf(f) answers a foe's [x,y,z]. */
export function entityOccupancy(feetOf, liveFoes, playerFeet) {
  const CAPSULE_R = 0.45;
  return (p, r) => {
    const hit = (feet) => {
      if (!feet) return false;
      const dx = feet[0] - p.x, dy = feet[1] + 0.9 - p.y, dz = feet[2] - p.z;
      return dx * dx + dy * dy + dz * dz < (r + CAPSULE_R) * (r + CAPSULE_R);
    };
    if (hit(playerFeet)) return true;
    for (const f of liveFoes()) if (!f.dead && hit(feetOf(f))) return true;
    return false;
  };
}
