// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT19 (2026-10-17, the INTEGRITY arc's lane 1, its open item - bible/06-Systems/Integrity-Arc.md section 7): A CRAFTED
// PIECE HANDED ON LEAVES ITS SELLER'S REALM RECORD. The piece route - a listing, an auction (market.js), a commission
// filled (writs.js) - decided on the craft's own record (`products`) alone, and the client took the piece out of its
// pack only locally: a tab that had lost its seat to a second device listed a piece the live record still held. Each
// crafted act now takes the piece out of the record where the tab says it stands, in the act's own batch - the shape
// alchemy.js disenchantPiece had ("the maker's record says where the piece is, never the products row").
// ═══════════════════════════════════════════════════════════════════

import { prepareRealmRecord } from './realm.js';
import { takeTradeGoods, tradeableRecord } from '../../src/net/realm/realmTradeLaw.js';

/**
 * THE RECORD'S OWN CRAFTED PIECE, taken out of a realm record `save` - the piece of `provenance` loose in its pack (the trade's
 * own law: never worn, bound, a quest's or summoned - realmTradeLaw tradeableRecord - moved as a trade moves it) or among
 * its home's furnishings, the two places the tab offers a piece from (scenes/world.js marketPieces). Answers the record
 * taken out, or null where the record holds no such piece.
 */
export function takeCraftedPiece(save, provenance) {
  const items = Array.isArray(save.items) ? save.items : [];
  const at = items.findIndex((rec) => rec?.provenance === provenance && tradeableRecord(rec));
  if (at >= 0) return takeTradeGoods(save, { items: [items[at]], gold: 0 }, [at])?.[0] ?? null;
  const home = Array.isArray(save.furnishings) ? save.furnishings : [];
  const h = home.findIndex((rec) => !!rec && typeof rec === 'object' && !Array.isArray(rec) && rec.provenance === provenance);
  return h >= 0 ? home.splice(h, 1)[0] : null;
}

/**
 * INT19: A CRAFTED ACT'S RECORD FIRST - the piece of `provenance` out of the record at `at` (takeCraftedPiece), `escrow`
 * the ledger's word for where it goes (a listing's or an auction's: the market's; a commission's: handed on), `check`
 * the act's own word on the piece taken (a refusal, or null). Answers prepareRealmRecord's own (`steps` for the act's
 * batch, which must GUARD them - mustChange after its decision) and `moved`, the record taken out; 'market-piece-gone'
 * where the record holds no such piece.
 * @param {any} ctx @param {string} me @param {{ id: string, lease: string, seq: number }} at @param {string} provenance @param {boolean} escrow
 * @param {((moved: any) => string | null) | null} [check]
 */
export async function prepareCraftedPiece(ctx, me, at, provenance, escrow, check = null) {
  /** @type {any} */
  let moved = null;
  const prep = await prepareRealmRecord(ctx, me, at, (save) => {
    moved = takeCraftedPiece(save, provenance);
    return moved ? (check?.(moved) ?? null) : 'market-piece-gone';
  }, { outbound: true, escrow });   // INT3: the piece goes to another player - a held record hands nothing on
  return prep.error ? prep : { ...prep, moved };
}

/**
 * INT19: WHETHER A CRAFTED PIECE IS ON ITS WAY BACK TO `me` AS ITS RECORD - cancelled, expired, unsold or removed, an
 * `item` delivery (market.js pieceBackSteps) not yet collected. Such a delivery names no provenance of its own, so the
 * routes' "a delivery of it waits" asks this too (AUDIT 31 H1: a save showing the piece then is a copy, never put back).
 * Only its seller is owed one, so it reads `me`'s deliveries alone.
 * @param {any} db @param {string} me @param {string} provenance
 */
export async function pieceComingBack(db, me, provenance) {
  return !!(await db.prepare("SELECT 1 FROM market_deliveries WHERE player = ?2 AND collected = 0 AND item IS NOT NULL AND json_extract(item, '$.provenance') = ?1")
    .bind(provenance, me).first());
}
