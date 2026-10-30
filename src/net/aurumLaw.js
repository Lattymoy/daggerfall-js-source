// @ts-check
// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased to be
// used to purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md): THE AURUM'S LAW, read by the account
// service (server-account/src/aurum.js) and the shop's window. Aurum is the account's and buys cosmetics alone - never
// traded, never gold, never power (THE CEILING HOLDS). Pure. Not a DFU member. Ledger A (AURUM).
import { SHOP_WARES, shopWareById } from './shopLaw.js';

const DAY_MS = 86_400_000;
/** The most a balance may read - a card's bound, far past any account's. */
export const AURUM_MAX = 10_000_000;

/** AURUM_OPEN: 'off', 'dev' (the developers alone) or 'on'; anything else is off. */
export const aurumSwitchOf = (/** @type {unknown} */ v) => (v === 'on' || v === 'dev' ? v : 'off');

// ═══ EARNED: THE WEEK'S DEEDS ═════════════════════════════════════════════════════════════════════════════════════════
/** A WITNESSED DEED'S AURUM, the first of its kind an account does in a UTC week: a receipt the relay signed and the service
 *  counted (a Dagon's Breach closed, an Elite Breach's Redoubt paid, a sea serpent slain, a fallen star held, a town
 *  defended). Struck by the receipt's own row (migration 0196's triggers), so no client can ask for it. */
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

// ═══ SPENT: THE DAILY WARES ═══════════════════════════════════════════════════════════════════════════════════════════
const daily = (/** @type {string} */ id, /** @type {number} */ aurum, /** @type {'effect'|'name'|'icon'} */ slot) => Object.freeze({ id, aurum, slot });
/** WHAT THE DAILY WARES DRAW FROM, each with its price in Aurum and its slot - a ware sold for money too a little under its
 *  price at the smallest pack's rate (SHOP_PRICE_CAP's prices, AUDIT-STOREFRONT II). The shop's effects and name visuals (also
 *  sold for money) and the profile icons sold for Aurum alone. A season's items never: its tracks are how they are had. */
export const AURUM_DAILY = Object.freeze([
  daily('kill:ashen', 400, 'effect'), daily('kill:voidrend', 900, 'effect'), daily('kill:pyre', 1300, 'effect'),
  daily('portal:runic', 700, 'effect'), daily('portal:daedric', 1200, 'effect'), daily('portal:aetheric', 1800, 'effect'),
  daily('mount:spectral', 900, 'effect'), daily('mount:dawnfire', 1300, 'effect'), daily('mount:warhorse', 2200, 'effect'),
  daily('title:dawnbringer', 300, 'name'), daily('title:voidwalker', 600, 'name'), daily('title:eternalchampion', 900, 'name'),
  daily('icon:gatefire', 300, 'icon'), daily('icon:aurbis', 400, 'icon'), daily('icon:elderscroll', 300, 'icon'), daily('icon:azurastar', 300, 'icon'),
  daily('icon:redmountain', 400, 'icon'), daily('icon:hourglass', 300, 'icon'), daily('icon:sanguinerose', 200, 'icon'), daily('icon:whitegold', 200, 'icon'),
]);
/** How many of each slot a day shows, in the window's order. */
export const AURUM_DAILY_SLOTS = Object.freeze({ effect: 2, name: 1, icon: 2 });
/** The first day the rotation counts from (a UTC day's number). Every later day is decided from it, so every machine
 *  that reads the same sale agrees on every day. */
export const AURUM_DAILY_FROM = Math.floor(Date.UTC(2026, 9, 1) / DAY_MS);
/** A daily ware by its id, or null. */
export const aurumDailyById = (/** @type {unknown} */ id) => AURUM_DAILY.find((d) => d.id === id) ?? null;
/** The Aurum a ware costs in the daily wares, or 0 for none. */
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
 * THE DAY'S WARES: for each slot, the wares longest unseen (never seen first), each nudged by the day's hash so the same
 * pairs do not come round together - by less in a small slot, so a ware never shows two days running while its slot holds
 * four days' worth. `eligible(id, day)` is the service's word (on sale, dropped, inside a limited window). Every day is
 * decided from AURUM_DAILY_FROM; `cache` (the caller's, one a sale) keeps the last day decided. Ids in slot order.
 * @param {number} day @param {(id: string, day: number) => boolean} eligible
 * @param {{ at?: number, seen?: Map<string, number>, days?: Map<number, string[]> }} [cache]
 */
export function aurumDailyOf(day, eligible, cache = {}) {
  if (!Number.isSafeInteger(day)) return [];
  const want = Math.max(day, AURUM_DAILY_FROM);
  cache.days ??= new Map();
  const kept = cache.days.get(want);
  if (kept) return kept;
  if (cache.at === undefined || cache.seen === undefined || want <= cache.at) { cache.at = AURUM_DAILY_FROM - 1; cache.seen = new Map(); }
  const seen = cache.seen;
  /** @type {string[]} */ let picks = [];
  for (let d = cache.at + 1; d <= want; d++) {
    picks = [];
    for (const [slot, n] of Object.entries(AURUM_DAILY_SLOTS)) {
      const pool = AURUM_DAILY.filter((x) => x.slot === slot && eligible(x.id, d));
      const nudge = Math.min(2.5, Math.max(0, pool.length / n - 1.5));
      const key = (/** @type {string} */ id) => (seen.get(id) ?? -1e9) + nudge * hashOf(d, id);
      pool.sort((a, b) => key(a.id) - key(b.id) || (a.id < b.id ? -1 : 1));
      for (const x of pool.slice(0, n)) picks.push(x.id);
    }
    for (const id of picks) seen.set(id, d);
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
