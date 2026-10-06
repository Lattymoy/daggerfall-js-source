// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT1a (2026-09-30, Mac: "Finish the seats") - THE SEATS' REGISTRY:
// the seats the clients derived, witnessed, and the ones enough of them
// agree on.
//
// bible/11-Multiplayer/Seats-Arc.md 3.2 (Mac: "Figure it out"): the
// servers never hold ARENA2, so they learn the seats from the clients
// that derived them (src/systems/townSeats.js), and trust a seat only
// when enough agree. ONE TABLE, ONE LAW: a seat is witnessed as the
// professions' pixels are - `world_witness`, the kind `seat`, keyed by
// its map id, its report the seat's canonical bytes
// (net/townSeatLaw.js seatReportText) - and read by nodeLaw.js's
// witnessedFact: three witnesses agreeing byte for byte confirm it; two
// agreeing on another answer dispute it, and a disputed seat keeps every
// effect it had until a person rules; a lone dissenter is counted, never
// obeyed.
//
// ═══ WHO WITNESSES ═══════════════════════════════════════════════════
//
// A registered account a week old (WITNESS.ageS) - a guest or a new
// account reports nothing that counts. An account whose disagreements
// match nobody else's three times in a week is ignored for that week
// (townSeatLaw.js seatIgnoredAccounts): one modded MAPS.BSA, or one liar,
// is a row on the audit list, never a seat. A witness's first answer on a
// seat stands (the witnesses' INSERT OR IGNORE, as a pixel's).
//
// ═══ THE STRIKE, AND THE AUDIT ═══════════════════════════════════════
//
// A developer strikes a seat (`/seat strike <key>`, RED1's authority):
// its reports go, a history row says so, and a struck key is never
// witnessed again. The developers' reading of the list names every
// unconfirmed seat with its witnesses' count, and the AUDIT - each seat
// whose confirmation still rests on exactly three witnesses, whom nobody
// else has joined, and (AUDIT-SEATS T2) every disputed seat, at once.
// AUDIT-SEATS S4: a held seat's strike voids its Charter in the strike's
// own batch - the hold gone, its proclaimed Edict void, the week's battle
// there void, the claim fee refunded within the Season.
//
// Behind SEATS_OPEN (off, dev, on - SEAT0 18). EVERY CLOCK IS AN
// ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { isDeveloper } from './titles.js';
import { witnessedFact, factConfirmed, WITNESS } from '../../src/net/nodeLaw.js';
import {
  seatsSwitchOf, seatReportOf, seatReportText, parseSeatReport, seatIgnoredAccounts, seatKeyOk, seatWeekOf,
  SEAT_WITNESS_REPORTS_HOUR, SEAT_WITNESSES_AUDIT, seasonFloor, seasonZeroOf,
} from '../../src/net/townSeatLaw.js';
import { utcDay, MARKS_MAX } from '../../src/net/marksLaw.js';   // AUDIT-SEATS S4: a struck Charter's fee refunded
import { fortsLapsedStatements } from './seatForts.js';   // AUDIT SEATS-2 S5: a struck Charter's building projects fall with it
import { DB_ROOT } from './service.js';   // STORM-SHED: the binding a request's counted Proxy wraps

