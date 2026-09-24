// ---------------------------------------------------------------------------
// MWCROUCH - GetKeyDown AND GetKeyUp, WHICH THE PORT HAD BEEN DERIVING.
//
// Mac, 2026-09-17: "When crouching with the morrowind model. you can't
// uncrouch".
//
// The motor is innocent and so is the Morrowind rig. `_heightAction`
// (player/motor.js) has no view-mode arm, `get height()` has no MW
// branch, the collider holds world geometry only, and `fpArm` reads the
// SNEAK key rather than the crouch by a rule of its own (Rule 32(a)).
// The four hosts all built the crouch the same way:
//
//     crouch: held(keys, 'Crouch') && !latch.crouch
//     ...
//     latch.crouch = held(keys, 'Crouch');
//
// which is a DERIVATION off the held ring, sampled once a frame. A
// press whose keydown AND keyup both land between two frames is never
// in the ring on a frame that looks at it, so the edge does not exist:
// the tap is swallowed whole. The same shape carried ReadyWeapon (Z),
// SwitchHand's release (H) and the E activate.
//
// Unity does not work that way. `Input.GetKeyDown(k)` answers true on
// the frame FOLLOWING the press event whatever the key does afterwards,
// because the events are buffered and drained per frame; DFU reads
// exactly that through InputManager (:1084-1108, one poll a frame in
// FindKeyboardActions). So a tap shorter than a frame toggles the
// crouch in Daggerfall Unity at any frame rate, and did not here below
// roughly 20 fps - which is precisely where the Morrowind body puts a
// loaded scene, and why the report arrived wearing that name.
//
// The fix is the missing buffer, not a new rule: `keyEdges` +
// `noteKeyDown`/`noteKeyUp` (the host's listeners) + `beginInputFrame`
// (the frame's ONE rotation) + `pressed`/`released` (the dual-dict
// reads, through the same combo arm `held` takes). Rotating once a
// frame is what gives an edge exactly one frame of life - the single
// frame Unity gives it - so a reader behind a shut overlay still DROPS
// its edge rather than banking it, which is the paused-InputManager law
// the old latches carried too.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  keyEdges, noteKeyDown, noteKeyUp, beginInputFrame, pressed, released,
  held, setBindings,
} from '../src/ui/input.js';
import { createBindings, resetDefaults, setBinding, comboCode } from '../src/systems/inputActions.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor } from '../src/player/motor.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const HOSTS = ['world.js', 'exterior.js', 'dungeon.js', 'worldModes.js'];
const host = (f) => readFileSync(join(SRC, 'scenes', f), 'utf8');

const defaults = () => { const b = createBindings(); resetDefaults(b); return b; };

test('MWCROUCH: a press and release entirely between two frames is still an edge', () => {
  setBindings(defaults());
  const keys = new Set(), edge = keyEdges();
  // Frame N: nothing.
  beginInputFrame(edge);
  assert.equal(pressed(edge, keys, 'Crouch'), false);
  // ...between frames: the whole tap. The held ring is empty again by
  // the time the next frame looks, which is the bug's entire mechanism.
  keys.add('KeyC'); noteKeyDown(edge, 'KeyC', false);
  keys.delete('KeyC'); noteKeyUp(edge, 'KeyC');
  beginInputFrame(edge);
  assert.equal(held(keys, 'Crouch'), false, 'the held ring cannot see the tap - this is what the old latch read');
  assert.equal(pressed(edge, keys, 'Crouch'), true, 'GetKeyDown still fires');
  assert.equal(released(edge, keys, 'Crouch'), true, 'and GetKeyUp with it, the same frame - Unity delivers both');
});

test('MWCROUCH: an edge lives for exactly ONE frame, and a held key re-fires nothing', () => {
  setBindings(defaults());
  const keys = new Set(), edge = keyEdges();
  keys.add('KeyC'); noteKeyDown(edge, 'KeyC', false);
  beginInputFrame(edge);
  assert.equal(pressed(edge, keys, 'Crouch'), true);
  for (let i = 0; i < 5; i++) {           // still held, frame after frame
    beginInputFrame(edge);
    assert.equal(pressed(edge, keys, 'Crouch'), false, 'GetKeyDown is the press, not the hold');
    assert.equal(held(keys, 'Crouch'), true, '...while GetKey stays true');
  }
  keys.delete('KeyC'); noteKeyUp(edge, 'KeyC');
  beginInputFrame(edge);
  assert.equal(released(edge, keys, 'Crouch'), true);
  beginInputFrame(edge);
  assert.equal(released(edge, keys, 'Crouch'), false);
});

