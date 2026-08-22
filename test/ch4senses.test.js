// CH4-slice: the dedicated SENSES verify pass (AUDIT 23
// characters-9/10/12 - the shorthand row resolved by re-reading
// EnemySenses.cs/EnemyMotor.cs whole). Three fixes pinned here:
// the STOPPED turn gate is 22.5 (EnemyMotor.cs:514), not
// AttemptMove's 5.625; the hearing ray runs CENTER to center
// (:942); and the cadence split - sight/hearing/detection resolve
// every fixed step (DFU FixedUpdate) while the spawn-band recompute
// and the illusion re-roll gate on the classic update (:260-310,
// :444-449). Plus the persistence halves (SerializableEnemy
// :113-114/:178/:182-183) riding the dungeon snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EnemyAI, canHearTarget, MELEE_DISTANCE, STOP_YAW_GATE_DEG, MOVE_YAW_GATE_DEG,
  CLASSIC_TURN_DEG, CLASSIC_UPDATE_INTERVAL,
} from '../src/characters/enemyMotor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEG = Math.PI / 180;
const clearCollider = () => ({
  raycast: () => Infinity,
  // wave 34/35: the motor probes before it moves and before it chooses a
  // destination, so a stub world has to answer "nothing in the way".
  capsuleCast: () => ({ dist: Infinity, key: null }),
  move: () => ({ grounded: true }),
});
const mkSenses = (extra = {}) => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, ...extra });

test('CH4: a melee-stopped foe turns at the 22.5 gate, the mover at 5.625', () => {
  assert.equal(STOP_YAW_GATE_DEG, 22.5, 'EnemyMotor.cs:514');
  assert.equal(MOVE_YAW_GATE_DEG, 5.625, 'AttemptMove :896');
  // player at melee range, 15deg off the foe's facing: INSIDE the
  // stop gate - the foe stands (the old 5.625 made it micro-track)
  const d = 2.0;   // <= MELEE_DISTANCE 2.25
  assert.ok(d <= MELEE_DISTANCE);
  const ai15 = new EnemyAI(clearCollider(), [0, 0, 0], 0);
  ai15.update(0.07, [d * Math.sin(15 * DEG), 0, d * Math.cos(15 * DEG)], mkSenses());
  assert.equal(ai15.detected, true, 'seen at melee range');
  assert.equal(ai15.yaw, 0, '15deg off-face stands - within the 22.5 look gate');
  // 30deg off: outside the gate - one classic turn of 20deg fires
  const ai30 = new EnemyAI(clearCollider(), [0, 0, 0], 0);
  ai30.update(0.07, [d * Math.sin(30 * DEG), 0, d * Math.cos(30 * DEG)], mkSenses());
  assert.ok(Math.abs(ai30.yaw - CLASSIC_TURN_DEG * DEG) < 1e-9, 'TurnToTarget steps 20deg per classic update');
});

test('CH4: the hearing ray casts CENTER to center, not from the eye', () => {
  let captured = null;
  const collider = { raycast: (origin, dir, len) => { captured = { origin: [...origin] }; return Infinity; } };
  const height = 2.1;
  assert.equal(canHearTarget(collider, [5, 10, 5], height, [8, 10, 5], 3), true);
  assert.ok(captured, 'inside the radius the block ray casts');
  assert.equal(captured.origin[1], 10 + height / 2, 'origin y = the capsule CENTER (transform.position, :942) - the old eye origin sat h/3 high');
  // outside the 25 radius: no ray at all
  captured = null;
  assert.equal(canHearTarget(collider, [0, 0, 0], height, [30, 0, 0], 30), false);
  assert.equal(captured, null);
});

test('CH4: sight/detection resolve EVERY fixed step; the illusion die rolls per CLASSIC tick', () => {
  // one 1/60 step - the classic timer (0.0625) has NOT fired, yet
  // sight detection already resolves (DFU: CanSeeTarget + the
  // detection ladder run every FixedUpdate, :421/:451-470)
  let rollCount = 0;
  const senses = mkSenses({ playerBlending: true, rolls: () => { rollCount++; return 0.5; } });
  const ai = new EnemyAI(clearCollider(), [0, 0, 0], 0);
  ai.update(1 / 60, [0, 0, 10], senses);
  assert.equal(ai.detected, true, 'seen on the very first fixed step - no classic tick needed');
  assert.equal(rollCount, 0, 'the illusion die is CLASSIC-gated (:444-449) - no classic tick, no roll');
  // accumulate past one classic interval: exactly ONE illusion roll
  // fires, and the blend block (r=0.5 fails the 8% see-through)
  // stands between re-rolls - detection drops even with clear sight
  while (ai._classicTimer + 1 / 60 < CLASSIC_UPDATE_INTERVAL) ai.update(1 / 60, [0, 0, 10], senses);
  ai.update(1 / 60, [0, 0, 10], senses);
  assert.equal(rollCount, 1, 'one classic tick, one illusion die');
  assert.equal(ai.detected, false, 'the failed see-through blocks the ladder until the next classic re-roll');
});

test('CH4: the dungeon snapshot carries isHostile/hasEncounteredPlayer/magicka, restore gated on presence', () => {
  const dc = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  const ci = dc.indexOf('function collectWorld()');
  const collect = dc.slice(ci, dc.indexOf('function applyWorld', ci));
  assert.ok(collect.includes('hostile: f.ai.isHostile !== false'), 'SerializableEnemy :113');
  assert.ok(collect.includes('encountered: !!f.ai.hasEncounteredPlayer'), 'SerializableEnemy :114');
  assert.ok(collect.includes('magicka: f.entity.magicka ?? 0'), 'a discharged caster must not refill on load (:112/:178)');
  const ai = dc.indexOf('function applyWorld(w)');
  const apply = dc.slice(ai, dc.indexOf('w.piles?.forEach', ai));
  assert.ok(apply.includes('if (sf.hostile != null) f.ai.isHostile = !!sf.hostile;'), ':182 restore, old saves keep live state');
  assert.ok(apply.includes('if (sf.encountered != null) f.ai.hasEncounteredPlayer = !!sf.encountered;'), ':183 restore');
  assert.ok(apply.includes('if (sf.magicka != null) f.entity.magicka = sf.magicka;'), ':178 restore');
});
