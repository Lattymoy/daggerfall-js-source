// PR-WAGON1 (2026-09-24, a player's report Mac relayed: "Players can grief other players with the wagon by putting it
// in front of dungeon entryways and building entrances"; Mac's choice: "Others' wagons don't block").
//
// THE GRIEF: AUDIT HCC O3 stood another player's PARKED wagon a box in my collider (`hccWagon:<owner>`), and HCC-PARK
// keeps a parked team for 72 hours after its owner leaves - so a wagon left across a shop door or a dungeon's mouth
// walled it off for everyone for days. The box shadowed the door from the activation ray as well, and even without it
// the wagon's AABB and the horse's stood nearer than the door behind them, so the nearest-hit law gave them the click.
//
// THE LAW: another player's team - wagon and horse, live or kept - stands no collider in my world, and YIELDS the ray
// (player/activate.js firmFirst): anything firm the ray meets behind it takes the click, whichever pool picked it; a
// ray that meets nothing else still names it "Owned by ..." and presses it. My own parked wagon is the mod's
// non-trigger BoxCollider as it always was: solid to me, and first on the ray.
//
// Driven through the real pool (scenes/horseCartPool.js) over the REAL collider (player/collider.js) and its capsule,
// the real pick (pickActivatableHit), the real race (player/activationRace.js), the real plaque resolve
// (systems/worldHover.js resolveHover), and the real producers' rows for the door, the bodies and the foe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHorseCartPool, WAGON_BUCKET, KEY_WAGON, KEY_HORSE } from '../src/scenes/horseCartPool.js';
import { HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { WAGON_MODEL_ID, ACTIVATION_REACH, HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT } from '../src/systems/horseCartLaw.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';
import { pickActivatableHit, liveFoeTargets, rayAabb, rayObb, RAY_DISTANCE, DOOR_ACTIVATION_DISTANCE, MOBILE_NPC_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { raceActivation, raceWinner } from '../src/player/activationRace.js';
import { bodyPile, resetBodyStack } from '../src/player/lootStack.js';
import { corpseLootTargets } from '../src/scenes/corpseMarker.js';
import { doorWorldAabb } from '../src/player/enterExit.js';
import { resolveHover } from '../src/systems/worldHover.js';
import { Collider } from '../src/player/collider.js';
import { syntheticWagon41214 } from './hccModel.mjs';
import { mat4FromQuatPos } from '../src/world/quat.js';

const settle = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const Q90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];   // turned a quarter: the wagon lies ACROSS the door, its length along X
const AT = [10, 0, 10];   // where every team here stands (scene metres)
const toScene = (q) => [(q[0] - 100000) / 40, q[1], (q[2] - 200000) / 40];
const W = [100000 + AT[0] * 40, AT[1], 200000 + AT[2] * 40];   // AT in the wire frame
const parkedWord = () => ({ w: [HCC_WIRE_KIND.Deployed, W[0], W[1], W[2], ...Q90, 25, 0] });
const standingHorseWord = () => ({ h: [W[0], W[1], W[2], 1, 0, 0], n: 'Bess' });   // facing +X: its 1.1 width across the ray
const FWD = [0, 0, 1];

/** The pool over the REAL collider (a floor at 0), its art loaded; `mine` is my own runtime's view. */
async function world({ mine = {}, wall = null } = {}) {
  const col = new Collider(() => 0);
  if (wall !== null) {
    // the building's front the door stands in: a static quad across the street at z = wall
    col.addMesh('static', new Float32Array([0, 0, wall, 20, 0, wall, 20, 5, wall, 0, 5, wall]), new Uint32Array([0, 1, 2, 0, 2, 3]), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  const gpu = { [WAGON_MODEL_ID]: { id: WAGON_MODEL_ID } };
  for (const d of CARGO_DEFINITIONS) gpu[d.modelId] = { id: d.modelId };
  const renderer = { createMesh: (m) => ({ m }), drawMesh() {}, createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch() {}, uploadTexture() {} };
  const meshes = { getGpuMesh: async (id) => gpu[id] ?? null, cpuModels: new Map([[WAGON_MODEL_ID, syntheticWagon41214()]]) };
  const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4) });
  const names = { p1: 'Ann' };
  const pool = createHorseCartPool({ renderer, meshes, collider: () => col, now: () => 0, fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), decode, selfId: () => 'me', peerName: (id) => names[id] ?? null, log: { error() {}, warn() {}, info() {} } });
  const calls = [];
  pool.attach({
    view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...mine }),
    lateUpdate() {}, rebase() {}, horseTargetLabel: 'Bess',
    handleDeployedWagonActivation: (d) => { calls.push(['wagon', d]); return true; },
    handleFollowingWagonActivation: () => true, handleStationaryHorseActivation: (d) => { calls.push(['horse', d]); return true; },
  });
  pool.presentation.wagonParts();
  pool.presentation.horseArt.ensureStationary();
  await settle();
  return { pool, col, calls, frame: () => pool.frame(1 / 30, [AT[0], 1.6, 0]) };
}
const mineParked = () => ({ deployed: { isGrounded: true, position: [...AT], rotation: [...Q90], cargoTier: 25 } });
const box = (pool, key) => pool.targets().find((t) => t.key === key)?.aabb;
/** A static door the producer's way (worldModes' exterior door row over enterExit's doorWorldAabb), its padded box's
 *  near face `gap` metres behind z. */
