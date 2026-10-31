// AUDIT-STOREFRONT II (lane E, 2026-10-29; bible/01-Overview/audits/Audit-Storefront.md): THE SHOP ON THE ENHANCED PLUS
// KIT. Every surface the shop draws carries its kit role (ui/enhanced/enhancedFrame.js FRAME_ROLES), so a theme and the
// Grimoire dress it, and its own sheet never paints one; the head, disclaimer and tabs stand over a scrolled part; a stage
// starts in sight; the carousel slides on a turn alone and never turns out of sight; a painted word on a page is inked.
// And the profile: its picker under the stage on a narrow card, and a locked effect told how it is had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { aurumCardOf } from '../../src/net/aurumLaw.js';   // AURUM-ONLY: every ware bought with Aurum
import { EFFECTS } from '../../src/net/effectLaw.js';
import { passCardOf, passItemOf, passPanelsOf } from '../../src/net/battlePassLaw.js';
import { passFolioName } from '../../src/ui/passText.js';
import { shopWindow, carouselTurns, SHOP_CSS } from '../../src/ui/enhanced/enhancedShop.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';
import { wardrobeEntry } from '../../src/ui/collections/wardrobeCatalogue.js';
import { titlePaint, titleBadge } from '../../src/ui/playerBadge.js';

