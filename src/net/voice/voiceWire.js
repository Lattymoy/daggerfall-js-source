// @ts-check
// The wire shapes both the game and server-voice/ import, so one file is the single source of truth for them.
//
//   POST /v1/voice/token   { token, room, ly?, channel, party? }   ->  { ok, url, token, identity, room, ttl }
//   POST /v1/voice/place   { token, room, ly?, near: [id...] }     ->  { ok }
//   GET  /health                                              ->  { ok, service, version }
//
// SFU room names are derived here alone so a forged `room` can never land a client in another game's session.

import { roomOf, LAYERS_MAX } from '../wire.js';   // the relay's own key and layer law - the voice service bundles wire.js already (identityToken.js imports it)

/** The voice service's protocol version, said in every answer; a client that reads another refuses it in words. */
export const VOICE_V = 1;
/** The channels. */
export const VOICE_CHANNELS = Object.freeze(['proximity', 'party']);
/** A LiveKit token's life (seconds) - short on purpose; the service re-mints on every (re)connect. */
export const VOICE_TOKEN_TTL_S = 120;
/** A client re-mints this far before the token's end (seconds). */
export const VOICE_REMINT_AHEAD_S = 30;
/** The most members a party voice room seats - the relay's PARTY_MAX (8). */
export const VOICE_PARTY_MAX = 8;
/** The most participants a proximity room seats - the design's eight players plus the ones passing through a town. */
export const VOICE_ROOM_MAX = 16;
/** A game room key as the service admits it: a `kind:` key the relay itself routes (net/wire.js roomOf) - online.js
 *  roomKeyFor mints `world:<x>,<y>`, `dungeon:m<id>...`, `interior:m<id>.<key>...`, `town:...`; the relay's presence
 *  door is what says the asker stands in it. */
export const voiceRoomKeyOk = (key) => typeof key === 'string' && /^[a-z]+:/.test(key) && roomOf(`/room/${key}`) === key;
/** The layer a proximity ask names (net/wire.js SCALE5d: a crowded place's copies, `key#n`) - 0, the place itself, when
 *  it names none; null for anything but an integer under LAYERS_MAX. A layer is its own crowd, so its own voice room. */
export const voiceLayerOf = (v) => (v === undefined ? 0 : Number.isInteger(v) && v >= 0 && v < LAYERS_MAX ? v : null);
/** A party id's shape (wire.js mintPartyId: 'q' + base36 time + 8 base36). */
export const VOICE_PARTY_RE = /^q[0-9a-z]{6,20}$/;
/** A peer id's shape, the relay's (identityToken.js ID_RE). */
export const VOICE_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
/** The most ids one place frame names - the subscription bound (voiceProximity.js VOICE_SUBS_MAX) with room to spare. */
export const VOICE_PLACE_MAX = 16;
/** The largest a request body may be before it is even read - a legitimate body is a token plus a few ids, well under
 *  1KB; this just has to clear that with room to spare, not accommodate anything the shape checks would ever allow. */
export const VOICE_BODY_MAX_BYTES = 8192;
/** The service's own rate: how many token mints one identity may ask a minute. */
export const VOICE_MINT_PER_MIN = 12;
/** ...and how many place frames a second. */
export const VOICE_PLACE_HZ_MAX = 4;

/** The relay's doors for server-voice's cross-checks: is this identity hello'd into this room (proximity), and what party is it in (replacing a party door that was called but never actually routed); secret-gated since a different deployed Worker calls these over the public internet. */
export const VOICE_PRESENCE_PATH = '/internal/voice/presence';
export const VOICE_PARTY_OF_PATH = '/internal/voice/party-of';
/** The room objects' own side of each door above - reached by the public Worker alone, never by a browser. */
export const VOICE_PRESENCE_INTERNAL = '/internal/voice/presence/of';
export const VOICE_PARTY_OF_INTERNAL = '/internal/voice/party-of/of';
/** The header both ends check VOICE_RELAY_SECRET against. Lower-case: Workers lower-case incoming header names. */
export const VOICE_RELAY_SECRET_HEADER = 'x-voice-relay-secret';

