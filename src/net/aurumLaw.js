// @ts-check
// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased to be
// used to purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md): THE AURUM'S LAW, read by the account
// service (server-account/src/aurum.js) and the shop's window. Aurum is the account's and buys cosmetics alone - never
// traded, never gold, never power (THE CEILING HOLDS). AURUM-ONLY (2026-10-30): it buys every ware in the shop, and
// the daily wares are the day's deals. Pure. Not a DFU member. Ledger A (AURUM).
import { SHOP_WARES, shopWareById } from './shopLaw.js';

const DAY_MS = 86_400_000;
/** The most a balance may read - a card's bound, far past any account's. */
export const AURUM_MAX = 10_000_000;

/** AURUM_OPEN: 'off', 'dev' (the developers alone) or 'on'; anything else is off. */
export const aurumSwitchOf = (/** @type {unknown} */ v) => (v === 'on' || v === 'dev' ? v : 'off');

// ═══ EARNED: THE WEEK'S DEEDS ═════════════════════════════════════════════════════════════════════════════════════════
/** A WITNESSED DEED'S AURUM, the first of its kind an account does in a UTC week: a receipt the relay signed and the service
 *  counted (a Dagon's Breach closed, an Elite Breach's Redoubt paid, a sea serpent slain, a fallen star held, a town
 *  defended). Struck by the receipt's own row (migration 0201's triggers), so no client can ask for it. */
export const AURUM_DEEDS = Object.freeze({ gate: 30, eg: 30, serpent: 25, star: 20, raid: 15 });
/** A UTC week's number, Monday its first day (1 January 1970 was a Thursday). Pure. */
export const aurumWeekOf = (/** @type {number} */ nowS) => Math.floor((Math.floor(nowS / 86_400) + 3) / 7);
/** When a week ends (ms): the next Monday at 00:00 UTC. Pure. */
export const aurumWeekEndMs = (/** @type {number} */ week) => (week * 7 + 4) * DAY_MS;

// ═══ BOUGHT: THE PACKS ════════════════════════════════════════════════════════════════════════════════════════════════
/** The packs (net/shopLaw.js `aurum` wares), in the window's order. Each paid order is its pack's Aurum (`shop_orders`'s
 *  own `aurum`, set at its checkout), so a refund or a dispute takes it back and a won dispute gives it again. */
export const AURUM_PACKS = Object.freeze(SHOP_WARES.filter((w) => w.kind === 'aurum'));
/** A pack's share past the smallest pack's rate, as a whole percent (the window's "+10%"). Pure. */
export function aurumBonusOf(/** @type {unknown} */ id) {
  const w = shopWareById(id), base = AURUM_PACKS[0];
  if (!w || w.kind !== 'aurum' || !base) return 0;
  return Math.max(0, Math.round(((w.aurum / w.cents) / (base.aurum / base.cents) - 1) * 100));
}

// ═══ SPENT: THE DAILY DEALS ═══════════════════════════════════════════════════════════════════════════════════════════
/** AURUM-ONLY (the owner chose "Daily deals"): the share of its price a ware costs on its deal day - a quarter off. */
export const AURUM_DEAL = 0.75;
/** A price on its deal day, in whole Aurum. Pure. */
export const aurumDealOf = (/** @type {number} */ price) => Math.round(price * AURUM_DEAL);
const daily = (/** @type {string} */ id, /** @type {'effect'|'name'|'icon'} */ slot) => Object.freeze({ id, aurum: aurumDealOf(/** @type {any} */ (shopWareById(id))?.price ?? 0), slot });
/** WHAT THE DAILY DEALS DRAW FROM, each with its deal price and its slot: the shop's effects, name visuals and profile
 *  icons. A season's items never: its tracks are how they are had. */
export const AURUM_DAILY = Object.freeze([
  daily('kill:ashen', 'effect'), daily('kill:voidrend', 'effect'), daily('kill:pyre', 'effect'),
  daily('portal:runic', 'effect'), daily('portal:daedric', 'effect'), daily('portal:aetheric', 'effect'),
  daily('mount:spectral', 'effect'), daily('mount:dawnfire', 'effect'), daily('mount:warhorse', 'effect'),
  daily('title:dawnbringer', 'name'), daily('title:voidwalker', 'name'), daily('title:eternalchampion', 'name'),
  daily('icon:gatefire', 'icon'), daily('icon:aurbis', 'icon'), daily('icon:elderscroll', 'icon'), daily('icon:azurastar', 'icon'),
  daily('icon:redmountain', 'icon'), daily('icon:hourglass', 'icon'), daily('icon:sanguinerose', 'icon'), daily('icon:whitegold', 'icon'),
]);
/** How many of each slot a day shows, in the window's order. */
export const AURUM_DAILY_SLOTS = Object.freeze({ effect: 2, name: 1, icon: 2 });
/** The first day the rotation counts from (a UTC day's number). Every later day is decided from it, so every machine
 *  that reads the same sale agrees on every day. */
