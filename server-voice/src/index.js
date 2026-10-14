// @ts-check
// The third Worker (beside server/ and server-account/) - the only one holding the media server's API secret.
//
//   POST /v1/voice/token  -> { ok, v, url, token, identity, room, ttl }
//   POST /v1/voice/place  -> { ok, v, allow: [...] }
//   GET  /health          -> { ok, service, version }
//
// `handle` runs anywhere a Request does, so node.js can serve the same function for the self-hosted compose stack.
// No Durable Object: the proximity policy is per isolate and a multi-isolate deploy would fail closed, not open.
//   env.IDENTITY_PUBLIC_KEY   base64url raw Ed25519, the account service's /v1/pubkey
//   env.LIVEKIT_URL           the wss:// (ws:// on localhost) the CLIENT opens
//   env.LIVEKIT_API_KEY / env.LIVEKIT_API_SECRET   the pair in livekit.yaml `keys:`
//   env.LIVEKIT_ADMIN_URL     (optional) the http(s) RoomService door, for server-side unsubscribes
//   env.RELAY_URL             (optional) the relay's https door for the party's word; absent, party voice is refused
//   env.CORS_ORIGIN           (optional) the one origin answered, default *

import { importPublicKeyB64 } from '../../src/net/identityToken.js';
import { validTokenAsk, validPlaceAsk, VOICE_V, VOICE_MINT_PER_MIN, VOICE_PLACE_HZ_MAX, voiceUrlOk } from '../../src/voice/voiceWire.js';
import { authorizeVoice } from './roomAuthorizer.js';
import { ProximityPolicy, VOICE_ROOM_IDLE_MS } from './proximityPolicy.js';
import { mintLiveKitToken, mintLiveKitAdminToken } from './livekitToken.js';

/** The service's own version, said on /health - bumped when a shape here changes. */
export const VOICE_SERVICE_VERSION = 1;

const json = (body, status = 200, origin = '*') => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin, 'cache-control': 'no-store' },
});

/** The per-isolate state: the policy, the imported key, the rate buckets. `_resetForTests` empties it. */
let _state = null;
const stateOf = (now) => (_state ??= { policy: new ProximityPolicy({ now }), key: undefined, mints: new Map(), places: new Map(), lastSweptAt: -Infinity });
export function _resetForTests() { _state = null; }
/** A test's read of the live per-isolate policy, to tell "swept away" from "merely stale" - never called in production. */
export function _peekPolicyForTests() { return _state?.policy ?? null; }

/** A token bucket per identity: `max` in `windowMs`. True when admitted. */
function admit(map, who, max, windowMs, now) {
  const b = map.get(who);
  if (!b || now - b.since >= windowMs) { map.set(who, { since: now, n: 1 }); return true; }
  if (b.n >= max) return false;
  b.n++; return true;
}

