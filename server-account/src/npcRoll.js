// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP1 (2026-10-07) — THE ROLL, AS THE SERVICE KEEPS IT: a realm
// character's standing with Daggerfall's own guilds - its reputation with
// the twenty-two guild factions, and the guilds it belongs to.
//
// Mac: "completely overhaul the NPC guild system and reputation system",
// "This is mostly with online in mind", and asked who holds it online,
// "Server-owned". The law and every bound are src/net/npcChapterLaw.js;
// the record is bible/11-Multiplayer/Chapters-Arc.md, section 3, and its
// audit bible/01-Overview/Audit-Chapters.md (AUDIT CHAP).
//
// ═══ ONE CHARACTER, UNDER ITS LEASE, IN THE WRITE ITSELF ═══════════
//
// Every act names a realm character of the session's own account,
// standing (never a tombstone), whose first save has landed, under the
// lease the playing tab holds (realm.js). AUDIT CHAP S4: that is asked
// TWICE - once before anything is read, to say why an act is refused, and
// again INSIDE the write (HELD_SQL on its first statement), so a lease
// another tab took, or a death, between the read and the write moves
// nothing. Nothing here takes a player id from a caller.
//
// ═══ EVERY WRITE UNDER A TAG OF ITS OWN ════════════════════════════
//
// A write is one batch - D1 runs a batch as one transaction - whose first
// statement moves the head's `seq` on from the one read AND sets a `tag`
// minted for this write alone; every other statement of the batch asks
// that the head carries that tag. So a write that lost its race writes
// nothing at all - AUDIT CHAP S1: the guard asked for the next `seq` under
// the claim's id, and a twin of the claim (the same id, sent twice at
// once) found the winner's head standing exactly so, and wrote its lines
// a second time. The loser is told why: its lease or its death (the
// write's own check), a repeat (its id taken), or `roll-busy`.
//
// ═══ SEEDED ONCE, CLAIMED, PAID AT THE DAY'S PACE ══════════════════
//
// readRoll answers the Roll, and the first time - no Roll yet - seeds it
// from the standing the client's save holds, under the cap the character's
// own row names (rollSeedCapOf), its head and twenty-two rows in one batch.
// A read also pays what is owed, as far as the day's room goes (rollDrain).
//
// claimRoll takes what moved on the client since its last word - a loss
// whole (from what is owed first), a gain under the day's net room and
// the rest owed (rollCredit) - and the memberships as the client holds
// them now (null: unchanged), each rank never past what the Roll's own
// reputation allows, nor past 7 - CHAP4a: 8 and 9 are seats
// (rollBookRankOf). A claim whose id was taken - the
// head's last, or any line of the record (AUDIT CHAP S6) - is answered as
// it stands, never credited twice; a claim that changes nothing writes
// nothing (S7).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { isDeveloper } from './titles.js';
import { REALM_ID_RE, LEASE_RE } from './realm.js';
import {
  ROLL_FACTIONS, ROLL_EVENTS_KEEP_S, chaptersSwitchOf, rollRidOf, rollSeedOk, rollDeltasOk, rollMembersOk, rollSeedCapOf, rollSeedOf,
  rollCredit, rollDrain, rollBookRankOf, joinRecordable, ROLL_CLAIMS_HOUR,
} from '../../src/net/npcChapterLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { overRate } from './accounts.js';   // AUDIT CHAP2 E2: the claims' own hour

/** CHAPTERS_OPEN: the Roll for everyone ("on"), the developers alone ("dev"), or nobody ("off" - the save keeps the
 *  standing, as before CHAP1). */
