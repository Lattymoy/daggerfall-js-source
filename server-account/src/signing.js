// @ts-check
// ═══════════════════════════════════════════════════════════════════
// THE SIGNING KEY, AND THE ONE PIECE OF MODULE STATE THIS SERVICE HAS.
//
// Split out of `src/index.js` by AUDIT-ACC F2, for the same reason as
// service.js: a module Worker's entrypoint may export ONLY handlers, so
// `_resetKeyForTests` - a named function export - was one of the things
// stopping the Worker from booting at all. The cache it resets lives
// here now, which is where it always belonged: the state and the hook
// that clears it are one subject.
//
// THE KEY IS IMPORTED ONCE PER ISOLATE. A key imported per request
// costs a PKCS8 parse on the hot path for nothing.
//
// IT IS IMPORTED NON-EXTRACTABLE and with `sign` alone. Nothing in this
// service ever needs to read the private half back out, and a key that
// cannot be exported cannot be exfiltrated by a later bug that gets as
// far as holding it. The PUBLIC half is not derived from it - it is
// stored beside it and served from /v1/pubkey - because WebCrypto gives
// no way to recover a public key from an imported private one.
// ═══════════════════════════════════════════════════════════════════

/* global atob */
import { importPublicKeyB64 } from '../../src/net/identityToken.js';

let _key = null;

/**
 * The Ed25519 private key, or null when the service has not been given
 * one. NULL IS A REAL ANSWER: a service with no key still hands out
 * accounts, it just cannot vouch for them, and the caller turns that
 * into `no-signing-key` rather than minting something the relay will
 * refuse.
 */
export async function signingKey(env, subtle) {
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

/** WB5b: THE RELAY'S PUBLIC HALF - `GATE_PUBLIC_KEY`, base64url raw,
 * the key an Oblivion Gate's kill receipts verify with
 * (src/net/gateReceipt.js; the relay signs with GATE_SIGNING_KEY).
 * Imported once per isolate like the private one, and NULL IS A REAL
 * ANSWER here too: a service with no key declines every claim, and the
 * client keeps its receipts until one is set - they carry a week. It is
 * not a secret: it can verify a receipt and cannot sign one.
 * @type {CryptoKey|null|undefined} undefined: not asked yet */
let _gateKey;
export async function gatePublicKey(env, subtle) {
  if (_gateKey !== undefined) return _gateKey;
  const raw = String(env.GATE_PUBLIC_KEY ?? '');
  _gateKey = raw ? await importPublicKeyB64(raw, { subtle }) : null;
  return _gateKey;
}

/** Drops the per-isolate cache. A test that changes the key in `env`
 *  would otherwise get the one the previous test imported. */
export function _resetKeyForTests() { _key = null; _gateKey = undefined; }
