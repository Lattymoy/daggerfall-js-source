// AUDIT DISC28 (2026-09-28, the pre-merge audit of the 2026-09-28 Discord batch, before the merge): THE PAUSE KEY'S
// TWO EDGES - the ui lane's fixes to DISC28-A.
//
// UI-1: a pause moved to a Ctrl/Alt COMBO, or to a bare Ctrl or Alt key, opened the pause screen through the host's
// read (ui/input.js actionsOf, the held ring and its latch) and could not close it. The enhanced face refused every
// Ctrl/Alt key before it asked what the key meant; the classic window compared the press's bare code with GetBinding's
// answer, which for a combo ('AltLeft+KeyP') is never a press's code ('KeyP'). Both now read the EVENT (eventMeans -
// DFU's GetKeyUp(toggleClosedBinding) answers a combo through GetUnaryKey, its modifier held); every other Ctrl/Alt
// chord is still refused on the face.
//
// UI-2: DFU closes the pause window on the RELEASE (DaggerfallPauseOptionsWindow.Update: GetKeyUp(toggleClosedBinding)
// || GetBackButtonUp()) and a held key never repeats there. The enhanced face answered on the PRESS and on every
// auto-repeat of the literal Escape - so with the shipped binding the held Escape that opened the face closed it on its
// first repeat, and the press that closed it went on repeating into a host with no screen up. The face now arms on a
// press it saw, swallows every repeat and answers on that press's release; the release of the press that OPENED it
// (the host's) is left alone. The classic window's deferred close (DaggerfallAutomapWindow.Update's
// isCloseWindowDeferred, armed on GetKeyDown) armed on the opening press's repeats and closed on its release: it arms
// on a press alone now.
//
// Every pin drives the real modules over the table the game mints (resetDefaults) and fails on the tree before the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keydown, keyup, windowListenerCount } from '../chargenDom.mjs';
import { createBindings, resetDefaults, setBinding } from '../../src/systems/inputActions.js';
import { setBindings, actionsOf } from '../../src/ui/input.js';
import { mountEnhancedMenu } from '../../src/ui/enhanced/enhancedMenu.js';
import { PauseOptionsWindow } from '../../src/ui/pauseWindow.js';

console.warn = () => {};

/** The shipped table, with the pause moved to `code` (the Controls pane's replace), or left where it ships. */
function table(code = null) {
  const store = createBindings();
  resetDefaults(store);
  if (code) setBinding(store, code, 'Escape');
  setBindings(store);
  return store;
}
function face(code = null, at = null) {
  table(code);
  const acts = [];
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: (a) => acts.push(a), at });
  return { acts, menu };
}
const sectionNow = () => JSON.parse(globalThis.__menu()).section;
/** The host's read of a press, as world.js's ladder makes it: the ring filled key by key, the latch polled each time. */
function hostMeans(keys) {
  const ring = new Set();
  let acts = [];
  for (const k of keys) { ring.add(k.code); acts = actionsOf(k, ring); }
  return acts;
}

test('AUDIT DISC28 UI-1: a pause moved to a Ctrl/Alt combo or a bare Ctrl/Alt key closes the pause face that key opened - and every other Ctrl/Alt chord is still refused (mutant: the chord refused before the pause key is read)', () => {
  for (const [code, mod, flag] of [['ControlLeft+KeyP', 'ControlLeft', 'ctrlKey'], ['AltLeft+KeyP', 'AltLeft', 'altKey']]) {
    const { acts, menu } = face(code);
    assert.ok(hostMeans([{ code: mod, key: mod, [flag]: true }, { code: 'KeyP', key: 'p', [flag]: true }]).includes('Escape'),
      `${code}: the host opens the pause on it`);
    const down = keydown('KeyP', undefined, { key: 'p', [flag]: true });
    const up = keyup('KeyP', undefined, { key: 'p', [flag]: true });
    assert.deepEqual(acts, ['resume'], `${code}: and the face closes on it`);
    assert.equal(down.stopped && up.stopped, true, `${code}: the screen's key, both edges`);
    menu.unmount();
  }
  {
    const { acts, menu } = face('ControlRight');
    assert.ok(hostMeans([{ code: 'ControlRight', key: 'Control', ctrlKey: true }]).includes('Escape'), 'a bare Ctrl: the host opens on it');
    keydown('ControlRight', undefined, { key: 'Control', ctrlKey: true });
    keyup('ControlRight', undefined, { key: 'Control' });
    assert.deepEqual(acts, ['resume'], 'a bare Ctrl closes the face (its own keydown carries ctrlKey)');
    menu.unmount();
  }
  {
    const { acts, menu } = face('AltLeft+KeyP');
    const esc = keydown('Escape', undefined, { key: 'Escape', ctrlKey: true });
    keyup('Escape', undefined, { key: 'Escape', ctrlKey: true });
    const q = keydown('KeyQ', undefined, { key: 'q', altKey: true });
    assert.deepEqual(acts, [], 'Ctrl+Escape and Alt+Q mean nothing to the pause - refused, as ever');
    assert.equal(esc.stopped || q.stopped, false, 'and left to the page');
    menu.unmount();
  }
});

