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
//    through the ordinary senses (they spawn close with LOS).
//    AUDIT 24 (wave 41): the "HALT bark on the detection rising edge"
//    this used to describe was an invention - DFU has no such edge.
//    EnemySounds runs a 3-9 second ATTRACT cadence while the player is
//    within 16m, and the watch is the one class enemy its human mute
//    spares. Same clip, continuously, instead of once and never again.
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
import { lycanthropeAttackVoice } from '../systems/lycanthropy.js';   // V4: the beast's attack voice
import { setCrimeCommitted } from '../systems/court.js';   // V4: the one crime setter (SuppressCrime)
import { tallyCrimeGuildRequirements } from '../systems/crimeGuilds.js';   // CG2: the TG/DB tally
import { entityIsParalyzed, applyEnemyMotorEffectFlags, concealmentFlags, isMagicallyConcealed } from '../systems/effects.js';   // AUDIT 24 (wave 32): the watch is paralysable too   // A5: the enemy Levitate arm, the foe-target concealment closure + EntityConcealmentBehaviour's visual
import { hasRangedSpell } from '../characters/enemyCasting.js';   // AUDIT 24 (wave 35): the stand-off band
import { setEnemyAlert } from '../systems/encounters.js';   // AUDIT 24 (wave 36): EnemySenses:531-535 / EnemyDeath:131-136
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE, CAPSULE_RADIUS } from '../player/motor.js';   // AUDIT 24 (wave 36): ApplyFallDamage, for the watch too   // ROAD-B: PlayerController.radius, for the indoor arm's door clearance
import { findLowestOuterInteriorDoor } from '../player/enterExit.js';   // ROAD-B: DaggerfallInterior.FindLowestOuterInteriorDoor
import { SOUND } from '../systems/soundClips.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { copyEffectEntry } from '../systems/save.js';   // AUDIT 26 F217
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';
import { MobileUnit } from '../characters/mobileUnit.js';
import { EnemyAI, withinYaw, isBackFacing } from '../characters/enemyMotor.js';
import { runTargetMachine, isPlayerTarget, PLAYER_TARGET } from '../characters/enemyTargets.js';   // MT-ii
import { applyDamageToNonPlayer } from './hostCombat.js';   // MT-ii: EnemyAttack.ApplyDamageToNonPlayer
import { EnemyAttack } from '../characters/enemyAttack.js';
import { makeEnemyEntity } from '../characters/enemyEntity.js';
import { ClassFile } from '../formats/classFile.js';
import { generateItems, addEnemyLootExtras } from '../systems/loot.js';   // AUDIT 24 (wave 43)
import { inflictPoison } from '../systems/poisons.js';
import {
  calculateAttackDamage, meleeHitConnects, MELEE_HIT_YAW_DEG, chooseEnemyWeapon,
  enemyWeightClassicUnits, weaponKnockbackSpeed, weaponKnockbackApplies,
  enemyLanguageSkill, calculateEnemyPacification,   // AUDIT 24 (wave 42)
} from '../combat/formulas.js';
import {
  equipEnemy, backstabChanceOf, tallySwingSkills,
  zeroDamageHitSound,
  enemyMissSound, enemyAttackVoice, enemyPainVoice, playerAttackGrunt,   // C2-slice (combat-9/17)
  tickEnemySound, playEnemyClip,   // AUDIT 24 (wave 41)
  tryLanguagePacification,         // AUDIT 24 (wave 42)
} from './hostCombat.js';   // AUDIT 18: the laws every host must share
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { tallySkill, SKILLS } from '../systems/skills.js';
import { WEAPON_REACH } from '../combat/playerWeapon.js';
import { rayPersonDistance } from './townTalk.js';
import { mintCorpseMarker, playBodyFall, corpseLootTargets, takeCorpseLoot, sayEnemyDied } from './corpseMarker.js';
import { bloodCentre } from './hitEffects.js';   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { EnemySoundSource, acuteHearingMultiplier } from '../characters/enemySounds.js';   // AUDIT 24 (wave 41): EnemySounds.cs, one home
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage   // AUDIT 24 (wave 38): EnemyDeath's one home

// PlayerEntity.Crimes (the two this module levies - the enum lives
// whole in systems/court.js).
const CRIME_ASSAULT = 4;
const CRIME_MURDER = 5;

export const GUARD_MOBILE_TYPE = KNIGHT_CITY_WATCH;   // AUDIT 24 (wave 41): one home
export const MAX_ACTIVE_GUARD_SPAWNS = 5;
export const GUARD_NPC_SPAWN_RANGE = 77.5;
export const GUARD_BEHIND_ANGLE = 105.469;     // convert non-guards this far behind the player
export const GUARD_SEEN_ANGLE = 95;            // an NPC facing the player within this sees a crime
export const GUARD_FALLBACK_MIN_DIST = 12.8;   // CreateFoeSpawner ring
export const GUARD_FALLBACK_MAX_DIST = 51.2;
/** PlayerEntity.cs:634 - `lowestDoorPos += lowestDoorNormal *
 *  (PlayerController.radius + 0.1f)`: the indoor arm stands its
 *  watchmen one player-radius clear of the door plane, the same
 *  clearance PositionPlayerToDungeonExit uses (enterExit's
 *  DUNGEON_EXIT_OFFSET is the identical number from the identical
 *  expression, for a different law). */
export const GUARD_INDOOR_DOOR_OFFSET = CAPSULE_RADIUS + 0.1;   // 0.45

