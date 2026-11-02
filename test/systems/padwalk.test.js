// PADWALK: walk mode and mouselook, one button each, bindable on the controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLUS_BIND_ROWS } from '../../src/ui/plus/plusPadBinds.js';
import { ACTIONS, ACTION_GROUPS } from '../../src/systems/inputActions.js';
import { walkModeOn, setWalkMode, toggleWalkMode, bindWalkMode } from '../../src/player/walkMode.js';

test('PADWALK: the Controller bindings window has Mouselook on/off and Walk mode on/off', () => {
  assert.equal(PLUS_BIND_ROWS.find((r) => r.id === 'mouselook')?.sec, 'FreeMouse');
  assert.equal(PLUS_BIND_ROWS.find((r) => r.id === 'walk')?.sec, 'WalkMode');
  assert.ok(ACTIONS.includes('WalkMode'));
  assert.ok(ACTION_GROUPS.some((g) => g.rows.some((r) => r.action === 'WalkMode')), 'and the keyboard pane draws it');
});

test('PADWALK: one press on, the same press off; a Run press lets it go', () => {
  setWalkMode(false);
  const listeners = [];
  let off = null;   // EM3-3D merge: released at the end, so the next pin can bind its own
  const had = globalThis.addEventListener;
  globalThis.addEventListener = (t, fn) => listeners.push(fn);
  globalThis.removeEventListener = () => {};
  try {
    off = bindWalkMode((e) => (e.code === 'JoystickButton4' ? ['WalkMode'] : e.code === 'ShiftLeft' ? ['Run'] : []));
    const press = (code) => listeners.forEach((fn) => fn({ code }));
    press('JoystickButton4'); assert.equal(walkModeOn(), true);
    press('JoystickButton4'); assert.equal(walkModeOn(), false);
    press('JoystickButton4'); press('ShiftLeft'); assert.equal(walkModeOn(), false, 'running lets it go');
    assert.equal(toggleWalkMode(), true); setWalkMode(false);
  } finally { off?.(); if (had) globalThis.addEventListener = had; else delete globalThis.addEventListener; }
});

test('PADWALK (EM3-3D merge): a press while a window is up, or a held key\'s repeat, leaves walk mode as it was (mutant: the window gate dropped)', () => {
  setWalkMode(false);
  const listeners = [];
  let off = null, up = false;
  const had = globalThis.addEventListener;
  globalThis.addEventListener = (t, fn) => listeners.push(fn);
  globalThis.removeEventListener = () => {};
  try {
    off = bindWalkMode((e) => (e.code === 'JoystickButton4' ? ['WalkMode'] : []), () => up);
    assert.equal(listeners.length, 1, 'bound (the previous pin let go of its binding)');
    const press = (code, extra = {}) => listeners.forEach((fn) => fn({ code, ...extra }));
    up = true; press('JoystickButton4'); assert.equal(walkModeOn(), false, 'a window is up: the press is the window\'s');
    up = false; press('JoystickButton4', { repeat: true }); assert.equal(walkModeOn(), false, 'a key held down does not flicker it');
    press('JoystickButton4'); assert.equal(walkModeOn(), true, 'and a real press with no window toggles it');
    setWalkMode(false);
  } finally { off?.(); if (had) globalThis.addEventListener = had; else delete globalThis.addEventListener; }
});
