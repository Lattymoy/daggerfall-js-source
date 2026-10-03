// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF6 (2026-09-29, Mac: "continue") - GUILD WRITS, THE GUILD STORES AND
// COMMISSIONS, AS THE SERVICE KEEPS THEM (bible/06-Systems/Professions-Arc.md
// 7, 11 and 28; the numbers are src/net/writLaw.js, which the client reads
// too). The Court's writs stay professions.js's: they mint; these move
// Marks a guild or a player already holds.
//
// ═══ OPEN WHERE THE PROFESSIONS AND THE MARKS ARE ═════════════════
//
// A guild writ and a commission move Marks and the Stores, so they are
// open to an account while PROFESSIONS_OPEN and MARKS_OPEN both are; the
// guild Stores are the professions' alone. No switch of its own (28).
//
// ═══ ONE STATEMENT DECIDES, AND A REQUEST ASKED TWICE IS ONE ════════
//
// PROF1's law, whole: each act is one `db.batch` whose FIRST statement
// writes its row with a fresh nonce `n` only where every condition holds
// against the rows as they stand - the guild's Marks and its rank, the
// Officers' budget, the writ's units left, the Stores, the guild Stores'
// room, the crafter's own piece, the Marks cap - and every statement after
// it moves goods and Marks only where that row carries this request's
// nonce. The row is looked for BEFORE the switch (AUDIT 28 M2): a request
// that was made is answered, `repeat`. Every Marks line is a plain INSERT
// under its own suffixed id (AUDIT 30 S1-S4), and each decision refuses an
// id whose line the ledger already holds.
//
// ═══ SETTLED ON READ ════════════════════════════════════════════════
//
// Nothing here runs on a clock. A guild writ past its seventh day is closed
// and its escrow returned to its guild's treasury by the next Work read of
// ANYONE (the treasury is no reader's own - PROF5b's close); a commission's
// escrow comes back on its poster's own read. Each return is one line keyed
// on the row's own id, so it happens once, and waits while the Marks cap
// cannot take it.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, mintId, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { marksOpenFor, balanceOf, guildBalanceOf } from './marks.js';
import { profOpenFor, spendStatements, spendableSql, storeOf } from './professions.js';
import { CHAR_ID_RE } from './service.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import { STORES_MAX } from '../../src/net/professionLaw.js';
import { material, regionOk } from '../../src/net/nodeLaw.js';
import { HANDLE_RE } from '../../src/net/handleShape.js';
import { GUILD_RANK_MASTER } from '../../src/net/guildLaw.js';
import { fortMaterialOk, RAM_KIT_KEY } from '../../src/net/fortLaw.js';   // SEAT2b: what a seat writ may ask; part two: a Siege Camp's Ram Kits
import { seatKeyOk } from '../../src/net/townSeatLaw.js';
import { confirmedSeats } from './townSeats.js';
import { supplyForts } from './seatForts.js';   // SEAT2b: a stockpile's delivery moved into its projects
import { heraldryOfRow } from './halls.js';   // AUDIT-SEATS G11: a writ's guild's banner
import { creditSeatWrit } from './seatInfluence.js';   // SEAT2b: a seat writ's delivery as influence
import { saleTax, saleTaxOn, provenanceOk, pieceListable, UNYIELDED, WEAR_WHOLE } from '../../src/net/marketLaw.js';
import {
  WRIT_S, GUILD_WRITS_MAX, WRIT_POSTS_MAX, WRIT_OPS_MAX, WRIT_WINDOW_S, WRIT_SETTLE_MAX, WRIT_SHOWN, WRIT_RECENT_S, WRIT_RID_RE,
  WRIT_ID_RE, GUILD_STORES_MAX, GUILD_STORE_MOVES_SHOWN, COMMISSIONS_MAX, COMMISSIONS_FOR_MAX,
  writMaterialOk, writUnitsOk, writPayOk, writBudgetOk, seatWeek, guildMoveOk, commissionPayOk, commissionable,
  commissionUnyielded, commissionQualityOk, commissionFilledBy, writMay, guildTakeMay, writDeliverMay, WRIT_POWERS,
} from '../../src/net/writLaw.js';

/** AUDIT 31: the ranks that take the guild Stores out, in SQL (`rank IN (...)`) - WRIT_POWERS' own. */
const TAKERS_SQL = WRIT_POWERS.storesWithdraw.join(', ');
/** AUDIT 31 L9: what a guild's standing writs of a material still want - the guild Stores' room they hold (guild `g`,
 *  material `m`, the moment `now`, in SQL). */
const reservedSql = (g, m, now) => `COALESCE((SELECT SUM(left_units) FROM guild_writs WHERE guild_id = ${g} AND material = ${m} AND state = 'open'
  AND expires_at > ${now} AND seat IS NULL), 0)`;   // SEAT2b: a seat writ's units go to the seat, never the guild Stores
/** A guild's Stores of a material, in SQL. */
const guildHeldSql = (g, m) => `COALESCE((SELECT SUM(qty) FROM guild_prof_stores WHERE guild_id = ${g} AND material = ${m}), 0)`;
/** SILVER-WAYS: what guild `g`'s Officers have put up in seat week `week`, in SQL - their writs' pay and their
 *  contracts' (contracts.js) - one budget for both, so a contract is no way round the writ budget. */
export const officerSpentSql = (g, week) => `(COALESCE((SELECT SUM(units * pay) FROM guild_writs WHERE guild_id = ${g} AND week = ${week} AND officer = 1), 0)
  + COALESCE((SELECT SUM(deeds * pay) FROM guild_contracts WHERE guild_id = ${g} AND week = ${week} AND officer = 1), 0))`;

const INSERT_LINE = 'INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)';

/** Whether guild writs and commissions are open to this account: the professions and the Marks, each at its switch. */
export function writsOpenFor(player, env) {
  return profOpenFor(player, env) && marksOpenFor(player, env);
}
const charOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);
/** The first door: a registered account, its character, and (for an act) a request id. */
function asks(player, { character, rid, needRid = true, needChar = true }) {
  if (accountKind(player) !== 'linked') return { error: 'prof-need-account' };
  if (needChar && !charOk(character)) return { error: 'prof-character' };
  if (needRid && (typeof rid !== 'string' || !WRIT_RID_RE.test(rid))) return { error: 'prof-rid' };
  return null;
}
const shut = (player, env) => (writsOpenFor(player, env) ? null : { error: 'writs-closed' });
const storesShut = (player, env) => (profOpenFor(player, env) ? null : { error: 'prof-closed' });
const idOk = (id) => typeof id === 'string' && WRIT_ID_RE.test(id);
const acting = (ctx, player) => overRate(ctx, `writ:${player.id}`, WRIT_OPS_MAX, WRIT_WINDOW_S);
/** AUDIT 30 S3: whether the ledger already holds this account's line `rid` + `suffix` - a request id spent. */
const spent = async (db, me, rid, suffix) => !!(await db.prepare('SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2').bind(me, `${rid}${suffix}`).first());
/** A character's rank in a guild, or null. */
async function rankIn(db, me, character, guildId) {
  const r = await db.prepare('SELECT rank FROM guild_members WHERE player = ?1 AND char_id = ?2 AND guild_id = ?3').bind(me, character, guildId).first();
  return r ? Number(r.rank) : null;
}

// ─── WHAT A ROW LOOKS LIKE TO THE CLIENT ─────────────────────────────

const WRIT_ROW = `SELECT w.*, g.name AS guild_name, g.tag AS guild_tag, g.heraldry AS guild_heraldry, ${guildHeldSql('w.guild_id', 'w.material')} AS guild_held
  FROM guild_writs w JOIN guilds g ON g.id = w.guild_id`;
