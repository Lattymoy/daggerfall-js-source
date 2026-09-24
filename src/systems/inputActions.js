// I1 - the input registry: InputManager.cs's binding law, without the
// engine half (mouse smoothing, axes, joystick, combos - see the flags
// at the bottom). This is the LAW module; ui/input.js and the hosts
// consume it (I2), and the settings window's controls section (I3)
// edits through it.
//
// Keys are browser `KeyboardEvent.code` strings ('KeyW', 'F5',
// 'ShiftLeft'), plus 'Mouse0'/'Mouse1'/'Mouse2' for the three buttons
// exactly as Unity's KeyCode names them (left/right/middle). DFU
// serializes KeyCode NAMES into KeyBindings.txt, so the port's stored
// shape is the same idea one alphabet over.
//
// SOC5 (2026-09-16, Mac: "Players should be able to interact with others in
// the world upon encountering them by pressing F on their body, which should
// show options to add as a friend or invite to a party"): THE ONE ACTION IN
// THIS LIST DFU DOES NOT HAVE. 'SocialInteract' is appended past DFU's
// forty-four, on KeyF, which SetupDefaults leaves free. It is the port's own
// because the thing it does is the port's own - Daggerfall Unity has no other
// players to stand in front of, no friends and no parties - so it is a
// Ledger A row (ONLINE), not a parity claim.
//
// QS2 (2026-09-17): and three more beside it - 'QuickUse1', 'QuickUse2' and
// 'QuickSwap', the enhanced HUD's quickslot diamond (systems/quickslots.js).
// Same class, same reason: DFU's HUD carries no item slots, so these are the
// port's own rows and not a parity claim either.
//
// They are APPENDED and never inserted: the
// classic controls window indexes this list by NUMBER (ui/controlsWindow.js
// KEY_GROUPS, DFU's SetupKeybindButtons [2..40) against fixed pixel anchors on
// CNFG00I0.IMG), so a name spliced into the middle would silently re-label
// thirty-eight buttons in a window whose art cannot move. Past the end,
// every existing index still means what it meant.

import { appStorage } from './appStorage.js';   // DA1: the storage seam
import { storedModSetting, modSetting } from './modSettings.js';   // KB1: a player's own mod key, carried into the registry once; and whether its mod is on
import { domCodeForKeyCode, KEYCODE_NONE } from './keyCodes.js';   // KB1: the mods' TextKeys are Unity KeyCode names

/** InputManager.Actions (:324-384), names and ORDER verbatim.
 *  'Unknown' (:383) is the parse sentinel, not a bindable action -
 *  parseActionName answers it, the list does not carry it. */
import { AXIS_ACTIONS, JOYSTICK_UI_ACTIONS, DEFAULT_AXIS_BINDINGS, DEFAULT_JOYSTICK_UI, axisOfKey, parseAxisKeyName } from './gamepad.js';   // GP1: the joystick dicts' vocabulary

export const ACTIONS = Object.freeze([
  'Escape', 'ToggleConsole',
  'MoveForwards', 'MoveBackwards', 'TurnLeft', 'MoveLeft', 'TurnRight', 'MoveRight',
  'FloatUp', 'FloatDown', 'Jump', 'Crouch', 'Slide', 'Run',
  'Rest', 'Transport', 'StealMode', 'GrabMode', 'InfoMode', 'TalkMode',
  'CastSpell', 'RecastSpell', 'AbortSpell', 'UseMagicItem',
  'ReadyWeapon', 'SwingWeapon', 'SwitchHand',
  'Status', 'CharacterSheet', 'Inventory',
  'ActivateCenterObject', 'ActivateCursor',
  'LookUp', 'LookDown', 'CenterView', 'Sneak',
  'LogBook', 'NoteBook', 'AutoMap', 'TravelMap',
  'QuickSave', 'QuickLoad',
  'PrintScreen',
  'AutoRun',
  // SOC5: the port's own, past DFU's last row - see the header. The F-menu on
  // another player's body, and the friends/party panel when nobody is in reach.
  'SocialInteract',
  // QS2 (2026-09-17, Mac: the Demon's Souls quickslot diamond on the enhanced
  // HUD): three more of the port's own, appended for the same reason
  // 'SocialInteract' was - Daggerfall has no item slots on its HUD at all, so
  // these are Ledger A rows, not parity claims. The two consumable presses and
  // the weapon swap the diamond's cells name (systems/quickslots.js).
  'QuickUse1', 'QuickUse2', 'QuickSwap',
  // QS4 (2026-09-17, Mac: "The 4th quickslot doesnt have a keybind"): the
  // diamond's OFF-HAND cell, which had none - it spoke only through Handheld
  // Torches' own mod key, which the enhanced pane cannot rebind and no pad can
  // carry. Appended, like the three above and for the same reason.
  'QuickOffHand',
  // QS6 (2026-09-17, Mac: "for slot 3, I want to change it to be for spells.
  // So you should be able to hold the keybind to switch between applicable
  // spells, and then press the keybind to equip"): the diamond's SPELL slot.
  // Appended, like the four above; 'QuickSwap' keeps its row and its place -
  // an action is never removed from this list, and the swap is still
  // rebindable - it only gives up the DEFAULT key, which the cell it is drawn
  // in (the off hand's) already carries.
  'QuickSpell',
  // QUICK-LOOT B4: the plaque's two keys. APPENDED, like every port
  // action before them, because an action is never removed from this
  // list and its position is what a saved binding file resolves by.
  //
  // The third key quick loot needs is not here on purpose:
  // ActivateCenterObject already exists, is UNLOSEABLE, and is what
  // takes the highlighted row. Minting a second "activate, but for
  // loot" would be two bindings for one press and the first thing a
  // player would rebind into a clash.
  'QuickLootAll',
  'QuickLootOpen',
  // FREEMOUSE (2026-09-22, Mac: "an entirely new keybind. A mouse free
  // that allows you to toggle the use of your mouse"). APPENDED, like
  // every port action before it.
  //
  // THE TOGGLE ITSELF IS NOT NEW - `ActivateCursor` is DFU's own
  // (PlayerMouseLook.cs:190-198) and the port has read it since U45.
  // `FreeMouse` is the port's dedicated mouse-only row; CHAT-POLISH1
  // later gives chat its own Y action, so FreeMouse's default moves to F7.
  // Both mouse actions still OR at the one reader (player/pointerLock.js),
  // so there is only one cursor state to keep in step.
  'FreeMouse',
  // KB1 (2026-09-23, Mac: "We have a lot of mods, a lot of keybinds. I really want to formalize a solid solution"):
  // EVERY KEY THAT DOES SOMETHING IN THE WORLD IS AN ACTION HERE. Appended, like every port action before them.
  //  - 'Interact': the E activate, a raw `KeyE` read in four hosts beside DFU's E-AbortSpell - one press did both.
  //  - 'QuickDial': the pixel dial, a raw `Tab` read in three places.
  //  - 'Hotbar5'..'Hotbar10': the hotbar's slots past the diamond's four (slots 1-4 ARE QuickUse1, QuickUse2,
  //    QuickSpell and QuickOffHand - the same keys, which press the hotbar's first four while it is in force).
  //  - the vendored mods' hotkeys, which each mod read off its own TextKey where the controls pane could not see them:
  //    Handheld Torches' three, Eye Of The Beholder's two, Travel Options' follow key, Horse Cart and Cargo's two.
  //  - 'DebugOverlay': the dungeon's diagnostics readout, a raw `F8` read that answered only while F8 was UNBOUND -
  //    and DFU binds F8 to PrintScreen, so it never answered for anyone who had not unbound the screenshot. It ships
  //    unbound: a developer's key, bound in Controls by whoever wants it.
  'Interact', 'QuickDial',
  'Hotbar5', 'Hotbar6', 'Hotbar7', 'Hotbar8', 'Hotbar9', 'Hotbar10',
  'TorchToggleLight', 'TorchDrop', 'TorchThrow',
  'ShoulderSwitch', 'AutoPerspective',
  'FollowPaths',
  'HorseMount', 'HorseSummon',
  'DebugOverlay',
]);

/** AUDIT SOC D3: THE PORT'S OWN ROWS, NAMED SO THE CLASSIC WINDOWS CAN YIELD THEM.
 *  The classic controls window stages ALL of ACTIONS and runs the duplicate check over the whole staged dict - but
 *  its grid is DFU's Actions[2..40) on fixed art and its ADVANCED popup is DFU's six, so 'SocialInteract' is in the
 *  check and on NEITHER window's face. A classic player who bound a grid action to F was told of a clash against a
 *  row they could not see, could not clear, and could not close the window past. So the port's own actions YIELD
 *  there: systems/controlsConfig.js checkDuplicates takes `{ yield: PORT_ACTIONS }` from the two classic windows
 *  and unbinds the port's row rather than colouring a clash nobody can resolve. The ENHANCED window passes nothing,
 *  because it draws the row (ui/enhancedControls.js over ACTION_GROUPS, the 'Online' group) and can rebind it.
 *  QS2: the three quickslot actions join it for the same reason, off the same face - the enhanced pane draws them
 *  under their own 'Quickslots' heading and the classic windows cannot draw them at all. */
