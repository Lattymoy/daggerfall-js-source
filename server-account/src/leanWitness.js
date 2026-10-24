// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LEAN-WITNESS (2026-10-19, the account database overloaded again: "D1 DB
// is overloaded. Requests queued for too long." on the harvest and the
// pixels; bible/11-Multiplayer/Scale-Arc.md LEAN-WITNESS; migration 0135)
// - A WITNESSED KEY'S ANSWERS, READ AS FAR AS THEY CAN MATTER.
//
// A hall's and a seat's facts are the first answer three accounts agree on
// (nodeLaw.js witnessedFact), and every account's first answer is kept. On
// the day 2,425 towns held 48,745 hall answers and not one town a second
// answer: a hall witness read all 24,327 of its region's (npcHalls.js), the
// seats' clock all 32,775 seat answers a minute (townSeats.js). An answer
// that agrees with its key's confirmation and came in a later second than
// it - LATE, kept by the database itself (migration 0135's
// witness_confirmed and its triggers) - changes nothing those reads judge:
//
//   - witnessedFact: after the confirmation it counts the answers that
//     differ, and the rows up to the confirming one are none of them late,
//     so the fact over the rows that are not late is the fact over all;
//   - seatIgnoredAccounts: an answer that agrees with its key's
//     confirmation is never counted, nor counts toward another answer's
//     givers - the ignored are the same;
//   - the fact with the ignored left out: where no ignored account answered
//     a key among its rows that are not late, leaving the ignored out drops
//     late rows alone, and the fact stands as above. A key one did answer
//     so is read whole (exactRows).
//
// What a late row still counts is its account - the audit lists' witnesses
// and their "exactly three", which read every row (npcHalls.js listHalls,
// townSeats.js a developer's listSeats).
// ═══════════════════════════════════════════════════════════════════

import { SEAT_WITNESS_UNMATCHED_MAX, SEAT_WITNESS_IGNORED_S } from '../../src/net/townSeatLaw.js';

/** The kinds migration 0135 keeps lean (its triggers' `kind IN (...)`). */
export const LEAN_KINDS = Object.freeze(['npchall', 'seat']);

/** THE ROWS THAT ARE NOT LATE, as a read asks them: migration 0135's lean indexes hold those two kinds' alone, and SQLite
 *  takes a partial index only for a read that repeats its condition term for term (AUDIT LEAN-READS A4). */
export const LEAN_ROWS = "kind IN ('npchall', 'seat') AND late = 0";

/** A key read whole asks this many keys a statement - D1 binds 100 parameters at most, one is the kind. */
export const LEAN_KEYS_A_STATEMENT = 99;

/** Every row of `keys` of `kind`, late or not - `{ key, account, report, at }`, in one batch. */
export async function keyRows(/** @type {any} */ db, /** @type {string} */ kind, /** @type {string[]} */ keys) {
  if (!keys.length) return [];
  const statements = [];
  for (let i = 0; i < keys.length; i += LEAN_KEYS_A_STATEMENT) {
    const part = keys.slice(i, i + LEAN_KEYS_A_STATEMENT);
    statements.push(db.prepare(`SELECT key, account, report, at FROM world_witness WHERE kind = ?1 AND key IN (${part.map((_, j) => `?${j + 2}`).join(', ')})`)
      .bind(kind, ...part));
  }
  const out = [];
  for (const r of await db.batch(statements)) for (const row of r?.results ?? []) out.push(witnessRow(row));
  return out;
}

/** A row as the laws read it. */
export const witnessRow = (/** @type {any} */ r) => ({ key: String(r.key), account: String(r.account), report: String(r.report), at: Number(r.at) });

/**
 * THE ROWS A LAW JUDGES BY: `lean` (a read of the rows that are not late) with every key an account `ignoredOf` ignores
 * answered among them read whole - so the facts with the ignored left out are the facts over every row (the header).
 * @param {any} db @param {string} kind
 * @param {{ key: string, account: string, report: string, at: number }[]} lean
 * @param {(rows: { key: string, account: string, report: string, at: number }[]) => Set<string>} ignoredOf the kind's law
 */
export async function exactRows(db, kind, lean, ignoredOf) {
  const ignored = ignoredOf(lean);
  if (!ignored.size) return lean;
  const keys = [...new Set(lean.filter((r) => ignored.has(r.account)).map((r) => r.key))];
  if (!keys.length) return lean;
  const whole = new Set(keys);
  return [...lean.filter((r) => !whole.has(r.key)), ...await keyRows(db, kind, keys)];
}

/**
 * A KEY'S ANSWERS STRUCK (AUDIT LEAN-READS 2 A1/D1) - npcHalls.js strikeHall, townSeats.js strikeSeat: three statements for
 * a batch, `where` naming the key (`?1` bound to `key`). One DELETE fires its rows' triggers in rowid order - the order
 * the answers came in - and where two answers' rows lie interleaved (a disputed or split key, the keys a developer
 * strikes) each confirmer's going turned the confirmation over and moved half the key: 1,516 rows wrote 1.1 million (2.6
 * s, some 13-20 s on D1). So the late rows first (none a confirmer: their going fires nothing), then the confirmation
 * emptied (no late row is left for it to move), then the rest (no confirmation is left to settle): every row deleted
 * once, none written. The two DELETEs' changes are the answers struck.
 * @param {any} db @param {string} kind @param {string} where @param {string} key
 */
export const strikeWitness = (db, kind, where, key) => [
  db.prepare(`DELETE FROM world_witness WHERE kind = ?2 AND ${where} AND late = 1`).bind(key, kind),
  db.prepare(`UPDATE witness_confirmed SET report = NULL, at = NULL WHERE kind = ?2 AND ${where}`).bind(key, kind),
  db.prepare(`DELETE FROM world_witness WHERE kind = ?2 AND ${where}`).bind(key, kind),
];
/** The count unmatchedRead asks, as SQL over `kind`, `account` and `since` (each SQL: a parameter or a column) - the
 *  region bump's too (npcHalls.js witnessHall: a late report whose town's confirmers may be ignored). */
export const unmatchedSql = (/** @type {string} */ kind, /** @type {string} */ account, /** @type {string} */ since) => `SELECT COUNT(*) FROM world_witness u
  JOIN witness_confirmed c ON c.kind = u.kind AND c.key = u.key
  WHERE u.account = ${account} AND u.kind = ${kind} AND u.late = 0 AND u.report != c.report AND u.at > ${since}`;
/**
 * WHETHER AN ACCOUNT CAN BE IGNORED AT ALL (seatIgnoredAccounts): ignored takes SEAT_WITNESS_UNMATCHED_MAX answers that
 * differ from their key's confirmation inside SEAT_WITNESS_IGNORED_S, the last of them under SEAT_WITNESS_IGNORED_S ago -
 * so all of them given since twice that. Fewer such answers of this kind anywhere, and no region's law can ignore it:
 * the account's own rows (idx_world_witness_account), never a region's.
 * @param {any} db @param {string} kind @param {string} account @param {number} nowS
 */
export const unmatchedRead = (db, kind, account, nowS) => db.prepare(`SELECT (${unmatchedSql('?1', '?2', '?3')}) AS n`)
  .bind(kind, account, nowS - 2 * SEAT_WITNESS_IGNORED_S);
export async function mayBeIgnored(/** @type {any} */ db, /** @type {string} */ kind, /** @type {string} */ account, /** @type {number} */ nowS) {
  const row = await unmatchedRead(db, kind, account, nowS).first();
  return Number(row?.n ?? 0) >= SEAT_WITNESS_UNMATCHED_MAX;
}
