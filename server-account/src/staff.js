// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL1 (2026-10-22, mob: a staff admin panel, its own browser extension; design doc "DFO Staff Panel: design",
// build step 1) - THE PANEL'S SIGN-IN, ITS SESSIONS, ITS ROLES AND ITS AUDIT LOG.
//
// ═══ THREE LOCKS (mob, 06:18Z: "just password and extension", "u have to be dev anyway", "thats 3 securitys") ═══
//
// 1. The account's password, checked as the game's sign-in checks it (password.js).
// 2. A key only the staff member's own copy of the extension holds: an Ed25519 pair it made on their computer. The
//    private half never leaves it; the service keeps the public half (staff_keys) and checks a signature over the
//    handle and the second it was made (staffWords). A signature works once (`last_ts`) and only within STAFF_SIG_S
//    of the service's clock.
// 3. The role lists the service already keeps, asked fresh on every request (titles.js): Admin is DEVELOPER_HANDLES,
//    Moderator anyone canModerate lets in (mob, 06:20Z: "mods still get theres as well"). A handle off a list is off
//    the panel at its next click. An Admin may also add and remove Moderators from the panel (mob, 07:42Z: "add it so
//    admins can add or remove moderatoers"): `players.staff_mod`, bound to the account, beside MODERATOR_HANDLES - the
//    config's own stay the config's, and the panel removes only the ones it added.
// A key is bound to the account AND the handle it was registered under, so a rename that hands a listed handle to
// another account (0134) hands it no way in. A key forgotten or cut is REVOKED, never deleted: its row stays, so it never
// signs in again and its spent seconds stay spent - an owner's config key too, which the config cannot bring back.
// THE EXTENSION'S CONTRACT: each sign-in signs a second later than the key's last (one a second at most), so a retry is a
// new signature, never the same one twice.
//
// ═══ WHY NOT THE GAME'S SESSION ════════════════════════════════════
//
// A game session lives a year in a browser's storage; the panel reads every player's private data. So the panel's
// session is its own (staff_sessions, header `x-staff-session`): 30 minutes idle - a poll is not the staff member -
// and 8 hours at most. A game secret opens no staff door and a staff token opens no game door.
//
// ═══ HOW A KEY IS REGISTERED ═══════════════════════════════════════
//
// An owner (OWNER_HANDLES, mob and Latty) mints a one-time invite (24 h) for a staff member; the member's extension
// signs in with the password and the invite and registers its key, proving it holds the private half. An owner's own
// first key is named in the config (OWNER_KEYS) - a public key, safe in a public repository - so the first owner needs
// nobody to invite them and nobody has to set a secret in Cloudflare (mob, 06:16Z: "can we use the tool being an
// extension to aovid this?"). With OWNER_KEYS empty nobody can sign in at all: unconfigured is shut, never open.
//
// ═══ WHAT IS REFUSED, AND HOW ══════════════════════════════════════
//
// Every refused sign-in is the same word, `staff-login`. Tries are bounded per address (STAFF_IP_MAX) and per handle
// from one address (STAFF_TRY_MAX), never per handle alone - a lockout keyed on the handle is a button anyone can press
// to shut a staff member out. A refusal where exactly one of the password and the key was right is written to the audit
// log, because that is somebody holding a staff member's password, or their key: the two an owner must hear about. That
// row is written off the answer's path (the Worker's waitUntil, `ctx.later`): awaited, a right password cost one more
// write than a wrong one - a clock to guess a password by, from as many addresses as an attacker holds.
import { verifyPassword, mintRecoveryCode, canonicalCode } from './password.js';
import { mintId, mintSecret, hashSecret, displayName, overRate, clearRate, overAccountRate } from './accounts.js';
import { isDeveloper, canModerate, handleList, developerHandles, moderatorHandles, TIER_LISTS, MOD_TIERS } from './titles.js';
import { isBanned } from './sanctions.js';

