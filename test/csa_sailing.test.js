// CSA-D (2026-09-27) - COME SAIL AWAY'S HELM: systems/comeSailAway.js's sailing half - StartSailing, StopSailing and
// its delayed coroutine, Update's oar arm and LateUpdate's move, CheckCollision's two sweeps, the cargo's weight, the
// beaching and the turns, FixedUpdate's enemies riding a hull, the seven activations and the events that end a sail.
// The runtime runs over the vendored hulls (the real SpawnBoat) and a scripted scene; every expectation is worked out
// here from the C#'s own rules (the line numbers are ComeSailAway.cs's).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../src/systems/comeSailAwayModels.js';
import { Boat, spawnBoat, TRIGGER_MODEL } from '../src/systems/comeSailAwayBoat.js';
import {
  createComeSailAwayRuntime, NO_WATER_LEVEL, ACTIVATION_DISTANCE, ACTIVATIONS, activationModelOf, BOAT_ACTIONS, HANDLING,
  OAR_FATIGUE, CARGO_WEIGHTS, TEMPORARY_SHIP_SCENES, TIME_SCALES, vNormalized, vEquals, vProjectOnPlane, vMoveTowards,
  mathfMoveTowards, mathfClamp, yawOfForward, PASSENGERS_ABOARD_TEXT, NICE_BOAT_TEXT, boardPlaceOf, carriedPoint, yawDelta,
  IRONS_TELL_DEG, IRONS_TELL_WAY, IRONS_TELL_S, IRONS_TEXT, OAR_RUNG_TEXT, OAR_ASTERN_TEXT,
} from '../src/systems/comeSailAway.js';
import { helmButtons, helmHint } from '../src/ui/enhancedHelm.js';   // HELM-LADDER: the sails' button is the toggle, the line the ladder
import { animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { quatRotate, quatAngleAxis } from '../src/world/quat.js';

const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const f = Math.fround;
const close = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
const closeV = (a, b, eps = 1e-4, msg = '') => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(close(v, b[i], eps), `${msg} [${i}] ${v} vs ${b[i]}`)); };
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });
const forwardOf = (node) => quatRotate(node.rotation, [0, 0, 1]);

/** A terrain record as the host hands it: every tile water unless told. */
function terrain(x, y, { tile = 0 } = {}) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128).fill(tile << 2), sampleHeight: () => 20 };
}

/** The scripted scene: the helm's seams recorded, the keys held as a set, Time.deltaTime a quarter second (exact). */
function scene(opts = {}) {
  const out = { hud: [], mid: [], log: [], removed: [], boxes: [], packed: [], sailing: [], fatigue: [], scenes: [], assigned: [], footsteps: [], facing: [], aligned: [], timeScales: [], casts: [] };
  const held = new Set(opts.held ?? []);
  const started = new Set();
  const player = { position: [1, 2, 3], yaw: 0, frozen: 0, running: true, transport: opts.transport ?? 'Foot' };
  const terrains = opts.terrains ?? [terrain(10, 20)];
  const input = {
    has: (a) => held.has(a),
    started: (a) => started.has(a),
    horizontal: () => (held.has('MoveRight') ? 1 : 0) - (held.has('MoveLeft') ? 1 : 0),
    vertical: () => (held.has('MoveForwards') ? 1 : 0) - (held.has('MoveBackwards') ? 1 : 0),
    toggleAutorun: false,
  };
  let owns = !!opts.ownsShip;
  let timeScale = 1;
  const deps = {
    pool: {
      models: MODELS,
      ready: () => true,
      spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; },
      remove: (b) => out.removed.push(b),
    },
    player: () => ({ position: [...player.position], rotation: [0, Math.sin((player.yaw * Math.PI / 180) / 2), 0, Math.cos((player.yaw * Math.PI / 180) / 2)] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }),
    isPlayerInside: () => false,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: opts.raycast ?? (() => null),
    playerTerrain: () => terrains[0],
    terrainAt: (x, y) => terrains.find((t) => t.mapPixelX === x && t.mapPixelY === y) ?? null,
    terrains: () => terrains,
    heightMapValue: opts.heightMapValue ?? (() => 255),   // CSA-F: WOODS.WLD all land - the waves lay nothing, and cast no ray
    worldCompensation: () => [0, 0, 0],
    hudText: (t) => out.hud.push(t),
    midScreenText: (t, s) => out.mid.push([t, s]),
    log: (t) => out.log.push(t),
    random: { range: (min) => min },
    time: () => 0,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (items) => items.map((it) => ({ ...it })), deserialize: (records) => records.map((it) => ({ ...it })) },
    dt: () => 0.25,
    setting: (key) => ({ 'Waves.Enable': false, ...opts.settings })[key],   // CSA-F: the helm measured with no current - FixedUpdate writes none with the waves off (csa_waves pins it)
    input,
    helm: {
      setPlayerPosition: (p) => { player.position = [...p]; },
      setFacing: (yaw, pitch) => { player.yaw = yaw; out.facing.push([yaw, pitch]); },
      turnPlayer: (d) => { player.yaw += d; },
      freeze: (s) => { player.frozen = s; },
      frozen: () => player.frozen > 0,
      stopRunning: () => { player.running = false; },
      footsteps: (on) => out.footsteps.push(on),
      alignToGround: (d) => out.aligned.push(d),
    },
    transport: { isFoot: () => player.transport === 'Foot', setFoot: () => { player.transport = 'Foot'; }, hasHorse: () => !!opts.horse, hasCart: () => !!opts.cart },
    ship: { owns: () => owns, assign: (t) => { out.assigned.push(t); owns = t !== 'None'; }, removePermanentScene: (n) => out.scenes.push(n) },
    entity: { isFemale: () => !!opts.female, carriedWeight: () => opts.carried ?? 10, wagonWeight: () => opts.wagon ?? 0, decreaseFatigue: (n) => out.fatigue.push(n) },
    cargoWeight: (items) => items.reduce((a, i) => a + (i.weight ?? 0), 0),
    sphereCastAll: (o, r, d, dist) => { out.casts.push({ o: [...o], r, d: [...d], dist }); return (typeof opts.casts === 'function' ? opts.casts(out.casts.length - 1, o, d) : null) ?? []; },
    enemies: () => opts.enemies ?? [],
    timeScale: () => timeScale,
    setTimeScale: (s) => { timeScale = s; out.timeScales.push(s); },
    messageBox: (t) => out.boxes.push(t),
    // CSA-H: PackBoat is the runtime's now - its parts item minted here and handed to the pack
    items: { create: (templateIndex) => ({ group: 'UselessItems2', templateIndex, name: templateIndex === 1320 ? 'Parts of' : 'Deed to', message: 0, UID: 900 + out.packed.length }), addToPlayer: (item) => out.packed.push(item) },
  };
  const rt = createComeSailAwayRuntime(deps);
  rt.on('OnUpdateSailing', (v) => out.sailing.push(v));
  /** One frame as the host runs it: the end of the last frame's coroutines, FixedUpdate, Update, LateUpdate.
   *  HELM-LADDER: a key that goes down is a press that frame (the world's latch edge) - and one held as the helm is
   *  taken is pressed at the helm, so a scene `held: ['MoveForwards']` puts her oars to pulling ahead, one rung. */
  let downBefore = new Set();
  const frame = ({ press = [] } = {}) => {
    started.clear();
    for (const a of press) started.add(a);
    for (const a of held) if (!downBefore.has(a)) started.add(a);
    rt.endOfFrame();
    rt.fixedUpdate();
    rt.update();
    rt.lateUpdate();
    started.clear();
    downBefore = rt.isSailing() ? new Set(held) : new Set();
  };
  const place = (hull = 1, variant = 0, position = [100, 34, 200], direction = [0, 0, 1]) => rt.PlaceBoat(position, direction, hull, variant, terrains[0]);
  return { rt, out, player, input, held, frame, place, deps, setTimeScale: (s) => { timeScale = s; }, terrains };
}

// ── Unity's arithmetic ────────────────────────────────────────────────────────

