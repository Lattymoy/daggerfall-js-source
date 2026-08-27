import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActionSystem, classifyPlacementAction, EFFECT_ACTION_FLAGS,
} from '../src/world/actionSystem.js';
import { layoutRdbBlock, ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';
import { collectInteriorLights, INTERIOR_LIGHT_RANGE } from '../src/world/interiorLights.js';
import { attachInteriorDoorSounds } from '../src/scenes/interiorContext.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { Task } from '../src/systems/quest/task.js';
import { SOUND } from '../src/systems/soundClips.js';
import { multiply, trs } from '../src/world/mat4.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';

// AUDIT 18, world-dungeon lane. Every door pin below drives the REAL
// corpus record through the REAL ActionSystem: the value of these is
// that they prove the shipped data reaches the branch.
//
// DFU sources pinned here (Assets/Scripts):
//   Internal/DaggerfallAction.cs        Receive / Play / Move / SetGlobalVar
//   Internal/DaggerfallActionDoor.cs    ToggleDoor / Open / Close / AttemptBash
//   Internal/DaggerfallActionDoorSpecial.cs   "player cannot open, bash,
//                                        pick, or cast their way through"
//   Internal/DaggerfallInterior.cs      AddLight / AddActionDoors
//   Game/PlayerActivate.cs              the ray tail: ActivateActionDoor
//                                        AND THEN ActionCheck -> Receive(Direct)
//   Utility/RDBLayout.cs                AddActionDoor + AddActionModelHelper

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const approx = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// A collider stub that remembers each bucket's POSE, so a pin can see a
// moving door drag its collision with it.
function stubCollider() {
  const buckets = new Map();
  return {
    buckets,
    addMesh: (key, positions, indices, matrix) => buckets.set(key, matrix),
    removeBucket: (key) => buckets.delete(key),
    removeMesh: () => {},
    raycast: () => Infinity,
  };
}

let _real = null;
function loadReal() {
  if (_real) return _real;
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const cache = new Map();
  const getModel = (id) => {
    if (!cache.has(id)) {
      cache.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 })));
    }
    return cache.get(id);
  };
  _real = { blocks, getModel };
  return _real;
}

/** The dungeon host's registration pass over ONE real RDB, reduced to
 *  what the action runtime needs (block instance ns = 0). */
function buildBlock(name) {
  const { blocks, getModel } = loadReal();
  const index = blocks.getBlockIndex(name);
  const layout = layoutRdbBlock(blocks.getBlock(index), index, true, getModel);
  const collider = stubCollider();
  const actions = new ActionSystem(collider);
  for (const d of layout.actionDoors) {
    if (d.disabled) continue;
    actions.addDoor(getModel(d.modelIdNum), d.matrix, {
      ns: 0, positionKey: d.position, action: d.action, startingLockValue: d.startingLockValue,
    });
  }
  for (const p of layout.placements) {
    if (!p.action) continue;
    const cls = classifyPlacementAction(p.action.actionFlag, false);
    if (cls === 'move') actions.addAction(0, p.position, getModel(p.modelIdNum), p.matrix, p.action);
    else if (cls === 'specialDoor') actions.addSpecialDoor(0, p.position, getModel(p.modelIdNum), p.matrix, p.action);
    else if (cls === 'effect') actions.addEffect(0, p.position, p.action, [p.matrix[12], p.matrix[13], p.matrix[14]]);
    else actions.addRelay(0, p.position, p.action, null, [p.matrix[12], p.matrix[13], p.matrix[14]]);
  }
  for (const f of [...layout.flats, ...layout.markers]) {
    if (!f.action || f.record === 15 || f.record === 16) continue;
    if (EFFECT_ACTION_FLAGS.has(f.action.actionFlag)) actions.addEffect(0, f.position, f.action, [f.x, f.y, f.z]);
    else actions.addRelay(0, f.position, f.action, null, [f.x, f.y, f.z]);
  }
  return { actions, collider, layout };
}

const tick = (actions, seconds, step = 1 / 60) => {
  for (let t = 0; t < seconds; t += step) actions.update(step);
};

