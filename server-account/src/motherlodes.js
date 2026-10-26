// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2b (2026-10-03, Mac: "plus we need to build motherloads") - THE
// MOTHERLODES, AS THE SERVICE KEEPS THEM (bible/06-Systems/Professions-Arc.md
// 6 and 38; the law both ends read is src/net/motherlodeLaw.js).
//
// ═══ THE DAY'S THREE, PICKED ONCE ════════════════════════════════════
//
// The first read of a UTC day picks its Motherlodes from the pixels the
// witnesses had confirmed before it began (motherlodeLaw motherlodeSites)
// and keeps them (`motherlodes`, INSERT OR IGNORE - the pick is a pure
// function of ground the day can no longer change, so two first reads keep
// the same three). A realm nobody has walked has none that day; the next
// read asks again.
//
// ═══ A STRIKE ═══════════════════════════════════════════════════════
//
// A Motherlode is struck as a vein is (the Pick-Axe's act, its report
// bounded by tier 6's glints) and asked through the harvest's own route,
// its node `mlode:<day>:<k>` (index.js). It counts only where:
//   - the Motherlode stands at the act's end (risen, not gone),
//   - the relay saw this account on its pixel: a Watch receipt (`k1`,
//     net/watchReceipt.js) naming the account and the pixel, issued in the
//     MOTHERLODE_WATCH_S before the act's end - the relay's word on a pose,
//     which is the client's own claim, so a bound and not a proof (PROF0 6),
//   - the character's Mining is MOTHERLODE_RANK,
// and ONE STATEMENT DECIDES the rest: the Motherlode's twenty, the account's
// one a UTC day (the strike's key), the Stores' room. Its ore goes into the
// Stores as the character's own, its XP to the Mining track, and its silver
// - MOTHERLODE_SILVER, the `motherlode` faucet - to the account, each by the
// strike's own row and nonce. A request asked twice is answered with the
// strike it made.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { mintId, overRate } from './accounts.js';
import { marksOpenFor, balanceOf } from './marks.js';
import { gatePublicKey } from './signing.js';
import { profAsks, profShut, profDice, trackRow, trackView, profTodayOf, storeOf, carriedOf, clampStatements } from './professions.js';   // BAG1: the carried count
import { CARRIED_MAX, heldOk, seenOk } from '../../src/net/bagLaw.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import {
  STORES_MAX, PROF_OPS_MAX, PROF_OPS_WINDOW_S, HARVEST_LATE_S, HARVEST_EARLY_S, PROF_XP_MAX, rankOfXp, harvestXp, glintsMax,
} from '../../src/net/professionLaw.js';
import { WITNESS, witnessedFact, factConfirmed } from '../../src/net/nodeLaw.js';
import { verifyWatchReceipt } from '../../src/net/watchReceipt.js';
import {
  MOTHERLODE_STRIKERS, MOTHERLODE_SILVER, MOTHERLODE_RANK, MOTHERLODE_TIER,
  motherlodeSites, motherlodeOpen, motherlodeYield, parseMotherlodeKey, motherlodeKey, motherlodeWatchOk,
} from '../../src/net/motherlodeLaw.js';

/** A strike's silver line id - the account's one Motherlode a UTC day, under the service's own `:`. */
export const motherlodeRid = (day) => `motherlode:${day}`;
/** Whether a harvest's node names a Motherlode (index.js asks before it hands the harvest on). */
export const isMotherlodeNode = (node) => typeof node === 'string' && node.startsWith('mlode:');

const rowView = (r) => ({
  k: Number(r.k), key: motherlodeKey(Number(r.day), Number(r.k)), x: Number(r.x), y: Number(r.y), climate: Number(r.climate), region: Number(r.region),
  material: r.material, opensAt: Number(r.opens_at), closesAt: Number(r.closes_at),
});

/**
 * THE DAY'S MOTHERLODES - kept, or picked and kept on the day's first read: the pixels confirmed before the day began
 * (their reports before it - three accounts' word, as nodeLaw witnessedFact reads it), in motherlodeSites' one order.
 * Answers `[{ k, key, x, y, climate, region, material, opensAt, closesAt }]`.
 * AUDIT SILVER-WAYS C3: THE DAY PICKED ONCE - its mark (`motherlode_days`) kept with its picks, none or fewer than three
 * among them: the pick reads every confirmed pixel's reports, and a day that picked none kept nothing, so every read
 * and every strike of it read them all again (ground confirmed before the day began never changes, so the first pick
 * is the day's). The picks are written only under the mark THIS read made, so two first reads racing the day's turn
 * never keep a mix of two picks.
 * AUDIT SCALE II A-5 (2026-10-11; Mac: "Lets do an audit on everything. Ensure perfection"): THE PICK IS THE PRIMARY'S.
 * SCALE4g put the motherlodes' read on a session started from the tab's bookmark, which a replica as old as that
 * bookmark may serve - and the day keeps whatever its first read picked. A pixel confirmed in the old day's last moment,
 * read off a replica that had not heard it yet, was never picked, all day. So a day found kept is read where the request
 * reads (a replica holding the mark holds the picks written beside it), and a day found unpicked - on whatever the
 * session answered - is read again, picked and kept on `primary` (the binding, index.js ctx), the mark asked there
 * first. A caller with no `primary` (the cron's, on the binding) is its own.
 * @param {{ db: any, primary?: any, rand?: () => number }} ctx
 */