export const PORT_ACTIONS = Object.freeze(['SocialInteract', 'QuickUse1', 'QuickUse2', 'QuickSwap', 'QuickOffHand', 'QuickSpell', 'QuickLootAll', 'QuickLootOpen', 'FreeMouse',
  'Interact', 'QuickDial', 'Hotbar5', 'Hotbar6', 'Hotbar7', 'Hotbar8', 'Hotbar9', 'Hotbar10',
  'TorchToggleLight', 'TorchDrop', 'TorchThrow', 'ShoulderSwitch', 'AutoPerspective', 'FollowPaths', 'HorseMount', 'HorseSummon', 'DebugOverlay']);   // KB1   // QUICK-LOOT B4: the plaque's two, drawn in the enhanced pane under their own heading - the classic windows cannot draw them at all

const ACTION_SET = new Set(ACTIONS);

/** ActionNameToEnum: an unrecognized name parses to Unknown, never
 *  throws - that is what lets a newer build's saved file load. */
export const parseActionName = (name) => (ACTION_SET.has(name) ? name : 'Unknown');

/** ResetDefaults (:979-1032), row for row in DFU's calling order,
 *  KeyCode translated to the browser code for the same physical key.
 *  Unity Mouse0/1/2 = left/right/middle. */
export const DEFAULT_BINDINGS = Object.freeze([
  ['Escape', 'Escape'],
  ['KeyW', 'MoveForwards'],
  ['KeyS', 'MoveBackwards'],
  ['KeyA', 'MoveLeft'],
  ['KeyD', 'MoveRight'],
  ['ArrowLeft', 'TurnLeft'],
  ['ArrowRight', 'TurnRight'],
  ['PageUp', 'FloatUp'],
  ['PageDown', 'FloatDown'],
  ['Space', 'Jump'],
  ['KeyC', 'Crouch'],
  ['ShiftLeft', 'Run'],
  ['Mouse2', 'AutoRun'],
  ['KeyR', 'Rest'],
  ['KeyT', 'Transport'],
  ['F1', 'StealMode'],
  ['F2', 'GrabMode'],
  ['F3', 'InfoMode'],
  ['F4', 'TalkMode'],
  ['Backspace', 'CastSpell'],
  ['KeyQ', 'RecastSpell'],
  ['Backquote', 'AbortSpell'],   // KB1: E is Interact's (Mac's call); the console key DFU spent on a console this port has not
  ['KeyU', 'UseMagicItem'],
  ['KeyZ', 'ReadyWeapon'],
  ['Mouse1', 'SwingWeapon'],
  ['KeyH', 'SwitchHand'],
  ['KeyI', 'Status'],
  ['F5', 'CharacterSheet'],
  ['F6', 'Inventory'],
  ['Mouse0', 'ActivateCenterObject'],
  ['Enter', 'ActivateCursor'],
  ['Insert', 'LookUp'],
  ['Delete', 'LookDown'],
  ['Home', 'CenterView'],
  ['AltLeft', 'Sneak'],
  ['KeyL', 'LogBook'],
  ['KeyN', 'NoteBook'],
  ['KeyM', 'AutoMap'],
  ['KeyV', 'TravelMap'],
  ['F8', 'PrintScreen'],
  ['F9', 'QuickSave'],
  ['F11', 'QuickLoad'],
  // SOC5 (Mac: "by pressing F on their body"): the port's own row, past DFU's
  // table. KeyF is the key Mac named and SetupDefaults never spends - the one
  // free letter next to the movement hand. It rides in DEFAULT_BINDINGS rather
  // than in any host, so a SAVED file from before this slice gains it without a
  // reset: loadOrCreateBindings follows every load with resetDefaults(store,
  // true), whose `testSetBinding` fills an action that is missing and touches
  // nothing a player has already bound (KeyF included, if they put something
  // there first). Rebindable like every other row - the enhanced controls
  // window's ONLINE group.
  ['KeyF', 'SocialInteract'],
  // QUICK-LOOT B4: P takes the lot, J opens the container.
  //
  // Both were chosen by ELIMINATION, and it took two rounds. The first
  // pass picked G and B off a sweep of what THIS table binds, and
  // HT4's gate caught them - G is Handheld Torches' ManualDropInput
  // and B is Eye Of The Beholder's Camera.SwitchShoulder, so either
  // would have been one press doing two things. The second pass swept
  // the vendored mods' DEFAULTS too and picked K, and the gate caught
  // that as well: Travel Options offers K as one of the CHOICES on
  // RoadsIntegration.FollowPathsKey, which a defaults-only sweep
  // cannot see. J and P are what is left over once DFU's table, the
  // port's own two (Tab, Escape), every mod's default and every mod's
  // offered choice are all spent.
  //
  // Neither is near the movement hand, and that is the honest cost of
  // a keymap this full rather than a preference: they are ACTIONS, so
  // a player who wants them under WASD moves them there.
  //
  // Both are ACTIONS rather than a literal `e.code` test in a host,
  // which is AUDIT 58's lesson: a key-literal table there made four
  // rebindable rows inert in both directions.
  ['KeyP', 'QuickLootAll'],
  ['KeyJ', 'QuickLootOpen'],
  // CHAT-POLISH1: Y is the conventional "say" key and now belongs to
  // Chat as a real remappable action. FreeMouse moves to F7 so the two
  // defaults never collide; Enter keeps DFU's ActivateCursor meaning.
  // Both remain ordinary action rows rather than literal host key tests.
  ['F7', 'FreeMouse'],
  ['KeyY', 'Chat'],
  // QS2: THE NUMBER ROW, which is the one place a Souls player's hand already
  // goes. Digit1-Digit4 are unspent by SetupDefaults, unspent by the port
  // (PX15's Tab, HT4's G, SOC5's F, HT's O and X are the whole of the port's
  // own spending) and unspent by every vendored mod's TextKey defaults - the
  // HT4 pin in test/ht1_handheldtorches.test.js walks that whole set and is
  // what makes that a fact rather than a hope. They ride here, not in a host,
  // so a bindings file written before this slice gains them on the next boot:
  // loadOrCreateBindings follows every load with resetDefaults(store, true),
  // whose testSetBinding fills a MISSING action on a FREE code and touches
  // nothing a player has already bound.
  ['Digit1', 'QuickUse1'],
  ['Digit2', 'QuickUse2'],
  // QS6: the third digit is the SPELL slot now. 'QuickSwap' keeps its row in
  // ACTIONS and stays rebindable; what it loses is this default, because the
  // cell that draws the swap is the OFF HAND's and Digit4 already presses it
  // (ui/quickslotTags.js: the key does what the cell shows). A bindings file
  // written before this slice keeps whatever the player put on Digit3 -
  // testSetBinding fills a MISSING action on a FREE code and touches nothing
  // already bound - so this moves the DEFAULT, never a player's own choice.
  ['Digit3', 'QuickSpell'],
  // QS4: the fourth cell takes the fourth digit, the last of the row this
  // slice spends and still unspent by DFU, by the port and by every vendored
  // mod's TextKey defaults.
  ['Digit4', 'QuickOffHand'],
  // KB1 - THE REST OF THE STANDARD'S DEFAULTS.
  //  - E INTERACTS (Mac, 2026-09-23: "E = Activate"). DFU spends E on AbortSpell, which moves to Backquote above.
  //  - TAB IS THE DIAL, as it has been since PX15 - an action now, so the pane sees it and a player can move it.
  //  - THE DIGITS ARE THE QUICK SLOTS' AND THE HOTBAR'S (Mac: "Digits = quickbar/hotbar"): 1-4 above, 5-0 here.
  //  - THE MODS' KEYS keep the port's shipped defaults (HT4's O/G/X, EOTB's B and NumpadAdd, Travel Options' K), and
  //    Horse Cart and Cargo moves off the digits to the comma and the period - every letter is spent, F7 is the
  //    browser's caret browsing and F10 DFU's HUD toggle (AUDIT HCC K1), and these two are free on every count.
  ['KeyE', 'Interact'],
  ['Tab', 'QuickDial'],
  ['Digit5', 'Hotbar5'],
  ['Digit6', 'Hotbar6'],
  ['Digit7', 'Hotbar7'],
  ['Digit8', 'Hotbar8'],
  ['Digit9', 'Hotbar9'],
  ['Digit0', 'Hotbar10'],
  ['KeyO', 'TorchToggleLight'],
  ['KeyG', 'TorchDrop'],
  ['KeyX', 'TorchThrow'],
  ['KeyB', 'ShoulderSwitch'],
  ['NumpadAdd', 'AutoPerspective'],
  ['KeyK', 'FollowPaths'],
  ['Comma', 'HorseMount'],
  ['Period', 'HorseSummon'],
]);

