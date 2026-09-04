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
// click (hostMagic.interceptAttack, live in all four hosts).
//
// A8 RETIRED THE POINTER-PARITY FLAG that stood here and at the four E
// sites in the hosts. Mouse0 IS ActivateCenterObject now, on DFU's own
// edges - cast on the press (EntityEffectManager.cs:250), activate on
// the release (PlayerActivate.cs:279), castPending and the readied-
// spell block included; the law is systems/activateGate.js and all
// four hosts read that one copy.
//
// TWO RECORDED DEPARTURES STAND, both deliberate and neither a missing
// slice: the port's E still activates beside Mouse0 (DFU binds E to
// AbortSpell), and the SWING is still read off the raw right button.
// Ledger A carries them as E ACTIVATES BESIDE MOUSE0, AND THE SWING IS
// ROUTED OFF THE RAW BUTTON (AUDIT 58, seams lane) - by name, because a
// line number rots, and because section A's only other mention of this
// file is the STRUCK C2 hotkey-repeat row, which approves nothing.
//
// ROAD-Ar R10 rewrote that second sentence. It used to read "Mouse2
// still swings (DFU's SwingWeapon is Mouse1)" and recorded a mismatch
// that does not exist: MOUSE_CODES below maps DOM button 2 - the RIGHT
// button, the one every host swings on - to the code 'Mouse1', which is
// DFU's own SwingWeapon default (InputManager.cs:1010, and
// inputActions.js's DEFAULT_BINDINGS row). The physical button is
// parity. What actually departs is the ROUTING: the four hosts swing on
// a hardcoded `e.button === 2` and nothing in src/ ever reads
// `held(keys, 'SwingWeapon')`, so rebinding SwingWeapon in the controls
// window is INERT - unlike the Mouse0 activate, which A8 deliberately
// routed through `held(keys, 'ActivateCenterObject')` and which does
// follow a rebind. The seam when that is closed is held(), same as A8's.
//
// AbortSpell and RecastSpell have no consumer here yet - the actions
// are in the registry and the ladder simply does not answer them.
import {
  loadOrCreateBindings, actionForCode,
  getCombo, comboCode, comboModifiers, isPairedCode,
} from '../systems/inputActions.js';

// The registry singleton - built on first read, so the module can be
// imported by tests without touching storage until asked.
let _bindings = null;
export function bindings() { return (_bindings ??= loadOrCreateBindings()); }
/** Tests (and the I3 controls window) swap the live store. */
export function setBindings(b) { _bindings = b; }

/**
 * A8 - GetUnaryKey's COMBO ARM (:1670-1712) over the port's held-keys
 * Set. One code, one answer:
 *  - a COMBO code hits when both halves are down and no OTHER combo
 *    modifier is (ModifierOnlyHeld's second clause, :1636-1638) - G3
 *    below narrowed that sweep to the ORDERED read DFU actually makes;
 *  - a PLAIN code is SUPPRESSED when the combo (heldModifier, code) is
 *    a KEY of primarySecondaryKeybindDict and that modifier is down
 *    (:1683-1685) - "space is jump, LeftShift+Space opens inventory:
 *    we want to ignore jumping".
 *
 * ROAD-Ar R9: that second test is isPairedCode, NOT "bound anywhere".
 * primarySecondaryKeybindDict is the primary<->secondary pairing map,
 * so the suppression bites only when the combo'd action is DOUBLE-
 * bound; a combo held in one dict alone leaves the plain key firing,
 * exactly as DFU leaves it. The port used a union membership test and
 * killed the plain key in cases DFU never does.
 *
 * ROAD-G G3 CLOSED THE ORDER HALF, and it was never a Set problem: a
 * JS Set ITERATES IN INSERTION ORDER, so every host's `keys` has
 * carried the press order all along and nothing here read it. What was
 * missing is the LATCH DFU derives from its ring -
 * `modifierHeldFirstDict` (:1697-1708): the flag goes TRUE on any frame
 * the modifier is held with nothing disqualifying beside it
 * (ModifierOnlyHeld, :1626-1644) and FALSE the moment the modifier is
 * not held at all, and `hit` is that flag AND the combo'd key
 * (:1711). Press K and THEN Shift and the flag never rises, because K
 * was already in the ring when Shift arrived - so Shift+K does not
 * fire, which is the behaviour the port had no way to produce.
 *
 * The port reads the latch out of the Set instead of storing it, and
 * the two agree because DFU's flag is cleared by the modifier's
 * RELEASE and by nothing else: a modifier is "held first" exactly when
 * no key still down BEFORE it disqualifies it. Release the K you were
 * holding and DFU's next frame raises the flag with Shift still down;
 * so does this walk, because K has left the Set. That is the whole
 * equivalence, and it is why no per-frame state is kept here.
 *
 * ModifierOnlyHeld's FIRST clause lands with it (:1636 - a held key
 * PAIRED with this modifier disqualifies it, not just another
 * modifier), and so does `heldModifier` (:1818-1821): DFU picks ONE
 * modifier for the plain-key suppression - the LAST held one in
 * modifierHeldFirstDict's enumeration - where the port swept them all.
 *
 * ModifierOnlyHeld's `heldKeys.Length == 1` arm (:1628-1629) is not
 * ported because it is dead in DFU: `heldKeys` is `new KeyCode[6]`
 * (totalHeldKeys, :35), so `Length` is 6 forever and the `> 1` arm is
 * the only one that runs.
 */
