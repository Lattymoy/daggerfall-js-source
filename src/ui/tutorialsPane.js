// TUT1 (2026-10-11, Mac: "We also need a menu section where tutorials can be revisited. This needs to be
// comprehensive"): THE TUTORIALS PANE - every page of systems/tutorialCatalogue.js, to read again whenever the player
// likes.
//
// ONE PANE, EVERY DOOR: the pause window's Tutorials tab and the front door's Tutorials section draw this same
// function (the Screenshots pane's law - ui/shotsPane.js), so the book a player opens before the game is the one they
// open mid-game.
//
// The journal's bones (PX4): the pages on a left rail under their groups, the chosen page on the right - its title
// inside wing rules, when it pops on its own, its paragraphs, its points as diamond-marked entries. Above the page,
// the popups' switch, Show all again (every page pops once more) and Mark all read. A search over the titles and the
// words narrows the rail. A page never read wears a gem on the rail.
//
// IT DRAWS ITSELF. The pane repaints its own root, never the menu (a click here must not rebuild the window under
// the search box the player is typing in); the menu's repaint builds a new pane, and the old root is let go.

import {
  TUTORIALS,
  TUTORIAL_GROUPS,
  tutorialById,
  tutorialText,
  seenTutorials,
  markTutorialsSeen,
  forgetTutorialsSeen,
  tutorialPopupsOn,
  setTutorialPopups,
} from '../systems/tutorials.js';
import { boundKeyName, clearTutorialLine } from './tutorialPopup.js';

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// THE PANE'S OWN DRESS: the journal's classes are the window's, but the book is long - seventy pages - so the rail and
// the page each scroll inside a pane of fixed height (the window's whole body at pause, the screen less the shell's
// heading at the front door), and the page never scrolls away under the rail.
export const TUTORIALS_STYLE_ID = 'dfo-tutorials-pane-style';
const TUTORIALS_CSS = `
.tut-pane { height: min(calc(100dvh - 200px), 780px); min-height: 320px; }
.px-body > .tut-pane { height: 100%; min-height: 0; }
.tut-pane .tut-journal { height: 100%; min-height: 0; }
.tut-pane .tut-rail { display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.tut-pane .tut-list { flex: 1; overflow-y: auto; min-height: 0; padding-right: 4px; }
.tut-pane .tut-detail { overflow-y: auto; }
.tut-pane .tut-search { font: inherit; font-size: 15px; width: 100%; box-sizing: border-box; padding: 8px 10px;
  background: rgba(10,12,17,0.6); color: #d8cfae; border: 2px solid rgba(125,116,96,0.45); }
.tut-pane .tut-search:focus { outline: none; border-color: rgb(243,239,44); }
.tut-pane .tut-controls { margin: 0 0 14px; }
.tut-pane .tut-controls .acts { flex-wrap: wrap; }
.tut-pane .tut-nav { margin-top: 18px; justify-content: space-between; }
.tut-pane .px-qrow .tut-new { visibility: visible; }
@media (max-width: 720px) { .tut-pane { height: auto; } .tut-pane .tut-list { max-height: 30vh; } }
`;
function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(TUTORIALS_STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = TUTORIALS_STYLE_ID;
  st.textContent = TUTORIALS_CSS;
  (document.head ?? document.body).append(st);
}

// The pane's own state: survives the menu's repaints within a visit (released with the menu).
let selId = TUTORIALS[0].id;
let query = '';
let armedReset = false;
let railScroll = 0; // the rail keeps its place across a repaint - a click far down the book is not a jump to its top

/** The menu's unmount: the next visit opens on the first page with no search. */
export function releaseTutorialsPane() {
  selId = TUTORIALS[0].id;
  query = '';
  armedReset = false;
  railScroll = 0;
}

