// KEYS-BLUR (FIELD BUGS 2026-10-29b, "sometimes my bnoat begins to spin"): a page that loses focus never hears the keys
// let go under it, so a key held across an alt-tab stayed held - a helm swung on, and the other rudder key could not
// take it off (MoveRight is asked first). On blur, and when the page is hidden, every held key is let go as its keyup
// would - in every host that keeps a key set. Mutants: tools/mutants/keys_blur.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { letGoOnBlur, keyEdges, noteKeyDown } from '../../src/ui/input.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
function fakeWindow() {
  const on = new Map(), doc = { visibilityState: 'visible', on: new Map() };
  doc.addEventListener = (t, f) => doc.on.set(t, f);
  doc.removeEventListener = (t) => doc.on.delete(t);
  return { document: doc, on, addEventListener: (t, f) => on.set(t, f), removeEventListener: (t) => on.delete(t) };
}

test('KEYS-BLUR a blur lets every held key go, as its keyup would - the edge ring hears the up', () => {
  const win = fakeWindow(), keys = new Set(['KeyD', 'ShiftLeft']), edges = keyEdges();
  noteKeyDown(edges, 'KeyD');
  letGoOnBlur(keys, edges, win);
  win.on.get('blur')();
  assert.deepEqual([...keys], []);
  assert.ok(edges.up.has('KeyD'), 'its up noted');
  assert.ok(!edges.up.has('ShiftLeft'), 'never an up the ring saw no down of');
});

test('KEYS-BLUR the page hidden lets go; shown again, nothing; uninstalled, nothing', () => {
  const win = fakeWindow(), keys = new Set(['KeyA']);
  const off = letGoOnBlur(keys, null, win);
  win.document.on.get('visibilitychange')();
  assert.deepEqual([...keys], ['KeyA'], 'visible: held');
  win.document.visibilityState = 'hidden';
  win.document.on.get('visibilitychange')();
  assert.deepEqual([...keys], []);
  off();
  assert.equal(win.on.size + win.document.on.size, 0);
});

test('KEYS-BLUR every host that keeps a key set lets go on blur (world.js carries worldModes\' and dungeonContext\'s keys)', () => {
  for (const [file, edges] of [['src/scenes/world.js', 'latch.edge'], ['src/scenes/exterior.js', 'latch.edge'], ['src/scenes/dungeon.js', 'keyEdge'], ['src/scenes/interior.js', 'null']]) {
    assert.ok(src(file).includes(`letGoOnBlur(keys, ${edges});`), file);
  }
});
