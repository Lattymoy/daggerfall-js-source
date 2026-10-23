// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT1a (2026-09-30, Mac: "Finish the seats") - THE SEATS' REGISTRY:
// the seats the clients derived, witnessed, and the ones enough of them
// agree on.
//
// bible/11-Multiplayer/Seats-Arc.md 3.2 (Mac: "Figure it out"): the
// servers never hold ARENA2, so they learn the seats from the clients
// that derived them (src/systems/town/townSeats.js), and trust a seat only
// when enough agree. ONE TABLE, ONE LAW: a seat is witnessed as the
// professions' pixels are - `world_witness`, the kind `seat`, keyed by
// its map id, its report the seat's canonical bytes
// (net/townSeatLaw.js seatReportText) - and read by nodeLaw.js's
// witnessedFact: three witnesses agreeing byte for byte confirm it; two
// agreeing on another answer dispute it, and a disputed seat keeps every
// effect it had until a person rules; a lone dissenter is counted, never
// obeyed.
//
// ═══ WHO WITNESSES ═══════════════════════════════════════════════════
//
// A registered account a week old (WITNESS.ageS) - a guest or a new
// account reports nothing that counts. An account whose disagreements
// match nobody else's three times in a week is ignored for that week
// (townSeatLaw.js seatIgnoredAccounts): one modded MAPS.BSA, or one liar,
// is a row on the audit list, never a seat. A witness's first answer on a
// seat stands (the witnesses' INSERT OR IGNORE, as a pixel's).
//
// ═══ THE STRIKE, AND THE AUDIT ═══════════════════════════════════════
//
// A developer strikes a seat (`/seat strike <key>`, RED1's authority):
// its reports go, a history row says so, and a struck key is never
// witnessed again. The developers' reading of the list names every
// unconfirmed seat with its witnesses' count, and the AUDIT - each seat
// whose confirmation still rests on exactly three witnesses, whom nobody
// else has joined, and (AUDIT-SEATS T2) every disputed seat, at once.
// AUDIT-SEATS S4: a held seat's strike voids its Charter in the strike's
// own batch - the hold gone, its proclaimed Edict void, the week's battle
// there void, the claim fee refunded within the Season.
//
// Behind SEATS_OPEN (off, dev, on - SEAT0 18). EVERY CLOCK IS AN
// ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { isDeveloper } from './titles.js';
import { witnessedFact, factConfirmed, WITNESS } from '../../src/net/nodeLaw.js';
import {
  seatsSwitchOf, seatReportOf, seatReportText, parseSeatReport, seatIgnoredAccounts, seatKeyOk, seatWeekOf,
  SEAT_WITNESS_REPORTS_HOUR, SEAT_WITNESSES_AUDIT, seasonFloor, seasonZeroOf,
} from '../../src/net/townSeatLaw.js';
import { utcDay, MARKS_MAX } from '../../src/net/marksLaw.js';   // AUDIT-SEATS S4: a struck Charter's fee refunded
import { fortsLapsedStatements } from './seatForts.js';   // AUDIT SEATS-2 S5: a struck Charter's building projects fall with it
import { DB_ROOT, replicaDb, d1Overloaded, bookmarkOf } from './service.js';   // STORM-SHED: the binding a request's counted Proxy wraps; SEAT-REPLICA: the kept read's session
import { exactRows, witnessRow, strikeWitness, LEAN_ROWS } from './leanWitness.js';   // LEAN-WITNESS

