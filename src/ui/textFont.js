// TEXT-FONT (2026-10-11). A player: "A Sans font, a Monospace font and a Dyslexic compatible font would be nice. But
// allowing selection from system fonts would be most ideal".
//
// THE WORDS. The enhanced skin (Enhanced Plus, and DFO Grimoire over it) writes every word in its own game face - the
// pixel stack, or the pack's Alagard. The player may write them instead in a plain sans, a monospace, OpenDyslexic
// (shipped under public/fonts/opendyslexic/, SIL OFL - it is fetched only when chosen), or any font installed on
// their own machine, named or picked from the list the browser gives (the Local Font Access API, where there is one).
// One sheet says it: every element under the body in the chosen face, but the wordmark. Canvas text (the classic
// windows, the world) is drawn by the game and keeps its own font. (A player's name stands apart from what they write
// by its COLOUR, not its face - ui/chatColours.js.)
import { getPref, setPref } from '../systems/uiPrefs.js';
import { APP_ROOT } from '../systems/appRoot.js';

export const TEXT_FONT_STYLE_ID = 'dfo-text-font';
export const TEXT_FONTS = Object.freeze({ game: 'Game', sans: 'Sans', mono: 'Monospace', dyslexic: 'Dyslexic', system: 'My font' });
export const DYSLEXIC_FAMILY = 'OpenDyslexic';
export const DYSLEXIC_DIR = 'fonts/opendyslexic';
/** The stacks: each names what the common systems carry, so a machine without the first still lands on its kind. */
export const TEXT_STACKS = Object.freeze({
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, 'Cascadia Mono', 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace",
  dyslexic: `'${DYSLEXIC_FAMILY}', 'Comic Sans MS', sans-serif`,
});
/** Kept in their own face whatever the words are in: the wordmark and the menu's emblem. */
export const KEEP_SELECTORS = Object.freeze(['.px-wordmark', '.shell .brand h1', '.look-emblem']);

/** A typed font name made safe to stand in a quoted CSS family: no quote, backslash, brace, angle or semicolon, and
 *  never longer than a family name has reason to be. */
export const cleanFamily = (name) => String(name ?? '').replace(/["'\\{}<>;\n\r]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64);

export const textFont = () => (Object.hasOwn(TEXT_FONTS, getPref('textFont')) ? getPref('textFont') : 'game');
export const textFontSystem = () => cleanFamily(getPref('textFontSystem'));

/** The face the words are in, as a font-family value - null for the game's own (no override at all). 'My font' with
 *  no name yet is the game's own too. */
export function wordStack(id = textFont(), system = textFontSystem()) {
  if (id === 'system') return system ? `'${system}', ${TEXT_STACKS.sans}` : null;
  return TEXT_STACKS[id] ?? null;
}

const fontUrl = (file, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') => new URL(`${DYSLEXIC_DIR}/${file}`, root).href;

/** The sheet, for the choice in hand. */
export function textFontCss(id = textFont(), system = textFontSystem()) {
  const words = wordStack(id, system);
  const keep = [...KEEP_SELECTORS, ...KEEP_SELECTORS.map((q) => `${q} *`)].join(', ');
  let css = '/* TEXT-FONT: ui/textFont.js */\n';
  if (id === 'dyslexic') {
    css += `@font-face { font-family: '${DYSLEXIC_FAMILY}'; font-weight: 400; font-display: swap; src: url("${fontUrl('opendyslexic-latin-400-normal.woff2')}") format('woff2'); }
@font-face { font-family: '${DYSLEXIC_FAMILY}'; font-weight: 700; font-display: swap; src: url("${fontUrl('opendyslexic-latin-700-normal.woff2')}") format('woff2'); }
`;
  }
  if (words) {
    css += `:root { --dfo-text-font: ${words}; }
body, body *:not(:is(${keep})) { font-family: var(--dfo-text-font) !important; -webkit-font-smoothing: auto !important; font-synthesis: weight style !important; }
`;
  }
  return css;
}

/** Wear the stored choice on the page (idempotent; the sheet is rewritten in place). */
export function mountTextFont(doc = globalThis.document) {
  if (!doc?.head) return false;
  const root = doc.documentElement;
  if (root?.dataset) root.dataset.textFont = textFont();
  let st = doc.getElementById(TEXT_FONT_STYLE_ID);
  if (!st) { st = doc.createElement('style'); st.id = TEXT_FONT_STYLE_ID; }
  st.textContent = textFontCss();
  doc.head.append(st);   // last, every time: after the skin's and the dress's sheets
  return true;
}

export function setTextFont(id, doc = globalThis.document) {
  if (!Object.hasOwn(TEXT_FONTS, id)) return false;
  setPref('textFont', id);
  mountTextFont(doc);
  return true;
}
export function setTextFontSystem(name, doc = globalThis.document) {
  setPref('textFontSystem', cleanFamily(name));
  mountTextFont(doc);
  return true;
}

/** The fonts installed on this machine, by family, where the browser lets a page ask (Chromium's Local Font Access -
 *  it asks the player first). [] where it does not, or the player said no: the name can still be typed. */
export async function installedFamilies(win = globalThis) {
  if (typeof win?.queryLocalFonts !== 'function') return [];
  try {
    const fonts = await win.queryLocalFonts();
    return [...new Set(fonts.map((f) => f.family).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  } catch { return []; }
}
export const canListFonts = (win = globalThis) => typeof win?.queryLocalFonts === 'function';

/**
 * FONT-PICK (FIELD BUGS 2026-10-13, a player on Gentoo / Niri, Wayland: "the font selector ... has no scrolling ability ...
 * I have 376 fonts"): the families the picker shows for what is typed - every one whose name holds the typed text (case
 * aside), those that BEGIN with it first, each group in the list's own order; the whole list for nothing typed, or for
 * exactly the name already worn (the field opens on it).
 * @param {string[]} families @param {string} typed
 */
export function fontMatches(families, typed) {
  const q = String(typed ?? '').trim().toLowerCase();
  if (!q || families.some((f) => f.toLowerCase() === q)) return [...families];
  const starts = [], holds = [];
  for (const f of families) { const n = f.toLowerCase(); if (n.startsWith(q)) starts.push(f); else if (n.includes(q)) holds.push(f); }
  return [...starts, ...holds];
}
