// PVP-SET (the owner, 2026-10-29): the hotbar's PvP set - a second set of the same slots, in force under the flag - its
// law (systems/wild/pvpSet.js), the model's two sets (systems/quickslots.js), the menu's module (ui/pvpSpellMenu.js), the
// flag host's combat lock (scenes/pvpFlagHost.js) and the bar held up (systems/uiSkin.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PVP_SET, kitEntry, kitMadeOf, makeKit, unmakeKit, pvpStoreOf, pvpStoreFromV1, pvpSlotMarks, pvpSetLockLine, kitTag, kitCostLine } from '../../../src/systems/wild/pvpSet.js';
import { KIT_DEFAULT_BAR } from '../../../src/systems/wild/pvpKit.js';
import {
  HOTBAR_CAPACITY, useHotbarSet, hotbarSetName, setHotbarSlot, clearHotbarSlot, swapHotbarSlots, hotbarEntry, lockHotbarSet,
  setHotbarKitPress, hotbarView, hotbarPress, quickslotSaveData, restoreQuickslotSaveData, hotbarSetEntries, restoreHotbarSet, clearHotbar,
} from '../../../src/systems/quickslots.js';
import { createPvpSpellMenu, loadPvpStore, savePvpStore, kitCastCost, PVP_SET_STORE, PVP_KIT_STORE_V1 } from '../../../src/ui/pvpSpellMenu.js';
import { forceHotbar, hotbarInForce } from '../../../src/systems/uiSkin.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { createPvpFlagHost } from '../../../src/scenes/pvpFlagHost.js';
import { PVP_FLAG } from '../../../src/systems/wild/pvpFlag.js';
import { EQUIP_SLOTS, equipTableOf } from '../../../src/systems/equip.js';
import { setPvpFight } from '../../../src/combat/pvpPotions.js';
import '../../../src/combat/pvpArmourCasting.js';

const potion = { type: 'item', kind: 'consumable', key: 'potion|1', name: 'Potion of Healing' };
const fire = { id: 'damage', pick: 0, icon: 2 };
const heal = { id: 'heal', pick: null, icon: 3 };
const reset = () => { lockHotbarSet(null); setHotbarKitPress(null); forceHotbar(null); restoreHotbarSet('pvp', []); useHotbarSet('main'); clearHotbar(); };
const memory = () => { const m = new Map(); globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; return m; };

test('PVP-SET THE MADE LIST: toolkit spells only, each once, at most 24; a spell made twice is one; a full list refuses (mutants: a spell made twice; the cap unread)', () => {
  assert.equal(PVP_SET.slots, HOTBAR_CAPACITY, 'the set is the hotbar\'s whole');
  assert.deepEqual(kitMadeOf([fire, fire, { id: 'nope' }, null, heal]), [fire, heal]);
  assert.deepEqual(makeKit([fire], fire), [fire]);
  assert.deepEqual(makeKit([fire], { id: 'resist', pick: 1 }), [fire, { id: 'resist', pick: 1, icon: 1 }]);
  const full = Array.from({ length: PVP_SET.made }, (_, i) => ({ id: 'heal', pick: null, icon: i }));
  assert.equal(kitMadeOf([...full, fire]).length, PVP_SET.made);
  assert.equal(makeKit(full, fire), null, 'full');
  assert.deepEqual(unmakeKit([fire, heal], 0), [heal]);
  assert.deepEqual(kitEntry({ id: 'fortify', pick: 3 }), { type: 'kit', kit: { id: 'fortify', pick: 3, icon: 45 }, name: 'Fortify Agility' });
  assert.equal(kitTag('damage'), 'Area');
  assert.equal(kitTag('resurrect'), 'Touch');
  assert.equal(kitCostLine('damage'), '8% magicka');
});

