// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DOMAIN2 (2026-10-24, the owner: "Allowing the purchase of the actual
// castle in major cities (cyrodil excluded), using the instancing system";
// asked, "One owner per castle", "Silver", "Region holder buys it") - A
// GUILD'S CASTLE, AS THE SERVICE KEEPS IT (bible/11-Multiplayer/Domains.md
// section 6; the numbers are src/net/castleLaw.js, which the client reads
// too).
//
// ═══ ONE ROW A CASTLE, KEYED BY ITS REGION ══════════════════════════
//
// `guild_castles` (migration 0168): a region keeps one castle, so the
// region is the row's key and a second buyer finds it taken in the very
// statement that would write it. The row names the castle's key (its
// crown seat's - a crown city's castle is its own location's dungeon),
// the guild, what was paid, and the EPOCH: eight hex minted at the
// purchase and never again, the instance room's own (net/instanceRoom.js
// `<dungeon>.i<the guild's digest>.<epoch>`) - so the next owner of the
// castle walks into a fresh one, and an owner who buys it back does too.
//
// ═══ ONE STATEMENT DECIDES ══════════════════════════════════════════
//
// A buy is one batch whose first statement writes the row only where
// everything holds as the rows stand: the buyer the guild's Guildmaster,
// the guild holding that region's crown Charter, no castle on the region,
// the silver in the treasury, the request id unspent (the row's own
// `rid`). The ledger's burn is written off that row's nonce. A sale is the
// ledger's line first (the Guildmaster's, the row still the guild's), the
// row deleted off that line.
//
// ═══ SETTLED ON READ ════════════════════════════════════════════════
//
// A castle goes with its region (Domains law 3), by any road - a siege, a
// lapse, a revolt, a Charter given up, a Season's wipe. Nothing here runs
// on a clock: every read of a guild's castles, every castle act and every
// Turning (seatTurning.js) first releases each castle whose guild no
// longer holds its region's Charter - half its price home to the guild's
// silver treasury (as much of it as the treasury has room for), on a
// ledger line keyed by the row's own nonce, so it happens once, and the
// row deleted off that line.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { displayName, mintId, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { marksOpenFor } from './marks.js';
import { seatsOpenFor } from './townSeats.js';
import { MARKS_MAX, MARKS_RID_RE, utcDay } from '../../src/net/marksLaw.js';
import {
  CASTLE_PRICE,
  CASTLE_POWERS,
  castleMay,
  castleRegionOk,
  castleKeyOk,
  castleSaleRefund,
  castleLostRefund,
  castleOffers,
} from '../../src/net/castleLaw.js';

const INSERT_LINE =
  'INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)';
/** The castle acts' own bucket - a Guildmaster's few presses. */
const CASTLE_OPS_HOUR = 20;
/** The hold that keeps a castle: its guild still holding its region's crown Charter (`c` the castle row's alias). */
const HELD_SQL = (c) =>
  `EXISTS (SELECT 1 FROM town_seat_holds h WHERE h.key = ${c}.key AND h.guild_id = ${c}.guild_id AND h.region = ${c}.region AND h.tier = 'crown')`;
