// FB0929 (field bug, 2026-09-29, Discord #bug-reports, relayed by Mac). Satranath: "Can't free mouse on Overworld
// until after pressing Escape (Y doesn't work) after Overworld update. As title says. Y doesn't free the mouse on
// overworld until after you press Escape."
//
// THE LOCK LANDED UNDER THE OVERWORLD. A browser grants a pointer lock a task AFTER it is asked for - Chromium hands
// the request back with `pointerLockElement` still null and says `pointerlockchange` later - and `releaseLook` lets go
// only of a lock that is HELD. Since "Travel is the Overworld now", a journey begun or resumed on the map raises the
// view on the frame after the map goes down (world.js tvJourneyUp), and that is the very frame whose look gate, on
// the window's close edge, asks for the lock back. The rise frees the cursor (world.js freeCursor: the flag up and
// `releaseLook()`), finds nothing locked yet, and the lock lands a moment later under a view whose cursor is its own:
// the mouse captured, Y refused (the toggle stands down while the view is up - TV1), and only the browser's own
// Escape, which ends any lock, gave it back. The map's Overworld button never raced: its commit raises the view a
// frame BEFORE the look gate's relock, which the freed cursor then refuses.
//
// Driven through the real modules - player/pointerLock.js, scenes/travelView.js, the registry's own Y - with the
// world host's seams READ OUT OF THE SHIPPED SOURCE and run (its cursor toggle, the view's freeCursor, the map's
// Overworld door, the journey's rise), against a browser just real enough: listeners in the order they were added,
// the focus, and a lock granted a task late and let go at once (both measured in Chromium).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindCursorToggle, makeLookGate, requestLook, releaseLook, cursorActive, setCursorActive } from '../../src/player/pointerLock.js';
import { overlayOpen } from '../../src/ui/enhanced/enhancedOverlays.js';
import { createTravelView } from '../../src/scenes/travelView.js';
import { TV_RISE_S, TV_FALL_S, forwardOf } from '../../src/player/travelCamera.js';
import { actionsOf, setBindings } from '../../src/ui/input.js';
import { createBindings, resetDefaults } from '../../src/systems/inputActions.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');

/** One piece of the shipped source, found by its pattern (group 1), or the pin says what moved. */
function grab(src, re, what) {
  const m = re.exec(src);
  assert.ok(m, `${what} is no longer where this pin reads it`);
  return m[1];
}
const TOGGLE = /\n\s*bindCursorToggle\(canvas, (\(\) => [^\n]*?), (\(e\) => actionsOf\(e, keys\))\);/;

/** A browser just real enough for the lock: a window and a document, their listeners run in the order they were
 *  added, and THE BROWSER'S OWN QUEUE - a lock is granted there, never inside the request, and an exit lets go at once
 *  and says so a task later (measured in headless Chromium, 2026-09-29: straight after the request `pointerLockElement`
 *  is still null, then `pointerlockchange` with the lock; straight after `exitPointerLock()` it is null, then the
 *  change). */
/** ONE PAGE's listeners for the whole file: what a module binds once a page (AUDIT OW5 V1's pointerlockchange, bound
 *  at the first lock request - the law this file pins, which landed on main beside FB0929's copy and took its place)
 *  stays bound from one pin to the next, as a page keeps it. A host's own binds are unbound by the pin that made them. */
const PAGE = { W: [], D: [] };
function browser() {
  const saved = { add: globalThis.addEventListener, remove: globalThis.removeEventListener, doc: globalThis.document, hadDoc: 'document' in globalThis, KE: globalThis.KeyboardEvent };
  const { W, D } = PAGE, tasks = [];
  const on = (list) => ({
    addEventListener(type, fn, opt) { list.push({ type, fn, capture: opt === true || !!opt?.capture }); },
    removeEventListener(type, fn, opt) { const c = opt === true || !!opt?.capture; const i = list.findIndex((l) => l.type === type && l.fn === fn && l.capture === c); if (i >= 0) list.splice(i, 1); },
  });
  const run = (list, e) => { for (const l of list.filter((x) => x.type === e.type)) { if (e.stopped) break; l.fn(e); } };
  const change = () => run(D, { type: 'pointerlockchange' });
  const canvas = {
    requests: 0,
    contains: (t) => t === canvas,
    requestPointerLock() {
      canvas.requests++;
      return new Promise((resolve) => { tasks.push(() => { doc.pointerLockElement = canvas; change(); resolve(); }); });
    },
  };
  const doc = {
    ...on(D),
    pointerLockElement: null, visibilityState: 'visible', hasFocus: () => true,
    dispatchEvent(e) { run(D, e); run(W, e); return true; },   // ESC-LOCK's delivery, should one come
    exitPointerLock() { if (!doc.pointerLockElement) return; doc.pointerLockElement = null; tasks.push(change); },
  };
  const win = on(W);
  globalThis.document = doc;
  globalThis.addEventListener = win.addEventListener;
  globalThis.removeEventListener = win.removeEventListener;
  globalThis.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); this.isTrusted = false; } };
  return {
    canvas, doc, win,
    /** The browser's queue, run dry - a grant, and every change it says. */
    flush() { while (tasks.length) tasks.shift()(); },
    /** A key the player pressed, through the window's capture listeners in the order they were added. */
    press(code) {
      const e = { type: 'keydown', code, key: code, isTrusted: true, repeat: false, target: null, preventDefault() {}, stopImmediatePropagation() { e.stopped = true; }, stopPropagation() { e.stopped = true; } };
      run(W.filter((l) => l.capture), e);
    },
    restore() {
      globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.remove; globalThis.KeyboardEvent = saved.KE;
      if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    },
  };
}

