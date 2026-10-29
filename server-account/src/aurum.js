// @ts-check
// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased to be
// used to purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md): THE AURUM AS THE SERVICE KEEPS IT.
// A balance is never stored: it is counted at every ask from the account's paid packs (shop.js sells them), its pass
// tracks' rewards and the ledger's lines - the week's witnessed deeds (migration 0196's triggers) and the daily wares
// bought. So a refund takes a pack's Aurum back by its order's status, and a lost Premium Pass its track's. The law both
// ends read is src/net/aurumLaw.js.
import { shopHeldIds, shopOwns, shopWareById, shopOnSaleOf, shopFeaturedOf, shopDropped } from '../../src/net/shopLaw.js';
import { AURUM_DEEDS, aurumSwitchOf, aurumDailyOf, aurumDailyById, aurumDayEndMs, aurumWeekOf, aurumWeekEndMs, aurumTrackOf } from '../../src/net/aurumLaw.js';
import { PASS_SEASONS } from '../../src/net/battlePassLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { isDeveloper } from './titles.js';
import { mustChange } from './realm.js';

const DAY_MS = 86_400_000;
/** Whether Aurum is open to this account: AURUM_OPEN 'on', or 'dev' and a developer. */
export const aurumOpenFor = (/** @type {any} */ player, /** @type {any} */ env) => {
  const s = aurumSwitchOf(env?.AURUM_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
};
/** The answer's status by refusal. */
export const AURUM_STATUS = Object.freeze({ 'aurum-guest': 403, 'aurum-closed': 409, 'aurum-ware': 400, 'aurum-today': 409, 'aurum-held': 409, 'aurum-short': 409, 'aurum-busy': 503 });

const int = (/** @type {unknown} */ v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const PASS_COLS = PASS_SEASONS.map((s) => `pass_${s.id}`);
/** The Aurum an account's paid packs gave, and its ledger's sum - each bound to the account at ?1. */
const PACKS_SQL = "(SELECT COALESCE(SUM(aurum), 0) FROM shop_orders WHERE player = ?1 AND status = 'paid')";
const LINES_SQL = '(SELECT COALESCE(SUM(amount), 0) FROM aurum_ledger WHERE account = ?1)';
/** The row as a balance reads it: what it holds, each season's experience, and its packs' and lines' Aurum. */
const readRow = (/** @type {any} */ db, /** @type {string} */ id) =>
  db.prepare(`SELECT shop_wares, shop_held, ${PASS_COLS.join(', ')}, ${PACKS_SQL} AS packs, ${LINES_SQL} AS lines FROM players WHERE id = ?1`).bind(id).first();
/** A row's balance at `nowS`: its tracks' Aurum (counted, net/aurumLaw.js aurumTrackOf), its packs' and its lines'. */
export const balanceOfRow = (/** @type {any} */ row, /** @type {number} */ nowS) => aurumTrackOf(row, shopHeldIds(row), nowS * 1000) + int(row?.packs) + int(row?.lines);

/** THE SALE THE DAILY WARES READ, per config: what SHOP_ON_SALE names (a daily ware too - the owner's one list), dropped
 *  by SHOP_FEATURED's first window, and inside a limited window where the schedule marks one. `cache` the rotation's
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
      return !limits.length || limits.some((e) => at >= e.fromMs && at < e.toMs);
    };
    if (sales.size > 4) sales.clear();
    sales.set(key, s = { eligible, cache: {} });
  }
  return s;
}
/** The day's wares at `nowS`, by the config's sale. */
export const dailyWaresAt = (/** @type {any} */ env, /** @type {number} */ nowS) => { const s = dailySaleOf(env); return aurumDailyOf(utcDay(nowS), s.eligible, s.cache); };

/**
 * THE AURUM'S CARD on the account read (aurumLaw.js aurumCardOf reads it): whether it is open to this account, the
 * balance, the day's wares with what this account holds of them, and the week's deeds struck. A guest's is null - a guest
 * cannot buy, and its deeds' Aurum waits on its row for the username it may be given.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function aurumCardOf({ db, nowS }, player, env) {
  if (!player?.handle) return null;
  const week = aurumWeekOf(nowS), day = utcDay(nowS);
  const [row, deeds] = await Promise.all([
    readRow(db, player.id),
    db.prepare("SELECT ref, amount FROM aurum_ledger WHERE account = ?1 AND kind = 'deed' AND ref LIKE ?2").bind(player.id, `%:${week}`).all(),
  ]);
  const struck = /** @type {Record<string, number>} */ ({});
  for (const r of deeds?.results ?? []) { const k = String(r.ref).split(':')[0]; if (Object.hasOwn(AURUM_DEEDS, k)) struck[k] = int(r.amount); }
  return {
    open: aurumOpenFor(player, env),
    balance: balanceOfRow(row, nowS),
    daily: { until: aurumDayEndMs(day), wares: dailyWaresAt(env, nowS).map((id) => ({ id, held: shopOwns(row, id) })) },
    week: { until: aurumWeekEndMs(week), deeds: struck },
  };
}

/**
 * A DAILY WARE BOUGHT: `body.ware` among the day's wares, not held, for its price in Aurum - in ONE TRANSACTION: the
 * ledger's line written only while the balance (its packs and lines as they stand then, its tracks' as read) covers the
 * price, and the ware put on the row only while the row is the one read (what it holds, each season's experience). A row
 * moved meanwhile (a find, a grant, a refund) is read again, three times. `{ ok, ware, spent, row }` - `row` the account's
 * whole row after, for the wardrobe - or `{ error }`: aurum-guest, -closed, -ware, -today (not among the day's wares), -held, -short (with `balance`), -busy.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} body @param {any} env
 */
export async function buyDaily({ db, nowS }, player, body, env) {
  if (!player?.handle) return { error: 'aurum-guest' };
  if (!aurumOpenFor(player, env)) return { error: 'aurum-closed' };
  const d = aurumDailyById(body?.ware);
  if (!d) return { error: 'aurum-ware' };
  if (!dailyWaresAt(env, nowS).includes(d.id)) return { error: 'aurum-today' };
  const w = /** @type {any} */ (shopWareById(d.id));
  for (let i = 0; i < 3; i++) {
    const row = await readRow(db, player.id);
    if (!row) return { error: 'aurum-guest' };
    if (shopOwns(row, d.id)) return { error: 'aurum-held' };
    const track = aurumTrackOf(row, shopHeldIds(row), nowS * 1000), balance = track + int(row.packs) + int(row.lines);
    if (balance < d.aurum) return { error: 'aurum-short', balance };
    const toks = String(row.shop_held ?? '').split(' ').filter(Boolean);
    const after = { shop_wares: (Number(row.shop_wares) || 0) | w.bit, shop_held: (w.bit || toks.includes(d.id) ? toks : [...toks, d.id]).join(' ') };
    const passGuard = PASS_COLS.map((c, k) => ` AND ${c} = ?${6 + k}`).join('');
    try {
      await db.batch([
        db.prepare(`INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) SELECT ?1, 'buy', ?2, ?3, ?4, ?5
          WHERE ?6 + ${PACKS_SQL} + ${LINES_SQL} >= ?7`).bind(player.id, d.id, -d.aurum, utcDay(nowS), nowS, track, d.aurum),
        mustChange(db),
        db.prepare(`UPDATE players SET shop_wares = ?2, shop_held = ?3 WHERE id = ?1 AND shop_wares = ?4 AND shop_held = ?5${passGuard}`)
          .bind(player.id, after.shop_wares, after.shop_held, Number(row.shop_wares) || 0, String(row.shop_held ?? ''), ...PASS_COLS.map((c) => int(row[c]))),
        mustChange(db),
      ]);
    } catch {
      continue;   // the row moved, or the balance fell under the price meanwhile: read again
    }
    return { ok: true, ware: d.id, spent: d.aurum, row: await db.prepare('SELECT * FROM players WHERE id = ?1').bind(player.id).first() };
  }
  return { error: 'aurum-busy' };
}
