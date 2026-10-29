// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop ... When purchased are granted to the player and their mailbox"; bible/06-Systems/Shop.md). The service's side,
// driven end to end through the real Worker on node:sqlite (test/accountDb.mjs): the card on the account read, the
// confirm page, the press that opens Stripe's checkout, and Stripe's signed webhook granting the ware and the receipt.
// Stripe is the one thing stood in for - its API answered by a stub, its webhook signed by node's own HMAC-SHA256.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import {
  shopOn, shopOnSale, shopCardOf, stripeSignatureOf, stripeSignatureOk, checkoutFields, stripeForm, receiptPost, revokePost,
  shopConfirmPage, shopDonePage, mintOrderId, SHOP_CHECKOUT_S, SHOP_HOOK_TOLERANCE_S, STRIPE_API, SHOP_OPEN_ROUTES, fulfilOrder, SHOP_PROCEEDS, SHOP_COSMETIC,
} from '../../server-account/src/shop.js';
import { titlesHeld, aurasHeld, glyphsOf, equipRefusal, auraRefusal } from '../../server-account/src/titles.js';
import { ROUTES } from '../../server-account/src/service.js';
import { SHOP_WARES, shopWareById, shopHeldOf, shopKeysOf, shopOnSaleOf, shopCardOf as clientCard, shopPriceText, SHOP_BITS_ALL, shopVocabularyOk } from '../../src/net/shopLaw.js';
import { postHead } from '../../src/net/postLaw.js';
import { POST_BODY_MAX, POST_SUBJECT_MAX, POST_BATCH_RE } from '../../src/net/postLaw.js';

const { subtle } = globalThis.crypto;
const ON = { STRIPE_SECRET_KEY: 'sk_test_shop', STRIPE_WEBHOOK_SECRET: 'whsec_shop', SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };   // ARMORY (PIN MOVED): the deploy's list, the Aura Armory's Eternal line with it; STOREFRONT: every ware sold alone; AUDIT-STOREFRONT S6 (PIN MOVED): the deploy's PASS_OPEN, which a season's wares now need
/** STOREFRONT: inside Season One's days - its passes and boosters on sale (bible/06-Systems/Battle-Pass.md), a clock the
 *  season's windows never make a test depend on. */
const IN_SEASON = Date.UTC(2026, 10, 20, 12);
const SOLD = SHOP_WARES.filter((w) => w.alone && w.cash);   // AURUM (PIN MOVED): a ware sold for Aurum alone is never on the money card
const AFTER = 1_900_000_000;
const row = (o = {}) => ({ id: 'acct-buyer', handle: 'Buyer', created_at: AFTER, registered_at: AFTER, ...o });

// ── THE LAW ─────────────────────────────────────────────────────────

