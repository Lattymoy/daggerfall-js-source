// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DOMAIN1 (2026-10-24, the owner: "Allowing guild mates to contribute to
// town material storage with gathered items/their store") - A GIFT TO THE
// TOWN, AS THE SERVICE KEEPS IT (bible/11-Multiplayer/Domains.md section
// 5; the numbers and words are src/net/seatGiftLaw.js, which the client
// reads too).
//
// ═══ WHERE A GIFT GOES ══════════════════════════════════════════════
//
// The service finds it, never the client: in the board's region, the
// seat the giver's guild HOLDS (its stockpile), or else the seat it
// PLEDGED this seat week (its Siege Camp). A guild holds at most one seat
// a region and pledges at most one, and a held region is pledged by its
// Charter (seatInfluence.js pledgeSeat's `seat-held-here`), so the place
// is one.
//
// ═══ A DELIVERY WITH NO PAY ═════════════════════════════════════════
//
// PROF1's law, whole, as every act of writs.js: one `db.batch` whose
// FIRST statement writes the gift's row with a fresh nonce only where
// every condition holds against the rows as they stand - the character
// still its guild's, the place still the guild's (writs.js
// SEAT_WRIT_LIVE_SQL's rule), the units spendable in its Stores (own and
// bought, never gold's or loose - GOLD-MARKET, BAG-CRAFT) - and every
// statement after it moves units only where that row carries this
// request's nonce. A request asked twice is one: its row answers it,
// `repeat`. After the batch, the influence is credited as a seat writ's
// delivery is (seatInfluence.js creditSeatWrit, keyed on the gift), so
// it counts once and only for a counting member; and the answer reads
// the stockpile through the works' own read (seatForts.js fortsOf), which
// moves what the projects need into them first, as a writ's delivery's
// supplyForts does.
//
// Behind SEATS_OPEN and PROFESSIONS_OPEN both (the seats', the Stores').
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, mintId, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { profOpenFor, spendStatements, spendableSql, storeOf } from './professions.js';
import { realmHoldOf } from './realm.js';
import { seatsOpenFor } from './townSeats.js';
import { fortsOf } from './seatForts.js'; // the works' read - it moves the stockpile into their projects first (supplyForts)
import { creditSeatWrit } from './seatInfluence.js';
import { CHAR_ID_RE } from './service.js';
import { material } from '../../src/net/nodeLaw.js';
import { seatRegionOk } from '../../src/net/townSeatLaw.js';
import { seatWeek, WRIT_RID_RE, WRIT_OPS_MAX, WRIT_WINDOW_S } from '../../src/net/writLaw.js';
import { giftUnitsOk, giftMaterialOk, GIFTS_SHOWN } from '../../src/net/seatGiftLaw.js';

const charOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);
/** The writs' own bucket (writs.js `acting`): a gift is a move of the Stores as a delivery is. */
const acting = (ctx, player) => overRate(ctx, `writ:${player.id}`, WRIT_OPS_MAX, WRIT_WINDOW_S);

/**
 * WHERE GUILD `g` GIVES IN `region` this seat week - `{ place, key }` (the seat it holds: its stockpile; else the seat it
 * pledged: its Siege Camp), or null.
 */
export async function giftPlaceOf(db, g, region, week) {
  const held = await db
    .prepare('SELECT key FROM town_seat_holds WHERE guild_id = ?1 AND region = ?2 ORDER BY key LIMIT 1')
    .bind(g, region)
    .first();
  if (held) return { place: 'stockpile', key: Number(held.key) };
  const pledged = await db
    .prepare('SELECT key FROM town_seat_pledges WHERE week = ?1 AND guild_id = ?2 AND region = ?3 LIMIT 1')
    .bind(week, g, region)
    .first();
  return pledged ? { place: 'camp', key: Number(pledged.key) } : null;
}