/** KB1: THE TWO DFU ACTIONS THE PORT DOES NOT HAVE - ToggleConsole (there is no console) and Slide (DFU declares it
 *  and binds Left Ctrl; nothing in DFU reads it either). They stay in ACTIONS (the list is never cut: a saved file
 *  and the classic grid resolve by position) but ship unbound and the enhanced pane does not draw them - a row that
 *  holds a key and does nothing is how a key gets spent twice. */
export const HIDDEN_ACTIONS = Object.freeze(['ToggleConsole', 'Slide']);

/** KB1: THE HOTBAR'S TEN KEYS, in slot order. Slots 1-4 are the quickslot diamond's own four actions - one key,
 *  one action: the diamond reads them while it is the quickbar, the hotbar while it is (systems/uiSkin.js
 *  hotbarInForce), never both - so a pad's d-pad, which carries those four, reaches the hotbar too. */
export const HOTBAR_SLOT_ACTIONS = Object.freeze(['QuickUse1', 'QuickUse2', 'QuickSpell', 'QuickOffHand',
  'Hotbar5', 'Hotbar6', 'Hotbar7', 'Hotbar8', 'Hotbar9', 'Hotbar10']);

/** KB1: A MOD'S KEYS ARE ITS OWN ACTIONS, answering only while that mod is on. `legacy` is the mod's old TextKey
 *  setting (modSettings.js) and every value the port ever shipped on it - a player's own choice there, anything
 *  else, is carried into the registry once (migrateKeyBinds). */
export const MOD_ACTIONS = Object.freeze({
  'handheld-torches': Object.freeze([
    Object.freeze({ action: 'TorchToggleLight', legacy: 'Handling.ToggleLightInput', shipped: Object.freeze(['O', 'F']) }),
    Object.freeze({ action: 'TorchDrop', legacy: 'Handling.ManualDropInput', shipped: Object.freeze(['G', 'Tab']) }),
    Object.freeze({ action: 'TorchThrow', legacy: 'Throwing.ThrowTorchInput', shipped: Object.freeze(['X']) }),
  ]),
  'eye-of-the-beholder': Object.freeze([
    Object.freeze({ action: 'ShoulderSwitch', legacy: 'Camera.SwitchShoulder', shipped: Object.freeze(['B', 'Tab']) }),
    Object.freeze({ action: 'AutoPerspective', legacy: 'AutoTogglePerspective.ToggleInput', shipped: Object.freeze(['KeypadPlus']) }),
  ]),
  'travel-options': Object.freeze([
    // the mod's key is a CHOICE, not a KeyCode: an index into its six (TravelOptionsMod.cs:132), and an index past
    // the end is "Custom Key Bind", read from the second setting (:224-232)
    Object.freeze({ action: 'FollowPaths', legacy: 'RoadsIntegration.FollowPathsKey', choice: 'RoadsIntegration.FollowPathsCustomKeyBind',
      options: Object.freeze(['None', 'F', 'G', 'K', 'O', 'X']), shipped: Object.freeze([3]) }),
  ]),
  'horse-cart-and-cargo': Object.freeze([
    Object.freeze({ action: 'HorseMount', legacy: 'Hotkeys.QuickMountDismount', shipped: Object.freeze(['Alpha5', 'F7', 'K']) }),
    Object.freeze({ action: 'HorseSummon', legacy: 'Hotkeys.SummonTransport', shipped: Object.freeze(['Alpha6', 'F10', 'G']) }),
  ]),
});
const _modOf = new Map(Object.entries(MOD_ACTIONS).flatMap(([vendor, rows]) => rows.map((r) => [r.action, vendor])));
/** The vendored mod an action belongs to, or null for the game's own. */
export const actionMod = (action) => _modOf.get(action) ?? null;
/** KB1: WHETHER AN ACTION ANSWERS AT ALL. The game's own always do; a mod's only while that mod is on (its `Enabled`,
 *  through modSetting, so online the room's forced value decides as it does for the mod itself). This is the ONE
 *  gate - every reader in ui/input.js takes it - so a mod switched off cannot act on its key anywhere, and no mod
 *  carries a check of its own. The key stays bound: switching the mod back on must not find it given away. */
export function actionLive(action) {
  const vendor = _modOf.get(action);
  return !vendor || !!modSetting(vendor, 'Enabled');
}

/**
 * KB1: THE CONTROLS PAGE'S ORDER - every action, in the group a player looks for it under, with the words they would
 * use. ONE table, read by the enhanced Controls pane (ui/enhancedControls.js), the replace prompt's names
 * (systems/controlsConfig.js actionLabel) and bible Controls.md; test/kb1_keybinds.test.js holds that every action
 * in ACTIONS is in exactly one group or in HIDDEN_ACTIONS. A group with `mod` is that vendored mod's keys, drawn only
 * while the mod is on (the readers' actionLive gate is the same switch).
 *
 * THE KEYS THAT ARE NOT HERE are a window's own, and they do not move: Escape and Enter in every window (the back
 * and confirm doors), the arrows and +/- on the maps, Y/N on a message box, the letters a DFU window binds through
 * its own DaggerfallShortcut table (systems/dialogShortcuts.js), the travel panel's M/C/H while it is up, the dial's
 * WASD/arrows while it is up, and the fly-cam's raw WASD (a developer mode). They answer only while their window is
 * the top one, so they share nothing with the world's keys below.
 */
