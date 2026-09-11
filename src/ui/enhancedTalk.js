// ET1 - THE ENHANCED TALK PANEL (2026-09-11).
//
// Mac: "the talk menu. My goal is to transform it into a rectangular
// panel akin to Fallout/Skyrim instead of a full screen menu."
//
// So this is a PANEL, not a screen: a framed rectangle across the
// bottom of the view with the world still standing behind it - the
// person you are talking to stays in sight, which is the whole point
// of the reference. Nothing here is a scrim and nothing here is a
// 320x200 page.
//
// ── PAINT AND BONES, THE SPELLBOOK'S RULE (PX23) ─────────────────
//
// This window owns NO conversation law. Every press lands on the
// classic NativeTalkWindow (ui/nativeTalk.js), which is the model
// under BOTH faces: its `press(name)` is the one handler per button
// (the sound, the greyed-category gate, the toneLastUsed guard, the
// OKAY-asks-the-selected-topic arm), and its three index arms are the
// listboxes' own MouseClick / MouseDoubleClick laws. The pages
// (Tell me about, Where is > Location/People/Things/Work), the
// selection model (a press SELECTS and fills the player-says line; a
// second press or ASK uses it), the Q/A pair, the logbook's copy set
// and the OnPop note it files - all of it is read out of the model's
// state after each press and drawn again. The classic face's draw()
// is simply never called.
//
// ── WHAT THE PANEL DRAWS ─────────────────────────────────────────
//
//   head   the NPC's portrait (the same TFAC00I0/FACES.CIF record
//          SetNPCPortrait chose, painted as pixels into a <canvas>)
//          and name; the three tones as a segmented control; Goodbye.
//   main   LEFT the conversation - answers on the left in bone,
//          your questions on the right in DFU's question blue, the
//          selected entry ruled in brass, a copied one marked.
//          RIGHT the topics - the two modes, the four categories
//          (greyed under Tell me about as TALK02I0 greys them), and
//          the list; a category page carries a way back to the
//          category list, which DFU's own NavigationBack row is.
//   foot   the player-says line (the pending question at the current
//          tone) with ASK beside it, and the logbook's copy button.
//
// ── THE KEYS ─────────────────────────────────────────────────────
//
// The host routes raw codes to the door (isChoiceWindow), and the
// door maps them here. DFU's own DialogShortcuts row comes first,
// through the model's input() (ET1-AUDIT F1: A/W/L/P/T/J/O/G/C and
// F1-F3 - the same presses a click makes), then the classic's Esc/E
// goodbye, digits and N. TWO ARE OURS: Enter ASKS the selected topic
// and the arrows move the selection (sideways steps the tone) - Enter
// closing a dialogue panel would be the one thing a Skyrim player
// never expects, and the classic's Enter-closes was only ever the
// interim ChoiceWindow's key kept alive.
//
// ── WHAT IT DOES NOT DO ──────────────────────────────────────────
//
// It reads no ARENA2 but the portrait (which the classic decodes
// anyway), so it needs no talk art loaded - the door's readiness gate
// says so. The topic list's PixelWise scroll and horizontal pan
// (AUDIT 58) are the classic face's answers to a 94-pixel box; a
// DOM list scrolls itself and a long topic wraps, so the model's
// scroll fields go unread here and the digit accelerators count from
// the top of the list.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { npcPortraitPixels, npcPortraitKey } from './nativeTalk.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** DFU's three tone buttons, in TalkToneToIndex order (townTalk.js
 *  TONE_NAMES is the same three words; the scenes layer is not this
 *  file's import). */
export const TONE_LABELS = Object.freeze(['Polite', 'Normal', 'Blunt']);

/** The four category buttons, in TALK_CATEGORIES order, with the
 *  button name each presses. */
export const CATEGORY_BUTTONS = Object.freeze([
  ['location', 'categoryLocation', 'Location'],
  ['people', 'categoryPeople', 'People'],
  ['things', 'categoryThings', 'Things'],
  ['work', 'categoryWork', 'Work'],
]);

/**
 * THE PANEL, as data - what render() draws, read out of the model.
 * Pure and exported so a node test can hold the panel's picture
 * against the classic window's state without a DOM: the same model
 * driven through the same presses must describe the same panel.
 */
