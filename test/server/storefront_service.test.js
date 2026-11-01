// STOREFRONT (2026-10-29, the owner's monetization sheet; bible/06-Systems/Storefront.md, bible/06-Systems/Battle-Pass.md).
// The service's side of the storefront, driven end to end through the real Worker on node:sqlite (test/accountDb.mjs): a
// bundle's price for an account that holds part of it and its grant, the launch windows and a limited ware, the effects
// worn and refused, the pass's finds - their Aurum under the day's bound, the stage's challenges paid once - and the
// shop's demand read. Stripe is stood in for, as the SHOP tests stand it. PASS-PANELS: the tracks' own are
// test/server/passpanels_service.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { standService } from '../accountDb.mjs';
import { legacyOrder } from './legacyOrders.mjs';   // AURUM-ONLY: an item's money order, made before the switch
import { fulfilOrder, shopCardOf, STRIPE_API } from '../../server-account/src/shop.js';
import { shopDemand, DEMAND_DAYS_MAX } from '../../server-account/src/staffShop.js';
import { dailyWaresAt, dailySaleOf } from '../../server-account/src/aurum.js';   // AURUM: the day's wares beside the demand
import { passOf, findPass, BATTLE_PASS_STATUS, passSwitchOf } from '../../server-account/src/battlePass.js';
import { effectsHeld, effectRefusal } from '../../server-account/src/titles.js';
import { ECON_ROUTES } from '../../server-account/src/staffEconomy.js';
import { ROUTES } from '../../server-account/src/service.js';
import {
  SHOP_WARES, shopPriceFor, shopWorth, shopHeldIds, shopOwns, shopFeaturedOf, shopFeaturedNow, shopSellable, shopDropped, shopOnSaleOf, SHOP_MIN_PRICE,
  shopWhenOf, SHOP_CHECKOUT_MS,
} from '../../src/net/shopLaw.js';
import { PASS_DAY_AURUM, PASS_DAY_ASKS, PASS_CHALLENGES, passSeasonById, passCardOf } from '../../src/net/battlePassLaw.js';

const SOLD = SHOP_WARES.filter((w) => w.alone);
const ON = { STRIPE_SECRET_KEY: 'sk_test_sf', STRIPE_WEBHOOK_SECRET: 'whsec_sf', SHOP_ON_SALE: SOLD.map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };
const S1 = passSeasonById('s1');
const IN_TREMOR = S1.fromMs + 3 * 86_400_000 + 3_600_000;   // the first stage's fourth day
const BEFORE = S1.tracksFromMs - 86_400_000;

let sessions = 0;   // a session id Stripe never gives twice (the column is UNIQUE: a stand-in counting from one each call broke a second order)
function stripe() {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === STRIPE_API) { const n = ++sessions; return Response.json({ id: `cs_sf_${n}`, url: `https://checkout.stripe.com/c/pay/cs_sf_${n}` }); }
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
  const rowOf = (who) => raw.prepare('SELECT shop_wares, shop_held, effects, pass_items FROM players WHERE id = ?').get(who.id);
  const orders = (who) => raw.prepare('SELECT * FROM shop_orders WHERE player = ? ORDER BY created_at').all(who.id);
  // AURUM-ONLY (PIN MOVED): an item's money order is one made before the switch, paid at its old cents
  const pay = async (who, id, cents) => {
    const o = legacyOrder(raw, who, id, { cents });
    return fulfilOrder({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) }, o.id, { intent: `pi_${o.id}`, amount: o.cents, currency: 'usd' });
  };
  /** AURUM-ONLY: Aurum given (a cache's line), and a ware bought with it in the window's way - at `price` if the page said one. */
  const gift = (who, n) => raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'cache', ?, ?, 0, 0)").run(who.id, `gift-${n}-${Math.random()}`, n);
  const buy = (who, ware, price) => post('/v1/aurum/buy', who, { ware, ...(price === undefined ? {} : { price }) });
  const hook = (object) => {
    const body = JSON.stringify({ id: 'evt_sf', type: 'checkout.session.completed', data: { object } }), t = Math.floor(Date.now() / 1000);
    return s.fetch('https://accounts.invalid/v1/shop/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${createHmac('sha256', ON.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}` } });
  };
  return { ...s, get, post, account, ticketOf, rowOf, orders, pay, gift, buy, hook, raw, press, stripe };
}

