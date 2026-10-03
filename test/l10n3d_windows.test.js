// L10N3d (2026-09-27): THE WINDOWS' OWN WORDS, IN THE PLAYER'S LANGUAGE. Every Internal_Strings word DFU's windows
// ask TextManager for - the pack, the save and pause doors, the spellbook, the spell and item makers, the icon picker,
// the journal, the rest windows, the character creator and sheet, the potion maker, the travel map, the prison screen
// and the guild bookshelf - is read through the text core where the port shows it. Pinned, through each window's own
// code, classic and enhanced skins alike: a French row reaches the screen, and English (before French is chosen, and
// after English is chosen again) reads byte for byte as it did. DFU's processing rides along: String.Format over
// {0}..{2}, .Replace("%s"/"%d"), the " " a name box appends, ProcessGrammar where DFU calls it. The keys and their
// English are held to DFU's table by test/l10n3d_sites.test.js.
import './modsOff.js';
import { Node_ } from './chargenDom.mjs';   // a minimal DOM (globals): the enhanced skins mount under it
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { NativeInventoryWindow, goldPanelRows } from '../src/ui/nativeInventory.js';
import { REFUSAL, planStore, planTake, planDropGold, HOW_MANY_ITEMS, cannotCarryText, cannotHoldText } from '../src/systems/itemTransfer.js';
import { cannotRemoveItemText } from '../src/systems/createItem.js';
import { equipItem } from '../src/systems/equip.js';
import { PauseOptionsWindow, PAUSE_PANEL_Y } from '../src/ui/pauseWindow.js';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';
import { saveSlot } from '../src/systems/saveSlots.js';
import { SAVE_VERSION } from '../src/systems/save.js';
import { playerEntity } from '../src/characters/playerEntity.js';
import { createCharacter } from '../src/systems/chargen.js';
import { SpellbookWindow, SPELLBOOK_LAYOUT, SPELLBOOK_RECTS, VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG } from '../src/ui/spellbookWindow.js';
import { TARGET_DESCRIPTIONS, ELEMENT_DESCRIPTIONS } from '../src/ui/spellIcons.js';
import { bookModel, effectWords, spellFrame, mountEnhancedSpellbook } from '../src/ui/enhancedSpellbook.js';
import { SpellMakerWindow } from '../src/ui/spellMakerWindow.js';
import { validateSpellPurchase } from '../src/systems/spellMaker.js';
import { buildIconPickerLayout } from '../src/ui/spellIconPickerWindow.js';
import { QuestJournalWindow, JOURNAL_RECTS, JOURNAL_MODES, JOURNAL_TIPS, JOURNAL_TOOLTIP_DELAY, FIND_PLACE_TEXT, CONFIRM_TEXT, locationInRegionText, enterNotePrompt } from '../src/ui/questJournal.js';
import { PlayerNotebook } from '../src/systems/notebook.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';
import { canRest, RestSession, BUILDING_TAVERN, restPrompt, loiterPrompt, illegalRestWarningText, cannotLoiterLines, loiterLimitHours, REST_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { mountEnhancedRest } from '../src/ui/enhancedRest.js';
import { setValue, _resetForTests as resetSettings } from '../src/systems/settings.js';
import { HELP_TOPICS } from '../src/systems/customClass.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { randomLabel, homeProvincePrompt } from '../src/ui/chargenArt.js';
import { CharSheet, CHARSHEET_RECTS, affiliationRows, mustDistributeBonusPointsText } from '../src/ui/charsheet.js';
import { GUILDS } from '../src/systems/guilds.js';
import { SKILLS, SKILL_NAMES } from '../src/systems/skills.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';
import { ItemMakerWindow } from '../src/ui/itemMakerWindow.js';
import { PotionMakerWindow, POTION_RECTS } from '../src/ui/potionMakerWindow.js';
import { POTION_RECIPES, potionRecipeKey } from '../src/systems/potions.js';
import { TravelMapWindow } from '../src/ui/travelMapWindow.js';
import { daysUntilFreedomText, PrisonScreenWindow } from '../src/ui/prisonScreen.js';
import { bookshelfAccess } from '../src/systems/bookshelf.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

beforeEach(() => tm._resetTextManagerForTests());

// The fake DOM's two gaps the enhanced pause menu reaches: a save tile counts `childNodes`, the save card
// `replaceChildren`s its numbers.
Object.defineProperty(Node_.prototype, 'childNodes', { get() { return this.children; } });
Node_.prototype.replaceChildren = function (...nodes) { this.children = []; this.append(...nodes); };

/** `show()` in English, again with `rows` (Internal_Strings [key, French]) in the table but English still chosen,
 *  then in French, then in English once more. Answers { en, fr }, holding every English read to the first. */
function inFrench(rows, show) {
  const en = show();
  tm.patchLocaleTable('fr', 'Internal_Strings', rows);
  assert.deepEqual(show(), en, 'English stands until French is chosen');
  tm.setLocale('fr');
  const fr = show();
  tm.setLocale('en');
  assert.deepEqual(show(), en, 'English again, byte for byte');
  return { en, fr };
}

/** A glyph-recording font: drawText asks glyphWidth for every glyph it lays, so the painted strings come back (their
 *  spaces advance without a glyph, so the tape runs the words together). */
function spyFont() {
  const chars = [];
  return {
    get drawn() { return chars.join(''); },
    tex: 'font', glyph: () => null,
    fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; } },
  };
}
const recorder = () => ({ uploadTexture: () => 'tex', releaseTexture() {}, drawScreenQuad() {}, drawScreenQuadRun() {} });
const all = (n, out = []) => { for (const c of n.children ?? []) { out.push(c); all(c, out); } return out; };
const buttons = (host) => all(host).filter((n) => n.tagName === 'BUTTON').map((b) => b.textContent);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

