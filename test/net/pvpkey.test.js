// PVP-KEY (2026-10-30, Discord #suggestions "Allow us to rebind PVP off of capslock", WiKeD, through Mac): "I currently
// use capslock to prompt overworld travel, please let us remap the PVP to a key of our choosing like most things." The
// flag's key is the bindings registry's PvpFlag (systems/inputActions.js), Caps Lock by default, rebound in Controls'
// Online group; scenes/pvpFlagHost.js reads it as every other key is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBindings, resetDefaults, setBinding, getBinding, actionsForCode, ACTIONS, PORT_ACTIONS, ACTION_GROUPS, actionLabel, comboCode,
  serializeKeyBinds, loadKeyBinds, migrateKeyBinds } from '../../src/systems/inputActions.js';
import { createPvpFlagHost, PVP_FLAG_ACTION } from '../../src/scenes/pvpFlagHost.js';
import { bindings } from '../../src/ui/input.js';
import { noteCaps, capsFixKey } from '../../src/ui/capsFix.js';

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

/** A host over a fake document; `bound` the codes the registry gives the flag; `up` whether a window is up. */
function host(bound, word = 'P', up = () => false, caps = ['TravelView'], zone = () => true) {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    const handlers = new Map(), sent = [], button = { style: {}, setAttribute: () => {}, addEventListener: () => {} };
    const doc = { addEventListener: (k, fn) => handlers.set(k, fn), createElement: () => button, body: null };
    const keyActions = (e) => (bound.includes(e.code) ? [PVP_FLAG_ACTION] : e.code === 'CapsLock' ? caps : []);
    const f = createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: (v) => sent.push(v) }), { level: 30 }, () => {}, { say: () => {} },
      { doc, now: () => 0, zone, keyActions, keyWord: () => word, windowUp: up });
    return { key: handlers.get('keydown'), mouse: handlers.get('mousedown'), sent, button, f };
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
  const canvas = { tagName: 'CANVAS' };
  h.mouse({ button: 3, target: canvas });
  assert.deepEqual(h.sent, [true, false], 'the back side button, bound');
  h.mouse({ button: 0, target: canvas });
  assert.deepEqual(h.sent, [true, false]);
});

test('AUDIT PVP-KEY B1 + B3: the flag\'s key and button answer the world alone - never under a game window (its text box typed a letter as a flag), never on a window\'s own control, never a mouse press on anything but the world (the PvP button\'s own click toggled twice) (mutants: the window unread; the control unread; the mouse\'s target unread)', () => {
  let up = false;
  const h = host(['KeyV', 'Mouse0'], 'V', () => up);
  const canvas = { tagName: 'CANVAS' };
  up = true;
  h.key({ code: 'KeyV', target: { tagName: 'BODY' } });
  h.mouse({ button: 0, target: canvas });
  assert.deepEqual(h.sent, [], 'a window up: nothing');
  up = false;
  h.key({ code: 'KeyV', target: { tagName: 'BUTTON' } });
  h.key({ code: 'KeyV', target: { tagName: 'DIV', closest: (q) => (q === '[data-dom-focus]' ? {} : null) } });
  assert.deepEqual(h.sent, [], 'a window\'s control, or a DOM window with the focus: nothing');
  h.mouse({ button: 0, target: { tagName: 'BUTTON' } });
  h.mouse({ button: 0, target: { tagName: 'INPUT' } });
  assert.deepEqual(h.sent, [], 'a press on a button or the chat: nothing');
  h.key({ code: 'KeyV', target: { tagName: 'CANVAS' } });
  h.mouse({ button: 0, target: canvas });
  assert.deepEqual(h.sent, [true, false], 'the world: both answer');
});

test('AUDIT PVP-KEY B2: the host reads a key as the registry\'s own listener door does (ui/input.js eventActions) - a combo bound to the flag answers, and its bare key is another action\'s (mutant: actionsOf without a ring, the bare code alone)', () => {
  const store = bindings();
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    setBinding(store, comboCode('ControlLeft', 'KeyK'), PVP_FLAG_ACTION);
    const handlers = new Map(), sent = [], button = { style: {}, setAttribute: () => {}, addEventListener: () => {} };
    const doc = { addEventListener: (k, fn) => handlers.set(k, fn), createElement: () => button, body: null };
    createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: (v) => sent.push(v) }), { level: 30 }, () => {}, { say: () => {} }, { doc, now: () => 0, zone: () => true, keyWord: () => '' });
    handlers.get('keydown')({ code: 'KeyK', target: { tagName: 'CANVAS' } });
    assert.deepEqual(sent, [], 'K alone: the road\'s follow');
    handlers.get('keydown')({ code: 'KeyK', ctrlKey: true, target: { tagName: 'CANVAS' } });
    assert.deepEqual(sent, [true], 'Ctrl+K: the flag');
  } finally { resetDefaults(store); globalThis.setInterval = realInterval; }
});

