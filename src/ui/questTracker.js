// GUIDE4 (2026-09-29, Mac: "How can we set the foundation and improve the
// quest system substantially? Like really modernize it, make it more
// accessible", then, of the Quest Guide arc: "This is your baby. Take
// your time"): THE TRACKER - the quest you follow, on the HUD.
//
// WHAT DFU HAS. Nothing on the HUD about quests. The logbook holds every
// word, but what a quest wants now, where, and by when is a window away -
// and the enhanced journal (GUIDE2) is still a window. The tracker is a
// small card at the HUD's right-upper edge: the quest's title, its newest
// entry's opening (ui/questRail.js entryOpening), where it points in the
// find-place box's words (the lens's `words`) and the time left.
//
// WHICH QUEST. The arc's DECISIONS 2: on by default, but QUIET - it
// follows the quest the journal last changed (the lens's news: started,
// updated, urgent) until the player TRACKS one from the journal (the
// pause window's Quests tab, the chronicle), and says nothing when there
// is no quest to follow. A tracked quest is the player's choice and is
// kept per character (DFU's per-mod save slot, systems/modSaveData.js, by
// the quest's uid); following is not a choice and is not kept - a load
// follows the quest written last.
//
// WHERE IT STANDS (the HUD map, 2026-09-29): the right-upper column, on
// the party list's own line (ui/partyPanel.js: 92, which clears the FPS
// read-out) - and online the party list steps down by the card's height,
// read off the one variable this module publishes (TRACKER_HEIGHT_VAR,
// the chat's --dfchat-w idiom). A phone takes it under the compass; a
// short screen keeps only the title and the time.
//
// THE MODEL IS ONE HOME, THE DRAW IS THE HUD'S (the herald's shape, GUIDE3):
// QuestTracker is pure and hears each lens look the quest bridge makes
// after a machine tick; ui/hud.js drawHud draws the card on the one call
// all four hosts make, outside the skin's gate so that off it reaches its
// hide door (AUDIT 64 F37). UPDATED, NOT REBUILT (ui/enhancedHudText.js's
// law): a still frame writes nothing. And like the herald it imports
// nothing of the quest machine: the HUD imports it (test/guide3_herald.test.js
// and test/guide4_tracker.test.js walk the graph).

import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { isTouchDevice } from './touchDevice.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { entryOpening, timeLeftWords } from './questRail.js';
import { marksOn } from './questMarks.js';   // AUDIT GUIDE T2: the marks follow this model too (pure: the HUD stays light)

/** The switch's prefs key (systems/features.js row `quest-tracker`). */
export const TRACKER_PREF = 'questTracker';
/** The card's id on the page. */
export const TRACKER_ID = 'enhanced-questtracker';
/** The per-character record's slot in the save (systems/modSaveData.js). */
export const TRACKER_SAVE = 'QuestTracker';
/** An opening on the card: about two lines, cut at a word (the herald's three take 140). Seen in Chromium: at 90 the
 *  card's clamp cut the sentence mid-word; 64 is two lines of the card in the skin's face, and the clamp allows a
 *  third for a wider one, so the cut is always this one - at a word. */
export const TRACKER_OPENING_MAX = 64;
/** The card's height, published for the party list to step under (0 when there is no card). */
export const TRACKER_HEIGHT_VAR = '--dfquest-h';
/** The gap the party list keeps under the card, in px. */
export const TRACKER_GAP = 8;

/** The port's own words. */
export const TRACKER_WORDS = Object.freeze({
  left: timeLeftWords,   // the quest faces' one phrase (ui/questRail.js)
  track: 'Track',
  // AUDIT GUIDE T6/U13: ONE name - the toggle's words and label never change with its state (WAI-ARIA APG);
  // aria-pressed says whether it is on, and the visible word begins the name (WCAG 2.5.3)
  trackLabel: (title) => `Track ${title} on the HUD`,
  // AUDIT GUIDE U14: the quest the HUD follows, said where the choice is made (the card itself is aria-hidden)
  onHud: 'On the HUD',
  onCompass: 'On the compass',
  main: 'Main Quest',   // AUDIT GUIDE U11: a main quest said, never colour alone (the pause tab's own tag, PX5)
});