// ── THE LAW ─────────────────────────────────────────────────────────

test('STOREFRONT the law: a bundle\'s worth is what it gives; its price for an account is cut by the share of it held, never under its floor (PIN MOVED, AURUM-ONLY: in Aurum, SHOP_MIN_PRICE), and nothing once all of it is held; a giver held holds what it gives (mutants: the price never cut; the floor dropped; a held bundle sold again)', () => {
  // PIN MOVED (AUDIT-STOREFRONT II): every price under SHOP_PRICE_CAP, the bundle's arithmetic the same; PIN MOVED (AURUM-ONLY): in Aurum
  assert.equal(shopWorth('bundle:daedricchampion'), 1500 + 1500 + 1000 + 300, 'Daedric Dominion, the Pyre, Eternal Champion, the Oblivion Sigil');
  assert.equal(shopWorth('bundle:lordofoblivion'), 2500 + 1300 + 1500 + 1500);
  assert.equal(shopPriceFor({}, 'bundle:daedricchampion'), 2800);
  const pyre = { shop_held: 'kill:pyre' };
  assert.equal(shopPriceFor(pyre, 'bundle:daedricchampion'), Math.round(2800 * (4300 - 1500) / 4300), 'the Pyre held: its share taken off');
  assert.equal(shopPriceFor({ shop_held: 'kill:pyre aura:dominion title:eternalchampion' }, 'bundle:daedricchampion'), Math.max(SHOP_MIN_PRICE, Math.round(2800 * 300 / 4300)));
  assert.equal(shopPriceFor({}, 'aurum:500'), null, 'AURUM-ONLY: a pack has no Aurum price - its price is its cents');
  assert.equal(shopPriceFor({ shop_held: 'bundle:daedricchampion' }, 'bundle:daedricchampion'), null, 'held: not sold again');
  assert.equal(shopPriceFor({ shop_held: 'kill:pyre aura:dominion title:eternalchampion glyph:oblivion' }, 'bundle:daedricchampion'), null, 'all it gives held: not sold again');
  assert.ok(shopOwns({ shop_held: 'bundle:lordofoblivion' }, 'portal:daedric'), 'a bundle held holds its portal skin');
  assert.deepEqual(shopHeldIds({ shop_held: 'bundle:portalmaster' }).sort(), ['aura:dominion', 'bundle:portalmaster', 'glyph:gatesigil', 'portal:daedric'], 'a bundle held holds what it gives');
  assert.equal(shopPriceFor({ shop_held: 'glyph:oblivion' }, 'kill:pyre'), 1500, 'a ware that gives nothing is its own price');
  // every giver, with every part of what it gives held: a price between its floor and its own, or none once all is
  for (const w of SHOP_WARES.filter((x) => x.gives.length)) {
    for (let mask = 0; mask < 1 << w.gives.length; mask++) {
      const held = w.gives.filter((_, i) => mask & (1 << i));
      const price = shopPriceFor({ shop_held: held.filter((id) => !SHOP_WARES.find((x) => x.id === id)?.bit).join(' '), shop_wares: held.reduce((a, id) => a | (SHOP_WARES.find((x) => x.id === id)?.bit ?? 0), 0) }, w.id);
      if (held.length === w.gives.length) assert.equal(price, null, `${w.id}: all it gives held`);
      else assert.ok(price >= SHOP_MIN_PRICE && price <= w.price, `${w.id} holding ${held.join(',') || 'nothing'}: ${price}`);
    }
  }
  assert.deepEqual(shopOnSaleOf('glyph:oblivion,aura:dominion,kill:pyre'), ['kill:pyre'], 'a bundle\'s own wares are never sold alone');
});

