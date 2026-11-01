// @ts-check
// GUILD-SHOP (2026-10-30; bible/11-Multiplayer/Guild-Shop.md) - THE GUILD SHOP ON THE SERVICE. A ware is bought in
// silver: an account's own (the Insignia Armlet, the Guild Crest, the Guild Sailcloth) from the buyer's balance by any
// member, a guild's (its hall's furniture) from the guild's treasury by its guildmaster. Each purchase is a row the burn
// is written from in ONE batch with the grant (professions.js buyStock's law), so a request asked again is answered by its
// row and never charged twice. What a ware is lives in src/net/guild/guildShopLaw.js. Not a DFU member.
import { accountKind, displayName, overRate, mintId } from './accounts.js';
import { marksOpenFor } from './marks.js';
import { guildActorOf, guildPowersOfRow } from './guilds.js';
import { heraldryOfRow } from './halls.js';
import { holdsAll } from './titles.js'; // AUDIT GUILD-SHOP S9: an Admin holds every ware
import { MARKS_RID_RE, utcDay } from '../../src/net/marksLaw.js';
import { GUILD_OPS_MAX, GUILD_OPS_WINDOW_S, GUILD_TAG_RE, guildMay } from '../../src/net/guild/guildLaw.js';
import { guildPowerSql } from './guildPowerSql.js'; // GUILD-RANKS: the guild's powers, read in the statement
import {
  GUILD_SHOP_WARES,
  GUILD_FURNITURE_MODELS,
  guildWareOf,
  guildWaresHeld,
} from '../../src/net/guild/guildShopLaw.js';

const INSERT_LINE =
  'INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)';
/** The most tags one arms read names - a frame's drawn peers (armoryPass.js ARMORY_DRAW_MAX) and then some. */
export const GUILD_ARMS_ASK_MAX = 32;

