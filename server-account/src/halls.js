// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1d (2026-09-30, Mac: "Lets do this") - A GUILD'S HALL AND ITS
// HERALDRY, AS THE SERVICE KEEPS THEM (bible/11-Multiplayer/
// Seats-Arc.md 8; the law both ends read is src/net/hallLaw.js and
// src/net/heraldryLaw.js).
//
// ═══ A HALL IS A HOME THE GUILD OWNS ═══════════════════════════════
//
// The record's decision (Seats-Arc 8.2): a guild owns ONE home as its
// hall, bought from its gold treasury at the home's price and half
// again, owned by the guild - never a character. Its row is a row of
// the homes table (HOME1's one owner a building, server-wide), naming
// the guild (`guild_id`) and carrying the guild's own mark where a
// home names its character (hallLaw.js guildHallOwner) - so no
// character's path reaches it: a home's sale, its entry, its rooms and
// its outside each name a character, and the mark is none. Its decor
// is the Officers' (decor.js OWNS).
//
// ═══ THE TREASURY PAYS, AND ONLY WHAT RECORDS PAID IN ══════════════
//
// A hall is bought out of the part of the treasury realm records put
// in (`realm_gold`, AUDIT REALM L1-F3), and its sale pays the deed
// share back into that part - so a hall is never a road from gold a
// client named to gold a record holds. Bought and sold, the treasury
// moves in ONE batch with the hall's row, each guarded; both or
// neither. The ledger names why (`hall`, `hall-sale` - migration
// 0043's `moved_kind`).
//
// ═══ HERALDRY ══════════════════════════════════════════════════════
//
// Two colours and a device, the guildmaster's. The first choice is
// free; every change after it burns HERALDRY_CHANGE_DRAKES from the
// guild's Drake treasury, its line and the change in one batch. The
// request's id makes a change asked twice one line (marks.js).
// AUDIT-SEATS S10: a change is refused in a week the guild fights a
// battle for a seat (Seats-Arc 8.1's "siege week").
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { displayName, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { marksOpenFor } from './marks.js';
import { mustChange } from './realm.js';
import { GUILD_TREASURY_MAX, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S } from '../../src/net/guildLaw.js';
import { GUILD_HALL_ENTRY_DEFAULT, HALL_POWERS, hallMay, guildHallPrice, guildHallEntryOk, guildHallOwner } from '../../src/net/hallLaw.js';
import { HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S, homeMapIdOk, homeBuildingKeyOk, homeRegionOk, homePriceOk, homeSaleRefund, homeInArenaCell } from '../../src/net/homeLaw.js';   // ARENA4b: the arena's cell
import { HERALDRY_CHANGE_DRAKES, heraldryOf, heraldrySame } from '../../src/net/heraldryLaw.js';
import { MARKS_RID_RE, utcDay } from '../../src/net/marksLaw.js';
import { seatWeekOf } from '../../src/net/townSeatLaw.js';   // AUDIT-SEATS S10: a siege week refuses a change

/** A guild's hall, as its members read it - or null. */
export async function hallViewOf(db, guildId) {
  const h = await db.prepare('SELECT map_id, building_key, region, entry, price, paid, bought_at FROM homes WHERE guild_id = ?').bind(guildId).first();
  return h ? { mapId: h.map_id, buildingKey: h.building_key, region: h.region, entry: h.entry, price: h.price, paid: h.paid, boughtAt: h.bought_at } : null;
}

/** A guild's heraldry as it keeps it - or null for none (or a row the law would refuse). */
export function heraldryOfRow(raw) {
  if (typeof raw !== 'string') return null;
  try { return heraldryOf(JSON.parse(raw)); } catch { return null; }
}

/** The pieces a hall holds and half of what records paid for them - what its sale gives back for them (homes.js's
 *  realm sale's own sum). */
const piecesBackOf = async (db, mapId, buildingKey) => db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(paid), 0) AS paid,
    COALESCE(SUM(CASE WHEN json_valid(place) THEN paid / 2 ELSE 0 END), 0) AS back FROM home_decor WHERE map_id = ? AND building_key = ?`).bind(mapId, buildingKey).first();

/**
 * BUY A HALL - the guildmaster's, for a guild that holds none, at a building nobody owns: the treasury pays the home's
 * price and half again out of what records paid in, in the claim's own batch. `price` is the home's own (Daggerfall's
 * bank's, the client's word as a home's claim takes it - HOME1); the hall costs guildHallPrice of it. A claim sent again
 * after a lost answer finds the building already this guild's hall and is answered as the claim.
 * @param {{db: any, nowS: number}} ctx
 */
export async function buyHall(ctx, player, { character, mapId, buildingKey, region, price } = {}) {
  const { db, nowS } = ctx;
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!hallMay(a.me.rank, 'hall')) return { error: 'guild-rank' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || !homeRegionOk(region) || !homePriceOk(price)) return { error: 'bad-home' };
  if (homeInArenaCell(mapId, buildingKey)) return { error: 'home-arena' };   // ARENA4b: the arena stands there - a build from before it still stands GEMSAL03 (homes.js claimHome's guard)
  const gid = a.me.guild_id;
  const held = await db.prepare('SELECT guild_id FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  if (held) return held.guild_id === gid ? { ok: true, repeat: true, hall: await hallViewOf(db, gid) } : { error: 'home-taken' };
  if (await overRate({ db, nowS }, `home:${player.id}`, HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S)) return { error: 'home-rate' };
  const cost = guildHallPrice(price);
  const who = displayName(player);
  const g = await db.prepare('SELECT name FROM guilds WHERE id = ?').bind(gid).first();
  try {
    await db.batch([
      // the treasury pays - by what records paid in, while the guild holds no hall and the buyer is still its guildmaster
      db.prepare(`UPDATE guilds SET treasury = treasury - ?1, realm_gold = realm_gold - ?1, moved_by = ?2, moved_at = ?3, moved_kind = 'hall'
        WHERE id = ?4 AND treasury >= ?1 AND realm_gold >= ?1 AND NOT EXISTS (SELECT 1 FROM homes WHERE guild_id = ?4)
          AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?5 AND guild_id = ?4 AND rank = ?6)`).bind(cost, who, nowS, gid, a.me.rid, a.me.rank),
      mustChange(db),
      // ...and the building is the guild's: a building somebody owns is the primary key's refusal, and the batch goes back
      db.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, guild_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(mapId, buildingKey, player.id, guildHallOwner(gid), g?.name ?? '', region, GUILD_HALL_ENTRY_DEFAULT, price, nowS, cost, gid),
    ]);
  } catch {
    // say which guard held - AUDIT GUILD1d S5: the same claim, raced by itself, is the claim that landed
    const now = await db.prepare('SELECT guild_id FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
    if (now) return now.guild_id === gid ? { ok: true, repeat: true, hall: await hallViewOf(db, gid) } : { error: 'home-taken' };
    if (await db.prepare('SELECT 1 FROM homes WHERE guild_id = ?').bind(gid).first()) return { error: 'guild-hall-have' };
    const t = await db.prepare('SELECT treasury, realm_gold FROM guilds WHERE id = ?').bind(gid).first();
    if (!t) return { error: 'no-guild' };
    if (t.treasury < cost) return { error: 'guild-treasury-short' };
    if (t.realm_gold < cost) return { error: 'guild-treasury-old' };
    return { error: 'guild-rank' };   // the guild was handed on meanwhile
  }
  const t = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(gid).first();
  return { ok: true, hall: await hallViewOf(db, gid), cost, treasury: t?.treasury ?? 0 };
}

/**
 * SELL THE HALL - the guildmaster's: the building free again, its placed pieces gone with it (the table's cascade),
 * and the deed share of what the treasury paid (homeLaw.js homeSaleRefund) with half of what records paid for its pieces
 * paid back into the treasury - into what records paid in - in the same batch, both or neither. The batch holds the
 * hall and its pieces as they were read, so a piece placed between the read and the sale is never sold unpaid.
 * @param {{db: any, nowS: number}} ctx
 */
export async function sellHall(ctx, player, { character } = {}) {
  const { db, nowS } = ctx;
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!hallMay(a.me.rank, 'hall')) return { error: 'guild-rank' };
  const gid = a.me.guild_id;
  const h = await db.prepare('SELECT * FROM homes WHERE guild_id = ?').bind(gid).first();
  if (!h) return { error: 'guild-hall-none' };
  if (await overRate({ db, nowS }, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S)) return { error: 'guild-rate' };
  const p = await piecesBackOf(db, h.map_id, h.building_key);
  const refund = homeSaleRefund(Math.max(0, Number(h.paid) || 0));
  const piecesBack = Math.max(0, Number(p?.back) || 0);
  const back = refund + piecesBack;
  try {
    await db.batch([
      db.prepare(`DELETE FROM homes WHERE map_id = ?1 AND building_key = ?2 AND guild_id = ?3 AND paid = ?4
        AND (SELECT COUNT(*) FROM home_decor WHERE map_id = ?1 AND building_key = ?2) = ?5
        AND (SELECT COALESCE(SUM(paid), 0) FROM home_decor WHERE map_id = ?1 AND building_key = ?2) = ?6
        AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?7 AND guild_id = ?3 AND rank = ?8)`)
        .bind(h.map_id, h.building_key, gid, h.paid, Number(p?.n) || 0, Number(p?.paid) || 0, a.me.rid, a.me.rank),
      mustChange(db),
      ...(back > 0 ? [
        db.prepare(`UPDATE guilds SET treasury = treasury + ?1, realm_gold = realm_gold + ?1, moved_by = ?2, moved_at = ?3, moved_kind = 'hall-sale'
          WHERE id = ?4 AND treasury + ?1 <= ?5`).bind(back, displayName(player), nowS, gid, GUILD_TREASURY_MAX),
        mustChange(db),
      ] : []),
    ]);
  } catch {
    if (!(await db.prepare('SELECT 1 FROM homes WHERE guild_id = ?').bind(gid).first())) return { error: 'guild-hall-none' };
    const t = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(gid).first();
    if (t && t.treasury + back > GUILD_TREASURY_MAX) return { error: 'guild-treasury-full' };
    return { error: 'guild-hall-moved' };   // a piece placed or moved, or the guild handed on, meanwhile: look again
  }
  const t = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(gid).first();
  return { ok: true, refund, decorCount: Number(p?.n) || 0, decorBack: piecesBack, back, treasury: t?.treasury ?? 0 };
}

/**
 * WHO MAY WALK INTO THE HALL - its members (`guild`) or anyone (`public`): the guildmaster's or an Officer's.
 * @param {{db: any, nowS: number}} ctx
 */
export async function setHallEntry(ctx, player, { character, entry } = {}) {
  const { db, nowS } = ctx;
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!hallMay(a.me.rank, 'hallEntry')) return { error: 'guild-rank' };
  if (!guildHallEntryOk(entry)) return { error: 'bad-entry' };
  if (await overRate({ db, nowS }, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S)) return { error: 'guild-rate' };
  // AUDIT GUILD1d S7: the rank asked in the write too - an Officer demoted since the read turns nothing
  const r = await db.prepare(`UPDATE homes SET entry = ?1 WHERE guild_id = ?2
    AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?3 AND guild_id = ?2 AND rank IN (${HALL_POWERS.hallEntry.join(', ')}))`).bind(entry, a.me.guild_id, a.me.rid).run();
  if (r?.meta?.changes) return { ok: true, entry };
  return { error: (await db.prepare('SELECT 1 FROM homes WHERE guild_id = ?').bind(a.me.guild_id).first()) ? 'guild-rank' : 'guild-hall-none' };
}

/**
 * THE GUILD'S HERALDRY - the guildmaster's. The first is free; a change burns HERALDRY_CHANGE_DRAKES from the guild's
 * Drake treasury (where Drakes are this account's - the service's switch), its line and the change in ONE batch, the
 * change only from the heraldry the guildmaster saw (`was` - the guild's row as read). A change asked again under its
 * request id is answered as made.
 * @param {{db: any, nowS: number, env?: any}} ctx
 */
export async function setHeraldry(ctx, player, { character, heraldry, rid } = {}) {
  const { db, nowS, env } = ctx;
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!hallMay(a.me.rank, 'heraldry')) return { error: 'guild-rank' };
  const next = heraldryOf(heraldry);
  if (!next) return { error: 'bad-heraldry' };
  const gid = a.me.guild_id;
  const paidLine = typeof rid === 'string' && MARKS_RID_RE.test(rid)
    ? await db.prepare("SELECT kind FROM marks_ledger WHERE actor = ? AND rid = ?").bind(player.id, rid).first() : null;
  const row = await db.prepare('SELECT heraldry FROM guilds WHERE id = ?').bind(gid).first();
  const was = heraldryOfRow(row?.heraldry);
  // asked again: the line it made - AUDIT GUILD1d S4: whatever the heraldry is now (a later change may stand over it)
  if (paidLine) return paidLine.kind === 'heraldry' ? { ok: true, repeat: true, heraldry: was } : { error: 'marks-rid' };
  if (heraldrySame(was, next)) return { error: 'heraldry-same' };
  // AUDIT-SEATS S10 (Seats-Arc 8.1: "changing either costs 500 Marks and is refused in a siege week"): a CHANGE, while the
  // guild is a side of a battle for a seat this seat week (a siege or a Tourney - its banners on the field and the HUD; one
  // its Turning voided is none) - asked here and again in the write. DECIDED: the first choice, free, is no change, and
  // stands (a guild with no heraldry fights under plain colours either way)
  const week = seatWeekOf(nowS * 1000);
  const noBattle = `NOT EXISTS (SELECT 1 FROM town_seat_battles WHERE week = ${week} AND (attacker = guilds.id OR defender = guilds.id) AND state <> 'void')`;
  const inBattle = async () => !!(await db.prepare("SELECT 1 FROM town_seat_battles WHERE week = ? AND (attacker = ? OR defender = ?) AND state <> 'void'").bind(week, gid, gid).first());
  if (was && await inBattle()) return { error: 'heraldry-siege' };
  if (await overRate({ db, nowS }, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S)) return { error: 'guild-rate' };
  const json = JSON.stringify(next);
  // AUDIT GUILD1d S7: the guildmaster's still, in the write - one handed the guild on since the read changes nothing
  const stillMaster = `EXISTS (SELECT 1 FROM guild_members WHERE rowid = ${Number(a.me.rid)} AND guild_id = guilds.id AND rank IN (${HALL_POWERS.heraldry.join(', ')}))`;
  const whyNot = async () => ((await db.prepare(`SELECT ${stillMaster.replace('guilds.id', '?')} AS m`).bind(gid).first())?.m ? 'heraldry-moved' : 'guild-rank');
  if (!was) {
    // the first: free, and only while the guild still has none
    const r = await db.prepare(`UPDATE guilds SET heraldry = ? WHERE id = ? AND heraldry IS NULL AND ${stillMaster}`).bind(json, gid).run();
    return r?.meta?.changes ? { ok: true, heraldry: next, cost: 0 } : { error: await whyNot() };
  }
  if (typeof rid !== 'string' || !MARKS_RID_RE.test(rid)) return { error: 'marks-rid' };
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  try {
    await db.batch([
      db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'guild', ?1, 'burn', NULL, 'heraldry', ?2, ?3, ?4, ?5, ?6, ?7
        WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2
          AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?5 AND rid = ?7)`)
        .bind(gid, HERALDRY_CHANGE_DRAKES, utcDay(nowS), nowS, player.id, displayName(player), rid),
      mustChange(db),
      db.prepare(`UPDATE guilds SET heraldry = ? WHERE id = ? AND heraldry = ? AND ${stillMaster} AND ${noBattle}`).bind(json, gid, row.heraldry),
      mustChange(db),
    ]);
  } catch {
    // AUDIT GUILD1d S4: the same change raced by itself - its line is the one that landed
    const landed = await db.prepare('SELECT kind FROM marks_ledger WHERE actor = ? AND rid = ?').bind(player.id, rid).first();
    if (landed?.kind === 'heraldry') return { ok: true, repeat: true, heraldry: heraldryOfRow((await db.prepare('SELECT heraldry FROM guilds WHERE id = ?').bind(gid).first())?.heraldry) };
    if (await inBattle()) return { error: 'heraldry-siege' };   // AUDIT-SEATS S10: a Turning placed a battle meanwhile
    const bal = await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(gid).first();
    return { error: Number(bal?.balance ?? 0) < HERALDRY_CHANGE_DRAKES ? 'heraldry-drakes' : await whyNot() };
  }
  return { ok: true, heraldry: next, cost: HERALDRY_CHANGE_DRAKES };
}
