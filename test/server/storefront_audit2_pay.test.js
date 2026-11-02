// AUDIT-STOREFRONT II (lane A, 2026-10-29; bible/06-Systems/Audit-Storefront.md): STRIPE TELLS A PAYMENT'S WORDS IN NO
// ORDER and retries a refused one for days. Each case drives the real Worker on node:sqlite, Stripe stood in for: a
// refund or a dispute told before the paid word, a refund while an inquiry stands, one paid word twice at once, a bundle
// paid with credit whose payment went back, two pages paid at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import { legacyPageFor } from './legacyOrders.mjs';   // AURUM-ONLY: an item's page opened before the switch
import { fulfilOrder, STRIPE_API, STRIPE_REFUND_API } from '../../server-account/src/shop.js';
import { SHOP_WARES, shopHeldIds } from '../../src/net/shopLaw.js';

const ON = { STRIPE_SECRET_KEY: 'sk_test_au', STRIPE_WEBHOOK_SECRET: 'whsec_au', SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on' };
let sessions = 0;
function stripe() {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    asked.push({ url: u, init });
    if (u === STRIPE_API) { const n = ++sessions; return Response.json({ id: `cs_au_${n}`, url: `https://checkout.stripe.com/c/pay/cs_au_${n}` }); }
    if (u.startsWith(`${STRIPE_API}/`) && u.endsWith('/expire')) return Response.json({ status: 'expired' });
    if (u === STRIPE_REFUND_API) return Response.json({ id: 're_1', status: 'succeeded' });
    throw new Error(`no stand-in for ${u}`);
  };
  return { asked, restore: () => { globalThis.fetch = real; } };
}
async function stand() {
  const s = await standService(ON);
  const raw = s.env.DB._raw;
  const get = (path, who) => s.fetch(`https://accounts.invalid${path}`, { headers: { authorization: `Bearer ${who.secret}` } });
  const account = async (who) => (await get('/v1/account', who)).json();
  const rowOf = (who) => raw.prepare('SELECT shop_wares, shop_held FROM players WHERE id = ?').get(who.id);
  const orders = (who) => raw.prepare('SELECT * FROM shop_orders WHERE player = ? ORDER BY created_at, rowid').all(who.id);
  const hook = async (type, object) => {
    const body = JSON.stringify({ id: 'evt_au', type, data: { object } }), t = Math.floor(Date.now() / 1000);
    const r = await s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
    return { status: r.status, ...(await r.json()) };
  };
  /** PIN MOVED (AURUM-ONLY): an item's page opened before the switch - at its price for the row then, with its credit
   *  (shopCheckout sells packs alone now); every case here is Stripe's words on such a page. */
  const open = async (who, id) => { const o = legacyPageFor(raw, who, id, rowOf(who)); return orders(who).find((x) => x.id === o.id); };
  const pi = (o) => `pi_${o.ware.replace(':', '_')}_${o.id.slice(0, 4)}`;
  const paid = async (o) => {
    const st = stripe();
    try { return await hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: o.id }, payment_intent: pi(o), amount_subtotal: o.cents, currency: 'usd' }); } finally { st.restore(); }
  };
  return { ...s, raw, rowOf, orders, hook, open, paid, pi };
}


const NOW = Date.UTC(2026, 11, 26, 12);
const rows = (s, who) => s.orders(who).map((x) => [x.ware, x.status]);

test('AUDIT-STOREFRONT II A1: a full refund told before the paid word - the paid word retried later grants nothing, the order refunded (mutants: the refund word not kept; the paid word not reading it)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Early');
  const o = await s.open(me, 'kill:pyre');
  assert.equal((await s.hook('charge.refunded', { payment_intent: s.pi(o), refunded: true, metadata: { order: o.id } })).ok, true);
  assert.equal((await s.paid(o)).applied, 0);
  assert.deepEqual(rows(s, me), [['kill:pyre', 'refunded']]);
  assert.deepEqual(shopHeldIds(s.rowOf(me)), []);
});

test('AUDIT-STOREFRONT II A1: a dispute told before the paid word - nothing granted while it stands, nor when it is lost (mutants: the dispute word not kept)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('EarlyD');
  const o = await s.open(me, 'mount:warhorse');
  await s.hook('charge.dispute.created', { payment_intent: s.pi(o), status: 'needs_response' });
  assert.equal((await s.paid(o)).applied, 0);
  await s.hook('charge.dispute.closed', { payment_intent: s.pi(o), status: 'lost' });
  assert.deepEqual(rows(s, me), [['mount:warhorse', 'disputed']]);
  assert.deepEqual(shopHeldIds(s.rowOf(me)), []);
});