export function chaptersOpenFor(/** @type {any} */ player, /** @type {any} */ env) {
  const s = chaptersSwitchOf(env?.CHAPTERS_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}

/** The realm character a write may move: the account's own, standing, under the lease - asked INSIDE the write
 *  (`?` character, `?` player, `?` lease). */
const HELD_SQL = 'EXISTS (SELECT 1 FROM realm_characters WHERE id = ? AND player = ? AND lease = ? AND dead_at IS NULL)';
/** Every statement after a write's first stands only while the head carries the write's own tag (`?` character, `?` tag). */
const TAGGED_SQL = 'EXISTS (SELECT 1 FROM npc_roll_heads WHERE char_id = ? AND tag = ?)';

/** A write's own tag: eight random bytes, hex. */
function mintTag(/** @type {((b: Uint8Array) => Uint8Array) | undefined} */ rand) {
  const draw = rand ?? ((b) => globalThis.crypto.getRandomValues(b));
  let out = '';
  for (const x of draw(new Uint8Array(8))) out += x.toString(16).padStart(2, '0');
  return out;
}

/** The realm character an act names: the account's own, standing, its first save landed, under `lease`. `{ createdAt,
 *  origin }` or `{ error }`: 'body', 'no-realm-character', 'dead', 'lease', 'no-data' (AUDIT CHAP S3: no Roll before the
 *  realm holds a save of it - a customs never landed is undone whole). */
async function heldUnder(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {unknown} */ character, /** @type {unknown} */ lease) {
  if (typeof character !== 'string' || !REALM_ID_RE.test(character) || typeof lease !== 'string' || !LEASE_RE.test(lease)) return { error: 'body' };
  const row = await db.prepare('SELECT lease, created_at, dead_at, origin_id, bytes FROM realm_characters WHERE id = ? AND player = ?').bind(character, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.dead_at != null) return { error: 'dead' };
  if (row.lease !== lease) return { error: 'lease' };
  if (!(Number(row.bytes) > 0)) return { error: 'no-data' };
  return { createdAt: Number(row.created_at), origin: row.origin_id ?? null };
}

/**
 * @typedef {{ rep: number, gainedDay: number, gained: number, owed: number, member: boolean, rank: number | null, joinedAt: number | null }} RollRow
 */
/** The character's twenty-two rows as they stand, by faction. */
async function rowsOf(/** @type {any} */ db, /** @type {string} */ character) {
  const r = await db.prepare('SELECT faction_id, rep, gained_day, gained, owed, member, rank, joined_at FROM npc_roll WHERE char_id = ?').bind(character).all();
  /** @type {Map<number, RollRow>} */
  const rows = new Map();
  for (const x of r?.results ?? []) {
    rows.set(Number(x.faction_id), {
      rep: Number(x.rep), gainedDay: Number(x.gained_day), gained: Number(x.gained), owed: Number(x.owed),
      member: !!x.member, rank: x.rank == null ? null : Number(x.rank), joinedAt: x.joined_at == null ? null : Number(x.joined_at),
    });
  }
  return rows;
}

/** THE ROLL AS AN ANSWER: `{ seq, factions: { [id]: rep }, owed: { [id]: n } (the owed alone), members: [{ f, rank,
 *  since }] }`, off rows in hand - read, or just written (AUDIT CHAP S7: never read again after a write). AUDIT CHAP2 C1:
 *  `seq` is the CLAIM sequence (the head's `kseq`) - moved only by a claim that credits a line the client sent, never by
 *  the service's own credits (a drain, a hall writ), so a tab's kept adoption still stands after them. */
function viewOf(/** @type {number} */ seq, /** @type {Map<number, RollRow>} */ rows) {
  /** @type {Record<number, number>} */
  const factions = {};
  /** @type {Record<number, number>} */
  const owed = {};
  const members = [];
  for (const f of [...rows.keys()].sort((a, b) => a - b)) {
    const row = /** @type {RollRow} */ (rows.get(f));
    factions[f] = row.rep;
    if (row.owed > 0) owed[f] = row.owed;
    if (row.member) members.push({ f, rank: row.rank ?? 0, since: row.joinedAt });
  }
  return { seq, factions, owed, members };
}

/** THE ROLL AS IT STANDS, read: its view, or null when it has none. */
export async function rollViewOf(/** @type {any} */ db, /** @type {string} */ character) {
  const head = await db.prepare('SELECT kseq FROM npc_roll_heads WHERE char_id = ?').bind(character).first();
  return head ? viewOf(Number(head.kseq), await rowsOf(db, character)) : null;
}

/** One row's UPDATE, standing only under the write's tag. */
const rowWrite = (/** @type {any} */ db, /** @type {string} */ character, /** @type {number} */ f, /** @type {RollRow} */ r, /** @type {string} */ tag) =>
  db.prepare(`UPDATE npc_roll SET rep = ?, gained_day = ?, gained = ?, owed = ?, member = ?, rank = ?, joined_at = ? WHERE char_id = ? AND faction_id = ? AND ${TAGGED_SQL}`)
    .bind(r.rep, r.gainedDay, r.gained, r.owed, r.member ? 1 : 0, r.rank, r.joinedAt, character, f, character, tag);
/** The head moved on from `seq` under a write's tag (and `rid`, a claim's id, where one is taken; `claimed`, the claim
 *  sequence moved with it, where a claim credits a line - AUDIT CHAP2 C1) - while the character is still the caller's,
 *  standing, under its lease. */
const headWrite = (/** @type {any} */ db, /** @type {{ character: string, player: string, lease: string }} */ who, /** @type {number} */ seq,
  /** @type {string} */ tag, /** @type {number} */ nowS, /** @type {string | null} */ rid = null, claimed = false) =>
  db.prepare(`UPDATE npc_roll_heads SET seq = seq + 1, kseq = kseq + ?, tag = ?, last_rid = COALESCE(?, last_rid), updated_at = ? WHERE char_id = ? AND seq = ? AND ${HELD_SQL}`)
    .bind(claimed ? 1 : 0, tag, rid, nowS, who.character, seq, who.character, who.player, who.lease);
const same = (/** @type {RollRow} */ a, /** @type {RollRow} */ b) => a.rep === b.rep && a.gainedDay === b.gainedDay && a.gained === b.gained
  && a.owed === b.owed && a.member === b.member && a.rank === b.rank && a.joinedAt === b.joinedAt;

/**
 * THE ROLL, READ - SEEDED the first time, and what is owed PAID: `body` `{ character, lease, seed?: { factions, members } }`.
 * Answers `{ roll, from, seeded? }` - `from` the Roll's sequence before this read moved it (a client's kept standing is
 * good only at that sequence), `seeded` when this read's seed made the Roll - `{ roll: null }` for a character with no
 * Roll and no seed, or `{ error }`: heldUnder's, 'roll-seed' (a seed out of its shape), 'roll-busy' (a race lost).
 * @param {{ db: any, nowS: number, rand?: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string }} player @param {any} body
 */
export async function readRoll({ db, nowS, rand }, player, body) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('readRoll needs an integer epoch-seconds clock');
  const held = await heldUnder(db, player.id, body?.character, body?.lease);
  if ('error' in held) return held;
  const who = { character: /** @type {string} */ (body.character), player: player.id, lease: /** @type {string} */ (body.lease) };
  const head = await db.prepare('SELECT seq, kseq FROM npc_roll_heads WHERE char_id = ?').bind(who.character).first();
  if (head) {
    const seq = Number(head.seq), kseq = Number(head.kseq);
    const rows = await rowsOf(db, who.character);
    const day = utcDay(nowS);
    /** @type {Array<[number, RollRow]>} */
    const paid = [];
    for (const [f, row] of rows) {
      if (!(row.owed > 0)) continue;
      const d = rollDrain(row, day);
      if (d.credited !== 0 || d.owed !== row.owed) paid.push([f, { ...row, rep: d.rep, gainedDay: d.gainedDay, gained: d.gained, owed: d.owed }]);
    }
    if (!paid.length) return { roll: viewOf(kseq, rows), from: kseq };
    const tag = mintTag(rand);
    const [moved] = await db.batch([headWrite(db, who, seq, tag, nowS), ...paid.map(([f, r]) => rowWrite(db, who.character, f, r, tag))]);
    if (!moved?.meta?.changes) {
      const why = await heldUnder(db, player.id, who.character, who.lease);
      return 'error' in why ? why : { error: 'roll-busy' };
    }
    for (const [f, r] of paid) rows.set(f, r);
    return { roll: viewOf(kseq, rows), from: kseq };   // AUDIT CHAP2 C1: owed paid is the service's own credit
  }
  const seed = body?.seed;
  if (seed == null) return { roll: null };
  if (!rollSeedOk(seed?.factions) || !(seed?.members === null || rollMembersOk(seed?.members))) return { error: 'roll-seed' };
  const cap = rollSeedCapOf(held);
  /** @type {Map<number, number>} */
  const reported = new Map((seed.members ?? []).map((/** @type {{ f: number, rank: number }} */ m) => [m.f, m.rank]));
  const values = rollSeedOf(seed.factions, cap, reported);
  const tag = mintTag(rand);
  /** @type {Map<number, RollRow>} */
  const rows = new Map();
  for (const f of ROLL_FACTIONS) {
    const member = reported.has(f);
    rows.set(f, {
      rep: values[f], gainedDay: 0, gained: 0, owed: 0, member,
      rank: member ? rollBookRankOf(reported.get(f), values[f]) : null, joinedAt: member ? nowS : null,   // CHAP4a: never a seat's rank
    });
  }
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO npc_roll_heads (char_id, player, cap, seq, last_rid, tag, seeded_at, updated_at) SELECT ?, ?, ?, 0, NULL, ?, ?, ? WHERE ${HELD_SQL}`)
      .bind(who.character, player.id, cap, tag, nowS, nowS, who.character, who.player, who.lease),
    ...[...rows].map(([f, r]) => db.prepare(
      `INSERT OR IGNORE INTO npc_roll (char_id, faction_id, player, rep, gained_day, gained, owed, member, rank, joined_at) SELECT ?, ?, ?, ?, 0, 0, 0, ?, ?, ? WHERE ${TAGGED_SQL}`,
    ).bind(who.character, f, player.id, r.rep, r.member ? 1 : 0, r.rank, r.joinedAt, who.character, tag)),
  ]);
  const after = await db.prepare('SELECT tag FROM npc_roll_heads WHERE char_id = ?').bind(who.character).first();
  if (!after) {
    const why = await heldUnder(db, player.id, who.character, who.lease);
    return 'error' in why ? why : { error: 'roll-busy' };
  }
  // AUDIT CHAP S8: `seeded` only for the seed that made the Roll - a seed that lost its race to another is answered with
  // the winner's Roll, as a read
  if (after.tag === tag) return { roll: viewOf(0, rows), from: 0, seeded: true };
  const won = await rollViewOf(db, who.character);
  return { roll: won, from: won?.seq ?? 0 };
}

/**
 * A CLAIM: `body` `{ character, lease, rid, deltas, members }` - what moved on the client since the Roll's last word
 * (`deltas`, `{ [faction]: change }`, empty when only a membership moved) and the memberships it holds now (null: no book
 * known - the Roll's stand unchanged). Answers `{ roll, credited }` - `credited` what each line's own change moved the
 * reputation (what the day's room did not take is owed: `roll.owed`) - `{ roll, repeat: true }` for a claim already
 * taken, or `{ error }`: heldUnder's, 'roll-claim' (out of its shape), 'roll-unseeded' (no Roll to claim against: read it
 * first), 'roll-busy' (another write moved the Roll between this one's read and its write - ask again).
 * @param {{ db: any, nowS: number, rand?: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string }} player @param {any} body
 */
export async function claimRoll({ db, nowS, rand }, player, body) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('claimRoll needs an integer epoch-seconds clock');
  const held = await heldUnder(db, player.id, body?.character, body?.lease);
  if ('error' in held) return held;
  const who = { character: /** @type {string} */ (body.character), player: player.id, lease: /** @type {string} */ (body.lease) };
  const rid = rollRidOf(body?.rid);
  const deltas = body?.deltas ?? {};
  const empty = deltas && typeof deltas === 'object' && !Array.isArray(deltas) && Object.keys(deltas).length === 0;
  const members = body?.members;
  if (!rid || !(empty || rollDeltasOk(deltas)) || !(members === null || rollMembersOk(members))) return { error: 'roll-claim' };
  // AUDIT CHAP2 E2: THE CLAIMS' HOUR, the service's own - the tab's minute was the client's word alone, and a client
  // sending ±1 on all twenty-two as fast as the account's door allowed wrote 22 record lines a claim. An honest tab sends
  // sixty an hour at most, and a hall writ's refresh three a day
  if (await overRate({ db, nowS }, `roll-claim:${who.character}`, ROLL_CLAIMS_HOUR, 3600)) return { error: 'roll-rate' };
  const head = await db.prepare('SELECT seq, kseq, last_rid FROM npc_roll_heads WHERE char_id = ? AND player = ?').bind(who.character, player.id).first();
  if (!head) return { error: 'roll-unseeded' };
  const seq = Number(head.seq), kseq = Number(head.kseq);
  const rows = await rowsOf(db, who.character);
  // AUDIT CHAP S6: a repeat is the head's last id, or any id the record still holds - an older claim replayed after a
  // newer one is the same claim
  const taken = head.last_rid === rid
    || !!(await db.prepare('SELECT 1 FROM npc_rep_events WHERE char_id = ? AND rid = ? LIMIT 1').bind(who.character, rid).first());
  if (taken) return { roll: viewOf(kseq, rows), repeat: true };
  const day = utcDay(nowS);
  /** @type {Map<number, number> | null} */
  const ranks = members === null ? null : new Map(members.map((/** @type {{ f: number, rank: number }} */ m) => [m.f, m.rank]));
  /** @type {Record<number, number>} */
  const credited = {};
  /** @type {Array<[number, RollRow, number]>} the rows that change, and the line each was asked */
  const changed = [];
  for (const [f, row] of rows) {
    let line = row;
    if (row.owed > 0) {
      const d = rollDrain(line, day);
      line = { ...line, rep: d.rep, gainedDay: d.gainedDay, gained: d.gained, owed: d.owed };
    }
    const asked = Number(deltas[f] ?? 0);
    if (asked) {
      const c = rollCredit(line, asked, day);
      credited[f] = c.credited;
      line = { ...line, rep: c.rep, gainedDay: c.gainedDay, gained: c.gained, owed: c.owed };
    }
    if (ranks) {
      // CHAP2a (AUDIT CHAP R1's line, Mac: "Approved"): a NEW membership is recorded only where the Roll's own standing
      // with the guild meets DFU's join (`joinRecordable` - AUDIT CHAP2 S7: what it owes counted; D2: the underworld two
      // at any standing) - one already on the Roll stays, whatever its standing since
      const member = ranks.has(f) && (row.member || joinRecordable(line.rep + line.owed, f));
      // the tenure: kept while a member stays one, begun the first time the service sees one, ended when it leaves; the
      // rank never past what the Roll's own reputation allows (AUDIT CHAP S5), nor past the book's 7 (CHAP4a: 8 and 9 are
      // seats, Chapters-Arc 3.5)
      line = {
        ...line, member,
        rank: member ? rollBookRankOf(ranks.get(f), line.rep) : null,
        joinedAt: member ? (row.member ? row.joinedAt : nowS) : null,
      };
    } else if (line.member && line.rank != null && line.rank > rollBookRankOf(line.rank, line.rep)) {
      // AUDIT CHAP2 E8: a claim with no book still never leaves a recorded rank past what the Roll's reputation allows
      line = { ...line, rank: rollBookRankOf(line.rank, line.rep) };
    }
    if (!same(line, row)) changed.push([f, line, asked]);
  }
  if (!changed.length) return { roll: viewOf(kseq, rows), credited };   // AUDIT CHAP S7: nothing moved, nothing written
  const tag = mintTag(rand);
  const lines = changed.filter(([, , asked]) => asked);
  // AUDIT CHAP2 S6: every claim that writes leaves its id in the record - one with no reputation line (a membership's
  // move, owed paid) a line of faction 0 - so an older claim replayed after it is a repeat however it was shaped
  const record = lines.length ? lines.map(([f, , asked]) => [f, asked, credited[f]]) : [[0, 0, 0]];
  const [moved] = await db.batch([
    headWrite(db, who, seq, tag, nowS, rid, lines.length > 0),
    ...changed.map(([f, r]) => rowWrite(db, who.character, f, r, tag)),
    ...record.map(([f, asked, cr]) => db.prepare(`INSERT INTO npc_rep_events (char_id, player, faction_id, asked, credited, rid, at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${TAGGED_SQL}`)
      .bind(who.character, player.id, f, asked, cr, rid, nowS, who.character, tag)),
    // AUDIT CHAP S7: the record is kept ROLL_EVENTS_KEEP_S, pruned by the character's own claims
    db.prepare(`DELETE FROM npc_rep_events WHERE char_id = ? AND at < ? AND ${TAGGED_SQL}`).bind(who.character, nowS - ROLL_EVENTS_KEEP_S, who.character, tag),
  ]);
  if (!moved?.meta?.changes) {
    const why = await heldUnder(db, player.id, who.character, who.lease);
    if ('error' in why) return why;
    const now = await db.prepare('SELECT seq, last_rid FROM npc_roll_heads WHERE char_id = ?').bind(who.character).first();
    if (now?.last_rid === rid) return { roll: await rollViewOf(db, who.character), repeat: true };   // its twin landed first
    return { error: 'roll-busy' };
  }
  for (const [f, r] of changed) rows.set(f, r);
  return { roll: viewOf(kseq + (lines.length > 0 ? 1 : 0), rows), credited };
}
