// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HAUL-CARDS (2026-10-03, Mac: "Im wondering with popups for obtaining
// silver and harvest items. We need a better enhanced plus UI element for
// when people gather these items"; the mockup: "Dude this is sick") -
// WHAT A GATHER, A STRIKE OR A CLAIM GAVE, AS THE PICKUP FEED'S CARDS
// (ui/pickupFeed.js showHaul), ON THE ENHANCED SKIN.
//
// A harvest was SAID: three or four lines on the right ("+3 Iron Ore to
// your Stores", "+60 Mining XP", "10 silver struck to your account..."),
// no picture, no tier, no total - and a raid's or a gate's silver only in
// the chat. Each is a CARD under the crosshair now, the loot's own band
// and dress: the goods its material's picture (the pack's item, as a
// withdrawal would make it - systems/profItems.js mintMaterialItem), "+3"
// and its name in its tier's colour, "STORES 41" (they are never in the
// pack - GATHER-SAID's reports), and the XP on the same card, its rank's
// progress a bar; silver a coin, its source and the balance, a combat
// strike the day's 150 a bar; a Motherlode one card, its ore and its
// silver and its twenty.
//
// PURE: an answer in, the cards' data out - no DOM, no clock (the feed
// draws them). Every builder answers [] for an answer it cannot read, and
// the host then says its lines as it always did.
// ═══════════════════════════════════════════════════════════════════
import { xpForRank, rankOfXp, professionName, PROF_RANK_MAX } from '../net/professionLaw.js';
import { material } from '../net/nodeLaw.js';
import { materialCountLabel, mintMaterialItem } from '../systems/profItems.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { lootRarityOn } from '../systems/lootRarity.js';
import { MARKS_COMBAT } from '../net/marksLaw.js';

/** A strike the day's combat cap refused, as its muted card says it - the chat's own line keeps the whole of it. */
export const HAUL_CAPPED_TEXT = `No silver - the day's ${MARKS_COMBAT.perDay} for breaches and towns is reached`;
/** A gather card holds a little longer than a pickup's (ui/pickupFeed.js PICKUP_FEED_HOLD_MS) - it says more. */
export const HAUL_HOLD_MS = 3200;
/** A Motherlode's card stands longer still - the day's one. */
export const LODE_HOLD_MS = 5000;

/** A material's tier as the cards colour it: the loot's own rarity names (ui/enhancedPlusStyle.js RARITY_VARS) -
 *  tiers 1 and 2 plain, 3 magic's blue, 4 rare's gold, 5 legendary's orange, 6 artifact's violet; none while the
 *  player has the loot's tiers off (systems/lootRarity.js), as an item's own name would wear none. */
export const TIER_RARITY = Object.freeze([null, null, null, 'magic', 'rare', 'legendary', 'artifact']);
export const tierRarity = (tier, on = lootRarityOn()) => (on && Number.isSafeInteger(tier) ? TIER_RARITY[tier] ?? null : null);

/** A rank's progress to the next, 0-1 (1 at the top rank). */
export function rankProgress(xp) {
  const x = Math.max(0, Number(xp) || 0);
  const r = rankOfXp(x);
  if (r >= PROF_RANK_MAX) return 1;
  const lo = xpForRank(r), hi = xpForRank(r + 1);
  return hi > lo ? Math.max(0, Math.min(1, (x - lo) / (hi - lo))) : 1;
}

/** A material's picture: the pack's own item of it, as a withdrawal would mint it - null for one with no art. */
export function materialImage(key) {
  try {
    const item = mintMaterialItem(key);
    return item ? inventoryItemImage(item) ?? null : null;
  } catch { return null; }
}

/** The Stores' whole count of a material after a harvest (`store`: own, bought and gold's), or null where unsaid. */
const heldOf = (store) => (store && typeof store === 'object' ? Number(store.own ?? 0) + Number(store.bought ?? 0) + Number(store.gold ?? 0) : null);

/** ONE GOOD INTO THE STORES, as a card's data: its material's name (the count's plural, at the card's count), tier,
 *  picture and the Stores' count after it. `key` makes two of it one card - the feed adds the counts. */
