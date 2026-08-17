// G1: city guards - the crime response (DFU PlayerEntity.
// SpawnCityGuards / SpawnCityGuard, MIT Daggerfall Workshop), shared
// by both exterior motor hosts. Guards are Knight_CityWatch class
// foes (mobileType 146, texture 399, CLASS18.CFG career) built with
// the C17 recipe and driven by the C11 stack (EnemyAI + EnemyAttack
// + MobileUnit) against the host's collider.
//
// The verbatim spawn law:
//  - never in dungeons; at most 5 active guards (maxActiveGuardSpawns);
//  - IMMEDIATE (a witnessed crime): convert nearby pool NPCs within
//    77.5 units - wandering GUARDS first (classic disables the source
//    NPC), then non-guards BEHIND the player (angle >= 105.469 from
//    the player's forward) at 1/4 each; if none converted, the foe
//    spawner fallback: Random.Range(2,6) guards at 12.8..51.2 units;
//  - NON-IMMEDIATE: an NPC within 77.5 facing the player (<= 95 deg)
//    with line of sight SEES the crime; a seeing guard NPC converts
//    on the spot; seen by civilians only -> guards arrive after a
//    Random.Range(5,11)-second countdown (re-fired as immediate).
//  - hostility: classic does nothing special - our guards acquire
//    through the ordinary senses (they spawn close with LOS); the
//    HALT bark (barkSound 456) fires on the detection rising edge.
//
// FLAGGED loud: arrest/court pends (guards fight to the death for
// now); guard archers forced melee (exterior foe arrows pend);
// enemy-vs-enemy stays out (C15 residual); corpse loot pickup pends
// the exterior activation-loot seam; assault-triggered crimes pend
// (pickpocket is the only trigger this slice).

import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { MobileUnit } from '../characters/mobileUnit.js';
import { EnemyAI, withinYaw } from '../characters/enemyMotor.js';
import { EnemyAttack } from '../characters/enemyAttack.js';
import { makeEnemyEntity } from '../characters/enemyEntity.js';
import { ClassFile } from '../formats/classFile.js';
import { assignEnemyEquipment, equipmentVariantFor } from '../combat/enemyEquipment.js';
import { generateItems } from '../systems/loot.js';
import { rollEnemyWeaponPoison } from '../systems/poisons.js';
import {
  calculateAttackDamage, meleeHitConnects, MELEE_HIT_YAW_DEG, chooseEnemyWeapon,
  KB_UNIT, enemyWeightClassicUnits, weaponKnockbackSpeed,
} from '../combat/formulas.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';

export const GUARD_MOBILE_TYPE = 146;          // MobileTypes.Knight_CityWatch
export const MAX_ACTIVE_GUARD_SPAWNS = 5;
export const GUARD_NPC_SPAWN_RANGE = 77.5;
export const GUARD_BEHIND_ANGLE = 105.469;     // convert non-guards this far behind the player
export const GUARD_SEEN_ANGLE = 95;            // an NPC facing the player within this sees a crime
export const GUARD_FALLBACK_MIN_DIST = 12.8;   // CreateFoeSpawner ring
export const GUARD_FALLBACK_MAX_DIST = 51.2;

