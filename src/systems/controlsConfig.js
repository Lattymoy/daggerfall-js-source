// I4 - THE CONTROLS STAGING LAW: ControlsConfigManager.cs (MIT,
// Daggerfall Workshop). The controls window edits a STAGED copy of
// both binding dicts; nothing reaches the live registry until the
// window closes on a valid configuration (SetAllKeyBindValues on
// OnPop), and Default resets through the registry's own law.
//
// A8 RETIRED THE COMBO FLAG THAT STOOD HERE. It said GetDuplicates'
// second and third phases had nothing to walk because the port had no
// key combos. It has them now (inputActions.js's comboCode pack), so
// all three phases are below and live, and this file is the whole of
// ControlsConfigManager rather than most of it.
//
// The one structural difference from C# stands: DFU's staged dicts
// hold DISPLAY STRINGS and parse them back with ParseKeyCodeString /
// GetComboCode(String); the port's hold CODES, because the port's code
// alphabet is already strings. comboString() in inputActions.js is the
// display face when one is wanted.

import {
  ACTIONS, getBinding, setBinding, addRemovedPrimaryAction, addRemovedSecondaryAction, resetDefaults,
  isCombo, getCombo, comboCode, actionLabel, actionLive, createBindings, serializeKeyBinds, loadKeyBinds,
  MOD_ACTIONS, ACTION_GROUPS, codeForAction,
} from './inputActions.js';
import { shortcutBinding, MOD } from './dialogShortcuts.js';   // UXB1-F: the keys this page names and cannot move

/** internalDupeColor / crossDupeColor (:44-45): red for a clash
 *  inside the shown dict, the blue for one across the two. */
export const INTERNAL_DUPE_COLOR = Object.freeze([1, 0, 0, 1]);
export const CROSS_DUPE_COLOR = Object.freeze([0, 0.58, 1, 1]);

/** The label cap under the classic font (:64 - the non-SDF arm) and
 *  the elongation stand-in (:56). */
export const MAX_BUTTON_TEXT = 10;
export const ELONGATED_TEXT = '...';

/** ResetUnsavedKeybinds (:270-281): both dicts, every action, from
 *  the LIVE registry. Unbound stays null (DFU stores "None"). */
export function createUnsavedKeybinds(store) {
  const primary = new Map(), secondary = new Map();
  for (const a of ACTIONS) {
    primary.set(a, getBinding(store, a, true));
    secondary.set(a, getBinding(store, a, false));
  }
  return { primary, secondary, usingPrimary: true };
}

export const currentDict = (u) => (u.usingPrimary ? u.primary : u.secondary);

/** SetUnsavedBinding (:141-144) - the staged write. */
export function setUnsavedBinding(u, action, code) {
  currentDict(u).set(action, code);
}

/**
 * GetDuplicates (:144-215), ALL THREE PHASES. A8 made the second and
 * third reachable by giving the port combos; before that the simple
 * same-code pass was the whole story.
 *
 * The first pass is DFU's OrderByDescending key selector (:152-174),
 * and its SIDE EFFECTS are the point: LINQ runs the selector once per
 * element, in source order, before the sort is enumerated, and the
 * selector records each combo's MODIFIER into `recorded` - which is
 * what makes a later independent bind on that same modifier read as a
 * duplicate. The sort then puts the combos first (stable, so equals
 * keep source order) and the simple pass walks that list.
 *
 * Unbound is DFU's KeyCode.None string, which `str != none` keeps out
 * of the dupe set; here unbound is null and skips the same way.
 */
