// @ts-check
// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop ... with a strict disclaimer that all proceeds go towards development costs"; bible/06-Systems/Shop.md): THE
// SHOP'S SIDE OF THE SERVICE. What a ware is lives in src/net/shopLaw.js; this file sells one. Stripe takes the money on
// its own hosted page, so no card number ever reaches this service, and Stripe's signed word on a payment is the one
// thing that grants: the ware's bit on the row and a receipt in the mailbox, in one batch.
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
} from '../../src/net/shopLaw.js';
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
/** How long Stripe's page stays up (s): its own floor is thirty minutes, and a minute more covers the clocks' skew. */
export const SHOP_CHECKOUT_S = 31 * 60;
/** How old a signed webhook may be (s) - Stripe's own default tolerance. */
export const SHOP_HOOK_TOLERANCE_S = 300;
/** A Stripe event's body is a few kilobytes; this is room for any and still a bound before a byte is believed. */
export const SHOP_HOOK_MAX_BYTES = 256 * 1024;
export const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';
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
const registered = (/** @type {any} */ p) => typeof p?.handle === 'string' && !!p.handle;
const hex = (/** @type {Uint8Array} */ b) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
/** A new order's id: 24 hex off the Worker's own randomness. */
export const mintOrderId = (/** @type {(b: Uint8Array) => Uint8Array} */ rand) => hex(rand(new Uint8Array(12)));

/** A ware's line as a person reads it: "Genesis (title)". */
export const wareLine = (/** @type {any} */ w) =>
  `${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)] ?? w.key} (${SHOP_KIND_NAME[/** @type {keyof typeof SHOP_KIND_NAME} */ (w.kind)] ?? w.kind})`;

/**
 * THE SHOP'S CARD in the account read: `{ on, wares }`, each ware `{ id, sale, held, buy }` - `buy` a link to this
 * service's own confirm page, its ticket sealed for this account and ware, while the shop is on, the ware on sale and
 * not held, and the account registered (every grant asks one). Patreon's way: the window has the link before it is
 * pressed, so the press opens it at once (a window opened after an await is a popup a phone blocks).
 */
