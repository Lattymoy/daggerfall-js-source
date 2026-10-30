// AUDIT-STOREFRONT (2026-10-29, the owner: "audit this deeply, ensure its perfection"; bible/01-Overview/audits/
// Audit-Storefront.md). The purchase path's holes the audit found, each driven end to end through the real Worker on
// node:sqlite (test/accountDb.mjs) with Stripe stood in for: a payment taken back takes what it alone covered (S1); a
// replaced page closes and a ware paid twice is refunded (S3); the schedule's typo shuts a sale (S4, in
// storefront_service); the confirm page says a giver held in part (S12); the demand counts what reached Stripe and the
// refunds owed (S8). PASS-PANELS retired S5, S6, S7 and S10 with the boosters and the passes sold for money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import { legacyPageFor, legacyCentsFor } from './legacyOrders.mjs';   // AURUM-ONLY: an item's page opened before the switch
import { fulfilOrder, STRIPE_API, STRIPE_REFUND_API, heldGranted, heldRevoked, orderCovers, revokePost, refundPost } from '../../server-account/src/shop.js';
import { shopDemand } from '../../server-account/src/staffShop.js';
import { effectsHeld } from '../../server-account/src/titles.js';
import { shopWareById, SHOP_WARES, shopHeldIds, shopLostOf, shopCreditOf, shopClosure } from '../../src/net/shopLaw.js';
import { passSeasonById } from '../../src/net/battlePassLaw.js';
import { POST_BODY_MAX, POST_SUBJECT_MAX } from '../../src/net/postLaw.js';

const ON = { STRIPE_SECRET_KEY: 'sk_test_au', STRIPE_WEBHOOK_SECRET: 'whsec_au', SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };   // AURUM-ONLY: the packs on sale
const S1 = passSeasonById('s1');
const IN_TREMOR = S1.fromMs + 3 * 86_400_000 + 3_600_000;

let sessions = 0;
/** Stripe stood in for: a session for every ask (never an id twice), the expiries and refunds asked kept; `refunds`
 *  false answers a refund as Stripe down. */
function stripe({ refunds = true } = {}) {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    asked.push({ url: u, init });
    if (u === STRIPE_API) { const n = ++sessions; return Response.json({ id: `cs_au_${n}`, url: `https://checkout.stripe.com/c/pay/cs_au_${n}` }); }
    if (u.startsWith(`${STRIPE_API}/`) && u.endsWith('/expire')) return Response.json({ status: 'expired' });
    if (u === STRIPE_REFUND_API) return refunds ? Response.json({ id: 're_1', status: 'succeeded' }) : new Response('{}', { status: 500 });
    throw new Error(`no stand-in for ${u}`);
  };
  return { asked, restore: () => { globalThis.fetch = real; } };
}
async function stand(extra = ON) {
  const s = await standService(extra);
  const raw = s.env.DB._raw;
  const get = (path, who) => s.fetch(`https://accounts.invalid${path}`, { headers: { authorization: `Bearer ${who.secret}` } });
  const account = async (who) => (await get('/v1/account', who)).json();
  const press = (ticket) => s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() });
  const ticketOf = async (who, id) => new URL((await account(who)).shop.wares.find((w) => w.id === id).buy).searchParams.get('t');
  const rowOf = (who) => raw.prepare('SELECT shop_wares, shop_held, effects FROM players WHERE id = ?').get(who.id);
  const orders = (who) => raw.prepare('SELECT * FROM shop_orders WHERE player = ? ORDER BY created_at, rowid').all(who.id);
  const hook = (type, object) => {
    const body = JSON.stringify({ id: 'evt_au', type, data: { object } }), t = Math.floor(Date.now() / 1000);
    return s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
  };
  /** PIN MOVED (AURUM-ONLY): an item's page opened before the switch - at its price for the row then, with its credit. */
  const open = async (who, id) => { const o = legacyPageFor(raw, who, id, rowOf(who)); return orders(who).find((x) => x.id === o.id); };
  /** Press Buy for a pack (AURUM-ONLY: the one thing sold for money): its open order. */
  const openPack = async (who, id) => {
    const st = stripe();
    try { await press(await ticketOf(who, id)); } finally { st.restore(); }
    return orders(who).filter((x) => x.ware === id && x.status === 'open').at(-1);
  };
  /** Stripe's word that an order was paid, its payment `pi_<ware>`. */
  const paid = async (o, st = null) => {
    const mine = st ?? stripe();
    try {
      return await (await hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: o.id }, payment_intent: `pi_${o.ware.replace(':', '_')}`, amount_subtotal: o.cents, currency: 'usd' })).json();
    } finally { if (!st) mine.restore(); }
  };
  const buy = async (who, id) => paid(await open(who, id));
  const letters = (who) => raw.prepare('SELECT batch, subject, body, ware FROM server_post WHERE to_id = ? ORDER BY sent_at, rowid').all(who.id);
  return { ...s, raw, account, rowOf, orders, hook, open, openPack, paid, buy, letters };
}

