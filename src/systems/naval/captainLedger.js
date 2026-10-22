// @ts-check
// CAPT-LOG (2026-10-11, the owner: "I want you to make the decisions and completely make this as detailed as possible,
// providing depth without overcomplicating systems" - of "enhancing the naval experience and polishing it more, making it
// rewarding and giving a reason to players to experience it"; bible/03-World/Captains-Sea.md) - THE CAPTAIN'S LEDGER:
// what a captain has done at sea, and what the three crowns of the Bay make of it. The port's own - Daggerfall has no
// sea. Pure: the hosts tell it what happened (scenes/naval/navalHost.js chargePlayer, the harbour board, the exchange, the
// Eltheric Ocean) and read it back (the Captain page, the harbour's favours); the save keeps it (CAPTAIN_SAVE_VENDOR).
//
// THE LOG is a captain's record: ships sunk and taken by their trade, boarders thrown back, prizes claimed, the plunder's
// worth, contracts and bounties done, the exchange's trade, the leagues sailed, the treasure found, the Eltheric isles
// charted and how deep a captain has gone there, the legends ended, and the richest prize.
//
// STANDING is a crown's regard for a captain at sea, one number a crown (Daggerfall, Wayrest, Sentinel - navalShips.js
// CROWNS), apart from DFU's legal reputation (which the law at sea moves as it always did - navalLaw.js). Ending pirates
// in a crown's waters raises it by their size (DEED_STANDING times her class's cargo, 1-4); piracy against a crown's own
// lawful ships lowers it (PIRACY_STANDING); a contract done for a crown's harbour raises it (the board's own). STANDING
// RANKS a captain with each crown (CROWN_RANKS) and each rank brings its favours in that crown's harbours (RANK_PERKS): the
// shipwright's prices, the board's pay and offers, the letter of marque, the Admiralty's ship and seasoned hands, the
// navy at the captain's side. A crown whose navy hunts the captain keeps no favours (PERKS_REFUSED_AT notoriety).
//
// THE LETTER OF MARQUE (CAPT-MARQUE): a crown's commission against its rivals' shipping, held until a day of the
// captain's own clock. Under it a rival crown's lawful ship struck is that rival's grievance, never the commissioning
// crown's - and the commissioning crown's regard rises by MARQUE_STANDING. Strike a ship of the crown that signed it and
// the letter is torn up.

import { CROWNS } from './navalShips.js';
import { LEAGUE_M, inEtherLaw, ETHER_WORD } from '../../world/ethericSea.js';
import { HARBOUR_CONTRACT_KINDS, CONTRACTS_MAX, STANDING_FAILED, STANDING_ABANDONED, advance, expired, restoreContract } from './harbourBoard.js';
import { captainOf, heldStars, starStats } from './captainTree.js';   // CAPTAIN-TREE: a captain's level off the log, and the stars held

export const CAPTAIN_SAVE_VENDOR = 'Captain';
export const CAPTAIN_SAVE_VERSION = 1;
/** A crown's regard is kept in this band. */
export const CROWN_STANDING_MAX = 999;
export const CROWN_STANDING_MIN = -99;
/** The ranks a crown names a captain, by the least standing each begins at - lowest first. */
export const CROWN_RANKS = Object.freeze([
  Object.freeze({ rank: 0, at: -Infinity, key: 'unsworn', title: 'Unsworn' }),
  Object.freeze({ rank: 1, at: 15, key: 'sworn', title: 'Sworn Captain' }),
  Object.freeze({ rank: 2, at: 50, key: 'privateer', title: 'Privateer' }),
  Object.freeze({ rank: 3, at: 120, key: 'commodore', title: 'Commodore' }),
  Object.freeze({ rank: 4, at: 250, key: 'admiral', title: 'Admiral' }),
]);
/** The rank a standing earns (CROWN_RANKS' row). */
export function crownRankOf(standing) {
  const s = Number(standing) || 0;
  let r = CROWN_RANKS[0];
  for (const x of CROWN_RANKS) if (s >= x.at) r = x;
  return r;
}
/** The next rank, and the standing still wanting for it - or null at the top. */
export function nextRankOf(standing) {
  const r = crownRankOf(standing);
  const next = CROWN_RANKS[r.rank + 1];
  return next ? { rank: next, wanting: Math.max(0, next.at - (Number(standing) || 0)) } : null;
}
/**
 * WHAT A RANK BRINGS in its crown's harbours: `yard` off the shipwright's prices, `pay` on the board's purses, `offers`
 * more on the board a day, `marque` a letter of marque for sale, `admiralty` the Admiralty's Carrack for sale, `seasoned`
 * hands hired come Seasoned (shipCrew.js SEASONED_HIRE), `relief` the crown's navy always answers a captain under a
 * pirate's guns (navalDirector.js THE RELIEF).
 */
