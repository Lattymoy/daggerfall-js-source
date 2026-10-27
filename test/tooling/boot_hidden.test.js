// BOOT-HIDDEN and CODE-CACHE (bible/01-Overview/Desktop-App.md): the desktop app's boot keeps running behind another
// window or minimized, and keeps V8's compiled code between launches. The breather's yield is driven by execution with
// its seams injected; the scheme's privilege is pinned by source (it runs in Electron), as the shell's other tests pin
// theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { breathFrame, createBreather, TURNED } from '../../src/systems/buildBreather.js';

test('BOOT-HIDDEN the build breathes a turn while the desktop page is hidden, a frame otherwise - and always a frame in a tab', () => {
  const took = [];
  const seams = (shell, hidden) => ({ shell, doc: { hidden }, raf: () => took.push('frame'), turn: () => took.push('turn') });
  breathFrame(() => {}, seams({}, true));
  breathFrame(() => {}, seams({}, false));
  breathFrame(() => {}, seams(undefined, true));
  assert.deepEqual(took, ['turn', 'frame', 'frame']);
});

test('BOOT-HIDDEN a window hidden while a frame is pending resumes the breath by a turn, once', () => {
  const heard = [];
  let onChange = null;
  const doc = { hidden: false, addEventListener: (_, f) => { onChange = f; }, removeEventListener: () => { onChange = null; } };
  let frame = null;
  breathFrame((by) => heard.push(by), { shell: {}, doc, raf: (f) => { frame = f; }, turn: (f) => f() });
  doc.hidden = true;
  onChange();
  frame(9);   // the dead frame, should it ever come
  assert.deepEqual(heard, [TURNED]);
  assert.equal(onChange, null, 'the listener is gone');
});

test('BOOT-HIDDEN the real turn resumes a breather with no frame ever coming', async () => {
  let t = 0;
  const b = createBreather({ now: () => t, sliceMs: 1, raf: (fn) => breathFrame(fn, { shell: {}, doc: { hidden: true }, raf: () => {} }) });
  t = 5;
  await b.breathe();
  assert.equal(b.yields, 1);
});

test('BOOT-HIDDEN a slice a turn resumed is not lent - the first frame back never reads the hidden build as its script', async () => {
  const lent = [];
  let t = 0;
  let resume = null;
  const b = createBreather({ now: () => t, sliceMs: 1, onSlice: (ms) => lent.push(ms), frames: () => 7, raf: (fn) => { resume = fn; } });
  const breathe = async (by) => {
    t += 5;
    const p = b.breathe();
    resume(by);
    await p;
  };
  await breathe(123);      // a frame's resume (its timestamp): the next slice is vouched for
  await breathe(TURNED);   // that slice is lent; this resume was a turn
  await breathe(123);      // the turn's slice is not lent
  await breathe(123);
  assert.deepEqual(lent, [5, 5], 'the slices after the two frame resumes, never the one after the turn');
});

test('CODE-CACHE the dagger scheme keeps V8 code cache, as an https site does in Chrome', () => {
  assert.match(readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8'),
    /scheme: 'dagger',\n  privileges: \{ standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true \},/);
});
