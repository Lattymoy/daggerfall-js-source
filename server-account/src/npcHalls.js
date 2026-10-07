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
// factions]`, npcChapterLaw.js hallReportText) - and the first answer
// three accounts give is the town's (nodeLaw.js witnessedFact). An
// account's first answer stands (INSERT OR IGNORE). A CHAPTER is a guild
// faction a confirmed town of the region names.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { accountKind, overRate } from './accounts.js';
import { witnessOf } from './townSeats.js';
import { chaptersOpenFor } from './npcRoll.js';
import { witnessedFact, factConfirmed } from '../../src/net/nodeLaw.js';
import { HALL_WITNESS_KIND, HALL_WITNESS_HOUR, hallReportOf, hallReportText, parseHallReport } from '../../src/net/npcChapterLaw.js';

/** How long an isolate keeps a region's chapters before asking again - the board's reads are many, the halls' change
 *  rare (STORM-SHED's lesson: a read that writes nothing need not ask the database every time). */
export const CHAPTERS_KEPT_MS = 60_000;
/** @type {Map<number, { at: number, chapters: number[] }>} */
const _kept = new Map();
/** Tests and the witness's own write forget what the isolate kept. */
export const forgetChapters = () => _kept.clear();

/**
 * A HALL WITNESSED: `{ hall: { key, region, factions } }` - the town the caller's client stands in, read off its own
 * buildings. Answers `{ ok, counted }` (`why` when not counted: 'young', an account under a week registered) or
 * `{ error }`: 'halls-need-account' (a guest), 'chapters-closed', 'bad-hall', 'halls-rate'.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env @param {any} body
 */
export async function witnessHall({ db, nowS }, player, env, { hall } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'halls-need-account' };
  if (!chaptersOpenFor(player, env)) return { error: 'chapters-closed' };
  const h = hallReportOf(hall);
  if (!h) return { error: 'bad-hall' };
  if (await overRate({ db, nowS }, `hall-witness:${player.id}`, HALL_WITNESS_HOUR, 3600)) return { error: 'halls-rate' };
  if (!witnessOf(player, nowS)) return { ok: true, counted: false, why: 'young' };
  await db.prepare(`INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES ('${HALL_WITNESS_KIND}', ?, ?, ?, ?, ?)`)
    .bind(String(h.key), player.id, hallReportText(h), h.region, nowS).run();
  _kept.delete(h.region);
  return { ok: true, counted: true };
}

/**
 * A REGION'S CHAPTERS: every guild faction a confirmed town of the region names, ascending - each town read over ALL its
 * reports (a town one early report named for this region and three confirmed for another is the other's, as a pixel is -
 * professions.js regionGround, AUDIT 29 A11). Kept by the isolate CHAPTERS_KEPT_MS.
 * @param {any} db @param {number} region @param {number} [nowMs]
 */
export async function regionChapters(db, region, nowMs = Date.now()) {
  const kept = _kept.get(region);
  if (kept && nowMs - kept.at < CHAPTERS_KEPT_MS) return kept.chapters;
  const { results = [] } = await db.prepare(`SELECT key, account, report, at FROM world_witness WHERE kind = '${HALL_WITNESS_KIND}'
    AND key IN (SELECT key FROM world_witness WHERE kind = '${HALL_WITNESS_KIND}' AND region = ?)`).bind(region).all();
  /** @type {Map<string, { account: string, report: string, at: number }[]>} */
  const byKey = new Map();
  for (const r of results) { const a = byKey.get(r.key) ?? []; a.push({ account: r.account, report: r.report, at: Number(r.at) }); byKey.set(r.key, a); }
  const factions = new Set();
  for (const rows of byKey.values()) {
    const f = /** @type {any} */ (witnessedFact(rows, parseHallReport));
    if (factConfirmed(f) && f.region === region) for (const id of f.factions) factions.add(id);
  }
  const chapters = [...factions].sort((a, b) => a - b);
  _kept.set(region, { at: nowMs, chapters });
  return chapters;
}
