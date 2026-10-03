// L10N3e (2026-09-27): THE NAMES OF THINGS, IN THE PLAYER'S LANGUAGE - the things batch. DFU names an item, a magic
// item and a spell through TextManager by the thing's own id - Internal_Items by the item TEMPLATE's index,
// Internal_MagicItems by the MAGIC.DEF template's (its record's stream position), Internal_Spells by the SPELLS.STD
// index - and the soul in a soul trap by its MobileTypes id (the enemyNames list). DFU writes an item's shortName in
// the language once, at the mint (DaggerfallUnityItem.cs:551/:602, ItemBuilder.cs:588), and a stock spell's bundle
// Name at the conversion (EntityEffectBroker.cs:877). The port keeps the canonical name on the item and on the book's
// spell - a key the saves, the artifact test, the Arrow filters and the boat test read - and looks the name up where it
// is shown. Pinned through the port's own functions and windows: a made-up French row reaches the screen, English
// reads byte for byte as before (with no language chosen and with English chosen again), and the key path still sees
// the canonical name.
import './modsOff.js';
import './chargenDom.mjs';   // a minimal DOM (globals): the enhanced spellbook mounts under it
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { resolveItemName, itemLongName, itemNameParts, expandItemInfo, potionRecipeIngredientNames, shownItemName } from '../src/systems/itemInfo.js';
import { setMagicItemTemplates, setSpellRecordsByIndex, createArtifact, legacyGetArtifactSubType, shownSpellName } from '../src/systems/loot.js';
import { SOUL_TRAP_TEMPLATE } from '../src/systems/mysticism.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { POTION_RECIPES, potionRecipeKey } from '../src/systems/potions.js';
import { equipItem } from '../src/systems/equip.js';
import { NativeInventoryWindow, INV_RECTS } from '../src/ui/nativeInventory.js';
import { CELL_X } from '../src/ui/itemScroller.js';
import { enchantmentParams, enchantmentParamName, enchantmentParamValues, enchantmentSettings, primaryPick, PARAM_NONE } from '../src/systems/enchantmentCatalogue.js';
import { magicPowersLines } from '../src/systems/itemPowers.js';
import { ItemMakerWindow, itemMakerFilter } from '../src/ui/itemMakerWindow.js';
import { createUseMagicItemWindow } from '../src/ui/useMagicItemWindow.js';
import { decorItemName } from '../src/systems/decorItems.js';
import { SpellbookWindow, spellRowText, _setSpellbookArtForTests } from '../src/ui/spellbookWindow.js';
import { _setSpellIconsForTests } from '../src/ui/spellIcons.js';
import { bookModel, mountEnhancedSpellbook } from '../src/ui/enhancedSpellbook.js';
import { setSpellQuickslot, resolveSpellQuickslot, quickslotSaveData, clearQuickslots, hotbarEntryForSpell, setHotbarSlot, hotbarView, cycleQuickslot } from '../src/systems/quickslots.js';
import { mountHotbarDock, hotbarDropSpell, toggleHotbarSpell } from '../src/ui/enhancedHotbar.js';
import { withDom } from './invdrag.mjs';
import { applySpell } from '../src/systems/effects.js';
import { activeSpellIcons } from '../src/ui/hudActiveSpells.js';
import { snapshotPlayer } from '../src/systems/save.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';

beforeEach(() => {
  tm._resetTextManagerForTests();
  setMagicItemTemplates(null);
  setSpellRecordsByIndex(null);
  clearQuickslots();
});
/** `rows` into a table of the French locale (not chosen yet). */
const frRows = (table, rows) => tm.patchLocaleTable('fr', table, rows);
/** `show()` in English, again with the French rows in (English still chosen), then in French, then in English once
 *  more. Answers { en, fr }, holding every English read to the first. */
function inFrench(tables, show) {
  const en = show();
  for (const [table, rows] of Object.entries(tables)) frRows(table, rows);
  assert.deepEqual(show(), en, 'English stands until French is chosen');
  tm.setLocale('fr');
  const fr = show();
  tm.setLocale('en');
  assert.deepEqual(show(), en, 'English again, byte for byte');
  return { en, fr };
}
/** The enemyNames list, 62 rows, with `over` (row -> name) in it. */
const enemyNames = (over) => Array.from({ length: 62 }, (_, i) => over[i] ?? `Ennemi ${i}`).join('\n');
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const quietly = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

