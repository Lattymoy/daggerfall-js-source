// The input map: registry-backed routing (I2) + the overlay tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  overlayAction, actionOf, held, moveHeld, anyMove, routeKey, setBindings,
} from '../src/ui/input.js';
import { createBindings, resetDefaults, setBinding, DEFAULT_BINDINGS } from '../src/systems/inputActions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every test builds its own store - the module singleton is swapped in
// and restored so no test leaks bindings into another.
const withDefaults = () => {
  const b = createBindings();
  resetDefaults(b);
  setBindings(b);
  return b;
};

test('input: the overlay table is untouched by the registry', () => {
  assert.equal(overlayAction({ key: 'a' }), 'char:a');
  assert.equal(overlayAction({ key: 'Enter' }), 'confirm');
  assert.equal(overlayAction({ key: '=' }), 'plus');
  assert.equal(overlayAction({ key: 'F9' }), null);
});

test('I2: actionOf reads the LIVE bindings, not a table', () => {
  withDefaults();
  assert.equal(actionOf({ code: 'F5' }), 'CharacterSheet');
  assert.equal(actionOf({ code: 'F6' }), 'Inventory');
  assert.equal(actionOf({ code: 'Backspace' }), 'CastSpell');
  assert.equal(actionOf({ code: 'KeyC' }), 'Crouch', 'I2 retired the C-cast: DFU\'s C crouches');
  assert.equal(actionOf({ code: 'KeyX' }), null, 'and X is unbound');
  assert.equal(actionOf({ code: 'KeyV' }), 'TravelMap');
  // a REBIND moves the answer - the whole point of the registry
  const b = withDefaults();
  setBinding(b, 'KeyP', 'Inventory');
  assert.equal(actionOf({ code: 'KeyP' }), 'Inventory');
  assert.equal(actionOf({ code: 'F6' }), null, 'the old code no longer answers');
});

test('I2: held/moveHeld poll the bound codes against the host key set', () => {
  const b = withDefaults();
  const keys = new Set(['KeyW', 'KeyD', 'ShiftLeft']);
  assert.equal(held(keys, 'Run'), true);
  assert.equal(held(keys, 'Sneak'), false);
  const mv = moveHeld(keys);
  assert.deepEqual(mv, { forwards: true, backwards: false, left: false, right: true });
  assert.equal(anyMove(mv), true);
  assert.equal(anyMove(moveHeld(new Set())), false);
  // rebinding Crouch back to X makes X crouch again - a player CAN
  // recreate the port's old layout, it is just no longer the default
  setBinding(b, 'KeyX', 'Crouch');
  assert.equal(held(new Set(['KeyX']), 'Crouch'), true);
  assert.equal(held(new Set(['KeyC']), 'Crouch'), false);
  // and a SECONDARY binding answers held() too (GetKey :1084)
  setBinding(b, 'KeyB', 'Jump', false);
  assert.equal(held(new Set(['KeyB']), 'Jump'), true);
});

test('I2: routeKey - overlay precedence, toggles, unconsumed', () => {
  withDefaults();
  const calls = [];
  const ctx = {
    uiOverlayActive: false,
    overlayInput: (a) => calls.push('ov:' + a),
    toggleCharSheet: () => calls.push('sheet'),
    toggleInventory: () => calls.push('inv'),
    toggleSpellbook: () => calls.push('book'),
  };
  assert.ok(routeKey({ key: 'F6', code: 'F6' }, ctx));
  // the CastSpell ACTION opens the spellbook (GameManager.cs:550-553)
  assert.ok(routeKey({ key: 'Backspace', code: 'Backspace' }, ctx));
  assert.ok(!routeKey({ key: 'x', code: 'KeyX' }, ctx), 'unconsumed falls through');
  ctx.uiOverlayActive = true;
  assert.ok(routeKey({ key: 'Backspace', code: 'Backspace' }, ctx), 'overlay wins: backspace edits, not spellbook');
  assert.ok(!routeKey({ key: 'F9', code: 'F9' }, ctx), 'quicksave stays gated under an overlay');
  assert.deepEqual(calls, ['inv', 'book', 'ov:backspace']);
  // quickLOAD pierces any overlay (the death screen's F11 hint)
  let loaded = 0;
  ctx.quickLoad = () => loaded++;
  assert.ok(routeKey({ key: 'F11', code: 'F11' }, ctx));
  assert.equal(loaded, 1);
});

test('I2: no host reads a bound key raw - the sweep', () => {
  // The rule, enforced rather than remembered (the AUDIT 21 F2
  // shape): a `keys.has('<code>')` whose code the DEFAULT table binds
  // is a read the registry cannot rebind. Two escapes, each visible
  // in the line itself: the dev fly-camera (`fly-cam (dev)`) and the
  // recorded E-activate departure (`I2 departure`). interior.js is
  // the standalone block viewer - a dev surface with no player.
  const bound = new Set(DEFAULT_BINDINGS.map(([code]) => code));
  const hosts = readdirSync(join(root, 'src/scenes'))
    .filter((f) => f.endsWith('.js') && f !== 'interior.js')
    .map((f) => `src/scenes/${f}`);
  const offenders = [];
  for (const rel of hosts) {
    const lines = readFileSync(join(root, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('fly-cam (dev)') || line.includes('I2 departure')) return;
      for (const m of line.matchAll(/keys\.has\('([^']+)'\)/g)) {
        if (bound.has(m[1])) offenders.push(`${rel}:${i + 1} reads ${m[1]} raw`);
      }
    });
  }
  assert.deepEqual(offenders, [],
    `bound keys read raw instead of through held():\n${offenders.join('\n')}`);
});

test('I2: the sweep\'s escapes are themselves bounded', () => {
  // An escape marker that spreads stops being an escape. The E
  // departure is ONE line per gameplay host; fly-cam markers only on
  // fly-branch lines (a handful per exterior-style host).
  const count = (rel, needle) =>
    (readFileSync(join(root, rel), 'utf8').match(new RegExp(needle, 'g')) ?? []).length;
  const FLY = { 'src/scenes/exterior.js': 5, 'src/scenes/world.js': 5,
    'src/scenes/dungeon.js': 5, 'src/scenes/worldModes.js': 0 };
  for (const [rel, fly] of Object.entries(FLY)) {
    assert.equal(count(rel, 'I2 departure'), 1, `${rel} carries exactly one E-departure line`);
    assert.equal(count(rel, 'fly-cam \\(dev\\)'), fly,
      `${rel} fly-cam escapes are counted - a new one is a decision, not a drift`);
  }
});
