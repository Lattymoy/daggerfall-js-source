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
import {
  HOME_CAP, HOME_ENTRY_DEFAULT, HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S, HOME_TOWN_MAX,
  homeMapIdOk, homeBuildingKeyOk, homeRegionOk, homePriceOk, homeEntryOk,
} from '../../src/net/homeLaw.js';

const homeOf = (row) => ({
  mapId: row.map_id, buildingKey: row.building_key, region: row.region, character: row.char_id,
  entry: row.entry, price: row.price, boughtAt: row.bought_at,
});

/**
 * CLAIM ONE: the building becomes the character's, or the claim is refused and nothing changes.
 * @param {{db: any, nowS: number}} ctx
 * @param {any} player  the session's player row
 * @param {{mapId?: unknown, buildingKey?: unknown, region?: unknown, character?: unknown, price?: unknown}} claim
 */
export async function claimHome({ db, nowS }, player, { mapId, buildingKey, region, character, price } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || !homeRegionOk(region) || !homePriceOk(price)) return { error: 'bad-home' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'home-character' };
  if (await overRate({ db, nowS }, `home:${player.id}`, HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S)) return { error: 'home-rate' };
  const r = await db.prepare(`INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM homes WHERE player = ? AND char_id = ?) < ?`)
    .bind(mapId, buildingKey, player.id, character, displayName(player), region, HOME_ENTRY_DEFAULT, price, nowS, player.id, character, HOME_CAP).run();
  const row = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  if (r?.meta?.changes) return { ok: true, home: homeOf(row) };
  if (row && row.player === player.id && row.char_id === character) return { ok: true, repeat: true, home: homeOf(row) };
  if (row) return { error: 'home-taken' };
  return { error: 'home-cap' };
}

/**
 * GIVE ONE UP: the caller's own, whichever character holds it. Answers what it was bought for (the client pays back
 * Daggerfall's share of it) and, DECOR1e, how many placed pieces went with it and half of what they cost.
 * @param {{db: any}} ctx
 */
export async function releaseHome({ db }, player, { mapId, buildingKey } = {}) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'no-home' };
  // DECOR1e: the home's placed pieces go with it (decor.js - the cascade), and half of what each cost comes back, as
  // removing it would give (net/decorLaw.js decorSaleBack: truncated, a piece at a time). Read in the SAME batch as
  // the release, so no piece is placed between the sum and the going - and answered only when the release is the
  // caller's; a record that is not JSON is no piece and counts nothing.
  const [pieces, gone] = await db.batch([
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN json_valid(place) THEN 1 ELSE 0 END), 0) AS n,
      COALESCE(SUM(CASE WHEN json_valid(place) THEN CAST(json_extract(place, '$.paid') AS INTEGER) / 2 ELSE 0 END), 0) AS back
      FROM home_decor WHERE map_id = ? AND building_key = ?`).bind(mapId, buildingKey),
    db.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ? AND player = ? RETURNING price')
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
  const r = await db.prepare('UPDATE homes SET entry = ? WHERE map_id = ? AND building_key = ? AND player = ?')
    .bind(entry, mapId, buildingKey, player.id).run();
  return r?.meta?.changes ? { ok: true, entry } : { error: 'no-home' };
}

/**
 * A TOWN'S HOMES, for everyone standing in it - guests too: whose each is (the handle the relay signs), who may walk
 * in, and which are the caller's own. Never the price, never another account's character.
 * @param {{db: any}} ctx
 */
export async function homesInTown({ db }, player, { mapId } = {}) {
  if (!homeMapIdOk(mapId)) return { error: 'bad-home' };
  const { results = [] } = await db.prepare(`SELECT building_key, player, char_id, owner_name, entry FROM homes
    WHERE map_id = ? ORDER BY building_key LIMIT ?`).bind(mapId, HOME_TOWN_MAX).all();
  return {
    mapId,
    homes: results.map((h) => {
      const mine = h.player === player.id;
      return { buildingKey: h.building_key, owner: h.owner_name, entry: h.entry, mine, ...(mine ? { character: h.char_id } : {}) };
    }),
  };
}

/**
 * THE CALLER'S OWN, every character's, oldest first - and the cap each character is held to.
 * @param {{db: any}} ctx
 */
export async function homesOf({ db }, player) {
  const { results = [] } = await db.prepare('SELECT * FROM homes WHERE player = ? ORDER BY bought_at, map_id, building_key')
    .bind(player.id).all();
  return { homes: results.map(homeOf), cap: HOME_CAP };
}