export function getDuplicates(codes) {
  const recorded = new Set();
  const dupes = new Set();
  const modifiers = new Map();   // modifier code -> the combos it heads
  const list = [...codes];

  // the key selector's pass (:152-174), in source order
  const isComboCode = list.map((c) => {
    if (c == null || !isCombo(c)) return false;
    const [mod] = getCombo(c);
    // "Add modifier to 'recorded' so it cannot be used as an
    // independent keybind"
    if (!recorded.has(mod)) recorded.add(mod);
    if (!modifiers.has(mod)) modifiers.set(mod, new Set());
    modifiers.get(mod).add(c);
    return true;
  });
  // OrderByDescending(bool): combos first, stable within each group
  const sorted = [
    ...list.filter((_, i) => isComboCode[i]),
    ...list.filter((_, i) => !isComboCode[i]),
  ];

  // "Simple check for duplicates in the list" (:178-186)
  for (const c of sorted) {
    if (c == null) continue;
    if (!recorded.has(c)) recorded.add(c);
    else dupes.add(c);
  }

  // "Mark combos as dupes too if a modifier has been used as an
  // independent keybind" (:188-196) - Shift+T against a bare Shift.
  for (const [mod, combos] of modifiers) {
    if (dupes.has(mod)) for (const c of combos) dupes.add(c);
  }

  // "Mark combos as dupes if the combo'd key is also used as a
  // modifier" (:198-214) - Shift+T against Z+Shift.
  for (const c of sorted) {
    if (c == null || !isCombo(c)) continue;
    const [, key] = getCombo(c);
    const mods = modifiers.get(key);
    if (mods) { for (const m of mods) dupes.add(m); dupes.add(c); }
  }
  return dupes;
}

/** InternalDuplicateKeyCodesExist (:223-228). */
export const internalDuplicatesExist = (u) =>
  getDuplicates([...currentDict(u).values()]).size > 0;

/** CheckDuplicateKeyCodes (:230-267) as data: which codes clash
 *  INSIDE the shown dict (red), which clash ACROSS the two dicts
 *  (blue, never overriding red), and whether the window may close -
 *  DFU's return is `noRedDupes && crossDupes.Count == 0`: BOTH kinds
 *  block the exit. The cross check dedupes each dict first (:256-258)
 *  so an internal pair does not read as a cross clash too.
 *
 *  AUDIT SOC D3 - `yield`, THE PORT'S ONE ADDITION TO THIS LAW, and it
 *  is a WINDOW's option rather than a default. A caller passes the
 *  actions whose rows IT CANNOT DRAW (ui/controlsWindow.js and
 *  ui/mouseControlsWindow.js pass inputActions.js PORT_ACTIONS - the
 *  classic art has no rect for 'SocialInteract'); before anything is
 *  counted, any such action whose staged code clashes with a row the
 *  window CAN draw is staged null. The clash then does not exist, the
 *  exit is not blocked, and the yielded action is left UNBOUND and
 *  rebindable in the window that does show it. Nothing else moves: a
 *  clash BETWEEN two yielded actions, or one a yielded action has all
 *  to itself, is left exactly where it was, and the enhanced window
 *  passes no `yield` at all and sees DFU's law byte for byte. */
export function checkDuplicates(u, { yield: yielded = [] } = {}) {
  if (yielded.length) yieldDuplicates(u, yielded);
  const internal = getDuplicates([...currentDict(u).values()]);
  const cross = getDuplicates([
    ...new Set([...u.primary.values()].filter((c) => c != null)),
    ...new Set([...u.secondary.values()].filter((c) => c != null)),
  ]);
  return { internal, cross, ok: internal.size === 0 && cross.size === 0 };
}

/** The `yield` pass: in EACH staged dict on its own, a yielded action
 *  whose code is also held by a NON-yielded action in that same dict
 *  gives the code up (staged null). Per dict, because the two dicts are
 *  a primary and a secondary and a code in one is not a clash with the
 *  other - the cross check has its own reading of that, and it is the
 *  same codes it would have seen. */
function yieldDuplicates(u, yielded) {
  const give = new Set(yielded);
  for (const dict of [u.primary, u.secondary]) {
    const kept = new Set();
    for (const [action, code] of dict) if (code != null && !give.has(action)) kept.add(code);
    for (const action of give) {
      const code = dict.get(action);
      if (code != null && kept.has(code)) dict.set(action, null);
    }
  }
}

