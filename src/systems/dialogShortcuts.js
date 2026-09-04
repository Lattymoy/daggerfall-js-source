// A8 - THE DIALOG SHORTCUT TABLE. HotkeySequence.cs and
// DaggerfallShortcut.cs (MIT, Daggerfall Workshop) with
// StreamingAssets/Text/DialogShortcuts.txt as the data, which is the
// half that matters: DFU's window buttons do NOT carry hard-coded
// letters, they carry a Buttons id and read the letter out of this
// text database (DaggerfallShortcut.CheckLoaded :307-326). Every
// accelerator the port's windows spell as a literal was a guess until
// this table landed; the ones that happened to be right (the travel
// popup's B/E/S/T/N) were right by accident and had nothing keeping
// them right.
//
// The port's key alphabet is the browser's `KeyboardEvent.code`, so
// the table's Unity KeyCode NAMES translate on the way in (keyCode()
// below) exactly as inputActions.js translates DFU's binding
// defaults. The modifier half is ported whole - the port's shipped
// table uses only the three VIRTUAL modifiers (Ctrl/Shift/Alt, which
// is what "Shift-Escape" means: either shift), and a browser
// KeyboardEvent cannot tell left from right on its own, but
// CheckSetModifiers' masking law only ever consults the virtual bits
// so the shipped table resolves exactly.

/** HotkeySequence.KeyModifiers (:10-24) - the [Flags] values verbatim. */
export const MOD = Object.freeze({
  None: 0,
  LeftCtrl: 1, RightCtrl: 2,
  LeftShift: 4, RightShift: 8,
  LeftAlt: 16, RightAlt: 32,
  // Virtuals
  Ctrl: 64, Shift: 128, Alt: 256,
});

/** virtualKeys (:33). */
export const VIRTUAL_KEYS = MOD.Ctrl | MOD.Shift | MOD.Alt;

/** HotkeySequenceProcessStatus (:26-31). Panel.ProcessHotkeySequences
 *  answers with these; the port's windows answer `true`/`false` from
 *  their own input() ladders, so Disabled has no consumer yet - the
 *  names are here because the status is part of the law's face. */
export const HOTKEY_STATUS = Object.freeze({
  NotFound: 'NotFound', Handled: 'Handled', Disabled: 'Disabled',
});

/**
 * The HotkeySequence constructor (:42-54): the INFERRED VIRTUALS are
 * the constructor's own work - naming LeftShift implies Shift, so a
 * sequence built from a physical side still masks correctly against a
 * pressed set that only carries virtuals.
 */
export function hotkeySequence(code, modifiers = MOD.None) {
  let m = modifiers;
  if ((m & (MOD.LeftCtrl | MOD.RightCtrl)) !== 0) m |= MOD.Ctrl;
  if ((m & (MOD.LeftShift | MOD.RightShift)) !== 0) m |= MOD.Shift;
  if ((m & (MOD.LeftAlt | MOD.RightAlt)) !== 0) m |= MOD.Alt;
  return Object.freeze({ code: code ?? null, modifiers: m });
}

/** HotkeySequence.None (:40). */
export const HOTKEY_NONE = hotkeySequence(null, MOD.None);

// Unity KeyCode name -> browser KeyboardEvent.code, for the names the
// table (and a hand-edited one) can carry. Same idea as
// inputActions.js's default table, one direction over.
const KEYCODE_CODES = Object.freeze({
  Return: 'Enter', Space: 'Space', Backspace: 'Backspace', Tab: 'Tab', Escape: 'Escape',
  LeftArrow: 'ArrowLeft', RightArrow: 'ArrowRight', UpArrow: 'ArrowUp', DownArrow: 'ArrowDown',
  PageUp: 'PageUp', PageDown: 'PageDown', Home: 'Home', End: 'End',
  Insert: 'Insert', Delete: 'Delete',
  KeypadPlus: 'NumpadAdd', KeypadMinus: 'NumpadSubtract',
  KeypadMultiply: 'NumpadMultiply', KeypadDivide: 'NumpadDivide',
  KeypadEnter: 'NumpadEnter', KeypadPeriod: 'NumpadDecimal',
  LeftShift: 'ShiftLeft', RightShift: 'ShiftRight',
  LeftControl: 'ControlLeft', RightControl: 'ControlRight',
  LeftAlt: 'AltLeft', RightAlt: 'AltRight',
});

