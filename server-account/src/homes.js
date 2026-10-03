// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME1 - THE ONLINE HOMES: ONE OWNER A BUILDING, SERVER-WIDE.
//
// Mac: "Housing is exclusive." The registry is here because a claim
// has to be ONE answer for every client: two players at one door, each
// with their gold out, get one "yours" and one "taken" - never two
// homes. What a home is (its shapes, the cap, who may walk in) is
// src/net/homeLaw.js, which the client reads too.
//
// ═══ REGISTERED ONLY, TO OWN ═══════════════════════════════════════
//
// A guest is a device (MAIL1's reading, letters.js): a cleared browser
// loses it, and a home held by an account nobody can sign back into is
// a building taken out of the world for good. A guest may READ a town -
// the doors say whose a home is to everyone - and may not claim. The
// route's wall refuses first; `claimHome` asks again, because a
// function that trusts its caller's wall is one refactor from having
// none.
//
// ═══ ONE STATEMENT DECIDES ═════════════════════════════════════════
//
// The claim is ONE INSERT that lands only while the character holds
// fewer than HOME_CAP and the building is nobody's (the key is the
// table's primary key, and OR IGNORE turns a taken key into no change
// rather than a thrown error). So two claims racing for one building,
// or one character's two claims racing for its last place, cannot both
// land. What did not land is read back afterwards only to NAME the
// refusal. A claim sent again because its answer was lost finds the
// building already the same character's, and is answered as a claim.
//
// Every write names the owner in its WHERE (`AND player = ?`), so a
// building that is somebody else's is exactly as absent as one that is
// nobody's - one word, `no-home`, for both.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { prepareRealmRecord, realmActFirst, realmAtOf, recordMovedOf, mustChange, dropObjects, dropIfUnnamed, REALM_ID_RE } from './realm.js';   // REALM P2.2b; AUDIT REALM L1-F2: the record asked first; AUDIT REALM2 S3: a landed batch's object kept
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';   // REALM P2.2b: the wallet's own order, over the record
import {
  HOME_CAP, HOME_ENTRY_DEFAULT, HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S, HOME_TOWN_MAX, HOME_LAYOUTS_MAX,
  homeMapIdOk, homeBuildingKeyOk, homeRegionOk, homePriceOk, homeEntryOk, homeSaleRefund, homeLookOf, homeLayoutOk, homeLayoutsMatch, HOME_LAYOUT_MODS,
  homeInArenaCell, RENT_ANCHOR_MOVED,   // ARENA4b: the arena's cell, and a tenancy's point the move carries
} from '../../src/net/homeLaw.js';
import { GUILD_TREASURY_MAX } from '../../src/net/guildLaw.js';   // ARENA4b: a hall's pieces paid back, into a treasury under its cap
import { DECOR_OPS_MAX, DECOR_OPS_WINDOW_S } from '../../src/net/decorLaw.js';   // HOME-LOOK: a repaint counts as a decorator's write
import { hallMay } from '../../src/net/hallLaw.js';   // GUILD1d: a hall's keepers
import { heraldryOfRow } from './halls.js';   // GUILD1d: a hall's heraldry, on its door
import { openGatesAt } from './seatHolding.js';   // SEAT1d: Open Gates, where the town's holder proclaims it
import { OWNS } from './decor.js';   // GUILD-YARD: a home's character, or a hall's keeper - as its decor asks

const homeOf = (row) => ({
  mapId: row.map_id, buildingKey: row.building_key, region: row.region, character: row.char_id,
  entry: row.entry, price: row.price, boughtAt: row.bought_at,
  ...(row.layout ? { layout: row.layout } : {}),   // WD3: the layout the town keeps - none where it is Daggerfall's own
});

/** THE CLAIM'S ONE WRITE: the house the character's, while it is nobody's and the character holds fewer than its cap.
 *  `paid` (AUDIT REALM L1-F3, migration 0020): the gold a realm record paid for it - the price, for a realm character's
 *  claim; nothing for any other character's, whose client paid (or did not) out of a save the service never sees. */
// WD3 (AUDIT WD3 R5): a town's homes in ONE layout, in the write itself - the claim's mods each in a home of the town
// or not, as homeLayoutsMatch reads them (versions aside), so two first claims in two layouts at once seat one
const LAYOUT_MATCH_SQL = HOME_LAYOUT_MODS.map(() => `(instr(COALESCE(t.layout, ''), ?) > 0) = ?`).join(' AND ');
const layoutMatchBinds = (layout) => {
  const mods = new Set(typeof layout === 'string' && layout ? layout.split('+').map((p) => p.split('@')[0]) : []);
  return HOME_LAYOUT_MODS.flatMap((m) => [`${m}@`, mods.has(m) ? 1 : 0]);
};
const claimStatement = (db, player, { mapId, buildingKey, region, character, price, layout = null }, nowS, paid = 0) => db.prepare(`INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, layout)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT t.layout FROM homes t WHERE t.map_id = ? ORDER BY t.bought_at, t.building_key LIMIT 1), CASE WHEN EXISTS (SELECT 1 FROM homes t WHERE t.map_id = ?) THEN NULL ELSE ? END)
    WHERE (SELECT COUNT(*) FROM homes WHERE player = ? AND char_id = ?) < ?
      AND NOT EXISTS (SELECT 1 FROM homes t WHERE t.map_id = ? AND NOT (${LAYOUT_MATCH_SQL}))`)
  .bind(mapId, buildingKey, player.id, character, displayName(player), region, HOME_ENTRY_DEFAULT, price, nowS, paid, mapId, mapId, layout, player.id, character, HOME_CAP, mapId, ...layoutMatchBinds(layout));