test('CSA-D: Unity\'s vector arithmetic in its floats - normalized\'s epsilon, Vector3 ==, ProjectOnPlane, the MoveTowards trio and Clamp\'s NaN', () => {
  assert.deepEqual(vNormalized([0, 0, 5e-6]), [0, 0, 0], 'under kEpsilon the zero vector');
  closeV(vNormalized([3, 0, 4]), [0.6, 0, 0.8], 1e-7);
  assert.equal(vEquals([1, 2, 3], [1, 2, 3 + 5e-6]), true, 'within kEpsilon they are equal');
  assert.equal(vEquals([1, 2, 3], [1, 2, 3 + 2e-5]), false);
  assert.equal(vEquals([NaN, 0, 0], [NaN, 0, 0]), false, 'a NaN is never equal');
  closeV(vProjectOnPlane([1, 2, 3], [0, 2, 0]), [1, 0, 3], 1e-7);
  assert.deepEqual(vProjectOnPlane([1, 2, 3], [0, 0, 0]), [1, 2, 3], 'a zero normal leaves the vector');
  assert.deepEqual(vMoveTowards([0, 0, 0], [0, 0, 2], 0.25), [0, 0, 0.25]);
  assert.deepEqual(vMoveTowards([0, 0, 1.9], [0, 0, 2], 0.25), [0, 0, 2], 'within the step: the target');
  assert.deepEqual(vMoveTowards([0, 0], [3, 4], 1), [f(0.6), f(0.8)], 'Vector2 too');
  assert.ok(vMoveTowards([0, 0, 0], [NaN, NaN, NaN], NaN).every(Number.isNaN), 'a NaN target poisons the vector');
  assert.equal(mathfMoveTowards(0, 20, 2.5), 2.5);
  assert.equal(mathfMoveTowards(19, 20, 2.5), 20);
  assert.equal(mathfMoveTowards(0, -20, 2.5), -2.5);
  assert.ok(Number.isNaN(mathfMoveTowards(0, NaN, NaN)));
  assert.equal(mathfClamp(-Infinity, 0, 1), 0);
  assert.ok(Number.isNaN(mathfClamp(NaN, 0, 1)), 'Mathf.Clamp lets a NaN through');
  assert.equal(yawOfForward([1, 0, 0]), 90);
  assert.equal(yawOfForward([0, 0, -1]), 180);
  assert.equal(yawOfForward([-1, 0, 0]), 270);
  assert.deepEqual(TIME_SCALES, [1, 5, 10, 15, 30]);
  assert.equal(HANDLING.moveAccelSail, f(0.2));
});

// ── the helm taken ────────────────────────────────────────────────────────────

test('CSA-D: StartSailing - the player parented at the helm facing the bow, the cargo weighed, the nodes and the collision read, the idle crew swapped for the active, the footsteps off, OnUpdateSailing(true)', () => {
  const s = scene({ transport: 'Horse' });
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  assert.ok(s.rt.state.CurrentBoat === boat, 'CurrentBoat');   // identities by ===: a failing diff of a boat's graph never ends (sameObjects' note, csa_placing)
  assert.equal(s.rt.isSailing(), true);
  assert.deepEqual(s.out.hud, ['You control the boat!']);
  assert.equal(s.player.transport, 'Foot', 'TransportMode set to Foot');
  assert.deepEqual(s.out.assigned, [], 'a crewless boat borrows no ship');
  closeV(s.player.position, boat.DrivePosition.position, 1e-5, 'at the DrivePosition');
  assert.deepEqual(s.out.facing[0], [0, 0], 'SetFacing(0, 0) in the boat\'s frame: its own bow, level');
  assert.ok(s.rt.playerParent === boat, 'the player\'s parent');
  assert.deepEqual(boat.MapPixel, { X: 10, Y: 20 });
  // 175 (a man) + 10 carried against 500 x the skiff's Cargo 1: well under - no word, the mod at one
  assert.equal(s.rt.state.boatCargoMod, 1);
  assert.equal(s.rt.state.lastWeight, 185);
  assert.deepEqual(s.out.mid, []);
  assert.deepEqual([...boat.NodeTileMapIndices], [0, 0, 0, 0, 0], 'the nodes read the water');
  assert.equal(s.out.casts.length, 2, 'CheckCollision swept forward and back');
  assert.equal(boat.IdleObject.activeSelf, false);
  assert.equal(boat.ActiveObject.activeSelf, true);
  assert.deepEqual(s.out.footsteps, [false]);
  assert.deepEqual(s.out.sailing, [true]);
});

test('CSA-D: a crewed ship - with no ship of their own the player is assigned the small one (TemporaryShip); leaving the helm removes the LARGE ship\'s two scenes (kept bug for bug) and takes the ship back', () => {
  const s = scene();
  const galleon = s.place(2, 0);
  assert.equal(galleon.crewed, true);
  s.rt.StartSailing(galleon);
  assert.deepEqual(s.out.assigned, ['Small']);
  assert.equal(s.rt.state.TemporaryShip, true);
  s.rt.StopSailing();
  assert.deepEqual(s.out.scenes, [...TEMPORARY_SHIP_SCENES]);
  assert.deepEqual(TEMPORARY_SHIP_SCENES, ['DaggerfallWorld [mapX=5, mapY=5]', 'DaggerfallInterior [MapID=2102157, BuildingKey=16777216]']);
  assert.deepEqual(s.out.assigned, ['Small', 'None']);
  assert.equal(s.rt.state.TemporaryShip, false);
  // a player who owns a ship borrows none
  const t = scene({ ownsShip: true });
  t.rt.StartSailing(t.place(2, 0));
  assert.deepEqual(t.out.assigned, []);
  assert.equal(t.rt.state.TemporaryShip, false);
});

// ── the oars ──────────────────────────────────────────────────────────────────

test('CSA-D: rowing forward - Update pins the player and freezes the motor, MoveVectorCurrent climbs to moveSpeed at moveAccel, LateUpdate translates the boat along its bow and the player with it; a crewless boat\'s oars cost 11 fatigue each second', () => {
  const s = scene({ held: ['MoveForwards'] });
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  const start = boat.GameObject.position;
  s.frame();
  assert.equal(s.player.frozen, 1, 'FreezeMotor = 1');
  assert.equal(s.player.running, false, 'SpeedChanger.isRunning = false');
  // moveSpeedOar 2 x 1 x cargo 1 x the skiff's 1; moveAccelOar 1: a quarter second's step is 0.25
  assert.deepEqual(s.rt.state.MoveVectorTarget, [0, 0, 1]);
  assert.deepEqual(s.rt.state.velocityTarget, [0, 0, 2]);
  assert.deepEqual(s.rt.state.MoveVectorCurrent, [0, 0, 0.25]);
  closeV(boat.GameObject.position, [start[0], start[1], start[2] + 0.0625], 1e-5, 'Translate(0.25 x 0.25) along the bow (+z)');
  closeV(s.player.position, boat.DrivePosition.position, 1e-5, 'the child moved with its parent');
  for (let i = 0; i < 9; i++) s.frame();
  assert.deepEqual(s.rt.state.MoveVectorCurrent, [0, 0, 2], 'eight quarter seconds to the top speed');
  // the fatigue: the first frame's check read last frame's zero target; the timer then climbs 0.25 a frame and the
  // frame after it reaches one it pays and restarts - frame 6, then frame 11
  assert.deepEqual(s.out.fatigue, [OAR_FATIGUE]);
  // coasting: the oars at rest (HELM-LADDER: a rung down - letting the key go rows on) and the sails' 0.2 acceleration
  // takes the speed down (kept - moveAccel's third arm)
  s.held.clear();
  s.frame({ press: ['MoveBackwards'] });
  assert.deepEqual(s.out.fatigue, [OAR_FATIGUE, OAR_FATIGUE], 'frame 11 still pays: the check reads the target the frame before set');
  assert.deepEqual(s.rt.state.MoveVectorTarget, [0, 0, 0]);
  closeV(s.rt.state.MoveVectorCurrent, [0, 0, 2 - 0.05], 1e-6);
  assert.equal(s.rt.properties.moveAccel(), f(0.2));
});

