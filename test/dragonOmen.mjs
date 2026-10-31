// DRAGON-HIDDEN: the dragon tests' relay secret and its omens. The relay rolls a watch with HMAC of its GATE_SIGNING_KEY
// (src/net/dragon/dragonSeed.js), so a test that stands a fight finds its dragon's watch under the key its relay holds.
// One Ed25519 key serves both: it signs the receipts and seeds the watches, as GATE_SIGNING_KEY does in production.
import { dragonWatchKeyOf, dragonWatchSeed } from '../src/net/dragon/dragonSeed.js';
import { isDragonOmen, dragonLookOf, dragonLaneOf } from '../src/net/dragon/dragonLaw.js';

const subtle = globalThis.crypto.subtle;
const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
/** The relay's secret (`pkcs8`, base64 - GATE_SIGNING_KEY's form) and its public half for the receipts. */
export const RELAY_KEY = Object.freeze({ pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), publicKey: kp.publicKey });
const seedKey = await dragonWatchKeyOf(RELAY_KEY.pkcs8, { subtle });

/** Watch `w`'s omen under the tests' relay secret. @param {number} w */
export const omenOf = async (w) => ({ w, s: await dragonWatchSeed(seedKey, w, { subtle }) });
/** The first watch from `from` whose omen brings a dragon down of this look in this theatre - the brass, in the Bay,
 *  unless named. AUDIT DRAGON-HIDDEN C1: the key is new each run, so a test names every roll it reads (null: any). */
export async function dragonOmenFrom(from, { look = 0, lane = 0 } = {}) {
  for (let w = from; ; w++) {
    const o = await omenOf(w);
    if (isDragonOmen(o) && (look === null || dragonLookOf(o) === look) && (lane === null || dragonLaneOf(o) === lane)) return o;
  }
}