/** Whether the seats are open to this account: the switch, and at `dev` the developers alone. */
export function seatsOpenFor(player, env) {
  const s = seatsSwitchOf(env?.SEATS_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}
/** An account a week registered may witness (SEAT0 3.2), as a harvest's and a hub's do. */
const witnessOf = (player, nowS) => Number.isSafeInteger(player?.registered_at) && player.registered_at <= nowS - WITNESS.ageS;

/** Whether a seat's key was struck (a history row), so it is never witnessed again. */
async function struck(db, key) {
  return !!(await db.prepare("SELECT 1 FROM town_seat_history WHERE key = ? AND kind = 'strike'").bind(key).first());
}

/**
 * EVERY SEAT AS THE WITNESSES SAY IT IS: each key's fact (witnessedFact over its reports, the ignored accounts' left
 * out), its witnesses' count, and whether the audit names it. Pure over the rows.
 * @param {{ key: string, account: string, report: string, at: number }[]} rows
 * @param {number} nowS
 */
export function seatFacts(rows, nowS) {
  const byKey = new Map();
  for (const r of rows) {
    const list = byKey.get(r.key) ?? [];
    list.push(r);
    byKey.set(r.key, list);
  }
  // the first pass: what each seat is taken to be, every account counted - the ignored accounts are read off it
  const confirmed = new Map();
  for (const [k, list] of byKey) {
    const f = witnessedFact(list, parseSeatReport);
    if (factConfirmed(f)) confirmed.set(k, seatReportText(/** @type {any} */ (f).seat));
  }
  const ignored = seatIgnoredAccounts(rows, confirmed, nowS);
  const out = [];
  for (const [k, list] of byKey) {
    const kept = list.filter((r) => !ignored.has(r.account));
    const f = /** @type {any} */ (witnessedFact(kept, parseSeatReport));
    if (f.state === 'none') continue;
    const agreeing = f.seat ? kept.filter((r) => r.report === seatReportText(f.seat)) : [];
    out.push({ key: Number(k), fact: f, witnesses: new Set(kept.map((r) => r.account)).size, agreeing: agreeing.map((r) => r.account) });
  }
  // THE AUDIT (SEAT0 3.2): "a seat confirmed by exactly three witnesses whom nobody else ever joins" - its confirmation
  // still resting on the bare three, no fourth ever agreeing; AUDIT-SEATS T2 (3.2: a disputed row "goes on the audit list
  // at once"): and every disputed seat, however many agree on what it stands as
  for (const s of out) s.audit = (factConfirmed(s.fact) && s.agreeing.length === SEAT_WITNESSES_AUDIT) || s.fact.state === 'disputed';
  return { seats: out, ignored };
}

async function allSeatRows(db) {
  const { results = [] } = await db.prepare("SELECT key, account, report, at FROM world_witness WHERE kind = 'seat'").all();
  return results.map((r) => ({ key: String(r.key), account: r.account, report: r.report, at: Number(r.at) }));
}

/** STORM-SHED (2026-10-06 evening, the second overload - "D1 DB is overloaded"): HOW LONG ONE ISOLATE KEEPS THE SEATS'
 *  WITNESS ROWS. Every list, every Watch claim and every witness's report read each `seat` row of world_witness - one a
 *  seat and witness, never trimmed: 4,050 rows a read, the database's costliest read by time in the outage's two hours -
 *  and a client whose Watch claim failed claimed again the moment the answer came, so the read the overload made slow
 *  was asked the faster for it. A seat's facts move with a witness's report and by the week (seatIgnoredAccounts), so a
 *  minute is nothing to them; a report or a strike written here lets them go at once. */
export const SEAT_ROWS_KEPT_S = 60;
/** The database binding -> what this isolate last read of it, and the read asked now, and its writes counted. */
const seatRowsKept = new WeakMap(), seatRowsAsking = new WeakMap(), seatRowWrites = new WeakMap();
const seatRowsRoot = (/** @type {any} */ db) => db?.[DB_ROOT] ?? db;

/** STORM-SHED: the seats' witness rows as this isolate keeps them - read at most once in SEAT_ROWS_KEPT_S, every ask of
 *  one moment answered by one read, and a read begun before a write here never kept. */
async function seatRowsOf(db, nowS) {
  const root = seatRowsRoot(db);
  const kept = seatRowsKept.get(root);
  if (kept && nowS - kept.at < SEAT_ROWS_KEPT_S) return kept.rows;
  const asking = seatRowsAsking.get(root);
  if (asking) return asking;
  const gen = seatRowWrites.get(root) ?? 0;
  const ask = allSeatRows(db).then((rows) => {
    if ((seatRowWrites.get(root) ?? 0) === gen) seatRowsKept.set(root, { at: nowS, rows });
    return rows;
  }).finally(() => { if (seatRowsAsking.get(root) === ask) seatRowsAsking.delete(root); });
  seatRowsAsking.set(root, ask);
  return ask;
}
/** STORM-SHED: the kept rows let go - a witness's report or a strike written here. */
function forgetSeatRows(db) {
  const root = seatRowsRoot(db);
  seatRowsKept.delete(root);
  seatRowsAsking.delete(root);
  seatRowWrites.set(root, (seatRowWrites.get(root) ?? 0) + 1);
}

/**
 * THE SEATS THE WITNESSES CONFIRMED - confirmed and disputed alike (a disputed seat keeps every effect it had), each
 * `{ key, name, region, tier, pixel, state }`. With the reader's own standing (may they witness). A developer's reading
 * also names every unconfirmed seat and the audit.
 * @param {{db: any, nowS: number}} ctx
 */
export async function listSeats({ db, nowS }, player, env) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  const dev = isDeveloper(player, env);
  // STORM-SHED: a player's list is the isolate's kept rows; a developer's reads the table as it stands - the audit names a
  // disputed seat at once (AUDIT-SEATS T2), whichever isolate took its reports
  const { seats, ignored } = seatFacts(await (dev ? allSeatRows(db) : seatRowsOf(db, nowS)), nowS);
  const view = (s) => ({ ...s.fact.seat, state: s.fact.state });
  return {
    seats: seats.filter((s) => factConfirmed(s.fact)).map(view).sort((a, b) => a.key - b.key),
    me: { witness: witnessOf(player, nowS) && !ignored.has(player.id), developer: dev },
    ...(dev ? {
      unconfirmed: seats.filter((s) => !factConfirmed(s.fact) && s.fact.seat).map((s) => ({ ...view(s), witnesses: s.witnesses })).sort((a, b) => a.key - b.key),
      audit: seats.filter((s) => s.audit).map((s) => s.key).sort((a, b) => a - b),
    } : {}),
  };
}

