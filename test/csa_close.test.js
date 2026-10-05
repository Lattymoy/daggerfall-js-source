// CSA-J (2026-09-28) - COME SAIL AWAY'S CLOSE: the message receiver (ComeSailAway.cs 1833-1890) and the one mod in
// the port that sends to it - Eye of the Beholder, whose ModCompatibilityChecking hands OnUpdateSailing to it
// (IL_0756-IL_079a), whose OnUpdateSailing asks GetBoatMeshObject (IL_07a8-IL_0922), whose camera targets the boat
// (IL_1612-IL_16c5) and whose sprite faces its heading (IL_471c-IL_4765). Over the real SpawnBoat and the vendored
// models; the scene is CSA-D's (test/csa_sailing.test.js), every host door scripted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../src/systems/comeSailAwayModels.js';
import { spawnBoat, colliderBoundsInChildren, colliderBounds, HULL_NAMES } from '../src/systems/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, MOD_OBJECT_NAME, WOD_TERRAIN, ANIMATED_WATER, WATER_LEVEL } from '../src/systems/comeSailAway.js';
import { createEotbCamera } from '../src/player/eotbCamera.js';
import { facingFor, boatForwardOf } from '../src/player/eotbBillboard.js';
import { PrefabNode } from '../src/world/prefabNode.js';
import { quatRotate, quatAngleAxis } from '../src/world/quat.js';

const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const close = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
const closeV = (a, b, eps = 1e-4, msg = '') => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(close(v, b[i], eps), `${msg} [${i}] ${v} vs ${b[i]}`)); };
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

/** A terrain record as the host hands it: every tile water unless told. */
function terrain(x, y, { tile = 0 } = {}) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128).fill(tile << 2), sampleHeight: () => 20 };
}

/** The scripted scene: the helm's seams recorded, the keys held as a set, Time.deltaTime a quarter second (exact). */
function scene(opts = {}) {
  const out = { hud: [], mid: [], log: [], errors: [], removed: [], boxes: [], packed: [], sailing: [], fatigue: [], scenes: [], assigned: [], footsteps: [], facing: [], aligned: [], timeScales: [], casts: [] };
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
    logError: (t) => out.errors.push(t),
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
  /** One frame as the host runs it: the end of the last frame's coroutines, FixedUpdate, Update, LateUpdate. */
  const frame = ({ press = [] } = {}) => {
    started.clear();
    for (const a of press) started.add(a);
    rt.endOfFrame();
    rt.fixedUpdate();
    rt.update();
    rt.lateUpdate();
    started.clear();
  };
  const place = (hull = 1, variant = 0, position = [100, 34, 200], direction = [0, 0, 1]) => rt.PlaceBoat(position, direction, hull, variant, terrains[0]);
  return { rt, out, player, input, held, frame, place, deps, setTimeScale: (s) => { timeScale = s; }, terrains };
}

// ── the message receiver ──────────────────────────────────────────────────────

test('CSA-J: MessageReceiver - the wind and the current answered as Vector3s are passed (a copy); the three events subscribed by a function and nothing else; IsPlayerSailing; an unknown message an error in Unity\'s name for the component', () => {
  const s = scene();
  s.rt.state.windVectorCurrent = [1, 0, 2];
  s.rt.state.currentVector = [0.5, 0, -0.25];
  const got = [];
  s.rt.MessageReceiver('GetWind', null, (m, d) => got.push([m, d]));
  s.rt.MessageReceiver('GetCurrent', null, (m, d) => got.push([m, d]));
  assert.deepEqual(got, [['GetWind', [1, 0, 2]], ['GetCurrent', [0.5, 0, -0.25]]]);
  got[0][1][0] = 99; got[1][1][2] = 99;
  assert.deepEqual([s.rt.state.windVectorCurrent, s.rt.state.currentVector], [[1, 0, 2], [0.5, 0, -0.25]], 'a struct is a copy - the answer is not the mod\'s own vector');
  s.rt.MessageReceiver('GetWind', null, null);   // no callback: nothing, no throw
  const heard = { wind: [], current: [], sailing: [] };
  s.rt.MessageReceiver('OnUpdateWind', (v) => heard.wind.push(v), null);
  s.rt.MessageReceiver('OnUpdateCurrent', (v) => heard.current.push(v), null);
  s.rt.MessageReceiver('OnUpdateSailing', (v) => heard.sailing.push(v), null);
  s.rt.MessageReceiver('OnUpdateSailing', 'not an Action<bool>', null);   // `data as Action<bool>` is null: `+= null` adds nothing
  s.rt.MessageReceiver('OnUpdateWind', null, null);
  const said = [];
  s.rt.MessageReceiver('IsPlayerSailing', null, (m, d) => said.push([m, d]));
  const boat = s.place(1, 0);
  s.rt.StartSailing(boat);
  s.rt.MessageReceiver('IsPlayerSailing', null, (m, d) => said.push([m, d]));
  assert.deepEqual(said, [['IsPlayerSailing', false], ['IsPlayerSailing', true]]);
  assert.deepEqual(heard.sailing, [true], 'the subscriber hears StartSailing - and the string subscribed nothing that throws');
  const second = [];
  s.rt.MessageReceiver('OnUpdateWind', (v) => { second.push([...v]); v[2] = 7; }, null);
  const third = [];
  s.rt.MessageReceiver('OnUpdateWind', (v) => third.push([...v]), null);
  s.rt.restoreSaveData({ ...s.rt.newSaveData(), windVector: { x: 0, y: 0, z: 2 } });
  assert.deepEqual(heard.wind, [[0, 0, 2]], 'RunOnUpdateEvents - the save\'s restore - raises OnUpdateWind with the wind as it stands');
  assert.deepEqual([second, third], [[[0, 0, 2]], [[0, 0, 2]]], 'each delegate its own copy - one that writes to it changes nobody else\'s');
  assert.deepEqual(s.rt.state.windVectorCurrent, [0, 0, 2], 'nor the mod\'s');
  s.rt.MessageReceiver('GetTheBoat', null, null);
  assert.deepEqual(s.out.errors, [`${MOD_OBJECT_NAME}: unknown message received (GetTheBoat).`]);
  assert.equal(MOD_OBJECT_NAME, 'Come Sail Away (ComeSailAwayMod.ComeSailAway)', 'Object.ToString(): the GameObject Init names for the title, and the type\'s full name');
});

