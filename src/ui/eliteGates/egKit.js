// @ts-check
// EG-PLUS (2026-10-19, the owner: "We also need to improve the elite breach UI as its not enhanced plus UI standard"):
// THE ELITE BREACH'S WINDOWS IN THE STONE-AND-BRASS KIT - what the breach's panel (ui/eliteGates/egHud.js drawEgPanel: the
// Vestige offer, the company's word, the recap), the call's tracker (drawEgHud), the boards (ui/eliteGates/egBoardWindow.js)
// and the start window (ui/eliteGates/egStartPanel.js) share, in one home.
//
// WHAT WAS WRONG. Each laid a sheet of its own in Cormorant or Georgia, with hand-picked browns and rounded corners - the
// look CARDS-PLUS took off the card tables (ui/card/cardPanelKit.js) - so the kit (ui/enhanced/enhancedFrame.js
// FRAME_ROLES) named none of their surfaces, the Plus themes and DFO Grimoire never reached them, the pixel face never
// reached a word, and the start window was a bare list of text rows with its party's marks spelt "[+x]".
//
// THE DRESS NOW, the card tables' own:
//   - each window's sheet writes GEOMETRY and WORDS only - its layout, its edges' widths, the face on its root, its
//     words' colours. `EG_CHROME_CSS` is the chrome they all wear: the window's box, the header band and its close, the
//     sections and their heads, the reading line and its tones, the tiles, the presses and their row, the chips, the
//     list rows, the tabs and the foot;
//   - the kit PAINTS every surface by its role (FRAME_ROLES' `body .eg-*` entries): a window carved with brass fittings,
//     a section a stone panel, a press raised stone that goes brass under the pointer, the press a window is for in
//     brass, a choice a tile (the one taken brass), a readout a chip, a board's line an engraved row;
//   - on Enhanced Plus the kit is on the page already; on the classic skin `dressEgKit` lays the kit's rules cut to these
//     selectors (scopeRules - the Broker's, the naval readout's and the card tables' answer) and asks for the face, so a
//     breach reads the same whichever UI Overhaul is worn; under DFO Grimoire the roles are what the dress repaints and
//     inks (ui/grimoireDress.js INK_ROOTS, WOOD_ROOTS).
//
// Not a DFU member: Daggerfall Unity has no Elite Breach. Ledger A (ELITE-GATES).
import { frameCss, scopeRules, FRAME_TONES } from '../enhanced/enhancedFrame.js';
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { STONE_DIM, STONE_WORD, STONE_RED } from '../enhanced/enhancedPlusStyle.js';
import { PIXEL_FONT_CSS } from '../pixelifyFive.js';
import { isEnhancedPlus } from '../../systems/uiSkin.js';

/** The classic skin's copy of the kit, cut to the breach's windows. */
export const EG_KIT_STYLE_ID = 'dagger-eg-kit-style';
/** The chrome's own sheet (every skin). */
export const EG_CHROME_STYLE_ID = 'dagger-eg-chrome-style';
/** A selector that dresses one of the breach's windows (or something in one): a window's root, the call's tracker, or a
 *  part of the chrome. */
export const isEgKitSelector = (/** @type {string} */ sel) => /\.eg-(?:win|hud)(?![\w-])|\.eg-k-[a-z]/.test(sel);
/** The kit's rules cut to the breach's own selectors - the classic skin's copy of their Plus dress. */
export const egKitCss = () => scopeRules(frameCss(), isEgKitSelector);

/** The Vestiges' blue - a capstone, an Accord, a window on me (the Spire HUD's own `.eg-held`). */
export const EG_SIGIL_BLUE = '#8fb4ff';

/**
 * THE CHROME every breach window wears (`.eg-win`), and the call's tracker its plate (`.eg-hud`, a panel over the world):
 *   .eg-k-head    the header band - `.eg-k-title` in brass capitals, chips beside it, `.eg-k-x` the close
 *   .eg-k-body    the window's words, scrolling inside a box bounded by the screen
 *   .eg-k-sec     a section, a stone panel - `.eg-k-sechead` its head over an engraved line
 *   .eg-k-line    a reading line, 15px; `.dim` a lesser word, `.warn` a refusal or a warning, `.gold` a gain, `.blue` a Vestige's
 *   .eg-k-tiles   a grid of choices - `.eg-k-tile` each (a button), `.eg-k-tname` its name, `.eg-k-tline` its line
 *   .eg-k-acts    a row of presses - `.eg-k-btn` each, `data-kind` primary (what the window is for) or quiet (apart, at the end)
 *   .eg-k-chip    a readout, never pressed
 *   .eg-k-row     a list's line, engraved under; `.on` the reader's own
 *   .eg-k-tabs    a row of tabs - `.eg-k-tab` each, `.on` the one shown
 *   .eg-k-dock    the band the window's presses stand on, under its words - it never scrolls away
 *   .eg-k-foot    the foot: the keys, in a small line over a rule
 * Geometry and words only: every surface's paint is the kit's, by role.
 */
