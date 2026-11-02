// @ts-check
// RPT1026-CLIENT (a private report, 2026-10-23: a pad's A pressed on the open world map threw a NotFoundError from
// setPointerCapture, an invalid pointer id, and the crash report it raised stayed until the page was reloaded).
// THE CAPTURE THAT CANNOT THROW. A pad's press is a synthetic
// pointer (ui/plus/plusPad.js domPointer, ui/enhanced/enhancedDialog.js replayClick: `pointerId: 1`, the mouse's id in
// Chromium), and a browser holding no pointer of that id - Firefox numbers its mouse 0 - refuses to capture or release
// it with a NotFoundError, thrown out of the listener to the page: the crash report over a game that ran on. A capture
// is a drag's comfort, never its law - refused, the press still lands where it was pressed - so every capture and
// release in the game's own windows goes through here (test/ui/rpt1026_client_capture.test.js sweeps for one that does
// not).

/** Capture pointer `id` on `el`; false where the browser refused it (no such pointer). No element, or one with no capture,
 *  has nothing to refuse: true (AUDIT RPT1026 K5 - this said false). */
export function capturePointer(/** @type {any} */ el, /** @type {number} */ id) {
  try { el?.setPointerCapture?.(id); return true; } catch { return false; }
}

/** Release pointer `id` from `el`; false where the browser refused it. */
export function releasePointer(/** @type {any} */ el, /** @type {number} */ id) {
  try { el?.releasePointerCapture?.(id); return true; } catch { return false; }
}
