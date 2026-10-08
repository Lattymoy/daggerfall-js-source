// @ts-check
// WB2 (2026-09-25): THE GATE'S COUNTDOWN OVER THE SCREEN - "Oblivion Gate - opens in 3:12", standing under the
// compass while the player is within GATE_BANNER_M of a gate (scenes/gatePool.js decides the words; this draws them).
//
// A READOUT, NOT A WINDOW (the enhanced HUD's own law, ui/enhancedHud.js): it takes no click, registers with no
// overlay stack, and is UPDATED, NOT REBUILT - one node made on the first word, its text written only when it
// changes, hidden (never removed) when there is nothing to say. It hides with the HUD (`hidden`), so a window over
// the game or the held map takes it with them.
//
// Not a DFU member. Ledger A (WB).
import { GATE_RING_CSS } from './gateMapMark.js';
import { injectEnhancedFonts } from './enhancedStyle.js';   // WB13c: the classic face, loaded by the gate's own screens

/** Where it stands: under the compass strip, centred. */
export const GATE_BANNER_TOP = '64px';
/** AUDIT SD III (T1, T3): the banner wraps inside the screen's width (on one line it ran off both sides of a phone at an
 *  Abyss Dungeon's door), and an Abyss Dungeon's stands in the Hour's brass (`look` 'brass' - ui/sdTitleCard.js's), never
 *  Dagon's red. */
export const SD_BANNER_BRASS = '#e8c060';
/** PLUS-DRESS (2026-09-26): the banner's look as a class, so a skin's sheet can dress it (ui/enhancedPlusStyle.js). */
export const GATE_BANNER_STYLE_ID = 'dagger-gate-banner-style';
export const GATE_BANNER_CSS = `
.wb-gate-banner { position: fixed; left: 50%; top: ${GATE_BANNER_TOP}; transform: translateX(-50%); pointer-events: none;
  z-index: 30; font: 600 15px 'Cormorant', Georgia, serif; letter-spacing: 0.08em; text-transform: uppercase;
  color: ${GATE_RING_CSS}; text-shadow: 0 0 3px #000, 0 0 8px rgba(0,0,0,0.9), 0 0 14px rgba(255,70,30,0.45);
  width: max-content; max-width: calc(100vw - 32px); text-align: center; line-height: 1.3; }
.wb-gate-banner.sd-brass { color: ${SD_BANNER_BRASS}; text-shadow: 0 0 3px #000, 0 0 8px rgba(0,0,0,0.9), 0 0 14px rgba(232,192,96,0.45); }
`;

let node = null;
let shown = '', shownCls = 'wb-gate-banner';

/** The banner's text now, or null to hide it; `hidden` is the HUD's own hide (a window up, the HUD off); `look` the
 *  gate's (Dagon's red) or 'brass' (an Abyss Dungeon's door). */
export function drawGateBanner(text, { hidden = false, look = 'gate', doc = globalThis.document } = {}) {
  const want = !hidden && typeof text === 'string' && text ? text : '';
  if (!node) {
    if (!want || !doc?.createElement) return;
    if (doc.getElementById && !doc.getElementById(GATE_BANNER_STYLE_ID)) {
      const st = doc.createElement('style');
      st.id = GATE_BANNER_STYLE_ID;
      st.textContent = GATE_BANNER_CSS;
      (doc.head ?? doc.body)?.append(st);
      if (doc.head) injectEnhancedFonts(doc);   // WB13c: Cormorant on the classic skin too (it came only if another window had asked)
    }
    node = doc.createElement('div');
    node.className = 'wb-gate-banner';
    (doc.body ?? doc.documentElement)?.append(node);
  }
  const cls = look === 'brass' ? 'wb-gate-banner sd-brass' : 'wb-gate-banner';
  if (cls !== shownCls) { shownCls = cls; node.className = cls; }
  if (want === shown) return;
  shown = want;
  node.textContent = want;
  node.style.display = want ? '' : 'none';
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroyGateBanner() {
  node?.remove?.();
  node = null;
  shown = ''; shownCls = 'wb-gate-banner';
}