/** What the place holds: the stockpile's `[[material, qty]]`, or the guild's Siege Camp's this week. */
async function contentsOf(db, at, g, week, nowS) {
  if (at.place === 'stockpile') return (await fortsOf(db, at.key, nowS)).stockpile;
  const { results = [] } = await db
    .prepare(
      'SELECT material, qty FROM town_seat_camps WHERE week = ?1 AND key = ?2 AND guild_id = ?3 AND qty > 0 ORDER BY material',
    )
    .bind(week, at.key, g)
    .all();
  return results.map((r) => [r.material, Number(r.qty)]);
}
/** The last gifts there by guild `g`'s members, newest first: `[{ who, material, units, at }]` - a camp's this week alone. */
async function recentOf(db, at, g, week) {
  const { results = [] } = await db
    .prepare(
      `SELECT who, material, units, at FROM town_seat_gifts
    WHERE key = ?1 AND guild_id = ?2 AND camp = ?3 AND (?3 = 0 OR week = ?4) ORDER BY at DESC, rowid DESC LIMIT ?5`,
    )
    .bind(at.key, g, at.place === 'camp' ? 1 : 0, week, GIFTS_SHOWN)
    .all();
  return results.map((r) => ({ who: r.who, material: r.material, units: Number(r.units), at: Number(r.at) }));
}

