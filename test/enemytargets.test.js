// MT-i - THE TARGET-SELECTION HALF, pinned against EnemySenses.cs
// (GetTargets :752-878, the classic target machine :312-414),
// EnemyMotor.MakeEnemyHostileToAttacker (:186-214) and
// DaggerfallUnityEnums.cs's MobileTeams. The armed path runs through
// REAL EnemyAI instances driven by update(); the unarmed path is
// pinned unchanged beside it (the headless charter's two arms).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { EnemyAI, SYSTEM_TIMER_UPDATES_DIVISOR, SENSES_INTERVAL_UNITS } from '../src/characters/enemyMotor.js';
import { FIXED_DT } from '../src/player/motor.js';
import {
  MOBILE_TEAMS, PLAYER_TARGET, isPlayerTarget, mobileTeamOf, staticTeamOf, targetPriority,
  getTargets, runTargetMachine, resetAllyTeamOnPlayerAttack, enemyInfightingEnabled,
} from '../src/characters/enemyTargets.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone
const DAEDROTH = MOBILE_TYPES.Daedroth;

const DFU_ENUMS = dfuFile('Assets/Scripts/DaggerfallUnityEnums.cs');

const clearCollider = () => ({
  raycast: () => Infinity,
  capsuleCast: () => ({ dist: Infinity, key: null }),
  move: () => ({ grounded: true }),
});
const mkSenses = (extra = {}) => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, ...extra });

/** One foe descriptor - ai + entity, the candidate shape. yaw
 *  matters: the FOV is 180, so a foe facing away cannot SEE a
 *  candidate behind it (fixtures face their opponents). */
function mkFoe(feet, { team = 'PlayerEnemy', birthTeam = team, suppress = false, hostile = true, health = 20, isQuestFoe = false, questAttackable = false, yaw = 0 } = {}) {
  const ai = new EnemyAI(clearCollider(), feet, yaw);
  ai.isHostile = hostile;
  return {
    ai,
    entity: { team, mobileTeam: birthTeam, suppressInfighting: suppress, health, basics: { team: birthTeam } },
    isQuestFoe, questAttackable,
  };
}

/** The host's targeting closure over a shared pool - what MT-ii's
 *  pools will build; here the test IS the host. */
function armPool(candidates, { infighting = true, playerEntity = { health: 100 } } = {}) {
  return (ai, playerFeet, dt) => {
    const self = candidates.find((c) => c.ai === ai);
    return runTargetMachine(self, candidates, playerFeet, dt, { infighting, playerEntity });
  };
}
const drive = (foes, playerFeet, targeting, seconds) => {
  // step all AIs together in small slices so mutual targeting and
  // pursuit interleave the way a host frame does
  for (let t = 0; t < seconds; t += 0.1) {
    for (const f of foes) f.ai.update(0.1, playerFeet, mkSenses({ targeting }));
  }
};

test('MT-i GATE: MOBILE_TEAMS is DaggerfallUnityEnums.cs\'s enum, in order; every basics row names a member', (t) => {
  assert.equal(MOBILE_TEAMS.length, 22);
  assert.equal(MOBILE_TEAMS[0], 'PlayerEnemy');
  assert.equal(MOBILE_TEAMS[1], 'PlayerAlly');
  assert.equal(MOBILE_TEAMS[21], 'CityWatch');
  for (const row of Object.values(ENEMY_BASICS)) {
    if (row?.team != null) assert.ok(MOBILE_TEAMS.includes(row.team), `${row.name ?? '?'}: team ${row.team} is a MobileTeams member`);
  }
  assert.equal(mobileTeamOf({ basics: {} }), 'PlayerEnemy', 'the struct zero member, per EnemyEntity.cs:316');
  if (!existsSync(DFU_ENUMS)) { t.diagnostic('DFU clone absent - the enum diff skipped'); return; }
  const cs = readFileSync(DFU_ENUMS, 'utf8');
  const body = cs.match(/enum MobileTeams\s*\{([^}]+)\}/)[1];
  const names = body.split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual([...MOBILE_TEAMS], names, 'the port\'s array IS the C# enum, index for value');
});

