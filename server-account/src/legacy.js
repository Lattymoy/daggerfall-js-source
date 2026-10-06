// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LEGACY7 (2026-10-06; bible/06-Systems/Legacy-Arc.md section 9) - PROJECT LEGACY ONLINE, SERVICE SIDE. Mac: "online
// integration with permadeath (Bloodline) or non-permadeath (Enduring)".
//
// THE LINE (`lineages`, migration 0084): a family an account founded online, its record the client's JSON - the family
// law is the client's (src/systems/legacy/), and the service keeps the copy every device reads. A write lands only past
// the stored `rev`; a stale one is answered with the stored record, which the client merges its facts into (store.js
// mergeFacts: a death is only ever added) and writes again. The service reads a record for two things alone - the
// person a new realm character is born as, and nothing else.
//
// THE TOMBSTONE (`realm_characters.dead_at`): a Bloodline's death - or an Enduring line's last, its years spent - is
// stamped here under the playing tab's lease. From then the character is never joined, checkpointed or traded again
// (realm.js reads dead_at at each door): an older save cannot be reloaded past a death, which is the whole of
// permadeath's authority. Its roster slot is freed (REALM_CHARACTERS_MAX counts the living) and its record stays.
//
// THE BIRTH OF A MEMBER (realm.js createRealm's `lineage`, `person`): a realm character is born as a person of one of
// the caller's own lines - a living one (never dead, never retired) no realm character has played yet. So a line is
// played online one character a person, and a fallen member's place is never taken by a new character of theirs.
// ═══════════════════════════════════════════════════════════════════

import { houseOfRecord } from '../../src/net/houseLaw.js';   // LEGACY7 part two: the house a member wears online
import { checkName } from '../../src/net/nameFilter.js';   // ...through the name filter, as a guild's name is

/** A family's id, as the client mints it (src/systems/legacy/family.js mintFamilyId). */
export const LINEAGE_ID_RE = /^fam-[0-9a-z]{1,12}-[0-9a-z]{6}$/;
/** A record's bound, in bytes - a family of generations with its remains and news fits in a fraction of it. */
export const LINEAGE_MAX_BYTES = 128 * 1024;
/** The people a record may hold. */
export const LINEAGE_PEOPLE_MAX = 400;
/** The lines an account may hold online. */
export const LINEAGES_MAX = 40;
/** The surname's bound, as the record's. */
export const LINEAGE_SURNAME_MAX = 60;
export const LINEAGE_MODELS = Object.freeze(['bloodline', 'enduring']);

/** A record as the service keeps it: a JSON object of the family's shape for `id` - or null. */
export function lineageRecordOf(/** @type {unknown} */ record, /** @type {string} */ id) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const r = /** @type {any} */ (record);
  if (r.v !== 1 || r.id !== id || !Number.isSafeInteger(r.rev) || r.rev < 1) return null;
  if (!Array.isArray(r.people) || !r.people.length || r.people.length > LINEAGE_PEOPLE_MAX) return null;
  if (typeof r.surname !== 'string' || r.surname.length > LINEAGE_SURNAME_MAX || !LINEAGE_MODELS.includes(r.model)) return null;
  if (!r.people.every((p) => p && typeof p === 'object' && Number.isSafeInteger(p.id) && p.id >= 0)) return null;
  const text = JSON.stringify(r);
  return new TextEncoder().encode(text).byteLength <= LINEAGE_MAX_BYTES ? { text, rev: r.rev, surname: r.surname, model: r.model } : null;
}

const parsed = (/** @type {string} */ text) => { try { return JSON.parse(text); } catch { return null; } };

/** LEGACY7 part two: a line's record (its stored text) read for a member's house - the filter's law as the mint's. */
export function houseOn(/** @type {string} */ recordText, /** @type {unknown} */ personId) {
  const h = Number.isSafeInteger(personId) ? houseOfRecord(parsed(recordText), /** @type {number} */ (personId)) : null;
  if (!h || !checkName(h.hn).ok) return null;
  if (h.hc && !checkName(h.hc).ok) { delete h.hc; delete h.hg; }
  return h;
}

/**
 * LEGACY7 part two: THE HOUSE OF A REALM CHARACTER - what the identity mint signs beside the guild's tag
 * (src/net/houseLaw.js): its line's surname, the member's given name, a Bloodline's mark, the generation's numeral.
 * Null for a character of no line, a tombstone, another account's - and for a name the name filter refuses (the house
 * is shown to every player, as an account's name is: net/nameFilter.js, the chat's and a player's own law).
 * @param {any} ctx @param {string} playerId @param {unknown} id
 */
export async function realmHouseOf({ db }, playerId, id) {
  if (typeof id !== 'string' || !/^r[0-9a-f]{20}$/.test(id)) return null;
  const row = await db.prepare('SELECT r.person_id AS person, l.record AS record FROM realm_characters r JOIN lineages l ON l.player = r.player AND l.id = r.lineage_id'
    + ' WHERE r.id = ? AND r.player = ? AND r.dead_at IS NULL').bind(id, playerId).first();
  return row ? houseOn(row.record, row.person) : null;
}