// Two MAGIC.DEF rows, at their real indices (the record's stream position, 4 + 62 x record): Azura's Star (record 9,
// an artifact) and "%it of Venom Antidote" (record 17, a regular magic item). The rest of each row is the fixture's.
const AZURAS_STAR = { index: 562, name: 'Azura\'s Star', type: 1, group: 14, groupIndex: 0, enchantments: [{ type: 26, param: 9 }], uses: 50, value: 5000, material: 0 };
const VENOM = { index: 1058, name: '%it of Venom Antidote', type: 0, group: 2, groupIndex: 0, enchantments: [{ type: 0, param: 15 }], uses: 30, value: 0, material: 0 };
const dagger = (over = {}) => ({ group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 1, isIdentified: true, ...over });

test('L10N3e things: an item\'s names - its template\'s by the template index (ItemHelper.cs:268), its own shortName while it is still that template\'s (DaggerfallUnityItem.cs:551) - in the player\'s language; a made name stands, and the item keeps its canonical name', () => {
  const d = dagger();
  const unknown = dagger({ name: '%it of Venom Antidote', magic: true, isIdentified: false, enchantments: [{ type: 0, param: 15 }] });
  const made = dagger({ name: 'Mac\'s Blade' });
  const arrow = { group: 'Weapons', templateIndex: ARROW_TEMPLATE, name: 'Arrow' };
  // an identified book with no title to read (ResolveItemName's Books arm, :279-280): its shortName stands
  const book = { group: 'Books', templateIndex: 277, name: 'Book', message: -1, isIdentified: true };
  const show = () => ({
    name: resolveItemName(d), long: itemLongName(d), part: itemNameParts(d).name, info: expandItemInfo('[%it]', d), own: shownItemName(d),
    unknown: [resolveItemName(unknown), expandItemInfo('%it', unknown)], made: itemLongName(made), arrow: itemLongName(arrow),
    book: expandItemInfo('%it', book),
  });
  const { en, fr } = inFrench({ Internal_Items: [['113', 'Poignard factice'], [String(ARROW_TEMPLATE), 'Trait factice'], ['277', 'Livre factice']] }, show);
  assert.deepEqual(en, {
    name: 'Dagger', long: 'Steel Dagger', part: 'Dagger', info: '[Dagger]', own: 'Dagger',
    unknown: ['Dagger', 'Dagger'], made: 'Steel Mac\'s Blade', arrow: 'Arrow', book: 'Book',
  });
  assert.deepEqual(fr, {
    name: 'Poignard factice', long: 'Steel Poignard factice', part: 'Poignard factice', info: '[Poignard factice]', own: 'Poignard factice',
    unknown: ['Poignard factice', 'Poignard factice'], made: 'Steel Mac\'s Blade', arrow: 'Trait factice', book: 'Livre factice',
  });
  // THE KEY PATH: the item still carries the canonical name, and the filters that test it for "Arrow" still find one
  tm.setLocale('fr');
  assert.equal(d.name, 'Dagger');
  assert.equal(itemMakerFilter(arrow, 'WeaponsAndArmor'), false, 'the item maker\'s Arrow test reads the canonical name');
  assert.equal(itemMakerFilter(d, 'WeaponsAndArmor'), true);
  // A pack's grammar markers pass through untouched - the French grammar processor is the lead's (rule 4)
  frRows('Internal_Items', [['113', '{.FS}lame factice']]);
  assert.equal(itemLongName(d), 'Steel {.FS}lame factice');
});

