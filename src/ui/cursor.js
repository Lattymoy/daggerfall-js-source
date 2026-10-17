// The classic mouse pointer (U arc).
//
// CLASSIC-CURSOR (FIELD BUGS 2026-10-03, Skibbster on Discord: "When using classic mode, the cursor stays as the
// system default instead of using the classic cursor like in DFU"): DFU'S OWN ARROW. DFU reads no cursor out of the
// game's files: SetCursor (DaggerfallUnitySetupGameWizard.cs:743-771) takes a mod's "Cursor" texture replacement, else
// `Cursor.SetCursor(null, Vector2.zero, CursorMode.Auto)` - Unity's default cursor, which ProjectSettings.asset names
// (`defaultCursor`, hotspot 0,0): Assets/Resources/Cursor2.png, the 32x32 three-blue arrow. DFU-authored art (MIT),
// vendored byte for byte under public/art/dfu-cursor/ (vendor/dfu-cursor). The port read a CURSOR.IMG out of the
// player's ARENA2 instead - a file DFU never reads and the game data DFU points its players at does not carry
// (Field-Bugs-2026-09-27-field-console: "the OS cursor stands in") - so the classic skin all but always wore the
// system arrow; and it was put on only once the data was in, so the front menu never had it at all.
//
// Now the arrow is laid at boot, no data needed, on the CLASSIC skin (GrimoireUI is the classic skin under a pack and
// ships no cursor of its own: DFU's arrow, as DFU shows it). A RULE over every element, !important, as Plus's gauntlet
// is (ui/plus/plusCursor.js): a hardware cursor is the whole screen's, and the inline cursor on <html> lost to every panel's
// own `cursor: pointer` - the chat, the social panel, a button - which showed the OS hand. A text field keeps its caret,
// and a canvas a controller hid the pointer on (ui/gamepadInput.js) keeps it hidden. Enhanced Plus wears its gauntlet.
// NEVER TRAPS: the rule names `auto` after the arrow - an arrow that will not load is the OS's.
//
// A LEAF on the boot path (test/render/boot2.test.js): the skin and the root are systems/ modules already on the entry's reach.

import { isEnhanced } from '../systems/uiSkin.js';
import { APP_ROOT } from '../systems/appRoot.js';

/** DFU's default cursor: the served file and its hotspot (ProjectSettings `cursorHotspot`). */
export const DFU_CURSOR_FILE = 'art/dfu-cursor/Cursor2.png';
export const DFU_CURSOR_HOTSPOT = Object.freeze([0, 0]);
export const dfuCursorUrl = (root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') => new URL(DFU_CURSOR_FILE, root).href;

/** CURSOR-EDGE: no custom cursor past 32 DIP a side - Chromium shows a larger one only while the whole image lies inside
 *  the viewport, and the OS arrow anywhere else. DFU's arrow is 32x32, drawn at 1x: exactly the limit. */
export const MAX_CURSOR_DIP = 32;

/** The classic skin's pointer rules: DFU's arrow everywhere, a text field's caret, a pad-hidden canvas hidden. */
export const classicCursorCss = (url = dfuCursorUrl()) => {
  const arrow = `url("${url}") ${DFU_CURSOR_HOTSPOT[0]} ${DFU_CURSOR_HOTSPOT[1]}, auto`;
  return `
html, html *, html *::before, html *::after { cursor: ${arrow} !important; }
html canvas[style*="cursor: none"] { cursor: none !important; }
html input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), html textarea, html [contenteditable="true"] { cursor: text !important; }
`;
};

/** CURSOR-EDGE (AUDIT part five UI1): a native scrollbar shows the OS arrow whatever <html> wears, and a classic page
 *  never lays ENHANCED_CSS (the chat, the social panel, the profile and the decorator mount on either skin) - so the
 *  classic cursor brings the enhanced sheet's dress itself; a pointer device only (UI2: a touch screen keeps its
 *  overlay scrollbar, and has no cursor to keep). */
export const CURSOR_SCROLLBAR_CSS = `@media (any-pointer: fine) {
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
::-webkit-scrollbar-thumb { background: rgba(125,116,96,0.5); border: 2px solid rgba(0,0,0,0.3); border-radius: 0; } }`;

export const CLASSIC_CURSOR_STYLE_ID = 'df-classic-cursor';
const SCROLLBAR_STYLE_ID = 'df-cursor-scrollbars';

/** Lay DFU's arrow on the page - on the classic skin, once (the skin is chosen by a reload). Answers whether it is
 *  worn. */
export function installCursor(doc = globalThis.document, { classic = !isEnhanced() } = {}) {
  if (!classic || !doc?.head || !doc.createElement) return false;
  const lay = (id, css) => {
    if (doc.getElementById?.(id)) return;
    const st = doc.createElement('style');
    st.id = id; st.textContent = css;
    doc.head.append(st);
  };
  lay(CLASSIC_CURSOR_STYLE_ID, classicCursorCss());
  lay(SCROLLBAR_STYLE_ID, CURSOR_SCROLLBAR_CSS);
  return true;
}
