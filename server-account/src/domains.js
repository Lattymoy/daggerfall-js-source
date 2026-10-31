// @ts-check
// ═════════════════════════════════════════════════════════════════════
// DOMAIN3 (2026-10-24, the owner: "A transition to tamriel region control
// instead of just city control"; asked, "Replace seats") - THE REGION'S
// CHARTER, as the service learns and reads it (bible/11-Multiplayer/
// Domains.md section 7).
//
// ONE REGION, ONE CHARTER (Domains law 1): from the seat week the config's
// DOMAINS_WEEK names, a guild holds a region - its Charter its SEAT OF
// POWER's (net/domainLaw.js), every other seat town of the region that
// Charter's holding. THE KEYS STAY (law 4): the Charter is its seat of
// power's seat, so every table, the siege room and the works read it as
// they read a seat; what changes is which seats are Charters (domainLaw.js
// charterSeats) and where a holding's war counts (charterUnder).
//
// ═══ THE WITNESS ═════════════════════════════════════════════════════
//
// The servers hold no ARENA2 (SEAT0 3.2): the client standing in a seat
// town reports, beside the seat, its region's seat of power as its own
// MAPS.BSA ranks it (systems/town/townSeats.js deriveTownSeats `powers`),
// and three witnesses agreeing confirm it (net/nodeLaw.js witnessedFact) -
// a key the seats' registry confirms as a seat OF THAT REGION, the crown
// in a crown's (domainLaw.js domainSeats). The same witnesses as a seat's:
// a registered account a week old, never one the seats' law ignores, its
// first answer standing. ITS OWN TABLE (migration 0169), kept small: an
// answer that agrees with the region's confirmation is written only while
// fewer than DOMAIN_AGREEING_KEPT do (AUDIT DOMAINS S3: kept at the bare
// three, one confirming witness lost - an account deleted, or one the
// seats' law ignores for a week - left the confirmation to the first three
// dissenters, and a Turning in that week folded the real Charter away), so
// the rows stay a dozen a region and the dissenters, read whole a minute an
// isolate.
//
// Behind SEATS_OPEN, as every seat route. EVERY CLOCK IS AN ARGUMENT, as
// in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { witnessedFact, factConfirmed } from '../../src/net/nodeLaw.js';
import { seatReportOf } from '../../src/net/townSeatLaw.js';
import {
  domainReportOf,
  domainReportText,
  parseDomainReport,
  domainSeats,
  domainsWeekOf,
  domainsRule,
} from '../../src/net/domainLaw.js';
import { confirmedSeats, seatIgnored, witnessSeat } from './townSeats.js';
import { DB_ROOT } from './service.js';

/** Every seat-of-power answer - some hundred rows (the header). */
export const DOMAIN_ROWS_SQL = 'SELECT region, account, report, at FROM town_domain_witness';
/** How long one isolate keeps the rows - the seats' own minute (townSeats.js SEAT_ROWS_KEPT_S). */
export const DOMAIN_ROWS_KEPT_S = 60;
/** AUDIT DOMAINS S3: the agreeing answers a region keeps - four times the three that confirm, so the confirmation outlasts
 *  any few of its witnesses gone; one more agreeing answer past them changes nothing the law judges. */
export const DOMAIN_AGREEING_KEPT = 12;

/** The database binding -> the rows this isolate last read `{ at, rows }`, and its writes counted (a read begun before a
 *  write here is never kept). */
const domainRowsKept = new WeakMap(),
  domainRowWrites = new WeakMap();
const rootOf = (/** @type {any} */ db) => db?.[DB_ROOT] ?? db;

async function domainRowsOf(db, nowS, fresh) {
  const root = rootOf(db);
  const kept = domainRowsKept.get(root);
  if (!fresh && kept && nowS - kept.at < DOMAIN_ROWS_KEPT_S) return kept.rows;
  const gen = domainRowWrites.get(root) ?? 0;
  const { results = [] } = await db.prepare(DOMAIN_ROWS_SQL).all();
  const rows = results.map((r) => ({
    key: String(r.region),
    account: String(r.account),
    report: String(r.report),
    at: Number(r.at),
  }));
  if ((domainRowWrites.get(root) ?? 0) === gen) domainRowsKept.set(root, { at: nowS, rows });
  return rows;
}

/**
 * EACH REGION'S SEAT OF POWER AS ITS WITNESSES SAY IT - region -> key, the confirmed answers alone (a disputed one too:
 * it keeps every effect it had, as a seat's), the `ignored` accounts left out. Pure over the rows.
 * @param {{ key: string, account: string, report: string, at: number }[]} rows @param {Set<string>} [ignored]
 */
