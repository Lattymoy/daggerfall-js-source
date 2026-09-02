// ROAD TO 1:1, WAVE E - E1: THE OVERLAY MOUSE/KEY-*UP* SEAM.
//
// THE GAP. The port's hosts routed pointer DOWN, pointer MOVE and key
// DOWN into whatever window held their overlay slot, and no UP of
// either kind. DFU has no such asymmetry because it has no "routes" at
// all: `InputManager` keeps a held-key/held-button dictionary and every
// window polls it in its own `Update()` -
// `HotkeySequence.IsDownWith`/`IsUpWith`/`IsPressedWith`
// (HotkeySequence.cs:169-183) are `GetKeyDown`/`GetKeyUp`/`GetKey` over
// that dictionary, and `VerticalScrollBar.Update` (:101-130) reads
// `GetMouseButton(0)` the same way. A press is an EDGE, a release is
// the OTHER edge, and a hold is a STATE - the port had one of the
// three.
//
// The three consequences were each recorded at their own site:
//   - `ui/listPicker.js` - `ListPickerWindow.release()` was written by
//     ROAD-A7 and never called, so the thumb-drag latch survived the
//     button coming up and dropped only on the next `hover`
//     (Port-Ledger C :466's remainder).
//   - `ui/automapWindow.js` - the dungeon automap's twenty-two
//     `IsPressedWith` camera arms fired at the browser's key-repeat
//     rate instead of once per frame, and its two-phase toggle-close
//     drained in `tick()` rather than on the key UP DFU closes on
//     (Port-Ledger A "C2: the dungeon automap's HELD hotkeys").
//   - `ui/exteriorAutomapWindow.js` - the same departure, same class.
//
// WHAT SHIPPED. The seam, once, through the ONE overlay route each host
// already had: `ui/input.js`'s `routeKeyUp` beside `routeKey`,
// `townTalk.pointer('up')` widened to a window that has only
// `release()`, `worldModes.keyup` in both of its modes,
// `dungeonContext.overlayKeyUp` plus the release arm on its one pointer
// door, and `interior.js`'s own two listeners. Then `release()` wired,
// both automap windows given InputManager's held-key dictionary and a
// per-FRAME poll, and both departures retired.
//
// THE FOUR-HOSTS RULE has teeth here for the same reason it did for the
// pointer seam: a host that routes the press and not the release is a
// latch nothing errors on. So the sweep below counts BOTH halves in
// every host that owns an overlay slot, and the live pins drive the
// real townTalk host and the real windows.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { createTownTalk } from '../src/scenes/townTalk.js';
import { ListPickerWindow, PICKER_X, PICKER_Y, PICKER_RECTS, ROWS_DISPLAYED } from '../src/ui/listPicker.js';
import { thumbSpan } from '../src/ui/verticalScrollBar.js';
import {
  AutomapWindow, HOTKEYS_HELD, HOTKEYS_DOWN,
  resetAutomapWindowState, signalAutomapReset, automapCameraState, _setAutomapArt,
} from '../src/ui/automapWindow.js';
import { shortcutOrFallback } from '../src/ui/automapText.js';
import { _resetForTests } from '../src/systems/settings.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ─────────────────────────────────────────────────────────────────────
// THE SWEEP: every host that owns an overlay slot delivers BOTH edges.
// ─────────────────────────────────────────────────────────────────────

/** Each host, the press half it always had, and the release half E1
 *  built. All four patterns are read out of the SHIPPED source - a host
 *  that loses either line fails here, which is the only way a seam
 *  spread over seven files stays whole. */