const defaults = () => { const b = createBindings(); resetDefaults(b); setBindings(b); return b; };

/** The world host, as far as this bug reaches: its cursor toggle bound at boot, its look gate, the view with the
 *  host's own freeCursor, the map's Overworld door and the journey's rise - each read out of world.js and run. */
function worldHost(b) {
  const w = { paused: false, journey: false, travelView: null };
  const scope = {
    canvas: b.canvas, keys: new Set(), actionsOf,
    cursorActive, setCursorActive, releaseLook, requestLook, overlayOpen,
    gamePaused: () => w.paused, modes: { modalWindowUp: () => false }, pointerSurfaces: new Set(), tvCursorWas: false,
    get travelView() { return w.travelView; },
    poiEditor: null,   // PIN MOVED (AUDIT POI E1): the toggle's predicate reads the POI editor's slot too - no editor in this world
    isEnhanced: () => true,
    tvOwnsJourneys: () => true,   // OW-TOGGLE's switch off, its default: the Overworld owns a map's journey
    travelOptions: { get isTravelActive() { return w.journey; }, get state() { return { autopilot: w.journey ? {} : null }; } },
    duelEnemyNear: () => false, areEnemiesNearby: () => false, exteriorFoePool: () => [], wildSeen: (foes) => foes, navalHostileNear: () => false, travelViewAllowed: () => ({ ok: true }),   // TIME-DILATION: no hostile ship
  };
  const run = (src) => new Function('__s', `with (__s) { return (${src}); }`)(scope);
  const toggleSrc = TOGGLE.exec(WORLD);
  assert.ok(toggleSrc, 'the world host\'s cursor toggle is no longer where this pin reads it');
  const off = bindCursorToggle(b.canvas, run(toggleSrc[1]), run(toggleSrc[2]));
  const freeCursor = run(grab(WORLD, /\n\s*freeCursor: (\(free\) => \{[^\n]*?\} \}),/, 'the view\'s freeCursor'));
  const onTravelView = run(grab(WORLD, /\n\s*onTravelView: (\(\) => \{ travelView\?\.enter\(\); \}),/, 'the map\'s Overworld door'));
  const tvJourneyUp = run(`(() => { ${grab(WORLD, /\n(  function tvJourneyUp\(\) \{[\s\S]*?\n  \})\n/, 'tvJourneyUp')}\n return tvJourneyUp; })()`);
  w.travelView = createTravelView({
    canvas: b.canvas, win: b.win,
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0, 0) }), yaw: () => 0, setYaw: () => {},
    heightAt: () => 0, cloudBase: () => null, allowed: () => ({ ok: true }), windowUp: () => w.paused, danger: () => false,
    actionsOf: (e) => actionsOf(e, scope.keys), movementHeld: () => false, autopilot: () => w.journey, holdBody: () => true,
    freeCursor, onLower: () => { w.journey = false; },   // OW-ONLY: brought down, the journey stops (the map offers Resume)
    schedule: () => null, cancel: () => {},   // the heartbeat: every frame here is drawn
  });
  const lookGate = makeLookGate(b.canvas);
  /** One exterior frame's two lines this bug lives between, in world.js's own order (pinned below), and the view's. */
  const frame = () => { lookGate(w.paused); tvJourneyUp(); w.travelView.frame(1 / 60); };
  return { w, frame, onTravelView, off };
}