/** The header a staff session rides in - never `authorization`, which is the game's. */
export const STAFF_SESSION_HEADER = 'x-staff-session';
/** A session dies after this long without a staff member's own act (a poll does not count - `poll: true`). */
export const STAFF_IDLE_S = 30 * 60;
/** ...and this long after it opened, acts or not. */
export const STAFF_MAX_S = 8 * 60 * 60;
/** How stale `last_act` may grow before an act writes it again (one write a minute at most). */
export const STAFF_TOUCH_S = 60;
/** How far a signature's second may stand from the service's clock, either way. */
export const STAFF_SIG_S = 5 * 60;
/** Extension keys one staff account may hold - a computer each. */
export const STAFF_KEYS_MAX = 5;
/** An owner's invite lasts this long. */
export const STAFF_INVITE_S = 24 * 60 * 60;
/** Sign-in tries: per address, and per handle from one address. */
export const STAFF_IP_MAX = 30;
export const STAFF_TRY_MAX = 5;
export const STAFF_TRY_WINDOW_S = 15 * 60;
/** Requests a staff session may make a minute, counted in the isolate's memory as a game session's are. */
export const STAFF_RATE_MAX = 120;
/** Audit rows one read returns at most. */
export const STAFF_AUDIT_PAGE = 100;
/** How long the audit log keeps a row (mob, 12:12Z: "only keep for one month") - past it the hourly job deletes it
 *  (cron.js staff-audit); inside it nobody can (migration 0144's trigger, an hour short of this for the two clocks). */
export const STAFF_AUDIT_KEEP_S = 30 * 24 * 60 * 60;
/** A read of the audit log, the team or the moderators is written once in this, a member and a view, whatever its page
 *  (a review of the PR: every read, and every page of one, was a row). */
export const STAFF_READ_ROW_S = 10 * 60;

/** What an extension signs: what it is doing ('login' or 'enroll'), the handle, and the second it signed at. */
export const staffWords = (/** @type {'login'|'enroll'} */ what, /** @type {string} */ lc, /** @type {number} */ ts) => `dfo-staff:v1:${what}:${lc}:${ts}`;

/** What each refusal answers. */
export const STAFF_STATUS = Object.freeze({
  'staff-login': 401, 'staff-session': 401, 'staff-owner': 403, 'staff-admin': 403, 'no-staff': 404, 'no-key': 404, 'no-player': 404,
  'staff-self': 409, 'staff-keys-full': 409, 'staff-already': 409, 'staff-banned': 409, 'staff-config': 409, 'rate': 429, 'body': 400,
});

const enc = new TextEncoder();
const unb64 = (/** @type {unknown} */ s) => {
  if (typeof s !== 'string' || !/^[\w-]+$/.test(s)) return null;
  try { return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)); } catch { return null; }
};

/** 'admin', 'moderator' or null - asked of the lists, fresh. @param {any} player @param {any} env */
export function staffRole(player, env) {
  if (typeof player?.handle !== 'string' || !player.handle) return null;
  if (isDeveloper(player, env)) return 'admin';
  return canModerate(player, env) ? 'moderator' : null;
}
/** An owner: staff, and on OWNER_HANDLES. @param {any} player @param {any} env */
export const isOwner = (player, env) => !!staffRole(player, env) && handleList(env?.OWNER_HANDLES).has(String(player.handle).toLowerCase());

/** OWNER_KEYS, read: `handle:publicKey` pairs, the key raw Ed25519 in base64url. @param {any} env */
export function ownerKeys(env) {
  const out = new Map();
  for (const pair of String(env?.OWNER_KEYS ?? '').split(',')) {
    const [h, k] = pair.split(':').map((x) => x.trim());
    if (h && k) out.set(h.toLowerCase(), k);
  }
  return out;
}
/** Whether `pub` is this owner's key in the config - the only way a config key stands. @param {any} player @param {any} env @param {unknown} pub */
const configKey = (player, env, pub) => typeof pub === 'string' && isOwner(player, env) && ownerKeys(env).get(String(player.handle).toLowerCase()) === pub;

