// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TOWN-ECON TE2 (2026-10-18, Mac: "Everything"; bible/06-Systems/Town-Economy-Arc.md section 4) - THE PLAYERS' SHARE
// OF A TOWN'S ECONOMY, as this service counts it.
//
// WITNESSED ACTS ONLY (TE0 decision 3): a town is raised by what this service saw happen there, never by gold -
//   - its FOOTSTEPS: the relay's signed Watch ticks (src/net/watchReceipt.js), claimed by the account they name, at the
//     town the registry holds for the tick's pixel (POST /v1/towns/watch);
//   - TRADE at its players' traders: a market sale at a trader's stall (market.js marketBuy, at the listing's
//     `vendor_map`, the buyer's act) and LW15's patron sale (market.js reckonPatrons, the seller's);
//   - a RAID DRIVEN OFF at its gates: the relay's cleanse receipt claimed (raids.js claimRaid), at the town the registry
//     holds for the raid's `region:location`;
//   - SEA-TRADE (section 8): a captain's DEALING at a port's exchange, vouched by a Watch tick the claim flags (`sea`) -
//     at the town the registry holds at the tick's pixel or one beside it (TOWN_SEA_REACH_PX). The deal is the
//     client's word, as a pose is: the tick proves the account stood at the port, the cap bounds the rest.
// Each act is one account's, capped a town a day by source (townEconLaw.js TOWN_ECON_CAPS) in the write itself, and
// counted again into the town's day (town_econ_days), which the share is read from (POST /v1/towns/econ).
//
// THE TOWN REGISTRY (POST /v1/towns/witness): which town stands at a pixel and which a raid names is the clients' word,
// agreed - three accounts a week registered give the same report (nodeLaw.js witnessedFact), and the town is confirmed
// into town_econ_towns, after which its key takes no more reports (so a town's rows stay a handful). An act at a pixel
// or a raid the registry has not confirmed counts nothing.
//
// Footsteps and raids are counted for an account a week registered alone (witnessOf), as its reports are; a sale
// counts for its buyer so, and a patron's for its seller (who keeps a home and a trader in the town).
// ═══════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { witnessOf } from './townSeats.js';
import { witnessedFact, factConfirmed } from '../../src/net/nodeLaw.js';
import { verifyWatchReceipt, WATCH_RECEIPT_TTL_S } from '../../src/net/watchReceipt.js';
import { isDeveloper } from './titles.js';   // AUDIT TOWN-ECON 2 SVC-1: a false town struck, the registry audited - a developer's
import { RAID_KEY_RE } from '../../src/net/raid/raidLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import {
  TOWN_ECON_CAPS, TOWN_ECON_DAYS, TOWN_ECON_KEPT_S, TOWN_ECON_SHARE_LEAST, TOWN_WATCH_CLAIM_MAX, TOWN_WITNESS_KIND,
  TOWN_WITNESS_HOUR, TOWN_SEA_REACH_PX, townReportOf, townReportText, parseTownReport, townActivity, townPlayersShare, townShareShown,
} from '../../src/net/townEconLaw.js';

/**
 * ONE ACT AT A TOWN, as statements of a batch: the account's mark under its cap, and the town's day behind it - the
 * second only where the first moved (`changes()`), so a capped act counts nothing. `guard` is SQL whose own binds start
 * at ?6 (`binds`): the act counts only where it holds (a sale's row written, a tick unseen).
 * @param {any} db
 * @param {{ account: string, map: number, day: number, src: 'watch'|'trade'|'raid'|'sea', guard?: string, binds?: unknown[] }} act
 */
export function townActStatements(db, { account, map, day, src, guard = 'true', binds = [] }) {
  return [
    db.prepare(`INSERT INTO town_econ_acts (account, map, day, src, n) SELECT ?1, ?2, ?3, ?4, 1 WHERE ${guard}
      ON CONFLICT (account, map, day, src) DO UPDATE SET n = town_econ_acts.n + 1 WHERE town_econ_acts.n < ?5`)
      .bind(account, map, day, src, TOWN_ECON_CAPS[src], ...binds),
    db.prepare(`INSERT INTO town_econ_days (map, day, src, n) SELECT ?1, ?2, ?3, 1 WHERE changes() > 0
      ON CONFLICT (map, day, src) DO UPDATE SET n = town_econ_days.n + 1`).bind(map, day, src),
  ];
}

