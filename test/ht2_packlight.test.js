// HT2 (2026-09-14, Mac: "So you cant equip the torch in your offhand,
// you can only drop it on the ground").
//
// THE ENHANCED PACK COULD NOT LIGHT A TORCH. Its detail card offered
// `Wear` on everything unworn, and `wear` goes to `equipItem` ->
// `getEquipSlot`, which answers `None` for all four light sources
// (Torch, Lantern and Candle are UselessItems2; the Holy candle is
// ReligiousItems - none of them is Weapons or Armor, and the equip
// table has no slot for any of them). So the card said "torch cannot
// be worn." and the only act left beside it was Drop - which is
// exactly the pair of facts Mac reported.
//
// The refusal was TRUE about the equip table and WRONG about the game.
// (The card's generic `Use` button - this pane offers one on
// everything - did light it; nothing on the card said so, and a player
// told a torch cannot be worn has been told the game has no place for
// it.) DFU's own equip click on a light source does not equip it, it USES
// it: LocalItemListScroller_OnItemClick (:1976-1985) sends the item to
// `UseItem(item)` with NO collection (AUDIT 22 F6), and UseItem's
// light arm is what lights a torch in play. The port's CLASSIC window
// carries that arm (ui/nativeInventory.js's equip branch, which cites
// those lines); the ENHANCED pack never grew it - and the enhanced
// skin is the default one (systems/uiSkin.js) and the only one online
// (OL1), so in practice the port shipped with no way to light a torch
// from the pack at all.
//
// The act is decided once now, in `localPrimaryAct`, label included:
// "Wear" over a torch was the lie that hid this. Lighting and dousing
// are the same act (UseItem toggles the one LightSource slot), so both
// perform the same use and only the word changes. And the lit one is
// SAID - the classic list paints that row gold
// (itemScroller.js's lightSourceBackgroundColor), this skin had no way
// to tell three torches apart.
//
// Probed in a browser too: `tools/ht2TorchProbe.mjs` opens the pack
// over two torches and a sword and presses the card.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { localPrimaryAct, itemLine } from '../src/ui/enhancedInventory.js';
import { useItem, isLightSource, TEMPLATES } from '../src/systems/useItem.js';
import { equipItem, getEquipSlot } from '../src/systems/equip.js';
import { EQUIP_SLOTS, ITEM_TEMPLATES } from '../src/characters/paperdoll.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const torch = () => ({ name: 'Torch', group: 'UselessItems2', templateIndex: TEMPLATES.Torch, stackCount: 1, currentCondition: 50, maxCondition: 50 });
const lantern = () => ({ name: 'Lantern', group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, stackCount: 1, currentCondition: 100, maxCondition: 100 });
const candle = () => ({ name: 'Candle', group: 'UselessItems2', templateIndex: TEMPLATES.Candle, stackCount: 1, currentCondition: 16, maxCondition: 16 });
const holy = () => ({ name: 'Holy candle', group: 'ReligiousItems', templateIndex: TEMPLATES.Holy_candle, stackCount: 1, currentCondition: 20, maxCondition: 20 });
const sword = () => {
  const t = ITEM_TEMPLATES.find((x) => x.name === 'Longsword');
  return { name: t.name, group: 'Weapons', templateIndex: t.index, stackCount: 1, currentCondition: t.hitPoints, maxCondition: t.hitPoints };
};

test('HT2 the root cause, executed: no light source has an equip slot, so the pack\'s Wear could only ever refuse', () => {
  const e = { items: [], career: { name: 'Spellsword' } };   // no `equip`: equipOf mints the real table
  for (const mk of [torch, lantern, candle, holy]) {
    const it = mk();
    assert.equal(isLightSource(it), true, `${it.name} is a light source`);
    assert.equal(getEquipSlot(e, it), EQUIP_SLOTS.None, `${it.name} has no slot in the equip table`);
    assert.equal(equipItem(e, it), null, `${it.name}: equipItem answers null - the "cannot be worn." Mac read`);
  }
});

