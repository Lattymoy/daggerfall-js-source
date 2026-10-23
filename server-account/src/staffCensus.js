// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL4-CENSUS (2026-10-22, mob picked it, 04:13Z; design doc "DFO Staff Panel: design", "Item and gold census",
// "Built on the save judge", "Server load" and the weak spots "Copies found misses modded dupes..." and "Census rows ride
// every save...") - THE ITEM AND GOLD CENSUS, AND THE CONTESTED PIECES. Admin only (mob, 03:03Z: a Moderator gets the chat
// reports, Mute and Ban, and the few things named for them - not this).
//
// ═══ THE TALLY RIDES THE JUDGE, NEVER A SAVE OF ITS OWN ═════════════
//
// Every online character's checkpoint is already read by the judge (verdict.js verdictOn). The census takes its tally
// there - gold (purse and banks) and how many of each item template the character holds (judge.js possessedItemLists:
// the pack, the wagon, the bag, home chests, boats, companions) - and the design's load plan, not the first idea (one
// row per item kind per checkpoint was some 17 times today's checkpoint writes):
//   - ONE BOUNDED COLUMN on the hourly wealth row the checkpoint already writes (realm_wealth_hours.tally), set only
//     when the tally changed - no row of its own, no statement of its own;
//   - ONE LATEST-TALLY ROW per character (item_census), in the checkpoint's own batch and only when the tally changed,
//     never swept, so an idle character still counts; the ones made before it are filled once, off peak, by
//     censusBackfill (behind CENSUS_BACKFILL);
//   - server totals ON DEMAND: a census read sums the latest tallies (cached CENSUS_CACHE_S, never auto-refreshed), and
//     the daily trend is summed once a day off peak (censusDay, item_census_days).
// A CENSUS FAILURE NEVER FAILS OR SLOWS A CHECKPOINT: censusStep catches every throw and answers no census at all; the
// tally walks at most CENSUS_ITEMS_MAX pieces once; its writes carry no CHECK; and its one read rides the row read the
// checkpoint already makes (realm.js checkpointRealm `census_tally`).
//
// What it measures is what the games claim (design doc, "Limits no fix removes"): a save's own word, as last saved by
// the player's game. A character a service move changed while offline (a sale, a vault) counts as its last checkpoint.
//
// ═══ CONTESTED PIECES (the weak spot: "Copies found ... can blame an innocent player") ═══
//
// The ledger cannot tell a copier from someone who took the piece first (ledger.js THE FIRST HOLDER KEEPS IT), so a copy
// found is a CONTESTED PIECE: which piece (its print), the first holder and the claimant with their times, how it was
// found - and whether a staff member has checked its trail. A Remove of a contested piece needs that check (trail_at);
// the Remove itself is the realm builder's. Copies and census jumps are how dupes are hunted; neither proves one.
//
// EVERY LIST PAGES (mob, 19:25Z: "put inf scroll in anything that pull lists"): `from`, answered as `next`.
// ═══════════════════════════════════════════════════════════════════

import { displayName } from './accounts.js';
import { possessedItemLists, goldOf } from './judge.js';
import { realmSaveTextOf, REALM_ID_RE } from './realm.js';
import { lawTemplate, itemWorth, ITEM_UID_RE } from '../../src/systems/item/itemLaw.js';
import { MINED_KEYS, minedMaterial, PLANT_GROUP_TEMPLATES } from '../../src/net/professionLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { kept as keptAnswer } from './staffEconomy.js';   // Home's watch kept as the economy's own is

/** The most item kinds one tally keeps - the dearest by worth, when a save holds more (`more` says how many were left). */
export const CENSUS_KINDS_MAX = 100;
/** The most pieces one tally walks: a save past it is counted that far (a census never slows a checkpoint). */
export const CENSUS_ITEMS_MAX = 20_000;
/** A census read is kept this long in the isolate (design doc, Server load: "cache them for 5-10 minutes"). */
export const CENSUS_CACHE_S = 10 * 60;
/** The holders one census read ranks, and how many a page answers. */
export const CENSUS_RANK_MAX = 500;
export const CENSUS_PAGE = 25;
/** The days of trend a read answers by default, and at most. */
export const CENSUS_TREND_DAYS = 30;
export const CENSUS_TREND_DAYS_MAX = 90;
/** How long a day's totals are kept. */
export const CENSUS_DAYS_KEEP = 180;
/** A census jump's window in hours: by default, and at most; and the most characters it names. */
export const CENSUS_JUMP_HOURS = 24;
export const CENSUS_JUMP_HOURS_MAX = 72;
export const CENSUS_JUMPS_MAX = 50;
/** THE QUIET HOURS (UTC) the census's own jobs run in - the evening peak is 14:00-00:00 UTC (bible/11-Multiplayer/
 *  Scale-Arc.md, PRIMARY-TRIPS). A guess at the quietest: nobody has measured the night. The day's totals at the first. */
export const CENSUS_QUIET_HOURS = Object.freeze([7, 8, 9, 10]);
export const CENSUS_DAY_HOUR = CENSUS_QUIET_HOURS[0];
/** The backfill's page of characters, and the most it fills in one firing (each one an R2 read and a parse). */
export const CENSUS_BACKFILL_PAGE = 40;
export const CENSUS_BACKFILL_MAX = 400;
/** Contested pieces one page answers; a character holding this many unchecked is the most urgent. */
export const CONTESTED_PAGE = 25;
export const CONTESTED_HIGH = 3;
/** How long Home keeps the contested watch's answer ("a few minutes", as the economy's watch keeps its own). */
export const CONTESTED_HOME_KEEP_S = 5 * 60;
/** What a trail check may find, and its note's bound. */
export const TRAIL_FOUND = Object.freeze(['copier', 'innocent', 'unclear']);
export const TRAIL_NOTE_MAX = 500;
/** Template indices a name search walks (the port's own reach to 2001 - itemLaw.js lawTemplate). */
const TEMPLATE_SCAN = 4096;

export const CENSUS_ROUTES = Object.freeze(['/v1/staff/census/find', '/v1/staff/census', '/v1/staff/census/jumps',
  '/v1/staff/contested', '/v1/staff/contested/piece', '/v1/staff/contested/trail']);

// ═══ THE TALLY ═══════════════════════════════════════════════════════

/**
 * ONE CHARACTER'S TALLY, pure: `{"g": gold, "t<index>": count, ...}` - gold the purse and the banks (judge.js goldOf,
 * never a loan taken off), each template's pieces counted by their units, in index order so an unchanged save says the
 * same text. At most CENSUS_KINDS_MAX kinds (the dearest; `more` the kinds left out). Null for no save.
 * @param {any} save @returns {string | null}
 */