test('STOREFRONT the launch windows: SHOP_FEATURED\'s lines - a ware, its first and last UTC day, `limited` - read whole or not at all; OPEN-ALL a window that is not limited holds no sale back; a limited one only inside a limited window; a line that names a ware but does not read shuts its sale (mutants: a window holding a sale back; a limited ware sold before or after; a bad line opening the sale)', () => {
  const raw = 'kill:pyre 2026-10-30 2026-11-12\nportal:aetheric 2026-11-13 2026-11-26 limited;  bundle:portalmaster 2026-11-27 2026-12-10 limited\nnope:x 2026-11-01 2026-11-02\nkill:ashen 2026-11-05 2026-11-01\nglyph:oblivion 2026-11-01 2026-11-30\nmount:warhorse 2026-12-11 2026-12-24 forever';
  const list = shopFeaturedOf(raw);
  // AUDIT-STOREFRONT S4 (PIN MOVED: the three lines that named a ware were dropped, so their wares sold with no window at all)
  assert.deepEqual(list.filter((e) => !e.bad).map((e) => [e.id, e.limited]), [['kill:pyre', false], ['portal:aetheric', true], ['bundle:portalmaster', true]], 'unknown, backwards, a bundle\'s own and a stray word: refused');
  assert.deepEqual(list.filter((e) => e.bad).map((e) => e.id), ['kill:ashen', 'glyph:oblivion', 'mount:warhorse'], 'a line naming a ware that does not read is kept, to shut it');
  assert.equal(list[0].fromMs, Date.UTC(2026, 9, 30));
  assert.equal(list[0].toMs, Date.UTC(2026, 10, 13), 'the last day inside');
  const onSale = SOLD.map((w) => w.id), at = (id, y, m, d) => shopSellable(SHOP_WARES.find((w) => w.id === id), onSale, list, Date.UTC(y, m, d, 12));
  assert.equal(at('kill:pyre', 2026, 9, 29), true, 'before its window: sold - a window only features it');   // PIN MOVED (OPEN-ALL): it was held back until its first window
  assert.equal(at('portal:aetheric', 2026, 10, 12), false, 'a limited ware, before its window');
  const told = (id, y, m, d) => shopDropped(SHOP_WARES.find((w) => w.id === id), list, Date.UTC(y, m, d, 12));
  assert.deepEqual([told('kill:pyre', 2026, 9, 29), told('portal:aetheric', 2026, 10, 12), told('portal:aetheric', 2026, 10, 13)], [true, false, true], 'OPEN-ALL: told before its window unless limited - the daily deals draw from it too (aurum.js dailySaleOf)');
  assert.equal(dailySaleOf({ SHOP_ON_SALE: 'kill:pyre', SHOP_FEATURED: raw }).eligible('kill:pyre', Date.UTC(2026, 9, 29) / 86_400_000), true, 'a daily deal before its window');
  assert.equal(at('kill:pyre', 2026, 9, 30), true);
  assert.equal(at('kill:pyre', 2027, 0, 1), true, 'a drop not limited stays on sale');
  assert.equal(at('portal:aetheric', 2026, 10, 20), true);
  assert.equal(at('portal:aetheric', 2026, 10, 27), false, 'a limited ware, after its window');
  assert.equal(at('title:genesis', 2026, 9, 20), true, 'a ware with no window is sold as SHOP_ON_SALE says');
  assert.equal(at('kill:ashen', 2026, 10, 3), false, 'a ware whose line does not read is not sold - a typo never opens a sale');
  assert.equal(at('mount:warhorse', 2027, 0, 1), false);
  assert.equal(shopFeaturedNow(list, Date.UTC(2026, 10, 3)).some((e) => e.bad), false, 'nor featured');
  assert.deepEqual(shopFeaturedNow(list, Date.UTC(2026, 10, 12, 12)).map((e) => e.id), ['kill:pyre']);
  assert.deepEqual(shopFeaturedNow(list, Date.UTC(2026, 10, 14)).map((e) => e.id), ['portal:aetheric'], 'the pyre\'s window ended on the 12th');
});

