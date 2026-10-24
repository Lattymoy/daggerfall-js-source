// @ts-check
// ═══════════════════════════════════════════════════════════════════
// QL12 (2026-10-19, the owner: "New questlines tying into and introduced the oblivion gates, abyss dungeons, elite
// dungeons and elite breaches"; bible/06-Systems/Questlines-Arc.md sections 1 (decision 8) and 5.3): THE QUESTLINES'
// CLAIM - what the account service pays a questline, and only against what it witnessed.
//
// `POST /v1/ql/claim { line, step, phase, choice? }`, behind a session. Its pay for a registered account (FOUNDER's law,
// as lamp.js: a guest's end is answered `guest` and nothing is paid - its opening is written, AUDIT QUESTLINES SERVICE-1). The law both ends share is src/net/questlineClaims.js -
// QL_SERVICE_LINES names the steps the service pays, each step's witness, the title a line pays and on which step, and
// the Covens' Hoard's Weir Key. A step the service pays nothing is answered `unpaid` (qlStepClaimed).
//
// A STEP IS CLAIMED TWICE (the client's line runner, systems/questlines/qlLineRunner.js), each claim saying its PHASE:
//   - `open`, when the step starts: one `ql_steps` row (migration 0133), `opened_at` the service's clock - `{ opened:
//     true }`. INSERT OR IGNORE, so an opening asked twice opens once. An opening pays nothing and reads nothing, so a
//     guest's is written too (SERVICE-1: the guest who registers mid-line keeps the line's opening - the same id).
//   - `end`, when the step ended well: it reads the step's WITNESS (QL_WITNESS_SQL) - the endgame place's own receipt
//     row, the account's, written at or after the LINE's first opening (an end whose own opening never landed is read
//     against the line's - SERVICE-2), newer than the receipt that witnessed an earlier step of the line and older than
//     one that witnessed a later one (`seen_at`: one receipt, one step - SERVICE-5) - and only once every earlier
//     WITNESSED step of the line is done (AUDIT STARFALL B2, qlStepsBefore: a later step's end asked first read its window
//     from the line's opening, and the earlier step's receipt witnessed both - the Starwarden paid on three stars, not
//     four). Unwitnessed - `{ witnessed: false }`, nothing paid (the client asks again, and a later deed's receipt - or
//     the earlier step's own end - witnesses it); witnessed - `done_at` laid,
//     `seen_at` the receipt's second, and the outcome's `choice` (the first one an end carries) - `{ witnessed: true }`.
//     A step with no receipt (the Covens' Hoard's last) is witnessed once its line's `after` is witnessed whole: that
//     line's title held on this row (SERVICE-4). Only an end pays (SERVICE-6: an opening asked again paid Covenbane at
//     the step's START).
//   `at` is the claim's own time on each receipt row (accounts.js claimGate, eg.js claimEg, sds.js claimSd, serpents.js
//   claimSerpent, STAR8's stars.js claimStar all write `nowS`), so a receipt held unclaimed across the line's opening - the client claims its
//   receipts as they come, and each lives a week (RECEIPT_TTL_S) - is read as the claim's, not the kill's.
//
// WHAT IT PAYS, in the one batch that lays `done_at` (a failure takes nothing half-written):
//   THE TITLE - a line's bit on `players.ql_titles` (qlTitleBit), held by the account for good, once its `titleAt` step and every
//     witnessed step before it are done. Asked on every claim of those steps, so a line whose steps were done out of
//     order before B2's order (rows written by acct159-164) still pays it when the last of them lands; the UPDATE's own
//     WHERE holds it to once, and `title` is answered only by the claim whose write changed the row.
//   THE PURSE (T-B, bible/06-Systems/Witches-Festival.md "The Starwarden's purse") - Soul Cakes a line's title pays beside
//     it (QL_PURSES: the Thirteenth of Frostfall's QL_STARWARDEN_CAKES) onto `players.fest_cakes`, IN the title's own
//     UPDATE - its WHERE the purse's guard, so once an account - and only while the festival is open for the account at
//     the claim's clock (festival.js festivalOpenFor, festivalLaw.js festivalOpen); a guest's end never reaches the batch.
//     Answered `purse` (the cakes paid) to the claim whose write laid the title.
//   THE KEY - the Covens' Hoard's Weir Key, once an account: its `key.at` step done with the choice that keeps it
//     (`keep`) - the step is done only behind the Cycle's first line witnessed whole (`after`). ONE statement, `eg_keys` + 1 and
//     `ql_key` = 1 together, only while `ql_key` is 0 - the balance every Weir Key is (eg.js: the item in the pack is
//     its face, restacked to every answer that carries the count), so `key: true` comes with `keys`, the balance after.
//     No ledger rides it: every key grant of the service's (eg.js rollWeirKey, egGateWeir, findEg; egEconomy.js a
//     Valkynaz's) is that one UPDATE, and the item law reads the key's row (KEY-LAW), not the grant.
//
// Opened by QUESTLINES_OPEN (`off` | `dev` | `on`, wrangler.toml), read as FIRMAMENT_OPEN is: `dev` the developers
// alone; shut, `ql-closed` (403).
//
// Not a DFU member - Daggerfall Unity has no account service. Ledger A (QUESTLINES).
// ═══════════════════════════════════════════════════════════════════

