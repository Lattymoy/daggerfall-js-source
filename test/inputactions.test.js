// I1: the input registry against InputManager.cs. Every pin here is a
// DFU literal or a behaviour DFU's own code exhibits - the reset
// quirk, the load path's raw adds, the unknown-action round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, DEFAULT_BINDINGS, parseActionName,
  createBindings, setBinding, clearBinding, clearBindingByCode,
  addRemovedPrimaryAction, getBinding, getBindings, actionForCode,
  resetDefaults, serializeKeyBinds, loadKeyBinds,
  createActionState, addAction, hasAction, actionStarted, actionComplete, endFrame,
} from '../src/systems/inputActions.js';

test('I1: the Actions enum, verbatim names and order (:324-384)', () => {
  assert.deepEqual([...ACTIONS], [
    'Escape', 'ToggleConsole',
    'MoveForwards', 'MoveBackwards', 'TurnLeft', 'MoveLeft', 'TurnRight', 'MoveRight',
    'FloatUp', 'FloatDown', 'Jump', 'Crouch', 'Slide', 'Run',
    'Rest', 'Transport', 'StealMode', 'GrabMode', 'InfoMode', 'TalkMode',
    'CastSpell', 'RecastSpell', 'AbortSpell', 'UseMagicItem',
    'ReadyWeapon', 'SwingWeapon', 'SwitchHand',
    'Status', 'CharacterSheet', 'Inventory',
    'ActivateCenterObject', 'ActivateCursor',
    'LookUp', 'LookDown', 'CenterView', 'Sneak',
    'LogBook', 'NoteBook', 'AutoMap', 'TravelMap',
    'QuickSave', 'QuickLoad',
    'PrintScreen',
    'AutoRun',
  ]);
  // ActionNameToEnum's sentinel: unknown parses to Unknown, and
  // Unknown itself is NOT a bindable action.
  assert.equal(parseActionName('Rest'), 'Rest');
  assert.equal(parseActionName('FlyToMoon'), 'Unknown');
  assert.ok(!ACTIONS.includes('Unknown'));
});

test('I1: ResetDefaults\' table, every row (:979-1032)', () => {
  // The table IS the pin - reading expected values back out of the
  // module under test is the exact failure AUDIT 21 F12 recorded, so
  // the literals are restated here from the C#.
  assert.deepEqual(DEFAULT_BINDINGS.map(([c, a]) => `${c}=${a}`), [
    'Escape=Escape', 'Backquote=ToggleConsole',
    'KeyW=MoveForwards', 'KeyS=MoveBackwards', 'KeyA=MoveLeft', 'KeyD=MoveRight',
    'ArrowLeft=TurnLeft', 'ArrowRight=TurnRight',
    'PageUp=FloatUp', 'PageDown=FloatDown', 'Space=Jump', 'KeyC=Crouch',
    'ControlLeft=Slide', 'ShiftLeft=Run', 'Mouse2=AutoRun',
    'KeyR=Rest', 'KeyT=Transport',
    'F1=StealMode', 'F2=GrabMode', 'F3=InfoMode', 'F4=TalkMode',
    'Backspace=CastSpell', 'KeyQ=RecastSpell', 'KeyE=AbortSpell', 'KeyU=UseMagicItem',
    'KeyZ=ReadyWeapon', 'Mouse1=SwingWeapon', 'KeyH=SwitchHand',
    'KeyI=Status', 'F5=CharacterSheet', 'F6=Inventory',
    'Mouse0=ActivateCenterObject', 'Enter=ActivateCursor',
    'Insert=LookUp', 'Delete=LookDown', 'Home=CenterView', 'AltLeft=Sneak',
    'KeyL=LogBook', 'KeyN=NoteBook', 'KeyM=AutoMap', 'KeyV=TravelMap',
    'F8=PrintScreen', 'F9=QuickSave', 'F11=QuickLoad',
  ]);
  // every bindable action except the four with no default key
  // (MoveLeft/MoveRight arrive via A/D; TurnLeft/TurnRight via
  // arrows; the four WITHOUT a default are none - check coverage:
  // 44 rows over 44 distinct actions).
  const bound = new Set(DEFAULT_BINDINGS.map(([, a]) => a));
  assert.equal(DEFAULT_BINDINGS.length, 44);
  assert.equal(bound.size, 44, 'no action is defaulted twice');
});

