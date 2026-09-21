// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1b — THE ACCOUNT SERVICE: a second Cloudflare Worker, over D1.
//
// Mac (2026-09-21): "cloud storage and account creation needed for
// accessing online mode" / "Im not rotating. Lets do this".
//
// ═══ WHY THIS IS NOT A ROUTE ON THE RELAY ══════════════════════════
//
// A relay deploy restarts every Durable Object and DROPS EVERY
// CONNECTED PLAYER. That is a fair price for changing the relay's own
// law and an absurd one for fixing the wording on a sign-in button -
// and it is not hypothetical: SLAM8 hashes the RAW BYTES of every file
// the relay bundles, comments included, so a one-line comment fix in
// `src/net/wire.js` was abandoned on 2026-09-21 rather than drop a
// room full of people (DEPLOY-PROSE). Accounts in that bundle would
// mean every auth tweak drops everyone mid-dungeon.
//
// So: two Workers, and the seam between them is a SIGNATURE. This
// service holds the private key; the relay holds the public half and
// can verify but never mint. Nothing here reaches the relay and nothing
// there reaches D1.
//
// ═══ THE WALL (ACC0) ═══════════════════════════════════════════════
//
// A GUEST GETS A TOKEN, exactly as a linked account does, and may
// connect, be seen, walk and chat. What a guest does not get is CLOUD
// SAVES - and that wall lives where the saves are (ACC2), not here.
// This service's job is to say who somebody is, not to decide what they
// may do.
//
//   GET  /v1/health                       -> { ok, v }
//   POST /v1/auth/guest   { label? }      -> { playerId, secret, sessionId, name, kind }
//   POST /v1/auth/token   { secret }      -> { token, name, kind, expiresAt }
//   POST /v1/auth/session { secret, label? } -> { secret, sessionId }   (a second device)
//   GET  /v1/account      ?secret=        -> { account, devices[] }
//   POST /v1/auth/logout  { secret, all? }-> { revoked, scope }
//
// Bindings (wrangler.toml): env.DB (D1), env.ALLOWED_ORIGIN,
// env.IDENTITY_PRIVATE_KEY (base64 PKCS8 Ed25519 - a SECRET, set with
// `wrangler secret put`, never in the toml), env.ACCOUNT_VERSION.
//
// THE SECRET IS A BEARER CREDENTIAL and it is carried in the BODY, not
// the query string, on everything that mutates - a query string lands
// in logs and in a referrer. `/v1/account` takes one for convenience on
// a GET and is the one place that is true; it is read-only, and a slice
// that makes it do more must move it.
// ═══════════════════════════════════════════════════════════════════

import {
  createGuest, openSession, resolveSession, closeSession, closeAllSessions,
  devicesOf, accountView, displayName, accountKind,
} from './accounts.js';
import { mintToken, MAX_TTL_S } from '../../src/net/identityToken.js';

/** Bumped with every change to this Worker's law, and answered by
 *  /health - the same discipline RELAY_VERSION keeps, for the same
 *  reason: a deploy that did not happen looks exactly like one that
 *  did. */
export const ACCOUNT_VERSION = 'acct1';

/** A body bigger than this is not a request this service has. Read
 *  BEFORE the JSON is parsed, so a megabyte of nothing costs nothing. */
export const MAX_BODY_BYTES = 4 * 1024;

/** Every path this service serves. Named once, so the 404 below and
 *  the ladder further down cannot come to disagree about what exists. */
export const ROUTES = new Set([
  '/v1/health', '/v1/auth/guest', '/v1/auth/token', '/v1/auth/session',
  '/v1/account', '/v1/auth/logout',
]);

const json = (body, status = 200, origin = '*') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'cache-control': 'no-store',
  },
});

/** Every refusal is one word and the same shape. A client learns that
 *  it failed and not why somebody else's secret is wrong. */
const no = (why, status, origin) => json({ error: why }, status, origin);

