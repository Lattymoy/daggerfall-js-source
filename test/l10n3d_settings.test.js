// L10N3d (2026-09-27): THE SETTINGS AND CONTROLS WINDOWS IN THE PLAYER'S LANGUAGE - DFU's own words on them, read
// through the text core where DFU reads them, each through the port's real function. Pinned, with a French pack's rows
// laid over English and English checked before French is chosen and after:
//  - the enum rows DFU words through its tables (DaggerfallAdvancedSettingsWindow's TextSettings lists,
//    RetroModeConfigPage's Internal_Strings) show the pack's word BY DFU'S KEY, while the law under them - values,
//    order, stepping - never moves; the rows whose words are the port's own show them whatever the pack carries;
//  - the five settings labels that are DFU's words, and the retro row's tip;
//  - the advanced (mouse) controls window: title, CONTINUE, the six keybind faces by action name, the sliders' labels
//    and choice lists, the checkboxes (whose hit rect is the label they show) and the threshold field;
//  - the grid's and the joystick window's prompts, the remove prompt's pattern (formatted, and broken into the box's
//    two rows before the word that leads into the action), and the enhanced pane's refusal and defaults prompt.
// English is byte for byte what the screens showed before the words were routed.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { ENUM_LAW, enumWords, formatValue, stepValue } from '../src/ui/settingsLaw.js';
import { LABELS, labelOf, helpOf } from '../src/ui/settingsCopy.js';
import {
  MouseControlsWindow, KEYBIND_ROWS, KEYBIND_LABELS, SLIDERS, CHECKBOXES, THRESHOLD, SMOOTHING_STRENGTHS, WEAPON_SWING_MODES,
  CHECK_SIZE, CHECK_TEXT_OFFSET,
} from '../src/ui/mouseControlsWindow.js';
import { JoystickControlsWindow, createJoystickUnsaved } from '../src/ui/joystickControlsWindow.js';
import { ControlsWindow } from '../src/ui/controlsWindow.js';
import { paneControls, discardControlsStaging, MULTIPLE_ASSIGNMENTS, DEFAULTS_PROMPT } from '../src/ui/enhancedControls.js';
import { createUnsavedKeybinds, removeKeybindPromptRows, splitCamel, buttonText } from '../src/systems/controlsConfig.js';
import { createBindings, resetDefaults, setBinding, comboCode, getBinding } from '../src/systems/inputActions.js';
import { setBindings } from '../src/ui/input.js';
import { indicatorText } from '../src/ui/horizontalSlider.js';
import { measureText } from '../src/ui/text.js';
import { _resetForTests } from '../src/systems/settings.js';

beforeEach(() => { tm._resetTextManagerForTests(); _resetForTests(); });

const freshStore = () => { const b = createBindings(); resetDefaults(b); setBindings(b); return b; };
const CANVAS = { width: 320, height: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }) };
const renderer = () => ({ screenOffset: [0, 0], uploadTexture: () => ({}), drawScreenQuad() {} });
/** The classic font, recording every glyph it is asked for - measured or drawn - so a window's painted words can be
 *  read back (spaces advance without a glyph, so they are not in the stream). */
const spyFont = () => {
  const chars = [];
  return { font: { tex: null, fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + 33)); return 5; } } },
    painted: () => chars.join('') };
};
const unspaced = (s) => s.replaceAll(' ', '');
const paints = (w, text) => { const s = spyFont(); w.draw(renderer(), CANVAS, s.font); return s.painted().includes(unspaced(text)); };

// ── the settings screen ──────────────────────────────────────────────────────────────────────────────────────────────

/** The enum rows DFU words through its text tables: the ini key, the table, and DFU's key - a list's one key, or a
 *  key a value. */
const WORDED = [
  ['Video/RandomDungeonTextures', 'Internal_Settings', 'dungeonTextureModes'],
  ['Video/QualityLevel', 'Internal_Settings', 'qualitySettings'],
  ['Video/MainFilterMode', 'Internal_Settings', 'filterModes'],
  ['GUI/GUIFilterMode', 'Internal_Settings', 'filterModes'],
  ['GUI/VideoFilterMode', 'Internal_Settings', 'filterModes'],
  ['GUI/HelmAndShieldMaterialDisplay', 'Internal_Settings', 'helmAndShieldMaterialDisplay'],
  ['Video/RetroRenderingMode', 'Internal_Strings', ['retroModeOff', 'retroMode320x200', 'retroMode640x400']],
  ['Video/PostProcessingInRetroMode', 'Internal_Strings', ['off', 'posterizationFull', 'posterizationMinusSky', 'palettizationFull', 'palettizationMinusSky']],
  ['Video/RetroModeAspectCorrection', 'Internal_Strings', ['off', 'FourThree', 'SixteenTen']],
];
/** A pack's word for value `i` of a worded row. */
const frWord = (keys, i) => (Array.isArray(keys) ? `fr:${keys[i]}` : `fr:${keys}:${i}`);
const shown = (key) => ENUM_LAW[key].values.map((_, i) => formatValue(key, String(i)));