export async function motherlodesOf({ db: read, primary = read, rand }, day) {
  const keptOf = async (/** @type {any} */ db) => ((await db.prepare('SELECT * FROM motherlodes WHERE day = ?1 ORDER BY k').bind(day).all())?.results ?? []).map(rowView);
  const marked = async (/** @type {any} */ db) => !!(await db.prepare('SELECT 1 FROM motherlode_days WHERE day = ?1').bind(day).first());
  if (await marked(read)) return keptOf(read);
  const db = primary;
  if (db !== read && await marked(db)) return keptOf(db);
  const before = day * 86400;
  const { results = [] } = await db.prepare(`SELECT key, account, report, at FROM world_witness
    WHERE kind = 'pixel' AND at < ?1 AND key IN (SELECT key FROM world_witness WHERE kind = 'pixel' AND at < ?1
      GROUP BY key, report HAVING COUNT(DISTINCT account) >= ?2)`).bind(before, WITNESS.confirm).all();
  const rowsBy = new Map();
  for (const r of results) { const a = rowsBy.get(r.key) ?? []; a.push({ account: r.account, report: r.report, at: Number(r.at) }); rowsBy.set(r.key, a); }
  const candidates = [];
  for (const [key, rows] of rowsBy) {
    const f = witnessedFact(rows);
    if (!factConfirmed(f)) continue;
    const [x, y] = String(key).split(',').map(Number);
    candidates.push({ x, y, climate: /** @type {number} */ (f.climate), region: /** @type {number} */ (f.region) });
  }
  const sites = motherlodeSites(day, candidates);
  const n = mintId(rand);
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO motherlode_days (day, picked, n) VALUES (?1, ?2, ?3)').bind(day, sites.length, n),
    ...sites.map((s) => db.prepare(`INSERT OR IGNORE INTO motherlodes (day, k, x, y, climate, region, material, opens_at, closes_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE EXISTS (SELECT 1 FROM motherlode_days WHERE day = ?1 AND n = ?10)`)
      .bind(day, s.k, s.x, s.y, s.climate, s.region, s.material, s.opensAt, s.closesAt, n)),
  ]);
  return keptOf(db);
}

/**
 * THE MOTHERLODES' READ (`/v1/prof/motherlodes`): today's three, each with how many have struck it, and the one this
 * account found today (null for none) - the client stands them, warns of them and marks them. The professions' switch,
 * a registered account's.
 */
export async function motherlodesRead(ctx, player, env, { character } = {}) {
  const { db, nowS } = ctx;
  const refused = profAsks(player, { character, needRid: false }) ?? profShut(player, env);
  if (refused) return refused;
  const day = utcDay(nowS);
  const lodes = await motherlodesOf(ctx, day);
  const { results: counts = [] } = await db.prepare('SELECT k, COUNT(*) AS n FROM motherlode_strikes WHERE day = ?1 GROUP BY k').bind(day).all();
  const struck = new Map(counts.map((c) => [Number(c.k), Number(c.n)]));
  const found = await db.prepare('SELECT k FROM motherlode_strikes WHERE day = ?1 AND player = ?2').bind(day, player.id).first();
  return {
    day, now: nowS, strikers: MOTHERLODE_STRIKERS, rank: MOTHERLODE_RANK, silver: MOTHERLODE_SILVER,
    lodes: lodes.map((l) => ({ ...l, struck: struck.get(l.k) ?? 0 })),
    found: found ? motherlodeKey(day, Number(found.k)) : null,
  };
}

/** A strike's silver as its answer says it: the line it struck, or `why: 'full'` where the purse could not take it - and
 *  AUDIT SILVER-WAYS C2: nothing where it struck none for want of the switch (a strike made while silver was shut,
 *  answered again once it is open, said the purse was full). */
async function strikeMarks(db, player, env, row, line) {
  if (!marksOpenFor(player, env)) return {};
  const balance = await balanceOf(db, row.player);
  if (line) return { marks: { struck: Number(line.amount), balance } };
  return balance + MOTHERLODE_SILVER > MARKS_MAX ? { marks: { struck: 0, balance, why: 'full' } } : {};
}
/** A strike's answer - a harvest's shape (scenes/gatherHost.js says it as one), its silver and the Motherlode's count
 *  beside it. */