test('STOREFRONT the schedule\'s dates read strictly - a date that rolls over is no date, never a later one; and every line of the deploy\'s own SHOP_FEATURED reads whole (mutants: 31 November read as 1 December; a 13th month read as January; a bad live line)', () => {
  assert.equal(shopWhenOf('2026-11-10'), Date.UTC(2026, 10, 10));
  assert.equal(shopWhenOf('2026-11-10', true), Date.UTC(2026, 10, 11), 'a day\'s end is the next day\'s first moment');
  assert.equal(shopWhenOf('2026-11-10T18:00Z'), Date.UTC(2026, 10, 10, 18));
  assert.equal(shopWhenOf('2026-11-10T18:00Z', true), Date.UTC(2026, 10, 10, 18), 'an exact time is its own end');
  for (const bad of ['2026-11-31', '2026-13-05', '2026-00-05', '2026-02-29', '2026-11-31T10:00Z', '2026-11-10T24:00Z', '2026-11-10T10:60Z', '2026-11-10T10:00:61Z', '26-11-10', '2026-11-10 ', '']) {
    assert.ok(Number.isNaN(shopWhenOf(bad)), `${JSON.stringify(bad)} is no date`);
  }
  assert.equal(shopWhenOf('2028-02-29'), Date.UTC(2028, 1, 29), 'a leap day is a day');
  const toml = readFileSync(new URL('../../server-account/wrangler.toml', import.meta.url), 'utf8');
  const live = /^SHOP_FEATURED = """\n([\s\S]*?)"""/m.exec(toml)?.[1] ?? '';
  const lines = live.split('\n').filter((l) => l.trim());
  assert.ok(lines.length > 0, 'the deploy has a schedule');
  assert.equal(shopFeaturedOf(live).length, lines.length, 'every live line names a ware');
  assert.deepEqual(shopFeaturedOf(live).filter((e) => e.bad).map((e) => e.id), [], 'and reads whole');
});

// ── END TO END ──────────────────────────────────────────────────────

test('STOREFRONT end to end: a bundle bought by an account holding part of it - its card and its buy priced for that account (PIN MOVED, AURUM-ONLY: in Aurum, bought from the window), the grant writing what it gives by id, its pieces held and worn; bought again, held and nothing spent twice (mutants: the list price charged; a piece written twice)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Collector');
  s.gift(me, 10_000);
  assert.equal((await s.buy(me, 'kill:pyre')).status, 200);
  let card = (await s.account(me)).shop;
  const price = shopPriceFor({ shop_held: 'kill:pyre' }, 'bundle:daedricchampion');
  assert.ok(price < shopPriceFor({}, 'bundle:daedricchampion'), 'the Pyre held: less');
  assert.equal(card.wares.find((w) => w.id === 'bundle:daedricchampion').price, price, 'the account\'s own price on its card');
  const r = await s.buy(me, 'bundle:daedricchampion', price);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.spent, price, 'charged what its card said');
  assert.deepEqual(s.rowOf(me).shop_held.split(' ').sort(), ['bundle:daedricchampion', 'kill:pyre']);
  const a = await s.account(me);
  assert.ok(a.wardrobe.auras.includes('dominion') && a.wardrobe.titles.includes('eternalchampion') && a.wardrobe.glyphs.includes('oblivion'), 'what it gives, held');
  assert.equal(a.shop.wares.find((w) => w.id === 'bundle:daedricchampion').held, true);
  card = a.shop;
  assert.equal(card.wares.find((w) => w.id === 'kill:pyre').held, true);
  assert.deepEqual((await s.buy(me, 'bundle:daedricchampion', price)).body, { error: 'aurum-held' }, 'bought again: held');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM aurum_ledger WHERE account = ? AND kind = 'buy' AND ref = 'bundle:daedricchampion'").get(me.id).n, 1, 'spent once');
  assert.deepEqual(s.rowOf(me).shop_held.split(' ').sort(), ['bundle:daedricchampion', 'kill:pyre'], 'nothing written twice');
});