/**
 * REALM P2.2b: A REALM CHARACTER'S CLAIM - the house and the record's payment in ONE batch, the price off the record by
 * the wallet's own order (the region's account last), or neither. Where the record stands is asked before it, by
 * claimHome (realm.js realmActFirst - an act sent again because its answer was lost finds it one on: `seq`, which the
 * client reads as landed); here the house (the character's own already - a second press - is answered as the claim,
 * and pays nothing).
 */
async function realmClaim(ctx, player, at, claim) {
  const { db, bucket, nowS } = ctx;
  const held = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').bind(claim.mapId, claim.buildingKey).first();
  if (held) return held.player === player.id && held.char_id === claim.character ? { ok: true, repeat: true, home: homeOf(held), realm: { seq: at.seq } } : { error: 'home-taken' };
  // WD3 (AUDIT WD3 O1): A TOWN THAT HOLDS HOMES KEEPS ITS LAYOUT, and a building key names a building only in one layout -
  // a claim made in another (a client that has not heard the towns' layouts, an old build) names another building, so it
  // is refused, never stored under the town's layout; the answer says which layout the town keeps
  const town = await db.prepare('SELECT layout FROM homes WHERE map_id = ? ORDER BY bought_at, building_key LIMIT 1').bind(claim.mapId).first();
  if (town && !homeLayoutsMatch(town.layout, claim.layout)) return { error: 'home-layout', layout: homeLayoutOk(town.layout) ? town.layout ?? null : null };
  const prep = await prepareRealmRecord(ctx, player.id, at, (save) => (payFromSave(save, claim.price, claim.region) ? null : 'realm-gold'));
  if (prep.error) return prep;
  try {
    await db.batch([...prep.steps, claimStatement(db, player, claim, nowS, claim.price), mustChange(db)]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    const now = await recordMovedOf(db, player.id, at);
    if (now) return now;
    if (await db.prepare('SELECT 1 AS one FROM homes WHERE map_id = ? AND building_key = ?').bind(claim.mapId, claim.buildingKey).first()) return { error: 'home-taken' };
    const town = await db.prepare('SELECT layout FROM homes WHERE map_id = ? ORDER BY bought_at, building_key LIMIT 1').bind(claim.mapId).first();
    if (town && !homeLayoutsMatch(town.layout, claim.layout)) return { error: 'home-layout', layout: homeLayoutOk(town.layout) ? town.layout ?? null : null };   // AUDIT WD3 R5: a first claim in another layout landed first
    return { error: 'home-cap' };
  }
  await dropObjects(bucket, [prep.prev]);
  const row = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').bind(claim.mapId, claim.buildingKey).first();
  return { ok: true, home: homeOf(row), realm: { seq: prep.seq } };
}

/**
 * CLAIM ONE: the building becomes the character's, or the claim is refused and nothing changes. A realm character's
 * record pays for it in the claim's own batch (REALM P2.2b).
 * @param {{db: any, nowS: number, bucket?: any, rand?: any}} ctx
 * @param {any} player  the session's player row
 * @param {{mapId?: unknown, buildingKey?: unknown, region?: unknown, character?: unknown, price?: unknown, realm?: unknown}} claim
 */
export async function claimHome(ctx, player, body = {}) {
  const { mapId, buildingKey, region, character, price, realm = null, layout = null } = body ?? {};
  const { db, nowS } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || !homeRegionOk(region) || !homePriceOk(price)) return { error: 'bad-home' };
  if (!homeLayoutOk(layout)) return { error: 'bad-home' };   // WD3: the layout the claimant's town stands in (null: Daggerfall's)
  // ARENA4b: THE ARENA STANDS THERE. No building of Daggerfall's cell (4,3) has a key since ARENA1, but a build from
  // before the arena still stands GEMSAL03 and could buy one of its houses - a home keyed to nothing. Refused by the key,
  // with the shapes (no record moves for it, so no record is asked first)
  if (homeInArenaCell(mapId, buildingKey)) return { error: 'home-arena' };
  // WD3 (AUDIT WD3 B2): every build since the town mods SAYS its town's layout, Daggerfall's own as null - a claim that
  // names none is a build from before them, whose town may be another layout than the room's: its key would name a
  // stranger's building. It is asked to update, never seated.
  if (!Object.hasOwn(body ?? {}, 'layout')) return { error: 'home-update' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'home-character' };
  // AUDIT REALM2 S2: A HOUSE IS A REALM CHARACTER'S, BOUGHT ON ITS RECORD. Any other id still claimed on its client's word
  // - a made-up one at a price of 1, sixty buildings an hour taken from the world - and customs carried the house in.
  if (!REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before the hour's claims
  if (side.error) return side;
  // AUDIT WD3 B8: a claim in another layout of its town is refused before it counts against the hour's claims - the
  // client hears the town again and claims once more, which a refusal counted would leave it rate-limited for
  if (!(await db.prepare('SELECT 1 AS one FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first())) {
    const town = await db.prepare('SELECT layout FROM homes WHERE map_id = ? ORDER BY bought_at, building_key LIMIT 1').bind(mapId).first();
    if (town && !homeLayoutsMatch(town.layout, layout)) return { error: 'home-layout', layout: homeLayoutOk(town.layout) ? town.layout ?? null : null };
  }
  if (await overRate({ db, nowS }, `home:${player.id}`, HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S)) return { error: 'home-rate' };
  return realmClaim(ctx, player, side.at, { mapId, buildingKey, region, character, price, layout: layout ?? null });   // a realm character's side is always its record
}

/** DECOR1e: a home's placed pieces and half of what they cost - what its sale gives back for them. */
const decorBackStatement = (db, mapId, buildingKey) => db.prepare(`SELECT COALESCE(SUM(CASE WHEN json_valid(place) THEN 1 ELSE 0 END), 0) AS n,
      COALESCE(SUM(CASE WHEN json_valid(place) THEN CAST(json_extract(place, '$.paid') AS INTEGER) / 2 ELSE 0 END), 0) AS back
      FROM home_decor WHERE map_id = ? AND building_key = ?`).bind(mapId, buildingKey);
/** AUDIT REALM L1-F3: the same pieces, and half of what REALM RECORDS paid for them (home_decor.paid, decor.js) - what a
 *  realm character's sale gives back: never half of a cost a client named that no record paid. */
const realmDecorBackStatement = (db, mapId, buildingKey) => db.prepare(`SELECT COALESCE(SUM(CASE WHEN json_valid(place) THEN 1 ELSE 0 END), 0) AS n,
      COALESCE(SUM(CASE WHEN json_valid(place) THEN paid / 2 ELSE 0 END), 0) AS back
      FROM home_decor WHERE map_id = ? AND building_key = ?`).bind(mapId, buildingKey);

/**
 * REALM P2.2b: A HOME A REALM CHARACTER SELLS - the house given up and the record paid back in ONE batch: Daggerfall's
 * deed share of what the house cost (homeLaw.js homeSaleRefund) and half of what its placed pieces cost, into the bank
 * account of the house's region, as the client's sale pays. The record asked first, as a claim asks it.
 * AUDIT REALM L1-F3: THE CHARACTER'S OWN HOUSE, AND ONLY WHAT A RECORD PAID FOR IT. The sale read any house of the
 * account and credited its client-named price - a claim at the ten-million cap by a character no record stands behind,
 * sold by the realm character's record, made 8,500,000; a house customs carried in from before the realm, the same. The
 * house must be this character's - the batch's DELETE names it, so another character's house moves nothing and the sale
 * is refused - and what comes back is the deed share of `paid` (migration 0020) and half of what records paid for its
 * pieces: a house no record paid for comes back as a house, never as gold. The answer says what the record got
 * (`refund`), which the client takes - never its own sum of a price.
 */
async function realmRelease(ctx, player, at, home) {
  const { db, bucket } = ctx;
  if (!home) return { error: 'no-home' };
  // HOME-CROSSED (FIELD BUGS 2026-09-30, Seanobi's "Sold House for 600 K, Got Nothing Back"): A HOUSE NO RECORD PAID FOR
  // STAYS A HOUSE. Customs carried it in (CUSTOMS-CARRY) and its deed share of nothing was paid while the house and its
  // pieces went - RESTORE's law for a deed (Mac: "Keep all, can't sell"), a home's now: never bought back online. (Another
  // character's house is still the batch's own refusal, `no-home`.)
  if (home.char_id === at.id && !(Number(home.paid) > 0)) return { error: 'home-crossed' };
  const d = await realmDecorBackStatement(db, home.map_id, home.building_key).first();
  const decorCount = Number(d?.n) || 0, decorBack = Math.max(0, Number(d?.back) || 0);
  const refund = homeSaleRefund(Math.max(0, Number(home.paid) || 0));
  const rentDue = Math.max(0, Number(home.rent_due) || 0);   // HOME-RENT: the rent held on it, never collected, comes with the sale
  const back = refund + decorBack + rentDue;
  const prep = await prepareRealmRecord(ctx, player.id, at, (save) => (creditSave(save, back, { bank: home.region }) ? null : 'no-data'));
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND char_id = ? AND paid = ? AND rent_due = ?').bind(home.map_id, home.building_key, player.id, at.id, home.paid, home.rent_due ?? 0),   // HOME-RENT: a rent landing between the read and the sale is never lost
      mustChange(db),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, at.id, prep.key);   // AUDIT REALM2 S3
    return (await recordMovedOf(db, player.id, at)) || { error: 'no-home' };
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, price: home.price, refund, decorCount, decorBack, ...(rentDue ? { rent: rentDue } : {}), realm: { seq: prep.seq } };
}

/**
 * GIVE ONE UP: the caller's own, whichever character holds it. Answers what it was bought for (the client pays back
 * Daggerfall's share of it) and, DECOR1e, how many placed pieces went with it and half of what they cost. A realm
 * character's home - or any sale that names a record - pays back into the record, in the release's own batch (REALM
 * P2.2b).
 * @param {{db: any, bucket?: any, rand?: any, nowS?: number}} ctx
 */
export async function releaseHome(ctx, player, { mapId, buildingKey, realm = null } = {}) {
  const { db } = ctx;
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'no-home' };
  const at = realm != null ? realmAtOf(realm) : null;
  if (at) {
    const moved = await recordMovedOf(db, player.id, at);   // AUDIT REALM L1-F2: where the record stands, before the house is looked for
    if (moved) return moved;
  }
  // GUILD1d: a guild's hall is no account's to sell - its row's `player` is only its anchor (halls.js sellHall sells it)
  const home = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND guild_id IS NULL').bind(mapId, buildingKey, player.id).first();
  // HOME-RENT: a home another player is renting a room in is not sold from under them - their days were paid for
  if (home && Number((await db.prepare(`SELECT COUNT(*) AS n FROM home_rooms WHERE map_id = ? AND building_key = ? AND tenant IS NOT NULL AND until > ?`)
    .bind(mapId, buildingKey, ctx.nowS ?? Math.floor(Date.now() / 1000)).first())?.n ?? 0) > 0) return { error: 'home-tenants' };
  if (realm != null || (typeof home?.char_id === 'string' && REALM_ID_RE.test(home.char_id))) {
    return at ? realmRelease(ctx, player, at, home) : { error: 'realm-needed' };
  }
  // DECOR1e: the home's placed pieces go with it (decor.js - the cascade), and half of what each cost comes back, as
  // removing it would give (net/decorLaw.js decorSaleBack: truncated, a piece at a time). Read in the SAME batch as
  // the release, so no piece is placed between the sum and the going - and answered only when the release is the
  // caller's; a record that is not JSON is no piece and counts nothing.
  const [pieces, gone] = await db.batch([
    decorBackStatement(db, mapId, buildingKey),
    db.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND guild_id IS NULL RETURNING price')
      .bind(mapId, buildingKey, player.id),
  ]);
  const row = gone?.results?.[0];
  if (!row) return { error: 'no-home' };
  const d = pieces?.results?.[0];
  return { ok: true, price: row.price, decorCount: Number(d?.n) || 0, decorBack: Math.max(0, Number(d?.back) || 0) };
}

