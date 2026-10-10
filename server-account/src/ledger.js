// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT4 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; rebuilt by its audit the same day): THE
// LEDGER OF THE VALUABLE PIECES - which realm record holds each one, so a piece in two records at once is seen.
//
// ═══ WHAT IT CATCHES, AND WHAT IT DOES NOT ═════════════════════════
//
// A piece's key is a crafted piece's provenance (the service minted it - no client can mint a fresh one) or the id its
// first checkpoint stamped (systems/itemIds.js). A copy that keeps its key is seen: a save copied onto another
// character, a dupe a bug of the game made, a piece kept after the service took it. A copy a modified client re-keys is
// a NEW piece to the ledger, and a new piece is a gain the wealth budget charges (budget.js) - the ledger never has to
// catch that one, and never could.
//
// ═══ THE FIRST HOLDER KEEPS IT ═════════════════════════════════════
//
// The record that shows a key first HOLDS it. Another record showing it while the holder still does CLAIMS it - a drop
// picked up, a chest, a peer's hands, none of them witnessed and none needing to be: the holder's next checkpoint
// without it moves it to the claimant. The holder's checkpoint still WITH it, past DUPE_GRACE_S, proves the claim a
// COPY: the claimant counts a duplicate (the row's `dupes`; DUPES_FOR_HOLD of them hold its trade for staff), its copy
// is written down (item_dupes - it moves that piece by no route, and is never charged for it twice), and the holder's
// piece stays the holder's. A crafted piece's copy is told by the craft's own record: the account `products` names its
// owner (a market sale moves it there - market.js), so a seller that kept a sold piece is the copier, never the buyer.
// The audit's two findings this answers: an id stamped on a piece of the victim's took the VICTIM's trade (the holder
// was charged), and a copier sold the contested piece first and the buyer was charged.
//
// A key on a piece that is not what the key was minted for (`fp`, the template and material) is no claim at all: the
// record showing it holds a forged id - a law finding (verdict.js), and the holder never hears of it.
//
// ═══ THE SERVICE'S OWN MOVES ════════════════════════════════════════
//
// A move the service makes - a sale, a vault, a trade, a stake (realm.js prepareRealmRecord, realmTrade.js) - moves
// the ledger in the same batch (ledgerMoves): a piece handed to the service is in ESCROW (no record holds it - one that
// still shows it claims it), one destroyed is let go, one the service hands a record is that record's, whoever showed
// it before. Before a route hands a piece out, the record must hold it, unclaimed and no known copy (piecesRefusal).
//
// ═══ BOUNDED ═══════════════════════════════════════════════════════
//
// A checkpoint is one Worker invocation, and D1 runs at most a thousand queries in one (cron.js FIRING_STATEMENTS_MAX's
// reason). The ledger asks once for every row the character holds or claims, and by key (UID_CHUNK at a time) only for
// keys it did not hear of there; it writes only what changed - a piece held still writes nothing - and writes it many
// rows to a statement; it takes at most LEDGER_NEW_MAX new keys a checkpoint (the rest the next) and reads at most
// LEDGER_KEYS_MAX keys (AUDIT INT: one statement a key, rewritten every checkpoint, failed every save past ~985 keys for
// good, and left an object behind in R2 each time).
// ═══════════════════════════════════════════════════════════════════

import { JUDGE_VERSION } from './judge.js';

/** Copies a character's records have been found holding before its trade is held for staff. */
export const DUPES_FOR_HOLD = 3;
/** How long a claim waits for its holder's checkpoint before the holder's still having the piece proves it a copy - a
 *  checkpoint every two minutes, and one in flight when the claim was made. */
export const DUPE_GRACE_S = 300;
/** How many keys one statement asks about - D1 binds at most 100 a statement. */
export const UID_CHUNK = 90;
/** How many rows one INSERT writes: the four the rows share (?1-?4) and two of each row's own, under D1's hundred. */
export const UPSERT_ROWS = 48;
/** The most new keys one checkpoint takes into the ledger; the rest wait for the next (twenty statements). */
export const LEDGER_NEW_MAX = 960;
/** The most keys one checkpoint reads the ledger for (67 reads at most); a save holding more has the rest unfollowed. */
export const LEDGER_KEYS_MAX = 6000;

