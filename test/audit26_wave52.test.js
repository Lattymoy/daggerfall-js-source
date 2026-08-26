// SAVE WAVE 5.2 - THE ENVELOPE CARRIES THE WEAPON AND THE STANCE.
//
// DFU writes four members the port carried none of:
//   SerializablePlayer.cs:175   data.weaponDrawn  = !weaponManager.Sheathed
//   SerializableGameObject.cs:228-230 / SerializablePlayer.cs:212-214
//                               playerPosition.yaw / .pitch / .isCrouching
// and restores them at :420 (Sheathed = !weaponDrawn) and inside
// RestorePosition at :475-477 (SetFacing(yaw, pitch) then
// playerMotor.IsCrouching). Without them every load stood the player
// up, sheathed their weapon and pointed them at the default heading -
// in a dungeon, an unarmed character facing the wrong way mid-fight.
//
// The fifth member, `usingLeftHand` (:176), is DELIBERATELY ABSENT:
// the port has no hand to switch. Pinned below with its reason.
//
// THE ORDER IS THE LAW. SaveLoadManager runs RestorePositionHelper at
// :1476 and RestoreSaveData - which reaches RestorePosition - at
// :1497. A facing written before the respawn is the silently-clobbered
// case; these pins run the SHIPPED bodies, lifted out of the hosts, so
// moving a line across that seam fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  snapshotPlayer, restorePlayer, composeSessionState, writeQuicksave as writeQuicksaveTo, dungeonLocationKey,
} from '../src/systems/save.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8');

/** The `{ ... }` block containing index `i` (audit26_s1_restore.js'
 *  helper - matched, never guessed at by character count). */
function braceBlock(text, i) {
  const open = text.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === '{') depth++;
    else if (text[k] === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  return text.slice(open);
}
/** Lift a named function/method body out of a source file by its exact
 *  signature line, so the pin runs the SHIPPED code and not a copy. */
function lift(rel, signature) {
  const src = readSrc(rel);
  const i = src.indexOf(signature);
  assert.ok(i > 0, `${signature} is where it says it is in ${rel}`);
  return { src, head: signature, body: braceBlock(src, i + signature.length - 1) };
}

const bare = () => ({ stats: {}, skills: [], items: [] });

// ---------------------------------------------------------------
// 1. THE ENVELOPE. All four members round-trip through the REAL
//    save.js, JSON and all.
// ---------------------------------------------------------------
test('S5.2: weaponDrawn/yaw/pitch/isCrouching ride the envelope and come back exact', () => {
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(bare(), {
    position: [1, 2, 3], locationKey: 'world',
    weaponDrawn: true, yaw: Math.PI / 2, pitch: -0.75, isCrouching: true,
  })));
  // written under DFU's OWN member names
  assert.deepEqual(
    { weaponDrawn: snap.weaponDrawn, yaw: snap.yaw, pitch: snap.pitch, isCrouching: snap.isCrouching },
    { weaponDrawn: true, yaw: Math.PI / 2, pitch: -0.75, isCrouching: true });
  const extras = restorePlayer(bare(), snap, null);
  assert.ok(extras, 'the version round-trips');
  assert.deepEqual(
    { weaponDrawn: extras.weaponDrawn, yaw: extras.yaw, pitch: extras.pitch, isCrouching: extras.isCrouching },
    { weaponDrawn: true, yaw: Math.PI / 2, pitch: -0.75, isCrouching: true });
  // the OTHER pole of each boolean, so a hardcoded default cannot pass
  const s2 = JSON.parse(JSON.stringify(snapshotPlayer(bare(), {
    weaponDrawn: false, yaw: -3.14, pitch: 0, isCrouching: false,
  })));
  const e2 = restorePlayer(bare(), s2, null);
  assert.deepEqual(
    { weaponDrawn: e2.weaponDrawn, yaw: e2.yaw, pitch: e2.pitch, isCrouching: e2.isCrouching },
    { weaponDrawn: false, yaw: -3.14, pitch: 0, isCrouching: false });
});