test('L10N3e things: a magic item\'s shortName by its MAGIC.DEF template\'s index - an artifact\'s (DaggerfallUnityItem.cs:602) and a regular one\'s, its %it filled with the template\'s name as shown (ItemBuilder.cs:588, ItemHelper.cs:287) - while the item keeps the canonical name LegacyGetArtifactSubType reads', () => {
  setMagicItemTemplates([AZURAS_STAR, VENOM]);
  const star = createArtifact([AZURAS_STAR, VENOM], 0);
  const venom = dagger({ name: VENOM.name, magic: true, enchantments: VENOM.enchantments });
  const lookalike = dagger({ name: 'Azura\'s Star' });   // a made item a player named after the artifact: not the artifact
  const show = () => ({
    star: [resolveItemName(star), itemLongName(star), expandItemInfo('%it', star)],
    venom: [resolveItemName(venom), itemLongName(venom)],
    lookalike: resolveItemName(lookalike),
  });
  const { en, fr } = inFrench({
    Internal_MagicItems: [['562', 'Astre factice'], ['1058', '%it du contrepoison']],
    Internal_Items: [['113', 'Poignard factice']],
  }, show);
  assert.deepEqual(en, {
    star: ['Azura\'s Star', 'Azura\'s Star', 'Azura\'s Star'],
    venom: ['Dagger of Venom Antidote', 'Steel Dagger of Venom Antidote'],
    lookalike: 'Azura\'s Star',
  });
  assert.deepEqual(fr, {
    star: ['Astre factice', 'Astre factice', 'Astre factice'],
    venom: ['Poignard factice du contrepoison', 'Steel Poignard factice du contrepoison'],
    lookalike: 'Azura\'s Star',
  });
  tm.setLocale('fr');
  assert.equal(star.name, 'Azura\'s Star', 'the mint wrote the canonical name');
  assert.equal(legacyGetArtifactSubType(star.name), 9, 'and the artifact test still finds Azuras_Star by it');
  assert.equal(venom.name, '%it of Venom Antidote');
  // Before MAGIC.DEF is registered there is no index to look by: the canonical name stands
  setMagicItemTemplates(null);
  assert.equal(resolveItemName(star), 'Azura\'s Star');
  // The piece a visitor sees set down in a house names an artifact by the same row
  setMagicItemTemplates([AZURAS_STAR, VENOM]);
  assert.equal(decorItemName({ t: 113, g: 3, a: 0 }), 'Astre factice');
});

test('L10N3e things: a soul trap names its soul by the soul\'s MobileTypes id - the long name\'s suffix (ItemHelper.cs:361) and %hs (DaggerfallUnityItemMCP.cs:227) - and the trap keeps its soul type', () => {
  const trap = { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, name: 'Soul Trap', isIdentified: true, trappedSoulType: 23 };
  const empty = { ...trap, trappedSoulType: null };
  const show = () => ({ long: itemLongName(trap), held: expandItemInfo('%hs', trap), none: expandItemInfo('%hs', empty), plain: itemLongName(empty) });
  const { en, fr } = inFrench({
    Internal_Strings: [['enemyNames', enemyNames({ 23: 'Spectre factice' })]],
    Internal_Items: [[String(SOUL_TRAP_TEMPLATE), 'Piege factice']],
  }, show);
  assert.deepEqual(en, { long: 'Soul Trap (Wraith)', held: 'Wraith', none: 'Nothing', plain: 'Soul Trap' });
  assert.deepEqual(fr, { long: 'Piege factice (Spectre factice)', held: 'Spectre factice', none: 'Nothing', plain: 'Piege factice' });
  assert.equal(trap.trappedSoulType, 23);
});

test('L10N3e things: a potion recipe\'s ingredients are their templates\' names as shown (DaggerfallUnityItemMCP.cs:254) - the enhanced card\'s list and the classic Info box\'s one list', () => {
  const resistFire = POTION_RECIPES[0];
  const recipe = { group: 'MiscItems', templateIndex: 278, potionRecipeKey: potionRecipeKey(resistFire.ingredients) };
  const infoBox = () => {
    const bag = [recipe];
    const e = { stats: { strength: 80 }, items: bag };
    const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: e, rows: (id) => [{ text: `RECORD ${id}`, center: false }] });
    w.tab = 'clothing';
    w.mode = 'info';
    w.click(INV_RECTS.localList[0] + CELL_X + 5, INV_RECTS.localList[1] + 5);
    return w.boxes[1].rows.map((r) => r.text);
  };
  const show = () => ({ card: potionRecipeIngredientNames(recipe), box: infoBox() });
  const [amber, , cactus] = resistFire.ingredients;
  const { en, fr } = inFrench({ Internal_Items: [[String(amber), 'Ambre factice'], [String(cactus), 'Cactus factice']] }, show);
  assert.deepEqual(en.card, ['Amber', 'Red Flowers', 'Cactus', 'Fairy Dragon\'s Scales', 'Ichor']);
  assert.deepEqual(fr.card, ['Ambre factice', 'Red Flowers', 'Cactus factice', 'Fairy Dragon\'s Scales', 'Ichor']);
  assert.deepEqual(en.box, en.card, 'the classic box reads the same list');
  assert.deepEqual(fr.box, fr.card);
});