// ─── the pack ────────────────────────────────────────────────────────────────────────────────────────────────────

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const cart = () => ({ group: 'Transportation', templateIndex: 93, name: 'Small Cart' });
const book = (n = 1) => ({ group: 'Books', templateIndex: 277, name: 'Book', stackCount: n });
const dagger = (over = {}) => ({ group: 'Weapons', templateIndex: 113, name: 'Dagger', ...over });

test('L10N3d windows - the pack: the wagon button\'s two refusals, the transfer ladder\'s three, the split box\'s question, the gold clamp\'s notice, the gold panel\'s two lines and the equip cue are the language\'s rows, each read when it is shown', () => {
  const wagonButton = (deps) => {
    const w = new NativeInventoryWindow({ wagonItems: () => [], icons: ICONS, ...deps });
    w.click(226 + 5, 14 + 5);
    return w.topBox.rows[0].text;
  };
  const equipCue = () => {
    const e = { items: [], stats: {} };
    const said = [];
    const w = new NativeInventoryWindow({ items: () => e.items, entity: e, icons: ICONS, say: (m) => said.push(m) });
    equipItem(e, { group: 'Weapons', templateIndex: 123 });   // a dai-katana, in hand before the window closes
    w._closeSilently();
    return said;
  };
  const show = () => ({
    noWagon: wagonButton({ items: () => [book()] }),
    exitTooFar: wagonButton({ items: () => [cart()], dungeon: { inside: true, nearExit: () => false } }),
    wagonFull: planStore(book(), { remote: [book(375)], usingWagon: true }).refusal.text,
    carry: planTake(dagger(), { bag: [], entity: { stats: { strength: 20 }, items: [], goldPieces: 12000 } }).refusal.text,
    summoned: planStore(dagger({ timeForItemToDisappear: 1 })).refusal.text,
    refusals: [REFUSAL.summoned.text, REFUSAL.questItem.text, REFUSAL.wagonFull.text, REFUSAL.cannotCarry.text, cannotRemoveItemText(), cannotHoldText(), cannotCarryText()],
    split: HOW_MANY_ITEMS(12),
    gold: planDropGold('100000', { carried: 100000, usingWagon: true, remote: [book(370)] }).notice,
    panel: [...goldPanelRows(400, 1), ...goldPanelRows(401, 1.0025)].map((r) => r.text),
    equip: equipCue(),
  });
  const { en, fr } = inFrench([
    ['noWagon', 'Vous n\'avez pas de chariot.'],
    ['exitTooFar', 'La sortie est trop loin pour atteindre votre chariot.'],
    ['cannotHoldAnymore', 'Votre chariot est plein.'],
    ['cannotCarryAnymore', 'Vous ne pouvez rien porter de plus.'],
    ['cannotRemoveItem', 'Vous ne pouvez pas retirer cet objet.'],
    ['howManyItems', 'Combien d\'objets (max {0}) ?'],
    ['wagonFullGold', 'Votre chariot ne pouvait contenir que {0} pièces d\'or.'],
    ['goldAmount', '{0} pièces d\'or'],
    ['goldWeight', 'Poids : {0} kg'],
    ['equippingWeapon', 'Vous équipez %s'],
  ], show);
  assert.deepEqual(en, {
    noWagon: 'You don\'t own a wagon.',
    exitTooFar: 'The exit is too far away for you to access your wagon.',
    wagonFull: 'Your wagon cannot hold any more stuff.',
    carry: 'You cannot carry any more stuff.',
    summoned: 'You cannot remove this item.',
    refusals: ['You cannot remove this item.', 'You cannot remove this item.', 'Your wagon cannot hold any more stuff.', 'You cannot carry any more stuff.',
      'You cannot remove this item.', 'Your wagon cannot hold any more stuff.', 'You cannot carry any more stuff.'],
    split: 'Pick how many items (max 12)?',
    gold: 'Your wagon could only hold 4000 gold pieces.',
    panel: ['400 gold pieces', 'Weight: 1 kg', '401 gold pieces', 'Weight: 1.00 kg'],
    equip: ['Equipping Dai-katana'],
  });
  assert.deepEqual(fr, {
    noWagon: 'Vous n\'avez pas de chariot.',
    exitTooFar: 'La sortie est trop loin pour atteindre votre chariot.',
    wagonFull: 'Votre chariot est plein.',
    carry: 'Vous ne pouvez rien porter de plus.',
    summoned: 'Vous ne pouvez pas retirer cet objet.',
    refusals: ['Vous ne pouvez pas retirer cet objet.', 'Vous ne pouvez pas retirer cet objet.', 'Votre chariot est plein.', 'Vous ne pouvez rien porter de plus.',
      'Vous ne pouvez pas retirer cet objet.', 'Votre chariot est plein.', 'Vous ne pouvez rien porter de plus.'],
    split: 'Combien d\'objets (max 12) ?',
    gold: 'Votre chariot ne pouvait contenir que 4000 pièces d\'or.',
    panel: ['400 pièces d\'or', 'Poids : 1 kg', '401 pièces d\'or', 'Poids : 1.00 kg'],
    equip: ['Vous équipez Dai-katana'],
  }, 'String.Format fills the language\'s own pattern; .Replace("%s") names the template');
});

