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
// FLAGGED loud: enemy-vs-enemy stays out (C15 residual). (The
// "guard archers forced melee" flag retired in AUDIT 18: DFU's
// Knight_CityWatch has HasRangedAttack1 = false, so the watch never
// had a bow to force away.) G3: corpse loot is
// LIVE - killed guards (corpse flag, never walk-aways) are pickup
// targets through the hosts' E ray on the dungeon's S2 shape.
// G4: murder/assault are LIVE - killing the watch is Murder
// (HandleAttackFromSource), striking a wandering civilian is
// one-hit Murder + the response, striking a wandering guard NPC is
// Assault + an on-the-spot conversion (WeaponManager verbatim).

import { liveStat } from '../systems/statMods.js';   // AUDIT 23 (characters-11)
import { entityIsParalyzed } from '../systems/effects.js';   // AUDIT 24 (wave 32): the watch is paralysable too
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { MobileUnit } from '../characters/mobileUnit.js';
import { EnemyAI, withinYaw, isBackFacing } from '../characters/enemyMotor.js';
import { EnemyAttack } from '../characters/enemyAttack.js';
import { makeEnemyEntity } from '../characters/enemyEntity.js';
import { ClassFile } from '../formats/classFile.js';
import { generateItems } from '../systems/loot.js';
import { inflictPoison } from '../systems/poisons.js';
import {
  calculateAttackDamage, meleeHitConnects, MELEE_HIT_YAW_DEG, chooseEnemyWeapon,
  KB_UNIT, enemyWeightClassicUnits, weaponKnockbackSpeed,
} from '../combat/formulas.js';
import {
  equipEnemy, backstabChanceOf, tallySwingSkills,
  zeroDamageHitSound, SWING_WEAPON_FATIGUE_LOSS,
  CORPSE_ACTIVATION_DISTANCE,
  enemyMissSound, enemyAttackVoice, enemyPainVoice, playerAttackGrunt,   // C2-slice (combat-9/17)
} from './hostCombat.js';   // AUDIT 18: the laws every host must share
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { tallySkill, SKILLS } from '../systems/skills.js';
import { addItem } from '../systems/inventory.js';
import { WEAPON_REACH } from '../combat/playerWeapon.js';
import { rayPersonDistance } from './townTalk.js';

// PlayerEntity.Crimes (the two this module levies - the enum lives
// whole in systems/court.js).
const CRIME_ASSAULT = 4;
const CRIME_MURDER = 5;

export const GUARD_MOBILE_TYPE = 146;          // MobileTypes.Knight_CityWatch
export const MAX_ACTIVE_GUARD_SPAWNS = 5;
export const GUARD_NPC_SPAWN_RANGE = 77.5;
export const GUARD_BEHIND_ANGLE = 105.469;     // convert non-guards this far behind the player
export const GUARD_SEEN_ANGLE = 95;            // an NPC facing the player within this sees a crime
export const GUARD_FALLBACK_MIN_DIST = 12.8;   // CreateFoeSpawner ring
export const GUARD_FALLBACK_MAX_DIST = 51.2;

