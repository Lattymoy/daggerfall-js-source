// @ts-check
// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK) - THE LAUREL'S
// READS IN THE WORLD: the boards the season window shows a standing off. The law is systems/seasonBook.js; the window
// ui/enhanced/enhancedSeason.js; this is the host's half, reaching the world only through `world`, so a test drives it
// headless.
//
// AUDIT SEASON-BOOK R1 (bible/01-Overview/audits/Audit-Season-Book.md): A STANDING CANNOT MOVE WHILE THE GAME IS PAUSED, so
// a board is asked when the window OPENS (`opening` - its first read), at most once a minute however often it is opened,
// and never again while it stays open; never on a hidden page, while the account service says it is overloaded
// (BUSY-GATE's hold), for a guest or for no one signed in. The window reads the kept answers every second; the service
// is not asked every second. R2: every answer is the account's that was signed in when it was asked (`me()`), and a
// different account's is dropped. R3/L9: every answer says its season; one of another season is no standing, and the
// season turning asks again. R5/S1: the arena's board is a read like the others - asking, an answer, or a failure.
//
// `world()` answers what the host already holds, read at each call (HOST-SPLIT: one getter, not a dep a board):
//   arena   the arena online (scenes/arena/arenaOnline.js) or null - its own board, its `fetchBoard` and `refresh`
//   eg      the Elite Breach's account door (net/accountClient.js accountEg) - the Spire's boards; its `me()` and
//           `guest()` are the session's (every door reads the one stored session)
//   iliac   Iliac Hand's (accountIliac), gambit The King's Gambit's (accountGambit) - each `board()` `call`'s `{ ok, data }`
//   ledger  the captain's ledger (systems/naval/captainLedger.js) - `season()` its season's figures
// The getter is called under a try: the pause door stands before the world host's last declarations (AUDIT TIMERS1 D6),
// and one not declared yet is none.
import { busyUntil } from '../net/accountClient.js';
import { arenaSeasonOf } from '../net/arena/arenaLaw.js';

/** A board asked no oftener than this, ms - and only at a window's opening. */
export const SEASON_BOARD_FRESH_MS = 60_000;
/** The boards the window asks of the service, by the window's row - and the `world()` door each is asked through. */
export const SEASON_BOARDS = Object.freeze({ spire: 'eg', iliac: 'iliac', gambit: 'gambit' });
/** An answer that says no one is signed in: its read is dropped, never kept as a standing. */
const SIGNED_OUT = new Set(['no-session', 'auth']);

/** The season an answer is of - the arena's board says it as a number, the account's others as `{ n }` - or null. */
export const boardSeasonOf = (/** @type {any} */ data) => {
  const s = data?.season, n = typeof s === 'number' ? s : s?.n;
  return Number.isSafeInteger(n) ? n : null;
};

/**
 * @param {() => any} world
 * @param {{ now?: () => number, hidden?: () => boolean, busy?: () => boolean }} [o] `now` a monotonic clock, ms (the
 *   minute between asks); `hidden` whether the page is hidden; `busy` whether the account service has asked to be let
 *   be (BUSY-GATE's hold - net/accountClient.js busyUntil, on the machine's clock)
 */