const g = (title, rows, mod = null) => Object.freeze({ title, mod, rows: Object.freeze(rows.map(([action, label]) => Object.freeze({ action, label }))) });
export const ACTION_GROUPS = Object.freeze([
  g('Movement', [
    ['MoveForwards', 'Move forwards'], ['MoveBackwards', 'Move backwards'], ['MoveLeft', 'Move left'], ['MoveRight', 'Move right'],
    ['TurnLeft', 'Turn left'], ['TurnRight', 'Turn right'], ['LookUp', 'Look up'], ['LookDown', 'Look down'],
    ['CenterView', 'Centre the view'], ['Jump', 'Jump'], ['Crouch', 'Crouch'], ['Run', 'Run'], ['AutoRun', 'Auto run'],
    ['Sneak', 'Sneak'], ['FloatUp', 'Float up (levitate, swim)'], ['FloatDown', 'Float down (levitate, swim)'],
  ]),
  g('Combat', [
    ['ReadyWeapon', 'Ready or sheathe weapon'], ['SwingWeapon', 'Swing weapon'], ['SwitchHand', 'Switch hand'],
  ]),
  g('Magic', [
    ['CastSpell', 'Spellbook'], ['RecastSpell', 'Ready the last spell'], ['AbortSpell', 'Drop the readied spell'],
    ['UseMagicItem', 'Use magic item'],
  ]),
  g('Interaction', [
    ['ActivateCenterObject', 'Activate (mouse)'], ['Interact', 'Interact'],
    ['StealMode', 'Steal mode'], ['GrabMode', 'Grab mode'], ['InfoMode', 'Info mode'], ['TalkMode', 'Talk mode'],
    ['QuickLootAll', 'Take everything'], ['QuickLootOpen', 'Open the container'],
    ['Transport', 'Transport'], ['Rest', 'Rest'],
  ]),
  g('Windows', [
    ['Escape', 'Pause menu'], ['CharacterSheet', 'Character sheet'], ['Inventory', 'Inventory'], ['Status', 'Status'],
    ['LogBook', 'Quest log'], ['NoteBook', 'Notebook'], ['AutoMap', 'Map'], ['TravelMap', 'Travel map'],
    ['QuickDial', 'Quick dial'],
  ]),
  g('Quickslots and hotbar', [
    ['QuickUse1', 'Use quickslot 1 / hotbar slot 1'], ['QuickUse2', 'Use quickslot 2 / hotbar slot 2'],
    ['QuickSpell', 'Ready quickslot spell (hold to cycle the book) / hotbar slot 3'],
    ['QuickOffHand', 'Off hand: light, douse or swap / hotbar slot 4'], ['QuickSwap', 'Swap weapon'],
    ['Hotbar5', 'Hotbar slot 5'], ['Hotbar6', 'Hotbar slot 6'], ['Hotbar7', 'Hotbar slot 7'], ['Hotbar8', 'Hotbar slot 8'],
    ['Hotbar9', 'Hotbar slot 9'], ['Hotbar10', 'Hotbar slot 10'],
  ]),
  g('Mouse', [
    ['ActivateCursor', 'Free the mouse (offline) / open chat (online)'], ['FreeMouse', 'Free the mouse (press again to look)'],
  ]),
  g('Online', [
    ['SocialInteract', 'Interact with player'],
  ]),
  g('Game', [
    ['QuickSave', 'Quick save'], ['QuickLoad', 'Quick load'], ['PrintScreen', 'Screenshot'], ['DebugOverlay', 'Diagnostics readout'],
  ]),
  g('Handheld Torches', [
    ['TorchToggleLight', 'Light or douse'], ['TorchDrop', 'Drop the light'], ['TorchThrow', 'Throw a torch (hold to charge)'],
  ], 'handheld-torches'),
  g('Eye of the Beholder', [
    ['ShoulderSwitch', 'Switch shoulder'], ['AutoPerspective', 'Auto perspective on/off'],
  ], 'eye-of-the-beholder'),
  g('Travel Options', [
    ['FollowPaths', 'Follow the road'],
  ], 'travel-options'),
  g('Horse Cart and Cargo', [
    ['HorseMount', 'Mount or dismount'], ['HorseSummon', 'Summon horse and wagon'],
  ], 'horse-cart-and-cargo'),
]);
const _groupOf = new Map(ACTION_GROUPS.flatMap((grp) => grp.rows.map((r) => [r.action, grp])));
/** KB1: the words a player reads for an action - its row's label, with its mod's name after a mod's. */
export function actionLabel(action) {
  const grp = _groupOf.get(action);
  const row = grp?.rows.find((r) => r.action === action);
  if (!row) return String(action ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
  return grp.mod ? `${row.label} (${grp.title})` : row.label;
}

/**
 * PAD1 (2026-09-21, Mac: "a comprehensive pass on m/kb keybinds and
 * controller support ... including the quickbar"): THE PAD LAYOUT.
 *
 * DFU's ResetDefaults binds no action to a controller button. Out of the
 * box a pad moves and looks (the axis dict) and clicks (the joystick UI
 * dict: A left-click, Y right-click, X middle-click, B back), so it
 * activates, swings and autoruns through the mouse codes those clicks
 * stand for - and nothing else: no jump, no crouch, no menu, no
 * spellbook, no quickslot, until the player binds each one in the grid.
 * This is that binding done once, as DEFAULTS, and it is a Ledger A
 * departure (DEFAULTS ONLY - the binding law, the dicts, the grid and
 * the file are DFU's; only the rows are the port's).
 *
 * THE SECONDARY DICT, because DFU's is single-bind per dict and every
 * one of these actions already holds its keyboard key in the primary.
 * The codes are pad-only (the Unity button names the poller synthesises
 * and the axis keys it edges - ui/gamepadInput.js), so a keyboard player
 * never sees them, and they are filled by testSetBinding alone: a
 * missing action, on a free code, never marked removed (the
 * removedSecondary law) - so a file written before this slice gains them
 * on the next boot and a player's own secondaries stand.
 *
 * The rows, on a standard-mapping pad (systems/gamepad.js unityAxes /
 * unityButtons): the bumpers crouch and jump, View opens the pack, Menu
 * pauses, L3 runs, R3 readies the weapon, LT opens the spellbook (the
 * CastSpell action - the cast itself is the attack click, as DFU's), RT
 * swings beside Y, and the D-PAD is the quickslot diamond - up and down
 * the two consumables, left the spell, right the off hand - which is
 * where a Souls player's thumb already goes. The UI dict is DFU's own and
 * untouched: A/B/X/Y keep their clicks in a window and in the world.
 * Sneak, the modes, the journals and the maps have no pad row: eight
 * buttons and four directions is what a pad has, and the rest is the
 * grid's to bind - a combo with View or Menu held is DFU's own way.
 */
export const DEFAULT_SECONDARY_BINDINGS = Object.freeze([
  ['JoystickButton4', 'Crouch'],          // LB / L1
  ['JoystickButton5', 'Jump'],            // RB / R1
  ['JoystickButton6', 'Inventory'],       // View / Share
  ['JoystickButton7', 'Escape'],          // Menu / Options
  ['JoystickButton8', 'Run'],             // L3
  ['JoystickButton9', 'ReadyWeapon'],     // R3
  ['JoystickAxis9Button0', 'CastSpell'],  // LT / L2
  ['JoystickAxis10Button0', 'SwingWeapon'],   // RT / R2, beside Y's right-click
  ['JoystickAxis7Button0', 'QuickUse1'],  // d-pad up
  ['JoystickAxis7Button1', 'QuickUse2'],  // d-pad down
  ['JoystickAxis6Button1', 'QuickSpell'], // d-pad left
  ['JoystickAxis6Button0', 'QuickOffHand'],   // d-pad right
]);

// ── key combos ──────────────────────────────────────────────────────
// A8: GetComboCode/GetCombo/GetComboString (:1165-1219). DFU PACKS the
// pair into one 32-bit KeyCode - the modifier in bits 16-31, the
// combo'd key in bits 0-15 - and everything downstream (the dicts, the
// serializer, the controls grid) then treats a combo as just another
// key code. The port's code alphabet is already strings, so the pack
// is a string: `${modifier}+${key}`, one code, one dictionary entry,
// and every existing reader keeps working unchanged.
//
// DFU's `x > 32767` guard is not an arithmetic nicety - combo codes
// START at 65537 (startingComboKeyCode, :34), so the guard is what
// forbids a combo INSIDE a combo. That is the rule ported here.

/** GetComboCode(a, b) (:1165-1177). `mod` is the key held FIRST. */
export function comboCode(mod, key) {
  if (mod == null || key == null) return null;
  if (isCombo(mod) || isCombo(key)) return null;   // the <= 32767 guard
  return `${mod}+${key}`;
}

/** `(int)k >= startingComboKeyCode` (:1674, :1719, :1223). */
export function isCombo(code) {
  return typeof code === 'string' && code.includes('+');
}

/** GetCombo (:1195-1207) - [modifier, key], or null for a plain code. */
export function getCombo(code) {
  if (!isCombo(code)) return null;
  const i = code.indexOf('+');
  return [code.slice(0, i), code.slice(i + 1)];
}

/** GetComboString (:1214-1219): "{mod} + {key}", spaces and all - the
 *  face DFU writes into the staged dict and reads back with
 *  GetComboCode(String) (:1179-1192), which trims them off again. */
export function comboString(code) {
  const c = getCombo(code);
  return c ? `${c[0]} + ${c[1]}` : String(code ?? 'None');
}

/** GetComboCode(String) (:1179-1192) - the round trip back from a
 *  displayed or hand-edited "mod + key". */
export function parseComboString(s) {
  if (typeof s !== 'string') return null;
  const parts = s.split('+');
  if (parts.length < 2) return null;
  return comboCode(parts[0].trimEnd(), parts[1].trimStart());
}

/** modifierHeldFirstDict's key set (:1349-1358): every code serving as
 *  the held-first MODIFIER of a combo, across BOTH dicts. DFU rebuilds
 *  it inside SetupActionKeyDict, which runs after every binding change;
 *  the port rebuilds it on the same event, through `rev` - the frame
 *  loop reads this every poll and must not walk both dicts each time. */
export function comboModifiers(store) {
  const rev = store.rev ?? 0;
  if (store._comboRev === rev && store._comboMods) return store._comboMods;
  const out = new Set();
  for (const dict of [store.primary, store.secondary]) {
    for (const code of dict.keys()) {
      const c = getCombo(code);
      if (c) out.add(c[0]);
    }
  }
  store._comboRev = rev;
  store._comboMods = out;
  return out;
}

/** modifierHeldFirstDict (:1354-1358, the field at :101). ROAD-GR:
 *  this is STATE, not a per-frame derivation of the held-keys ring.
 *  SetupActionKeyDict CLEARS it and seeds one `false` per combo
 *  MODIFIER after every binding change (:1354-1358), so the port
 *  rebuilds it on `rev` exactly as comboModifiers and pairedCodes
 *  rebuild theirs - a rebind starts every flag down, as DFU's does.
 *
 *  GetUnaryKey is its only writer (:1695-1708) and ui/input.js is the
 *  only caller: the flag is RAISED on a frame whose whole held set is
 *  clean (:1699-1701), LOWERED when the modifier is not held
 *  (:1704-1707), and LEFT ALONE on the "held but dirty" path - which
 *  is where the order rule actually lives. The dict is also DFU's own
 *  "is this a combo modifier" test at :1637; comboModifiers above is
 *  that same key set. */
export function modifierHeldFirstDict(store) {
  const rev = store.rev ?? 0;
  if (store._heldFirstRev === rev && store._heldFirst) return store._heldFirst;
  const dict = new Map();
  for (const m of comboModifiers(store)) dict.set(m, false);   // :1355-1358
  store._heldFirstRev = rev;
  store._heldFirst = dict;
  return dict;
}

/** primarySecondaryKeybindDict (:1345-1347, :1370-1396). ROAD-Ar R9:
 *  this is NOT a "bound in either dict" membership set, which is what
 *  the port read it as. It is a PRIMARY<->SECONDARY PAIRING map:
 *  SetupActionKeyDict clears it (:1345) and rebuilds it by running
 *  MapSecondaryBindings over the Actions enum (:1346-1347), and the
 *  only ADDITIVE arm there is `if (primKey != None && secKey != None)
 *  SetSecondaryBinding(primKey, secKey)` (:1381-1384), which writes the
 *  two codes at each other. The else arm (:1386-1395) only DETACHES.
 *
 *  So a code is a KEY of this dict exactly when its action is DOUBLE-
 *  bound, and that is what GetUnaryKey's plain-key suppression
 *  (:1683-1685) and ModifierOnlyHeld's first clause (:1636-1637)
 *  actually ask. Bind OpenInventory to LeftShift+Space with no
 *  secondary and leave Jump on Space: DFU still jumps, because the
 *  combo code was never paired. The union test suppressed it.
 *
 *  The else arm is ported too, quirk and all - it can leave a code
 *  PRESENT mapped to None (:1392) while removing the code it was
 *  detached from (:1395) - so the walk is over ACTIONS in
 *  Enum.GetValues order (:1329, :1346), not a two-dict sweep. Cached
 *  on `rev` like comboModifiers: the frame loop reads it every poll. */
export function pairedCodes(store) {
  const rev = store.rev ?? 0;
  if (store._pairRev === rev && store._paired) return store._paired;
  const map = new Map();
  for (const action of ACTIONS) {
    // FirstOrDefault(x => x.Value == a).Key, whose miss is KeyCode.None
    // (:1378-1379) - getBinding's null.
    const primKey = getBinding(store, action, true);
    const secKey = getBinding(store, action, false);
    if (primKey != null && secKey != null) {
      map.set(primKey, secKey);          // SetSecondaryBinding :1372-1373
      map.set(secKey, primKey);
    } else {
      const existingKey = primKey ?? secKey;
      let detached = null;
      if (existingKey != null && map.has(existingKey)) {
        detached = map.get(existingKey);
        map.set(existingKey, null);      // :1392 - the KEY stays, the pair goes
      }
      if (detached != null) map.delete(detached);   // :1395
    }
  }
  store._pairRev = rev;
  store._paired = map;
  return map;
}

/** primarySecondaryKeybindDict.ContainsKey (:1684, :1637). */
export function isPairedCode(store, code) {
  return code != null && pairedCodes(store).has(code);
}

/** Every binding write goes through here so comboModifiers can tell
 *  when its answer went stale (SetupActionKeyDict's own trigger). */
const touched = (store) => { store.rev = (store.rev ?? 0) + 1; };

/** THE ANY-KEY MODIFIER RULE, ported straight: DFU does not restrict a
 *  combo's first key to Shift/Ctrl/Alt - LeftShift+K and Z+LeftShift
 *  are both legal, and GetDuplicates' third phase exists precisely
 *  because they can collide. Nothing here narrows it. */

/** THE ONE CONSTRUCTION SEAM. Both dicts are keyed CODE -> ACTION,
 *  DFU's orientation (:79-80) - a key answers to one action per dict,
 *  an action may hold several keys only via a hand-edited save file
 *  (see loadKeyBinds). `unknown`/`secondaryUnknown` (:92-93) carry a
 *  newer build's actions through a save/load cycle untouched. */
export function createBindings() {
  return {
    primary: new Map(),
    secondary: new Map(),
    rev: 0,                      // bumped on every write; comboModifiers' cache key
    removedPrimary: new Set(),   // :87 - "don't autofill this default back"
    removedSecondary: new Set(),   // PAD1: the same mark for the secondary dict, which carries the pad defaults
    unknown: new Map(),
    secondaryUnknown: new Map(),
    // GP1: the joystick dicts (:83-92) - axis name -> AxisAction,
    // AxisAction -> inverted, button code -> JoystickUIAction
    axisActions: new Map(),
    axisInversions: new Map(),
    joystickUI: new Map(),
  };
}

// ── GP1: the joystick dicts (InputManager.cs :677-700, :761-800, :814-870, :931-939) ──

/** GetAxisBinding: the axis name bound to an AxisAction, or ''. */
export function getAxisBinding(store, action) {
  for (const [axis, a] of store.axisActions) if (a === action) return axis;
  return '';
}
/** GetJoystickUIBinding: the button code bound to a UI action, or null (KeyCode.None). */
export function getJoystickUIBinding(store, action) {
  for (const [code, a] of store.joystickUI) if (a === action) return code;
  return null;
}
/** ClearAxisBinding(action) (:827-832). */
export function clearAxisBinding(store, action) {
  touched(store);
  for (const [axis, a] of [...store.axisActions]) if (a === action) store.axisActions.delete(axis);
}
/** ClearJoystickUIBinding(action) (:862-867). */
export function clearJoystickUIBinding(store, action) {
  touched(store);
  for (const [code, a] of [...store.joystickUI]) if (a === action) store.joystickUI.delete(code);
}
/** SetAxisBinding (:763-776): "Not allowing multi-bind" - the action's
 *  old axis is cleared first, then the axis takes the action (stealing
 *  it from whatever the axis held). */
export function setAxisBinding(store, axis, action) {
  clearAxisBinding(store, action);
  store.axisActions.delete(axis);
  store.axisActions.set(axis, action);
}
/** SetJoystickUIBinding (:779-792): the same shape on the button dict. */
export function setJoystickUIBinding(store, code, action) {
  clearJoystickUIBinding(store, action);
  store.joystickUI.delete(code);
  store.joystickUI.set(code, action);
}
/** GetAxisActionInversion (:931-934): unset is false. */
export const getAxisInversion = (store, action) => store.axisInversions.get(action) === true;
/** SetAxisActionInversion (:936-939). */
export function setAxisInversion(store, action, invert) { touched(store); store.axisInversions.set(action, !!invert); }
/** IsUsedInAxisBinding (:941-950): is this synthetic axis key's axis one
 *  of the four bound axes - the controls grid refuses such a key. */
export function isUsedInAxisBinding(store, code) {
  const axis = axisOfKey(parseAxisKeyName(code) ?? -1);
  return !!axis && [...store.axisActions.keys()].includes(axis);
}
// TestSetAxisBinding / TestSetJoystickUIBinding (:1427-1444): only if the action is missing
function testSetAxisBinding(store, axis, action) { if (!getAxisBinding(store, action)) setAxisBinding(store, axis, action); }
function testSetJoystickUIBinding(store, code, action) { if (getJoystickUIBinding(store, action) == null) setJoystickUIBinding(store, code, action); }

/** SetBinding (:727-758). The order is the law: steal the code from
 *  the OTHER dict first, then clear this dict's old code for the
 *  action, then bind - and binding an action that was force-removed
 *  un-removes it. `code = null` is KeyCode.None: a pure clear. */
export function setBinding(store, code, action, primary = true) {
  touched(store);
  const dict = primary ? store.primary : store.secondary;
  const alt = primary ? store.secondary : store.primary;
  alt.delete(code);
  clearBinding(store, action, primary);
  if (code != null) {
    if (primary) store.removedPrimary.delete(action);
    else store.removedSecondary.delete(action);   // PAD1
    dict.delete(code);
    dict.set(code, action);
  }
}

/** ClearBinding(Actions) (:839-846) - every code the action holds in
 *  the named dict. */
export function clearBinding(store, action, primary = true) {
  touched(store);
  const dict = primary ? store.primary : store.secondary;
  for (const [code, a] of [...dict]) if (a === action) dict.delete(code);
}

/** ClearBinding(KeyCode) (:803-811). */
export function clearBindingByCode(store, code, primary = true) {
  touched(store);
  (primary ? store.primary : store.secondary).delete(code);
}

/** AddRemovedPrimaryAction (:795-798) - the controls UI's "unbind and
 *  KEEP it unbound" arm; without the mark, resetDefaults(autofill)
 *  would quietly re-bind the default on next launch. */
export function addRemovedPrimaryAction(store, action) {
  store.removedPrimary.add(action);
}

/** PAD1: the secondary dict's own mark. DFU never needed one - its
 *  ResetDefaults writes no secondary - but the pad defaults live there
 *  (DEFAULT_SECONDARY_BINDINGS) and are autofilled on every load, so a
 *  pad button a player cleared on purpose would come back at the next
 *  boot without it. Same law, same file row (`removedSecondaryActions`). */
export function addRemovedSecondaryAction(store, action) {
  store.removedSecondary.add(action);
}

/** GetBinding (:641-671). One-arg walks the primary dict ("first
 *  non-None KeyCode"); pass primary=false for the secondary dict. */
export function getBinding(store, action, primary = true) {
  const dict = primary ? store.primary : store.secondary;
  for (const [code, a] of dict) if (a === action) return code;
  return null;
}

/** GetBindings (:706-724) - all primary codes for the action, in
 *  insertion order. More than one exists only after a hand-edited
 *  file loads. */
export function getBindings(store, action) {
  const out = [];
  for (const [code, a] of store.primary) if (a === action) out.push(code);
  return out;
}

/** The router's read (I2): the frame loop checks the primary dict
 *  then the secondary (GetKey :1084 falls through to
 *  GetSecondaryBinding). */
export function actionForCode(store, code) {
  return store.primary.get(code) ?? store.secondary.get(code) ?? null;
}

/**
 * THE INVERSE, and the only one in the tree (LV2). The store's two
 * dicts are CODE -> ACTION, which is what every reader has ever
 * wanted: a press arrives and the game asks what it means. A SCREEN
 * asking the other way - "which key opens the sheet?", so a
 * notification can name it - has no dict to read and has to walk one.
 *
 * It lives here, beside its mirror, rather than inside the surface
 * that wanted it first: a second walk written into a view is how two
 * screens come to disagree about which key they are telling a player
 * to press. Primary first, then secondary, which is the order
 * `actionForCode` resolves in - so the key this NAMES is the key that
 * ANSWERS.
 */
export function codeForAction(store, action) {
  for (const dict of [store?.primary, store?.secondary]) {
    if (!dict) continue;
    for (const [code, act] of dict) if (act === action) return code;
  }
  return null;
}

// TestSetBinding (:1405-1422): a default lands only if the action is
// missing from THIS dict, the code is free in BOTH, the action was not
// force-removed, and the code is not serving as a combo's MODIFIER
// (:1416-1418). A8 made that last guard reachable: before combos it
// had nothing to walk, and the sentence saying so has been deleted
// rather than left standing. It matters on the autofill pass - a
// player who bound Shift+K must not have a new build's default quietly
// take plain Shift out from under the combo.
function testSetBinding(store, code, action, primary = true) {
  const dict = primary ? store.primary : store.secondary;
  const alt = primary ? store.secondary : store.primary;
  if (dict.has(code) || alt.has(code)) return;
  for (const a of dict.values()) if (a === action) return;
  if (primary && store.removedPrimary.has(action)) return;
  if (!primary && store.removedSecondary.has(action)) return;   // PAD1
  if (comboModifiers(store).has(code)) return;
  setBinding(store, code, action, primary);
}

/** ResetDefaults (:954-1043). The quirk is the law: a FULL reset
 *  clears the PRIMARY dict and the removed list (:956-960) but NOT
 *  the secondary dict - each default then steals its code back out of
 *  the secondary via SetBinding's alt-removal, and a secondary
 *  binding on a non-default code SURVIVES the reset. Autofill mode is
 *  the startup "push new actions into an old save" pass (:445-448). */
export function resetDefaults(store, autofill = false) {
  touched(store);
  if (!autofill) {
    store.primary.clear();
    store.removedPrimary.clear();
    store.removedSecondary.clear();   // PAD1: a full reset forgets the pad marks too, and refills below
  }
  const set = autofill
    ? (code, action) => testSetBinding(store, code, action, true)
    : (code, action) => setBinding(store, code, action, true);
  for (const [code, action] of DEFAULT_BINDINGS) set(code, action);
  // PAD1: THE PAD LAYOUT, in the SECONDARY dict and always by testSetBinding
  // - a full reset restores the keyboard primaries as DFU's does (:956-960)
  // and leaves every secondary a player chose standing, so the pad rows can
  // only ever FILL a gap: a missing action, on a free code, not marked
  // removed. The codes are pad-only, so no keyboard default is touched.
  for (const [code, action] of DEFAULT_SECONDARY_BINDINGS) testSetBinding(store, code, action, false);
  // GP1: the joystick tail (:1034-1047). A full reset SETS the four
  // axes and four buttons over whatever stood (SetAxisBinding clears
  // the action's old axis, so a stick moved to Axis3 comes home); an
  // autofill fills only a MISSING action. The inversions: false unless
  // autofill and the file already said.
  const setAxis = autofill ? (a, x) => testSetAxisBinding(store, a, x) : (a, x) => setAxisBinding(store, a, x);
  const setUI = autofill ? (c, x) => testSetJoystickUIBinding(store, c, x) : (c, x) => setJoystickUIBinding(store, c, x);
  for (const [axis, action] of DEFAULT_AXIS_BINDINGS) setAxis(axis, action);
  for (const [code, action] of DEFAULT_JOYSTICK_UI) setUI(code, action);
  for (const action of AXIS_ACTIONS) if (!autofill || !store.axisInversions.has(action)) setAxisInversion(store, action, false);
}

/** SaveKeyBinds' KeyBindData_v1 (:871-930), minus the axis/joystick
 *  blocks the port has no engine for. Unknown actions seen at load
 *  are appended back (:899-916) so an older build never strips a
 *  newer one's file - unless the key was REBOUND here, in which case
 *  this build's meaning wins. */
export function serializeKeyBinds(store) {
  const actionKeyBinds = {};
  const secondaryActionKeyBinds = {};
  for (const [code, action] of store.primary) actionKeyBinds[code] = action;
  for (const [code, action] of store.secondary) secondaryActionKeyBinds[code] = action;
  for (const [code, name] of store.unknown) {
    if (!(code in actionKeyBinds)) actionKeyBinds[code] = name;
  }
  for (const [code, name] of store.secondaryUnknown) {
    if (!(code in secondaryActionKeyBinds)) secondaryActionKeyBinds[code] = name;
  }
  // GP1: the three joystick blocks (:876-879, :915-922) - the axis
  // dict as it stands, the inversions as "True"/"False" strings, the
  // UI buttons by their key string
  const axisActionKeyBinds = {};
  for (const [axis, action] of store.axisActions) axisActionKeyBinds[axis] = action;
  const axisActionInversions = {};
  for (const [action, inv] of store.axisInversions) axisActionInversions[action] = inv ? 'True' : 'False';
  const joystickUIKeyBinds = {};
  for (const [code, action] of store.joystickUI) joystickUIKeyBinds[code] = action;
  return {
    version: KEYBINDS_VERSION,   // KB1: the port's own field - DFU's KeyBindData_v1 has none, and a file without it is v1
    actionKeyBinds,
    secondaryActionKeyBinds,
    removedPrimaryActions: [...store.removedPrimary],
    removedSecondaryActions: [...store.removedSecondary],   // PAD1
    axisActionKeyBinds,
    axisActionInversions,
    joystickUIKeyBinds,
  };
}

// LoadActionKeybinds (:1950-1969). Raw map-set, NOT setBinding: a
// hand-edited file binding two keys to one action loads BOTH (GetKey
// answers to either), which setBinding's clear-first would collapse.
function loadActionKeybinds(store, saved, primary) {
  if (!saved) return;
  touched(store);
  const dict = primary ? store.primary : store.secondary;
  const unknown = primary ? store.unknown : store.secondaryUnknown;
  for (const [code, name] of Object.entries(saved)) {
    const action = parseActionName(name);
    if (!dict.has(code) && action !== 'Unknown') dict.set(code, action);
    else unknown.set(code, name);
  }
}

/** LoadKeyBinds (:1971-2000). A removed-primary mark loads only for a
 *  KNOWN action that is not currently bound in either dict (:1983-1992).
 *  DFU's startup follows a load with resetDefaults(store, true) to
 *  autofill actions the file predates (:445-448) - callers do the same. */
export function loadKeyBinds(store, data) {
  if (!data) return;
  loadActionKeybinds(store, data.actionKeyBinds, true);
  loadActionKeybinds(store, data.secondaryActionKeyBinds, false);
  if (Array.isArray(data.removedPrimaryActions)) {
    for (const name of data.removedPrimaryActions) {
      const action = parseActionName(name);
      if (action === 'Unknown') continue;
      let bound = false;
      for (const a of store.primary.values()) if (a === action) bound = true;
      for (const a of store.secondary.values()) if (a === action) bound = true;
      if (!bound) store.removedPrimary.add(action);
    }
  }
  // PAD1: the secondary marks. The primary's law above asks "bound
  // nowhere", and a secondary mark's action is bound on the KEYBOARD
  // almost by definition (Crouch keeps its C while its pad row is
  // cleared) - so the secondary's law asks the one dict it is about: a
  // mark loads for an action that holds no SECONDARY, and a file that
  // names a secondary-bound action as removed is read as the binding.
  if (Array.isArray(data.removedSecondaryActions)) {
    for (const name of data.removedSecondaryActions) {
      const action = parseActionName(name);
      if (action === 'Unknown') continue;
      let bound = false;
      for (const a of store.secondary.values()) if (a === action) bound = true;
      if (!bound) store.removedSecondary.add(action);
    }
  }
  // GP1: the joystick blocks (:1995-2035). Each is a raw map-set that
  // keeps the first of two bindings to one key, as the action dicts
  // load; a block absent from an older file is simply empty (the
  // autofill that follows every load fills it), and an unknown
  // AxisAction or UI action name is dropped - Enum.Parse would throw
  // there, and a thrown load is a file that never loads again.
  if (data.axisActionKeyBinds && typeof data.axisActionKeyBinds === 'object') {
    touched(store);
    for (const [axis, action] of Object.entries(data.axisActionKeyBinds)) {
      if (AXIS_ACTIONS.includes(action) && !store.axisActions.has(axis)) store.axisActions.set(axis, action);
    }
  }
  if (data.joystickUIKeyBinds && typeof data.joystickUIKeyBinds === 'object') {
    touched(store);
    for (const [code, action] of Object.entries(data.joystickUIKeyBinds)) {
      if (JOYSTICK_UI_ACTIONS.includes(action) && !store.joystickUI.has(code)) store.joystickUI.set(code, action);
    }
  }
  if (data.axisActionInversions && typeof data.axisActionInversions === 'object') {
    for (const [action, v] of Object.entries(data.axisActionInversions)) {
      if (AXIS_ACTIONS.includes(action)) setAxisInversion(store, action, v === 'True');
    }
  }
}

// ── persistence ─────────────────────────────────────────────────────
// DFU keeps KeyBindings.txt BESIDE settings.ini, its own file with its
// own serializer (GetKeyBindsSavePath) - so the port keeps its own
// localStorage key beside the settings store's, same try/catch shield
// as systems/settings.js:157.
const STORAGE_KEY = 'dagger.keybinds';

// DA1: the storage seam - localStorage in a browser, the desktop
// shell's file store (KeyBindings beside the settings, as DFU keeps
// KeyBindings.txt beside settings.ini) in the app.
function storage() {
  return appStorage();
}

/** The startup path (:441-452): load the file if it exists then
 *  autofill, else write defaults. Always answers a usable store. */
/** MAC-D1 (SquidKamer on the desktop app, 2026-09-21: "I cant seem to
 *  swing the weapon in the installed version of the game. I have to
 *  enable the attack click but I prefer the mouse swing"): THE VERBS
 *  A GAME CANNOT BE PLAYED WITHOUT CANNOT BE LEFT UNBOUND.
 *
 *  MAC-SWING1 fixed the READ - a swing bound to a key answers here
 *  now, whatever it is bound to. It did not fix the STATE that
 *  stranded the first reporter and has stranded another: an action
 *  with no code at all. `setBinding` clears an action's old row when
 *  a new code takes it, and `removedPrimary` is DFU's "keep this
 *  unbound" mark, which is exactly what resetDefaults(autofill) obeys
 *  - so a rebind that lands on an already-taken code, or a row
 *  cleared in the controls window, leaves SwingWeapon addressing
 *  nothing. Then `swingButton()` is -1, `held(keys, 'SwingWeapon')`
 *  is false, and the gesture can never fire again. The desktop app
 *  keeps its prefs file across reinstalls, so reinstalling does not
 *  clear it either - which is why this reads as an installed-build
 *  bug and why both reporters reached for Click mode instead.
 *
 *  A player may unbind a convenience. These are not conveniences:
 *  without them there is no way to swing, move or interact at all,
 *  and no way BACK, because the way back is itself a binding. So the
 *  default is restored and the removal mark lifted - the narrowest
 *  repair that cannot strand anyone, applied at the one door every
 *  load comes through. */
export const UNLOSEABLE_ACTIONS = Object.freeze(['SwingWeapon', 'ActivateCenterObject', 'MoveForwards', 'MoveBackwards', 'MoveLeft', 'MoveRight']);

/** The codes an action answers to right now, across both dicts. */
export function codesForAction(store, action) {
  const out = [];
  for (const dict of [store.primary, store.secondary]) {
    for (const [code, a] of dict) if (a === action) out.push(code);
  }
  return out;
}

/** MAC-D1: ...and whether any of them is one a player at a keyboard
 *  can actually press. A PAD row does not rescue a stranded action:
 *  DEFAULT_SECONDARY_BINDINGS fills the pad codes on every load, so
 *  an unbound SwingWeapon still answers `JoystickAxis10Button0` and
 *  would look bound while nothing on the desk can swing. `swingButton`
 *  reads the mouse codes and the rig's key latch reads the held set;
 *  neither can ever see a pad code on a machine with no pad. */
export const isPadCode = (code) => typeof code === 'string' && code.startsWith('Joystick');
export const actionIsReachable = (store, action) => codesForAction(store, action).some((c) => !isPadCode(c));

/** Restore any unloseable action that addresses nothing. Answers the
 *  actions it had to repair, so a caller can say so. */
export function repairUnloseableBindings(store) {
  const fixed = [];
  for (const action of UNLOSEABLE_ACTIONS) {
    if (actionIsReachable(store, action)) continue;
    const def = DEFAULT_BINDINGS.find(([, a]) => a === action);
    if (!def) continue;
    // The removal mark is DFU's "keep it unbound" and it is exactly what
    // stopped the autofill pass putting this back - but lifting it here
    // by hand is dead code: SetBinding's own first act is
    // `removedPrimary.delete(action)` (:473), so the repair below
    // clears the mark as part of binding. A mutant that deleted the
    // hand-written lift survived, which is what said so.
    setBinding(store, def[0], action, true);
    fixed.push(action);
  }
  return fixed;
}

/** KB1: THE FILE'S VERSION. 1 is every file before the keybinding standard (it carried no field); 2 is the standard. */
export const KEYBINDS_VERSION = 2;

/**
 * KB1: A v1 FILE COMES FORWARD, ONCE. The standard moved three defaults a saved file may still hold, and the
 * autofill that follows every load fills a missing action only on a FREE code - so a v1 file keeps E on AbortSpell
 * and Interact never lands, keeps Backquote on the console and AbortSpell never lands.
 *
 * AUDIT KB1 F1/F2/F3 - THE ORDER IS THE LAW. The first cut carried the mods' old keys BEFORE the autofill, and
 * "a free code" then meant free in the v1 file, not free once the standard's defaults stood - so a torch key saved
 * as E took E from Interact, an old Travel Options G (the mod switched off, the key dead) took G from the torch
 * drop, and the action that lost its key was never named. And E was let go of AbortSpell whether or not Backquote
 * could take it, so a player who had spent Backquote lost the spell's abort without a word. Now, in three steps:
 *  1. LET GO. E, Backquote and Left Ctrl are let go where they still hold the OLD default (AbortSpell,
 *     ToggleConsole, Slide), and the two hidden actions let go of ANY code they hold - they do nothing, and a row
 *     that holds a key and does nothing is how a key gets spent twice (HIDDEN_ACTIONS).
 *  2. THE STANDARD'S DEFAULTS LAND - the autofill, on every code the player's own file left free.
 *  3. THE MODS' OLD KEYS come in, onto a code free AFTER step 2 - a player's choice never takes a key from another
 *     action. A value they SAVED that the port never shipped is their choice; `None` keeps the action unbound; a
 *     shipped value is left to the new default. A choice that could not land is reported (`kept`).
 * Then every action the standard gives a key and this file left keyless (its default spent by the player's own
 * binding, not removed on purpose) is reported (`lost`), so the player is TOLD - the caller hands the report to the
 * HUD (ui/input.js setKeybindNoticeSink). Answers `{ moved, kept, lost }`; a file already at the version answers
 * all three empty and touches nothing.
 */
export function migrateKeyBinds(store, fromVersion) {
  const report = { moved: [], kept: [], lost: [] };
  if (fromVersion >= KEYBINDS_VERSION) return report;
  for (const [code, was] of [['KeyE', 'AbortSpell'], ['Backquote', 'ToggleConsole'], ['ControlLeft', 'Slide']]) {
    if (store.primary.get(code) === was) { store.primary.delete(code); touched(store); report.moved.push(`${was} off ${code}`); }
  }
  for (const hidden of HIDDEN_ACTIONS) {
    for (const primary of [true, false]) {
      const had = getBinding(store, hidden, primary);
      if (had != null) { clearBinding(store, hidden, primary); report.moved.push(`${hidden} off ${had}`); }
    }
  }
  resetDefaults(store, true);   // step 2: the standard's defaults, on every code still free
  const spoken = (code) => actionForCode(store, code) != null || comboModifiers(store).has(code);
  for (const [vendor, rows] of Object.entries(MOD_ACTIONS)) {
    for (const row of rows) {
      let saved;
      try { saved = storedModSetting(vendor, row.legacy); } catch { saved = undefined; }
      if (saved === undefined || row.shipped.includes(saved)) continue;
      let name = saved;
      if (row.choice) {   // Travel Options: one of its six by index, else its custom bind (an empty one is no choice)
        const i = saved | 0;
        name = i < row.options.length ? row.options[i] : (String(storedModSetting(vendor, row.choice) ?? '').trim() || null);
        if (name == null) continue;
      }
      if (name === KEYCODE_NONE || name === 'None') { clearBinding(store, row.action, true); store.removedPrimary.add(row.action); report.moved.push(`${row.action} unbound`); continue; }
      const code = domCodeForKeyCode(String(name));
      if (!code || getBinding(store, row.action, true) === code) continue;   // a key that parses to nothing, or the one it already has
      if (spoken(code)) { report.kept.push({ action: row.action, code, holder: actionForCode(store, code) }); continue; }
      setBinding(store, code, row.action, true);
      report.moved.push(`${row.action} on ${code}`);
    }
  }
  for (const [code, action] of DEFAULT_BINDINGS) {
    if (getBinding(store, action, true) != null || store.removedPrimary.has(action)) continue;
    report.lost.push({ action, code, holder: actionForCode(store, code) });
  }
  return report;
}

export function loadOrCreateBindings() {
  const store = createBindings();
  const ls = storage();
  const raw = ls?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      loadKeyBinds(store, data);
      const from = Number(data?.version) || 1;
      const report = migrateKeyBinds(store, from);   // KB1: runs the autofill inside it, between its steps
      resetDefaults(store, true);
      if (from < KEYBINDS_VERSION) {
        const said = [...report.moved, ...report.kept.map((k) => `${k.action} kept its key (${k.code} is ${k.holder}'s)`),
          ...report.lost.map((l) => `${l.action} has no key (${l.code} is ${l.holder}'s)`)];
        if (said.length) console.info(`[keybinds] brought forward to v${KEYBINDS_VERSION}: ${said.join(', ')}`);
        if (report.kept.length || report.lost.length) store.carried = report;   // AUDIT KB1 F3: for the player, not the console only (ui/input.js)
        saveKeyBinds(store);   // written as v2 at once, so the carry runs exactly once
      }
      // MAC-D1: ...and the autofill pass above will NOT do this, by
      // design - it obeys the removal marks. This runs after it and
      // writes the repair back, so the next load starts sound.
      if (chatMigrated || repairUnloseableBindings(store).length) saveKeyBinds(store);
      return store;
    } catch { /* a corrupt file falls through to defaults */ }
  }
  resetDefaults(store);
  saveKeyBinds(store);
  return store;
}

