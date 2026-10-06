// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT2a part three (2026-10-01, Mac: "Finish the seats"; "Or we could go
// ahead and do sieges"; "Continue") - WHAT THE SERVICE SAYS OF A BATTLE:
// who may enter it (the pass, over the field the fighters' games agree),
// what it gave (the result off the relay's `s1` receipt), and each
// fighter's Honours.
//
// bible/11-Multiplayer/Seats-Arc.md 6.2, 6.5-6.8. The numbers are
// src/net/townSeatLaw.js's; the battle is the relay's (net/siegeRef.js).
//
// FACT: the relay has no door to this service. So the pass is an order
// this service signs and the room checks with the key it already holds
// (net/identityToken.js's `siege` order), and the result comes back in a
// fighter's own client - each fighter's receipt carries it - the first
// to arrive writing it, once a battle.
//
// ONE STATEMENT DECIDES, as everywhere a seat's rows move: the result's
// INSERT is the batch's first write and its key the battle's, so a second
// receipt for the same battle rolls back whole; an Honours row the same,
// once an account a battle.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { renownHeldSql } from './renownTracks.js';   // AUDIT LEGACY III O5: the bound counts the living's tracks
import { CHAR_ID_RE } from './service.js';   // AUDIT SEATS-3 A3: an Honours character in the saves' shape
import { seatsOpenFor, confirmedSeats } from './townSeats.js';
import { fortifierAt, fortsCaptureWithSave, fortTierAt, siegewrightAt, fortsLapsedStatements, fortsDueStatements, fortsGuildFallStatements, fortsRestoredStatements } from './seatForts.js';   // SEAT2b: a capture's drop, a Fortifier's save; part two (b): the works a siege fights behind   // VOID: a capture's works given back   // AUDIT 529 V2: and its fallen projects
import { canModerate } from './titles.js';   // VOID: a moderator's, or a developer's
import { mustChange } from './realm.js';
import { gatherStandings } from './seatInfluence.js';   // AUDIT-SEATS S8: a Tourney's dead heat as the Turning counted it
import { utcDay, MARKS_MAX } from '../../src/net/marksLaw.js';
import { mintSiegeOrder, siegeFieldValid } from '../../src/net/identityToken.js';
import { SIEGE_RAMS_MAX } from '../../src/net/siegeRef.js';   // SEAT2b part two (b): the most Rams a pass carries
import { verifySiegeReceipt, SIEGE_RECEIPT_TTL_S } from '../../src/net/siegeReceipt.js';   // AUDIT-SEATS R6: a late pass lives the receipt's week
import { RENOWN_XP_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import {
  seatWeekOf, seatKeyOk, settleField, passWindowEnds, passOpens, siegeWinner, siegeAftermath, spoilsOf, SIEGE_HONOURS,
  CLAIM_FEE, STANDING_START, STANDING_MAX, seasonFloor, seasonZeroOf, siegeMinutes, seatWeekStartMs, seasonOf, STANDING_CHANGES,
} from '../../src/net/townSeatLaw.js';

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
/** The passes an account may ask for in an hour - one a connection, a battle's worth of reconnects. */
export const SIEGE_PASS_HOUR = 120;
const seatOpen = (player, env) => (accountKind(player) !== 'linked' ? { error: 'seats-need-account' } : !seatsOpenFor(player, env) ? { error: 'seats-closed' } : null);
const ridOf = () => { const b = new Uint8Array(12); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };

/** A battle row, or null. */
async function battleAt(db, week, key) {
  const b = await db.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').bind(week, key).first();
  return b ? { ...b, starts_at: Number(b.starts_at), ends_at: Number(b.ends_at), week: Number(b.week), key: Number(b.key) } : null;
}
const resultAt = (db, week, key) => db.prepare('SELECT result, raised, winner FROM town_seat_results WHERE week = ? AND key = ?').bind(week, key).first();
/** VOID (migration 0067): WHAT STOOD BEFORE A RESULT, kept in the result's own INSERT (`?1` the week, `?2` the seat) - the
 *  seat's Charter row (null at an unheld seat) and every Legacy row at the seat from the battle's week on - so a
 *  moderator's void (voidSiege) gives back exactly what the result moved. */
const PRIOR_SQL = `json_object(
  'hold', json((SELECT json_object('guild', guild_id, 'region', region, 'standing', standing, 'since', since_week, 'truce', truce_week,
    'tithe', tithe, 'titheWeek', tithe_week, 'owed', owed) FROM town_seat_holds WHERE key = ?2)),
  'legacy', json((SELECT json_group_array(json_array(week, guild_id, amount)) FROM town_seat_legacy WHERE key = ?2 AND week >= ?1)))`;
/** VOID (migration 0067): THE WORKS BEFORE A CAPTURE'S DROP, kept on the result - each work's tier the siege was fought
 *  behind (`forts`). AUDIT 529 V2: and every building project the drop (or a revolt's lapse) makes fall (`projects`: `[work,
 *  building, guild, builder, siegewright, standsAt, at]`), what each holds (`held`: `[work, material, qty]`), and `guild`'s
 *  Edict for next week (`edict`; null for none) - so `/siege void` begins them again (seatForts.js fortsRestoredStatements).
 *  For the result's batch after its INSERT, once the projects whose day had come are raised (fortsDueStatements). */
const priorWorks = (db, W, K, guild = null) => db.prepare(`UPDATE town_seat_results SET prior = json_set(COALESCE(prior, '{}'),
  '$.forts', json((SELECT json_group_object(work, tier) FROM town_seat_forts WHERE key = ?2)),
  '$.projects', json((SELECT json_group_array(json_array(work, building, guild_id, builder, siegewright, stands_at, at)) FROM town_seat_forts WHERE key = ?2 AND building IS NOT NULL)),
  '$.held', json((SELECT json_group_array(json_array(work, material, qty)) FROM town_seat_fort_held WHERE key = ?2 AND qty > 0)),
  '$.edict', (SELECT edict FROM town_seat_edicts WHERE key = ?2 AND week = ?1 + 1 AND guild_id = ?3 AND state = 'proclaimed')) WHERE week = ?1 AND key = ?2`).bind(W, K, guild);
/** SEAT2b part two (c) (7.7: "Fail, and the Charter lapses"): A REVOLT THAT STOOD - the holder's Charter lapsed, its coming
 *  Edict void, the Chronicle's 'revolt-stood', its building projects fallen (AUDIT SEATS-2 S5) - a Neglect's lapse's
 *  statements, as the Turning writes them for a revolt no result reached (seatTurning.js). AUDIT 529 V1: a result's, and a
 *  moderator's void of a revolt before its result. */
const revoltStood = (db, K, W, guild, name, nowS, history) => [
  db.prepare('DELETE FROM town_seat_holds WHERE key = ? AND guild_id = ?').bind(K, guild),
  db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND week = ? AND state = 'proclaimed'").bind(K, W + 1),
  history('revolt-stood', { guild: name }),
  ...fortsLapsedStatements(db, K, nowS),   // AUDIT SEATS-2 S5: its building projects fall with the Charter
];

/**
 * THE PASS (6.2, 6.4, 6.6): this week's battle at `key`, from ten minutes before its start until its window closes - a
 * signed fighter on its side, anyone else a spectator. A fighter's game sends the field it derived from the town
 * (`field`, the pass's `sf`); the battle's field is settled as the law says (townSeatLaw.js settleField) and every pass
 * carries it. Answers `{ pass, side, week, key, startsAt, endsAt, window }`; `pass` null where this service holds no
 * signing key (the room then admits nobody - said, never a pass that cannot be checked).
 *
 * AUDIT-SEATS R6: A LATE PASS. Past the window's close, a fighter ON THE BATTLE'S ROSTER is still signed one - until the
 * receipt's week is out (`se` + SIEGE_RECEIPT_TTL_S) - its claims the battle's own (the same `se` and field, so the room
 * knows it for its battle), and `late: true` beside it: the relay admits such a hello ONLY where the battle is over and
 * holds this account's `s1` receipt, and hands it over (server/src/index.js _siegeAdmit). The window shut both doors at
 * `se` before, so a crown fighter who dropped at minute 40 and came back at minute 70 lost the receipt "kept a week" -
 * its Marks, Renown and Spoils. A spectator, or a fighter of a battle whose field never settled (nobody fought it), is
 * 'pass-late' as before. `week` (optional) asks for the seat week before this one - a receipt's week reaches past the
 * Turning; anything else is this week.
 * @param {{db: any, nowS: number, subtle: SubtleCrypto}} ctx
 * @param {CryptoKey|null} signingKey
 */
export async function siegePass({ db, nowS, subtle }, player, env, { key, field, week: asked } = {}, signingKey) {
  const closed = seatOpen(player, env);
  if (closed) return closed;
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const week = asked === weekAt(nowS) - 1 ? asked : weekAt(nowS);   // AUDIT-SEATS R6: last week's battle, asked by name
  const b = await battleAt(db, week, key);
  if (!b || b.state === 'void') return { error: 'battle-none' };
  if (nowS < passOpens(b)) return { error: 'pass-early' };
  const se = passWindowEnds(b);
  const late = nowS >= se;   // AUDIT-SEATS R6
  if (late && nowS >= se + SIEGE_RECEIPT_TTL_S) return { error: 'pass-late' };
  if (await overRate({ db, nowS }, `seat-pass:${player.id}`, SIEGE_PASS_HOUR, 3600)) return { error: 'seats-rate' };
  const row = await db.prepare('SELECT side FROM town_seat_rosters WHERE week = ? AND key = ? AND account = ?').bind(week, key, player.id).first();
  const side = row?.side === 'attack' || row?.side === 'defend' ? row.side : 'watch';
  if (late && (side === 'watch' || !b.field)) return { error: 'pass-late' };   // AUDIT-SEATS R6: a rostered fighter of a fought battle alone
  let settled = b.field ?? null;
  if (!settled) {
    if (side !== 'watch') {
      if (!siegeFieldValid(field, b.tier)) return { error: 'field-bad' };
      await db.prepare(`INSERT INTO town_seat_fields (week, key, account, side, field, at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (week, key, account) DO UPDATE SET field = excluded.field, at = excluded.at`)
        .bind(week, key, player.id, side, JSON.stringify(field), nowS).run();
    }
    const { results: rows = [] } = await db.prepare('SELECT side, field, at FROM town_seat_fields WHERE week = ? AND key = ? ORDER BY at, rowid').bind(week, key).all();
    const f = settleField(rows.map((r) => ({ side: r.side, field: r.field, at: Number(r.at) })), nowS >= b.starts_at, b.kind);   // SEAT2b part two (c): a revolt's first defender's
    if (!f) return { error: 'field-unsettled' };
    // settled once: a second request racing this one keeps the first's
    await db.prepare('UPDATE town_seat_battles SET field = ? WHERE week = ? AND key = ? AND field IS NULL').bind(f, week, key).run();
    settled = (await db.prepare('SELECT field FROM town_seat_battles WHERE week = ? AND key = ?').bind(week, key).first())?.field ?? f;
  }
  const out = { side, week, key, startsAt: b.starts_at, endsAt: b.ends_at, window: se, ...(late ? { late: true } : {}) };   // AUDIT-SEATS R6: a late pass says so
  if (!signingKey) return { ...out, pass: null };
  const sf = JSON.parse(String(settled));
  const sx = await siegeWorks(db, b, nowS);   // SEAT2b part two (b): the works it is fought behind, frozen at its first pass
  const pass = await mintSiegeOrder({ s: player.id, sk: key, sw: week, sd: side, st: b.tier, sn: b.kind, sb: b.starts_at, se, sf, sx }, signingKey, { subtle, nowS });
  return { ...out, pass };
}

/**
 * SEAT2b part two (b) (Seats-Arc 6.2, 7.5): A SIEGE'S WORKS, FROZEN AT ITS FIRST PASS - `[walls, gatehouse, rams,
 * siegewright, barracks]` (net/siegeRef.js worksOf): each work's tier standing then (a project whose day has come
 * counted - fortTierAt, read without a write); the Gatehouse -1 at a palace that raised none (a crown's stands at 0);
 * the Rams the challenger's camp sent at the Turning (`town_seat_battles.rams`), none without a gate; 1 where a
 * Siegewright stands on the attacking roster (signing closed at the door's opening, so the roster is the battle's).
 * DECIDED: frozen once, as the field is - the relay's room holds the first pass's battle and refuses a pass that says
 * otherwise, so a work standing mid-battle must not move the next pass; the works fought behind are those at the door.
 * A Tourney's none (null).
 */
async function siegeWorks(db, b, nowS) {
  if (b.kind !== 'siege') return null;
  if (b.works) return JSON.parse(String(b.works));
  const walls = await fortTierAt(db, b.key, 'walls', nowS), gatehouse = await fortTierAt(db, b.key, 'gatehouse', nowS), barracks = await fortTierAt(db, b.key, 'barracks', nowS);
  const gate = b.tier === 'crown' ? gatehouse : gatehouse >= 1 ? gatehouse : -1;
  const rams = gate >= 0 ? Math.max(0, Math.min(SIEGE_RAMS_MAX, Number(b.rams ?? 0) || 0)) : 0;
  const sx = [walls, gate, rams, (await siegewrightAt(db, b.week, b.key, nowS)) ? 1 : 0, barracks];
  // frozen once: a second pass racing this one keeps the first's
  await db.prepare('UPDATE town_seat_battles SET works = ? WHERE week = ? AND key = ? AND works IS NULL').bind(JSON.stringify(sx), b.week, b.key).run();
  const row = await db.prepare('SELECT works FROM town_seat_battles WHERE week = ? AND key = ?').bind(b.week, b.key).first();
  return row?.works ? JSON.parse(String(row.works)) : sx;
}

/** Each contender's influence at the seat - a Tourney's dead heat goes to the higher (6.7). AUDIT-SEATS S8: as the Turning
 *  that made the seat Contested counted it (5.2 steps 1-2) - the standings' total of the week before the Tourney's (each
 *  source at its caps, reach, Tribute inside its room - never the rows' raw sum, where a Tribute row is Marks and a gate
 *  row counts unagreed), at that Turning's clock, and the Legacy each carried into that week. */
async function higherOf(db, b, nowS, zero) {
  const seat = (await confirmedSeats(db, nowS)).get(b.key);
  if (!seat) return null;
  const w = b.week - 1;
  const list = await gatherStandings(db, seat, w, Math.floor(seatWeekStartMs(b.week) / 1000), !!seasonOf(w, zero));
  const { results: legacy = [] } = await db.prepare('SELECT guild_id, amount FROM town_seat_legacy WHERE week = ? AND key = ?').bind(w, b.key).all();
  const of = (g) => (list.find((s) => s.guild === g)?.total ?? 0) + Number(legacy.find((l) => l.guild_id === g)?.amount ?? 0);
  const a = of(b.attacker), d = of(b.defender);
  return a > d ? 'attack' : d > a ? 'defend' : null;
}

/**
 * THE SELLSWORDS' ESCROW SETTLED (6.4: "an optional Marks fee, escrowed, paid at the siege's end") - each contract of the
 * battle at `key` in `week` its own statement, in order, so each asks the purse it pays as the last left it: a signed
 * contract's fee to its Sellsword, an offered one's home to its guild, every contract not paid withdrawn.
 * AUDIT-SEATS S2: burnt where the account or the treasury it goes to is full (MARKS_MAX, the balances' CHECK) or gone, as
 * a Tithe is - never a statement that fails, so a result is never rolled back by a Sellsword's purse (a defender filling
 * its treasury could otherwise keep its seat by hiring a dummy). S3: `voided` - a battle its Turning voided pays no fee
 * (16: a void siege, "nobody earns Honours"): every contract, offered or SIGNED, goes home.
 */
export async function swordsSettled(db, week, key, nowS, { voided = false } = {}) {
  const { results: hires = [] } = await db.prepare("SELECT account, state FROM town_seat_hires WHERE week = ? AND key = ? AND state IN ('offered', 'signed') AND fee > 0 ORDER BY at, account")
    .bind(week, key).all();
  const day = utcDay(nowS), out = [];
  for (const h of hires) {
    const paid = h.state === 'signed' && !voided;
    const fits = paid
      ? `EXISTS (SELECT 1 FROM players WHERE id = h.account) AND COALESCE((SELECT balance FROM marks WHERE account = h.account), 0) + h.fee <= ${MARKS_MAX}`
      : `EXISTS (SELECT 1 FROM guilds WHERE id = h.guild_id) AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = h.guild_id), 0) + h.fee <= ${MARKS_MAX}`;
    out.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', 'hire:' || h.week || ':' || h.key || ':' || h.account || ':' || h.at, CASE WHEN ${fits} THEN ?5 ELSE 'burn' END,
        CASE WHEN ${fits} THEN ${paid ? 'h.account' : 'h.guild_id'} END, ?6, h.fee, ?7, ?8, 'seats', 'A siege', 'hire:' || h.week || ':' || h.key || ':' || h.account || ':' || h.at || ?9
      FROM town_seat_hires h WHERE h.week = ?1 AND h.key = ?2 AND h.account = ?3 AND h.state = ?4 AND h.fee > 0`)
      .bind(week, key, h.account, h.state, paid ? 'account' : 'guild', paid ? 'sellsword-fee' : 'sellsword-return', day, nowS, paid ? ':fee' : ':return'));
  }
  out.push(db.prepare(`UPDATE town_seat_hires SET state = 'withdrawn' WHERE week = ? AND key = ? AND state IN ('offered'${voided ? ", 'signed'" : ''})`).bind(week, key));
  return out;
}

/**
 * THE RESULT (6.5-6.8), written once a battle - what it gave, in the result's own batch:
 *   a seat taken: the Charter the attacker's (Standing 50, in truce at the next Turning, its Tithe and arrears its own -
 *     none), the old holder's Legacy at the seat cleared;
 *   a seat held: the holder's Standing +15 and its next defence x1.2 where a banner was raised (AUDIT-SEATS T1: +15 less 5
 *     where the receipt says the attackers reached the Throne, `th`); a forfeit: +10 (once a
 *     Season against the same challenger) and x1.2; either way the challenger's influence at the seat this week cleared
 *     and the seat barred to it at the next Turning;
 *   a Tourney: the winner takes the Charter and pays the claim fee - else the other if it can - else the seat stays
 *     unheld;
 *   the Sellswords: a signed contract's escrowed fee paid to its Sellsword, an unsigned one's home to its guild;
 *   SEAT2b part two (c) (7.7): a revolt put down (`defend` - its Captain felled) brings the holder's Standing back to 20
 *     (never lower than it stands); one that stood its window out (`attack`) lapses the Charter - the seat unheld, its
 *     coming Edict void (a Neglect's lapse's statements).
 * Answers whether this request wrote it (a racing one finds it written).
 */
async function applyResult(db, b, c, nowS, zero) {
  const W = b.week, K = b.key, result = c.r, raised = c.a === 1 ? 1 : 0;
  const names = new Map();
  const { results: gs = [] } = await db.prepare('SELECT id, name, tag FROM guilds WHERE id IN (?, ?)').bind(b.attacker, b.defender).all();
  for (const g of gs) names.set(g.id, { name: g.name, tag: g.tag });
  const nameOf = (id) => names.get(id) ?? { name: '', tag: '' };
  const history = (kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)').bind(K, W, kind, JSON.stringify(data), nowS);
  const day = utcDay(nowS);
  const swords = await swordsSettled(db, W, K, nowS);   // AUDIT-SEATS S2: each contract its own statement, burnt where full
  // AUDIT-SEATS S3 (17): the result only for a battle still scheduled, its week not yet settled - a Turning that came first
  // voided it (seatTurning.js), and a late receipt moves no Charter it has already reckoned without
  const head = (winner) => [
    db.prepare(`INSERT INTO town_seat_results (week, key, result, raised, winner, rid, at, prior) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ${PRIOR_SQL}
      WHERE EXISTS (SELECT 1 FROM town_seat_battles WHERE week = ?1 AND key = ?2 AND state = 'scheduled')
        AND NOT EXISTS (SELECT 1 FROM town_seat_weeks WHERE week = ?1)`).bind(W, K, result, raised, winner, ridOf(), nowS),
    mustChange(db),
    db.prepare("UPDATE town_seat_battles SET state = ? WHERE week = ? AND key = ?").bind(result === 'forfeit' ? 'forfeit' : 'fought', W, K),
  ];
  const run = async (stmts) => { try { await db.batch(stmts); return true; } catch { return false; } };
  if (b.kind === 'revolt') {   // SEAT2b part two (c)
    if (result === 'defend') {
      return run([...head('defend'),
        db.prepare('UPDATE town_seat_holds SET standing = MAX(standing, ?) WHERE key = ? AND guild_id = ?').bind(STANDING_CHANGES.revoltTo, K, b.defender),
        history('revolt-down', { guild: nameOf(b.defender) }), ...swords]);
    }
    // AUDIT 529 V2: the projects that fall and the Edict voided kept on the result first, the due raised before them
    return run([...head('attack'), ...fortsDueStatements(db, nowS, K), priorWorks(db, W, K, b.defender),
      ...revoltStood(db, K, W, b.defender, nameOf(b.defender), nowS, history), ...swords]);
  }
  if (b.kind === 'tourney') {
    const higher = result === 'tie' ? await higherOf(db, b, nowS, zero) : null;
    const winner = siegeWinner(result, higher);
    const order = winner === 'defend' ? [b.defender, b.attacker] : winner === 'attack' ? [b.attacker, b.defender] : [];
    const seat = (await confirmedSeats(db, nowS)).get(K);
    const fee = CLAIM_FEE[b.tier] ?? CLAIM_FEE.palace;
    for (const g of order) {
      // the fee burnt where the treasury holds it and the seat is still unheld - or this whole attempt rolls back
      const ok = await run([...head(g === b.attacker ? 'attack' : 'defend'),
        db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
          SELECT 'guild', ?1, 'burn', NULL, 'seat-claim', ?2, ?3, ?4, 'seats', 'The Tourney', ?5
          WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2 AND NOT EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?6)`)
          .bind(g, fee, day, nowS, `tourney-${W}-${K}`, K), mustChange(db),
        db.prepare('INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(K, g, Number(seat?.region ?? 0), b.tier, W, STANDING_START, W, nowS),
        history('tourney-won', { guild: nameOf(g) }), ...swords]);
      if (ok) return true;
      if (await resultAt(db, W, K)) return false;   // another receipt wrote it first
    }
    return run([...head(null), history('tourney-unheld', {}), ...swords]);
  }
  const forfeitPaid = result === 'forfeit' && !!(await db.prepare(`SELECT 1 FROM town_seat_results r JOIN town_seat_battles x ON x.week = r.week AND x.key = r.key
    WHERE r.result = 'forfeit' AND x.state <> 'void' AND x.attacker = ? AND x.defender = ? AND r.week >= ? AND r.week < ? LIMIT 1`).bind(b.attacker, b.defender, seasonFloor(W, zero), W).first());   // SEASON1: this Season's   // VOID: a forfeit the Moderators voided paid nothing
  const throne = c.th === 1 ? 1 : 0;   // AUDIT-SEATS T1: the attackers reached the Throne (the receipt's `th`; absent, 0)
  const after = siegeAftermath('siege', result, raised, { forfeitPaid, throne: throne === 1 });
  const stmts = [...head(siegeWinner(result))];
  if (after.taken) {
    const seat = (await confirmedSeats(db, nowS)).get(K);
    // SEAT2b (6.8, 7.5): the seat's works a tier down with the Charter - a Fortifier's save keeping the Walls once a Season
    const seasonWeek = seasonFloor(W, zero);
    // VOID (migration 0067): the works' tiers the siege was fought behind kept on the result - after the projects whose day
    // had come are raised (the drop's own first step, idempotent), before the drop - so `/siege void` can give them back;
    // AUDIT 529 V2: and the defender's projects the drop makes fall
    stmts.push(...fortsDueStatements(db, nowS, K), priorWorks(db, W, K));
    const fortifier = await fortifierAt(db, W, K, nowS, seasonWeek);
    stmts.push(...fortsCaptureWithSave(db, K, { week: W, nowS, seasonWeek, fortifier, history }));
    stmts.push(
      db.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (key) DO UPDATE SET guild_id = excluded.guild_id, since_week = excluded.since_week, standing = excluded.standing,
          truce_week = excluded.truce_week, tithe = 0, tithe_week = NULL, owed = 0, at = excluded.at`)
        .bind(K, b.attacker, Number(seat?.region ?? 0), b.tier, W, STANDING_START, W, nowS),
      db.prepare('DELETE FROM town_seat_legacy WHERE key = ? AND guild_id = ? AND week >= ?').bind(K, b.defender, W),
      // AUDIT-SEATS: its length, the battle's start to the end every receipt was signed at (the relay's _siegeEnd)
      history('siege-taken', { guild: nameOf(b.attacker), from: nameOf(b.defender), minutes: siegeMinutes(Number(b.starts_at), Number(c.i)) }),
    );
  } else {
    if (after.standing) stmts.push(db.prepare('UPDATE town_seat_holds SET standing = MIN(?, standing + ?) WHERE key = ? AND guild_id = ?').bind(STANDING_MAX, after.standing, K, b.defender));
    if (after.bonus) stmts.push(db.prepare("INSERT OR IGNORE INTO town_seat_aftermath (week, key, guild_id, what) VALUES (?, ?, ?, 'bonus')").bind(W, K, b.defender));
    if (after.barred) {
      stmts.push(
        db.prepare("INSERT OR IGNORE INTO town_seat_aftermath (week, key, guild_id, what) VALUES (?, ?, ?, 'barred')").bind(W, K, b.attacker),
        // AUDIT-SEATS S9: voided, never deleted - the Watch's day cap and the Orc Raids' caps count these rows still
        db.prepare('UPDATE town_seat_influence SET voided = 1 WHERE week = ? AND key = ? AND guild_id = ?').bind(W, K, b.attacker),
        db.prepare('DELETE FROM town_seat_legacy WHERE week = ? AND key = ? AND guild_id = ?').bind(W, K, b.attacker),
      );
    }
    const kind = result === 'forfeit' ? 'siege-forfeit' : result === 'absent' ? 'siege-absent' : 'siege-held';
    // AUDIT-SEATS T1 (9.2): a held siege's row keeps whether the Throne was reached
    stmts.push(history(kind, { guild: nameOf(b.defender), against: nameOf(b.attacker), ...(kind === 'siege-held' ? { throne } : {}) }));
  }
  return run([...stmts, ...swords]);
}

/**
 * THE CLAIM (6.8): a fighter's `s1` receipt, verified with the relay's public half and naming this account - the battle's
 * result written by the first to arrive (applyResult), and this fighter's Honours where it earned them: on the winning
 * side 50 Marks and 2,000 Renown XP to `character`, on the losing 25 and 1,000, and a roll on the Spoils of War into that
 * character's Stores - once a battle an account; nothing but the row where the two guilds' Honours were spent this Season
 * (townSeatLaw.js seasonFloor - SEASON1). Answers `{ result, winner, applied, honours }` - `honours` null where the receipt
 * earned none.
 * @param {{db: any, nowS: number, subtle: SubtleCrypto}} ctx
 * @param {CryptoKey|null} publicKey
 */
export async function claimSiege({ db, nowS, subtle }, player, env, { receipt, character } = {}, publicKey) {
  const closed = seatOpen(player, env);
  if (closed) return closed;
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifySiegeReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const b = await battleAt(db, c.sw, c.sk);
  if (!b) return { error: 'battle-none' };
  // AUDIT-SEATS S3 (17; 16: a void siege - "the holder keeps the seat and nobody earns Honours"): a battle its week's Turning
  // voided, no result having come (or a strike voided), is refused whole - no Charter moved, no Honours (DECIDED: the pair's
  // once-a-Season Honours stay unspent for the siege its carried Right fights next week)
  if (b.state === 'void') return { error: 'battle-void' };
  let r = await resultAt(db, c.sw, c.sk);
  const zero = seasonZeroOf(env?.SEASON_ZERO_WEEK);   // SEASON1: the once-a-Season rules read the Season counted
  const applied = !r && await applyResult(db, b, c, nowS, zero);
  r = await resultAt(db, c.sw, c.sk);
  if (!r) {
    // AUDIT-SEATS S3: the Turning came between the read and the write - the battle void, or its week settled without it
    const settled = await db.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').bind(c.sw).first();
    if (settled || (await battleAt(db, c.sw, c.sk))?.state === 'void') return { error: 'battle-void' };
    throw new Error('claimSiege: the result was neither written nor found');   // a 500, never a quiet loss
  }
  const out = { result: r.result, winner: r.winner ?? null, applied };
  if (c.h !== 1 || b.kind === 'revolt') return { ...out, honours: null };   // SEAT2b part two (c): a revolt earns none (net/siegeRef.js honoured)
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'honours-character' };
  // AUDIT SEATS-3 A3 (6.8: Honours "to the character"): the character this account signed onto the battle's roster, and no
  // other - not a Renown track or a Stores row opened under any id the request names. The result above is written whatever
  // the answer here; a device playing another character keeps its receipt (net/siegeClaims.js) for the one that fought
  const rostered = await db.prepare('SELECT char_id FROM town_seat_rosters WHERE week = ? AND key = ? AND account = ?').bind(c.sw, c.sk, player.id).first();
  if (!rostered || rostered.char_id !== character) return { error: 'honours-character' };
  if (await db.prepare('SELECT 1 FROM town_seat_honours WHERE week = ? AND key = ? AND account = ?').bind(c.sw, c.sk, player.id).first()) return { error: 'honours-twice' };
  // the pair's Honours this Season: any other battle between the two guilds, either way round, since the Season began (SEASON1;
  // with none counted, in the last 8 weeks)
  const spent = !!(await db.prepare(`SELECT 1 FROM town_seat_honours h JOIN town_seat_battles x ON x.week = h.week AND x.key = h.key
    WHERE h.marks > 0 AND h.week >= ?1 AND h.week <= ?2 AND NOT (h.week = ?2 AND h.key = ?5)
      AND ((x.attacker = ?3 AND x.defender = ?4) OR (x.attacker = ?4 AND x.defender = ?3)) LIMIT 1`).bind(seasonFloor(c.sw, zero), c.sw, b.attacker, b.defender, c.sk).first());
  const won = r.winner === c.sd;
  const give = spent ? { marks: 0, xp: 0 } : won ? SIEGE_HONOURS.win : SIEGE_HONOURS.lose;
  const spoil = spent ? null : spoilsOf(c.sw, c.sk, player.id);
  const rid = ridOf();
  const mine = 'EXISTS (SELECT 1 FROM town_seat_honours WHERE week = ?1 AND key = ?2 AND account = ?3 AND rid = ?4)';
  const stmts = [
    db.prepare('INSERT INTO town_seat_honours (week, key, account, side, char_id, marks, xp, spoil, rid, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(c.sw, c.sk, player.id, c.sd, character, give.marks, give.xp, spoil, rid, nowS),
  ];
  if (give.marks > 0) {
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'account', ?3, 'siege-honours', ?5, ?6, ?7, ?3, 'Siege Honours', 'siege-honours:' || ?1 || ':' || ?2 WHERE ${mine}`)
      .bind(c.sw, c.sk, player.id, rid, give.marks, utcDay(nowS), nowS));
  }
  if (give.xp > 0) {
    stmts.push(
      db.prepare(`UPDATE renown_tracks SET xp = MIN(?5, xp + ?6), updated_at = ?7 WHERE player = ?3 AND char_id = ?8 AND ${mine}`)
        .bind(c.sw, c.sk, player.id, rid, RENOWN_XP_MAX, give.xp, nowS, character),
      db.prepare(`INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at)
        SELECT ?3, ?8, ?9, MIN(?5, ?6), NULL, ?7, ?7 WHERE ${mine}
          AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?3 AND char_id = ?8)
          AND ${renownHeldSql('?3')} < ?10`)
        .bind(c.sw, c.sk, player.id, rid, RENOWN_XP_MAX, give.xp, nowS, character, displayName(player), RENOWN_TRACKS_MAX),
    );
  }
  if (spoil) {
    stmts.push(db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) SELECT ?3, ?5, ?6, 'own', 1 WHERE ${mine}
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + 1`).bind(c.sw, c.sk, player.id, rid, character, spoil));
  }
  try { await db.batch(stmts); } catch { return { error: 'honours-twice' }; }
  return { ...out, honours: { side: c.sd, won, marks: give.marks, xp: give.xp, spoil, spent } };
}

/** VOID: what a result kept of the seat before it (migration 0067's `prior`), parsed. AUDIT 529 V3: null where it kept
 *  none (a result written before the column) - never `{}`, which read as "kept, the seat unheld" (`hold` null). */
function priorOf(row) {
  try { const p = JSON.parse(String(row?.prior ?? '')); return p && typeof p === 'object' && !Array.isArray(p) ? p : null; } catch { return null; }
}

/**
 * VOID (Seats-Arc 18: "Moderators (MOD1) may **void a siege** (`/siege void`) - a history row, the holder keeping the
 * seat - when a fight was won by an exploit found after it"): THE SEAT'S BATTLE OF THIS WEEK (a siege, a Tourney or a
 * revolt) VOIDED - a moderator's or a developer's (titles.js canModerate). The battle's row void, so no pass opens to it
 * and no receipt claims it (claimSiege's 'battle-void'), and a Chronicle row says the Moderators voided it. Then:
 *   no result yet - as a Turning voids an unfinished one: every Sellsword's escrow home now (signed or not; nobody earns
 *     a fee). DECIDED: the challenger's Right does NOT carry (an exploit's void, never a room lost - the Turning carries
 *     a Right only for a battle still scheduled, and this one is void). AUDIT 529 V1 - DECIDED: a revolt's void before
 *     its result is what the Turning does with a revolt nobody put down - its holder's Charter lapses now (revoltStood);
 *     before, the void saved a Charter the Turning would have lapsed (it counts only a revolt still scheduled);
 *   a seat taken (a siege's `attack`; a revolt that stood) - the Charter back to the guild that held it before the battle,
 *     as its result's `prior` kept it (its Standing, the week it took the seat, its truce, Tithe and arrears; where none
 *     was kept, Standing 50 from this week), its Legacy at the seat given back, the works' capture drop undone (each work
 *     at least the tier it was fought behind) and a Fortifier's save it spent unspent; the capturer's own building
 *     projects fall and its Edict for next week is void. AUDIT 529 V2 - DECIDED: the holder's own projects the capture (or
 *     the revolt's lapse) made fall begun again, what they held back out of the stockpile where it is still there
 *     (seatForts.js fortsRestoredStatements) - given back, never refunded; and a revolt's voided Edict proclaimed again.
 *     AUDIT 529 V3: where the result kept a seat nobody held (its holder relinquished before the battle), the capturer's
 *     Charter goes and none comes back (`restored` false);
 *   a seat held (a siege's `defend` or forfeit; a revolt put down) - the holder's Standing back to what it was before
 *     and its defence fifth struck. AUDIT 529 V4 - DECIDED: where none was kept, its Standing left as it stands (the
 *     result's change taken off over-took a Throne's -5, a paid forfeit's nothing and the cap); DECIDED: the challenger's
 *     bar lifted too, its influence at the seat this week and its Legacy given back - the exploit's victim loses nothing;
 *   a Tourney won - the winner's Charter gone (the seat unheld again), its projects fallen, its Edict void; DECIDED: the
 *     claim fee it paid stays burnt.
 * DECIDED: Honours, Marks, Renown and Spoils already claimed stand (never clawed back); the Sellswords paid at the result
 * stay paid. No red line. Idempotent - a battle already void answers `repeat`; a seat with no battle this week, 'battle-none'.
 * AUDIT 529 V5: never a week its Turning has settled - 'battle-settled' (a void whose clock was read before the boundary,
 * landing after the Turning reckoned the battle's week; asked in the void's own write too).
 * Answers `{ ok, key, week, battle, result, restored }` - `result` the voided result (null where none had come),
 * `restored` whether a Charter went back to the guild that held it.
 * @param {{db: any, nowS: number}} ctx
 */
export async function voidSiege({ db, nowS }, mod, env, { key } = {}) {
  if (!canModerate(mod, env)) return { error: 'not-moderator' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const W = weekAt(nowS);
  // a receipt that lands between the read and the write rolls the void back whole, and it is read again with the result
  for (let tries = 0; tries < 3; tries++) {
    const b = await battleAt(db, W, key);
    if (!b) return { error: 'battle-none' };
    const out = { ok: true, key, week: W, battle: b.kind };
    if (b.state === 'void') return { ...out, repeat: true };
    if (await db.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').bind(W).first()) return { error: 'battle-settled' };   // AUDIT 529 V5
    const r = await db.prepare('SELECT result, raised, winner, rid, at, prior FROM town_seat_results WHERE week = ? AND key = ?').bind(W, key).first();
    const { results: gs = [] } = await db.prepare('SELECT id, name, tag FROM guilds WHERE id IN (?, ?)').bind(b.attacker, b.defender).all();
    const names = new Map(gs.map((g) => [g.id, { name: g.name, tag: g.tag }]));
    const nameOf = (id) => names.get(id) ?? { name: '', tag: '' };
    // AUDIT 529 V5: the week unsettled, asked in the write - a Turning that came first rolls the void back
    const unsettled = 'NOT EXISTS (SELECT 1 FROM town_seat_weeks WHERE week = ?1)';
    const stmts = r
      ? [db.prepare(`UPDATE town_seat_battles SET state = 'void' WHERE week = ?1 AND key = ?2 AND state IN ('fought', 'forfeit')
          AND EXISTS (SELECT 1 FROM town_seat_results WHERE week = ?1 AND key = ?2 AND rid = ?3) AND ${unsettled}`).bind(W, key, r.rid), mustChange(db)]
      : [db.prepare(`UPDATE town_seat_battles SET state = 'void' WHERE week = ?1 AND key = ?2 AND state = 'scheduled'
          AND NOT EXISTS (SELECT 1 FROM town_seat_results WHERE week = ?1 AND key = ?2) AND ${unsettled}`).bind(W, key), mustChange(db),
        ...(await swordsSettled(db, W, key, nowS, { voided: true }))];   // the escrow home, as the Turning's void
    // AUDIT 529 V1: a revolt nobody put down - its holder's Charter lapses, as the Turning lapses it (where the holder holds)
    if (!r && b.kind === 'revolt' && await db.prepare('SELECT 1 FROM town_seat_holds WHERE key = ? AND guild_id = ?').bind(key, b.defender).first()) {
      const history = (kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)').bind(key, W, kind, JSON.stringify(data), nowS);
      stmts.push(...revoltStood(db, key, W, b.defender, nameOf(b.defender), nowS, history));
    }
    let restored = false;
    if (r) {
      const kept = priorOf(r);   // AUDIT 529 V3: null where none was stored; stored, its `hold` null at a seat nobody held
      const p = kept ?? {};
      const held = p.hold && typeof p.hold === 'object' && p.hold.guild === b.defender ? p.hold : null;
      const legacyBack = (Array.isArray(p.legacy) ? p.legacy : []).filter((l) => Array.isArray(l) && Number.isSafeInteger(l[0]) && typeof l[1] === 'string' && Number.isSafeInteger(l[2]) && l[2] >= 0)
        .map(([w, g, n]) => db.prepare('INSERT OR IGNORE INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').bind(w, key, g, n));
      if (b.kind === 'tourney') {
        const won = r.winner === 'attack' ? b.attacker : r.winner === 'defend' ? b.defender : null;
        if (won) {
          stmts.push(
            db.prepare('DELETE FROM town_seat_holds WHERE key = ? AND guild_id = ? AND since_week = ?').bind(key, won, W),
            db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND week = ? AND guild_id = ? AND state = 'proclaimed'").bind(key, W + 1, won),
            ...fortsLapsedStatements(db, key, nowS),
          );
        }
      } else if (r.result === 'attack') {
        // the Charter back where it stood - over the capturer's row (a revolt that stood left none). AUDIT 529 V3: none back
        // where the result kept the seat unheld - the capturer's row alone gone
        const back = held != null || kept == null;
        const seat = held ? null : (await confirmedSeats(db, nowS)).get(key);
        const num = (v, d) => (Number.isSafeInteger(v) ? v : d);
        const h = held ?? {};
        stmts.push(
          ...fortsDueStatements(db, nowS, key),
          ...(b.kind === 'siege' ? fortsGuildFallStatements(db, key, b.attacker) : []),
          !back ? db.prepare('DELETE FROM town_seat_holds WHERE key = ? AND guild_id = ? AND since_week = ?').bind(key, b.attacker, W) : db.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, tithe, tithe_week, owed, at)
            SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11 WHERE EXISTS (SELECT 1 FROM guilds WHERE id = ?2)
            ON CONFLICT (key) DO UPDATE SET guild_id = excluded.guild_id, region = excluded.region, since_week = excluded.since_week,
              standing = excluded.standing, truce_week = excluded.truce_week, tithe = excluded.tithe, tithe_week = excluded.tithe_week,
              owed = excluded.owed, at = excluded.at WHERE town_seat_holds.guild_id = ?12`)
            .bind(key, b.defender, num(h.region, Number(seat?.region ?? 0)), b.tier, num(h.since, W), num(h.standing, STANDING_START),
              num(h.truce, null), num(h.tithe, 0), num(h.titheWeek, null), num(h.owed, 0), nowS, b.attacker),
          ...legacyBack,
        );
        if (b.kind === 'siege') {
          stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND week = ? AND guild_id = ? AND state = 'proclaimed'").bind(key, W + 1, b.attacker));
          const forts = p.forts && typeof p.forts === 'object' ? Object.entries(p.forts).filter(([, t]) => Number.isSafeInteger(t) && t >= 0 && t <= 3) : [];
          for (const [work, t] of forts) stmts.push(db.prepare('UPDATE town_seat_forts SET tier = MAX(tier, ?) WHERE key = ? AND work = ?').bind(t, key, work));
          stmts.push(db.prepare('DELETE FROM town_seat_fortifier WHERE key = ? AND at = ?').bind(key, Number(r.at)));   // a Fortifier's save at this capture, unspent
        }
        if (held) {
          // AUDIT 529 V2: the holder's projects the capture or the lapse made fall begun again - after the tiers came back
          const int = (v) => Number.isSafeInteger(v);
          const projects = (Array.isArray(p.projects) ? p.projects : []).filter((x) => Array.isArray(x) && typeof x[0] === 'string' && int(x[1]) && x[1] >= 1 && x[1] <= 3
            && x[2] === b.defender && (x[5] == null || int(x[5])) && int(x[6])).map(([work, building, , builder, siegewright, standsAt, at]) => [work, building, builder === 1, siegewright === 1, standsAt ?? null, at]);
          const stuff = (Array.isArray(p.held) ? p.held : []).filter((x) => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'string' && int(x[2]) && x[2] > 0);
          stmts.push(...fortsRestoredStatements(db, key, b.defender, projects, stuff));
          // and a revolt's Edict for next week, which its lapse voided, proclaimed again
          if (b.kind === 'revolt' && typeof p.edict === 'string') {
            stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'proclaimed' WHERE key = ? AND week = ? AND guild_id = ? AND edict = ? AND state = 'void'").bind(key, W + 1, b.defender, p.edict));
          }
        }
        restored = back && names.has(b.defender);
      } else {
        // the holder's Standing back where it stood. AUDIT 529 V4: with none kept, left as it stands - the result's change
        // taken off missed a Throne's -5, a forfeit already paid and the cap, and took off more than the result gave
        if (held && Number.isSafeInteger(held.standing)) {
          stmts.push(db.prepare('UPDATE town_seat_holds SET standing = ? WHERE key = ? AND guild_id = ?').bind(held.standing, key, b.defender));
        }
        if (b.kind === 'siege') {
          stmts.push(
            db.prepare(`DELETE FROM town_seat_aftermath WHERE week = ?1 AND key = ?2
              AND ((guild_id = ?3 AND what = 'bonus') OR (guild_id = ?4 AND what = 'barred'))`).bind(W, key, b.defender, b.attacker),
            db.prepare('UPDATE town_seat_influence SET voided = 0 WHERE week = ? AND key = ? AND guild_id = ?').bind(W, key, b.attacker),
            ...legacyBack,
          );
        }
      }
    }
    stmts.push(db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)').bind(key, W, 'siege-voided',
      JSON.stringify({ battle: b.kind, result: r?.result ?? null, guild: nameOf(b.attacker), holder: nameOf(b.defender), restored, by: mod.handle ?? null }), nowS));
    try { await db.batch(stmts); } catch { continue; }
    return { ...out, result: r?.result ?? null, restored };
  }
  throw new Error('voidSiege: the battle would not hold still');   // a 500, never a quiet half-void
}