export function censusTally(save) {
  if (!save || typeof save !== 'object' || Array.isArray(save)) return null;
  /** The pieces walked, CENSUS_ITEMS_MAX at most, each once: `fn(templateIndex, piece)`. */
  const walk = (/** @type {(t: number, it: any) => void} */ fn) => {
    let walked = 0;
    for (const list of possessedItemLists(save)) {
      for (const it of list) {
        if (++walked > CENSUS_ITEMS_MAX) return;
        const t = it?.templateIndex;
        if (Number.isSafeInteger(t) && t >= 0) fn(t, it);
      }
    }
  };
  /** @type {Map<number, number>} */
  const kinds = new Map();
  walk((t, it) => kinds.set(t, Math.min(Number.MAX_SAFE_INTEGER, (kinds.get(t) ?? 0) + (Number.isSafeInteger(it.stackCount) && it.stackCount > 1 ? it.stackCount : 1))));
  let keep = [...kinds.keys()];
  if (keep.length > CENSUS_KINDS_MAX) {
    // too many kinds: the dearest kept - a second walk, only for a save this wide
    /** @type {Map<number, number>} */
    const worth = new Map();
    walk((t, it) => worth.set(t, (worth.get(t) ?? 0) + (Number(itemWorth(it)) || 0)));
    keep = keep.sort((a, b) => (worth.get(b) ?? 0) - (worth.get(a) ?? 0) || a - b).slice(0, CENSUS_KINDS_MAX);
  }
  let gold = goldOf(save.goldPieces);
  for (const a of Array.isArray(save.bankAccounts) ? save.bankAccounts : []) gold += goldOf(a?.accountGold);
  /** @type {Record<string, number>} */
  const out = { g: Math.min(Number.MAX_SAFE_INTEGER, gold) };
  for (const t of keep.sort((a, b) => a - b)) out[`t${t}`] = /** @type {number} */ (kinds.get(t));
  if (kinds.size > keep.length) out.more = kinds.size - keep.length;
  return JSON.stringify(out);
}

/** The tally the census takes - one seam, so a pin can force the census to fail and see the checkpoint land. */
export const censusHooks = { tallyOf: censusTally };

/**
 * THE CENSUS'S STEP in a checkpoint's batch (verdict.js verdictOn): the character's latest tally written - only when it
 * changed from `was` (the one item_census holds, read with the record's row) - and the tally for the hour's row (null:
 * unchanged, the row keeps its own). NEVER THROWS: any failure is no census this checkpoint, and the save lands as ever.
 * @param {any} db @param {{ player: string, char: string, seq: number, nowS: number }} at @param {any} save @param {unknown} was
 * @returns {{ steps: any[], tally: string | null }}
 */
export function censusStep(db, { player, char, seq, nowS }, save, was) {
  try {
    const tally = censusHooks.tallyOf(save);
    if (tally == null || tally === was) return { steps: [], tally: null };
    return {
      steps: [db.prepare('INSERT INTO item_census (char_id, player, tally, seq, at) VALUES (?1, ?2, ?3, ?4, ?5)'
        + ' ON CONFLICT (char_id) DO UPDATE SET player = excluded.player, tally = excluded.tally, seq = excluded.seq, at = excluded.at').bind(char, player, tally, seq, nowS)],
      tally,
    };
  } catch (e) {
    console.warn('[census] the tally failed - the checkpoint lands without it', /** @type {any} */ (e)?.message ?? e);
    return { steps: [], tally: null };
  }
}

// ═══ KINDS: what staff type ═══════════════════════════════════════════

/** A kind as the routes take it - 'gold', 'marks', or an item template ('t113', or 113) - or null. */
export function kindOf(/** @type {unknown} */ v) {
  if (v === 'gold' || v === 'marks') return v;
  const t = typeof v === 'number' ? v : typeof v === 'string' && /^t?\d{1,4}$/.test(v) ? Number(v.replace(/^t/, '')) : NaN;
  return Number.isSafeInteger(t) && t >= 0 && t < TEMPLATE_SCAN && lawTemplate(t) ? `t${t}` : null;
}
const templateOfKind = (/** @type {string} */ kind) => (kind.startsWith('t') ? Number(kind.slice(1)) : null);
/** A kind's name as the panel shows it. */
export const kindName = (/** @type {string} */ kind) => (kind === 'gold' ? 'Gold' : kind === 'marks' ? 'Marks (silver)'
  : String(lawTemplate(templateOfKind(kind))?.name ?? kind));
/** The tally's JSON path for a kind ('g' is gold). */
const pathOf = (/** @type {string} */ kind) => (kind === 'gold' ? '$.g' : `$.${kind}`);

/** @type {{ t: number, name: string }[] | null} every template the law knows, by name - walked once an isolate */
let named = null;
/** THE KINDS A SEARCH NAMES: gold and Marks by their words, a template by its index or a piece of its name. At most 20. */
export function findKinds(/** @type {unknown} */ q) {
  const s = typeof q === 'string' ? q.trim().toLowerCase().slice(0, 60) : '';
  if (!s) return [];
  /** @type {{ kind: string, name: string }[]} */
  const out = [];
  if ('gold'.includes(s)) out.push({ kind: 'gold', name: kindName('gold') });
  if (['marks', 'silver', 'drakes'].some((w) => w.includes(s))) out.push({ kind: 'marks', name: kindName('marks') });
  const exact = kindOf(s);
  if (exact) out.push({ kind: exact, name: kindName(exact) });
  named ??= Array.from({ length: TEMPLATE_SCAN }, (_, t) => ({ t, name: String(lawTemplate(t)?.name ?? '') })).filter((x) => x.name);
  for (const x of named) {
    if (out.length >= 20) break;
    if (x.name.toLowerCase().includes(s) && !out.some((o) => o.kind === `t${x.t}`)) out.push({ kind: `t${x.t}`, name: x.name });
  }
  return out;
}

/** The Stores' keys that are a template's pieces (professionLaw.js: a mined or made material's row, an herb's group and
 *  template) - none for a template the Stores never hold. */
