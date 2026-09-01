// A8 - POINTER PARITY: ActivateCenterObject's frame, against
// PlayerActivate.cs:215-280 and EntityEffectManager.cs:230-255, plus
// the source pins for the four hosts that read it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createActivateGate, activateFrame } from '../src/systems/activateGate.js';
import { held, setBindings, mouseCode } from '../src/ui/input.js';
import { createBindings, resetDefaults, actionForCode } from '../src/systems/inputActions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Run a sequence of frames and collect what each one did. */
const run = (frames) => {
  const gate = createActivateGate();
  return frames.map((f) => activateFrame(gate, f));
};

test('A8: with no spell up, the ACTIVATE is the release, not the press', () => {
  // ActionComplete (:634-637) is "was down last frame, is not now" -
  // PlayerActivate reads exactly that (:279), which the port's hosts
  // have never done: they fired on the press edge of a held key.
  const r = run([
    { down: false }, { down: true }, { down: true }, { down: false }, { down: false },
  ]);
  assert.deepEqual(r.map((x) => x.activate), [false, false, false, true, false]);
  assert.deepEqual(r.map((x) => x.cast), [false, false, false, false, false]);
});

test('A8: a readied spell casts on the PRESS and blocks the activation', () => {
  const gate = createActivateGate();
  // press with a spell up: the cast fires (ActionStarted, :250) and
  // PlayerActivate returns without activating (:245-254)
  let f = activateFrame(gate, { down: true, hasReadySpell: true });
  assert.deepEqual(f, { cast: true, activate: false });
  // the cast ANIMATION keeps readySpell alive - held frames neither
  // re-cast (no new start edge) nor activate
  f = activateFrame(gate, { down: true, hasReadySpell: true });
  assert.deepEqual(f, { cast: false, activate: false });
  // the button comes up while the spell is still resolving: no
  // activation, because HasReadySpell is still true
  f = activateFrame(gate, { down: false, hasReadySpell: true });
  assert.deepEqual(f, { cast: false, activate: false });
  // the spell releases; castPending EATS this frame (:260-265) so the
  // cast's own click cannot fall through into a door
  f = activateFrame(gate, { down: false, hasReadySpell: false });
  assert.deepEqual(f, { cast: false, activate: false });
  // and from here the button behaves normally again
  activateFrame(gate, { down: true });
  assert.equal(activateFrame(gate, { down: false }).activate, true);
});

test('A8: a TOUCH spell is the stated exception - doors stay reachable (:255-258)', () => {
  const gate = createActivateGate();
  // pressing with a touch spell up still casts...
  assert.equal(activateFrame(gate, { down: true, hasReadySpell: true, touchSpell: true }).cast, true);
  // ...and the release DOES activate, because the touch arm falls
  // through instead of returning
  const f = activateFrame(gate, { down: false, hasReadySpell: true, touchSpell: true });
  assert.deepEqual(f, { cast: false, activate: true });
});

test('A8: castPending only ever swallows ONE frame', () => {
  const gate = createActivateGate();
  activateFrame(gate, { down: true, hasReadySpell: true });   // sets castPending
  assert.equal(gate.castPending, true);
  activateFrame(gate, { down: true, hasReadySpell: false });  // clears it
  assert.equal(gate.castPending, false);
  // the button is still down; releasing now activates
  assert.equal(activateFrame(gate, { down: false }).activate, true);
});

test('A8: a gate that never sees the button does nothing', () => {
  const r = run([{}, {}, {}]);
  assert.deepEqual(r, [
    { cast: false, activate: false }, { cast: false, activate: false },
    { cast: false, activate: false },
  ]);
});

test('A8: the hosts poll the ACTION, which is Mouse0 at the shipped bindings', () => {
  const b = createBindings();
  resetDefaults(b);
  setBindings(b);
  // InputManager.cs:1017 - and mouseCode already puts the DOM's left
  // button into the held set as 'Mouse0' (AUDIT 39r)
  assert.equal(held(new Set(['Mouse0']), 'ActivateCenterObject'), true);
  assert.equal(held(new Set(['Mouse1']), 'ActivateCenterObject'), false);
  assert.equal(held(new Set(['Mouse1']), 'SwingWeapon'), true);
  assert.equal(held(new Set(['Mouse2']), 'AutoRun'), true);
  // so a REBIND moves the activate button, which is the point of
  // routing it through the registry rather than spelling 'Mouse0'
  assert.equal(held(new Set(['KeyG']), 'ActivateCenterObject'), false);
});

