// @ts-check
// CAPT-BOARD (2026-10-11, the owner: "giving a reason to players to experience it" - and "I want you to make the
// decisions and completely make this as detailed as possible, providing depth without overcomplicating systems";
// bible/03-World/Captains-Sea.md CAPT-BOARD) - THE HARBOURMASTER'S BOARD: work for a captain in every port of the Bay,
// and the crown's favours a captain's standing buys there. The port's own - Daggerfall's harbours post nothing.
//
// THE BOARD: each port posts BOARD_OFFERS contracts a day (a rank's `offers` more - captainLedger.js RANK_PERKS), drawn
// off the port and the world's day on BOARD_SALT's stream - the same board for every client in a room, a new one at
// dawn. Five kinds, each ending in something the sea already does:
//
//   bounty    a named pirate preying on the crown's shipping, last seen SITE_PX map pixels off the port: she is stood
//             when the captain sails within SITE_REACH_PX of her waters (scenes/naval/navalHost.js THE SITES); sunk or
//             taken by the captain's hand, the bounty is paid
//   hunt      CONTRACT_NEED.hunt pirate ships ended - sunk or taken - in the crown's waters
//   delivery  a cargo carried to another port's harbourmaster by her term (a day for every DELIVERY_PX_DAY map pixels
//             and DELIVERY_DAYS_BASE more), in the hold of the boat that took it on: she lies to that port's quay and
//             it is delivered; she is wrecked and it is lost. A port the sea bears on (`deliveryPort` - FIELD BUGS
//             2026-10-13c PORT-TOWNS: a cargo went to a capital in the mountains; FB1020c BERTH-RING: within SEA_RING)
//   salvage   a merchantman gone down off the port: CONTRACT_NEED.salvage casks of her cargo hauled out of the sea where she
//             went down (her casks float there once the captain is near)
//   survey    the Admiralty's measure of the shipping in the crown's waters: CONTRACT_NEED.survey ships studied through the
//             captain's glass (shipKnowledge.js KNOW.studied - the glass held close, never a ship struck), each ship once
//             (her seed kept on the contract - AUDIT CAPTAIN'S SEA L6: a harbour's ship stood again was counted again)
//
// A contract runs on the captain's own clock (playerTicker ownMinutes, as the letter of marque does - a session closed
// is no day of her term), CONTRACTS_MAX at once. Done, it pays its purse (PAY_BASE by kind, times the captain's level's
// PAY_LEVEL and her rank's `pay`) and STANDING_DONE with the crown; failed - past its term, or a delivery's ship wrecked
// - STANDING_FAILED; given up, STANDING_ABANDONED. Pure: the world keeps the contracts (captainLedger.js) and hands this
// module what happened at sea (`advance`) and what the clock says (`expired`).
//
// THE LETTERS: a crown's LETTER OF MARQUE (captainLedger.js marque) for MARQUE_PRICE, MARQUE_DAYS of the captain's
// clock, to a captain of its Privateer rank (`perks.marque`); THE ADMIRALTY'S CARRACK - the one Carrack the Bay sells
// (Come Sail Away's shelves never carry one) - at ADMIRALTY_OFF off her price, to a Commodore (`perks.admiralty`).

import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { classById, shipNames, SHIP_CLASSES } from './navalShips.js';
import { HULL_PRICES } from '../comeSailAway/comeSailAwayHulls.js';
import { MINUTES_PER_DAY } from '../gameDate.js';   // a day of the captain's clock (minutes)
import { hashKey } from '../../net/wire.js';   // FNV-1a over a string: a port's key on the board's stream (SLAM10's one home)
import { seaBears } from '../../net/fortLaw.js';   // FB1020c BERTH-RING: the sea within the port law's ring (SEA_RING) - where the berth names a port; the coast law's home, never the world's placement code (the account Worker bundles this file)
export { hashKey };