// ── S1: A PAYMENT TAKEN BACK TAKES WHAT IT ALONE COVERED ─────────────

test('AUDIT-STOREFRONT S1 the law: an order covers its ware and all it gives but its credit; a ware taken back that a giver held with credit for it is marked lost, and the giver no longer gives it; a payment covering it again takes the mark off (mutants: the mark never read; a mark on a ware another order covers; a mark left by a grant)', () => {
  assert.deepEqual(shopClosure('bundle:lordofoblivion'), ['kill:pyre', 'portal:daedric', 'mount:warhorse', 'aura:dominion', 'bundle:lordofoblivion']);
  assert.deepEqual(shopCreditOf({ shop_held: 'kill:pyre' }, 'bundle:daedricchampion'), ['kill:pyre']);
  assert.deepEqual(shopCreditOf({}, 'bundle:daedricchampion'), []);
  const champ = { id: 'c', ware: 'bundle:daedricchampion', credit: 'kill:pyre' }, pyre = { id: 'p', ware: 'kill:pyre', credit: '' };
  assert.deepEqual(orderCovers(champ), ['title:eternalchampion', 'glyph:oblivion', 'aura:dominion', 'bundle:daedricchampion'], 'the Pyre was credited, so the bundle never paid for it');
  const row = { shop_wares: 0, shop_held: 'kill:pyre bundle:daedricchampion' };
  const lost = heldRevoked(row, pyre, [champ]);
  assert.equal(lost.shop_held, 'bundle:daedricchampion -kill:pyre');
  assert.ok(!shopHeldIds(lost).includes('kill:pyre'), 'the bundle no longer gives the Pyre');
  assert.ok(shopHeldIds(lost).includes('aura:dominion'), 'what it paid for stays');
  assert.deepEqual([...shopLostOf(lost)], ['kill:pyre']);
  assert.equal(heldRevoked(row, pyre, [{ ...champ, credit: '' }]).shop_held, 'bundle:daedricchampion', 'a bundle paid in full covers the Pyre: no mark');
  assert.equal(heldGranted(lost, pyre).shop_held, 'bundle:daedricchampion kill:pyre', 'the Pyre paid again: the mark off, held');
  // a bit ware the Eternal Set was credited for
  const halo = { id: 'h', ware: 'armory:eternalhalo', credit: '' }, set = { id: 's', ware: 'armory:eternalset', credit: 'armory:eternalhalo' };
  const bitRow = heldRevoked({ shop_wares: 8 | 256, shop_held: '' }, halo, [set]);
  assert.deepEqual([bitRow.shop_wares, bitRow.shop_held], [256, '-armory:eternalhalo']);
  assert.ok(!shopHeldIds(bitRow).includes('armory:eternalhalo'));
});

