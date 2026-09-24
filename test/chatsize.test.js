// CHAT-SIZE (2026-09-23, Mac: "I want to implement the ability to click and drag the chat to resize/along with the
// text"). The grip at the corner of the chat box: the width it gives is the text's scale, the height the list's lines;
// the player's two numbers outlive the session; the friends panel moves with the box instead of sliding under it.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChatLog } from '../src/net/chat.js';
import {
  createChatPanel, CHAT_CSS, CHAT_WIDTH_BASE, CHAT_WIDTH_MIN, CHAT_WIDTH_MAX, CHAT_SCALE_MIN, CHAT_SCALE_MAX, CHAT_LIST_MIN,
  CHAT_LIST_MAX_VH, CHAT_SIZE_STEP, SOCIAL_PANEL_WIDTH, chatScaleFor, chatFit,
} from '../src/ui/chatPanel.js';
import { SOCIAL_CSS } from '../src/ui/socialPanel.js';
import { getPref, setPref, _resetForTests } from '../src/systems/uiPrefs.js';

function fakeNode(tag, doc) {
  const vars = new Map();
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', type: '',
    style: { setProperty: (k, v) => vars.set(k, v), removeProperty: (k) => vars.delete(k), getPropertyValue: (k) => vars.get(k) ?? '' },
    vars, dataset: {}, attrs: {}, listeners: new Map(), captured: null, scrollTop: 0, scrollHeight: 600, clientHeight: 200,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); },
    removeAttribute(k) { delete n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    setPointerCapture(id) { n.captured = id; }, releasePointerCapture(id) { if (n.captured === id) n.captured = null; },
    focus() {}, blur() {}, remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc); doc.documentElement = fakeNode('html', doc);
  doc.getElementById = () => null;
  return doc;
}
function fakeWindow(w = 1280, h = 800) {
  const listeners = [];
  return { innerWidth: w, innerHeight: h, listeners, addEventListener(t, fn, c) { listeners.push({ t, fn, c }); }, removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); } };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

function rig({ w = 1280, h = 800 } = {}) {
  const log = new ChatLog();
  const doc = fakeDocument(), win = fakeWindow(w, h);
  const panel = createChatPanel({ log, onSend: () => true, overlay: () => false, action: () => null, doc, win, touch: false });
  const root = doc.body.children[0];
  return { log, doc, win, panel, root, grip: one(root, 'dfchat-grip'), list: one(root, 'dfchat-list'), vars: doc.documentElement.vars, html: doc.documentElement };
}
const drag = (grip, dx, dy, from = [900, 400]) => {
  grip.fire('pointerdown', { button: 0, pointerId: 7, clientX: from[0], clientY: from[1] });
  grip.fire('pointermove', { pointerId: 7, clientX: from[0] + dx / 2, clientY: from[1] + dy / 2 });
  grip.fire('pointermove', { pointerId: 7, clientX: from[0] + dx, clientY: from[1] + dy });
  grip.fire('pointerup', { pointerId: 7, clientX: from[0] + dx, clientY: from[1] + dy });
};

test('CHAT-SIZE: the law - the text\'s scale IS the dragged width over the sheet\'s own 440, bounded 0.8..1.8, so the width bounds are the scale\'s; the friends panel fits beside the chat exactly where 14 + box + 12 + its 360 + 14 fits the screen, which at the sheet\'s own size is its old 840px breakpoint (mutants: the scale off the height; the fit off the old constant)', () => {
  assert.equal(CHAT_WIDTH_BASE, 440);
  assert.equal(CHAT_WIDTH_MIN, Math.round(440 * CHAT_SCALE_MIN)); assert.equal(CHAT_WIDTH_MAX, Math.round(440 * CHAT_SCALE_MAX));
  assert.equal(chatScaleFor(440), 1); assert.equal(chatScaleFor(660), 1.5); assert.equal(chatScaleFor(100), CHAT_SCALE_MIN); assert.equal(chatScaleFor(5000), CHAT_SCALE_MAX);
  assert.equal(chatFit(840), 'beside', 'the sheet\'s own size: beside at 840'); assert.equal(chatFit(839), 'below', 'below under it - the old media query exactly');
  assert.equal(chatFit(1280, 660), 'beside'); assert.equal(chatFit(1000, 660), 'below', 'a wide chat pushes the panel under it on a screen where both no longer fit');
  assert.equal(chatFit(1400, 792), 'beside', '14 + 792 + 12 + 360 + 14 = 1192');
  assert.match(SOCIAL_CSS, new RegExp(`\\.dfsocial \\{[^}]*width: min\\(${SOCIAL_PANEL_WIDTH}px,`), 'the friends panel\'s width the fit counts is that panel\'s own');
});

