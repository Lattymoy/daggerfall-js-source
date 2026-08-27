// AUDIT 24, wave 36: the senses context the exterior pools never got,
// the alert flag the watch never touched, and the seed wave 35 needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sensesContext, createPlayerTicker } from '../src/scenes/shared.js';
import { EnemyAI, GIVE_UP_TICKS } from '../src/characters/enemyMotor.js';
import { SKILLS, skillValue } from '../src/systems/skills.js';
import { setEnemyAlert, ALERT_DECAY_MINUTES } from '../src/systems/encounters.js';
import { setWorldMinutes, resetMagicRoundMarker, CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const player = (over = {}) => ({
  skills: [], stats: {}, level: 1, health: 50, maxHealth: 50, activeEffects: [], ...over,
});

test('audit24 wave36: the senses context carries all eight fields, from one builder', () => {
  const e = player({ skills: new Array(35).fill(0) });
  e.skills[SKILLS.Stealth] = 62;
  const ctx = sensesContext(e, 1234.7, { movingLessThanHalfSpeed: false });
  assert.equal(ctx.gameMinutes, 1234, 'floored, as the dungeon built it');
  assert.equal(ctx.playerStealth, skillValue(e, SKILLS.Stealth), 'the LIVE skill, not 0');
  assert.equal(ctx.movingLessThanHalfSpeed, false);
  assert.equal(ctx.playerBlending, false);
  assert.equal(ctx.playerInvisible, false);
  assert.equal(ctx.playerShade, false);
  assert.equal(typeof ctx.tallyStealth, 'function');
  assert.ok(ctx.sharedStealth && typeof ctx.sharedStealth.minute === 'number');

  // the three illusion reads fold the normal and true powers
  for (const [kind, field] of [['invisNormal', 'playerInvisible'], ['invisTrue', 'playerInvisible'],
    ['chameleonNormal', 'playerBlending'], ['chameleonTrue', 'playerBlending'],
    ['shadeNormal', 'playerShade'], ['shadeTrue', 'playerShade']]) {
    const c = sensesContext(player({ activeEffects: [{ kind, roundsRemaining: 5 }] }), 0);
    assert.equal(c[field], true, `${kind} sets ${field}`);
  }
});

test('audit24 wave36: the shared-stealth box lives on the PLAYER, so one tally per minute in the world', () => {
  // DFU keeps it as PlayerEntity.TimeOfLastStealthCheck - one field on
  // one player. The dungeon host had a private per-host box, which lets
  // two hosts tally the same classic minute twice.
  const e = player();
  const a = sensesContext(e, 10);
  const b = sensesContext(e, 10);
  assert.equal(a.sharedStealth, b.sharedStealth, 'the same box, however many contexts are built');
  a.sharedStealth.minute = 10;
  assert.equal(b.sharedStealth.minute, 10);
  assert.equal(e.stealthCheckBox, a.sharedStealth, 'and it rides the entity');
  assert.equal(rd('src/scenes/dungeonContext.js').includes('_sharedStealth'), false,
    'the dungeon no longer keeps its own');
});

test('audit24 wave36: without the context, detection FREEZES on its first roll', () => {
  // The subtlest of the three bugs the missing object caused.
  // _stealthCheck's per-minute gate is `gameMinutes === _lastStealthMinute`,
  // and gameMinutes defaulted to 0 - so after the first check every
  // later call returned the CACHED detected, for the life of the foe.
  const stub = { raycast: () => 0.5, raycastHit: () => ({ dist: 0.5, key: null }), capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };
  const mk = () => {
    const ai = new EnemyAI(stub, [0, 0, 0], 0, { liveSpeed: 50 });
    ai.wouldBeSpawned = true;
    ai._dist = 4;
    return ai;
  };
  const rolls = () => 0.99;             // a high roll beats any stealth chance -> detected

  const starved = mk();
  starved._stealthCheck({ rolls });     // no gameMinutes: defaults to 0
  assert.equal(starved._lastStealthMinute, 0);
  starved.detected = false;             // ...now pretend the world moved on
  assert.equal(starved._stealthCheck({ rolls }), false,
    'the minute never changes, so it returns the cached answer for ever');

  const fed = mk();
  fed._stealthCheck({ gameMinutes: 100, rolls, movingLessThanHalfSpeed: false });
  fed.detected = false;
  assert.equal(fed._stealthCheck({ gameMinutes: 102, rolls, movingLessThanHalfSpeed: false }), true,
    'a real clock re-evaluates');

  // and the Stealth skill is actually consulted rather than read as 0
  const skilled = mk();
  skilled._dist = 4;
  const low = skilled._stealthCheck({ gameMinutes: 200, playerStealth: 0, rolls: () => 0.0, movingLessThanHalfSpeed: false });
  const high = mk();
  high._dist = 4;
  const hid = high._stealthCheck({ gameMinutes: 200, playerStealth: 100, rolls: () => 0.0, movingLessThanHalfSpeed: false });
  assert.notEqual(low, hid, 'skill 0 and skill 100 cannot give the same answer on the same roll');
});

test('audit24 wave36: every exterior pool is handed the full context', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = rd(f);
    assert.equal(src.includes('{ playerInvisible: isInvisible(playerEntity) }'), false,
      `${f}: the one-field object is gone`);
    assert.ok(src.includes('const _foeSenses = () => sensesContext(playerEntity, playerTicker.classicMinutes, {'),
      `${f}: builds the real one`);
    assert.ok(src.includes('movingLessThanHalfSpeed: player.movingLessThanHalfSpeed ?? true,'),
      `${f}: including the half-speed flag the odd-minute skip reads`);
  }
  // three call sites, all of them
  assert.equal((rd('src/scenes/world.js').match(/_foeSenses\(\)/g) ?? []).length, 2, 'world: the watch and the encounter pool');
  assert.equal((rd('src/scenes/exterior.js').match(/_foeSenses\(\)/g) ?? []).length, 1, 'exterior: the watch');
  // and the dungeon uses the same builder rather than its own literal
  // MT-iv spreads the activity bag to add the candidate getter (the
  // bag is persistent and must not be mutated); the context is still
  // the one shared builder, which is what this pin guards.
  assert.ok(rd('src/scenes/dungeonContext.js').includes('const _senses = sensesContext(playerEntity, classicMinutesRef.value, {\n      ..._activity,'));
});