function doorBehind(z, gap = 0.2) {
  const door = { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], centre: { x: AT[0], y: 1.1, z: 0 }, size: { x: 1.2, y: 2.2, z: 0.1 }, normal: { x: 0, y: 0, z: -1 } };
  const e = doorWorldAabb({ ...door, centre: { ...door.centre, z: 0 } }).max[2];   // the pad's half-depth
  door.centre.z = z + gap + e;
  return { door, row: { key: 0, aabb: doorWorldAabb(door), distance: RAY_DISTANCE, reach: DOOR_ACTIVATION_DISTANCE } };
}
/** The hosts' road: the team's pool and the door set are picked apart and raced (world.js / exterior.js). */
const hostRace = (eye, pool, doors, col, extra = {}) => {
  const horseCart = pickActivatableHit(eye, FWD, pool.targets(), col);
  const ground = pickActivatableHit(eye, FWD, doors, col);
  return { horseCart, ground, winner: raceWinner({ horseCart, ground, ...extra }), press: raceActivation({ horseCart, doorDistance: ground?.distance ?? Infinity }) };
};
/** The plaque's word on a pick: the pool names its own, 'Door' the door row. */
const plaque = (pool, hit) => resolveHover(hit, { name: (k) => (k === 0 ? { title: 'Door' } : pool.hoverName(k)) });

test('PR-WAGON1: another player\'s parked wagon stands no collider in my world - their live word and a cell\'s kept word alike - while my own parked wagon still stands the mod\'s box (mutant: a peer\'s box stood again)', async () => {
  const { pool, col, frame } = await world({ mine: { deployed: { isGrounded: true, position: [30, 0, 30], rotation: [0, 0, 0, 1], cargoTier: 25 } } });
  pool.applyOwner('p1', parkedWord(), toScene, 1);
  pool.replaceKept('world:6,9', [{ k: 'k1', id: 'p2', name: 'Bob', r: { w: [HCC_WIRE_KIND.Deployed, W[0] + 800, W[1], W[2], ...Q90, 25, 0] } }], toScene, 0);
  await settle();
  frame(); frame();
  assert.deepEqual([...pool.peers.keys()].sort(), ['kept:k1', 'p1'], 'both teams stand, and are drawn');
  assert.equal(pool.draw({ drawMesh() {} }), 3, 'mine and their two');
  assert.deepEqual([...col._buckets.keys()], [WAGON_BUCKET], 'my wagon is the only wall - AUDIT HCC O3 stood `hccWagon:p1` and `hccWagon:kept:k1` beside it');
  for (const key of ['hccPeer:p1:w', 'hccPeer:kept:k1:w']) {
    const t = pool.targets().find((x) => x.key === key);
    assert.ok(t, key);
    assert.equal(t.noSurface, true, `${key}: no box, so no surface for the ray to meet`);
    assert.equal(t.yields, true, `${key}: and it yields the ray`);
  }
  const own = pool.targets().find((x) => x.key === KEY_WAGON);
  assert.ok(own && own.noSurface === undefined && own.yields === undefined, 'mine is solid and holds the ray, as the mod\'s BoxCollider does');
});

