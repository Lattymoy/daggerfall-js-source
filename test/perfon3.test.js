// PERF-ON3 (2026-10-06, Mac: "I wanna look into how we can continue to improve performance, including for online"):
// THE CHAT ROSTER, DERIVED ONCE AND NOT ONCE A FRAME. The chat panel asks net/roster.js for its rows on every frame the
// chat is open, over everyone the hub knows; each ask rebuilt every row and sorted them with a localeCompare that
// constructs a collator per comparison - 9.3 ms a frame at 200 online, 24 at 500, measured over the real module. Now
// one collator, a row kept while its inputs are, an unchanged list not sorted again, and the panel told "nothing
// changed" by identity. These pins hold the answer to the old law's exactly (the old rosterRows is the oracle below,
// word for word from the commit before), the three savings by identity and by count, and the panel's repaint on every
// change it repainted on before.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rosterRows, ROSTER_ROWS_MAX, guildRosterSource, localRosterSource, partyRosterSource } from '../src/net/roster.js';
import { tagOf, ChatLog } from '../src/net/chat.js';
import { sanitizeName, readBadge, readGuildTag } from '../src/net/wire.js';
import { TITLES, GLYPHS, SEAT_TITLES } from '../src/net/identityToken.js';
import { createChatPanel } from '../src/ui/chatPanel.js';

// ── THE ORACLE: rosterRows as it stood before PERF-ON3, verbatim but for its name ──
function oracleRows(session) {
  const rows = [];
  const seen = new Set();
  const push = (id, name, me, from = null) => {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, name: sanitizeName(name), tag: tagOf(id), me, ...readBadge(from), gt: readGuildTag(from) });
  };
  push(session?.id ?? null, session?.name ?? '', true, session);
  for (const p of session?.peers?.values?.() ?? []) push(p?.id ?? null, p?.name ?? '', false, p);
  rows.sort((a, b) => {
    const n = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    return n !== 0 ? n : (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0);
  });
  const n = Number(session?.roomCount);
  const total = Number.isFinite(n) && n > rows.length ? n : rows.length;
  const label = typeof session?.label === 'string' && session.label ? session.label : 'Online';
  return { rows: rows.slice(0, ROSTER_ROWS_MAX), total, shown: Math.min(rows.length, ROSTER_ROWS_MAX), label };
}

