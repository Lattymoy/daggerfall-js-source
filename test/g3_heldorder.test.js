// ---------------------------------------------------------------------------
// ROAD-G G3 - THE ORDERED HELD-KEYS RING.
//
// `systems/inputActions.js` carried A8's remainder for two waves: DFU's
// per-frame `heldKeys` ring (InputManager.cs:1818, ModifierOnlyHeld)
// tracks the ORDER two keys went down in, "so holding K then Shift does
// not fire Shift+K", and "the port's hosts keep a Set with no order".
// The second half was never true - a JS Set iterates in INSERTION order,
// so every host's `keys` has carried the press order since the first
// host - and the first half is DFU's own COMMENT rather than its code.
//
// What the code does is a LATCH. `modifierHeldFirstDict[mod]`
// (:1697-1708) goes TRUE on any frame the modifier is held with nothing
// disqualifying beside it (ModifierOnlyHeld, :1626-1644) and FALSE the
// moment the modifier is not held at all; `hit` is that flag AND the
// combo'd key (:1711); and the plain key's suppression (:1683-1685)
// asks the same flag of `heldModifier` (:1818-1821). ui/input.js reads
// the latch out of the Set rather than storing one, and the two agree
// because DFU's flag is lowered by the modifier's RELEASE and by
// nothing else: a modifier is held-first exactly when no key STILL DOWN
// before it disqualifies it.
//
// AND THE GLOSS IS NARROWER THAN IT SOUNDS, which is ROAD-Ar R9's
// lesson arriving at the other clause. ModifierOnlyHeld disqualifies a
// pre-held key `k` only when `primarySecondaryKeybindDict.ContainsKey
// (GetComboCode(modifier, k))` (:1636) or `k` is itself a modifier
// (:1637) - and that dict is the PRIMARY<->SECONDARY pairing map, so
// the first clause bites only on a DOUBLE-bound combo. A single-bound
// Shift+K fires on either order in DFU, and it must here. The pins
// below are written against the CODE, both ways round.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { held, actionOf, routeKey, setBindings } from '../src/ui/input.js';
import {
  createBindings, resetDefaults, setBinding, comboCode, isPairedCode,
} from '../src/systems/inputActions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = join(HERE, '..', 'src', 'scenes');
const body = (f) => readFileSync(join(SCENES, f), 'utf8');

/** DFU's own example, :1681-1685: "'space' is jump, 'LeftShift+Space'
 *  opens inventory" - and DOUBLE-bound, because that is the only shape
 *  in which primarySecondaryKeybindDict holds the combo code at all. */
function jumpStore() {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'Space'), 'Inventory', true);
  setBinding(b, 'F6', 'Inventory', false);
  setBindings(b);
  assert.equal(isPairedCode(b, 'ShiftLeft+Space'), true, 'the setup must be the DOUBLE-bound one');
  return b;
}

test('G3: the combo fires on ONE order - "we want to ignore jumping if we were holding shift PRIOR to pressing space"', () => {
  try {
    jumpStore();
    // Shift, THEN space. The latch rose while Shift was alone
    // (:1699-1701), so the combo hits and the plain key is suppressed.
    const shiftFirst = new Set(['ShiftLeft', 'Space']);
    assert.equal(held(shiftFirst, 'Inventory'), true, 'Shift+Space opens the inventory');
    assert.equal(held(shiftFirst, 'Jump'), false, 'and Space does NOT also jump (:1683-1685)');
    // Space, THEN shift. Space is PAIRED with Shift (:1636), so the
    // latch never rose: no combo, and the jump the player asked for.
    const spaceFirst = new Set(['Space', 'ShiftLeft']);
    assert.equal(held(spaceFirst, 'Inventory'), false,
      'the modifier arrived second - modifierHeldFirstDict[Shift] is false, so hit is false (:1711)');
    assert.equal(held(spaceFirst, 'Jump'), true,
      'and the suppression asks the SAME flag, so the jump stands');
  } finally { setBindings(null); }
});