export function createSeasonBook(world, {
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  hidden = () => !!globalThis.document?.hidden,
  busy = () => busyUntil() > Date.now(),
} = {}) {
  const held = () => { try { return world?.() ?? null; } catch { return null; } };
  /** @type {Record<string, { state: 'asking' | 'ok' | 'failed', data: any, at: number, out: boolean, askedFor: number|null }>} */
  let reads = {};
  let arena = { board: null, who: /** @type {string|null} */ (null), state: 'asking', at: -Infinity, out: false, askedFor: /** @type {number|null} */ (null) };
  let whose = /** @type {string|null|undefined} */ (undefined);
  const fresh = () => ({ state: /** @type {'asking'} */ ('asking'), data: null, at: -Infinity, out: false, askedFor: null });
  /** Whether a read is asked now: never while one is out; at once for a season it was never asked for (a new read, or
   *  the season turned); else only at an opening, a minute on. */
  const wants = (/** @type {any} */ r, /** @type {number} */ season, /** @type {boolean} */ opening) =>
    !r.out && (r.askedFor !== season || (opening && now() - r.at >= SEASON_BOARD_FRESH_MS));
  const quiet = () => { try { return !!hidden() || !!busy(); } catch { return false; } };
  function ask(/** @type {any} */ w, /** @type {string} */ id, /** @type {number} */ season) {
    const r = reads[id] ?? (reads[id] = fresh());
    r.out = true;
    r.at = now();
    r.askedFor = season;
    let p;
    try { p = w?.[SEASON_BOARDS[id]]?.board?.(); } catch { p = null; }
    // an answer kept until a newer one comes - a failed ask keeps the last good one; no session drops it
    Promise.resolve(p).then((a) => {
      if (a?.ok && a.data) { r.data = a.data; r.state = 'ok'; }
      else if (SIGNED_OUT.has(a?.error)) { r.data = null; r.state = 'failed'; }
      else if (!r.data) r.state = 'failed';
    }, () => { if (!r.data) r.state = 'failed'; }).finally(() => { r.out = false; });
  }
  /** A read as the window shows it: its answer while it is this season's, else asking (one is out, or none was ever
   *  answered) or failed. */
  const view = (/** @type {any} */ r, /** @type {number} */ season) => {
    const s = boardSeasonOf(r.data);
    if (r.data && (s == null || s === season)) return { state: 'ok', data: r.data };
    return { state: r.out || r.state === 'asking' ? 'asking' : 'failed', data: null };
  };
  function arenaView(/** @type {any} */ a, /** @type {string} */ who, /** @type {number} */ season, /** @type {boolean} */ may, /** @type {boolean} */ opening) {
    const board = a.board?.() ?? null;
    if (board && board !== arena.board) { arena.board = board; arena.who = who; }   // R2: a board is the account's it landed under
    const s = boardSeasonOf(board);
    const mine = board && arena.who === who && (s == null || s === season);
    if (may && !arena.out && (wants(arena, season, opening) || (board && !mine))) {   // a board not this account's: the arena asked again (it keeps its own 20 s)
      arena.out = true;
      arena.at = now();
      arena.askedFor = season;
      let p;
      try { if (board) a.refresh?.(); p = board ? null : a.fetchBoard?.(); } catch { p = null; }
      Promise.resolve(p).then((b) => { if (b) arena.state = 'ok'; else if (!a.board?.()) arena.state = 'failed'; }, () => { arena.state = 'failed'; })
        .finally(() => { arena.out = false; });
    }
    if (mine) return { state: 'ok', data: board };
    return { state: arena.out || arena.state === 'asking' ? 'asking' : 'failed', data: null };
  }
  return {
    /** What the window reads (seasonBookModel's `boards`, `sea`, `signedIn`, `guest`). `opening` - the window's first read,
     *  which may ask a board (the pause face's test of whether to stand the laurel never does); `now` the relay's clock,
     *  ms (the realm's season a read must be of). */
    source({ opening = false, now: nowMs = Date.now() } = {}) {
      const w = held();
      const season = arenaSeasonOf(Math.floor(Number(nowMs) / 1000) || 0);
      let who = null, guest = false;
      try { who = w?.eg?.me?.() ?? null; guest = !!w?.eg?.guest?.(); } catch { who = null; }
      // R2: another account's reads go with it - and the arena's board stays bound to the account it landed under, so
      // the board the arena still holds is never taken for the new account's
      if (who !== whose) { whose = who; reads = {}; arena = { ...fresh(), board: arena.board, who: arena.who }; }
      let sea = null;
      try { sea = w?.ledger?.season?.() ?? null; } catch { sea = null; }
      if (!who || guest) return { signedIn: !!who, guest, boards: {}, sea };   // R4: nothing to ask, and nothing asked
      const asking = !quiet();
      const boards = {};
      for (const id of Object.keys(SEASON_BOARDS)) {
        const r = reads[id] ?? (reads[id] = fresh());
        if (asking && wants(r, season, opening)) ask(w, id, season);
        boards[id] = view(r, season);
      }
      let live = false;
      try { live = !!w?.arena?.live?.(); if (live) boards.arena = arenaView(w.arena, who, season, asking, opening); } catch { live = false; }
      if (!live) boards.arena = null;   // R7: an arena not live reads nothing - the row says none
      return { signedIn: true, guest: false, boards, sea };
    },
  };
}
