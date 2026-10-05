// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REVENANT-CARD (2026-10-02, Mac: "For taunting enemies. I was hoping it would have a portrait popup and enemy dialog
// (kind of like our notification system)" - and "Any new UI elements need to be enhanced UI plus").
//
// WHAT IT IS. A card for each thing a revenant says or does (systems/revenant.js builds the events; systems/revenantVoice.js
// hands them here): the foe's PORTRAIT - its own sprite, front-facing, in a sunk well with its rank on a chip - a
// KICKER that says what this is ("Revenant", "Fleeing", "Escaped", "Revenant slain", "A revenant rises"), its NAME over
// what it is (its kind, its trait, elite), and its WORDS typed out in its own voice, with what happens in the
// narrator's under them. A taunt and a rise wear a blood edge; a flight and an escape amber; a fall brass, the portrait
// gone grey and struck through.
//
// LIKE THE NOTICES. The stack stands at the LEFT edge where the notice stack stands at the right (ui/enhancedNotice.js)
// - the same slide in and out, the same pixel face - a card at a time over the last one, two at most, a new word from
// the same revenant in place of its old one. It is drawn on drawHud's one call (ui/hud.js, beside the herald) and
// takes the HUD's hide gate: under a window or with the HUD off it stands hidden and its clock stops, and a host that
// stops drawing (DISC29-D's watchdog) hides it rather than losing what was said. The HUD-MOVE layer moves it like any
// HUD piece (ui/hudLayout.js 'revenant').
//
// ENHANCED PLUS. The stone-and-brass kit dresses it by ROLE (ui/enhancedFrame.js FRAME_ROLES: the card a panel with an
// accent edge, the portrait a well, the rank a chip, the name a header rule) - so every Plus theme restyles it; this
// sheet writes geometry, border widths and the words' colours alone. The classic skin draws no card: the presenter
// declines and the host says the line, as it always did.
//
// THE WORDS ARE READ ONCE. The typed text is the eye's; a screen reader is handed the whole line at once (a hidden
// span), so it is not read a letter at a time. Reduced motion: no slide, no typing.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { setRevenantPresenter } from '../systems/revenantVoice.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { PIXEL_STACK, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { armDrawWatchdog, disarmDraw } from './drawWatchdog.js';
import { sweepHudLayout } from './hudLayout.js';   // HUD-MOVE: a new stack stands where the player put the last

export const REVENANT_CARD_STYLE_ID = 'revenant-card-css';
export const REVENANT_STACK_ID = 'revenant-cards';
/** Two cards at most; a third takes the oldest's place. */
export const REVENANT_CARDS_MAX = 2;
/** Letters a second the words are typed at. */
export const REVENANT_TYPE_CPS = 42;
/** How long a card stands once its words are all out: a beat, and a little more for a longer line. */
export const revenantHoldMs = (text) => Math.max(3500, Math.min(7500, 2600 + 38 * String(text ?? '').length));
/** The slide (the notices' own), and the watchdog's grace. */
export const REVENANT_SLIDE_MS = 260;
const WATCHDOG_MS = 400;
/** The portrait's box (the well's inside, CSS pixels). */
export const REVENANT_FACE_BOX = 68;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const numeral = (rank) => ROMAN[Math.max(0, Math.min(5, rank | 0))];