export const EG_CHROME_CSS = `
.eg-win, .eg-win * { box-sizing: border-box; }
.eg-win { position: fixed; z-index: 32; margin: 0; padding: 0; border-width: 2px; border-style: solid; ${PIXEL_FONT_CSS} font-size: 14px; line-height: 1.35;
  color: #e9e4d9; --egk-dim: #b9ab93; --egk-word: #d8cfae; --egk-red: #ff9a8a; --egk-blue: ${EG_SIGIL_BLUE};
  display: flex; flex-direction: column; max-height: calc(100vh - 36px); pointer-events: auto; }
.eg-win:focus { outline: none; }
.eg-k-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 7px 10px 6px 14px; border-bottom-width: 2px; border-bottom-style: solid; }
.eg-k-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; letter-spacing: 0.12em;
  text-transform: uppercase; color: ${FRAME_TONES.brassHi}; text-shadow: 2px 2px 0 #050608; }
.eg-k-x { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border-width: 2px; border-style: solid;
  font: inherit; font-size: 14px; line-height: 1; color: #efe8d6; cursor: pointer; }
.eg-k-body { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 10px 14px 12px; }
.eg-k-sec { margin: 0 0 10px; padding: 8px 10px 10px; border-width: 2px; border-style: solid; }
.eg-k-sec:last-child { margin-bottom: 0; }
.eg-k-sechead { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 0 0 5px; border-bottom-width: 2px; border-bottom-style: solid;
  font-size: 13px; font-weight: inherit; letter-spacing: 0.1em; text-transform: uppercase; color: ${FRAME_TONES.brassHi}; }
.eg-k-sechead .eg-k-grow { flex: 1 1 auto; min-width: 0; }
.eg-k-line { margin: 4px 0 0; font-size: 15px; line-height: 1.5; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.eg-k-line:first-child { margin-top: 0; }
.eg-k-line.dim { color: var(--egk-dim); font-size: 13px; }
.eg-k-line.warn { padding: 3px 0 3px 8px; border-left: 3px solid #b83a2e; background: rgba(120,30,20,0.3); color: #ffc4bb; font-size: 14px; }
.eg-k-line.gold { color: ${FRAME_TONES.brassHi}; }
.eg-k-line.blue, .eg-k-tline.blue { color: var(--egk-blue); }
.eg-k-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.eg-k-tile { display: flex; flex-direction: column; align-items: stretch; gap: 3px; margin: 0; padding: 8px 10px; min-height: 44px; border-width: 2px; border-style: solid;
  font: inherit; font-size: 13px; text-align: left; color: #efe8d6; cursor: pointer; }
.eg-k-tile[aria-disabled="true"] { cursor: default; }
.eg-k-tname { display: flex; align-items: baseline; gap: 6px; font-size: 14px; color: #fff2cc; }
.eg-k-tname .eg-k-key { flex: none; min-width: 18px; padding: 0 4px; border-width: 1px; border-style: solid; border-color: rgba(192,138,62,0.55); text-align: center;
  font-size: 12px; color: ${FRAME_TONES.brassHi}; }
.eg-k-tline { font-size: 13px; line-height: 1.4; color: var(--egk-word); }
.eg-k-acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 10px; }
.eg-k-acts:first-child { margin-top: 0; }
.eg-k-btn { margin: 0; padding: 4px 12px; min-height: 30px; border-width: 2px; border-style: solid; font: inherit; font-size: 13px; color: #efe8d6; text-align: center; cursor: pointer; }
.eg-k-btn[data-kind="primary"] { color: #fff2cc; }
.eg-k-btn[data-kind="quiet"] { margin-left: auto; }
.eg-k-btn[data-kind="quiet"] ~ .eg-k-btn[data-kind="quiet"] { margin-left: 0; }
.eg-k-btn[aria-disabled="true"] { color: var(--egk-dim); cursor: default; }
.eg-k-chip { display: inline-block; padding: 1px 7px; border-width: 2px; border-style: solid; font-size: 12px; line-height: 18px; white-space: nowrap;
  font-variant-numeric: tabular-nums; color: #efe8d6; }
.eg-k-chip.gold { color: ${FRAME_TONES.brassHi}; }
.eg-k-chip.red { color: var(--egk-red); }
.eg-k-chip.blue { color: var(--egk-blue); }
.eg-k-row { display: flex; align-items: baseline; gap: 8px; padding: 5px 4px 5px 8px; border-bottom-width: 1px; border-bottom-style: solid; font-size: 14px; line-height: 1.4; }
.eg-k-row .eg-k-rank { flex: none; min-width: 28px; color: ${FRAME_TONES.brassHi}; font-variant-numeric: tabular-nums; }
.eg-k-row .eg-k-who { flex: 1 1 auto; min-width: 0; }
.eg-k-row .eg-k-sub { display: block; font-size: 12px; color: var(--egk-dim); }
.eg-k-row .eg-k-val { flex: none; text-align: right; font-variant-numeric: tabular-nums; color: var(--egk-word); }
.eg-k-row.on .eg-k-who { color: #fff2cc; }
.eg-k-tabs { display: flex; flex-wrap: wrap; gap: 0; margin: 0 0 10px; }
.eg-k-tab { margin: 0; padding: 6px 10px; border: 0; background: none; font: inherit; font-size: 13px; color: var(--egk-word); cursor: pointer; }
.eg-k-tab.on { color: #fff2cc; }
.eg-k-dock { flex: none; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 14px; border-top-width: 2px; border-top-style: solid; }
.eg-k-dock > .eg-k-line { flex: 1 1 100%; margin: 0; }
.eg-k-dock .eg-k-btn[data-kind="quiet"] { margin-left: auto; }
.eg-k-dock .eg-k-btn[data-kind="quiet"] ~ .eg-k-btn[data-kind="quiet"] { margin-left: 0; }
.eg-k-foot { flex: none; padding: 6px 14px 7px; border-top-width: 2px; border-top-style: solid; font-size: 12px; color: var(--egk-dim); }
.eg-k-foot:empty { display: none; }
.eg-k-foot b { font-weight: inherit; color: var(--egk-word); }
.eg-win button:focus-visible, .eg-win [tabindex="0"]:focus-visible { outline: 2px solid ${FRAME_TONES.brassHi}; outline-offset: 2px; }
.eg-win .eg-k-tile.eg-focus, .eg-win .eg-k-btn.eg-focus { outline: 2px solid ${FRAME_TONES.brassHi}; outline-offset: 2px; }
:root[data-plus-theme="stone"] .eg-win, :root[data-plus-theme="stone"] .eg-hud { --egk-dim: ${STONE_DIM}; --egk-word: ${STONE_WORD}; --egk-red: ${STONE_RED}; }
@media (pointer: coarse), (max-width: 480px) { .eg-k-btn, .eg-k-tile, .eg-k-tab { min-height: 44px; } .eg-k-x { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .eg-win *, .eg-hud * { animation: none !important; transition: none !important; } }
`;