/** A TRADER'S SALE counted at its town for its buyer (market.js marketBuy, both currencies): `map` the listing's
 *  `vendor_map`, `sold` the sale's own row's guard over ?6-?8 (`[buyer, rid, nonce]`). None for a listing at no trader,
 *  or a buyer under a week registered. @param {any} db @param {any} player @param {number} nowS
 *  @param {number|null} map @param {string} sold @param {unknown[]} binds */
export function tradeActStatements(db, player, nowS, map, sold, binds) {
  if (!Number.isSafeInteger(map) || /** @type {number} */ (map) <= 0 || !witnessOf(player, nowS)) return [];
  return townActStatements(db, { account: player.id, map: /** @type {number} */ (map), day: utcDay(nowS), src: 'trade', guard: sold, binds });
}

/** A PATRON'S SALE counted at its town for its seller (market.js reckonPatrons, behind the sale's mustChange) - on the
 *  hour's own day. @param {any} db @param {string} seller @param {number} map @param {number} day */
export const patronActStatements = (db, seller, map, day) => townActStatements(db, { account: seller, map, day, src: 'trade' });

/** A RAID DRIVEN OFF counted at the town the registry holds for its `region:location` (raids.js claimRaid's `econ`
 *  hook) - by THIS claim's row alone (`raid_cleanses` with its nonce). None for an account under a week registered, a
 *  key that is no raid's, or a town not confirmed. @param {any} db @param {any} player @param {number} nowS
 *  @param {string} key @param {string} nonce */
export function raidActStatements(db, player, nowS, key, nonce) {
  if (typeof key !== 'string' || !RAID_KEY_RE.test(key) || !witnessOf(player, nowS)) return [];
  const [region, location] = key.split(':').map(Number);
  const day = utcDay(nowS);
  return [
    db.prepare(`INSERT INTO town_econ_acts (account, map, day, src, n) SELECT ?1, t.map, ?2, 'raid', 1
      FROM town_econ_towns t WHERE t.region = ?3 AND t.location = ?4
        AND EXISTS (SELECT 1 FROM raid_cleanses WHERE raid = ?5 AND account = ?1 AND nonce = ?6)
      ON CONFLICT (account, map, day, src) DO UPDATE SET n = town_econ_acts.n + 1 WHERE town_econ_acts.n < ?7`)
      .bind(player.id, day, region, location, key, nonce, TOWN_ECON_CAPS.raid),
    db.prepare(`INSERT INTO town_econ_days (map, day, src, n) SELECT t.map, ?1, 'raid', 1
      FROM town_econ_towns t WHERE t.region = ?2 AND t.location = ?3 AND changes() > 0
      ON CONFLICT (map, day, src) DO UPDATE SET n = town_econ_days.n + 1`).bind(day, region, location),
  ];
}

/** AUDIT TOWN-ECON 2 SVC-11: a town's key in the witness rows, versioned as the halls' is (AUDIT CHAP2 E7: `1:<map>`) - a
 *  report's rule changed later is a new key, never a first answer standing under the old one. @param {number} map */
export const townWitnessKey = (map) => `1:${map >>> 0}`;
/** AUDIT TOWN-ECON 2 SVC-7: the towns' doors open unless TOWNS_OPEN is 'off' - the load shed by a variable, as the seats',
 *  the market's and the chapters' are; a sale's and a raid's acts still ride their own batches. @param {any} env */
export const townsOpen = (env) => String(env?.TOWNS_OPEN ?? 'on').trim().toLowerCase() !== 'off';

