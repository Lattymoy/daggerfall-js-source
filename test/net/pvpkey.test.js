// PVP-KEY (2026-10-30, Discord #suggestions "Allow us to rebind PVP off of capslock", WiKeD, through Mac): "I currently
// use capslock to prompt overworld travel, please let us remap the PVP to a key of our choosing like most things." The
// flag's key is the bindings registry's PvpFlag (systems/inputActions.js), Caps Lock by default, rebound in Controls'
// Online group; scenes/pvpFlagHost.js reads it as every other key is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBindings, resetDefaults, setBinding, getBinding, actionsForCode, ACTIONS, PORT_ACTIONS, ACTION_GROUPS, actionLabel } from '../../src/systems/inputActions.js';
import { createPvpFlagHost, PVP_FLAG_ACTION } from '../../src/scenes/pvpFlagHost.js';

test('PVP-KEY THE ROW: PvpFlag is a port action on Caps Lock by default, drawn in the Online group; a file that spends Caps Lock already keeps it and the flag waits unbound (mutants: the default dropped; a player\'s Caps Lock taken)', () => {
  assert.equal(PVP_FLAG_ACTION, 'PvpFlag');
  assert.ok(ACTIONS.includes('PvpFlag') && PORT_ACTIONS.includes('PvpFlag'));
  assert.ok(ACTION_GROUPS.find((g) => g.title === 'Online').rows.some((r) => r.action === 'PvpFlag'));
  assert.equal(actionLabel('PvpFlag'), 'PvP on / off');
  const fresh = createBindings();
  resetDefaults(fresh);
  assert.deepEqual(actionsForCode(fresh, 'CapsLock'), ['PvpFlag']);
  const wiked = createBindings();
  resetDefaults(wiked);
  setBinding(wiked, 'CapsLock', 'TravelView');   // his own: the Overworld on Caps Lock
  resetDefaults(wiked, true);   // the load's autofill
  assert.deepEqual(actionsForCode(wiked, 'CapsLock'), ['TravelView']);
  assert.equal(getBinding(wiked, 'PvpFlag'), null);
});

/** A host over a fake document; `bound` the codes the registry gives the flag. */
function host(bound, word = 'P') {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    const handlers = new Map(), sent = [], button = { style: {}, setAttribute: () => {}, addEventListener: () => {} };
    const doc = { addEventListener: (k, fn) => handlers.set(k, fn), createElement: () => button, body: null };
    const keyActions = (e) => (bound.includes(e.code) ? [PVP_FLAG_ACTION] : e.code === 'CapsLock' ? ['TravelView'] : []);
    createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: (v) => sent.push(v) }), { level: 30 }, () => {}, { say: () => {} },
      { doc, now: () => 0, zone: () => true, keyActions, keyWord: () => word });
    return { key: handlers.get('keydown'), mouse: handlers.get('mousedown'), sent, button };
  } finally { globalThis.setInterval = realInterval; }
}

test('PVP-KEY THE HOST: the flag answers the key the registry gives it, not Caps Lock read raw; a bound mouse button answers too (mutants: Caps Lock read raw; the registry unread; the mouse unheard)', () => {
  const h = host(['KeyP', 'Mouse3']);
  h.key({ code: 'CapsLock', target: { tagName: 'CANVAS' } });
  assert.deepEqual(h.sent, [], 'Caps Lock is the Overworld\'s now');
  h.key({ code: 'KeyP', target: { tagName: 'CANVAS' } });
  assert.deepEqual(h.sent, [true]);
  h.key({ code: 'KeyP', target: { tagName: 'INPUT' } });
  assert.deepEqual(h.sent, [true], 'typed in a field: nothing');
  h.mouse({ button: 3 });
  assert.deepEqual(h.sent, [true, false], 'the back side button, bound');
  h.mouse({ button: 0 });
  assert.deepEqual(h.sent, [true, false]);
});

test('PVP-KEY THE BUTTON\'S WORDS: its title names the key the flag answers, or says none is bound (mutants: the key unnamed)', () => {
  assert.equal(host(['KeyP'], 'P').button.title, 'PvP off (P)');
  assert.equal(host([], '').button.title, 'PvP off (no key)');
});