test('CSA-J: MessageReceiver - ResetTimeScale says its scale; StopSailing is the Disembark key\'s delayed stop; the boat\'s two objects are CurrentBoat\'s, and with no boat a callback meets the C#\'s NullReferenceException (kept) where no callback reads nothing', () => {
  const s = scene();
  s.setTimeScale(5);
  s.rt.MessageReceiver('ResetTimeScale', null, null);
  assert.deepEqual(s.out.timeScales, [1]);
  assert.deepEqual(s.out.mid, [['Time scale set to 1.', 3]], 'ResetTimeScale() - its message is on');
  assert.throws(() => s.rt.MessageReceiver('GetBoatGameObject', null, () => {}), TypeError, 'CurrentBoat.GameObject with no boat');
  assert.throws(() => s.rt.MessageReceiver('GetBoatMeshObject', null, () => {}), TypeError);
  s.rt.MessageReceiver('GetBoatMeshObject', null, null);   // the if (callBack != null) guards the read too
  const boat = s.place(2, 0);
  s.rt.StartSailing(boat);
  const objs = [];
  s.rt.MessageReceiver('GetBoatGameObject', null, (m, d) => objs.push([m, d]));
  s.rt.MessageReceiver('GetBoatMeshObject', null, (m, d) => objs.push([m, d]));
  assert.equal(objs[0][0], 'GetBoatGameObject');
  assert.ok(objs[0][1] === boat.GameObject, 'the boat\'s root');
  assert.equal(objs[1][0], 'GetBoatMeshObject');
  assert.ok(objs[1][1] === boat.MeshObject, 'the hull collider\'s own object');
  assert.equal(s.rt.isSailing(), true);
  s.rt.MessageReceiver('StopSailing', null, null);
  assert.equal(s.rt.isSailing(), false, 'StopSailingDelayed: the disembarking coroutine set, IsSailing false at once');
  const said = [];
  s.rt.MessageReceiver('IsPlayerSailing', null, (m, d) => said.push(d));
  assert.deepEqual(said, [false], 'IsSailing: a boat, but disembarking - not sailing');
  assert.ok(s.rt.state.disembarking != null);
  assert.ok(s.rt.state.CurrentBoat === boat, 'the boat let go only at the frame\'s end');
});

// ── Eye of the Beholder's boat ────────────────────────────────────────────────

/** Eye of the Beholder's camera over this scene's runtime, as the host hands it: the receiver and Collider.bounds. */
function eotbOver(s, { started = true } = {}) {
  const cam = createEotbCamera();
  const logs = [];
  cam.setLog((t) => logs.push(t));
  cam.setComeSailAway({ send: s.rt.MessageReceiver, colliderBounds: (go) => colliderBoundsInChildren({ models: MODELS }, go) });
  if (started) cam.start();
  return { cam, logs };
}