test('SHOP: the wares at the owner\'s and the sheet\'s prices, the owner\'s nine each a bit of its own, the rest held by id, each in the vocabulary (mutants: a price moved; two bits shared; a key off the vocabulary)', () => {
  // STOREFRONT (PIN MOVED, bible/06-Systems/Storefront.md section 2): the sheet's rows by section - each [id, price, bit,
  // section, pre-alpha, tier, sold alone]; the owner's nine keep their bits, every ware since is held by its id
  assert.deepEqual(SHOP_WARES.map((w) => [w.id, w.cents, w.bit, w.category, w.preAlpha, w.tier, w.alone]), [
    ['pass:s1premium', 2999, 0, 'pass', false, 'premium', true],
    ['pass:s1deluxe', 4999, 0, 'pass', false, 'exclusive', true],
    ['kill:ashen', 999, 0, 'kills', false, 'standard', true],
    ['kill:voidrend', 1999, 0, 'kills', false, 'premium', true],
    ['kill:pyre', 2999, 0, 'kills', false, 'exclusive', true],
    ['portal:runic', 1499, 0, 'portals', false, 'standard', true],
    ['portal:daedric', 2999, 0, 'portals', false, 'premium', true],
    ['portal:aetheric', 4999, 0, 'portals', false, 'exclusive', true],
    ['mount:spectral', 1999, 0, 'mounts', false, 'standard', true],
    ['mount:dawnfire', 3499, 0, 'mounts', false, 'premium', true],
    ['mount:warhorse', 5999, 0, 'mounts', false, 'exclusive', true],
    ['title:genesis', 500, 1, 'names', true, null, true],
    ['glyph:origin', 200, 2, 'names', true, null, true],
    ['title:dawnbringer', 699, 0, 'names', false, 'standard', true],
    ['title:voidwalker', 1299, 0, 'names', false, 'premium', true],
    ['title:eternalchampion', 2499, 0, 'names', false, 'exclusive', true],
    ['glyph:oblivion', 499, 0, 'names', false, null, false],
    ['glyph:gatesigil', 499, 0, 'names', false, null, false],
    ['glyph:gearcrown', 499, 0, 'names', false, null, false],
    ['aura:eternal', 2000, 4, 'auras', true, null, true],
    ['aura:dominion', 2499, 0, 'auras', false, null, false],
    // ARMORY (PIN MOVED, bible/04-Characters/Aura-Armory.md section 4): the Aura Armory's Eternal line - the set whole at $20
    // (the owner: "The store set should be $20"), and a piece a slot at $6
    ['armory:eternalset', 2000, 256, 'armory', true, null, true],
    ['armory:eternalhalo', 600, 8, 'armory', true, null, true],
    ['armory:eternalsigil', 600, 16, 'armory', true, null, true],
    ['armory:eternalarmlets', 600, 32, 'armory', true, null, true],
    ['armory:eternalgreaves', 600, 64, 'armory', true, null, true],
    ['armory:eternaledge', 600, 128, 'armory', true, null, true],
    ['bundle:daedricchampion', 5999, 0, 'bundles', false, 'exclusive', true],
    ['bundle:portalmaster', 4999, 0, 'bundles', false, 'premium', true],
    ['bundle:lordofoblivion', 11999, 0, 'bundles', false, 'exclusive', true],
    ['bundle:seasonalcollector', 6499, 0, 'bundles', false, 'exclusive', true],
    ['boost:s1cog', 499, 0, 'boosts', false, 'standard', true],
    ['boost:s1tonal', 1299, 0, 'boosts', false, 'premium', true],
    ['boost:s1heart', 2499, 0, 'boosts', false, 'exclusive', true],
    // AURUM (PIN MOVED, bible/06-Systems/Aurum.md): the daily wares' icons, sold for Aurum alone, and the Aurum's packs
    ['icon:gatefire', 600, 0, 'icons', false, 'premium', true], ['icon:aurbis', 700, 0, 'icons', false, 'exclusive', true],
    ['icon:elderscroll', 600, 0, 'icons', false, 'premium', true], ['icon:azurastar', 600, 0, 'icons', false, 'premium', true],
    ['icon:redmountain', 700, 0, 'icons', false, 'exclusive', true], ['icon:hourglass', 500, 0, 'icons', false, 'standard', true],
    ['icon:sanguinerose', 400, 0, 'icons', false, 'standard', true], ['icon:whitegold', 400, 0, 'icons', false, 'standard', true],
    ['aurum:500', 499, 0, 'aurum', false, 'standard', true], ['aurum:1100', 999, 0, 'aurum', false, 'standard', true],
    ['aurum:2400', 1999, 0, 'aurum', false, 'premium', true], ['aurum:6500', 4999, 0, 'aurum', false, 'exclusive', true],
  ]);
  assert.deepEqual(SHOP_WARES.filter((w) => !w.cash).map((w) => w.id), SHOP_WARES.filter((w) => w.kind === 'icon').map((w) => w.id), 'AURUM: the icons alone are sold for Aurum alone');
  assert.deepEqual(SHOP_WARES.filter((w) => w.aurum).map((w) => [w.id, w.aurum]), [['aurum:500', 500], ['aurum:1100', 1100], ['aurum:2400', 2400], ['aurum:6500', 6500]]);
  assert.equal(SHOP_BITS_ALL, 511);
  assert.ok(shopVocabularyOk());
  assert.deepEqual(shopHeldOf(5), ['title:genesis', 'aura:eternal']);
  assert.deepEqual(shopHeldOf(512), [], 'a bit no ware has holds nothing');
  for (const bad of [null, undefined, '', -1, 1.5, 'x']) assert.deepEqual(shopHeldOf(bad), []);
  assert.deepEqual(shopKeysOf(7, 'glyph'), ['origin']);
  assert.deepEqual(shopOnSaleOf(' aura:eternal , nope:x,title:genesis,glyph:oblivion'), ['title:genesis', 'aura:eternal'], 'in the wares\' order, unknown words and a bundle\'s own ware dropped');
  assert.deepEqual(shopOnSaleOf(''), []);
  assert.equal(shopPriceText(500), '$5.00');
  assert.equal(shopPriceText(2000), '$20.00');
});

