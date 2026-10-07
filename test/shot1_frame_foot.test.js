// SHOT1 (2026-10-07, a player's gallery: "Wayrest · 7 Oct 2026" and a Daggerfall shot kept FULLY BLACK, a battle at
// Dak'fron kept whole): THE PRINTSCREEN SHOT IS READ AT THE HOST'S FRAME FOOT.
//
// The renderer's context does not preserve its drawing buffer, so the canvas is readable only in the task that drew
// it. KB1 rode the read on a requestAnimationFrame of its own and trusted it to run after the host's draw. It did not
// when the host HELD the frame (FPS-CAP1's frameCapSkip re-arms and draws nothing - a light town under a Frame Rate
// Cap holds every other browser frame; a heavy battle under the cap holds none, which is why it came out whole), nor
// when the press came from INSIDE the host's frame (the pad's tick dispatches its button as a synthetic keydown, so
// the shot's callback was queued before the host's own re-arm and ran first next frame, ahead of the draw).
//
// Pinned two ways: the model (a canvas whose buffer is whole only between a draw and the task's end, a host frame
// that can be held) and the source sweep (every host's drawn foot pays the owed shots, the held frame never does,
// and the shot rides no frame callback of its own).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takeScreenshot, deliverOwedShots, owedShots, oweToFrameFoot } from '../src/ui/screenshot.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A WebGL canvas with preserveDrawingBuffer false, as far as a read can tell: the buffer holds the frame between the
 *  host's draw and the end of its task (`present` - the compositor takes it and clears it), and is black otherwise. */
function glCanvas() {
  const c = {
    buffer: 'black',
    reads: [],
    draw(what) { c.buffer = what; },
    present() { c.buffer = 'black'; },
    toBlob(cb) { c.reads.push(c.buffer); cb({ frame: c.buffer }); },
  };
  return c;
}
const doc = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
globalThis.URL.createObjectURL ??= () => 'blob:x';

/** One browser frame of a host: held (the cap) draws nothing and reaches no foot; drawn draws, then its foot. */
function hostFrame(canvas, { held = false, what = 'Wayrest', inside = null } = {}) {
  if (!held) {
    inside?.();   // a press dispatched from inside the frame (the pad's tick sits above the draw)
    canvas.draw(what);
    deliverOwedShots();   // the foot: after renderer.resolveFrame()
  }
  canvas.present();
}

test('SHOT1: a shot owed to the frame foot reads the frame the host drew - never the cleared buffer of a frame the cap held (mutant: the read at the press; the read on a frame callback of its own)', async () => {
  deliverOwedShots();
  const c = glCanvas();
  const p = takeScreenshot(c, { doc, later() {}, download: false });
  assert.deepEqual(c.reads, [], 'nothing is read at the press - the buffer is the last frame\'s leftovers, cleared');
  assert.equal(owedShots(), 1, 'owed to a drawn frame');
  hostFrame(c, { held: true });   // FPS-CAP1: the frame the shot used to ride - nothing drawn
  hostFrame(c, { held: true });
  assert.deepEqual(c.reads, [], 'a held frame reaches no foot, so the shot waits');
  hostFrame(c, { what: 'Wayrest' });
  assert.deepEqual(c.reads, ['Wayrest'], 'read once, from the frame just drawn');
  assert.equal(owedShots(), 0);
  assert.equal(await p, null, 'the download switched off: no file, but the read happened');
  hostFrame(c, { what: 'Daggerfall' });
  assert.deepEqual(c.reads, ['Wayrest'], 'one press, one read');
});

