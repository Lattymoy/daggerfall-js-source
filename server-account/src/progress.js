// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT16-INT17 (2026-10-17, the INTEGRITY arc's lane 4 - bible/06-Systems/Integrity-Arc.md section 7; the owner: "Take
// care of the integrity arc"): PROGRESSION CLAIMS - THE SEAT THEY ARE ASKED OF, AND THE PLAY THAT PAYS FOR THEM.
//
// The world runs on the player's machine, so a kill's Renown, a find's silver, a camp cleared, a node harvested and the
// XP a craft earns are each the client's word (a raid's cleanse and a watch's tick are the relay's). Lanes 1-3 bounded
// what a modified client carries to another player; these claims it carries to its own account - a rank, the level
// beside its name, the Marks the Bank buys, the influence a guild's war for a seat is won by.
//
// INT16 - THE SEAT, from day one. Every claim is asked of the account's SEATED realm character - the one holding its
// lease (one an account: realm.js joinRealm), alive - and refused while that character's trade is HELD (verdict.js
// holdOf: the judge found its record forged, or staff held it). A claim that names a character names that one. An
// honest client claims online alone, and online is the realm's (REALM-DOOR), so it always names its seat; what this
// refuses is a request naming an offline id (`char-anything` - each a fresh set of nodes a day), a seat another device
// took, and a character the judge holds.
//
// INT17 - THE PLAY THAT PAYS, MEASURED FIRST (the owner, asked: "Measure first" - as the wealth budget and the boss
// fights' count were). Each stream is a bucket, the wealth budget's own law (budget.js stepBudget): it fills at its
// line's rate for every second the account played (players.played_s - the service's own count, accounts.js creditPlay:
// "The client sends no number"), up to its cap, and each claim spends it. While the line only measures, the bucket
// keeps no debt and what a claim took past it is recorded (progress_hours' `over`): nothing is refused, and the clock
// caps each route has stand as they stood. Staff read the measure (/v1/mod/realm-progress, tools/realmReview.mjs
// progress), set the line, and turn `enforce` on: from then a stream whose bucket is empty is refused ('progress-play')
// until play refills it, and a Renown report is credited only what its bucket holds. The clock caps stay, as the outer
// bound. The numbers below are the first line - the clock caps read per hour of play, and a guess where a route had
// none - which the measure exists to replace.
// ═══════════════════════════════════════════════════════════════════

import { DB_ROOT } from './service.js';   // the binding a request's counted Proxy wraps - what the config is kept by (budget.js's way)
import { stepBudget } from './budget.js';   // one bucket law, the wealth budget's
import { RAID_CLAIMS_DAY_MAX } from './raids.js';
import { RENOWN_XP_HOUR_MAX } from '../../src/net/renown.js';
import { WATCH_DAY_CAP, BOUNTY_CAMPS_DAY } from '../../src/net/townSeatLaw.js';
import { WATCH_TICK_MS } from '../../src/net/watchReceipt.js';
import { TIDE_EFFECTS } from '../../src/net/tideLaw.js';
import { MARKS_FAUCETS } from '../../src/net/marksLaw.js';
import { writXp } from '../../src/net/professionLaw.js';

/** A raid's game day is two real hours (systems/raidingParties.js GAME_DAY_REAL_HOURS - the test holds the two equal). */
const RAID_GAME_DAY_HOURS = 2;

/**
 * THE FIRST LINE, a stream at a time: `rate` what an hour of play may claim, `cap` the most the bucket holds. Units are
 * each stream's own - XP for Renown and the professions, claims or ticks for the rest. OPEN, every one: the measure sets them.
 */
