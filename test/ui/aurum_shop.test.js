// AURUM (2026-10-29; bible/06-Systems/Aurum.md): the shop's Daily Wares and Aurum sections, the balance in its head, the
// daily ware's two-press Buy, and the account flow's Aurum - the card read, a daily ware bought, a pack's arrival said.
// AURUM-ONLY (2026-10-30): the Daily Wares are the Daily Deals - every ware is bought with Aurum, a deal a quarter off.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOP_WARES, shopWareById } from '../../src/net/shopLaw.js';
import { aurumCardOf, aurumDailyOf, aurumPriceOf, AURUM_DEEDS } from '../../src/net/aurumLaw.js';
import { shopWindow, shopSections, shopWareState, aurumTurnsText } from '../../src/ui/enhanced/enhancedShop.js';
import { passItemsIn } from '../../src/ui/enhanced/enhancedPass.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';

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

const NOW = Date.UTC(2026, 10, 18, 12);
const DAY = Math.floor(NOW / 86_400_000);
const WARES = aurumDailyOf(DAY, () => true);
/** The shop's card as the service answers it (AURUM-ONLY, PIN MOVED): a pack with its money link, every other ware sold
 *  alone with its Aurum price - today's deals a quarter off (aurumPriceOf), `deal` marked. */
const shopCard = () => ({ on: true, wares: SHOP_WARES.filter((w) => w.alone).map((w) => (w.cash
  ? { id: w.id, sale: true, held: false, buy: `https://accounts.invalid/v1/shop/buy?t=${w.key}`, cents: w.cents }
  : { id: w.id, sale: true, held: false, price: WARES.includes(w.id) ? aurumPriceOf(w.id) : w.price, deal: WARES.includes(w.id) })), featured: [] });
const aurum = (balance, held = []) => aurumCardOf({ open: true, balance, daily: { until: (DAY + 1) * 86_400_000, wares: WARES.map((id) => ({ id, held: held.includes(id) })) }, week: { until: NOW + 5 * 86_400_000, deeds: { gate: 30, serpent: 25 } } });
const flowIn = (extra = {}) => ({ stage: 'in', account: { handle: 'Aelwyn', kind: 'linked' }, wardrobe: { titles: [], glyphs: [], auras: [], icons: [], effectsHeld: { kill: [], portal: [], mount: [] } }, shop: shopCard(), busy: false, aurum: aurum(1450), ...extra });
const win = (flow, keep = {}) => shopWindow(fakeDoc(), { flow: () => flow, onClose() {}, keep, focus: false, now: () => Date.now(), preview: async () => null, effectPreview: async () => null });

test('AURUM the sections: the day\'s deals after the pass while Aurum is open, with none or closed not shown; the Aurum\'s packs last; AURUM-ONLY (PIN MOVED) the icons a section of their own, sold for good (mutants: daily shown closed; daily first)', () => {
  assert.deepEqual(shopSections(flowIn()), ['pass', 'daily', 'kills', 'portals', 'mounts', 'names', 'icons', 'auras', 'armory', 'bundles', 'aurum']);   // PIN MOVED (PASS-PANELS): no boosters; PIN MOVED (AURUM-ONLY): the icons
  assert.ok(!shopSections(flowIn({ aurum: aurumCardOf({ open: false, balance: 0, daily: { until: 1, wares: WARES.map((id) => ({ id })) } }) })).includes('daily'), 'closed: never, its wares or not');
  assert.ok(!shopSections(flowIn({ aurum: null })).includes('daily'));
  const w = win(flowIn());
  assert.deepEqual(all(w.root, 'sh-tab').map((t) => t.textContent).slice(0, 2), [`Folios${passItemsIn('s1').length}`, 'Daily Deals5']);   // PIN MOVED (PASS-PANELS): the Folios; PIN MOVED (AURUM-ONLY): the deals
  w.stop();
});

test('AURUM the balance in the head: the account\'s Aurum, its words for a screen reader, marked below nothing; hidden with Aurum closed or nobody signed in (mutants: the balance never drawn; shown while closed)', () => {
  const flow = flowIn();
  const w = win(flow);
  const chip = all(w.root, 'sh-balance')[0];
  assert.equal(chip.hidden, false);
  assert.equal(all(chip, 'sh-balancen')[0].textContent, '1,450');
  // PIN MOVED (AUDIT-STOREFRONT III C9): a span's aria-label is dropped from the tree - its words are its own, the number hidden
  assert.equal(all(chip, 'sh-sr')[0].textContent, 'Your Aurum: 1,450');
  assert.equal(all(chip, 'sh-balancen')[0].attrs['aria-hidden'], 'true');
  flow.aurum = aurum(-300); w.draw();
  assert.ok(String(chip.className).includes('sh-owing'));
  flow.aurum = aurumCardOf({ open: false, balance: 10 }); w.draw();
  assert.equal(chip.hidden, true);
  w.stop();
});