/** a seeded roll (mulberry32), so every run walks the same story */
function roller(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NAMES = ['Bob', 'bob', 'BOB', 'Alfred', 'zara', 'Zara', 'Player9', 'Player10', 'Player1', 'edmund', 'Medora', '', '   ', 'Cum', 'Äsa', 'x'.repeat(40), 'Mac'];
const TAGS = ['HND', 'AB', 'ZZZZ', 'bad', 'TOOLONG', null, 7];

test('PERF-ON3: the roster is the old law\'s exactly, through every kind of change a session sees - joins, leaves, renames, a title, glyphs changed in place or swapped, a seat claim, a guild tag, my own badge, an impostor of my id, a cut list, and the tabs that compose a new source every frame (mutants: a row kept past a rename, a title, its glyphs in place, its claim, its tag or my own flag; the impostor listed twice)', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const roll = roller(seed);
    const pick = (a) => a[Math.floor(roll() * a.length)];
    const glyphs = () => { const g = []; const k = Math.floor(roll() * 4); for (let i = 0; i < k; i++) g.push(roll() < 0.8 ? pick(GLYPHS) : 'nonsense'); return g; };
    const peers = new Map();
    const me = { id: 'me-0000', name: 'Mac', title: null, glyphs: [], gt: 'HND', peers, roomCount: null };
    let nextId = 0;
    const join = () => { const id = `p-${seed}-${nextId++}`; peers.set(id, { id, name: `${pick(NAMES)}${roll() < 0.5 ? Math.floor(roll() * 30) : ''}`, title: roll() < 0.3 ? pick(TITLES) : null, glyphs: glyphs(), gt: roll() < 0.4 ? pick(TAGS) : null }); };
    for (let i = 0; i < 40 + seed * 40; i++) join();   // seed 5 and 6 pass ROSTER_ROWS_MAX: the cut is the same cut
    const any = () => [...peers.values()][Math.floor(roll() * peers.size)];
    const steps = [
      join,
      () => { const p = any(); if (p) peers.delete(p.id); },
      () => { const p = any(); if (p) p.name = pick(NAMES) + Math.floor(roll() * 12); },
      () => { const p = any(); if (p) p.title = roll() < 0.5 ? pick(TITLES) : null; },
      () => { const p = any(); if (p) p.glyphs.push(pick(GLYPHS)); },   // IN PLACE: the same array, one more glyph
      () => { const p = any(); if (p && p.glyphs.length) p.glyphs[0] = pick(GLYPHS); },   // in place, one swapped
      () => { const p = any(); if (p) p.glyphs = glyphs(); },
      () => { const p = any(); if (p) { p.title = pick(SEAT_TITLES); p.ts = [Math.floor(roll() * 1e6), Math.floor(roll() * 9999)]; } },
      () => { const p = any(); if (p && Array.isArray(p.ts)) p.ts[1] = (p.ts[1] + 1) % 9999; },   // a claim changed in place
      () => { const p = any(); if (p) p.gt = pick(TAGS); },
      () => { me.name = pick(NAMES); },
      () => { me.title = roll() < 0.5 ? pick(TITLES) : null; me.glyphs = glyphs(); },
      () => { me.glyphs.push(pick(GLYPHS)); },
      () => { me.roomCount = roll() < 0.5 ? peers.size + Math.floor(roll() * 400) : null; },
      () => { peers.set(me.id, { id: me.id, name: 'Impostor', title: null, glyphs: [] }); },   // a peer wearing my id: I am listed once, as me
      () => { peers.delete(me.id); },
    ];
    for (let s = 0; s < 260; s++) {
      if (s % 3) pick(steps)();
      // the tabs, as world.js's chatRosterOf hands them: the session itself, a placed region over the same Map, the
      // guild's and the nearby's composed lists over the same peers, and the party's of copies - each a NEW source
      const src = [
        () => me,
        () => ({ id: me.id, name: me.name, title: me.title, glyphs: me.glyphs, gt: me.gt, peers: me.peers, roomCount: me.roomCount, label: 'Wayrest' }),
        () => guildRosterSource(me, 'HND'),
        () => localRosterSource(me, [...peers.values()].filter((_, i) => i % 3 === 0).map((p) => ({ id: p.id, feet: [1, 0, 1] })), [0, 0, 0]),
        () => partyRosterSource({ members: [...peers.values()].slice(0, 4).map((p) => ({ acct: `a-${p.id}`, name: p.name, peers: [p.id] })) }, me, 'a-me'),
        () => null,
      ][s % 11 < 6 ? 0 : Math.floor(roll() * 6)]();
      const got = rosterRows(src), want = oracleRows(src);
      assert.deepEqual({ ...got, rows: [...got.rows] }, want, `seed ${seed}, step ${s}`);
      if (s % 7 === 0) { const again = rosterRows(src); assert.deepEqual({ ...again, rows: [...again.rows] }, want, `seed ${seed}, step ${s}, asked twice`); }
    }
  }
  // MY OWN FLAG IS AN INPUT TOO: one id, the list's own in one source and a peer in the next, its name and badge alike
  const x = { id: 'id-x', name: 'Sam', title: 'founder', glyphs: ['dev'] }, y = { id: 'id-y', name: 'Kim', glyphs: [] };
  const asX = { ...x, peers: new Map([['id-y', y]]) }, asY = { ...y, peers: new Map([['id-x', x]]) };
  for (const src of [asX, asY, asX, asY]) {
    const got = rosterRows(src);
    assert.deepEqual({ ...got, rows: [...got.rows] }, oracleRows(src));
  }
  assert.deepEqual(rosterRows(asY).rows.map((r) => [r.id, r.me]), [['id-y', true], ['id-x', false]], 'Sam is a peer in Kim\'s list');
});

test('PERF-ON3: an unchanged roster is the SAME frozen list, a row is kept while its inputs are, and the sort asks no localeCompare (mutants: the list sorted again every ask; every row made again; the per-comparison localeCompare back)', () => {
  const peers = new Map();
  for (let i = 0; i < 150; i++) peers.set(`id-${i}`, { id: `id-${i}`, name: `Name${i % 37}`, title: null, glyphs: i % 5 ? [] : ['sprout'], gt: i % 4 ? null : 'HND' });
  const me = { id: 'me', name: 'Mac', glyphs: [], peers, roomCount: 512 };
  assert.ok(peers.size < ROSTER_ROWS_MAX, 'every row shown, so a renamed one is found wherever it sorts');
  const a = rosterRows(me);
  assert.ok(Object.isFrozen(a.rows), 'what the panel is handed cannot be changed under the next ask');
  assert.equal(rosterRows(me).rows, a.rows, 'asked again over nothing new: the very same list');
  // the tabs that compose a NEW source each frame over the same peers are no news either
  const world = () => ({ id: 'me', name: 'Mac', glyphs: [], peers, roomCount: 512 });
  const w1 = rosterRows(world());
  assert.equal(rosterRows(world()).rows, w1.rows, 'a new source over the same peers: the same list');
  const g1 = rosterRows(guildRosterSource(me, 'HND'));
  assert.equal(rosterRows(guildRosterSource(me, 'HND')).rows, g1.rows, 'the guild tab composed afresh: the same list');
  // a rename is one new row; every other row is the row it was
  const before = new Map(rosterRows(me).rows.map((r) => [r.id, r]));
  peers.get('id-7').name = 'Renamed';
  const after = rosterRows(me).rows;
  assert.notEqual(after, a.rows, 'a change is a new list');
  assert.equal(after.find((r) => r.id === 'id-7').name, 'Renamed');
  assert.notEqual(after.find((r) => r.id === 'id-7'), before.get('id-7'), 'the renamed row is made again');
  let kept = 0;
  for (const r of after) if (r.id !== 'id-7' && before.get(r.id) === r) kept++;
  assert.equal(kept, after.filter((r) => r.id !== 'id-7' && before.has(r.id)).length, 'and every other row is the one it was');
  // the sort's comparison is the one collator's: not one localeCompare, even when a join forces a sort
  const lc = String.prototype.localeCompare;
  let asked = 0;
  String.prototype.localeCompare = function (...args) { asked++; return lc.apply(this, args); };   // eslint-disable-line no-extend-native
  try {
    peers.set('late', { id: 'late', name: 'Latecomer' });
    const sorted = rosterRows(me);
    assert.ok(sorted.rows.some((r) => r.id === 'late'), 'the join is listed');
  } finally { String.prototype.localeCompare = lc; }   // eslint-disable-line no-extend-native
  assert.equal(asked, 0, 'no comparison built a collator of its own');
});