export const HARBOUR_CONTRACT_KINDS = Object.freeze(['bounty', 'hunt', 'delivery', 'salvage', 'survey']);
/** The contracts a port's board posts a day, before a rank's more. */
export const BOARD_OFFERS = 3;
/** The contracts a captain holds at once. */
export const CONTRACTS_MAX = 3;
/** The board's own stream's salt. */
export const BOARD_SALT = 0xb0a2d5;
/** Each kind's term (days); a delivery's is DELIVERY_DAYS_BASE and a day for every DELIVERY_PX_DAY map pixels. */
export const TERM_DAYS = Object.freeze({ bounty: 4, hunt: 3, salvage: 3, survey: 2 });
export const DELIVERY_DAYS_BASE = 2;
export const DELIVERY_PX_DAY = 6;
/** A delivery's port lies this many map pixels off, at least (Chebyshev). */
export const DELIVERY_PX_MIN = 6;
/** The purses' base (gold): a bounty's times her size, a hunt's, a salvage's and a survey's times their need, a
 *  delivery's a map pixel. */
export const PAY_BASE = Object.freeze({ bounty: 150, hunt: 85, delivery: 14, salvage: 65, survey: 50 });
/** Every level over the first adds this share to a purse. */
export const PAY_LEVEL = 0.12;
/** A site's distance adds this to its purse a map pixel (gold), a delivery's start this much. */
export const PAY_SITE_PX = 10;
export const PAY_DELIVERY_BASE = 60;
/** A crown's regard for a contract done (a bounty's times her size), failed, or given up. */
export const STANDING_DONE = Object.freeze({ bounty: 3, hunt: 1, delivery: 4, salvage: 3, survey: 2 });
export const STANDING_FAILED = -3;
export const STANDING_ABANDONED = -1;
/** How many a hunt, a salvage and a survey want - the least and the most. */
export const CONTRACT_NEED = Object.freeze({ hunt: Object.freeze([2, 4]), salvage: Object.freeze([3, 5]), survey: Object.freeze([3, 5]) });
/** A bounty's or a wreck's waters lie this many map pixels off her port; the captain within SITE_REACH_PX is there. */
export const SITE_PX = Object.freeze({ near: 3, far: 8 });
export const SITE_REACH_PX = 1;
/** A map pixel in leagues (819.2 m a pixel, captainLedger.js LEAGUE_M a league). */
export const PX_LEAGUES = 819.2 / 4828;
/** A letter of marque: its price and its term (days). */
export const MARQUE_PRICE = 1500;
export const MARQUE_DAYS = 7;
/** The Admiralty's Carrack: her share off Come Sail Away's own price for the hull. */
export const ADMIRALTY_OFF = 0.2;
export const CARRACK_HULL = 4;
/** What a delivery carries, in the board's words. */
export const CARGOES = Object.freeze(['casks of Wayrest wine', 'bales of High Rock wool', 'crates of glassware', 'sealed dispatches', 'a nobleman\'s chests', 'barrels of salt fish', 'sacks of Alik\'r spice', 'crates of Orsinium steel']);
/** The eight ways, east first, counter-clockwise (map y runs south). */
export const COMPASS = Object.freeze(['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east']);
/** The way from one map pixel to another, in words. */
export const compassWords = (dx, dy) => COMPASS[((Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
/** Map pixels as leagues, in words. */
export const leaguesWords = (px) => { const l = Math.max(0.1, Math.round(px * PX_LEAGUES * 10) / 10); return `${l} ${l === 1 ? 'league' : 'leagues'}`; };
const gold = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;
const cheb = (a, b) => Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));

/**
 * A CONTRACT'S PURSE: its kind's base - a bounty's times her size, the counted kinds' times their need, a delivery's a
 * map pixel and its start - with a site's distance, times the captain's level (PAY_LEVEL each over the first) and her
 * rank's `pay`, to the nearest five.
 * @param {string} kind @param {{ level?: number, size?: number, need?: number, px?: number, pay?: number }} o
 */
export function payOf(kind, { level = 1, size = 1, need = 1, px = 0, pay = 0 } = {}) {
  const k = (1 + PAY_LEVEL * (Math.max(1, level | 0) - 1)) * (1 + Math.max(0, Number(pay) || 0));
  let g = 0;
  if (kind === 'bounty') g = PAY_BASE.bounty * Math.max(1, size) * k + px * PAY_SITE_PX;
  else if (kind === 'delivery') g = (PAY_BASE.delivery * px + PAY_DELIVERY_BASE) * k;
  else if (kind === 'salvage') g = PAY_BASE.salvage * need * k + px * PAY_SITE_PX;
  else if (PAY_BASE[kind]) g = PAY_BASE[kind] * need * k;
  return Math.max(5, Math.round(g / 5) * 5);
}

/**
 * A SITE IN OPEN WATER off a port: a way drawn off `r` and a distance between SITE_PX.near and SITE_PX.far, walked in to
 * SITE_PX.near on the square ring (Chebyshev, as every map distance here) and then out to SITE_PX.far (AUDIT CAPTAIN'S SEA
 * B6: a port whose open water lay only past the drawn distance sited nothing) - the first map pixel there whose every
 * neighbour is sea (`seaAt`), the next way round when none (eight ways). Null where the port has no open water about it.
 * `band` another reach than SITE_PX's (a treasure chart's - treasureCharts.js CHART_PX).
 * @param {{ px: number, py: number }} port @param {() => number} r @param {(px: number, py: number) => boolean} seaAt
 * @param {{ near: number, far: number }} [band]
 */
export function siteFor(port, r, seaAt, band = SITE_PX) {
  if (typeof seaAt !== 'function') return null;
  const first = Math.floor(r() * 8);
  const want = band.near + Math.floor(r() * (band.far - band.near + 1));
  const open = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!seaAt(x + dx, y + dy)) return false; return true; };
  for (let k = 0; k < 8; k++) {
    const a = ((first + k) % 8) * (Math.PI / 4);
    const c = Math.cos(a), sn = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(sn));   // on the square ring: `d` pixels off, Chebyshev
    for (let i = 0; i <= band.far - band.near; i++) {
      const d = want - i >= band.near ? want - i : want + (i - (want - band.near));   // in from `want`, then out past it
      if (d > band.far) break;
      const px = port.px + Math.round((c / m) * d), py = port.py - Math.round((sn / m) * d);
      if (open(px, py)) return { px, py, d: cheb({ px, py }, port) };
    }
  }
  return null;
}

