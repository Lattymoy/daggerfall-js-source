// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT1c (2026-09-30, Mac: "Finish the seats") - THE TURNING: the week
// settled, the Charters claimed, the Contested seats and the Rights of
// Siege named, the Legacy carried.
//
// bible/11-Multiplayer/Seats-Arc.md 5.2: "The Turning is never a job that
// runs. The account service settles week N the first time anything asks
// about any seat after N's boundary (settleWeek(N), one D1 transaction,
// idempotent on town_seat_weeks.week - a second reader finds it
// settled)." The decision is townSeatLaw.js turningPlan, pure; this file
// gathers what it reads and writes what it answers, in ONE batch whose
// first statement is the week's own key - a plain INSERT, so a second
// reader racing the first fails on the key and its whole batch rolls back.
// A batch that fails for any other reason (a treasury emptied between the
// read and the write) rolls back whole too, and the next read settles it
// again.
//
// The settle reads the week's standings as they stood at its Turning
// (seatInfluence.js gatherStandings - a home's days counted to the
// boundary, not to the reader's now). SEAT1d: each holder's week beside
// it - its own members' Watch there, the gates felled in its region, its
// writs filled there, its Tithe and what it owes from Neglect, the Edict
// proclaimed for the coming week - and the accounts that played (the
// crown's scale); the batch pays the upkeep and the Edicts, lapses a
// Charter neglected twice, writes every Standing, and sends a Bounty's
// unspent escrow home. SEAT2a: the battles a Right or a Contested seat names placed in
// the coming week (step 8) - their fighting is the relay's. CROWN1: a crown's Conscription
// that ruled the week paid out of the conscripted guilds' Tithe (7.6), after their upkeep;
// and part two: a Royal Tourney's prize escrowed as it is made law, and the week's champion
// named, paid and titled as its week settles. CROWN2: each vassal's tribute to its liege (5% of
// its week's Tithe, after its upkeep), the liege's half-reach on a vassal's defence, a fealty
// broken (the breaker's Standing -10 at every seat) or lapsed (a pair that no longer fits).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { confirmedSeats, seatsOpenFor } from './townSeats.js';
import { gatherStandings, seatGuildsOf, agreedGateRegions, allIn, holdsRead, holdsFrom, battlesRead, battlesFrom } from './seatInfluence.js';   // SEAT-CAP: allIn, every guild list read IN_CHUNK at a time
import { activeIn, edictsOf, edictsRead, edictsFrom } from './seatHolding.js';
import { redRead, redFrom } from './seatPolitics.js';   // SEAT-BATCH: the list's red lines, in its one batch
import { windowOf } from './seatBattles.js';   // SEAT2a: the holder's window, frozen into its battle
import { royalTurning } from './seatRoyal.js';   // CROWN1 part two: a Royal Tourney's champion named
import { incursionStatements } from './seatIncursion.js';   // AUDIT-SEATS: a Daedric Incursion's Marks
import { fortsSeasonStatements, campsSpent, fortTiersOf, fortsLapsedStatements, campsWorn } from './seatForts.js';   // SEAT2b: a Season's wear, the Siege Camps spent; part two: a holder's Shrine; AUDIT SEATS-2 S5, S4: a lapse's projects fallen, the worn gate's Rams
import { shrineStanding, marketHallTitheCap } from '../../src/net/fortLaw.js';   // SEAT2b part two (7.5): the Shrine's Standing a week
import { weekSettled, keepWeekSettled } from './weekKept.js';   // PRIMARY-FOLD: a week read settled, kept
import { swordsSettled } from './seatSiege.js';   // AUDIT-SEATS S3: a void battle's Sellsword escrow home
import { gameDayAt, gateTimes } from '../../src/net/gate/gateLaw.js';
import { guildActorOf } from './guilds.js';
import { mustChange } from './realm.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { GUILD_RANK_MASTER } from '../../src/net/guild/guildLaw.js';
import { seatWeekOf, seatWeekStartMs, seatKeyOk, turningPlan, seatGlyphsOf, seatTitleOf, SEAT_WEEK_MS, STANDING_START, placeBattles, atSiegeWindow, CROWN_SEAT_REGIONS, conscriptionDue,
  fealtyReckoning, fealtyTribute, TITHE_CAP, seasonEndingAt, seasonStanding, seasonTitles, seasonOf, seasonRibbons, keptWholeSeason } from '../../src/net/townSeatLaw.js';
import { tideAt } from '../../src/net/tideLaw.js';   // SEASON1 part two: the Tides
import { MARKS_MAX } from '../../src/net/marksLaw.js';

/** SEASON1 (18: "At its end seats, influence, fortifications and history are wiped; Marks, the Stores and profession
 *  tracks are kept"): what Season 0's last Turning clears, after it has settled its own week. DECIDED: what money is
 *  still owed out of - a battle's contracts, an Edict's escrow, a Royal Tourney's prize - and the titles and Honours
 *  earned stay, and so does every red line. */
export const SEASON_ZERO_WIPED = Object.freeze(['town_seat_holds', 'town_seat_legacy', 'town_seat_pledges', 'town_seat_binds', 'town_seat_influence',
  'town_seat_renown', 'town_seat_rights', 'town_seat_aftermath', 'town_seat_windows', 'town_seat_stockpile', 'town_seat_levies', 'town_seat_history',
  'guild_fealty', 'guild_pacts',
  // SEAT2b (18: "At its end seats, influence, fortifications and history are wiped"): the works, their projects' holds, the
  // Fortifiers' saves and the Siege Camps
  'town_seat_forts', 'town_seat_fort_held', 'town_seat_fortifier', 'town_seat_camps']);
/** AUDIT-SEATS S5 (3.2: "a struck key is never witnessed again" - the strike's own history row says so, townSeats.js
 *  struck): what the wipe keeps of a table it clears - every strike, so a seat struck in Season 0 stays struck. */
export const SEASON_ZERO_KEPT = Object.freeze({ town_seat_history: "kind = 'strike'" });

/** The most weeks one read settles - a service asleep for longer starts its count again from there. */
export const SETTLE_WEEKS_MAX = 8;
/** AUDIT-SEATS S11 (18: "Influence rows are summed into weekly totals at the Turning and pruned after 4 weeks"): the weeks
 *  of influence and Renown rows a Turning keeps - its own and the three before. Nothing reads them older: the standings,
 *  the caps and a Tourney's dead heat read their own week or the one before it; the totals live on in the Legacy and the
 *  Chronicle (a claim's, a Right's); the Hall of Records reads the history. */