test('PVP-SET OLD SAVES: the old bar (dfo.pvpKitBar.v1) lands where its keys were, slots 3 to 10; the normal set\'s items on 1 and 2 come with it, never its book spells (mutants: the old bar off by one; a book spell carried)', () => {
  const v1 = [{ id: 'jump', icon: 4 }, { id: 'resurrect' }];
  const main = [potion, { type: 'spell', index: 3, name: 'Fireball' }];
  const { set, made } = pvpStoreFromV1(v1, main);
  assert.equal(set.length, 16);
  assert.deepEqual(set[0], potion);
  assert.equal(set[1], null, 'a book spell stays in the normal set');
  assert.deepEqual(set[2].kit, { id: 'jump', pick: null, icon: 4 });
  assert.deepEqual(set[3].kit, { id: 'resurrect', pick: null, icon: 10 });
  assert.deepEqual(set.slice(4, 10).map((e) => e.kit.id), KIT_DEFAULT_BAR.slice(2).map((s) => s.id), 'the rest of the old bar\'s defaults');
  assert.ok(set.slice(10).every((e) => e === null));
  assert.equal(made.length, 8);
  assert.deepEqual(pvpStoreFromV1(null).set.slice(2, 10).map((e) => e.kit), KIT_DEFAULT_BAR.map((s) => ({ ...s })), 'no old bar: the default');
  const m = memory();
  m.set(PVP_KIT_STORE_V1, JSON.stringify(v1));
  assert.deepEqual(loadPvpStore(main).set[2].kit.id, 'jump', 'read from the old key');
  savePvpStore({ set: [kitEntry(heal)], made: [heal] });
  assert.deepEqual(JSON.parse(m.get(PVP_SET_STORE)).v, 2);
  assert.deepEqual(loadPvpStore(main).set[0].kit, heal, 'a v2 record wins over the old bar');
  delete globalThis.localStorage;
});

test('PVP-SET A SAVED RECORD: toolkit spells and items are kept, a book spell and an unknown spell are not (mutants: a book spell kept)', () => {
  assert.equal(pvpStoreOf({ v: 1, set: [] }), null);
  const s = pvpStoreOf({ v: 2, set: [kitEntry(fire), { type: 'spell', index: 3, name: 'x' }, { type: 'kit', kit: { id: 'nope' } }, potion], made: [fire] });
  assert.deepEqual(s.set.slice(0, 4), [kitEntry(fire), null, null, potion]);
  assert.deepEqual(s.made, [fire]);
});

test('PVP-SET TWO SETS: the PvP set takes made spells and items, the normal set no made spell; the PvP set takes no book spell; the save keeps the normal set alone (mutants: a made spell in the normal set; a book spell in the PvP set; the PvP set saved)', () => {
  reset();
  assert.equal(setHotbarSlot(0, kitEntry(fire)), false, 'no made spell in the normal set');
  assert.ok(setHotbarSlot(0, potion));
  useHotbarSet('pvp');
  assert.equal(hotbarSetName(), 'pvp');
  assert.equal(setHotbarSlot(1, { type: 'spell', index: 3, name: 'Fireball' }), false, 'no book spell in the PvP set');
  assert.ok(setHotbarSlot(2, kitEntry(fire)));
  assert.ok(setHotbarSlot(0, potion));
  assert.ok(setHotbarSlot(5, kitEntry(fire)), 'one made spell in one slot: moved');
  assert.equal(hotbarEntry(2), null);
  const saved = quickslotSaveData();
  assert.deepEqual(saved.hotbar[0], potion);
  assert.ok(saved.hotbar.every((e) => e?.type !== 'kit'), 'the save is the normal set');
  restoreQuickslotSaveData({ hotbar: [null, potion] });
  assert.equal(hotbarSetName(), 'pvp', 'a load leaves the set in force');
  assert.equal(hotbarSetEntries('main')[1].key, potion.key, 'and writes the normal set');
  assert.equal(hotbarEntry(5).kit.id, 'damage', 'the PvP set untouched by a load');
  useHotbarSet('main');
  assert.equal(hotbarEntry(5), null);
  reset();
});

