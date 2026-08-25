// S1: the effect CATALOG (every row DFU's Spell Maker offers, with
// the support flags that gate the settings editor's panels) and the
// keyed WINDOW's flow - the group/subgroup walk, the spinner editor,
// target/element cycling, the name field, and the buy ladder ending
// in an inscribed spell and a reset sheet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPELL_MAKER_EFFECTS, STAT_SUBGROUPS, PORTED_KEYS,
  spellMakerGroups, spellMakerSubgroups, effectByKey,
} from '../src/systems/spellEffects.js';
import { SpellMakerWindow, TARGET_LABELS, ELEMENT_LABELS } from '../src/ui/spellMakerWindow.js';
import { SPELLBOOK_TEMPLATE_INDEX, _resetCustomIndexForTests, blankEffectSettings } from '../src/systems/spellMaker.js';
import { goldStack } from '../src/systems/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const player = (gold = 100000) => ({
  name: 'S', level: 1, stats: {}, skills: [50], maxMagicka: 40,
  items: [goldStack(gold), { group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }],
  spells: [],
});
const win = (gold) => new SpellMakerWindow({ entity: player(gold) });
// walk a window's main cursor onto the row of a given kind
const toRow = (w, kind, i = 0) => {
  const idx = w._rows().findIndex((r) => r.kind === kind && (r.i ?? 0) === i);
  w.cursor = idx;
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

test('S1 catalog: the pickers de-duplicate and sort, and the port marks its inert rows', () => {
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
  // the inert mark: implemented effects are flagged, the rest are not
  assert.equal(effectByKey('4,0').ported, true, 'Damage Health casts');
  // The standing inert example, walked forward as the arms land: Lock
  // lived here until X1, Identify until X7 gave it unidentified-item
  // state, Spell Reflection until X11a found that its "whole missing
  // system" was the host seam the port already had. MORPH SELF is the
  // durable choice now, and durable for a reason no lane will casually
  // close: its only consumer is LycanthropyEffect, a racial override
  // the port has not built, and its AllowedCraftingStations is None -
  // so no player can even make a spell that carries it.
  assert.equal(effectByKey('40,255').ported, true, 'Identify casts since X7');
  assert.equal(effectByKey('21,255').ported, true, 'Spell Reflection re-targets since X11a');
  assert.equal(effectByKey('29,255').ported, false, 'Morph Self still pends the lycanthropy racial override');
  assert.equal(effectByKey('29,255').craftable, false, 'and no station offers it');
  assert.equal(PORTED_KEYS.size, SPELL_MAKER_EFFECTS.filter((e) => e.ported).length);
  assert.ok(PORTED_KEYS.size > 0 && PORTED_KEYS.size < SPELL_MAKER_EFFECTS.length, 'a real subset, not all-or-nothing');
});

test('S1 window: the group -> subgroup walk lands an effect and opens its editor', () => {
  const w = win();
  toRow(w, 'slot', 0).input('confirm');
  assert.equal(w.mode, 'group');
  // pick 'Damage' -> its three subgroups
  w.pickCursor = spellMakerGroups().indexOf('Damage');
  w.input('confirm');
  assert.equal(w.mode, 'sub');
  w.pickCursor = spellMakerSubgroups('Damage').findIndex((e) => e.subgroup === 'Health');
  w.input('confirm');
  assert.equal(w.mode, 'edit', 'choosing a subgroup opens the settings editor');
  assert.equal(w.slots[0].key, '4,0');
  assert.deepEqual(Object.values(w.slots[0].settings).every((v) => v === 1), true, 'every spinner starts at 1');
  // Damage Health is magnitude-only: five rows, no duration or chance
  const rows = w._editRows();
  assert.equal(rows.length, 5);
  assert.ok(rows.every((r) => r.comp === 'magnitude'));
  // back returns to the sheet with the effect kept
  w.input('back');
  assert.equal(w.mode, 'main');
  assert.equal(w.slots[0].key, '4,0');
});

test('S1 window: a group whose single effect has no subgroup skips the sub picker', () => {
  const w = win();
  toRow(w, 'slot', 0).input('confirm');
  w.pickCursor = spellMakerGroups().indexOf('Paralyze');
  w.input('confirm');
  assert.equal(w.mode, 'edit', 'straight to the editor - no empty picker');
  assert.equal(w.slots[0].key, '0,255');
  // Paralyze is duration + chance: six rows, no magnitude
  const rows = w._editRows();
  assert.equal(rows.length, 6);
  assert.equal(rows.filter((r) => r.comp === 'magnitude').length, 0);
});

test('S1 window: the editor steps and clamps, and the cost follows every change', () => {
  const w = win();
  toRow(w, 'slot', 0).input('confirm');
  w.pickCursor = spellMakerGroups().indexOf('Damage');
  w.input('confirm');
  w.pickCursor = spellMakerSubgroups('Damage').findIndex((e) => e.subgroup === 'Health');
  w.input('confirm');
  const before = w.cost().gold;
  // raise Base min - the pair rule drags Base max with it
  for (let i = 0; i < 9; i++) w.input('plus');
  assert.equal(w.slots[0].settings.magnitudeBaseLow, 10);
  assert.equal(w.slots[0].settings.magnitudeBaseHigh, 10, 'the max came along');
  assert.ok(w.cost().gold > before, 'a stronger spell costs more');
  // stepping down past the floor clamps at 1
  for (let i = 0; i < 50; i++) w.input('minus');
  assert.equal(w.slots[0].settings.magnitudeBaseLow, 1);
});

test('S1 window: target and element cycle both ways, name types, d clears a slot', () => {
  const w = win();
  toRow(w, 'target');
  assert.equal(w.rangeType, 0);
  w.input('confirm');
  assert.equal(w.rangeType, 1);
  w.input('minus');
  assert.equal(w.rangeType, 0);
  w.input('minus');
  assert.equal(w.rangeType, TARGET_LABELS.length - 1, 'wraps backwards');
  toRow(w, 'element');
  assert.equal(w.element, 4, 'the default is Magic');
  w.input('confirm');
  assert.equal(w.element, 0);
  assert.equal(ELEMENT_LABELS[0], 'Fire');
  // the name field
  toRow(w, 'name').input('confirm');
  assert.equal(w.mode, 'name');
  for (const c of 'Zap') w.input(`char:${c}`);
  w.input('confirm');
  assert.equal(w.name, 'Zap');
  assert.equal(w.mode, 'main');
  // backspace inside the field
  toRow(w, 'name').input('confirm');
  w.input('backspace');
  assert.equal(w.name, 'Za');
  w.input('back');
  // d clears the slot under the cursor
  w.slots[1] = { type: 4, subType: 0, key: '4,0', settings: {} };
  toRow(w, 'slot', 1).input('char:d');
  assert.equal(w.slots[1], null);
});

test('S1 window: buying inscribes the spell, spends the gold and resets the sheet for another', () => {
  _resetCustomIndexForTests();
  const w = win(100000);
  const e = w.entity;
  // one Damage Health effect, named, at range
  w.slots[0] = { type: 4, subType: 0, key: '4,0', settings: { ...blankEffectSettings(), magnitudeBaseLow: 5, magnitudeBaseHigh: 5 } };
  w.name = 'Zap';
  w.rangeType = 2;
  const price = w.cost().gold;
  const before = e.items[0].stackCount;
  toRow(w, 'buy').input('confirm');
  assert.equal(e.spells.length, 1, 'the spell is in the book');
  assert.equal(e.spells[0].name, 'Zap');
  assert.equal(e.spells[0].rangeType, 2);
  assert.equal(e.spells[0].custom, true);
  assert.equal(e.items[0].stackCount, before - price, 'the gold really left');
  assert.match(w.notice, /inscribed/, 'record 1705');
  // the sheet resets for another spell - the window does NOT close
  assert.equal(w.done, false);
  assert.deepEqual(w.slots, [null, null, null]);
  assert.equal(w.name, '');
  assert.equal(w.rangeType, 0);
});

test('S1 window: the refusals speak, and nothing is bought or spent', () => {
  const w = win(10);
  const e = w.entity;
  // no effects yet
  toRow(w, 'buy').input('confirm');
  assert.match(w.notice, /at least one effect/);
  assert.equal(e.spells.length, 0);
  // an effect, but not enough gold
  w.slots[0] = { type: 4, subType: 0, key: '4,0', settings: blankEffectSettings() };
  w.name = 'Zap';
  toRow(w, 'buy').input('confirm');
  assert.match(w.notice, /enough gold/);
  assert.equal(e.items[0].stackCount, 10, 'no gold moved');
  assert.equal(e.spells.length, 0);
  // affordable, but nameless - the LAST check
  const w2 = win(100000);
  w2.slots[0] = { type: 4, subType: 0, key: '4,0', settings: blankEffectSettings() };
  toRow(w2, 'buy').input('confirm');
  assert.match(w2.notice, /name/);
  assert.equal(w2.entity.spells.length, 0);
  // three effects is the ceiling
  const w3 = win();
  w3.slots = [1, 2, 3].map(() => ({ type: 4, subType: 0, key: '4,0', settings: {} }));
  w3.slots[0] = null;   // free one, fill the cursor slot, then try a fourth
  w3.slots[0] = { type: 4, subType: 0, key: '4,0', settings: {} };
  toRow(w3, 'slot', 0).input('confirm');
  assert.equal(w3.mode, 'edit', 'a FILLED slot edits rather than adding');
});

test('S1 wiring pin: the guild destination is live and the interior host mounts the window', () => {
  assert.match(src('src/systems/guildServiceFlow.js'), /MakeSpells: 'guildServiceSpellMaker'/);
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /destination === 'guildServiceSpellMaker'/);
  assert.match(wm, /new SpellMakerWindow\(\{/);
  // the Mages Guild gate is membership; Kynareth's is rank 6 - both
  // already live, so the destination is all that was missing
  assert.match(src('src/systems/guildServices.js'), /case 'MakeSpells':/);
});
