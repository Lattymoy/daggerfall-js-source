// @ts-check
// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE ONE DOOR AN EVENT'S LINE GOES THROUGH, AND THE SEAT OF THE BOARD'S SOURCE.
// Design: bible/10-UI/Event-Board.md; its audit, bible/01-Overview/audits/Audit-Event-Board.md.
//
// `eventNotice(kind, text, id)` is what the gate's omen and its rite, the sea serpent's bells, a star's region lines and
// its hold, the Abyss Dungeon's find, a town raid's attack and cleansing and the Witches' Festival's nights say now,
// where each had said its line on the chat's every tab (scenes/world.js chatNotice) - or, the raids, on the HUD's line
// (DaggerfallUI.AddHUDText, systems/notify.js hudText, the mod's own call). `id` names the line's event where its kind
// has several at once (a star's `star:<night>.<k>`, a raid's `raid:<raidKey>`), so the board shows it with that event
// and no other (AUDIT EVENTS1 A1). The line waits here until the HUD's next frame takes it into the event board's news
// (ui/eventBoard.js drawEventBoard, from ui/hud/hud.js drawHud - the one call all four hosts make), so a line said from
// anywhere - a relay's word, a frame, a promise - is drawn once.
//
// EVERY LINE IS KEPT (AUDIT EVENTS1 C4, C5): the news is a few seconds of the HUD, so each line is also filed where the
// host seated a log (`seatEventBoard(source, chat, log)` - the journal's Messages page, where DFU's AddHUDText files
// every HUD line and RAID1's lines were filed), and read back there.
//
// WHERE THE BOARD IS OFF, EACH LINE GOES WHERE IT WENT BEFORE: the player's Event board switch (systems/features.js
// `event-board`, prefs `eventBoard`) off - or, under Enhanced Plus, the board's piece put away in the HUD editor (its X,
// AUDIT EVENTS1 B8) - a raid's line to the HUD's line (hudText - the mod's AddHUDText, as RAID1 said it: it files itself
// in the journal) and every other to the sink the host seated beside its source - the chat, as before EVENTS1 - or,
// where no host seated one, to the HUD's line.
//
// EACH KIND THE PLAYER'S OWN (EVENTS2, the players on Discord: "Allow us to filter which events we want to show up in the
// event tracker"): a kind turned off on the Event board row (its chip, systems/features.js eventKindPref) is filed in the
// journal and said nowhere else - no news, and not back on the chat, which is what the players asked to be spared. The
// board's switch is read first: with the board off every line goes where it went before, whatever its kind.
//
// THE SEAT: `seatEventBoard(source)` takes the host's Timers source (scenes/world.js timersSource - the one function
// the pause face's Timers window reads) and answers it unchanged, so the host seats it where it makes it and grows no
// line for it (HOST-SPLIT). Not a DFU member. Ledger A (EVENTS1).
import { getPref } from './uiPrefs.js';
import { hudText } from './notify.js';
import { isEnhanced } from './uiSkin.js';
import { EVENT_KIND_ORDER, eventKindPref } from './features.js';   // EVENTS2: the kinds' one home

/** The kinds a line may say itself under (systems/features.js EVENT_KINDS, the kinds' one home); any other is the gate's. */
export const EVENT_NOTICE_KINDS = EVENT_KIND_ORDER;
/** The lines kept waiting at most (a HUD that never draws - a page with no HUD - must not hold every line of a night). */
export const EVENT_NOTICES_KEPT = 32;
/** The player's switch (systems/features.js `event-board`): the board and its news, on by default. */
export const EVENT_BOARD_PREF = 'eventBoard';
/** The board's piece in the HUD editor (ui/hud/hudLayout.js HUD_PIECES `events`, its layout under `hudLayout`). */
export const EVENT_BOARD_PIECE = 'events';

/** @type {Array<{ kind: string, text: string, at: number, id: string|null }>} */
let _waiting = [];
/** @type {(() => any) | null} */
let _source = null;
/** @type {((text: string) => any) | null} */
let _off = null;
/** @type {((text: string) => any) | { hudMessageSink?: ((text: string) => any) | null } | null} */
let _log = null;

/** Whether the board stands: the player's switch (on unless set off), and under Enhanced Plus its piece not put away in
 *  the HUD editor (a layout the classic skin does not wear). */
