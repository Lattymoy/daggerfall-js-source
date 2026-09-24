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
// TWO RECORDED DEPARTURES STOOD HERE: the port's E activating beside
// Mouse0 as a raw `KeyE` read (DFU binds E to AbortSpell - so one press
// did both), and the SWING read off the raw right button. KB1 closed the
// first: E is the port's own Interact ACTION (systems/inputActions.js),
// read with `pressed` like every other key, and AbortSpell's default
// moved to Backquote (Mac's call, 2026-09-23). Ledger A's row E
// ACTIVATES BESIDE MOUSE0, AND THE SWING IS ROUTED OFF THE RAW BUTTON
// (AUDIT 58, seams lane) records both closures, and THE KEYBINDING
// STANDARD row the standard itself.
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
// CLOSED by MAC-SWING1 (2026-09-21): swingHeld reads `held(keys,
// 'SwingWeapon')` for a non-mouse binding and swingKeyHeld is the latch
// the four hosts poll - a swing bound to a key or a pad button swings.
//
// AbortSpell and RecastSpell are routeAction's (FIX-F); every other
// world key is an action too since KB1 - the one registry, read live.
import {
  loadOrCreateBindings, actionForCode, actionLive,
  getCombo, comboCode, comboModifiers, isPairedCode, modifierHeldFirstDict,
} from '../systems/inputActions.js';
// AUDIT 64 F36/F37: DaggerfallHUD.Update's own shortcut arms. A leaf
// on systems/ alone, so this module can take it without a cycle.
import { hudShortcutKey } from './hudShortcuts.js';
import { hotbarInForce } from '../systems/uiSkin.js';   // AUDIT CONTRIB H1: the diamond's actions stand down while the hotbar is in force
import { statusReadoutTakesAction, setStatusBindings } from '../systems/statusReadout.js';   // STATUS-LIVE: the readout yields to whatever wants the slot, and the panel names the live Status key. A LEAF - this module is in ui/actionText.js's own import ring (through ui/inputMessageBox.js), so reaching for the BOX from here put its class body in a temporal dead zone
import { printScreen } from './screenshot.js';   // AUDIT KB1: PrintScreen is routed like every world action, so a window's F8 stays the window's
import { getInt, getFloat } from '../systems/settings.js';   // SWING-SAY: the swing mode and its threshold, for the boot readout

// The registry singleton - built on first read, so the module can be
// imported by tests without touching storage until asked.
let _bindings = null;
export function bindings() {
  if (_bindings) return _bindings;
  _bindings = loadOrCreateBindings();
  setStatusBindings(_bindings);   // STATUS-LIVE: the readout's caption names the key that actually answers
  saySwingChain();   // SWING-SAY: once, at the moment the store is first real
  deliverCarried();   // AUDIT KB1 F3: what the one-time carry could not bring forward, told to the player
  return _bindings;
}

// AUDIT KB1 F3: THE CARRY'S REPORT GOES TO THE PLAYER. systems/inputActions.js loadOrCreateBindings leaves on the
// store what a v1 file's carry could not keep - an action whose new key the player's own file already spends, a
// mod's old key another action holds - and this module cannot say it: the HUD door (systems/notify.js) reaches this
// file through its own imports. So the composition root (main.js) hands the sink in, and the report is delivered
// once, whichever of the two - the sink or the store - comes first.
let _carriedSink = null;
function deliverCarried() {
  const r = _bindings?.carried;
  if (!r || !_carriedSink) return;
  _bindings.carried = null;
  _carriedSink(r);
}
export function setKeybindNoticeSink(fn) { _carriedSink = fn; deliverCarried(); }
/** Tests (and the I3 controls window) swap the live store. */
export function setBindings(b) { _bindings = b; setStatusBindings(b); }   // STATUS-LIVE: a rebound Status key renames the readout's caption with it

/**
 * SWING-SAY (2026-09-22, Mac: "its not working on the install but works
 * on the browser. Each time I bring this up you avoid it"): THE SWING
 * CHAIN, SAID OUT LOUD, BECAUSE IT CANNOT BE READ FROM HERE.
 *
 * Three reports now - SquidKamer, Mango, Hawkiinz - all "the swing does
 * not work in the installed build, it works in the browser". MAC-SWING1
 * and MAC-D1 each found a real fault behind that sentence and each
 * shipped; the reports continue. The whole chain reads sound from the
 * source and the gesture fires in a test at ten pixels of travel, so
 * whatever is left is STATE, and the state that differs between the two
 * is the only asymmetry there is: the browser keeps its store in
 * localStorage and the desktop app keeps its own FILE, which survives
 * updates and reinstalls. One player, one machine, two stores - and the
 * app's is the old one.
 *
 * What cannot be read from here can still be made to speak. This prints
 * the live answer to every question the chain asks, in one line, at the
 * one moment the store becomes real:
 *
 *   - every code SwingWeapon answers to, in both dicts, so a swing that
 *     moved to a key or lost its mouse row is visible rather than
 *     inferred;
 *   - which DOM button that resolves to (-1 = none, and then the drag
 *     has no button to hold, which is MAC-SWING1's case);
 *   - whether the action is REACHABLE without a gamepad (MAC-D1's);
 *   - the swing MODE, because Vanilla is the only mode that tracks a
 *     drag and both earlier reporters worked around the bug by moving
 *     to Click - a setting the app's file has kept ever since;
 *   - the travel a swing needs, in pixels, which is the number that
 *     would make a threshold fault obvious.
 *
 * It is a READOUT and nothing else: it changes no state and repairs
 * nothing. A fix guessed from here would be a fix aimed at a machine I
 * cannot see - this is the smallest thing that turns the next report
 * into an answer instead of another round of this.
 */