export const RANK_PERKS = Object.freeze([
  Object.freeze({ yard: 0, pay: 0, offers: 0, marque: false, admiralty: false, seasoned: false, relief: false }),
  Object.freeze({ yard: 0.05, pay: 0.1, offers: 1, marque: false, admiralty: false, seasoned: false, relief: false }),
  Object.freeze({ yard: 0.1, pay: 0.2, offers: 1, marque: true, admiralty: false, seasoned: false, relief: false }),
  Object.freeze({ yard: 0.15, pay: 0.3, offers: 2, marque: true, admiralty: true, seasoned: true, relief: false }),
  Object.freeze({ yard: 0.2, pay: 0.4, offers: 2, marque: true, admiralty: true, seasoned: true, relief: true }),
]);
/** A crown whose notoriety in its waters stands this high (one of the plate's anchors) keeps no favours for the captain. */
export const PERKS_REFUSED_AT = 25;
/** What a rank brings, or nothing while the crown hunts the captain (`notoriety` in its waters). */
export const perksOf = (rank, notoriety = 0) => ((Number(notoriety) || 0) >= PERKS_REFUSED_AT ? RANK_PERKS[0] : RANK_PERKS[Math.max(0, Math.min(RANK_PERKS.length - 1, rank | 0))]);
/** A pirate's end in a crown's waters, times her size (her class's cargo, 1-4): sunk, taken by boarding, or her boarders
 *  thrown back off the captain's own deck. */
export const DEED_STANDING = Object.freeze({ sunk: 2, taken: 3, repelled: 2 });
/** Piracy against a crown's own lawful ship - the crown's regard lost, once an act a ship (navalLaw.js lawOf's acts). */
export const PIRACY_STANDING = Object.freeze({ fire: -5, sink: -8, board: -10 });
/** A rival crown's lawful ship ended under a crown's letter of marque - the commissioning crown's regard, times her size. */
export const MARQUE_STANDING = Object.freeze({ sink: 2, board: 3 });
/** A legend of the Eltheric Ocean ended: every crown hears of it. */
export const LEGEND_STANDING = 10;
/** A league: three miles, the sea's own measure of a captain's way (metres) - the Eltheric Ocean's own (one home). */
export { LEAGUE_M };
/** The trades a log counts ships by - the Bay's three, and the Eltheric Ocean's two. */
export const LOG_TRADES = Object.freeze(['pirate', 'merchant', 'navy', 'ether', 'legend']);
/** The contracts a log counts by kind (the harbour board's - systems/naval/harbourBoard.js HARBOUR_CONTRACT_KINDS). */
export const LOG_CONTRACTS = HARBOUR_CONTRACT_KINDS;
/** The board's offers taken, remembered (so a taken one is off its board for the rest of its day) - the newest this many. */
export const BOARD_TAKEN_MAX = 64;
/** CAPT-CHARTS: the treasure charts a captain keeps marked at once - and the caches raised, remembered (the newest this
 *  many: AUDIT CAPTAIN'S SEA B8 - the same chart, read again, paid again). */
export const CHARTS_MAX = 8;
export const CHARTS_RAISED_KEEP = 64;
/** CAPT-TRADE: the exchanges a day's dealing is kept for (AUDIT CAPTAIN'S SEA B1: every one dealt with that day). */
export const DEALT_PORTS_MAX = 64;
/** AUDIT CAPTAIN'S SEA L8: a log's leagues kept to this many metres (a save's absurd count read as none past it). */
export const SAILED_MAX_M = 1e10;
/** AUDIT CAPTAIN'S SEA L8: a letter of marque's end kept within this of the captain's clock's whole run (minutes). */
export const MARQUE_UNTIL_MAX = 1e9;
/** The legends a log keeps by name, and its other lists, at most this many. */
export const LOG_LIST_MAX = 32;
/** ETHER-SEA: the Eltheric isles a captain's charts keep (the first charted, kept), and the wild isles' strands
 *  remembered gathered (the newest). */
export const ETHER_CHARTED_MAX = 4096;
export const ETHER_HARVEST_KEEP = 128;
/** ETHER-SEA: a new Eltheric record - nothing charted, ended or gathered, no crossing made. */
export const newEther = () => ({ charted: [], legends: {}, harvested: {}, from: null, crossings: 0, heard: [] });
/** ETHER-CROSSING: a way out as the ledger keeps it - a whole pixel of the world's grid, never one in the Eltheric Ocean's
 *  law (AUDIT CAPTAIN'S SEA X2: a stale Yes kept the sea itself as the way out, and every way home landed back in it) -
 *  else null (the way home then the open Abecean's). */
