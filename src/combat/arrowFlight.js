// C13: arrow flight for the hosts WITHOUT the dungeon missile system
// (worldModes interiors, the exterior walk hosts). The dungeon's
// arrows are full S5 missiles (foe seeking, BowDamage recovery);
// DFU's law for an arrow that meets geometry is simply LOST - so this
// module owns the flight: the 99800 arrow model oriented along its
// direction, MISSILE_SPEED with the swept geometry raycast (the
// sweep covers the whole step - raw dt cannot tunnel), the
// MISSILE_LIFESPAN retire. Constants single-source from the S5
// missile system (spellcast.js); the matrix law mirrors
// dungeonContext's arrowMatrix verbatim.
//
// AUDIT 39 (#64) retires the premise this module was written on -
// "out here there are no live targets yet". The X-slice/AR1 pools
// (exteriorFoes, cityGuards, the interior quest-foe pool) ARE those
// targets, and both impact arms used to be gated on `m.enemy`, so a
// player's shaft could hit nothing anywhere but a dungeon while
// WeaponManager.cs:398-417 spawns an ArrowMissile for every bow hit
// frame and DaggerfallMissile.cs:391 assigns its damage wherever the
// player is standing. The player arm and its damage law live here
// now, one copy for the three hosts that share this flight.

import { MISSILE_SPEED, MISSILE_COLLIDER_RADIUS, MISSILE_LIFESPAN_S, playerArrowOrigin, missileHitsCapsule, missileReach } from '../systems/spellcast.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';   // ROAD-H tail: the standing capsule, the contact's default height   // ROAD-H H1c: GetAimPosition's player arrow arm
import { trs } from '../world/mat4.js';
import { SWING_MODS } from './playerWeapon.js';   // CalculateSwingModifiers, read live at the arrow's impact
import { calculateAttackDamage } from './formulas.js';
import { backstabChanceOf, enemyPainVoice } from '../scenes/hostCombat.js';
import { isBackFacing } from '../characters/enemyMotor.js';
import { hitSoundFor, ENEMY_HIT_VOLUME } from '../systems/soundClips.js';
import { addItem } from '../systems/inventory.js';

export const ARROW_MODEL_ID = 99800;

