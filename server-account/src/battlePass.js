// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md): THE BATTLE PASS AS THE SERVICE KEEPS IT - each account's
// season experience on its row (`pass_<season>`, migration 0194), a deed's find decided here (the page asks with its
// source, as a Soul Cake is asked), the day's bound and the stage's challenges. What the track gives is read off the row
// at every ask (titles.js passKeys), never a letter to claim. The law both ends read is src/net/battlePassLaw.js.
import { overAccountRate } from './accounts.js';
import { shopHeldIds } from '../../src/net/shopLaw.js';
import { isDeveloper } from './titles.js';
import { utcDay } from '../../src/net/marksLaw.js';
import {
  PASS_SOURCES, PASS_DAY_ASKS, PASS_DAY_XP, PASS_CHALLENGES, PASS_XP_PER_LEVEL, PASS_LEVELS,
  passSeasonAt, passSeasonShown, passStageAt, passLevelOf, passTopAt, passTracks, passMult, isPassSource,
} from '../../src/net/battlePassLaw.js';

/** A pass's finds an account an hour, in the isolate's memory (the festival's law: the day's asks bound them across). */
export const PASS_OPS_MAX = 900;
export const PASS_OPS_WINDOW_S = 3600;
/** PASS_OPEN: 'off', 'dev' (the DEVELOPER_HANDLES alone) or 'on'; anything else is off. */
export const passSwitchOf = (/** @type {unknown} */ v) => (v === 'on' || v === 'dev' ? v : 'off');
export const passOpenFor = (/** @type {any} */ player, /** @type {any} */ env) => {
  const s = passSwitchOf(env?.PASS_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
};
/** The answer's status by refusal. */
export const BATTLE_PASS_STATUS = Object.freeze({ guest: 403, closed: 409, source: 400, capped: 429, rate: 429, rid: 400 });
/** AUDIT-STOREFRONT II (lane B 2): a find's own id, sixteen hex (the page's draw), kept this many UTC days past its own -
 *  a find asked again by it is answered as it was. An account's older ids go at its first find of a day (passAskSweep):
 *  an hourly job would take a share of every other job's statements (cron.js runCron). */
export const PASS_RID_RE = /^[0-9a-f]{16}$/;
export const PASS_ASK_KEEP_DAYS = 2;

const int = (/** @type {unknown} */ v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const COLS = 'shop_wares, shop_held';
/** A find's answer kept under its id, as a repeat (progress.js spends nothing on one) - null when the id is new. One whose
 *  answer was never written (its batch landed, the write after it did not) answers no gain. */
async function passAskOf(/** @type {any} */ db, /** @type {string} */ account, /** @type {string} */ rid) {
  const row = await db.prepare('SELECT answer FROM pass_asks WHERE account = ?1 AND rid = ?2').bind(account, rid).first();
  if (!row) return null;
  let a = null;
  try { a = JSON.parse(row.answer); } catch { a = null; }
  return { ...(a && typeof a === 'object' ? a : { gained: 0, done: [] }), repeat: true };
}
/** AUDIT-STOREFRONT II (lane B 2): an account's finds' ids past PASS_ASK_KEEP_DAYS before `day` - read by its own key. */
export const passAskSweep = (/** @type {any} */ db, /** @type {string} */ account, /** @type {number} */ day) =>
  db.prepare('DELETE FROM pass_asks WHERE account = ?1 AND day < ?2').bind(account, day - PASS_ASK_KEEP_DAYS);

/**
 * THE ACCOUNT'S SEASON, for the pass's panel: the season shown (the open one, else the next, else the last), its stage and
 * the level its experience reaches now, the open stage's top, the tracks it plays and its booster's share, the day's
 * experience and the stage's challenges with their counts. A guest's is refused. AUDIT PASS 2: `open` is the switch's
 * word for this account alone - the season's days are the law both ends read, and a page that read `open` before the
 * opening kept it after.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function passOf({ db, nowS }, player, env) {
  if (!player?.handle) return { error: 'guest' };
  const season = passSeasonShown(nowS * 1000);
  if (!season) return { error: 'closed' };
  const [row, day, counts] = await db.batch([
    db.prepare(`SELECT ${COLS}, pass_${season.id} AS xp FROM players WHERE id = ?1`).bind(player.id),
    db.prepare('SELECT xp FROM pass_days WHERE account = ?1 AND season = ?2 AND day = ?3').bind(player.id, season.id, utcDay(nowS)),
    db.prepare('SELECT challenge, n, paid FROM pass_counts WHERE account = ?1 AND season = ?2').bind(player.id, season.id),
  ]);
  const r = row?.results?.[0] ?? {}, held = shopHeldIds(r), xp = int(r.xp), nowMs = nowS * 1000;
  const got = new Map((counts?.results ?? []).map((/** @type {any} */ c) => [c.challenge, c]));
  return {
    season: season.id, open: passOpenFor(player, env), stage: passStageAt(season, nowMs),
    xp, level: passLevelOf(xp, season, nowMs), top: passTopAt(season, nowMs), perLevel: PASS_XP_PER_LEVEL, levels: PASS_LEVELS,
    tracks: passTracks(season.id, held), mult: passMult(season.id, held),
    today: int(day?.results?.[0]?.xp), dayMax: PASS_DAY_XP,
    challenges: PASS_CHALLENGES.map((c) => { const g = /** @type {any} */ (got.get(c.key)); return { key: c.key, n: Math.min(int(g?.n), c.n), paid: int(g?.paid) > 0 }; }),
  };
}

