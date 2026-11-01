// @ts-check
// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop ... with a strict disclaimer that all proceeds go towards development costs"; bible/06-Systems/Shop.md): THE
// SHOP'S SIDE OF THE SERVICE. What a ware is lives in src/net/shopLaw.js; this file sells one. Stripe takes the money on
// its own hosted page, so no card number ever reaches this service, and Stripe's signed word on a payment is the one
// thing that grants: the ware's bit on the row and a receipt in the mailbox, in one batch. AURUM-ONLY (2026-10-30): money
// buys the Aurum packs alone (aurum.js buyWare sells the rest); an older order still lands and goes back as before.
// Off until the deploy puts both Stripe secrets (shopOn) - the window then shows the wares with nothing to buy.
import {
  SHOP_WARES,
  SHOP_CURRENCY,
  SHOP_WARE_NAME,
  SHOP_KIND_NAME,
  SHOP_ORDER_ID_RE,
  shopWareById,
  shopOwns,
  shopOnSaleOf,
  shopPriceText,
  shopReceiptBatch,
  shopHeldIds,
  shopHeldDirect,
  shopFeaturedOf,
  shopFeaturedNow,
  shopSellable,
  shopDropped,
  shopClosure,
  shopCreditOf,
  SHOP_CHECKOUT_MS,
  shopRepeatable,
} from '../../src/net/shopLaw.js';
import { aurumSwitchOf } from '../../src/net/aurumLaw.js'; // AURUM: its packs are sold while it is open to every account
import { dailyWaresAt, aurumPriceAt } from './aurum.js'; // AURUM-ONLY: a ware's Aurum price on the card, today's deals
import { POST_SENDER } from '../../src/net/postLaw.js';
import { sealKey, sealUnder, openWith } from './sealed.js';
import { patreonPage, patreonHtml } from './patreon.js';
import { mustChange } from './realm.js';
import { timingSafeEqual } from './password.js';
import { holdsAll } from './titles.js'; // ADMIN-ALL: an admin holds every ware, so is sold none

/** The paths this file answers, none with a session: each is proven by what it carries (a sealed ticket, an order, or
 *  Stripe's signature). */
export const SHOP_BUY_PATH = '/v1/shop/buy';
export const SHOP_CHECKOUT_PATH = '/v1/shop/checkout';
export const SHOP_WEBHOOK_PATH = '/v1/shop/webhook';
export const SHOP_DONE_PATH = '/v1/shop/done';
export const SHOP_CANCEL_PATH = '/v1/shop/cancel';
export const SHOP_OPEN_ROUTES = new Set([
  SHOP_BUY_PATH,
  SHOP_CHECKOUT_PATH,
  SHOP_WEBHOOK_PATH,
  SHOP_DONE_PATH,
  SHOP_CANCEL_PATH,
]);

/** THE DISCLAIMER, in English: the service's pages, Stripe's product line and the receipt say it in these words, and
 *  the window says the same through the text core (a pin holds the two equal). */
export const SHOP_PROCEEDS = 'All proceeds go to the costs of developing DFO Online.';
/** And what a ware is - and is not. */
export const SHOP_COSMETIC = 'Every item is cosmetic. It gives no power in the game.';

/** How long a Buy link in the account read may be followed (s) - the window is not open longer. */
export const SHOP_TICKET_S = 60 * 60;
/** How long Stripe's page stays up (s) - shopLaw.js SHOP_CHECKOUT_MS. */
export const SHOP_CHECKOUT_S = SHOP_CHECKOUT_MS / 1000;
/** How old a signed webhook may be (s) - Stripe's own default tolerance. */
export const SHOP_HOOK_TOLERANCE_S = 300;
/** A Stripe event's body is a few kilobytes; this is room for any and still a bound before a byte is believed. */
export const SHOP_HOOK_MAX_BYTES = 256 * 1024;
export const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';
/** AUDIT-STOREFRONT S3: Stripe's refunds - a payment the service returns itself (refundOwed). */
export const STRIPE_REFUND_API = 'https://api.stripe.com/v1/refunds';
export const STRIPE_CHECKOUT_ORIGIN = 'https://checkout.stripe.com';
/** SHOP-LOCAL (2026-10-28, a player: "Allow for iDeal payment options (or better ones)"; the owner: "Do it"): the ways
 *  to pay beside card, Apple Pay, Google Pay and Link. The checkout lists none, so Stripe offers what the account's
 *  default configuration has on; the account deploy turns these on there (tools/stripeMethods.mjs). Each needs the
 *  buyer's own currency, which Adaptive Pricing shows (checkoutFields). One taken off the list stays as the Dashboard
 *  has it. */
export const SHOP_PAY_METHODS = Object.freeze([
  'ideal',
  'wero',
  'bancontact',
  'eps',
  'blik',
  'p24',
  'paypal',
  'revolut_pay',
]);
export const STRIPE_PMC_API = 'https://api.stripe.com/v1/payment_method_configurations';
const SEAL_SALT = 'daggerfall-accounts shop';
const enc = new TextEncoder();
const dec = new TextDecoder();

/** The shop takes payments while both Stripe secrets are on the Worker (the deploy puts them, account-deploy.yml). */
export const shopOn = (/** @type {any} */ env) =>
  typeof env?.STRIPE_SECRET_KEY === 'string' &&
  !!env.STRIPE_SECRET_KEY &&
  typeof env?.STRIPE_WEBHOOK_SECRET === 'string' &&
  !!env.STRIPE_WEBHOOK_SECRET;
/** The wares on sale now (SHOP_ON_SALE in wrangler.toml - the owner ends a sale by taking an id off). */
export const shopOnSale = (/** @type {any} */ env) => shopOnSaleOf(env?.SHOP_ON_SALE);
/** STOREFRONT: the featured schedule (SHOP_FEATURED in wrangler.toml - the owner's launch windows, limited or not). */
export const shopFeatured = (/** @type {any} */ env) => shopFeaturedOf(env?.SHOP_FEATURED);
/** AURUM: an Aurum pack is sold only while Aurum is open to every account (AURUM_OPEN 'on') - Aurum nobody can spend
 *  is no sale. */
const aurumShut = (/** @type {any} */ env, /** @type {any} */ w) =>
  w?.kind === 'aurum' && aurumSwitchOf(env?.AURUM_OPEN) !== 'on';
/** STOREFRONT: whether a ware is sold at `nowS` (shopLaw.js shopSellable: on sale, inside a limited window). */
export const shopSoldNow = (/** @type {any} */ env, /** @type {any} */ w, /** @type {number} */ nowS) =>
  shopSellable(w, shopOnSale(env), shopFeatured(env), nowS * 1000) && !aurumShut(env, w);
/** AURUM-ONLY: whether a ware is sold for MONEY at `nowS` - an Aurum pack sold now, and nothing else. */
export const shopSoldForMoney = (/** @type {any} */ env, /** @type {any} */ w, /** @type {number} */ nowS) =>
  shopRepeatable(w) && shopSoldNow(env, w, nowS);
/** STOREFRONT: THE CAROUSEL'S WARES at `nowS`, in order: the schedule's featured wares in its order - each sold now (a
 *  ware featured but off sale is not shown). PASS-PANELS: the pass sells nothing for money, so it leads it no more. */
