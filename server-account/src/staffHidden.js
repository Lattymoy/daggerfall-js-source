// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-HIDDEN (2026-10-22, mob: "no tag no faint outline nothing just nothing", "true invis not lattys invis", "we
// want the player to have no idea we are wathcing them"; design doc "DFO Staff Panel: design", Invisible follow, Flat map's
// Hide me, and Weak spots "Invisible follow and the in-game view") - A STAFF MEMBER HIDDEN FROM EVERY PLAYER.
//
// NOT THE GAME'S INVISIBILITY. That one (INVIS-NET, INVIS-LOOK, src/net/remotePlayers.js) still sends the player's position
// to every game. A hidden staff member is never passed on to anyone: the relay drops what the socket says and leaves it out
// of every roster, list, count, join and leave (server/src/staffHidden.js). This file is the account service's half:
//
// HIDE ME, KEPT ON THE ACCOUNT (players.staff_hide_on, migration 0165): OFF BY DEFAULT, a toggle (STAFF-HIDE-TOGGLE, below);
// Hide me turns it on and Show myself off (/v1/staff/hide). It is read only for an account a role list names (staff.js
// staffRole: an Admin or a Moderator) that holds a LIVE staff session, so no other account's token mint reads a thing more.
//
// STAFF-HIDE-TOGGLE (2026-10-23, mob: "i cant talk in chat?", then "i need to be bale to talk in chat" and "need hide to be
// a toggle"): 0159 made Hide me ON BY DEFAULT (players.staff_hide, every row 1 - mob, 05:36Z the day before: "a switch in
// Your settings, on by default"), so a staff member who never pressed it was minted hidden tokens for as long as a staff
// session stood, and the relay drops every line a hidden socket says but the staff channel's (server/src/staffHidden.js
// hiddenMay) - mob could not talk in chat, and his own game was in no room the pen tool's map reads. Now it is off until
// pressed, for every member (0165 moves the switch to `staff_hide_on`, default 0, keeping a Hide me pressed since 0159 -
// the audit log's newest `hide` row), and either way the press takes effect AT ONCE: the panel tells the open game, through
// the staff hook's door (src/net/staffHook.js `relink`), to leave every room and open each again on a fresh token, which this
// file's mint (hiddenToken) reads the switch for on the primary - hidden from that hello on, or shown. Show myself still
// pushes its hide orders (hiddenEnd) for a game the panel cannot reach. What chat a hidden staff member may say is not
// decided yet (mob's call): the relay's half is server/src/staffHidden.js HIDDEN_CHAT and hiddenMay, the game's the mint's
// `hidden` answer (src/net/accountClient.js mintFresh, which drops it today) and the chat's send (scenes/world.js chatSend).
//
// THE TOKEN (hiddenToken): every relay token the game's own mint (index.js /v1/auth/token) makes for such an account while
// it is hidden carries `hd: 1` (identityToken.js), and its subject is NOT the account's id but one minted for the staff
// session (hiddenSubOf: the session's stored hash, hashed again under a label of its own - random to everyone else, the same
// for every socket of one session, a new one for the next session). So a hidden socket takes no seat of the account's and
// names nobody (Weak spots: "A hidden socket on the staff member's own account breaks one-seat rules"). Its name is
// HIDDEN_NAME, never the account's: the real account goes only in the audit log, where every hidden token minted is a row
// (`hidden-token`, its subject beside it). The session and the switch are read on the PRIMARY, never a replica's copy: a
// sign-in a moment old, or Hide me a moment on, must never mint a token that shows them.
//
// THE MARK LAPSES (hiddenEnd): Show myself, a staff sign-out, a key forgotten, an owner's cut and a Moderator removed each push a hide order
// for every subject the account's staff sessions minted (identityToken.js mintHideOrder) to the relay's law door; the hub
// closes those hidden sockets rather than show them, and the game comes back as a normal player on its next token - at once
// for Show myself pressed in a panel that reaches the game (STAFF-HIDE-TOGGLE: the game remakes every link on a fresh token). A
// session that only lapses - gone idle, past its 8 hours - is no such word (STAFF-PANEL5-HIDDEN-FIX): the game it hid is
// minted no token at all until the staff member signs in again or says one of them (hiddenToken, LAPSED_SQL).
//
// A PRIVATE HOME ENTERED (takeHiddenSeen): the relay reports a hidden subject entering an `owned:` room, signed with its
// receipt key (net/hiddenSeen.js); it is written to the audit log (`hidden-home`) as the staff member whose session minted
// the subject - a Hide me game's or a follow eye's - when one still stands; else as the subject alone, which the
// `hidden-token` row (or the `follow` row) names.
import { mintToken, mintHideOrder, MAX_TTL_S, _b64url } from '../../src/net/identityToken.js';
import { openHiddenSeen } from '../../src/net/hiddenSeen.js';
import { displayName, accountKind, isMuted, mutedUntil, nameAsOf } from './accounts.js';
import { conductAgreed } from './safety.js';
import { glyphsOf } from './titles.js';
import { signingKey, gatePublicKey } from './signing.js';
import { pushLaw } from './sanctions.js';
import { staffRole, auditStatement, configKey, STAFF_IDLE_S } from './staff.js';
import { followSubject } from './staffFollow.js';

