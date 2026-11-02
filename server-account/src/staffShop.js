// @ts-check
// STOREFRONT (2026-10-29, the developer: "We need to track data to see how demand is changing over time ... To see how
// much was sold in which day ... To get a feeling of what the next 'Launch window' we have"; bible/06-Systems/
// Storefront.md section 3.3): THE SHOP'S DEMAND, an Admin's read beside the staff panel's economy. Each day a ware: the
// orders opened (a press of Buy that reached Stripe), paid, refunded and disputed, and the money paid - read off
// `shop_orders` as they stand, with each day's featured windows (SHOP_FEATURED) beside them; AURUM: and each day's wares
// and what was bought of them for Aurum (`aurum_ledger`'s buys). Writes nothing.
import { SHOP_WARES, SHOP_WARE_NAME, shopFeaturedOf } from '../../src/net/shopLaw.js';
import { dailyWaresAt } from './aurum.js';
import { AURUM_DAILY_FROM } from '../../src/net/aurumLaw.js';

/** The demand's longest reach in days, and its default. */
export const DEMAND_DAYS_MAX = 90;
export const DEMAND_DAYS_DEFAULT = 30;
const DAY_S = 86_400;
/** A UTC day's first second. */
const dayOf = (/** @type {number} */ s) => Math.floor(s / DAY_S) * DAY_S;

/**
 * THE DEMAND over the last `days` UTC days to `nowS`: `{ asOf, from, days: [{ day, featured: [ids], daily: [ids], wares:
 * { [id]: { opened, paid, refunded, disputed, cents, bought, aurum } } }], totals: { [id]: same }, names, refundsOwed }` -
 * a day with no order still has its row, so a chart's axis has no gaps. `bought` and `aurum` a ware's buys for Aurum and the
 * Aurum spent on them. Four reads, the first, second and fourth each on an index (migration 0201).
 * @param {any} db @param {any} env @param {number} nowS @param {number} [days]
 */
export async function shopDemand(db, env, nowS, days = DEMAND_DAYS_DEFAULT) {
  const n = Math.max(1, Math.min(DEMAND_DAYS_MAX, Math.floor(Number(days)) || DEMAND_DAYS_DEFAULT));
  const from = dayOf(nowS) - (n - 1) * DAY_S;
  const [opened, paid, owed, bought] = await db.batch([
    db.prepare('SELECT (created_at / 86400) * 86400 AS day, ware, COUNT(*) AS c FROM shop_orders WHERE created_at >= ?1 AND stripe_session IS NOT NULL GROUP BY day, ware').bind(from),   // AUDIT-STOREFRONT S8: a press that reached Stripe
    db.prepare(`SELECT (paid_at / 86400) * 86400 AS day, ware, status, COUNT(*) AS c, SUM(cents) AS cents FROM shop_orders
      WHERE paid_at >= ?1 AND status IN ('paid', 'refunded', 'disputed') GROUP BY day, ware, status`).bind(from),
    db.prepare('SELECT id, ware, cents, refund, paid_at FROM shop_orders WHERE refund_owed = 1 ORDER BY paid_at LIMIT 100'),   // AUDIT-STOREFRONT S3
    db.prepare("SELECT day * 86400 AS day, ref AS ware, COUNT(*) AS c, -SUM(amount) AS aurum FROM aurum_ledger WHERE kind = 'buy' AND day >= ?1 GROUP BY day, ref").bind(from / DAY_S),   // AURUM
  ]);
  const schedule = shopFeaturedOf(env?.SHOP_FEATURED);
  /** @type {any[]} */ const rows = [];
  for (let d = from; d <= dayOf(nowS); d += DAY_S) {
    const featured = schedule.filter((e) => e.fromMs < (d + DAY_S) * 1000 && e.toMs > d * 1000).map((e) => e.id);
    rows.push({ day: d, featured: [...new Set(featured)], daily: d < AURUM_DAILY_FROM * DAY_S ? [] : dailyWaresAt(env, d), wares: {} });   // AUDIT-STOREFRONT III A7: no wares before the rotation ran
  }
  const cell = (/** @type {number} */ day, /** @type {string} */ ware) => {
    const r = rows.find((x) => x.day === day);
    if (!r) return null;
    return (r.wares[ware] ??= { opened: 0, paid: 0, refunded: 0, disputed: 0, cents: 0, bought: 0, aurum: 0 });
  };
  for (const o of opened?.results ?? []) { const c = cell(Number(o.day), String(o.ware)); if (c) c.opened += Number(o.c) || 0; }
  for (const p of paid?.results ?? []) {
    const c = cell(Number(p.day), String(p.ware));
    if (!c) continue;
    // a refunded or disputed order was paid on its day first: it counts as paid there, and its loss beside it
    c.paid += Number(p.c) || 0;
    if (p.status === 'paid') c.cents += Number(p.cents) || 0;
    else c[p.status === 'refunded' ? 'refunded' : 'disputed'] += Number(p.c) || 0;
  }
  for (const b of bought?.results ?? []) { const c = cell(Number(b.day), String(b.ware)); if (c) { c.bought += Number(b.c) || 0; c.aurum += Number(b.aurum) || 0; } }
  /** @type {Record<string, any>} */ const totals = {};
  for (const r of rows) for (const [id, c] of Object.entries(r.wares)) {
    const t = (totals[id] ??= { opened: 0, paid: 0, refunded: 0, disputed: 0, cents: 0, bought: 0, aurum: 0 });
    for (const k of Object.keys(t)) t[k] += /** @type {any} */ (c)[k];
  }
  const names = Object.fromEntries(SHOP_WARES.filter((w) => w.alone).map((w) => [w.id, SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (w.id)] ?? w.id]));
  // AUDIT-STOREFRONT S3: the payments the service returns itself that Stripe has not taken yet - Stripe asks again on its
  // own; one standing here for a day is an owner's refund by hand
  const refundsOwed = (owed?.results ?? []).map((/** @type {any} */ o) => ({ order: String(o.id), ware: String(o.ware), cents: Number(o.cents) || 0, why: String(o.refund ?? ''), paidAt: Number(o.paid_at) || 0 }));
  return { asOf: nowS, from, days: rows, totals, names, refundsOwed };
}
