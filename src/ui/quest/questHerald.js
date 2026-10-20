// GUIDE3 (2026-09-29, Mac: "How can we set the foundation and improve the
// quest system substantially? Like really modernize it, make it more
// accessible", then, of the Quest Guide arc: "This is your baby. Take
// your time"): THE HERALD - a quest's news, said where the enhanced skin
// says news.
//
// WHAT DFU SAYS. Nothing. A quest's `log` is a bare addLogStep, `end
// quest` files the notebook in silence, and a clock inside its last day
// is a number the player must open the logbook to read. DISC6's player
// said what the silence costs (bible/01-Overview/bugs/Field-Bugs-2026-09-23.md):
// "Theres no quest notification when you killed all monsters and no quest
// update in the log". The quest's OWN words - its `say` popups - are the
// quest's and stay exactly where they are; what the herald adds is the
// journal's news, that it changed, which DFU never said at all.
//
// WHERE IT SAYS IT. The enhanced skin's notice stack (ui/enhanced/enhancedNotice.js,
// ENH-NOTICE1/3): one toast per quest - its kind first ("New quest",
// "Journal updated", "Under a day left", "Quest completed", "Quest
// ended"), then its title, then one line: the newest entry's opening
// (ui/quest/questRail.js entryOpening) or the time left. The stack is
// `aria-live` polite, so a screen reader says the news the parchment never
// could. The classic skin never draws it - DFU says nothing, and the
// classic skin is DFU's - and the enhanced skin's `quest-herald` switch
// (systems/features.js) takes it off: Ledger A row "A QUEST'S NEWS IS A
// NOTICE".
//
// THE MODEL IS ONE HOME, THE DRAW IS THE STACK'S (ui/levelUp/levelNotice.js's
// shape, LV2): the queue and its clock live in QuestHerald below, pure -
// no DOM, no clock of its own - and the draw hands its frame to
// drawEnhancedToasts each HUD frame, as ui/hud/hudText.js hands PopupText's.
//
// WHO FEEDS IT. The quest bridge (scenes/quest/questBridge.js), after each
// machine tick: one lens look a tick, and only while the herald is
// listening - so a player who never hears it never pays for the look.
//
// ITS CLOCK IS THE HUD'S. ui/hud/hud.js drawHud - the one call all four hosts
// make - draws it and ticks it with the frame's REAL seconds (a news line
// is the port's page, not the world's: at a journey's time scale it would
// otherwise be gone before it was read), and the tick is dead under any
// open window, DFU's own HUD law (DaggerfallUI.cs:429-433, which
// midScreenText keeps): news that lands as a window opens waits for the
// window to close rather than expiring unread.

import { isEnhanced } from '../../systems/uiSkin.js';
import { getPref } from '../../systems/uiPrefs.js';
import { drawEnhancedToasts, releaseEnhancedToasts } from '../enhanced/enhancedNotice.js';
import { entryOpening, timeLeftWords, QUEST_URGENT_SECONDS } from './questRail.js';   // the rail, never the lens: the HUD imports this face (entryOpening's own comment says why)
import { noteFirstUse } from '../../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page
import { t } from '../../systems/textManager.js';   // QL2: the objective's word, in the player's language

/** The switch's prefs key (systems/features.js row `quest-herald`). */
export const HERALD_PREF = 'questHerald';
/** The toasts' owner in the notice stack. */
export const HERALD_OWNER = 'quest-herald';
/** How long a notice holds, in real seconds the HUD is showing. */
export const HERALD_SECONDS = 7;
/** The most quests the herald speaks for at once; past it the least news
 *  goes first (AUDIT GUIDE H5: an entry before a deadline, a deadline
 *  before a new quest or an ending, the oldest among equals). Every word
 *  of it is in the journal - the herald only points. */
export const HERALD_MAX = 3;

/** The port's own words. Nothing here is TEXT.RSC: DFU has no such line. */
export const HERALD_WORDS = Object.freeze({
  started: 'New quest',
  updated: 'Journal updated',
  get objective() { return t('quest.herald.objective', 'Objective done'); },   // QL2: a stamped quest's objective, done
  urgent: 'Under a day left',
  completed: 'Quest completed',
  ended: 'Quest ended',
});
/** The time-left line: the quest faces' one phrase (ui/quest/questRail.js timeLeftWords), the journal's "Time remains" count. */
export const heraldTimeLeft = timeLeftWords;
/** AUDIT GUIDE H10: a main quest is SAID, not only coloured - the pause tab's own tag (PX5's "Main Quest"). */
export const MAIN_QUEST_WORD = 'Main Quest';
/** AUDIT GUIDE H3: the herald's own live region - it stands before the news and after it. */
export const HERALD_LIVE_ID = 'quest-herald-live';

