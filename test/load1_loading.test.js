// LOAD1 (2026-10-05, Mac: "add loading screens where needed for the game in an enhanced UI type fashion, maybe make it
// where people can also use screenshots for the loading screen and a way to access them in the menu").
//
// Three pieces, each held here against the shape that ships:
//   THE GALLERY (systems/shotGallery.js) - the PrintScreen key's shots kept in this browser, the turn the loading
//     screens draw from, a full gallery that refuses rather than drops;
//   THE LOADING SCREEN (ui/loadingScreen.js) - holds, not a switch: the delay a short load never passes, the stand a
//     shown screen keeps, the ceiling that never traps, the frame's one question, the boot's steps;
//   THE DOORS - the key hands its PNG to the gallery, the world host's boot and frame raise the screen, and the menu's
//     Screenshots pane is on every rail and both dispatch tables.
import './chargenDom.mjs';   // the minimal DOM - for its globals
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fitWithin, pickLoadingShot, sortShots, shotCaption, keepShot, listShots, deleteShot, setShotLoading, shotCount,
  loadingShot, setGalleryBackend, setShotEncoder, memoryGalleryBackend, galleryBackendOver, onGalleryChange, GALLERY_MAX, FULL_EDGE, THUMB_W,
} from '../src/systems/shotGallery.js';
import { takeScreenshot, keptLine, printScreen, setScreenshotCanvas, setShotPlace, SHOT_DOWNLOAD_PREF } from '../src/ui/screenshot.js';
import {
  beginLoading, syncLoading, withLoading, loadingShown, loadingHeld, removeLoadingScreen, setLoadingPlace, setLoadingLine,
  bootLine, loadingMode, tipAt, LOADING_TIPS, LOADING_ID, APPEAR_MS, MIN_SHOWN_MS, LOADING_FADE_MS, HOLD_MAX_MS, LOADING_Z,
  setLoadingAside, loadingAside, loadingPlaceOf, loadingGroundDraws, LOADING_CSS, _resetLoadingAsideForTests,
} from '../src/ui/loadingScreen.js';
import { drawShotsPane, releaseShotsPane, shotKeyName, addPictures, loadingWordsKey, LOADING_WORDS } from '../src/ui/shotsPane.js';
import { setPref, getPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { FEATURES, checkFeature } from '../src/systems/features.js';
import { SYSTEM_PANES } from '../src/ui/enhancedMenu.js';
import { holdFrame, claimFrame } from '../src/scenes/shared.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const enc = async () => ({ blob: new Blob(['full']), thumb: new Blob(['thumb']), w: 1920, h: 1080 });
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const screen = () => document.body.children.find((c) => c.id === LOADING_ID) ?? null;
const textOf = (root, cls) => root?.querySelector(`.${cls}`)?.textContent ?? null;
/** A working classList on one fake node (chargenDom's toggle and remove are no-ops) - the set it reads and writes. */
function liveClasses(n) {
  const cls = new Set(String(n.className ?? '').split(/\s+/).filter(Boolean));
  Object.defineProperty(n, 'classList', { configurable: true, value: {
    add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
    toggle: (c, on = !cls.has(c)) => { if (on) cls.add(c); else cls.delete(c); return on; },
  } });
  return cls;
}
/** A minimal IndexedDB: one database, in-line keys with a key generator, requests answered on the next turn. */
function fakeIdb({ failOpen = false } = {}) {
  const stores = new Map();
  const later = (fn) => setImmediate(fn);
  const db = {
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore(name, opts) { stores.set(name, { opts, rows: new Map(), next: 1 }); },
    close() {},
    transaction(name, mode) {
      const st = stores.get(name);
      const tx = { error: null };
      const ask = (fn) => {
        const r = { result: undefined };
        try { r.result = fn(); } catch (e) { later(() => tx.onerror?.({ target: { error: e } })); return r; }
        later(() => tx.oncomplete?.());
        return r;
      };
      tx.objectStore = () => ({
        put(v) {
          return ask(() => {
            if (mode !== 'readwrite') throw new Error('a readonly transaction');
            let id = v[st.opts.keyPath];
            if (id == null) id = st.next++; else if (id >= st.next) st.next = id + 1;
            st.rows.set(id, { ...v, [st.opts.keyPath]: id });
            return id;
          });
        },
        get: (k) => ask(() => st.rows.get(k)),
        getAll: () => ask(() => [...st.rows.values()]),
        delete: (k) => ask(() => { st.rows.delete(k); }),
        count: () => ask(() => st.rows.size),
      });
      return tx;
    },
  };
  return {
    stores,
    idb: { open() {
      const r = {};
      later(() => {
        if (failOpen) { r.error = new Error('storage denied'); r.onerror?.(); return; }
        r.result = db;
        if (!stores.size) r.onupgradeneeded?.();
        r.onsuccess?.();
      });
      return r;
    } },
  };
}

test('LOAD1 gallery: the kept copy fits FULL_EDGE and the thumb THUMB_W, never up; the turn is a uniform pick of the shots still in it (mutants: upscaled; a shot taken out still drawn; the last shot never picked)', () => {
  assert.deepEqual(fitWithin(3840, 2160, FULL_EDGE), { w: 1920, h: 1080 });
  assert.deepEqual(fitWithin(1080, 2340, FULL_EDGE), { w: 886, h: 1920 }, 'a phone held upright: the long edge is the height');
  assert.deepEqual(fitWithin(1280, 720, FULL_EDGE), { w: 1280, h: 720 }, 'never scaled up');
  assert.deepEqual(fitWithin(1280, 720, THUMB_W), { w: 320, h: 180 });
  assert.deepEqual(fitWithin(0, 0, THUMB_W), { w: 1, h: 1 }, 'a lost canvas still gives a whole pixel');
  const list = [{ id: 1, loading: true }, { id: 2, loading: false }, { id: 3 }];
  assert.equal(pickLoadingShot(list, () => 0).id, 1);
  assert.equal(pickLoadingShot(list, () => 0.999).id, 3, 'the last in the turn is reachable, and the shot taken out is skipped');
  assert.equal(pickLoadingShot(list, () => 0.5).id, 3);
  assert.equal(pickLoadingShot([{ id: 2, loading: false }]), null, 'nothing in the turn: the night sky');
  assert.equal(pickLoadingShot([]), null);
  assert.deepEqual(sortShots([{ id: 1, at: 5 }, { id: 2, at: 9 }, { id: 3, at: 9 }]).map((s) => s.id), [3, 2, 1], 'newest first, the later id first on a tie');
  assert.equal(shotCaption({ place: 'Daggerfall', at: new Date(2026, 9, 5, 12).getTime() }), 'Daggerfall · 5 Oct 2026');
  assert.equal(shotCaption({ place: '', at: new Date(2026, 0, 1).getTime() }), '1 Jan 2026', 'a picture brought in has no place, only its day');
});

test('LOAD1 gallery: a shot is kept with its place and in the turn; the switch takes it out; a full gallery REFUSES and keeps every shot (mutants: no cap; the oldest dropped; the switch ignored)', async () => {
  setGalleryBackend(memoryGalleryBackend());
  let heard = 0;
  const off = onGalleryChange(() => { heard++; });
  try {
    const a = await keepShot(new Blob(['png']), { place: 'Wayrest', at: 100, encode: enc });
    const b = await keepShot(new Blob(['png']), { place: 'Sentinel', at: 200, encode: enc });
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && a !== b);
    const shots = await listShots();
    assert.deepEqual(shots.map((s) => [s.place, s.loading, s.w, s.h]), [['Sentinel', true, 1920, 1080], ['Wayrest', true, 1920, 1080]]);
    assert.ok(shots[0].thumb instanceof Blob && shots[0].blob instanceof Blob, 'the record carries both pictures');
    assert.equal(await setShotLoading(a, false), true);
    assert.equal((await loadingShot(() => 0.99)).id, b, 'the one taken out is never drawn');
    assert.equal(await setShotLoading(b, false), true);
    assert.equal(await loadingShot(), null);
    assert.equal(await deleteShot(a), true);
    assert.deepEqual((await listShots()).map((s) => s.id), [b]);
    assert.ok(heard >= 5, `every change is told (${heard})`);
    for (let i = await shotCount(); i < GALLERY_MAX; i++) await keepShot(new Blob(['x']), { at: i, encode: enc });
    assert.equal(await shotCount(), GALLERY_MAX);
    assert.equal(await keepShot(new Blob(['x']), { encode: enc }), 'full');
    assert.equal(await shotCount(), GALLERY_MAX, 'nothing was dropped to make room');
    assert.ok((await listShots()).some((s) => s.id === b), 'the oldest shot is still there');
    // a failure is null, never a throw: a shot that cannot be kept is still a downloaded shot
    setGalleryBackend(memoryGalleryBackend());
    assert.equal(await keepShot(new Blob(['x']), { encode: async () => { throw new Error('no 2d'); } }), null);
  } finally { off(); setGalleryBackend(null); }
});