export function shopCarousel(/** @type {any} */ env, /** @type {number} */ nowS) {
  /** @type {string[]} */ const ids = [];
  for (const e of shopFeaturedNow(shopFeatured(env), nowS * 1000)) if (!ids.includes(e.id)) ids.push(e.id);
  return ids.filter((id) => shopSoldNow(env, shopWareById(id), nowS));
}
/** STOREFRONT: the row's columns every shop read takes - what it holds, by bit and by id. */
const HELD_COLS = 'shop_wares, shop_held';
const registered = (/** @type {any} */ p) => typeof p?.handle === 'string' && !!p.handle;
const hex = (/** @type {Uint8Array} */ b) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
/** A new order's id: 24 hex off the Worker's own randomness. */
export const mintOrderId = (/** @type {(b: Uint8Array) => Uint8Array} */ rand) => hex(rand(new Uint8Array(12)));

/** ADMIN-ALL: does this account hold a ware - bought, or as an admin every ware but a pack of Aurum, a currency and never
 *  held (titles.js holdsAll). The card, the checkout and the confirm page ask it, so an admin is sold nothing it holds. */
export const shopHolds = (/** @type {any} */ player, /** @type {any} */ env, /** @type {any} */ w) =>
  shopOwns(player, w.id) || (!shopRepeatable(w) && holdsAll(player, env));

/** A ware's line as a person reads it: "Genesis (title)" - an Aurum pack's its name alone ("500 Aurum"). */
export const wareLine = (/** @type {any} */ w) =>
  w.kind === 'aurum'
    ? SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)]
    : `${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)] ?? w.key} (${SHOP_KIND_NAME[/** @type {keyof typeof SHOP_KIND_NAME} */ (w.kind)] ?? w.kind})`;

/**
 * THE SHOP'S CARD in the account read: `{ on, wares }`. AURUM-ONLY: a ware bought with Aurum `{ id, sale, held, price,
 * deal }` - its price this account's (a giver's share; a quarter off on its deal day, `deal`). An Aurum pack `{ id, sale,
 * held, buy, cents }` - `buy` a link to this service's own confirm page, its ticket sealed for this account and pack,
 * while the shop is on and the account registered (every grant asks one). Patreon's way: the window has the link before
 * it is pressed, so the press opens it at once (a window opened after an await is a popup a phone blocks).
 */
export async function shopCardOf(/** @type {any} */ player, /** @type {any} */ env, { subtle, rand, nowS, origin }) {
  const on = shopOn(env);
  const schedule = shopFeatured(env),
    live = shopFeaturedNow(schedule, nowS * 1000),
    deals = dailyWaresAt(env, nowS);
  const wares = [];
  let key = null; // derived once a read, at its first Buy link - every account read asks this
  for (const w of SHOP_WARES) {
    if (!w.alone) continue; // STOREFRONT: a ware sold only in a bundle has no row of its own
    const isHeld = registered(player) && shopHolds(player, env, w),
      onSale = shopSoldNow(env, w, nowS) || deals.includes(w.id); // ARMORY: a set's pieces, or the set's through its pieces; STOREFRONT: a bundle's wares; ADMIN-ALL
    if (!isHeld && !onSale && (!shopDropped(w, schedule, nowS * 1000) || aurumShut(env, w))) continue; // AUDIT-STOREFRONT S2: nothing upcoming is told; AURUM: no pack while Aurum is shut
    const feat = onSale ? live.find((e) => e.id === w.id) : null; // AUDIT-STOREFRONT S9: a window's end only beside a sale
    const win = feat ? { until: feat.toMs, limited: feat.limited } : {};
    if (!w.cash) {
      // AURUM-ONLY: no link - the window buys it for Aurum (aurum.js buyWare) at this account's price
      const at = isHeld ? null : aurumPriceAt(registered(player) ? player : null, w, deals);
      wares.push({
        id: w.id,
        sale: onSale,
        held: isHeld,
        price: at?.price ?? w.price,
        ...(at?.deal ? { deal: true } : {}),
        ...win,
      });
      continue;
    }
    if (on && onSale && registered(player))
      key ??= await sealKey(subtle, String(env.STRIPE_SECRET_KEY), SEAL_SALT, 'buy');
    const buy =
      key && onSale
        ? `${origin}${SHOP_BUY_PATH}?t=${await sealUnder(key, { p: player.id, w: w.id, x: nowS + SHOP_TICKET_S }, { subtle, rand })}`
        : null;
    wares.push({ id: w.id, sale: onSale, held: false, buy, cents: w.cents, ...win });
  }
  return { on, wares, featured: shopCarousel(env, nowS) };
}

/** A sealed Buy ticket's claims - `{ p, w, x }` - or null. */
export async function openShopTicket(/** @type {any} */ sealed, /** @type {any} */ env, { subtle, nowS }) {
  if (!shopOn(env)) return null;
  const c = await openWith(String(env.STRIPE_SECRET_KEY), SEAL_SALT, 'buy', sealed, { subtle, nowS });
  return c && shopWareById(c.w) ? c : null;
}

// ── THE PAGES ───────────────────────────────────────────────────────

/** The pages a buyer can meet, each a sentence they can act on. */
export const SHOP_PAGES = Object.freeze({
  off: { heading: 'The shop is closed', lines: ['It does not take payments yet. Ask the developers on the Discord.'] },
  expired: { heading: 'This link has expired', lines: ['Open the shop in the game and press Buy again.'] },
  account: {
    heading: 'This account needs a username',
    lines: ['Give your game account a username and a password, then buy from the shop.'],
  },
  sold: { heading: 'Not on sale', lines: ['This item is no longer sold. Nothing was charged.'] },
  aurum: {
    heading: 'Bought with Aurum',
    lines: ['Items are bought with Aurum in the shop in the game now. Nothing was charged.'],
  }, // AURUM-ONLY: a link to an item's page
  held: { heading: 'Already yours', lines: ['Your account holds this item already. Nothing was charged.'] },
  down: {
    heading: 'The payment page did not open',
    lines: ['Nothing was charged. Wait a minute, then press Buy in the game again.'],
  },
  rate: { heading: 'Too many tries', lines: ['Wait a few minutes, then press Buy in the game again.'] },
  cancel: { heading: 'Nothing was bought', lines: ['Nothing was charged. You can close this page.'] },
});
/** A page as a Response, its one form allowed on to Stripe's page. */
export const shopHtml = (/** @type {any} */ page, status = 200) =>
  patreonHtml(patreonPage(page), status, STRIPE_CHECKOUT_ORIGIN);

/** THE CONFIRM PAGE: which ware, its price, onto which game account - and the disclaimer - with the one button that goes
 *  on to pay. The account is named so a link somebody else sent is read before anything is paid (Patreon's law). */