/** Every handle a role list names - the team an owner manages. @param {any} env */
function staffHandles(env) {
  const all = new Set([...developerHandles(env), ...moderatorHandles(env)]);
  for (const t of MOD_TIERS) for (const h of handleList(env?.[TIER_LISTS[/** @type {keyof typeof TIER_LISTS} */ (t)]])) all.add(h);
  return [...all];
}

/** ONE AUDIT ROW, as a statement for the batch it belongs to. `detail` is a small object, kept as JSON. `outcome` ok,
 *  denied (a role's door refused it) or failed (it changed nothing) - a review of the PR: a failed act read as done. `okIf`
 *  an EXISTS the batch's own next statement changes a row by, asked ahead of it in the same transaction - ok when it holds,
 *  failed when not. `onceIn` seconds: written only when this member wrote no row of this kind, about this target with this
 *  detail, in them (the fourth review of the PR: keyed on the member alone, a second member's read, or another view of
 *  the log, inside one member's window left no trace).
 *  @param {any} db @param {number} nowS
 *  @param {{ actor?: any, role?: string|null, act: string, target?: string|null, detail?: object|null, keyId?: string|null, outcome?: 'ok'|'denied'|'failed', okIf?: { sql: string, args: unknown[] }|null, onceIn?: number }} row */
export const auditStatement = (db, nowS, { actor = null, role = null, act, target = null, detail = null, keyId = null, outcome = 'ok', okIf = null, onceIn = 0 }) => {
  const said = detail ? JSON.stringify(detail) : null;
  return db.prepare(`INSERT INTO staff_audit (at, actor, actor_name, role, act, target, detail, key_id, outcome) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ${okIf ? `CASE WHEN ${okIf.sql} THEN 'ok' ELSE 'failed' END` : '?'}${onceIn ? ' WHERE NOT EXISTS (SELECT 1 FROM staff_audit WHERE actor = ? AND act = ? AND target IS ? AND detail IS ? AND at > ?)' : ''}`)
    .bind(nowS, actor?.id ?? null, actor ? displayName(actor) : null, role, act, target, said, keyId,
      ...(okIf ? okIf.args : [outcome]), ...(onceIn ? [actor?.id ?? null, act, target, said, nowS - onceIn] : []));
};

/** The handle a body names, folded as the lists fold it. @param {unknown} h */
const handleLc = (h) => (typeof h === 'string' ? h.trim().toLowerCase().slice(0, 64) : '');

/**
 * Whether the body's `sig` is `pub`'s signature over staffWords(what, lc, ts), `ts` within STAFF_SIG_S of now.
 * @param {SubtleCrypto} subtle @param {any} body @param {'login'|'enroll'} what @param {string} lc @param {number} nowS
 */
async function signed(subtle, body, what, lc, nowS) {
  const pub = unb64(body.pub); const sig = unb64(body.sig);
  if (pub?.length !== 32 || sig?.length !== 64 || !Number.isSafeInteger(body.ts) || Math.abs(body.ts - nowS) > STAFF_SIG_S) return false;
  try {
    const key = await subtle.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, key, sig, enc.encode(staffWords(what, lc, body.ts)));
  } catch { return false; }
}

/**
 * THE PASSWORD STEP both open doors share: the tries counted, the account read, the password derived whether or not
 * the handle exists (a handle nobody holds costs what a wrong password costs - accounts.js login), and the role asked.
 * @param {any} ctx @param {any} env @param {any} body @param {string} ip
 */
async function passwordStep(ctx, env, body, ip) {
  const { db, subtle } = ctx;
  const lc = handleLc(body.handle);
  if (await overRate(ctx, `staffip:${ip}`, STAFF_IP_MAX, STAFF_TRY_WINDOW_S)) return { error: 'rate' };
  if (lc && await overRate(ctx, `stafftry:${lc}:${ip}`, STAFF_TRY_MAX, STAFF_TRY_WINDOW_S)) return { error: 'rate' };
  const player = lc ? await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(lc).first() : null;
  const ok = await verifyPassword(body.password, player?.password ?? null, { subtle });
  return { player, role: staffRole(player, env), lc, ok };
}

