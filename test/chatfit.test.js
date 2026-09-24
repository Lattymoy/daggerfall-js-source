// CHAT-FIT (2026-09-22, Mac: "names sometimes take up 2 rows, the list
// isnt scrollable and continues to grow, enlarging the chat. Glyphs
// should also show on chat names in the chat itself"): THE ROSTER
// COLUMN IS AS TALL AS THE CONVERSATION and scrolls inside that, a row
// is ONE LINE with the name giving way, and a chat line wears its
// author's badge - the title before the name, the glyphs after - asked
// of the host on the colour pass's law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChatLog } from '../src/net/chat.js';
import { createChatPanel, CHAT_CSS } from '../src/ui/chatPanel.js';
import { OnlineSession } from '../src/net/online.js';
import { TITLE_TEXT, GLYPH_PATH } from '../src/ui/playerBadge.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const CSS_RULES = (css) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] }));
const DECLS = (body) => Object.fromEntries([...body.matchAll(/([-a-z]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
const rule = (sel) => { const r = CSS_RULES(CHAT_CSS).find((x) => x.sel === sel); assert.ok(r, `a rule for ${sel}`); return DECLS(r.body); };

function fakeNode(tag, doc, ns = null) {
  const n = { tagName: tag.toUpperCase(), ns, children: [], parent: null, className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { for (const c of n.children) c.parent = null; n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    focus() { doc.activeElement = n; }, blur() {},
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
  };
  return n;
}
function fakeDocument({ svg = true } = {}) {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  if (svg) doc.createElementNS = (ns, tag) => fakeNode(tag, doc, ns);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const fakeWindow = () => ({ addEventListener() {}, removeEventListener() {}, requestAnimationFrame: (f) => f(), setTimeout: () => 0, clearTimeout() {} });
const cls = (n) => String(n.className || n.attrs?.class || '').split(/\s+/);
const find = (n, c, out = []) => { if (cls(n).includes(c)) out.push(n); for (const k of n.children) find(k, c, out); return out; };
const one = (n, c) => find(n, c)[0];
const shape = (n) => n.children.map((c) => cls(c).find((x) => x.startsWith('dfchat-')) ?? c.tagName).join(' ');

function mount({ badges = new Map(), svg = true, roster = null } = {}) {
  const doc = fakeDocument({ svg }), win = fakeWindow();
  const log = new ChatLog({ now: () => 1000 });
  const panel = createChatPanel({ log, onSend: () => true, doc, win, touch: false, action: () => null, overlay: () => false,
    badgeOf: (id) => badges.get(id) ?? null, roster });
  return { doc, log, panel, root: doc.body.children[0] };
}

test('CHAT-FIT: the sheet - the column is absolute inside a relative column of fixed width, a row\'s line is nowrap flex and only the NAME shrinks (ellipsis), and the line badge classes exist at the roster\'s sizes', () => {
  const who = rule('.dfchat-who');
  assert.equal(who.position, 'relative'); assert.equal(who.width, 'calc(148px * var(--dfchat-scale, 1))', 'CHAT-SIZE: 148px at the sheet\'s own size, and wider with the text'); assert.equal(who.display, undefined, 'the column is not a flex column any more - its inner is');
  const inner = rule('.dfchat-who-inner');
  assert.equal(inner.position, 'absolute'); assert.equal(inner.inset, '0'); assert.equal(inner.display, 'flex'); assert.equal(inner['flex-direction'], 'column');
  const list = rule('.dfchat-wholist'); assert.equal(list['overflow-y'], 'auto'); assert.equal(list['min-height'], '0');
  const line = rule('.dfchat-who-line'); assert.equal(line.display, 'flex'); assert.equal(line['white-space'], 'nowrap'); assert.equal(line['min-width'], '0');
  const name = rule('.dfchat-who-name'); assert.equal(name['text-overflow'], 'ellipsis'); assert.equal(name.overflow, 'hidden'); assert.equal(name['min-width'], '0'); assert.equal(name.flex, '0 1 auto');
  assert.equal(rule('.dfchat-who-glyph, .dfchat-who-tag').flex, 'none', 'the glyphs and the tag never give (TITLE-R: the roster wears no title)');
  const row = rule('.dfchat-who-row'); assert.equal(row['overflow-wrap'], undefined, 'no more folding a name under its title'); assert.equal(row.display, undefined, 'the row is a block, so the menu opens under the line');
  assert.equal(rule('.dfchat-line-glyph').width, rule('.dfchat-who-glyph').width, 'a line glyph is the roster glyph\'s size');
  assert.equal(rule('.dfchat-line-title')['text-transform'], 'uppercase');
});

test('CHAT-FIT / TITLE-R: the roster column\'s DOM - head, list and more sit in the absolute inner; a row is a block holding ONE line of name (its full text in the title attribute), glyphs and tag - no title (Mac: "Titles shouldnt show in the online panel. Only glyphs"); the action menu opens under the line', () => {
  const session = { id: 'me', name: 'Me', title: null, glyphs: [], peers: new Map([
    ['p1', { id: 'p1', name: 'Palidriel Oakthorn', title: 'founder', glyphs: ['sprout'] }],
    ['p2', { id: 'p2', name: 'Me', title: null, glyphs: [] }],
  ]) };
  const { root, panel, log } = mount({ roster: () => session });
  log.setOpen(true); panel.render?.(); panel.paint?.();
  const who = one(root, 'dfchat-who');
  assert.equal(shape(who), 'dfchat-who-inner', 'the column holds the inner and nothing else');
  assert.equal(shape(who.children[0]), 'dfchat-whohead dfchat-wholist dfchat-who-more');
  const rows = find(root, 'dfchat-who-row');
  assert.ok(rows.length >= 3, `three rows (${rows.length})`);
  const long = rows.find((r) => one(r, 'dfchat-who-name')?.textContent === 'Palidriel Oakthorn');
  assert.ok(long, 'the long name has a row');
  assert.equal(shape(long), 'dfchat-who-line', 'the row is a block with one line in it');
  assert.equal(shape(long.children[0]), 'dfchat-who-name dfchat-who-glyph', 'name, glyph in the line - the Founder wears no title here');
  assert.equal(one(long, 'dfchat-who-title'), undefined, 'TITLE-R: no title on the roster');
  assert.equal(one(long, 'dfchat-who-name').title, 'Palidriel Oakthorn', 'the whole name is a hover away');
  const dup = rows.filter((r) => one(r, 'dfchat-who-name')?.textContent === 'Me');
  assert.equal(dup.length, 2); for (const r of dup) assert.ok(one(r, 'dfchat-who-tag'), 'a shared name carries its tag in the line');
});

test('CHAT-FIT: a chat LINE wears its author\'s badge - the title before the name, the glyphs after, the tag and the text after those; a system line none; an author the host does not know none; and the peek rows the same', () => {
  const badges = new Map([['p1', { title: 'founder', glyphs: ['sprout'] }], ['p3', { title: null, glyphs: ['dev', 'sprout'] }]]);
  const { root, log, panel } = mount({ badges });
  log.push('world', { id: 'p1', name: 'Icebreyker', text: 'hello', at: 1000 });
  log.push('world', { id: 'p2', name: 'Stranger', text: 'hi', at: 1000 });
  log.push('world', { id: 'p3', name: 'Dev', text: 'ok', at: 1000 });
  log.push('world', { id: '', name: '', text: 'notice', at: 1000, system: true });
  log.setOpen(true); panel.render?.(); panel.paint?.();
  const list = one(root, 'dfchat-list');
  const [l1, l2, l3, l4] = list.children;
  assert.equal(shape(l1), 'dfchat-time dfchat-line-title dfchat-name dfchat-line-glyph dfchat-tag dfchat-text', 'title before the name, glyph after it, then the tag and the text');
  assert.equal(one(l1, 'dfchat-line-title').textContent, TITLE_TEXT.founder);
  assert.equal(one(l1, 'dfchat-line-glyph').children[0].attrs.d, GLYPH_PATH.sprout, 'the glyph is the vocabulary\'s own path');
  assert.equal(shape(l2), 'dfchat-time dfchat-name dfchat-tag dfchat-text', 'an unknown author: no badge, the line as it was');
  assert.equal(shape(l3), 'dfchat-time dfchat-name dfchat-line-glyph dfchat-line-glyph dfchat-tag dfchat-text', 'two glyphs, no title');
  assert.equal(shape(l4), 'dfchat-time dfchat-text', 'a notice is not attributed and wears nothing');
  // the peek rows (closed state) wear the same
  log.setOpen(false); panel.render?.(); panel.paint?.();
  const peek = one(root, 'dfchat-peek');
  const p1 = peek.children.find((n) => one(n, 'dfchat-name')?.textContent === 'Icebreyker');
  assert.ok(p1, 'the peek shows the line'); assert.equal(shape(p1), 'dfchat-line-title dfchat-name dfchat-line-glyph dfchat-tag dfchat-text', 'no time in the peek, the badge the same');
});

test('CHAT-FIT: the badge pass re-lays a line ONLY when its author\'s badge changes - a title equipped mid-conversation reaches the lines already said, an unchanged answer touches nothing, and the name keeps its colour', () => {
  const badges = new Map([['p1', { title: null, glyphs: [] }]]);
  let colour = '';
  const doc = fakeDocument(), win = fakeWindow();
  const log = new ChatLog({ now: () => 1000 });
  const panel = createChatPanel({ log, onSend: () => true, doc, win, touch: false, action: () => null, overlay: () => false, badgeOf: (id) => badges.get(id) ?? null, nameColor: () => colour });
  const root = doc.body.children[0];
  log.push('world', { id: 'p1', name: 'Ice', text: 'a', at: 1000 }); log.setOpen(true); panel.render?.(); panel.paint?.();
  const line = one(root, 'dfchat-list').children[0];
  assert.equal(shape(line), 'dfchat-time dfchat-name dfchat-tag dfchat-text');
  const nameEl = one(line, 'dfchat-name');
  let lays = 0; const orig = line.replaceChildren; line.replaceChildren = (...cs) => { lays++; orig(...cs); };
  panel.render?.(); panel.paint?.(); panel.render?.();
  assert.equal(lays, 0, 'an unchanged badge touches nothing');
  badges.set('p1', { title: 'founder', glyphs: ['sprout'] }); colour = 'rgb(1, 2, 3)';
  panel.render?.(); panel.paint?.();
  assert.equal(lays, 1, 'one re-lay for the change'); assert.equal(shape(line), 'dfchat-time dfchat-line-title dfchat-name dfchat-line-glyph dfchat-tag dfchat-text');
  assert.equal(one(line, 'dfchat-name'), nameEl, 'the same name span, re-laid'); assert.equal(nameEl.style.color, 'rgb(1, 2, 3)', 'and the colour pass still paints it');
  badges.set('p1', { title: null, glyphs: [] });
  panel.render?.(); panel.paint?.();
  assert.equal(lays, 2); assert.equal(shape(line), 'dfchat-time dfchat-name dfchat-tag dfchat-text', 'a badge taken off leaves the line');
});

test('CHAT-FIT: a document with no SVG door draws no glyph and does not throw; without `badgeOf` no line wears a badge', () => {
  const badges = new Map([['p1', { title: 'founder', glyphs: ['sprout'] }]]);
  const { root, log, panel } = mount({ badges, svg: false });
  log.push('world', { id: 'p1', name: 'Ice', text: 'a', at: 1000 }); log.setOpen(true); panel.render?.(); panel.paint?.();
  assert.equal(shape(one(root, 'dfchat-list').children[0]), 'dfchat-time dfchat-line-title dfchat-name dfchat-tag dfchat-text', 'the title still, the glyph not');
  const doc = fakeDocument(), win = fakeWindow(); const log2 = new ChatLog({ now: () => 1000 });
  const panel2 = createChatPanel({ log: log2, onSend: () => true, doc, win, touch: false, action: () => null, overlay: () => false });
  log2.push('world', { id: 'p1', name: 'Ice', text: 'a', at: 1000 }); log2.setOpen(true); panel2.render?.(); panel2.paint?.();
  assert.equal(shape(one(doc.body.children[0], 'dfchat-list').children[0]), 'dfchat-time dfchat-name dfchat-tag dfchat-text');
});

test('CHAT-FIT: OnlineSession.badgeOf - mine as adopted, a peer in the room, a peer this session once met and has since lost, null for a stranger and for no id', () => {
  const s = new OnlineSession({ name: 'Me' });
  assert.deepEqual(s.badgeOf(s.id), { title: null, glyphs: [] }, 'mine, before the service spoke');
  s.adoptIdentity({ name: 'Me', title: 'founder', glyphs: ['sprout'] });
  assert.deepEqual(s.badgeOf(s.id), { title: 'founder', glyphs: ['sprout'] });
  s.peers.set('p1', { id: 'p1', name: 'Ice', title: 'dev', glyphs: ['dev'] });
  assert.deepEqual(s.badgeOf('p1'), { title: 'dev', glyphs: ['dev'] });
  s._remember('p2', { name: 'Gone', title: 'founder', glyphs: [], look: null });
  assert.deepEqual(s.badgeOf('p2'), { title: 'founder', glyphs: [] }, 'a peer who left is still signed');
  assert.equal(s.badgeOf('p9'), null); assert.equal(s.badgeOf(null), null); assert.equal(s.badgeOf(undefined), null);
  s.peers.set('p3', { id: 'p3', name: 'Odd', title: undefined, glyphs: 'nope' });
  assert.deepEqual(s.badgeOf('p3'), { title: null, glyphs: [] }, 'a malformed record answers a bare badge, not a throw');
});

test('CHAT-FIT: by source - the host hands the panel a `badgeOf` read off the ACTIVE CHANNEL\'s session, the one the roster reads, and the badge pass runs inside the name pass so every caller of one runs the other', () => {
  const w = rd('src/scenes/world.js');
  // CHAT-CHAN: both through the ACTIVE TAB's session (chatSessionOf) - the roster's composed lists (the Party's, the
  // Local's) are built over that same session, so one session still answers the badge and the row
  assert.match(w, /badgeOf: \(id\) => chatSessionOf\(chatLog\?\.active\)\?\.badgeOf\?\.\(id\) \?\? null,/);
  assert.match(w, /roster: \(\) => chatRosterOf\(chatLog\?\.active\),/, 'the same session the roster reads');
  assert.match(w, /const chatRosterOf = \(tabId\) => \{\s*const s = chatSessionOf\(tabId\);[^\n]*\n\s*if \(tabId === 'party'\) return partyRosterSource\(social\?\.party, s, [^\n]*\n\s*if \(tabId === 'local'\) return localRosterSource\(s, /, 'every roster over the one session');
  const p = rd('src/ui/chatPanel.js');
  assert.match(p, /const paintNames = \(\) => \{\s*if \(nameColor\) \{[\s\S]*?\}\s*paintBadges\(\);\s*\};/);
  assert.match(p, /if \(r\.badgeKey === key\) continue;/, 'a line is re-laid only on a change');
  // INSPECT1: the door moved to ui/playerBadge.js glyphSvgNode - the one drawing the name over a head and the profile card
  // share too - so the panel keeps NO svg door of its own, and its one glyph builder goes through that one
  assert.equal((p.match(/createElementNS/g) ?? []).length, 0, 'no svg door of the panel\'s own');
  assert.match(p, /const glyphSvg = \(g, cls\) => glyphSvgNode\(doc, g, cls\);/, 'ONE glyph builder, shared by the roster row and the chat line, through the one drawing');
  assert.equal((rd('src/ui/playerBadge.js').match(/doc\?\.createElementNS\?\.\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/g) ?? []).length, 1, '...which has ONE svg door');
});
