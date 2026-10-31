// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop ... organized in categories with a strict disclaimer that all proceeds go towards development costs";
// bible/06-Systems/Shop.md). The client's side: the window and the gem, what each ware's panel offers, the account flow
// that carries the shop's card, the mailbox's receipt, the Collections catalogue's entries, and the three faces - the
// Genesis plate, the Origin dragon and the Eternal cape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SHOP_WARES, SHOP_WARE_NAME, shopOnSaleOf, shopWareById } from '../../src/net/shopLaw.js';
import { SHOP_PROCEEDS, SHOP_COSMETIC } from '../../server-account/src/shop.js';   // the service's English, the window's through the text core
import { shopWareState, shopWhoText, shopWindow, shopMark, shopWareTag, shopWareName, SHOP_CSS, SHOP_LOOK, shopCarouselOf, shopBundleRows, shopHeldAny, shopSections, shopUntilText, CAROUSEL_TURN_MS, carouselTurns } from '../../src/ui/enhanced/enhancedShop.js';
import { effectName } from '../../src/ui/effectText.js';   // STOREFRONT: an effect's name, the client's own
import { postHead } from '../../src/net/postLaw.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { setLocale, currentLocale, PSEUDO_LOCALE, t } from '../../src/systems/textManager.js';
import { armoryPieceName } from '../../src/ui/armoryText.js';   // ARMORY: a piece's arrival said in the player's language
import {
  TITLE_TEXT, AURA_TEXT, TITLE_RGBA, TITLE_FLAME, GLYPH_PATH, GLYPH_DETAIL, GLYPH_MOTION, GLYPH_MARK, GLYPH_EDGE_OF, AURA_PAINT,
  GENESIS_DEEP, GENESIS_HEART, titleBadge, titlePaint, glyphBadges, glyphArtNode, glyphDetails,
} from '../../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../../src/ui/enhanced/enhancedAccount.js';
import { ICON_TEXT } from '../../src/ui/profileIcons.js';   // AURUM: the daily wares' icons
import { passCardOf, PASS_CHALLENGES } from '../../src/net/battlePassLaw.js';
import { aurumCardOf } from '../../src/net/aurumLaw.js';
import { passItemsIn } from '../../src/ui/enhanced/enhancedPass.js';
import { flameSheetPixels, flameFramePixels, flameCss, FLAME_CLASS, flameClassOf, setTitleFlame, ensureTitleFlames, FLAME_STYLE_ID } from '../../src/ui/titleFlame.js';
import { wardrobeEntry, AVAIL_NOW, AVAIL_TAG, AVAIL_LINE, WARDROBE_SOURCES } from '../../src/ui/collections/wardrobeCatalogue.js';
import {
  AURA_LOOK, AURA_CARDS, AuraRingRenderer, auraEyeAtHead, eternalRatesWhole, ETERNAL_RGB, ETERNAL_CARDS, CLOAK_REST_POSE, CLOAK_ROUND, CLOAK_ROWS,
  auraPrograms, AURA_VS, AURA_GROUND_R, AURA_LIFT_M, ETERNAL_TOP, ETERNAL_POOL_R, WING_SPRITE_BACK, EOTB_FIGURE, auraSpriteBones, auraCapePose,
} from '../../src/render/auraRing.js';
import { glslFunctions } from '../glsl.mjs';
import { previewMesh, previewStroll, PREVIEW_FIGURE, PREVIEW_STROLL } from '../../src/render/auraPreview.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ── A DOCUMENT THE WINDOW CAN BE BUILT IN ────────────────────────────

