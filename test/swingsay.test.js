// SWING-SAY (2026-09-22, Mac: "its not working on the install but works
// on the browser. Each time I bring this up you avoid it").
//
// THREE REPORTS, TWO SHIPPED FIXES, AND THE REPORTS CONTINUE.
// MAC-SWING1 found a swing bound to a key that nothing read; MAC-D1
// found an action bound to nothing at all and repaired it on load. Both
// are in every desktop release from app-v0.1.3638 on. The chain reads
// sound end to end from the source, and the gesture fires in a test at
// ~10 pixels of travel - so whatever is left is STATE, not code.
//
// AND THE STATE IS THE ONE ASYMMETRY THERE IS. The browser keeps its
// store in localStorage; the desktop app keeps its own FILE, which
// survives updates and reinstalls (fileStorage.cjs). One player, one
// machine, two stores - and the app's is the older one. That is exactly
// the shape of "works in the browser, not in the install", and it is
// not something the repo can read.
//
// So the port SAYS it. This file drives the readout over states a
// player can actually be in, because a diagnostic that lies is worse
// than none - it would send the next round of this chasing the wrong
// thing again.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBindings, resetDefaults, setBinding, DEFAULT_BINDINGS } from '../src/systems/inputActions.js';
import { setBindings, swingChainState, swingButton, saySwingChain, _resetSwingSay } from '../src/ui/input.js';
import { setValue, getInt } from '../src/systems/settings.js';

const fresh = () => { const s = createBindings(); resetDefaults(s); setBindings(s); return s; };
const clearSwing = (s) => { for (const d of [s.primary, s.secondary]) for (const [c, a] of [...d]) if (a === 'SwingWeapon') d.delete(c); };

test('SWING-SAY: a sound default store reads sound, and names the travel a drag needs', () => {
  fresh();
  setValue('Controls', 'WeaponSwingMode', '0');
  const s = swingChainState({ width: 1920, height: 1080 });
  assert.ok(s.codes.includes('Mouse1'), 'the default mouse row');
  assert.equal(s.button, 2, 'DOM button 2 - the right button, which is DFU\'s Mouse1');
  assert.equal(s.reachable, true);
  assert.equal(s.modeName, 'Vanilla');
  // The number that would make a threshold fault obvious, and it is
  // small: ~10px. A player told "ten pixels" knows the gesture is not
  // the hard part.
  assert.equal(s.travelPx, Math.round(s.threshold * 1920));
  assert.ok(s.travelPx > 0 && s.travelPx < 40, `a swing needs ${s.travelPx}px of drag`);
});

test('SWING-SAY: MAC-SWING1\'s state - the swing moved to a KEY - reads as no button', () => {
  // The drag needs a mouse button to hold. With the action on a key
  // there is none, and `swingKeyHeld` is what carries it instead - so
  // the readout must say `button=-1` rather than look healthy because
  // something is bound somewhere.
  const s = fresh();
  clearSwing(s);
  setBinding(s, 'KeyG', 'SwingWeapon', true);
  const r = swingChainState({ width: 1920, height: 1080 });
  assert.deepEqual(r.codes, ['KeyG']);
  assert.equal(r.button, -1, 'no mouse code, so the drag has no button to hold');
  assert.equal(r.reachable, true, '...but the action IS reachable - which is why MAC-D1\'s repair leaves it alone');
});

test('SWING-SAY: MAC-D1\'s state - a PAD row only - reads as unreachable', () => {
  // DEFAULT_SECONDARY_BINDINGS fills pad codes on every load, so an
  // unbound SwingWeapon still answers a Joystick code and would LOOK
  // bound while nothing on the desk can swing. The readout separates
  // "bound" from "reachable" for exactly that reason.
  const s = fresh();
  clearSwing(s);
  setBinding(s, 'JoystickAxis10Button0', 'SwingWeapon', false);
  const r = swingChainState({ width: 1920, height: 1080 });
  // The codes are read from BOTH dicts - a readout that only looked at
  // the primary would show an EMPTY list here and call it unreachable
  // for the wrong reason, which is a diagnostic that happens to be
  // right. The pad row has to be visible for the line to explain
  // itself to whoever reads it.
  assert.deepEqual(r.codes, ['JoystickAxis10Button0'], 'the secondary dict is read too');
  assert.equal(r.reachable, false, 'a pad row is not a swing on a machine with no pad');
  assert.equal(r.button, -1);
});

test('SWING-SAY: the CLICK workaround reads as Click - the state both earlier reporters left themselves in', () => {
  // MAC-D1's own note records that both reporters moved to Click mode
  // to get an attack at all. That setting lives in the app's file and
  // has survived every update since; in Click mode a held drag fires
  // once on the press and never again, which is exactly "the swiping
  // does not work" with attacks still happening.
  fresh();
  setValue('Controls', 'WeaponSwingMode', '1');
  const r = swingChainState({ width: 1920, height: 1080 });
  assert.equal(r.mode, 1);
  assert.equal(r.modeName, 'Click');
  // ...and the binding is untouched, so a readout that only looked at
  // bindings would call this healthy.
  assert.equal(r.button, 2);
  assert.equal(r.reachable, true);
  setValue('Controls', 'WeaponSwingMode', '0');
  assert.equal(getInt('Controls', 'WeaponSwingMode', 0, 2), 0);
});

test('SWING-SAY: the readout changes nothing - it is a readout', () => {
  const s = fresh();
  const before = JSON.stringify([[...s.primary], [...s.secondary], [...s.removedPrimary]]);
  swingChainState({ width: 1920, height: 1080 });
  swingChainState({ width: 800, height: 600 });
  assert.equal(JSON.stringify([[...s.primary], [...s.secondary], [...s.removedPrimary]]), before,
    'a diagnostic that repairs is a fix aimed at a machine nobody can see');
  assert.equal(swingButton(), 2, 'and it did not disturb the live read either');
  // The default row is still the registry's, untouched by any of this.
  assert.deepEqual(DEFAULT_BINDINGS.find(([, a]) => a === 'SwingWeapon'), ['Mouse1', 'SwingWeapon']);
});

test('SWING-SAY: the line WARNS when the drag cannot work, logs when it can, and is said once', () => {
  // The whole point of the readout is that a player reading a console
  // for the first time can tell the broken state from the sound one
  // without knowing what any of the fields mean. A line that is always
  // a log says nothing.
  const cap = () => {
    const out = [];
    const warn = console.warn, log = console.log;
    console.warn = (m) => out.push(['warn', m]);
    console.log = (m) => out.push(['log', m]);
    try { _resetSwingSay(); saySwingChain(); saySwingChain(); } finally { console.warn = warn; console.log = log; }
    return out;
  };

  fresh();
  setValue('Controls', 'WeaponSwingMode', '0');
  let out = cap();
  assert.equal(out.length, 1, 'said once, however many times it is asked');
  assert.equal(out[0][0], 'log', 'a sound chain is a log');
  assert.match(out[0][1], /SwingWeapon=Mouse1/);

  // Click mode: sound bindings, dead drag.
  setValue('Controls', 'WeaponSwingMode', '1');
  out = cap();
  assert.equal(out[0][0], 'warn', 'a mode that tracks no drag is a warning');
  assert.match(out[0][1], /only Vanilla tracks a drag/);
  setValue('Controls', 'WeaponSwingMode', '0');

  // No mouse button: the drag has nothing to hold.
  const s2 = fresh();
  clearSwing(s2);
  setBinding(s2, 'KeyG', 'SwingWeapon', true);
  out = cap();
  assert.equal(out[0][0], 'warn');
  assert.match(out[0][1], /no mouse button holds the swing/);
});