// ─── the save and pause doors ────────────────────────────────────────────────────────────────────────────────────

/** A save in an in-memory store, as the browser's would hold it. */
function withSaves(fn) {
  const was = globalThis.localStorage;
  const m = new Map();
  globalThis.localStorage = {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
  };
  try {
    saveSlot('Alaric', 'QuickSave', { v: SAVE_VERSION, name: 'Alaric', classicMinutes: 10 }, { now: 100 });
    return fn();
  } finally { globalThis.localStorage = was; }
}
const pauseMenu = (at, hooks) => {
  const host = document.createElement('div');
  document.body.append(host);   // connected, as main's fake DOM reads it (chargenDom.mjs isConnected walks to the body)
  quiet(() => mountEnhancedMenu(host, { mode: 'pause', hooks, at }));
  return host;
};

test('L10N3d windows - the save doors: the classic pause window\'s refusal, and the enhanced pause menu\'s - with the save window\'s own Save, Load and Delete - speak the language', () => {
  const show = () => {
    const w = new PauseOptionsWindow({ savingPrevented: () => true });
    w.click(85 + 4 + 1, PAUSE_PANEL_Y + 4 + 1);   // SaveButton_OnMouseClick (:296-303)
    const prevented = pauseMenu('save', { savingPrevented: () => true }).textContent;
    return {
      classic: w._noteRows,
      enhanced: prevented.includes('You cannot save now.') ? 'en' : prevented.includes('Sauvegarde impossible.') ? 'fr' : prevented,
      save: buttons(pauseMenu('save', { quickSave() {}, playerName: () => 'Alaric' })).filter((b) => ['Save', 'Sauver'].includes(b)),
      load: withSaves(() => buttons(pauseMenu('load', { quickLoad() {} })).filter((b) => ['Load', 'Delete', 'Charger', 'Supprimer'].includes(b))),
    };
  };
  const { en, fr } = inFrench([
    ['cannotSaveNow', 'Sauvegarde impossible.'], ['saveButton', 'Sauver'], ['loadButton', 'Charger'], ['deleteSave', 'Supprimer'],
  ], show);
  assert.deepEqual(en, { classic: ['You cannot save now.'], enhanced: 'en', save: ['Save'], load: ['Load', 'Delete'] });
  assert.deepEqual(fr, { classic: ['Sauvegarde impossible.'], enhanced: 'fr', save: ['Sauver'], load: ['Charger', 'Supprimer'] });
});

// ─── the spellbook, the spell maker and the icon picker ──────────────────────────────────────────────────────────

const effect = (type, subType) => ({ type, subType });
const spell = (name, over = {}) => ({ name, cost: 5, index: 1, icon: 3, element: 0, rangeType: 2, effects: [effect(4, 0), effect(-1, -1), effect(-1, -1)], ...over });
const spellbook = (...spells) => {
  const entity = { name: 'Nyra', magicka: 20, maxMagicka: 40, spells, items: [], stats: { personality: 50 } };
  return new SpellbookWindow({ spells: () => entity.spells, entity, castCost: (sp) => sp.cost, onReady() {}, rows: () => [] });
};
const TARGETS = ['casterOnly', 'byTouch', 'singleTargetAtRange', 'areaAroundCaster', 'areaAtRange'];
const ELEMENTS = ['fireBased', 'coldBased', 'poisonBased', 'shockBased', 'magicBased'];

test('L10N3d windows - the spellbook: its three tooltips, the not-found effect, both curse refusals, the delete and sort prompts and the rename box\'s label ("enterSpellName" + " ") are the language\'s', () => {
  const tip = (w, rect) => {
    w.hover(SPELLBOOK_LAYOUT.x + rect[0] + 2, SPELLBOOK_LAYOUT.y + rect[1] + 2);
    w.tick(10);
    return w.tip.text;
  };
  const show = () => {
    const w = spellbook(spell('Frostbite', { rangeType: 2, element: 1, effects: [effect(999, 0), effect(-1, -1), effect(-1, -1)] }));
    const out = {
      tips: [tip(w, SPELLBOOK_RECTS.spellIcon), tip(w, SPELLBOOK_RECTS.targetIcon), tip(w, SPELLBOOK_RECTS.elementIcon)],
      lists: [...TARGET_DESCRIPTIONS, ...ELEMENT_DESCRIPTIONS],
      effect: w.effectLabels(0),
    };
    w.deleteButton(); out.delete = w._boxRows(); w.top = null;
    w.top = 'sort'; out.sort = w._boxRows(); w.top = null;
    w.renameButton(); out.rename = w.renameBox.label;
    const curses = spellbook(spell('Bat Form', { tag: VAMPIRE_SPELL_TAG }), spell('Howl', { tag: LYCANTHROPY_SPELL_TAG }));
    curses.deleteButton(); out.vamp = curses._boxRows(); curses.top = null;
    curses.selectNext(); curses.deleteButton(); out.were = curses._boxRows();
    return out;
  };
  const { en, fr } = inFrench([
    ['selectIcon', 'Choisir l\'icône'], ['effectNotFoundError', '<effet introuvable>'], ['deleteSpell', 'Supprimer ce sort ?'],
    ['sortSpells', 'Trier les sorts ?'], ['enterSpellName', 'Nom du sort :'], ['cannotDeleteVamp', 'Sorts de vampire : non.'],
    ['cannotDeleteWere', 'Sort de lycanthrope : non.'], ...[...TARGETS, ...ELEMENTS].map((k) => [k, `«${k}»`]),
  ], show);
  assert.deepEqual(en, {
    tips: ['Select icon', 'Single target at range', 'Cold based'],
    lists: ['Caster only', 'By touch', 'Single target at range', 'Area around caster', 'Area at range', 'Fire based', 'Cold based', 'Poison based', 'Shock based', 'Magic based'],
    effect: ['<effect not found>', '999,0'],
    delete: ['Do you want to delete this spell?'], sort: ['Do you want to sort spells?'], rename: 'Enter spell name : ',
    vamp: ['Cannot delete special vampire spells.'], were: ['Cannot delete special lycanthropy spell.'],
  });
  assert.deepEqual(fr, {
    tips: ['Choisir l\'icône', '«singleTargetAtRange»', '«coldBased»'],
    lists: [...TARGETS, ...ELEMENTS].map((k) => `«${k}»`),
    effect: ['<effet introuvable>', '999,0'],
    delete: ['Supprimer ce sort ?'], sort: ['Trier les sorts ?'], rename: 'Nom du sort : ',
    vamp: ['Sorts de vampire : non.'], were: ['Sort de lycanthrope : non.'],
  });
  assert.ok(Array.isArray(TARGET_DESCRIPTIONS) && Object.isFrozen(TARGET_DESCRIPTIONS) && TARGET_DESCRIPTIONS.length === 5 && ELEMENT_DESCRIPTIONS.length === 5,
    'the two lists keep their shape: frozen arrays in enum order');
  assert.equal(TARGET_DESCRIPTIONS[-1], undefined);
});