test('CSA-D: the turns - right is TurnTarget 1 at turnSpeedOar 20 by turnAccelOar 10, the boat and the player\'s yaw turning together; backwards reverses the helm; Run strafes at half; the nodes the C# asks are one along (kept, but astern - FIELD BUGS 2026-10-02 ASTERN)', () => {
  const s = scene({ held: ['MoveRight'] });
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  const yaw0 = s.player.yaw;
  s.frame();
  assert.equal(s.rt.state.TurnTarget, 1);
  assert.equal(s.rt.state.TurnCurrent, 2.5, 'MoveTowards(0, 20, 10 x 0.25)');
  closeV(forwardOf(boat.GameObject), quatRotate(quatAngleAxis(0.625, [0, 1, 0]), [0, 0, 1]), 1e-6, 'Rotate(up x 2.5 x 0.25)');
  assert.ok(close(s.player.yaw - yaw0, 0.625, 1e-4), 'the child turned with the boat');
  // right turns count toward the oars' fatigue, left turns never do (TurnTarget > 0, kept)
  s.held.clear(); s.held.add('MoveLeft');
  s.frame();
  assert.equal(s.rt.state.TurnTarget, -1);
  // backwards with a side key: the helm reversed (HELM-LADDER: from pulling ahead, two rungs down - at rest, backing water)
  s.held.clear(); s.held.add('MoveRight');
  s.frame({ press: ['MoveBackwards'] });
  s.frame({ press: ['MoveBackwards'] });
  assert.equal(s.rt.state.TurnTarget, -1, 'back and right: -1');
  assert.deepEqual(s.rt.state.MoveVectorTarget, [0, 0, -1]);
  // Run with a side key: a strafe, no turn (the oars a rung up, at rest)
  s.held.clear(); s.held.add('Run'); s.held.add('MoveRight');
  s.frame({ press: ['MoveForwards'] });
  assert.equal(s.rt.state.TurnTarget, 0);
  assert.deepEqual(s.rt.state.MoveVectorTarget, [0.5, 0, 0]);
  // the node the C# asks for each: forward - the CENTRE (0); back - the bow (1), the port's the STERN (2: FIELD BUGS
  // 2026-10-02 ASTERN, fb1002_seaheld); right strafe - the stern (2); left - the starboard (3)
  const n = boat.NodeTileMapIndices;
  s.terrains[0].tileMap.fill(0);
  s.held.clear(); s.held.add('MoveForwards');
  s.rt.state.CurrentBoat.NodeTileMapIndices = n;
  // HELM-LADDER: the oars' rung the keys name - pulling ahead, backing water, else at rest
  const target = (nodes, keys) => { s.held.clear(); for (const k of keys) s.held.add(k); s.rt.state.oarThrottle = keys.includes('MoveForwards') ? 1 : keys.includes('MoveBackwards') ? -1 : 0; s.rt.state.lastBoatPosition = boat.GameObject.position; s.rt.state.lastBoatDirection = forwardOf(boat.GameObject); n.splice(0, 5, ...nodes); s.rt.update(); return [...s.rt.state.MoveVectorTarget]; };
  assert.deepEqual(target([1, 0, 0, 0, 0], ['MoveForwards']), [0, 0, 0], 'the centre off water refuses forward');
  assert.deepEqual(target([0, 1, 0, 0, 0], ['MoveForwards']), [0, 0, 1], '...the bow does not');
  assert.deepEqual(target([0, 1, 0, 0, 0], ['MoveBackwards']), [0, 0, -1], 'ASTERN: the bow off water backs off it');
  assert.deepEqual(target([0, 0, 1, 0, 0], ['MoveBackwards']), [0, 0, 0], 'ASTERN: the stern off water refuses backward');
  assert.deepEqual(target([0, 0, 1, 0, 0], ['Run', 'MoveRight']), [0, 0, 0], 'the stern refuses the right strafe');
  assert.deepEqual(target([0, 0, 0, 1, 0], ['Run', 'MoveLeft']), [0, 0, 0], 'the starboard node refuses the left one');
  assert.deepEqual(target([0, 0, 0, 0, 1], ['Run', 'MoveLeft']), [-0.5, 0, 0], 'the port node is asked by nothing');
});

// ── the collision ─────────────────────────────────────────────────────────────

test('CSA-D: CheckCollision - two sweeps of the half-beam along the hull; each collider met but the boat\'s own, a terrain\'s and an entity\'s gives a flat direction from it to the boat; the first sweep keeps a start overlap\'s zero point (kept bug), the second refuses it', () => {
  let other = null;
  const s = scene({
    casts: (i, o) => {
      if (i === 0) return [
        { point: [other.position[0], o[1], o[2] + 6], name: 'Pier', root: null },
        { point: [o[0] + 1, o[1], o[2]], name: 'OldSkiffHull', root: other },   // the boat's own
        { point: [o[0], o[1] - 3, o[2] + 2], name: 'DaggerfallTerrain', root: null, terrain: true },
        { point: [o[0] - 2, o[1], o[2]], name: 'DaggerfallEnemy', root: null, entity: true },
        { point: [0, 0, 0], name: 'Rock', root: null },   // a start overlap: Unity answers the zero point
      ];
      if (i === 1) return [{ point: [0, 0, 0], name: 'Rock', root: null }];
      return [];
    },
  });
  const boat = s.place(1, 0, [100, 34, 200]);
  other = boat.GameObject;
  s.rt.StartSailing(boat);
  // the sweep: from the hull collider's world centre, radius its mesh's half-beam, the length between the ends' spheres
  const local = MODELS.meshes.OldSkiffHull.aabb;
  const c0 = s.out.casts[0];
  assert.ok(close(c0.r, local.extent[0], 1e-6), 'radius = sharedMesh.bounds.extents.x');
  assert.ok(close(c0.dist, local.extent[2] - local.extent[0], 1e-4), 'length = extents.z - x: her own end (FIELD BUGS 2026-10-02b ROCK-REACH, a departure - the C#\'s reached twice that, half a hull past her end)');
  closeV(c0.d, [0, 0, 1], 1e-6, 'the first sweep toward the bow');
  closeV(s.out.casts[1].d, [0, 0, -1], 1e-6, 'the second toward the stern');
  assert.deepEqual(s.out.log.filter((l) => l.startsWith('COME SAIL AWAY - BOAT COLLIDED')), ['COME SAIL AWAY - BOAT COLLIDED WITH Pier', 'COME SAIL AWAY - BOAT COLLIDED WITH Rock']);
  const dirs = s.rt.state.collisionDirections;
  assert.equal(dirs.length, 2);
  closeV(dirs[0], [0, 0, -1], 1e-6, 'from the pier ahead: aft');
  closeV(dirs[1], vNormalized([100, 0, 200]), 1e-6, 'the zero point: the direction from the scene\'s origin (kept bug for bug)');
  closeV(s.rt.state.CollisionVector, vNormalized([dirs[0][0] + dirs[1][0], 0, dirs[0][2] + dirs[1][2]]), 1e-5, 'the sum, normalised, in the boat\'s frame (yaw 0 here)');
});

test('CSA-D: a collision ahead pushes the boat off at one metre a second (ProjectOnPlane plus the vector) and refuses the turn that swings into it; none clears the vector', () => {
  let blocked = true;
  let root = null;
  const s = scene({ held: ['MoveForwards'], casts: (i, o) => (blocked && i % 2 === 0 ? [{ point: [root.position[0], o[1], o[2] + 6], name: 'Pier', root: null }] : []) });
  const boat = s.place(1, 0, [100, 34, 200]);
  root = boat.GameObject;
  s.rt.StartSailing(boat);
  assert.deepEqual(s.rt.state.CollisionVector, [0, 0, -1]);
  // a pier dead ahead: forward . c = -1 < 0 and right . c = 0 >= 0 - the left turn is refused, the right is not
  assert.equal(s.rt.CanTurnLeft(boat), false);
  assert.equal(s.rt.CanTurnRight(boat), true);
  const z0 = boat.GameObject.position[2];
  s.frame();
  assert.deepEqual(s.rt.state.MoveVectorCurrent, [0, 0, -1], 'the bow\'s share projected out, the push added');
  closeV(boat.GameObject.position, [100, 34, z0 - 0.25], 1e-5, 'backing off at 1 m/s');
  s.held.clear(); s.held.add('MoveLeft');
  s.frame();
  assert.equal(s.rt.state.TurnTarget, 1, 'the refused left turn becomes a right one');
  assert.equal(s.rt.state.TurnCurrent, 3.5, 'TurnCurrent set to it at once, then the frame\'s MoveTowards step on top: 1 + 10 x 0.25');
  blocked = false;
  s.frame();   // the boat moved, so the nodes and the collision are read again
  assert.deepEqual(s.rt.state.CollisionVector, [0, 0, 0]);
  assert.deepEqual(s.rt.state.collisionDirections, []);
});

// ── the beach and the cargo ───────────────────────────────────────────────────

test('CSA-D: IsBeached - more than three nodes off water stops the boat dead in Update and holds LateUpdate\'s move; CanSail wants all five', () => {
  const s = scene({ held: ['MoveForwards'] });
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  s.frame();
  assert.ok(s.rt.state.MoveVectorCurrent[2] > 0);
  s.terrains[0].tileMap.fill(5 << 2);   // land all round
  const p = boat.GameObject.position;
  s.frame();   // LateUpdate reads the land (the boat moved last frame) - and, beached, does not move
  assert.deepEqual([...boat.NodeTileMapIndices], [5, 5, 5, 5, 5]);
  assert.deepEqual(boat.GameObject.position, p, 'the frame that read the beach did not translate it, though its vector still ran');
  assert.ok(s.rt.state.MoveVectorCurrent[2] > 0, '...the vector Update zeroes only on the next frame');
  s.frame();
  assert.deepEqual(s.rt.state.MoveVectorCurrent, [0, 0, 0], 'Update zeroed it');
  assert.deepEqual(s.rt.state.MoveVectorTarget, [0, 0, 0], '...and the target with it - forward needs the centre on water');
  const q = boat.GameObject.position;
  s.frame();
  assert.deepEqual(boat.GameObject.position, q, 'beached: no Translate');
  boat.NodeTileMapIndices.splice(0, 5, 0, 0, 0, 1, 1);
  assert.equal(s.rt.IsBeached(boat), false, 'two off is not beached');
  assert.equal(s.rt.CanSail(boat), false);
  boat.NodeTileMapIndices.splice(0, 5, 0, 1, 1, 1, 1);
  assert.equal(s.rt.IsBeached(boat), true);
  boat.NodeTileMapIndices.fill(0);
  assert.equal(s.rt.CanSail(boat), true);
});