/** The first doors: a registered account, the switches, its character. */
function shut(player, env, character) {
  if (accountKind(player) !== 'linked') return { error: 'prof-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!profOpenFor(player, env)) return { error: 'prof-closed' };
  if (!charOk(character)) return { error: 'prof-character' };
  return null;
}

/**
 * THE GIFTS' VIEW: `{ character, region }` - where this character's guild gives in `region` (`place` 'stockpile' or
 * 'camp', the seat's `key`, or `place` null), what is there, and its members' last gifts.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function readGifts({ db, nowS }, player, env, { character, region } = {}) {
  const refused = shut(player, env, character);
  if (refused) return refused;
  if (!seatRegionOk(region)) return { error: 'bad-region' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const g = a.me.guild_id,
    week = seatWeek(nowS);
  const at = await giftPlaceOf(db, g, region, week);
  if (!at) return { ok: true, place: null, region };
  return {
    ok: true,
    region,
    ...at,
    contents: await contentsOf(db, at, g, week, nowS),
    recent: await recentOf(db, at, g, week),
  };
}

/**
 * A GIFT: `{ character, region, material, units, rid }` - any member's, any rank, from the character's Stores (bought
 * first, as every spend), into its guild's stockpile in `region` or its Siege Camp there this week. Answers the gift,
 * the Stores' count after it, the place as readGifts says it and the influence it counted (`counted`, `why`).
 * @param {{ db: any, nowS: number, rand?: () => number }} ctx
 */
export async function giveToSeat(ctx, player, env, { character, region, material: key, units, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = shut(player, env, character);
  if (refused) return refused;
  if (typeof rid !== 'string' || !WRIT_RID_RE.test(rid)) return { error: 'prof-rid' };
  const me = player.id;
  const answer = async (row, extra = {}) => {
    const week = Number(row.week),
      at = { place: Number(row.camp) === 1 ? 'camp' : 'stockpile', key: Number(row.key) };
    return {
      ok: true,
      ...extra,
      gift: { material: row.material, units: Number(row.units), own: Number(row.own), place: at.place, key: at.key },
      store: await storeOf(db, me, row.char_id, row.material),
      region: Number(row.region),
      ...at,
      contents: await contentsOf(db, at, row.guild_id, week, nowS),
      recent: await recentOf(db, at, row.guild_id, week),
    };
  };
  const prior = await db.prepare('SELECT * FROM town_seat_gifts WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  if (!seatRegionOk(region)) return { error: 'bad-region' };
  if (!giftUnitsOk(units)) return { error: 'bad-units' };
  if (!material(key)) return { error: 'bad-material' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const g = a.me.guild_id,
    week = seatWeek(nowS);
  const at = await giftPlaceOf(db, g, region, week);
  if (!at) return { error: 'seat-none-here' };
  if (!giftMaterialOk(key, at.place)) return { error: 'bad-material' };
  // AUDIT CRAFT-HOLD's rule, as the guild Stores' deposit: a held character's Stores go to no guild's ends
  const held = await realmHoldOf(db, me, character);
  if (held) return held;
  if (await acting(ctx, player)) return { error: 'writ-rate' };
  const camp = at.place === 'camp' ? 1 : 0;
  const nonce = mintId(rand);
  const made = 'EXISTS (SELECT 1 FROM town_seat_gifts WHERE player = ?1 AND rid = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION: still a member of the guild, the place still its own (held; or pledged this week), the units
    // spendable in the Stores - the own share what the bought units cannot cover (bought go first)
    db
      .prepare(
        `INSERT OR IGNORE INTO town_seat_gifts (player, rid, char_id, guild_id, key, camp, week, region, material, units, own, who, at, n)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
        MAX(0, ?10 - COALESCE((SELECT qty FROM prof_stores WHERE player = ?1 AND char_id = ?3 AND material = ?9 AND origin = 'bought'), 0)), ?11, ?12, ?13
      WHERE EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?3 AND guild_id = ?4)
        AND ((?6 = 0 AND EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?5 AND guild_id = ?4))
          OR (?6 = 1 AND EXISTS (SELECT 1 FROM town_seat_pledges WHERE week = ?7 AND key = ?5 AND guild_id = ?4)))
        AND ${spendableSql('?1', '?3', '?9')} >= ?10   -- GOLD-MARKET: never gold's units; BAG-CRAFT: never loose`,
      )
      .bind(me, rid, character, g, at.key, camp, week, region, key, units, displayName(player), nowS, nonce),
    // the giver's units out, bought first
    ...spendStatements(db, {
      player: me,
      character,
      materialSql: '?3',
      qtySql: '?4',
      guard: made,
      binds: [key, units, rid, nonce],
    }),
    // into the place
    camp === 1
      ? db
          .prepare(
            `INSERT INTO town_seat_camps (week, key, guild_id, material, qty)
          SELECT week, key, guild_id, material, units FROM town_seat_gifts WHERE player = ?1 AND rid = ?2 AND n = ?3
          ON CONFLICT (week, key, guild_id, material) DO UPDATE SET qty = town_seat_camps.qty + excluded.qty`,
          )
          .bind(me, rid, nonce)
      : db
          .prepare(
            `INSERT INTO town_seat_stockpile (key, material, qty)
          SELECT key, material, units FROM town_seat_gifts WHERE player = ?1 AND rid = ?2 AND n = ?3
          ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`,
          )
          .bind(me, rid, nonce),
  ]);
  const row = await db.prepare('SELECT * FROM town_seat_gifts WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  if (row?.n === nonce) {
    const own = Number(row.own);
    const credit = await creditSeatWrit(ctx, player, env, {
      character,
      key: at.key,
      region,
      guild: g,
      own,
      bought: units - own,
      value: material(key)?.value ?? 0,
      ref: `gift:${me}:${rid}`,
    });
    return answer(row, { counted: !!credit.counted, ...(credit.counted ? {} : { why: credit.why }) });
  }
  if (row) return answer(row, { repeat: true });
  // nothing written: say why, in the decision's order
  if (
    !(await db
      .prepare('SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?2 AND guild_id = ?3')
      .bind(me, character, g)
      .first())
  )
    return { error: 'no-guild' };
  if (!(await giftPlaceOf(db, g, region, week))) return { error: 'seat-none-here' };
  const has = await storeOf(db, me, character, key);
  return { error: has.own + has.bought + (has.gold ?? 0) >= units ? 'stores-gold' : 'stores-short' };
}
