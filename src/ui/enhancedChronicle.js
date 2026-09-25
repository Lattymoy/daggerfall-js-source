// PX24 - THE CHRONICLE.
//
// Mac: "with the logbook and history, I want them as one detailed UI."
//
// One window over three sections, because what the logbook and the
// history hold is one subject - THE THINGS WRITTEN DOWN ABOUT YOU:
//
//   NOTES      what you wrote yourself (PlayerNotebook.getNotes)
//   MESSAGES   what you were sent (the 50-slot ring, getMessages)
//   HISTORY    where you came from (entity.backStory, chargen's own)
//
// Quests are NOT here. The classic logbook carries active and finished
// quests as two of its four modes, and the pause window's Quests tab
// has carried both since PX4 - in three named sections since PX22.
// Putting them here as well would be the two character sheets again.
// So the chronicle takes the two logbook modes that have no home and
// the history beside them, and the door's comment says so.
//
// THE BONES ARE THE JOURNAL'S, a sixth time: a rail of sections on the
// left, the chosen one on the right under wing rules. The rail carries
// a COUNT beside each name, because "Notes 0" answers the question a
// player opens this window with before they have clicked anything.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { closeOnOutsideTap } from './enhancedOverlays.js';   // OT1
import { overlayAction, eventMeans } from './input.js';   // LV1's audit: the REGISTRY's answer (AUDIT KB1: `eventAction`, the event's own read) for the key this window is named after
import { questRail, questTitleOf } from './questRail.js';   // MAC-K2: the ONE quest walk, shared with the pause window's Quests tab
import { breakableNote } from '../systems/notebook.js';   // JOURNAL1: a note the notebook's wrap can take, whatever was typed
import { pageOfNote, pageRefusalText } from '../net/journalPage.js';   // JOURNAL1: a note as the page it would be shown as, or why it cannot be

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let host = null;
let deps = {};
let onExit = () => {};
let section = 'notes';
let draft = '';   // PX24b: the note being written, kept across renders
// JOURNAL1: WHICH NOTE'S SHARE IS OPEN (its notebook index, or null), and what the last share said - a reading
// position like a fold: kept across renders, cleared on mount.
let sharing = null;
let shareWord = '';
// MAC-F (Mac: "Quests and their tabs should be able to be minimized").
// WHICH CARDS THE PLAYER HAS SHUT, as `section:index`. A quest's whole
// trail is its body and twelve of them is a wall of text; the classic
// logbook answers that with four-lines-and-a-Next-button, this window
// answers it by letting a card fold to its head. Kept across renders
// and across a tab change, cleared on mount - a fold is a reading
// position, not a saved setting, and nothing on disk should learn it.
const folded = new Set();

// MAC-K2 (Mac: "Logbook not reflecting quests"). QUESTS GOES FIRST,
// and it is the section this window was missing entirely. The L key
// (`LogBook`, InputManager's own name for it) opens this window; the
// three sections it had were Notes, Messages and History, none of
// which is a quest, and `chronicleDoor.js` was being handed
// `questMessages` by all four hosts while `chronicleModel` never read
// it - a dep in, nothing out. A player pressing the key named after
// the job got their notebook.
//
// It leads because it is what the key is FOR. Notes, Messages and
// History keep their order behind it.
export const CHRONICLE_SECTIONS = Object.freeze([
  ['quests', 'Quests'], ['notes', 'Notes'], ['messages', 'Messages'], ['history', 'History'],
]);

const LINE_FORMATTINGS = new Set(['text', 'newline', 'highlight', 'question', 'answer']);

/** Flat lines, when all that is wanted is the text. */
export function chronicleLines(entry) {
  const tokens = Array.isArray(entry) ? entry : (entry?.getTextTokens?.() ?? []);
  return tokens.filter((t) => LINE_FORMATTINGS.has(t?.formatting)).map((t) => String(t?.text ?? ''));
}

/**
 * PX24b: AN ENTRY HAS A HEAD, and the first draft threw it away.
 *
 * `PlayerNotebook._createNote` puts a HIGHLIGHT token first - the
 * dated header, `noteHeader` formatted with the host's own
 * dateTimeString and cityName (notebook.js:108) - and the finished-
 * quest filing does the same (:179). Flattening every token to a
 * string turned that date into just another line, and the window
 * numbered its entries 1, 2, 3 instead, which tells a player nothing.
 *
 * So: the leading highlight is the HEAD, the rest is the body. This is
 * the same split enhancedMenu's `parseFinished` makes on the same
 * shape, and a continuation page - which notebook.js deliberately
 * files with NO header (:97-107) - correctly comes back headless.
 */
