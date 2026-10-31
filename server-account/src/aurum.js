// @ts-check
// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased to be
// used to purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md): THE AURUM AS THE SERVICE KEEPS IT.
// A balance is never stored: it is counted at every ask from the account's paid packs (shop.js sells them) and the
// ledger's lines - what the finds, the challenges, the week's witnessed deeds (migration 0201's triggers) and the caches
// gave, and what the pass and the shop's wares cost. So a refund takes a pack's Aurum back by its order's status. The law
// both ends read is src/net/aurumLaw.js. AURUM-ONLY (2026-10-30): every ware is bought here (buyWare), money buys packs.
import { shopCreditOf, shopClosure, shopOwns, shopWareById, shopOnSaleOf, shopFeaturedOf, shopDropped, shopSellable, shopPriceFor, shopRepeatable } from '../../src/net/shopLaw.js';
import { AURUM_DEEDS, aurumSwitchOf, aurumDailyOf, aurumDayEndMs, aurumWeekOf, aurumWeekEndMs, aurumDealOf } from '../../src/net/aurumLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { isDeveloper, holdsAll } from './titles.js';   // ADMIN-ALL: an admin holds every daily ware, so is sold none
import { mustChange } from './realm.js';

const DAY_MS = 86_400_000;
/** Whether Aurum is open to this account: AURUM_OPEN 'on', or 'dev' and a developer. */
export const aurumOpenFor = (/** @type {any} */ player, /** @type {any} */ env) => {
  const s = aurumSwitchOf(env?.AURUM_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
};
/** The answer's status by refusal. */
export const AURUM_STATUS = Object.freeze({ 'aurum-guest': 403, 'aurum-closed': 409, 'aurum-ware': 400, 'aurum-sale': 409, 'aurum-price': 409, 'aurum-held': 409, 'aurum-short': 409, 'aurum-busy': 503 });

const int = (/** @type {unknown} */ v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
/** The Aurum an account's paid packs gave, and its ledger's sum - each bound to the account at ?1. A balance is their
 *  sum: AURUM_BALANCE_SQL, which a spend's own statement reads, so the guard is the balance as it stands then. */
export const PACKS_SQL = "(SELECT COALESCE(SUM(aurum), 0) FROM shop_orders WHERE player = ?1 AND status = 'paid')";
export const LINES_SQL = '(SELECT COALESCE(SUM(amount), 0) FROM aurum_ledger WHERE account = ?1)';
export const AURUM_BALANCE_SQL = `(${PACKS_SQL} + ${LINES_SQL})`;
/** The row as a balance reads it: what it holds, the pass's items, and its packs' and lines' Aurum. */
export const aurumRow = (/** @type {any} */ db, /** @type {string} */ id) =>
  db.prepare(`SELECT shop_wares, shop_held, pass_items, ${PACKS_SQL} AS packs, ${LINES_SQL} AS lines FROM players WHERE id = ?1`).bind(id).first();
/** A row's balance: its packs' Aurum and its lines'. */
export const balanceOfRow = (/** @type {any} */ row) => int(row?.packs) + int(row?.lines);

/** THE SALE THE DAILY WARES READ, per config: what SHOP_ON_SALE names (a daily ware too - the owner's one list), dropped
 *  by SHOP_FEATURED's first window, and a limited window holding the whole UTC day where the schedule marks one
 *  (AUDIT-STOREFRONT III A3: a window shut mid-day sold the ware for Aurum past it). `cache` the rotation's
 *  (aurumLaw.js aurumDailyOf), one a config, kept for the isolate. */
const sales = /** @type {Map<string, { eligible: (id: string, day: number) => boolean, cache: any }>} */ (new Map());
export function dailySaleOf(/** @type {any} */ env) {
  const key = `${env?.SHOP_ON_SALE ?? ''}\n${env?.SHOP_FEATURED ?? ''}`;
  let s = sales.get(key);
  if (!s) {
    const onSale = shopOnSaleOf(env?.SHOP_ON_SALE), featured = shopFeaturedOf(env?.SHOP_FEATURED);
    const eligible = (/** @type {string} */ id, /** @type {number} */ day) => {
      const w = shopWareById(id), at = day * DAY_MS;
      if (!w || !onSale.includes(id) || !shopDropped(w, featured, at)) return false;
      const limits = featured.filter((e) => e.id === id && e.limited);
      return !limits.length || limits.some((e) => at >= e.fromMs && at + DAY_MS <= e.toMs);
    };
    if (sales.size > 4) sales.clear();
    sales.set(key, s = { eligible, cache: {} });
  }
  return s;
}
/** The day's wares at `nowS`, by the config's sale. */
export const dailyWaresAt = (/** @type {any} */ env, /** @type {number} */ nowS) => { const s = dailySaleOf(env); return aurumDailyOf(utcDay(nowS), s.eligible, s.cache); };
/** AURUM-ONLY: whether a ware is sold for Aurum at `nowS` - on sale by the config (shopLaw.js shopSellable), never a pack. */
export const soldForAurum = (/** @type {any} */ env, /** @type {any} */ w, /** @type {number} */ nowS) =>
  !!w && !shopRepeatable(w) && shopSellable(w, shopOnSaleOf(env?.SHOP_ON_SALE), shopFeaturedOf(env?.SHOP_FEATURED), nowS * 1000);
/** AURUM-ONLY: A WARE'S AURUM PRICE FOR A ROW at `nowS` - its share for a giver (shopPriceFor), a quarter off on its deal
 *  day - with whether it is today's deal; null when the row owns it. `deals` the day's, as dailyWaresAt answers. */
export function aurumPriceAt(/** @type {any} */ row, /** @type {any} */ w, /** @type {ReadonlyArray<string>} */ deals) {
  const list = shopPriceFor(row, w.id);
  if (list === null) return null;
  const deal = deals.includes(w.id);
  return { price: deal ? aurumDealOf(list) : list, deal };
}

/**
 * THE AURUM'S CARD on the account read (aurumLaw.js aurumCardOf reads it): whether it is open to this account, the
 * balance, the day's wares with what this account holds of them, and the week's deeds struck. A guest's is null - a guest
 * cannot buy, and its deeds strike no Aurum (every claim that strikes one refuses a guest).
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function aurumCardOf({ db, nowS }, player, env) {
  if (!player?.handle) return null;
  const week = aurumWeekOf(nowS), day = utcDay(nowS);
  const [row, deeds] = await Promise.all([
    aurumRow(db, player.id),
    db.prepare("SELECT ref, amount FROM aurum_ledger WHERE account = ?1 AND kind = 'deed' AND ref LIKE ?2").bind(player.id, `%:${week}`).all(),
  ]);
  const struck = /** @type {Record<string, number>} */ ({});
  for (const r of deeds?.results ?? []) { const k = String(r.ref).split(':')[0]; if (Object.hasOwn(AURUM_DEEDS, k)) struck[k] = int(r.amount); }
  return {
    open: aurumOpenFor(player, env),
    balance: balanceOfRow(row),
    daily: { until: aurumDayEndMs(day), wares: dailyWaresAt(env, nowS).map((id) => ({ id, held: shopOwns(row, id) || holdsAll(player, env) })) },
    week: { until: aurumWeekEndMs(week), deeds: struck },
  };
}

/**
 * A WARE BOUGHT FOR AURUM (AURUM-ONLY: any but a pack), sold now or a deal today, at this row's price (aurumPriceAt) -
 * and at `body.price`, the page's, when it says one: a price moved since is told, never spent. ONE TRANSACTION: the line
 * written only while the balance covers the price, the ware put on the row only while the row is the one read; a row
 * moved meanwhile is read again, three times. `{ ok, ware, spent, row }` or `{ error }`: aurum-guest, -closed, -ware,
 * -sale, -price (with `price`), -held, -short (with `balance`), -busy.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} body @param {any} env
 */
export async function buyWare({ db, nowS }, player, body, env) {
  if (!player?.handle) return { error: 'aurum-guest' };
  if (!aurumOpenFor(player, env)) return { error: 'aurum-closed' };
  const w = /** @type {any} */ (shopWareById(body?.ware));
  if (!w || !w.alone || shopRepeatable(w)) return { error: 'aurum-ware' };
  const deals = dailyWaresAt(env, nowS);
  if (!deals.includes(w.id) && !soldForAurum(env, w, nowS)) return { error: 'aurum-sale' };
  if (holdsAll(player, env)) return { error: 'aurum-held' };   // ADMIN-ALL
  for (let i = 0; i < 3; i++) {
    const row = await aurumRow(db, player.id);
    if (!row) return { error: 'aurum-guest' };
    const at = aurumPriceAt(row, w, deals);
    if (!at) return { error: 'aurum-held' };
    // AUDIT-STOREFRONT III A5: Aurum already paid for it (a line keyed by the ware): given back free, never asked again
    const paid = !!(await db.prepare("SELECT 1 AS x FROM aurum_ledger WHERE account = ?1 AND kind = 'buy' AND ref = ?2").bind(player.id, w.id).first());
    if (!paid && Number.isSafeInteger(body?.price) && body.price !== at.price) return { error: 'aurum-price', price: at.price };
    const balance = balanceOfRow(row);
    if (!paid && balance < at.price) return { error: 'aurum-short', balance };
    // AUDIT AURUM-SPEND F1, F2: the line keeps what the price took off as held, so a money refund of one of those takes it
    // back; and the marks come off what this buy pays for (shop.js heldGranted's law), so what was paid for is given
    const credit = shopCreditOf(row, w.id), covers = shopClosure(w.id).filter((id) => !credit.includes(id));
    const toks = String(row.shop_held ?? '').split(' ').filter((t) => t && !(t[0] === '-' && covers.includes(t.slice(1))));
    const after = { shop_wares: (Number(row.shop_wares) || 0) | w.bit, shop_held: (w.bit || toks.includes(w.id) ? toks : [...toks, w.id]).join(' ') };
    try {
      await db.batch([
        ...(paid ? [] : [db.prepare(`INSERT INTO aurum_ledger (account, kind, ref, amount, day, at, credit) SELECT ?1, 'buy', ?2, ?3, ?4, ?5, ?7
          WHERE ${AURUM_BALANCE_SQL} >= ?6`).bind(player.id, w.id, -at.price, utcDay(nowS), nowS, at.price, credit.join(' ')), mustChange(db)]),
        db.prepare('UPDATE players SET shop_wares = ?2, shop_held = ?3 WHERE id = ?1 AND shop_wares = ?4 AND shop_held = ?5')
          .bind(player.id, after.shop_wares, after.shop_held, Number(row.shop_wares) || 0, String(row.shop_held ?? '')),
        mustChange(db),
      ]);
    } catch {
      continue;   // the row moved, or the balance fell under the price meanwhile: read again
    }
    return { ok: true, ware: w.id, spent: paid ? 0 : at.price, row: await db.prepare('SELECT * FROM players WHERE id = ?1').bind(player.id).first() };
  }
  return { error: 'aurum-busy' };
}