export const REVENANT_CARD_CSS = `
.rvncard-stack {
  position: fixed; left: calc(12px + var(--ui-pillar, 0px) + env(safe-area-inset-left, 0px)); top: calc(17vh + env(safe-area-inset-top, 0px));   /* RETRO-UI */
  z-index: 31; pointer-events: none; display: flex; flex-direction: column; gap: 10px;
  width: min(380px, calc(100vw - 24px));
  font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;
  color: #d8cfae; text-shadow: ${PIXEL_TEXT_SHADOW};
}
.rvncard-stack.rvncard-hidden { visibility: hidden; }
body .rvncard {
  position: relative; box-sizing: border-box; display: grid; grid-template-columns: ${REVENANT_FACE_BOX + 8}px 1fr; gap: 10px;
  align-items: start; padding: 8px 12px 9px 8px; border-width: 2px; border-style: solid; border-left-width: 4px;
  transform: translateX(calc(-100% - 24px)); opacity: 0;
  transition: transform ${REVENANT_SLIDE_MS}ms cubic-bezier(.2, .8, .2, 1), opacity ${REVENANT_SLIDE_MS}ms ease-out;
}
body .rvncard.rvncard-in { transform: none; opacity: 1; }
body .rvncard.rvncard-out { transform: translateX(calc(-100% - 24px)); opacity: 0; }
body .rvncard-face {
  position: relative; box-sizing: border-box; width: ${REVENANT_FACE_BOX + 8}px; height: ${REVENANT_FACE_BOX + 8}px;
  border-width: 2px; border-style: solid; display: flex; align-items: flex-end; justify-content: center; overflow: hidden;
}
body .rvncard-face img.fit { image-rendering: pixelated; filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.9)); }
body .rvncard-face::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0, 0, 0, 0.55) 100%);
}
body .rvncard-face .rvncard-glyph { margin: auto; font-size: 28px; color: #8b8578; }
body .rvncard-rank {
  position: absolute; right: 2px; bottom: 2px; z-index: 1; min-width: 20px; box-sizing: border-box; padding: 1px 4px;
  border-width: 1px; border-style: solid; font-size: 11px; line-height: 1.2; text-align: center; color: #f3cf86;
}
body .rvncard-text { min-width: 0; display: flex; flex-direction: column; }
body .rvncard-kicker { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #d0604f; }
body .rvncard-name {
  font-size: 16px; line-height: 1.2; color: #f3cf86; padding-bottom: 3px; margin-bottom: 3px;
  border-bottom-width: 1px; border-bottom-style: solid; overflow-wrap: anywhere;
}
body .rvncard-sub { font-size: 11px; color: #8b8578; }
/* REVENANT-VOICE: who it is - a chip before what it is */
body .rvncard-mood {
  display: inline-block; margin-right: 6px; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 9px; line-height: 1.5;
  letter-spacing: 0.12em; text-transform: uppercase; color: #e9c46a; vertical-align: 1px;
}
body .rvncard-say { margin-top: 6px; font-size: 13px; line-height: 1.35; color: #e9e4d9; min-height: 1.35em; overflow-wrap: anywhere; }
body .rvncard-say:empty { display: none; }
body .rvncard-caret { display: inline-block; width: 0.5em; animation: rvncard-blink 0.8s steps(1) infinite; }
body .rvncard-body { margin-top: 4px; font-size: 12px; line-height: 1.3; color: #b8b0a0; }
body .rvncard-body:empty { display: none; }
@keyframes rvncard-blink { 50% { opacity: 0; } }
/* what it is: a taunt and a rise in blood, a flight and an escape in amber, a fall in brass */
body .rvncard.is-taunt, body .rvncard.is-rise, body .rvncard.is-cornered { border-left-color: #8c3a32; }
body .rvncard.is-flee, body .rvncard.is-escape { border-left-color: #c9822e; }
body .rvncard.is-flee .rvncard-kicker, body .rvncard.is-escape .rvncard-kicker { color: #e0a54a; }
body .rvncard.is-slain { border-left-color: #c08a3e; }
body .rvncard.is-slain .rvncard-kicker { color: #f3cf86; }
body .rvncard.is-slain .rvncard-face img { filter: grayscale(1) brightness(0.65); }
body .rvncard.is-slain .rvncard-face::before {
  content: ''; position: absolute; left: -10%; right: -10%; top: 50%; z-index: 1; border-top: 3px solid #8c3a32;
  transform: rotate(-38deg); box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
}
/* REVENANT-FATE: beaten in gold, executed in blood, sworn in green, a slip in amber; REVENANT-COMPANION: the sworn's
   own words in the portal's violet, its leaving in ash */
body .rvncard.is-yield { border-left-color: #c9a227; }
body .rvncard.is-yield .rvncard-kicker { color: #f3cf86; }
body .rvncard.is-executed { border-left-color: #a02a20; }
body .rvncard.is-executed .rvncard-face img { filter: saturate(0.4) brightness(0.8) sepia(0.6) hue-rotate(-30deg); }
body .rvncard.is-spared { border-left-color: #4f9a62; }
body .rvncard.is-spared .rvncard-kicker { color: #8fc7a0; }
body .rvncard.is-slip { border-left-color: #c9822e; }
body .rvncard.is-slip .rvncard-kicker { color: #e0a54a; }
body .rvncard.is-arrive, body .rvncard.is-battle, body .rvncard.is-kill { border-left-color: #8a63d2; }
body .rvncard.is-arrive .rvncard-kicker, body .rvncard.is-battle .rvncard-kicker, body .rvncard.is-kill .rvncard-kicker { color: #c3a8ff; }
body .rvncard.is-dismiss, body .rvncard.is-release { border-left-color: #6d6a63; }
body .rvncard.is-dismiss .rvncard-kicker, body .rvncard.is-release .rvncard-kicker { color: #b8b0a0; }
body .rvncard.is-downed { border-left-color: #c9822e; }
body .rvncard.is-downed .rvncard-kicker { color: #e0a54a; }
/* RVN12b (bible/12-Enhanced-AI/Feud-Arc.md 24.2): FEUD's edges - its last stand blood with an ember rim, its signature
   iron red, a theft amber, a betrayal black; the rest by their kin (decided here): a felling, a festering, its lair
   and a weakness blood; a rout, an unbroken escape and a desertion amber; a Devoted one's warning the companion's */
body .rvncard.is-laststand { border-left-color: #8c3a32; box-shadow: inset 0 0 0 1px #e0602a; }
body .rvncard.is-laststand .rvncard-kicker { color: #ff8a4a; }
body .rvncard.is-signature { border-left-color: #a8332a; }
body .rvncard.is-signature .rvncard-kicker { color: #e06a5a; }
body .rvncard.is-stole { border-left-color: #c9822e; }
body .rvncard.is-stole .rvncard-kicker { color: #e0a54a; }
body .rvncard.is-betrayed { border-left-color: #0b0b0b; }
body .rvncard.is-betrayed .rvncard-kicker { color: #d8d8d8; }
body .rvncard.is-felled, body .rvncard.is-festered, body .rvncard.is-lair, body .rvncard.is-weakness { border-left-color: #8c3a32; }
body .rvncard.is-routed, body .rvncard.is-unbroken, body .rvncard.is-deserted { border-left-color: #c9822e; }
body .rvncard.is-routed .rvncard-kicker, body .rvncard.is-unbroken .rvncard-kicker, body .rvncard.is-deserted .rvncard-kicker { color: #e0a54a; }
body .rvncard.is-warn { border-left-color: #8a63d2; }
body .rvncard.is-warn .rvncard-kicker { color: #c3a8ff; }
body .rvncard .rvncard-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
/* Stone's light ground (the stats card's own law): brighter words */
:root[data-plus-theme="stone"] body .rvncard-sub { color: #e2d9c4; }
:root[data-plus-theme="stone"] body .rvncard-body { color: #efe8d8; }
:root[data-plus-theme="stone"] body .rvncard-kicker { color: #ff9b84; }
:root[data-plus-theme="stone"] body .rvncard.is-flee .rvncard-kicker, :root[data-plus-theme="stone"] body .rvncard.is-escape .rvncard-kicker { color: #ffc56a; }
:root[data-plus-theme="stone"] body .rvncard.is-slain .rvncard-kicker { color: #ffd98a; }
@media (prefers-reduced-motion: reduce) {
  body .rvncard, body .rvncard.rvncard-out { transform: none; transition: opacity 1ms; }
  body .rvncard-caret { animation: none; }
}
@media (max-width: 520px) {
  .rvncard-stack { top: calc(12vh + env(safe-area-inset-top, 0px)); }
  body .rvncard-name { font-size: 14px; }
}
`;

