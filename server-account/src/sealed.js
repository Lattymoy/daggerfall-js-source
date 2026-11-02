// @ts-check
// THE SERVICE'S SEALED WORD (lifted out of PATREON-LINK's patreon.js for SHOP, bible/06-Systems/Shop.md): claims sealed
// with AES-GCM under a key HKDF derives from one of the Worker's secrets, one key a salt and a kind - so a value sealed
// for one door never opens at another, and a byte changed anywhere opens to nothing. Sealed rather than signed, because
// what it carries (an account, an order) is nobody's to read on the way past: a browser's history, a provider's logs.
import { _b64url } from '../../src/net/identityToken.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const SEAL_IV_BYTES = 12;

/** The key one salt and kind seal under - derived once, it seals any number of values (sealUnder). */
export async function sealKey(
  /** @type {SubtleCrypto} */ subtle,
  /** @type {string} */ secret,
  /** @type {string} */ salt,
  /** @type {string} */ kind,
) {
  const base = await subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(kind) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seal `claims` (an object with `p`, the account, and `x`, its expiry in seconds) as one base64url run. */
export async function sealWith(
  /** @type {string} */ secret,
  /** @type {string} */ salt,
  /** @type {string} */ kind,
  /** @type {object} */ claims,
  { subtle, rand },
) {
  return sealUnder(await sealKey(subtle, secret, salt, kind), claims, { subtle, rand });
}
/** sealWith under a key already derived (sealKey). */
export async function sealUnder(/** @type {CryptoKey} */ key, /** @type {object} */ claims, { subtle, rand }) {
  const iv = rand(new Uint8Array(SEAL_IV_BYTES));
  const box = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(claims))));
  const out = new Uint8Array(iv.length + box.length);
  out.set(iv);
  out.set(box, iv.length);
  return _b64url.encode(out);
}

/** The claims a sealed value carries, or null: another secret, salt or kind, changed, malformed, or past its expiry. */
export async function openWith(
  /** @type {string} */ secret,
  /** @type {string} */ salt,
  /** @type {string} */ kind,
  /** @type {any} */ sealed,
  { subtle, nowS },
) {
  if (typeof sealed !== 'string' || sealed.length > 4096) return null;
  const bytes = _b64url.decode(sealed);
  if (!bytes || bytes.length <= SEAL_IV_BYTES + 16) return null;
  let claims;
  try {
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, SEAL_IV_BYTES) },
      await sealKey(subtle, secret, salt, kind),
      bytes.subarray(SEAL_IV_BYTES),
    );
    claims = JSON.parse(dec.decode(plain));
  } catch {
    return null;
  } // GCM's tag refuses another key, another kind, or a byte changed
  if (!claims || typeof claims !== 'object' || !Number.isSafeInteger(claims.x) || claims.x < nowS) return null;
  if (typeof claims.p !== 'string' || !claims.p) return null;
  return claims;
}