test('AUDIT DISC28 UI-1: the classic window closes on the pause action\'s key read off the event - a combo on its press and on its release, its modifier held as GetKeyUp\'s combo wants (mutant: the bare-code compare)', () => {
  table('AltLeft+KeyP');
  const w = new PauseOptionsWindow({});
  w.input('AltLeft', { code: 'AltLeft', key: 'Alt', altKey: true });
  w.keyup('AltLeft', { code: 'AltLeft', key: 'Alt' });
  assert.equal(w.done, false, 'the modifier alone is not the pause');
  w.input('KeyP', { code: 'KeyP', key: 'p', altKey: true });
  w.keyup('KeyP', { code: 'KeyP', key: 'p', altKey: true });
  assert.equal(w.done, true, 'Alt+P, pressed and released, closes the classic window it opened');
  const early = new PauseOptionsWindow({});
  early.input('KeyP', { code: 'KeyP', key: 'p', altKey: true });
  early.keyup('KeyP', { code: 'KeyP', key: 'p' });
  assert.equal(early.done, false, 'released after its modifier: no combo on that release, as DFU\'s GetUnaryKey reads it');
  table('ControlLeft+KeyP');
  const ctrl = new PauseOptionsWindow({});
  ctrl.input('KeyP', { code: 'KeyP', key: 'p', ctrlKey: true });
  ctrl.keyup('KeyP', { code: 'KeyP', key: 'p', ctrlKey: true });
  assert.equal(ctrl.done, true, 'Ctrl+P the same');
  setBindings(null);
});

test('AUDIT DISC28 UI-2: on the pause face a back or pause key\'s auto-repeat does nothing and the close waits for the release of a press the face saw - the shipped Escape and a rebound key alike (mutants: the press acts; a repeat arms)', () => {
  for (const [code, key] of [['Escape', 'Escape'], ['KeyP', 'p']]) {
    const { acts, menu } = face(code === 'Escape' ? null : code);
    // the press that OPENED the face, still held: the host's press, the host's release
    const reps = [1, 2].map(() => keydown(code, undefined, { key, repeat: true }));
    assert.deepEqual(acts, [], `${code}: the held key that opened the face does not close it`);
    assert.ok(reps.every((r) => r.stopped), `${code}: its repeats are swallowed`);
    const openUp = keyup(code, undefined, { key });
    assert.deepEqual(acts, [], `${code}: nor does that press's release`);
    assert.equal(openUp.stopped, false, `${code}: which is the host's, which saw its press`);
    // a press the face saw: armed on the press, answered on the release, nothing in between
    const down = keydown(code, undefined, { key });
    assert.deepEqual(acts, [], `${code}: the press arms - DaggerfallPauseOptionsWindow closes on GetKeyUp`);
    const held = [1, 2, 3].map(() => keydown(code, undefined, { key, repeat: true }));
    assert.deepEqual(acts, [], `${code}: held, nothing`);
    const up = keyup(code, undefined, { key });
    assert.deepEqual(acts, ['resume'], `${code}: the release closes it, once`);
    assert.ok([down, ...held, up].every((ev) => ev.stopped), `${code}: every edge of that press is the screen's - none of it reaches a host with no screen up`);
    menu.unmount();
  }
});