/** Whether the seats are open to this account: the switch, and at `dev` the developers alone. */
export function seatsOpenFor(player, env) {
  const s = seatsSwitchOf(env?.SEATS_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}
/** An account a week registered may witness (SEAT0 3.2), as a harvest's and a hub's do - and a guild hall's (CHAP2a,
 *  npcHalls.js reads this one). */
export const witnessOf = (player, nowS) => Number.isSafeInteger(player?.registered_at) && player.registered_at <= nowS - WITNESS.ageS;

/** Whether a seat's key was struck (a history row), so it is never witnessed again. */
async function struck(db, key) {
  return !!(await db.prepare("SELECT 1 FROM town_seat_history WHERE key = ? AND kind = 'strike'").bind(key).first());
}

/**
 * EVERY SEAT AS THE WITNESSES SAY IT IS: each key's fact (witnessedFact over its reports, the ignored accounts' left
 * out), its witnesses' count, and whether the audit names it. Pure over the rows.
 * @param {{ key: string, account: string, report: string, at: number }[]} rows
 * @param {number} nowS
 */
export function seatFacts(rows, nowS) {
  const byKey = new Map();
  for (const r of rows) {
    const list = byKey.get(r.key) ?? [];
    list.push(r);
    byKey.set(r.key, list);
  }
  // the first pass: what each seat is taken to be, every account counted - the ignored accounts are read off it
  const confirmed = new Map();
  for (const [k, list] of byKey) {
    const f = witnessedFact(list, parseSeatReport);
    if (factConfirmed(f)) confirmed.set(k, seatReportText(/** @type {any} */ (f).seat));
  }
  const ignored = seatIgnoredAccounts(rows, confirmed, nowS);
  const out = [];
  for (const [k, list] of byKey) {
    const kept = list.filter((r) => !ignored.has(r.account));
    const f = /** @type {any} */ (witnessedFact(kept, parseSeatReport));
    if (f.state === 'none') continue;
    const agreeing = f.seat ? kept.filter((r) => r.report === seatReportText(f.seat)) : [];
    out.push({ key: Number(k), fact: f, witnesses: new Set(kept.map((r) => r.account)).size, agreeing: agreeing.map((r) => r.account) });
  }
  // THE AUDIT (SEAT0 3.2): "a seat confirmed by exactly three witnesses whom nobody else ever joins" - its confirmation
  // still resting on the bare three, no fourth ever agreeing; AUDIT-SEATS T2 (3.2: a disputed row "goes on the audit list
  // at once"): and every disputed seat, however many agree on what it stands as
  for (const s of out) s.audit = (factConfirmed(s.fact) && s.agreeing.length === SEAT_WITNESSES_AUDIT) || s.fact.state === 'disputed';
  return { seats: out, ignored };
}

/** Every seat row's read, and (LEAN-WITNESS) the read of the rows that are not late, by their index whatever the
 *  statistics (AUDIT LEAN-READS 2 A3) - one text each, the pins' too. */
export const SEAT_ROWS_SQL = "SELECT key, account, report, at FROM world_witness WHERE kind = 'seat'";
export const SEAT_JUDGED_SQL = `SELECT key, account, report, at FROM world_witness INDEXED BY idx_world_witness_lean_key WHERE kind = 'seat' AND ${LEAN_ROWS}`;
/** Every seat row - LEAN-WITNESS: a developer's list alone, whose audit counts every witness. */
async function allSeatRows(db) {
  const { results = [] } = await db.prepare(SEAT_ROWS_SQL).all();
  return results.map(witnessRow);
}
/** LEAN-WITNESS (2026-10-19, migration 0135; bible/11-Multiplayer/Scale-Arc.md LEAN-WITNESS): THE SEAT ROWS THE LAW
 *  JUDGES BY - the rows that are not late (idx_world_witness_lean_key), a seat an ignored account answered read whole
 *  (leanWitness.js exactRows). seatFacts' facts and ignored over them are its facts over every row; its witnesses' counts
 *  and audit are not, and nothing but a developer's list reads those. 32,775 rows a read on the day, one seat in 27
 *  late's worth. */
export async function judgedSeatRows(db, nowS) {
  const { results = [] } = await db.prepare(SEAT_JUDGED_SQL).all();
  return exactRows(db, 'seat', results.map(witnessRow), (rows) => seatFacts(rows, nowS).ignored);
}

/** STORM-SHED (2026-10-06 evening, the second overload - "D1 DB is overloaded"): HOW LONG ONE ISOLATE KEEPS THE SEATS'
 *  WITNESS ROWS. Every list, every Watch claim and every witness's report read each `seat` row of world_witness - one a
 *  seat and witness, never trimmed: 4,050 rows a read, the database's costliest read by time in the outage's two hours -
 *  and a client whose Watch claim failed claimed again the moment the answer came, so the read the overload made slow
 *  was asked the faster for it. A seat's facts move with a witness's report and by the week (seatIgnoredAccounts), so a
 *  minute is nothing to them; a report or a strike written here lets them go at once. */
export const SEAT_ROWS_KEPT_S = 60;
/** SEAT-REPLICA (2026-10-13, the account database overloaded from 14:11 UTC; bible/11-Multiplayer/Scale-Arc.md
 *  SEAT-REPLICA): WHERE THE KEPT READ IS ASKED - a read replica, never the primary's queue. The rows were 15,899 a read
 *  on the day, and the isolates many enough that two lists in three missed their isolate's kept copy; in the outage the
 *  read was more than half the primary's statement time and nine in ten of the rows it answered. A read after this
 *  isolate's own write starts at the primary ('first-primary', so it sees the write), and every read after a kept one
 *  starts from the bookmark that one ended at, so a replica behind what this isolate already read never answers it
 *  (D1's Sessions API); the first, with neither, is any instance's. */
export const SEAT_ROWS_FROM = 'first-unconstrained';
/** The database binding -> what this isolate last read of it, and the read asked now, and its writes counted; and
 *  (SEAT-REPLICA) the bookmark its last kept read ended at, and whether it has written since. */
const seatRowsKept = new WeakMap(), seatRowsAsking = new WeakMap(), seatRowWrites = new WeakMap();
const seatRowsMark = new WeakMap(), seatRowsWritten = new WeakSet();
const seatRowsRoot = (/** @type {any} */ db) => db?.[DB_ROOT] ?? db;

/** STORM-SHED: the seats' witness rows as this isolate keeps them - read at most once in SEAT_ROWS_KEPT_S, every ask of
 *  one moment answered by one read, and a read begun before a write here never kept. SEAT-REPLICA: each read on a
 *  session of its own (SEAT_ROWS_FROM); a session D1 will not open is the database as the request holds it. */
async function seatRowsOf(db, nowS) {
  const root = seatRowsRoot(db);
  const kept = seatRowsKept.get(root);
  if (kept && nowS - kept.at < SEAT_ROWS_KEPT_S) return kept.rows;
  const asking = seatRowsAsking.get(root);
  if (asking) return asking;
  const gen = seatRowWrites.get(root) ?? 0;
  const wrote = seatRowsWritten.has(root);
  const from = wrote ? 'first-primary' : (seatRowsMark.get(root) ?? SEAT_ROWS_FROM);
  let session = db;
  // DISPLAY-REPLICA: a request already on a session (a replica route's - a market's or a pixel's read asking a seat) has
  // none of its own to open; the binding opens this read's, so the read after a write here is still the primary's
  const opener = typeof db?.withSession === 'function' ? db : root;
  try { session = replicaDb(opener, from); } catch { /* a bookmark D1 refuses: the request's database */ }
  const ask = judgedSeatRows(session, nowS).then((rows) => {   // LEAN-WITNESS
    if ((seatRowWrites.get(root) ?? 0) === gen) {
      seatRowsKept.set(root, { at: nowS, rows });
      const mark = bookmarkOf(session);
      if (mark) seatRowsMark.set(root, mark);
      if (wrote) seatRowsWritten.delete(root);
    }
    return rows;
  }, (e) => { if (seatRowsMark.get(root) === from) seatRowsMark.delete(root); throw e; })   // a read that failed from a bookmark: the next starts from none (never a newer read's)
    .finally(() => { if (seatRowsAsking.get(root) === ask) seatRowsAsking.delete(root); });
  seatRowsAsking.set(root, ask);
  return ask;
}
/** STORM-SHED: the kept rows let go - a witness's report or a strike written here. SEAT-REPLICA: and the next read the
 *  primary's, which has the write. SEAT-FACTS: and the service's kept facts too, until the clock keeps them after it. */
function forgetSeatRows(db, nowS) {
  const root = seatRowsRoot(db);
  seatRowsKept.delete(root);
  seatRowsAsking.delete(root);
  seatRowWrites.set(root, (seatRowWrites.get(root) ?? 0) + 1);
  seatRowsWritten.add(root);
  seatWroteAt.set(root, nowS);   // SEAT-FACTS: no kept row from before it answers here again (keptSeatFacts)
}

/** SEAT-FACTS (2026-10-13, after SEAT-REPLICA; the owner: "1, 2 and 3"; bible/11-Multiplayer/Scale-Arc.md SEAT-FACTS):
 *  THE SEATS AS THE WITNESSES SAY THEY ARE, KEPT ONCE FOR THE WHOLE SERVICE. Each isolate read every seat row a minute
 *  and counted the facts over them on every ask - after SEAT-REPLICA some 100 reads of 15,899 rows a minute on the one
 *  replica, whose p99 went from 2 ms to some 60 ms with them. Now the minute's clock (cron.js `seat-facts`) reads the
 *  rows once and keeps what they say in one row - the seats that stand (a disputed one too) by their reports, and the
 *  accounts ignored - and every isolate reads that row instead, kept SEAT_ROWS_KEPT_S as the rows were. A row older
 *  than SEAT_FACTS_FRESH_S (the clock stopped) is no answer: the rows are read as before. And an isolate that wrote a
 *  report or a strike reads the rows until the clock has kept the facts after its write. */
export const SEAT_FACTS_FRESH_S = 180;
const SEAT_FACTS_SQL = 'SELECT at, facts FROM seat_facts_kept WHERE id = 1';
/** SEAT-FACTS: the database binding -> the kept facts this isolate read (or that none fit, a minute), the read asked
 *  now, and its last write's clock. A row is an answer only while it is fresh and newer than that write. */
const seatFactsKept = new WeakMap(), seatFactsAsking = new WeakMap(), seatWroteAt = new WeakMap();

/** SEAT-FACTS: the facts as the clock keeps them - the seats that stand by key, state and report, and the ignored. */
export function seatFactsText(/** @type {{ seats: any[], ignored: Set<string> }} */ { seats, ignored }) {
  return JSON.stringify({ seats: seats.filter((x) => factConfirmed(x.fact)).map((x) => [x.key, x.fact.state, seatReportText(x.fact.seat)]), ignored: [...ignored].sort() });
}
/** SEAT-FACTS: the kept text read back as seatFacts answers - `{ seats: [{ key, fact }], ignored }` - or null for any
 *  text that is not the clock's. */
export function seatFactsOfText(/** @type {unknown} */ text) {
  let o;
  try { o = JSON.parse(String(text)); } catch { return null; }
  if (!o || !Array.isArray(o.seats) || !Array.isArray(o.ignored)) return null;
  const seats = [];
  for (const e of o.seats) {
    if (!Array.isArray(e) || e.length !== 3) return null;
    const [key, state, report] = e;
    const read = parseSeatReport(report);
    if (!Number.isSafeInteger(key) || (state !== 'confirmed' && state !== 'disputed') || !read) return null;
    seats.push({ key, fact: { state, ...read } });
  }
  return { seats, ignored: new Set(o.ignored.filter((/** @type {unknown} */ a) => typeof a === 'string')) };
}
/** SEAT-FACTS: THE CLOCK'S MINUTE - every seat row read on the binding (the primary: the facts no older than any write
 *  before them) and what they say kept in the one row. 1, the facts kept. */
export async function keepSeatFacts(/** @type {any} */ db, /** @type {number} */ nowS) {
  const facts = seatFacts(await judgedSeatRows(db, nowS), nowS);   // LEAN-WITNESS
  await db.prepare('INSERT INTO seat_facts_kept (id, at, facts) VALUES (1, ?1, ?2) ON CONFLICT (id) DO UPDATE SET at = excluded.at, facts = excluded.facts')
    .bind(nowS, seatFactsText(facts)).run();
  return 1;
}
/** SEAT-FACTS: the kept row, read on a session of its own (any instance's: the row says how old it is), or null - none,
 *  another shape, or a table not there. An overload is the overload's, as every read's is. */
async function seatFactsRow(db, root) {
  let session = db;
  try { session = replicaDb(typeof db?.withSession === 'function' ? db : root, SEAT_ROWS_FROM); } catch { /* the request's database */ }
  let row;
  try { row = await session.prepare(SEAT_FACTS_SQL).first(); } catch (e) { if (d1Overloaded(e)) throw e; return null; }
  const of = Number(row?.at);
  if (!Number.isSafeInteger(of)) return null;
  const facts = seatFactsOfText(row.facts);
  return facts ? { of, facts } : null;
}
/** SEAT-FACTS: THE SEATS' FACTS AS AN ISOLATE ANSWERS THEM - the clock's kept row while it is fresh and newer than this
 *  isolate's last write, read at most once in SEAT_ROWS_KEPT_S and once for every ask of one moment; else counted from
 *  the rows (seatRowsOf), as before. */
async function keptSeatFacts(db, nowS) {
  const root = seatRowsRoot(db);
  const fresh = (/** @type {{ of: number }} */ k) => k.of > (seatWroteAt.get(root) ?? -Infinity) && nowS - k.of <= SEAT_FACTS_FRESH_S;
  const kept = seatFactsKept.get(root);
  if (kept && nowS - kept.at < SEAT_ROWS_KEPT_S) {
    if (kept.facts && fresh(kept)) return kept.facts;
    if (!kept.facts) return seatFacts(await seatRowsOf(db, nowS), nowS);   // no fit row a moment ago: the rows, not another ask
  }
  let asking = seatFactsAsking.get(root);
  if (!asking) {
    asking = seatFactsRow(db, root).finally(() => { if (seatFactsAsking.get(root) === asking) seatFactsAsking.delete(root); });
    seatFactsAsking.set(root, asking);
  }
  const row = await asking;
  if (row && fresh(row)) {
    seatFactsKept.set(root, { at: nowS, of: row.of, facts: row.facts });
    return row.facts;
  }
  seatFactsKept.set(root, { at: nowS, of: -Infinity, facts: null });   // none fit to answer: the rows a minute, and asked again after
  return seatFacts(await seatRowsOf(db, nowS), nowS);
}

/**
 * THE SEATS THE WITNESSES CONFIRMED - confirmed and disputed alike (a disputed seat keeps every effect it had), each
 * `{ key, name, region, tier, pixel, state }`. With the reader's own standing (may they witness). A developer's reading
 * also names every unconfirmed seat and the audit.
 * @param {{db: any, nowS: number}} ctx
 */
export async function listSeats({ db, nowS }, player, env) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  const dev = isDeveloper(player, env);
  // STORM-SHED: a player's list is the isolate's kept rows; a developer's reads the table as it stands - the audit names a
  // disputed seat at once (AUDIT-SEATS T2), whichever isolate took its reports
  const { seats, ignored } = dev ? seatFacts(await allSeatRows(db), nowS) : await keptSeatFacts(db, nowS);   // SEAT-FACTS: the service's kept facts
  const view = (s) => ({ ...s.fact.seat, state: s.fact.state });
  return {
    seats: seats.filter((s) => factConfirmed(s.fact)).map(view).sort((a, b) => a.key - b.key),
    me: { witness: witnessOf(player, nowS) && !ignored.has(player.id), developer: dev },
    ...(dev ? {
      unconfirmed: seats.filter((s) => !factConfirmed(s.fact) && s.fact.seat).map((s) => ({ ...view(s), witnesses: s.witnesses })).sort((a, b) => a.key - b.key),
      audit: seats.filter((s) => s.audit).map((s) => s.key).sort((a, b) => a - b),
    } : {}),
  };
}

