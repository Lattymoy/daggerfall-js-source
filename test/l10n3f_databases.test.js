// L10N3f (2026-09-28): DFU'S TEXT DATABASES FROM A PACK - the Table-format files under StreamingAssets/Text that
// TextManager reads by name (GetText / HasText, "schema: *key,text", '-' comments). A pack installs its own over
// DFU's. Pinned through the port's real functions and windows, over made-up French rows in the pack's format:
//  - the reader: HasText, GetText and its error string, a file that will not parse, English holding none;
//  - DialogShortcuts (DaggerfallShortcut.cs): the pack's file replaces the table whole - in French Yes is O - and the
//    yes/no box and the controls windows' prompts answer to its letters, their buttons to a click in any language;
//  - GameSettings: the controls grid's primary/secondary, the joystick window's words (and the checkbox hit rect the
//    word it shows), the enhanced pane's toggle.
// English is byte for byte what the windows showed and answered before.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { PACK_KIND } from '../src/systems/translationPacks.js';
import { textDatabase, hasDatabase, hasText, getText, databaseText, gameSettingsText, TEXT_NOT_FOUND } from '../src/systems/textDatabases.js';
import { shortcutBinding, hotkeyHit, fromString, BUTTONS, SHORTCUT_TEXT, HOTKEY_NONE, SHORTCUT_DATABASE } from '../src/systems/dialogShortcuts.js';
import { YesNoBoxWindow } from '../src/ui/yesNoBox.js';
import { ControlsWindow, preloadControlsArt } from '../src/ui/controlsWindow.js';
import { MouseControlsWindow, PROMPT_YES, PROMPT_NO, promptAnswer } from '../src/ui/mouseControlsWindow.js';
import { JoystickControlsWindow, createJoystickUnsaved, AXIS_ROWS, UI_ROWS, JOY_SLIDERS, ENABLE_BOX, TITLE, UI_KEYS } from '../src/ui/joystickControlsWindow.js';
import { paneControls, discardControlsStaging, controlsStaging } from '../src/ui/enhancedControls.js';
import { layoutMessageBox, MB_BUTTONS } from '../src/ui/messageBox.js';
import { createUnsavedKeybinds, currentDict } from '../src/systems/controlsConfig.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';
import { setBindings } from '../src/ui/input.js';
import { measureText } from '../src/ui/text.js';
import { _resetForTests } from '../src/systems/settings.js';

beforeEach(() => { tm._resetTextManagerForTests(); _resetForTests(); });

const said = (fn, method = 'log') => {
  const lines = [];
  const orig = console[method];
  console[method] = (...a) => lines.push(a.join(' '));
  try { fn(); } finally { console[method] = orig; }
  return lines;
};
/** A pack's text tables for French, and French chosen. */
const frDatabases = (tables) => {
  tm.setLocaleDocuments('fr', Object.entries(tables).map(([name, text]) => [`${PACK_KIND.TEXT_TABLE}:${name}`, text]));
  tm.setLocale('fr');
};

// Made-up rows in the pack's format: a comment, the schema, padded columns, a '--' heading, an inline comment.
const FR_SHORTCUTS = [
  '- Raccourcis des boites de dialogue (inventes pour le test)',
  '',
  'schema: *key,text',
  '',
  'Accept,               A',
  'Yes,                  O',
  'No,                   N',
  'OK,                   K',
  '-- Ecran de repos',
  'RestForAWhile,        P      // Pause',
  'SpellMakerTargetCaster, Shift-L',
].join('\r\n');
const FR_GAME_SETTINGS = [
  '- Parametres (inventes pour le test)',
  'schema: *key,text',
  'primary,                   Principal',
  'secondary,                 Secondaire',
  'configureJoystickControls, Configurer la manette',
  'continue,                  POURSUIVRE',
  'movementH,                 Deplacement H.',
  'movementV,                 Deplacement V.',
  'cameraH,                   Vue H.',
  'cameraV,                   Vue V.',
  'invert,                    Inverser',
  'leftClickString,           Clic-gauche',
  'middleClickString,         Clic-milieu',
  'rightClickString,          Clic-droit',
  'backString,                Retour',
  'lookSensitivity,           Sensibilite vue',
  'uiMouseSensitivity,        Sensibilite souris IU',
  'maximumMovementThreshold,  Seuil de mouvement',
  'deadzone,                  Zone morte',
  'enableController,          Activer la manette',
].join('\n');