test('audit24 wave36: the 8-hour alert decay is the ENTITY tick\'s, so every host runs it', () => {
  const e = player();
  setEnemyAlert(e, true, 1000);
  assert.equal(e.enemyAlertActive, true);
  setWorldMinutes(1000);
  resetMagicRoundMarker(1000);
  const ticker = createPlayerTicker(e, {});
  ticker.tick(60 / CLASSIC_MINUTES_PER_SECOND);          // one hour
  assert.equal(e.enemyAlertActive, true, 'an hour is not eight');
  ticker.tick((ALERT_DECAY_MINUTES + 1) / CLASSIC_MINUTES_PER_SECOND);
  assert.equal(e.enemyAlertActive, false, 'PlayerEntity.Update:380-384, in every context');

  // AUDIT 26 (F204): the decay moved INTO tickPlayerMinutes, because
  // the dungeon host builds no ticker and so never ran it. No scene
  // may call it beside the tick - with ONE exception, the dungeon rest
  // window, which is the port's only clock jump that skips the tick.
  const scenes = ['src/scenes/shared.js', 'src/scenes/dungeonContext.js', 'src/scenes/world.js',
    'src/scenes/exterior.js', 'src/scenes/worldModes.js']
    .map((f) => (rd(f).match(/decayEnemyAlert\(/g) ?? []).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(scenes, 1, 'the dungeon rest advance, and no other scene call site');
  assert.equal((rd('src/systems/worldTick.js').match(/decayEnemyAlert\(/g) ?? []).length, 1,
    'the player tick every host runs is where the law lives');
});

test('audit24 wave36: the watch raises and lowers the alert, and takes fall damage', () => {
  const cg = rd('src/scenes/cityGuards.js');
  // MT-ii restored the source's `Target == PlayerEntityBehaviour`
  // term (:531), which was unobservable while every foe targeted the
  // player: a watchman fighting a rat must not hold the alert up.
  assert.ok(cg.includes('if (isPlayerTarget(g.ai.target) && g.ai.inSight && g.ai.detected) setEnemyAlert(playerEntity, true, currentMinute());'),
    'EnemySenses:531-535 - raised by any enemy that targets and sees THE PLAYER');
  // MT-ii: EnemyDeath's clear carries the same target==player gate.
  assert.ok(cg.includes('if (isPlayerTarget(g.ai?.target) && g.ai?.detected) setEnemyAlert(playerEntity, false);'),
    'EnemyDeath:131-136 - and lowered by its death, when the player was its target');
  // the same two lines the encounter pool has carried since the X-slice
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.ok(xf.includes('setEnemyAlert(playerEntity, true, currentMinute());'));
  // MT-ii: the encounter pool's clear gained the same target==player
  // gate the watch's did (EnemyDeath:131-136).
  assert.ok(xf.includes('if (isPlayerTarget(f.ai?.target) && f.ai?.detected) setEnemyAlert(playerEntity, false);'));

  // ApplyFallDamage runs for EVERY enemy (:173) - the motor has always
  // produced landedFall for guards, and nobody read it.
  assert.ok(cg.includes('if (g.ai.landedFall > 0 && !g.dead) {'), 'the watch bills its own falls');
  // AUDIT 26 F035: through the pool damage door, so the death fires -
  // but NOT the crime. ApplyFallDamage (:1398-1401) calls
  // DecreaseHealth and nothing else; the Murder assignment lives
  // inside HandleAttackFromSource's player-source gate
  // (DaggerfallEntityBehaviour.cs:203, :265-269), which a fall never
  // enters. The old needle here pinned the crime as correct while
  // citing the very member that carries none.
  assert.ok(cg.includes("damageGuard(g, gdmg, null, null, { fromPlayer: false });"),
    'the fall is sourceless: death yes, Murder no');
});

test('audit24 wave36: hostility SEEDS the remembered position - the freeze wave 35 could have shipped', () => {
  // MakeEnemyHostileToAttacker (:194-201) sets OldLastKnownTargetPos,
  // LastKnownTargetPos and PredictedTargetPos to the attacker's
  // position as well as refilling GiveUpTimer. The port set only the
  // timer - harmless until wave 35 made HandleNoAction refuse to act
  // without a known position, at which point a watchman spawned
  // hostile out of sight had a full timer and nowhere to spend it.
  const stub = { raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };
  const bare = new EnemyAI(stub, [0, 0, 0], 0, { liveSpeed: 50 });
  bare.makeHostileToPlayer(600);
  assert.equal(bare.giveUpTimer, 600);
  assert.equal(bare.predictedTargetPos, null, 'no attacker position, nothing to seed');

  const seeded = new EnemyAI(stub, [0, 0, 0], 0, { liveSpeed: 50 });
  seeded.makeHostileToPlayer(600, [0, 0, 9]);   // dead ahead, so the yaw gate is not what is being tested
  assert.deepEqual(seeded.lastKnownTargetPos, [0, 0, 9]);
  assert.deepEqual(seeded.predictedTargetPos, [0, 0, 9]);
  assert.deepEqual(seeded.oldLastKnownTargetPos, [0, 0, 9]);
  assert.notEqual(seeded.oldLastKnownTargetPos, seeded.lastKnownTargetPos,
    'and the two are separate arrays, or the first difference would always be zero');
  assert.equal(seeded.giveUpTimer, 600);
  // it can now act at once, which is the point
  seeded.detected = true;
  seeded._dist = 20;
  seeded._classicTick([0, 0, 9]);
  assert.equal(seeded.moving, true, 'it walks to where the attack came from');

  assert.equal(GIVE_UP_TICKS, 200, 'the DFU default the C# refills');
  // every pool passes the position
  assert.ok(rd('src/scenes/cityGuards.js').includes('ai.makeHostileToPlayer(600, attackerFeet);'));
  // MT-ii: a player hit now runs MakeEnemyHostileToAttacker WHOLE
  // (the target reassign included, :193-202); the bare seed survives
  // for a SOURCELESS hurt - a fall, a poison tick, a self-cast - which
  // has no attacker to remember.
  // ...and MT-ii runs it through the whole C# method, INSIDE the
  // audit lane's player-source gate (the two slices met on the same
  // line): a sourceless hurt - a fall, a poison tick, another
  // enemy's blow - never reaches it at all now, which is the
  // stronger form of the same law.
  const xfs = rd('src/scenes/exteriorFoes.js');
  assert.ok(xfs.includes('f.ai.makeEnemyHostileToAttacker?.(PLAYER_TARGET, playerFeet ?? null);'));
  assert.match(xfs, /if \(fromPlayer && f\.ai\) \{/, 'and only for a PLAYER source');
  assert.ok(rd('src/scenes/dungeonContext.js').includes('foe.ai.makeHostileToPlayer?.(undefined, lastPlayerFeet);'));
});