/**
 * SEAT1b: THE SEATS A PLEDGE, A TICK OR A TRIBUTE MAY NAME - every confirmed seat (a disputed one too: it keeps every
 * effect it had), by key: `Map<key, { key, name, region, tier, pixel, state }>`. The ignored accounts left out, as the
 * list leaves them. STORM-SHED: `kept` reads the isolate's kept rows (seatRowsOf) - the Watch's claims, which a client
 * asks every few minutes; a pledge, a battle, a Turning and every other act read the table as it stands.
 * @param {any} db
 * @param {number} nowS
 * @param {{ kept?: boolean }} [opts]
 */
export async function confirmedSeats(db, nowS, { kept = false } = {}) {
  const { seats } = seatFacts(await (kept ? seatRowsOf(db, nowS) : allSeatRows(db)), nowS);
  return new Map(seats.filter((s) => factConfirmed(s.fact)).map((s) => [s.key, { ...s.fact.seat, state: s.fact.state }]));
}

/**
 * A SEAT WITNESSED - the client standing in a seat town reports the seat it derived (`{ key, name, region, tier, pixel }`,
 * checked by townSeatLaw.js seatReportOf). A registered account a week old is counted (its first answer on the seat
 * stands); anyone else's report is answered, and counts for nothing (`counted: false` and why). A struck seat is refused.
 * @param {{db: any, nowS: number}} ctx
 */
export async function witnessSeat({ db, nowS }, player, env, { seat } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  const s = seatReportOf(seat);
  if (!s) return { error: 'bad-seat' };
  if (await overRate({ db, nowS }, `seat-witness:${player.id}`, SEAT_WITNESS_REPORTS_HOUR, 3600)) return { error: 'seats-rate' };
  if (await struck(db, s.key)) return { error: 'seat-struck' };
  if (!witnessOf(player, nowS)) return { ok: true, counted: false, why: 'young' };
  const { ignored } = seatFacts(await seatRowsOf(db, nowS), nowS);   // STORM-SHED: the isolate's kept rows
  if (ignored.has(player.id)) return { ok: true, counted: false, why: 'ignored' };
  await db.prepare("INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)")
    .bind(String(s.key), player.id, seatReportText(s), s.region, nowS).run();
  forgetSeatRows(db);   // STORM-SHED: this report is the rows' news - asked afresh here
  return { ok: true, counted: true };
}

