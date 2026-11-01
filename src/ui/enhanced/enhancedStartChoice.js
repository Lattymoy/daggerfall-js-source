// START2 (bible/06-Systems/Alternate-Starts-Arc.md section 7) - THE START-CHOICE PAGE'S ENHANCED PLUS FACE.
//
// The question itself - its starts, its cursor, its one answer - stays ui/startChoice.js's StartChoiceScreen. This is
// its FACE on the Enhanced Plus skin, in the leveling question's own shell (ui/enhanced/enhancedLevelingChoice.js: the
// rest window's `px-home px-over`, a `px-win` with its four gems, one `.card` - its eyebrow, heading, lead and hint):
// the eight starts as a list down the left, and the chosen one's story on the right - where it begins and why
// (stacked on a phone). DRAWN, NOT OWNED - the yes/no card's law: the screen's draw() calls drawStartChoiceFace each
// frame, the face mirrors the cursor, a draw watchdog takes it down when the draws stop, and its rows answer THROUGH
// the screen (hoverIndex, pressIndex, pickIndex), so the fire-once latch stays the screen's. Keys reach the screen through the
// host's overlay seam; the face adds none.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { armDrawWatchdog, disarmDraw } from '../drawWatchdog.js';

export const START_FACE_ID = 'enhanced-start-choice';
/** The face leaves when its draws stop (the leveling face's 400 ms). */
export const START_FACE_WATCHDOG_MS = 400;

let face = null; // { owner, root, rows: [node], detail: { where, title, body, note }, key }
let watchdog = null;
let schedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
let cancel = (t) => {
  if (t != null && typeof clearTimeout === 'function') clearTimeout(t);
};
export function _setStartFaceClockForTests(s, c) {
  schedule = s ?? schedule;
  cancel = c ?? cancel;
}

function el(doc, tag, cls, text) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function buildFace(doc, owner) {
  const words = owner.text; // the screen's own words (ui/startChoice.js START_CHOICE_TEXT)
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const shell = el(doc, 'div', 'px-home px-over lvl-shell stc-shell');
  shell.id = START_FACE_ID;
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.setAttribute('aria-labelledby', `${START_FACE_ID}-title`);
  const win = el(doc, 'div', 'px-win lvl-win stc-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el(doc, 'span', ['px-gem', 'px-corner', `px-${c}`].join(' '))); // a gem a corner
  const body = el(doc, 'div', 'px-body');
  const card = el(doc, 'div', 'card lvl-card');
  const title = el(doc, 'h2', 'lvl-title', words.heading);
  title.id = `${START_FACE_ID}-title`;
  const grid = el(doc, 'div', 'stc-grid');
  const list = el(doc, 'div', 'stc-list');
  list.setAttribute('role', 'radiogroup');
  const rows = owner.options.map((opt, i) => {
    const node = el(doc, 'button', 'stc-opt');
    node.type = 'button';
    node.setAttribute('role', 'radio');
    node.dataset.id = opt.id;
    node.append(
      el(doc, 'span', 'lvl-key', String(i + 1)),
      el(doc, 'span', 'stc-opt-title', opt.title),
      el(doc, 'span', 'lvl-tag', opt.locked ? opt.lockNote : opt.homeland ? words.homeland : ''),
    );
    if (opt.locked) {
      node.disabled = true;
      node.setAttribute('aria-disabled', 'true');
    }
    node.onpointerenter = () => owner.hoverIndex(i);
    node.onclick = () => owner.pressIndex(i); // AUDIT STARTS U3: a tap selects, and answers once its story is up
    list.append(node);
    return node;
  });
  const side = el(doc, 'div', 'stc-detail');
  side.setAttribute('aria-live', 'polite');
  const detail = {
    title: el(doc, 'div', 'stc-detail-title'),
    where: el(doc, 'div', 'stc-detail-where'),
    body: el(doc, 'p', 'lvl-opt-body stc-detail-body'),
  };
  const pick = el(doc, 'button', 'stc-pick', words.pick);
  pick.type = 'button';
  pick.onclick = () => owner.pickIndex(owner.cursor);
  side.append(detail.title, detail.where, detail.body, pick);
  grid.append(list, side);
  card.append(
    el(doc, 'div', 'lvl-eyebrow', words.eyebrow),
    title,
    el(doc, 'p', 'lvl-lead', words.lead),
    grid,
    el(doc, 'div', 'lvl-hint', words.hint(owner.options.length)),
  );
  body.append(card);
  win.append(body);
  shell.append(win);
  doc.body.append(shell);
  return { owner, root: shell, rows, detail, key: null };
}

/** One frame of the face for `owner` (a StartChoiceScreen). Returns the root, or null off a document. */
export function drawStartChoiceFace(owner, doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return null;
  if (face && face.owner !== owner) releaseStartChoiceFace(face.owner);
  if (!face) face = buildFace(doc, owner);
  disarmDraw(watchdog);
  watchdog = armDrawWatchdog(
    START_FACE_WATCHDOG_MS,
    () => {
      if (face?.owner === owner) releaseStartChoiceFace(owner);
    },
    { schedule, cancel },
  );
  const key = String(owner.cursor);
  if (face.key !== key) {
    face.key = key;
    face.rows.forEach((node, i) => {
      const on = i === owner.cursor;
      node.classList.toggle('is-on', on);
      node.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const opt = owner.options[owner.cursor];
    face.detail.title.textContent = opt?.title ?? '';
    face.detail.where.textContent = opt?.where ?? '';
    face.detail.body.textContent = opt?.body ?? '';
  }
  return face.root;
}

/** The question answered (or its draws stopped): the face goes. A no-op for a screen whose face is not the one up. */
export function releaseStartChoiceFace(owner) {
  if (!face || face.owner !== owner) return;
  disarmDraw(watchdog);
  watchdog = null;
  try {
    face.root.remove();
  } catch {
    /* already gone */
  }
  face = null;
}
/** Whose face is up (tests). */
export const startChoiceFaceOwner = () => face?.owner ?? null;