export function storeKeysOf(/** @type {number} */ t) {
  const keys = MINED_KEYS.filter((k) => minedMaterial(k)?.templateIndex === t);
  for (const g of /** @type {const} */ (['p1', 'p2'])) if (PLANT_GROUP_TEMPLATES[g].includes(t)) keys.push(`${g}:${t}`);
  return keys;
}
/** The template a Stores key is the pieces of, or null (a food, a siege work). */
export function storeTemplateOf(/** @type {string} */ key) {
  const herb = /^(p1|p2):(\d{1,4})$/.exec(key);
  if (herb) return Number(herb[2]);
  const t = minedMaterial(key)?.templateIndex;
  return Number.isSafeInteger(t) ? /** @type {number} */ (t) : null;
}

// ═══ THE READS ═══════════════════════════════════════════════════════

/** @type {Map<string, { at: number, data: any }>} the census reads this isolate kept */
const kept = new Map();
/** Tests stand fresh isolates. */
export const _forgetCensusForTests = () => { kept.clear(); named = null; };
async function keptRead(/** @type {string} */ key, /** @type {number} */ nowS, /** @type {() => Promise<any>} */ read) {
  const hit = kept.get(key);
  if (hit && nowS - hit.at < CENSUS_CACHE_S) return hit;
  const fresh = { at: nowS, data: await read() };
  if (kept.size >= 64) kept.delete(/** @type {string} */ (kept.keys().next().value));
  kept.set(key, fresh);
  return fresh;
}
const num = (/** @type {any} */ r, k = 'n') => Number(r?.results?.[0]?.[k] ?? 0) || 0;

// ─── WHAT THE SERVICE HOLDS (the market place - in no save, so in no tally: censusNow and censusDay alike) ───
/** A listing's goods are the market's while it stands, and after it closed unsold until its seller takes them back
 *  (market.js settleBackRead); an auction's piece likewise (one sold goes to its winner's deliveries at the close). */
const heldListing = (/** @type {string} */ l = '') => `(${l}state = 'open' OR (${l}state IN ('expired', 'removed') AND ${l}returned = 0))`;
const HELD_AUCTION = "(a.state = 'open' OR (a.state IN ('unsold', 'removed') AND a.returned = 0))";
/** A delivery not yet collected: a crafted piece (its template the craft's record's) or a pack's piece (its own record). */
const DELIVERY_T = "COALESCE(p.template, CAST(json_extract(d.item, '$.templateIndex') AS INTEGER))";
const DELIVERY_N = "SUM(CASE WHEN d.item IS NULL THEN 1 ELSE MAX(1, COALESCE(json_extract(d.item, '$.stackCount'), 1)) END)";
const DELIVERIES = 'FROM market_deliveries d LEFT JOIN products p ON p.provenance = d.provenance WHERE d.collected = 0';
/** Marks the market holds: the ledger's escrow end, what went in less what came out - open orders' and standing bids'
 *  alike (marks.js marksReport's measure, the economy screen's, on 0153's covering index). */
const MARKS_ESCROW = `SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount ELSE 0 END), 0) AS n
  FROM marks_ledger WHERE dst_kind = 'escrow' OR src_kind = 'escrow'`;

/**
 * ONE KIND'S CENSUS, server wide, as it stands: the holders ranked (CENSUS_RANK_MAX), how many hold it, and where it sits
 * - carried (the living characters' latest tallies; for Marks, the accounts' balances), in the Stores (a character's and
 * a guild's), in guild vaults (for gold the treasuries' realm gold - the rest is `legacy`, unverified, never counted: the
 * design's weak spot "Guild treasury mixes in unverified gold"; for Marks the guilds' balances), at the market (what the
 * service holds: listings and auctions, deliveries uncollected, materials on the road; for gold what sales hold
 * uncollected, for Marks the ledger's escrow). `stores` null where the kind has none. One round trip.
 * @param {any} db @param {string} kind
 */
async function censusNow(db, kind) {
  const rank = kind === 'marks'
    ? db.prepare(`SELECT NULL AS char_id, m.account AS player, NULL AS name, p.handle, p.guest_name, NULL AS at, m.balance AS n,
        SUM(m.balance) OVER () AS total, COUNT(*) OVER () AS holders FROM marks m JOIN players p ON p.id = m.account
        WHERE m.balance > 0 ORDER BY m.balance DESC, m.account LIMIT ?1`).bind(CENSUS_RANK_MAX)
    : db.prepare(`SELECT c.char_id, c.player, r.name, p.handle, p.guest_name, c.at, CAST(json_extract(c.tally, ?1) AS INTEGER) AS n,
        SUM(CAST(json_extract(c.tally, ?1) AS INTEGER)) OVER () AS total, COUNT(*) OVER () AS holders
        FROM item_census c JOIN realm_characters r ON r.id = c.char_id JOIN players p ON p.id = c.player
        WHERE r.dead_at IS NULL AND CAST(json_extract(c.tally, ?1) AS INTEGER) > 0 ORDER BY n DESC, c.char_id LIMIT ?2`).bind(pathOf(kind), CENSUS_RANK_MAX);
  /** @type {any[]} */
  const places = [];
  /** @type {(rs: any[]) => { stores: number | null, vaults: number, market: number, legacy?: number }} */
  let whereOf;
  if (kind === 'gold') {
    places.push(db.prepare('SELECT COALESCE(SUM(realm_gold), 0) AS n, COALESCE(SUM(MAX(treasury - realm_gold, 0)), 0) AS legacy FROM guilds'),
      db.prepare('SELECT COALESCE(SUM(gold), 0) AS n FROM market_gold'));
    whereOf = ([vaults, market]) => ({ stores: null, vaults: num(vaults), market: num(market), legacy: num(vaults, 'legacy') });
  } else if (kind === 'marks') {
    places.push(db.prepare('SELECT COALESCE(SUM(balance), 0) AS n FROM guild_marks'), db.prepare(MARKS_ESCROW));
    whereOf = ([vaults, market]) => ({ stores: null, vaults: num(vaults), market: num(market) });
  } else {
    const t = /** @type {number} */ (templateOfKind(kind));
    const keys = storeKeysOf(t);
    const m = keys.map((_, i) => `?${i + 1}`).join(', ');
    places.push(
      db.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM guild_vault WHERE json_extract(rec, '$.templateIndex') = ?1").bind(t),
      db.prepare(`SELECT COALESCE(SUM(MAX(1, COALESCE(json_extract(item, '$.stackCount'), 1))), 0) AS n FROM market_listings
        WHERE ${heldListing()} AND kind = 'item' AND json_extract(item, '$.templateIndex') = ?1`).bind(t),
      db.prepare(`SELECT COUNT(*) AS n FROM market_listings l JOIN products p ON p.provenance = l.provenance
        WHERE ${heldListing('l.')} AND l.kind = 'piece' AND p.template = ?1`).bind(t),
      db.prepare(`SELECT COUNT(*) AS n FROM market_auctions a JOIN products p ON p.provenance = a.provenance WHERE ${HELD_AUCTION} AND p.template = ?1`).bind(t),
      db.prepare(`SELECT COALESCE(${DELIVERY_N}, 0) AS n ${DELIVERIES} AND ${DELIVERY_T} = ?1`).bind(t),
    );
    if (keys.length) {
      // shortcut: prof_stores is read by material over no index of its own - Admin only, cached, never auto-refreshed; an
      // index on (material) is the upgrade if the census is read often
      places.push(
        db.prepare(`SELECT COALESCE(SUM(qty), 0) AS n FROM prof_stores WHERE material IN (${m})`).bind(...keys),
        db.prepare(`SELECT COALESCE(SUM(qty), 0) AS n FROM guild_prof_stores WHERE material IN (${m})`).bind(...keys),
        db.prepare(`SELECT COALESCE(SUM(units), 0) AS n FROM market_listings WHERE ${heldListing()} AND kind = 'material' AND material IN (${m})`).bind(...keys),
        db.prepare(`SELECT COALESCE(SUM(units), 0) AS n FROM market_sales WHERE kind = 'material' AND delivered = 0 AND material IN (${m})`).bind(...keys),
      );
    }
    whereOf = ([vault, items, crafted, auctions, deliveries, own, guild, mats, road]) => ({
      stores: keys.length ? num(own) + num(guild) : null, vaults: num(vault),
      market: num(items) + num(crafted) + num(auctions) + num(deliveries) + (keys.length ? num(mats) + num(road) : 0),
    });
  }
  const [ranked, ...rest] = await db.batch([rank, ...places]);
  const rows = ranked?.results ?? [];
  const holders = rows.map((/** @type {any} */ r) => ({
    char: r.char_id ?? null, name: r.name ?? null, player: r.player, handle: displayName(r), n: Number(r.n), at: r.at ?? null,
  }));
  return { carried: Number(rows[0]?.total ?? 0), holders: Number(rows[0]?.holders ?? 0), ranked: holders, ...whereOf(rest) };
}

