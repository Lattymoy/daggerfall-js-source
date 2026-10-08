// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP2a (2026-10-07, Mac: "Do it") — THE CHAPTERS' HALLS, AS THE SERVICE
// KNOWS THEM: which of Daggerfall's guilds keeps a hall in which town, and
// so which chapters a region has. bible/11-Multiplayer/Chapters-Arc.md
// section 4; the law is src/net/npcChapterLaw.js.
//
// ═══ WITNESSED, NEVER HELD ═════════════════════════════════════════
//
// The servers never hold game data (Seats-Arc law 5), so a town's halls
// are learnt as a seat is (Seats-Arc 3.2): a registered account a week
// old, standing in the town, reports what its client read off the town's
// own buildings - one canonical answer a town (`[mapId, region,
// factions]`, npcChapterLaw.js hallReportText, keyed `1:<mapId>` by the
// hall law's version) - and the first answer three accounts give is the
// town's (nodeLaw.js witnessedFact). An account's first answer stands
// (INSERT OR IGNORE). A CHAPTER is a guild faction a confirmed town of
// the region names.
//
// AUDIT CHAP2 E1/S4/R4: AND THE SEATS' MODERATION WITH IT. CHAP2a took the
// seats' three and their age but not what keeps a liar out: an account
// whose answers three times in a week stand alone against a confirmed
// town's is IGNORED for a week (townSeatLaw.js seatIgnoredAccounts, read
// over the region's reports); a developer reads a region's AUDIT LIST
// (listHalls - every town confirmed by exactly three, and every disputed
// one) and STRIKES a false town (strikeHall): its reports go, and it is
// never witnessed again.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { accountKind, overRate } from './accounts.js';
import { isDeveloper } from './titles.js';
import { witnessOf } from './townSeats.js';
import { chaptersOpenFor } from './npcRoll.js';
import { witnessedFact, factConfirmed, regionOk } from '../../src/net/nodeLaw.js';
import { seatIgnoredAccounts, SEAT_WITNESSES_AUDIT } from '../../src/net/townSeatLaw.js';
import {
  HALL_WITNESS_KIND, HALL_WITNESS_HOUR, HALL_REPORT_V, hallReportOf, hallReportText, parseHallReport, hallWitnessKey,
} from '../../src/net/npcChapterLaw.js';

/** How long an isolate keeps a region's chapters before asking again - the board's reads are many, the halls' change
 *  rare (STORM-SHED's lesson: a read that writes nothing need not ask the database every time). */
export const CHAPTERS_KEPT_MS = 60_000;
/** @type {Map<number, { at: number, chapters: number[] }>} */
const _kept = new Map();
/** Tests and the witness's own write forget what the isolate kept. */
export const forgetChapters = () => _kept.clear();

/** A region's towns' reports at this version: each town read over ALL its reports (a town one early report named for
 *  this region and three confirmed for another is the other's, as a pixel is - professions.js regionGround, AUDIT 29
 *  A11). */
async function regionRows(/** @type {any} */ db, /** @type {number} */ region) {
  const { results = [] } = await db.prepare(`SELECT key, account, report, at FROM world_witness WHERE kind = '${HALL_WITNESS_KIND}'
    AND key IN (SELECT key FROM world_witness WHERE kind = '${HALL_WITNESS_KIND}' AND region = ? AND key LIKE ?)`).bind(region, `${HALL_REPORT_V}:%`).all();
  return results.map((/** @type {any} */ r) => ({ key: String(r.key), account: String(r.account), report: String(r.report), at: Number(r.at) }));
}

/**
 * EVERY TOWN OF A REGION AS THE WITNESSES SAY IT IS - the seats' law (townSeats.js seatFacts) over the halls: each town's
 * fact with the ignored accounts left out, its witnesses, and whether the audit names it (confirmed by exactly three, or
 * disputed). Pure over the rows.
 * @param {{ key: string, account: string, report: string, at: number }[]} rows @param {number} nowS
 */
export function hallFacts(rows, nowS) {
  /** @type {Map<string, typeof rows>} */
  const byKey = new Map();
  for (const r of rows) { const a = byKey.get(r.key) ?? []; a.push(r); byKey.set(r.key, a); }
  /** @type {Map<string, string>} */
  const confirmed = new Map();
  for (const [k, list] of byKey) {
    const f = /** @type {any} */ (witnessedFact(list, parseHallReport));
    if (factConfirmed(f)) confirmed.set(k, hallReportText(f));
  }
  const ignored = seatIgnoredAccounts(rows, confirmed, nowS);
  const towns = [];
  for (const [k, list] of byKey) {
    const kept = list.filter((r) => !ignored.has(r.account));
    const f = /** @type {any} */ (witnessedFact(kept, parseHallReport));
    if (f.state === 'none') continue;
    const agreeing = f.factions ? kept.filter((r) => r.report === hallReportText(f)).length : 0;
    towns.push({ key: k, fact: f, witnesses: new Set(kept.map((r) => r.account)).size,
      audit: (factConfirmed(f) && agreeing === SEAT_WITNESSES_AUDIT) || f.state === 'disputed' });
  }
  return { towns, ignored };
}

