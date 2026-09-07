// ROAD-H - THE RESIDUE AND THE PINS (2026-09-07).
//
// AUDIT 62 closed with a list under "What was left, and by whose
// decision". Three of its rows are code, not judgement calls, and this
// file is their gate:
//
//   H5   world.js's keydown ladder carried TWO byte-identical
//        `act === 'Rest'` arms in one block. The second could never
//        run. Deleted, its comment's substance folded into the first.
//   H7b  the port's LightningFlash carries the mod's `Time.timeScale`
//        as an option and no pin ever drove it off 1, so five of the
//        mod's own arithmetic sites were pinned only in the case where
//        the scale disappears.
//   H8   the touch layer's HELD controls learned not to lift a key
//        another live control still owns (AUDIT 62 F8's review); its
//        MOMENTARY (tap) controls never did, and a tap's keyup does not
//        pass through `up()`, so it never met that guard.
//
// A PIN MUST FAIL under a mutation that reverts the fix, and it pins
// the REFERENCE's value, never a restatement of the port. Every test
// below names the mutant that kills it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dfuFile, missingDfu } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone
import { LightningFlash } from '../src/systems/dynamicSkies.js';
import { attachTouch } from '../src/ui/touch.js';
import { setBindings } from '../src/ui/input.js';
import {
  createBindings, setBinding, getBinding, loadKeyBinds, resetDefaults,
} from '../src/systems/inputActions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// ---------------------------------------------------------------
// H5 - THE DEAD REST ARM
// ---------------------------------------------------------------