test('L10N3d windows - the enhanced spellbook: the model\'s words (the icons\' two, the not-found effect, the curse refusals) and the page\'s (the rename label, the delete question) are the classic book\'s, in the language', () => {
  const vamp = spell('Bat Form', { tag: VAMPIRE_SPELL_TAG, rangeType: 0, element: 4 });
  const plain = spell('Spark', { rangeType: 4, element: 3 });
  /** The book mounted over `spells`, `label` pressed, and the text of the one element of class `cls`. */
  const page = (spells, label, cls) => {
    const host = document.createElement('div');
    const was = globalThis.window;
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    try {
      const book = mountEnhancedSpellbook(host, { spells: () => spells, castCost: (sp) => sp.cost, entity: { spells, items: [] } });
      all(host).find((n) => n.tagName === 'BUTTON' && n.textContent === label).click();
      const text = host.querySelector(`.${cls}`)?.textContent ?? null;
      book.destroy();
      return text;
    } finally { globalThis.window = was; }
  };
  const show = () => {
    const rows = bookModel([vamp, plain], (sp) => sp.cost);
    return {
      frame: [spellFrame(vamp), spellFrame(plain)],
      undeletable: rows.map((r) => r.undeletable),
      missing: effectWords(effect(999, 0)).group,
      refusal: page([vamp], 'Delete', 'sheet-notice'),
      rename: page([plain], 'Rename', 'sb-renamelabel'),
      ask: page([plain], 'Delete', 'px-note'),
    };
  };
  const { en, fr } = inFrench([
    ['casterOnly', 'Lanceur'], ['areaAtRange', 'Zone à distance'], ['magicBased', 'Magique'], ['shockBased', 'Électrique'],
    ['cannotDeleteVamp', 'Sorts de vampire : non.'], ['effectNotFoundError', '<effet introuvable>'],
    ['enterSpellName', 'Nom du sort :'], ['deleteSpell', 'Supprimer ce sort ?'],
  ], show);
  assert.deepEqual(en, {
    frame: [{ target: 'Caster only', element: 'Magic based' }, { target: 'Area at range', element: 'Shock based' }],
    undeletable: ['Cannot delete special vampire spells.', null], missing: '<effect not found>',
    refusal: 'Cannot delete special vampire spells.', rename: 'Enter spell name :', ask: 'Do you want to delete this spell?',
  });
  assert.deepEqual(fr, {
    frame: [{ target: 'Lanceur', element: 'Magique' }, { target: 'Zone à distance', element: 'Électrique' }],
    undeletable: ['Sorts de vampire : non.', null], missing: '<effet introuvable>',
    refusal: 'Sorts de vampire : non.', rename: 'Nom du sort :', ask: 'Supprimer ce sort ?',
  });
});

test('L10N3d windows - the spell maker\'s name box and its no-effect refusal, and the icon picker\'s Classic header, speak the language', () => {
  const show = () => {
    const maker = new SpellMakerWindow({ entity: { maxMagicka: 100, gold: 0, goldPieces: 0 }, rows: () => [] });
    maker._openNameBox();
    const refused = validateSpellPurchase({ entity: { items: [{ group: 'MiscItems', templateIndex: 132 }] }, slots: [], goldCost: 0, name: 'x' });
    return { label: maker.nameBox.label, refused, header: buildIconPickerLayout().items[0].text };
  };
  const { en, fr } = inFrench([['enterSpellName', 'Nom du sort :'], ['noEffectsError', 'Ajoutez un effet.'], ['classicIcons', 'Classiques']], show);
  assert.deepEqual(en, { label: 'Enter spell name : ', refused: { ok: false, text: 'You must add at least one effect to this spell.' }, header: 'Classic' });
  assert.deepEqual(fr, { label: 'Nom du sort : ', refused: { ok: false, text: 'Ajoutez un effet.' }, header: 'Classiques' });
});