test('AUDIT-STOREFRONT II A3: a refund while an inquiry stands takes the ware; the inquiry closed never gives it back (mutants: a refund on a disputed order ignored; the close restoring a refunded payment)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Inquirer');
  const o = await s.open(me, 'kill:pyre');
  await s.paid(o);
  await s.hook('charge.dispute.created', { payment_intent: s.pi(o), status: 'warning_needs_response' });
  await s.hook('charge.refunded', { payment_intent: s.pi(o), refunded: true });
  assert.deepEqual(rows(s, me), [['kill:pyre', 'refunded']], 'refunded at once, the inquiry standing');
  assert.equal((await s.hook('charge.dispute.closed', { payment_intent: s.pi(o), status: 'warning_closed' })).applied, 0);
  assert.deepEqual(rows(s, me), [['kill:pyre', 'refunded']]);
  assert.deepEqual(shopHeldIds(s.rowOf(me)), []);
  // a refund kept on a payment whose order still stands disputed (its own word lost on the way): the dispute won ends it
  // refunded, never paid again
  const you = await s.registered('Kept');
  const o2 = await s.open(you, 'kill:pyre');
  await s.paid(o2);
  await s.hook('charge.dispute.created', { payment_intent: s.pi(o2), id: 'dp_1', status: 'needs_response' });
  s.raw.prepare("INSERT INTO shop_charge_words (intent, kind, ref, open, at) VALUES (?, 'refund', '', 1, 0)").run(s.pi(o2));
  await s.hook('charge.dispute.closed', { payment_intent: s.pi(o2), id: 'dp_1', status: 'won' });
  assert.deepEqual(rows(s, you), [['kill:pyre', 'refunded']]);
  assert.deepEqual(shopHeldIds(s.rowOf(you)), []);
});

test('AUDIT-STOREFRONT II A4: one paid word delivered twice at once - the late copy, reading the order as it stood, refunds nothing (mutants: a stale refund acted on)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Twice');
  const o = await s.open(me, 'kill:pyre');
  const db = s.env.DB, nowS = Math.floor(Date.now() / 1000), paidWord = { intent: s.pi(o), amount: o.cents, currency: 'usd' };
  const stale = s.raw.prepare('SELECT id, player, ware, cents, currency, status, credit, refund, refund_owed, payment_intent FROM shop_orders WHERE id = ?').get(o.id);
  const st = stripe();
  try {
    assert.deepEqual(await fulfilOrder({ db, nowS }, o.id, paidWord, { env: ON, fetch: globalThis.fetch }), { ok: true, applied: 1 });
    let first = true;
    const late = { ...db, prepare(sql) { if (first && sql.startsWith('SELECT id, player, ware, cents')) { first = false; return { bind: () => ({ first: async () => stale }) }; } return db.prepare(sql); }, batch: (l) => db.batch(l) };
    assert.deepEqual(await fulfilOrder({ db: late, nowS }, o.id, paidWord, { env: ON, fetch: globalThis.fetch }), { ok: true, applied: 0 });
    assert.deepEqual(st.asked.map((x) => x.url), [], 'Stripe never asked for a refund');
  } finally { st.restore(); }
  assert.deepEqual(rows(s, me), [['kill:pyre', 'paid']]);
  assert.deepEqual(shopHeldIds(s.rowOf(me)), ['kill:pyre']);
});

test('AUDIT-STOREFRONT II A2: a bundle page priced with credit for the Pyre, the Pyre refunded, the page paid - the bundle refunded for its price, nothing given; won back from a dispute after its credit went, the bundle comes back without the Pyre (mutants: credit trusted at the grant; the restore giving a refunded credit)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Stale');
  const p = await s.open(me, 'kill:pyre');
  await s.paid(p);
  const c = await s.open(me, 'bundle:daedricchampion');
  assert.equal(c.credit, 'kill:pyre');
  await s.hook('charge.refunded', { payment_intent: s.pi(p), refunded: true });
  assert.equal((await s.paid(c)).applied, 0);
  assert.deepEqual(s.orders(me).map((x) => [x.ware, x.status, x.refund]), [['kill:pyre', 'refunded', null], ['bundle:daedricchampion', 'refunded', 'price']]);
  assert.deepEqual(shopHeldIds(s.rowOf(me)), []);
  const you = await s.registered('Restored');
  const p2 = await s.open(you, 'kill:pyre');
  await s.paid(p2);
  const c2 = await s.open(you, 'bundle:daedricchampion');
  await s.paid(c2);
  await s.hook('charge.dispute.created', { payment_intent: s.pi(c2) });
  await s.hook('charge.refunded', { payment_intent: s.pi(p2), refunded: true });
  await s.hook('charge.dispute.closed', { payment_intent: s.pi(c2), status: 'won' });
  assert.deepEqual(rows(s, you), [['kill:pyre', 'refunded'], ['bundle:daedricchampion', 'paid']]);
  const held = shopHeldIds(s.rowOf(you));
  assert.ok(held.includes('bundle:daedricchampion') && !held.includes('kill:pyre'), held.join(' '));
});

test('AUDIT-STOREFRONT II A5: two pages open at once, the Pyre and the Champion - whichever lands second no longer matches what the account holds and is refunded, the same either way (mutants: the second granted over a held part)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Two');
  const c = await s.open(me, 'bundle:daedricchampion'), p = await s.open(me, 'kill:pyre');
  await s.paid(p); await s.paid(c);
  assert.deepEqual(s.orders(me).map((x) => [x.ware, x.status, x.refund]), [['bundle:daedricchampion', 'refunded', 'price'], ['kill:pyre', 'paid', null]]);
  const you = await s.registered('TwoB');
  const c2 = await s.open(you, 'bundle:daedricchampion'), p2 = await s.open(you, 'kill:pyre');
  await s.paid(c2); await s.paid(p2);
  assert.deepEqual(s.orders(you).map((x) => [x.ware, x.status, x.refund]), [['bundle:daedricchampion', 'paid', null], ['kill:pyre', 'refunded', 'held']]);
});
