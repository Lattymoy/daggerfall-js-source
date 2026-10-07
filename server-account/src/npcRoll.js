// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP1 (2026-10-07) — THE ROLL, AS THE SERVICE KEEPS IT: a realm
// character's standing with Daggerfall's own guilds - its reputation with
// the twenty-two guild factions, and the guilds it belongs to.
//
// Mac: "completely overhaul the NPC guild system and reputation system",
// "This is mostly with online in mind", and asked who holds it online,
// "Server-owned". The law and every bound are src/net/npcChapterLaw.js;
// the record is bible/11-Multiplayer/Chapters-Arc.md, section 3.
//
// ═══ ONE CHARACTER, UNDER ITS LEASE ════════════════════════════════
//
// Every act names a realm character of the session's own account, standing
// (never a tombstone), and the lease the playing tab holds (realm.js): an
// old tab, a second device or a replayed request cannot move it, as none
// can checkpoint its save. Nothing here takes a player id from a caller.
//
// ═══ SEEDED ONCE, THEN CLAIMED ═════════════════════════════════════
//
// readRoll answers the Roll, and the first time - no Roll yet - seeds it
// from the standing the client's save holds, under the cap the realm
// character's age names (rollSeedCapOf). Its twenty-two rows land in ONE
// batch beside the head, each INSERT OR IGNORE, so two first reads race
// to one Roll and both are answered with it.
//
// claimRoll takes what moved on the client since its last word - a loss
// whole, a gain under the day's bound (rollCredit) - and the memberships
// as the client holds them now. The credits are decided here, off the
// rows as they stood when read, and written in ONE batch whose first
// statement moves the head's `seq` on from the one read: every write
// after it asks that the head stands at the new `seq` under this claim's
// id, so a claim that lost its race to another writes nothing and is
// answered `roll-busy` (the client asks again), and a claim whose id is
// the head's last is answered as it stands (`repeat`), never credited
// twice.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { isDeveloper } from './titles.js';
import { REALM_ID_RE, LEASE_RE } from './realm.js';
import {
  ROLL_FACTIONS, chaptersSwitchOf, rollRidOf, rollSeedOk, rollDeltasOk, rollMembersOk, rollSeedCapOf, rollSeedOf, rollCredit,
} from '../../src/net/npcChapterLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

/** CHAPTERS_OPEN: the Roll for everyone ("on"), the developers alone ("dev"), or nobody ("off" - the save keeps the
 *  standing, as before CHAP1). */
export function chaptersOpenFor(/** @type {any} */ player, /** @type {any} */ env) {
  const s = chaptersSwitchOf(env?.CHAPTERS_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}

/** The realm character an act names: the account's own, standing, under `lease`. `{ createdAt }` or `{ error }`. */
async function heldUnder(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {unknown} */ character, /** @type {unknown} */ lease) {
  if (typeof character !== 'string' || !REALM_ID_RE.test(character) || typeof lease !== 'string' || !LEASE_RE.test(lease)) return { error: 'body' };
  const row = await db.prepare('SELECT lease, created_at, dead_at FROM realm_characters WHERE id = ? AND player = ?').bind(character, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.dead_at != null) return { error: 'dead' };
  if (row.lease !== lease) return { error: 'lease' };
  return { createdAt: Number(row.created_at) };
}

/** THE ROLL AS IT STANDS: `{ seq, factions: { [id]: rep }, members: [{ f, rank, since }] }`, or null when it has none. */
export async function rollViewOf(/** @type {any} */ db, /** @type {string} */ character) {
  const head = await db.prepare('SELECT seq FROM npc_roll_heads WHERE char_id = ?').bind(character).first();
  if (!head) return null;
  const r = await db.prepare('SELECT faction_id, rep, member, rank, joined_at FROM npc_roll WHERE char_id = ? ORDER BY faction_id').bind(character).all();
  /** @type {Record<number, number>} */
  const factions = {};
  const members = [];
  for (const row of r?.results ?? []) {
    const f = Number(row.faction_id);
    factions[f] = Number(row.rep);
    if (row.member) members.push({ f, rank: Number(row.rank ?? 0), since: Number(row.joined_at) });
  }
  return { seq: Number(head.seq), factions, members };
}

/**
 * THE ROLL, READ - and SEEDED the first time: `body` `{ character, lease, seed?: { factions, members } }`. Answers
 * `{ roll }` (`seeded` when this read made it), `{ roll: null }` for a character with no Roll and no seed, or
 * `{ error }`: 'body', 'no-realm-character', 'dead', 'lease', 'roll-seed' (a seed out of its shape).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string }} player @param {any} body
 */
export async function readRoll({ db, nowS }, player, body) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('readRoll needs an integer epoch-seconds clock');
  const held = await heldUnder(db, player.id, body?.character, body?.lease);
  if ('error' in held) return held;
  const character = /** @type {string} */ (body.character);
  const have = await rollViewOf(db, character);
  if (have) return { roll: have };
  const seed = body?.seed;
  if (seed == null) return { roll: null };
  if (!rollSeedOk(seed?.factions) || !rollMembersOk(seed?.members)) return { error: 'roll-seed' };
  const cap = rollSeedCapOf(held.createdAt);
  const values = rollSeedOf(seed.factions, cap);
  const ranks = new Map(seed.members.map((/** @type {{ f: number, rank: number }} */ m) => [m.f, m.rank]));
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO npc_roll_heads (char_id, player, cap, seq, last_rid, seeded_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?, ?)')
      .bind(character, player.id, cap, nowS, nowS),
    ...ROLL_FACTIONS.map((f) => db.prepare(
      'INSERT OR IGNORE INTO npc_roll (char_id, faction_id, player, rep, gained_day, gained, member, rank, joined_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)',
    ).bind(character, f, player.id, values[f], ranks.has(f) ? 1 : 0, ranks.has(f) ? ranks.get(f) : null, ranks.has(f) ? nowS : null)),
  ]);
  return { roll: await rollViewOf(db, character), seeded: true };
}

