// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1 — THE REALM'S CHARACTERS, SERVICE SIDE. The row in D1, the
// save in R2, and the lease that says which tab may write it.
//
// Mac: "A true separation while allowing people to still play offline",
// and, asked where an online character's save lives: "Account service".
// The plan is bible/06-Systems/Realm-Arc.md, sections 1 and 2.
//
// ═══ HERE THE SERVICE IS THE TRUTH ═════════════════════════════════
//
// saves.js is a backup and says so: "THE LOCAL SAVE IS THE TRUTH". A
// realm character is the other lane. Its save lives here, the Online
// door loads it only from here, and a local copy is a cache that no
// door lists. That is what makes a copy worthless as a way in: a
// restored backup, an imported zip or an edited file can be loaded
// offline, where it is an offline character, and nowhere else.
//
// ═══ THE LEASE AND THE SEQUENCE ════════════════════════════════════
//
// A JOIN mints a new lease and so takes the character from any tab that
// held it - ONE-SEAT's own rule, newest wins - and it frees every other
// character of the account, so one account plays one character. A
// CHECKPOINT lands only under the current lease and only at `seq + 1`.
// So an old tab, a second device or a replayed request can never write
// the character again; the tab that lost the lease is told so and goes
// offline.
//
// EVERY WRITE IS A NEW OBJECT (REALM P2.1). The row names the current
// save (`obj`) and the one before it (`prev`), and a write lands at a
// key of its own before the row moves to it - so a write that loses its
// race (a checkpoint against a trade the service is settling, a join
// between the read and the write) leaves the current save untouched,
// and the one before the last checkpoint always survives. P1 alternated
// two objects by `seq`, and a write that lost its race could land on
// the current one.
//
// ═══ EVERYTHING IS SCOPED BY THE PLAYER THE CALLER PROVED ══════════
//
// saves.js's law, kept: every statement binds the resolved player, and
// no route takes a player id from a caller.
// ═══════════════════════════════════════════════════════════════════

import { SAVE_MAX_BYTES } from './service.js';
import { GUILD_RANK_MASTER } from '../../src/net/guildLaw.js';   // AUDIT REALM L1-F7: a deleted guildmaster hands the guild over first
import { liquidWealthOf, customsAllowance, REALM_BIRTH_LEVEL, REALM_BIRTH_WEALTH_MAX } from '../../src/net/realmGoldLaw.js';   // AUDIT REALM2 S1: the first save, measured as customs measures it
import { ID_RE } from '../../src/net/identityToken.js';   // CUSTOMS-PASS: an account named by its id
import { isGuestShaped, isHandleShaped } from '../../src/net/handleShape.js';   // CUSTOMS-PASS: a handle and a guest's name, told apart by their shape alone
import { isDeveloper } from './titles.js';   // CUSTOMS-PASS: a developer grants one
import { displayName } from './accounts.js';
import { saveTextOf, REALM_TEXT_MAX_BYTES } from '../../src/net/realmSaveCodec.js';   // REALM-GZIP: a save read packed or plain

/** Realm characters an ACCOUNT may hold. A new one past it is refused; nothing is ever deleted to make room. */
export const REALM_CHARACTERS_MAX = 6;
/** A character's name as the Online door shows it. */
export const REALM_NAME_MAX = 32;
/** The summary's JSON, in bytes. */
export const REALM_SUMMARY_MAX = 512;
/** A lease renewed this recently is a character in play ("playing now" on the tile). Checkpoints come every two minutes. */
export const REALM_PLAYING_S = 300;
/** The largest save a checkpoint may carry - the cloud save's own bound. REALM-GZIP: the REQUEST's bound - a tab packs
 *  its save, and the text a checkpoint opens to is REALM_TEXT_MAX_BYTES (src/net/realmSaveCodec.js). */
export const REALM_MAX_BYTES = SAVE_MAX_BYTES;
/** The service's ids: `r` and twenty hex digits. Nothing a client mints looks like one. */
export const REALM_ID_RE = /^r[0-9a-f]{20}$/;
/** A lease: thirty-two hex digits, a secret the playing tab holds. */
export const LEASE_RE = /^[0-9a-f]{32}$/;
/** An offline character's id (CHARID1's two shapes, service.js CHAR_ID_RE's bound), for customs. */
export const ORIGIN_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

/** The R2 keys: player first, so an account is a prefix walk; a character's saves under its id, each at the sequence
 *  it lands at and a tag of its own, so no two writes ever share a key. */
export const realmPrefix = (/** @type {string} */ playerId) => `realm/${encodeURIComponent(playerId)}/`;
export const realmObjectKey = (/** @type {string} */ playerId, /** @type {string} */ id, /** @type {number} */ seq, /** @type {string} */ tag) => `${realmPrefix(playerId)}${id}/${seq}-${tag}`;

