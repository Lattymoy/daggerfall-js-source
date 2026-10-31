// AURUM-ONLY (2026-10-30, the owner: "So nothing should cost money money anymore. Aurem should now be the main way to buy
// all items. Aurem purchase itself should be the only thing."; asked, the owner chose $1 = 100 Aurum and daily deals a
// quarter off; bible/06-Systems/Aurum.md sections 4 and 5). The law's prices, and the service on the real Worker over
// node:sqlite: every ware bought with Aurum at this account's price (a deal's, a bundle's share), the price the page
// showed checked, and money selling the packs alone. tools/mutants/aurumonly.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import {
  SHOP_WARES, SHOP_PRICE_CAP, SHOP_AURUM_CAP, SHOP_AURUM_PER_DOLLAR, SHOP_MIN_PRICE, shopWareById, shopPriceFor, shopRepeatable, shopCardOf,
} from '../../src/net/shopLaw.js';
import { AURUM_DAILY, AURUM_DEAL, aurumDealOf, aurumDailyOf } from '../../src/net/aurumLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

const NOW = Date.UTC(2026, 10, 18, 12);
const ON = {
  STRIPE_SECRET_KEY: 'sk_test_aurumonly', STRIPE_WEBHOOK_SECRET: 'whsec_aurumonly',
  SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on',
};
const ITEMS = SHOP_WARES.filter((w) => !shopRepeatable(w));
const PACKS = SHOP_WARES.filter((w) => shopRepeatable(w));
const today = () => aurumDailyOf(utcDay(NOW / 1000), () => true);

async function stand(env = ON) {
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, body === undefined
    ? { headers: { authorization: `Bearer ${who.secret}` } }
    : { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const funded = async (name, aurum) => {
    const who = await s.registered(name);
    raw.prepare("INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at, aurum) VALUES (?, ?, 'aurum:3900', 2999, 'usd', 'paid', ?, ?, ?)")
      .run(who.id.replace(/[^0-9a-f]/g, '').padEnd(24, '0').slice(0, 24), who.id, NOW / 1000, NOW / 1000 + 60, aurum);
    return who;
  };
  const shop = async (who) => (await ask(who, '/v1/account')).body.shop;
  const buy = (who, ware, price) => ask(who, '/v1/aurum/buy', { ware, ...(price === undefined ? {} : { price }) });
  const spent = (who) => raw.prepare("SELECT ref, amount FROM aurum_ledger WHERE account = ? AND kind = 'buy' ORDER BY ref").all(who.id).map((l) => ({ ...l }));
  return { ...s, raw, ask, funded, shop, buy, spent };
}

test('AURUM-ONLY the law: every ware but a pack priced in Aurum - its dollar price at $1 = 100 Aurum to the whole dollar, none past the $30 cap - and no ware but a pack sold for money; a pack priced in cents under the cap; a deal three quarters of the price (mutants: an item sold for money; a ware over the cap; the deal off its share)', () => {
  assert.equal(SHOP_AURUM_PER_DOLLAR, 100);
  assert.equal(SHOP_AURUM_CAP, 3000, 'the $30 cap at $1 = 100 Aurum');
  for (const w of ITEMS) {
    assert.equal(w.cash, false, `${w.id}: never sold for money`);
    assert.equal(w.cents, 0, `${w.id}: no money price`);
    assert.ok(Number.isSafeInteger(w.price) && w.price > 0 && w.price % SHOP_AURUM_PER_DOLLAR === 0, `${w.id}: a whole dollar's Aurum (${w.price})`);
    assert.ok(w.price <= SHOP_AURUM_CAP, `${w.id}: under the cap (${w.price})`);
  }
  for (const p of PACKS) {
    assert.equal(p.cash, true, `${p.id}: sold for money`);
    assert.ok(p.cents > 0 && p.cents <= SHOP_PRICE_CAP && p.aurum > 0 && p.price === 0, p.id);
    assert.equal(shopPriceFor({}, p.id), null, `${p.id}: never priced in Aurum`);
  }
  assert.equal(AURUM_DEAL, 0.75);
  for (const d of AURUM_DAILY) assert.equal(d.aurum, aurumDealOf(/** @type {any} */ (shopWareById(d.id)).price), `${d.id}: a quarter off`);
  assert.deepEqual([aurumDealOf(500), aurumDealOf(2500), aurumDealOf(200)], [375, 1875, 150]);
  // a bundle's share: what is held comes off, never under the floor
  const champion = /** @type {any} */ (shopWareById('bundle:daedricchampion'));
  const withPyre = shopPriceFor({ shop_wares: 0, shop_held: 'kill:pyre' }, champion.id);
  assert.ok(withPyre !== null && withPyre < champion.price && withPyre >= SHOP_MIN_PRICE, `the Pyre held takes its share off (${withPyre})`);
});

test('AURUM-ONLY the card: every ware but a pack carries its Aurum price and no link - a deal its deal price, marked - and a pack alone carries a money link and its cents; the client reads both back (mutants: an item given a money link; the deal unmarked)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Reader');
  const card = await s.shop(me);
  const deals = today();
  for (const r of card.wares) {
    const w = /** @type {any} */ (shopWareById(r.id));
    if (shopRepeatable(w)) {
      assert.match(String(r.buy), /^https:\/\/accounts\.invalid\/v1\/shop\/buy\?t=/, `${r.id}: a pack's money link`);
      assert.equal(r.cents, w.cents);
      continue;
    }
    assert.equal(r.buy, undefined, `${r.id}: no money link`);
    assert.equal(r.price, deals.includes(r.id) ? aurumDealOf(w.price) : w.price, r.id);
    assert.equal(r.deal === true, deals.includes(r.id), `${r.id}: a deal marked`);
  }
  assert.ok(ITEMS.filter((w) => w.alone).every((w) => card.wares.some((r) => r.id === w.id)), 'every ware sold alone is on the card');
  const read = /** @type {any} */ (shopCardOf(card));
  assert.ok(read.wares.filter((/** @type {any} */ r) => !shopRepeatable(shopWareById(r.id))).every((/** @type {any} */ r) => r.buy === null), 'the client never follows a link for an item');
  assert.deepEqual(read.wares.filter((/** @type {any} */ r) => r.deal).map((/** @type {any} */ r) => r.id).sort(), [...deals].sort());
  const forged = /** @type {any} */ (shopCardOf({ on: true, wares: [{ id: 'kill:pyre', sale: true, buy: 'https://evil.example/pay', price: 1 }, { id: 'aurum:500', sale: true, buy: 'https://accounts.invalid/v1/shop/buy?t=x', cents: 499 }] }));
  assert.deepEqual(forged.wares.map((/** @type {any} */ r) => [r.id, r.buy]), [['kill:pyre', null], ['aurum:500', 'https://accounts.invalid/v1/shop/buy?t=x']], 'a link on an item is never kept; a pack\'s is');
  assert.equal(forged.wares[0].price, 1, 'an item\'s own price read back, at most its list');
});

