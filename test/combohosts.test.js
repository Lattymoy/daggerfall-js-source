// AUDIT 58 (f3/input) - THE COMBO ARM'S MISSING ARGUMENT.
//
// InputManager.GetUnaryKey's combo branch (InputManager.cs:1666-1712)
// does two things: a held modifier plus the combo'd key produces the
// COMBO's action, and the plain binding on that key is SUPPRESSED
// while the modifier is down ("'space' is jump, 'LeftShift+Space'
// opens inventory. We want to ignore jumping", :1681-1685).
// GameManager.Update (:509-557) then dispatches those Actions.
//
// The port implements both halves in ui/input.js's actionOf - but ONLY
// inside `if (keys)`, i.e. only when a host hands in its held-keys Set.
// No host did. The polled half worked, because `held()` runs the same
// arm on the Set every frame; the DISPATCHED half - Inventory,
// CharacterSheet, LogBook, NoteBook, AutoMap, TravelMap, Rest,
// CastSpell, Status, Transport, UseMagicItem, QuickSave, QuickLoad,
// Escape - was dead. A player who bound Inventory to Shift+I in the
// controls window (ui/controlsWindow.js:122-128 mints exactly that
// code) got the Status box instead and could never open the inventory
// from the keyboard. A8's pins drove the parameter no host passed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actionOf, routeKey, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults, setBinding, comboCode } from '../src/systems/inputActions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = join(HERE, '..', 'src', 'scenes');
const body = (f) => readFileSync(join(SCENES, f), 'utf8');

function store() {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'KeyI'), 'Inventory', true);   // what controlsWindow.js:190 stages
  setBindings(b);
  return b;
}
function keyCtx() {
  const opened = [];
  return {
    opened,
    uiOverlayActive: false,
    toggleInventory() { opened.push('inventory'); },
    showStatus() { opened.push('status'); },
    toggleCharSheet() { opened.push('sheet'); },
  };
}

test('AUDIT 58 (f3/input): the OUTDOOR ladders’ read - Shift+I opens the inventory, bare I still opens Status', () => {
  store();
  try {
    // world.js / exterior.js run their own ladder off actionOf. The Set
    // holds the modifier and NOT yet this key (keys.add(e.code) runs
    // below the ladder), which is what the arm expects - :102 unions
    // e.code in itself.
    assert.equal(actionOf({ code: 'KeyI' }, new Set(['ShiftLeft'])), 'Inventory',
      'the rebound combo reaches the dispatch');
    assert.equal(actionOf({ code: 'KeyI' }, new Set()), 'Status',
      'and the plain key keeps its own binding when no modifier is down');
    // the dropped argument's answer, kept as the thing that must not
    // come back
    assert.equal(actionOf({ code: 'KeyI' }), 'Status',
      'without a Set actionOf cannot see a combo at all - this is why the hosts must pass one');
  } finally { setBindings(null); }
});

test('AUDIT 58 (f3/input): routeKey carries the Set through to the same arm (the two dungeon hosts + the interior arm)', () => {
  store();
  try {
    const withSet = keyCtx();
    assert.equal(routeKey({ code: 'KeyI', key: 'i' }, withSet, null, new Set(['ShiftLeft'])), true);
    assert.deepEqual(withSet.opened, ['inventory'], 'Shift+I opens the inventory through routeKey');
    const bare = keyCtx();
    assert.equal(routeKey({ code: 'KeyI', key: 'i' }, bare, null, new Set()), true);
    assert.deepEqual(bare.opened, ['status'], 'and bare I is still the Status box');
    // GetUnaryKey's suppression half, :1681-1685: a DOUBLE-bound combo
    // kills the plain key rather than firing it under the modifier.
    const b = createBindings(); resetDefaults(b);
    setBinding(b, comboCode('ShiftLeft', 'KeyI'), 'Inventory', true);
    setBinding(b, comboCode('ShiftLeft', 'KeyI'), 'Inventory', false);
    setBindings(b);
    const paired = keyCtx();
    assert.equal(routeKey({ code: 'KeyI', key: 'i' }, paired, null, new Set(['ShiftLeft'])), true);
    assert.deepEqual(paired.opened, ['inventory']);
  } finally { setBindings(null); }
});

test('AUDIT 58 (f3/input): EVERY host that registers a keydown hands its held-keys Set in', () => {
  // DISCOVERED, not enumerated - the U47 host sweep's shape
  // (test/nativeinventory.test.js). A host joins this law by existing.
  const hosts = readdirSync(SCENES).filter((f) => f.endsWith('.js')
    && /\n {2}addEventListener\('keydown', \(e\) => \{/.test(body(f)));
  assert.deepEqual(hosts.sort(), ['dungeon.js', 'exterior.js', 'interior.js', 'world.js', 'worldModes.js'],
    'the host-level keydowns in the tree');
  // Every actionOf/routeKey call in a host file, with its arguments
  // read by balanced parens (a routeKey arg list carries its own).
  const callsIn = (text) => {
    const out = [];
    for (const m of text.matchAll(/\b(actionOf|routeKey)\(/g)) {
      let i = m.index + m[0].length, depth = 1;
      while (i < text.length && depth > 0) {
        const c = text[i];
        if (c === '(') depth++; else if (c === ')') depth--;
        i++;
      }
      out.push({ fn: m[1], args: text.slice(m.index + m[0].length, i - 1) });
    }
    return out;
  };
  let seen = 0;
  for (const f of hosts) {
    for (const { fn, args } of callsIn(body(f))) {
      if (!/^e\b/.test(args)) continue;   // not a key-event read
      seen++;
      const last = args.slice(args.lastIndexOf(',') + 1).trim();
      assert.equal(last, 'keys',
        `scenes/${f}: ${fn}(${args}) drops the held-keys Set - the combo arm (InputManager.cs:1666-1712) is dead without it`);
    }
  }
  assert.ok(seen >= 5, `the five dispatch reads are all swept (found ${seen})`);
  // ...and the arm they feed is still gated on the Set, so a future
  // host that forgets it fails LOUDLY here rather than quietly there.
  const inp = readFileSync(join(HERE, '..', 'src', 'ui', 'input.js'), 'utf8');
  assert.match(inp, /export function actionOf\(e, keys = null\) \{\n {2}const b = bindings\(\);\n {2}if \(keys\) \{/);
  assert.match(inp, /export function routeKey\(e, ctx, setPlayerPos = null, keys = null\) \{/);
  assert.match(inp, /const act = actionOf\(e, keys\);/, 'routeKey forwards it');
  assert.match(inp, /if \(actionOf\(e, keys\) === 'QuickLoad'\)/, 'including the arm that answers from under a window');
});