export function domainFacts(rows, ignored = new Set()) {
  const byRegion = new Map();
  for (const r of rows ?? []) {
    if (ignored.has(r.account)) continue;
    const list = byRegion.get(r.key) ?? [];
    list.push(r);
    byRegion.set(r.key, list);
  }
  /** @type {Map<number, number>} */
  const out = new Map();
  for (const [k, list] of byRegion) {
    const f = /** @type {any} */ (witnessedFact(list, parseDomainReport));
    if (factConfirmed(f) && f.domain?.region === Number(k)) out.set(Number(k), f.domain.key);
  }
  return out;
}

/** THE CHARTERS' SEATS OF POWER - region -> its seat (`{ key, name, region, tier, pixel, state }`), each a confirmed
 *  seat of its region (domainSeats). `fresh` reads both tables as they stand - the Turning's. */
export async function confirmedDomains(db, nowS, { fresh = false } = {}) {
  const [seats, rows, ignored] = await Promise.all([
    confirmedSeats(db, nowS, { fresh }),
    domainRowsOf(db, nowS, fresh),
    seatIgnored(db, nowS),
  ]);
  return domainSeats(seats, domainFacts(rows, ignored));
}

/** THE REGION LAW FOR SEAT WEEK `week`: its seats of power (confirmedDomains) where DOMAINS_WEEK rules that week, else
 *  null - the seat law, read as before. No read at all where it does not rule. */
export async function domainsFor(db, nowS, env, week, opts = {}) {
  return domainsRule(week, domainsWeekOf(env?.DOMAINS_WEEK)) ? confirmedDomains(db, nowS, opts) : null;
}

/** THE SEATS' LIST'S WORD OF IT: `{ from, rule, seats: [[region, key], ...] }` - the week the law first rules, whether it
 *  rules this one, and each region's confirmed seat of power - or null where DOMAINS_WEEK is unset. */
export async function domainsBoard(db, nowS, env, week) {
  const from = domainsWeekOf(env?.DOMAINS_WEEK);
  if (from == null) return null;
  const d = await confirmedDomains(db, nowS);
  return {
    from,
    rule: domainsRule(week, from),
    seats: [...d].map(([region, s]) => [region, s.key]).sort((a, b) => a[0] - b[0]),
  };
}

/**
 * A SEAT OF POWER WITNESSED - asked beside the seat the client stands in (`seat`, already counted by witnessSeat), the
 * region's seat of power as its MAPS.BSA ranks it (`raw`, `{ region, key }`). Answers 'counted', 'agreed' (the region's
 * confirmation already says it, and DOMAIN_AGREEING_KEPT answers with it - nothing written), or 'bad-domain' (not the
 * seat's own region, or no report).
 * @param {{db: any, nowS: number}} ctx
 */
export async function witnessDomain({ db, nowS }, player, seat, raw) {
  const s = seatReportOf(seat);
  const d = domainReportOf(raw);
  if (!s || !d || d.region !== s.region) return 'bad-domain';
  const report = domainReportText(d);
  const [rows, ignored] = await Promise.all([domainRowsOf(db, nowS, false), seatIgnored(db, nowS)]);
  const agreeing = rows.filter(
    (r) => r.key === String(d.region) && r.report === report && !ignored.has(r.account),
  ).length;
  if (domainFacts(rows, ignored).get(d.region) === d.key && agreeing >= DOMAIN_AGREEING_KEPT) return 'agreed';
  const put = await db
    .prepare('INSERT OR IGNORE INTO town_domain_witness (region, account, report, at) VALUES (?, ?, ?, ?)')
    .bind(d.region, player.id, report, nowS)
    .run();
  if (Number(put?.meta?.changes) !== 0) {
    const root = rootOf(db);
    domainRowsKept.delete(root);
    domainRowWrites.set(root, (domainRowWrites.get(root) ?? 0) + 1);
  }
  return 'counted';
}

/** `POST /v1/seats/witness`: the seat (townSeats.js witnessSeat) and, where the body names one, its region's seat of power
 *  - counted only where the seat's report was (`domain` the answer's word for it). */
export async function witnessSeatAndDomain(ctx, player, env, body = {}) {
  const r = await witnessSeat(ctx, player, env, body);
  if ('error' in r || body?.domain === undefined) return r;
  return { ...r, domain: r.counted ? await witnessDomain(ctx, player, body.seat, body.domain) : 'not-counted' };
}