test('L10N3e things: the inventory\'s "Equipping %s" names the hand\'s weapon by its template index (DaggerfallInventoryWindow.cs:738/750)', () => {
  const cue = () => {
    const e = { items: [], stats: {} };
    const said = [];
    const w = new NativeInventoryWindow({ items: () => e.items, entity: e, icons: ICONS, say: (m) => said.push(m) });
    equipItem(e, { group: 'Weapons', templateIndex: 123 });
    w._closeSilently();
    return said;
  };
  const { en, fr } = inFrench({ Internal_Items: [['123', 'Katana factice']], Internal_Strings: [['equippingWeapon', 'Vous equipez %s']] }, cue);
  assert.deepEqual(en, ['Equipping Dai-katana']);
  assert.deepEqual(fr, ['Vous equipez Katana factice']);
});

test('L10N3e things: an enchantment\'s second name - a CastWhen* spell by its id (CastWhenUsed/Held/Strikes.cs:67), a bound soul by its MobileTypes id (SoulBound.cs:64) - in the picker (alpha-sorted as shown) and the powers box (%mpw, DaggerfallUnityItemMCP.cs:354); the params, the keys, never move', () => {
  const enchanted = { enchantments: [{ type: 0, param: 14 }, { type: 15, param: 23 }] };
  const pick = () => primaryPick('CastWhenUsed').options;
  const show = () => ({
    used: enchantmentParamName('CastWhenUsed', 14), strikes: enchantmentParamName('CastWhenStrikes', 50), soul: enchantmentParamName('SoulBound', 23),
    held: enchantmentParams('CastWhenHeld')[0], last: pick().at(-1).label, powers: magicPowersLines(enchanted, { identified: true }),
  });
  const { en, fr } = inFrench({
    Internal_Spells: [['14', 'Boule factice'], ['50', 'Torpeur factice'], ['37', 'Chute factice'], ['4', 'Zenith factice']],
    Internal_Strings: [['enemyNames', enemyNames({ 23: 'Spectre factice' })]],
  }, show);
  assert.deepEqual(en, {
    used: 'Fireball', strikes: 'Paralysis', soul: 'Wraith', held: 'Slowfalling', last: 'Wizard\'s Fire',
    powers: ['Cast when used: Fireball', 'Soul bound Wraith'],
  });
  assert.deepEqual(fr, {
    used: 'Boule factice', strikes: 'Torpeur factice', soul: 'Spectre factice', held: 'Chute factice', last: 'Zenith factice',
    powers: ['Cast when used: Boule factice', 'Soul bound Spectre factice'],
  });
  tm.setLocale('fr');
  assert.equal(pick().at(-1).param, 4, 'the picker sorts the names it shows, as DFU sorts SecondaryDisplayName');
  assert.deepEqual(enchantmentParamValues('CastWhenUsed').slice(0, 3), [4, 5, 6], 'the params are the ids, in mint order');
  assert.equal(enchantmentSettings('CastWhenUsed', 14).key, 'CastWhenUsed:14');
});