test('AUDIT-STOREFRONT S1 end to end: the Pyre bought, then the Daedric Champion with credit for it - a dispute on the Pyre takes it off the account and off the kit, and says so; the dispute won returns it; the Lord of Oblivion refunded takes the wares the Champion was credited for (mutants: a giver keeping a ware nobody paid for; the letter saying nothing left)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 11, 26, 12) });
  const s = await stand();
  const me = await s.registered('Disputer');
  assert.equal((await s.buy(me, 'kill:pyre')).applied, 1);
  const champ = await s.open(me, 'bundle:daedricchampion');
  assert.equal(champ.credit, 'kill:pyre', 'the order keeps what its price took off');
  assert.equal((await s.paid(champ)).applied, 1);
  assert.equal((await s.hook('charge.dispute.created', { payment_intent: 'pi_kill_pyre' }).then((r) => r.json())).applied, 1);
  const held = shopHeldIds(s.rowOf(me));
  assert.ok(!held.includes('kill:pyre'), 'the Pyre is off: nobody paid for it now');
  assert.ok(held.includes('aura:dominion') && held.includes('glyph:oblivion'), 'what the Champion paid for stays');
  assert.equal(effectsHeld(s.rowOf(me), Math.floor(Date.now() / 1000)).kill.includes('pyre'), false, 'nor worn');
  const letter = s.letters(me).find((l) => l.batch.endsWith('-disputed'));
  assert.match(letter.body, /Off your account while the dispute stands: Daedric Pyre\./);
  assert.equal((await s.hook('charge.dispute.closed', { payment_intent: 'pi_kill_pyre', status: 'won' }).then((r) => r.json())).applied, 1);
  assert.ok(shopHeldIds(s.rowOf(me)).includes('kill:pyre'), 'won: back');
  assert.deepEqual([...shopLostOf(s.rowOf(me))], [], 'and the mark off');

  const you = await s.registered('Collector');
  assert.equal((await s.buy(you, 'bundle:lordofoblivion')).applied, 1);
  const c2 = await s.open(you, 'bundle:daedricchampion');
  assert.deepEqual(c2.credit.split(' '), ['kill:pyre', 'aura:dominion']);
  assert.equal((await s.paid(c2)).applied, 1);
  assert.equal((await s.hook('charge.refunded', { payment_intent: 'pi_bundle_lordofoblivion', refunded: true }).then((r) => r.json())).applied, 1);
  const left = shopHeldIds(s.rowOf(you));
  for (const id of ['mount:warhorse', 'portal:daedric', 'aura:dominion', 'kill:pyre']) assert.ok(!left.includes(id), `${id} off: only the Lord paid for it`);
  assert.ok(left.includes('title:eternalchampion') && left.includes('glyph:oblivion'));
  assert.match(s.letters(you).find((l) => l.batch.endsWith('-refunded')).body, /Off your account: Daedric Pyre, Daedric Stone, Daedric Warhorse, Daedric Dominion, Lord of Oblivion\./);
});

test('AUDIT-STOREFRONT S1 the letters: a refund that leaves the ware held says so; every letter fits the post (mutants: "off your account" said of a ware still held)', () => {
  const o = { id: 'f'.repeat(24), ware: 'glyph:origin', cents: 200 };
  assert.match(revokePost(o, 'refunded', []).body, /still holds it through another order/);
  assert.doesNotMatch(revokePost(o, 'refunded', []).body, /Off your account/);
  for (const w of SHOP_WARES) {
    const order = { id: 'f'.repeat(24), ware: w.id, cents: w.cents };
    for (const p of [revokePost(order, 'refunded', shopClosure(w.id)), refundPost(order, 'held'), refundPost(order, 'spent'), refundPost(order, 'late')]) {
      assert.ok(p.body.length <= POST_BODY_MAX && p.subject.length <= POST_SUBJECT_MAX, `${w.id}: within the post's bounds`);
    }
  }
});