/** A guild's hall pieces of each furniture model, counted over every hall it holds - what its keepers have set down. */
async function placedOf(db, guildId) {
  const marks = GUILD_FURNITURE_MODELS.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT d.model AS model, COUNT(*) AS n FROM home_decor d JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
    WHERE h.guild_id = ? AND d.model IN (${marks}) GROUP BY d.model`,
    )
    .bind(guildId, ...GUILD_FURNITURE_MODELS)
    .all();
  return new Map((rows?.results ?? []).map((r) => [Number(r.model), Number(r.n)]));
}

/**
 * THE SHOP AS THIS MEMBER SEES IT: every ware, its price and who pays; an account ware held or not, a guild ware's count
 * owned, set down and its most. The two balances that pay, where silver is this account's.
 */
async function shopViewOf(db, player, me, env) {
  const held = await heldOf(db, player, env);
  if (!me)
    return {
      shop: {
        open: marksOpenFor(player, env),
        marks: null,
        guildMarks: null,
        buysForGuild: false,
        member: false,
        wares: GUILD_SHOP_WARES.filter((w) => w.payer === 'account').map((w) => ({
          key: w.key,
          kind: w.kind,
          payer: w.payer,
          price: w.price,
          held: held.has(w.key),
        })),
      },
    };
  const owned = new Map(
    (
      (await db.prepare('SELECT ware, owned FROM guild_furniture WHERE guild_id = ?').bind(me.guild_id).all())
        ?.results ?? []
    ).map((r) => [String(r.ware), Number(r.owned)]),
  );
  const placed = await placedOf(db, me.guild_id);
  const open = marksOpenFor(player, env);
  const marks = open
    ? Number((await db.prepare('SELECT balance FROM marks WHERE account = ?').bind(player.id).first())?.balance ?? 0)
    : null;
  const guildMarks = open
    ? Number(
        (await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(me.guild_id).first())?.balance ??
          0,
      )
    : null;
  return {
    shop: {
      open,
      marks,
      guildMarks,
      buysForGuild: guildMay(Number(me.rank), 'shop', guildPowersOfRow(me)), // GUILD-RANKS: as the guild set it
      wares: GUILD_SHOP_WARES.map((w) =>
        w.payer === 'account'
          ? { key: w.key, kind: w.kind, payer: w.payer, price: w.price, held: held.has(w.key) }
          : {
              key: w.key,
              kind: w.kind,
              payer: w.payer,
              price: w.price,
              max: w.max,
              model: w.model,
              owned: owned.get(w.key) ?? 0,
              placed: placed.get(/** @type {number} */ (w.model)) ?? 0,
            },
      ),
    },
  };
}

/** The account's wares held: its bits, and every one for an Admin (titles.js holdsAll - ADMIN-ALL is sold none of them). */
async function heldOf(db, player, env) {
  if (holdsAll(player, env)) return new Set(GUILD_SHOP_WARES.filter((w) => w.payer === 'account').map((w) => w.key));
  const row = await db.prepare('SELECT guild_wares FROM players WHERE id = ?').bind(player.id).first();
  return new Set(guildWaresHeld(Number(row?.guild_wares ?? 0)));
}

/** The shop, read: `{ character }` - a member's. AUDIT GUILD-SHOP N4: a character in no guild reads its account's wares
 *  alone, held or not (the Fleet's sailcloth asks), and buys nothing here. */
export async function guildShopOf(ctx, player, { character } = {}) {
  const a = await guildActorOf(ctx.db, player, character);
  if (a.error === 'no-guild') return { ok: true, ...(await shopViewOf(ctx.db, player, null, ctx.env)) };
  if (a.error) return a;
  return { ok: true, ...(await shopViewOf(ctx.db, player, a.me, ctx.env)) };
}

/**
 * BUY ONE: `{ character, ware, rid }`. An account's ware: any member, once (its bit); a guild's: the guildmaster
 * (GUILD_POWERS.shop), while the guild owns fewer than its most. THE DECISION is the purchase row, written only where the
 * payer holds the price, the room is there and the actor still stands where it did; the burn and the grant are read off
 * that row in the same batch. Asked again, it answers the purchase made, `repeat`.
 * @param {{ db: any, nowS: number, rand: (b: Uint8Array) => void, env?: any }} ctx
 */
export async function buyGuildWare(ctx, player, { character, ware, rid } = {}) {
  const { db, nowS, rand, env } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'guilds-need-account' };
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  if (typeof rid !== 'string' || !MARKS_RID_RE.test(rid)) return { error: 'bad-rid' };
  const w = guildWareOf(ware);
  if (!w) return { error: 'no-ware' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const g = a.me.guild_id,
    acct = w.payer === 'account';
  const had = await db
    .prepare('SELECT ware FROM guild_shop_buys WHERE actor = ? AND rid = ?')
    .bind(player.id, rid)
    .first();
  if (had)
    return had.ware === w.key
      ? { ok: true, repeat: true, ware: w.key, ...(await shopViewOf(db, player, a.me, env)) }
      : { error: 'bad-rid' };
  if (!acct && !guildMay(Number(a.me.rank), 'shop', a.powers)) return { error: 'guild-rank' };
  if (acct && holdsAll(player, env)) return { error: 'guild-ware-held' }; // AUDIT GUILD-SHOP S9: an Admin holds every one
  if (await overRate(ctx, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S)) return { error: 'guild-rate' };
  const n = mintId(rand);
  const pays = acct
    ? 'COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?6'
    : 'COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?5), 0) >= ?6';
  const room = acct
    ? `(SELECT guild_wares FROM players WHERE id = ?1) & ${w.bit} = 0`
    : `COALESCE((SELECT owned FROM guild_furniture WHERE guild_id = ?5 AND ware = ?3), 0) < ${w.max}`;
  const ranked = acct ? '' : ` AND ${guildPowerSql('shop', 'rank', '?5')}`; // GUILD-RANKS: any member buys their own; the hall's, a rank the guild lets
  try {
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO guild_shop_buys (actor, rid, ware, payer, guild_id, price, at, n)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE ${pays} AND ${room}
          AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?9 AND guild_id = ?5 AND player = ?1${ranked})
          AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2 || ':shop')`,
        )
        .bind(player.id, rid, w.key, w.payer, g, w.price, nowS, n, Number(a.me.rid)),
      // the silver, burnt off the row this request wrote - the ware named where a burn names nothing else
      db
        .prepare(
          acct
            ? `${INSERT_LINE} SELECT 'account', actor, 'burn', ware, 'guild-shop', price, ?3, at, actor, ?4, rid || ':shop' FROM guild_shop_buys WHERE actor = ?1 AND n = ?2`
            : `${INSERT_LINE} SELECT 'guild', guild_id, 'burn', ware, 'guild-shop', price, ?3, at, actor, ?4, rid || ':shop' FROM guild_shop_buys WHERE actor = ?1 AND n = ?2`,
        )
        .bind(player.id, n, utcDay(nowS), displayName(player)),
      acct
        ? db
            .prepare(
              'UPDATE players SET guild_wares = guild_wares | ?3 WHERE id = ?1 AND EXISTS (SELECT 1 FROM guild_shop_buys WHERE actor = ?1 AND n = ?2)',
            )
            .bind(player.id, n, w.bit)
        : db
            .prepare(
              `INSERT INTO guild_furniture (guild_id, ware, owned) SELECT guild_id, ware, 1 FROM guild_shop_buys WHERE actor = ?1 AND n = ?2
            ON CONFLICT (guild_id, ware) DO UPDATE SET owned = owned + 1`,
            )
            .bind(player.id, n),
    ]);
  } catch {
    /* AUDIT GUILD-SHOP S11: a batch that landed and whose answer was lost is read below, as any other */
  }
  const row = await db
    .prepare('SELECT n FROM guild_shop_buys WHERE actor = ? AND rid = ?')
    .bind(player.id, rid)
    .first();
  if (row?.n === n) return { ok: true, ware: w.key, paid: w.price, ...(await shopViewOf(db, player, a.me, env)) };
  if (row) return { ok: true, repeat: true, ware: w.key, ...(await shopViewOf(db, player, a.me, env)) };
  return { error: await refusalOf(db, player, a.me, w) };
}