export function swingChainState({ width = globalThis.innerWidth ?? 0, height = globalThis.innerHeight ?? 0 } = {}) {
  const b = _bindings ?? bindings();
  const codes = [];
  for (const dict of [b.primary, b.secondary]) for (const [code, a] of dict) if (a === 'SwingWeapon') codes.push(code);
  const button = swingButton();
  const mode = swingMode();
  const threshold = getFloat('Controls', 'WeaponAttackThreshold', 0.001, 1.0);
  return {
    codes,
    button,                                   // -1: no mouse code, so the drag has no button
    reachable: codes.some((c) => !c.startsWith('Joystick')),
    mode,                                     // 0 Vanilla (the drag), 1 Click, 2 Hold
    modeName: ['Vanilla', 'Click', 'Hold'][mode] ?? String(mode),
    threshold,
    travelPx: Math.round(threshold * Math.max(width, height)),
  };
}
/** Controls/WeaponSwingMode - 0 Gesture (the drag), 1 Click, 2 Click or
 *  Hold. SWING-LABEL: one reader for the readout above and the enhanced
 *  controls pane's Swing Weapon line. */
export function swingMode() { return getInt('Controls', 'WeaponSwingMode', 0, 2); }
let _said = false;
/** Tests only: the line is said ONCE per session by design, so driving
 *  it over several states needs the latch let go. */
export function _resetSwingSay() { _said = false; }
export function saySwingChain() {
  if (_said || typeof console === 'undefined') return;
  _said = true;
  try {
    const s = swingChainState();
    // A WARNING when the drag cannot work, a log when it can - so the
    // one state that matters stands out in a console a player is
    // reading for the first time.
    const broken = s.mode !== 0 || s.button < 0 || !s.reachable;
    (broken ? console.warn : console.log)(
      `[swing] SwingWeapon=${s.codes.join('+') || 'NOTHING'} button=${s.button} reachable=${s.reachable} `
      + `mode=${s.modeName}(${s.mode}) threshold=${s.threshold} (~${s.travelPx}px of drag)`
      + (s.mode !== 0 ? ' - only Vanilla tracks a drag' : '')
      + (s.button < 0 ? ' - no mouse button holds the swing; the drag cannot start' : ''));
  } catch { /* a readout never costs a boot */ }
}

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
 * ROAD-G G3 CLOSED THE ORDER HALF, and ROAD-GR corrected HOW. The
 * order does not live in the ring's iteration at all: DFU's `heldKeys`
 * is not even press-ordered, because PollInput zeroes `heldKeyCounter`
 * and refills it in KeyCodeList order every frame (:1801-1809), and
 * ModifierOnlyHeld scans the WHOLE of it - `for (int i = 0; i <
 * heldKeyCounter; i++)` (:1632-1639) - with no break at the modifier.
 * What carries the order is the LATCH, `modifierHeldFirstDict`, and it
 * is STATE, not a function of the current frame (:1695-1708):
 *   - RAISED only on a frame where the modifier is held AND that
 *     whole-set scan comes back clean (:1699-1701);
 *   - LOWERED only when the modifier is not held at all (:1704-1707);
 *   - and on the "modifier held, scan DIRTY" path DFU assigns nothing
 *     at all - there is no else on :1699 - so the flag keeps whatever
 *     it already said.
 * `hit` is that flag AND the combo'd key (:1711).
 *
 * Both halves of the asymmetry fall out of those three lines. A
 * disqualifier that arrives AFTER the modifier cannot lower a flag
 * already up: press Shift alone, then Ctrl, then K, and Shift+K still
 * fires. But it DOES hold a flag that never rose DOWN: hold a
 * disqualifying K, press Shift, press L, release K, and DFU's scan
 * still fails on the held L, so Shift+L never fires however the Set
 * now reads. G3 first DERIVED the flag by walking the Set to the
 * modifier and stopping there, and called the two equivalent; they are
 * not, and that second shape is where the derivation fired a combo DFU
 * refuses. The dict is STORED now - on the bindings store the seam
 * already takes, rebuilt on `rev` exactly as SetupActionKeyDict clears
 * it and re-seeds one false per combo modifier after every binding
 * change (:1354-1358).
 *
 * And "disqualifying" is R9-narrow (:1636-1637): a held key PAIRED
 * with this modifier - i.e. the combo'd action is DOUBLE-bound - or a
 * combo modifier itself. Press K and THEN Shift and the flag never
 * rises WHEN THAT K DISQUALIFIES; a SINGLE-bound Shift+K disqualifies
 * nothing and fires on either order, in DFU and here. "Either 'K' or
 * 'L' are not being held" (:1623-1624) is DFU's COMMENT, not its code,
 * and the pins are written against the code, both ways round
 * (test/g3_heldorder.test.js).
 *
 * FindKeyboardActions runs GetUnaryKey over EVERY bound code each
 * frame (:1826-1832 over existingKeyDict, :1327-1341), so every combo
 * modifier takes its raise/lower every frame - not only the ones a
 * caller happens to ask about. The port's reads are per-action and
 * pull-based, so `held` and `actionOf` sweep the dict on entry with
 * the ring as it stands; the write is idempotent in the ring, so
 * sweeping on each read gives one frame's answer.
 *
 * `heldModifier` (:1818-1821) lands with it: DFU picks ONE modifier
 * for the plain-key suppression - the LAST HELD one in
 * modifierHeldFirstDict's enumeration - where the port swept them all.
 */