// ─── the journal ─────────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3d windows - the journal: its five tooltips, the move and remove boxes, the find-place box with its "{0} in {1} province" line and the note prompt read DFU\'s keys, including the three CreateDialogBox builds', () => {
  const mid = ([x, y, w, h]) => [x + Math.floor(w / 2), y + Math.floor(h / 2)];
  const show = () => {
    const tips = [];
    for (const [rect, mode] of [[JOURNAL_RECTS.dialog, 'activeQuests'], ...JOURNAL_MODES.map((m) => [JOURNAL_RECTS.title, m])]) {
      const w = new QuestJournalWindow({ questMessages: () => [], notebook: () => null, mode });
      w.hover(...mid(rect));
      w.tick(JOURNAL_TOOLTIP_DELAY);
      tips.push(w.tip.text);
    }
    const boxes = [];
    for (const right of [true, false]) {
      const nb = new PlayerNotebook({ now: () => 0, location: () => 'Testville' });
      nb.addNote('alpha');
      const w = new QuestJournalWindow({ notebook: () => nb, mode: 'notebook' });
      w._font = { fnt: { fixedHeight: 7 } };
      w.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1, right);
      boxes.push(w.moveRemoveBox.rows.map((r) => r.text));
      w.answerMoveRemove(MB_BUTTONS.No);
    }
    const place = { isPlace: true, siteDetails: { locationName: 'Daggerfall', regionName: 'Daggerfall', regionIndex: 17, mapId: 1 } };
    const find = new QuestJournalWindow({
      questMessages: () => [{ getTextTokens: () => [{ text: 'Meet me at _dungeon_.', formatting: 'text' }], parentQuest: { getResource: ({ name }) => (name === 'dungeon' ? place : null) } }],
      currentLocationName: () => 'Wayrest', canFindPlace: () => true, gotoPlace() {},
    });
    find._font = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 } };
    find.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1);
    return {
      tips, tables: [{ ...JOURNAL_TIPS }, { ...FIND_PLACE_TEXT }, { ...CONFIRM_TEXT }], boxes,
      find: find.findBox.rows.map((r) => r.text), province: locationInRegionText('Wayrest', 'Wayrest'), note: enterNotePrompt(),
    };
  };
  const KEYS = ['dialogButtonInfo', 'activeQuestsInfo', 'finishedQuestsInfo', 'notebookInfo', 'messagesInfo', 'confirmFindHead', 'confirmFind',
    'confirmFind2', 'confirmMoveHead', 'confirmMove', 'confirmMove2', 'confirmRemoveHead', 'confirmRemove', 'confirmRemove2', 'enterNote'];
  const { en, fr } = inFrench([...KEYS.map((k) => [k, `«${k}»`]), ['locationInRegionProvince', '{0}, province de {1}']], show);
  assert.deepEqual(en.tips, [JOURNAL_TIPS.dialog, JOURNAL_TIPS.activeQuests, JOURNAL_TIPS.finishedQuests, JOURNAL_TIPS.notebook, JOURNAL_TIPS.messages]);
  assert.equal(en.tips[4], 'History of messages recently shown on screen');
  assert.deepEqual(en.boxes, [
    ['Delete entry', 'Are you sure you want to remove this entry?', '', en.boxes[0][3], '(It will be deleted permanently and cannot be restored)'],
    ['Move entry', 'Do you want to change the position of this entry?', '', en.boxes[1][3], '(It will be moved to before the next entry clicked)'],
  ]);
  assert.deepEqual(en.find, ['Travel to location', 'Do you want to open the world map to travel to:', '', 'Daggerfall in Daggerfall province', '(Note: you can cancel travel from the world map)']);
  assert.equal(en.province, 'Wayrest in Wayrest province');
  assert.equal(en.note, 'Enter your note:');
  assert.deepEqual(fr.tips, ['«dialogButtonInfo»', '«activeQuestsInfo»', '«finishedQuestsInfo»', '«notebookInfo»', '«messagesInfo»']);
  assert.deepEqual(fr.tables, [
    { dialog: '«dialogButtonInfo»', activeQuests: '«activeQuestsInfo»', finishedQuests: '«finishedQuestsInfo»', notebook: '«notebookInfo»', messages: '«messagesInfo»' },
    { head: '«confirmFindHead»', action: '«confirmFind»', note: '«confirmFind2»', locationInRegion: locationInRegionText },   // GUIDE2 (main): the quest lens's one home, itself in the language
    { moveHead: '«confirmMoveHead»', move: '«confirmMove»', move2: '«confirmMove2»', removeHead: '«confirmRemoveHead»', remove: '«confirmRemove»', remove2: '«confirmRemove2»' },
  ], 'the three tables keep the port\'s own names over DFU\'s keys');
  assert.deepEqual(fr.boxes, [
    ['«confirmRemoveHead»', '«confirmRemove»', '', en.boxes[0][3], '«confirmRemove2»'],
    ['«confirmMoveHead»', '«confirmMove»', '', en.boxes[1][3], '«confirmMove2»'],
  ], 'the entry itself is the player\'s own note, untouched');
  assert.deepEqual(fr.find, ['«confirmFindHead»', '«confirmFind»', '', 'Daggerfall, province de Daggerfall', '«confirmFind2»']);
  assert.equal(fr.note, '«enterNote»');
});

// ─── the rest windows ────────────────────────────────────────────────────────────────────────────────────────────

