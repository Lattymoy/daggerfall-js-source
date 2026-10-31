// SHOP-UNTOLD (2026-10-31, a player's report: "portal skins, mounts and bundles tab vanish after a second of opening up
// the shop"; offline the player "could read it all"). With no card the window listed every ware, drops not out yet among
// them, and took them away when the card landed. It lists only what the card tells (bible/06-Systems/Storefront.md 9).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOP_WARES, shopCardOf as clientCard } from '../../src/net/shopLaw.js';
import { shopCardOf } from '../../server-account/src/shop.js';
import { shopWindow, shopSections, shopWhoText } from '../../src/ui/enhanced/enhancedShop.js';

function fakeDoc() {
  const doc = { activeElement: null, head: null, defaultView: null, byId: new Map() };
  const node = (tag) => {
    const n = {
      tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '', id: '', href: '', target: '', rel: '', tabIndex: 0, isConnected: true, parent: null, hidden: false,
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); if (c.id) doc.byId.set(c.id, c); } },
      remove() { if (n.parent) n.parent.children = n.parent.children.filter((c) => c !== n); n.parent = null; },
      replaceWith(x) { const p = n.parent; if (!p) return; p.children[p.children.indexOf(n)] = x; x.parent = p; n.parent = null; },
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
const tabIds = (w) => all(w.root, 'sh-tab').map((n) => n.id.slice('sh-tab-'.length));

/** A schedule with the bundles limited, so their drops are still to come; OPEN-ALL sells every other ware at once. */
const ENV = {
  STRIPE_SECRET_KEY: 'sk_test_untold', STRIPE_WEBHOOK_SECRET: 'whsec_untold', AURUM_OPEN: 'on',
  SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','),
  SHOP_FEATURED: ['kill:ashen 2026-10-30 2026-11-12', 'portal:runic 2026-11-13 2026-11-26', 'portal:daedric 2026-11-13 2026-11-26',
    'portal:aetheric 2026-11-13 2026-11-26', 'bundle:portalmaster 2026-11-27 2026-12-10 limited', 'mount:spectral 2026-12-11 2026-12-24',
    'mount:dawnfire 2026-12-11 2026-12-24', 'mount:warhorse 2026-12-11 2026-12-24', 'bundle:daedricchampion 2026-12-25 2027-01-08 limited',
    'bundle:lordofoblivion 2026-12-25 2027-01-08 limited'].join('\n'),
};
/** The card the service mints for a registered account on `day`, checked on the way in as the client checks it. */
const cardAt = async (/** @type {string} */ day) => clientCard(await shopCardOf({ id: 'p', handle: 'Aelwyn' }, ENV,
  { subtle: globalThis.crypto.subtle, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: Date.parse(`${day}T12:00:00Z`) / 1000, origin: 'https://a.invalid' }));
const flowIn = (shop, extra = {}) => ({ stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, wardrobe: { titles: [], glyphs: [], auras: [] }, shop, aurum: null, busy: false, ...extra });
const NOT_YET = ['bundles'];

test('SHOP-UNTOLD: with no card - reading, offline, signed out - the window lists no ware, only the Folios; the card\'s sections are the drops out, a drop is listed once it lands (mutants: every ware listed with no card)', async () => {
  for (const fl of [null, { stage: 'loading' }, { stage: 'out' }, flowIn(null)]) assert.deepEqual(shopSections(fl), ['pass'], JSON.stringify(fl));
  const oct = await cardAt('2026-10-31');
  assert.deepEqual(shopSections(flowIn(oct)), ['pass', 'kills', 'portals', 'mounts', 'names', 'icons', 'auras', 'armory', 'aurum']);
  const dec = await cardAt('2026-12-26');
  assert.deepEqual(NOT_YET.filter((c) => shopSections(flowIn(dec)).includes(c)), NOT_YET, 'out by Boxing Day');
});

test('SHOP-UNTOLD: the window opened before the card lands grows its tabs when it lands, never shows a section and takes it away; offline it says the shop was not read (mutants: every ware listed with no card; the unread line unsaid)', async () => {
  let flow = /** @type {any} */ ({ stage: 'loading' });
  const w = shopWindow(fakeDoc(), { flow: () => flow, onClose() {}, focus: false, now: () => Date.parse('2026-10-31T12:00:00Z'), preview: async () => null, effectPreview: async () => null });
  assert.deepEqual(tabIds(w), ['pass'], 'reading: the Folios alone');
  assert.equal(all(w.root, 'sh-who')[0].textContent, 'Reading your account...');
  flow = flowIn(await cardAt('2026-10-31'));
  w.draw();
  assert.deepEqual(tabIds(w), shopSections(flow));
  assert.ok(NOT_YET.every((c) => !tabIds(w).includes(c)), 'no drop told before it lands');
  w.stop();
  const off = shopWindow(fakeDoc(), { flow: () => flowIn(null, { error: 'offline' }), onClose() {}, focus: false, now: () => Date.now(), preview: async () => null, effectPreview: async () => null });
  assert.deepEqual(tabIds(off), ['pass']);
  assert.equal(all(off.root, 'sh-who')[0].textContent, 'The shop could not be read. Open it again when you are online.');
  assert.equal(shopWhoText(flowIn(null, { account: { handle: null } })), 'The shop could not be read. Open it again when you are online.', 'offline is no guest');
  off.stop();
});