const marks = (/** @type {number} */ n, /** @type {number} */ from) => Array.from({ length: n }, (_, i) => `?${from + i}`).join(', ');
/** `[...list]` in slices of `n`. */
const chunks = (/** @type {any[]} */ list, /** @type {number} */ n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n));

/**
 * NEW KEYS WRITTEN, many to a statement: each `[key, fp]` held by `char` (of `player`) since `seq`. `onConflict` is the
 * statement's ending - a checkpoint's DO NOTHING (another record that took the key a moment ago holds it), the service's
 * move a DO UPDATE (the service's word wins).
 * @param {any} db @param {{ player: string, char: string, seq: number, nowS: number }} at @param {[string, string][]} rows @param {string} onConflict
 */
function insertSteps(db, { player, char, seq, nowS }, rows, onConflict) {
  return chunks(rows, UPSERT_ROWS).map((part) => db.prepare(
    `INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES ${part.map((_, i) => `(?${5 + 2 * i}, ?1, ?2, ?3, 'held', ?${6 + 2 * i}, ?4)`).join(', ')} ${onConflict}`,
  ).bind(player, char, seq, nowS, ...part.flat()));
}
/** One statement over `keys` a slice at a time: `sql(marks)` with `binds` first. */
const overKeys = (/** @type {any} */ db, /** @type {string[]} */ keys, /** @type {any[]} */ binds, /** @type {(m: string) => string} */ sql) =>
  chunks(keys, UID_CHUNK).map((part) => db.prepare(sql(marks(part.length, binds.length + 1))).bind(...binds, ...part));

/**
 * THE LEDGER'S STEP for one checkpoint: the pieces the record holds (judge.js ledgerPieces - `{ key, fp }`, repeats kept)
 * against the ledger. Answers `{ steps, copies, forged, charged }` - the statements for the checkpoint's batch; `copies`
 * the keys this record holds twice (each a copy of its own, charged to it); `forged` the keys it shows on another piece
 * than theirs (the verdict's law findings); `charged` how many claims this checkpoint proved copies (charged to their
 * claimants, in `steps`).
 * @param {any} db @param {{ player: string, char: string, seq: number, nowS: number }} at @param {{ key: string, fp: string }[]} pieces
 */