test('G3: the latch is lowered by the modifier\'s RELEASE and by nothing else', () => {
  try {
    jumpStore();
    // Hold space, then shift: no combo. Let space go and press it
    // again - DFU\'s next frame finds Shift alone in the ring, raises
    // the flag, and the combo works. The port sees the same thing
    // because the released key has left the Set.
    const keys = new Set(['Space', 'ShiftLeft']);
    assert.equal(held(keys, 'Inventory'), false);
    keys.delete('Space');
    assert.equal(held(keys, 'Inventory'), false, 'the combo\'d key is not down yet');
    keys.add('Space');
    assert.deepEqual([...keys], ['ShiftLeft', 'Space'], 'the re-press appends - that IS the ring');
    assert.equal(held(keys, 'Inventory'), true, 'the flag rose while Shift stood alone');
    assert.equal(held(keys, 'Jump'), false);
    // ...and releasing the MODIFIER lowers it again (:1705-1707)
    keys.delete('ShiftLeft');
    assert.equal(held(keys, 'Inventory'), false);
    assert.equal(held(keys, 'Jump'), true);
  } finally { setBindings(null); }
});

test('G3: a SINGLE-bound combo fires on either order - the code, not the comment (R9\'s lesson at :1636)', () => {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump', true);   // primary only
  setBindings(b);
  try {
    assert.equal(isPairedCode(b, 'ShiftLeft+KeyK'), false, 'single-bound pairs nothing');
    assert.equal(held(new Set(['ShiftLeft', 'KeyK']), 'Jump'), true);
    assert.equal(held(new Set(['KeyK', 'ShiftLeft']), 'Jump'), true,
      'ModifierOnlyHeld ignores a pre-held key that is neither PAIRED with the modifier nor a modifier itself');
    // an unrelated key held first is likewise ignored - "'W' for forward"
    assert.equal(held(new Set(['KeyW', 'ShiftLeft', 'KeyK']), 'Jump'), true);
    // ...but make it DOUBLE-bound and :1636 bites, on that order alone
    setBinding(b, 'KeyJ', 'Jump', false);
    assert.equal(isPairedCode(b, 'ShiftLeft+KeyK'), true);
    assert.equal(held(new Set(['KeyK', 'ShiftLeft']), 'Jump'), false,
      'K went down first and K is PAIRED with Shift - the latch never rose');
    assert.equal(held(new Set(['ShiftLeft', 'KeyK']), 'Jump'), true, 'the other order still fires');
  } finally { setBindings(null); }
});

test('G3: ModifierOnlyHeld\'s OTHER clause (:1637) is ordered too - a modifier held FIRST disqualifies, one held after does not', () => {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump', true);
  setBinding(b, comboCode('ControlLeft', 'KeyM'), 'AutoMap', true);
  setBindings(b);
  try {
    assert.equal(held(new Set(['ControlLeft', 'ShiftLeft', 'KeyK']), 'Jump'), false,
      'Ctrl was already down when Shift arrived, so Shift never latched');
    assert.equal(held(new Set(['ShiftLeft', 'ControlLeft', 'KeyK']), 'Jump'), true,
      'Shift latched alone; a Ctrl pressed afterwards cannot lower a flag only a release lowers');
  } finally { setBindings(null); }
});

test('G3: heldModifier is the LAST held modifier, not every one of them (:1818-1821)', () => {
  // PollInput walks modifierHeldFirstDict and ASSIGNS - `heldModifier =
  // modifier` - so the last held one it meets is the only suppressor
  // GetUnaryKey ever consults. The port swept them all, which suppresses
  // a plain key DFU fires.
  const b = createBindings(); resetDefaults(b);
  setBinding(b, 'KeyK', 'Crouch', true);
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump', true);
  setBinding(b, 'KeyJ', 'Jump', false);                            // Shift+K PAIRED - it would suppress
  setBinding(b, comboCode('ControlLeft', 'KeyM'), 'AutoMap', true); // Ctrl is the LATER modifier in the dict
  setBindings(b);
  try {
    assert.equal(isPairedCode(b, 'ShiftLeft+KeyK'), true);
    assert.equal(isPairedCode(b, 'ControlLeft+KeyK'), false, 'Ctrl pairs nothing with K');
    assert.equal(held(new Set(['ShiftLeft', 'ControlLeft', 'KeyK']), 'Crouch'), true,
      'heldModifier is Ctrl, and Ctrl+K is not a pair - so K still crouches');
  } finally { setBindings(null); }
});

