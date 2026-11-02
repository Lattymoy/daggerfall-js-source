// AUDIT-STOREFRONT III (lane A, 2026-10-30; bible/01-Overview/audits/Audit-Storefront.md): THE MONEY, at ec9ab3de0. Each
// case drives the real Worker on node:sqlite, Stripe stood in for: the Folios shut with Aurum, a limited ware's window
// shut mid-day, a dispute's words in any order, a ware Aurum paid for kept through a money refund, the money page an
// Aurum buy leaves open, the pack's words, and a find's answer naming its day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import { legacyPageFor, LEGACY_CENTS } from './legacyOrders.mjs';   // AURUM-ONLY: an item's page opened before the switch
import { STRIPE_API, STRIPE_REFUND_API, shopDonePage, receiptUse } from '../../server-account/src/shop.js';
import { dailySaleOf, dailyWaresAt } from '../../server-account/src/aurum.js';
import { shopDemand } from '../../server-account/src/staffShop.js';
import { SHOP_WARES, shopWareById, shopHeldIds } from '../../src/net/shopLaw.js';
import { passSeasonById } from '../../src/net/battlePassLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

const ON = { STRIPE_SECRET_KEY: 'sk_test_a3', STRIPE_WEBHOOK_SECRET: 'whsec_a3', SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };
const NOW = Date.UTC(2026, 10, 18, 12);   // inside Season One, its tracks selling
let sessions = 0;
function stripe() {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    asked.push({ url: u, init });
    if (u === STRIPE_API) { const n = ++sessions; return Response.json({ id: `cs_a3_${n}`, url: `https://checkout.stripe.com/c/pay/cs_a3_${n}` }); }
    if (u.startsWith(`${STRIPE_API}/`) && u.endsWith('/expire')) return Response.json({ status: 'expired' });
    if (u === STRIPE_REFUND_API) return Response.json({ id: 're_1', status: 'succeeded' });
    throw new Error(`no stand-in for ${u}`);
  };
  return { asked, restore: () => { globalThis.fetch = real; } };
}
async function stand(env = ON) {
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, body === undefined
    ? { headers: { authorization: `Bearer ${who.secret}` } }
    : { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const press = (ticket) => s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() });
  const ticketOf = async (who, id) => new URL((await ask(who, '/v1/account')).body.shop.wares.find((w) => w.id === id).buy).searchParams.get('t');
  const rowOf = (who) => raw.prepare('SELECT shop_wares, shop_held FROM players WHERE id = ?').get(who.id);
  const orders = (who) => raw.prepare('SELECT * FROM shop_orders WHERE player = ? ORDER BY created_at, rowid').all(who.id);
  const give = (who, aurum) => raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'cache', ?, ?, 0, 0)").run(who.id, `t${Math.random()}`, aurum);
  const spent = (who) => raw.prepare('SELECT COUNT(*) AS n FROM aurum_ledger WHERE account = ? AND amount < 0').get(who.id).n;
  const hook = async (type, object) => {
    const body = JSON.stringify({ id: 'evt_a3', type, data: { object } }), t = Math.floor(Date.now() / 1000);
    const r = await s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
    return { status: r.status, ...(await r.json()) };
  };
  /** PIN MOVED (AURUM-ONLY): an item's money page is one opened before the switch, at its price for the row then. */
  const open = async (who, id) => { const o = legacyPageFor(raw, who, id, rowOf(who)); return orders(who).find((x) => x.id === o.id); };
  const pi = (o) => `pi_${o.ware.replace(':', '_')}_${o.id.slice(0, 4)}`;
  const paid = async (o) => {
    const st = stripe();
    try { return await hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: o.id }, payment_intent: pi(o), amount_subtotal: o.cents, currency: 'usd' }); } finally { st.restore(); }
  };
  const quiet = async (fn) => { const st = stripe(); try { return await fn(st); } finally { st.restore(); } };
  return { ...s, raw, ask, rowOf, orders, give, spent, hook, open, paid, pi, quiet };
}
/** Today's first deal that was sold for money before AURUM-ONLY (a ware a money page could be open for). PIN MOVED: no
 *  item is sold for money now. */
const moneyWareToday = (env) => dailyWaresAt(env, NOW / 1000).find((id) => Object.hasOwn(LEGACY_CENTS, id));