/**
 * A FIND: a deed's experience for `body.source` (battlePassLaw.js PASS_SOURCES), in ONE TRANSACTION - the day's row takes the ask
 * under PASS_DAY_ASKS and the base under PASS_DAY_XP (its `last` the base it took, every SET reading the old row), the
 * account's experience takes that base and the booster's share of it, each open challenge of its source counts one and
 * pays once on the deed that completes it. `{ gained, xp, level, today, done: [challenge keys paid], season, tracks, mult }`
 * - AUDIT PASS 8: the tracks with it, so a level reached after a purchase is told with the premium rewards on it.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} body @param {any} env
 */
export async function findPass(ctx, player, body, env) {
  const { db, nowS } = ctx;
  if (!player?.handle) return { error: 'guest' };
  // AUDIT-STOREFRONT II (lane B 2): `body.rid` the find's own id - the page asks again with it while no answer comes back,
  // and an id this account found by is answered as it was (`repeat`), never counted twice: its row is written in the
  // find's batch, so a twin racing it rolls back whole. A find with no id is decided as before.
  const rid = body?.rid;
  if (rid !== undefined && (typeof rid !== 'string' || !PASS_RID_RE.test(rid))) return { error: 'rid' };
  const kept = rid ? await passAskOf(db, player.id, rid) : null;
  if (kept) return kept;
  if (!passOpenFor(player, env)) return { error: 'closed' };
  const season = passSeasonAt(nowS * 1000);
  if (!season) return { error: 'closed' };
  const source = body?.source;
  if (!isPassSource(source)) return { error: 'source' };
  if (overAccountRate(`pass:${player.id}`, nowS, PASS_OPS_MAX, PASS_OPS_WINDOW_S)) return { error: 'rate' };
  const day = utcDay(nowS), stage = passStageAt(season, nowS * 1000), col = `pass_${season.id}`;
  const ask = await db.prepare(`INSERT INTO pass_days (account, season, day, asks, xp, last) VALUES (?1, ?2, ?3, 1, 0, 0)
    ON CONFLICT (account, season, day) DO UPDATE SET asks = asks + 1 WHERE asks < ?4 RETURNING asks`).bind(player.id, season.id, day, PASS_DAY_ASKS).first();
  if (!ask) return { error: 'capped' };
  const held = shopHeldIds(await db.prepare(`SELECT ${COLS} FROM players WHERE id = ?1`).bind(player.id).first());
  const mult = passMult(season.id, held);
  const base = PASS_SOURCES[/** @type {keyof typeof PASS_SOURCES} */ (source)];
  const mine = PASS_CHALLENGES.filter((c) => c.stage === stage && c.sources.includes(source));
  const where = 'account = ?1 AND season = ?2';
  const asked = rid ? [db.prepare('INSERT INTO pass_asks (account, rid, day) VALUES (?1, ?2, ?3)').bind(player.id, rid, day)] : [];
  let out;
  try {
    out = await db.batch([
      db.prepare(`UPDATE pass_days SET last = MIN(?4, MAX(0, ?5 - xp)), xp = xp + MIN(?4, MAX(0, ?5 - xp)) WHERE ${where} AND day = ?3`).bind(player.id, season.id, day, base, PASS_DAY_XP),
      db.prepare(`UPDATE players SET ${col} = ${col} + (SELECT last FROM pass_days WHERE ${where} AND day = ?3) + CAST((SELECT last FROM pass_days WHERE ${where} AND day = ?3) * ?4 AS INTEGER) WHERE id = ?1`)
        .bind(player.id, season.id, day, mult - 1),
      ...mine.flatMap((c) => [
        db.prepare(`INSERT INTO pass_counts (account, season, challenge, n, paid) VALUES (?1, ?2, ?3, 1, 0) ON CONFLICT (account, season, challenge) DO UPDATE SET n = n + 1`).bind(player.id, season.id, c.key),
        db.prepare(`UPDATE players SET ${col} = ${col} + ?4 WHERE id = ?1 AND EXISTS (SELECT 1 FROM pass_counts WHERE ${where} AND challenge = ?3 AND n >= ?5 AND paid = 0)`).bind(player.id, season.id, c.key, c.xp, c.n),
        db.prepare(`UPDATE pass_counts SET paid = ?4 WHERE ${where} AND challenge = ?3 AND n >= ?5 AND paid = 0 RETURNING challenge`).bind(player.id, season.id, c.key, nowS, c.n),
      ]),
      db.prepare(`SELECT ${col} AS xp, (SELECT xp FROM pass_days WHERE ${where} AND day = ?3) AS today, (SELECT last FROM pass_days WHERE ${where} AND day = ?3) AS last FROM players WHERE id = ?1`).bind(player.id, season.id, day),
      ...asked,
      ...(ask.asks === 1 ? [passAskSweep(db, player.id, day)] : []),   // the day's first find: the account's older ids go
    ]);
  } catch (e) {
    const twin = rid ? await passAskOf(db, player.id, rid) : null;   // a twin of this ask landed first: its answer is this one's
    if (twin) return twin;
    throw e;
  }
  const done = mine.filter((_, i) => out[2 + i * 3 + 2]?.results?.length).map((c) => c.key);
  const end = out[2 + mine.length * 3]?.results?.[0] ?? {};
  const last = int(end.last);
  const gained = last + Math.floor(last * (mult - 1)) + mine.filter((c) => done.includes(c.key)).reduce((a, c) => a + c.xp, 0);
  const xp = int(end.xp), today = int(end.today);
  const answer = { gained, xp, level: passLevelOf(xp, season, nowS * 1000), today, ...(today >= PASS_DAY_XP ? { capped: true } : {}), done, season: season.id, tracks: passTracks(season.id, held), mult };
  if (rid) {
    try { await db.prepare('UPDATE pass_asks SET answer = ?3 WHERE account = ?1 AND rid = ?2').bind(player.id, rid, JSON.stringify(answer)).run(); } catch { /* the find counted either way */ }
  }
  return answer;
}
