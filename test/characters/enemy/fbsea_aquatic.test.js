// FIELD BUGS 2026-09-29 (the sea) #2 - "Aquatic creatures cause collision" (the Discord, through Mac). A swimmer is
// frozen while the player is aboard (Iliac Puddle No More hands DFU a water level only while the player swims, and
// WaterMove moves nothing without one), so a hull sailing over one passes around it; the port then read it as
// GROUNDED - `velY === 0`, which WaterMove never touches - and its ray down, meeting the hull's bottom from inside (the
// port's meshes answer from either face), made it one of Come Sail Away's riders: carried inside the ship. The rider
// reads CharacterController.isGrounded now - the motor's own, whether its last Move stood it on something.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnemyAI } from '../../../src/characters/enemy/enemyMotor.js';
import { Collider } from '../../../src/player/collider.js';
import { raycastColliders } from '../../../src/world/prefabColliders.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { readyPool } from '../../navalSea.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const MOTOR = readFileSync(new URL('../../../src/characters/enemy/enemyMotor.js', import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
const floorAt = (y) => { const c = new Collider(() => -100); c.addMesh('floor', new Float32Array([-40, y, -40, 40, y, -40, 40, y, 40, -40, y, 40]), quadIdx, I); return c; };
/** The world's own rider handle's grounding (world.js csaEnemies), lifted: `ai` its motor. */
const liftedGrounded = (() => {
  const line = WORLD.split('\n').find((l) => /^\s+grounded: \(\) => /.test(l));
  assert.ok(line, 'the handle\'s grounding line');
  // eslint-disable-next-line no-new-func
  return new Function('ai', `return (${line.trim().replace(/^grounded: /, '').replace(/,\s*\/\/.*$/, '')})();`);
})();

test('FIELD BUGS 2026-09-29 (the sea) #2: CharacterController.isGrounded - a swimmer pursuing in open water stands on nothing, one frozen without a water level keeps what its last Move left (none: nothing), a walker on a floor stands, a flyer hovering does not; every Move the motor makes writes it (mutants: a branch unwritten, the old velY reading)', () => {
  const fish = new EnemyAI(floorAt(0), [0, 2, 0], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: 11, waterSurfaceY: () => 6 });
  assert.equal(fish.isGrounded, false, 'never moved: on nothing');
  for (let i = 0; i < 60 * 3; i++) fish.update(1 / 60, [0, 2.5, 14]);
  assert.ok(fish.feet[2] > 1, `the fish swam (${fish.feet[2]})`);
  assert.equal(fish.isGrounded, false, 'open water: on nothing');
  const frozen = new EnemyAI(floorAt(-10), [0, -1.5, 0], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: 11, waterSurfaceY: () => null });
  for (let i = 0; i < 60; i++) frozen.update(1 / 60, [0, 0, 8]);
  assert.deepEqual(frozen.feet, [0, -1.5, 0], 'no water level: frozen (WaterMove verbatim)');
  assert.equal(frozen.isGrounded, false, 'and on nothing');
  assert.equal(frozen.velY, 0, 'though its velY reads 0 - the old reading called it grounded');
  const walker = new EnemyAI(floorAt(0), [0, 2, 0], 0, { liveSpeed: 50 });
  for (let i = 0; i < 60 * 2; i++) walker.update(1 / 60, [0, 0, 10]);
  assert.equal(walker.isGrounded, true, 'a walker landed on the floor stands');
  const bat = new EnemyAI(floorAt(0), [0, 3, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  for (let i = 0; i < 60 * 2; i++) bat.update(1 / 60, [0, 3, 10]);
  assert.equal(bat.isGrounded, false, 'a flyer in the air stands on nothing');
  // every Move the motor makes writes it
  const moves = MOTOR.match(/this\.collider\.move\(/g).length;
  const written = MOTOR.match(/this\.isGrounded = (?:r|moveResult)\.grounded;/g).length;
  assert.equal(written, moves, 'each Move\'s own');
});

test('FIELD BUGS 2026-09-29 (the sea) #2: a frozen swimmer a hull sails over is never her rider - the world\'s rider handle reads the motor\'s isGrounded, and the swimmer\'s ray down meets the Small Ship\'s hull from inside (the path the old reading took) yet it stands on nothing (mutants: the old velY reading)', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const boat = pool.spawnNow(Object.assign(new Boat(2, 0), { uid: 7 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const geometry = (c) => (c.m_Mesh?.mesh ? pool.models.geometry(c.m_Mesh.mesh) : null);
  // a slaughterfish frozen 3 m under the sea line, the hull sailed over it: inside her hull. PIN MOVED (GALLEON-2,
  // 2026-10-02): her V bottom 4.47 m down under her middle on Mac's second export - from 2.5 m the fish's ray down its
  // height stopped 17 cm short of it
  const fish = new EnemyAI(new Collider(() => -100), [0, -3 - 0.9, 0], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: 11, waterSurfaceY: () => null });
  const centre = [fish.feet[0], fish.feet[1] + fish.centreOffset, fish.feet[2]];
  const hit = raycastColliders(boat.GameObject, centre, [0, -1, 0], fish.height, { triggers: true, geometry });
  assert.ok(hit && hit.node === boat.MeshObject && hit.collider === boat.MeshCollider, 'its ray down its height meets her hull from inside - FixedUpdate\'s rider test would take it');
  for (let i = 0; i < 30; i++) fish.update(1 / 60, [0, 1, 6]);
  assert.equal(liftedGrounded(fish), false, 'the world\'s handle: on nothing - never her rider');
  assert.match(WORLD, /grounded: \(\) => !!ai\.isGrounded,/, 'the handle reads the motor\'s own');
  // a walker stood on her deck still rides her (the mod's own law, untouched)
  const deckY = 30 - raycastColliders(boat.GameObject, [0, 30, 0], [0, -1, 0], 60, { triggers: false, geometry }).distance;
  const c = new Collider(() => -100);
  c.addMesh('deck', new Float32Array([-5, deckY, -5, 5, deckY, -5, 5, deckY, 5, -5, deckY, 5]), quadIdx, I);
  const hand = new EnemyAI(c, [0, deckY + 0.5, 0], 0, { liveSpeed: 50 });
  for (let i = 0; i < 60; i++) hand.update(1 / 60, [0, deckY, 8]);
  assert.equal(liftedGrounded(hand), true, 'a boarder on her deck stands on it');
  pool.remove(boat);
});