test('LOAD1 the key: the PNG goes to the gallery AND the download, the download on its own switch, and the HUD hears the gallery\'s answer (mutants: keep never called; the download unswitchable; the full gallery silent)', async () => {
  const prevURL = globalThis.URL;
  globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  try {
    const clicks = [];
    const doc = { createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }), body: { appendChild() {} } };
    const png = { png: true };
    const kept = [];
    const said = [];
    const name = await takeScreenshot({ toBlob: (cb) => cb(png) }, { raf: null, doc, later() {}, keep: async (b) => { kept.push(b); return 7; }, said: (l) => said.push(l) });
    await flush();
    assert.match(name, /^daggerfall-\d{8}-\d{6}\.png$/);
    assert.equal(clicks.length, 1);
    assert.deepEqual(kept, [png], 'the very PNG the download saved');
    assert.deepEqual(said, ['Screenshot kept - see Screenshots in the menu.']);
    clicks.length = 0; said.length = 0;
    const none = await takeScreenshot({ toBlob: (cb) => cb(png) }, { raf: null, doc, later() {}, download: false, keep: async () => 'full', said: (l) => said.push(l) });
    await flush();
    assert.equal(none, null);
    assert.equal(clicks.length, 0, 'the download switched off saves no file');
    assert.deepEqual(said, ['The gallery is full - delete some under Screenshots.']);
    assert.equal(keptLine('full', true), 'Screenshot saved. The gallery is full - delete some under Screenshots.');
    assert.equal(keptLine(null, true), 'Screenshot saved.');
    assert.equal(keptLine(null, false), 'The screenshot could not be kept.');
  } finally { globalThis.URL = prevURL; }
  // printScreen: the place where the key was pressed, and the player's switch
  const calls = [];
  setScreenshotCanvas({}, { shoot: (c, o) => calls.push(o) });
  setShotPlace(() => 'Daggerfall');
  assert.equal(PREF_DEFAULTS[SHOT_DOWNLOAD_PREF], true, 'the download is on until the player says otherwise - KB1 as it shipped');
  try {
    assert.equal(printScreen(), true);
    assert.equal(calls[0].download, true);
    setPref(SHOT_DOWNLOAD_PREF, false);
    printScreen();
    assert.equal(calls[1].download, false);
    // the keep goes through the gallery's door with the place read AT THE PRESS, not when the gallery answers
    setGalleryBackend(memoryGalleryBackend());
    setShotEncoder(enc);
    setShotPlace(() => 'Wayrest');
    const id = await calls[1].keep(new Blob(['png']));
    assert.ok(Number.isInteger(id), `kept: ${id}`);
    assert.deepEqual((await listShots()).map((r) => r.place), ['Daggerfall']);
  } finally {
    setPref(SHOT_DOWNLOAD_PREF, true);
    setScreenshotCanvas(null);
    setShotPlace(null);
    setGalleryBackend(null);
    setShotEncoder(null);
  }
  const src = read('src/ui/screenshot.js');
  assert.match(src, /const place = placeNow\(\);[^\n]*\n\s*_shoot\(_canvas, \{ keep: \(blob\) => keepInGallery\(blob, place\), download: getPref\(SHOT_DOWNLOAD_PREF\) !== false, said: sayOnHud \}\);/,
    'the place is read at the press, the keep goes to the gallery and the download asks the switch');
  assert.doesNotMatch(src, /^import[^\n]*shotGallery/m, 'the gallery is a door, never a static import - this file is on the entry\'s graph (BOOT2)');
});