test('PR-WAGON1: a player walks through another player\'s wagon parked across a door, live or kept, and up to the door - and is stopped by their own, exactly as before (the real capsule)', async () => {
  const wallZ = 12;
  const walk = (col) => { const feet = [AT[0], 0, 7]; for (let i = 0; i < 80; i++) col.move(feet, 0, 0, 0.1); return feet; };
  // their live word
  const live = await world({ wall: wallZ });
  live.pool.applyOwner('p1', parkedWord(), toScene, 1);
  await settle(); live.frame();
  const wagon = box(live.pool, 'hccPeer:p1:w');
  assert.ok(wagon && wagon.min[2] > 8.5 && wagon.max[2] < 11.5 && wagon.max[1] > 1, `their wagon stands across the street before the door: ${JSON.stringify(wagon)}`);
  let feet = walk(live.col);
  assert.ok(feet[2] > wagon.max[2], `walked through their wagon (z ${feet[2].toFixed(2)}, its box ends at ${wagon.max[2].toFixed(2)})`);
  assert.ok(Math.abs(feet[2] - (wallZ - 0.35)) < 0.05, `and up to the door, stopped by the building alone (z ${feet[2].toFixed(3)})`);
  // a cell's kept word - the 72-hour one
  const kept = await world({ wall: wallZ });
  kept.pool.replaceKept('world:6,9', [{ k: 'k1', id: 'p2', name: 'Bob', r: parkedWord() }], toScene, 0);
  await settle(); kept.frame();
  assert.ok(box(kept.pool, 'hccPeer:kept:k1:w'), 'the kept team stands');
  feet = walk(kept.col);
  assert.ok(Math.abs(feet[2] - (wallZ - 0.35)) < 0.05, `through the kept one too (z ${feet[2].toFixed(3)})`);
  // my own, in the same place
  const mine = await world({ wall: wallZ, mine: mineParked() });
  mine.frame();
  const myBox = box(mine.pool, KEY_WAGON);
  feet = walk(mine.col);
  assert.ok(feet[2] < myBox.min[2], `my own wagon stops me short of it (z ${feet[2].toFixed(3)}, its box begins at ${myBox.min[2].toFixed(3)})`);
});

test('PR-WAGON1: the door behind another player\'s parked wagon takes the click - in one list, across the hosts\' race, on the plaque and in the press; with nothing behind it the wagon still answers "Owned by Ann"; my own wagon in the same place still takes the click, as its BoxCollider does in DFU (mutants: the wagon not yielding; the hit not saying so; the race not reading it; no fallback to the team)', async () => {
  const { pool, col, frame } = await world();
  pool.applyOwner('p1', parkedWord(), toScene, 1);
  await settle(); frame();
  const wagon = box(pool, 'hccPeer:p1:w');
  const eye = [AT[0], 1, wagon.min[2] - 0.6];
  const { row } = doorBehind(wagon.max[2]);
  const doorD = row.aabb.min[2] - eye[2];
  assert.ok(doorD < DOOR_ACTIVATION_DISTANCE, `the door is within the player's reach behind the wagon (${doorD.toFixed(2)})`);
  assert.equal(pickActivatableHit(eye, FWD, [...pool.targets(), row], col)?.key, 0, 'one list: the door, though the wagon is nearer');
  const r = hostRace(eye, pool, [row], col);
  assert.equal(r.horseCart?.key, 'hccPeer:p1:w'); assert.equal(r.horseCart.yields, true, 'the pool\'s pick says its winner yields');
  assert.ok(r.ground && Math.abs(r.ground.distance - doorD) < 1e-9, 'the door is not shadowed by a box of theirs');
  assert.equal(r.winner?.key, 0, 'the hosts\' race: the door');
  assert.equal(r.press.horseCartWins, false, 'the press goes down the ladder to the door');
  assert.equal(plaque(pool, r.winner)?.title, 'Door', 'the plaque names the door');
  // nothing behind it: the team is still there to be read and pressed
  const alone = hostRace(eye, pool, [], col);
  assert.equal(alone.winner?.key, 'hccPeer:p1:w');
  assert.equal(alone.press.horseCartWins, true);
  const f = plaque(pool, alone.winner);
  assert.equal(f?.title, 'Wagon'); assert.deepEqual(f.subs, ['Owned by Ann'], 'HCC-TIP\'s owner line');
  const said = [];
  assert.equal(pool.activate(alone.horseCart.key, alone.horseCart.distance, (l) => said.push(l)), true);
  assert.deepEqual(said, ['This wagon - owned by Ann.']);
  // MY wagon, parked in the same place before the same door: it is the ray's hit, and the door behind it is not
  const mine = await world({ mine: mineParked() });
  mine.frame();
  assert.equal(pickActivatableHit(eye, FWD, [...mine.pool.targets(), row], mine.col)?.key, KEY_WAGON, 'one list: my wagon');
  const m = hostRace(eye, mine.pool, [row], mine.col);
  assert.equal(m.ground, null, 'the door behind my wagon\'s box is shadowed by it, as DFU\'s one ray is stopped by it');
  assert.equal(m.winner?.key, KEY_WAGON); assert.equal(m.press.horseCartWins, true);
  assert.equal(mine.pool.activate(m.horseCart.key, m.horseCart.distance), true);
  assert.equal(mine.calls.at(-1)[0], 'wagon', 'the mod\'s own DeployedWagonActivator');
});

