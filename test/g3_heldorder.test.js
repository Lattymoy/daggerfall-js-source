// ---------------------------------------------------------------------------
// ROAD-G G3 - THE HELD-FIRST LATCH (ROAD-GR corrected the law it pins).
//
// `systems/inputActions.js` carried A8's remainder for two waves: DFU's
// per-frame `heldKeys` ring (InputManager.cs:1818, ModifierOnlyHeld)
// tracks the ORDER two keys went down in, "so holding K then Shift does
// not fire Shift+K", and "the port's hosts keep a Set with no order".
// BOTH halves were wrong. A JS Set iterates in INSERTION order, so every
// host's `keys` has carried the press order since the first host - and
// DFU's ring does NOT: PollInput zeroes `heldKeyCounter` and refills it
// in KeyCodeList order every frame (:1801-1809), and ModifierOnlyHeld
// scans the WHOLE of it, `for (int i = 0; i < heldKeyCounter; i++)`
// (:1632-1639), with no break at the modifier.
//
// What carries the order is a LATCH, and it is STATE (:1695-1708):
// `modifierHeldFirstDict[mod]` is RAISED only on a frame where the
// modifier is held and that whole-set scan comes back CLEAN
// (:1699-1701), LOWERED only when the modifier is not held at all
// (:1704-1707), and on the "held but dirty" path DFU assigns NOTHING -
// there is no else on :1699. `hit` is that flag AND the combo'd key
// (:1711); the plain key's suppression (:1683-1685) READS the same flag
// off `heldModifier` (:1818-1821).
//
// So the asymmetry has two halves and G3 first shipped only one. A
// disqualifier pressed AFTER the modifier cannot LOWER a raised flag -
// that half G3 had - but it does hold a flag that never rose DOWN, and
// a stateless walk of the Set that stops at the modifier cannot see it.
// The pins below therefore drive FRAMES, in order, because the answer is
// not a function of the Set: the same Set answers both ways depending on
// what came before it.
//
// AND THE GLOSS IS NARROWER THAN IT SOUNDS, which is ROAD-Ar R9's
// lesson arriving at the other clause. ModifierOnlyHeld disqualifies a
// held key `k` only when `primarySecondaryKeybindDict.ContainsKey
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

/** ONE host frame with the ring as it stands. FindKeyboardActions runs
 *  GetUnaryKey over EVERY bound code each frame (:1826-1832 over
 *  existingKeyDict), so every combo modifier takes its raise/lower
 *  whether or not the player asked for that action; in the port that
 *  sweep runs at the head of held()/actionOf, and every host's frame
 *  loop polls held() (moveHeld's four axes) every frame. The latch is
 *  state, so a pin has to drive frames - a bare Set says nothing. */
const frame = (keys) => { held(keys, 'MoveForwards'); };

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

test('G3: the combo fires from a CLEAN frame - "we want to ignore jumping if we were holding shift PRIOR to pressing space"', () => {
  try {
    jumpStore();
    // Shift, THEN space. The flag rose on the frame Shift stood clean
    // (:1699-1701) and the Space that follows cannot lower it - only
    // Shift's release does (:1704-1707) - so the combo hits and the
    // plain key is suppressed.
    const keys = new Set(['ShiftLeft']);
    frame(keys);
    keys.add('Space');
    assert.equal(held(keys, 'Inventory'), true, 'Shift+Space opens the inventory');
    assert.equal(held(keys, 'Jump'), false, 'and Space does NOT also jump (:1683-1685)');
    // Space, THEN shift. Space is PAIRED with Shift (:1636), so no frame
    // since has come back clean and the flag never rose: no combo, and
    // the jump the player asked for.
    const other = new Set(['Space']);
    frame(other);
    other.add('ShiftLeft');
    assert.equal(held(other, 'Inventory'), false,
      'the modifier arrived into a dirty ring - the flag never rose, so hit is false (:1711)');
    assert.equal(held(other, 'Jump'), true,
      'and the suppression asks the SAME flag, so the jump stands');
  } finally { setBindings(null); }
});

