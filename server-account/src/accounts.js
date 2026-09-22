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
import { wardrobeOf, equipRefusal } from './titles.js';   // ACC3: what a player holds, wears and is true of - all four derived
import { ID_RE, nameIsIssuable } from '../../src/net/identityToken.js';
import {
  hashPassword, verifyPassword, needsRehash, passwordRefusal,
  mintRecoveryCode, codeForHashing,
} from './password.js';

/** A session's raw secret, in bytes. 32 bytes of CSPRNG is the whole
 *  of the credential; nothing about the player is encoded in it. */
export const SECRET_BYTES = 32;
/** How long a session may sit unused before a sweep may take it. A
 *  year, because a player who opens the game twice a year is still that
 *  player and their friends list is still theirs. */
export const SESSION_IDLE_S = 365 * 24 * 60 * 60;

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
  if (typeof handle === 'string' && handle.length > 0) return handle;
  return String(row?.guest_name ?? '');
}

/** Guest or linked. ACC1b has no links yet, so every row is a guest -
 *  the function exists now so the token's `k` has ONE source from the
 *  first day rather than a second one bolted on beside it. */
export function accountKind(row) {
  return row?.handle ? 'linked' : 'guest';
}

/**
 * A NEW PLAYER. Mints the id, the generated name and the device's first
 * session, and hands back the one and only copy of the raw secret.
 *
 * @param {{db: any, subtle: SubtleCrypto, rand: (b: Uint8Array) => void, nowS: number}} env
 * @param {{deviceLabel?: string|null}} [opts]
 */
export async function createGuest({ db, subtle, rand, nowS }, { deviceLabel = null } = {}) {
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
  await db.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES (?, NULL, NULL, ?, ?, ?)')
    .bind(id, name, nowS, nowS).run();
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

/**
 * WHO IS THIS? Resolved by the secret alone, in ONE indexed lookup -
 * the caller has not proved a player id yet, so it cannot be part of
 * the question.
 *
 * Answers the player row plus the session, or null. Never throws on a
 * bad secret, because a bad secret is the ordinary case.
 *
 * @returns {Promise<{player: any, session: any}|null>}
 */
export async function resolveSession({ db, subtle, nowS }, secret) {
  if (typeof secret !== 'string' || secret.length < 16 || secret.length > 128) return null;
  const hash = await hashSecret(secret, { subtle });
  const session = await db.prepare('SELECT * FROM sessions WHERE secret_hash = ?').bind(hash).first();
  if (!session) return null;

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

  const player = await db.prepare('SELECT * FROM players WHERE id = ?').bind(session.player_id).first();
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
  if (Number.isSafeInteger(nowS)) {
    try {
      await db.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').bind(nowS, session.id).run();
      await db.prepare('UPDATE players SET last_seen = ? WHERE id = ?').bind(nowS, player.id).run();
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
    muted: isMuted(player, nowS),
  };
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
  if (!nameIsIssuable(h)) return 'refused';     // NAME-F1/F2, at entry
  return null;
}

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
  const row = await db.prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
      window_start = excluded.window_start
    RETURNING count`).bind(key, start).first();
  return (row?.count ?? 0) > max;
}

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
 */
export async function register({ db, subtle, rand, nowS }, playerId, { handle, password }) {
  const hRefusal = handleRefusal(handle);
  if (hRefusal) return { error: `handle-${hRefusal}` };
  const pRefusal = passwordRefusal(password);
  if (pRefusal) return { error: `password-${pRefusal}` };

  const player = await db.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();
  if (!player) return { error: 'no-account' };
  if (player.handle) return { error: 'already-registered' };

  const code = mintRecoveryCode(rand);
  const [pw, rc] = await Promise.all([
    hashPassword(password, { subtle, rand }),
    hashPassword(codeForHashing(code), { subtle, rand }),
  ]);
  try {
    await db.prepare('UPDATE players SET handle = ?, handle_lc = ?, password = ?, recovery_hash = ?, registered_at = ? WHERE id = ?')
      .bind(handle, handle.toLowerCase(), pw, rc, nowS, playerId).run();
  } catch (e) {
    // THE UNIQUE INDEX IS THE AUTHORITY ON WHETHER A NAME IS TAKEN, not
    // a SELECT before the write - two registrations in the same instant
    // both see it free and one of them is wrong.
    if (/UNIQUE|constraint/i.test(String(e?.message ?? e))) return { error: 'handle-taken' };
    throw e;
  }
  return { recoveryCode: code, handle };
}

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
 * THE WAY BACK IN. The code sets a new password, mints a NEW code, and
 * SIGNS EVERY DEVICE OUT - because the reason somebody is standing here
 * may be that another person has their password.
 */
export async function recover({ db, subtle, rand, nowS }, { handle, code, password }) {
  const lc = String(handle ?? '').toLowerCase();
  if (await overRate({ db, nowS }, `recover:${lc}`)) return { error: 'rate' };
  const pRefusal = passwordRefusal(password);
  if (pRefusal) return { error: `password-${pRefusal}` };

  const canon = codeForHashing(code);
  const player = lc ? await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(lc).first() : null;
  // Same shape as login: the derivation happens whether or not there is
  // anything to compare it against.
  const ok = await verifyPassword(canon ?? '', player?.recovery_hash ?? null, { subtle });
  if (!player || !canon || !ok) return { error: 'bad-code' };

  const next = mintRecoveryCode(rand);
  const [pw, rc] = await Promise.all([
    hashPassword(password, { subtle, rand }),
    hashPassword(codeForHashing(next), { subtle, rand }),
  ]);
  await db.prepare('UPDATE players SET password = ?, recovery_hash = ? WHERE id = ?').bind(pw, rc, player.id).run();
  await closeAllSessions({ db }, player.id);
  await clearRate({ db }, `recover:${lc}`);
  const session = await openSession({ db, subtle, rand, nowS }, player.id, null);
  return { id: player.id, name: displayName(player), recoveryCode: next, ...session };
}

/** Change a password from inside a session, which needs the OLD one -
 *  a stolen device should not be able to lock its owner out. Every
 *  OTHER device is signed out; this one stays. */
export async function changePassword({ db, subtle, rand }, player, session, { oldPassword, password }) {
  const pRefusal = passwordRefusal(password);
  if (pRefusal) return { error: `password-${pRefusal}` };
  if (!player.password) return { error: 'not-registered' };
  if (!await verifyPassword(oldPassword, player.password, { subtle })) return { error: 'bad-login' };
  const pw = await hashPassword(password, { subtle, rand });
  await db.prepare('UPDATE players SET password = ? WHERE id = ?').bind(pw, player.id).run();
  await db.prepare('DELETE FROM sessions WHERE player_id = ? AND id != ?').bind(player.id, session.id).run();
  return { ok: true };
}

/** An address, or none at all. COMPLETELY OPTIONAL (Mac) - nothing is
 *  gated behind it and an account works forever without one. */
export async function setEmail({ db }, playerId, email) {
  const e = email === null || email === '' ? null : String(email ?? '').trim();
  if (e !== null && (e.length > 254 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e))) return { error: 'email' };
  await db.prepare('UPDATE players SET email = ? WHERE id = ?').bind(e, playerId).run();
  return { email: e };
}