test('I1: SetBinding steals from the other dict, clears the old code, un-removes (:727-758)', () => {
  const s = createBindings();
  setBinding(s, 'KeyR', 'Rest');
  setBinding(s, 'KeyX', 'Rest');
  // binding an action to a new code CLEARS its old one - one code per
  // action per dict.
  assert.equal(s.primary.has('KeyR'), false);
  assert.equal(getBinding(s, 'Rest'), 'KeyX');
  // a code bound in the secondary dict is STOLEN by a primary bind.
  setBinding(s, 'KeyJ', 'Jump', false);
  setBinding(s, 'KeyJ', 'Crouch', true);
  assert.equal(s.secondary.has('KeyJ'), false);
  assert.equal(actionForCode(s, 'KeyJ'), 'Crouch');
  // binding a force-removed action un-removes it (:743-744).
  addRemovedPrimaryAction(s, 'Sneak');
  setBinding(s, 'AltLeft', 'Sneak');
  assert.equal(s.removedPrimary.has('Sneak'), false);
  // code null is KeyCode.None: a pure clear (:739).
  setBinding(s, null, 'Crouch');
  assert.equal(getBinding(s, 'Crouch'), null);
  assert.equal(s.primary.has(null), false, 'None never lands in the dict');
});

test('I1: the two clears - by action walks all its codes, by code takes one (:803-846)', () => {
  const s = createBindings();
  // two codes on one action arrives only via a hand-edited load
  s.primary.set('KeyA', 'Rest');
  s.primary.set('KeyB', 'Rest');
  s.primary.set('KeyC', 'Jump');
  clearBinding(s, 'Rest');
  assert.deepEqual(getBindings(s, 'Rest'), []);
  assert.equal(getBinding(s, 'Jump'), 'KeyC');
  clearBindingByCode(s, 'KeyC');
  assert.equal(getBinding(s, 'Jump'), null);
});

test('I1: a FULL reset clears primary and the removed list but NOT secondary (:956-960)', () => {
  const s = createBindings();
  resetDefaults(s);
  assert.equal(s.primary.size, 44);
  // a secondary binding on a code no default uses SURVIVES the reset;
  // one on a default's code is stolen back by SetBinding's alt-removal.
  setBinding(s, 'KeyP', 'Rest', false);
  setBinding(s, 'KeyM', 'Jump', false);   // KeyM is AutoMap's default
  addRemovedPrimaryAction(s, 'Rest');
  resetDefaults(s);
  assert.equal(s.secondary.get('KeyP'), 'Rest', 'secondary survives a full reset');
  assert.equal(s.secondary.has('KeyM'), false, 'but a default steals its code back');
  assert.equal(s.primary.get('KeyM'), 'AutoMap');
  assert.equal(s.removedPrimary.size, 0, 'the removed list clears');
  assert.equal(getBinding(s, 'Rest'), 'KeyR', 'and the removed action is back on its default');
});

test('I1: autofill binds only a missing action on a free code, never a removed one (:1405-1422)', () => {
  const s = createBindings();
  resetDefaults(s);
  // the player rebound Rest to G and put CastSpell's default code
  // under something else
  setBinding(s, 'KeyG', 'Rest');
  setBinding(s, 'Backspace', 'Inventory');
  clearBinding(s, 'CastSpell');
  addRemovedPrimaryAction(s, 'Sneak');
  clearBinding(s, 'Sneak');
  resetDefaults(s, true);
  assert.equal(getBinding(s, 'Rest'), 'KeyG', 'a bound action is untouched');
  assert.equal(getBinding(s, 'CastSpell'), null,
    'a missing action whose default code is TAKEN stays missing');
  assert.equal(getBinding(s, 'Sneak'), null, 'a force-removed action is not refilled');
  assert.equal(s.primary.get('KeyR'), undefined,
    'and Rest\'s vacated default code is NOT rebound to Rest - autofill keys on the action');
  // but a genuinely new action on a free code fills in
  clearBinding(s, 'NoteBook');
  resetDefaults(s, true);
  assert.equal(getBinding(s, 'NoteBook'), 'KeyN');
  // and "free" means free in BOTH dicts (:1411 checks alt too): a
  // default code parked in the SECONDARY dict blocks the autofill.
  clearBinding(s, 'LogBook');
  setBinding(s, 'KeyL', 'Jump', false);
  resetDefaults(s, true);
  assert.equal(getBinding(s, 'LogBook'), null,
    'a default code held by the secondary dict blocks its autofill');
  assert.equal(s.secondary.get('KeyL'), 'Jump', 'and the secondary binding is not stolen');
});