const guildWritView = (w, me, may = false) => ({
  id: w.id, kind: 'guild', guild: { id: w.guild_id, name: w.guild_name ?? null, tag: w.guild_tag ?? null, heraldry: heraldryOfRow(w.guild_heraldry) }, region: Number(w.region),   // AUDIT-SEATS G11: its banner on the card
  material: w.material, units: Number(w.units), left: Number(w.left_units), pay: Number(w.pay), escrow: Number(w.escrow),
  at: Number(w.at), expiresAt: Number(w.expires_at), state: w.state, mine: w.poster === me, may,
  // AUDIT 31 U10: what the guild Stores can still take of its material - a delivery past it is refused
  room: w.seat == null ? Math.max(0, GUILD_STORES_MAX - Number(w.guild_held ?? 0)) : null,
  // SEAT2b: a seat writ's seat, and whether it fills a Siege Camp (else the seat's stockpile)
  seat: w.seat == null ? null : Number(w.seat), camp: Number(w.camp ?? 0) === 1, seatName: w.seat_name ?? null,
});
const COMMISSION_ROW = `SELECT c.*, pp.handle AS poster_handle, cp.handle AS crafter_handle FROM commissions c
  JOIN players pp ON pp.id = c.poster LEFT JOIN players cp ON cp.id = c.crafter`;
const commissionView = (c, me, eligible = null) => ({
  id: c.id, kind: 'commission', region: Number(c.region), recipe: c.recipe, quality: c.quality == null ? null : Number(c.quality),
  pay: Number(c.pay), poster: c.poster_handle ?? null, crafter: c.crafter_handle ?? null, at: Number(c.at), expiresAt: Number(c.expires_at),
  state: c.state, mine: c.poster === me, forMe: c.crafter != null && c.crafter === me, returned: Number(c.returned) === 1,
  ...(c.provenance ? { provenance: c.provenance } : {}),
  ...(eligible ? { eligible } : {}),
});
async function guildWritOf(db, id, me, may = false) {
  const w = await db.prepare(`${WRIT_ROW} WHERE w.id = ?1`).bind(id).first();
  return w ? guildWritView(w, me, may) : null;
}
async function commissionOf(db, id, me) {
  const c = await db.prepare(`${COMMISSION_ROW} WHERE c.id = ?1`).bind(id).first();
  return c ? commissionView(c, me) : null;
}
/** Whether a rank may withdraw a writ: the Guildmaster any of the guild's, an Officer those they posted. */
const mayWithdraw = (rank, w, me) => rank === GUILD_RANK_MASTER || (rank != null && writMay(rank, 'postWrit') && w.poster === me);

// ─── THE RETURNS (each one line keyed on its row's own id) ───────────

/** What is left of a closed guild writ's escrow, back to its guild's Marks treasury under the cap - the line's actor
 *  the guild (its id the writ's, so it is written once whoever's read settles it). */
function guildWritReturn(db, id, nowS) {
  return [
    db.prepare(`${INSERT_LINE} SELECT 'escrow', id, 'guild', guild_id, 'writ-return', escrow, ?2, ?3, guild_id, material, 'writ-return:' || id
      FROM guild_writs WHERE id = ?1 AND state != 'open' AND returned = 0 AND escrow > 0
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = guild_writs.guild_id AND rid = 'writ-return:' || ?1)
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = guild_writs.guild_id), 0) + escrow <= ?4`)
      .bind(id, utcDay(nowS), nowS, MARKS_MAX),
    db.prepare(`UPDATE guild_writs SET returned = 1, escrow = 0 WHERE id = ?1 AND state != 'open' AND returned = 0
      AND (escrow = 0 OR EXISTS (SELECT 1 FROM marks_ledger WHERE actor = guild_writs.guild_id AND rid = 'writ-return:' || ?1))`).bind(id),
  ];
}
/** A closed (not filled) commission's pay, back to its poster under the cap - one line keyed on the commission. */
function commissionReturn(db, id, nowS) {
  return [
    db.prepare(`${INSERT_LINE} SELECT 'escrow', id, 'account', poster, 'commission-return', pay, ?2, ?3, poster, recipe, 'commission-return:' || id
      FROM commissions WHERE id = ?1 AND state IN ('withdrawn', 'declined', 'expired') AND returned = 0
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = commissions.poster AND rid = 'commission-return:' || ?1)
        AND COALESCE((SELECT balance FROM marks WHERE account = commissions.poster), 0) + pay <= ?4`)
      .bind(id, utcDay(nowS), nowS, MARKS_MAX),
    db.prepare(`UPDATE commissions SET returned = 1 WHERE id = ?1 AND returned = 0
      AND EXISTS (SELECT 1 FROM marks_ledger WHERE actor = commissions.poster AND rid = 'commission-return:' || ?1)`).bind(id),
  ];
}

// ─── SETTLED ON READ ─────────────────────────────────────────────────

/** THE GUILD WRITS PAST THEIR DAYS, closed, and every closed writ's escrow home - anyone's Work read runs it; at most
 *  WRIT_SETTLE_MAX a read, one batch each; a treasury the cap cannot take waits. */
async function closeGuildWrits({ db, nowS }) {
  const { results: due = [] } = await db.prepare(`SELECT id FROM guild_writs WHERE (state = 'open' AND expires_at <= ?1)
      OR (state != 'open' AND returned = 0 AND (escrow = 0 OR COALESCE((SELECT balance FROM guild_marks WHERE guild_id = guild_writs.guild_id), 0) + escrow <= ?2))
    ORDER BY expires_at LIMIT ${WRIT_SETTLE_MAX}`).bind(nowS, MARKS_MAX).all();
  for (const w of due) {
    await db.batch([
      db.prepare(`UPDATE guild_writs SET state = 'expired', closed_at = ?2 WHERE id = ?1 AND state = 'open' AND expires_at <= ?2`).bind(w.id, nowS),
      ...guildWritReturn(db, w.id, nowS),
    ]);
  }
}
/** An account's own commissions settled: those past their days closed - those it posted and (AUDIT 31 L1) those naming
 *  it, so a crafter's Yours never shows one open that cannot be filled - those whose crafter is gone declined, and the
 *  escrow of each closed one it posted (not filled) back, under the Marks cap. */
async function settleCommissions({ db, nowS }, me) {
  await db.batch([
    db.prepare(`UPDATE commissions SET state = 'expired', closed_at = ?2 WHERE (poster = ?1 OR crafter = ?1) AND state = 'open' AND expires_at <= ?2`)
      .bind(me, nowS),
    db.prepare(`UPDATE commissions SET state = 'declined', closed_at = ?2 WHERE poster = ?1 AND state = 'open' AND crafter IS NULL`).bind(me, nowS),
  ]);
  const { results: back = [] } = await db.prepare(`SELECT id FROM commissions WHERE poster = ?1 AND state IN ('withdrawn', 'declined', 'expired') AND returned = 0
      AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + pay <= ?2
    ORDER BY closed_at LIMIT ${WRIT_SETTLE_MAX}`).bind(me, MARKS_MAX).all();
  for (const c of back) await db.batch(commissionReturn(db, c.id, nowS));
}

// ─── THE WORK TAB'S READ ─────────────────────────────────────────────

/**
 * THE BOARD'S GUILD WRITS AND COMMISSIONS: `{ character, region }` - beside the Court's writs (index.js merges this
 * into `/v1/writs/list`'s answer). The expired guild writs swept, this account's commissions settled; then this
 * region's open guild writs and commissions, soonest to end first; "yours" - this account's commissions posted (open,
 * and closed this week) and naming it, every region, and this character's guild's open writs, every region; and the
 * character's guild with its rank and the Officers' budget left this week. Empty while the switches are shut.
 */
