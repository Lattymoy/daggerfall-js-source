// CHAT-FIND (2026-10-11, the owner: "search for a player's name in the chat in every ui"; "put the search bar above the
// player list for better visibility"): THE CHAT'S SEARCH. BY EXECUTION: the law (net/chat.js) - a piece of a name, case
// and spaces ignored, or '#' the start of a tag; a line said BY the player or naming them, never a line the game said;
// every tab's lines, oldest first, a shared line once - and `/search` (net/chatCommands.js); then the panel
// (ui/chatPanel.js), which is the one chat on the classic skin, the enhanced skin and the touch layer: the field above
// the player list (over the conversation where the list is not drawn), the results drawn from every tab with the tab's
// mark and the query marked, the roster filtered and counted, the field's keys kept from the game, Escape clearing
// then closing, a tab or a close clearing, `/search` filling it and sending nothing. `/find` and `/who` are the hub's
// search of everyone online (SCALE5c, test/net/scale5c.test.js), never the panel's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChatLog, tagOf, findQuery, playerFound, lineFound, findLines, CHAT_FIND_MAX } from '../../src/net/chat.js';
import { findCommandOf, FIND_COMMANDS, HELP_LINES, parseChatLine } from '../../src/net/chatCommands.js';
import { createChatPanel } from '../../src/ui/chatPanel.js';
import { rosterRows } from '../../src/net/roster.js';

// ─── THE LAW ────────────────────────────────────────────────────────────────────────────────────────────────────

test('CHAT-FIND law: a query is a piece of a name, case and the spaces round it ignored, bounded; "#" is the start of a tag; a line is found by its speaker or by its words naming them, and a line the game said is nobody\'s (mutants: case kept; the tag read as a name; a notice found; the words never searched)', () => {
  assert.equal(findQuery('  AnN '), 'ann');
  assert.equal(findQuery(null), '');
  assert.equal(findQuery('x'.repeat(50)).length, CHAT_FIND_MAX);
  assert.equal(playerFound('Annalise', 'p1', 'NAL'), true, 'any piece, any case');
  assert.equal(playerFound('Annalise', 'p1', 'bor'), false);
  assert.equal(playerFound('Annalise', 'p1', ''), false, 'no query finds nobody');
  const tag = tagOf('p1');
  assert.equal(playerFound('Ann', 'p1', `#${tag.slice(0, 2)}`), true, 'the start of the tag');
  assert.equal(playerFound('Ann', 'p2', `#${tag}`), tagOf('p2').startsWith(tag), 'another id is another tag');
  assert.equal(playerFound('#tagged', 'p1', '#'), false, 'a bare # finds nobody');
  const said = { id: 'p1', name: 'Annalise', text: 'hello' };
  assert.equal(lineFound(said, 'anna'), true, 'by the speaker');
  assert.equal(lineFound({ id: 'p2', name: 'Cid', text: '@Annalise deal' }, 'anna'), true, 'by the words naming them');
  assert.equal(lineFound({ id: 'p2', name: 'Cid', text: '@Annalise deal' }, `#${tag}`), false, 'a tag is the speaker\'s alone');
  assert.equal(lineFound({ id: '', name: '', text: 'Annalise is banned', system: true }, 'anna'), false, 'the game\'s line is nobody\'s');
  assert.equal(lineFound(said, ''), false);
});

test('CHAT-FIND law: the results are EVERY tab\'s lines - a hidden tab\'s too - oldest first, a line kept on two tabs once (mutants: the active tab alone; the order by tab; a shared line twice)', () => {
  const log = new ChatLog({ now: () => 0 });
  log.push('world', { id: 'a', name: 'Ann', text: 'one' });
  log.push('region', { id: 'b', name: 'Bob', text: 'two, to Ann' });
  log.push('party', { id: 'a', name: 'Ann', text: 'three' });   // the Party tab is off the bar outside a party: its history still counts
  log.push('world', { id: 'c', name: 'Cid', text: 'four' });
  log.push('local', { id: 'a', name: 'Ann', text: 'five' });
  assert.deepEqual(findLines(log.tabs, 'ann').map((l) => l.text), ['one', 'two, to Ann', 'three', 'five']);
  const shared = log.tab('world').messages[0];
  log.tab('region').messages.push(shared);
  assert.equal(findLines(log.tabs, 'ann').filter((l) => l === shared).length, 1, 'a line on two tabs is one result');
  assert.deepEqual(findLines(log.tabs, ''), []);
});

