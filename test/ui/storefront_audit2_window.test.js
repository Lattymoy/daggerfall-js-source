// AUDIT-STOREFRONT II (lane E, 2026-10-29; bible/01-Overview/audits/Audit-Storefront.md): THE SHOP ON THE ENHANCED PLUS
// KIT. Every surface the shop draws carries its kit role (ui/enhanced/enhancedFrame.js FRAME_ROLES), so a theme and the
// Grimoire dress it, and its own sheet never paints one; the head, disclaimer and tabs stand over a scrolled part; a stage
// starts in sight; the carousel slides on a turn alone and never turns out of sight; a painted word on a page is inked.
// And the profile: its picker under the stage on a narrow card, and a locked effect told how it is had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { EFFECTS } from '../../src/net/effectLaw.js';
import { PASS_REWARDS, PASS_DELUXE, PASS_XP_PER_LEVEL } from '../../src/net/battlePassLaw.js';
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
const card = () => ({ on: true, wares: SHOP_WARES.filter((w) => w.alone && w.cash).map((w) => ({ id: w.id, sale: true, held: false, buy: `https://accounts.invalid/v1/shop/buy?t=${w.key}` })), featured: ['pass:s1deluxe', 'kill:pyre', 'mount:warhorse'] });
const flowIn = (extra = {}) => ({ stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, wardrobe: { titles: [], glyphs: [], auras: [] }, shop: card(), busy: false, ...extra });
const open = (o = {}, doc = fakeDoc()) => shopWindow(doc, { flow: () => o.flow ?? flowIn(), onClose() {}, keep: o.keep ?? {}, focus: false, reduced: !!o.reduced, preview: o.preview ?? (async () => null), effectPreview: o.effectPreview ?? (async () => null) });

/** The sheet's rules, each its selectors and its declarations (an @media's flattened in). */
const rules = (css) => [...css.replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().split('\n').pop(), decl: m[2] }));

