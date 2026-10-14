// @ts-check
// The wire shapes both the game and server-voice/ import, so one file is the single source of truth for them.
//
//   POST /v1/voice/token   { token, room, channel, party? }   ->  { ok, url, token, identity, room, ttl }
//   POST /v1/voice/place   { token, room, near: [id...] }     ->  { ok }
//   GET  /health                                              ->  { ok, service, version }
//
// SFU room names are derived here alone so a forged `room` can never land a client in another game's session.

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
/** A game room key's shape as the service admits it (online.js roomKeyFor: `cell:...`, `dun:...`, `int:...`). */
export const VOICE_ROOM_RE = /^[a-z]+:[A-Za-z0-9_.:-]{1,120}$/;
/** A party id's shape (wire.js mintPartyId: 'q' + base36 time + 8 base36). */
export const VOICE_PARTY_RE = /^q[0-9a-z]{6,20}$/;
/** A peer id's shape, the relay's (identityToken.js ID_RE). */
export const VOICE_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
/** The most ids one place frame names - the subscription bound (voiceProximity.js VOICE_SUBS_MAX) with room to spare. */
export const VOICE_PLACE_MAX = 16;
/** The service's own rate: how many token mints one identity may ask a minute. */
export const VOICE_MINT_PER_MIN = 12;
/** ...and how many place frames a second. */
export const VOICE_PLACE_HZ_MAX = 4;

/** THE SFU ROOM'S NAME, from the channel and the game's key - one law, both ends. */
export function voiceRoomName(channel, key) {
  if (channel === 'party') return VOICE_PARTY_RE.test(String(key)) ? `vp_${key}` : null;
  if (channel === 'proximity') return VOICE_ROOM_RE.test(String(key)) ? `vx_${String(key).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 96)}` : null;
  return null;
}

/** A token request, projected: the fields the service reads and nothing else, or null when its shape is wrong. */
export function validTokenAsk(body) {
  if (!body || typeof body !== 'object') return null;
  const { token, room, channel, party } = /** @type {any} */ (body);
  if (typeof token !== 'string' || !token || token.length > 1024) return null;
  if (!VOICE_CHANNELS.includes(channel)) return null;
  if (channel === 'party') {
    if (!VOICE_PARTY_RE.test(String(party ?? ''))) return null;
    return { token, channel: /** @type {'party'} */ ('party'), party: String(party), room: VOICE_ROOM_RE.test(String(room ?? '')) ? String(room) : null };
  }
  if (party !== undefined) return null;
  if (!VOICE_ROOM_RE.test(String(room ?? ''))) return null;
  return { token, channel: /** @type {'proximity'} */ ('proximity'), room: String(room), party: null };
}

/** A place frame, projected: the room and up to VOICE_PLACE_MAX well-shaped ids, de-duplicated, or null. */
export function validPlaceAsk(body) {
  if (!body || typeof body !== 'object') return null;
  const { token, room, near } = /** @type {any} */ (body);
  if (typeof token !== 'string' || !token || token.length > 1024) return null;
  if (!VOICE_ROOM_RE.test(String(room ?? ''))) return null;
  if (!Array.isArray(near) || near.length > VOICE_PLACE_MAX) return null;
  const ids = [];
  for (const id of near) { if (!VOICE_ID_RE.test(String(id))) return null; if (!ids.includes(id)) ids.push(String(id)); }
  return { token, room: String(room), near: ids };
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

/** A LiveKit URL the client will open: wss:// anywhere, ws:// on localhost alone - the relay's own rule (online.js). */
export function voiceUrlOk(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'wss:') return true;
    return u.protocol === 'ws:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch { return false; }
}