test('G3: the latch is lowered by the modifier\'s RELEASE and by nothing else', () => {
  try {
    jumpStore();
    // Hold space, then shift: no combo, because no frame ever found
    // Shift clean. Let space go and press it again - the next frame
    // finds Shift alone in the ring, raises the flag (:1699-1701), and
    // the combo works from there on.
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

test('G3/GR: a disqualifier pressed AFTER the modifier holds a flag that never rose DOWN (:1699 has no else)', () => {
  // THE HALF THE DERIVED LATCH COULD NOT SEE. A walk that stops at the
  // modifier only ever sees keys BEFORE it, so releasing the pre-held
  // disqualifier let the port raise a flag DFU keeps down for as long
  // as the post-held one is still there.
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump', true);
  setBinding(b, 'KeyJ', 'Jump', false);                              // Shift+K PAIRED
  setBinding(b, comboCode('ShiftLeft', 'KeyL'), 'AutoMap', true);
  setBinding(b, 'F1', 'AutoMap', false);                             // Shift+L PAIRED too
  setBindings(b);
  try {
    assert.equal(isPairedCode(b, 'ShiftLeft+KeyK'), true);
    assert.equal(isPairedCode(b, 'ShiftLeft+KeyL'), true);
    const keys = new Set();
    keys.add('KeyK'); frame(keys);          // K down - Shift not held, flag false (:1707)
    keys.add('ShiftLeft'); frame(keys);     // Shift down into a ring holding K: dirty (:1636)
    keys.add('KeyL'); frame(keys);          // L down: dirty on K AND on L
    keys.delete('KeyK');                    // K up - and L is still down
    assert.deepEqual([...keys], ['ShiftLeft', 'KeyL'], 'the ring a stateless walk would call clean');
    assert.equal(held(keys, 'AutoMap'), false,
      'ModifierOnlyHeld still fails on the HELD L (:1632-1639), so the flag never rose - no AutoMap');
    // release the L too and the very next frame is clean: the flag
    // rises, and the same combo then fires.
    keys.delete('KeyL'); frame(keys);
    keys.add('KeyL');
    assert.equal(held(keys, 'AutoMap'), true, 'a clean frame is the only thing that raises it');
  } finally { setBindings(null); }
});

test('G3/GR: both arms take the stored flag - the combo and the plain key it would suppress', () => {
  // The same divergence read through :1683-1685: when the flag is down,
  // the combo does not fire AND the plain key is not suppressed. The
  // derived latch got both wrong at once, in opposite directions.
  const b = createBindings(); resetDefaults(b);
  setBinding(b, 'KeyK', 'Crouch', true);
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump', true);
  setBinding(b, 'KeyJ', 'Jump', false);                              // Shift+K PAIRED
  setBinding(b, comboCode('ControlLeft', 'KeyM'), 'AutoMap', true);  // Ctrl is a second modifier
  setBindings(b);
  try {
    const keys = new Set();
    keys.add('ControlLeft'); frame(keys);   // Ctrl down
    keys.add('ShiftLeft'); frame(keys);     // Shift arrives beside a modifier: dirty (:1637)
    keys.add('KeyK'); frame(keys);          // ...and now beside a paired key too (:1636)
    keys.delete('ControlLeft');             // Ctrl up, K still held
    assert.deepEqual([...keys], ['ShiftLeft', 'KeyK']);
    assert.equal(held(keys, 'Jump'), false,
      'the K beside Shift still fails the scan, so the flag never rose - no Shift+K (:1711)');
    assert.equal(held(keys, 'Crouch'), true,
      'and the suppression reads that same DOWN flag, so the plain K still crouches (:1683)');
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
      'ModifierOnlyHeld ignores a held key that is neither PAIRED with the modifier nor a modifier itself');
    // an unrelated key held alongside is likewise ignored - "'W' for forward"
    assert.equal(held(new Set(['KeyW', 'ShiftLeft', 'KeyK']), 'Jump'), true);
    // ...but make it DOUBLE-bound and :1636 bites - on the held K,
    // wherever it sits in the ring. What decides is whether a frame ever
    // came back clean, NOT which of the two went down first.
    setBinding(b, 'KeyJ', 'Jump', false);
    assert.equal(isPairedCode(b, 'ShiftLeft+KeyK'), true);
    assert.equal(held(new Set(['KeyK', 'ShiftLeft']), 'Jump'), false,
      'K is PAIRED with Shift and is HELD, so the scan fails and the flag never rose');
    assert.equal(held(new Set(['ShiftLeft', 'KeyK']), 'Jump'), false,
      'and the Set ORDER changes nothing - ModifierOnlyHeld scans the whole ring (:1632-1639)');
    const keys = new Set(['ShiftLeft']);
    frame(keys);                                  // the clean frame, which is the whole rule
    keys.add('KeyK');
    assert.equal(held(keys, 'Jump'), true, 'the flag rose while Shift stood alone (:1699-1701)');
  } finally { setBindings(null); }
});

test('G3: ModifierOnlyHeld\'s OTHER clause (:1637) - a modifier in the ring disqualifies; one pressed after a clean frame does not', () => {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump', true);
  setBinding(b, comboCode('ControlLeft', 'KeyM'), 'AutoMap', true);
  setBindings(b);
  try {
    assert.equal(held(new Set(['ControlLeft', 'ShiftLeft', 'KeyK']), 'Jump'), false,
      'Ctrl is in the ring, so every scan fails at :1637 and Shift never latched');
    const keys = new Set(['ShiftLeft']);
    frame(keys);                            // Shift alone: clean, flag up
    keys.add('ControlLeft'); frame(keys);   // a Ctrl pressed afterwards cannot lower it
    keys.add('KeyK');
    assert.equal(held(keys, 'Jump'), true,
      'only the modifier\'s RELEASE lowers a raised flag (:1704-1707)');
    // ...and the asymmetry: release Shift and press it again, and the
    // Ctrl still in the ring keeps the flag from ever coming back.
    keys.delete('ShiftLeft'); frame(keys);
    keys.add('ShiftLeft');
    assert.equal(held(keys, 'Jump'), false,
      'the re-press finds Ctrl beside it - no clean frame, and :1699 has no else to raise it anyway');
  } finally { setBindings(null); }
});

test('G3: heldModifier is the LAST HELD modifier, not every one of them and not the first (:1818-1821)', () => {
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
    const keys = new Set(['ShiftLeft']);
    frame(keys);                            // Shift latches on its clean frame
    keys.add('ControlLeft'); frame(keys);
    keys.add('KeyK');
    assert.equal(held(keys, 'Jump'), true, 'Shift\'s flag is up, so the combo fires');
    assert.equal(held(keys, 'Crouch'), true,
      'heldModifier is the LAST one, Ctrl, and Ctrl+K is not a pair - so K still crouches');
    // ...and the walk only counts modifiers that are DOWN (`if
    // (GetKey(modifier))`, :1818-1820). Ctrl is the later modifier in
    // the enumeration but is not held, so the suppressor is Shift again
    // - whose flag is up, and whose Shift+K IS a pair.
    keys.delete('ControlLeft');
    assert.equal(held(keys, 'Crouch'), false,
      'Ctrl is not down, so heldModifier stays Shift and :1683-1685 suppresses the plain K');
    assert.equal(held(keys, 'Jump'), true,
      'the combo is what fires - DFU opens one action, not two');
  } finally { setBindings(null); }
});

test('G3: the DISPATCH half reads the same latch - actionOf and routeKey, both ways round', () => {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, comboCode('ShiftLeft', 'KeyI'), 'Inventory', true);
  setBinding(b, 'F6', 'Inventory', false);      // paired, so :1636 can bite
  setBindings(b);
  try {
    // Shift down on its own frame, THEN this press of I: the combo answers.
    const shiftFirst = new Set(['ShiftLeft']);
    frame(shiftFirst);
    assert.equal(actionOf({ code: 'KeyI' }, shiftFirst), 'Inventory');
    // I already held (its own keydown ran first), THEN Shift, and the
    // browser repeats I: the combo must NOT answer, and the plain
    // binding is not suppressed either, because the flag is down.
    const keyFirst = new Set(['KeyI']);
    frame(keyFirst);
    keyFirst.add('ShiftLeft');
    assert.equal(actionOf({ code: 'KeyI' }, keyFirst), 'Status',
      'the modifier arrived into a dirty ring - GetUnaryKey does not hit (:1711)');
    // ...and routeKey carries it to the ctx, which is what a player sees.
    const opened = [];
    const ctx = {
      uiOverlayActive: false,
      toggleInventory() { opened.push('inventory'); },
      showStatus() { opened.push('status'); },
      toggleCharSheet() { opened.push('sheet'); },
    };
    const a = new Set(['ShiftLeft']); frame(a);
    routeKey({ code: 'KeyI', key: 'i' }, ctx, null, a);
    const c = new Set(['KeyI']); frame(c); c.add('ShiftLeft');
    routeKey({ code: 'KeyI', key: 'i' }, ctx, null, c);
    assert.deepEqual(opened, ['inventory', 'status'],
      'one history opens the inventory, the other keeps the plain binding');
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
  // ...and the latch itself is still STORED and still swept, so a future
  // edit that goes back to deriving it from the Set fails HERE.
  const inp = readFileSync(join(HERE, '..', 'src', 'ui', 'input.js'), 'utf8');
  assert.match(inp, /function pollModifier\(store, keys, mod\) \{/,
    'the only writer of the latch is gone - GetUnaryKey has no :1695-1708');
  assert.match(inp, /if \(keys\.has\(mod\)\) \{[^{}]*if \(modifierOnlyHeld\(store, keys, mod\)\) dict\.set\(mod, true\);[^\n]*\n {2}\} else \{[^{}]*dict\.set\(mod, false\);/,
    'the raise/lower is no longer :1695-1708 - a dirty scan must assign NOTHING (there is no else on :1699)');
  assert.match(inp, /for \(const k of keys\) \{\n {4}if \(k === mod\) continue;/,
    'the scan stops at the modifier again - ModifierOnlyHeld walks the WHOLE ring (:1632-1639)');
  assert.ok(!/if \(k === mod\) return true;/.test(inp),
    'the derived latch is back: a walk that ends at the modifier cannot see a disqualifier pressed after it');
  assert.match(inp, /pollLatch\(b, keys\);/,
    'held() no longer sweeps the dict - a modifier never polled never gets its clean frame (:1826-1832)');
  assert.match(inp, /function heldModifier\(store, keys\) \{/,
    ':1818-1821 is gone - the plain-key suppression has no modifier to ask');
});
