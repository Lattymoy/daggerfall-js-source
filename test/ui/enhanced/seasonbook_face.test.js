// AUDIT SEASON-BOOK (bible/01-Overview/audits/Audit-Season-Book.md) P1, S3, S4, U1, U3, P4, P6: THE LAUREL ON THE REAL PAUSE
// FACE (ui/enhanced/enhancedMenu.js mounted over test/chargenDom.mjs) - pressed open, closed by Close, by Escape and by a tap
// outside; the focus into the window and back to the laurel; the window shut with its mark gone; the tap's release
// swallowed; a row's door through the handoff. The source pins in seasonbook.test.js say where; this says that it works.
import test from 'node:test';
import assert from 'node:assert/strict';
import { keydown, keyup } from '../../chargenDom.mjs';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';
import { pauseMenuAct } from '../../../src/ui/pauseDoor.js';

console.warn = () => {};
const NOW = Date.UTC(2026, 9, 22, 12);
const all = (root, cls) => root.querySelectorAll('.' + cls);
const one = (root, cls) => all(root, cls)[0] ?? null;
const inert = (n) => !!n && n.attrs?.inert !== undefined;

function face({ at = null, onAction = () => {} } = {}) {
  const state = { online: true, boardOpened: 0, arenaOpened: 0 };
  const hooks = {
    timers: () => (state.online ? { now: NOW, seatsOpen: true, zero: 2, doors: { board: () => { state.boardOpened++; return true; } } } : null),
    post: () => (state.online ? { waiting: 0, version: 1, state: 'ready', post: [] } : null),
    season: () => ({ signedIn: true, guest: false, boards: {}, sea: null }),
    arenaJoined: () => true, openArena: () => { state.arenaOpened++; return state.arenaOk ?? true; },
  };
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks, onAction, at });
  const press = () => one(host, 'px-seasonmark').click();
  return { host, menu, hooks, state, press, done: () => { menu.unmount(); host.remove(); } };
}

test('AUDIT SEASON-BOOK P1/P6: the laurel stands online and opens the window, the focus going in (Close); Close, Escape and a tap outside each close it alone, the focus handed back to the laurel; the laurel says whether it is open (mutants: the laurel opening nothing; never on the page; Close leaving it open; no render; no focus in or back; always or never expanded)', () => {
  const acts = [];
  const f = face({ onAction: (a) => acts.push(a) });
  try {
    const laurel = one(f.host, 'px-seasonmark');
    assert.ok(laurel, 'online: the laurel stands');
    assert.equal(laurel.attrs['aria-expanded'], 'false');
    f.press();
    let win = one(f.host, 'px-seasonwin');
    assert.ok(win, 'the press opens the window');
    assert.equal(one(f.host, 'px-seasonmark').attrs['aria-expanded'], 'true', 'the laurel says it is open');
    assert.equal(globalThis.document.activeElement, one(win, 'sb-close'), 'the focus went into the window');
    one(win, 'sb-close').click();
    assert.equal(one(f.host, 'px-seasonwin'), null, 'Close closes it');
    assert.equal(globalThis.document.activeElement, one(f.host, 'px-seasonmark'), 'the focus back on the laurel');
    assert.equal(one(f.host, 'px-seasonmark').attrs['aria-expanded'], 'false');
    // Escape: the window first, the game never resumed under it
    f.press();
    keydown('Escape', undefined, { key: 'Escape' }); keyup('Escape', undefined, { key: 'Escape' });
    assert.equal(one(f.host, 'px-seasonwin'), null, 'Escape closes the window');
    assert.ok(!acts.includes('resume'), 'and does not resume');
    assert.equal(globalThis.document.activeElement, one(f.host, 'px-seasonmark'));
    // a tap outside the window: the window alone
    f.press();
    win = one(f.host, 'px-seasonwin');
    const home = win.parentNode.parentNode;
    for (const fn of home.listeners.pointerdown ?? []) fn({ button: 0, target: win.parentNode, preventDefault() {} });
    assert.equal(one(f.host, 'px-seasonwin'), null, 'a tap on the scrim closes it');
    assert.ok(!acts.includes('resume'), 'never resumes');
  } finally { f.done(); }
});

test('AUDIT SEASON-BOOK P1: offline there is no laurel, and a door at `season` with no clock opens nothing (mutants: the laurel offline)', () => {
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { timers: () => null, post: () => null, season: () => null }, onAction() {}, at: 'season' });
  try {
    assert.deepEqual([one(host, 'px-seasonmark'), one(host, 'px-seasonwin')], [null, null]);
  } finally { menu.unmount(); host.remove(); }
});