test('L10N3f text databases: DFU\'s Table over a pack\'s Text/<db>.txt - HasText, GetText and its error string; English holds none; a file that will not parse is none', () => {
  assert.equal(textDatabase('GameSettings'), null, 'English: the words are the code\'s, no database is read');
  assert.equal(hasDatabase('GameSettings'), false);
  assert.equal(getText('GameSettings', 'primary'), TEXT_NOT_FOUND);
  assert.equal(TEXT_NOT_FOUND, '<TextError-NotFound>', 'TextManager.cs:249');
  assert.equal(databaseText('GameSettings', 'primary', 'Primary'), 'Primary', 'English: the port\'s own word');

  frDatabases({ GameSettings: FR_GAME_SETTINGS, DialogShortcuts: FR_SHORTCUTS, Broken: 'no schema here\nprimary, Principal' });
  assert.equal(hasDatabase('GameSettings'), true);
  assert.equal(hasText('GameSettings', 'primary'), true);
  assert.equal(getText('GameSettings', 'configureJoystickControls'), 'Configurer la manette', 'a value trimmed of its padding');
  assert.equal(getText('DialogShortcuts', 'RestForAWhile'), 'P', 'an inline // comment is cut (Table.cs:167-171)');
  assert.equal(hasText('DialogShortcuts', 'Rest menu'), false, 'a -- line is a comment');
  assert.equal(hasText('GameSettings', 'meleeAttacks'), false);
  assert.equal(getText('GameSettings', 'meleeAttacks'), TEXT_NOT_FOUND, 'a key the pack\'s file lacks is not there: its file IS the database');
  assert.equal(databaseText('GameSettings', 'meleeAttacks', 'Melee Attacks'), 'Melee Attacks', 'the port shows its English there, not the error string');
  assert.equal(hasText('gamesettings', 'primary'), false, 'a database is its file name, exactly (a Dictionary key)');
  const lines = said(() => assert.equal(textDatabase('Broken'), null));
  assert.deepEqual(lines, ['TextManager unable to parse text database table Broken with exception message Schema not found in source table.'], 'EnumerateTextDatabases\' catch (:714-718)');
  tm.setLocale('fr-CA');
  assert.equal(gameSettingsText('primary', 'Primary'), 'Principal', 'the locale chain: fr-CA reads fr\'s pack');
  tm.setLocale('en');
  assert.equal(gameSettingsText('primary', 'Primary'), 'Primary', 'English again');
});