export const wayOutOf = (at) => (at && Number.isFinite(at.px) && Number.isFinite(at.py) && Math.abs(at.px) < 8192 && Math.abs(at.py) < 8192 && !inEtherLaw(at.px, at.py)
  ? { px: Math.floor(at.px), py: Math.floor(at.py) } : null);

const size = (cls) => Math.max(1, Math.min(4, (cls?.cargo ?? 1) | 0));
/**
 * THE STANDING A DEED IS WORTH with the crown it is charged to: `act` 'sink' | 'board' | 'repel' | 'fire', `cls` her
 * class, `marque` the deed done under a letter against a rival's lawful ship. A pirate's end and a marque's prize are
 * worth her size; piracy is its own; a lawful ship's end with no marque is piracy's. Answers a number (0 for none).
 * @param {'fire'|'sink'|'board'|'repel'} act @param {{ faction?: string, cargo?: number }} cls @param {{ marque?: boolean }} [o]
 */
export function standingFor(act, cls, { marque = false } = {}) {
  if (!cls) return 0;
  if (cls.faction === 'pirate') {
    const k = act === 'sink' ? DEED_STANDING.sunk : act === 'board' ? DEED_STANDING.taken : act === 'repel' ? DEED_STANDING.repelled : 0;
    return k * size(cls);
  }
  if (cls.faction === 'merchant' || cls.faction === 'navy') {
    if (marque) return act === 'sink' ? MARQUE_STANDING.sink * size(cls) : act === 'board' ? MARQUE_STANDING.board * size(cls) : 0;
    return PIRACY_STANDING[act] ?? 0;
  }
  return 0;
}

const crownNames = () => CROWNS.map((c) => c.name);
const whole = (v, max = Number.MAX_SAFE_INTEGER) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
/** A new log: every count none. FIELD BUGS 2026-10-21b VOYAGE-HOLD: `departed` the port a voyage is counted from and the
 *  way logged when she lay there (scenes/harbourOffice.js PORT_VOYAGE_M) - kept with the log, so a load between two ports
 *  (a relog, a reload, a crash) keeps the voyage. */
export function newLog() {
  return {
    sunk: zeros(LOG_TRADES), taken: zeros(LOG_TRADES), repelled: 0, claimed: 0, plunder: 0,
    contracts: zeros(LOG_CONTRACTS), earned: 0, traded: 0, sailed: 0, maps: 0, islands: 0, deepest: 0,
    legends: [], best: null, departed: null,
  };
}
/** VOYAGE-HOLD: a saved departure as the log may keep it - a port's key and a way no further than the log's - else null. */
export const restoreDeparted = (/** @type {any} */ d, /** @type {number} */ sailed) => (d && typeof d.port === 'string' && d.port.length > 0 && d.port.length <= 64
  && Number.isFinite(d.sailed) && d.sailed >= 0 && d.sailed <= sailed ? { port: d.port, sailed: d.sailed } : null);

/**
 * THE LEDGER. `deed(act, cls, { crown, marque, trade, legend })` a ship's fate at the captain's hands - logged by
 * her trade and her crown's regard moved (answers the rank changes `[{ crown, from, to }]`); `regard(crown, n)` a crown's
 * regard moved by anything else; `note(field, n)` a count of the log's; `sailed(m)` the way made at a helm;
 * `standing(crown)`, `rank(crown)`; the marque's three (`marque`, `setMarque`, `tearMarque`); the save's three.
 */
