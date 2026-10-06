// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LEGACY7 (2026-10-06; bible/06-Systems/Legacy-Arc.md section 9) - PROJECT LEGACY ONLINE, SERVICE SIDE. Mac: "online
// integration with permadeath (Bloodline) or non-permadeath (Enduring)".
//
// THE LINE (`lineages`, migration 0084): a family an account founded online, its record the client's JSON - the family
// law is the client's (src/systems/legacy/), and the service keeps the copy every device reads. A write lands only on
// the copy it was made from (`base`, the stored rev the device last read - AUDIT LEGACY III A2, the realm's half) and
// past it; a stale one is answered with the stored record, which the client merges its facts into (store.js
// mergeFacts: a death is only ever added) and writes again. The service reads a record for what it must answer itself:
// the person a new realm character is born as, the house a realm character wears (the mint's token, the roster's tile, a
// wedding's card) - and the deaths a write adds (AUDIT LEGACY III W2: a member of the line whose realm character still
// stood is tombstoned by the write that first says it).
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
import { ID_RE, REALM_CHARACTER_RE } from '../../src/net/identityToken.js';   // LEGACY7 part three: the other's account, by the token's own shape; AUDIT LEGACY III O1: and its realm character
import { guildMemberDead } from './guilds.js';   // AUDIT LEGACY III O5: a tombstone's guild seat handed on

/** A family's id, as the client mints it (src/systems/legacy/family.js mintFamilyId). */
export const LINEAGE_ID_RE = /^fam-[0-9a-z]{1,12}-[0-9a-z]{6}$/;
/** A record's bound, in bytes. A played member costs some four kilobytes (their standing, their look, their career);
 *  a line of a dozen generations, its spouses and children, fits in it (AUDIT LEGACY III P1 measured it). */
export const LINEAGE_MAX_BYTES = 128 * 1024;
/** AUDIT LEGACY III O2/P1: THE LINEAGE ROUTE'S OWN BODY BOUND - a record at its bound and the write's envelope. Every
 *  other JSON route reads 4 KiB (service.js MAX_BODY_BYTES), and the line's route read the same: a played founder's
 *  first save passed it, and from then the realm held the founding copy for good (every write refused 'body', its
 *  heirs never born online). */
export const LINEAGE_BODY_MAX = LINEAGE_MAX_BYTES + 1024;
/** The people a record may hold. */
export const LINEAGE_PEOPLE_MAX = 400;
/** The lines an account may hold online. */
export const LINEAGES_MAX = 40;
/** The surname's bound, as the record's. */
export const LINEAGE_SURNAME_MAX = 60;
export const LINEAGE_MODELS = Object.freeze(['bloodline', 'enduring']);

