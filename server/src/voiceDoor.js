// @ts-check
// VOICE-RELAY-DOOR (bible/11-Multiplayer/Voice-Arc.md, the relay's doors): THE VOICE SERVICE'S TWO QUESTIONS OF THE
// RELAY. server-voice/ mints a proximity or party voice credential only on the relay's word - is this verified account
// hello'd into the room (and the layer of it) it claims, and which party is it in and under what mute - never on the
// client's, and its sweep takes a seat back on the same word (VOICE-REVOKE, server-voice/src/revoker.js). Both doors
// are the public Worker's (another deployed Worker calls them over the internet), so each is gated by the Worker SECRET
// VOICE_RELAY_SECRET, checked constant-time: unset, missing or wrong all refuse alike. Here, not in index.js, as
// staffTeleport.js and relayScale.js are: the host does not grow (bible/01-Overview/Host-Split.md), and the room's own
// halves are Room methods of their own (`_voicePresenceInternal`, `_voicePartyOfInternal`).
import { SOCIAL_ROOM, isLayered, layerName } from '../../src/net/wire.js';
import { voiceRoomKeyOk, voiceLayerOf, VOICE_PRESENCE_PATH, VOICE_PARTY_OF_PATH, VOICE_PRESENCE_INTERNAL, VOICE_PARTY_OF_INTERNAL, VOICE_RELAY_SECRET_HEADER } from '../../src/net/voice/voiceWire.js';
import { ROOM_CALL_MS } from './relayScale.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

/** Is `pathname` one of the voice service's doors? */
export const isVoiceDoor = (pathname) => pathname === VOICE_PRESENCE_PATH || pathname === VOICE_PARTY_OF_PATH;

/** CONSTANT-TIME STRING EQUALITY, its own rather than server-account's password.js timingSafeEqual: that is another
 *  Worker's bundle, and the relay's law is the bytes of this one's (test/net/relayversion.test.js). */
export function ctEqualStrings(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** The object a presence ask reads - the place's own, or the layer of a crowded place the asker stands in (net/wire.js
 *  SCALE5d: `key#n`, the Worker's walk). A gate's court answers for its copies itself (it holds their sockets), so a
 *  layer is asked only of a room that layers; any other layer is no object at all. */
export const voicePresenceObject = (room, ly) => (ly === 0 ? room : isLayered(room) ? layerName(room, ly) : null);

/** One room's answer, or null when it gave none - a room reset or slow is never an exception out of the Worker
 *  (DO-ASK's law, relayScale.js askRoom), and never a "no" either: the door says `unavailable` (503), which the voice
 *  service's mint refuses on and its sweep leaves be, rather than read as "not here" and drop every call at once. */
async function askOf(env, name, path, body) {
  try {
    const res = await env.ROOMS.get(env.ROOMS.idFromName(name)).fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.warn('[voice] a room did not answer', name, /** @type {any} */ (e)?.message ?? e);
    return null;
  }
}
const answer = (a) => (a ? json(a) : json({ error: 'unavailable' }, 503));

/** The doors: the secret first, then the ask's shape, then the room's own word. */
export async function routeVoiceDoor(request, env, pathname) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const want = env.VOICE_RELAY_SECRET;
  const got = request.headers.get(VOICE_RELAY_SECRET_HEADER);
  if (!want || !got || !ctEqualStrings(String(want), String(got))) return json({ error: 'no door' }, 403);
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  const acct = typeof body?.acct === 'string' ? body.acct : null;
  if (!acct || acct.length > 128) return json({ error: 'bad ask' }, 400);
  // party-of: only the hub's bus keeps the parties (net/hubShards.js - its shards hold sockets, never records) and
  // hears every mute order (each shard's player a virtual socket on it), so it answers both
  if (pathname === VOICE_PARTY_OF_PATH) return answer(await askOf(env, SOCIAL_ROOM, VOICE_PARTY_OF_INTERNAL, { acct }));
  // presence: the room the client NAMED in its voice ask - the exact claim the voice service must not just trust -
  // in the relay's own key shape, and the layer of it the client's welcome said
  const room = voiceRoomKeyOk(body?.room) ? body.room : null;
  const ly = voiceLayerOf(body?.ly);
  const name = room && ly !== null ? voicePresenceObject(room, ly) : null;
  if (!name) return json({ error: 'bad ask' }, 400);
  return answer(await askOf(env, name, VOICE_PRESENCE_INTERNAL, { acct }));
}