test('L10N3e things: the item maker\'s name label reads the shortName as shown (DaggerfallItemMakerWindow.cs:602); an untouched label leaves the canonical name on the item, a typed one is written (RenameItem, :761)', () => {
  const make = () => {
    const ruby = { group: 'Gems', templateIndex: 0, name: 'Ruby' };
    const player = { items: [ruby], goldPieces: 100000 };
    const w = new ItemMakerWindow({ packItems: () => player.items, player, entity: player, icons: ICONS });
    w._selectItem(ruby);
    return { w, ruby };
  };
  const { en, fr } = inFrench({ Internal_Items: [['0', 'Rubis factice']] }, () => make().w.labels().itemName);
  assert.equal(en, 'Ruby');
  assert.equal(fr, 'Rubis factice');
  tm.setLocale('fr');
  const kept = make();
  kept.w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];
  kept.w._enchant();
  assert.equal(kept.ruby.enchantments.length, 1, 'enchanted');
  assert.equal(kept.ruby.name, 'Ruby', 'the label showed its own name: the canonical one stays');
  assert.equal(itemLongName(kept.ruby), 'Rubis factice');
  const renamed = make();
  renamed.w.itemName = 'Pierre de Mac';
  renamed.w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];
  renamed.w._enchant();
  assert.equal(renamed.ruby.name, 'Pierre de Mac', 'a name the player gave is written');
});

test('L10N3e things: the use-magic-item list names each item by its own name as shown', () => {
  const rows = () => createUseMagicItemWindow({ items: [dagger({ enchantments: [{ type: 0, param: 14 }] })], isEnchanted: () => true }).items;
  const { en, fr } = inFrench({ Internal_Items: [['113', 'Poignard factice']] }, rows);
  assert.deepEqual(en, ['Dagger']);
  assert.deepEqual(fr, ['Poignard factice']);
});

// ─── the spells ───────────────────────────────────────────────────────────────────────────────────────────────────

const effect = (type, subType) => ({ type, subType });
const EMPTY = effect(-1, -1);
/** A SPELLS.STD record's shape (formats/spellsStd.js). */
const record = (index, name, over = {}) => ({ index, name, cost: 5, icon: 3, element: 4, rangeType: 0, effects: [effect(14, -1), EMPTY, EMPTY], ...over });
const LEVITATE = record(4, 'Levitate');
const FIREBALL = record(14, 'Fireball', { rangeType: 2, element: 0, effects: [effect(0, 0), EMPTY, EMPTY] });
const LIGHT = record(5, 'Light');
const LYCANTHROPY = record(92, '!Lycanthropy');
const registry = () => setSpellRecordsByIndex(new Map([LEVITATE, FIREBALL, LIGHT, LYCANTHROPY].map((r) => [r.index, r])));
const SPELL_ROWS = { Internal_Spells: [['4', 'Envol'], ['14', 'Brasier'], ['5', 'Aube'], ['92', 'Garou']] };

test('L10N3e things: a stock spell\'s name by its SPELLS.STD index while it is still the stock spell\'s own (EntityEffectBroker.cs:877) - the lycanthropy gift with its \'!\' dropped too; a renamed spell, a made one and every spell before SPELLS.STD is registered show the name they carry', () => {
  const book = [{ ...LEVITATE }, { ...FIREBALL, name: 'Big Boom', custom: true }, { ...LIGHT, index: -3, custom: true }, { ...LYCANTHROPY, name: 'Lycanthropy', custom: true }];
  const show = () => book.map(shownSpellName);
  const unregistered = inFrench(SPELL_ROWS, show);
  assert.deepEqual(unregistered.fr, unregistered.en, 'no registry, no stock spell to hold a name to');
  tm._resetTextManagerForTests();
  registry();
  const { en, fr } = inFrench(SPELL_ROWS, show);
  assert.deepEqual(en, ['Levitate', 'Big Boom', 'Light', 'Lycanthropy']);
  assert.deepEqual(fr, ['Envol', 'Big Boom', 'Light', 'Garou']);
  assert.equal(shownSpellName(null), undefined, 'nothing answers as it is');
});