// ---------------------------------------------------------------
// 2. THE UNITS. DFU's PlayerMouseLook.Yaw/Pitch are DEGREE-valued
//    properties over a radian field (PlayerMouseLook.cs:62-84). The
//    port has no PlayerMouseLook - cam.yaw/cam.pitch ARE the radian
//    field - so the envelope carries RADIANS, the unit the enemy `yaw`
//    in the same envelope already uses. radians-vs-degrees is on the
//    audit's standing hazard list: this pin states the number.
// ---------------------------------------------------------------
test('S5.2: yaw and pitch travel in RADIANS - a quarter turn is PI/2, never 90', () => {
  const extras = restorePlayer(bare(),
    JSON.parse(JSON.stringify(snapshotPlayer(bare(), { yaw: Math.PI / 2, pitch: Math.PI / 4 }))), null);
  assert.equal(extras.yaw, Math.PI / 2);
  assert.equal(extras.pitch, Math.PI / 4);
  assert.ok(Math.abs(extras.yaw) <= Math.PI * 2 && Math.abs(extras.pitch) <= Math.PI * 2,
    'a degree-valued envelope would be two orders out here');
  // and no host converts on the way in or out
  for (const [rel, sig] of [
    ['src/scenes/world.js', '  function worldQuickSave() {'],
    ['src/scenes/worldModes.js', '  async function tryEnterDungeon(hit, entries) {'],
  ]) {
    const { body } = lift(rel, sig);
    assert.ok(/yaw: cam\.yaw/.test(body), `${rel} writes cam.yaw raw`);
    assert.ok(!/yaw:[^,\n]*180 \/ Math\.PI/.test(body) && !/yaw:[^,\n]*Math\.PI \/ 180/.test(body),
      `${rel} must not convert the facing to degrees`);
  }
});

// ---------------------------------------------------------------
// 3. THE POLARITY. `weaponDrawn` is DFU's literal INVERSION on BOTH
//    sides (:175 save, :420 restore). An inversion applied on one side
//    only round-trips through one host and not the other and is
//    invisible in play, so it is pinned as a literal on all four
//    sites AND run end-to-end below.
// ---------------------------------------------------------------
test('S5.2: weaponDrawn is the INVERSION of sheathed, on the save side and the restore side, in both hosts', () => {
  const saves = [
    ['src/scenes/world.js', '  function worldQuickSave() {'],
    ['src/scenes/dungeonContext.js', '    quickSave() {'],
  ];
  for (const [rel, sig] of saves) {
    const { body } = lift(rel, sig);
    assert.ok(body.includes('weaponDrawn: !weaponRig.playerWeapon.sheathed'),
      `${rel} writes DRAWN, not sheathed (SerializablePlayer.cs:175)`);
  }
  const restores = [
    ['src/scenes/world.js', '  async function worldQuickLoad() {'],
    ['src/scenes/dungeonContext.js', '    applyLoadedScene(extras, setPlayerPos) {'],
  ];
  for (const [rel, sig] of restores) {
    const { body } = lift(rel, sig);
    assert.ok(body.includes('weaponRig.playerWeapon.sheathed = !extras.weaponDrawn'),
      `${rel} inverts it back (SerializablePlayer.cs:420)`);
  }
});

