// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1b — THE ACCOUNT LAW: everything the service decides, with the
// I/O held at arm's length.
//
// `index.js` is the Worker - the routes, the JSON, the CORS. This file
// is what it decides, over a `db` that is only ever asked for
// `prepare(sql).bind(...).first()/run()/all()`. D1 answers that, and so
// does a fake of forty lines, which is why every law below is driven in
// node rather than reasoned about.
//
// ═══ THE THINGS THAT ARE NOT NEGOTIABLE HERE ═══════════════════════
//
//   A SECRET IS RETURNED ONCE AND STORED AS A HASH. A copy of the
//   sessions table is not a copy of anybody's credentials.
//
//   A SESSION IS THE CREDENTIAL, one per device. This is Fight Life's
//   FIX, carried over - not a bug of theirs we sidestepped. They shipped
//   one secret per player and rotated it on sign-in, which made two
//   devices mutually exclusive (a desktop sign-in silently 401'd the
//   phone on every write); Mac hit it farming on one device while
//   playing on the other, and their Account-First arc replaced it with
//   a sessions table. `fight-life-source/server/schema.sql` carries that
//   whole account, and the shape here - a row per device, sign-out
//   revoking THIS session, "everywhere" a separate act, one indexed
//   lookup on the hot path - is theirs. AUDIT-ACC F6 corrected this
//   comment, which had read as though the bug were still live over
//   there.
//
//   THE DISPLAYED NAME IS DERIVED, never stored twice: a handle if the
//   player has chosen one, the generated name otherwise. One function,
//   so the service and the token can never disagree about what a player
//   is called.
//
//   EVERY CLOCK IS AN ARGUMENT. Not one line here reads Date.now.
// ═══════════════════════════════════════════════════════════════════

import { guestName, isHandleShaped, isGuestShaped } from './guestName.js';
import { handleLooksLikeEmail } from '../../src/net/handleShape.js';   // HANDLE-EMAIL: a username is never an address
import { NAME_MAX } from '../../src/net/wire.js';   // NAME-AS: the wire's bound on a name, a worn character's among them
import { checkName } from '../../src/net/nameFilter.js';   // NAME-AS: which word a character's name was refused for (NAME-F: a refusal names it)
import { wardrobeOf, equipRefusal, canModerate, isDeveloper, auraRefusal, glyphRefusal, glyphsHidden, iconRefusal } from './titles.js';   // ACC3: what a player holds, wears and is true of - all four derived; WB9g: and the aura worn
import { brokerRidOk, brokerSaleOf, brokerSaleWrite, brokerRidFreeSql } from './brokerSales.js';   // AUDIT FB1024 (BROKER-RID): a press by its request id
import { insigniaById, insigniaHeld } from '../../src/net/insignia.js';   // WB9g: the Broker's insignia - one law both ends
import { ID_RE, nameIsIssuable } from '../../src/net/identityToken.js';
import { PLAY_GRACE_S } from '../../src/net/playClock.js';   // ACC4: the widest gap one beat may credit - one home both ends
import { MUTE_MAX_MIN } from '../../src/net/moderation.js';   // MOD1: the longest mute - the command and the service agree in one place
import { verifyReceipt } from '../../src/net/gate/gateReceipt.js';   // WB5b: the relay's kill receipt, verified with its public half
import { verifyDuelReceipt } from '../../src/net/duel/duelReceipt.js';   // INT8: a duel's result, the relay's
import { TERMS_VERSION, PRIVACY_VERSION, LEGAL_VERSION_RE } from '../../src/net/legalLaw.js';   // TERMS1: the documents a new account agrees to - one home both ends
import {
  hashPassword, verifyPassword, needsRehash, passwordRefusal,
  mintRecoveryCode, codeForHashing,
  mintRecoverySet, hashRecoverySet, joinRecoverySet, matchRecoveryCode, recoveryLeft,   // RECOVERY-SET: eight codes, each spent alone
} from './password.js';
import { seatRegionOk } from '../../src/net/townSeatLaw.js';   // SEAT1b: a gate claim's region
import { DB_ANY, DB_ROOT } from './service.js';   // BOOKMARK-SPIRAL: a session started at any instance, and the binding behind it

/** A session's raw secret, in bytes. 32 bytes of CSPRNG is the whole
 *  of the credential; nothing about the player is encoded in it. */
export const SECRET_BYTES = 32;
/** How long a session may sit unused before a sweep may take it. A
 *  year, because a player who opens the game twice a year is still that
 *  player and their friends list is still theirs. */
export const SESSION_IDLE_S = 365 * 24 * 60 * 60;
/** SCALE1 (2026-09-30, the scaling audit - Mac: "set the stage for a larger player base"): HOW STALE `last_seen` MAY
 *  GROW before a request writes it again. Every authenticated call wrote both rows, two of its three D1 writes, and
 *  D1 has one writer for the whole service. Nothing reads the column finer than this: the idle bound is a year, and
 *  the device list orders by it. SCALE4h (2026-10-11, "10k writes"): an hour, not ten minutes - still nothing reads it
 *  finer, and a session's touch is one hot row the plan named (bible/11-Multiplayer/Scale-Arc.md SCALE4h). */
export const SESSION_TOUCH_S = 60 * 60;

const b64url = (bytes) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** An id in SOC1's own shape. The social arc already keeps account ids
 *  under `/^[A-Za-z0-9_-]{4,40}$/`, and the identity token carries that
 *  same shape - so an id minted here is one the hub could hold and one
 *  a token can name, without anybody converting anything. */
export function mintId(rand) {
  const b = new Uint8Array(18);
  rand(b);
  const id = b64url(b);
  if (!ID_RE.test(id)) throw new Error('mintId produced an id outside the shape every end agrees on');
  return id;
}

/** The raw secret a device keeps, and the hash the table keeps. */
export function mintSecret(rand) {
  const b = new Uint8Array(SECRET_BYTES);
  rand(b);
  return b64url(b);
}