/** An epoch: eight lower-case hex - four bytes of the service's own dice (`rand` fills a byte array, as mintId's). */
const mintEpoch = (rand) => {
  const b = new Uint8Array(4);
  rand(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};

/**
 * THE RELEASE (Domains law 3): each castle - guild `g`'s, or every guild's where `g` is null - whose guild no longer holds
 * its region's crown Charter, released: half its price home to the guild's silver treasury (what its room allows), on a
 * ledger line keyed by the row's nonce (`castle-lost:<region>:<n>`) and written off the row itself, and the row deleted in
 * the same batch - so a second release, or two at once, finds no row to pay from. Idempotent.
 * Answers the regions released.
 */
export async function releaseCastles(db, nowS, g = null) {
  const { results = [] } = await db
    .prepare(
      `SELECT c.region, c.guild_id, c.paid, c.n FROM guild_castles c
    WHERE (?1 IS NULL OR c.guild_id = ?1) AND NOT ${HELD_SQL('c')}`,
    )
    .bind(g)
    .all();
  const gone = [];
  for (const c of results) {
    const rid = `castle-lost:${c.region}:${c.n}`;
    await db.batch([
      db
        .prepare(
          `${INSERT_LINE}
        SELECT 'mint', NULL, 'guild', c.guild_id, 'castle-lost', MIN(?3, ?4 - COALESCE((SELECT balance FROM guild_marks WHERE guild_id = c.guild_id), 0)), ?5, ?6, 'castle', NULL, ?7
        FROM guild_castles c WHERE c.region = ?1 AND c.n = ?2 AND NOT ${HELD_SQL('c')}
          AND MIN(?3, ?4 - COALESCE((SELECT balance FROM guild_marks WHERE guild_id = c.guild_id), 0)) > 0`,
        )
        .bind(c.region, c.n, castleLostRefund(Number(c.paid)), MARKS_MAX, utcDay(nowS), nowS, rid),
      db
        .prepare(`DELETE FROM guild_castles WHERE region = ?1 AND n = ?2 AND NOT ${HELD_SQL('guild_castles')}`)
        .bind(c.region, c.n),
    ]);
    gone.push(Number(c.region));
  }
  return gone;
}

/** A guild's castles as its members read them - `[{ region, key, epoch, paid, boughtAt }]` - read after the release
 *  (castleViewOf, its one caller, releases every castle first). */
export async function castlesOf(db, g) {
  const { results = [] } = await db
    .prepare('SELECT region, key, epoch, paid, bought_at FROM guild_castles WHERE guild_id = ? ORDER BY region')
    .bind(g)
    .all();
  return results.map((r) => ({
    region: Number(r.region),
    key: Number(r.key),
    epoch: r.epoch,
    paid: Number(r.paid),
    boughtAt: Number(r.bought_at),
  }));
}
/** The castles guild `g` may buy - each region whose crown Charter it holds and whose castle nobody keeps (castleLaw.js
 *  castleOffers), `[{ region, key, price }]`. */
export async function castleOffersOf(db, g) {
  const { results: holds = [] } = await db
    .prepare("SELECT key, region, tier FROM town_seat_holds WHERE guild_id = ? AND tier = 'crown'")
    .bind(g)
    .all();
  if (!holds.length) return [];
  const { results: kept = [] } = await db.prepare('SELECT region FROM guild_castles').all();
  return castleOffers(
    holds.map((h) => ({ key: Number(h.key), region: Number(h.region), tier: h.tier })),
    kept.map((k) => Number(k.region)),
  ).map((o) => ({ ...o, price: CASTLE_PRICE }));
}
/** The castle part of a guild's view: its castles and, to its Guildmaster, the ones it may buy - every castle whose guild
 *  lost its region released first (AUDIT DOMAINS S2: the offers read every guild's castles, so a crown's new holder was
 *  offered nothing until the old holder's own view released it - and an old holder that took the crown back unread kept
 *  a castle law 3 had taken from it). */
export async function castleViewOf(db, g, rank, nowS) {
  await releaseCastles(db, nowS);
  const castles = await castlesOf(db, g);
  return { castles, castleOffers: castleMay(rank, 'buy') ? await castleOffersOf(db, g) : [] };
}

/** The doors every castle act asks first: the switches (the seats', the silver's) and the request id. */
function shut(player, env, rid) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  if (typeof rid !== 'string' || !MARKS_RID_RE.test(rid)) return { error: 'bad-rid' };
  return null;
}

/**
 * BUY A CASTLE: `{ character, region, rid }` - the Guildmaster of the guild holding `region`'s crown Charter, CASTLE_PRICE
 * silver burnt from its treasury; the castle its own instance from now on (the epoch minted here). Asked again it answers
 * the castle bought, `repeat`.
 * @param {{ db: any, nowS: number, rand?: () => number, env?: any }} ctx
 */
export async function buyCastle(ctx, player, { character, region, rid } = {}) {
  const { db, nowS, rand, env } = ctx;
  const refused = shut(player, env, rid);
  if (refused) return refused;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const g = a.me.guild_id;
  // AUDIT DOMAINS S5: a purchase asked again is known by its burn line, which outlives the castle - its row goes with a
  // sale or a release, and the request asked again after it bought anew and failed on the line's key (a 500)
  if (
    await db
      .prepare('SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2')
      .bind(player.id, `${rid}:castle`)
      .first()
  )
    return { ok: true, repeat: true, region, ...(await castleViewOf(db, g, Number(a.me.rank), nowS)) };
  if (!castleRegionOk(region)) return { error: 'castle-none' };
  if (!castleMay(Number(a.me.rank), 'buy')) return { error: 'guild-rank' };
  await releaseCastles(db, nowS); // a castle whose guild lost the region is free again before anyone asks for it
  const hold = await db
    .prepare("SELECT key FROM town_seat_holds WHERE guild_id = ?1 AND region = ?2 AND tier = 'crown'")
    .bind(g, region)
    .first();
  if (!hold) return { error: 'castle-not-held' };
  if (!castleKeyOk(Number(hold.key))) return { error: 'castle-none' }; // AUDIT DOMAINS R2: a castle the relay admits its guild to
  if (await db.prepare('SELECT 1 FROM guild_castles WHERE region = ?').bind(region).first())
    return { error: 'castle-taken' };
  if (await overRate(ctx, `castle:${player.id}`, CASTLE_OPS_HOUR, 3600)) return { error: 'guild-rate' };
  const nonce = mintId(rand),
    epoch = mintEpoch(rand);
  await db.batch([
    // THE DECISION: the Guildmaster still, the crown Charter still the guild's, no castle on the region, the silver there
    db
      .prepare(
        `INSERT OR IGNORE INTO guild_castles (region, key, guild_id, paid, epoch, bought_at, buyer, rid, n)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
      WHERE EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?10 AND guild_id = ?3 AND rank IN (${CASTLE_POWERS.buy.join(', ')}))
        AND EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?2 AND guild_id = ?3 AND region = ?1 AND tier = 'crown')
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?3), 0) >= ?4
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?7 AND rid = ?8 || ':castle')`,
      )
      .bind(region, Number(hold.key), g, CASTLE_PRICE, epoch, nowS, player.id, rid, nonce, Number(a.me.rid)),
    // the silver, burnt off the row this request wrote
    db
      .prepare(
        `${INSERT_LINE} SELECT 'guild', guild_id, 'burn', NULL, 'castle', paid, ?3, bought_at, buyer, ?4, rid || ':castle'
      FROM guild_castles WHERE region = ?1 AND n = ?2`,
      )
      .bind(region, nonce, utcDay(nowS), displayName(player)),
  ]);
  const row = await db.prepare('SELECT * FROM guild_castles WHERE region = ?').bind(region).first();
  if (row?.n === nonce)
    return {
      ok: true,
      region,
      key: Number(row.key),
      epoch: row.epoch,
      paid: Number(row.paid),
      ...(await castleViewOf(db, g, Number(a.me.rank), nowS)),
    };
  if (row)
    return row.guild_id === g && row.rid === rid
      ? { ok: true, repeat: true, region, ...(await castleViewOf(db, g, Number(a.me.rank), nowS)) }
      : { error: 'castle-taken' };
  const has = Number(
    (await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(g).first())?.balance ?? 0,
  );
  if (has < CASTLE_PRICE) return { error: 'guild-marks-short' };
  return { error: 'castle-not-held' };
}