export async function ledgerStep(db, at, pieces) {
  const { char, nowS } = at;
  /** @type {any[]} */
  const steps = [];
  // what the record shows: every key (to know what it let go), and the first LEDGER_KEYS_MAX of them, counted
  const present = new Set(pieces.map((p) => p.key));
  /** @type {Map<string, { fp: string, n: number }>} */
  const shown = new Map();
  for (const p of pieces) {
    const s = shown.get(p.key);
    if (s) s.n++;
    else if (shown.size < LEDGER_KEYS_MAX) shown.set(p.key, { fp: p.fp, n: 1 });
  }
  // what the ledger knows: the rows this character holds or claims, its known copies, and the rest by key
  /** @type {Map<string, any>} */
  const rows = new Map();
  const mine = await db.prepare('SELECT uid, char_id, state, fp, claim_char, claim_at FROM item_uids WHERE char_id = ?1 OR claim_char = ?1').bind(char).all();
  for (const r of mine?.results ?? []) rows.set(r.uid, r);
  const copiesKnown = new Set(((await db.prepare('SELECT uid FROM item_dupes WHERE char_id = ?').bind(char).all())?.results ?? []).map((/** @type {any} */ r) => r.uid));
  for (const part of chunks([...shown.keys()].filter((k) => !rows.has(k) && !copiesKnown.has(k)), UID_CHUNK)) {
    const r = await db.prepare(`SELECT uid, char_id, state, fp, claim_char, claim_at FROM item_uids WHERE uid IN (${marks(part.length, 1)})`).bind(...part).all();
    for (const row of r?.results ?? []) rows.set(row.uid, row);
  }
  /** @type {[string, string][]} */
  const fresh = [];
  /** @type {string[]} */
  const copies = [], forged = [], claim = [], takeUp = [], letGo = [], moveOn = [], withdraw = [];
  /** @type {Map<string, string[]>} the claims proven copies, by claimant */
  const proven = new Map();
  for (const [key, { fp, n }] of shown) {
    if (copiesKnown.has(key)) continue;   // a copy already written down: it moves by no route, and is charged once
    const r = rows.get(key);
    if (r && r.fp !== fp) { forged.push(key); continue; }   // another piece's key: no claim to that piece
    if (n > 1) { copies.push(key); if (!r) fresh.push([key, fp]); continue; }   // one piece twice in one record
    if (!r) { if (fresh.length < LEDGER_NEW_MAX) fresh.push([key, fp]); continue; }
    if (r.char_id === char && r.state === 'held') {
      // mine: a claim on it past its grace, with the piece still here, was a copy - unless the craft's record says the
      // claimant owns it (verdict's crafted check, below)
      if (r.claim_char && r.claim_char !== char && nowS - r.claim_at >= DUPE_GRACE_S) proven.set(r.claim_char, [...(proven.get(r.claim_char) ?? []), key]);
      continue;
    }
    if (r.state === 'gone') { takeUp.push(key); continue; }   // let go, and shown again: taken up
    if (r.claim_char == null) claim.push(key);   // another's, or the service's: claimed - one claim at a time
  }
  for (const r of rows.values()) {
    if (present.has(r.uid)) continue;
    if (r.char_id === char && r.state === 'held') (r.claim_char && r.claim_char !== char ? moveOn : letGo).push(r.uid);
    else if (r.claim_char === char) withdraw.push(r.uid);
  }
  // A CRAFTED PIECE'S CLAIM is settled by its record: the account `products` names owns it, and a holder that is not it
  // kept a piece it sold - the holder is the copier, and the piece goes to the claimant
  /** @type {Map<string, string[]>} the claims the craft's record upholds: the holder's copy, by key */
  const upheld = new Map();
  const crafted = [...proven.values()].flat();
  if (crafted.length) {
    const owners = new Map();
    for (const part of chunks(crafted, UID_CHUNK)) {
      const r = await db.prepare(`SELECT p.provenance, p.owner, c.id AS claimant FROM products p JOIN item_uids u ON u.uid = p.provenance JOIN realm_characters c ON c.id = u.claim_char
        WHERE p.provenance IN (${marks(part.length, 1)}) AND p.owner = c.player AND p.owner != ?${part.length + 1}`).bind(...part, at.player).all();
      for (const row of r?.results ?? []) owners.set(row.provenance, row.claimant);
    }
    for (const [claimant, keys] of proven) {
      const theirs = keys.filter((k) => owners.get(k) === claimant);
      if (!theirs.length) continue;
      upheld.set(claimant, theirs);
      const left = keys.filter((k) => !theirs.includes(k));
      if (left.length) proven.set(claimant, left); else proven.delete(claimant);
    }
  }
  // the writes - only what changed
  steps.push(...insertSteps(db, at, fresh, 'ON CONFLICT (uid) DO NOTHING'));
  if (copies.length) steps.push(...copyRows(db, copies, char, nowS));
  steps.push(...overKeys(db, claim, [char, nowS], (m) => `UPDATE item_uids SET claim_char = ?1, claim_at = ?2 WHERE uid IN (${m}) AND claim_char IS NULL`));
  steps.push(...overKeys(db, takeUp, [at.player, char, at.seq, nowS], (m) => `UPDATE item_uids SET player = ?1, char_id = ?2, seen_seq = ?3, state = 'held', claim_char = NULL, claim_at = NULL, at = ?4 WHERE uid IN (${m}) AND state = 'gone'`));
  steps.push(...overKeys(db, moveOn, [char, nowS], (m) => `UPDATE item_uids SET char_id = claim_char, player = COALESCE((SELECT c.player FROM realm_characters c WHERE c.id = item_uids.claim_char), player),
    claim_char = NULL, claim_at = NULL, at = ?2 WHERE uid IN (${m}) AND char_id = ?1`));
  steps.push(...letGoSteps(db, letGo, char, nowS));
  steps.push(...overKeys(db, withdraw, [char], (m) => `UPDATE item_uids SET claim_char = NULL, claim_at = NULL WHERE uid IN (${m}) AND claim_char = ?1`));
  let charged = 0;
  for (const [claimant, keys] of proven) {
    // the claim was a copy: the claimant's - written down and counted; the piece stays this record's
    steps.push(...overKeys(db, keys, [claimant], (m) => `UPDATE item_uids SET claim_char = NULL, claim_at = NULL WHERE uid IN (${m}) AND claim_char = ?1`));
    steps.push(...copyRows(db, keys, claimant, nowS), ...chargeSteps(db, claimant, keys, nowS));
    charged += keys.length;
  }
  for (const keys of upheld.values()) {
    // the craft's record names the claimant: this record kept a piece it sold - the piece goes, and the copy is this one's
    steps.push(...overKeys(db, keys, [nowS], (m) => `UPDATE item_uids SET char_id = claim_char, player = COALESCE((SELECT c.player FROM realm_characters c WHERE c.id = item_uids.claim_char), player),
      claim_char = NULL, claim_at = NULL, at = ?1 WHERE uid IN (${m})`));
    steps.push(...copyRows(db, keys, char, nowS));
    copies.push(...keys);
  }
  return { steps, copies, forged, charged };
}