/** SetAllKeyBindValues (:284-288) + SetKeyBindValues (:541-559): the
 *  apply, both dicts, rebinding ONLY where the staged code differs
 *  from the live one - and an emptied PRIMARY slot is marked removed
 *  so the autofill pass cannot quietly restore its default.
 *
 *  THE CONTRACT, which is DFU's and not a port shortcut: this runs
 *  only on a DUPLICATE-FREE set. SetBinding steals a code from
 *  whoever holds it, so applying a set where two actions share one
 *  code is ORDER-DEPENDENT - the later action wins and the earlier
 *  ends up unbound. DFU never reaches that state because the window
 *  refuses to close while checkDuplicates reports either kind of
 *  clash (AllowCancel false), which is exactly why that gate blocks
 *  the exit rather than merely colouring the labels. Callers that
 *  bypass the window must run checkDuplicates themselves.
 *
 *  AUDIT KB1 F4: "differs from the live one" is read off the store AS IT
 *  STOOD BEFORE THE APPLY, not as the walk has left it. A code that
 *  MOVES - the replace prompt's Yes: the holder staged null, the key
 *  staged on the new action - is a duplicate-free set, and still the
 *  walk's order decided it: when the new action came first, its
 *  setBinding took the code off the holder, the holder's row then read
 *  live null = staged null, and it was never marked removed - so the
 *  next boot's autofill put its default back. KB1 appended every port
 *  and mod action to the END of ACTIONS, which made that the usual
 *  case. DFU's SetKeyBindValues (:541-559) walks the same way and
 *  has the same hole; the port's window meant "stays unbound". */
export function applyUnsavedKeybinds(store, u) {
  const before = new Map();
  for (const primary of [true, false]) {
    for (const action of (primary ? u.primary : u.secondary).keys()) before.set(`${primary}:${action}`, getBinding(store, action, primary));
  }
  for (const primary of [true, false]) {
    const dict = primary ? u.primary : u.secondary;
    for (const [action, code] of dict) {
      const cur = before.get(`${primary}:${action}`);
      if (cur !== code) {
        if (primary && code == null) addRemovedPrimaryAction(store, action);
        if (!primary && code == null) addRemovedSecondaryAction(store, action);   // PAD1: a cleared pad row stays cleared
        setBinding(store, code ?? null, action, primary);
      }
    }
  }
}

/** SetDefaults (:229-238 in the window): the registry's own reset,
 *  then a fresh staging copy. */
export function resetUnsavedToDefaults(store, u) {
  resetDefaults(store);
  const fresh = createUnsavedKeybinds(store);
  u.primary = fresh.primary;
  u.secondary = fresh.secondary;
}

/** KB1: DEFAULTS, STAGED. The enhanced pane says "Nothing is saved until you press Continue", and its Defaults
 *  reset the LIVE registry and saved it on the spot - DFU's window does (SetDefaults, :229-238), the pane's own
 *  sentence did not. This is the reset run on a COPY of the live store (so the secondary dict's keep-what-you-chose
 *  law reads the player's own pad rows), staged; the pane commits it with the live reset on Continue. */
export function stagedDefaults(store) {
  const copy = createBindings();
  loadKeyBinds(copy, serializeKeyBinds(store));
  resetDefaults(copy);
  return createUnsavedKeybinds(copy);
}

// GetButtonText's classic table (:322-410, the non-SDF arm - the
// port draws the classic font), translated to the port's e.code
// alphabet key for key. What the table does not name falls to
// FormatButtonText (:561-568): camel case split by spaces, and past
// ten characters the '...' stand-in.
const CLASSIC_NAMES = Object.freeze({
  AltLeft: 'LALT', AltRight: 'RALT',
  ControlLeft: 'LCTRL', ControlRight: 'RCTRL',
  ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT',
  PageUp: 'PG UP', PageDown: 'PG DN',
  Insert: 'INS', Delete: 'DEL',
  Backspace: 'BCKSPC', CapsLock: 'CAPS',
  Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
});

/** SWING-LABEL (2026-09-22, Mac: "why some players arent able to
 *  attack and ensure this isnt an issue with keybindings"): THE THREE
 *  MOUSE BUTTONS BY WHAT THEY ARE, NOT BY UNITY'S NUMBER.
 *
 *  DFU names a button by its KeyCode - Mouse0, Mouse1, Mouse2 - and
 *  Unity counts left, RIGHT, middle. So both controls windows told
 *  every player that Swing Weapon is "MOUSE1" and Auto Run is
 *  "MOUSE2". Everywhere else a player has met those words - nearly
 *  every PC game's keybind screen - MOUSE1 is the LEFT button and
 *  MOUSE2 the right. The screen was accurate in Unity's terms and
 *  read backwards in everyone else's: it said "attack is left click",
 *  players left-clicked, and the left button is Activate, which does
 *  nothing with nothing in front of it. That is the "can't attack"
 *  report, and it is the screen Mac read too.
 *
 *  The CODES do not move - the store, the saved files, the swing's
 *  own routing (ui/input.js MOUSE_CODES) and every pin read 'Mouse1'
 *  exactly as before. Only the words a player reads change. The short
 *  form fits DFU's ten-character cap (MAX_BUTTON_TEXT); the full form
 *  is what the enhanced pane and the tooltips show. */
