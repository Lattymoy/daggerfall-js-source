// AURUM-ONLY (2026-10-30, the owner: "nothing should cost money money anymore"): the shop sells only Aurum packs for
// money now, so a test of what the service does with a paid ITEM - its grant, a refund, a dispute, a bundle's credit -
// opens the order as one made before the switch: the row and its Stripe session as shopCheckout wrote them
// (server-account/src/shop.js), with no page pressed. Live orders of the pre-alpha wares are such orders.
import { SHOP_CHECKOUT_S } from '../../server-account/src/shop.js';

let made = 0;
/**
 * An open order made before AURUM-ONLY: `ware` for `who` at `cents` (its money page's price), `credit` what that price
 * took off (shopLaw.js shopCreditOf, space-separated), its Stripe session `cs_legacy_<n>`. Answers the row.
 * @param {any} raw the stand's SQLite (`s.env.DB._raw`) @param {{ id: string }} who @param {string} ware
 * @param {{ cents: number, credit?: string, nowS?: number }} o
 */
export function legacyOrder(raw, who, ware, { cents, credit = '', nowS = Math.floor(Date.now() / 1000) }) {
  made++;
  const id = made.toString(16).padStart(24, 'a'), session = `cs_legacy_${made}`;
  raw.prepare(`INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at, credit, aurum, stripe_session, stripe_url)
    VALUES (?, ?, ?, ?, 'usd', 'open', ?, ?, ?, 0, ?, ?)`).run(id, who.id, ware, cents, nowS, nowS + SHOP_CHECKOUT_S, credit, session, `https://checkout.stripe.com/c/pay/${session}`);
  return raw.prepare('SELECT * FROM shop_orders WHERE id = ?').get(id);
}