test('MWCROUCH: auto-repeat is ONE press - Unity fires GetKeyDown once', () => {
  setBindings(defaults());
  const keys = new Set(), edge = keyEdges();
  keys.add('KeyC'); noteKeyDown(edge, 'KeyC', false);
  beginInputFrame(edge);
  assert.equal(pressed(edge, keys, 'Crouch'), true);
  noteKeyDown(edge, 'KeyC', true);        // the DOM's repeat storm
  noteKeyDown(edge, 'KeyC', true);
  beginInputFrame(edge);
  assert.equal(pressed(edge, keys, 'Crouch'), false);
});

test('MWCROUCH: the combo arm is `held`’s - the MODIFIER reads HELD, the key takes the edge', () => {
  const b = defaults();
  setBinding(b, comboCode('ShiftLeft', 'KeyC'), 'Crouch', true);
  setBindings(b);
  const keys = new Set(), edge = keyEdges();
  // The modifier is HELD across frames and never appears in the down
  // ring again; the combo'd key taps between two frames.
  keys.add('ShiftLeft'); noteKeyDown(edge, 'ShiftLeft', false);
  beginInputFrame(edge);
  keys.add('KeyC'); noteKeyDown(edge, 'KeyC', false);
  keys.delete('KeyC'); noteKeyUp(edge, 'KeyC');
  beginInputFrame(edge);
  assert.equal(pressed(edge, keys, 'Crouch'), true, 'the modifier answers off the held Set (:1695), the key off the ring');
  // ...and with the modifier up, the combo does not fire.
  keys.delete('ShiftLeft'); noteKeyUp(edge, 'ShiftLeft');
  beginInputFrame(edge);
  keys.add('KeyC'); noteKeyDown(edge, 'KeyC', false);
  keys.delete('KeyC'); noteKeyUp(edge, 'KeyC');
  beginInputFrame(edge);
  assert.equal(pressed(edge, keys, 'Crouch'), false);
});

test('MWCROUCH: a rebind moves the edge, exactly as it moves held()', () => {
  const b = defaults();
  setBinding(b, 'KeyV', 'Crouch', true);
  setBindings(b);
  const keys = new Set(), edge = keyEdges();
  noteKeyDown(edge, 'KeyV', false);
  beginInputFrame(edge);
  assert.equal(pressed(edge, keys, 'Crouch'), true);
});

test('MWCROUCH (re-aimed by KB1): E is the Interact ACTION on the down ring - the raw `pressedCode` departure is retired, so a rebind moves it', () => {
  // MWCROUCH pinned `pressedCode(edge, 'KeyE')`, the port's one recorded raw read. KB1 made E the Interact action
  // and deleted the raw reader: the edge is `pressed` like every other press, and follows the binding.
  const b = defaults();
  setBindings(b);
  const edge = keyEdges();
  noteKeyDown(edge, 'KeyE', false);
  beginInputFrame(edge);
  assert.equal(pressed(edge, new Set(['KeyE']), 'Interact'), true);
  beginInputFrame(edge);
  assert.equal(pressed(edge, new Set(['KeyE']), 'Interact'), false, 'one frame, then gone');
  setBinding(b, 'KeyG', 'Interact');
  setBindings(b);
  noteKeyDown(edge, 'KeyE', false);
  beginInputFrame(edge);
  assert.equal(pressed(edge, new Set(['KeyE']), 'Interact'), false, 'moved off E, E no longer interacts');
});