// ── S3: A REPLACED PAGE CLOSES; A WARE PAID TWICE IS REFUNDED ────────

test('AUDIT-STOREFRONT S3 end to end: a bundle\'s page opened, the Pyre bought - a grant closes the pages it made wrong; a pack\'s Buy pressed again goes back to its page at one price and closes it at another; an item\'s page paid anyway for a ware held is refunded in full under the order\'s key, said in a letter, and held as owed while Stripe is down (PIN MOVED, AURUM-ONLY: the pages are those opened before the switch, a press a pack\'s) (mutants: the old page left open; a ware paid twice granted twice; the refund owed dropped)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 11, 26, 12) });
  const s = await stand();
  const me = await s.registered('Twice');
  const a = await s.open(me, 'bundle:daedricchampion');
  assert.equal(a.cents, legacyCentsFor({}, 'bundle:daedricchampion'));   // PIN MOVED (AUDIT-STOREFRONT II): the law's price; AURUM-ONLY: its dollar price then
  const st = stripe();
  try {
    assert.equal((await s.paid(await s.open(me, 'kill:pyre'), st)).applied, 1);
    assert.ok(st.asked.some((x) => x.url === `${STRIPE_API}/${a.stripe_session}/expire`), 'the grant closed the bundle\'s page: its price moved');
  } finally { st.restore(); }
  assert.equal(s.orders(me).find((x) => x.id === a.id).status, 'expired');
  // a pack's press: the same price goes back to the open page; another closes the older one
  const c = await s.openPack(me, 'aurum:500');
  const c2 = await s.openPack(me, 'aurum:500');
  assert.equal(c2.id, c.id, 'the same price: the open page gone back to');
  s.raw.prepare('UPDATE shop_orders SET cents = 1 WHERE id = ?').run(c.id);
  const d = await s.openPack(me, 'aurum:500');
  assert.notEqual(d.id, c.id);
  assert.equal(s.orders(me).find((x) => x.id === c.id).status, 'expired', 'the replaced page closed');
  // an item's old page paid anyway, after another page for it granted: refunded, not granted twice
  const old = await s.open(me, 'title:dawnbringer');
  s.raw.prepare("UPDATE shop_orders SET status = 'expired' WHERE id = ?").run(old.id);   // closed when the switch's first grant came
  const fresh = await s.open(me, 'title:dawnbringer');
  assert.equal((await s.paid(fresh)).applied, 1);
  const late = s.orders(me).find((x) => x.id === old.id);
  const down = stripe({ refunds: false });
  let r;
  try {
    r = await s.hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: late.id }, payment_intent: 'pi_twice', amount_subtotal: late.cents, currency: 'usd' });
    assert.equal(r.status, 503, 'Stripe down: told again');
    assert.ok(down.asked.some((x) => x.url === STRIPE_REFUND_API && x.init.headers['idempotency-key'] === `shop-refund-${late.id}`));
  } finally { down.restore(); }
  let o = s.orders(me).find((x) => x.id === late.id);
  assert.deepEqual([o.status, o.refund, o.refund_owed], ['refunded', 'held', 1], 'owed while Stripe has not taken it');
  assert.equal((await shopDemand(s.env.DB, {}, Math.floor(Date.now() / 1000), 5)).refundsOwed[0]?.order, late.id, 'the staff see it owed');
  const up = stripe();
  try {
    assert.equal((await s.hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: late.id }, payment_intent: 'pi_twice', amount_subtotal: late.cents, currency: 'usd' })).status, 200, 'Stripe\'s word again: asked again');
    assert.equal(up.asked.filter((x) => x.url === STRIPE_REFUND_API).length, 1);
  } finally { up.restore(); }
  o = s.orders(me).find((x) => x.id === late.id);
  assert.equal(o.refund_owed, 0);
  assert.equal(s.letters(me).filter((l) => l.batch === `shop-${late.id}-refunded`).length, 1, 'one letter');
  assert.match(s.letters(me).find((l) => l.batch === `shop-${late.id}-refunded`).body, /already held Dawnbringer \(title\)/);
  assert.equal(shopHeldIds(s.rowOf(me)).filter((id) => id === 'title:dawnbringer').length, 1);
  // the refund's own charge.refunded takes nothing and clears an owed flag left standing
  s.raw.prepare('UPDATE shop_orders SET refund_owed = 1 WHERE id = ?').run(late.id);
  assert.deepEqual(await (await s.hook('charge.refunded', { payment_intent: 'pi_twice', refunded: true })).json(), { ok: true, applied: 0 });
  assert.equal(s.orders(me).find((x) => x.id === late.id).refund_owed, 0);
  assert.ok(shopHeldIds(s.rowOf(me)).includes('title:dawnbringer'), 'the ware the other order paid for stays');
});

