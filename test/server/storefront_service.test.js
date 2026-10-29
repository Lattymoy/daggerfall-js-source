// STOREFRONT (2026-10-29, the owner's monetization sheet; bible/06-Systems/Storefront.md, bible/06-Systems/Battle-Pass.md).
// The service's side of the storefront, driven end to end through the real Worker on node:sqlite (test/accountDb.mjs): a
// bundle's price for an account that holds part of it and its grant, the Deluxe Pass's levels and a booster's share,
// the launch windows and a limited ware, the effects worn and refused, the pass's finds - the day's bounds, the stage's
// challenges paid once - and the shop's demand read. Stripe is stood in for, as the SHOP tests stand it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import { fulfilOrder, shopCardOf, STRIPE_API } from '../../server-account/src/shop.js';
import { shopDemand, DEMAND_DAYS_MAX } from '../../server-account/src/staffShop.js';
import { passOf, findPass, BATTLE_PASS_STATUS, passSwitchOf } from '../../server-account/src/battlePass.js';
import { effectsHeld, effectRefusal } from '../../server-account/src/titles.js';
import { ECON_ROUTES } from '../../server-account/src/staffEconomy.js';
import { ROUTES } from '../../server-account/src/service.js';
import {
  SHOP_WARES, shopPriceFor, shopWorth, shopHeldIds, shopOwns, shopFeaturedOf, shopFeaturedNow, shopSellable, shopOnSaleOf, SHOP_MIN_CENTS,
} from '../../src/net/shopLaw.js';
import { PASS_DAY_XP, PASS_DAY_ASKS, PASS_XP_PER_LEVEL, PASS_CHALLENGES, passLevelOf, passSeasonById, passCardOf } from '../../src/net/battlePassLaw.js';

const SOLD = SHOP_WARES.filter((w) => w.alone);
const ON = { STRIPE_SECRET_KEY: 'sk_test_sf', STRIPE_WEBHOOK_SECRET: 'whsec_sf', SHOP_ON_SALE: SOLD.map((w) => w.id).join(','), PASS_OPEN: 'on' };
const S1 = passSeasonById('s1');
const IN_TREMOR = S1.fromMs + 3 * 86_400_000 + 3_600_000;   // the first stage's fourth day
const BEFORE = S1.fromMs - 5 * 86_400_000;

