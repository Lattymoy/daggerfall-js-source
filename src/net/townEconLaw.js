// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TOWN-ECON (2026-10-16, bible/06-Systems/Town-Economy-Arc.md; Mac: "give every city and village a dynamic economy
// system, where even players can affect the influence. Allowing players to hover over towns and see an economy tooltip
// along with guild control"): THE TOWN ECONOMY'S LAW - one Prosperity a town, 0 to 100, and what it does to the town's
// counters and its card.
//
//  - A TOWN is a MAPS location of type TownCity, TownHamlet or TownVillage (formats/mapsFile.js LOCATION_TYPES 0-2),
//    its market cycle phased by its map pixel (`townKeyOf`); TE2's service keys it by its unsigned map id - the seats',
//    the homes', the stalls' and the patrons' own.
//  - THE BASELINE IS PURE (TE0 decision 2): the town's size, its own market cycle over real UTC days (a closed form,
//    phased by its pixel - a player away a month reads what one who stayed reads), its seat's Standing and Edict, and a
//    raid at its gates. THE PLAYERS' SHARE (TE2, the account service's count of witnessed acts - the law's lines below,
//    read by both ends) is an argument, bounded here to TOWN_PLAYERS_MAX.
//  - THE PRICE (TE0 decision 4 - Mac: "Wider swings, ±25%+", an exception to the Economy arc's law 5, bounded): what a
//    counter ASKS moves by up to TOWN_PRICE_SWING each way; what it PAYS falls by the same share away from the middle,
//    either way, and never rises - AUDIT TOWN-ECON LAW-1: a Booming town's counter never pays more than it asks, so the
//    essentials' half (shopStock.js ESSENTIALS-HALF) breaks even there as it does at the region's price; with a seat's
//    factor the asking factor never goes below TOWN_FACTOR_FLOOR, the deepest a seat alone already gives
//    (townSeatLaw.js seatShopFactor). Never through regionPriceAdjustment (Seats-Arc 7.2: quest gold reads that index).
//
// Not a DFU member: DFU prices by region alone (RegionData.PriceAdjustment, FormulaHelper.CalculateCost). Ledger A
// (THE TOWN ECONOMY's row). Pure: no clock, no network, no DOM.
// ═══════════════════════════════════════════════════════════════════

import { seatTipOf, seatShopFactor, kingdomName, CROWN_SEAT_REGIONS } from './townSeatLaw.js';   // TE0 decision 5: a seat town's card, its area's holder; AUDIT TOWN-ECON UI-4: Market Day on the card's price
import { t } from '../systems/textManager.js';   // L10N4: the card's words in the player's language, each read when it is said

/** The location types that are towns (mapsFile.js LOCATION_TYPES TownCity, TownHamlet, TownVillage). */
export const TOWN_ECON_TYPES = Object.freeze([0, 1, 2]);
/** Whether a MAPS location type is a town with an economy. @param {unknown} type */
export const isEconTown = (type) => TOWN_ECON_TYPES.includes(/** @type {number} */ (type));
/** A town's key: its map pixel, as the relay's receipts and the market's boards name it. @param {number} px @param {number} py */
export const townKeyOf = (px, py) => py * 1000 + px;

/** The middle of the scale, and its ends. */
export const TOWN_BASE = 50;
export const TOWN_PROSPERITY_MAX = 100;
/** The town's size, by its location type: a city, a town, a village. */
export const TOWN_SIZE = Object.freeze({ 0: 6, 1: 2, 2: -2 });
/** The market cycle: two waves over real days, each its amplitude and its period in days. */
export const TOWN_CYCLE = Object.freeze([Object.freeze({ amp: 12, days: 11 }), Object.freeze({ amp: 6, days: 29 })]);
/** A seat town's Standing moves it (Standing - 50) / TOWN_STANDING_DIV. */
export const TOWN_STANDING_DIV = 5;
/** The Edict in force at a seat town, as a term of its Prosperity (townSeatLaw.js EDICTS' ids). */
export const TOWN_EDICT_TERMS = Object.freeze({ 'market-day': 6, festival: 8, 'open-gates': 3, levy: -6, curfew: -4 });
/** A raid running at the town's gates. */
export const TOWN_RAID_TERM = -15;
/** The most the players' share (TE2) adds. */
export const TOWN_PLAYERS_MAX = 30;
/** SEA-TRADE (Town-Economy-Arc section 8): a port town's sea lanes (systems/naval/seaLanes.js laneNetwork - the Bay's
 *  packets between its ports, every client's the same) each add TOWN_SEA_LANE, TOWN_SEA_LANES_MAX of them at most. */