test('AUDIT DISC28 UI-2: an inner layer backs out on the release too, a press armed on one visit is never answered on the next, and the release listener has one owner (mutants: no keyup listener; the arm outliving the visit; the listener outliving the screen)', () => {
  const before = windowListenerCount('keyup');
  const { acts, menu } = face(null, 'about');
  assert.equal(windowListenerCount('keyup'), before + 1, 'the face hears the release');
  assert.equal(sectionNow(), 'about');
  keydown('Escape', undefined, { key: 'Escape' });
  assert.equal(sectionNow(), 'about', 'the press arms');
  keyup('Escape', undefined, { key: 'Escape' });
  assert.equal(sectionNow(), 'home', 'its release backs the section out to the face');
  keydown('Escape', undefined, { key: 'Escape' });
  menu.unmount();
  assert.equal(windowListenerCount('keyup'), before, 'and the teardown takes that listener with it');
  const next = face();
  const up = keyup('Escape', undefined, { key: 'Escape' });
  assert.deepEqual([...acts, ...next.acts], [], 'the last visit\'s press closes nothing on this one');
  assert.equal(up.stopped, false);
  next.menu.unmount();
  // ...and the boot door is no DFU window: it answers on the press, as it always has - the menu pad's Back
  // (ui/menu/menuPad.js) sends a press alone
  const boot = mountEnhancedMenu(globalThis.document.createElement('div'), { mode: 'boot', hooks: {}, onAction: () => {}, at: 'about' });
  assert.equal(sectionNow(), 'about');
  keydown('Escape', undefined, { key: 'Escape' });
  assert.equal(sectionNow(), 'home', 'the boot door backs out on the press');
  boot.unmount();
});

test('AUDIT DISC28 UI-2: the classic window arms its deferred close on a PRESS alone - a held opening press, released, leaves it open (mutant: a repeat arms)', () => {
  for (const code of ['Escape', 'KeyP']) {
    table(code === 'Escape' ? null : code);
    const w = new PauseOptionsWindow({});
    w.input(code, { code, key: code, repeat: true });
    w.input(code, { code, key: code, repeat: true });
    w.keyup(code, { code, key: code });
    assert.equal(w.done, false, `${code}: the press that opened the window, held and let go, does not close it`);
    w.input(code, { code, key: code });
    w.keyup(code, { code, key: code });
    assert.equal(w.done, true, `${code}: a press it saw, released, does`);
  }
  setBindings(null);
});

// UI-7 (found by the ui lane, older than the batch): THE OUTDOOR LADDERS' PRESS EDGE. world.js and exterior.js run
// their own key ladders (no routeKey), and AUDIT KB1's repeat guard stood at their TAIL, below the arms written inline
// above it - so a held F9 quicksaved on every repeat (the tail's own note says it cannot), a held Q recast, and a key
// whose window shut on its press (F5's page) opened it again on the next repeat. The guard is the ladder's first act
// now, as routeKey's routeKeyAction has it; and both F11 arms (under a window and outdoors) load once per press. Run
// out of the live source: the function text as written, over a scope whose other names are inert.
import { readFileSync } from 'node:fs';
import { POLLED_ACTIONS, QUICKSLOT_ACTIONS } from '../../src/ui/input.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The `{...}` that follows `opener` in `text`, comments and strings skipped. */
function blockAfter(text, opener) {
  const i = text.indexOf(opener);
  assert.ok(i >= 0, `could not find ${opener}`);
  const open = text.indexOf('{', i + opener.length);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); continue; }
    if (c === '/' && text[k + 1] === '*') { k = text.indexOf('*/', k) + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  throw new Error(`unbalanced block after ${opener}`);
}
const INERT = new Proxy(function inert() {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 'INERT' : INERT), apply: () => INERT });
// eslint-disable-next-line no-new-func
const runIn = (code, env) => new Function('__scope', `with (__scope) { return (${code}); }`)(new Proxy({ undefined, ...env }, {
  has: () => true,
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : INERT)),
}));
/** A door-recording host: every call on hudCtx, magic or routeAction is written down. */
function hostScope(repeat) {
  const calls = [];
  const rec = (who) => new Proxy({}, { get: (t, k) => (...a) => { calls.push(`${who}.${String(k)}`); return true; } });
  let prevented = 0;
  const env = {
    e: { repeat, code: 'KeyX', target: null, preventDefault: () => { prevented++; } },
    statusReadoutTakesAction: () => false, socialMenuCanOpen: () => false, quickLootArm: () => false, gamePaused: () => false,
    townTalk: { overlayActive: false, overlay: null }, modes: null, POLLED_ACTIONS, QUICKSLOT_ACTIONS,
    hudShortcutKey: () => false, inventoryDoorReady: () => true, pauseDoorReady: () => true, keys: new Set(), _tapArmed: 0,
    openPixelDial: () => { calls.push('openPixelDial'); return true; },
    hudCtx: rec('hudCtx'), magic: rec('magic'), routeAction: (act) => { calls.push(`routeAction.${act}`); return true; },
  };
  return { env, calls, prevented: () => prevented };
}
const LADDERS = [['src/scenes/world.js', 'worldKeyAction'], ['src/scenes/exterior.js', 'exteriorKeyAction']];