const restDeps = (over = {}) => ({
  advanceMinutes() {}, tickVitals: () => false, fullyHealed: () => false, enemiesNearby: () => false, dead: () => false,
  endLines: (id) => [`text:${id}`], ...over,
});
const INN = () => ({ inTownLocation: true, insideBuilding: true, buildingType: BUILDING_TAVERN, permanentScene: false, guildCanRest: true });

test('L10N3d windows - the rest windows: the unrented room, the camping warning, the two hour prompts, the loiter cap\'s two lines (the cap formatted in) and the expired room are the language\'s, in the classic window and the enhanced one', () => {
  resetSettings();
  setValue('GUI', 'IllegalRestWarning', 'True');
  /** The enhanced window's confirm card (Rest for a While in a town street), and its two hour cards' questions. */
  const enhanced = () => {
    const host = document.createElement('div');
    mountEnhancedRest(host, { ...restDeps(), restPlace: () => ({ inTownOutside: true }), setResting() {}, setLoitering() {}, vitals: () => ({}), say() {}, commitCrime() {} });
    const press = (label) => all(host).find((n) => n.tagName === 'BUTTON' && n.textContent === label).click();
    const heading = () => all(host).find((n) => n.tagName === 'H2')?.textContent ?? null;
    press('Rest for a While');
    const warning = all(host).find((n) => n.tagName === 'P')?.textContent ?? null;
    press('Yes');
    const rest = heading();
    press('Back');
    press('Loiter');
    return { warning, rest, loiter: heading() };
  };
  const show = () => {
    const refused = new RestWindow(restDeps({ restPlace: INN }));
    refused.input('char:1');
    const session = new RestSession('timed', 3, restDeps(), 1);
    let ended = null;
    for (let i = 0; i < 12 && !ended; i++) ended = session.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
    const e = enhanced();
    return {
      room: [canRest({ ...INN(), alreadyWarned: false }).line, refused.refusalLines],
      prompts: [restPrompt(), loiterPrompt(), illegalRestWarningText()],
      loiter: cannotLoiterLines(),
      expired: ended.text,
      enhanced: [e.warning, e.rest, e.loiter],
    };
  };
  const cap = loiterLimitHours();
  const { en, fr } = inFrench([
    ['haveNotRentedRoom', 'Vous n\'avez pas loué de chambre ici.'], ['illegalRestWarning', 'Camper ici est interdit. Continuer ?'],
    ['restHowManyHours', 'Reposer combien d\'heures : '], ['loiterHowManyHours', 'Attendre combien d\'heures : '],
    ['cannotLoiterMoreThanXHours1', 'Vous ne pouvez pas attendre'], ['cannotLoiterMoreThanXHours2', 'plus de {0} heures d\'affilée.'],
    ['expiredRentedRoom', 'Votre chambre a expiré.'],
  ], show);
  assert.deepEqual(en, {
    room: ['You have not rented a room here.', ['You have not rented a room here.']],
    prompts: ['Rest how many hours : ', 'Loiter how many hours : ', 'It is illegal to camp in or near a city. Continue?'],
    loiter: ['You cannot loiter more', `than ${cap} hours at a time.`],
    expired: 'Your time for this room has expired.',
    enhanced: ['It is illegal to camp in or near a city. Continue?', 'Rest how many hours?', 'Loiter how many hours?'],
  });
  assert.deepEqual(fr, {
    room: ['Vous n\'avez pas loué de chambre ici.', ['Vous n\'avez pas loué de chambre ici.']],
    prompts: ['Reposer combien d\'heures : ', 'Attendre combien d\'heures : ', 'Camper ici est interdit. Continuer ?'],
    loiter: ['Vous ne pouvez pas attendre', `plus de ${cap} heures d'affilée.`],
    expired: 'Votre chambre a expiré.',
    enhanced: ['Camper ici est interdit. Continuer ?', 'Reposer combien d\'heures : ', 'Attendre combien d\'heures : '],
  }, 'the enhanced card asks the language\'s own field label');
  resetSettings();
});

// ─── the character creator and the character sheet ───────────────────────────────────────────────────────────────

test('L10N3d windows - the character creator: the help picker\'s eight topics (in DFU\'s order, their records kept), the class list\'s own names and its Custom row (through the grammar), the Random button and the home-province prompt speak the language', () => {
  const CLASSES = ['Mage', 'Spellsword', 'Battlemage', 'Sorcerer', 'Healer', 'Nightblade', 'Bard', 'Burglar', 'Rogue', 'Acrobat', 'Thief',
    'Assassin', 'Monk', 'Archer', 'Ranger', 'Barbarian', 'Warrior', 'Knight'];
  const careers = [...CLASSES, 'Hedge Witch'].map((name) => ({ name, career: { name } }));
  const show = () => {
    const flow = new ChargenFlow(careers, () => 0);
    return {
      help: HELP_TOPICS.map(([title, id]) => [title, id]),
      classes: Array.from({ length: flow.classRowCount() }, (_, i) => flow.classRowName(i)),
      random: randomLabel(), province: homeProvincePrompt(),
    };
  };
  const HELP = ['helpAttributes', 'helpClassName', 'helpGeneral', 'helpReputations', 'helpSkillAdvancement', 'helpSkills', 'helpSpecialAdvantages', 'helpSpecialDisadvantages'];
  const { en, fr } = inFrench([
    ...HELP.map((k) => [k, `«${k}»`]), ...CLASSES.map((k) => [k, `«${k}»`]), ['Custom', 'Personnalisée'],
    ['random', 'Hasard'], ['pleaseSelectYourHomeProvince', 'Choisissez votre province natale...'],
  ], show);
  const IDS = [2402, 2401, 2400, 2406, 2407, 2403, 2404, 2405];
  assert.deepEqual(en, {
    help: ['Attributes', 'Class Name', 'General', 'Reputations', 'Skill Advancement', 'Skills', 'Special Advantages', 'Special Disadvantages'].map((t, i) => [t, IDS[i]]),
    classes: [...CLASSES, 'Hedge Witch', 'Custom'],
    random: 'Random', province: 'Please select your home province...',
  });
  assert.deepEqual(fr, {
    help: HELP.map((k, i) => [`«${k}»`, IDS[i]]),
    classes: [...CLASSES.map((k) => `«${k}»`), 'Hedge Witch', 'Personnalisée'],
    random: 'Hasard', province: 'Choisissez votre province natale...',
  }, 'a class the table does not name keeps its own name, as the career file wrote it');
  const grammar = tm.GrammarManager.grammarProcessor;
  tm.GrammarManager.grammarProcessor = { processGrammar: (t) => `<${t}>` };
  try {
    const flow = new ChargenFlow(careers, () => 0);
    assert.equal(flow.classRowName(0), '<Mage>', 'ProcessGrammar over the career name (CreateCharClassSelect.cs:61)');
  } finally { tm.GrammarManager.grammarProcessor = grammar; }
});

