// @ts-check
// CARDS-PLUS (2026-10-13, bible/11-Multiplayer/Tavern-Cards.md section 38; the owner: "Lets improve the illiac bay
// minigame visuals and ensure the general card UI uses enhanced plus and our fonts. Currently it doesnt"): THE CARD
// TABLES' PANELS IN THE STONE-AND-BRASS KIT AND THE GAME'S FACE - what the Hold'em panel (ui/card/cardTableHud.js) and Iliac
// Hand's (ui/iliacTableHud.js) share, in one home.
//
// WHAT WAS WRONG. CARDS4 and CARDS10 each laid a sheet of its own - "the enhanced skin's dark plate and gold" - in
// Georgia, serif, set on the panel's root and again on every button, so FONT3's face on the body never reached a word of
// either (measured in Chromium under the Plus sheet: both roots and their buttons computed "Georgia, serif"); the kit
// (ui/enhanced/enhancedFrame.js FRAME_ROLES) named none of their surfaces, where PLUS-ONLY's law is that a new enhanced surface is
// dressed by it and never left in a look of its own; and their generic words (`.card`, `.row`, `.note`) were the
// enhanced sheet's own bare components, which leaked into them - a holding's row took a menu row's 11px 18px padding
// and its underline, a little card a settings card's border and its 16px foot.
//
// THE DRESS NOW, the naval readout's (ui/naval/navalHud.js - a panel over the world, outside the window stack):
//   - each panel's own sheet writes GEOMETRY and WORDS: its layout, its edges' widths, the face's trio
//     (ui/pixelifyFive.js PIXEL_FONT_CSS) on its root, its words' colours. `cardPanelChromeCss` is the chrome both wear
//     - the window's box, the header band, the line and its tones, the presses' row, the log - and every class in either
//     panel is a word of its own (test/ui/cardsplus.test.js sweeps them against the enhanced sheets' bare components);
//   - the kit PAINTS every surface by its role (FRAME_ROLES' `body .dfcards` and `body .dfiliac` entries - a leading
//     `body`, because the panels' sheets land after the skin's): the panel a carved window with brass fittings, a seat
//     or a holding a stone panel, the presses raised stone that go brass under the pointer, the press a panel is for in
//     brass, a concession in blood, a choice a tile, the board and the hand sunk into the stone;
//   - on Enhanced Plus the kit is on the page already (the Plus sheet, its colours with it); on the classic skin
//     `dressCardPanel` lays the kit's rules cut to the panels' selectors (scopeRules - AUDIT SET U1's answer, the
//     Broker's and the naval readout's) and asks for the face, so a table reads the same whichever UI Overhaul is worn;
//     under the DFO Grimoire dress the roles are what the dress repaints and the face is re-said in its own.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { frameCss, scopeRules, FRAME_TONES } from '../enhanced/enhancedFrame.js';
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { STONE_DIM, STONE_WORD, STONE_RED } from '../enhanced/enhancedPlusStyle.js';   // AUDIT MERGE-PLUS D3: the words lifted on Stone's light ground
import { PIXEL_FONT_CSS } from '../pixelifyFive.js';
import { isEnhancedPlus } from '../../systems/uiSkin.js';
import { t } from '../../systems/textManager.js';

/** The classic skin's copy of the kit, cut to the two panels. */
export const CARD_KIT_STYLE_ID = 'dfcards-kit-style';
/** A selector that dresses one of the two panels (or something in one). */
export const isCardPanelSelector = (/** @type {string} */ sel) => /\.df(?:cards|iliac|gambit)(?![\w-])|\.dfgambit-[a-z]/.test(sel);   // KG3: the third panel, and its own parts
/** The kit's rules cut to the panels' own selectors - the classic skin's copy of their Plus dress. */
export const cardKitCss = () => scopeRules(frameCss(), isCardPanelSelector);

/**
 * A panel's dress, laid once a page: the kit cut to the panels on the classic skin (Enhanced Plus carries the whole kit
 * already) and the game's face. Answers whether the kit was laid now.
 * @param {any} doc
 */
export function dressCardPanel(doc = globalThis.document) {
  if (!doc?.createElement) return false;
  if (doc.head) injectEnhancedFonts(doc);   // AUDIT NAV1's law: on the classic skin nothing else asked for the face
  if (isEnhancedPlus() || doc.getElementById?.(CARD_KIT_STYLE_ID)) return false;
  const st = doc.createElement('style');
  st.id = CARD_KIT_STYLE_ID;
  st.textContent = cardKitCss();
  (doc.head ?? doc.body)?.append(st);
  return true;
}

/** The chrome's root, written once - a placeholder no element wears, so the sheet reads as rules wherever it is read
 *  (test/sheetRules.mjs reads a hole before a selector as a chunk of other rules, and would read `${root} .msg` as a bare
 *  .msg), and is built for each panel by its own root. */