export const HIDDEN_ROUTES = Object.freeze(['/v1/staff/hide']);
/** The name a hidden token carries - never the account's (wire.js sanitizeName keeps it as it is; a bare "Staff" it does not). */
export const HIDDEN_NAME = 'Staff member';
/** The glyphs a hidden token keeps: the staff's own, which the relay's staff rights read (net/staffCommands.js, the dev,
 *  mod and shadowfang glyphs of Message on screen) - never a cosmetic one. */
export const HIDDEN_GLYPHS = Object.freeze(['dev', 'mod', 'dm', 'shadowfang']);
/** The staff sessions one lapse reads at most (a member holds STAFF_KEYS_MAX keys, a session each, and a few dead ones). */
const SESSIONS_MAX = 20;

/** A staff session's hidden subject - its stored hash hashed again under a label of its own, in the shape of an account id
 *  (identityToken.js ID_RE). @param {string} tokenHash @param {SubtleCrypto} subtle */
export async function hiddenSubOf(tokenHash, subtle) {
  const d = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`dfo-hidden:v1:${tokenHash}`)));
  return _b64url.encode(d).slice(0, 24);
}

/** The account's newest live staff session whose key still stands, with the account's switch - staff.js staffSession's
 *  law, read without the session's own token. */
const LIVE_SQL = `SELECT p.staff_hide_on, s.token_hash, s.key_id, k.cfg, k.pub FROM staff_sessions s JOIN players p ON p.id = s.player_id
  JOIN staff_keys k ON k.id = s.key_id AND k.player_id = s.player_id AND k.revoked_at IS NULL AND k.handle_lc = p.handle_lc
  WHERE s.player_id = ?1 AND s.expires_at > ?2 AND s.last_act > ?3 ORDER BY s.created_at DESC, s.token_hash LIMIT ${SESSIONS_MAX}`;
/** STAFF-PANEL5-HIDDEN-FIX: whether the account's game was last minted hidden and the staff member has not ended it since -
 *  its newest `hidden-token` row with no later Show myself, sign-out of every session, sign-out of that row's own session
 *  (STAFF-PANEL5-HIDDEN-R2: its subject, staff.js's logout row - a key's other session signing out ends nothing of this
 *  one's), or the row's key forgotten (STAFF-PANEL5-HIDDEN-R2: hiddenEnd closed that key's sessions' sockets, and the
 *  game comes back as a normal player - a staff member's only key forgotten was refused for good). A session gone idle
 *  or past its 8 hours writes no row: it is no word of the staff member's.
 *  STAFF-HIDE-TOGGLE: and only while the switch is on, read on the primary beside the log - migration 0165 turned it off for
 *  every member who never pressed Hide me, and wrote no Show myself row for it (the move was mob's word, not theirs): read
 *  off the log alone, such a member's game, hidden before the move, would be minted no token at all once their session
 *  idled, and could never go online until they signed in or out. */