/** A refused sign-in: written down when exactly one of the password and the key was right (somebody holds the other),
 *  or the account is banned; the same word either way. */
async function refused(/** @type {any} */ ctx, /** @type {any} */ player, /** @type {string|null} */ role, /** @type {string|null} */ why) {
  if (why) {
    const write = auditStatement(ctx.db, ctx.nowS, { actor: player, role, act: 'login-refused', detail: { why }, outcome: 'denied' }).run();
    if (typeof ctx.later === 'function') ctx.later(write.catch(() => {})); else await write;
  }
  return { error: 'staff-login' };
}

/**
 * POST /v1/staff/login { handle, password, pub, ts, sig }
 *   -> { session, role, handle, owner, idleS, expiresAt, keyId }
 * `pub` the extension's public key, `sig` its signature over staffWords('login', handle, ts).
 */
export async function staffLogin(ctx, env, /** @type {any} */ body, /** @type {string} */ ip) {
  const p = await passwordStep(ctx, env, body, ip);
  if ('error' in p) return p;
  const { player, role, lc, ok } = p;
  if (!player || !role) return { error: 'staff-login' };
  const { db, rand, nowS } = ctx;
  // the key the body names: one registered to this account under this handle and not revoked (a config key's only while
  // the config names it), or this owner's config key the first time - a key with no row at all, so one revoked, or bound
  // to another account, never comes back
  const any = typeof body.pub === 'string' ? await db.prepare('SELECT * FROM staff_keys WHERE pub = ?').bind(body.pub).first() : null;
  const inConfig = configKey(player, env, body.pub);
  let row = any && !any.revoked_at && any.player_id === player.id && any.handle_lc === lc && (!any.cfg || inConfig) ? any : null;
  const fromConfig = !any && inConfig;
  const keyOk = (!!row || fromConfig) && await signed(ctx.subtle, body, 'login', lc, nowS);
  if (!ok || !keyOk) return refused(ctx, player, role, ok === keyOk ? null : ok ? 'key' : 'password');
  if (isBanned(player, nowS)) return refused(ctx, player, role, 'banned');
  if (fromConfig) {
    // the owner's config key gets its row the first time it is used, so its signatures are spent as every key's are
    await db.prepare(`INSERT INTO staff_keys (id, player_id, handle_lc, pub, label, created_at, last_ts, cfg) VALUES (?, ?, ?, ?, 'owner key (config)', ?, 0, 1)
      ON CONFLICT(pub) DO NOTHING`).bind(mintId(rand), player.id, lc, body.pub, nowS).run();
    row = await db.prepare('SELECT * FROM staff_keys WHERE pub = ? AND player_id = ? AND handle_lc = ? AND revoked_at IS NULL').bind(body.pub, player.id, lc).first();
    if (!row) return refused(ctx, player, role, 'key');
  }
  // the second taken in the same statement that checks it is newer - a signature replayed, or two racing, one gets in
  const took = await db.prepare('UPDATE staff_keys SET last_ts = ?, last_used = ? WHERE id = ? AND last_ts < ?').bind(body.ts, nowS, row.id, body.ts).run();
  if (!took.meta.changes) return refused(ctx, player, role, 'replayed');
  await clearRate(ctx, `stafftry:${lc}:${ip}`);
  return openStaff(ctx, env, player, role, { keyId: row.id, act: 'login' });
}

/**
 * POST /v1/staff/enroll { handle, password, invite, pub, ts, sig, label? } -> /v1/staff/login's answer
 * A new extension's key registered with an owner's invite - `sig` over staffWords('enroll', handle, ts) proves the
 * extension holds its private half - and a session opened. The invite is spent.
 */