test('SHOP: a ware bought is held off the row\'s bits - the title, the glyph true of the account, the aura - and may be worn; a guest\'s row holds none (mutants: the handle guard dropped; a kind read as another)', () => {
  const bought = row({ shop_wares: 7 });
  assert.ok(titlesHeld(bought, {}).includes('genesis'));
  assert.ok(aurasHeld(bought, {}).includes('eternal'));
  assert.ok(glyphsOf(bought, {}, AFTER).includes('origin'));
  assert.equal(equipRefusal('genesis', bought, {}), null);
  assert.equal(auraRefusal('eternal', bought, {}), null);
  const one = row({ shop_wares: 2 });
  assert.ok(!titlesHeld(one, {}).includes('genesis') && glyphsOf(one, {}, AFTER).includes('origin') && !aurasHeld(one, {}).includes('eternal'));
  const guest = row({ handle: null, shop_wares: 7 });
  assert.ok(!titlesHeld(guest, {}).includes('genesis') && !aurasHeld(guest, {}).includes('eternal') && !glyphsOf(guest, {}, AFTER).includes('origin'));
  assert.equal(equipRefusal('genesis', row(), {}), 'not-held');
});

test('SHOP: the shop takes payments only with both Stripe secrets, and sells only what SHOP_ON_SALE names (mutants: one secret enough; the sale list ignored)', () => {
  assert.equal(shopOn(ON), true);
  assert.equal(shopOn({ ...ON, STRIPE_WEBHOOK_SECRET: '' }), false);
  assert.equal(shopOn({ STRIPE_WEBHOOK_SECRET: 'x' }), false);
  assert.deepEqual(shopOnSale({ SHOP_ON_SALE: 'aura:eternal' }), ['aura:eternal']);
  assert.ok(SHOP_OPEN_ROUTES.size === 5 && [...SHOP_OPEN_ROUTES].every((p) => ROUTES.has(p)), 'every door is a route the service serves');
});

test('SHOP: Stripe\'s signature is read off its header and checked over `t.body` within the tolerance (mutants: the time unchecked; another body passes; v0 read)', async () => {
  const body = new TextEncoder().encode('{"id":"evt_1"}');
  const t = 2_000_000_000;
  const v1 = createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.{"id":"evt_1"}`).digest('hex');
  assert.deepEqual(stripeSignatureOf(`t=${t},v1=${v1},v0=${'a'.repeat(64)}`), { t, v1: [v1] });
  assert.equal(stripeSignatureOf('v1=abc'), null);
  assert.equal(await stripeSignatureOk(ON.STRIPE_WEBHOOK_SECRET, body, `t=${t},v1=${v1}`, { subtle, nowS: t + 10 }), true);
  assert.equal(await stripeSignatureOk(ON.STRIPE_WEBHOOK_SECRET, body, `t=${t},v1=${v1}`, { subtle, nowS: t + SHOP_HOOK_TOLERANCE_S + 1 }), false, 'too old');
  assert.equal(await stripeSignatureOk('whsec_other', body, `t=${t},v1=${v1}`, { subtle, nowS: t }), false);
  assert.equal(await stripeSignatureOk(ON.STRIPE_WEBHOOK_SECRET, new TextEncoder().encode('{"id":"evt_2"}'), `t=${t},v1=${v1}`, { subtle, nowS: t }), false);
  assert.equal(await stripeSignatureOk(ON.STRIPE_WEBHOOK_SECRET, body, `t=${t},v0=${v1}`, { subtle, nowS: t }), false, 'only v1 is Stripe\'s HMAC-SHA256');
});

test('SHOP: the checkout is priced by the service, names the account, and carries the disclaimer on the line the buyer reads (mutants: the client\'s price; the order off the metadata)', () => {
  const ware = shopWareById('aura:eternal');
  const f = checkoutFields({ id: 'a'.repeat(24), player: 'p1', handle: 'Buyer', ware, origin: 'https://accounts.invalid', expiresAt: 123 });
  assert.equal(f['line_items[0][price_data][unit_amount]'], 2000);
  assert.equal(f['line_items[0][price_data][currency]'], 'usd');
  assert.equal(f['line_items[0][price_data][product_data][name]'], 'Eternal (aura) - DFO Online');
  assert.ok(f['line_items[0][price_data][product_data][description]'].includes('Buyer') && f['line_items[0][price_data][product_data][description]'].includes(SHOP_PROCEEDS));
  assert.equal(f['metadata[order]'], 'a'.repeat(24));
  assert.equal(f['payment_intent_data[metadata][order]'], 'a'.repeat(24), 'a refund on the payment finds its order');
  assert.equal(f.success_url, `https://accounts.invalid/v1/shop/done?o=${'a'.repeat(24)}`);
  assert.equal(stripeForm({ 'a[b]': 'x y' }), 'a%5Bb%5D=x%20y');
  assert.match(mintOrderId((b) => b.fill(171)), /^(ab){12}$/);
});

