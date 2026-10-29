// AUDIT-STOREFRONT (2026-10-29, the owner: "audit this deeply, ensure its perfection"; bible/01-Overview/audits/
// Audit-Storefront.md). The purchase path's holes the audit found, each driven end to end through the real Worker on
// node:sqlite (test/accountDb.mjs) with Stripe stood in for: a payment taken back takes what it alone covered (S1); a
// replaced page closes and a ware paid twice is refunded (S3); the schedule's typo shuts a sale (S4, in
// storefront_service); a weaker booster is not sold (S5); a season's wares follow PASS_OPEN (S6); two grants at once
// count a pass's levels once (S7); the demand counts what reached Stripe and the refunds owed (S8); a season's ware paid
// after it is refunded (S10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import { fulfilOrder, STRIPE_API, STRIPE_REFUND_API, heldGranted, heldRevoked, orderCovers, revokePost, refundPost } from '../../server-account/src/shop.js';
import { shopDemand } from '../../server-account/src/staffShop.js';
import { effectsHeld } from '../../server-account/src/titles.js';
import { SHOP_WARES, shopHeldIds, shopLostOf, shopCreditOf, shopClosure, shopSpent, shopPriceFor, shopCardOf as clientCard } from '../../src/net/shopLaw.js';
import { passSeasonById, passTracks, PASS_XP_PER_LEVEL } from '../../src/net/battlePassLaw.js';
import { POST_BODY_MAX, POST_SUBJECT_MAX } from '../../src/net/postLaw.js';

