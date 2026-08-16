// The input map (UI arc). One bindings module retiring the
// duplicated per-host key routers and if-chains. Bindings follow
// DFU's classic defaults where they exist: F5 character sheet, F6
// inventory, Backspace spellbook. Casting on C is OURS (classic
// casts by click after readying; the click-to-cast refinement is a
// queue row) - flagged here, the single place it lives now.

/** A one-shot latch: arm once, consume once (click-to-cast). */
export class OneShotLatch {
  constructor() { this.armed = false; }
  arm() { this.armed = true; }
  consume() { const a = this.armed; this.armed = false; return a; }
}

/** Overlay-mode actions (chargen, level-up, sheet, windows). Digits
 *  joined for the U6 input box (the blind-god answer is "1"). */
export function overlayAction(e) {
  if (e.key.length === 1 && /[a-zA-Z0-9 '-]/.test(e.key)) return 'char:' + e.key;
  return ({
    ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Backspace: 'backspace',
    Escape: 'back', '+': 'plus', '=': 'plus', '-': 'minus', r: 'reroll', R: 'reroll',
  })[e.key] ?? null;
}

/** Gameplay-mode actions. */
export function gameAction(e) {
  if (e.key === 'F5') return 'charSheet';          // classic
  if (e.key === 'F6') return 'inventory';          // classic
  if (e.key === 'Backspace') return 'spellbook';   // DFU default
  if (e.code === 'KeyC') return 'castSpell';       // ours (classic click-to-cast also live)
  if (e.code === 'KeyR') return 'rest';            // DFU default (U7)
  if (e.key === 'F9') return 'quickSave';          // DFU default
  if (e.key === 'F12') return 'quickLoad';         // DFU default
  if (e.key === 'F8') return 'debugHud';           // diagnostics
  return null;
}

/** Route one keydown against a dungeon context. Returns true when
 *  consumed (the host preventDefaults and stops). */
export function routeKey(e, ctx, castDir, setPlayerPos = null) {
  if (ctx.uiOverlayActive) {
    const a = overlayAction(e);
    if (a) { ctx.overlayInput(a); return true; }
    // Quickload works from ANY overlay (the death screen's F12 hint
    // must be true); everything else stays gated.
    if (gameAction(e) === 'quickLoad') { ctx.quickLoad?.(setPlayerPos); return true; }
    return false;
  }
  switch (gameAction(e)) {
    case 'charSheet': ctx.toggleCharSheet(); return true;
    case 'inventory': ctx.toggleInventory(); return true;
    case 'spellbook': ctx.toggleSpellbook(); return true;
    case 'castSpell': { const d = castDir(); ctx.playerCastInput(d.eye, d.dir); return true; }
    case 'rest': ctx.toggleRest?.(); return true;
    case 'quickSave': ctx.quickSave?.(); return true;
    case 'quickLoad': ctx.quickLoad?.(setPlayerPos); return true;
    case 'debugHud': ctx.toggleDebugHud?.(); return true;
    default: return false;
  }
}