const MOUSE_NAMES = Object.freeze({
  Mouse0: ['L CLICK', 'LEFT CLICK'],
  Mouse1: ['R CLICK', 'RIGHT CLICK'],
  Mouse2: ['M CLICK', 'MIDDLE CLICK'],
});

/** SWING-LABEL: ...and the one row where the button alone is not the
 *  whole answer. In the default swing style (Gesture, 0) a CLICK does
 *  nothing - WeaponManager tracks the drag, and a press with no travel
 *  is no swing - and a sheathed weapon swings at nothing either. The
 *  enhanced pane puts this line under Swing Weapon, in the player's
 *  own live bindings, so the screen that says which button also says
 *  how. `mode` is Controls/WeaponSwingMode; `readyCode` is the live
 *  ReadyWeapon code (null when unbound). */
export function swingHint(code, mode, readyCode) {
  if (code == null) return 'Unbound - nothing can swing your weapon.';
  const side = { Mouse0: 'left', Mouse1: 'right', Mouse2: 'middle' }[code];
  const btn = side ? `the ${side} mouse button` : buttonText(code, true);
  const how = mode === 1 ? `Press ${btn} to swing.`
    : mode === 2 ? `Press or hold ${btn} to swing.`
      : `Hold ${btn} and move the mouse to swing - the way you move picks the blow. A press without moving does nothing.`;
  return readyCode == null ? how : `${how} Draw your weapon first with ${buttonText(readyCode, true)} (Ready Weapon).`;
}

/** UXB1-D (2026-09-25, the UX backlog: "Is there a reason you cannot have multiple keys bound to the same action
 *  such as jump+swim-up?"): THE TWO ROWS WHOSE KEY IS NOT THE ONLY ONE THAT MOVES YOU. LevitateMotor.Update rises on
 *  Jump OR FloatUp and sinks on Crouch OR FloatDown (LevitateMotor.cs:86-89), and every host passes the pair
 *  (`up: jumpHeld || held(keys, 'FloatUp')`) - so the swim-up a player wanted Space for is already Space's. One key,
 *  one action (Controls.md law 3) is why Space cannot be bound to both; this line is why it never needs to be. Null
 *  for every other row, and when the partner action is unbound. `dict` is the shown set. */
const FLOAT_PARTNERS = Object.freeze({
  FloatUp: Object.freeze({ partner: 'Jump', name: 'Jump', verb: 'rises' }),
  FloatDown: Object.freeze({ partner: 'Crouch', name: 'Crouch', verb: 'sinks' }),
});
export function floatHint(action, dict) {
  const f = FLOAT_PARTNERS[action];
  const code = f ? dict?.get(f.partner) : null;
  if (code == null) return null;
  return `${f.name} (${buttonText(code, true)}) ${f.verb} too while you swim or levitate.`;
}

/** UXB1-D: ...and the replace prompt's answer for that pair. Binding Jump's key onto Float up (Crouch's onto Float
 *  down) asks like any held key, but the honest answer is "you need neither": the key already does both. Every holder
 *  must be the partner - a key someone else also holds is an ordinary clash - and the line names the key. */
export function sharedFloatNote(action, holders, usingPrimary = true) {
  const f = FLOAT_PARTNERS[action];
  if (!f || !holders?.length || !holders.every((h) => h.action === f.partner)) return null;
  return `${f.name} already ${f.verb} while you swim or levitate, so the key does both as it is: answer No to keep it on ${f.name}${usingPrimary ? '' : ' (secondary)'}.`;
}

/** GetButtonText + FormatButtonText. `full` skips the length cap
 *  (the tooltip/full-string arm). */