// ---------------------------------------------------------------------------
// 1. Move-family action doors actually move.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: a Translation-flagged action door RUNS Move (S0000004 Mantellan Crux)', { skip: skipReal }, () => {
  // DaggerfallAction.Play dispatches actionFunctions[ActionFlag] on
  // whatever GameObject carries the component, and RDBLayout.cs:249-259
  // attaches one to the action-DOOR GameObject
  // (`GameObject cgo = AddActionDoor(...); if (HasAction(obj))
  // AddActionModelHelper(cgo, ...)`). Translation maps to Move
  // (DaggerfallAction.cs:463-476), which tweens ActionTranslation over
  // Duration = ActionDuration / 20. Before this audit the port's door
  // branch hit a bare `return` and the portcullis never rose.
  const { actions, collider } = buildBlock('S0000004.RDB');
  const door = actions.objects.get('act:0:26742');
  const riddle = actions.objects.get('act:0:30869');
  assert.equal(door.kind, 'door');
  assert.equal(door.actionFlag, ACTION_FLAGS.Translation);
  assert.equal(door.triggerFlag, TRIGGER_FLAGS.None);   // chain-only
  assert.equal(door.moveDuration, 54 / 20);             // 2.7 s
  assert.deepEqual(door.moveTranslation, { x: 0, y: 3.2, z: 0 });
  const baseY = door.base[13];

  // The real chain: the ShowTextWithInput riddle flat at 30869 links to
  // the door, and ONLY a matching answer fires ActivateNext.
  let asked = null, submit = null;
  actions.onShowTextInput = (id, cb) => { asked = id; submit = cb; };
  actions.receive(riddle, 'Direct');
  assert.equal(asked, 5404);                    // 5400 + index 4 (sheogorath)
  assert.equal(door.moveState, 'start', 'no cascade at Play for ShowTextWithInput');
  submit('nonsense');
  assert.equal(door.moveState, 'start');
  submit('Crossbow');                           // case-insensitive match
  assert.equal(door.moveState, 'forward');

  tick(actions, 1.35);
  approx(door.matrix[13] - baseY, 1.6, 1e-3);   // linear ease
  tick(actions, 1.4);
  assert.equal(door.moveState, 'end');
  assert.equal(door.moveT, 1);
  approx(door.matrix[13] - baseY, 3.2, 1e-5);
  // The door never swung, so it is still a solid obstacle - dragged to
  // the risen pose, not left blocking the passage it just opened.
  approx(collider.buckets.get(door.key)[13] - baseY, 3.2, 1e-5);
});

// ---------------------------------------------------------------------------
// 2. PlayerActivate runs BOTH checks - the progression block.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: the player click also fires Receive(Direct) - Mynisera\'s door (S0000160)', { skip: skipReal }, () => {
  // PlayerActivate.cs:371-384: ActivateActionDoor(hit, actionDoor) and
  // THEN, with no else and no return, ActionCheck -> Receive(Direct).
  // Both components sit on the one GameObject. Without the second call
  // this door - DFU's own comment at DaggerfallActionDoor.cs:262 names
  // it, "Door to Mynisera's room has a Direct trigger flagged" - is
  // PERMANENTLY un-openable: the DoorText hold's Door-typed Receive is
  // rejected by its Direct gate, activationCount never leaves 0, and
  // the hold returns on every click forever.
  const { actions } = buildBlock('S0000160.RDB');
  const door = actions.objects.get('act:0:16099');
  assert.equal(door.actionFlag, ACTION_FLAGS.DoorText);
  assert.equal(door.triggerFlag, TRIGGER_FLAGS.Direct);
  assert.equal(door.index, 66);
  const texts = [];
  actions.onDoorText = (id) => texts.push(id);

  actions.activate(door.key);
  assert.equal(door.state, 'start', 'first click shows the text and holds the door');
  assert.deepEqual(texts, [7766]);              // 7700 + 66
  assert.equal(door.activationCount, 1, 'Receive increments the counter (DaggerfallAction.cs:250)');

  actions.activate(door.key);
  assert.equal(door.state, 'forward', 'second click opens it');
  assert.deepEqual(texts, [7766], 'the text shows once');
  assert.equal(door.activationCount, 2);
});