test('L10N3d settings: an enum row DFU words through its tables shows a translation\'s word, read by DFU\'s key when it is drawn - and English is its law\'s words, byte for byte, before and after', () => {
  const english = Object.fromEntries(WORDED.map(([key]) => [key, shown(key)]));
  for (const [key] of WORDED) {
    assert.deepEqual(english[key], [...ENUM_LAW[key].values], `${key}: English shows the law's words`);
    assert.deepEqual([...enumWords(key)], [...ENUM_LAW[key].values], `${key}: its words' English is its law's`);
  }
  for (const [key, table, keys] of WORDED) {
    tm.patchLocaleTable('fr', table, Array.isArray(keys) ? keys.map((k, i) => [k, frWord(keys, i)])
      : [[keys, ENUM_LAW[key].values.map((_, i) => frWord(keys, i)).join('\n')]]);
  }
  for (const [key] of WORDED) assert.deepEqual(shown(key), english[key], `${key}: English stands until French is chosen`);
  tm.setLocale('fr');
  for (const [key, , keys] of WORDED) {
    assert.deepEqual(shown(key), ENUM_LAW[key].values.map((_, i) => frWord(keys, i)), `${key} reads the pack's words`);
    assert.equal(stepValue(key, '0', 1), '1', `${key}: the store still holds an index`);
  }
  assert.deepEqual(ENUM_LAW['Video/QualityLevel'].values, ['Fastest', 'Fast', 'Simple', 'Good', 'Beautiful', 'Fantastic'], 'the law is not the words');
  assert.equal(formatValue('Video/RetroModeAspectCorrection', '1'), 'fr:FourThree', 'FourThree by its own key - English "4:3", DFU\'s shipped word');
  tm.setLocale('en');
  for (const [key] of WORDED) assert.deepEqual(shown(key), english[key], `${key}: English again`);
});

test('L10N3d settings: a pack\'s list shorter than the law leaves the rest in the law\'s words; a row whose words are the port\'s own keeps them whatever the pack carries (DFU\'s lists there say other things)', () => {
  tm.patchLocaleTable('fr', 'Internal_Settings', [
    ['qualitySettings', 'Le plus rapide\nRapide\nSimple'],
    ['cameraRecoilStrengths', 'Désactivé\nFaible (25%)\nMoyen (50%)\nÉlevé (75%)\nT. élevé (100%)'],
    ['weaponSwingModes', 'Classique\nClic\nMaintien'],
    ['meleeAttackDetectionModes', 'Performance\nQualité'],
  ]);
  tm.setLocale('fr');
  assert.equal(formatValue('Video/QualityLevel', '1'), 'Rapide');
  assert.equal(formatValue('Video/QualityLevel', '5'), 'Fantastic', 'no line for it: the law\'s word');
  assert.deepEqual(shown('Controls/CameraRecoilStrength'), ['Off', 'Low', 'Medium', 'High', 'Very High']);
  assert.deepEqual(shown('Controls/WeaponSwingMode'), ['Gesture', 'Click', 'Click or Hold']);
  assert.deepEqual(shown('MeleeAttacks/MeleeAttackDetection'), ['Performance', 'Quality']);
  assert.deepEqual(shown('Controls/Handedness'), ['Right Hand', 'Left Hand']);
});