test('PR-WAGON1: the door behind another player\'s standing horse takes the click, and a dungeon\'s mouth behind their team the same (mutant: the horse not yielding)', async () => {
  const { pool, col, frame } = await world();
  pool.applyOwner('p1', standingHorseWord(), toScene, 1);
  await settle(); frame();
  const horse = box(pool, 'hccPeer:p1:h');
  assert.ok(horse, 'their horse stands, its art up');
  const eye = [AT[0], 1, horse.min[2] - 0.6];
  const { row } = doorBehind(horse.max[2]);
  assert.ok(row.aabb.min[2] - eye[2] < DOOR_ACTIVATION_DISTANCE);
  assert.equal(pickActivatableHit(eye, FWD, [...pool.targets(), row], col)?.key, 0, 'one list: the door');
  const r = hostRace(eye, pool, [row], col);
  assert.equal(r.horseCart?.key, 'hccPeer:p1:h');
  assert.equal(r.winner?.key, 0, 'the hosts\' race: the door, not the horse a pace nearer');
  assert.equal(r.press.horseCartWins, false);
  // with nothing behind it the horse is read by its name and whose it is
  const alone = hostRace(eye, pool, [], col);
  assert.deepEqual(plaque(pool, alone.winner) && { title: plaque(pool, alone.winner).title, subs: plaque(pool, alone.winner).subs }, { title: 'Bess', subs: ['Owned by Ann'] });
  // the whole team - their wagon parked across a dungeon's mouth and the horse beside it - yields it too
  pool.applyOwner('p1', { ...parkedWord(), ...standingHorseWord() }, toScene, 2);
  frame();
  const team = pool.targets().filter((t) => t.key.startsWith('hccPeer:p1:'));
  assert.equal(team.length, 2);
  const near = Math.min(...team.map((t) => t.aabb.min[2]));
  const far = Math.max(...team.map((t) => t.aabb.max[2]));
  const mouth = doorBehind(far).row;
  const e2 = [AT[0], 1, near - 0.6];
  assert.equal(hostRace(e2, pool, [mouth], col).winner?.key, 0, 'the dungeon entrance behind the whole team');
});