/**
 * SEAT1b: THE SEATS A PLEDGE, A TICK OR A TRIBUTE MAY NAME - every confirmed seat (a disputed one too: it keeps every
 * effect it had), by key: `Map<key, { key, name, region, tier, pixel, state }>`. The ignored accounts left out, as the
 * list leaves them. STORM-SHED: the Watch's claims read the isolate's kept rows (seatRowsOf); GATHER-SPEED and
 * MARKET-SPEED kept them too for the asks on a harvest's or a market read's way - a Levy's seat (seatHolding.js levyAt),
 * a Tithe's (titheAt) and a board's Market Hall (seatForts.js listingsCapAt), each of which read every seat row on
 * every harvest, read and buy. D1-LOAD (2026-10-11, the service slow after SEAT-LEASE): AND EVERY OTHER CALLER - the
 * standings (every board opened, and a holder's members' Watchtowers every ten minutes), the minute's auctions closed,
 * a Bounty's camp, a pledge - so kept is the rule, not a choice each caller must remember: all 4,050 of the seats'
 * witness rows were STORM-SHED's costliest read by time. A seat's facts move only with a witness's report or a strike
 * (each lets the rows go here) and by the week, so the minute's bound is the list's own. `fresh` reads the table as it
 * stands - the Turning's, once a week (seatTurning.js settleWeek), whose registry decides who holds what.
 * @param {any} db
 * @param {number} nowS
 * @param {{ fresh?: boolean }} [opts]
 */