/** SHA-256, hex. The only thing the table ever sees. */
export async function hashSecret(secret, { subtle }) {
  const d = await subtle.digest('SHA-256', new TextEncoder().encode(String(secret ?? '')));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * WHAT A PLAYER IS CALLED, and the one place it is decided. A handle
 * once they have chosen one, the name the world gave them otherwise.
 *
 * The two can never be confused, and that is structural rather than
 * checked: a generated name carries exactly one space and a handle
 * carries none (server-account/src/guestName.js). So a guest cannot be
 * assigned a name that collides with somebody's account, and a player
 * can tell which they are looking at without being told.
 * @param {{handle?: string|null, guest_name?: string|null}} row
 */
export function displayName(row) {
  const handle = row?.handle;
  if (typeof handle === 'string' && handle.length > 0 && !handleLooksLikeEmail(handle)) return handle;   // HANDLE-EMAIL: an address is never read out
  return String(row?.guest_name ?? '');
}

/** Guest or linked. ACC1b has no links yet, so every row is a guest -
 *  the function exists now so the token's `k` has ONE source from the
 *  first day rather than a second one bolted on beside it. */
export function accountKind(row) {
  return row?.handle ? 'linked' : 'guest';
}

/**
 * NAME-AS (2026-10-12, Mac: "I want to add an option to the profile menu where players can toggle to use their account
 * name or character name for ingame use"): WHICH NAME THE ROOM READS - the account's (displayName, above) or the realm
 * character's the token is minted for (wornNameOf, below). The row stores the second alone (`name_as` 'character',
 * migration 0111), so a row that never chose reads as the account, as every player read before.
 */
export const NAME_AS = Object.freeze(['account', 'character']);
/** NAME-AS: the choice this row holds - 'character', or the account's for anything else (null, a word no build wrote). */
export const nameAsOf = (/** @type {any} */ row) => (row?.name_as === 'character' ? 'character' : 'account');

/**
 * NAME-AS: WHY A CHARACTER'S NAME CANNOT BE WORN AS IT STANDS - null where it can. The token's own law asked as a
 * question (identityToken.js nameIsIssuable: the wire carries the name unchanged - claimsValid refuses a token whose `n`
 * it would not, so a name signed past it is a player who cannot connect), its refusals told apart so the player can be
 * told which: 'email' (HANDLE-EMAIL's law, worn as it is chosen - an address is never read out, and a character's name is
 * read out to everyone), 'long' (past NAME_MAX), 'refused' (the name filter's, with the word it caught - NAME-F: a
 * refusal names it), 'letters' (characters the wire does not carry - an accent, a symbol past plain text - or no letters
 * at all). A realm name is trimmed and printable already (realm.js realmNameOf); this is the wire's narrower law.
 * @param {unknown} name
 * @returns {{ why: 'email'|'long'|'refused'|'letters', word?: string } | null}
 */
export function wornNameRefusal(name) {
  const s = typeof name === 'string' ? name : '';
  if (handleLooksLikeEmail(s)) return { why: 'email' };
  if (nameIsIssuable(s)) return null;
  if (s.length > NAME_MAX) return { why: 'long' };
  const verdict = checkName(s);
  if (!verdict.ok && verdict.kind !== 'empty') return { why: 'refused', word: verdict.word };
  return { why: 'letters' };
}

/**
 * NAME-AS: THE NAME THE MINT SIGNS (the token's `n`) - `{ name }`, and `why` (with `word`, for the filter's) where the row
 * chose its character's and that name cannot be worn, so the account's stands in its place and the mint's answer says
 * why (`nameWhy` - the player is told once, scenes/world.js adoptIssued).
 *
 * THE CHARACTER'S NAME IS THE SERVICE'S, NEVER THE CLIENT'S: `character` is the realm character's own name, off the row
 * the token is minted for (realm.js realmMintFacts - a realm character of this account, standing and in play), never a
 * word of the request (test/server/accountworker.test.js: a name in the body never reaches the token). None - no character
 * named, an offline one, another account's, a tombstone - is the account's, and silently: there is nothing to wear.
 *
 * AND NEVER ANOTHER ACCOUNT'S USERNAME. A handle is unique (0001's handle_lc index) and is how an account is found - a
 * letter, an invitation, a commission are each addressed by username - and handleShape.js keeps the guests' generated
 * names out of that space by their shape alone. A character's name is chosen at chargen, so its shape promises nothing:
 * one that is another account's username would walk every room wearing that account's name. So it is asked here, ONE
 * read of the unique index, and only of a name that could be a handle at all (one word, HANDLE_RE - a name with a space
 * in it never can). The player's own handle is theirs to wear as their character's name.
 * @param {{db: any}} ctx @param {any} player the session's row @param {unknown} character
 * @returns {Promise<{ name: string, why?: string, word?: string }>}
 */
export async function wornNameOf({ db }, player, character) {
  const account = displayName(player);
  if (nameAsOf(player) !== 'character' || typeof character !== 'string' || !character) return { name: account };
  const refused = wornNameRefusal(character);
  if (refused) return { name: account, ...refused };
  if (isHandleShaped(character)) {
    const other = await db.prepare('SELECT 1 AS taken FROM players WHERE handle_lc = ? AND id != ?').bind(character.toLowerCase(), player.id).first();
    if (other) return { name: account, why: 'taken' };
  }
  return { name: character };
}

/**
 * NAME-AS: CHOOSE WHICH NAME THE ROOM READS - 'account' or 'character' (NAME_AS); any other word is refused
 * `no-name-as`. Either is always allowed: a player may always wear their account's name, and a character's is vetted
 * where it is worn (wornNameOf, at every mint) rather than here - the character it names is whichever the next mint is
 * for. The row keeps the second alone ('character'; the account's is null, as every row that never chose). Answers the
 * choice as the row now holds it, so the caller never re-reads to know what it did.
 * @param {{db: any, nowS: number}} ctx @param {any} player @param {unknown} as
 */
export async function chooseNameAs({ db, nowS }, player, as) {
  if (!NAME_AS.includes(/** @type {any} */ (as))) return { error: 'no-name-as' };
  await db.prepare('UPDATE players SET name_as = ?, last_seen = ? WHERE id = ?').bind(as === 'character' ? 'character' : null, nowS, player.id).run();
  return { ok: true, nameAs: as };
}

/**
 * A NEW PLAYER. Mints the id, the generated name and the device's first
 * session, and hands back the one and only copy of the raw secret.
 *
 * TERMS1: `legal` is what its player agreed to - the route has already
 * refused anybody who did not (`legalRefusal`), and the row keeps it.
 *
 * @param {{db: any, subtle: SubtleCrypto, rand: (b: Uint8Array) => void, nowS: number}} env
 * @param {{deviceLabel?: string|null, legal?: {terms: string, privacy: string}|null}} [opts]
 */
export async function createGuest({ db, subtle, rand, nowS }, { deviceLabel = null, legal = null } = {}) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('createGuest needs an integer epoch-seconds clock');
  const id = mintId(rand);
  const name = guestName(rand);
  // A name that cannot ride a token is an account that cannot play, and
  // the place to learn that is the mint.
  //
  // THIS USED TO SAY "the bank is the game's own, so this should never
  // fire", AND THAT WAS FALSE. AUDIT-ACC F7 multiplied the bank out -
  // 173,330 names - and found four at 25 characters against a NAME_MAX
  // of 24, all sharing the surname `Larethbinder`. Roughly one guest in
  // 43,000 hit this line and got a 500 instead of an account.
  //
  // `guestName` rejects those draws now, so this is a postcondition
  // rather than a hope: it fires only if the generator's own guarantee
  // has broken, which is worth a 500 because nothing else would be
  // trustworthy either.
  if (!nameIsIssuable(name) || !isGuestShaped(name)) throw new Error(`guestName produced an unusable name: ${name}`);
  await db.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, terms_version, privacy_version, legal_accepted_at) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)')
    .bind(id, name, nowS, nowS, ...legalColumns(legal, nowS)).run();
  const session = await openSession({ db, subtle, rand, nowS }, id, deviceLabel);
  return { id, name, kind: 'guest', ...session };
}

/**
 * A NEW DEVICE for an existing player. The raw secret is returned here
 * and nowhere else, ever again.
 */
export async function openSession({ db, subtle, rand, nowS }, playerId, deviceLabel = null) {
  const secret = mintSecret(rand);
  const sessionId = mintId(rand);
  const hash = await hashSecret(secret, { subtle });
  // A label is for a human reading a device list. It is truncated and
  // never trusted - a device is what holds the secret, not what it
  // calls itself.
  const label = typeof deviceLabel === 'string' ? deviceLabel.slice(0, 64) : null;
  await db.prepare('INSERT INTO sessions (id, player_id, secret_hash, device_label, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(sessionId, playerId, hash, label, nowS, nowS).run();
  return { sessionId, secret };
}

/** SCALE4a (2026-10-08, Mac: "Do 1 2 and 3" - the session and its player were two reads in a row, 4.86 and 4.73 million
 *  of the database's 17.4 million the day before YARD-SHED): THE SESSION'S COLUMNS, named, each read under a `s.` prefix
 *  no column of `players` can carry, so one row holds both without a name in common (`id`, `created_at`, `last_seen`).
 *  The table's own six (0001_accounts.sql; no migration has altered it) - test/server/scale4a.test.js holds this list to the
 *  migrations' table, so a column added there is a pin that fails until it is named here. */
export const SESSION_COLUMNS = Object.freeze(['id', 'player_id', 'secret_hash', 'device_label', 'created_at', 'last_seen']);
/** SCALE4a: the session by its hash and its player beside it, in ONE statement. LEFT, so a session whose player is gone
 *  still comes back (its player's columns NULL) and meets the same exits it met as two reads: the idle one is deleted
 *  first, the orphan refused. */
const WHO_SQL = `SELECT ${SESSION_COLUMNS.map((c) => `s.${c} AS "s.${c}"`).join(', ')}, p.*
  FROM sessions s LEFT JOIN players p ON p.id = s.player_id WHERE s.secret_hash = ?`;

/**
 * WHO IS THIS? Resolved by the secret alone, in ONE indexed lookup -
 * the caller has not proved a player id yet, so it cannot be part of
 * the question.
 *
 * Answers the player row plus the session, or null. Never throws on a
 * bad secret, because a bad secret is the ordinary case.
 *
 * SCALE4a: the lookup is one STATEMENT now, the player read with it
 * (WHO_SQL) - the same two rows `SELECT * FROM sessions` and `SELECT *
 * FROM players` answered, from one consistent read.
 *
 * @returns {Promise<{player: any, session: any}|null>}
 */
export async function resolveSession({ db, subtle, nowS }, secret) {
  if (typeof secret !== 'string' || secret.length < 16 || secret.length > 128) return null;
  const hash = await hashSecret(secret, { subtle });
  let row = await db.prepare(WHO_SQL).bind(hash).first();
  // BOOKMARK-SPIRAL (service.js ANY_REPLICA_ROUTES): a session started at any instance may stand on a replica that has
  // not yet heard of a session minted a moment ago - its miss asks the primary before it is a refusal
  if (!row && db?.[DB_ANY] === true) row = await (db[DB_ROOT] ?? db).prepare(WHO_SQL).bind(hash).first();
  if (!row) return null;
  /** @type {any} */ const session = {};
  /** @type {any} */ const found = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('s.')) session[k.slice(2)] = v;
    else found[k] = v;
  }

  // ═══ AUDIT-ACC F9: AN IDLE SESSION IS DEAD, AND IT IS DELETED ════
  //
  // `SESSION_IDLE_S` was declared above, documented as "how long a
  // session may sit unused before a sweep may take it", and then USED
  // BY NOTHING. There was no sweep. A session never expired, so an
  // abandoned credential - a shared machine, an old phone, a leaked
  // backup - worked forever.
  //
  // Fight Life enforces it HERE rather than in a sweep, which is the
  // better shape and is what is carried over: the check costs nothing
  // on the path that already loaded the row, and it needs no scheduled
  // job that can silently stop running. THE ROW IS DELETED rather than
  // merely refused, so a dead credential stops existing instead of
  // being rejected forever.
  if (Number.isSafeInteger(nowS) && Number.isSafeInteger(session.last_seen)
      && nowS - session.last_seen > SESSION_IDLE_S) {
    try {
      await db.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();
    } catch { /* the refusal below is what matters; the row is retried next time */ }
    return null;
  }

  // SCALE4a: the player came with the session (WHO_SQL's LEFT JOIN) -
  // its `id` NULL when no row of `players` stood behind it.
  const player = found.id == null ? null : found;
  // A session whose player is gone is not a session. It cannot happen
  // through the cascade, and it is checked because "cannot happen" is
  // how a null reaches a caller that reads `.handle` off it.
  if (!player) return null;

  // ═══ AUDIT-ACC F10: A FAILED TOUCH MUST NOT FAIL THE REQUEST ═════
  //
  // These two writes were unguarded, so a D1 hiccup on a freshness
  // update turned an authorised request into a 500. The call is already
  // authorised by the time we get here and a stale `last_seen` is
  // cosmetic - Fight Life learnt this and says so at its own touch.
  //
  // NOTE FOR ACC2: `players.last_seen` is WRITTEN here and read
  // nowhere. A player's last-seen is the max of their sessions'
  // last_seen, which `devicesOf` already orders by, so the column is
  // derivable. It is still written because a column that silently stops
  // being maintained is worse than one that costs a write, and dropping
  // it is a migration rather than an audit's business.
  //
  // SCALE1: ONLY WHEN IT HAS GONE STALE (SESSION_TOUCH_S), and both rows
  // in one round trip. It was written on every call - two of the three
  // writes every authenticated request paid before its own work, on a
  // database with one writer.
  const stale = !Number.isSafeInteger(session.last_seen) || nowS - session.last_seen >= SESSION_TOUCH_S;
  if (Number.isSafeInteger(nowS) && stale) {
    try {
      await db.batch([
        db.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').bind(nowS, session.id),
        db.prepare('UPDATE players SET last_seen = ? WHERE id = ?').bind(nowS, player.id),
      ]);
    } catch { /* cosmetic: the caller is authorised either way */ }
  }
  return { player, session };
}