// ---------------------------------------------------------------
// 4. THE DUNGEON HOST, RUN. The SHIPPED quickSave and
//    applyLoadedScene bodies, lifted and executed against stubs, over
//    the real save.js. This is the round trip for the dungeon host.
// ---------------------------------------------------------------
function dungeonHost({ sheathed = false, yaw = 1.25, pitch = -0.5, crouching = true } = {}) {
  const cam = { yaw, pitch };
  const motor = { crouching };
  const weaponRig = { playerWeapon: { sheathed } };
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const opts = {
    playerFacing: () => ({ yaw: cam.yaw, pitch: cam.pitch, crouching: motor.crouching }),
    setPlayerFacing: (f) => {
      if (f?.yaw != null) cam.yaw = f.yaw;
      if (f?.pitch != null) cam.pitch = f.pitch;
      if (f?.crouching != null) motor.crouching = f.crouching;
    },
  };
  const log = [];
  const env = {
    opts, weaponRig, playerEntity: bare(),
    lastPlayerFeet: [7, 8, 9], classicMinutesRef: { value: 4242 },
    magic: { readiedIndex: () => null },
    snapshotPlayer, composeSessionState,
    writeQuicksave: (s) => writeQuicksaveTo(s, storage),
    _locationKey: dungeonLocationKey(19),
    collectWorld: () => ({ pixel: { x: 1, y: 2 }, foes: [], piles: [] }),
    hudText: { add: (t) => log.push(t) },
    applyWorld: () => log.push('applyWorld'),
    enterDungeonAutomap: () => ({}),
    automapKey: 'k',
    surfacePlayer: () => {},
    stopConstellationAnim: () => {},
    chargenFlow: null,
    DeathScreen: class {},
  };
  const names = Object.keys(env);
  const qs = lift('src/scenes/dungeonContext.js', '    quickSave() {');
  const al = lift('src/scenes/dungeonContext.js', '    applyLoadedScene(extras, setPlayerPos) {');
  // `automapRec` and `activeOverlay` are closure `let`s in the context;
  // the two the shipped bodies assign are declared here so the lifted
  // code is byte-identical to what ships.
  const build = new Function(...names, `
    let automapRec = null, activeOverlay = null;
    return {
      quickSave() ${qs.body},
      applyLoadedScene(extras, setPlayerPos) ${al.body},
    };`);
  const ctx = build(...names.map((n) => env[n]));
  return { ctx, cam, motor, weaponRig, storage, log, key: env._locationKey };
}

test('S5.2: the DUNGEON host round-trips all four - the shipped quickSave and applyLoadedScene bodies, run', () => {
  // saved: weapon DRAWN, facing 1.25/-0.5 rad, crouched
  const a = dungeonHost({ sheathed: false, yaw: 1.25, pitch: -0.5, crouching: true });
  a.ctx.quickSave();
  const snap = JSON.parse(a.storage.getItem('dagger.quicksave'));
  assert.deepEqual(
    { weaponDrawn: snap.weaponDrawn, yaw: snap.yaw, pitch: snap.pitch, isCrouching: snap.isCrouching },
    { weaponDrawn: true, yaw: 1.25, pitch: -0.5, isCrouching: true },
    'the dungeon envelope carries the inverted sheath and the radian facing');

  // loaded into a session standing the other way in every respect
  const b = dungeonHost({ sheathed: true, yaw: 0, pitch: 0, crouching: false });
  const extras = restorePlayer(bare(), snap, null);
  b.ctx.applyLoadedScene(extras, () => {});
  assert.equal(b.weaponRig.playerWeapon.sheathed, false, 'a drawn weapon comes back drawn (:420)');
  assert.deepEqual([b.cam.yaw, b.cam.pitch], [1.25, -0.5], 'SetFacing(yaw, pitch) (:475)');
  assert.equal(b.motor.crouching, true, 'playerMotor.IsCrouching (:477)');

  // and the other pole, so nothing here passes by defaulting
  const c = dungeonHost({ sheathed: true, yaw: -2, pitch: 0.25, crouching: false });
  c.ctx.quickSave();
  const snap2 = JSON.parse(c.storage.getItem('dagger.quicksave'));
  assert.deepEqual(
    { weaponDrawn: snap2.weaponDrawn, isCrouching: snap2.isCrouching, yaw: snap2.yaw },
    { weaponDrawn: false, isCrouching: false, yaw: -2 });
  const d = dungeonHost({ sheathed: false, yaw: 3, pitch: -1, crouching: true });
  d.ctx.applyLoadedScene(restorePlayer(bare(), snap2, null), () => {});
  assert.equal(d.weaponRig.playerWeapon.sheathed, true);
  assert.deepEqual([d.cam.yaw, d.cam.pitch], [-2, 0.25]);
  assert.equal(d.motor.crouching, false);
});

