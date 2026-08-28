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
import { overlayAction } from './input.js';

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

export const CHRONICLE_SECTIONS = Object.freeze([
  ['notes', 'Notes'], ['messages', 'Messages'], ['history', 'History'],
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
 * dateTimeString and cityName (notebook.js:106) - and the finished-
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
export function chronicleModel(d = {}) {
  const nb = d.notebook?.() ?? null;
  const entries = (list) => (list ?? []).map(chronicleEntry).filter((e) => e.head || e.body.length);
  const notes = entries(nb?.getNotes?.());
  const messages = entries(nb?.getMessages?.());
  // The history is already lines - chargen composes backStory as
  // strings, and playerHistory.js reads exactly this.
  const history = (d.entity?.backStory ?? []).map((l) => String(l ?? '')).filter((l) => l.length);
  return { notes, messages, history };
}

function render() {
  if (!host) return;
  host.innerHTML = '';
  const model = chronicleModel(deps);
  const counts = { notes: model.notes.length, messages: model.messages.length, history: model.history.length };

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
    if (!model.history.length) {
      detail.append(el('p', 'px-note', 'Nothing written yet.'));
    } else {
      const p = el('div', 'cr-prose');
      for (const line of model.history) p.append(el('p', null, line));
      detail.append(p);
    }
  } else {
    const rows = model[section];
    // PX24b: THE PLAYER MAY WRITE. The classic notebook has AddNote and
    // RemoveNote (notebook.js:78, :67); the first draft was read-only,
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
        deps.notebook().addNote(text);
        draft = '';
        render();
      };
      compose.append(input, add);
      detail.append(compose);
    }
    if (!rows.length) {
      detail.append(el('p', 'px-note', section === 'notes' ? 'Nothing written yet.' : 'No messages yet.'));
    } else {
      // NEWEST FIRST for messages (the ring's own order is oldest
      // first and the last thing you were told is the thing you
      // opened this for); notes keep the player's OWN order, because
      // they arranged them (MoveNote is a law, notebook.js:64-72).
      const list = section === 'messages'
        ? rows.map((e, i) => ({ e, i })).reverse()
        : rows.map((e, i) => ({ e, i }));
      const box = el('div', 'cr-entries');
      for (const { e, i } of list) {
        const entry = el('div', 'cr-entry');
        const top = el('div', 'cr-head');
        // THE DATE, which the notebook wrote and the first draft lost.
        // A continuation page files with no header (notebook.js:97-107)
        // and honestly says so rather than inventing one.
        top.append(el('span', 'cr-when', e.head ?? '\u2014 continued \u2014'));
        if (section === 'notes' && deps.notebook?.()) {
          const rm = el('button', 'cr-rm', '\u00d7');
          rm.title = 'Remove this note';
          rm.setAttribute('aria-label', 'Remove this note');
          rm.onclick = () => { deps.notebook().removeNote(i); render(); };
          top.append(rm);
        }
        entry.append(top);
        for (const line of e.body) entry.append(el('p', null, line));
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
  section = CHRONICLE_SECTIONS.some(([id]) => id === d.section) ? d.section : 'notes';
  draft = '';
  render();
  window.addEventListener('keydown', onKey, true);
  return {
    render,
    destroy() {
      window.removeEventListener('keydown', onKey, true);
      host = null; deps = {}; section = 'notes'; draft = '';
    },
  };
}