test('PVP-SET THE COMBAT LOCK: while it runs the PvP set cannot be filled, cleared or swapped; the normal set can (mutants: the lock unread on a fill; on a clear; on a swap)', () => {
  reset();
  useHotbarSet('pvp');
  setHotbarSlot(2, kitEntry(fire));
  let fight = true;
  lockHotbarSet(() => fight);
  assert.equal(setHotbarSlot(3, kitEntry(heal)), false);
  clearHotbarSlot(2);
  assert.equal(hotbarEntry(2)?.kit.id, 'damage');
  swapHotbarSlots(2, 3);
  assert.equal(hotbarEntry(2)?.kit.id, 'damage');
  useHotbarSet('main');
  assert.ok(setHotbarSlot(3, potion), 'the normal set is free');
  useHotbarSet('pvp');
  fight = false;
  assert.ok(setHotbarSlot(3, kitEntry(heal)));
  reset();
});

test('PVP-SET THE PRESS: a made slot\'s view carries its spell and icon; a press goes to the menu\'s cast, its answer the flash\'s (mutants: the press unread; a refusal read as a cast)', () => {
  reset();
  useHotbarSet('pvp');
  setHotbarSlot(4, kitEntry({ id: 'damage', pick: 1, icon: 7 }));
  const v = hotbarView(null)[4];
  assert.deepEqual([v.type, v.icon, v.element, v.name], ['kit', 7, 1, 'Damage (Frost)']);
  const got = [];
  let answer = 'cast';
  setHotbarKitPress((i, kit) => { got.push([i, kit.id]); return answer; });
  assert.equal(hotbarPress(4, {}).kind, 'spell');
  answer = 'refused';
  assert.equal(hotbarPress(4, {}).kind, 'refused');
  assert.deepEqual(got, [[4, 'damage'], [4, 'damage']]);
  reset();
});

test('PVP-SET A SLOT\'S MARKS: cost, grey when short, gold on the last cast, the cast clock\'s shade draining, the padlock; an item slot the padlock alone (mutants: short never said; the shade never drains)', () => {
  assert.deepEqual(pvpSlotMarks({ kit: true, cost: 50, magicka: 40, last: true, castAt: 1000, recoverMs: 700, now: 1350, locked: false }), { cost: 50, short: true, last: true, cd: 0.5, lock: false });
  assert.equal(pvpSlotMarks({ kit: true, cost: 50, magicka: 50, castAt: 1000, recoverMs: 700, now: 2000 }).cd, 0, 'ready');
  assert.equal(pvpSlotMarks({ kit: true, cost: 50, magicka: 50 }).short, false);
  assert.deepEqual(pvpSlotMarks({ kit: false, locked: true }), { lock: true });
  assert.equal(pvpSetLockLine(1200), 'You are in combat. You can change your PvP spells in 2 s.');
});

test('PVP-SET THE COST ON THE SLOT IS THE COST CHARGED: plate in a PvP fight adds to it (mutants: the slot\'s cost leaves the armour out)', () => {
  const me = { isPlayer: true, level: 30, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: {}, items: [], maxHealth: 1000, maxMagicka: 400, magicka: 400 };
  const t = equipTableOf(me);
  for (const [templateIndex, slot] of [[102, 'ChestArmor'], [103, 'LegsArmor'], [107, 'Head'], [104, 'LeftArm'], [105, 'RightArm'], [106, 'Gloves'], [108, 'Feet']]) t[EQUIP_SLOTS[slot]] = { group: 'Armor', templateIndex, material: 0x0200, maxCondition: 100, currentCondition: 100 };
  setPvpFight(false);
  assert.equal(kitCastCost(me, heal), 48, '12% of 400');
  setPvpFight(true);
  assert.equal(kitCastCost(me, heal), 68, 'seven plate pieces: 42% more');
  setPvpFight(false);
});