export function shopConfirmPage({ handle, ware, ticket, cents = ware.cents, holds = 0, part = false }) {
  return {
    heading: `Buy ${wareLine(ware)}`,
    lines: [
      `Game account: ${handle}`,
      `Price: ${shopPriceText(cents)} (USD), paid once.`,
      ...(ware.gives.length
        ? [
            `It gives ${ware.gives.map((g) => SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (g)] ?? g).join(', ')}.`,
          ]
        : []), // STOREFRONT: what a bundle holds
      ...(holds > 0
        ? [`Your account holds ${holds} of them already, so the price is less.`]
        : part
          ? ['Your account holds part of it already, so the price is less.']
          : []), // AUDIT-STOREFRONT S12: a Premium inside the Deluxe
      "Stripe can show the price in your own currency, with your country's ways to pay.",
      ...(ware.preAlpha ? ['A pre-alpha item: it is sold only during the pre-alpha.'] : []),
      SHOP_COSMETIC,
      SHOP_PROCEEDS,
      'Not your game account? Close this page. Nothing is charged.',
    ],
    form: { action: SHOP_CHECKOUT_PATH, ticket, label: `Pay ${shopPriceText(cents)} on Stripe` },
  };
}
/** The page Stripe sends the buyer back to: the order as it stands (the webhook may land a moment after). */
export function shopDonePage(/** @type {any} */ order) {
  const w = shopWareById(order?.ware);
  if (!w) return { heading: 'Thank you', lines: ['Go back to the game. Your mailbox says what arrived.'] };
  if (order.status === 'paid')
    return {
      heading: 'Thank you',
      lines: [
        `${wareLine(w)} is on your account now.`,
        shopRepeatable(w)
          ? 'Go back to the game: spend it in the shop. A receipt is in your mailbox.'
          : 'Go back to the game: wear it from your profile. A receipt is in your mailbox.',
        SHOP_PROCEEDS,
      ],
    }; // AUDIT-STOREFRONT III A7: Aurum is spent, not worn
  if (order.status === 'open')
    return {
      heading: 'Thank you',
      lines: [
        'Your payment is being confirmed.',
        `${wareLine(w)} arrives on your account in a minute or two, with a receipt in your mailbox.`,
        SHOP_PROCEEDS,
      ],
    };
  if (order.status === 'expired')
    return {
      heading: 'Not paid',
      lines: ['This checkout ended without a payment. Nothing was charged.', 'Buy it again from the shop in the game.'],
    };
  return {
    heading: 'Order closed',
    lines: [
      `The payment for ${wareLine(w)} was ${order.status === 'disputed' ? 'disputed' : 'refunded'}. Your mailbox says more.`,
    ],
  };
}

// ── STRIPE ──────────────────────────────────────────────────────────

/** Stripe's form encoding of a session's fields (its bracketed keys). Pure. */
export function stripeForm(/** @type {Record<string, string|number>} */ fields) {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}
/** THE CHECKOUT SESSION's fields for an order: one line, priced by this service (never the client), the order on its
 *  metadata and the payment's, and the disclaimer on the line the buyer reads. Pure. */
export function checkoutFields(
  /** @type {{ id: string, player: string, handle: string, ware: any, cents?: number, origin: string, expiresAt: number }} */ o,
) {
  return {
    mode: 'payment',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': SHOP_CURRENCY,
    'line_items[0][price_data][unit_amount]': o.cents ?? o.ware.cents, // STOREFRONT: the account's price - a bundle's share
    'line_items[0][price_data][product_data][name]': `${wareLine(o.ware)} - DFO Online`,
    'line_items[0][price_data][product_data][description]': `For the game account ${o.handle}. ${SHOP_COSMETIC} ${SHOP_PROCEEDS}`,
    client_reference_id: o.id,
    'metadata[order]': o.id,
    'metadata[player]': o.player,
    'metadata[ware]': o.ware.id,
    'payment_intent_data[metadata][order]': o.id,
    success_url: `${o.origin}${SHOP_DONE_PATH}?o=${o.id}`,
    cancel_url: `${o.origin}${SHOP_CANCEL_PATH}?o=${o.id}`,
    expires_at: o.expiresAt,
    'adaptive_pricing[enabled]': 'true', // SHOP-LOCAL: the buyer's own currency where Stripe can - the session and its events still read USD
  };
}
/** Ask Stripe for the session: `{ id, url }`, or `{ error: 'stripe-down' }`. The order is the idempotency key, so a call
 *  asked twice is one page. SHOP-LOCAL: a session Stripe refuses (400) for its Adaptive Pricing is asked again without
 *  it, in dollars, under a key of its own - an account Stripe will not localise still sells. */
export async function stripeCheckout(
  /** @type {typeof fetch} */ fetch,
  /** @type {any} */ env,
  /** @type {Record<string, string|number>} */ fields,
) {
  const ask = (/** @type {Record<string, string|number>} */ f, /** @type {string} */ key) =>
    fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': key,
      },
      body: stripeForm(f),
    });
  try {
    let res = await ask(fields, `shop-${fields.client_reference_id}`);
    if (res.status === 400 && 'adaptive_pricing[enabled]' in fields) {
      console.error(
        '[shop] Stripe refused the session; asked again in dollars:',
        (await res.json().catch(() => null))?.error?.message,
      );
      const plain = { ...fields };
      delete plain['adaptive_pricing[enabled]'];
      res = await ask(plain, `shop-${fields.client_reference_id}-usd`);
    }
    const data = res.ok ? await res.json() : null;
    return typeof data?.id === 'string' &&
      typeof data?.url === 'string' &&
      data.url.startsWith(`${STRIPE_CHECKOUT_ORIGIN}/`)
      ? { id: data.id, url: data.url }
      : { error: 'stripe-down' };
  } catch {
    return { error: 'stripe-down' };
  }
}

/**
 * THE PRESS ON THE CONFIRM PAGE: the ticket opened again, the ware still on sale and not held, then Stripe's page - the
 * open one this account already has for the ware (a second press, a back button), else a new order and its session.
 * Answers `{ url }` to send the browser on to, or `{ page }`, a SHOP_PAGES key. The order row is written before Stripe is
 * asked, so a session Stripe made always has its order.
 * @param {{ db: any, nowS: number, rand: (b: Uint8Array) => Uint8Array }} ctx @param {any} env @param {any} claims an opened ticket
 * @param {{ fetch: typeof fetch, origin: string }} io
 */