// ── S12: A GIVER HELD IN PART ───────────────────────────────────────

test('AUDIT-STOREFRONT S12 the card says why a bundle costs less - the Pyre held inside the Daedric Champion, its price this account\'s (PIN MOVED, AURUM-ONLY: the bundle is bought for Aurum from the window, so its card carries the share, never a confirm page; PASS-PANELS: the Premium inside the Collector\'s Deluxe was the case) (mutants: the list price on the card)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Partial');
  assert.equal((await s.buy(me, 'kill:pyre')).applied, 1);
  const row = (await s.account(me)).shop.wares.find((w) => w.id === 'bundle:daedricchampion');
  assert.equal(row.buy ?? null, null, 'no money page');
  assert.ok(row.price < shopWareById('bundle:daedricchampion').price, 'less than its own price');
  assert.equal(row.price, Math.round(2800 * (4300 - 1500) / 4300), 'the Pyre\'s share taken off');
});

// ── S7: TWO GRANTS AT ONCE ──────────────────────────────────────────

test('AUDIT-STOREFRONT S7 three wares paid at the same moment - two held by id, one by its bit - are all granted, none written over another: a grant whose row guard is refused reads the row again and lands (PIN MOVED, PASS-PANELS: the Deluxe and the Seasonal Collector were the case, retired) (mutants: the row guard dropped; the retry dropped)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Racer');
  const ids = ['kill:ashen', 'portal:runic', 'armory:eternalhalo'];
  const os = [];
  for (const id of ids) os.push(await s.open(me, id));
  const ctx = { db: s.env.DB, nowS: Math.floor(Date.now() / 1000) };
  const st = stripe();
  let rs;
  try {
    rs = await Promise.all(os.map((o) => fulfilOrder(ctx, o.id, { intent: `pi_${o.id}`, amount: o.cents, currency: 'usd' }, { env: ON, fetch: globalThis.fetch })));
  } finally { st.restore(); }
  assert.deepEqual(rs.map((r) => r.applied), [1, 1, 1], 'each granted');
  const held = shopHeldIds(s.rowOf(me));
  for (const id of ids) assert.ok(held.includes(id), `${id} held`);
  assert.deepEqual(s.orders(me).map((o) => o.status), ['paid', 'paid', 'paid'], 'none refunded');
});

// ── S8: THE DEMAND ──────────────────────────────────────────────────

test('AUDIT-STOREFRONT S8 the demand counts as opened only a press that reached Stripe (mutants: a press Stripe never saw counted)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
  const s = await stand();
  const me = await s.registered('Watcher');
  await s.open(me, 'kill:ashen');
  s.raw.prepare("INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at) VALUES (?, ?, 'kill:ashen', 999, 'usd', 'expired', ?, ?)").run('e'.repeat(24), me.id, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 60);
  const d = await shopDemand(s.env.DB, {}, Math.floor(Date.now() / 1000), 2);
  assert.equal(d.days.at(-1).wares['kill:ashen'].opened, 1, 'Stripe down for the second: not opened');
  assert.deepEqual(d.refundsOwed, []);
});
