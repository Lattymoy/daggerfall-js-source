// AUDIT AURUM-SPEND (2026-10-31, the owner: "Can we also do a deep comprehensive audit across everything to ensure perfection
// before we ship this?"): the money and spending lane's findings, each pinned on the real Worker over node:sqlite with
// Stripe's signed word. F1 a money piece credited into a giver bought with Aurum, refunded, was kept; F2 a lost ware's mark
// survived an Aurum buy that paid for it; F4 a dispute won after the ware was bought again kept both payments; F5 a debt
// left out of "need"; F6 an aurum-short refusal kept the old balance. tools/mutants/audit_aurum_spend.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import { legacyOrder, legacyPageFor } from './legacyOrders.mjs';
import { STRIPE_API, STRIPE_REFUND_API } from '../../server-account/src/shop.js';
import { SHOP_WARES, shopWareById, shopHeldIds, shopPriceFor } from '../../src/net/shopLaw.js';
import { aurumCardOf, aurumDailyOf, aurumPriceOf } from '../../src/net/aurumLaw.js';
import { shopWareState } from '../../src/ui/enhanced/enhancedShop.js';
import { passItemState } from '../../src/ui/enhanced/enhancedPass.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';

const ON = { STRIPE_SECRET_KEY: 'sk_test_lane', STRIPE_WEBHOOK_SECRET: 'whsec_lane', SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };
const NOW = Date.UTC(2026, 10, 18, 12);
let sessions = 0;
function stripe() {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === STRIPE_API) { const n = ++sessions; return Response.json({ id: `cs_lane_${n}`, url: `https://checkout.stripe.com/c/pay/cs_lane_${n}` }); }
    if (u.startsWith(`${STRIPE_API}/`) && u.endsWith('/expire')) return Response.json({ status: 'expired' });
    if (u === STRIPE_REFUND_API) return Response.json({ id: 're_1', status: 'succeeded' });
    throw new Error(`no stand-in for ${u}`);
  };
  return () => { globalThis.fetch = real; };
}
async function stand(env = ON) {
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, body === undefined
    ? { headers: { authorization: `Bearer ${who.secret}` } }
    : { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const hook = async (type, object) => {
    const body = JSON.stringify({ id: 'evt_lane', type, data: { object } }), t = Math.floor(Date.now() / 1000);
    const restore = stripe();
    try {
      const r = await s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
      return { status: r.status, ...(await r.json()) };
    } finally { restore(); }
  };
  const rowOf = (who) => raw.prepare('SELECT shop_wares, shop_held, pass_items FROM players WHERE id = ?').get(who.id);
  const give = (who, aurum) => raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'cache', ?, ?, 0, 0)").run(who.id, `t${Math.random()}`, aurum);
  const balance = async (who) => (await ask(who, '/v1/account')).body.aurum.balance;
  const pi = (o) => `pi_${o.ware.replace(':', '_')}_${o.id.slice(0, 6)}`;
  const pay = (o) => hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: o.id }, payment_intent: pi(o), amount_subtotal: o.cents, currency: 'usd' });
  /** A pack bought the real way: the account read's link, the confirm press, Stripe's paid word. */
  const buyPack = async (who, id) => {
    const link = (await ask(who, '/v1/account')).body.shop.wares.find((w) => w.id === id).buy;
    const ticket = new URL(link).searchParams.get('t');
    const restore = stripe();
    try { await s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() }); } finally { restore(); }
    const o = raw.prepare('SELECT * FROM shop_orders WHERE player = ? AND ware = ? ORDER BY rowid DESC').get(who.id, id);
    const r = await pay(o);
    return { o, r };
  };
  return { ...s, raw, ask, hook, rowOf, give, balance, pi, pay, buyPack };
}


const halo = 'armory:eternalhalo', held = (s, who, id) => shopHeldIds(s.rowOf(who)).includes(id);

test('AUDIT AURUM-SPEND F1: a piece paid for with money before the switch, its share taken off a set bought with Aurum, then refunded or charged back - the piece goes, as a set bought with money lets it go; the Aurum line keeps that credit (mutants: the credit unwritten, the credit unread)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  for (const [name, end] of [['Refunded', (o) => s.hook('charge.refunded', { refunded: true, payment_intent: s.pi(o) })],
    ['Charged', async (o) => { await s.hook('charge.dispute.created', { id: `dp_${o.id}`, payment_intent: s.pi(o) }); return s.hook('charge.dispute.closed', { id: `dp_${o.id}`, payment_intent: s.pi(o), status: 'lost' }); }]]) {
    const me = await s.registered(name);
    const o = legacyOrder(s.raw, me, halo, { cents: 600 });
    await s.pay(o);
    s.give(me, 2000);
    const price = shopPriceFor(s.rowOf(me), 'armory:eternalset');
    const b = await s.ask(me, '/v1/aurum/buy', { ware: 'armory:eternalset', price });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.ok(b.body.spent < shopWareById('armory:eternalset').price, 'the halo\'s share taken off');
    assert.equal(s.raw.prepare("SELECT credit FROM aurum_ledger WHERE account = ? AND kind = 'buy'").get(me.id).credit, halo, 'the line keeps its credit');
    await end(o);
    assert.equal(held(s, me, halo), false, `${name}: the halo goes with its money`);
    assert.equal(held(s, me, 'armory:eternalsigil'), true, 'the rest of the set stays, paid for with Aurum');
  }
});