export async function shopCheckout(ctx, env, claims, { fetch, origin }) {
  const { db, nowS, rand } = ctx;
  const ware = shopWareById(claims?.w);
  if (!ware) return { page: 'expired' };
  if (!shopRepeatable(ware)) return { page: 'aurum' }; // AURUM-ONLY: a ticket for an item, sealed before the switch
  if (!shopSoldForMoney(env, ware, nowS)) return { page: 'sold' };
  const player = await db
    .prepare(`SELECT id, handle, staff_suspended, ${HELD_COLS} FROM players WHERE id = ?1`)
    .bind(claims.p)
    .first();
  if (!registered(player)) return { page: 'account' };
  if (shopHolds(player, env, ware)) return { page: 'held' }; // ADMIN-ALL: an admin's too
  const cents = ware.cents,
    credit = ''; // AURUM-ONLY: a pack's price is its own, and it gives nothing held
  // an open page at another price (a ware bought meanwhile that the bundle holds) is not gone back to: a new order is priced now
  const open = await db
    .prepare(
      "SELECT stripe_url FROM shop_orders WHERE player = ?1 AND ware = ?2 AND cents = ?4 AND credit = ?5 AND status = 'open' AND expires_at > ?3 AND stripe_url IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    )
    .bind(player.id, ware.id, nowS + 60, cents, credit)
    .first();
  if (open?.stripe_url) return { url: open.stripe_url };
  const id = mintOrderId(rand),
    expiresAt = nowS + SHOP_CHECKOUT_S;
  await db
    .prepare(
      "INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at, credit, aurum) VALUES (?1, ?2, ?3, ?4, ?5, 'open', ?6, ?7, ?8, ?9)",
    )
    .bind(id, player.id, ware.id, cents, SHOP_CURRENCY, nowS, expiresAt, credit, ware.aurum)
    .run(); // AURUM: a pack's Aurum, the order's own
  const s = await stripeCheckout(
    fetch,
    env,
    checkoutFields({ id, player: player.id, handle: player.handle, ware, cents, origin, expiresAt }),
  );
  if ('error' in s) {
    await db
      .prepare("UPDATE shop_orders SET status = 'expired', ended_at = ?2 WHERE id = ?1 AND status = 'open'")
      .bind(id, nowS)
      .run();
    return { page: 'down' };
  }
  await db
    .prepare('UPDATE shop_orders SET stripe_session = ?2, stripe_url = ?3 WHERE id = ?1')
    .bind(id, s.id, s.url)
    .run();
  // AUDIT-STOREFRONT S3: the pages this one replaces close, so an old page never charges an old price - those written
  // before it only (rowid, not the second a clock gives two presses): of two presses at once, the later's page stays open
  const older = await db
    .prepare(
      "SELECT id, stripe_session FROM shop_orders WHERE player = ?1 AND ware = ?2 AND status = 'open' AND rowid < (SELECT rowid FROM shop_orders WHERE id = ?3)",
    )
    .bind(player.id, ware.id, id)
    .all();
  await closePages({ db, nowS }, env, fetch, older?.results ?? []);
  return { url: s.url };
}

/** AUDIT-STOREFRONT S3: OPEN ORDERS CLOSED - each Stripe page expired (best effort: a page Stripe will not expire is
 *  finished or gone) and the order with it. An order paid after all is still fulfilled: fulfilOrder takes an expired one,
 *  and refunds it if its ware is held by then. */
async function closePages(
  /** @type {{ db: any, nowS: number }} */ { db, nowS },
  /** @type {any} */ env,
  /** @type {typeof fetch|undefined} */ fetch,
  /** @type {any[]} */ rows,
) {
  for (const r of rows) {
    if (fetch && typeof r.stripe_session === 'string') {
      try {
        await fetch(`${STRIPE_API}/${encodeURIComponent(r.stripe_session)}/expire`, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
        });
      } catch (e) {
        console.error('[shop] a page did not close', r.id, String(e));
      }
    }
    await db
      .prepare("UPDATE shop_orders SET status = 'expired', ended_at = ?2 WHERE id = ?1 AND status = 'open'")
      .bind(r.id, nowS)
      .run();
  }
}

// ── THE WEBHOOK ─────────────────────────────────────────────────────

/** Stripe's signature header (`t=<s>,v1=<hex>[,v1=<hex>]`) as its time and its v1 signatures, or null. Pure. */
export function stripeSignatureOf(/** @type {unknown} */ header) {
  if (typeof header !== 'string' || header.length > 2048) return null;
  let t = null;
  const v1 = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=').map((x) => x?.trim());
    if (k === 't' && /^[0-9]{1,12}$/.test(v ?? '')) t = Number(v);
    else if (k === 'v1' && /^[0-9a-f]{64}$/.test(v ?? '')) v1.push(v);
  }
  return t !== null && v1.length ? { t, v1 } : null;
}
/** Is the body Stripe's, signed with the endpoint's secret within SHOP_HOOK_TOLERANCE_S? HMAC-SHA256 over `t.body`. */
export async function stripeSignatureOk(
  /** @type {string} */ secret,
  /** @type {Uint8Array} */ body,
  /** @type {unknown} */ header,
  { subtle, nowS },
) {
  const sig = stripeSignatureOf(header);
  if (!sig || Math.abs(nowS - sig.t) > SHOP_HOOK_TOLERANCE_S) return false;
  const key = await subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new Uint8Array([...enc.encode(`${sig.t}.`), ...body]);
  const want = enc.encode(hex(new Uint8Array(await subtle.sign('HMAC', key, signed))));
  return sig.v1.some((v) => timingSafeEqual(enc.encode(v), want));
}

/** STOREFRONT: where a ware is used, as its receipt says it - Aurum in the shop, the rest from the profile. Pure. */
export function receiptUse(/** @type {any} */ w) {
  if (w.kind === 'aurum') return 'Spend it in the shop, on any item and on the Folios.'; // AURUM; AURUM-ONLY: every item is bought with it; PASS-PANELS: the Folios are bought with it (AUDIT-STOREFRONT III A7: the player's word)
  return 'Wear it from your profile, or from the Collections page.';
}
/** THE RECEIPT, its words fixed here (a letter no player writes - post.js's law). Pure. */
export function receiptPost(/** @type {any} */ order, /** @type {number} */ nowS) {
  const w = /** @type {any} */ (shopWareById(order.ware));
  const day = new Date(nowS * 1000).toISOString().slice(0, 10);
  return {
    batch: shopReceiptBatch(order.id),
    subject: `Thank you: ${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)]}`,
    body: [
      w.kind === 'aurum'
        ? `${wareLine(w)} is on your account now.`
        : `${wareLine(w)} is yours, on every character of your account.`, // AURUM: a pack's
      ...(w.gives.length
        ? [
            '',
            `It gives ${w.gives.map((/** @type {string} */ g) => SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (g)] ?? g).join(', ')}.`,
          ]
        : []), // STOREFRONT: what a bundle held
      '',
      receiptUse(w),
      '',
      `Paid: ${shopPriceText(order.cents)} (USD) on ${day}. Order ${order.id}.`,
      `${SHOP_PROCEEDS} ${SHOP_COSMETIC}`,
      '',
      `- ${POST_SENDER}`,
    ].join('\n'),
  };
}
/** The letter a refund or a dispute sends, its words fixed too: what left the account with it (`gone`, ware ids - a
 *  giver's wares it covered go too), or that nothing did. AURUM: a pack's Aurum off the balance. AUDIT-STOREFRONT II A1:
 *  `never` for a payment taken back before its ware was put on the account. Pure. */
export function revokePost(
  /** @type {any} */ order,
  /** @type {string} */ why,
  /** @type {ReadonlyArray<string>} */ gone = [order.ware],
  never = false,
) {
  const w = /** @type {any} */ (shopWareById(order.ware));
  const names = gone.map((id) => SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (id)] ?? id);
  const off = never
    ? 'It was not put on your account.'
    : shopRepeatable(w)
      ? `Its ${Number(order.aurum) || w.aurum} Aurum are off your balance${why === 'disputed' ? ' while the dispute stands' : ''}.`
      : // AUDIT-STOREFRONT S1: said as it stands - another order can still hold it, and a bundle can lose what it covered
        !names.length
        ? 'Your account still holds it through another order.'
        : `Off your account${why === 'disputed' ? ' while the dispute stands' : ''}: ${names.join(', ')}.`;
  return {
    batch: `${shopReceiptBatch(order.id)}-${why === 'disputed' ? 'disputed' : 'refunded'}`, // a letter a reason: a dispute, then a refund, both said
    subject: `${why === 'disputed' ? 'Payment disputed' : 'Refunded'}: ${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)]}`,
    body: [
      why === 'disputed'
        ? `The payment for ${wareLine(w)} was disputed.`
        : `The payment for ${wareLine(w)} was refunded.`,
      off,
      '',
      `Order ${order.id}. Questions: ask the developers on the Discord.`,
      '',
      `- ${POST_SENDER}`,
    ].join('\n'),
  };
}
/** The letter a dispute closed in the seller's favour sends: the ware back. Pure. */
export function restorePost(/** @type {any} */ order) {
  const w = /** @type {any} */ (shopWareById(order.ware));
  return {
    batch: `${shopReceiptBatch(order.id)}-restored`,
    subject: `Back on your account: ${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)]}`,
    body: [
      `The dispute over ${wareLine(w)} is closed, and it is back on your account.`,
      '',
      `Order ${order.id}.`,
      '',
      `- ${POST_SENDER}`,
    ].join('\n'),
  };
}
/** AUDIT-STOREFRONT S3: the letter a payment the service returns itself sends - for a ware held already when the payment
 *  landed (two pages paid at once), or a giver whose price moved. Pure. */