export function storesHaul(key, qty, { held = null, name = null, sub = null } = {}) {
  const n = Math.trunc(Number(qty) || 0);
  if (typeof key !== 'string' || n <= 0) return null;
  const m = material(key);
  return {
    key: `stores\u0002${key}${name ? `\u0002${name}` : ''}`, haul: 'stores', material: key, count: n, name, sub,
    rarity: tierRarity(m?.tier ?? null), image: materialImage(key), held: Number.isSafeInteger(held) ? held : null,
    hold: HAUL_HOLD_MS, adds: ['count'], latest: ['held'],
  };
}

/**
 * A HARVEST'S ANSWER AS ITS CARDS (scenes/gatherHost.js, the answer's `data`): the goods' card - its XP on it, the
 * rank's progress its bar, a clean act's or the act's own words its head - then a gem's and a second find's (PROF4's
 * Resin, PROF7's butchery), each its own card. A Motherlode's strike (PROF2b) is ONE card: its ore, its silver and its
 * twenty. `name` a kind's own name for the goods (PROF8's species - the material its sub), `note` the act's words.
 * @param {any} d @param {{ name?: string|null, note?: string|null }} [o]
 */
export function harvestHauls(d, { name = null, note = null } = {}) {
  if (!d || typeof d !== 'object' || typeof d.material !== 'string') return [];
  const main = storesHaul(d.material, d.qty, { held: heldOf(d.store), name, sub: name ? `as ${materialCountLabel(d.material, Number(d.qty) || 1)}` : null });
  if (!main) return [];
  const profession = d.track?.profession ?? null;
  const xp = Math.trunc(Number(d.xp) || 0);
  if (profession && xp > 0) {
    Object.assign(main, { profession, xp, rank: Number(d.track?.rank) || 0, progress: rankProgress(d.track?.xp) });
    main.adds = [...main.adds, 'xp'];
    main.latest = [...main.latest, 'rank', 'progress'];
  }
  const head = typeof note === 'string' ? note.replace(/^\s*\(|\)\s*$/g, '').trim() : '';
  // AUDIT HAUL-CARDS B2: the head is each act's own - a bump says the newest act's words (a clean strike after a
  // plain one, a torn pelt after a clean one), never the first's for both
  main.head = head;
  main.latest = [...main.latest, 'head'];
  if (d.motherlode) {
    // PROF2b: the day's one - its own card (never bumped into a vein's), its silver and its twenty on it
    main.key = `lode\u0002${d.node ?? d.material}`;
    main.lode = true;
    main.head = head ? `Motherlode - ${head}` : 'Motherlode';
    main.silver = Number.isSafeInteger(d.marks?.struck) && d.marks.struck > 0 ? d.marks.struck : 0;
    main.balance = Number.isSafeInteger(d.marks?.balance) ? d.marks.balance : null;   // AUDIT HAUL-CARDS B4: the purse, as the silver cards say it
    main.miners = Number.isSafeInteger(d.lode?.struck) ? `${d.lode.struck} / ${d.lode.strikers ?? 20} miners` : null;
    main.hold = LODE_HOLD_MS;
  }
  const out = [main];
  // AUDIT HAUL-CARDS B1: "a gem" only for a gem - a tree's `gem` is its Heartwood, a body's its DFU part (a Big Tooth);
  // B3: each find its own Stores count, as the answer carries it (`gemStore`, `extraStore`)
  if (d.gem) { const g = storesHaul(d.gem, 1, { held: heldOf(d.gemStore), sub: material(d.gem)?.family === 'gems' ? 'a gem' : null }); if (g) out.push(g); }
  if (d.extra) { const x = storesHaul(d.extra, Number(d.extraQty) || 1, { held: heldOf(d.extraStore) }); if (x) out.push(x); }
  return out;
}

/** The silver a strike answered, as a card - `source` its words ("Town defended"); a combat strike its day's bar; a
 *  strike the day's cap refused, a muted card that says so; nothing for no silver at all. */
export function silverHaul(marks, { source = '', combat = false, cappedText = null } = {}) {
  if (!marks || typeof marks !== 'object') return null;
  const n = Math.trunc(Number(marks.struck) || 0);
  if (n <= 0) {
    return marks.why === 'cap' && cappedText ? { key: 'silver\u0002capped', haul: 'note', text: cappedText, count: 1, hold: HAUL_HOLD_MS } : null;
  }
  const c = combat && Number.isSafeInteger(marks.combat?.earned) ? marks.combat : null;
  return {
    key: `silver\u0002${source}`, haul: 'silver', count: n, source, balance: Number.isSafeInteger(marks.balance) ? marks.balance : null,
    ...(c ? { earned: c.earned, max: c.max ?? MARKS_COMBAT.perDay } : {}),
    hold: HAUL_HOLD_MS, adds: ['count'], latest: ['balance', 'earned', 'max'],
  };
}