export const TOWN_SEA_LANE = 2;
export const TOWN_SEA_LANES_MAX = 3;
/** The lanes' term of a town: its lanes, a whole number held to TOWN_SEA_LANES_MAX. @param {unknown} lanes */
export const townSeaTerm = (lanes) => (Number.isSafeInteger(lanes) && /** @type {number} */ (lanes) > 0 ? Math.min(TOWN_SEA_LANES_MAX, /** @type {number} */ (lanes)) * TOWN_SEA_LANE : 0);
/** The bands, highest first: each its name and its least Prosperity. @type {ReadonlyArray<readonly [string, number]>} */
export const TOWN_BANDS = Object.freeze([
  /** @type {readonly [string, number]} */ (Object.freeze(['Booming', 85])), /** @type {readonly [string, number]} */ (Object.freeze(['Thriving', 65])),
  /** @type {readonly [string, number]} */ (Object.freeze(['Steady', 35])), /** @type {readonly [string, number]} */ (Object.freeze(['Struggling', 15])),
  /** @type {readonly [string, number]} */ (Object.freeze(['Destitute', 0])),
]);
/** How far a town moves what its counters ask, each way (Mac: "Wider swings, ±25%+"). */
export const TOWN_PRICE_SWING = 0.25;
/** The deepest a counter's asking factor goes, a town's and a seat's together: a seat's own deepest, a crown's loved
 *  member on Market Day (townSeatLaw.js seatShopFactor: MEMBER_DISCOUNT.crown 0.15, LOVED_DISCOUNT 0.05,
 *  MARKET_DAY_DISCOUNT 0.10). */
export const TOWN_FACTOR_FLOOR = 0.70;
/** A real day, ms - the cycle's day and TE2's tally's. */
export const TOWN_DAY_MS = 86_400_000;
/** The real (UTC) day of an epoch ms. @param {number} ms */
export const townDayOf = (ms) => Math.floor(ms / TOWN_DAY_MS);

/** FNV-1a over a short string (net/patronLaw.js's mix) - a town's phases. @param {string} s */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
/** THE MARKET CYCLE: a town's own rise and fall on a real day - each wave phased by the town's key. @param {number} key @param {number} day */
export function townCycle(key, day) {
  let s = 0;
  for (let i = 0; i < TOWN_CYCLE.length; i++) {
    const w = TOWN_CYCLE[i];
    const wave = Math.sin(2 * Math.PI * (day / w.days + fnv(`${key}:${i}`) / 4294967296));   // the wave's angle, never a wrap
    s += w.amp * wave;
  }
  return s;
}
/** A seat town's term: its holder's Standing and the Edict in force - 0 for an unheld seat, or none. AUDIT TOWN-ECON
 *  LAW-6: an Edict is looked for among the table's OWN names - `toString` read the object's own function, and the sum
 *  became a string that took the whole reading to the middle.
 *  @param {any} seat a dressed seat (net/townSeatBook.js dressed), or null */
export function townSeatTerm(seat) {
  const h = seat?.holder;
  if (!h) return 0;
  const standing = Number.isFinite(h.standing) ? (h.standing - 50) / TOWN_STANDING_DIV : 0;
  const edict = typeof h.edict === 'string' && Object.prototype.hasOwnProperty.call(TOWN_EDICT_TERMS, h.edict)
    ? TOWN_EDICT_TERMS[/** @type {keyof typeof TOWN_EDICT_TERMS} */ (h.edict)] : 0;
  return standing + edict;
}
/** A Prosperity held to the scale, a whole number. @param {number} p */
const held = (p) => Math.max(0, Math.min(TOWN_PROSPERITY_MAX, Math.round(Number.isFinite(p) ? p : TOWN_BASE)));
/**
 * A TOWN'S PROSPERITY on a real day, 0 to 100.
 * @param {{ key: number, type: number, day: number, seat?: any, raided?: boolean, players?: number, lanes?: number }} t
 *   `seat` the town's own seat, dressed (null for none); `raided` a raid running at its gates; `players` TE2's share;
 *   `lanes` SEA-TRADE: a port town's sea lanes (townSeaTerm)
 */
