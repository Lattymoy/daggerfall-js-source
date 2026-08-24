// The input map (UI arc). One bindings module retiring the
// duplicated per-host key routers and if-chains - and since I2, a
// CONSUMER of the rebindable registry (systems/inputActions.js,
// InputManager.cs's law) rather than a table of literals. Every
// gameplay key resolves through the player's bindings; the DFU
// defaults live in inputActions.DEFAULT_BINDINGS.
//
// I2 RETIRED the C-cast departure this header used to carry: DFU has
// no cast key - CastSpell (Backspace) OPENS THE SPELLBOOK
// (GameManager.cs:550-553), and a readied spell fires on the attack
// click (hostMagic.interceptAttack, live in all four hosts). What
// still pends the pointer-parity slice: DFU casts and activates on
// Mouse0 (ActivateCenterObject - EntityEffectManager.cs:250,
// PlayerActivate.cs:280) where the port clicks Mouse2 and holds E,
// and E's DFU meaning (AbortSpell) with Q's (RecastSpell) - FLAGGED
// at the E sites in the hosts.
import { loadOrCreateBindings, actionForCode } from '../systems/inputActions.js';

// The registry singleton - built on first read, so the module can be
// imported by tests without touching storage until asked.
let _bindings = null;
export function bindings() { return (_bindings ??= loadOrCreateBindings()); }
/** Tests (and the I3 controls window) swap the live store. */
export function setBindings(b) { _bindings = b; }

/** The action a key event means under the live bindings, or null. */
export function actionOf(e) { return actionForCode(bindings(), e.code); }

/** Held-state read for the hosts' per-frame polls: is ANY key bound
 *  to the action (primary or secondary) in the host's held-keys set?
 *  This is InputManager.GetKey's dual-dict fallthrough (:1084) over
 *  the port's `keys` Set idiom. */
export function held(keys, action) {
  const b = bindings();
  for (const [code, a] of b.primary) if (a === action && keys.has(code)) return true;
  for (const [code, a] of b.secondary) if (a === action && keys.has(code)) return true;
  return false;
}

/** The four movement axes in one read - each host's frame builds this
 *  once and derives forward/strafe/moving/standingStill from it,
 *  instead of twelve raw keys.has() calls. */
export function moveHeld(keys) {
  return {
    forwards: held(keys, 'MoveForwards'),
    backwards: held(keys, 'MoveBackwards'),
    left: held(keys, 'MoveLeft'),
    right: held(keys, 'MoveRight'),
  };
}
export const anyMove = (mv) => mv.forwards || mv.backwards || mv.left || mv.right;

/** Overlay-mode actions (chargen, level-up, sheet, windows). Digits
 *  joined for the U6 input box (the blind-god answer is "1"). */