const CHROME_ROOT = '.card-panel-root';
/**
 * THE CHROME both panels wear, for one panel's root (`.dfcards`, `.dfiliac`): the window's box (its edge the width the
 * kit's carved frame lands its inner 2px on), the face on its root, the header band (`.tablehead` - its title, and the
 * fold that puts the table's words away so the cloth shows), the note, the line and its tones (`warn` a refusal, `wait`
 * the table's or the realm's time, `turn` yours), the presses' row and its kinds (`primary` the press the panel is for,
 * `quiet` and `warn` standing apart at the row's end), and the log, a line a sentence, the newest last.
 * Geometry and words only: every surface's paint is the kit's, by role.
 */
const CHROME_CSS = `
.card-panel-root, .card-panel-root * { box-sizing: border-box; }
.card-panel-root { position: fixed; z-index: 13; margin: 0; padding: 0 12px 10px; border-width: 2px; border-style: solid; ${PIXEL_FONT_CSS} font-size: 14px; line-height: 1.35;
  color: #e9e4d9; --cp-dim: #b9ab93; --cp-word: #d8cfae; --cp-red: #ff9a8a;
  max-height: calc(100vh - 36px); overflow: auto; overscroll-behavior: contain; }
.card-panel-root .tablehead { display: flex; align-items: center; gap: 8px; margin: 0 -12px 8px; padding: 7px 12px 6px; border-bottom-width: 2px; border-bottom-style: solid;
  font: inherit; font-size: 14px; }
.card-panel-root .tabletitle { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.12em;
  text-transform: uppercase; color: #efe0b8; text-shadow: 2px 2px 0 #050608; }
.card-panel-root .fold { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-width: 2px; border-style: solid;
  color: #efe8d6; line-height: 1; cursor: pointer; user-select: none; -webkit-user-select: none; }
.card-panel-root .tablenote { margin: 0 0 6px; font-size: 12px; color: var(--cp-dim); }
.card-panel-root .msg { margin: 6px 0 0; padding: 3px 0 3px 8px; border-left: 3px solid transparent; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.card-panel-root .msg.warn { color: #ffc4bb; border-left-color: #b83a2e; background: rgba(120,30,20,0.3); }
.card-panel-root .msg.wait { color: var(--cp-word); border-left-color: ${FRAME_TONES.brassLo}; }
.card-panel-root .msg.turn { color: ${FRAME_TONES.brassHi}; border-left-color: ${FRAME_TONES.brassHi}; background: linear-gradient(90deg, rgba(243,207,134,0.13), transparent 85%); }
.card-panel-root .tableacts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
.card-panel-root button { margin: 0; padding: 3px 10px; border-width: 2px; border-style: solid; font: inherit; font-size: 13px; color: #efe8d6; text-align: center; cursor: pointer; }
.card-panel-root button[data-kind="primary"] { color: #fff2cc; }
.card-panel-root button[data-kind="quiet"], .card-panel-root button[data-kind="warn"] { margin-left: auto; }
.card-panel-root button:disabled { color: rgba(239,232,214,0.45); cursor: default; }
.card-panel-root input { font: inherit; }
.card-panel-root input[type=range] { accent-color: ${FRAME_TONES.brass}; }
/* the log: room for four lines of 16px under its rule, the first 4px down - so scrolled to the newest, the top of its
   window stands on a whole line (a line a fixed box: the five's own face would grow one that holds a 5) */
.card-panel-root .log { margin-top: 8px; padding: 0 0 4px; border-top-width: 2px; border-top-style: solid; max-height: 70px; overflow-y: auto; font-size: 12px; color: var(--cp-dim); }
.card-panel-root .log > div { height: 16px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-panel-root .log > div:first-child { margin-top: 4px; }
.card-panel-root.collapsed .tablenote, .card-panel-root.collapsed .log { display: none; }
:root[data-plus-theme="stone"] .card-panel-root { --cp-dim: ${STONE_DIM}; --cp-word: ${STONE_WORD}; --cp-red: ${STONE_RED}; }
@media (pointer: coarse) { .card-panel-root button, .card-panel-root .fold { min-height: 44px; } .card-panel-root .fold { width: 44px; } }
`;
/** The chrome for one panel's root selector. */
export const cardPanelChromeCss = (/** @type {string} */ root) => CHROME_CSS.replaceAll(CHROME_ROOT, root);

/**
 * AUDIT CARDS-PLUS D5: THE FOLD'S WORDS, both panels' - what it does to the PANEL (its words put away so the cloth
 * shows; "Hide the table" said the reverse of what the player sees), in the player's language, as its tooltip and as
 * its name to a screen reader (whose name was the glyph, "−").
 * @param {any} fold @param {boolean} collapsed
 */
export function foldWords(fold, collapsed) {
  const words = collapsed ? t('cards.table.fold.show', 'Expand the panel') : t('cards.table.fold.hide', 'Collapse the panel');
  fold.title = words;
  fold.setAttribute?.('aria-label', words);
}