function stripe() {
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async (url) => {
    if (String(url) === STRIPE_API) { n++; return Response.json({ id: `cs_sf_${n}`, url: `https://checkout.stripe.com/c/pay/cs_sf_${n}` }); }
    throw new Error(`no stand-in for ${url}`);
  };
  return { restore: () => { globalThis.fetch = real; } };
}
async function stand(extra = ON) {
  const s = await standService(extra);
  const get = (path, who) => s.fetch(`https://accounts.invalid${path}`, { headers: { authorization: `Bearer ${who.secret}` } });
  const post = async (path, who, body) => { const r = await s.fetch(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const account = async (who) => (await get('/v1/account', who)).json();
  const press = (ticket) => s.fetch('https://accounts.invalid/v1/shop/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }).toString() });
  const ticketOf = async (who, id) => new URL((await account(who)).shop.wares.find((w) => w.id === id).buy).searchParams.get('t');
  const raw = s.env.DB._raw;
  const rowOf = (who) => raw.prepare('SELECT shop_wares, shop_held, effects, pass_s1 FROM players WHERE id = ?').get(who.id);
  const orders = (who) => raw.prepare('SELECT * FROM shop_orders WHERE player = ? ORDER BY created_at').all(who.id);
  const pay = async (who, id) => {
    const st = stripe();
    try { await press(await ticketOf(who, id)); } finally { st.restore(); }
    const o = orders(who).find((x) => x.ware === id && x.status === 'open');
    return fulfilOrder({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) }, o.id, { intent: `pi_${o.id}`, amount: o.cents, currency: 'usd' });
  };
  const hook = (object) => {
    const body = JSON.stringify({ id: 'evt_sf', type: 'checkout.session.completed', data: { object } }), t = Math.floor(Date.now() / 1000);
    return s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
  };
  return { ...s, get, post, account, ticketOf, rowOf, orders, pay, hook, raw };
}

// ── THE LAW ─────────────────────────────────────────────────────────

test('STOREFRONT the law: a bundle\'s worth is what it gives; its price for an account is cut by the share of it held, never under Stripe\'s floor, and nothing once all of it is held; a giver held holds what it gives (mutants: the price never cut; the floor dropped; a held bundle sold again)', () => {
  assert.equal(shopWorth('bundle:daedricchampion'), 2499 + 2999 + 2499 + 499, 'Daedric Dominion, the Pyre, Eternal Champion, the Oblivion Sigil');
  assert.equal(shopWorth('bundle:lordofoblivion'), 5999 + 2999 + 2499 + 2999);
  assert.equal(shopWorth('pass:s1deluxe'), 2999 + 2000, 'the Premium Pass and its own');
  assert.equal(shopPriceFor({}, 'bundle:daedricchampion'), 5999);
  const pyre = { shop_held: 'kill:pyre' };
  assert.equal(shopPriceFor(pyre, 'bundle:daedricchampion'), Math.round(5999 * (8496 - 2999) / 8496), 'the Pyre held: its share taken off');
  assert.equal(shopPriceFor({ shop_held: 'kill:pyre aura:dominion title:eternalchampion' }, 'bundle:daedricchampion'), Math.max(SHOP_MIN_CENTS, Math.round(5999 * 499 / 8496)));
  assert.equal(shopPriceFor({ shop_held: 'bundle:daedricchampion' }, 'bundle:daedricchampion'), null, 'held: not sold again');
  assert.equal(shopPriceFor({ shop_held: 'kill:pyre aura:dominion title:eternalchampion glyph:oblivion' }, 'bundle:daedricchampion'), null, 'all it gives held: not sold again');
  assert.ok(shopOwns({ shop_held: 'bundle:lordofoblivion' }, 'portal:daedric'), 'a bundle held holds its portal skin');
  assert.deepEqual(shopHeldIds({ shop_held: 'bundle:seasonalcollector' }).filter((id) => id.startsWith('pass') || id.startsWith('boost')), ['pass:s1premium', 'pass:s1deluxe', 'boost:s1heart'], 'the Collector holds the Deluxe, the Premium it holds, and the Heart Booster');
  assert.equal(shopPriceFor({ shop_held: 'pass:s1premium' }, 'pass:s1deluxe'), Math.round(4999 * 2000 / 4999), 'the Premium held: the Deluxe for its own share');
  assert.equal(shopPriceFor({ shop_held: 'glyph:oblivion' }, 'kill:pyre'), 2999, 'a ware that gives nothing is its own price');
  // every giver, with every part of what it gives held: a price between Stripe's floor and its own, or none once all is
  for (const w of SHOP_WARES.filter((x) => x.gives.length)) {
    for (let mask = 0; mask < 1 << w.gives.length; mask++) {
      const held = w.gives.filter((_, i) => mask & (1 << i));
      const price = shopPriceFor({ shop_held: held.filter((id) => !SHOP_WARES.find((x) => x.id === id)?.bit).join(' '), shop_wares: held.reduce((a, id) => a | (SHOP_WARES.find((x) => x.id === id)?.bit ?? 0), 0) }, w.id);
      if (held.length === w.gives.length && !w.extra) assert.equal(price, null, `${w.id}: all it gives held`);
      else assert.ok(price >= SHOP_MIN_CENTS && price <= w.cents, `${w.id} holding ${held.join(',') || 'nothing'}: ${price}`);
    }
  }
  assert.deepEqual(shopOnSaleOf('glyph:oblivion,aura:dominion,kill:pyre'), ['kill:pyre'], 'a bundle\'s own wares are never sold alone');
});

test('STOREFRONT the launch windows: SHOP_FEATURED\'s lines - a ware, its first and last UTC day, `limited` - read whole or not at all; a ware with a window is never sold before its first opens; a limited one only inside a limited window; the season\'s wares only in their season (mutants: a ware sold before its drop; a limited ware sold after; the pass sold off season)', () => {
  const raw = 'kill:pyre 2026-10-30 2026-11-12\nportal:aetheric 2026-11-13 2026-11-26 limited;  bundle:portalmaster 2026-11-27 2026-12-10 limited\nnope:x 2026-11-01 2026-11-02\nkill:ashen 2026-11-05 2026-11-01\nglyph:oblivion 2026-11-01 2026-11-30\nmount:warhorse 2026-12-11 2026-12-24 forever';
  const list = shopFeaturedOf(raw);
  assert.deepEqual(list.map((e) => [e.id, e.limited]), [['kill:pyre', false], ['portal:aetheric', true], ['bundle:portalmaster', true]], 'unknown, backwards, a bundle\'s own and a stray word: refused');
  assert.equal(list[0].fromMs, Date.UTC(2026, 9, 30));
  assert.equal(list[0].toMs, Date.UTC(2026, 10, 13), 'the last day inside');
  const onSale = SOLD.map((w) => w.id), at = (id, y, m, d) => shopSellable(SHOP_WARES.find((w) => w.id === id), onSale, list, Date.UTC(y, m, d, 12));
  assert.equal(at('kill:pyre', 2026, 9, 29), false, 'before its drop');
  assert.equal(at('kill:pyre', 2026, 9, 30), true);
  assert.equal(at('kill:pyre', 2027, 0, 1), true, 'a drop not limited stays on sale');
  assert.equal(at('portal:aetheric', 2026, 10, 20), true);
  assert.equal(at('portal:aetheric', 2026, 10, 27), false, 'a limited ware, after its window');
  assert.equal(at('kill:ashen', 2026, 9, 20), true, 'a ware with no window is sold as SHOP_ON_SALE says');
  assert.equal(at('pass:s1premium', 2026, 10, 9), false, 'the pass before its season');
  assert.equal(at('pass:s1premium', 2026, 10, 10), true);
  assert.equal(at('boost:s1heart', 2027, 0, 9), false, 'nor after it');
  assert.deepEqual(shopFeaturedNow(list, Date.UTC(2026, 10, 12, 12)).map((e) => e.id), ['kill:pyre']);
  assert.deepEqual(shopFeaturedNow(list, Date.UTC(2026, 10, 14)).map((e) => e.id), ['portal:aetheric'], 'the pyre\'s window ended on the 12th');
});

// ── END TO END ──────────────────────────────────────────────────────

test('STOREFRONT end to end: a bundle bought by an account holding part of it - its page and Stripe priced for that account, the grant writing what it gives by id, its pieces held and worn; the Deluxe adds its levels to the season once (mutants: the list price charged; a piece written twice; the levels added on a second word)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Collector');
  assert.equal((await s.pay(me, 'kill:pyre')).applied, 1);
  let card = (await s.account(me)).shop;
  assert.equal(card.wares.find((w) => w.id === 'bundle:daedricchampion').cents, shopPriceFor({ shop_held: 'kill:pyre' }, 'bundle:daedricchampion'), 'the account\'s own price on its card');
  assert.equal((await s.pay(me, 'bundle:daedricchampion')).applied, 1);
  const o = s.orders(me).find((x) => x.ware === 'bundle:daedricchampion');
  assert.equal(o.cents, shopPriceFor({ shop_held: 'kill:pyre' }, 'bundle:daedricchampion'), 'charged what its card said');
  assert.deepEqual(s.rowOf(me).shop_held.split(' ').sort(), ['bundle:daedricchampion', 'kill:pyre']);
  const a = await s.account(me);
  assert.ok(a.wardrobe.auras.includes('dominion') && a.wardrobe.titles.includes('eternalchampion') && a.wardrobe.glyphs.includes('oblivion'), 'what it gives, held');
  assert.equal(a.shop.wares.find((w) => w.id === 'bundle:daedricchampion').held, true);
  card = a.shop;
  assert.equal(card.wares.find((w) => w.id === 'kill:pyre').held, true);
  // the Deluxe Pass: its five levels added once, its Premium held
  assert.equal(s.rowOf(me).pass_s1, 0);
  assert.equal((await s.pay(me, 'pass:s1deluxe')).applied, 1);
  assert.equal(s.rowOf(me).pass_s1, 5 * PASS_XP_PER_LEVEL);
  const pass = (await s.account(me)).pass;
  assert.deepEqual(pass.tracks, { free: true, premium: true, deluxe: true });
  assert.equal(pass.level, 5);
  assert.ok((await s.account(me)).wardrobe.titles.includes('numidiumecho'), 'the Deluxe\'s own title, at once');
  const deluxe = s.orders(me).find((x) => x.ware === 'pass:s1deluxe');
  assert.equal((await fulfilOrder({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) }, deluxe.id, { intent: 'again', amount: deluxe.cents, currency: 'usd' })).applied, 0, 'told twice, granted once');
  assert.equal(s.rowOf(me).pass_s1, 5 * PASS_XP_PER_LEVEL, 'its levels once');
});

