// @ts-check
// TUT1 (2026-10-11, Mac: "replace the current DFU tutorial with our own custom tutorial that not only explains how to
// play, but has popups for whenever you are interacting with a new system ... We are also now DFO Online/DFO, so dont
// mention daggerfall. We also need a menu section where tutorials can be revisited. This needs to be comprehensive"):
// THE TUTORIALS' LAW - which page a player has read, whether the popups are on, and how a page becomes the rows a box
// shows. No DOM and no window here: the box is ui/tutorialPopup.js's, the menu's pane is ui/tutorialsPane.js's, the
// words are systems/tutorialCatalogue.js's.
//
// WHAT IT REPLACES. A new character used to start DFU's _TUTOR__ quest (questBridge.js GAME_START_QUESTS): seventeen
// pages on quest clocks, in Privateer's Hold and the first city, about DFU's own controls and nothing this game has
// added since. The welcome tour (TUTORIAL_TOUR) stands where its first page stood, and every system after it speaks
// the first time the player reaches it - ONCE, on this device, and always again from the menu.
//
// THE SHELF, NOT THE SAVE. What a player has read is the player's, not the character's: a second character does not
// need the inventory explained again. Two keys on the port's own prefs shelf (systems/uiPrefs.js): the popups' switch
// and the read list. A list, never a map of booleans, and only ever ids the catalogue knows - a page retired from the
// catalogue leaves the list on the next write.
//
// A KEY IS NAMED AS THE PLAYER BOUND IT. A page that said "press F6" would lie the moment F6 was rebound (the loading
// screen's tips learned it - ui/loadingScreen.js LOADING_TIPS). A page writes `{Inventory}` - an action's name from
// systems/inputActions.js - and the reader fills it with the key bound now.

import { getPref, setPref } from './uiPrefs.js';
import { TUTORIALS, TUTORIAL_GROUPS, TUTORIAL_TOUR } from './tutorialCatalogue.js';

export { TUTORIALS, TUTORIAL_GROUPS, TUTORIAL_TOUR };

/** The shelf's two keys (their defaults stand in uiPrefs.js PREF_DEFAULTS). */
export const TUTORIAL_POPUPS_PREF = 'tutorialPopups';
export const TUTORIALS_SEEN_PREF = 'tutorialsSeen';

/** The width a page's lines are wrapped to - the classic parchment's comfortable measure, and inside the enhanced
 *  notice panel's 520 pixels at its 15-pixel row. */
export const TUTORIAL_WRAP = 54;

const BY_ID = new Map(TUTORIALS.map((t) => [t.id, t]));

/** A page by its id, or null. */
export const tutorialById = (id) => BY_ID.get(id) ?? null;

/** A group's pages, in the catalogue's order. */
export const tutorialsIn = (groupId) => TUTORIALS.filter((t) => t.group === groupId);

/** The popups' switch: on unless the player turned it off. */
export const tutorialPopupsOn = () => getPref(TUTORIAL_POPUPS_PREF) !== false;

/** Turn the popups on or off; the store's word comes back. */
export const setTutorialPopups = (on) => setPref(TUTORIAL_POPUPS_PREF, !!on);

/** The ids read, as a Set - only ids the catalogue knows. Kept while the shelf's list is the same array (the shelf
 *  hands back the one it holds until a write), because a few seams ask every frame (the HUD's survival chips, the duel
 *  strip); a caller gets its own copy, so nothing it does reaches the kept one. */
let _seenRaw;
let _seenSet = new Set();
function seenNow() {
  const raw = getPref(TUTORIALS_SEEN_PREF);
  if (raw !== _seenRaw) {
    _seenRaw = raw;
    _seenSet = new Set(Array.isArray(raw) ? raw.filter((id) => BY_ID.has(id)) : []);
  }
  return _seenSet;
}
export const seenTutorials = () => new Set(seenNow());

export const isTutorialSeen = (id) => seenNow().has(id);

/** Mark pages read. Unknown ids are dropped; a write happens only when the list grew. Answers whether it did. */
export function markTutorialsSeen(ids) {
  const seen = seenTutorials();
  const before = seen.size;
  for (const id of ids ?? []) if (BY_ID.has(id)) seen.add(id);
  if (seen.size === before) return false;
  setPref(
    TUTORIALS_SEEN_PREF,
    TUTORIALS.map((t) => t.id).filter((id) => seen.has(id)),
  ); // catalogue order: one list, one shape
  return true;
}
export const markTutorialSeen = (id) => markTutorialsSeen([id]);

