// S1: the effect CATALOG (every row DFU's Spell Maker offers, with
// the support flags that gate the settings editor's panels).
//
// ROAD-E E8: ...and the NATIVE window - DaggerfallSpellMakerWindow on
// INFO01I0 art. The window half of this file used to drive a keyed
// text sheet (a cursor, ENTER, `w._rows()`); it drives DFU's own hit
// rects now, because that is what the window is. Every pin below
// clicks where a player clicks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPELL_MAKER_EFFECTS, STAT_SUBGROUPS, PORTED_KEYS,
  spellMakerGroups, spellMakerSubgroups, effectByKey,
  spellMakerDescriptionId, spellBookDescriptionId,
} from '../src/systems/spellEffects.js';
import {
  SpellMakerWindow, TARGET_LABELS, ELEMENT_LABELS,
  SPELL_MAKER_RECTS, EFFECT_NAME_PANELS, EFFECT_PANEL_X,
  SPELL_MAKER_LABELS, SPELL_MAKER_TIPS, SPELL_MAKER_TEXT,
  EDITOR_RECTS, SPINNER_UP, SPINNER_DOWN, SPINNER_VALUE, spinnerPart,
  SELECT_SUBRECTS, TARGET_BUTTONS, ELEMENT_BUTTONS,
} from '../src/ui/spellMakerWindow.js';
import {
  SPELLBOOK_TEMPLATE_INDEX, _resetCustomIndexForTests, blankEffectSettings,
  SPELL_ICON_COUNT, editedEffectCost,
} from '../src/systems/spellMaker.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const player = (gold = 100000, extra = []) => ({
  name: 'S', level: 1, stats: {}, skills: [50], maxMagicka: 40,
  goldPieces: gold,   // E4: PlayerEntity.GoldPieces
  items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }, ...extra],
  spells: [],
});
const win = (gold, extra) => new SpellMakerWindow({ entity: player(gold, extra) });
/** A click one pixel inside a named button rect. */
const press = (w, key) => {
  const [x, y] = SPELL_MAKER_RECTS[key];
  w.click(x + 1, y + 1);
  return w;
};
/** Walk the two pickers onto one catalogue row, the way a player does. */
const addEffect = (w, group, subgroup) => {
  press(w, 'addEffect');
  w.picker.selectedIndex = spellMakerGroups().indexOf(group);
  w.picker.input('Enter');
  if (subgroup !== undefined) {
    w.picker.selectedIndex = spellMakerSubgroups(group).findIndex((e) => e.subgroup === subgroup);
    w.picker.input('Enter');
  }
  return w;
};