/**
 * WHO MAY WALK IN, as the owner sets it (homeLaw.js HOME_ENTRIES).
 * @param {{db: any}} ctx
 */
export async function setHomeEntry({ db }, player, { mapId, buildingKey, entry } = {}) {
  if (!homeEntryOk(entry)) return { error: 'bad-entry' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'no-home' };
  const r = await db.prepare('UPDATE homes SET entry = ? WHERE map_id = ? AND building_key = ? AND player = ? AND guild_id IS NULL')
    .bind(entry, mapId, buildingKey, player.id).run();   // GUILD1d: a hall's entry is its guild's (halls.js setHallEntry)
  return r?.meta?.changes ? { ok: true, entry } : { error: 'no-home' };
}

/**
 * HOME-LOOK (2026-09-30): HOW A HOME LOOKS OUTSIDE, as its owner paints it (net/homeLaw.js homeLookOf) - the owner's
 * character's alone, free, a decorator's write against the hour's (decor.js's own count). `look` null paints it back
 * the town's own. Every client reads it with the town's homes.
 * GUILD-YARD (Seats-Arc 8.2): a guild's hall is painted by its keepers - its Officers and its guildmaster, a realm
 * character each (decor.js OWNS, the rule its rooms' pieces are placed by) - free, as a home's is; a member below them,
 * and anyone outside the guild, paints nothing of it (`no-home`, as another's home).
 * @param {{db: any, nowS: number}} ctx
 */