/** heldModifier (:1818-1821). PollInput walks modifierHeldFirstDict and
 *  keeps the LAST held modifier it sees, so a second one down does not
 *  add a suppressor - it REPLACES the first. */
function heldModifier(store, keys) {
  let hm = null;
  for (const m of comboModifiers(store)) if (keys.has(m)) hm = m;
  return hm;
}

/** modifierHeldFirstDict[mod] (:1697-1708) read off the ordered Set,
 *  through ModifierOnlyHeld (:1626-1644). The walk stops AT the
 *  modifier: only keys that went down before it can disqualify it, and
 *  a key that has since been released is not in the Set to be seen. */
function modifierHeldFirst(store, keys, mod) {
  if (!keys.has(mod)) return false;                 // :1705-1707 - the else arm, flag down
  const mods = comboModifiers(store);
  for (const k of keys) {
    if (k === mod) return true;                     // :1699-1701 - nothing disqualifying went first
    // :1636-1637, both clauses: a key PAIRED with this modifier, or any
    // other modifier. A key that is neither - 'W' for forward - is
    // ignored, exactly as the C# comment says.
    if (isPairedCode(store, comboCode(mod, k)) || mods.has(k)) return false;
  }
  return false;                                     // :1643, unreachable while keys.has(mod)
}

function codeDown(store, keys, code) {
  const c = getCombo(code);
  if (c) {
    const [mod, key] = c;
    // :1697-1711. The modifier arm reads HELD (getKeyMethod) whatever
    // edge the caller asked for; only the combo'd key takes `method`,
    // and it takes it with checkModHeldFirst FALSE - a combo never
    // suppresses its own key.
    if (!modifierHeldFirst(store, keys, mod)) return false;
    return keys.has(key);
  }
  if (!keys.has(code)) return false;
  // :1683-1685 - "space is jump, LeftShift+Space opens inventory. We
  // want to ignore jumping if we were holding shift PRIOR to pressing
  // space". The `prior` is the latch, and it is why pressing space and
  // then shift still jumps.
  const hm = heldModifier(store, keys);
  if (hm != null && modifierHeldFirst(store, keys, hm)
    && isPairedCode(store, comboCode(hm, code))) return false;
  return true;
}

/** The action a key event means under the live bindings, or null.
 *  Hand in the host's held-keys Set and combos resolve too: a keydown
 *  on the combo'd key with its modifier already down answers the
 *  COMBO's action, and the plain binding on that key is suppressed. */
export function actionOf(e, keys = null) {
  const b = bindings();
  if (keys) {
    // ROAD-G G3: the ring AS THE HOST HOLDS IT, plus this press. A host
    // that adds the code before its ladder hands it in already placed
    // (PollInput adds every held key in one sweep, :1806-1809); a host
    // that adds it after gets it appended here, which is the same
    // position. Either way the Set is the press order the latch reads,
    // so the union must NOT rebuild a Set that already contains it -
    // that would be the same order, but the guard says why.
    const down = keys.has(e.code) ? keys : new Set([...keys, e.code]);
    for (const m of comboModifiers(b)) {
      if (!keys.has(m)) continue;
      const cc = comboCode(m, e.code);
      const a = actionForCode(b, cc);
      // ...and the combo only ANSWERS when GetUnaryKey says it hits:
      // the modifier must have been held FIRST (:1697-1711). Hold K,
      // then Shift, and this press of K reports its plain action.
      if (a && codeDown(b, down, cc)) return a;
    }
    if (!codeDown(b, down, e.code)) return null;
  }
  return actionForCode(b, e.code);
}

/** Held-state read for the hosts' per-frame polls: is ANY key bound
 *  to the action (primary or secondary) in the host's held-keys set?
 *  This is InputManager.GetKey's dual-dict fallthrough (:1084) over
 *  the port's `keys` Set idiom - and since A8, through the combo arm
 *  above, so a rebound "Shift + W" walks and a bare W under a held
 *  Shift does not. ROAD-G G3: that arm now reads the Set's INSERTION
 *  ORDER, which is the ring's - so "Shift + W" walks only when the
 *  Shift went down FIRST, and a W already held when the Shift arrives
 *  keeps walking forward. This is the seam the held-order remainder
 *  named, and it is the same one line for line in all four hosts. */