test('CHAT-SIZE: the drag - a press on the grip captures the pointer, the travel is the size\'s change (the box is anchored at its top-left), the text\'s scale follows the width, the list\'s height follows the height; the numbers are the player\'s across sessions; published on the document for the friends panel (mutants: the capture dropped; the height ignored; the numbers not kept)', () => {
  _resetForTests(); setPref('chatWidth', null); setPref('chatListHeight', null);
  const { panel, grip, vars, html } = rig();
  assert.equal(vars.has('--dfchat-w'), false, 'untouched: the sheet\'s own size, nothing written');
  assert.equal(html.attrs['data-dfchat-fit'], 'beside', 'the fit is said from the start');
  drag(grip, 220, 100);
  assert.equal(grip.captured, null, 'released on the pointer\'s up');
  assert.equal(vars.get('--dfchat-w'), '660px', '440 + 220');
  assert.equal(vars.get('--dfchat-scale'), '1.5', 'the text at one and a half');
  assert.match(vars.get('--dfchat-list-h'), /^min\(\d+px, 75vh\)$/);
  const h = panel.size().listHeight;
  assert.ok(h >= 200 + 100 - 1 && h <= 200 + 100 + 1, `the list grew by the travel (${h})`);
  assert.equal(getPref('chatWidth'), 660, 'kept'); assert.equal(getPref('chatListHeight'), h);
  // a new session reads them back
  const again = rig();
  assert.equal(again.vars.get('--dfchat-w'), '660px'); assert.equal(again.panel.size().scale, 1.5);
  again.panel.destroy(); panel.destroy();
});

test('CHAT-SIZE: the bounds, the keys and the way back - a drag past either end stops at the scale\'s bounds and the list\'s (a few lines; three quarters of the screen); an arrow on the focused grip steps the size and is stopped there (the host\'s ring never walks); a double click gives the sheet\'s own size back and forgets the player\'s; destroy takes the footprint with it (mutants: a key reaching the host; the reset leaving the numbers)', () => {
  _resetForTests(); setPref('chatWidth', null); setPref('chatListHeight', null);
  const { panel, grip, vars, html } = rig({ h: 800 });
  drag(grip, -2000, -2000);
  assert.equal(panel.size().width, CHAT_WIDTH_MIN); assert.equal(panel.size().listHeight, CHAT_LIST_MIN);
  drag(grip, 5000, 5000);
  assert.equal(panel.size().width, CHAT_WIDTH_MAX); assert.equal(panel.size().listHeight, Math.round(800 * CHAT_LIST_MAX_VH / 100));
  const k = grip.fire('keydown', { code: 'ArrowLeft' });
  assert.equal(k.prevented, true); assert.equal(k.stopped, true, 'the key is the grip\'s, not the game\'s');
  assert.equal(panel.size().width, CHAT_WIDTH_MAX - CHAT_SIZE_STEP);
  grip.fire('keydown', { code: 'ArrowUp' });
  assert.equal(panel.size().listHeight, Math.round(800 * CHAT_LIST_MAX_VH / 100) - CHAT_SIZE_STEP);
  assert.equal(grip.fire('keydown', { code: 'KeyW' }).stopped, false, 'any other key is left alone');
  grip.fire('dblclick');
  assert.deepEqual([panel.size().width, panel.size().listHeight, panel.size().scale], [null, null, 1]);
  assert.equal(vars.has('--dfchat-w'), false); assert.equal(vars.has('--dfchat-scale'), false); assert.equal(vars.has('--dfchat-list-h'), false);
  assert.equal(getPref('chatWidth'), null); assert.equal(getPref('chatListHeight'), null);
  drag(grip, 100, 0); panel.destroy();
  assert.equal(vars.size, 0, 'destroy: nothing of the chat\'s left on the document'); assert.equal(html.attrs['data-dfchat-fit'], undefined);
});