/** Copies written down: `keys`, each a copy `char` holds. */
const copyRows = (/** @type {any} */ db, /** @type {string[]} */ keys, /** @type {string} */ char, /** @type {number} */ nowS) =>
  chunks(keys, UPSERT_ROWS).map((part) => db.prepare(`INSERT OR IGNORE INTO item_dupes (uid, char_id, at) VALUES ${part.map((_, i) => `(?${3 + i}, ?1, ?2)`).join(', ')}`).bind(char, nowS, ...part));

/** INT9 (AUDIT): `keys` written down as copies `char` holds - a death's dropped pieces, whose ids the remains carry afresh
 *  (server-account/src/wild.js): never charged, and moved by no route. */
export const knownCopySteps = (/** @type {any} */ db, /** @type {string} */ char, /** @type {string[]} */ keys, /** @type {number} */ nowS) => copyRows(db, keys, char, nowS);

/**
 * AUDIT LW-II-2 S2: A PIECE IN ESCROW THE SERVICE DESTROYED - a patron's purchase (market.js reckonPatrons): no record
 * holds it again, and the ledger was never told (the row stood in escrow, a claim on it waiting for ever, the copy kept
 * and the seller never charged). A claim on it is a record showing a piece the service held - a copy: written down and
 * charged to its claimant as a buyer's checkpoint charges one (copyRows, chargeSteps), the row kept `gone` so the copy
 * never takes it up; no claim, the row goes. `claim` the claimant the row named as the sale read it (null: none) - the
 * row's own step asks that it still does.
 * @param {any} db @param {string} key @param {string | null} claim @param {number} nowS
 */
export function escrowSpentSteps(db, key, claim, nowS) {
  if (!claim) return [db.prepare("DELETE FROM item_uids WHERE uid = ?1 AND state = 'escrow' AND claim_char IS NULL").bind(key)];
  return [
    ...copyRows(db, [key], claim, nowS),
    ...chargeSteps(db, claim, [key], nowS),
    db.prepare("UPDATE item_uids SET state = 'gone', claim_char = NULL, claim_at = NULL, at = ?3 WHERE uid = ?1 AND state = 'escrow' AND claim_char = ?2").bind(key, claim, nowS),
  ];
}