/**
 * The breach windows' dress, laid once a page: the chrome on every skin, the kit cut to the windows on the classic skin
 * (Enhanced Plus carries the whole kit already) and the game's face. Answers whether the classic copy was laid now.
 * @param {any} doc
 */
export function dressEgKit(doc = globalThis.document) {
  if (!doc?.createElement) return false;
  const lay = (id, text) => {
    if (doc.getElementById?.(id)) return false;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = text;
    (doc.head ?? doc.body)?.append(st);
    return true;
  };
  lay(EG_CHROME_STYLE_ID, EG_CHROME_CSS);
  if (doc.head) injectEnhancedFonts(doc);   // AUDIT NAV1's law: on the classic skin nothing else asked for the face
  if (isEnhancedPlus()) return false;
  return lay(EG_KIT_STYLE_ID, egKitCss());
}

/**
 * A node of the chrome: `el(doc, 'div', 'eg-k-line dim', 'words')`. A press is a `type="button"`.
 * @param {any} doc @param {string} tag @param {string} [cls] @param {string|null} [text]
 */
export function egEl(doc, tag, cls = '', text = null) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (tag === 'button') n.type = 'button';
  return n;
}

/**
 * The header band: the title, any chips after it, and a close when `onClose` is given (its name the close's words, for a
 * screen reader and a mouse's hover).
 * @param {any} doc @param {string} title @param {{ chips?: any[], onClose?: (() => void) | null, closeWords?: string }} [o]
 */
export function egHead(doc, title, { chips = [], onClose = null, closeWords = 'Close' } = {}) {
  const head = egEl(doc, 'div', 'eg-k-head');
  head.append(egEl(doc, 'div', 'eg-k-title', title), ...chips);
  if (onClose) {
    const x = egEl(doc, 'button', 'eg-k-x', '×');
    x.title = closeWords;
    x.setAttribute?.('aria-label', closeWords);
    x.addEventListener?.('click', () => onClose());
    head.append(x);
  }
  return head;
}

/** A section: a stone panel with its head (and chips beside the head's words). @param {any} doc @param {string} title @param {any[]} [chips] */
export function egSection(doc, title, chips = []) {
  const sec = egEl(doc, 'div', 'eg-k-sec');
  if (title) {
    const head = egEl(doc, 'div', 'eg-k-sechead');
    head.append(egEl(doc, 'span', 'eg-k-grow', title), ...chips);
    sec.append(head);
  }
  return sec;
}