export function held(keys, action) {
  const b = bindings();
  for (const [code, a] of b.primary) if (a === action && codeDown(b, keys, code)) return true;
  for (const [code, a] of b.secondary) if (a === action && codeDown(b, keys, code)) return true;
  return false;
}

/** AUDIT 39r: the MOUSE half of the held-keys set. InputManager binds
 *  three actions to buttons and polls them through the same GetKey
 *  dictionary as the keyboard - Mouse2/AutoRun (:995), Mouse1/
 *  SwingWeapon (:1010), Mouse0/ActivateCenterObject (:1017) - but the
 *  port's `keys` Set was fed by keydown alone, so `held(keys,
 *  'AutoRun')` could never answer true and the AutoRun latch and the
 *  drawn bow's un-draw were both unreachable at the shipped bindings.
 *  The ORDER is not the DOM's: Unity's KeyCode counts Mouse0/1/2 as
 *  left/RIGHT/MIDDLE, MouseEvent.button as left/MIDDLE/right, so the
 *  two middle names cross. One table, so no host spells 'Mouse' +
 *  e.button and hands the wheel the right button's action. */
export const MOUSE_CODES = Object.freeze(['Mouse0', 'Mouse2', 'Mouse1']);
/** The binding code for a MouseEvent.button, or null past the third. */
export function mouseCode(button) { return MOUSE_CODES[button] ?? null; }

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
  // AUDIT 58 (f3/input): the table below can never see '-', 'r' or 'R'
  // - the typed-character branch above owns them (the trailing `-` in
  // that class is a LITERAL, and r/R fall under a-zA-Z), so the rows
  // `'-': 'minus'`, `r: 'reroll'`, `R: 'reroll'` that used to stand
  // here were unreachable and read as a promise the module could not
  // keep. A consumer that wants those keys reads 'char:-' / 'char:r' /
  // 'char:R' beside its own action name, as ui/chargen.js:1689 already
  // did and ui/charsheet.js's LevelUpScreen now does. The branches are
  // deliberately NOT reordered: putting the table first would starve
  // every text field of '-', 'r' and 'R'. '+' and '=' are outside the
  // class, so 'plus' still arrives as an action - the asymmetry is the
  // character class's, not a choice.
  return ({
    ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Backspace: 'backspace',
    Escape: 'back', '+': 'plus', '=': 'plus',
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

/**
 * ROAD-E E1: THE KEY-UP HALF OF THE OVERLAY SEAM, routeKey's mirror.
 *
 * DFU has no "key down route": `InputManager` keeps a held-key
 * dictionary and every window polls it in its own `Update()` -
 * `GetKeyDown` is the edge, `GetKeyUp` the other edge and `GetKey` the
 * HELD state (HotkeySequence.IsDownWith / IsUpWith / IsPressedWith,
 * HotkeySequence.cs:169-183). The port's windows are event driven, so
 * the release edge has to be delivered the way the press already is,
 * and a window that never hears it cannot answer `IsUpWith` (the
 * automap windows' two-phase toggle-close, DaggerfallAutomapWindow.cs
 * :703-713) or keep a `GetKey` latch honest (their twenty-two
 * IsPressedWith arms, :783-870).
 *
 * The RAW `e.code` goes down, exactly as townTalk's D4 keyup seam
 * delivers it: `systems/dialogShortcuts.js`'s `normalizeCode` folds
 * both host alphabets, so one spelling serves a native window and a
 * keyed one alike. OPTIONAL by design - a context with no
 * `overlayKeyUp` (or a window with no `keyup`) is one whose buttons
 * subscribe no keyboard handler, which is nearly all of them - but the
 * ROUTE is not optional: it is the seam the four hosts must all carry.
 */
export function routeKeyUp(e, ctx) {
  if (!ctx?.uiOverlayActive) return false;
  ctx.overlayKeyUp?.(e.code, e);
  return true;
}

/** Route one keydown against a dungeon context. Returns true when
 *  consumed (the host preventDefaults and stops). Cases carry DFU's
 *  action names; each cites its DFU consumer.
 *
 *  AUDIT 58 (f3/input): `keys` is the HOST'S held-keys Set and it is
 *  not optional in practice - without it actionOf below cannot see a
 *  combo, and GetUnaryKey's combo branch (InputManager.cs:1666-1712)
 *  is dead for every DISPATCHED action while staying live for the
 *  polled ones, which read through held(). Every host that registers a
 *  keydown hands its own Set in; test/combohosts.test.js sweeps them. */
export function routeKey(e, ctx, setPlayerPos = null, keys = null) {
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
    if (actionOf(e, keys) === 'QuickLoad') { ctx.quickLoad?.(setPlayerPos); return true; }   // AUDIT 58 (f3/input): the Set rides in here too, so a QuickLoad rebound to a COMBO still answers from under a window
    return false;
  }
  // Diagnostics, not a DFU action: DFU's F8 is PrintScreen, which has
  // no consumer here yet, and the debug HUD is the port's own.
  if (e.code === 'F8') { ctx.toggleDebugHud?.(); return true; }
  // PX15: THE DIAL, the port's own too - Tab raises the enhanced
  // compass rose. `=== true` matters: a host without the arm, or the
  // classic skin (the opener's own gate), answers false and Tab keeps
  // its default, so classic behaviour is byte-for-byte untouched.
  if (e.code === 'Tab') { return ctx.toggleDial?.() === true; }
  const act = actionOf(e, keys);
  if (POLLED_ACTIONS.has(act)) return false;
  return routeAction(act, ctx, setPlayerPos);
}

/**
 * THE ACTIONS THE FRAME OWNS. WeaponManager.Update reads ReadyWeapon
 * itself, per frame, on ActionStarted's edge (WeaponManager.cs:284) -
 * it is NOT in GameManager's key dispatch chain (:509-557), and every
 * host here polls it the same way (`held(keys, 'ReadyWeapon')` with an
 * edge latch). When U45 gave routeAction a ReadyWeapon arm so the
 * large HUD's sheath panel could reach the same door, the KEYBOARD
 * started reaching it too, through routeKey, in every host whose ctx
 * carries toggleSheath: the two dungeon contexts. There a Z press
 * toggled on keydown AND on the frame's edge - twice, net nothing -
 * and the player could not draw or sheathe a weapon in a dungeon.
 * Above ground and indoors the ctx had no toggleSheath, so one path
 * fired and it worked, which is why it read as "dungeons only".
 *
 * So the keyboard dispatch declines these; the frame's poll is their
 * one door for a key, and routeAction keeps the arm for the panel,
 * which has no poll.
 */
/** a12: SwitchHand joins it, for the same reason one rung up - it is
 *  read inside WeaponManager.Update (:271-273), not by GameManager's
 *  dispatch chain, and every host now polls it on the RELEASE edge
 *  ActionComplete gives it. Nothing in routeAction answers it (the
 *  large HUD has no hand panel; DFU's does not either), so the decline
 *  here is the claim that the frame owns the key - written down where
 *  the ReadyWeapon comment above says a second one belongs. */
export const POLLED_ACTIONS = new Set(['ReadyWeapon', 'SwitchHand']);

/**
 * THE ACTION LADDER ALONE, without the key event. U45 pulled it out
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
/**
 * U47 - THE KEYS THE BROWSER WOULD STEAL. F5 reloads the page, F6
 * moves focus, F11 goes fullscreen - and all three are DFU bindings
 * (CharacterSheet, Inventory, QuickLoad). AUDIT 17e F41 made the point
 * for F5 the hard way: the mode gate skipped the handler AND its
 * preventDefault, so pressing it inside a building destroyed the
 * session. Swallowing is NOT conditional on the host having a
 * destination - the exterior host has nothing to quickload and must
 * still not go fullscreen.
 *
 * One list, because there is one keyboard, and every host that
 * registers a keydown calls this FIRST.
 */
export const BROWSER_STEALS = Object.freeze(['F5', 'F6', 'F11']);
export function swallowBrowserKey(e) {
  if (!BROWSER_STEALS.includes(e.code)) return false;
  e.preventDefault();
  return true;
}

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
    // U43: the two journal doors. GameManager's chain has had both
    // since the quest machine landed (:541-548) and the bindings have
    // been in the table since I1 - L and N - with NOTHING in src/
    // reading either, while ui/questJournal.js sat fully built with
    // all four of its pages. They are ONE window: LogBook pushes it as
    // it stands, NoteBook sets DisplayMode = Notebook first
    // (DaggerfallUI.cs:704-711).
    case 'LogBook': ctx.toggleLogbook?.(); return true;
    case 'NoteBook': ctx.toggleNotebook?.(); return true;
    case 'AutoMap': ctx.toggleAutomap?.(); return true;   // A1; ROAD-C c2/S9 gave the INTERIOR ctx one too - the optional call is now for the exterior arm alone
    case 'QuickSave': ctx.quickSave?.(); return true;
    case 'QuickLoad': ctx.quickLoad?.(setPlayerPos); return true;
    // U45: the four the large HUD reaches that no keybind in this
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