export const PROGRESS_LINE = Object.freeze({
  enforce: false,
  streams: Object.freeze({
    renown: Object.freeze({ rate: RENOWN_XP_HOUR_MAX, cap: RENOWN_XP_HOUR_MAX }),   // Renown's clock hour, read per hour of play
    raid: Object.freeze({ rate: RAID_CLAIMS_DAY_MAX / RAID_GAME_DAY_HOURS, cap: RAID_CLAIMS_DAY_MAX }),   // a game day's six cleanses
    bounty: Object.freeze({ rate: BOUNTY_CAMPS_DAY, cap: BOUNTY_CAMPS_DAY }),   // a seat's Bounty camps
    camp: Object.freeze({ rate: TIDE_EFFECTS.orcsCampsDay, cap: TIDE_EFFECTS.orcsCampsDay }),   // an Orc Raid's camps
    watch: Object.freeze({ rate: 3_600_000 / WATCH_TICK_MS, cap: WATCH_DAY_CAP }),   // a tick for each two minutes stood
    find: Object.freeze({ rate: MARKS_FAUCETS.find.perDay, cap: MARKS_FAUCETS.find.perDay }),   // silver finds
    gather: Object.freeze({ rate: MARKS_FAUCETS.gather.perDay, cap: MARKS_FAUCETS.gather.perDay }),   // a harvest's silver
    prof: Object.freeze({ rate: 10_000, cap: 20_000 }),   // profession XP - no route bounded it by the hour; a guess
  }),
});
/** The streams, in the line's order. */
export const PROGRESS_STREAMS = Object.freeze(Object.keys(PROGRESS_LINE.streams));

/**
 * THE ROUTES WHOSE CLAIMS THESE ARE: path -> [the stream an empty bucket refuses, whether the body names a character].
 * A Marks find names none - the account's seat is asked. Every profession act that earns XP is the `prof` stream's.
 */
export const PROGRESS_ROUTES = Object.freeze({
  '/v1/renown/xp': Object.freeze(['renown', true]),
  '/v1/raid/claim': Object.freeze(['raid', true]),
  '/v1/seats/bounty': Object.freeze(['bounty', true]),
  '/v1/seats/orc-camp': Object.freeze(['camp', true]),
  '/v1/seats/watch': Object.freeze(['watch', true]),
  // AUDIT TOWN-ECON 2 SVC-2: the town Watch's footsteps too - asked of the account's seat (the body names none), as every
  // claim of the Watch is; it earns its player nothing, so it spends no bucket (progressSpentOf), and an enforced line
  // whose Watch bucket is empty refuses it as it refuses the seats'
  '/v1/towns/watch': Object.freeze(['watch', false]),
  '/v1/marks/find': Object.freeze(['find', false]),
  '/v1/prof/harvest': Object.freeze(['prof', true]),
  '/v1/prof/smelt': Object.freeze(['prof', true]),
  '/v1/prof/craft': Object.freeze(['prof', true]),
  '/v1/prof/brew': Object.freeze(['prof', true]),
  '/v1/prof/disenchant': Object.freeze(['prof', true]),
  '/v1/prof/temper': Object.freeze(['prof', true]),
  '/v1/writs/deliver': Object.freeze(['prof', true]),
});