const hex = (/** @type {(b: Uint8Array) => Uint8Array} */ rand, /** @type {number} */ n) => [...rand(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
/** A fresh key for a write of this character at `seq`. */
export const mintObjectKey = (/** @type {(b: Uint8Array) => Uint8Array} */ rand, /** @type {string} */ playerId, /** @type {string} */ id, /** @type {number} */ seq) => realmObjectKey(playerId, id, seq, hex(rand, 4));
/** Objects nothing names any more - a write that lost its race, or the save two back. Best effort: one that will not go
 *  is only bytes under the character's prefix, which its delete walks. */
export async function dropObjects(/** @type {any} */ bucket, /** @type {(string | null | undefined)[]} */ keys) {
  for (const k of keys) {
    if (!k) continue;
    try { await bucket.delete(k); } catch { /* bytes nothing names */ }
  }
}
export const mintRealmId = (/** @type {(b: Uint8Array) => Uint8Array} */ rand) => `r${hex(rand, 10)}`;
export const mintLease = (/** @type {(b: Uint8Array) => Uint8Array} */ rand) => hex(rand, 16);

/** A name the door may show: trimmed, printable, bounded - or null. */
export function realmNameOf(/** @type {unknown} */ v) {
  if (typeof v !== 'string') return null;
  const name = v.trim().slice(0, REALM_NAME_MAX);
  return name && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

const whole = (/** @type {unknown} */ v, /** @type {number} */ max) => (Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) <= max ? v : null);
const text = (/** @type {unknown} */ v, /** @type {number} */ max) => (typeof v === 'string' && v && !/[\u0000-\u001f\u007f]/.test(v) ? v.slice(0, max) : null);

/**
 * THE SUMMARY A CLIENT MAY SEND, projected - what the tile shows and nothing else: level, class, race, gender, and
 * the face the tile draws. Extra keys do not exist here. Answers the JSON to store, or null.
 * @param {any} v
 */
export function realmSummaryOf(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const s = {
    level: whole(v.level, 1000),
    className: text(v.className, 40),
    race: text(v.race, 24),
    gender: text(v.gender, 8),
    face: whole(v.face, 1000),
    region: text(v.region, 40),
  };
  const json = JSON.stringify(s);
  return json.length <= REALM_SUMMARY_MAX ? json : null;
}

/** The row as the Online door sees it. The lease is never in it. */
const view = (/** @type {any} */ r, /** @type {number} */ nowS) => {
  let summary = null;
  try { summary = r.summary ? JSON.parse(r.summary) : null; } catch { summary = null; }
  return {
    id: r.id, name: r.name, summary, seq: r.seq, bytes: r.bytes,
    playing: !!r.lease && nowS - r.lease_at < REALM_PLAYING_S,
    customs: !!r.origin_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
};

/** Every realm character this account holds, the one played last first. */
export async function listRealm({ db, nowS }, /** @type {string} */ playerId) {
  const r = await db.prepare(
    'SELECT id, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at FROM realm_characters'
    + ' WHERE player = ? ORDER BY updated_at DESC LIMIT ?',
  ).bind(playerId, REALM_CHARACTERS_MAX).all();
  return (r?.results ?? []).map((row) => view(row, nowS));
}

/** REALM-DOOR (2026-09-29, the field): IS THIS ONE OF THE ACCOUNT'S REALM CHARACTERS? The identity mint asks it of the
 *  character a client names and signs the answer (`rc`), and the relay's door refuses a no - so online is the realm's at
 *  the servers, not only in the new build's boot. A realm id of this account's own, standing; anything else is not: an
 *  offline character's id (what a build from before the realm names), another account's character, one deleted, none. */
export async function realmCharacterHeld({ db }, /** @type {string} */ playerId, /** @type {unknown} */ id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return false;
  return !!(await db.prepare('SELECT 1 FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first());
}

/** ARENA4b: the highest level a token's `cl` claim says - the summary's own bound (realmSummaryOf's `level`). */
export const REALM_LEVEL_CLAIM_MAX = 1000;
/** ARENA4b: THE LEVEL ON A REALM CHARACTER'S TILE - its summary's `level`, the word its client's checkpoint wrote
 *  (realmSummaryOf projects it) - which the identity mint signs as `cl` beside `rc`. Null for anything else: not one of
 *  this account's realm characters, no summary yet, a level outside 1..REALM_LEVEL_CLAIM_MAX. */
export async function realmLevelOf({ db }, /** @type {string} */ playerId, /** @type {unknown} */ id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return null;
  const row = await db.prepare('SELECT summary FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  let summary = null;
  try { summary = row?.summary ? JSON.parse(row.summary) : null; } catch { summary = null; }
  const lv = summary?.level;
  return Number.isSafeInteger(lv) && lv >= 1 && lv <= REALM_LEVEL_CLAIM_MAX ? lv : null;
}

/** ONE CHARACTER IN PLAY AN ACCOUNT: every lease of this account but `keep`'s is dropped. */
async function freeOthers({ db }, /** @type {string} */ playerId, /** @type {string} */ keep) {
  await db.prepare('UPDATE realm_characters SET lease = NULL WHERE player = ? AND id != ? AND lease IS NOT NULL').bind(playerId, keep).run();
}

/**
 * A NEW REALM CHARACTER, born online (customs is customsRealm's, below). The id and the lease are minted here; the
 * character is the caller's in play from this moment, at `seq` 0 with no save yet (its first checkpoint is seq 1). The
 * bound is asked IN the write, as saves.js's putCard asks it. Answers `{ id, lease, seq }` or `{ error }`.
 * @param {any} ctx @param {string} playerId @param {{ name: unknown, summary?: unknown }} at
 */
export async function createRealm({ db, rand, nowS }, playerId, { name, summary = null }) {
  const n = realmNameOf(name);
  if (!playerId || !n) return { error: 'body' };
  const id = mintRealmId(rand);
  const lease = mintLease(rand);
  const wrote = await db.prepare(
    'INSERT INTO realm_characters (id, player, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at)'
    + ' SELECT ?, ?, ?, ?, 0, 0, ?, ?, NULL, ?, ? WHERE (SELECT COUNT(*) FROM realm_characters WHERE player = ?) < ?',
  ).bind(id, playerId, n, realmSummaryOf(summary), lease, nowS, nowS, nowS, playerId, REALM_CHARACTERS_MAX).run();
  if (!wrote.meta.changes) return { error: 'too-many-characters' };
  await freeOthers({ db }, playerId, id);
  return { id, lease, seq: 0 };
}

/** THE TABLES CUSTOMS CARRIES from the offline id to the realm's: the Renown track (renownTracks.js) - the plan's
 *  "Renown starts from its existing track" - and the character's online homes (homes.js) and its guild place
 *  (guilds.js).
 *  CUSTOMS-CARRY (2026-09-29, Mac, of the two AUDIT REALM2 S2 weighed - "only what stood before the realm, or none":
 *  "Carry them"): what an offline id holds IS what stood before the realm, because since the realm a claim, a placement
 *  and a founding are a realm character's alone (S2's rule, which stands), and it pays out nothing that was not the
 *  realm's - a house from before the realm sells for its `paid` (0), a piece gives back half its `paid` (0), and a
 *  guild's realm withdrawal takes from `realm_gold` alone (migration 0020, L1-F3). S2 left them under the offline id,
 *  where they were lost to everyone: a building exclusive to nobody who could walk in, a guild without its master and
 *  its name and tag kept from any founding (Dracula/Valentin, the field). Migration 0022 carried them for every
 *  character customs had already made.
 *  RENOWN-CHAR: THE TRACK IS THE CHARACTER'S RENOWN AGAIN (RENOWN-ACCOUNT kept one an account for a day, renown_accounts,
 *  migration 0021 - history now; migration 0035 gave each track back its share): customs carries it in with the rest, so
 *  the plan's "Renown starts from its existing track" holds, and a delete takes it with the character. */
export const CHARACTER_TABLES = Object.freeze(['renown_tracks', 'homes', 'guild_members']);

/** CUSTOMS CARRIES A CHARACTER'S TRACK IN, re-keyed from the offline id to the realm's - the account's own rows only, and
 *  never over a track the realm's id already holds (OR IGNORE: a resume carries again, AUDIT REALM2 S6). Statements, for
 *  the caller's batch. */
const customsCarry = (/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ originId, /** @type {string} */ id) =>
  CHARACTER_TABLES.map((table) => db.prepare(`UPDATE OR IGNORE ${table} SET char_id = ? WHERE player = ? AND char_id = ?`).bind(id, playerId, originId));

// ═══ CUSTOMS-PASS (2026-09-29, the field - Mac, asked, "Staff customs pass") ══════════════════════════════════════════
//
// The census is frozen at the realm's start (L1-F5: a Copy to offline's new id gathers traces too), and REALM-DOOR keeps
// every character made since off the relay unless the realm made it. But until REALM-DOOR a build from before the realm
// played online unchecked, and a character made on one after the census froze (Gryphoth's) has no trace the census
// could count - it cannot come in, by the law that stops the dupe. The pass is the one exception, and a PERSON's: a
// developer grants an account one (grantCustomsPass), and that account's next customs of a character its census does
// not count is let in through customsRealm's own guarded write - the loans called in, the allowance applied, the first
// save read, exactly as any customs is. It is spent on that character (`origin_id`, `spent_at`: the grant's record),
// never on one the census admits anyway, and it never lets in a character already in from any account - so a Copy to
// offline cannot come back through one either. One open pass an account (migration 0024's partial unique index).

/** CUSTOMS-PASS: the account's open pass, or null. */
const openPassOf = (/** @type {any} */ db, /** @type {string} */ playerId) =>
  db.prepare('SELECT id FROM realm_passes WHERE player = ? AND spent_at IS NULL').bind(playerId).first();

/** CUSTOMS-PASS: is this character already in - its census spent on any account, or a realm character standing on it? */
const originIn = async (/** @type {any} */ db, /** @type {string} */ originId) => !!(await db.prepare(
  'SELECT 1 AS here WHERE EXISTS (SELECT 1 FROM realm_census WHERE char_id = ? AND spent = 1) OR EXISTS (SELECT 1 FROM realm_characters WHERE origin_id = ?)',
).bind(originId, originId).first());

/**
 * CUSTOMS-PASS, GRANTED OR TAKEN BACK - a developer's act alone (a pass lets a character into the realm's economy, which
 * is more than a moderator's mute). The account is named as the game shows it: a handle (case-folded, as its unique index
 * is), or a guest's two-word name when exactly one account without a handle wears it - the two never overlap
 * (net/handleShape.js) - or else by its id. A second grant is the same open pass; a revoke takes back an open one and
 * never a spent one, which is the record of whom it let in. Answers `{ ok, target, name, open, changed }` or `{ error }`:
 * 'not-developer', 'body', 'no-player', 'ambiguous' (two guests wear the name: name the account by its id).
 * @param {any} ctx @param {any} actor the caller's player row
 * @param {any} env @param {{ name?: unknown, account?: unknown, revoke?: unknown }} at
 */
export async function grantCustomsPass({ db, nowS }, actor, env, { name, account, revoke = false } = {}) {
  if (!isDeveloper(actor, env)) return { error: 'not-developer' };
  if ((name === undefined) === (account === undefined) || (revoke !== true && revoke !== false)) return { error: 'body' };
  let found;
  if (account !== undefined) {
    if (typeof account !== 'string' || !ID_RE.test(account)) return { error: 'body' };
    found = await db.prepare('SELECT * FROM players WHERE id = ?').bind(account).all();
  } else if (isHandleShaped(name)) {
    found = await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(/** @type {string} */ (name).toLowerCase()).all();
  } else if (isGuestShaped(name)) {
    found = await db.prepare('SELECT * FROM players WHERE guest_name = ? AND handle_lc IS NULL LIMIT 2').bind(name).all();
  } else return { error: 'body' };
  const rows = found?.results ?? [];
  if (!rows.length) return { error: 'no-player' };
  if (rows.length > 1) return { error: 'ambiguous' };
  const target = rows[0];
  const wrote = revoke
    ? await db.prepare('DELETE FROM realm_passes WHERE player = ? AND spent_at IS NULL').bind(target.id).run()
    : await db.prepare('INSERT OR IGNORE INTO realm_passes (player, granted_by, granted_at) VALUES (?, ?, ?)').bind(target.id, actor.id, nowS).run();
  return { ok: true, target: target.id, name: displayName(target), open: !revoke, changed: wrote.meta.changes > 0 };
}

/**
 * WHY CUSTOMS REFUSED (decision 3: "Migrate once via customs"). An offline character may come into the realm once, and
 * only if the realm saw it before the realm began. AUDIT REALM L1-F5 / L3-F2: that is the CENSUS (`realm_census`),
 * taken at the realm's start - never a trace written since: any session files a track for any id, and a Copy to
 * offline's new id, one report, brought the realm character in a second time. Migration 0020 took it of the Renown
 * tracks; CUSTOMS-CARRY (migration 0022, Mac 2026-09-29: "Any pre-realm trace") widened it to every trace stamped before
 * the realm - an online home, a guild place, a raid fought, a cloud backup - since a track needs a first online kill.
 * And "once" is the character's, on every account: a customs SPENDS its character's census rows everywhere
 * (customsRealm), so a character copied onto two accounts before the realm, or a realm character deleted, never brings
 * its origin in again. The gate itself is customsRealm's one guarded write; this reads, after it refused, which word is
 * true: `customs-never-online` (this account counted no such character), `customs-already` (it came in, from here or
 * from an account it was copied to), `too-many-characters` (the account's bound) - or null, when none is (the store
 * failed, and the caller says so). CUSTOMS-PASS: a character this account's census never counted is `customs-never-online`
 * unless the account holds a developer's open pass - and `customs-already` then if any account brought it in.
 * @param {any} ctx @param {string} playerId @param {string} originId
 */
export async function customsRefusal({ db }, playerId, originId) {
  const counted = await db.prepare('SELECT spent FROM realm_census WHERE player = ? AND char_id = ?').bind(playerId, originId).first();
  if (counted?.spent) return 'customs-already';
  if (!counted) {
    if (!(await openPassOf(db, playerId))) {
      // CUSTOMS-ELSEWHERE (FIELD BUGS 2026-09-30, Dwarfblood's "I did go online with this one in an older build"): the
      // census counts a character under the account it went online with, and one character played on two accounts (a
      // guest in one browser, a handle in another; the desktop app beside the web) is counted on the other. "No record"
      // sent that player to the developers for a pass they did not need: the other account is named, and a character
      // already brought in from it is `customs-already`. What lets a character in is still customsRealm's write alone.
      // (This account counted none of it, so any row is another's; and a customs spends every row of its character, so
      // the rows agree on `spent`)
      const other = await db.prepare('SELECT spent FROM realm_census WHERE char_id = ? LIMIT 1').bind(originId).first();
      return other ? (other.spent ? 'customs-already' : 'customs-other-account') : 'customs-never-online';
    }
    if (await originIn(db, originId)) return 'customs-already';
  }
  const held = await db.prepare('SELECT COUNT(*) AS n FROM realm_characters WHERE player = ?').bind(playerId).first();
  return (held?.n ?? 0) >= REALM_CHARACTERS_MAX ? 'too-many-characters' : null;
}

/**
 * CUSTOMS, MADE (AUDIT REALM L3-F2, L3-F3): the realm character from `origin` in ONE guarded batch - its row written only
 * while the account is under its bound and its census row for the origin stands unspent, and every census row of the
 * origin spent with it, so two accounts (or two tabs) bringing one character in race to one winner. The law is that
 * write, at one site; customsRefusal only names why it refused. A customs whose first save never landed (the door's PUT
 * lost on the way) is RESUMED - the same row, a new lease - rather than refused for good, which left the character
 * barred and its online life under a row nobody could play. Answers `{ id, lease, seq }` (`resumed` for the row taken
 * up again) or `{ error }`.
 * @param {any} ctx @param {string} playerId @param {{ origin: unknown, name: unknown, summary?: unknown }} at
 */
export async function customsRealm(ctx, playerId, { origin, name, summary = null }) {
  const { db, rand, nowS } = ctx;
  if (typeof origin !== 'string' || !ORIGIN_ID_RE.test(origin) || REALM_ID_RE.test(origin)) return { error: 'body' };
  const mine = await db.prepare('SELECT id, bytes FROM realm_characters WHERE player = ? AND origin_id = ?').bind(playerId, origin).first();
  if (mine && !(mine.bytes > 0)) {
    await db.batch(customsCarry(db, playerId, origin, mine.id));   // AUDIT REALM2 S6: carried again - a resume never carried
    const joined = await joinRealm(ctx, playerId, mine.id);
    return joined.error ? joined : { id: joined.id, lease: joined.lease, seq: 0, resumed: true };
  }
  const n = realmNameOf(name);
  if (!playerId || !n) return { error: 'body' };
  const id = mintRealmId(rand);
  const lease = mintLease(rand);
  try {
    await db.batch([
      // THE GATE: the census's unspent row for this account and character - or (CUSTOMS-PASS) the account's open pass, for
      // a character no account has brought in: none's census spent on it, no realm character standing on it (L3-F2)
      db.prepare(
        'INSERT INTO realm_characters (id, player, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at)'
        + ' SELECT ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM realm_characters WHERE player = ?) < ?'
        + ' AND (EXISTS (SELECT 1 FROM realm_census WHERE player = ? AND char_id = ? AND spent = 0)'
        + ' OR (EXISTS (SELECT 1 FROM realm_passes WHERE player = ? AND spent_at IS NULL)'
        + ' AND NOT EXISTS (SELECT 1 FROM realm_census WHERE char_id = ? AND spent = 1)'
        + ' AND NOT EXISTS (SELECT 1 FROM realm_characters WHERE origin_id = ?)))',
      ).bind(id, playerId, n, realmSummaryOf(summary), lease, nowS, origin, nowS, nowS, playerId, REALM_CHARACTERS_MAX, playerId, origin, playerId, origin, origin),
      mustChange(db),
      // CUSTOMS-PASS: the pass is spent on the character it let in - only when the census did not (asked before the census
      // is spent below), and it keeps whom and when, the record of the grant's one use
      db.prepare(
        'UPDATE realm_passes SET origin_id = ?, spent_at = ? WHERE player = ? AND spent_at IS NULL'
        + ' AND NOT EXISTS (SELECT 1 FROM realm_census WHERE player = ? AND char_id = ? AND spent = 0)',
      ).bind(origin, nowS, playerId, playerId, origin),
      db.prepare('INSERT OR IGNORE INTO realm_census (player, char_id, spent) VALUES (?, ?, 1)').bind(playerId, origin),   // CUSTOMS-PASS: counted in - once, on every account
      db.prepare('UPDATE realm_census SET spent = 1 WHERE char_id = ?').bind(origin),
      // AUDIT REALM2 S6: THE CARRY IS IN THE CENSUS'S OWN BATCH. It ran after it, a statement at a time, so a failure
      // there (a transient D1 error, the request cancelled) left the census spent and the track under an id the realm
      // never plays again - and the resume above never carried it.
      ...customsCarry(db, playerId, origin, id),
    ]);
  } catch (e) {
    const why = await customsRefusal(ctx, playerId, origin);
    if (why) return { error: why };
    throw e;
  }
  await freeOthers({ db }, playerId, id);
  return { id, lease, seq: 0 };
}

/**
 * A JOIN: a new lease on the account's own character, taking it from any tab that held it and freeing the account's
 * others. Answers `{ id, lease, seq, bytes, origin }` - `bytes` 0 is a character whose first save never landed, `origin`
 * the offline id a customs character came from (null for one born online) - or `{ error }`.
 * @param {any} ctx @param {string} playerId @param {unknown} id
 */
export async function joinRealm({ db, rand, nowS }, playerId, id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return { error: 'body' };
  const lease = mintLease(rand);
  const took = await db.prepare('UPDATE realm_characters SET lease = ?, lease_at = ? WHERE id = ? AND player = ?').bind(lease, nowS, id, playerId).run();
  if (!took.meta.changes) return { error: 'no-realm-character' };
  await freeOthers({ db }, playerId, id);
  const row = await db.prepare('SELECT seq, bytes, origin_id FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  // RESTORE: and the offline id a customs character came from - the playing tab gives back what customs once kept, off
  // that character's own save on its device (systems/realmCustoms.js reclaimFromDevice)
  return { id, lease, seq: row?.seq ?? 0, bytes: row?.bytes ?? 0, origin: row?.origin_id ?? null };
}

/** REALM-GZIP: AN R2 OBJECT'S BYTES - the platform's reader when it has one (R2's own), its body when that is the bytes. */
export async function objectBytesOf(/** @type {any} */ object) {
  if (typeof object?.arrayBuffer === 'function') return new Uint8Array(await object.arrayBuffer());
  if (object?.body instanceof Uint8Array) return object.body;
  return new Uint8Array(await new Response(object?.body).arrayBuffer());
}

/** REALM-GZIP: A STORED SAVE'S TEXT - packed (a tab's checkpoint) or plain (one from before, or the service's own write),
 *  opened within REALM_TEXT_MAX_BYTES - or null (no object, past the bound, not whole). */
export async function realmSaveTextOf(/** @type {any} */ object) {
  return object ? saveTextOf(await objectBytesOf(object), REALM_TEXT_MAX_BYTES) : null;
}

/**
 * AUDIT REALM2 S1: THE FIRST SAVE IS READ. The service took any bytes as a character's first checkpoint, so a character
 * "born online" could be any offline save (ten million gold, level sixty), customs' allowance was the client's alone to
 * apply - and the first save is the start every later check of the realm measures from. A character born online starts
 * as chargen starts one: level REALM_BIRTH_LEVEL, and no more liquid wealth than REALM_BIRTH_WEALTH_MAX ('realm-birth').
 * A customs character brings no more than the allowance at the level customs was asked at - the level on its row's
 * summary, which nothing writes before the first save lands, never the first save's own word ('customs-allowance').
 * Wealth is customs' own measure (net/realmGoldLaw.js liquidWealthOf): the purse, the banks, and every gold-piece item
 * and letter of credit wherever it lies. A save that is no JSON object is neither. Answers null, or `{ error }`.
 * REALM-GZIP: it reads the save's TEXT, opened by the checkpoint - a packed first save is measured as a plain one, and
 * one that will not open (null) is no JSON object.
 * @param {string | null} text @param {{ origin_id?: string | null, summary?: string | null }} row
 */
export function firstSaveRefusal(text, row) {
  let save = null;
  try { save = JSON.parse(text); } catch { save = null; }
  const shaped = !!save && typeof save === 'object' && !Array.isArray(save);
  if (!row.origin_id) {
    return shaped && save.level === REALM_BIRTH_LEVEL && liquidWealthOf(save) <= REALM_BIRTH_WEALTH_MAX ? null : { error: 'realm-birth' };
  }
  let level = null;
  try { level = JSON.parse(row.summary ?? 'null')?.level ?? null; } catch { level = null; }
  return shaped && liquidWealthOf(save) <= customsAllowance(level) ? null : { error: 'customs-allowance' };
}

/**
 * A CHECKPOINT: the save, under the current lease, at `seq + 1`. The row is asked first (a stale lease or sequence is
 * refused before a byte is written), the object lands at a key of its own, and the row moves to it only if the lease
 * and sequence still hold - so a join or a trade between the two leaves the current save untouched, and the losing
 * write's object is dropped. The save two back goes; the one before stays. Answers `{ ok, seq }` or `{ error }`:
 * 'lease' - another tab or device has the character now; 'seq' - not the next one, with the service's `seq` beside it,
 * so a tab whose last checkpoint landed but whose answer was lost can resync; the first save's own words
 * (firstSaveRefusal).
 * @param {any} ctx @param {string} playerId
 * @param {{ id: string, lease: unknown, seq: unknown, summary?: unknown }} at @param {ArrayBuffer} body @param {number} bytes
 */
export async function checkpointRealm({ db, bucket, rand, nowS }, playerId, { id, lease, seq, summary = null }, body, bytes) {
  if (!bucket) return { error: 'no-storage' };
  if (!REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease) || !Number.isSafeInteger(seq) || /** @type {number} */ (seq) < 1) return { error: 'body' };
  const row = await db.prepare('SELECT seq, lease, prev, origin_id, summary FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== lease) return { error: 'lease' };
  if (seq !== row.seq + 1) return { error: 'seq', seq: row.seq };   // the service's own: a client whose last answer was lost resyncs
  if (seq === 1) {
    // AUDIT REALM2 S1: a new character's, or customs' own - before a byte lands. REALM-GZIP: opened first, packed or not
    const refused = firstSaveRefusal(await saveTextOf(new Uint8Array(body), REALM_TEXT_MAX_BYTES), row);
    if (refused) return refused;
  }
  const key = mintObjectKey(rand, playerId, id, /** @type {number} */ (seq));
  await bucket.put(key, body);
  const moved = await db.prepare(
    'UPDATE realm_characters SET seq = ?, bytes = ?, obj = ?, prev = obj, lease_at = ?, summary = COALESCE(?, summary), updated_at = ?'
    + ' WHERE id = ? AND player = ? AND lease = ? AND seq = ?',
  ).bind(seq, bytes, key, nowS, realmSummaryOf(summary), nowS, id, playerId, lease, /** @type {number} */ (seq) - 1).run();
  if (!moved.meta.changes) {
    await dropObjects(bucket, [key]);
    // AUDIT REALM2 S7: WHY IT DID NOT MOVE, read again - two checkpoints under one lease (a retry beside a slow one, the
    // page's beside the timer's) race to one sequence, and the loser was told 'lease': "another tab has the character",
    // and its tab ended the session. Its own write won; 'seq', with the service's, is the truth, and the tab resyncs.
    return (await recordMovedOf(db, playerId, { id, lease, seq: /** @type {number} */ (seq) - 1 })) ?? { error: 'lease' };
  }
  await dropObjects(bucket, [row.prev]);   // two back now: the one before the last stays
  return { ok: true, seq };
}

/** THE SAVE, as it stands - for a join's load, and for "Copy to offline", which needs no lease: a copy played offline
 *  is an offline character and never comes back. Answers `{ ok, object, seq }` or `{ error }`. */
export async function getRealmBlob({ db, bucket }, /** @type {string} */ playerId, /** @type {string} */ id) {
  if (!bucket) return { error: 'no-storage' };
  if (!REALM_ID_RE.test(id)) return { error: 'body' };
  const row = await db.prepare('SELECT seq, bytes, obj FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (!row.seq || !row.bytes || !row.obj) return { error: 'no-data' };
  const object = await bucket.get(row.obj);
  return object ? { ok: true, object, seq: row.seq } : { error: 'no-data' };
}

// ── REALM P2.2: A REALM CHARACTER'S GOLD MOVES ON ITS RECORD ─────────

/** THE GUARD a batch step answers to (migration 0019's `realm_tx_guard`): placed right after an UPDATE that must change
 *  exactly `n` rows, it inserts only when that UPDATE changed another number, and the table's CHECK refuses the row - so
 *  D1 rolls the whole batch back. An UPDATE that matches nothing is not an error by itself; this makes it one. */
export const mustChange = (/** @type {any} */ db, n = 1) => db.prepare('INSERT INTO realm_tx_guard (moved, expected) SELECT changes(), ? WHERE changes() != ?').bind(n, n);

/** Where a tab says its record stands - `{ id, lease, seq }` - or null. */
export function realmAtOf(/** @type {any} */ v) {
  if (!v || typeof v !== 'object') return null;
  const { id, lease, seq } = v;
  if (typeof id !== 'string' || !REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease) || !Number.isSafeInteger(seq) || seq < 1) return null;
  return { id, lease, seq };
}

/**
 * A REALM CHARACTER'S RECORD, CHANGED WITH AN ACT - the service's half of every act online that costs or pays a realm
 * character gold: a guild's treasury, a founding, a home, a piece of decor. `at` is the record as its tab last
 * checkpointed it (the tab checkpoints just before, and holds its checkpoints until the answer, so the save read here
 * is the one it plays); `change(save)` changes it in place (net/realmGoldLaw.js payFromSave, creditSave) and answers
 * null, or a refusal's word. The record is written ONE SEQUENCE ON as a new object - but the row is not moved here: the
 * answer's `steps` go into the caller's OWN batch beside the act they pay for (the row's move and its guard), so the
 * gold and the act land together or neither does. After the batch the caller drops `prev` (it landed) or `key` (it did
 * not). Answers `{ steps, key, prev, seq }` or `{ error }`: 'lease' or 'seq' (the record is not where the tab says - a
 * checkpoint's own words, `seq` with the service's), `change`'s own word, 'no-data'.
 * @param {any} ctx @param {string} playerId @param {{ id: string, lease: string, seq: number }} at
 * @param {(save: any) => string | null} change
 */
export async function prepareRealmRecord({ db, bucket, rand, nowS }, playerId, at, change) {
  if (!bucket) return { error: 'no-storage' };
  const row = await db.prepare('SELECT seq, lease, obj, prev FROM realm_characters WHERE id = ? AND player = ?').bind(at.id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== at.lease) return { error: 'lease' };
  if (row.seq !== at.seq || !row.obj) return { error: 'seq', seq: row.seq };
  const object = await bucket.get(row.obj);
  let save = null;
  try { save = JSON.parse(await realmSaveTextOf(object)); } catch { save = null; }   // REALM-GZIP: packed or plain
  if (!save || typeof save !== 'object' || Array.isArray(save)) return { error: 'no-data' };
  const refused = change(save);
  if (refused) return { error: refused };
  const text = JSON.stringify(save);
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > REALM_TEXT_MAX_BYTES) return { error: 'no-data' };   // REALM-GZIP: written plain, within the text's bound
  const key = mintObjectKey(rand, playerId, at.id, at.seq + 1);
  await bucket.put(key, text);
  const steps = [
    db.prepare('UPDATE realm_characters SET seq = ?, bytes = ?, obj = ?, prev = obj, updated_at = ? WHERE id = ? AND player = ? AND lease = ? AND seq = ?')
      .bind(at.seq + 1, bytes, key, nowS, at.id, playerId, at.lease, at.seq),
    mustChange(db),
  ];
  return { steps, key, prev: row.prev, seq: at.seq + 1 };
}

/** AUDIT REALM2 S3: AFTER A BATCH THAT THREW, the object it wrote goes only if the row names it nowhere (`obj` or
 *  `prev`). D1 can commit a batch and lose its answer: every catch dropped the new object whatever the row said, and the
 *  row that had moved to it named a save that was gone - a trade's two records, a guild deposit's, the character's live
 *  save deleted and its next join 'no-data'. Answers whether the row names it (the batch landed). */
export async function dropIfUnnamed(/** @type {any} */ db, /** @type {any} */ bucket, /** @type {string} */ playerId, /** @type {string} */ id, /** @type {string} */ key) {
  const row = await db.prepare('SELECT obj, prev FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (row && (row.obj === key || row.prev === key)) return true;
  await dropObjects(bucket, [key]);
  return false;
}

/** After a batch that carried a record's move failed: the record's own reason - 'lease' (another tab holds it) or
 *  'seq' with the service's sequence (it moved) - or null when it still stands where the tab said, and the act's own
 *  write was what failed. */
export async function recordMovedOf(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {{ id: string, lease: string, seq: number }} */ at) {
  const row = await db.prepare('SELECT seq, lease FROM realm_characters WHERE id = ? AND player = ?').bind(at.id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== at.lease) return { error: 'lease' };
  return row.seq !== at.seq ? { error: 'seq', seq: row.seq } : null;
}

/**
 * THE REALM SIDE OF AN ACT, asked before the act: a realm character (its id the service's own shape - REALM_ID_RE,
 * minted only here) must say where its record stands (`realm`, `{ id, lease, seq }`, the same character), and any other
 * character may not. Answers `{ at }` for a realm character, `{ at: null }` for another, or `{ error }`.
 * @param {unknown} character @param {unknown} realm
 */
export function realmSideOf(character, realm) {
  const mine = typeof character === 'string' && REALM_ID_RE.test(character);
  if (!mine) return realm == null ? { at: null } : { error: 'body' };
  const at = realmAtOf(realm);
  if (!at || at.id !== character) return { error: 'realm-needed' };
  return { at };
}

/**
 * AUDIT REALM L1-F2: THE RECORD, ASKED FIRST. An act that moves a realm character's gold answers where its record
 * stands BEFORE any other word - a rank, a rate, a guild already joined, a house already held - because the client reads
 * a lost answer by it: an act sent again finds its record one on (`seq`, the service's own), and that is the act,
 * landed (systems/realmSaves.js realmGoldAct). Asked after them, a founding that landed was told 'guild-already' on its
 * retry, a deposit 'rate', a claim 'home-rate' - each read as "nothing moved" - and the tab gave itself the gold back
 * and checkpointed it over the record that had paid. Answers realmSideOf's `{ at }` (null for a character that is not
 * the realm's), or `{ error }` - 'lease', or 'seq' with the service's sequence.
 * @param {any} db @param {string} playerId @param {unknown} character @param {unknown} realm
 */
export async function realmActFirst(db, playerId, character, realm) {
  const side = realmSideOf(character, realm);
  if (side.error || !side.at) return side;
  return (await recordMovedOf(db, playerId, side.at)) ?? side;
}

/** A LEAVE: the lease given up, if it is still this tab's. Answers `{ ok, released }`. */
export async function leaveRealm({ db }, /** @type {string} */ playerId, /** @type {{ id: unknown, lease: unknown }} */ { id, lease }) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease)) return { error: 'body' };
  const r = await db.prepare('UPDATE realm_characters SET lease = NULL WHERE id = ? AND player = ? AND lease = ?').bind(id, playerId, lease).run();
  return { ok: true, released: r.meta.changes > 0 };
}

/** THE PLAYER'S OWN DELETE: its objects - the two the row names, and anything else under its prefix a lost write left
 *  - then the row: saves.js's order, so a failure halfway leaves a row whose bytes lie rather than objects nothing
 *  names. AUDIT REALM L1-F7 / L3-F5: AND ITS ONLINE LIFE WITH IT, as the door promises ("its home and its guild place
 *  with it"): the row's delete carries its homes (their pieces and hidden furniture go by the tables' own cascade), its
 *  guild place and its Renown track in ONE batch. They stood under a dead id: a house nobody could buy again nor its
 *  owner sell, a guild whose master could never be succeeded, a track that counted against the account's sixty
 *  (RENOWN-CHAR: the character's Renown goes with it again, as the door said before RENOWN-ACCOUNT).
 *  A guildmaster with members hands the guild over first ('guild-master-leaves', the guild's own word for leaving).
 *  AUDIT REALM2 S8: AND A LONE ONE EMPTIES THE TREASURY FIRST ('guild-treasury'), as leaving asks (guilds.js leaveGuild).
 *  The delete let it go with gold inside: a guild nobody is in, holding what its records paid in, until the next founder
 *  of its name or tag cleared it away, gold and all.
 *  HOUSE-LOSS: a customs character whose first save never landed is not deleted but UNDONE (undoCustoms, below).
 *  PROF-DELETE (2026-09-29, Mac's choice: "Goes with it; wait on trades"): AND ITS PROFESSIONS WITH IT - its Stores and
 *  its professions' tracks go in the same batch, as its Renown does; they stood under a dead id where nothing could
 *  reach them (MERGE 2's open question 3). What another player is part of waits: while the character has market
 *  business open ('realm-market-open', REALM_MARKET_OPEN_SQL) the delete is refused, since the goods or the piece it
 *  would be handed come to this character. The history (the ledger, the crafts, the sales) stays. */
export async function deleteRealm({ db, bucket, nowS = Math.floor(Date.now() / 1000) }, /** @type {string} */ playerId, /** @type {unknown} */ id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return { error: 'body' };
  const row = await db.prepare('SELECT obj, prev, bytes, origin_id FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.origin_id && !(row.bytes > 0)) return undoCustoms({ db, bucket }, playerId, id, row.origin_id);
  const master = await db.prepare(`SELECT (SELECT COUNT(*) FROM guild_members o WHERE o.guild_id = m.guild_id) AS n,
    (SELECT treasury FROM guilds g WHERE g.id = m.guild_id) AS treasury,
    (SELECT 1 FROM homes h WHERE h.guild_id = m.guild_id) AS hall FROM guild_members m
    WHERE m.player = ? AND m.char_id = ? AND m.rank = ?`).bind(playerId, id, GUILD_RANK_MASTER).first();
  if ((master?.n ?? 0) > 1) return { error: 'guild-master-leaves' };
  if ((master?.treasury ?? 0) > 0) return { error: 'guild-treasury' };
  // AUDIT GUILD1d S1: and a lone one sells its guild's hall first - deleted, the guild stood memberless with the hall,
  // which kept it from ever being reclaimed (guildKeepsSql): the building, the name and the deed share gone for good
  if (master?.hall) return { error: 'guild-hall' };
  if (Number((await db.prepare(REALM_MARKET_OPEN_SQL).bind(playerId, id).first())?.n ?? 0) > 0) return { error: 'realm-market-open' };
  // HOME-RENT: a room another player is renting in its home waits for its days to run out, and rent held for it waits to
  // be collected - the delete takes the home with it. AUDIT: then no room of it is offered any more, and both are asked
  // again - a rent landing between the first asking and the delete's batch was deleted with the home (a rent needs its
  // room offered, so none can land after the offers go)
  const homeHeld = async () => {
    if (Number((await db.prepare(HOME_TENANTS_SQL).bind(playerId, id, nowS).first())?.n ?? 0) > 0) return { error: 'home-tenants' };
    if (Number((await db.prepare(HOME_RENT_DUE_SQL).bind(playerId, id).first())?.due ?? 0) > 0) return { error: 'home-rent-due' };
    return null;
  };
  const held = await homeHeld();
  if (held) return held;
  await db.prepare(`UPDATE home_rooms SET listed = 0 WHERE EXISTS (SELECT 1 FROM homes h WHERE h.map_id = home_rooms.map_id
    AND h.building_key = home_rooms.building_key AND h.player = ? AND h.char_id = ?)`).bind(playerId, id).run();
  const late = await homeHeld();
  if (late) return late;
  await dropCharacterObjects(bucket, playerId, id, [row.obj, row.prev]);
  await db.batch([
    db.prepare('DELETE FROM homes WHERE player = ? AND char_id = ?').bind(playerId, id),
    db.prepare('DELETE FROM guild_members WHERE player = ? AND char_id = ?').bind(playerId, id),
    db.prepare('DELETE FROM renown_tracks WHERE player = ? AND char_id = ?').bind(playerId, id),
    db.prepare('DELETE FROM prof_stores WHERE player = ? AND char_id = ?').bind(playerId, id),   // PROF-DELETE
    db.prepare('DELETE FROM prof_tracks WHERE player = ? AND char_id = ?').bind(playerId, id),   // PROF-DELETE
    db.prepare('DELETE FROM prof_unbruised WHERE player = ? AND char_id = ?').bind(playerId, id),   // AUDIT PROF-541 B5: the unbruised count goes with the Stores it counts
    db.prepare('DELETE FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId),
  ]);
  return { ok: true };
}

/** HOME-RENT (2026-09-30): THE TENANCIES STILL RUNNING in a character's homes - a sale (homes.js) or the character's
 *  delete waits for them: another player paid for those days. `?1` the account, `?2` the character, `?3` now; `n`. */
export const HOME_TENANTS_SQL = `SELECT COUNT(*) AS n FROM home_rooms r JOIN homes h ON h.map_id = r.map_id AND h.building_key = r.building_key
  WHERE h.player = ?1 AND h.char_id = ?2 AND r.tenant IS NOT NULL AND r.until > ?3`;
/** HOME-RENT: the rent held on a character's homes, not yet collected (`due`) - its delete waits for it too. */
export const HOME_RENT_DUE_SQL = 'SELECT COALESCE(SUM(rent_due), 0) AS due FROM homes WHERE player = ?1 AND char_id = ?2';

/** PROF-DELETE: A CHARACTER'S MARKET BUSINESS STILL OPEN (`?1` the account, `?2` the character) - each a thing another
 *  player is part of whose goods, piece or Marks' worth would come to this character: a listing or an auction still
 *  standing, or closed with its goods not yet back (market.js settle hands them back on the next read); a leading bid; a
 *  buy order or a commission still open; a courier's load of materials still on the road to its Stores; a piece to
 *  collect; gold its sales hold for it (GOLD-MARKET: collected into its own record alone). Escrowed Marks come back to
 *  the ACCOUNT, never the character, so an outbid bid or a closed order holds nothing up. `n`, the count. */
export const REALM_MARKET_OPEN_SQL = `SELECT
  (SELECT COUNT(*) FROM market_listings WHERE seller = ?1 AND char_id = ?2
    AND (state = 'open' OR (state IN ('expired', 'removed') AND returned = 0)))
  + (SELECT COUNT(*) FROM market_auctions WHERE seller = ?1 AND char_id = ?2
    AND (state = 'open' OR (state IN ('unsold', 'removed') AND returned = 0)))
  + (SELECT COUNT(*) FROM market_bids WHERE bidder = ?1 AND char_id = ?2 AND state = 'high')
  + (SELECT COUNT(*) FROM market_orders WHERE poster = ?1 AND char_id = ?2 AND state = 'open')
  + (SELECT COUNT(*) FROM commissions WHERE poster = ?1 AND poster_char = ?2 AND state = 'open')
  + (SELECT COUNT(*) FROM market_sales WHERE buyer = ?1 AND char_id = ?2 AND kind = 'material' AND delivered = 0)
  + (SELECT COUNT(*) FROM market_deliveries WHERE player = ?1 AND char_id = ?2 AND collected = 0)
  + (SELECT COUNT(*) FROM market_gold WHERE player = ?1 AND char_id = ?2 AND gold > 0) AS n`;

/** A character's objects: the ones its row names, and anything else under its prefix a lost write left. Best effort -
 *  an object that will not go is not a reason to keep the row. */
async function dropCharacterObjects(/** @type {any} */ bucket, /** @type {string} */ playerId, /** @type {string} */ id, /** @type {(string | null | undefined)[]} */ named) {
  if (!bucket) return;
  await dropObjects(bucket, named);
  if (typeof bucket.list !== 'function') return;
  try {
    const listed = await bucket.list({ prefix: `${realmPrefix(playerId)}${id}/` });
    await dropObjects(bucket, (listed?.objects ?? []).map((/** @type {any} */ o) => o.key));
  } catch { /* the walk is the sweep's, not the delete's */ }
}

/**
 * HOUSE-LOSS (2026-09-29, the field through Mac: "GarySoup lost his house and furniture. I suspect a lot of people lost a
 * ton of belongings"): A CUSTOMS THAT NEVER LANDED IS UNDONE BY ITS DELETE, never a delete of what it carried. Customs
 * carries the origin's home, guild place and track to the realm's id in the census's own batch, before the first save is
 * sent (CUSTOMS-CARRY), and a first save can fail - refused, too large, lost on the way. The door then showed a "Never
 * saved" tile whose one live button was Delete, and said "Delete it and make it again"; the delete took the home, its
 * pieces and its hidden furniture with it (the tables' cascade) and left the census spent, so the character could never
 * come in again to take them back. Nothing of a character whose first save never landed ever played in the realm - it
 * has no record, and every act, trade and purchase asks one at sequence 1 or on - so its undoing is the realm as it stood
 * before that customs, exactly: what customs carried goes back to the offline id, and the census rows customs spent are
 * unspent (it spent every one of the character's). CUSTOMS-PASS: a pass spent on the character is given back with the
 * census row it wrote - open again, or, when a developer has granted the account another since (one open pass an
 * account, 0024's index), its record dropped, since the customs it recorded never stood. The row goes only while its
 * first save still has not landed (`bytes = 0`, guarded): a save landing in the same moment keeps the character, and the
 * delete says so (`seq`).
 * @param {any} ctx @param {string} playerId @param {string} id @param {string} originId
 */
async function undoCustoms({ db, bucket }, playerId, id, originId) {
  try {
    await db.batch([
      db.prepare('DELETE FROM realm_characters WHERE id = ? AND player = ? AND bytes = 0').bind(id, playerId),
      mustChange(db),
      ...customsCarry(db, playerId, id, originId),   // the carry, run back: from the realm's id to the offline one
      // the pass's census row (a pass is spent only where this account's census counted no such character), asked before
      // the pass comes back below
      db.prepare('DELETE FROM realm_census WHERE player = ? AND char_id = ? AND EXISTS (SELECT 1 FROM realm_passes WHERE player = ? AND origin_id = ?)')
        .bind(playerId, originId, playerId, originId),
      db.prepare('UPDATE realm_passes SET origin_id = NULL, spent_at = NULL WHERE player = ? AND origin_id = ?'
        + ' AND NOT EXISTS (SELECT 1 FROM realm_passes WHERE player = ? AND spent_at IS NULL)').bind(playerId, originId, playerId),
      db.prepare('DELETE FROM realm_passes WHERE player = ? AND origin_id = ?').bind(playerId, originId),
      db.prepare('UPDATE realm_census SET spent = 0 WHERE char_id = ? AND NOT EXISTS (SELECT 1 FROM realm_characters WHERE origin_id = ?)').bind(originId, originId),
    ]);
  } catch (e) {
    const now = await db.prepare('SELECT seq FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
    if (now) return { error: 'seq', seq: now.seq };   // its first save landed in the meantime: a character now, kept
    throw e;
  }
  await dropCharacterObjects(bucket, playerId, id, []);
  return { ok: true, undone: true };
}

/** HOUSE-LOSS: THE DOOR'S OWN UNDO - "Undo bringing in", on a customs character whose first save never landed. Its own
 *  route, so a door newer than its service is told `not-found` by the old one rather than handed a delete that takes
 *  what customs carried; and it never deletes anything else - one born online is no customs to undo (`body`), and one
 *  whose first save has landed is `seq`, by undoCustoms' own guard.
 *  @param {any} ctx @param {string} playerId @param {unknown} id */
export async function undoRealm({ db, bucket }, playerId, id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return { error: 'body' };
  const row = await db.prepare('SELECT origin_id FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (!row.origin_id) return { error: 'body' };
  return undoCustoms({ db, bucket }, playerId, id, row.origin_id);
}