/** The oriented arrow transform (dungeonContext.arrowMatrix law). */
export function arrowMatrix(pos, dir) {
  const yaw = Math.atan2(dir[0], dir[2]) * 180 / Math.PI;
  const pitch = Math.asin(-Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
  return trs(pos[0], pos[1], pos[2], pitch, yaw, 0);
}

export class ArrowFlight {
  /**
   * @param getGpuMesh (modelId) => gpu mesh (async ok - the host's
   *                   pipeline function)
   * @param collider   Collider, or () => Collider for hosts whose
   *                   collider rebuilds (the weaponRig canvas rule)
   */
  constructor({ getGpuMesh, collider = null }) {
    this.getGpuMesh = getGpuMesh;
    this._collider = collider;
    this.arrows = [];
  }

  /** X2-slice: `meta` rides the arrow record - an ENEMY arrow
   *  carries { enemy: true, shooterFoe, weapon } and hunts the
   *  player through update's impact arm. AUDIT 39 (#64): a PLAYER
   *  arrow carries { fromPlayer: true, weapon } - the bow is DFU's
   *  LastBowUsed, which the impact prices off - and hunts the foes
   *  through the same contact law. */
  fire(from, dir, meta = {}) {
    this.arrows.push({ pos: meta.fromPlayer ? playerArrowOrigin(from, dir) : [...from], dir: [...dir], age: 0, gpu: null, dead: false, ...meta });   // ROAD-H H1c: a PLAYER shaft leaves the BOW HAND - GetAimPosition (DaggerfallMissile.cs:540-550) offsets the camera position 0.11 DOWN the camera's own up and 0.15 to the hand (the other way under FPSWeapon.FlipHorizontal), and it runs INSIDE the missile in DFU (:471), so it runs here rather than at each host's loose; an ENEMY shaft arrives with its own origin already applied (enemyTargets.enemyArrowOrigin)
  }

  update(dt, { playerFeet = null, playerHeight = CAPSULE_HEIGHT, onPlayerHit = null, foeTargets = null, onFoeHit = null,
    onPlayerArrowHitFoe = null } = {}) {
    let live = 0;
    const c = typeof this._collider === 'function' ? this._collider() : this._collider;
    for (const m of this.arrows) {
      if (m.dead) continue;
      live++;
      if (m.gpu === null) {   // lazy model fetch, in-flight guard
        m.gpu = false;
        Promise.resolve(this.getGpuMesh(ARROW_MODEL_ID)).then((g) => { if (g && !m.dead) m.gpu = g; });
      }
      m.age += dt;
      if (m.age > MISSILE_LIFESPAN_S) { m.dead = true; continue; }
      const step = MISSILE_SPEED * dt;
      const { unit, reach } = missileReach(m.dir, step);   // ROAD-H tail: displacement.magnitude + ColliderRadius along the NORMALISED direction (DaggerfallMissile.cs:333 builds the displacement, :337 casts it - an ARROW always takes that Raycast arm, never the :339 SphereCast) - a crouch-dipped shaft carries |dir| > 1
      const hit = c ? c.raycast(m.pos, unit, reach) : Infinity;
      if (Number.isFinite(hit) && hit <= reach) { m.dead = true; continue; }   // met geometry: the arrow is LOST (DFU)
      m.pos[0] += m.dir[0] * step;
      m.pos[1] += m.dir[1] * step;
      m.pos[2] += m.dir[2] * step;
      // X2-slice: an enemy arrow tests the player mid-capsule per
      // step - the dungeon missile's exact contact law
      // (MISSILE_COLLIDER_RADIUS + the 0.45 body).
      if (m.enemy && playerFeet && onPlayerHit) {
        // ROAD-H tail: the SphereCast at :339 meets the player's
        // CharacterController CAPSULE at its LIVE height, not a point
        // 0.9 up - a crouched player (0.9) is a shorter target.
        if (missileHitsCapsule(m.pos, playerFeet, playerHeight)) {
          // ROAD-H tail (review): the CONTACT stops the shaft on any
          // body (DoCollision, DaggerfallMissile.cs:388-396: an arrow is
          // destroyed on whatever it meets); the DAMAGE is gated on the
          // struck body being the archer's Target
          // (AssignBowDamageToTarget, :669). A shaft loosed at another
          // foe that the player steps into is spent on the player and
          // deals nothing - no BowDamage, no Dodging tally, no
          // recovered Arrow. `aimFoe` is that Target, snapshotted at
          // the loose as the dungeon flight's is (null = the player).
          if (!m.aimFoe) onPlayerHit(m);
          m.dead = true;
          continue;
        }
      }
      // AR1: the impact learns the FOES - MT-ii's infighting arrows
      // flew true at a selected foe and landed nothing, because this
      // module knew only the player capsule. Same contact law, every
      // live foe but the SHOOTER (an archer must not feather itself
      // on the release frame).
      // AUDIT 39 (#64): the arm is the SHOOTER's, not a flag on one
      // side of it - an enemy shaft runs BowDamage's non-player arm,
      // a player shaft runs WeaponManager.WeaponDamage.
      const foeImpact = m.enemy ? onFoeHit : (m.fromPlayer ? onPlayerArrowHitFoe : null);
      if (foeImpact && foeTargets) {
        for (const t of foeTargets) {
          if (!t?.feet || t.ref === m.shooterFoe || t.ref?.dead) continue;
          if (missileHitsCapsule(m.pos, t.feet, t.ref?.ai?.height)) {   // ROAD-H tail: the target's own CAPSULE (REVIEW 2026-09-05 had its centre as a point)
            // ROAD-H tail (review): an ENEMY shaft damages only the foe
            // it was loosed at (:669); any other foe it meets stops it
            // and takes nothing. A PLAYER shaft (WeaponDamage through
            // playerArrowHitFoe) has no such gate - it strikes what it hits.
            if (!m.enemy || t.ref === m.aimFoe) foeImpact(m, t.ref);
            m.dead = true;
            break;
          }
        }
        if (m.dead) continue;
      }
      // The mesh raycast never sees bare TERRAIN (the collider's
      // heightAt fallback floor) - an arrow at or under it has landed.
      if (c && m.pos[1] <= c.heightAt(m.pos[0], m.pos[2])) m.dead = true;
    }
    if (!live && this.arrows.length) this.arrows.length = 0;
  }

  /** Draw every live arrow (the host's mesh pass, after update). */
  draw(renderer, texRemap = undefined) {
    for (const m of this.arrows) {
      if (!m.dead && m.gpu) renderer.drawMesh(m.gpu, arrowMatrix(m.pos, m.dir), texRemap);
    }
  }
}

/**
 * AUDIT 39 (#64): a PLAYER arrow that meets a foe, verbatim to the
 * dungeon host's own arm (dungeonContext's `m.fromPlayer` block) so
 * the hosts that call it price one shot one way.
 *
 * WAVE D: four bodies became FOUR CALLERS. dungeonContext.js's
 * `m.fromPlayer` block - the arm this function was extracted FROM -
 * now calls it (dungeonContext.js:2396), so the copy that survived
 * the extraction is gone. It was not a harmless copy: it still
 * splashed at the arrow tip, the exact bug AUDIT 39r/R16 fixed here.
 * DaggerfallMissile.cs:681-687 routes an arrow into
 * WeaponManager.WeaponDamage with `arrowHit` true, which is the SAME
 * CalculateAttackDamage a melee swing runs - `attacker == player`, so
 * the swing modifiers, the backstab chance and the enemy-type modifier
 * all apply, and the hit sound and the splash ring BEFORE the
 * knockback and the pain voice. The arrow is recoverable from the
 * target whatever the damage was (BowDamage).
 *
 * AUDIT 39r (R16): the splash is at the TARGET, not the arrow tip.
 * The header used to claim the missile's own position was DFU's
 * impactPosition, "the one place these hosts hold the real hit point"
 * - it is not. AssignBowDamageToTarget passes `hitTransform.position`
 * (DaggerfallMissile.cs:679-687), the struck entity's own transform
 * origin; only the MELEE callers pass a contact point
 * (WeaponManager.cs:1054 ClosestPoint, :1068 hit.point), and
 * WeaponManager.cs:568-571 hands whichever it got to ShowBloodSplash.
 *
 * AUDIT 62 F20: and that transform origin is NOT the foe's feet. The
 * DaggerfallEnemy prefab's CharacterController is centred on the
 * transform (m_Center 0) and SetupDemoEnemy.cs:98-115 only ever moves
 * controller.center (AdjustControllerHeight, BOTTOM justification),
 * never the transform - so `hitTransform.position` is the idle sprite's
 * CENTRE, feet + idleH/2, which is the motor's `centreOffset`
 * (enemyAnchor.js:41-50). The header used to claim the feet were the
 * transform origin and bled every struck foe half a sprite low. It is
 * still not bloodCentre, which is the melee-miss centre+height/8 point
 * EnemyAttack.cs:326-328 builds when there is no contact point at all.
 * The hit sound and the AUDIT 58 pain voice keep the FEET (feet + 0.9
 * for the voice), the convention the three sibling pools share.
 *
 * `dealDamage` is the pool's own damage door, so death runs whole -
 * corpse, loot, crime - and this function never writes health itself.
 */
export function playerArrowHitFoe(m, foe, {
  playerEntity, playerWeapon = null, playerFeet = null, dealDamage = null,
  audio = null, hitEffects = null, say = null, onInflictPoison = null,
  // AUDIT 58: HandleAttackFromSource (WeaponManager.cs:630) is NOT in
  // the damage fork - it runs for every shaft that CONNECTED, so a
  // zero-damage arrow enrages what it hit and, through
  // DaggerfallEntityBehaviour.cs:255-258, its whole area. It cannot
  // ride `dealDamage` with a 0: that door carries the pools' knockback,
  // and WeaponManager's knockback (:575-582) is inside the `damage > 0`
  // arm - weaponKnockbackSpeed(0, w) would return the 15/ratio FLOOR
  // and shove a foe DFU leaves standing.
  onAttackFromPlayer = null,
  rolls = Math.random,
} = {}) {
  if (!foe || foe.dead || !playerEntity) return 0;
  const swing = SWING_MODS[playerWeapon?.machine?.state] ?? { damage: 0, toHit: 0 };
  const back = foe.ai && playerFeet ? isBackFacing(foe.ai.yaw, foe.ai.feet, playerFeet) : false;
  const dmg = calculateAttackDamage(playerEntity, foe.entity, {
    weapon: m.weapon ?? null,
    damageMod: swing.damage, toHitMod: swing.toHit,
    backstabChance: backstabChanceOf(playerEntity, back),
    rolls, onInflictPoison, say,
  });
  const at = foe.ai?.feet ?? [m.pos[0], m.pos[1], m.pos[2]];
  // AUDIT 62 F20: the splash point is the struck foe's TRANSFORM
  // (DaggerfallMissile.cs:680-687 -> WeaponManager.cs:571), i.e. its
  // feet lifted by its own centreOffset. `at` stays the feet for the
  // hit sound and the pain voice below.
  const bloodAt = foe.ai?.feet
    ? [at[0], at[1] + (foe.ai.centreOffset ?? (foe.ai.height ?? 1.8) / 2), at[2]]
    : at;
  if (dmg > 0) {
    audio?.play3d?.(hitSoundFor(m.weapon ?? null), at, ENEMY_HIT_VOLUME, { maxDistance: 16 });
    hitEffects?.showBloodSplash?.(foe.entity?.basics?.bloodIndex ?? 0, bloodAt);
    const pain = enemyPainVoice(foe, dmg, rolls);
    if (pain && pain.clip >= 0) audio?.play3d?.(pain.clip, [at[0], at[1] + 0.9, at[2]], 1, { maxDistance: 16, pitch: 1 + pain.pitchLift });   // AUDIT 58: EnemySounds.cs:172-175
    dealDamage?.(foe, dmg);
  }
  // :627/:630's unconditional pair, whatever the fork above did - and
  // BEFORE the arrow is added back (BowDamage's own order).
  onAttackFromPlayer?.(foe);
  if (foe.entity?.items) {
    addItem(foe.entity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });
  }
  return dmg;
}