test('CSA-D: UpdateBoatCargoMod - the cargo, the player (120 a woman, 175 a man), what they carry and their cart\'s load against the threshold; past it the mod falls and the helm says so, once per weight', () => {
  const s = scene({ carried: 300, wagon: 200, settings: { 'Cargo.CargoThreshold': 500 } });
  const boat = s.place(1, 0);
  boat.Cargo.Items.push({ weight: 150 });
  s.rt.StartSailing(boat);
  // 150 + 175 + 300 + 200 = 825: 2 - 825/500 = 0.35
  assert.equal(s.rt.state.lastWeight, 825);
  assert.ok(close(s.rt.state.boatCargoMod, 0.35, 1e-6));
  assert.deepEqual(s.out.mid, [["You're going to need a bigger boat", 3]]);
  s.rt.OnNewMagicRound();
  assert.equal(s.out.mid.length, 1, 'the same weight: no second word');
  boat.Cargo.Items.length = 0;
  s.rt.OnNewMagicRound();   // 675: 2 - 1.35 = 0.65
  assert.deepEqual(s.out.mid.at(-1), ['The boat draws a little lower than usual', 3]);
  assert.ok(close(s.rt.properties.moveSpeed(), 2 * 0.65, 1e-6), 'the mod scales the speeds');
  // the switches, the horse and the cart
  const t = scene({ female: true, carried: 0, horse: true, cart: true, settings: { 'Cargo.HorseItem': true, 'Cargo.CartItem': true, 'Cargo.CartCarriedWeight': false } });
  t.rt.StartSailing(t.place(1, 0));
  assert.equal(t.rt.state.lastWeight, CARGO_WEIGHTS.female + CARGO_WEIGHTS.horse + CARGO_WEIGHTS.cart);
});

test('CSA-D: KEPT BUG FOR BUG - the Carrack has no Cargo modifier, so its threshold is nought: any weight clamps the mod to 0 (it cannot move), and no weight at all makes it NaN, which Unity\'s transform refuses', () => {
  const s = scene({ held: ['MoveForwards'] });
  const carrack = s.place(4, 0);
  assert.equal(carrack.modifierCargoThreshold, 0);
  s.rt.StartSailing(carrack);
  assert.equal(s.rt.state.boatCargoMod, 0);
  assert.deepEqual(s.out.mid, [["You're going to need a bigger boat", 3]]);
  const p = carrack.GameObject.position;
  s.frame();
  assert.deepEqual(s.rt.state.MoveVectorCurrent, [0, 0, 0], 'moveAccel is 0 too');
  assert.deepEqual(carrack.GameObject.position, p);
  const t = scene({ held: ['MoveForwards'], carried: 0, settings: { 'Cargo.PlayerWeight': false } });
  const c2 = t.place(4, 0);
  t.rt.StartSailing(c2);
  assert.ok(Number.isNaN(t.rt.state.boatCargoMod), '0 / 0');
  const q = c2.GameObject.position;
  t.frame();
  assert.ok(t.rt.state.MoveVectorCurrent.every(Number.isNaN));
  assert.deepEqual(c2.GameObject.position, q, 'the position setter refused the NaN');
  assert.ok(t.out.log.some((l) => l.startsWith("transform.position assign attempt for 'Boat' is not valid.")), 'with Unity\'s own complaint');
});

// ── the helm left ─────────────────────────────────────────────────────────────

test('CSA-D: StopSailingDelayed (the Disembark key, or Transport) - the head at once, the un-parenting at the frame\'s end, then the player held at the helm each frame\'s end until the motor\'s freeze runs out; only then OnUpdateSailing(false)', () => {
  const s = scene({ held: ['MoveForwards'] });
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  s.frame();
  s.frame({ press: [BOAT_ACTIONS.disembark] });
  assert.equal(s.rt.isSailing(), false, 'disembarking: IsSailing is false at once');
  assert.ok(s.rt.state.CurrentBoat === boat, '...though CurrentBoat stays until the frame\'s end');
  assert.deepEqual(s.out.hud.at(-1), 'You stop controlling the boat!');
  assert.deepEqual(s.rt.state.MoveVectorCurrent, [0, 0, 0.25], 'the head zeroed it - and the rest of that Update ran on, the oars pulling again (kept)');
  assert.deepEqual(s.rt.state.TurnCurrent, 0);
  assert.equal(boat.ActiveObject.activeSelf, false);
  assert.equal(boat.IdleObject.activeSelf, true);
  assert.deepEqual(s.out.footsteps, [false, true]);
  assert.ok(s.rt.playerParent === boat, 'the player\'s parent');
  s.rt.endOfFrame();
  assert.ok(s.rt.state.CurrentBoat === null, 'no CurrentBoat');
  assert.equal(s.rt.playerParent, null, 'SetParent(null, true)');
  assert.deepEqual(s.out.facing.at(-1), [s.player.yaw, 0], 'SetHorizontalFacing(forward): the yaw kept, level');
  assert.deepEqual(s.out.sailing, [true], 'still held: the freeze has not run out');
  s.player.position = [0, 0, 0];
  s.rt.endOfFrame();
  closeV(s.player.position, boat.DrivePosition.position, 1e-6, 'held at the helm while frozen');
  s.player.frozen = 0;
  s.rt.endOfFrame();
  assert.deepEqual(s.out.sailing, [true, false]);
  assert.equal(s.rt.state.disembarking, null);
  // Transport disembarks too (Actions 15)
  const t = scene();
  t.rt.StartSailing(t.place(1, 0));
  t.frame({ press: ['Transport'] });
  assert.equal(t.rt.isSailing(), false);
  // and a second press while disembarking starts no second coroutine
  t.rt.StopSailingDelayed();
  assert.equal(t.out.hud.filter((h) => h === 'You stop controlling the boat!').length, 1);
});

test('CSA-D: StopSailing at once (a death, a load, fast travel) - the player set down at the helm, the freeze lifted, OnUpdateSailing(false) - and the three events that call it', () => {
  const s = scene();
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  s.frame();
  s.rt.OnPlayerDeath();
  assert.ok(s.rt.state.CurrentBoat === null, 'no CurrentBoat');
  assert.equal(s.player.frozen, 0);
  closeV(s.player.position, boat.DrivePosition.position, 1e-6);
  assert.deepEqual(s.out.sailing, [true, false]);
  // OnPreFastTravel: placing stops; a packable boat sailed is packed (PackBoat - CSA-H's)
  const t = scene();
  const skiff = t.place(1, 0);
  t.rt.StartPlacing({ message: 10 }, []);
  t.rt.StartSailing(skiff);
  t.rt.OnPreFastTravel();
  assert.equal(t.rt.placing, false);
  assert.equal(t.rt.isSailing(), false);
  assert.deepEqual(t.out.packed.map((it) => [it.templateIndex, it.message, it.name]), [[1320, 10, "Parts of Large Boat 'I'"]], 'the sailed skiff packed as its parts');
  assert.ok(!t.rt.AllBoats.includes(skiff) && t.out.removed.includes(skiff), '...and gone');
  // OnStartLoad: the riders dropped, the helm left
  const u = scene();
  u.rt.StartSailing(u.place(1, 0));
  u.rt.state.parentedObjects.set('x', { enemy: null, boat: null });
  u.rt.OnStartLoad();
  assert.equal(u.rt.isSailing(), false);
  assert.equal(u.rt.state.parentedObjects.size, 0);
  // not sailing: ResetTimeScale(false) - another mod's scale back to one, said nothing
  const v = scene();
  v.setTimeScale(50);
  v.rt.OnPlayerDeath();
  assert.deepEqual(v.out.timeScales, [1]);
  assert.deepEqual(v.out.mid, []);
});

test('CSA-D: the lantern key toggles the boat\'s lights at the helm; the helm key is the registry\'s action', () => {
  const s = scene();
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  const was = boat.LightOn;
  s.frame({ press: [BOAT_ACTIONS.toggleLight] });
  assert.equal(boat.LightOn, !was);
  s.frame();
  assert.equal(boat.LightOn, !was, 'a press, not a hold');
  assert.deepEqual(BOAT_ACTIONS, {
    disembark: 'BoatDisembark', toggleLight: 'BoatToggleLight',
    toggleSail: 'BoatToggleSail', trimRight: 'BoatTrimRight', trimLeft: 'BoatTrimLeft', trimModifier: 'BoatTrimModifier',   // CSA-E's four
    timeScaleUp: 'BoatTimeScaleUp', timeScaleDown: 'BoatTimeScaleDown', timeScaleReset: 'BoatTimeScaleReset',   // CSA-G's three
    sailUp: 'BoatSailUp', sailDown: 'BoatSailDown',   // HELM-KEYS' two (the port's)
  });
});

// ── the activations ───────────────────────────────────────────────────────────