export function chronicleEntry(entry) {
  const tokens = Array.isArray(entry) ? entry : (entry?.getTextTokens?.() ?? []);
  const kept = tokens.filter((t) => LINE_FORMATTINGS.has(t?.formatting));
  const head = kept[0]?.formatting === 'highlight' ? String(kept[0].text ?? '') : null;
  const body = (head === null ? kept : kept.slice(1)).map((t) => String(t?.text ?? '')).filter((l) => l.length);
  return { head, body };
}

/**
 * What each section holds, as rows of lines. Pure: the whole model the
 * window draws, and the only place that knows where each comes from.
 */
/**
 * PX24c: WHAT A MESSAGE IS, checked rather than assumed.
 *
 * `addMessage` builds `[{formatting:'center', text:''}, {text: str}]`
 * (notebook.js:125) - a CENTRE token and the words. It never writes a
 * highlight, so a message has NO dated head, ever. PX24b's fallback
 * printed "- continued -" on every one of them, which is a lie about
 * all fifty: a continuation is a note whose page split, and a message
 * simply has no header to begin with.
 *
 * The ring DOES unwrap correctly - `getMessages` walks from
 * nextMessageIndex round to it (:114-118), so what comes back is
 * chronological even after the fiftieth message overwrites the first.
 * Verified rather than assumed; the reverse below is right because of
 * that, not by luck.
 */
export function chronicleModel(d = {}) {
  const nb = d.notebook?.() ?? null;
  // JOURNAL1: each entry keeps its INDEX IN THE NOTEBOOK. An empty entry is dropped from the drawing, so a card's
  // place in the list is not the note's place in the notebook once one is - and the remove (and the share) must act
  // on the note the card draws, not on the one that happens to sit at the card's position.
  const entries = (list) => (list ?? []).map((t, index) => ({ ...chronicleEntry(t), index })).filter((e) => e.head || e.body.length);
  const notes = entries(nb?.getNotes?.());
  const messages = entries(nb?.getMessages?.());
  // MAC-K2: the quests, through the SAME walk the pause window's
  // Quests tab uses (ui/questRail.js) - so the two faces cannot
  // disagree about which quests are live or what they say. Each quest
  // becomes one entry: its title as the head, its trail as the body,
  // NEWEST STEP FIRST (`entries` arrives oldest-first from the
  // machine's log and the last thing you were told is the thing you
  // opened this for - the same reading the Messages section makes).
  // The archive follows the live ones, as the rail files it.
  const log = d.questLog?.() ?? null;
  const rail = log ? questRail(log) : { active: [], finished: [] };
  const quests = [
    ...rail.active.map((q) => ({
      head: questTitleOf(q.name),
      body: [...q.entries].reverse().flat(),
      uid: q.id,
      questName: q.questName,
      main: q.main,
    })),
    ...rail.finished.map((q) => ({
      head: `${questTitleOf(q.name)}${q.when ? ` \u2014 ${q.success === false ? 'ended' : 'completed'} ${q.when}` : ''}`,
      body: [...q.lines],
    })),
  ].filter((e) => e.head || e.body.length);
  // The history is already lines - chargen composes backStory as
  // strings, and playerHistory.js reads exactly this.
  const history = (d.entity?.backStory ?? []).map((l) => String(l ?? '')).filter((l) => l.length);
  return { quests, notes, messages, history };
}

/** MAC-F: the fold laws, kept pure so a node test can drive them with
 *  no DOM. The store is a plain Set of keys and the window owns one. */
export const foldKey = (sec, index) => `${sec}:${index}`;
export const isFolded = (store, sec, index) => !!store?.has(foldKey(sec, index));
export function toggleFold(store, sec, index) {
  const k = foldKey(sec, index);
  if (store.has(k)) store.delete(k); else store.add(k);
  return store;
}
/** Whether EVERY card in a section is shut - which is what decides
 *  whether the section's own control offers to collapse or expand. An
 *  empty section is not "all folded": there is nothing to fold. */
export const allFolded = (store, sec, count) =>
  count > 0 && Array.from({ length: count }, (_, i) => foldKey(sec, i)).every((k) => store.has(k));
/** Fold or unfold a whole section at once. */
export function setSectionFold(store, sec, count, shut) {
  for (let i = 0; i < count; i++) {
    if (shut) store.add(foldKey(sec, i)); else store.delete(foldKey(sec, i));
  }
  return store;
}