/**
 * A TOWN WITNESSED: `{ town: { map, px, py, region, location }, receipt }` - the town the caller's client stands in, and
 * AUDIT TOWN-ECON 2 SVC-1 the relay's signed Watch tick that stood this account at its pixel (proof of presence: a report
 * is a walk, never a list typed in). Answers `{ ok, counted, confirmed }` (`why` when not counted: 'young', an account
 * under a week registered; 'known', a town already confirmed; 'struck', a map id a developer struck; 'taken', a pixel or
 * a place another town holds - its reports let go, so the key's rows stay a handful) or `{ error }`:
 * 'towns-need-account' (a guest), 'bad-town', 'towns-rate', 'town-unwalked' (no tick of this account's at the town's
 * pixel), 'no-gate-key'.
 * @param {{ db: any, nowS: number, subtle?: any }} ctx @param {any} player @param {any} _env @param {any} body
 * @param {any} publicKey the gate's public key (signing.js gatePublicKey)
 */
export async function witnessTown({ db, nowS, subtle }, player, _env, { town, receipt } = {}, publicKey = null) {
  if (accountKind(player) !== 'linked') return { error: 'towns-need-account' };
  const t = townReportOf(town);
  if (!t) return { error: 'bad-town' };
  if (!publicKey) return { error: 'no-gate-key' };
  if (await overRate({ db, nowS }, `town-witness:${player.id}`, TOWN_WITNESS_HOUR, 3600)) return { error: 'towns-rate' };
  if (!witnessOf(player, nowS)) return { ok: true, counted: false, why: 'young' };
  const v = /** @type {any} */ (await verifyWatchReceipt(receipt, publicKey, { subtle, nowS }));
  if (!v.ok || v.claims.s !== player.id || v.claims.x !== t.px || v.claims.y !== t.py) return { error: 'town-unwalked' };
  const known = await db.prepare(`SELECT (SELECT 1 FROM town_econ_towns WHERE map = ?1) AS known,
    (SELECT 1 FROM town_econ_struck WHERE map = ?1) AS struck`).bind(t.map).first();
  if (known?.known) return { ok: true, counted: false, why: 'known' };
  if (known?.struck) return { ok: true, counted: false, why: 'struck' };
  const key = townWitnessKey(t.map);
  await db.prepare('INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(TOWN_WITNESS_KIND, key, player.id, townReportText(t), t.region, nowS).run();
  // AUDIT TOWN-ECON 2 SVC-4: every report of the key, as the seats read theirs - an unconfirmed key's rows are its accounts'
  // first answers (one an account), and a cut at the oldest let earlier dissents stand between a true town and its third
  const { results: rows = [] } = await db.prepare('SELECT account, report, at FROM world_witness WHERE kind = ?1 AND key = ?2 ORDER BY at, account')
    .bind(TOWN_WITNESS_KIND, key).all();
  const fact = /** @type {any} */ (witnessedFact(rows, parseTownReport));
  if (!factConfirmed(fact)) return { ok: true, counted: true, confirmed: false };
  // the first town confirmed at a map id, a pixel or a place stands (the table's three keys). AUDIT TOWN-ECON 2 SVC-6: one
  // the table did not take is 'taken' - its key's reports go, and the next day's report asks again (a developer's strike
  // of the town that holds the pixel lets it stand)
  const put = await db.prepare('INSERT OR IGNORE INTO town_econ_towns (map, px, py, region, location, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(fact.map, fact.px, fact.py, fact.region, fact.location, nowS).run();
  if (Number(put?.meta?.changes ?? 0) > 0) return { ok: true, counted: true, confirmed: true };
  if (await db.prepare('SELECT 1 AS y FROM town_econ_towns WHERE map = ?1').bind(fact.map).first()) return { ok: true, counted: true, confirmed: true };   // a racing report confirmed it
  await db.prepare('DELETE FROM world_witness WHERE kind = ?1 AND key = ?2').bind(TOWN_WITNESS_KIND, key).run();
  return { ok: true, counted: true, confirmed: false, why: 'taken' };
}

/**
 * AUDIT TOWN-ECON 2 SVC-1: A FALSE TOWN STRUCK (`/town strike <map id>`, a developer's alone - RED1's authority, the seats'
 * and the halls' strike): its row, its reports, its acts and its days go, and the map id is never witnessed again. A
 * true town a false one kept off its pixel is reported again the next day. Answers `{ ok, map, reports }` or `{ error }`:
 * 'not-developer', 'bad-town'.
 * @param {{ db: any, nowS: number }} ctx @param {any} dev @param {any} env @param {any} body
 */
export async function strikeTown({ db, nowS }, dev, env, { map } = {}) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (!Number.isSafeInteger(map) || map < 1 || map > 0xffffffff) return { error: 'bad-town' };
  const [gone] = await db.batch([
    db.prepare('DELETE FROM world_witness WHERE kind = ?1 AND key = ?2').bind(TOWN_WITNESS_KIND, townWitnessKey(map)),
    db.prepare('DELETE FROM town_econ_towns WHERE map = ?1').bind(map),
    db.prepare('DELETE FROM town_econ_acts WHERE map = ?1').bind(map),
    db.prepare('DELETE FROM town_econ_days WHERE map = ?1').bind(map),
    db.prepare('INSERT OR REPLACE INTO town_econ_struck (map, by, at) VALUES (?1, ?2, ?3)').bind(map, dev.handle ?? null, nowS),
  ]);
  _kept = null;
  return { ok: true, map, reports: Number(gone?.meta?.changes ?? 0) };
}

/**
 * AUDIT TOWN-ECON 2 SVC-1: THE REGISTRY'S AUDIT (`/town audit`, a developer's alone): a region's confirmed towns - map
 * id, pixel, place, when, and the accounts whose reports confirmed it - which the client sets beside the towns its own
 * map holds at those pixels. `{ ok, towns: [{ map, px, py, location, at, by: [handle] }] }` or `{ error }`.
 * @param {{ db: any }} ctx @param {any} dev @param {any} env @param {any} body
 */
export async function auditTowns({ db }, dev, env, { region } = {}) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (!Number.isSafeInteger(region) || region < 0 || region > 61) return { error: 'bad-town' };
  const { results: towns = [] } = await db.prepare('SELECT map, px, py, location, at FROM town_econ_towns WHERE region = ?1 ORDER BY location LIMIT 400').bind(region).all();
  const { results: by = [] } = await db.prepare(`SELECT w.key, p.handle FROM world_witness w JOIN town_econ_towns t ON w.key = '1:' || t.map
    LEFT JOIN players p ON p.id = w.account WHERE w.kind = ?1 AND t.region = ?2 ORDER BY w.at LIMIT 4000`).bind(TOWN_WITNESS_KIND, region).all();
  /** @type {Map<string, string[]>} */
  const names = new Map();
  for (const r of by) { const k = String(r.key); if (!names.has(k)) names.set(k, []); names.get(k)?.push(r.handle ?? '?'); }
  return { ok: true, towns: towns.map((r) => ({ map: Number(r.map), px: Number(r.px), py: Number(r.py), location: Number(r.location), at: Number(r.at), by: (names.get(townWitnessKey(Number(r.map))) ?? []).slice(0, 3) })) };
}