/**
 * GIVE A CASTLE UP: `{ character, region, rid }` - the Guildmaster of the guild that keeps it, while the region is held:
 * 85% of what was paid back to the silver treasury (what its room allows), the castle no longer the guild's. Asked again
 * it answers the sale made, `repeat`.
 * @param {{ db: any, nowS: number, env?: any }} ctx
 */
export async function sellCastle(ctx, player, { character, region, rid } = {}) {
  const { db, nowS, env } = ctx;
  const refused = shut(player, env, rid);
  if (refused) return refused;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const g = a.me.guild_id,
    line = `${rid}:castle-sale`;
  // AUDIT DOMAINS C3: a sale asked again says what came home, as the sale did - the window words its answer by `back`
  const done = await db
    .prepare('SELECT amount FROM marks_ledger WHERE actor = ?1 AND rid = ?2')
    .bind(player.id, line)
    .first();
  if (done)
    return {
      ok: true,
      repeat: true,
      region,
      back: Number(done.amount),
      ...(await castleViewOf(db, g, Number(a.me.rank), nowS)),
    };
  if (!castleRegionOk(region)) return { error: 'castle-none' };
  if (!castleMay(Number(a.me.rank), 'sell')) return { error: 'guild-rank' };
  await releaseCastles(db, nowS, g); // a castle already lost with its region is released at the lost share, never sold
  const c = await db
    .prepare('SELECT paid FROM guild_castles WHERE region = ?1 AND guild_id = ?2')
    .bind(region, g)
    .first();
  if (!c) return { error: 'castle-not-yours' };
  if (await overRate(ctx, `castle:${player.id}`, CASTLE_OPS_HOUR, 3600)) return { error: 'guild-rate' };
  const back = castleSaleRefund(Number(c.paid));
  await db.batch([
    // THE DECISION: the Guildmaster still, the castle still the guild's and its region still held (AUDIT DOMAINS S6: a crown
    // lost between the release above and this batch is the lost share's, never the sale's) - the share home, as much as
    // the treasury holds room for, and never a line of nothing (AUDIT DOMAINS S4: a full treasury's zero broke the
    // ledger's CHECK and the sale answered 500; now it is refused `marks-full`, the castle kept)
    db
      .prepare(
        `${INSERT_LINE} SELECT 'mint', NULL, 'guild', ?1, 'castle-sale', MIN(?3, ?4 - COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0)), ?5, ?6, ?7, ?8, ?9
      WHERE EXISTS (SELECT 1 FROM guild_castles c WHERE c.region = ?2 AND c.guild_id = ?1 AND ${HELD_SQL('c')})
        AND MIN(?3, ?4 - COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0)) > 0
        AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?10 AND guild_id = ?1 AND rank IN (${CASTLE_POWERS.sell.join(', ')}))
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?7 AND rid = ?9)`,
      )
      .bind(g, region, back, MARKS_MAX, utcDay(nowS), nowS, player.id, displayName(player), line, Number(a.me.rid)),
    db
      .prepare(
        'DELETE FROM guild_castles WHERE region = ?1 AND guild_id = ?2 AND EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?3 AND rid = ?4)',
      )
      .bind(region, g, player.id, line),
  ]);
  const sold = await db
    .prepare('SELECT amount FROM marks_ledger WHERE actor = ?1 AND rid = ?2')
    .bind(player.id, line)
    .first();
  if (!sold) {
    await releaseCastles(db, nowS, g); // the region lost meanwhile: released at the lost share, never sold
    if (await db.prepare('SELECT 1 FROM guild_castles WHERE region = ?1 AND guild_id = ?2').bind(region, g).first())
      return { error: 'marks-full' };
    return { error: 'castle-not-yours' };
  }
  return { ok: true, region, back: Number(sold.amount), ...(await castleViewOf(db, g, Number(a.me.rank), nowS)) };
}