// ---------------------------------------------------------------
// 4b. THE EXTERIOR HOST, RUN. The SHIPPED worldQuickSave body, lifted
//     and executed against stubs over the real save.js - the same
//     round trip as the dungeon host, on the other saving host.
// ---------------------------------------------------------------
function exteriorSave({ sheathed = false, yaw = 0.5, pitch = -0.25, crouching = true } = {}) {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const env = {
    walkMode: true, playerSpawned: true,
    player: { pos: [10, 1, 20], crouching },
    cam: { yaw, pitch, pos: [10, 2, 20] },
    weaponRig: { playerWeapon: { sheathed } },
    state: { worldCoords: () => ({ x: 100, z: 200 }), compensation: [0, 0, 0] },
    snapshotPlayer, composeSessionState, equippedWeaponIndex: () => -1, copyEffectEntry: (a) => ({ ...a }),
    writeQuicksave: (sn) => writeQuicksaveTo(sn, storage),
    playerEntity: bare(),
    playerTicker: { classicMinutes: 4242 },
    magic: { readiedIndex: () => null },
    questBridge: null,
    rumorMill: { getSaveData: () => ({}) }, topicTree: { getSaveData: () => ({}) }, npcSession: { getSaveData: () => ({}) },
    playerTravelPixel: () => ({ x: 3, y: 4 }),
    droppedLoot: { snapshotWorld: () => [] },
    exteriorFoes: { foes: [] },
    townTalk: { say: () => {} },
  };
  const names = Object.keys(env);
  const qs = lift('src/scenes/world.js', '  function worldQuickSave() {');
  const build = new Function(...names, `return function worldQuickSave() ${qs.body};`);
  build(...names.map((n) => env[n]))();
  return JSON.parse(storage.getItem('dagger.quicksave'));
}

test('S5.2: the EXTERIOR host round-trips all four - the shipped worldQuickSave body, run', () => {
  const drawn = exteriorSave({ sheathed: false, yaw: 0.5, pitch: -0.25, crouching: true });
  assert.deepEqual(
    { weaponDrawn: drawn.weaponDrawn, yaw: drawn.yaw, pitch: drawn.pitch, isCrouching: drawn.isCrouching },
    { weaponDrawn: true, yaw: 0.5, pitch: -0.25, isCrouching: true });
  const sheathedSnap = exteriorSave({ sheathed: true, yaw: -1.75, pitch: 1, crouching: false });
  assert.deepEqual(
    { weaponDrawn: sheathedSnap.weaponDrawn, yaw: sheathedSnap.yaw, pitch: sheathedSnap.pitch, isCrouching: sheathedSnap.isCrouching },
    { weaponDrawn: false, yaw: -1.75, pitch: 1, isCrouching: false },
    'both poles, so nothing here passes by defaulting');
  // and the envelope really comes back out of restorePlayer
  const extras = restorePlayer(bare(), drawn, null);
  assert.deepEqual(
    { weaponDrawn: extras.weaponDrawn, yaw: extras.yaw, pitch: extras.pitch, isCrouching: extras.isCrouching },
    { weaponDrawn: true, yaw: 0.5, pitch: -0.25, isCrouching: true });
});