export function townProsperity({ key, type, day, seat = null, raided = false, players = 0, lanes = 0 }) {
  const n = Number(players);
  const share = Number.isNaN(n) ? 0 : Math.max(0, Math.min(TOWN_PLAYERS_MAX, n));   // AUDIT TOWN-ECON LAW-6: an infinite share is the most, never nothing
  return held(TOWN_BASE + (TOWN_SIZE[/** @type {0|1|2} */ (type)] ?? 0) + townCycle(key, day) + townSeatTerm(seat) + (raided ? TOWN_RAID_TERM : 0) + share + townSeaTerm(lanes));
}
/** A Prosperity's band. @param {number} p */
export const townBandOf = (p) => (TOWN_BANDS.find(([, least]) => held(p) >= least) ?? TOWN_BANDS[TOWN_BANDS.length - 1])[0];
/** What the town's counters ASK, as a factor of their price - 0.75 Booming at 100 to 1.25 at 0. @param {number} p */
export const townBuyFactor = (p) => 1 - (TOWN_PRICE_SWING * (held(p) - TOWN_BASE)) / TOWN_BASE;
/** What they PAY for a sale - the same share less either side of the middle, 0.75 at 0 and at 100, never more than 1:
 *  a Struggling town has less coin, and a Booming one is stocked and pays no more than it asks (AUDIT TOWN-ECON LAW-1).
 *  @param {number} p */
export const townSaleFactor = (p) => 1 - (TOWN_PRICE_SWING * Math.abs(held(p) - TOWN_BASE)) / TOWN_BASE;
/** SEA-TRADE (Town-Economy-Arc section 8): A PORT'S EXCHANGE (systems/naval/tradeGoods.js exchangeOf) by its town's
 *  economy - what it sells a captain at the town's asking factor, what it pays at its paying factor (never more than it
 *  asks, so the exchange's own spread only widens). No seat's discount: a seat's is its shops'. @param {number} p */
export const townExchangeFactors = (p) => Object.freeze({ ask: townBuyFactor(p), pay: townSaleFactor(p) });
/** The trade window's modes a counter PAYS in - a sale, and the Mages Guild's sale of a magic piece (AUDIT TOWN-ECON
 *  LAW-5: it read 1, so a Destitute town's guild paid the region's price its shops would not). */
export const TOWN_SALE_MODES = Object.freeze(['Sell', 'SellMagic']);
/**
 * A COUNTER'S FACTOR in the town, for `mode` (the trade window's: Buy, Repair, Sell, SellMagic) - what it asks, the
 * town's asking factor times the seat's (`seatFactor`, townSeatLaw.js seatShopFactor, 1 for none), never below
 * TOWN_FACTOR_FLOOR; what it pays, the town's paying factor, never above what it asks THIS player; any other mode 1.
 * SEAT-LOOP (Town-Economy-Arc 7.5, Mac: "Close it"): a seat's discount - its holder's members', Market Day's - lowered
 * what a counter asked while what it paid stood, so an essential (half its price online) bought and sold back paid
 * (five firewood, 13 in and 15 out on Market Day); what it pays falls with what it asks.
 * @param {number} p @param {string} mode @param {number} [seatFactor]
 */
export function townShopFactor(p, mode, seatFactor = 1) {
  const ask = Math.max(TOWN_FACTOR_FLOOR, townBuyFactor(p) * seatFactor);
  if (TOWN_SALE_MODES.includes(mode)) return Math.min(townSaleFactor(p), ask);
  if (mode !== 'Buy' && mode !== 'Repair') return 1;
  return ask;
}

