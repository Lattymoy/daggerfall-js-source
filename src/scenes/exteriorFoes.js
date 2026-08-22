// EXTERIOR ENCOUNTER FOES (X-slice). The mount S32's above-ground
// spawn arms needed: a host-owned pool of REAL foes above ground -
// the same shared pieces the dungeon and the city watch already run
// (EnemyAI senses/pursuit vs the exterior collider, the EnemyAttack
// cadence with the C-slice archer band, MobileUnit classic sprites,
// makeEnemyEntity/equipEnemy/loot, CalculateAttackDamage both ways,
// corpses) - minus the guard-specific crime machinery. cityGuards
// stays the WATCH's home; this pool is everything else the tables
// can mint (monsters 0-42 and class enemies 128+).
//
// RESIDUE (the S32 row): exterior enemy ARCHERY and CASTING pend
// their missile seams - encounter foes fight melee (rangedAttack
// stays false so the C-slice fallback makes them close), and the
// 13 fixed-list casters do not cast up here yet.

import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { EnemyAI, isBackFacing, withinYaw } from '../characters/enemyMotor.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../player/motor.js';   // CH3: the shared fall formula
import { SOUND } from '../systems/soundClips.js';   // CH3: the FallDamage clip
import { EnemyCaster, castEnemySpell, hasRangedSpell } from '../characters/enemyCasting.js';   // X3: the shared decision + the ONE cast executor
import { assignEnemySpells, SPELL_CAST_SOUND } from '../systems/enemySpells.js';   // X3
import { applySpell, maxFatigue, entityIsParalyzed } from '../systems/effects.js';   // X3: self-casts land through the effect spine
import { calculateCastCost } from '../systems/spellcost.js';   // X3: costs priced off the player (magic-15 note)
import { silenceBlocksCast } from '../systems/mysticism.js';   // X3: the enemy silence gate
import { EnemyAttack } from '../characters/enemyAttack.js';
import { makeEnemyEntity, loadMonsterCareer } from '../characters/enemyEntity.js';
import { MobileUnit } from '../characters/mobileUnit.js';
import { ClassFile } from '../formats/classFile.js';
import { equipEnemy, hasBowAttack, backstabChanceOf, zeroDamageHitSound, enemyMissSound, enemyAttackVoice, enemyPainVoice, playerAttackGrunt } from './hostCombat.js';   // C2-slice (combat-9/17)
import { generateItems as generateLootItems } from '../systems/loot.js';
import { calculateAttackDamage, meleeHitConnects, MELEE_HIT_YAW_DEG, chooseEnemyWeapon, KB_UNIT, enemyWeightClassicUnits, weaponKnockbackSpeed } from '../combat/formulas.js';
import { tallySkill, SKILLS } from '../systems/skills.js';
import { liveStat } from '../systems/statMods.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { rand } from '../formats/dfRandom.js';
import { setEnemyAlert } from '../systems/encounters.js';
import { inflictPoison } from '../systems/poisons.js';
import { onMonsterHit, SPIDER_TOUCH_SPELL_INDEX } from '../systems/diseases.js';   // AUDIT 24 (wave 30): the monster special-attack rider, above ground
import { MINUTES_PER_DAY } from '../systems/worldTick.js';

// The port's allocation-owner guards (classic self-limits through the
// 144-minute cadence; these keep a long session bounded).
export const MAX_ACTIVE_ENCOUNTER_FOES = 8;
export const ENCOUNTER_CULL_DISTANCE = 120;