test('L10N3d settings: the labels that are DFU\'s words, and the retro row\'s tip, read a translation by DFU\'s key; every other label stays the port\'s own', () => {
  const DFU_WORDED = {
    'Effects/DepthOfFieldFocusDistance': 'focusDistance', 'Effects/DepthOfFieldAperture': 'aperture',
    'Effects/DepthOfFieldFocalLength': 'focalLength', 'Effects/DepthOfFieldEnable': 'depthOfField', 'Effects/MotionBlurEnable': 'motionBlur',
  };
  const TIP = 'Renders world at lower resolutions';
  for (const k of Object.keys(DFU_WORDED)) assert.equal(labelOf(k), LABELS[k], `${k}: English is the screen's label`);
  assert.equal(labelOf('Effects/DepthOfFieldEnable'), 'Depth Of Field', 'the screen\'s Title Case, not the CSV\'s "Depth of Field"');
  assert.equal(helpOf('Video/RetroRenderingMode'), TIP);
  tm.patchLocaleTable('fr', 'Internal_Strings', [...Object.values(DFU_WORDED).map((d) => [d, `fr:${d}`]),
    ['retroModeTip', 'Rend le monde en basse résolution'], ['bloom', 'Flou lumineux'], ['maxBlurSize', 'Flou max']]);
  assert.equal(labelOf('Effects/DepthOfFieldAperture'), 'Aperture', 'English until French is chosen');
  tm.setLocale('fr');
  for (const [k, d] of Object.entries(DFU_WORDED)) assert.equal(labelOf(k), `fr:${d}`, `${k} reads ${d}`);
  assert.equal(helpOf('Video/RetroRenderingMode'), 'Rend le monde en basse résolution');
  assert.equal(labelOf('Effects/BloomEnable'), 'Glow', 'the port\'s own label - DFU\'s "Bloom" is another word');
  assert.equal(labelOf('Effects/DepthOfFieldMaxBlurSize'), 'Maximum Blur', 'the port\'s own label - DFU\'s "Max Blur Size" is another');
  tm.setLocale('en');
  for (const k of Object.keys(DFU_WORDED)) assert.equal(labelOf(k), LABELS[k]);
  assert.equal(helpOf('Video/RetroRenderingMode'), TIP);
});

// ── the advanced (mouse) controls window ─────────────────────────────────────────────────────────────────────────────

/** A pack's Internal_Settings rows for the window, keyed by DFU's keys (ASCII, so the classic font draws them as they
 *  are). */
const MOUSE_FR = [
  ['configureAdvancedControls', 'Configurer les commandes avancees'], ['continueUpper', 'CONTINUER'],
  ['Escape', 'Echap'], ['AutoRun', 'Course auto'], ['ToggleConsole', 'La console'], ['PrintScreen', 'Capture'],
  ['QuickSave', 'Sauver vite'], ['QuickLoad', 'Charger vite'],
  ['mouseLookSmoothing', 'Lissage du regard'], ['mouseLookSensitivity', 'Sensibilite du regard'], ['weaponSwingMode', 'Mode de frappe'],
  ['invertLookY', 'Inverser Y'], ['movementAcceleration', 'Acceleration'], ['bowDrawback', 'Arcs - bander et lacher'],
  ['toggleSneak', 'Furtivite maintenue'], ['mouseWeaponAttackThreshold', 'Seuil de frappe'],
  ['mouseLookSmoothingStrengths', 'Aucun\nMinimal\nFaible\nMoyen\nFort\nMaximal'], ['weaponSwingModes', 'Classique\nClic\nMaintien'],
];
const MOUSE_FR_OF = new Map(MOUSE_FR);