function fakeDoc() {
  const doc = { activeElement: null, head: null, defaultView: null, byId: new Map() };
  const node = (tag) => {
    const n = {
      tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '', id: '', href: '', target: '', rel: '', tabIndex: 0, isConnected: true, parent: null,
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

/** The shop's card as the service answers it - PIN MOVED (AURUM-ONLY): an Aurum pack with its money link and price in
 *  cents, every other ware its price in Aurum and no link. */
const card = (o = {}) => ({ on: true, wares: SHOP_WARES.map((w) => ({ id: w.id, sale: true, held: false,
  ...(w.cash ? { buy: `https://accounts.invalid/v1/shop/buy?t=${w.key}`, cents: w.cents } : { price: w.price }), ...(o[w.id] ?? {}) })) });
/** AURUM-ONLY: an Aurum card open to the account, with no deals today (the deals' section is test/ui/aurum_shop.test.js's). */
const AURUM = aurumCardOf({ open: true, balance: 5000, daily: { until: 1, wares: [] }, week: { until: 1, deeds: {} } });
const flowIn = (shop = card(), extra = {}) => ({ stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, wardrobe: { titles: [], glyphs: [], auras: [] }, shop, aurum: AURUM, busy: false, ...extra });

test('ARMORY: an Aura Armory piece bought is said in the player\'s own language when it lands - its name the client\'s (ui/armoryText.js), never the receipt\'s English (mutants: the service\'s English name said)', async () => {
  const reads = [
    { account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' }, wardrobe: { titles: [], glyphs: [] }, devices: [], shop: card() },
    { account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' }, wardrobe: { titles: [], glyphs: [], auras: [], armoryHeld: ['eternalhalo'], armory: null }, devices: [], shop: card({ 'armory:eternalhalo': { held: true, buy: null } }) },
  ];
  let n = 0;
  const fetch = async (url) => (new URL(url).pathname === '/v1/account' ? Response.json(reads[Math.min(n++, reads.length - 1)]) : Response.json({ ok: true }));
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const flow = AccountFlow({ io: { fetch, base: 'https://accounts.invalid' }, storage });
  await flow.start();
  flow.shopOpened('armory:eternalhalo');
  const was = currentLocale();
  setLocale(PSEUDO_LOCALE);
  try {
    assert.equal(await flow.refresh(), true);
    assert.ok(flow.note.includes(t('armory.name.eternalhalo', 'Eternal Halo')) && !flow.note.includes('Eternal Halo'), flow.note);
  } finally { setLocale(was); }
});

// ── THE DISCLAIMER AND THE NAMES ──────────────────────────────────────

test('SHOP: the window\'s disclaimer is the service\'s, word for word - the proceeds and the cosmetic line - and it stands first, above every ware (mutants: a word changed on one side; the disclaimer after the panels)', () => {
  const src = rd('src/ui/enhanced/enhancedShop.js');
  assert.ok(src.includes(`t('shop.proceeds', '${SHOP_PROCEEDS}')`), 'the proceeds, the service\'s own words');
  assert.ok(src.includes(`t('shop.cosmetic', '${SHOP_COSMETIC}')`));
  assert.equal(SHOP_PROCEEDS, 'All proceeds go to the costs of developing DFO Online.');
  const w = shopWindow(fakeDoc(), { flow: () => flowIn(), onClose() {}, focus: false, preview: async () => null });
  const body = w.root.children.find((c) => c.className === 'px-body');
  // PIN MOVED (AUDIT-STOREFRONT II, lane E 6): the featured wares and the panels scroll under the standing disclaimer and
  // tabs - in the page's order still, the disclaimer before every ware
  const order = []; walk(body, (n) => order.push(String(n.className)));
  const at = (c) => order.indexOf(c);
  assert.ok(at('sh-proceeds') >= 0 && at('sh-proceeds') < at('sh-tabs') && at('sh-tabs') < at('sh-carousel sh-empty') && at('sh-tabs') < at('sh-panels'), order.join(' > '));
  assert.deepEqual(body.children.map((c) => c.className), ['sh-head', 'sh-proceeds', 'sh-tabs', 'sh-scroll'], 'the head, the disclaimer and the tabs stand; the rest scrolls');
  assert.equal(body.children.find((c) => c.className === 'sh-proceeds').attrs.role, 'note');
  w.stop();
});

test('SHOP: each ware\'s name is the one every face says - the title\'s, the aura\'s, the glyph\'s label - and the service\'s English is the same (mutants: a name drifting between the receipt and the window)', () => {
  for (const w of SHOP_WARES) {
    // PIN MOVED (ARMORY): a piece's name, the client's own (ui/armoryText.js); STOREFRONT: an effect's (ui/effectText.js), and
    // a pass's, a bundle's and a booster's the window's own - each the service's English, word for word
    // AURUM: a profile icon's the portrait well's (ICON_TEXT), and never the service's - an icon was never sold for money,
    // so no payment or receipt names it. AURUM-ONLY (PIN MOVED): every other ware keeps its English - a money order older
    // than the switch still names it on its receipt and its refund
    const face = w.kind === 'title' ? TITLE_TEXT[w.key] : w.kind === 'aura' ? AURA_TEXT[w.key] : w.kind === 'armory' ? armoryPieceName(w.key) : w.kind === 'glyph' ? GLYPH_LABEL[w.key]
      : ['kill', 'portal', 'mount'].includes(w.kind) ? effectName(w.kind, w.key) : w.kind === 'icon' ? ICON_TEXT[w.key] : shopWareName(w);
    assert.equal(SHOP_WARE_NAME[w.id], w.kind === 'icon' ? undefined : face, w.id);
    assert.equal(shopWareName(w), face);
    assert.ok(typeof SHOP_LOOK[w.id] === 'function' && SHOP_LOOK[w.id]().length > 20, `${w.id}: a sentence of its look`);
  }
});

// ── WHAT A PANEL OFFERS ───────────────────────────────────────────────

test('SHOP: a panel offers Buy only to a registered account, signed in, for a ware on sale and not held - AURUM-ONLY (PIN MOVED): a ware for its Aurum while Aurum is open and the balance covers it, else how much more; a pack for money on a shop that takes payments; held, it offers Wear; else it says why (mutants: Buy to a guest; Buy off sale; Buy held)', () => {
  const g = shopWareById('title:genesis');   // PIN MOVED (STOREFRONT): the catalogue opens with the Battle Pass now
  assert.deepEqual(shopWareState(flowIn(), g), { state: 'afford', buy: null, price: 500, list: 500, deal: false, cents: 0 });
  assert.deepEqual(shopWareState(flowIn(card(), { aurum: aurumCardOf({ open: true, balance: 120 }) }), g), { state: 'short', buy: null, need: 380, price: 500, list: 500, deal: false, cents: 0 });
  assert.equal(shopWareState(flowIn(card(), { aurum: aurumCardOf({ open: false, balance: 9999 }) }), g).state, 'closed', 'Aurum shut: nothing bought');
  const pack = shopWareById('aurum:1100');
  assert.deepEqual(shopWareState(flowIn(), pack), { state: 'buy', buy: 'https://accounts.invalid/v1/shop/buy?t=1100', cents: 999, price: 0, list: 0, deal: false });
  assert.equal(shopWareState(flowIn({ on: false, wares: card().wares.map((w) => ({ ...w, buy: null })) }), pack).state, 'closed', 'a pack while no payments are taken');
  assert.equal(shopWareState(flowIn(card({ [g.id]: { held: true, buy: null } }), { wardrobe: { titles: ['genesis'], title: 'genesis' } }), g).state, 'held');
  assert.equal(shopWareState(flowIn(card({ [g.id]: { held: true, buy: null } }), { wardrobe: { titles: ['genesis'], title: 'genesis' } }), g).worn, true);
  assert.equal(shopWareState(flowIn(card({ [g.id]: { sale: false, buy: null } })), g).state, 'gone');
  assert.equal(shopWareState(flowIn(null), g).state, 'closed', 'a service from before the shop');
  assert.equal(shopWareState(flowIn(card(), { account: { handle: null, kind: 'guest' } }), g).state, 'guest');
  assert.equal(shopWareState({ stage: 'out' }, g).state, 'out');
  assert.equal(shopWareState({ stage: 'loading' }, g).state, 'reading');
  assert.equal(shopWareState(null, g).state, 'reading');
  const glyph = shopWareById('glyph:origin');
  const held = card({ [glyph.id]: { held: true, buy: null } });
  assert.equal(shopWareState(flowIn(held, { wardrobe: { glyphs: ['origin'], glyphsOff: [] } }), glyph).worn, true);
  assert.equal(shopWareState(flowIn(held, { wardrobe: { glyphs: ['origin'], glyphsOff: ['origin'] } }), glyph).worn, false, 'a glyph taken off is not worn');
  assert.match(shopWhoText(flowIn()), /the account Aelwyn/);
  assert.match(shopWhoText({ stage: 'out' }), /Sign in from your profile to buy\./);
  assert.match(shopWhoText(flowIn(card(), { account: { handle: null } })), /guest/);
});

test('SHOP: the window - a tab a section with its count, a panel a ware with its price and its press; AURUM-ONLY (PIN MOVED) a ware\'s Buy in Aurum pressed twice through the flow, a pack\'s Buy a plain link the flow is told was followed; a tab pressed draws its own wares; held, Wear presses the flow\'s own equip (mutants: Buy a button that fetches; the tab never redrawn; Wear never pressed)', () => {
  const doc = fakeDoc();
  let opened = null, equipped = null;
  const flow = flowIn(), bought = [];
  flow.shopOpened = (id) => { opened = id; };
  flow.buyWare = (id, price) => { bought.push([id, price]); };
  const keep = {};
  const w = shopWindow(doc, { flow: () => flow, onClose() {}, keep, focus: false, preview: async () => null, effectPreview: async () => null });
  // PIN MOVED (STOREFRONT): the sheet's sections, each its wares sold alone - a bundle's glyphs and aura are its alone
  // PIN MOVED (PASS-PANELS): the Folios first, counting their items - no pass or booster sold for money, the Seasonal
  // Collector retired with them
  // PIN MOVED (AURUM-ONLY): the profile icons a section, sold for good
  assert.deepEqual(all(w.root, 'sh-tab').map((t) => t.textContent), [`Folios${passItemsIn('s1').length}`, 'Kill Effects3', 'Portal Skins3', 'Mounts3', 'Name Visuals5', 'Profile Icons8', 'Auras1', 'Aura Armory6', 'Bundles3', 'Aurum4']);
  assert.equal(all(w.root, 'sh-tab')[0].attrs['aria-selected'], 'true');
  assert.deepEqual(all(w.root, 'sh-price').map((p) => all(p, 'sh-pricen')[0]?.textContent), ['1,000'], 'the Folios sell for Aurum alone: the Gilded Folio\'s unlock (PIN MOVED, AUDIT-STOREFRONT III C9: its words for a screen reader beside it)');
  all(w.root, 'sh-tab')[4].click();
  assert.equal(keep.cat, 'names', 'the tab kept, for a face rebuilt around the window');
  // PIN MOVED (AURUM-ONLY): the name visuals' prices in Aurum ($5.00, $2.00, $3.99, $6.99, $9.99 at $1 = 100 Aurum)
  assert.deepEqual(all(w.root, 'sh-pricen').map((p) => p.textContent), ['500', '200', '400', '700', '1,000']);
  assert.equal(all(w.root, 'sh-buy').filter((b) => b.tag === 'a').length, 0, 'no money link on a ware');
  const buyG = () => all(all(w.root, 'sh-panel').find((p) => p.attrs['data-ware'] === 'title:genesis'), 'sh-aurumbuy')[0];
  assert.equal(buyG().textContent, 'Buy for 500 Aurum');
  buyG().click(); buyG().click();
  assert.deepEqual(bought, [['title:genesis', 500]], 'two presses: bought through the flow at its price');
  all(w.root, 'sh-tab')[9].click();   // the packs: money's one door
  const buy = all(w.root, 'sh-buy')[0];
  assert.equal(buy.tag, 'a');
  assert.equal(buy.href, 'https://accounts.invalid/v1/shop/buy?t=500');
  assert.equal(buy.target, '_blank');
  assert.equal(buy.rel, 'noopener');
  buy.click();
  assert.equal(opened, 'aurum:500');
  all(w.root, 'sh-tab')[6].click();
  assert.deepEqual(all(w.root, 'sh-pricen').map((p) => p.textContent), ['2,000']);
  assert.equal(all(w.root, 'sh-auracanvas').length, 1, 'the aura on its own stage');
  // held: Owned, and Wear the flow's own press
  flow.shop = card({ 'aura:eternal': { held: true, buy: null } });
  flow.wearAura = (k) => { equipped = k; };
  w.draw();
  assert.equal(all(w.root, 'sh-state')[0].textContent, 'Owned');
  assert.equal(all(w.root, 'sh-buy').length, 0);
  all(w.root, 'sh-wear')[0].click();
  assert.equal(equipped, 'eternal');
  // rebuilt on its tab
  const again = shopWindow(doc, { flow: () => flow, onClose() {}, keep, focus: false, preview: async () => null, effectPreview: async () => null });
  assert.equal(all(again.root, 'sh-tab')[6].attrs['aria-selected'], 'true');
  w.stop(); again.stop();
});

test('SHOP: The Eternal Set - its own panel first in the Aura Armory tab at 2,000 Aurum (PIN MOVED, AURUM-ONLY: $20), a set of five; held, Wear puts every piece on at once and, every piece worn, takes them all off - one piece off, the set is not worn (mutants: the set worn a piece at a time; the set worn with a piece off)', () => {
  const doc = fakeDoc();
  const ETERNAL = ['armory:eternalset', 'armory:eternalhalo', 'armory:eternalsigil', 'armory:eternalarmlets', 'armory:eternalgreaves', 'armory:eternaledge'];
  const flow = flowIn(card(Object.fromEntries(ETERNAL.map((id) => [id, { held: true, buy: null }]))), { wardrobe: { titles: [], glyphs: [], auras: [], armory: null } });
  /** @type {unknown[]} */ const asked = [];
  flow.wearArmoryKit = (/** @type {unknown} */ kit) => { asked.push(kit); };
  const w = shopWindow(doc, { flow: () => flow, onClose() {}, keep: { cat: 'armory' }, focus: false, preview: async () => null });
  assert.deepEqual(all(w.root, 'sh-name').map((n) => n.textContent), ['The Eternal Set', 'Eternal Halo', 'Eternal Sigil', 'Eternal Armlets', 'Eternal Greaves', 'Eternal Edge']);
  assert.deepEqual(all(w.root, 'sh-pricen').map((p) => p.textContent), ['2,000', '600', '600', '600', '600', '600']);   // PIN MOVED (AURUM-ONLY): $20 and $6
  assert.equal(all(w.root, 'sh-kind')[0].textContent, 'Aura Armory · a set of 5');
  const set = SHOP_WARES.find((x) => x.id === 'armory:eternalset');
  all(w.root, 'sh-wear')[0].click();
  assert.deepEqual(asked, ['bbbbb'], 'every piece on at once');
  flow.wardrobe.armory = 'bbbbb';
  assert.equal(shopWareState(flow, set).worn, true);
  w.draw();
  all(w.root, 'sh-wear')[0].click();
  assert.deepEqual(asked, ['bbbbb', null], 'worn whole, every piece off');
  flow.wardrobe.armory = 'bbbb0';
  assert.equal(shopWareState(flow, set).worn, false, 'the Edge off: the set is not worn');
  w.stop();
});

test('SHOP: the tab strip by keys - an arrow steps to the next category and wraps, Home and End the ends, the focus with it; only the open tab is in the Tab order (mutants: no keys on the strip; the arrows unwrapped)', () => {
  const doc = fakeDoc();
  const w = shopWindow(doc, { flow: () => flowIn(), onClose() {}, keep: {}, focus: false, preview: async () => null });
  const strip = all(w.root, 'sh-tabs')[0], tabs = () => all(w.root, 'sh-tab');
  const key = (k) => { let stopped = false; for (const f of strip.listeners.keydown ?? []) f({ key: k, preventDefault() {}, stopPropagation() { stopped = true; } }); return stopped; };
  const open = () => tabs().findIndex((t) => t.attrs['aria-selected'] === 'true');
  const first = [0, -1, -1, -1, -1, -1, -1, -1, -1, -1];   // PIN MOVED (STOREFRONT): nine sections; AURUM: ten, the packs'; PASS-PANELS: nine, no boosters; AURUM-ONLY: ten, the icons'
  assert.deepEqual(tabs().map((t) => t.tabIndex), first);
  assert.equal(key('ArrowRight'), true, 'the strip keeps its keys');
  assert.equal(open(), 1);
  assert.equal(doc.activeElement, tabs()[1], 'the focus on the tab opened');
  key('End'); assert.equal(open(), 9);
  key('ArrowRight'); assert.equal(open(), 0, 'round from the last to the first');
  key('ArrowLeft'); assert.equal(open(), 9);
  key('Home'); assert.equal(open(), 0);
  assert.equal(key('Enter'), false, 'any other key is the page\'s');
  assert.deepEqual(tabs().map((t) => t.tabIndex), first);
  w.stop();
});

test('SHOP: the gem - a button that opens a dialog, named Shop, its sheet placed in the row before the window is ever opened; the sheet stills the glint for less motion (mutants: the sheet only with the window; no reduced-motion rule)', () => {
  const doc = fakeDoc();
  let n = 0;
  const b = shopMark(doc, { onOpen: () => { n++; } });
  b.click();
  assert.equal(n, 1);
  assert.equal(b.attrs['aria-label'], 'Shop');
  assert.equal(b.attrs['aria-haspopup'], 'dialog');
  assert.equal(doc.head.children.filter((c) => c.id === 'dagger-shop-style').length, 1, 'the gem\'s sheet in the page with the gem');
  assert.match(SHOP_CSS, /\.px-shopmark \{ position: absolute;/);
  assert.match(SHOP_CSS, /prefers-reduced-motion: reduce\) \{ \.px-shopgem::after \{ animation: none; \}/);
});

test('SHOP: the pause face wires the gem at the end of the row of marks and its window on the timers\' stage - the face under it inert, Escape closing it first, its previews let go at every rebuild and unmount, its flow a visit\'s (mutants: the gem left out of the chain; the window never stopped)', () => {
  const m = rd('src/ui/enhanced/enhancedMenu.js');
  assert.ok(m.includes("const gem = shopGem(home, [mark, envelope, laurel]);"), 'after the laurel');
  assert.ok(m.includes("shopAnchor = anchorSeason(gem, chain, home.querySelector?.('.px-profile'), home);"), 'placed off the chain it is handed, at the row\'s end');
  assert.ok(m.includes("shopView = shopWindow(document, { flow: shopFlowOf, keep: shopKeep, onClose: closeShop, focus: shopFocusIn, wearer: shopBody, now: shopNow });"), 'AUDIT-STOREFRONT (PIN MOVED): its stages wear the profile\'s body - PIN MOVED (AUDIT-STOREFRONT III B8): its clock the shared one');
  assert.ok(m.includes("for (const n of [stage, home.querySelector?.('.px-profile'), mark, envelope, laurel, gem]) n?.setAttribute?.('inert', '');"));
  assert.ok(m.includes(': shopOpen && shopView ? () => { if (!shopView.back()) closeShop(); }'), 'Escape - PIN MOVED (AUDIT-STOREFRONT III C8): an open folio back to its covers first');
  assert.equal(m.split('stopShop();').length - 1, 2, 'a rebuild and the unmount');
  assert.ok(m.includes("shopOpen = false; shopFocusBack = false; shopFlow = null; shopKeep = {};"), 'a visit\'s');
  assert.ok(m.includes('.px-seasonmark, .px-shopmark'), 'a tap on the gem is inside');
  assert.ok(m.includes('const flow = newAccountFlow('), 'the one construction seam');
});

// ── THE ACCOUNT FLOW ──────────────────────────────────────────────────

test('SHOP: the account flow carries the shop\'s card off the account read, says where the player went, and says the pack landed when the read on the way back holds it (AURUM-ONLY, PIN MOVED: a pack is money\'s one ware - a ware\'s row carries its Aurum price and no link); signing out forgets it (mutants: the card never read; the landing never said)', async () => {
  const aurumAt = (balance) => ({ open: true, balance, daily: { until: 1, wares: [] }, week: { until: 1, deeds: {} } });
  const reads = [
    { account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' }, wardrobe: { titles: [], glyphs: [] }, devices: [], shop: card(), aurum: aurumAt(0), pass: { season: 's1', open: true, stage: 0, tracks: { premium: false }, bought: ['glyph:cog'], today: 40, challenges: [] } },
    { account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' }, wardrobe: { titles: [], glyphs: [] }, devices: [], shop: card(), aurum: aurumAt(1100) },
  ];
  let n = 0;
  const fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/v1/account') return Response.json(reads[Math.min(n++, reads.length - 1)]);
    if (path === '/v1/auth/logout') return Response.json({ ok: true });
    throw new Error(`nothing answers ${path}`);
  };
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const flow = AccountFlow({ io: { fetch, base: 'https://accounts.invalid' }, storage });
  await flow.start();
  assert.equal(flow.shop.on, true);
  const row = (/** @type {string} */ id) => flow.shop.wares.find((/** @type {any} */ x) => x.id === id);   // PIN MOVED (STOREFRONT): by its id
  assert.deepEqual([row('title:genesis').buy, row('title:genesis').price], [null, 500], 'a ware: its Aurum price, no money link');
  assert.equal(row('aurum:1100').buy, 'https://accounts.invalid/v1/shop/buy?t=1100');
  assert.deepEqual([flow.pass.bought, flow.pass.today], [['glyph:cog'], 40], 'STOREFRONT: the season\'s card beside it (PASS-PANELS: what it bought, its finds today)');
  flow.shopOpened('aurum:1100');
  assert.equal(flow.shopWaiting, 'aurum:1100');
  assert.equal(flow.note, 'Finish paying in your browser, then come back here.');
  assert.equal(await flow.refresh(), true);
  assert.equal(flow.aurum.balance, 1100);
  assert.equal(flow.shopWaiting, null);
  assert.equal(flow.note, '1,100 Aurum is on your account. A receipt is in your mailbox.');
  flow.shopOpened('title:nonsense');
  assert.equal(flow.shopWaiting, null, 'no ware, no waiting');
  await flow.signOut();
  assert.equal(flow.shop, null);
  assert.equal(flow.pass, null, 'and the season\'s card');
});

// ── THE MAILBOX'S RECEIPT ─────────────────────────────────────────────

test('SHOP: a receipt\'s head keeps its ware - one of the shop\'s, nothing else - and the mailbox draws it in its own paint with nothing to claim (mutants: any word kept; the receipt drawn as an item)', () => {
  const head = { id: 'a'.repeat(24), from: 'The Developers', subject: 'Thank you: Genesis', sentAt: 1, read: false };
  assert.equal(postHead({ ...head, ware: 'title:genesis' }).ware, 'title:genesis');
  assert.equal('ware' in postHead({ ...head, ware: 'title:founder' }), false, 'a ware the shop never sold is no ware');
  assert.equal('ware' in postHead(head), false);
  const doc = fakeDoc();
  const tag = shopWareTag(doc, 'title:genesis');
  assert.ok(tag.children.at(-1).classList.contains(FLAME_CLASS), 'the title on its fire');
  const aura = shopWareTag(doc, 'aura:eternal');
  assert.ok(!aura.children.at(-1).classList.contains(FLAME_CLASS), 'an aura\'s word in its paint - never the title\'s plate');
  assert.equal(shopWareTag(doc, 'glyph:origin').children.length, 2, 'the glyph\'s drawing before its label');
  assert.equal(shopWareTag(doc, 'nope'), null);
  const post = rd('src/ui/enhanced/enhancedPost.js');
  assert.ok(post.includes("} else if (p.ware) {   // SHOP: a receipt") && post.includes("} else if (head.ware) {   // SHOP: the receipt's ware"));
});

// ── THE CATALOGUE ─────────────────────────────────────────────────────

test('SHOP: Collections says how each ware is had - from the Shop, at its price in Aurum (AURUM-ONLY, PIN MOVED: no proceeds\' line - nothing is bought there with money) - and each is In the shop exactly while the service\'s SHOP_ON_SALE names it, else No longer obtainable (mutants: a sale ended and the catalogue still selling; the shop not Obtainable)', () => {
  const toml = rd('server-account/wrangler.toml');
  const onSale = shopOnSaleOf(/^SHOP_ON_SALE = "([^"]*)"$/m.exec(toml)?.[1]);
  // ARMORY: a set is no entry of its own - its pieces are, each naming the set and its price
  const set = SHOP_WARES.find((w) => w.id === 'armory:eternalset');
  // PIN MOVED (STOREFRONT): the wardrobe's kinds alone (an effect, a pass, a bundle and a booster are none of it); a ware
  // past the pre-alpha's is `store`, and one sold only in a bundle is had while a bundle that gives it is on sale
  const wardrobeKinds = new Set(['title', 'aura', 'armory', 'glyph']);
  for (const w of SHOP_WARES.filter((x) => x !== set && wardrobeKinds.has(x.kind))) {
    const e = wardrobeEntry(w.kind, w.key);
    assert.equal(e.src, 'shop', w.id);
    if (w.kind === 'armory') assert.match(e.how(), /The Eternal Set gives it with the other four for 2,000 Aurum\./, `${w.id}: the set beside it`);   // PIN MOVED (PLAIN-TEXT): two sentences
    const sold = w.alone ? onSale.includes(w.id) : SHOP_WARES.some((b) => b.gives.includes(w.id) && onSale.includes(b.id));
    assert.equal(e.avail, sold ? (w.preAlpha ? 'shop' : 'store') : 'retired', `${w.id}: its availability follows the sale list`);
    if (w.alone) assert.ok(e.how().includes(`for ${w.price.toLocaleString('en-US')} Aurum`), `${w.id}: its price`);
    else assert.match(e.how(), /^Comes only in a bundle from the shop/, `${w.id}: its bundles, no price of its own`);
    assert.doesNotMatch(e.how(), /proceeds|\$/, `${w.id}: no money`);
  }
  assert.ok(AVAIL_NOW.includes('shop') && AVAIL_NOW.includes('store'));
  assert.equal(AVAIL_TAG.shop(), 'In the shop');
  assert.equal(AVAIL_TAG.store(), 'In the shop');
  assert.match(AVAIL_LINE.shop(), /pre-alpha only/);
  assert.doesNotMatch(AVAIL_LINE.store(), /pre-alpha/, 'a ware sold for good says so');
  assert.ok(WARDROBE_SOURCES.some(([id]) => id === 'shop'));
  assert.ok(wardrobeEntry('aura', 'eternal').look().length > 20);
});

// ── GENESIS ───────────────────────────────────────────────────────────

test('SHOP: Genesis - its letters the fire\'s pale heart, 44 or more from every other title\'s colour, on a plate of fire on every DOM face: its paint no gradient clipped to the letters, the plate a class (mutants: the plate on another title; the gradient clipped over the fire)', () => {
  const apart = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a[i] - b[i]) * 255));
  for (const [k, c] of Object.entries(TITLE_RGBA)) if (k !== 'genesis') assert.ok(apart(TITLE_RGBA.genesis, c) > 40, `apart from the ${k}'s (${apart(TITLE_RGBA.genesis, c).toFixed(0)})`);
  assert.equal(TITLE_RGBA.genesis, GENESIS_HEART);
  const b = titleBadge({ title: 'genesis' });
  assert.equal(b.flame, true);
  assert.equal(titleBadge({ title: 'founder' }).flame, false);
  const p = titlePaint(b);
  assert.equal(p.backgroundImage, '', 'the fire is the class\'s - never clipped into the letters');
  assert.equal(p.color, '#d6b8ff');
  assert.match(p.textShadow, /#0b0620/, 'edged dark, so they read over the fire');
  assert.deepEqual(Object.keys(TITLE_FLAME), ['genesis', 'dawnbringer', 'voidwalker', 'eternalchampion', 'heartwaker', 'numidiumecho']);   // PIN MOVED (STOREFRONT): the name visuals' plates and the pass's two
  const doc = fakeDoc();
  const node = doc.createElement('div');
  node.ownerDocument = doc;
  setTitleFlame(node, 'genesis');
  assert.ok(node.classList.contains(FLAME_CLASS) && node.classList.contains(flameClassOf('genesis')));
  setTitleFlame(node, 'founder');
  assert.ok(!node.classList.contains(FLAME_CLASS) && !node.classList.contains(flameClassOf('genesis')), 'another title takes the plate off');
  for (const f of ['src/ui/nameLayer.js', 'src/ui/enhanced/enhancedAccount.js']) assert.ok(rd(f).includes('setTitleFlame('), `${f} gives the plate`);
});

test('SHOP: Genesis\'s plate is painted a frame an idle moment, never the sheet in one frame of the game: the frames are the sheet\'s, the sheet laid once however many faces ask, and nothing laid with no canvas (mutants: the sheet painted at once; laid twice)', async () => {
  const spec = TITLE_FLAME.genesis;
  const whole = flameSheetPixels(spec), one = new Uint8ClampedArray(whole.data.length);
  flameFramePixels(spec, 3, one);
  const at = 3 * spec.w * spec.h * 4, size = spec.w * spec.h * 4;
  assert.deepEqual([...one.slice(at, at + size)], [...whole.data.slice(at, at + size)], 'a frame painted alone is the sheet\'s');
  assert.ok(one.slice(0, at).every((v) => v === 0), 'and touches no other frame');
  const doc = fakeDoc(), painted = [];
  const real = { ImageData: globalThis.ImageData, idle: globalThis.requestIdleCallback };
  let idles = 0;
  globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
  globalThis.requestIdleCallback = (f) => { idles++; setTimeout(f, 0); };
  const made = doc.createElement;
  doc.createElement = (tag) => { const n = made(tag); if (tag === 'canvas') n.getContext = () => ({ putImageData: (img) => painted.push(img) }); n.toDataURL = () => 'data:image/png;base64,AAAA'; return n; };
  try {
    const first = ensureTitleFlames(doc), second = ensureTitleFlames(doc);
    assert.ok(first instanceof Promise && second === first, 'asked twice while painting, painted once');
    assert.equal(doc.head.children.length, 0, 'nothing laid before the frames are painted');
    await first;
    const plates = Object.values(TITLE_FLAME);   // PIN MOVED (STOREFRONT): every plate's sheet laid together, each a frame an idle moment
    assert.equal(idles, plates.reduce((n, p) => n + p.frames, 0), 'a frame an idle moment');
    assert.equal(painted.length, plates.length);
    assert.equal(painted[0].height, spec.h * spec.frames);
    assert.equal(doc.head.children.filter((c) => c.id === FLAME_STYLE_ID).length, 1);
    assert.ok(doc.head.children[0].textContent.includes('data:image/png;base64,AAAA'));
    assert.equal(ensureTitleFlames(doc), null, 'laid: asked again, nothing to do');
  } finally { globalThis.ImageData = real.ImageData; globalThis.requestIdleCallback = real.idle; }
  assert.equal(ensureTitleFlames(fakeDoc()), null, 'no canvas: nothing laid');
});

test('SHOP: Genesis\'s fire - its frames whole, its gutter clear, its colours the fire\'s own (blue and violet, never warm), tiling round its strip and stepped a frame at a time, still for less motion (mutants: the gutter filled; a warm fire; the strip seamed)', () => {
  const spec = TITLE_FLAME.genesis;
  const s = flameSheetPixels(spec);
  assert.equal(s.width, spec.w);
  assert.equal(s.height, spec.h * spec.frames);
  let lit = 0, warm = 0;
  for (let f = 0; f < spec.frames; f++) for (let y = 0; y < spec.h; y++) for (let x = 0; x < spec.w; x++) {
    const i = ((f * spec.h + y) * spec.w + x) * 4;
    if (y >= spec.h - 2) assert.equal(s.data[i + 3], 0, 'the gutter rows clear');
    if (s.data[i + 3] > 128) { lit++; if (s.data[i] > s.data[i + 2] + 8) warm++; }
  }
  assert.ok(lit > spec.w * spec.h * spec.frames * 0.2, 'fire enough to be a plate');
  assert.equal(warm, 0, 'never a red or orange pixel - blue and violet');
  // round the strip: the last column meets the first as any two neighbours do
  const colDiff = (a, b) => { let d = 0; for (let y = 0; y < spec.h; y++) for (let c = 0; c < 4; c++) d += Math.abs(s.data[(y * spec.w + a) * 4 + c] - s.data[(y * spec.w + b) * 4 + c]); return d; };
  const mean = [...Array(spec.w - 1).keys()].reduce((a, x) => a + colDiff(x, x + 1), 0) / (spec.w - 1);
  assert.ok(colDiff(spec.w - 1, 0) < mean * 3, `seamless round the strip (${colDiff(spec.w - 1, 0)} against ${mean.toFixed(0)})`);
  assert.deepEqual([...flameSheetPixels(spec).data.slice(0, 4000)], [...s.data.slice(0, 4000)], 'the same sheet on every machine');
  const css = flameCss(() => 'data:x');
  assert.match(css, new RegExp(`animation: ${flameClassOf('genesis')} ${spec.seconds}s steps\\(${spec.frames}\\) infinite`));
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.dftitle-flame \{ animation: none !important; \}/);
});

// ── THE ORIGIN ────────────────────────────────────────────────────────

/** A path's subpaths, flattened (Q sampled), in its own commands - M, L, Q and Z alone. */
function flatten(d) {
  assert.match(d, /^[MLQZ0-9 .-]+$/, 'M, L, Q and Z alone');
  const subs = [];
  for (const part of d.split('M').filter(Boolean)) {
    const toks = part.match(/[LQZ]|-?[0-9.]+/g);
    let i = 0;
    const num = () => Number(toks[i++]);
    let cur = [num(), num()];
    const pts = [cur];
    while (i < toks.length) {
      const c = toks[i++];
      if (c === 'L') { cur = [num(), num()]; pts.push(cur); }
      else if (c === 'Q') { const q = [num(), num()], e = [num(), num()]; for (let k = 1; k <= 6; k++) { const t = k / 6; pts.push([(1 - t) ** 2 * cur[0] + 2 * (1 - t) * t * q[0] + t * t * e[0], (1 - t) ** 2 * cur[1] + 2 * (1 - t) * t * q[1] + t * t * e[1]]); } cur = e; }
    }
    subs.push(pts);
  }
  return subs;
}
const crosses = (pts) => {
  const X = (p, q, r, s) => { const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]); if (Math.abs(d) < 1e-12) return false; const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d; return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6; };
  const n = pts.length;
  for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) { if (a === 0 && b === n - 1) continue; if (X(pts[a], pts[(a + 1) % n], pts[b], pts[(b + 1) % n])) return true; }
  return false;
};
const windingAt = (pts, p) => { let w = 0; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; let d = Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(a[1] - p[1], a[0] - p[0]); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; w += d; } return Math.round(w / (2 * Math.PI)); };