/** Is the tracker on? The enhanced skin, the player's switch, and a page (ui/questHerald.js heraldOn's reason). */
export const trackerOn = () => isEnhanced() && !!getPref(TRACKER_PREF) && typeof document !== 'undefined';

/** AUDIT GUIDE T2: does any face follow this model? The card, or the marks (the held map's filled diamond and the
 *  compass's one mark read `tracked()` too) - the bridge feeds it while either is on, and while either is, the choice
 *  steers something, so the journal keeps the Track toggle and opens on the followed quest. */
export const followOn = () => trackerOn() || marksOn();

/** The active quest written last - the walk's order breaks a tie. */
function latestOf(views) {
  let best = null;
  for (const v of views) if (!best || (v.updatedAt ?? -Infinity) > (best.updatedAt ?? -Infinity)) best = v;
  return best;
}

/**
 * THE MODEL. Pure: a lens look to `hear`, the player's choice to `pin`,
 * and the card's words out of `frame`.
 */
export class QuestTracker {
  constructor() {
    /** The last look's quest views (ui/questLens.js). */
    this.views = [];
    /** The quest the journal last changed - followed, not chosen. */
    this.follow = null;
    /** The quest the player tracks (a uid string), or null. */
    this.pinned = null;
  }

  /** A lens look: the quests as they stand, and the news that moves what the card follows. */
  hear(seen) {
    this.views = seen?.quests ?? [];
    for (const e of seen?.events ?? []) {
      if (e.type === 'started' || e.type === 'updated' || e.type === 'urgent') this.follow = e.id;
      else if (e.type === 'completed' || e.type === 'ended') {
        if (this.follow === e.id) this.follow = null;
        if (this.pinned === e.id) this.pinned = null;   // a finished quest is tracked no more
      }
    }
  }

  /** A load or a switch turned off: forget what was seen and followed; the player's choice stays. */
  forget() { this.views = []; this.follow = null; }

  /** The quest the card shows: the tracked one, else the followed one, else the one written last. */
  tracked() {
    const byId = (id) => (id == null ? null : this.views.find((v) => v.id === id) ?? null);
    return byId(this.pinned) ?? byId(this.follow) ?? latestOf(this.views);
  }

  isPinned(id) { return id != null && this.pinned === String(id); }

  /** The journal's Track button: track this quest, or stop tracking it. Returns what is tracked now. */
  toggle(id) {
    this.pinned = this.isPinned(id) || id == null ? null : String(id);
    return this.pinned;
  }

  /** The card's words, or null when there is no quest to follow. */
  frame() {
    const v = this.tracked();
    if (!v) return null;
    return {
      id: v.id,
      title: v.title ?? '',
      main: !!v.main,
      pinned: this.isPinned(v.id),
      opening: entryOpening(v.latest?.lines, TRACKER_OPENING_MAX),
      where: v.words?.where ?? '',
      note: v.words?.note ?? '',   // GUIDE5: a named place not on the map - no mark, the talk arc's answer instead
      // AUDIT GUIDE U11: a main quest said on the time row - the one row every size of the card keeps
      time: [v.main ? TRACKER_WORDS.main : '', Number.isFinite(v.clockSeconds) ? TRACKER_WORDS.left(v.clockSeconds) : ''].filter(Boolean).join(' - '),
      urgent: !!v.urgent,
    };
  }
}

/** THE ONE TRACKER: one player, one HUD. */
export const questTracker = new QuestTracker();

// THE PLAYER'S CHOICE, PER CHARACTER: DFU's per-mod save slot (IHasModSaveData - GetSaveData beside the save,
// NewSaveData for a save without one), under the port's own name. Only the choice is kept: a quest uid survives a
// load, and what the card follows is re-learned from the next look.
const validPin = (r) => (typeof r?.pinned === 'string' && r.pinned.length ? r.pinned : null);
registerModSaveData(TRACKER_SAVE, {
  newSaveData: () => ({ pinned: null }),
  getSaveData: () => ({ pinned: questTracker.pinned }),
  restoreSaveData: (r) => { questTracker.pinned = validPin(r); questTracker.forget(); },
});