export function refundPost(/** @type {any} */ order, /** @type {'held'|'price'} */ why) {
  const w = /** @type {any} */ (shopWareById(order.ware));
  const first = {
    held: `Your account already held ${wareLine(w)} when this payment arrived.`,
    price: `What your account holds of ${wareLine(w)} changed before this payment arrived, and its price with it.`, // AUDIT-STOREFRONT II A2
  };
  return {
    batch: `${shopReceiptBatch(order.id)}-refunded`,
    subject: `Refunded: ${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)]}`,
    body: [
      first[why],
      `So the payment of ${shopPriceText(order.cents)} (USD) is refunded in full. Nothing changes on your account.`,
      '',
      `Order ${order.id}.`,
      '',
      `- ${POST_SENDER}`,
    ].join('\n'),
  };
}

// ── THE ROW ─────────────────────────────────────────────────────────
// AUDIT-STOREFRONT S1: a giver sold with credit for a ware the row held paid for the rest of it only. So a payment taken
// back takes off what it alone covered - its ware, and what a giver still held gives that no other paid order covers.

/** The ware ids an order paid for: its ware and all it gives, but its credit (shopCreditOf at its checkout). Pure. */
export const orderCovers = (/** @type {any} */ order) => {
  const credit = String(order?.credit ?? '').split(' ');
  return shopClosure(order?.ware).filter((id) => !credit.includes(id));
};
const tokensOf = (/** @type {any} */ row) =>
  String(row?.shop_held ?? '')
    .split(' ')
    .filter(Boolean);
/** THE ROW WITH AN ORDER'S WARE ON - its bit for the first nine, its id in `shop_held` for the rest (once) - and the marks
 *  off what the order covers (shopLaw.js shopLostOf). AUDIT-STOREFRONT II A2: a mark on each ware its credit took off that
 *  the row no longer holds - its own payment went back meanwhile, so the giver given again must not give it. An Aurum
 *  pack is no thing held: the row as it is. Its two columns. Pure. */
export function heldGranted(/** @type {any} */ row, /** @type {any} */ order) {
  const w = /** @type {any} */ (shopWareById(order.ware)),
    covers = orderCovers(order);
  if (shopRepeatable(w)) return { shop_wares: Number(row?.shop_wares) || 0, shop_held: String(row?.shop_held ?? '') };
  const had = shopHeldIds(row);
  const toks = tokensOf(row).filter((t) => !(t[0] === '-' && covers.includes(t.slice(1))));
  if (!w.bit && !toks.includes(w.id)) toks.push(w.id);
  for (const c of String(order?.credit ?? '')
    .split(' ')
    .filter(Boolean))
    if (!had.includes(c) && !toks.includes(`-${c}`)) toks.push(`-${c}`);
  return { shop_wares: (Number(row?.shop_wares) || 0) | w.bit, shop_held: toks.join(' ') };
}
/** THE ROW WITH AN ORDER'S WARE TAKEN BACK - its bit or id off unless another paid order (`others`) is for the same ware,
 *  and a mark on each ware the order covered that a giver still held would give and no other paid order covers. Pure. */
export function heldRevoked(
  /** @type {any} */ row,
  /** @type {any} */ order,
  /** @type {ReadonlyArray<any>} */ others,
) {
  const w = /** @type {any} */ (shopWareById(order.ware));
  let toks = tokensOf(row),
    bits = Number(row?.shop_wares) || 0;
  if (shopRepeatable(w)) return { shop_wares: bits, shop_held: toks.join(' ') }; // AURUM: a pack's Aurum leaves with its order's status
  if (!others.some((o) => o.ware === w.id)) {
    if (w.bit) bits &= ~w.bit;
    else toks = toks.filter((t) => t !== w.id);
  }
  const covered = new Set(others.flatMap(orderCovers)),
    rest = { shop_wares: bits, shop_held: toks.join(' ') };
  const still = shopHeldIds(rest),
    direct = shopHeldDirect(rest);
  for (const id of orderCovers(order))
    if (still.includes(id) && !direct.includes(id) && !covered.has(id) && !toks.includes(`-${id}`)) toks.push(`-${id}`);
  return { shop_wares: bits, shop_held: toks.join(' ') };
}
/** The row's write, guarded on the row as read: a grant or a loss landing between the read and this batch rolls the batch
 *  back (mustChange next), and the order is decided again on the row as it then is (AUDIT-STOREFRONT S7). */
const rowWrite = (
  /** @type {any} */ db,
  /** @type {string} */ player,
  /** @type {any} */ before,
  /** @type {any} */ after,
) =>
  db
    .prepare('UPDATE players SET shop_wares = ?2, shop_held = ?3 WHERE id = ?1 AND shop_wares = ?4 AND shop_held = ?5')
    .bind(player, after.shop_wares, after.shop_held, before.shop_wares, before.shop_held);
const heldRow = (/** @type {any} */ db, /** @type {string} */ player) =>
  db.prepare(`SELECT ${HELD_COLS} FROM players WHERE id = ?1`).bind(player).first();
/** An account's other paid orders - what else covers its wares - and AUDIT-STOREFRONT III A5 its wares bought for Aurum
 *  (aurum.js buyWare's `buy` lines), each its own holder for good: a money refund never takes a ware Aurum paid for. */
export const paidOthers = async (/** @type {any} */ db, /** @type {any} */ order) => {
  const paid =
    (
      await db
        .prepare("SELECT id, ware, credit FROM shop_orders WHERE player = ?1 AND status = 'paid' AND id <> ?2")
        .bind(order.player, order.id)
        .all()
    )?.results ?? [];
  const bought =
    (
      await db
        .prepare("SELECT ref, credit FROM aurum_ledger WHERE account = ?1 AND kind = 'buy'")
        .bind(order.player)
        .all()
    )?.results ?? [];
  return [
    ...paid,
    ...bought.map((/** @type {any} */ b) => ({
      id: `aurum:${b.ref}`,
      ware: String(b.ref),
      credit: String(b.credit ?? ''),
    })),
  ]; // AUDIT AURUM-SPEND F1: its credit, as an order's
};

const postStatement = (
  /** @type {any} */ db,
  /** @type {string} */ to,
  /** @type {{ batch: string, subject: string, body: string }} */ p,
  /** @type {string|null} */ ware,
  /** @type {number} */ nowS,
) =>
  db
    .prepare(
      `INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at, ware)
    VALUES (lower(hex(randomblob(12))), ?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)`,
    )
    .bind(to, p.batch, POST_SENDER, p.subject, p.body, nowS, ware);

/** Whether an order left the states a batch was guarded on - another word on it landed first. */
const moved = async (/** @type {any} */ db, /** @type {string} */ id, /** @type {string[]} */ from) =>
  !from.includes((await db.prepare('SELECT status FROM shop_orders WHERE id = ?1').bind(id).first())?.status);
/** AUDIT-STOREFRONT S7: a batch decided on a read, tried again on a fresh read while its row guard refuses it (a grant
 *  landing meanwhile) - three times, then the error, and Stripe tells it again. `{ ok, applied }`. */