test('SHOP: the Origin - its ring one outline never crossing itself, open at its middle where the spark burns, inside its box; five details; `Q` its classic mark, no other glyph\'s; a thinner edge of its own (mutants: the ring closed; a crossing; a detail lost)', () => {
  const [ring, ...claws] = flatten(GLYPH_PATH.origin);
  assert.equal(crosses(ring), false, 'never crossing itself');
  assert.equal(Math.abs(windingAt(ring, [8, 8.75])), 0, 'the ring open at its middle - the spark burns in the hole');
  assert.equal(Math.abs(windingAt(ring, [8, 13.0])), 1, 'and its body filled');
  assert.equal(claws.length, 2, 'two clutches of claws');
  for (const p of [ring, ...claws].flat()) assert.ok(p[0] > -0.2 && p[0] < 16.2 && p[1] > -0.2 && p[1] < 16.2, `inside its box (${p})`);
  assert.equal(glyphDetails(GLYPH_DETAIL.origin).length, 5);
  assert.equal(GLYPH_DETAIL.origin[0].rgba, GENESIS_DEEP);
  for (const d of glyphDetails(GLYPH_DETAIL.origin)) for (const sub of flatten(d.path)) assert.equal(crosses(sub), false);
  assert.equal(GLYPH_MARK.origin, 'Q');
  assert.equal(Object.entries(GLYPH_MARK).filter(([, m]) => m === 'Q').length, 1);
  assert.equal(GLYPH_EDGE_OF.origin, 0.32);
});