/** heldModifier (:1818-1821). PollInput walks modifierHeldFirstDict and
 *  keeps the LAST held modifier it sees, so a second one down does not
 *  add a suppressor - it REPLACES the first. */
function heldModifier(store, keys) {
  let hm = null;
  for (const m of comboModifiers(store)) if (keys.has(m)) hm = m;
  return hm;
}

/** ModifierOnlyHeld (:1626-1644) over the host's held-keys Set. The
 *  scan is the WHOLE ring, as `for (int i = 0; i < heldKeyCounter;
 *  i++)` (:1632-1639) is: ANY held key that disqualifies does so
 *  wherever it sits, and there is no break at the modifier. The order
 *  is the latch's, not this scan's.
 *
 *  ModifierOnlyHeld's `heldKeys.Length == 1` arm (:1628-1629) is not
 *  ported because it is dead in DFU: `heldKeys` is `new KeyCode[6]`
 *  (totalHeldKeys, :35, :100), so `Length` is 6 forever and the `> 1`
 *  arm is the only one that runs. */
function modifierOnlyHeld(store, keys, mod) {
  const mods = comboModifiers(store);
  for (const k of keys) {
    if (k === mod) continue;                        // :1635 - `modifier != k`
    // :1636-1637, both clauses: a key PAIRED with this modifier, or any
    // other modifier. A key that is neither - 'W' for forward - is
    // ignored, exactly as the C# comment says.
    if (isPairedCode(store, comboCode(mod, k)) || mods.has(k)) return false;   // :1638
  }
  return true;                                      // :1641
}

/** GetUnaryKey's combo arm, :1695-1708 - the ONLY writer of the latch,
 *  and the whole of DFU's order rule. The missing else on the dirty
 *  scan is deliberate and load-bearing: a modifier held with a
 *  disqualifier beside it keeps whatever the dict already said, so a
 *  flag that never rose stays down while that key is held. */
function pollModifier(store, keys, mod) {
  const dict = modifierHeldFirstDict(store);
  if (keys.has(mod)) {                                              // :1695 - the modifier reads HELD
    if (modifierOnlyHeld(store, keys, mod)) dict.set(mod, true);    // :1699-1701
  } else {
    dict.set(mod, false);                                           // :1704-1707
  }
  return dict.get(mod) === true;
}

/** modifierHeldFirstDict[(int)mod] as its two READERS ask it - `hit`
 *  (:1711) and the plain-key suppression (:1683-1685). Neither writes;
 *  the write is pollModifier, which the frame sweep below has already
 *  run for every combo modifier against this ring. */
const modifierHeldFirst = (store, mod) => modifierHeldFirstDict(store).get(mod) === true;

/** FindKeyboardActions' per-frame sweep (:1826-1832 over
 *  existingKeyDict, :1327-1341) at the port's pull-based seam: every
 *  combo modifier takes its raise/lower against the ring as it stands,
 *  before any reader looks at a flag. Idempotent in the ring, so a
 *  host that polls held() twelve times a frame still gets one frame's
 *  answer, and a host that polls no combo'd action at all still gives
 *  the modifier its clean frame - which is where the flag rises. */
function pollLatch(store, keys) {
  for (const m of comboModifiers(store)) pollModifier(store, keys, m);
}

function codeDown(store, keys, code, ring = keys) {
  const c = getCombo(code);
  if (c) {
    const [mod, key] = c;
    // :1695-1711. The modifier arm reads HELD (getKeyMethod) whatever
    // edge the caller asked for; only the combo'd key takes `method`,
    // and it takes it with checkModHeldFirst FALSE - a combo never
    // suppresses its own key. The assignment comes BEFORE the read,
    // exactly as :1695-1708 sits above :1711.
    //
    // MWCROUCH: `ring` IS that `method`. It was written into the
    // comment above long before it was a parameter - the held Set for
    // GetKey, the frame's down ring for GetKeyDown, the up ring for
    // GetKeyUp - and only the combo'd key takes it, exactly as the
    // sentence says. The modifier arm and the plain-key suppression
    // below both keep reading the HELD Set, because that is what
    // :1695 and :1683 read whatever edge is being asked for.
    if (!pollModifier(store, keys, mod)) return false;
    return ring.has(key);
  }
  if (!ring.has(code)) return false;
  // :1683-1685 - "space is jump, LeftShift+Space opens inventory. We
  // want to ignore jumping if we were holding shift PRIOR to pressing
  // space". The `prior` is the latch, and it is why pressing space and
  // then shift still jumps.
  // It READS the stored flag - `modifierHeldFirstDict[(int)heldModifier]`
  // (:1683) - and never recomputes one from this frame's Set.
  const hm = heldModifier(store, keys);
  if (hm != null && modifierHeldFirst(store, hm)
    && isPairedCode(store, comboCode(hm, code))) return false;
  return true;
}