const reducedMotion = () => {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { return false; }
};
const docOf = () => (typeof document === 'undefined' ? null : document);

/** @typedef {{ seq: number, ev: any, el: any, sayEl: any, caret: any, typed: number, full: string, holdMs: number, leftMs: number, outMs: number|null, settled: boolean }} Card */
/** @type {Card[]} */
let _cards = [];
let _seq = 0;
let _stack = null;
let _watchdog = null;
let _faultSaid = false;
/** The portrait's source (a test hands its own): `(portrait, onReady) => fitted picture | null`. */
let _icon = (p, onReady) => requestFittedIcon(p.archive, p.record, { box: REVENANT_FACE_BOX, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady });
let _wd = {};
/** Tests: the portrait source and the watchdog's timers. */
export function _setRevenantCardForTests({ icon, schedule, cancel } = /** @type {any} */ ({})) {
  if (icon !== undefined) _icon = icon ?? ((p, onReady) => requestFittedIcon(p.archive, p.record, { box: REVENANT_FACE_BOX, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady }));
  if (schedule !== undefined || cancel !== undefined) _wd = { ...(schedule ? { schedule } : {}), ...(cancel ? { cancel } : {}) };
}

function ensureStyle(d) {
  injectEnhancedStyle(d);
  injectEnhancedFonts(d);
  if (!d.getElementById?.(REVENANT_CARD_STYLE_ID)) {
    const st = d.createElement('style');
    st.id = REVENANT_CARD_STYLE_ID;
    st.textContent = REVENANT_CARD_CSS;
    (d.head ?? d.body).append(st);
  }
}
/** The stack, made when a card first needs it and taken down with the last (the notice stack's way - and HUD-MOVE's
 *  preview stands only while no real one does); placed where the player moved it at once, not at the next sweep. */