test('MT-i: the priority arithmetic - +5 untargeted, +10 seen, 30-distance floored (:829-841)', () => {
  assert.equal(targetPriority(true, true, 3), 5 + 10 + 27);
  assert.equal(targetPriority(false, false, 40), 0, 'the distance band floors at 0');
  assert.equal(targetPriority(false, true, 25), 15);
  // an unseen-but-spawned candidate at 5 outprioritizes a seen one at 28
  assert.ok(targetPriority(false, false, 5) > targetPriority(false, true, 28));
});

test('MT-i: ARMED foes are BLIND through the warmup, then acquire - unarmed stays the legacy instant path', () => {
  const playerFeet = [0, 0, 5];
  const armed = mkFoe([0, 0, 0]);
  const targeting = armPool([armed]);
  drive([armed], playerFeet, targeting, 0.9);
  assert.equal(armed.ai.target, null, 'classicTargetUpdateTimer has not crossed 5 units');
  assert.equal(armed.ai.detected, false, 'no target reads BLIND (:410-414)');
  drive([armed], playerFeet, targeting, 0.7);
  assert.equal(isPlayerTarget(armed.ai.target), true, 'the machine picked the player');
  assert.equal(armed.ai.detected, true, 'and the senses resolve against it');
  // the cadence in the port's folding: FIXED_DT per classic tick
  const perTick = FIXED_DT / SYSTEM_TIMER_UPDATES_DIVISOR;
  assert.ok(Math.ceil(SENSES_INTERVAL_UNITS / perTick) === 17, 'the >5 gate falls on the 17th classic tick');
  // UNARMED: the exact same drive without targeting detects on the first step
  const legacy = mkFoe([0, 0, 0]);
  legacy.ai.update(0.1, playerFeet, mkSenses());
  assert.equal(legacy.ai.detected, true, 'the player-only path is untouched');
});

test('MT-i INFIGHTING: cross-team foes pick each other over a distant player; same-team foes pick the player', () => {
  const playerFeet = [0, 0, 30];
  const bear = mkFoe([0, 0, 0], { team: 'Bears' });
  const orc = mkFoe([0, 0, 3], { team: 'Orcs', yaw: Math.PI });   // facing the bear
  const pool = [bear, orc];
  drive(pool, playerFeet, armPool(pool), 1.3);
  assert.equal(bear.ai.target, orc, 'the near foe outprioritizes the far player (~42 vs 10)');
  // the orc faces the bear, so the player behind it is unseen and out
  // of band: its own GetTargets gate never opens (:391) - the bear it
  // holds arrived through the MUTUAL write, live in the full drive
  assert.equal(orc.ai.target, bear, 'and crosswise');
  assert.ok(Math.abs(bear.ai.lastKnownTargetPos[2] - orc.ai.feet[2]) < 2, 'pursuit memory holds the FOE');
  // the MUTUAL write in isolation (:396-400): freeze the orc's own
  // cadence so only the bear's pass runs - the targeted character is
  // handed the bear as target without a pass of its own
  const bear2 = mkFoe([0, 0, 0], { team: 'Bears' });
  const orc2 = mkFoe([0, 0, 3], { team: 'Orcs', yaw: Math.PI });
  orc2.ai.classicTargetUpdateTimer = -1000;
  const pool2 = [bear2, orc2];
  drive(pool2, playerFeet, armPool(pool2), 1.3);
  assert.equal(bear2.ai.target, orc2);
  assert.equal(orc2.ai.target, bear2, 'Make targeted character also target this character (:396-400)');
  // same team: both face the player (out of band, the gate rides the
  // direct-LOS arm :377-383) and neither considers the other
  const bearA = mkFoe([0, 0, 0], { team: 'Bears' });
  const bearB = mkFoe([0, 0, 3], { team: 'Bears' });
  const pool3 = [bearA, bearB];
  drive(pool3, playerFeet, armPool(pool3), 1.3);
  assert.equal(isPlayerTarget(bearA.ai.target), true, 'same team never infights (:796-797)');
  assert.equal(isPlayerTarget(bearB.ai.target), true);
});