test('SHOP: the confirm page names the account, the price, the pre-alpha, the cosmetic line and the proceeds - and its one form posts to the checkout (mutants: the account unnamed; the disclaimer dropped)', () => {
  const p = shopConfirmPage({ handle: 'Buyer', ware: shopWareById('title:genesis'), ticket: 't1' });
  assert.equal(p.heading, 'Buy Genesis (title)');
  assert.ok(p.lines.includes('Game account: Buyer'));
  assert.ok(p.lines.includes('Price: $5.00 (USD), paid once.'));
  assert.ok(p.lines.includes(SHOP_PROCEEDS) && p.lines.includes(SHOP_COSMETIC));
  assert.deepEqual(p.form, { action: '/v1/shop/checkout', ticket: 't1', label: 'Pay $5.00 on Stripe' });
  assert.match(shopDonePage({ ware: 'title:genesis', status: 'paid' }).lines[0], /Genesis \(title\) is on your account now\./);
  assert.match(shopDonePage({ ware: 'title:genesis', status: 'open' }).lines[0], /being confirmed/);
});

test('SHOP: the receipt and the refund letter fit the post\'s own bounds and batch (mutants: a body past POST_BODY_MAX; a batch the post refuses)', () => {
  for (const w of SHOP_WARES) {
    const o = { id: 'f'.repeat(24), ware: w.id, cents: w.cents };
    for (const p of [receiptPost(o, AFTER), revokePost(o, 'refunded'), revokePost(o, 'disputed')]) {
      assert.ok(p.body.length <= POST_BODY_MAX && p.subject.length <= POST_SUBJECT_MAX, `${w.id}: within the post's bounds`);
      assert.match(p.batch, POST_BATCH_RE);
    }
    assert.ok(receiptPost(o, AFTER).body.includes(SHOP_PROCEEDS));
  }
});

// ── END TO END ──────────────────────────────────────────────────────

/** Stripe's API stood in for: a session for every ask, the asks kept. */
function stripe() {
  const real = globalThis.fetch;
  const asked = [];
  let n = 0;
  globalThis.fetch = async (url, init) => {
    asked.push({ url: String(url), init });
    if (String(url) === STRIPE_API) { n++; return Response.json({ id: `cs_test_${n}`, url: `https://checkout.stripe.com/c/pay/cs_test_${n}` }); }
    throw new Error(`no stand-in for ${url}`);
  };
  return { asked, restore: () => { globalThis.fetch = real; } };
}