export function buttonText(code, full = false) {
  if (code == null) return 'NONE';   // KeyCode.None.ToString(), through the classic-font ToUpper tail (NT3 F082)
  // A8: the COMBO arm (:509-513). Each half goes through GetButtonText
  // ITSELF, at its DEFAULT fullString - so a combo reads in the classic
  // names, "LSHIFT + T" - and only the JOINED string meets
  // FormatButtonText, whose ten-character cap most combos overrun into
  // the '...' the tooltip stands behind.
  if (isCombo(code)) {
    const [mod, key] = getCombo(code);
    return formatButtonText(`${buttonText(mod)} + ${buttonText(key)}`, full);
  }
  if (CLASSIC_NAMES[code]) return CLASSIC_NAMES[code];
  if (MOUSE_NAMES[code]) return MOUSE_NAMES[code][full ? 1 : 0];   // SWING-LABEL: never "MOUSE1"
  let t = code;
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) t = `A${digit[1]}`;                   // Alpha0..Alpha9 -> A0..A9
  const pad = /^Numpad(\w+)$/.exec(code);
  if (pad) t = `KPAD${pad[1]}`;                    // Keypad0.. -> KPAD0..
  else if (/^Key([A-Z])$/.test(code)) t = code.slice(3);   // KeyW -> W
  // NT3 (F082): the arrows fall past the classic table to the friendly
  // switch, which names them "Left"/"Right"/"Up"/"Down" (:468-479) -
  // not "Left Arrow" - and the classic-font tail UPPERCASES everything
  // (`SDFFontRendering ? text : text.ToUpper()`, :521; the port draws
  // the classic font, so the non-SDF arm is its law). ENTER, SPACE,
  // LEFT - as the DOS-inspired window shows them.
  else if (/^Arrow(\w+)$/.test(code)) t = code.slice(5);
  return formatButtonText(t, full);
}

/** FormatButtonText (:561-568) plus the classic-font ToUpper tail
 *  (:521), which is where both arms of GetButtonText land. */
function formatButtonText(text, full) {
  if (text.length <= MAX_BUTTON_TEXT || full) {
    return text.replace(/([a-z])([A-Z])/g, '$1 $2').trim().toUpperCase();   // no lookbehind - see splitCamel below
  }
  return ELONGATED_TEXT;
}

// ── the two helpers both rebinding windows need (ROAD-G G6) ─────────
//
// They were private to ui/controlsWindow.js until the ADVANCED tab's
// destination - ui/mouseControlsWindow.js, the other window that
// captures keys and prompts to remove them - needed the same two. The
// grid imports the WINDOW, so the shared halves cannot live in the
// grid without a cycle, and PromptRemoveKeybindMessage is
// ControlsConfigManager's own method anyway (:290-320).

/** The three virtual modifiers a KeyboardEvent reports, each mapped to
 *  the LEFT physical key. The modifier keys themselves are excluded:
 *  pressing Shift alone must bind Shift, not a Shift+Shift combo. DFU
 *  takes TWO key-downs and lets ANY key be the modifier
 *  (DaggerfallControlsWindow.WaitForKeyPress :380-424); a browser
 *  KeyboardEvent reports three flags and no side, so this door offers
 *  the LEFT side of the three - which is what every DFU default binds.
 *  The storage, the duplicate law and the runtime read take any pair. */
const EVENT_MODIFIERS = Object.freeze([
  ['ctrlKey', 'ControlLeft', ['ControlLeft', 'ControlRight']],
  ['shiftKey', 'ShiftLeft', ['ShiftLeft', 'ShiftRight']],
  ['altKey', 'AltLeft', ['AltLeft', 'AltRight']],
]);
export function comboFromEvent(code, e) {
  if (!e) return null;
  for (const [flag, mod, own] of EVENT_MODIFIERS) {
    if (e[flag] && !own.includes(code)) return comboCode(mod, code);
  }
  return null;
}

/** The remove prompt's action face (:302): camel case split.
 *
 *  NO LOOKBEHIND. This was DFU's own split, a lookbehind for a lower
 *  letter before an upper - and a regex lookbehind is a PARSE error in Safari before 16.4
 *  (macOS 12 and older, iOS 16.3 and older): not a wrong answer, a
 *  module that will not load. This file sits in the chunk the menu and
 *  the world both import, so those players got no game at all. The
 *  captured pair says the same thing - a space between a lower and the
 *  upper after it - and test/nolookbehind.test.js holds the whole tree
 *  to it. */
