// FIELD BUGS 2026-10-14 STORES-CRASH (BioGud on the Discord: "Daggerfall: Newtower, cant interact. If try to access
// through Esc- Store get crash"; a second player: "crashed trying to load the crafting bench"). The Joinery's bench
// (CARP-YARD) lands the Stores page on its Workbench (focusStoresStation); MENU-ORDER's tiles asked each away station
// whether it held that head with `children.some` - and a browser's Element.children is an HTMLCollection, which has no
// `.some`. The fake document's children are arrays, so the suite was green and the live page threw "(...).some is not
// a function" at the first away station, before the Workbench drew and spent the press: every later Stores page threw
// too. Drawn here through the page's own draw on nodes whose children are shaped as the browser mints them.
// bible/01-Overview/bugs/Field-Bugs-2026-10-14.md.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForRank, trackOf } from '../../src/net/professionLaw.js';
import { focusStoresStation, setProfessionsPages, drawStoresPage, resetProfPages } from '../../src/ui/professions/profPages.js';

// A browser's Element.children: indexed, iterable, a length - and none of Array's methods. The fake's own append and
// prepend still push through it.
const KEPT = new Set(['length', 'constructor', 'push', 'unshift']);
const ARRAY_ONLY = new Set(Object.getOwnPropertyNames(Array.prototype).filter((k) => !KEPT.has(k)));
const asCollection = (arr) => new Proxy(arr, { get: (t, k, r) => (ARRAY_ONLY.has(/** @type {string} */ (k)) ? undefined : Reflect.get(t, k, r)) });
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  let kids = n.children;
  Object.defineProperty(n, 'children', { get: () => asCollection(kids), set: (v) => { kids = v; }, configurable: true });
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
const find = (n, id) => {
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
};

function stubPages() {
  resetProfPages();
  const tracks = new Map([['carpentry', { profession: 'carpentry', xp: xpForRank(0), rank: 0, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: () => 0, store: (k) => ({ material: k, own: 0, bought: 0 }), track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, pendingWithdrawals: 0, pendingCrafts: 0, choose: async () => ({ ok: true }),
  };
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), purse: () => 1000,
    craft: async () => ({ ok: true, text: '' }), smelt: async () => ({ ok: true, text: '' }),
    workbench: () => ({ kind: 'shop', fee: 5, who: 'carpenter' }), forge: () => null,   // at the Joinery's bench, no forge
    alchemy: () => null, brew: async () => ({ ok: true, text: '' }),
    enchanter: () => null, disenchantable: () => [], disenchant: async () => ({ ok: true, text: '' }),
  });
}

test('STORES-CRASH: the Joinery\'s press lands the Stores page on its Workbench with browser-shaped children - no throw, the head landed on once, and the next Stores page (Esc, Stores) draws too (mutant: the head asked with children.some)', (t) => {
  stubPages();
  const frames = [];
  t.mock.method(globalThis, 'requestAnimationFrame', (f) => { frames.push(f); return frames.length; });
  t.mock.method(document, 'getElementById', (id) => find(document.body, id));
  const draw = () => { const root = el('div'); document.body.append(root); drawStoresPage(root, () => {}, kit); return root; };
  focusStoresStation('workbench');
  const root = draw();
  const head = find(root, 'prof-station-workbench');
  assert.ok(head, 'the Workbench drew, past every away station before it');
  const tiles = [...root.children].find((n) => n.className === 'prof-stations');
  assert.ok(tiles, 'the station tiles drew');
  const bench = [...tiles.children].find((n) => n.getAttribute?.('data-station') === 'workbench');
  assert.match(bench.className, /\bhere\b/, 'the Workbench is worked here');
  const scrolled = [];
  head.scrollIntoView = (o) => scrolled.push(o);
  assert.equal(frames.length, 1, 'the press landed once - spent');
  frames.shift()();
  assert.deepEqual(scrolled, [{ block: 'start' }]);
  // Esc, Stores: the press spent, the page draws at the top
  const again = draw();
  assert.ok(find(again, 'prof-station-workbench'));
  assert.equal(frames.length, 0);
  // the stations the walk passed on its way - away here, each its tile and its words kept
  const away = [...tiles.children].filter((n) => !/\bhere\b/.test(n.className)).map((n) => n.getAttribute('data-station'));
  assert.ok(away.length >= 3, `away stations drawn before the Workbench: ${away}`);
});