test('CSA-D: the seven activations - the hit object\'s name cut at its first "]"; the helm takes or leaves the boat, packs it in Steal mode (refused while driven), the board stands the player at its sibling, the status says "Nice Boat!"; beyond 3.2 nothing', () => {
  assert.equal(activationModelOf('DaggerfallMesh [ID=112400] [Replacement]'), TRIGGER_MODEL.drive);
  assert.equal(activationModelOf('DaggerfallMesh [ID=112406]'), TRIGGER_MODEL.position);
  assert.equal(activationModelOf('DaggerfallMesh [ID=112410] [Replacement]'), null, 'a hull is no activation');
  assert.equal(activationModelOf('OldSkiffHull'), null);
  assert.equal(Object.keys(ACTIVATIONS).length, 7);
  assert.equal(ACTIVATION_DISTANCE, f(3.2));
  const s = scene();
  const boat = s.place(1, 0);
  const rudder = { root: boat.GameObject, node: boat.DriveTrigger, distance: 2 };
  assert.equal(s.rt.activate(TRIGGER_MODEL.drive, { ...rudder, distance: 3.3 }, 'grab'), false, 'too far: the custom activation is not run');
  assert.equal(s.rt.isSailing(), false);
  s.rt.activate(TRIGGER_MODEL.drive, rudder, 'grab');
  assert.equal(s.rt.isSailing(), true);
  s.rt.activate(TRIGGER_MODEL.drive, rudder, 'steal');
  assert.deepEqual(s.out.mid.at(-1), ['You cannot pack a boat you are driving!', 1.5]);
  s.rt.activate(TRIGGER_MODEL.drive, rudder, 'info');
  assert.equal(s.rt.isSailing(), false, 'the helm again leaves it');
  s.rt.endOfFrame(); s.player.frozen = 0; s.rt.endOfFrame();
  // not driven, Steal mode packs it (PackBoat, CSA-H) - on a boat of its own, so this one stands for what follows
  const p = scene();
  const packable = p.place(1, 0);
  p.rt.activate(TRIGGER_MODEL.drive, { root: packable.GameObject, node: packable.DriveTrigger, distance: 2 }, 'steal');
  assert.deepEqual(p.out.packed.map((it) => it.templateIndex), [1320], 'Steal mode packs a packable boat (PackBoat)');
  assert.ok(!p.rt.AllBoats.includes(packable), '...off the list');   // by identity: a failing diff of a boat's graph never ends
  // the board: the trigger's previous sibling is where the player stands, facing its forward, then set on the ground
  const board = boat.BoardTriggers[0];
  s.rt.activate(TRIGGER_MODEL.board, { root: boat.GameObject, node: board, distance: 1 }, 'grab');
  const stand = board.parent.getChild(board.parent.children.indexOf(board) - 1);
  assert.equal(stand.name, 'BoardPosition');
  closeV(s.player.position, stand.position, 1e-6);
  assert.ok(close(s.player.yaw, yawOfForward(forwardOf(stand)), 1e-6));
  assert.deepEqual(s.out.aligned, [3]);
  s.rt.activate(TRIGGER_MODEL.status, { root: boat.GameObject, node: boat.StatusTrigger, distance: 1 }, 'grab');
  assert.deepEqual(s.out.boxes, ['Nice Boat!']);
  // a hit on no boat of this runtime's does nothing
  s.rt.activate(TRIGGER_MODEL.status, { root: {}, node: boat.StatusTrigger, distance: 1 }, 'grab');
  assert.equal(s.out.boxes.length, 1);
  // switching boats at the helm of another: StartSailing without a stop (kept)
  const other = s.place(0, 0, [50, 34, 50]);
  s.rt.activate(TRIGGER_MODEL.drive, rudder, 'grab');
  s.rt.activate(TRIGGER_MODEL.drive, { root: other.GameObject, node: other.DriveTrigger, distance: 1 }, 'grab');
  assert.ok(s.rt.state.CurrentBoat === other, 'CurrentBoat');
  assert.equal(boat.ActiveObject.activeSelf, true, 'the first boat\'s crew stays at the oars');
});

// ── FixedUpdate: the riders ───────────────────────────────────────────────────

test('CSA-D: FixedUpdate - a grounded enemy whose ray down its height meets a boat\'s hull collider rides it, moving and turning with the boat; one over anything else, or in the air, is set back', () => {
  let enemyPos = [0, 0, 0];
  let grounded = true;
  let boat = null;
  let turned = 0;
  const enemy = { key: 'e1', hasController: true, height: 1.8, position: () => [...enemyPos], setPosition: (p) => { enemyPos = [...p]; }, turn: (d) => { turned += d; }, grounded: () => grounded };
  const s = scene({
    held: ['MoveRight', 'MoveForwards'],
    enemies: [enemy],
    raycast: (o, d, reach, q) => (boat && q.triggers && reach === f(1.8) ? { distance: 0.9, point: [o[0], o[1] - 0.9, o[2]], node: boat.MeshObject, collider: boat.MeshCollider, root: boat.GameObject } : null),
  });
  boat = s.place(1, 0, [100, 34, 200]);
  enemyPos = [101, 35.5, 203];
  s.rt.StartSailing(boat);
  s.rt.fixedUpdate();
  assert.ok(s.rt.state.parentedObjects.get('e1')?.boat === boat, 'the rider\'s boat');
  const local = boat.GameObject.inverseTransformPoint(enemyPos);
  s.frame();
  closeV(boat.GameObject.inverseTransformPoint(enemyPos), local, 1e-4, 'the rider kept its place on the deck');
  assert.ok(close(turned, 0.625, 1e-4), '...and turned with it');
  grounded = false;
  s.rt.fixedUpdate();
  assert.equal(s.rt.state.parentedObjects.has('e1'), false, 'in the air: back to the scene\'s parent');
  grounded = true;
  s.rt.fixedUpdate();
  assert.ok(s.rt.state.parentedObjects.has('e1'));
  s.deps.raycast = () => ({ distance: 0.5, node: boat.DriveTrigger, collider: boat.DriveTrigger.getComponent('BoxCollider'), root: boat.GameObject });
  s.rt.fixedUpdate();
  assert.equal(s.rt.state.parentedObjects.has('e1'), false, 'a trigger under it is not the hull\'s collider');
  s.deps.raycast = () => ({ distance: 0.9, node: boat.MeshObject, collider: boat.MeshCollider, root: boat.GameObject });
  s.rt.fixedUpdate();
  s.deps.enemies = () => [];
  s.rt.fixedUpdate();
  assert.equal(s.rt.state.parentedObjects.size, 0, 'a destroyed enemy rides nothing');
});

// ── the save and the origin ───────────────────────────────────────────────────

test('CSA-D: the save at the helm - currentBoat is the index, the move vectors ride; RestoreSaveData stops a sail under way, stands the boats and takes the helm of the saved one', () => {
  const s = scene({ held: ['MoveForwards'] });
  s.place(0, 0, [10, 34, 10]);
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  s.frame();
  s.frame();
  const data = JSON.parse(JSON.stringify(s.rt.getSaveData()));
  assert.equal(data.currentBoat, 1);
  assert.deepEqual(data.moveVectorCurrent, { x: 0, y: 0, z: 0.5 });
  assert.deepEqual(data.moveVectorTarget, { x: 0, y: 0, z: 1 });
  const t = scene();
  const old = t.place(0, 0);
  t.rt.StartSailing(old);
  t.rt.restoreSaveData(data);
  assert.deepEqual(t.out.sailing, [true, false, true], 'the sail under way stopped, the saved one taken');
  assert.equal(t.rt.AllBoats.length, 2);
  assert.ok(t.rt.state.CurrentBoat === t.rt.AllBoats[1], 'CurrentBoat');
  assert.deepEqual(t.rt.state.MoveVectorCurrent, [0, 0, 0.5]);
  closeV(t.player.position, t.rt.AllBoats[1].DrivePosition.position, 1e-4);
});

test('CSA-D: FloatingOrigin at the helm - the boat moves by the offset and the player is set back at the DrivePosition, the boat\'s pixel the player\'s', () => {
  const s = scene();
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  boat.MapPixel = { X: 0, Y: 0 };
  s.player.position = [9, 9, 9];
  s.rt.OnPositionUpdate([500, 0, -500]);
  closeV(s.player.position, boat.DrivePosition.position, 1e-4);
  assert.deepEqual(boat.MapPixel, { X: 10, Y: 20 });
});

test('CSA-D: the pause gates - Update marks wasPaused and does nothing, LateUpdate and FixedUpdate return', () => {
  let boat = null;
  const enemy = { key: 'e', hasController: true, height: 1.8, position: () => [0, 0, 0], setPosition: () => {}, grounded: () => true };
  const s = scene({ held: ['MoveForwards'], enemies: [enemy], raycast: () => (boat ? { distance: 0.9, node: boat.MeshObject, collider: boat.MeshCollider, root: boat.GameObject } : null) });
  boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  s.player.frozen = 0;
  s.rt.update({ paused: true });
  assert.equal(s.rt.state.wasPaused, true);
  assert.deepEqual(s.rt.state.MoveVectorCurrent, [0, 0, 0]);
  assert.equal(s.player.frozen, 0, 'the pin did not run');
  // HELM-LADDER (PIN MOVED): a held key no longer pulls - a press climbs the ladder, and a bare update presses nothing -
  // so her oars are put to pulling ahead here, or LateUpdate has no vector to spend and the gate nothing to hold
  s.rt.state.oarThrottle = 1;
  s.rt.update();
  assert.ok(Math.hypot(...s.rt.state.MoveVectorCurrent) > 0, 'under way');
  const p = boat.GameObject.position;
  s.rt.lateUpdate({ paused: true });
  assert.deepEqual(boat.GameObject.position, p, 'LateUpdate paused: the boat stands, its vector unspent');
  s.rt.lateUpdate();
  assert.notDeepEqual(boat.GameObject.position, p, 'unpaused, it is spent');
  s.rt.fixedUpdate({ paused: true });
  assert.equal(s.rt.state.parentedObjects.size, 0, 'FixedUpdate paused: no rider taken');
  s.rt.fixedUpdate();
  assert.equal(s.rt.state.parentedObjects.size, 1);
});