export const INFLUENCE_KEPT_WEEKS = 4;

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
const turningOf = (week) => Math.floor((seatWeekStartMs(week) + SEAT_WEEK_MS) / 1000);

/** A guild as the Chronicle keeps it: its name and tag that day. */
async function namesOf(db, ids) {
  const list = [...new Set(ids)].filter(Boolean);
  if (!list.length) return new Map();
  const results = await allIn(db, list, (qs) => `SELECT id, name, tag FROM guilds WHERE id IN (${qs})`);
  return new Map(results.map((g) => [g.id, { name: g.name, tag: g.tag }]));
}

/**
 * SETTLE WEEK `week` (SEAT0 5.2) - the plan over its standings, written in one batch keyed on the week. Answers
 * `{ settled: true, plan }`, or `{ settled: false }` when another reader settled it first (or the batch rolled back -
 * the next read settles it again).
 * SEASON1: `zero` the week Season 0 began (townSeatLaw.js seasonZeroOf), or null - no Season counted. A Turning that ends a
 * Season names its titles and moves every Standing halfway back toward 50, with no Legacy carried; Season 0's end
 * settles its own week, names nothing for the next and wipes the seats (SEASON_ZERO_WIPED).
 * @param {any} db
 * @param {number} week
 * @param {number} nowS
 * @param {number|null} [zero]
 */