/** Revoke ONE session - this device, and no other. */
export async function closeSession({ db }, sessionId) {
  const r = await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  return { revoked: r?.meta?.changes ?? 0 };
}

/** Revoke EVERY session - the separate, explicit act. */
export async function closeAllSessions({ db }, playerId) {
  const r = await db.prepare('DELETE FROM sessions WHERE player_id = ?').bind(playerId).run();
  return { revoked: r?.meta?.changes ?? 0 };
}

/** STAFF-PANEL2-FIX (design doc, Weak spots: "a password change ends staff sessions too"): every staff panel session of
 *  the account (staff.js) ended - a password changed or recovered is somebody who may have held the old one. */
export const closeStaffSessions = ({ db }, playerId) => db.prepare('DELETE FROM staff_sessions WHERE player_id = ?').bind(playerId).run();

/** The device list a player sees. No secrets and no hashes leave here -
 *  a hash is a credential's shadow and there is no reason to ship one. */
export async function devicesOf({ db }, playerId) {
  const r = await db.prepare('SELECT id, device_label, created_at, last_seen FROM sessions WHERE player_id = ? ORDER BY last_seen DESC LIMIT 50')
    .bind(playerId).all();
  return (r?.results ?? []).map((s) => ({
    sessionId: s.id, label: s.device_label ?? null, createdAt: s.created_at, lastSeen: s.last_seen,
  }));
}

/** Is this player muted, and until when? ACC0's soft mitigation, read
 *  in one place so a caller cannot forget the comparison. */
export const mutedUntil = (row) => (Number.isSafeInteger(row?.muted_until) ? row.muted_until : 0);
export const isMuted = (row, nowS) => mutedUntil(row) > nowS;


/**
 * MOD1 - MUTE (or, at `minutes` 0, UNMUTE) ONE ACCOUNT.
 *
 * Mac: "moderator chat commands" - /mute and /unmute.
 *
 * THE AUTHORITY IS DERIVED, like every grant in titles.js: the actor's
 * handle in MODERATOR_HANDLES or DEVELOPER_HANDLES, read now. Nothing a
 * client says makes it a moderator.
 *
 * A MODERATOR CANNOT MUTE A MODERATOR, NOR THEMSELVES. A mod-on-mod
 * fight is a thing for Mac to settle, not for whoever types first; and
 * a self-mute is only ever a typo.
 *
 * `muted_by` is written beside it, so a mute always says who did it -
 * a power with no record is a power nobody can review.
 */
export async function muteAccount({ db, nowS }, actor, env, { target, minutes, also = null }) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  if (typeof target !== 'string' || !ID_RE.test(target)) return { error: 'no-player' };
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > MUTE_MAX_MIN) return { error: 'bad-minutes' };
  if (target === actor.id) return { error: 'protected' };
  const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(target).first();
  if (!row) return { error: 'no-player' };
  if (canModerate(row, env)) return { error: 'protected' };
  const until = minutes ? nowS + minutes * 60 : null;
  // STAFF-PANEL2-FIX (design doc, Weak spots: "A Moderator can lift an Admin's ban" - "Store who set each sanction;
  // lifting an Admin's needs an Admin"): a mute an Admin set (`mute_admin`, 0156) is lifted or cut short by an Admin
  // alone, and stays the Admin's when another moderator lengthens it
  const adminHeld = row.mute_admin === 1 && isMuted(row, nowS);
  const admin = isDeveloper(actor, env);
  if (adminHeld && !admin && (until ?? 0) < Number(row.muted_until)) return { error: 'admin-sanction' };
  const write = db.prepare('UPDATE players SET muted_until = ?, muted_by = ?, mute_admin = ? WHERE id = ?')
    .bind(until, until ? actor.id : null, until ? (admin || adminHeld ? 1 : 0) : null, target);
  const done = { ok: true, target, name: displayName(row), until: until ?? 0 };
  // STAFF-PANEL2-FIX: `also(answer)`, the caller's own statements for this write's batch (safety.js modAct: the act's
  // record and its case closed, so they land with the mute or none does); without it the one write, as before
  await (also ? db.batch([write, ...also(done)]) : write.run());
  return done;
}

/**
 * The public picture of an account. Everything a client is told and
 * nothing else - no hash, no session secret, no internal column.
 */
export function accountView(player, nowS) {
  return {
    // AUDIT-ACC F4: `id`, not `playerId`. /v1/auth/guest and
    // /v1/auth/login have always answered `id`, the header comment
    // documented `playerId`, and this view returned `playerId` - the
    // same field under two names in one API, which is a bug waiting for
    // ACC1d to read `account.id` and get undefined. Nothing consumes
    // this yet, so it costs nothing to settle now.
    id: player.id,
    name: displayName(player),
    kind: accountKind(player),
    handle: player.handle ?? null,
    guestName: player.guest_name,
    createdAt: player.created_at,
    // ACC4: the two facts on the profile card. `registeredAt` is null
    // for a guest - there is no date to show, and 0 would be 1970.
    registeredAt: Number.isSafeInteger(player.registered_at) ? player.registered_at : null,
    playedS: Number.isSafeInteger(player.played_s) ? player.played_s : 0,
    muted: isMuted(player, nowS),
    // NAME-AS: which name the room reads - the profile card's choice, as the row holds it
    nameAs: nameAsOf(player),
    // RECOVERY-SET: how many recovery codes still open this account - a COUNT, never a code or its hash (null for a guest)
    recoveryLeft: recoveryLeft(player.recovery_hash),
  };
}

/**
 * ACC4 - ONE BEAT OF TIME PLAYED, credited by THIS clock.
 *
 * The client sends no number (src/net/playClock.js says why). The gap
 * from the account's last beat to now is credited if it is positive and
 * no wider than PLAY_GRACE_S; anything wider is a new sitting and
 * credits nothing. Either way the beat becomes the last one.
 *
 * ONE STATEMENT, AND THAT IS THE CORRECTNESS. Read-then-write would let
 * two tabs beating the same account both read the same `played_at` and
 * both credit the same minutes. SQLite runs one UPDATE at a time, so
 * the gap is always measured from whichever beat really landed last -
 * two tabs count the wall clock once. `MAX` keeps a beat that arrives
 * out of order from dragging the clock backwards.
 */