// ---------------------------------------------------------------------------
// 3. Play's full delegate table on the toggle path.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: a door toggle runs Play\'s FULL delegate table (S0000041 ShowText door)', { skip: skipReal }, () => {
  // DaggerfallActionDoor.ExecuteActionOnToggle -> action.Receive(...,
  // TriggerTypes.Door) -> Play -> actionFunctions[ActionFlag]. The port
  // used to hand-roll a tail that ran only effects and DoorText, so a
  // door whose record is ShowText/Teleport/SetGlobalVar dropped it.
  const { actions } = buildBlock('S0000041.RDB');
  const door = actions.objects.get('act:0:16554');
  assert.equal(door.actionFlag, ACTION_FLAGS.ShowText);
  assert.equal(door.triggerFlag, TRIGGER_FLAGS.Door);
  const shown = [];
  actions.onShowText = (id) => shown.push(id);
  actions.activate(door.key);
  assert.deepEqual(shown, [8617]);              // 8600 + index 17
  assert.equal(door.state, 'forward', 'and the door still opens');
  // Door gate rejects 'Direct', so PlayerActivate's second call adds nothing.
  assert.equal(door.activationCount, 1);
});

// ---------------------------------------------------------------------------
// 4. Special (secret) doors are lever-only.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: a special door refuses the player and opens only on its chain (S0000022 Orsinium)', { skip: skipReal }, () => {
  // DaggerfallActionDoorSpecial carries NO DaggerfallActionDoor, and
  // PlayerActivate.ActionDoorCheck / WeaponManager.WeaponEnvDamage both
  // resolve DaggerfallActionDoor only - so neither a click nor a bash
  // can reach it. Its trigger flag (None here) then rejects the Direct
  // and Attack Receives that DO reach it.
  const { actions } = buildBlock('S0000022.RDB');
  const outer = actions.objects.get('act:0:26769');
  const inner = actions.objects.get('act:0:26865');
  const lever = actions.objects.get('act:0:25934');
  assert.ok(outer.special && inner.special);
  assert.equal(outer.triggerFlag, TRIGGER_FLAGS.None);
  let bashes = 0;
  actions.onDoorBash = () => bashes++;

  actions.activate(inner.key);
  assert.equal(inner.state, 'start', 'no player open');
  assert.equal(actions.attemptBash(inner, 0.0), false, 'no player bash, whatever the roll');
  assert.equal(inner.state, 'start');
  assert.equal(bashes, 0, 'and no bash sound - there is no door to hear');
  actions.receive(inner, 'Attack');
  assert.equal(inner.state, 'start');

  // The Collision01 lever the level intends: 25934 -> 26769 -> 26865.
  assert.equal(lever.triggerFlag, TRIGGER_FLAGS.Collision01);
  actions.receive(lever, 'WalkOn');
  assert.equal(outer.state, 'forward');
  assert.equal(inner.state, 'forward');
});

// ---------------------------------------------------------------------------
// 5. The swing state is not the action state.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: a MultiTrigger Rotation door swings AND moves (S0000021)', { skip: skipReal }, () => {
  // DaggerfallActionDoor.currentState (the swing) and
  // DaggerfallAction.currentState (the record's Move) are fields on two
  // separate components, and IsPlaying() reads the latter. So the hinge
  // does not gate the record: a player click swings the door through
  // ActivateActionDoor and rotates it through Receive(Direct), both on
  // the same transform. Reading the swing state in IsPlaying instead
  // swallows the Direct Receive and the door never rotates.
  const { actions } = buildBlock('S0000021.RDB');
  const door = actions.objects.get('act:0:11961');
  assert.equal(door.actionFlag, ACTION_FLAGS.Rotation);
  assert.equal(door.triggerFlag, TRIGGER_FLAGS.MultiTrigger);
  approx(door.moveDuration, 4 / 20);            // 0.2 s
  approx(door.moveRotation.y, -22.5, 1e-9);

  actions.activate(door.key);
  assert.equal(door.state, 'forward', 'the hinge swings');
  assert.equal(door.moveState, 'forward', 'and the record Moves');
  // A second click mid-Move is swallowed by Receive's IsPlaying gate.
  actions.activate(door.key);
  assert.equal(door.activationCount, 1);

  tick(actions, 1.6);
  assert.equal(door.state, 'end');
  assert.equal(door.moveState, 'end');
  // Both self-space Y rotations compose on the ONE transform (two
  // iTweens, one GameObject): the -90 hinge plus the record's -22.5,
  // post-multiplied onto the placement. Swing-only would be -90.
  const expected = multiply(door.base, trs(0, 0, 0, 0, -112.5, 0));
  const swingOnly = multiply(door.base, trs(0, 0, 0, 0, -90, 0));
  for (let i = 0; i < 16; i++) approx(door.matrix[i], expected[i], 1e-4);
  assert.ok(Math.abs(door.matrix[0] - swingOnly[0]) > 0.05, 'and it is NOT the bare hinge pose');
});