const HOSTS = [
  {
    file: 'src/scenes/townTalk.js',
    keyDown: /overlay\.input\(e\.code, e\)/,
    keyUp: /overlay\.keyup\(e\.code, e\)/,
    pointerDown: /overlay\.pointer\('down', v\[0\], v\[1\]/,
    pointerUp: /if \(phase === 'up'\) overlay\.release\?\.\(\);/,
  },
  {
    file: 'src/scenes/worldModes.js',
    keyDown: /if \(routeKey\(e, interiorKeyCtx\)\)/,
    keyUp: /interiorOverlay\.keyup\?\.\(e\.code, e\);/,
    pointerDown: /interiorOverlay\.pointer\?\.\('down'/,
    pointerUp: /interiorOverlay\.release\?\.\(\);/,
  },
  {
    file: 'src/scenes/dungeonContext.js',
    keyDown: /overlayInput\(action, e = null\)/,
    keyUp: /overlayKeyUp\(code, e = null\)/,
    pointerDown: /activeOverlay\?\.pointer\?\.\(phase, vx, vy, button, mods\)/,
    pointerUp: /if \(phase === 'up'\) activeOverlay\?\.release\?\.\(\);/,
  },
  {
    file: 'src/scenes/interior.js',
    keyDown: /overlay\.input\(e\.code, e\)/,
    keyUp: /overlay\.keyup\?\.\(e\.code, e\);/,
    pointerDown: /overlay\.pointer\?\.\('down'/,
    pointerUp: /overlay\.release\?\.\(\);/,
  },
  // world.js and exterior.js own the DOM listeners for worldModes AND
  // hold townTalk's slot, so BOTH slots have to hear the release.
  {
    file: 'src/scenes/world.js',
    keyDown: /townTalk\.keydown\(e\)/,
    keyUp: /townTalk\.keyup\(e\); modes\?\.keyup\?\.\(e\);/,
    pointerDown: /modes\?\.pointerdown\?\.\(e\)/,
    pointerUp: /townTalk\.pointer\('up', e\); modes\?\.pointerup\?\.\(e\);/,
  },
  {
    file: 'src/scenes/exterior.js',
    keyDown: /townTalk\.keydown\(e\)/,
    keyUp: /townTalk\.keyup\(e\); modes\?\.keyup\?\.\(e\);/,
    pointerDown: /modes\?\.pointerdown\?\.\(e\)/,
    pointerUp: /townTalk\.pointer\('up', e\); modes\?\.pointerup\?\.\(e\);/,
  },
  // the standalone dungeon route mounts the same context, so it takes
  // the same two doors
  {
    file: 'src/scenes/dungeon.js',
    keyDown: /if \(routeKey\(e, ctx,/,
    keyUp: /routeKeyUp\(e, ctx\);/,
    pointerDown: /ctx\.overlayPointer\?\.\('down'/,
    pointerUp: /ctx\.overlayPointer\?\.\('up'/,
  },
];

test('E1 SOURCE SWEEP: every overlay-owning host routes the key UP and the pointer UP, not only the presses', () => {
  for (const h of HOSTS) {
    const body = src(h.file);
    assert.match(body, h.keyDown, `${h.file}: the key DOWN route (the half that always existed)`);
    assert.match(body, h.keyUp, `${h.file}: the key UP route - E1's half`);
    assert.match(body, h.pointerDown, `${h.file}: the pointer DOWN route`);
    assert.match(body, h.pointerUp, `${h.file}: the pointer release reaches the slot`);
  }
  // ...and the ONE door the two dungeon-context hosts share, so they
  // cannot drift apart the way the pointer seam once did.
  const input = src('src/ui/input.js');
  assert.match(input, /export function routeKeyUp\(e, ctx\) \{/, 'routeKey has a mirror');
  assert.match(input, /ctx\.overlayKeyUp\?\.\(e\.code, e\);/, 'and it hands the RAW code down, as townTalk does');
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    assert.match(src(f), /routeKeyUp\(e, /, `${f} calls the shared door rather than reaching into the context`);
  }
});

test('E1 SOURCE SWEEP: a window that NESTS a list picker forwards the release, exactly as it forwards hover', () => {
  // The picker is mounted two ways: straight into a host's slot (the
  // three routers) and INSIDE another window. The second kind only
  // hears the release if it passes it on - and a file that has a
  // `hover` forwarder and no `release` one is the shape this sweep
  // exists to catch.
  const nesting = [];
  for (const name of readdirSync(new URL('../src/ui/', import.meta.url))) {
    if (!name.endsWith('.js')) continue;
    const body = src(`src/ui/${name}`);
    if (!/this\._?picker = new ListPickerWindow\(/.test(body)) continue;
    nesting.push(name);
    assert.match(body, /release\(\) \{ this\._?picker\?\.release\(\); \}/,
      `${name} nests a picker and must forward release()`);
  }
  assert.deepEqual(nesting.sort(), [
    'guildServiceWindows.js', 'itemMakerWindow.js', 'potionMakerWindow.js', 'spellMakerWindow.js', 'travelMapWindow.js',
  ], 'the five nesting windows (E8 made the spell maker the fifth), named so a sixth cannot appear unforwarded');
});

// ─────────────────────────────────────────────────────────────────────
// LIVE: the real townTalk host delivers both edges into its slot.
// ─────────────────────────────────────────────────────────────────────

const CANVAS = {
  width: 320,
  height: 200,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
};

const talkHost = () => createTownTalk({
  renderer: { uploadTexture: () => ({}) },
  canvas: CANVAS,
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
});

const upEvent = (x, y, button = 0) => ({ clientX: x, clientY: y, button });

test('E1 LIVE (townTalk): the release reaches a window that has ONLY release() - the gate used to demand a pointer seam', () => {
  const tt = talkHost();
  const seen = [];
  // A window shaped like the list picker: click/hover/release and no
  // three-phase pointer seam at all. Before E1 `pointer()` bailed on
  // `if (!overlay?.pointer) return false` and this window never heard
  // the button come up.
  tt.showOverlay({
    done: false,
    click() {}, hover() {},
    release() { seen.push('release'); },
    dispose() {},
  });
  assert.equal(tt.pointer('up', upEvent(100, 90)), true, 'the host owns the release');
  assert.deepEqual(seen, ['release']);

  // and a window with the THREE-PHASE seam still gets the phase, plus
  // the release - both, in that order (a window may implement either).
  const tt2 = talkHost();
  const log = [];
  tt2.showOverlay({
    done: false,
    pointer(phase) { log.push(`pointer:${phase}`); },
    release() { log.push('release'); },
    dispose() {},
  });
  tt2.pointer('up', upEvent(100, 90));
  assert.deepEqual(log, ['pointer:up', 'release']);

  // a window with NEITHER is untouched, and says so
  const tt3 = talkHost();
  tt3.showOverlay({ done: false, click() {}, dispose() {} });
  assert.equal(tt3.pointer('up', upEvent(100, 90)), false, 'nothing to deliver to');
});

test('E1 LIVE (townTalk): the key UP reaches the slot, and a window that ends on the release drains', () => {
  const tt = talkHost();
  const seen = [];
  tt.showOverlay({
    done: false, isChoiceWindow: true,
    input(code) { seen.push(`down:${code}`); },
    keyup(code) { seen.push(`up:${code}`); },
    dispose() {},
  });
  tt.keydown({ code: 'KeyM', key: 'm', preventDefault() {} });
  tt.keyup({ code: 'KeyM' });
  assert.deepEqual(seen, ['down:KeyM', 'up:KeyM']);

  // the automap's shape: the release is what closes it, and the slot is
  // drained in the same event (`if (overlay?.done) dropOverlay()`).
  const tt2 = talkHost();
  let disposed = 0;
  tt2.showOverlay({
    done: false, isChoiceWindow: true,
    input() {}, keyup() { this.done = true; },
    dispose() { disposed++; },
  });
  tt2.keyup({ code: 'KeyM' });
  assert.equal(tt2.overlay, null, 'a window that closes on the release leaves the slot');
  assert.equal(disposed, 1);
});

// ─────────────────────────────────────────────────────────────────────
// LIVE: the list picker's thumb latch, dropped by the release.
// ─────────────────────────────────────────────────────────────────────

const FONT = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 }, tex: 'atlas' };

/** A picker long enough to have a thumb (Draw returns before
 *  DrawScrollBar when the list fits, :136), with the thumb's own
 *  mid-point in native coordinates. */
function pickerWithThumb() {
  const items = Array.from({ length: 40 }, (_, i) => `row ${i}`);
  const w = new ListPickerWindow({ items, onPick: () => {} });
  w._font = FONT;
  const [bx, by, , bh] = PICKER_RECTS.scrollBar;
  const span = thumbSpan(bh, items.length, ROWS_DISPLAYED, w.scrollIndex);
  assert.ok(span, 'a 40-row list has a thumb');
  return {
    w,
    x: PICKER_X + bx + 2,
    thumbY: PICKER_Y + by + span.y + span.h / 2,
    railBottomY: PICKER_Y + by + bh - 2,
  };
}

test('E1 LIVE: the thumb latch drops on the RELEASE, not on the next mouse move', () => {
  const { w, x, thumbY, railBottomY } = pickerWithThumb();
  w.click(x, thumbY, FONT);
  assert.equal(w.scrollBar.draggingThumb, true, 'the press inside thumbRect latches the drag (Update :108-113)');

  // THE SEAM. `release()` is Update's else arm (:123-129) - the frame
  // GetMouseButton(0) reads false, `draggingThumb = false`.
  w.release();
  assert.equal(w.scrollBar.draggingThumb, false);

  // AND THE CONSEQUENCE, which is why the latch mattered. With the
  // latch still standing, the NEXT held-button move - a fresh press
  // somewhere else entirely, then the cursor crossing the picker -
  // resumed the drag from the STALE anchor and threw the list. Here it
  // does nothing: the drag was over when the button came up.
  const before = w.scrollIndex;
  w.hover(x, railBottomY, { buttons: 1 });
  assert.equal(w.scrollIndex, before, 'a later held move does not resume a released drag');

  // the control: an UNRELEASED latch really does drag on that move, so
  // the assertion above is about the release and not about the numbers
  const b = pickerWithThumb();
  b.w.click(b.x, b.thumbY, FONT);
  b.w.hover(b.x, b.railBottomY, { buttons: 1 });
  assert.ok(b.w.scrollIndex > before, 'a live latch drags - which is what the release exists to end');
});

test('E1 LIVE: the real townTalk host drops a picker latch on pointer up', () => {
  const tt = talkHost();
  const { w, x, thumbY, railBottomY } = pickerWithThumb();
  tt.showOverlay(w);
  tt.pointerdown({ clientX: x, clientY: thumbY, button: 0 });
  assert.equal(w.scrollBar.draggingThumb, true, 'the host press latched the thumb');
  tt.pointer('up', upEvent(x, thumbY));
  assert.equal(w.scrollBar.draggingThumb, false, 'and the host release let it go');
  const before = w.scrollIndex;
  tt.hover({ clientX: x, clientY: railBottomY, buttons: 1 });
  assert.equal(w.scrollIndex, before);
});

// ─────────────────────────────────────────────────────────────────────
// LIVE: the automap's HELD hotkeys are a per-FRAME poll now.
// ─────────────────────────────────────────────────────────────────────

const deps = () => ({
  record: () => ({ revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: false }),
  model: { exploredPercentage: () => 0, length: 0 },
  drawList: [], dynamicDraws: [], texRemap: null,
  player: () => ({ feet: [10, 1, 20], eye: [10, 2.7, 20], yaw: 0 }),
  startMarker: null,
  blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }],
  arrowMesh: null,
  dungeonName: 'Privateer’s Hold',
  insideBuilding: false,
});

function freshAutomap() {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  signalAutomapReset();
  return new AutomapWindow(deps());
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('E1 LIVE: a HELD automap hotkey advances once per FRAME, and a browser auto-repeat advances nothing', () => {
  const w = freshAutomap();
  try {
    // resolved out of the shipped table rather than spelled here
    const code = shortcutOrFallback('AutomapMoveForward', w.automapBinding).code;
    assert.ok(code, 'AutomapMoveForward resolves to a key');

    const p0 = [...automapCameraState().pos];
    w.input(code, { code });
    assert.deepEqual([...automapCameraState().pos], p0,
      'THE PRESS MOVES NOTHING: IsPressedWith (:783-870) is InputManager.GetKey, a frame poll, not an edge');

    w.tick(1);
    const p1 = [...automapCameraState().pos];
    const step = dist(p0, p1);
    assert.ok(step > 0, 'the FRAME moves it, at the per-SECOND speed the constant names');

    // the departure that was here: the OS auto-repeat supplied the
    // "hold", so N repeats were N steps. Now they are none.
    w.input(code, { code });
    w.input(code, { code });
    w.input(code, { code });
    assert.deepEqual([...automapCameraState().pos], p1, 'four browser auto-repeats are not four frames');

    // still held: the next frame steps again, by the same amount
    w.tick(1);
    const p2 = [...automapCameraState().pos];
    assert.ok(Math.abs(dist(p1, p2) - step) < 1e-9, 'every frame the key is down is one step');

    // and the RELEASE ends it - the dictionary drains, so the poll
    // stops matching
    w.keyup(code, { code });
    w.tick(1);
    w.tick(1);
    assert.deepEqual([...automapCameraState().pos], p2, 'a released key is not a held key');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('E1 LIVE: the held poll respects the MODIFIER word, and two held keys both run on one frame', () => {
  try {
    // DFU's Update is a flat chain of independent ifs (:783-870), so
    // every matching hotkey fires on the same frame - a port that
    // `return`ed after the first would pan on one axis only.
    const w = freshAutomap();
    const fwd = shortcutOrFallback('AutomapMoveForward', w.automapBinding).code;
    const left = shortcutOrFallback('AutomapMoveLeft', w.automapBinding).code;
    assert.notEqual(fwd, left);
    const p0 = [...automapCameraState().pos];
    w.input(fwd, { code: fwd });
    w.tick(1);
    const onlyFwd = dist(p0, automapCameraState().pos);
    assert.ok(onlyFwd > 0);

    const w2 = freshAutomap();
    const q0 = [...automapCameraState().pos];
    w2.input(fwd, { code: fwd });
    w2.input(left, { code: left });
    w2.tick(1);
    const both = dist(q0, automapCameraState().pos);
    assert.ok(both > onlyFwd + 1e-6, 'two held keys move further in one frame than one does');

    // CheckSetModifiers' second clause (:158-162): a held key with a
    // modifier down that its sequence did not ask for does NOT fire.
    const w3 = freshAutomap();
    const r0 = [...automapCameraState().pos];
    w3.input(fwd, { code: fwd, ctrlKey: true });
    w3.tick(1);
    assert.deepEqual([...automapCameraState().pos], r0,
      'Ctrl held over a no-modifier hotkey refuses it - the mask that keeps Shift-F10 off F10');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('E1: the two hotkey CLASSES stayed two classes - the edge one still fires on the press', () => {
  const w = freshAutomap();
  try {
    // IsDownWith (:736-781) is GetKeyDown, an edge in the reference too,
    // so the DOWN class must NOT have moved into the frame poll with
    // the held one.
    const code = shortcutOrFallback('AutomapSwitchAutomapGridMode', w.automapBinding).code;
    const before = automapCameraState().viewMode;
    w.input(code, { code });
    assert.notEqual(automapCameraState().viewMode, before, 'the grid-mode toggle is still an edge');
    // ...and it does NOT repeat every frame while the key stays down
    const after = automapCameraState().viewMode;
    w.tick(1);
    w.tick(1);
    assert.equal(automapCameraState().viewMode, after, 'an IsDownWith hotkey is not polled');
    assert.equal(HOTKEYS_DOWN.length, 12);
    assert.equal(HOTKEYS_HELD.length, 22);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('E1: every window DFU reads on GetKeyUp answers on the RELEASE - all four, with their C# citations', () => {
  // Four windows in DFU's tree close (or end a rest) on a key UP, and
  // all four had been ported onto the press because the port's seam
  // carried no other edge. They are enumerated here rather than left to
  // four separate files, because they are ONE law with one blocker.
  const WINDOWS = [
    // DaggerfallAutomapWindow.cs:707-713 / ExteriorAutomapWindow.cs:589-596
    { file: 'src/ui/automapWindow.js', member: /^  keyup\(code, e = null\) \{$/m },
    { file: 'src/ui/exteriorAutomapWindow.js', member: /^  keyup\(code, e = null\) \{$/m },
    // DaggerfallRestWindow.cs:193-196 and StopButton_OnKeyboardEvent :714-726
    { file: 'src/ui/restWindow.js', member: /^  keyup\(action, e = null\) \{$/m },
    // DaggerfallPauseOptionsWindow.cs:183-188
    { file: 'src/ui/pauseWindow.js', member: /^  keyup\(code\) \{$/m },
    // D4 got there first, on the travel popup's EXIT (:482-495)
    { file: 'src/ui/travelPopUp.js', member: /^  keyup\(code, e = null\) \{$/m },
  ];
  for (const w of WINDOWS) assert.match(src(w.file), w.member, `${w.file}: the release edge`);

  // and the two-phase latch each of the three that HAS one keeps
  for (const f of ['src/ui/automapWindow.js', 'src/ui/exteriorAutomapWindow.js', 'src/ui/restWindow.js']) {
    assert.match(src(f), /isCloseWindowDeferred/, `${f}: DFU's own field name`);
  }
});

test('E1: the retired DEPARTURES are gone from both automap windows, and the Ledger row is struck', () => {
  const dungeon = src('src/ui/automapWindow.js');
  const exterior = src('src/ui/exteriorAutomapWindow.js');
  // The old claims survive ONLY as quotations inside the retirement
  // record - the site says what it used to say and then what shipped,
  // which is the wave's rule. What must not survive is a claim standing
  // on its own, so each stale phrase is checked to sit downstream of a
  // RETIRED marker rather than checked to be absent.
  const quotedOnly = (body, phrase, name) => {
    let at = body.indexOf(phrase);
    while (at !== -1) {
      assert.ok(body.slice(Math.max(0, at - 900), at).includes('RETIRED'),
        `${name}: "${phrase}" stands as a live claim, not as a retirement's quotation`);
      at = body.indexOf(phrase, at + 1);
    }
  };
  for (const [name, body] of [['automapWindow.js', dungeon], ['exteriorAutomapWindow.js', exterior]]) {
    assert.match(body, /ROAD-E E1 RETIRED/, `${name}: the retirement is recorded at the site`);
    quotedOnly(body, 'carries no key-up route at all', name);
    quotedOnly(body, 'delivers keydown and no keyup', name);
    quotedOnly(body, 'auto-repeat rate', name);
    // and the mechanism that replaced them
    assert.match(body, /_tickHeldHotkeys\(dt\) \{/, `${name}: the per-frame poll`);
    assert.match(body, /this\._heldCodes/, `${name}: InputManager's held-key dictionary`);
    assert.match(body, /keyup\(code, e = null\) \{/, `${name}: the release edge`);
  }
  const ledger = src('bible/01-Overview/Port-Ledger.md');
  assert.match(ledger, /~~C2: the dungeon automap's HELD hotkeys[\s\S]{0,400}?~~ RETIRED \(E-group, 2026-09-02\)/,
    'the Ledger A row is struck in the Ledger\'s idiom');
});