export async function creditPlay({ db, nowS }, playerId, sessionId = null) {
  // SESSION-SIGN (AUDIT PLAN-1000 E3; sessionPass.js): a beat is a write, and asks in its own statement that the session it
  // came under still stands and the account is not banned - a hot route believes a pass for its reads alone
  const row = await db.prepare(
    `UPDATE players SET
       played_s = played_s + CASE
         WHEN played_at IS NOT NULL AND ?1 > played_at AND ?1 - played_at <= ?2 THEN ?1 - played_at
         ELSE 0 END,
       played_at = MAX(COALESCE(played_at, ?1), ?1)
     WHERE id = ?3 AND COALESCE(banned_until, 0) <= ?1
       AND COALESCE(frozen_until, 0) <= ?1   -- STAFF-PANEL5-FREEZE: a frozen account's beat credits nothing (a pass minted before the freeze)
       AND (?4 IS NULL OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = ?4 AND s.player_id = ?3))
     RETURNING played_s`,
  ).bind(nowS, PLAY_GRACE_S, playerId, sessionId).first();
  return { playedS: Number.isSafeInteger(row?.played_s) ? row.played_s : 0 };
}

/**
 * ACC3 - THE WARDROBE, and the one write in it.
 *
 * `accountView` takes no env and this does, which is the seam saying
 * something true: a NAME is the row's, and a GRANT is the row read
 * against the service's own config and clock. Handing env in here
 * rather than folding the wardrobe into `accountView` keeps that
 * difference visible at every call site.
 */
export const accountWardrobe = (player, env, nowS) => wardrobeOf(player, env, nowS);

/**
 * EQUIP ONE, or none. Mac: "tap the account icon to equip 1 feature".
 *
 * The refusal is checked against what the player HOLDS, derived now -
 * so a title that has lapsed cannot go on being worn by a row nobody
 * has looked at since, and a title nobody was ever granted cannot be
 * written by a client that asks nicely. `null` takes it off and is
 * always allowed.
 */
export async function equipTitle({ db, nowS }, player, env, title) {
  const why = equipRefusal(title, player, env);
  if (why) return { error: why };
  await db.prepare('UPDATE players SET title = ?, last_seen = ? WHERE id = ?')
    .bind(title, nowS, player.id).run();
  // The ROW this answer describes is the row after the write, so the
  // caller never has to re-read to know what it did.
  return { ok: true, ...wardrobeOf({ ...player, title }, env, nowS) };
}

/**
 * WB9g - WEAR ONE AURA, OR NONE. equipTitle's law at the feet: refused against what the player HOLDS, derived now (a
 * bought aura is held because the row records the sale; AEGIS: a listed title's, because the config lists the handle);
 * `null` takes it off and is always allowed. Answers the
 * wardrobe after the write.
 */
export async function equipAura({ db, nowS }, player, env, aura) {
  const why = auraRefusal(aura, player, env);   // AEGIS: a list's aura is held off the config
  if (why) return { error: why };
  await db.prepare('UPDATE players SET aura = ?, last_seen = ? WHERE id = ?').bind(aura, nowS, player.id).run();
  return { ok: true, ...wardrobeOf({ ...player, aura }, env, nowS) };
}

/**
 * WITCH1 (bible/06-Systems/Witches-Festival.md) - WEAR ONE PROFILE ICON, OR NONE (the character's face): the aura's law,
 * in the portrait well. Answers the wardrobe after the write; `not-held` for one the account does not hold.
 */
export async function equipIcon({ db, nowS }, player, env, icon) {
  const why = iconRefusal(icon, player);
  if (why) return { error: why };
  await db.prepare('UPDATE players SET icon = ?, last_seen = ? WHERE id = ?').bind(icon, nowS, player.id).run();
  return { ok: true, ...wardrobeOf({ ...player, icon }, env, nowS) };
}

/**
 * GLYPH-WEAR - SHOW ONE GLYPH, OR HIDE IT. Mac: "players can also equip/unequip their glyphs". Refused for a glyph
 * that is not true of the player now (`not-held`), as a title is. `on` true shows it, false hides it. The stored
 * list is rewritten from what is hidden now, so a lapsed glyph drops out of it on the next write. Answers the
 * wardrobe after the write.
 */
export async function equipGlyph({ db, nowS }, player, env, glyph, on) {
  const why = glyphRefusal(glyph, player, env, nowS);
  if (why) return { error: why };
  const off = glyphsHidden(player, env, nowS).filter((g) => g !== glyph);
  if (!on) off.push(glyph);
  const glyphs_off = off.join(' ') || null;
  await db.prepare('UPDATE players SET glyphs_off = ?, last_seen = ? WHERE id = ?').bind(glyphs_off, nowS, player.id).run();
  return { ok: true, ...wardrobeOf({ ...player, glyphs_off }, env, nowS) };
}

/** SERPENT-SET: every ember account ?1's kills paid, in SQL - its gates' rows' `stones` and (migration 0083) its serpents'
 *  (SERPENT_EMBERS a receipt): the gate's currency is a serpent's hoard's too, and the purse below counts both. EG-E1
 *  (bible/11-Multiplayer/Elite-Gates.md section 19): and the Redoubts' the week paid (eg_redoubts `stones` - egEconomy.js),
 *  so the insignia and the Broker's Panoply sink (egEconomy.js egSink) spend the Spire's embers from the one purse. */
export const EMBERS_EARNED_SQL = '((SELECT COALESCE(SUM(stones), 0) FROM gate_kills WHERE account = ?1) + (SELECT COALESCE(SUM(stones), 0) FROM serpent_kills WHERE account = ?1) + (SELECT COALESCE(SUM(stones), 0) FROM eg_redoubts WHERE account = ?1))';
/** WB9g: what the account's own closed gates could still pay for - one Sigil Stone a gate closed (gate_kills, WB5b),
 *  less what its insignia already cost (`insignia_spent`). Never below 0. WB12d: a row's own `stones` - two with the
 *  faithful's rite broken, one for the rite alone (migration 0066). SERPENT-SET: and a serpent's (EMBERS_EARNED_SQL). */
export async function insigniaPurse({ db }, player) {
  const r = await db.prepare(`SELECT ${EMBERS_EARNED_SQL} AS n`).bind(player.id).first();
  const spent = Number.isSafeInteger(player?.insignia_spent) ? player.insignia_spent : 0;
  return Math.max(0, Number(r?.n ?? 0) - spent);
}

/**
 * WB9g - THE BROKER'S SALE OF A PIECE OF INSIGNIA (src/net/insignia.js INSIGNIA), recorded for the account. Refused:
 * `no-insignia` (not an offer), `guest` (a guest row is one storage clear from gone - ACC3's founder reasoning - and the
 * gate records nothing for one either, claimGate), `owned`, and `short` when the account's closed gates less what its
 * insignia already cost cannot pay the price (`purse` says what they can). ONE UPDATE is the sale: the id joins the
 * column and the price the spend only where the row does not hold it yet and its gates still cover it - so two sales
 * pressed at once cannot both spend the same stones, nor one piece be bought twice. The client takes the stones from
 * the pack; this is the half no client can skip. Answers the wardrobe after the write and the purse left.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function buyInsignia({ db, nowS }, player, env, id, rid = null) {
  const offer = insigniaById(id);
  if (!offer) return { error: 'no-insignia' };
  if (!player?.handle) return { error: 'guest' };
  // AUDIT FB1024 (BROKER-RID, brokerSales.js): a press with a request id - a fenced id writes nothing, the same press asked
  // again answers its sale (before `owned`, which its own sale made true)
  if (rid !== null && !brokerRidOk(rid)) return { error: 'rid' };
  const had = rid ? await brokerSaleOf(db, player.id, rid) : null;
  if (had?.kind === 'fence') return { error: 'fenced' };
  if (had?.kind === 'insignia' && had.item === offer.id) return { ok: true, bought: offer.id, again: true, ...wardrobeOf(player, env, nowS), purse: await insigniaPurse({ db }, player) };
  if (insigniaHeld(player.insignia).includes(offer.id)) return { error: 'owned' };
  // AUDIT WB9 (insignia F3): the id APPENDED to the column the UPDATE matches, not written over it from the row read
  // before - two sales of two pieces at once each read the column empty, and the second wrote its id alone over the
  // first's: both paid for, one held (the id's shape is the law's own, insigniaWith's: space-separated, in sale order)
  // AUDIT FB1024 (BROKER-RID): the request id's guard rides the one UPDATE, and its row is written by that write alone
  const [sold] = await db.batch([
    db.prepare(
      `UPDATE players SET insignia = CASE WHEN COALESCE(insignia, '') = '' THEN ?2 ELSE insignia || ' ' || ?2 END,
         insignia_spent = insignia_spent + ?3, last_seen = ?4
       WHERE id = ?1
         AND (' ' || COALESCE(insignia, '') || ' ') NOT LIKE ('% ' || ?2 || ' %')
         AND ${EMBERS_EARNED_SQL} - insignia_spent >= ?3${rid ? `
         AND ${brokerRidFreeSql('?1', '?5')}` : ''}
       RETURNING insignia, insignia_spent`,
    ).bind(player.id, offer.id, offer.price, nowS, ...(rid ? [rid] : [])),
    ...(rid ? [brokerSaleWrite(db, { account: player.id, rid, kind: 'insignia', item: offer.id, nowS })] : []),
  ]);
  const row = sold?.results?.[0] ?? null;
  if (!row) {
    if (rid && (await brokerSaleOf(db, player.id, rid))?.kind === 'fence') return { error: 'fenced' };   // fenced while it was asked
    const now = await db.prepare('SELECT * FROM players WHERE id = ?').bind(player.id).first();
    if (insigniaHeld(now?.insignia).includes(offer.id)) return { error: 'owned' };
    return { error: 'short', purse: await insigniaPurse({ db }, now ?? player), price: offer.price };
  }
  const after = { ...player, insignia: row.insignia, insignia_spent: row.insignia_spent };
  return { ok: true, bought: offer.id, ...wardrobeOf(after, env, nowS), purse: await insigniaPurse({ db }, after) };
}

/** A handle a player asks for, judged before anything is written: one
 *  word by shape (so it can never read as a guest's two), and a name
 *  the wire would carry unchanged (so the token can name it). Returns
 *  the reason it is refused, or null. */