test('AUDIT-STOREFRONT III A1: Aurum shut (or a developer\'s alone) shuts the Folios\' unlock and buys too, as the window reads it - nothing spent (mutants: the Folios\' gate asking PASS_OPEN alone)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: passSeasonById('s1').fromMs + 5 * 86_400_000 });
  for (const AURUM_OPEN of ['off', 'dev']) {
    const s = await stand({ ...ON, AURUM_OPEN });
    const me = await s.registered(`Shut${AURUM_OPEN}`);
    s.give(me, 3000);
    const unlock = await s.ask(me, '/v1/pass/unlock', { season: 's1' });
    const buy = await s.ask(me, '/v1/pass/buy', { season: 's1', grant: 'glyph:cog' });
    assert.deepEqual([unlock.status, unlock.body.error, buy.status, buy.body.error], [409, 'pass-closed', 409, 'pass-closed'], AURUM_OPEN);
    assert.equal(s.spent(me), 0, `${AURUM_OPEN}: no Aurum spent`);
  }
});

test('AUDIT-STOREFRONT III A3: a limited ware is a daily ware only on a UTC day its window holds whole - a window shutting mid-day sells it that day for neither (mutants: the window read at the day\'s first instant)', () => {
  const env = { ...ON, SHOP_FEATURED: 'mount:warhorse 2026-11-09T00:00Z 2026-11-12T18:00Z limited' };
  const sale = dailySaleOf(env), day = (d) => utcDay(Date.UTC(2026, 10, d, 12) / 1000);
  assert.deepEqual([9, 10, 11, 12, 13].map((d) => sale.eligible('mount:warhorse', day(d))), [true, true, true, false, false]);
});

test('AUDIT-STOREFRONT III A4: a dispute won before its created word lands stays won - the ware kept; one lost before it stays lost - the ware taken (mutants: a closed word opened again; created revoking whatever its word)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Won');
  const o = await s.open(me, 'kill:pyre');
  assert.equal((await s.paid(o)).applied, 1);
  await s.quiet(() => s.hook('charge.dispute.closed', { id: 'dp_won', payment_intent: s.pi(o), status: 'won' }));
  await s.quiet(() => s.hook('charge.dispute.created', { id: 'dp_won', payment_intent: s.pi(o), status: 'needs_response' }));
  assert.deepEqual(s.orders(me).map((x) => x.status), ['paid'], 'the late created word took nothing');
  assert.ok(shopHeldIds(s.rowOf(me)).includes('kill:pyre'));
  assert.equal(s.raw.prepare("SELECT open FROM shop_charge_words WHERE ref = 'dp_won'").get().open, 0, 'the word stays closed');
  const lost = await s.registered('Lost');
  const l = await s.open(lost, 'kill:pyre');
  assert.equal((await s.paid(l)).applied, 1);
  await s.quiet(() => s.hook('charge.dispute.closed', { id: 'dp_lost', payment_intent: s.pi(l), status: 'lost' }));
  await s.quiet(() => s.hook('charge.dispute.created', { id: 'dp_lost', payment_intent: s.pi(l), status: 'needs_response' }));
  assert.deepEqual(s.orders(lost).map((x) => x.status), ['disputed'], 'lost: the money stays taken back, and the ware with it');
  assert.ok(!shopHeldIds(s.rowOf(lost)).includes('kill:pyre'));
});

test('AUDIT-STOREFRONT III A5: a ware Aurum paid for is kept through a money refund of the same ware; bought again it answers held; one the row lost is given back free, never busy (mutants: the Aurum buy no holder; the paid line asked to pay again)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const x = moneyWareToday(s.env);
  assert.ok(x, 'a ware sold for money is among today\'s');
  const me = await s.registered('Twice');
  s.give(me, 5000);
  const o = await s.open(me, x);
  assert.equal((await s.paid(o)).applied, 1);
  await s.quiet(() => s.hook('charge.dispute.created', { id: 'dp_a5', payment_intent: s.pi(o), status: 'needs_response' }));
  assert.ok(!shopHeldIds(s.rowOf(me)).includes(x), 'disputed: off the row');
  const bought = await s.quiet(() => s.ask(me, '/v1/aurum/buy', { ware: x }));
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  await s.quiet(() => s.hook('charge.dispute.closed', { id: 'dp_a5', payment_intent: s.pi(o), status: 'won' }));
  await s.quiet(() => s.hook('charge.refunded', { payment_intent: s.pi(o), refunded: true }));
  assert.ok(shopHeldIds(s.rowOf(me)).includes(x), 'the money went back; the Aurum buy still holds it');
  assert.equal((await s.ask(me, '/v1/aurum/buy', { ware: x })).body.error, 'aurum-held');
  // a row that lost it anyway (a hand's write): its paid line gives it back for nothing
  const r = s.rowOf(me);
  s.raw.prepare('UPDATE players SET shop_held = ?, shop_wares = ? WHERE id = ?').run(String(r.shop_held).split(' ').filter((t) => t !== x).join(' '), Number(r.shop_wares) & ~(shopWareById(x).bit || 0), me.id);
  const again = await s.quiet(() => s.ask(me, '/v1/aurum/buy', { ware: x }));
  assert.deepEqual([again.status, again.body.spent], [200, 0], JSON.stringify(again.body));
  assert.ok(shopHeldIds(s.rowOf(me)).includes(x));
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM aurum_ledger WHERE account = ? AND kind = 'buy'").get(me.id).n, 1, 'one line, ever');
});