/**
 * A PORT A CARGO GOES TO (FIELD BUGS 2026-10-13c PORT-TOWNS): one of the board's ports the sea bears on (`seaAt`), where
 * a ship lies within the berth's reach (scenes/world.js navalPortHere). Travel Options lists the region capitals among
 * its harbours (MAPS.BSA's 0x10 mark - the coast's own bits, the low four, name sides of a place the sea lies on, every
 * one of the 304 that carry one, and no capital carries one), and 31 of them stand with no sea within six pixels.
 * FB1020c BERTH-RING: the reach is the port law's own ring, SEA_RING (net/fortLaw.js seaBears, which world/portSites.js re-exports) - it was a map pixel
 * (net/fortLaw.js coastalAt), the berth's then, and Daggerfall, Sentinel and Wayrest, two pixels off the sea, took no
 * cargo; the berth names a port within SEA_RING now, and every board port has water a hull floats in within it.
 * No sea law, no port. Pure.
 * @param {{ px: number, py: number } | null | undefined} p @param {((px: number, py: number) => boolean) | null | undefined} seaAt
 */
export const deliveryPort = (p, seaAt) => !!p && seaBears(p.px, p.py, seaAt);

/** A bounty's quarry: the strongest pirate within two levels of the captain's (never the flagship before level 12). */
export function bountyClass(level, r) {
  const pool = SHIP_CLASSES.filter((c) => c.faction === 'pirate' && c.minLevel <= Math.max(1, level | 0) + 2 && (!c.flagship || level >= 12));
  if (!pool.length) return classById('pirateSloop');
  const top = pool.slice(-2);
  return top[Math.floor(r() * top.length) % top.length];
}