/** A line's shape - whole, unsigned numbers. */
const validLine = (/** @type {any} */ l) => !!l && typeof l === 'object' && Number.isSafeInteger(l.rate) && l.rate >= 0 && Number.isSafeInteger(l.cap) && l.cap >= 0;
/** A config staff may write, or null: `enforce` a boolean, `streams` every stream's line and nothing else. */
export function progressConfigOf(/** @type {unknown} */ v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const c = /** @type {any} */ (v);
  if (typeof c.enforce !== 'boolean' || !c.streams || typeof c.streams !== 'object' || Array.isArray(c.streams)) return null;
  const keys = Object.keys(c.streams);
  if (keys.length !== PROGRESS_STREAMS.length || !PROGRESS_STREAMS.every((k) => validLine(c.streams[k]))) return null;
  return { enforce: c.enforce, streams: Object.fromEntries(PROGRESS_STREAMS.map((k) => [k, { rate: c.streams[k].rate, cap: c.streams[k].cap }])) };
}
/** How long an isolate keeps the config it read - a change staff make is read at once where they made it, within a minute everywhere. */
export const PROGRESS_CONFIG_KEEP_MS = 60_000;
/** @type {WeakMap<object, { at: number, config: any }>} */
const kept = new WeakMap();
const keyOf = (/** @type {any} */ db) => (db && typeof db === 'object' ? db[DB_ROOT] ?? db : null);
/** The config standing: staff's, else the first line. */
export async function progressConfig(/** @type {any} */ db) {
  const key = keyOf(db);
  const k = key ? kept.get(key) : null;
  if (k && Date.now() - k.at < PROGRESS_CONFIG_KEEP_MS) return k.config;
  const row = await db.prepare("SELECT value FROM realm_config WHERE key = 'progress'").first();
  let c = null;
  try { c = progressConfigOf(JSON.parse(row?.value ?? 'null')); } catch { c = null; }
  const config = c ?? PROGRESS_LINE;
  if (key) kept.set(key, { at: Date.now(), config });
  return config;
}
/** A staff change made here: the next read asks the database. */
export const forgetProgressConfig = (/** @type {any} */ db) => { const key = keyOf(db); if (key) kept.delete(key); };

/**
 * INT16: THE SEAT A CLAIM IS ASKED OF - the account's realm character holding its lease, alive. Answers null when it may
 * claim, or `{ error }`: 'progress-seat' (no seat, or the body names another character), 'trade-held' with `held` (the
 * judge or staff hold its trade - a hold a checkpoint has not lifted stands). `named` whether the route's body names a
 * character (`character`); a route that names none asks the seat alone.
 * @param {any} db @param {string} playerId @param {{ named: boolean, character?: unknown }} claim
 */
export async function progressRefusal(db, playerId, claim) {
  return seatRefusalOf(await seatRead(db, playerId).first(), claim);
}
/** PRIMARY-FOLD: the seat's question, and its row's answer - progressRefusal's, whichever way the row was read (the door
 *  asks it beside its other questions, door.js doorReads). */
const seatRead = (/** @type {any} */ db, /** @type {string} */ playerId) =>
  db.prepare(`SELECT id, held FROM realm_characters WHERE ${SEAT_WHERE}`).bind(playerId);
/** AUDIT PLAN-1000 C2: THE SEAT'S ONE WHERE (?1 the account) - the account's realm character holding its lease, alive:
 *  progressRefusal's and the door's (door.js DOOR_SQL), never two literals. */
export const SEAT_WHERE = 'player = ?1 AND lease IS NOT NULL AND dead_at IS NULL';
export function seatRefusalOf(/** @type {any} */ row, /** @type {{ named: boolean, character?: unknown }} */ { named, character }) {
  if (!row || (named && character !== row.id)) return { error: 'progress-seat' };
  if (row.held) return { error: 'trade-held', held: row.held };
  return null;
}

/** A stream's bucket and the account's play, as one read: `{ now, allowance, playedAt }`, or null for no account row. */
async function bucketOf(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ stream) {
  return bucketFrom(await bucketRead(db, playerId, stream).first());
}
/** PRIMARY-FOLD: the bucket's question, and its row read as bucketOf answers (the door asks it for the enforced room of
 *  the route's own stream, door.js doorReads; the spend steps the bucket where it stands - spendProgress, AUDIT PLAN-1000
 *  C1). */
const bucketRead = (/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ stream) =>
  db.prepare('SELECT p.played_s AS now, b.allowance, b.played_at FROM players p LEFT JOIN progress_play b ON b.player = p.id AND b.stream = ?2 WHERE p.id = ?1')
    .bind(playerId, stream);
export function bucketFrom(/** @type {any} */ row) {
  if (!row) return null;
  return { now: Number(row.now) || 0, allowance: row.allowance == null ? null : Number(row.allowance), playedAt: row.played_at == null ? null : Number(row.played_at) };
}
/** The play since the bucket last moved - none for a bucket never filled (its first claim starts it full). */
const playedSince = (/** @type {{ now: number, playedAt: number | null }} */ b) => (b.playedAt == null ? 0 : Math.max(0, b.now - b.playedAt));