test('S1 catalog: DFU offers 90 spell-maker effects, families expanded in DFCareer.Stats order', () => {
  // U42 turned this table into the BROKER's registry rather than the
  // maker's offer list: the spellbook names an effect through
  // GetEffectTemplate, which sees rows no crafting station offers.
  // The OFFER is still exactly 90 - what `craftable` gates.
  assert.equal(SPELL_MAKER_EFFECTS.filter((e) => e.craftable).length, 90, 'the maker offers 90');
  assert.equal(SPELL_MAKER_EFFECTS.length, 91, 'and the registry carries one more (MorphSelf)');
  // PERSONALITY is stat 5, ahead of Speed - the classic subType order
  assert.deepEqual(STAT_SUBGROUPS, ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Endurance', 'Personality', 'Speed', 'Luck']);
  assert.equal(effectByKey('9,5').name, 'Fortify Attribute Personality');
  assert.equal(effectByKey('9,6').name, 'Fortify Attribute Speed');
  // Heal and Transfer run past the stats to Health 8 / Fatigue 9;
  // Fortify and Drain stop at Luck 7
  assert.equal(effectByKey('10,8').name, 'Heal Health');
  assert.equal(effectByKey('11,9').name, 'Transfer Fatigue');
  assert.equal(effectByKey('9,8'), null);
  assert.equal(effectByKey('7,8'), null);
  // DisplayName = "{GroupName} {SubGroupName}", or the group alone
  assert.equal(effectByKey('0,255').name, 'Paralyze');
  assert.equal(effectByKey('4,0').name, 'Damage Health');
});

test('S1 catalog: the support flags gate the editor panels, per DFU class', () => {
  const f = (k) => { const e = effectByKey(k); return [e.duration, e.chance, e.magnitude]; };
  assert.deepEqual(f('4,0'), [false, false, true], 'Damage Health is magnitude only');
  assert.deepEqual(f('0,255'), [true, true, false], 'Paralyze is duration + chance');
  assert.deepEqual(f('35,255'), [true, false, true], 'Shield is duration + magnitude');
  assert.deepEqual(f('43,255'), [false, false, false], 'Teleport has no settings at all');
  // Charm's SupportDuration is COMMENTED OUT in this build - chance
  // only, kept as the build has it rather than as the wiki reads
  assert.deepEqual(f('34,255'), [false, true, false]);
  // MorphSelf carries a classic key but is not offered at this
  // station (MorphSelf.cs:30). It IS in the registry, because the
  // spellbook has to be able to NAME it - U42 found a 29,255 spell
  // printing "<effect not found>" - so the pin is that it is present
  // and NOT craftable, and that neither picker list can reach it.
  const morph = effectByKey('29,255');
  assert.ok(morph, 'MorphSelf is in the registry (GetEffectTemplate finds it)');
  assert.equal(morph.craftable, false, 'MorphSelf: AllowedCraftingStations = None');
  assert.equal(morph.name, 'Morph Self');
  assert.equal(spellMakerGroups().includes('Morph Self'), false, 'and no picker offers it');
  assert.equal(spellMakerSubgroups('Morph Self').length, 0);
});

test('S1 catalog: the pickers de-duplicate and sort, and every row has its runtime arm', () => {
  const groups = spellMakerGroups();
  assert.deepEqual(groups, [...new Set(groups)], 'de-duplicated');
  assert.deepEqual(groups, [...groups].sort(), 'alpha-sorted (GetGroupNames sortAlpha)');
  assert.ok(groups.includes('Damage') && groups.includes('Fortify Attribute'));
  // one group, many subgroups
  assert.equal(spellMakerSubgroups('Damage').length, 3);
  // a lone effect with NO subgroup - the window skips the sub picker
  const solo = spellMakerSubgroups('Paralyze');
  assert.equal(solo.length, 1);
  assert.equal(solo[0].subgroup, '');
  // The standing inert example, walked forward as the arms land: Lock
  // lived here until X1, Identify until X7 gave it unidentified-item
  // state, Spell Reflection until X11a, and MORPH SELF until V2a
  // built the LycanthropyEffect it was waiting on.
  assert.equal(effectByKey('40,255').ported, true, 'Identify casts since X7');
  assert.equal(effectByKey('21,255').ported, true, 'Spell Reflection re-targets since X11a');
  assert.equal(effectByKey('29,255').ported, true, 'Morph Self casts since V2a built its racial override');
  assert.equal(effectByKey('29,255').craftable, false, 'and STILL no station offers it');
  assert.deepEqual(SPELL_MAKER_EFFECTS.filter((e) => !e.ported).map((e) => e.key), [],
    'the inert set is EMPTY - every catalog row has its runtime arm');
  assert.equal(PORTED_KEYS.size, SPELL_MAKER_EFFECTS.filter((e) => e.ported).length);
});

// ---------------------------------------------------------------------------
// E8: the native window.
// ---------------------------------------------------------------------------

test('E8 rects: every hit rect is DFU\'s, and the effect rows are CENTRED not at x3', () => {
  // :36-53, digit for digit
  assert.deepEqual(SPELL_MAKER_RECTS.addEffect, [244, 114, 28, 28]);
  assert.deepEqual(SPELL_MAKER_RECTS.buySpell, [244, 147, 24, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.newSpell, [244, 163, 24, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.exit, [244, 179, 24, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.casterOnly, [275, 114, 24, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.areaAtRange, [275, 178, 24, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.fireBased, [299, 114, 16, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.magicBased, [299, 178, 16, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.nextIcon, [275, 80, 9, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.previousIcon, [275, 96, 9, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.selectIcon, [288, 94, 16, 16]);
  assert.deepEqual(SPELL_MAKER_RECTS.nameSpell, [59, 184, 142, 7]);
  // the labels (:32, :261-267)
  assert.deepEqual(SPELL_MAKER_LABELS.tip, [5, 22]);
  assert.deepEqual(SPELL_MAKER_LABELS.maxSpellPoints, [43, 149]);
  assert.deepEqual(SPELL_MAKER_LABELS.money, [39, 158]);
  assert.deepEqual(SPELL_MAKER_LABELS.goldCost, [59, 167]);
  assert.deepEqual(SPELL_MAKER_LABELS.spellPointCost, [70, 176]);
  assert.deepEqual(SPELL_MAKER_LABELS.spellName, [60, 185]);
  // the 40x80 select sheet (:56-65)
  assert.deepEqual(SELECT_SUBRECTS.casterOnly, [0, 0, 24, 16]);
  assert.deepEqual(SELECT_SUBRECTS.areaAtRange, [0, 64, 24, 16]);
  assert.deepEqual(SELECT_SUBRECTS.fireBased, [24, 0, 16, 16]);
  assert.deepEqual(SELECT_SUBRECTS.magicBased, [24, 64, 16, 16]);

  // THE CENTRING. The declared rects are (3, 30/62/94, 230, 9), but
  // SetupLabels centres each panel (:271, :280, :289) and centring
  // ASSIGNS x - so the live rows start at 45, and a click at x=3 (or
  // anywhere left of 45) is NOT on an effect row.
  assert.equal(EFFECT_PANEL_X, 45);
  assert.deepEqual(EFFECT_NAME_PANELS, [[45, 30, 230, 9], [45, 62, 230, 9], [45, 94, 230, 9]]);
  const w = addEffect(win(), 'Damage', 'Health');
  w.editor = null;
  w.click(4, 34);                       // where the DECLARED rect would put row 1
  assert.equal(w.box, null, 'the dead x3 rect opens nothing');
  w.click(46, 34);                      // where the CENTRED rect really is
  assert.deepEqual(w.box.rows, SPELL_MAKER_TEXT[1708].map((text) => ({ text, center: true })),
    'the centred row opens the 1708 alter box');
});

test('E8 window: add-effect walks group -> subgroup -> the settings editor', () => {
  const w = win();
  press(w, 'addEffect');
  assert.ok(w.picker, 'the group picker is up');
  assert.deepEqual(w.picker.items, spellMakerGroups());
  assert.equal(w.picker.selectedIndex, 0, 'ListBox.SelectedIndex = 0 (:727)');
  w.picker.selectedIndex = spellMakerGroups().indexOf('Damage');
  w.picker.input('Enter');
  assert.deepEqual(w.picker.items, spellMakerSubgroups('Damage').map((e) => e.subgroup));
  w.picker.selectedIndex = spellMakerSubgroups('Damage').findIndex((e) => e.subgroup === 'Health');
  w.picker.input('Enter');
  assert.equal(w.picker, null, 'both pickers close (:1000-1002)');
  assert.ok(w.editor, 'and the settings editor opens');
  assert.equal(w.slots[0].key, '4,0');
  assert.equal(w.editOrDeleteSlot, 0, 'AddAndEditSlot leaves the slot pending (:431)');
  assert.deepEqual(w.slots[0].settings, blankEffectSettings(), 'every spinner starts at its range floor');
  // Escape out of the SUBGROUP picker returns to the GROUP list - the
  // one thing DFU changed from classic on purpose (:299-300)
  const w2 = win();
  press(w2, 'addEffect');
  w2.picker.selectedIndex = spellMakerGroups().indexOf('Damage');
  w2.picker.input('Enter');
  w2.picker.input('Escape');
  assert.deepEqual(w2.picker.items, spellMakerGroups(), 'back to the groups, not out of the window');
});

test('E8 window: a group whose single effect has no subgroup skips the sub picker', () => {
  const w = win();
  addEffect(w, 'Paralyze');
  assert.equal(w.picker, null, 'straight to the editor - no empty picker (:945-951)');
  assert.ok(w.editor);
  assert.equal(w.slots[0].key, '0,255');
});

test('E8 editor: the support flags gate the spinners, and only an enabled one steps', () => {
  const w = addEffect(win(), 'Damage', 'Health');
  const ed = w.editor;
  // :31-41, digit for digit
  assert.deepEqual(EDITOR_RECTS.durationBase, [64, 94, 24, 16]);
  assert.deepEqual(EDITOR_RECTS.magnitudePerLevel, [235, 134, 24, 16]);
  assert.deepEqual(EDITOR_RECTS.exit, [281, 94, 24, 16]);
  assert.deepEqual([...SPINNER_UP], [0, 0, 24, 5]);
  assert.deepEqual([...SPINNER_VALUE], [0, 5, 24, 6]);
  assert.deepEqual([...SPINNER_DOWN], [0, 11, 24, 5]);
  // Damage Health is magnitude only
  assert.equal(ed.enabled('durationBase'), false);
  assert.equal(ed.enabled('chanceBase'), false);
  assert.equal(ed.enabled('magnitudeBaseLow'), true);
  // a DISABLED spinner is not drawn and takes no click (:268-315)
  const durUp = spinnerPart(EDITOR_RECTS.durationBase, SPINNER_UP);
  ed.click(durUp[0] + 1, durUp[1] + 1);
  assert.equal(w.slots[0].settings.durationBase, 1, 'the disabled spinner did not move');
  // the enabled one steps, and the magnitude PAIR rule drags the max
  const magUp = spinnerPart(EDITOR_RECTS.magnitudeBaseLow, SPINNER_UP);
  for (let i = 0; i < 9; i++) ed.click(magUp[0] + 1, magUp[1] + 1);
  assert.equal(w.slots[0].settings.magnitudeBaseLow, 10);
  assert.equal(w.slots[0].settings.magnitudeBaseHigh, 10, 'the max came along');
  // ...and down clamps at the range floor
  const magDown = spinnerPart(EDITOR_RECTS.magnitudeBaseHigh, SPINNER_DOWN);
  for (let i = 0; i < 50; i++) ed.click(magDown[0] + 1, magDown[1] + 1);
  assert.equal(w.slots[0].settings.magnitudeBaseHigh, 1);
  assert.equal(w.slots[0].settings.magnitudeBaseLow, 1, 'lowering the max drags the min down');
  // the editor's OWN label is this effect's cost alone - no target
  // multiplier and no five-point floor (:373-381)
  assert.equal(ed.cost(), editedEffectCost(w.slots[0], w.entity).sp);
  ed.click(EDITOR_RECTS.exit[0] + 1, EDITOR_RECTS.exit[1] + 1);
  assert.equal(w.editor, null, 'exit closes the editor');
  assert.equal(w.editOrDeleteSlot, -1, 'EffectEditor_OnClose clears the pending slot (:997-1001)');
});

test('E8 window: the empty sheet reads 0 and 0, NOT the five-point casting floor', () => {
  // UpdateSpellCosts returns before CalculateTotalEffectCosts when no
  // slot is used (:346-353), so the floor that formula imposes never
  // reaches these labels. DFU says so in its own comment (:338-341).
  const w = win();
  assert.equal(w.totalGoldCost, 0);
  assert.equal(w.totalSpellPointCost, 0);
  assert.equal(w.labels().spellPointCost, '0');
  addEffect(w, 'Damage', 'Health');
  assert.ok(w.totalSpellPointCost >= 5, 'and a real spell prices through the shared formula');
});

test('E8 window: the target and element buttons refuse an illegal bit in silence', () => {
  const w = win();
  // with nothing chosen, allowedElements is ElementFlags_MagicOnly
  // (:565) - the four element buttons are inert and Magic stands
  assert.equal(w.element, 4);
  press(w, 'fireBased');
  assert.equal(w.element, 4, 'SetSpellElement returns early on a disallowed bit (:526-528)');
  press(w, 'areaAtRange');
  assert.equal(w.rangeType, 4, 'every target is legal on an empty sheet');
  assert.equal(TARGET_LABELS[4], 'Area at Range');
  // Damage Health is AllowedElements_All and AllowedTargets_Other
  addEffect(w, 'Damage', 'Health');
  w.editor = null;
  press(w, 'fireBased');
  assert.equal(w.element, 0);
  assert.equal(ELEMENT_LABELS[0], 'Fire');
  press(w, 'casterOnly');
  assert.equal(w.rangeType, 4, 'Damage Health forbids CasterOnly, so the button does nothing');
  assert.equal(TARGET_BUTTONS[0], 'casterOnly');
  assert.equal(ELEMENT_BUTTONS[4], 'magicBased');
});

test('E8 window: the tip label locks when the cursor slides between adjacent buttons', () => {
  // TipButton_OnMouseEnter/Leave (:1039-1066). Unity raises the NEW
  // button's Enter BEFORE the old button's Leave, so a slide from one
  // button to its neighbour locks the tip and the leave spends the
  // lock instead of wiping the text that just arrived.
  const w = win();
  assert.equal(w.tip, '');
  w.hover(...SPELL_MAKER_RECTS.addEffect.slice(0, 2).map((v) => v + 1));
  assert.equal(w.tip, w.tipFor('addEffect'));
  assert.match(w.tip, /^Add effect \(/, 'Internal_Strings.csv:936 plus the shortcut');
  assert.equal(w.lockTip, false);
  w.hover(SPELL_MAKER_RECTS.buySpell[0] + 1, SPELL_MAKER_RECTS.buySpell[1] + 1);
  assert.equal(w.tip, w.tipFor('buySpell'), 'the new button won the label');
  assert.equal(w.lockTip, false, 'and the leave that followed spent the lock');
  w.hover(2, 2);
  assert.equal(w.tip, '', 'off every button, the tip clears');
  assert.equal(SPELL_MAKER_TIPS.areaAroundCaster, 'Area around caster');
});

test('E8 window: the icon arrows wrap, and buying resets the sheet without closing', () => {
  _resetCustomIndexForTests();
  const w = win(100000);
  const e = w.entity;
  assert.equal(w.icon, 1, 'defaultSpellIcon (:132)');
  press(w, 'previousIcon');
  assert.equal(w.icon, 0);
  press(w, 'previousIcon');
  assert.equal(w.icon, SPELL_ICON_COUNT - 1, 'PreviousIconButton wraps to the last (:900-908)');
  press(w, 'nextIcon');
  assert.equal(w.icon, 0, 'NextIconButton wraps to the first (:875-884)');

  addEffect(w, 'Damage', 'Health');
  w.editor = null;
  press(w, 'nameSpell');
  assert.equal(w.naming, true);
  for (const c of 'Zap') w.input(`Key${c}`, { key: c });
  w.input('Enter');
  assert.equal(w.name, 'Zap');
  press(w, 'singleTargetAtRange');
  const price = w.totalGoldCost;
  const before = e.goldPieces;
  press(w, 'buySpell');
  assert.equal(e.spells.length, 1, 'the spell is in the book');
  assert.equal(e.spells[0].name, 'Zap');
  assert.equal(e.spells[0].rangeType, 2);
  assert.equal(e.spells[0].custom, true);
  assert.equal(e.goldPieces, before - price, 'the gold really left');
  assert.deepEqual(w.box.rows, SPELL_MAKER_TEXT[1705].map((text) => ({ text, center: true })),
    'record 1705, verbatim from Internal_RSC.csv');
  // the box is click-anywhere, and its dismissal is SetDefaults
  w.click(2, 2);
  assert.equal(w.done, false, 'the window does NOT close (:790-806)');
  assert.deepEqual(w.slots, [null, null, null]);
  assert.equal(w.name, '');
  assert.equal(w.rangeType, 0);
  assert.equal(w.icon, 1);
});

test('E8 window: the buy ladder speaks the classic records, in DFU\'s order', () => {
  const rows = (id) => SPELL_MAKER_TEXT[id]?.map((text) => ({ text, center: true })) ?? [];
  // no spellbook is the FIRST gate (:742-747)
  const noBook = new SpellMakerWindow({ entity: { goldPieces: 9999, items: [], spells: [], skills: [50] }, rows });
  press(noBook, 'buySpell');
  assert.deepEqual(noBook.box.rows, rows(1703));
  // then effects, with DFU's own localized string (not a record)
  const w = win(10);
  press(w, 'buySpell');
  assert.deepEqual(w.box.rows, [{ text: 'You must add at least one effect to this spell.', center: true }]);
  w.click(2, 2);
  // then gold
  addEffect(w, 'Damage', 'Health');
  w.editor = null;
  w.name = 'Zap';
  press(w, 'buySpell');
  assert.deepEqual(w.box.rows, SPELL_MAKER_TEXT[1702].map((text) => ({ text, center: true })));
  assert.equal(w.entity.goldPieces, 10, 'no gold moved');
  assert.equal(w.entity.spells.length, 0);
  w.click(2, 2);
  // ...and the NAME last, "only bother the player if everything else
  // is correct" (:775-780)
  const w2 = win(100000);
  addEffect(w2, 'Damage', 'Health');
  w2.editor = null;
  press(w2, 'buySpell');
  assert.deepEqual(w2.box.rows, SPELL_MAKER_TEXT[1704].map((text) => ({ text, center: true })));
  assert.equal(w2.entity.spells.length, 0);
});

test('E8 window: a fourth effect is refused with record 1707, and a filled row alters', () => {
  const w = win();
  for (const sub of ['Health', 'Fatigue', 'Spell Points']) { addEffect(w, 'Damage', sub); w.editor = null; }
  assert.equal(w.usedSlots().length, 3);
  press(w, 'addEffect');
  assert.equal(w.picker, null, 'no picker opens');
  assert.deepEqual(w.box.rows, SPELL_MAKER_TEXT[1707].map((text) => ({ text, center: true })));
  w.click(2, 2);
  // EditOrDeleteSlot: the 1708 box, and DELETE clears the slot
  w.click(EFFECT_NAME_PANELS[1][0] + 4, EFFECT_NAME_PANELS[1][1] + 4);
  assert.deepEqual(w.box.rows, SPELL_MAKER_TEXT[1708].map((text) => ({ text, center: true })));
  assert.equal(w.editOrDeleteSlot, 1);
  w.box.onButton(9);                       // MB_BUTTONS.Delete
  w.box = null;
  assert.equal(w.slots[1], null, 'ClearPendingDeleteEffectSlot (:391-400)');
  assert.equal(w.editOrDeleteSlot, -1);
  // an EMPTY row opens nothing at all (:439-440)
  w.click(EFFECT_NAME_PANELS[1][0] + 4, EFFECT_NAME_PANELS[1][1] + 4);
  assert.equal(w.box, null);
});

test('E8 ladder: a letter of credit buys a spell, as GetGoldAmount says it must', () => {
  // BuyButton reads PlayerEntity.GetGoldAmount() (:748-751) - coins
  // PLUS letters - and pays through DeductGoldAmount, which the port
  // has always matched. The gate read the purse alone, so a mage with
  // a letter and no coins was refused a spell DFU sells him.
  const w = win(0, [{ group: 'Currency', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 5000 }]);
  addEffect(w, 'Damage', 'Health');
  w.editor = null;
  w.name = 'Zap';
  press(w, 'buySpell');
  assert.equal(w.entity.spells.length, 1, 'the letter paid for it');
  assert.deepEqual(w.box.rows, SPELL_MAKER_TEXT[1705].map((text) => ({ text, center: true })));
  // ...while the money LABEL still shows GoldPieces alone, which is
  // DFU's own asymmetry (SetStatusLabels, :356)
  assert.equal(w.labels().money, '0');
});

test('E8 editor: SpellMakerDescription is the spellbook record + 300, bar the two swapped', () => {
  // Every one of DFU's 85 effect classes declares both, and the maker
  // record is the book's plus 300 - DamageHealth 1512/1212
  // (DamageHealth.cs:40-41), the variant families included
  // (ElementalResistance 1527+v against 1227+v).
  assert.equal(spellMakerDescriptionId('4,0'), 1512);
  assert.equal(spellBookDescriptionId('4,0'), 1212);
  assert.equal(spellMakerDescriptionId('8,3'), 1530, 'ElementalResistance variant 3');
  assert.equal(spellMakerDescriptionId('33,2'), 1587, 'PacifyEffect variant 2');
  assert.equal(spellMakerDescriptionId('43,255'), 1602, 'Teleport');
  // THE TWO EXCEPTIONS: the spellbook table carries the classic
  // Personality/Speed swap (1225 above 1224) and the spell-maker
  // records do not (1524 then 1525), so +300 would swap them back.
  assert.equal(spellBookDescriptionId('7,5'), 1225, 'Drain Personality, spellbook');
  assert.equal(spellBookDescriptionId('7,6'), 1224, 'Drain Speed, spellbook');
  assert.equal(spellMakerDescriptionId('7,5'), 1524, 'Drain Personality, spell maker');
  assert.equal(spellMakerDescriptionId('7,6'), 1525, 'Drain Speed, spell maker');
  assert.equal(spellMakerDescriptionId('nope'), null);
  // and the editor reads it through that one door
  const w = win();
  const seen = [];
  w.rows = (id) => { seen.push(id); return [{ text: 'x', center: true }]; };
  addEffect(w, 'Damage', 'Health');
  assert.deepEqual(w.editor.descriptionRows(), [{ text: 'x', center: true }]);
  assert.ok(seen.includes(1512), 'the parchment asked for 1512');
});

test('E8 wiring pin: the guild destination mounts the NATIVE window behind an art gate', () => {
  assert.match(src('src/systems/guildServiceFlow.js'), /MakeSpells: 'guildServiceSpellMaker'/);
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /destination === 'guildServiceSpellMaker' && spellMakerArtLoaded\(\) && _shopFont/);
  assert.match(wm, /new SpellMakerWindow\(\{/);
  assert.match(wm, /preloadSpellMakerArt\(\{ renderer, fetchBytes, palette \}\)/,
    'the art warms at boot with its sibling maker windows');
  // the Mages Guild gate is membership; Kynareth's is rank 6 - both
  // already live, so the destination is all that was missing
  assert.match(src('src/systems/guildServices.js'), /case 'MakeSpells':/);
  // ...and the window really is native now: no `isChoiceWindow` false,
  // and the three ARENA2 sheets DFU names are the ones it loads.
  const file = src('src/ui/spellMakerWindow.js');
  assert.match(file, /INFO01I0\.IMG/);
  assert.match(file, /MASK01I0\.IMG/);
  assert.match(file, /MASK05I0\.IMG/);
  assert.equal(/isChoiceWindow\(\) \{ return false/.test(file), false);
});