/** SEA-TRADE: the claim's `sea` - the indices of the receipts that vouch a dealing, each once, in range; none is none.
 *  @param {unknown} sea @param {number} n */
const seaIndices = (sea, n) => {
  if (sea == null) return new Set();
  if (!Array.isArray(sea) || sea.length > n) return null;
  const s = new Set(sea);
  return s.size === sea.length && sea.every((i) => Number.isSafeInteger(i) && i >= 0 && i < n) ? s : null;
};

/**
 * THE WATCH'S TICKS CLAIMED at the towns they were walked in: `{ receipts: [r, ...], sea?: [i, ...] }`
 * (TOWN_WATCH_CLAIM_MAX at most), each the relay's signed receipt for this account. Each counts once (town_econ_seen),
 * at the town the registry holds for its pixel, on its own UTC day while that day is kept, under the account's cap.
 * SEA-TRADE: a receipt `sea` names counts once more as a dealing (`<ref>:sea` seen) at the town the registry holds at
 * its pixel, or the nearest beside it within TOWN_SEA_REACH_PX. AUDIT TOWN-ECON 2 SVC-5: the claim reads first what the
 * account has counted and which of its ticks were seen - a tick past its town's cap, or seen before, writes nothing - and
 * says the pixels whose footsteps are full today (`full`), which the client keeps no more ticks at. SVC-12: the towns
 * of every tick in one read. Answers `{ ok, counted, sea, why, full }` (`why` a tally of the acts not counted, by reason)
 * or `{ error }`: 'towns-need-account', 'bad-watch', 'no-gate-key'.
 * @param {{ db: any, nowS: number, subtle?: any }} ctx @param {any} player @param {any} _env @param {any} body
 * @param {any} publicKey the gate's public key (signing.js gatePublicKey)
 */