/**
 * THE STRIKE (SEAT0 3.2: "`/seat strike <key>` (the dev glyph, RED1's authority) removes a row and its history, and the
 * strike is itself a history row") - a developer's alone. The seat's reports go; a history row names the strike and who
 * made it; the key is never witnessed again. SEAT1c: a held seat's Charter voids with it (SEAT0 16).
 * @param {{db: any, nowS: number}} ctx
 */
export async function strikeSeat({ db, nowS }, dev, env, { key } = {}) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const week = seatWeekOf(nowS * 1000);
  // AUDIT-SEATS S4 (16: "A seat is struck by a developer (3.2) while held: the Charter voids, the claim fee is refunded to
  // the holder's Marks treasury if struck within the Season, and the history keeps the row"): in the strike's own batch -
  // the fee its Charter paid (the Turning's claim line, or the Tourney's) minted back where the Charter began this Season
  // (townSeatLaw.js seasonFloor), what the treasury has room for; its proclaimed Edict void; a battle there void (its
  // Sellswords' escrow goes home at the Turning, seatTurning.js); the hold gone - so no token wears it, no pledge counts
  // through it, and the guild may pledge in the region again
  const h = await db.prepare('SELECT h.guild_id, g.name, g.tag FROM town_seat_holds h LEFT JOIN guilds g ON g.id = h.guild_id WHERE h.key = ?').bind(key).first();
  const rid = `strike-${key}`;
  const [, , , , gone] = await db.batch([
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'guild', h.guild_id, 'seat-strike-refund', MIN(l.amount, ${MARKS_MAX} - COALESCE((SELECT balance FROM guild_marks WHERE guild_id = h.guild_id), 0)),
        ?2, ?3, 'seats', 'The registry', ?4
      FROM town_seat_holds h JOIN marks_ledger l ON l.actor = 'seats' AND l.kind = 'seat-claim' AND l.src_id = h.guild_id
        AND l.rid IN ('claim-' || (h.since_week - 1) || '-' || h.key, 'tourney-' || h.since_week || '-' || h.key)
      WHERE h.key = ?1 AND h.since_week >= ?5 AND EXISTS (SELECT 1 FROM guilds WHERE id = h.guild_id)
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = h.guild_id), 0) < ${MARKS_MAX}
      LIMIT 1`).bind(key, utcDay(nowS), nowS, rid, seasonFloor(week, seasonZeroOf(env?.SEASON_ZERO_WEEK))),
    db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND state = 'proclaimed'").bind(key),
    db.prepare("UPDATE town_seat_battles SET state = 'void' WHERE key = ? AND week >= ? AND state = 'scheduled'").bind(key, week),
    db.prepare('DELETE FROM town_seat_holds WHERE key = ?').bind(key),
    db.prepare("DELETE FROM world_witness WHERE kind = 'seat' AND key = ?").bind(String(key)),
    db.prepare(`INSERT INTO town_seat_history (key, week, kind, data, at)
      SELECT ?1, ?2, 'strike', json_set(?3, '$.refund', COALESCE((SELECT amount FROM marks_ledger WHERE actor = 'seats' AND rid = ?5), 0)), ?4`)
      .bind(key, week, JSON.stringify({ by: dev.handle ?? null, ...(h ? { guild: { name: h.name ?? '', tag: h.tag ?? '' } } : {}) }), nowS, rid),
    ...fortsLapsedStatements(db, key, nowS),   // AUDIT SEATS-2 S5: a building project falls with the Charter
  ]);
  forgetSeatRows(db);   // STORM-SHED: the struck seat's reports are gone - asked afresh here
  return { ok: true, key, reports: Number(gone?.meta?.changes ?? 0) };
}