export async function shopCardOf(/** @type {any} */ player, /** @type {any} */ env, { subtle, rand, nowS, origin }) {
  const on = shopOn(env);
  const sale = shopOnSale(env);
  const wares = [];
  let key = null; // derived once a read, at its first Buy link - every account read asks this
  for (const w of SHOP_WARES) {
    const isHeld = registered(player) && (shopOwns(player?.shop_wares, w.id) || holdsAll(player, env)),
      onSale = sale.includes(w.id); // ARMORY: a set's pieces, or the set's through its pieces
    if (on && onSale && !isHeld && registered(player))
      key ??= await sealKey(subtle, String(env.STRIPE_SECRET_KEY), SEAL_SALT, 'buy');
    const buy =
      key && onSale && !isHeld
        ? `${origin}${SHOP_BUY_PATH}?t=${await sealUnder(key, { p: player.id, w: w.id, x: nowS + SHOP_TICKET_S }, { subtle, rand })}`
        : null;
    wares.push({ id: w.id, sale: onSale, held: isHeld, buy });
  }
  return { on, wares };
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
export function shopConfirmPage({ handle, ware, ticket }) {
  return {
    heading: `Buy ${wareLine(ware)}`,
    lines: [
      `Game account: ${handle}`,
      `Price: ${shopPriceText(ware.cents)} (USD), paid once.`,
      "Stripe can show the price in your own currency, with your country's ways to pay.",
      'A pre-alpha item: it is sold only during the pre-alpha.',
      SHOP_COSMETIC,
      SHOP_PROCEEDS,
      'Not your game account? Close this page. Nothing is charged.',
    ],
    form: { action: SHOP_CHECKOUT_PATH, ticket, label: `Pay ${shopPriceText(ware.cents)} on Stripe` },
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
        'Go back to the game: wear it from your profile. A receipt is in your mailbox.',
        SHOP_PROCEEDS,
      ],
    };
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
  /** @type {{ id: string, player: string, handle: string, ware: any, origin: string, expiresAt: number }} */ o,
) {
  return {
    mode: 'payment',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': SHOP_CURRENCY,
    'line_items[0][price_data][unit_amount]': o.ware.cents,
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
  if (!shopOnSale(env).includes(ware.id)) return { page: 'sold' };
  const player = await db
    .prepare('SELECT id, handle, shop_wares, staff_suspended FROM players WHERE id = ?1')
    .bind(claims.p)
    .first();
  if (!registered(player)) return { page: 'account' };
  if (shopOwns(player.shop_wares, ware.id) || holdsAll(player, env)) return { page: 'held' }; // ADMIN-ALL
  const open = await db
    .prepare(
      "SELECT stripe_url FROM shop_orders WHERE player = ?1 AND ware = ?2 AND status = 'open' AND expires_at > ?3 AND stripe_url IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    )
    .bind(player.id, ware.id, nowS + 60)
    .first();
  if (open?.stripe_url) return { url: open.stripe_url };
  const id = mintOrderId(rand),
    expiresAt = nowS + SHOP_CHECKOUT_S;
  await db
    .prepare(
      "INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, 'open', ?6, ?7)",
    )
    .bind(id, player.id, ware.id, ware.cents, SHOP_CURRENCY, nowS, expiresAt)
    .run();
  const s = await stripeCheckout(
    fetch,
    env,
    checkoutFields({ id, player: player.id, handle: player.handle, ware, origin, expiresAt }),
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
  return { url: s.url };
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

/** THE RECEIPT, its words fixed here (a letter no player writes - post.js's law). Pure. */
export function receiptPost(/** @type {any} */ order, /** @type {number} */ nowS) {
  const w = /** @type {any} */ (shopWareById(order.ware));
  const day = new Date(nowS * 1000).toISOString().slice(0, 10);
  return {
    batch: shopReceiptBatch(order.id),
    subject: `Thank you: ${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)]}`,
    body: [
      `${wareLine(w)} is yours, on every character of your account.`,
      '',
      'Wear it from your profile, or from the Collections page.',
      '',
      `Paid: ${shopPriceText(order.cents)} (USD) on ${day}. Order ${order.id}.`,
      `${SHOP_PROCEEDS} ${SHOP_COSMETIC}`,
      '',
      `- ${POST_SENDER}`,
    ].join('\n'),
  };
}
/** The letter a refund or a dispute sends, its words fixed too. Pure. */
export function revokePost(/** @type {any} */ order, /** @type {string} */ why) {
  const w = /** @type {any} */ (shopWareById(order.ware));
  return {
    batch: `${shopReceiptBatch(order.id)}-${why === 'disputed' ? 'disputed' : 'refunded'}`, // a letter a reason: a dispute, then a refund, both said
    subject: `${why === 'disputed' ? 'Payment disputed' : 'Refunded'}: ${SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)]}`,
    body: [
      why === 'disputed'
        ? `The payment for ${wareLine(w)} was disputed, so it is off your account while the dispute stands.`
        : `The payment for ${wareLine(w)} was refunded, so it is off your account.`,
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

/**
 * A PAYMENT TAKEN: the order paid, the ware's bit on the row and the receipt in the mailbox - one batch, guarded on the
 * order moving from open (or expired, a payment Stripe finished late), so a webhook Stripe sends twice grants once.
 * The amount and currency Stripe took must be the order's. `{ ok, applied }`.
 * @param {{ db: any, nowS: number }} ctx @param {string} orderId @param {{ intent?: unknown, amount?: unknown, currency?: unknown }} paid
 */
export async function fulfilOrder({ db, nowS }, orderId, { intent = null, amount, currency }) {
  if (typeof orderId !== 'string' || !SHOP_ORDER_ID_RE.test(orderId)) return { ok: true, applied: 0 };
  const order = await db
    .prepare('SELECT id, player, ware, cents, currency, status FROM shop_orders WHERE id = ?1')
    .bind(orderId)
    .first();
  const w = shopWareById(order?.ware);
  if (!order?.player || !w || !['open', 'expired'].includes(order.status)) return { ok: true, applied: 0 };
  if (Number(amount) !== order.cents || String(currency).toLowerCase() !== order.currency) {
    console.error("[shop] paid amount is not the order's", order.id, amount, currency, order.cents); // charged, not granted: an owner's refund or grant
    return { ok: true, applied: 0, mismatch: true };
  }
  try {
    await db.batch([
      db
        .prepare(
          "UPDATE shop_orders SET status = 'paid', paid_at = ?2, payment_intent = ?3 WHERE id = ?1 AND status IN ('open', 'expired')",
        )
        .bind(order.id, nowS, typeof intent === 'string' ? intent.slice(0, 255) : null),
      mustChange(db),
      db.prepare('UPDATE players SET shop_wares = shop_wares | ?2 WHERE id = ?1').bind(order.player, w.bit),
      postStatement(db, order.player, receiptPost(order, nowS), w.id, nowS),
    ]);
  } catch (e) {
    if (await moved(db, order.id, ['open', 'expired'])) return { ok: true, applied: 0 }; // paid meanwhile by Stripe's other word on it - the guard held
    throw e; // the grant never written: a 5xx, and Stripe tells it again
  }
  return { ok: true, applied: 1 };
}

/** Whether an order left the states a batch was guarded on - another word on it landed first. */
const moved = async (/** @type {any} */ db, /** @type {string} */ id, /** @type {string[]} */ from) =>
  !from.includes((await db.prepare('SELECT status FROM shop_orders WHERE id = ?1').bind(id).first())?.status);

/**
 * A PAYMENT TAKEN BACK (a full refund, a dispute opened): the order marked, and the ware's bit off the row unless
 * another paid order holds the same ware - and a letter saying so. `{ ok, applied }`.
 * @param {{ db: any, nowS: number }} ctx @param {unknown} intent Stripe's payment @param {'refunded'|'disputed'} why
 */
export async function revokeOrder({ db, nowS }, intent, why) {
  if (typeof intent !== 'string' || !intent) return { ok: true, applied: 0 };
  const order = await db
    .prepare("SELECT id, player, ware FROM shop_orders WHERE payment_intent = ?1 AND status = 'paid'")
    .bind(intent)
    .first();
  const w = shopWareById(order?.ware);
  if (!order || !w) return { ok: true, applied: 0 };
  try {
    await db.batch([
      db
        .prepare("UPDATE shop_orders SET status = ?2, ended_at = ?3 WHERE id = ?1 AND status = 'paid'")
        .bind(order.id, why, nowS),
      mustChange(db),
      db
        .prepare(
          `UPDATE players SET shop_wares = shop_wares & ~?2 WHERE id = ?1
        AND NOT EXISTS (SELECT 1 FROM shop_orders WHERE player = ?1 AND ware = ?3 AND status = 'paid' AND id <> ?4)`,
        )
        .bind(order.player, w.bit, w.id, order.id),
      ...(order.player ? [postStatement(db, order.player, revokePost(order, why), null, nowS)] : []), // no ware: a letter with nothing on the account
    ]);
  } catch (e) {
    if (await moved(db, order.id, ['paid'])) return { ok: true, applied: 0 };
    throw e;
  }
  return { ok: true, applied: 1 };
}

/** A dispute the seller won, or an inquiry closed with no chargeback: the order paid again, its ware back on the row and a
 *  letter saying so. `{ ok, applied }`. */
export async function restoreOrder({ db, nowS }, /** @type {unknown} */ intent) {
  if (typeof intent !== 'string' || !intent) return { ok: true, applied: 0 };
  const order = await db
    .prepare("SELECT id, player, ware FROM shop_orders WHERE payment_intent = ?1 AND status = 'disputed'")
    .bind(intent)
    .first();
  const w = shopWareById(order?.ware);
  if (!order?.player || !w) return { ok: true, applied: 0 };
  try {
    await db.batch([
      db
        .prepare("UPDATE shop_orders SET status = 'paid', ended_at = NULL WHERE id = ?1 AND status = 'disputed'")
        .bind(order.id),
      mustChange(db),
      db.prepare('UPDATE players SET shop_wares = shop_wares | ?2 WHERE id = ?1').bind(order.player, w.bit),
      postStatement(db, order.player, restorePost(order), w.id, nowS),
    ]);
  } catch (e) {
    if (await moved(db, order.id, ['disputed'])) return { ok: true, applied: 0 };
    throw e;
  }
  return { ok: true, applied: 1 };
}

/**
 * STRIPE'S WORD ON A PAYMENT. The signature first, before a byte is believed; then the event: a checkout paid grants, a
 * checkout that ended unpaid closes its order, a full refund or a dispute takes the ware back, a won dispute returns it.
 * Any other event is acknowledged and changes nothing. `{ ok, applied }`, or `{ error }`: `shop-closed`, `signature`, `body`.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} env @param {Uint8Array} body @param {unknown} signature
 */
export async function shopWebhook(ctx, env, body, signature) {
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
      return fulfilOrder(ctx, orderOf(), {
        intent: o.payment_intent,
        amount: o.amount_subtotal ?? o.amount_total,
        currency: o.currency,
      }); // the price before any tax Stripe adds
    case 'checkout.session.async_payment_succeeded':
      return fulfilOrder(ctx, orderOf(), {
        intent: o.payment_intent,
        amount: o.amount_subtotal ?? o.amount_total,
        currency: o.currency,
      });
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
    case 'charge.refunded':
      return o.refunded === true ? revokeOrder(ctx, o.payment_intent, 'refunded') : { ok: true, applied: 0 }; // a part refund keeps the ware
    case 'charge.dispute.created':
      return revokeOrder(ctx, o.payment_intent, 'disputed');
    case 'charge.dispute.closed':
      return o.status === 'won' || o.status === 'warning_closed'
        ? restoreOrder(ctx, o.payment_intent)
        : { ok: true, applied: 0 }; // an inquiry closed: no chargeback
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
    const r = await shopWebhook(ctx, env, bytes, signature);
    return 'error' in r
      ? { json: r, status: r.error === 'shop-closed' ? 503 : r.error === 'signature' ? 401 : 400 }
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
    if (!shopOnSale(env).includes(ware.id)) return shopHtml(SHOP_PAGES.sold, 410);
    const player = await ctx.db
      .prepare('SELECT id, handle, shop_wares, staff_suspended FROM players WHERE id = ?1')
      .bind(claims.p)
      .first();
    if (!registered(player)) return shopHtml(SHOP_PAGES.account, 403);
    if (shopOwns(player.shop_wares, ware.id) || holdsAll(player, env)) return shopHtml(SHOP_PAGES.held, 409); // ADMIN-ALL
    return shopHtml(shopConfirmPage({ handle: player.handle, ware, ticket })); // NOTHING IS WRITTEN on a GET
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
