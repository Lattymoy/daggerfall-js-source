// @ts-check
// DRAGON-HIDDEN (2026-10-29, the owner: "people are able to predict the dragon spawn by looking at source code";
// bible/11-Multiplayer/Dwarven-Dragon.md section 2): A WATCH'S SEED, THE RELAY'S SECRET. The law's rolls
// (net/dragon/dragonLaw.js) take a watch's omen `{w, s}`; `s` is HMAC-SHA-256 of the watch under a key HKDF draws from the
// relay's GATE_SIGNING_KEY (the room lease's way, net/roomLease.js leaseKeyOf), so nobody without the relay's secret can
// roll a watch, and the relay tells a seed only once its landing is past (dragonSeedTold). The relay's alone. Rotating
// the secret moves every dragon, one standing now too. Not a DFU member. Ledger A (DRAGON).

/** The HKDF label: its own, so the seed's key is never the lease's or the receipts'. */
export const DRAGON_SEED_INFO = 'dfo-dragon-seed:v1';
const enc = new TextEncoder();

/**
 * The seed key from the relay's secret, or null - no secret, no dragon (never a public roll in its place).
 * @param {unknown} secret @param {{subtle: SubtleCrypto}} env @returns {Promise<CryptoKey|null>}
 */
export async function dragonWatchKeyOf(secret, { subtle }) {
  if (typeof secret !== 'string' || !secret) return null;
  try {
    const base = await subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
    return await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(DRAGON_SEED_INFO) }, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  } catch { return null; }
}

/**
 * Watch `w`'s seed: the first four bytes of HMAC(key, w), a whole number in [0, 2^32).
 * @param {CryptoKey} key @param {number} w @param {{subtle: SubtleCrypto}} env @returns {Promise<number>}
 */
export async function dragonWatchSeed(key, w, { subtle }) {
  const mac = new Uint8Array(await subtle.sign('HMAC', key, enc.encode(`dragon-watch:${w}`)));
  return ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0;
}