test('G3: the DISPATCH half reads the same order - actionOf and routeKey, both ways round', () => {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'KeyI'), 'Inventory', true);
  setBinding(b, 'F6', 'Inventory', false);      // paired, so :1636 can bite
  setBindings(b);
  try {
    // Shift down first, then this press of I: the combo answers.
    assert.equal(actionOf({ code: 'KeyI' }, new Set(['ShiftLeft'])), 'Inventory');
    // I already held (its own keydown ran first), THEN Shift, and the
    // browser repeats I: the combo must NOT answer, and the plain
    // binding is not suppressed either, because the flag is down.
    assert.equal(actionOf({ code: 'KeyI' }, new Set(['KeyI', 'ShiftLeft'])), 'Status',
      'the modifier arrived second - GetUnaryKey does not hit (:1711)');
    // ...and routeKey carries it to the ctx, which is what a player sees.
    const opened = [];
    const ctx = {
      uiOverlayActive: false,
      toggleInventory() { opened.push('inventory'); },
      showStatus() { opened.push('status'); },
      toggleCharSheet() { opened.push('sheet'); },
    };
    routeKey({ code: 'KeyI', key: 'i' }, ctx, null, new Set(['ShiftLeft']));
    routeKey({ code: 'KeyI', key: 'i' }, ctx, null, new Set(['KeyI', 'ShiftLeft']));
    assert.deepEqual(opened, ['inventory', 'status'],
      'one order opens the inventory, the other keeps the plain binding');
  } finally { setBindings(null); }
});

test('G3: every host that owns a held-keys Set fills the RING before its dispatch ladder', () => {
  // DISCOVERED, not enumerated - the U47/AUDIT 58 host-sweep shape. A
  // host joins this law by declaring a Set.
  //
  // InputManager.PollInput (:1795-1809) adds every held key before
  // GameManager.Update reads a single Action, and the two exterior
  // hosts plus the interior one added theirs at the BOTTOM of the
  // ladder - so every key that DISPATCHED returned above the add and
  // never entered the ring. Harmless while nothing read the order;
  // load-bearing now.
  const hosts = readdirSync(SCENES).filter((f) => f.endsWith('.js')
    && /\n {2}const keys = new Set\(\);\n/.test(body(f)));
  assert.deepEqual(hosts.sort(), ['dungeon.js', 'exterior.js', 'interior.js', 'world.js'],
    'the held-keys Set owners in the tree (worldModes reads the outer host\'s)');

  /** The handler body that fills the ring, by balanced braces. */
  function ringHandler(text) {
    const open = "addEventListener('keydown', (e) => {";
    for (let at = text.indexOf(open); at >= 0; at = text.indexOf(open, at + 1)) {
      let i = at + open.length, depth = 1;
      while (i < text.length && depth > 0) {
        const c = text[i];
        if (c === '{') depth++; else if (c === '}') depth--;
        i++;
      }
      const b = text.slice(at + open.length, i - 1);
      if (b.includes('keys.add(e.code);')) return b;
    }
    return null;
  }
  // The overlay gates, by name: DFU's Update returns BEFORE PollInput
  // while a pausing window is up (:487-503), so a key typed into a
  // window joins no ring there either - the add stays below these.
  const GATES = ['if (townTalk.keydown(e)) return;', 'if (overlay) {'];
  const DISPATCH = ['actionOf(', 'routeKey(', 'toggleAutomap('];
  for (const f of hosts) {
    const h = ringHandler(body(f));
    assert.ok(h, `scenes/${f} has no keydown handler that fills the ring`);
    const add = h.indexOf('keys.add(e.code);');
    for (const d of DISPATCH) {
      const at = h.indexOf(d);
      if (at < 0) continue;
      assert.ok(add < at,
        `scenes/${f}: the ladder reaches ${d} at ${at} before keys.add at ${add} - a key that dispatches never enters the ring, and the ring IS the order (InputManager.cs:1795-1809)`);
    }
    for (const g of GATES) {
      const at = h.indexOf(g);
      if (at < 0) continue;
      assert.ok(at < add,
        `scenes/${f}: the ring is filled above the overlay gate "${g}" - DFU's Update returns before PollInput while a window is up (:487-503)`);
    }
  }
  // ...and the read itself is still the ordered one, so a future edit
  // that swaps the Set for something unordered fails HERE.
  const inp = readFileSync(join(HERE, '..', 'src', 'ui', 'input.js'), 'utf8');
  assert.match(inp, /function modifierHeldFirst\(store, keys, mod\) \{/,
    'the latch read is gone - GetUnaryKey has no order without it');
  assert.match(inp, /for \(const k of keys\) \{\n {4}if \(k === mod\) return true;/,
    'the walk no longer stops AT the modifier, which is the whole order rule');
  assert.match(inp, /function heldModifier\(store, keys\) \{/,
    ':1818-1821 is gone - the plain-key suppression has no modifier to ask');
});
