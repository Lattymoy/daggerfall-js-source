// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md), PASS-PANELS (2026-10-30): THE BATTLE PASS AS THE SERVICE KEEPS
// IT - a deed's find decided here (the page asks with its source, as a Soul Cake is asked), its Aurum a ledger's day line
// under the day's bound; the stage's challenges, each its Aurum once; the premium track opened and an item bought, each a
// ledger line spent in one guarded batch (the item also on the row's `pass_items`, which the wardrobe reads). The law
// both ends read is src/net/battlePassLaw.js; the balance is aurum.js's.
import { overAccountRate } from './accounts.js';
import { isDeveloper, holdsAll } from './titles.js';   // ADMIN-ALL: an admin holds every item and both folios, so is sold none
import { mustChange } from './realm.js';
import { aurumRow, balanceOfRow, aurumOpenFor, AURUM_BALANCE_SQL } from './aurum.js';
import { utcDay } from '../../src/net/marksLaw.js';
import {
  PASS_SOURCES, PASS_DAY_ASKS, PASS_DAY_AURUM, PASS_CHALLENGES, PASS_FINDS_FROM_MS, PASS_PREMIUM_AURUM,
  passSeasonAt, passSeasonShown, passSeasonById, passStageAt, passTracksOpen, passItemOf, passItemsOf, passBuyBlock, isPassSource, PASS_ALL_GRANTS,
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
/** The answer's status by refusal - a find's (guest ... rid) and a track's or an item's (pass-*). */
export const BATTLE_PASS_STATUS = Object.freeze({
  guest: 403, closed: 409, source: 400, capped: 429, rate: 429, rid: 400,
  'pass-guest': 403, 'pass-closed': 409, 'pass-season': 400, 'pass-item': 400, 'pass-soon': 409, 'pass-held': 409,
  'pass-track': 409, 'pass-panel': 409, 'pass-short': 409, 'pass-busy': 503,
});
/** AUDIT-STOREFRONT II (lane B 2): a find's own id, sixteen hex (the page's draw), kept this many UTC days past its own -
 *  a find asked again by it is answered as it was. An account's older ids go at its first find of a day (passAskSweep):
 *  an hourly job would take a share of every other job's statements (cron.js runCron). */
export const PASS_RID_RE = /^[0-9a-f]{16}$/;
export const PASS_ASK_KEEP_DAYS = 2;

const int = (/** @type {unknown} */ v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
/** A season's premium track's ledger ref, and whether an account opened it. */
const trackRef = (/** @type {string} */ season) => `${season}:premium`;
const premiumOf = async (/** @type {any} */ db, /** @type {string} */ account, /** @type {string} */ season) =>
  !!(await db.prepare("SELECT 1 AS x FROM aurum_ledger WHERE account = ?1 AND kind = 'track' AND ref = ?2").bind(account, trackRef(season)).first());
/** A find's answer kept under its id, as a repeat (progress.js spends nothing on one) - null when the id is new. One whose
 *  answer was never written (its batch landed, the write after it did not) answers no gain. */
async function passAskOf(/** @type {any} */ db, /** @type {string} */ account, /** @type {string} */ rid) {
  const row = await db.prepare('SELECT answer, day FROM pass_asks WHERE account = ?1 AND rid = ?2').bind(account, rid).first();
  if (!row) return null;
  let a = null;
  try { a = JSON.parse(row.answer); } catch { a = null; }
  // AUDIT-STOREFRONT III B4: the day it counted on rides with it (its `today` is that day's); one not yet answered (a twin
  // still out) says so with no `today`, and the page reads the card again
  return { ...(a && typeof a === 'object' ? a : { gained: 0, done: [] }), day: int(row.day), repeat: true };
}
/** AUDIT-STOREFRONT II (lane B 2): an account's finds' ids past PASS_ASK_KEEP_DAYS before `day` - read by its own key. */
export const passAskSweep = (/** @type {any} */ db, /** @type {string} */ account, /** @type {number} */ day) =>
  db.prepare('DELETE FROM pass_asks WHERE account = ?1 AND day < ?2').bind(account, day - PASS_ASK_KEEP_DAYS);

/**
 * THE ACCOUNT'S PASS, for the window: the season shown (the running one, else the next, else the last), its stage, the
 * tracks it opened, the items it bought, the Aurum its finds earned today and the stage's challenges with their counts.
 * A guest's is refused. AUDIT PASS 2: `open` is the switch's word for this account alone. ADMIN-ALL: an admin's tracks
 * are both open and its items every one, derived here and never written, as titles.js holdsAll's are. AUDIT-STOREFRONT
 * III C13: `spent` each track's Aurum as the ledger's `panel` lines say it was spent - an admin's none.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function passOf({ db, nowS }, player, env) {
  if (!player?.handle) return { error: 'guest' };
  const season = passSeasonShown(nowS * 1000);
  if (!season) return { error: 'closed' };
  const [row, day, counts, track, panels] = await db.batch([
    db.prepare('SELECT pass_items FROM players WHERE id = ?1').bind(player.id),
    db.prepare('SELECT aurum FROM pass_days WHERE account = ?1 AND day = ?2').bind(player.id, utcDay(nowS)),
    db.prepare('SELECT challenge, n, paid FROM pass_counts WHERE account = ?1 AND season = ?2').bind(player.id, season.id),
    db.prepare("SELECT 1 AS x FROM aurum_ledger WHERE account = ?1 AND kind = 'track' AND ref = ?2").bind(player.id, trackRef(season.id)),
    db.prepare("SELECT ref, amount FROM aurum_ledger WHERE account = ?1 AND kind = 'panel' AND ref LIKE ?2").bind(player.id, `${season.id}:%`),
  ]);
  const spent = { free: 0, premium: 0 };
  for (const l of panels?.results ?? []) {   // a line's ref is `<season>:<grant>`, its amount the price paid, less than nought
    const at = passItemOf(season.id, String(l.ref).slice(season.id.length + 1));
    if (at) spent[/** @type {'free'|'premium'} */ (at.track)] += Math.max(0, -int(l.amount));
  }
  const got = new Map((counts?.results ?? []).map((/** @type {any} */ c) => [c.challenge, c]));
  const admin = holdsAll(player, env);
  return {
    season: season.id, open: passOpenFor(player, env), stage: passStageAt(season, nowS * 1000),
    tracks: { free: true, premium: admin || !!track?.results?.length },
    bought: (admin ? PASS_ALL_GRANTS : passItemsOf(row?.results?.[0]?.pass_items)).filter((g) => !!passItemOf(season.id, g)),
    today: int(day?.results?.[0]?.aurum), dayMax: PASS_DAY_AURUM, spent,
    challenges: PASS_CHALLENGES.map((c) => { const g = /** @type {any} */ (got.get(c.key)); return { key: c.key, n: Math.min(int(g?.n), c.n), paid: int(g?.paid) > 0 }; }),
  };
}