/** THE SFU ROOM'S NAME, from the channel and the game's key (and, for proximity, its layer) - one law, both ends.
 *  A proximity room is named by a digest, never a spelling of the key: the relay routes keys a sanitized spelling
 *  could not tell apart (`dungeon:m1.i<owner>.<epoch>`, an instance only its party may enter, and the ungated
 *  `dungeon:m1,i<owner>,<epoch>` beside it), and a layer or shard suffix could be spelled inside a key - two rooms of
 *  the game must never be one room of the SFU. SHA-256 over `proximity|key|ly` (`|` is no character a key has),
 *  128 bits of it in hex, so the shard's `_s<n>` after it stays unambiguous. A party id is one shape already. */
export async function voiceRoomName(channel, key, ly = 0, subtle = globalThis.crypto?.subtle) {
  if (channel === 'party') return VOICE_PARTY_RE.test(String(key)) ? `vp_${key}` : null;
  if (channel !== 'proximity' || !voiceRoomKeyOk(key) || voiceLayerOf(ly) === null) return null;
  const digest = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`proximity|${key}|${ly}`)));
  return `vx_${[...digest.subarray(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** A token request, projected: the fields the service reads and nothing else, or null when its shape is wrong. */
export function validTokenAsk(body) {
  if (!body || typeof body !== 'object') return null;
  const { token, room, channel, party, ly } = /** @type {any} */ (body);
  if (typeof token !== 'string' || !token || token.length > 1024) return null;
  if (!VOICE_CHANNELS.includes(channel)) return null;
  if (channel === 'party') {
    if (!VOICE_PARTY_RE.test(String(party ?? '')) || ly !== undefined) return null;
    return { token, channel: /** @type {'party'} */ ('party'), party: String(party), room: voiceRoomKeyOk(room) ? String(room) : null, ly: 0 };
  }
  if (party !== undefined) return null;
  const layer = voiceLayerOf(ly);
  if (!voiceRoomKeyOk(room) || layer === null) return null;
  return { token, channel: /** @type {'proximity'} */ ('proximity'), room: String(room), party: null, ly: layer };
}

/** A place frame, projected: the room and up to VOICE_PLACE_MAX well-shaped ids, de-duplicated, or null. */
export function validPlaceAsk(body) {
  if (!body || typeof body !== 'object') return null;
  const { token, room, near, ly } = /** @type {any} */ (body);
  if (typeof token !== 'string' || !token || token.length > 1024) return null;
  const layer = voiceLayerOf(ly);
  if (!voiceRoomKeyOk(room) || layer === null) return null;
  if (!Array.isArray(near) || near.length > VOICE_PLACE_MAX) return null;
  const ids = [];
  for (const id of near) { if (!VOICE_ID_RE.test(String(id))) return null; if (!ids.includes(id)) ids.push(String(id)); }
  return { token, room: String(room), ly: layer, near: ids };
}

/** The service's answer to a mint, as the client reads it: null unless every field it will use is there and sound. */
export function validTokenAnswer(a) {
  if (!a || typeof a !== 'object') return null;
  const { ok, v, url, token, identity, room, ttl } = /** @type {any} */ (a);
  if (ok !== true || v !== VOICE_V) return null;
  if (typeof url !== 'string' || !/^wss?:\/\/[^\s/]+/.test(url)) return null;
  if (typeof token !== 'string' || !token || typeof identity !== 'string' || !identity || typeof room !== 'string' || !room) return null;
  if (!Number.isSafeInteger(ttl) || ttl <= 0 || ttl > 3600) return null;
  return { url, token, identity, room, ttl };
}

/** The service's answer to a place frame, as the publisher reads it: the identities the service's mutual policy says
 *  may hear my microphone now (server-voice/src/proximityPolicy.js allowFor - never more than the place frame named,
 *  so VOICE_PLACE_MAX bounds it), or null unless the answer is whole. */
export function validPlaceAnswer(a) {
  if (!a || typeof a !== 'object') return null;
  const { ok, v, allow } = /** @type {any} */ (a);
  if (ok !== true || v !== VOICE_V || !Array.isArray(allow) || allow.length > VOICE_PLACE_MAX) return null;
  return allow.every((id) => typeof id === 'string' && VOICE_ID_RE.test(id)) ? [...new Set(allow)] : null;
}

/** A LiveKit URL the client will open: wss:// anywhere, ws:// on localhost alone - the relay's own rule (online.js). */
export function voiceUrlOk(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'wss:') return true;
    return u.protocol === 'ws:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch { return false; }
}