test('CSA-J: Eye of the Beholder\'s OnUpdateSailing on every hull - GetBoatMeshObject answered at once, the collider\'s centre a vector in the object\'s frame, the extent its largest half-size, the flag and the helm among the object\'s OWN children (none there: the hull itself for the flag, no helm), the two log lines', () => {
  const want = { 0: { flag: false, drive: true }, 1: { flag: false, drive: true }, 2: { flag: true, drive: true }, 3: { flag: true, drive: false }, 4: { flag: false, drive: true } };
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const s = scene();
    const { cam, logs } = eotbOver(s);
    const boat = s.place(hull, 0, [100, 34, 200], [Math.sin(0.7), 0, Math.cos(0.7)]);
    s.rt.StartSailing(boat);
    const e = cam.sailing();
    assert.equal(e.isSailing, true, HULL_NAMES[hull]);
    assert.ok(e.boatMeshObject === boat.MeshObject, 'the mesh object the message answered');
    const b = colliderBounds({ models: MODELS }, boat.MeshObject, boat.MeshCollider);   // the hull's own first collider
    const d = [b.center[0] - boat.MeshObject.position[0], b.center[1] - boat.MeshObject.position[1], b.center[2] - boat.MeshObject.position[2]];
    closeV(e.boatMeshObjectCenter, boat.MeshObject.inverseTransformVector(d), 1e-6, 'InverseTransformVector(center - position)');
    // turned 0.7 rad, the local centre is the world offset turned back
    closeV(e.boatMeshObjectCenter, quatRotate(quatAngleAxis(-0.7 * 180 / Math.PI, [0, 1, 0]), d), 1e-4, 'a local vector');
    assert.equal(e.boatMeshObjectExtent, Math.max(Math.abs(b.extents[0]), Math.abs(b.extents[1]), Math.abs(b.extents[2])), 'the largest half-size');
    const kids = boat.MeshObject.children;
    if (want[hull].flag) assert.ok(e.boatFlagObject === kids.find((k) => k.name === 'FlagObject'), `${HULL_NAMES[hull]}: its own FlagObject child`);
    else assert.ok(e.boatFlagObject === boat.MeshObject, `${HULL_NAMES[hull]}: no FlagObject among its own children - the hull itself`);
    if (want[hull].drive) assert.ok(e.boatDriveObject === kids.find((k) => k.name === 'DrivePosition'), `${HULL_NAMES[hull]}: its own DrivePosition child`);
    else assert.equal(e.boatDriveObject, null, `${HULL_NAMES[hull]}: no DrivePosition among its own children`);
    assert.deepEqual(logs, ['EYE OF THE BEHOLDER - WE ARE NOW SAILING!']);
    s.rt.StopSailing();
    assert.equal(cam.sailing().isSailing, false);
    assert.ok(cam.sailing().boatMeshObject === boat.MeshObject, 'stopping lowers the flag alone - the objects stay');
    assert.deepEqual(logs, ['EYE OF THE BEHOLDER - WE ARE NOW SAILING!', 'EYE OF THE BEHOLDER - WE HAVE STOPPED SAILING!']);
  }
});

test('CSA-J: one camera over two sails - the second boat\'s flag and helm are its own, never the first\'s (OnUpdateSailing nulls both before it looks)', () => {
  const s = scene();
  const { cam } = eotbOver(s);
  const galleon = s.place(2, 0);
  s.rt.StartSailing(galleon);
  assert.equal(cam.sailing().boatFlagObject.name, 'FlagObject');
  s.rt.StopSailing();
  const rowboat = s.place(0, 0, [300, 34, 200]);
  s.rt.StartSailing(rowboat);
  assert.ok(cam.sailing().boatFlagObject === rowboat.MeshObject, 'the Rowboat has no FlagObject of its own: the hull, not the galleon\'s flag');
  assert.ok(cam.sailing().boatDriveObject.parent === rowboat.MeshObject, 'and its own helm');
});

test('CSA-J: the child walk stops once both are found, and a later same-named child never replaces an earlier one; with neither, the flag is the object itself', () => {
  const mesh = new PrefabNode('Hull');
  const names = ['DrivePosition', 'FlagObject', 'FlagObject', 'DrivePosition'];
  const kids = names.map((n) => { const c = new PrefabNode(n); c.setParent(mesh); return c; });
  const cam = createEotbCamera();
  let sub = null;
  cam.setComeSailAway({ send: (m, data, cb) => { if (m === 'OnUpdateSailing') sub = data; if (m === 'GetBoatMeshObject') cb(m, mesh); }, colliderBounds: () => ({ center: [0, 0, 0], extents: [1, -3, 2] }) });
  cam.start();
  sub(true);
  let e = cam.sailing();
  assert.ok(e.boatDriveObject === kids[0] && e.boatFlagObject === kids[1], 'the first of each - the walk broke at the third');
  assert.equal(e.boatMeshObjectExtent, 3, 'Mathf.Abs of each half-size');
  const bare = new PrefabNode('Bare');
  const cam2 = createEotbCamera();
  cam2.setComeSailAway({ send: (m, data, cb) => { if (m === 'OnUpdateSailing') sub = data; if (m === 'GetBoatMeshObject') cb(m, bare); }, colliderBounds: () => ({ center: [0, 0, 0], extents: [0, 0, 0] }) });
  cam2.start();
  sub(true);
  e = cam2.sailing();
  assert.ok(e.boatFlagObject === bare, 'no flag: the mesh object itself');
  assert.equal(e.boatDriveObject, null);
});

