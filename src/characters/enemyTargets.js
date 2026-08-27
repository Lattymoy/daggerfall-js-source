// MT-i - THE TARGET-SELECTION HALF of EnemySenses (MIT, Daggerfall
// Workshop): MobileTeams, GetTargets' priority walk, and the classic
// target machine (EnemySenses.Update:312-414) that the motor's own
// header promised ("constants stay exported for E3 multi-target" -
// SENSES_INTERVAL_UNITS sat exported and unconsumed since C8).
//
// The port's EnemyAI stays single-target in SHAPE - one target, one
// destination - exactly as DFU's senses hold ONE Target field. What
// this module adds is the SELECTION: who that target is, re-evaluated
// on the classic system timer over a host-provided candidate list.
// THE SEAM (headless charter): the machine arms only when the host's
// senses context carries a `targeting` closure; without it every existing
// caller keeps the player-only path unchanged, which is also DFU's
// exact behavior with no other enemy in range.
//
// A CANDIDATE is one foe's stable descriptor, shared by every AI in
// the pool and BY the pool (self walks its own list, skipped by
// identity as :768 skips entityBehaviour):
//   { ai, entity, mobileType?, isQuestFoe?, questAttackable?,
//     concealment?(), stealthOf?() }
// feet/hostility read live off ai, team/suppressInfighting off entity
// - the same split as DFU's motor/entity components. The PLAYER is
// the module's own sentinel, appended the way GetActiveTarget-
// EntityBehaviours yields the player after the enemies (:748).

import { canSeeTarget, SYSTEM_TIMER_UPDATES_DIVISOR, SENSES_INTERVAL_UNITS } from './enemyMotor.js';
import { getBool } from '../systems/settings.js';
import { ENEMY_BASICS } from './enemyBasics.js';   // the STATIC table the ally revert reads

/** MobileTeams (DaggerfallUnityEnums.cs:262-286), index = enum value.
 *  EnemyEntity.team already carries these as STRINGS (enemyBasics'
 *  rows); the array is the number<->name door ChangeFoeTeam's numeric
 *  spelling needs. */
export const MOBILE_TEAMS = Object.freeze([
  'PlayerEnemy', 'PlayerAlly', 'Vermin', 'Spriggans', 'Bears', 'Tigers',
  'Spiders', 'Orcs', 'Centaurs', 'Werecreatures', 'Nymphs', 'Aquatic',
  'Harpies', 'Undead', 'Giants', 'Scorpions', 'Magic', 'Daedra',
  'Dragonlings', 'KnightsAndMages', 'Criminals', 'CityWatch',
]);

/** DaggerfallUnity.Settings.EnemyInfighting - live at the point of
 *  use, the CombatVoices idiom. Ships True. */
export const enemyInfightingEnabled = () => getBool('Enhancements', 'EnemyInfighting');

/** The player's sentinel candidate - one identity so `target ===
 *  PLAYER_TARGET` is DFU's `target == player` reference compare. */
export const PLAYER_TARGET = Object.freeze({ isPlayer: true });
export const isPlayerTarget = (c) => c === PLAYER_TARGET || c?.isPlayer === true;

/**
 * `MobileEnemy.Team` - the per-instance STRUCT COPY's team, which
 * GetTargets' :776 and :801 arms read. Not the live Entity.Team
 * (ChangeFoeTeam's field) and NOT the static table either: an allied
 * summon overwrites this copy alone (SetupDemoEnemy.cs:85-86).
 * makeEnemyEntity seeds it from the row; a caller with no entity at
 * all reads PlayerEnemy, the enum's zero member.
 */
export const mobileTeamOf = (entity) => entity?.mobileTeam ?? entity?.basics?.team ?? 'PlayerEnemy';

/**
 * The STATIC row's team - `EnemyBasics.Enemies.First(x => x.ID == id)
 * .Team`, which is the ONLY thing MakeEnemyHostileToAttacker's revert
 * reads (:211). It is deliberately NOT mobileTeamOf: a struck ally
 * must fall back to what its species is, not to the PlayerAlly the
 * summon wrote over its copy.
 */