export async function confirmedSeats(db, nowS, { fresh = false } = {}) {
  const { seats } = fresh ? seatFacts(await judgedSeatRows(db, nowS), nowS) : await keptSeatFacts(db, nowS);   // SEAT-FACTS: the service's kept facts
  return new Map(seats.filter((s) => factConfirmed(s.fact)).map((s) => [s.key, { ...s.fact.seat, state: s.fact.state }]));
}

/**
 * A SEAT WITNESSED - the client standing in a seat town reports the seat it derived (`{ key, name, region, tier, pixel }`,
 * checked by townSeatLaw.js seatReportOf). A registered account a week old is counted (its first answer on the seat
 * stands); anyone else's report is answered, and counts for nothing (`counted: false` and why). A struck seat is refused.
 * @param {{db: any, nowS: number}} ctx
 */
export async function witnessSeat({ db, nowS }, player, env, { seat } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  const s = seatReportOf(seat);
  if (!s) return { error: 'bad-seat' };
  if (await overRate({ db, nowS }, `seat-witness:${player.id}`, SEAT_WITNESS_REPORTS_HOUR, 3600)) return { error: 'seats-rate' };
  if (await struck(db, s.key)) return { error: 'seat-struck' };
  if (!witnessOf(player, nowS)) return { ok: true, counted: false, why: 'young' };
  const { ignored } = await keptSeatFacts(db, nowS);   // STORM-SHED: the isolate's kept rows; SEAT-FACTS: the service's kept facts
  if (ignored.has(player.id)) return { ok: true, counted: false, why: 'ignored' };
  const put = await db.prepare("INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)")
    .bind(String(s.key), player.id, seatReportText(s), s.region, nowS).run();
  // STORM-SHED: this report is the rows' news - asked afresh here. SEAT-REPLICA: unless the table already held it (a
  // witness's first answer stands, so the same witness's report again writes nothing, and cost the next ask a whole
  // read of the rows all the same)
  if (Number(put?.meta?.changes) !== 0) forgetSeatRows(db, nowS);
  return { ok: true, counted: true };
}