/** What a stream's bucket holds now - what an enforced line lets the next claim take. */
export async function progressRoom(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ stream, /** @type {any} */ config, /** @type {any} */ bucket = undefined) {
  const b = bucket !== undefined ? bucket : await bucketOf(db, playerId, stream);   // PRIMARY-FOLD: the door's read, when it asked it
  if (!b) return 0;
  return stepBudget({ allowance: b.allowance, played: playedSince(b), gain: 0, band: config.streams[stream] }).allowance;
}

/**
 * A CLAIM'S SPEND: the bucket filled by the play since it last moved and spent by `amount`, and the hour's measure - the
 * amount, the play it came in, and what it took past the bucket (`over`) - in one batch. Answers `{ allowance }` (the
 * bucket after), or null for nothing spent (no stream, nothing claimed, or no account row).
 *
 * AUDIT PLAN-1000 C1: THE STEP IS THE DATABASE'S, OVER THE ROW AS IT STANDS. The spend read the bucket, stepped it here
 * (budget.js stepBudget) and wrote the step back whole - so two claims of one stream on one account that overlapped
 * read the same bucket and the later write erased the earlier one's debit (measured over the real Worker: 1 offset in 5
 * lost one; and PRIMARY-FOLD, which handed the spend the door's read of the bucket, widened it to 3 in 5). The same
 * law is written in SQL below - the start the cap where none, the fill the play since it last moved at its rate an hour,
 * a full bucket never refilled past its cap, the claim taken, a measured bucket kept at none - and each statement of the
 * batch steps the bucket as it stands when it runs: a batch is one transaction, so no claim writes between them, and
 * none is lost. No read is asked at all. Pinned against stepBudget itself (test/server/primaryfold.test.js).
 * @param {any} db @param {string} playerId @param {string} stream @param {number} amount @param {number} nowS @param {any} config
 */
export async function spendProgress(db, playerId, stream, amount, nowS, config) {
  const line = config.streams[stream];
  if (!line || !Number.isFinite(amount) || amount <= 0) return null;
  const hour = nowS - (nowS % 3600);
  // ?1 the account, ?2 the stream, ?3 the claim's clock, ?4 the cap, ?5 the rate an hour, ?6 the claim, ?7 enforce, ?8 the hour
  const args = [playerId, stream, nowS, line.cap, line.rate, Math.trunc(amount), config.enforce ? 1 : 0, hour];
  const [, play] = await db.batch([
    db.prepare(`INSERT INTO progress_hours (player, stream, hour, amount, played_s, over, claims)
      SELECT ?1, ?2, ?8, ?6, s.played, CASE WHEN s.left < 0 THEN -s.left ELSE 0 END, 1 FROM (${BUCKET_STEP_SQL}) s WHERE true
      ON CONFLICT (player, stream, hour) DO UPDATE SET amount = amount + excluded.amount, played_s = played_s + excluded.played_s,
        over = over + excluded.over, claims = claims + 1`).bind(...args),
    db.prepare(`INSERT INTO progress_play (player, stream, allowance, played_at, at)
      SELECT ?1, ?2, CASE WHEN ?7 THEN s.left ELSE MAX(0, s.left) END, s.now, ?3 FROM (${BUCKET_STEP_SQL}) s WHERE true
      ON CONFLICT (player, stream) DO UPDATE SET allowance = excluded.allowance, played_at = excluded.played_at, at = excluded.at
      RETURNING allowance`).bind(...args.slice(0, 7)),   // its parameters end at ?7 (the hour is the measure's alone)
  ]);
  const row = play?.results?.[0];
  return row ? { allowance: Number(row.allowance) } : null;
}
/** AUDIT PLAN-1000 C1: THE BUCKET'S STEP, budget.js stepBudget in SQL over the row as it stands (the parameters spendProgress
 *  names): the account's play (`now`), the play since the bucket last moved (`played` - none for a bucket never filled),
 *  and what it holds after the claim (`left`) - the start the cap where none, filled at the rate an hour (whole units,
 *  down), never past the cap and never refilled once at it, the claim taken. No row for an account with none. */