/** A kind's daily totals since `fromDay` (item_census_days, its key's range). */
async function trendOf(/** @type {any} */ db, /** @type {string} */ kind, /** @type {number} */ fromDay) {
  const r = await db.prepare('SELECT day, carried, stores, vaults, market, holders FROM item_census_days WHERE kind = ?1 AND day >= ?2 ORDER BY day').bind(kind, fromDay).all();
  return (r?.results ?? []).map((/** @type {any} */ d) => ({
    day: d.day, carried: d.carried, stores: d.stores, vaults: d.vaults, market: d.market, holders: d.holders,
    total: Number(d.carried) + Number(d.stores ?? 0) + Number(d.vaults ?? 0) + Number(d.market ?? 0),
  }));
}

/**
 * CENSUS JUMPS (the weak spot's "hunt dupes through ... census jumps"): the characters whose count of `kind` rose most in
 * the last `hours` - from the hourly rows' tallies (realm_wealth_hours, its hour index; each character's count before the
 * window, or its first in it, read by its own key). A hint, never proof: a find, a craft or a trade rises too. The `+` on
 * GROUP BY keeps the hour index: grouped on the bare column, the planner walks the whole table in key order to skip a sort.
 * @param {any} db @param {string} kind @param {number} nowS @param {number} hours
 */
async function jumpsOf(db, kind, nowS, hours) {
  const from = Math.floor(nowS / 3600) * 3600 - (hours - 1) * 3600;
  const n = (/** @type {string} */ a) => `CAST(COALESCE(json_extract(${a}.tally, ?1), 0) AS INTEGER)`;
  const r = await db.prepare(`SELECT w.char_id, w.player, r.name, p.handle, p.guest_name, MAX(w.n) AS high,
      COALESCE((SELECT ${n('x')} FROM realm_wealth_hours x WHERE x.char_id = w.char_id AND x.hour < ?2 AND x.tally IS NOT NULL ORDER BY x.hour DESC LIMIT 1),
        (SELECT ${n('f')} FROM realm_wealth_hours f WHERE f.char_id = w.char_id AND f.hour >= ?2 AND f.tally IS NOT NULL ORDER BY f.hour LIMIT 1)) AS base
    FROM (SELECT h.char_id, h.player, ${n('h')} AS n FROM realm_wealth_hours h WHERE h.hour >= ?2 AND h.tally IS NOT NULL) w
    JOIN realm_characters r ON r.id = w.char_id JOIN players p ON p.id = w.player
    GROUP BY +w.char_id HAVING high - base > 0 ORDER BY high - base DESC, w.char_id LIMIT ?3`).bind(pathOf(kind), from, CENSUS_JUMPS_MAX).all();
  return (r?.results ?? []).map((/** @type {any} */ x) => ({
    char: x.char_id, name: x.name, player: x.player, handle: displayName(x), from: Number(x.base), to: Number(x.high), rise: Number(x.high) - Number(x.base),
  }));
}

// ═══ CONTESTED PIECES ════════════════════════════════════════════════

/** What a piece is, off its print (judge.js ledgerPrintOf: `template:material`). */
const pieceOf = (/** @type {unknown} */ fp) => {
  const [t, m] = String(fp ?? '').split(':').map((x) => (/^\d+$/.test(x) ? Number(x) : null));
  return { t: t ?? null, m: m ?? null, name: t == null ? null : lawTemplate(t)?.name ?? null };
};
/** A record named on a contested piece's row: its id, character name, account and the account's name. */
const recordOf = (/** @type {any} */ d, /** @type {string} */ p, /** @type {unknown} */ id, /** @type {unknown} */ at) => (id || at != null
  ? { char: id || null, name: d[`${p}_name`] ?? null, player: d[`${p}_player`] ?? null, handle: d[`${p}_player`] ? displayName({ handle: d[`${p}_handle`], guest_name: d[`${p}_guest`] }) : null, at: at ?? null }
  : null);

/** A listed row: a death's dropped piece (`drop`) is the ledger's own bookkeeping, never listed - and in none of the
 *  list's indexes (0154 item_dupes_at, item_dupes_open, item_dupes_open_at), so no read here walks the drops. */