test('STOREFRONT end to end: a launch window on the card - a featured ware leads the carousel with its window\'s end, a limited ware off sale once its window ends; nothing featured before its window, a limited ware not told before it, OPEN-ALL a ware not limited sold before it, and a window\'s end only beside a sale (mutants: the carousel showing a drop to come; a limited ware sold after; a drop to come on the card; an ended window still told; a window holding a sale back)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
  const s = await stand({ ...ON, SHOP_ON_SALE: ON.SHOP_ON_SALE.replace('mount:spectral,', ''), SHOP_FEATURED: 'portal:aetheric 2026-11-13 2026-11-26 limited\nmount:warhorse 2026-12-11 2026-12-24 limited\nmount:spectral 2026-11-13 2026-11-26\nmount:dawnfire 2026-12-11 2026-12-24' });   // PIN MOVED (OPEN-ALL): the warhorse limited, so a drop is still held back
  const me = await s.registered('Watcher');
  let card = (await s.account(me)).shop;
  assert.deepEqual(card.featured, ['portal:aetheric'], 'the window open now - never the warhorse to come (PASS-PANELS: no pass leads it, the pass is no ware)');
  const ghost = card.wares.find((w) => w.id === 'mount:spectral');
  assert.deepEqual([ghost.sale, ghost.until, ghost.limited], [false, undefined, undefined], 'AUDIT-STOREFRONT S9: featured now but off the sale list - its window not told');
  const aeth = card.wares.find((w) => w.id === 'portal:aetheric');
  assert.deepEqual([aeth.sale, aeth.limited, aeth.until], [true, true, Date.UTC(2026, 10, 27)]);
  // AUDIT-STOREFRONT S2 (PIN MOVED: it stood on the card unsold, and the window called it "No longer sold")
  assert.equal(card.wares.find((w) => w.id === 'mount:warhorse'), undefined, 'a limited ware: not sold, nor told, before its drop');
  const dawn = card.wares.find((w) => w.id === 'mount:dawnfire');
  assert.deepEqual([dawn?.sale, dawn?.until], [true, undefined], 'OPEN-ALL: not limited, sold before its window, which is not told');
  t.mock.timers.setTime(Date.UTC(2026, 10, 28, 12));
  card = (await s.account(me)).shop;
  assert.equal(card.wares.find((w) => w.id === 'portal:aetheric').sale, false, 'its window ended: no longer sold');
  assert.equal(card.wares.find((w) => w.id === 'portal:aetheric').buy ?? null, null);   // PIN MOVED (AURUM-ONLY): an item carries no link at all
  assert.deepEqual([card.wares.find((w) => w.id === 'portal:aetheric').until, card.wares.find((w) => w.id === 'portal:aetheric').limited], [undefined, undefined], 'AUDIT-STOREFRONT S9: an ended window is not told beside it');
  t.mock.timers.setTime(Date.UTC(2026, 11, 12, 12));
  assert.equal((await s.account(me)).shop.wares.find((w) => w.id === 'mount:warhorse').sale, true, 'its drop landed: told and sold');
});

test('STOREFRONT end to end: an effect is worn only when held - the door refuses one not held and one of another slot, writes the kit, and the next token carries it; a held effect read off a bundle (mutants: an effect worn unheld; the kit never on the token)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Wearer');
  assert.equal((await s.post('/v1/account/effect', me, { slot: 'kill', key: 'pyre' })).status, 403, 'not held');
  assert.equal(effectRefusal('kill', 'pyre', { handle: 'x', shop_held: '' }, Math.floor(IN_TREMOR / 1000)), 'not-held');
  assert.equal(effectRefusal('kill', 'warhorse', { handle: 'x', shop_held: 'mount:warhorse' }, Math.floor(IN_TREMOR / 1000)), 'no-effect', 'a key of another slot');
  s.gift(me, 10_000);
  assert.equal((await s.buy(me, 'bundle:lordofoblivion')).status, 200, 'PIN MOVED (AURUM-ONLY): bought with Aurum');
  assert.deepEqual(effectsHeld(s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id), Math.floor(IN_TREMOR / 1000)), { kill: ['pyre'], portal: ['daedric'], mount: ['warhorse'] });
  const r = await s.post('/v1/account/effect', me, { slot: 'mount', key: 'warhorse' });
  assert.equal(r.status, 200);
  assert.equal(r.body.effects, '00a');
  assert.equal((await s.post('/v1/account/effect', me, { slot: 'kill', key: 'pyre' })).body.effects, 'c0a');
  assert.equal(s.rowOf(me).effects, 'c0a');
  assert.equal((await s.post('/v1/account/effect', me, { slot: 'kill', key: null })).body.effects, '00a', 'a slot bared');
  assert.ok(ROUTES.has('/v1/account/effect'));
});