test('L10N3e things: the spellbook lists, labels and sorts by the Name it shows - the book\'s rows and label (:271, :549), SortSpellsAlpha (DaggerfallEntity.cs:736), the shop\'s offer (:322) - and a rename handed back untouched keeps the canonical name', () => {
  registry();
  const canvas = { width: 320, height: 200 };
  const drawn = (w) => {
    const chars = [];
    const font = { fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; } } };
    _setSpellbookArtForTests({ base: { tex: 'spbk00', w: 320, h: 200 }, buy: { tex: 'spbk01', w: 320, h: 200 } });
    _setSpellIconsForTests({ icons: { tex: 'icon00', w: 320, h: 64 }, mask: { tex: 'mask04', w: 40, h: 80 } });
    try { w.draw({ uploadTexture: () => 'tex', drawScreenQuad() {}, drawScreenQuadRun() {} }, canvas, font); } finally { _setSpellbookArtForTests(null); _setSpellIconsForTests(null); }
    return chars.join('');
  };
  const cast = (spells) => new SpellbookWindow({ spells: () => spells, entity: { magicka: 20, maxMagicka: 40, spells }, castCost: (sp) => sp.cost, onReady() {}, rows: () => [] });
  const shop = () => new SpellbookWindow({ offered: () => [LEVITATE, FIREBALL, LIGHT, LYCANTHROPY], entity: { items: [] }, castCost: (sp) => sp.cost, rows: () => [] }, { buyMode: true });
  const show = () => {
    const book = [{ ...LIGHT }, { ...FIREBALL }, { ...LEVITATE }];
    const w = cast(book);
    const painted = drawn(w);
    w.confirmSort(true);
    return {
      row: spellRowText(LEVITATE, 5), painted: ['5-Light', 'Light'].map((s) => painted.includes(s)), paintedFr: painted.includes('5-Aube'),
      sorted: book.map((sp) => sp.name), offer: shop().loadSpellsForSale().map((sp) => sp.name),
    };
  };
  const { en, fr } = inFrench(SPELL_ROWS, show);
  assert.deepEqual(en, { row: '5 - Levitate', painted: [true, true], paintedFr: false, sorted: ['Fireball', 'Levitate', 'Light'], offer: ['Fireball', 'Levitate', 'Light'] });
  assert.deepEqual(fr, { row: '5 - Envol', painted: [false, false], paintedFr: true, sorted: ['Light', 'Fireball', 'Levitate'], offer: ['Light', 'Fireball', 'Levitate'] },
    'Aube, Brasier, Envol: the order of the names shown; the book keeps its canonical names');
  // THE RENAME: the box opens on the Name as shown; handed back as it was, the spell keeps its canonical name
  tm.setLocale('fr');
  const spells = [{ ...LEVITATE }];
  const w = cast(spells);
  w.renameButton();
  assert.equal(w.renameBox.value, 'Envol');
  w.input('Enter');
  assert.equal(spells[0].name, 'Levitate', 'untouched: the canonical name');
  assert.equal(shownSpellName(spells[0]), 'Envol');
  w.renameButton();
  w.renameBox.value = 'Mon envol';
  w.input('Enter');
  assert.equal(spells[0].name, 'Mon envol', 'a typed name is the player\'s');
  assert.equal(snapshotPlayer({ stats: {}, skills: [], skillUses: [], items: [], spells }, {}).spells[0].name, 'Mon envol');
});

test('L10N3e things: the enhanced book\'s rail and page read the Name as shown, and its rename field hands an untouched name back as the canonical one', () => {
  registry();
  const { en, fr } = inFrench(SPELL_ROWS, () => bookModel([{ ...LEVITATE }, { ...LIGHT, name: 'Glow', custom: true }], (sp) => sp.cost).map((r) => r.name));
  assert.deepEqual(en, ['Levitate', 'Glow']);
  assert.deepEqual(fr, ['Envol', 'Glow']);
  tm.setLocale('fr');
  const spells = [{ ...LEVITATE }];
  const all = (n, out = []) => { for (const c of n.children ?? []) { out.push(c); all(c, out); } return out; };
  const host = document.createElement('div');
  const was = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const book = mountEnhancedSpellbook(host, { spells: () => spells, castCost: (sp) => sp.cost, entity: { magicka: 20, spells, items: [] } });
    assert.ok(all(host).some((n) => n.tagName === 'H3' && n.textContent === 'Envol'), 'the page\'s title');
    all(host).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Rename').click();
    const input = all(host).find((n) => n.tagName === 'INPUT');
    assert.equal(input.value, 'Envol', 'the field opens on the name as shown');
    all(host).find((n) => n.tagName === 'FORM').onsubmit({ preventDefault() {} });
    book.destroy();
  } finally { globalThis.window = was; }
  assert.equal(spells[0].name, 'Levitate', 'untouched: the canonical name');
});