function ensure(d) {
  if (_stack && _stack.isConnected !== false) return _stack;
  ensureStyle(d);
  _stack = d.getElementById?.(REVENANT_STACK_ID) ?? null;
  if (!_stack) {
    _stack = d.createElement('div');
    _stack.id = REVENANT_STACK_ID;
    _stack.className = 'rvncard-stack';
    _stack.setAttribute('aria-live', 'polite');
    _stack.setAttribute('role', 'log');
    d.body.append(_stack);
    try { sweepHudLayout(d); } catch { /* the sheet's own place */ }
  }
  return _stack;
}
function takeDown() {
  disarmDraw(_watchdog); _watchdog = null;
  if (_stack) { try { _stack.remove(); } catch { /* gone */ } }
  _stack = null;
}

/** The words a card types: its own voice in quotes. */
const quoted = (s) => (s ? `“${s}”` : '');

function build(d, ev) {
  const el = d.createElement('div');
  el.className = `rvncard is-${ev.kind}`;
  const face = d.createElement('div');
  face.className = 'rvncard-face';
  face.setAttribute('aria-hidden', 'true');
  if (ev.rank > 0) {
    const rank = d.createElement('span');
    rank.className = 'rvncard-rank';
    rank.textContent = numeral(ev.rank);
    face.append(rank);
  }
  const text = d.createElement('div');
  text.className = 'rvncard-text';
  const kicker = d.createElement('div'); kicker.className = 'rvncard-kicker'; kicker.textContent = ev.kicker; kicker.setAttribute('aria-hidden', 'true');
  const name = d.createElement('div'); name.className = 'rvncard-name'; name.textContent = ev.name; name.setAttribute('aria-hidden', 'true');
  const sub = d.createElement('div'); sub.className = 'rvncard-sub'; sub.textContent = [ev.rank > 0 ? `Rank ${numeral(ev.rank)}` : null, ev.sub || null].filter(Boolean).join(' · '); sub.setAttribute('aria-hidden', 'true');
  if (ev.mood) { const mood = d.createElement('span'); mood.className = 'rvncard-mood'; mood.textContent = ev.mood; sub.insertBefore(mood, sub.firstChild); }   // REVENANT-VOICE
  const say = d.createElement('div'); say.className = 'rvncard-say'; say.setAttribute('aria-hidden', 'true');
  const body = d.createElement('div'); body.className = 'rvncard-body'; body.textContent = ev.body ?? ''; body.setAttribute('aria-hidden', 'true');
  const sr = d.createElement('span'); sr.className = 'rvncard-sr';
  sr.textContent = [ev.kicker, ev.name, ev.mood, ev.speech ? quoted(ev.speech) : null, ev.body].filter(Boolean).join('. ');
  text.append(kicker, name, sub, say, body, sr);
  el.append(face, text);
  setPortrait(face, ev);
  return { el, say };
}

/** The portrait: the sprite's fitted picture now, or once it lands (a card gone by then takes nothing); a kind with
 *  no sprite stands on a glyph. */
function setPortrait(face, ev) {
  const p = ev.portrait;
  const put = (pic) => {
    if (!pic?.src) return false;
    const img = fittedImg(pic);
    const glyph = face.querySelector?.('.rvncard-glyph');
    if (glyph) glyph.remove();
    face.insertBefore(img, face.firstChild ?? null);
    return true;
  };
  const ask = (onReady) => _icon(p, onReady);
  let shown = false;
  if (p && Number.isInteger(p.archive)) {
    try { shown = put(ask(() => { if (face.isConnected !== false) { try { put(ask(null)); } catch { /* the glyph stands */ } } })); } catch { shown = false; }
  }
  if (!shown) {
    const g = face.ownerDocument?.createElement?.('span') ?? document.createElement('span');
    g.className = 'rvncard-glyph';
    g.textContent = '☠';
    face.append(g);
  }
}

/** THE PRESENTER (systems/revenantVoice.js): draw an event - the enhanced skin's card - or decline (the classic skin, no
 *  document), and the host says the line. */