const ON = { STRIPE_SECRET_KEY: 'sk_test_au', STRIPE_WEBHOOK_SECRET: 'whsec_au', SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on' };
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
  const rowOf = (who) => raw.prepare('SELECT shop_wares, shop_held, effects, pass_s1 FROM players WHERE id = ?').get(who.id);
  const orders = (who) => raw.prepare('SELECT * FROM shop_orders WHERE player = ? ORDER BY created_at, rowid').all(who.id);
  const hook = (type, object) => {
    const body = JSON.stringify({ id: 'evt_au', type, data: { object } }), t = Math.floor(Date.now() / 1000);
    return s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
  };
  /** Press Buy for a ware: its open order. */
  const open = async (who, id) => {
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
  return { ...s, raw, account, rowOf, orders, hook, open, paid, buy, letters };
}

// ── S1: A PAYMENT TAKEN BACK TAKES WHAT IT ALONE COVERED ─────────────

test('AUDIT-STOREFRONT S1 the law: an order covers its ware and all it gives but its credit; a ware taken back that a giver held with credit for it is marked lost, and the giver no longer gives it; a payment covering it again takes the mark off (mutants: the mark never read; a mark on a ware another order covers; a mark left by a grant)', () => {
  assert.deepEqual(shopClosure('bundle:seasonalcollector'), ['pass:s1premium', 'pass:s1deluxe', 'glyph:gearcrown', 'bundle:seasonalcollector', 'boost:s1heart']);
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
  // a Premium the Collector was credited for: the Deluxe it holds plays without it
  const collector = { id: 'k', ware: 'bundle:seasonalcollector', credit: 'pass:s1premium' }, prem = { id: 'q', ware: 'pass:s1premium', credit: '' };
  const passRow = heldRevoked({ shop_wares: 0, shop_held: 'pass:s1premium bundle:seasonalcollector' }, prem, [collector]);
  assert.deepEqual(passTracks('s1', shopHeldIds(passRow)), { free: true, premium: false, deluxe: true }, 'its own track, never the Premium it did not pay for');
  assert.equal(shopPriceFor(passRow, 'pass:s1premium'), 2999, 'and the Premium is sold again whole');
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

test('AUDIT-STOREFRONT S3 end to end: a bundle\'s page opened, the Pyre bought, Buy pressed again - the old page closes at Stripe and on the order; a grant closes the pages it made wrong; a page paid anyway for a ware held is refunded in full under the order\'s key, said in a letter, and held as owed while Stripe is down (mutants: an old page left open; a payment for a ware held kept; the refund asked twice under two keys; owed never cleared)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 11, 26, 12) });
  const s = await stand();
  const me = await s.registered('Twice');
  const a = await s.open(me, 'bundle:daedricchampion');
  assert.equal(a.cents, 5999);
  const st = stripe();
  try {
    assert.equal((await s.paid(await s.open(me, 'kill:pyre'), st)).applied, 1);
    assert.ok(st.asked.some((x) => x.url === `${STRIPE_API}/${a.stripe_session}/expire`), 'the grant closed the bundle\'s page: its price moved');
  } finally { st.restore(); }
  assert.equal(s.orders(me).find((x) => x.id === a.id).status, 'expired');
  const b = await s.open(me, 'bundle:daedricchampion');
  assert.ok(b.cents < 5999, 'the new page at the new price');
  const c = await s.open(me, 'title:dawnbringer');
  const st2 = stripe();
  try {
    const c2 = await s.open(me, 'title:dawnbringer');
    assert.equal(c2.id, c.id, 'the same price: the open page gone back to');
  } finally { st2.restore(); }
  // a press at another price closes the older page
  s.raw.prepare('UPDATE shop_orders SET cents = 1 WHERE id = ?').run(c.id);
  const st3 = stripe();
  let d;
  try {
    d = await s.open(me, 'title:dawnbringer');
  } finally { st3.restore(); }
  assert.notEqual(d.id, c.id);
  assert.equal(s.orders(me).find((x) => x.id === c.id).status, 'expired', 'the replaced page closed');
  // the old page paid anyway, after the new one granted: refunded, not granted twice
  assert.equal((await s.paid(d)).applied, 1);
  const late = { ...s.orders(me).find((x) => x.id === c.id), cents: 1 };
  const down = stripe({ refunds: false });
  let r;
  try {
    r = await s.hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: late.id }, payment_intent: 'pi_twice', amount_subtotal: 1, currency: 'usd' });
    assert.equal(r.status, 503, 'Stripe down: told again');
    assert.ok(down.asked.some((x) => x.url === STRIPE_REFUND_API && x.init.headers['idempotency-key'] === `shop-refund-${late.id}`));
  } finally { down.restore(); }
  let o = s.orders(me).find((x) => x.id === late.id);
  assert.deepEqual([o.status, o.refund, o.refund_owed], ['refunded', 'held', 1], 'owed while Stripe has not taken it');
  assert.equal((await shopDemand(s.env.DB, {}, Math.floor(Date.now() / 1000), 5)).refundsOwed[0]?.order, late.id, 'the staff see it owed');
  const up = stripe();
  try {
    assert.equal((await s.hook('checkout.session.completed', { payment_status: 'paid', metadata: { order: late.id }, payment_intent: 'pi_twice', amount_subtotal: 1, currency: 'usd' })).status, 200, 'Stripe\'s word again: asked again');
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

// ── S5, S6, S10: WHAT A SEASON SELLS ────────────────────────────────

test('AUDIT-STOREFRONT S5 a booster a stronger one makes worth nothing is not sold to that account - the card marks it, its page refuses, the client reads no Buy; one with levels still is (mutants: the Cog sold beside the Heart; the Tonal refused)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  assert.equal(shopSpent({ shop_held: 'boost:s1heart' }, 'boost:s1cog'), true);
  assert.equal(shopSpent({ shop_held: 'boost:s1heart' }, 'boost:s1tonal'), false, 'the Tonal still gives three levels');
  assert.equal(shopSpent({ shop_held: 'boost:s1cog' }, 'boost:s1heart'), false);
  assert.equal(shopSpent({ shop_held: 'bundle:seasonalcollector' }, 'boost:s1cog'), true, 'the Collector\'s Heart counts');
  const s = await stand();
  const me = await s.registered('Booster');
  const ticket = new URL((await s.account(me)).shop.wares.find((w) => w.id === 'boost:s1cog').buy).searchParams.get('t');
  assert.equal((await s.buy(me, 'boost:s1heart')).applied, 1);
  const cog = (await s.account(me)).shop.wares.find((w) => w.id === 'boost:s1cog');
  assert.deepEqual([cog.held, cog.spent, cog.buy], [false, true, null]);
  assert.deepEqual(clientCard({ on: true, wares: [{ ...cog, buy: 'https://x.invalid/b' }] }).wares[0].buy, null, 'the client never draws a Buy for it');
  const page = await s.fetch(`https://accounts.invalid/v1/shop/buy?t=${encodeURIComponent(ticket)}`);
  assert.equal(page.status, 409);
  assert.match(await page.text(), /stronger booster/);
  const pressed = await s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() });
  assert.equal(pressed.status, 400);
  assert.match(await pressed.text(), /stronger booster/, 'and its press opens no page');
  assert.equal(typeof (await s.account(me)).shop.wares.find((w) => w.id === 'boost:s1tonal').buy, 'string');
});