/**
 * A FIND: a deed's Aurum for `body.source` (battlePassLaw.js PASS_SOURCES), in ONE TRANSACTION - the day's row takes the
 * ask under PASS_DAY_ASKS and the Aurum under PASS_DAY_AURUM (its `last` what it took, every SET reading the old row), the
 * ledger's day line takes the same, and each challenge of the running stage and its source counts one and pays its Aurum
 * once on the deed that completes it. `{ gained, found, today, done: [challenge keys paid], season }` - `found` the
 * find's own, `gained` with the challenges'. Finds pay from PASS_FINDS_FROM_MS for good; the challenges, in their season.
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
  if (!passOpenFor(player, env) || nowS * 1000 < PASS_FINDS_FROM_MS) return { error: 'closed' };
  const source = body?.source;
  if (!isPassSource(source)) return { error: 'source' };
  if (overAccountRate(`pass:${player.id}`, nowS, PASS_OPS_MAX, PASS_OPS_WINDOW_S)) return { error: 'rate' };
  const day = utcDay(nowS);
  const ask = await db.prepare(`INSERT INTO pass_days (account, day, asks, aurum, last) VALUES (?1, ?2, 1, 0, 0)
    ON CONFLICT (account, day) DO UPDATE SET asks = asks + 1 WHERE asks < ?3 RETURNING asks`).bind(player.id, day, PASS_DAY_ASKS).first();
  if (!ask) return { error: 'capped' };
  const season = passSeasonAt(nowS * 1000), stage = season ? passStageAt(season, nowS * 1000) : -1;
  const base = PASS_SOURCES[/** @type {keyof typeof PASS_SOURCES} */ (source)];
  const mine = season ? PASS_CHALLENGES.filter((c) => c.stage === stage && c.sources.includes(source)) : [];
  const where = 'account = ?1 AND season = ?2';
  const asked = rid ? [db.prepare('INSERT INTO pass_asks (account, rid, day) VALUES (?1, ?2, ?3)').bind(player.id, rid, day)] : [];
  let out;
  try {
    out = await db.batch([
      db.prepare('UPDATE pass_days SET last = MIN(?3, MAX(0, ?4 - aurum)), aurum = aurum + MIN(?3, MAX(0, ?4 - aurum)) WHERE account = ?1 AND day = ?2').bind(player.id, day, base, PASS_DAY_AURUM),
      db.prepare(`INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) SELECT ?1, 'find', ?2, last, ?3, ?4 FROM pass_days WHERE account = ?1 AND day = ?3 AND last > 0
        ON CONFLICT (account, kind, ref) DO UPDATE SET amount = amount + excluded.amount, at = excluded.at`).bind(player.id, String(day), day, nowS),
      ...mine.flatMap((c) => [
        db.prepare('INSERT INTO pass_counts (account, season, challenge, n, paid) VALUES (?1, ?2, ?3, 1, 0) ON CONFLICT (account, season, challenge) DO UPDATE SET n = n + 1').bind(player.id, /** @type {any} */ (season).id, c.key),
        db.prepare(`INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) SELECT ?1, 'challenge', ?2 || ':' || ?3, ?4, ?6, ?7
          WHERE EXISTS (SELECT 1 FROM pass_counts WHERE ${where} AND challenge = ?3 AND n >= ?5 AND paid = 0)`).bind(player.id, /** @type {any} */ (season).id, c.key, c.aurum, c.n, day, nowS),
        db.prepare(`UPDATE pass_counts SET paid = ?4 WHERE ${where} AND challenge = ?3 AND n >= ?5 AND paid = 0 RETURNING challenge`).bind(player.id, /** @type {any} */ (season).id, c.key, nowS, c.n),
      ]),
      db.prepare('SELECT aurum AS today, last FROM pass_days WHERE account = ?1 AND day = ?2').bind(player.id, day),
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
  const found = int(end.last), today = int(end.today);
  const gained = found + mine.filter((c) => done.includes(c.key)).reduce((a, c) => a + c.aurum, 0);
  const answer = { gained, found, today, day, ...(today >= PASS_DAY_AURUM ? { capped: true } : {}), done, season: season?.id ?? null };   // AUDIT-STOREFRONT III B4: `day`, the UTC day `today` counts
  if (rid) {
    try { await db.prepare('UPDATE pass_asks SET answer = ?3 WHERE account = ?1 AND rid = ?2').bind(player.id, rid, JSON.stringify(answer)).run(); } catch { /* the find counted either way */ }
  }
  return answer;
}

/** The checks a track's or an item's buy shares: a registered account, both switches, a season whose tracks sell now.
 *  AUDIT-STOREFRONT III A1: AURUM_OPEN too - shut, nothing is bought for Aurum (wrangler.toml), as the window reads it. */
function buyGate(/** @type {any} */ player, /** @type {any} */ env, /** @type {unknown} */ seasonId, /** @type {number} */ nowS) {
  if (!player?.handle) return { error: 'pass-guest' };
  if (!passOpenFor(player, env) || !aurumOpenFor(player, env)) return { error: 'pass-closed' };
  const season = passSeasonById(seasonId);
  if (!season) return { error: 'pass-season' };
  if (!passTracksOpen(season, nowS * 1000)) return { error: 'pass-soon' };
  return { season };
}

/**
 * THE PREMIUM TRACK OPENED (PASS-PANELS: "using our new currency to both unlock tracks and buy the items"): `body.season`'s
 * premium track for PASS_PREMIUM_AURUM, ONE STATEMENT - the ledger's `track` line written only while the balance as it
 * stands then covers it; the key makes a second open a no-op. `{ ok, season, spent, row }` - `row` the whole row, so
 * its answer carries the wardrobe as a buy's does - or `{ error }`: pass-guest, -closed, -season, -soon, -held (open
 * already, or an admin's), -short (with `balance`).
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} body @param {any} env
 */
export async function unlockPass({ db, nowS }, player, body, env) {
  const g = buyGate(player, env, body?.season, nowS);
  if ('error' in g) return g;
  const id = g.season.id, cost = PASS_PREMIUM_AURUM[/** @type {keyof typeof PASS_PREMIUM_AURUM} */ (id)];
  if (!Number.isSafeInteger(cost)) return { error: 'pass-season' };
  if (holdsAll(player, env) || (await premiumOf(db, player.id, id))) return { error: 'pass-held' };   // ADMIN-ALL: an admin's is open
  try {
    await db.batch([
      db.prepare(`INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) SELECT ?1, 'track', ?2, ?3, ?4, ?5 WHERE ${AURUM_BALANCE_SQL} >= ?6`)
        .bind(player.id, trackRef(id), -cost, utcDay(nowS), nowS, cost),
      mustChange(db),
    ]);
  } catch {
    if (await premiumOf(db, player.id, id)) return { error: 'pass-held' };   // a twin opened it first
    return { error: 'pass-short', balance: balanceOfRow(await aurumRow(db, player.id)) };
  }
  return { ok: true, season: id, spent: cost, row: await db.prepare('SELECT * FROM players WHERE id = ?1').bind(player.id).first() };
}

/**
 * AN ITEM BOUGHT: `body.grant` on `body.season`'s tracks, for its price in Aurum, in ONE TRANSACTION - the ledger's `panel`
 * line written only while the balance as it stands then covers the price, and the item put on `pass_items` only while
 * the row is the one read (what it bought decides the panels open: battlePassLaw.js passBuyBlock). A row moved meanwhile
 * is read again, three times. `{ ok, season, grant, spent, row }` - `row` the whole row after, for the wardrobe - or
 * `{ error }`: pass-guest, -closed, -season, -item, -soon, -held, -track, -panel, -short (with `balance`), -busy.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} body @param {any} env
 */
export async function buyPass({ db, nowS }, player, body, env) {
  const g = buyGate(player, env, body?.season, nowS);
  if ('error' in g) return g;
  const id = g.season.id, at = passItemOf(id, body?.grant);
  if (!at) return { error: 'pass-item' };
  if (holdsAll(player, env)) return { error: 'pass-held' };   // ADMIN-ALL: an admin holds every item
  const grant = /** @type {string} */ (body.grant);
  const premium = at.track === 'premium' && (await premiumOf(db, player.id, id));
  for (let i = 0; i < 3; i++) {
    const row = await aurumRow(db, player.id);
    if (!row) return { error: 'pass-guest' };
    const was = String(row.pass_items ?? ''), bought = passItemsOf(was);
    const block = passBuyBlock(id, grant, { premium, bought, nowMs: nowS * 1000 });
    if (block) return { error: `pass-${block}` };
    const balance = balanceOfRow(row);
    if (balance < at.aurum) return { error: 'pass-short', balance };
    try {
      await db.batch([
        db.prepare(`INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) SELECT ?1, 'panel', ?2, ?3, ?4, ?5 WHERE ${AURUM_BALANCE_SQL} >= ?6`)
          .bind(player.id, `${id}:${grant}`, -at.aurum, utcDay(nowS), nowS, at.aurum),
        mustChange(db),
        db.prepare('UPDATE players SET pass_items = ?2 WHERE id = ?1 AND pass_items = ?3').bind(player.id, [...was.split(' ').filter(Boolean), grant].join(' '), was),
        mustChange(db),
      ]);
    } catch {
      continue;   // the row moved, or the balance fell under the price meanwhile: read again
    }
    return { ok: true, season: id, grant, spent: at.aurum, row: await db.prepare('SELECT * FROM players WHERE id = ?1').bind(player.id).first() };
  }
  return { error: 'pass-busy' };
}