async function stand(extra = ON) {
  const s = await standService(extra);
  const get = (path, who = null) => s.fetch(`https://accounts.invalid${path}`, who ? { headers: { authorization: `Bearer ${who.secret}` } } : {});
  const account = async (who) => (await get('/v1/account', who)).json();
  const press = (ticket) => s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() });
  const hook = (type, object, { secret = ON.STRIPE_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000) } = {}) => {
    const body = JSON.stringify({ id: 'evt_x', type, data: { object } });
    return s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}` } });
  };
  const bits = (who) => s.env.DB._raw.prepare('SELECT shop_wares FROM players WHERE id = ?').get(who.id).shop_wares;
  const orders = (who) => s.env.DB._raw.prepare('SELECT * FROM shop_orders WHERE player = ? ORDER BY created_at').all(who.id);
  const post = (who) => s.env.DB._raw.prepare('SELECT batch, subject, body, ware FROM server_post WHERE to_id = ?').all(who.id);
  const ticketOf = async (who, id) => new URL((await account(who)).shop.wares.find((w) => w.id === id).buy).searchParams.get('t');
  return { ...s, get, account, press, hook, bits, orders, post, ticketOf };
}

test('SHOP, end to end: the account read carries the card - every ware sold alone, on sale, not held, a Buy link to the service\'s own page; a guest none, and no link at all while the shop is off (mutants: a guest given a link; the card told on while off)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_SEASON });
  const { account, registered, guest } = await stand();
  const me = await registered('Buyer');
  const card = (await account(me)).shop;
  assert.equal(card.on, true);
  // ARMORY (PIN MOVED): every ware, the Eternal line's five with the three; STOREFRONT (PIN MOVED): every ware sold alone, at its price
  assert.deepEqual(card.wares.map((w) => [w.id, w.sale, w.held, typeof w.buy, w.cents]), SOLD.map((w) => [w.id, true, false, 'string', w.cents]));
  assert.deepEqual(card.featured, ['pass:s1premium', 'pass:s1deluxe'], 'the live season\'s passes lead the carousel');
  assert.match(card.wares[0].buy, /^https:\/\/accounts\.invalid\/v1\/shop\/buy\?t=/);
  assert.ok(!card.wares[0].buy.includes(me.id) && !card.wares[0].buy.includes(ON.STRIPE_SECRET_KEY), 'the ticket names nobody in clear');
  assert.deepEqual(clientCard(card).wares.map((w) => !!w.buy), SOLD.map(() => true), 'and the client reads it back whole');
  assert.ok((await account(await guest())).shop.wares.every((w) => w.buy === null), 'a guest cannot buy');
  const off = await stand({});
  const someone = await off.registered('Someone');
  const closed = (await off.account(someone)).shop;
  assert.equal(closed.on, false);
  assert.ok(closed.wares.every((w) => w.buy === null && w.sale === false), 'off, and nothing on sale with no list');
});

test('SHOP, end to end: the Buy link opens a page naming the ware, the price and the account, writing nothing; its press opens ONE Stripe checkout, priced by the service; a second press goes back to it (mutants: the GET writes; a second order; the price off the client)', async () => {
  const { get, press, registered, orders, ticketOf } = await stand();
  const me = await registered('Buyer');
  const t = await ticketOf(me, 'title:genesis');
  const page = await get(`/v1/shop/buy?t=${encodeURIComponent(t)}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Buy Genesis \(title\)/);
  assert.match(html, /Game account: Buyer/);
  assert.match(html, /Price: \$5\.00 \(USD\), paid once\./);
  assert.ok(html.includes(SHOP_PROCEEDS));
  assert.match(html, /<form method="post" action="\/v1\/shop\/checkout">/);
  assert.match(page.headers.get('content-security-policy'), /form-action 'self' https:\/\/checkout\.stripe\.com;/, 'the press may go on to Stripe\'s page, and nowhere else');
  assert.equal(orders(me).length, 0, 'NOTHING is written by the page');
  const st = stripe();
  let first, second;
  try {
    first = await press(t);
    second = await press(t);
  } finally { st.restore(); }
  assert.equal(first.status, 303);
  assert.equal(first.headers.get('location'), 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.equal(second.headers.get('location'), 'https://checkout.stripe.com/c/pay/cs_test_1', 'a second press goes back to the same page');
  assert.equal(st.asked.length, 1, 'Stripe asked once');
  const sent = new URLSearchParams(st.asked[0].init.body);
  assert.equal(sent.get('line_items[0][price_data][unit_amount]'), '500');
  assert.equal(st.asked[0].init.headers.authorization, `Bearer ${ON.STRIPE_SECRET_KEY}`);
  const [o] = orders(me);
  assert.equal(o.status, 'open');
  assert.equal(o.stripe_session, 'cs_test_1');
  assert.equal(sent.get('metadata[order]'), o.id);
  assert.equal(o.expires_at - o.created_at, SHOP_CHECKOUT_S);
});