export function overlayAction(e) {
  if (e.key.length === 1 && /[a-zA-Z0-9 '-]/.test(e.key)) return 'char:' + e.key;
  return ({
    ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Backspace: 'backspace',
    Escape: 'back', '+': 'plus', '=': 'plus', '-': 'minus', r: 'reroll', R: 'reroll',
  })[e.key] ?? null;
}

/** The character a key event types, for the windows that carry a text
 *  field. The two hosts route keys differently - townTalk hands a
 *  choice window the raw `e.code` while the dungeon's routeKey hands
 *  it an ACTION - so a field has to read both, and this is the one
 *  place that knows how (U26). */
export function typedChar(code, e = null) {
  if (typeof code === 'string' && code.startsWith('char:')) return code.slice(5);
  if (e && e.key?.length === 1) return e.key;
  const d = /^(?:Digit|Numpad)([0-9])$/.exec(code ?? '');
  return d ? d[1] : null;
}

/** Route one keydown against a dungeon context. Returns true when
 *  consumed (the host preventDefaults and stops). Cases carry DFU's
 *  action names; each cites its DFU consumer. */
export function routeKey(e, ctx, setPlayerPos = null) {
  if (ctx.uiOverlayActive) {
    // U26: a NATIVE window keys off raw codes, exactly as townTalk's
    // seam has since G2 - the action map ('back'/'confirm'/'up') is
    // the keyed windows' vocabulary and says nothing about F6, the
    // mode buttons or a digit. The dungeon host had no such branch,
    // which is one of the reasons it never got the native inventory.
    if (ctx.overlayIsNative) { ctx.overlayInput(e.code, e); return true; }
    const a = overlayAction(e);
    if (a) { ctx.overlayInput(a); return true; }
    // Quickload works from ANY overlay (the death screen's F11 hint
    // must be true); everything else stays gated.
    if (actionOf(e) === 'QuickLoad') { ctx.quickLoad?.(setPlayerPos); return true; }
    return false;
  }
  // Diagnostics, not a DFU action: DFU's F8 is PrintScreen, which has
  // no consumer here yet, and the debug HUD is the port's own.
  if (e.code === 'F8') { ctx.toggleDebugHud?.(); return true; }
  return routeAction(actionOf(e), ctx, setPlayerPos);
}

/**
 * THE ACTION LADDER ALONE, without the key event. U43 pulled it out
 * of routeKey because the large HUD's eleven panels post ACTIONS -
 * DFU's own handlers PostMessage into the UI manager - so a click on
 * the bar and a press of the bound key have to arrive at the same
 * door. Two doors is how the port would grow two behaviours for one
 * button.
 *
 * Every arm past the first four is optional-chained, which is the
 * seam this file already uses for a law the hosts adopt one at a
 * time: an action no host has wired yet is simply not consumed, and
 * the caller can say so rather than crashing.
 *
 * Returns true when consumed.
 */
export function routeAction(action, ctx, setPlayerPos = null) {
  switch (action) {
    // Escape with no overlay up opens the pause options window
    // (GameManager's escape door; the window closes itself on the
    // same key). Optional-chained: hosts grow the seam one at a time.
    case 'Escape': return ctx.togglePause ? (ctx.togglePause(setPlayerPos), true) : false;
    case 'CharacterSheet': ctx.toggleCharSheet(); return true;
    case 'Inventory': ctx.toggleInventory(); return true;
    // GameManager.cs:550-553 - the CastSpell ACTION opens the
    // spellbook window; the cast itself is the attack click.
    case 'CastSpell': ctx.toggleSpellbook(); return true;
    case 'Rest': ctx.toggleRest?.(); return true;
    case 'AutoMap': ctx.toggleAutomap?.(); return true;   // A1 (optional-chained: only the dungeon contexts carry one today)
    case 'QuickSave': ctx.quickSave?.(); return true;
    case 'QuickLoad': ctx.quickLoad?.(setPlayerPos); return true;
    // U43: the four the large HUD reaches that no keybind in this
    // port has ever routed. Each is a real DFU destination and each
    // is optional here, so the panel is live the moment a host grows
    // the door and dead - not broken - until then.
    case 'Status': return ctx.showStatus ? (ctx.showStatus(), true) : false;
    case 'TravelMap': return ctx.openTravelMap ? (ctx.openTravelMap(), true) : false;
    case 'ReadyWeapon': return ctx.toggleSheath ? (ctx.toggleSheath(), true) : false;
    case 'UseMagicItem': return ctx.openUseMagicItem ? (ctx.openUseMagicItem(), true) : false;
    case 'Transport': return ctx.openTransport ? (ctx.openTransport(), true) : false;
    // ...and the mode cycle, which is the ONE panel that changes state
    // itself rather than opening a window. It is not an InputManager
    // action in DFU either - the panel calls ChangeInteractionMode
    // directly - so these two names are the port's, and the host that
    // owns the mode HUD line answers them.
    case 'CycleModeForward': return ctx.cycleMode ? (ctx.cycleMode(1), true) : false;
    case 'CycleModeBackward': return ctx.cycleMode ? (ctx.cycleMode(-1), true) : false;
    default: return false;
  }
}