// ---------------------------------------------------------------------------
// 6. ExecuteActionOnToggle is a full Receive.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: the door toggle honours Receive\'s IsPlaying gate and counter (S0000020)', { skip: skipReal }, () => {
  // ExecuteActionOnToggle is `action.Receive(gameObject,
  // TriggerTypes.Door)` - the WHOLE of Receive, IsPlaying gate and
  // activationCount included. The port's hand-rolled tail skipped both.
  const { actions } = buildBlock('S0000020.RDB');
  const door = actions.objects.get('act:0:17994');
  assert.equal(door.index, 15);                 // 7700 + 15 = 7715, a skip-set id
  assert.equal(door.axisRaw, 15);
  let sounds = 0, trespass = 0;
  actions.onActionSound = () => sounds++;
  actions.onDoorText = () => { throw new Error('7715 is in the patch skip set'); };
  actions.onTrespass = () => trespass++;

  // Click 1: the DoorText hold fires the record, ActionEnabled comes
  // back true (skip-set id), so Open falls through and fires it AGAIN.
  actions.activate(door.key);
  assert.equal(door.activationCount, 2);
  assert.equal(sounds, 2);
  assert.equal(trespass, 2);                    // axisRaw 15 > 5

  // A chained mover mid-tween shuts the record down entirely: DFU's
  // Receive returns before the counter, the sound and the delegate.
  const blocker = actions.addAction(0, 990, { positions: [], indices: [] }, door.base,
    { duration: 40, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 2, z: 0 }, nextObject: -1, triggerFlag: TRIGGER_FLAGS.Direct });
  door.nextKey = 990;
  actions.receive(blocker, 'Direct');
  assert.equal(blocker.state, 'forward');
  tick(actions, 1.6);                           // door swing done, mover still going
  assert.equal(door.state, 'end');
  actions.activate(door.key);                   // bash-close toggle
  assert.equal(door.activationCount, 2, 'IsPlaying(chain) blocked the record');
  assert.equal(sounds, 2);
  assert.equal(trespass, 2);
});

// ---------------------------------------------------------------------------
// 7. Building-interior doors are audible.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: interior doors take DaggerfallActionDoor\'s NormalDoor clip pair', () => {
  // DaggerfallActionDoor.cs:38-39 (and SetInteriorDoorSounds, :224-230)
  // default OpenSound/CloseSound to NormalDoorOpen/NormalDoorClose;
  // DaggerfallInterior.AddActionDoors builds building doors from
  // Option_InteriorDoorPrefab, which carries that component. The
  // dungeon host wires its own (DungeonDoorOpen/Close) - the interior
  // host wired NOTHING, so every building door was silent.
  const played = [];
  const sfx = { play3d: (clip, pos) => played.push([clip, pos]) };
  const collider = stubCollider();
  const actions = new ActionSystem(collider);
  attachInteriorDoorSounds(actions, sfx);
  const base = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1]);
  const door = actions.addDoor({ positions: [], indices: [] }, base);

  actions.activate(door.key);
  assert.deepEqual(played, [[94, [4, 5, 6]]]);            // NormalDoorOpen
  assert.equal(SOUND.NormalDoorOpen, 94);
  tick(actions, 1.6);
  actions.activate(door.key);
  // AUDIT 26 F184: Close() is SILENT - the clip is OnCompleteClose's
  // (:339-346), after the swing. This pin used to read it at the
  // close's first frame, which is the timing the audit corrected.
  assert.equal(played.length, 1, 'nothing yet - the door is still swinging shut');
  tick(actions, 1.6);
  assert.equal(played.length, 2);
  assert.equal(played[1][0], 93);                          // NormalDoorClose
  assert.equal(SOUND.NormalDoorClose, 93);
  assert.notEqual(SOUND.NormalDoorOpen, SOUND.DungeonDoorOpen);
  actions.attemptBash(door, 0.99);
  assert.equal(played[2][0], SOUND.PlayerDoorBash);

  // The seam list in the constructor must not lie about what exists.
  const fresh = new ActionSystem(stubCollider());
  assert.ok('onDoorState' in fresh && 'onDoorBash' in fresh);
});