/** Keys `char` let go: no row - or, where a copy of the piece is known, a row kept `gone`, so the copy cannot take it up. */
function letGoSteps(/** @type {any} */ db, /** @type {string[]} */ keys, /** @type {string} */ char, /** @type {number} */ nowS) {
  return [
    ...overKeys(db, keys, [char, nowS], (m) => `UPDATE item_uids SET state = 'gone', claim_char = NULL, claim_at = NULL, at = ?2
      WHERE uid IN (${m}) AND char_id = ?1 AND state = 'held' AND EXISTS (SELECT 1 FROM item_dupes d WHERE d.uid = item_uids.uid)`),
    ...overKeys(db, keys, [char], (m) => `DELETE FROM item_uids WHERE uid IN (${m}) AND char_id = ?1 AND state = 'held'`),
  ];
}

/**
 * A COPY CHARGED to another character's row: its count, its hold at DUPES_FOR_HOLD (never over staff's), its `judge_rev`
 * moved - so a checkpoint of its own in flight writes no verdict over it - and the finding beside it, with the keys.
 * @param {any} db @param {string} char @param {string[]} keys @param {number} nowS
 */
export function chargeSteps(db, char, keys, nowS) {
  return [
    db.prepare(`UPDATE realm_characters SET dupes = dupes + ?2,
      held = CASE WHEN held IN ('staff', 'dupe') THEN held WHEN dupes + ?2 >= ?3 THEN 'dupe' ELSE held END,
      held_at = CASE WHEN held IN ('staff', 'dupe') THEN held_at WHEN dupes + ?2 >= ?3 THEN ?4 ELSE held_at END,
      judge_rev = judge_rev + 1 WHERE id = ?1`).bind(char, keys.length, DUPES_FOR_HOLD, nowS),
    db.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) SELECT player, id, seq, ?2, ?3, 'dupe', ?4 FROM realm_characters WHERE id = ?1")
      .bind(char, nowS, JUDGE_VERSION, JSON.stringify({ keys: keys.slice(0, 40), count: keys.length })),
  ];
}

/**
 * THE LEDGER FOLLOWS A MOVE THE SERVICE MADE on `at.char`'s record, from the pieces it held `before` to those `after`
 * (each judge.js ledgerPieces). Answers `{ left, entered }`, the statements for the move's batch: the pieces gone from
 * the record - in the service's hands (`escrow`: a listing, a vault, a stake) or no one's (spent, destroyed) - and the
 * pieces come into it, this record's whoever held them (the service's word). A batch moving two records runs both
 * records' `left` before either's `entered` (realmTrade.js), so a piece passing between them lands where it went.
 * @param {any} db @param {{ player: string, char: string, seq: number, nowS: number }} at
 * @param {{ key: string, fp: string }[]} before @param {{ key: string, fp: string }[]} after @param {{ escrow?: boolean }} [o]
 */
export function ledgerMoves(db, at, before, after, { escrow = false } = {}) {
  const was = new Map(before.map((p) => [p.key, p.fp]));
  const now = new Map(after.map((p) => [p.key, p.fp]));
  const gone = [...was.keys()].filter((k) => !now.has(k));
  /** @type {[string, string][]} */
  const came = [...now].filter(([k]) => !was.has(k));
  const left = escrow
    ? overKeys(db, gone, [at.char, at.nowS], (m) => `UPDATE item_uids SET state = 'escrow', char_id = '', claim_char = NULL, claim_at = NULL, at = ?2 WHERE uid IN (${m}) AND char_id = ?1 AND state = 'held'`)
    : letGoSteps(db, gone, at.char, at.nowS);
  const entered = [
    ...insertSteps(db, at, came, `ON CONFLICT (uid) DO UPDATE SET player = excluded.player, char_id = excluded.char_id, seen_seq = excluded.seen_seq,
      state = 'held', fp = excluded.fp, claim_char = CASE WHEN item_uids.claim_char = excluded.char_id THEN NULL ELSE item_uids.claim_char END,
      claim_at = CASE WHEN item_uids.claim_char = excluded.char_id THEN NULL ELSE item_uids.claim_at END, at = excluded.at`),
    // a piece the service hands a record is never that record's known copy
    ...overKeys(db, came.map(([k]) => k), [at.char], (m) => `DELETE FROM item_dupes WHERE char_id = ?1 AND uid IN (${m})`),
  ];
  return { left, entered };
}