export function showRevenantCard(ev) {
  try {
    if (!ev || !isEnhanced()) return false;
    const d = docOf();
    if (!d?.body || !d.createElement) return false;
    const stack = ensure(d);
    // a new word from the same revenant takes its old card's place
    if (ev.id) for (const c of _cards) if (c.ev.id === ev.id && c.outMs == null) c.outMs = REVENANT_SLIDE_MS;
    const { el, say } = build(d, ev);
    const caret = d.createElement('span');
    caret.className = 'rvncard-caret';
    caret.textContent = '▌';
    const full = quoted(ev.speech);
    const still = reducedMotion();
    /** @type {Card} */
    const card = { seq: ++_seq, ev, el, sayEl: say, caret, typed: still ? full.length : 0, full, holdMs: revenantHoldMs(`${full} ${ev.body ?? ''}`), leftMs: 0, outMs: null, settled: false };   // outMs: null standing, else the slide's ms left
    card.leftMs = card.holdMs;
    paintWords(card);
    stack.insertBefore(el, stack.firstChild ?? null);
    void el.offsetWidth;   // the slide starts from off the edge
    el.classList.add('rvncard-in');
    _cards.unshift(card);
    // past the cap, the oldest goes
    for (const c of _cards.slice(REVENANT_CARDS_MAX)) if (c.outMs == null) c.outMs = REVENANT_SLIDE_MS;
    return true;
  } catch (e) {
    if (!_faultSaid) { _faultSaid = true; console.warn(`[revenant-card] the card could not be drawn; the line is said instead: ${e?.message ?? e}`); }
    return false;
  }
}
setRevenantPresenter(showRevenantCard);

function paintWords(card) {
  const shown = card.full.slice(0, Math.floor(card.typed));
  if (card.sayEl.textContent === shown && card.settled) return;
  card.sayEl.textContent = shown;
  if (card.typed < card.full.length) card.sayEl.append(card.caret);
  else card.settled = true;
}

/**
 * ONE FRAME (ui/hud.js drawHud, every host): type, hold, slide out; `hidden` - the HUD's hide gate - stands the stack
 * hidden and its clock still. Answers the cards standing.
 */
export function drawRevenantCards({ hidden = false, dt = 0, doc = docOf() } = {}) {
  if (!_cards.length) { if (_stack) takeDown(); return 0; }
  if (!doc?.body) return _cards.length;
  const stack = ensure(doc);
  stack.classList.toggle('rvncard-hidden', !!hidden);
  disarmDraw(_watchdog);
  _watchdog = armDrawWatchdog(WATCHDOG_MS, () => { _watchdog = null; if (_stack) _stack.classList.add('rvncard-hidden'); }, _wd);
  if (hidden) return _cards.length;
  const ms = Math.max(0, Number(dt) || 0) * 1000;
  for (const c of _cards) {
    if (c.outMs != null) {
      if (!c.el.classList.contains('rvncard-out')) { c.el.classList.remove('rvncard-in'); c.el.classList.add('rvncard-out'); }
      c.outMs -= ms;
      continue;
    }
    if (c.typed < c.full.length) { c.typed = Math.min(c.full.length, c.typed + REVENANT_TYPE_CPS * (ms / 1000)); paintWords(c); continue; }
    c.leftMs -= ms;
    if (c.leftMs <= 0) c.outMs = REVENANT_SLIDE_MS;
  }
  const gone = _cards.filter((c) => c.outMs != null && c.outMs <= 0);
  for (const c of gone) { try { c.el.remove(); } catch { /* already gone */ } }
  _cards = _cards.filter((c) => !gone.includes(c));
  if (!_cards.length) takeDown();
  return _cards.length;
}

/** Every card down at once (a load, a sweep, tests). */
export function clearRevenantCards() {
  for (const c of _cards) { try { c.el.remove(); } catch { /* gone */ } }
  _cards = [];
  takeDown();
}
/** Tests: the cards standing, as the law reads them. */
export const _revenantCards = () => _cards.map((c) => ({ kind: c.ev.kind, name: c.ev.name, typed: Math.floor(c.typed), full: c.full, out: c.outMs != null, leftMs: c.leftMs }));
export function _resetRevenantCardsForTests() { clearRevenantCards(); _seq = 0; _faultSaid = false; }

/** HUD-MOVE's preview (ui/hudLayout.js): a card standing where the real ones will, while the UI is unlocked. */
export function buildRevenantPreview(doc) {
  ensureStyle(doc);
  const stack = doc.createElement('div');
  stack.className = 'rvncard-stack';
  const { el, say } = build(doc, { kind: 'taunt', kicker: 'Revenant', name: 'Revenant taunts (preview)', rank: 2, sub: 'Orc Warlord', mood: 'Witty', speech: 'You should have finished me.', body: null, portrait: null });
  say.textContent = quoted('You should have finished me.');
  el.classList.add('rvncard-in');
  stack.append(el);
  return stack;
}
