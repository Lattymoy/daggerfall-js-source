// PASS-PANELS (2026-10-30, the owner: "It shouldnt be called battle pass. Something more lore accurate. Also needs to be a
// panel that you open. To reveal the track rewards. Like hell divers"): THE SHOP'S FOLIOS. A cover a folio, with its
// state; pressed, it opens on its first page with an item still to buy, one page at a time, turned by its arrows, its
// tabs, the arrow keys; Back closes it. A locked page shows its items greyed and says what opens it. Every spend is pressed
// twice, short of Aurum the way to it is offered, and the cover's turn and the page's flip are still for less motion.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { aurumCardOf } from '../../src/net/aurumLaw.js';
import { passCardOf, passPanelsOf, PASS_PREMIUM_AURUM } from '../../src/net/battlePassLaw.js';
import { shopWindow, SHOP_CSS } from '../../src/ui/enhanced/enhancedShop.js';
import { passItemsIn, passLandingPage, passItemState, passUnlockState } from '../../src/ui/enhanced/enhancedPass.js';
import { passGrantName, passFolioName } from '../../src/ui/passText.js';
import { wardrobeEntry, wardrobeAvail, availLine } from '../../src/ui/collections/wardrobeCatalogue.js';

function fakeDoc() {
  const doc = { activeElement: null, head: null, defaultView: null, byId: new Map() };
  const node = (tag) => {
    const n = {
      tag, children: [], className: '', attrs: {}, style: { setProperty() {} }, listeners: {}, title: '', type: '', id: '', href: '', target: '', rel: '', tabIndex: 0, isConnected: true, parent: null, hidden: false, disabled: false, offsetTop: 0, scrollTop: 0,
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
const has = (n, cls) => String(n.className).split(' ').includes(cls);

const NOW = Date.UTC(2026, 10, 14, 12), DAY = Math.floor(NOW / 86_400_000);
const FREE_I = passPanelsOf('s1', 'free')[0].items.map((it) => it.grant);   // the Brass Folio's first page: 500 Aurum, all of it
const shopCard = () => ({ on: true, wares: SHOP_WARES.filter((w) => w.alone && w.cash).map((w) => ({ id: w.id, sale: true, held: false, buy: 'https://accounts.invalid/x' })), featured: [] });
const flowIn = (o = {}) => ({
  stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, busy: false, shop: shopCard(),
  wardrobe: { titles: [], glyphs: ['cog'], glyphsOff: [], auras: [], icons: [], effectsHeld: { kill: [], portal: [], mount: [] } },
  aurum: aurumCardOf({ open: true, balance: o.balance ?? 2400, daily: { until: (DAY + 1) * 86_400_000, wares: [] }, week: { until: NOW + 86_400_000, deeds: {} } }),
  pass: passCardOf({ season: 's1', open: true, stage: 0, tracks: { premium: !!o.premium }, bought: o.bought ?? [], today: o.today ?? 0, challenges: o.challenges ?? [] }),
});
const open = (flow, { keep = {}, doc = fakeDoc(), reduced = true, now = () => NOW } = {}) =>
  shopWindow(doc, { flow: () => flow, onClose() {}, keep: Object.assign(keep, { cat: keep.cat ?? 'pass' }), focus: false, now, reduced, preview: async () => null, effectPreview: async () => null });
const face = (w, track) => all(w.root, 'sh-fcover').find((f) => f.attrs['data-folio'] === track);
const text = (n, cls) => all(n, cls)[0]?.textContent;
const itemCard = (w, grant) => all(w.root, 'sh-pitem').find((c) => c.attrs['data-grant'] === grant);
const selected = (w) => all(w.root, 'sh-pagetab').findIndex((t) => t.attrs['aria-selected'] === 'true');
const tabOn = (w, id) => all(w.root, 'sh-tab').find((t) => t.id === `sh-tab-${id}`)?.attrs['aria-selected'] === 'true';

test('FOLIOS the covers: the tab named Folios with every item counted; a cover a folio, its name, what it holds and owns, its state in its label - the Brass Folio Free, the Gilded Folio Locked with its unlock and Get Aurum short of it, or Unlocked (mutants: the Gilded Folio drawn open while locked; Get Aurum never offered)', () => {
  const w = open(flowIn({ balance: 450, bought: FREE_I }));
  assert.equal(all(w.root, 'sh-tab')[0].textContent, `Folios${passItemsIn('s1').length}`);
  assert.deepEqual(all(w.root, 'sh-fcover').map((f) => f.attrs['data-folio']), ['free', 'premium']);
  const nFree = passItemsIn('s1').filter((it) => it.track === 'free').length, nGilded = passItemsIn('s1').length - nFree;
  const free = face(w, 'free'), gilded = face(w, 'premium');
  assert.equal(free.tag, 'button');
  assert.deepEqual([text(free, 'sh-fname'), text(free, 'sh-fholds'), text(free, 'sh-fprog'), text(free, 'sh-fstate')], ['The Brass Folio', `${nFree} items`, `${FREE_I.length} of ${nFree} owned`, 'Free']);
  assert.equal(free.attrs['aria-label'], `The Brass Folio: Free, ${FREE_I.length} of ${nFree} owned. Open it.`);
  assert.deepEqual([text(gilded, 'sh-fname'), text(gilded, 'sh-fprog'), text(gilded, 'sh-fstate')], ['The Gilded Folio', `0 of ${nGilded} owned`, 'Locked']);
  assert.ok(has(gilded, 'sh-fcover-locked') && !has(free, 'sh-fcover-locked'), 'the Gilded Folio shut, its padlock shown');
  const unlock = all(w.root, 'sh-punlock')[0];
  assert.equal(unlock.hidden, false);
  assert.equal(text(unlock, 'sh-pricen'), '1,000');
  assert.equal(text(unlock, 'sh-state'), `You need ${(PASS_PREMIUM_AURUM.s1 - 450).toLocaleString('en-US')} more Aurum`);
  assert.equal(all(unlock, 'sh-punlockb').length, 0, 'short: no unlock press');
  all(unlock, 'sh-getaurum')[0].click();
  assert.ok(tabOn(w, 'aurum'), 'Get Aurum opens the packs');
  w.stop();
  const u = open(flowIn({ premium: true }));
  assert.equal(text(face(u, 'premium'), 'sh-fstate'), 'Unlocked');
  assert.ok(!has(face(u, 'premium'), 'sh-fcover-locked'));
  assert.equal(all(u.root, 'sh-punlock')[0].hidden, true, 'unlocked: no unlock');
  u.stop();
});

test('FOLIOS a cover opens its folio on its first page with an item still to buy, the focus on that page\'s tab; Back closes it and gives the focus back to its cover; a face rebuilt reopens where it was (mutants: Back to nowhere; the landing page the first always; the focus left behind)', () => {
  assert.equal(passLandingPage('s1', 'free', []), 0);
  assert.equal(passLandingPage('s1', 'free', FREE_I), 1, 'page I owned whole: page II');
  assert.equal(passLandingPage('s1', 'free', passItemsIn('s1').map((it) => it.grant)), 0, 'all owned: page I');
  const doc = fakeDoc(), keep = {}, fl = flowIn({ bought: FREE_I });
  const w = open(fl, { doc, keep });
  face(w, 'free').click();
  assert.equal(all(w.root, 'sh-fcover').length, 0, 'the covers give way to the spread');
  const spread = all(w.root, 'sh-spread')[0];
  assert.ok(spread && has(spread, 'sh-spread-free'));
  assert.equal(text(spread, 'sh-fname'), 'The Brass Folio');
  assert.deepEqual([keep.folio, keep.page, selected(w)], ['free', 1, 1]);
  assert.equal(doc.activeElement, all(w.root, 'sh-pagetab')[1], 'the focus into the spread');
  const again = open(fl, { keep });
  assert.equal(all(again.root, 'sh-spread').length, 1, 'rebuilt: still open');
  assert.equal(selected(again), 1);
  again.stop();
  const back = all(w.root, 'sh-fback')[0];
  assert.equal(back.attrs['aria-label'], 'Back to the folios');
  back.click();
  assert.equal(all(w.root, 'sh-spread').length, 0);
  assert.equal(keep.folio, null);
  assert.equal(doc.activeElement, face(w, 'free'), 'the focus back on its cover');
  w.stop();
});

test('FOLIOS the pages: one at a time, turned by the arrows (labelled, still at the ends), by a page\'s tab, by the arrow keys and Home and End (the focus on the page\'s tab); each tab says its state - owned whole, or locked (mutants: the next arrow turning back; the keys unheard)', () => {
  const doc = fakeDoc(), fl = flowIn({ bought: FREE_I });
  const w = open(fl, { doc, keep: { folio: 'free', page: 0 } });
  const prev = all(w.root, 'sh-pageprev')[0], next = all(w.root, 'sh-pagenext')[0], spread = all(w.root, 'sh-spread')[0];
  assert.deepEqual([prev.attrs['aria-label'], next.attrs['aria-label']], ['Previous page', 'Next page']);
  assert.deepEqual([prev.attrs['aria-disabled'], next.attrs['aria-disabled']], ['true', 'false'], 'PIN MOVED (AUDIT-STOREFRONT III C2): aria-disabled, so a focused arrow keeps the focus');
  assert.equal(all(w.root, 'sh-page').length, 1, 'one page shown');
  assert.equal(all(w.root, 'sh-page')[0].attrs['aria-labelledby'], 'sh-page-free-0');
  const tabs = all(w.root, 'sh-pagetab');
  assert.deepEqual(tabs.map((t) => t.attrs.role), ['tab', 'tab', 'tab']);
  assert.ok(has(tabs[0], 'sh-pagetab-done') && has(tabs[2], 'sh-pagetab-locked') && !has(tabs[1], 'sh-pagetab-locked'));
  assert.equal(tabs[0].attrs['aria-label'], `Page I: ${FREE_I.length} of ${FREE_I.length} owned`);
  assert.equal(tabs[2].attrs['aria-label'], 'Page III: Locked');
  next.click();
  assert.equal(selected(w), 1);
  assert.deepEqual(all(w.root, 'sh-pitem').map((c) => c.attrs['data-grant']), passPanelsOf('s1', 'free')[1].items.map((it) => it.grant));
  tabs[2].click();
  assert.equal(selected(w), 2);
  assert.equal(all(w.root, 'sh-pagenext')[0].attrs['aria-disabled'], 'true', 'the last page: no next (PIN MOVED, AUDIT-STOREFRONT III C2)');
  const key = (k) => { let stopped = false; for (const f of spread.listeners.keydown ?? []) f({ key: k, preventDefault() {}, stopPropagation() { stopped = true; } }); return stopped; };
  assert.equal(key('ArrowLeft'), true);
  assert.equal(selected(w), 1);
  assert.equal(doc.activeElement, all(w.root, 'sh-pagetab')[1], 'turned by a key: the focus on its tab');
  key('Home'); assert.equal(selected(w), 0);
  key('End'); assert.equal(selected(w), 2);
  assert.equal(key('ArrowRight'), false, 'past the last: the key is the page\'s');
  w.stop();
});

test('FOLIOS a locked page previews its items greyed and padlocked, offering no Buy, and says what opens it - the Aurum still to spend in its folio, or the Gilded Folio unlocked (mutants: a shut page sold; its words lost; a locked Gilded Folio\'s first page open)', () => {
  const w = open(flowIn({ bought: FREE_I }), { keep: { folio: 'free', page: 2 } });
  const state = all(w.root, 'sh-ppanelstate')[0];
  const spent = FREE_I.reduce((a, g) => a + passItemsIn('s1').find((it) => it.grant === g).aurum, 0);
  assert.equal(state.textContent, `Spend ${(passPanelsOf('s1', 'free')[2].open - spent).toLocaleString('en-US')} more Aurum in this folio to open this page.`);
  assert.ok(has(state, 'sh-ppanelstate-locked'));
  for (const c of all(w.root, 'sh-pitem')) {
    assert.ok(has(c, 'sh-pitemlocked'), `${c.attrs['data-grant']}: greyed and padlocked`);
    assert.equal(text(c, 'sh-state'), 'Locked');
    assert.equal(all(c, 'sh-pbuy').length, 0);
  }
  w.stop();
  const g = open(flowIn({ balance: 2400 }), { keep: { folio: 'premium', page: 0 } });
  assert.equal(all(g.root, 'sh-ppanelstate')[0].textContent, 'Unlock this folio to open this page.', 'PIN MOVED (AUDIT-STOREFRONT III C17): no "The" mid-sentence');
  assert.ok(all(g.root, 'sh-pitem').every((c) => has(c, 'sh-pitemlocked') && !all(c, 'sh-pbuy').length));
  assert.equal(all(g.root, 'sh-punlock')[0].hidden, false, 'its unlock in the spread\'s head');
  all(g.root, 'sh-pagenext')[0].click();
  assert.equal(all(g.root, 'sh-ppanelstate')[0].textContent, 'Unlock this folio to open this page.', 'PIN MOVED (AUDIT-STOREFRONT III C17): the folio\'s lock first - nothing is spent in it yet');
  g.stop();
  const u = open(flowIn({ premium: true }), { keep: { folio: 'premium', page: 0 } });
  assert.equal(all(u.root, 'sh-ppanelstate')[0].textContent, `0 of ${passPanelsOf('s1', 'premium')[0].items.length} owned`);
  assert.ok(all(u.root, 'sh-pitem').every((c) => !has(c, 'sh-pitemlocked') && all(c, 'sh-pbuy').length === 1));
  u.stop();
});

test('FOLIOS an item bought with two presses - Buy arms it, the second buys through the flow, left alone it goes back; a refusal is said on its card; an owned item says Owned and wears; short of Aurum it says how much more and offers Get Aurum (mutants: one press spends; no Get Aurum when short)', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const calls = [], fl = flowIn({ bought: FREE_I });
  fl.passBuy = (s, g) => { calls.push([s, g]); return Promise.resolve({ ok: false, error: 'pass-panel' }); };
  fl.toggleGlyph = (k) => calls.push(['glyph', k]);
  let nowMs = NOW;
  const w = open(fl, { keep: { folio: 'free', page: 1 }, now: () => nowMs });
  const grant = passPanelsOf('s1', 'free')[1].items[0].grant, nm = passGrantName(grant), price = passPanelsOf('s1', 'free')[1].items[0].aurum;
  const buy = () => all(itemCard(w, grant), 'sh-pbuy')[0];
  assert.deepEqual([buy().textContent, buy().attrs['aria-label']], ['Buy', `Buy ${nm} for ${price} Aurum`]);
  buy().click();
  assert.deepEqual(calls, [], 'one press: armed, nothing spent');
  assert.deepEqual([buy().textContent, buy().attrs['data-armed'], buy().attrs['aria-label']], ['Confirm', 'true', `Confirm: buy ${nm} for ${price} Aurum`]);
  nowMs += 6500;
  t.mock.timers.tick(500);
  assert.equal(buy().attrs['data-armed'], undefined, 'left alone: Buy again');
  buy().click(); buy().click();
  assert.deepEqual(calls, [['s1', grant]], 'two presses: bought');
  await new Promise((r) => setImmediate(r));
  assert.equal(text(itemCard(w, grant), 'sh-state'), 'That page is still locked. Buy more in this folio to open it.', 'PIN MOVED (AUDIT-STOREFRONT III C10): the account flow\'s own sentence');
  assert.ok(has(all(itemCard(w, grant), 'sh-state')[0], 'sh-state-bad'));
  all(w.root, 'sh-pageprev')[0].click();
  const owned = itemCard(w, 'glyph:cog');
  assert.equal(text(owned, 'sh-state'), 'Owned');
  assert.ok(has(owned, 'sh-pitem-held'));
  all(owned, 'sh-wear')[0].click();
  assert.deepEqual(calls.at(-1), ['glyph', 'cog'], 'worn by the flow\'s own press');
  w.stop();
  const s = open(flowIn({ balance: 450, bought: FREE_I }), { keep: { folio: 'free', page: 1 } });
  const dear = passPanelsOf('s1', 'free')[1].items.find((it) => it.aurum > 450);
  const card = itemCard(s, dear.grant);
  assert.equal(text(card, 'sh-state'), `You need ${dear.aurum - 450} more Aurum`);
  assert.equal(all(card, 'sh-pbuy').length, 0);
  all(card, 'sh-getaurum')[0].click();
  assert.ok(tabOn(s, 'aurum'), 'Get Aurum opens the packs');
  s.stop();
  assert.equal(passItemState(flowIn({ balance: 450, bought: FREE_I }), 's1', dear.grant, NOW).need, dear.aurum - 450);
});

test('FOLIOS the Gilded Folio unlocked with two presses through the flow, on its cover as in its spread (mutants: one press unlocks)', () => {
  const calls = [], fl = flowIn({ balance: 2400 });
  fl.passUnlock = (s) => { calls.push(s); return Promise.resolve({ ok: true }); };
  const w = open(fl);
  const press = () => all(w.root, 'sh-punlockb')[0];
  assert.deepEqual([press().textContent, press().attrs['aria-label']], ['Unlock for 1,000 Aurum', 'Unlock The Gilded Folio for 1,000 Aurum']);
  press().click();
  assert.deepEqual(calls, []);
  assert.equal(press().textContent, 'Confirm: 1,000 Aurum');
  press().click();
  assert.deepEqual(calls, ['s1']);
  w.stop();
  assert.deepEqual(passUnlockState(flowIn({ balance: 2400, premium: true }), 's1', NOW).state, 'held');
  assert.equal(passFolioName('s1', 'premium'), 'The Gilded Folio');
});

test('FOLIOS less motion: a cover turns open and a page flips as it turns - neither for less motion, in the window or in its sheet (mutants: the turn for less motion)', () => {
  const w = open(flowIn(), { reduced: false });
  face(w, 'free').click();
  assert.ok(has(all(w.root, 'sh-spread')[0], 'sh-turnin'));
  all(w.root, 'sh-pagenext')[0].click();
  assert.ok(has(all(w.root, 'sh-page')[0], 'sh-flipnext'));
  all(w.root, 'sh-pageprev')[0].click();
  assert.ok(has(all(w.root, 'sh-page')[0], 'sh-flipprev'));
  w.stop();
  const r = open(flowIn(), { reduced: true });
  face(r, 'free').click();
  assert.ok(!has(all(r.root, 'sh-spread')[0], 'sh-turnin'));
  all(r.root, 'sh-pagenext')[0].click();
  assert.ok(!has(all(r.root, 'sh-page')[0], 'sh-flipnext'));
  r.stop();
  assert.match(SHOP_CSS, /@media \(prefers-reduced-motion: reduce\) \{\n {2}\.px-shopwin :is\(\.sh-turnin, \.sh-flipnext, \.sh-flipprev\) \{ animation: none; \}/);
});

test('FOLIOS in Collections: a folio\'s item is had from its page, in its folio, for its price in Aurum - not yet before the season, then for good: the folios never close (mutants: an item retired when its season ends)', () => {
  const e = { kind: 'title', key: 'tremorborn', ...wardrobeEntry('title', 'tremorborn') }, at = passItemsIn('s1').find((it) => it.grant === 'title:tremorborn');
  assert.equal(e.how(), `On page ${['I', 'II', 'III'][at.panel]} of The Brass Folio, for ${at.aurum} Aurum. Open the Folios in the shop, the gem on the pause screen.`);
  assert.match(wardrobeEntry('glyph', 'gearcrown').how(), /^On page II of The Gilded Folio, for \d+ Aurum, once that folio is unlocked\./);
  assert.equal(wardrobeAvail(e, Date.UTC(2026, 9, 31)), 'dormant', 'before the folios open: not yet');
  assert.equal(wardrobeAvail(e, Date.UTC(2026, 10, 1)), 'pass', 'open before the season\'s world');
  assert.equal(wardrobeAvail(e, NOW), 'pass');
  assert.equal(wardrobeAvail(e, Date.UTC(2027, 5, 1)), 'pass', 'long after the season: still sold');
  assert.equal(availLine(e, NOW), 'Bought with Aurum from the Folios. They never close, and those who buy it keep it.');
});

test('FOLIOS the page arrows are drawn chevrons, never a font\'s glyph - a pixel font (the Grimoire\'s) draws ‹ and › too small to see (mutants: the arrows back to a glyph)', () => {
  assert.doesNotMatch(SHOP_CSS, /sh-page(?:prev|next)::before \{ content: '\\/, 'no arrow glyph (the carousel\'s steps keep theirs)');
  assert.ok(SHOP_CSS.includes(".px-shopwin .sh-pageprev::before, .px-shopwin .sh-pagenext::before { content: ''; display: inline-block; width: 10px; height: 10px; border-left: 3px solid currentColor; border-bottom: 3px solid currentColor; }"), 'a drawn corner');
  assert.ok(SHOP_CSS.includes('.px-shopwin .sh-pageprev::before { transform: translateX(2px) rotate(45deg); }'), 'turned back');
  assert.ok(SHOP_CSS.includes('.px-shopwin .sh-pagenext::before { transform: translateX(-2px) rotate(-135deg); }'), 'turned on');
});