/**
 * A COUNTED CLAIM'S SILVER AS ITS CARDS (a raid's or a gate's answer - net/marksBook.js claimLines' own data): its strike
 * (the day's combat bar on it, or the cap's muted card), the guild deed it completed (into the treasury - brass, never
 * the account's coin) and each contract that paid it. The chat keeps its lines; these are what the eye catches.
 * @param {any} data @param {'raid'|'gate'} kind
 */
export function claimHauls(data, kind = 'gate') {
  if (!data || typeof data !== 'object') return [];
  const out = [];
  const strike = silverHaul(data.marks, { source: kind === 'raid' ? 'Town defended' : 'Breach closed', combat: true, cappedText: HAUL_CAPPED_TEXT });
  if (strike) out.push(strike);
  const deed = data.deed;
  if (deed && Number.isSafeInteger(deed.struck) && deed.struck > 0) {
    out.push({ key: `deed\u0002${deed.guild?.name ?? ''}`, haul: 'silver', tone: 'treasury', count: deed.struck, source: `Guild deed - to ${deed.guild?.name ?? 'your guild'}`, hold: HAUL_HOLD_MS, adds: ['count'] });
  }
  for (const c of Array.isArray(data.contracts) ? data.contracts : []) {
    if (!c || !Number.isSafeInteger(c.pay) || c.pay <= 0) continue;
    const tag = c.guild?.tag ? `[${c.guild.tag}]` : (c.guild?.name ?? 'a guild');
    // AUDIT HAUL-CARDS C3/C7: the tax before the guild (a long name gives way, never the tax), grouped as every number
    out.push({ key: `contract\u0002${c.contract ?? tag}`, haul: 'silver', count: c.pay, source: `Contract${c.tax > 0 ? ` (${num(c.tax)} tax)` : ''} - ${tag}`, hold: HAUL_HOLD_MS, adds: ['count'] });
  }
  return out;
}

/** A number as the cards say it - "1,380", the toasts' own grouping. */
const num = (n) => Number(n).toLocaleString('en-US');
/** A haul card's picture box (CSS pixels): a gather's, and a Motherlode's larger - the icon fitted to it, never a
 *  pickup's 20 blown up (ui/pickupFeed.js PICKUP_ICON_BOX). */
export const HAUL_ICON_BOX = 32;
export const LODE_ICON_BOX = 38;
/**
 * A card's words, as the feed draws them - pure, so the pins read what the player reads. `{ note }` for a muted card;
 * else the line (`plus`, `name`, `sub`, `tag`, `end`), an optional `head` over it, an optional `row` under it (`text`, a
 * bar's `fill` 0-1, `end`) - the gather's XP and its rank, the strike's day of combat silver - and a Motherlode's
 * `lode` (its silver, its twenty).
 */
export function haulWords(l) {
  if (l.haul === 'note') return { note: String(l.text ?? '') };
  if (l.haul === 'silver') {
    const row = Number.isSafeInteger(l.earned) && l.max > 0 ? { text: 'Combat today', fill: Math.max(0, Math.min(1, l.earned / l.max)), end: `${num(l.earned)} / ${num(l.max)}` } : null;
    return { head: '', plus: `+${num(l.count)}`, name: 'silver', sub: l.source || '', tag: '', end: Number.isSafeInteger(l.balance) ? num(l.balance) : '', row, lode: null };
  }
  const name = l.name ?? materialCountLabel(l.material, l.count);
  const row = l.xp > 0 ? { text: `+${num(l.xp)} ${professionName(l.profession)} XP`, fill: Math.max(0, Math.min(1, Number(l.progress) || 0)), end: l.rank ? `${l.rank}` : '' } : null;
  return {
    head: l.head ?? '', plus: `+${num(l.count)}`, name, sub: l.sub ?? '', tag: Number.isSafeInteger(l.held) ? `Stores ${num(l.held)}` : 'Stores', end: '', row,
    lode: l.lode ? { silver: l.silver > 0 ? `+${num(l.silver)} silver` : '', held: l.silver > 0 && Number.isSafeInteger(l.balance) ? `you hold ${num(l.balance)}` : '', miners: l.miners ?? '' } : null,
  };
}