/** A record's shape and its size in bytes, whatever the size - or null. */
function recordShapeOf(/** @type {unknown} */ record, /** @type {string} */ id) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const r = /** @type {any} */ (record);
  if (r.v !== 1 || r.id !== id || !Number.isSafeInteger(r.rev) || r.rev < 1) return null;
  if (!Array.isArray(r.people) || !r.people.length || r.people.length > LINEAGE_PEOPLE_MAX) return null;
  if (typeof r.surname !== 'string' || r.surname.length > LINEAGE_SURNAME_MAX || !LINEAGE_MODELS.includes(r.model)) return null;
  if (!r.people.every((p) => p && typeof p === 'object' && Number.isSafeInteger(p.id) && p.id >= 0)) return null;
  const text = JSON.stringify(r);
  return { text, rev: r.rev, surname: r.surname, model: r.model, bytes: new TextEncoder().encode(text).byteLength };
}
/** A record as the service keeps it: a JSON object of the family's shape for `id`, within its bound - or null. */
export function lineageRecordOf(/** @type {unknown} */ record, /** @type {string} */ id) {
  const r = recordShapeOf(record, id);
  return r && r.bytes <= LINEAGE_MAX_BYTES ? { text: r.text, rev: r.rev, surname: r.surname, model: r.model } : null;
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
  if (typeof id !== 'string' || !REALM_CHARACTER_RE.test(id)) return null;
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
 * A LINE WRITTEN - founded, or a newer record of one. AUDIT LEGACY III A2 (the realm's half): lands only on the copy it
 * was made from - `base`, the stored rev the device last read (the list's, its last write's, or the stale answer's) -
 * and past it, both asked IN the write. A copy made from an older one is stale whatever its own rev says: a device that
 * touched its copy twice ran its counter past the stored one without ever reading it, and "past the stored rev" alone
 * wrote it over a death another device had just written. A write with no `base` founds the line, or is stale. A line
 * past LINEAGES_MAX is refused, never one already held. Answers `{ ok, rev }`, `{ error: 'lineage-stale', rev, record }`
 * (the stored one, to merge into and write again on its rev), or `{ error }`: 'body', 'lineage-too-large' (AUDIT LEGACY
 * III O2/P1: a record past LINEAGE_MAX_BYTES - its own word, never the shape's 'body'), 'too-many-lineages'. The model
 * is the founder's, for good: a record that says another is refused ('lineage-model'). A write that adds a death to the
 * line tombstones that member's realm character (W2, entombLineDead).
 * @param {any} ctx @param {string} playerId @param {{ id: unknown, record: unknown, base?: unknown }} at
 */
export async function putLineage({ db, nowS }, playerId, { id, record, base = null }) {
  if (!playerId || typeof id !== 'string' || !LINEAGE_ID_RE.test(id)) return { error: 'body' };
  const rec = recordShapeOf(record, id);
  if (!rec) return { error: 'body' };
  if (rec.bytes > LINEAGE_MAX_BYTES) return { error: 'lineage-too-large' };
  if (base !== null && !(Number.isSafeInteger(base) && /** @type {number} */ (base) >= 0)) return { error: 'body' };
  const had = await db.prepare('SELECT rev, model, record FROM lineages WHERE player = ? AND id = ?').bind(playerId, id).first();
  if (had) {
    if (had.model !== rec.model) return { error: 'lineage-model' };
    const moved = await db.prepare('UPDATE lineages SET record = ?, rev = ?, surname = ?, updated_at = ? WHERE player = ? AND id = ? AND rev = ? AND rev < ?')
      .bind(rec.text, rec.rev, rec.surname, nowS, playerId, id, base ?? -1, rec.rev).run();
    if (moved.meta.changes) {
      await entombLineDead({ db, nowS }, playerId, id, had.record, /** @type {any} */ (record));
      return { ok: true, rev: rec.rev };
    }
    return staleLine(db, playerId, id, rec.model);
  }
  const wrote = await db.prepare(
    'INSERT OR IGNORE INTO lineages (player, id, surname, model, record, rev, created_at, updated_at)'
    + ' SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM lineages WHERE player = ?) < ?',
  ).bind(playerId, id, rec.surname, rec.model, rec.text, rec.rev, nowS, nowS, playerId, LINEAGES_MAX).run();
  if (wrote.meta.changes) {
    await entombLineDead({ db, nowS }, playerId, id, null, /** @type {any} */ (record));
    return { ok: true, rev: rec.rev };
  }
  // a race founded it between the read and the write - the founding is another device's: stale, to merge and write again
  return (await staleLine(db, playerId, id, rec.model)) ?? { error: 'too-many-lineages' };
}

/** The stored line, answered to a write that was not made from it - or null when there is none. */
async function staleLine(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ id, /** @type {string} */ model) {
  const now = await db.prepare('SELECT rev, model, record FROM lineages WHERE player = ? AND id = ?').bind(playerId, id).first();
  if (!now) return null;
  return now.model !== model ? { error: 'lineage-model' } : { error: 'lineage-stale', rev: now.rev, record: parsed(now.record) };
}

/**
 * AUDIT LEGACY III W2: THE LINE'S OWN WORD ON ITS DEAD. A death the line records of a member whose realm character
 * still stands - struck down in the street by the one played (legacyHost.js kinSlain), where no tab of theirs held a
 * lease to say it - is the realm's too: the write that first carries it tombstones their character (entomb: the union
 * ended, the guild seat handed on), as a retirement in an Enduring line retires theirs. The character is the one the
 * realm bound to that person at its birth (`lineage_id`, `person_id` - never the record's own word on who played them),
 * this account's own, once (`dead_at IS NULL`); a death is never taken back (mergeFacts).
 * @param {any} ctx @param {string} playerId @param {string} lineageId @param {string|null} oldText @param {any} record
 */
async function entombLineDead({ db, nowS }, playerId, lineageId, oldText, record) {
  const before = new Map(((oldText ? parsed(oldText) : null)?.people ?? []).map((/** @type {any} */ p) => [p?.id, p]));
  for (const p of record?.people ?? []) {
    const why = p?.died ? 'fell' : p?.retired != null && record.model === 'enduring' ? 'retired' : null;
    if (!why) continue;
    const was = before.get(p.id);
    if (was && (why === 'fell' ? !!was.died : was.retired != null)) continue;   // the stored copy said it already
    const row = await db.prepare('SELECT id, dead_at, dead_why FROM realm_characters WHERE player = ? AND lineage_id = ? AND person_id = ?')
      .bind(playerId, lineageId, p.id).first();
    if (!row) continue;
    if (row.dead_at == null) await entomb(db, playerId, row.id, nowS, why);
    else if (why === 'fell' && row.dead_why === 'retired') await fellRetired(db, playerId, row.id, nowS);
  }
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
 * stamp is the first's (idempotent: a retry whose answer was lost - finishing what it may have left undone, by the
 * first stamp's word). `why` - 'fell' (a death, the default) or 'retired' (an Enduring elder's mantle passed: never
 * played again, but alive at the seat). AUDIT LEGACY III O6: a retirement is an ENDURING line's alone - the service
 * holds the line's model, and a Bloodline's fall said 'retired' kept its union standing with a widow(er) the realm knew
 * was widowed, who could never wed again. LEGACY7 part three: a death ends the character's union with another player's
 * (ended 'died'); a retirement keeps it - the elder lives on, wed. Answers `{ ok, deadAt }` or `{ error }`: 'body',
 * 'no-realm-character', 'lease'.
 * @param {any} ctx @param {string} playerId @param {{ id: unknown, lease: unknown, why?: unknown }} at
 */
export async function realmDie({ db, nowS }, playerId, { id, lease, why = 'fell' }) {
  if (typeof id !== 'string' || !REALM_CHARACTER_RE.test(id) || typeof lease !== 'string' || !/^[0-9a-f]{32}$/.test(lease)) return { error: 'body' };
  if (why !== 'fell' && why !== 'retired') return { error: 'body' };
  const row = await db.prepare('SELECT r.dead_at AS dead_at, r.dead_why AS dead_why, l.model AS model FROM realm_characters r'
    + ' LEFT JOIN lineages l ON l.player = r.player AND l.id = r.lineage_id WHERE r.id = ? AND r.player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (why === 'retired' && row.model !== 'enduring') return { error: 'body' };
  if (row.dead_at != null) {
    // a death after a retirement is a death (the one way the word moves - fellRetired); anything else, the first word's
    if (!(why === 'fell' && row.dead_why === 'retired' && (await fellRetired(db, playerId, id, nowS)))) {
      await afterTomb(db, playerId, id, row.dead_at, row.dead_why === 'retired' ? 'retired' : 'fell');
    }
    return { ok: true, deadAt: row.dead_at };
  }
  if (!(await entomb(db, playerId, id, nowS, why, lease))) return { error: 'lease' };
  return { ok: true, deadAt: nowS };
}

/**
 * AUDIT LEGACY III O5/W2: THE TOMBSTONE STAMPED - one routine for the playing tab's death (realmDie, under its lease)
 * and the line's own word on its dead (entombLineDead, a member nobody was playing). The row takes its death, why
 * (O6: the first stamp's word, which a retry keeps) and loses its lease; then afterTomb. Answers whether this call
 * stamped it.
 * @param {any} db @param {string} playerId @param {string} id @param {number} nowS @param {'fell'|'retired'} why
 * @param {string|null} [lease] the playing tab's - none for the line's word
 */
async function entomb(db, playerId, id, nowS, why, lease = null) {
  const took = await db.prepare(`UPDATE realm_characters SET dead_at = ?, dead_why = ?, lease = NULL, updated_at = ? WHERE id = ? AND player = ? AND dead_at IS NULL${lease == null ? '' : ' AND lease = ?'}`)
    .bind(nowS, why, nowS, id, playerId, ...(lease == null ? [] : [lease])).run();
  if (!took.meta.changes) return false;
  await afterTomb(db, playerId, id, nowS, why);
  return true;
}

/** A RETIRED ELDER'S DEATH, after: the tombstone's word moves from 'retired' to 'fell' - the one way it ever moves, a
 *  death added - and the union kept for the living elder ends with them. Answers whether it moved. */
async function fellRetired(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ id, /** @type {number} */ nowS) {
  const moved = await db.prepare("UPDATE realm_characters SET dead_why = 'fell', updated_at = ? WHERE id = ? AND player = ? AND dead_why = 'retired'").bind(nowS, id, playerId).run();
  if (!moved.meta.changes) return false;
  await afterTomb(db, playerId, id, nowS, 'fell');
  return true;
}

/**
 * WHAT A TOMBSTONE TAKES WITH IT - each its own write, each idempotent, so a retry of the stamp finishes what a lost
 * answer left undone. A death ends the character's union ('died'; a retirement keeps it). AUDIT LEGACY III O5: its
 * guild place goes and its seat is handed on (guilds.js guildMemberDead) - a fallen master stayed master for good, the
 * guild never succeeded, the dead's account still acting as one; its half of a wedding is nobody's word any more. Its
 * Renown track stays, the line's story, but no longer holds a place (renownTracks.js renownHeldSql).
 * @param {any} db @param {string} playerId @param {string} id @param {number} atS @param {'fell'|'retired'} why
 */
async function afterTomb(db, playerId, id, atS, why) {
  if (why === 'fell') await endUnionsOf(db, id, atS, 'died').run();
  await guildMemberDead(db, playerId, id);
  await db.prepare('DELETE FROM realm_wed_halves WHERE player = ? AND char_id = ?').bind(playerId, id).run();
}

// ═══ LEGACY7 part three: TWO PLAYERS WED ═══════════════════════════════════════════════════════════════════════════════
//
// Two realm characters of Project Legacy lines, standing in one temple, wed by both their words: each client posts its
// HALF of one wedding (`sid`, the handshake the two agreed on the relay's `wed` frame - net/wire.js validWedData),
// naming its own character under its playing lease and the other's ACCOUNT and CHARACTER (the relay's verified `sub`
// and `sc` - the account and the realm character the identity token vouches for - never a client's word about who the
// other is). The union is made only when both halves are here and each names the other, character for character - and
// only for two living characters of lines, each wed to nobody. AUDIT LEGACY III O1: a half named the other's account
// alone, so after a yes the other's account could lease another of its characters and post with that one - wed to a
// character the player never saw, and with no way out but a death. Each side's CARD is kept on the union as it stood
// at the wedding - what the other's house records of them. It ends with either's death or delete; a retirement keeps
// it. AUDIT LEGACY III O3: a half is taken back (`withdraw`) whenever its player is told the wedding did not happen.

/** A wedding's handshake id - the duel's alphabet (net/wire.js validWedData). */
export const WED_SID_RE = /^[A-Za-z0-9]{6,16}$/;
/** How long a half waits for its other: a proposal answered within five minutes, or not at all. */
export const WED_HALF_LIFE_S = 300;
/** The bound on a face index on a card (the port's faces are a handful a race; any honest record is far under it). */
export const WED_FACE_MAX = 999;

/**
 * A SIDE'S CARD at the wedding - what the other's house keeps of them: the realm character's name and its house, each
 * through the name filter (houseOn - the mint's law), and the person's sex, race and face off their own line's record,
 * each held to its shape. AUDIT LEGACY III O4: the name too - a realm character's name is its own account's, shown to
 * nobody, and the card made it another player's spouse's name on their tree, their HUD and their towns' news ("Admin",
 * the house's own given name the filter had dropped). A name any word of which the filter refuses goes as none.
 * Null when no such character is the account's.
 * @param {any} db @param {string} playerId @param {string} charId
 */
export async function wedCardOf(db, playerId, charId) {
  const row = await db.prepare('SELECT r.name AS name, r.person_id AS person, l.record AS record FROM realm_characters r'
    + ' LEFT JOIN lineages l ON l.player = r.player AND l.id = r.lineage_id WHERE r.id = ? AND r.player = ?').bind(charId, playerId).first();
  if (!row) return null;
  const p = (parsed(row.record ?? '')?.people ?? []).find((/** @type {any} */ x) => x?.id === row.person) ?? {};
  const name = String(row.name ?? '').trim();
  return {
    // each word through the filter, as the house's given name is (houseOn): the partner's tree shows a given name alone
    name: name && name.split(/\s+/).every((w) => checkName(w).ok) ? name : '',
    house: row.record ? houseOn(row.record, row.person) : null,
    gender: p.gender === 'female' ? 'female' : 'male',
    race: typeof p.race === 'string' && /^[A-Za-z][A-Za-z ]{0,23}$/.test(p.race) ? p.race : null,
    face: Number.isSafeInteger(p.face) && p.face >= 0 && p.face <= WED_FACE_MAX ? p.face : 0,
  };
}

/** A union as one side sees it: its own character, the other's account, character and card, when, and whether it
 *  ended - when, why ('died' or 'gone') and by whose ('mine' or 'partner'). */
const unionView = (/** @type {any} */ u, /** @type {string} */ playerId) => {
  const mine = u.a_player === playerId;
  const myChar = mine ? u.a_char : u.b_char;
  const card = parsed((mine ? u.b_card : u.a_card) ?? '') ?? {};
  return {
    sid: u.sid, mine: myChar,
    partner: {
      player: mine ? u.b_player : u.a_player, char: mine ? u.b_char : u.a_char,
      name: String(card.name ?? ''), house: card.house ?? null, gender: card.gender === 'female' ? 'female' : 'male', race: card.race ?? null, face: card.face ?? 0,
    },
    at: u.wed_at, endedAt: u.ended_at ?? null, endedWhy: u.ended_why ?? null,
    endedBy: u.ended_at == null ? null : u.ended_by === myChar ? 'mine' : 'partner',
  };
};
const openUnionOf = (/** @type {any} */ db, /** @type {string} */ charId) =>
  db.prepare('SELECT 1 FROM realm_unions WHERE ended_at IS NULL AND (a_char = ? OR b_char = ?)').bind(charId, charId).first();

/**
 * A HALF OF ONE WEDDING: my character `id` under `lease`, the handshake `sid`, the other's account `partner` and
 * character `partnerChar` (the relay's stamps of the one my player saw). Answers `{ ok, wed: false }` (mine waits for
 * theirs), `{ ok, wed: true, union }` (both are here - the union stands, or stood already for this sid), or `{ error }`:
 * 'body', 'no-realm-character', 'dead', 'lease', 'wed-no-line' (a character of no line weds no one), 'wed-already' (mine
 * is wed), 'wed-partner' (theirs cannot be - dead, of no line, wed, or not the character mine names: O1), 'wed-spent'
 * (another pair's sid, or my half for it says otherwise). A half is written once: posted again (a retry whose answer
 * was lost) it keeps its first `at` - AUDIT LEGACY III O3: a re-post refreshed it, so a yes outlived what its player was
 * told by another five minutes each time. `withdraw` takes my half back - the wedding did not happen, whatever comes
 * after - and answers the union when it stood first (`wed: true`, so a late word is never lost); it asks no lease (it
 * is the account's own word, about its own half).
 * @param {any} ctx @param {string} playerId
 * @param {{ id: unknown, lease: unknown, sid: unknown, partner: unknown, partnerChar?: unknown, withdraw?: unknown }} at
 */
export async function realmWed({ db, nowS }, playerId, { id, lease, sid, partner, partnerChar, withdraw = false }) {
  if (typeof id !== 'string' || !REALM_CHARACTER_RE.test(id) || typeof lease !== 'string' || !/^[0-9a-f]{32}$/.test(lease)) return { error: 'body' };
  if (typeof sid !== 'string' || !WED_SID_RE.test(sid) || typeof partner !== 'string' || !ID_RE.test(partner) || partner === playerId) return { error: 'body' };
  if (typeof partnerChar !== 'string' || !REALM_CHARACTER_RE.test(partnerChar) || typeof withdraw !== 'boolean') return { error: 'body' };
  const mineOf = (/** @type {any} */ u) => (u.a_player === playerId && u.a_char === id) || (u.b_player === playerId && u.b_char === id);
  if (withdraw) {
    // taken back, then the union looked for: theirs is made only while mine stands (asked IN its write, below), so
    // either it stood before this delete and is answered, or it never will be
    await db.prepare('DELETE FROM realm_wed_halves WHERE sid = ? AND player = ?').bind(sid, playerId).run();
    const u = await db.prepare('SELECT * FROM realm_unions WHERE sid = ?').bind(sid).first();
    return u && mineOf(u) ? { ok: true, wed: true, union: unionView(u, playerId) } : { ok: true, wed: false };
  }
  const had = await db.prepare('SELECT * FROM realm_unions WHERE sid = ?').bind(sid).first();
  if (had) return mineOf(had) ? { ok: true, wed: true, union: unionView(had, playerId) } : { error: 'wed-spent' };
  const me = await db.prepare('SELECT lease, dead_at, lineage_id FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!me) return { error: 'no-realm-character' };
  if (me.dead_at != null) return { error: 'dead' };
  if (me.lease !== lease) return { error: 'lease' };
  if (!me.lineage_id) return { error: 'wed-no-line' };
  if (await openUnionOf(db, id)) return { error: 'wed-already' };
  // a half older than its life is nobody's word any more - swept before mine is written and theirs is looked for; and
  // an account is in one wedding at a time (its client answers one proposal at a time): its other halves are words it
  // took back, so the table holds at most one row an account
  await db.prepare('DELETE FROM realm_wed_halves WHERE at < ? OR (player = ? AND sid != ?)').bind(nowS - WED_HALF_LIFE_S, playerId, sid).run();
  await db.prepare('INSERT INTO realm_wed_halves (sid, player, char_id, partner, partner_char, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (sid, player) DO NOTHING')
    .bind(sid, playerId, id, partner, partnerChar, nowS).run();
  const own = await db.prepare('SELECT char_id, partner, partner_char FROM realm_wed_halves WHERE sid = ? AND player = ?').bind(sid, playerId).first();
  if (!own || own.char_id !== id || own.partner !== partner || own.partner_char !== partnerChar) return { error: 'wed-spent' };
  const other = await db.prepare('SELECT char_id, partner_char FROM realm_wed_halves WHERE sid = ? AND player = ? AND partner = ?').bind(sid, partner, playerId).first();
  if (!other) return { ok: true, wed: false };
  // AUDIT LEGACY III O1: CHARACTER FOR CHARACTER - theirs is the one mine names, and theirs names mine
  if (other.char_id !== partnerChar || other.partner_char !== id) return { error: 'wed-partner' };
  const them = await db.prepare('SELECT 1 FROM realm_characters WHERE id = ? AND player = ? AND dead_at IS NULL AND lineage_id IS NOT NULL').bind(other.char_id, partner).first();
  if (!them) return { error: 'wed-partner' };
  const [theirCard, myCard] = await Promise.all([wedCardOf(db, partner, other.char_id), wedCardOf(db, playerId, id)]);
  // the union, asked IN the write: two halves posting at once race to one row (the sid's key), neither character may be
  // wed meanwhile - theirs since their half was written, or mine in a race - and their half still stands (O3: a half
  // taken back meanwhile makes nothing)
  await db.prepare(
    'INSERT OR IGNORE INTO realm_unions (sid, a_player, a_char, b_player, b_char, a_card, b_card, wed_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?'
    + ' WHERE NOT EXISTS (SELECT 1 FROM realm_unions WHERE ended_at IS NULL AND (a_char IN (?, ?) OR b_char IN (?, ?)))'
    + ' AND EXISTS (SELECT 1 FROM realm_wed_halves WHERE sid = ? AND player = ? AND char_id = ? AND partner_char = ?)',
  ).bind(sid, partner, other.char_id, playerId, id, JSON.stringify(theirCard), JSON.stringify(myCard), nowS, id, other.char_id, id, other.char_id,
    sid, partner, other.char_id, id).run();
  const now = await db.prepare('SELECT * FROM realm_unions WHERE sid = ?').bind(sid).first();
  if (!now) {
    if (await openUnionOf(db, id)) return { error: 'wed-already' };
    // their half gone between the read and the write - taken back: no word of theirs, as if it never came
    return (await db.prepare('SELECT 1 FROM realm_wed_halves WHERE sid = ? AND player = ?').bind(sid, partner).first()) ? { error: 'wed-partner' } : { ok: true, wed: false };
  }
  await db.prepare('DELETE FROM realm_wed_halves WHERE sid = ?').bind(sid).run();
  return { ok: true, wed: true, union: unionView(now, playerId) };
}

/** Every union of this account's characters, the latest word first - AUDIT LEGACY III O8: by when each last changed (an
 *  end, or the wedding), so the newest things a house has to hear lead the fifty: listed newest-wed first, a union
 *  older than fifty others was never listed again, and its end never reached the house. */
export async function listUnions({ db }, /** @type {string} */ playerId) {
  const r = await db.prepare('SELECT * FROM realm_unions WHERE a_player = ? OR b_player = ? ORDER BY COALESCE(ended_at, wed_at) DESC, wed_at DESC LIMIT 50')
    .bind(playerId, playerId).all();
  return (r?.results ?? []).map((/** @type {any} */ u) => unionView(u, playerId));
}

/** A character's unions ended - its death ('died') or its delete ('gone'), and by whose. A statement, for the caller's
 *  own write. */
export const endUnionsOf = (/** @type {any} */ db, /** @type {string} */ id, /** @type {number} */ nowS, /** @type {'died'|'gone'} */ why) =>
  db.prepare('UPDATE realm_unions SET ended_at = ?, ended_why = ?, ended_by = ? WHERE ended_at IS NULL AND (a_char = ? OR b_char = ?)').bind(nowS, why, id, id, id);