test('SHOP: the Origin moves in its own SVG - its light turning, its eye breathing, its spark swelling - each swell a path of the same commands as its detail\'s, so it morphs; and stands still where the player asks for less motion (mutants: a swell of other commands; motion with less motion asked)', () => {
  const M = GLYPH_MOTION.origin;
  assert.equal(M.spin, 8);
  const shape = (d) => d.replace(/-?[0-9.]+/g, '#');
  for (const [i, m] of M.details.entries()) if (m?.d) assert.equal(shape(m.d), shape(GLYPH_DETAIL.origin[i].path), `detail ${i} swells as itself`);
  const doc = fakeDoc();
  const g = glyphBadges({ glyphs: ['origin'] })[0];
  const svg = glyphArtNode(doc, g, 'x');
  const tags = []; walk(svg, (n) => tags.push(n.tag));
  assert.equal(tags.filter((t) => t === 'animateTransform').length, 1, 'the light turning');
  assert.equal(tags.filter((t) => t === 'animate').length, 4, 'the panes and the eye breathing, the spark and its halo swelling');
  const edge = svg.children[0].attrs['stroke-width'];
  assert.equal(edge, '0.32');
  const real = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const still = glyphArtNode(doc, g, 'x');
    const t2 = []; walk(still, (n) => t2.push(n.tag));
    assert.ok(!t2.includes('animate') && !t2.includes('animateTransform'), 'still');
  } finally { globalThis.matchMedia = real; }
});