/**
 * AUDIT KB1: WHAT A KEY EVENT MEANS TO A LISTENER THAT HOLDS NO HOST RING - a window's own-key close (the book on
 * CastSpell, the dial on QuickDial, the sheet on F5), the hotbar's slots, the screenshot. The event's own modifier
 * flags pick the combo (the LEFT codes, DFU's combo keys - inputActions.js comboModifiers), both dicts answer (a pad
 * button is a secondary), a switched-off mod's key means nothing, and NOTHING IS WRITTEN.
 *
 * Two bugs made this one door. `actionOf(e)` with no ring read the bare code, so a window opened by a combo (the
 * dial on Shift+Q) could not be closed by it - Shift+Q read as Q, RecastSpell. And the first cut's answer for the
 * hotbar and the screenshot, `actionOf(e, eventModifiers(e))`, handed the latch a made-up ring: DFU's held-first
 * flags (modifierHeldFirstDict) are the HOST's frame state, polled over the host's own held keys, and a listener's
 * guess of a ring must not write them. The latch exists to order a modifier against a key across frames; a
 * listener has one event, and the event's flags are the whole truth about it.
 */
export function eventAction(e) {
  if (!e?.code) return null;
  const b = bindings();
  for (const [flag, mod] of [['shiftKey', 'ShiftLeft'], ['ctrlKey', 'ControlLeft'], ['altKey', 'AltLeft']]) {
    if (!e[flag] || e.code === mod) continue;
    const a = actionForCode(b, comboCode(mod, e.code));
    if (a) return actionLive(a) ? a : null;
  }
  const a = actionForCode(b, e.code);
  return a && actionLive(a) ? a : null;
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
    // ...and the frame's raise/lower runs over the whole ring before a
    // flag is read, as FindKeyboardActions' sweep does (:1826-1832).
    pollLatch(b, down);
    for (const m of comboModifiers(b)) {
      if (!keys.has(m)) continue;
      const cc = comboCode(m, e.code);
      const a = actionForCode(b, cc);
      // ...and the combo only ANSWERS when GetUnaryKey says it hits:
      // the modifier's latch must be UP (:1695-1711). Hold K, then
      // Shift, and this press of K reports its plain action WHEN THAT
      // K DISQUALIFIES the modifier - paired with it, i.e. the combo'd
      // action is double-bound, or a modifier itself; otherwise
      // nothing kept the flag down and the combo answers.
      if (a && codeDown(b, down, cc)) return actionLive(a) ? a : null;   // KB1: a switched-off mod's key means nothing
    }
    if (!codeDown(b, down, e.code)) return null;
  }
  const a = actionForCode(b, e.code);
  return a && actionLive(a) ? a : null;
}

/** Held-state read for the hosts' per-frame polls: is ANY key bound
 *  to the action (primary or secondary) in the host's held-keys set?
 *  This is InputManager.GetKey's dual-dict fallthrough (:1084) over
 *  the port's `keys` Set idiom - and since A8, through the combo arm
 *  above, so a rebound "Shift + W" walks and a bare W under a held
 *  Shift does not. ROAD-G G3, as ROAD-GR corrected it: that arm reads
 *  the LATCH, so a DOUBLE-bound "Shift + W" walks only from a frame
 *  where the Shift stood clean, and a W already held when the Shift
 *  arrives keeps walking forward; SINGLE-bound, :1636 has nothing to
 *  bite on and it walks on either order (test/g3_heldorder.test.js).
 *  This is the seam the held-order remainder named, and it is the same
 *  one line for line in all four hosts. */
export function held(keys, action) {
  if (!actionLive(action)) return false;   // KB1: a switched-off mod's action is never down
  const b = bindings();
  pollLatch(b, keys);           // the frame's raise/lower, before any read (:1826-1832)
  for (const [code, a] of b.primary) if (a === action && codeDown(b, keys, code)) return true;
  for (const [code, a] of b.secondary) if (a === action && codeDown(b, keys, code)) return true;
  return false;
}

/**
 * MWCROUCH (2026-09-17, Mac: "When crouching with the morrowind model.
 * you can't uncrouch"). THE EDGE RING - GetKeyDown and GetKeyUp, which
 * the port had no seam for and was deriving instead.
 *
 * Every per-frame PRESS in the four hosts was `held(keys, act) && !prev`
 * with `prev` re-sampled at the foot of the same frame: the crouch
 * toggle, ReadyWeapon, SwitchHand's release, the E activate. That is a
 * derivation, not a read, and it drops any press whose keydown AND
 * keyup both land between two frames - the key is never in the ring on
 * a frame that looks at it. Unity does not: `Input.GetKeyDown` answers
 * true on the frame FOLLOWING the press event whatever the key does
 * afterwards, because the events are buffered and drained per frame,
 * and DFU reads exactly that (InputManager.GetKey/GetKeyDown/GetKeyUp,
 * :1084-1108, through FindKeyboardActions' one poll a frame). So a tap
 * shorter than a frame works in Daggerfall Unity at any frame rate and
 * did not work here below about 20 fps - which is where the Morrowind
 * body puts a loaded scene, and why the bug arrived wearing its name.
 *
 * The ring is the missing buffer. The host's listeners NOTE each edge
 * as the DOM delivers it; the frame ROTATES the ring once, at the top,
 * before any reader; `pressed` / `released` answer off the rotated
 * halves. Rotating once a frame is what gives an edge exactly one
 * frame of life - the same single frame Unity gives it - so a reader
 * gated behind an overlay still DROPS its edge rather than banking it,
 * which is the paused-InputManager law the old latches carried too.
 *
 * `noteKeyDown` takes the DOM's `repeat` flag: auto-repeat is one
 * physical press to Unity, and GetKeyDown fires once for it.
 */
