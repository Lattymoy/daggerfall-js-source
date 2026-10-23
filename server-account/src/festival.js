// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WITCH1 (2026-10-20, the owner: "With Halloween on the horizon. I think its fair to develop our first live event.
// Daggerfall lore style"; bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL, AS THE SERVICE KEEPS IT -
// an account's Soul Cakes, the day's finds, the Wyrd Sister's sales, and the Hearth Offerings set out at homes' doors.
// The numbers are src/net/festivalLaw.js, which the client reads too.
//
// ═══ THE SERVICE ROLLS, THE CLIENT PLAYS ═══════════════════════════
//
// No relay sees an ordinary kill, so a find is the account's word that it killed (or fished, or won) - and that word is
// BOUNDED here, never believed: the service's own die decides each ask at its source's odds, and a UTC day takes at most
// FIND_ASKS_PER_DAY asks and FIND_CAKES_PER_DAY cakes (a Weir Key's find's law, eg.js findEg). A forged client finds no
// more than an honest one who played the whole day. Everything the cakes buy is the service's to sell: a sale is one
// guarded UPDATE that takes the price only while the count covers it.
//
// ═══ ONE STATEMENT DECIDES ═════════════════════════════════════════
//
// Every move is one `db.batch` whose first statement decides it against the rows as they stand, and whose others run only
// where it did: a take moves a cake out of a bowl only while one is in it and the taker has not taken there today, and
// into the taker's count in the same transaction; a fill and a take-in move the owner's cakes and the bowl's together.
// A sale asked twice is one sale (its request id, `fest_sales`), answered `repeat` with the ware it sold. No count is
// read in one request and written in another: a statement that credits reads what it credits in its own transaction.
//
// THE BOWL IS THE ACCOUNT'S, AS ITS CAKES (`fest_bowls`): bought, it is counted on the row; set out, one is spent; taken
// in, or come home from a home left, it is counted again. The pack's Hearth Offerings are its face (soulCake.js).
//
// REGISTERED ONLY: a guest's cakes would be a cleared browser's to lose (MARKS1's reading) - `guest`.
// FESTIVAL_OPEN (off, dev, on) shuts it; outside the festival's days (festivalLaw FESTIVALS) a find, a sale, a set-out,
// a fill and a take are `closed`, and a town shows its callers their own offerings alone. A bowl can always be taken in -
// under any switch, on any day - and the counts are kept.
//
// EVERY CLOCK IS AN ARGUMENT (accounts.js's law): `nowS` is the request's.
// Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
// ═══════════════════════════════════════════════════════════════════
import { isDeveloper } from './titles.js';
import { overAccountRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { dice } from './unitRoll.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { skyClassicMinutes } from '../../src/net/skyLaw.js';
import { dayOfYearFromMinutes } from '../../src/systems/gameDate.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import {
  festivalOpen, isFindSource, FIND_SOURCES, findCount, FIND_ASKS_PER_DAY, FIND_CAKES_PER_DAY,
  OFFERING_STOCK_MAX, OFFERING_FILL, OFFERING_TAKE, wareById, accountWare, bowlWare, festivalWaresHeld, SALE_RID_RE,
} from '../../src/net/festivalLaw.js';

/** The festival's moves an account an hour - a find a kill, so a fight's worth a minute and then some. Counted in the
 *  isolate's memory (accounts.js overAccountRate, ACCT-RATE-MEM): a write on every find is the outage that law ended,
 *  and the day's asks (fest_finds) bound the finds across isolates. */
export const FEST_OPS_MAX = 900;
export const FEST_OPS_WINDOW_S = 3600;

