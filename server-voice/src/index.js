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
//   env.LIVEKIT_ADMIN_URL     the http(s) RoomService door - REQUIRED: the room made, the seats swept (revoker.js), unsubscribes
//   env.RELAY_URL             (optional) the relay's https door for the party word and room-presence check; absent, both channels refuse
//   env.VOICE_RELAY_SECRET    the shared secret RELAY_URL's relay checks on both doors above; absent on either side, the relay refuses rather than guessing
//   env.CORS_ORIGIN           (optional) the one origin answered, default *

import { importPublicKeyB64 } from '../../src/net/identityToken.js';
import { validTokenAsk, validPlaceAsk, VOICE_V, VOICE_MINT_PER_MIN, VOICE_PLACE_HZ_MAX, voiceUrlOk, VOICE_PRESENCE_PATH, VOICE_PARTY_OF_PATH, VOICE_RELAY_SECRET_HEADER } from '../../src/net/voice/voiceWire.js';
import { authorizeVoice } from './roomAuthorizer.js';
import { ProximityPolicy, VOICE_ROOM_IDLE_MS } from './proximityPolicy.js';
import { RoomSharder, shardRoomName } from './roomSharder.js';
import { mintLiveKitToken, mintLiveKitAdminToken } from './livekitToken.js';
import { sweepVoice, seatMeta } from './revoker.js';

/** The service's own version, said on /health - bumped when a shape here changes. */
export const VOICE_SERVICE_VERSION = 1;

const json = (body, status = 200, origin = '*') => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin, 'cache-control': 'no-store' },
});

/** The per-isolate state: the policy, the imported key, the rate buckets. `_resetForTests` empties it. */
let _state = null;
const stateOf = (now) => (_state ??= { policy: new ProximityPolicy({ now }), sharder: new RoomSharder({ now }), key: undefined, mints: new Map(), places: new Map(), presence: new Map(), standing: new Map(), lastSweptAt: -Infinity, sweepFrom: 0 });
export function _resetForTests() { _state = null; }
/** A test's read of the live per-isolate policy, to tell "swept away" from "merely stale" - never called in production. */
export function _peekPolicyForTests() { return _state?.policy ?? null; }
/** A test's read of the live per-isolate sharder - never called in production. */
export function _peekSharderForTests() { return _state?.sharder ?? null; }

/** How long a presence answer is trusted before asking the relay again - /place arrives up to VOICE_PLACE_HZ_MAX a
 *  second, and hitting the relay on every one would trade real latency/CCU cost for no gain. */
const PRESENCE_CACHE_MS = 5000;
const PRESENCE_CACHE_MAX = 4096;
/** A relay answer kept PRESENCE_CACHE_MS under `key` in `map` - never a null one (the relay did not answer). */
function cached(map, now, key, ask) {
  const had = map.get(key);
  if (had && now() - had.at < PRESENCE_CACHE_MS) return had.v;
  return ask().then((v) => {
    map.delete(key);
    if (v === null) return v;
    if (map.size >= PRESENCE_CACHE_MAX) map.delete(map.keys().next().value);
    map.set(key, { v, at: now() });
    return v;
  });
}
const cachedPresenceOf = (state, presenceOf, now) => async (acct, room, ly) => cached(state.presence, now, `${acct}|${room}|${ly}`, () => presenceOf(acct, room, ly));
const cachedStandingOf = (state, standingOf, now) => async (acct) => cached(state.standing, now, acct, () => standingOf(acct));

/** A token bucket per identity: `max` in `windowMs`. True when admitted. */
function admit(map, who, max, windowMs, now) {
  const b = map.get(who);
  if (!b || now - b.since >= windowMs) { map.set(who, { since: now, n: 1 }); return true; }
  if (b.n >= max) return false;
  b.n++; return true;
}

/** One of the relay's two doors, asked behind the shared secret: its answer, or null when it gave none (no relay
 *  configured, a refusal, an outage) - which every caller reads as "unknown", never as a yes. */
