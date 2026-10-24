// ═══════════════════════════════════════════════════════════════════
// FORAGE4 (2026-09-28, Mac: "Continue! Remember, this is your baby"):
// FORAGING'S ONLINE WAIT, COMPOSED FOR A HOST - bible/06-Systems/
// Foraging.md 13.1. Online the shared clock is nobody's to move
// (WORLD5), so Quest Actions Extension's `raise time by H:MM` is a wait
// the player sits through instead: the wait page (ui/waitWindow.js -
// once C&C's hunt page, whose busy page it kept when the text hunt was
// removed, 2026-10-04; `interruptWhen` a foe near), at WAIT_PER_HOUR
// real seconds a game hour (waitRealSeconds).
//
//   entity         - the player; `foragingWait` on it is the wait's
//                    record - `{ seconds, label, held }` - so the
//                    seconds left and the boxes held behind them ride
//                    the save, and a reload reopens the page with them
//                    (systems/save/save.js ENTITY_FIELDS)
//   showOverlay(w) - the slot; overlayActive() - whether a window
//                    holds it (the tool's result box, the pack)
//   enemiesNear()  - the rest test, the host's (duel included)
//   online()       - the shared clock is on
//   revive(keep)   - a held box the save kept, shown again (AUDIT 28 F6)
//
// THE ORDER: the tool's result box and the pack close first - the page
// opens only when the slot is free; then the page takes the slot; the
// quest's own boxes (a bonus's line) are held behind it and shown, in
// order, once it has ended AND left the slot (`holds` / `hold` - AUDIT
// 28 H6: released inside the page's own last tick, each box went under
// a page still in the slot, and the finished page came back over it). A
// second wait joins the first (`extend`) - the SUM, never cut (AUDIT 28
// F1: twenty tool uses queued behind one page cost sixty-four seconds).
// A foe near ends the page with what is left forgiven; so does a window
// that takes the slot from under it (the page's dispose). The quest
// machine pauses while the page holds the slot, as it does under every
// window (the host's frame ticks it only with the slot free).
// ═══════════════════════════════════════════════════════════════════

import { WaitWindow } from '../ui/waitWindow.js';

/** The wait's pace: this many REAL seconds a game hour - roughly ten times the rest window's REST_WAIT_PER_HOUR
 *  (0.75): a rest is a skip, a wait is sat through. (C&C's hunt's HUNT_WAIT_PER_HOUR, moved here with the hunt's
 *  removal - this page is its one reader.) */
export const WAIT_PER_HOUR = 8;
/** A wait of `minutes` game minutes, in real seconds (to the hundredth). */
export const waitRealSeconds = (minutes) => Math.round((minutes / 60) * WAIT_PER_HOUR * 100) / 100;

/** The page's line: the quest's own DisplayName, the author's words ("Chop and Gather Wood..."). */
export const waitLine = (label) => `${label || 'Time passes'}...`;
/** The longest wait a SAVED record may hold: eight game hours, the build's Mining quadruple (Q7) - a save edited to a
 *  day of waiting is cut to this, never obeyed. A wait built in play is the sum of what the quests raised, uncut. */
export const FORAGING_WAIT_MAX_SECONDS = waitRealSeconds(8 * 60);
/** The most boxes a saved record keeps behind its wait. */
export const FORAGING_WAIT_HELD_MAX = 16;
/** A saved record, made safe: `{ seconds, label, held }` - seconds finite in [0, the max], a short string label, the
 *  held boxes plain objects (at most FORAGING_WAIT_HELD_MAX) - or null when it holds neither time nor a box. */
export function saneWait(r) {
  if (!r || typeof r !== 'object') return null;
  const seconds = Number.isFinite(r.seconds) && r.seconds > 0 ? Math.min(FORAGING_WAIT_MAX_SECONDS, r.seconds) : 0;
  const held = (Array.isArray(r.held) ? r.held : []).filter((k) => k && typeof k === 'object' && !Array.isArray(k)).slice(0, FORAGING_WAIT_HELD_MAX);
  if (seconds <= 0 && !held.length) return null;
  return { seconds, label: typeof r.label === 'string' ? r.label.slice(0, 60) : null, held };
}