const sheetEntity = (over = {}) => ({
  name: 'Rhodri', level: 1, health: 30, maxHealth: 30, magicka: 0, maxMagicka: 0, stats: {}, spells: [], activeEffects: [],
  skills: Object.fromEntries(SKILL_NAMES.map((_, id) => [id, 20 + id])), items: [],
  startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 109,
  career: { name: 'Warrior', primarySkills: [SKILLS.HandToHand, SKILLS.Axe, SKILLS.CriticalStrike], majorSkills: [SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.Climbing],
    minorSkills: [SKILLS.Swimming, SKILLS.Running, SKILLS.Jumping, SKILLS.Medical, SKILLS.Dodging, SKILLS.Backstabbing] },
  ...over,
});

test('L10N3d windows - the character sheet: the affiliations table\'s header and "{0} (rep:{1})", the level progress, the bonus-points refusal, the name box and the hand-to-hand line are the language\'s; the item maker\'s name box shares the key', () => {
  const guild = GUILDS.FightersGuild;
  const member = sheetEntity({
    guildMemberships: { [guild.guildGroup]: { guild: guild.name, rank: 2, lastRankChange: 0 } },
    factionRep: { dict: new Map([[guild.factionId, { name: 'The Fighters Guild', rep: 37 }]]) },
  });
  const mid = ([x, y, w, h]) => [x + w / 2, y + h / 2];
  const show = () => {
    const sheet = new CharSheet(sheetEntity(), {});
    sheet.click(...mid(CHARSHEET_RECTS.level));
    const level = sheet.child.lines;
    sheet.child = null;
    sheet.click(...mid(CHARSHEET_RECTS.name));
    const name = sheet.child.label;
    const levelling = new CharSheet(sheetEntity(), {});
    levelling.leveling = true;
    levelling.pool = 3;
    levelling._checkIfDoneLeveling();
    const font = spyFont();
    const page = new CharSheet(sheetEntity(), {});
    page.page = 1;
    page._drawSkillPage(recorder(), font, { s: 1, ox: 0, oy: 0 });
    const maker = new ItemMakerWindow({ packItems: () => [], player: { items: [], goldPieces: 0 }, entity: { items: [] }, icons: ICONS });
    maker._openRename();
    return {
      table: affiliationRows(member, () => []).map((r) => r.cells.map((c) => c.text)),
      level, name, refusal: [levelling.child.lines, mustDistributeBonusPointsText()],
      hth: /Hand-to-Hand(dmg|degats):\d+-\d+/.exec(font.drawn)?.[0] ?? null,
      maker: maker.renameBox.label,
    };
  };
  const { en, fr } = inFrench([
    ['affiliation', 'Affiliation (fr)'], ['rank', 'Rang'], ['affiliationFormatString', '{0} (rép. {1})'],
    ['levelProgress', 'Vers le niveau suivant : {0} %'], ['mustDistributeBonusPoints', 'Répartissez tous les points.'],
    ['enterNewName', 'Nouveau nom : '], ['hthDamageFormatString', '{0} degats: {1}-{2}'],
  ], show);
  assert.deepEqual(en, {
    table: [['Affiliation', 'Rank'], ['The Fighters Guild', 'Swordsman (rep:37)']],
    level: ['Progress made to the next level: 46%'], name: 'Enter new name : ',
    refusal: [['You must distribute all bonus points.'], 'You must distribute all bonus points.'],
    hth: en.hth, maker: 'Enter new name : ',
  });
  assert.match(en.hth, /^Hand-to-Handdmg:\d+-\d+$/, 'hthDamageFormatString: the skill\'s name, then its live damage');
  assert.deepEqual(fr, {
    table: [['Affiliation (fr)', 'Rang'], ['The Fighters Guild', 'Swordsman (rép. 37)']],
    level: ['Vers le niveau suivant : 46 %'], name: 'Nouveau nom : ',
    refusal: [['Répartissez tous les points.'], 'Répartissez tous les points.'],
    hth: en.hth.replace('dmg', 'degats'), maker: 'Nouveau nom : ',
  });
});