export function talkPanelModel(model) {
  const entries = model.conversation.map((c, i) => {
    const e = typeof c === 'string' ? { text: c, kind: 'answer' } : c;   // the greeting is a bare string (nativeTalk.js draw/_close)
    return { i, text: e.text, kind: e.kind === 'question' ? 'question' : 'answer', selected: i === model.conversationSelected, copied: model.copyIndexes.has(i) };
  });
  const whereIs = model._talkOption === 'whereIs';
  return {
    npcName: model.hooks.npcName ?? '',
    tone: model.hooks.tone?.() ?? 1,
    option: model._talkOption,
    category: model._lastCategory,
    mode: model.topicMode,
    question: model.question ?? '',
    entries,
    topics: model.topics.map((t, i) => ({ i, label: t.label ?? t.name ?? '', selected: i === model.selected, group: model.topicMode === 'categories' })),
    // a category page (buildings) carries a way back - the list it
    // descended from is one press of Location away
    back: model.topicMode === 'buildings',
    categories: CATEGORY_BUTTONS.map(([id, button, label]) => ({ id, button, label, on: whereIs && model._lastCategory === id, enabled: whereIs })),
    // ASK has something to ask: the Work page's question, or a selected
    // row that is not a group (a group descends instead - DFU's OKAY
    // takes SelectTopicFromTopicList either way, so ASK on a group
    // opens it, which is fine; only an EMPTY selection is inert)
    canAsk: model.topicMode === 'work' || model.selected >= 0,
  };
}

let host = null;
let model = null;
let onExit = () => {};
let relock = () => {};
let faceKey = null;      // the portrait key painted into the face canvas
let faceCanvas = null;
let logEl = null;
let listEl = null;
let lastLogCount = -1;
let lastTopicsKey = null;

/** Every press: through the model, then a fresh picture; and when the
 *  press was Goodbye, the exit - INSIDE the gesture, so the host's
 *  relock lands in the click that closed the panel (MAC1). */
function act(fn) {
  fn();
  if (model?.done) { relock(); onExit(); return; }
  render();
}

function paintFace() {
  if (!faceCanvas) return;
  const key = npcPortraitKey();
  const px = npcPortraitPixels();
  if (!px || key === faceKey) { if (!key) { faceKey = null; faceCanvas.hidden = true; } return; }
  try {
    faceCanvas.width = px.w; faceCanvas.height = px.h;
    const ctx = faceCanvas.getContext('2d');
    ctx.putImageData(new ImageData(px.rgba, px.w, px.h), 0, 0);
    faceCanvas.hidden = false;
    faceKey = key;
  } catch { /* a headless canvas has no 2d context; the name still says who */ }
}