export const AURUM_DAILY_FROM = Math.floor(Date.UTC(2026, 9, 1) / DAY_MS);
/** A daily ware by its id, or null. */
export const aurumDailyById = (/** @type {unknown} */ id) => AURUM_DAILY.find((d) => d.id === id) ?? null;
/** The Aurum a ware costs on its deal day, or 0 for none the deals draw from. */
export const aurumPriceOf = (/** @type {unknown} */ id) => aurumDailyById(id)?.aurum ?? 0;
/** When a day's wares give way to the next (ms): the next midnight, UTC. Pure. */
export const aurumDayEndMs = (/** @type {number} */ day) => (day + 1) * DAY_MS;

/** A 32-bit hash of a day and a ware (FNV-1a), the rotation's tie-break - the same on every machine. Pure. */
function hashOf(/** @type {number} */ day, /** @type {string} */ id) {
  let h = 0x811c9dc5;
  for (const c of `${day}:${id}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return (h >>> 0) / 0x1_0000_0000;
}
/**
 * THE DAY'S WARES: in each slot the wares longest unseen, nudged by the day's hash (less in a small slot, so none shows
 * two days running while its slot holds four days' worth); a tie to the shorter run of days shown, then the hash
 * (AUDIT-STOREFRONT III A2); a slot short of wares hands its count on. `eligible(id, day)` is the service's word. Every
 * day is decided from AURUM_DAILY_FROM; `cache` (the caller's, one a sale) keeps the last day decided. Ids in slot order.
 * @param {number} day @param {(id: string, day: number) => boolean} eligible
 * @param {{ at?: number, seen?: Map<string, number>, run?: Map<string, number>, days?: Map<number, string[]> }} [cache]
 */
export function aurumDailyOf(day, eligible, cache = {}) {
  if (!Number.isSafeInteger(day)) return [];
  const want = Math.max(day, AURUM_DAILY_FROM);
  cache.days ??= new Map();
  const kept = cache.days.get(want);
  if (kept) return kept;
  if (cache.at === undefined || cache.seen === undefined || cache.run === undefined || want <= cache.at) { cache.at = AURUM_DAILY_FROM - 1; cache.seen = new Map(); cache.run = new Map(); }
  const seen = cache.seen, run = cache.run;   // run: the first day of a ware's days shown in a row
  /** @type {string[]} */ let picks = [];
  for (let d = cache.at + 1; d <= want; d++) {
    picks = [];
    let short = 0;
    for (const [slot, own] of Object.entries(AURUM_DAILY_SLOTS)) {
      const n = own + short;
      const pool = AURUM_DAILY.filter((x) => x.slot === slot && eligible(x.id, d));
      const nudge = Math.min(2.5, Math.max(0, pool.length / n - 1.5));
      const key = (/** @type {string} */ id) => (seen.get(id) ?? -1e9) + nudge * hashOf(d, id);
      pool.sort((a, b) => key(a.id) - key(b.id) || (run.get(b.id) ?? 0) - (run.get(a.id) ?? 0) || hashOf(d, a.id) - hashOf(d, b.id) || (a.id < b.id ? -1 : 1));
      const take = pool.slice(0, n);
      for (const x of take) picks.push(x.id);
      short = n - take.length;
    }
    for (const id of picks) { if (seen.get(id) !== d - 1) run.set(id, d); seen.set(id, d); }
    cache.days.set(d, picks);
  }
  cache.at = want;
  return picks;
}

/**
 * THE AURUM'S CARD as the account read carries it (`/v1/account`'s `aurum`, server-account/src/aurum.js aurumCardOf),
 * checked on the way in: whether it is open to this account, the balance (below 0 when a pack's payment went back after
 * it was spent), the day's wares (each a daily ware once, its price the law's, whether held) and when they turn, and the
 * week's deeds (each kind's Aurum struck this week) and when the week turns. Null for anything else. Pure.
 * @param {any} c
 */
export function aurumCardOf(c) {
  if (!c || typeof c !== 'object' || typeof c.open !== 'boolean') return null;
  const whole = (/** @type {unknown} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => (Number.isSafeInteger(v) && /** @type {number} */ (v) >= lo && /** @type {number} */ (v) <= hi ? /** @type {number} */ (v) : null);
  const rows = Array.isArray(c.daily?.wares) ? c.daily.wares : [];
  const wares = [];
  for (const r of rows) {
    const d = aurumDailyById(r?.id);
    if (d && !wares.some((w) => w.id === d.id)) wares.push({ id: d.id, aurum: d.aurum, slot: d.slot, held: r.held === true });
  }
  const deeds = /** @type {Record<string, number>} */ ({});
  for (const k of Object.keys(AURUM_DEEDS)) deeds[k] = whole(c.week?.deeds?.[k], 0, AURUM_DEEDS[/** @type {keyof typeof AURUM_DEEDS} */ (k)]) ?? 0;
  return {
    open: c.open,
    balance: whole(c.balance, -AURUM_MAX, AURUM_MAX) ?? 0,
    daily: { until: whole(c.daily?.until, 1, Number.MAX_SAFE_INTEGER), wares },
    week: { until: whole(c.week?.until, 1, Number.MAX_SAFE_INTEGER), deeds },
  };
}
