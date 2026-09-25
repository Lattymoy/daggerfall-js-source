// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1 - AN ONLINE HOME'S DECOR, KEPT WHERE EVERY VISITOR READS IT.
//
// Mac: decor is "Gold per placement", the catalogue "Everything
// Daggerfall furnishes". An online home's pieces live here, so the room
// its owner furnished is the room every visitor walks into; the offline
// house's and ship's live in the save (the client's). What a piece is -
// its shape, its bounds, its price - is src/net/decorLaw.js, which the
// client reads too. The gold is the save's, as all of it is: this keeps
// WHERE the pieces stand, and who may move them.
//
// ═══ ONE PIECE A WRITE ═════════════════════════════════════════════
//
// A room is furnished a piece at a time and every write is one piece -
// placed, moved, removed - so a body stays far inside the service's
// 4 KiB (service.js MAX_BODY_BYTES) however full the room grows, and two
// of the owner's tabs moving two chairs cannot overwrite each other's.
//
// ═══ THE OWNER, IN THE SAME STATEMENT ══════════════════════════════
//
// Every write names the home's owner - the account AND the character,
// a home being one character's (HOME1) - inside its own WHERE, so a
// piece in somebody else's home is exactly as absent as none (`no-home`
// to place, `no-decor` to move or remove). A placement lands only while
// the home holds fewer than DECOR_CAP. WHAT a piece is - a model, or a
// flat - is written once, at the placement, into columns no later
// statement touches: a move rewrites `place` alone.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { DECOR_CAP, DECOR_ID_RE, DECOR_OPS_MAX, DECOR_OPS_WINDOW_S, decorPieceOf, decorPlaceOf } from '../../src/net/decorLaw.js';

/** The home is the caller's character's: map, key, account, character. */
const OWNS = 'EXISTS (SELECT 1 FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND char_id = ?)';
const placeJson = ({ pos, rot, scale, light, storage, paid }) => JSON.stringify({ pos, rot, scale, light, storage, paid });

/** A stored row as a piece - projected again on the way out, so a row the law would refuse is never handed out.
 *  DECOR2a: `item` (migration 0012) is the owner's own item's descriptor, or NULL. */
function pieceOfRow(row) {
  let place = null;
  let item = null;
  try { place = JSON.parse(row.place); } catch { place = null; }
  if (!place || typeof place !== 'object') return null;
  if (row.item != null) {
    try { item = JSON.parse(row.item); } catch { return null; }
  }
  return decorPieceOf({
    ...place, id: row.id,
    model: row.model ?? null,
    flat: row.model == null ? [row.flat_archive, row.flat_record] : null,
    item,
  });
}

/** The shared first steps of every write: a registered account, a home named, a character, the hour's writes. */
async function writeDoor({ db, nowS }, player, { mapId, buildingKey, character }) {
  if (accountKind(player) !== 'linked') return 'homes-need-account';
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return 'bad-home';
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return 'home-character';
  if (await overRate({ db, nowS }, `decor:${player.id}`, DECOR_OPS_MAX, DECOR_OPS_WINDOW_S)) return 'decor-rate';
  return null;
}

/**
 * A HOME'S PIECES, for everyone standing in it - guests too, the room being the same room to all of them. Oldest
 * first; never more than the cap.
 * @param {{db: any}} ctx
 */
export async function decorOf({ db }, _player, { mapId, buildingKey } = {}) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  const { results = [] } = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ?
    ORDER BY placed_at, id LIMIT ?`).bind(mapId, buildingKey, DECOR_CAP).all();
  return { mapId, buildingKey, pieces: results.map(pieceOfRow).filter(Boolean) };
}

/**
 * PLACE ONE: it stands in the owner's home, or it is refused and nothing changes. A placement sent again because its
 * answer was lost finds the same piece standing and is answered as the placement.
 * @param {{db: any, nowS: number}} ctx
 */
export async function placeDecor(ctx, player, { mapId, buildingKey, character, piece } = {}) {
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  const p = decorPieceOf(piece);
  if (!p) return { error: 'bad-decor' };
  const { db, nowS } = ctx;
  const r = await db.prepare(`INSERT OR IGNORE INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${OWNS} AND (SELECT COUNT(*) FROM home_decor WHERE map_id = ? AND building_key = ?) < ?`)
    .bind(mapId, buildingKey, p.id, p.model, p.flat?.[0] ?? null, p.flat?.[1] ?? null, placeJson(p), nowS, p.item ? JSON.stringify(p.item) : null,
      mapId, buildingKey, player.id, character, mapId, buildingKey, DECOR_CAP).run();
  if (r?.meta?.changes) return { ok: true, piece: p };
  const owns = await db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first();
  if (!owns?.owns) return { error: 'no-home' };
  const row = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, p.id).first();
  if (row) {
    const had = pieceOfRow(row);
    return had && JSON.stringify(had) === JSON.stringify(p) ? { ok: true, repeat: true, piece: had } : { error: 'decor-taken' };
  }
  return { error: 'decor-cap' };
}

/**
 * MOVE ONE - where it stands, its turn, its scale, its light, whether it holds things, what it has cost - never what
 * it is. The owner's alone.
 * @param {{db: any, nowS: number}} ctx
 */
export async function moveDecor(ctx, player, { mapId, buildingKey, character, id, place } = {}) {
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'no-decor' };
  const pl = decorPlaceOf(place);
  if (!pl) return { error: 'bad-decor' };
  const { db } = ctx;
  const row = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS}`)
    .bind(mapId, buildingKey, id, mapId, buildingKey, player.id, character).first();
  if (!row) return { error: 'no-decor' };
  // DECOR2a: the moved piece must be one the law takes, as a placed one must - the owner's own item never comes to cost
  // gold or hold things (a piece the law refuses reads as nothing, and its cost would be owed at a sale)
  const was = pieceOfRow(row);
  if (!was || !decorPieceOf({ ...was, ...pl })) return { error: 'bad-decor' };
  const r = await db.prepare(`UPDATE home_decor SET place = ? WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS}`)
    .bind(placeJson(pl), mapId, buildingKey, id, mapId, buildingKey, player.id, character).run();
  if (!r?.meta?.changes) return { error: 'no-decor' };
  const now = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, id).first();
  const piece = now ? pieceOfRow(now) : null;
  return piece ? { ok: true, piece } : { error: 'no-decor' };
}

/**
 * REMOVE ONE: the owner's alone. Answers the piece as it stood - its cost among it, for the half that comes back.
 * @param {{db: any, nowS: number}} ctx
 */
export async function removeDecor(ctx, player, { mapId, buildingKey, character, id } = {}) {
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'no-decor' };
  const { db } = ctx;
  const row = await db.prepare(`DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS} RETURNING *`)
    .bind(mapId, buildingKey, id, mapId, buildingKey, player.id, character).first();
  const piece = row ? pieceOfRow(row) : null;
  return piece ? { ok: true, piece } : { error: 'no-decor' };
}