function render() {
  if (!host || !model) return;
  const m = talkPanelModel(model);
  // the scroll positions a rebuild would lose
  const logTop = logEl?.scrollTop ?? 0;
  const listTop = listEl?.scrollTop ?? 0;
  host.innerHTML = '';
  const shell = el('div', 'talk-shell');
  const panel = el('section', 'talk-panel px-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) panel.append(el('span', `px-gem px-corner px-${c}`));

  // ── head: who, tone, goodbye
  const head = el('header', 'talk-head');
  const who = el('div', 'talk-who');
  faceCanvas = el('canvas', 'talk-face');
  faceCanvas.hidden = true;
  faceKey = null;
  who.append(faceCanvas, el('h2', null, m.npcName));
  head.append(who);
  const tones = el('div', 'talk-tone');
  TONE_LABELS.forEach((label, i) => {
    const b = el('button', null, label);
    b.setAttribute('aria-pressed', String(m.tone === i));
    b.onclick = () => act(() => model.press(['tonePolite', 'toneNormal', 'toneBlunt'][i]));
    tones.append(b);
  });
  head.append(tones);
  const bye = el('button', 'act door-goodbye', 'Goodbye');
  bye.onclick = () => act(() => model.press('goodbye'));
  head.append(bye);
  panel.append(head);

  // ── main: the conversation and the topics
  const main = el('div', 'talk-main');
  logEl = el('div', 'talk-log');
  for (const e of m.entries) {
    const row = el('div', `talk-entry ${e.kind === 'question' ? 'q' : 'a'}${e.selected ? ' on' : ''}`);
    row.append(document.createTextNode(e.text));
    if (e.copied) row.append(el('span', 'talk-copied', '✎ noted'));
    row.onclick = () => act(() => model.selectConversation(e.i));
    logEl.append(row);
  }
  main.append(logEl);

  const topics = el('aside', 'talk-topics');
  const modes = el('div', 'talk-modes');
  for (const [button, label] of [['tellMeAbout', 'Tell me about'], ['whereIs', 'Where is']]) {
    const b = el('button', `talk-mode${m.option === button ? ' on' : ''}`, label);
    b.onclick = () => act(() => model.press(button));
    modes.append(b);
  }
  topics.append(modes);
  const cats = el('div', 'talk-cats');
  for (const c of m.categories) {
    const b = el('button', `talk-cat${c.on ? ' on' : ''}`, c.label);
    if (!c.enabled) b.disabled = true;   // greyed under Tell me about, as TALK02I0 greys them; the model's gate is silent too
    b.onclick = () => act(() => model.press(c.button));
    cats.append(b);
  }
  topics.append(cats);
  listEl = el('div', 'talk-list');
  if (m.back) {
    const b = el('button', 'talk-back', '‹ Categories');
    b.onclick = () => act(() => model.press('categoryLocation'));
    listEl.append(b);
  }
  if (m.mode === 'none') listEl.append(el('p', 'talk-hint', 'Choose Tell me about, or Where is.'));
  else if (m.mode === 'work') listEl.append(el('p', 'talk-hint', 'Ask about work.'));
  else if (!m.topics.length) listEl.append(el('p', 'talk-hint', 'Nothing to ask here.'));
  for (const t of m.topics) {
    const b = el('button', `talk-row${t.selected ? ' on' : ''}${t.group ? ' group' : ''}`);
    b.append(el('span', 'px-c', '◆'), document.createTextNode(t.label));
    // a press SELECTS (ListBox.MouseClick) and a second press on the
    // selected row USES it (MouseDoubleClick) - the classic's clock
    // test, read off the selection instead: on a phone a double tap is
    // a zoom gesture, and a row that is already lit is unambiguous
    b.onclick = () => act(() => (t.selected ? model.useTopic(t.i) : model.selectTopic(t.i)));
    listEl.append(b);
  }
  topics.append(listEl);
  main.append(topics);
  panel.append(main);

  // ── foot: the player-says line, ASK, the logbook
  const foot = el('footer', 'talk-say');
  foot.append(el('div', `talk-q${m.question ? '' : ' none'}`, m.question || (m.mode === 'none' ? '' : 'Pick a topic.')));
  const note = el('button', 'act', 'Note');
  note.title = 'Copy the selected line to your logbook; right-click copies the whole conversation';
  note.onclick = () => act(() => model.press('logbook'));
  note.oncontextmenu = (e) => { e.preventDefault(); act(() => model.press('logbook', true)); };
  foot.append(note);
  const ask = el('button', 'act primary door-ask', 'Ask');
  if (!m.canAsk) ask.disabled = true;
  ask.onclick = () => act(() => model.press('okay'));
  foot.append(ask);
  panel.append(foot);

  shell.append(panel);
  host.append(shell);
  paintFace();

  // the conversation follows its newest line (UpdateScrollBarConversation
  // on new content) and otherwise stays where the player left it; the
  // topic list starts at the top of a new page
  if (m.entries.length !== lastLogCount) logEl.scrollTop = logEl.scrollHeight;
  else logEl.scrollTop = logTop;
  lastLogCount = m.entries.length;
  const topicsKey = `${m.mode}:${m.topics.length}:${m.topics[0]?.label ?? ''}`;
  listEl.scrollTop = topicsKey === lastTopicsKey ? listTop : 0;
  lastTopicsKey = topicsKey;
}

/** The door's key map, over the host's routed code. Returns true when
 *  the key was taken. Enter and the arrows are this panel's own (see
 *  the header); everything else is the classic window's input(). */
export function talkKey(code, m, e = null) {
  if (code === 'Enter') { m.press('okay'); return true; }
  if (code === 'ArrowDown' || code === 'ArrowUp') {
    if (!m.topics.length) return true;
    const cur = m.selected < 0 ? -1 : m.selected;
    const next = code === 'ArrowDown' ? Math.min(m.topics.length - 1, cur + 1) : Math.max(0, cur - 1);
    m.selectTopic(next);
    return true;
  }
  if (code === 'ArrowLeft' || code === 'ArrowRight') {
    // the arrows sideways step the tone, the way T cycles it
    const t = m.hooks.tone?.() ?? 1;
    m.press(['tonePolite', 'toneNormal', 'toneBlunt'][(t + (code === 'ArrowRight' ? 1 : 2)) % 3]);
    return true;
  }
  m.input(code, e);
  return true;
}

/**
 * Mount the panel over `hostEl`. `d.model` is the NativeTalkWindow the
 * door built; `d.onExit` runs once the model has closed (Goodbye, or
 * a routed key); `d.relock` is the host's pointer-lock request, run
 * inside the closing gesture.
 */
export function mountEnhancedTalk(hostEl, d = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  model = d.model;
  onExit = d.onExit ?? (() => {});
  relock = d.relock ?? (() => {});
  faceKey = null; faceCanvas = null; logEl = null; listEl = null;
  lastLogCount = -1; lastTopicsKey = null;
  render();
  return {
    render,
    /** Per frame from the door's draw(): the portrait lands async. */
    frame() { paintFace(); },
    /** A routed key, through the map, then a fresh picture. */
    key(code, e = null) { act(() => talkKey(code, model, e)); },
    destroy() {
      host = null; model = null; onExit = () => {}; relock = () => {};
      faceKey = null; faceCanvas = null; logEl = null; listEl = null;
    },
  };
}
