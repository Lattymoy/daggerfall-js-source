// CHAT-SCROLL (2026-09-23, Starempire42 on Discord: "Make it so when you open the chat it automatically scrolls to
// the newest message ... Currently when you open the chat it just stays idle so you have to manually scroll down to
// the newest message every single time").
//
// node has no layout engine, so chat1's fake DOM reports whatever it is told. This file's fake LAYS OUT: a line is
// as tall as its text wraps (18px a row of 44 characters, badge parts included), the list's scrollHeight is the sum
// of its lines, its box is 100px, and scrollTop is clamped the way an engine clamps it. That is what the three
// failures need: a hidden box that forgets its place (the engines that drop a display:none scroller's offset), a
// badge that wraps a line after the list scrolled, and a reader who scrolled up.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChatLog } from '../src/net/chat.js';
import { createChatPanel } from '../src/ui/chatPanel.js';

const LINE_PX = 18, WRAP_CHARS = 44, BOX_PX = 100;
const textOf = (n) => (n.children.length ? n.children.map(textOf).join('') : String(n.textContent ?? ''));
function fakeNode(tag, doc) {
  let top = 0;
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', type: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { if (c.parent) c.remove(); c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { for (const c of n.children) c.parent = null; n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() {}, blur() {},
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
    get offsetHeight() { return LINE_PX * Math.max(1, Math.ceil(textOf(n).length / WRAP_CHARS)); },
    get scrollHeight() { return Math.max(BOX_PX, n.children.reduce((s, c) => s + c.offsetHeight, 0)); },
    clientHeight: BOX_PX,
    get scrollTop() { return top; },
    set scrollTop(v) { const was = top; top = Math.max(0, Math.min(Number(v) || 0, n.scrollHeight - BOX_PX)); if (top !== was) n.fire('scroll'); },
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const fakeWindow = () => ({ addEventListener() {}, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

function rig({ badges = false, badge = null } = {}) {
  const log = new ChatLog();
  const doc = fakeDocument();
  const panel = createChatPanel({ log, onSend: () => true, overlay: () => false, action: () => null, doc, win: fakeWindow(), touch: false,
    badgeOf: badge ?? (badges ? () => ({ title: 'founder', glyphs: ['sprout'] }) : null) });
  const root = doc.body.children[0];
  const list = one(root, 'dfchat-list');
  let n = 0;
  const say = (k = 1, text = null) => { for (let i = 0; i < k; i++, n++) log.push('world', { id: 'pabcdefgh0001', name: 'Bran', text: text ?? `line ${n}` }); panel.render(); };
  const atNewest = () => list.scrollTop >= list.scrollHeight - BOX_PX - 1;
  return { log, panel, root, list, say, atNewest };
}

test('CHAT-SCROLL: an open lands on the newest line - after lines arrived while closed, after the reader had scrolled up before closing, and on an engine that drops a hidden scroller\'s place (the list reads as "scrolled to the top" on its first paint back) (mutants: the open paint measuring the hidden box; the open forgetting to land)', () => {
  const { panel, list, say, atNewest } = rig();
  say(30);
  panel.open(); panel.render();
  assert.ok(atNewest(), 'the first open');
  panel.close(); say(6); panel.open(); panel.render();
  assert.ok(atNewest(), 'lines that arrived while closed: the open shows them');
  // the reader scrolls up, closes, and comes back
  list.scrollTop = 0; panel.render();
  assert.equal(list.scrollTop, 0, 'open: a reader who scrolled up is left there (AUDIT CHAT C8)');
  panel.close(); say(2); panel.open(); panel.render();
  assert.ok(atNewest(), 'but an OPEN is a new look: the newest line, not the old place');
  // the engine that forgets: the box was display:none, and on the first paint back it reads 0
  panel.close(); say(3); list.scrollTop = 0; panel.open(); panel.render();
  assert.ok(atNewest(), 'a hidden box that dropped its place is not read as the reader\'s choice');
});

test('CHAT-SCROLL: the newest line is not pushed out of view by the badge pass - a title laid into a line wraps it AFTER the list scrolled, so the scroll is the paint\'s last act; and a badge that arrives later re-lays a line under a reader at the bottom and keeps them there (mutants: the scroll taken inside paintList, before the badges; the later re-lay leaving the bottom)', () => {
  const long = 'a sentence that is long enough to reach within a word of the edge';
  const { panel, say, atNewest } = rig({ badges: true });
  say(12, long);
  panel.open(); panel.render();
  assert.ok(atNewest(), 'open: the badges wrapped every line, and the list still stands on the newest');
  say(3, long);
  assert.ok(atNewest(), 'open, at the bottom: new badged lines are followed through their wrap');
  // a badge that changes later (a title equipped mid-conversation) re-lays the lines already said
  let wearing = null;
  const late = rig({ badge: () => wearing });
  late.say(12, long);
  late.panel.open(); late.panel.render();
  assert.ok(late.atNewest(), 'no badge yet: at the newest');
  wearing = { title: 'founder', glyphs: ['sprout', 'dev'] }; late.panel.render();
  assert.ok(late.atNewest(), 'the title arrives and wraps every line: the reader at the bottom stays at the bottom');
  const src = readFileSync(new URL('../src/ui/chatPanel.js', import.meta.url), 'utf8');
  assert.match(src, /if \(inList && keep === null\) keep = log\.open && unseen === 0 && atNewest\(\);/, 'measured before the first list re-lay');
  assert.match(src, /pass\(listNodes, true\); pass\(peekNodes, false\);\s*\n\s*if \(keep\) list\.scrollTop = list\.scrollHeight \?\? 0;/, 'and the bottom kept after the pass');
  assert.match(src, /paintNames\(\);\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(follow\) toNewest\(\); else paintJump\(\);/, 'the paint scrolls LAST, after the badge pass');
});

test('CHAT-SCROLL: while open, a reader who scrolled up keeps their place and the lines that came in under them are counted on a bar under the list; the bar takes them to the newest line, and scrolling down on their own clears it; a tab change reads from its newest line (mutants: the count not kept; the bar left standing at the bottom)', () => {
  const { panel, root, list, say, atNewest } = rig();
  say(20);
  panel.open(); panel.render();
  const jump = one(root, 'dfchat-jump');
  assert.equal(jump.className, 'dfchat-jump', 'nothing unseen: no bar');
  list.scrollTop = 10; panel.render();
  say(3);
  assert.equal(list.scrollTop, 10, 'not yanked');
  assert.equal(jump.className, 'dfchat-jump on');
  assert.equal(jump.textContent, '3 new - jump to newest');
  say(2);
  assert.equal(jump.textContent, '5 new - jump to newest', 'the count grows with what arrives');
  jump.fire('click');
  assert.ok(atNewest(), 'the bar takes the reader down');
  assert.equal(jump.className, 'dfchat-jump', 'and goes');
  list.scrollTop = 0; panel.render(); say(2);
  assert.equal(jump.className, 'dfchat-jump on');
  list.scrollTop = list.scrollHeight;   // the reader scrolls down on their own (the fake fires the element's scroll)
  assert.equal(jump.className, 'dfchat-jump', 'reaching the bottom clears it');
  panel.close();
  assert.equal(jump.className, 'dfchat-jump', 'a closed panel draws no bar');
});

test('CHAT-SCROLL by source: the bar and the scroll listener are the ELEMENTS\' - the panel still adds exactly one window listener (AUDIT CHAT D5, chat1\'s pin) - and an open paints with the landing flag', () => {
  const src = readFileSync(new URL('../src/ui/chatPanel.js', import.meta.url), 'utf8');
  assert.equal([...src.matchAll(/win\.addEventListener\(/g)].length, 1, 'one window listener');
  assert.match(src, /log\.setOpen\(true\);\s*\n\s*paint\(true\);/, 'the open lands');
  assert.match(src, /const follow = newest \|\| listTab !== log\.active \|\| !listNodes\.length \|\| atNewest\(\);/, 'an open, a tab change and a first paint follow; otherwise the reader\'s place, measured before the rows go in');
  assert.match(src, /list\.addEventListener\('scroll', /);
  assert.match(src, /jump\.addEventListener\('click', /);
});