// ── the shared pieces the helm needed ─────────────────────────────────────────

test('CSA-D: Collider.sphereCastAll - every bucket the swept sphere meets with its first contact, a start overlap as Unity answers it (distance 0, the zero point), the skip filter, a bucket off the sweep never walked', async () => {
  const { Collider } = await import('../src/player/collider.js');
  const col = new Collider(() => -Infinity);
  const wall = (x) => ({ positions: [x, -5, -5, x, 5, -5, x, 5, 5, x, -5, 5], indices: [0, 1, 2, 0, 2, 3] });
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  col.addMesh('near', wall(4).positions, wall(4).indices, I);
  col.addMesh('far', wall(9).positions, wall(9).indices, I);
  col.addMesh('behind', wall(-6).positions, wall(-6).indices, I);
  col.addMesh('touching', wall(0.5).positions, wall(0.5).indices, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 40, 1]);   // off at z 40
  const hits = col.sphereCastAll([0, 0, 0], 1, [1, 0, 0], 10);
  assert.deepEqual(hits.map((h) => h.key), ['near', 'far'], 'both walls ahead, each once; the one behind and the one off the sweep are not met');
  assert.ok(close(hits[0].dist, 3, 1e-9), 'the sphere\'s centre travels 3 before its front touches x = 4');
  closeV(hits[0].point, [4, 0, 0], 1e-9, 'the contact on the wall');
  assert.ok(close(hits[1].dist, 8, 1e-9));
  assert.deepEqual(col.sphereCastAll([0, 0, 0], 1, [1, 0, 0], 2.5).map((h) => h.key), [], 'short of the first wall');
  assert.deepEqual(col.sphereCastAll([0, 0, 0], 1, [1, 0, 0], 10, { skip: ['near'] }).map((h) => h.key), ['far']);
  const inside = col.sphereCastAll([3.5, 0, 0], 1, [1, 0, 0], 10);
  assert.deepEqual(inside[0], { key: 'near', dist: 0, point: [0, 0, 0] }, 'overlapping at the start: distance 0 and the zero point');
});

test('CSA-D: the motor\'s two seams - pinFeet puts the body there with both ends of the render span, touching no motion state; ToggleAutorun is written', async () => {
  const { PlayerMotor } = await import('../src/player/motor.js');
  const { Collider } = await import('../src/player/collider.js');
  const m = new PlayerMotor(new Collider(() => 0), { speed: 50 });
  m.spawn(0, 0, 0);
  m.falling = true; m.fallStart = 9; m.velY = -3;
  m.pinFeet(0.5, 0, 0.25);   // a deck's frame of travel - inside the snap span, where the eye would otherwise lerp
  assert.deepEqual([...m.pos], [0.5, 0, 0.25]);
  closeV(m.eyeAt(0), m.eyeAt(1), 1e-9, 'no span left to lerp across');
  assert.ok(close(m.eyeAt(0)[0], 0.5, 1e-9) && close(m.eyeAt(0)[2], 0.25, 1e-9), 'the eye at the pin, not behind it');
  assert.deepEqual([m.falling, m.fallStart, m.velY], [true, 9, -3], 'a transform write is no teleport: the motion state stands');
  m.toggleAutorun = true;
  assert.equal(m.toggleAutorun, true);
  m.toggleAutorun = false;
  assert.equal(m.toggleAutorun, false);
});

test('CSA-D: the one race takes a boat - nearest wins against every family, a tie with Horse Cart and Cargo\'s goes to it and one with the torch to the boat, and the boat is a rival for the person and the foe arms', async () => {
  const { raceActivation, raceWinner } = await import('../src/player/activationRace.js');
  const at = (key, distance) => ({ key, distance, reach: 3.2 });
  assert.equal(raceActivation({ boat: at('csaBoat:1:112400', 2), torch: at('t', 3), doorDistance: 4 }).boatWins, true);
  assert.equal(raceActivation({ boat: at('csaBoat:1:112400', 5), torch: at('t', 3), doorDistance: 4 }).boatWins, false);
  assert.equal(raceActivation({ boat: at('csaBoat:1:112400', 5), doorDistance: 4 }).boatWins, false, 'a door nearer takes it');
  assert.equal(raceActivation({ boat: at('csaBoat:1:hull', 2), corpse: at('c', 3) }).loot, null, 'the hull the ray met first keeps the body behind it');
  assert.equal(raceWinner({ horseCart: at('h', 3), boat: at('b', 3) }).key, 'h', 'a tie: Horse Cart and Cargo\'s arm is tested first');
  assert.equal(raceWinner({ boat: at('b', 3), torch: at('t', 3) }).key, 'b', '...and the boat\'s before the torch\'s');
  const r = raceActivation({ boat: at('b', 2.5), personDistances: [3] });
  assert.equal(r.nonPersonRival, 2.5);
  assert.equal(r.rival, 2.5);
});

// ── the finer laws (each a mutant's) ──────────────────────────────────────────

test('CSA-D: the finer laws of the helm - the galleon rows at its own oars (0.5), turnSpeed caps at the oars\' 20, a left turn costs no fatigue and a crewed ship none at all, a helm let go is pinned back, inputCurrent walks at the hull\'s animation modifier', () => {
  // the galleon: MoveSpeedOar 0.5 against MoveSpeedSail 1 - the oars' arm is the one rowing reads
  const g = scene({ held: ['MoveForwards'] });
  const galleon = g.place(2, 0);
  g.rt.StartSailing(galleon);
  g.frame();
  assert.deepEqual(g.rt.state.velocityTarget, [0, 0, 1], '2 x the galleon\'s 0.5');
  assert.ok(close(g.rt.state.MoveVectorCurrent[2], 0.25 * 0.25, 1e-6), 'moveAccelOar 1 x its 0.25, a quarter second');
  for (let i = 0; i < 12; i++) g.frame();
  assert.deepEqual(g.out.fatigue, [], 'a crewed ship\'s oars cost nothing');
  // backwards is an oar stroke too: the oars' acceleration, not the coast's
  const b = scene({ held: ['MoveBackwards'] });
  b.rt.StartSailing(b.place(1, 0));
  b.frame();
  assert.deepEqual(b.rt.state.MoveVectorCurrent, [0, 0, -0.25]);
  // the turn's cap: turnSpeedOar 20 (the sails' 10 is another arm)
  const t = scene({ held: ['MoveRight'] });
  t.rt.StartSailing(t.place(1, 0));
  for (let i = 0; i < 10; i++) t.frame();
  assert.equal(t.rt.state.TurnCurrent, 20);
  // a left turn alone never pays
  const l = scene({ held: ['MoveLeft'] });
  l.rt.StartSailing(l.place(1, 0));
  for (let i = 0; i < 12; i++) l.frame();
  assert.deepEqual(l.out.fatigue, [], 'TurnTarget > 0 is the only turn that counts (kept)');
  // a player moved off the helm is set back by Update's pin
  const p = scene();
  const skiff = p.place(1, 0);
  p.rt.StartSailing(skiff);
  p.player.position = [0, 0, 0];
  p.rt.update();
  closeV(p.player.position, skiff.DrivePosition.position, 1e-6);
  // inputCurrent: MoveTowards at modifierAnimation x dt - the skiff's 0.8 x 0.25
  const a = scene({ held: ['MoveForwards'] });
  a.rt.StartSailing(a.place(1, 0));
  a.frame();
  closeV(a.rt.state.inputCurrent, [0, f(0.8 * 0.25)], 1e-6);
});

test('CSA-D: CanTurnRight refuses a collision behind and to port too, IsBeached wants FOUR nodes off water, and the horse and the cart weigh only with their switches', () => {
  const s = scene();
  const boat = s.place(1, 0);
  s.rt.state.collisionDirections = [vNormalized([-1, 0, -1])];   // behind the beam on the port side: forward . c < 0, right . c < 0
  assert.equal(s.rt.CanTurnRight(boat), false);
  assert.equal(s.rt.CanTurnLeft(boat), true);
  s.rt.state.collisionDirections = [];
  boat.NodeTileMapIndices.splice(0, 5, 0, 0, 1, 1, 1);
  assert.equal(s.rt.IsBeached(boat), false, 'three off is afloat');
  const h = scene({ horse: true, cart: true, carried: 0 });
  h.rt.StartSailing(h.place(1, 0));
  assert.equal(h.rt.state.lastWeight, CARGO_WEIGHTS.male, 'the switches off: no horse, no cart');
});