export async function claimTownWatch({ db, nowS, subtle }, player, _env, { receipts, sea } = {}, publicKey) {
  if (accountKind(player) !== 'linked') return { error: 'towns-need-account' };
  if (!Array.isArray(receipts) || receipts.length < 1 || receipts.length > TOWN_WATCH_CLAIM_MAX) return { error: 'bad-watch' };
  const seaAt = seaIndices(sea, receipts.length);
  if (!seaAt) return { error: 'bad-watch' };
  if (!publicKey) return { error: 'no-gate-key' };
  /** @type {Record<string, number>} */
  const why = {};
  const tally = (/** @type {string} */ w) => { why[w] = (why[w] ?? 0) + 1; };
  if (!witnessOf(player, nowS)) return { ok: true, counted: 0, sea: 0, why: { young: receipts.length }, full: [] };
  const today = utcDay(nowS);
  /** @type {Array<{ at: number, c: any, day: number, ref: string }>} */
  const ticks = [];
  for (const [at, r] of receipts.entries()) {
    const v = /** @type {any} */ (await verifyWatchReceipt(r, publicKey, { subtle, nowS }));
    if (!v.ok) { tally(v.why ?? 'bad'); continue; }
    const c = v.claims;
    if (c.s !== player.id) { tally('not-yours'); continue; }
    // AUDIT TOWN-ECON 2 SVC-9: a tick the relay minted a moment past the service's midnight (its clock the few seconds
    // ahead SKEW_S allows) counts on today
    const day = Math.min(utcDay(c.i), today);
    if (today - day >= TOWN_ECON_DAYS) { tally('old'); continue; }
    ticks.push({ at, c, day, ref: `${c.s}:${c.c}:${c.i}` });
  }
  const full = new Set();
  if (!ticks.length) return { ok: true, counted: 0, sea: 0, why, full: [] };
  // the towns at and beside every tick's pixel, the account's counts on the ticks' days, and the ticks seen - three reads
  const boxes = ticks.map(() => '(px BETWEEN ? AND ? AND py BETWEEN ? AND ?)').join(' OR ');
  const boxBinds = ticks.flatMap(({ c }) => [c.x - TOWN_SEA_REACH_PX, c.x + TOWN_SEA_REACH_PX, c.y - TOWN_SEA_REACH_PX, c.y + TOWN_SEA_REACH_PX]);
  const refs = ticks.flatMap(({ ref, at }) => [ref, ...(seaAt.has(at) ? [`${ref}:sea`] : [])]);
  const [near, mine, seenRows] = await db.batch([
    db.prepare(`SELECT map, px, py FROM town_econ_towns WHERE ${boxes}`).bind(...boxBinds),
    db.prepare('SELECT map, day, src, n FROM town_econ_acts WHERE account = ?1 AND day >= ?2').bind(player.id, Math.min(...ticks.map((k) => k.day))),
    db.prepare(`SELECT ref FROM town_econ_seen WHERE ref IN (${refs.map(() => '?').join(', ')})`).bind(...refs),
  ]);
  const townRows = (near?.results ?? []).map((/** @type {any} */ r) => ({ map: Number(r.map), px: Number(r.px), py: Number(r.py) }));
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const r of mine?.results ?? []) counts.set(`${Number(r.map)}:${Number(r.day)}:${r.src}`, Number(r.n));
  const seen = new Set((seenRows?.results ?? []).map((/** @type {any} */ r) => String(r.ref)));
  const steps = [];
  /** @type {Array<'watch'|'sea'>} each act's source, three statements an act */
  const acts = [];
  const act = (/** @type {'watch'|'sea'} */ src, /** @type {number} */ map, /** @type {number} */ day, /** @type {string} */ ref, /** @type {any} */ c) => {
    const k = `${map}:${day}:${src}`;
    if (seen.has(ref)) { tally('capped'); return; }   // seen before
    if ((counts.get(k) ?? 0) >= TOWN_ECON_CAPS[src]) {
      tally('capped');
      if (src === 'watch' && day === today && c.x != null) full.add(`${c.x},${c.y}`);
      return;
    }
    counts.set(k, (counts.get(k) ?? 0) + 1);
    seen.add(ref);
    steps.push(
      db.prepare('INSERT OR IGNORE INTO town_econ_seen (ref, day) VALUES (?1, ?2)').bind(ref, day),
      ...townActStatements(db, { account: player.id, map, day, src, guard: 'changes() > 0' }),
    );
    acts.push(src);
    if (src === 'watch' && day === today && counts.get(k) === TOWN_ECON_CAPS.watch) full.add(`${c.x},${c.y}`);
  };
  for (const { at, c, day, ref } of ticks) {
    const own = townRows.find((t) => t.px === c.x && t.py === c.y);
    if (!own) tally('no-town');
    else act('watch', own.map, day, ref, c);
    if (!seaAt.has(at)) continue;
    // SEA-TRADE: the port's town - the tick's own pixel's first, else the nearest beside it (the lowest map id on a tie)
    const port = own ?? townRows.map((t) => ({ ...t, d: Math.abs(t.px - c.x) + Math.abs(t.py - c.y) }))
      .filter((t) => Math.abs(t.px - c.x) <= TOWN_SEA_REACH_PX && Math.abs(t.py - c.y) <= TOWN_SEA_REACH_PX)
      .sort((a, b) => a.d - b.d || a.map - b.map)[0];
    if (!port) tally('no-port');
    else act('sea', port.map, day, `${ref}:sea`, { x: null, y: null });
  }
  let counted = 0, seaCounted = 0;
  if (steps.length) {
    const res = await db.batch(steps);
    for (const [k, src] of acts.entries()) {
      if (!(Number(res[k * 3 + 1]?.meta?.changes ?? 0) > 0)) { tally('capped'); continue; }   // a racing claim's
      if (src === 'sea') seaCounted += 1;
      else counted += 1;
    }
  }
  return { ok: true, counted, sea: seaCounted, why, full: [...full] };
}