export const splitCamel = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').trim();

/** PromptRemoveKeybindMessage's text (:298-302): the "removeKeybind"
 *  record formatted with the camel-split action name and the FULL
 *  button text of the code being removed. */
export function removeKeybindPromptRows(action, code) {
  return [
    'Are you sure you want to remove the keybind',
    `for ${splitCamel(action)} ('${buttonText(code, true)}')?`,
  ];
}

/**
 * KB1 (the standard's law 4): A KEY SOMEONE ELSE HOLDS IS ASKED FOR, NOT TAKEN. A bind onto a code another action
 * already holds answered with a red clash (the enhanced pane) or - in the two classic windows, whose `yield` pass
 * gave a port row's key up to any grid bind - with a port action silently left unbound. Every window now stops at
 * the capture and asks; Yes stages the holder unbound and the bind, No stages nothing.
 * `bindingHolders` is the question: who else holds `code` - another action in the SHOWN dict, or anyone (this
 * action's own other slot included) in the other dict, which DFU's cross check counts as a clash too (:241-262).
 * Answers every `{ action, primary }` that holds it, [] when the key is free.
 *
 * AUDIT KB1 F5: "holds it" is getDuplicates' OWN relation, not code equality - the prompt and the red clash are one
 * law. A combo whose modifier another action holds bare (Shift+T against a bare Shift), and a bare key that heads
 * someone's combo, clash in DFU's check (:188-214); read as `===`, they got no prompt and the red clash came back,
 * and in the classic windows a Continue blocked by a row the art could not draw. Several can hold one bare modifier
 * through their combos, so the answer is a list and Yes stages every one of them unbound.
 */
const clashes = (a, b) => a != null && b != null && getDuplicates([a, b]).size > 0;
export function bindingHolders(u, action, code) {
  if (code == null) return [];
  const out = [];
  for (const [a, c] of currentDict(u)) if (a !== action && clashes(code, c)) out.push({ action: a, primary: u.usingPrimary });
  const other = u.usingPrimary ? u.secondary : u.primary;
  for (const [a, c] of other) if (clashes(code, c)) out.push({ action: a, primary: !u.usingPrimary });
  return out;
}

/** The prompt's two lines, in the player's words (inputActions.js actionLabel names a mod's key with its mod).
 *  AUDIT KB1 F6: the action's OWN other slot is not "used by" someone else - it is the key moving slots. */
export function replaceKeybindPromptRows(action, code, holders, usingPrimary = true) {
  const key = buttonText(code, true);
  if (holders.length === 1 && holders[0].action === action) {
    return [
      `${key} is already ${actionLabel(action)}'s ${holders[0].primary ? 'primary' : 'secondary'} key.`,
      `Make it the ${usingPrimary ? 'primary' : 'secondary'} key instead?`,
    ];
  }
  const who = holders.map((h) => `${actionLabel(h.action)}${h.primary ? '' : ' (secondary)'}`).join(' and ');
  return [
    `${key} is used by ${who}.`,
    `Give it to ${actionLabel(action)} instead?`,
  ];
}

/** Yes: every holder is staged unbound in the dict it holds the key in, and the bind lands in the shown one. */
export function stageReplace(u, action, code, holders) {
  for (const h of holders) (h.primary ? u.primary : u.secondary).set(h.action, null);
  currentDict(u).set(action, code);
}

/**
 * UXB1-F (2026-09-25, the UX backlog: "Show keybinds for game features, even if they cannot be changed there (Drop
 * torch/summon horse/summon cart)"): THE KEYS THE CONTROLS PAGE CANNOT MOVE, NAMED ON IT ANYWAY.
 *
 * Two kinds reach a player in play and stood on no screen at all. The HUD's own three - DaggerfallHUD.Update's
 * LargeHUDToggle and HUDToggle arms and RetroRenderer's post-processing toggle (ui/hudShortcuts.js), which DFU reads
 * off its DaggerfallShortcut table and gives no rebinding screen either. And the Transport window's letters: in the
 * game itself (no mod) a horse or a cart is not summoned by a key of its own, it is chosen in that window - Transport,
 * then H or C. Both are read OFF the shortcut table (systems/dialogShortcuts.js shortcutBinding), so the page names
 * the key the game answers, never a copy of it.
 */