// ---------------------------------------------------------------
// 5. A PRE-FIX SNAPSHOT. None of the four members: the load must go
//    exactly as it does today - the live weapon, facing and stance
//    stand. (A DEPARTURE from C#, whose deserializer would hand
//    RestoreSaveData false/0f and so sheathe the weapon and point the
//    player at heading 0; recorded in save.js.)
// ---------------------------------------------------------------
test('S5.2: a pre-fix envelope carries none of the four and changes nothing on load', () => {
  const old = JSON.parse(JSON.stringify(snapshotPlayer(bare(), { position: [1, 2, 3], locationKey: dungeonLocationKey(19) })));
  for (const k of ['weaponDrawn', 'yaw', 'pitch', 'isCrouching']) delete old[k];
  const extras = restorePlayer(bare(), old, null);
  assert.deepEqual(
    { weaponDrawn: extras.weaponDrawn, yaw: extras.yaw, pitch: extras.pitch, isCrouching: extras.isCrouching },
    { weaponDrawn: null, yaw: null, pitch: null, isCrouching: null },
    'a missing member reads as null, not as false/0');
  const h = dungeonHost({ sheathed: false, yaw: 2.5, pitch: -0.25, crouching: true });
  h.ctx.applyLoadedScene(extras, () => {});
  assert.equal(h.weaponRig.playerWeapon.sheathed, false, 'the live sheath stands');
  assert.deepEqual([h.cam.yaw, h.cam.pitch], [2.5, -0.25], 'the live facing stands');
  assert.equal(h.motor.crouching, true, 'the live stance stands');
  // the exterior host guards the same way
  const { body } = lift('src/scenes/world.js', '  async function worldQuickLoad() {');
  for (const guard of [
    'if (extras.yaw != null) cam.yaw = extras.yaw;',
    'if (extras.pitch != null) cam.pitch = extras.pitch;',
    'if (extras.isCrouching != null) player.crouching = extras.isCrouching;',
    'if (extras.weaponDrawn != null) weaponRig.playerWeapon.sheathed = !extras.weaponDrawn;',
  ]) assert.ok(body.includes(guard), `world.js leaves the live value standing for a null: ${guard}`);
});

// ---------------------------------------------------------------
// 6. THE ORDER. The facing is applied AFTER the host switch, never
//    before (SaveLoadManager.cs:1476 < :1497). This is the bug the
//    save brief warns about and it has shipped here before.
// ---------------------------------------------------------------
test('S5.2: the facing, the stance and the sheath land AFTER restorePositionHelper, never before', () => {
  const { body } = lift('src/scenes/world.js', '  async function worldQuickLoad() {');
  const switchAt = body.indexOf('await restorePositionHelper(snap)');
  assert.ok(switchAt > 0, 'the load still runs the one seam');
  for (const after of [
    'cam.yaw = extras.yaw',
    'cam.pitch = extras.pitch',
    'player.crouching = extras.isCrouching',
    'weaponRig.playerWeapon.sheathed = !extras.weaponDrawn',
  ]) {
    const at = body.indexOf(after);
    assert.ok(at > switchAt, `${after} must be applied after the host switch (RestorePosition is reached from :1497)`);
  }
  const before = body.slice(0, switchAt);
  for (const early of ['cam.yaw', 'cam.pitch', 'player.crouching', 'playerWeapon.sheathed']) {
    assert.ok(!before.includes(early),
      `${early} must not be written before the respawn - the respawn would clobber it silently`);
  }
  // the DUNGEON arm's facing is not written here at all: it rides
  // applyLoadedScene, which is the body the standalone page runs too
  assert.ok(body.includes("if (restoredHost !== 'dungeon') {"),
    'the exterior arm alone applies facing here; the dungeon arm has its own RestorePosition body');
  // ...and inside that body the facing lands AFTER the position, as
  // RestorePosition does (position :450-458, facing :475-477)
  const al = lift('src/scenes/dungeonContext.js', '    applyLoadedScene(extras, setPlayerPos) {').body;
  assert.ok(al.indexOf('opts.setPlayerFacing?.(') > al.indexOf('setPlayerPos(extras.position)'),
    'facing after position, RestorePosition\'s own order');
  assert.ok(al.indexOf('weaponRig.playerWeapon.sheathed =') > al.indexOf('opts.setPlayerFacing?.('),
    'the sheath is OUTSIDE RestorePosition and lands after it (:420 follows :416)');
});

