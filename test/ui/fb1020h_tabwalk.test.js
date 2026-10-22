// FIELD BUGS 2026-10-20h - TAB-WALK and HUD-FOCUS (report 6, "TAB focusing the Socials button"): THE BROWSER'S TAB IS NEVER
// THE GAME'S WALK, AND A BUTTON OVER THE WORLD IS NEVER THE KEYBOARD'S FOCUS. The hosts prevented Tab only when the
// QuickDial answered it, so wherever the dial did not answer (the classic skin, the status readout's slot, a key rebound,
// the boot's last await), the browser walked the page's focus onto the first control drawn over the world. Online, with the
// chat shut, that control is the chat's Social button. Its focus ring showed, and the next Space (the game's Jump) pressed
// it. A mouse press on the button left it the focus the same way. bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md.
//
// Driven on the real modules: the chat panel (ui/chatPanel.js createChatPanel, its real ChatLog, its Social button the way
// scenes/world.js asks for it) and the hosts' one swallow (ui/input.js swallowBrowserKey), run in world.js's order - the
// panel's capture listener first, then the host's bubble listener. The document is a fake (the chat tests' shape) that
// does what Chromium was measured to do (the record's FOUND): a button takes the focus on a mouse press unless the press is
// prevented, its focus() raises `focus`, and Space at a focused button presses it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChatLog } from '../../src/net/chat.js';
import { createChatPanel } from '../../src/ui/chatPanel.js';
import * as input from '../../src/ui/input.js';   // a namespace, so each pin runs - and fails on its own line - against the tree before the fix

const { swallowBrowserKey, BROWSER_STEALS } = input;

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const T0 = 1_700_000_000_000;
/** The controls the walk takes by default, as the DOM's own tabIndex says them. */
const TAKES_THE_WALK = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

function fakeNode(tag, doc) {
  const T = tag.toUpperCase();
  const n = {
    tagName: T, children: [], parent: null, className: '', textContent: '', id: '', value: '', type: '',
    tabIndex: TAKES_THE_WALK.has(T) ? 0 : -1,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); },
    getAttribute(k) { return n.attrs[k] ?? null; },
    closest(sel) { const a = /^\[([\w-]+)\]$/.exec(sel)?.[1]; for (let p = n; p; p = p.parent) if (a ? a in p.attrs : false) return p; return null; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t, e = {}) { const ev = { type: t, target: n, prevented: false, preventDefault() { ev.prevented = true; }, stopPropagation() {}, ...e }; for (const fn of [...(n.listeners.get(t) ?? [])]) fn(ev); return ev; },
    focus() { doc.activeElement = n; n.fire('focus'); },
    blur() { if (doc.activeElement !== n) return; doc.activeElement = doc.body; n.fire('blur'); },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.activeElement = doc.body;
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** The window, both phases: the capture pass (the chat's own listener), then - unless stopped - the bubble pass, where
 *  every host's keydown stands and calls the swallow first (test/ui/nativeinventory.test.js holds all five to it). */
function fakeWindow() {
  const listeners = [];
  return {
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture: capture === true || capture?.capture === true }); },
    removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    dispatch(ev) {
      for (const l of listeners) { if (ev.immediate) break; if (l.t === ev.type && l.capture) l.fn(ev); }
      if (!ev.stopped) for (const l of listeners) if (l.t === ev.type && !l.capture) l.fn(ev);
      return ev;
    },
  };
}
const KEY_OF = { Tab: 'Tab', Space: ' ', Enter: 'Enter', F6: 'F6', KeyW: 'w' };
/** A key as the browser sends it: aimed at what has the focus (the body when nothing has), with the host's keydown on the
 *  window's bubble pass - here, its first line: the one swallow. Space at a focused button the browser then presses
 *  (Chromium, measured: at the keyup, unless the keydown was prevented). */