export async function setHomeLook({ db, nowS }, player, { mapId, buildingKey, character, look = null } = {}) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'home-character' };
  const next = look == null ? null : homeLookOf(look);
  if (look != null && !next) return { error: 'bad-look' };
  if (await overRate({ db, nowS }, `decor:${player.id}`, DECOR_OPS_MAX, DECOR_OPS_WINDOW_S)) return { error: 'decor-rate' };
  const r = await db.prepare(`UPDATE homes SET look = ? WHERE map_id = ? AND building_key = ? AND ${OWNS}`)
    .bind(next ? JSON.stringify(next) : null, mapId, buildingKey, mapId, buildingKey, player.id, character).run();
  return r?.meta?.changes ? { ok: true, look: next } : { error: 'no-home' };
}

/** HOME-LOOK: a row's look as the law takes it - `{ look }`, or nothing (the town's own). */
const lookOfRow = (h) => { const look = h.look ? homeLookOf(h.look) : null; return look ? { look } : {}; };

/**
 * A TOWN'S HOMES, for everyone standing in it - guests too: whose each is (the handle the relay signs), who may walk
 * in, and which are the caller's own. Never the price, never another account's character.
 * @param {{db: any}} ctx
 */
export async function homesInTown({ db, nowS = Math.floor(Date.now() / 1000) }, player, { mapId, character = null } = {}, { seats = false } = {}) {
  if (!homeMapIdOk(mapId)) return { error: 'bad-home' };
  // SEAT1d (Seats-Arc 7.6): OPEN GATES - while the town's holder proclaims it, every home there stands open to all (a
  // reader the seats are open to); each owner's own choice is kept, and its own view shows it
  const open = seats && await openGatesAt(db, nowS, mapId);
  // HOME-RENT: each home's rooms still free to rent (how many, and the cheapest a day), and - for the character the
  // caller names - the end of its own tenancy there, which opens the door to it
  const me = typeof character === 'string' && CHAR_ID_RE.test(character) ? character : '';
  // GUILD1d: a hall's guild (its name, tag and heraldry) and the named character's rank in it; a home whose owner opened
  // it to their guild, whether the named character is in that guild with them
  const { results = [] } = await db.prepare(`SELECT h.building_key, h.player, h.char_id, h.owner_name, h.entry, h.paid, h.look, h.guild_id,
      g.name AS guild_name, g.tag AS guild_tag, g.heraldry AS guild_heraldry,
      (SELECT COUNT(*) FROM home_rooms r WHERE r.map_id = h.map_id AND r.building_key = h.building_key AND r.listed = 1 AND (r.tenant IS NULL OR r.until <= ?1)) AS vacant,
      (SELECT MIN(r.price) FROM home_rooms r WHERE r.map_id = h.map_id AND r.building_key = h.building_key AND r.listed = 1 AND (r.tenant IS NULL OR r.until <= ?1)) AS rent_from,
      (SELECT MAX(r.until) FROM home_rooms r WHERE r.map_id = h.map_id AND r.building_key = h.building_key AND r.tenant = ?2 AND r.tenant_char = ?3 AND r.until > ?1) AS tenancy,
      (SELECT m.rank FROM guild_members m WHERE m.guild_id = h.guild_id AND m.player = ?2 AND m.char_id = ?3) AS my_rank,
      (h.guild_id IS NULL AND h.entry = 'guild' AND EXISTS (SELECT 1 FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id
        WHERE a.player = h.player AND a.char_id = h.char_id AND b.player = ?2 AND b.char_id = ?3)) AS guildmate,
      EXISTS (SELECT 1 FROM realm_characters rc WHERE rc.id = ?3 AND rc.player = ?2) AS me_realm
    FROM homes h LEFT JOIN guilds g ON g.id = h.guild_id WHERE h.map_id = ?4 ORDER BY h.building_key LIMIT ?5`).bind(nowS, player.id, me, mapId, HOME_TOWN_MAX).all();
  return {
    mapId, ...(open ? { openGates: true } : {}),
    homes: results.map((h) => {
      if (h.guild_id != null) {
        // GUILD1d: A GUILD'S HALL - named by its guild, whose members walk in and whose Officers furnish it; nobody's home
        const rank = Number.isSafeInteger(h.my_rank) ? h.my_rank : null;
        return {
          buildingKey: h.building_key, owner: h.guild_name ?? h.owner_name, entry: h.entry, mine: false,
          hall: { name: h.guild_name ?? h.owner_name, tag: h.guild_tag ?? '', heraldry: heraldryOfRow(h.guild_heraldry) },
          // AUDIT GUILD-YARD Y1: a keeper as OWNS keeps it - of the rank, and a realm character (a local one is refused
          // every write; its decorator stood for nothing)
          ...(rank != null ? { member: true, ...(hallMay(rank, 'decorate') && h.me_realm === 1 ? { keeper: true } : {}) } : {}),
          // AUDIT PROF-541 G2: who may say who walks in, as setHallEntry asks it (halls.js) - the rank alone, any character;
          // `keeper`'s realm clause took the door's "Who may enter" from a local Officer the service would have answered
          ...(rank != null && hallMay(rank, 'hallEntry') ? { hallEntry: true } : {}),
          ...lookOfRow(h),   // GUILD-YARD: how its keepers painted it, to everyone
        };
      }
      const mine = h.player === player.id;
      // HOME-CROSSED: my own realm character's house no record paid for is `crossed` - its door asks no price
      const crossed = mine && REALM_ID_RE.test(String(h.char_id)) && !(Number(h.paid) > 0);
      return {
        buildingKey: h.building_key, owner: h.owner_name, entry: open && !mine ? 'public' : h.entry, mine, ...(mine ? { character: h.char_id } : {}), ...(crossed ? { crossed } : {}),
        ...(Number(h.vacant) > 0 ? { rent: { vacant: Number(h.vacant), from: Number(h.rent_from) } } : {}),
        ...(Number.isSafeInteger(h.tenancy) && h.tenancy > nowS ? { tenant: h.tenancy } : {}),
        ...lookOfRow(h),   // HOME-LOOK: how its owner painted it
        ...(h.guildmate === 1 ? { guildmate: true } : {}),   // GUILD1d: the named character is in the owner's character's guild
      };
    }),
  };
}