// ── ETERNAL ───────────────────────────────────────────────────────────

test('SHOP: Eternal - the sixteenth look, a cape on the cloak\'s mesh, premultiplied, its cards wisps and embers; its rates whole over the clock; its light the Genesis fire\'s; its look built alone (mutants: a rate off the clock; the look added whole)', () => {
  assert.deepEqual({ ...AURA_LOOK.eternal }, { kind: 15, ringR: 0.95, flameH: 1.54, glyphs: ETERNAL_CARDS, mesh: 'cape', shade: true });
  assert.ok(AURA_CARDS >= ETERNAL_CARDS);
  assert.equal(eternalRatesWhole(), true);
  assert.deepEqual([...ETERNAL_RGB.deep], [...GENESIS_DEEP.slice(0, 3)]);
  assert.equal(AURA_PAINT.eternal, 'genesis');
  const [[vs, fs]] = auraPrograms(15);
  assert.ok(vs.includes('const int uAura = 15;') && fs.includes('const int uAura = 15;'));
  assert.ok(fs.includes('if (uAura == 15) { vec4 c = uKind == 0 ? eternalGround(vP) : uKind == 1 ? eternalWall(vP) : eternalCard(vP, vS);'));
});

test('SHOP: Eternal\'s draw - its pool, its cloth\'s two sides on the cloak\'s mesh (the lining first, front faces culled), its wisps and embers - premultiplied; none of its cloth with the eye at its wearer\'s head; none of it on a rider or a beast burned through (mutants: one side; the cloth over the wearer\'s own view; a rider\'s cape drawn)', () => {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) { if (k in tg) return tg[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const r = new AuraRingRenderer(gl);
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const seq = () => calls.filter((c) => c[0] === 'drawArrays' || (c[0] === 'cullFace')).map((c) => (c[0] === 'drawArrays' ? c[3] : c[1] === 14 ? 'front' : 'back'));
  r.draw([{ at: [0, 0, 0], aura: 'eternal', yaw: 0 }], new Float32Array(I), new Float32Array(I), [0, 1.5, -4], 10);
  assert.deepEqual(seq(), [6, 'front', CLOAK_ROUND * CLOAK_ROWS * 6, 'back', CLOAK_ROUND * CLOAK_ROWS * 6, 'back', ETERNAL_CARDS * 6, 'back']);
  assert.ok(calls.some((c) => c[0] === 'blendFunc' && c[2] === 13), 'premultiplied');
  calls.length = 0;
  r.draw([{ at: [0, 0, 0], aura: 'eternal', yaw: 0 }], new Float32Array(I), new Float32Array(I), [0, CLOAK_REST_POSE.head[1], 0], 10);
  assert.deepEqual(seq().filter((x) => typeof x === 'number'), [6, ETERNAL_CARDS * 6], 'from its wearer\'s own eye: no cloth');
  for (const w of [{ mounted: true }, { torn: 5 }]) {
    calls.length = 0;
    r.draw([{ at: [0, 0, 0], aura: 'eternal', yaw: 0, ...w }], new Float32Array(I), new Float32Array(I), [0, 1.5, -4], 10);
    assert.deepEqual(seq().filter((x) => typeof x === 'number'), [6], JSON.stringify(w));
  }
  assert.equal(auraEyeAtHead({ at: [0, 0, 0], yaw: 0 }, [0, CLOAK_REST_POSE.head[1], 0]), true);
  assert.equal(auraEyeAtHead({ at: [0, 0, 0], yaw: 0 }, [0, 1.5, -2]), false);
});

test('SHOP: ETERNAL-FIT (the owner: "The new aura isnt properly positioned. It needs to follow the same law as the wing aura") - on a sprite\'s flat card the cape hangs as far back as the wings root (WINGS-FIT\'s uWingBack): the pass uploads it for the cape; its cloth and its wisps and embers move back along the facing, at any yaw; and from the front round to either side none of it lies over the body (mutants: the push dropped; the push forward)', () => {
  const sp = auraCapePose(auraSpriteBones({ base: 0, mpp: EOTB_FIGURE.mpp }));
  assert.equal(sp.wingBack, WING_SPRITE_BACK, 'a sprite\'s pose carries the depth (WINGS-FIT)');
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) { if (k in tg) return tg[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  new AuraRingRenderer(gl).draw([{ at: [0, 0, 0], aura: 'eternal', yaw: 0, cape: sp }], new Float32Array(I), new Float32Array(I), [0, 1.5, -4], 10);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uWingBack').map((c) => c[2]), [WING_SPRITE_BACK], 'uploaded with the cape\'s pose');
  const QUIET = 13.2;
  const F = glslFunctions(AURA_VS, { uWingBack: 0, uSeed: 0.37, uRingR: ETERNAL_POOL_R, uGroundR: AURA_GROUND_R, uFlameH: ETERNAL_TOP, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uLift: AURA_LIFT_M, uVP: I, uSide: 1, uTorn: -1, uSwing: [0, 0, 0, 0],
    uCapeS: [...sp.shoulders], uCapeH: [...sp.head], uKneeL: [0, 0, 0], uKneeR: [0, 0, 0], uTorsoU: [0, 1, 0], uTorsoF: [0, 0, 1], uKind: 1, uTime: QUIET, uYaw: 0, uCamPos: [0, 1.5, -6] });
  // back along the facing, as the wings' roots: the cloth and a card's flight alike, at any yaw
  for (const yaw of [0, 1.1, -2.3]) {
    F.globals.uYaw = yaw;
    F.globals.uWingBack = 0; const a = F.eternalPoint([0.3, 0.4], QUIET), fa = F.eternalFlight(5, QUIET);
    F.globals.uWingBack = WING_SPRITE_BACK; const b = F.eternalPoint([0.3, 0.4], QUIET), fb = F.eternalFlight(5, QUIET);
    const back = [-Math.sin(yaw) * WING_SPRITE_BACK, 0, -Math.cos(yaw) * WING_SPRITE_BACK];
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(b[i] - a[i] - back[i]) < 1e-6 && Math.abs(fb[i] - fa[i] - back[i]) < 1e-6, `yaw ${yaw}: moved back ${WING_SPRITE_BACK} m`);
  }
  F.globals.uYaw = 0;
  // THE LAW, WINGS-FIT's: the card stands through the axis square to the eye; the body in it 0.25 m either side to its
  // shoulders, the head 0.15 m above them. From its front round to either side no point of the cloth (a grid over its
  // mesh) or of a wisp's or ember's flight lies nearer the eye than the card and inside that outline
  const headTop = sp.head[1] + 0.12;
  const overBody = (back) => {
    F.globals.uWingBack = back;
    const pts = [];
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 12; j++) pts.push(F.eternalPoint([i / 16, j / 12], QUIET));
    for (let k = 0; k < ETERNAL_CARDS; k++) for (const t of [QUIET, QUIET + 0.4, QUIET + 0.9]) pts.push(F.eternalFlight(k, t).slice(0, 3));
    let n = 0;
    for (const deg of [0, 30, 60, 90, -30, -60, -90]) {
      const ph = deg * Math.PI / 180, to = [Math.sin(ph), Math.cos(ph)];   // the eye's way from the feet - the wearer faces +z
      for (const p of pts) if (p[0] * to[0] + p[2] * to[1] > 0 && Math.abs(p[0] * to[1] - p[2] * to[0]) < (p[1] < sp.shoulders[1] ? 0.25 : 0.15) && p[1] < headTop) n++;
    }
    return n;
  };
  assert.equal(overBody(WING_SPRITE_BACK), 0, 'none of the cape over the body, from its front round to either side');
  const was = overBody(0);
  assert.ok(was > 100, `hung on the axis, it lay over the body (${was} points)`);
});

