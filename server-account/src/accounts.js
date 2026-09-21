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
//   A SESSION IS THE CREDENTIAL, one per device. Fight Life had one
//   secret per player and rotated it on sign-in, which made two devices
//   mutually exclusive - a desktop sign-in silently 401'd the phone on
//   every write. That bug is not being ported.
//
//   THE DISPLAYED NAME IS DERIVED, never stored twice: a handle if the
//   player has chosen one, the generated name otherwise. One function,
//   so the service and the token can never disagree about what a player
//   is called.
//
//   EVERY CLOCK IS AN ARGUMENT. Not one line here reads Date.now.
// ═══════════════════════════════════════════════════════════════════

import { guestName, isHandleShaped, isGuestShaped } from './guestName.js';
import { ID_RE, nameIsIssuable } from '../../src/net/identityToken.js';

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
  // The bank is the game's own, so this should never fire - it is here
  // because a name that cannot ride a token is an account that cannot
  // play, and the place to learn that is the mint.
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
  const player = await db.prepare('SELECT * FROM players WHERE id = ?').bind(session.player_id).first();
  // A session whose player is gone is not a session. It cannot happen
  // through the cascade, and it is checked because "cannot happen" is
  // how a null reaches a caller that reads `.handle` off it.
  if (!player) return null;
  if (Number.isSafeInteger(nowS)) {
    await db.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').bind(nowS, session.id).run();
    await db.prepare('UPDATE players SET last_seen = ? WHERE id = ?').bind(nowS, player.id).run();
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
    playerId: player.id,
    name: displayName(player),
    kind: accountKind(player),
    handle: player.handle ?? null,
    guestName: player.guest_name,
    createdAt: player.created_at,
    muted: isMuted(player, nowS),
  };
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