/**
 * THE CALLER'S OWN, every character's, oldest first - and the cap each character is held to.
 * @param {{db: any}} ctx
 */
export async function homesOf({ db }, player) {
  const { results = [] } = await db.prepare('SELECT * FROM homes WHERE player = ? AND guild_id IS NULL ORDER BY bought_at, map_id, building_key')
    .bind(player.id).all();   // GUILD1d: a hall is its guild's, never the account's that bought it
  return { homes: results.map(homeOf), cap: HOME_CAP };
}

/**
 * WD3: EVERY TOWN THAT HOLDS A HOME, AND THE LAYOUT IT KEEPS - its oldest home's (null: Daggerfall's own town). Read by
 * every session at its online boot (a guest's too: the towns are everyone's to walk), so each client stands each such
 * town as its homes were bought in it (src/systems/layoutPins.js), one town for the whole room. `[mapId, layout]` rows.
 * @param {{db: any}} ctx
 */
export async function homeLayouts({ db }) {
  const { results = [] } = await db.prepare(`SELECT h.map_id, h.layout FROM homes h
    WHERE NOT EXISTS (SELECT 1 FROM homes o WHERE o.map_id = h.map_id AND (o.bought_at < h.bought_at OR (o.bought_at = h.bought_at AND o.building_key < h.building_key)))
    ORDER BY h.map_id LIMIT ?`).bind(HOME_LAYOUTS_MAX).all();
  return { towns: results.map((r) => [r.map_id, homeLayoutOk(r.layout) ? r.layout ?? null : null]) };
}