/**
 * A HALL WITNESSED: `{ hall: { key, region, factions } }` - the town the caller's client stands in, read off its own
 * buildings. Answers `{ ok, counted }` (`why` when not counted: 'young', an account under a week registered; 'ignored',
 * an account whose answers stand alone against confirmed towns) or `{ error }`: 'halls-need-account' (a guest),
 * 'chapters-closed', 'bad-hall', 'halls-rate', 'hall-struck' (a town a developer struck).
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env @param {any} body
 */
export async function witnessHall({ db, nowS }, player, env, { hall } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'halls-need-account' };
  if (!chaptersOpenFor(player, env)) return { error: 'chapters-closed' };
  const h = hallReportOf(hall);
  if (!h) return { error: 'bad-hall' };
  if (await overRate({ db, nowS }, `hall-witness:${player.id}`, HALL_WITNESS_HOUR, 3600)) return { error: 'halls-rate' };
  if (await db.prepare('SELECT 1 FROM npc_hall_strikes WHERE map_id = ?').bind(h.key).first()) return { error: 'hall-struck' };
  if (!witnessOf(player, nowS)) return { ok: true, counted: false, why: 'young' };
  if (hallFacts(await regionRows(db, h.region), nowS).ignored.has(player.id)) return { ok: true, counted: false, why: 'ignored' };
  const r = await db.prepare(`INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES ('${HALL_WITNESS_KIND}', ?, ?, ?, ?, ?)`)
    .bind(hallWitnessKey(h.key), player.id, hallReportText(h), h.region, nowS).run();
  if (r?.meta?.changes) _kept.delete(h.region);   // AUDIT CHAP2 E9: a report that changed nothing is no news
  return { ok: true, counted: true };
}

/**
 * A REGION'S CHAPTERS: every guild faction a confirmed town of the region names, ascending (hallFacts: the ignored
 * accounts left out). Kept by the isolate CHAPTERS_KEPT_MS.
 * @param {any} db @param {number} region @param {number} [nowMs]
 */
export async function regionChapters(db, region, nowMs = Date.now()) {
  const kept = _kept.get(region);
  if (kept && nowMs - kept.at < CHAPTERS_KEPT_MS) return kept.chapters;
  const factions = new Set();
  for (const t of hallFacts(await regionRows(db, region), Math.floor(nowMs / 1000)).towns) {
    if (factConfirmed(t.fact) && t.fact.region === region) for (const id of t.fact.factions) factions.add(id);
  }
  const chapters = [...factions].sort((a, b) => a - b);
  _kept.set(region, { at: nowMs, chapters });
  return chapters;
}

/**
 * THE HALLS' AUDIT LIST, a developer's (the seats' listSeats for a developer): `{ region }` - every town of the region the
 * witnesses name, its state, its factions and witnesses, and whether the audit names it; and how many accounts its
 * reports leave out. `{ error }`: 'not-developer', 'bad-region'.
 * @param {{ db: any, nowS: number }} ctx @param {any} dev @param {any} env @param {any} body
 */
export async function listHalls({ db, nowS }, dev, env, { region } = {}) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (!regionOk(region)) return { error: 'bad-region' };
  const { towns, ignored } = hallFacts(await regionRows(db, region), nowS);
  return {
    region,
    towns: towns.map((t) => ({ key: Number(t.key.slice(t.key.indexOf(':') + 1)), state: t.fact.state, region: t.fact.region ?? null,
      factions: t.fact.factions ?? [], witnesses: t.witnesses, audit: t.audit })).sort((a, b) => a.key - b.key),
    ignored: ignored.size,
  };
}

/**
 * THE STRIKE (the seats' strikeSeat, SEAT0 3.2), a developer's alone: `{ key }` - a town's map id. Its reports go, the
 * strike is recorded with who made it, and the town is never witnessed again. Answers `{ ok, key, reports }` or
 * `{ error }`: 'not-developer', 'bad-hall'.
 * @param {{ db: any, nowS: number }} ctx @param {any} dev @param {any} env @param {any} body
 */
export async function strikeHall({ db, nowS }, dev, env, { key } = {}) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (!Number.isSafeInteger(key) || key < 0 || key > 0xffffffff) return { error: 'bad-hall' };
  const [, gone] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO npc_hall_strikes (map_id, by, at) VALUES (?, ?, ?)').bind(key, dev.handle ?? null, nowS),
    db.prepare(`DELETE FROM world_witness WHERE kind = '${HALL_WITNESS_KIND}' AND key LIKE ?`).bind(`%:${key}`),
  ]);
  forgetChapters();
  return { ok: true, key, reports: Number(gone?.meta?.changes ?? 0) };
}