test('L10N3d windows - the enhanced pause menu\'s Skills page draws the hand-to-hand line through the language\'s pattern', () => {
  const was = { ...playerEntity };
  createCharacter(playerEntity, {
    name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0, strength: 60, intelligence: 40, willpower: 45, agility: 55, endurance: 60,
    personality: 40, speed: 50, luck: 50, primarySkills: [SKILLS.HandToHand, SKILLS.Axe, SKILLS.CriticalStrike],
    majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping], minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
  }, 16, { rolls: () => 0 });
  try {
    const show = () => {
      const host = pauseMenu('stats', {});
      all(host).find((n) => n.tagName === 'BUTTON' && n.textContent.includes('Skills')).click();
      return /Hand-to-Hand (dmg|degats): \d+-\d+/.exec(host.textContent)?.[0] ?? null;
    };
    const { en, fr } = inFrench([['hthDamageFormatString', '{0} degats: {1}-{2}']], show);
    assert.match(en, /^Hand-to-Hand dmg: \d+-\d+$/);
    assert.equal(fr, en.replace('dmg', 'degats'));
  } finally {
    for (const k of Object.keys(playerEntity)) if (!(k in was)) delete playerEntity[k];
    Object.assign(playerEntity, was);
  }
});

// ─── the potion maker, the travel map, the prison and the bookshelf ─────────────────────────────────────────────

test('L10N3d windows - the potion maker\'s four boxes, the travel map\'s region switch and find prompt, the prison screen\'s count (%d replaced, through the grammar) and the guild library\'s refusal speak the language', () => {
  const ing = (t) => ({ templateIndex: t, stackCount: 1 });
  const potions = (pack, recipeKeys = []) => new PotionMakerWindow({
    packItems: () => pack, wagonItems: () => [], gold: () => 0, recipeKeys: () => recipeKeys, addPotion() {},
    takeOne: (t) => { const i = pack.findIndex((x) => x.templateIndex === t); if (i < 0) return false; pack.splice(i, 1); return true; },
    icons: ICONS, entity: {}, onClose() {},
  });
  const box = (w) => w.box.rows[0].text;
  const press = (w, key) => { const [x, y, rw, rh] = POTION_RECTS[key]; w.click(x + rw / 2, y + rh / 2); };
  const slowFalling = POTION_RECIPES.find((r) => r.name === 'slowFalling');
  const show = () => {
    const mixed = potions([ing(59), ing(26), ing(24)]); mixed.cauldron = [ing(59), ing(26), ing(24)]; press(mixed, 'mix');
    const failed = potions([ing(8), ing(9), ing(10)]); failed.cauldron = [ing(8), ing(9), ing(10)]; press(failed, 'mix');
    const none = potions([]); press(none, 'recipes');
    const short = potions([ing(59)], [potionRecipeKey(slowFalling.ingredients)]); short._fillFrom(slowFalling);
    const map = new TravelMapWindow({});
    map.selectedRegion = 17;
    map.mouseOverRegion = 23;
    map._click = () => {};
    map._findLocationButtonClick();
    const prison = new PrisonScreenWindow({ daysInPrison: 3 });
    prison.updatePrisonScreen();
    return {
      potions: [box(mixed), box(failed), box(none), box(short)],
      map: [map.regionLabelText(), map.findBox.label],
      prison: [daysUntilFreedomText(7), prison.label, daysUntilFreedomText(3, () => 'libre dans %d')],
      shelf: bookshelfAccess({ buildingType: BUILDING_TYPES.GuildHall, guild: null }).text,
    };
  };
  const { en, fr } = inFrench([
    ['potionMixed', 'Potion préparée.'], ['potionFailed', 'Mélange raté.'], ['noRecipes', 'Aucune recette.'], ['reqIngredients', 'Ingrédients manquants.'],
    ['switchToRegion', 'Aller à : région de {0}'], ['findLocationPrompt', 'Nom du lieu : '],
    ['daysUntilFreedom', '%d jours avant la liberté.'], ['accessMembersOnly', 'Réservé aux membres de rang suffisant.'],
  ], show);
  assert.deepEqual(en, {
    potions: ['Your potion has been mixed.', 'Those ingredients did not concoct an effective potion.', 'You have no recipes.', 'You do not have the ingredients required.'],
    map: ['Switch To: Wayrest Region', 'Enter name of place : '],
    prison: ['7 days until freedom.', '2 days until freedom.', 'libre dans 3'],
    shelf: 'You need to be a member of sufficient rank to access this.',
  });
  assert.deepEqual(fr, {
    potions: ['Potion préparée.', 'Mélange raté.', 'Aucune recette.', 'Ingrédients manquants.'],
    map: ['Aller à : région de Wayrest', 'Nom du lieu : '],
    prison: ['7 jours avant la liberté.', '2 jours avant la liberté.', 'libre dans 3'],
    shelf: 'Réservé aux membres de rang suffisant.',
  }, 'a host\'s own TextManager answer still wins over the table (the prison screen\'s seam)');
  assert.equal(daysUntilFreedomText(3, () => ''), '3 days until freedom.', 'an empty host answer reads the text core');
  const grammar = tm.GrammarManager.grammarProcessor;
  tm.GrammarManager.grammarProcessor = { processGrammar: (t) => t.toUpperCase() };
  try {
    assert.equal(daysUntilFreedomText(4), '4 DAYS UNTIL FREEDOM.', 'ProcessGrammar over the replaced label (DaggerfallCourtWindow.cs:469, :523)');
  } finally { tm.GrammarManager.grammarProcessor = grammar; }
});