test('LOAD1 the screen: a hold shorter than its delay shows nothing; a shown screen stands MIN_SHOWN_MS and fades; nested holds keep it up; the place and the step paint (mutants: no delay; no stand; the first end takes it down)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    removeLoadingScreen();
    const quick = beginLoading({ place: 'Daggerfall', line: 'Entering' });
    mock.timers.tick(APPEAR_MS - 1);
    assert.equal(screen(), null, 'inside the delay: nothing drawn');
    quick.end();
    mock.timers.tick(APPEAR_MS * 4);
    assert.equal(screen(), null, 'a door that cost a frame never flashed a screen');
    assert.equal(loadingHeld(), false);

    const a = beginLoading({ place: 'Daggerfall', line: 'Entering' });
    mock.timers.tick(APPEAR_MS);
    const s = screen();
    assert.ok(s, 'past the delay the screen stands');
    assert.equal(textOf(s, 'ld-place'), 'Daggerfall');
    assert.equal(textOf(s, 'ld-line'), 'Entering');
    assert.equal(s.attrs.role, 'status');
    const b = beginLoading({ delay: 0 });
    a.end();
    mock.timers.tick(MIN_SHOWN_MS * 2);
    assert.equal(screen(), s, 'a second hold keeps the same screen up');
    setLoadingPlace('Wayrest');
    setLoadingLine('Travelling');
    assert.equal(textOf(s, 'ld-place'), 'Wayrest');
    assert.equal(textOf(s, 'ld-line'), 'Travelling');
    b.end();
    b.end();   // idempotent from any door
    assert.equal(loadingHeld(), false);
    setLoadingPlace('Elsewhere');
    setLoadingLine('Something else');
    assert.deepEqual([textOf(s, 'ld-place'), textOf(s, 'ld-line')], ['Wayrest', 'Travelling'], 'a word with no hold open never paints the screen standing out its last moment');
    assert.equal(loadingShown(), true, 'still standing through its fade');
    mock.timers.tick(0);   // the stand already served: the fade begins
    assert.equal(loadingShown(), false, 'the slot is empty before the screen is told (THE SLOT IS EMPTIED...)');
    assert.ok(screen(), '...and the screen fades out in place');
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null, 'gone once the fade ran');
    setLoadingPlace('Stale');
    const c = beginLoading({ delay: 0 });
    assert.equal(textOf(screen(), 'ld-place'), '', 'a word set between loads never stands on the next one');
    c.end();
    mock.timers.tick(MIN_SHOWN_MS);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null);

    // the stand: a load that ends a moment after its screen appears does not blink
    const d = beginLoading({ delay: 0 });
    mock.timers.tick(10);
    d.end();
    mock.timers.tick(MIN_SHOWN_MS - 20);
    assert.equal(loadingShown(), true, 'it stands its MIN_SHOWN_MS');
    mock.timers.tick(10);
    assert.equal(loadingShown(), false, 'and not a moment more');
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null);
  } finally { removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the screen: NEVER TRAPS - a hold whose load threw past its end lets go at its ceiling, and withLoading ends however the load ends (mutants: no ceiling; no finally)', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const warn = mock.method(console, 'warn', () => {});
  try {
    removeLoadingScreen();
    beginLoading({ delay: 0, why: 'a test load' });
    assert.ok(screen());
    mock.timers.tick(HOLD_MAX_MS - 1);
    assert.equal(loadingHeld(), true, 'held up to its ceiling');
    mock.timers.tick(1);
    assert.equal(loadingHeld(), false, 'the ceiling ended the hold');
    mock.timers.tick(0);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null, 'and the screen went with it');
    assert.match(String(warn.mock.calls[0]?.arguments[0]), /a test load held the loading screen past/);
  } finally { warn.mock.restore(); removeLoadingScreen(); mock.timers.reset(); }
  try {
    await assert.rejects(withLoading({ delay: 0 }, async () => { throw new Error('the build threw'); }), /the build threw/);
    assert.equal(loadingHeld(), false, 'the throw ended its hold');
    assert.equal(await withLoading({ delay: 0 }, async (h) => { assert.equal(h.open, true); return 5; }), 5);
    assert.equal(loadingHeld(), false);
  } finally { removeLoadingScreen(); }
});