async function settled(
  /** @type {any} */ db,
  /** @type {string} */ id,
  /** @type {string[]} */ from,
  /** @type {() => Promise<any>} */ attempt,
) {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (e) {
      if (await moved(db, id, from)) return { ok: true, applied: 0 }; // another word on it landed first - the guard held
      if (i === 2) throw e; // never written: a 5xx, and Stripe tells it again
    }
  }
}

/**
 * AUDIT-STOREFRONT S3: A PAYMENT THE SERVICE RETURNS ITSELF, asked of Stripe under the order's own key (so asked twice it
 * is one refund) until Stripe takes it: `refund_owed` holds it until then, and Stripe's next word on the order asks
 * again. `{ ok, applied: 0 }`, or `{ error: 'stripe-down' }` - Stripe tells the event again.
 */
async function refundOwed(
  /** @type {any} */ db,
  /** @type {any} */ env,
  /** @type {typeof fetch|undefined} */ fetch,
  /** @type {any} */ order,
  /** @type {string} */ intent,
) {
  if (!fetch) return { ok: true, applied: 0 }; // no Stripe to ask: it stays owed, for the staff's demand read
  try {
    const res = await fetch(STRIPE_REFUND_API, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': `shop-refund-${order.id}`,
      },
      body: stripeForm({
        payment_intent: intent,
        ...(order.refund === 'held' ? { reason: 'duplicate' } : {}),
        'metadata[order]': order.id,
        'metadata[why]': String(order.refund ?? ''),
      }),
    });
    const err = res.ok ? null : (await res.json().catch(() => null))?.error?.code;
    if (!res.ok && err !== 'charge_already_refunded') return { error: 'stripe-down' };
  } catch {
    return { error: 'stripe-down' };
  }
  await db.prepare('UPDATE shop_orders SET refund_owed = 0 WHERE id = ?1').bind(order.id).run();
  return { ok: true, applied: 0 };
}

/** AUDIT-STOREFRONT II A1, A3: WHAT STRIPE HAS SAID OF A PAYMENT, whatever its order's state - refunded in full, and the
 *  disputes still open (`shop_charge_words`). */