export function createCityGuards({ renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, onPlayerHurt, currentMinute, rand = Math.random, say = null }) {
  // AUDIT 23 (hosts-3): currentMinute is REQUIRED - the () => 0 default
  // let a guard's poisoned hit anchor at minute 0, and the next world
  // tick (absolute clock ~523,530) caught the whole course up at once.
  if (typeof currentMinute !== 'function') throw new Error('createCityGuards needs currentMinute (the classic-minute clock)');
  const guards = [];       // { mobile, ai, attack, entity, batch, tex, archive, dead, _halted }
  const corpseBatches = [];
  let _career = null;      // CLASS18.CFG, fetched once
  let countdown = 0;       // guardsArriveCountdown (seconds)
  // The last camera-view predicate a host handed resolvePlayerHit.
  // Both exterior hosts call resolvePlayerHit with a live
  // makeInView() every swing and only then fall through to
  // resolveCivilianHit, so the assault-carry swing has one to reuse -
  // and DFU applies the camera test to that swing too.
  let _lastInView = null;

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
    // AUDIT 18: LootTables.cs:212/:229/:237 pass the PLAYER's gender
    // into the random-item builders; the hard-coded 'male' here made
    // a female character's guard loot roll male clothing.
    entity.items = generateItems(basics.lootTableKey ?? '-', { level: playerEntity.level, gender: playerEntity.gender });
    // (Knight_CityWatch has NO LootTableKey in DFU - the table roll is
    // legitimately empty; the corpse's loot is the EQUIPMENT below.)
    // AUDIT 18: the whole SetEnemyEquipment chain is now shared with
    // the dungeon host's two spawn branches (hostCombat.equipEnemy).
    equipEnemy(entity, GUARD_MOBILE_TYPE, playerEntity.level);
    const ai = new EnemyAI(collider, [pos[0], pos[1] + 0.1, pos[2]], yaw, {
      liveSpeed: entity.liveSpeed,
      seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
      playerInside: false,   // AUDIT 23 (characters-7): EnemySenses.cs:269 - exterior despawn band
    });
    // MakeEnemyHostileToAttacker + GiveUpTimer *= 3, verbatim: a
    // crime-responding guard pursues without having seen the player.
    ai.makeHostileToPlayer(600);
    const attack = new EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: playerEntity.level, reflexes: playerEntity.reflexes });
    // EnemyMotor.cs:131-137 computes hasBowAttack from the MobileEnemy
    // FLAGS, and EnemyBasics.cs:2197-2212 gives Knight_CityWatch
    // HasRangedAttack1 = false / CastsMagic = false - so DFU's
    // predicate is FALSE here and this literal IS the verbatim value,
    // not an interim. (Checked in AUDIT 18: the routed claim that 146
    // carries HasRangedAttack1 does not hold against the table.)
    attack.rangedAttack = false;
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
    // Non-immediate: witnesses. VERBATIM QUIRK (audit 2026-08-17c):
    // DFU's `if (seenByGuard)` conversion sits INSIDE the pool loop
    // but OUTSIDE the range/LOS gate - once ANY guard NPC has seen
    // the crime, EVERY REMAINING pool NPC (in range or not, guard or
    // not) converts into a spawned guard and is disabled. Preserved
    // 1:1 (we had converted only the seeing guard).
    let seen = false, seenByGuard = false;
    for (const p of pool) {
      const toPlayer = [playerFeet[0] - p.pos[0], playerFeet[1] - p.pos[1], playerFeet[2] - p.pos[2]];
      const dist = Math.hypot(...toPlayer);
      if (dist <= GUARD_NPC_SPAWN_RANGE) {
        const fwd = [Math.sin(p.fwdYaw), 0, Math.cos(p.fwdYaw)];
        if (angleDeg(toPlayer, fwd) <= GUARD_SEEN_ANGLE) {
          // line of sight from the NPC's eye to the player's chest
          const eye = [p.pos[0], p.pos[1] + 0.7, p.pos[2]];
          const dir = [toPlayer[0] / (dist || 1), (toPlayer[1] + 0.6) / (dist || 1), toPlayer[2] / (dist || 1)];
          // AUDIT 24 scenes: PlayerEntity.cs:722-728 puts only `seen`
          // behind the ray actually reaching the player. `seenByGuard`
          // sits inside `if (Physics.Raycast(...))` alone - ANY hit,
          // wall or player - so a guard NPC in range and facing the
          // crime raises the watch even from behind a market stall.
          const hit = collider.raycast(eye, dir, dist);
          const clear = !Number.isFinite(hit) || hit >= dist - 1e-3;
          if (clear) seen = true;
          // ...and seenByGuard rides the RAYCAST ITSELF, not the clear
          // line. DFU's `Physics.Raycast(ray, out hit, 77.5f)` is aimed
          // at the player's eye from inside 77.5m, so it always hits
          // SOMETHING - the player, or the wall between. The port's
          // collider carries no player, so a clear line answers
          // Infinity and a blocked one a finite distance: the two
          // together are the same "hit something", which is why this
          // is unconditional rather than a test that can only be true.
          if (p.guard) seenByGuard = true;
        }
      }
      if (seenByGuard) {
        await spawnGuardAt(p.pos, p.fwdYaw);
        p.disable();
      }
    }
    // AUDIT 24 scenes: `Random.Range(5, 10 + 1)` is the INT overload -
    // one of {5,6,7,8,9,10}, never 7.3 and never short of 10.
    if (!seenByGuard && seen) countdown = 5 + Math.floor(rand() * 6);   // Random.Range(5, 11) seconds
  }

  function angleDeg(v, fwd) {
    const l = Math.hypot(v[0], v[2]) || 1e-9;
    const f = Math.hypot(fwd[0], fwd[2]) || 1e-9;
    const cos = (v[0] * fwd[0] + v[2] * fwd[2]) / (l * f);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  }

  /** AUDIT 24 (the seven-slice sweep): free a guard's LIVE billboard
   *  batch the moment nothing will draw it again. `batches()` skips
   *  every dead guard and a corpse draws from its own entry in
   *  corpseBatches, so the live batch - a VAO and two GL buffers - was
   *  simply abandoned, on both death paths, for every guard the watch
   *  ever spawned. The `guards` ARRAY cannot be pruned alongside it:
   *  lootTargets keys corpses by their array INDEX (`guardCorpse:${i}`)
   *  and takeLoot reads guards[i] back, so a splice would hand the
   *  player someone else's purse. */
  function releaseGuardBatch(g) {
    if (!g.batch) return;
    renderer.destroyBillboardBatch(g.batch);
    g.batch = null;
  }

  function damageGuard(g, damage, playerFeet, knockDir) {
    g.entity.health -= damage;
    if (g.entity.health <= 0) {
      g.dead = true;
      g.corpse = true;   // G3: only a KILLED guard is lootable (walk-aways vanish with their items)
      releaseGuardBatch(g);
      // G4 (HandleAttackFromSource, verbatim): killing the city watch
      // IS Murder; TallyCrimeGuildRequirements(false, 1) FLAGGED to
      // the thieves-guild arc.
      playerEntity.crimeCommitted = CRIME_MURDER;
      const ct = ENEMY_BASICS[GUARD_MOBILE_TYPE].corpseTexture;
      const size = scaledBillboardSize(g.tex.getSize(0), g.tex.getScale(0));
      // corpse archive differs from the live one; upload its record
      getTexture(ct.archive).then((t) => {
        uploadRecordFrame(ct.archive, ct.record, 0);
        const sz = scaledBillboardSize(t.getSize(ct.record), t.getScale(ct.record));
        const pos = [g.ai.feet[0], g.ai.feet[1], g.ai.feet[2]];
        const batch = renderer.createBillboardBatch(ct.archive, ct.record, sz ?? size, [pos]);
        batch.frame = 0;   // FA1 slice 3: bare record + a frame FIELD, one key rule
        // AUDIT 17e F23: keep the creation params - a floating-origin
        // recenter has to REBUILD the batch (the centers are baked into
        // a STATIC_DRAW buffer, so they cannot be shifted in place).
        corpseBatches.push({ batch, archive: ct.archive, record: ct.record, size: sz ?? size, pos });
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
      for (const g of guards) if (!g.dead) { g.dead = true; releaseGuardBatch(g); }   // no corpse - they walk away
    }
    // AUDIT 17e F7 - PlayerEntity.cs:533-537 verbatim: the surrender
    // dialogue flag resets once no city watch is alive. It only ever
    // cleared inside the court flow, so a player who killed or
    // outran the watch never saw the surrender box again - and that
    // box is the ONLY call site of LowerRepForCrime.
    if (playerEntity.haveShownSurrenderDialogue && !guards.some((g) => !g.dead)) {
      playerEntity.haveShownSurrenderDialogue = false;
    }
    if (countdown > 0) {
      countdown -= dt;
      if (countdown <= 0) spawnCityGuards(true, { playerFeet, playerFwd: [0, 0, 1], pool: [] });   // arrivals ride the ring fallback
    }
    const out = [];
    for (const g of guards) {
      if (g.dead) continue;
      // AUDIT 24 (wave 32): PARALYSIS. This pool passed the literal `false`
      // for the motor's paralyzed argument and ran the attack machine
      // unconditionally, so a paralysed watchman kept chasing and kept
      // swinging. EnemyMotor.HandleParalysis (:247-260) drops CanAct, and
      // EnemyAttack returns at the top of Update (:91-94) and FixedUpdate
      // (:55-57) - a city guard is an ordinary EnemyClass entity with no
      // exemption from either.
      const _gParalyzed = entityIsParalyzed(g.entity);   // S22: the FreeAction read-time fold
      g.ai.update(dt, playerFeet, senses, _gParalyzed);
      // HALT! on the detection rising edge (barkSound, EnemySounds)
      if (g.ai.detected && !g._halted) {
        g._halted = true;
        audio?.play3d?.(ENEMY_BASICS[GUARD_MOBILE_TYPE].barkSound, g.ai.feet, 1.0, { maxDistance: 16 });
      }
      g.mobile.frameSpeedDivisor = Math.max(1, Math.trunc((g.entity.stats?.speed ?? 50) / Math.max(8, liveStat(g.entity, 'speed'))));   // AUDIT 23 (characters-11)
      const events = _gParalyzed ? [] : g.attack.update(dt, g.ai, playerFeet);
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
      // EnemyAttack.Update returns at the top while paralysed (:91-94), so no
      // damage frame resolves - the swing may still be drawn, nothing lands.
      if (!_gParalyzed && g.mobile.doMeleeDamage) {
        g.mobile.doMeleeDamage = false;
        const hdx = playerFeet[0] - g.ai.feet[0], hdz = playerFeet[2] - g.ai.feet[2];
        const wpn = chooseEnemyWeapon(g.entity.weapon, ENEMY_BASICS[GUARD_MOBILE_TYPE]);
        const gmid = [g.ai.feet[0], g.ai.feet[1] + 0.9, g.ai.feet[2]];
        if (meleeHitConnects(g.ai._dist, g.ai.inSight, withinYaw(g.ai.yaw, hdx, hdz, MELEE_HIT_YAW_DEG))) {
          // AUDIT 2026-08-17c: every resolved enemy attack on the
          // player tallies Dodging (EnemyAttack, before the damage
          // branch) - it was never tallied anywhere.
          tallySkill(playerEntity, SKILLS.Dodging, 1);
          // AUDIT 18: the player is the Humanoid group
          // (GetBonusOrPenaltyByEnemyType's PlayerEntity arm), and the
          // InflictPoison seam the dungeon host already passes -
          // guard weapon poison was ROLLED at spawn and could never
          // be inflicted, because the exterior call dropped the hook.
          const dmg = calculateAttackDamage(g.entity, playerEntity, {
            weapon: wpn,   // AUDIT 18: target group derived from the entity (isPlayer -> Humanoid)
            onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(currentMinute()) }),
            say,   // C-slice: equipment breaks speak
          });
          if (dmg > 0) onPlayerHurt?.(dmg, wpn);   // G2: the host's arrest interception rides this
          // C2-slice (combat-9): a connected attack that LOST the
          // roll rings the miss sound (ApplyDamageToPlayer's else)
          else audio?.play3d?.(enemyMissSound(wpn), gmid, 1, { maxDistance: 16 });
        } else {
          // C2-slice (combat-9): the out-of-reach whiff rings too
          audio?.play3d?.(enemyMissSound(wpn), gmid, 1, { maxDistance: 16 });
        }
        // C2-slice (combat-17): the 20% attack voice - the watch is
        // the Knight_CityWatch class, whose voice is FORCED male.
        const v = enemyAttackVoice(g);
        if (v && v.clip >= 0) audio?.play3d?.(v.clip, gmid, 1, { maxDistance: 16 });
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
    return [...out, ...corpseBatches.map((c) => c.batch)];
  }

  /** The player's swing resolves against live guards (the dungeon's
   *  resolvePlayerHit shape over playerWeapon.resolveHit). */
  function resolvePlayerHit(playerWeapon, eye, lookDir, playerFeet, inViewFn, onHitSound) {
    if (inViewFn) _lastInView = inViewFn;   // the assault-carry swing below reaches here without one
    const view = inViewFn ?? _lastInView;
    const live = guards.filter((g) => !g.dead);
    if (!live.length) return false;
    const canSee = (g) => {
      const c = [g.ai.feet[0], g.ai.feet[1] + 0.9, g.ai.feet[2]];
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      const l = dist || 1;
      const hit = collider.raycast(eye, [dx / l, dy / l, dz / l], dist);
      // WeaponManager.cs:951-955 applies `if (!IsPositionInCameraView
      // (center)) canHit = false;` UNCONDITIONALLY, before the LOS
      // test - so a missing projection cannot mean "accept". This
      // default was ACCEPT, contradicting cameraView.js's own note.
      return { dist, inView: view ? view(c) : false, losClear: !Number.isFinite(hit) || hit >= dist - 1e-3 };
    };
    let any = false;
    // C2-slice (combat-17): the player's 20% attack grunt, once per
    // hit frame (melee-only path).
    const grunt = playerAttackGrunt(playerEntity, false, rand);   // ENGINE-PRNG RULE: the pool's seam - the bare default leaked Math.random into the parry pin (the recurring suite flake, root-caused)
    if (grunt && grunt.clip >= 0) audio?.playOneShot?.(grunt.clip, 1);
    // AUDIT 18: the backstab argument was hard-zeroed, so guard combat
    // had no backstab at all where the dungeon host computes facing
    // per foe - and CalculateBackstabChance's Backstabbing tally
    // (FormulaHelper.cs:975-990) ran nowhere in the port.
    for (const { foe, damage } of playerWeapon.resolveHit(live, playerEntity, canSee, rand,
      (g) => backstabChanceOf(playerEntity, isBackFacing(g.ai.yaw, g.ai.feet, eye)), say,
      (g, pt) => inflictPoison(g.entity, pt, false, { currentMinute: Math.floor(currentMinute()) }))) {   // C2-slice (combat-11)
      any = true;
      if (damage > 0) {
        onHitSound?.(foe);
        // C2-slice (combat-17): the struck watchman cries out 40%
        const pain = enemyPainVoice(foe, damage);
        if (pain && pain.clip >= 0) audio?.play3d?.(pain.clip, [foe.ai.feet[0], foe.ai.feet[1] + 0.9, foe.ai.feet[2]], 1, { maxDistance: 16 });
        damageGuard(foe, damage, playerFeet, lookDir);
      } else {
        // WeaponManager.cs:609-615: a connecting swing that dealt
        // nothing still makes a noise. The exterior hosts played
        // nothing at all.
        const snd = zeroDamageHitSound({
          weapon: playerWeapon.weapon, arrowHit: false,
          parrySounds: !!ENEMY_BASICS[GUARD_MOBILE_TYPE]?.parrySounds, roll: rand(),
        });
        if (snd?.at === 'enemy') audio?.play3d?.(snd.sound, foe.ai.feet, 1.1, { maxDistance: 16 });
        else if (snd) audio?.playOneShot?.(snd.sound, 1.1);
      }
    }
    // WeaponManager.cs:419-436: the swing costs fatigue whatever it
    // hits, and a connecting swing tallies the weapon skill AND
    // CriticalStrike. Neither ran in the exterior hosts.
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - SWING_WEAPON_FATIGUE_LOSS);
    if (any) tallySwingSkills(playerEntity, playerWeapon.weapon);
    return any;
  }

  // G4: the weapon strike against WANDERING townsfolk (WeaponManager's
  // mobile-NPC branch, verbatim): a CIVILIAN dies to one hit - the
  // motor disables, TallyCrimeGuildRequirements(false, 5) FLAGGED,
  // Murder + SpawnCityGuards(true) through the host's onMurder; a
  // wandering GUARD NPC converts on the spot - Assault - and the
  // swing carries onto the fresh guard foe (DFU re-points the hit).
  // Returns false, {crime:'murder'} or {crime:'assault', carriedHit}.
  async function resolveCivilianHit(playerWeapon, eye, lookDir, playerFeet, pool, { onMurder = () => {}, onHitSound = null, inViewFn = null } = {}) {
    let best = null, bestD = Infinity;
    for (const p of pool) {
      const d = rayPersonDistance(eye, lookDir, p.pos);
      if (d < bestD) { best = p; bestD = d; }
    }
    if (!best || bestD > WEAPON_REACH) return false;
    const wall = collider.raycast(eye, lookDir, bestD);
    if (Number.isFinite(wall) && wall < bestD - 1e-3) return false;   // occluded
    if (!best.guard) {
      best.disable();   // one weapon hit kills a civilian (SetActive(false))
      playerEntity.crimeCommitted = CRIME_MURDER;
      onMurder();       // SpawnCityGuards(true)
      return { crime: 'murder' };
    }
    playerEntity.crimeCommitted = CRIME_ASSAULT;
    await spawnGuardAt(best.pos, best.fwdYaw);
    best.disable();
    const carriedHit = resolvePlayerHit(playerWeapon, eye, lookDir, playerFeet, inViewFn ?? _lastInView, onHitSound);
    return { crime: 'assault', carriedHit };
  }

  // G3: corpse loot on the dungeon's S2 pickup shape - killed guards
  // with items are activation targets for the hosts' E ray; takeLoot
  // transfers into the player entity (the corpse billboard stays, as
  // dungeon corpses do; 'You take N items.' - TEXT.RSC pends with the
  // dungeon's).
  function lootTargets() {
    const targets = [];
    guards.forEach((g, i) => {
      if (!g.corpse || !g.entity?.items?.length) return;
      const p = g.ai.feet;
      // PlayerActivate.cs:85/:938 - corpses reach 150 * GlobalScale,
      // not the 128-unit default.
      targets.push({ key: `guardCorpse:${i}`, aabb: { min: [p[0] - 0.5, p[1], p[2] - 0.5], max: [p[0] + 0.5, p[1] + 0.6, p[2] + 0.5] }, distance: CORPSE_ACTIVATION_DISTANCE });
    });
    return targets;
  }
  function takeLoot(key, say = () => {}) {
    const g = guards[Number(key.split(':')[1])];
    if (!g?.corpse || !g.entity?.items?.length) return 0;
    let n = 0;
    playerEntity.items = playerEntity.items || [];
    for (const item of g.entity.items) { addItem(playerEntity.items, item); n++; }
    g.entity.items.length = 0;
    if (n > 0) say(n === 1 ? 'You take 1 item.' : `You take ${n} items.`);
    return n;
  }

  /** AUDIT 17e F23 / THE FOUR HOSTS RULE: the ?world host recenters
   *  the floating origin by shifting the camera and player, but live
   *  guards, their corpse billboards and the corpse loot AABBs are
   *  world-space too - they were left 819.2 units behind on every
   *  recenter (guards marching to where the player USED to be, corpses
   *  un-lootable). The fixed exterior host never recenters, so this
   *  only ever manifested in ?world. */
  function offsetAll(offset) {
    const [dx, dy, dz] = offset;
    for (const g of guards) {
      if (g.ai?.feet) { g.ai.feet[0] += dx; g.ai.feet[1] += dy; g.ai.feet[2] += dz; }
      if (g.ai?.knockbackDir) continue;   // a direction, not a position
    }
    // live guards rebuild their billboards every frame from ai.feet,
    // so shifting the feet is enough for them; the persistent CORPSE
    // batches bake their centers into a static buffer and must be
    // rebuilt at the new origin.
    for (const c of corpseBatches) {
      c.pos[0] += dx; c.pos[1] += dy; c.pos[2] += dz;
      renderer.destroyBillboardBatch(c.batch);
      c.batch = renderer.createBillboardBatch(c.archive, c.record, c.size, [c.pos]);
      c.batch.frame = 0;   // FA1 slice 3: a REBUILT batch is a new object - it needs the frame too
    }
  }

  return { guards, spawnCityGuards, update, offsetAll, resolvePlayerHit, resolveCivilianHit, activeCount, lootTargets, takeLoot,
    // M2 (spellcasting above ground): the player's spell damage rides
    // THE SAME door the melee swing uses - corpse, Murder on the kill,
    // hostility - so a fireball is not a free crime channel.
    hurtGuard: (g, dmg, playerFeet) => damageGuard(g, dmg, playerFeet, null),
    _damage: (i, dmg) => { const g = guards[i]; if (g && !g.dead) damageGuard(g, dmg, [0, 0, 0], null); },   // probe/test seam through the REAL death path
    _debug: () => guards.map((g) => ({ dead: g.dead, hp: g.entity.health, pos: g.ai.feet.map((v) => +v.toFixed(1)), detected: g.ai.detected, state: g.attack.machine.state, moving: g.ai.moving, dist: +(g.ai._dist ?? -1).toFixed(1), giveUp: g.ai.giveUpTimer })) };
}