/** SaveKeyBinds' write (:926-929). AUDIT DA: this was the ONE
 *  storage writer without the try/catch shield - setItem THROWS on a
 *  full or broken store (quota in a browser, disk through the shell's
 *  bridge), and an unshielded throw here propagated out of the
 *  rebind flow and out of first-boot loadOrCreateBindings. Losing
 *  the write costs a rebind, not a session. */
export function saveKeyBinds(store) {
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(serializeKeyBinds(store))); }
  catch (err) { console.warn('[inputActions] keybind write failed:', err?.name ?? err); }
  _raiseSavedKeyBinds();
}

// ── OnSavedKeyBinds (InputManager.cs:2067 declared, raised at :928
//    inside SaveKeyBinds) ────────────────────────────────────────────
//
// ROAD-G G6 needed this and nothing before it did. It looks like a
// notification and it is really an ORDERING: the advanced-controls
// window subscribes at Setup
// (DaggerfallUnityMouseControlsWindow.cs:83) and does ALL of its
// setting writes in the handler, so its sliders and checkboxes reach
// the store at the moment the KEYBINDS are saved - which is the
// CONTROLS window's close, not its own CONTINUE. Port the event and
// that ordering falls out; hard-wire the call instead and the next
// window to want it invents a second one.
//
// DEPARTURE in the ORDER, and it is the port's shield that makes it.
// DFU raises only after a SUCCESSFUL write - File.WriteAllText (:926),
// UpdateBindingCache (:927), RaiseSavedKeyBindsEvent (:928) - and
// SaveKeyBinds (:871-929) has no try/catch, so a throwing write
// propagates and the event never fires. The port shields the write
// (AUDIT DA above) and raises regardless, because the settings half of
// the handler has nothing to do with whether localStorage accepted the
// binding blob, and a lost keybind blob must not also cost the ten
// advanced-controls values.
const _savedKeyBindListeners = new Set();
/** Returns the unsubscribe. DFU's static event never unsubscribes -
 *  its windows are DaggerfallUI singletons - and the port's windows
 *  are not, so a handle to detach is the port's own half. */
