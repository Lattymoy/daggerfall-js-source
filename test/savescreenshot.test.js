// SS1: SAVE SCREENSHOTS - the capture half.
//
// DFU's law (SaveLoadManager.SaveGame, :1146-1152 + :1225-1227): the
// shot is taken at END OF FRAME - the coroutine yields
// WaitForEndOfFrame TWICE so the save window has popped, then
// ReadPixels the whole screen WITH the HUD on it (the hide-UI attempt
// is commented out in the C#), EncodeToJPG, write Screenshot.jpg
// beside the save. GetSaveScreenshot (:255-268) loads it back and the
// WINDOW sets its own panel texture (:195-201). The port's WebGL
// canvas has preserveDrawingBuffer false, so the save ARMS a request
// and the host frame loop DELIVERS it in the draw's own task, the
// two-frame countdown standing in for the two yields. RECORDED
// departure: DFU stores the full-resolution JPEG on disk; the port
// downscales to 320x200 for the localStorage quota (the panel is
// 168x95 - nothing visible is lost).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  saveSlot, deleteSave, screenshotOf, requestScreenshot,
  capturePendingScreenshot, SCREENSHOT_W, SCREENSHOT_H, SAVE_SHOT_PREFIX,
} from '../src/systems/saveSlots.js';
import { SaveWindow } from '../src/ui/saveWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function mockStorage(entries = {}) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

const snapOf = () => ({ v: 1, name: 'Mac', classicMinutes: 100 });

/** A stub DOM canvas whose JPEG is a marker string; installs and
 *  restores globalThis.document around fn. */
function withDocument(fn, { url = 'data:image/jpeg;base64,TESTSHOT' } = {}) {
  const captured = [];
  const prev = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ drawImage: (...a) => captured.push(a) }),
      toDataURL: () => url,
    }),
  };
  try { return fn(captured); } finally {
    if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
  }
}

test('SS1: the shot lands on the SECOND frame after the save - the two WaitForEndOfFrame yields', () => {
  const s = mockStorage();
  const { key } = saveSlot('Mac', 'Cellar', snapOf(), { storage: s, now: 10 });
  withDocument((captured) => {
    requestScreenshot(key);
    const canvas = { w: 1 };
    assert.equal(capturePendingScreenshot(canvas, s), false, 'frame 1: the save window is still popping');
    assert.equal(screenshotOf(key, s), null);
    assert.equal(capturePendingScreenshot(canvas, s), true, 'frame 2: ReadPixels');
    assert.equal(screenshotOf(key, s), 'data:image/jpeg;base64,TESTSHOT');
    // the downscale is the 320x200 native frame (the recorded departure)
    assert.equal(SCREENSHOT_W, 320);
    assert.equal(SCREENSHOT_H, 200);
    assert.deepEqual(captured[0], [canvas, 0, 0, 320, 200], 'the whole canvas, HUD and all, into the native frame');
    // one save, one shot
    assert.equal(capturePendingScreenshot(canvas, s), false, 'the request is consumed');
  });
});

test('SS1: a slot deleted during the countdown captures nothing (the info-must-exist law)', () => {
  const s = mockStorage();
  const { key } = saveSlot('Mac', 'Doomed', snapOf(), { storage: s, now: 10 });
  withDocument(() => {
    requestScreenshot(key);
    capturePendingScreenshot({}, s);
    deleteSave(key, s);
    assert.equal(capturePendingScreenshot({}, s), false, 'no orphan shot for a gone slot');
    assert.equal(screenshotOf(key, s), null);
  });
});

test('SS1: refusals never throw a frame - bad key, no DOM, a non-image encode', () => {
  const s = mockStorage();
  const { key } = saveSlot('Mac', 'Odd', snapOf(), { storage: s, now: 10 });
  // a bad key arms nothing
  for (const bad of [null, -1, 1.5, 'x']) {
    requestScreenshot(bad);
    assert.equal(capturePendingScreenshot({}, s), false, `key ${bad} armed nothing`);
  }
  // headless (no document at all): both frames answer false, silently
  requestScreenshot(key);
  assert.equal(capturePendingScreenshot({}, s), false);
  assert.doesNotThrow(() => capturePendingScreenshot({}, s));
  assert.equal(screenshotOf(key, s), null, 'no DOM, no shot - the bare panel is the C# null');
  // an encoder that answers a non-image (toDataURL falls back to
  // 'data:,' on a lost context) is refused, not stored
  withDocument(() => {
    requestScreenshot(key);
    capturePendingScreenshot({}, s);
    assert.equal(capturePendingScreenshot({}, s), false);
    assert.equal(screenshotOf(key, s), null);
  }, { url: 'data:,' });
});