test('HT2 the act, executed: the pack\'s primary act on a light source is to LIGHT it, and on the lit one to DOUSE it - never Wear', () => {
  const t = torch(), t2 = torch(), s = sword();
  const e = { items: [t, t2, s], lightSource: null };
  assert.deepEqual(localPrimaryAct(t, e), { kind: 'light', label: 'Light' });
  assert.deepEqual(localPrimaryAct(s, e), { kind: 'wear', label: 'Wear' }, 'a sword is still worn');
  assert.equal(localPrimaryAct(null, e), null, 'nothing picked, no act');
  // the act performed, through the ONE law - and with NO collection, as
  // DFU's equip click performs it (AUDIT 22 F6)
  const r = useItem(t, null, { entity: e });
  assert.equal(r.kind, 'lit');
  assert.equal(e.lightSource, t, 'the torch is the lit one now');
  assert.deepEqual(localPrimaryAct(t, e), { kind: 'douse', label: 'Douse' }, 'the SAME card now offers the other half');
  assert.deepEqual(localPrimaryAct(t2, e), { kind: 'light', label: 'Light' }, 'and the other torch is still a Light - the compare is by REFERENCE');
  assert.equal(useItem(t, null, { entity: e }).kind, 'doused');
  assert.equal(e.lightSource, null);
  assert.deepEqual(localPrimaryAct(t, e), { kind: 'light', label: 'Light' });
  // a WORN item's act is Take off, whatever else it is
  assert.ok(equipItem(e, s), 'the sword equips');
  assert.deepEqual(localPrimaryAct(s, e), { kind: 'takeOff', label: 'Take off' });
});

test('HT2 the pack SAYS which torch burns: itemLine.lit is the reference compare the classic list paints gold', () => {
  const t = torch(), t2 = torch();
  const e = { items: [t, t2], lightSource: t };
  assert.equal(itemLine(t, e).lit, true);
  assert.equal(itemLine(t2, e).lit, false, 'the identical second torch is NOT lit - `===`, not a template compare');
  assert.equal(itemLine(t, {}).lit, false, 'no entity, nothing lit');
  assert.equal(itemLine(t, undefined).lit, false);
  assert.equal(itemLine(sword(), e).lit, false);
});

test('HT2 the view performs the act it was handed, and the card no longer calls a torch worn', () => {
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /const act = localPrimaryAct\(picked, deps\.entity\);/);
  assert.match(src, /const b = el\('button', 'act primary', act\.label\);/, 'the label is the act\'s, not a literal');
  assert.match(src, /act\.kind === 'takeOff' \? \(\) => takeOff\(picked\.equipSlot\)/);
  assert.match(src, /act\.kind === 'wear' \? \(\) => wear\(picked\)/);
  assert.match(src, /: \(\) => use\(picked, null\);/, 'light and douse are the same use, with NO collection');
  assert.match(src, /if \(isLightSource\(picked\)\) pair\('Lit', line\.lit \? 'yes' : 'no'\);/);
  assert.match(src, /line\.lit \? 'lit' : null/, 'and the row says it too');
  // the two skins agree: the classic window's own arm is still there
  assert.match(read('src/ui/nativeInventory.js'), /if \(isLightSource\(it\)\) \{ this\._use\(it, null\); return; \}/);
});

test('HT2-AUDIT: the two switches a lit torch is invisible without are the MOD\'s and DFU\'s own, unchanged, and both are recorded', async () => {
  // The audit's finding, held as the two facts it rests on: the port
  // must not quietly flip either default, and if it ever does, this is
  // the pin that says the record went stale.
  const { MOD_SETTINGS } = await import('../src/systems/modSettings.js');
  const { SETTINGS_DEFAULTS } = await import('../src/systems/settingsDefaults.js');
  assert.equal(MOD_SETTINGS['handheld-torches'].keys['Modules.Sprite'].default, false,
    'the mod ships Sprite = False (vendor/handheld-torches/modsettings.json) - 1:1');
  assert.match(read('vendor/handheld-torches/modsettings.json'), /"Value": false,\s*\n\s*"Name": "Sprite",/,
    'and that is what the shipped bundle says');
  assert.equal(SETTINGS_DEFAULTS.Enhancements.PlayerTorchFromItems, 'False',
    "DFU's own defaults.ini gates the torch's LIGHT off too");
  assert.match(read('bible/06-Systems/Handheld-Torches.md'), /^## HT2-AUDIT - A LIT TORCH IS INVISIBLE BY DEFAULT/m);
});

test('HT2 records: the pack page, the ledger row and the testing row', () => {
  assert.match(read('bible/10-UI/UI-Arc.md'), /^## HT2 THE ACT ON A LIGHT SOURCE \(2026-09-14/m);
  assert.match(read('bible/06-Systems/Handheld-Torches.md'), /^## HT2 - LIGHTING ONE FROM THE PACK \(2026-09-14\)/m);
  assert.match(read('bible/01-Overview/Port-Ledger.md'), /HT2 \(2026-09-14\): the enhanced pack lights a light source/);
  assert.match(read('bible/09-Testing/Testing.md'), /^\| ht2_packlight\.test\.js \| \d+ \| HT2/m);
});