/** A Unity KeyCode NAME as the port's code, or null for a name this
 *  build has no key for (FromString's catch arm, :89-93). */
export function keyCode(name) {
  if (!name) return null;
  if (KEYCODE_CODES[name]) return KEYCODE_CODES[name];
  if (/^[A-Za-z]$/.test(name)) return `Key${name.toUpperCase()}`;
  if (/^F([1-9]|1[0-5])$/.test(name)) return name;
  const alpha = /^Alpha(\d)$/.exec(name);
  if (alpha) return `Digit${alpha[1]}`;
  const pad = /^Keypad(\d)$/.exec(name);
  if (pad) return `Numpad${pad[1]}`;
  return null;
}

const MOD_NAMES = Object.freeze({
  leftctrl: MOD.LeftCtrl, rightctrl: MOD.RightCtrl,
  leftshift: MOD.LeftShift, rightshift: MOD.RightShift,
  leftalt: MOD.LeftAlt, rightalt: MOD.RightAlt,
  ctrl: MOD.Ctrl, shift: MOD.Shift, alt: MOD.Alt,
  none: MOD.None,
});

/** FromString (:71-94). "the order of modifiers doesn't matter"; the
 *  LAST '-' separated word is the key, the rest are modifiers, and
 *  ParseEnum is case-INSENSITIVE (:130-133). An unparseable word
 *  throws in DFU and the catch returns None - here a null code is the
 *  same answer. */
export function fromString(text) {
  if (text == null) return HOTKEY_NONE;
  const name = String(text).trim();
  if (name === 'None' || name === '') return HOTKEY_NONE;
  const words = name.split('-');
  const code = keyCode(words[words.length - 1].trim());
  if (!code) return HOTKEY_NONE;
  let modifiers = MOD.None;
  for (let i = 0; i < words.length - 1; i++) {
    const bit = MOD_NAMES[words[i].trim().toLowerCase()];
    if (bit === undefined) return HOTKEY_NONE;   // ParseEnum threw
    modifiers |= bit;
  }
  return hotkeySequence(code, modifiers);
}

/** GetKeyModifiers (:135-151) - each physical side lights its virtual
 *  too, which is what makes CheckSetModifiers' second mask work. */
export function getKeyModifiers(leftCtrl, rightCtrl, leftShift, rightShift, leftAlt, rightAlt) {
  let m = MOD.None;
  if (leftCtrl) m = m | MOD.LeftCtrl | MOD.Ctrl;
  if (rightCtrl) m = m | MOD.RightCtrl | MOD.Ctrl;
  if (leftShift) m = m | MOD.LeftShift | MOD.Shift;
  if (rightShift) m = m | MOD.RightShift | MOD.Shift;
  if (leftAlt) m = m | MOD.LeftAlt | MOD.Alt;
  if (rightAlt) m = m | MOD.RightAlt | MOD.Alt;
  return m;
}

/**
 * GetKeyboardKeyModifiers (:153-156) over the port's two sources. A
 * KeyboardEvent carries only the three VIRTUAL facts (ctrlKey /
 * shiftKey / altKey) - the DOM has no left/right flag - so the sides
 * come from the host's held-keys Set when one is handed in, and the
 * virtual bits are set either way. That is enough for exact matching:
 * CheckSetModifiers masks with virtualKeys alone.
 */
export function keyboardModifiers(e = null, keys = null) {
  const has = (c) => !!keys?.has?.(c);
  let m = getKeyModifiers(
    has('ControlLeft'), has('ControlRight'),
    has('ShiftLeft'), has('ShiftRight'),
    has('AltLeft'), has('AltRight'),
  );
  if (e?.ctrlKey || e?.metaKey) m |= MOD.Ctrl;
  if (e?.shiftKey) m |= MOD.Shift;
  if (e?.altKey) m |= MOD.Alt;
  return m;
}

/** CheckSetModifiers (:158-162): every modifier the sequence asks for
 *  is down, and NO OTHER virtual modifier is - that second clause is
 *  what keeps Shift-F10 off F10 and F10 off Shift-F10. */