test('CSA-D: Mathf.MoveTowards with a negative step moves away from the target, as Unity\'s does (Sign(0) is +1)', () => {
  assert.equal(mathfMoveTowards(5, 5, -1), 4);
  assert.equal(mathfMoveTowards(5, 7, -1), 4);
});

// ── CSA-K / CSA-L: sailing together, and the helm on screen ─────────────────────

test('CSA-K: the pack refused while another player stands on the deck (DECLARED - the driver\'s refusal, in its words\' shape: a pack would drop them in the sea); with nobody aboard Steal packs it as ever', () => {
  const s = scene();
  const boat = s.place(1, 0);
  let aboard = 1;
  const asked = [];
  s.deps.passengersAboard = (b) => { asked.push(b); return aboard; };
  s.rt.activate(TRIGGER_MODEL.drive, { root: boat.GameObject, node: boat.DriveTrigger, distance: 2 }, 'steal');
  assert.deepEqual(s.out.mid.at(-1), [PASSENGERS_ABOARD_TEXT, 1.5]);
  assert.equal(PASSENGERS_ABOARD_TEXT, 'You cannot pack a boat with passengers aboard!');
  assert.deepEqual(s.out.packed, [], 'not packed');
  assert.ok(s.rt.AllBoats.includes(boat));
  assert.ok(asked[0] === boat, 'asked about this boat');
  aboard = 0;
  s.rt.activate(TRIGGER_MODEL.drive, { root: boat.GameObject, node: boat.DriveTrigger, distance: 2 }, 'steal');
  assert.deepEqual(s.out.packed.map((it) => it.templateIndex), [1320], 'nobody aboard: packed');
  // the driver's own refusal still comes first
  const d = scene();
  const driven = d.place(1, 0);
  d.deps.passengersAboard = () => 1;
  d.rt.StartSailing(driven);
  d.rt.activate(TRIGGER_MODEL.drive, { root: driven.GameObject, node: driven.DriveTrigger, distance: 2 }, 'steal');
  assert.deepEqual(d.out.mid.at(-1), ['You cannot pack a boat you are driving!', 1.5]);
});

test('CSA-K: helmMotion - the boat at the helm\'s way as LateUpdate moves it (its velocity turned into the world, per Time.deltaTime second) and its turn; none ashore, none beached, none once the helm is left', () => {
  const s = scene({ held: ['MoveForwards', 'MoveRight'] });
  const boat = s.place(1, 0, [100, 34, 200], [1, 0, 0]);
  assert.equal(s.rt.helmMotion(), null, 'no helm');
  s.rt.StartSailing(boat);
  s.frame(); s.frame();
  const m = s.rt.helmMotion();
  assert.ok(m && m.boat === boat);
  closeV(m.velocity, quatRotate(boat.GameObject.rotation, s.rt.state.velocityCurrent), 1e-9, 'velocityCurrent turned into the world');
  assert.ok(Math.hypot(m.velocity[0], m.velocity[2]) > 0.1, 'under way');
  assert.equal(m.turn, s.rt.state.TurnCurrent);
  // the next frame's move is that way times Time.deltaTime (0.25 here): the reader leads by the same
  const before = boat.GameObject.position;
  s.held.delete('MoveRight');
  const m2 = s.rt.helmMotion();
  s.frame();
  const moved = boat.GameObject.position.map((v, i) => v - before[i]);
  assert.ok(Math.hypot(moved[0], moved[2]) > 0, 'it moved');
  // beached: stopped dead, no way
  for (let i = 0; i < boat.NodeTileMapIndices.length; i++) boat.NodeTileMapIndices[i] = 1;
  assert.equal(s.rt.helmMotion(), null, 'beached');
  assert.ok(m2, 'the way was said before');
});

test('CSA-L: helmPanelState - what the helm panel shows, read and never written: the hull, the sails and whether they stand, the square sails\' own toggle (the key\'s chord: raised sails, square and fore-and-aft kinds, the assist off), the lanterns, the time scale\'s step and value, the trim\'s owner; none ashore', () => {
  const s = scene({ settings: { 'SailingAssist.AutoTrimming': false, 'SailingAssist.AutoStowSquareSails': false } });
  assert.equal(s.rt.helmPanelState(), null, 'no helm');
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  const h = s.rt.helmPanelState();
  assert.equal(h.hull, 1);
  assert.equal(h.hasSails, boat.Sails.length > 0);
  assert.equal(h.sailsUp, false);
  assert.equal(h.light, !!boat.LightOn);
  assert.deepEqual([h.timeScaleIndex, h.timeScale, h.timeScaleMax], [0, 1, TIME_SCALES.length - 1]);
  assert.equal(h.manualTrim, true, 'AutoTrimming off: the trim is the player\'s');
  assert.equal(h.squareOnly, !(boat.SailsLateen.length > 0 || boat.SailsGaff.length > 0));
  assert.equal(h.hasSquare, boat.SailsSquare.length > 0);
  assert.equal(h.squareToggle, false, 'sails stowed: the chord raises them all');
  s.frame({ press: [BOAT_ACTIONS.toggleLight] });
  assert.equal(s.rt.helmPanelState().light, !!boat.LightOn, 'the lanterns as they stand');
  const assisted = scene();
  const b2 = assisted.place(1, 0);
  assisted.rt.StartSailing(b2);
  assert.equal(assisted.rt.helmPanelState().manualTrim, false, 'the assist trims by default');
  assisted.rt.StopSailing();
  assert.equal(assisted.rt.helmPanelState(), null, 'the helm left');
});

test('CSA-K: the laws another player\'s boat shares with mine, one export each - BoardBoat\'s place (boardPlaceOf), the status box\'s words, the door\'s turn (turnDoor: its Animator over, its sound), the helm\'s carry of its child (carriedPoint, yawDelta)', () => {
  const s = scene();
  const boat = s.place(1, 0);
  const board = boat.BoardTriggers[0];
  s.rt.activate(TRIGGER_MODEL.board, { root: boat.GameObject, node: board, distance: 1 }, 'grab');
  const at = boardPlaceOf(board);
  closeV(s.player.position, at.position, 1e-9, 'BoardBoat stands the player at boardPlaceOf');
  assert.ok(close(s.player.yaw, at.yaw, 1e-9));
  s.rt.activate(TRIGGER_MODEL.status, { root: boat.GameObject, node: boat.StatusTrigger, distance: 1 }, 'grab');
  assert.deepEqual(s.out.boxes, [NICE_BOAT_TEXT]);
  assert.equal(NICE_BOAT_TEXT, 'Nice Boat!');
  // the door: any hull with one - its trigger's parent's Animator turned over, and the clip
  const withDoor = s.place(2, 0, [300, 34, 300]);   // the Small Ship's cabin door (the Carrack carries seven, the two smallest none)
  const trigger = [...withDoor.GameObject.walk()].find((n) => activationModelOf(n.name) === TRIGGER_MODEL.door);
  assert.ok(trigger, 'the Small Ship has a door');
  const sounds = [];
  s.deps.audio = { dfClipAtPoint: (id) => sounds.push(id) };
  s.rt.turnDoor(trigger);
  s.rt.turnDoor(trigger);
  assert.deepEqual(sounds, [94, 93], 'opened (94), then shut (93)');
  const before = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1];
  const turned = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 10, 0, 5, 1];   // a quarter turn about up, moved five along z
  closeV(carriedPoint(before, turned, [12, 1, 0]), [10, 1, 3], 1e-9, 'two metres off the root, carried round with it');
  assert.equal(yawDelta(before, turned), 90);
});

// ── HELM-KEYS (2026-09-29, the player: "Arrow keys should not only control your ship, but also setting and raising your
// sails. I also want to find a way to make the ship controls more intuitive") ─────────────────────────────────────────

const stowed = (sail) => animatorOf(sail).GetBool('Stowed');