const LAPSED_SQL = `SELECT 1 AS held FROM (SELECT id, at, key_id, json_extract(detail, '$.sub') AS sub FROM staff_audit WHERE actor = ?1 AND act = 'hidden-token' ORDER BY at DESC, id DESC LIMIT 1) h
  WHERE (SELECT staff_hide_on FROM players WHERE id = ?1) = 1 AND NOT EXISTS (SELECT 1 FROM staff_audit e WHERE e.actor = ?1 AND e.at >= h.at AND e.id > h.id
    AND ((e.act = 'hide' AND e.detail = '{"on":false}') OR (e.act = 'logout' AND (e.detail = '{"all":true}' OR json_extract(e.detail, '$.sub') = h.sub))
      OR (e.act = 'key-forget' AND json_extract(e.detail, '$.id') = h.key_id)))`;

/**
 * THE GAME'S MINT, FOR A HIDDEN STAFF MEMBER: the spectator's token and the mint's answer, or null - the account is no
 * staff, holds no live staff session, or pressed Show myself - when the mint goes on as it always did; or
 * `{ error: 'staff-session-lapsed' }` (STAFF-PANEL5-HIDDEN-FIX, mob: "we want the player to have no idea we are wathcing
 * them"): the staff session the game was hidden by went idle or ran out its 8 hours while the game watched, and nothing
 * the staff member did since showed them - no token at all then, never a visible one beside the watched player, until
 * they sign in again (hidden again) or sign out or press Show myself (visible by their own word).
 * @param {any} ctx @param {any} env @param {any} player the mint's account row @param {CryptoKey} key the identity key
 */
export async function hiddenToken(ctx, env, player, key) {
  const role = staffRole(player, env);
  if (!role) return null;   // every other account: nothing read, the bytes it always minted
  const { subtle, nowS } = ctx;
  const db = ctx.primary ?? ctx.db;
  const live = ((await db.prepare(LIVE_SQL).bind(player.id, nowS, nowS - STAFF_IDLE_S).all())?.results ?? [])
    .find((r) => !r.cfg || configKey(player, env, r.pub));
  if (!live && await db.prepare(LAPSED_SQL).bind(player.id).first()) {
    await auditStatement(db, nowS, { actor: player, role, act: 'hidden-lapsed', outcome: 'denied', onceIn: 60 }).run();
    return { error: 'staff-session-lapsed' };
  }
  if (!live || live.staff_hide_on !== 1) return null;
  const sub = await hiddenSubOf(live.token_hash, subtle);
  // written BEFORE the token is: a token the log does not name is never handed out
  await auditStatement(db, nowS, { actor: player, role, act: 'hidden-token', detail: { sub }, keyId: live.key_id }).run();
  const g = glyphsOf(player, env, nowS).filter((x) => HIDDEN_GLYPHS.includes(x));
  const mu = isMuted(player, nowS) ? mutedUntil(player) : undefined;
  const token = await mintToken({ s: sub, n: HIDDEN_NAME, k: accountKind(player), ...(g.length ? { g } : {}), ...(mu ? { mu } : {}), hd: 1 }, key, { subtle, nowS });
  return {
    token, name: HIDDEN_NAME, accountName: displayName(player), nameAs: nameAsOf(player), kind: accountKind(player), title: null, glyphs: g,
    mutedUntil: mu ?? 0, conduct: conductAgreed(player), level: null, xp: null, guild: null, aura: null, icon: null, ribbon: null, house: null,
    expiresAt: nowS + MAX_TTL_S, hidden: 1, sub,
  };
}

/**
 * THE MARK LAPSES: a hide order pushed to the relay's door for each subject the account's staff sessions minted - every
 * one, or those `only` names (a sign-out of one session, a key forgotten). Read before the caller deletes the sessions;
 * pushed after the answer where the Worker lets it (`ctx.later`). Answers how many orders it made.
 * @param {any} ctx @param {any} env @param {string} playerId @param {string[]|null} [only] the sessions' stored hashes
 */