// JAN1 (2026-09-18, Janome: "when I press T and then H to quickly get on my horse, my hand also changes sides"):
// THE RING RELEASES ONLY WHAT IT CAPTURED. T opens the transport picker, whose H accelerator (DialogShortcuts.txt's
// TransportHorse - DFU's own row) picks the horse and closes the window on the DOWN edge; the host's keydown is gated
// behind the overlay, so that down never reached the ring - but the keyup listener is ungated (a window opened
// mid-swing must still let go), so the UP landed, and SwitchHand - the one action read off the UP ring
// (ActionComplete) - flipped the hand. `own` holds every code whose down the ring saw; an up with no down of its own
// is a window's, not the player's. The mouse listeners note their down unconditionally, so a release under a window
// still lands, as its law says.
export function keyEdges() { return { down: new Set(), up: new Set(), downFrame: new Set(), upFrame: new Set(), own: new Set() }; }
export function noteKeyDown(edges, code, repeat = false) { if (edges && !repeat) { edges.down.add(code); edges.own?.add(code); } }
export function noteKeyUp(edges, code) { if (!edges) return; if (edges.own && !edges.own.delete(code)) return; edges.up.add(code); }
/** The frame's ONE rotation. Idempotent only in the sense that a second
 *  call in the same frame would throw the frame's edges away - so it is
 *  called once, at the top of the host's frame, and never inside a gate. */
export function beginInputFrame(edges) {
  if (!edges) return;
  const d = edges.downFrame; const u = edges.upFrame;
  edges.downFrame = edges.down; edges.upFrame = edges.up;
  d.clear(); u.clear();
  edges.down = d; edges.up = u;
}
function edgeAction(ring, keys, action) {
  if (!ring || !ring.size || !actionLive(action)) return false;
  const b = bindings();
  pollLatch(b, keys);           // the same frame sweep every read takes (:1826-1832)
  for (const [code, a] of b.primary) if (a === action && codeDown(b, keys, code, ring)) return true;
  for (const [code, a] of b.secondary) if (a === action && codeDown(b, keys, code, ring)) return true;
  return false;
}
/** InputManager.GetKeyDown's dual-dict fallthrough over the frame's down ring. */
export function pressed(edges, keys, action) { return edgeAction(edges?.downFrame, keys, action); }
/** ...and GetKeyUp's, over the up ring - SwitchHand's ActionComplete edge. */
export function released(edges, keys, action) { return edgeAction(edges?.upFrame, keys, action); }
// KB1: `pressedCode` - the raw E beside Mouse0 - is gone. E is the Interact action now (systems/inputActions.js), read
// with `pressed` like every other key, so a rebind moves it and nothing else is ever read off a bare code.

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

/** FIX-F: THE SWING BUTTON IS A BINDING. Every host swung on the raw
 *  `e.button === 2` / `e.buttons & 2` while the registry carried
 *  Mouse1 -> SwingWeapon (InputManager.cs:1010) and the controls
 *  window offered the row - so a player who rebound the swing got a
 *  row that did nothing. These two read the live registry: which
 *  MouseEvent.button is the swing now, and whether MouseEvent.buttons
 *  holds it. A swing bound to a KEY answers false to both - the drag
 *  gesture is the mouse's (WeaponManager reads the button through the
 *  same HasAction, but the swing's DIRECTION is the mouse delta). */
export function swingButton() {
  const b = bindings();
  for (const dict of [b.primary, b.secondary]) {
    for (const [code, a] of dict) if (a === 'SwingWeapon' && MOUSE_CODES.includes(code)) return MOUSE_CODES.indexOf(code);
  }
  return -1;
}
export const isSwingButton = (button) => button === swingButton();
/** MouseEvent.buttons' bit for a MouseEvent.button: left 1, MIDDLE 4, right 2. */
const BUTTONS_BIT = Object.freeze([1, 4, 2]);
export function swingHeld(buttons, keys = null) {
  const b = swingButton();
  if (b >= 0 && (buttons & BUTTONS_BIT[b]) !== 0) return true;   // KB1: the mouse's answer, and - below - any other code's too
  // MAC-SWING1 (2026-09-21, a player on the desktop app: "can't swing
  // my weapon on the installed version, tried binding it to other
  // keys too"): a swing bound to a KEY or a pad code answered false
  // here and everywhere, and nothing read `held(keys, 'SwingWeapon')`
  // - the recorded departure at the top of this file. setBinding
  // clears the Mouse1 row when a key takes the action, the desktop
  // app's prefs file keeps the result across reinstalls, and the row
  // in the controls window could only ever DISABLE the swing. The
  // registry's own read is the answer for any code: `keys` carries the
  // mouse codes too (every host adds mouseCode(e.button) to it), so
  // this is InputManager.HasAction(SwingWeapon) whatever it is bound to.
  // KB1: the non-mouse codes, read whether or not a button holds the other slot (swingKeyHeld below).
  return swingKeyHeld(keys);
}
/** MAC-SWING1: the rig's held latch for a swing bound to a KEY or pad
 *  code - the one no mousedown/mouseup ever raises. Each host polls it
 *  beside its other held reads and feeds attackInput on the change,
 *  exactly as its mouse handlers do for a mouse binding.
 *  KB1: EVERY non-mouse code bound to the swing, whether or not a mouse
 *  button holds the other slot. It answered only when NO mouse button was
 *  bound - so the shipped pad row (RT, the SECONDARY, beside Mouse1 in the
 *  primary) never swung at all. The mouse codes are left out because the
 *  mouse handlers already feed their own press; counting them here too
 *  would feed one press twice. */