test('STOREFRONT end to end: a launch window on the card - a featured ware leads the carousel with its window\'s end, a limited ware off sale once its window ends; nothing featured before its window (mutants: the carousel showing a drop to come; a limited ware sold after)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
  const s = await stand({ ...ON, SHOP_FEATURED: 'portal:aetheric 2026-11-13 2026-11-26 limited\nmount:warhorse 2026-12-11 2026-12-24' });
  const me = await s.registered('Watcher');
  let card = (await s.account(me)).shop;
  assert.deepEqual(card.featured, ['pass:s1premium', 'pass:s1deluxe', 'portal:aetheric'], 'the season\'s passes, then the window open now - never the warhorse to come');
  const aeth = card.wares.find((w) => w.id === 'portal:aetheric');
  assert.deepEqual([aeth.sale, aeth.limited, aeth.until], [true, true, Date.UTC(2026, 10, 27)]);
  assert.equal(card.wares.find((w) => w.id === 'mount:warhorse').sale, false, 'not sold before its drop');
  t.mock.timers.setTime(Date.UTC(2026, 10, 28, 12));
  card = (await s.account(me)).shop;
  assert.equal(card.wares.find((w) => w.id === 'portal:aetheric').sale, false, 'its window ended: no longer sold');
  assert.equal(card.wares.find((w) => w.id === 'portal:aetheric').buy, null);
});

