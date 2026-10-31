// AUDIT-STOREFRONT (2026-10-29, bible/01-Overview/audits/Audit-Storefront.md): the shop window and the Collections page
// say what the shop's card says - a drop to come is not told, a featured window only beside its sale and its days left
// counted as they pass (S2, S9); a giver held in part is said (S12); the carousel's dots big enough to press (S13).
// PASS-PANELS: the boosters (S5) and the Premium Pass (S11) are retired, and their pins with them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { shopWindow, shopBundleRows, SHOP_CSS } from '../../src/ui/enhanced/enhancedShop.js';
import { wardrobeAvail, wardrobeEntry, availLine } from '../../src/ui/collections/wardrobeCatalogue.js';
import { wardrobeFilterPasses, drawWardrobePart, resetWardrobePart } from '../../src/ui/collections/wardrobePart.js';
import { shopConfirmPage } from '../../server-account/src/shop.js';

function fakeDoc() {
  const doc = { activeElement: null, head: null, defaultView: null, byId: new Map() };
  const node = (tag) => {
    const n = {
      tag, children: [], className: '', attrs: {}, style: {}, dataset: {}, listeners: {}, title: '', type: '', id: '', href: '', target: '', rel: '', tabIndex: 0, isConnected: true, parent: null,
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); if (c.id) doc.byId.set(c.id, c); } },
      remove() { if (n.parent) n.parent.children = n.parent.children.filter((c) => c !== n); n.parent = null; },
      setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k] ?? null; }, removeAttribute(k) { delete n.attrs[k]; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); },
      focus() { doc.activeElement = n; },
      click() { for (const f of n.listeners.click ?? []) f(); },
      classList: {
        toggle(c, on) { const cs = new Set(String(n.className).split(' ').filter(Boolean)); if (on === undefined ? !cs.has(c) : on) cs.add(c); else cs.delete(c); n.className = [...cs].join(' '); },
        contains(c) { return String(n.className).split(' ').includes(c); },
      },
    };
    Object.defineProperty(n, 'textContent', { get() { let t = n._t ?? ''; for (const c of n.children) t += c.textContent; return t; }, set(v) { n._t = v; n.children = []; } });
    return n;
  };
  doc.createElement = node;
  doc.createElementNS = (_ns, tag) => node(tag);
  doc.head = node('head');
  doc.getElementById = (id) => doc.byId.get(id) ?? (doc.head.children.find((c) => c.id === id) ?? null);
  return doc;
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };
const row = (id, o = {}) => ({ id, sale: true, held: false, buy: `https://accounts.invalid/v1/shop/buy?t=${id}`, ...o });
const flowIn = (wares, wardrobe = { titles: [], glyphs: [], auras: [] }) => ({ stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, wardrobe, shop: { on: true, wares, featured: [] }, busy: false });

test('AUDIT-STOREFRONT S2 Collections says a shop ware\'s availability off the card - in the shop while it or a bundle giving it sells, no longer once those told are off sale, not yet while none is told; the Obtainable filter follows (mutants: "In the shop" before the drop; the Gate Sigil in the shop after its window)', () => {
  const e = (kind, key) => ({ kind, key, ...wardrobeEntry(kind, key) });
  const NOW = Date.UTC(2026, 10, 1);
  assert.equal(wardrobeAvail(e('title', 'dawnbringer'), NOW, { wares: [] }), 'dormant', 'its drop to come: not yet');
  assert.equal(wardrobeAvail(e('title', 'dawnbringer'), NOW, { wares: [row('title:dawnbringer')] }), 'store');
  assert.equal(wardrobeAvail(e('title', 'dawnbringer'), NOW, { wares: [row('title:dawnbringer', { sale: false, buy: null })] }), 'retired');
  assert.equal(wardrobeAvail(e('glyph', 'gatesigil'), NOW, { wares: [row('bundle:portalmaster', { sale: false, buy: null })] }), 'retired', 'its one bundle\'s limited window over');
  assert.equal(wardrobeAvail(e('aura', 'dominion'), NOW, { wares: [row('bundle:portalmaster', { sale: false }), row('bundle:lordofoblivion')] }), 'store', 'another bundle still sells it');
  assert.equal(wardrobeAvail(e('title', 'dawnbringer'), NOW), 'store', 'no card read: the catalogue\'s word');
  assert.equal(wardrobeAvail(e('title', 'genesis'), NOW, { wares: [] }), 'shop', 'a pre-alpha ware keeps its own word');
  assert.match(availLine(e('title', 'dawnbringer'), NOW, { wares: [] }), /Not open to players yet/);
  assert.equal(wardrobeFilterPasses('now', e('title', 'dawnbringer'), null, NOW, { wares: [] }), false);
  assert.equal(wardrobeFilterPasses('now', e('title', 'dawnbringer'), null, NOW, { wares: [row('title:dawnbringer')] }), true);
  // the page itself asks the flow's card
  const doc = fakeDoc(), el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  resetWardrobePart();
  const root = el('div');
  drawWardrobePart(root, () => {}, { el, divider: (x) => el('h4', null, x), doc, now: () => NOW }, 'title', { stage: 'in', account: { handle: 'Aelwyn' }, wardrobe: { titles: [] }, shop: { on: true, wares: [] } });
  const dawn = all(root, 'coll-row').find((r) => r.dataset.wardrobe === 'title:dawnbringer');
  assert.ok(dawn, 'the row drawn');
  assert.equal(all(dawn, 'av-dormant').length, 1, 'its drop to come: not yet, on the page');
});