test('PVP-SET THE MENU\'S MODULE: the PvP set is in force while my flag is up in the zone, the normal set when it drops; the old bar carried in once; the lock is the flag host\'s; the hotbar is held up (mutants: the set never swapped in; the lock unread)', () => {
  reset();
  memory().set(PVP_KIT_STORE_V1, JSON.stringify([{ id: 'cure' }]));
  restoreQuickslotSaveData({ hotbar: [potion] });
  let flagged = false, left = 0;
  const online = { wildOk: true };
  const readied = [];
  const magic = { readySpell: (sp) => { readied.push(sp); return true; }, spellArmed: () => false };
  const me = { isPlayer: true, level: 30, skills: {}, items: [], maxHealth: 1000, maxMagicka: 400, magicka: 400 };
  const menu = createPvpSpellMenu(() => [online, magic, 'exterior', null, null, null], { on: () => flagged, fightLeft: () => left }, me, { doc: null });
  setPref('quickbarStyle', 'quickbar');
  menu.sync();
  assert.equal(hotbarSetName(), 'main');
  assert.equal(hotbarInForce(), false, 'unflagged: the player\'s own style');
  flagged = true;
  menu.sync();
  assert.equal(hotbarSetName(), 'pvp');
  assert.equal(hotbarInForce(), true, 'flagged: the hotbar is up whatever the style');
  assert.deepEqual(hotbarEntry(0), potion, 'the potion on 1');
  assert.equal(hotbarEntry(2).kit.id, 'regen', 'the old bar on 3 (PVP-KIT-REGEN: its Cure is Regenerate)');
  assert.equal(hotbarPress(2, { entity: me }).kind, 'spell');
  assert.equal(readied[0].pvpKit, 'regen');
  assert.equal(menu.refusal({ effects: [] }) != null, true, 'only the toolkit is cast');
  left = PVP_FLAG.lockMs;
  assert.equal(setHotbarSlot(3, kitEntry(heal)), false, 'the flag host\'s lock');
  left = 0;
  assert.ok(setHotbarSlot(3, kitEntry(heal)));
  menu.sync();
  assert.equal(JSON.parse(globalThis.localStorage.getItem(PVP_SET_STORE)).set[3].kit.id, 'heal', 'kept');
  flagged = false;
  menu.sync();
  assert.equal(hotbarSetName(), 'main');
  assert.deepEqual(hotbarEntry(0), potion);
  delete globalThis.localStorage;
  setPref('quickbarStyle', 'hotbar');
  reset();
});

test('PVP-SET THE FLAG HOST\'S LOCK: a PvP blow on me starts it, a minute long (mutants: the lock never said)', () => {
  let t = 1_000_000;
  const host = createPvpFlagHost(() => ({ id: 'me' }), { level: 40 }, () => {}, { say: () => {} }, { doc: null, now: () => t });
  assert.equal(host.fightLeft(), 0);
  host.heard({ k: 'hp', by: 'foe', to: 'me' });
  assert.equal(host.fightLeft(), PVP_FLAG.lockMs);
  t += 20_000;
  assert.equal(host.fightLeft(), PVP_FLAG.lockMs - 20_000);
});

test('PVP-SET THE WIRING: one host line; the hotbar draws the set\'s marks; a row drags onto the bar; the book opens the menu; no second bar is drawn (source)', () => {
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const pvpKit = createPvpSpellMenu\(/);
  assert.doesNotMatch(w, /createPvpKitBar/);
  const hb = readFileSync(new URL('../../../src/ui/enhanced/enhancedHotbar.js', import.meta.url), 'utf8');
  assert.match(hb, /if \(d\.payload\.kind === 'kit'\) \{\n\s*if \(i >= 0\) hotbarDropKit\(i, d\.payload\.kit, d\.payload\.name\);\n\s*return;\n\s*\}/);
  assert.match(hb, /view\.forEach\(\(v, k\) => paintSlot\(slots\[v\.slot\], v, entity, marks\[k\]\)\);/);
  const sb = readFileSync(new URL('../../../src/ui/enhanced/enhancedSpellbook.js', import.meta.url), 'utf8');
  assert.match(sb, /pvp\.onclick = \(\) => \{ onExit\(\); openHotbarSecondSet\(\); \};/);
  const menu = readFileSync(new URL('../../../src/ui/pvpSpellMenu.js', import.meta.url), 'utf8');
  assert.doesNotMatch(menu, /bottom: '96px'/, 'the old stacked strip is gone');
});