test('STOREFRONT end to end: an effect is worn only when held - the door refuses one not held and one of another slot, writes the kit, and the next token carries it; a held effect read off a bundle (mutants: an effect worn unheld; the kit never on the token)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Wearer');
  assert.equal((await s.post('/v1/account/effect', me, { slot: 'kill', key: 'pyre' })).status, 403, 'not held');
  assert.equal(effectRefusal('kill', 'pyre', { handle: 'x', shop_held: '' }, Math.floor(IN_TREMOR / 1000)), 'not-held');
  assert.equal(effectRefusal('kill', 'warhorse', { handle: 'x', shop_held: 'mount:warhorse' }, Math.floor(IN_TREMOR / 1000)), 'no-effect', 'a key of another slot');
  assert.equal((await s.pay(me, 'bundle:lordofoblivion')).applied, 1);
  assert.deepEqual(effectsHeld(s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id), Math.floor(IN_TREMOR / 1000)), { kill: ['pyre'], portal: ['daedric'], mount: ['warhorse'] });
  const r = await s.post('/v1/account/effect', me, { slot: 'mount', key: 'warhorse' });
  assert.equal(r.status, 200);
  assert.equal(r.body.effects, '00a');
  assert.equal((await s.post('/v1/account/effect', me, { slot: 'kill', key: 'pyre' })).body.effects, 'c0a');
  assert.equal(s.rowOf(me).effects, 'c0a');
  assert.equal((await s.post('/v1/account/effect', me, { slot: 'kill', key: null })).body.effects, '00a', 'a slot bared');
  assert.ok(ROUTES.has('/v1/account/effect'));
});