import { QL_SERVICE_LINES, QL_WITNESS_KINDS, qlTitleBit, qlClaimOf, qlStepClaimed } from '../../src/net/questlineClaims.js';
import { festivalOpen, QL_STARWARDEN_CAKES } from '../../src/net/festivalLaw.js';
import { isDeveloper } from './titles.js';
import { festivalOpenFor } from './festival.js';

/** The switch the service's config holds (QUESTLINES_OPEN): off, dev (the developers alone), on. */
export const QL_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const qlSwitchOf = (/** @type {any} */ v) => (QL_SWITCH.includes(v) ? v : 'off');
/** Whether the questlines' claim is open to this account: the switch, and at `dev` the developers alone. */
export function questlinesOpenFor(/** @type {any} */ player, /** @type {any} */ env) {
  const s = qlSwitchOf(env?.QUESTLINES_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}

/** The claim's refusals and their statuses. */
export const QL_STATUS = Object.freeze({ 'ql-closed': 403, 'ql-body': 400 });

/** THE WITNESS'S WINDOW (`?1` the account, `?2` the line, `?3` the step): from the LINE's first opening on this account,
 *  newer than the receipt that witnessed an earlier step of the line, older than the one that witnessed a later step -
 *  one receipt, one step, in the line's order (SERVICE-2, SERVICE-5). The floor holds only once the earlier steps are done,
 *  which the end's own order now asks (qlInOrderSql, AUDIT STARFALL B2); the ceiling reads a later step done before that
 *  order was asked (a row acct159-164 wrote). */
const SINCE = 'MAX((SELECT MIN(o.opened_at) FROM ql_steps o WHERE o.account = ?1 AND o.line = ?2), COALESCE((SELECT MAX(p.seen_at) + 1 FROM ql_steps p WHERE p.account = ?1 AND p.line = ?2 AND p.step < ?3), 0))';
const UNTIL = 'COALESCE((SELECT MIN(p.seen_at) FROM ql_steps p WHERE p.account = ?1 AND p.line = ?2 AND p.step > ?3), 9007199254740991)';
/** AN ELITE BREACH'S REDOUBT THAT IS NO REHEARSAL'S - a Rehearsal's Redoubt writes its `eg_redoubts` row (paid 0; eg.js
 *  claimEg), and the house's honours never read one (egHonours.js: `c.rh === 1`). The row carries no `rh` of its own: its
 *  breach's stake does (`eg_stakes.rh`, written at the open, before any Redoubt - whoever opened it), and the account's
 *  end does (`eg_runs.rh`, should the opener's stake be gone with its account). */
const NOT_REHEARSAL = 'NOT EXISTS (SELECT 1 FROM eg_stakes k WHERE k.b = r.b AND k.rh = 1) AND NOT EXISTS (SELECT 1 FROM eg_runs x WHERE x.b = r.b AND x.account = r.account AND x.rh = 1)';

/**
 * WHAT EACH WITNESS READS - the second of the receipt that witnesses the step, or NULL: a scalar over the account
 * (`?1`) inside the line's window (SINCE, UNTIL - `?2` the line, `?3` the step), one receipt table each
 * (questlineClaims.js QL_WITNESS_KINDS) - the earliest such receipt, the third for three:
 *   rite      a Dagon's Breach's rite broken - the rite's own receipt (`earned` 'rite'), or a fighter's that broke it
 *             (accounts.js claimGate: `c.r === 1`, the row's two embers - `stones` 2 is written for nothing else)
 *   breach    a Dagon's Breach closed - a kill's row, never the rite alone
 *   redoubt   an Elite Breach's Redoubt taken, no Rehearsal's
 *   redoubts3 three of them - one row a (breach, account, Redoubt) by eg_redoubts' key, so each row is a distinct (b, w)
 *   valkynaz  a Valkynaz's Redoubt - every fifth (src/net/eliteGates/egPay.js egValkRedoubt: w >= 5, w % 5 = 0)
 *   hour      an Hour broken - a Brass Remnant's row
 *   serpent   the Sea Serpent slain - a serpent's row
 *   star      STAR8: a fallen star held - a star's row (stars.js claimStar: one a (star, account), `at` the claim's second)
 *   stars3    three of them - each row a distinct star by stars_held's key
 *   ketch     KETCH: the Tonal Warden felled - a voyage's row (ketch.js claimKetch: one a (voyage, account), `at` the claim's
 *             second; a share `taken` with another crew writes none - the week's first ship's row is the witness)
 */
const WINDOW = (x) => `${x}.at >= ${SINCE} AND ${x}.at < ${UNTIL}`;
export const QL_WITNESS_SQL = Object.freeze({
  rite: `(SELECT MIN(g.at) FROM gate_kills g WHERE g.account = ?1 AND ${WINDOW('g')} AND (g.earned = 'rite' OR g.stones >= 2))`,
  breach: `(SELECT MIN(g.at) FROM gate_kills g WHERE g.account = ?1 AND ${WINDOW('g')} AND g.earned != 'rite')`,
  redoubt: `(SELECT MIN(r.at) FROM eg_redoubts r WHERE r.account = ?1 AND ${WINDOW('r')} AND ${NOT_REHEARSAL})`,
  redoubts3: `(SELECT r.at FROM eg_redoubts r WHERE r.account = ?1 AND ${WINDOW('r')} AND ${NOT_REHEARSAL} ORDER BY r.at, r.b, r.w LIMIT 1 OFFSET 2)`,
  valkynaz: `(SELECT MIN(r.at) FROM eg_redoubts r WHERE r.account = ?1 AND ${WINDOW('r')} AND r.w >= 5 AND r.w % 5 = 0 AND ${NOT_REHEARSAL})`,
  hour: `(SELECT MIN(d.at) FROM sd_kills d WHERE d.account = ?1 AND ${WINDOW('d')})`,
  serpent: `(SELECT MIN(z.at) FROM serpent_kills z WHERE z.account = ?1 AND ${WINDOW('z')})`,
  star: `(SELECT MIN(s.at) FROM stars_held s WHERE s.account = ?1 AND ${WINDOW('s')})`,
  stars3: `(SELECT s.at FROM stars_held s WHERE s.account = ?1 AND ${WINDOW('s')} ORDER BY s.at, s.star LIMIT 1 OFFSET 2)`,
  ketch: `(SELECT MIN(k.at) FROM ketch_voyages k WHERE k.account = ?1 AND ${WINDOW('k')})`,
});
for (const k of QL_WITNESS_KINDS) if (!QL_WITNESS_SQL[/** @type {keyof typeof QL_WITNESS_SQL} */ (k)]) throw new Error(`questlines.js: no witness for ${k}`);

/** A line witnessed whole on this account's row (`?1`): its title held (SERVICE-4 - the Covens' Hoard's `after`). */
const wholeSql = (lineId) => `(SELECT ql_titles FROM players WHERE id = ?1) & ${qlTitleBit(QL_SERVICE_LINES[/** @type {keyof typeof QL_SERVICE_LINES} */ (lineId)].title)} != 0`;
for (const l of Object.values(QL_SERVICE_LINES)) if ('after' in l && !qlTitleBit(QL_SERVICE_LINES[/** @type {keyof typeof QL_SERVICE_LINES} */ (l.after)]?.title)) throw new Error(`questlines.js: ${l.after} pays no title to be held`);

/** AUDIT STARFALL B2: THE LINE'S ORDER - the witnessed steps of a line before `step`, which its end waits on: every one done
 *  before it is read (qlInOrderSql). The window's floor is the latest of their receipts (SINCE), and a step asked before them
 *  read its window from the line's opening, so one receipt witnessed two steps - QLTF03's three took QLTF01's star, the Weir
 *  Road's three its first Redoubt. Pure. */
export function qlStepsBefore(lineId, step) {
  const l = QL_SERVICE_LINES[/** @type {keyof typeof QL_SERVICE_LINES} */ (lineId)];
  return l ? Object.keys(l.witness).map(Number).filter((s) => s < step).sort((a, b) => a - b) : [];
}
/** B2 in SQL (`?1` the account, `?2` the line): every witnessed step before `step` done on the account's rows - `1` where
 *  there is none. The steps are the law's own whole numbers, never the body's. Pure. */
export function qlInOrderSql(lineId, step) {
  const before = qlStepsBefore(lineId, step);
  return before.length ? `(SELECT COUNT(*) FROM ql_steps b WHERE b.account = ?1 AND b.line = ?2 AND b.step IN (${before.join(', ')}) AND b.done_at IS NOT NULL) = ${before.length}` : '1';
}

/** T-B: THE PURSES - the Soul Cakes a line's title pays beside it (festivalLaw.js), by line. */
export const QL_PURSES = Object.freeze({ thirteenthFrostfall: QL_STARWARDEN_CAKES });

/** The steps a line's title waits on: every witnessed step before its `titleAt`, and `titleAt` itself. Pure. */
export function qlTitleSteps(lineId) {
  const l = QL_SERVICE_LINES[/** @type {keyof typeof QL_SERVICE_LINES} */ (lineId)];
  if (!l) return [];
  return [...Object.keys(l.witness).map(Number).filter((s) => s < l.titleAt), l.titleAt].sort((a, b) => a - b);
}

/**
 * THE CLAIM. An `open`: `{ opened: true }`, any step of a line the service pays. An `end`: `{ witnessed: false }`,
 * `{ witnessed: true, title?, purse?, key?, keys?, keyHeld? }`, `{ why: 'guest' }` for a row with no handle, or `{ why: 'unpaid' }` for a
 * step the service pays nothing. Either: `{ error }` - 'ql-closed' (the switch), 'ql-body' (a body questlineClaims.js
 * qlClaimOf refuses).
 * @param {{ db: any, env?: any }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {any} body @param {number} nowS
 */
export async function claimQl({ db, env = null }, player, body, nowS) {
  if (!questlinesOpenFor(player, env)) return { error: 'ql-closed' };
  const claim = qlClaimOf(body);
  if (!claim) return { error: 'ql-body' };
  const { line, step, phase, choice } = claim;
  /** @type {any} */ const law = QL_SERVICE_LINES[/** @type {keyof typeof QL_SERVICE_LINES} */ (line)];
  const opening = db.prepare('INSERT OR IGNORE INTO ql_steps (account, line, step, opened_at) VALUES (?1, ?2, ?3, ?4)').bind(player.id, line, step, nowS);

  // THE OPENING - the whole of an `open`, a guest's too: it pays nothing and reads nothing (SERVICE-1, SERVICE-6). Every
  // step of a line the service pays is opened, the steps it pays nothing among them: the line's first opening - its
  // first letter - is the witness's window, long before any deed (SERVICE-2)
  if (phase === 'open') { await opening.run(); return { opened: true }; }
  if (!qlStepClaimed(line, step)) return { why: 'unpaid' };
  if (!player?.handle) return { why: 'guest' };

  // THE WITNESS - the step's receipt in the line's window, or its line's `after` witnessed whole; a step with neither is
  // never witnessed (nothing is paid on the client's word). An end whose opening never landed opens the step's row
  // with it - its window is the line's (SERVICE-2)
  const kind = /** @type {keyof typeof QL_WITNESS_SQL | undefined} */ (law.witness[step]);
  const after = law.after ?? null;
  const seen = kind ? QL_WITNESS_SQL[kind] : null;
  const witness = seen ? `${seen} IS NOT NULL` : after ? wholeSql(after) : '0';
  // B2: and in the line's order - every earlier witnessed step done first, so its receipt is this window's floor
  const inOrder = qlInOrderSql(line, step);
  const statements = [
    opening,
    db.prepare(`UPDATE ql_steps SET done_at = ?4, seen_at = ${seen ?? 'NULL'} WHERE account = ?1 AND line = ?2 AND step = ?3 AND done_at IS NULL AND (${witness}) AND ${inOrder}`)
      .bind(player.id, line, step, nowS),
  ];
  // THE CHOICE - the outcome's word, the first a claim of the done step carries (a step done by a claim without one -
  // an opening asked again - takes the next claim's)
  if (choice !== null) {
    statements.push(db.prepare('UPDATE ql_steps SET choice = ?4 WHERE account = ?1 AND line = ?2 AND step = ?3 AND done_at IS NOT NULL AND choice IS NULL').bind(player.id, line, step, choice));
  }
  // THE TITLE - its bit, once, while its steps are all done; T-B: and its purse in the same write, under the same guard,
  // while the festival is open for the account
  const titleSteps = qlTitleSteps(line);
  const titleAt = titleSteps.includes(step) ? statements.length : -1;
  const purse = Object.hasOwn(QL_PURSES, line) && festivalOpenFor(player, env) && festivalOpen(nowS * 1000) ? QL_PURSES[/** @type {keyof typeof QL_PURSES} */ (line)] : 0;
  if (titleAt >= 0) {
    statements.push(db.prepare(`UPDATE players SET ql_titles = ql_titles | ?2, fest_cakes = fest_cakes + ?6 WHERE id = ?1 AND (ql_titles & ?2) = 0
      AND (SELECT COUNT(*) FROM ql_steps WHERE account = ?1 AND line = ?3 AND step IN (SELECT value FROM json_each(?4)) AND done_at IS NOT NULL) = ?5`)
      .bind(player.id, qlTitleBit(law.title), line, JSON.stringify(titleSteps), titleSteps.length, purse));
  }
  // THE KEY - once an account: its step done (behind the Cycle's first line witnessed whole) by an end that KEEPS it -
  // this end's own choice (AUDIT QUESTLINES LINES-4: a first character's `seal` never bars the account's key from a later
  // character who keeps it; the step's `choice` stays the first one said, its record). A keep that finds the key given
  // already is told so (`keyHeld`), never silent.
  const key = law.key ?? null;
  const keyAt = key && key.at === step && choice === key.choice ? statements.length : -1;
  if (keyAt >= 0) {
    statements.push(db.prepare(`UPDATE players SET eg_keys = eg_keys + 1, ql_key = 1 WHERE id = ?1 AND ql_key = 0
      AND EXISTS (SELECT 1 FROM ql_steps WHERE account = ?1 AND line = ?2 AND step = ?3 AND done_at IS NOT NULL)
      RETURNING eg_keys`).bind(player.id, line, step));
  }
  statements.push(db.prepare('SELECT s.done_at, p.ql_key, p.ql_titles FROM ql_steps s JOIN players p ON p.id = s.account WHERE s.account = ?1 AND s.line = ?2 AND s.step = ?3').bind(player.id, line, step));
  const results = await db.batch(statements);
  const row = results.at(-1)?.results?.[0];
  if (row?.done_at == null) return { witnessed: false };
  const titled = titleAt >= 0 && Number(results[titleAt]?.meta?.changes ?? 0) > 0;
  // AUDIT QUESTLINES SERVICE-7 (c): a title step's end answers the line's title held (`titleHeld`) when this claim did not
  // lay it - an answer lost after the commit (a timeout) is asked again, and the retry is how the page hears it; the
  // runner tells it only for a claim whose earlier answer was lost (qlLineRunner.js ask), so it is told once
  const held = titleAt >= 0 && !titled && (Number(row.ql_titles) & qlTitleBit(law.title)) !== 0;
  const keyed = keyAt >= 0 ? results[keyAt]?.results?.[0] : null;
  return {
    witnessed: true,
    ...(titled ? { title: law.title } : held ? { titleHeld: law.title } : {}),
    ...(titled && purse > 0 ? { purse } : {}),
    ...(keyed ? { key: true, keys: Number(keyed.eg_keys) || 0 } : keyAt >= 0 && Number(row.ql_key) === 1 ? { keyHeld: true } : {}),
  };
}