async function chargeFate(/** @type {any} */ db, /** @type {unknown} */ intent) {
  if (typeof intent !== 'string' || !intent) return { refunded: false, disputes: 0 };
  const r = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM shop_charge_words WHERE intent = ?1 AND kind = 'refund') AS refunded,
    (SELECT COUNT(*) FROM shop_charge_words WHERE intent = ?1 AND kind = 'dispute' AND open = 1) AS disputes`,
    )
    .bind(intent)
    .first();
  return { refunded: Number(r?.refunded) > 0, disputes: Number(r?.disputes) || 0 };
}
/** A word on a payment kept: a refund (`ref` ''), or a dispute opened (`open` 1) or closed (0) by its id. AUDIT-STOREFRONT
 *  III A4: Stripe promises no order, so a closed word is never opened again - a won dispute whose created word lands
 *  late stays closed; a lost one is kept open (its money stays taken back). */
const keepWord = (
  /** @type {any} */ db,
  /** @type {string} */ intent,
  /** @type {'refund'|'dispute'} */ kind,
  /** @type {string} */ ref,
  /** @type {number} */ open,
  /** @type {number} */ nowS,
) =>
  db
    .prepare(
      'INSERT INTO shop_charge_words (intent, kind, ref, open, at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT (intent, kind, ref) DO UPDATE SET open = MIN(open, excluded.open), at = excluded.at',
    )
    .bind(intent.slice(0, 255), kind, ref.slice(0, 255), open, nowS)
    .run();
/** AUDIT-STOREFRONT II A2, A5: whether a giver's payment is for a price no longer its row's - what the row holds of it
 *  changed since its checkout (a credited ware's own payment went back, or a ware it gives was bought meanwhile). Pure. */
const creditMoved = (/** @type {any} */ row, /** @type {any} */ w, /** @type {any} */ order) =>
  w.gives.length > 0 && shopCreditOf(row, w.id).join(' ') !== String(order.credit ?? '');

/**
 * A PAYMENT TAKEN: the order paid, its ware on the row, the receipt in the mailbox - one batch, guarded on the order
 * moving from open (or expired) and the row as read, so a webhook told twice grants once; its amount the order's. A ware
 * held by then, or a giver whose price moved (AUDIT-STOREFRONT II A2) is refunded (S3); a payment refunded or disputed
 * before this word is never granted (A1). `{ ok, applied }`.
 * @param {{ db: any, nowS: number }} ctx @param {string} orderId @param {{ intent?: unknown, amount?: unknown, currency?: unknown }} paid
 * @param {{ env?: any, fetch?: typeof fetch }} [io] Stripe, to close pages and return payments
 */
export async function fulfilOrder(
  { db, nowS },
  orderId,
  { intent = null, amount, currency },
  { env = {}, fetch } = {},
) {
  if (typeof orderId !== 'string' || !SHOP_ORDER_ID_RE.test(orderId)) return { ok: true, applied: 0 };
  const order = await db
    .prepare(
      'SELECT id, player, ware, cents, currency, status, credit, refund, refund_owed, payment_intent, aurum FROM shop_orders WHERE id = ?1',
    )
    .bind(orderId)
    .first();
  const w = shopWareById(order?.ware);
  if (order?.refund_owed && order.payment_intent) return refundOwed(db, env, fetch, order, order.payment_intent); // Stripe's word again: ask it again
  if (!order?.player || !w || !['open', 'expired'].includes(order.status)) return { ok: true, applied: 0 };
  if (Number(amount) !== order.cents || String(currency).toLowerCase() !== order.currency) {
    console.error("[shop] paid amount is not the order's", order.id, amount, currency, order.cents); // charged, not granted: an owner's refund or grant
    return { ok: true, applied: 0, mismatch: true };
  }
  const pi = typeof intent === 'string' ? intent.slice(0, 255) : null;
  const r = await settled(db, order.id, ['open', 'expired'], async () => {
    const row = await heldRow(db, order.player),
      fate = await chargeFate(db, pi);
    if (fate.refunded || fate.disputes) {
      const gone = fate.refunded ? 'refunded' : 'disputed'; // AUDIT-STOREFRONT II A1: taken back before this word landed
      await db.batch([
        db
          .prepare(
            "UPDATE shop_orders SET status = ?4, paid_at = ?2, ended_at = ?2, payment_intent = ?3 WHERE id = ?1 AND status IN ('open', 'expired')",
          )
          .bind(order.id, nowS, pi, gone),
        mustChange(db),
        postStatement(db, order.player, revokePost(order, gone, [], true), null, nowS),
      ]);
      return { ok: true, applied: 0 };
    }
    /** @type {'held'|'price'|null} */
    const refund = shopOwns(row, w.id) ? 'held' : creditMoved(row, w, order) ? 'price' : null;
    if (refund) {
      await db.batch([
        db
          .prepare(
            "UPDATE shop_orders SET status = 'refunded', paid_at = ?2, ended_at = ?2, payment_intent = ?3, refund = ?4, refund_owed = 1 WHERE id = ?1 AND status IN ('open', 'expired')",
          )
          .bind(order.id, nowS, pi, refund),
        mustChange(db),
        postStatement(db, order.player, refundPost(order, refund), null, nowS),
      ]);
      return { ok: true, applied: 0, refund }; // AUDIT-STOREFRONT II A4: the refund this attempt wrote - an attempt refused writes none
    }
    const after = heldGranted(row, order);
    await db.batch([
      db
        .prepare(
          "UPDATE shop_orders SET status = 'paid', paid_at = ?2, payment_intent = ?3 WHERE id = ?1 AND status IN ('open', 'expired')",
        )
        .bind(order.id, nowS, pi),
      mustChange(db),
      rowWrite(db, order.player, row, after), // STOREFRONT: a bit, or a held id; AUDIT-STOREFRONT S1: and the marks it covers off
      mustChange(db),
      postStatement(db, order.player, receiptPost(order, nowS), w.id, nowS),
    ]);
    return { ok: true, applied: 1 };
  });
  if (r.refund && pi) return refundOwed(db, env, fetch, { ...order, refund: r.refund }, pi);
  if (r.applied) await closeStale({ db, nowS }, env, fetch, order.player);
  return { ok: r.ok, applied: r.applied };
}

/** AUDIT-STOREFRONT S3: an account's open pages that a grant left wrong - for a ware it now holds, or at a price that is
 *  no longer its own - closed. AUDIT-STOREFRONT III A6: a ware bought for Aurum is such a grant (index.js). AURUM-ONLY: a
 *  pack's own price is its page's; any other ware's page is no longer a price, so it closes. */
export async function closeStale(
  /** @type {{ db: any, nowS: number }} */ ctx,
  /** @type {any} */ env,
  /** @type {typeof fetch|undefined} */ fetch,
  /** @type {string} */ player,
) {
  const open =
    (
      await ctx.db
        .prepare("SELECT id, ware, cents, stripe_session FROM shop_orders WHERE player = ?1 AND status = 'open'")
        .bind(player)
        .all()
    )?.results ?? [];
  await closePages(
    ctx,
    env,
    fetch,
    open.filter((/** @type {any} */ o) => {
      const w = shopWareById(o.ware);
      return !w || !shopRepeatable(w) || w.cents !== o.cents;
    }),
  );
}

/**
 * A PAYMENT TAKEN BACK (a full refund, a dispute opened): the order marked, and what it alone covered off the row - its
 * ware unless another paid order is for it, and a giver's wares no other paid order covers (AUDIT-STOREFRONT S1) - with
 * the levels they gave, and a letter saying what left; then the pages priced on what left are closed (AUDIT-STOREFRONT II
 * A2). A refund of a disputed order ends it refunded, its ware already off (A3). `{ ok, applied }`.
 * @param {{ db: any, nowS: number }} ctx @param {unknown} intent Stripe's payment @param {'refunded'|'disputed'} why
 * @param {{ env?: any, fetch?: typeof fetch }} [io] Stripe, to close the pages left wrong
 */
export async function revokeOrder({ db, nowS }, intent, why, { env = {}, fetch } = {}) {
  if (typeof intent !== 'string' || !intent) return { ok: true, applied: 0 };
  const order = await db
    .prepare(
      "SELECT id, player, ware, credit, status, aurum FROM shop_orders WHERE payment_intent = ?1 AND status IN ('paid', 'disputed')",
    )
    .bind(intent)
    .first();
  const w = shopWareById(order?.ware);
  if (!order || !w) {
    if (why === 'refunded')
      await db
        .prepare('UPDATE shop_orders SET refund_owed = 0 WHERE payment_intent = ?1 AND refund_owed = 1')
        .bind(intent)
        .run(); // a refund the service asked, landed
    return { ok: true, applied: 0 };
  }
  if (order.status === 'disputed') {
    if (why !== 'refunded') return { ok: true, applied: 0 }; // a second dispute on a payment already held by one: its word is kept
    const r = await db
      .prepare("UPDATE shop_orders SET status = 'refunded', ended_at = ?2 WHERE id = ?1 AND status = 'disputed'")
      .bind(order.id, nowS)
      .run();
    return { ok: true, applied: Number(r?.meta?.changes ?? 0) };
  }
  const r = await settled(db, order.id, ['paid'], async () => {
    const row = order.player ? await heldRow(db, order.player) : null;
    const after = row ? heldRevoked(row, order, await paidOthers(db, order)) : null;
    const had = row ? shopHeldIds(row) : [],
      has = after ? shopHeldIds(after) : [];
    await db.batch([
      db
        .prepare("UPDATE shop_orders SET status = ?2, ended_at = ?3 WHERE id = ?1 AND status = 'paid'")
        .bind(order.id, why, nowS),
      mustChange(db),
      ...(row ? [rowWrite(db, order.player, row, after), mustChange(db)] : []),
      ...(order.player
        ? [
            postStatement(
              db,
              order.player,
              revokePost(
                order,
                why,
                had.filter((id) => !has.includes(id)),
              ),
              null,
              nowS,
            ),
          ]
        : []), // no ware: a letter with nothing on the account
    ]);
    return { ok: true, applied: 1 };
  });
  if (r.applied && order.player) await closeStale({ db, nowS }, env, fetch, order.player);
  return r;
}

/** A dispute the seller won, or an inquiry closed with no chargeback: the order paid again, what it covers back on the row
 *  and a letter saying so - only while no refund was told of the payment and no other dispute on it stands (AUDIT-
 *  STOREFRONT II A3: a refund ends it refunded). `{ ok, applied }`. */
export async function restoreOrder({ db, nowS }, /** @type {unknown} */ intent) {
  if (typeof intent !== 'string' || !intent) return { ok: true, applied: 0 };
  const order = await db
    .prepare(
      "SELECT id, player, ware, credit, ended_at FROM shop_orders WHERE payment_intent = ?1 AND status = 'disputed'",
    )
    .bind(intent)
    .first();
  const w = shopWareById(order?.ware);
  if (!order?.player || !w) return { ok: true, applied: 0 };
  const fate = await chargeFate(db, intent);
  if (fate.refunded) {
    const r = await db
      .prepare("UPDATE shop_orders SET status = 'refunded' WHERE id = ?1 AND status = 'disputed'")
      .bind(order.id)
      .run();
    return { ok: true, applied: Number(r?.meta?.changes ?? 0) };
  }
  if (fate.disputes) return { ok: true, applied: 0 };
  return settled(db, order.id, ['disputed'], async () => {
    const row = await heldRow(db, order.player),
      after = heldGranted(row, order);
    await db.batch([
      db
        .prepare("UPDATE shop_orders SET status = 'paid', ended_at = NULL WHERE id = ?1 AND status = 'disputed'")
        .bind(order.id),
      mustChange(db),
      rowWrite(db, order.player, row, after),
      mustChange(db),
      // AUDIT AURUM-SPEND F4: bought again with Aurum while the dispute stood - the money stands now, so the Aurum comes back
      db
        .prepare(
          `INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at) SELECT ?1, 'back', ?2, -amount, ?3, ?4
        FROM aurum_ledger WHERE account = ?1 AND kind = 'buy' AND ref = ?5 AND at >= ?6`,
        )
        .bind(order.player, `order:${order.id}`, Math.floor(nowS / 86400), nowS, w.id, Number(order.ended_at ?? 0)),
      postStatement(db, order.player, restorePost(order), w.id, nowS),
    ]);
    return { ok: true, applied: 1 };
  });
}

/**
 * STRIPE'S WORD ON A PAYMENT. The signature first, before a byte is believed; then the event: a checkout paid grants, a
 * checkout that ended unpaid closes its order, a full refund or a dispute takes the ware back, a won dispute returns it.
 * Any other event is acknowledged and changes nothing. `{ ok, applied }`, or `{ error }`: `shop-closed`, `signature`, `body`,
 * `stripe-down` (a refund the service owes, not yet taken - Stripe tells the event again).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} env @param {Uint8Array} body @param {unknown} signature
 * @param {typeof fetch} [fetch] Stripe, to close pages and return payments
 */
export async function shopWebhook(ctx, env, body, signature, fetch) {
  if (!shopOn(env)) return { error: 'shop-closed' };
  if (!(await stripeSignatureOk(String(env.STRIPE_WEBHOOK_SECRET), body, signature, ctx)))
    return { error: 'signature' };
  let ev;
  try {
    ev = JSON.parse(dec.decode(body));
  } catch {
    return { error: 'body' };
  }
  const o = ev?.data?.object;
  if (!o || typeof o !== 'object') return { ok: true, applied: 0 };
  const orderOf = () => (typeof o.metadata?.order === 'string' ? o.metadata.order : o.client_reference_id);
  switch (ev.type) {
    case 'checkout.session.completed':
      if (o.payment_status !== 'paid') return { ok: true, applied: 0 }; // a delayed method: its own event follows
      return fulfilOrder(
        ctx,
        orderOf(),
        { intent: o.payment_intent, amount: o.amount_subtotal ?? o.amount_total, currency: o.currency },
        { env, fetch },
      ); // the price before any tax Stripe adds
    case 'checkout.session.async_payment_succeeded':
      return fulfilOrder(
        ctx,
        orderOf(),
        { intent: o.payment_intent, amount: o.amount_subtotal ?? o.amount_total, currency: o.currency },
        { env, fetch },
      );
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const id = orderOf();
      if (typeof id !== 'string' || !SHOP_ORDER_ID_RE.test(id)) return { ok: true, applied: 0 };
      const r = await ctx.db
        .prepare("UPDATE shop_orders SET status = 'expired', ended_at = ?2 WHERE id = ?1 AND status = 'open'")
        .bind(id, ctx.nowS)
        .run();
      return { ok: true, applied: Number(r?.meta?.changes ?? 0) };
    }
    // AUDIT-STOREFRONT II A1, A3: each word kept by its payment first, so an order paid later reads it
    case 'charge.refunded':
      if (o.refunded !== true || typeof o.payment_intent !== 'string') return { ok: true, applied: 0 }; // a part refund keeps the ware
      await keepWord(ctx.db, o.payment_intent, 'refund', '', 1, ctx.nowS);
      return revokeOrder(ctx, o.payment_intent, 'refunded', { env, fetch });
    case 'charge.dispute.created': {
      if (typeof o.payment_intent !== 'string') return { ok: true, applied: 0 };
      await keepWord(ctx.db, o.payment_intent, 'dispute', String(o.id ?? ''), 1, ctx.nowS);
      const word = await ctx.db
        .prepare("SELECT open FROM shop_charge_words WHERE intent = ?1 AND kind = 'dispute' AND ref = ?2")
        .bind(o.payment_intent.slice(0, 255), String(o.id ?? '').slice(0, 255))
        .first();
      if (Number(word?.open) !== 1) return { ok: true, applied: 0 }; // AUDIT-STOREFRONT III A4: closed in our favour before this word landed
      return revokeOrder(ctx, o.payment_intent, 'disputed', { env, fetch });
    }
    case 'charge.dispute.closed': {
      if (typeof o.payment_intent !== 'string') return { ok: true, applied: 0 };
      const ours = o.status === 'won' || o.status === 'warning_closed'; // an inquiry closed: no chargeback
      await keepWord(ctx.db, o.payment_intent, 'dispute', String(o.id ?? ''), ours ? 0 : 1, ctx.nowS);
      return ours ? restoreOrder(ctx, o.payment_intent) : { ok: true, applied: 0 };
    }
    default:
      return { ok: true, applied: 0 };
  }
}

/**
 * THE SHOP'S OPEN DOORS, answered for index.js: the confirm page (GET, a ticket), the press on it (POST, the ticket as a
 * form), Stripe's webhook (POST, signed), and the two pages Stripe sends the buyer back to. `bytes` the request's body,
 * read and capped by the caller; `limited()` the open routes' address bucket.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: any }} ctx @param {any} env @param {string} path
 * @param {{ method: string, url: URL, bytes: Uint8Array|null, signature: unknown, fetch: typeof fetch, limited: () => Promise<boolean> }} req
 * @returns {Promise<Response|{ json: any, status: number }>}
 */
export async function shopDoor(ctx, env, path, { method, url, bytes, signature, fetch, limited }) {
  if (path === SHOP_WEBHOOK_PATH) {
    if (method !== 'POST') return { json: { error: 'method' }, status: 405 };
    if (!bytes) return { json: { error: 'too-large' }, status: 413 };
    const r = await shopWebhook(ctx, env, bytes, signature, fetch);
    return 'error' in r
      ? {
          json: r,
          status: r.error === 'shop-closed' || r.error === 'stripe-down' ? 503 : r.error === 'signature' ? 401 : 400,
        }
      : { json: r, status: 200 };
  }
  if (path === SHOP_CANCEL_PATH) return shopHtml(SHOP_PAGES.cancel);
  if (path === SHOP_DONE_PATH) {
    const id = url.searchParams.get('o') ?? '';
    const order = SHOP_ORDER_ID_RE.test(id)
      ? await ctx.db.prepare('SELECT ware, status FROM shop_orders WHERE id = ?1').bind(id).first()
      : null;
    return shopHtml(shopDonePage(order));
  }
  if (!shopOn(env)) return shopHtml(SHOP_PAGES.off, 503);
  if (await limited()) return shopHtml(SHOP_PAGES.rate, 429);
  if (path === SHOP_BUY_PATH) {
    if (method !== 'GET') return { json: { error: 'method' }, status: 405 };
    const ticket = url.searchParams.get('t');
    const claims = await openShopTicket(ticket, env, ctx);
    if (!claims) return shopHtml(SHOP_PAGES.expired, 400);
    const ware = /** @type {any} */ (shopWareById(claims.w));
    if (!shopRepeatable(ware)) return shopHtml(SHOP_PAGES.aurum, 410); // AURUM-ONLY
    if (!shopSoldForMoney(env, ware, ctx.nowS)) return shopHtml(SHOP_PAGES.sold, 410);
    const player = await ctx.db
      .prepare(`SELECT id, handle, staff_suspended, ${HELD_COLS} FROM players WHERE id = ?1`)
      .bind(claims.p)
      .first();
    if (!registered(player)) return shopHtml(SHOP_PAGES.account, 403);
    return shopHtml(shopConfirmPage({ handle: player.handle, ware, ticket, cents: ware.cents })); // NOTHING IS WRITTEN on a GET
  }
  if (method !== 'POST') return { json: { error: 'method' }, status: 405 };
  const claims = await openShopTicket(new URLSearchParams(bytes ? dec.decode(bytes) : '').get('ticket'), env, ctx);
  if (!claims) return shopHtml(SHOP_PAGES.expired, 400);
  const r = await shopCheckout(ctx, env, claims, { fetch, origin: url.origin });
  if ('url' in r)
    return new Response(null, {
      status: 303,
      headers: { location: r.url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
    });
  return shopHtml(SHOP_PAGES[/** @type {keyof typeof SHOP_PAGES} */ (r.page)], r.page === 'down' ? 502 : 400);
}
