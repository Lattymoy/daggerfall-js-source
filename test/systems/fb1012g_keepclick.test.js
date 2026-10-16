// FIELD BUGS 2026-10-12g KEEP-CLICK - "Controls resetting": "I bound Ready or sheathe weapon to Right Click and Swing
// weapon to Left Click (with mouse activate unbound), but every time I restart the game, Swing Weapon resets to None
// and Left Click goes to mouse activate" - and Save Controls did not help. The save was sound; the boot's MAC-D1 repair
// found Activate (mouse) on no key and bound its default, Left Click, through SetBinding - which steals - and wrote the
// result back. The repair now fills only a free default. bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadOrCreateBindings, saveKeyBinds, codesForAction, getBinding, createBindings, resetDefaults, setBinding,
  repairUnloseableBindings, actionIsReachable,
} from '../../src/systems/inputActions.js';
import { createUnsavedKeybinds, bindingHolders, stageReplace, setUnsavedBinding, applyUnsavedKeybinds } from '../../src/systems/controlsConfig.js';

function withStorage(fn) {
  const prev = globalThis.localStorage;
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const info = console.info; console.info = () => {};
  try { return fn(mem); } finally {
    console.info = info;
    if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev;
  }
}

// the Controls pane as the player drove it: each bind answered Yes to "give it to ... instead?" (ui/enhanced/enhancedControls.js)
function bindAsThePaneDoes(live, rows) {
  const u = createUnsavedKeybinds(live);
  for (const [action, code] of rows) {
    const holders = bindingHolders(u, action, code);
    if (holders.length) stageReplace(u, action, code, holders); else setUnsavedBinding(u, action, code);
  }
  applyUnsavedKeybinds(live, u);
  saveKeyBinds(live);   // Confirm / Save Controls
}

test('KEEP-CLICK the reporter\'s layout survives three restarts: Swing on Left Click, Ready on Right Click, Activate (mouse) on nothing (mutants: the repair steals again; the free-key test inverted)', () => withStorage((mem) => {
  const live = loadOrCreateBindings();
  bindAsThePaneDoes(live, [['ReadyWeapon', 'Mouse1'], ['SwingWeapon', 'Mouse0']]);
  assert.equal(getBinding(live, 'ActivateCenterObject'), null, 'the pane took Left Click from Activate (mouse)');
  const saved = mem.get('dagger.keybinds');
  for (let boot = 1; boot <= 3; boot++) {
    const s = loadOrCreateBindings();
    assert.equal(s.primary.get('Mouse0'), 'SwingWeapon', `boot ${boot}: Left Click is still the swing`);
    assert.equal(getBinding(s, 'SwingWeapon'), 'Mouse0', `boot ${boot}: the pane reads Left Click, not None`);
    assert.equal(s.primary.get('Mouse1'), 'ReadyWeapon', `boot ${boot}: Right Click is still Ready`);
    assert.equal(getBinding(s, 'ActivateCenterObject'), null, `boot ${boot}: the player unbound it and it stays so`);
  }
  assert.equal(mem.get('dagger.keybinds'), saved, 'and no boot rewrote the file');
}));

test('KEEP-CLICK MAC-D1 still repairs a stranded action whose default is free, and leaves one whose default another action holds (mutants: the repair never runs; the steal back)', () => {
  const s = createBindings(); resetDefaults(s);
  for (const [code, a] of [...s.primary]) if (a === 'SwingWeapon') s.primary.delete(code);
  s.removedPrimary.add('SwingWeapon');
  assert.deepEqual(repairUnloseableBindings(s), ['SwingWeapon'], 'Right Click is free: the swing goes back on it');
  assert.ok(codesForAction(s, 'SwingWeapon').includes('Mouse1'));

  const t = createBindings(); resetDefaults(t);
  setBinding(t, 'Mouse0', 'SwingWeapon', true);   // steals Left Click from Activate (mouse)
  assert.equal(actionIsReachable(t, 'ActivateCenterObject'), false);
  assert.deepEqual(repairUnloseableBindings(t), [], 'its default is the swing\'s now - nothing is taken');
  assert.equal(t.primary.get('Mouse0'), 'SwingWeapon');
  assert.ok(actionIsReachable(t, 'SwingWeapon'));
});