export async function hiddenEnd(ctx, env, playerId, only = null) {
  const { db, subtle, nowS } = ctx;
  const hashes = only ? only.slice(0, SESSIONS_MAX) : ((await db.prepare(`SELECT token_hash FROM staff_sessions WHERE player_id = ?1 LIMIT ${SESSIONS_MAX}`).bind(playerId).all())?.results ?? []).map((r) => r.token_hash);
  const key = hashes.length ? await signingKey(env, subtle) : null;
  if (!key) return 0;
  const orders = await Promise.all(hashes.map(async (h) => mintHideOrder({ s: await hiddenSubOf(h, subtle) }, key, { subtle, nowS })));
  const push = Promise.all(orders.map((o) => pushLaw(env, (u, i) => globalThis.fetch(u, i), o)));
  if (typeof ctx.later === 'function') ctx.later(push); else await push;
  return orders.length;
}

/**
 * THE PANEL'S DOOR: /v1/staff/hide { on } - Hide me (true) or Show myself (false), for the staff member's own account,
 * Admins and Moderators both; with no `on`, the switch as it stands, off until pressed (STAFF-HIDE-TOGGLE). -> { hidden }
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string, hash: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffHidden(ctx, env, path, body, who, audit) {
  const { db } = ctx;
  const me = who.player;
  if (path !== '/v1/staff/hide') return { error: 'body' };
  if (body.on === undefined) return { hidden: me.staff_hide_on === 1 };   // STAFF-HIDE-TOGGLE: off until pressed (0165)
  if (typeof body.on !== 'boolean') return { error: 'body' };
  const on = body.on ? 1 : 0;
  await db.batch([
    db.prepare('UPDATE players SET staff_hide_on = ?1 WHERE id = ?2').bind(on, me.id),
    audit('hide', null, { on: body.on }),
  ]);
  if (!on) await hiddenEnd(ctx, env, me.id);   // Show myself: the hidden sockets closed now, never shown
  // STAFF-HIDE-TOGGLE: Hide me pushes nothing - the panel tells the game to remake its links (staffHook.js `relink`), and each
  // new socket's mint reads the switch just written
  return { hidden: body.on };
}

/**
 * THE RELAY'S NOTE IN: a hidden subject entered a private home (net/hiddenSeen.js) - its audit row, as the staff member
 * whose session minted the subject. `{ ok }` or `{ error }`.
 * @param {any} ctx @param {any} env @param {Uint8Array} bytes @param {unknown} sig
 */
export async function takeHiddenSeen(ctx, env, bytes, sig) {
  const { subtle, nowS } = ctx;
  const db = ctx.primary ?? ctx.db;
  const opened = await openHiddenSeen(bytes, sig, await gatePublicKey(env, subtle), { subtle, nowMs: nowS * 1000 });
  if ('error' in opened) return opened;
  const { s, r } = opened.note;
  // whose session minted it: every staff session's subject (a dozen rows - staff.js deletes a member's dead ones at each sign-in) -
  // its Hide me game's (hiddenSubOf) or its follow eye's (staffFollow.js followSubject; STAFF-PANEL5-HIDDEN-FIX: a follow
  // socket's home was written as nobody's)
  const rows = (await db.prepare('SELECT s.token_hash AS s_hash, s.key_id AS s_key, p.* FROM staff_sessions s JOIN players p ON p.id = s.player_id LIMIT 500').all())?.results ?? [];
  let actor = null;
  for (const row of rows) if (await hiddenSubOf(row.s_hash, subtle) === s || await followSubject(row.s_hash, subtle) === s) { actor = row; break; }
  await auditStatement(db, nowS, { actor, role: actor ? staffRole(actor, env) : null, act: 'hidden-home', detail: { sub: s, room: r }, keyId: actor?.s_key ?? null, onceIn: 60 }).run();
  return { ok: true };
}