test('L10N3d mouse controls: the title, CONTINUE, the keybind faces by action name, the sliders, the checkboxes and the threshold read the pack\'s TextSettings rows where they are drawn; English is DFU\'s, byte for byte', () => {
  const store = freshStore();
  const english = [SLIDERS.map((s) => s.label), CHECKBOXES.map((c) => c.label), THRESHOLD.label, { ...KEYBIND_LABELS }];
  assert.deepEqual(english, [
    ['Mouse Look Smoothing', 'Mouse Look Sensitivity', 'Weapon Swing Mode', 'Hit Detection'],
    ['Invert Look-Y', 'Movement Acceleration', 'Bows - draw and release', 'Toggle Sneak', 'Protect Friendlies and Neutrals'],
    'Mouse Weapon Attack Threshold',
    { Escape: 'Escape', AutoRun: 'AutoRun', ToggleConsole: 'Console', PrintScreen: 'Screenshot', QuickSave: 'QuickSave', QuickLoad: 'QuickLoad' },
  ]);
  const en = new MouseControlsWindow(createUnsavedKeybinds(store));
  assert.deepEqual([...en.sliders.mouseSmoothing.items], [...SMOOTHING_STRENGTHS], 'Setup\'s strength names are DFU\'s English');
  assert.deepEqual([...en.sliders.weaponSwingMode.items], [...WEAPON_SWING_MODES]);
  for (const t of ['Configure Advanced Controls', 'CONTINUE', 'Screenshot', 'Mouse Look Smoothing', 'Toggle Sneak', 'Mouse Weapon Attack Threshold']) {
    assert.ok(paints(en, t), `English paints "${t}"`);
  }
  en.dispose();

  tm.patchLocaleTable('fr', 'Internal_Settings', MOUSE_FR);
  tm.setLocale('fr');
  const w = new MouseControlsWindow(createUnsavedKeybinds(store));
  for (const row of KEYBIND_ROWS) assert.equal(KEYBIND_LABELS[row.action], MOUSE_FR_OF.get(row.action), `${row.action}'s face, by its own name`);
  assert.deepEqual(SLIDERS.map((s) => s.label), ['Lissage du regard', 'Sensibilite du regard', 'Mode de frappe', 'Hit Detection']);
  assert.deepEqual(CHECKBOXES.slice(0, 4).map((c) => c.label), ['Inverser Y', 'Acceleration', 'Arcs - bander et lacher', 'Furtivite maintenue']);
  assert.equal(THRESHOLD.label, 'Seuil de frappe');
  assert.equal(indicatorText(w.sliders.mouseSmoothing), 'Moyen', 'the shipped 0.5 is strength 3, in the pack\'s words');
  assert.deepEqual([...w.sliders.weaponSwingMode.items], ['Classique', 'Clic', 'Maintien']);
  for (const [, t] of MOUSE_FR.slice(0, 16).filter(([k]) => k !== 'ToggleConsole')) assert.ok(paints(w, t), `French paints "${t}"`);
  assert.equal(paints(w, 'La console'), false, 'the port\'s hidden ToggleConsole row draws in no language');
  const fnt = { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 };
  assert.equal(MouseControlsWindow.checkboxRect(CHECKBOXES[0], fnt)[2], CHECK_SIZE + CHECK_TEXT_OFFSET[0] + measureText(fnt, 'Inverser Y'),
    'the checkbox is as wide as the label it shows (Checkbox.cs:103-105)');
  w.dispose();

  tm.setLocale('en');
  assert.deepEqual([SLIDERS.map((s) => s.label), CHECKBOXES.map((c) => c.label), THRESHOLD.label, { ...KEYBIND_LABELS }], english, 'English again');
  const back = new MouseControlsWindow(createUnsavedKeybinds(store));
  assert.deepEqual([...back.sliders.mouseSmoothing.items], [...SMOOTHING_STRENGTHS]);
  assert.ok(paints(back, 'Configure Advanced Controls') && paints(back, 'CONTINUE'));
  back.dispose();
});

// ── the prompts ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3d controls prompts: the grid\'s and the joystick window\'s multipleAssignments, the grid\'s confirmDefaultControls, and the remove prompt\'s pattern - English byte for byte, a translation by DFU\'s key', () => {
  const store = freshStore();
  const cw = new ControlsWindow({});
  cw.top = 'dupes';
  assert.deepEqual(cw.promptRows(), ['You have multiple assignments...']);
  cw.top = 'defaults';
  assert.deepEqual(cw.promptRows(), ['Are you sure you want to set default controls?']);
  // the rows the port drew before the pattern was routed: DFU's one line, broken before "for"
  const before = (a) => ['Are you sure you want to remove the keybind', `for ${splitCamel(a)} ('${buttonText(getBinding(store, a, true), true)}')?`];
  for (const a of ['AutoRun', 'SwingWeapon', 'MoveForwards', 'ActivateCenterObject']) {
    assert.deepEqual(removeKeybindPromptRows(a, getBinding(store, a, true)), before(a), `${a}: English as it was`);
  }
  cw.top = 'remove'; cw._removeAction = 'AutoRun';
  assert.deepEqual(cw.promptRows(), before('AutoRun'), 'the grid asks in those rows');
  const joy = new JoystickControlsWindow(createJoystickUnsaved(store));
  joy.top = 'multiple';
  assert.ok(paints(joy, MULTIPLE_ASSIGNMENTS));

  tm.patchLocaleTable('fr', 'Internal_Strings', [
    ['multipleAssignments', 'Vous avez des affectations multiples...'],
    ['confirmDefaultControls', 'Voulez-vous vraiment remettre les commandes par defaut ?'],
    ['removeKeybind', "Voulez-vous vraiment retirer la touche de {0} ('{1}') ?"],
  ]);
  tm.setLocale('fr');
  cw.top = 'dupes';
  assert.deepEqual(cw.promptRows(), ['Vous avez des affectations multiples...']);
  cw.top = 'defaults';
  assert.deepEqual(cw.promptRows(), ['Voulez-vous vraiment remettre les commandes par defaut ?']);
  cw.top = 'remove';
  assert.deepEqual(cw.promptRows(), ['Voulez-vous vraiment retirer la touche', "de Auto Run ('MIDDLE CLICK') ?"],
    'formatted, and broken before the word that leads into the action');
  assert.ok(paints(joy, 'Vous avez des affectations multiples...'));
  assert.equal(paints(joy, MULTIPLE_ASSIGNMENTS), false);
  // the break follows the pattern: the key named first, or the action first on the line
  tm.patchLocaleTable('fr', 'Internal_Strings', [['removeKeybind', "Retirer '{1}' pour {0} ?"]]);
  assert.deepEqual(removeKeybindPromptRows('AutoRun', 'Mouse2'), ["Retirer 'MIDDLE CLICK'", 'pour Auto Run ?']);
  tm.patchLocaleTable('fr', 'Internal_Strings', [['removeKeybind', "{0} : retirer '{1}' ?"]]);
  assert.deepEqual(removeKeybindPromptRows('AutoRun', 'Mouse2'), ["Auto Run : retirer 'MIDDLE CLICK' ?"], 'nothing before the action: one row');

  tm.setLocale('en');
  cw.top = 'dupes';
  assert.deepEqual(cw.promptRows(), ['You have multiple assignments...']);
  assert.deepEqual(removeKeybindPromptRows('AutoRun', getBinding(store, 'AutoRun', true)), before('AutoRun'));
  assert.ok(paints(joy, MULTIPLE_ASSIGNMENTS));
});