test('AUDIT-STOREFRONT S9 a featured window\'s tag and its days left are told only beside its sale, and drawn again as the card and the day move (mutants: "Limited" beside "No longer sold"; the days left frozen)', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let nowMs = Date.UTC(2026, 10, 14, 12);
  let wares = SHOP_WARES.filter((w) => w.alone).map((w) => row(w.id, w.id === 'kill:pyre' ? { until: Date.UTC(2026, 10, 17), limited: true } : {}));
  const flow = () => flowIn(wares);
  const doc = fakeDoc();
  const w = shopWindow(doc, { flow, onClose() {}, keep: { cat: 'kills' }, focus: false, now: () => nowMs, preview: async () => null, effectPreview: async () => null, reduced: true });
  const panel = () => all(w.root, 'sh-panel').find((p) => p.attrs['data-ware'] === 'kill:pyre');
  assert.equal(all(panel(), 'sh-until')[0].textContent, 'Limited: sold only until Nov 16. 3 days left.');
  assert.equal(all(panel(), 'sh-tag-limited')[0]?.textContent, 'Limited');
  nowMs = Date.UTC(2026, 10, 15, 12);
  t.mock.timers.tick(500);
  assert.equal(all(panel(), 'sh-until')[0].textContent, 'Limited: sold only until Nov 16. 2 days left.', 'a UTC midnight passed: counted again by the window\'s own clock');
  wares = wares.map((r) => (r.id === 'kill:pyre' ? { ...r, sale: false, buy: null } : r));
  w.draw();
  assert.equal(all(panel(), 'sh-until')[0].textContent, '', 'off sale: no window told');
  assert.equal(all(panel(), 'sh-tag-limited').length, 0);
  assert.equal(all(panel(), 'sh-state')[0].textContent, 'No longer sold');
  assert.match(SHOP_CSS, /\.sh-until:empty, \.px-shopwin \.sh-tag:empty \{ display: none; \}/, 'an empty one takes no room');
  w.stop();
});

test('AUDIT-STOREFRONT S12, S13: a giver held in part said in a bundle\'s contents and on the confirm page; the carousel\'s dots a 24 px target each (mutants: a set whose piece is held said unowned; a 14 px dot)', () => {
  // PIN MOVED (PASS-PANELS): the Seasonal Collector and the Deluxe it gave are retired - a giver inside a giver is the
  // Eternal Set, its Halo held
  const rows = shopBundleRows(flowIn([row('armory:eternalhalo', { held: true, buy: null })]), { gives: ['armory:eternalset', 'kill:pyre'] });
  assert.deepEqual(rows.map((r) => [r.id, r.held, r.part]), [['armory:eternalset', false, true], ['kill:pyre', false, false]]);
  const champion = SHOP_WARES.find((w) => w.id === 'bundle:daedricchampion');
  const page = shopConfirmPage({ handle: 'Aelwyn', ware: champion, ticket: 't', cents: 1628, holds: 0, part: true });
  assert.ok(page.lines.includes('Your account holds part of it already, so the price is less.'));
  assert.match(SHOP_CSS, /\.sh-cdot \{ width: 24px; height: 24px; min-width: 24px; min-height: 24px;/);
});

test('AUDIT-STOREFRONT the stages wear the player\'s body: the window asks its `wearer` once and hands every stage that draws a figure the same body - an aura\'s, a piece\'s and an effect\'s; with none, the stand-in (mutants: the body never handed on; asked a stage)', async () => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (f) => { f(0); return 1; };
  try {
    let asked = 0;
    const me = { kind: 'sprite' }, got = [];
    const wearer = () => { asked++; return Promise.resolve(me); };
    const preview = async (_c, _a, _k, body) => { got.push(await body?.()); return { stop() {} }; };
    const effectPreview = async (_c, _s, _k, _cue, body) => { got.push(await body?.()); return { stop() {} }; };
    const wares = SHOP_WARES.filter((w) => w.alone).map((w) => row(w.id));
    for (const cat of ['auras', 'kills', 'armory']) {
      const w = shopWindow(fakeDoc(), { flow: () => flowIn(wares), onClose() {}, keep: { cat }, focus: false, preview, effectPreview, wearer, reduced: true });
      await new Promise((r) => setTimeout(r, 0));
      w.stop();
    }
    assert.ok(got.length >= 3 && got.every((b) => b === me), 'every stage given the body');
    assert.equal(asked, 3, 'asked once a window, never a stage');
    got.length = 0;
    const w = shopWindow(fakeDoc(), { flow: () => flowIn(wares), onClose() {}, keep: { cat: 'kills' }, focus: false, preview, effectPreview, reduced: true });
    await new Promise((r) => setTimeout(r, 0));
    w.stop();
    assert.ok(got.length > 0 && got.every((b) => b === undefined), 'no wearer: the stand-in');
  } finally { globalThis.requestAnimationFrame = raf; }
});