test('SHOP: the aura\'s stage - a floor and a stand-in figure whose shoulders are the cloak\'s rest pose\'s, its stroll walking, turning and stopping so a cape swings (mutants: the figure\'s shoulders off the pose; a stroll that never stops)', () => {
  const mesh = previewMesh();
  assert.equal(mesh.count, mesh.floorN + PREVIEW_FIGURE.length * 36);
  const top = Math.max(...PREVIEW_FIGURE.filter((b) => Math.abs(b[0]) < 0.01 && b[4] < 0.1).map((b) => b[1] + b[4]).filter((y) => y < 1.45));
  assert.ok(Math.abs(top - CLOAK_REST_POSE.shoulders[1]) < 0.06, `the shoulders where a cape hangs (${top})`);
  const paces = [...Array(90).keys()].map((k) => previewStroll(k / 10).pace);
  assert.ok(paces.some((p) => p === 0) && Math.max(...paces) > PREVIEW_STROLL.pace * 0.9, 'it stops, and it walks');
  assert.ok(new Set([...Array(130).keys()].map((k) => previewStroll(k / 10).yaw.toFixed(2))).size > 20, 'and it turns');
});

// ── STOREFRONT: THE CAROUSEL, THE BUNDLES, THE PASS ───────────────────

test('STOREFRONT the carousel: the card\'s featured wares a slide each, in its order, the dots a button each; arrows, dots, the arrow keys and a swipe step it; it turns every eight seconds and never while paused, pointed at, focused or for less motion; the featured window and a limited one said; none featured, none shown (mutants: the clock turning while held; the slide not kept; a featured ware never said)', () => {
  const NOW = Date.UTC(2026, 10, 14, 12);
  const shop = card({ 'kill:pyre': { until: Date.UTC(2026, 10, 17), limited: true }, 'portal:aetheric': { until: Date.UTC(2026, 10, 27) } });
  shop.featured = ['kill:ashen', 'kill:pyre', 'portal:aetheric', 'glyph:oblivion'];   // PIN MOVED (PASS-PANELS): no pass is a ware
  const flow = flowIn(shop);
  assert.deepEqual(shopCarouselOf(flow).map((w) => w.id), ['kill:ashen', 'kill:pyre', 'portal:aetheric'], 'a ware never sold alone is never featured');
  assert.deepEqual(shopCarouselOf(flowIn(null)), []);
  const doc = fakeDoc(), keep = {};
  const w = shopWindow(doc, { flow: () => flow, onClose() {}, keep, focus: false, now: () => NOW, preview: async () => null, effectPreview: async () => null, reduced: false });
  const car = all(w.root, 'sh-carousel')[0];
  assert.equal(car.attrs['aria-roledescription'], 'carousel');
  const slide = () => all(car, 'sh-slide')[0];
  assert.equal(slide().attrs['data-ware'], 'kill:ashen');
  assert.equal(slide().attrs['aria-label'], '1 of 3');
  assert.equal(all(car, 'sh-cdot').length, 3);
  all(car, 'sh-cnext')[0].click();
  assert.equal(slide().attrs['data-ware'], 'kill:pyre');
  assert.equal(all(slide(), 'sh-until')[0].textContent, 'Limited: sold only until Nov 16. 3 days left.');
  assert.equal(keep.slide, 1, 'the slide kept, for a face rebuilt around the window');
  all(car, 'sh-cprev')[0].click(); all(car, 'sh-cprev')[0].click();
  assert.equal(slide().attrs['data-ware'], 'portal:aetheric', 'round from the first to the last');
  assert.match(all(slide(), 'sh-until')[0].textContent, /^Featured until Nov 26\./);
  all(car, 'sh-cdot')[0].click();
  assert.equal(slide().attrs['data-ware'], 'kill:ashen');
  assert.equal(all(car, 'sh-cdot')[0].attrs['aria-pressed'], 'true');
  for (const f of car.listeners.keydown) f({ key: 'ArrowRight', preventDefault() {}, stopPropagation() {} });
  assert.equal(slide().attrs['data-ware'], 'kill:pyre');
  const host = all(car, 'sh-cslides')[0];
  for (const f of host.listeners.pointerdown) f({ clientX: 200 });
  for (const f of host.listeners.pointerup) f({ clientX: 120 });
  assert.equal(slide().attrs['data-ware'], 'portal:aetheric', 'a swipe left: the next');
  // the clock's rule
  const held = { n: 3, paused: false, reduced: false, hovered: false, focusedIn: false, since: 0 };
  assert.equal(CAROUSEL_TURN_MS, 8000);
  assert.equal(carouselTurns(held, 7999), false);
  assert.equal(carouselTurns(held, 8000), true);
  for (const k of ['paused', 'reduced', 'hovered', 'focusedIn']) assert.equal(carouselTurns({ ...held, [k]: true }, 9000), false, k);
  assert.equal(carouselTurns({ ...held, n: 1 }, 9000), false, 'one slide never turns');
  all(car, 'sh-cpause')[0].click();
  assert.equal(all(car, 'sh-cpause')[0].textContent, 'Play', 'paused: the press plays it again');
  w.stop();
  const none = shopWindow(fakeDoc(), { flow: () => flowIn(), onClose() {}, focus: false, preview: async () => null, effectPreview: async () => null });
  assert.ok(String(all(none.root, 'sh-carousel')[0].className).includes('sh-empty'), 'nothing featured: no carousel');
  none.stop();
});