test('CSA-J: ModCompatibilityChecking\'s arm - Start subscribes to the mod it found; a mod handed after Start subscribes at once; a new boot\'s runtime puts the boat fields back as the .ctor would; no mod, no subscription', () => {
  const sends = [];
  const mod = (tag) => ({ send: (m, data) => sends.push([tag, m, typeof data]), colliderBounds: () => null });
  const cam = createEotbCamera();
  cam.setComeSailAway(mod('a'));
  assert.deepEqual(sends, [], 'before Start nothing is sent');
  cam.start();
  assert.deepEqual(sends, [['a', 'OnUpdateSailing', 'function']], 'Start -> ModCompatibilityChecking -> SendModMessage(OnUpdateSailing, this.OnUpdateSailing)');
  cam.start();
  assert.equal(sends.length, 1, 'Unity\'s Start runs once');
  const mesh = new PrefabNode('Hull');
  let sub = null;
  cam.setComeSailAway({ send: (m, data, cb) => { if (m === 'OnUpdateSailing') sub = data; if (m === 'GetBoatMeshObject') cb(m, mesh); }, colliderBounds: () => ({ center: [0, 0, 0], extents: [1, 1, 1] }) });
  sub(true);
  assert.equal(cam.sailing().isSailing, true);
  cam.setComeSailAway(mod('b'));
  assert.deepEqual(sends.at(-1), ['b', 'OnUpdateSailing', 'function'], 'the next boot\'s runtime subscribed at once');
  assert.deepEqual(cam.sailing(), { isSailing: false, boatMeshObject: null, boatDriveObject: null, boatFlagObject: null, boatMeshObjectCenter: [0, 0, 0], boatMeshObjectExtent: 0 }, 'a new session for the boat');
  const n = sends.length;
  cam.setComeSailAway(null);
  assert.equal(sends.length, n, 'the mod off: nothing to send to');
});

test('CSA-J: the camera\'s boat target (IL_1612-IL_16c5) - the posOffset arm by the camera\'s own field; the masthead (Target 1) plus the offset scaled by the extent; the hull (Target 0) plus its LOCAL centre added as a world vector (kept); ashore, or with the override off, the body\'s head; and the minimum distance still floors it in the body\'s frame (IL_1766-IL_17da, kept)', () => {
  const settings = (target, enable = true, minZ = 0) => (v, k) => ({
    'CameraOverrideBoat.Enable': enable, 'CameraOverrideBoat.LongitudinalDistance': 3, 'CameraOverrideBoat.Target': target,
    'Camera.LongitudinalDistance': 2, 'Camera.RidingOffset': 0, 'Camera.MinimumDistance': minZ, 'Camera.FrontalPlaneOffset': [0, 0],
  })[k];
  const rig = (target, enable, minZ = 0) => {
    const root = new PrefabNode('Boat');
    root.position = [10, 0, 20];
    root.rotation = quatAngleAxis(90, [0, 1, 0]);
    const mesh = new PrefabNode('Hull'); mesh.setParent(root);
    const flag = new PrefabNode('FlagObject'); flag.setParent(mesh); flag.localPosition = [0, 8, 1];
    const cam = createEotbCamera();
    let sub = null;
    cam.loadSettings(settings(target, enable, minZ));
    // the collider's centre one metre ahead of the hull's origin in the world (+x, the boat turned 90 degrees)
    cam.setComeSailAway({ send: (m, data, cb) => { if (m === 'OnUpdateSailing') sub = data; if (m === 'GetBoatMeshObject') cb(m, mesh); }, colliderBounds: () => ({ center: [11, 0, 20], extents: [2, 1, 0.5] }) });
    cam.start();
    cam.toggleOffset(true);
    return { cam, sub: (v) => sub(v), flag, mesh };
  };
  const eyeOf = (cam) => cam.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000 }).eye;
  const masthead = rig(1, true);
  masthead.sub(true);
  const flagAt = masthead.flag.position;
  closeV(flagAt, [11, 8, 20], 1e-9);
  closeV(eyeOf(masthead.cam), [11, 8, 20 - 3 * 2], 1e-6, 'the flag, and the boat arm\'s z (-3) times the extent (2)');
  const hullT = rig(0, true);
  hullT.sub(true);
  const local = hullT.cam.sailing().boatMeshObjectCenter;
  closeV(local, [0, 0, 1], 1e-6, 'the world offset (+1, 0, 0) in the turned hull\'s frame');
  closeV(eyeOf(hullT.cam), [10, 0, 20 + 1 - 6], 1e-6, 'the hull\'s position plus the LOCAL centre as it stands (+z) - not turned back into the world (+x)');
  hullT.sub(false);
  closeV(eyeOf(hullT.cam), [0, 1.6, -2], 1e-6, 'ashore: the head and the base arm');
  const off = rig(1, false);
  off.sub(true);
  closeV(eyeOf(off.cam), [0, 1.6, -2], 1e-6, 'the override off: the body\'s own arm, the base offset');
  const floored = rig(1, true, 0.8);
  floored.sub(true);
  closeV(eyeOf(floored.cam), [11, 8, -3 * 0.8], 1e-6, 'the masthead ahead of the body: the floor pulls the eye to 0.8 of the arm\'s z behind the feet');
});