async function askRelay(env, fetchImpl, path, body) {
  if (!env.RELAY_URL || !env.VOICE_RELAY_SECRET) return null;
  try {
    const res = await fetchImpl(`${String(env.RELAY_URL).replace(/\/+$/, '')}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', [VOICE_RELAY_SECRET_HEADER]: env.VOICE_RELAY_SECRET }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

/** `standingOf(acct)` - the hub's word on the party `acct` sits in and the mute and the ban it is under (`{ party, mu,
 *  bn }`), or null.
 *  The old party URL here (`RELAY_URL/party/<acct>`) was never routed by the relay, so party voice checked nothing. */
async function standingVia(env, fetchImpl) {
  return async (/** @type {string} */ acct) => {
    if (typeof env.standingOf === 'function') return env.standingOf(acct);   // a test's
    if (typeof env.partyOf === 'function') return { party: (await env.partyOf(acct)) ?? null, mu: 0, bn: 0 };   // node.js's stub, a test's
    const a = await askRelay(env, fetchImpl, VOICE_PARTY_OF_PATH, { acct });
    const at = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
    return a ? { party: typeof a.party === 'string' ? a.party : null, mu: at(a.mu), bn: at(a.bn) } : null;
  };
}

/** `presenceOf(acct, room, ly)` - the relay's word on whether `acct` is hello'd into `room` (its layer `ly`) right now,
 *  instead of trusting the client's claim: true, false, or null when the relay did not answer. */
async function presenceOfVia(env, fetchImpl) {
  return async (/** @type {string} */ acct, /** @type {string} */ room, /** @type {number} */ ly) => {
    if (typeof env.presenceOf === 'function') return env.presenceOf(acct, room, ly);   // a test's, or node.js's stub
    const a = await askRelay(env, fetchImpl, VOICE_PRESENCE_PATH, { acct, room, ly });
    return a ? a.here === true : null;
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
  const standingOf = cachedStandingOf(st, await standingVia(env, fetchImpl), now);
  const presenceOf = cachedPresenceOf(st, await presenceOfVia(env, fetchImpl), now);

  if (url.pathname === '/v1/voice/token') {
    const ask = validTokenAsk(body);
    if (!ask) return json({ ok: false, error: 'shape' }, 400, origin);
    // VOICE-REVOKE: a service that cannot reach the SFU's admin door cannot take a seat back (revoker.js) - so it gives none
    if (!voiceUrlOk(env.LIVEKIT_URL) || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_ADMIN_URL) return json({ ok: false, error: 'no-media-server' }, 503, origin);
    const a = await authorizeVoice(ask, { publicKey: st.key, subtle, nowS, standingOf, presenceOf });
    if (!a.ok) return json({ ok: false, error: a.why }, a.status, origin);
    if (!admit(st.mints, a.identity, VOICE_MINT_PER_MIN, 60_000, now())) return json({ ok: false, error: 'rate' }, 429, origin);
    // party is capped at VOICE_PARTY_MAX and never overflows; only a proximity room can need a second shard
    const room = ask.channel === 'proximity' ? shardRoomName(a.room, st.sharder.assign(a.room, a.identity)) : a.room;
    await ensureRoom(env, fetchImpl, room);
    const token = await mintLiveKitToken({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, identity: a.identity, name: a.name, room, ttlS: a.ttl, nowS, canPublish: a.canPublish, metadata: seatMeta(a.seat) }, subtle);
    return json({ ok: true, v: VOICE_V, url: env.LIVEKIT_URL, token, identity: a.identity, room, ttl: a.ttl, canPublish: a.canPublish }, 200, origin);
  }

  if (url.pathname === '/v1/voice/place') {
    const ask = validPlaceAsk(body);
    if (!ask) return json({ ok: false, error: 'shape' }, 400, origin);
    const a = await authorizeVoice({ token: ask.token, channel: 'proximity', room: ask.room, ly: ask.ly, party: null }, { publicKey: st.key, subtle, nowS, presenceOf });
    if (!a.ok) return json({ ok: false, error: a.why }, a.status, origin);
    if (!admit(st.places, a.identity, VOICE_PLACE_HZ_MAX, 1000, now())) return json({ ok: false, error: 'rate' }, 429, origin);
    // the policy is keyed by the PHYSICAL (sharded) room - two shards of one base room are two separate worlds
    const room = shardRoomName(a.room, st.sharder.shardOf(a.room, a.identity) ?? st.sharder.assign(a.room, a.identity));
    const before = st.policy.allowFor(room, a.identity);
    st.policy.place(room, a.identity, ask.near);
    const allow = st.policy.allowFor(room, a.identity);
    // tell the SFU about publishers this listener stopped naming - a second hand, since it may miss the handoff
    const lost = before.filter((id) => !ask.near.includes(id));
    if (lost.length) await unsubscribeOnSfu(env, fetchImpl, room, a.identity, lost, nowS);
    // opportunistic GC: a per-isolate policy never shrinks on its own, so a place frame also pays the sweep's rent
    if (now() - st.lastSweptAt >= VOICE_ROOM_IDLE_MS) { st.lastSweptAt = now(); st.policy.sweep(); st.sharder.sweep(); }
    return json({ ok: true, v: VOICE_V, allow }, 200, origin);
  }

  return json({ ok: false, error: 'no such door' }, 404, origin);
}

/**
 * VOICE-REVOKE: one sweep of the SFU's seats (revoker.js), over this isolate's caches of the relay's answers - the
 * Worker's cron runs it each minute, the node service every VOICE_SWEEP_MS.
 * @param {any} env
 * @param {{ now?: () => number, fetch?: typeof fetch, subtle?: SubtleCrypto }} [io]
 */
export async function sweep(env, { now = () => Date.now(), fetch: fetchImpl = globalThis.fetch, subtle = crypto.subtle } = {}) {
  const st = stateOf(now);
  const standingOf = cachedStandingOf(st, await standingVia(env, fetchImpl), now);
  const presenceOf = cachedPresenceOf(st, await presenceOfVia(env, fetchImpl), now);
  const out = await sweepVoice({ env, fetchImpl, subtle, nowS: Math.floor(now() / 1000), start: st.sweepFrom, presenceOf, standingOf });
  st.sweepFrom = out.next;
  return out;
}

export default {
  fetch: (/** @type {Request} */ request, /** @type {any} */ env) => handle(request, env),
  scheduled: (/** @type {any} */ _event, /** @type {any} */ env, /** @type {any} */ ctx) => ctx.waitUntil(sweep(env).catch((e) => console.warn('[voice] sweep', e?.message ?? e))),
};