/**
 * THE STRIKE (SEAT0 3.2: "`/seat strike <key>` (the dev glyph, RED1's authority) removes a row and its history, and the
 * strike is itself a history row") - a developer's alone. The seat's reports go; a history row names the strike and who
 * made it; the key is never witnessed again. SEAT1c: a held seat's Charter voids with it (SEAT0 16).
 * @param {{db: any, nowS: number}} ctx
 */
export async function strikeSeat({ db, nowS }, dev, env, { key } = {}) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const week = seatWeekOf(nowS * 1000);
  // AUDIT-SEATS S4 (16: "A seat is struck by a developer (3.2) while held: the Charter voids, the claim fee is refunded to
  // the holder's Marks treasury if struck within the Season, and the history keeps the row"): in the strike's own batch -
  // the fee its Charter paid (the Turning's claim line, or the Tourney's) minted back where the Charter began this Season
  // (townSeatLaw.js seasonFloor), what the treasury has room for; its proclaimed Edict void; a battle there void (its
  // Sellswords' escrow goes home at the Turning, seatTurning.js); the hold gone - so no token wears it, no pledge counts
  // through it, and the guild may pledge in the region again
  const h = await db.prepare('SELECT h.guild_id, g.name, g.tag FROM town_seat_holds h LEFT JOIN guilds g ON g.id = h.guild_id WHERE h.key = ?').bind(key).first();
  const rid = `strike-${key}`;
  const [, , , , late, , rest] = await db.batch([
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'guild', h.guild_id, 'seat-strike-refund', MIN(l.amount, ${MARKS_MAX} - COALESCE((SELECT balance FROM guild_marks WHERE guild_id = h.guild_id), 0)),
        ?2, ?3, 'seats', 'The registry', ?4
      FROM town_seat_holds h JOIN marks_ledger l ON l.actor = 'seats' AND l.kind = 'seat-claim' AND l.src_id = h.guild_id
        AND l.rid IN ('claim-' || (h.since_week - 1) || '-' || h.key, 'tourney-' || h.since_week || '-' || h.key)
      WHERE h.key = ?1 AND h.since_week >= ?5 AND EXISTS (SELECT 1 FROM guilds WHERE id = h.guild_id)
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = h.guild_id), 0) < ${MARKS_MAX}
      LIMIT 1`).bind(key, utcDay(nowS), nowS, rid, seasonFloor(week, seasonZeroOf(env?.SEASON_ZERO_WEEK))),
    db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND state = 'proclaimed'").bind(key),
    db.prepare("UPDATE town_seat_battles SET state = 'void' WHERE key = ? AND week >= ? AND state = 'scheduled'").bind(key, week),
    db.prepare('DELETE FROM town_seat_holds WHERE key = ?').bind(key),
    ...strikeWitness(db, 'seat', 'key = ?1', String(key)),   // LEAN-WITNESS: its rows and its confirmation (0135's triggers take the key's row with its last answer)
    db.prepare(`INSERT INTO town_seat_history (key, week, kind, data, at)
      SELECT ?1, ?2, 'strike', json_set(?3, '$.refund', COALESCE((SELECT amount FROM marks_ledger WHERE actor = 'seats' AND rid = ?5), 0)), ?4`)
      .bind(key, week, JSON.stringify({ by: dev.handle ?? null, ...(h ? { guild: { name: h.name ?? '', tag: h.tag ?? '' } } : {}) }), nowS, rid),
    ...fortsLapsedStatements(db, key, nowS),   // AUDIT SEATS-2 S5: a building project falls with the Charter
  ]);
  forgetSeatRows(db, nowS);   // STORM-SHED: the struck seat's reports are gone - asked afresh here
  return { ok: true, key, reports: Number(late?.meta?.changes ?? 0) + Number(rest?.meta?.changes ?? 0) };
}