function fakeDoc({ grimoire = false, IO = null } = {}) {
  const doc = { activeElement: null, head: null, defaultView: IO ? { IntersectionObserver: IO } : null, byId: new Map(), documentElement: { dataset: grimoire ? { plusDress: 'grimoire' } : {} } };
  const node = (tag) => {
    const n = {
      tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '', id: '', href: '', target: '', rel: '', tabIndex: 0, isConnected: true, parent: null, hidden: false, offsetTop: 0, scrollTop: 0,
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
// PIN MOVED (PASS-PANELS): no pass is a ware. PIN MOVED (AURUM-ONLY): the card as the service answers it - a pack its
// money link, every other ware sold alone its Aurum price - with Aurum open to the account
const card = () => ({ on: true, wares: SHOP_WARES.filter((w) => w.alone).map((w) => ({ id: w.id, sale: true, held: false, ...(w.cash ? { buy: `https://accounts.invalid/v1/shop/buy?t=${w.key}`, cents: w.cents } : { price: w.price }) })), featured: ['kill:ashen', 'kill:pyre', 'portal:runic'] });
const AURUM = aurumCardOf({ open: true, balance: 5000, daily: { until: 1, wares: [] }, week: { until: 1, deeds: {} } });
const flowIn = (extra = {}) => ({ stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, wardrobe: { titles: [], glyphs: [], auras: [] }, shop: card(), aurum: AURUM, busy: false, ...extra });
const open = (o = {}, doc = fakeDoc()) => shopWindow(doc, { flow: () => o.flow ?? flowIn(), onClose() {}, keep: o.keep ?? {}, focus: false, reduced: !!o.reduced, now: o.now, preview: o.preview ?? (async () => null), effectPreview: o.effectPreview ?? (async () => null) });

/** The sheet's rules, each its selectors and its declarations (an @media's flattened in). */
const rules = (css) => [...css.replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().split('\n').pop(), decl: m[2] }));

test('AUDIT-STOREFRONT II E1: every surface the shop draws carries its kit role - its panels, presses, tabs, chips, wells, head and foot, and PASS-PANELS the folios\' covers, spreads, pages\' tabs and items - and its own sheet never paints one: no colour on a role\'s border, no shadow, no ground but a picture\'s and the meters\' troughs (mutants: a panel\'s ground painted again; the tabs the kit\'s presses too; Get Aurum a bare word under the Grimoire)', () => {
  const shop = Object.entries(FRAME_ROLES).flatMap(([role, sels]) => sels.filter((s) => s.startsWith('.px-shopwin ')).map((s) => [role, s.slice('.px-shopwin '.length)]));
  const roles = new Map(shop.map(([role, s]) => [s.replace(/^\./, ''), role]));
  for (const want of ['sh-panel', 'sh-carousel', 'sh-pass', 'sh-dailyhead', 'sh-aurumhead', 'sh-proceeds', 'act', 'sh-buy', 'sh-tab', 'sh-tag', 'sh-phase', 'sh-balance', 'sh-stagechip', 'sh-deed', 'sh-stage', 'sh-cmeter', 'sh-cfill', 'sh-head', 'sh-subhead', 'sh-foot',
    'sh-folio', 'sh-spread', 'sh-pchal', 'sh-fcover', 'sh-pitem', 'sh-pitempic', 'sh-pagetab', 'sh-spreadhead', 'sh-pspent', 'sh-daybar', 'sh-dayfill', 'sh-getaurum']) assert.ok(roles.has(want), `${want}: a kit role`);
  assert.equal(FRAME_ROLES.primary.includes('.px-shopwin .sh-getaurum'), true, 'Get Aurum the way on when short: a framed press under every dress');
  const ALLOWED = { 'sh-stage': ['background-color', 'background-image'], 'sh-tierstage-premium': ['background-image'], 'sh-tierstage-exclusive': ['background-image'], 'sh-cmeter': ['background-color'], 'sh-daybar': ['background-color'], 'sh-tab': ['background', 'border'],
    'sh-pitempic': ['background-color', 'background-image'], 'sh-fcover': ['background-color'], 'sh-pagetab': ['background', 'border'],   // an item's picture its own ground; a cover's and a tab's button ground let go
    'sh-dayfill': ['background'], 'sh-cfill': ['background'] };   // a meter's fill is its own colour - the kit bands it (meterFill)
  const PAINT = /(?:^|;)\s*(background(?:-color|-image)?|border(?:-(?:top|bottom|left|right))?(?:-color)?|box-shadow)\s*:\s*([^;]*)/g;
  for (const { sel, decl } of rules(SHOP_CSS)) {
    for (const one of sel.split(',').map((x) => x.trim())) {
      if (/::(before|after)/.test(one)) continue;   // a mark of its own, never the surface
      const last = one.split(/\s+/).pop(), cls = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
      const role = cls.find((c) => roles.has(c) || c.startsWith('sh-tierstage-'));
      if (!role) continue;
      for (const [, prop, value] of decl.matchAll(PAINT)) {
        const width = /^border(-(top|bottom|left|right))?$/.test(prop) && /^(0|none|[\d.]+px( [\d.]+px)*)$/.test(value.trim());
        assert.ok(width || (ALLOWED[cls.find((c) => ALLOWED[c])] ?? []).includes(prop), `${one} paints ${prop}: ${value} - the kit's to paint`);
      }
    }
  }
  const w = open();
  const tabs = all(w.root, 'sh-tab');
  assert.ok(tabs.length > 5 && tabs.every((t) => !String(t.className).split(' ').includes('act')), 'a tab, never the kit\'s press too');
  assert.ok(all(w.root, 'sh-cdot').every((d) => !String(d.className).split(' ').includes('act')), 'a dot, never a raised press');
  for (const c of ['sh-head', 'sh-proceeds', 'sh-tabs', 'sh-carousel', 'sh-foot', 'sh-close']) assert.equal(all(w.root, c).length, 1, c);
  w.stop();
});

test('AUDIT-STOREFRONT II E6: the head, the disclaimer and the tabs stand; a tab pressed brings its own panels into sight under them, the featured wares above (mutants: the window scrolled whole; a tab\'s panels left below the fold)', () => {
  const w = open();
  const body = all(w.root, 'px-body')[0], scroll = all(w.root, 'sh-scroll')[0], panels = all(w.root, 'sh-panels')[0];
  assert.deepEqual(body.children.map((c) => c.className), ['sh-head', 'sh-proceeds', 'sh-tabs', 'sh-scroll']);
  assert.ok(scroll.children.some((c) => String(c.className).startsWith('sh-carousel')) && scroll.children.includes(panels));
  assert.match(SHOP_CSS, /\.px-win\.px-shopwin \.px-body \{[^}]*overflow: hidden;/);
  assert.match(SHOP_CSS, /\.px-shopwin \.sh-scroll \{[^}]*overflow-y: auto;/);
  panels.offsetTop = 412;
  all(w.root, 'sh-tab').find((t) => t.id === 'sh-tab-mounts').click();
  assert.equal(scroll.scrollTop, 412);
  for (const q of ['@media (max-height: 760px)', '@media (max-height: 480px)', '@media (min-width: 1440px) and (min-height: 820px)']) assert.ok(SHOP_CSS.includes(q), q);
  w.stop();
});

test('AUDIT-STOREFRONT II E16: a live stage starts once it is in sight, never before; with no IntersectionObserver, at once (mutants: every stage started on opening)', async () => {
  const seen = [];
  class IO { constructor(cb) { this.cb = cb; seen.push(this); this.els = []; } observe(e) { this.els.push(e); } unobserve(e) { this.els = this.els.filter((x) => x !== e); } disconnect() { this.els = []; } }
  globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
  let started = 0;
  const effectPreview = async () => { started++; return { stop() {} }; };
  const w = open({ keep: { cat: 'kills' }, effectPreview }, fakeDoc({ IO }));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(started, 0, 'nothing in sight, nothing started');
  const io = seen[0], stages = io.els.filter((e) => String(e.className).includes('sh-stage-kill'));
  assert.ok(stages.length >= 3, 'each kill effect\'s stage waits');
  io.cb([{ target: stages[0], isIntersecting: true }]);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(started, 1, 'the one in sight');
  w.stop();
  const w2 = open({ keep: { cat: 'kills' }, effectPreview });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(started >= 4, 'no observer: at once');
  w2.stop();
});

test('AUDIT-STOREFRONT II E13, E14, E16: the first slide stands without sliding in, a turn slides; for less motion the pause press is hidden; the carousel never turns scrolled out of sight (mutants: the slide-in on opening; the pause shown for less motion; the clock turning out of sight)', () => {
  const w = open();
  const slide = () => all(w.root, 'sh-slide')[0];
  assert.ok(!String(slide().className).includes('sh-slidein'), 'opening: no slide');
  all(w.root, 'sh-cnext')[0].click();
  assert.ok(String(slide().className).includes('sh-slidein'), 'a turn: it slides');
  assert.equal(all(w.root, 'sh-cpause')[0].hidden, false);
  w.stop();
  const r = open({ reduced: true });
  assert.equal(all(r.root, 'sh-cpause')[0].hidden, true);
  r.stop();
  const held = { n: 3, paused: false, reduced: false, hovered: false, focusedIn: false, since: 0 };
  assert.equal(carouselTurns(held, 9000), true);
  assert.equal(carouselTurns({ ...held, hidden: true }, 9000), false);
});

test('AUDIT-STOREFRONT II E3, E5, E12: a title on a folio\'s item keeps its own paint under the Grimoire - the item a tile, wood, never the page; the challenge done and the payment line two classes; a held ware\'s price dimmed under its state (mutants: the title inked on the wood; the done challenge the payment line\'s class)', () => {
  // PIN MOVED (PASS-PANELS): the track and the Deluxe's own are gone - a title is sold on a folio's page, on its item's tile
  const NOW = Date.UTC(2026, 10, 14, 12);
  const at = passItemOf('s1', 'title:tremorborn');
  const pass = passCardOf({ season: 's1', open: true, stage: 0, tracks: { premium: false }, bought: [], today: 0, challenges: [{ key: 'tremor-tavern', n: 3, paid: true }] });
  const g = open({ flow: flowIn({ pass }), keep: { cat: 'pass', folio: at.track, page: at.panel }, now: () => NOW }, fakeDoc({ grimoire: true }));
  const item = all(g.root, 'sh-pitem').find((c) => c.attrs['data-grant'] === 'title:tremorborn');
  assert.ok(item && FRAME_ROLES.tile.includes('.px-shopwin .sh-pitem'), 'the item a tile - wood under the Grimoire');
  assert.equal(all(item, 'sh-rewardname')[0].style.color, titlePaint(titleBadge({ title: 'tremorborn' })).color, 'on the wood: its own paint');
  assert.equal(all(g.root, 'sh-cdone').length, 1);
  assert.equal(all(g.root, 'sh-paid').length, 0, 'never the old shared class');
  g.stop();
  const fl = flowIn();
  fl.shop.wares.find((r) => r.id === 'kill:pyre').held = true;
  const w = open({ flow: fl, keep: { cat: 'kills' } });
  const row = all(w.root, 'sh-panel').find((p) => p.attrs['data-ware'] === 'kill:pyre');
  assert.ok(String(all(row, 'sh-buyrow')[0].className).includes('sh-buyrow-held'));
  assert.match(SHOP_CSS, /\.px-shopwin \.sh-buyrow-held \.sh-price \{ font-size: 15px; opacity: 0\.8; \}/, 'PIN MOVED (AUDIT-STOREFRONT III C7): at 0.6 it read 3.9:1 on Stone');
  w.stop();
});

test('AUDIT-STOREFRONT II E7, E8: the profile - on a narrow card the stage stands first and the picker right under it; a locked effect says how it is had, every one of them, off the wares and the season\'s law (mutants: an effect with no words of how; the picker after the slots)', () => {
  for (const e of EFFECTS) {
    const id = `${e.slot}:${e.key}`, how = wardrobeEntry(e.slot, e.key)?.how?.() ?? '';
    const w = SHOP_WARES.find((x) => x.id === id), at = passItemOf('s1', id);
    assert.ok(how.length > 20, `${id}: how it is had`);
    if (w) assert.match(how, /the gem on the pause screen/, id);
    else {   // PIN MOVED (PASS-PANELS): a folio's - its page, its folio and its price in Aurum
      assert.ok(at, `${id}: a ware or a folio's`);
      assert.ok(how.startsWith(`On page ${['I', 'II', 'III'][at.panel]} of ${passFolioName('s1', at.track)}, for ${at.aurum.toLocaleString('en-US')} Aurum`), `${id}: ${how}`);
      assert.equal(passPanelsOf('s1', at.track)[at.panel].items.some((it) => it.grant === id), true);
    }
  }
  const css = readFileSync(new URL('../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');
  const narrow = css.slice(css.indexOf('@container (max-width: 480px) {\n  .card .acctslots'));
  assert.match(narrow, /\.card \.slots-stage \{ display: contents; \}/);
  assert.ok(narrow.indexOf('.card .slots-mid { order: -2;') > 0 && narrow.indexOf('.card .slots-picker { order: -1;') > 0, 'the stage, then the picker');
  // shown before the slots its markup puts first, the picker's words grown under a pointer must not move its row: the
  // window keeps no scroll anchor (one chosen in markup order sat under it, and the row ran from the pointer and back)
  assert.match(css, /\.px-win\.px-acctwin \.px-body \{[^}]*overflow-anchor: none;/);
});