test('AURUM the Daily Deals section (AURUM-ONLY, PIN MOVED: the Daily Wares): when the deals turn, the week\'s deeds - each its Aurum or done - and a panel a ware with its deal price in Aurum, its own struck beside it and its tag; Buy pressed once arms it, twice buys through the flow at the price shown; left armed it goes back (mutants: one press spends; the armed press never disarmed; the price the wire\'s)', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: NOW });
  const flow = flowIn();
  const bought = [];
  flow.buyWare = (id, price) => { bought.push([id, price]); };
  const w = win(flow, { cat: 'daily' });
  const head = all(w.root, 'sh-dailyhead')[0];
  assert.equal(all(head, 'sh-turns')[0].textContent, aurumTurnsText((DAY + 1) * 86_400_000, NOW));
  assert.equal(aurumTurnsText((DAY + 1) * 86_400_000, NOW), 'New deals in 12 h 0 min');   // PIN MOVED (AURUM-ONLY): the day's deals
  assert.deepEqual(all(head, 'sh-deed').map((d) => [String(d.className).includes('sh-deed-done'), all(d, 'sh-deedpay')[0].textContent]),
    Object.entries(AURUM_DEEDS).map(([k, n]) => (['gate', 'serpent'].includes(k) ? [true, 'Done this week'] : [false, `+${n} Aurum`])));
  assert.deepEqual(all(w.root, 'sh-panel').map((p) => p.attrs['data-ware']), WARES);
  assert.deepEqual(all(w.root, 'sh-pricen').map((p) => p.textContent), WARES.map((id) => aurumPriceOf(id).toLocaleString('en-US')));
  // AURUM-ONLY: a deal a quarter off its own price, that price struck beside it, and its tag
  assert.deepEqual(WARES.map((id) => aurumPriceOf(id)), WARES.map((id) => Math.round(/** @type {any} */ (shopWareById(id)).price * 0.75)));
  assert.deepEqual(all(w.root, 'sh-was').map((p) => p.textContent), WARES.map((id) => /** @type {any} */ (shopWareById(id)).price.toLocaleString('en-US')));
  assert.deepEqual(all(w.root, 'sh-tag-deal').map((p) => p.textContent), WARES.map(() => "Today's deal"));
  const cheap = WARES.find((id) => aurumPriceOf(id) <= 1450);
  const panel = () => all(w.root, 'sh-panel').find((p) => p.attrs['data-ware'] === cheap);
  const buyB = () => all(panel(), 'sh-aurumbuy')[0];
  assert.equal(buyB().textContent, `Buy for ${aurumPriceOf(cheap).toLocaleString('en-US')} Aurum`);
  buyB().click();
  assert.deepEqual(bought, [], 'one press: armed, nothing spent');
  assert.equal(buyB().attrs['data-armed'], 'true');
  assert.equal(buyB().textContent, `Confirm: ${aurumPriceOf(cheap).toLocaleString('en-US')} Aurum`);
  t.mock.timers.tick(6500);
  assert.equal(buyB().attrs['data-armed'], undefined, 'left alone: Buy again');
  buyB().click(); buyB().click();
  assert.deepEqual(bought, [[cheap, aurumPriceOf(cheap)]], 'two presses: bought, at the price shown');
  w.stop();
});

test('AURUM a daily ware short of the balance says how much more and offers Get Aurum, which opens the packs; held it says Owned and Wear wears it - an icon in the portrait well (mutants: a short ware buyable; Get Aurum to nowhere; an icon worn as a glyph)', () => {
  const flow = flowIn({ aurum: aurum(100) });
  const worn = [];
  flow.wearIcon = (k) => { worn.push(k); };
  const w = win(flow, { cat: 'daily' });
  const dear = WARES.find((id) => aurumPriceOf(id) > 100);
  const panel = () => all(w.root, 'sh-panel').find((p) => p.attrs['data-ware'] === dear);
  assert.equal(all(panel(), 'sh-state')[0].textContent, `You need ${(aurumPriceOf(dear) - 100).toLocaleString('en-US')} more Aurum`);
  assert.equal(all(panel(), 'sh-aurumbuy').length, 0);
  all(panel(), 'sh-getaurum')[0].click();
  assert.equal(all(w.root, 'sh-aurumhead').length, 1, 'the packs opened');
  assert.ok(all(w.root, 'sh-tab').find((t) => t.id === 'sh-tab-aurum').attrs['aria-selected'] === 'true');
  const icon = WARES.find((id) => id.startsWith('icon:'));
  flow.aurum = aurum(100, [icon]);
  flow.wardrobe = { ...flow.wardrobe, icons: [icon.slice(5)] };
  const w2 = win(flow, { cat: 'daily' });
  const ip = all(w2.root, 'sh-panel').find((p) => p.attrs['data-ware'] === icon);
  assert.equal(all(ip, 'sh-state')[0].textContent, 'Owned');
  assert.ok(String(all(ip, 'sh-buyrow')[0].className).includes('sh-buyrow-held'));
  all(ip, 'sh-wear')[0].click();
  assert.deepEqual(worn, [icon.slice(5)]);
  // PIN MOVED (AURUM-ONLY): one state for every ware - shopDailyState is shopWareState's now
  assert.deepEqual(shopWareState(flowIn({ aurum: aurumCardOf({ open: false, balance: 9999 }) }), /** @type {any} */ (shopWareById(icon))).state, 'closed');
  assert.deepEqual(shopWareState({ stage: 'in', account: { handle: null } }, /** @type {any} */ (shopWareById(icon))).state, 'guest');
  w.stop(); w2.stop();
});