export function swingKeyHeld(keys) {
  if (!keys) return false;
  const b = bindings();
  pollLatch(b, keys);
  for (const dict of [b.primary, b.secondary]) {
    for (const [code, a] of dict) if (a === 'SwingWeapon' && !MOUSE_CODES.includes(code) && codeDown(b, keys, code)) return true;
  }
  return false;
}

/** FIX-F: THE KEYBOARD LOOK, InputManager.FindKeyboardActions'
 *  four arms (:1854-1865): x is +1 for TurnRight and -1 for TurnLeft,
 *  y +1 for LookUp and -1 for LookDown; both held cancels, as the
 *  later `case` overwriting the earlier does not - DFU's dictionary
 *  order is the binding order, which a port cannot promise, so the
 *  one honest reading of "both" is nothing. */
export function keyboardLook(keys) {
  return {
    x: (held(keys, 'TurnRight') ? 1 : 0) - (held(keys, 'TurnLeft') ? 1 : 0),
    y: (held(keys, 'LookUp') ? 1 : 0) - (held(keys, 'LookDown') ? 1 : 0),
  };
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
  // AUDIT 58 (f3/input): the table below can never see '-', 'r' or 'R'
  // - the typed-character branch above owns them (the trailing `-` in
  // that class is a LITERAL, and r/R fall under a-zA-Z), so the rows
  // `'-': 'minus'`, `r: 'reroll'`, `R: 'reroll'` that used to stand
  // here were unreachable and read as a promise the module could not
  // keep. A consumer that wants those keys reads 'char:-' / 'char:r' /
  // 'char:R' beside its own action name, as ui/chargen.js:1833 already
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
/** CG2 (2026-09-08, Mac: "unable to type in your name"): a key typed
 *  INTO a DOM text field is the field's. The enhanced wizard's name
 *  boxes are real <input>s over the canvas; every host's keydown ladder
 *  sat behind them and either preventDefault-ed the key (no character
 *  ever inserted) or routed it as a window action. The field owns the
 *  key: the ladder neither swallows nor routes it, and neither walks
 *  the player on it. */
export function isTextEntryTarget(t) {
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true);
}

/**
 * MAC-L3: THE BROWSER MENU, SHUT ONCE.
 *
 * Mac's report, 2026-09-16 (Orion): "right click in general seems to
 * cause either a new window to open, or for the page to refresh to the
 * menu, causing unsaved progress to be lost."
 *
 * The right button is a WEAPON control here - classic Daggerfall swings
 * by dragging it - and every streaming host suppressed `contextmenu` ON
 * ITS CANVAS for exactly that reason. The canvas is not the play
 * surface, though. THIRTEEN surfaces are appended to `document.body`
 * (the pause door, the pack, the spellbook, the talk window, the
 * chronicle, the book, the character sheet, the map, the touch knobs,
 * the pad cursor, the hit numbers, the loot hover, the counter), and
 * exactly ONE of them - the map - suppressed it. Right-click anywhere else - which
 * on the enhanced skin is most of what a player looks at - and the
 * browser menu opened over the game.
 *
 * A rule enforced by thirteen copies is a rule enforced by memory. So
 * it is ONE listener, on the document, in the capture phase, and the
 * hosts install it instead of writing their own.
 *
 * THE ONE EXCEPTION IS TEXT ENTRY. The chat field and the online name
 * field are real inputs and a player must be able to paste into them;
 * `isTextEntryTarget` is the same test every other key law here asks.
 *
 * Idempotent: the four hosts may each install it and a test may install
 * it again, and there is still one listener.
 */
const CONTEXT_GUARD = new WeakSet();
export function installContextMenuGuard(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || CONTEXT_GUARD.has(doc)) return false;
  CONTEXT_GUARD.add(doc);
  doc.addEventListener('contextmenu', (e) => {
    if (isTextEntryTarget(e.target)) return;   // a field the player types in keeps its paste menu
    e.preventDefault();
  }, true);
  return true;
}

