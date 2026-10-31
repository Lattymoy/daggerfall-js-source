// AUDIT-STOREFRONT III (lane C, 2026-10-30; bible/01-Overview/audits/Audit-Storefront.md): THE WINDOW. The shop's
// Folios read cold: the focus kept where a press goes, a reason on every dead item, the Grimoire's numerals and inks,
// one voice for a refusal, the answer where the player looks, the spend in flight said, the Aurum really spent, the pause
// face kept out of sight under it, a phone's room and its fingers, and the shop's clock the shared one.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { aurumCardOf, aurumPriceOf, AURUM_DAILY } from '../../src/net/aurumLaw.js';
import { passCardOf, passPanelsOf, passSeasonById, PASS_ALL_GRANTS, passItemOf } from '../../src/net/battlePassLaw.js';
import { shopWindow, shopNow, SHOP_CSS } from '../../src/ui/enhanced/enhancedShop.js';
import { passCannot, PASS_CSS } from '../../src/ui/enhanced/enhancedPass.js';
import { passPanelNumeral, passGrantName } from '../../src/ui/passText.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { inkPaintedWord, inkColour, kitCss, INK_RED, parseColour } from '../../src/ui/grimoireDress.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';

function fakeDoc({ grimoire = false } = {}) {
  const doc = { activeElement: null, head: null, defaultView: null, byId: new Map(), documentElement: { dataset: grimoire ? { plusDress: 'grimoire' } : {} } };
  const node = (tag) => {
    const n = {
      tag, children: [], className: '', attrs: {}, style: { setProperty() {} }, listeners: {}, title: '', type: '', id: '', href: '', target: '', rel: '', tabIndex: 0, isConnected: true, parent: null, hidden: false, disabled: false, offsetTop: 0, scrollTop: 0,
      append(...cs) { for (const c of cs) { if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c); c.parent = n; n.children.push(c); if (c.id) doc.byId.set(c.id, c); } },
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
const text = (n, cls) => all(n, cls)[0]?.textContent;
const settle = () => new Promise((r) => setImmediate(r));

const S1 = passSeasonById('s1');
const NOW = Date.UTC(2026, 10, 14, 12), DAY = Math.floor(NOW / 86_400_000);
const FREE_I = passPanelsOf('s1', 'free')[0].items.map((it) => it.grant);
/** PIN MOVED (AURUM-ONLY): the card as the service answers it - a pack its money link, every other ware sold alone its
 *  Aurum price, a quarter off among `deals` (the day's) and marked so. */
const shopCard = (deals = []) => ({ on: true, wares: SHOP_WARES.filter((w) => w.alone).map((w) => ({ id: w.id, sale: true, held: false,
  ...(w.cash ? { buy: 'https://accounts.invalid/x', cents: w.cents } : { price: deals.includes(w.id) ? aurumPriceOf(w.id) : w.price, deal: deals.includes(w.id) }) })), featured: [] });
const passOf = (o = {}) => passCardOf({ season: 's1', open: o.open ?? true, stage: 0, tracks: { premium: !!o.premium }, bought: o.bought ?? [], today: 0, challenges: [], ...(o.spent ? { spent: o.spent } : {}) });
const flowIn = (o = {}) => ({
  stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, busy: false, shop: shopCard((o.daily ?? []).map((/** @type {any} */ d) => d.id)), error: '', note: '',
  wardrobe: { titles: [], glyphs: ['cog'], glyphsOff: [], auras: [], icons: [], effectsHeld: { kill: [], portal: [], mount: [] } },
  aurum: aurumCardOf({ open: true, balance: o.balance ?? 2400, daily: { until: (DAY + 1) * 86_400_000, wares: o.daily ?? [] }, week: { until: NOW + 86_400_000, deeds: {} } }),
  pass: passOf(o),
});
const open = (flow, { keep = {}, doc = fakeDoc(), now = () => NOW } = {}) =>
  shopWindow(doc, { flow: () => flow, onClose() {}, keep: Object.assign(keep, { cat: keep.cat ?? 'pass' }), focus: false, now, reduced: true, preview: async () => null, effectPreview: async () => null });
const face = (w, track) => all(w.root, 'sh-fcover').find((f) => f.attrs['data-folio'] === track);
const itemCard = (w, grant) => all(w.root, 'sh-pitem').find((c) => c.attrs['data-grant'] === grant);
const lum = (rgb) => rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hslRgb = (css) => {
  const [h, s, l] = css.match(/[\d.]+/g).map(Number), S = s / 100, L = l / 100, c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : [0, c, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
};

test('AUDIT-STOREFRONT III C1: the Gilded Folio unlocked from its cover leaves the focus on that cover, and from its spread on the page\'s tab - never on the page\'s body with the row gone (mutants: the focus left on the press taken away)', async () => {
  for (const where of ['cover', 'spread']) {
    const doc = fakeDoc(), fl = flowIn({ balance: 2400 });
    fl.passUnlock = async () => { fl.pass = passOf({ premium: true }); return { ok: true }; };
    const w = open(fl, { doc, keep: where === 'spread' ? { folio: 'premium', page: 0 } : {} });
    const press = () => all(w.root, 'sh-punlockb')[0];
    press().click();
    press().focus();
    press().click();
    assert.equal(doc.activeElement, press(), `${where}: the press in flight keeps the focus`);
    await settle();
    assert.equal(all(w.root, 'sh-punlock')[0].hidden, true, `${where}: unlocked, its row gone`);
    assert.equal(doc.activeElement, where === 'cover' ? face(w, 'premium') : all(w.root, 'sh-pagetab').find((t) => t.attrs['aria-selected'] === 'true'), `${where}: the focus on what stays`);
    w.stop();
  }
});

test('AUDIT-STOREFRONT III C2: an end\'s arrow is aria-disabled, never disabled - Enter on Next to the last page leaves the focus on Next, and a press on it there turns nothing (mutants: the arrows disabled again)', () => {
  const doc = fakeDoc(), w = open(flowIn({ bought: FREE_I }), { doc, keep: { folio: 'free', page: 1 } });
  const next = all(w.root, 'sh-pagenext')[0], prev = all(w.root, 'sh-pageprev')[0];
  next.focus();
  next.click();
  assert.equal(all(w.root, 'sh-pagetab').findIndex((t) => t.attrs['aria-selected'] === 'true'), 2);
  assert.deepEqual([next.attrs['aria-disabled'], next.disabled, prev.attrs['aria-disabled']], ['true', false, 'false']);
  assert.equal(doc.activeElement, next, 'the focus stays on the arrow');
  next.click();
  assert.equal(all(w.root, 'sh-pagetab').findIndex((t) => t.attrs['aria-selected'] === 'true'), 2, 'past the end: nothing turns');
  assert.ok(PASS_CSS.includes('.px-shopwin :is(.sh-pageprev, .sh-pagenext)[aria-disabled="true"] { opacity: 0.55; cursor: default; }'), 'drawn as it reads');
  w.stop();
});

test('AUDIT-STOREFRONT III C3: the day\'s finds never run out of their panel - its words and its meter share a row while they fit, the meter on a row of its own when not (mutants: the words\' column back to max-content)', () => {
  assert.ok(PASS_CSS.includes('.px-shopwin .sh-passday { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }'));
  assert.ok(PASS_CSS.includes('.px-shopwin .sh-daytext { flex: 0 1 auto; min-width: 0;'), 'its words shrink and wrap');
  assert.ok(PASS_CSS.includes('.px-shopwin .sh-passday .sh-daybar { flex: 1 1 90px; }'));
  assert.doesNotMatch(PASS_CSS, /max-content minmax\(90px/);
});

test('AUDIT-STOREFRONT III C4: under the Grimoire the pages and the stages are numbered 1, 2, 3 - its face draws a capital I as a 1, so II read 11; without it I, II, III (mutants: Roman numerals under the dress)', () => {
  assert.deepEqual([0, 1, 2].map((p) => passPanelNumeral(p, true)), ['1', '2', '3']);
  assert.deepEqual([0, 1, 2].map((p) => passPanelNumeral(p)), ['I', 'II', 'III']);
  for (const grimoire of [true, false]) {
    const w = open(flowIn({ bought: FREE_I }), { doc: fakeDoc({ grimoire }), keep: { folio: 'free', page: 1 } });
    const want = grimoire ? ['1', '2', '3'] : ['I', 'II', 'III'];
    assert.deepEqual(all(w.root, 'sh-pagetabword').map((t) => t.textContent), want.map((n) => `Page ${n}`));
    assert.deepEqual(all(w.root, 'sh-pagetabnum').map((t) => t.textContent), want, 'the numeral alone, for a narrow screen');
    assert.equal(text(w.root, 'sh-ppanelnum'), `Page ${want[1]}`);
    assert.deepEqual(all(w.root, 'sh-stagenum').map((t) => t.textContent), want);
    assert.equal(all(w.root, 'sh-pagetab')[1].attrs['aria-label'].startsWith(`Page ${want[1]}:`), true, 'its label says what it shows');
    w.stop();
  }
});

test('AUDIT-STOREFRONT III C5: an item and the unlock say why they offer nothing - before the season "Opens <day>", shut "Not on sale yet", a guest "Needs a username", nobody signed in "Sign in to buy" (mutants: an item silent before the season; the unlock silent)', () => {
  const before = S1.fromMs - 4 * 86_400_000, opens = `Opens ${new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(S1.fromMs))}`;
  const grant = passPanelsOf('s1', 'free')[0].items[0].grant;
  const w = open(flowIn({ balance: 2400 }), { now: () => before });
  assert.equal(text(all(w.root, 'sh-punlock')[0], 'sh-state'), opens, 'the unlock on its cover');
  assert.equal(all(w.root, 'sh-punlockb').length, 0);
  face(w, 'free').click();
  assert.equal(text(itemCard(w, grant), 'sh-state'), opens);
  assert.ok(String(all(itemCard(w, grant), 'sh-state')[0].className).includes('sh-state-soon'));
  w.stop();
  const cases = [[flowIn({ open: false }), 'Not on sale yet'], [{ ...flowIn(), account: { kind: 'guest' } }, 'Needs a username'], [{ ...flowIn(), stage: 'out' }, 'Sign in to buy']];
  for (const [fl, words] of cases) {
    const v = open(fl, { keep: { folio: 'free', page: 0 } });
    assert.equal(text(itemCard(v, grant), 'sh-state'), words, words);
    v.stop();
  }
});

test('AUDIT-STOREFRONT III C6: a painted word is inked under the Grimoire though the browser reads its colours back as rgb() - the reds it is written in no longer stand (mutants: only a hex inked)', () => {
  const doc = { documentElement: { dataset: { plusDress: 'grimoire' } } };
  const word = { style: { color: 'rgb(243, 215, 138)', backgroundImage: 'linear-gradient(90deg, rgb(147, 141, 108), rgb(243, 215, 138))', filter: 'drop-shadow(rgb(0, 0, 0) 1px 0px 0px)' } };
  inkPaintedWord(word, doc);
  assert.equal(word.style.color, inkColour('rgb(243, 215, 138)'));
  assert.doesNotMatch(word.style.backgroundImage, /rgb\(243, 215, 138\)|rgb\(147, 141, 108\)/, 'every stop inked');
  assert.match(word.style.filter, /rgb\(0, 0, 0\)/, 'a dark shadow stands');
});

test('AUDIT-STOREFRONT III C6: the Grimoire\'s words in the shop read at 4.5:1 - the pack\'s red as an ink on the darkest page; the shop\'s panels the scroll washed toward the page, where that red reads; a closed tab\'s word on its plate (mutants: the red at 29%; the wash gone; the tab\'s old ink)', () => {
  const page = 0.43;   // the pages' darkest tan (INK-READ)
  assert.equal(INK_RED, 'hsl(5 80% 26%)');
  const red = hslRgb(inkColour('#ffe29a'));
  assert.ok((page + 0.05) / (lum(red) + 0.05) >= 4.5, `gold inked red reads on the page: ${(page + 0.05) / (lum(red) + 0.05)}`);
  assert.deepEqual(hslRgb(INK_RED), red, 'the tabs\' and Back\'s red the same ink');
  const css = kitCss();
  const m = css.match(/:not\(\[data-grim-pages="scroll"\]\) :is\(([^)]*\.px-shopwin \.sh-spread[^)]*)\) \{ background: linear-gradient\((rgba\([^)]*\)), \2\), /);
  assert.ok(m, 'the shop\'s panels washed');
  for (const p of ['.px-shopwin .sh-folio', '.px-shopwin .sh-spread', '.px-shopwin .sh-pchal', '.px-shopwin .sh-pass']) assert.ok(m[1].includes(p), p);
  const [wr, wg, wb, wa] = parseColour(m[2]), scroll = [175, 135, 72];   // the scroll's ground as the auditor measured it
  const washed = scroll.map((c, i) => c * (1 - wa) + [wr, wg, wb][i] * wa);
  assert.ok(ratio(red, washed) >= 4.5, `red on the washed scroll: ${ratio(red, washed)}`);
  assert.ok(ratio(red, scroll) < 4.5, 'and it could not on the bare scroll');
  const tab = css.match(/border-image: var\([^)]*plate[^)]*\)[^;]*fill[^;]*;\s*color: (#[0-9a-f]{6}) !important;/);
  assert.ok(tab, 'a closed tab\'s word');
  assert.ok(ratio(parseColour(tab[1]), [137, 120, 79]) >= 4.5, `a closed tab on its plate: ${ratio(parseColour(tab[1]), [137, 120, 79])}`);
  const on = css.match(/border-image: var\(--grim-plateOn[^;]*;\s*color: (hsl\([^)]*\)) !important;/), back = css.match(/\[data-grim-cancel\]\[data-grim-on="page"\] \{ color: (hsl\([^)]*\)|#[0-9a-f]{6}) !important;/);
  assert.ok(on && ratio(hslRgb(on[1]), [199, 168, 98]) >= 4.5, 'the open tab\'s red on its lit plate');
  assert.ok(back && back[1].startsWith('hsl') && ratio(hslRgb(back[1]), washed) >= 4.5, 'Back\'s red on the washed scroll');
});

test('AUDIT-STOREFRONT III C7: on Stone every small word reads at 4.5:1 - a tab\'s count undimmed, a held price dimmed less, the gold heads a shade lighter (mutants: the count at 0.75; a held price at 0.6; the gold heads Stone\'s)', () => {
  assert.ok(SHOP_CSS.includes('.px-shopwin .sh-tabcount { font-variant-numeric: tabular-nums; font-size: 11px; }'));
  assert.doesNotMatch(SHOP_CSS, /\.sh-tabcount \{[^}]*opacity/);
  assert.ok(PASS_CSS.includes('.px-shopwin .sh-pitem-held .sh-price { font-size: 13px; opacity: 0.8; }'));
  assert.ok(SHOP_CSS.includes('.px-shopwin .sh-buyrow-held .sh-price { font-size: 15px; opacity: 0.8; }'));
  assert.ok(SHOP_CSS.includes(':root[data-plus-theme="stone"] .px-shopwin :is(.sh-ppanelnum, .sh-subhead) { color: #e8c98a; }'));
});

test('AUDIT-STOREFRONT III C8: Escape in an open folio goes back to its covers, the focus on its cover - the window\'s back says so, and with the covers up it is the window\'s to close (mutants: back never closing a folio)', () => {
  const doc = fakeDoc(), keep = {}, w = open(flowIn(), { doc, keep: Object.assign(keep, { folio: 'premium', page: 0 }) });
  assert.equal(w.back(), true);
  assert.equal(all(w.root, 'sh-spread').length, 0);
  assert.equal(keep.folio, null);
  assert.equal(doc.activeElement, face(w, 'premium'));
  assert.equal(w.back(), false, 'the covers: the window closes');
  w.stop();
  const d = open(flowIn(), { keep: { cat: 'kills' } });
  assert.equal(d.back(), false, 'another section: the window closes');
  d.stop();
});

test('AUDIT-STOREFRONT III C9: a price is said with its currency and a wear press names its item - in words the tree keeps, never a span\'s aria-label (mutants: the price a bare number; Hide with no item)', () => {
  const fl = flowIn({ bought: FREE_I, daily: [{ id: AURUM_DAILY[0].id, held: false }] });
  const w = open(fl, { keep: { folio: 'free', page: 0 } });
  const cog = itemCard(w, 'glyph:cog'), price = all(cog, 'sh-price')[0];
  assert.equal(all(price, 'sh-pricen')[0].attrs['aria-hidden'], 'true');
  assert.equal(text(price, 'sh-sr'), `${passItemOf('s1', 'glyph:cog').aurum} Aurum`);
  assert.equal(price.attrs['aria-label'], undefined);
  assert.equal(all(cog, 'sh-wear')[0].attrs['aria-label'], `Hide ${passGrantName('glyph:cog')}`);
  w.stop();
  const d = open(fl, { keep: { cat: 'daily' } });
  const p = all(d.root, 'sh-panel').map((x) => all(x, 'sh-price')[0])[0];
  assert.equal(text(p, 'sh-sr'), `${aurumPriceOf(AURUM_DAILY[0].id).toLocaleString('en-US')} Aurum`);
  d.stop();
});

test('AUDIT-STOREFRONT III C10: a refusal is said once, in the account flow\'s words - on the item, and to a screen reader - and the window\'s line does not say it again; a refusal the Folios have no word for is the table\'s own, never "Try again" (mutants: the window\'s line saying it too; the item\'s own words)', async () => {
  for (const error of ['pass-short', 'rate', 'frozen']) {
    const fl = flowIn({ bought: FREE_I }), grant = passPanelsOf('s1', 'free')[1].items[0].grant;
    fl.passBuy = async () => { fl.error = accountRefusalText(error); return { ok: false, error }; };
    const w = open(fl, { keep: { folio: 'free', page: 1 } });
    const buy = () => all(itemCard(w, grant), 'sh-pbuy')[0];
    buy().click(); buy().click();
    await settle();
    w.draw();
    assert.equal(text(itemCard(w, grant), 'sh-state'), accountRefusalText(error), error);
    assert.equal(all(w.root, 'sh-sr').find((n) => n.attrs.role === 'status')?.textContent, accountRefusalText(error));
    assert.equal(text(w.root, 'sh-say'), '', `${error}: said once`);
    fl.error = ''; fl.note = 'Glyph shown.';
    w.draw();
    assert.equal(text(w.root, 'sh-say'), 'Glyph shown.', 'another act\'s words: the window\'s again');
    w.stop();
  }
  assert.notEqual(accountRefusalText('rate'), 'It did not go through. Try again.');
  const flow = AccountFlow({ io: {}, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  assert.deepEqual(await flow.passBuy('s1', 'glyph:cog'), { ok: false, error: 'pass-busy' }, 'a word the table says');
});

test('AUDIT-STOREFRONT III C11: a buy\'s answer is said beside the folio it was made in - over its page, in sight - and not at the foot of the window (mutants: the answer left at the foot)', async () => {
  const fl = flowIn({ bought: FREE_I }), grant = passPanelsOf('s1', 'free')[1].items[0].grant;
  fl.passBuy = async (s, g) => { fl.pass = passOf({ bought: [...FREE_I, g] }); fl.note = `${passGrantName(g)} is yours. Wear it here or from your profile.`; return { ok: true }; };
  const w = open(fl, { keep: { folio: 'free', page: 1 } });
  const buy = () => all(itemCard(w, grant), 'sh-pbuy')[0];
  buy().click(); buy().click();
  await settle();
  const note = all(w.root, 'sh-pnote')[0], spread = all(w.root, 'sh-spread')[0];
  assert.equal(note.textContent, fl.note);
  assert.equal(note.attrs.role, 'status');
  assert.equal(note.parent, spread, 'in the open folio, over its page');
  assert.ok(spread.children.indexOf(note) < spread.children.indexOf(all(w.root, 'sh-pagehost')[0]));
  assert.equal(text(w.root, 'sh-say'), '', 'never twice');
  w.stop();
});

test('AUDIT-STOREFRONT III C12: while a spend\'s answer is out its press says so - Buying... or Unlocking... - never the first press\'s words, which read as called off; the daily wares\' too (mutants: Buy again while it goes)', async () => {
  let answer;
  const fl = flowIn({ bought: FREE_I, daily: [{ id: AURUM_DAILY[0].id, held: false }] }), grant = passPanelsOf('s1', 'free')[1].items[0].grant;
  fl.passBuy = () => new Promise((r) => { answer = r; });
  const w = open(fl, { keep: { folio: 'free', page: 1 } });
  const buy = () => all(itemCard(w, grant), 'sh-pbuy')[0];
  buy().click(); buy().click();
  assert.deepEqual([buy().textContent, buy().attrs['aria-label'], buy().attrs['data-armed']], ['Buying...', undefined, 'true']);
  answer({ ok: false, error: 'pass-short' });
  await settle();
  assert.deepEqual([buy().textContent, buy().attrs['data-armed']], ['Buy', undefined], 'answered: Buy again, the refusal said on its card');
  w.stop();
  const ul = flowIn({ balance: 2400 });
  ul.passUnlock = () => new Promise(() => {});
  const u = open(ul);
  const press = () => all(u.root, 'sh-punlockb')[0];
  press().click(); press().click();
  assert.equal(press().textContent, 'Unlocking...');
  u.stop();
  let paid;
  fl.buyWare = () => new Promise((r) => { paid = r; });   // PIN MOVED (AURUM-ONLY): buyDaily, every ware's now
  const d = open(fl, { keep: { cat: 'daily' } });
  const db = () => all(all(d.root, 'sh-panel')[0], 'sh-buy')[0];
  db().click(); db().click();
  assert.equal(db().textContent, 'Buying...');
  paid(true);
  await settle();
  assert.match(db().textContent, /^Buy for /, 'answered: its words again');
  d.stop();
});

test('AUDIT-STOREFRONT III C13: an open folio says the Aurum the account spent in it, as the service\'s ledger says - an Admin, who holds every item, spent nothing; an older service\'s card, the items\' worth (mutants: the spent read off what is held)', () => {
  const every = PASS_ALL_GRANTS.filter((g) => !!passItemOf('s1', g));
  const admin = flowIn({ premium: true, bought: every, spent: { free: 0, premium: 0 } });
  assert.deepEqual(admin.pass.spent, { free: 0, premium: 0 }, 'the card carries it');
  for (const track of ['free', 'premium']) {
    const w = open(admin, { keep: { folio: track, page: 0 } });
    assert.equal(text(w.root, 'sh-pspent'), '0 Aurum spent', track);
    w.stop();
  }
  const paid = open(flowIn({ bought: ['glyph:cog'], spent: { free: 150, premium: 0 } }), { keep: { folio: 'free', page: 0 } });
  assert.equal(text(paid.root, 'sh-pspent'), '150 Aurum spent', 'what was paid, not today\'s price');
  paid.stop();
  const old = open(flowIn({ bought: ['glyph:cog'] }), { keep: { folio: 'free', page: 0 } });
  assert.equal(text(old.root, 'sh-pspent'), `${passItemOf('s1', 'glyph:cog').aurum} Aurum spent`);
  old.stop();
  assert.equal(passCardOf({ season: 's1', spent: { free: -5, premium: 'x' } }).spent.free, 0, 'checked on the way in');
});

test('AUDIT-STOREFRONT III C14: the pause window under the shop is drawn no more - its words showed through the window\'s ground - and no other window\'s stage hides it (mutants: the pause face drawn under the shop)', () => {
  assert.ok(SHOP_CSS.includes('.px-home > .px-stage:has(~ .px-shopstage) { visibility: hidden; }'));
  assert.equal(SHOP_CSS.split('visibility: hidden').length - 1, 1, 'the shop\'s stage alone hides it');
});

test('AUDIT-STOREFRONT III C15: under a finger every press of the shop is 44 pixels at the least - the arrows, the tabs, Back, Buy, Wear, Get Aurum, Close, the carousel\'s steps and dots (mutants: the finger\'s rule gone)', () => {
  const coarse = SHOP_CSS.slice(SHOP_CSS.indexOf('@media (pointer: coarse) {'));
  assert.ok(coarse.length > 30 && SHOP_CSS.indexOf('@media (pointer: coarse) {') > SHOP_CSS.lastIndexOf('@media (max-height: 480px)'), 'after the short screen\'s, so it wins');
  assert.ok(coarse.includes('.px-shopwin :is(.sh-close, .sh-tab, .sh-cprev, .sh-cnext, .sh-cpause, .sh-pageprev, .sh-pagenext, .sh-pagetab, .sh-fback) { min-height: 44px; }'));
  assert.ok(coarse.includes('.px-shopwin .sh-pitem :is(.sh-buy, .sh-wear, .sh-getaurum) { min-height: 44px; }'));
  assert.ok(coarse.includes('.px-shopwin .sh-cdot { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }'));
  assert.ok(coarse.includes('.px-shopwin .sh-pagetab { min-width: 44px; justify-content: center; }'), 'a page\'s numeral alone is 44 wide');
  assert.ok(coarse.includes('.px-shopwin .sh-terms { display: inline-flex; align-items: center; min-height: 44px; }'));
});

test('AUDIT-STOREFRONT III C16: a phone\'s room - the sections one row that scrolls sideways, a folio\'s page tabs on one line and their numerals alone, a long name broken between its syllables (mutants: the sections wrapped; the page tabs wrapped; a name broken anywhere)', () => {
  const narrow = SHOP_CSS.slice(SHOP_CSS.indexOf('@media (max-width: 640px), (max-height: 480px) {'));
  assert.ok(narrow.includes('.px-shopwin .sh-tabs { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto;'));
  assert.ok(PASS_CSS.includes('.px-shopwin .sh-pagetabs { display: flex; flex: 1; justify-content: center; flex-wrap: nowrap;'));
  const phone = PASS_CSS.slice(PASS_CSS.indexOf('@media (max-width: 640px) {'));
  assert.ok(phone.includes('.px-shopwin .sh-pagetabword { display: none; }') && phone.includes('.px-shopwin .sh-pagetabnum { display: inline; }'));
  assert.ok(PASS_CSS.includes('.px-shopwin .sh-pitem .sh-rewardname { font-size: 14px; line-height: 1.2; overflow-wrap: break-word; hyphens: auto; }'));
});

test('AUDIT-STOREFRONT III C17: a locked Gilded Folio\'s every page says to unlock the folio - nothing is spent in it till then - in a sentence with no name in it (mutants: the page\'s Aurum asked first)', () => {
  const w = open(flowIn({ balance: 2400 }), { keep: { folio: 'premium', page: 1 } });
  assert.equal(text(w.root, 'sh-ppanelstate'), 'Unlock this folio to open this page.');
  w.stop();
  const u = open(flowIn({ premium: true }), { keep: { folio: 'premium', page: 1 } });
  assert.match(text(u.root, 'sh-ppanelstate'), /^Spend [\d,]+ more Aurum in this folio to open this page\.$/, 'unlocked: what opens the page');
  u.stop();
});

test('AUDIT-STOREFRONT III B3: the window offers nothing the service refuses - the Folios\' own switch shut is closed as Aurum\'s is (mutants: the pass card\'s switch unread)', () => {
  assert.equal(passCannot(flowIn()), null);
  assert.equal(passCannot(flowIn({ open: false })), 'closed');
  assert.equal(passCannot({ ...flowIn(), aurum: aurumCardOf({ open: false, balance: 0 }) }), 'closed');
  const w = open(flowIn({ open: false }), { keep: { folio: 'free', page: 0 } });
  assert.equal(all(w.root, 'sh-pbuy').length, 0);
  w.stop();
});

test('AUDIT-STOREFRONT III B8: the shop\'s now is the shared clock\'s wall while one stands, so Buy and "opens on" turn at one instant on every device; the device\'s offline (mutants: the device\'s clock always)', () => {
  try {
    for (const at of [S1.fromMs - 86_400_000, S1.fromMs + 86_400_000]) {
      setSharedClock(() => sharedClassicMinutes(at));
      assert.ok(Math.abs(shopNow() - at) < 1000, `${new Date(at).toISOString()}: ${new Date(shopNow()).toISOString()}`);
      const w = open(flowIn(), { now: shopNow });
      assert.equal(text(w.root, 'sh-passwho') === '', at >= S1.fromMs, 'the head by the shared clock');
      w.stop();
    }
  } finally { setSharedClock(null); }
  assert.ok(Math.abs(shopNow() - Date.now()) < 1000, 'offline: the device\'s');
});