test('PR-WAGON1: behind another player\'s team my own horse is still named (the mod\'s HorseNameTooltipController), a pile of bodies still opens at its front with every body its tab (LOOT-STACK), and from INSIDE their wagon\'s box the door ahead takes the click and the wagon is named by nothing (CASTLE1: no surface to meet)', async () => {
  const { pool, col, frame } = await world({ mine: { horse: { isInteractive: true, position: [AT[0], 0, AT[2] + 2.2], forward: [1, 0, 0], walk: { animationFrame: 0, walking: false } } } });
  pool.applyOwner('p1', parkedWord(), toScene, 1);
  await settle(); frame();
  const wagon = box(pool, 'hccPeer:p1:w');
  const eye = [AT[0], 1, wagon.min[2] - 0.6];
  assert.ok(box(pool, KEY_HORSE).min[2] > wagon.max[2], 'my horse stands behind their wagon');
  const hit = pickActivatableHit(eye, FWD, pool.targets(), col);
  assert.equal(hit?.key, KEY_HORSE, 'the pool\'s own list: my horse, not their wagon before it');
  assert.ok(hit.distance <= ACTIVATION_REACH);
  assert.equal(pool.tooltipText(eye, FWD, col), 'Bess', 'the mod\'s name tooltip over my horse, through their wagon');
  // two bodies fallen behind their wagon: the front one opens, and the pile is noted for the window's tabs
  resetBodyStack();
  const z = wagon.max[2] + 0.3;
  const bodies = corpseLootTargets([{ at: [AT[0], 0.6, z] }, { at: [AT[0], 0.6, z + 0.8] }], 'foeCorpse', { isCorpse: () => true, feetOf: (e) => e.at });
  assert.equal(pickActivatableHit(eye, FWD, [...pool.targets(), ...bodies], col)?.key, 'foeCorpse:0', 'the front body, not their wagon');
  assert.deepEqual(bodyPile('foeCorpse:0'), ['foeCorpse:0', 'foeCorpse:1'], 'and the pile behind it, whole');
  resetBodyStack();
  // stood INSIDE their wagon's box - it is no wall now, so a player can
  const inside = [AT[0], 1, AT[2]];
  assert.ok(inside[2] > wagon.min[2] && inside[2] < wagon.max[2]);
  const { row } = doorBehind(wagon.max[2]);
  assert.equal(pickActivatableHit(inside, FWD, [...pool.targets(), row], col)?.key, 0, 'the door ahead');
  assert.equal(hostRace(inside, pool, [row], col).winner?.key, 0);
  const lone = await world();
  lone.pool.applyOwner('p1', parkedWord(), toScene, 1);
  await settle(); lone.frame();
  assert.equal(pickActivatableHit(inside, FWD, lone.pool.targets(), lone.col), null, 'from inside it, with nothing ahead, their wagon is named by nothing - the ray meets no surface of it');
});

test('PR-WAGON1: a townsperson or a live foe behind another player\'s team takes the press - a pick that yields is no rival; the plaque races them the same way (mutant: the yielding pick still a rival)', async () => {
  const { pool, col, frame } = await world();
  pool.applyOwner('p1', parkedWord(), toScene, 1);
  await settle(); frame();
  const wagon = box(pool, 'hccPeer:p1:w');
  const eye = [AT[0], 1, wagon.min[2] - 0.6];
  const horseCart = pickActivatableHit(eye, FWD, pool.targets(), col);
  assert.equal(horseCart?.key, 'hccPeer:p1:w');
  const personD = wagon.max[2] + 1 - eye[2];
  // the press: the person arm consumes below `nonPersonRival`, the foe arm below `rival` (activationRace.js)
  const race = raceActivation({ horseCart, personDistances: [personD] });
  assert.equal(race.nonPersonRival, Infinity, 'nothing firm stands before the townsperson');
  assert.equal(race.rival, personD, 'and the foe must beat the townsperson alone');
  // the hosts' ladder asks the foe arm (below `rival`) and then the person arm (below `nonPersonRival`) BEFORE any
  // custom activation (world.js / exterior.js), so with both open the townsperson takes the press
  assert.ok(personD < race.nonPersonRival, 'the ladder is the person\'s');
  // the plaque: the same people, dressed as the hosts dress them (world.js _hoverPersonPick; liveFoeTargets)
  const person = { key: 'mobileNpc:0', distance: personD, reach: MOBILE_NPC_ACTIVATION_DISTANCE };
  assert.equal(raceWinner({ horseCart, person })?.key, 'mobileNpc:0');
  const foe = pickActivatableHit(eye, FWD, liveFoeTargets([{ ai: { feet: [AT[0], 0, wagon.max[2] + 1], height: 1.8 }, entity: {} }], 'foe'), col);
  assert.equal(foe?.key, 'foe:0');
  assert.equal(raceWinner({ horseCart, foe })?.key, 'foe:0', 'a foe behind their wagon is the ray\'s');
  // and my own team is a rival as it always was: no yield, no change
  const mine = await world({ mine: mineParked() });
  mine.frame();
  const myPick = pickActivatableHit(eye, FWD, mine.pool.targets(), mine.col);
  assert.equal(myPick?.key, KEY_WAGON);
  assert.equal(raceActivation({ horseCart: myPick, personDistances: [personD] }).nonPersonRival, myPick.distance, 'my wagon before the townsperson still takes it');
});