const LISTED = "(d.kind IS NULL OR d.kind != 'drop')";
/** Unchecked contested pieces on the copy holder's character - the count that makes a row high (item_dupes_open). */
const OPEN_SQL = "(SELECT COUNT(*) FROM item_dupes x WHERE x.char_id = d.char_id AND x.trail_at IS NULL AND (x.kind IS NULL OR x.kind != 'drop'))";
/** The characters holding CONTESTED_HIGH or more unchecked - one walk of item_dupes_open, covered. */
const HIGH_CHARS = `SELECT x.char_id FROM item_dupes x WHERE x.trail_at IS NULL AND (x.kind IS NULL OR x.kind != 'drop') GROUP BY x.char_id HAVING COUNT(*) >= ${CONTESTED_HIGH}`;
const contestedSelect = () => `SELECT d.uid, d.char_id, d.at, d.first_char, d.first_at, d.claimant, d.claim_at, d.fp, d.kind,
    d.trail_at, d.trail_by, d.trail_found, d.trail_note, ${OPEN_SQL} AS open_n,
    c.name AS c_name, c.player AS c_player, pc.handle AS c_handle, pc.guest_name AS c_guest,
    f.name AS f_name, f.player AS f_player, pf.handle AS f_handle, pf.guest_name AS f_guest,
    m.name AS m_name, m.player AS m_player, pm.handle AS m_handle, pm.guest_name AS m_guest,
    tb.handle AS t_handle, tb.guest_name AS t_guest, u.state AS u_state, u.char_id AS u_char
  FROM item_dupes d
  LEFT JOIN realm_characters c ON c.id = d.char_id LEFT JOIN players pc ON pc.id = c.player
  LEFT JOIN realm_characters f ON f.id = d.first_char LEFT JOIN players pf ON pf.id = f.player
  LEFT JOIN realm_characters m ON m.id = d.claimant LEFT JOIN players pm ON pm.id = m.player
  LEFT JOIN players tb ON tb.id = d.trail_by LEFT JOIN item_uids u ON u.uid = d.uid`;

/** A contested piece's row as the panel reads it, with its level and the words that say why. @param {any} d */
function contestedOf(d) {
  const open = Number(d.open_n) || 0;
  const level = d.trail_at != null ? 'low' : open >= CONTESTED_HIGH ? 'high' : 'medium';
  const why = d.trail_at != null ? [`trail checked: ${d.trail_found}`] : ['no trail check', ...(open > 1 ? [`${open} contested pieces on this character`] : [])];
  return {
    uid: d.uid, item: pieceOf(d.fp), kind: d.kind ?? null, foundAt: d.at, level, why,
    copy: recordOf(d, 'c', d.char_id, null),
    first: recordOf(d, 'f', d.first_char, d.first_at),
    claimant: recordOf(d, 'm', d.claimant, d.claim_at),
    trail: d.trail_at == null ? null : { at: d.trail_at, by: d.trail_by, byName: displayName({ handle: d.t_handle, guest_name: d.t_guest }), found: d.trail_found, note: d.trail_note },
    now: d.u_state ? { state: d.u_state, char: d.u_char || null } : null,
  };
}

/**
 * THE CONTESTED PIECES, a page: most urgent first (unchecked before checked, a character holding CONTESTED_HIGH or more
 * unchecked first among those, then newest) or newest first. `char` one character's; `open` only those with no trail
 * check yet. A KEYSET, never an offset: `before` is the last row's place (its tier, time, piece and character) and `next`
 * this page's - so a trail check landing between pages moves a row behind the place (seen again, checked), never the
 * place past rows not yet seen. Each tier is its own walk, newest first on an index (a row's open count read for the
 * rows walked alone), one round trip. shortcut: a piece found while the list is open - and a character it lifts to
 * high - is in the next load, not this scroll.
 * @param {any} db @param {{ sort?: string, before?: { tier: number, at: number, uid: string, char: string } | null, char?: string | null, open?: boolean, page?: number }} o
 */
export async function contestedPage(db, { sort = 'urgent', before = null, char = null, open = false, page = CONTESTED_PAGE }) {
  const tiers = sort === 'newest' ? [open ? 'd.trail_at IS NULL' : null]
    : [`d.trail_at IS NULL AND d.char_id IN (${HIGH_CHARS})`, `d.trail_at IS NULL AND ${OPEN_SQL} < ${CONTESTED_HIGH}`, ...(open ? [] : ['d.trail_at IS NOT NULL'])];
  const first = before ? before.tier : 0;
  const reads = [];
  for (let tier = first; tier < tiers.length; tier++) {
    const where = [LISTED, ...(tiers[tier] ? [tiers[tier]] : [])];
    const args = [];
    if (char) { where.push('d.char_id = ?'); args.push(char); }
    if (before && tier === first) { where.push('(d.at, d.uid, d.char_id) < (?, ?, ?)'); args.push(before.at, before.uid, before.char); }
    reads.push(db.prepare(`${contestedSelect()} WHERE ${where.join(' AND ')} ORDER BY d.at DESC, d.uid DESC, d.char_id DESC LIMIT ?`).bind(...args, page + 1));
  }
  const got = reads.length ? await db.batch(reads) : [];
  const rows = got.flatMap((/** @type {any} */ r, /** @type {number} */ i) => (r?.results ?? []).map((/** @type {any} */ d) => ({ ...d, tier: first + i })));
  const last = rows.length > page ? rows[page - 1] : null;
  return { pieces: rows.slice(0, page).map(contestedOf), next: last ? `${last.tier}|${last.at}|${last.uid}|${last.char_id}` : null };
}
/** A page's place as the panel hands it back (`tier|at|uid|char`), or null. */
const placeOf = (/** @type {unknown} */ v) => {
  const m = typeof v === 'string' ? /^([0-2])\|(\d{1,12})\|([\w-]{1,64})\|([\w-]{1,64})$/.exec(v) : null;
  return m ? { tier: Number(m[1]), at: Number(m[2]), uid: m[3], char: m[4] } : null;
};

/**
 * ONE PIECE'S TRAIL, for the check a Remove needs: every copy of it written down, where the ledger has it now (and who
 * claims it), the craft's own record (a crafted piece: its maker and its owner now), and the copy findings of every
 * record named that name it.
 * @param {any} db @param {string} uid
 */