test('STOREFRONT the bundles: a bundle\'s panel lists what it gives, each held one marked (a ware sold alone by the card, a bundle\'s glyph or aura by the wardrobe), its worth bought alone, and the price this account pays beside the list price struck through (mutants: a held piece unmarked; the account\'s price never shown)', () => {
  const flow = flowIn(card({ 'bundle:daedricchampion': { price: 1628 }, 'kill:pyre': { held: true } }), { wardrobe: { titles: [], glyphs: ['oblivion'], auras: [], effectsHeld: { kill: ['pyre'], portal: [], mount: [] } } });
  const w = shopWareById('bundle:daedricchampion');
  assert.deepEqual(shopBundleRows(flow, w).map((r) => [r.id, r.held]), [['aura:dominion', false], ['kill:pyre', true], ['title:eternalchampion', false], ['glyph:oblivion', true]]);
  assert.equal(shopHeldAny(flow, 'glyph:oblivion'), true);
  assert.equal(shopHeldAny(flow, 'aura:dominion'), false);
  const win = shopWindow(fakeDoc(), { flow: () => flow, onClose() {}, keep: { cat: 'bundles' }, focus: false, preview: async () => null, effectPreview: async () => null });
  const panel = all(win.root, 'sh-panel').find((p) => p.attrs['data-ware'] === 'bundle:daedricchampion');
  assert.equal(all(panel, 'sh-content').length, 4);
  assert.equal(all(panel, 'sh-content-held').length, 2);
  // PIN MOVED (AUDIT-STOREFRONT II): the prices under SHOP_PRICE_CAP; the account's the service's, the Pyre and the Sigil held
  // PIN MOVED (AURUM-ONLY): in Aurum - its worth 4,300, its price 2,800, this account's share of it 1,628
  assert.equal(all(panel, 'sh-worth')[0].textContent, 'Worth 4,300 Aurum bought alone.');
  assert.equal(all(panel, 'sh-pricen')[0].textContent, '1,628');
  assert.equal(all(panel, 'sh-was')[0].textContent, '2,800', 'the list price struck through beside it');
  assert.equal(all(panel, 'sh-tier')[0].textContent, 'Exclusive');
  win.stop();
});