test('AUDIT AURUM-SPEND F2: a ware whose payment went back carries its mark; a giver bought with Aurum that pays for it gives it again (mutants: the marks left on)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Marked');
  const p = legacyOrder(s.raw, me, 'portal:daedric', { cents: 1299 });
  await s.pay(p);
  const pm = legacyPageFor(s.raw, me, 'bundle:portalmaster', s.rowOf(me));
  await s.pay(pm);
  await s.hook('charge.refunded', { refunded: true, payment_intent: s.pi(p) });
  assert.equal(held(s, me, 'portal:daedric'), false, 'refunded: gone');
  s.give(me, 6000);
  const price = shopPriceFor(s.rowOf(me), 'bundle:lordofoblivion');
  const b = await s.ask(me, '/v1/aurum/buy', { ware: 'bundle:lordofoblivion', price });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(held(s, me, 'portal:daedric'), true, 'paid for in the bundle\'s price: given');
  assert.ok(!String(s.rowOf(me).shop_held).includes('-portal:daedric'), 'its mark off');
});

test('AUDIT AURUM-SPEND F4: a ware taken by a dispute and bought again with Aurum, the dispute then won - the money stands, so the Aurum comes back, once (mutants: the Aurum kept)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Twice');
  const o = legacyOrder(s.raw, me, halo, { cents: 600 });
  await s.pay(o);
  await s.hook('charge.dispute.created', { id: 'dp_t', payment_intent: s.pi(o) });
  s.give(me, 600);
  assert.equal((await s.ask(me, '/v1/aurum/buy', { ware: halo, price: 600 })).status, 200);
  assert.equal(await s.balance(me), 0);
  await s.hook('charge.dispute.closed', { id: 'dp_t', payment_intent: s.pi(o), status: 'won' });
  assert.equal(await s.balance(me), 600, 'the Aurum back');
  assert.equal(held(s, me, halo), true);
  await s.hook('charge.dispute.closed', { id: 'dp_t', payment_intent: s.pi(o), status: 'won' });
  assert.equal(await s.balance(me), 600, 'once');
});

// the client
// ── THE CLIENT ──
const DAY = Math.floor(NOW / 86_400_000);
const WARES = aurumDailyOf(DAY, () => true);
const shopCard = () => ({ on: true, wares: SHOP_WARES.filter((w) => w.alone).map((w) => (w.cash ? { id: w.id, sale: true, held: false, buy: `https://accounts.invalid/v1/shop/buy?t=${w.key}`, cents: w.cents }
  : { id: w.id, sale: true, held: false, price: WARES.includes(w.id) ? aurumPriceOf(w.id) : w.price, deal: WARES.includes(w.id) })), featured: [] });
const aurum = (balance) => aurumCardOf({ open: true, balance, daily: { until: (DAY + 1) * 86_400_000, wares: WARES.map((id) => ({ id, held: false })) }, week: { until: 1, deeds: {} } });


test('AUDIT AURUM-SPEND F5, F6: with a debt, "need" is the price and the debt; an aurum-short refusal reads the account again, so the panel stops offering Buy (mutants: the debt left out, the refusal not read again)', async () => {
  const base = { stage: 'in', account: { handle: 'Owing', kind: 'linked' }, wardrobe: { titles: [], glyphs: [], auras: [], icons: [], effectsHeld: { kill: [], portal: [], mount: [] } }, shop: shopCard(), busy: false, aurum: aurum(-3500),
    pass: { season: 's1', open: true, stage: 0, tracks: { free: true, premium: false }, bought: [], today: 0, dayMax: 100, spent: { free: 0, premium: 0 }, challenges: [] } };
  const icon = /** @type {any} */ (shopWareById('icon:whitegold'));
  const st = /** @type {any} */ (shopWareState(base, icon));
  assert.deepEqual([st.state, st.need], ['short', st.price + 3500]);
  const ps = /** @type {any} */ (passItemState(base, 's1', 'glyph:cog', NOW));
  assert.equal(ps.need, ps.price + 3500);
  let balance = 1450, reads = 0, answer = null;
  const card = () => ({ open: true, balance, daily: { until: (DAY + 1) * 86_400_000, wares: WARES.map((id) => ({ id, held: false })) }, week: { until: 1, deeds: {} } });
  const acct = () => ({ account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' }, wardrobe: { titles: [], glyphs: [], auras: [], icons: [] }, devices: [], shop: shopCard(), aurum: card() });
  const fetch = async (url) => { const p = new URL(url).pathname; if (p === '/v1/account') { reads++; return Response.json(acct()); } if (p === '/v1/aurum/buy') return answer(); return Response.json({ ok: true }); };
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const flow = AccountFlow({ io: { fetch, base: 'https://accounts.invalid' }, storage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } });
  await flow.start();
  const ware = /** @type {any} */ (shopWareById('mount:spectral'));
  balance = 200;
  answer = () => Response.json({ error: 'aurum-short', balance: 200 }, { status: 409 });
  const r0 = reads;
  await flow.buyWare(ware.id, ware.price);
  assert.ok(reads > r0, 'read again');
  assert.deepEqual([flow.aurum.balance, shopWareState(flow, ware).state], [200, 'short']);
});