export function createCaptainLedger() {
  let log = newLog();
  /** @type {Record<string, number>} */
  let standing = zeros(crownNames());
  /** @type {{ crown: string, until: number } | null} */
  let marque = null;
  /** CAPT-BOARD: the contracts held (harbourBoard.js takeContract's), and the board's offers taken. */
  let contracts = [];
  let taken = [];
  /** CAPT-TRADE: the day's dealing at each exchange dealt with that day - `{ day, at: { [port]: { bought: { id: n }, sold:
   *  { id: n } } } }` (AUDIT CAPTAIN'S SEA B1: the last exchange's alone was kept - one deal at the next port over and the
   *  first's stock stood whole again the same day). */
  let dealt = null;
  /** CAPT-CHARTS: the treasure charts read and marked, their caches not yet raised (treasureCharts.js chartSite's), and
   *  the caches raised (their ids, the newest CHARTS_RAISED_KEEP). */
  let charts = [];
  let raised = [];
  /** CAPTAIN-TREE (captainTree.js): the stars of the captain's sky held - the Helm first, each joined to it. */
  let tree = ['helm'];
  /** ...and what they do (starStats), kept with them - the seams read it every frame. */
  let stats = starStats(tree);
  /** ETHER-SEA: the captain's Eltheric Ocean - the isles charted (world/ethericSea.js cell keys), the legends ended (the
   *  day each was), the wild isles' strands gathered (the day each was), the Bay's waters the last crossing out set sail
   *  from (the way home's landfall), the crossings made. */
  let ether = newEther();
  let chartedSet = new Set();

  /** A crown's standing - none for a name that is no crown's (AUDIT CAPTAIN'S SEA L8: 'constructor' read the prototype's). */
  const standingOf = (crown) => (typeof crown === 'string' && Object.hasOwn(standing, crown) ? standing[crown] : 0);
  const rankChanges = [];
  /** A crown's regard moved by `n`, kept in its band - the rank it crossed into said back (a promotion or a fall). */
  function regard(crown, n) {
    if (typeof crown !== 'string' || !Object.hasOwn(standing, crown) || !Number.isFinite(n) || n === 0) return null;   // AUDIT CAPTAIN'S SEA L8: never 'constructor'
    const before = crownRankOf(standing[crown]);
    standing[crown] = Math.max(CROWN_STANDING_MIN, Math.min(CROWN_STANDING_MAX, Math.round(standing[crown] + n)));
    const after = crownRankOf(standing[crown]);
    if (after.rank === before.rank) return null;
    const change = { crown, from: before, to: after };
    rankChanges.push(change);
    return change;
  }
  const ledger = {
    get log() { return log; },
    standing: (crown) => standingOf(crown),
    rank: (crown) => crownRankOf(standingOf(crown)),
    /** Every crown's standing and rank, in CROWNS' order. */
    crowns: () => CROWNS.map((c) => ({ crown: c.name, ruler: c.ruler, standing: standing[c.name] ?? 0, rank: crownRankOf(standing[c.name] ?? 0), next: nextRankOf(standing[c.name] ?? 0) })),
    regard,
    /**
     * A SHIP'S FATE AT THE CAPTAIN'S HANDS: logged by her trade ('ether'/'legend' for the Eltheric Ocean's - `legend` her
     * name, kept), and her crown's regard moved - `crown` the crown the deed is charged to (the waters', a navy's own),
     * `marque` under a letter against a rival (the regard the letter's crown's).
     * @param {'fire'|'sink'|'board'|'repel'} act @param {any} cls
     * @param {{ crown?: string|null, marque?: string|null, trade?: string|null, legend?: string|null }} [o]
     */
    deed(act, cls, { crown = null, marque: under = null, trade = null, legend = null } = {}) {
      const changes = [];
      const kind = trade ?? cls?.faction ?? null;
      if (act === 'sink' && kind && kind in log.sunk) log.sunk[kind]++;
      if (act === 'board' && kind && kind in log.taken) log.taken[kind]++;
      if (act === 'repel') log.repelled++;
      if (legend && (act === 'sink' || act === 'board') && !log.legends.includes(legend)) {
        log.legends.push(legend);
        if (log.legends.length > LOG_LIST_MAX) log.legends.shift();
        for (const c of crownNames()) { const ch = regard(c, LEGEND_STANDING); if (ch) changes.push(ch); }
        return changes;
      }
      if (trade === 'ether') return changes;   // the Eltheric Ocean knows no crown
      const n = standingFor(act, cls, { marque: !!under });
      const to = under ?? crown;
      if (to && n) { const ch = regard(to, n); if (ch) changes.push(ch); }
      return changes;
    },
    /** A count of the log's moved: `repelled`, `claimed`, `plunder` (gold worth), `earned` (a contract's purse), `traded`
     *  (the exchange's gold), `maps`, `islands`; a contract's kind under `contracts`. */
    note(field, n = 1) {
      if (!Number.isFinite(n) || n <= 0) return;
      if (LOG_CONTRACTS.includes(field)) { log.contracts[field] += Math.floor(n); return; }
      if (field in log && typeof log[field] === 'number' && field !== 'deepest' && field !== 'sailed') log[field] = whole(log[field] + n);
    },
    /** The way made at a helm (metres). */
    sailed(m) { if (Number.isFinite(m) && m > 0 && m < 1e5) log.sailed += m; },
    /** The deepest an Eltheric voyage has gone (leagues past the Veil - ETHER-SEA, scenes/etherHost.js sight). */
    deepest(d) { if (Number.isFinite(d) && d > log.deepest) log.deepest = Math.floor(d); },
    /** The richest prize: kept while none richer is taken. */
    prize(name, worth) { if (Number.isFinite(worth) && worth > 0 && (!log.best || worth > log.best.worth)) log.best = { name: String(name ?? 'a prize').slice(0, 48), worth: Math.floor(worth) }; },
    /** The rank changes since the last read, read once (the host says them). */
    takeRankChanges: () => rankChanges.splice(0),
    // ── the letter of marque ──
    /** The letter held while `now` (the captain's own clock, minutes) is before its end - `{ crown, until }` - or null. */
    marque: (now) => (marque && Number.isFinite(now) && now < marque.until ? { ...marque } : null),
    setMarque(crown, until) { if (crownNames().includes(crown) && Number.isFinite(until)) marque = { crown, until: Math.floor(until) }; },
    tearMarque() { const was = marque; marque = null; return was; },
    // ── CAPT-BOARD: the contracts ──
    /** The contracts held. */
    contracts: () => contracts.slice(),
    /** The board's offers taken (their ids). */
    taken: () => taken.slice(),
    /** A contract taken on (harbourBoard.js takeContract's) - refused past CONTRACTS_MAX, or one held already. */
    holdContract(c) {
      if (!c || contracts.length >= CONTRACTS_MAX || contracts.some((x) => x.id === c.id)) return false;
      contracts.push(c);
      taken.push(c.id);
      if (taken.length > BOARD_TAKEN_MAX) taken.splice(0, taken.length - BOARD_TAKEN_MAX);
      return true;
    },
    /**
     * WHAT HAPPENED AT SEA, TO THE CONTRACTS HELD (harbourBoard.js advance's events): each one done or failed off the
     * list - done, its crown's regard (its `standing`), its kind's count and its purse in the log; failed,
     * STANDING_FAILED; void (a bounty's quarry gone down by another hand; a cargo for a place that is no port - FIELD
     * BUGS 2026-10-13c PORT-TOWNS), off it and no regard lost - answered `{ done,
     * failed, moved, voided }` (`moved` the ones come further) for the host to pay and say.
     */
    contractEvent(ev) {
      const done = [], failed = [], moved = [], voided = [];
      // AUDIT CAPTAIN'S SEA B7: A DEED IS ONE CONTRACT'S - a ship ended, studied or a cask hauled moves the one it is
      // most the deed of (a bounty's own quarry hers, else the soonest due): three hunts of a crown were all done by the
      // same three kills. A berth and a wreck are every delivery's in that hold.
      const one = ev?.type === 'end' || ev?.type === 'study' || ev?.type === 'haul';
      const own = (c) => (c.kind === 'bounty' && c.id === ev.bounty ? 1 : 0);
      const order = one ? [...contracts].sort((a, b) => own(b) - own(a) || a.until - b.until) : [...contracts];
      for (const c of order) {
        const was = c.done | 0;
        const r = advance(c, ev);
        if (r === 'done') { finish(c, true); done.push(c); } else if (r === 'failed') { finish(c, false); failed.push(c); } else if (r === 'void') { contracts = contracts.filter((x) => x !== c); voided.push(c); } else if ((c.done | 0) !== was) moved.push(c);
        if (one && (r || (c.done | 0) !== was)) break;
      }
      return { done, failed, moved, voided };
    },
    /** Every contract whose term is out at `now` (the captain's clock) failed and off the list. */
    expireContracts(now) {
      const failed = contracts.filter((c) => expired(c, now));
      for (const c of failed) finish(c, false);
      return failed;
    },
    /** A contract given up: off the list, STANDING_ABANDONED with its crown. Answers it, or null. */
    abandonContract(id) {
      const c = contracts.find((x) => x.id === id);
      if (!c) return null;
      contracts = contracts.filter((x) => x !== c);
      regard(c.crown, STANDING_ABANDONED);
      return c;
    },
    // ── CAPT-CHARTS: the charts marked ──
    /** The charts marked. */
    charts: () => charts.slice(),
    /** A chart read, marked - never one twice, never past CHARTS_MAX. */
    markChart(c) {
      if (!c || typeof c.id !== 'string' || charts.some((x) => x.id === c.id) || charts.length >= CHARTS_MAX) return false;
      charts.push({ ...c });
      return true;
    },
    /** A chart's cache raised: off the charts, remembered raised, and the log's `maps`. Answers it, or null. */
    raiseChart(id) {
      const c = charts.find((x) => x.id === id);
      if (!c) return null;
      charts = charts.filter((x) => x !== c);
      raised = [...raised.filter((x) => x !== id), id].slice(-CHARTS_RAISED_KEEP);
      ledger.note('maps');
      return c;
    },
    /** Whether a cache (its site's id) has been raised - its chart, read again, marks nothing. */
    wasRaised: (id) => raised.includes(id),
    // ── CAPT-TRADE: the exchange's dealing ──
    /** The captain's dealing at `port`'s exchange on `day` - `{ bought, sold }`, none on another day. */
    dealtAt(port, day) {
      const at = dealt && dealt.day === day && typeof port === 'string' && Object.hasOwn(dealt.at, port) ? dealt.at[port] : null;
      return at ? { bought: { ...at.bought }, sold: { ...at.sold } } : { bought: {}, sold: {} };
    },
    /** `n` of a good bought from (`side` 'bought') or sold to ('sold') `port`'s exchange on `day` - another day's dealing
     *  let go, every port's of this one kept (the newest DEALT_PORTS_MAX). */
    deal(port, day, id, n, side) {
      if (typeof port !== 'string' || (side !== 'bought' && side !== 'sold')) return;
      if (!(dealt && dealt.day === day)) dealt = { day, at: Object.create(null) };
      if (!Object.hasOwn(dealt.at, port)) {
        const ports = Object.keys(dealt.at);
        if (ports.length >= DEALT_PORTS_MAX) delete dealt.at[ports[0]];
        dealt.at[port] = { bought: {}, sold: {} };
      }
      const at = dealt.at[port];
      at[side][id] = (Object.hasOwn(at[side], id) ? at[side][id] | 0 : 0) + Math.max(0, n | 0);
    },
    // ── ETHER-SEA: the captain's Eltheric Ocean ──
    /** An isle charted (its key): the log's `islands` the first time - never past ETHER_CHARTED_MAX. Answers whether it
     *  was new. */
    chartIsle(key) {
      if (typeof key !== 'string' || chartedSet.has(key) || ether.charted.length >= ETHER_CHARTED_MAX) return false;
      ether.charted.push(key);
      chartedSet.add(key);
      ledger.note('islands');
      return true;
    },
    isCharted: (key) => chartedSet.has(key),
    charted: () => ether.charted.slice(),
    /** AUDIT ETHER-OW C2-2: how many isles are charted - asked each frame by the Overworld's lists' keys (no copy). */
    chartedCount: () => ether.charted.length,
    /** A legend ended on `day`, and the day a legend was last ended (null: never). */
    endLegend(id, day) { if (typeof id === 'string' && Number.isFinite(day)) ether.legends[id] = Math.floor(day); },
    legendDay: (id) => (Number.isFinite(ether.legends[id]) ? ether.legends[id] : null),
    /** A wild isle's strand gathered on `day` (the newest ETHER_HARVEST_KEEP kept), and the day it last was. */
    gathered(key, day) {
      if (typeof key !== 'string' || !Number.isFinite(day)) return;
      delete ether.harvested[key];
      ether.harvested[key] = Math.floor(day);
      const keys = Object.keys(ether.harvested);
      for (let i = 0; i < keys.length - ETHER_HARVEST_KEEP; i++) delete ether.harvested[keys[i]];
    },
    gatheredDay: (key) => (Number.isFinite(ether.harvested[key]) ? ether.harvested[key] : null),
    /** The Bay's waters the last crossing out set sail from `{ px, py }` (the way home makes landfall there), or null. */
    setCrossedFrom(at) { ether.from = wayOutOf(at); },
    crossedFrom: () => (ether.from ? { ...ether.from } : null),
    /** A crossing made (either way); the count. */
    crossed() { ether.crossings = whole(ether.crossings + 1); },
    /** A legend heard of (a harbourmaster's rumour): her haunt on the captain's charts from now. */
    hearLegend(id) { if (typeof id === 'string' && !ether.heard.includes(id) && ether.heard.length < LOG_LIST_MAX) ether.heard.push(id); },
    heard: () => ether.heard.slice(),
    get crossings() { return ether.crossings; },
    // ── CAPTAIN-TREE: the captain's level and sky ──
    /** The captain's reading off the log: `{ xp, level, points, next }` (captainTree.js captainOf). */
    captain: () => captainOf(log),
    /** The stars held, the Helm first. */
    tree: () => tree.slice(),
    /** The sky set (the window's confirm): through the law - the Helm, known stars each joined to it, no more than the
     *  captain's points. Answers the stars held. */
    setTree(ids) { tree = heldStars(ids, captainOf(log).points); stats = starStats(tree); return tree.slice(); },
    /** What the stars held do (captainTree.js CAPTAIN_STATS, each a share) - frozen, the seams' to read. */
    stats: () => stats,
    // ── the save ──
    newSaveData: () => ({ v: CAPTAIN_SAVE_VERSION, log: newLog(), standing: zeros(crownNames()), marque: null, contracts: [], taken: [], dealt: null, charts: [], raised: [], ether: newEther(), tree: ['helm'] }),
    getSaveData: () => ({ v: CAPTAIN_SAVE_VERSION, log: JSON.parse(JSON.stringify(log)), standing: { ...standing }, marque: marque ? { ...marque } : null, contracts: JSON.parse(JSON.stringify(contracts)), taken: taken.slice(), dealt: dealt ? JSON.parse(JSON.stringify(dealt)) : null, charts: JSON.parse(JSON.stringify(charts)), raised: raised.slice(), ether: JSON.parse(JSON.stringify(ether)), tree: tree.slice() }),   // CAPTAIN-TREE: her stars
    restoreSaveData(r) {
      log = newLog();
      standing = zeros(crownNames());
      marque = null;
      contracts = [];
      taken = [];
      dealt = null;
      charts = [];
      raised = [];
      ether = newEther();
      chartedSet = new Set();
      rankChanges.length = 0;
      tree = ['helm'];
      stats = starStats(tree);
      if (!r || typeof r !== 'object') return;
      const l = r.log && typeof r.log === 'object' ? r.log : {};
      for (const k of LOG_TRADES) { log.sunk[k] = whole(l.sunk?.[k]); log.taken[k] = whole(l.taken?.[k]); }
      for (const k of LOG_CONTRACTS) log.contracts[k] = whole(l.contracts?.[k]);
      for (const k of ['repelled', 'claimed', 'plunder', 'earned', 'traded', 'maps', 'islands', 'deepest']) log[k] = whole(l[k]);
      log.sailed = Number.isFinite(l.sailed) && l.sailed > 0 ? Math.min(SAILED_MAX_M, l.sailed) : 0;   // AUDIT CAPTAIN'S SEA L8
      log.legends = Array.isArray(l.legends) ? l.legends.filter((n) => typeof n === 'string').map((n) => n.slice(0, 48)).slice(-LOG_LIST_MAX) : [];
      log.best = l.best && typeof l.best.name === 'string' && Number.isFinite(l.best.worth) ? { name: l.best.name.slice(0, 48), worth: whole(l.best.worth) } : null;
      log.departed = restoreDeparted(l.departed, log.sailed);   // VOYAGE-HOLD
      for (const c of crownNames()) {
        const v = Number(r.standing?.[c]);
        standing[c] = Number.isFinite(v) ? Math.max(CROWN_STANDING_MIN, Math.min(CROWN_STANDING_MAX, Math.round(v))) : 0;
      }
      if (r.marque && crownNames().includes(r.marque.crown) && Number.isFinite(r.marque.until)) marque = { crown: r.marque.crown, until: Math.floor(Math.min(MARQUE_UNTIL_MAX, r.marque.until)) };   // AUDIT CAPTAIN'S SEA L8: bounded
      // AUDIT CAPTAIN'S SEA L8: a contract once (by its id), and charts the same - a save's twins paid twice
      const once = (list) => list.filter((c, i) => list.findIndex((x) => x.id === c.id) === i);
      contracts = once((Array.isArray(r.contracts) ? r.contracts : []).map(restoreContract).filter((c) => c && crownNames().includes(c.crown))).slice(0, CONTRACTS_MAX);
      taken = (Array.isArray(r.taken) ? r.taken : []).filter((id) => typeof id === 'string').slice(-BOARD_TAKEN_MAX);
      const d = r.dealt;
      const counts = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, n]) => Number.isFinite(n) && n > 0).map(([k, n]) => [k, Math.floor(n)]));
      if (d && Number.isFinite(d.day) && d.at && typeof d.at === 'object') {
        dealt = { day: Math.floor(d.day), at: Object.create(null) };
        for (const [port, x] of Object.entries(d.at).slice(-DEALT_PORTS_MAX)) dealt.at[port] = { bought: counts(x?.bought), sold: counts(x?.sold) };
      } else if (d && typeof d.port === 'string' && Number.isFinite(d.day)) dealt = { day: Math.floor(d.day), at: Object.assign(Object.create(null), { [d.port]: { bought: counts(d.bought), sold: counts(d.sold) } }) };   // an older save's one port's
      charts = once((Array.isArray(r.charts) ? r.charts : []).filter((c) => c && typeof c.id === 'string' && Number.isFinite(c.px) && Number.isFinite(c.py) && Number.isFinite(c.seed))
        .map((c) => ({ id: c.id, seed: c.seed >>> 0, px: Math.floor(c.px), py: Math.floor(c.py), near: String(c.near ?? ''), words: String(c.words ?? '') }))).slice(0, CHARTS_MAX);
      raised = [...new Set((Array.isArray(r.raised) ? r.raised : []).filter((id) => typeof id === 'string' && id.length <= 64))].slice(-CHARTS_RAISED_KEEP);
      const e = r.ether && typeof r.ether === 'object' ? r.ether : {};
      const days = (o, keep) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, d]) => typeof k === 'string' && Number.isFinite(d)).map(([k, d]) => [k, Math.floor(d)]).slice(-keep));
      ether.charted = [...new Set((Array.isArray(e.charted) ? e.charted : []).filter((k) => typeof k === 'string' && /^\d{1,4},\d{1,4}$/.test(k)))].slice(0, ETHER_CHARTED_MAX);
      chartedSet = new Set(ether.charted);
      ether.legends = days(e.legends, LOG_LIST_MAX);
      ether.harvested = days(e.harvested, ETHER_HARVEST_KEEP);
      ether.from = wayOutOf(e.from);
      ether.crossings = whole(e.crossings);
      ether.heard = [...new Set((Array.isArray(e.heard) ? e.heard : []).filter((id) => typeof id === 'string' && id.length <= 24))].slice(0, LOG_LIST_MAX);
      tree = heldStars(r.tree, captainOf(log).points);   // CAPTAIN-TREE: her stars as the law and her log allow (an older save's: the Helm)
      stats = starStats(tree);
    },
  };
  /** CAPT-BOARD: a contract ended - off the list; done, its crown's regard, its kind's count and its purse; failed, the
   *  crown's regard lost. */
  function finish(c, ok) {
    contracts = contracts.filter((x) => x !== c);
    if (!ok) { regard(c.crown, STANDING_FAILED); return; }
    regard(c.crown, c.standing);
    ledger.note(c.kind);
    ledger.note('earned', c.pay);
  }
  return ledger;
}