/**
 * A CLAIM: `body` `{ character, lease, rid, deltas, members }` - what moved on the client since the Roll's last word
 * (`deltas`, `{ [faction]: change }`, empty when only a membership moved) and the memberships it holds now. Answers
 * `{ roll, credited }` - `credited` what each line actually moved - `{ roll, repeat: true }` for a claim already taken,
 * or `{ error }`: heldUnder's, 'roll-claim' (out of its shape), 'roll-unseeded' (no Roll to claim against: read it
 * first), 'roll-busy' (another claim moved the Roll between this one's read and its write - ask again).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string }} player @param {any} body
 */
export async function claimRoll({ db, nowS }, player, body) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('claimRoll needs an integer epoch-seconds clock');
  const held = await heldUnder(db, player.id, body?.character, body?.lease);
  if ('error' in held) return held;
  const character = /** @type {string} */ (body.character);
  const rid = rollRidOf(body?.rid);
  const deltas = body?.deltas ?? {};
  const empty = deltas && typeof deltas === 'object' && !Array.isArray(deltas) && Object.keys(deltas).length === 0;
  if (!rid || !(empty || rollDeltasOk(deltas)) || !rollMembersOk(body?.members)) return { error: 'roll-claim' };
  const head = await db.prepare('SELECT seq, last_rid FROM npc_roll_heads WHERE char_id = ? AND player = ?').bind(character, player.id).first();
  if (!head) return { error: 'roll-unseeded' };
  if (head.last_rid === rid) return { roll: await rollViewOf(db, character), repeat: true };
  const rows = (await db.prepare('SELECT faction_id, rep, gained_day, gained, member, rank, joined_at FROM npc_roll WHERE char_id = ?')
    .bind(character).all())?.results ?? [];
  const day = utcDay(nowS);
  const seq = Number(head.seq);
  const ranks = new Map(body.members.map((/** @type {{ f: number, rank: number }} */ m) => [m.f, m.rank]));
  // every write past the first stands only while the head is at this claim's own new sequence, under its id
  const guard = 'EXISTS (SELECT 1 FROM npc_roll_heads WHERE char_id = ? AND seq = ? AND last_rid = ?)';
  const stmts = [db.prepare('UPDATE npc_roll_heads SET seq = seq + 1, last_rid = ?, updated_at = ? WHERE char_id = ? AND seq = ?').bind(rid, nowS, character, seq)];
  /** @type {Record<number, number>} */
  const credited = {};
  for (const row of rows) {
    const f = Number(row.faction_id);
    const d = Number(deltas[f] ?? 0);
    let line = { rep: Number(row.rep), gainedDay: Number(row.gained_day), gained: Number(row.gained) };
    if (d) {
      const c = rollCredit(line, d, day);
      credited[f] = c.credited;
      line = c;
    }
    const member = ranks.has(f);
    const rank = member ? ranks.get(f) : null;
    // the tenure: kept while a member stays one, begun the first time the service sees one, ended when it leaves
    const joined = member ? (row.member ? Number(row.joined_at) : nowS) : null;
    if (!d && member === !!row.member && (!member || rank === Number(row.rank))) continue;
    stmts.push(db.prepare(`UPDATE npc_roll SET rep = ?, gained_day = ?, gained = ?, member = ?, rank = ?, joined_at = ? WHERE char_id = ? AND faction_id = ? AND ${guard}`)
      .bind(line.rep, line.gainedDay, line.gained, member ? 1 : 0, rank, joined, character, f, character, seq + 1, rid));
    if (d) {
      stmts.push(db.prepare(`INSERT INTO npc_rep_events (char_id, player, faction_id, asked, credited, rid, at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`)
        .bind(character, player.id, f, d, credited[f], rid, nowS, character, seq + 1, rid));
    }
  }
  const [moved] = await db.batch(stmts);
  if (!moved?.meta?.changes) return { error: 'roll-busy' };
  return { roll: await rollViewOf(db, character), credited };
}