/** @type {{ at: number, towns: Array<[number, number]> } | null} */
let _kept = null;
/** The clock's last keeping of the shares in this isolate (keepTownShares) - a fresh row asks the database nothing. */
let _keptAt = -Infinity;
/** Tests stand a fresh service; the isolate's kept answer goes with the old one. */
export const _resetTownEconForTests = () => { _kept = null; _keptAt = -Infinity; };
/** AUDIT TOWN-ECON 2 SVC-3: how long an isolate holds the kept answer before it reads the kept row again. */
export const TOWN_ECON_ISOLATE_S = 60;

/** THE TOWNS' SHARES COUNTED, by the law over the days kept (townEconLaw.js townActivity, townPlayersShare): every town
 *  whose share is TOWN_ECON_SHARE_LEAST or more, one decimal, by map id. @param {any} db @param {number} nowS */
export async function countTownShares(db, nowS) {
  const today = utcDay(nowS);
  const { results: rows = [] } = await db.prepare('SELECT map, day, src, n FROM town_econ_days WHERE day > ?1 AND day <= ?2')
    .bind(today - TOWN_ECON_DAYS, today).all();
  /** @type {Map<number, any[]>} */
  const byTown = new Map();
  for (const r of rows) {
    const m = Number(r.map);
    if (!byTown.has(m)) byTown.set(m, []);
    byTown.get(m)?.push(r);
  }
  /** @type {Array<[number, number]>} */
  const towns = [];
  for (const [m, rs] of byTown) {
    const share = townShareShown(townPlayersShare(townActivity(rs, today)));
    if (share >= TOWN_ECON_SHARE_LEAST) towns.push([m, share]);
  }
  return towns.sort((a, b) => a[0] - b[0]);
}