/**
 * BEFORE A ROUTE HANDS PIECES OUT of `char`'s record: each must be the record's to give - held by it, no claim on it,
 * and no copy of it written down against it. Answers null, 'piece-dupe' (another's, the service's or a known copy - it
 * moves by no route) or 'piece-claimed' (two records show it, and the holder's next checkpoint settles whose it is).
 * A key the ledger has never heard of is the record's (its first checkpoint since takes it).
 * @param {any} db @param {string} char @param {string[]} keys
 */
export async function piecesRefusal(db, char, keys) {
  for (const part of chunks(keys, UID_CHUNK)) {
    const m = marks(part.length, 2);
    const copy = await db.prepare(`SELECT 1 FROM item_dupes WHERE char_id = ?1 AND uid IN (${m}) LIMIT 1`).bind(char, ...part).first();
    if (copy) return 'piece-dupe';
    const r = await db.prepare(`SELECT char_id, state, claim_char FROM item_uids WHERE uid IN (${m}) AND (char_id != ?1 OR state != 'held' OR claim_char IS NOT NULL)`).bind(char, ...part).all();
    const rows = r?.results ?? [];
    // a claim waiting - on my piece, or mine on another's (a piece picked up, its holder not yet checkpointed) - settles
    // on its own; anything else is not mine to give
    const waiting = (/** @type {any} */ x) => (x.char_id === char && x.state === 'held') || x.claim_char === char;
    if (rows.some((/** @type {any} */ x) => !waiting(x))) return 'piece-dupe';
    if (rows.length) return 'piece-claimed';
  }
  return null;
}

/** INT9: WHICH OF `keys` MAY NOT LEAVE `char`'s record - piecesRefusal's own law, key by key: a copy, another's piece, a
 *  claim that is not this record's own waiting. A death in the zone drops every other piece (server-account/src/wild.js),
 *  never refused whole on one. Answers a Set. */
export async function piecesBarred(db, char, keys) {
  const out = new Set();
  for (const part of chunks(keys, UID_CHUNK)) {
    const m = marks(part.length, 2);
    const copies = await db.prepare(`SELECT uid FROM item_dupes WHERE char_id = ?1 AND uid IN (${m})`).bind(char, ...part).all();
    for (const x of copies?.results ?? []) out.add(/** @type {any} */ (x).uid);
    const r = await db.prepare(`SELECT uid, char_id, state, claim_char FROM item_uids WHERE uid IN (${m}) AND (char_id != ?1 OR state != 'held' OR claim_char IS NOT NULL)`).bind(char, ...part).all();
    for (const x of /** @type {any[]} */ (r?.results ?? [])) out.add(x.uid);
  }
  return out;
}

/**
 * A CHARACTER GONE (dead, retired, deleted - legacy.js, realm.js deleteRealm): its claims withdrawn, and what it held let
 * go - an heir, a looter or a friend takes it up next. `deleted`: its copies' record goes too.
 * @param {any} db @param {string} char @param {number} nowS @param {{ deleted?: boolean }} [o]
 */
export function releaseSteps(db, char, nowS, { deleted = false } = {}) {
  return [
    db.prepare('UPDATE item_uids SET claim_char = NULL, claim_at = NULL WHERE claim_char = ?1').bind(char),
    db.prepare(`UPDATE item_uids SET state = 'gone', claim_char = NULL, claim_at = NULL, at = ?2
      WHERE char_id = ?1 AND state = 'held' AND EXISTS (SELECT 1 FROM item_dupes d WHERE d.uid = item_uids.uid)`).bind(char, nowS),
    db.prepare("DELETE FROM item_uids WHERE char_id = ?1 AND state = 'held'").bind(char),
    ...(deleted ? [db.prepare('DELETE FROM item_dupes WHERE char_id = ?1').bind(char)] : []),
  ];
}