/** Every line this account holds online, the newest written first: `{ id, surname, model, rev, record }`. */
export async function listLineages({ db }, /** @type {string} */ playerId) {
  const r = await db.prepare('SELECT id, surname, model, rev, record FROM lineages WHERE player = ? ORDER BY updated_at DESC LIMIT ?')
    .bind(playerId, LINEAGES_MAX).all();
  return (r?.results ?? []).map((row) => ({ id: row.id, surname: row.surname, model: row.model, rev: row.rev, record: parsed(row.record) }));
}

/**
 * A LINE WRITTEN - founded, or a newer record of one. Lands only past the stored rev (asked IN the write); a line past
 * LINEAGES_MAX is refused, never one already held. Answers `{ ok, rev }`, `{ error: 'stale', rev, record }` (the stored
 * one, to merge into and write again), or `{ error }`: 'body', 'too-many-lineages'. The model is the founder's, for
 * good: a record that says another is refused ('lineage-model').
 * @param {any} ctx @param {string} playerId @param {{ id: unknown, record: unknown }} at
 */
export async function putLineage({ db, nowS }, playerId, { id, record }) {
  if (!playerId || typeof id !== 'string' || !LINEAGE_ID_RE.test(id)) return { error: 'body' };
  const rec = lineageRecordOf(record, id);
  if (!rec) return { error: 'body' };
  const had = await db.prepare('SELECT rev, model, record FROM lineages WHERE player = ? AND id = ?').bind(playerId, id).first();
  if (had) {
    if (had.model !== rec.model) return { error: 'lineage-model' };
    const moved = await db.prepare('UPDATE lineages SET record = ?, rev = ?, surname = ?, updated_at = ? WHERE player = ? AND id = ? AND rev < ?')
      .bind(rec.text, rec.rev, rec.surname, nowS, playerId, id, rec.rev).run();
    if (moved.meta.changes) return { ok: true, rev: rec.rev };
    const now = await db.prepare('SELECT rev, record FROM lineages WHERE player = ? AND id = ?').bind(playerId, id).first();
    return { error: 'stale', rev: now?.rev ?? had.rev, record: parsed(now?.record ?? had.record) };
  }
  const wrote = await db.prepare(
    'INSERT OR IGNORE INTO lineages (player, id, surname, model, record, rev, created_at, updated_at)'
    + ' SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM lineages WHERE player = ?) < ?',
  ).bind(playerId, id, rec.surname, rec.model, rec.text, rec.rev, nowS, nowS, playerId, LINEAGES_MAX).run();
  if (wrote.meta.changes) return { ok: true, rev: rec.rev };
  // a race founded it between the read and the write - written again as a newer record would be
  return (await db.prepare('SELECT 1 FROM lineages WHERE player = ? AND id = ?').bind(playerId, id).first())
    ? putLineage({ db, nowS }, playerId, { id, record }) : { error: 'too-many-lineages' };
}

/**
 * THE BIRTH'S QUESTION (realm.js createRealm): may a new realm character of this account be born as `person` of the
 * line `lineage`? Of the account's own line; a member of its record (never one wed in, never a minor), living (no
 * death, never retired); no realm
 * character of the account has played them. Answers null, or `{ error }`: 'body', 'no-lineage', 'lineage-person' (no
 * such person, or one dead or retired), 'lineage-played'.
 * @param {any} db @param {string} playerId @param {unknown} lineage @param {unknown} person
 */
export async function lineageBirthRefusal(db, playerId, lineage, person) {
  if (typeof lineage !== 'string' || !LINEAGE_ID_RE.test(lineage) || !Number.isSafeInteger(person) || /** @type {number} */ (person) < 0) return { error: 'body' };
  const row = await db.prepare('SELECT record FROM lineages WHERE player = ? AND id = ?').bind(playerId, lineage).first();
  if (!row) return { error: 'no-lineage' };
  const p = (parsed(row.record)?.people ?? []).find((x) => x?.id === person);
  if (!p || p.died || p.retired != null || (p.kind ?? 'member') !== 'member' || p.minor) return { error: 'lineage-person' };
  const played = await db.prepare('SELECT 1 FROM realm_characters WHERE player = ? AND lineage_id = ? AND person_id = ?').bind(playerId, lineage, person).first();
  return played ? { error: 'lineage-played' } : null;
}

/**
 * THE TOMBSTONE: the playing tab's character is dead for good - stamped under its lease, which goes with it. A second
 * stamp is the first's (idempotent: a retry whose answer was lost). Answers `{ ok, deadAt }` or `{ error }`: 'body',
 * 'no-realm-character', 'lease'.
 * @param {any} ctx @param {string} playerId @param {{ id: unknown, lease: unknown }} at
 */
export async function realmDie({ db, nowS }, playerId, { id, lease }) {
  if (typeof id !== 'string' || !/^r[0-9a-f]{20}$/.test(id) || typeof lease !== 'string' || !/^[0-9a-f]{32}$/.test(lease)) return { error: 'body' };
  const row = await db.prepare('SELECT lease, dead_at FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.dead_at != null) return { ok: true, deadAt: row.dead_at };
  const took = await db.prepare('UPDATE realm_characters SET dead_at = ?, lease = NULL, updated_at = ? WHERE id = ? AND player = ? AND lease = ? AND dead_at IS NULL')
    .bind(nowS, nowS, id, playerId, lease).run();
  if (!took.meta.changes) return { error: 'lease' };
  return { ok: true, deadAt: nowS };
}