export function createForagingWait({ entity, showOverlay = null, overlayActive = () => false, enemiesNear = () => false, online = () => true, revive = null } = {}) {
  let _win = null;
  /** the boxes held behind the wait: { fn, keep } - `keep` the save's copy of it, when it has one */
  let _held = [];
  /** the record this wait last wrote - any other on the entity came from a load, and is read afresh */
  let _ours = null;
  /** counts the loads: a page opened before one never writes over the record it brought */
  let _gen = 0;

  const own = (r) => { if (entity) entity.foragingWait = r; _ours = r; return r; };
  /** The record - a loaded one made safe ONCE and its boxes taken up (AUDIT 28 F1: a live wait is never re-cut). */
  const record = () => {
    if (!entity) return null;
    const r = entity.foragingWait ?? null;
    if (r === _ours) return r;
    // a load (or a new game) put this record here: what this page held belongs to the page before it
    _held = [];
    _gen++;
    const sane = saneWait(r);
    own(sane);
    for (const keep of sane?.held ?? []) _held.push({ fn: () => revive?.(keep), keep });
    return sane;
  };
  const pending = () => (record()?.seconds ?? 0) > 0;
  /** The record written back: its seconds and the boxes still held - gone when it holds neither. */
  const write = (seconds) => {
    const r = record();
    const held = _held.map((h) => h.keep).filter(Boolean);
    if (seconds <= 0 && !held.length) { own(null); return null; }
    return own({ seconds: Math.max(0, seconds), label: r?.label ?? null, held });
  };

  /** set while release() runs: a box it shows is not held again (CHOP-WAIT) */
  let _releasing = false;
  /** The held boxes, in order - only once the page has ended and the slot is free.
   *  CHOP-WAIT (FIELD BUGS 2026-09-30, "Hardlocked in woodcutting animation after game Crash"): a box the release runs
   *  is SHOWN, and one release runs only the boxes held when it began. A held box is the host's showQuestBox, whose
   *  first question is `holds()` - true while any box is still held - so with two boxes behind the page (two Wood-Axe
   *  uses, each quest's find) the first went back behind the second and the second behind the first, for ever, in one
   *  frame: the tab hung as the page ended. The record rides the save, so every login reopened the page and hung again
   *  when it ran out. A box that takes the slot still ends the release; the next waits for the slot, a frame later. */
  function release() {
    _releasing = true;
    try {
      for (let n = _held.length; n > 0 && _held.length && !pending() && !_win && !overlayActive(); n--) {
        const { fn } = _held.shift();
        write(0);
        try { fn(); } catch (e) { console.warn('[foragingWait] a held box threw', e); }
      }
    } finally { _releasing = false; }
  }

  /** The quest's `raise time by`, online: `gameSeconds` of the clock as a wait of real seconds, joined to any standing. */
  function add(gameSeconds, label = null) {
    if (!entity || !(gameSeconds > 0)) return 0;
    const real = waitRealSeconds(gameSeconds / 60);
    const r = record();
    if (r && r.seconds > 0) {
      _win?.extend(real);
      r.seconds += real;   // the sum, uncut
    } else {
      own({ seconds: real, label: label ?? null, held: r?.held ?? [] });
    }
    return real;
  }

  function open() {
    const r = record();
    const gen = _gen;
    _win = new WaitWindow({
      busy: waitLine(r.label), seconds: r.seconds, interruptWhen: () => !!enemiesNear(),
      onClosed: () => {
        _win = null;
        if (gen === _gen) write(0);   // done, or forgiven: a foe near, or the slot taken - the held boxes wait for the slot (tick)
      },
    });
    showOverlay?.(_win);
    return _win;
  }

  /** Every frame, in every mode: the page opens when the slot is free, its seconds left are written back for the save,
   *  and once it has ended and left the slot the boxes held behind it are shown. */
  function tick() {
    if (!entity) return null;
    if (!online()) {
      // the offline lane has no waits: a save made mid-wait online and loaded offline forgives what was left
      if (pending()) write(0);
      release();
      return null;
    }
    if (_win) {
      if (!_win.done && record()) record().seconds = _win.remaining;
      return _win;
    }
    if (pending()) return overlayActive() ? null : open();
    release();
    return null;
  }

  return {
    add, tick,
    /** Whether a quest box must wait: a wait stands, or is pending behind the slot, or boxes wait their turn - never the
     *  box the release is showing (CHOP-WAIT). */
    holds: () => !_releasing && (pending() || !!_win || _held.length > 0),
    /** A quest box held behind the wait, run in order when it ends; `keep` - its copy for the save (plain data). */
    hold(fn, keep = null) {
      if (typeof fn !== 'function') return;
      record();
      _held.push({ fn, keep: keep && typeof keep === 'object' ? keep : null });
      write(record()?.seconds ?? 0);
    },
    get window() { return _win; },
  };
}
