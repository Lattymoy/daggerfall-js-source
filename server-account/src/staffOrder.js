// @ts-check
// AN ORDER FROM OUTSIDE THE PANEL: a member on CLAUDE_ORDER_HANDLES enrols a public key from their own signed-in panel
// session (/v1/staff/order-key/add), and a request signed by it (POST /v1/staff/order) runs one panel door as that member.
// No password is stored and no session outlives the request. The door is run by the same dispatcher a panel session uses
// (staff.js staffDispatch): every role, owner, claim and rate check is unchanged, and every audit row carries via.
// Sign-in, key, invite, owner-key and order-key doors are refused here. The signature covers the handle, the second and a
// hash of the path and body: dfo-staff:v1:order:<handle>:<ts>:<sha256 hex of path, a newline and the body as canonical JSON>.
import { mintId, overRate, clearRate } from './accounts.js';
import { handleList } from './titles.js';
import { isBanned } from './sanctions.js';
import { STAFF_ROUTES } from './service.js';
import { staffRole, refused, auditStatement, STAFF_IP_MAX, STAFF_TRY_MAX, STAFF_TRY_WINDOW_S, STAFF_SIG_S } from './staff.js';
import { HIDDEN_ROUTES } from './staffHidden.js';
import { FOLLOW_ROUTES } from './staffFollow.js';

export const ORDER_PATH = '/v1/staff/order';
export const ORDER_KEY_ROUTES = Object.freeze(['/v1/staff/order-key/add', '/v1/staff/order-key/list', '/v1/staff/order-key/revoke']);
/** Live order keys one account may hold. */
export const ORDER_KEYS_MAX = 2;
export const ORDER_VIA = 'claude-project';
const LABEL_MAX = 40;
/** Doors an order never reaches: sign-in, keys, invites, the order's own, and those that need a live panel session (claims,
 *  hiding, following): a claim made with no session would hold nothing. */
const FORBIDDEN = new Set([
  '/v1/staff/login', '/v1/staff/enroll', '/v1/staff/logout', '/v1/staff/keys', '/v1/staff/key/forget', '/v1/staff/invite', '/v1/staff/claim', '/v1/staff/release', ORDER_PATH,
  ...ORDER_KEY_ROUTES, ...HIDDEN_ROUTES, ...FOLLOW_ROUTES,
]);

/** A value as JSON with every object's keys in order, so signer and service hash the same bytes. @param {any} v @returns {string} */
export const canonicalJson = (value) =>
  Array.isArray(value) ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object' ? `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
      : JSON.stringify(value) ?? 'null';

