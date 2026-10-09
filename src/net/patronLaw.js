// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW15 (2026-10-09, bible/06-Systems/Living-World-II.md "LW15"): THE PATRONS - the living world's townsfolk buying from
// a player's hired trader (HOME-VENDOR's `vendor` station). Mac: "npc autonomy that can visit player shops and purchase
// from them".
//
// WHO DECIDES A SALE: THE SERVICE, BY THIS LAW. The service holds the trader's stock and the seller's gold, and bundles no
// ARENA2 - it cannot know a town's people - so it decides WHICH PIECE SELLS IN WHICH HOUR, and names a SEED and a
// MINUTE, never a person; the client deals the seed to one of the town's residents (systems/livingWorld's own law,
// `patronOf`). Both ends read this file: the sales a client reads are the sales the service made, and reckoned late
// they are the same sales (the dice are the listing's and the hour's alone).
//
//  - THE HOUR IS THE WINDOW. Each open trader listing in a home the town may enter is offered to the town's patrons once
//    for each real hour it stands (an online sky day is a real hour - TIME1).
//  - THE PRICE DECIDES. Its CAP is PATRON_PAY_SHARE of the piece's worth as the service judges it (itemLaw.js itemWorth -
//    a crafted piece's no higher than the piece it was made as, `patronWorth`); above it no patron buys; at or under it,
//    the hour's chance by how far under (`patronOdds`).
//  - THE TOWN'S DEMAND IS SHARED: its traders together sell at most PATRON_TOWN_HOUR an hour, the hour's lowest draws.
//  - THE CEILINGS: a seller PATRON_SELLER_HOUR pieces an hour, PATRON_SELLER_DAY_GOLD gold a real day; never a quest's
//    piece or a keepsake (`patronTakes`).
//  - THE RECKONING covers the hours since the listing's last, at most PATRON_RECKON_HOURS of them.
//
// Pure: no clock, no network, no DOM.
// ═══════════════════════════════════════════════════════════════════

/** A patron pays at most this share of a piece's worth. */
export const PATRON_PAY_SHARE = 0.6;
/** The hour's chance by the price over the cap (r): at or under each bound, its odds. */
export const PATRON_ODDS = Object.freeze([Object.freeze([0.5, 0.25]), Object.freeze([0.75, 0.12]), Object.freeze([1, 0.05])]);
/** A town's traders sell at most this many pieces an hour to its patrons. */
export const PATRON_TOWN_HOUR = 4;
/** A seller sells at most this many pieces an hour to patrons, and this much gold a real day. */
export const PATRON_SELLER_HOUR = 2;
export const PATRON_SELLER_DAY_GOLD = 20_000;
/** The most hours one reckoning covers (a listing nobody read for a month is reckoned for two days). */
export const PATRON_RECKON_HOURS = 48;
/** A real hour, and a real day (seconds). */
export const PATRON_HOUR_S = 3600;
export const PATRON_DAY_S = 86_400;
/** The keepsake's template (systems/livingWorld/keepsake.js KEEPSAKE_TEMPLATE - the town's own, never sold back). */
export const PATRON_KEEPSAKE_TEMPLATE = 1800;
/** A patron's mark - the buyer a sale names: the town and the seed. @param {number} map @param {number} seed */
export const patronMark = (map, seed) => `patron:${map >>> 0}:${seed >>> 0}`;

/** FNV-1a over a short string, the two ends' one hash. @param {string} s */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
/** The hour's draw for a listing, in [0, 1). @param {string} listing @param {number} hour */
export const patronDraw = (listing, hour) => fnv(`${listing}:${hour}:draw`) / 4294967296;
/** The seed a sale names (the client deals it to a resident). @param {string} listing @param {number} hour */
export const patronSeed = (listing, hour) => fnv(`${listing}:${hour}:seed`);
/** The minute of the hour the patron comes. @param {string} listing @param {number} hour */
export const patronMinute = (listing, hour) => fnv(`${listing}:${hour}:minute`) % 60;