function keyAt(win, doc, code, over = {}) {
  const target = over.target ?? doc.activeElement ?? doc.body;
  const ev = { type: 'keydown', code, key: KEY_OF[code] ?? code, target, isTrusted: true, repeat: false, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    prevented: false, stopped: false, immediate: false,
    preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, stopImmediatePropagation() { ev.stopped = true; ev.immediate = true; }, ...over };
  win.dispatch(ev);
  if (!ev.prevented && (code === 'Space' || code === 'Enter') && target.tagName === 'BUTTON') target.fire('click');
  return ev;
}
/** A mouse press as Chromium makes one (measured): mousedown, the focus unless the press was prevented, then the click. */
function mousePress(node) {
  const down = node.fire('mousedown', { button: 0 });
  if (!down.prevented) node.focus();
  node.fire('click');
  return down;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

/** The online chat as scenes/world.js stands it: shut, with its Social button; a host behind it that swallows first. */
function online({ touch = false } = {}) {
  const log = new ChatLog({ now: () => T0 });
  const doc = fakeDocument(), win = fakeWindow();
  let toggles = 0;
  const panel = createChatPanel({ log, onSend: () => true, action: (e) => (e.code === 'Enter' ? 'ActivateCursor' : null), overlay: () => false, doc, win, touch,
    social: { onToggle: () => { toggles++; }, pending: () => 0 } });
  win.addEventListener('keydown', (e) => { swallowBrowserKey(e); });   // every host's keydown, its first line (U47)
  const root = doc.body.children[0];
  return { log, doc, win, panel, root, toggles: () => toggles, input: one(root, 'dfchat-input') };
}

test('FB1020h TAB-WALK: a Tab with nothing focused - the game holding the keyboard - is swallowed by the hosts\' one swallow, Shift+Tab too, with the chat standing shut in front of it; the press goes on to the host\'s ladder unstopped (the QuickDial still hears it), and the focus stays on the page (mutants: the swallow without the walk; the body not the page)', () => {
  const O = online();
  for (const shiftKey of [false, true]) {
    const ev = keyAt(O.win, O.doc, 'Tab', { shiftKey });
    assert.deepEqual([ev.prevented, ev.stopped, O.doc.activeElement === O.doc.body], [true, false, true],
      `${shiftKey ? 'Shift+' : ''}Tab from the page: swallowed, still the ladder's, the focus nowhere`);
  }
  const page = (t) => input.isPageTarget?.(t) ?? null;
  assert.deepEqual([page(O.doc.body), page(null), page({ nodeType: 9 }), page({ tagName: 'HTML' }), page(one(O.root, 'dfchat-social-out'))], [true, true, true, true, false],
    'the body, no target, the document and the root element are the page; a control is not');
});

test('FB1020h TAB-WALK leaves every other Tab where it was: the chat field keeps its own (C7: kept in the field, never the game\'s); a field outside every window (the social panel\'s letter) and a window that owns the focus (the pause door\'s data-dom-focus) keep the browser\'s walk; Ctrl+Tab and Alt+Tab are the browser\'s and the system\'s; F6 is still swallowed (mutants: every target the page; the modifiers read as nothing). Passes before the fix as after: it holds what the swallow must not take', () => {
  const O = online();
  O.log.setOpen(true);
  O.input.focus();
  const inField = keyAt(O.win, O.doc, 'Tab');
  assert.deepEqual([inField.prevented, inField.stopped, O.doc.activeElement === O.input], [true, true, true], 'C7: the chat field keeps the caret and the key');
  const letter = O.doc.createElement('input');
  assert.equal(swallowBrowserKey({ code: 'Tab', key: 'Tab', target: letter, preventDefault() { assert.fail('a field\'s Tab swallowed'); } }), false, 'a field keeps its walk (CG2)');
  const pause = O.doc.createElement('div');
  pause.setAttribute('data-dom-focus', '');
  const tab = O.doc.createElement('button');
  pause.append(tab);
  assert.equal(swallowBrowserKey({ code: 'Tab', key: 'Tab', target: tab, preventDefault() { assert.fail('a window\'s walk swallowed'); } }), false, 'a window that owns the focus walks it (AUDIT LEGACY II U3)');
  for (const mod of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(keyAt(O.win, O.doc, 'Tab', { target: O.doc.body, [mod]: true }).prevented, false, `${mod} + Tab is the browser's or the system's`);
  assert.equal(keyAt(O.win, O.doc, 'KeyW', { target: O.doc.body }).prevented, false, 'and W from the page is the game\'s, never swallowed');
  assert.deepEqual(BROWSER_STEALS, ['F1', 'F3', 'F5', 'F6', 'F11'], 'the list of keys the browser would steal is unchanged');
  O.input.blur();
  assert.equal(keyAt(O.win, O.doc, 'F6').prevented, true, 'F6 swallowed as ever');
});

test('FB1020h HUD-FOCUS: nothing the chat stands over the world takes the Tab walk - Play online here, the touch skin\'s Chat, the Social button beside it, Show while the chat is put away, and the Social button in the open chat\'s tab bar - while the chat\'s own field, inside the open box, still does (mutants: each out of the helper; the helper writing 0)', () => {
  for (const touch of [false, true]) {
    const O = online({ touch });
    const standing = ['dfchat-here', 'dfchat-open', 'dfchat-social-out', 'dfchat-show', 'dfchat-social-tab'].map((cls) => one(O.root, cls));
    assert.deepEqual(standing.map((b) => [b.tagName, b.tabIndex]), standing.map(() => ['BUTTON', -1]), `${touch ? 'touch' : 'desktop'}: every one out of the walk`);
    assert.equal(O.input.tabIndex, 0, 'the field is the DOM\'s own');
  }
});

test('FB1020h HUD-FOCUS: a mouse press on the Social button opens the panel once and leaves it no focus - the next Space (the game\'s Jump) and the next after it press nothing, and the press reached the host\'s keys (mutants: the press taking the focus; the Social button out of the helper)', () => {
  const O = online();
  const social = one(O.root, 'dfchat-social-out');
  const down = mousePress(social);
  assert.deepEqual([down.prevented, O.toggles(), O.doc.activeElement === O.doc.body], [true, 1, true], 'pressed once, the focus where it was');
  const jumps = [keyAt(O.win, O.doc, 'Space'), keyAt(O.win, O.doc, 'Space')];
  assert.deepEqual([O.toggles(), jumps.map((e) => e.target === O.doc.body)], [1, [true, true]], 'Space is the game\'s: aimed at the page, pressing no button');
  // the open chat's own Social button, the same law
  const tabBtn = one(O.root, 'dfchat-social-tab');
  mousePress(tabBtn);
  keyAt(O.win, O.doc, 'Space');
  assert.equal(O.toggles(), 2, 'its press once, its Space nothing');
});

test('FB1020h HUD-FOCUS: a focus given another way - a script\'s focus(), the pad cursor\'s press (ui/plus/plusPad.js domPointer focuses what it presses) - is given straight back, so no focus ring stands on the button and no Space presses it; the helper hands its control back (mutant: the focus kept)', () => {
  const O = online();
  const CLS = ['dfchat-social-out', 'dfchat-here', 'dfchat-show', 'dfchat-open', 'dfchat-social-tab'];
  const kept = CLS.map((cls) => { one(O.root, cls).focus(); const back = O.doc.activeElement === O.doc.body; O.doc.activeElement = O.doc.body; return [cls, back]; });
  assert.deepEqual(kept, CLS.map((cls) => [cls, true]), 'each gives the focus straight back');
  one(O.root, 'dfchat-social-out').focus();
  keyAt(O.win, O.doc, 'Space');
  assert.equal(O.toggles(), 0);
  const doc = fakeDocument();
  const b = doc.createElement('button');
  assert.equal(input.neverTheFocus?.(b), b, 'the control, handed back');
  assert.equal(input.neverTheFocus?.(null), null);
});

test('FB1020h TAB-WALK: the world host\'s swallow stands above every arm that can decline a Tab - the boot\'s gate (KEY-BOOT) and the QuickDial\'s own arm - and routeKey no longer says the browser\'s walk is the classic default it keeps', () => {
  const world = rd('src/scenes/world.js');
  const kd = world.slice(world.indexOf("  addEventListener('keydown', (e) => {\n    if (peerMenuReader"));
  const at = (s) => { const i = kd.indexOf(s); assert.ok(i >= 0, `world.js's keydown holds ${s}`); return i; };
  assert.ok(at('    swallowBrowserKey(e);   // U47') < at('    if (!_worldKeysLive) return;'), 'above the boot\'s gate');
  assert.ok(at('    swallowBrowserKey(e);   // U47') < at("if (act === 'QuickDial' && hudCtx.toggleDial())"), 'above the dial\'s arm');
  const input = rd('src/ui/input.js');
  assert.doesNotMatch(input, /classic behaviour is byte-for-byte untouched/, 'the sentence that kept the browser\'s walk is gone');
});
