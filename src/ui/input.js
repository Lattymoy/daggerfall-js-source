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

/** Overlay-mode actions (chargen, level-up, sheet, windows). */
export function overlayAction(e) {
  if (e.key.length === 1 && /[a-zA-Z '-]/.test(e.key)) return 'char:' + e.key;
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
  if (e.code === 'KeyC') return 'castSpell';       // ours (click-to-cast pends)
  return null;
}

/** Route one keydown against a dungeon context. Returns true when
 *  consumed (the host preventDefaults and stops). */
export function routeKey(e, ctx, castDir) {
  if (ctx.uiOverlayActive) {
    const a = overlayAction(e);
    if (a) { ctx.overlayInput(a); return true; }
    return false;
  }
  switch (gameAction(e)) {
    case 'charSheet': ctx.toggleCharSheet(); return true;
    case 'inventory': ctx.toggleInventory(); return true;
    case 'spellbook': ctx.toggleSpellbook(); return true;
    case 'castSpell': { const d = castDir(); ctx.playerCastInput(d.eye, d.dir); return true; }
    default: return false;
  }
}