/** Why a purchase landed nothing, read as it stands now. */
async function refusalOf(db, player, me, w) {
  const still = await db
    .prepare(
      'SELECT m.rank, g.ranks, g.powers FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.rowid = ? AND m.guild_id = ? AND m.player = ?',
    )
    .bind(Number(me.rid), me.guild_id, player.id)
    .first();
  if (!still) return 'no-guild';
  if (w.payer === 'account') {
    const p = await db.prepare('SELECT guild_wares FROM players WHERE id = ?').bind(player.id).first();
    if ((Number(p?.guild_wares ?? 0) & w.bit) !== 0) return 'guild-ware-held';
    return 'marks-short';
  }
  if (!guildMay(Number(still.rank), 'shop', guildPowersOfRow(still))) return 'guild-rank';
  const o = await db
    .prepare('SELECT owned FROM guild_furniture WHERE guild_id = ? AND ware = ?')
    .bind(me.guild_id, w.key)
    .first();
  if (Number(o?.owned ?? 0) >= w.max) return 'guild-ware-max';
  return 'guild-marks-short';
}

/**
 * EVERY GUILD'S ARMS BY ITS TAG (`{ tags }`, at most GUILD_ARMS_ASK_MAX): its heraldry and its approved logo, what a
 * face draws for a peer whose token names the tag alone (identityToken.js `gt`) - the Insignia Armlet, the Guild Crest,
 * a ship's sail. Any session's to read: a guild's arms fly on its hall and its banners for anyone to see.
 */
export async function guildArmsOf({ db }, { tags } = {}) {
  const want = [
    ...new Set(Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && GUILD_TAG_RE.test(t)) : []),
  ].slice(0, GUILD_ARMS_ASK_MAX);
  if (!want.length) return { arms: {} };
  const rows = await db
    .prepare(
      `SELECT g.tag, g.name, g.heraldry, l.id AS logo FROM guilds g
    LEFT JOIN guild_logos l ON l.id = g.logo AND l.state = 'approved' WHERE g.tag IN (${want.map(() => '?').join(', ')})`,
    )
    .bind(...want)
    .all();
  /** @type {Record<string, any>} */
  const arms = {};
  for (const r of rows?.results ?? [])
    arms[r.tag] = { name: r.name, heraldry: heraldryOfRow(r.heraldry), logo: r.logo ?? null };
  return { arms };
}