test('AUDIT BRANCH-0925 PRW1-A: another player\'s wagon parked at a slant is met at its OWN turned box (DISC10, as Eye Of The Beholder\'s cart) - a crouched eye in a corner of the square box around it, outside the wagon, still names it "Owned by Ann" and presses it, and that corner\'s empty road names nothing from beyond the wagon\'s reach (mutant: the turned box dropped)', async () => {
  const { pool, col, frame } = await world();
  const Q45 = [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)];   // an eighth turn: the square box around it bulges past the wagon at every corner
  pool.applyOwner('p1', { w: [HCC_WIRE_KIND.Deployed, W[0], W[1], W[2], ...Q45, 25, 0] }, toScene, 1);
  await settle(); frame(); frame();
  const t = pool.targets().find((x) => x.key === 'hccPeer:p1:w');
  assert.ok(t && t.noSurface === true && t.yields === true, 'no box of theirs, and it yields - PR-WAGON1');
  const p = pool.peers.get('p1');
  const m = mat4FromQuatPos(p.shownRotation, p.shownWagon), body = pool.parts.box;   // the wagon's own turned box, as it is drawn
  const inBody = (e) => { const rx = e[0] - m[12], ry = e[1] - m[13], rz = e[2] - m[14]; const l = [rx * m[0] + ry * m[1] + rz * m[2], rx * m[4] + ry * m[5] + rz * m[6], rx * m[8] + ry * m[9] + rz * m[10]]; return l.every((v, i) => v >= body[i] && v <= body[i + 3]); };
  const inAabb = (e) => e.every((v, i) => v >= t.aabb.min[i] && v <= t.aabb.max[i]);
  // a crouched player (the motor's CROUCH_EYE_HEIGHT, below the wagon's top) at the square box's +X/-Z corner
  const eye = [t.aabb.max[0] - 0.3, 0.8, t.aabb.min[2] + 0.3];
  assert.ok(inAabb(eye) && !inBody(eye), 'the eye is inside the square box but outside the wagon');
  const aim = [p.shownWagon[0] - eye[0], (t.aabb.min[1] + t.aabb.max[1]) / 2 - eye[1], p.shownWagon[2] - eye[2]];
  const len = Math.hypot(...aim), dir = aim.map((v) => v / len);
  const bodyD = rayObb(eye, dir, m, body);
  assert.ok(bodyD > 1 && bodyD < ACTIVATION_REACH, `the wagon's side is ${bodyD.toFixed(2)} m ahead, within reach`);
  const hit = pickActivatableHit(eye, dir, pool.targets(), col);
  assert.equal(hit?.key, 'hccPeer:p1:w', 'named: the ray meets the wagon, not a box the eye stands in');
  assert.ok(Math.abs(hit.distance - bodyD) < 1e-9, `at the wagon's own side (${hit.distance.toFixed(3)})`);
  const word = plaque(pool, raceWinner({ horseCart: hit }));
  assert.deepEqual(word && { title: word.title, subs: word.subs }, { title: 'Wagon', subs: ['Owned by Ann'] });
  assert.equal(raceActivation({ horseCart: hit }).horseCartWins, true);
  const said = [];
  assert.equal(pool.activate(hit.key, hit.distance, (l) => said.push(l)), true);
  assert.deepEqual(said, ['This wagon - owned by Ann.']);
  // stood further back on the same line: the square box's corner is within reach, the wagon is not - the empty road
  // there is no wagon to name
  const back = eye.map((v, i) => v - dir[i] * 3.3);
  const cornerD = rayAabb(back, dir, t.aabb), farBody = rayObb(back, dir, m, body);
  assert.ok(cornerD < ACTIVATION_REACH && farBody > ACTIVATION_REACH, `the corner ${cornerD.toFixed(2)} m, the wagon ${farBody.toFixed(2)} m`);
  const far = pickActivatableHit(back, dir, pool.targets(), col);
  assert.ok(far && Math.abs(far.distance - farBody) < 1e-9, `measured to the wagon, not the corner (${far?.distance.toFixed(3)})`);
  assert.equal(plaque(pool, far), null, 'out of reach: nothing is named');
  // and an eye INSIDE the wagon itself still names nothing - CASTLE1: no surface of theirs to meet
  const inside = [p.shownWagon[0], 0.8, p.shownWagon[2]];
  assert.ok(inBody(inside));
  assert.equal(pickActivatableHit(inside, dir, pool.targets(), col), null);
});
