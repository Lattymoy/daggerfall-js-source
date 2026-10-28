// @ts-check
// ARMORY (2026-10-28, the owner: "Earned and shop. We will start with dagons breach and shops"; bible/04-Characters/
// Aura-Armory.md section 3): THE BREACH'S ROLL FOR AN AURA ARMORY PIECE, as the service keeps it. A recorded Dagon's Breach
// kill rolls for one piece of the Dagonfire line the account does not hold yet, with this service's own die, in the
// claim's own batch beside the Weir Key's (accounts.js claimGate, eg.js egGateWeir): written only by the claim that wrote
// its `gate_kills` row, so a claim asked again rolls nothing and a failure between them cannot lose the roll.
// What the account holds is still read off the row at every ask (titles.js armoryHeld). Not a DFU member.
import { ARMORY_BREACH_PIECES, armoryBreachHeldOf, armoryPieceOf } from '../../src/net/armoryLaw.js';

/** The odds a recorded Breach kill finds a piece; a fighter who broke the faithful's rite, or a portent night's kill, at
 *  the better odds (the Weir Key's pattern, eg.js EG_KEY_ODDS_RITE). */
export const ARMORY_BREACH_ODDS = 1 / 12;
export const ARMORY_BREACH_ODDS_RITE = 1 / 8;
/** THE PITY: after this many recorded kills in a row with no piece, the next finds one (`armory_miss`, reset by a find). */
export const ARMORY_BREACH_PITY = 10;

/** One draw of this service's die under `p` - none without a die (a harness's ctx). eg.js's own law. */
function drawUnder(/** @type {any} */ rand, /** @type {number} */ p) {
  if (typeof rand !== 'function') return false;
  const d = rand(new Uint8Array(4));
  return (((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0) / 4294967296 < p;
}

/** The Breach piece a find gives an account holding `heldBits` - one it does not hold, picked by the die among them in the
 *  catalogue's order - or null when it holds them all. Pure but for the die. */
export function armoryBreachPick(/** @type {unknown} */ heldBits, /** @type {any} */ rand) {
  const held = armoryBreachHeldOf(heldBits);
  const open = ARMORY_BREACH_PIECES.filter((p) => !held.includes(p.key));
  if (!open.length) return null;
  if (open.length === 1 || typeof rand !== 'function') return open[0];
  const d = rand(new Uint8Array(4));
  return open[((((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0) % open.length)];
}

/**
 * THE ROLL'S STATEMENT for a verified kill's claims `c`, set in the claim's batch after its `gate_kills` row and RETURNING
 * the bits and the misses after it (armoryGateAnswer) - none for a guest or an account holding every Breach piece.
 * - a find at ARMORY_BREACH_ODDS, the rite's odds for a fighter who broke it (`r`) or a portent night's receipt (`p`);
 * - THE PITY: certain once `armory_miss` has reached ARMORY_BREACH_PITY;
 * - the piece one the row does not hold (its bit checked in the statement too, so two claims at once give one piece once).
 * @param {{ db: any, rand?: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string, handle?: string|null, armory_held?: number }} player
 */
export function armoryGateRoll({ db, rand }, player) {
  return (/** @type {any} */ c) => {
    if (!(typeof player?.handle === 'string' && player.handle)) return null;
    const piece = armoryBreachPick(player?.armory_held, rand);
    if (!piece) return null;
    const drawn = drawUnder(rand, c?.r === 1 || Number(c?.p) > 0 ? ARMORY_BREACH_ODDS_RITE : ARMORY_BREACH_ODDS) ? 1 : 0;
    const found = '((?2 = 1 OR armory_miss >= ?3) AND (armory_held & ?4) = 0)';
    return db.prepare(`UPDATE players SET armory_held = armory_held | (CASE WHEN ${found} THEN ?4 ELSE 0 END),
      armory_miss = CASE WHEN ${found} THEN 0 ELSE armory_miss + 1 END
      WHERE id = ?1 AND changes() > 0 RETURNING armory_held, armory_miss, ?5 AS piece`).bind(player.id, drawn, ARMORY_BREACH_PITY, piece.bit, piece.key);
  };
}

/** What the roll's statement answered (claimGate's `armoryRow`), as the claim says it: `{ found, held }` - `found` the
 *  piece's key where this claim gave it, else null; `held` every Breach piece held after it - or null where it rolled
 *  nothing. */
export function armoryGateAnswer(/** @type {any} */ row) {
  if (!row || !Number.isSafeInteger(Number(row.armory_held))) return null;
  const p = armoryPieceOf(row.piece);
  const held = armoryBreachHeldOf(row.armory_held);
  return { found: p && Number(row.armory_miss) === 0 && held.includes(p.key) ? p.key : null, held };
}