test('AUDIT-STOREFRONT III A6: a daily ware bought for Aurum closes the money page left open for it, at Stripe and on the order (mutants: the Aurum buy closing nothing)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const x = moneyWareToday(s.env);
  const me = await s.registered('Page');
  s.give(me, 5000);
  const o = await s.open(me, x);
  assert.equal(o.status, 'open');
  const r = await s.quiet(async (st) => ({ answer: await s.ask(me, '/v1/aurum/buy', { ware: x }), asked: st.asked.map((a) => a.url) }));
  assert.equal(r.answer.status, 200);
  assert.ok(r.asked.some((u) => u.endsWith(`${o.stripe_session}/expire`)), 'its page shut at Stripe');
  assert.equal(s.orders(me).find((y) => y.id === o.id).status, 'expired');
});

test('AUDIT-STOREFRONT III A7: a pack\'s words - spent, not worn; the Folios, never a pass (mutants: the pack told to be worn)', () => {
  const pack = { status: 'paid', ware: 'aurum:500' };
  assert.ok(shopDonePage(pack).lines.some((l) => /spend it in the shop/.test(l)));
  assert.ok(!shopDonePage(pack).lines.some((l) => /wear it/.test(l)));
  assert.ok(shopDonePage({ status: 'paid', ware: 'kill:pyre' }).lines.some((l) => /wear it from your profile/.test(l)));
  assert.equal(receiptUse(shopWareById('aurum:500')), 'Spend it in the shop, on any item and on the Folios.');   // PIN MOVED (AURUM-ONLY)
});

test('AUDIT-STOREFRONT III B4: a find\'s answer names the UTC day its `today` counts, asked again too; one not yet answered says its day and no `today` (mutants: the day left off)', async (t) => {
  const at = passSeasonById('s1').fromMs + 3 * 86_400_000 + 3_600_000;
  t.mock.timers.enable({ apis: ['Date'], now: at });
  const s = await stand();
  const me = await s.seated('Finder');   // a find is a seated character's (the progression route)
  const first = await s.ask(me, '/v1/pass/find', { source: 'foe', rid: '0123456789abcdef' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.day, utcDay(at / 1000));
  const again = await s.ask(me, '/v1/pass/find', { source: 'foe', rid: '0123456789abcdef' });
  assert.deepEqual([again.body.repeat, again.body.day, again.body.today], [true, utcDay(at / 1000), first.body.today]);
  s.raw.prepare('INSERT INTO pass_asks (account, rid, day) VALUES (?, ?, ?)').run(me.id, 'fedcba9876543210', utcDay(at / 1000));
  const pending = await s.ask(me, '/v1/pass/find', { source: 'foe', rid: 'fedcba9876543210' });
  assert.deepEqual([pending.body.repeat, pending.body.day, pending.body.today], [true, utcDay(at / 1000), undefined]);
});

test('AUDIT-STOREFRONT III A7: the staff demand lists no daily wares for a day before the rotation ran (mutants: the first day\'s wares lent to the days before it)', async () => {
  const s = await stand();
  const d = await shopDemand(s.env.DB, s.env, Date.UTC(2026, 9, 2, 12) / 1000, 4);
  assert.deepEqual(d.days.map((r) => r.daily.length), [0, 0, 5, 5], '29 and 30 September none; 1 and 2 October five');
});