test('MT-i: SuppressInfighting on EITHER side falls to the else-arm; the setting OFF kills infighting whole', () => {
  const playerFeet = [0, 0, 30];
  const seducer = mkFoe([0, 0, 0], { team: 'Daedra', suppress: true });
  const orc = mkFoe([0, 0, 3], { team: 'Orcs' });
  const pool = [seducer, orc];
  drive(pool, playerFeet, armPool(pool), 1.3);
  assert.equal(isPlayerTarget(seducer.ai.target), true, 'the suppressed side targets only the player (:801-802)');
  assert.equal(isPlayerTarget(orc.ai.target), true, 'and cannot BE a target for infighting');
  const bear2 = mkFoe([0, 0, 0], { team: 'Bears' });
  const orc2 = mkFoe([0, 0, 3], { team: 'Orcs' });
  const pool2 = [bear2, orc2];
  drive(pool2, playerFeet, armPool(pool2, { infighting: false }), 1.3);
  assert.equal(isPlayerTarget(bear2.ai.target), true, 'EnemyInfighting off: the else-arm skips every foe');
  assert.equal(enemyInfightingEnabled(), true, 'the setting ships True (settingsDefaults)');
});

test('MT-i PLAYER ALLY: never targets the player, fights hostiles, spares the pacified; a pacified foe spares allies', () => {
  const playerFeet = [0, 0, 30];
  const ally = mkFoe([0, 0, 0], { team: 'PlayerAlly', birthTeam: 'Daedra' });
  const orc = mkFoe([0, 0, 3], { team: 'Orcs', yaw: Math.PI });
  const pool = [ally, orc];
  drive(pool, playerFeet, armPool(pool), 1.3);
  assert.equal(ally.ai.target, orc, 'the ally picks the hostile foe, never the player (:792-793)');
  assert.equal(orc.ai.target, ally, 'and the orc fights back');
  // pacified foe near an ally: neither may start it
  const ally2 = mkFoe([0, 0, 0], { team: 'PlayerAlly', birthTeam: 'Daedra' });
  const calm = mkFoe([0, 0, 3], { team: 'Orcs', hostile: false, yaw: Math.PI });
  const pool2 = [ally2, calm];
  drive(pool2, playerFeet, armPool(pool2), 1.3);
  assert.equal(ally2.ai.target, null, 'player allies should not attack pacified enemies (:784-789)');
  assert.equal(calm.ai.target, null, 'pacified enemies should not attack player allies (:780-781), nor the player (:776)');
  // but a PACIFIED foe may still fight a HOSTILE cross-team foe - the
  // chain's infighting arm has no hostility test (:794-797)
  const calm2 = mkFoe([0, 0, 0], { team: 'Bears', hostile: false });
  const orc3 = mkFoe([0, 0, 3], { team: 'Orcs', yaw: Math.PI });
  const pool3 = [calm2, orc3];
  drive(pool3, playerFeet, armPool(pool3), 1.3);
  assert.equal(calm2.ai.target, orc3, 'a pacified bear still meets an orc\'s charge');
});

test('MT-i QUEST ARMS: a quest foe targets only the player unless marked attackable, and cannot be targeted', () => {
  const playerFeet = [0, 0, 30];
  const questFoe = mkFoe([0, 0, 0], { team: 'Bears', isQuestFoe: true });
  const orc = mkFoe([0, 0, 3], { team: 'Orcs' });   // both face the player
  const pool = [questFoe, orc];
  drive(pool, playerFeet, armPool(pool), 1.3);
  assert.equal(isPlayerTarget(questFoe.ai.target), true, 'quest AI only targets player by default (:806-807)');
  assert.equal(isPlayerTarget(orc.ai.target), true, 'for now, quest AI can\'t be targeted (:814-815)');
  // attackable: the quest foe picks the orc on its own pass; the orc
  // faces it, its player gate never opens, and the MUTUAL write hands
  // it the quest foe back
  const questFoe2 = mkFoe([0, 0, 0], { team: 'Bears', isQuestFoe: true, questAttackable: true });
  const orc2 = mkFoe([0, 0, 3], { team: 'Orcs', yaw: Math.PI });
  const pool2 = [questFoe2, orc2];
  drive(pool2, playerFeet, armPool(pool2), 1.3);
  assert.equal(questFoe2.ai.target, orc2, 'IsAttackableByAI opens both doors');
  assert.equal(orc2.ai.target, questFoe2);
});

