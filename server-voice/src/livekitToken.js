// @ts-check
// HS256 JWT minting over WebCrypto (no SDK) so a Worker, node and a test run the same bytes.
//
// Grants are the whole access model: roomJoin to ONE room, canPublish the mic, canSubscribe the others. The
// identity is always the relay's verified subject - a client never names itself.

const enc = new TextEncoder();
const b64url = (/** @type {Uint8Array|string} */ v) => {
  const bytes = typeof v === 'string' ? enc.encode(v) : v;
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * @param {{ apiKey: string, apiSecret: string, identity: string, name?: string, room: string, ttlS: number, nowS: number, canPublish?: boolean, canSubscribe?: boolean, metadata?: string }} o
 * @param {SubtleCrypto} subtle
 */
export async function mintLiveKitToken({ apiKey, apiSecret, identity, name, room, ttlS, nowS, canPublish = true, canSubscribe = true, metadata }, subtle) {
  if (!apiKey || !apiSecret || !identity || !room) throw new TypeError('mintLiveKitToken: a key, a secret, an identity and a room');
  if (!Number.isSafeInteger(nowS) || !Number.isSafeInteger(ttlS) || ttlS <= 0) throw new TypeError('mintLiveKitToken: integer clock and ttl');
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = {
    iss: apiKey, sub: identity, jti: identity, iat: nowS, nbf: nowS - 10, exp: nowS + ttlS,
    ...(name ? { name } : {}),
    ...(metadata ? { metadata } : {}),
    video: { room, roomJoin: true, canPublish, canSubscribe, canPublishData: false, canUpdateOwnMetadata: false, canPublishSources: canPublish ? ['microphone'] : [] },
  };
  const signing = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await subtle.importKey('raw', enc.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign('HMAC', key, enc.encode(signing)));
  return `${signing}.${b64url(sig)}`;
}

/** A LiveKit server-API call's bearer - the same JWT with a `roomAdmin` grant on the room, no identity needed. */
export async function mintLiveKitAdminToken({ apiKey, apiSecret, room, nowS, ttlS = 60 }, subtle) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = { iss: apiKey, sub: apiKey, iat: nowS, nbf: nowS - 10, exp: nowS + ttlS, video: { room, roomAdmin: true, roomCreate: true } };
  const signing = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await subtle.importKey('raw', enc.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign('HMAC', key, enc.encode(signing)));
  return `${signing}.${b64url(sig)}`;
}

/** The claims of a token, read back without verifying - for a test's eyes and a log's. */
export function readJwtClaims(token) {
  try {
    const body = String(token).split('.')[1];
    const s = atob(body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '='));
    return JSON.parse(s);
  } catch { return null; }
}