async function pieceTrail(db, uid) {
  const [copies, ledger, craft] = await db.batch([
    db.prepare(`${contestedSelect()} WHERE d.uid = ?1 ORDER BY d.at`).bind(uid),
    db.prepare(`SELECT u.uid, u.char_id, u.state, u.fp, u.claim_char, u.claim_at, u.at, r.name, r.player, p.handle, p.guest_name, cr.name AS claim_name
      FROM item_uids u LEFT JOIN realm_characters r ON r.id = u.char_id LEFT JOIN players p ON p.id = r.player
      LEFT JOIN realm_characters cr ON cr.id = u.claim_char WHERE u.uid = ?1`).bind(uid),
    db.prepare(`SELECT pr.owner, pr.char_id, pr.maker, pr.template, pr.material, pr.quality, pr.made_at, pr.bought_with, p.handle, p.guest_name
      FROM products pr LEFT JOIN players p ON p.id = pr.owner WHERE pr.provenance = ?1`).bind(uid),
  ]);
  const rows = copies?.results ?? [];
  const l = ledger?.results?.[0] ?? null;
  const c = craft?.results?.[0] ?? null;
  const named = [...new Set([...rows.flatMap((d) => [d.char_id, d.first_char, d.claimant]), l?.char_id, l?.claim_char].filter((x) => typeof x === 'string' && REALM_ID_RE.test(x)))].slice(0, 20);
  /** @type {any[]} */
  let findings = [];
  if (named.length) {
    const f = await db.prepare(`SELECT char_id, at, detail FROM realm_findings WHERE char_id IN (${named.map((_, i) => `?${i + 1}`).join(', ')}) AND kind = 'dupe'
      ORDER BY at DESC LIMIT 200`).bind(...named).all();
    findings = (f?.results ?? []).flatMap((/** @type {any} */ x) => {
      let d = null;
      try { d = JSON.parse(x.detail); } catch { d = null; }
      return Array.isArray(d?.keys) && d.keys.includes(uid) ? [{ char: x.char_id, at: x.at, contested: d.contested === true, count: d.count ?? null }] : [];
    });
  }
  return {
    uid, item: pieceOf(rows[0]?.fp ?? l?.fp), copies: rows.map(contestedOf), findings,
    ledger: l ? { state: l.state, char: l.char_id || null, name: l.name ?? null, player: l.player ?? null, handle: l.player ? displayName(l) : null, at: l.at,
      claim: l.claim_char ? { char: l.claim_char, name: l.claim_name ?? null, at: l.claim_at } : null } : null,
    craft: c ? { owner: c.owner, handle: displayName(c), char: c.char_id, maker: c.maker, t: c.template, m: c.material, quality: c.quality, madeAt: c.made_at, boughtWith: c.bought_with } : null,
  };
}

// ═══ THE PANEL'S DOORS ═══════════════════════════════════════════════

const offsetOf = (/** @type {unknown} */ v) => (Number.isSafeInteger(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : 0);
const within = (/** @type {unknown} */ v, /** @type {number} */ dflt, /** @type {number} */ max) => (Number.isSafeInteger(v) && /** @type {number} */ (v) >= 1 ? Math.min(/** @type {number} */ (v), max) : dflt);

/**
 * THE CENSUS'S DOORS - Admin only. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffCensus(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  const me = who.player;
  if (who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  }

  if (path === '/v1/staff/census/find') return { kinds: findKinds(body.q) };

  if (path === '/v1/staff/census' || path === '/v1/staff/census/jumps') {
    const kind = kindOf(body.kind);
    if (!kind) return { error: 'body' };
    const from = offsetOf(body.from);
    if (path === '/v1/staff/census/jumps') {
      if (kind === 'marks') return { error: 'census-no-tally' };   // an account's balance, never a save's: marks_ledger is its trail
      const hours = within(body.hours, CENSUS_JUMP_HOURS, CENSUS_JUMP_HOURS_MAX);
      // STAFF-PANEL-SPEED: the audit row with the read, one trip
      const [got] = await Promise.all([keptRead(`jumps:${kind}:${hours}`, nowS, () => jumpsOf(db, kind, nowS, hours)), audit('census-jumps-read', null, { kind, hours }, { onceIn: CENSUS_CACHE_S }).run()]);
      return { kind, name: kindName(kind), hours, at: got.at, jumps: got.data.slice(from, from + CENSUS_PAGE), next: from + CENSUS_PAGE < got.data.length ? from + CENSUS_PAGE : null };
    }
    const days = within(body.days, CENSUS_TREND_DAYS, CENSUS_TREND_DAYS_MAX);
    // STAFF-PANEL-SPEED: the census, its trend and the audit row together - none waits on another's answer
    const [got, trend] = await Promise.all([keptRead(`census:${kind}`, nowS, () => censusNow(db, kind)), trendOf(db, kind, utcDay(nowS) - days + 1),
      audit('census-read', null, { kind }, { onceIn: CENSUS_CACHE_S }).run()]);
    const c = got.data;
    return {
      kind, name: kindName(kind), at: got.at, total: c.carried + (c.stores ?? 0) + c.vaults + c.market,
      where: { carried: c.carried, stores: c.stores, vaults: c.vaults, market: c.market },
      ...(kind === 'gold' ? { legacyGold: c.legacy } : {}),   // guild gold from before the realm: unverified, in no total
      holdersCount: c.holders, holders: c.ranked.slice(from, from + CENSUS_PAGE), next: from + CENSUS_PAGE < c.ranked.length ? from + CENSUS_PAGE : null, trend,
    };
  }

  if (path === '/v1/staff/contested') {
    const char = body.char == null ? null : typeof body.char === 'string' && REALM_ID_RE.test(body.char) ? body.char : undefined;
    if (char === undefined) return { error: 'body' };
    const before = body.before == null ? null : placeOf(body.before);
    if (before === null && body.before != null) return { error: 'body' };
    const sort = body.sort === 'newest' ? 'newest' : 'urgent';
    // STAFF-PANEL-SPEED: the audit row with the page's batch, one trip
    const [page] = await Promise.all([contestedPage(db, { sort, before, char, open: body.open === true }), audit('contested-read', null, { sort, ...(char ? { char } : {}) }, { onceIn: CENSUS_CACHE_S }).run()]);
    return page;
  }

  if (path === '/v1/staff/contested/piece') {
    if (typeof body.uid !== 'string' || !ITEM_UID_RE.test(body.uid)) return { error: 'body' };
    const trail = await pieceTrail(db, body.uid);
    if (!trail.copies.length && !trail.ledger) return { error: 'no-piece' };
    await audit('contested-piece-read', null, { uid: body.uid }, { onceIn: CENSUS_CACHE_S }).run();
    return trail;
  }

  if (path === '/v1/staff/contested/trail') {
    const { uid, char, found } = body;
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (typeof uid !== 'string' || !ITEM_UID_RE.test(uid) || typeof char !== 'string' || !REALM_ID_RE.test(char)
      || !TRAIL_FOUND.includes(/** @type {any} */ (found)) || !note || note.length > TRAIL_NOTE_MAX) return { error: 'body' };
    const row = await db.prepare('SELECT c.player FROM item_dupes d LEFT JOIN realm_characters c ON c.id = d.char_id WHERE d.uid = ?1 AND d.char_id = ?2').bind(uid, char).first();
    const detail = { uid, char, found };
    if (!row) {
      await audit('contested-trail', null, { ...detail, error: 'no-piece' }, { outcome: 'failed' }).run();
      return { error: 'no-piece' };
    }
    const [, r] = await db.batch([
      audit('contested-trail', row.player ?? null, detail, { okIf: { sql: 'EXISTS (SELECT 1 FROM item_dupes WHERE uid = ? AND char_id = ?)', args: [uid, char] } }),
      db.prepare('UPDATE item_dupes SET trail_at = ?3, trail_by = ?4, trail_found = ?5, trail_note = ?6 WHERE uid = ?1 AND char_id = ?2').bind(uid, char, nowS, me.id, found, note),
    ]);
    return r.meta.changes ? { ok: true, uid, char, trail: { at: nowS, by: me.id, byName: displayName(me), found, note } } : { error: 'no-piece' };
  }
  return { error: 'not-found' };
}