export async function staffEnroll(ctx, env, /** @type {any} */ body, /** @type {string} */ ip) {
  const p = await passwordStep(ctx, env, body, ip);
  if ('error' in p) return p;
  const { player, role, lc, ok } = p;
  if (!player || !role) return { error: 'staff-login' };
  const { db, rand, subtle, nowS } = ctx;
  const canon = canonicalCode(body.invite);
  const invite = canon ? await db.prepare('SELECT * FROM staff_invites WHERE code_hash = ? AND player_id = ? AND expires_at > ?')
    .bind(await hashSecret(canon, { subtle }), player.id, nowS).first() : null;
  const keyOk = await signed(subtle, body, 'enroll', lc, nowS);
  if (!ok || !invite || !keyOk) return refused(ctx, player, role, ok && invite ? 'key' : ok ? 'invite' : invite ? 'password' : null);
  if (isBanned(player, nowS)) return refused(ctx, player, role, 'banned');
  const held = await db.prepare('SELECT COUNT(*) AS n FROM staff_keys WHERE player_id = ? AND revoked_at IS NULL').bind(player.id).first();
  if ((held?.n ?? 0) >= STAFF_KEYS_MAX) return { error: 'staff-keys-full' };
  // the invite spent FIRST, and only one spend wins - two enrolments racing on one invite register one key, not two
  const spent = await db.prepare('DELETE FROM staff_invites WHERE code_hash = ? AND player_id = ? AND expires_at > ?').bind(invite.code_hash, player.id, nowS).run();
  if (!spent.meta.changes) return refused(ctx, player, role, 'invite-spent');
  const keyId = mintId(rand);
  const made = await db.prepare(`INSERT INTO staff_keys (id, player_id, handle_lc, pub, label, created_at, last_ts, last_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pub) DO NOTHING`).bind(keyId, player.id, lc, body.pub, typeof body.label === 'string' ? body.label.slice(0, 64) : null, nowS, body.ts, nowS).run();
  if (!made.meta.changes) return refused(ctx, player, role, 'key-taken');
  await clearRate(ctx, `stafftry:${lc}:${ip}`);
  return openStaff(ctx, env, player, role, { keyId, act: 'enrolled', detail: { by: invite.by_id } });
}

/** A session opened, with its audit row, in one batch. */
async function openStaff(/** @type {any} */ ctx, /** @type {any} */ env, /** @type {any} */ player, /** @type {string} */ role,
  /** @type {{ keyId: string, act: string, detail?: object|null }} */ { keyId, act, detail = null }) {
  const { db, subtle, rand, nowS } = ctx;
  const token = mintSecret(rand);
  await db.batch([
    db.prepare('DELETE FROM staff_sessions WHERE player_id = ? AND (expires_at <= ? OR last_act <= ?)').bind(player.id, nowS, nowS - STAFF_IDLE_S),
    db.prepare('INSERT INTO staff_sessions (token_hash, player_id, key_id, created_at, last_act, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(await hashSecret(token, { subtle }), player.id, keyId, nowS, nowS, nowS + STAFF_MAX_S),
    auditStatement(db, nowS, { actor: player, role, act, detail, keyId }),
  ]);
  return { session: token, role, handle: player.handle, owner: isOwner(player, env), idleS: STAFF_IDLE_S, expiresAt: nowS + STAFF_MAX_S, keyId };
}

const STAFF_WHO_SQL = `SELECT s.key_id AS s_key, s.last_act AS s_act, s.expires_at AS s_expires, k.handle_lc AS k_handle, k.cfg AS k_cfg, k.pub AS k_pub, p.*
  FROM staff_sessions s JOIN players p ON p.id = s.player_id LEFT JOIN staff_keys k ON k.id = s.key_id AND k.player_id = s.player_id AND k.revoked_at IS NULL
  WHERE s.token_hash = ?`;

/**
 * WHO IS THIS STAFF MEMBER? One read: the session, its account and its key. Dead - and deleted - when it is past its
 * idle or its whole life, when the account is off every list or banned, when its key was forgotten or cut (or is a config
 * key the config no longer names), or when the account no longer holds the handle the key was registered under. `act` false (a poll) does not count as being there.
 * @param {any} ctx @param {any} env @param {unknown} token
 */
export async function staffSession(ctx, env, token, { act = true } = {}) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 128) return null;
  const { db, subtle, nowS } = ctx;
  const hash = await hashSecret(token, { subtle });
  const row = await db.prepare(STAFF_WHO_SQL).bind(hash).first();
  if (!row) return null;
  const role = staffRole(row, env);
  if (!role || row.s_expires <= nowS || row.s_act + STAFF_IDLE_S <= nowS || !row.k_handle || row.k_handle !== row.handle_lc || (row.k_cfg && !configKey(row, env, row.k_pub)) || isBanned(row, nowS)) {
    await db.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  let lastAct = row.s_act;
  if (act && nowS - lastAct >= STAFF_TOUCH_S) {
    await db.prepare('UPDATE staff_sessions SET last_act = ? WHERE token_hash = ?').bind(nowS, hash).run();
    lastAct = nowS;
  }
  return { player: row, role, owner: isOwner(row, env), hash, keyId: row.s_key, idleAt: lastAct + STAFF_IDLE_S, expiresAt: row.s_expires };
}