export function checkSetModifiers(pressed, triggering) {
  return ((pressed & triggering) === triggering)
    && ((pressed & (VIRTUAL_KEYS & ~triggering)) === 0);
}

/** ToString (:96-128): Ctrl, then Alt, then Shift, then the key; a
 *  side is named only when it is the ONLY side asked for. The port's
 *  key half prints the browser code, which is its KeyCode. */
export function sequenceString(seq) {
  let out = '';
  const side = (virt, left, right, name) => {
    if ((seq.modifiers & virt) === 0) return;
    if ((seq.modifiers & left) !== 0 && (seq.modifiers & right) === 0) out += `Left${name}-`;
    else if ((seq.modifiers & right) !== 0 && (seq.modifiers & left) === 0) out += `Right${name}-`;
    else out += `${name}-`;
  };
  side(MOD.Ctrl, MOD.LeftCtrl, MOD.RightCtrl, 'Ctrl');
  side(MOD.Alt, MOD.LeftAlt, MOD.RightAlt, 'Alt');
  side(MOD.Shift, MOD.LeftShift, MOD.RightShift, 'Shift');
  return out + (seq.code ?? 'None');
}

/**
 * DaggerfallShortcut.Buttons (:11-303), names and ORDER verbatim.
 * 'None' (:13) is the sentinel CheckLoaded skips, so it is not in the
 * list - exactly as inputActions.ACTIONS leaves out 'Unknown'.
 */