/**
 * JOURNAL1: ONE NOTE'S SHARE - the note as the page it would be shown as (net/journalPage.js pageOfNote: the notebook's
 * own lines through the wire's page law), or, when the law refuses it, why; then WHO it can be shown to - the players
 * the host counts near enough to talk to, nearest first, one button each - or the host's word on why nobody can be; and
 * the letter, which closes this window so the letters can open on the page. What the last press did is said under it.
 */
function shareStrip(share, index) {
  const box = el('div', 'cr-sharebox');
  const r = pageOfNote(deps.notebook?.()?.getNote?.(index));
  if (!('page' in r)) {
    box.append(el('div', 'cr-shareword', pageRefusalText(r.error)));
    return box;
  }
  const row = el('div', 'cr-sharerow');
  row.append(el('span', 'cr-sharelabel', 'Show to'));
  const readers = Array.isArray(share.readers) ? share.readers : [];
  if (readers.length) {
    for (const p of readers) {
      const b = el('button', 'act', p.name);
      b.type = 'button';
      b.title = `Hold this page out to ${p.name}`;
      b.onclick = () => { shareWord = share.show?.(p.id, r.page) ?? ''; render(); };
      row.append(b);
    }
  } else {
    row.append(el('span', 'cr-sharewhy', share.why || 'No one is near enough to show it to.'));
  }
  box.append(row);
  if (share.letter) {
    const b = el('button', 'act', 'Send as a letter');
    b.type = 'button';
    b.title = 'Write this page into a letter, to anyone';
    b.onclick = () => {
      const w = share.letter(r.page);
      if (w === true) { onExit(); return; }   // the letters open on the page once this window is down
      shareWord = typeof w === 'string' ? w : '';
      render();
    };
    const letterRow = el('div', 'cr-sharerow');
    letterRow.append(b);
    box.append(letterRow);
  }
  if (shareWord) box.append(el('div', 'cr-shareword', shareWord));
  return box;
}