test('AUDIT DISC28 UI-7: the outdoor ladders (world.js, exterior.js) act on a press, never on its auto-repeat - a held F9 is one save, a held Q one recast', () => {
  const ACTS = ['QuickSave', 'QuickLoad', 'Rest', 'CastSpell', 'RecastSpell', 'AbortSpell', 'CharacterSheet', 'LogBook', 'NoteBook', 'Inventory', 'Escape', 'TravelMap', 'AutoMap', 'QuickDial', 'Screenshot'];
  for (const [file, name] of LADDERS) {
    const text = src(file);
    const fnText = `function ${name}(act, first) ${blockAfter(text, `function ${name}(act, first) `)}`;
    for (const act of ACTS) {
      const press = hostScope(false);
      const pressed = runIn(fnText, press.env)(act, true);
      if (!press.calls.length) continue;   // this ladder has no door for the action (exterior's dev route has no load)
      assert.equal(pressed, true, `${file} ${act}: the press is taken`);
      const held = hostScope(true);
      const taken = runIn(fnText, held.env)(act, true);
      assert.deepEqual(held.calls, [], `${file} ${act}: a repeat opens, saves or casts nothing (the press did: ${press.calls})`);
      assert.equal(taken, true, `${file} ${act}: the repeat is swallowed, not handed on`);
      assert.ok(held.prevented() > 0, `${file} ${act}: its default is prevented`);
    }
    // the polled actions are the frame's own read, never this ladder's - the guard leaves them alone
    const polled = hostScope(true);
    assert.equal(runIn(fnText, polled.env)('ReadyWeapon', true), false, `${file}: a polled action's repeat is declined, not swallowed`);
    assert.deepEqual(polled.calls, [], `${file}: a polled action is still declined here`);
  }
  // world.js's F11 under the death screen (FIX-E; DUPE-LOAD: that window alone): one press, one load. PIN MOVED (DUPE-LOAD):
  // the arm's opener reads `loadsUnder` now; only its body runs here, so the fixture's overlay need not be the death screen
  const text = src('src/scenes/world.js');
  const arm = blockAfter(text, "if (townTalk.overlayActive && townTalk.overlay?.loadsUnder === true && !isTextEntryTarget(e.target) && (modes?.mode ?? 'exterior') === 'exterior' && codeMeans(bindings(), e.code, 'QuickLoad') && !retroToggleKey(e, keys)) ");
  for (const [repeat, want] of [[false, ['hudCtx.quickLoad']], [true, []]]) {
    const h = hostScope(repeat);
    h.env.townTalk = { overlayActive: true, overlay: {} };
    h.env.DeathScreen = class {};
    h.env._deathWasOnline = false;
    runIn(`function () ${arm}`, h.env)();
    assert.deepEqual(h.calls, want, `F11 under a window, repeat=${repeat}`);
  }
});