async function readBody(request) {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  if (!text) return {};
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

/** The Ed25519 private key, imported once per isolate. A key imported
 *  per request costs a parse on the hot path for nothing. */
let _key = null;
async function signingKey(env, subtle) {
  if (_key) return _key;
  const b64 = String(env.IDENTITY_PRIVATE_KEY ?? '');
  if (!b64) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    _key = await subtle.importKey('pkcs8', bytes, { name: 'Ed25519' }, false, ['sign']);
    return _key;
  } catch { return null; }
}
export function _resetKeyForTests() { _key = null; }

export default {
  async fetch(request, env) {
    const subtle = crypto.subtle;
    const rand = (b) => crypto.getRandomValues(b);
    const nowS = Math.floor(Date.now() / 1000);
    const origin = env.ALLOWED_ORIGIN || '*';
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      });
    }

    if (path === '/v1/health') return json({ ok: true, v: env.ACCOUNT_VERSION || ACCOUNT_VERSION }, 200, origin);

    // A PATH NOBODY SERVES IS A 404, and it is answered HERE - before
    // the credential is looked at. The first cut checked auth first,
    // which made every unknown path answer 401 to a caller with no
    // secret: technically a shade harder to enumerate, and in practice
    // a lie that costs an afternoon the first time somebody typos a
    // route. The paths this service serves are in this file and in the
    // repo; they are not the secret.
    if (!ROUTES.has(path)) return no('not-found', 404, origin);

    const db = env.DB;
    if (!db) return no('no-database', 503, origin);
    const ctx = { db, subtle, rand, nowS };

    try {
      if (path === '/v1/auth/guest' && request.method === 'POST') {
        const body = await readBody(request);
        if (!body) return no('body', 400, origin);
        const made = await createGuest(ctx, { deviceLabel: body.label ?? null });
        return json(made, 200, origin);
      }

      // EVERY ROUTE BELOW NEEDS A SECRET, and resolving it is the same
      // one indexed lookup every time.
      const body = request.method === 'POST' ? await readBody(request) : {};
      if (!body) return no('body', 400, origin);
      const secret = request.method === 'POST' ? body.secret : url.searchParams.get('secret');
      const who = await resolveSession(ctx, secret);
      if (!who) return no('auth', 401, origin);

      if (path === '/v1/auth/token' && request.method === 'POST') {
        const key = await signingKey(env, subtle);
        // A service with no key can still hand out accounts; it just
        // cannot vouch for them. Said plainly rather than by minting
        // something the relay will refuse.
        if (!key) return no('no-signing-key', 503, origin);
        const token = await mintToken(
          { s: who.player.id, n: displayName(who.player), k: accountKind(who.player) },
          key, { subtle, nowS },
        );
        return json({ token, name: displayName(who.player), kind: accountKind(who.player), expiresAt: nowS + MAX_TTL_S }, 200, origin);
      }

      if (path === '/v1/auth/session' && request.method === 'POST') {
        // A SECOND DEVICE, admitted by a device that is already in.
        // This is the whole of "two devices at once" and it is why a
        // session is the credential rather than the player.
        const made = await openSession(ctx, who.player.id, body.label ?? null);
        return json(made, 200, origin);
      }

      if (path === '/v1/account' && request.method === 'GET') {
        return json({
          account: accountView(who.player, nowS),
          devices: await devicesOf(ctx, who.player.id),
        }, 200, origin);
      }

      if (path === '/v1/auth/logout' && request.method === 'POST') {
        // THIS DEVICE by default. Signing out of a laptop has never
        // dropped somebody's phone, and "everywhere" is a separate,
        // explicit act rather than a surprise.
        const r = body.all === true
          ? await closeAllSessions(ctx, who.player.id)
          : await closeSession(ctx, who.session.id);
        return json({ ...r, scope: body.all === true ? 'all' : 'this' }, 200, origin);
      }

      // a path this service serves, reached with a method it does not
      return no('method', 405, origin);
    } catch (e) {
      // AUDIT ONLINE A17's law, on this side too: an uncaught error is
      // LOGGED, not lost, and a player is told nothing about it.
      console.error('[account]', path, e?.stack ?? String(e));
      return no('server', 500, origin);
    }
  },
};