test('L10N3f shortcuts: a pack\'s DialogShortcuts.txt replaces the table whole - in French Yes is O; a button its file lacks has no hotkey; English is the shipped table', () => {
  assert.equal(SHORTCUT_DATABASE, 'DialogShortcuts');
  const english = BUTTONS.map((b) => shortcutBinding(b));
  assert.deepEqual(english, BUTTONS.map((b) => fromString(SHORTCUT_TEXT[b])), 'English: DialogShortcuts.txt as the port carries it');
  assert.equal(shortcutBinding('Yes').code, 'KeyY');

  frDatabases({ DialogShortcuts: FR_SHORTCUTS });
  assert.deepEqual(shortcutBinding('Yes'), fromString('O'));
  assert.deepEqual(shortcutBinding('OK'), fromString('K'));
  assert.deepEqual(shortcutBinding('SpellMakerTargetCaster'), fromString('Shift-L'));
  assert.deepEqual(shortcutBinding('RestForAWhile'), fromString('P'));
  assert.equal(shortcutBinding('Cancel'), HOTKEY_NONE, 'no row: no hotkey (CheckLoaded :318-323) - never the English C');
  assert.equal(shortcutBinding('TalkExit'), HOTKEY_NONE);
  assert.equal(hotkeyHit('Yes', 'KeyO'), true);
  assert.equal(hotkeyHit('Yes', 'KeyY'), false);
  assert.equal(hotkeyHit('Yes', 'char:o'), true, 'the dungeon host\'s alphabet too');

  // the yes/no box (DaggerfallMessageBox's YesNo) answers to them
  const answers = [];
  const box = () => new YesNoBoxWindow({ rows: ['Propriete privee ?'], onYes: () => answers.push('yes'), onNo: () => answers.push('no') });
  let b = box(); b.input('KeyY'); assert.equal(b.done, false, 'Y is nothing in French');
  b.input('KeyO'); assert.deepEqual(answers, ['yes']);
  b = box(); b.input('KeyN'); assert.deepEqual(answers, ['yes', 'no']);

  // a pack whose file will not parse is no database: the game's own table stands
  frDatabases({ DialogShortcuts: 'Yes, O' });
  said(() => assert.equal(shortcutBinding('Yes').code, 'KeyY'));
  frDatabases({ DialogShortcuts: FR_SHORTCUTS });
  assert.equal(shortcutBinding('Yes').code, 'KeyO', 'read again when its source changes');
  tm.setLocale('en');
  assert.deepEqual(BUTTONS.map((x) => shortcutBinding(x)), english, 'English again');
  b = box(); b.input('KeyY'); assert.deepEqual(answers, ['yes', 'no', 'yes']);
});

const freshStore = () => { const b = createBindings(); resetDefaults(b); setBindings(b); return b; };
const FONT = { tex: null, fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 } };
/** The prompt box's Yes button, clicked where it is laid out (the call the window's own draw makes). */
const clickYes = (w, rows) => {
  w._box = layoutMessageBox(FONT, rows, [MB_BUTTONS.Yes, MB_BUTTONS.No]);
  const [x, y] = w._box.buttons.find((btn) => btn.button === MB_BUTTONS.Yes).rect;
  w.click(x + 1, y + 1);
};

test('L10N3f shortcuts: the controls windows\' prompts answer to the table\'s Yes and No (DaggerfallMessageBox :377); their buttons answer a click in any language', () => {
  assert.equal(promptAnswer('KeyY'), 'yes');
  assert.equal(promptAnswer('KeyN'), 'no');
  assert.equal(promptAnswer(PROMPT_YES), 'yes');
  assert.equal(promptAnswer(PROMPT_NO), 'no');
  // the button's HotkeySequence, modifiers and all: no OTHER virtual modifier may be down (CheckSetModifiers, :158-162)
  assert.equal(promptAnswer('KeyY', { shiftKey: true }), null);
  assert.equal(promptAnswer('KeyN', { ctrlKey: true }), null);
  const store = freshStore();
  const bound = (w, action) => currentDict(w.unsaved).get(action) != null;
  // English: Y and N, as the grid always read them
  let cw = new ControlsWindow({});
  cw.top = 'remove'; cw._removeAction = 'AutoRun';
  cw.input('KeyN');
  assert.equal(cw.top, null);
  assert.equal(bound(cw, 'AutoRun'), true, 'No keeps it');
  cw.top = 'remove'; cw._removeAction = 'AutoRun';
  cw.input('KeyY');
  assert.equal(bound(cw, 'AutoRun'), false, 'Yes removes it');

  frDatabases({ DialogShortcuts: FR_SHORTCUTS });
  cw = new ControlsWindow({});
  cw.top = 'remove'; cw._removeAction = 'AutoRun';
  cw.input('KeyY');
  assert.equal(cw.top, 'remove', 'Y answers nothing in French');
  assert.equal(bound(cw, 'AutoRun'), true);
  cw.input('KeyO');
  assert.equal(cw.top, null);
  assert.equal(bound(cw, 'AutoRun'), false, 'O is Oui');
  cw.top = 'defaults';
  cw.input('KeyN');
  assert.equal(cw.top, null, 'N is Non');
  cw.top = 'remove'; cw._removeAction = 'Jump';
  clickYes(cw, cw.promptRows());
  assert.equal(bound(cw, 'Jump'), false, 'the Yes button, clicked');

  const mw = new MouseControlsWindow(createUnsavedKeybinds(store));
  mw.top = 'remove'; mw._removeAction = 'QuickSave';
  mw.input('KeyY');
  assert.equal(bound(mw, 'QuickSave'), true, 'the ADVANCED window: Y is nothing in French');
  mw.input('KeyO');
  assert.equal(mw.top, null);
  assert.equal(bound(mw, 'QuickSave'), false);
  mw.top = 'remove'; mw._removeAction = 'QuickLoad';
  clickYes(mw, ['?']);
  assert.equal(bound(mw, 'QuickLoad'), false, 'its Yes button, clicked');
  mw.dispose();
});

