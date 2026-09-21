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
//   GET  /v1/pubkey                       -> { alg, key }   (not a secret)
//   POST /v1/auth/guest   { label? }      -> { id, secret, sessionId, name, kind }
//   POST /v1/auth/token   { secret }      -> { token, name, kind, expiresAt }
//   POST /v1/auth/session { secret, label? } -> { secret, sessionId }   (a second device)
//   GET  /v1/account      ?secret=        -> { account, devices[] }
//   POST /v1/auth/logout  { secret, all? }-> { revoked, scope }
//
// Bindings (wrangler.toml): env.DB (D1), env.ALLOWED_ORIGIN,
// env.ACCOUNT_VERSION, and the signing pair, which the deploy mints
// ONCE and puts in with `wrangler secret put` - never into the toml,
// which is committed:
//
//   env.IDENTITY_PRIVATE_KEY  base64 PKCS8 Ed25519. A SECRET. It is
//                             what makes a token believable and it is
//                             never read back out of Cloudflare.
//   env.IDENTITY_PUBLIC_KEY   base64url raw. NOT a secret - /v1/pubkey
//                             hands it to anybody who asks. It lives
//                             beside the private half because the pair
//                             is minted where no person is watching,
//                             and a verifying key nobody can read again
//                             would have to be re-minted, which
//                             invalidates every token already issued.
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
  register, login, recover, changePassword, setEmail, overRate,
} from './accounts.js';
import { mintToken, MAX_TTL_S, TOKEN_V } from '../../src/net/identityToken.js';
import { ACCOUNT_VERSION, MAX_BODY_BYTES, ROUTES, OPEN_ROUTES } from './service.js';
import { signingKey } from './signing.js';

// THIS MODULE EXPORTS `default` AND NOTHING ELSE, and that is a
// runtime requirement rather than a preference: in a module Worker
// every named export of the entrypoint is read as an entrypoint, and
// a plain constant is not one - workerd refuses to start. AUDIT-ACC
// F2 found it by booting the Worker; no node test could, because the
// tests imported the very names that were breaking it. What this
// service IS lives in service.js; what it signs with lives in
// signing.js; both are imported here and by the pins.

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

    // ACC1-CI: THE SERVICE PUBLISHES ITS OWN PUBLIC KEY, and that is the
    // whole point of it being public. The pair is minted by the deploy
    // and neither half is ever typed by a person, so without this the
    // public key would exist only in the run log that minted it - and a
    // verifying key nobody can read again is a verifying key that has to
    // be re-minted, which invalidates every token already issued.
    //
    // It is served openly, before any credential, because A PUBLIC KEY
    // CAN VERIFY AND CANNOT MINT. Anyone may check a token this service
    // signed; nobody may sign one.
    if (path === '/v1/pubkey') {
      const pub = String(env.IDENTITY_PUBLIC_KEY ?? '');
      return pub
        ? json({ alg: TOKEN_V, key: pub }, 200, origin)
        : no('no-signing-key', 503, origin);
    }

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
      if (OPEN_ROUTES.has(path)) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const body = await readBody(request);
        if (!body) return no('body', 400, origin);

        // ONE BUCKET PER CALLER for everything a stranger can reach, so
        // a single address cannot mint accounts or grind passwords
        // without limit. The per-HANDLE buckets inside login/recover
        // are the other half - one stops a flood, the other stops a
        // patient attacker with many addresses picking one account.
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        if (await overRate(ctx, `ip:${ip}`, 60)) return no('rate', 429, origin);

        if (path === '/v1/auth/guest') {
          const made = await createGuest(ctx, { deviceLabel: body.label ?? null });
          return json(made, 200, origin);
        }
        if (path === '/v1/auth/login') {
          const r = await login(ctx, { handle: body.handle, password: body.password, deviceLabel: body.label ?? null });
          // A REFUSAL NAMES NO CAUSE a stranger could use: `bad-login`
          // is the same word for a handle nobody holds and a password
          // that is wrong, and the two cost the same time besides.
          return r.error ? no(r.error, r.error === 'rate' ? 429 : 401, origin) : json(r, 200, origin);
        }
        // /v1/auth/recover
        const r = await recover(ctx, { handle: body.handle, code: body.code, password: body.password });
        return r.error ? no(r.error, r.error === 'rate' ? 429 : 401, origin) : json(r, 200, origin);
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

      if (path === '/v1/auth/register' && request.method === 'POST') {
        // AN UPGRADE IN PLACE of the row this session already belongs
        // to - not a new account. The recovery code in the answer is
        // THE ONLY TIME IT IS EVER READABLE.
        const r = await register(ctx, who.player.id, { handle: body.handle, password: body.password });
        return r.error ? no(r.error, 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/password' && request.method === 'POST') {
        const r = await changePassword(ctx, who.player, who.session, { oldPassword: body.oldPassword, password: body.password });
        return r.error ? no(r.error, r.error === 'bad-login' ? 401 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/email' && request.method === 'POST') {
        // COMPLETELY OPTIONAL (Mac). Nothing is gated behind it, and
        // `null` takes it off again.
        const r = await setEmail(ctx, who.player.id, body.email ?? null);
        return r.error ? no(r.error, 400, origin) : json(r, 200, origin);
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