export function routeKey(e, ctx, setPlayerPos = null, keys = null) {
  // CG2: the field's key - not routed, not swallowed (the host preventDefaults on true). KB1: with or without an
  // overlay - a DOM field over the world (an enhanced prompt) is typed into with no overlay in the host's slot, and
  // every letter was an action (M the map, R the rest).
  if (isTextEntryTarget(e?.target)) return false;
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
  // AUDIT 64 F36/F37 - THE HUD'S OWN SHORTCUTS (DaggerfallHUD.cs
  // :308-318): F10 flips Settings.LargeHUD, Shift-F10 flips renderHUD.
  // They are DaggerfallShortcut bindings, not InputManager actions, so
  // they sit beside the raw-code arms below and never reach
  // routeAction's switch - and they sit BELOW the uiOverlayActive
  // return above, because DaggerfallUI.cs:429-433 updates only the top
  // window and DaggerfallHUD.Update is dead while one is open.
  if (hudShortcutKey(e, keys)) return true;
  // KB1: the diagnostics readout was a raw F8 here, answering only while F8 was unbound (FIX-F) - which, with DFU's
  // PrintScreen on F8, was never. It is the registry's DebugOverlay now (routeAction below), shipped unbound; F8
  // takes the screenshot (ui/screenshot.js).
  const act = actionOf(e, keys);
  // PX15: THE DIAL, the port's own too - QuickDial (Tab) raises the enhanced
  // compass rose. `=== true` matters: a host without the arm, or the
  // classic skin (the opener's own gate), answers false and the key keeps
  // its default, so classic behaviour is byte-for-byte untouched. KB1: the
  // registry's action, not a literal Tab - a rebind moves it.
  if (act === 'QuickDial') { return ctx.toggleDial?.() === true; }
  if (POLLED_ACTIONS.has(act)) return false;
  // MAC-R2 (2026-09-17, Mac: "The enhanced quickbar sometimes shows double
  // messages"): A HELD KEY AUTO-REPEATS ITS KEYDOWN, and the two quickslot
  // actions that are NOT polled (the swap and the off hand) were routed on
  // every one of them - so a key held a beat too long readied the swap and
  // put it away again, or lit the torch and doused it, two lines and a net
  // nothing. DFU's ActionStarted is the press edge alone (InputManager
  // .cs:634-637), which is what `noteKeyDown` already gives the polled
  // three; the repeat is nothing here too, and it is SWALLOWED rather than
  // handed on, so no ladder below can act on it either.
  //
  // AUDIT KB1: AND EVERY ROUTED ACTION, not the quickslots alone. The repeat reached routeAction for every arm that
  // opens no window (a window, once up, takes the repeats through the overlay branch above): a held F8 took a
  // screenshot per repeat, a held F9 quicksaved per repeat. DFU dispatches all of them on ActionStarted.
  if (e.repeat && act) return true;
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
/** QS6: and the three quickslot keys that HOLD (systems/quickslots.js
 *  CYCLE_SLOTS). Mac asked for one key that does two things - a tap
 *  performs the slot, a hold cycles what is in it - and a press that
 *  acts on its DOWN edge cannot be the start of a hold: the potion is
 *  drunk before the player has held long enough to mean "let me choose
 *  one". So the keyboard dispatch declines them here, exactly as it
 *  declines Z and H, and each host's frame drives the machine
 *  (tickQuickslotHold) that owns both edges.
 *
 *  routeAction keeps their arms for the same reason ReadyWeapon keeps
 *  its one: a PANEL - the HUD diamond's own touch cells - has no frame
 *  poll and posts the action. 'QuickSwap' and 'QuickOffHand' are NOT
 *  here: neither holds, so the down edge is the whole of the press. */
export const POLLED_ACTIONS = new Set(['ReadyWeapon', 'SwitchHand', 'QuickUse1', 'QuickUse2', 'QuickSpell']);

/** QS2 - THE THREE THE TWO SELF-ROUTING HOSTS ANSWER ABOVE THEIR MODE GATE.
 *
 *  AUDIT SOC B4/D1 is the whole of the reason this list exists. SOC5 put the
 *  social door inside `scenes/world.js`'s exterior-mode gate, and the interior
 *  and dungeon modes' own contexts carry their own ctx - so F did nothing in a
 *  tavern and nothing in a dungeon, and nobody noticed because it worked in the
 *  street. A quickslot is worth MORE underground than it is on a road, so the
 *  same trap would have been worse here.
 *
 *  `scenes/world.js` and `scenes/exterior.js` route their own keys and each
 *  reads this set to answer these three ABOVE the mode gate, under the same
 *  overlay and pause gates every other gameplay door takes. The two hosts that
 *  call `routeKey` need nothing: their ctx already reaches the table. */
export const QUICKSLOT_ACTIONS = new Set(['QuickUse1', 'QuickUse2', 'QuickSwap', 'QuickOffHand', 'QuickSpell']);   // QS6: the spell slot joins them

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
  // STATUS-LIVE: THE READOUT YIELDS, BEFORE ANY ARM BELOW RUNS. The
  // status panel does not pause the game, so it is still standing in a
  // host's overlay slot while the player presses the next key - and
  // the arms below are exactly the keys that WANT that slot. Two of
  // the four hosts would simply have refused (the dungeon's free-slot
  // guards, the interior arm's push), which is a key that silently
  // does nothing. Here, once, because this is the one door every
  // host's window keys and the large HUD's eleven panels come through.
  // Escape is SPENT by the close (the truthy answer): at a panel, that
  // key means "close this", not "and also open the pause menu".
  if (statusReadoutTakesAction(action)) return true;
  switch (action) {
    // Escape with no overlay up opens the pause options window
    // (GameManager's escape door; the window closes itself on the
    // same key). Optional-chained: hosts grow the seam one at a time.
    // MAC-L1: the door takes an OPTIONS OBJECT, and `setPlayerPos`
    // rides inside it. This arm used to hand the position applier over
    // positionally - `ctx.togglePause(setPlayerPos)` - and three of the
    // four hosts read argument one as the options, so Escape reached
    // them as a hard `null` and `opts.at` threw the session away. See
    // `ui/pauseDoor.js`'s `pauseOpts` for the whole of it.
    case 'Escape': return ctx.togglePause ? (ctx.togglePause({ setPlayerPos }), true) : false;
    case 'CharacterSheet': ctx.toggleCharSheet(); return true;
    case 'Inventory': ctx.toggleInventory(); return true;
    // GameManager.cs:550-553 - the CastSpell ACTION opens the
    // spellbook window; the cast itself is the attack click.
    case 'CastSpell': ctx.toggleSpellbook(); return true;
    // FIX-F: EntityEffectManager.cs:257-270 - Q readies the last spell
    // cast (the spellbook in the pack, no animation playing), E drops
    // the readied one. Both were bound, offered in the controls window,
    // and read by nothing.
    case 'RecastSpell': return ctx.recastSpell ? (ctx.recastSpell(), true) : false;
    case 'AbortSpell': return ctx.abortSpell ? (ctx.abortSpell(), true) : false;
    // KB1: an arm whose host has no door ANSWERS FALSE - `true` told the host the key was spent, so it swallowed a
    // key that did nothing (and preventDefaulted it) instead of leaving it to the next ladder or the browser.
    case 'Rest': return ctx.toggleRest ? (ctx.toggleRest(), true) : false;
    // U43: the two journal doors. GameManager's chain has had both
    // since the quest machine landed (:541-548) and the bindings have
    // been in the table since I1 - L and N - with NOTHING in src/
    // reading either, while ui/questJournal.js sat fully built with
    // all four of its pages. They are ONE window: LogBook pushes it as
    // it stands, NoteBook sets DisplayMode = Notebook first
    // (DaggerfallUI.cs:704-711).
    case 'LogBook': return ctx.toggleLogbook ? (ctx.toggleLogbook(), true) : false;
    case 'NoteBook': return ctx.toggleNotebook ? (ctx.toggleNotebook(), true) : false;
    case 'AutoMap': return ctx.toggleAutomap ? (ctx.toggleAutomap(), true) : false;   // A1; ROAD-C c2/S9 gave the INTERIOR ctx one too
    case 'QuickSave': return ctx.quickSave ? (ctx.quickSave(), true) : false;
    case 'QuickLoad': return ctx.quickLoad ? (ctx.quickLoad(setPlayerPos), true) : false;
    case 'DebugOverlay': return ctx.toggleDebugHud ? (ctx.toggleDebugHud(), true) : false;   // KB1: the dungeon's readout, off its own action
    case 'PrintScreen': return printScreen();   // KB1 + AUDIT KB1: the key's own door (ui/screenshot.js), reached only with no window up
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
    // SOC5 (2026-09-16, Mac: "Players should be able to interact with others
    // in the world upon encountering them by pressing F on their body, which
    // should show options to add as a friend or invite to a party"): the port's
    // own action (systems/inputActions.js appends it past DFU's forty-four),
    // routed like every other - so F is rebindable and the door is a ctx arm
    // rather than a key literal in a host's ladder.
    //
    // THE DOOR ANSWERS, not this table. `socialInteract()` returns FALSE when
    // the page is offline or holds no account, and that false is passed
    // through: there is nothing social to do, the ladder must fall through, and
    // the key keeps whatever meaning the rest of the host gives it. A host
    // without the door at all is the same answer one step earlier.
    case 'SocialInteract': return ctx.socialInteract?.() === true;
    // QS2 (2026-09-17, Mac: the Demon's Souls quickslot diamond on the
    // enhanced HUD): the three port actions the diamond's cells name. They are
    // EDGE actions, never polled - a held 1 drinks one potion, not one a frame
    // - so they belong in this table and not in POLLED_ACTIONS.
    //
    // The DOOR answers, as SocialInteract's does: a host that has not grown
    // one, or a classic-skin page with no diamond, is a false and the ladder
    // falls through with the key still meaning whatever else the host gives
    // it. The performer itself is systems/quickslots.js - the window's own use
    // ladder and the one equipItem - so a hotkey is not a way round the
    // window's law.
    // AUDIT CONTRIB H1: with the hotbar in force the diamond is put AWAY - none of its five actions reaches a slot
    // the player cannot see (a pad's d-pad, a key rebound onto one); the hotbar's own keys are its own reader's
    case 'QuickUse1': return !hotbarInForce() && ctx.quickUse?.(1) === true;
    case 'QuickUse2': return !hotbarInForce() && ctx.quickUse?.(2) === true;
    case 'QuickSwap': return !hotbarInForce() && ctx.quickSwap?.() === true;
    // QS4: the off-hand cell's own press - light or douse, through the mod's
    // own guard. Same door law: a host without one answers false.
    case 'QuickOffHand': return !hotbarInForce() && ctx.quickOffHand?.() === true;
    // QS6: the spell slot's press - ready the slot's spell, or put it away
    // when it is the one already in hand. The performer is the model's
    // (spellQuickslotPress) over the host's ONE cast engine, so every law
    // about readying stays where DFU's are ported.
    case 'QuickSpell': return !hotbarInForce() && ctx.quickSpell?.() === true;
    default: return false;
  }
}