function render() {
  if (!host) return;
  host.innerHTML = '';
  const model = chronicleModel(deps);
  const counts = { quests: model.quests.length, notes: model.notes.length, messages: model.messages.length, history: model.history.length };

  const shell = el('div', 'px-home px-over cr-shell');
  const win = el('div', 'px-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  const head = el('header', 'sb-top');
  const who = el('div', 'sb-who');
  who.append(el('h2', null, 'Chronicle'));
  const name = deps.entity?.name;
  if (name) who.append(el('p', 'sb-magicka', name));
  head.append(el('span', 'sb-spacer'), who);
  const close = el('button', 'act', 'Close');
  close.onclick = () => onExit();
  head.append(close);
  win.append(head);

  const body = el('div', 'px-body');
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const [id, label] of CHRONICLE_SECTIONS) {
    const b = el('button', `px-qrow cr-row${id === section ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label));
    b.append(el('span', 'sb-cost', String(counts[id])));
    b.onclick = () => { section = id; render(); };
    rail.append(b);
  }
  wrap.append(rail);

  const detail = el('div', 'px-qdetail');
  const label = CHRONICLE_SECTIONS.find(([id]) => id === section)?.[1] ?? '';
  const title = el('div', 'px-qname');
  title.append(el('span', 'px-qwing'), el('h3', null, label), el('span', 'px-qwing px-flip'));
  detail.append(title);

  if (section === 'history') {
    // ONE PAGE, NOT PAGINATED. The classic window pages because it
    // draws into a fixed 320x200 panel; a DOM column scrolls, and a
    // life story read in one column beats one read four lines at a
    // time with a Next button.
    // PX24c: WHO THIS IS, which the window held and never said. The
    // entity carries race, career and level - the same three the pause
    // window's Stats page reads through sheetModel - and a life story
    // with no one's name on it is a page of prose. Each part appears
    // only if it is there.
    const who = [deps.entity?.race, deps.entity?.career?.name].filter(Boolean).join(' ');
    const lvl = Number.isFinite(deps.entity?.level) ? `Level ${deps.entity.level}` : null;
    if (who || lvl) {
      const line = el('div', 'sb-frame');
      if (who) line.append(el('span', 'sb-chip', who));
      if (lvl) line.append(el('span', 'sb-chip', lvl));
      detail.append(line);
    }
    if (!model.history.length) {
      detail.append(el('p', 'px-note', 'Nothing written yet.'));
    } else {
      const p = el('div', 'cr-prose');
      for (const line of model.history) p.append(el('p', null, line));
      detail.append(p);
    }
  } else {
    const rows = model[section];
    // JOURNAL1: THE HOST'S WORD ON SHARING A PAGE, once a render - a NOTE's alone (a message is what I was told, a quest
    // shares through the party, the history is chargen's), and null offline, where nothing is drawn.
    const share = section === 'notes' && deps.notebook?.() ? (deps.pageShare?.() ?? null) : null;
    // PX24b: THE PLAYER MAY WRITE. The classic notebook has AddNote and
    // RemoveNote (notebook.js:80, :69); the first draft was read-only,
    // which is a LOSS of function dressed as a nicer window. The
    // composer sits above the entries, where a new note lands.
    if (section === 'notes' && deps.notebook?.()) {
      const compose = el('form', 'cr-compose');
      const input = el('input');
      input.type = 'text';
      input.placeholder = 'Write a note';
      input.maxLength = 200;
      input.value = draft;
      input.oninput = () => { draft = input.value; };
      const add = el('button', 'act primary', 'Add');
      add.type = 'submit';
      compose.onsubmit = (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text) return;
        // The notebook's own AddNote - it wraps the lines and stamps
        // the dated header itself, from the host's clock and city.
        // JOURNAL1: through breakableNote first. This box takes 200
        // characters and DFU's took 70, and the wrap THROWS on a run
        // of 71 with no space (notebook.js) - a pasted address threw out
        // of this handler and the note was lost.
        deps.notebook().addNote(breakableNote(text));
        draft = '';
        render();
      };
      compose.append(input, add);
      detail.append(compose);
    }
    if (!rows.length) {
      detail.append(el('p', 'px-note', section === 'notes' ? 'Nothing written yet.'
        : (section === 'quests' ? 'No active quests.' : 'No messages yet.')));
    } else {
      // NEWEST FIRST for messages (the ring's own order is oldest
      // first and the last thing you were told is the thing you
      // opened this for); notes keep the player's OWN order, because
      // they arranged them (MoveNote is a law, notebook.js:66-74).
      const list = section === 'messages'
        ? rows.map((e, i) => ({ e, i })).reverse()
        : rows.map((e, i) => ({ e, i }));
      // MAC-F: THE WHOLE TAB AT ONCE. Folding twelve quests one at a
      // time to see the twelve titles is the wall of text again with
      // extra clicks in it, so the section carries the same control
      // its cards do - and it reads the cards rather than keeping a
      // flag of its own, so folding the last one by hand flips it.
      const shutAll = allFolded(folded, section, rows.length);
      const every = el('button', 'px-qrow cr-foldall');
      every.append(el('span', 'px-c', shutAll ? '\u25b8' : '\u25be'),
        document.createTextNode(shutAll ? 'Expand all' : 'Collapse all'));
      every.onclick = () => { setSectionFold(folded, section, rows.length, !shutAll); render(); };
      detail.append(every);
      const box = el('div', 'cr-entries');
      for (const { e, i } of list) {
        // MAC-F: a SHUT card says so in its own class, so the head's
        // divider can go with the body it was dividing from - a card
        // that keeps a rule under its title looks like a card whose
        // body failed to draw.
        const entry = el('div', `cr-entry${isFolded(folded, section, i) ? ' cr-shut' : ''}`);
        const top = el('div', 'cr-head');
        // THE DATE, which the notebook wrote and PX24 lost. A NOTE
        // whose page split files with no header (notebook.js:99-109)
        // and says so; a MESSAGE never has one at all, so it gets the
        // only true thing there is to say - which of them is newest.
        const head = e.head ?? (section === 'messages'
          ? (i === rows.length - 1 ? 'Most recent' : null)
          : '\u2014 continued \u2014');
        // MAC-F: THE HEAD IS THE HANDLE. The caret and the date are one
        // button - a card folds by clicking the thing you were already
        // reading, and the remove stays its own control beside it
        // rather than nested inside a button, which is not HTML.
        const shut = isFolded(folded, section, i);
        const fold = el('button', 'cr-fold');
        fold.append(el('span', 'px-c cr-caret', shut ? '\u25b8' : '\u25be'));
        fold.append(el('span', 'cr-when', head ?? ''));
        fold.setAttribute('aria-expanded', String(!shut));
        fold.title = shut ? 'Expand this entry' : 'Collapse this entry';
        fold.onclick = () => { toggleFold(folded, section, i); render(); };
        top.append(fold);
        if (!head) top.classList.add('cr-headless');
        // JOURNAL1 (Addison Knox: "Player journals ... shared in-world for storytelling"): a note's Share - never DFU's.
        // It opens the note's own strip below its head (shareStrip): the players near enough to talk to, to hold the
        // page out to, and the letter. Drawn only where the host can share at all (`pageShare`, online-only).
        if (share) {
          const sh = el('button', 'cr-rm cr-share', 'Share');
          sh.title = 'Show this page to someone near you, or send it as a letter';
          sh.setAttribute('aria-label', 'Share this page');
          sh.setAttribute('aria-expanded', String(sharing === e.index));
          sh.onclick = () => { sharing = sharing === e.index ? null : e.index; shareWord = ''; render(); };
          top.append(sh);
        }
        if (section === 'notes' && deps.notebook?.()) {
          const rm = el('button', 'cr-rm', '\u00d7');
          rm.title = 'Remove this note';
          rm.setAttribute('aria-label', 'Remove this note');
          rm.onclick = () => { deps.notebook().removeNote(e.index); sharing = null; render(); };
          top.append(rm);
        }
        // QUEST1: the share button - never DFU's. Lives in every quest's
        // own header row, folded or not, set off to the right of the
        // fold/date the way a note's remove button already sits. ONLY
        // an active, NON-MAIN quest (e.main, questRail's own
        // isMainQuest - the storyline is the same one thread for
        // everyone already, not a side or guild quest's own copy to
        // hand off) and ONLY with a party to offer it to
        // (deps.partyMembers, an online-only seam - a host with no
        // online layer supplies none, so this never draws offline).
        if (section === 'quests' && e.uid != null && !e.main
          && (deps.partyMembers?.() ?? []).length) {
          const share = el('button', 'cr-rm cr-share', 'Share');
          share.title = 'Share this quest with your party';
          share.setAttribute('aria-label', 'Share this quest with your party');
          share.onclick = () => { deps.shareQuest?.(e.uid, e.questName, e.head); };
          top.append(share);
        }
        entry.append(top);
        if (share && sharing === e.index) entry.append(shareStrip(share, e.index));
        if (!isFolded(folded, section, i)) {
          for (const line of e.body) entry.append(el('p', null, line));
        }
        box.append(entry);
      }
      detail.append(box);
    }
  }
  wrap.append(detail);
  body.append(wrap);
  win.append(body);
  shell.append(win);
  host.append(shell);
  closeOnOutsideTap(shell, '.px-win', () => onExit());   // OT1 (Mac: a tap outside the window closes it)
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); e.stopPropagation();
    const i = CHRONICLE_SECTIONS.findIndex(([id]) => id === section);
    const n = CHRONICLE_SECTIONS.length;
    section = CHRONICLE_SECTIONS[(i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n][0];
    render();
    return;
  }
  // LV1's AUDIT, recorded there and closed here: THE KEY THAT OPENED
  // THIS WINDOW PUTS IT AWAY.
  //
  // MAC-C gave the sheet and the pack exactly this arm ("you can exit
  // out of the F6 menu (inventory) by pressing F6 again, but you
  // cannot do the same for the F5 one") and the chronicle was left
  // out - so L opened it and L did NOTHING, which is worse than it
  // sounds: the host swallows the key for an `isChoiceWindow` overlay
  // (ui/input.js's routeKey and townTalk's own seam both hand the raw
  // code to the window and return), so the press was consumed and
  // answered by nobody. A key that is eaten in silence is
  // indistinguishable from a key that was not received.
  //
  // OFF THE REGISTRY, never the literal: `LogBook` is InputManager's
  // own name for this door, and a rebound key that cannot close the
  // window it opened is the same bug one layer down (FIX-F's, and I2's
  // before it). A text field keeps its own keys - the note composer is
  // a real <input> and 'l' belongs to it (CG2) - which the guard at
  // the top of this handler already ensures.
  if (eventMeans(e, 'LogBook')) {   // UXB1-S: its key, shared or not
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) onExit();   // AUDIT KB1: the press closes; a held key's repeat is swallowed, not an open-shut flicker
    return;
  }
  if (overlayAction(e) !== 'back') return;
  e.preventDefault();
  e.stopPropagation();
  onExit();
}

export function mountEnhancedChronicle(hostEl, d = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  deps = d;
  onExit = d.onExit ?? (() => {});
  section = CHRONICLE_SECTIONS.some(([id]) => id === d.section) ? d.section : 'quests';
  draft = '';
  sharing = null; shareWord = '';   // JOURNAL1: a fresh open shares nothing yet
  folded.clear();   // MAC-F: a fresh open reads whole, as it always has
  render();
  window.addEventListener('keydown', onKey, true);
  return {
    render,
    destroy() {
      window.removeEventListener('keydown', onKey, true);
      host = null; deps = {}; section = 'notes'; draft = ''; folded.clear(); sharing = null; shareWord = '';
    },
  };
}
