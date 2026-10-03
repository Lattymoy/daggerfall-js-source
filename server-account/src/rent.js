// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-RENT (2026-09-30) - A HOME'S ROOMS, RENTED TO OTHER PLAYERS.
//
// Asked: "For houses with multiple rooms, the owner can choose to rent
// out to other players and adjust the price as needed". The shapes and
// bounds are src/net/homeLaw.js (RENT_*), which the client reads too; the
// table is migrations/0037_home_rooms.sql.
//
// ═══ THE OWNER OFFERS, THE TENANT RENTS, THE OWNER COLLECTS ═════════
//
// OFFER: the home's owner (its account AND its character - decor.js's
// own OWNS) names a room by its number and a point in it, at a price a
// day. Offered again, the price and the point change; a tenancy already
// paid keeps what it paid. Taken off the offer, a running tenancy stays
// until its days run out; a room with none goes.
//
// RENT: another REGISTERED account's REALM character (a house is a realm
// character's - AUDIT REALM2 S2 - and so is the gold that pays for a
// room) takes a room for some days: its record pays the days' price by
// the wallet's own order (the home's region's account last, as the home
// was paid) in ONE batch with the room's tenancy and the rent held on the
// home - both or neither, the record asked first (realm.js realmActFirst),
// so a rent sent again after a lost answer is read as landed. The price
// the tenant saw must be the price that stands (`rent-price`, with the
// price, when the owner changed it). A room is the tenant's own to renew;
// anyone else's while its days run is `rent-taken`. Never the owner's own
// account (`rent-own`): a player moving gold between their own characters
// through their own house is no tenancy. RENT_HELD_MAX rooms a character.
//
// COLLECT: the rent is HELD ON THE HOME (`homes.rent_due`), never paid
// into the owner's record - a record moves only with its own tab's lease
// and sequence (realm.js prepareRealmRecord), and an owner may be asleep
// for a week. The owner collects it into their record's bank account in
// the home's region (as a sale pays; the purse when it has none), all of it,
// in one batch, as a guildmaster takes gold out of a treasury (guilds.js
// realmTreasury). A house is not sold while a tenancy runs (homes.js).
//
// Every write names the owner in its WHERE (decor.js OWNS), so another's
// home is exactly as absent as none (`no-home`).
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { prepareRealmRecord, realmActFirst, recordMovedOf, mustChange, dropObjects, dropIfUnnamed, REALM_ID_RE } from './realm.js';
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';
import {
  homeMapIdOk, homeBuildingKeyOk, RENT_ROOMS_MAX, RENT_HELD_MAX, RENT_WRITES_MAX, RENT_WRITES_WINDOW_S,
  rentRoomOk, rentPriceOk, rentDaysOk, rentAnchorOf, rentCost, rentUntil, RENT_ANCHOR_MOVED,
} from '../../src/net/homeLaw.js';

/** The home is the caller's character's: map, key, account, character (decor.js's own). */
const OWNS = 'EXISTS (SELECT 1 FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND char_id = ?)';

/** The shared first steps of an owner's write: a registered account, a home named, a realm character, the hour. */
async function ownerDoor({ db, nowS }, player, { mapId, buildingKey, character }) {
  if (accountKind(player) !== 'linked') return 'homes-need-account';
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return 'bad-home';
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return 'home-character';
  if (!REALM_ID_RE.test(character)) return 'realm-only';
  if (await overRate({ db, nowS }, `rent:${player.id}`, RENT_WRITES_MAX, RENT_WRITES_WINDOW_S)) return 'rent-rate';
  return null;
}

const anchorOfRow = (text) => { try { return rentAnchorOf(JSON.parse(text)); } catch { return null; } };

/**
 * A HOME'S ROOMS, for anyone standing at its door or in it - guests too: each room's number, its point, its price a
 * day, whether it is offered and whether it is taken. The owner is told who holds each and until when, and the rent
 * waiting to be collected; a tenant, their own room's end; everyone else, only taken or free.
 * @param {{db: any, nowS: number}} ctx
 */