export async function settleWeek(db, week, nowS, zero = null) {
  if (await db.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').bind(week).first()) return { settled: false };
  const atS = turningOf(week);
  const registry = await confirmedSeats(db, nowS, { fresh: true });   // D1-LOAD: the Turning reads the table as it stands
  const { results: pledgedKeys = [] } = await db.prepare('SELECT DISTINCT key FROM town_seat_pledges WHERE week = ?').bind(week).all();
  const { results: holdRows = [] } = await db.prepare('SELECT key, guild_id, region, tier, standing, truce_week, tithe, owed, since_week FROM town_seat_holds').all();
  const holds = new Map(holdRows.map((h) => [Number(h.key), h]));
  const keys = [...new Set([...pledgedKeys.map((p) => Number(p.key)), ...holds.keys()])].filter((k) => registry.has(k)).sort((a, b) => a - b);
  const unregistered = holdRows.filter((h) => !registry.has(Number(h.key)));   // AUDIT-SEATS S4: lapsed at this Turning
  const { results: legacyRows = [] } = await db.prepare('SELECT key, guild_id, amount FROM town_seat_legacy WHERE week = ?').bind(week).all();
  const legacyOf = new Map(legacyRows.map((l) => [`${l.key}\n${l.guild_id}`, Number(l.amount)]));
  const next = week + 1;
  // SEAT1d: the holders' week - the gates the week's days felled, region by region; the Edicts proclaimed for the next
  const fromS = Math.floor(seatWeekStartMs(week) / 1000);
  const days = [];
  for (let d = gameDayAt(fromS * 1000); d <= gameDayAt(atS * 1000); d++) { const r = gateTimes(d).riseAt / 1000; if (r >= fromS && r < atS) days.push(d); }
  const gatesIn = new Map();
  const agreed = await agreedGateRegions(db, days);
  for (const region of agreed.values()) gatesIn.set(region, (gatesIn.get(region) ?? 0) + 1);
  const { results: proclaimed = [] } = await db.prepare("SELECT key, edict, guild_id, set_aside FROM town_seat_edicts WHERE week = ? AND state = 'proclaimed'").bind(next).all();
  // SEAT2a part three: the week's sieges remembered (6.5, 6.8) - a holder that held or won by forfeit defends at x1.2, its
  // challenger barred from the seat at this Turning
  const { results: afterRows = [] } = await db.prepare('SELECT key, guild_id, what FROM town_seat_aftermath WHERE week = ?').bind(week).all();
  const aftermath = (key, what) => afterRows.filter((r) => Number(r.key) === key && r.what === what).map((r) => r.guild_id);
  // AUDIT-SEATS S3 (17: "A room lost ... voids the siege: the holder keeps the seat for now, and the challenger's Right
  // carries to the holder's window the next week"): THE WEEK'S BATTLES NO RESULT REACHED by its Turning - void now (a
  // result that comes later is refused, seatSiege.js), their Sellswords' escrow home; a siege's Right carried where its
  // holder still holds the seat against a challenger still standing. DECIDED: a void Tourney carries nothing - the seat
  // stays unheld and this Turning's standings decide it afresh, as any unheld seat's. A battle a strike voided (townSeats.js)
  // is void already: its escrow alone.
  const { results: unfought = [] } = await db.prepare(`SELECT b.key, b.kind, b.attacker, b.defender, b.state, r.total, r.defence, EXISTS (SELECT 1 FROM guilds g WHERE g.id = b.attacker) AS standing
    FROM town_seat_battles b LEFT JOIN town_seat_rights r ON r.week = b.week AND r.key = b.key AND r.kind = b.kind
    WHERE b.week = ? AND b.state IN ('scheduled', 'void') AND NOT EXISTS (SELECT 1 FROM town_seat_results x WHERE x.week = b.week AND x.key = b.key) ORDER BY b.key`).bind(week).all();
  const carriedAt = new Map(unfought.filter((u) => u.state === 'scheduled' && u.kind === 'siege' && Number(u.standing) && holds.get(Number(u.key))?.guild_id === u.defender)
    .map((u) => [Number(u.key), { guild: u.attacker, total: Number(u.total ?? 0), defence: Number(u.defence ?? 0) }]));
  // SEAT2b part two (c) (7.7: "Fail, and the Charter lapses"): A REVOLT NO RESULT REACHED - nobody felled its Captain (a
  // revolt nobody came to has no room and no receipt; one fought out carries `attack`, applied at its claim) - its
  // holder's Charter lapses at this Turning (the plan's 'revolt')
  const revolted = new Set(unfought.filter((u) => u.state === 'scheduled' && u.kind === 'revolt' && u.defender === holds.get(Number(u.key))?.guild_id).map((u) => Number(u.key)));
  // CROWN2 (7.8): THE FEALTIES standing - each pair's Charters as they stand now; one that no longer fits lapses (no
  // Standing), one broken ends (its breaker's Standing -10 at every seat), the rest give the liege's half-reach on the
  // vassal's defence; each sworn the week through pays its tribute
  const charters = holdRows.map((h) => ({ key: Number(h.key), guild: h.guild_id, tier: h.tier, region: Number(h.region) }));
  const chartersOf = (g) => charters.filter((h) => h.guild === g);
  const { results: fealtyRows = [] } = await db.prepare("SELECT vassal, liege, state, broken_by FROM guild_fealty WHERE state IN ('sworn', 'breaking')").all();
  const reckoned = fealtyReckoning(fealtyRows, charters);
  const { fealties, breakers } = reckoned;
  // CROWN1 (7.6): THE CONSCRIPTIONS that ruled the week - each crown's, still held by the guild that proclaimed it, over
  // the Tithe every guild took this week; a seat that pays loses its Standing row (CROWN2: never a vassal of that crown's)
  const conscriptions = [];
  const ruling = [...(await edictsOf(db, week))].filter(([key, e]) => e.edict === 'conscription' && holds.get(key)?.guild_id === e.guild && holds.get(key)?.tier === 'crown');
  let tithes = new Map();
  if (ruling.length || fealties.length) {
    // AUDIT-SEATS S11: the week's days bound the walk (idx_marks_day) - `at` alone has no index, and the ledger is every Mark
    const { results: titheRows = [] } = await db.prepare(`SELECT dst_id, SUM(amount) AS n FROM marks_ledger
      WHERE day BETWEEN ? AND ? AND dst_kind = 'guild' AND kind = 'tithe' AND at >= ? AND at < ? GROUP BY dst_id`)
      .bind(utcDay(fromS), utcDay(atS), fromS, atS).all();
    tithes = new Map(titheRows.map((t) => [t.dst_id, Number(t.n)]));
  }
  for (const [key, e] of ruling) {
    const vassals = new Set(fealties.filter((f) => f.liege === e.guild).map((f) => f.vassal));
    for (const d of conscriptionDue({ kingdom: CROWN_SEAT_REGIONS[Number(holds.get(key).region)], crownGuild: e.guild, holds: charters, tithes, vassals })) {
      if (d.amount > 0) conscriptions.push({ crownKey: key, crown: e.guild, ...d });
    }
  }
  const conscripted = new Set(conscriptions.flatMap((c) => c.keys));
  const counted = !!seasonOf(week, zero);   // SEASON1 part two: the Tides roll while a Season is counted
  const seats = [];
  for (const key of keys) {
    const seat = registry.get(key);
    const at = await seatGuildsOf(db, key, week);
    const list = await gatherStandings(db, seat, week, atS, counted);
    const h = holds.get(key);
    let holder = null;
    if (h) {
      const watched = await db.prepare("SELECT 1 FROM town_seat_influence WHERE week = ? AND key = ? AND guild_id = ? AND source = 'watch' LIMIT 1").bind(week, key, h.guild_id).first();
      const writs = await db.prepare("SELECT COUNT(*) AS n FROM guild_writs WHERE guild_id = ? AND region = ? AND state = 'filled' AND closed_at >= ? AND closed_at < ?")
        .bind(h.guild_id, Number(h.region), fromS, atS).first();
      const e = proclaimed.find((x) => Number(x.key) === key && x.guild_id === h.guild_id) ?? null;
      holder = {
        guild: h.guild_id, standing: Number(h.standing), truceWeek: h.truce_week == null ? null : Number(h.truce_week),
        tithe: Number(h.tithe), owed: Number(h.owed), watched: !!watched, gates: gatesIn.get(Number(h.region)) ?? 0, writs: Number(writs?.n ?? 0),
        edict: e?.edict ?? null, setAside: Number(e?.set_aside ?? 0), bonus: aftermath(key, 'bonus').includes(h.guild_id),
        conscripted: conscripted.has(key),
        // CROWN2: a vassal's liege's reach here, halved in the defence (seatDefence); a breaker's Standing row
        liegeReach: reckoned.liegeReach(h.guild_id, registry.get(key)),
        brokeFealty: breakers.has(h.guild_id),
        // SEASON1 part two (9.3): the week's Tide here (a Royal Wedding's Standing, a Tax Revolt's) and the coming week's
        // (a Festival's cost)
        tide: tideAt(week, seat.region, counted), tideNext: tideAt(next, seat.region, !!seasonOf(next, zero)),
        // SEAT2b part two (7.5: "Standing +1 a week" a tier): the Shrine standing at the Turning's clock (its due raised first)
        ...(await (async () => { const f = await fortTiersOf(db, key, atS); return { shrine: shrineStanding(f.shrine ?? 0), titheCap: marketHallTitheCap(TITHE_CAP[h.tier] ?? 0, f.market ?? 0) }; })()),   // AUDIT SEATS-2 L1: and the Market Hall's Tithe cap, Standing's measure
        revolted: revolted.has(key),   // SEAT2b part two (c)
      };
    }
    seats.push({
      key, tier: seat.tier, holder, barred: aftermath(key, 'barred'), carried: carriedAt.get(key) ?? null,   // AUDIT-SEATS S3
      guilds: list.map((s) => ({ guild: s.guild, influence: s.total, legacy: legacyOf.get(`${key}\n${s.guild}`) ?? 0, pledgedAt: at.get(s.guild) ?? atS })),
    });
  }
  const guildIds = [...new Set(seats.flatMap((s) => s.guilds.map((g) => g.guild)))];
  // the holders' treasuries too - a holder nobody else pledged against still pays its upkeep
  const purseIds = [...new Set([...guildIds, ...holdRows.map((h) => h.guild_id)])];
  const purses = await allIn(db, purseIds, (qs) => `SELECT guild_id, balance FROM guild_marks WHERE guild_id IN (${qs})`);   // SEAT-CAP: every guild pledged anywhere
  const reckonedPlan = turningPlan({ week, seats, treasuries: new Map(purses.map((p) => [p.guild_id, Number(p.balance)])), active: await activeIn(db, week) });
  // SEASON1 (9.1, 18): the Season this Turning ends, if it ends one - Season 0's end settles its own week and sets nothing
  // up for the next (no Charter claimed, no Right, no battle, no Edict, no Legacy), then wipes the seats
  const ending = seasonEndingAt(week, zero);
  const wipe = ending?.n === 0;
  // SEAT2b part two (c): a Season's end sets every Standing halfway back toward 50 - no seat revolts at it
  const plan = wipe ? { ...reckonedPlan, claims: [], contested: [], rights: [], edicts: [], standings: [], held: [], legacy: [], revolts: [] }
    : ending ? { ...reckonedPlan, revolts: [] } : reckonedPlan;
  const names = await namesOf(db, [...purseIds, ...fealties.flatMap((f) => [f.vassal, f.liege]), ...unfought.flatMap((u) => [u.attacker, u.defender])]);   // CROWN2: a lapsed liege may hold nothing now; AUDIT-SEATS S3: a void battle's two
  const history = (key, kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)')
    .bind(key, week, kind, JSON.stringify(data), nowS);
  /** AUDIT-SEATS: a Chronicle row naming what a payment PAID - the amount of ledger row `rid`, which this batch wrote just
   *  before it (what the treasury held, up to the due) - and none where an empty treasury paid nothing. */
  const paidHistory = (key, kind, data, rid) => db.prepare(`INSERT INTO town_seat_history (key, week, kind, data, at)
    SELECT ?1, ?2, ?3, json_set(?4, '$.marks', amount), ?5 FROM marks_ledger WHERE actor = 'seats' AND rid = ?6`).bind(key, week, kind, JSON.stringify(data), nowS, rid);   // the (actor, rid) index
  const stmts = [db.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').bind(week, nowS)];
  // STANDING-TREND (7.9: "Standing and its trend"): each held seat's Standing as this Turning found it and as it leaves
  // it - a row the Chronicle never shows (seatInfluence.js chronicleOf), first in the batch; the standings read names
  // the holder's `was` off it the week after
  for (const w of plan.standings) stmts.push(history(w.key, 'standing', { guild: w.guild, was: Number(holds.get(Number(w.key))?.standing ?? w.standing), standing: ending ? seasonStanding(w.standing) : w.standing }));
  for (const c of plan.claims) {
    // the fee burnt from the treasury - only where it holds it and the seat is still unheld, or the whole settle rolls back
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'guild', ?1, 'burn', NULL, 'seat-claim', ?2, ?3, ?4, 'seats', 'The Turning', ?5
      WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2 AND NOT EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?6)`)
      .bind(c.guild, c.fee, utcDay(nowS), nowS, `claim-${week}-${c.key}`, c.key), mustChange(db));
    stmts.push(db.prepare('INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(c.key, c.guild, registry.get(c.key).region, registry.get(c.key).tier, next, STANDING_START, next, nowS));
    stmts.push(history(c.key, 'claim', { guild: names.get(c.guild), total: c.total, fee: c.fee }));
  }
  for (const c of plan.contested) {
    stmts.push(db.prepare("INSERT INTO town_seat_rights (week, key, kind, guild_id, against, total, defence, at) VALUES (?, ?, 'tourney', ?, ?, 0, 0, ?)")
      .bind(next, c.key, c.a, c.b, nowS));
    stmts.push(history(c.key, 'contested', { a: names.get(c.a), b: names.get(c.b) }));
  }
  for (const r of plan.rights) {
    const holder = holds.get(r.key).guild_id;
    stmts.push(db.prepare("INSERT INTO town_seat_rights (week, key, kind, guild_id, against, total, defence, at) VALUES (?, ?, 'siege', ?, ?, ?, ?, ?)")
      .bind(next, r.key, r.guild, holder, r.total, r.defence, nowS));
    // AUDIT-SEATS S3: a carried Right's row is its void siege's (below), which says it carries
    if (!r.carried) stmts.push(history(r.key, 'right', { guild: names.get(r.guild), holder: names.get(holder), total: r.total, defence: r.defence }));
  }
  // SEAT2a (5.2 step 8, 6.3): THE SCHEDULE - every battle the Turning names placed in the coming week, in key order, a
  // siege at the holder's window frozen now (a crown's at its slot, a Tourney's Wednesday 20:00), moved where it would
  // overlap another battle of either of its guilds; a battle no start can hold is void, the Chronicle says so
  const battles = [
    ...plan.contested.map((c) => ({ key: c.key, kind: 'tourney', attacker: c.a, defender: c.b })),
    ...plan.rights.map((r) => ({ key: r.key, kind: 'siege', attacker: r.guild, defender: holds.get(r.key).guild_id })),
    // SEAT2b part two (c) (7.7, 6.3: "a revolt takes the holder's window"): no guild rises against the holder - its town does
    ...plan.revolts.map((r) => ({ key: r.key, kind: 'revolt', attacker: '', defender: r.guild })),
  ];
  for (const b of battles) {
    const seat = registry.get(b.key);
    Object.assign(b, { tier: seat.tier, kingdom: CROWN_SEAT_REGIONS[seat.region] ?? null, window: atSiegeWindow(b) ? await windowOf(db, b.key, b.defender) : null });
  }
  for (const r of plan.revolts) stmts.push(history(r.key, 'revolt', { guild: names.get(r.guild) }));
  const schedule = placeBattles(next, battles);
  for (const p of schedule.placed) {
    stmts.push(db.prepare('INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(next, p.key, p.kind, p.tier, p.attacker, p.defender, Math.floor(p.startsAt / 1000), Math.floor(p.endsAt / 1000), p.moved ? 1 : 0, nowS));
    if (p.moved) stmts.push(history(p.key, 'battle-moved', { at: Math.floor(p.startsAt / 1000) }));
  }
  for (const u of schedule.unplaced) stmts.push(history(u.key, 'battle-void', { kind: u.kind }));
  // SEAT2b (4.2, 5.2 step 7): THE SIEGE CAMPS SPENT - a challenger's camp at a seat sends its Ram Kits to the siege it won
  // there (where a Gatehouse stands for a Ram to strike: a crown's always, a palace's once raised), and everything else
  // in every camp of the week is burnt; nothing is ever withdrawn
  stmts.push(...(await campsSpent(db, week, next, plan.rights, (k) => registry.get(k)?.tier ?? 'palace')));
  // SEAT1d (7.1, 5.2 step 5): THE UPKEEP - burnt where the treasury holds it (or the settle rolls back whole), Neglect's
  // debt written, a Charter neglected twice lapsed and its coming Edict void
  const burn = (guild, kind, amount, rid) => db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    SELECT 'guild', ?1, 'burn', NULL, ?2, ?3, ?4, ?5, 'seats', 'The Turning', ?6 WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?3`)
    .bind(guild, kind, amount, utcDay(nowS), nowS, rid);
  for (const u of plan.upkeep) {
    if (u.state === 'paid' || u.state === 'late') {
      if (u.paid > 0) stmts.push(burn(u.guild, 'seat-upkeep', u.paid, `upkeep-${week}-${u.key}`), mustChange(db));
      stmts.push(db.prepare('UPDATE town_seat_holds SET owed = 0 WHERE key = ? AND guild_id = ?').bind(u.key, u.guild));
      if (u.state === 'late') stmts.push(history(u.key, 'late', { guild: names.get(u.guild), paid: u.paid }));
    } else if (u.state === 'neglect') {
      stmts.push(db.prepare('UPDATE town_seat_holds SET owed = ? WHERE key = ? AND guild_id = ?').bind(u.owed, u.key, u.guild));
      stmts.push(history(u.key, 'neglect', { guild: names.get(u.guild), owed: u.owed }));
    } else {
      stmts.push(db.prepare('DELETE FROM town_seat_holds WHERE key = ? AND guild_id = ?').bind(u.key, u.guild));
      stmts.push(...fortsLapsedStatements(db, u.key, atS));   // AUDIT SEATS-2 S5: its building projects fall with it
      stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND week = ? AND state = 'proclaimed'").bind(u.key, next));
      stmts.push(history(u.key, u.state === 'revolt' ? 'revolt-stood' : 'lapse', { guild: names.get(u.guild) }));   // SEAT2b part two (c): a revolt's lapse
    }
  }
  // the coming week's Edicts: law, their cost burnt (a Bounty's escrowed) - or fallen. AUDIT SEATS-3 A1: each row's state
  // asked to be the Edict the plan read - its edict and its set-aside, a re-proclaim racing the settle (a request stamped
  // before the boundary) or one taken back rolls the settle back whole, and the next read plans it again; never a
  // 20-Drake escrow made law as a 100000-Drake Bounty, a Festival's cost paid for a Royal Tourney
  const askedAside = (e) => Number(proclaimed.find((x) => Number(x.key) === e.key && x.guild_id === e.guild)?.set_aside ?? 0);
  for (const e of plan.edicts) {
    if (e.state === 'law') {
      if (e.cost > 0) {
        const held = e.edict === 'bounty' ? 'bounty' : e.edict === 'royal-tourney' ? 'royal' : null;   // CROWN1 part two: a Royal Tourney's prize held for its champion
        stmts.push(held
          ? db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
              SELECT 'guild', ?1, 'escrow', ?2, ?6, ?3, ?4, ?5, 'seats', 'The Turning', ?2
              WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?3`).bind(e.guild, `${held}:${e.key}:${next}`, e.cost, utcDay(nowS), nowS, `${held}-escrow`)
          : burn(e.guild, 'seat-edict', e.cost, `edict-${next}-${e.key}`), mustChange(db));
      }
      stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'law', cost = ? WHERE key = ? AND week = ? AND guild_id = ? AND state = 'proclaimed' AND edict = ? AND set_aside = ?")
        .bind(e.cost, e.key, next, e.guild, e.edict, askedAside(e)), mustChange(db));
      stmts.push(history(e.key, 'edict', { guild: names.get(e.guild), edict: e.edict }));
    } else {
      stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'unpaid' WHERE key = ? AND week = ? AND guild_id = ? AND state = 'proclaimed' AND edict = ? AND set_aside = ?")
        .bind(e.key, next, e.guild, e.edict, askedAside(e)), mustChange(db));
      stmts.push(history(e.key, 'edict-unpaid', { guild: names.get(e.guild), edict: e.edict }));
    }
  }
  // the week's Bounties done: what their escrow did not pay goes home - AUDIT-SEATS S1: burnt where the treasury is full
  // (MARKS_MAX, the guild_marks CHECK) or the guild gone, as the Conscription's CASE below; never a statement that fails,
  // so a guild topping its treasury to the cap can never hold the whole Turning back
  for (const [key, b] of await edictsOf(db, week)) {
    if (b.edict !== 'bounty') continue;
    const home = `EXISTS (SELECT 1 FROM guilds WHERE id = e.guild_id) AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = e.guild_id), 0) + e.set_aside - e.spent <= ${MARKS_MAX}`;
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', ?1, CASE WHEN ${home} THEN 'guild' ELSE 'burn' END, CASE WHEN ${home} THEN e.guild_id END, 'bounty-return', e.set_aside - e.spent, ?2, ?3, 'seats', 'The Turning', ?1 || ':return'
      FROM town_seat_edicts e WHERE e.key = ?4 AND e.week = ?5 AND e.state = 'law' AND e.set_aside > e.spent`)
      .bind(`bounty:${key}:${week}`, utcDay(nowS), nowS, key, week));
    stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'returned' WHERE key = ? AND week = ? AND state = 'law'").bind(key, week));
  }
  // CROWN1 (7.6): THE CONSCRIPTIONS PAID - after the upkeep and the Edicts, what is left of the guild's treasury up to
  // its due, to the crown (burnt where the crown's treasury is full, as a Tithe is); a treasury empty pays nothing
  for (const c of conscriptions) {
    const to = `COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?2), 0) + MIN(?3, balance) <= ${MARKS_MAX} AND EXISTS (SELECT 1 FROM guilds WHERE id = ?2)`;
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'guild', ?1, CASE WHEN ${to} THEN 'guild' ELSE 'burn' END, CASE WHEN ${to} THEN ?2 END, 'conscription', MIN(?3, balance), ?4, ?5, 'seats', 'The Turning', ?6
      FROM guild_marks WHERE guild_id = ?1 AND balance > 0`)
      .bind(c.guild, c.crown, c.amount, utcDay(nowS), nowS, `conscription-${week}-${c.crownKey}-${c.guild}`));
    const rid = `conscription-${week}-${c.crownKey}-${c.guild}`;   // AUDIT-SEATS: the Chronicle names what was paid, not the due
    stmts.push(paidHistory(c.crownKey, 'conscription', { guild: names.get(c.crown), from: names.get(c.guild) }, rid));
    for (const k of c.keys) stmts.push(paidHistory(k, 'conscripted', { guild: names.get(c.guild), crown: names.get(c.crown) }, rid));
  }
  // CROWN2 (7.8): THE FEALTIES - each vassal's tribute (5% of its week's Tithe, a fealty that stood the week through,
  // broken at this Turning or not), after its upkeep and Edicts and Conscription, from what is left of its treasury; then
  // the broken and the lapsed ended, the Chronicle saying so at the liege's crown and the vassal's seats
  const crownKeyOf = (g) => chartersOf(g).find((h) => h.tier === 'crown')?.key ?? null;
  for (const f of fealties) {
    const both = [crownKeyOf(f.liege), ...chartersOf(f.vassal).map((h) => h.key)].filter((k) => k != null);
    const owed = f.fits ? fealtyTribute(tithes.get(f.vassal) ?? 0) : 0;
    if (owed > 0) {
      const to = `COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?2), 0) + MIN(?3, balance) <= ${MARKS_MAX} AND EXISTS (SELECT 1 FROM guilds WHERE id = ?2)`;
      stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'guild', ?1, CASE WHEN ${to} THEN 'guild' ELSE 'burn' END, CASE WHEN ${to} THEN ?2 END, 'fealty-tribute', MIN(?3, balance), ?4, ?5, 'seats', 'The Turning', ?6
        FROM guild_marks WHERE guild_id = ?1 AND balance > 0`).bind(f.vassal, f.liege, owed, utcDay(nowS), nowS, `fealty-${week}-${f.vassal}`));
      const k = crownKeyOf(f.liege);
      if (k != null) stmts.push(paidHistory(k, 'fealty-tribute', { vassal: names.get(f.vassal), liege: names.get(f.liege) }, `fealty-${week}-${f.vassal}`));   // AUDIT-SEATS: what was paid
    }
    if (f.broken || !f.fits) {
      stmts.push(db.prepare('DELETE FROM guild_fealty WHERE vassal = ? AND liege = ?').bind(f.vassal, f.liege));
      for (const k of both) stmts.push(history(k, f.broken ? 'fealty-broken' : 'fealty-lapsed', { vassal: names.get(f.vassal), liege: names.get(f.liege), ...(f.broken ? { breaker: names.get(f.broken) } : {}) }));
    }
  }
  // CROWN1 part two (7.6): THE WEEK'S ROYAL TOURNEYS - each champion named, paid its prize and titled; none, the prize home
  stmts.push(...(await royalTurning(db, week, nowS, history, registry)));
  // AUDIT-SEATS (9.3): A DAEDRIC INCURSION'S MARKS - the gate days' second half, now three claims agree on their regions
  stmts.push(...incursionStatements(db, { week, agreed, counted, nowS }));
  // every held seat's Standing after its week (7.3) - SEASON1: halfway back toward 50 at a Season's end; the unchallenged
  // in the Chronicle
  for (const w of plan.standings) {
    stmts.push(db.prepare('UPDATE town_seat_holds SET standing = ? WHERE key = ? AND guild_id = ?').bind(ending ? seasonStanding(w.standing) : w.standing, w.key, w.guild));
  }
  for (const h of plan.held) {
    stmts.push(history(h.key, 'held', { guild: names.get(h.guild), standing: h.standing }));
  }
  for (const l of ending ? [] : plan.legacy) {   // SEASON1 (9.1): "Legacy is cleared"
    stmts.push(db.prepare('INSERT INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').bind(next, l.key, l.guild, l.amount));
  }
  // AUDIT-SEATS S4 (16: a struck seat's "Charter voids"): A CHARTER THE REGISTRY NO LONGER CONFIRMS - its seat struck, or
  // its witnesses fallen below three - lapsed (the Turning reckoned nothing of it: no upkeep, no Standing), its coming
  // Edict void; no fee refunded (a strike's own batch refunds it, townSeats.js strikeSeat)
  for (const h of unregistered) {
    stmts.push(db.prepare('DELETE FROM town_seat_holds WHERE key = ? AND guild_id = ?').bind(Number(h.key), h.guild_id));
    stmts.push(...fortsLapsedStatements(db, Number(h.key), atS));   // AUDIT SEATS-2 S5: its building projects fall with it
    stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND week = ? AND state = 'proclaimed'").bind(Number(h.key), next));
    stmts.push(history(Number(h.key), 'unregistered', { guild: names.get(h.guild_id) ?? { name: '', tag: '' } }));
  }
  // AUDIT-SEATS S3 (17): THE BATTLES NO RESULT REACHED, void - after every payment the plan reckoned, so the escrow coming
  // home moves none of them; the void asked in its own write (a result that landed since the read rolls the settle back
  // whole, and the next read settles it again with the result in hand), each Sellsword's escrow home
  const nameOr = (g) => names.get(g) ?? { name: '', tag: '' };
  for (const u of unfought) {
    const key = Number(u.key);
    if (u.state === 'scheduled') {
      stmts.push(db.prepare(`UPDATE town_seat_battles SET state = 'void' WHERE week = ?1 AND key = ?2 AND state = 'scheduled'
        AND NOT EXISTS (SELECT 1 FROM town_seat_results WHERE week = ?1 AND key = ?2)`).bind(week, key), mustChange(db));
      const carried = plan.rights.some((r) => r.key === key && r.carried);
      // SEAT2b part two (c): a revolt's says so at its lapse (above) - none where its holder had already gone
      if (u.kind !== 'revolt') stmts.push(history(key, 'siege-void', { battle: u.kind, guild: nameOr(u.attacker), holder: nameOr(u.defender), carried }));
    }
    stmts.push(...(await swordsSettled(db, week, key, nowS, { voided: true })));
  }
  // AUDIT-SEATS S11 (18): the influence and Renown rows older than INFLUENCE_KEPT_WEEKS pruned (oldest week settled first,
  // so a service catching up keeps every week it has yet to settle)
  stmts.push(db.prepare('DELETE FROM town_seat_influence WHERE week <= ?').bind(week - INFLUENCE_KEPT_WEEKS));
  stmts.push(db.prepare('DELETE FROM town_seat_renown WHERE week <= ?').bind(week - INFLUENCE_KEPT_WEEKS));
  // SEASON1 (9.1): A SEASON'S END - its titles, each its guild's guildmaster's for good ("Crowned in Season N" for every
  // crown's, "Keeper of <Town>, Season N" for a seat held the whole Season), over the Charters that stood its last week
  // through (none lapsed now); and the Chronicle's line at every one of them (Season 0's titles none, its lines wiped below)
  if (ending) {
    const lapsed = new Set([...plan.upkeep.filter((u) => u.state === 'lapse' || u.state === 'revolt').map((u) => u.key), ...unregistered.map((h) => Number(h.key))]);   // AUDIT-SEATS S4
    const stood = holdRows.filter((h) => !lapsed.has(Number(h.key))).map((h) => ({ key: Number(h.key), guild: h.guild_id, tier: h.tier, since: Number(h.since_week) }));
    const titles = seasonTitles(ending, stood);
    const masters = await guildmastersOf(db, [...new Set(titles.map((t) => t.guild))]);
    for (const t of titles) {
      if (masters.has(t.guild)) stmts.push(db.prepare('INSERT OR IGNORE INTO town_seat_titles (account, title, key, week, at) VALUES (?, ?, ?, ?, ?)').bind(masters.get(t.guild), t.title, t.key, week, nowS));
    }
    // SEASON1 part two (9.1): the banner ribbon - each keeper's guild, for its members as they stand at this Turning
    for (const g of seasonRibbons(titles)) stmts.push(db.prepare('INSERT OR IGNORE INTO town_seat_ribbons (season, guild_id, at) VALUES (?, ?, ?)').bind(ending.n, g, atS));
    for (const h of stood) stmts.push(history(h.key, 'season-end', { guild: names.get(h.guild), season: ending.n, kept: keptWholeSeason(ending, h.since) }));
    // SEAT2b (9.1: "fortifications decay one tier"): every seat's works a tier down (Season 0's are wiped below)
    if (!wipe) stmts.push(...fortsSeasonStatements(db));
    if (!wipe) stmts.push(campsWorn(db, next));   // AUDIT SEATS-2 S4: and the camps' Rams where the wear left no gate
  }
  // SEASON1 (18): SEASON 0'S END - the Edicts proclaimed for the next week void (none was paid), then the seats wiped
  if (wipe) {
    stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE week = ? AND state = 'proclaimed'").bind(next));
    for (const t of SEASON_ZERO_WIPED) stmts.push(db.prepare(`DELETE FROM ${t}${SEASON_ZERO_KEPT[t] ? ` WHERE NOT (${SEASON_ZERO_KEPT[t]})` : ''}`));   // AUDIT-SEATS S5: the strikes kept
  }
  // AUDIT-SEATS S1: `failed` - the batch rolled back for a reason of its own (not a racing reader's key), so settleDue
  // stops there rather than settle a later week over it
  try { await db.batch(stmts); } catch { return { settled: false, failed: !(await db.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').bind(week).first()) }; }
  return { settled: true, plan, season: ending };
}

/** SEASON1: each guild's guildmaster's account, by guild. */
async function guildmastersOf(db, guilds) {
  if (!guilds.length) return new Map();
  const results = await allIn(db, guilds, (qs) => `SELECT guild_id, player FROM guild_members WHERE rank = ? AND guild_id IN (${qs})`, [GUILD_RANK_MASTER]);
  return new Map(results.map((r) => [r.guild_id, r.player]));
}

/** THE SEATS AS THE MAP AND THE ARRIVAL NEED THEM: each listed seat with its holder and this week's battle at it (a
 *  Contested seat's Tourney, a held seat's siege), or null. SEAT1d: the holder with the Edict that rules this week (the
 *  client's shops, its arrival and its Festival read it), or null. And the day's red lines (seatPolitics.js redOf).
 *  SEAT-BATCH (2026-10-16, the account database's primary at its ceiling of round trips - bible/11-Multiplayer/
 *  Scale-Arc.md SEAT-BATCH): the six reads in ONE batch, where each was a round trip of its own - every list asked the
 *  primary seven times past its session's lookup, and the primary's ceiling is its round trips, not its rows. Answers
 *  `{ seats, red }`. */
export async function seatsBoard(db, seats, nowS) {
  const week = weekAt(nowS);
  // SEAT2b part two (7.5): each seat's works standing now - a project whose day has come counts (seatForts.js fortTierAt's
  // rule, read and never written) - so every client knows a members' Harbour, the Watchtowers and the crafting halls
  const fortsRead = db.prepare(`SELECT key, work, CASE WHEN building IS NOT NULL AND stands_at IS NOT NULL AND stands_at <= ?1
    THEN building ELSE tier END AS t FROM town_seat_forts WHERE tier > 0 OR (building IS NOT NULL AND stands_at IS NOT NULL AND stands_at <= ?1)`).bind(nowS);
  const [heldRes, rightsRes, revoltsRes, edictsRes, fortsRes, redRes] = await db.batch([holdsRead(db), ...battlesRead(db, week), edictsRead(db, week), fortsRead, redRead(db, nowS)]);
  const holds = holdsFrom(heldRes?.results), battles = battlesFrom(rightsRes?.results, revoltsRes?.results), edicts = edictsFrom(edictsRes?.results);
  const forts = new Map();
  for (const r of fortsRes?.results ?? []) if (Number(r.t) > 0) { const k = Number(r.key); forts.set(k, { ...(forts.get(k) ?? {}), [r.work]: Number(r.t) }); }
  return { red: redFrom(redRes?.results), seats: seats.map((s) => {
    const h = holds.get(s.key) ?? null;
    const e = edicts.get(s.key);
    return { ...s, holder: h ? { ...h, edict: e && e.guild === h.guild.id ? e.edict : null } : null, battle: battles.get(s.key) ?? null, ...(forts.has(s.key) ? { forts: forts.get(s.key) } : {}) };
  }) };
}

/**
 * THE TURNINGS DUE (SEAT0 5.2: "the first time anything asks about any seat"): every week before this one not yet
 * settled, oldest first - from the week after the last settled (or, on a service that has settled none, the last week
 * alone), at most SETTLE_WEEKS_MAX back. Cheap when nothing is due: one read.
 * @param {any} db
 * @param {number} nowS
 * @param {number|null} [zero] SEASON1: the week Season 0 began, or null
 */
export async function settleDue(db, nowS, zero = null) {
  const current = weekAt(nowS);
  const last = (await db.prepare('SELECT MAX(week) AS w FROM town_seat_weeks').first())?.w;
  const from = Math.max(last == null ? current - 1 : Number(last) + 1, current - SETTLE_WEEKS_MAX);
  let n = 0;
  for (let w = from; w < current; w++) {
    const r = await settleWeek(db, w, nowS, zero);
    if (r.settled) n++;
    // AUDIT-SEATS S1: a week that failed is the first the next read settles - never one left behind under a later week
    // (the next read starts after the last settled, so a week past a failure would be skipped for good)
    else if (r.failed) break;
  }
  return n;
}

/** SEAT-LEASE: how long one settler holds the Turning before another may take it, s - a settle takes seconds; one cut
 *  off (its client gone, its isolate lost) frees the Turning when this runs out. */
export const SETTLE_LEASE_S = 60;
/**
 * SEAT-LEASE (from play, 2026-10-11: the service swamped an hour after seat week 2's Turning): THE TURNINGS DUE, ONE
 * SETTLER AT A TIME. settleDue awaited by every seat route ran the whole settle in every request while a week was due -
 * hundreds of reads each, all at once; under load a settle outlasted its client's wait, the request was cancelled before
 * its batch committed, and the next began another, so the week never settled and the database drowned with it. Here a
 * caller that finds a week due takes the one lease (`town_seat_settling`, SETTLE_LEASE_S) and settles, freeing it after;
 * a caller that finds the lease held settles nothing and is told so - `{ settled, pending }`, `pending` while another
 * holds the Turning. Nothing due costs the one read it always did - once a week an isolate, since PRIMARY-FOLD (weekKept.js).
 * @param {any} db @param {number} nowS @param {number|null} [zero]
 */
export async function settleDueOnce(db, nowS, zero = null) {
  if (weekSettled(db, 'seats', weekAt(nowS))) return { settled: 0, pending: false };   // PRIMARY-FOLD: this isolate read the week settled (weekKept.js)
  const last = (await db.prepare('SELECT MAX(week) AS w FROM town_seat_weeks').first())?.w;
  if (last != null && Number(last) + 1 >= weekAt(nowS)) { keepWeekSettled(db, 'seats', weekAt(nowS)); return { settled: 0, pending: false }; }
  // D1-LOAD: a lease held is READ, never asked of the one writer - every seat request that finds the week due while
  // another settles (every client's list at the Turning) asked an INSERT that changed nothing, each one the writer's turn
  const held = await db.prepare('SELECT until FROM town_seat_settling WHERE id = 1').first();
  if (held && Number(held.until) > nowS) return { settled: 0, pending: true };
  const holder = crypto.randomUUID();
  const took = await db.prepare(`INSERT INTO town_seat_settling (id, holder, until) VALUES (1, ?1, ?2)
    ON CONFLICT (id) DO UPDATE SET holder = ?1, until = ?2 WHERE until <= ?3`).bind(holder, nowS + SETTLE_LEASE_S, nowS).run();
  if (!Number(took?.meta?.changes)) return { settled: 0, pending: true };
  try {
    return { settled: await settleDue(db, nowS, zero), pending: false };
  } finally {
    // a release that fails is the lease's own end, SETTLE_LEASE_S on - never the settle's answer lost
    try { await db.prepare('DELETE FROM town_seat_settling WHERE id = 1 AND holder = ?').bind(holder).run(); } catch { /* it runs out */ }
  }
}

/**
 * RELINQUISH A CHARTER (SEAT0 16: "The Guildmaster first relinquishes each Charter at its board - the seat is unheld at
 * once, its fortifications stay, a history row says so"). The guildmaster's alone, asked in the DELETE.
 * @param {{db: any, nowS: number}} ctx
 */
export async function relinquishSeat({ db, nowS }, player, env, { character, key } = {}) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (Number(a.me.rank) !== GUILD_RANK_MASTER) return { error: 'guild-rank' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const names = await namesOf(db, [a.me.guild_id]);
  const [gone] = await db.batch([
    db.prepare(`DELETE FROM town_seat_holds WHERE key = ?1 AND guild_id = ?2
      AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?3 AND guild_id = ?2 AND rank = ?4)`).bind(key, a.me.guild_id, Number(a.me.rid), GUILD_RANK_MASTER),
    db.prepare(`INSERT INTO town_seat_history (key, week, kind, data, at) SELECT ?1, ?2, 'relinquish', ?3, ?4 WHERE changes() > 0`)
      .bind(key, weekAt(nowS), JSON.stringify({ guild: names.get(a.me.guild_id) }), nowS),
    // AUDIT SEATS-2 S5: its building projects fall with the Charter (the tiers stay) - nothing where the DELETE moved none
    ...fortsLapsedStatements(db, key, nowS),
  ]);
  return gone?.meta?.changes ? { ok: true } : { error: 'seat-not-held' };
}

/**
 * SEAT1c (SEAT0 7.4): WHAT A CHARACTER'S GUILD'S CHARTERS GIVE IT at a token's mint - every member the glyphs
 * (seatGlyphsOf), its guildmaster the title (seatTitleOf). `{ glyphs, title, ts }` - empty and null for a character in no
 * guild, or one holding none.
 */
export async function seatBadgeOf(db, playerId, character, season = 0, member = undefined) {   // SEASON1: the Season counted, on the title's claim; SCALE4f part two: the mint's one membership read (guilds.js mintMemberOf)
  const m = member !== undefined ? member : typeof character === 'string'
    ? await db.prepare('SELECT guild_id, rank FROM guild_members WHERE player = ? AND char_id = ?').bind(playerId, character).first() : null;
  if (!m) return { glyphs: [], title: null, ts: null };
  const { results = [] } = await db.prepare('SELECT key, tier, region FROM town_seat_holds WHERE guild_id = ? ORDER BY key').bind(m.guild_id).all();
  const holds = results.map((h) => ({ key: Number(h.key), tier: h.tier, region: Number(h.region) }));
  const t = Number(m.rank) === GUILD_RANK_MASTER ? seatTitleOf(holds, season) : null;
  return { glyphs: seatGlyphsOf(holds), title: t?.title ?? null, ts: t?.ts ?? null };
}
/** SEAT1c: the seat titles an ACCOUNT may choose to wear - those its guildmaster characters' guilds' Charters give. The
 *  wardrobe offers them; a token wears one only for the guildmaster character it is minted for. CROWN1 part two: and the
 *  Royal Tourney's champion, which is the account's own (worn whatever character it brings). */
export async function seatTitlesOf(db, playerId) {
  const { results = [] } = await db.prepare(`SELECT h.key, h.tier, h.region FROM town_seat_holds h
    JOIN guild_members m ON m.guild_id = h.guild_id WHERE m.player = ? AND m.rank = ?`).bind(playerId, GUILD_RANK_MASTER).all();
  const out = new Set(results.map((h) => (h.tier === 'crown' ? 'protector' : 'warden')));
  // CROWN1 part two: and a Royal Tourney's champion, the account's own for good; SEASON1: and a Season's crowned and keeper
  const { results: kept = [] } = await db.prepare('SELECT DISTINCT title FROM town_seat_titles WHERE account = ?').bind(playerId).all();
  for (const k of kept) out.add(k.title);
  return ['warden', 'protector', 'crowned', 'keeper', 'champion'].filter((t) => out.has(t));
}