// The motor half: the edge the hosts now hand it does uncrouch.
function room() {
  const c = new Collider(() => -Infinity);
  const quad = (y) => ({
    positions: new Float32Array([-10, y, -10, 10, y, -10, 10, y, 10, -10, y, 10]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const f = quad(0); c.addMesh('floor', f.positions, f.indices, I);
  const ce = quad(4); c.addMesh('ceil', ce.positions, ce.indices, I);
  return c;
}

test('MWCROUCH: a sub-frame tap crouches AND uncrouches at 10 fps', () => {
  setBindings(defaults());
  const keys = new Set(), edge = keyEdges();
  const player = new PlayerMotor(room());
  player.spawn(0, 0, 0);
  const DT = 1 / 10;   // the Morrowind body's loaded scene, near enough
  const bag = (crouch) => ({ forward: 0, strafe: 0, run: false, autoRun: false, back: false, sneak: false, jump: false, up: false, down: false, crouch });
  // A frame with a tap that begins and ends between two of them.
  const tapFrame = () => {
    keys.add('KeyC'); noteKeyDown(edge, 'KeyC', false);
    keys.delete('KeyC'); noteKeyUp(edge, 'KeyC');
    beginInputFrame(edge);
    player.update(DT, bag(pressed(edge, keys, 'Crouch')), 0, 0);
  };
  const idleFrame = () => { beginInputFrame(edge); player.update(DT, bag(pressed(edge, keys, 'Crouch')), 0, 0); };
  for (let i = 0; i < 20; i++) idleFrame();
  tapFrame();
  for (let i = 0; i < 5; i++) idleFrame();
  assert.equal(player.crouching, true, 'the tap crouched');
  tapFrame();
  for (let i = 0; i < 5; i++) idleFrame();
  assert.equal(player.crouching, false, 'and the next tap STOOD - the report, closed');
});

test('MWCROUCH: the old derivation is gone from every host', () => {
  for (const f of HOSTS) {
    const s = host(f);
    // The four latch reads, by the shapes they had.
    assert.ok(!/crouch:\s*crouchHeld\s*&&\s*!/.test(s), `${f}: the crouch is still derived off the held ring`);
    assert.ok(!/latch\.crouch|prevCrouch/.test(s), `${f}: a crouch latch survives`);
    // An ASSIGNMENT, not a mention: world.js's WEAPON-VIS2 block quotes
    // the retired `zNowW && !zPrevW` by name, and that history stays.
    assert.ok(!/\b[zh]Prev\w*\s*=[^=]/.test(s), `${f}: a Z/H latch survives`);
    assert.ok(!/latch\.use\s*=|prevUse\s*=/.test(s), `${f}: a use latch survives`);
    // ...and the reads that replaced them.
    assert.ok(/pressed\((keyEdge|latch\.edge), keys, 'Crouch'\)/.test(s), `${f}: no GetKeyDown crouch`);
    assert.ok(/pressed\((keyEdge|latch\.edge), keys, 'ReadyWeapon'\)/.test(s), `${f}: no GetKeyDown ReadyWeapon`);
    assert.ok(/released\((keyEdge|latch\.edge), keys, 'SwitchHand'\)/.test(s), `${f}: SwitchHand must read the UP ring (WeaponManager.cs:272)`);
    assert.ok(/pressed\((keyEdge|latch\.edge), keys, 'Interact'\)/.test(s), `${f}: no GetKeyDown Interact (KB1: the action, not a raw KeyE)`);
  }
});

test('MWCROUCH: every host that OWNS a frame rotates the ring exactly once, and feeds it both edges', () => {
  for (const f of ['world.js', 'exterior.js', 'dungeon.js']) {
    const s = host(f);
    const rot = s.match(/beginInputFrame\(/g) ?? [];
    assert.equal(rot.length, 1, `${f}: the rotation is the frame's, once - a second call throws the frame's edges away`);
    assert.ok(/frameBegin\(now\);[^\n]*\n\s*beginInputFrame\(/.test(s), `${f}: the rotation sits at the head of the frame, above the video hold`);
    assert.ok(/noteKeyDown\((keyEdge|latch\.edge), e\.code, e\.repeat\)/.test(s), `${f}: the keydown listener must note the press`);
    assert.ok(/noteKeyUp\((keyEdge|latch\.edge), e\.code\)/.test(s), `${f}: the keyup listener must note the release`);
    assert.ok(/noteKeyDown\((keyEdge|latch\.edge), mc\)/.test(s), `${f}: the MOUSE codes ride the ring too (AUDIT 39r's law)`);
    assert.ok(/noteKeyUp\((keyEdge|latch\.edge), mc\)/.test(s), `${f}: ...and their release`);
  }
  // The mode machine owns no frame: it READS the host's ring off the
  // shared latch bag and must never rotate it (that would eat the
  // host's own edges for the frame).
  const wm = host('worldModes.js');
  assert.ok(!/beginInputFrame|noteKeyDown|noteKeyUp|keyEdges\(/.test(wm), 'worldModes must not own or rotate a ring');
  assert.ok(/latch\.edge/.test(wm), 'worldModes reads the host ring off the shared latch bag');
});

test('MWCROUCH: the crouch KEY still drives the levitate descent, which is HELD', () => {
  for (const f of HOSTS) {
    assert.ok(/down: crouchHeld \|\| held\(keys, 'FloatDown'\)/.test(host(f)),
      `${f}: AUDIT 26 F031 - LevitateMotor reads Crouch HELD for the descent, not its edge`);
  }
});
