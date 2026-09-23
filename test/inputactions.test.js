// I1: the input registry against InputManager.cs. Every pin here is a
// DFU literal or a behaviour DFU's own code exhibits - the reset
// quirk, the load path's raw adds, the unknown-action round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SECONDARY_BINDINGS,
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
    // SOC5 (2026-09-16, Mac: "Players should be able to interact with others
    // in the world upon encountering them by pressing F on their body"): the
    // ONE row past DFU's enum - the port's own, a Ledger A departure (ONLINE),
    // and APPENDED so every existing index keeps its meaning (ui/controlsWindow
    // .js indexes this list by number against fixed art). The pin above is
    // still DFU's list verbatim, in DFU's order, up to here.
    'SocialInteract',
    // QS2 (2026-09-17, Mac's quickslot diamond): three more of the port's own,
    // appended for the same reason and under the same law - DFU's HUD has no
    // item slots, so these are Ledger A rows and every existing index still
    // means what it meant.
    'QuickUse1', 'QuickUse2', 'QuickSwap',
    // QS4: and the off-hand cell's own, appended after them.
    'QuickOffHand',
    // QS6: and the SPELL slot's, appended after that. 'QuickSwap' above keeps
    // its index - an action is never removed from this list, only unbound.
    'QuickSpell',
    // QUICK-LOOT B4: the plaque's two, appended after THAT - same law,
    // third time: an action is never inserted, because the classic grid
    // draws by index.
    'QuickLootAll', 'QuickLootOpen',
    // FREEMOUSE: appended past the plaque's two, like every port row.
    'FreeMouse',
    // LOOT-STACK: the pile's turn, appended past FREEMOUSE's.
    'NextBody',
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
    // SOC5: the port's own row, past DFU's table - KeyF, which SetupDefaults
    // never spends. The forty-four above are still DFU's, row for row.
    'KeyF=SocialInteract',
    // QUICK-LOOT B4: P and J, and they sit HERE because that is where
    // the table declares them - the two rows were chosen by elimination
    // against DFU's table, the port's own two keys and every vendored
    // mod's defaults AND offered choices, which is what HT4's gate
    // holds (it caught G, B and K in turn).
    'KeyP=QuickLootAll',
    'KeyJ=QuickLootOpen',
    'KeyY=FreeMouse',   // FREEMOUSE: the one letter DFU, the port and every vendored mod all leave alone
    'BracketRight=NextBody',   // LOOT-STACK: past the letters, the free key that already means "the next one" here (the automap's storey up)
    // QS2: the number row. Digit1-Digit3 are unspent by SetupDefaults, by the
    // port and by every vendored mod's TextKey defaults (the HT4 pin in
    // test/ht1_handheldtorches.test.js walks that whole set).
    // QS6: the third digit readies the SPELL slot; the swap keeps its row in
    // the enum above and ships UNBOUND, because the cell it is drawn in is
    // the off hand's and Digit4 presses that.
    'Digit1=QuickUse1', 'Digit2=QuickUse2', 'Digit3=QuickSpell', 'Digit4=QuickOffHand',
  ]);
  // every bindable action except the four with no default key
  // (MoveLeft/MoveRight arrive via A/D; TurnLeft/TurnRight via
  // arrows; the four WITHOUT a default are none - check coverage:
  // 44 rows over 44 distinct actions).
  // SOC5 widened both counts by exactly one and QS2 by three: the law grew
  // rows, so the coverage rule (every bindable action defaulted, none twice)
  // grew with it.
  const bound = new Set(DEFAULT_BINDINGS.map(([, a]) => a));
  // QS6 broke the "one default per action" identity, deliberately and once:
  // the swap gave Digit3 to the spell slot and ships UNBOUND, so the table is
  // one row shorter than the enum. It is still one default per action AT MOST,
  // and the one action without one is named rather than counted away.
  // QUICK-LOOT B4 appended two more, each with a default (P and J),
  // so the table and the enum both grow by two and the one unbound
  // action below is still the only one.
  // LOOT-STACK appended one more, with its default (]).
  assert.equal(DEFAULT_BINDINGS.length, 53);
  assert.equal(bound.size, 53, 'no action is defaulted twice');
  assert.equal(ACTIONS.length, 54);
  assert.deepEqual(ACTIONS.filter((a) => !bound.has(a)), ['QuickSwap'], 'exactly one action ships unbound');
  const codes = DEFAULT_BINDINGS.map(([c]) => c);
  assert.equal(new Set(codes).size, codes.length, 'and no KEY is spent twice - the number row was free');
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
  assert.equal(s.primary.size, 53);   // SOC5: DFU's 44 plus SocialInteract; QS2: plus the three quickslot rows; QS4: plus the off hand's; QUICK-LOOT B4: plus the plaque's two; FREEMOUSE: plus the mouse toggle's own key; LOOT-STACK: plus the pile's turn
  // a secondary binding on a code no default uses SURVIVES the reset;
  // one on a default's code is stolen back by SetBinding's alt-removal.
  // QUICK-LOOT B4: this was KeyP, chosen because no default used it -
  // and P is QuickLootAll's default now, so the fixture's own premise
  // had gone. It moved to KeyY, the one letter DFU, the port and every
  // vendored mod all left alone.
  //
  // FREEMOUSE (2026-09-22): AND THE SAME THING HAPPENED AGAIN, which
  // is worth stating rather than quietly re-picking. This fixture
  // needs a code NO default uses, and every time the port spends its
  // last free letter this line is the first thing to notice - it is a
  // canary for the keymap being full, not an ordinary fixture. KeyY is
  // FreeMouse's default now, so it moves to F7: unspent by DFU's table
  // (which stops at F9 and skips F7 and F10), unspent by the port, and
  // not a key any vendored mod offers.
  setBinding(s, 'F7', 'Rest', false);
  setBinding(s, 'KeyM', 'Jump', false);   // KeyM is AutoMap's default
  addRemovedPrimaryAction(s, 'Rest');
  resetDefaults(s);
  assert.equal(s.secondary.get('F7'), 'Rest', 'secondary survives a full reset');
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
  // PAD1: the secondary dict carries the pad layout after a reset - those rows and nothing else
  assert.deepEqual(Object.keys(data.secondaryActionKeyBinds).sort(), DEFAULT_SECONDARY_BINDINGS.map(([c]) => c).sort());
  assert.deepEqual(data.removedSecondaryActions, []);

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