async function strikeAnswer({ db }, player, env, row, nowS, extra = {}, rankBefore = null) {
  const t = trackView(await trackRow(db, row.player, row.char_id, 'mining'), 'mining', nowS);
  const day = Number(row.day);
  const line = marksOpenFor(player, env) ? await db.prepare('SELECT amount FROM marks_ledger WHERE actor = ?1 AND rid = ?2').bind(row.player, motherlodeRid(day)).first() : null;
  const n = await db.prepare('SELECT COUNT(*) AS n FROM motherlode_strikes WHERE day = ?1 AND k = ?2').bind(day, Number(row.k)).first();
  return {
    ok: true, ...extra, ...(rankBefore === null ? {} : { rose: t.rank > rankBefore }), motherlode: true,
    node: motherlodeKey(day, Number(row.k)), kind: 'ore', material: row.material, qty: Number(row.qty), xp: Number(row.xp),
    track: t, today: (await profTodayOf(db, row.player, row.char_id, day)).mining ?? 0,
    store: await storeOf(db, row.player, row.char_id, row.material),
    ...(Number(row.carry) === 1 ? { carry: true, carried: await carriedOf(db, row.player, row.char_id, row.material) } : {}),   // BAG1: into the bag or the pack
    ...(await strikeMarks(db, player, env, row, line)),
    lode: { struck: Number(n?.n ?? 0), strikers: MOTHERLODE_STRIKERS },
  };
}

/**
 * A MOTHERLODE STRUCK: the harvest's body - `{ character, node: 'mlode:<day>:<k>', kind: 'ore', act: { glints, clean },
 * at, rid }` - and `watch`, the relay's Watch receipt for the Motherlode's pixel. Answers a harvest's shape (and
 * `marks`, `lode`), or a refusal: `bad-node`, `prof-day`, `prof-late`, `motherlode-closed` (not standing at the act's
 * end), `motherlode-watch` (the relay never vouched this account on its pixel in the ten minutes before), `prof-rank`,
 * `motherlode-found` (the account's one today), `motherlode-full` (its twenty), `stores-full`.
 */