// ---------------------------------------------------------------
// 7. usingLeftHand - SKIPPED, and why. DFU inverts it on both sides
//    (:176, :421) off WeaponManager.UsingRightHand, which
//    ToggleHand (:700-710) flips. The port has no hand to switch:
//    the rig binds EQUIP_SLOTS.RightHand unconditionally and
//    FPSWeapon's FlipHorizontal is unimplemented. Persisting a member
//    the port cannot hold is the same defect as dropping one it can
//    (the save brief's re-derive rule).
// ---------------------------------------------------------------
test('S5.2: usingLeftHand is NOT persisted - the port has no hand to switch', () => {
  const snap = snapshotPlayer(bare(), { weaponDrawn: true });
  assert.equal('usingLeftHand' in snap, false, 'no member for state the port does not have');
  assert.equal('usingRightHand' in snap, false);
  const rig = readSrc('src/combat/weaponRig.js');
  assert.ok(rig.includes('playerWeapon.weapon = entity.equip.slots[EQUIP_SLOTS.RightHand]'),
    'the rig binds the right hand unconditionally - there is nothing to save');
  assert.ok(!/usingRightHand/.test(rig) && !/usingRightHand/.test(readSrc('src/combat/playerWeapon.js')),
    'and no live flag anywhere to read one off');
  assert.ok(readSrc('src/combat/fpsWeapon.js').includes('FlipHorizontal (the left-handed option) is not implemented'),
    'FPSWeapon\'s own header says the other hand is unbuilt');
});

// ---------------------------------------------------------------
// 8. THE FOUR HOSTS. Every host that can save or load must be wired
//    or explicitly N/A.
// ---------------------------------------------------------------
test('S5.2: the four hosts - both saving hosts write it, both mounting hosts supply the facing, the rest are N/A', () => {
  // world.js - WIRED, both directions
  const w = readSrc('src/scenes/world.js');
  assert.ok(lift('src/scenes/world.js', '  function worldQuickSave() {').body
    .includes('yaw: cam.yaw, pitch: cam.pitch, isCrouching: !!player.crouching'));
  assert.ok(w.includes('if (extras.isCrouching != null) player.crouching = extras.isCrouching;'));
  // dungeonContext.js - WIRED, both directions, through the host slot
  const dc = readSrc('src/scenes/dungeonContext.js');
  assert.ok(dc.includes('const facing = opts.playerFacing?.() ?? null;'));
  assert.ok(dc.includes('opts.setPlayerFacing?.({ yaw: extras.yaw, pitch: extras.pitch, crouching: extras.isCrouching })'));
  // worldModes.js - WIRED: it owns the cam and motor the dungeon
  // context borrows, and hands both halves to every context it builds
  const wm = lift('src/scenes/worldModes.js', '  async function tryEnterDungeon(hit, entries) {').body;
  assert.ok(wm.includes('playerFacing: () => ({ yaw: cam.yaw, pitch: cam.pitch, crouching: player.crouching })'));
  assert.ok(wm.includes('setPlayerFacing: (f) => {'));
  // scenes/dungeon.js - WIRED: the standalone page saves and loads
  // through the same context, so it supplies the same pair (deferred,
  // because its cam and motor are built after the boot ?load)
  const d = readSrc('src/scenes/dungeon.js');
  assert.ok(d.includes('playerFacing, setPlayerFacing }'), 'the standalone page hands the pair down');
  assert.ok(d.includes('view.cam = cam; view.player = player;'), 'and connects it once the camera exists');
  assert.ok(d.includes('if (view.pending)'), 'a facing restored by the boot ?load is held and applied with the spawn');
  // scenes/exterior.js - N/A: the standalone exterior page has no
  // quicksave and no quickload at all, so there is no envelope to
  // carry and nothing to restore into.
  const e = readSrc('src/scenes/exterior.js');
  assert.equal(/quickSave|quickLoad|snapshotPlayer/.test(e), false,
    'the standalone exterior page saves nothing - N/A, not unwired');
  // interiors - N/A: no host can quicksave from inside a building
  // (S2 / Ledger F221), which is why restorePositionHelper's arm 2 is
  // written out and unhandled.
  assert.ok(readSrc('src/scenes/worldModes.js').includes('Deliberately absent: quickSave/quickLoad. Interior saving really'),
    'the interior arm still says it saves nothing');
});