// ── MAC-D1 (SquidKamer on the desktop app, 2026-09-21: "I cant seem to
// swing the weapon in the installed version of the game. I have to
// enable the attack click but I prefer the mouse swing") ─────────────
test('MAC-D1: an action the game cannot be played without is never left addressing nothing, and a PAD row does not count as reachable', async () => {
  const {
    createBindings, resetDefaults, setBinding, repairUnloseableBindings,
    codesForAction, actionIsReachable, isPadCode, UNLOSEABLE_ACTIONS,
  } = await import('../src/systems/inputActions.js');

  // MAC-SWING1 fixed the READ - a swing bound to a key answers now,
  // whatever it is bound to. It did not fix the STATE: an action with
  // no code at all. That is what stranded two reporters, and the
  // desktop app's prefs file carries it across reinstalls.
  assert.ok(UNLOSEABLE_ACTIONS.includes('SwingWeapon'), 'the verb this was reported about');
  for (const a of ['MoveForwards', 'MoveBackwards', 'MoveLeft', 'MoveRight', 'ActivateCenterObject']) {
    assert.ok(UNLOSEABLE_ACTIONS.includes(a), `${a}: there is no way to play without it and no way back except a binding`);
  }

  // A PAD ROW IS NOT A RESCUE. DEFAULT_SECONDARY_BINDINGS refills the
  // pad codes on every load, so a stranded SwingWeapon still answers
  // JoystickAxis10Button0 - and `swingButton` reads the MOUSE codes
  // while the rig's latch reads the held set, neither of which can
  // ever see a pad code on a machine with no pad.
  assert.equal(isPadCode('JoystickAxis10Button0'), true);
  assert.equal(isPadCode('Mouse1'), false); assert.equal(isPadCode('KeyH'), false);

  const s = createBindings(); resetDefaults(s);
  assert.ok(actionIsReachable(s, 'SwingWeapon'), 'a fresh store is sound');
  assert.deepEqual(repairUnloseableBindings(s), [], 'and needs no repair - this only ever fires on a broken store');

  // strand it exactly as the controls window can: the row cleared, and
  // DFU's "keep it unbound" mark set
  for (const [code, a] of [...s.primary]) if (a === 'SwingWeapon') s.primary.delete(code);
  s.removedPrimary.add('SwingWeapon');
  assert.equal(actionIsReachable(s, 'SwingWeapon'), false, 'stranded - nothing on the desk can swing');
  assert.ok(codesForAction(s, 'SwingWeapon').every(isPadCode), '...though a pad row still answers, which is what hid it');

  // the autofill pass CANNOT fix this, by design - it obeys the mark
  resetDefaults(s, true);
  assert.equal(actionIsReachable(s, 'SwingWeapon'), false, 'which is why the repair is its own pass and not a tweak to the autofill');

  assert.deepEqual(repairUnloseableBindings(s), ['SwingWeapon'], 'repaired, and it says which');
  assert.ok(actionIsReachable(s, 'SwingWeapon'));
  assert.ok(codesForAction(s, 'SwingWeapon').includes('Mouse1'), 'back on its default');
  assert.equal(s.removedPrimary.has('SwingWeapon'), false, 'and the mark is lifted, or the next load undoes the repair');

  // A REBIND IS NOT A STRANDING. A player who moves the swing to a key
  // keeps that key - the repair only ever fills an EMPTY action.
  const s2 = createBindings(); resetDefaults(s2);
  setBinding(s2, 'KeyH', 'SwingWeapon', true);
  const before = codesForAction(s2, 'SwingWeapon');
  assert.deepEqual(repairUnloseableBindings(s2), [], 'a swing on H is reachable, so nothing is touched');
  assert.deepEqual(codesForAction(s2, 'SwingWeapon'), before, '...and the player keeps their key');
  assert.ok(before.includes('KeyH'));

  // the door every load comes through carries it
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/systems/inputActions.js', import.meta.url), 'utf8');
  assert.match(src, /if \(repairUnloseableBindings\(store\)\.length\) saveKeyBinds\(store\);/, 'run after the autofill pass, and written back');
});