export const BUTTONS = Object.freeze([
  'Accept', 'Reject', 'Cancel', 'Yes', 'No', 'OK', 'Male', 'Female',
  'Add', 'Delete', 'Edit', 'Copy', 'Guilty', 'NotGuilty', 'Debate', 'Lie',
  'Anchor', 'Teleport',
  // Game Setup menu
  'GameSetupPlay', 'GameSetupAdvancedSettings', 'GameSetupMods', 'GameSetupClose',
  'GameSetupBackToOptions', 'GameSetupRestart', 'GameSetupRefresh',
  'GameSetupSaveAndClose', 'GameSetupExit',
  // Main menu
  'MainMenuLoad', 'MainMenuStart', 'MainMenuExit',
  // Class Creation Menu
  'ResetBonusPool',
  // Options menu
  'OptionsExit', 'OptionsContinue', 'OptionsSave', 'OptionsLoad',
  'OptionsControls', 'OptionsFullScreen', 'OptionsHeadBobbing', 'OptionsDropdown',
  // General
  'Pause', 'LargeHUDToggle', 'HUDToggle', 'ToggleRetroPP',
  // Debugger
  'DebuggerToggle', 'DebuggerPrevQuest', 'DebuggerNextQuest',
  'DebuggerPrevMarker', 'DebuggerNextMarker',
  // Rest menu
  'RestForAWhile', 'RestUntilHealed', 'RestLoiter', 'RestStop',
  // Transport menu
  'TransportFoot', 'TransportHorse', 'TransportCart', 'TransportShip', 'TransportExit',
  // Travel Map screen
  'TravelMapFind', 'TravelMapList',
  // Talk screen
  'TalkTellMeAbout', 'TalkWhereIs', 'TalkCategoryLocation', 'TalkCategoryPeople',
  'TalkCategoryThings', 'TalkCategoryWork', 'TalkAsk', 'TalkExit', 'TalkCopy',
  'TalkTonePolite', 'TalkToneNormal', 'TalkToneBlunt',
  // Spellbook screen
  'SpellbookDelete', 'SpellbookUp', 'SpellbookSort', 'SpellbookDown',
  'SpellbookBuy', 'SpellbookExit',
  // Travel menu
  'TravelBegin', 'TravelExit', 'TravelSpeedToggle', 'TravelTransportModeToggle',
  'TravelInnCampOutToggle',
  // Charactersheet Screen
  'CharacterSheetName', 'CharacterSheetLevel', 'CharacterSheetGold', 'CharacterSheetHealth',
  'CharacterSheetAffiliations', 'CharacterSheetPrimarySkills', 'CharacterSheetMajorSkills',
  'CharacterSheetMinorSkills', 'CharacterSheetMiscSkills', 'CharacterSheetInventory',
  'CharacterSheetSpellbook', 'CharacterSheetLogbook', 'CharacterSheetHistory',
  'CharacterSheetExit',
  // Player History screen
  'HistoryNextPage', 'HistoryPreviousPage', 'HistoryExit',
  // Quest Journal Screen
  'JournalNextCategory', 'JournalNextPage', 'JournalPreviousPage', 'JournalExit',
  // Inventory screen
  'InventoryWeapons', 'InventoryMagic', 'InventoryClothing', 'InventoryIngredients',
  'InventoryWagon', 'InventoryInfo', 'InventoryEquip', 'InventoryRemove',
  'InventoryUse', 'InventoryGold', 'InventoryExit',
  // Merchant menu
  'MerchantRepair', 'MerchantTalk', 'MerchantSell', 'MerchantExit',
  // Trade screen
  'TradeWagon', 'TradeInfo', 'TradeSelect', 'TradeSteal', 'TradeBuy',
  'TradeIdentify', 'TradeRepair', 'TradeSell', 'TradeClear', 'TradeExit',
  // Taverns menu
  'TavernRoom', 'TavernTalk', 'TavernFood', 'TavernExit',
  // Guilds
  'GuildsJoin', 'GuildsTalk', 'GuildsExit', 'GuildsTraining', 'GuildsGetQuest',
  'GuildsRepair', 'GuildsIdentify', 'GuildsDonate', 'GuildsCure', 'GuildsBuyPotions',
  'GuildsMakePotions', 'GuildsBuySpells', 'GuildsMakeSpells', 'GuildsBuyMagicItems',
  'GuildsMakeMagicItems', 'GuildsSellMagicItems', 'GuildsTeleport', 'GuildsDaedraSummon',
  'GuildsSpymaster', 'GuildsBuySoulgems', 'GuildsReceiveArmor', 'GuildsReceiveHouse',
  // Witches Covens
  'WitchesTalk', 'WitchesDaedraSummon', 'WitchesQuest', 'WitchesExit',
  // Spellmaker screen
  'SpellMakerAddEffect', 'SpellMakerBuySpell', 'SpellMakerNewSpell', 'SpellMakerExit',
  'SpellMakerNameSpell', 'SpellMakerTargetCaster', 'SpellMakerTargetTouch',
  'SpellMakerTargetSingleAtRange', 'SpellMakerTargetAroundCaster',
  'SpellMakerTargetAreaAtRange', 'SpellMakerElementFire', 'SpellMakerElementCold',
  'SpellMakerElementPoison', 'SpellMakerElementShock', 'SpellMakerElementMagic',
  'SpellMakerNextIcon', 'SpellMakerPrevIcon', 'SpellMakerSelectIcon',
  // Automap screen
  'AutomapSwitchAutomapGridMode', 'AutomapResetView', 'AutomapResetRotationPivotAxisView',
  'AutomapSwitchFocusToNextBeaconObject', 'AutomapSwitchToNextAutomapRenderMode',
  'AutomapSwitchToAutomapRenderModeCutout', 'AutomapSwitchToAutomapRenderModeWireframe',
  'AutomapSwitchToAutomapRenderModeTransparent', 'AutomapSwitchToAutomapBackgroundOriginal',
  'AutomapSwitchToAutomapBackgroundAlternative1', 'AutomapSwitchToAutomapBackgroundAlternative2',
  'AutomapSwitchToAutomapBackgroundAlternative3', 'AutomapMoveLeft', 'AutomapMoveRight',
  'AutomapMoveForward', 'AutomapMoveBackward', 'AutomapMoveRotationPivotAxisLeft',
  'AutomapMoveRotationPivotAxisRight', 'AutomapMoveRotationPivotAxisForward',
  'AutomapMoveRotationPivotAxisBackward', 'AutomapRotateLeft', 'AutomapRotateRight',
  'AutomapRotateCameraLeft', 'AutomapRotateCameraRight',
  'AutomapRotateCameraOnCameraYZplaneAroundObjectUp',
  'AutomapRotateCameraOnCameraYZplaneAroundObjectDown',
  'AutomapUpstairs', 'AutomapDownstairs', 'AutomapIncreaseSliceLevel',
  'AutomapDecreaseSliceLevel', 'AutomapZoomIn', 'AutomapZoomOut',
  'AutomapIncreaseCameraFieldOfFiew', 'AutomapDecreaseCameraFieldOfFiew',
  // Exterior automap screen
  'ExtAutomapFocusPlayerPosition', 'ExtAutomapResetView',
  'ExtAutomapSwitchToNextExteriorAutomapViewMode',
  'ExtAutomapSwitchToExteriorAutomapViewModeOriginal',
  'ExtAutomapSwitchToExteriorAutomapViewModeExtra',
  'ExtAutomapSwitchToExteriorAutomapViewModeAll',
  'ExtAutomapSwitchToExteriorAutomapBackgroundOriginal',
  'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative1',
  'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2',
  'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative3',
  'ExtAutomapMoveLeft', 'ExtAutomapMoveRight', 'ExtAutomapMoveForward',
  'ExtAutomapMoveBackward', 'ExtAutomapMoveToWestLocationBorder',
  'ExtAutomapMoveToEastLocationBorder', 'ExtAutomapMoveToNorthLocationBorder',
  'ExtAutomapMoveToSouthLocationBorder', 'ExtAutomapRotateLeft', 'ExtAutomapRotateRight',
  'ExtAutomapRotateAroundPlayerPosLeft', 'ExtAutomapRotateAroundPlayerPosRight',
  'ExtAutomapUpstairs', 'ExtAutomapDownstairs', 'ExtAutomapZoomIn', 'ExtAutomapZoomOut',
  'ExtAutomapMaxZoom1', 'ExtAutomapMinZoom1', 'ExtAutomapMinZoom2', 'ExtAutomapMaxZoom2',
]);