test('L10N3e things: the spell slot, the hotbar and the active-spell icons draw the Name as shown, while the slot\'s save and the cast\'s bundle keep the canonical name - the boat test\'s key', () => {
  registry();
  const entity = { spells: [{ ...LEVITATE }], activeEffects: [], stats: { luck: 50, willpower: 50 }, skills: [], level: 1, maxMagicka: 40 };
  setSpellQuickslot(entity.spells[0]);
  setHotbarSlot(0, hotbarEntryForSpell(entity.spells[0]));
  quietly(() => applySpell({ ...LEVITATE, effects: [{ ...effect(14, 255), durationBase: 10, durationMod: 1, durationPerLevel: 1, chanceBase: 100, chanceMod: 1, chancePerLevel: 1, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 1, magnitudeLevelHigh: 1, magnitudePerLevel: 1 }, EMPTY, EMPTY] },
    1, entity, {}, () => 0.5, null, {}));
  const icon = () => [...activeSpellIcons(entity).self, ...activeSpellIcons(entity).other][0]?.displayName;
  const show = () => ({ slot: resolveSpellQuickslot(entity).name, hotbar: hotbarView(entity)[0].name, icon: icon(), ghost: resolveSpellQuickslot({ spells: [] }).name,
    // a hotbar entry whose spell has left the book draws the name it was slotted with, as shown
    hotbarGhost: hotbarView({ ...entity, spells: [] })[0].name,
    // the slot's cycle says what it chose (the HUD's linger line)
    cycled: cycleQuickslot('spell', { entity }).name });
  const { en, fr } = inFrench(SPELL_ROWS, show);
  assert.deepEqual(en, { slot: 'Levitate', hotbar: 'Levitate', icon: 'Levitate', ghost: 'Levitate', hotbarGhost: 'Levitate', cycled: 'Levitate' });
  assert.deepEqual(fr, { slot: 'Envol', hotbar: 'Envol', icon: 'Envol', ghost: 'Envol', hotbarGhost: 'Envol', cycled: 'Envol' });
  // the enhanced bar (under the inventory tests' DOM, as ui2_hotbar's own tests mount it): the caption a drop raises,
  // and the toggle's two lines
  const find = (n, cls) => (String(n?.className ?? '').split(/\s+/).includes(cls) ? n : (n?.children ?? []).map((c) => find(c, cls)).find(Boolean) ?? null);
  const lines = withDom((dom) => {
    const make = dom.doc.createElement;
    dom.doc.createElement = (tag) => Object.assign(make(tag), { removeAttribute(k) { delete this.attrs[k]; } });
    const dock = dom.mk('div'); dom.body.append(dock);
    mountHotbarDock(dock);
    const caption = find(dock, 'hb-caption');
    assert.ok(caption, 'the bar\'s caption is mounted');
    return inFrench(SPELL_ROWS, () => {
      hotbarDropSpell(1, entity.spells[0]);
      const dropped = caption.textContent;
      const off = toggleHotbarSpell(entity.spells[0]);   // on slots 0 and 1 now: the first found comes off
      const on = toggleHotbarSpell(entity.spells[0]);    // and goes back on the first free slot
      toggleHotbarSpell(entity.spells[0]);
      setHotbarSlot(0, hotbarEntryForSpell(entity.spells[0]));
      setHotbarSlot(1, null);
      return { dropped, off, on };
    });
  });
  assert.deepEqual(lines.en, { dropped: 'Levitate is on hotbar slot 2.', off: 'Levitate is off the hotbar.', on: 'Levitate is on hotbar slot 1.' });
  assert.deepEqual(lines.fr, { dropped: 'Envol is on hotbar slot 2.', off: 'Envol is off the hotbar.', on: 'Envol is on hotbar slot 1.' });
  tm.setLocale('fr');
  assert.deepEqual(quickslotSaveData().spell, { index: 4, name: 'Levitate' }, 'the save keeps the canonical name');
  assert.equal(quickslotSaveData().hotbar[0].name, 'Levitate');
  const tagged = entity.activeEffects.find((a) => a.bundleId != null);
  assert.equal(tagged.bundleName, 'Levitate', 'the bundle keeps the canonical name');
  assert.equal(tagged.bundleSpellIndex, 4, 'and the index a window shows it by');
});