/**
 * THE JOURNAL'S TRACK BUTTON, one home for both enhanced journal faces
 * (the pause window's Quests tab, the chronicle): a toggle, `aria-pressed`,
 * that tracks this quest on the HUD's card or stops tracking it, and beside
 * it the note that this is the quest the HUD follows (AUDIT GUIDE U14).
 * AUDIT GUIDE T5/U3: a press changes the toggle IN PLACE - and every other
 * one on the page - so the focus stays on it and no face is rebuilt under
 * the player.
 */
export function trackButton(doc, id, title) {
  const box = doc.createElement('span');
  box.className = 'qtrack-pinbox';
  box.setAttribute('data-quest', String(id));
  const b = doc.createElement('button');
  b.type = 'button';
  b.textContent = TRACKER_WORDS.track;
  const label = TRACKER_WORDS.trackLabel(title);
  b.title = label;
  b.setAttribute('aria-label', label);
  const note = doc.createElement('span');
  note.className = 'qtrack-on';
  box.append(b, note);
  paintTrackBox(box);
  b.onclick = () => {
    questTracker.toggle(id);
    paintTrackBox(box);
    syncTrackButtons(doc);
  };
  return box;
}

/** One toggle's state, as the model stands: pressed when tracked, the note when it is the HUD's quest. */
function paintTrackBox(box) {
  const id = box.getAttribute?.('data-quest');
  const b = box.querySelector?.('.qtrack-pin') ?? box.children?.[0];
  const note = box.querySelector?.('.qtrack-on') ?? box.children?.[1];
  const on = questTracker.isPinned(id);
  const cls = on ? 'act qtrack-pin on' : 'act qtrack-pin';
  if (b && b.className !== cls) b.className = cls;
  if (b && b.getAttribute?.('aria-pressed') !== (on ? 'true' : 'false')) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  const hud = questTracker.tracked()?.id;
  const words = hud != null && String(hud) === id ? (trackerOn() ? TRACKER_WORDS.onHud : TRACKER_WORDS.onCompass) : '';
  if (note && note.textContent !== words) note.textContent = words;
}

/** Every toggle on the page, as the model stands (a press tracks one quest and lets go of another). */
export function syncTrackButtons(doc) {
  for (const box of doc?.body?.querySelectorAll?.('.qtrack-pinbox') ?? []) paintTrackBox(box);
}

// ── THE CARD ─────────────────────────────────────────────────────────

let card = null;   // { node, doc, touch, rows: { mark, title, opening, where, note, time }, last, ro }

function build(doc) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const touch = isTouchDevice();   // once a card: a finger does not come and go mid-game (ui/partyPanel.js reads it once too)
  const node = doc.createElement('div');
  node.id = TRACKER_ID;
  node.className = touch ? 'qtrack touch' : 'qtrack';
  node.setAttribute('aria-hidden', 'true');   // the HUD's own text is; the herald is what speaks (the stack's aria-live)
  const row = (cls, tag = 'div') => { const n = doc.createElement(tag); n.className = cls; return n; };
  const head = row('qtrack-head');
  const mark = row('qtrack-mark', 'span');
  const title = row('qtrack-title', 'span');
  head.append(mark, title);
  const opening = row('qtrack-line');
  const where = row('qtrack-where');
  const note = row('qtrack-note');   // GUIDE5
  const time = row('qtrack-time');
  node.append(head, opening, where, note, time);
  doc.body.append(node);
  const c = { node, doc, touch, rows: { mark, title, opening, where, note, time }, last: {}, ro: null };
  // AUDIT GUIDE O5/T4/U2: the card re-measures whenever its box changes - a phone turned, a window resized across the
  // short-screen rule, the web face arriving after the first measure - not only when its words do
  const RO = doc.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
  if (typeof RO === 'function') {
    c.ro = new RO(() => { if (card === c && c.last.shown) publishCard(c); });
    c.ro.observe(node);
  }
  return c;
}

/** The party list's line under the card (AUDIT GUIDE U8: the card's own bottom, wherever the HUD's scale put its top),
 *  or its height where a page cannot say where it stands (a test's document). */
function publishCard(c) {
  const r = c.node.getBoundingClientRect?.();
  let px = 0;
  if (r && Number.isFinite(r.bottom) && r.bottom > 0) px = Math.ceil(r.bottom) - (c.touch ? PARTY_TOUCH_TOP : PARTY_TOP) + TRACKER_GAP;
  else { const h = Math.ceil(Number(c.node.offsetHeight) || 0); px = h ? h + TRACKER_GAP : 0; }
  publishHeight(c.doc, Math.max(0, px));
}
/** The party list's own lines (ui/partyPanel.js .dfparty: 92, and 76 on a touch screen) - the card's bottom is published
 *  against them. */