/** The pages a search keeps: every word of the query in the title or the words (keys left as written). */
export function tutorialsMatching(q) {
  const words = String(q ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [...TUTORIALS];
  return TUTORIALS.filter((t) => {
    const hay = [t.title, t.trigger, ...t.body, ...(t.points ?? [])].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Draw the pane into `body`. */
export function drawTutorialsPane(body) {
  ensureStyle();
  if (body.classList?.contains('body')) body.classList.add('wide'); // the front door's reading column is too narrow for a rail and a page
  const root = el('div', 'tut-pane');
  body.append(root);
  paint(root);
}

function paint(root) {
  const was = root.querySelector?.('.tut-list');
  if (was) railScroll = was.scrollTop;
  root.innerHTML = '';
  const seen = seenTutorials();
  const wrap = el('div', 'px-journal tut-journal');

  // ── THE RAIL ──
  const rail = el('div', 'px-qrail tut-rail');
  const search = el('input', 'tut-search');
  search.type = 'search';
  search.placeholder = 'Search tutorials';
  search.setAttribute('aria-label', 'Search tutorials');
  search.value = query;
  const list = el('div', 'tut-list');
  search.oninput = () => {
    query = search.value;
    list.scrollTop = 0;
    railScroll = 0;
    fillRail(list, root, seen);
  };
  rail.append(search, list);
  fillRail(list, root, seen);
  wrap.append(rail);
  list.scrollTop = railScroll;

  // ── THE PAGE ──
  const detail = el('div', 'px-qdetail px-sys tut-detail');
  detail.append(controls(root, seen));
  const t = tutorialById(selId) ?? TUTORIALS[0];
  const { title, body, points } = tutorialText(t, (a) => boundKeyName(a));
  const head = el('div', 'px-qname');
  head.append(el('span', 'px-qwing'), el('h3', null, title), el('span', 'px-qwing px-flip'));
  detail.append(head);
  const meta = el('div', 'px-qmeta');
  const group = TUTORIAL_GROUPS.find((g) => g.id === t.group);
  meta.append(el('span', 'px-qkind', `${group?.title ?? ''} · ${t.trigger}`));
  detail.append(meta);
  const desc = el('div', 'px-qdesc');
  for (const p of body) desc.append(el('p', null, p));
  detail.append(desc);
  if (points.length) {
    detail.append(el('div', 'px-qgap'));
    for (const p of points) {
      const row = el('div', 'px-qentry');
      row.append(el('span', 'px-qmark', '◆'), el('p', null, p));
      detail.append(row);
    }
  }
  // the neighbours, so the book reads front to back
  const order = TUTORIALS.map((x) => x.id);
  const at = order.indexOf(t.id);
  const nav = el('div', 'acts tut-nav');
  const prev = el('button', 'act', '← Previous');
  prev.disabled = at <= 0;
  prev.onclick = () => {
    select(root, order[at - 1]);
  };
  const next = el('button', 'act primary', 'Next →');
  next.disabled = at >= order.length - 1;
  next.onclick = () => {
    select(root, order[at + 1]);
  };
  nav.append(prev, next);
  detail.append(nav);
  wrap.append(detail);
  root.append(wrap);
  list.scrollTop = railScroll; // again, now that it is laid out
}

/** Reading a page in the book is reading it: it will not pop in the game afterwards. */
function select(root, id) {
  selId = id;
  markTutorialsSeen([id]);
  armedReset = false;
  paint(root);
}

function fillRail(list, root, seen) {
  list.innerHTML = '';
  const kept = new Set(tutorialsMatching(query).map((t) => t.id));
  let first = true;
  for (const g of TUTORIAL_GROUPS) {
    const pages = TUTORIALS.filter((t) => t.group === g.id && kept.has(t.id));
    if (!pages.length) continue;
    list.append(el('div', `px-qarch${first ? ' px-qfirst' : ''}`, g.title));
    first = false;
    for (const t of pages) {
      const b = el('button', `px-qrow${t.id === selId ? ' on' : ''}${seen.has(t.id) ? ' done' : ''}`);
      b.append(el('span', 'px-c', '◆'), document.createTextNode(t.title));
      if (!seen.has(t.id)) {
        const gem = el('span', 'px-qtimed tut-new', '◆');
        gem.title = 'Unread';
        b.append(gem);
      }
      b.onclick = () => select(root, t.id);
      list.append(b);
    }
  }
  if (first) list.append(el('p', 'px-note', 'Nothing found.'));
}

function controls(root, seen) {
  const card = el('div', 'card tut-controls');
  const on = tutorialPopupsOn();
  card.append(el('p', 'meta', `${seen.size} of ${TUTORIALS.length} read. Popups are ${on ? 'on' : 'off'}.`));
  const row = el('div', 'acts');
  const toggle = el('button', on ? 'act' : 'act primary', on ? 'Turn popups off' : 'Turn popups on');
  toggle.onclick = () => {
    setTutorialPopups(!on);
    if (on) clearTutorialLine();
    paint(root);
  };
  const reset = el(
    'button',
    armedReset ? 'act primary' : 'act',
    armedReset ? 'Click again to confirm' : 'Show all again',
  );
  reset.onclick = () => {
    if (!armedReset) {
      armedReset = true;
      paint(root);
      return;
    }
    armedReset = false;
    forgetTutorialsSeen();
    setTutorialPopups(true);
    paint(root);
  };
  const all = el('button', 'act', 'Mark all read');
  all.disabled = seen.size >= TUTORIALS.length;
  all.onclick = () => {
    markTutorialsSeen(TUTORIALS.map((t) => t.id));
    clearTutorialLine();
    armedReset = false;
    paint(root);
  };
  row.append(toggle, reset, all);
  card.append(row);
  return card;
}