export async function roomsOf({ db, nowS }, player, { mapId, buildingKey, character = null } = {}) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  const me = typeof character === 'string' && CHAR_ID_RE.test(character) ? character : null;
  const home = await db.prepare('SELECT player, char_id, owner_name, rent_due, guild_id FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();   // AUDIT GUILD1d S6: and whether it is a guild's hall
  if (!home) return { error: 'no-home' };
  const mine = home.player === player.id && home.guild_id == null;   // AUDIT GUILD1d S6: a hall is no account's, the one that bought it included
  const { results = [] } = await db.prepare(`SELECT room, anchor, price, listed, tenant, tenant_char, tenant_name, until FROM home_rooms
    WHERE map_id = ? AND building_key = ? ORDER BY room LIMIT ?`).bind(mapId, buildingKey, RENT_ROOMS_MAX).all();
  const rooms = [];
  for (const r of results) {
    const anchor = anchorOfRow(r.anchor);
    // ARENA4b: a tenancy the arena's move carried to the new house has no point in its walls (homes.js arenaMoveHome) -
    // said as `anchor: null, moved: true`, so the owner sees it and its tenant sees their own; any other point unread
    const moved = !anchor && r.anchor === RENT_ANCHOR_MOVED;
    if (!anchor && !moved) continue;
    const running = r.tenant != null && r.until > nowS;
    // a tenancy is its CHARACTER's (renewed by it alone - rentRoom): another character of the same account is told only
    // that the room is taken (AUDIT: it was told "yours", and its renewal was refused)
    const theirs = running && r.tenant === player.id && me != null && r.tenant_char === me;
    rooms.push({
      room: r.room, anchor, price: r.price, listed: r.listed === 1, taken: running, ...(moved ? { moved: true } : {}),
      ...(theirs ? { yours: true, character: r.tenant_char } : {}),
      ...(running && (mine || theirs) ? { until: r.until } : {}),
      ...(running && mine ? { tenant: r.tenant_name } : {}),
    });
  }
  return { mapId, buildingKey, owner: home.owner_name, mine, rooms, ...(mine ? { due: Math.max(0, Number(home.rent_due) || 0) } : {}), now: nowS };
}

/**
 * OFFER A ROOM, or change its price or its point - the owner's character's alone. A home offers at most RENT_ROOMS_MAX.
 * @param {{db: any, nowS: number}} ctx
 */
export async function offerRoom(ctx, player, { mapId, buildingKey, character, room, anchor, price } = {}) {
  const { db } = ctx;
  const refused = await ownerDoor(ctx, player, { mapId, buildingKey, character });
  if (refused) return { error: refused };
  const at = rentAnchorOf(anchor);
  if (!rentRoomOk(room) || !at || !rentPriceOk(price)) return { error: 'bad-room' };
  const owns = await db.prepare(`SELECT 1 AS one WHERE ${OWNS}`).bind(mapId, buildingKey, player.id, character).first();
  if (!owns) return { error: 'no-home' };
  // a character whose record holds no save yet (a customs whose first save never landed) offers nothing: undone, its home
  // goes back to the offline character, where rent held on it is no record's to collect (AUDIT)
  const rec = await db.prepare('SELECT bytes FROM realm_characters WHERE id = ? AND player = ?').bind(character, player.id).first();
  if (!(Number(rec?.bytes) > 0)) return { error: 'realm-needed' };
  const r = await db.prepare(`INSERT INTO home_rooms (map_id, building_key, room, anchor, price, listed)
    SELECT ?, ?, ?, ?, ?, 1 WHERE (SELECT COUNT(*) FROM home_rooms WHERE map_id = ? AND building_key = ? AND room != ?) < ?
    ON CONFLICT (map_id, building_key, room) DO UPDATE SET anchor = excluded.anchor, price = excluded.price, listed = 1`)
    .bind(mapId, buildingKey, room, JSON.stringify(at), price, mapId, buildingKey, room, RENT_ROOMS_MAX).run();
  if (!r?.meta?.changes) return { error: 'rent-rooms' };
  return { ok: true, room, anchor: at, price };
}

/**
 * TAKE A ROOM OFF THE OFFER - the owner's. A room nobody rents goes; one whose tenancy still runs stays theirs until its
 * days run out, and is offered to nobody after.
 * @param {{db: any, nowS: number}} ctx
 */
export async function withdrawRoom(ctx, player, { mapId, buildingKey, character, room } = {}) {
  const { db, nowS } = ctx;
  const refused = await ownerDoor(ctx, player, { mapId, buildingKey, character });
  if (refused) return { error: refused };
  if (!rentRoomOk(room)) return { error: 'bad-room' };
  const [gone, kept] = await db.batch([
    db.prepare(`DELETE FROM home_rooms WHERE map_id = ? AND building_key = ? AND room = ? AND (tenant IS NULL OR until <= ?) AND ${OWNS} RETURNING room`)
      .bind(mapId, buildingKey, room, nowS, mapId, buildingKey, player.id, character),
    db.prepare(`UPDATE home_rooms SET listed = 0 WHERE map_id = ? AND building_key = ? AND room = ? AND tenant IS NOT NULL AND until > ? AND ${OWNS} RETURNING until`)
      .bind(mapId, buildingKey, room, nowS, mapId, buildingKey, player.id, character),
  ]);
  if (gone?.results?.length) return { ok: true, room, gone: true };
  const u = kept?.results?.[0]?.until;
  return Number.isSafeInteger(u) ? { ok: true, room, gone: false, until: u } : { error: 'no-rent-room' };
}

/** Why a rent's write found its room changed since it was read (the batch's guard): the owner's new price (with it),
 *  the room off the offer, or somebody else's tenancy. */
export async function roomMovedOf(db, mapId, buildingKey, room, price) {
  const now = await db.prepare('SELECT price, listed FROM home_rooms WHERE map_id = ? AND building_key = ? AND room = ?').bind(mapId, buildingKey, room).first();
  if (!now || now.listed !== 1) return { error: 'no-rent-room' };
  if (now.price !== price) return { error: 'rent-price', price: now.price };
  return { error: 'rent-taken' };
}