test('LOAD1 the frame\'s question: a move raises one hold, its place and step asked every frame; the still frame ends it; a ceiling\'s let-go is not raised again for the same stuck move (mutants: a hold per frame; never ended; re-raised)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const warn = mock.method(console, 'warn', () => {});
  try {
    removeLoadingScreen();
    let place = '';
    const ask = { place: () => place, line: () => 'Travelling', delay: 0 };
    syncLoading(true, ask);
    syncLoading(true, ask);
    assert.ok(screen());
    assert.equal(textOf(screen(), 'ld-place'), '', 'the destination is not known yet');
    place = 'Sentinel';
    syncLoading(true, ask);
    assert.equal(textOf(screen(), 'ld-place'), 'Sentinel', 'the teleport began: its place is said');
    syncLoading(false, ask);
    assert.equal(loadingHeld(), false, 'one hold, ended by the first still frame');
    mock.timers.tick(MIN_SHOWN_MS);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null);
    syncLoading(true, ask);
    mock.timers.tick(HOLD_MAX_MS);
    mock.timers.tick(0);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null, 'the stuck move\'s screen let go at the ceiling');
    syncLoading(true, ask);
    mock.timers.tick(MIN_SHOWN_MS);
    assert.equal(screen(), null, '...and is not raised again while the same move stays stuck');
    syncLoading(false, ask);
    syncLoading(true, ask);
    assert.ok(screen(), 'the next move raises its own');
  } finally { warn.mock.restore(); removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the switch: the Features row is the one declaration - Your screenshots by default, Night sky, Off; the classic skin and the probes\' ?shot draw none; the boot\'s steps read as words (mutants: the row unsound; classic drawn; ?shot drawn)', () => {
  const row = FEATURES.find((f) => f.id === 'loading-screen');
  assert.ok(row);
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online], ['interface', ['enhanced'], 'prefs', 'loadingScreen', 'shots', 'player']);
  assert.deepEqual(row.control.tiers.map(([v]) => v), ['shots', 'art', 'off']);
  assert.equal(PREF_DEFAULTS.loadingScreen, 'shots', 'RF4: the shelf takes its default from the row');
  assert.equal(loadingMode(''), 'shots');
  assert.equal(loadingMode('?skin=classic'), 'off', 'the classic UI keeps Daggerfall\'s loads');
  assert.equal(loadingMode('?shot'), 'off');
  assert.equal(loadingMode('?noloading'), 'off');
  setPref('loadingScreen', 'art');
  try {
    assert.equal(loadingMode(''), 'art');
    setPref('loadingScreen', 'off');
    assert.equal(loadingMode(''), 'off');
    const h = beginLoading({ delay: 0 });
    assert.equal(h.open, false, 'off: a hold is born closed');
    assert.equal(screen(), null);
  } finally { setPref('loadingScreen', 'shots'); removeLoadingScreen(); }
  assert.equal(getPref('loadingScreen'), 'shots');
  assert.equal(bootLine('loading data'), 'Reading the game data');
  assert.equal(bootLine('building player pixel 207,213'), 'Raising the land');
  assert.equal(bootLine('streaming world - Daggerfall'), 'Raising the land');
  assert.equal(bootLine('loading the saved game'), 'Loading the saved game');
  assert.equal(bootLine(''), 'Loading');
  assert.equal(LOADING_Z, 19, 'over the death screen (18), under the crash banner (20)');
  assert.ok(LOADING_TIPS.length >= 2 && tipAt(0) !== tipAt(60_000), 'a minute later, another tip');
  for (const t of LOADING_TIPS) assert.doesNotMatch(t, /\b(F\d+|Enter|Escape|Space|key [A-Z])\b/, `a tip names no key - keys are rebound: ${t}`);
});

test('LOAD1 the screen stands on a shot from the turn, with its caption; with none in it, on the night sky and a tip (mutants: the shot never asked; the caption lost)', async () => {
  setGalleryBackend(memoryGalleryBackend());
  try {
    removeLoadingScreen();
    let h = beginLoading({ delay: 0, place: 'Daggerfall' });
    await flush();
    assert.ok(screen().querySelector('.ld-tip'), 'an empty gallery: the tip in the corner');
    assert.ok(screen().querySelector('.px-ground'), 'and the menu\'s night ground under it');
    h.end();
    removeLoadingScreen();
    await keepShot(new Blob(['png']), { place: 'Privateer’s Hold', at: new Date(2026, 9, 4, 9).getTime(), encode: enc });
    h = beginLoading({ delay: 0, place: 'Daggerfall' });
    await flush();
    const s = screen();
    assert.equal(textOf(s, 'ld-cap'), 'Privateer’s Hold · 4 Oct 2026');
    assert.match(String(s.querySelector('.ld-shot').src), /^blob:/, 'the shot is the picture');
    h.end();
  } finally { removeLoadingScreen(); setGalleryBackend(null); }
});