test('MT-i: the dead-target cull resets the memory and the machine re-acquires; pacification drops the PLAYER target', () => {
  const playerFeet = [0, 0, 6];
  const bear = mkFoe([0, 0, 0], { team: 'Bears' });
  const orc = mkFoe([0, 0, 2], { team: 'Orcs', yaw: Math.PI });
  const pool = [bear, orc];
  const targeting = armPool(pool);
  drive(pool, playerFeet, targeting, 1.3);
  assert.equal(bear.ai.target, orc);
  orc.entity.health = 0;   // the orc dies
  bear.ai.update(0.1, playerFeet, mkSenses({ targeting }));
  assert.notEqual(bear.ai.target, orc, 'target.Entity.CurrentHealth <= 0 drops it (:315-318)');
  // the corpse leaves the candidate list (the host's live pool - DFU's
  // ActiveGameObjectDatabase stops yielding it); GetTargets itself has
  // no health filter, so a still-listed corpse WOULD be re-picked and
  // re-culled each tick - that oscillation is the source's own.
  pool.splice(pool.indexOf(orc), 1);
  drive([bear], playerFeet, targeting, 1.3);
  assert.equal(isPlayerTarget(bear.ai.target), true, 're-acquired the player');
  // pacification: the machine drops a PLAYER target outside GetTargets' cadence
  bear.ai.isHostile = false;
  bear.ai.update(0.1, playerFeet, mkSenses({ targeting }));
  assert.equal(bear.ai.target, null, 'non-hostile mode clears the player target (:321-327)');
  assert.equal(bear.ai.detected, false, 'and the foe reads blind');
});

test('MT-i: MakeEnemyHostileToAttacker - the reassign guard, the secondary slot, and the ally team reset', () => {
  const foe = mkFoe([0, 0, 0], { team: 'PlayerAlly', birthTeam: 'Daedra' });
  const attackerFoe = mkFoe([0, 0, 10], { team: 'Orcs' });
  // no target yet: reassign fires whole
  foe.ai.makeEnemyHostileToAttacker(attackerFoe, [0, 0, 10]);
  assert.equal(foe.ai.target, attackerFoe, ':196');
  assert.equal(foe.ai.secondaryTarget, attackerFoe, ':197 - the classic path\'s one secondary write');
  assert.deepEqual(foe.ai.lastKnownTargetPos, [0, 0, 10], 'seeded at the attacker (:198-200)');
  assert.ok(foe.ai.giveUpTimer > 0, ':201');
  // target standing seen within 2 units: the guard REFUSES a swap
  foe.ai.inSight = true;
  foe.ai._dist = 1.5;
  const other = mkFoe([5, 0, 0], { team: 'Bears' });
  foe.ai.makeEnemyHostileToAttacker(other, [5, 0, 0]);
  assert.equal(foe.ai.target, attackerFoe, 'an adjacent seen target is kept (:194)');
  // the player arm: hostility plus the entity-side team reversion
  foe.ai.makeEnemyHostileToAttacker(PLAYER_TARGET, [1, 0, 0]);
  assert.equal(foe.ai.isHostile, true, ':206');
  resetAllyTeamOnPlayerAttack(foe.ai, foe.entity, DAEDROTH);
  assert.equal(foe.entity.team, 'Daedra', 'a struck former ally reverts to the STATIC row (:208-212)');
});