/**
 * RENT A ROOM for `days` - another account's realm character, its record paying in the rent's own batch. `price` is
 * the price the tenant was shown. A tenancy of one's own is renewed from its end.
 * @param {{db: any, nowS: number, bucket?: any, rand?: any}} ctx
 */
export async function rentRoom(ctx, player, { mapId, buildingKey, character, room, days, price, realm = null } = {}) {
  const { db, nowS, bucket } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || !rentRoomOk(room) || !rentDaysOk(days) || !rentPriceOk(price)) return { error: 'bad-room' };
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before any other word
  if (side.error) return side;
  if (!side.at) return { error: 'realm-needed' };
  if (await overRate({ db, nowS }, `rent:${player.id}`, RENT_WRITES_MAX, RENT_WRITES_WINDOW_S)) return { error: 'rent-rate' };
  const row = await db.prepare(`SELECT r.price, r.listed, r.tenant, r.tenant_char, r.until, h.player AS owner, h.region
    FROM home_rooms r JOIN homes h ON h.map_id = r.map_id AND h.building_key = r.building_key
    WHERE r.map_id = ? AND r.building_key = ? AND r.room = ?`).bind(mapId, buildingKey, room).first();
  if (!row) return { error: 'no-rent-room' };
  if (row.owner === player.id) return { error: 'rent-own' };
  const running = row.tenant != null && row.until > nowS;
  const renewing = running && row.tenant === player.id && row.tenant_char === character;
  if (running && !renewing) return { error: 'rent-taken' };
  if (row.listed !== 1) return { error: 'no-rent-room' };   // taken off the offer: a tenancy runs out, never renewed (AUDIT)
  if (row.price !== price) return { error: 'rent-price', price: row.price };
  const until = rentUntil(nowS, renewing ? row.until : 0, days);
  if (until == null) return { error: 'rent-long' };
  if (!renewing) {
    const held = await db.prepare('SELECT COUNT(*) AS n FROM home_rooms WHERE tenant = ? AND tenant_char = ? AND until > ?').bind(player.id, character, nowS).first();
    if ((held?.n ?? 0) >= RENT_HELD_MAX) return { error: 'rent-held' };
  }
  const cost = rentCost(price, days);
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (payFromSave(save, cost, row.region) ? null : 'realm-gold'));
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      // the room as it was read: the same price, and free - or this tenant's own - still
      db.prepare(`UPDATE home_rooms SET tenant = ?, tenant_char = ?, tenant_name = ?, until = ?
        WHERE map_id = ? AND building_key = ? AND room = ? AND listed = 1 AND price = ? AND until = ? AND (tenant IS NULL OR until <= ? OR (tenant = ? AND tenant_char = ?))`)
        .bind(player.id, character, displayName(player), until, mapId, buildingKey, room, price, row.until, nowS, player.id, character),
      mustChange(db),
      db.prepare('UPDATE homes SET rent_due = rent_due + ? WHERE map_id = ? AND building_key = ?').bind(cost, mapId, buildingKey),
      mustChange(db),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    return (await recordMovedOf(db, player.id, side.at)) || (await roomMovedOf(db, mapId, buildingKey, room, price));
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, room, until, cost, realm: { seq: prep.seq } };
}

/**
 * COLLECT THE RENT held on the home - the owner's realm character, all of it into their record's purse, in one batch
 * with the home's hold emptied by exactly what it paid.
 * @param {{db: any, nowS: number, bucket?: any, rand?: any}} ctx
 */
export async function collectRent(ctx, player, { mapId, buildingKey, character, realm = null } = {}) {
  const { db, bucket } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'realm-needed' };
  if (await overRate({ db, nowS: ctx.nowS }, `rent:${player.id}`, RENT_WRITES_MAX, RENT_WRITES_WINDOW_S)) return { error: 'rent-rate' };   // a collection counts, as the law says
  const home = await db.prepare(`SELECT rent_due, region FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND char_id = ?`)
    .bind(mapId, buildingKey, player.id, character).first();
  if (!home) return { error: 'no-home' };
  const due = Math.max(0, Number(home.rent_due) || 0);
  if (!due) return { error: 'rent-none' };
  // into the home's region's bank account, as a sale pays (AUDIT: a month of rooms in coin would pin the owner where they
  // stand - 8 rooms at the dearest price is 2,400,000 gold); a save with no account there takes it in its purse
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (creditSave(save, due, { bank: home.region }) ? null : 'no-data'));
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare('UPDATE homes SET rent_due = rent_due - ? WHERE map_id = ? AND building_key = ? AND player = ? AND char_id = ? AND rent_due >= ?')
        .bind(due, mapId, buildingKey, player.id, character, due),
      mustChange(db),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);
    return (await recordMovedOf(db, player.id, side.at)) || { error: 'rent-none' };
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, gold: due, realm: { seq: prep.seq } };
}