export async function writBoard(ctx, player, env, { character, region } = {}) {
  const { db, nowS } = ctx;
  if (!writsOpenFor(player, env) || !charOk(character) || !regionOk(region)) return {};
  const me = player.id;
  await closeGuildWrits(ctx);
  await settleCommissions(ctx, me);
  const member = await db.prepare(`SELECT m.guild_id, m.rank, g.name, g.tag FROM guild_members m JOIN guilds g ON g.id = m.guild_id
    WHERE m.player = ?1 AND m.char_id = ?2`).bind(me, character).first();
  const rank = member ? Number(member.rank) : null;
  const { results: here = [] } = await db.prepare(`${WRIT_ROW} WHERE w.region = ?1 AND w.state = 'open' AND w.expires_at > ?2
    ORDER BY w.expires_at LIMIT ${WRIT_SHOWN}`).bind(region, nowS).all();
  const { results: ours = [] } = member ? await db.prepare(`${WRIT_ROW} WHERE w.guild_id = ?1 AND w.state = 'open' AND w.expires_at > ?2
    ORDER BY w.expires_at LIMIT ${WRIT_SHOWN}`).bind(member.guild_id, nowS).all() : { results: [] };
  const { results: asked = [] } = await db.prepare(`${COMMISSION_ROW} WHERE c.region = ?1 AND c.state = 'open' AND c.expires_at > ?2 AND c.crafter IS NOT NULL
    ORDER BY c.expires_at LIMIT ${WRIT_SHOWN}`).bind(region, nowS).all();
  const { results: mine = [] } = await db.prepare(`${COMMISSION_ROW} WHERE (c.poster = ?1 AND (c.state = 'open' OR c.closed_at > ?2))
      OR (c.crafter = ?1 AND (c.state = 'open' OR c.closed_at > ?2))   -- AUDIT 31 L1: a week of those closed, as the poster's
    ORDER BY c.at DESC LIMIT ${WRIT_SHOWN}`).bind(me, nowS - WRIT_RECENT_S).all();
  const ourGuild = member ? { guild: await guildOfMember(db, member, rank, nowS) } : { guild: null };
  // SEAT2b: each seat writ's seat by name; the member's guild's seats of this region a writ may fill - those it holds (the
  // stockpile) and those it is pledged to this week (its Siege Camp)
  const seats = [...here, ...ours].some((x) => x.seat != null) || member ? await confirmedSeats(db, nowS) : null;
  for (const x of [...here, ...ours]) if (x.seat != null) x.seat_name = seats?.get(Number(x.seat))?.name ?? null;
  if (member && ourGuild.guild) ourGuild.guild.seats = await writSeatsOf(db, member.guild_id, region, nowS, seats);
  const own = member?.guild_id ?? null;
  const fits = await eligibleHere(db, me, region, nowS);
  const view = (c) => commissionView(c, me, c.crafter === me && Number(c.region) === region && c.state === 'open' ? fits.get(c.id) ?? [] : null);
  return {
    guildWrits: here.map((w) => guildWritView(w, me, w.guild_id === own && mayWithdraw(rank, w, me))),
    commissions: asked.map(view),
    yours: {
      commissions: mine.map(view),
      guildWrits: ours.map((w) => guildWritView(w, me, mayWithdraw(rank, w, me))),
    },
    ...ourGuild,
    balance: await balanceOf(db, me),
    // AUDIT 31 U5, U10: the Work tab offers its forms only while they are this account's, and names no crafter it is
    writsOpen: true, me: displayName(player),
  };
}
/** AUDIT 31 U7: the pieces that would fill each commission naming this account in this region - of its own make, the
 *  recipe asked, at least the quality, owned and on no sale, road or home (the fill's own guards) - the least quality
 *  first, so the fill spends the least it must. A map of the commission's id to `{ provenance, quality }`s. */
async function eligibleHere(db, me, region, nowS) {
  const { results = [] } = await db.prepare(`SELECT c.id AS commission, p.provenance, p.quality FROM commissions c
      JOIN products p ON p.owner = ?1 AND p.listed = 0 AND p.recipe = c.recipe AND (c.quality IS NULL OR p.quality >= c.quality)
        AND COALESCE(p.bought_with, '') != 'gold'   -- GOLD-MARKET: a piece bought with gold fills no Drakes commission
    WHERE c.crafter = ?1 AND c.region = ?2 AND c.state = 'open' AND c.expires_at > ?3
      AND EXISTS (SELECT 1 FROM prof_crafts WHERE player = ?1 AND (provenance = p.provenance OR provenance2 = p.provenance))
      AND NOT EXISTS (SELECT 1 FROM market_listings WHERE provenance = p.provenance AND state = 'open')
      AND NOT EXISTS (SELECT 1 FROM market_auctions WHERE provenance = p.provenance AND state = 'open')
      AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = p.provenance AND collected = 0)
      AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = p.provenance)
    ORDER BY p.quality, p.provenance LIMIT ${WRIT_SHOWN * 4}`).bind(me, region, nowS).all();
  const out = new Map();
  for (const r of results) {
    const list = out.get(r.commission) ?? [];
    if (list.length < WRIT_SHOWN) list.push({ provenance: r.provenance, quality: Number(r.quality) });
    out.set(r.commission, list);
  }
  return out;
}
/** SEAT2b: the seats of `region` a writ of guild `g` may fill - `[{ key, name, camp }]`, held first. */
async function writSeatsOf(db, g, region, nowS, seats) {
  const { results: held = [] } = await db.prepare('SELECT key FROM town_seat_holds WHERE guild_id = ? AND region = ?').bind(g, region).all();
  const { results: pledged = [] } = await db.prepare('SELECT key FROM town_seat_pledges WHERE week = ? AND guild_id = ? AND region = ?').bind(seatWeek(nowS), g, region).all();
  const out = held.map((h) => ({ key: Number(h.key), name: seats?.get(Number(h.key))?.name ?? null, camp: false }));
  for (const p of pledged) if (!out.some((x) => x.key === Number(p.key))) out.push({ key: Number(p.key), name: seats?.get(Number(p.key))?.name ?? null, camp: true });
  return out.filter((x) => x.name);
}
/** A member's guild as the Work tab reads it: its name and tag, the reader's rank, whether it may post, the treasury,
 *  and the Officers' budget this seat week - set, spent, left. */
async function guildOfMember(db, member, rank, nowS) {
  return {
    id: member.guild_id, name: member.name, tag: member.tag, rank, mayPost: writMay(rank, 'postWrit'), marks: await guildBalanceOf(db, member.guild_id),
    ...(await budgetOf(db, member.guild_id, nowS)),
  };
}
/** The Officers' writ budget this seat week: set, spent (the escrow of what they posted in it - SILVER-WAYS: writs and
 *  contracts), left. */
async function budgetOf(db, guildId, nowS) {
  const b = await db.prepare('SELECT budget FROM guild_writ_budgets WHERE guild_id = ?1').bind(guildId).first();
  const s = await db.prepare(`SELECT ${officerSpentSql('?1', '?2')} AS s`).bind(guildId, seatWeek(nowS)).first();
  const budget = Number(b?.budget ?? 0), spentNow = Number(s?.s ?? 0);
  return { budget, spent: spentNow, left: Math.max(0, budget - spentNow) };
}

// ─── GUILD WRITS (11) ────────────────────────────────────────────────

/**
 * POST: `{ character, region, material, units, pay, rid }` - a guild writ for `units` of a material at `pay` Marks each,
 * on the boards of `region` for seven days; the whole pay escrowed from the character's guild's Marks treasury. The
 * Guildmaster's; an Officer's within the Officers' budget this seat week.
 */