/**
 * StreamingAssets/Text/DialogShortcuts.txt, row for row. The file's
 * own '-' comment lines are kept where they stand, and each one
 * explains why the row BELOW it wears an odd letter: Work is J
 * because W is already TalkWhereIs, the character sheet's Level is V
 * because L is already its Logbook, and History is T because H is
 * already its Health. Transcribing those rows to the obvious letter
 * would break three screens at once.
 */
export const SHORTCUT_TEXT = Object.freeze({
  Accept: 'A', Reject: 'R', Cancel: 'C', Yes: 'Y', No: 'N',
  OK: 'O',   // "Will most likely be the default button too"
  Male: 'M', Female: 'F', Add: 'A', Delete: 'D', Edit: 'E', Copy: 'C',
  Guilty: 'G', NotGuilty: 'N', Debate: 'D', Lie: 'L', Anchor: 'A', Teleport: 'T',

  GameSetupPlay: 'P', GameSetupAdvancedSettings: 'A', GameSetupMods: 'M',
  GameSetupClose: 'C', GameSetupBackToOptions: 'O', GameSetupRestart: 'R',
  GameSetupRefresh: 'R', GameSetupSaveAndClose: 'S', GameSetupExit: 'E',

  MainMenuLoad: 'L', MainMenuStart: 'S', MainMenuExit: 'E',

  ResetBonusPool: 'Ctrl-U',

  OptionsExit: 'E', OptionsContinue: 'C', OptionsSave: 'S', OptionsLoad: 'L',
  OptionsControls: 'N', OptionsFullScreen: 'F', OptionsHeadBobbing: 'H',
  OptionsDropdown: 'D',

  Pause: 'Shift-Escape', LargeHUDToggle: 'F10', HUDToggle: 'Shift-F10',
  ToggleRetroPP: 'Shift-F11',

  DebuggerToggle: 'Ctrl-Shift-D',
  DebuggerPrevQuest: 'Ctrl-Shift-LeftArrow', DebuggerNextQuest: 'Ctrl-Shift-RightArrow',
  DebuggerPrevMarker: 'Ctrl-Shift-UpArrow', DebuggerNextMarker: 'Ctrl-Shift-DownArrow',

  RestForAWhile: 'F', RestUntilHealed: 'U', RestLoiter: 'L', RestStop: 'S',

  TransportFoot: 'F', TransportHorse: 'H', TransportCart: 'C',
  TransportShip: 'S', TransportExit: 'E',

  TravelMapFind: 'F', TravelMapList: 'L',

  TalkTellMeAbout: 'A', TalkWhereIs: 'W',
  TalkCategoryLocation: 'L', TalkCategoryPeople: 'P',
  TalkCategoryThings: 'T',
  TalkCategoryWork: 'J',   // the file's own note: W would conflict with TalkWhereIs
  TalkAsk: 'O', TalkExit: 'G', TalkCopy: 'C',
  TalkTonePolite: 'F1', TalkToneNormal: 'F2', TalkToneBlunt: 'F3',

  SpellbookDelete: 'L', SpellbookUp: 'U', SpellbookSort: 'S',
  SpellbookDown: 'D', SpellbookBuy: 'B', SpellbookExit: 'E',

  TravelBegin: 'B', TravelExit: 'E', TravelSpeedToggle: 'S',
  TravelTransportModeToggle: 'T',
  TravelInnCampOutToggle: 'N',   // "N for Nights?"

  CharacterSheetName: 'N',
  CharacterSheetLevel: 'V',   // the file's own note: L would conflict with the Logbook
  CharacterSheetGold: 'G', CharacterSheetHealth: 'H',
  CharacterSheetAffiliations: 'A',
  CharacterSheetPrimarySkills: 'F1', CharacterSheetMajorSkills: 'F2',
  CharacterSheetMinorSkills: 'F3', CharacterSheetMiscSkills: 'F4',
  CharacterSheetInventory: 'I', CharacterSheetSpellbook: 'S',
  CharacterSheetLogbook: 'L',
  CharacterSheetHistory: 'T',   // the file's own note: H would conflict with Health
  CharacterSheetExit: 'E',

  JournalNextCategory: 'N', JournalNextPage: 'DownArrow',
  JournalPreviousPage: 'UpArrow', JournalExit: 'E',

  HistoryNextPage: 'DownArrow', HistoryPreviousPage: 'UpArrow', HistoryExit: 'E',

  InventoryWeapons: 'F1', InventoryMagic: 'F2', InventoryClothing: 'F3',
  InventoryIngredients: 'F4', InventoryWagon: 'W', InventoryInfo: 'I',
  InventoryEquip: 'E', InventoryRemove: 'R', InventoryUse: 'U',
  InventoryGold: 'G', InventoryExit: 'X',

  MerchantRepair: 'R', MerchantTalk: 'T', MerchantSell: 'S', MerchantExit: 'E',

  TradeWagon: 'W', TradeInfo: 'I', TradeSelect: 'S', TradeSteal: 'T',
  TradeBuy: 'B', TradeIdentify: 'D', TradeRepair: 'R', TradeSell: 'L',
  TradeClear: 'C', TradeExit: 'X',

  TavernRoom: 'R', TavernTalk: 'T', TavernFood: 'F', TavernExit: 'G',

  GuildsJoin: 'J', GuildsTalk: 'T', GuildsExit: 'E', GuildsTraining: 'R',
  GuildsGetQuest: 'G', GuildsRepair: 'R', GuildsIdentify: 'I', GuildsDonate: 'D',
  GuildsCure: 'C', GuildsBuyPotions: 'B', GuildsMakePotions: 'M',
  GuildsBuySpells: 'B', GuildsMakeSpells: 'M', GuildsBuyMagicItems: 'B',
  GuildsMakeMagicItems: 'M', GuildsSellMagicItems: 'S', GuildsTeleport: 'L',
  GuildsDaedraSummon: 'D', GuildsSpymaster: 'S', GuildsBuySoulgems: 'B',
  GuildsReceiveArmor: 'R', GuildsReceiveHouse: 'R',

  WitchesTalk: 'T', WitchesDaedraSummon: 'D', WitchesQuest: 'Q', WitchesExit: 'E',

  SpellMakerAddEffect: 'A', SpellMakerBuySpell: 'B', SpellMakerNewSpell: 'W',
  SpellMakerExit: 'E', SpellMakerNameSpell: 'N',
  SpellMakerTargetCaster: 'Shift-C', SpellMakerTargetTouch: 'Shift-T',
  SpellMakerTargetSingleAtRange: 'Shift-S', SpellMakerTargetAroundCaster: 'Shift-A',
  SpellMakerTargetAreaAtRange: 'Shift-R',
  SpellMakerElementFire: 'Ctrl-F', SpellMakerElementCold: 'Ctrl-C',
  SpellMakerElementPoison: 'Ctrl-P', SpellMakerElementShock: 'Ctrl-S',
  SpellMakerElementMagic: 'Ctrl-M',
  SpellMakerNextIcon: 'F1', SpellMakerPrevIcon: 'F2', SpellMakerSelectIcon: 'I',

  AutomapSwitchAutomapGridMode: 'Space',
  AutomapResetView: 'Backspace',
  AutomapResetRotationPivotAxisView: 'Ctrl-Backspace',
  AutomapSwitchFocusToNextBeaconObject: 'Tab',
  AutomapSwitchToNextAutomapRenderMode: 'Return',
  AutomapSwitchToAutomapRenderModeCutout: 'F2',
  AutomapSwitchToAutomapRenderModeWireframe: 'F3',
  AutomapSwitchToAutomapRenderModeTransparent: 'F4',
  AutomapSwitchToAutomapBackgroundOriginal: 'F5',
  AutomapSwitchToAutomapBackgroundAlternative1: 'F6',
  AutomapSwitchToAutomapBackgroundAlternative2: 'F7',
  AutomapSwitchToAutomapBackgroundAlternative3: 'F8',
  AutomapMoveLeft: 'LeftArrow', AutomapMoveRight: 'RightArrow',
  AutomapMoveForward: 'UpArrow', AutomapMoveBackward: 'DownArrow',
  AutomapMoveRotationPivotAxisLeft: 'Ctrl-LeftArrow',
  AutomapMoveRotationPivotAxisRight: 'Ctrl-RightArrow',
  AutomapMoveRotationPivotAxisForward: 'Ctrl-UpArrow',
  AutomapMoveRotationPivotAxisBackward: 'Ctrl-DownArrow',
  AutomapRotateLeft: 'Alt-LeftArrow', AutomapRotateRight: 'Alt-RightArrow',
  AutomapRotateCameraLeft: 'Shift-LeftArrow', AutomapRotateCameraRight: 'Shift-RightArrow',
  AutomapRotateCameraOnCameraYZplaneAroundObjectUp: 'Shift-UpArrow',
  AutomapRotateCameraOnCameraYZplaneAroundObjectDown: 'Shift-DownArrow',
  AutomapUpstairs: 'PageUp', AutomapDownstairs: 'PageDown',
  AutomapIncreaseSliceLevel: 'Ctrl-PageUp', AutomapDecreaseSliceLevel: 'Ctrl-PageDown',
  AutomapZoomIn: 'KeypadPlus', AutomapZoomOut: 'KeypadMinus',
  AutomapIncreaseCameraFieldOfFiew: 'KeypadMultiply',
  AutomapDecreaseCameraFieldOfFiew: 'KeypadDivide',

  ExtAutomapFocusPlayerPosition: 'Tab',
  ExtAutomapResetView: 'Backspace',
  ExtAutomapSwitchToNextExteriorAutomapViewMode: 'Return',
  ExtAutomapSwitchToExteriorAutomapViewModeOriginal: 'F2',
  ExtAutomapSwitchToExteriorAutomapViewModeExtra: 'F3',
  ExtAutomapSwitchToExteriorAutomapViewModeAll: 'F4',
  ExtAutomapSwitchToExteriorAutomapBackgroundOriginal: 'F5',
  ExtAutomapSwitchToExteriorAutomapBackgroundAlternative1: 'F6',
  ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2: 'F7',
  ExtAutomapSwitchToExteriorAutomapBackgroundAlternative3: 'F8',
  ExtAutomapMoveLeft: 'LeftArrow', ExtAutomapMoveRight: 'RightArrow',
  ExtAutomapMoveForward: 'UpArrow', ExtAutomapMoveBackward: 'DownArrow',
  ExtAutomapMoveToWestLocationBorder: 'Shift-LeftArrow',
  ExtAutomapMoveToEastLocationBorder: 'Shift-RightArrow',
  ExtAutomapMoveToNorthLocationBorder: 'Shift-UpArrow',
  ExtAutomapMoveToSouthLocationBorder: 'Shift-DownArrow',
  ExtAutomapRotateLeft: 'Ctrl-LeftArrow', ExtAutomapRotateRight: 'Ctrl-RightArrow',
  ExtAutomapRotateAroundPlayerPosLeft: 'Alt-LeftArrow',
  ExtAutomapRotateAroundPlayerPosRight: 'Alt-RightArrow',
  ExtAutomapUpstairs: 'PageUp', ExtAutomapDownstairs: 'PageDown',
  ExtAutomapZoomIn: 'KeypadPlus', ExtAutomapZoomOut: 'KeypadMinus',
  ExtAutomapMaxZoom1: 'Ctrl-PageUp', ExtAutomapMinZoom1: 'Ctrl-PageDown',
  ExtAutomapMinZoom2: 'Ctrl-KeypadPlus', ExtAutomapMaxZoom2: 'Ctrl-KeypadMinus',
});