test('CHAT-SIZE: a reader on the newest line stays on it as the list is dragged shorter; the fit follows the screen (a rotate, a resized window) on the next frame, said on a change only; the panel still adds exactly one window listener (mutants: the follow dropped; the fit said once and never again)', () => {
  _resetForTests(); setPref('chatWidth', null); setPref('chatListHeight', null);
  const { log, panel, grip, list, win, html } = rig({ w: 1280 });
  for (let i = 0; i < 40; i++) log.push('world', { id: 'pabcdefgh0001', name: 'Bran', text: `line ${i}` });
  panel.open(); panel.render();
  list.scrollTop = list.scrollHeight - list.clientHeight;   // on the newest line
  grip.fire('pointerdown', { button: 0, pointerId: 3, clientX: 900, clientY: 400 });
  list.scrollHeight = 900;   // the box shrinks under the drag: in the fake, the content outgrows it
  grip.fire('pointermove', { pointerId: 3, clientX: 900, clientY: 320 });
  assert.equal(list.scrollTop, 900, 'kept on the newest line through the drag');
  grip.fire('pointerup', { pointerId: 3, clientX: 900, clientY: 320 });
  // a reader who had scrolled up is left where they were
  list.scrollTop = 0;
  grip.fire('pointerdown', { button: 0, pointerId: 4, clientX: 900, clientY: 320 });
  grip.fire('pointermove', { pointerId: 4, clientX: 900, clientY: 300 });
  grip.fire('pointerup', { pointerId: 4 });
  assert.equal(list.scrollTop, 0, 'not yanked by a resize');
  // a move from another pointer (a second finger) is not the drag's
  grip.fire('pointerdown', { button: 0, pointerId: 5, clientX: 900, clientY: 300 });
  const before = panel.size().listHeight;
  grip.fire('pointermove', { pointerId: 6, clientX: 900, clientY: 500 });
  assert.equal(panel.size().listHeight, before, 'another pointer\'s move is ignored');
  grip.fire('pointerup', { pointerId: 5 });
  // a right press is no drag
  const widthBefore = panel.size().width;
  grip.fire('pointerdown', { button: 2, pointerId: 8, clientX: 900, clientY: 300 });
  grip.fire('pointermove', { pointerId: 8, clientX: 1200, clientY: 400 });
  assert.deepEqual([panel.size().width, panel.size().listHeight], [widthBefore, before], 'the right button does not drag');
  assert.equal(html.attrs['data-dfchat-fit'], 'beside');
  win.innerWidth = 800; panel.render();
  assert.equal(html.attrs['data-dfchat-fit'], 'below', 'the screen narrowed under the chat');
  assert.equal(win.listeners.filter((l) => l.t === 'keydown').length, 1);
  assert.equal(win.listeners.length, 1, 'the one window listener (AUDIT CHAT D5)');
  panel.destroy();
});