export async function postGuildWrit(ctx, player, env, { character, region, material: key, units, pay, rid, seat = null } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, writ: await guildWritOf(db, row.id, me, true), guildMarks: await guildBalanceOf(db, row.guild_id),
  });
  const prior = await db.prepare('SELECT * FROM guild_writs WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  // AUDIT 31 L6: a material the Stores keep but nothing yields yet is its own word
  if (!writMaterialOk(key)) return { error: material(key) && UNYIELDED.includes(key) ? 'market-unyielded' : 'bad-material' };
  if (!writUnitsOk(units)) return { error: 'bad-units' };
  if (!writPayOk(key, pay)) return { error: 'writ-pay' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const rank = Number(a.me.rank);
  if (!writMay(rank, 'postWrit')) return { error: 'guild-rank' };
  const g = a.me.guild_id;
  // SEAT2b (Professions-Arc 11; Seats-Arc 4.2, 7.5): A SEAT WRIT - for a confirmed seat of this region and a material a
  // work asks; the holder's fills the seat's stockpile, a pledged challenger's (this week) its Siege Camp
  let camp = 0;
  if (seat != null) {
    if (!seatKeyOk(seat)) return { error: 'bad-seat' };
    const s = (await confirmedSeats(db, nowS)).get(seat);
    if (!s || Number(s.region) !== region) return { error: 'writ-elsewhere' };
    if (!fortMaterialOk(key) && key !== RAM_KIT_KEY) return { error: 'bad-material' };
    const holds = await db.prepare('SELECT 1 FROM town_seat_holds WHERE key = ? AND guild_id = ?').bind(seat, g).first();
    if (!holds) {
      const pledged = await db.prepare('SELECT 1 FROM town_seat_pledges WHERE week = ? AND key = ? AND guild_id = ?').bind(seatWeek(nowS), seat, g).first();
      if (!pledged) return { error: 'seat-not-pledged' };
      camp = 1;
    }
    // SEAT2b part two (Seats-Arc 4.2: "its siege works (a Ram Kit) go to the siege it won"): A RAM KIT IS A SIEGE CAMP'S - a
    // holder's stockpile builds works and no work asks one
    if (key === RAM_KIT_KEY && !camp) return { error: 'bad-material' };
  } else if (key === RAM_KIT_KEY) return { error: 'bad-material' };   // SEAT2b part two: nor the guild Stores' (a kit leaves the Stores by a camp's writ alone)
  if (await overRate(ctx, `writ-post:${me}`, WRIT_POSTS_MAX, WRIT_WINDOW_S)) return { error: 'writ-rate' };
  const officer = rank === GUILD_RANK_MASTER ? 0 : 1;
  const escrow = units * pay;
  const week = seatWeek(nowS);
  const nonce = mintId(rand);
  const id = mintId(rand);
  await db.batch([
    // THE DECISION: the rank still held, the treasury's Marks, the guild's twenty, an Officer's budget, the id unspent
    db.prepare(`INSERT OR IGNORE INTO guild_writs (id, guild_id, poster, poster_char, officer, week, region, material, units, left_units, pay, escrow,
        at, expires_at, rid, n, seat, camp)
      SELECT ?3, ?4, ?1, ?2, ?5, ?6, ?7, ?8, ?9, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?19, ?20
      WHERE EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?2 AND guild_id = ?4 AND rank = ?16)
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?4), 0) >= ?11
        -- AUDIT 31 L1: the twenty that stand - one past its seventh day, not yet swept, is not among them
        AND (SELECT COUNT(*) FROM guild_writs WHERE guild_id = ?4 AND state = 'open' AND expires_at > ?12) < ?17
        -- AUDIT 31 L9: the guild Stores' room for it, past what they hold and what the standing writs of it still want
        AND (?19 IS NOT NULL OR ${guildHeldSql('?4', '?8')} + ${reservedSql('?4', '?8', '?12')} + ?9 <= ?18)   -- SEAT2b: a seat writ fills no guild Stores
        AND (?5 = 0 OR ${officerSpentSql('?4', '?6')} + ?11 <= COALESCE((SELECT budget FROM guild_writ_budgets WHERE guild_id = ?4), 0))   -- SILVER-WAYS: and their contracts'
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?14 || ':wesc')`)
      .bind(me, character, id, g, officer, week, region, key, units, pay, escrow, nowS, nowS + WRIT_S, rid, nonce, rank, GUILD_WRITS_MAX, GUILD_STORES_MAX, seat, camp),
    // the pay held: the treasury to the ledger's escrow end, the writ's id
    db.prepare(`${INSERT_LINE} SELECT 'guild', guild_id, 'escrow', id, 'writ-escrow', escrow, ?4, at, poster, material, rid || ':wesc'
      FROM guild_writs WHERE poster = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce, utcDay(nowS)),
  ]);
  const made = await db.prepare('SELECT * FROM guild_writs WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':wesc')) return { error: 'prof-rid' };
  if ((await rankIn(db, me, character, g)) !== rank) return { error: 'guild-rank' };
  if ((await guildBalanceOf(db, g)) < escrow) return { error: 'guild-marks-short' };
  const open = await db.prepare(`SELECT COUNT(*) AS n FROM guild_writs WHERE guild_id = ?1 AND state = 'open' AND expires_at > ?2`).bind(g, nowS).first();
  if (Number(open?.n ?? 0) >= GUILD_WRITS_MAX) return { error: 'guild-writs-max' };
  const room = await db.prepare(`SELECT ${guildHeldSql('?1', '?2')} + ${reservedSql('?1', '?2', '?3')} AS n`).bind(g, key, nowS).first();
  if (Number(room?.n ?? 0) + units > GUILD_STORES_MAX) return { error: 'guild-stores-full' };
  return { error: 'writ-budget' };
}

/**
 * SUPPLY: `{ character, region, writ, units, rid }` - `units` of an open guild writ of this board's region, from this
 * character's Stores (bought first), into the writ's guild Stores; paid the units times the pay each, less the tax on
 * the writ's running total (the order's law), out of the escrow. Anyone's, in the guild or not.
 */
export async function supplyGuildWrit(ctx, player, env, { character, region, writ: id, units, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, fill: { writ: row.writ, material: row.material, units: Number(row.units), pay: Number(row.pay), tax: Number(row.tax) },
    writ: await guildWritOf(db, row.writ, me), store: await storeOf(db, me, row.char_id, row.material), balance: await balanceOf(db, me),
  });
  const prior = await db.prepare('SELECT * FROM guild_writ_fills WHERE filler = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!idOk(id)) return { error: 'no-writ' };
  if (!writUnitsOk(units)) return { error: 'bad-units' };
  if (await acting(ctx, player)) return { error: 'writ-rate' };
  const w = await db.prepare('SELECT * FROM guild_writs WHERE id = ?1').bind(id).first();
  if (!w) return { error: 'no-writ' };
  if (w.state !== 'open' || Number(w.expires_at) <= nowS) return { error: 'writ-gone' };
  if (Number(w.region) !== region) return { error: 'writ-elsewhere' };
  if (units > Number(w.left_units)) return { error: 'writ-short' };
  if (!(await deliverMay(db, me, w.guild_id))) return { error: 'writ-own-guild' };
  const total = units * Number(w.pay);
  // SEAT2b: what of the delivery is bought (spent first) - a seat writ's influence counts its own and its bought apart
  const boughtSpent = w.seat != null ? Math.min(units, Math.max(0, Number((await storeOf(db, me, character, w.material)).bought ?? 0))) : 0;
  // the tax of the writ's running total - what it has bought before this delivery (AUDIT 30 L6's law)
  const tax = saleTaxOn((Number(w.units) - Number(w.left_units)) * Number(w.pay), total);
  const pay = total - tax;
  const nonce = mintId(rand);
  const day = utcDay(nowS);
  const who = displayName(player);
  const filled = 'EXISTS (SELECT 1 FROM guild_writ_fills WHERE filler = ?1 AND rid = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION: the writ open with the units and their escrow at the running total the tax was taken on, the
    // deliverer's units, the guild Stores' room, the deliverer's room under the Marks cap, the id unspent
    db.prepare(`INSERT OR IGNORE INTO guild_writ_fills (filler, rid, char_id, writ, guild_id, material, units, pay, tax, at, day, n)
      SELECT ?1, ?2, ?3, w.id, w.guild_id, w.material, ?4, ?5, ?6, ?7, ?8, ?9 FROM guild_writs w
      WHERE w.id = ?10 AND w.state = 'open' AND w.expires_at > ?7 AND w.region = ?11 AND w.left_units >= ?4 AND w.left_units = ?12
        AND w.escrow >= w.pay * ?4 AND w.pay * ?4 = ?5 + ?6
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2 || ':wpay')
        -- AUDIT 31 S6: no character of the account holds a rank that takes this guild's Stores out
        AND NOT EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND guild_id = w.guild_id AND rank IN (${TAKERS_SQL}))
        AND ${spendableSql('?1', '?3', 'w.material')} >= ?4   -- GOLD-MARKET: never gold's units
        AND (w.seat IS NOT NULL OR COALESCE((SELECT SUM(qty) FROM guild_prof_stores WHERE guild_id = w.guild_id AND material = w.material), 0) + ?4 <= ?13)
        AND ${SEAT_WRIT_LIVE_SQL('?15')}   -- AUDIT SEATS-2 S6: a seat writ's seat still its guild's to feed
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + ?5 <= ?14`)
      .bind(me, rid, character, units, pay, tax, nowS, day, nonce, id, region, Number(w.left_units), GUILD_STORES_MAX, MARKS_MAX, seatWeek(nowS)),
    // the writ drawn down, a filled one closed
    db.prepare(`UPDATE guild_writs SET left_units = left_units - ?3, escrow = escrow - pay * ?3,
        state = CASE WHEN left_units = ?3 THEN 'filled' ELSE state END, closed_at = CASE WHEN left_units = ?3 THEN ?4 ELSE closed_at END
      WHERE id = ?2 AND EXISTS (SELECT 1 FROM guild_writ_fills WHERE filler = ?1 AND rid = ?5 AND n = ?6)`).bind(me, id, units, nowS, rid, nonce),
    // the deliverer's units out, bought first; into the guild Stores as the guild's own (7: a writ's units are bought to
    // whoever withdraws them)
    ...spendStatements(db, { player: me, character, materialSql: '?3', qtySql: '?4', guard: filled, binds: [w.material, units, rid, nonce] }),
    ...(w.seat == null ? [db.prepare(`INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at)
      SELECT guild_id, material, '', '', units, ?4, at FROM guild_writ_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (guild_id, material, dep_player, dep_char) DO UPDATE SET qty = guild_prof_stores.qty + excluded.qty,
        moved_by = excluded.moved_by, moved_at = excluded.moved_at`).bind(me, rid, nonce, who)]
      // SEAT2b: a seat writ's units to the seat - the holder's stockpile, or the challenger's Siege Camp this week
      : Number(w.camp) === 1 ? [db.prepare(`INSERT INTO town_seat_camps (week, key, guild_id, material, qty)
          SELECT ?4, ?5, guild_id, material, units FROM guild_writ_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3
          ON CONFLICT (week, key, guild_id, material) DO UPDATE SET qty = town_seat_camps.qty + excluded.qty`).bind(me, rid, nonce, seatWeek(nowS), Number(w.seat))]
      : [db.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) SELECT ?4, material, units FROM guild_writ_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3
          ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).bind(me, rid, nonce, Number(w.seat))]),
    // the Marks: the pay out of the escrow, the tax burnt from it
    db.prepare(`${INSERT_LINE} SELECT 'escrow', writ, 'account', filler, 'writ-pay', pay, day, at, filler, material, rid || ':wpay'
      FROM guild_writ_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3 AND pay > 0`).bind(me, rid, nonce),
    db.prepare(`${INSERT_LINE} SELECT 'escrow', writ, 'burn', NULL, 'market-tax', tax, day, at, filler, material, rid || ':wtax'
      FROM guild_writ_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3 AND tax > 0`).bind(me, rid, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM guild_writ_fills WHERE filler = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) {
    if (w.seat != null) {
      if (Number(w.camp) !== 1) await supplyForts(db, Number(w.seat), nowS);   // SEAT2b: into the seat's projects
      // SEAT2b (4.2): the delivery's influence - its own units at their value, the bought at Tribute's rate (spent first)
      await creditSeatWrit(ctx, player, env, { character, key: Number(w.seat), region: Number(w.region), guild: w.guild_id,
        own: units - boughtSpent, bought: boughtSpent, value: material(w.material)?.value ?? 0, ref: `fill:${me}:${rid}` });
    }
    return answer(made);
  }
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':wpay')) return { error: 'prof-rid' };
  const now = await db.prepare('SELECT * FROM guild_writs WHERE id = ?1').bind(id).first();
  if (!now || now.state !== 'open') return { error: 'writ-gone' };
  if (Number(now.left_units) < units) return { error: 'writ-short' };
  if (Number(now.left_units) !== Number(w.left_units)) return { error: 'writ-moved' };   // another delivered between
  if (!(await deliverMay(db, me, w.guild_id))) return { error: 'writ-own-guild' };   // made an Officer between
  const lost = await seatWritLost(db, w, nowS);   // AUDIT SEATS-2 S6: the seat no longer its guild's to feed
  if (lost) return lost;
  const held = await storeOf(db, me, character, w.material);
  if (held.own + held.bought < units) return { error: held.own + held.bought + (held.gold ?? 0) >= units ? 'stores-gold' : 'stores-short' };   // GOLD-MARKET
  if ((await balanceOf(db, me)) + pay > MARKS_MAX) return { error: 'marks-full' };
  return { error: 'guild-stores-full' };
}

/**
 * AUDIT SEATS-2 S6: A SEAT WRIT FEEDS ONLY A SEAT ITS GUILD STILL HAS A CLAIM ON. The seat was asked at posting alone, so a
 * holder's stockpile writ (`camp` 0) went on filling the seat's stockpile after its guild lost the Charter (a capture, a
 * lapse) - feeding the new holder's works, and its deliveries counting as the old holder's influence there - and a
 * challenger's Siege Camp writ (`camp` 1) filled a camp in a week its guild never pledged the seat. Now a delivery is
 * refused - nothing moved, minted or burnt - where a stockpile writ's guild no longer holds its seat ('seat-not-held') or a
 * camp writ's is not pledged there this seat week ('seat-not-pledged'); the poster withdraws it for its escrow as any.
 * Asked in the batch's decision (SEAT_WRIT_LIVE_SQL - so a seat lost between the read and the write moves nothing), and
 * after a decision that wrote nothing, for the word.
 */
async function seatWritLost(db, w, nowS) {
  if (w.seat == null) return null;
  if (Number(w.camp) === 1) {
    const pledged = await db.prepare('SELECT 1 FROM town_seat_pledges WHERE week = ? AND key = ? AND guild_id = ?').bind(seatWeek(nowS), Number(w.seat), w.guild_id).first();
    return pledged ? null : { error: 'seat-not-pledged' };
  }
  const held = await db.prepare('SELECT 1 FROM town_seat_holds WHERE key = ? AND guild_id = ?').bind(Number(w.seat), w.guild_id).first();
  return held ? null : { error: 'seat-not-held' };
}
/** AUDIT SEATS-2 S6: the same, in a write over `guild_writs w` - `week` the seat week's parameter. */
const SEAT_WRIT_LIVE_SQL = (week) => `(w.seat IS NULL
          OR (w.camp = 0 AND EXISTS (SELECT 1 FROM town_seat_holds WHERE key = w.seat AND guild_id = w.guild_id))
          OR (w.camp = 1 AND EXISTS (SELECT 1 FROM town_seat_pledges WHERE week = ${week} AND key = w.seat AND guild_id = w.guild_id)))`;

/** AUDIT 31 S6: whether this account may deliver to a writ of guild `g` - none of its characters of a rank that takes the
 *  guild Stores out (writLaw writDeliverMay). */
async function deliverMay(db, me, g) {
  const { results = [] } = await db.prepare('SELECT rank FROM guild_members WHERE player = ?1 AND guild_id = ?2').bind(me, g).all();
  return results.every((r) => writDeliverMay(Number(r.rank)));
}

/**
 * WITHDRAW: `{ character, writ, rid }` - an open guild writ closed by its guild's Guildmaster (any of them) or the
 * Officer who posted it; what is left of its escrow back to the treasury (under the cap - else on a later read).
 * Asked again, a writ this account withdrew answers as done.
 */
export async function withdrawGuildWrit(ctx, player, env, { character, writ: id, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  if (!idOk(id)) return { error: 'no-writ' };
  const w = await db.prepare('SELECT * FROM guild_writs WHERE id = ?1').bind(id).first();
  if (!w) return { error: 'no-writ' };
  const answer = async (extra = {}) => ({ ok: true, ...extra, writ: await guildWritOf(db, id, me), guildMarks: await guildBalanceOf(db, w.guild_id) });
  if (w.state === 'withdrawn' && w.closed_by === me) return answer({ repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  if (a.me.guild_id !== w.guild_id) return { error: 'guild-rank' };
  const rank = Number(a.me.rank);
  if (!mayWithdraw(rank, w, me)) return { error: 'guild-rank' };
  if (w.state !== 'open') return { error: 'writ-gone' };
  if (await acting(ctx, player)) return { error: 'writ-rate' };
  const nonce = mintId(rand);
  await db.batch([
    db.prepare(`UPDATE guild_writs SET state = 'withdrawn', closed_at = ?3, closed_by = ?4, cn = ?5 WHERE id = ?1 AND state = 'open'
      AND EXISTS (SELECT 1 FROM guild_members WHERE player = ?4 AND char_id = ?2 AND guild_id = guild_writs.guild_id AND rank = ?6)
      AND (?6 = ${GUILD_RANK_MASTER} OR poster = ?4)`).bind(id, character, nowS, me, nonce, rank),
    ...guildWritReturn(db, id, nowS),
  ]);
  const now = await db.prepare('SELECT state, cn FROM guild_writs WHERE id = ?1').bind(id).first();
  if (now?.cn === nonce) return answer();
  if (now?.state !== 'open') return { error: 'writ-gone' };
  return { error: 'guild-rank' };
}

/** BUDGET: `{ character, marks }` - the Officers' writ budget a seat week, the Guildmaster's to set (0 to the cap). */
export async function setWritBudget(ctx, player, env, { character, marks } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { character, needRid: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  if (!writBudgetOk(marks)) return { error: 'bad-budget' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  if (!writMay(Number(a.me.rank), 'writBudget')) return { error: 'guild-rank' };
  if (await acting(ctx, player)) return { error: 'writ-rate' };
  const r = await db.prepare(`INSERT INTO guild_writ_budgets (guild_id, budget, set_by, set_at)
      SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM guild_members WHERE player = ?5 AND char_id = ?6 AND guild_id = ?1 AND rank = ${GUILD_RANK_MASTER})
    ON CONFLICT (guild_id) DO UPDATE SET budget = excluded.budget, set_by = excluded.set_by, set_at = excluded.set_at`)
    .bind(a.me.guild_id, marks, displayName(player), nowS, player.id, character).run();
  if (!r?.meta?.changes) return { error: 'guild-rank' };
  const member = await db.prepare(`SELECT m.guild_id, m.rank, g.name, g.tag FROM guild_members m JOIN guilds g ON g.id = m.guild_id
    WHERE m.player = ?1 AND m.char_id = ?2`).bind(player.id, character).first();
  return { ok: true, guild: await guildOfMember(db, member, Number(member.rank), nowS) };
}

// ─── COMMISSIONS (11) ────────────────────────────────────────────────

/**
 * COMMISSION: `{ character, region, crafter, recipe, quality, pay, rid }` - a writ naming a crafter (a registered
 * handle, never one's own) and a piece (a listable recipe, and its least quality where it takes one), on the boards of
 * `region` for seven days; the pay escrowed from this account.
 */
export async function postCommission(ctx, player, env, { character, region, crafter: handle, recipe, quality = null, pay, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({ ok: true, ...extra, commission: await commissionOf(db, row.id, me), balance: await balanceOf(db, me) });
  const prior = await db.prepare('SELECT * FROM commissions WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  // AUDIT 31 L2: a listable piece nothing yields the stuff of yet is its own word
  if (!commissionable(recipe)) return { error: pieceListable(recipe) && commissionUnyielded(recipe) ? 'commission-unyielded' : 'commission-recipe' };
  if (!commissionQualityOk(recipe, quality)) return { error: 'bad-quality' };
  if (!commissionPayOk(pay)) return { error: 'bad-pay' };
  const name = typeof handle === 'string' ? handle.trim() : '';
  if (!HANDLE_RE.test(name)) return { error: 'commission-crafter' };
  const c = await db.prepare('SELECT id FROM players WHERE handle_lc = ?1').bind(name.toLowerCase()).first();
  if (!c) return { error: 'commission-crafter' };
  if (c.id === me) return { error: 'commission-self' };
  if (await overRate(ctx, `writ-post:${me}`, WRIT_POSTS_MAX, WRIT_WINDOW_S)) return { error: 'writ-rate' };
  await settleCommissions(ctx, me);
  const nonce = mintId(rand);
  const id = mintId(rand);
  await db.batch([
    // THE DECISION: the Marks, the poster's five, the crafter's twenty, the id unspent
    db.prepare(`INSERT OR IGNORE INTO commissions (id, poster, poster_char, crafter, region, recipe, quality, pay, at, expires_at, rid, n)
      SELECT ?3, ?1, ?2, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?8
        -- AUDIT 31 L1: the five and the twenty that stand - one past its seventh day, not yet settled, is not among them
        AND (SELECT COUNT(*) FROM commissions WHERE poster = ?1 AND state = 'open' AND expires_at > ?9) < ?13
        AND (SELECT COUNT(*) FROM commissions WHERE crafter = ?4 AND state = 'open' AND expires_at > ?9) < ?14
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?11 || ':cesc')`)
      .bind(me, character, id, c.id, region, recipe, quality, pay, nowS, nowS + WRIT_S, rid, nonce, COMMISSIONS_MAX, COMMISSIONS_FOR_MAX),
    db.prepare(`${INSERT_LINE} SELECT 'account', poster, 'escrow', id, 'commission-escrow', pay, ?4, at, poster, recipe, rid || ':cesc'
      FROM commissions WHERE poster = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce, utcDay(nowS)),
  ]);
  const made = await db.prepare('SELECT * FROM commissions WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':cesc')) return { error: 'prof-rid' };
  if ((await balanceOf(db, me)) < pay) return { error: 'marks-short' };
  const mine = await db.prepare(`SELECT COUNT(*) AS n FROM commissions WHERE poster = ?1 AND state = 'open' AND expires_at > ?2`).bind(me, nowS).first();
  if (Number(mine?.n ?? 0) >= COMMISSIONS_MAX) return { error: 'commissions-max' };
  return { error: 'commissions-crafter-max' };
}