/** THE HOME ROLL-UP's watch (status builder's registry): the contested pieces nobody has checked the trail of, most urgent
 *  first - each one line, its account and name - and how many, high and all. Kept CONTESTED_HOME_KEEP_S (staffEconomy.js
 *  kept, as its own watch is): Home opens never read it twice in that time. */
export const HOME_WATCH = Object.freeze({
  id: 'contested', label: 'Contested pieces', role: 'admin',
  /** @param {any} ctx @param {any} env @param {any} who @param {number} n */
  async top(ctx, env, who, n) {
    const got = await keptAnswer(ctx.db, 'contested-home', ctx.nowS, CONTESTED_HOME_KEEP_S, async () => {
      const [page, counts] = await Promise.all([
        contestedPage(ctx.db, { sort: 'urgent', open: true, page: 10 }),
        ctx.db.prepare(`SELECT COALESCE(SUM(n), 0) AS total, COALESCE(SUM(CASE WHEN n >= ${CONTESTED_HIGH} THEN n ELSE 0 END), 0) AS high
          FROM (SELECT COUNT(*) AS n FROM item_dupes WHERE trail_at IS NULL AND (kind IS NULL OR kind != 'drop') GROUP BY char_id)`).first(),
      ]);
      return {
        items: page.pieces.map((p) => ({ level: p.level, why: [p.item.name ?? 'a piece', ...p.why].join(' · '), sub: p.copy?.player ?? null, name: p.copy?.handle ?? null })),
        high: Number(counts?.high ?? 0), total: Number(counts?.total ?? 0),
      };
    });
    return { ...got, items: got.items.slice(0, Math.max(1, Math.min(10, Number(n) || 3))) };
  },
});

// ═══ THE CLOCK'S JOBS (cron.js HOUR_JOBS) - off peak only ═══════════════

const utcHourOf = (/** @type {number} */ nowS) => new Date(nowS * 1000).getUTCHours();

/**
 * THE DAY'S TOTALS, once a UTC day at CENSUS_DAY_HOUR: every kind's count in each place (censusNow's places, summed for
 * all kinds at once - gold's vaults realm gold only, as there), into item_census_days - and the days past CENSUS_DAYS_KEEP
 * swept. Answers the rows written.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function censusDay({ db, nowS }) {
  if (utcHourOf(nowS) !== CENSUS_DAY_HOUR) return 0;
  const day = utcDay(nowS);
  if (await db.prepare("SELECT 1 FROM item_census_days WHERE kind = 'gold' AND day = ?1").bind(day).first()) return 0;
  const [carried, own, guild, vault, mats, road, items, crafted, auctions, deliveries, gold, marks] = await db.batch([
    db.prepare(`SELECT j.key AS k, SUM(CAST(j.value AS INTEGER)) AS n, SUM(CASE WHEN CAST(j.value AS INTEGER) > 0 THEN 1 ELSE 0 END) AS h
      FROM item_census c JOIN realm_characters r ON r.id = c.char_id, json_each(c.tally) j WHERE r.dead_at IS NULL AND j.key != 'more' GROUP BY j.key`),
    db.prepare('SELECT material AS k, SUM(qty) AS n FROM prof_stores GROUP BY material'),
    db.prepare('SELECT material AS k, SUM(qty) AS n FROM guild_prof_stores GROUP BY material'),
    db.prepare("SELECT CAST(json_extract(rec, '$.templateIndex') AS INTEGER) AS t, SUM(count) AS n FROM guild_vault GROUP BY t"),
    db.prepare(`SELECT material AS k, SUM(units) AS n FROM market_listings WHERE ${heldListing()} AND kind = 'material' GROUP BY material`),
    db.prepare("SELECT material AS k, SUM(units) AS n FROM market_sales WHERE kind = 'material' AND delivered = 0 GROUP BY material"),
    db.prepare(`SELECT CAST(json_extract(item, '$.templateIndex') AS INTEGER) AS t, SUM(MAX(1, COALESCE(json_extract(item, '$.stackCount'), 1))) AS n
      FROM market_listings WHERE ${heldListing()} AND kind = 'item' GROUP BY t`),
    db.prepare(`SELECT p.template AS t, COUNT(*) AS n FROM market_listings l JOIN products p ON p.provenance = l.provenance
      WHERE ${heldListing('l.')} AND l.kind = 'piece' GROUP BY p.template`),
    db.prepare(`SELECT p.template AS t, COUNT(*) AS n FROM market_auctions a JOIN products p ON p.provenance = a.provenance WHERE ${HELD_AUCTION} GROUP BY p.template`),
    db.prepare(`SELECT ${DELIVERY_T} AS t, ${DELIVERY_N} AS n ${DELIVERIES} GROUP BY t`),
    db.prepare('SELECT (SELECT COALESCE(SUM(realm_gold), 0) FROM guilds) AS vaults, (SELECT COALESCE(SUM(gold), 0) FROM market_gold) AS market'),
    db.prepare(`SELECT (SELECT COALESCE(SUM(balance), 0) FROM marks) AS carried, (SELECT COUNT(*) FROM marks WHERE balance > 0) AS holders,
      (SELECT COALESCE(SUM(balance), 0) FROM guild_marks) AS vaults, (${MARKS_ESCROW}) AS market`),
  ]);
  /** @type {Map<string, { carried: number, stores: number | null, vaults: number, market: number, holders: number }>} */
  const rows = new Map();
  const at = (/** @type {string} */ k) => {
    let r = rows.get(k);
    if (!r) {
      const t = templateOfKind(k);
      rows.set(k, r = { carried: 0, stores: t != null && storeKeysOf(t).length ? 0 : null, vaults: 0, market: 0, holders: 0 });
    }
    return r;
  };
  const kindAt = (/** @type {unknown} */ t) => (Number.isSafeInteger(t) && /** @type {number} */ (t) >= 0 ? at(`t${t}`) : null);
  for (const x of carried?.results ?? []) {
    const r = x.k === 'g' ? at('gold') : /^t\d+$/.test(x.k) ? at(x.k) : null;
    if (r) { r.carried = Number(x.n) || 0; r.holders = Number(x.h) || 0; }
  }
  for (const x of [...(own?.results ?? []), ...(guild?.results ?? [])]) { const r = kindAt(storeTemplateOf(x.k)); if (r) r.stores = (r.stores ?? 0) + (Number(x.n) || 0); }
  for (const x of vault?.results ?? []) { const r = kindAt(x.t); if (r) r.vaults += Number(x.n) || 0; }
  for (const x of [...(mats?.results ?? []), ...(road?.results ?? [])]) { const r = kindAt(storeTemplateOf(x.k)); if (r) r.market += Number(x.n) || 0; }
  for (const x of [...(items?.results ?? []), ...(crafted?.results ?? []), ...(auctions?.results ?? []), ...(deliveries?.results ?? [])]) { const r = kindAt(x.t); if (r) r.market += Number(x.n) || 0; }
  const g = at('gold');
  g.vaults = Number(gold?.results?.[0]?.vaults ?? 0);
  g.market = Number(gold?.results?.[0]?.market ?? 0);
  const mk = marks?.results?.[0] ?? {};
  rows.set('marks', { carried: Number(mk.carried ?? 0), stores: null, vaults: Number(mk.vaults ?? 0), market: Number(mk.market ?? 0), holders: Number(mk.holders ?? 0) });
  const list = [...rows].map(([k, r]) => [k, r.carried, r.stores, r.vaults, r.market, r.holders]);
  await db.batch([
    db.prepare(`INSERT OR REPLACE INTO item_census_days (kind, day, carried, stores, vaults, market, holders, at)
      SELECT json_extract(j.value, '$[0]'), ?1, json_extract(j.value, '$[1]'), json_extract(j.value, '$[2]'), json_extract(j.value, '$[3]'),
        json_extract(j.value, '$[4]'), json_extract(j.value, '$[5]'), ?2 FROM json_each(?3) j`).bind(day, nowS, JSON.stringify(list)),
    db.prepare('DELETE FROM item_census_days WHERE day < ?1').bind(day - CENSUS_DAYS_KEEP),
  ]);
  return list.length;
}