test('STOREFRONT the pass end to end: a guest refused, the finds shut before the folios open and paying before the world; a find pays its source\'s Aurum under the day\'s bound and counts its stage\'s challenges, a challenge paid its Aurum once on the deed that completes it, beside the bound; the balance and the card say it all (mutants: a challenge paid twice; the day unbounded; a find\'s Aurum off the ledger)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BEFORE });
  const s = await stand();
  const me = await s.registered('Player');
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  const player = () => s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id);
  const balance = async () => (await s.account(me)).aurum.balance;
  assert.deepEqual(await findPass(ctx(), player(), { source: 'foe' }, ON), { error: 'closed' }, 'before the finds begin');
  assert.equal((await passOf(ctx(), player(), ON)).season, 's1', 'the season to come is shown');
  assert.deepEqual(await findPass(ctx(), { id: 'g', handle: null }, { source: 'foe' }, ON), { error: 'guest' });
  t.mock.timers.setTime(S1.fromMs - 5 * 86_400_000);   // the folios open, the world not yet
  const early = await s.registered('Early');
  const pre = await findPass(ctx(), s.raw.prepare('SELECT * FROM players WHERE id = ?').get(early.id), { source: 'tavern' }, ON);
  assert.deepEqual([pre.gained, pre.found, pre.done, pre.season], [3, 3, [], null], 'finds pay before the world; no challenge counts');
  t.mock.timers.setTime(IN_TREMOR);
  assert.deepEqual(await findPass(ctx(), player(), { source: 'nope' }, ON), { error: 'source' });
  assert.deepEqual(await findPass(ctx(), player(), { source: 'foe' }, { ...ON, PASS_OPEN: 'off' }), { error: 'closed' }, 'the switch off');
  assert.equal(passSwitchOf('maybe'), 'off');
  // the tavern challenge: three wins, paid once on the third
  const tavern = PASS_CHALLENGES.find((c) => c.key === 'tremor-tavern');
  const t1 = await findPass(ctx(), player(), { source: 'tavern' }, ON);
  assert.deepEqual([t1.gained, t1.found, t1.done, t1.season], [3, 3, [], 's1']);
  await findPass(ctx(), player(), { source: 'tavern' }, ON);
  const t3 = await findPass(ctx(), player(), { source: 'tavern' }, ON);
  assert.deepEqual([t3.gained, t3.found, t3.done], [3 + tavern.aurum, 3, ['tremor-tavern']], 'the third win completes it: its Aurum beside the find');
  const t4 = await findPass(ctx(), player(), { source: 'tavern' }, ON);
  assert.deepEqual([t4.gained, t4.done, t4.today], [3, [], 12], 'paid once');
  assert.equal(await balance(), 12 + tavern.aurum, 'the finds and the challenge on the balance');
  // the day's bound: endgame finds (20 each; the first completes the Tremor's endgame challenge) to the day's 100
  const endgame = PASS_CHALLENGES.find((c) => c.key === 'tremor-endgame');
  const ends = [];
  for (let i = 0; i < 6; i++) ends.push(await findPass(ctx(), player(), { source: 'endgame' }, ON));
  assert.deepEqual(ends.map((e) => e.found), [20, 20, 20, 20, 8, 0], 'the last under the bound, then nothing');
  assert.deepEqual(ends[0].done, ['tremor-endgame']);
  assert.equal(ends[0].gained, 20 + endgame.aurum);
  assert.equal(ends[5].today, PASS_DAY_AURUM, 'the day full');
  assert.equal(ends[5].capped, true);
  assert.equal((await findPass(ctx(), player(), { source: 'foe' }, ON)).gained, 0, 'past the day\'s bound: nothing');
  assert.deepEqual(s.raw.prepare("SELECT kind, amount FROM aurum_ledger WHERE account = ? AND kind IN ('find', 'challenge') ORDER BY kind, ref").all(me.id).map((l) => [l.kind, l.amount]),
    [['challenge', endgame.aurum], ['challenge', tavern.aurum], ['find', PASS_DAY_AURUM]], 'one line the day\'s finds, one a challenge');
  assert.equal(await balance(), PASS_DAY_AURUM + tavern.aurum + endgame.aurum);
  // the next day: the bound again
  t.mock.timers.setTime(IN_TREMOR + 86_400_000);
  assert.equal((await findPass(ctx(), player(), { source: 'elite' }, ON)).found, 4);
  const card = passCardOf(await passOf(ctx(), player(), ON));
  assert.deepEqual([card.today, card.dayMax, card.stage], [4, PASS_DAY_AURUM, 0]);
  assert.deepEqual(card.tracks, { free: true, premium: false });
  assert.equal(card.challenges.find((c) => c.key === 'tremor-tavern').paid, true);
  assert.equal(card.challenges.find((c) => c.key === 'tremor-foes').n, 2, 'the foe past the bound counted all the same');
  assert.equal(BATTLE_PASS_STATUS.capped, 429);
  assert.ok(['/v1/pass/mine', '/v1/pass/find', '/v1/pass/unlock', '/v1/pass/buy'].every((r) => ROUTES.has(r)));
  assert.equal(PASS_DAY_ASKS, 2000);
});