test('SS1: an overwrite drops the stale shot and the fresh capture replaces it', () => {
  const s = mockStorage();
  const { key } = saveSlot('Mac', 'Same', snapOf(), { storage: s, now: 10 });
  s.setItem(SAVE_SHOT_PREFIX + key, 'data:image/jpeg;base64,OLD');
  // the SAME (char, name) overwrites the slot; no capture handed in -
  // the stale picture leaves with the old data (the SAV4 law)...
  const again = saveSlot('Mac', 'Same', snapOf(), { storage: s, now: 20 });
  assert.equal(again.key, key, 'the identity keeps the slot');
  assert.equal(screenshotOf(key, s), null, 'an overwrite without a capture drops the stale picture');
  // ...and the armed capture writes the new one two frames later.
  withDocument(() => {
    requestScreenshot(key);
    capturePendingScreenshot({}, s);
    capturePendingScreenshot({}, s);
    assert.equal(screenshotOf(key, s), 'data:image/jpeg;base64,TESTSHOT');
  });
});

test('SS1: the window loads the shot itself - cache by (key, url), released on change, headless answers null', () => {
  const s = mockStorage();
  const prev = globalThis.localStorage;
  globalThis.localStorage = s;
  try {
    const { key } = saveSlot('Mac', 'Look', snapOf(), { storage: s, now: 10 });
    s.setItem(SAVE_SHOT_PREFIX + key, 'data:image/jpeg;base64,SHOT1');
    const released = [];
    const renderer = { releaseTexture: (a, r) => released.push([a, r]) };
    const win = new SaveWindow('load', { playerName: () => 'Mac' });
    // headless: no Image - the texture is null but the slot is CACHED
    assert.equal(win._shotTexture(renderer, key), null);
    assert.equal(win._shot.key, key);
    assert.equal(win._shot.url, 'data:image/jpeg;base64,SHOT1');
    // same key + url: the cache answers without re-decoding
    win._shot.tex = { fake: true };
    assert.deepEqual(win._shotTexture(renderer, key), { fake: true });
    // the URL changed under the same key (an overwrite): released + re-keyed
    s.setItem(SAVE_SHOT_PREFIX + key, 'data:image/jpeg;base64,SHOT2');
    win._shotTexture(renderer, key);
    assert.deepEqual(released, [['saveshot', key]], 'every allocation has an owner');
    assert.equal(win._shot.url, 'data:image/jpeg;base64,SHOT2');
    // no shot stored: the cache drops and the panel stays bare
    win._shot.tex = { fake: 2 };
    assert.equal(win._shotTexture(renderer, 999), null);
    assert.equal(win._shot, null);
    // dispose releases what the window still holds
    win._shot = { key, url: 'u', tex: {} };
    win.dispose();
    assert.equal(win._shot, null);
  } finally {
    if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev;
  }
});

test('SS1: the hosts arm at save and deliver at frame end - THE FOUR HOSTS named', () => {
  // world.js: the composer arms the shot only on a save that landed,
  // and BOTH frame tails (the modal early-return and the main tail)
  // deliver - a save armed from the pause window must not wait for
  // the modal arm to drop.
  const world = read('src/scenes/world.js');
  assert.match(world, /if \(r\.ok\) requestScreenshot\(r\.key\);/,
    'the world composer arms on success');
  assert.equal((world.match(/capturePendingScreenshot\(canvas\);/g) || []).length, 2,
    'both world frame tails deliver');
  // the dungeon pair: the CONTEXT arms (it owns no canvas), the HOST
  // loop delivers - dungeon.js's two tails.
  const dctx = read('src/scenes/dungeonContext.js');
  assert.match(dctx, /if \(r\.ok\) requestScreenshot\(r\.key\);/,
    'the dungeon composer arms on success');
  const dhost = read('src/scenes/dungeon.js');
  assert.equal((dhost.match(/capturePendingScreenshot\(canvas\);/g) || []).length, 2,
    'both dungeon frame tails deliver');
  // exterior.js and interior.js are probe hosts with no composer -
  // they capture nothing.
  for (const probe of ['src/scenes/exterior.js', 'src/scenes/interior.js']) {
    assert.ok(!read(probe).includes('capturePendingScreenshot'), `${probe} saves nothing, captures nothing`);
  }
  // and the window: the hook stays the override seam over the
  // window's own GetSaveScreenshot read.
  assert.match(read('src/ui/saveWindow.js'),
    /this\.hooks\.screenshotTexture\n? *\? this\.hooks\.screenshotTexture\(key, screenshotOf\(key\)\)\n? *: this\._shotTexture\(renderer, key\)/,
    "the hook wins; the window's own loader is the default");
});