test('FB0929: the mouse is free on the Overworld from its first frame, whichever way the view rose - a journey from the map (Begin, Resume) or the map\'s own Overworld button - and Y toggles the look again once the view is down', () => {
  // the producer's own answer: Y is FreeMouse in the registry, before anything below leans on it
  defaults();
  assert.deepEqual(actionsOf({ code: 'KeyY' }), ['FreeMouse']);
  const ways = {
    // the map's Begin or its Resume: the walk begins as the sheet goes down, and the view rises on the NEXT frame -
    // the frame whose look gate asks for the lock on the map's close edge
    'a journey from the map': (h) => { h.w.journey = true; },
    // the Overworld button (or KeyO on the sheet): the commit raises the view itself, the frame before the look gate's
    'the map\'s Overworld button': (h) => { h.onTravelView(); },
  };
  for (const [way, commit] of Object.entries(ways)) {
    const b = browser();
    try {
      defaults();
      const h = worldHost(b);
      h.w.paused = true;   // the map is up: a window frees the cursor
      h.frame();
      commit(h);           // the sheet down, the commit (heldMap _fireCommit)...
      h.w.paused = false;  // ...and the window gone
      h.frame();           // the look gate's close edge, then the journey's rise
      b.flush();           // the browser answers the request
      assert.equal(h.w.travelView.active, true, `${way}: the view is up`);
      assert.equal(cursorActive(), true, `${way}: the view's cursor is free`);
      assert.equal(b.doc.pointerLockElement, null, `${way}: and the POINTER with it - no lock landed under the Overworld (the report: the mouse captured until the browser's own Escape)`);
      for (let t = 0; t < TV_RISE_S + 0.1; t += 1 / 60) h.frame();
      assert.equal(h.w.travelView.state, 'up');
      assert.equal(b.doc.pointerLockElement, null, `${way}: up, still free`);
      // Y under the view: the cursor is already free, and the toggle never takes the view's cursor back (TV1)
      const asked = b.canvas.requests;
      b.press('KeyY');
      b.flush();
      assert.equal(cursorActive(), true, `${way}: Y leaves the view's cursor free`);
      assert.equal(b.canvas.requests, asked, `${way}: and asks for no lock under the view`);
      assert.equal(b.doc.pointerLockElement, null);
      // the way down hands the look back, and that lock - asked for with the cursor taken - holds
      h.w.travelView.exit('button');
      for (let t = 0; t < TV_FALL_S + 0.1 && h.w.travelView.active; t += 1 / 60) h.frame();
      assert.equal(h.w.travelView.active, false, `${way}: down`);
      b.flush();
      assert.equal(cursorActive(), false, `${way}: the cursor as the view found it`);
      assert.equal(b.doc.pointerLockElement, b.canvas, `${way}: the look back - a lock that lands with the cursor taken is kept`);
      // and Y is the mouse's again, as everywhere else: free, then the look, one press each
      b.press('KeyY'); b.flush();
      assert.equal(b.doc.pointerLockElement, null, `${way}: Y frees the mouse`);
      b.press('KeyY'); b.flush();
      assert.equal(b.doc.pointerLockElement, b.canvas, `${way}: Y takes the look back`);
      h.w.travelView.dispose();
      h.off();
    } finally {
      b.restore();
      setCursorActive(false);
      setBindings(null);
    }
  }
});

test('FB0929: THE LAW, in every host that binds the toggle - a lock that lands after the cursor was freed is let go (Y pressed while a relock is still in flight); one that lands with the cursor taken is kept', () => {
  const b = browser();
  try {
    defaults();
    const off = bindCursorToggle(b.canvas, () => false, (e) => actionsOf(e, new Set()));   // a host with nothing up
    requestLook(b.canvas);
    b.flush();
    assert.equal(b.doc.pointerLockElement, b.canvas, 'the look: a lock asked for with the cursor taken is kept');
    b.press('KeyY'); b.flush();
    assert.equal(b.doc.pointerLockElement, null, 'Y frees the mouse');
    b.press('KeyY');   // the look asked back...
    assert.equal(cursorActive(), false);
    b.press('KeyY');   // ...and freed again before the browser answered
    assert.equal(cursorActive(), true);
    b.flush();
    assert.equal(b.doc.pointerLockElement, null, 'the lock that landed after Y freed the cursor is let go - the flag and the pointer agree');
    b.press('KeyY'); b.flush();
    assert.equal(cursorActive(), false);
    assert.equal(b.doc.pointerLockElement, b.canvas, 'and ONE press of Y takes the look back');
    off();
  } finally {
    b.restore();
    setCursorActive(false);
    setBindings(null);
  }
});

test('FB0929 by source: the order the first pin drives is world.js\'s own frame - the look gate\'s relock, then the journey\'s rise; and the law is the toggle\'s, so it holds in each of the four hosts (THE FOUR HOSTS RULE)', () => {
  const f = WORLD.slice(WORLD.indexOf('  function frame(now) {'));
  const gate = f.indexOf('\n    lookGate(gamePaused());'), rise = f.indexOf('\n    tvJourneyUp();');
  assert.ok(gate > 0 && rise > gate, 'the look gate asks for the lock, then the journey raises the view - one frame');
  // world.js (the Overworld's one host; its interiors and dungeons, worldModes.js and dungeonContext.js, run under
  // its binding), exterior.js, and dungeon.js (the ?dungeon host's dungeonContext) each bind the toggle once
  for (const f2 of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    assert.equal((read(f2).match(/\n\s*bindCursorToggle\(canvas, /g) ?? []).length, 1, `${f2} binds the toggle - the law reaches its lock`);
  }
  for (const f2 of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(read(f2), /bindCursorToggle\(/, `${f2} runs under its host's binding - no second reader over the flag`);
  }
});