/** The hour's chance at a price over the cap `r` (0 past 1). @param {number} r */
export function patronOdds(r) {
  if (!(r >= 0)) return 0;
  for (const [bound, odds] of PATRON_ODDS) if (r <= bound) return odds;
  return 0;
}
/** A piece's cap - the most a patron pays for it. @param {number} worth */
export const patronCap = (worth) => Math.floor(Math.max(0, worth) * PATRON_PAY_SHARE);
/** Whether a patron would take the piece at all: never a quest's, never a keepsake. @param {any} item */
export const patronTakes = (item) => !!item && typeof item === 'object' && !item.questItem && !item.livingKeepsake && item.templateIndex !== PATRON_KEEPSAKE_TEMPLATE;

/** The marks of a crafted piece (itemLaw.js's own `crafted` findings read these). */
const CRAFT_MARKS = Object.freeze(['provenance', 'quality', 'hand', 'kitMetal', 'fieldKit', 'potent']);
/**
 * A PIECE'S WORTH TO A PATRON: the service's judge's (`worthOf` - itemLaw.js itemWorth), a crafted piece's no higher
 * than the piece it was made as (its marks off, its price nothing: the judge's floor) - "shops are the floor, crafting
 * the ceiling": a patron never pays a crafter more than a found piece fetches.
 * @param {any} item @param {(item: any) => number} worthOf
 */
export function patronWorth(item, worthOf) {
  const worth = worthOf(item);
  if (!item || !CRAFT_MARKS.some((k) => Object.prototype.hasOwnProperty.call(item, k))) return worth;
  const plain = { ...item, value: 0 };
  for (const k of CRAFT_MARKS) delete plain[k];
  return Math.min(worth, worthOf(plain));
}

/**
 * ONE TOWN'S HOUR: which of its traders' listings its patrons buy in `hour`. `listings` each `{ id, seller, price, worth,
 * takes? }` open through the hour; `sold` the town's patron sales already made in the hour (a reckoning again: they
 * stand), `sellerHour` each seller's sales this hour elsewhere, `sellerDay` each seller's patron gold this real day.
 * Answers the sales, each `{ id, seller, price, hour, minute, seed }` - the lowest draws under their odds, to the
 * town's and the sellers' ceilings.
 * @param {{ id: string, seller: string, price: number, worth: number, takes?: boolean }[]} listings @param {number} hour
 * @param {{ sold?: number, sellerHour?: Map<string, number>, sellerDay?: Map<string, number> }} [o]
 */
export function patronHour(listings, hour, { sold = 0, sellerHour = new Map(), sellerDay = new Map() } = {}) {
  const cands = [];
  for (const l of listings) {
    if (l.takes === false || !(l.price >= 1)) continue;
    const draw = patronDraw(l.id, hour);
    if (draw >= patronOdds(l.price / patronCap(l.worth))) continue;   // over the cap (or no cap at all) the odds are none
    cands.push({ l, draw });
  }
  cands.sort((a, b) => a.draw - b.draw || (a.l.id < b.l.id ? -1 : 1));
  const out = [];
  const hourN = new Map(sellerHour), dayG = new Map(sellerDay);
  let n = sold;
  for (const { l } of cands) {
    if (n >= PATRON_TOWN_HOUR) break;
    if ((hourN.get(l.seller) ?? 0) >= PATRON_SELLER_HOUR) continue;
    if ((dayG.get(l.seller) ?? 0) + l.price > PATRON_SELLER_DAY_GOLD) continue;
    out.push({ id: l.id, seller: l.seller, price: l.price, hour, minute: patronMinute(l.id, hour), seed: patronSeed(l.id, hour) });
    hourN.set(l.seller, (hourN.get(l.seller) ?? 0) + 1);
    dayG.set(l.seller, (dayG.get(l.seller) ?? 0) + l.price);
    n++;
  }
  return out;
}

/** The hours a reckoning covers: from the one after `last` (none: the listing's own first whole hour, `fromS`) to the one
 *  before `nowS`'s, at most PATRON_RECKON_HOURS of them. @param {number|null} last @param {number} fromS @param {number} nowS */
export function patronHours(last, fromS, nowS) {
  const cur = Math.floor(nowS / PATRON_HOUR_S);
  const first = Math.max(last != null ? last + 1 : Math.floor(fromS / PATRON_HOUR_S) + 1, cur - PATRON_RECKON_HOURS);
  const out = [];
  for (let h = first; h < cur; h++) out.push(h);
  return out;
}