// ═══ ARENA4b (2026-10-03) - A HOME THE ARENA DISPLACED, MOVED ════════════════════════════════════════════════════════
//
// Mac (ARENA1): "Move them to a new house". Daggerfall's cell (4,3) is the arena's in every layout of the city, so a home
// keyed there names nothing. THE OWNER'S CLIENT PICKS the new house - by the offline move's own rule (src/systems/
// arenaMove.js arenaHomeFor: a house of the old one's type outside the cell, by the market's seeded pick, every key a
// home of the town holds left out) - because this service holds no town's records (the doctrine: no ARENA2 in the tree).
// THE SAME TRUST AS A CLAIM (claimHome): the service cannot see that the key names a house, any more than it sees a
// claim's; it checks what it can - the old key a home of the caller's in the arena's cell, the new one in the same town,
// outside the cell, a key's shape, and nobody's - and the move once (`home_moves`, migration 0073 - 0071 before the second merge onto main).
//
// WHAT MOVES IS THE OFFLINE LAW'S (arenaMove.js emptyArenaScene): the furniture's places are the old building's frame and
// fit no other, so the room is emptied, never carried. The ROW goes whole - every column (HOME_MOVE_CARRIED) - with its
// running tenancies (unlisted, their point cleared: RENT_ANCHOR_MOVED); the catalogue's and the yard's pieces go and what
// records paid for them comes back WHOLE (a sale gives half; nobody sold this house) - into the owner's record's bank
// account in the home's region, in the move's own batch, as a sale pays (realmRelease), and answered as `refund` for the
// client to credit inside its realm act. DECIDED: the record, not the home's `rent_due` - the offline move pays at the
// move, rent_due is rent (said so at the door, paid out only by a collection or a sale), and a realm act is the one road
// gold takes onto a record. A guild hall's pieces were bought from its treasury, so theirs go back into it. The owner's
// own things standing in it go with their pieces (they are the save's: the client gives them back from the old scene),
// the furniture taken out is forgotten, a room only offered is withdrawn. The cascade from `homes` takes all of that:
// the new row first, the tenancies re-keyed onto it, the old row deleted, in ONE batch - the cascade never reaches a
// child that moves. A hall's guild is set after the old row goes (`idx_homes_guild` is one hall a guild).
//
// THE RELAY NEEDS NOTHING: its `interior:m<map>.<key>` rooms hold the visitors standing in a house now - no loot, no
// decor (both are the service's and the save's) - and lapse when the last one leaves, so the old key's room simply
// never opens again and the new key's is any house's.

/** Every column of a home's row the move carries to the new key, beside the key itself and the hall's guild (set after
 *  the old row goes) - pinned against the table's own columns (test/arena4b_homes.test.js), so a column added to `homes`
 *  later is carried or the pin says why not. */