/** FESTIVAL_OPEN: 'off', 'dev' (the DEVELOPER_HANDLES alone) or 'on'; anything else is off. */
export const festivalSwitchOf = (/** @type {unknown} */ v) => (v === 'on' || v === 'dev' ? v : 'off');
export function festivalOpenFor(/** @type {any} */ player, /** @type {any} */ env) {
  const s = festivalSwitchOf(env?.FESTIVAL_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}

const int = (/** @type {unknown} */ v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const cakesOf = async (/** @type {any} */ db, /** @type {string} */ id) => int((await db.prepare('SELECT fest_cakes FROM players WHERE id = ?1').bind(id).first())?.fest_cakes);
/** The sky's day of the year at `nowS` (net/skyLaw.js - the sky every client draws), 1-based. */
export const skyDayAt = (/** @type {number} */ nowS) => dayOfYearFromMinutes(Math.floor(skyClassicMinutes(nowS * 1000)));

/**
 * THE GATE every move asks first: `{ error }` for a guest, a switch that is shut, or a rate spent; `open` false outside
 * the festival's days. Null when the move may go on.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} env
 */
async function gate(ctx, player, env) {
  if (!player?.handle) return { error: 'guest' };
  if (!festivalOpenFor(player, env)) return { error: 'closed' };
  if (overAccountRate(`fest:${player.id}`, ctx.nowS, FEST_OPS_MAX, FEST_OPS_WINDOW_S)) return { error: 'rate' };
  return null;
}
const inDays = (/** @type {number} */ nowS) => festivalOpen(nowS * 1000);

/** AN OFFERING OUTLIVES NO HOME: one whose home its character no longer owns (sold, moved by the arena, its character
 *  deleted - every road a home leaves by) stands nowhere (festivalTown's JOIN), and its cakes go back to its account on
 *  that account's next read of its festival (festivalOf, orphansHome) - never lost, and no road out of a home has to remember it. */
const ORPHAN = `player = ?1 AND NOT EXISTS (SELECT 1 FROM homes h WHERE h.map_id = fest_offerings.map_id
  AND h.building_key = fest_offerings.building_key AND h.player = fest_offerings.player AND h.char_id = fest_offerings.char_id)`;
/** ONE TRANSACTION: the orphans' cakes and bowls credited, then the orphans gone - nothing between the two can move them;
 *  the row written only where an orphan stands. */
const orphansHome = (/** @type {any} */ db, /** @type {string} */ id) => db.batch([
  db.prepare(`UPDATE players SET fest_cakes = fest_cakes + (SELECT COALESCE(SUM(stock), 0) FROM fest_offerings WHERE ${ORPHAN}),
    fest_bowls = fest_bowls + (SELECT COUNT(*) FROM fest_offerings WHERE ${ORPHAN}) WHERE id = ?1 AND EXISTS (SELECT 1 FROM fest_offerings WHERE ${ORPHAN})`).bind(id),
  db.prepare(`DELETE FROM fest_offerings WHERE ${ORPHAN}`).bind(id),
]);

/**
 * THE ACCOUNT'S FESTIVAL: its cakes and bowls, the account wares it bought, what its offerings gave and what it took,
 * and whether the festival is open - `{ cakes, bowls, wares, given, taken, today, open, offerings }` (`today` the cakes its
 * finds gave this UTC day, findFestival's count - CAKE-CAP-SAID; `offerings` its own
 * standing, each `{ mapId, buildingKey, character, stock }`). An orphaned offering comes home first (orphansHome). A guest
 * answers `guest`.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} env
 */
export async function festivalOf({ db, nowS }, player, env) {
  if (!player?.handle) return { error: 'guest' };
  await orphansHome(db, player.id);
  const { results: mine } = await db.prepare('SELECT map_id, building_key, char_id, stock FROM fest_offerings WHERE player = ?1').bind(player.id).all();
  const row = await db.prepare('SELECT fest_cakes, fest_bowls, fest_wares, fest_given, fest_taken FROM players WHERE id = ?1').bind(player.id).first();
  // CAKE-CAP-SAID: the day's cakes found so far (findFestival's own row), so the Wyrd's window says how near the day's end is
  const finds = await db.prepare('SELECT found FROM fest_finds WHERE account = ?1 AND day = ?2').bind(player.id, utcDay(nowS)).first();
  return {
    cakes: int(row?.fest_cakes), bowls: int(row?.fest_bowls), wares: festivalWaresHeld(row?.fest_wares), given: int(row?.fest_given), taken: int(row?.fest_taken),
    today: int(finds?.found),
    open: festivalOpenFor(player, env) && inDays(nowS),
    offerings: (mine ?? []).map((/** @type {any} */ r) => ({ mapId: int(r.map_id), buildingKey: int(r.building_key), character: String(r.char_id), stock: int(r.stock) })),
  };
}

/**
 * A FIND: the account's word that it did `source` (festivalLaw FIND_SOURCES - a foe by its kind, an act by its group),
 * decided by this service's die at the source's odds; a hit gives its count (twice while the dead walk - the sky's own
 * night, skyDayAt, or the festival's own, 31 October: festivalLaw deadWalk), never past the day's cakes. `{ found, cakes, today }` (`found` the cakes this find gave, 0 for none;
 * `today` the day's cakes found, this one's with them), and `capped: true` with them once the day's cakes are all found;
 * `capped` the refusal once the day's asks are spent (`cakes` with it).
 * CAKE-CAP-SAID (FIELD BUGS 2026-10-21b, "Soul Cake stopped dropping"): a find past the day's cakes answered `{ found: 0 }`,
 * a miss's own words, so a player farmed on for hours against a cap nothing named - the answer says it now, and its count.
 * @param {{ db: any, nowS: number, rand?: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string, handle?: string|null }} player
 * @param {any} body @param {any} env
 */
export async function findFestival(ctx, player, body, env) {
  const shut = await gate(ctx, player, env);
  if (shut) return shut;
  const { db, nowS, rand } = ctx;
  if (!inDays(nowS)) return { error: 'closed' };
  const source = body?.source;
  if (!isFindSource(source)) return { error: 'source' };
  const day = utcDay(nowS);
  const ask = await db.prepare(`INSERT INTO fest_finds (account, day, asks, found) VALUES (?1, ?2, 1, 0)
    ON CONFLICT (account, day) DO UPDATE SET asks = asks + 1 WHERE asks < ?3 RETURNING asks, found`).bind(player.id, day, FIND_ASKS_PER_DAY).first();
  if (!ask) return { error: 'capped', cakes: await cakesOf(db, player.id) };
  let found = 0;
  const left = FIND_CAKES_PER_DAY - int(ask.found);
  const want = Math.min(findCount(source, skyDayAt(nowS), nowS * 1000), left);
  if (want > 0 && typeof rand === 'function' && dice(rand) < FIND_SOURCES[source].p) {
    // ONE TRANSACTION: the day's count first, under its cap - the count's own row decides - then the cakes where it moved
    const [took] = await db.batch([
      db.prepare('UPDATE fest_finds SET found = found + ?3 WHERE account = ?1 AND day = ?2 AND found + ?3 <= ?4 RETURNING found').bind(player.id, day, want, FIND_CAKES_PER_DAY),
      db.prepare('UPDATE players SET fest_cakes = fest_cakes + ?2 WHERE id = ?1 AND changes() > 0').bind(player.id, want),
    ]);
    if (took?.results?.[0]) found = want;
  }
  const today = FIND_CAKES_PER_DAY - left + found;
  return { found, cakes: await cakesOf(db, player.id), today, ...(today >= FIND_CAKES_PER_DAY ? { capped: true } : {}) };
}

/**
 * A SALE: ware `body.ware` (festivalLaw FESTIVAL_WARES) for its price, under the client's request id `body.rid` - one
 * guarded UPDATE that takes the price only while the account's cakes cover it and, for an account ware, only while the
 * account does not own it yet (and lays it on the row); a Hearth Offering is counted on the row (`fest_bowls`).
 * `{ ware, cakes, bowls, wares }`; asked again by the same id,
 * `{ repeat: true, ware, ... }` and nothing moves. Refusals: `ware`, `rid`, `owned`, `cakes` (with `cakes`), `closed`.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body @param {any} env
 */
export async function buyFestival(ctx, player, body, env) {
  const { db, nowS } = ctx;
  const rid = body?.rid;
  if (typeof rid !== 'string' || !SALE_RID_RE.test(rid)) return { error: 'rid' };
  if (player?.handle) {
    // a sale asked twice is one - answered before the gate (AUDIT 28 M2's rule: a request that was made is answered,
    // whatever the switch says now)
    const had = await db.prepare('SELECT ware FROM fest_sales WHERE account = ?1 AND rid = ?2').bind(player.id, rid).first();
    if (had) return { repeat: true, ...(await saleAnswer(db, player.id, had.ware)) };
  }
  const shut = await gate(ctx, player, env);
  if (shut) return shut;
  if (!inDays(nowS)) return { error: 'closed' };
  const w = wareById(body?.ware);
  if (!w) return { error: 'ware' };
  const own = accountWare(w), bowl = bowlWare(w);
  if (own && festivalWaresHeld((await db.prepare('SELECT fest_wares FROM players WHERE id = ?1').bind(player.id).first())?.fest_wares).includes(w.id)) return { error: 'owned' };
  const [took] = await db.batch([
    db.prepare(`UPDATE players SET fest_cakes = fest_cakes - ?2${own ? ", fest_wares = TRIM(fest_wares || ' ' || ?3)" : ''}${bowl ? ', fest_bowls = fest_bowls + 1' : ''}
      WHERE id = ?1 AND fest_cakes >= ?2${own ? " AND (' ' || fest_wares || ' ') NOT LIKE ('% ' || ?3 || ' %')" : ''} RETURNING fest_cakes`)
      .bind(player.id, w.price, ...(own ? [w.id] : [])),
    db.prepare('INSERT INTO fest_sales (account, rid, ware, price, at) SELECT ?1, ?2, ?3, ?4, ?5 WHERE changes() > 0').bind(player.id, rid, w.id, w.price, nowS),
  ]);
  if (!took?.results?.[0]) return { error: 'cakes', cakes: await cakesOf(db, player.id) };
  return saleAnswer(db, player.id, w.id);
}
async function saleAnswer(/** @type {any} */ db, /** @type {string} */ id, /** @type {string} */ ware) {
  const row = await db.prepare('SELECT fest_cakes, fest_bowls, fest_wares FROM players WHERE id = ?1').bind(id).first();
  return { ware, cakes: int(row?.fest_cakes), bowls: int(row?.fest_bowls), wares: festivalWaresHeld(row?.fest_wares) };
}

// ═══ THE HEARTH OFFERINGS ════════════════════════════════════════════════════════════════════════════════════════════
/** A home the named character of this account owns (never a guild's hall: its yard is its keepers', its door its
 *  guild's) - the offering's own test. */
const OWNED_HOME = `EXISTS (SELECT 1 FROM homes h WHERE h.map_id = ?1 AND h.building_key = ?2 AND h.player = ?3 AND h.char_id = ?4 AND h.guild_id IS NULL)`;
const homeOk = (/** @type {any} */ b) => homeMapIdOk(b?.mapId) && homeBuildingKeyOk(b?.buildingKey);
const charOk = (/** @type {any} */ b) => typeof b?.character === 'string' && CHAR_ID_RE.test(b.character);

/**
 * A TOWN'S OFFERINGS, for anyone standing in it (a guest too - looking takes nothing): each standing at a home its owner
 * still owns, its cakes, whether it is the caller's account's own (`mine`) and whether the caller took from it today
 * (`taken`). Outside the festival's days, or with it shut for the caller, the caller's own alone - its owner can still
 * take it in, and nobody else can take from it. `{ mapId, open, offerings: [{ buildingKey, stock, owner, mine, taken }] }`.
 * A read and nothing else (service.js REPLICA_ROUTES).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body @param {any} env
 */
export async function festivalTown({ db, nowS }, player, body, env) {
  if (!homeMapIdOk(body?.mapId)) return { error: 'bad-home' };
  const day = utcDay(nowS);
  const open = !!player?.handle && festivalOpenFor(player, env) && inDays(nowS);
  const { results } = await db.prepare(`SELECT o.building_key, o.stock, o.player, h.owner_name,
      EXISTS (SELECT 1 FROM fest_takes t WHERE t.map_id = o.map_id AND t.building_key = o.building_key AND t.taker = ?2 AND t.day = ?3) AS taken
    FROM fest_offerings o JOIN homes h ON h.map_id = o.map_id AND h.building_key = o.building_key AND h.player = o.player AND h.char_id = o.char_id
    WHERE o.map_id = ?1${open ? '' : ' AND o.player = ?2'}`).bind(body.mapId, player?.id ?? '', day).all();
  return {
    mapId: body.mapId,
    open,
    offerings: (results ?? []).map((/** @type {any} */ r) => ({
      buildingKey: int(r.building_key), stock: int(r.stock), owner: String(r.owner_name ?? ''), mine: r.player === player?.id, taken: Number(r.taken) === 1,
    })),
  };
}

/**
 * SET OUT: one of the account's bowls (`fest_bowls`) at the named character's own home, its bowl empty (`{ ok, stock: 0,
 * bowls }`). One a home: one standing there is `set` - but one left by the home's old owner (the home sold since) goes
 * back to them, its bowl and its cakes, in the same transaction, and this one stands in its place. `item` with no bowl.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body @param {any} env
 */
export async function setOffering(ctx, player, body, env) {
  const shut = await gate(ctx, player, env);
  if (shut) return shut;
  const { db, nowS } = ctx;
  if (!inDays(nowS)) return { error: 'closed' };
  if (!homeOk(body) || !charOk(body)) return { error: 'home' };
  const { mapId, buildingKey, character } = body;
  if (!(await db.prepare(`SELECT ${OWNED_HOME} AS own`).bind(mapId, buildingKey, player.id, character).first())?.own) return { error: 'home' };
  const old = await db.prepare('SELECT player, char_id FROM fest_offerings WHERE map_id = ?1 AND building_key = ?2').bind(mapId, buildingKey).first();
  if (old && old.player === player.id && old.char_id === character) return { error: 'set' };
  // EVERY STATEMENT ASKS THE SAME THING - this character owns the home and its account holds a bowl - of the rows as
  // they stand in this transaction: the old owner's bowl is credited from its own row (taken in or come home since, it
  // credits nothing), then gone; then one bowl spent where no offering stands, and the offering laid where it was
  const may = `${OWNED_HOME} AND (SELECT fest_bowls FROM players WHERE id = ?3) >= 1`;
  const prev = `map_id = ?1 AND building_key = ?2 AND player = ?5 AND char_id = ?6`;
  const [, , spent, laid] = await db.batch([
    db.prepare(`UPDATE players SET fest_cakes = fest_cakes + (SELECT stock FROM fest_offerings WHERE ${prev}), fest_bowls = fest_bowls + 1
      WHERE id = ?5 AND EXISTS (SELECT 1 FROM fest_offerings WHERE ${prev}) AND ${may}`).bind(mapId, buildingKey, player.id, character, old?.player ?? '', old?.char_id ?? ''),
    db.prepare(`DELETE FROM fest_offerings WHERE ${prev} AND ${may}`).bind(mapId, buildingKey, player.id, character, old?.player ?? '', old?.char_id ?? ''),
    db.prepare(`UPDATE players SET fest_bowls = fest_bowls - 1 WHERE id = ?3 AND ${may}
      AND NOT EXISTS (SELECT 1 FROM fest_offerings WHERE map_id = ?1 AND building_key = ?2) RETURNING fest_bowls`).bind(mapId, buildingKey, player.id, character),
    db.prepare(`INSERT INTO fest_offerings (map_id, building_key, player, char_id, stock, placed_at) SELECT ?1, ?2, ?3, ?4, 0, ?5 WHERE changes() > 0
      ON CONFLICT DO NOTHING RETURNING stock`).bind(mapId, buildingKey, player.id, character, nowS),
  ]);
  if (laid?.results?.[0]) return { ok: true, stock: 0, bowls: int(spent?.results?.[0]?.fest_bowls) };
  if (!(await db.prepare(`SELECT ${OWNED_HOME} AS own`).bind(mapId, buildingKey, player.id, character).first())?.own) return { error: 'home' };
  const row = await db.prepare('SELECT fest_bowls FROM players WHERE id = ?1').bind(player.id).first();
  return int(row?.fest_bowls) < 1 ? { error: 'item', bowls: 0 } : { error: 'set' };
}

/**
 * FILL: up to OFFERING_FILL of the owner's cakes into its own offering's bowl, never past OFFERING_STOCK_MAX - `{ stock,
 * cakes, moved }`. `none` (no offering of this character's here), `full`, `cakes` (none to give).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body @param {any} env
 */
export async function fillOffering(ctx, player, body, env) {
  const shut = await gate(ctx, player, env);
  if (shut) return shut;
  const { db, nowS } = ctx;
  if (!inDays(nowS)) return { error: 'closed' };
  if (!homeOk(body) || !charOk(body)) return { error: 'home' };
  const { mapId, buildingKey, character } = body;
  const row = await db.prepare('SELECT o.stock, p.fest_cakes FROM fest_offerings o JOIN players p ON p.id = o.player WHERE o.map_id = ?1 AND o.building_key = ?2 AND o.player = ?3 AND o.char_id = ?4')
    .bind(mapId, buildingKey, player.id, character).first();
  if (!row) return { error: 'none' };
  const n = Math.min(OFFERING_FILL, OFFERING_STOCK_MAX - int(row.stock), int(row.fest_cakes));
  if (int(row.stock) >= OFFERING_STOCK_MAX) return { error: 'full' };
  if (n <= 0) return { error: 'cakes', cakes: int(row.fest_cakes) };
  // the owner's cakes decide: taken only while they hold n and the bowl has room for n, and the bowl moves where they did
  const [took] = await db.batch([
    db.prepare(`UPDATE players SET fest_cakes = fest_cakes - ?5 WHERE id = ?3 AND fest_cakes >= ?5
      AND (SELECT stock FROM fest_offerings WHERE map_id = ?1 AND building_key = ?2 AND player = ?3 AND char_id = ?4) + ?5 <= ?6 RETURNING fest_cakes`)
      .bind(mapId, buildingKey, player.id, character, n, OFFERING_STOCK_MAX),
    db.prepare('UPDATE fest_offerings SET stock = stock + ?5 WHERE map_id = ?1 AND building_key = ?2 AND player = ?3 AND char_id = ?4 AND changes() > 0')
      .bind(mapId, buildingKey, player.id, character, n),
  ]);
  if (!took?.results?.[0]) return { error: 'cakes', cakes: await cakesOf(db, player.id) };
  const now = await db.prepare('SELECT stock FROM fest_offerings WHERE map_id = ?1 AND building_key = ?2').bind(mapId, buildingKey).first();
  return { stock: int(now?.stock), cakes: int(took.results[0].fest_cakes), moved: n };
}

/**
 * TAKE IN: the owner's offering taken off its door, its bowl and its cakes back to the account - `{ ok, cakes, bowls,
 * returned }`. ONE TRANSACTION: the credit reads the bowl it credits, and the bowl goes where it did. Under any switch and
 * on any day (a bowl's cakes are never lost to the festival's end); a guest has none. `none` where none of this
 * character's stands.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body
 */
export async function takeInOffering(ctx, player, body) {
  if (!player?.handle) return { error: 'guest' };
  if (overAccountRate(`fest:${player.id}`, ctx.nowS, FEST_OPS_MAX, FEST_OPS_WINDOW_S)) return { error: 'rate' };
  const { db } = ctx;
  if (!homeOk(body) || !charOk(body)) return { error: 'home' };
  const { mapId, buildingKey, character } = body;
  const key = 'map_id = ?1 AND building_key = ?2 AND player = ?3 AND char_id = ?4';
  const [back, gone] = await db.batch([
    db.prepare(`UPDATE players SET fest_cakes = fest_cakes + (SELECT stock FROM fest_offerings WHERE ${key}), fest_bowls = fest_bowls + 1
      WHERE id = ?3 AND EXISTS (SELECT 1 FROM fest_offerings WHERE ${key}) RETURNING fest_cakes, fest_bowls`).bind(mapId, buildingKey, player.id, character),
    db.prepare(`DELETE FROM fest_offerings WHERE ${key} AND changes() > 0 RETURNING stock`).bind(mapId, buildingKey, player.id, character),
  ]);
  const was = gone?.results?.[0], now = back?.results?.[0];
  if (!was || !now) return { error: 'none' };
  return { ok: true, returned: int(was.stock), cakes: int(now.fest_cakes), bowls: int(now.fest_bowls) };
}

/**
 * TAKE A CAKE from another account's offering: OFFERING_TAKE out of its bowl into the taker's count, once an offering a
 * UTC day, never from the taker's own account's - and its owner's `fest_given` and the taker's `fest_taken` counted in
 * the same transaction. `{ ok, cakes, stock }`; `own`, `taken`, `empty`, `none`.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body @param {any} env
 */
export async function takeFromOffering(ctx, player, body, env) {
  const shut = await gate(ctx, player, env);
  if (shut) return shut;
  const { db, nowS } = ctx;
  if (!inDays(nowS)) return { error: 'closed' };
  if (!homeOk(body)) return { error: 'home' };
  const { mapId, buildingKey } = body;
  const o = await db.prepare(`SELECT o.player, o.stock FROM fest_offerings o JOIN homes h ON h.map_id = o.map_id AND h.building_key = o.building_key AND h.player = o.player AND h.char_id = o.char_id
    WHERE o.map_id = ?1 AND o.building_key = ?2`).bind(mapId, buildingKey).first();
  if (!o) return { error: 'none' };
  if (o.player === player.id) return { error: 'own' };
  const day = utcDay(nowS);
  // the take's own row decides: one an account an offering a day, and only while the bowl the read named - the same
  // owner's, at a home that owner still owns - holds a cake
  const [took] = await db.batch([
    db.prepare(`INSERT INTO fest_takes (map_id, building_key, taker, day) SELECT ?1, ?2, ?3, ?4
      WHERE (SELECT o.stock FROM fest_offerings o JOIN homes h ON h.map_id = o.map_id AND h.building_key = o.building_key AND h.player = o.player AND h.char_id = o.char_id
        WHERE o.map_id = ?1 AND o.building_key = ?2 AND o.player = ?6 AND o.player <> ?3) >= ?5 ON CONFLICT DO NOTHING RETURNING taker`).bind(mapId, buildingKey, player.id, day, OFFERING_TAKE, o.player),
    db.prepare('UPDATE fest_offerings SET stock = stock - ?3 WHERE map_id = ?1 AND building_key = ?2 AND changes() > 0').bind(mapId, buildingKey, OFFERING_TAKE),
    db.prepare(`UPDATE players SET fest_cakes = fest_cakes + ?2, fest_taken = fest_taken + ?2 WHERE id = ?1
      AND EXISTS (SELECT 1 FROM fest_takes WHERE map_id = ?3 AND building_key = ?4 AND taker = ?1 AND day = ?5)
      AND changes() > 0`).bind(player.id, OFFERING_TAKE, mapId, buildingKey, day),
    db.prepare('UPDATE players SET fest_given = fest_given + ?2 WHERE id = ?1 AND changes() > 0').bind(o.player, OFFERING_TAKE),
  ]);
  if (!took?.results?.[0]) {
    const had = await db.prepare('SELECT 1 AS t FROM fest_takes WHERE map_id = ?1 AND building_key = ?2 AND taker = ?3 AND day = ?4').bind(mapId, buildingKey, player.id, day).first();
    return { error: had ? 'taken' : 'empty' };
  }
  const left = await db.prepare('SELECT stock FROM fest_offerings WHERE map_id = ?1 AND building_key = ?2').bind(mapId, buildingKey).first();
  return { ok: true, cakes: await cakesOf(db, player.id), stock: int(left?.stock) };
}

/** The answer's status by its refusal: a guest's is the session's (403), a shut festival a conflict with the calendar
 *  (409), a spent rate 429; every other refusal a request the law refuses (400). */
export const FEST_STATUS = Object.freeze({ guest: 403, closed: 409, rate: 429, capped: 429 });