/** Leagues, in words: "12.4 leagues". */
export const leagueWords = (m) => `${(Math.max(0, Number(m) || 0) / LEAGUE_M).toFixed(1)} leagues`;
/**
 * THE LOG IN A CAPTAIN'S WORDS - the Captain page's lines: `[label, value]` pairs, the counts that stand (a count of
 * none is left out but the first three, which say so).
 * @param {ReturnType<typeof newLog>} log
 */
export function logLines(log) {
  const sum = (o) => Object.values(o ?? {}).reduce((s, v) => s + (v | 0), 0);
  const gold = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;
  const byTrade = (o) => LOG_TRADES.filter((k) => o[k]).map((k) => `${o[k]} ${(o[k] === 1 ? TRADE_WORD : TRADE_WORDS)[k]}`).join(', ');   // AUDIT CAPTAIN'S SEA L11: "1 pirate"
  const lines = [
    ['Ships sunk', sum(log.sunk) ? `${sum(log.sunk)} - ${byTrade(log.sunk)}` : 'none'],
    ['Ships taken', sum(log.taken) ? `${sum(log.taken)} - ${byTrade(log.taken)}` : 'none'],
    ['Leagues sailed', leagueWords(log.sailed)],
  ];
  if (log.repelled) lines.push(['Boarders thrown back', `${log.repelled}`]);
  if (log.claimed) lines.push(['Prizes claimed', `${log.claimed}`]);
  if (log.plunder) lines.push(['Plunder hauled', gold(log.plunder)]);
  if (log.best) lines.push(['Richest prize', `${log.best.name} (${gold(log.best.worth)})`]);
  const done = sum(log.contracts);
  if (done) lines.push(['Contracts done', `${done} - ${LOG_CONTRACTS.filter((k) => log.contracts[k]).map((k) => `${log.contracts[k]} ${(log.contracts[k] === 1 ? CONTRACT_WORD : CONTRACT_WORDS)[k]}`).join(', ')}`]);
  if (log.earned) lines.push(['Contract purses', gold(log.earned)]);
  if (log.traded) lines.push(['Sold at the exchange', gold(log.traded)]);
  if (log.maps) lines.push(['Treasure found', `${log.maps} ${log.maps === 1 ? 'cache' : 'caches'}`]);
  if (log.islands) lines.push([`${ETHER_WORD} isles charted`, `${log.islands}`]);
  if (log.deepest) lines.push([`Deepest ${ETHER_WORD} waters`, `${log.deepest} ${log.deepest === 1 ? 'league' : 'leagues'} past the Veil`]);
  if (log.legends.length) lines.push(['Legends ended', log.legends.join(', ')]);
  return lines;
}
/** The trades' words in the log - one, and many. */
export const TRADE_WORD = Object.freeze({ pirate: 'pirate', merchant: 'merchantman', navy: 'crown\'s ship', ether: `${ETHER_WORD} ship`, legend: 'legend' });
export const TRADE_WORDS = Object.freeze({ pirate: 'pirates', merchant: 'merchantmen', navy: 'crown\'s ships', ether: `${ETHER_WORD} ships`, legend: 'legends' });
/** The contracts' kinds in the log - one, and many (AUDIT CAPTAIN'S SEA L11: "2 bounty"). */
export const CONTRACT_WORD = Object.freeze({ bounty: 'bounty', hunt: 'hunt', delivery: 'delivery', salvage: 'salvage', survey: 'survey' });
export const CONTRACT_WORDS = Object.freeze({ bounty: 'bounties', hunt: 'hunts', delivery: 'deliveries', salvage: 'salvages', survey: 'surveys' });
