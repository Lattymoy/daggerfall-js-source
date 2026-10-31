// DRAGON-HIDDEN: the dragon tests' relay secret and its omens. The relay rolls a watch with HMAC of its GATE_SIGNING_KEY
// (src/net/dragon/dragonSeed.js), so a test that stands a fight finds its dragon's watch under the key its relay holds.
// One Ed25519 key serves both: it signs the receipts and seeds the watches, as GATE_SIGNING_KEY does in production.
// DRAGON-CELL: a watch's omens are its candidates (dragonCandidates), each in a cell of its own - the one a player near it is
// told and a fight stands by - so a test's site is a pixel of its omen's cell (siteOf).
import { dragonWatchKeyOf, dragonOmenSeeds } from '../src/net/dragon/dragonSeed.js';
import { isDragonOmen, dragonLookOf, dragonCandidates, dragonCellOf, pixelCentreNative, DRAGON_CELL_PX, DRAGON_CELLS_A_WATCH } from '../src/net/dragon/dragonLaw.js';
import { DRAGON_TELL_DWELL_MS } from '../server/src/dragonFights.js';

const subtle = globalThis.crypto.subtle;
const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
/** The relay's secret (`pkcs8`, base64 - GATE_SIGNING_KEY's form) and its public half for the receipts. */
export const RELAY_KEY = Object.freeze({ pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), publicKey: kp.publicKey });
const seedKey = await dragonWatchKeyOf(RELAY_KEY.pkcs8, { subtle });

/** AUDIT DRAGON-CELL D1: watch `w`'s omens' seeds under the tests' relay secret, as the relay holds them. @param {number} w */
export const watchOf = async (w) => ({ w, seeds: await dragonOmenSeeds(seedKey, w, DRAGON_CELLS_A_WATCH, { subtle }) });
/** Is an omen's cell wholly on the Bay's map (true), wholly off it (false), or across its edge (null)? */
export function cellInBay(o) {
  const { cx, cy } = dragonCellOf(o), x0 = cx * DRAGON_CELL_PX, y0 = cy * DRAGON_CELL_PX, x1 = x0 + DRAGON_CELL_PX, y1 = y0 + DRAGON_CELL_PX;
  if (x0 >= 0 && y0 >= 0 && x1 <= 1000 && y1 <= 500) return true;
  return x1 <= 0 || y1 <= 0 || x0 >= 1000 || y0 >= 500 ? false : null;
}
/** The first omen, from watch `from` on, that brings a dragon down of this look in a cell on the Bay's map (`bay` true) or
 *  off it (false) - the brass, in the Bay, unless named. AUDIT DRAGON-HIDDEN C1: the key is new each run, so a test names
 *  every roll it reads (null: any). */
export async function dragonOmenFrom(from, { look = 0, bay = true } = {}) {
  for (let w = from; ; w++) {
    for (const c of dragonCandidates(await watchOf(w))) if (isDragonOmen(c) && (look === null || dragonLookOf(c) === look) && (bay === null || cellInBay(c) === bay)) return c;
  }
}
/** AUDIT DRAGON-CELL II E2: a fake room whose sockets have stood DRAGON_TELL_DWELL_MS in its cell when they connect - a
 *  player at the site a while, as a fight's tests mean one (the room keeps the attachment it is handed). */
export function aged(r, ms = DRAGON_TELL_DWELL_MS) {
  const connect = r.connect;
  r.connect = () => { const ws = connect(); ws.att.at -= ms; return ws; };
  return r;
}
/** A site in an omen's cell: the pixel `dx`, `dy` from the cell's corner, and its native centre. */
export function siteOf(o, dx = 5, dy = 6) {
  const { cx, cy } = dragonCellOf(o), px = cx * DRAGON_CELL_PX + dx, py = cy * DRAGON_CELL_PX + dy;
  return { px, py, ...pixelCentreNative(px, py) };
}