/**
 * THE STAFF DOORS, one entry: the two open ones by password and key, the rest behind a live staff session.
 * Answers the route's body, or `{ error }` (STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body @param {{ ip: string, token: string|null }} req
 */
export async function staffRoute(ctx, env, path, body, { ip, token }) {
  if (path === '/v1/staff/login') return staffLogin(ctx, env, body, ip);
  if (path === '/v1/staff/enroll') return staffEnroll(ctx, env, body, ip);
  const who = await staffSession(ctx, env, token, { act: body.poll !== true });
  if (!who) return { error: 'staff-session' };
  const { db, rand, subtle, nowS } = ctx;
  const me = who.player;
  if (overAccountRate(`staff:${me.id}`, nowS, STAFF_RATE_MAX, 60)) return { error: 'rate' };
  const audit = (/** @type {string} */ act, /** @type {string|null} */ target = null, /** @type {object|null} */ detail = null, /** @type {{ outcome?: 'ok'|'denied'|'failed', okIf?: { sql: string, args: unknown[] }, onceIn?: number }} */ how = {}) =>
    auditStatement(db, nowS, { actor: me, role: who.role, act, target, detail, keyId: who.keyId, ...how });
  /** A role's door refused this member: written down (a review of the PR: a Moderator trying an owner's page left no trace). */
  const denied = async (/** @type {string} */ error) => { await audit('refused', null, { path, need: error === 'staff-admin' ? 'admin' : 'owner' }, { outcome: 'denied' }).run(); return { error }; };

  if (path === '/v1/staff/me') {
    return { handle: me.handle, role: who.role, owner: who.owner, idleS: STAFF_IDLE_S, idleAt: who.idleAt, expiresAt: who.expiresAt, keyId: who.keyId };
  }
  if (path === '/v1/staff/logout') {
    const all = body.all === true;
    await db.batch([
      all ? db.prepare('DELETE FROM staff_sessions WHERE player_id = ?').bind(me.id) : db.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').bind(who.hash),
      audit('logout', null, { all }),
    ]);
    return { ok: true, all };
  }
  if (path === '/v1/staff/keys') {
    const r = await db.prepare('SELECT id, label, created_at, last_used FROM staff_keys WHERE player_id = ? AND revoked_at IS NULL ORDER BY last_used DESC').bind(me.id).all();
    return { keys: (r.results ?? []).map((k) => ({ id: k.id, label: k.label, createdAt: k.created_at, lastUsed: k.last_used, current: k.id === who.keyId })) };
  }
  if (path === '/v1/staff/key/forget') {
    if (typeof body.id !== 'string') return { error: 'body' };
    const [, gone] = await db.batch([
      audit('key-forget', null, { id: body.id.slice(0, 40) }, { okIf: { sql: 'EXISTS (SELECT 1 FROM staff_keys WHERE id = ? AND player_id = ? AND revoked_at IS NULL)', args: [body.id, me.id] } }),
      db.prepare('UPDATE staff_keys SET revoked_at = ? WHERE id = ? AND player_id = ? AND revoked_at IS NULL').bind(nowS, body.id, me.id),
      db.prepare('DELETE FROM staff_sessions WHERE key_id = ? AND player_id = ?').bind(body.id, me.id),
    ]);
    return gone.meta.changes ? { ok: true, id: body.id } : { error: 'no-key' };
  }

  // ═══ THE ADMINS' DOORS: THE PANEL'S MODERATORS (mob, 07:42Z: "add it so admins can add or remove moderatoers") ═══
  // /v1/staff/mods lists them; /v1/staff/mod/add and /mod/remove { handle } - a registered account, not banned, not staff
  // already. One the config names (MODERATOR_HANDLES, a moderating title, an Admin) is the config's to remove, never the
  // panel's. Removed, a member holding no other role loses every key, session and invite, as a cut does.
  if (path === '/v1/staff/mods' || path === '/v1/staff/mod/add' || path === '/v1/staff/mod/remove') {
    if (who.role !== 'admin') return denied('staff-admin');
    if (path === '/v1/staff/mods') {
      const r = await db.prepare('SELECT id, handle FROM players WHERE staff_mod = 1 ORDER BY handle_lc LIMIT 500').all();
      await audit('mods-read', null, null, { onceIn: STAFF_READ_ROW_S }).run();
      return { mods: (r.results ?? []).map((p) => ({ id: p.id, handle: p.handle })), config: staffHandles(env).filter((h) => !developerHandles(env).has(h)) };
    }
    const lc = handleLc(body.handle);
    const target = lc ? await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(lc).first() : null;
    if (!target?.handle) return { error: 'no-player' };
    if (path === '/v1/staff/mod/add') {
      if (staffRole(target, env)) return { error: 'staff-already' };
      if (isBanned(target, nowS)) return { error: 'staff-banned' };
      const [, set] = await db.batch([
        audit('mod-add', target.id, { handle: target.handle }, { okIf: { sql: 'EXISTS (SELECT 1 FROM players WHERE id = ? AND staff_mod = 0)', args: [target.id] } }),
        db.prepare('UPDATE players SET staff_mod = 1 WHERE id = ? AND staff_mod = 0').bind(target.id),
      ]);
      return set.meta.changes ? { ok: true, handle: target.handle } : { error: 'staff-already' };
    }
    if (target.staff_mod !== 1) return { error: staffRole(target, env) ? 'staff-config' : 'no-staff' };
    if (staffRole({ ...target, staff_mod: 0 }, env)) return { error: 'staff-config' };   // the config holds them still
    await db.batch([
      audit('mod-remove', target.id, { handle: target.handle }, { okIf: { sql: 'EXISTS (SELECT 1 FROM players WHERE id = ? AND staff_mod = 1)', args: [target.id] } }),
      db.prepare('UPDATE players SET staff_mod = 0 WHERE id = ?').bind(target.id),
      db.prepare('UPDATE staff_keys SET revoked_at = ? WHERE player_id = ? AND revoked_at IS NULL').bind(nowS, target.id),
      ...['staff_sessions', 'staff_invites'].map((t) => db.prepare(`DELETE FROM ${t} WHERE player_id = ?`).bind(target.id)),
    ]);
    return { ok: true, handle: target.handle };
  }

  // ═══ THE OWNERS' DOORS ═══
  if (!who.owner) return denied('staff-owner');
  if (path === '/v1/staff/team') {
    const handles = staffHandles(env).slice(0, 90);   // D1 binds 100 at most; the lists name a dozen
    const r = await db.prepare(`SELECT p.*,
        (SELECT COUNT(*) FROM staff_keys k WHERE k.player_id = p.id AND k.handle_lc = p.handle_lc AND k.revoked_at IS NULL) AS keys,
        (SELECT COUNT(*) FROM staff_sessions s WHERE s.player_id = p.id AND s.expires_at > ?1 AND s.last_act > ?2) AS live,
        (SELECT MAX(expires_at) FROM staff_invites i WHERE i.player_id = p.id AND i.expires_at > ?1) AS invite_until
      FROM players p WHERE p.staff_mod = 1 OR p.handle_lc IN (${['NULL', ...handles.map((_, i) => `?${i + 3}`)].join(', ')})`)
      .bind(nowS, nowS - STAFF_IDLE_S, ...handles).all();
    await audit('team-read', null, null, { onceIn: STAFF_READ_ROW_S }).run();
    return {
      team: (r.results ?? []).map((p) => ({
        id: p.id, handle: p.handle, role: staffRole(p, env), owner: isOwner(p, env), keys: p.keys, sessions: p.live, inviteUntil: p.invite_until ?? null,
      })),
    };
  }
  if (path === '/v1/staff/invite' || path === '/v1/staff/cut') {
    const lc = handleLc(body.handle);
    const target = lc ? await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(lc).first() : null;
    const role = staffRole(target, env);
    if (!target || !role) return { error: 'no-staff' };
    if (path === '/v1/staff/cut') {
      if (target.id === me.id) return { error: 'staff-self' };
      await db.batch([
        db.prepare('UPDATE staff_keys SET revoked_at = ? WHERE player_id = ? AND revoked_at IS NULL').bind(nowS, target.id),
        ...['staff_sessions', 'staff_invites'].map((t) => db.prepare(`DELETE FROM ${t} WHERE player_id = ?`).bind(target.id)),
        audit('cut', target.id, { handle: target.handle, role }),
      ]);
      return { ok: true, handle: target.handle };
    }
    const code = mintRecoveryCode(rand);
    const canon = canonicalCode(code);
    if (!canon) throw new Error('a minted invite failed to canonicalise');   // AUDIT-PW P1's lesson: never hash a code that is not one
    const until = nowS + STAFF_INVITE_S;
    await db.batch([
      db.prepare('DELETE FROM staff_invites WHERE player_id = ?').bind(target.id),   // one live invite a member: a new one replaces it
      db.prepare('INSERT INTO staff_invites (code_hash, player_id, by_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(await hashSecret(canon, { subtle }), target.id, me.id, nowS, until),
      audit('invite', target.id, { handle: target.handle, role }),
    ]);
    return { ok: true, handle: target.handle, role, invite: code, expiresAt: until };
  }
  // /v1/staff/audit { actor?, target?, act?, before?, limit? } - newest first; the read is itself a row, once in
  // STAFF_READ_ROW_S a view (its filters) whatever its page - `before` is the caller's word, so a read that named one
  // was a read left unwritten (the fourth review of the PR: any `before` past the newest row is the first page)
  const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v ? v.slice(0, 64) : null);
  const before = Number.isSafeInteger(body.before) && body.before > 0 ? body.before : null;
  const limit = Number.isSafeInteger(body.limit) ? Math.min(Math.max(body.limit, 1), STAFF_AUDIT_PAGE) : STAFF_AUDIT_PAGE;
  const view = { actor: str(body.actor), target: str(body.target), act: str(body.act) };
  const r = await db.prepare(`SELECT * FROM staff_audit WHERE (?1 IS NULL OR actor = ?1) AND (?2 IS NULL OR target = ?2)
    AND (?3 IS NULL OR act = ?3) AND (?4 IS NULL OR id < ?4) ORDER BY id DESC LIMIT ?5`)
    .bind(view.actor, view.target, view.act, before, limit).all();
  await audit('audit-read', view.target, view, { onceIn: STAFF_READ_ROW_S }).run();
  return {
    rows: (r.results ?? []).map((a) => {
      let detail = null;
      try { detail = a.detail ? JSON.parse(a.detail) : null; } catch { detail = null; }
      return { id: a.id, at: a.at, actor: a.actor, actorName: a.actor_name, role: a.role, act: a.act, target: a.target, detail, keyId: a.key_id, outcome: a.outcome };
    }),
  };
}