export function createExteriorFoes({ renderer, collider, fetchBytes, getTexture, uploadRecordFrame,
  playerEntity, audio, onPlayerHurt, currentMinute, say = null, rolls = Math.random,
  playerSinks = null,   // AUDIT 24 (wave 30): the player's damage/drain doors - the nymph and lamia riders need drainFatigue
  onArrow = null,   // X2-slice: the host's arrow seam - (from, dir, foe) at the shoot frame
  spellsByIndex = null,   // X3-slice: () => the SPELLS.STD map (null until loaded) - casters need it
  magicHooks = null }) {  // X3-slice: { explodeAt, fireMissile } - the host's spell release seams
  const foes = [];        // { mobile, ai, attack, entity, batch, tex, archive, mobileType, dead, _encounter: true }
  const corpseBatches = [];

  const activeCount = () => foes.filter((f) => !f.dead).length;

  /** One encounter foe at a world position - the dungeon load chain's
   *  shape, host-owned. */
  async function spawnFoe(mobileType, pos) {
    if (activeCount() >= MAX_ACTIVE_ENCOUNTER_FOES) return null;
    const basics = ENEMY_BASICS[mobileType];
    if (!basics || !basics.maleTexture) return null;
    try {
      const isClass = mobileType >= 128;
      const career = isClass
        ? (() => { const cf = new ClassFile(); return fetchBytes(`CLASS${String(mobileType - 128).padStart(2, '0')}.CFG`).then((b) => { cf.load(b); return cf.career; }); })()
        : loadMonsterCareer(mobileType, fetchBytes);
      const entity = makeEnemyEntity(mobileType, basics, await career, playerEntity.level);
      entity.items = generateLootItems(basics.lootTableKey ?? '-', { level: playerEntity.level, gender: playerEntity.gender });
      equipEnemy(entity, mobileType, playerEntity.level);
      const gender = basics.femaleTexture && rolls() < 0.5 ? 'female' : 'male';
      const behaviour = basics.behaviour ?? 'General';
      const ai = new EnemyAI(collider, [pos[0], pos[1] + 0.1, pos[2]], rolls() * Math.PI * 2, {
        liveSpeed: entity.liveSpeed,
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
        behaviour, mobileId: mobileType,
        playerInside: false,   // the exterior despawn band (EnemySenses.cs:269)
        // wave 35: DoRangedAttack's band - a shooter inside 6..51.2 with
        // the target in sight stands off instead of closing.
        hasBowAttack: hasBowAttack(basics),
        canCastRangedSpell: () => hasRangedSpell(entity),
      });
      const attack = new EnemyAttack({ liveSpeed: entity.liveSpeed, playerLevel: playerEntity.level, reflexes: playerEntity.reflexes, rolls });
      // X2-slice: the arrow seam exists (the host's onArrow) - bow
      // foes read the SAME ranged-flags law the dungeon build does,
      // and the C-slice 6..51.2 band drives them above ground.
      attack.rangedAttack = hasBowAttack(basics);
      // X3-slice: the S16 spell lists ride the same assignment the
      // dungeon build runs; a listed caster gets the shared decision
      // driver. No SPELLS.STD yet (the map loads async) = no lists,
      // exactly like a degraded dungeon boot.
      const sbi = spellsByIndex?.();
      if (sbi) assignEnemySpells(entity, sbi);
      const caster = entity.spells?.length ? new EnemyCaster(entity, rolls) : null;
      const archive = gender === 'female' ? basics.femaleTexture : basics.maleTexture;
      const tex = await getTexture(archive);
      const mobile = new MobileUnit(mobileType, basics, (rec) => tex.getFrameCount(rec), Math.random, gender);
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      const f = { mobile, ai, attack, entity, caster, batch, tex, archive, mobileType, gender, dead: false, _encounter: true, _prevMState: 'Idle', _mout: null };
      foes.push(f);
      return f;
    } catch (err) {
      console.error(`[encounter] mobileType ${mobileType} failed to spawn:`, err?.message ?? err);
      return null;
    }
  }

  /** The one damage door: corpse + loot on death (no crime - these
   *  are monsters and brigands, not the watch). */
  /** X3-slice: the per-foe sinks the cast executor feeds (the
   *  dungeon's foeSinks shape - self-casts heal/buff through these). */
  const foeSinks = (f) => ({
    hurt: (n) => damageFoe(f, n, null, null),
    heal: (n) => { f.entity.health = Math.min(f.entity.maxHealth ?? Infinity, f.entity.health + n); },
    drainMagicka: (n) => { if (n > 0) f.entity.magicka = Math.max(0, (f.entity.magicka ?? 0) - n); },
    restoreMagicka: (n) => { if (n > 0) f.entity.magicka = Math.min(f.entity.maxMagicka ?? Infinity, (f.entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.max(0, (f.entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.min(maxFatigue(f.entity), (f.entity.fatigue ?? 0) + n); },
  });

  /** X3-slice: this pool's binding of the ONE shared cast executor
   *  (characters/enemyCasting.js), the dungeon host's shape. Both
   *  callers go through here - the S16 casting decision and wave 30's
   *  spider/scorpion paralyze rider - so the deps are written once. */
  function castSpellFrom(f, spell, playerFeet, noSpellPointCost = false) {
    castEnemySpell(f, spell, {
      noSpellPointCost, playerEntity, playerFeet,
      applySpell, foeSinks, calculateCastCost, silenceBlocksCast,
      playCastSound: (element, from) => audio?.play3d?.(SPELL_CAST_SOUND[element] ?? SPELL_CAST_SOUND[4], from, 1, { maxDistance: 16 }),
      explodeAt: magicHooks?.explodeAt,
      fireMissile: magicHooks?.fireMissile,
      rolls,
    });
  }

  /** Free a foe's live billboard batch once nothing will draw it. */
  function releaseFoeBatch(f) {
    if (!f.batch) return;
    renderer.destroyBillboardBatch(f.batch);
    f.batch = null;
  }

  function damageFoe(f, damage, playerFeet, knockDir = null) {
    if (f.ai && !f.ai.isHostile) { f.ai.isHostile = true; f.ai.makeHostileToPlayer?.(); }
    f.entity.health -= damage;
    if (f.entity.health <= 0) {
      f.dead = true;
      f.corpse = true;
      // the LIVE batch is finished the moment the foe is - batches()
      // skips every dead foe, and the corpse draws from its own batch
      // below. AUDIT 24: this one was never freed either, and unlike
      // the cull the record STAYS in `foes` (the tail splice spares
      // corpses), so the batch was unreachable and undead at once.
      releaseFoeBatch(f);
      if (f.ai?.detected) setEnemyAlert(playerEntity, false);   // EnemyDeath:132-136
      const ct = ENEMY_BASICS[f.mobileType]?.corpseTexture;
      if (ct) {
        const size = scaledBillboardSize(f.tex.getSize(0), f.tex.getScale(0));
        getTexture(ct.archive).then((t) => {
          uploadRecordFrame(ct.archive, ct.record, 0);
          const sz = scaledBillboardSize(t.getSize(ct.record), t.getScale(ct.record));
          const pos = [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]];
          const batch = renderer.createBillboardBatch(ct.archive, ct.record, sz ?? size, [pos]);
          batch.frame = 0;   // FA1 slice 3: bare record + a frame FIELD, one key rule
          corpseBatches.push({ batch, archive: ct.archive, record: ct.record, size: sz ?? size, pos });
        }).catch(() => {});
      }
      return;
    }
    if (knockDir && f.ai.knockbackSpeed <= 5 / KB_UNIT) {
      const w = enemyWeightClassicUnits(f.mobileType >= 128, f.gender, ENEMY_BASICS[f.mobileType]?.weight ?? 0);
      f.ai.knockbackSpeed = weaponKnockbackSpeed(damage, w);
      f.ai.knockbackDir = [knockDir[0], knockDir[1], knockDir[2]];
    }
  }

  /** The per-frame loop - the guard loop minus the crime arms, plus
   *  the distance cull and the sight alert raise. */
  function update(dt, playerFeet, eye, senses = {}) {
    for (const f of foes) {
      if (f.dead) continue;
      // AUDIT 24 (wave 32): PARALYSIS. This pool passed the literal `false`
      // for the motor's paralyzed argument and ran the attack machine
      // unconditionally, so a paralysed encounter foe kept walking and kept
      // swinging - and, until wave 32 gave the pool its magic rounds, the
      // paralysis never expired either. EnemyMotor.HandleParalysis
      // (:247-260) drops CanAct, and EnemyAttack returns at the top of both
      // its Update (:91-94) and its FixedUpdate (:55-57).
      const _fParalyzed = entityIsParalyzed(f.entity);   // S22: the FreeAction read-time fold
      f.ai.update(dt, playerFeet, senses, _fParalyzed);
      // CH3 (characters-8): a past-threshold landing bills the fall
      // formula through the pool's damage door - no knockback.
      if (f.ai.landedFall > 0 && !f.dead) {
        const fdmg = Math.trunc(FALL_HP_PER_METRE * (f.ai.landedFall - FALL_DAMAGE_THRESHOLD));
        f.ai.landedFall = 0;
        if (fdmg > 0) {
          audio?.play3d?.(SOUND.FallDamage, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 1, { maxDistance: 16 });
          damageFoe(f, fdmg, null, null);
        }
      }
      // out of relevance (fresh senses, so a just-spawned foe's
      // Infinity placeholder never culls): gone, no corpse.
      // AUDIT 24 (the seven-slice sweep): EVERY ALLOCATION HAS AN
      // OWNER. The tail splice below drops a culled foe - and with it
      // the only reference to its billboard batch, a VAO and two GL
      // buffers, which nothing freed. Encounters respawn on a timer
      // forever, so this bled for the whole session.
      if (f.ai._dist > ENCOUNTER_CULL_DISTANCE && !f.ai.detected) {
        releaseFoeBatch(f);
        f.dead = true;
        continue;
      }
      if (f.ai.inSight && f.ai.detected) setEnemyAlert(playerEntity, true, currentMinute());   // EnemySenses:533-535
      f.mobile.frameSpeedDivisor = Math.max(1, Math.trunc((f.entity.stats?.speed ?? 50) / Math.max(8, liveStat(f.entity, 'speed'))));
      if (!_fParalyzed) f.attack.update(dt, f.ai, playerFeet);
      // X3-slice: the S16 casting decision rides beside the attack
      // machine, the dungeon's exact shape - the decision casts
      // INSTANTLY through the ONE shared executor.
      f._castPending = false;
      if (playerFeet && f.caster && !_fParalyzed && f.ai.isHostile) {
        const dec = f.caster.update(dt, f.ai, f.attack, playerFeet, playerEntity);
        if (dec) {
          castSpellFrom(f, dec.spell, playerFeet);
        }
      }
      const mstate = f.attack.machine.state;
      const strikeEdge = mstate !== 'Idle' && (f._prevMState ?? 'Idle') === 'Idle';
      f._prevMState = mstate;
      f._mout = f.mobile.update(dt, {
        moving: f.ai.moving,
        striking: strikeEdge && !f.attack.firedRanged,
        rangedStriking: strikeEdge && !!f.attack.firedRanged,
        hurting: f.ai.hurtKnock,
        casting: !!f._castPending,
      }, f.ai.yaw, f.ai.feet, eye);
      // X2-slice: the ranged -1 marker looses a REAL arrow through
      // the host's seam, aimed at the player mid-capsule at fire
      // time (the dungeon's shootArrow arm shape).
      // MELEE FIRST, arrow as the ELSE-IF: EnemyAttack.Update is
      // `if (DoMeleeDamage) {...} else if (ShootArrow) {...}` (:97-105).
      // (Found by the wave-35 re-read.)
      if (!_fParalyzed && f.mobile.doMeleeDamage && playerFeet) {
        f.mobile.doMeleeDamage = false;
        const hdx = playerFeet[0] - f.ai.feet[0], hdz = playerFeet[2] - f.ai.feet[2];
        const wpn = chooseEnemyWeapon(f.entity.weapon, ENEMY_BASICS[f.mobileType]);
        const mid = [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]];
        if (meleeHitConnects(f.ai._dist, f.ai.inSight, withinYaw(f.ai.yaw, hdx, hdz, MELEE_HIT_YAW_DEG))) {
          tallySkill(playerEntity, SKILLS.Dodging, 1);
          const dmg = calculateAttackDamage(f.entity, playerEntity, {
            weapon: wpn,
            // AUDIT 24 (wave 30): THE SPECIAL-ATTACK RIDER, which this
            // pool never passed. FormulaHelper's monster branch calls
            // OnMonsterHit on every hit that lands damage
            // (FormulaHelper.cs:660-662), and it is the ONLY door to
            // rat/bat/zombie/mummy disease, spider and giant scorpion
            // paralysis, and the nymph/lamia fatigue drain. The
            // dungeon host has passed it since S18; above ground the
            // whole table was inert, so no exterior encounter could
            // infect, paralyse or drain the player - the encounter
            // tables mint rats, giant bats, spiders, scorpions,
            // zombies, mummies, nymphs and lamias by day and by
            // night. (The arrow and city-watch paths correctly do NOT
            // pass it: DFU calls it only in the weaponless MONSTER
            // arm, never for a weapon hit or an EnemyClass attacker.)
            onMonsterHit: (att, tgt, hit) => onMonsterHit(att, tgt, hit, {
              currentDay: Math.floor(currentMinute() / MINUTES_PER_DAY), sinks: playerSinks, rolls,
              castParalyze: () => {   // S19: the spider/scorpion free-cast of classic spell 66
                const sp = spellsByIndex?.()?.get(SPIDER_TOUCH_SPELL_INDEX);
                if (sp) castSpellFrom(f, sp, playerFeet, true);
              },
            }),
            onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(currentMinute()) }),
            say,
          });
          if (dmg > 0) onPlayerHurt?.(dmg, wpn);
          // C2-slice (combat-9): a connected attack that LOST the
          // roll rings the miss sound (ApplyDamageToPlayer's else)
          else audio?.play3d?.(enemyMissSound(wpn), mid, 1, { maxDistance: 16 });
        } else {
          // C2-slice (combat-9): the out-of-reach whiff rings too
          audio?.play3d?.(enemyMissSound(wpn), mid, 1, { maxDistance: 16 });
        }
        // C2-slice (combat-17): the 20% enemy-class attack voice at
        // the damage frame, whatever the outcome.
        const v = enemyAttackVoice(f);
        if (v && v.clip >= 0) audio?.play3d?.(v.clip, mid, 1, { maxDistance: 16 });
      }
      // ...and the damage frames are gated too (wave 32). EnemyAttack.Update
      // returns at the top while paralysed (:91-94), so MeleeDamage and
      // BowDamage never run - the animation may still be mid-swing, but
      // nothing lands. The dungeon host gets this by suppressing the whole
      // mobile update; this pool resolves off the mobile's own frames, so it
      // needs the gate written out.
      else if (!_fParalyzed && f.mobile.shootArrow && playerFeet && onArrow) {
        f.mobile.shootArrow = false;
        const from = [f.ai.feet[0], f.ai.feet[1] + 1.2, f.ai.feet[2]];
        const d = [playerFeet[0] - from[0], playerFeet[1] + 0.9 - from[1], playerFeet[2] - from[2]];
        const l = Math.hypot(...d) || 1;
        onArrow(from, [d[0] / l, d[1] / l, d[2] / l], f);
      }
      // the -1 damage marker vs the player (C16)
    }
    for (let i = foes.length - 1; i >= 0; i--) if (foes[i].dead && !foes[i].corpse) foes.splice(i, 1);
  }

  /** The player's melee against the pool - cityGuards' shape. */
  function resolvePlayerHit(playerWeapon, eye, lookDir, playerFeet, inViewFn, onHitSound) {
    const live = foes.filter((f) => !f.dead);
    if (!live.length) return false;
    const canSee = (f) => {
      const c = [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]];
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      const l = dist || 1;
      const hit = collider.raycast(eye, [dx / l, dy / l, dz / l], dist);
      return { dist, inView: inViewFn ? inViewFn(c) : false, losClear: !Number.isFinite(hit) || hit >= dist - 1e-3 };
    };
    let any = false;
    // C2-slice (combat-17): the player's 20% attack grunt, once per
    // hit frame (this path is melee-only, never a bow).
    const grunt = playerAttackGrunt(playerEntity, false, rolls);   // ENGINE-PRNG RULE: the pool's uniform seam
    if (grunt && grunt.clip >= 0) audio?.playOneShot?.(grunt.clip, 1);
    for (const { foe, damage } of playerWeapon.resolveHit(live, playerEntity, canSee, rolls,
      (f) => backstabChanceOf(playerEntity, isBackFacing(f.ai.yaw, f.ai.feet, eye)), say,
      (f, pt) => inflictPoison(f.entity, pt, false, { currentMinute: Math.floor(currentMinute()) }))) {   // C2-slice (combat-11)
      any = true;
      if (damage > 0) {
        onHitSound?.(foe);
        // C2-slice (combat-17): the struck class foe cries out 40%
        const pain = enemyPainVoice(foe, damage);
        if (pain && pain.clip >= 0) audio?.play3d?.(pain.clip, [foe.ai.feet[0], foe.ai.feet[1] + 0.9, foe.ai.feet[2]], 1, { maxDistance: 16 });
        damageFoe(foe, damage, playerFeet, lookDir);
      } else {
        const snd = zeroDamageHitSound({
          weapon: playerWeapon.weapon, arrowHit: false,
          parrySounds: !!ENEMY_BASICS[foe.mobileType]?.parrySounds, roll: rolls(),
        });
        if (snd?.at === 'enemy') audio?.play3d?.(snd.sound, foe.ai.feet, 1.1, { maxDistance: 16 });
        else if (snd) audio?.playOneShot?.(snd.sound, 1.1);
      }
    }
    return any;
  }

  /** Live sprite + corpse batches for the draw - the guard shape:
   *  record/size/origin mutate per frame, frames upload lazily. */
  function batches() {
    const out = [];
    for (const f of foes) {
      if (f.dead || !f._mout) continue;
      const o = f._mout;
      const rkey = `${o.record}#${o.frame}`;
      if (!renderer.textures.has(`${f.archive}_${rkey}`)) uploadRecordFrame(f.archive, o.record, o.frame);
      const sz = scaledBillboardSize(f.tex.getSize(o.record), f.tex.getScale(o.record));
      f.batch.record = rkey;
      f.batch.size = { w: o.flip ? -sz.w : sz.w, h: sz.h };
      f.batch.origin = f.ai.feet;
      out.push(f.batch);
    }
    return [...out, ...corpseBatches.map((c) => c.batch)];
  }

  /** AUDIT 17e F23: the floating-origin recenter shifts everything. */
  function offsetAll(offset) {
    for (const f of foes) {
      if (!f.ai) continue;
      f.ai.feet[0] += offset[0]; f.ai.feet[1] += offset[1]; f.ai.feet[2] += offset[2];
    }
    for (const c of corpseBatches) {
      c.pos[0] += offset[0]; c.pos[1] += offset[1]; c.pos[2] += offset[2];
      renderer.destroyBatch(c.batch);
      c.batch = renderer.createBillboardBatch(c.archive, c.record, c.size, [c.pos]);
      c.batch.frame = 0;   // FA1 slice 3: a REBUILT batch is a new object - it needs the frame too
    }
  }

  return { foes, spawnFoe, damageFoe, update, resolvePlayerHit, batches, offsetAll, activeCount };
}
