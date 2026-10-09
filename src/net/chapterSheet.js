// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP3c (2026-10-08, Mac: "Continue", on "Keep going with the arc/
// slices") — THE CHAPTER SHEET, HELD BY THE PLAYING TAB: the service's
// `/v1/chapters/list` (every chapter's Strength and band, CHAP3b) read
// once a while, and the hall the player stands in priced by its chapter's
// band (bible/11-Multiplayer/Chapters-Arc.md 5.2, 5.3).
//
// SYNCHRONOUS TO ITS READERS. A guild's service window prices as it opens;
// it asks `strengthOf(faction, region)` and is answered from the sheet as
// it was last read - null for a chapter the sheet does not name, so the
// hall is DFU's own (Steady). A read older than SHEET_KEPT_MS asks the
// service again in the background; one read at a time; a refusal that is
// the account's (the Chapters shut to it) stops the asking for the page.
// Online only: offline there is no sheet, and every hall is DFU's.
//
// CHAP5a (2026-10-09, Mac: "Continue"; Chapters-Arc 9): and each chapter's seats' holders, kept as the roll reads them
// (npcChapterLaw.js chapterRollSeatsOf) - `chapterOf(faction, region)` the hall's roll's read.
//
// CHAP6c (2026-10-09, Mac: "continue"; Chapters-Arc 7): and each chapter's Season - its event, its doctrine, its halls
// shut (npcChapterLaw.js chapterSeasonOf) - for the roll's lines and the town's talk.
// ═══════════════════════════════════════════════════════════════════

import { chapterRollSeatsOf, chapterSeasonOf } from './npcChapterLaw.js';   // CHAP5a: the seats as the roll reads them; CHAP6c: the Season's event

/** How long a read of the sheet stands before the next is asked (the seats' list's own beat). */
export const SHEET_KEPT_MS = 10 * 60_000;
/** The refusals that end the asking for the page - the Chapters are not this account's. */
export const SHEET_STOPS = Object.freeze(['chapters-closed', 'no-session', 'auth']);

/**
 * THE SHEET. `refresh()` asks the service where the last read is stale (answers whether it asked); `strengthOf(faction,
 * region)` the chapter's Strength as last read, or null; `chapterOf(faction, region)` its `{ strength, seats }` (CHAP5a).
 * @param {{ door: { list: () => Promise<any> }, nowMs?: () => number }} o
 */
export function createChapterSheet({ door, nowMs = () => Date.now() }) {
  /** @type {Map<string, { strength: number, seats: { seat: string, name: string }[], season: ReturnType<typeof chapterSeasonOf> }>} */
  let strengths = new Map();
  let readAt = -Infinity;
  let busy = false;
  let stopped = false;
  const refresh = () => {
    if (stopped || busy || nowMs() - readAt < SHEET_KEPT_MS) return false;
    busy = true;
    readAt = nowMs();
    Promise.resolve().then(() => door.list()).then((r) => {
      if (r?.ok && Array.isArray(r.data?.chapters)) {
        /** @type {Map<string, { strength: number, seats: { seat: string, name: string }[], season: ReturnType<typeof chapterSeasonOf> }>} */
        const next = new Map();
        for (const c of r.data.chapters) if (Number.isSafeInteger(c?.f) && Number.isSafeInteger(c?.region) && Number.isFinite(c?.strength)) next.set(`${c.f}|${c.region}`, { strength: c.strength, seats: chapterRollSeatsOf(c.seats), season: chapterSeasonOf(c) });
        strengths = next;
      } else if (SHEET_STOPS.includes(r?.error)) {
        // AUDIT CHAP3 C2: and what it held forgotten - the Chapters shut to the account, every hall is DFU's own again
        stopped = true;
        strengths = new Map();
      }
    }, () => { /* a read that failed is asked again at the next beat */ }).finally(() => { busy = false; });
    return true;
  };
  return {
    refresh,
    /** The chapter's Strength as the sheet last said it, or null - and a stale sheet asked again behind it. */
    strengthOf(/** @type {unknown} */ faction, /** @type {unknown} */ region) {
      refresh();
      const s = strengths.get(`${faction}|${region}`);
      return s === undefined ? null : s.strength;
    },
    /** CHAP5a: the chapter as the sheet last said it - `{ strength, seats }`, a copy - or null; asked as strengthOf is.
     *  CHAP6c: and its Season, chapterSeasonOf's fields beside them. */
    chapterOf(/** @type {unknown} */ faction, /** @type {unknown} */ region) {
      refresh();
      const s = strengths.get(`${faction}|${region}`);
      return s === undefined ? null : { strength: s.strength, seats: s.seats.map((x) => ({ ...x })), ...s.season, sides: s.season.sides ? [...s.season.sides] : null };
    },
    get stopped() { return stopped; },
  };
}