/** `partyOf(acct)` - the relay's hub if RELAY_URL is set; otherwise party voice refuses rather than guessing. */
async function partyOfVia(env, fetchImpl) {
  return async (/** @type {string} */ acct) => {
    if (typeof env.partyOf === 'function') return env.partyOf(acct);   // a test's, or node.js's stub
    if (!env.RELAY_URL) return null;
    try {
      const res = await fetchImpl(`${String(env.RELAY_URL).replace(/\/+$/, '')}/party/${encodeURIComponent(acct)}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      const a = await res.json();
      return typeof a?.party === 'string' ? a.party : null;
    } catch { return null; }
  };
}

/** Ensures the SFU room exists before a token is handed out - `auto_create: false` rejects a join otherwise. */
async function ensureRoom(env, fetchImpl, room) {
  if (!env.LIVEKIT_ADMIN_URL) return;
  try {
    const bearer = await mintLiveKitAdminToken({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, room, nowS: Math.floor(Date.now() / 1000) }, crypto.subtle);
    const base = String(env.LIVEKIT_ADMIN_URL).replace(/\/+$/, '');
    await fetchImpl(`${base}/twirp/livekit.RoomService/CreateRoom`, { method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: room, empty_timeout: 300, max_participants: 16 }), signal: AbortSignal.timeout(2000) });
  } catch (e) { console.warn('[voice] sfu create room', e?.message ?? e); }
}

/** Tells the SFU a listener no longer may hear a publisher - best effort; the publisher's own permission list is law. */
async function unsubscribeOnSfu(env, fetchImpl, room, listener, publishers, nowS) {
  if (!env.LIVEKIT_ADMIN_URL || !publishers.length) return;
  try {
    const bearer = await mintLiveKitAdminToken({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, room, nowS }, crypto.subtle);
    const base = String(env.LIVEKIT_ADMIN_URL).replace(/\/+$/, '');
    const hdr = { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' };
    const sids = [];
    for (const identity of publishers) {
      const res = await fetchImpl(`${base}/twirp/livekit.RoomService/GetParticipant`, { method: 'POST', headers: hdr, body: JSON.stringify({ room, identity }), signal: AbortSignal.timeout(2000) });
      if (!res.ok) continue;
      const p = await res.json();
      for (const t of p?.tracks ?? []) if (t?.sid) sids.push(t.sid);
    }
    if (sids.length) await fetchImpl(`${base}/twirp/livekit.RoomService/UpdateSubscriptions`, { method: 'POST', headers: hdr, body: JSON.stringify({ room, identity: listener, track_sids: sids, subscribe: false }), signal: AbortSignal.timeout(2000) });
  } catch (e) { console.warn('[voice] sfu unsubscribe', e?.message ?? e); }
}

/**
 * @param {Request} request
 * @param {any} env
 * @param {{ now?: () => number, fetch?: typeof fetch, subtle?: SubtleCrypto }} [io]
 */
export async function handle(request, env, { now = () => Date.now(), fetch: fetchImpl = globalThis.fetch, subtle = crypto.subtle } = {}) {
  const origin = env.CORS_ORIGIN || '*';
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
  if (url.pathname === '/health') return json({ ok: true, service: 'daggerfall-voice', version: VOICE_SERVICE_VERSION, v: VOICE_V, t: now() }, 200, origin);
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, origin);
  const st = stateOf(now);
  if (st.key === undefined) st.key = env.IDENTITY_PUBLIC_KEY ? await importPublicKeyB64(String(env.IDENTITY_PUBLIC_KEY), { subtle }).catch(() => null) : null;
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'json' }, 400, origin); }
  const nowS = Math.floor(now() / 1000);
  const partyOf = await partyOfVia(env, fetchImpl);

  if (url.pathname === '/v1/voice/token') {
    const ask = validTokenAsk(body);
    if (!ask) return json({ ok: false, error: 'shape' }, 400, origin);
    if (!voiceUrlOk(env.LIVEKIT_URL) || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return json({ ok: false, error: 'no-media-server' }, 503, origin);
    const a = await authorizeVoice(ask, { publicKey: st.key, subtle, nowS, partyOf });
    if (!a.ok) return json({ ok: false, error: a.why }, a.status, origin);
    if (!admit(st.mints, a.identity, VOICE_MINT_PER_MIN, 60_000, now())) return json({ ok: false, error: 'rate' }, 429, origin);
    await ensureRoom(env, fetchImpl, a.room);
    const token = await mintLiveKitToken({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, identity: a.identity, name: a.name, room: a.room, ttlS: a.ttl, nowS, canPublish: a.canPublish }, subtle);
    return json({ ok: true, v: VOICE_V, url: env.LIVEKIT_URL, token, identity: a.identity, room: a.room, ttl: a.ttl, canPublish: a.canPublish }, 200, origin);
  }

  if (url.pathname === '/v1/voice/place') {
    const ask = validPlaceAsk(body);
    if (!ask) return json({ ok: false, error: 'shape' }, 400, origin);
    const a = await authorizeVoice({ token: ask.token, channel: 'proximity', room: ask.room, party: null }, { publicKey: st.key, subtle, nowS, partyOf });
    if (!a.ok) return json({ ok: false, error: a.why }, a.status, origin);
    if (!admit(st.places, a.identity, VOICE_PLACE_HZ_MAX, 1000, now())) return json({ ok: false, error: 'rate' }, 429, origin);
    const before = st.policy.allowFor(a.room, a.identity);
    st.policy.place(a.room, a.identity, ask.near);
    const allow = st.policy.allowFor(a.room, a.identity);
    // tell the SFU about publishers this listener stopped naming - a second hand, since it may miss the handoff
    const lost = before.filter((id) => !ask.near.includes(id));
    if (lost.length) await unsubscribeOnSfu(env, fetchImpl, a.room, a.identity, lost, nowS);
    // opportunistic GC: a per-isolate policy never shrinks on its own, so a place frame also pays the sweep's rent
    if (now() - st.lastSweptAt >= VOICE_ROOM_IDLE_MS) { st.lastSweptAt = now(); st.policy.sweep(); }
    return json({ ok: true, v: VOICE_V, allow }, 200, origin);
  }

  return json({ ok: false, error: 'no such door' }, 404, origin);
}

export default { fetch: (/** @type {Request} */ request, /** @type {any} */ env) => handle(request, env) };