/** ONE TOAST PER QUEST, so two pieces of news for one quest inside one
 *  notice's life are one notice - and the one that stands is the one a
 *  player most needs: an ending is the last word, a new quest stays new
 *  while its first entries land, and a deadline outranks a routine
 *  entry. */
const RANK = Object.freeze({ updated: 0, objective: 0.5, urgent: 1, started: 2, completed: 3, ended: 3 });   // QL2: an objective done outranks a routine entry

/** Is the herald listening? The enhanced skin, the player's switch - and
 *  a page to say it on: node drives the hosts headless (the suite, the
 *  probes), where there is no stack to hear it and so nothing worth a
 *  look (ui/map/mapSkin.js heldMapWorn's reason). */
export const heraldOn = () => isEnhanced() && !!getPref(HERALD_PREF) && typeof document !== 'undefined';

/** A notice's first row: the kind - and, for a main quest, that it is one (AUDIT GUIDE H10: never colour alone). */
const kindOf = (r) => (r.main ? `${HERALD_WORDS[r.type]} - ${MAIN_QUEST_WORD}` : HERALD_WORDS[r.type]);

/** AUDIT GUIDE H7: is the quest under a day now? The view's own word, or its count (a pure view without the flag). */
const underADay = (view) => view?.urgent ?? (Number.isFinite(view?.clockSeconds) && view.clockSeconds < QUEST_URGENT_SECONDS);

/** A notice's third line, for the news that stands: the newest entry's
 *  opening, the time left, or nothing for an ending. */
function lineOf(type, event, view) {
  if (type === 'started' || type === 'updated') return entryOpening(view?.latest?.lines);
  if (type === 'objective') return event.type === 'objective' ? event.text ?? '' : '';   // QL2: what was done
  if (type === 'urgent') {
    const s = event.type === 'urgent' ? event.clockSeconds : view?.clockSeconds;
    return Number.isFinite(s) ? heraldTimeLeft(s) : '';
  }
  return '';
}

/**
 * THE QUEUE. Pure: every moment is handed in - a lens look to `hear`,
 * a HUD frame's seconds to `tick` - so a test can drive a whole evening
 * of quests in a millisecond.
 */
export class QuestHerald {
  constructor() {
    /** { seq, id, type, title, main, line, left } - oldest news first. */
    this.rows = [];
    this._seq = 0;
    /** The last look's quests, by id - what a notice that waited says when it shows again (AUDIT GUIDE H6). */
    this._views = new Map();
  }

  /** A lens look (`{ quests, events }`, ui/quest/questLens.js): each event is
   *  news for its quest's one notice. */
  hear(seen) {
    if ((seen?.events ?? []).some((e) => Object.hasOwn(HERALD_WORDS, e?.type))) noteFirstUse('quests');   // TUT1: the first quest news
    const views = new Map((seen?.quests ?? []).map((q) => [q.id, q]));
    this._views = views;
    for (const event of seen?.events ?? []) {
      if (!Object.hasOwn(HERALD_WORDS, event?.type)) continue;
      const at = this.rows.findIndex((r) => r.id === event.id);
      const was = at >= 0 ? this.rows[at] : null;
      // AUDIT GUIDE H7: a deadline outranks an entry only while the quest is still under a day
      const view = views.get(event.id);
      const keeps = was && RANK[was.type] > RANK[event.type] && !(was.type === 'urgent' && view && !underADay(view));
      const type = keeps ? was.type : event.type;
      const row = {
        seq: was?.seq ?? ++this._seq,
        id: event.id,
        type,
        title: event.title ?? was?.title ?? '',
        main: !!event.main,
        // AUDIT QUESTLINES UI-2: a kept "Objective done" keeps its words - the entry the script writes a tick later is not one
        line: keeps && type === 'objective' ? was.line : lineOf(type, event, view),
        left: HERALD_SECONDS,
        said: false,   // AUDIT GUIDE H3: spoken once, whole, on the first frame it shows - a merge is new words
      };
      // AUDIT GUIDE H5: merged news is the newest news - it moves to the back, where the next eviction reaches last
      if (was) this.rows.splice(at, 1);
      this.rows.push(row);
    }
    // AUDIT GUIDE H5: past HERALD_MAX the least news goes - the lowest rank, the oldest among equals - so four events
    // in one look keep the three that matter most, and a routine entry never pushes out an ending
    while (this.rows.length > HERALD_MAX) {
      let out = 0;
      for (let i = 1; i < this.rows.length; i++) if (RANK[this.rows[i].type] < RANK[this.rows[out].type]) out = i;
      this.rows.splice(out, 1);
    }
    return this.rows.length;
  }