export function onSavedKeyBinds(fn) {
  _savedKeyBindListeners.add(fn);
  return () => _savedKeyBindListeners.delete(fn);
}
function _raiseSavedKeyBinds() {
  for (const fn of [..._savedKeyBindListeners]) {
    try { fn(); } catch (e) { console.warn('[inputActions] OnSavedKeyBinds listener failed:', e?.message ?? e); }
  }
}

// ── the frame model ─────────────────────────────────────────────────

/** currentActions/previousActions (:79-80 in spirit; :610-637 the
 *  readers). endFrame is DFU's LateUpdate swap. */
export function createActionState() {
  return { current: new Set(), previous: new Set() };
}
export const addAction = (state, action) => { state.current.add(action); };
export const hasAction = (state, action) => state.current.has(action);
export const actionStarted = (state, action) =>
  !state.previous.has(action) && state.current.has(action);
export const actionComplete = (state, action) =>
  state.previous.has(action) && !state.current.has(action);
export function endFrame(state) {
  state.previous = state.current;
  state.current = new Set();
}

// A8 RETIRED THE COMBO FLAG THAT STOOD HERE. It said the port had no
// combos and that the runtime held-order logic pended a slice; the
// pack, the modifier set, the autofill guard and the duplicate check
// are above and in controlsConfig.js, and the held-order read is in
// ui/input.js.
//
// ROAD-G G3 RETIRED THE HELD-ORDER REMAINDER A8 LEFT BEHIND. It said
// DFU's per-frame `heldKeys` ring (:1818, ModifierOnlyHeld) tracks the
// ORDER two keys went down in - holding K then Shift does not fire
// Shift+K - and that the port's hosts keep "a Set with no order". The
// second half was never true, and neither was the first: DFU's ring is
// not press-ordered either (PollInput refills it in KeyCodeList order
// every frame, :1801-1809) and ModifierOnlyHeld scans the WHOLE of it
// (:1632-1639). The order lives in the LATCH, which is why the READ
// alone was never enough. It is built now, at the seam this note
// named: modifierHeldFirstDict is STORED (modifierHeldFirstDict above,
// on the store, seeded as :1354-1358 seeds it), ui/input.js writes it
// exactly where GetUnaryKey does (:1695-1708 - raised only on a clean
// whole-set scan, lowered only by the modifier's release, left alone
// in between), `heldModifier` is :1818-1821, and both arms of
// GetUnaryKey - the combo's hit and the plain key's suppression - read
// that stored flag. The four hosts that own a Set now fill it BEFORE their
// dispatch ladder, as PollInput does (:1795-1809). Pinned from both
// orders in test/g3_heldorder.test.js - the ring fill is its host
// sweep, discovered from `const keys = new Set();` - and in
// test/a8_combos.test.js' two-modifier pair. (test/combohosts.test.js
// is AUDIT 58's sweep of the Set ARGUMENT and carries neither claim.)
//
// GP1 (2026-09-11) PORTED THE AXES AND THE JOYSTICK: AxisActions and
// JoystickUIActions live on this store (the three dicts above, their
// setters and the KeyBindData_v1 blocks), systems/gamepad.js holds
// InputManager's stick and axis-key law, and ui/gamepadInput.js polls
// the browser's pad into every host's held-keys Set.
// GP2 (the same day) BUILT THE JOYSTICK CONTROLS WINDOW
// (ui/joystickControlsWindow.js, the JOYSTICK tab's destination).
// GP3 (the same day) BUILT THE CONTROLLER CURSOR (ui/gamepadInput.js):
// UsingController's cursor over a window, born where the mouse last
// was, moved by the movement stick at JoystickCursorSensitivity, the
// three click actions landing as pointer events at its point
// (InputManager.cs:556-573, :1518-1570). Nothing of InputManager's
// joystick law is flagged here any longer.
// NOT A FLAG: the port's own standing key departures (C cast, X crouch,
// E activate, V view) reconcile against this table in I2, each
// becoming an adoption or a Ledger-A row - not here.
