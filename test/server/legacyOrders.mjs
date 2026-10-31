// AURUM-ONLY (2026-10-30, the owner: "nothing should cost money money anymore"): the shop sells only Aurum packs for
// money now, so a test of what the service does with a paid ITEM - its grant, a refund, a dispute, a bundle's credit -
// opens the order as one made before the switch: the row and its Stripe session as shopCheckout wrote them
// (server-account/src/shop.js), with no page pressed. Live orders of the pre-alpha wares are such orders.
import { randomBytes } from 'node:crypto';
import { SHOP_CHECKOUT_S } from '../../server-account/src/shop.js';
import { shopWareById, shopHeldIds, shopCreditOf, SHOP_MIN_CENTS } from '../../src/net/shopLaw.js';

/** Each item's price in US cents before AURUM-ONLY (AUDIT-STOREFRONT II's sheet) - what a page opened then charged. */
export const LEGACY_CENTS = Object.freeze({
  'kill:ashen': 499, 'kill:voidrend': 999, 'kill:pyre': 1499, 'portal:runic': 799, 'portal:daedric': 1299, 'portal:aetheric': 1999,
  'mount:spectral': 999, 'mount:dawnfire': 1499, 'mount:warhorse': 2499, 'title:genesis': 500, 'glyph:origin': 200,
  'title:dawnbringer': 399, 'title:voidwalker': 699, 'title:eternalchampion': 999, 'glyph:oblivion': 299, 'glyph:gatesigil': 299,
  'aura:eternal': 2000, 'aura:dominion': 1499, 'armory:eternalset': 2000, 'armory:eternalhalo': 600, 'armory:eternalsigil': 600,
  'armory:eternalarmlets': 600, 'armory:eternalgreaves': 600, 'armory:eternaledge': 600,
  'bundle:daedricchampion': 2799, 'bundle:portalmaster': 1999, 'bundle:lordofoblivion': 2999,
});
const worth = (/** @type {string} */ id) => { const w = shopWareById(id); return !w ? 0 : w.gives.length ? w.gives.reduce((a, g) => a + worth(g), 0) : LEGACY_CENTS[/** @type {keyof typeof LEGACY_CENTS} */ (id)] ?? 0; };
const left = (/** @type {string} */ id, /** @type {string[]} */ held) => { const w = shopWareById(id); return !w || held.includes(id) ? 0 : w.gives.length ? w.gives.reduce((a, g) => a + left(g, held), 0) : LEGACY_CENTS[/** @type {keyof typeof LEGACY_CENTS} */ (id)] ?? 0; };
/** An item's money price for a row before AURUM-ONLY: a giver's share of what it gives not held (never under Stripe's
 *  floor), any other its own; null when owned - the old shopPriceFor, in cents. */
export function legacyCentsFor(/** @type {unknown} */ row, /** @type {string} */ id) {
  const c = LEGACY_CENTS[/** @type {keyof typeof LEGACY_CENTS} */ (id)], w = shopWareById(id);
  if (!c || !w) return null;
  const l = left(id, shopHeldIds(row));
  if (l === 0) return null;
  return w.gives.length ? Math.max(SHOP_MIN_CENTS, Math.min(c, Math.round((c * l) / worth(id)))) : c;
}
/** A page for an item opened before AURUM-ONLY by a row as it stands: its legacy price and the credit that price took off. */
export const legacyPageFor = (/** @type {any} */ raw, /** @type {{ id: string }} */ who, /** @type {string} */ ware, /** @type {any} */ row) =>
  legacyOrder(raw, who, ware, { cents: /** @type {number} */ (legacyCentsFor(row, ware)), credit: shopCreditOf(row, ware).join(' ') });

let made = 0;
/**
 * An open order made before AURUM-ONLY: `ware` for `who` at `cents` (its money page's price), `credit` what that price
 * took off (shopLaw.js shopCreditOf, space-separated), its Stripe session `cs_legacy_<n>`. Answers the row.
 * @param {any} raw the stand's SQLite (`s.env.DB._raw`) @param {{ id: string }} who @param {string} ware
 * @param {{ cents: number, credit?: string, nowS?: number }} o
 */
export function legacyOrder(raw, who, ware, { cents, credit = '', nowS = Math.floor(Date.now() / 1000) }) {
  made++;
  const id = randomBytes(12).toString('hex'), session = `cs_legacy_${made}`;   // as mintOrderId mints them: a test's `pi_<ware>_<id's head>` its own
  raw.prepare(`INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at, credit, aurum, stripe_session, stripe_url)
    VALUES (?, ?, ?, ?, 'usd', 'open', ?, ?, ?, 0, ?, ?)`).run(id, who.id, ware, cents, nowS, nowS + SHOP_CHECKOUT_S, credit, session, `https://checkout.stripe.com/c/pay/${session}`);
  return raw.prepare('SELECT * FROM shop_orders WHERE id = ?').get(id);
}