// ─── TE2: THE PLAYERS' SHARE (Town-Economy-Arc section 4) ─────────────
// Witnessed acts at a town - its footsteps (the relay's signed Watch ticks), its players' traders' sales (the market's,
// and LW15's patrons') and a raid driven from its gates - counted by the account service a town a day by source, each
// account capped a town a day, and read back by every client as one share. The service and the client both read
// these lines; nothing a player pays in gold moves a town (TE0 decision 3).

/** The sources of a town's activity. SEA-TRADE: `sea`, a captain's dealing at its exchange. */
export const TOWN_ECON_SOURCES = Object.freeze(['watch', 'trade', 'raid', 'sea']);
/** What one act of each source weighs. SEA-TRADE: a ship's dealing half a trader's sale - the sale is this service's
 *  own record, the dealing the client's word that a tick vouches (a pose's worth, as the watch's). */
export const TOWN_ECON_WEIGHTS = Object.freeze({ watch: 1, trade: 4, raid: 20, sea: 2 });
/** The most of each source one account counts at one town in one real day: an hour's walking, ten sales, a raid, ten
 *  dealings at its exchange. */
export const TOWN_ECON_CAPS = Object.freeze({ watch: 30, trade: 10, raid: 1, sea: 10 });
/** SEA-TRADE: a captain's dealing is vouched by the relay's Watch tick that stood them at the port - a tick at its pixel
 *  or one beside it (a ship at its quay, trading from the helm - the harbour office's own reach), no older than
 *  TOWN_SEA_TICK_S when the deal is made. One tick vouches one dealing. */
export const TOWN_SEA_REACH_PX = 1;
export const TOWN_SEA_TICK_S = 600;
/** A day's acts weigh TOWN_ECON_DECAY less for each day past. */
export const TOWN_ECON_DECAY = 0.8;
/** The days a town's acts are kept and weighed - today and the thirteen before. */
export const TOWN_ECON_DAYS = 14;
/** The activity at which the share is half its most - a town crowded by one zerg comes no nearer the top than
 *  TOWN_PLAYERS_MAX. */
export const TOWN_ECON_HALF = 150;
/** How long the service keeps the towns' shares it answers, and a client the shares it read, s. */
export const TOWN_ECON_KEPT_S = 300;
/** The least share the service answers a town with (TE2: "each town with a share of 1 or more"). */
export const TOWN_ECON_SHARE_LEAST = 1;
/** The Watch receipts one claim carries. */
export const TOWN_WATCH_CLAIM_MAX = 12;
/** The witness kind of a town's registry row (world_witness), and the reports an account may give an hour - AUDIT
 *  TOWN-ECON 2 SVC-1: a walk's (a report goes with a Watch tick at the town, one each WATCH_TICK_MS), where 48 was three
 *  accounts' 48 towns an hour of a list typed in. */
export const TOWN_WITNESS_KIND = 'town';
export const TOWN_WITNESS_HOUR = 12;

/** A TOWN'S ACTIVITY on `today`: its rows (`{ day, src, n }`, the service's town_econ_days) weighed by source and by
 *  TOWN_ECON_DECAY a day past - the rows of the TOWN_ECON_DAYS days to `today` alone, a source the table does not name
 *  nothing. @param {ReadonlyArray<{ day: number, src: string, n: number }>} rows @param {number} today */
export function townActivity(rows, today) {
  let a = 0;
  for (const r of rows ?? []) {
    const age = today - Number(r?.day);
    const w = TOWN_ECON_SOURCES.includes(r?.src) ? TOWN_ECON_WEIGHTS[/** @type {keyof typeof TOWN_ECON_WEIGHTS} */ (r.src)] : 0;
    const n = Number(r?.n);
    if (!(age >= 0 && age < TOWN_ECON_DAYS) || !w || !(n > 0)) continue;
    a += w * n * TOWN_ECON_DECAY ** age;
  }
  return a;
}
/** THE PLAYERS' SHARE of an activity: TOWN_PLAYERS_MAX x A / (A + TOWN_ECON_HALF) - half the most at TOWN_ECON_HALF,
 *  never the most. @param {number} a */
