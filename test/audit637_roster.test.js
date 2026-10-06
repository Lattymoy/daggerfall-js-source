// AUDIT 637 (2026-10-06, Mac: "Audit this"), the roster lens: PR #637's PERF-ON3 (net/roster.js, ui/chatPanel.js
// paintWho) and the friends list's order beside it (ui/socialPanel.js friendOrder), audited. bible/01-Overview/Audit-637.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rosterRows, ROSTER_ROWS_MAX, ROW_MEMO_MAX, NAME_ORDER } from '../src/net/roster.js';
import { tagOf, ChatLog } from '../src/net/chat.js';
import { sanitizeName, readBadge, readGuildTag } from '../src/net/wire.js';
import { SEAT_TITLES } from '../src/net/identityToken.js';
import { createChatPanel } from '../src/ui/chatPanel.js';
import { friendOrder } from '../src/ui/socialPanel.js';

// ── THE ORACLE: rosterRows as it stood before PERF-ON3, verbatim but for its name (test/perfon3.test.js's) ──
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
const law = (src, what) => { const got = rosterRows(src); assert.deepEqual({ ...got, rows: [...got.rows] }, oracleRows(src), what); return got; };
const source = (peers, extra = {}) => ({ id: 'me-0000', name: 'Mac', glyphs: [], peers, roomCount: null, ...extra });

// ─── A2, A7: every input by SameValue, arrays or not ─────────────────────────────────────────────────────────────

test('AUDIT 637 A2/A7: a row follows every input that is NOT an array as well - a seat claim taken off or put back under an unchanged seat title, glyphs gone to null or undefined and back - and every input by SameValue, so a claim of -0 and one of 0 are two rows (mutants: a non-array input never a change; the elements compared with !==)', () => {
  const seat = SEAT_TITLES[0];
  const p = { id: 'p-claim', name: 'Claimant', title: seat, ts: [12, 3], glyphs: ['dev'] };
  const src = source(new Map([[p.id, p]]));
  const row = () => rosterRows(src).rows.find((r) => r.id === p.id);
  law(src, 'claimed');
  assert.deepEqual(row().ts, [12, 3], 'the claim is on the row');
  p.ts = null; law(src, 'the claim taken off, the title kept');
  assert.equal(row().ts, undefined);
  p.ts = [12, 3]; law(src, 'and put back');
  delete p.ts; law(src, 'deleted, the title kept');
  p.ts = [-0, 3]; law(src, 'a claim of -0');
  assert.ok(Object.is(row().ts[0], -0));
  p.ts = [0, 3]; law(src, 'and of 0 - SameValue tells them apart, as a fresh row would');
  assert.ok(Object.is(row().ts[0], 0));
  p.glyphs = null; law(src, 'glyphs gone to null');
  p.glyphs = ['dev']; law(src, 'and back');
  p.glyphs = undefined; law(src, 'to undefined');
  p.glyphs = ['dev']; law(src, 'and back again');
});

// ─── A3: the order's options, all of them ────────────────────────────────────────────────────────────────────────

test('AUDIT 637 A3: names with a space or punctuation inside are ordered as the old law ordered them - "Sir Bob" before "SirBob", "a-b" apart from "ab" - and the one collator is the old call\'s: the default locale, numeric, base, punctuation counted (mutants: punctuation ignored, so the tag decides a tie the name did not make; a fixed locale)', () => {
  const names = ['SirBob', 'Sir Bob', 'ab', 'a-b', 'ONeil', "O'Neil", 'JR', 'J.R.', 'Bob2', 'Bob_2', 'Bob 2', 'Bob10', 'bob 1'];
  // ids whose tags run against the names, so a name the collator wrongly ties is decided the other way by the tag
  const ids = names.map((_, i) => `id-${String(names.length - i).padStart(3, '0')}`);
  const peers = new Map(names.map((n, i) => [ids[i], { id: ids[i], name: n, glyphs: [] }]));
  law(source(peers), 'spaced and punctuated names');
  const o = NAME_ORDER.resolvedOptions();
  assert.equal(o.locale, new Intl.Collator().resolvedOptions().locale, 'the default locale, as localeCompare(b, undefined) took it');
  assert.deepEqual([o.numeric, o.sensitivity, o.ignorePunctuation], [true, 'base', false]);
});

// ─── A4, A5: the memo's bound ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT 637 A4/A5: past ROW_MEMO_MAX the memo lets go of the rows the last ask did not list - and only those: a listing past the bound asked twice is the same list the second time, and a row unlisted since is made afresh, the answer the law\'s throughout (mutants: the whole memo cleared, so every live row was made and sorted again; nothing let go, so the memo grows without end; the last ask\'s rows let go too)', () => {
  const lone = { id: 'aaa-lone', name: 'Lone', glyphs: [] };
  const big = new Map();
  for (let i = 0; i < ROW_MEMO_MAX + 200; i++) big.set(`b-${i}`, { id: `b-${i}`, name: `Crowd${i}`, glyphs: [] });
  const loneSrc = source(new Map([[lone.id, lone]]));
  const first = law(loneSrc, 'the lone row listed').rows.find((r) => r.id === lone.id);
  const crowd = source(big, { roomCount: big.size });
  const c1 = law(crowd, 'a listing past the bound').rows;
  const c2 = law(crowd, 'asked again').rows;
  assert.equal(c2, c1, 'past the bound, an unchanged listing is still the same list - the last ask\'s rows were kept');
  law(loneSrc, 'the lone row again');
  assert.notEqual(rosterRows(loneSrc).rows.find((r) => r.id === lone.id), first, 'unlisted since the bound was passed: let go, and made afresh');
});