const PARTY_TOP = 92, PARTY_TOUCH_TOP = 76;

function setText(c, key, n, text) {
  if (c.last[key] === text) return false;
  c.last[key] = text;
  n.textContent = text;
  n.style.display = text ? '' : 'none';
  return true;
}

function publishHeight(doc, px) {
  const root = doc?.documentElement;
  if (!root?.style?.setProperty) return;
  root.style.setProperty(TRACKER_HEIGHT_VAR, `${px}px`);
}

function hideCard() {
  if (!card || card.last.shown === false) return;
  card.last.shown = false;
  card.node.style.display = 'none';
  publishHeight(card.doc, 0);
}

function dropCard() {
  if (!card) return;
  try { card.ro?.disconnect?.(); } catch { /* gone */ }
  try { card.node.remove(); } catch { /* gone */ }
  publishHeight(card.doc, 0);
  card = null;
}

/**
 * ONE HUD FRAME OF THE TRACKER. `hidden` is the HUD's own hide gate (a
 * window over it, the HUD toggled off). Off - the classic skin or the
 * switch - it reaches its hide door: the card goes (the model is the
 * bridge's: GUIDE5's marks follow the same quest, and the bridge forgets
 * it when neither face is on). Returns the card's words, or null when it
 * draws nothing - for a test.
 */
export function drawQuestTracker({ hidden = false, doc = (typeof document === 'undefined' ? null : document) } = {}) {
  if (!trackerOn()) {
    dropCard();   // GUIDE5: what the model followed is the bridge's to forget - the marks may still be following it
    return null;
  }
  const f = questTracker.frame();
  if (!f || hidden || !doc) { hideCard(); return null; }
  if (!card || card.doc !== doc) { dropCard(); card = build(doc); }
  const c = card;
  let moved = setText(c, 'title', c.rows.title, f.title);
  moved = setText(c, 'mark', c.rows.mark, f.pinned ? '\u25c6' : '\u25c7') || moved;   // tracked: the filled diamond; followed: the hollow
  moved = setText(c, 'opening', c.rows.opening, f.opening) || moved;
  moved = setText(c, 'where', c.rows.where, f.where) || moved;
  moved = setText(c, 'note', c.rows.note, f.note) || moved;   // GUIDE5: the place is named but not on the map - ask around
  moved = setText(c, 'time', c.rows.time, f.time) || moved;
  const cls = `qtrack${c.touch ? ' touch' : ''}${f.main ? ' main' : ''}${f.urgent ? ' urgent' : ''}`;
  if (c.last.cls !== cls) { c.last.cls = cls; c.node.className = cls; moved = true; }
  if (c.last.shown !== true) { c.last.shown = true; c.node.style.display = ''; moved = true; }
  // AUDIT GUIDE U8: the HUD's own scale, read off the HUD (ui/enhancedHelm.js's way): the card's top clears the compass
  // and the foe frame that scale grows (the style sheet's --qt-clear) - and a foe frame coming or going moves it
  const hud = /** @type {any} */ (doc.querySelector?.('.hud'));
  const scale = hud?.style?.getPropertyValue?.('--hud-scale') || '1';
  const foe = /** @type {any} */ (doc.querySelector?.('.hud-foe.on'));
  const sig = `${scale}|${foe ? (foe.classList?.contains?.('blade') ? 'blade' : 'bar') : ''}${foe?.classList?.contains?.('poised') ? '|poised' : ''}`;   // AUDIT TELL U5: the poise track's coming or going moves it too
  if (c.last.sig !== sig) { c.last.sig = sig; c.node.style.setProperty?.('--hud-scale', scale); moved = true; }
  // the party list steps under the card: measured when what it says or where it stands changed (and by the observer
  // whenever its box does)
  if (moved) publishCard(c);
  return f;
}

/** Tests: drop the card and the model's state. */
export function _resetQuestTrackerForTests() {
  dropCard();
  questTracker.forget();
  questTracker.pinned = null;
}