/** What an order signs. @param {string} handleLower @param {number} second @param {string} path @param {any} body @param {SubtleCrypto} subtle */
export async function orderWords(handleLower, second, path, body, subtle) {
  const hash = await subtle.digest('SHA-256', new TextEncoder().encode(`${path}\n${canonicalJson(body)}`));
  return `dfo-staff:v1:order:${handleLower}:${second}:${[...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const lcOf = (/** @type {unknown} */ handle) => (typeof handle === 'string' ? handle.trim().toLowerCase().slice(0, 64) : '');
const b64 = (/** @type {unknown} */ text) => {
  if (typeof text !== 'string' || !/^[\w-]+$/.test(text)) return null;
  try { return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)); } catch { return null; }
};
const onList = (/** @type {any} */ env, /** @type {any} */ player) => typeof player?.handle === 'string' && handleList(env?.CLAUDE_ORDER_HANDLES).has(player.handle.toLowerCase());

/**
 * POST /v1/staff/order { handle, ts, path, body, sig } - the door's answer, or `{ error }`. A refusal is the one word
 * `staff-login`; one written down is a valid signature from a member who may no longer order.
 * @param {any} ctx @param {any} env @param {any} body @param {string} ip @param {(who: any, path: string, body: any) => Promise<any>} dispatch
 */
export async function staffOrder(ctx, env, body, address, dispatch) {
  const { db, subtle, nowS } = ctx;
  const handleLower = lcOf(body.handle);
  if (typeof body.path !== 'string' || !Number.isSafeInteger(body.ts) || typeof body.sig !== 'string' || (body.body !== undefined && (typeof body.body !== 'object' || body.body === null || Array.isArray(body.body)))) return { error: 'body' };
  if (await overRate(ctx, `staffip:${address}`, STAFF_IP_MAX, STAFF_TRY_WINDOW_S)) return { error: 'rate' };
  if (handleLower && (await overRate(ctx, `stafftry:${handleLower}:${address}`, STAFF_TRY_MAX, STAFF_TRY_WINDOW_S))) return { error: 'rate' };
  const player = handleLower ? await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(handleLower).first() : null;
  const role = player ? staffRole(player, env) : null;
  const keys = player ? (await db.prepare('SELECT * FROM staff_order_keys WHERE player_id = ? AND handle_lc = ? AND revoked_at IS NULL').bind(player.id, handleLower).all())?.results ?? [] : [];
  const sig = b64(body.sig);
  let key = null;
  if (sig && keys.length && Math.abs(nowS - body.ts) <= STAFF_SIG_S) {
    const words = new TextEncoder().encode(await orderWords(handleLower, body.ts, body.path, body.body ?? {}, subtle));
    for (const k of keys) {
      try {
        const pub = await subtle.importKey('raw', /** @type {Uint8Array} */ (b64(k.pub)), { name: 'Ed25519' }, false, ['verify']);
        if (await subtle.verify({ name: 'Ed25519' }, pub, sig, words)) { key = k; break; }
      } catch { /* a key that will not import verifies nothing */ }
    }
  }
  if (!key) return refused(ctx, player, role, null);
  // a valid signature: from here a refusal is written down
  if (!role || !onList(env, player) || isBanned(player, nowS)) return refused(ctx, player, role, 'order-role');
  if (FORBIDDEN.has(body.path) || !STAFF_ROUTES.has(body.path)) return refused(ctx, player, role, 'order-path');
  // the second taken in the statement that checks it is newer - a signature replayed, or two racing, one gets in
  const took = await db.prepare('UPDATE staff_order_keys SET last_ts = ?, last_used = ? WHERE id = ? AND last_ts < ? AND revoked_at IS NULL').bind(body.ts, nowS, key.id, body.ts).run();
  if (!took.meta.changes) return refused(ctx, player, role, 'replayed');
  await clearRate(ctx, `stafftry:${handleLower}:${address}`);
  await auditStatement(db, nowS, { actor: player, role, act: 'order', target: body.path.slice(0, 64), detail: { via: ORDER_VIA }, keyId: key.id }).run();
  // owner doors (Team, cutting a member off, the audit log, invites) stay with a live panel session: an order is never an owner
  const who = { player, role, owner: false, hash: null, keyId: key.id, idleAt: nowS, expiresAt: nowS, via: ORDER_VIA };
  return dispatch(who, body.path, body.body ?? {});
}

/**
 * THE KEYS' OWN DOORS, behind a live panel session: /v1/staff/order-key/add { publicKey, label } (a member on
 * CLAUDE_ORDER_HANDLES, two live at most), /list (their own; an owner may name { handle }), /revoke { id } (their own; an
 * owner may revoke any). A key is revoked, never deleted.
 * @param {any} ctx @param {any} env @param {string} path @param {any} body @param {{ player: any, role: string, owner: boolean, keyId: string }} who
 */
export async function staffOrderKeys(ctx, env, path, body, who) {
  const { db, rand, subtle, nowS } = ctx;
  const me = who.player;
  const audit = (/** @type {string} */ act, /** @type {string|null} */ target, /** @type {object|null} */ detail, /** @type {any} */ how = {}) =>
    auditStatement(db, nowS, { actor: me, role: who.role, act, target, detail, keyId: who.keyId, ...how });
  if (path === '/v1/staff/order-key/list') {
    let owner = me;
    if (typeof body.handle === 'string' && lcOf(body.handle) !== String(me.handle).toLowerCase()) {
      if (!who.owner) { await audit('refused', null, { path, need: 'owner' }, { outcome: 'denied' }).run(); return { error: 'staff-owner' }; }
      owner = await db.prepare('SELECT * FROM players WHERE handle_lc = ?').bind(lcOf(body.handle)).first();
      if (!owner) return { error: 'no-player' };
    }
    const [page] = await db.batch([
      db.prepare('SELECT id, label, created_at, last_used, revoked_at FROM staff_order_keys WHERE player_id = ? ORDER BY created_at DESC LIMIT 20').bind(owner.id),
      audit('order-key-read', owner.id, null, { onceIn: 600 }),
    ]);
    return { keys: (page.results ?? []).map((/** @type {any} */ k) => ({ id: k.id, label: k.label, createdAt: k.created_at, lastUsed: k.last_used, revokedAt: k.revoked_at })) };
  }
  if (path === '/v1/staff/order-key/revoke') {
    if (typeof body.id !== 'string' || body.id.length > 64) return { error: 'body' };
    const [, gone] = await db.batch([
      audit('order-key-revoke', null, { id: body.id }, { okIf: { sql: 'EXISTS (SELECT 1 FROM staff_order_keys WHERE id = ? AND revoked_at IS NULL AND (player_id = ? OR ? = 1))', args: [body.id, me.id, who.owner ? 1 : 0] } }),
      db.prepare('UPDATE staff_order_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL AND (player_id = ? OR ? = 1)').bind(nowS, body.id, me.id, who.owner ? 1 : 0),
    ]);
    return gone.meta.changes ? { ok: true, id: body.id } : { error: 'no-key' };
  }
  // /v1/staff/order-key/add
  if (!onList(env, me)) { await audit('refused', null, { path, need: 'claude-order' }, { outcome: 'denied' }).run(); return { error: 'staff-admin' }; }
  const raw = b64(body.publicKey);
  const label = typeof body.label === 'string' ? body.label.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX) : '';
  if (!raw || raw.length !== 32 || !label) return { error: 'order-key-bad' };
  try { await subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']); } catch { return { error: 'order-key-bad' }; }
  const handleLower = String(me.handle).toLowerCase();
  // the cap is counted inside the statement that writes, so two enrolments racing for the last place land one
  const [, made] = await db.batch([
    audit('order-key-add', null, { label }, { okIf: { sql: '(SELECT COUNT(*) FROM staff_order_keys WHERE player_id = ? AND revoked_at IS NULL) < ? AND NOT EXISTS (SELECT 1 FROM staff_order_keys WHERE pub = ?)', args: [me.id, ORDER_KEYS_MAX, body.publicKey] } }),
    db.prepare(`INSERT INTO staff_order_keys (id, player_id, handle_lc, pub, label, created_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE (SELECT COUNT(*) FROM staff_order_keys WHERE player_id = ?2 AND revoked_at IS NULL) < ?7
      ON CONFLICT (pub) DO NOTHING`).bind(mintId(rand), me.id, handleLower, body.publicKey, label, nowS, ORDER_KEYS_MAX),
  ]);
  if (made.meta.changes) return { ok: true };
  const taken = await db.prepare('SELECT 1 AS y FROM staff_order_keys WHERE pub = ?').bind(body.publicKey).first();
  return { error: taken ? 'order-key-bad' : 'order-keys-full' };
}