test('STOREFRONT the pass end to end: a guest refused, the season closed before its days; a find takes its source\'s experience and counts its stage\'s challenges, a challenge paid once on the deed that completes it, beside the day\'s bound; the day bounds the base, a booster\'s share on top; the card says it all (mutants: a challenge paid twice; the day unbounded; the booster ignored)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BEFORE });
  const s = await stand();
  const me = await s.registered('Player');
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  const player = () => s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id);
  assert.deepEqual(await findPass(ctx(), player(), { source: 'foe' }, ON), { error: 'closed' }, 'before its days');
  assert.equal((await passOf(ctx(), player(), ON)).season, 's1', 'the season to come is shown');
  assert.deepEqual(await findPass(ctx(), { id: 'g', handle: null }, { source: 'foe' }, ON), { error: 'guest' });
  t.mock.timers.setTime(IN_TREMOR);
  assert.deepEqual(await findPass(ctx(), player(), { source: 'nope' }, ON), { error: 'source' });
  assert.deepEqual(await findPass(ctx(), player(), { source: 'foe' }, { ...ON, PASS_OPEN: 'off' }), { error: 'closed' }, 'the switch off');
  assert.equal(passSwitchOf('maybe'), 'off');
  // the tavern challenge: three wins, paid once on the third
  const t1 = await findPass(ctx(), player(), { source: 'tavern' }, ON);
  assert.deepEqual([t1.gained, t1.done], [50, []]);
  await findPass(ctx(), player(), { source: 'tavern' }, ON);
  const t3 = await findPass(ctx(), player(), { source: 'tavern' }, ON);
  const tavern = PASS_CHALLENGES.find((c) => c.key === 'tremor-tavern');
  assert.deepEqual([t3.gained, t3.done], [50 + tavern.xp, ['tremor-tavern']], 'the third win completes it: its experience beside the find');
  const t4 = await findPass(ctx(), player(), { source: 'tavern' }, ON);
  assert.deepEqual([t4.gained, t4.done], [50, []], 'paid once');
  assert.equal(t4.xp, 4 * 50 + tavern.xp);
  // the day's bound: endgame finds (300) to the day's 2,000 - then nothing but a challenge's pay
  let last;
  for (let i = 0; i < 8; i++) last = await findPass(ctx(), player(), { source: 'endgame' }, ON);
  assert.equal(last.today, PASS_DAY_XP, 'the day full');
  assert.equal(last.capped, true);
  const before = last.xp;
  const more = await findPass(ctx(), player(), { source: 'foe' }, ON);
  assert.equal(more.gained, 0, 'past the day\'s bound: nothing');
  assert.equal(more.xp, before);
  // a booster: its share on top of the base, the next day
  t.mock.timers.setTime(IN_TREMOR + 86_400_000);
  s.raw.prepare("UPDATE players SET shop_held = 'boost:s1heart' WHERE id = ?").run(me.id);
  const boosted = await findPass(ctx(), player(), { source: 'elite' }, ON);
  assert.equal(boosted.gained, 120, 'an elite\'s 60, doubled');
  const card = passCardOf(await passOf(ctx(), player(), ON));
  assert.equal(card.mult, 2);
  assert.equal(card.today, 60, 'the day counts the base');
  assert.equal(card.level, passLevelOf(card.xp, S1, Date.now()));
  assert.equal(card.challenges.find((c) => c.key === 'tremor-tavern').paid, true);
  assert.equal(BATTLE_PASS_STATUS.capped, 429);
  assert.ok(ROUTES.has('/v1/pass/mine') && ROUTES.has('/v1/pass/find'));
  assert.equal(PASS_DAY_ASKS, 2000);
});

test('STOREFRONT the pass end to end: the open stage\'s top holds the level, the experience past it kept and counted when the next stage opens (mutants: the level past the top; the banked experience lost)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Racer');
  s.raw.prepare('UPDATE players SET pass_s1 = ? WHERE id = ?').run(25 * PASS_XP_PER_LEVEL, me.id);
  const player = () => s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id);
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  assert.deepEqual([(await passOf(ctx(), player(), ON)).level, (await passOf(ctx(), player(), ON)).top], [17, 17], 'the first stage opens seventeen levels');
  t.mock.timers.setTime(S1.stages[1].fromMs + 1000);
  assert.equal((await passOf(ctx(), player(), ON)).level, 25, 'the banked levels, counted when the halls open');
});

test('STOREFRONT the demand: a day a row over the span asked, each ware\'s orders opened, paid, refunded and disputed with the money paid, the day\'s featured windows beside them; the span bounded; an Admin\'s route (mutants: a day with no orders dropped; a refund counted as money)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
  const s = await stand({ ...ON, SHOP_FEATURED: 'kill:pyre 2026-11-18 2026-11-19' });
  const me = await s.registered('Buyer');
  await s.pay(me, 'kill:pyre');
  await s.pay(me, 'portal:runic');
  s.raw.prepare("UPDATE shop_orders SET status = 'refunded' WHERE ware = 'portal:runic'").run();
  const nowS = Math.floor(Date.now() / 1000);
  const d = await shopDemand(s.env.DB, { SHOP_FEATURED: 'kill:pyre 2026-11-18 2026-11-19' }, nowS, 5);
  assert.equal(d.days.length, 5, 'a row a day, none dropped');
  assert.deepEqual(d.days.map((r) => r.featured), [[], [], ['kill:pyre'], ['kill:pyre'], []]);
  const today = d.days.at(-1).wares;
  assert.deepEqual(today['kill:pyre'], { opened: 1, paid: 1, refunded: 0, disputed: 0, cents: 2999 });
  assert.deepEqual(today['portal:runic'], { opened: 1, paid: 1, refunded: 1, disputed: 0, cents: 0 }, 'a refund paid first, its money not counted');
  assert.equal(d.totals['kill:pyre'].cents, 2999);
  assert.equal((await shopDemand(s.env.DB, {}, nowS, 9999)).days.length, DEMAND_DAYS_MAX);
  assert.ok(ECON_ROUTES.includes('/v1/staff/econ/shop'));
  assert.equal(d.names['kill:pyre'], 'Daedric Pyre');
});