test('SHOP, end to end: Stripe\'s signed word that the checkout is paid grants the ware and sends ONE receipt to the mailbox; told twice it grants once; an unsigned or wrong-amount word grants nothing (mutants: the signature skipped; the amount unchecked; the guard dropped; a failed grant told done)', async () => {
  const { press, hook, registered, bits, orders, post, account, ticketOf, env } = await stand();
  const me = await registered('Buyer');
  const st = stripe();
  try { await press(await ticketOf(me, 'aura:eternal')); } finally { st.restore(); }
  const [o] = orders(me);
  const paid = { id: 'cs_test_1', client_reference_id: o.id, metadata: { order: o.id }, payment_status: 'paid', payment_intent: 'pi_1', amount_total: 2000, currency: 'usd' };
  assert.equal((await hook('checkout.session.completed', paid, { secret: 'whsec_wrong' })).status, 401);
  assert.equal(bits(me), 0);
  assert.deepEqual(await (await hook('checkout.session.completed', { ...paid, amount_total: 1 })).json(), { ok: true, applied: 0, mismatch: true });
  assert.equal(bits(me), 0, 'an amount that is not the order\'s grants nothing');
  assert.deepEqual(await (await hook('checkout.session.completed', { ...paid, payment_status: 'unpaid' })).json(), { ok: true, applied: 0 }, 'a delayed method waits for its own word');
  assert.deepEqual(await (await hook('checkout.session.completed', paid)).json(), { ok: true, applied: 1 });
  assert.deepEqual(await (await hook('checkout.session.completed', paid)).json(), { ok: true, applied: 0 }, 'told twice, granted once');
  assert.equal(bits(me), 4);
  assert.equal(orders(me)[0].status, 'paid');
  assert.equal(orders(me)[0].payment_intent, 'pi_1');
  const letters = post(me).filter((l) => l.ware === 'aura:eternal');
  assert.equal(letters.length, 1, 'one receipt');
  assert.equal(letters[0].subject, 'Thank you: Eternal');
  assert.match(letters[0].body, /Eternal \(aura\) is yours, on every character of your account\./);
  const a = await account(me);
  assert.ok(a.wardrobe.auras.includes('eternal'), 'held on the account read at once');
  assert.deepEqual(a.shop.wares.find((w) => w.id === 'aura:eternal'), { id: 'aura:eternal', sale: true, held: true, buy: null, cents: 2000 }, 'and no second Buy');
  // told twice AT ONCE (the completed word and the delayed method's, both read the order open): the batch's guard holds
  const st2 = stripe();
  try { await press(await ticketOf(me, 'title:genesis')); } finally { st2.restore(); }
  const o2 = orders(me).find((x) => x.ware === 'title:genesis');
  const word = { intent: 'pi_2', amount: 500, currency: 'usd' }, ctx = { db: env.DB, nowS: Math.floor(Date.now() / 1000) };
  const both = await Promise.all([fulfilOrder(ctx, o2.id, word), fulfilOrder(ctx, o2.id, word)]);
  assert.deepEqual(both.map((r) => r.applied).sort(), [0, 1], 'two words at once, one grant');
  assert.equal(post(me).filter((l) => l.ware === 'title:genesis').length, 1);
  assert.equal(bits(me), 5);
  // A GRANT NEVER WRITTEN is never told done: the database failing under it throws (the service's 5xx), so Stripe tells it again
  const st3 = stripe();
  try { await press(await ticketOf(me, 'glyph:origin')); } finally { st3.restore(); }
  const o3 = orders(me).find((x) => x.ware === 'glyph:origin');
  const down = { db: { prepare: (q) => env.DB.prepare(q), batch: async () => { throw new Error('D1_ERROR: overloaded'); } }, nowS: ctx.nowS };
  await assert.rejects(fulfilOrder(down, o3.id, { intent: 'pi_3', amount: 200, currency: 'usd' }), /overloaded/);
  assert.equal(orders(me).find((x) => x.id === o3.id).status, 'open', 'nothing written');
  // Stripe's tax on top of the price: the price before it is the order's
  assert.deepEqual(await (await hook('checkout.session.completed', { metadata: { order: o3.id }, payment_status: 'paid', payment_intent: 'pi_3', amount_subtotal: 200, amount_total: 240, currency: 'usd' })).json(), { ok: true, applied: 1 });
  assert.equal(bits(me), 7);
});