test('A8: every host reads the one gate, and its FLAG is retired', () => {
  const hosts = [
    'src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/worldModes.js', 'src/scenes/dungeon.js',
  ];
  for (const h of hosts) {
    const s = readFileSync(join(root, h), 'utf8');
    assert.match(s, /from '\.\.\/systems\/activateGate\.js'/, `${h} imports the gate`);
    assert.match(s, /activateFrame\(/, `${h} runs a frame of it`);
    assert.match(s, /down: held\(keys, 'ActivateCenterObject'\)/, `${h} polls the ACTION`);
    // the flag that stood on every one of these lines
    assert.ok(!/the pointer-parity slice owns the move/.test(s),
      `${h}'s pointer-parity flag is retired, not orphaned`);
    // and E survives beside it - "Mouse2 + E preserved"
    assert.match(s, /keys\.has\('KeyE'\)/, `${h} keeps the port's own E`);
  }
  // the flag in the input map's header too
  const input = readFileSync(join(root, 'src/ui/input.js'), 'utf8');
  assert.match(input, /A8 RETIRED THE POINTER-PARITY FLAG/);
  assert.ok(!/FLAGGED\s*\n\/\/ at the E sites/.test(input));
  // the dungeon host needs HasReadySpell off its context, which the
  // context now answers
  const ctx = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.match(ctx, /spellArmed: \(\) => magic\.spellArmed\(\),\s+\/\/ A8/);
});

test('ROAD-Ar R10: the swing departure on record is the ROUTING, not the button', () => {
  // The sentence these blocks used to carry - "Mouse2 still swings
  // (DFU's SwingWeapon is Mouse1)" - described a mismatch that does not
  // exist. Every host swings on DOM button 2, MOUSE_CODES calls that
  // 'Mouse1', and 'Mouse1' is SwingWeapon's DFU default
  // (InputManager.cs:1010). The button is parity.
  assert.equal(mouseCode(2), 'Mouse1', 'DOM right -> Unity Mouse1');
  const b = createBindings();
  resetDefaults(b);
  setBindings(b);
  assert.equal(actionForCode(b, mouseCode(2)), 'SwingWeapon',
    'the button the hosts swing on IS the SwingWeapon default');
  assert.equal(held(new Set([mouseCode(2)]), 'SwingWeapon'), true);

  // What DOES depart: the swing is spelled raw at every site and the
  // action has no consumer, so a rebind cannot move it. Pin both halves
  // - the fact, and the comment that now records it.
  const swingers = [
    'src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/worldModes.js', 'src/scenes/dungeon.js',
  ];
  // the comments below SAY held(keys, 'SwingWeapon'), so the "no
  // consumer" half has to be asked of the CODE only
  const codeOnly = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  for (const h of swingers) {
    const s = readFileSync(join(root, h), 'utf8');
    assert.match(s, /e\.button === 2/, `${h} swings on the raw button`);
    assert.ok(!/held\(keys, 'SwingWeapon'\)/.test(codeOnly(s)),
      `${h} does not route the swing through the binding - if it now does, retire this pin`);
    assert.ok(!/Mouse2 st(ill|ays)/.test(s), `${h} no longer records the phantom departure`);
    assert.match(s, /SwingWeapon rebind[\s\S]{0,24}inert/,
      `${h} records the departure that actually stands`);
  }
  // and the two law modules whose headers regenerate into the
  // departures list
  for (const f of ['src/ui/input.js', 'src/systems/activateGate.js']) {
    const s = readFileSync(join(root, f), 'utf8');
    assert.ok(!/Mouse2 st(ill|ays)/.test(s), `${f}'s phantom departure is gone`);
    assert.match(s, /SwingWeapon/, `${f} names the action the swing does not read`);
    assert.match(s, /inert/i, `${f} says what the departure costs`);
  }
});