// CheckLoaded's lazy dictionary (:307-326) - built once, on first read.
let _keys = null;
function checkLoaded() {
  if (_keys) return _keys;
  _keys = new Map();
  for (const button of BUTTONS) {
    const text = SHORTCUT_TEXT[button];
    if (text === undefined) continue;   // DFU's "no <button> entry" log
    _keys.set(button, fromString(text));
  }
  return _keys;
}

/** DaggerfallShortcut.GetBinding (:328-335): a button with no table
 *  row answers HotkeySequence.None, never throws.
 *
 *  NAMED FOR ITS CLASS, not for the member: InputManager.GetBinding is
 *  a DIFFERENT DFU member (an action's key code) and the port already
 *  exports it from inputActions.js. Two homes for one name is the
 *  thing the one-home rule exists to catch, so the shortcut half
 *  carries its class into its name rather than sitting on the
 *  homonym list. */
export function shortcutBinding(button) {
  return checkLoaded().get(button) ?? HOTKEY_NONE;
}

/**
 * THE PORT'S ONE ADAPTER, and the reason a shortcut table can be
 * wired at all here. DFU's windows read the keyboard directly; the
 * port's windows are handed a code by their host, and the two hosts
 * speak DIFFERENT alphabets - a native window gets the raw `e.code`,
 * the dungeon's overlay seam gets the 'char:<k>' action ui/input.js
 * builds (input.js:228-244, the mangling restWindow's toggle-close
 * reads back through this function at restWindow.js:266-268). Both
 * resolve to one browser code here so a window asks the table once and
 * works under either host.
 */