test('AUDIT SEASON-BOOK S4: a window whose mark is gone is closed - the clock lost while it is open, then back, never brings it back over the face (mutants: the flag kept)', () => {
  const f = face({ at: 'season' });
  try {
    assert.ok(one(f.host, 'px-seasonwin'), 'opened at `season`');
    f.state.online = false;
    all(f.host, 'px-tabs')[0]?.children?.[0]?.click?.();   // a repaint of the face with the clock gone
    assert.equal(one(f.host, 'px-seasonwin'), null, 'no clock, no window');
    f.state.online = true;
    all(f.host, 'px-tabs')[0]?.children?.[1]?.click?.();   // the clock back, another tab pressed
    assert.equal(one(f.host, 'px-seasonwin'), null, 'the window does not come back unasked');
    assert.ok(one(f.host, 'px-seasonmark'), 'the laurel is back');
  } finally { f.done(); }
});

test('AUDIT SEASON-BOOK P4/U3: under the season window the face and every mark are out of reach, and the laurel is out of reach under the hourglass\'s and the mailbox\'s; a repaint of the face around the open window leaves the focus where it was (mutants: the laurel live under another window; the focus pulled to Close by a repaint)', () => {
  const f = face();
  try {
    f.press();
    for (const c of ['px-timersmark', 'px-postmark', 'px-seasonmark']) assert.ok(inert(one(f.host, c)), `${c} inert under the season window`);
    one(f.host, 'sb-close').click();
    one(f.host, 'px-timersmark').click();
    assert.ok(one(f.host, 'px-timerswin'), 'the hourglass\'s window');
    assert.ok(inert(one(f.host, 'px-seasonmark')), 'the laurel inert under it');
    one(f.host, 'tm-close').click();
    one(f.host, 'px-postmark').click();
    assert.ok(one(f.host, 'px-postwin'), 'the mailbox');
    assert.ok(inert(one(f.host, 'px-seasonmark')), 'the laurel inert under it');
    one(f.host, 'pm-close')?.click?.();
  } finally { f.done(); }
  const g = face({ at: 'season' });
  try {
    const marker = globalThis.document.createElement('button');
    globalThis.document.body.append(marker);
    marker.focus();
    all(g.host, 'px-tabs')[0]?.children?.[0]?.click?.();   // the face repaints (a tab under the window, as a cloud answer would)
    assert.ok(one(g.host, 'px-seasonwin'), 'the window stands through the repaint');
    assert.equal(globalThis.document.activeElement, marker, 'the repaint\'s new window did not take the focus');
    marker.remove();
  } finally { g.done(); }
});

test('AUDIT SEASON-BOOK U1: a tap that closes the window swallows its own release - the click of that tap never reaches the face drawn under it (mutants: no swallow)', () => {
  const f = face({ at: 'season' });
  const listeners = [];
  const was = globalThis.document.addEventListener;
  globalThis.document.addEventListener = (t, fn, o) => { listeners.push([t, fn, o]); };
  try {
    const win = one(f.host, 'px-seasonwin');
    const home = win.parentNode.parentNode;
    for (const fn of home.listeners.pointerdown ?? []) fn({ button: 0, target: win.parentNode, preventDefault() {} });
    const eat = listeners.find(([t, , o]) => t === 'click' && o === true);
    assert.ok(eat, 'the next click is watched for, in the capture phase');
    let stopped = false;
    eat[1]({ preventDefault() {}, stopPropagation() { stopped = true; }, stopImmediatePropagation() {} });
    assert.ok(stopped, 'and eaten');
  } finally { globalThis.document.addEventListener = was; f.done(); }
});

test('AUDIT SEASON-BOOK S3: a season row\'s door hands the slot through the one handoff, and a door that opened nothing resumes even though the handoff unmounted the face (mutants: the resume asked of the emptied handler)', () => {
  const seen = [];
  let f;
  const onAction = pauseMenuAct({ relock: () => seen.push('relock') }, () => { seen.push('close'); f.menu.unmount(); });
  f = face({ at: 'season', onAction: (a) => onAction(a) });
  try {
    f.state.arenaOk = false;   // the Arena's window refused
    const door = all(f.host, 'sb-door').find((d) => d.textContent === 'Arena');
    assert.ok(door, 'the Arena\'s door, a banner worn');
    door.click();
    assert.equal(f.state.arenaOpened, 1);
    assert.deepEqual(seen, ['close', 'close', 'relock'], 'the face down, the door asked, and - it opened nothing - the resume, relocking');
  } finally { f.host.remove(); }
});

test('AUDIT SEASON-BOOK U3 - the hourglass\'s window too: the focus into it when it opens, never pulled there by a repaint of the face around it (mutants: the focus taken on every build)', () => {
  const f = face();
  try {
    one(f.host, 'px-timersmark').click();
    assert.equal(globalThis.document.activeElement, one(f.host, 'tm-close'), 'the opening takes the focus to Close');
    const marker = globalThis.document.createElement('button');
    globalThis.document.body.append(marker);
    marker.focus();
    all(f.host, 'px-tabs')[0]?.children?.[0]?.click?.();   // a repaint of the face under the open window
    assert.ok(one(f.host, 'px-timerswin'), 'the window stands through the repaint');
    assert.equal(globalThis.document.activeElement, marker, 'the repaint\'s window left the focus where it was');
    marker.remove();
  } finally { f.done(); }
});
