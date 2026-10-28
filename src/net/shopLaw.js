// @ts-check
// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop"; bible/06-Systems/Shop.md): THE SHOP'S LAW, read by the account service (server-account/src/shop.js), the
// pause face's window (ui/enhanced/enhancedShop.js) and the Collections catalogue. A ware is a cosmetic the ACCOUNT
// keeps, bought once with money: the service records the sale as a bit on the row, so what is held is still read off
// the row at every ask (server-account/src/titles.js), and the relay sees it only in the signed token.
// Pure. Not a DFU member - Daggerfall Unity has no accounts. Ledger A (SHOP).
import { TITLES, AURAS, GLYPHS } from './identityToken.js';

/** The currency every price is charged in, as Stripe spells it. */
export const SHOP_CURRENCY = 'usd';
/** The shop's sections, in the window's order - one a kind of ware. */
export const SHOP_CATEGORIES = Object.freeze(['titles', 'glyphs', 'auras']);
/** The kind of ware each section holds. */
export const SHOP_CATEGORY_KIND = Object.freeze({ titles: 'title', glyphs: 'glyph', auras: 'aura' });

const ware = (/** @type {string} */ kind, /** @type {string} */ key, /** @type {number} */ cents, /** @type {number} */ bit) => Object.freeze({
  id: `${kind}:${key}`, kind, key, category: `${kind}s`, cents, bit, preAlpha: true,
});
/** THE WARES, in the window's order: `cents` the price in US cents (the owner's: $5, $2, $20); `bit` the sale's bit on
 *  the row (`players.shop_wares`, migration 0189) - never renumbered, since a stored bit is a sale that happened. Every
 *  one is pre-alpha only: sold while SHOP_ON_SALE names it, and gone from sale when the owner takes it off. */
export const SHOP_WARES = Object.freeze([
  ware('title', 'genesis', 500, 1),
  ware('glyph', 'origin', 200, 2),
  ware('aura', 'eternal', 2000, 4),
]);
/** A ware's name and kind in English, for the service's pages, Stripe's line and the receipt (the client's own words
 *  are playerBadge.js TITLE_TEXT, AURA_TEXT and enhancedAccount.js GLYPH_LABEL - a pin holds the names equal). */
export const SHOP_WARE_NAME = Object.freeze({ 'title:genesis': 'Genesis', 'glyph:origin': 'Origin', 'aura:eternal': 'Eternal' });
export const SHOP_KIND_NAME = Object.freeze({ title: 'title', glyph: 'glyph', aura: 'aura' });
/** A ware by its id (`kind:key`), or null. */
export const shopWareById = (/** @type {unknown} */ id) => SHOP_WARES.find((w) => w.id === id) ?? null;
/** Every ware's key is in the token's vocabulary - a ware no token could carry would be a sale nobody sees. */
export const shopVocabularyOk = () => SHOP_WARES.every((w) => ({ title: TITLES, aura: AURAS, glyph: GLYPHS })[w.kind]?.includes(w.key));
/** Every bit once, and the bits the column may hold together. */
export const SHOP_BITS_ALL = SHOP_WARES.reduce((a, w) => a | w.bit, 0);

/** The ware ids a row's `shop_wares` bits hold, in the wares' order. A bit no ware has is not held. Pure. */
export function shopHeldOf(/** @type {unknown} */ bits) {
  const b = Number(bits);
  if (!Number.isSafeInteger(b) || b <= 0) return [];
  return SHOP_WARES.filter((w) => (b & w.bit) !== 0).map((w) => w.id);
}
/** The keys of one kind (`title`, `glyph`, `aura`) a row's bits hold, in the wares' order. Pure. */
export const shopKeysOf = (/** @type {unknown} */ bits, /** @type {string} */ kind) => {
  const held = shopHeldOf(bits);
  return SHOP_WARES.filter((w) => w.kind === kind && held.includes(w.id)).map((w) => w.key);
};

/** WHAT IS ON SALE, off the service's config (`SHOP_ON_SALE = "title:genesis,glyph:origin,aura:eternal"`): the wares it
 *  names, in the wares' order. A word that is no ware's id is not read. The owner ends a sale by taking its id off. */
export function shopOnSaleOf(/** @type {unknown} */ raw) {
  if (typeof raw !== 'string' || !raw) return [];
  const named = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  return SHOP_WARES.filter((w) => named.has(w.id)).map((w) => w.id);
}

/** A price in words, in the player's own form where the platform can say it ("$5.00"). Pure but for Intl. */
export function shopPriceText(/** @type {number} */ cents, locale = 'en-US') {
  const n = Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: SHOP_CURRENCY.toUpperCase() }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
}

/** An order's id: the service's own, 24 lower-case hex (a letter's batch is `shop-<id>`). */
export const SHOP_ORDER_ID_RE = /^[0-9a-f]{24}$/;
/** The receipt letter's batch for an order - one letter an order (0093's one-a-batch index). */
export const shopReceiptBatch = (/** @type {string} */ orderId) => `shop-${orderId}`;


/**
 * THE SHOP'S CARD as the account read carries it (`/v1/account`'s `shop`), checked on the way in: `{ on, wares }` - `on`
 * whether the service takes payments, each ware `{ id, sale, held, buy }` (`buy` the service's own https link, or
 * null). Null for anything else, which draws the catalogue with nothing to buy. Pure.
 * @param {any} card
 */
export function shopCardOf(card) {
  if (!card || typeof card !== 'object' || typeof card.on !== 'boolean') return null;
  const rows = Array.isArray(card.wares) ? card.wares : [];
  const wares = [];
  for (const r of rows) {
    const w = shopWareById(r?.id);
    if (!w || wares.some((x) => x.id === w.id)) continue;
    const buy = typeof r.buy === 'string' && r.buy.startsWith('https://') && r.buy.length <= 2048 ? r.buy : null;
    wares.push({ id: w.id, sale: r.sale === true, held: r.held === true, buy: card.on && r.sale === true && r.held !== true ? buy : null });
  }
  return { on: card.on, wares };
}
