// KEYS-BLUR (FIELD BUGS 2026-10-29e, "sometimes my bnoat begins to spin"): a page that loses focus never hears the keys
// let go under it, so a key held across an alt-tab stayed held - a helm swung on, and the other rudder key could not
// take it off (MoveRight is asked first). On blur, and when the page is hidden, every held key gets its keyup at the
// document - the host's own keyup and every window's run (AUDIT FB1029e S3) - and the pad lets go of its own, so its next
// tick presses again what is still down (S4). Mutants: tools/mutants/keys_blur.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { letGoOnBlur, keyEdges, noteKeyDown, noteKeyUp, setBindings } from '../../src/ui/input.js';
import { createBindings, resetDefaults } from '../../src/systems/inputActions.js';
import { attachGamepad } from '../../src/ui/gamepadInput.js';
import { _resetForTests } from '../../src/systems/settings/settings.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A page: a window and a document that bubbles to it, as a browser's. */
function page() {
  const win = new EventTarget(), doc = new EventTarget();
  doc.visibilityState = 'visible';
  const own = doc.dispatchEvent.bind(doc);
  doc.dispatchEvent = (e) => { own(e); if (e.bubbles) win.dispatchEvent(e); return true; };
  win.document = doc;
  return { win, doc };
}

test('KEYS-BLUR a blur gives every held key its keyup at the document - the host\'s own listener lets it go, and a window listening hears it; a mouse button is left to its mouseup', () => {
  const { win } = page();
  const keys = new Set(['KeyD', 'ShiftLeft', 'Mouse1']), edges = keyEdges();
  noteKeyDown(edges, 'KeyD');
  const heard = [];
  win.addEventListener('keyup', (e) => { heard.push(e.code); keys.delete(e.code); noteKeyUp(edges, e.code); });   // the host's keyup
  letGoOnBlur(keys, edges, win);
  win.dispatchEvent(new Event('blur'));
  assert.deepEqual(heard.sort(), ['KeyD', 'ShiftLeft'], 'every held key\'s keyup, at the host\'s own listener');
  assert.deepEqual([...keys], ['Mouse1'], 'the mouse button its own mouseup\'s');
  assert.ok(edges.up.has('KeyD'), 'its up noted');
});

test('KEYS-BLUR a key no listener lets go is let go here; the page hidden lets go, shown again nothing; uninstalled, nothing', () => {
  const { win, doc } = page();
  const keys = new Set(['KeyA']);
  const edges = keyEdges();
  noteKeyDown(edges, 'KeyA');
  const off = letGoOnBlur(keys, edges, win);
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual([...keys], ['KeyA'], 'visible: held');
  doc.visibilityState = 'hidden';
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual([...keys], [], 'hidden: let go, no listener needed');
  assert.ok(edges.up.has('KeyA'), 'and its up noted here');
  off();
  keys.add('KeyW');
  win.dispatchEvent(new Event('blur'));
  assert.deepEqual([...keys], ['KeyW']);
});

test('KEYS-BLUR the pad lets go of its own on blur, so a stick still held is pressed again at its next tick', () => {
  const prev = { w: globalThis.window, d: globalThis.document, k: globalThis.KeyboardEvent };
  const events = [];
  const win = new EventTarget();
  win.dispatchEvent = ((own) => (e) => { events.push(e); return own(e); })(EventTarget.prototype.dispatchEvent.bind(win));
  globalThis.KeyboardEvent = class extends Event { constructor(type, init) { super(type, init); this.code = init.code; this.key = init.key; } };
  globalThis.window = win;
  delete globalThis.document;
  const store = createBindings(); resetDefaults(store); setBindings(store);
  const pad = { connected: true, mapping: 'standard', axes: [1, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  try {
    _resetForTests();
    const gp = attachGamepad({}, {}, { getPads: () => [pad] });
    gp.tick(1 / 60);
    const downs = () => events.filter((e) => e.type === 'keydown').map((e) => e.code);
    const right = downs().filter((c) => c === 'KeyD').length;
    assert.ok(right >= 1, `the stick hard right presses D: ${downs()}`);
    win.dispatchEvent(new Event('blur'));
    assert.ok(events.some((e) => e.type === 'keyup' && e.code === 'KeyD'), 'let go on blur');
    gp.tick(1 / 60);
    assert.equal(downs().filter((c) => c === 'KeyD').length, right + 1, 'pressed again: the stick is still held');
    gp.dispose?.();
  } finally {
    globalThis.window = prev.w; if (prev.d !== undefined) globalThis.document = prev.d; globalThis.KeyboardEvent = prev.k;
    _resetForTests();
  }
});

test('KEYS-BLUR every host that keeps a key set lets go on blur (world.js carries worldModes\' and dungeonContext\'s keys)', () => {
  for (const [file, edges] of [['src/scenes/world.js', 'latch.edge'], ['src/scenes/exterior.js', 'latch.edge'], ['src/scenes/dungeon.js', 'keyEdge'], ['src/scenes/interior.js', 'null']]) {
    assert.match(src(file), new RegExp(`\\n  letGoOnBlur\\(keys, ${edges.replace('.', '\\.')}\\);   // KEYS-BLUR`), file);
  }
});