export const HOME_MOVE_CARRIED = Object.freeze(['player', 'char_id', 'owner_name', 'region', 'entry', 'price', 'bought_at', 'paid', 'rent_due', 'look', 'layout']);
/** The most moves one read of a character's lists. */
export const HOME_MOVES_MAX = 16;

/** A move as the client reads it. */
const moveOf = (m) => ({ mapId: m.map_id, from: m.old_key, to: m.new_key, refund: Math.max(0, Number(m.refund) || 0), movedAt: m.moved_at, ...(m.hall === 1 ? { hall: true } : {}) });

/**
 * ARENA4b: MOVE A HOME OUT OF THE ARENA'S CELL. `from` a home of the caller's in Daggerfall's cell (4,3) - its character's
 * own (`character` the row's), or a hall it keeps (decor.js OWNS, the one rule) - and `to` the house its client picked.
 * A realm character's move names its record (`realm`) when the pieces' refund comes onto it, and the record is asked
 * first (realm.js realmActFirst). Answers `{ ok, from, to, refund, pieces, items, tenancies, withdrawn, hidden, hall?,
 * realm? }` - `repeat` when this move was made already (the first move's own row answers) - or `{ error }`: `bad-home`,
 * `home-character`, `home-unmoved` (no house of the arena's cell), `home-arena` (the new key is in it), `no-home` (not
 * the caller's), `home-taken` (the new house is somebody's), `realm-needed`, `guild-treasury-full`, `home-changed`
 * (a piece placed or moved, a room let, while the move was read - read the town again and post again), a record's word.
 * @param {{db: any, nowS: number, bucket?: any, rand?: any}} ctx
 */