test('LOAD1 the hosts: the boot raises the screen at once and its title steps are its line, ended at status(null); the world frame asks AUDIT 68 S22\'s one question and a door\'s build; a claimed loop lets go; a film takes the screen aside (mutants: the frame sync gone; the boot hold never ended; the claimed loop keeps the screen)', () => {
  const w = read('src/scenes/world.js');
  const boot = w.slice(w.indexOf('export async function bootWorld('));
  const head = boot.slice(0, boot.indexOf('const realmNew = '));
  assert.match(head, /const bootLoading = beginLoading\(\{ delay: 0, [^}]*why: 'the boot' \}\);/, 'before the realm\'s join - the first await');
  assert.match(head, /status = \(msg\) => \{ if \(msg == null\) bootLoading\.end\(\); else bootLoading\.line\(bootLine\(msg\)\); titleStatus\(msg\); \};/);
  assert.ok(boot.indexOf('status(null);   // FB0930-TITLE') > 0, 'the boot\'s end is the hold\'s end');
  const frame = boot.slice(boot.indexOf('  function frame(now) {'));
  assert.match(read('src/scenes/shared.js'), /export function claimFrame\(\) \{ syncLoading\(false\); return \+\+_frameGeneration; \}/, 'a claimed loop lets its hold go - no frame of it will end it');
  assert.match(frame, /const _moving = worldMoveBusy\(\) \|\| !!modes\?\.transitioning;\n\s*setLoadingAside\('window', townTalk\.overlayActive \|\| !!modes\?\.overlayHeld\);\n\s*syncLoading\(_moving, \{ place: loadingPlaceNow, line: loadingLineNow \}\);\n\s*if \(!_moving\) \{ _loadingDest = null; _partyWaitLine = ''; \}/,
    'every frame: a window up takes the screen aside, then the one question');
  assert.match(w, /const loadingPlaceNow = \(\) => loadingPlaceOf\(\{ dest: _loadingDest, moving: worldMoveBusy\(\), placeAt: placeAtPixel, here: placeHere \}\);/);
  assert.match(w, /_traveling \? \(_partyWaitLine \|\| 'Travelling'\)/, 'the party landing\'s wait is said on the screen over the chat line');
  assert.match(w, /onWait: \(\) => \{ _partyWaitLine = PARTY_ARRIVAL_TEXT\.waiting; townTalk\.say\(PARTY_ARRIVAL_TEXT\.waiting\); \}/);
  assert.match(w, /function placeAtPixel\(px, py\) \{\n\s*const key = `\$\{px\},\$\{py\}`;\n\s*if \(_ohGpsName\?\.key === key && _ohGpsName\.name\) return _ohGpsName\.name;/, 'the abyss wears its own name over the pixel it borrows');
  assert.match(w, /if \(!params\.has\('load'\) && !\(params\.has\('classicload'\) && peekPendingClassicSave\(\)\)\) setLoadingPlace\(startLoc\?\.name \|\| locationName\);/, 'a stale ?classicload imports nothing: the start is the place');
  assert.match(w, /setLoadingAside\('window', true\);[^\n]*\n\s*townTalk\.showOverlay\(createChargenWindow\(flow, \{/, 'the chargen shown mid-boot takes the boot\'s screen aside');
  assert.match(w, /onDone: \(r\) => \{\n\s*setLoadingAside\('window', false\);/, '...and a boot still going stands it again when the wizard is done');
  const at = frame.indexOf('syncLoading(_moving');
  assert.ok(at > frame.indexOf('if (frameHeld())') && at > frame.indexOf('else lookFilter.tick(dt, cam);'), 'below the film\'s wait and the look\'s tick, whose heads AUDIT 39 #160 and AUDIT 28 W7 keep');
  assert.ok(at < frame.indexOf('capturePendingScreenshot(canvas);   // SS1: a save armed from a modal mode'), '...and above the indoor mode\'s return, so every drawn frame asks');
  const sh = read('src/scenes/shared.js');
  assert.match(sh, /_frameHold\+\+;\n\s*stepAsideLoading\(true\);/, 'a film\'s hold takes the screen aside...');
  assert.match(sh, /_frameHold = Math\.max\(0, _frameHold - 1\); if \(!_frameHold\) stepAsideLoading\(false\);/, '...and the last release brings it back');
  assert.match(w, /function worldMoveBusy\(\) \{[\s\S]{0,400}return _seasonStraightening \|\| _traveling \|\| _teleporting \|\| _recalling \|\| _respawning \|\| _loading \|\| !!ohAbyss\?\.entering;/, 'the one question still asks every mover');
  const core = w.slice(w.indexOf('  async function _teleportToPixel('));
  assert.match(core.slice(0, core.indexOf('    const first = queue.shift();') + 40), /_loadingDest = \{ x: px, y: py \}; setLoadingPlace\(placeAtPixel\(px, py\)\);[^\n]*\n\s*const first = queue\.shift\(\);/, 'the core names its destination before its first await');
  assert.equal((core.slice(0, core.indexOf('    const first = queue.shift();')).match(/\bawait\b/g) ?? []).length, 0, 'no await stands above it');
  assert.match(w, /setShotPlace\(placeHere\);/);
});

test('LOAD1 aside, never over: a film\'s hold or a window takes the screen aside; when the last goes mid-load it waits for the frame\'s answer - back if still loading, ending hidden if not; a screen built aside is born hidden; a claimed loop lets go (mutants: the film under the screen; aside for ever; the flash back; built over a window; the claimed loop\'s screen kept)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    removeLoadingScreen();
    syncLoading(true, { delay: 0 });
    const cls = liveClasses(screen());
    const a = holdFrame();
    const b = holdFrame();
    assert.ok(cls.has('aside'), 'the film owns the canvas: the screen steps aside');
    a();
    assert.ok(cls.has('aside'), 'still aside while any hold stands');
    b();
    b();   // a release is once, however many paths call it
    assert.ok(cls.has('aside'), 'the film let go mid-load: hidden until the frame answers');
    syncLoading(true, { delay: 0 });
    assert.ok(!cls.has('aside'), 'the load goes on: the screen is back');
    assert.equal(loadingHeld(), true, 'its hold untouched throughout');
    // the move that ends under the film ends hidden - never a flash of the whole screen before its fade
    const c = holdFrame();
    c();
    syncLoading(false, { delay: 0 });
    assert.ok(cls.has('aside'), 'ended under the film: it never comes back');
    mock.timers.tick(MIN_SHOWN_MS);
    mock.timers.tick(LOADING_FADE_MS);
    assert.ok(cls.has('aside'), 'hidden through its fade');
    assert.equal(screen(), null);
    // a window: the frame says so every frame
    syncLoading(true, { delay: 0 });
    const w = liveClasses(screen());
    setLoadingAside('window', true);
    assert.ok(w.has('aside') && loadingAside());
    setLoadingAside('window', false);
    assert.ok(w.has('aside'), 'closed mid-load: hidden until the frame answers');
    syncLoading(true, { delay: 0 });
    assert.ok(!w.has('aside'));
    claimFrame();
    assert.equal(loadingHeld(), false, 'a claimed loop lets the frame\'s hold go');
    mock.timers.tick(MIN_SHOWN_MS);
    mock.timers.tick(LOADING_FADE_MS);
    // a screen built while a window stands is born hidden (the boot's chargen is shown before the boot's screen ends)
    setLoadingAside('window', true);
    const h = beginLoading({ delay: 0 });
    assert.ok(String(screen().className).split(/\s+/).includes('aside'), 'born aside');
    setLoadingAside('window', false);
    h.end();
  } finally { _resetLoadingAsideForTests(); removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the words: the first hold of a load sets the place and step afresh, a hold inside it adds only what it names; the frame\'s place is the destination once named, nothing while unnamed, here for a door (mutants: the first hold additive; the nested hold wiping; the place left being said)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    removeLoadingScreen();
    const a = beginLoading({ delay: 0, place: 'Daggerfall', line: 'Entering' });
    const b = beginLoading({ delay: 0 });
    assert.deepEqual([textOf(screen(), 'ld-place'), textOf(screen(), 'ld-line')], ['Daggerfall', 'Entering'], 'a hold inside names nothing: the words stand');
    const c = beginLoading({ delay: 0, line: 'Travelling' });
    assert.deepEqual([textOf(screen(), 'ld-place'), textOf(screen(), 'ld-line')], ['Daggerfall', 'Travelling'], '...and what it names, it adds');
    a.end(); b.end(); c.end();
    const d = beginLoading({ delay: 0 });   // the next load, begun inside the last one's stand
    assert.deepEqual([textOf(screen(), 'ld-place'), textOf(screen(), 'ld-line')], ['', 'Loading'], 'a new load never inherits the last one\'s place');
    d.end();
  } finally { removeLoadingScreen(); mock.timers.reset(); }
  const placeAt = (x, y) => `${x},${y}`;
  assert.equal(loadingPlaceOf({ dest: { x: 3, y: 4 }, moving: true, placeAt, here: () => 'Here' }), '3,4');
  assert.equal(loadingPlaceOf({ dest: null, moving: true, placeAt, here: () => 'Here' }), '', 'a move not yet bound names nothing - never the place being left');
  assert.equal(loadingPlaceOf({ dest: null, moving: false, placeAt, here: () => 'Here' }), 'Here', 'a door\'s build opens where the player stands');
});

test('LOAD1 the layers: over the death screen and under the crash banner, read off their own sheets; the HUD pieces that stand higher go while the screen is SEEN, each a selector its own module draws (mutants: the CSS off the constant; the veil never lifted; a renamed piece)', () => {
  const death = /\.dth \{[^}]*z-index: (\d+);/.exec(read('src/ui/enhancedDeath.js'));
  const crash = /el\.id = 'crash';\s*el\.style\.cssText = '[^']*z-index:(\d+)/.exec(read('src/main.js'));
  assert.ok(death && crash);
  assert.ok(Number(death[1]) < LOADING_Z && LOADING_Z < Number(crash[1]), `death ${death[1]} < loading ${LOADING_Z} < crash ${crash[1]}`);
  assert.equal(Number(/\.ld \{ position: fixed; inset: 0; z-index: (\d+);/.exec(LOADING_CSS)?.[1]), LOADING_Z, 'the sheet draws at the constant');
  const veil = /((?:body\.ld-up [^,{]+,\s*)*body\.ld-up [^,{]+) \{ visibility: hidden !important; \}/.exec(LOADING_CSS);
  assert.ok(veil, 'the veil rule');
  const sels = veil[1].split(',').map((x) => x.trim().replace(/^body\.ld-up /, ''));
  assert.deepEqual(sels.sort(), ['#plus-pad-prompts', '.arena-hud', '.rvncard-stack', '.sg-hud', '.wb-dmg-chart', '.wb-gate-banner', '.wb-title-card']);
  const home = { '.wb-gate-banner': 'gateBanner.js', '.wb-title-card': 'gateTitleCard.js', '.wb-dmg-chart': 'gateDamageChart.js', '.sg-hud': 'siegeHud.js', '.arena-hud': 'arenaHud.js', '.rvncard-stack': 'revenantCard.js', '#plus-pad-prompts': 'plusPad.js' };
  for (const sel of sels) assert.ok(read(`src/ui/${home[sel]}`).includes(sel.slice(1)), `${sel} is still drawn by ui/${home[sel]}`);
  // and the body wears the veil only while the screen is seen
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const body = liveClasses(document.body);
  try {
    removeLoadingScreen();
    const h = beginLoading({ delay: 0 });
    assert.ok(body.has('ld-up'), 'seen: the higher HUD goes');
    setLoadingAside('window', true);
    assert.ok(!body.has('ld-up'), 'aside: the HUD is the player\'s again');
    setLoadingAside('window', false);
    assert.ok(body.has('ld-up'));
    h.end();
    mock.timers.tick(MIN_SHOWN_MS);
    assert.ok(!body.has('ld-up'), 'gone: the HUD is back');
  } finally { delete document.body.classList; _resetLoadingAsideForTests(); removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the sky is drawn once per window size and kept - no timer redraws it under a load (mutants: the 125 ms redraw back; a draw per screen)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const prev = { mm: globalThis.matchMedia, w: globalThis.innerWidth };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });   // motion allowed: the old timer's case
  try {
    removeLoadingScreen();
    globalThis.innerWidth = 1111;
    const n0 = loadingGroundDraws();
    let h = beginLoading({ delay: 0 });
    mock.timers.tick(2000);
    assert.equal(loadingGroundDraws(), n0 + 1, 'one draw, however long the screen stands');
    h.end();
    removeLoadingScreen();
    h = beginLoading({ delay: 0 });
    assert.equal(loadingGroundDraws(), n0 + 1, 'the next screen at the same size reuses it');
    h.end();
    removeLoadingScreen();
    globalThis.innerWidth = 1112;
    h = beginLoading({ delay: 0 });
    assert.equal(loadingGroundDraws(), n0 + 2, 'a new size draws once more');
    h.end();
  } finally { globalThis.matchMedia = prev.mm; globalThis.innerWidth = prev.w; removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the gallery as it ships: the real encode keeps a FULL_EDGE copy and a THUMB_W thumbnail; the IndexedDB backend mints a key for a new shot and updates a kept one in place; a database that will not open falls back to the tab; keeps run one at a time so the cap holds (mutants: the thumb at FULL_EDGE; the id-strip inverted - a switch duplicates the shot; no fallback; the cap raced)', async () => {
  // the encode, through a decoder and canvases that report their sizes
  const prevCIB = globalThis.createImageBitmap;
  const ce = document.createElement;
  globalThis.createImageBitmap = async () => ({ width: 3840, height: 2160, close() {} });
  document.createElement = (t) => {
    const n = ce(t);
    if (t === 'canvas') n.toBlob = (cb, type) => cb(new Blob([`${n.width}x${n.height}`], { type }));
    return n;
  };
  setGalleryBackend(memoryGalleryBackend());
  try {
    const id = await keepShot(new Blob(['png']), { place: 'Wayrest' });
    assert.ok(Number.isInteger(id), `kept: ${id}`);
    const [r] = await listShots();
    assert.deepEqual([r.w, r.h, await r.blob.text(), await r.thumb.text(), r.blob.type], [1920, 1080, '1920x1080', '320x180', 'image/jpeg']);
  } finally { globalThis.createImageBitmap = prevCIB; document.createElement = ce; setGalleryBackend(null); }
  // the IndexedDB backend
  const io = fakeIdb();
  const b = galleryBackendOver(io.idb);
  const rec = { at: 1, place: 'Daggerfall', w: 1, h: 1, loading: true, blob: new Blob(['a']), thumb: new Blob(['t']) };
  const one = await b.put({ ...rec });
  const two = await b.put({ ...rec, at: 2 });
  assert.deepEqual([one, two], [1, 2], 'a new shot: the store mints its key');
  await b.put({ ...(await b.get(one)), loading: false });
  assert.equal(await b.count(), 2, 'a kept shot written again is UPDATED - a switch press never duplicates it');
  assert.equal((await b.get(one)).loading, false);
  await b.del(two);
  assert.deepEqual((await b.all()).map((x) => x.id), [1]);
  const warn = mock.method(console, 'warn', () => {});
  try {
    const dead = galleryBackendOver(fakeIdb({ failOpen: true }).idb);
    assert.equal(await dead.put({ ...rec }), 1, 'the open failed: the tab keeps it');
    assert.equal(await dead.count(), 1);
    assert.match(String(warn.mock.calls[0]?.arguments[0]), /IndexedDB refused/);
  } finally { warn.mock.restore(); }
  // one at a time: three presses inside one encode at 119 keep ONE
  setGalleryBackend(memoryGalleryBackend());
  try {
    for (let i = 0; i < GALLERY_MAX - 1; i++) await keepShot(new Blob(['x']), { at: i, encode: enc });
    const slow = async () => { await flush(3); return enc(); };
    const got = await Promise.all([1, 2, 3].map(() => keepShot(new Blob(['x']), { encode: slow })));
    assert.equal(got.filter((x) => x === 'full').length, 2, `the second and third find it full: ${got}`);
    assert.equal(await shotCount(), GALLERY_MAX);
  } finally { setGalleryBackend(null); }
});

test('LOAD1 the menu: Screenshots is on every rail, the System page and both dispatch tables; the door\'s foot carries it beside About; the unmount lets its pictures go (mutants: a rail without it; a dead dispatch; no release)', () => {
  const menu = read('src/ui/enhancedMenu.js');
  for (const rail of ['SECTIONS_BOOT', 'SECTIONS_CLASSIC', 'SECTIONS_PAUSE']) {
    const list = new RegExp(`const ${rail} = \\[([^\\]]*)\\]`).exec(menu)[1];
    assert.match(list, /'Screenshots', 'About'/, `${rail} carries it, before About`);
  }
  assert.ok(SYSTEM_PANES.some(([id, label]) => id === 'screenshots' && label === 'Screenshots'));
  assert.equal((menu.match(/screenshots: drawShotsPane,/g) ?? []).length, 2, 'both dispatch tables');
  assert.match(menu, /if \(label === 'About' \|\| label === 'Screenshots'\) continue;/, 'the door\'s list leaves it to the foot');
  assert.match(menu, /const shots = el\('button', 'px-about px-shots', 'Screenshots'\);\n\s*shots\.onclick = \(\) => go\('screenshots'\);/);
  assert.match(menu, /stopTimers\(\);   \/\/ TIMERS1\n\s*releaseShotsPane\(\);/);
});

test('LOAD1 the pane: it fills when the gallery answers - each shot\'s caption, its switch, Save, and a Delete that asks once; an empty gallery says how to take one (mutants: the switch writes nothing; Delete deletes on the first press)', async () => {
  setGalleryBackend(memoryGalleryBackend());
  try {
    const body = document.createElement('div');
    document.body.append(body);
    drawShotsPane(body);
    await flush();
    assert.ok(body.querySelector('.empty'), 'nothing kept: the empty card');
    assert.match(body.textContent, /Press F8 anywhere in the world/, 'naming the player\'s own key');
    assert.equal(shotKeyName(), 'F8');
    const id = await keepShot(new Blob(['png']), { place: 'Daggerfall', at: new Date(2026, 9, 5).getTime(), encode: enc });
    await flush();
    const tiles = body.querySelectorAll('.shot-tile');
    assert.equal(tiles.length, 1, 'the change refilled the pane');
    assert.equal(textOf(tiles[0], 'shot-cap'), 'Daggerfall · 5 Oct 2026');
    const turn = tiles[0].querySelector('.shot-turn');
    assert.equal(turn.textContent, 'On loading screens');
    turn.click();
    await flush();
    assert.equal((await listShots())[0].loading, false, 'the switch wrote the gallery');
    assert.equal(body.querySelector('.shot-turn').textContent, 'Not on loading screens');
    const del = () => body.querySelector('.shot-tile').querySelectorAll('.act').find((b) => /^Delete/.test(b.textContent));
    del().click();
    await flush();
    assert.equal(await shotCount(), 1, 'the first press only asks');
    assert.equal(del().textContent, 'Delete it?');
    del().click();
    await flush();
    assert.equal(await shotCount(), 0);
    assert.equal((await listShots()).some((s) => s.id === id), false);
    body.remove();
  } finally { releaseShotsPane(); setGalleryBackend(null); }
});

test('LOAD1 the pane, a visit at a time: a new pane forgets the last one\'s armed Delete and open view; the keyboard stays on the pressed button through the refill, and a deleted tile hands it to its neighbour; pictures from files are dated by the file and every one unread is said; the classic skin\'s words (mutants: the arm outliving its pane; the focus dropped; the unread silent; the classic words lost)', async () => {
  setGalleryBackend(memoryGalleryBackend());
  try {
    const older = await keepShot(new Blob(['a']), { place: 'Sentinel', at: 100, encode: enc });
    const newer = await keepShot(new Blob(['b']), { place: 'Wayrest', at: 200, encode: enc });
    const body = document.createElement('div');
    document.body.append(body);
    drawShotsPane(body);
    await flush();
    const buttonKeyed = (key) => body.querySelectorAll('button').find((x) => x.getAttribute('data-focus') === key);
    buttonKeyed(`del:${newer}`).click();
    await flush();
    assert.equal(buttonKeyed(`del:${newer}`).textContent, 'Delete it?');
    const again = document.createElement('div');
    document.body.append(again);
    body.remove();
    drawShotsPane(again);
    await flush();
    const inAgain = (key) => again.querySelectorAll('button').find((x) => x.getAttribute('data-focus') === key);
    assert.equal(inAgain(`del:${newer}`).textContent, 'Delete', 'a new visit: the arm is the last pane\'s, gone');
    // the keyboard stays where it was
    const turn = inAgain(`turn:${newer}`);
    turn.focus();
    turn.click();
    await flush();
    assert.notEqual(inAgain(`turn:${newer}`), turn, 'the pane refilled');
    assert.equal(document.activeElement?.getAttribute?.('data-focus'), `turn:${newer}`, '...and the focus is on the same button');
    inAgain(`del:${newer}`).focus();
    inAgain(`del:${newer}`).click();
    await flush();
    inAgain(`del:${newer}`).click();
    await flush();
    assert.equal(await shotCount(), 1);
    assert.equal(document.activeElement?.getAttribute?.('data-focus'), `thumb:${older}`, 'a deleted tile hands the keyboard to its neighbour');
    // pictures from files
    setShotEncoder(async (f) => { if (f.bad) throw new Error('no decoder reads it'); return enc(); });
    const day = new Date(2026, 0, 2).getTime();
    const r = await addPictures(again, [{ bad: true, lastModified: day }, { lastModified: day }]);
    assert.deepEqual(r, { kept: 1, unread: 1, full: false });
    assert.equal(textOf(again, 'shots-say'), 'One picture could not be read.', 'NEVER SILENT');
    assert.ok((await listShots()).some((x) => x.at === day), 'dated by the file\'s own day');
    again.remove();
  } finally { setShotEncoder(null); releaseShotsPane(); setGalleryBackend(null); }
  const skin = getPref('skin');
  try {
    setPref('skin', 'classic');
    assert.equal(loadingWordsKey(), 'classic');
    assert.match(LOADING_WORDS[loadingWordsKey()], /drawn under the enhanced UI/);
    setPref('skin', 'enhanced');
    assert.equal(loadingWordsKey(), 'shots');
  } finally { setPref('skin', skin); }
});

test('LOAD1 the doctrine: the gallery touches no network and no repository path - a render of game data stays in the player\'s own browser (mutants: a fetch; an upload)', () => {
  const g = read('src/systems/shotGallery.js');
  assert.doesNotMatch(g, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//, 'nothing leaves the browser');
  assert.match(g, /indexedDB/);
  const pane = read('src/ui/shotsPane.js');
  assert.doesNotMatch(pane, /\bfetch\(|XMLHttpRequest|sendBeacon/);
});