  /** AUDIT GUIDE H6: the HUD shows again after a window (a rest, a journey's stop, the map): a deadline's notice says
   *  the time left the last look carries, not the time it was heard at. Nothing else a notice says goes stale. */
  refresh() {
    for (const r of this.rows) {
      if (r.type !== 'urgent') continue;
      const s = this._views.get(r.id)?.clockSeconds;
      if (Number.isFinite(s)) r.line = heraldTimeLeft(s);
    }
  }

  /** `dt` real seconds of a showing HUD: a notice past its time goes. */
  tick(dt) {
    if (!(dt > 0)) return;
    for (const r of this.rows) r.left -= dt;
    this.rows = this.rows.filter((r) => r.left > 0);
  }

  /** The toasts' frame: one row list and one id per notice (ui/enhanced/enhancedNotice.js drawEnhancedToasts). */
  frame() {
    return {
      ids: this.rows.map((r) => r.seq),
      rows: this.rows.map((r) => [
        { text: kindOf(r), cls: 'herald-kind' },
        { text: r.title, cls: r.main ? 'herald-title main' : 'herald-title' },
        ...(r.line ? [{ text: r.line, cls: 'herald-line' }] : []),
      ]),
    };
  }

  /** AUDIT GUIDE H3: what the live region says for the notices not yet said, whole - "New quest: The Ring. I agreed
   *  to find the ring." - and marks them said. Empty when there is nothing new. */
  speak() {
    const out = [];
    for (const r of this.rows) {
      if (r.said) continue;
      r.said = true;
      out.push(`${kindOf(r)}: ${r.title}.${r.line ? ` ${r.line}` : ''}`);
    }
    return out.join(' ');
  }

  clear() { this.rows = []; this._views = new Map(); }
}

/** THE ONE QUEUE: one player, one HUD, one journal (ui/levelUp/levelNotice.js's reason). */
export const questHerald = new QuestHerald();

/** Was the last frame hidden? (AUDIT GUIDE H6: the frame that shows again refreshes the counts.) */
let wasHidden = false;

/**
 * ONE HUD FRAME OF THE HERALD. `hidden` is the HUD's own hide gate (a
 * window over it, the HUD toggled off): the notices hide and their clock
 * stops, and nothing is released. Off - the classic skin or the switch -
 * it REACHES ITS HIDE DOOR (AUDIT 64 F37: a DOM overlay stays painted
 * until told otherwise): the queue empties and the toasts slide out.
 * Returns the live toasts, for a test.
 */
export function drawQuestHerald({ hidden = false, dt = 0, doc = (typeof document === 'undefined' ? null : document) } = {}) {
  if (!heraldOn()) {
    if (questHerald.rows.length) questHerald.clear();
    releaseEnhancedToasts(HERALD_OWNER);
    dropLive();
    return [];
  }
  const voice = liveRegion(doc);
  if (!hidden) {
    if (wasHidden) questHerald.refresh();   // AUDIT GUIDE H6: back from under a window - the count as it stands now
    questHerald.tick(dt);
    const words = questHerald.speak();   // AUDIT GUIDE H3: news said when it first shows, as the notice first shows
    if (words && voice) voice.textContent = words;
  }
  wasHidden = !!hidden;
  return drawEnhancedToasts({ ...questHerald.frame(), visible: !hidden, silent: true }, doc, HERALD_OWNER);
}

/**
 * AUDIT GUIDE H3 - THE HERALD'S VOICE. The notice stack's aria-live root is built with its first notice and taken
 * down with its last (ENH-NOTICE1), and a live region inserted together with its words is commonly not spoken; a
 * merged notice rewrote one row of three. The herald speaks through a region of its own instead: visually hidden,
 * polite, atomic, built at the herald's first frame on a page and standing while the herald is on - each notice said
 * once and whole on the first frame it shows (its toasts are aria-hidden: nothing twice).
 */
let live = null;
function liveRegion(doc) {
  if (!doc?.createElement || !doc.body) return null;
  if (live && live.doc === doc && !live.node.removed && live.node.parentNode !== null) return live.node;
  const node = doc.createElement('div');
  node.id = HERALD_LIVE_ID;
  node.className = 'qherald-live';
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  node.textContent = '';
  doc.body.append(node);
  live = { doc, node };
  return node;
}
function dropLive() {
  if (!live) return;
  try { live.node.remove(); } catch { /* gone */ }
  live = null;
}