export function createCityGuards({ renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, onPlayerHurt, rand = Math.random }) {
  const guards = [];       // { mobile, ai, attack, entity, batch, tex, archive, dead, _halted }
  const corpseBatches = [];
  let _career = null;      // CLASS18.CFG, fetched once
  let countdown = 0;       // guardsArriveCountdown (seconds)

  async function ensureCareer() {
    if (_career) return _career;
    const cf = new ClassFile();
    cf.load(await fetchBytes('CLASS18.CFG'));
    _career = cf.career;
    return _career;
  }

  const activeCount = () => guards.filter((g) => !g.dead).length;

  /** SpawnCityGuard: the C17 class-foe recipe at a position/facing. */
  async function spawnGuardAt(pos, yaw) {
    const basics = ENEMY_BASICS[GUARD_MOBILE_TYPE];
    const career = await ensureCareer();
    const entity = makeEnemyEntity(GUARD_MOBILE_TYPE, basics, career, playerEntity.level);
    entity.items = generateItems(basics.lootTableKey ?? '-', { level: playerEntity.level, gender: 'male' });
    const variant = equipmentVariantFor(entity.careerIndex, entity.isClass);
    if (variant !== null) {
      const eq = assignEnemyEquipment(entity, variant, playerEntity.level);
      entity.armorValues = eq.armorValues;
      entity.weapon = eq.rightHand;
      if (entity.weapon) {
        const pt = rollEnemyWeaponPoison(GUARD_MOBILE_TYPE, playerEntity.level);
        if (pt != null) entity.weapon.poisonType = pt;
      }
    }
    const ai = new EnemyAI(collider, [pos[0], pos[1] + 0.1, pos[2]], yaw, {
      liveSpeed: entity.liveSpeed,
      seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
    });
    // MakeEnemyHostileToAttacker + GiveUpTimer *= 3, verbatim: a
    // crime-responding guard pursues without having seen the player.
    ai.makeHostileToPlayer(600);
    const attack = new EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: playerEntity.level, reflexes: playerEntity.reflexes });
    attack.rangedAttack = false;   // FLAGGED: guard archers pend exterior foe arrows
    const archive = basics.maleTexture;
    const tex = await getTexture(archive);
    const mobile = new MobileUnit(GUARD_MOBILE_TYPE, basics, (rec) => tex.getFrameCount(rec), Math.random, 'male');
    const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
    guards.push({ mobile, ai, attack, entity, batch, tex, archive, dead: false, _halted: false, _prevMState: 'Idle', _mout: null });
  }

  /** The verbatim SpawnCityGuards law. pool = live persons as
   *  [{ pos, fwdYaw, guard, disable() }] in the SAME frame as
   *  playerFeet/playerFwd (the host converts). */
  async function spawnCityGuards(immediate, { playerFeet, playerFwd, pool = [] }) {
    if (activeCount() > MAX_ACTIVE_GUARD_SPAWNS) return;
    if (immediate) {
      let spawned = 0;
      for (const p of pool) {
        const d = [p.pos[0] - playerFeet[0], p.pos[1] - playerFeet[1], p.pos[2] - playerFeet[2]];
        if (Math.hypot(...d) > GUARD_NPC_SPAWN_RANGE) continue;
        if (p.guard) {
          await spawnGuardAt(p.pos, p.fwdYaw);
          p.disable();   // classic disables the NPC the guard spawns from
          spawned++;
        } else if (angleDeg(d, playerFwd) >= GUARD_BEHIND_ANGLE && Math.floor(rand() * 4) === 0) {
          await spawnGuardAt(p.pos, p.fwdYaw);
          spawned++;
        }
      }
      if (spawned === 0) {
        // CreateFoeSpawner(true, CityWatch, Random.Range(2,6), 12.8, 51.2):
        // a ring of guards converging from out of sight.
        const count = 2 + Math.floor(rand() * 4);
        for (let i = 0; i < count; i++) {
          const a = rand() * Math.PI * 2;
          const dist = GUARD_FALLBACK_MIN_DIST + rand() * (GUARD_FALLBACK_MAX_DIST - GUARD_FALLBACK_MIN_DIST);
          const x = playerFeet[0] + Math.sin(a) * dist, z = playerFeet[2] + Math.cos(a) * dist;
          const y = collider.heightAt ? collider.heightAt(x, z) : playerFeet[1];
          await spawnGuardAt([x, Number.isFinite(y) ? y : playerFeet[1], z], a + Math.PI);
        }
      }
      return;
    }
    // Non-immediate: witnesses. A seeing guard converts; civilians
    // start the countdown.
    let seen = false, seenByGuard = false;
    for (const p of pool) {
      const toPlayer = [playerFeet[0] - p.pos[0], playerFeet[1] - p.pos[1], playerFeet[2] - p.pos[2]];
      const dist = Math.hypot(...toPlayer);
      if (dist > GUARD_NPC_SPAWN_RANGE) continue;
      const fwd = [Math.sin(p.fwdYaw), 0, Math.cos(p.fwdYaw)];
      if (angleDeg(toPlayer, fwd) > GUARD_SEEN_ANGLE) continue;
      // line of sight from the NPC's eye to the player's chest
      const eye = [p.pos[0], p.pos[1] + 0.7, p.pos[2]];
      const dir = [toPlayer[0] / (dist || 1), (toPlayer[1] + 0.6) / (dist || 1), toPlayer[2] / (dist || 1)];
      const hit = collider.raycast(eye, dir, dist);
      if (Number.isFinite(hit) && hit < dist - 1e-3) continue;
      seen = true;
      if (p.guard) {
        seenByGuard = true;
        await spawnGuardAt(p.pos, p.fwdYaw);
        p.disable();
      }
    }
    if (!seenByGuard && seen) countdown = 5 + rand() * 5;   // Random.Range(5, 11) seconds
  }

  function angleDeg(v, fwd) {
    const l = Math.hypot(v[0], v[2]) || 1e-9;
    const f = Math.hypot(fwd[0], fwd[2]) || 1e-9;
    const cos = (v[0] * fwd[0] + v[2] * fwd[2]) / (l * f);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  }

  function damageGuard(g, damage, playerFeet, knockDir) {
    g.entity.health -= damage;
    if (g.entity.health <= 0) {
      g.dead = true;
      const ct = ENEMY_BASICS[GUARD_MOBILE_TYPE].corpseTexture;
      const size = scaledBillboardSize(g.tex.getSize(0), g.tex.getScale(0));
      // corpse archive differs from the live one; upload its record
      getTexture(ct.archive).then((t) => {
        uploadRecordFrame(ct.archive, ct.record, 0);
        const sz = scaledBillboardSize(t.getSize(ct.record), t.getScale(ct.record));
        const batch = renderer.createBillboardBatch(ct.archive, `${ct.record}#0`, sz ?? size, [[g.ai.feet[0], g.ai.feet[1], g.ai.feet[2]]]);
        corpseBatches.push(batch);
      }).catch(() => {});
      return;
    }
    // C15 knockback: class enemies re-knock under the hurt threshold
    if (knockDir && g.ai.knockbackSpeed <= 5 / KB_UNIT) {
      const w = enemyWeightClassicUnits(true, 'male', 0);
      g.ai.knockbackSpeed = weaponKnockbackSpeed(damage, w);
      g.ai.knockbackDir = [knockDir[0], knockDir[1], knockDir[2]];
    }
  }

  /** Per-frame drive; returns the live mobile batches (the host draws
   *  them on the flats' axis with the corpses). */
  function update(dt, playerFeet, eye, senses = {}) {
    // EnemyEntity verbatim: the city watch DESPAWNS when the active
    // crime returns to None (court release, death, region exit).
    if (!playerEntity.crimeCommitted) {
      for (const g of guards) if (!g.dead) g.dead = true;   // no corpse - they walk away
    }
    if (countdown > 0) {
      countdown -= dt;
      if (countdown <= 0) spawnCityGuards(true, { playerFeet, playerFwd: [0, 0, 1], pool: [] });   // arrivals ride the ring fallback
    }
    const out = [];
    for (const g of guards) {
      if (g.dead) continue;
      g.ai.update(dt, playerFeet, senses, false);
      // HALT! on the detection rising edge (barkSound, EnemySounds)
      if (g.ai.detected && !g._halted) {
        g._halted = true;
        audio?.play3d?.(ENEMY_BASICS[GUARD_MOBILE_TYPE].barkSound, g.ai.feet, 1.0, { maxDistance: 16 });
      }
      const events = g.attack.update(dt, g.ai, playerFeet);
      void events;
      const mstate = g.attack.machine.state;
      const strikeEdge = mstate !== 'Idle' && (g._prevMState ?? 'Idle') === 'Idle';
      g._prevMState = mstate;
      g._mout = g.mobile.update(dt, {
        moving: g.ai.moving,
        striking: strikeEdge,
        hurting: g.ai.hurtKnock,
        casting: false,
        rangedStriking: false,
      }, g.ai.yaw, g.ai.feet, eye);
      // C16: the -1 damage marker resolves the melee vs the player
      if (g.mobile.hitFrame) {
        const hdx = playerFeet[0] - g.ai.feet[0], hdz = playerFeet[2] - g.ai.feet[2];
        if (meleeHitConnects(g.ai._dist, g.ai.inSight, withinYaw(g.ai.yaw, hdx, hdz, MELEE_HIT_YAW_DEG))) {
          const wpn = chooseEnemyWeapon(g.entity.weapon, ENEMY_BASICS[GUARD_MOBILE_TYPE]);
          const dmg = calculateAttackDamage(g.entity, playerEntity, { targetGroup: null, weapon: wpn });
          if (dmg > 0) onPlayerHurt?.(dmg, wpn);   // G2: the host's arrest interception rides this
        }
      }
      const o = g._mout;
      const rkey = `${o.record}#${o.frame}`;
      if (!renderer.textures.has(`${g.archive}_${rkey}`)) uploadRecordFrame(g.archive, o.record, o.frame);
      const sz = scaledBillboardSize(g.tex.getSize(o.record), g.tex.getScale(o.record));
      g.batch.record = rkey;
      g.batch.size = { w: o.flip ? -sz.w : sz.w, h: sz.h };
      g.batch.origin = g.ai.feet;
      out.push(g.batch);
    }
    return [...out, ...corpseBatches];
  }

  /** The player's swing resolves against live guards (the dungeon's
   *  resolvePlayerHit shape over playerWeapon.resolveHit). */
  function resolvePlayerHit(playerWeapon, eye, lookDir, playerFeet, inViewFn, onHitSound) {
    const live = guards.filter((g) => !g.dead);
    if (!live.length) return false;
    const canSee = (g) => {
      const c = [g.ai.feet[0], g.ai.feet[1] + 0.9, g.ai.feet[2]];
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      const l = dist || 1;
      const hit = collider.raycast(eye, [dx / l, dy / l, dz / l], dist);
      return { dist, inView: inViewFn ? inViewFn(c) : true, losClear: !Number.isFinite(hit) || hit >= dist - 1e-3 };
    };
    let any = false;
    for (const { foe, damage } of playerWeapon.resolveHit(live, playerEntity, canSee, rand, () => 0)) {
      any = true;
      if (damage > 0) {
        onHitSound?.(foe);
        damageGuard(foe, damage, playerFeet, lookDir);
      }
    }
    return any;
  }

  return { guards, spawnCityGuards, update, resolvePlayerHit, activeCount, _debug: () => guards.map((g) => ({ dead: g.dead, hp: g.entity.health, pos: g.ai.feet.map((v) => +v.toFixed(1)), detected: g.ai.detected, state: g.attack.machine.state, moving: g.ai.moving, dist: +(g.ai._dist ?? -1).toFixed(1), giveUp: g.ai.giveUpTimer })) };
}