// ── GameSettings on the controls windows ─────────────────────────────────────────────────────────────────────────────

const CANVAS = { width: 320, height: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }) };
const renderer = () => ({ screenOffset: [0, 0], uploadTexture: () => ({}), drawScreenQuad() {} });
/** The classic font, recording every glyph it measures or draws, so a window's painted words read back (a space
 *  advances without a glyph). */
const spyFont = () => {
  const chars = [];
  return { font: { tex: null, fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + 33)); return 5; } } }, painted: () => chars.join('') };
};
const paints = (w, text) => { const s = spyFont(); w.draw(renderer(), CANVAS, s.font); return s.painted().includes(text.replaceAll(' ', '')); };

/** Every GameSettings word the joystick window shows: [its English, the made-up French]. */
const JOY_WORDS = [
  ['Configure Joystick Controls', 'Configurer la manette'], ['CONTINUE', 'POURSUIVRE'],
  ['Movement H.', 'Deplacement H.'], ['Movement V.', 'Deplacement V.'], ['Camera H.', 'Vue H.'], ['Camera V.', 'Vue V.'],
  ['Invert', 'Inverser'], ['Left-Click', 'Clic-gauche'], ['Middle-Click', 'Clic-milieu'], ['Right-Click', 'Clic-droit'], ['Back', 'Retour'],
  ['Look Sensitivity', 'Sensibilite vue'], ['UI Mouse Sensitivity', 'Sensibilite souris IU'], ['Maximum Movement Threshold', 'Seuil de mouvement'],
  ['Deadzone', 'Zone morte'], ['Enable Controller', 'Activer la manette'],
];
const joyLabels = () => [AXIS_ROWS.map((r) => r.label), AXIS_ROWS.map((r) => r.invert.label), UI_ROWS.map((r) => r.label), JOY_SLIDERS.map((s) => s.label), ENABLE_BOX.label];