const BUCKET_STEP_SQL = `SELECT t.now, t.played, (CASE WHEN t.start >= ?4 THEN t.start ELSE MIN(?4, t.start + CAST((?5 * t.played) / 3600.0 AS INTEGER)) END) - MAX(0, ?6) AS left
  FROM (SELECT COALESCE(p.played_s, 0) AS now, CASE WHEN b.played_at IS NULL THEN 0 ELSE MAX(0, COALESCE(p.played_s, 0) - b.played_at) END AS played, COALESCE(b.allowance, ?4) AS start
    FROM players p LEFT JOIN progress_play b ON b.player = p.id AND b.stream = ?2 WHERE p.id = ?1) t`;

/**
 * WHAT A ROUTE'S ANSWER SPENT, stream by stream: `[[stream, amount]...]` - nothing for a refusal or a repeat (an answer
 * sent again spends nothing twice). Renown is what was credited, never what was asked; a raid's cleanse and a writ's
 * delivery pay Renown too.
 * @param {string} path @param {any} a
 * @returns {Array<[string, number]>}
 */
export function progressSpentOf(path, a) {
  if (!a || typeof a !== 'object' || a.error || a.repeat) return [];
  const n = (/** @type {unknown} */ v) => (Number.isFinite(v) && /** @type {number} */ (v) > 0 ? Math.trunc(/** @type {number} */ (v)) : 0);
  /** @type {Array<[string, number]>} */
  const out = [];
  const add = (/** @type {string} */ stream, /** @type {number} */ amount) => { if (amount > 0) out.push([stream, amount]); };
  switch (path) {
    case '/v1/renown/xp': add('renown', n(a.credited)); break;
    case '/v1/raid/claim': if (a.recorded === true) { add('raid', 1); add('renown', n(a.renown?.credited)); } break;
    case '/v1/star/claim': if (a.recorded === true) add('renown', n(a.renown?.credited)); break;   // STAR7: the Renown a star paid (its count is bounded by the day - stars.js STAR_CLAIMS_DAY_MAX)
    case '/v1/seats/bounty': if (n(a.paid)) add('bounty', 1); break;
    case '/v1/seats/orc-camp': if (a.counted === true) add('camp', 1); break;
    case '/v1/seats/watch': add('watch', n(a.counted)); break;
    case '/v1/towns/watch': break;   // AUDIT TOWN-ECON 2 SVC-2: a town's share, never its player's progress
    case '/v1/marks/find': if (n(a.struck)) add('find', 1); break;
    case '/v1/writs/deliver': if (a.ok) { add('prof', writXp(n(a.pay))); add('renown', n(a.renown?.credited)); } break;
    default:
      if (path in PROGRESS_ROUTES) {
        add('prof', n(a.xp));
        if (path === '/v1/prof/harvest' && n(a.marks?.struck)) add('gather', 1);
      }
  }
  return out;
}

/** A route's answer, spent: every stream it took from (progressSpentOf), each its own bucket - stepped where it stands
 *  (AUDIT PLAN-1000 C1: spendProgress asks no read, so no claim overlapping it loses a debit). */
export async function progressSpent(/** @type {any} */ ctx, /** @type {string} */ playerId, /** @type {string} */ path, /** @type {any} */ answer) {
  const spent = progressSpentOf(path, answer);
  if (!spent.length) return;
  const config = await progressConfig(ctx.db);
  for (const [stream, amount] of spent) await spendProgress(ctx.db, playerId, stream, amount, ctx.nowS, config);
}