test('CSA-J: the sprite faces the boat (IL_471c-IL_4765) - its DrivePosition\'s forward, else the hull\'s, over every turn-to-view arm, flattened; ashore nothing', () => {
  const hull = new PrefabNode('Hull');
  hull.rotation = quatAngleAxis(90, [0, 1, 0]);
  const drive = new PrefabNode('DrivePosition'); drive.setParent(hull); drive.localRotation = quatAngleAxis(90, [0, 1, 0]);
  closeV(boatForwardOf({ isSailing: true, boatDriveObject: drive, boatMeshObject: hull }), [0, 0, -1], 1e-6, 'the helm\'s forward: turned twice');
  closeV(boatForwardOf({ isSailing: true, boatDriveObject: null, boatMeshObject: hull }), [1, 0, 0], 1e-6, 'no helm: the hull\'s');
  assert.equal(boatForwardOf({ isSailing: false, boatDriveObject: drive, boatMeshObject: hull }), null);
  assert.equal(boatForwardOf(), null);
  const cameraForward = [0, 0, 1];
  for (const turnToView of [0, 1, 2, 3]) {
    const facing = facingFor({ turnToView, animating: true, sheathed: false, stopped: false, boatForward: [0.6, 0.5, 0.8] }, [1, 0, 0], [0, 0, 1], cameraForward);
    assert.deepEqual(facing, [0.6, 0, 0.8], `turnToView ${turnToView}: the boat's heading, its y dropped`);
  }
  assert.deepEqual(facingFor({ turnToView: 3, boatForward: null }, [1, 0, 0], [0, 0, 1], cameraForward), [0, 0, 1], 'ashore the arms stand');
});