/**
 * THE BOARD a port posts on a day: BOARD_OFFERS and its rank's more, each kind in turn off the board's stream (a kind
 * the port cannot post - a site with no open water, a delivery with no port far enough on the sea - is passed over). Each offer
 * `{ id, kind, crown, port, title, words, pay, standing, days, need?, target?, to?, cargo? }`; `taken` the ids already
 * taken off it.
 * @param {{ port: { key: string, name: string, px: number, py: number }, crown: string, day: number, level?: number,
 *   perks?: { offers?: number, pay?: number } | null, ports?: { key: string, name: string, px: number, py: number }[],
 *   seaAt?: ((px: number, py: number) => boolean) | null, regionIndex?: number, taken?: Iterable<string> }} o
 */
export function boardFor({ port, crown, day, level = 1, perks = null, ports = [], seaAt = null, regionIndex = 17, taken = [] }) {
  if (!port || !crown) return [];
  const r = mulberry32(((hashKey(port.key) ^ Math.imul((day | 0) + 1, 0x9e3779b1) ^ BOARD_SALT) >>> 0));
  const want = BOARD_OFFERS + Math.max(0, perks?.offers | 0);
  const kinds = [...HARBOUR_CONTRACT_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const gone = new Set(taken);
  const out = [];
  let posted = 0;
  for (let i = 0; posted < want && i < want * 3; i++) {
    const id = `${port.key}:${day | 0}:${i}`;
    const o = offerOf(kinds[i % kinds.length], { id, port, crown, level, pay: perks?.pay ?? 0, ports, seaAt, regionIndex, r });
    if (!o) continue;
    posted++;   // an offer taken stays posted - the board never fills its place till tomorrow
    if (!gone.has(id)) out.push(o);
  }
  return out;
}

/** @param {readonly number[]} range @param {() => number} r */
const between = (range, r) => range[0] + Math.floor(r() * (range[1] - range[0] + 1));
/** One offer of a kind, or null where the port cannot post it. */
function offerOf(kind, { id, port, crown, level, pay, ports, seaAt, regionIndex, r }) {
  const seed = (r() * 0x100000000) >>> 0;
  const base = { id, kind, crown, port: { key: port.key, name: port.name, px: port.px, py: port.py } };
  if (kind === 'bounty') {
    const site = siteFor(port, r, seaAt);
    const cls = bountyClass(level, r);
    if (!site) return null;
    const names = shipNames(cls, seed, { regionIndex });
    const where = `${leaguesWords(site.d)} ${compassWords(site.px - port.px, site.py - port.py)} of ${port.name}`;
    return {
      ...base, title: `Wanted: ${names.captain ? `Captain ${names.captain} of ` : ''}${names.name}`,
      words: `A ${cls.title.toLowerCase()} preying on ${crown}'s shipping, last seen ${where}. Sink it or capture it.`,
      pay: payOf('bounty', { level, size: cls.cargo, px: site.d, pay }), standing: STANDING_DONE.bounty * Math.max(1, cls.cargo), days: TERM_DAYS.bounty,
      target: { px: site.px, py: site.py, seed, classId: cls.id, name: names.name, captain: names.captain ?? null, region: regionIndex }, where,
    };
  }
  if (kind === 'hunt') {
    const need = between(CONTRACT_NEED.hunt, r);
    return { ...base, title: `Clear ${crown}'s waters`, words: `Sink or capture ${need} pirate ships in ${crown}'s waters within ${TERM_DAYS.hunt} days.`,
      pay: payOf('hunt', { level, need, pay }), standing: STANDING_DONE.hunt * need, days: TERM_DAYS.hunt, need };
  }
  if (kind === 'delivery') {
    const far = (ports ?? []).filter((p) => p && p.key !== port.key && cheb(p, port) >= DELIVERY_PX_MIN && deliveryPort(p, seaAt)).sort((a, b) => cheb(a, port) - cheb(b, port) || (a.key < b.key ? -1 : 1));
    if (!far.length) return null;
    const to = far[Math.floor(r() * Math.min(far.length, 6)) % far.length];
    const d = cheb(to, port);
    const days = DELIVERY_DAYS_BASE + Math.ceil(d / DELIVERY_PX_DAY);
    const cargo = CARGOES[Math.floor(r() * CARGOES.length) % CARGOES.length];
    return { ...base, title: `Cargo for ${to.name}`, words: `${cargo.charAt(0).toUpperCase()}${cargo.slice(1)}, to ${to.name}'s harbormaster within ${days} days. It goes in your hold. If you lose your ship, you lose the cargo.`,
      pay: payOf('delivery', { level, px: d, pay }), standing: STANDING_DONE.delivery, days, to: { key: to.key, name: to.name, px: to.px, py: to.py }, cargo };
  }
  if (kind === 'salvage') {
    const site = siteFor(port, r, seaAt);
    if (!site) return null;
    const need = between(CONTRACT_NEED.salvage, r);
    const wreck = shipNames(classById('merchantGalleon'), seed, { regionIndex }).name;
    const where = `${leaguesWords(site.d)} ${compassWords(site.px - port.px, site.py - port.py)} of ${port.name}`;
    return { ...base, title: `Salvage: ${wreck}`, words: `${wreck} went down ${where}. Raise ${need} casks of its cargo before the sea takes them.`,
      pay: payOf('salvage', { level, need, px: site.d, pay }), standing: STANDING_DONE.salvage, days: TERM_DAYS.salvage, need, target: { px: site.px, py: site.py, seed, name: wreck }, where };
  }
  if (kind === 'survey') {
    const need = between(CONTRACT_NEED.survey, r);
    return { ...base, title: 'The Admiralty\'s survey', words: `Study ${need} ships in ${crown}'s waters through your spyglass (their guns, crew and holds) within ${TERM_DAYS.survey} days.`,
      pay: payOf('survey', { level, need, pay }), standing: STANDING_DONE.survey * need, days: TERM_DAYS.survey, need };
  }
  return null;
}

/**
 * A CONTRACT TAKEN: the offer, its term from `now` (the captain's clock, minutes), nothing yet done; a delivery's cargo
 * in `boat`'s hold (her number).
 * @param {any} offer @param {{ now: number, boat?: any }} o
 */
export function takeContract(offer, { now, boat = null }) {
  return { ...JSON.parse(JSON.stringify(offer)), taken: Math.floor(now), until: Math.floor(now) + offer.days * MINUTES_PER_DAY, done: 0, boat: offer.kind === 'delivery' ? boat ?? null : null };
}

/**
 * WHAT HAPPENED AT SEA, TO A CONTRACT: `ev` one of
 *   { type: 'end', act: 'sink'|'board', faction, crown, bounty }   a ship ended by the captain's hand
 *   { type: 'study', crown, seed }                               a ship studied through the glass in a crown's waters
 *   { type: 'haul', site }                                       a cask of a contract's wreck hauled aboard
 *   { type: 'berth', port, boat }                                a boat lying to a port's quay
 *   { type: 'wrecked', boat }                                    a boat of the captain's wrecked
 *   { type: 'lost', bounty }                                     a bounty's quarry gone down by another hand
 *   { type: 'unported', port }                                   a port's key that is no port a cargo goes to (`deliveryPort`)
 * Answers 'done', 'failed', 'void' (AUDIT CAPTAIN'S SEA B4: a bounty whose quarry no hand of the captain's can end now;
 * FIELD BUGS 2026-10-13c PORT-TOWNS: a cargo held for a place that is no port - taken off a board that read a tomb or an
 * inland capital as one) or null (her progress moved or not, in `c.done`).
 * @param {any} c @param {any} ev
 */
export function advance(c, ev) {
  if (!c || !ev) return null;
  const count = () => { c.done = (c.done | 0) + 1; return c.done >= (c.need | 0) ? 'done' : null; };
  if (c.kind === 'bounty') return ev.bounty !== c.id ? null : ev.type === 'end' ? 'done' : ev.type === 'lost' ? 'void' : null;
  if (c.kind === 'hunt') return ev.type === 'end' && ev.faction === 'pirate' && ev.crown === c.crown && (ev.act === 'sink' || ev.act === 'board') ? count() : null;
  if (c.kind === 'survey') {
    if (ev.type !== 'study' || ev.crown !== c.crown) return null;
    // AUDIT CAPTAIN'S SEA L6: each ship once - her seed kept (a harbour's ship stood again, studied again, counted again)
    if (Number.isFinite(ev.seed)) { const seed = ev.seed >>> 0; if ((c.seen ??= []).includes(seed)) return null; c.seen.push(seed); }
    return count();
  }
  if (c.kind === 'salvage') return ev.type === 'haul' && ev.site === c.id ? count() : null;
  if (c.kind === 'delivery') {
    if (ev.type === 'unported') return ev.port === c.to?.key ? 'void' : null;   // FIELD BUGS 2026-10-13c PORT-TOWNS
    if (c.boat == null || ev.boat !== c.boat) return null;
    if (ev.type === 'wrecked') return 'failed';
    return ev.type === 'berth' && ev.port === c.to?.key ? 'done' : null;
  }
  return null;
}
/** Whether a contract's term is out at `now` (the captain's clock, minutes). */
export const expired = (c, now) => Number.isFinite(now) && now >= c.until;

/**
 * A HELD CONTRACT IN THE BOARD'S WORDS: `{ title, words, progress, left }` - how far she has come and the term left.
 * @param {any} c @param {number} now
 */
export function contractLine(c, now) {
  const left = Math.max(0, c.until - now);
  const days = Math.floor(left / MINUTES_PER_DAY), hours = Math.floor((left % MINUTES_PER_DAY) / 60);
  const last = Math.max(1, hours);   // AUDIT CAPTAIN'S SEA B13: under an hour is "1 hour", never "1 hours"
  const term = left <= 0 ? 'Time is up' : days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}${hours ? `, ${hours} ${hours === 1 ? 'hour' : 'hours'}` : ''} left` : `${last} ${last === 1 ? 'hour' : 'hours'} left`;
  const progress = c.kind === 'hunt' ? `${c.done | 0} of ${c.need} ended`
    : c.kind === 'survey' ? `${c.done | 0} of ${c.need} studied`
      : c.kind === 'salvage' ? `${c.done | 0} of ${c.need} casks raised`
        : c.kind === 'delivery' ? `In your hold, for ${c.to?.name ?? 'delivery'}`
          : c.kind === 'bounty' ? `Last seen ${c.where ?? 'off the coast'}` : '';
  return { title: c.title, words: c.words, progress, left: term, pay: gold(c.pay) };
}

/** THE SITES the sea stands for held contracts: a bounty's quarry's waters, a wreck's - `[{ id, kind, px, py, seed, ... }]`. */
export function contractSites(list) {
  const out = [];
  for (const c of list ?? []) {
    if (c.kind === 'bounty' && c.target) out.push({ id: c.id, kind: 'bounty', px: c.target.px, py: c.target.py, seed: c.target.seed, classId: c.target.classId, name: c.target.name, captain: c.target.captain ?? null, region: c.target.region ?? -1 });
    else if (c.kind === 'salvage' && c.target) out.push({ id: c.id, kind: 'salvage', px: c.target.px, py: c.target.py, seed: c.target.seed, n: Math.max(0, (c.need | 0) - (c.done | 0)) });
  }
  return out;
}

/** AUDIT CAPTAIN'S SEA L8: a saved contract's purse and regard kept within what a board posts. */
export const BOARD_PAY_MAX = 1e6;
export const BOARD_STANDING_MAX = 60;
/** A contract from a save, or null for one that cannot be one - AUDIT CAPTAIN'S SEA L8: its purse, its regard, its need
 *  and its count within what a board posts (a purse of -9999 was paid out of the captain's gold, a hunt with no need
 *  was done on its first kill), the ships a survey has counted its own. */
export function restoreContract(c) {
  if (!c || typeof c !== 'object' || !HARBOUR_CONTRACT_KINDS.includes(c.kind) || typeof c.id !== 'string' || typeof c.crown !== 'string') return null;
  if (!Number.isFinite(c.until) || !Number.isFinite(c.pay) || !Number.isFinite(c.days)) return null;
  if ((c.kind === 'bounty' || c.kind === 'salvage') && !(c.target && Number.isFinite(c.target.px) && Number.isFinite(c.target.py))) return null;
  if (c.kind === 'delivery' && !(c.to && typeof c.to.key === 'string')) return null;
  const range = CONTRACT_NEED[c.kind];
  if (range && !(Number.isInteger(c.need) && c.need >= range[0] && c.need <= range[1])) return null;
  const out = { ...c, pay: Math.max(0, Math.min(BOARD_PAY_MAX, Math.round(c.pay))), standing: Math.max(0, Math.min(BOARD_STANDING_MAX, Math.round(Number(c.standing) || 0))), done: Math.max(0, Math.min(range ? c.need : 0, c.done | 0)) };
  if (c.kind === 'survey') out.seen = [...new Set((Array.isArray(c.seen) ? c.seen : []).filter((x) => Number.isInteger(x) && x >= 0 && x <= 0xffffffff))].slice(0, c.need);
  else delete out.seen;
  return out;
}

/**
 * THE LETTER OF MARQUE on a crown's board: `{ can, price, days, why }` - for sale to a captain whose rank brings it
 * (`perks.marque`), whose purse pays MARQUE_PRICE, and who holds no letter already.
 * @param {{ crown: string, perks: any, gold: number, held?: { crown: string } | null }} o
 */
export function marqueOffer({ crown, perks, gold: purse, held = null }) {
  const price = MARQUE_PRICE;
  if (held) return { can: false, price, days: MARQUE_DAYS, why: held.crown === crown ? `You hold ${crown}'s letter already.` : `You already hold ${held.crown}'s letter. You can only hold one at a time.` };
  if (!perks?.marque) return { can: false, price, days: MARQUE_DAYS, why: `${crown} grants letters of marque to its Privateers.` };
  if ((Number(purse) || 0) < price) return { can: false, price, days: MARQUE_DAYS, why: `A letter costs ${gold(price)}.` };
  return { can: true, price, days: MARQUE_DAYS, why: '' };
}

/**
 * THE ADMIRALTY'S CARRACK on a crown's board: `{ can, price, why }` - for sale to a Commodore (`perks.admiralty`) at
 * ADMIRALTY_OFF off her price.
 * @param {{ crown: string, perks: any, gold: number }} o
 */
export function admiraltyOffer({ crown, perks, gold: purse }) {
  const price = Math.round(HULL_PRICES[CARRACK_HULL] * (1 - ADMIRALTY_OFF));
  if (!perks?.admiralty) return { can: false, price, why: `${crown}'s Admiralty sells its carrack to its Commodores.` };
  if ((Number(purse) || 0) < price) return { can: false, price, why: `The Admiralty asks ${gold(price)}.` };
  return { can: true, price, why: '' };
}