test('SHOP, end to end: the receipt reaches the mailbox with its ware; a full refund or a dispute takes the ware back with a letter, a part refund does not, a won dispute returns it (mutants: a part refund revokes; another paid order\'s ware taken; a dispute lost restoring; a letter a reason lost; an inquiry closed keeping the ware)', async () => {
  const s = await stand();
  const { press, hook, registered, bits, orders, get, ticketOf } = s;
  const me = await registered('Buyer');
  const st = stripe();
  try { await press(await ticketOf(me, 'glyph:origin')); } finally { st.restore(); }
  const [o] = orders(me);
  await hook('checkout.session.completed', { metadata: { order: o.id }, payment_status: 'paid', payment_intent: 'pi_9', amount_total: 200, currency: 'usd' });
  const box = await (await get('/v1/post/box', me)).json();
  const head = box.post.map(postHead).find((p) => p?.ware);
  assert.equal(head?.ware, 'glyph:origin', 'the mailbox reads the receipt\'s ware');
  assert.deepEqual(await (await hook('charge.refunded', { payment_intent: 'pi_9', refunded: false, amount_refunded: 50 })).json(), { ok: true, applied: 0 });
  assert.equal(bits(me), 2, 'a part refund keeps the ware');
  // two paid orders of one ware (two tabs pressed at once): a full refund of one keeps the ware the other paid for
  s.env.DB._raw.prepare("INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at, paid_at, payment_intent) VALUES (?, ?, 'glyph:origin', 200, 'usd', 'paid', 9999999999, 9999999999, 9999999999, 'pi_10')").run('b'.repeat(24), me.id);
  assert.deepEqual(await (await hook('charge.refunded', { payment_intent: 'pi_10', refunded: true })).json(), { ok: true, applied: 1 });
  assert.equal(bits(me), 2, 'another paid order still holds the ware');
  assert.deepEqual(await (await hook('charge.dispute.created', { payment_intent: 'pi_9' })).json(), { ok: true, applied: 1 });
  assert.equal(bits(me), 0);
  assert.equal(orders(me)[0].status, 'disputed');
  assert.deepEqual(await (await hook('charge.dispute.closed', { payment_intent: 'pi_9', status: 'lost' })).json(), { ok: true, applied: 0 });
  assert.equal(bits(me), 0, 'a dispute lost returns nothing');
  assert.deepEqual(await (await hook('charge.dispute.closed', { payment_intent: 'pi_9', status: 'won' })).json(), { ok: true, applied: 1 });
  assert.equal(bits(me), 2, 'a won dispute gives it back');
  assert.deepEqual(await (await hook('charge.refunded', { payment_intent: 'pi_9', refunded: true })).json(), { ok: true, applied: 1 });
  assert.equal(bits(me), 0);
  assert.equal(orders(me)[0].status, 'refunded');
  // every turn said in its own letter, and only the receipt and the return carry the ware (nothing to wear on the others)
  const letters = s.env.DB._raw.prepare('SELECT batch, subject, ware FROM server_post WHERE to_id = ? ORDER BY sent_at, batch').all(me.id);
  const of = (end) => letters.find((l) => l.batch === `shop-${o.id}${end}`);
  assert.equal(of('').ware, 'glyph:origin');
  assert.match(of('-disputed').subject, /^Payment disputed: Origin$/);
  assert.equal(of('-disputed').ware, null, 'a letter taking it off draws no ware');
  assert.match(of('-restored').subject, /^Back on your account: Origin$/);
  assert.equal(of('-restored').ware, 'glyph:origin');
  assert.match(of('-refunded').subject, /^Refunded: Origin$/, 'the refund after the dispute said too');
  assert.equal(of('-refunded').ware, null);
  // an inquiry (no chargeback) opened and closed: the ware back
  const st2 = stripe();
  try { await press(await ticketOf(me, 'glyph:origin')); } finally { st2.restore(); }
  const o2 = orders(me).find((x) => x.status === 'open');
  await hook('checkout.session.completed', { metadata: { order: o2.id }, payment_status: 'paid', payment_intent: 'pi_11', amount_total: 200, currency: 'usd' });
  await hook('charge.dispute.created', { payment_intent: 'pi_11', status: 'warning_needs_response' });
  assert.equal(bits(me), 0);
  assert.deepEqual(await (await hook('charge.dispute.closed', { payment_intent: 'pi_11', status: 'warning_closed' })).json(), { ok: true, applied: 1 });
  assert.equal(bits(me), 2, 'an inquiry closed gives it back');
});

test('SHOP, end to end: a ware taken off sale is not sold - its page says so and its press opens nothing; a held ware is refused; the doors answer a closed shop (mutants: the sale list read only at the card; held not checked at the press)', async () => {
  const s = await stand();
  const me = await s.registered('Buyer');
  const t = await s.ticketOf(me, 'title:genesis');
  s.env.SHOP_ON_SALE = 'glyph:origin';
  assert.equal((await s.get(`/v1/shop/buy?t=${encodeURIComponent(t)}`)).status, 410);
  const st = stripe();
  try { assert.equal((await s.press(t)).status, 400); } finally { st.restore(); }
  assert.equal(st.asked.length, 0);
  s.env.SHOP_ON_SALE = ON.SHOP_ON_SALE;
  s.env.DB._raw.prepare('UPDATE players SET shop_wares = 1 WHERE id = ?').run(me.id);
  assert.equal((await s.get(`/v1/shop/buy?t=${encodeURIComponent(t)}`)).status, 409);
  const st2 = stripe();
  try {
    const held = await s.press(t);
    assert.equal(held.status, 400);
    assert.match(await held.text(), /holds this item already/, 'the press refuses a ware held - a page left open before it was bought');
  } finally { st2.restore(); }
  assert.equal(st2.asked.length, 0, 'Stripe never asked for a ware held');
  assert.equal((await s.get('/v1/shop/buy?t=nonsense')).status, 400);
  assert.equal((await s.get('/v1/shop/cancel')).status, 200);
  const off = await stand({});
  assert.equal((await off.get(`/v1/shop/buy?t=${encodeURIComponent(t)}`)).status, 503);
  assert.equal((await off.hook('checkout.session.completed', {})).status, 503);
});