test('ROAD-H H5: no host\'s keydown ladder carries the same action arm twice (mutant: paste any `if (act === ...)` line back a second time)', () => {
  // The defect was two byte-identical
  // `if (act === 'Rest') { e.preventDefault(); hudCtx.toggleRest(); return; }`
  // lines fourteen apart in ONE block of `scenes/world.js`. Every arm
  // in these ladders `return`s, so a second copy of a line that is
  // already above it is unreachable by construction - there is no
  // reading of the port under which it can fire, and no reading of
  // GameManager's dispatch (an `else if` chain, :515-560) under which
  // an action is tested twice. Swept as the CLASS, over the whole
  // tree, because one duplicate is a typo and the shape is what rots:
  // the dead copy is where a later reader lands, and the comment on it
  // is the one that gets updated.
  const files = [];
  const walk = (rel) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${rel}/${e.name}`);
      else if (e.name.endsWith('.js')) files.push(`${rel}/${e.name}`);
    }
  };
  walk('src');
  assert.ok(files.length > 100, 'the sweep found no source tree to read');
  const dupes = [];
  for (const f of files) {
    const seen = new Map();
    read(f).split('\n').forEach((l, i) => {
      const m = /^\s*if \(act === '[A-Za-z]+'\)/.exec(l);
      if (!m) return;
      const key = l.trim();
      if (seen.has(key)) dupes.push(`${f}:${seen.get(key) + 1} and :${i + 1} - ${key}`);
      else seen.set(key, i);
    });
  }
  assert.deepEqual(dupes, [], 'an action arm is written twice in one file; the second can never run');
  // ...and the survivor is the one the cites name, still carrying what
  // BOTH comments said: S40's binding and dispatch reference and the
  // U43 flag remark, which would otherwise have died with the copy.
  const w = read('src/scenes/world.js');
  assert.equal((w.match(/if \(act === 'Rest'\) \{ e\.preventDefault\(\); hudCtx\.toggleRest\(\); return; \}/g) ?? []).length, 1,
    'the world host has exactly one Rest arm');
  const comment = w.slice(w.lastIndexOf('// V5: Rest,'), w.indexOf("if (act === 'Rest')"));
  assert.match(comment, /InputManager\.cs:997/, 'S40\'s SetupDefaults cite survived the fold');
  assert.match(comment, /GameManager\.cs:534-537/, 'and its dispatch cite');
  assert.match(comment, /U43 flag/, 'and the U43 flag remark, which was the second comment\'s own');
  // the fixed-city host's single arm is the same law in the other
  // outdoor host (the two ladders; the interior and dungeon hosts
  // reach the action through routeAction's `case 'Rest'`)
  assert.equal((read('src/scenes/exterior.js').match(/if \(act === 'Rest'\)/g) ?? []).length, 1);
  assert.match(read('src/ui/input.js'), /case 'Rest': ctx\.toggleRest\?\.\(\); return true;/);
});

test('ROAD-H H5: the reference the folded comment names - R is Rest, and the dispatch tests it once, with no scene gate', {
  skip: missingDfu('Assets/Scripts/Game/InputManager.cs', 'Assets/Scripts/Game/GameManager.cs')
    && 'no DFU checkout (set DFU_PATH)',
}, () => {
  const im = readFileSync(dfuFile('Assets/Scripts/Game/InputManager.cs'), 'utf8').split('\n');
  assert.match(im[996], /setBinding\(KeyCode\.R, Actions\.Rest, true\);/,
    'InputManager.cs:997 is SetupDefaults\' Rest row');
  const gm = readFileSync(dfuFile('Assets/Scripts/Game/GameManager.cs'), 'utf8');
  const lines = gm.split('\n');
  assert.match(lines[533], /^\s*else if \(InputManager\.Instance\.ActionComplete\(InputManager\.Actions\.Rest\)\)$/,
    'GameManager.cs:534 is the Rest test, and it is a link in the else-if chain with no gate of its own');
  assert.match(lines[535], /dfuiOpenRestWindow/, ':536 posts the rest window');
  // ONCE - which is why a second arm in the port's ladder models
  // nothing at all.
  assert.equal((gm.match(/InputManager\.Actions\.Rest\)/g) ?? []).length, 1,
    'DFU tests Actions.Rest exactly once in the whole GameManager');
});

// ---------------------------------------------------------------
// H7b - LightningFlash's UNDRIVEN TIME SCALE
// ---------------------------------------------------------------

/** The mod draws Random.value / Random.Range in a fixed order; `seq`
 *  is dynamicSkies.test.js's own rng double. */
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const FLASH_ONCE_DRAWS = Array(16).fill(0.5);   // two FlashOnce bodies, 8 draws each

test('ROAD-H H7b: LightningFlash\'s timeScale is the mod\'s Time.timeScale - it DIVIDES both rolls (mutant: drop `/ this.timeScale` at either roll)', () => {
  // LightningFlash.cs:52  `if (Random.value < (0.5f / Time.timeScale))`
  // LightningFlash.cs:55  `if (Random.value < (0.33f / Time.timeScale))`
  // The port carries the divisor as a constructor option and NOTHING
  // in this suite ever built one at anything but 1, where `x / 1 === x`
  // - so both divides were unpinned: `0.5 / t`, `0.5 * t` and a bare
  // `0.5` are the same expression at t = 1. Driven at 2, where the
  // mod's own arithmetic puts the first gate at 0.25 and the second at
  // 0.165, and the three readings come apart.
  const at2 = (rolls) => new LightningFlash(seq(rolls), { timeScale: 2 });
  assert.equal(at2([0.25, 0.9, ...FLASH_ONCE_DRAWS]).startFlash([0, 0, 0]), false,
    '0.25 is not < 0.5/2: no flash');
  assert.equal(at2([0.24, 0.9, ...FLASH_ONCE_DRAWS]).startFlash([0, 0, 0]), true,
    '0.24 < 0.5/2: a flash');
  // the same roll at Time.timeScale 1 DOES fire - which is the whole
  // content of the divide, and what a `0.5` literal would erase
  assert.equal(new LightningFlash(seq([0.25, 0.9, ...FLASH_ONCE_DRAWS])).startFlash([0, 0, 0]), true,
    'unpaused (timeScale 1) the same 0.25 is < 0.5 and fires');
  // ...and a `*` instead of a `/` puts the gate at 1.0, where every
  // roll fires: 0.6 must not.
  assert.equal(at2([0.6, 0.9, ...FLASH_ONCE_DRAWS]).startFlash([0, 0, 0]), false,
    '0.6 is not < 0.5/2 - a multiply would have let it through');

  // The DOUBLE-flash gate, :55, read through the routine it picks: at
  // timeScale 2 the mod's single flash runs flashDuration * 2 = 0.4 s
  // (BLBSkybox.cs:183 sets flashDuration = 0.2f) and a double runs two
  // 0.2 s halves, so "still lit at 0.39 s" separates them.
  const single = at2([0.1, 0.165, ...FLASH_ONCE_DRAWS]);
  assert.equal(single.startFlash([0, 0, 0]), true);
  assert.ok(single.tick(0.05), 'lit on the entering frame');
  assert.ok(single.tick(0.2), 'still lit at 0.20 s - a double\'s first half is over by now');
  assert.ok(single.tick(0.19), 'still lit at 0.39 s: 0.165 is not < 0.33/2, so this is the SINGLE routine');
  assert.equal(single.tick(0.02), null, 'and dark past 0.41 s');
  const dbl = at2([0.1, 0.16, ...FLASH_ONCE_DRAWS]);
  assert.equal(dbl.startFlash([0, 0, 0]), true);
  assert.ok(dbl.tick(0.05), 'lit on the entering frame');
  assert.ok(dbl.tick(0.19), 'still lit at 0.19 s');
  assert.equal(dbl.tick(0.02), null, '0.16 < 0.33/2: a DOUBLE, whose first half ends at flashDuration * 2 / 2 = 0.2 s');
});

test('ROAD-H H7b: timeScale MULTIPLIES the duration and the gap (mutant: drop `* this.timeScale` at the single, the half or the 0.1 gap)', () => {
  // LightningFlash.cs:61  `StartCoroutine(FlashRoutine(flashDuration * Time.timeScale))`
  // LightningFlash.cs:77  `float halfDuration = flashDuration * Time.timeScale / 2f;`
  // LightningFlash.cs:79  `yield return new WaitForSeconds(0.1f * Time.timeScale);`
  // At timeScale 2, with BLBSkybox.cs:183's flashDuration = 0.2f, the
  // mod's numbers are 0.4 s, 0.2 s and a 0.2 s gap. Every one of the
  // three is 0.2 / 0.1 / 0.1 if the multiply is dropped, and the
  // frames below are chosen so each mutant reads differently.
  const at2 = (rolls) => new LightningFlash(seq(rolls), { timeScale: 2 });
  // :61 - the single, 0.4 s not 0.2 s
  const s = at2([0.1, 0.9, ...FLASH_ONCE_DRAWS]);
  s.startFlash([0, 0, 0]);
  assert.ok(s.tick(0.05), 'lit on the entering frame');
  assert.ok(s.tick(0.2), 'still lit at 0.20 s - flashDuration alone would be over');
  assert.ok(s.tick(0.19), 'still lit at 0.39 s');
  assert.equal(s.tick(0.02), null, 'dark past 0.41 s: the duration is flashDuration * timeScale');
  // :77 and :79 - the double's halves and the delay between them
  const d = at2([0.1, 0.1, ...FLASH_ONCE_DRAWS]);
  d.startFlash([0, 0, 0]);
  assert.ok(d.tick(0.05), 'lit on the entering frame');
  assert.ok(d.tick(0.19), 'the first half runs 0.2 s (flashDuration * timeScale / 2), not 0.1');
  assert.equal(d.tick(0.02), null, 'over at 0.21 s');
  assert.equal(d.tick(0.18), null, 'still dark 0.19 s into the gap - a bare 0.1 f would have re-lit by now');
  assert.ok(d.tick(0.02), 'the second half lights at the end of the 0.1 * timeScale gap');
  assert.ok(d.tick(0.19), 'and runs its own 0.2 s');
  assert.equal(d.tick(0.02), null, 'then dark');
  // the option's own default is the unpaused Unity value the mod reads
  assert.equal(new LightningFlash(() => 0.5).timeScale, 1, 'Time.timeScale is 1 while the game runs');
});

// ---------------------------------------------------------------
// H8 - THE TOUCH CODE-LIFT GUARD (a TI1 departure; DFU has no touch)
// ---------------------------------------------------------------
//
// The layer is DOM, so it is driven against a STUB document, the shape
// audit62_touch.test.js uses: real listeners, real synthesized
// KeyboardEvents, the real binding registry.
function stubEl() {
  const n = {
    id: '', textContent: '', children: [], _l: new Map(),
    style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
  return n;
}
const tev = (type, touches, t) => ({
  type, timeStamp: t, preventDefault() {}, stopPropagation() {},
  changedTouches: touches.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })),
});
/** AUDIT 62 (review)'s rule: every layer attached here is disposed in a
 *  `finally`, or the nav row's live setInterval hangs the runner. */
function withTouchDom(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const keys = [];
  const live = [];
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { keys.push(e); return true; }, prompt: () => null };
  const attach = (canvas, hooks) => { const h = attachTouch(canvas, hooks); live.push(h); return h; };
  try { return fn(keys, attach); } finally {
    for (const h of live) h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
  }
}
function defaultStore() {
  const b = createBindings();
  for (const [c, a] of [['Escape', 'Escape'], ['KeyW', 'MoveForwards'], ['KeyS', 'MoveBackwards'],
    ['KeyA', 'MoveLeft'], ['KeyD', 'MoveRight'], ['Space', 'Jump'], ['ShiftLeft', 'Run'],
    ['KeyZ', 'ReadyWeapon'], ['Mouse0', 'ActivateCenterObject']]) setBinding(b, c, a);
  return b;
}
const btn = (h, label) => h.el.children.find((c) => c.textContent === label);
const log = (keys, type) => keys.filter((e) => e.type === type).map((e) => e.code);

test('ROAD-H H8: a TAP button never lifts a key the stick is still holding - the menu\'s combo shares Run\'s modifier (mutant: `synth(\'keyup\', k)` unguarded in tapCodes)', () => {
  // TI1 DEPARTURE, recorded under UI-Arc's TI1 sections: DFU has no
  // touch layer, so there is no reference line to restore. What there
  // is, is the invariant the SYNTHESIS creates and a keyboard cannot
  // break - one physical key cannot be pressed while it is already
  // held - and AUDIT 62 F8's review already wrote it for the held
  // controls: "the held set is the UNION of what the live controls
  // want, and a release subtracts only its own". The tap path had no
  // such subtraction: it calls `synth` directly, so it never passes
  // `up()`'s guard at all.
  //
  // The shape is ordinary, not an exotic rebind. Escape as a combo
  // ('ShiftLeft+F10') decomposes to ShiftLeft + F10 (GetCombo,
  // InputManager.cs:1195-1207) and ShiftLeft is Run's DEFAULT
  // (SetupDefaults) - the controls window flags no duplicate, because
  // there is none.
  withTouchDom((keys, attach) => {
    const store = defaultStore();
    setBinding(store, 'ShiftLeft+F10', 'Escape');
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {} });
    canvas.fire('touchstart', tev('touchstart', [[1, 200, 300]], 0));
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 220]], 20));   // full throw: forward + Run
    assert.deepEqual(log(keys, 'keydown'), ['KeyW', 'ShiftLeft'], 'the stick holds the run modifier');
    keys.length = 0;
    btn(h, '≡').fire('touchstart', tev('touchstart', [], 40));
    assert.deepEqual(log(keys, 'keydown'), ['ShiftLeft', 'F10'], 'the menu presses its combo, modifier first');
    assert.deepEqual(log(keys, 'keyup'), ['F10'],
      'and lifts ONLY its own key - ShiftLeft stays down for the running stick');
    keys.length = 0;
    // the stick is still running: another move at the same throw is a
    // no-op precisely because nothing was lost.
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 221]], 60));
    assert.deepEqual(keys, [], 'nothing is re-pressed, because nothing was torn out');
    canvas.fire('touchend', tev('touchend', [[1, 200, 221]], 80));
    assert.deepEqual(log(keys, 'keyup').sort(), ['KeyW', 'ShiftLeft'], 'and the finger\'s lift still releases both');
  });
});