test('I1: the save shape and the unknown-action round trip (:871-930, :1950-1969)', () => {
  const s = createBindings();
  resetDefaults(s);
  addRemovedPrimaryAction(s, 'Sneak');
  clearBinding(s, 'Sneak');
  const data = serializeKeyBinds(s);
  assert.equal(data.actionKeyBinds.KeyW, 'MoveForwards');
  assert.deepEqual(data.removedPrimaryActions, ['Sneak']);
  assert.deepEqual(data.secondaryActionKeyBinds, {});

  // a NEWER build's file: an action this build does not know, plus a
  // second key hand-bound to Rest.
  const newer = {
    actionKeyBinds: { KeyR: 'Rest', KeyY: 'Rest', KeyB: 'SummonDragon' },
    secondaryActionKeyBinds: { KeyO: 'PetDragon' },
    removedPrimaryActions: ['Sneak', 'AlsoUnknown'],
  };
  const t = createBindings();
  loadKeyBinds(t, newer);
  // both Rest keys load - raw adds, not setBinding (:1960-1961)
  assert.deepEqual(getBindings(t, 'Rest'), ['KeyR', 'KeyY']);
  assert.equal(actionForCode(t, 'KeyY'), 'Rest');
  // the unknown action is HELD, not dropped, and re-serializes
  assert.equal(actionForCode(t, 'KeyB'), null);
  const out = serializeKeyBinds(t);
  assert.equal(out.actionKeyBinds.KeyB, 'SummonDragon');
  assert.equal(out.secondaryActionKeyBinds.KeyO, 'PetDragon');
  // removed list: known name loads, unknown is dropped (:1985-1991)
  assert.deepEqual(out.removedPrimaryActions, ['Sneak']);
  // ...and a rebind over the unknown's key lets this build's meaning
  // win at save (:899-905 "If the key has been rebinded")
  setBinding(t, 'KeyB', 'Jump');
  assert.equal(serializeKeyBinds(t).actionKeyBinds.KeyB, 'Jump');
});

test('I1: a removed-primary mark does NOT load for an action still bound (:1985-1991)', () => {
  const t = createBindings();
  loadKeyBinds(t, {
    actionKeyBinds: { AltLeft: 'Sneak' },
    removedPrimaryActions: ['Sneak'],
  });
  assert.equal(t.removedPrimary.has('Sneak'), false);
});

test('I1: the frame model - started, held, complete (:610-637)', () => {
  const st = createActionState();
  addAction(st, 'Jump');
  assert.equal(actionStarted(st, 'Jump'), true);
  assert.equal(hasAction(st, 'Jump'), true);
  assert.equal(actionComplete(st, 'Jump'), false);
  endFrame(st);
  addAction(st, 'Jump');
  assert.equal(actionStarted(st, 'Jump'), false, 'still held is not started');
  endFrame(st);
  assert.equal(actionComplete(st, 'Jump'), true, 'released this frame');
  assert.equal(hasAction(st, 'Jump'), false);
  endFrame(st);
  assert.equal(actionComplete(st, 'Jump'), false);
});

test('I1: actionForCode answers primary over secondary, then null', () => {
  const s = createBindings();
  setBinding(s, 'KeyK', 'Jump', false);
  assert.equal(actionForCode(s, 'KeyK'), 'Jump');
  // the same code cannot sit in both dicts (setBinding steals it), so
  // precedence is only observable through hand-built state - which a
  // hand-edited FILE can produce: primary wins.
  const t = createBindings();
  t.primary.set('KeyK', 'Rest');
  t.secondary.set('KeyK', 'Jump');
  assert.equal(actionForCode(t, 'KeyK'), 'Rest');
  assert.equal(actionForCode(t, 'KeyQ'), null);
});