test('AUDIT-STOREFRONT S6 a season\'s wares are sold only while PASS_OPEN is on - off or dev, no Buy and not on the card; S10 a season\'s ware paid after its season is refunded, not granted (mutants: the pass sold while its finds are shut; a booster granted after the season)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  for (const sw of ['off', 'dev']) {
    const s = await stand({ ...ON, PASS_OPEN: sw });
    const me = await s.registered(`Shut${sw}`);
    const card = (await s.account(me)).shop;
    assert.deepEqual(card.wares.filter((w) => SHOP_WARES.find((x) => x.id === w.id).season), [], `PASS_OPEN ${sw}: none told`);
    assert.ok(card.wares.some((w) => w.id === 'kill:pyre'), 'the rest sold as ever');
  }
  const s = await stand();
  const me = await s.registered('Late');
  const o = await s.open(me, 'boost:s1cog');
  t.mock.timers.setTime(S1.toMs + 60_000);
  const st = stripe();
  try {
    assert.deepEqual(await s.paid(o, st), { ok: true, applied: 0 });
    assert.equal(st.asked.filter((x) => x.url === STRIPE_REFUND_API).length, 1);
  } finally { st.restore(); }
  const row = s.orders(me).find((x) => x.id === o.id);
  assert.deepEqual([row.status, row.refund, row.refund_owed], ['refunded', 'late', 0]);
  assert.ok(!shopHeldIds(s.rowOf(me)).includes('boost:s1cog'));
  assert.match(s.letters(me).at(-1).body, /season ended before this payment/);
});

test('AUDIT-STOREFRONT S12 the confirm page says a giver held in part - the Premium inside the Collector\'s Deluxe (mutants: a lower price with no word why)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Partial');
  assert.equal((await s.buy(me, 'pass:s1premium')).applied, 1);
  const ticket = new URL((await s.account(me)).shop.wares.find((w) => w.id === 'bundle:seasonalcollector').buy).searchParams.get('t');
  const html = await (await s.fetch(`https://accounts.invalid/v1/shop/buy?t=${encodeURIComponent(ticket)}`)).text();
  assert.match(html, /holds part of it already, so the price is less/);
});

// ── S7: TWO GRANTS AT ONCE ──────────────────────────────────────────

test('AUDIT-STOREFRONT S7 the Deluxe Pass and the Seasonal Collector paid at the same moment add the Deluxe\'s levels once - the second grant, refused by its row guard, is decided again on the row the first wrote (mutants: the guard dropped; the retry dropped)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Racer');
  const deluxe = await s.open(me, 'pass:s1deluxe'), coll = await s.open(me, 'bundle:seasonalcollector');
  const ctx = { db: s.env.DB, nowS: Math.floor(Date.now() / 1000) };
  const st = stripe();
  let rs;
  try {
    rs = await Promise.all([deluxe, coll].map((o) => fulfilOrder(ctx, o.id, { intent: `pi_${o.id}`, amount: o.cents, currency: 'usd' }, { env: ON, fetch: globalThis.fetch })));
  } finally { st.restore(); }
  assert.deepEqual(rs.map((r) => r.applied), [1, 1]);
  assert.equal(s.rowOf(me).pass_s1, (5 + 8) * PASS_XP_PER_LEVEL, 'the Deluxe\'s five once, the Heart\'s eight');
  assert.deepEqual(s.rowOf(me).shop_held.split(' ').sort(), ['bundle:seasonalcollector', 'pass:s1deluxe']);
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