test('ROAD-H H8: the DIAL\'s literal Tab is the same law - `setBinding` cannot steal a code that is in no binding table (mutant: as above)', () => {
  // Tab is not an InputManager action (inputActions ACTIONS), so the
  // dial speaks it raw and NOTHING stops a player binding a move axis
  // to Tab: `setBinding` only steals codes out of the two dicts, and
  // Tab is in neither. This is the plain, non-combo shape of the same
  // collision.
  withTouchDom((keys, attach) => {
    const store = defaultStore();
    setBinding(store, 'Tab', 'MoveForwards');
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {}, dial: true });
    canvas.fire('touchstart', tev('touchstart', [[1, 200, 300]], 0));
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 260]], 20));   // forward, under the run throw
    assert.deepEqual(log(keys, 'keydown'), ['Tab'], 'forward is Tab now');
    keys.length = 0;
    btn(h, '◆').fire('touchstart', tev('touchstart', [], 40));
    assert.deepEqual(log(keys, 'keydown'), ['Tab'], 'the dial still gets its down edge - the button is not made dead');
    assert.deepEqual(log(keys, 'keyup'), [], 'and the walk is not cancelled under the finger');
    keys.length = 0;
    canvas.fire('touchend', tev('touchend', [[1, 200, 260]], 60));
    assert.deepEqual(log(keys, 'keyup'), ['Tab'], 'the holder is still the one that lets go');
  });
});