export const townPlayersShare = (a) => (a > 0 && Number.isFinite(a) ? (TOWN_PLAYERS_MAX * a) / (a + TOWN_ECON_HALF) : a === Infinity ? TOWN_PLAYERS_MAX : 0);
/** A share as the service answers it: one decimal. @param {number} share */
export const townShareShown = (share) => Math.round(share * 10) / 10;

/** A map id's pixel id - its low 20 bits (DFU's ContentReader keys the map's summaries by them and asks a pixel's,
 *  MapsFile.GetMapPixelID: y x 1000 + x). @param {number} map */
export const townPixelIdOf = (map) => (map >>> 0) & 0x000fffff;
/** A TOWN'S REGISTRY REPORT (TE2, the witnessed town): the town a client stands in, by its map id, its pixel, its region
 *  and its location's index in the region - canonical, or null. The service learns from three agreeing accounts which
 *  town stands at a Watch tick's pixel and which a raid's `region:location` names. AUDIT TOWN-ECON 2 SVC-1: the map id
 *  names its own pixel (townPixelIdOf), so a report of a map id at a pixel that is not its own is none.
 *  @param {any} raw `{ map, px, py, region, location }` */
export function townReportOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { map, px, py, region, location } = raw;
  const ok = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
  if (!ok(map, 0xffffffff) || map === 0 || !ok(px, 999) || !ok(py, 499) || !ok(region, 61) || !ok(location, 9999)) return null;
  if (townPixelIdOf(map) !== py * 1000 + px) return null;
  return { map, px, py, region, location };
}
/** A report as world_witness keeps it. @param {{ map: number, px: number, py: number, region: number, location: number }} t */
export const townReportText = (t) => JSON.stringify([t.map, t.px, t.py, t.region, t.location]);
/** A kept report read back, or null. @param {unknown} s */
export function parseTownReport(s) {
  if (typeof s !== 'string') return null;
  let v;
  try { v = JSON.parse(s); } catch { return null; }
  if (!Array.isArray(v) || v.length !== 5) return null;
  const t = townReportOf({ map: v[0], px: v[1], py: v[2], region: v[3], location: v[4] });
  return t && townReportText(t) === s ? t : null;
}

/** What a town card's trend is, yesterday to today - its id; the card says it in the player's language (TREND_WORDS).
 *  AUDIT TOWN-ECON UI-3: yesterday is read on today's seat, raid and players, so it is the MARKET's trend - its cycle -
 *  and the card says so ("Market rising."). @param {number} p @param {number} prev */
export const townTrendWord = (p, prev) => (p > prev ? 'rising' : p < prev ? 'falling' : 'flat');
/** L10N4: the card's words in the player's language, each read when it is said (systems/textManager.js t). */
const BAND_WORDS = Object.freeze({
  Booming: () => t('town.econ.band.booming', 'Booming'),
  Thriving: () => t('town.econ.band.thriving', 'Thriving'),
  Steady: () => t('town.econ.band.steady', 'Steady'),
  Struggling: () => t('town.econ.band.struggling', 'Struggling'),
  Destitute: () => t('town.econ.band.destitute', 'Destitute'),
});
const TREND_LINES = Object.freeze({
  rising: () => t('town.econ.trend.rising', 'Market rising.'),
  falling: () => t('town.econ.trend.falling', 'Market falling.'),
  flat: () => t('town.econ.trend.flat', 'Market flat.'),
});
/** A band in the player's language (its id is townBandOf's). @param {string} band */
export const townBandWord = (band) => BAND_WORDS[/** @type {keyof typeof BAND_WORDS} */ (band)]?.() ?? band;
/** The card's first line: the band, the Prosperity out of 100, and the market's trend. @param {number} p @param {number} prev */
export const townEconomyLine = (p, prev) => t('town.econ.line', 'Economy: {band} ({p}/100). {trend}',
  { band: townBandWord(townBandOf(p)), p: held(p), trend: TREND_LINES[townTrendWord(held(p), held(prev))]() });