/**
 * FULFIL: `{ character, region, commission, provenance, wear, rid }` - the named crafter, at a board of the
 * commission's region, hands over a piece of their own make: theirs, crafted by their account, the recipe asked, at
 * least the quality asked, on no other sale, unworn. Its owner moves to the poster and it reaches them as a delivery at
 * once; the crafter is paid the pay less the tax.
 */
export async function fulfilCommission(ctx, player, env, { character, region, commission: id, provenance, wear, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({ ok: true, ...extra, commission: await commissionOf(db, row.id, me), balance: await balanceOf(db, me) });
  const prior = await db.prepare('SELECT * FROM commissions WHERE crafter = ?1 AND fill_rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!idOk(id)) return { error: 'no-writ' };
  if (!provenanceOk(provenance)) return { error: 'bad-provenance' };
  if (wear !== WEAR_WHOLE) return { error: 'commission-worn' };
  if (await acting(ctx, player)) return { error: 'writ-rate' };
  const c = await db.prepare('SELECT * FROM commissions WHERE id = ?1').bind(id).first();
  if (!c) return { error: 'no-writ' };
  if (c.state !== 'open' || Number(c.expires_at) <= nowS) return { error: 'writ-gone' };
  if (c.crafter !== me) return { error: 'commission-not-yours' };
  if (Number(c.region) !== region) return { error: 'commission-elsewhere' };   // AUDIT 31 L6: a commission's own word
  const p = await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!p) return { error: 'market-no-record' };   // AUDIT 31 H1: no record at all - never "another owner's"
  if (p.owner !== me) return { error: 'market-not-yours' };
  if (!commissionFilledBy({ recipe: c.recipe, quality: c.quality == null ? null : Number(c.quality) }, { recipe: p.recipe, quality: Number(p.quality) })) {
    return { error: 'commission-piece' };
  }
  const tax = saleTax(Number(c.pay));
  const pay = Number(c.pay) - tax;
  const nonce = mintId(rand);
  const day = utcDay(nowS);
  await db.batch([
    // THE DECISION: the commission open and this crafter's, here; the piece theirs, of their make, the recipe and the
    // quality, on no other sale (PROF5's guards); the crafter's room under the cap; the id unspent
    db.prepare(`UPDATE commissions SET state = 'filled', closed_at = ?3, provenance = ?4, filled_char = ?5, tax = ?6, fill_rid = ?7, fn = ?8
      WHERE id = ?1 AND state = 'open' AND expires_at > ?3 AND crafter = ?2 AND region = ?9
        AND EXISTS (SELECT 1 FROM products p WHERE p.provenance = ?4 AND p.owner = ?2 AND p.listed = 0 AND p.recipe = commissions.recipe
          AND (commissions.quality IS NULL OR p.quality >= commissions.quality)
          AND COALESCE(p.bought_with, '') != 'gold')   -- GOLD-MARKET: a piece bought with gold (back again, even) fills no Drakes commission
        AND EXISTS (SELECT 1 FROM prof_crafts WHERE player = ?2 AND (provenance = ?4 OR provenance2 = ?4))
        AND NOT EXISTS (SELECT 1 FROM market_listings WHERE provenance = ?4 AND state = 'open')
        AND NOT EXISTS (SELECT 1 FROM market_auctions WHERE provenance = ?4 AND state = 'open')
        AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = ?4 AND collected = 0)
        AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?4)
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?2 AND rid = ?7 || ':cpay')
        AND COALESCE((SELECT balance FROM marks WHERE account = ?2), 0) + ?10 <= ?11`)
      .bind(id, me, nowS, provenance, character, tax, rid, nonce, region, pay, MARKS_MAX),
    // the piece the poster's, on its way to them at once (a delivery, PROF5's)
    db.prepare(`UPDATE products SET owner = (SELECT poster FROM commissions WHERE id = ?1 AND fn = ?2), listed = 0, bought_with = 'marks'
      WHERE provenance = (SELECT provenance FROM commissions WHERE id = ?1 AND fn = ?2)`).bind(id, nonce),   // GOLD-MARKET: bought with Drakes
    db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
      SELECT id, poster, poster_char, provenance, ?3, 'bought', region, ?4, ?4 FROM commissions WHERE id = ?1 AND fn = ?2`).bind(id, nonce, WEAR_WHOLE, nowS),
    // the Marks: the pay out of the escrow to the crafter, the tax burnt from it
    db.prepare(`${INSERT_LINE} SELECT 'escrow', id, 'account', crafter, 'commission-pay', pay - tax, ?3, ?4, crafter, recipe, fill_rid || ':cpay'
      FROM commissions WHERE id = ?1 AND fn = ?2 AND pay - tax > 0`).bind(id, nonce, day, nowS),
    db.prepare(`${INSERT_LINE} SELECT 'escrow', id, 'burn', NULL, 'market-tax', tax, ?3, ?4, crafter, recipe, fill_rid || ':ctax'
      FROM commissions WHERE id = ?1 AND fn = ?2 AND tax > 0`).bind(id, nonce, day, nowS),
  ]);
  const made = await db.prepare('SELECT * FROM commissions WHERE crafter = ?1 AND fill_rid = ?2').bind(me, rid).first();
  if (made?.fn === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':cpay')) return { error: 'prof-rid' };
  const now = await db.prepare('SELECT state FROM commissions WHERE id = ?1').bind(id).first();
  if (now?.state !== 'open') return { error: 'writ-gone' };
  const q = await db.prepare('SELECT owner, listed, bought_with FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!q) return { error: 'market-no-record' };
  if (q.owner !== me) return { error: 'market-not-yours' };
  if (q.bought_with === 'gold') return { error: 'market-gold-goods' };   // GOLD-MARKET: the wall's own word
  if (!(await db.prepare('SELECT 1 FROM prof_crafts WHERE player = ?1 AND (provenance = ?2 OR provenance2 = ?2)').bind(me, provenance).first())) {
    return { error: 'commission-not-made' };
  }
  // AUDIT 31 S5: why the piece is held, each in its own word (a delivery waiting read "stands in a home")
  if (Number(q.listed) === 1) return { error: 'market-listed' };
  if (await db.prepare('SELECT 1 FROM market_deliveries WHERE provenance = ?1 AND collected = 0').bind(provenance).first()) return { error: 'market-uncollected' };
  if (await db.prepare("SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?1").bind(provenance).first()) return { error: 'market-standing' };
  if ((await balanceOf(db, me)) + pay > MARKS_MAX) return { error: 'marks-full' };
  return { error: 'writ-gone' };
}

/** A commission closed - `withdrawn` by its poster or `declined` by its crafter - while it stands; its pay back to the
 *  poster (under the cap - else on their later read). Asked again, one this account closed answers as done. */
async function closeCommission(ctx, player, env, { commission: id, rid } = {}, how) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { rid, needChar: false });
  if (refused) return refused;
  const me = player.id;
  if (!idOk(id)) return { error: 'no-writ' };
  const c = await db.prepare('SELECT * FROM commissions WHERE id = ?1').bind(id).first();
  const whose = how === 'withdrawn' ? c?.poster : c?.crafter;
  if (!c || whose !== me) return { error: 'no-writ' };
  const answer = async (extra = {}) => ({ ok: true, ...extra, commission: await commissionOf(db, id, me), balance: await balanceOf(db, me) });
  if (c.state === how) return answer({ repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (c.state !== 'open') return { error: 'writ-gone' };
  if (await acting(ctx, player)) return { error: 'writ-rate' };
  const nonce = mintId(rand);
  const col = how === 'withdrawn' ? 'poster' : 'crafter';
  await db.batch([
    db.prepare(`UPDATE commissions SET state = ?3, closed_at = ?4, cn = ?5 WHERE id = ?1 AND state = 'open' AND ${col} = ?2`).bind(id, me, how, nowS, nonce),
    ...commissionReturn(db, id, nowS),
  ]);
  const now = await db.prepare('SELECT state, cn FROM commissions WHERE id = ?1').bind(id).first();
  return now?.cn === nonce ? answer() : { error: 'writ-gone' };
}
/** CANCEL: `{ commission, rid }` - the poster withdraws a standing commission. */
export const cancelCommission = (ctx, player, env, body) => closeCommission(ctx, player, env, body, 'withdrawn');
/** DECLINE: `{ commission, rid }` - the crafter it names declines it (28: a crafter owes no one work). */
export const declineCommission = (ctx, player, env, body) => closeCommission(ctx, player, env, body, 'declined');

// ─── THE GUILD STORES (7) ────────────────────────────────────────────

/** A guild's Stores as its Guild tab reads them: each material's count, the reader's own deposit of it, the last
 *  moves (the ledger's), and whether the reader's rank may withdraw. */
async function guildStoresView(db, guildId, me, character, rank) {
  const { results: rows = [] } = await db.prepare(`SELECT material, SUM(qty) AS qty,
      SUM(CASE WHEN dep_player = ?2 AND dep_char = ?3 THEN qty ELSE 0 END) AS mine
    FROM guild_prof_stores WHERE guild_id = ?1 GROUP BY material HAVING SUM(qty) > 0 ORDER BY material`).bind(guildId, me, character).all();
  const { results: moves = [] } = await db.prepare(`SELECT material, delta, who, at FROM guild_store_ledger WHERE guild_id = ?1 ORDER BY seq DESC LIMIT ?2`)
    .bind(guildId, GUILD_STORE_MOVES_SHOWN).all();
  return {
    rows: rows.map((r) => ({ material: r.material, qty: Number(r.qty), mine: Number(r.mine) })),
    moves: moves.map((m) => ({ material: m.material, delta: Number(m.delta), who: m.who, at: Number(m.at) })),
    mayWithdraw: writMay(rank, 'storesWithdraw'),
  };
}
/** THE GUILD STORES: `{ character }` - this character's guild's Stores, and the Officers' writ budget this week (the
 *  Guild tab's). */
export async function guildStores({ db, nowS }, player, env, { character } = {}) {
  const refused = asks(player, { character, needRid: false });
  if (refused) return refused;
  const closed = storesShut(player, env);
  if (closed) return closed;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  return {
    ok: true, guild: { id: a.me.guild_id }, writBudget: await budgetOf(db, a.me.guild_id, nowS),
    ...(await guildStoresView(db, a.me.guild_id, player.id, character, Number(a.me.rank))),
  };
}

/** What a character holds of its own deposit of a material in its guild's Stores. */
async function ownDeposit(db, g, key, me, character) {
  const r = await db.prepare('SELECT qty FROM guild_prof_stores WHERE guild_id = ?1 AND material = ?2 AND dep_player = ?3 AND dep_char = ?4')
    .bind(g, key, me, character).first();
  return Number(r?.qty ?? 0);
}

/**
 * A MOVE of the guild Stores: `{ character, material, units, rid }`. A deposit is any member's: from the character's
 * Stores, bought first - the bought units the guild's, the own kept under the character. A withdrawal is an Officer's
 * or the Guildmaster's - or any member's, up to their own deposit (AUDIT 31 R1) - into the character's Stores (under its
 * 5,000): the character's own deposit first, back as own; then the guild's, then the other members' deposits, bought.
 */
async function moveGuildStores(ctx, player, env, { character, material: key, units, rid } = {}, kind) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, move: { kind: row.kind, material: row.material, units: Number(row.units), own: Number(row.own) },
    store: await storeOf(db, me, row.char_id, row.material),
    ...(await guildStoresView(db, row.guild_id, me, row.char_id, await rankIn(db, me, row.char_id, row.guild_id))),
  });
  const prior = await db.prepare('SELECT * FROM guild_store_moves WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return prior.kind === kind ? answer(prior, { repeat: true }) : { error: 'prof-rid' };
  const closed = storesShut(player, env);
  if (closed) return closed;
  if (!material(key)) return { error: 'bad-material' };
  if (!guildMoveOk(units)) return { error: 'bad-units' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const rank = Number(a.me.rank);
  const g = a.me.guild_id;
  // AUDIT 31 R1: any member takes back their own deposit; the rest is an Officer's or the Guildmaster's
  if (kind === 'withdraw' && !guildTakeMay(rank, units, await ownDeposit(db, g, key, me, character))) return { error: 'guild-stores-mine' };
  if (await acting(ctx, player)) return { error: 'writ-rate' };
  const who = displayName(player);
  const nonce = mintId(rand);
  const moved = 'EXISTS (SELECT 1 FROM guild_store_moves WHERE player = ?1 AND rid = ?5 AND n = ?6)';
  const statements = kind === 'deposit' ? [
    // THE DECISION: still a member, the units in the Stores, the guild Stores' room - the own share what the bought
    // units cannot cover (bought go first)
    db.prepare(`INSERT OR IGNORE INTO guild_store_moves (player, rid, char_id, guild_id, kind, material, units, own, at, n)
      SELECT ?1, ?2, ?3, ?4, 'deposit', ?5, ?6,
        MAX(0, ?6 - COALESCE((SELECT qty FROM prof_stores WHERE player = ?1 AND char_id = ?3 AND material = ?5 AND origin = 'bought'), 0)), ?7, ?8
      WHERE EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?3 AND guild_id = ?4)
        AND ${spendableSql('?1', '?3', '?5')} >= ?6   -- GOLD-MARKET: never gold's units
        AND COALESCE((SELECT SUM(qty) FROM guild_prof_stores WHERE guild_id = ?4 AND material = ?5), 0) + ?6 <= ?9`)
      .bind(me, rid, character, g, key, units, nowS, nonce, GUILD_STORES_MAX),
    ...spendStatements(db, { player: me, character, materialSql: '?3', qtySql: '?4', guard: moved, binds: [key, units, rid, nonce] }),
    db.prepare(`INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at)
      SELECT guild_id, material, '', '', units - own, ?4, at FROM guild_store_moves WHERE player = ?1 AND rid = ?2 AND n = ?3 AND units - own > 0
      ON CONFLICT (guild_id, material, dep_player, dep_char) DO UPDATE SET qty = guild_prof_stores.qty + excluded.qty,
        moved_by = excluded.moved_by, moved_at = excluded.moved_at`).bind(me, rid, nonce, who),
    db.prepare(`INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at)
      SELECT guild_id, material, player, char_id, own, ?4, at FROM guild_store_moves WHERE player = ?1 AND rid = ?2 AND n = ?3 AND own > 0
      ON CONFLICT (guild_id, material, dep_player, dep_char) DO UPDATE SET qty = guild_prof_stores.qty + excluded.qty,
        moved_by = excluded.moved_by, moved_at = excluded.moved_at`).bind(me, rid, nonce, who),
  ] : [
    // THE DECISION: still of the rank read - one that takes the guild Stores out, or (AUDIT 31 R1) any, for no more than
    // the character's own deposit - the units in the guild Stores, the character's Stores' room; the own share what the
    // character's own deposit holds
    db.prepare(`INSERT OR IGNORE INTO guild_store_moves (player, rid, char_id, guild_id, kind, material, units, own, at, n)
      SELECT ?1, ?2, ?3, ?4, 'withdraw', ?5, ?6,
        MIN(?6, COALESCE((SELECT qty FROM guild_prof_stores WHERE guild_id = ?4 AND material = ?5 AND dep_player = ?1 AND dep_char = ?3), 0)), ?7, ?8
      WHERE EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?3 AND guild_id = ?4 AND rank = ?9)
        AND (?9 IN (${TAKERS_SQL})
          OR COALESCE((SELECT qty FROM guild_prof_stores WHERE guild_id = ?4 AND material = ?5 AND dep_player = ?1 AND dep_char = ?3), 0) >= ?6)
        AND COALESCE((SELECT SUM(qty) FROM guild_prof_stores WHERE guild_id = ?4 AND material = ?5), 0) >= ?6
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?3 AND material = ?5), 0) + ?6 <= ?10`)
      .bind(me, rid, character, g, key, units, nowS, nonce, rank, STORES_MAX),
    // the guild Stores drawn down in one statement, in the law's order: the character's own deposit, the guild's, the
    // other members' (each row's take what the rows before it did not cover)
    db.prepare(`UPDATE guild_prof_stores SET qty = qty - t.take, moved_by = ?7, moved_at = ?8
      FROM (SELECT dep_player AS dp, dep_char AS dc,
              MIN(qty, MAX(0, ?4 - (SUM(qty) OVER (ORDER BY prio, dep_player, dep_char ROWS UNBOUNDED PRECEDING) - qty))) AS take
            FROM (SELECT dep_player, dep_char, qty, CASE WHEN dep_player = ?1 AND dep_char = ?2 THEN 0 WHEN dep_player = '' THEN 1 ELSE 2 END AS prio
                  FROM guild_prof_stores WHERE guild_id = ?3 AND material = ?9)) AS t
      WHERE guild_prof_stores.guild_id = ?3 AND guild_prof_stores.material = ?9 AND guild_prof_stores.dep_player = t.dp
        AND guild_prof_stores.dep_char = t.dc AND t.take > 0
        AND EXISTS (SELECT 1 FROM guild_store_moves WHERE player = ?1 AND rid = ?5 AND n = ?6)`)
      .bind(me, character, g, units, rid, nonce, who, nowS, key),
    db.prepare(`DELETE FROM guild_prof_stores WHERE guild_id = ?1 AND material = ?2 AND qty = 0`).bind(g, key),
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, material, 'own', own FROM guild_store_moves WHERE player = ?1 AND rid = ?2 AND n = ?3 AND own > 0
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, rid, nonce),
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, material, 'bought', units - own FROM guild_store_moves WHERE player = ?1 AND rid = ?2 AND n = ?3 AND units - own > 0
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, rid, nonce),
  ];
  await db.batch(statements);
  const made = await db.prepare('SELECT * FROM guild_store_moves WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return made.kind === kind ? answer(made, { repeat: true }) : { error: 'prof-rid' };
  if ((await rankIn(db, me, character, g)) !== rank) return { error: 'guild-rank' };
  if (kind === 'deposit') {
    const held = await storeOf(db, me, character, key);
    return { error: held.own + held.bought < units ? (held.own + held.bought + (held.gold ?? 0) >= units ? 'stores-gold' : 'stores-short') : 'guild-stores-full' };   // GOLD-MARKET
  }
  if (!guildTakeMay(rank, units, await ownDeposit(db, g, key, me, character))) return { error: 'guild-stores-mine' };   // taken out between
  const t = await db.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM guild_prof_stores WHERE guild_id = ?1 AND material = ?2').bind(g, key).first();
  return { error: Number(t?.n ?? 0) < units ? 'guild-stores-short' : 'stores-full' };
}
/** DEPOSIT to the guild Stores: `{ character, material, units, rid }` - any member's. */
export const depositGuildStores = (ctx, player, env, body) => moveGuildStores(ctx, player, env, body, 'deposit');
/** WITHDRAW from the guild Stores: `{ character, material, units, rid }` - an Officer's or the Guildmaster's; any
 *  member's, of their own deposit. */
export const withdrawGuildStores = (ctx, player, env, body) => moveGuildStores(ctx, player, env, body, 'withdraw');