export async function strikeMotherlode(ctx, player, env, body = {}) {
  const { db, nowS, rand, subtle } = ctx;
  const { character, node, kind, act, at, rid, watch } = body ?? {};
  const refused = profAsks(player, { character, rid });
  // BAG1: a carrying client's ore lands in its bag or pack - the carried count, cut first to what it holds - as a vein's
  const carry = body?.carry === true;
  const heldNow = carry && heldOk(body?.held) ? body.held : null;
  const T = carry ? 'prof_carried' : 'prof_stores';
  if (refused) return refused;
  const prior = await db.prepare('SELECT * FROM motherlode_strikes WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return strikeAnswer(ctx, player, env, prior, nowS, { repeat: true });   // before the switch: a strike made is a strike answered
  const closed = profShut(player, env);
  if (closed) return closed;
  const m = parseMotherlodeKey(node);
  if (!m || kind !== 'ore') return { error: 'bad-node' };
  const day = utcDay(nowS);
  if (m.day !== day) return { error: 'prof-day' };
  if (!Number.isSafeInteger(at) || at < nowS - HARVEST_LATE_S || at > nowS + HARVEST_EARLY_S || utcDay(at) !== day) return { error: 'prof-late' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const lode = (await motherlodesOf(ctx, day)).find((l) => l.k === m.k);
  if (!lode) return { error: 'bad-node' };
  // AUDIT GATHER F2 (Professions-Arc section 55): risen on the SERVICE's clock too - `at` is the client's claim and may run
  // HARVEST_EARLY_S ahead, so a strike sent early took a slot (and the ore and the silver) before any honest client saw it
  if (!motherlodeOpen(lode, at) || nowS < lode.opensAt) return { error: 'motherlode-closed' };
  // THE WATCH: the relay's word that this account's pose stood on the Motherlode's pixel, in the ten minutes before
  const key = await gatePublicKey(env, subtle);
  if (!key) return { error: 'no-gate-key' };
  const v = await verifyWatchReceipt(watch, key, { subtle, nowS });
  const c = v.ok ? v.claims : null;
  if (!c || c.s !== player.id || c.x !== lode.x || c.y !== lode.y || !motherlodeWatchOk(c.i, at)) return { error: 'motherlode-watch' };   // AUDIT SILVER-WAYS C1: both ways
  // THE TRACK: an Apprentice's Mining (motherlodeLaw MOTHERLODE_RANK)
  const track = await trackRow(db, player.id, character, 'mining');
  const rank = rankOfXp(Number(track?.xp ?? 0));
  if (rank < MOTHERLODE_RANK) return { error: 'prof-rank' };
  // THE ACT, bounded as a vein's: the glints at most tier 6's, a clean finish only with every strike on the glint
  const most = glintsMax(MOTHERLODE_TIER);
  const glints = Number.isSafeInteger(act?.glints) ? Math.max(0, Math.min(most, act.glints)) : 0;
  const clean = act?.clean === true && glints === most;
  const qty = motherlodeYield(Math.floor(profDice(rand) * 3), clean);
  const xp = harvestXp(MOTHERLODE_TIER, rank, clean);
  const nonce = mintId(rand);
  const mine = 'player = ?1 AND rid = ?2 AND n = ?3';
  const stored = `COALESCE((SELECT SUM(qty) FROM ${T} WHERE player = ?1 AND char_id = ?4 AND material = l.material), 0)`;
  const silver = marksOpenFor(player, env);
  await db.batch([
    // BAG1; AUDIT BAG1 B2/B3: only the lode's own material, while the client's view is current, before a twin of a landed strike
    ...(heldNow != null && body?.heldKey === lode.material ? clampStatements(db, { player: player.id, character, material: lode.material, held: heldNow, rid,
      seen: seenOk(body?.seen) ? body.seen : null, twin: 'NOT EXISTS (SELECT 1 FROM motherlode_strikes WHERE player = ?1 AND rid = ?5)' }) : []),
    // THE DECISION: the Motherlode standing at the act's end, its twenty, the account's one today (the key), the Stores'
    // room - the ore cut to it - and the XP to what the track can take
    db.prepare(`INSERT OR IGNORE INTO motherlode_strikes (day, k, player, char_id, material, qty, xp, watch, at, rid, n, carry)
      SELECT ?5, ?6, ?1, ?4, l.material, MIN(?7, ?8 - ${stored}),
        MAX(0, MIN(?9, ?10 - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?4 AND profession = 'mining'), 0))), ?11, ?12, ?2, ?3, ?14
      FROM motherlodes l
      WHERE l.day = ?5 AND l.k = ?6 AND ?12 >= l.opens_at AND ?15 >= l.opens_at AND ?12 < l.closes_at
        AND (SELECT COUNT(*) FROM motherlode_strikes WHERE day = ?5 AND k = ?6) < ?13
        AND ?8 - ${stored} >= 1`)
      .bind(player.id, rid, nonce, character, day, m.k, qty, carry ? CARRIED_MAX : STORES_MAX, xp, PROF_XP_MAX, `${c.s}:${c.c}:${c.i}`, at, MOTHERLODE_STRIKERS, carry ? 1 : 0, nowS),   // AUDIT GATHER F2: ?15 the service's clock
    db.prepare(`INSERT INTO ${T} (player, char_id, material, origin, qty)
      SELECT player, char_id, material, 'own', qty FROM motherlode_strikes WHERE ${mine}
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = ${T}.qty + excluded.qty`).bind(player.id, rid, nonce),
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT player, char_id, 'mining', MIN(?4, xp), ?5 FROM motherlode_strikes WHERE ${mine}
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MIN(?4, prof_tracks.xp + excluded.xp), updated_at = excluded.updated_at`)
      .bind(player.id, rid, nonce, PROF_XP_MAX, nowS),
    // THE SILVER: the `motherlode` faucet - once an account a UTC day (its line's id the day's), never past MARKS_MAX
    ...(silver ? [db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'account', ?1, 'motherlode', ?4, ?5, ?6, ?1, NULL, ?7
      WHERE EXISTS (SELECT 1 FROM motherlode_strikes WHERE ${mine})
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + ?4 <= ?8
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?7)`)
      .bind(player.id, rid, nonce, MOTHERLODE_SILVER, day, nowS, motherlodeRid(day), MARKS_MAX)] : []),
  ]);
  const made = await db.prepare('SELECT * FROM motherlode_strikes WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return strikeAnswer(ctx, player, env, made, nowS, {}, rank);
  if (made) return strikeAnswer(ctx, player, env, made, nowS, { repeat: true });   // the same request, racing itself
  if (await db.prepare('SELECT 1 FROM motherlode_strikes WHERE day = ?1 AND player = ?2').bind(day, player.id).first()) return { error: 'motherlode-found' };
  const n = await db.prepare('SELECT COUNT(*) AS n FROM motherlode_strikes WHERE day = ?1 AND k = ?2').bind(day, m.k).first();
  if (Number(n?.n ?? 0) >= MOTHERLODE_STRIKERS) return { error: 'motherlode-full' };
  return { error: carry ? 'carried-full' : 'stores-full', material: lode.material };   // BAG1
}