/**
 * THE BACKFILL, ONCE, OFF PEAK (the weak spot: "the census misses idle characters ... backfilled once off-peak"): every
 * living character with a stored record and no latest tally gets one, from its record in R2 - a page at a time, through
 * the realm's characters in id order, its place kept in realm_config ('census-backfill') and done for good once it
 * reaches the end. Runs only with CENSUS_BACKFILL 'on' and only in CENSUS_QUIET_HOURS. A character that checkpoints
 * meanwhile writes its own (the backfill never writes over one). A record R2 failed to read stops the firing just before
 * its character, so the next firing reads it again; only one R2 has not (or one that will not open) is passed for good.
 * Answers the tallies written.
 * @param {{ db: any, nowS: number, budget?: () => boolean }} ctx @param {any} env
 */
export async function censusBackfill({ db, nowS, budget = () => true }, env) {
  if (env?.CENSUS_BACKFILL !== 'on' || !env?.SAVES || !CENSUS_QUIET_HOURS.includes(utcHourOf(nowS))) return 0;
  const keptRow = await db.prepare("SELECT value FROM realm_config WHERE key = 'census-backfill'").first();
  /** @type {{ after: string, done: boolean }} */
  let cur = { after: '', done: false };
  try { cur = { ...cur, ...JSON.parse(keptRow?.value ?? '{}') }; } catch { /* a place unread starts again: nothing is written twice */ }
  let n = 0;
  while (!cur.done && n < CENSUS_BACKFILL_MAX && budget()) {
    const page = (await db.prepare(`SELECT r.id, r.player, r.obj, r.seq, r.updated_at, r.dead_at, EXISTS (SELECT 1 FROM item_census c WHERE c.char_id = r.id) AS has
      FROM realm_characters r WHERE r.id > ?1 ORDER BY r.id LIMIT ?2`).bind(cur.after, CENSUS_BACKFILL_PAGE).all())?.results ?? [];
    /** @type {any[]} */
    const rows = [];
    /** @type {unknown} a read that failed: the page stops before its character, tried again next firing */
    let failed = null;
    let after = cur.after;
    for (const r of page) {
      if (!(r.has || r.dead_at != null || !r.obj)) {
        let text = null;
        try { text = await realmSaveTextOf(await env.SAVES.get(r.obj)); } catch (e) { failed = e; break; }
        let save = null;
        try { save = JSON.parse(text ?? 'null'); } catch { save = null; }   // no object, or one that will not open: nothing to tally, for good
        const tally = censusTally(save);
        if (tally) rows.push([r.id, r.player, tally, r.seq, r.updated_at]);
      }
      after = r.id;
    }
    cur = { after, done: !failed && page.length < CENSUS_BACKFILL_PAGE };
    await db.batch([
      ...(rows.length ? [db.prepare(`INSERT OR IGNORE INTO item_census (char_id, player, tally, seq, at)
        SELECT json_extract(j.value, '$[0]'), json_extract(j.value, '$[1]'), json_extract(j.value, '$[2]'), json_extract(j.value, '$[3]'), json_extract(j.value, '$[4]')
        FROM json_each(?1) j`).bind(JSON.stringify(rows))] : []),
      db.prepare(`INSERT INTO realm_config (key, value, at, by) VALUES ('census-backfill', ?1, ?2, 'census-backfill')
        ON CONFLICT (key) DO UPDATE SET value = excluded.value, at = excluded.at, by = excluded.by`).bind(JSON.stringify(cur), nowS),
    ]);
    n += rows.length;
    if (failed) throw failed;   // what it filled is kept; the job is written down failed (cron.js), and the next firing goes on
  }
  return n;
}