/** A factor's distance from 1 in whole percents - one rounding for both sides (AUDIT TOWN-ECON UI-7: 1.015 and 0.985
 *  printed 1 and 2). @param {number} f */
const pctOf = (f) => Math.round(Math.abs(1 - f) * 100 + 1e-9);
/** The card's price line - what the town's counters ask EVERYONE (the town's factor with Market Day's, never a member's
 *  own discount - AUDIT TOWN-ECON UI-4) and what they pay, as shares of the region's usual prices.
 *  @param {number} p @param {number} [seatFactor] the seat's factor for a buyer of no guild (townSeatLaw.js seatShopFactor) */
export function townPriceLine(p, seatFactor = 1) {
  const askF = townShopFactor(p, 'Buy', seatFactor);
  const ask = pctOf(askF), pay = pctOf(townShopFactor(p, 'Sell', seatFactor));   // AUDIT TOWN-ECON 2 PRICE-3: what a counter pays, SEAT-LOOP's bound and all
  if (ask > 0 && askF > 1) return t('town.econ.price.moreLess', 'Shops here ask {ask}% more and pay {pay}% less than the region\'s usual prices.', { ask, pay });
  if (ask > 0) {
    return pay > 0 ? t('town.econ.price.lessLess', 'Shops here ask {ask}% less and pay {pay}% less than the region\'s usual prices.', { ask, pay })
      : t('town.econ.price.askLess', 'Shops here ask {ask}% less than the region\'s usual prices.', { ask });
  }
  return pay > 0 ? t('town.econ.price.payLess', 'Shops here ask the region\'s usual prices and pay {pay}% less.', { pay })
    : t('town.econ.price.same', 'Shops here ask and pay the region\'s usual prices.');
}
/** Why a town stands where it does, in one line - the strongest reason first (townReasonLine), each read when said. */
export const TOWN_REASONS = Object.freeze({
  get raid() { return t('town.econ.reason.raid', 'A raid at its gates is hurting trade.'); },
  get 'market-day'() { return t('town.econ.reason.marketDay', 'Market Day draws trade.'); },
  get festival() { return t('town.econ.reason.festival', 'The Festival draws visitors.'); },
  get 'open-gates'() { return t('town.econ.reason.openGates', 'Open Gates draw trade.'); },
  get levy() { return t('town.econ.reason.levy', 'The Levy weighs on trade.'); },
  get curfew() { return t('town.econ.reason.curfew', 'The Curfew keeps buyers home.'); },
  get players() { return t('town.econ.reason.players', 'Busy with travellers and traders.'); },
  get harbour() { return t('town.econ.reason.harbour', 'Its harbor brings trade.'); },   // SEA-TRADE: a port town's lanes
});
/** @param {{ raided?: boolean, edict?: string|null, players?: number, lanes?: number }} r */
export function townReasonLine({ raided = false, edict = null, players = 0, lanes = 0 }) {
  if (raided) return TOWN_REASONS.raid;
  if (edict && Object.prototype.hasOwnProperty.call(TOWN_EDICT_TERMS, edict)) return TOWN_REASONS[/** @type {keyof typeof TOWN_REASONS} */ (edict)];
  if (players >= 1) return TOWN_REASONS.players;
  return townSeaTerm(lanes) > 0 ? TOWN_REASONS.harbour : null;
}
/** The area's line for a town that is not a seat: the seat whose bailiwick it is in and its holder; no seat, nobody's.
 *  AUDIT TOWN-ECON UI-2: the Charter worded in the player's language around the town's (or the crown's kingdom's) name
 *  and the guild's own - charterName and guildWords are the seats' English, and sat inside every language's grammar.
 *  @param {any} area a dressed seat, or null for a region with none */
export function townAreaLine(area) {
  if (!area) return t('town.econ.area.none', 'No guild holds this area.');
  const g = area.holder?.guild;
  const guild = g ? `${g.name} <${g.tag}>` : null;
  if (area.tier === 'crown') {
    const kingdom = kingdomName(CROWN_SEAT_REGIONS[/** @type {17|20|23} */ (area.region)]) ?? area.name;
    return guild ? t('town.econ.area.crownHeld', 'Under the Crown Charter of {kingdom}: held by {guild}', { kingdom, guild })
      : t('town.econ.area.crownUnheld', 'Under the Crown Charter of {kingdom}: unheld', { kingdom });
  }
  return guild ? t('town.econ.area.held', 'Under the Charter of {town}: held by {guild}', { town: area.name, guild })
    : t('town.econ.area.unheld', 'Under the Charter of {town}: unheld', { town: area.name });
}