test('L10N3f GameSettings: the joystick window\'s words are GameSettings\' (DaggerfallJoystickControlsWindow.cs:128-167, :296-303), read where drawn - English byte for byte, a pack\'s in French; the staging keys never move', () => {
  const store = freshStore();
  const english = joyLabels();
  assert.deepEqual(english, [
    ['Movement H.', 'Movement V.', 'Camera H.', 'Camera V.'], ['Invert', 'Invert', 'Invert', 'Invert'],
    ['Left-Click', 'Middle-Click', 'Right-Click', 'Back'], ['Look Sensitivity', 'UI Mouse Sensitivity', 'Maximum Movement Threshold', 'Deadzone'], 'Enable Controller',
  ]);
  assert.equal(TITLE, 'Configure Joystick Controls');
  const w = new JoystickControlsWindow(createJoystickUnsaved(store));
  for (const [en] of JOY_WORDS) assert.ok(paints(w, en), `English paints "${en}"`);
  const fnt = { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 };
  const enWidth = JoystickControlsWindow.checkboxRect(ENABLE_BOX, fnt)[2];

  frDatabases({ GameSettings: FR_GAME_SETTINGS });
  assert.deepEqual(joyLabels(), [
    ['Deplacement H.', 'Deplacement V.', 'Vue H.', 'Vue V.'], ['Inverser', 'Inverser', 'Inverser', 'Inverser'],
    ['Clic-gauche', 'Clic-milieu', 'Clic-droit', 'Retour'], ['Sensibilite vue', 'Sensibilite souris IU', 'Seuil de mouvement', 'Zone morte'], 'Activer la manette',
  ]);
  for (const [en, fr] of JOY_WORDS) {
    assert.ok(paints(w, fr), `French paints "${fr}"`);
    assert.equal(paints(w, en), false, `and not "${en}"`);
  }
  assert.equal(JoystickControlsWindow.checkboxRect(ENABLE_BOX, fnt)[2], enWidth - measureText(fnt, 'Enable Controller') + measureText(fnt, 'Activer la manette'),
    'the checkbox is as wide as the word it shows (Checkbox.cs:103-105)');
  assert.deepEqual({ ...UI_KEYS }, { LeftClick: 'Left-Click', MiddleClick: 'Middle-Click', RightClick: 'Right-Click', Back: 'Back' }, 'the staging keys: "do not translate" (:32-35)');
  assert.deepEqual([...w.unsaved.keybinds.keys()].slice(0, 4).sort(), ['Back', 'Left-Click', 'Middle-Click', 'Right-Click'], 'staged under them in French too');

  tm.setLocale('en');
  assert.deepEqual(joyLabels(), english, 'English again');
  for (const [en] of JOY_WORDS) assert.ok(paints(w, en));
});

test('L10N3f GameSettings: the grid\'s primary/secondary face (DaggerfallControlsWindow.cs:139, :252) and the enhanced pane\'s toggle read the pack\'s words; English is the port\'s, byte for byte', async () => {
  freshStore();
  const quiet = console.warn; console.warn = () => {};
  try { await preloadControlsArt({ renderer: renderer(), fetchBytes: async (n) => { if (n === 'CNFG00I0.IMG') return new Uint8Array(64000); throw new Error(n); } }); } finally { console.warn = quiet; }
  const cw = new ControlsWindow({});
  assert.ok(paints(cw, 'PRIMARY'), 'English: the port\'s own upper case (DFU\'s row reads "Primary")');
  cw.unsaved.usingPrimary = false;
  assert.ok(paints(cw, 'SECONDARY'));

  // the enhanced pane, over a fake document
  const fakeEl = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {}, onclick: null,
      append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } }, setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, removeEventListener() {} };
    return n;
  };
  const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) find(c, cls, out); return out; };
  const toggle = () => {
    const body = fakeEl('div');
    paneControls(body, { render() {} });
    return find(body, 'ctl-which')[0];
  };
  discardControlsStaging();
  globalThis.document = { createElement: fakeEl, addEventListener() {}, removeEventListener() {} };
  try {
    assert.equal(toggle().textContent, 'Primary', 'English: DFU\'s own word');
    frDatabases({ GameSettings: FR_GAME_SETTINGS });
    assert.ok(paints(cw, 'Secondaire'));
    cw.unsaved.usingPrimary = true;
    assert.ok(paints(cw, 'Principal'));
    assert.equal(paints(cw, 'PRIMARY'), false);
    assert.equal(toggle().textContent, 'Principal');
    controlsStaging().usingPrimary = false;
    assert.equal(toggle().textContent, 'Secondaire');
    tm.setLocale('en');
    assert.ok(paints(cw, 'PRIMARY'), 'English again');
    assert.equal(toggle().textContent, 'Secondary', 'English again');
    controlsStaging().usingPrimary = true;
    assert.equal(toggle().textContent, 'Primary');
  } finally { discardControlsStaging(); delete globalThis.document; }
});
