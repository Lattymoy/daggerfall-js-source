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

/** Where it stands: under the compass strip, centred. */
export const GATE_BANNER_TOP = '64px';

let node = null;
let shown = '';

/** The banner's text now, or null to hide it; `hidden` is the HUD's own hide (a window up, the HUD off). */
export function drawGateBanner(text, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && typeof text === 'string' && text ? text : '';
  if (!node) {
    if (!want || !doc?.createElement) return;
    node = doc.createElement('div');
    node.className = 'wb-gate-banner';
    node.style.cssText = `position:fixed;left:50%;top:${GATE_BANNER_TOP};transform:translateX(-50%);pointer-events:none;`
      + `z-index:30;font:600 15px 'Cormorant', Georgia, serif;letter-spacing:0.08em;text-transform:uppercase;`
      + `color:${GATE_RING_CSS};text-shadow:0 0 3px #000, 0 0 8px rgba(0,0,0,0.9), 0 0 14px rgba(255,70,30,0.45);white-space:nowrap`;
    (doc.body ?? doc.documentElement)?.append(node);
  }
  if (want === shown) return;
  shown = want;
  node.textContent = want;
  node.style.display = want ? '' : 'none';
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroyGateBanner() {
  node?.remove?.();
  node = null;
  shown = '';
}