// ─── A6: no half-made state ──────────────────────────────────────────────────────────────────────────────────────

test('AUDIT 637 A6: an ask that throws while it makes its answer leaves nothing half-made - the next ask of that listing is the law\'s answer, not the list before it (mutants: the listing committed before its answer)', () => {
  const peers = new Map([['p-a', { id: 'p-a', name: 'Ann', glyphs: [] }], ['p-b', { id: 'p-b', name: 'Bea', glyphs: [] }]]);
  const src = source(peers);
  law(src, 'two');
  peers.set('p-c', { id: 'p-c', name: 'Cal', glyphs: [] });
  const freeze = Object.freeze;
  const isAnswer = (x) => Array.isArray(x) && x.length === 4 && x.every((r) => r !== null && typeof r === 'object' && 'tag' in r);
  Object.freeze = (x) => { if (isAnswer(x)) throw new Error('the answer could not be made'); return freeze(x); };
  try { assert.throws(() => rosterRows(src), /could not be made/); } finally { Object.freeze = freeze; }
  law(src, 'the next ask of the same listing');
});

// ─── A9: what is shared is frozen ────────────────────────────────────────────────────────────────────────────────

test('AUDIT 637 A9: every row handed out is frozen whole, its glyphs and its claim with it - a kept row is the same object for every ask and every caller (mutants: the row left open; its arrays left open)', () => {
  const peers = new Map([['p-a', { id: 'p-a', name: 'Ann', title: SEAT_TITLES[0], ts: [5, 1], glyphs: ['dev'] }], ['p-b', { id: 'p-b', name: 'Bea', glyphs: [] }]]);
  const { rows } = law(source(peers), 'two');
  for (const r of rows) {
    assert.ok(Object.isFrozen(r), `${r.name}'s row`);
    assert.ok(Object.isFrozen(r.glyphs), `${r.name}'s glyphs`);
    if (r.ts) assert.ok(Object.isFrozen(r.ts), `${r.name}'s claim`);
  }
  assert.throws(() => { 'use strict'; rows[0].glyphs.push('sprout'); }, TypeError);
});

// ─── A1: the panel's short-circuit ───────────────────────────────────────────────────────────────────────────────

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

test('AUDIT 637 A1: THE PANEL BUILDS NO KEY ON A FRAME WITH NOTHING NEW - the roster\'s same frozen list, the same count, word and open row, and the repaint key over every row is not built at all; a join builds it once (mutants: the short-circuit gone; the list seen never recorded)', () => {
  const doc = fakeDocument();
  const peers = new Map();
  for (let i = 0; i < 40; i++) peers.set(`p-${i}`, { id: `p-${i}`, name: `Name${i}`, glyphs: [] });
  const src = () => source(peers);   // a NEW source every frame, as world.js composes one
  const panel = createChatPanel({ log: new ChatLog(), onSend: () => true, roster: src, action: () => null, doc, win: { addEventListener() {}, removeEventListener() {} }, touch: false, rowActions: () => [] });
  panel.open();
  panel.render();
  const map = Array.prototype.map;
  let keys = 0, watched = rosterRows(src()).rows;
  Array.prototype.map = function (...a) { if (this === watched) keys++; return map.apply(this, a); };   // eslint-disable-line no-extend-native
  try {
    for (let i = 0; i < 30; i++) panel.render();
    assert.equal(keys, 0, `thirty frames of nothing new built the key ${keys} times`);
    peers.set('p-new', { id: 'p-new', name: 'Newcomer', glyphs: [] });
    watched = rosterRows(src()).rows;
    keys = 0;
    for (let i = 0; i < 30; i++) panel.render();
    assert.ok(keys >= 1 && keys <= 2, `a join: the key built once and the rows drawn once (${keys} walks of the new list)`);
  } finally { Array.prototype.map = map; }   // eslint-disable-line no-extend-native
  panel.destroy?.();
});

// ─── A11: the friends list's order ───────────────────────────────────────────────────────────────────────────────

/** friendOrder as it stood before AUDIT 637 A11, verbatim but for its name */
function oracleFriendOrder(friends) {
  const rows = friends?.values ? [...friends.values()] : [...(friends ?? [])];
  return rows.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)
    || String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' })
    || (a.acct < b.acct ? -1 : a.acct > b.acct ? 1 : 0));
}

test('AUDIT 637 A11: the friends list orders as it did - online first, then by the roster\'s own name order, then the account - and builds no collator a comparison (mutants: localeCompare with options back; the name clause turned)', () => {
  const names = ['bob', 'Bob', 'Alfred', 'Player10', 'Player9', 'Sir Bob', 'SirBob', 'zara', 'Mac', 7, null, 'a-b', 'ab'];
  const friends = new Map(names.map((name, i) => [`acct-${i}`, { acct: `acct-${i}`, name, online: i % 3 === 0 }]));
  const want = oracleFriendOrder(friends).map((r) => r.acct);
  const lc = String.prototype.localeCompare;
  let asked = 0;
  String.prototype.localeCompare = function (...a) { asked++; return lc.apply(this, a); };   // eslint-disable-line no-extend-native
  let got;
  try { got = friendOrder(friends).map((r) => r.acct); } finally { String.prototype.localeCompare = lc; }   // eslint-disable-line no-extend-native
  assert.deepEqual(got, want);
  assert.equal(asked, 0, 'no comparison built a collator of its own');
});