/** Every popup will show again (the menu's Reset). */
export const forgetTutorialsSeen = () => setPref(TUTORIALS_SEEN_PREF, null);

/** Whether a page should pop now: the popups are on, the page exists and has not been read. */
export const tutorialDue = (id) => BY_ID.has(id) && tutorialPopupsOn() && !isTutorialSeen(id);

// ── THE TRIGGER ────────────────────────────────────────────────
// Every seam that is a player's first touch of a system calls `noteFirstUse(id)` - a door, a window's constructor, a
// host's arm. It is pure and cheap (a page read or the popups off answers at once), and it names no window: the box is
// ui/tutorialPopup.js's, which registers itself here when a host loads it (the four hosts import it). A trigger that
// fires before any host has loaded waits, a few at most, for the handler.
let handler = null;
const early = [];
const EARLY_MAX = 16;

/** ui/tutorialPopup.js's registration; the early triggers are handed over at once. Answers the unregister. */
export function setTutorialHandler(fn) {
  handler = typeof fn === 'function' ? fn : null;
  if (handler) for (const id of early.splice(0)) handler(id);
  return () => {
    if (handler === fn) handler = null;
  };
}

/** THE TRIGGER: the player has just reached system `id`. `after` (ms) holds the page back - a door that is a scene's
 *  change (a gate's fire, a rift) asks for the page once the player stands on the other side. Answers whether a page
 *  was queued. */
export function noteFirstUse(id, { after = 0 } = {}) {
  if (!tutorialDue(id)) return false;
  if (handler) return !!handler(id, { after });
  if (early.length < EARLY_MAX && !early.includes(id)) early.push(id);
  return false;
}

/** Tests: no handler, nothing waiting. */
export function _resetTutorialTriggerForTests() {
  handler = null;
  early.length = 0;
}

/** `{Action}` -> the key bound to it now, through `keyName(action)` (null or '' when unbound: "an unbound key"). */
export function fillKeys(text, keyName = null) {
  return String(text ?? '').replace(/\{([A-Za-z0-9]+)\}/g, (_m, action) => {
    const k = keyName ? keyName(action) : null;
    if (!k) return '[unbound]';
    return k === '[' || k === ']' ? `"${k}"` : `[${k}]`; // a bracket key in brackets reads as noise
  });
}

/** Greedy word wrap to `width` characters; a word longer than the line stands on its own, and the last line is never
 *  one word when the line above can spare one. */
export function wrapTutorialText(text, width = TUTORIAL_WRAP) {
  const out = [];
  let line = '';
  for (const word of String(text ?? '')
    .split(/\s+/)
    .filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  // no word left alone on the last line: the line above lends it its last word when both still fit
  const n = out.length;
  if (n > 1 && !out[n - 1].includes(' ') && out[n - 2].includes(' ')) {
    const cut = out[n - 2].lastIndexOf(' ');
    const moved = `${out[n - 2].slice(cut + 1)} ${out[n - 1]}`;
    if (moved.length <= width) {
      out[n - 2] = out[n - 2].slice(0, cut);
      out[n - 1] = moved;
    }
  }
  return out;
}

/** The menu's article: the page's paragraphs and points with their keys filled. */
export function tutorialText(t, keyName = null) {
  return {
    title: t.title,
    body: t.body.map((p) => fillKeys(p, keyName)),
    points: (t.points ?? []).map((p) => fillKeys(p, keyName)),
  };
}

/** The popup's rows (systems/notify.js's row records): the title, then the page's paragraphs and points wrapped.
 *  `page`/`pages` number a tour's pages. No foot: the welcome page says where every page can be read again, and a
 *  line saying it on all of them was one more thing to read (TUT1 audit). */
export function tutorialRows(t, { keyName = null, page = 0, pages = 0, width = TUTORIAL_WRAP } = {}) {
  const { title, body, points } = tutorialText(t, keyName);
  const rows = [];
  rows.push({ text: pages > 1 ? `${title}  (${page} of ${pages})` : title, center: true, cls: 'tut-title' });
  rows.push('');
  body.forEach((p, i) => {
    if (i) rows.push('');
    rows.push(...wrapTutorialText(p, width));
  });
  if (points.length) {
    rows.push('');
    for (const p of points) {
      const lines = wrapTutorialText(p, width - 2);
      lines.forEach((l, i) => rows.push(`${i ? '  ' : '- '}${l}`));
    }
  }
  return rows;
}