export const FIXED_KEY_ROWS = Object.freeze([
  Object.freeze({ button: 'LargeHUDToggle', label: 'Large HUD on or off' }),
  Object.freeze({ button: 'HUDToggle', label: 'Hide or show the HUD' }),
  Object.freeze({ button: 'ToggleRetroPP', label: 'Retro Mode\u2019s post-processing on or off' }),
]);
export const TRANSPORT_KEY_ROWS = Object.freeze([
  Object.freeze({ button: 'TransportFoot', label: 'Transport: go on foot' }),
  Object.freeze({ button: 'TransportHorse', label: 'Transport: ride your horse' }),
  Object.freeze({ button: 'TransportCart', label: 'Transport: drive your cart' }),
  Object.freeze({ button: 'TransportShip', label: 'Transport: sail your ship' }),
]);

/** A DaggerfallShortcut's key in this page's own words: buttonText's names, a modifier joined the way a combo is
 *  ("SHIFT + F10"). HotkeySequence.ToString (:96-128) orders Ctrl, Alt, Shift; so does this. */
export function shortcutKeyText(button) {
  const seq = shortcutBinding(button);
  if (!seq?.code) return buttonText(null);
  const mods = [];
  if (seq.modifiers & (MOD.Ctrl | MOD.LeftCtrl | MOD.RightCtrl)) mods.push('CTRL');
  if (seq.modifiers & (MOD.Alt | MOD.LeftAlt | MOD.RightAlt)) mods.push('ALT');
  if (seq.modifiers & (MOD.Shift | MOD.LeftShift | MOD.RightShift)) mods.push('SHIFT');
  return [...mods, buttonText(seq.code, true)].join(' + ');
}

/** The rows the page draws for them: the HUD's three as they are, and each Transport letter behind the key that opens
 *  that window ("T, then H") - the whole gesture, since the letter alone does nothing. `transport` is the Transport
 *  action's code wherever the caller reads it (the registry's codeForAction, or a staged set's own dict). */
export function fixedKeyRows(transport) {
  const opener = transport == null ? 'Transport (unbound)' : buttonText(transport, true);
  return [
    ...FIXED_KEY_ROWS.map((r) => ({ label: r.label, key: shortcutKeyText(r.button) })),
    ...TRANSPORT_KEY_ROWS.map((r) => ({ label: r.label, key: `${opener}, then ${shortcutKeyText(r.button)}` })),
  ];
}

/** UXB1-F: a vendored mod's keys, named for its Features tile - read-only there, because they are BOUND in Controls
 *  (KB1: one registry, where a clash can be seen). Each row is the action's own label on the Controls page, and the
 *  key that answers it now (codeForAction: the primary, else the secondary - the order actionForCode resolves in). */
export function modKeyRows(vendor, store) {
  const labels = new Map(ACTION_GROUPS.flatMap((g) => g.rows.map((r) => [r.action, r.label])));
  return (MOD_ACTIONS[vendor] ?? []).map(({ action }) => {
    const code = codeForAction(store, action);
    return { action, label: labels.get(action) ?? actionLabel(action), key: buttonText(code, true) };
  });
}

/**
 * AUDIT KB1 F3: THE CARRY'S REPORT, in the player's words - one HUD line per action the one-time carry of a v1
 * keybinding file (inputActions.js migrateKeyBinds) could not keep on its key. A mod's line only while its mod is
 * on: a key for a mod the player does not run is nothing to be told about at the door.
 */
export function keybindCarryNotes(report, live = actionLive) {
  const out = [];
  const holderText = (h) => (h ? actionLabel(h) : 'another key');
  for (const l of report?.lost ?? []) {
    if (!live(l.action)) continue;
    out.push(`${actionLabel(l.action)} has no key: ${buttonText(l.code, true)} is ${holderText(l.holder)}'s. Set one in Controls.`);
  }
  for (const k of report?.kept ?? []) {
    if (!live(k.action)) continue;
    out.push(`${actionLabel(k.action)} stays on its new key: ${buttonText(k.code, true)} is ${holderText(k.holder)}'s. Change it in Controls.`);
  }
  return out;
}
