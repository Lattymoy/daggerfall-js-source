// DISC22-C: THE CLASSIC SKINS' QUICK-LOOT FRAME, a LEAF - no imports, on purpose. The hover resolve
// (ui/worldPlaque.js worldHoverFrame) leaves the frame and its lit row here and ui/hud.js reads them for the canvas
// panel (ui/classicLootPanel.js). hud.js sits under half the tree's import rings, and reaching for systems/quickLoot.js
// (and through it the item graph) from there closed a ring that initialised itemTransfer.js before its own constants
// - so the one thing hud.js needs is kept where it costs no import at all.
//
// Held WITH the frame mark it was resolved in (systems/frameClock.js frameMark), so a panel whose hover stopped being
// asked - a window up, the host between modes - is never drawn from a stale frame.
let _frame = null;
let _lit = -1;
let _mark = null;

export function setClassicLootFrame(frame, mark = null, lit = -1) { _frame = frame ?? null; _mark = mark; _lit = frame ? lit : -1; }
/** The frame resolved in frame `mark`, with its lit row - or null. */
export const classicLootFrame = (mark = null) => (_frame && _mark === mark ? { frame: _frame, lit: _lit } : null);