test('AURUM-ONLY a buy: any ware but a pack, for its price - a deal for its deal price - the line its price, the ware held; the price the page showed checked first, a moved one refused with the new and nothing spent; a pack, a ware off sale and one held refused (mutants: the deal charged in full; the shown price not read; a pack sold for Aurum)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand({ ...ON, SHOP_ON_SALE: ON.SHOP_ON_SALE.split(',').filter((id) => id !== 'title:genesis').join(',') });
  const me = await s.funded('Spender', 10_000);
  const deals = today();
  const full = /** @type {any} */ (ITEMS.find((w) => w.alone && !deals.includes(w.id) && w.kind === 'kill'));
  const deal = /** @type {any} */ (shopWareById(deals[0]));
  const a = await s.buy(me, full.id, full.price);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual([a.body.ware, a.body.spent], [full.id, full.price]);
  const moved = await s.buy(me, deal.id, deal.price);
  assert.deepEqual(moved, { status: 409, body: { error: 'aurum-price', price: aurumDealOf(deal.price) } }, 'the full price shown for a deal: told the deal, nothing spent');
  const b = await s.buy(me, deal.id, aurumDealOf(deal.price));
  assert.deepEqual([b.status, b.body.spent], [200, aurumDealOf(deal.price)]);
  assert.deepEqual(s.spent(me), [{ ref: full.id, amount: -full.price }, { ref: deal.id, amount: -aurumDealOf(deal.price) }].sort((x, y) => (x.ref < y.ref ? -1 : 1)));
  assert.deepEqual((await s.buy(me, full.id)).body, { error: 'aurum-held' });
  assert.deepEqual((await s.buy(me, 'aurum:500')).body, { error: 'aurum-ware' }, 'a pack is money\'s alone');
  assert.deepEqual((await s.buy(me, 'title:genesis')).body, { error: 'aurum-sale' }, 'a ware off sale');
  assert.deepEqual((await s.buy(me, 'glyph:oblivion')).body, { error: 'aurum-ware' }, 'a ware sold only in a bundle');
});

test('AURUM-ONLY money: an item\'s sealed ticket - one minted before the switch - opens the "Bought with Aurum" page and its press opens no checkout; a pack\'s still opens its confirm page (mutants: an item\'s page priced in money; its press asking Stripe)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Payer');
  const pack = (await s.shop(me)).wares.find((/** @type {any} */ r) => r.id === 'aurum:500');
  const page = await s.fetch(pack.buy);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /500 Aurum/, 'a pack\'s confirm page');
  const { sealWith } = await import('../../server-account/src/sealed.js');
  const ticket = await sealWith(ON.STRIPE_SECRET_KEY, 'daggerfall-accounts shop', 'buy', { p: me.id, w: 'kill:pyre', x: NOW / 1000 + 3600 },
    { subtle: globalThis.crypto.subtle, rand: (/** @type {Uint8Array} */ b) => globalThis.crypto.getRandomValues(b) });
  const item = await s.fetch(`https://accounts.invalid/v1/shop/buy?t=${encodeURIComponent(ticket)}`);
  assert.equal(item.status, 410);
  assert.match(await item.text(), /Bought with Aurum/);
  const real = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = async () => { asked++; throw new Error('Stripe asked'); };
  try {
    const press = await s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() });
    assert.equal(press.status, 400);
    assert.match(await press.text(), /Bought with Aurum/);
  } finally { globalThis.fetch = real; }
  assert.equal(asked, 0, 'Stripe never asked for an item');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM shop_orders WHERE player = ?').get(me.id).n, 0, 'no order written');
});