test('CSA-J: the hosts - world.js hands the view seam this boot\'s runtime (its receiver, Collider.bounds on the models), the seam hands the camera, the rig no longer wires sailing false, and GetComponentInChildren<Collider> is the node\'s own first collider', () => {
  const w = src('scenes/world.js');
  assert.match(w, /setEotbComeSailAway\(csaRuntime \? \{ send: csaRuntime\.MessageReceiver, colliderBounds: \(go\) => csaColliderBoundsInChildren\(\{ models: csa\.models \}, go\) \} : null\);/);
  const v = src('player/mwView.js');
  assert.match(v, /export function setEotbComeSailAway\(mod\) \{\n\s+eotbCamera\.setComeSailAway\(mod\);/);
  assert.doesNotMatch(src('combat/weaponRig.js'), /sailing: false/);
  assert.match(src('player/eotbBody.js'), /boatForward: boatForwardOf\(eotbCamera\.sailing\(\)\),/, 'the sprite reads the camera\'s fields');
  const node = new PrefabNode('A');
  assert.equal(colliderBoundsInChildren({ models: MODELS }, node), null, 'no collider: null');
  const hidden = new PrefabNode('C'); hidden.setParent(node); hidden.setActive(false);
  hidden.addComponent({ type: 'BoxCollider', m_Center: { x: 0, y: 0, z: 0 }, m_Size: { x: 9, y: 9, z: 9 } });
  const child = new PrefabNode('B'); child.setParent(node);
  child.addComponent({ type: 'BoxCollider', m_Center: { x: 0, y: 1, z: 0 }, m_Size: { x: 2, y: 2, z: 4 } });
  node.position = [5, 0, 0];
  const b = colliderBoundsInChildren({ models: MODELS }, node);
  closeV(b.center, [5, 1, 0], 1e-9); closeV(b.extents, [1, 1, 2], 1e-9);
  node.setActive(false);
  assert.equal(colliderBoundsInChildren({ models: MODELS }, node), null, 'an inactive object answers nothing');
});

// ── the two mods the port does not carry ───────────────────────────────────────

test('CSA-J: World of Daggerfall\'s terrain and Animated Water are not in the port - both lookups null, the water level 34, and Compatibility/AnimatedWaterVertexWaves on changes nothing: the wave frames step, the current is written, the rudder\'s particles play', () => {
  assert.equal(WOD_TERRAIN, null);
  assert.equal(ANIMATED_WATER, null);
  assert.equal(WATER_LEVEL, 34, 'WaterLevel: WODTerrain != null ? 100 : 34');
  const s = scene({ settings: { 'Waves.Enable': true, 'Waves.Speed': 100, 'Compatibility.AnimatedWaterVertexWaves': true } });
  const before = [s.rt.state.waveFrameIndex, s.rt.state.waveFrameTimer];
  s.rt.update();
  assert.notDeepEqual([s.rt.state.waveFrameIndex, s.rt.state.waveFrameTimer], before, 'Update\'s wave frame stepped (4769\'s gate open)');
  s.rt.state.windVectorCurrent = [0, 0, 2];
  s.rt.fixedUpdate();
  assert.deepEqual(s.rt.state.currentVector, [0, 0, 1], 'FixedUpdate\'s current written (5147\'s gate open): no mesh yet, the wind at half strength');
  const boat = s.place(1, 0);
  assert.ok(boat.RudderEmitters.length > 0, 'the Large Boat has rudder particles');
  s.rt.StartSailing(boat);
  assert.ok(boat.RudderEmitters.every((e) => e.isPlaying), 'DisableParticles false: StartSailing plays the rudder\'s particles');
});

// ── the audit's fixes (CSA-J) ─────────────────────────────────────────────────────

test('CSA-J (the audit): OnPostFastTravel - the arrival puts the time scale back to one and says nothing (1973-1976)', () => {
  const s = scene();
  s.setTimeScale(10);
  s.rt.OnPostFastTravel();
  assert.deepEqual(s.out.timeScales, [1]);
  assert.deepEqual(s.out.mid, [], 'ResetTimeScale(message: false)');
  assert.match(src('scenes/world.js'), /if \(warmAshesOn\(\)\) warmAshesPostTravel\(\);[^\n]*\n\s+if \(csaRuntime\) csaCall\(\(\) => csaRuntime\.OnPostFastTravel\(\)\);/, 'the post-travel event, beside Warm Ashes\' subscriber');
});

test('CSA-J (the audit): the hosts - the Transport press leaves the helm before the street\'s window opens; a death or a collapse in a building or underground reaches OnPlayerDeath; the oars\' fatigue is the mode\'s own door; the helm\'s axes indoors are the mode\'s and never gated by paralysis', () => {
  const w = src('scenes/world.js');
  assert.match(w, /openTransport: \(\) => \{ if \(csaRuntime\?\.isSailing\(\) && !gamePaused\(\)\) csaCall\(\(\) => csaRuntime\.StopSailingDelayed\(\)\); mountRig\.open\(\); \},/);
  assert.match(w, /csaOnPlayerDeath: \(\) => \{ if \(csaRuntime\) csaCall\(\(\) => csaRuntime\.OnPlayerDeath\(\)\); \},/);
  assert.match(w, /decreaseFatigue: \(n\) => \{ if \(!modes\?\.drainPlayerFatigue\?\.\(n\)\) playerTicker\.sinks\.drainFatigue\(n\); surfacePlayer\(\); \},/);
  assert.match(w, /_csaAxes = \{ h: axes\.strafe, v: axes\.forward \};/, 'the street\'s axes raw');
  assert.match(w, /csaFrame: \(dt, axes\) => \{ _csaAxes = axes; csaFrame\(dt\); \},/, 'indoors the mod\'s frame is the modes\' to call');
  assert.match(w, /if \(csaRuntime\) csaSounds\(\);[^\n]*\n\s+if \(csaRender\) \{ csaWaveFrames\(\); csaParticleTextures\(\); \}/, 'the waves\' and the particles\' pictures loaded at boot, as Start has them');
  const m = src('scenes/worldModes.js');
  assert.match(m, /function onExhaustedInterior\(\) \{\n\s+if \(_inExhaustion \|\| \(sharedClockOn\(\) && exhaustedShowing\(\)\)\) return;\n\s+_inExhaustion = true;\n\s+host\.csaOnPlayerDeath\?\.\(\);/);   // AUDIT LIVED1b K1: the box's guard beside the latch
  assert.match(m, /const presentInteriorDeath = \(\) => \{\n\s+host\.csaOnPlayerDeath\?\.\(\);/);
  assert.match(m, /csaOnPlayerDeath: \(\) => host\.csaOnPlayerDeath\?\.\(\),/, 'handed to the dungeon');
  assert.match(m, /if \(mode === 'dungeon' && dungeonCtx\?\.drainPlayerFatigue\) \{ dungeonCtx\.drainPlayerFatigue\(n\); return true; \}\n\s+if \(mode === 'interior'\) \{ drainInteriorFatigue\(n\); return true; \}\n\s+return false;/);
  assert.match(m, /\n    \}\n(?:\s*\/\/[^\n]*\n)+\s*host\.csaFrame\?\.\(dt, \{ h: axes\.strafe, v: axes\.forward \}\);\n\s+if \(mode === 'dungeon' && dungeonCtx\) \{/, 'after the motor block, every frame, on this frame\'s axes');
  assert.ok(m.indexOf('host.csaFrame?.(dt') > m.indexOf('player.update(dt, paralyzed ?'), 'after the motor');
  assert.doesNotMatch(w, /!== 'exterior'\) csaFrame\(dt\)/, 'no longer ahead of the modes\' frame');
  const d = src('scenes/dungeonContext.js');
  assert.match(d, /const _prevDeathPresenter = setDeathPresenter\(\(\) => \{\n\s+opts\.csaOnPlayerDeath\?\.\(\);/);
  assert.match(d, /function onExhausted\(\) \{\n[\s\S]{0,900}?if \(out\.kind === 'drown'\) \{[^\n]*return; \}\n[\s\S]{0,800}?const sandSpare = opts\.playerSpare\?\.\(\) \?\? null;\n\s+if \(sandSpare\) \{[^\n]*return; \}[^\n]*\n\s+opts\.csaOnPlayerDeath\?\.\(\);/);   // PIN MOVED (AUDIT ARENA-LADDER A1): the sand's collapse a fall, asked before it   // FIELD BUGS 2026-09-30b SWIM-SPENT (PIN MOVED): a swimmer's drain to nothing is no death - the collapse's arms alone reach OnPlayerDeath
  assert.match(d, /drainPlayerFatigue: \(n\) => drainFatigue\(n\),/);
});

test('CSA-J (the audit): a new game keeps Start\'s rolled wind - DFU calls nothing on a mod\'s save interface for a new game, and the port\'s runtime is the game\'s own; a mod with no newGame still takes its NewSaveData', async () => {
  const { registerModSaveData, newGameModSaveRecords, _resetModSaveData } = await import('../src/systems/modSaveData.js');
  _resetModSaveData();
  try {
    const s = scene();
    s.rt.state.windVectorCurrent = [0.6, 0, 0.8];   // Start's roll, as it stands
    registerModSaveData('come-sail-away', s.rt);
    let restored = null;
    registerModSaveData('other', { newSaveData: () => ({ fresh: true }), getSaveData: () => ({}), restoreSaveData: (d) => { restored = d; } });
    newGameModSaveRecords();
    assert.deepEqual(s.rt.state.windVectorCurrent, [0.6, 0, 0.8], 'not NewSaveData\'s Vector3.forward');
    assert.deepEqual(restored, { fresh: true }, 'the declared new-game restore stands for the others (WA1)');
  } finally { _resetModSaveData(); }
});

test('CSA-J (the audit): a SpawnBoat that throws half way leaves its half-built hull standing in the pool, as the C#\'s GameObject stays in the scene', async () => {
  const { createComeSailAwayPool } = await import('../src/scenes/comeSailAwayPool.js');
  const { Boat } = await import('../src/systems/comeSailAwayBoat.js');
  const { fileURLToPath } = await import('node:url');
  const fileFetch = async (url) => { const bytes = readFileSync(fileURLToPath(url)); return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }; };
  const pool = createComeSailAwayPool({ renderer: null, pipeline: null, fetchFn: fileFetch, log: { warn() {} } });
  await pool.ensureModels();
  const ghost = new Boat(1, 7);   // the Large Boat has seven variants: GetChild(7) throws (1603)
  assert.throws(() => pool.spawnNow(ghost, { position: [0, 0, 0], rotation: [0, 0, 0, 1] }), /out of bounds/);
  assert.ok(pool.boats.length === 1 && pool.boats[0] === ghost, 'the half-built hull stands');
  assert.ok(ghost.GameObject.childCount > 0);
});

test('CSA-J (the audit): the load\'s doors - OnStartLoad ahead of the save\'s player on both loads, OnLoad after the same-dungeon load lands; a load that lands elsewhere lets go of the helm; the boats\' models before the mod loop; a load in progress holds the mod as a pause does; the switch read once; a rider\'s hit carries its hull; past a terrain\'s edge the edge\'s height', () => {
  const w = src('scenes/world.js');
  const q = w.slice(w.indexOf('async function worldQuickLoad('));
  assert.ok(q.indexOf('csaRuntime.OnStartLoad()') < q.indexOf('const extras = restorePlayer(playerEntity, snap, spellsByIndex);'), 'the world load: OnStartLoad first');
  // PIN MOVED (AUDIT WK-P4, 2026-10-01): the same door lifts the party first (crewAshore.clear), the mod's call unchanged
  assert.match(w, /modStartLoad: \(\) => \{ crewAshore\.clear\(\); (?:(?:revenantAshore\.clear|clearSworn)\(\); )?if \(csaRuntime\) csaCall\(\(\) => csaRuntime\.OnStartLoad\(\)\); \},[^\n]*\n\s+modSaveLoad: \(modData\) => \{ restoreModSaveRecords\(modData, csaModLoadFailed\); \},[^\n]*\n\s+modLoaded: \(\) => \{ if \(csaRuntime\) csaCall\(\(\) => csaRuntime\.OnLoad\(\)\); \},/);
  const d = src('scenes/dungeonContext.js');
  assert.match(d, /opts\.modStartLoad\?\.\(\);[^\n]*\n\s+const extras = restorePlayer\(playerEntity, snap, spellsByIndex\);/);
  assert.match(d, /this\.restoreSaved\(extras, setPlayerPos\);\n\s+(?:opts\.outerCampsLoad\?\.\(extras\);[^\n]*\n\s+)?opts\.modLoaded\?\.\(\);/);   // AUDIT REST III A1 (RE-AIMED): the save's camps outside stand before OnLoad, the load's own
  const m = src('scenes/worldModes.js');
  assert.match(m, /modStartLoad: \(\) => host\.modStartLoad\?\.\(\),/);
  assert.match(m, /modLoaded: \(\) => host\.modLoaded\?\.\(\),/);
  // landed elsewhere: the four branches, and the helm let go
  assert.equal((w.match(/csaElsewhere = true/g) ?? []).length, 3, 'the online wake, no door, a save of elsewhere');
  assert.match(w, /csaElsewhere = !pixel;[^\n]*\n\s+if \(!pixel\) townTalk\.say\('\(saved in a dungeon this world cannot find/, 'the dungeon not found');
  assert.match(w, /townTalk\.say\(undergroundWakeText\(wake\.kind\)\);\n\s+csaElsewhere = true;/);
  assert.match(w, /else \{ _wodInside = false; townTalk\.say\('\(the dungeon has no entrance here[^\n]*\n\s+if \(!entered\) csaElsewhere = true;/);
  assert.match(w, /return rec && rec\.currentBoat >= 0 \? \{ \.\.\.modData, \[COME_SAIL_AWAY_VENDOR\]: \{ \.\.\.rec, currentBoat: -1 \} \} : modData;/);
  assert.match(w, /ohAbyss\?\.onRespawnerComplete\(\);[^\n]*\n\s+if \(csaRuntime\) await csa\.preload\(\);[^\n]*\n\s+if \(csaElsewhere\) extras\.modData = csaHelmLeft\(extras\.modData\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s+const hccRecord = extras\.modData\?\.\[HCC_VENDOR\] \?\? null;\n\s+if \(hccRecord\) hccRuntime\.restoreSaveData\(hccRecord\);\n\s+restoreModSaveRecords\(extras\.modData, csaModLoadFailed\);/, 'both before the mod loop (and HCC\'s restore, which reads the same record set)');
  assert.match(w, /const paused = gamePaused\(\) \|\| _loading \|\| _partyArrivalPending;/);
  assert.match(w, /const csaOn = \(\) => _csaOnAtLoad;/);
  assert.match(w, /root: csaRuntime\?\.state\?\.parentedObjects\?\.get\(f\.ai\)\?\.boat\?\.GameObject \?\? null \}\);/);
  assert.match(w, /const c = \(v\) => Math\.max\(0, Math\.min\(TERRAIN_SIZE, v\)\); return terrainSampleHeightAt\(p\.samples, c\(q\[0\] - o\[0\]\), c\(q\[2\] - o\[2\]\), p\._stride \?\? 1\);/);   // FIELD-CSA2: the clamp stands; the height is Unity's heightmap's (terrainSurface.js terrainSampleHeightAt)
  // the bed's press, the gate less its offer rung, in the three doors that answer a bed
  for (const [f, s] of [['world.js', w], ['dungeonContext.js', d], ['worldModes.js', m]]) {
    assert.match(s, /giveOffer,\n\s+\.\.\.\(_restFromBed \? \{ giveOffer: null \} : null\),/, `${f}: the offer rung skipped for a bed`);
  }
  assert.match(d, /restFromBed\(\) \{ _restFromBed = true; try \{ this\.toggleRest\(\); \} finally \{ _restFromBed = false; \} \},/);
});