test('MT-i: the ALLY SUMMON\'s three teams are three different fields, and the revert reads the STATIC one', () => {
  // SetupDemoEnemy.cs:82-86 copies MobileEnemy BY VALUE out of the
  // dictionary and overwrites the COPY's Team; EnemyEntity.cs:316
  // then seeds Entity.Team from that copy. The static table never
  // moves - and the port's `basics` IS that static table, frozen and
  // shared by every foe of the type, so the copy must be its own
  // field or an allied summon would ally every Daedroth in the game.
  const summon = makeEnemyEntity(DAEDROTH, ENEMY_BASICS[DAEDROTH], null, 5, () => 0.5);
  assert.equal(summon.team, 'Daedra', 'minted as its species');
  assert.equal(summon.mobileTeam, 'Daedra', 'and so is its MobileEnemy copy');
  // the summon's own two writes (the host's allied spawn):
  summon.team = 'PlayerAlly';
  summon.mobileTeam = 'PlayerAlly';
  assert.equal(ENEMY_BASICS[DAEDROTH].team, 'Daedra', 'the SHARED row is untouched - no other Daedroth turned');
  assert.equal(mobileTeamOf(summon), 'PlayerAlly', 'GetTargets\' :776/:801 arms see the ally');
  assert.equal(staticTeamOf(DAEDROTH), 'Daedra', 'the revert reads the species, not the copy');
  // and the revert therefore actually reverts
  const ai = new EnemyAI(clearCollider(), [0, 0, 0], 0);
  resetAllyTeamOnPlayerAttack(ai, summon, DAEDROTH);
  assert.equal(summon.team, 'Daedra', 'a struck ally stops being one');
  assert.equal(ai.isHostile, true);
  // reading the instance copy instead would have left it allied forever
  assert.notEqual(mobileTeamOf(summon), summon.team, 'and the two fields legitimately disagree afterwards - C#\'s own shape');
});

test('MT-i: the two team reads stay apart - the NoTarget arm reads the BASICS team, the ally arms the LIVE one', () => {
  // live team PlayerAlly, birth team Orcs: the ally arms fire off the
  // LIVE read (:792), so the player is skipped...
  const turned = mkFoe([0, 0, 0], { team: 'PlayerAlly', birthTeam: 'Orcs' });
  const got = getTargets(turned, [turned], [0, 0, 4], { infighting: true });
  assert.equal(got.target, null, 'live-ally skips the player; birth-team Orcs passes :776 but the :792 arm still guards');
  // live team Orcs, birth team PlayerAlly (the reverse graft): :776
  // reads the BASICS team and drops the player even though the live
  // team is hostile - the source's own asymmetry, kept
  const reverse = mkFoe([0, 0, 0], { team: 'Orcs', birthTeam: 'PlayerAlly' });
  const got2 = getTargets(reverse, [reverse], [0, 0, 4], { infighting: true });
  assert.equal(got2.target, null, ':776 MobileEnemy.Team == PlayerAlly skips the player whatever the live team says');
});

// ---- the ADVERSARIAL PASS's three finds, each pinned at the shape
// that would have let it back in ----

test('MT-i: the mutual-target write fires OUTSIDE the spawn-band gate, off the PERSISTENT targetSenses', () => {
  // :403-407 sits at the timer-expiry level, not inside `if
  // (wouldBeSpawnedInClassic || playerInSight)` (:392-401), and
  // targetSenses is a FIELD (:56). So a foe whose gate has since
  // CLOSED still recruits the target it is holding.
  const playerFeet = [0, 0, 30];
  const bear = mkFoe([0, 0, 0], { team: 'Bears' });
  const orc = mkFoe([0, 0, 3], { team: 'Orcs', yaw: Math.PI });
  const pool = [bear, orc];
  const targeting = armPool(pool);
  drive(pool, playerFeet, targeting, 1.3);
  assert.equal(bear.ai.target, orc, 'acquired, and targetSenses latched');
  assert.equal(bear.ai.targetSenses, orc, 'the persistent field holds the CANDIDATE (its ai IS the senses)');
  // now close the bear's gate and clear the orc's target: the write
  // must STILL land on the next timer expiry, with no GetTargets pass
  orc.ai.target = null;
  bear.ai.wouldBeSpawned = false;
  bear.ai.classicTargetUpdateTimer = 999;   // expire it at once
  runTargetMachine(bear, pool, [0, 0, 3000], 1 / 60, { infighting: true, playerEntity: { health: 100 } });
  assert.equal(orc.ai.target, bear, 'the stale targetSenses still recruits - nesting this in the gate loses it');
});