export function normalizeCode(code, e = null) {
  if (typeof code !== 'string') return null;
  if (code.startsWith('char:')) {
    const ch = code.slice(5);
    if (/^[A-Za-z]$/.test(ch)) return `Key${ch.toUpperCase()}`;
    if (/^[0-9]$/.test(ch)) return `Digit${ch}`;
    if (ch === ' ') return 'Space';
    return null;
  }
  if (code === 'confirm') return 'Enter';
  if (code === 'back') return 'Escape';
  if (code === 'up') return 'ArrowUp';
  if (code === 'down') return 'ArrowDown';
  if (code === 'backspace') return 'Backspace';
  if (e && code === 'char') return null;
  return code;
}

/**
 * Button.ProcessHotkeySequences (:79-90) reduced to the one question
 * a port window can ask: did THIS key event fire this button's
 * shortcut? DFU splits down/up (the KeyDown arm fakes a mouse click);
 * the port's windows are called on key DOWN only, which is the
 * `isDownWith` half.
 *
 * `keys` is the host's held-keys Set when it has one - it supplies the
 * left/right modifier sides a KeyboardEvent cannot.
 */
export function hotkeyHit(button, code, e = null, keys = null) {
  const seq = shortcutBinding(button);
  if (!seq.code) return false;
  if (normalizeCode(code, e) !== seq.code) return false;
  return checkSetModifiers(keyboardModifiers(e, keys), seq.modifiers);
}

/** The same question for a whole row of buttons: the FIRST that hits,
 *  or null. Panel.ProcessHotkeySequences walks its buttons in order
 *  and returns on the first Handled (:215-235), so a screen carrying
 *  two rows on one letter resolves the same way twice. */
export function firstHotkey(buttons, code, e = null, keys = null) {
  for (const b of buttons) if (hotkeyHit(b, code, e, keys)) return b;
  return null;
}