test('ROAD-H H8: a HELD button and a stick axis on the SAME resolved code do not lift each other, either way (mutant: `upCode(c)` with no keep set, at the button or at setStickKey)', () => {
  // AUDIT 62 F8's review pinned this for a COMBO share; the direct
  // share is the case its own closing note named and left open. It is
  // reachable without a combo: `GetKey` falls through to the SECONDARY
  // dict (InputManager.cs:1084) and `codeFor` follows it, so an action
  // with no primary row resolves to whatever the secondary holds. One
  // code CAN sit in BOTH dicts at once - but only by one route, and it
  // is not the one the rebind window uses.
  //
  // NOT `SetBinding`, which forbids the pair on purpose: it steals the
  // code out of the OTHER dict FIRST - `var alt = primary ?
  // secondaryActionKeyDict : actionKeyDict; if (alt.ContainsKey(code))
  // alt.Remove(code);` (InputManager.cs:730-734), ported at
  // inputActions.js:268-269 - so EITHER order collapses it.
  const collapse = defaultStore();
  setBinding(collapse, 'ShiftLeft', 'Jump', false);
  assert.equal(collapse.primary.get('ShiftLeft'), undefined,
    'a SECONDARY write\'s alt is the PRIMARY dict: Run\'s row is removed (InputManager.cs:734)');
  assert.equal(collapse.secondary.get('ShiftLeft'), 'Jump');
  const reverse = defaultStore();
  reverse.secondary.set('ShiftLeft', 'Jump');
  setBinding(reverse, 'ShiftLeft', 'Run', true);
  assert.equal(reverse.secondary.get('ShiftLeft'), undefined,
    'and a PRIMARY write removes the secondary row, by the same line');

  // The route that DOES produce it is the LOAD path, which is a raw
  // map-set with only a SAME-dict check: `if (!dict.ContainsKey(key)
  // && actionVal != Actions.Unknown) dict.Add(key, actionVal);`
  // (LoadActionKeybinds, InputManager.cs:1950-1969; loadActionKeybinds,
  // inputActions.js:385-395, whose own comment says "Raw map-set, NOT
  // setBinding"). A hand-edited KeyBindings.txt that puts Jump on the
  // run key as a SECONDARY - with the primary Space spent on something
  // else - loads exactly as written, and SURVIVES the startup autofill
  // that follows it, because TestSetBinding skips a default whose code
  // the dict already holds (InputManager.cs:1405-1422).
  withTouchDom((keys, attach) => {
    const store = createBindings();
    loadKeyBinds(store, {
      actionKeyBinds: {
        Escape: 'Escape', KeyW: 'MoveForwards', KeyS: 'MoveBackwards',
        KeyA: 'MoveLeft', KeyD: 'MoveRight', ShiftLeft: 'Run',
        Space: 'ReadyWeapon', Mouse0: 'ActivateCenterObject',
      },
      secondaryActionKeyBinds: { ShiftLeft: 'Jump' },
    });
    resetDefaults(store, true);   // LoadKeyBinds is followed by the autofill pass (:445-448)
    assert.equal(getBinding(store, 'Jump'), null,
      'Space is spent on ReadyWeapon, so the Jump default does not autofill: no primary row');
    assert.equal(getBinding(store, 'Jump', false), 'ShiftLeft',
      'Jump resolves to Run\'s key through the secondary dict (:1084)');
    assert.equal(store.primary.get('ShiftLeft'), 'Run',
      'and the same code is still Run in the primary dict - one code, both dicts');
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {} });
    // the stick first, then the button on top of it
    canvas.fire('touchstart', tev('touchstart', [[1, 200, 300]], 0));
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 220]], 20));
    assert.deepEqual(log(keys, 'keydown'), ['KeyW', 'ShiftLeft']);
    keys.length = 0;
    btn(h, '↑↑').fire('touchstart', tev('touchstart', [], 40));
    assert.deepEqual(keys, [], 'the button wants a key that is already down: nothing is re-pressed');
    btn(h, '↑↑').fire('touchend', tev('touchend', [], 60));
    assert.deepEqual(keys, [], 'and its release leaves the stick\'s key alone');
    // ...and the reverse: the button holds it, the stick lets go
    keys.length = 0;
    btn(h, '↑↑').fire('touchstart', tev('touchstart', [], 80));
    canvas.fire('touchend', tev('touchend', [[1, 200, 220]], 100));
    assert.deepEqual(log(keys, 'keyup'), ['KeyW'],
      'the stick lifts its own axis and leaves the code the button is holding');
    btn(h, '↑↑').fire('touchend', tev('touchend', [], 120));
    assert.deepEqual(log(keys, 'keyup'), ['KeyW', 'ShiftLeft'], 'the last holder lets it go');
  });
});