export function handleRefusal(handle) {
  if (typeof handle !== 'string') return 'shape';
  const h = handle.trim();
  if (h !== handle) return 'shape';
  if (!isHandleShaped(h)) return 'shape';
  if (isGuestShaped(h)) return 'shape';         // belt and braces: the two spaces cannot overlap
  if (handleLooksLikeEmail(h)) return 'email';  // HANDLE-EMAIL: a username is never an email address
  if (!nameIsIssuable(h)) return 'refused';     // NAME-F1/F2, at entry
  return null;
}

/**
 * TERMS1 — DID THIS PLAYER TICK THE DOCUMENTS THIS SERVICE HOLDS?
 *
 * "I wanna make sure these need to be reviewed and checked off by
 * players before creating an account". The Create account form sends the
 * Terms of Service and Privacy Policy versions its player ticked
 * (src/net/legalLaw.js), and the two routes that make an account ask
 * this before anything is written: `/v1/auth/guest` opens the row and
 * `/v1/auth/register` names it. No other route makes one.
 *
 * THREE REFUSALS, because a player needs three different sentences.
 * `terms-unaccepted`: a box unticked, or an answer that is not a
 * version. `terms-stale`: dated versions that are not these - a player
 * who ticked text this service no longer holds (an old tab, a cached
 * build), who must reload to read the current text rather than tick a
 * box they already ticked.
 *
 * AUDIT PRE-MERGE 0929 T1: AND A REQUEST THAT NAMES NEITHER DOCUMENT is
 * a game from before the boxes - the form never sends one, since its own
 * check stops a press with a box unticked - and a game that old has no
 * sentence for either word above: it said "The account service had a
 * problem. Try again." at every press, for ever, and the desktop app's
 * reload brings back the same bundled game. It is answered in the word
 * every shipped build renders as "The game may need updating"
 * (accountClient.js REFUSALS `not-found`), which is the truth.
 */
export function legalRefusal(body) {
  const terms = body?.terms, privacy = body?.privacy;
  if (terms === TERMS_VERSION && privacy === PRIVACY_VERSION) return null;
  if (terms === undefined && privacy === undefined) return { error: 'not-found' };
  const dated = (v) => typeof v === 'string' && LEGAL_VERSION_RE.test(v);
  if (dated(terms) && dated(privacy)) return { error: 'terms-stale' };
  return { error: 'terms-unaccepted' };
}

/** TERMS1: what a row keeps of an agreement - the two versions and the
 *  moment - or three NULLs. ONLY THE CURRENT VERSIONS ARE WRITTEN, whoever
 *  calls: a row that says its player agreed to text this service does not
 *  hold is a record of something that did not happen. */
const legalColumns = (legal, nowS) =>
  (legal && !legalRefusal(legal) ? [legal.terms, legal.privacy, nowS] : [null, null, null]);

// ── ACC1c: USERNAME, PASSWORD, AND THE ONE WAY BACK IN ──────────────

/** How many failures a key may have in a window, and how long the
 *  window is. Passwords bring online guessing, which tokens did not. */
export const LOGIN_MAX = 10;
export const LOGIN_WINDOW_S = 15 * 60;

/**
 * AUDIT-ACC F12: AND AN AUTHENTICATED CALLER IS BOUNDED TOO.
 *
 * Only the OPEN routes were limited - per address, on the door. Every
 * route behind a session was unbounded, so one valid credential could
 * hammer `/v1/auth/token` (an Ed25519 signature) or `/v1/account`
 * (three D1 operations) as fast as the network allowed. A limit that
 * stops strangers and not members is a limit on the wrong axis.
 *
 * Fight Life bounds every authenticated call per ACCOUNT and has done
 * since its S4 hardening; this is that, carried over. The figure is
 * generous on purpose - a client mints one token per connection and
 * reads its account rarely, so this is a ceiling on ABUSE rather than a
 * pacer, and a limit that trips on normal play is an outage.
 */
export const ACCOUNT_MAX = 240;
export const ACCOUNT_WINDOW_S = 60;

/**
 * A fixed-window counter, per key, by UPSERT - so the table is bounded
 * by the number of distinct ACTIVE keys rather than by traffic.
 * Answers true when the caller is over its allowance.
 */