test('audit18 world-dungeon: the shared interior context wires that seam (both hosts)', () => {
  // worldModes' entered buildings AND the standalone interior scene go
  // through buildInteriorContext, so the wiring belongs there and
  // nowhere else. Source-level because building a real interior needs a
  // GPU; the clips themselves are pinned above.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(join(root, 'src/scenes/interiorContext.js'), 'utf8');
  assert.match(src, /\n\s*attachInteriorDoorSounds\(actions\);/);
});

// ---------------------------------------------------------------------------
// 8. AddLight's per-record range switch.
// ---------------------------------------------------------------------------

test('audit18 world-dungeon: interior light ranges are AddLight\'s second switch, not the prefab base', () => {
  // DaggerfallInterior.cs "adjust properties of light sources": a
  // SECOND switch on TextureRecord overwrites the prefab's range 15.
  // Every record the port emitted was 15, flattening a 4x spread.
  const flats = [];
  for (let record = 0; record <= 29; record++) flats.push({ archive: 210, record, x: 0, y: 0, z: 0 });
  const lights = collectInteriorLights(flats, () => ({ w: 1, h: 0 }));
  assert.deepEqual(lights.map((l) => l.range), [
    20.0, 15, 5, 5, 5, 7.5, 15.0, 15, 15, 15.0,      // 0-9
    15, 5.0, 15, 18.0, 15, 15, 15, 15, 15, 15,       // 10-19
    12.0, 5, 15, 15, 15, 15, 15, 15, 15, 15,         // 20-29
  ]);
  assert.equal(INTERIOR_LIGHT_RANGE, 15);
  // Non-210 flats are not lights at all.
  assert.equal(collectInteriorLights([{ archive: 205, record: 0, x: 0, y: 0, z: 0 }], () => ({ w: 1, h: 0 })).length, 0);
});

// ---------------------------------------------------------------------------
// 9. SetGlobalVar RUNS. It was a gap, not a no-op - AUDIT 18 caught the
//    comment that filed it beside Activate, and this closes the gap the
//    comment had been hiding.
// ---------------------------------------------------------------------------

/** A relay record shaped like RDBLayout's AddAction output. */
const relayRecord = (actionFlag, axisRaw, nextObject = -1, triggerFlag = TRIGGER_FLAGS.None) =>
  ({ actionFlag, index: 0, axisRaw, nextObject, triggerFlag });