test('CHAT-FIND /search fills the search (alone, it clears it); /help says so; the host\'s parser never reads it as its own, and /find and /who stay the hub\'s (mutants: the hub\'s /find taken; the rest of the line dropped)', () => {
  assert.deepEqual([...FIND_COMMANDS], ['search']);
  assert.deepEqual(findCommandOf('/search Ann Lise '), { query: 'Ann Lise' });
  assert.deepEqual(findCommandOf('/SEARCH bob'), { query: 'bob' });
  assert.deepEqual(findCommandOf('/search'), { query: '' });
  assert.equal(findCommandOf('/searcher x'), null);
  assert.equal(findCommandOf('search bob'), null);
  assert.equal(findCommandOf('/w bob'), null);
  assert.equal(findCommandOf('/find bob'), null, '/find is the hub\'s search of everyone online (SCALE5c)');
  assert.equal(findCommandOf('/who bob'), null);
  assert.ok(HELP_LINES.some((l) => l.startsWith('/search <name>')), '/help says it');
  assert.equal(parseChatLine('/search bob').kind, 'unknown', 'the panel answers it before the host is asked');
  assert.deepEqual(parseChatLine('/find bob'), { kind: 'find', q: 'bob' }, 'and the host still answers /find');
});

// ─── THE PANEL ──────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', title: '', placeholder: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; const i = n.children.indexOf(ref); n.children.splice(i < 0 ? n.children.length : i, 0, c); return c; },
    replaceChildren(...cs) { for (const c of n.children) c.parent = null; n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, stopped: false, prevented: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, stopImmediatePropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; }, blur() { if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** A window whose keydown listener the test can press through, at a width. */
function fakeWindow(innerWidth = 1280) {
  const keys = [];
  return { innerWidth, innerHeight: 800, keys, addEventListener(t, fn) { if (t === 'keydown') keys.push(fn); }, removeEventListener() {},
    press(target, code, more = {}) { const ev = { code, target, isTrusted: true, stopped: false, prevented: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, stopImmediatePropagation() { ev.stopped = true; }, ...more }; for (const fn of keys) fn(ev); return ev; } };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
/** The words a fake node draws: its children's, or its own text. */
const textOf = (n) => (n.children.length ? n.children.map(textOf).join('') : String(n.textContent ?? ''));
const has = (n, cls) => String(n.className).split(/\s+/).includes(cls);

function rig({ width = 1280, roster = true } = {}) {
  let clock = 1000;
  const log = new ChatLog({ now: () => clock++ });
  log.push('world', { id: 'p-ann', name: 'Annalise', text: 'selling a sword?' });
  log.push('world', { id: 'p-bor', name: 'Borgrim', text: 'try the armorer' });
  log.push('region', { id: 'p-ann', name: 'Annalise', text: 'meet at the gate' });
  log.push('world', { id: 'p-cid', name: 'Cidric', text: '@Annalise 400 gold' });
  log.pushAll({ text: 'Annalise was named in a notice.' });
  const session = { id: 'p-me', name: 'Mac', peers: new Map([['p-ann', { id: 'p-ann', name: 'Annalise' }], ['p-bor', { id: 'p-bor', name: 'Borgrim' }], ['p-anna', { id: 'p-anna', name: 'Anna' }]]) };
  const sent = [];
  const doc = fakeDocument(), win = fakeWindow(width);
  const panel = createChatPanel({ log, onSend: (tab, text) => { sent.push([tab, text]); return true; }, roster: roster ? () => session : null, action: () => null, doc, win, touch: false });
  const root = doc.body.children[0];
  return { log, panel, root, doc, win, sent, search: one(root, 'dfchat-search'), input: one(root, 'dfchat-input'), list: one(root, 'dfchat-list'), row: one(root, 'dfchat-find') };
}
const type = (field, v) => { field.value = v; field.fire('input'); };

test('CHAT-FIND panel: the field stands ABOVE THE PLAYER LIST - before the roster\'s heading - and over the conversation where the list is not drawn (a narrow screen, no roster) (mutants: the strip left over the conversation; the strip lost on a phone)', () => {
  const wide = rig();
  wide.panel.open(); wide.panel.render({});
  const whoInner = one(wide.root, 'dfchat-who-inner');
  assert.equal(wide.row.parent, whoInner, 'in the roster column');
  assert.equal(whoInner.children.indexOf(wide.row), 0, 'above the heading');
  assert.equal(whoInner.children[1], one(wide.root, 'dfchat-whohead'));
  assert.equal(wide.search.placeholder, 'Find a player');
  assert.equal(wide.search.attrs.role, 'searchbox');
  const phone = rig({ width: 420 });
  phone.panel.open(); phone.panel.render({});
  const main = one(phone.root, 'dfchat-main');
  assert.equal(phone.row.parent, main, 'the column is not drawn under 560px: over the conversation');
  assert.equal(main.children.indexOf(phone.row), main.children.indexOf(phone.list) - 1, 'right above the lines');
  const none = rig({ roster: false });
  none.panel.open(); none.panel.render({});
  assert.equal(none.row.parent, one(none.root, 'dfchat-main'), 'a host with no roster has no column to stand in');
  for (const r of [wide, phone, none]) r.panel.destroy();
});

test('CHAT-FIND panel: a name typed shows every tab\'s lines from or about that player - another tab\'s marked with its channel, the query marked where it stands, the game\'s line left out - counts them, and filters and counts the player list; cleared, the conversation is back (mutants: the open tab alone; no channel mark; no highlight; the roster unfiltered)', () => {
  const r = rig();
  r.panel.open(); r.panel.render({});
  type(r.search, 'ANNA');
  r.panel.render({});
  const lines = find(r.list, 'dfchat-line');
  assert.deepEqual(lines.map((n) => textOf(one(n, 'dfchat-text'))), ['selling a sword?', 'meet at the gate', '@Annalise 400 gold'], 'world, region, the line naming her - not the notice');
  assert.deepEqual(lines.map((n) => one(n, 'dfchat-chan')?.textContent ?? null), [null, 'Region', null], 'a line from another tab says which');
  assert.deepEqual(find(lines[0], 'dfchat-hit').map((m) => m.textContent), ['Anna'], 'the name marked where the query stands');
  assert.equal(textOf(one(lines[0], 'dfchat-name')), 'Annalise', 'and the name is still the whole name');
  assert.deepEqual(find(lines[2], 'dfchat-hit').map((m) => m.textContent), ['Anna'], 'the words marked too');
  assert.equal(one(r.root, 'dfchat-find-count').textContent, '3 lines');
  assert.ok(has(r.row, 'on'), 'the clear is shown');
  assert.deepEqual(find(r.root, 'dfchat-who-name').map((n) => n.textContent), ['Anna', 'Annalise'], 'the player list: those the name finds');
  assert.equal(one(r.root, 'dfchat-whohead').textContent, 'Online — 2 of 4');
  assert.equal(r.panel.query(), 'anna');
  type(r.search, 'zed');
  r.panel.render({});
  assert.equal(find(r.list, 'dfchat-line').length, 1);
  assert.ok(has(r.list.children[0], 'dfchat-find-none'), 'nothing found says so');
  assert.equal(one(r.root, 'dfchat-who-more').textContent, 'No one here by that name');
  one(r.root, 'dfchat-find-clear').fire('click');
  r.panel.render({});
  assert.equal(r.panel.query(), '');
  assert.equal(r.search.value, '');
  assert.deepEqual(find(r.list, 'dfchat-line').map((n) => textOf(one(n, 'dfchat-text'))), ['selling a sword?', 'try the armorer', '@Annalise 400 gold', 'Annalise was named in a notice.'], 'the World conversation, as it was');
  assert.equal(find(r.root, 'dfchat-who-name').length, 4, 'and everyone online');
  assert.equal(r.doc.activeElement, r.search, 'the clear leaves the caret in the field');
  r.panel.destroy();
});

test('CHAT-FIND panel: a "#" query finds one player of a shared name by the tag beside it, and marks that tag (mutant: the tag never searched)', () => {
  const r = rig();
  r.panel.open();
  type(r.search, `#${tagOf('p-ann')}`);
  r.panel.render({});
  const lines = find(r.list, 'dfchat-line');
  assert.equal(lines.length, 2, 'her two lines, not the line naming her');
  assert.equal(textOf(one(lines[0], 'dfchat-tag')), `#${tagOf('p-ann')}`);
  assert.equal(find(one(lines[0], 'dfchat-tag'), 'dfchat-hit').length, 1);
  assert.deepEqual(find(r.root, 'dfchat-who-name').map((n) => n.textContent), ['Annalise']);
  r.panel.destroy();
});

test('CHAT-FIND panel: the field\'s keys are the panel\'s (the game never walks on a name); Enter goes to the chat field, Tab too; Escape clears a search and on an empty one closes the chat; a tab pressed or a close clears it (mutants: keys reaching the game; Escape closing over a search; a search outliving the close)', () => {
  const r = rig();
  r.panel.open();
  type(r.search, 'bor');
  const w = r.win.press(r.search, 'KeyW');
  assert.ok(w.stopped, 'a letter typed in the field stops there');
  const enter = r.win.press(r.search, 'Enter');
  assert.ok(enter.prevented && enter.stopped);
  assert.equal(r.doc.activeElement, r.input, 'Enter: back to the chat field');
  assert.equal(r.panel.query(), 'bor', 'the search holds');
  r.search.focus();
  r.win.press(r.search, 'Tab');
  assert.equal(r.doc.activeElement, r.input);
  r.win.press(r.search, 'Escape');
  assert.equal(r.panel.query(), '', 'Escape clears the search first');
  assert.equal(r.log.open, true, 'and leaves the chat up');
  r.win.press(r.search, 'Escape');
  assert.equal(r.log.open, false, 'an empty field\'s Escape closes it, as the chat field\'s does');
  r.panel.open();
  type(r.search, 'bor');
  one(r.root, 'dfchat-tab').fire('click');
  assert.equal(r.panel.query(), '', 'a tab pressed is that tab\'s conversation');
  type(r.search, 'bor');
  r.panel.close();
  assert.equal(r.panel.query(), '', 'a close clears it');
  assert.equal(r.search.value, '');
  r.panel.destroy();
});

test('CHAT-FIND panel: /search <name> in the chat field fills the search and sends NOTHING; /search alone clears it; the panel\'s find() opens the chat on a search (mutants: /search sent to the room; the field kept)', () => {
  const r = rig();
  r.panel.open();
  r.input.value = '/search Borg';
  one(r.root, 'dfchat-form').fire('submit');
  assert.deepEqual(r.sent, [], 'nothing said to anyone');
  assert.equal(r.input.value, '', 'the field clears');
  assert.equal(r.search.value, 'Borg');
  assert.equal(r.panel.query(), 'borg');
  assert.equal(r.log.open, true, 'and the chat stays open on the results');
  r.panel.render({});
  assert.deepEqual(find(r.list, 'dfchat-line').map((n) => textOf(one(n, 'dfchat-name'))), ['Borgrim']);
  r.input.value = '/search';
  one(r.root, 'dfchat-form').fire('submit');
  assert.equal(r.panel.query(), '');
  r.input.value = 'hello';
  one(r.root, 'dfchat-form').fire('submit');
  assert.deepEqual(r.sent, [['world', 'hello']], 'a line is still a line');
  r.panel.close();
  assert.equal(r.panel.find('ann'), 'ann');
  assert.equal(r.log.open, true, 'find() opens the chat on it');
  r.panel.destroy();
});

// ─── CHAT-FIND-HUB: past what this client knows, the hub's own search ───────────────────────────────────────────────

test('CHAT-FIND-HUB law: the hub\'s answer to the box (`hubFound`) joins the uncut list the search filters - each player once (mine my session\'s), by name, the same frozen array while nothing moved - and never the drawn rows (mutants: the answer unread; a known player twice; the answer unsorted; a stale memo)', () => {
  const peers = new Map([['p-bor', { id: 'p-bor', name: 'Borgrim' }]]);
  const hubFound = { q: 'o', l: [{ id: 'p-obr', name: 'Obrin' }, { id: 'p-me', name: 'Mac' }, { id: 'p-bor', name: 'Borgrim' }, null, { id: 'p-ado', name: 'Adolf' }] };
  const session = { id: 'p-me', name: 'Mac', peers, hubFound };
  const r = rosterRows(session);
  assert.deepEqual(r.all.map((x) => [x.id, x.name, x.me]), [['p-ado', 'Adolf', false], ['p-bor', 'Borgrim', false], ['p-me', 'Mac', true], ['p-obr', 'Obrin', false]], 'each once, by name, mine my own');
  assert.equal(r.all.find((x) => x.id === 'p-obr').tag, tagOf('p-obr'));
  assert.ok(Object.isFrozen(r.all) && Object.isFrozen(r.all[0]));
  assert.deepEqual(r.rows.map((x) => x.name), ['Borgrim', 'Mac'], 'the column draws what this client knows');
  assert.equal(r.total, 2);
  assert.equal(rosterRows(session).all, r.all, 'the same frozen array while nothing moved');
  const none = rosterRows({ id: 'p-me', name: 'Mac', peers });
  assert.deepEqual(none.all.map((x) => x.name), ['Borgrim', 'Mac'], 'no answer, no more');
});

test('CHAT-FIND-HUB panel: a name typed on a roster that knows fewer than are online asks the hub (the source\'s askFind), and the players it found join the list and its count; cleared, the ask is let go (mutants: the box never asks; the answer unread)', () => {
  let clock = 1000;
  const log = new ChatLog({ now: () => clock++ });
  const asked = [];
  const session = { id: 'p-me', name: 'Mac', roomCount: 600, hubFound: null, peers: new Map([['p-ann', { id: 'p-ann', name: 'Annalise' }]]), askFind(q) { asked.push(q); if (!q) this.hubFound = null; } };
  const doc = fakeDocument(), win = fakeWindow(1280);
  const panel = createChatPanel({ log, onSend: () => true, roster: () => session, action: () => null, doc, win, touch: false });
  const root = doc.body.children[0];
  panel.open(); panel.render({});
  type(one(root, 'dfchat-search'), 'ann');
  panel.render({});
  assert.equal(asked.at(-1), 'ann', 'the box asks');
  assert.deepEqual(find(root, 'dfchat-who-name').map((n) => n.textContent), ['Annalise'], 'the shard\'s own, until the hub answers');
  session.hubFound = { q: 'ann', l: [{ id: 'p-anx', name: 'Annabeth' }, { id: 'p-ann', name: 'Annalise' }] };
  panel.render({});
  assert.deepEqual(find(root, 'dfchat-who-name').map((n) => n.textContent), ['Annabeth', 'Annalise'], 'everyone online the hub found, once each');
  assert.equal(one(root, 'dfchat-whohead').textContent, 'Online — 2 of 600');
  assert.equal(one(root, 'dfchat-who-more').textContent, '');
  one(root, 'dfchat-find-clear').fire('click');
  panel.render({});
  assert.equal(asked.at(-1), '', 'cleared: the answer let go');
  assert.deepEqual(find(root, 'dfchat-who-name').map((n) => n.textContent), ['Annalise', 'Mac'], 'the list as it was');
  panel.destroy();
});