export async function arenaMoveHome(ctx, player, { mapId, from, to, character, realm = null } = {}) {
  const { db, nowS, bucket } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(from) || !homeBuildingKeyOk(to)) return { error: 'bad-home' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'home-character' };
  // AUDIT REALM L1-F2: a move that names its record is asked where the record stands before any other word - a move whose
  // answer was lost finds it one on (`seq`), which its client reads as landed
  const side = realm != null ? await realmActFirst(db, player.id, character, realm) : { at: null };
  if (side.error) return side;
  // ONCE: a move made already is answered by its own row (one a town and old key), to the account that made it
  const was = await db.prepare('SELECT * FROM home_moves WHERE map_id = ? AND old_key = ?').bind(mapId, from).first();
  if (was) return was.player === player.id ? { ok: true, repeat: true, ...moveOf(was) } : { error: 'no-home' };
  if (!homeInArenaCell(mapId, from)) return { error: 'home-unmoved' };
  if (homeInArenaCell(mapId, to)) return { error: 'home-arena' };   // the new house outside the cell - `to` = `from` among it
  const home = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, from).first();
  const owns = home ? await db.prepare(`SELECT 1 AS one WHERE ${OWNS}`).bind(mapId, from, player.id, character).first() : null;
  if (!owns) return { error: 'no-home' };   // nobody's and somebody else's are one word (HOME1)
  if (await db.prepare('SELECT 1 AS one FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, to).first()) return { error: 'home-taken' };
  const gid = home.guild_id ?? null;
  // what the room held, as read - the batch's DELETE holds it to this, so a piece placed between is never lost unpaid
  const d = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN item IS NULL THEN paid ELSE 0 END), 0) AS paid,
      COALESCE(SUM(CASE WHEN item IS NULL THEN 1 ELSE 0 END), 0) AS pieces FROM home_decor WHERE map_id = ? AND building_key = ?`).bind(mapId, from).first();
  const n = Number(d?.n) || 0, pieces = Number(d?.pieces) || 0;
  const refund = Math.max(0, Number(d?.paid) || 0);
  const rooms = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN tenant IS NOT NULL AND until > ?1 THEN 1 ELSE 0 END), 0) AS kept, COUNT(*) AS n
      FROM home_rooms WHERE map_id = ?2 AND building_key = ?3`).bind(nowS, mapId, from).first();
  const tenancies = Number(rooms?.kept) || 0, withdrawn = (Number(rooms?.n) || 0) - tenancies;
  const hidden = !!(await db.prepare('SELECT 1 AS one FROM home_hidden WHERE map_id = ? AND building_key = ?').bind(mapId, from).first());
  const steps = [];
  let prep = null;
  if (refund > 0 && gid == null) {
    // the pieces' gold back WHOLE into the owner's record - its bank account in the home's region, as a sale pays
    if (!side.at) return { error: 'realm-needed' };
    prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (creditSave(save, refund, { bank: home.region }) ? null : 'no-data'));
    if (prep.error) return prep;
    steps.push(...prep.steps);
  } else if (refund > 0) {
    // a hall's pieces were the treasury's: back into what records paid in (halls.js), the ledger naming a hall piece
    steps.push(db.prepare(`UPDATE guilds SET treasury = treasury + ?1, realm_gold = realm_gold + ?1, moved_by = ?2, moved_at = ?3, moved_kind = 'hall-piece'
        WHERE id = ?4 AND treasury + ?1 <= ?5`).bind(refund, displayName(player), nowS, gid, GUILD_TREASURY_MAX), mustChange(db));
  }
  const cols = HOME_MOVE_CARRIED.join(', ');
  steps.push(
    // ONCE, in the write: a second move of the same house is the primary key's refusal, and the batch goes back
    db.prepare('INSERT INTO home_moves (map_id, old_key, new_key, player, char_id, refund, hall, moved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(mapId, from, to, player.id, character, refund, gid != null ? 1 : 0, nowS),
    // the row whole at the new key - a building somebody owns is the primary key's refusal; the guild after the old goes
    db.prepare(`INSERT INTO homes (map_id, building_key, ${cols}, guild_id) SELECT map_id, ?, ${cols}, NULL FROM homes
        WHERE map_id = ? AND building_key = ? AND ${OWNS}`).bind(to, mapId, from, mapId, from, player.id, character),
    mustChange(db),
    // a tenancy running is carried, offered to nobody, its point the old building's no more
    db.prepare('UPDATE home_rooms SET building_key = ?, listed = 0, anchor = ? WHERE map_id = ? AND building_key = ? AND tenant IS NOT NULL AND until > ?')
      .bind(to, RENT_ANCHOR_MOVED, mapId, from, nowS),
    // the old row goes, and the cascade with it: every piece, the furniture's list, the rooms only offered or run out -
    // the room as it was read, or nothing
    db.prepare(`DELETE FROM homes WHERE map_id = ?1 AND building_key = ?2
        AND (SELECT COUNT(*) FROM home_decor WHERE map_id = ?1 AND building_key = ?2) = ?3
        AND (SELECT COALESCE(SUM(CASE WHEN item IS NULL THEN paid ELSE 0 END), 0) FROM home_decor WHERE map_id = ?1 AND building_key = ?2) = ?4`)
      .bind(mapId, from, n, refund),
    mustChange(db),
    ...(gid != null ? [db.prepare('UPDATE homes SET guild_id = ? WHERE map_id = ? AND building_key = ? AND guild_id IS NULL').bind(gid, mapId, to), mustChange(db)] : []),
  );
  try {
    await db.batch(steps);
  } catch {
    if (prep) await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed keeps its save
    const moved = side.at ? await recordMovedOf(db, player.id, side.at) : null;
    if (moved) return moved;
    const now = await db.prepare('SELECT * FROM home_moves WHERE map_id = ? AND old_key = ?').bind(mapId, from).first();
    if (now) return now.player === player.id ? { ok: true, repeat: true, ...moveOf(now) } : { error: 'no-home' };   // raced by itself: the move that landed
    if (await db.prepare('SELECT 1 AS one FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, to).first()) return { error: 'home-taken' };
    if (gid != null) {
      const t = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(gid).first();
      if (t && Number(t.treasury) + refund > GUILD_TREASURY_MAX) return { error: 'guild-treasury-full' };
    }
    return { error: 'home-changed' };
  }
  if (prep) await dropObjects(bucket, [prep.prev]);
  return {
    ok: true, mapId, from, to, refund, pieces, items: n - pieces, tenancies, withdrawn, hidden,
    ...(gid != null ? { hall: true } : {}), ...(prep ? { realm: { seq: prep.seq } } : {}),
  };
}

/**
 * ARENA4b: THE MOVES A CHARACTER HAS NOT READ - each `{ mapId, from, to, refund, movedAt, hall? }` the caller's account
 * made as `character`. The old house's things lie in that character's save, so its client empties the old scene into the
 * new (again harmlessly - a scene emptied once is gone) and shows the bank's letter, then says so (`arenaMoveSeen`). Never
 * a refund to pay: the move's own batch paid it.
 * @param {{db: any}} ctx
 */
export async function arenaMovesOf({ db }, player, { character } = {}) {
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'home-character' };
  const { results = [] } = await db.prepare('SELECT * FROM home_moves WHERE player = ? AND char_id = ? AND seen_at IS NULL ORDER BY moved_at, map_id, old_key LIMIT ?')
    .bind(player.id, character, HOME_MOVES_MAX).all();
  return { moves: results.map(moveOf) };
}

/**
 * ARENA4b: A MOVE'S LETTER READ - `seen_at` set on the caller's own move, once. Answers `{ ok, seen }` (`seen` false: not
 * the caller's, or read already).
 * @param {{db: any, nowS: number}} ctx
 */
export async function arenaMoveSeen({ db, nowS }, player, { mapId, from } = {}) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(from)) return { error: 'bad-home' };
  const r = await db.prepare('UPDATE home_moves SET seen_at = ? WHERE map_id = ? AND old_key = ? AND player = ? AND seen_at IS NULL').bind(nowS, mapId, from, player.id).run();
  return { ok: true, seen: Number(r?.meta?.changes ?? 0) > 0 };
}