export async function overRate({ db, nowS }, key, max = LOGIN_MAX, windowS = LOGIN_WINDOW_S) {
  const start = Math.floor(nowS / windowS) * windowS;
  // ONE ROUND TRIP, by RETURNING - the count comes back from the write
  // rather than from a SELECT after it, which is both a second call to
  // D1 and a window in which another request can bump the row and make
  // this caller read somebody else's number.
  //
  // AUDIT RENOWN1 (DATA-1, beside the hour's window it found): THE WINDOW
  // ONLY MOVES FORWARD. `nowS` is read when a request ARRIVES, before its
  // body, so a caller who sends headers in a window's last second and the
  // body after the boundary lands an OLD window's start after a new one's.
  // `window_start = excluded.window_start` took that as a fresh window and
  // counted 1 - and the next new-window request did the same - so
  // alternating the two reset the counter for ever (the `acct:` row stayed
  // at 1 through 300 requests; the `login:` and `ip:` doors share this
  // statement). A request stamped with a window already past is counted
  // in the window that is open.
  const row = await db.prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start >= excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
      window_start = MAX(rate_limits.window_start, excluded.window_start)
    RETURNING count`).bind(key, start).first();
  return (row?.count ?? 0) > max;
}

/**
 * ACCT-RATE-MEM (2026-10-04, the login outage - Mac: "You log in and it sends you straight to title screen", "We have
 * 300 people trying to log in at once"): AUDIT-ACC F12's bound, IN THE ISOLATE'S MEMORY AND NOT IN D1.
 *
 * F12 asked `overRate` with an `acct:` key on EVERY authenticated request - an upsert, so every read the game makes
 * (a town's yards each minute, a home, a token) was also a WRITE to the one database. D1's own query insights on
 * the day: 4,783,193 runs of that upsert, the most time of any statement, beside the session and player reads every
 * request already makes. After two relay deploys put every player back through the door at once D1 answered
 * "overloaded. Requests queued for too long", the session read under it failed, the service said 500, and the
 * client went back to the title - and its retries were more of the same load.
 *
 * The bound is what F12 says it is - ACCOUNT_MAX a window per ACCOUNT, 429 'rate' - counted where it costs nothing.
 * PER ISOLATE: a caller spread over several isolates meets the ceiling in each, so the cap is looser than a shared
 * row's by that factor; it is a ceiling on abuse, generous on purpose (above), and a write on every read is the
 * outage it was meant to prevent. The open doors' `login:` and `ip:` keys stay in D1: they are few, and must hold
 * across isolates.
 *
 * THE WINDOW ONLY MOVES FORWARD (AUDIT RENOWN1, as `overRate`): a request stamped with a window already past is
 * counted in the one open. BOUNDED: past ACCOUNT_RATE_KEYS accounts, the closed windows go; if every one is open,
 * all of them - forgetting a count frees a caller early, never refuses one.
 */
export const ACCOUNT_RATE_KEYS = 50_000;
const accountWindows = new Map();
export function overAccountRate(id, nowS, max = ACCOUNT_MAX, windowS = ACCOUNT_WINDOW_S) {
  const start = Math.floor(nowS / windowS) * windowS;
  let w = accountWindows.get(id);
  if (!w || w.start < start) {
    if (!w && accountWindows.size >= ACCOUNT_RATE_KEYS) {
      for (const [k, v] of accountWindows) if (v.start < start) accountWindows.delete(k);
      if (accountWindows.size >= ACCOUNT_RATE_KEYS) accountWindows.clear();
    }
    w = { start, count: 0 };
    accountWindows.set(id, w);
  }
  w.count++;
  return w.count > max;
}
/** AUDIT PLAN-1000 C4: whether the account's next request in this window is past its rate - overAccountRate's answer,
 *  asked WITHOUT counting: the door asks a progression claim's reads of no request the rate will refuse (index.js). */
export function accountRateFull(id, nowS, max = ACCOUNT_MAX, windowS = ACCOUNT_WINDOW_S) {
  const w = accountWindows.get(id);
  return !!w && w.start >= Math.floor(nowS / windowS) * windowS && w.count + 1 > max;
}
/** The accounts counted in this isolate (the pins' window). */
export const accountRateKeys = () => accountWindows.size;

/** A successful login forgives the key, so a player who mistyped twice
 *  and then got it right is not still on a countdown. */
export async function clearRate({ db }, key) {
  await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
}

/**
 * REGISTER - an UPGRADE IN PLACE of the guest row this session already
 * belongs to. Not a new account: the id, the friends that will hang off
 * it and the saves that will hang off it are all already this player's,
 * which is the property ACC0 has been protecting since it opened.
 *
 * Returns `{ recoveryCode }` - THE ONLY TIME IT IS EVER READABLE.
 *
 * RECOVERY-SET: a build that has the set asks for one (`set: true`) and
 * is answered `{ recoveryCodes }`, eight. A build from before it asks for
 * nothing and is minted the one code it can show (AUDIT RECOVERY-SET A2:
 * the first cut minted it eight and showed it the first, so its player
 * held one code of eight and, after one recovery, none).
 *
 * TERMS1: `legal` is the agreement ticked on the form that named it,
 * which the route has already required (`legalRefusal`) - written with
 * the name, so an account made before the boxes existed carries one from
 * the moment it registers. It never ERASES one: a caller that passes
 * none leaves the row's own.
 */
export async function register({ db, subtle, rand, nowS }, playerId, { handle, password, legal = null, set = false }) {
  const hRefusal = handleRefusal(handle);
  if (hRefusal) return { error: `handle-${hRefusal}` };
  const pRefusal = passwordRefusal(password);
  if (pRefusal) return { error: `password-${pRefusal}` };

  const player = await db.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();
  if (!player) return { error: 'no-account' };
  if (player.handle) return { error: 'already-registered' };

  const codes = set ? mintRecoverySet(rand) : [mintRecoveryCode(rand)];
  const [pw, rc] = await Promise.all([
    hashPassword(password, { subtle, rand }),
    set ? hashRecoverySet(codes, { subtle, rand }) : hashPassword(codeForHashing(codes[0]), { subtle, rand }),
  ]);
  let wrote;
  try {
    // AUDIT 68 S01-register-recover-lost-update: and the WRITE is the
    // authority on whether this row is still a guest's, by the same law
    // - two registrations of one guest (two devices) both passed the
    // SELECT above, both answered a recovery code, and the first's was dead.
    wrote = await db.prepare('UPDATE players SET handle = ?, handle_lc = ?, password = ?, recovery_hash = ?, registered_at = ?, '
      + 'terms_version = COALESCE(?, terms_version), privacy_version = COALESCE(?, privacy_version), legal_accepted_at = COALESCE(?, legal_accepted_at) '
      + 'WHERE id = ? AND handle IS NULL')
      .bind(handle, handle.toLowerCase(), pw, rc, nowS, ...legalColumns(legal, nowS), playerId).run();
  } catch (e) {
    // THE UNIQUE INDEX IS THE AUTHORITY ON WHETHER A NAME IS TAKEN, not
    // a SELECT before the write - two registrations in the same instant
    // both see it free and one of them is wrong.
    if (/UNIQUE|constraint/i.test(String(e?.message ?? e))) return { error: 'handle-taken' };
    throw e;
  }
  if (!wrote.meta.changes) return { error: 'already-registered' };
  return set ? { recoveryCodes: codes, handle } : { recoveryCode: codes[0], handle };
}

/** SAFE4: whether the row is banned now - sanctions.js isBanned's law, here where signing in asks it (sanctions.js imports
 *  this module). @param {any} row @param {number} nowS */
const bannedNow = (row, nowS) => Number.isSafeInteger(row?.banned_until) && row.banned_until > nowS;

/**
 * LOG IN with a username and password, and mint this device a session.
 *
 * A HANDLE NOBODY HOLDS COSTS WHAT A WRONG PASSWORD COSTS. Without
 * that, the form is a username oracle: an attacker learns which names
 * exist by timing, which is the whole of "do not confirm the account
 * exists" undone by the clock.
 */
export async function login({ db, subtle, rand, nowS }, { handle, password, deviceLabel = null }) {
  const lc = String(handle ?? '').toLowerCase();
  if (await overRate({ db, nowS }, `login:${lc}`)) return { error: 'rate' };

  const player = lc ? await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(lc).first() : null;
  // The work happens either way. `verifyPassword` derives against a
  // throwaway salt when it is handed nothing it can parse, so this is
  // not a sleep pretending to be constant time - it is the same
  // derivation.
  const ok = await verifyPassword(password, player?.password ?? null, { subtle });
  if (!player || !ok) return { error: 'bad-login' };

  await clearRate({ db }, `login:${lc}`);
  // AUDIT SAFE SERVICE-7 (bible/11-Multiplayer/Chat-Safety-Arc.md section 5): A BANNED ACCOUNT IS TOLD SO, and minted no
  // session - told only once the password is right, so the word says nothing to a stranger guessing at a handle
  if (bannedNow(player, nowS)) return { error: 'banned', until: player.banned_until, reason: player.ban_reason ?? null };
  // The cost of a hash goes up over the years. The only moment the
  // plaintext is in hand is a correct login, so that is when a row is
  // rewritten at the current count.
  if (needsRehash(player.password)) {
    const fresh = await hashPassword(password, { subtle, rand });
    await db.prepare('UPDATE players SET password = ? WHERE id = ?').bind(fresh, player.id).run();
  }
  const session = await openSession({ db, subtle, rand, nowS }, player.id, deviceLabel);
  return { id: player.id, name: displayName(player), kind: accountKind(player), ...session };
}

/**
 * THE WAY BACK IN. The code sets a new password and SIGNS EVERY DEVICE
 * OUT - because the reason somebody is standing here may be that another
 * person has their password.
 *
 * RECOVERY-SET: for a build that has the set (`set: true`), the code
 * typed is SPENT and the set's others still work (`codesLeft` says how
 * many); a single code from before the set, or the last of one, mints a
 * fresh set in its place (`recoveryCodes`) - a player who spends their
 * only way in is never left with none. A build from before the set asks
 * for nothing and is answered as ACC1c answered it: ONE new code, which
 * replaces whatever the row held (AUDIT RECOVERY-SET A2 - it can show no
 * other, and a set it cannot show is a set its player does not have).
 */
export async function recover({ db, subtle, rand, nowS }, { handle, code, password, set = false }) {
  const lc = String(handle ?? '').toLowerCase();
  if (await overRate({ db, nowS }, `recover:${lc}`)) return { error: 'rate' };
  const pRefusal = passwordRefusal(password);
  if (pRefusal) return { error: `password-${pRefusal}` };

  const canon = codeForHashing(code);
  const player = lc ? await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(lc).first() : null;
  // Same shape as login: the derivations happen whether or not there is
  // anything to compare them against (password.js matchRecoveryCode).
  const { ok, rest } = await matchRecoveryCode(canon, player?.recovery_hash ?? null, { subtle });
  if (!player || !canon || !ok) return { error: 'bad-code' };
  // AUDIT SAFE SERVICE-7: a banned account is told so before its code is spent - it is not signed back in
  if (bannedNow(player, nowS)) return { error: 'banned', until: player.banned_until, reason: player.ban_reason ?? null };

  const one = set ? null : mintRecoveryCode(rand);
  const fresh = set && !rest?.length ? mintRecoverySet(rand) : null;
  const [pw, rc] = await Promise.all([
    hashPassword(password, { subtle, rand }),
    one ? hashPassword(codeForHashing(one), { subtle, rand }) : fresh ? hashRecoverySet(fresh, { subtle, rand }) : joinRecoverySet(rest),
  ]);
  // AUDIT 68 S01-register-recover-lost-update: the code is SPENT by the write that replaces it - two recoveries racing
  // on one code both verified it, and the first one's new code and session were dead on arrival
  const spent = await db.prepare('UPDATE players SET password = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?').bind(pw, rc, player.id, player.recovery_hash).run();
  // AUDIT RECOVERY-SET A4: a code that WAS right and lost the race (two of one set's codes typed at once) is told to try
  // again, not that it was wrong - the caller has already shown a code, so the word leaks nothing
  if (!spent.meta.changes) return { error: 'codes-moved' };
  await closeAllSessions({ db }, player.id);
  await closeStaffSessions({ db }, player.id);   // STAFF-PANEL2-FIX: a new password ends the staff panel's sessions too
  await clearRate({ db }, `recover:${lc}`);
  const session = await openSession({ db, subtle, rand, nowS }, player.id, null);
  // AUDIT RECOVERY-SET B6: and the handle as the row holds it - the saved file names the account, not its typing
  const left = one ? { recoveryCode: one } : fresh ? { recoveryCodes: fresh, codesLeft: fresh.length, handle: player.handle } : { codesLeft: rest.length, handle: player.handle };
  return { id: player.id, name: displayName(player), ...left, ...session };
}

/** Change a password from inside a session, which needs the OLD one -
 *  a stolen device should not be able to lock its owner out. Every
 *  OTHER device is signed out; this one stays. */
export async function changePassword({ db, subtle, rand, nowS }, player, session, { oldPassword, password }) {
  const pRefusal = passwordRefusal(password);
  if (pRefusal) return { error: `password-${pRefusal}` };
  if (!player.password) return { error: 'not-registered' };
  // AUDIT 68 S01-changepw-unthrottled-oracle: a guess at the old password
  // is a guess at the password, so it spends LOGIN's bucket - one password,
  // one allowance, whichever door; this route had only the account's 240 a
  // minute, and a stolen session could grind the password that locks the owner out
  if (await overRate({ db, nowS }, `login:${player.handle_lc}`)) return { error: 'rate' };
  if (!await verifyPassword(oldPassword, player.password, { subtle })) return { error: 'bad-login' };
  await clearRate({ db }, `login:${player.handle_lc}`);
  const pw = await hashPassword(password, { subtle, rand });
  await db.prepare('UPDATE players SET password = ? WHERE id = ?').bind(pw, player.id).run();
  await db.prepare('DELETE FROM sessions WHERE player_id = ? AND id != ?').bind(player.id, session.id).run();
  await closeStaffSessions({ db }, player.id);   // STAFF-PANEL2-FIX: and every staff panel session
  return { ok: true };
}

/**
 * RECOVERY-SET - A NEW SET OF RECOVERY CODES, from the profile. The
 * request: players "click and see their account recovery code in their
 * profile". A code is never readable again, so the profile asks for a
 * NEW set - the PASSWORD first, as `changePassword` asks for the old one
 * (a stolen device must not mint itself the account's way back in), and
 * a guess at it spends LOGIN's bucket by that route's own law (AUDIT 68
 * S01-changepw-unthrottled-oracle). The old set dies with the write, and
 * no device is signed out: nothing about who holds the account moved.
 *
 * AUDIT RECOVERY-SET A1 - AND ONE OF THE CODES IT REPLACES. With the
 * password alone, whoever STOLE the password could kill the owner's
 * codes and then change the password: the account theirs for good, the
 * one thing a recovery code exists to undo (Mac, asked: "Password + one
 * code"). So a row that holds codes asks for one of them as well, spent
 * by the same write; a row that holds none asks for the password alone,
 * having nothing to kill. A player who has lost every code is where they
 * were before the set - their password, and RECOVER-OP.
 *
 * THE WRITE IS THE AUTHORITY (AUDIT 68 S01-register-recover-lost-update):
 * it lands only on the row as it was read, so two presses racing (two
 * tabs) cannot both answer a set while only the second's works - the
 * loser is told `codes-moved`, and a code spent in between is noticed the
 * same way.
 */
export async function newRecoveryCodes({ db, subtle, rand, nowS }, player, { password, code }) {
  if (!player.password) return { error: 'not-registered' };
  if (await overRate({ db, nowS }, `login:${player.handle_lc}`)) return { error: 'rate' };
  if (!await verifyPassword(password, player.password, { subtle })) return { error: 'bad-login' };
  await clearRate({ db }, `login:${player.handle_lc}`);
  if (recoveryLeft(player.recovery_hash) !== null) {
    // a guess at a code is a guess at a code, whichever door: RECOVER's bucket, as `recover` spends it
    if (await overRate({ db, nowS }, `recover:${player.handle_lc}`)) return { error: 'rate' };
    const canon = codeForHashing(code);
    const { ok } = await matchRecoveryCode(canon, player.recovery_hash, { subtle });
    if (!canon || !ok) return { error: 'bad-code' };
    await clearRate({ db }, `recover:${player.handle_lc}`);
  }
  const codes = mintRecoverySet(rand);
  const rc = await hashRecoverySet(codes, { subtle, rand });
  const wrote = await db.prepare('UPDATE players SET recovery_hash = ? WHERE id = ? AND recovery_hash IS ?').bind(rc, player.id, player.recovery_hash ?? null).run();
  if (!wrote.meta.changes) return { error: 'codes-moved' };
  return { recoveryCodes: codes, codesLeft: codes.length };
}

/** An address, or none at all. COMPLETELY OPTIONAL (Mac) - nothing is
 *  gated behind it and an account works forever without one. */
export async function setEmail({ db }, playerId, email) {
  const e = email === null || email === '' ? null : String(email ?? '').trim();
  if (e !== null && (e.length > 254 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e))) return { error: 'email' };
  await db.prepare('UPDATE players SET email = ? WHERE id = ?').bind(e, playerId).run();
  return { email: e };
}

// ═══ DUEL1 (2026-09-24) - THE DUELLING RECORD ════════════════════════
//
// Mac: "Add a dueling K/D to the profile menu and player inspect
// profile", per account. A player's wins are the rows of duel_results
// naming them the winner, and their losses the rows naming them the
// loser. DUEL1 wrote a row on the LOSER's own report, naming the winner
// by the account the relay stamped on the winner's frames; INT8 (below)
// writes it on the relay's signed receipt instead, and the report
// retired with the defender-resolved blow (the route answers `retired`).
//
// AUDIT DUEL1 A1: A RECORD IS BETWEEN TWO REGISTERED ACCOUNTS. A guest
// costs nothing to make, so a guest's duel is fought, and simply not
// counted. One pair's results are capped at DUEL_PAIR_DAY_MAX a day, so
// two friends cannot mint a hundred wins an evening, and one winner's at
// DUEL_WINNER_DAY_MAX a day, from anyone - measured inside the one
// INSERT that is the write, so two claims at once cannot both slip under
// a bound a read-then-write would have checked twice.
export const DUEL_PAIR_DAY_MAX = 10;
export const DUEL_WINNER_DAY_MAX = 20;
const DAY_S = 24 * 3600;

/** An account's record: `{ wins, losses }`, counted off the results. */
export async function duelRecordOf({ db }, playerId) {
  const w = await db.prepare('SELECT COUNT(*) AS n FROM duel_results WHERE winner = ?1').bind(playerId).first();
  const l = await db.prepare('SELECT COUNT(*) AS n FROM duel_results WHERE loser = ?1').bind(playerId).first();
  const n = (r) => (Number.isSafeInteger(Number(r?.n)) ? Number(r.n) : 0);
  return { wins: n(w), losses: n(l) };
}

// ═══ INT8 (2026-10-09) - A DUEL'S RESULT, THE RELAY'S ═════════════════
//
// The INTEGRITY arc's lane 2 (bible/06-Systems/Integrity-Arc.md; Mac: "I
// want to do everything and do it properly"). DUEL1's record was the
// LOSER's own report - a client that never said it lost never did, and
// a double knockout was two reports racing. Now the relay that refereed
// the bout (src/net/duel/duelRef.js) hands BOTH fighters a receipt naming the
// winner (src/net/duel/duelReceipt.js `d1`), signed with the key the gates'
// receipts are; either fighter carries it here, and it is counted ONCE -
// its bout's id is the row's (`rk`, unique). A draw mints nothing.
//
// DUEL1's bounds stand, inside the one INSERT: two registered accounts
// (AUDIT DUEL1 A1), the same winner over the same loser at most
// DUEL_PAIR_DAY_MAX a day, one winner's at most DUEL_WINNER_DAY_MAX a
// day. The report's gap and the mutual draw retire with the report: the
// relay paces the bouts and says a draw itself.
/**
 * A duel's receipt carried by one of its two fighters (the session's
 * account must be one of `f`). `{ recorded, wins, losses }` - the
 * caller's own record after it; `recorded` true where the bout is
 * counted, by this claim or by its other fighter's - or `{ recorded:
 * false, why }` ('guest', 'pair', 'winner'): the duel was fought, and
 * simply does not count. `{ error }`: 'no-gate-key', 'receipt' (with
 * its `why`), 'not-yours'.
 */
export async function claimDuel({ db, nowS, subtle }, player, receipt, publicKey) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyDuelReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (!c.f.includes(player.id)) return { error: 'not-yours' };
  const winner = c.f[c.w], loser = c.f[1 - c.w];
  const r = await db.prepare(
    `INSERT INTO duel_results (loser, winner, at, rk)
     SELECT ?1, ?2, ?3, ?4
     WHERE EXISTS (SELECT 1 FROM players WHERE id = ?1 AND handle IS NOT NULL)
       AND EXISTS (SELECT 1 FROM players WHERE id = ?2 AND handle IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM duel_results WHERE rk = ?4)
       AND (SELECT COUNT(*) FROM duel_results WHERE loser = ?1 AND winner = ?2 AND at > ?3 - ?5) < ?6
       AND (SELECT COUNT(*) FROM duel_results WHERE winner = ?2 AND at > ?3 - ?5) < ?7`,
  ).bind(loser, winner, c.i, c.n, DAY_S, DUEL_PAIR_DAY_MAX, DUEL_WINNER_DAY_MAX).run();
  const mine = () => duelRecordOf({ db }, player.id);
  if (Number(r?.meta?.changes ?? 0) > 0) return { recorded: true, ...(await mine()) };
  // Refused or already counted: which, read after the fact - the INSERT above is still the only write
  if (await db.prepare('SELECT 1 AS x FROM duel_results WHERE rk = ?1').bind(c.n).first()) return { recorded: true, ...(await mine()) };
  const handles = await db.prepare('SELECT COUNT(*) AS n FROM players WHERE id IN (?1, ?2) AND handle IS NOT NULL').bind(loser, winner).first();
  const n = (row) => Number(row?.n ?? 0);
  const pair = n(await db.prepare('SELECT COUNT(*) AS n FROM duel_results WHERE loser = ?1 AND winner = ?2 AND at > ?3 - ?4').bind(loser, winner, c.i, DAY_S).first());
  const why = n(handles) < 2 ? 'guest' : pair >= DUEL_PAIR_DAY_MAX ? 'pair' : 'winner';
  return { recorded: false, why, ...(await mine()) };
}

// ═══ WB5b (2026-09-25) - THE GATES CLOSED ════════════════════════════
//
// Mac: "a gate of oblivion which takes place in a large boss arena", and
// Option B - the relay's object is the authority over the boss, stamps
// the kill and signs a receipt for each account that earned it
// (src/net/gate/gateReceipt.js: dealt its share of the health its own level
// claim brought, or stood half the fight). THE ACCOUNT THE RECEIPT NAMES
// carries it here and it is counted: the relay is the only party that
// saw the kill, so its signature - verified with the public half this
// service holds (GATE_PUBLIC_KEY) - is the whole of the proof, and the
// session's account must be the receipt's `s`, so nobody claims
// another's.
//
// ONCE, WHATEVER HAPPENS TO IT: gate_kills' primary key is (day,
// account), so a second claim - another device, a retry after a lost
// answer, a replay - lands nothing and is answered `claimed`.
//
// AND A RECORD IS A REGISTERED ACCOUNT'S (AUDIT DUEL1 A1's law): a
// guest fights and loots, and its receipt is answered `guest` and not
// counted - a guest that registers keeps its id (register() upgrades
// the row), so the client keeps the receipt and claims it again then,
// inside the receipt's week.

/** An account's gates: `{ closed }`, counted off the rows - WB12d: a rite's own row is no breach closed. */
export async function gateRecordOf({ db }, playerId) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM gate_kills WHERE account = ?1 AND earned != 'rite'").bind(playerId).first();
  return { closed: Number(r?.n ?? 0) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player`, one row a (day, account). Answers
 * `{ recorded: true, day, stones, closed }` (WB12d: `stones` the row's embers, `rite` on a receipt of the rite alone,
 * `struck` beside a Drakes strike), `{ recorded: false, why: 'claimed', stones, closed }` (AUDIT WB12d A1: the row's
 * embers, a fighter's `r` made good), `{ recorded: false, why: 'guest', closed }`, or `{ error }` -
 * `no-gate-key` (this service holds no public half), `receipt` (not a receipt the relay signed, or expired - `why`
 * says which rung), `not-yours` (another account's). AUDIT EG IV (lane3 #16): `weir` the Weir Key's statement for the claims
 * (eg.js egGateWeir), set in the batch directly after the row - the row it answered rides a recorded kill's answer as
 * `weirRow` (null where it rolled nothing); never for the rite alone.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx
 * @param {{ id: string, handle?: string|null }} player the session's account
 * @param {unknown} receipt @param {CryptoKey|null} publicKey
 */
export async function claimGate({ db, nowS, subtle }, player, receipt, publicKey, { strike = null, region = null, deeds = null, weir = null } = {}) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest', ...(await gateRecordOf({ db }, player.id)) };
  // WB12d: the row's embers - an ember more for the faithful's rite broken (`r`); a rite's own receipt is one.
  // SEAT1b (Seats-Arc 4.2): with the region the claiming client derived for the kill's day - the day's region is the one
  // at least three of its claims agree on (seatInfluence.js), null where the claim named none, and on the rite's own
  // row, which is no kill
  const embers = c.r === 1 ? 2 : 1;
  const kill = db.prepare('INSERT OR IGNORE INTO gate_kills (day, account, boss, earned, at, region, stones, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
    .bind(c.d, player.id, c.b, c.x, nowS, c.x !== 'rite' && seatRegionOk(region) ? region : null, embers, c.m ? JSON.stringify(c.m) : null);   // INT14: the relay's count, kept
  // MARKS1 / AUDIT 28 M4: the gate's Marks (marks.js gateStrikeStatement) IN THE SAME BATCH as the row - one transaction,
  // so a strike that fails takes the row with it and the retry claims afresh; `strike` null where Marks are not this
  // account's, and the row is written alone. WB12d: the rite alone is no breach closed - no strike
  const stmt = c.x === 'rite' ? null : strike?.(c.d) ?? null;
  // SILVER-WAYS: the guild's deed (marks.js deedStatements - its mark and its strike, by the gate_kills row this claim
  // wrote), in the same batch; never for the rite alone, which is no breach closed
  const deed = c.x === 'rite' ? null : deeds?.(c.d) ?? null;
  // AUDIT EG IV (lane3 #16): the Weir Key's roll directly after the row, in its transaction (eg.js egGateWeir - `changes()`
  // the row's): never the rite's
  const roll = c.x === 'rite' ? null : weir?.(c) ?? null;
  const [r, ...rest] = stmt || deed || roll ? await db.batch([kill, ...(roll ? [roll] : []), ...(stmt ? [stmt] : [db.prepare('SELECT 0')]), ...(deed ?? [])]) : [await kill.run(), null];
  const w = roll ? rest.shift() : null, [m, ...d] = rest;
  const recorded = Number(r?.meta?.changes ?? 0) > 0;
  const struck = !!stmt && Number(m?.meta?.changes ?? 0) > 0;
  const deedStruck = !!deed && Number(d[1]?.meta?.changes ?? 0) > 0;
  if (recorded) return { recorded, day: c.d, stones: embers, ...(c.p > 0 ? { portent: c.p } : {}), ...(c.x === 'rite' ? { rite: true } : {}), ...(stmt ? { struck } : {}), ...(deed ? { deedStruck } : {}), ...(roll ? { weirRow: w?.results?.[0] ?? null } : {}), ...(await gateRecordOf({ db }, player.id)) };
  // AUDIT WB12d (A1): A FIGHTER'S `r` COUNTED AT ONE EMBER - a service from before acct62 took the receipt as a plain one
  // and kept its row - is made good when the receipt is claimed again (the game keeps an `r` receipt until a service
  // that answers its embers has counted it). One row a (day, account), one receipt a kill: the row is this receipt's
  if (c.r === 1) await db.prepare("UPDATE gate_kills SET stones = 2 WHERE day = ?1 AND account = ?2 AND stones = 1 AND earned != 'rite'").bind(c.d, player.id).run();
  const row = await db.prepare('SELECT stones FROM gate_kills WHERE day = ?1 AND account = ?2').bind(c.d, player.id).first();
  return { recorded, why: 'claimed', ...(Number.isSafeInteger(row?.stones) ? { stones: row.stones } : {}), ...(await gateRecordOf({ db }, player.id)) };
}