test('CHAT-SIZE by source: every size the chat\'s TEXT is drawn at is the scale\'s - the lines, their tags, times, titles and glyphs, the hint and the status, the roster\'s rows and its column, the field, the jump bar - and nothing a thumb presses is (the buttons, the tabs: AUDIT SOC C8\'s targets); the box is the dragged width inside the screen, the list the dragged height inside three quarters of it; the friends panel places itself off the chat\'s published footprint, the old fixed numbers kept for a page with no chat', () => {
  const scaled = ['.dfchat-line', '.dfchat-tag', '.dfchat-time', '.dfchat-hint', '.dfchat-status', '.dfchat-jump', '.dfchat-input', '.dfchat-whohead', '.dfchat-who-row', '.dfchat-who-tag', '.dfchat-who-title', '.dfchat-line-title', '.dfchat-who-more'];
  const ruleOf = (sel) => { const m = new RegExp(`(?:^|\\n)${sel.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`).exec(CHAT_CSS); return m ? m[1] : null; };
  for (const sel of scaled) assert.match(ruleOf(sel) ?? '', /font-size: calc\(\d+px \* var\(--dfchat-scale, 1\)\)/, `${sel} scales with the text`);
  assert.match(ruleOf('.dfchat-who'), /width: calc\(148px \* var\(--dfchat-scale, 1\)\)/, 'the roster column widens with its names');
  assert.match(ruleOf('.dfchat-line-glyph'), /width: calc\(11px \* var\(--dfchat-scale, 1\)\); height: calc\(11px \* var\(--dfchat-scale, 1\)\)/);
  assert.match(ruleOf('.dfchat-who-glyph'), /width: calc\(11px \* var\(--dfchat-scale, 1\)\); height: calc\(11px \* var\(--dfchat-scale, 1\)\)/);
  assert.match(CHAT_CSS, /\.dfchat-send, \.dfchat-close, \.dfchat-open, \.dfchat-hide, \.dfchat-show \{[^}]*font-size: 14px; padding: 6px 10px;/, 'the buttons are the thumb\'s, unscaled');
  assert.doesNotMatch(ruleOf('.dfchat-tab') ?? '', /dfchat-scale/, 'the tabs too');
  assert.match(ruleOf('.dfchat'), /width: min\(var\(--dfchat-w, 440px\), calc\(100vw - 28px\)\);/);
  assert.match(ruleOf('.dfchat-list'), /height: var\(--dfchat-list-h, min\(220px, 34vh\)\);/);
  assert.match(ruleOf('.dfchat-box'), /position: relative;/);
  assert.match(SOCIAL_CSS, /:root\[data-dfchat-fit="beside"\] \.dfsocial \{ left: calc\(26px \+ min\(var\(--dfchat-w, 440px\), 100vw - 28px\) \+ env\(safe-area-inset-left, 0px\)\);/);
  assert.match(SOCIAL_CSS, /:root\[data-dfchat-fit="below"\] \.dfsocial, :root\[data-dfchat-fit="below"\] \.dfsocial\.touch \{ left: calc\(14px \+ env\(safe-area-inset-left, 0px\)\);\s*\n\s*top: calc\(var\(--dfchat-list-h, min\(220px, 34vh\)\) \+ 170px \+ 20px \* \(var\(--dfchat-scale, 1\) - 1\) \+ env\(safe-area-inset-top, 0px\)\);/, 'min(220px, 34vh) + 170 is the old 390 at the chat\'s own size');
  assert.match(SOCIAL_CSS, /@media \(min-width: 840px\) \{ \.dfsocial \{ left: calc\(466px \+ env\(safe-area-inset-left, 0px\)\); \} \}/, 'the page with no chat keeps the old numbers');
  const src = readFileSync(new URL('../src/ui/chatPanel.js', import.meta.url), 'utf8');
  assert.match(src, /box\.append\(tabs, cols, grip\);/, 'the grip is the BOX\'s - its corner is past the roster column, not at the end of the form\'s row (the probe found it there, mid-box)');
  assert.match(ruleOf('.dfchat-grip'), /position: absolute; right: 0; bottom: 0;/);
  assert.match(ruleOf('.dfchat-form'), /padding: 6px 16px 6px 6px;/, 'the form\'s last button stands clear of the grip');
  assert.match(CHAT_CSS, /\.dfchat\.touch \.dfchat-form \{ padding-right: 30px; \}/, '...and of the thumb\'s larger grip');
  assert.match(ruleOf('.dfchat-wholist'), /padding: 0 8px 14px;/, 'and the roster\'s last row too');
  assert.equal([...src.matchAll(/win\.addEventListener\(/g)].length, 1);
});