test('AUDIT PVP-KEY B6: Caps Lock pressed in the game is the game\'s light only where it did something - bound to nothing, the player\'s own capitals are typed (mutant: every game press noted the game\'s)', () => {
  const field = { value: '', selectionStart: 0, selectionEnd: 0, setSelectionRange(a) { this.selectionStart = this.selectionEnd = a; }, dispatchEvent: () => true };
  const typed = () => { field.value = ''; field.selectionStart = field.selectionEnd = 0; if (!capsFixKey({ code: 'KeyH', key: 'H', getModifierState: () => true, preventDefault: () => {} }, field)) field.value = 'H'; return field.value; };
  noteCaps(null);
  host(['KeyV']).key({ code: 'CapsLock', target: { tagName: 'CANVAS' } });   // Caps Lock the Overworld's
  assert.equal(typed(), 'h', 'the Overworld\'s Caps Lock: its light undone in chat');
  host(['KeyV'], 'V', () => false, []).key({ code: 'CapsLock', target: { tagName: 'CANVAS' } });   // Caps Lock bound to nothing
  assert.equal(typed(), 'H', 'the player\'s own capitals');
});

test('AUDIT PVP-KEY B7: a saved file whose Caps Lock is spent is told the flag has no key, once - a file with it free gets Caps Lock (mutant: the v4 report skipped)', () => {
  const v3 = (caps) => { const o = createBindings(); resetDefaults(o); o.primary.delete('CapsLock'); if (caps) o.primary.set('CapsLock', caps); return { ...serializeKeyBinds(o), version: 3 }; };
  const s = createBindings();
  loadKeyBinds(s, v3('TravelView'));
  assert.deepEqual(migrateKeyBinds(s, 3).lost, [{ action: PVP_FLAG_ACTION, code: 'CapsLock', holder: 'TravelView' }]);
  resetDefaults(s, true);
  assert.equal(getBinding(s, PVP_FLAG_ACTION), null);
  const free = createBindings();
  loadKeyBinds(free, v3(null));
  assert.deepEqual(migrateKeyBinds(free, 3).lost, []);
  assert.equal(getBinding(free, PVP_FLAG_ACTION), 'CapsLock');
});


test('PVP-KEY THE BUTTON\'S WORDS: its title names the key the flag answers, up and down, or says none is bound; the shipped host reads the registry\'s key (mutants: the key unnamed; the up title\'s key unnamed; the default word not the registry\'s)', () => {
  const h = host(['KeyP'], 'P');
  assert.equal(h.button.title, 'PvP off (P)');
  h.key({ code: 'KeyP', target: { tagName: 'CANVAS' } });
  assert.equal(h.button.title, 'PvP on (P)');
  assert.equal(host([], '').button.title, 'PvP off (no key)');
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    const button = { style: {}, setAttribute: () => {}, addEventListener: () => {} };
    createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true }), { level: 30 }, () => {}, { say: () => {} }, { doc: { addEventListener: () => {}, createElement: () => button, body: null }, now: () => 0, zone: () => true });
    assert.equal(button.title, 'PvP off (CAPS)', 'the default: Caps Lock, in the Controls pane\'s own name');
  } finally { globalThis.setInterval = realInterval; }
});

test('AUDIT PVP-KEY C7: out of the zone the key and a bound mouse button do nothing - a flag carried out stays up until the zone\'s leave takes it down - and a press in a list box is the box\'s (mutants: the key\'s zone unread; the mouse\'s zone unread)', () => {
  const out = host(['KeyV', 'Mouse0'], 'V', () => false, ['TravelView'], () => false);
  out.f.heard({ k: 'flag', id: 'peer-me', f: 1 });   // carried out of Cyrodiil, up
  out.key({ code: 'KeyV', target: { tagName: 'CANVAS' } });
  out.mouse({ button: 0, target: { tagName: 'CANVAS' } });
  assert.deepEqual(out.sent, []);
  assert.equal(out.f.on(), true);
  const h = host(['KeyV']);
  h.key({ code: 'KeyV', target: { tagName: 'SELECT' } });
  assert.deepEqual(h.sent, []);
});

test('AUDIT PVP-KEY B1: the shipped host reads the town talk\'s pause - the game\'s text box, the pause window and every pausing window - as a window up (mutant: the talk\'s pause unread)', () => {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    const handlers = new Map(), sent = [], talk = { say: () => {}, overlayActive: true }, button = { style: {}, setAttribute: () => {}, addEventListener: () => {} };
    createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: (v) => sent.push(v) }), { level: 30 }, () => {}, talk,
      { doc: { addEventListener: (k, fn) => handlers.set(k, fn), createElement: () => button, body: null }, now: () => 0, zone: () => true, keyActions: () => [PVP_FLAG_ACTION], keyWord: () => 'V' });
    handlers.get('keydown')({ code: 'KeyV', target: { tagName: 'BODY' } });
    assert.deepEqual(sent, [], 'a pausing window up: nothing');
    talk.overlayActive = false;
    handlers.get('keydown')({ code: 'KeyV', target: { tagName: 'BODY' } });
    assert.deepEqual(sent, [true]);
  } finally { globalThis.setInterval = realInterval; }
});