/** TOWN-ECON TE3: the chapters' patrons a card names at most. */
export const TOWN_TIP_PATRONS_MAX = 2;
/** AUDIT TOWN-ECON 2 LIV-3: the lines a card may hold before the patrons' line and still say it - one short of the card's
 *  bound (ui/eventMapMarks.js TOWN_TIP_LINES_MAX 7): a held seat's card in a Tourney week made it the seventh, wrapped to
 *  five rows past a landscape phone's height. */
export const TOWN_TIP_PATRONS_ROOM = 5;
/** TOWN-ECON TE3 (Town-Economy-Arc 5): the card's line of the region's chapters' patrons - the player guilds that hold a
 *  chapter's patronage in the town's region (net/chapterSheet.js patronsIn: the most chapters first), TOWN_TIP_PATRONS_MAX
 *  by name and the rest a count (AUDIT TOWN-ECON 2 LIV-3, LIV-10: three long names ran the line past SEAT_TIP_TEXT_MAX in
 *  three languages and cut it mid-tag); null for none. AUDIT TOWN-ECON 2 LIV-11: "the region", as a chapter is its
 *  region's - the line above says "area" of the seat's bailiwick. @param {ReadonlyArray<{ name: string, tag?: string }>} patrons */
export function townPatronsLine(patrons) {
  const all = patrons ?? [];
  const list = all.slice(0, TOWN_TIP_PATRONS_MAX).map((g) => (g.tag ? `${g.name} <${g.tag}>` : g.name)).join(', ');
  if (!list) return null;
  const more = all.length - TOWN_TIP_PATRONS_MAX;
  return more > 0 ? t('town.econ.patronsMore', 'Chapter patrons in the region: {list} and {n} more', { list, n: more })
    : t('town.econ.patrons', 'Chapter patrons in the region: {list}', { list });
}

/**
 * A TOWN'S CARD for a map's hover (`{ title, lines }`, the EVENT-TIP card - ui/eventMapMarks.js readTip): its economy
 * and its market, its prices, the strongest reason, then its guild control - a seat town's own SEAT-TIP lines, or the
 * area's holder (`area` undefined where the seats are not known here: the line is left out). AUDIT TOWN-ECON UI-1: a
 * held seat's card leaves out its first line ("The Charter of X: held by G") - its holder line names the guild again,
 * and the card ran past a landscape phone's height by that much. TOWN-ECON TE3: then the area's chapters' patrons
 * (`patrons`), last - the line a full card leaves off.
 * @param {{ name: string, p: number, prev: number, raided?: boolean, players?: number, seat?: any, area?: any, patrons?: ReadonlyArray<{ name: string, tag?: string }>, lanes?: number }} t
 * @param {number} [nowMs] the seat card's clock (a called siege)
 */
export function townTipOf({ name, p, prev, raided = false, players = 0, seat = null, area = undefined, patrons = [], lanes = 0 }, nowMs = Date.now()) {
  if (!name) return null;
  const lines = [townEconomyLine(p, prev), townPriceLine(p, seatShopFactor(seat, null))];
  const reason = townReasonLine({ raided, edict: seat?.holder?.edict ?? null, players, lanes });
  if (reason) lines.push(reason);
  const card = seat ? seatTipOf(seat, nowMs) : null;
  if (card) lines.push(...card.lines.slice(seat.holder?.guild ? 1 : 0));
  else if (area !== undefined) lines.push(townAreaLine(area));
  const backers = townPatronsLine(patrons);
  if (backers && lines.length <= TOWN_TIP_PATRONS_ROOM) lines.push(backers);   // AUDIT TOWN-ECON 2 LIV-3: where the card has room
  return { title: name, lines };
}