test('AURUM the Aurum section: the balance, what Aurum is for and what it never is, and a panel a pack - its coins, its count, its share past the smallest pack, its price in money and Buy through Stripe (mutants: a pack\'s share unsaid; a pack held)', () => {
  const w = win(flowIn(), { cat: 'aurum' });
  const head = all(w.root, 'sh-aurumhead')[0];
  assert.equal(all(head, 'sh-secname')[0].textContent, 'Your balance: 1,450 Aurum');
  assert.match(head.textContent, /no cash value\. It cannot be traded, and it buys no power\./);
  assert.deepEqual(all(w.root, 'sh-aurumn').map((n) => n.textContent), ['500 Aurum', '1,100 Aurum', '2,400 Aurum', '3,900 Aurum']);
  assert.deepEqual(all(w.root, 'sh-bonus').map((n) => n.textContent), ['10% more Aurum', '20% more Aurum', '30% more Aurum']);
  assert.deepEqual(all(w.root, 'sh-price').map((n) => n.textContent), ['$4.99', '$9.99', '$19.99', '$29.99']);
  assert.equal(all(w.root, 'sh-buy').length, 4);
  assert.equal(all(w.root, 'sh-tier').length, 0, 'a pack\'s size is its own mark');
  w.stop();
});

test('AURUM the flow: the card read with the account; a ware bought (AURUM-ONLY: any but a pack, at the price shown) takes the answer\'s wardrobe and card and says so; a ware no longer sold, or its price moved, reads the account again; a pack\'s arrival is said when the balance rises (mutants: the card never read; the answer\'s card ignored; a pack never said arrived)', async () => {
  let balance = 1450, held = false, reads = 0;
  const card = () => ({ open: true, balance, daily: { until: (DAY + 1) * 86_400_000, wares: WARES.map((id) => ({ id, held: held && id === WARES[0] })) }, week: { until: 1, deeds: {} } });
  const acct = () => ({ account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' }, wardrobe: { titles: [], glyphs: [], auras: [], icons: [] }, devices: [], shop: shopCard(), aurum: card() });
  let answer = null;
  const asked = [];
  const fetch = async (url, init) => {
    const p = new URL(url).pathname;
    if (p === '/v1/account') { reads++; return Response.json(acct()); }
    if (p === '/v1/aurum/buy') { asked.push(JSON.parse(init.body)); return answer(); }
    return Response.json({ ok: true });
  };
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const flow = AccountFlow({ io: { fetch, base: 'https://accounts.invalid' }, storage });
  await flow.start();
  assert.equal(flow.aurum.balance, 1450);
  answer = () => { held = true; balance -= aurumPriceOf(WARES[0]); return Response.json({ ok: true, ware: WARES[0], spent: aurumPriceOf(WARES[0]), titles: [], glyphs: [], auras: [], icons: [], aurum: card() }); };
  assert.equal(await flow.buyWare(WARES[0], aurumPriceOf(WARES[0])), true);
  assert.deepEqual(asked, [{ ware: WARES[0], price: aurumPriceOf(WARES[0]) }], 'the ware and the price the window showed');
  assert.equal(flow.aurum.balance, 1450 - aurumPriceOf(WARES[0]));
  assert.match(flow.note, /is yours\. Wear it here or from your profile\./);
  const before = reads;
  answer = () => Response.json({ error: 'aurum-sale' }, { status: 409 });   // PIN MOVED (AURUM-ONLY): aurum-today
  assert.equal(await flow.buyWare(WARES[1], aurumPriceOf(WARES[1])), false);
  assert.equal(flow.error, 'That is not on sale now.', 'refused, said');
  assert.equal(reads, before + 1, 'the shop read again');
  answer = () => Response.json({ error: 'aurum-price', price: 1 }, { status: 409 });   // AURUM-ONLY: a deal turned at midnight
  assert.equal(await flow.buyWare(WARES[1], aurumPriceOf(WARES[1])), false);
  assert.equal(flow.error, 'Its price changed. Check the new price, then buy again.');
  assert.equal(reads, before + 2, 'and read again for the new price');
  flow.shopOpened('aurum:1100');
  balance += 1100;
  await flow.refresh();
  assert.equal(flow.note, '1,100 Aurum is on your account. A receipt is in your mailbox.');
  assert.equal(flow.shopWaiting, null);
});