export const staticTeamOf = (mobileType) => ENEMY_BASICS[mobileType]?.team ?? 'PlayerEnemy';

/** GetTargets' priority arithmetic (:829-841): +5 when the candidate
 *  is not already targeting someone, +10 when seen, plus the distance
 *  band 30 - d floored at 0. */
export function targetPriority(targetHasNoTarget, seen, distance) {
  let p = 0;
  if (targetHasNoTarget) p += 5;
  if (seen) p += 10;
  p += Math.max(0, 30 - distance);
  return p;
}

/**
 * EnemySenses.GetTargets (:752-878), the classic path. Walks the
 * candidates (self included - skipped by identity, :768) plus the
 * player, applies the team/ally/quest gates verbatim, and returns
 * { target, targetInSight, distanceToTarget } for the winner (the
 * holder-restore law: distance belongs to the SELECTED target,
 * :860-862). secondaryTarget's write is Enhanced-only (:867-872) and
 * stays out; sawSelectedTarget rides out as targetInSight (:866).
 *
 * TWO TEAM READS, kept apart as C# keeps them: :776 and :801 read
 * `MobileEnemy.Team` - the per-instance struct copy (mobileTeamOf) -
 * where :784, :792 and :796 read the LIVE `Entity.Team`
 * (entity.team, what ChangeFoeTeam rewrites). A quest-retargeted
 * ally still passes the :801 else-arm on its MOBILE team; that
 * asymmetry is the source's, not a slip here.
 */
export function getTargets(self, candidates, playerFeet, {
  noTargetMode = false,
  infighting = enemyInfightingEnabled(),
} = {}) {
  const ai = self.ai;
  const selfTeam = self.entity?.team ?? 'PlayerEnemy';
  const selfMobileTeam = mobileTeamOf(self.entity);
  let highestPriorityTarget = null;
  let highestPriority = -1;
  let secondHighestPriority = -1;
  let sawSelectedTarget = false;
  // :848 and :855 - written UNCONDITIONALLY, OUTSIDE the
  // EnhancedCombatAI guard at :868 that owns secondaryTarget itself.
  // So this flag is live on the classic path even though nothing
  // classic ever writes secondaryTargetPos. See the switch arm in
  // runTargetMachine for what that costs.
  let sawSecondaryTarget = false;
  let selectedDistance = 0;
  const walk = [...(candidates ?? []), PLAYER_TARGET];
  for (const c of walk) {
    const isPlayer = isPlayerTarget(c);
    const targetEntity = isPlayer ? null : c.entity;
    const targetAi = isPlayer ? null : c.ai;
    // Can't target self (:768)
    if (c === self || (targetAi && targetAi === ai)) continue;
    // NoTarget mode (:776-777): the BASICS team here
    if ((noTargetMode || !ai.isHostile || selfMobileTeam === 'PlayerAlly') && isPlayer) continue;
    // Pacified enemies should not attack player allies (:780-781)
    if (!ai.isHostile && targetEntity && targetEntity.team === 'PlayerAlly') continue;
    // Player allies should not attack pacified enemies (:784-789)
    if (selfTeam === 'PlayerAlly' && !isPlayer) {
      if (targetAi && !targetAi.isHostile) continue;
    }
    // Can't target ally (:792-803) - the three-arm chain, verbatim
    if (isPlayer && selfTeam === 'PlayerAlly') {
      continue;
    } else if (infighting && !self.entity?.suppressInfighting && targetEntity && !targetEntity.suppressInfighting) {
      if (targetEntity.team === selfTeam) continue;
    } else {
      if (!isPlayer && selfMobileTeam !== 'PlayerAlly') continue;
    }
    // Quest enemy AI only targets player unless marked attackable (:806-807)
    if (self.isQuestFoe && !self.questAttackable && !isPlayer) continue;
    // For now, quest AI can't be targeted (:814-815)
    if (targetAi && c.isQuestFoe && !c.questAttackable) continue;
    const tFeet = isPlayer ? playerFeet : targetAi.feet;
    if (!tFeet) continue;
    const dx = tFeet[0] - ai.feet[0], dy = tFeet[1] - ai.feet[1], dz = tFeet[2] - ai.feet[2];
    const distance = Math.hypot(dx, dy, dz);
    const see = canSeeTarget(ai.collider, ai.feet, ai.yaw, ai.height, tFeet,
      isPlayer ? undefined : targetAi.height);
    // Neither visible nor in the area around the player (:824-825) -
    // foe candidates only; the player has no senses.
    if (targetAi && !targetAi.wouldBeSpawned && !see) continue;
    const priority = targetPriority(targetAi ? (targetAi.target ?? null) === null : false, see, distance);
    if (priority > highestPriority) {
      secondHighestPriority = highestPriority;
      highestPriority = priority;
      sawSecondaryTarget = sawSelectedTarget;   // :848
      sawSelectedTarget = see;
      selectedDistance = distance;
      highestPriorityTarget = c;
    } else if (priority > secondHighestPriority) {
      sawSecondaryTarget = see;                 // :855
      secondHighestPriority = priority;
    }
  }
  // THE HOLDER (:758-759, :862-863) is deliberately not carried: C#
  // seeds distanceToTargetHolder from the INCOMING field and restores
  // it when no candidate wins, but the port recomputes `_dist` in
  // _senses on every fixed step and the one frame where it could
  // differ - the frame the target goes null - is the frame the reset
  // block zeroes it anyway (:336). Unobservable here, recorded rather
  // than written as dead code.
  return {
    target: highestPriorityTarget, targetInSight: sawSelectedTarget,
    distanceToTarget: selectedDistance, sawSecondaryTarget,
  };
}