test('audit18 world-dungeon: SetGlobalVar (0x1f) sets global #ActionAxisRawValue TRUE, and still cascades', () => {
  // DaggerfallAction.cs:813-816 Activate really is `{ return; }`;
  // :822-827 SetGlobalVar is not - "Global variable index stored in
  // action axis value", then GlobalVars.SetGlobalVar(axisRaw, true).
  const globals = new Map();
  const a = new ActionSystem(stubCollider(), { setGlobalVar: (i, v) => globals.set(i, v) });
  // Chain: the 0x1f relay at position 0 points at an Activate relay at
  // position 1, so Play's cascade is visible as the next object's
  // activationCount. Direct trigger flag = the player's click.
  const next = a.addRelay(0, 1, relayRecord(ACTION_FLAGS.Activate, 0));
  const o = a.addRelay(0, 0, relayRecord(ACTION_FLAGS.SetGlobalVar, 11, 1, TRIGGER_FLAGS.Direct));
  a.receive(o, 'Direct');
  assert.deepEqual([...globals], [[11, true]], 'the axis byte is the global INDEX and the value is TRUE');
  assert.equal(next.activationCount, 1, 'Play cascades to the next object before the delegate');
  // A second record with a different axis byte moves a DIFFERENT global
  // (the byte is an index, never a value), and re-firing is idempotent.
  const other = a.addRelay(0, 2, relayRecord(ACTION_FLAGS.SetGlobalVar, 3));
  a.receive(other);
  a.receive(o, 'Direct');
  assert.deepEqual([...globals].sort((x, y) => x[0] - y[0]), [[3, true], [11, true]]);
  assert.equal(next.activationCount, 2, 'and the cascade fires on every activation');
  // The wrong trigger type still gets nothing: Receive's gate is upstream
  // of the delegate (Direct-flagged, walked into).
  const gated = new ActionSystem(stubCollider(), { setGlobalVar: (i, v) => globals.set(i, v) });
  const g = gated.addRelay(0, 0, relayRecord(ACTION_FLAGS.SetGlobalVar, 44, -1, TRIGGER_FLAGS.Direct));
  gated.receive(g, 'WalkInto');
  assert.equal(globals.has(44), false);
  // No sink wired (the interior host, a headless boot): inert, never a
  // throw, and the cascade is untouched.
  const bare = new ActionSystem(stubCollider());
  const bareNext = bare.addRelay(0, 1, relayRecord(ACTION_FLAGS.Activate, 0));
  bare.receive(bare.addRelay(0, 0, relayRecord(ACTION_FLAGS.SetGlobalVar, 11, 1)));
  assert.equal(bareNext.activationCount, 1);
});

test('audit18 world-dungeon: the SetGlobalVar sink is the quest machine\'s ONE global store', () => {
  // ONE DFU MEMBER, ONE EXPORT: PersistentGlobalVars.cs:53-59 is the
  // port's QuestMachine.globalVars Map - the store a GlobalVarLink task
  // reads (Task.GetTriggerValue) and the store AUDIT 24 put in the save
  // envelope. The action writes THAT store, not a second one.
  const machine = new QuestMachine();
  const a = new ActionSystem(stubCollider(), {
    // dungeonContext's wiring, verbatim.
    setGlobalVar: (index, value) => { machine.globalVars.set(index, value); },
  });
  a.receive(a.addRelay(0, 0, relayRecord(ACTION_FLAGS.SetGlobalVar, 11)));
  const linked = (link) => {
    const t = new Task({ hooks: { globalVars: machine.globalVars } });
    t.globalVarLink = link;
    return t.getTriggerValue();
  };
  assert.equal(linked(11), true, 'a task linked to global #11 is now triggered');
  assert.equal(linked(12), false, 'and only that one moved');
  assert.deepEqual(machine.getSaveData().globalVars, [[11, true]], 'it rides the save envelope');
});

test('audit18 world-dungeon: the dungeon host wires the SetGlobalVar sink to the machine store', () => {
  // The law above runs; this is the WIRING half, which no node test can
  // run (buildDungeonContext needs ARENA2). dungeonContext is the only
  // host that registers relays at all - interiorContext builds doors and
  // nothing else - so this one seam is the whole surface.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const host = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.match(host, /setGlobalVar: \(index, value\) => \{ opts\.questBridge\?\.machine\?\.globalVars\?\.set\(index, value\); \}/);
  // ...and the Ledger row that called it unported is struck.
  const ledger = readFileSync(join(root, 'bible/01-Overview/Port-Ledger.md'), 'utf8');
  const sectionC = ledger.slice(ledger.indexOf('## C. DFU features not yet ported'));
  assert.match(sectionC, /^\| ~~SetGlobalVar \(0x1f\) action delegate~~ SHIPPED/m);
});