export function createCityGuards({ renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, onPlayerHurt, currentMinute, rand = Math.random, say = null,
  hitEffects = null,   // AUDIT 24 (wave 39): the host's one blood/effect pool
  // GameObjectHelper.CreateEnemyCorpseMarker (:836-839) hands an
  // OUTSIDE corpse to StreamingWorld.TrackLooseObject, which stamps it
  // with the streamer's CURRENT map pixel (:462-476). exteriorFoes
  // carries the same dep and the same default: a host with no streamed
  // pixels never collects, which is a pixel that never leaves range.
  currentPixelKey = () => null,
  // ROAD-B B4: PlayerEnterExit's entry latches, for SpawnCityGuards'
  // OUTER gate (IsPlayerInsideDungeon, PlayerEntity.cs:625) and its
  // INDOOR arm (PlayerEntity.cs:628-641). Handed in raw -
  // { isPlayerInsideDungeon, isPlayerInside, insideOpenShop,
  // insideTavern, insideResidence } - so the conjunction stays in this
  // file with the rest of the law. A host with no interiors and no
  // dungeons (the standalone exterior) answers null, which is that
  // host's flags all false.
  enterExitFlags = () => null,
  playerWeaponSheathed = () => false }) {   // AUDIT 24 (wave 42): CalculateEnemyPacification's -25 / +10 arm
  // AUDIT 23 (hosts-3): currentMinute is REQUIRED - the () => 0 default
  // let a guard's poisoned hit anchor at minute 0, and the next world
  // tick (absolute clock ~523,530) caught the whole course up at once.
  if (typeof currentMinute !== 'function') throw new Error('createCityGuards needs currentMinute (the classic-minute clock)');
  const guards = [];       // { mobile, ai, attack, entity, batch, tex, archive, dead, sounds }
  const corpseBatches = [];
  // AUDIT-39r / THE FOUR HOSTS RULE: an IN-FLIGHT spawn's feet, the
  // encounter pool's list to the line (exteriorFoes.js). spawnGuardAt
  // crosses two real awaits (CLASS18.CFG on the first watchman of the
  // session, then a cold texture archive) before its record joins
  // `guards`, and offsetAll can only shift what the pool already
  // holds - so a recenter inside that window left the new guard a map
  // pixel (819.2) from the crime. `feet` is repointed at the AI's own
  // array as soon as there is one, because EnemyAI COPIES the
  // position it is handed.
  const spawning = [];     // { feet }
  // AUDIT-39r: THE SWEEP'S EPOCH - clearLive's other half. Emptying
  // `guards`/`corpseBatches` cannot reach a spawn or a corpse mint
  // still crossing its awaits; that work resolves after the sweep and
  // pushes a departure-world record into the destination. DFU
  // instantiates synchronously and has no such window. Everything
  // that lands late compares its starting epoch against this.
  let epoch = 0;
  let _career = null;      // CLASS18.CFG, fetched once
  let countdown = 0;       // guardsArriveCountdown (seconds)
  // PlayerEntity.cs:741 - `guardsArriveCountdownLocation = dfLocation;`
  // "Also track location so guards don't appear if player leaves during
  // countdown". The host's streamed pixel IS the port's location handle
  // (a location occupies one map pixel); a host that streams nothing
  // answers null on both reads, which is one unchanging location.
  let countdownLocation = null;
  let _nextGuardId = 0;    // the corpse's stable loot key (droppedLoot's _nextId shape)
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
  async function spawnGuardAt(pos, yaw, attackerFeet = null) {
    const basics = ENEMY_BASICS[GUARD_MOBILE_TYPE];
    const pending = { feet: [pos[0], pos[1] + 0.1, pos[2]] };   // AUDIT-39r: shifted by offsetAll until the record lands
    spawning.push(pending);
    const gen = epoch;   // AUDIT-39r: the world this guard is being posted to
    try {
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
      addEnemyLootExtras(entity.items, basics, rand);   // AUDIT 24 (wave 43): EnemyEntity.cs:388-397
      const ai = new EnemyAI(collider, pending.feet, yaw, {
        liveSpeed: () => liveStat(entity, 'speed'),   // AUDIT 39: EnemyMotor.cs:432 re-reads LiveSpeed per FixedUpdate
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
        playerInside: false,   // AUDIT 23 (characters-7): EnemySenses.cs:269 - exterior despawn band
        // wave 35: DoRangedAttack's band. Knight_CityWatch has
        // HasRangedAttack1 = false and CastsMagic = false
        // (EnemyBasics.cs:2197-2212), which is why attack.rangedAttack
        // below is the literal `false` and not a computed value - so the
        // stand-off can never engage for the watch. Passed rather than
        // defaulted, beside the same literal, so the two stay together if
        // the table ever changes.
        hasBowAttack: false,
        canCastRangedSpell: () => hasRangedSpell(entity),
      });
      pending.feet = ai.feet;   // AUDIT-39r: the AI's copy is the live array from here
      // MakeEnemyHostileToAttacker + GiveUpTimer *= 3, verbatim: a
      // crime-responding guard pursues without having seen the player.
      ai.makeHostileToPlayer(600, attackerFeet);   // wave 36: MakeEnemyHostileToAttacker seeds the remembered position too
      const attack = new EnemyAttack({ liveSpeed: () => liveStat(entity, 'speed'), playerLevel: playerEntity.level, reflexes: playerEntity.reflexes });   // AUDIT 39: EnemyAttack.cs:69-72, ditto
      // EnemyMotor.cs:131-137 computes hasBowAttack from the MobileEnemy
      // FLAGS, and EnemyBasics.cs:2197-2212 gives Knight_CityWatch
      // HasRangedAttack1 = false / CastsMagic = false - so DFU's
      // predicate is FALSE here and this literal IS the verbatim value,
      // not an interim. (Checked in AUDIT 18: the routed claim that 146
      // carries HasRangedAttack1 does not hold against the table.)
      attack.rangedAttack = false;
      const archive = basics.maleTexture;
      const tex = await getTexture(archive);
      // AUDIT-39r: a sweep crossed this spawn - the town it was posted
      // to is gone, and pushing it now would land a departure-point
      // watchman in the destination beside restoreWorld's copies.
      // Nothing is allocated yet, so dropping the record is the whole
      // cancel; both callers already read a missing guard as no spawn.
      if (gen !== epoch) return null;
      const mobile = new MobileUnit(GUARD_MOBILE_TYPE, basics, (rec) => tex.getFrameCount(rec), Math.random, 'male');
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      const g = { id: _nextGuardId++, mobile, ai, attack, entity, batch, tex, archive, mobileType: GUARD_MOBILE_TYPE, dead: false, _prevMState: 'Idle', _mout: null,
        sounds: new EnemySoundSource(GUARD_MOBILE_TYPE, rand),
        // MT-ii: THE CROSS-POOL DAMAGE DOOR. A striker resolves its
        // melee frame inside its OWN pool's loop, so the target's pool
        // has to expose its death chain on the record itself - the
        // candidate IS the handle both pools already share. `fromPlayer
        // = false`: a monster's blow is not the player's, so it levies
        // no Murder (DaggerfallEntityBehaviour.cs:203).
        hurtFromFoe: (dmg, dir) => damageGuard(g, dmg, null, dir ?? null, { fromPlayer: false }) };   // AUDIT 24 (wave 41)
      // A5: the CONCEALMENT closure the illusion gate has read since
      // MT-i and nothing ever built (the encounter pool's law, one
      // spelling). BlockedByIllusionEffect (EnemySenses.cs:658-683)
      // reads the TARGET's IsInvisible/IsBlending/IsAShade whether
      // that target is the player or another enemy, and
      // ConcealmentEffect writes the flag entity-blind (:63) - so a
      // concealed watchman is concealed from the foe fighting it.
      Object.defineProperty(g, 'concealment', { value: () => concealmentFlags(g.entity), enumerable: false });
      guards.push(g);
      return g;   // AUDIT 26 F217: the restore overlays the record it minted - two interleaved async spawns make `guards[length-1]` a race
    } finally {
      // The hand-off is synchronous with `guards.push`, so there is no
      // frame in which the spawn is in neither list.
      const i = spawning.indexOf(pending);
      if (i >= 0) spawning.splice(i, 1);
    }
  }

  /** The verbatim SpawnCityGuards law. pool = live persons as
   *  [{ pos, fwdYaw, guard, disable() }] in the SAME frame as
   *  playerFeet/playerFwd (the host converts).
   *
   *  ROAD-B: `interior` is the INDOOR arm's half of PlayerEnterExit
   *  (PlayerEntity.cs:628-642) - `{ doors, origin, eligible }`, where
   *  `eligible` is IsPlayerInside && (IsPlayerInsideOpenShop ||
   *  IsPlayerInsideTavern || IsPlayerInsideResidence), all three
   *  latched at the door as DFU latches them (PlayerActivate.cs
   *  :1120-1122). Absent (an above-ground host) the arm is skipped
   *  and the street law below runs, which is what being outside IS. */
  async function spawnCityGuards(immediate, { playerFeet, playerFwd, pool = [], interior = null }) {
    const _ee = enterExitFlags?.();
    // PlayerEntity.cs:625, the FIRST of the two terms that enclose the
    // WHOLE member: `if (!IsPlayerInsideDungeon && HowManyEnemiesOfType(
    // Knight_CityWatch, false, true) <= maxActiveGuardSpawns)`. The
    // indoor arm and both street arms live inside that one `if`, so
    // underground SpawnCityGuards does nothing from any caller - the
    // quest action `spawncityguards` included, which ticks in dungeon
    // mode. Without it that call fell through to the street law with an
    // empty pool and rang 2-5 watchmen onto the exterior collider at
    // the player's dungeon-local feet.
    if (_ee?.isPlayerInsideDungeon) return;
    if (activeCount() > MAX_ACTIVE_GUARD_SPAWNS) return;
    // PlayerEntity.cs:628-642, the FIRST thing inside the cap gate and
    // ahead of both street arms: the watch does not come down the road
    // when the crime happened in a shop, a tavern or someone's house -
    // it comes through that building's own front door, 2-5 of them,
    // all facing Vector3.forward. `immediate` is not read here at all:
    // the indoor arm is the same either way, and the RETURN is
    // unconditional - a building whose door query fails spawns
    // nothing and still does NOT fall through to the street.
    // ROAD-B (b2+b4 composed): PlayerEntity.cs:628-641's arm has two
    // halves and each pool carries the one it can state exactly. A pool
    // WITH interior-door reach (the mode machine's watch) spawns 2-5 at
    // the lowest outer door; the STREET pool, told by enterExitFlags
    // that the player is inside an open shop, tavern or residence,
    // returns and spawns nobody - the C# return is unconditional, and
    // the watch never comes through the wall.
    if (!interior?.eligible && _ee && _ee.isPlayerInside
        && (_ee.insideOpenShop || _ee.insideTavern || _ee.insideResidence)) {
      return;
    }
    if (interior?.eligible) {
      const door = findLowestOuterInteriorDoor(interior.doors, interior.origin);
      if (door) {
        const at = [
          door.pos[0] + door.normal[0] * GUARD_INDOOR_DOOR_OFFSET,
          door.pos[1] + door.normal[1] * GUARD_INDOOR_DOOR_OFFSET,
          door.pos[2] + door.normal[2] * GUARD_INDOOR_DOOR_OFFSET,
        ];
        const guardCount = 2 + Math.floor(rand() * 4);   // Random.Range(2, 6), int-exclusive
        for (let i = 0; i < guardCount; i++) {
          // SpawnCityGuard(lowestDoorPos, Vector3.forward): every one
          // of them at the SAME point, facing +Z. They stack in the
          // doorway and walk out of each other, which is classic.
          await spawnGuardAt([...at], 0, playerFeet ?? null);
        }
      }
      return;
    }
    if (immediate) {
      let spawned = 0;
      for (const p of pool) {
        const d = [p.pos[0] - playerFeet[0], p.pos[1] - playerFeet[1], p.pos[2] - playerFeet[2]];
        if (Math.hypot(...d) > GUARD_NPC_SPAWN_RANGE) continue;
        if (p.guard) {
          await spawnGuardAt(p.pos, p.fwdYaw, playerFeet ?? null);
          p.disable();   // classic disables the NPC the guard spawns from
          spawned++;
        } else if (angleDeg(d, playerFwd) >= GUARD_BEHIND_ANGLE && Math.floor(rand() * 4) === 0) {
          await spawnGuardAt(p.pos, p.fwdYaw, playerFeet ?? null);
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
          await spawnGuardAt([x, Number.isFinite(y) ? y : playerFeet[1], z], a + Math.PI, playerFeet ?? null);
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
        await spawnGuardAt(p.pos, p.fwdYaw, playerFeet ?? null);
        p.disable();
      }
    }
    // AUDIT 24 scenes: `Random.Range(5, 10 + 1)` is the INT overload -
    // one of {5,6,7,8,9,10}, never 7.3 and never short of 10.
    // PlayerEntity.cs:739-741: the location is stored WITH the
    // countdown, and the arrival below is gated on it.
    if (!seenByGuard && seen) { countdown = 5 + Math.floor(rand() * 6); countdownLocation = currentPixelKey(); }   // Random.Range(5, 11) seconds
  }

  /** GameManager.HowManyEnemiesOfType(Knight_CityWatch, ...) over THIS
   *  pool (:740-762). `includingPacified` false is the default and is
   *  two terms, not one: a watchman counts only while it is HOSTILE
   *  and not on the player's team - so a guard talked down by a
   *  Language skill, or one charmed onto the player's side, is not a
   *  watchman standing in the street as far as any caller is
   *  concerned. `stopLookingIfFound` is a short-circuit, not a
   *  different answer, so the port takes a boolean when that is what
   *  the caller wanted. */
  const anyWatchStanding = () => guards.some((g) =>
    !g.dead && g.ai?.isHostile && g.entity?.team !== 'PlayerAlly');

  /** PlayerEntity.MakeNPCGuardsIntoEnemiesIfGuardsSpawned
   *  (:764-789), verbatim: WHILE enemy watchmen are up, every
   *  wandering guard NPC in the location's population becomes one too
   *  - it is replaced by a real Knight_CityWatch at its own position
   *  and facing, and the mobile it came from is disabled, exactly as
   *  the witnessed-crime arm converts them.
   *
   *  There is NO range test and NO cap here (SpawnCityGuards' 77.5
   *  units and its maxActiveGuardSpawns are that method's, not this
   *  one's) and no `immediate` fork: once the watch is out, the whole
   *  town's guard population is the watch. That is what makes running
   *  from the guards in a city an escalating thing rather than a
   *  fixed fight, and it is why walking past a fresh patrol while
   *  wanted turns it hostile.
   *
   *  The gate is HowManyEnemiesOfType(Knight_CityWatch, true) > 0 -
   *  pacified and allied watchmen excluded, per the note above - so
   *  the conversion stops the moment the last hostile guard is dead,
   *  arrested away or talked down.
   *
   *  @param pool live persons as [{ pos, fwdYaw, guard, disable() }],
   *    the same shape the witness arm takes (the host converts). */
  async function makeNpcGuardsIntoEnemies({ pool = [], playerFeet = null } = {}) {
    if (!anyWatchStanding()) return 0;
    let made = 0;
    for (const p of pool) {
      if (!p.guard) continue;
      await spawnGuardAt(p.pos, p.fwdYaw, playerFeet ?? null);
      p.disable();   // "Classic disables the NPC that the guard is spawned from"
      made++;
    }
    return made;
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
   *  ever spawned. AUDIT 39: the RECORD goes too once nothing is left
   *  on it - the prune at the end of update(). What made that
   *  impossible was lootTargets keying corpses by their array INDEX;
   *  the key is the guard's own `id` now, so a splice cannot hand the
   *  player someone else's purse. */
  function releaseGuardBatch(g) {
    if (!g.batch) return;
    renderer.destroyBillboardBatch(g.batch);
    g.batch = null;
  }

  /** AUDIT 26 F035 + MT-ii: `fromPlayer` is this door's provenance
   *  flag, the hurtPlayer(bypassShield) idiom. DFU assigns the Murder
   *  crime inside HandleAttackFromSource's `sourceEntityBehaviour ==
   *  PlayerEntityBehaviour` gate (DaggerfallEntityBehaviour.cs:203,
   *  :265-269), and EnemyMotor.ApplyFallDamage calls DecreaseHealth
   *  and nothing else (:1398-1401) - so a watchman who dies falling
   *  while chasing must not brand the player a murderer for a kill
   *  they never made. Defaults TRUE: every player blow is unchanged.
   *
   *  TWO LANES FOUND THIS GATE INDEPENDENTLY, from opposite ends: the
   *  audit from the fall, and MT from infighting, where the stakes
   *  are higher still - the moment a spawned monster can kill a
   *  watchman, an ungated crime FRAMES THE PLAYER for a murder they
   *  did not commit, and the watch responds to that crime, so the
   *  town turns on them for a rat's work. */
  function damageGuard(g, damage, playerFeet, knockDir, { fromPlayer = true } = {}) {
    g.entity.health -= damage;
    if (g.entity.health <= 0) {
      g.dead = true;
      g.corpse = true;   // G3: only a KILLED guard is lootable (walk-aways vanish with their items)
      releaseGuardBatch(g);
      // EnemyDeath:131-136 - the clear gates on `senses.Target ==
      // PlayerEntityBehaviour`, which MT-ii makes observable.
      if (isPlayerTarget(g.ai?.target) && g.ai?.detected) setEnemyAlert(playerEntity, false);
      sayEnemyDied(say, GUARD_MOBILE_TYPE);   // EnemyDeath:79-83, the kill notice
      // G4 (HandleAttackFromSource, verbatim): killing the city watch
      // IS Murder, and CG2 landed the second half -
      // DaggerfallEntityBehaviour.cs:267's
      // TallyCrimeGuildRequirements(false, 1). A guard is worth ONE to
      // the Dark Brotherhood where a civilian is worth five: the
      // Brotherhood is unimpressed by killing the watch, which is
      // usually self-defence. F035/MT-ii: and only when the PLAYER is
      // the source - the whole block is inside DFU's player gate.
      if (fromPlayer) {
        setCrimeCommitted(playerEntity, CRIME_MURDER);   // V4: through the one setter (SuppressCrime)
        tallyCrimeGuildRequirements(playerEntity, false, 1);
      }
      // AUDIT 24 (wave 38): EnemyDeath.CompleteDeath, through the one
      // home (this was the second copy of exteriorFoes' mint, to the
      // line). It gains FindGroundPosition (:817) - the watch walks, so
      // the ground is usually its feet, but a guard killed on a stair
      // or a rooftop no longer leaves its body on the slope - and
      // BodyFall (:126-129), which no pool in the port ever played.
      // TrackLooseObject runs INSIDE CreateEnemyCorpseMarker, so the
      // pixel is read at the death, not when the texture lands.
      const _corpsePixel = currentPixelKey();
      const _corpseGen = epoch;   // AUDIT-39r: the world this body falls in
      mintCorpseMarker({
        renderer, getTexture, uploadRecordFrame, collider,
        corpseTexture: ENEMY_BASICS[GUARD_MOBILE_TYPE].corpseTexture,
        feet: g.ai.feet,
        fallbackSize: scaledBillboardSize(g.tex.getSize(0), g.tex.getScale(0)),
        stillDead: () => g.dead,
      }).then((c) => {
        if (!c) return;
        // AUDIT-39r: the sweep took this pool's world while the marker
        // was still loading its art. `stillDead` cannot catch it - the
        // guard stays dead - and the batch would be stamped with the
        // departure pixel, already torn down, so collectPixel could
        // never free it and batches() would draw it at the old
        // position for the rest of the session.
        if (_corpseGen !== epoch) { renderer.destroyBillboardBatch(c.batch); return; }
        g.corpseMarker = c;
        // TrackLooseObject's stamp: the streamer's pixel at the death.
        c.pixelKey = g.corpsePixelKey = _corpsePixel;
        corpseBatches.push(c);
        playBodyFall(audio, c.pos);
      }).catch(() => {});
      return;
    }
    // C15 knockback: the watch is a CLASS enemy (Knight_CityWatch) and
    // every class row leaves MobileEnemy.Weight at 0, so only the first
    // arm of WeaponManager's gate can ever fire here - it re-knocks
    // once the current shove decays under the threshold. Written
    // through the shared gate anyway (AUDIT 24 wave 38): the pool
    // should not be the place that remembers which arm applies to it.
    const guardWeight = ENEMY_BASICS[GUARD_MOBILE_TYPE]?.weight ?? 0;
    if (knockDir && weaponKnockbackApplies(g.ai.knockbackSpeed, true, guardWeight)) {
      // EW1: a guard is the one foe whose kit is never empty - the
      // watch spawns armed and armoured, so this is the call site
      // where the missing item term moved the answer most.
      const w = enemyWeightClassicUnits(true, 'male', guardWeight, g.entity?.items);
      g.ai.knockbackSpeed = weaponKnockbackSpeed(damage, w);
      g.ai.knockbackDir = [knockDir[0], knockDir[1], knockDir[2]];
    }
  }

  /** MT-ii: this guard's armed senses context - the twin of the
   *  encounter pool's. Unarmed (no `candidates` in the context) it
   *  hands the object straight back and the watch stays player-only,
   *  which is what exterior.js's guard-only host wants anyway. */
  function _armed(g, senses) {
    if (!senses?.candidates) return senses;
    return {
      ...senses,
      targeting: (ai, pf, cdt) => runTargetMachine(g, senses.candidates(), pf, cdt, {
        playerEntity: senses.playerEntity ?? null,
      }),
    };
  }
  const _targetFeet = (g, playerFeet) => {
    const t = g.ai.target;
    if (t == null) return g.ai._armedTargeting ? null : playerFeet;
    return isPlayerTarget(t) ? playerFeet : t.ai.feet;
  };

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
    //
    // The count is HowManyEnemiesOfType(Knight_CityWatch, true) - the
    // positional `true` is stopLookingIfFound, and `includingPacified`
    // keeps its default FALSE (GameManager.cs:740/752), so a watchman
    // talked down by Etiquette/Streetwise or charmed onto team
    // PlayerAlly is NOT counted and the flag clears with him standing.
    // That is `anyWatchStanding` above, this member's one spelling of
    // the predicate; a bare liveness test held the flag raised through
    // the rest of an active crime and swallowed the next surrender box.
    if (playerEntity.haveShownSurrenderDialogue && !anyWatchStanding()) {
      playerEntity.haveShownSurrenderDialogue = false;
    }
    if (countdown > 0) {
      countdown -= dt;
      // PlayerEntity.cs:355-359 verbatim: the arrival is gated on
      // `guardsArriveCountdownLocation == CurrentPlayerLocationObject`.
      // A player who left the location inside the 5-10 second window is
      // not ambushed by a ring of watchmen in the wilderness - and the
      // countdown is spent either way, exactly as DFU spends it.
      if (countdown <= 0 && currentPixelKey() === countdownLocation) {
        spawnCityGuards(true, { playerFeet, playerFwd: [0, 0, 1], pool: [] });   // arrivals ride the ring fallback
      }
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
      applyEnemyMotorEffectFlags(g.ai, g.entity);   // A5: Levitate.SetEnemyMotor's IsLevitating, folded from the effect's presence
      g.ai.update(dt, playerFeet, _armed(g, senses), _gParalyzed);
      const _tgt = _targetFeet(g, playerFeet);   // MT-ii: whatever it SELECTED
      // AUDIT 24 (wave 36): EnemySenses.cs:531-535 - ANY enemy that is
      // targeting and seeing the player raises the alert, as the last
      // statement of FixedUpdate at method-body indent, not inside a
      // conditional. The watch is an ordinary EnemyClass entity and
      // MakeEnemyHostileToAttacker (PlayerEntity.cs:755) clears the one
      // gate in GetTargets that would exclude it. This pool never
      // touched the flag, while exteriorFoes has raised it since the
      // X-slice - so the alert the watch should raise never armed the
      // dungeon spawn roll, and one it inherited never cleared.
      // MT-ii: and the source's `Target == PlayerEntityBehaviour` term
      // with it (:531) - a watchman trading blows with a rat must not
      // hold the player's alert state up.
      if (isPlayerTarget(g.ai.target) && g.ai.inSight && g.ai.detected) setEnemyAlert(playerEntity, true, currentMinute());
      // CH3 (characters-8): a past-threshold landing bills the fall
      // formula through the pool's damage door. EnemyMotor.ApplyFallDamage
      // (:173, :1384-1418) runs unconditionally for every enemy and the
      // motor has always produced landedFall for guards too - the value
      // was simply read by nobody, and discarded.
      if (g.ai.landedFall > 0 && !g.dead) {
        const gdmg = Math.trunc(FALL_HP_PER_METRE * (g.ai.landedFall - FALL_DAMAGE_THRESHOLD));
        g.ai.landedFall = 0;
        if (gdmg > 0) {
          audio?.play3d?.(SOUND.FallDamage, [g.ai.feet[0], g.ai.feet[1], g.ai.feet[2]], 1, { maxDistance: 16 });
          // AUDIT 26 F040: EnemyMotor.cs:1403-1407 splashes on EVERY
          // enemy fall past the threshold - index 0, at the position
          // DFU passes (the feet, as the sibling pool notes). This arm
          // billed the damage and played the clip but never bled,
          // where exteriorFoes has splashed since CH3.
          hitEffects?.showBloodSplash(0, [g.ai.feet[0], g.ai.feet[1], g.ai.feet[2]]);
          damageGuard(g, gdmg, null, null, { fromPlayer: false });   // F035: ApplyFallDamage carries no crime
          if (g.dead) continue;
        }
      }
      // AUDIT 24 (wave 42): the watch is a CLASS enemy, so its tongue
      // is Etiquette (or Streetwise for the stealth careers) - which
      // means a courteous player can stand a guard down on sight, and
      // could not before because only the dungeon ran the roll.
      tryLanguagePacification(g.ai, g.entity, GUARD_MOBILE_TYPE, playerEntity, {
        sheathed: playerWeaponSheathed(),
        enemyLanguageSkill, calculateEnemyPacification,
        say: say ?? (() => {}),
      });
      // AUDIT 24 (wave 41): EnemySounds.FixedUpdate. This used to be a
      // single HALT on the detection rising edge and nothing ever
      // again - DFU has no detection-edge bark at all. It runs the
      // 3-9 second attract cadence for as long as the watchman is
      // within 16m, and the watch is the ONE class enemy the human
      // mute spares (:222), which is why you hear it and not a
      // brigand.
      tickEnemySound(g.sounds, g.ai.feet, playerFeet, dt, { audio, collider, hearing: acuteHearingMultiplier(playerEntity) });
      g.mobile.frameSpeedDivisor = Math.max(1, Math.trunc((g.entity.stats?.speed ?? 50) / Math.max(8, liveStat(g.entity, 'speed'))));   // AUDIT 23 (characters-11)
      const events = (_gParalyzed || !_tgt) ? [] : g.attack.update(dt, g.ai, _tgt);   // MT-ii: at the SELECTED target
      void events;
      const mstate = g.attack.machine.state;
      const strikeEdge = mstate !== 'Idle' && (g._prevMState ?? 'Idle') === 'Idle';
      g._prevMState = mstate;
      if (strikeEdge) playEnemyClip(audio, g.sounds.attack(), g.ai.feet, acuteHearingMultiplier(playerEntity));   // AUDIT 24 (wave 41); CF1: acute hearing
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
      if (!_gParalyzed && g.mobile.doMeleeDamage && _tgt) {
        g.mobile.doMeleeDamage = false;
        // MT-ii: MeleeDamage's two-arm split (EnemyAttack.cs:199-209).
        // The watch fighting a monster is the whole point of the
        // CityWatch team; everything below is the player arm.
        const _foeTarget = g.ai._armedTargeting && g.ai.target && !isPlayerTarget(g.ai.target)
          ? g.ai.target : null;
        if (_foeTarget) {
          const fdx = _tgt[0] - g.ai.feet[0], fdz = _tgt[2] - g.ai.feet[2];
          const fwpn = chooseEnemyWeapon(g.entity.weapon, ENEMY_BASICS[GUARD_MOBILE_TYPE]);
          const ffwd = [Math.sin(g.ai.yaw), 0, Math.cos(g.ai.yaw)];   // transform.forward (:208)
          if (meleeHitConnects(g.ai._dist, g.ai.inSight, withinYaw(g.ai.yaw, fdx, fdz, MELEE_HIT_YAW_DEG))) {
            applyDamageToNonPlayer(g, _foeTarget, {
              weapon: fwpn, direction: ffwd, rolls: Math.random,
              calculateAttackDamage,
              dealDamage: (t, d) => t.hurtFromFoe?.(d, ffwd),
              audio, hitEffects,
            });
          } else {
            audio?.play3d?.(enemyMissSound(fwpn), [g.ai.feet[0], g.ai.feet[1] + 0.9, g.ai.feet[2]], 1, { maxDistance: 16 });
          }
          const gv = enemyAttackVoice(g);   // :216-226 fires whatever the target
          if (gv && gv.clip >= 0) audio?.play3d?.(gv.clip, [g.ai.feet[0], g.ai.feet[1] + 0.9, g.ai.feet[2]], 1, { maxDistance: 16 });
          continue;
        }
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
          // AUDIT 24 (wave 39): EnemyAttack.cs:406 -
          // `PlayerObject.SendMessage("RemoveHealth", damage)` - which
          // is ShowPlayerDamage.Flash's trigger. An enemy's BLOW
          // flashes the screen; the poison it carries does not.
          if (dmg > 0) { onPlayerHurt?.(dmg, wpn); flashPlayerDamage(); }   // G2: the host's arrest interception rides this
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
      // A5 - EntityConcealmentBehaviour.Update/MakeConcealed (:36-43,
      // :56-62): a NON-PLAYER entity whose IsMagicallyConcealed is
      // true has its renderer disabled. The watchman keeps acting; it
      // is simply not drawn.
      if (isMagicallyConcealed(g.entity)) continue;
      const o = g._mout;
      const rkey = `${o.record}#${o.frame}`;
      if (!renderer.textures.has(`${g.archive}_${rkey}`)) uploadRecordFrame(g.archive, o.record, o.frame);
      const sz = scaledBillboardSize(g.tex.getSize(o.record), g.tex.getScale(o.record));
      g.batch.record = rkey;
      g.batch.size = { w: o.flip ? -sz.w : sz.w, h: sz.h };
      g.batch.origin = g.ai.feet;
      out.push(g.batch);
    }
    // AUDIT 39: THE PRUNE, on the encounter pool's schedule
    // (exteriorFoes.js). A guard with no corpse left on it - the
    // walk-away when the crime clears, and the killed body whose
    // pixel collectPixel has taken - is DFU's
    // `GameObject.Destroy(sender.gameObject)` (EnemyEntity.cs:184-191),
    // and every per-frame walk over `guards` paid for it for the rest
    // of the session. A KILLED body stays while its corpse does, which
    // is what DFU keeps too (EnemyDeath disables, never destroys).
    for (let i = guards.length - 1; i >= 0; i--) if (guards[i].dead && !guards[i].corpse) guards.splice(i, 1);
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
    { const v = lycanthropeAttackVoice(playerEntity, rand); if (v != null) audio?.playOneShot?.(v, 1); }   // V4: OnWeaponHitEntity's transformed voice (10% attack / 20% bark)
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
        // WeaponManager.cs:569-573, beside the hit sound (see the note
        // in exteriorFoes: no raycast impact point here, so the body
        // centre stands in - DFU's own no-raycast formula).
        hitEffects?.showBloodSplash(ENEMY_BASICS[GUARD_MOBILE_TYPE]?.bloodIndex ?? 0,
          bloodCentre(foe.ai.feet, foe.ai.height));
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
    // WeaponManager.cs:419-436: a connecting swing tallies the weapon
    // skill AND CriticalStrike.
    //
    // AUDIT 24 (wave 42): the FATIGUE drain that used to sit here was
    // a SECOND one. DFU charges swingWeaponFatigueLoss exactly once
    // per swing, at :420, inside WeaponManager's single
    // `isDamageFinished` block - it is a property of swinging, not of
    // what you swung at. Both exterior hosts already drain it in their
    // melee arm before calling this, and the early `if (!live.length)
    // return false` above meant the extra charge landed only while a
    // guard was ALIVE: 22 fatigue a swing near the watch, 11
    // everywhere else. The dungeon never had it, which is what the
    // shape should have been all along.
    if (any) tallySwingSkills(playerEntity, playerWeapon.weapon);
    return any;
  }

  // G4: the weapon strike against WANDERING townsfolk (WeaponManager's
  // mobile-NPC branch, verbatim): a CIVILIAN dies to one hit - the
  // motor disables, TallyCrimeGuildRequirements(false, 5) (CG2),
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
      // WeaponManager.cs:504-508 - murdering a wandering civilian
      // splashes record 0, NOT a BloodIndex: a MobilePersonNPC has no
      // MobileEnemy to read one from. And this is the ONE port site
      // that has DFU's actual impactPosition - the ray already found
      // the person at bestD.
      hitEffects?.showBloodSplash(0,
        [eye[0] + lookDir[0] * bestD, eye[1] + lookDir[1] * bestD, eye[2] + lookDir[2] * bestD]);
      best.disable();   // one weapon hit kills a civilian (SetActive(false))
      setCrimeCommitted(playerEntity, CRIME_MURDER);   // V4: through the one setter (SuppressCrime)
      // CG2: WeaponManager.cs:510's TallyCrimeGuildRequirements(false,
      // 5) - the murdered civilian, worth FIVE to the Dark
      // Brotherhood against a guard's one. Three such killings arm the
      // invitation where it takes fifteen dead watchmen.
      tallyCrimeGuildRequirements(playerEntity, false, 5);
      onMurder();       // SpawnCityGuards(true)
      return { crime: 'murder' };
    }
    setCrimeCommitted(playerEntity, CRIME_ASSAULT);   // V4: through the one setter (SuppressCrime)
    await spawnGuardAt(best.pos, best.fwdYaw, playerFeet ?? null);
    best.disable();
    const carriedHit = resolvePlayerHit(playerWeapon, eye, lookDir, playerFeet, inViewFn ?? _lastInView, onHitSound);
    return { crime: 'assault', carriedHit };
  }

  // G3: corpse loot on the dungeon's S2 pickup shape - killed guards
  // with items are activation targets for the hosts' E ray; takeLoot
  // transfers into the player entity (the corpse billboard stays, as
  // dungeon corpses do; 'You take N items.' - TEXT.RSC pends with the
  // dungeon's).
  // AUDIT 24 (wave 38): the same seam as exteriorFoes now, in
  // corpseMarker.js. Two corrections came with the fold: an EMPTY body
  // is still a target (DFU tells you it has no treasure and only THEN
  // disables the container, :942-947 - this skipped it silently), and
  // a body holding nothing but arrows is collected whole (:948-952),
  // which is the ordinary outcome of killing a guard with a bow.
  function lootTargets() {
    return corpseLootTargets(guards, 'guardCorpse', {
      isCorpse: (g) => !!g.corpse && !!g.entity,
      feetOf: (g) => g.corpseMarker?.pos ?? g.ai?.feet ?? null,
      idOf: (g) => g.id,   // AUDIT 39: stable across the walk-away prune, where an index is not
    });
  }
  function takeLoot(key, say2 = () => {}) {
    const id = Number(key.split(':')[1]);
    return takeCorpseLoot(guards.find((g) => g.id === id), playerEntity, say2);
  }

  /** CollectLooseObjects (StreamingWorld.cs:1040-1052), the corpse
   *  half - exteriorFoes' twin, and the same law droppedLoot.
   *  collectPixel already carried for player-dropped piles: a tracked
   *  loose object whose map pixel leaves the streamed range is
   *  DESTROYED, and ClearStreamingWorld (:993, from InitWorld :584)
   *  collects every one of them, which is what a teleport and a fast
   *  travel do. Nothing removed a corpse batch before, so the watch's
   *  dead grew a VAO and two GL buffers per kill for the session.
   *
   *  Clearing `corpse` is the whole destroy: batches() stops drawing
   *  it, lootTargets stops probing it, and update()'s prune takes the
   *  record itself on the next frame. */
  function collectPixel(pixelKey) {
    for (let i = corpseBatches.length - 1; i >= 0; i--) {
      if (corpseBatches[i].pixelKey !== pixelKey) continue;
      renderer.destroyBillboardBatch(corpseBatches[i].batch);
      corpseBatches.splice(i, 1);
    }
    for (const g of guards) {
      if (!g.corpse || g.corpsePixelKey !== pixelKey) continue;
      g.corpse = false;
      g.corpseMarker = null;
    }
  }

  /** AUDIT 39: CleanupUntrackedObjects (StreamingWorld.cs:1624-1635),
   *  which a teleport reaches too through ClearStreamingWorld ->
   *  CollectLooseObjects(true) (:993-998) - loose enemies survive
   *  neither a load nor a fast travel. collectPixel above frees only
   *  CORPSES, so a quickload mid-pursuit re-minted the save's watch on
   *  top of the live one and the player was hunted by two of it.
   *  Emptying `guards` is safe HERE where a splice is not: the index
   *  keys lootTargets hands out are read back the same frame, and
   *  nothing survives the teleport to read a stale one. */
  function clearLive() {
    // AUDIT-39r: the epoch turns FIRST, so anything already in flight
    // (a spawn between its two awaits, a corpse marker waiting on its
    // texture) resolves into a world it can see it does not belong to.
    epoch++;
    for (const g of guards) releaseGuardBatch(g);
    for (const c of corpseBatches) renderer.destroyBillboardBatch(c.batch);
    corpseBatches.length = 0;
    guards.length = 0;
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
    // AUDIT-39r: the spawns still crossing their awaits move too - the
    // encounter pool's law, and this pool is recentred from the same
    // host frame (world.js's cityGuards/exteriorFoes offsetAll pair).
    for (const s of spawning) { s.feet[0] += dx; s.feet[1] += dy; s.feet[2] += dz; }
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

  /** AUDIT 26 F217: the watch's half of the SAVE ENVELOPE - the same
   *  law as the encounter pool's (exteriorFoes.js snapshotWorld):
   *  natives in, dead guards out. A quickload during a pursuit
   *  despawned the whole watch - a free escape from any crime. */
  function snapshotWorld(toNative) {
    return guards.filter((g) => !g.dead).map((g) => {
      const wc = toNative(g.ai.feet);
      return {
        nativeX: wc.x, nativeZ: wc.z, y: g.ai.feet[1], yaw: g.ai.yaw,
        health: g.entity.health, maxHealth: g.entity.maxHealth,
        magicka: g.entity.magicka ?? 0, fatigue: g.entity.fatigue ?? 0,
        items: (g.entity.items ?? []).map((it) => ({ ...it })),
        activeEffects: (g.entity.activeEffects ?? []).map(copyEffectEntry),
        hostile: g.ai.isHostile !== false,
      };
    });
  }
  function restoreWorld(saved, fromNative, yOffset = 0) {
    for (const sg of saved ?? []) {
      const [lx, lz] = fromNative(sg.nativeX, sg.nativeZ);
      spawnGuardAt([lx, sg.y + yOffset, lz], sg.yaw ?? 0, null).then((g) => {
        if (!g) return;
        g.entity.maxHealth = sg.maxHealth ?? g.entity.maxHealth;
        g.entity.health = Math.min(sg.health ?? g.entity.health, g.entity.maxHealth);
        if (sg.magicka != null) g.entity.magicka = sg.magicka;
        if (sg.fatigue != null) g.entity.fatigue = sg.fatigue;
        if (sg.items) g.entity.items = sg.items.map((it) => ({ ...it }));
        if (sg.activeEffects) g.entity.activeEffects = sg.activeEffects.map((a) => ({ ...a }));
        // spawnGuardAt seeds the crime pursuit (makeHostileToPlayer);
        // a restored PEACEFUL guard stands down.
        if (sg.hostile === false) g.ai.isHostile = false;
      }).catch((e) => console.error('[guards] restore failed:', e?.message ?? e));
    }
  }
  return { guards, spawnCityGuards, makeNpcGuardsIntoEnemies, anyWatchStanding, update, offsetAll, collectPixel, clearLive, resolvePlayerHit, resolveCivilianHit, activeCount, lootTargets, takeLoot, snapshotWorld, restoreWorld,
    // M2 (spellcasting above ground): the player's spell damage rides
    // THE SAME door the melee swing uses - corpse, Murder on the kill,
    // hostility - so a fireball is not a free crime channel.
    // AUDIT-39r: and the PLAYER's ARROW carries a direction. C15's
    // knockback block is wholly gated on knockDir, so the spell-shaped
    // null this door was written for meant a shaft could never shove a
    // watchman - while the melee swing (lookDir), an ENEMY's arrow
    // (hurtFromFoe) and the same shaft on an encounter foe all did.
    // WeaponManager.cs:576-595 sets KnockbackDirection = direction
    // inside `if (damage > 0)` for every EnemyClass hit, and
    // DaggerfallMissile.cs:681-687 hands the arrow's forward in as that
    // direction - Knight_CityWatch is EnemyClass, so the first arm
    // fires. A caller with no direction (a spell) still passes none.
    hurtGuard: (g, dmg, playerFeet, knockDir = null) => damageGuard(g, dmg, playerFeet, knockDir),
    _damage: (i, dmg) => { const g = guards[i]; if (g && !g.dead) damageGuard(g, dmg, [0, 0, 0], null); },   // probe/test seam through the REAL death path
    _debug: () => guards.map((g) => ({ dead: g.dead, hp: g.entity.health, pos: g.ai.feet.map((v) => +v.toFixed(1)), detected: g.ai.detected, state: g.attack.machine.state, moving: g.ai.moving, dist: +(g.ai._dist ?? -1).toFixed(1), giveUp: g.ai.giveUpTimer })) };
}