export const eventBoardOn = () => {
  try {
    if (getPref(EVENT_BOARD_PREF) === false) return false;
    return !(isEnhanced() && getPref('hudLayout')?.[EVENT_BOARD_PIECE]?.off === true);
  } catch { return true; }
};

/** EVENTS2: whether a kind's events show on the board and in its news - its chip on the Event board row (on unless set
 *  off). The Timers window lists every kind whatever this says. */
export const eventKindShown = (/** @type {string} */ kind) => {
  try { return getPref(eventKindPref(kind)) !== false; } catch { return true; }
};

/** A line said where it went before the board (the board off, or a line it had taken when it was switched off -
 *  `filed`, the door having filed it already). */
export function eventNoticeElsewhere(kind, text, filed = false) {
  try { if (_off && kind !== 'raid') _off(text); else if (filed) eventHudLine(text); else hudText(text); } catch { /* a sink that throws loses one line, never the caller's frame */ }
}

/** A line on the HUD's line that the journal already holds (the door filed it; the board had no room for its news, or
 *  was switched off with it in hand): DFU's AddHUDText files every line it says (scenes/townTalk.js hudMessageSink), so
 *  the log's door is held aside for the one call, and the journal keeps the line once. */
export function eventHudLine(text) {
  const holder = _log && typeof _log === 'object' ? _log : null;
  const sink = holder?.hudMessageSink ?? null;
  if (sink) holder.hudMessageSink = null;
  try { hudText(text); } finally { if (sink) holder.hudMessageSink = sink; }
}

/**
 * AN EVENT'S LINE: kept for the board's news and filed in the log, or - the board off - said where it was said before;
 * a kind the player turned off (EVENTS2, eventKindShown) is filed in the log alone.
 * @param {string} kind one of EVENT_NOTICE_KINDS
 * @param {string} text the line, as its event's own words say it
 * @param {string|null} [id] the line's event, where its kind has several at once (the board's row id)
 */
export function eventNotice(kind, text, id = null) {
  const s = typeof text === 'string' ? text.trim() : '';
  if (!s) return false;
  if (!eventBoardOn()) { eventNoticeElsewhere(kind, s); return true; }
  try { if (typeof _log === 'function') _log(s); else _log?.hudMessageSink?.(s); } catch { /* the log refusing a line never costs the board it */ }
  const k = EVENT_NOTICE_KINDS.includes(kind) ? kind : 'gate';
  if (!eventKindShown(k)) return true;   // EVENTS2: a kind the player turned off - filed in the journal, and nowhere else
  _waiting.push({ kind: k, text: s, at: Date.now(), id: typeof id === 'string' && id ? id : null });
  if (_waiting.length > EVENT_NOTICES_KEPT) _waiting = _waiting.slice(-EVENT_NOTICES_KEPT);
  return true;
}

/** The lines waiting, oldest first, taken (the board's frame). */
export function takeEventNotices() {
  const out = _waiting;
  _waiting = [];
  return out;
}

/**
 * THE SEAT: the host's Timers source (null offline), where a line goes with the board off (the chat), and where every
 * line is filed (the journal). Answers the source as handed, so the host wraps its own definition in it.
 * @template {(() => any) | ((o?: any) => any)} F
 * @param {F} source
 * @param {((text: string) => any) | null} [off]
 * @param {((text: string) => any) | { hudMessageSink?: ((text: string) => any) | null } | null} [log] the journal's door - a
 *   function, or a holder whose `hudMessageSink` it is (scenes/townTalk's, which the host fills after it seats the board)
 * @returns {F}
 */
export function seatEventBoard(source, off = null, log = null) {
  _source = typeof source === 'function' ? source : null;
  _off = typeof off === 'function' ? off : null;
  _log = typeof log === 'function' || (log && typeof log === 'object') ? log : null;
  return source;
}

/** The source's read now - the relay's clock and what the host holds - or null (none seated, offline, or it threw). */
export function eventBoardSource() {
  try { return _source ? _source() ?? null : null; } catch { return null; }
}

/** For the tests: nothing waiting, nothing seated. */
export function _resetEventNotices() { _waiting = []; _source = null; _off = null; _log = null; }