test('STOREFRONT the Folios\' head (PASS-PANELS): the season\'s story and its three stages, how the folios work, the Aurum the account\'s finds earned today against the day\'s bound, the open stage\'s five challenges each its count and its Aurum, one done; signed out, the covers still shown and the way in said; no pass or booster is a section (mutants: another stage\'s challenges; the day\'s bound unsaid)', () => {
  const NOW = Date.UTC(2026, 10, 14, 12);
  const pass = passCardOf({ season: 's1', open: true, stage: 0, tracks: { premium: false }, bought: [], today: 40, challenges: [{ key: 'tremor-foes', n: 40, paid: false }, { key: 'tremor-tavern', n: 3, paid: true }] });
  const aurum = aurumCardOf({ open: true, balance: 300, daily: { until: NOW + 3_600_000, wares: [] }, week: { until: NOW + 86_400_000, deeds: {} } });
  const flow = flowIn(card(), { pass, aurum });
  const w = shopWindow(fakeDoc(), { flow: () => flow, onClose() {}, focus: false, now: () => NOW, preview: async () => null, effectPreview: async () => null });
  const sec = all(w.root, 'sh-pass')[0];
  assert.equal(all(sec, 'sh-passname')[0].textContent, "Dwemer's Breach");
  assert.deepEqual(all(sec, 'sh-stagename').map((n) => n.textContent), ['The Tremor', 'The Brass Halls', 'The Heart Wakes']);
  assert.ok(String(all(sec, 'sh-stagechip')[0].className).includes('sh-stage-open'));
  assert.deepEqual(all(sec, 'sh-stagewhen').map((n) => n.textContent), ['Until Nov 29', 'Opens Nov 30', 'Opens Dec 20']);
  assert.equal(all(sec, 'sh-passhow')[0].textContent, 'Spend Aurum on any item of an open page. Each page opens once you spend enough in its folio. The folios never close.');
  assert.equal(all(sec, 'sh-daytext')[0].textContent, 'Aurum found today: 40 of 100');
  assert.equal(all(sec, 'sh-dayfill')[0].style.width, '40%');
  assert.equal(all(sec, 'sh-passwho')[0].textContent, '', 'signed in with Aurum open: nothing to say');
  assert.deepEqual(all(w.root, 'sh-cwhat').map((n) => n.textContent), ['Kill 100 foes', 'Destroy 25 Dwemer constructs', 'Gather 60 times', 'Win 3 tavern games', 'Win 1 endgame fight: a breach, a Redoubt, the Serpent, the Dwarven Dragon or a star']);   // PIN MOVED (STOREFRONT): a count's own plural (ui/passText.js, ICU)
  assert.deepEqual(all(w.root, 'sh-caurum').map((n) => n.textContent), PASS_CHALLENGES.filter((c) => c.stage === 0).map((c) => `+${c.aurum} Aurum`));
  assert.equal(all(w.root, 'sh-ccount')[0].textContent, '40 / 100');
  assert.equal(all(w.root, 'sh-cdone').length, 1);   // PIN MOVED (AUDIT-STOREFRONT II, lane E 5): never the foot's payment line's class
  assert.equal(all(w.root, 'sh-stripe').length, 1, 'the payment line, a class of its own');
  w.stop();
  const out = shopWindow(fakeDoc(), { flow: () => ({ stage: 'out' }), onClose() {}, focus: false, now: () => NOW, preview: async () => null, effectPreview: async () => null });
  assert.equal(all(out.root, 'sh-passwho')[0].textContent, 'Sign in with a username to buy from the Folios.');
  assert.equal(all(out.root, 'sh-fcover').length, 2, 'the covers shown to anyone');
  assert.equal(all(out.root, 'sh-passday')[0].hidden, true, 'no card: no day\'s finds');
  out.stop();
  assert.deepEqual(shopSections(flowIn(null)), ['pass']);   // PIN MOVED (SHOP-UNTOLD): no card, no ware - the Folios alone (test/ui/shop_untold.test.js); PIN MOVED (PASS-PANELS): the Folios a section with no ware
  assert.equal(shopUntilText(Date.UTC(2026, 10, 15), false, Date.UTC(2026, 10, 14, 20)), 'Featured until Nov 14. Ends today.');
});