test('MT-i: a NULL-target tick runs neither the illusion re-roll nor the LOS decrement (:410-414 returns above them)', () => {
  const armed = mkFoe([0, 0, 0]);
  const targeting = armPool([armed]);
  armed.ai.lastHadLOSTimer = 50;
  // through the warm-up the machine holds no target at all
  drive([armed], [0, 0, 5], targeting, 0.9);
  assert.equal(armed.ai.target, null, 'still blind');
  assert.equal(armed.ai.lastHadLOSTimer, 50, 'the timer FROZE - DFU returns above the decrement (:446-447)');
  // once a target lands, the same ticks drain it again
  drive([armed], [0, 0, 5], targeting, 0.7);
  assert.ok(isPlayerTarget(armed.ai.target));
  const held = armed.ai.lastHadLOSTimer;
  assert.ok(held > 0, 'and detection refilled it');
  // the UNARMED path never freezes: it always has the player
  const legacy = mkFoe([0, 0, 0]);
  legacy.ai.lastHadLOSTimer = 50;
  legacy.ai.update(0.1, [0, 0, 500], mkSenses());   // far away: undetected, but targeted
  assert.ok(legacy.ai.lastHadLOSTimer < 50, 'an unarmed foe drains it as it always did');
});

test('MT-i: the sight ray aims at the TARGET\'s own eye height, not a player-sized constant', () => {
  // :896-898 places the destination eye off the TARGET's controller.
  // A wall between the two, tall enough to hide a RAT but not a
  // person, must occlude - which it cannot if the ray aims at a
  // player-height eye.
  const RAT_H = 0.6;
  // the watcher's eye sits at 1.75 (2.1 * 5/6). The ray to a RAT's
  // eye (0.5) passes the wall's plane at 1.125; the ray to a
  // person-sized eye passes it at 1.75. A wall topping out between
  // the two separates them - and only if the ray aims where the
  // TARGET's eye actually is.
  const WALL_TOP = 1.4;
  const wallCollider = () => ({
    // a wall at z = 1.5: the ray is blocked when it passes below the top
    raycastHit: (origin, dir, len) => {
      const t = (1.5 - origin[2]) / (dir[2] || 1e-9);
      if (!(t > 0 && t < len)) return { dist: Infinity, key: null };
      const y = origin[1] + dir[1] * t;
      return y < WALL_TOP ? { dist: t, key: 'wall' } : { dist: Infinity, key: null };
    },
    raycast(origin, dir, len) { return this.raycastHit(origin, dir, len).dist; },
    capsuleCast: () => ({ dist: Infinity, key: null }),
    move: () => ({ grounded: true }),
  });
  const watcher = { ai: new EnemyAI(wallCollider(), [0, 0, 0], 0), entity: { team: 'Bears', health: 20, basics: { team: 'Bears' } } };
  const rat = { ai: new EnemyAI(clearCollider(), [0, 0, 3], 0), entity: { team: 'Orcs', health: 20, basics: { team: 'Orcs' } } };
  rat.ai.height = RAT_H;
  const pool = [watcher, rat];
  // the player stands beyond the wall too (unseen, low priority), so
  // the rat wins the walk while staying inside the spawn band
  drive(pool, [0, 0, 20], armPool(pool), 1.3);
  assert.equal(watcher.ai.target, rat, 'the near rat outprioritizes the far player');
  assert.equal(watcher.ai.inSight, false, 'the wall hides the RAT - aiming at a person\'s eye clears it');
  // and the SAME geometry with a person-sized target IS seen over the wall
  const watcher2 = { ai: new EnemyAI(wallCollider(), [0, 0, 0], 0), entity: { team: 'Bears', health: 20, basics: { team: 'Bears' } } };
  const person = { ai: new EnemyAI(clearCollider(), [0, 0, 3], 0), entity: { team: 'Orcs', health: 20, basics: { team: 'Orcs' } } };
  const pool2 = [watcher2, person];
  drive(pool2, [0, 0, 20], armPool(pool2), 1.3);
  assert.equal(watcher2.ai.target, person);
  assert.equal(watcher2.ai.inSight, true, 'a person-sized target clears the same wall');
});