test('ROAD-H H8: the tap guard reads the layer\'s OWN held latch (mutant: a SECOND set kept in lock-step by down/up, with tapCodes guarded on that one)', () => {
  // The three drives above see WHETHER the tap keyup is dropped. What
  // they cannot see is WHICH set decided it: a duplicate latch written
  // in lock-step by `down`/`up` passes every one of them and rots the
  // moment a fourth writer touches only one of the two. So the read
  // here is the one thing behaviour cannot reach - the name the tap
  // guard consults IS the name `down` adds to and `up` deletes from,
  // and the tap path consults no other - and it is read structurally,
  // not as source text, so a reformat or a rename of `ks` is silent.
  const t = read('src/ui/touch.js');
  const dm = /const down = \(code\) =>[\s\S]{0,160}?!(\w+)\.has\(code\)/.exec(t);
  const um = /const up = \(code\) =>[\s\S]{0,160}?(\w+)\.has\(code\)/.exec(t);
  assert.ok(dm && um, 'the layer still keeps its down/up latch pair');
  assert.equal(dm[1], um[1], '`down` and `up` maintain ONE set');
  const body = /const tapCodes = \([^)]*\) => \{([\s\S]*?)\};/.exec(t);
  assert.ok(body, 'tapCodes is still the single tap path');
  const consulted = [...new Set([...body[1].matchAll(/(\w+)\.has\(/g)].map((m) => m[1]))];
  assert.deepEqual(consulted, [dm[1]], `the tap keyup guard reads \`${dm[1]}\` and nothing else`);
  assert.match(body[1], /synth\('keydown'/, 'the DOWN edge is unguarded - the button is not made dead');
  assert.match(t, /const tap = \(code\) => tapCodes\(/, 'the literal taps go through it');
  assert.match(t, /const tapAction = \(action\) => tapCodes\(/, 'and the action taps');
});