test('AUDIT-STOREFRONT II E1: every surface the shop draws carries its kit role - its panels, presses, tabs, chips, wells, head and foot - and its own sheet never paints one: no colour on a role\'s border, no shadow, no ground but the stage\'s picture, the meter\'s trough, the track\'s labels and its reached wash (mutants: a panel\'s ground painted again; the tabs the kit\'s presses too)', () => {
  const shop = Object.entries(FRAME_ROLES).flatMap(([role, sels]) => sels.filter((s) => s.startsWith('.px-shopwin ')).map((s) => [role, s.slice('.px-shopwin '.length)]));
  const roles = new Map(shop.map(([role, s]) => [s.replace(/^\./, ''), role]));
  for (const want of ['sh-panel', 'sh-carousel', 'sh-pass', 'sh-dailyhead', 'sh-aurumhead', 'sh-proceeds', 'act', 'sh-buy', 'sh-tab', 'sh-tag', 'sh-phase', 'sh-balance', 'sh-stagechip', 'sh-deed', 'sh-tracklabel', 'sh-stage', 'sh-xpbar', 'sh-cmeter', 'sh-trackcell', 'sh-xpfill', 'sh-cfill', 'sh-head', 'sh-subhead', 'sh-foot']) assert.ok(roles.has(want), `${want}: a kit role`);
  const ALLOWED = { 'sh-stage': ['background-color', 'background-image'], 'sh-tierstage-premium': ['background-image'], 'sh-tierstage-exclusive': ['background-image'], 'sh-xpbar': ['background-color'], 'sh-cmeter': ['background-color'], 'sh-tracklabel': ['background-image'], 'sh-trackcell': ['background-image'], 'sh-tab': ['background', 'border'],
    'sh-xpfill': ['background'], 'sh-cfill': ['background'] };   // a meter's fill is its own colour - the kit bands it (meterFill)
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

test('AUDIT-STOREFRONT II E3, E5, E9, E12: a title\'s paint on a page is inked under the Grimoire, on a well\'s wood it stays; the challenge done and the payment line two classes; a held ware\'s price dimmed under its state (mutants: the deluxe\'s title never inked; a track title inked on the wood)', () => {
  const pass = { season: 's1', open: true, stage: 0, xp: 700, level: 7, top: 17, tracks: { free: true, premium: false, deluxe: false }, mult: 1, today: 0, dayMax: 2000, challenges: [{ key: 'tremor-tavern', n: 3, paid: true }] };
  const title = PASS_DELUXE.s1.grants.find((g) => g.startsWith('title:')).slice(6);
  const plain = titlePaint(titleBadge({ title })).color;
  const g = open({ flow: flowIn({ pass }) }, fakeDoc({ grimoire: true }));
  const deluxe = all(all(g.root, 'sh-deluxe')[0], 'sh-reward-title')[0];
  assert.notEqual(all(deluxe, 'sh-rewardname')[0].style.color, plain, 'on the page: inked');
  const trackTitle = PASS_REWARDS.s1.find((r) => r.grant.startsWith('title:'));
  const inWell = all(all(g.root, 'sh-track')[0], `fx-title-${trackTitle.grant.slice(6)}`)[0];
  assert.equal(all(inWell, 'sh-rewardname')[0].style.color, titlePaint(titleBadge({ title: trackTitle.grant.slice(6) })).color, 'on the well\'s wood: its own paint');
  assert.equal(all(g.root, 'sh-cdone').length, 1);
  assert.equal(all(g.root, 'sh-paid').length, 0, 'never the old shared class');
  g.stop();
  const fl = flowIn();
  fl.shop.wares.find((r) => r.id === 'kill:pyre').held = true;
  const w = open({ flow: fl, keep: { cat: 'kills' } });
  const row = all(w.root, 'sh-panel').find((p) => p.attrs['data-ware'] === 'kill:pyre');
  assert.ok(String(all(row, 'sh-buyrow')[0].className).includes('sh-buyrow-held'));
  assert.match(SHOP_CSS, /:is\(\.sh-buyrow-held, \.sh-buyrow-spent\) \.sh-price \{ font-size: 15px; opacity: 0\.6; \}/);
  w.stop();
});

test('AUDIT-STOREFRONT II E7, E8: the profile - on a narrow card the stage stands first and the picker right under it; a locked effect says how it is had, every one of them, off the wares and the season\'s law (mutants: an effect with no words of how; the picker after the slots)', () => {
  for (const e of EFFECTS) {
    const id = `${e.slot}:${e.key}`, how = wardrobeEntry(e.slot, e.key)?.how?.() ?? '';
    const w = SHOP_WARES.find((x) => x.id === id), r = PASS_REWARDS.s1.find((x) => x.grant === id);
    assert.ok(how.length > 20, `${id}: how it is had`);
    if (w) assert.match(how, /the gem on the pause screen/, id);
    else if (r) assert.match(how, new RegExp(`Reach level ${r.level} of the Battle Pass`), id);
    else assert.match(how, /Deluxe Pass/, id);
  }
  const css = readFileSync(new URL('../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');
  const narrow = css.slice(css.indexOf('@container (max-width: 480px) {\n  .card .acctslots'));
  assert.match(narrow, /\.card \.slots-stage \{ display: contents; \}/);
  assert.ok(narrow.indexOf('.card .slots-mid { order: -2;') > 0 && narrow.indexOf('.card .slots-picker { order: -1;') > 0, 'the stage, then the picker');
});

test('AUDIT-STOREFRONT II B3: experience past a stage\'s top is said kept for the next stage - never at the last stage\'s, which has no next (mutants: "kept for the next" at level 50)', () => {
  const line = (level, top, xp) => {
    const pass = { season: 's1', open: true, stage: 2, xp, level, top, tracks: { free: true, premium: false, deluxe: false }, mult: 1, today: 0, dayMax: 2000, challenges: [] };
    const w = open({ flow: flowIn({ pass }) });
    const said = all(all(w.root, 'sh-passprog')[0], 'sh-passline')[0].textContent;
    w.stop();
    return said;
  };
  assert.match(line(17, 17, 18 * PASS_XP_PER_LEVEL + 500), /kept for the next/);
  assert.doesNotMatch(line(50, 50, 51 * PASS_XP_PER_LEVEL + 500), /kept for the next/);
});