/** AUDIT TOWN-ECON 2 SVC-3: THE CLOCK KEEPS THE SHARES (cron.js MINUTE_JOBS `town-shares`) - counted once for the whole
 *  service each TOWN_ECON_KEPT_S into the one row every isolate reads (SEAT-FACTS' shape, `town_econ_kept`), where every
 *  isolate read every town's days. Answers the towns kept, or 0 where the row is fresh. @param {any} db @param {number} nowS */
export async function keepTownShares(db, nowS) {
  if (nowS - _keptAt < TOWN_ECON_KEPT_S) return 0;   // kept here a moment ago: the quiet world's minute asks nothing (AUDIT SCALE D7)
  const row = await db.prepare('SELECT at FROM town_econ_kept WHERE id = 1').first();
  if (row && nowS - Number(row.at) < TOWN_ECON_KEPT_S) { _keptAt = Number(row.at); return 0; }
  const towns = await countTownShares(db, nowS);
  await db.prepare('INSERT INTO town_econ_kept (id, at, towns) VALUES (1, ?1, ?2) ON CONFLICT (id) DO UPDATE SET at = excluded.at, towns = excluded.towns')
    .bind(nowS, JSON.stringify(towns)).run();
  _keptAt = nowS;
  return towns.length;
}

/**
 * THE TOWNS' SHARES (POST /v1/towns/econ): `{ towns: [[map, share], ...] }` - every town whose players' share is
 * TOWN_ECON_SHARE_LEAST or more today, one decimal. AUDIT TOWN-ECON 2 SVC-3: read off the row the clock keeps
 * (keepTownShares), held by the isolate TOWN_ECON_ISOLATE_S; counted here only where no row is kept yet (a service the
 * clock has not run on).
 * @param {{ db: any, nowS: number }} ctx
 */
export async function townsEcon({ db, nowS }) {
  if (_kept && nowS - _kept.at < TOWN_ECON_ISOLATE_S) return { ok: true, towns: _kept.towns };
  const row = await db.prepare('SELECT towns FROM town_econ_kept WHERE id = 1').first();
  let towns = null;
  try { towns = row ? JSON.parse(String(row.towns)) : null; } catch { towns = null; }
  if (!Array.isArray(towns)) towns = await countTownShares(db, nowS);
  _kept = { at: nowS, towns };
  return { ok: true, towns };
}

/** The hourly sweep's SQL: a town's acts and days past the days kept (cron.js HOUR_JOBS, from townEconKeptFrom), and
 *  AUDIT TOWN-ECON 2 SVC-5 the ticks seen past a receipt's life (from townEconSeenFrom) - a tick seen is refused by its
 *  own expiry after that. */
export const TOWN_ECON_SWEEPS = Object.freeze([
  'DELETE FROM town_econ_days WHERE rowid IN (SELECT rowid FROM town_econ_days WHERE day < ?1 LIMIT ?2)',
  'DELETE FROM town_econ_acts WHERE rowid IN (SELECT rowid FROM town_econ_acts WHERE day < ?1 LIMIT ?2)',
]);
export const TOWN_ECON_SEEN_SWEEP = 'DELETE FROM town_econ_seen WHERE rowid IN (SELECT rowid FROM town_econ_seen WHERE day < ?1 LIMIT ?2)';
/** The first day the sweep keeps. @param {number} nowS */
export const townEconKeptFrom = (nowS) => utcDay(nowS) - TOWN_ECON_DAYS + 1;
/** AUDIT TOWN-ECON 2 SVC-5: the first day of seen ticks kept - a receipt's life (WATCH_RECEIPT_TTL_S) and a day's skew.
 *  @param {number} nowS */
export const townEconSeenFrom = (nowS) => utcDay(nowS) - Math.ceil(WATCH_RECEIPT_TTL_S / 86_400) - 1;