/** The dead-target cull's health read (:317, `target.Entity
 *  .CurrentHealth`): the player's rides the context; without it the
 *  player is presumed standing. */
const targetHealth = (c, playerEntity) =>
  (isPlayerTarget(c) ? (playerEntity?.health ?? 1) : (c.entity?.health ?? 0));

/**
 * The classic target machine - EnemySenses.Update:312-414's
 * ClassicUpdate block, run once per classic tick by EnemyAI._step
 * when the host arms candidates. Owns: the classicTargetUpdateTimer
 * cadence (>5 system-timer units; the port's classic-tick dt is
 * FIXED_DT per the P16/P17 folding, RECORDED - DFU adds the Unity
 * fixed delta on classic frames), the dead-target cull, the
 * non-hostile player drop, the null-target resets with the
 * secondary-switch arm, GetTargets behind the `wouldBeSpawned ||
 * playerInSight` gate (:391-395 + the :377-383 out-of-band LOS
 * check), and mutual targeting (:396-400).
 *
 * `self` is this foe's OWN candidate from the shared list. Returns
 * the target's feet (null target -> null; the caller takes the
 * :410-414 blind arm).
 */
export function runTargetMachine(self, candidates, playerFeet, classicDt, {
  noTargetMode = false,
  infighting,
  playerEntity = null,
} = {}) {
  const ai = self.ai;
  ai.classicTargetUpdateTimer = (ai.classicTargetUpdateTimer ?? 0) + classicDt / SYSTEM_TIMER_UPDATES_DIVISOR;
  // Dead target drops (:315-318)
  if (ai.target && targetHealth(ai.target, playerEntity) <= 0) ai.target = null;
  // Non-hostile mode (:321-327): a pacified foe drops the PLAYER as
  // its target; secondaryTarget likewise.
  if (noTargetMode || !ai.isHostile) {
    if (isPlayerTarget(ai.target)) ai.target = null;
    if (isPlayerTarget(ai.secondaryTarget)) ai.secondaryTarget = null;
  }
  // Reset these values if no target (:330-345). The secondary-switch
  // arm survives on the classic path because MakeEnemyHostileToAttacker
  // writes SecondaryTarget (:197) - DFU's comment ("only if using
  // enhanced") describes GetTargets' write, not that one.
  if (ai.target == null) {
    ai.lastKnownTargetPos = null;
    ai.predictedTargetPos = null;
    ai._dist = 0;
    if (ai.secondaryTarget && targetHealth(ai.secondaryTarget, playerEntity) > 0) {
      ai.target = ai.secondaryTarget;
      // :347-349 - "If the secondary target was actually seen, use the
      // last place we saw it to begin pursuit." A LOUD DFU QUIRK on
      // the classic path: sawSecondaryTarget is written outside the
      // Enhanced guard (:848/:855) but secondaryTargetPos is written
      // only INSIDE it (:872), so classic reads a Vector3.zero that
      // nothing ever filled - the foe begins its pursuit at the world
      // ORIGIN rather than at its target. Ported as C# runs it,
      // because the alternative is inventing a position DFU does not
      // have; the port's origin travels with the streamer, exactly as
      // DFU's does under StreamingWorld.
      if (ai.sawSecondaryTarget) ai.lastKnownTargetPos = [0, 0, 0];
      ai.awareOfTargetForLastPrediction = false;
    }
  }
  // :377-383 - out of the classic area, still check direct LOS to the
  // player so enemies who see the player will try to attack.
  let playerInSight = false;
  if (!ai.wouldBeSpawned && playerFeet) {
    playerInSight = canSeeTarget(ai.collider, ai.feet, ai.yaw, ai.height, playerFeet);
  }
  if (ai.classicTargetUpdateTimer > SENSES_INTERVAL_UNITS) {
    ai.classicTargetUpdateTimer = 0;
    // Is enemy in area around player or can see player? (:392-401)
    if (ai.wouldBeSpawned || playerInSight) {
      const got = getTargets(self, candidates, playerFeet, { noTargetMode, infighting });
      ai.target = got.target;
      ai.sawSecondaryTarget = got.sawSecondaryTarget;
      // `targetSenses = target.GetComponent<EnemySenses>()` (:397-400)
      // - the port's equivalent is the target CANDIDATE itself, since
      // its `ai` IS the senses. Null for the player, as C# nulls it.
      ai.targetSenses = ai.target && !isPlayerTarget(ai.target) ? ai.target : null;
    }
    // MT-i (the adversarial re-read): "Make targeted character also
    // target this character if it doesn't have a target yet" sits
    // OUTSIDE that gate (:403-407), at the timer-expiry level - and
    // `targetSenses` is a persistent FIELD (:56), not a local. So on
    // a tick where the gate REJECTS, GetTargets never runs and the
    // stale targetSenses from an earlier pass is what gets written
    // to. Nesting this inside the gate (the port's first cut) lost
    // exactly that: a foe that walked out of the spawn band stopped
    // recruiting the target it was still holding.
    if (ai.target != null && ai.targetSenses && (ai.targetSenses.ai?.target ?? null) === null) {
      ai.targetSenses.ai.target = self;
    }
  }
  if (ai.target == null) return null;
  return isPlayerTarget(ai.target) ? playerFeet : ai.target.ai.feet;
}

/**
 * EnemyMotor.MakeEnemyHostileToAttacker's PLAYER arm (:204-213): a
 * player attack turns the foe hostile and a struck former ally
 * reverts to the STATIC row's team - `EnemyBasics.Enemies.First(x =>
 * x.ID == id).Team` (:211), which is staticTeamOf and deliberately
 * NOT the instance's own MobileEnemy copy. (The target-reassign
 * guard at :193-202 is the motor's makeEnemyHostileToAttacker; this
 * half owns the entity-side writes.)
 */
export function resetAllyTeamOnPlayerAttack(ai, entity, mobileType) {
  ai.isHostile = true;
  if (entity && entity.team === 'PlayerAlly') {
    // the STATIC table by mobile ID (:210-211), never the instance's
    // own copy - a summoned ally's copy IS PlayerAlly, so reading it
    // would leave the struck ally allied forever.
    entity.team = staticTeamOf(mobileType ?? entity.mobileType);
  }
}