test('STOREFRONT the pass end to end: past its season a find still pays Aurum (the owner: "Never expire"), and its challenges count no more; the card shows the last stage (mutants: the finds shut with the season; a challenge counted past it)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: S1.toMs + 10 * 86_400_000 });
  const s = await stand();
  const me = await s.registered('Late');
  const player = () => s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id);
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  const r = await findPass(ctx(), player(), { source: 'endgame' }, ON);
  assert.deepEqual([r.gained, r.found, r.done, r.season], [20, 20, [], null]);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM pass_counts WHERE account = ?').get(me.id).n, 0, 'no challenge counted');
  const card = passCardOf(await passOf(ctx(), player(), ON));
  assert.deepEqual([card.season, card.stage, card.today], ['s1', S1.stages.length - 1, 20]);
});

test('STOREFRONT the demand: a day a row over the span asked, each ware\'s orders opened, paid, refunded and disputed with the money paid, the day\'s featured windows beside them; the span bounded; an Admin\'s route (mutants: a day with no orders dropped; a refund counted as money)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
  const s = await stand({ ...ON, SHOP_FEATURED: 'kill:pyre 2026-11-18 2026-11-19' });
  const me = await s.registered('Buyer');
  await s.pay(me, 'kill:pyre', 1499);   // PIN MOVED (AURUM-ONLY): two money orders made before the switch, at their dollar prices
  await s.pay(me, 'portal:runic', 799);
  s.raw.prepare("UPDATE shop_orders SET status = 'refunded' WHERE ware = 'portal:runic'").run();
  const nowS = Math.floor(Date.now() / 1000);
  // AURUM: a daily ware bought for Aurum today, counted beside the money's (aurum_ledger's buys)
  s.raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'buy', 'icon:aurbis', -700, ?, ?)").run(me.id, Math.floor(nowS / 86_400), nowS);
  const env = { ...ON, SHOP_FEATURED: 'kill:pyre 2026-11-18 2026-11-19' };
  const d = await shopDemand(s.env.DB, env, nowS, 5);
  assert.equal(d.days.length, 5, 'a row a day, none dropped');
  assert.deepEqual(d.days.map((r) => r.featured), [[], [], ['kill:pyre'], ['kill:pyre'], []]);
  const today = d.days.at(-1).wares;
  // PIN MOVED (AURUM): each cell with its Aurum buys beside its orders, and each day's wares beside its featured
  assert.deepEqual(today['kill:pyre'], { opened: 1, paid: 1, refunded: 0, disputed: 0, cents: 1499, bought: 0, aurum: 0 });   // PIN MOVED (AUDIT-STOREFRONT II): the Pyre's price under the cap
  assert.deepEqual(today['portal:runic'], { opened: 1, paid: 1, refunded: 1, disputed: 0, cents: 0, bought: 0, aurum: 0 }, 'a refund paid first, its money not counted');
  assert.deepEqual(today['icon:aurbis'], { opened: 0, paid: 0, refunded: 0, disputed: 0, cents: 0, bought: 1, aurum: 700 });
  assert.deepEqual(d.days.at(-1).daily, dailyWaresAt(env, nowS), 'the day\'s wares');
  assert.equal(d.days.at(-1).daily.length, 5);
  assert.equal(d.totals['kill:pyre'].cents, 1499);
  assert.equal((await shopDemand(s.env.DB, {}, nowS, 9999)).days.length, DEMAND_DAYS_MAX);
  assert.ok(ECON_ROUTES.includes('/v1/staff/econ/shop'));
  assert.equal(d.names['kill:pyre'], 'Daedric Pyre');
});
