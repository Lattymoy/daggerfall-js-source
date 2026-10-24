// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow, and the weak spot "Follow isn't
// audited and hears private talk": "A follow token names its target and is logged when minted, and entering a home is
// logged") - THE FOLLOW TOKEN. One door, /v1/staff/follow { sub, room? }: a relay token for a hidden staff spectator
// (`hd` 1, the hidden builder's mark) that names the account it follows (`fo`), minted on a live staff session and
// written to the audit log as it is minted.
//
// WHO (mob, 07:04Z: "Moderators may follow any player anywhere, as Admins do, and the audit log is the check"): an Admin
// or a Moderator, any registered or guest player but themselves.
//
// WHAT IT CARRIES: never the staff member's own account or name - a hidden socket on their own account would break the
// one-seat rules (design doc weak spot "A hidden socket on the staff member's own account breaks one-seat rules"). Its
// subject is the session's own (FOLLOW_SUBJECT_PREFIX and the session's hash, digested: the same through one staff
// session, another the next), its name SPECTATOR_NAME, a guest's kind; the real name is in the audit row alone.
//
// A TOKEN OPENS EACH ROOM ONCE (net/identityToken.js), so the game asks one for each room its follow enters, naming it
// (`room`). A private one - a home, a caravan, a boat's cabin - is written down by name (`follow-home`); every other is
// one `follow` row a member, a target and a minute (onceIn). The owners are not alerted: that waits for mob (the design
// doc's privacy policy line, "staff may watch play").
// ═══════════════════════════════════════════════════════════════════
import { mintToken, ID_RE, MAX_TTL_S } from '../../src/net/identityToken.js';
import { privateInteriorOf } from '../../src/net/privateInterior.js';
import { signingKey } from './signing.js';
import { displayName } from './accounts.js';

export const FOLLOW_ROUTES = Object.freeze(['/v1/staff/follow']);
/** The roles that may follow (mob, 07:04Z). */
export const FOLLOW_ROLES = Object.freeze(['admin', 'moderator']);
/** A follow's rows: one a member, a target and this many seconds - a follow through ten rooms is one row, not ten. */
export const FOLLOW_AUDIT_S = 60;
/** The name a follow token signs - the relay shows the socket to nobody, and staff are never named on it. */
export const SPECTATOR_NAME = 'Spectator';
/** A hidden subject's prefix. It is 27 characters with its digest, and a player's id is 24 (accounts.js mintId), so the
 *  two never meet. */
export const FOLLOW_SUBJECT_PREFIX = 'hd-';
/** A room a follow asks for: a relay room key's alphabet, and no longer than one. */
const ROOM_RE = /^[\w:.,#@+-]{1,128}$/;

/** The hidden subject of one staff session - its hash, digested and cut to an id. @param {string} hash @param {SubtleCrypto} subtle */
export async function followSubject(hash, subtle) {
  const d = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`dfo-follow:${hash}`)));
  return FOLLOW_SUBJECT_PREFIX + [...d.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether a room is someone's private room - a home, a caravan, a boat's cabin (privateInteriorOf names all three).
 *  @param {string} room */
export const privateRoomOf = (room) => !!privateInteriorOf(room);

/**
 * /v1/staff/follow - the route staff.js hands on. `who` the live staff session; `audit` its row maker.
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string, hash: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: { outcome?: 'ok'|'denied'|'failed', onceIn?: number }) => any} audit
 */
export async function staffFollow(ctx, env, path, body, who, audit) {
  const { db, subtle, nowS } = ctx;
  if (path !== '/v1/staff/follow') return { error: 'body' };
  if (!FOLLOW_ROLES.includes(who.role)) { await audit('refused', null, { path, need: 'moderator' }, { outcome: 'denied' }).run(); return { error: 'staff-admin' }; }
  const sub = body?.sub, room = body?.room ?? null;
  if (typeof sub !== 'string' || !ID_RE.test(sub) || (room !== null && (typeof room !== 'string' || !ROOM_RE.test(room)))) return { error: 'body' };
  if (sub === who.player.id) return { error: 'staff-self' };
  const target = await db.prepare('SELECT * FROM players WHERE id = ?').bind(sub).first();
  if (!target) return { error: 'no-player' };
  const home = room !== null && privateRoomOf(room);
  const act = home ? 'follow-home' : 'follow';
  const eye = await followSubject(who.hash, subtle);
  const detail = home ? { room, sub: eye } : { sub: eye };   // STAFF-PANEL5-HIDDEN-FIX: the subject, so a home the relay saw it enter is this row's member's
  const key = await signingKey(env, subtle);
  if (!key) { await audit(act, sub, detail, { outcome: 'failed' }).run(); return { error: 'no-signing-key' }; }
  const token = await mintToken({ s: eye, n: SPECTATOR_NAME, k: 'guest', hd: 1, fo: sub }, key, { subtle, nowS });
  await audit(act, sub, detail, { onceIn: FOLLOW_AUDIT_S }).run();
  return { token, sub, name: displayName(target), expiresAt: nowS + MAX_TTL_S };
}
