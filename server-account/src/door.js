// @ts-check
// PRIMARY-FOLD (2026-10-18; bible/11-Multiplayer/Scale-Arc.md THE PLAN PAST 1,000, PRIMARY-FOLD): THE DOOR'S READS IN ONE
// TRIP. Every authenticated request that names a `character` asks whether it is one of the account's tombstones
// (legacy.js isTombstone), and every progression claim (progress.js PROGRESS_ROUTES) asks the account's seat
// (progressRefusal) and, while the line is enforced, its stream's bucket (progressRoom) - each its own round trip to the
// account database's one primary, before the route reads a word. They are reads the route asks before it writes
// anything, so a claim asks them here as ONE statement - each question a subquery over its own question's WHERE
// (legacy.js TOMB_WHERE, progress.js SEAT_WHERE: AUDIT PLAN-1000 C2, never two literals) - and the door answers them in
// the order each was asked: the tombstone first, then the seat, then the enforced room. The spend steps its own bucket
// where it stands (progress.js spendProgress, AUDIT PLAN-1000 C1). One statement, not a batch: the routes' own batches
// keep every failure they had (a batch D1 dropped is the route's). A request that names a character and claims nothing -
// or a claim the account's rate will refuse (accounts.js accountRateFull, AUDIT PLAN-1000 C4) - asks the tombstone alone.
import { isTombstone, TOMB_WHERE } from './legacy.js';
import { bucketFrom, SEAT_WHERE } from './progress.js';

/** The door's three questions for a claim: ?1 the account, ?2 the character named (or null), ?3 the claim's stream. The
 *  seat's id and hold are two subqueries over one WHERE and one index (`realm_characters_player`), so they are one row's -
 *  the row the seat's own question finds first, measured over every order two leased characters can be written in
 *  (AUDIT PLAN-1000 lane C). */
const DOOR_SQL = `SELECT
  (SELECT 1 FROM realm_characters WHERE ${TOMB_WHERE}) AS dead,
  (SELECT id FROM realm_characters WHERE ${SEAT_WHERE}) AS seat_id,
  (SELECT held FROM realm_characters WHERE ${SEAT_WHERE}) AS seat_held,
  (SELECT 1 FROM players WHERE id = ?1) AS player,
  (SELECT played_s FROM players WHERE id = ?1) AS now,
  (SELECT allowance FROM progress_play WHERE player = ?1 AND stream = ?3) AS allowance,
  (SELECT played_at FROM progress_play WHERE player = ?1 AND stream = ?3) AS played_at`;

/**
 * The door's reads for `playerId`: `tomb` - the character to ask the tombstone of (null asks none); `stream` - a
 * progression claim's stream (null asks neither the seat nor the bucket). Answers `{ dead, seat, bucket, stream }`: `dead`
 * whether the character is a tombstone, `seat` the seat's row as progressRefusal reads it (`{ id, held }`, null for none,
 * undefined when not asked), `bucket` the stream's bucket as bucketOf answers it (undefined when not asked).
 * @param {any} db @param {string} playerId @param {{ tomb: string|null, stream: string|null }} ask
 */
export async function doorReads(db, playerId, { tomb, stream }) {
  /** @type {{ dead: boolean, seat: any, bucket: any, stream: string|null }} */
  const out = { dead: false, seat: undefined, bucket: undefined, stream };
  if (stream == null) {
    if (tomb != null) out.dead = await isTombstone(db, playerId, tomb);
    return out;
  }
  const r = await db.prepare(DOOR_SQL).bind(playerId, tomb, stream).first();
  out.dead = !!r?.dead;
  out.seat = r?.seat_id != null ? { id: r.seat_id, held: r.seat_held } : null;
  out.bucket = r?.player ? bucketFrom({ now: r.now, allowance: r.allowance, played_at: r.played_at }) : null;
  return out;
}