test('SHOP: the card the client reads keeps only the shop\'s own wares and https links, and offers no Buy for a ware held or off sale (mutants: a link kept off sale; an http link)', () => {
  assert.equal(clientCard(null), null);
  const c = clientCard({ on: true, wares: [
    { id: 'title:genesis', sale: true, held: false, buy: 'https://x/v1/shop/buy?t=1' },
    { id: 'glyph:origin', sale: false, held: false, buy: 'https://x/2' },
    { id: 'aura:eternal', sale: true, held: false, buy: 'http://x/3' },
    { id: 'title:founder', sale: true, held: false, buy: 'https://x/4' },
    { id: 'title:genesis', sale: true, held: false, buy: 'https://x/5' },
  ] });
  assert.deepEqual(c.wares.map((w) => [w.id, w.buy]), [['title:genesis', 'https://x/v1/shop/buy?t=1'], ['glyph:origin', null], ['aura:eternal', null]], 'one row a ware, off sale no link, an http link none');
  assert.equal(clientCard({ on: true, wares: [{ id: 'aura:eternal', sale: true, held: true, buy: 'https://x/3' }] }).wares[0].buy, null, 'held, no Buy');
  assert.equal(clientCard({ on: false, wares: [{ id: 'title:genesis', sale: true, held: false, buy: 'https://x/1' }] }).wares[0].buy, null);
});

test('SHOP: the account card is answered for every row, even one the service read before the migration (no shop_wares); its Buy key derived once a read, its three tickets sealed under it (mutants: a key a ticket)', async () => {
  let derived = 0;
  const counted = new Proxy(subtle, { get: (o, k) => (k === 'deriveKey' ? (...a) => { derived++; return o.deriveKey(...a); } : o[k].bind(o)) });
  const nowS = IN_SEASON / 1000;   // STOREFRONT: inside the season, its wares on sale
  const card = await shopCardOf({ id: 'p', handle: 'Old' }, ON, { subtle: counted, rand: (b) => globalThis.crypto.getRandomValues(b), nowS, origin: 'https://a.invalid' });
  assert.equal(card.wares.length, SOLD.length);   // ARMORY (PIN MOVED): nine wares, the Eternal set and its five with them; STOREFRONT (PIN MOVED): every ware sold alone
  assert.ok(card.wares.every((w) => w.held === false && typeof w.buy === 'string'));
  assert.equal(derived, 1);
  assert.equal(new Set(card.wares.map((w) => w.buy)).size, SOLD.length, 'a ticket each, each its own');
  derived = 0;
  const everything = { id: 'p', handle: 'Old', shop_wares: SHOP_BITS_ALL, shop_held: SOLD.filter((w) => !w.bit).map((w) => w.id).join(' ') };
  await shopCardOf(everything, ON, { subtle: counted, rand: (b) => globalThis.crypto.getRandomValues(b), nowS, origin: 'https://a.invalid' });
  assert.equal(derived, 0, 'nothing to buy, nothing derived');
});

test('SHOP: the page Stripe sends the buyer back to tells the order as it stands - paid, being confirmed, ended unpaid, or taken back - and never promises what will not come (mutants: every order "being confirmed")', () => {
  const at = (status) => shopDonePage({ ware: 'title:genesis', status });
  assert.match(at('paid').lines.join(' '), /Genesis \(title\) is on your account now/);
  assert.match(at('open').lines.join(' '), /being confirmed/);
  assert.equal(at('expired').heading, 'Not paid');
  assert.match(at('expired').lines.join(' '), /Nothing was charged/);
  for (const st of ['refunded', 'disputed']) {
    assert.equal(at(st).heading, 'Order closed');
    assert.doesNotMatch(at(st).lines.join(' '), /arrives/, `${st}: nothing promised`);
  }
});