test('HELM-LADDER (the port\'s, DECLARED; was HELM-KEYS more and less sail): W and the up arrow climb one ladder, S and the down arrow come down it - backing water, at rest, pulling ahead, her sails - a rung a press, each said; the rung kept with no key held; down from her sails she pulls ahead on her oars; a step with nowhere to go says so, and a sailless boat stops at her oars (mutants: the arrows apart from W and S; the oars held; a lowered sail leaving her at rest)', () => {
  const s = scene();
  const boat = s.place(4, 0);
  s.rt.StartSailing(boat);
  assert.equal(s.rt.state.oarThrottle, 0, 'a helm taken: the oars at rest');
  s.out.hud.length = 0;
  s.frame({ press: [BOAT_ACTIONS.sailUp] });
  assert.equal(s.rt.state.oarThrottle, 1, 'up: the oars pulling ahead');
  assert.equal(s.out.hud.at(-1), OAR_RUNG_TEXT[1]);
  for (let i = 0; i < 4; i++) s.frame();
  assert.deepEqual(s.rt.state.MoveVectorTarget, [0, 0, 1], 'no key held: she rows on at her rung');
  s.frame({ press: ['MoveForwards'] });
  assert.equal(s.rt.state.sailPosition, 1, 'W: the same ladder - made sail');
  assert.equal(s.rt.state.oarThrottle, 0, 'the oars shipped under sail');
  assert.ok(s.out.hud.includes('Sail raised!'), 'the mod\'s own word');
  s.frame({ press: [BOAT_ACTIONS.sailUp] });
  assert.equal(s.out.hud.at(-1), 'All sail is set.', 'up again: nowhere to go');
  s.frame({ press: ['MoveBackwards'] });
  assert.equal(s.rt.state.sailPosition, 0, 'S: struck');
  assert.ok(boat.Sails.every(stowed), 'every sail stowed');
  assert.equal(s.rt.state.oarThrottle, 1, 'and she pulls ahead on her oars');
  s.frame({ press: [BOAT_ACTIONS.sailDown] });
  assert.equal(s.rt.state.oarThrottle, 0, 'down: the oars at rest');
  assert.equal(s.out.hud.at(-1), OAR_RUNG_TEXT[0]);
  s.frame({ press: ['MoveBackwards'] });
  assert.equal(s.rt.state.oarThrottle, -1, 'backing water');
  assert.equal(s.out.hud.at(-1), OAR_RUNG_TEXT[-1]);
  s.frame();
  assert.deepEqual(s.rt.state.MoveVectorTarget, [0, 0, -1], 'astern at her rung');
  s.frame({ press: [BOAT_ACTIONS.sailDown] });
  assert.equal(s.rt.state.oarThrottle, -1, 'the foot of the ladder');
  assert.equal(s.out.hud.at(-1), OAR_ASTERN_TEXT);
  const row = scene();
  const rowboat = row.place(0, 0);
  row.rt.StartSailing(rowboat);
  row.frame({ press: [BOAT_ACTIONS.sailUp] });
  row.frame({ press: [BOAT_ACTIONS.sailUp] });
  assert.equal(row.out.hud.at(-1), 'Boat does not have any sail.', 'the mod\'s own refusal at the top of a rowboat\'s ladder');
  assert.equal(row.rt.state.sailPosition, 0);
  assert.equal(row.rt.state.oarThrottle, 1, 'she rows on');
  row.rt.StopSailing();
  assert.equal(row.rt.state.oarThrottle, 0, 'the oars shipped with the helm left');
});

test('HELM-LADDER through the square sails where they are the player\'s (the assist\'s AutoStowSquareSails off, a hull with both kinds; was HELM-KEYS): up past her oars, all her canvas; down, the square sails first, then the fore-and-aft and onto her oars - and the sails\' button is the mod\'s own toggle from any rung', () => {
  const s = scene({ settings: { 'SailingAssist.AutoStowSquareSails': false } });
  const boat = s.place(4, 0);
  assert.ok(boat.SailsSquare.length > 0 && (boat.SailsLateen.length > 0 || boat.SailsGaff.length > 0), 'the Carrack carries both kinds');
  s.rt.StartSailing(boat);
  assert.equal(s.rt.helmPanelState().moreSail, true, 'stowed: more can be made');
  s.frame({ press: [BOAT_ACTIONS.sailUp] });
  s.frame({ press: [BOAT_ACTIONS.sailUp] });
  assert.ok(boat.Sails.every((x) => !stowed(x)), 'all her canvas');
  assert.equal(s.rt.helmPanelState().moreSail, false, 'all set');
  s.frame({ press: [BOAT_ACTIONS.sailDown] });
  assert.equal(s.rt.state.sailPosition, 1, 'still under sail');
  assert.ok(boat.SailsSquare.every(stowed), 'the square sails taken in first');
  assert.ok(boat.Sails.filter((x) => !boat.SailsSquare.includes(x)).every((x) => !stowed(x)), 'the fore-and-aft standing');
  assert.equal(s.rt.state.oarThrottle, 0, 'no oar under sail');
  assert.equal(s.rt.helmPanelState().moreSail, true, 'the square sails can be made again');
  s.frame({ press: [BOAT_ACTIONS.sailUp] });
  assert.ok(boat.SailsSquare.every((x) => !stowed(x)), 'up: the square sails again');
  s.frame({ press: [BOAT_ACTIONS.sailDown] });
  s.frame({ press: [BOAT_ACTIONS.sailDown] });
  assert.equal(s.rt.state.sailPosition, 0, 'two steps down: none');
  assert.ok(boat.Sails.every(stowed));
  assert.equal(s.rt.state.oarThrottle, 1, 'she pulls ahead');
  // the panel's sails button: the toggle, raising her canvas from her oars without a rung between
  const btn = helmButtons(s.rt.helmPanelState()).find((b) => b.act === 'sails');
  assert.equal(btn.action, BOAT_ACTIONS.toggleSail);
  s.frame({ press: [btn.action] });
  assert.equal(s.rt.state.sailPosition, 1, 'raised from her oars at a touch');
});

test('HELM-LADDER the world\'s seam by source: W and S are pressed through the frame\'s down ring like the sail keys, and stand down with them under the travel view (AUDIT NAV2 F17: a journey holds the helm there); the panel\'s line teaches the one ladder', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  // the panel's line: her oars and her sails on W, S and the arrows, her rudder on A, D and the side arrows - every key bound
  const keyOf = (a) => ({ MoveForwards: 'W', MoveBackwards: 'S', MoveLeft: 'A', MoveRight: 'D', BoatSailUp: '↑', BoatSailDown: '↓', TurnLeft: '←', TurnRight: '→' })[a] ?? '';
  assert.equal(helmHint({ hasSails: true }, { keyOf, mouseFree: true }), 'Oars & sails W S ↑ ↓ · Steer A D ← →');
  assert.equal(helmHint({ hasSails: false }, { keyOf, mouseFree: true }), 'Oars W S ↑ ↓ · Steer A D ← →', 'a rowboat\'s ladder is her oars');
  assert.match(w, /started: \(action\) => \(pressed\(latch\.edge, keys, action\) && !\(travelView\?\.active && \[CSA_BOAT_ACTIONS\.sailUp, CSA_BOAT_ACTIONS\.sailDown, CSA_BOAT_ACTIONS\.toggleSail, 'MoveForwards', 'MoveBackwards'\]\.includes\(action\)\)\) \|\| csaHelmInput\.edges\.has\(action\),/);
});

test('HELM-KEYS in irons: her sails up, her bow within IRONS_TELL_DEG of the wind\'s eye and her way under IRONS_TELL_WAY for IRONS_TELL_S running - the helm is told once how she comes out, again only after she has been out of them; the panel says it while it lasts; a sail just raised is not lying in irons (mutants: told every frame, told at once, the wind\'s sense reversed, the way unread)', () => {
  // PIN MOVED (AUDIT NAV2 F15): under the mod's own default waves, the sea's current never forced away - it rides in her
  // velocity (half the wind), and her way through the water is what is read
  const s = scene({ settings: { 'Waves.Enable': true } });
  const boat = s.place(4, 0);
  s.rt.StartSailing(boat);
  const ahead = [0, 0, -1];   // blowing TO her stern: from dead ahead (the bow is +z)
  const lie = (seconds) => { for (let t = 0; t < seconds; t += 0.25) { s.rt.state.windVectorCurrent = ahead; s.frame(); } };
  const told = () => s.out.hud.filter((t) => t === IRONS_TEXT).length;
  s.rt.state.windVectorCurrent = ahead;
  s.frame({ press: [BOAT_ACTIONS.toggleSail] });   // HELM-LADDER: the toggle raises her sails from her oars at rest
  assert.equal(s.out.hud.at(-1), 'Sail raised!', 'a sail just raised into the wind: not yet in irons');
  assert.equal(s.rt.helmPanelState().inIrons, false);
  lie(IRONS_TELL_S - 0.5);
  assert.equal(told(), 0, 'under the dwell: nothing said');
  lie(0.75);
  assert.equal(told(), 1, 'told once');
  assert.equal(s.rt.helmPanelState().inIrons, true);
  assert.ok(Math.hypot(...s.rt.state.velocityCurrent) >= IRONS_TELL_WAY, 'the current over the tell\'s way: not what is read');
  s.rt.state.MoveVectorCurrent = [0, 0, IRONS_TELL_WAY + 0.5];
  assert.equal(s.rt.helmPanelState().inIrons, false, 'with way on she answers her helm - not in irons');
  s.rt.state.MoveVectorCurrent = [0, 0, 0];
  lie(3);
  assert.equal(told(), 1, 'not again while she lies there');
  s.rt.state.windVectorCurrent = [1, 0, 0];   // the wind on her beam: out of irons
  s.frame();
  assert.equal(s.rt.helmPanelState().inIrons, false);
  lie(IRONS_TELL_S + 0.25);
  assert.equal(told(), 2, 'into irons again: told again');
  s.frame({ press: [BOAT_ACTIONS.sailDown] });
  assert.equal(s.rt.helmPanelState().inIrons, false, 'sail struck: no longer in irons - she rows');
  assert.ok(IRONS_TELL_DEG > 0 && IRONS_TELL_DEG < 90 && IRONS_TELL_WAY > 0 && IRONS_TELL_S > 0);
});