test('SHOT1: a press from inside the host\'s frame (the pad\'s synthetic keydown) is read at THAT frame\'s foot, after its draw; two presses are two shots; a shot owed during a delivery is the next frame\'s (mutants: the batch not emptied first; one shot per foot)', () => {
  deliverOwedShots();
  const c = glCanvas();
  hostFrame(c, { what: 'Dak\'fron', inside: () => takeScreenshot(c, { doc, later() {}, download: false }) });
  assert.deepEqual(c.reads, ['Dak\'fron'], 'the pad\'s press, read after the draw it was dispatched above');
  takeScreenshot(c, { doc, later() {}, download: false });
  takeScreenshot(c, { doc, later() {}, download: false });
  hostFrame(c, { what: 'Wayrest' });
  assert.deepEqual(c.reads, ['Dak\'fron', 'Wayrest', 'Wayrest'], 'ASYNC NEVER DROPS: both presses are kept');
  // a shot owed from inside the delivery itself (a keep that presses again) waits for the next drawn frame
  oweToFrameFoot(() => { c.toBlob(() => {}); oweToFrameFoot(() => c.toBlob(() => {})); });
  hostFrame(c, { what: 'Daggerfall' });
  assert.deepEqual(c.reads.slice(3), ['Daggerfall']);
  assert.equal(owedShots(), 1, 'owed to the next frame, never run inside this delivery');
  hostFrame(c, { what: 'Sentinel' });
  assert.deepEqual(c.reads.slice(3), ['Daggerfall', 'Sentinel']);
  // a read that throws (a lost context) is that shot's alone
  oweToFrameFoot(() => { throw new Error('context lost'); });
  takeScreenshot(c, { doc, later() {}, download: false });
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(deliverOwedShots(), 2); } finally { console.warn = warn; }
  assert.equal(c.reads.at(-1), 'black', 'the second shot still read (no draw in this bare delivery)');
});

test('SHOT1 the hosts: every drawn frame foot pays the owed shots right after its resolve, the cap\'s held frame never does, and the shot rides no frame callback of its own (mutants: a foot without the call; the call above the resolve; the rAF ride back)', () => {
  const shot = read('src/ui/screenshot.js');
  assert.doesNotMatch(shot.replace(/^\s*\/\/[^\n]*$/gm, '').replace(/\/\*\*[\s\S]*?\*\//g, ''), /requestAnimationFrame|\braf\(/, 'the read is the host foot\'s - no frame callback of its own');
  assert.match(shot, /afterDraw = oweToFrameFoot,/, 'the foot is the default');
  assert.match(shot, /const batch = _owed\.splice\(0\);/, 'the slot emptied before the occupants are told');
  // THE FOUR HOSTS RULE: world.js and exterior.js own their frame feet; worldModes.js and dungeonContext.js draw
  // inside world.js's (the modal foot) and dungeon.js's, which route their keys through routeKey; interior.js is the
  // ?interior dev host's foot.
  const feet = { 'src/scenes/world.js': 2, 'src/scenes/exterior.js': 2, 'src/scenes/dungeon.js': 2, 'src/scenes/interior.js': 1 };
  for (const [f, n] of Object.entries(feet)) {
    const s = read(f);
    assert.match(s, /^import \{[^}]*\bdeliverOwedShots\b[^}]*\} from '\.\.\/ui\/screenshot\.js';/m, `${f}: takes the door`);
    const resolves = [...s.matchAll(/renderer\.resolveFrame\(\);/g)].map((m) => m.index);
    assert.equal(resolves.length, n, `${f}: ${n} frame feet`);
    assert.equal((s.match(/^\s+deliverOwedShots\(\);/gm) ?? []).length, n, `${f}: one delivery per foot`);
    for (const i of resolves) {
      const foot = s.slice(i, s.indexOf('requestAnimationFrame(frame);', i));
      // the resolve, then (past its notes) at most SS1's save shot, then the delivery - nothing that draws between
      assert.match(foot, /^renderer\.resolveFrame\(\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*(?:\s+capturePendingScreenshot\(canvas\);[^\n]*\n)?\s+deliverOwedShots\(\);/, `${f}: the delivery is the resolve's next act`);
    }
    const capLine = s.split('\n').find((l) => l.includes('if (frameCapSkip(now))'));
    assert.ok(capLine && !capLine.includes('deliverOwedShots'), `${f}: the held frame draws nothing and pays nothing`);
  }
  // the two modal hosts carry no foot of their own: their key ladders are routeKey's, their frames their host's
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(read(f), /renderer\.resolveFrame\(\);/, `${f}: draws inside its host's frame, whose foot pays`);
  }
});