// ── the enhanced pane ────────────────────────────────────────────────────────────────────────────────────────────────

const fakeEl = (tag) => {
  const n = {
    tag, tagName: tag.toUpperCase(), children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {},
    onclick: null, oncontextmenu: null,
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, removeEventListener() {},
  };
  return n;
};
const find = (n, cls, out = []) => {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
};
const textOf = (n, out = []) => { if (n.textContent) out.push(n.textContent); for (const c of n.children ?? []) textOf(c, out); return out; };

function withPane(fn) {
  const store = freshStore();
  discardControlsStaging();
  globalThis.document = { createElement: fakeEl, addEventListener() {}, removeEventListener() {} };
  const view = { body: fakeEl('div') };
  const render = () => { view.body = fakeEl('div'); paneControls(view.body, { render }); };
  try { render(); return fn({ view, store, render }); } finally { discardControlsStaging(); delete globalThis.document; }
}

test('L10N3d enhanced controls: the refusal and the defaults prompt read the pack by DFU\'s keys - and the refusal is still told apart by its English, one line and marked bad', () => {
  withPane(({ view, store, render }) => {
    // a clash the pane can only be handed (GetDuplicates' second phase): Shift+T against Run's bare Left Shift
    setBinding(store, comboCode('ShiftLeft', 'KeyT'), 'Inventory');
    discardControlsStaging();
    render();
    const notices = () => find(view.body, 'ctl-notice').map((n) => [n.textContent, n.className.includes('bad')]);
    assert.deepEqual(notices(), [[MULTIPLE_ASSIGNMENTS, true]]);
    assert.equal(MULTIPLE_ASSIGNMENTS, 'You have multiple assignments...');

    tm.patchLocaleTable('fr', 'Internal_Strings', [
      ['multipleAssignments', 'Vous avez des affectations multiples…'],
      ['confirmDefaultControls', 'Voulez-vous vraiment rétablir les commandes par défaut ?'],
    ]);
    render();
    assert.deepEqual(notices(), [[MULTIPLE_ASSIGNMENTS, true]], 'English until French is chosen');
    tm.setLocale('fr');
    render();
    assert.deepEqual(notices(), [['Vous avez des affectations multiples…', true]]);
    find(view.body, 'ctl-continue')[0].onclick();
    assert.deepEqual(notices(), [['Vous avez des affectations multiples…', true]], 'Confirm refused: the one line, still marked, never twice');
    find(view.body, 'ctl-defaults')[0].onclick();
    assert.ok(textOf(find(view.body, 'ctl-prompt')[0]).includes('Voulez-vous vraiment rétablir les commandes par défaut ?'));
    find(view.body, 'act').find((b) => b.textContent === 'No').onclick();

    tm.setLocale('en');
    render();
    assert.deepEqual(notices(), [[MULTIPLE_ASSIGNMENTS, true]], 'English again');
    find(view.body, 'ctl-defaults')[0].onclick();
    assert.ok(textOf(find(view.body, 'ctl-prompt')[0]).includes(DEFAULTS_PROMPT));
  });
});