// ── THE PANEL (chat1.test.js's fake DOM) ──
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t, e = {}) { const ev = { type: t, target: n, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
    blur() { n.focused = false; if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
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
const fakeWindow = () => ({ addEventListener() {}, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

test('PERF-ON3: the panel repaints the roster on every change it repainted on before - a join, a leave, a rename, a glyph, the room\'s count, the tab\'s word, an opened row - and on none of the frames between (mutants: the short-circuit blind to the count, to the word, or to the open row)', () => {
  const doc = fakeDocument();
  const peers = new Map([['p-bob', { id: 'p-bob', name: 'Bob', glyphs: [] }], ['p-zed', { id: 'p-zed', name: 'Zed', glyphs: [] }]]);
  let source = () => ({ id: 'p-me', name: 'Mac', glyphs: [], peers, roomCount: null });   // a NEW source every frame, as world.js composes one
  const panel = createChatPanel({ log: new ChatLog(), onSend: () => true, roster: () => source(), action: (e) => (e.code === 'Enter' ? 'ActivateCursor' : null), doc, win: fakeWindow(), touch: false, rowActions: () => [{ label: 'Add friend', enabled: true, run() {} }] });
  const root = doc.body.children[0];
  panel.open();
  const rows = () => find(root, 'dfchat-who-row');
  const names = () => rows().map((r) => one(r, 'dfchat-who-name').textContent);
  const head = () => one(root, 'dfchat-whohead').textContent;
  assert.deepEqual(names(), ['Bob', 'Mac', 'Zed']);
  const drawn = rows();
  for (let i = 0; i < 6; i++) panel.render();
  assert.ok(rows().length === drawn.length && rows().every((r, i) => r === drawn[i]), 'six frames of nothing new: not one row drawn again');
  peers.set('p-ann', { id: 'p-ann', name: 'Ann', glyphs: [] });
  panel.render();
  assert.deepEqual(names(), ['Ann', 'Bob', 'Mac', 'Zed'], 'a join is a row on the next frame');
  peers.delete('p-zed');
  panel.render();
  assert.deepEqual(names(), ['Ann', 'Bob', 'Mac'], 'a leave takes it');
  peers.get('p-bob').name = 'Robert';
  panel.render();
  assert.deepEqual(names(), ['Ann', 'Mac', 'Robert'], 'a rename is drawn');
  const glyphed = rows();
  peers.get('p-ann').glyphs.push('sprout');
  panel.render();
  assert.ok(rows().every((r, i) => r !== glyphed[i]), 'a glyph earned in place repaints the list');
  assert.match(head(), /3$/, 'three online');
  source = () => ({ id: 'p-me', name: 'Mac', glyphs: [], peers, roomCount: 640 });
  panel.render();
  assert.match(head(), /640$/, 'the room\'s own count, the same people listed: the heading says it');
  source = () => ({ id: 'p-me', name: 'Mac', glyphs: [], peers, roomCount: 640, label: 'Wayrest' });
  panel.render();
  assert.match(head(), /^Wayrest/, 'the same people under another tab\'s word: the heading says that too');
  const opened = rows().find((r) => one(r, 'dfchat-who-name').textContent === 'Ann');
  opened.fire('click');
  assert.equal(find(root, 'dfchat-rowmenu').length, 1, 'an opened row is a change: its menu is drawn');
  rows().find((r) => one(r, 'dfchat-who-name').textContent === 'Ann').fire('click');
  assert.equal(find(root, 'dfchat-rowmenu').length, 0, 'and shut again');
  panel.destroy?.();
});
