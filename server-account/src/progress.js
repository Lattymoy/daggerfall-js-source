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
export async function progressRefusal(db, playerId, { named, character }) {
  const row = await db.prepare('SELECT id, held FROM realm_characters WHERE player = ?1 AND lease IS NOT NULL AND dead_at IS NULL').bind(playerId).first();
  if (!row || (named && character !== row.id)) return { error: 'progress-seat' };
  if (row.held) return { error: 'trade-held', held: row.held };
  return null;
}

/** A stream's bucket and the account's play, as one read: `{ now, allowance, playedAt }`, or null for no account row. */
async function bucketOf(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ stream) {
  const row = await db.prepare('SELECT p.played_s AS now, b.allowance, b.played_at FROM players p LEFT JOIN progress_play b ON b.player = p.id AND b.stream = ?2 WHERE p.id = ?1')
    .bind(playerId, stream).first();
  if (!row) return null;
  return { now: Number(row.now) || 0, allowance: row.allowance == null ? null : Number(row.allowance), playedAt: row.played_at == null ? null : Number(row.played_at) };
}
/** The play since the bucket last moved - none for a bucket never filled (its first claim starts it full). */
const playedSince = (/** @type {{ now: number, playedAt: number | null }} */ b) => (b.playedAt == null ? 0 : Math.max(0, b.now - b.playedAt));

/** What a stream's bucket holds now - what an enforced line lets the next claim take. */
export async function progressRoom(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {string} */ stream, /** @type {any} */ config) {
  const b = await bucketOf(db, playerId, stream);
  if (!b) return 0;
  return stepBudget({ allowance: b.allowance, played: playedSince(b), gain: 0, band: config.streams[stream] }).allowance;
}

/**
 * A CLAIM'S SPEND: the bucket filled by the play since it last moved and spent by `amount`, and the hour's measure - the
 * amount, the play it came in, and what it took past the bucket (`over`) - in one batch. Answers the step
 * (`{ allowance, over }`), or null for nothing spent.
 * @param {any} db @param {string} playerId @param {string} stream @param {number} amount @param {number} nowS @param {any} config
 */
export async function spendProgress(db, playerId, stream, amount, nowS, config) {
  const line = config.streams[stream];
  if (!line || !Number.isFinite(amount) || amount <= 0) return null;
  const b = await bucketOf(db, playerId, stream);
  if (!b) return null;
  const played = playedSince(b);
  const step = stepBudget({ allowance: b.allowance, played, gain: Math.trunc(amount), band: line, enforce: config.enforce });
  const hour = nowS - (nowS % 3600);
  await db.batch([
    db.prepare(`INSERT INTO progress_hours (player, stream, hour, amount, played_s, over, claims) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
      ON CONFLICT (player, stream, hour) DO UPDATE SET amount = amount + excluded.amount, played_s = played_s + excluded.played_s,
        over = over + excluded.over, claims = claims + 1`).bind(playerId, stream, hour, Math.trunc(amount), played, step.over),
    db.prepare(`INSERT INTO progress_play (player, stream, allowance, played_at, at) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT (player, stream) DO UPDATE SET allowance = excluded.allowance, played_at = excluded.played_at, at = excluded.at`)
      .bind(playerId, stream, step.allowance, b.now, nowS),
  ]);
  return step;
}

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
    case '/v1/seats/bounty': if (n(a.paid)) add('bounty', 1); break;
    case '/v1/seats/orc-camp': if (a.counted === true) add('camp', 1); break;
    case '/v1/seats/watch': add('watch', n(a.counted)); break;
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

/** A route's answer, spent: every stream it took from (progressSpentOf), each its own bucket. */
export async function progressSpent(/** @type {any} */ ctx, /** @type {string} */ playerId, /** @type {string} */ path, /** @type {any} */ answer) {
  const spent = progressSpentOf(path, answer);
  if (!spent.length) return;
  const config = await progressConfig(ctx.db);
  for (const [stream, amount] of spent) await spendProgress(ctx.db, playerId, stream, amount, ctx.nowS, config);
}
