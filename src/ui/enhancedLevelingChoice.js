// LEVEL-PLUS (2026-09-30, Mac: "Overhaul the oblivion/daggerfall selector for leveling mode. Give it the enhanced
// ui plus theme.") - THE LEVELING QUESTION'S ENHANCED PLUS FACE.
//
// The question itself - its options, its cursor, its one answer - stays ui/levelingChoice.js's LevelingChoiceScreen,
// the window every chargen host already holds in its one overlay slot. This is only its FACE on the Enhanced Plus
// skin: the Plus window (the rest window's shell - `px-home px-over`, a `px-win` with its four corner gems, a
// `px-body` holding one `.card`) instead of text over a dim, so the Plus theme's stone and colour dress it like every
// other window of the skin. The classic skin keeps the canvas screen, untouched.
//
// THE FACE IS DRAWN, NOT OWNED - the yes/no card's law (ui/yesNoBox.js): the screen's draw() calls drawLevelingFace
// every frame, the face mirrors the screen's cursor and locks, and a draw watchdog takes it down when the draws stop
// (a host gone without closing it). Its buttons answer THROUGH the screen (`click`-equivalent: pick and answer), so
// the fire-once latch stays the screen's alone. Keys still reach the screen through the host's overlay seam, as they
// always have; the face adds none of its own.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { armDrawWatchdog, disarmDraw } from './drawWatchdog.js';

export const LEVELING_FACE_ID = 'enhanced-leveling';
/** The face leaves when its draws stop (the yes/no card's 400 ms). */
export const LEVELING_FACE_WATCHDOG_MS = 400;
/** The words the face adds around the options (the options' own words are levelingOptions'). */
export const LEVELING_FACE_TEXT = Object.freeze({
  eyebrow: 'A new character',
  title: 'How will you grow?',
  lead: 'Choose how this character will level. It cannot be changed later.',
  pick: 'Choose',
  hint: 'Click one · up/down and Enter · 1 or 2',
});
/** Each option's short tag, beside its title. */
export const LEVELING_FACE_TAGS = Object.freeze({ classic: 'Classic', virtue: 'Skill bar' });

let face = null;   // { owner, root, opts: [{ node, id }], key }
let watchdog = null;
let schedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
let cancel = (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); };
export function _setLevelingFaceClockForTests(s, c) { schedule = s ?? schedule; cancel = c ?? cancel; }

function el(doc, tag, cls, text) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function buildFace(doc, owner) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const shell = el(doc, 'div', 'px-home px-over lvl-shell');
  shell.id = LEVELING_FACE_ID;
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.setAttribute('aria-labelledby', `${LEVELING_FACE_ID}-title`);
  // LEGACY-CHOICE: three answers (Project Legacy's online popup) widen the window to stand them side by side
  const win = el(doc, 'div', owner.options.length >= 3 ? 'px-win lvl-win lvl-three' : 'px-win lvl-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el(doc, 'span', `px-gem px-corner px-${c}`));
  const body = el(doc, 'div', 'px-body');
  const card = el(doc, 'div', 'card lvl-card');
  const words = owner.faceText ?? LEVELING_FACE_TEXT;   // LEGACY2: another one-time question's own words on the same face
  const tags = owner.faceTags ?? LEVELING_FACE_TAGS;
  const eyebrow = el(doc, 'div', 'lvl-eyebrow', words.eyebrow);
  const title = el(doc, 'h2', 'lvl-title', words.title);
  title.id = `${LEVELING_FACE_ID}-title`;
  const lead = el(doc, 'p', 'lvl-lead', words.lead);
  const list = el(doc, 'div', 'lvl-opts');
  list.setAttribute('role', 'radiogroup');
  const opts = owner.options.map((opt, i) => {
    const node = el(doc, 'button', 'lvl-opt');
    node.type = 'button';
    node.setAttribute('role', 'radio');
    node.dataset.id = opt.id;
    const head = el(doc, 'div', 'lvl-opt-head');
    head.append(el(doc, 'span', 'lvl-key', String(i + 1)), el(doc, 'span', 'lvl-opt-title', opt.title),
      el(doc, 'span', 'lvl-tag', tags[opt.id] ?? ''));
    const lines = el(doc, 'p', 'lvl-opt-body', opt.lines.join(' '));
    const foot = el(doc, 'div', 'lvl-opt-foot');
    foot.append(opt.locked ? el(doc, 'span', 'lvl-lock', opt.lockNote) : el(doc, 'span', 'lvl-pick', words.pick));
    node.append(head, lines, foot);
    if (opt.locked) { node.disabled = true; node.setAttribute('aria-disabled', 'true'); }
    node.onpointerenter = () => owner.hoverIndex(i);
    node.onclick = () => owner.pickIndex(i);
    list.append(node);
    return { node, id: opt.id };
  });
  const hint = el(doc, 'div', 'lvl-hint', words.hint);
  card.append(eyebrow, title, lead, list, hint);
  body.append(card);
  win.append(body);
  shell.append(win);
  doc.body.append(shell);
  return { owner, root: shell, opts, key: null };
}

/** One frame of the face for `owner` (a LevelingChoiceScreen). Returns the root, or null off a document. */
export function drawLevelingFace(owner, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc) return null;
  if (face && face.owner !== owner) releaseLevelingFace(face.owner);
  if (!face) face = buildFace(doc, owner);
  disarmDraw(watchdog);
  watchdog = armDrawWatchdog(LEVELING_FACE_WATCHDOG_MS, () => { if (face?.owner === owner) releaseLevelingFace(owner); }, { schedule, cancel });
  const key = String(owner.cursor);
  if (face.key !== key) {
    face.key = key;
    face.opts.forEach(({ node }, i) => {
      const on = i === owner.cursor;
      node.classList.toggle('is-on', on);
      node.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  return face.root;
}

/** The question answered (or its draws stopped): the face goes. A no-op for a screen whose face is not the one up. */
export function releaseLevelingFace(owner) {
  if (!face || face.owner !== owner) return;
  disarmDraw(watchdog); watchdog = null;
  try { face.root.remove(); } catch { /* already gone */ }
  face = null;
}
/** Whose face is up (tests). */
export const levelingFaceOwner = () => face?.owner ?? null;
