// COMPANION-WEIGHT (2026-10-01, the field: "make the crew companions have a balanced inventory weight"). A crew
// companion's pack carried anything (COMPANION-KIT: "no weight cap"); it carries what a person of his strength can
// now - Daggerfall's own MaxEncumbrance over his body's live strength. Storing into it takes what fits and refuses the
// rest in his name, gold clamped the way the wagon clamps it; a pack filled past the limit before it keeps what it holds
// and takes nothing more; taking out is never gated by it. AUDIT ECON (2026-10-01): driven through both real windows
// with the items and the body the game mints; a refused store writes no quest drop (C1); the classic panel shows his
// load (C2); his LIVE body is read by his key, and a companion gone from the party takes nothing (C5).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { packCapacityKg, PACK_DEFAULT_STRENGTH } from '../../src/systems/naval/crewCompanions.js';
import { storeCapacityOf } from '../../src/systems/inventorySession.js';
import { planStore, planDropGold, packFullText, packFullGoldText, packGoneText } from '../../src/systems/item/itemTransfer.js';
import { remoteModel, mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { NativeInventoryWindow } from '../../src/ui/native/nativeInventory.js';
import { CELL_X } from '../../src/ui/item/itemScroller.js';
import { _resetForTests } from '../../src/systems/settings/settings.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { weaponOfMaterial, createWeapon, ARROW_TEMPLATE } from '../../src/combat/enemyEquipment.js';
import { effectiveUnitWeightInKg, totalWeight } from '../../src/systems/inventory.js';
import { withDom } from '../invdrag.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The source with its comments out - a call site counted in a comment is no call site (AUDIT ECON C4). */
const code = (p) => rd(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
/** A crew hand's body as the game mints it: a class enemy (CLASS*.CFG's career), at `strength`. */
const hand = (strength) => makeEnemyEntity(145, ENEMY_BASICS[145], { strength, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 }, 5, () => 0.5);
/** A Steel Longsword as the game mints one - 5.5 kg. */
const sword = () => weaponOfMaterial(120, 1);
const SWORD_KG = 5.5;
const HILDA = Object.freeze({ kg: 90, name: 'Hilda' });
/** `n` swords: a pack loaded to `n` x 5.5 kg. */
const swords = (n) => Array.from({ length: n }, sword);

test('COMPANION-WEIGHT: his pack carries DFU\'s MaxEncumbrance of his LIVE body - 1.5 kg a point of strength, a Warrior\'s 60 90 kg, a Bard\'s 45 67, Fortify Strength +30 135 - and an average person\'s 75 with no body to read (mutants: the law unread; Fortify ignored; the default lost)', () => {
  assert.equal(effectiveUnitWeightInKg(sword()), SWORD_KG);
  assert.equal(PACK_DEFAULT_STRENGTH, 50);
  assert.equal(packCapacityKg(hand(60)), 90);
  assert.equal(packCapacityKg(hand(45)), 67);
  const fortified = hand(60);
  fortified.activeEffects = [{ kind: 'fortifyAttribute', stat: 'strength', magnitude: 30 }];
  assert.equal(packCapacityKg(fortified), 135, 'his live strength, a spell of mine on him included');
  assert.equal(packCapacityKg(null), 75, 'no body');
  assert.equal(packCapacityKg({ stats: {} }), 75, 'none to read');
});

test('COMPANION-WEIGHT: the storage\'s own limit is asked only when the remote list IS that storage - never the wagon, a choose-one list, the ground or a storage without one', () => {
  const loot = { storage: true, capacity: () => HILDA };
  assert.deepEqual(storeCapacityOf({ loot }, {}), HILDA);
  assert.equal(storeCapacityOf({ loot }, { usingWagon: true }), null);
  assert.equal(storeCapacityOf({ loot }, { chooseOne: [] }), null);
  assert.equal(storeCapacityOf({}, {}), null, 'the ground');
  assert.equal(storeCapacityOf({ loot: { storage: true } }, {}), null, 'a chest');
  assert.equal(storeCapacityOf({ loot: { storage: true, capacity: () => ({ kg: Number.NaN }) } }, {}), null, 'a limit that is no number is none');
});

test('COMPANION-WEIGHT: storing takes what fits - a stack split to the headroom, a full pack refused in his name, a pack already over the limit refused anything more, a weightless stack (arrows) always taken; a storage without a limit takes it all (mutants: the gate dropped; the split lost; the refusal unnamed; weightless stacks limited)', () => {
  const remote = swords(15);   // 82.5 of his 90
  const split = planStore({ ...sword(), stackCount: 3 }, { remote, capacity: HILDA });
  assert.deepEqual([split.ok, split.amount], [true, 1], 'one of three 5.5 kg swords fits in 7.5 kg');
  const full = planStore(sword(), { remote: swords(16), capacity: HILDA });   // 88 of 90
  assert.equal(full.ok, false);
  assert.deepEqual(full.refusal, { reason: 'packFull', text: 'Hilda cannot carry any more.' });
  assert.equal(packFullText(null), 'Your companion cannot carry any more.');
  assert.equal(planStore(sword(), { remote: swords(20), capacity: HILDA }).ok, false, 'filled past the limit before it: nothing more');
  const arrows = createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
  const quiver = planStore(arrows, { remote: swords(20), capacity: HILDA });
  assert.deepEqual([quiver.ok, quiver.amount], [true, arrows.stackCount], 'arrows weigh nothing (DFU\'s hasNoEncumbrance) - they always fit, as in the wagon');
  const free = planStore(sword(), { remote: swords(200) });
  assert.deepEqual([free.ok, free.amount], [true, 1], 'no limit, no gate');
});

test('COMPANION-WEIGHT: gold is clamped to what he can carry and said in his name - exactly the headroom says nothing; a full or over-limit pack takes none and says 0, never a negative (mutants: the gold gate dropped; the boundary; the floor at 0)', () => {
  const remote = [{ ...sword(), weightInKg: 89.99 }];   // 0.01 kg left: four gold pieces of 0.0025
  const some = planDropGold('100', { carried: 500, remote, capacity: HILDA });
  assert.deepEqual([some.ok, some.amount, some.notice], [true, 4, packFullGoldText('Hilda', 4)]);
  assert.equal(packFullGoldText('Hilda', 4), 'Hilda could only carry 4 gold pieces.');
  assert.deepEqual(planDropGold('4', { carried: 500, remote, capacity: HILDA }), { ok: true, amount: 4, notice: null }, 'exactly the headroom: no word');
  const none = planDropGold('100', { carried: 500, remote: swords(20), capacity: HILDA });   // 110 of 90
  assert.equal(none.ok, false);
  assert.equal(none.refusal.reason, 'packFull');
  assert.equal(none.notice, 'Hilda could only carry 0 gold pieces.', 'over the limit: 0, never a negative');
  assert.deepEqual(planDropGold('100', { carried: 500, remote: swords(20) }), { ok: true, amount: 100, notice: null }, 'no limit, no clamp');
});

test('AUDIT ECON C1: a refused store writes no quest drop - a droppable quest letter refused by a full pack is not marked dropped (the quest\'s DroppedItemAtPlace would fire while it stayed in my bag); one that fits is (mutants: the room asked below the quest arm)', () => {
  _resetForTests();
  const res = { allowDrop: true, playerDropped: false, madePermanent: false, hasPlayerClicked: false, setPlayerClicked() { this.hasPlayerClicked = true; } };
  const letter = { group: 'MiscItems', templateIndex: 132, name: 'Letter', questItem: true, questUID: 7, questSymbol: { name: '_letter_' }, weightInKg: 0.1 };
  const getQuest = (uid) => (uid === 7 ? { getItem: () => res } : null);
  const refused = planStore(letter, { remote: swords(20), capacity: HILDA, getQuest });
  assert.equal(refused.ok, false);
  assert.equal(res.playerDropped, false, 'refused: not dropped');
  const taken = planStore(letter, { remote: [], capacity: HILDA, getQuest });
  assert.equal(taken.ok, true);
  assert.equal(res.playerDropped, true, 'taken: dropped, as into any chest');
  _resetForTests();
});

test('AUDIT ECON C5: a companion gone from the party (a quickload under his window that left him aboard) takes nothing - not a sword, not a weightless quiver or quest piece, not gold - and says so (mutants: the gone pack still taking; the gone check below the quest arm)', () => {
  const gone = Object.freeze({ kg: 0, name: 'Hilda', gone: true });
  assert.equal(packGoneText('Hilda'), 'Hilda is no longer with you.');
  assert.deepEqual(planStore(sword(), { remote: [], capacity: gone }).refusal, { reason: 'packGone', text: 'Hilda is no longer with you.' });
  assert.equal(planStore(createWeapon(ARROW_TEMPLATE, 0, () => 0.5), { remote: [], capacity: gone }).ok, false, 'even a weightless stack');
  const gold = planDropGold('100', { carried: 500, remote: [], capacity: gone });
  assert.deepEqual([gold.ok, gold.notice], [false, 'Hilda is no longer with you.']);
  // a weightless quest piece too - refused above the quest arm (C1's order), so its drop is never written
  _resetForTests();
  const res = { allowDrop: true, playerDropped: false, madePermanent: false, hasPlayerClicked: false, setPlayerClicked() { this.hasPlayerClicked = true; } };
  const token = { group: 'MiscItems', templateIndex: 132, name: 'Letter', questItem: true, questUID: 8, questSymbol: { name: '_token_' }, weightInKg: 0 };
  assert.equal(effectiveUnitWeightInKg(token), 0, 'weightless: no weight check refuses it');
  assert.equal(planStore(token, { remote: [], capacity: gone, getQuest: (uid) => (uid === 8 ? { getItem: () => res } : null) }).ok, false);
  assert.equal(res.playerDropped, false, 'never marked dropped');
  _resetForTests();
  // the host: his items AND his limit read by his key at every look, his live body first; gone, the limit says so
  const w = code('src/scenes/world.js');
  assert.match(w, /if \(!pack\) return \{ kg: 0, name: named, gone: true \};\n\s*const body = crewAshore\.bodies\(\)\.find\(\(f\) => f\.companion === key\) \?\? rec;\n\s*return \{ kg: packCapacityKg\(body\?\.entity \?\? null\), name: pack\.name \?\? named \};/);
});

test('COMPANION-WEIGHT through the ENHANCED window: Store refuses a sword into his full pack and says so in his name, and takes it when there is room; the header shows his load against his limit (mutants: the store door without it; the header without it)', () => {
  const named = (r) => r.querySelector('.itemname')?.children?.[0]?.textContent ?? '';
  /** My own row of `name` - never a row of his pack (the remote frame, `.loot-win`). */
  const mineRow = (host, name) => host.querySelectorAll('.itemrow').find((r) => named(r).startsWith(name) && !r.closest('.loot-win'));
  const storeVerb = (host) => host.querySelectorAll('.act').find((b) => b.textContent === 'Store');
  /** Every word the window draws, its whole tree's. */
  const words = (n) => [n.textContent ?? '', ...(n.children ?? []).map(words)].join(' ');
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Janome', stats: { strength: 50 }, items: [sword()], goldPieces: 0 };
    const pack = swords(16);   // 88 of 90
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => pack, storage: true, capacity: () => HILDA }, onExit: () => view.unmount() });
    assert.match(words(host), /88\.00 \/ 90 kg/, 'the header: his load against his limit');
    mineRow(host, 'Longsword').onclick();
    storeVerb(host).onclick();
    assert.equal(pack.length, 16, 'nothing went in');
    assert.equal(e.items.length, 1, 'it stayed in my bag');
    assert.match(words(dom.body), /Hilda cannot carry any more\./, 'and he said so (the enhanced notice layer, over the window)');
    view.unmount();
  });
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Janome', stats: { strength: 50 }, items: [sword()], goldPieces: 0 };
    const pack = [];
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => pack, storage: true, capacity: () => HILDA }, onExit: () => view.unmount() });
    mineRow(host, 'Longsword').onclick();
    storeVerb(host).onclick();
    assert.deepEqual([pack.length, e.items.length], [1, 0], 'room: it went in');
    view.unmount();
  });
});

test('COMPANION-WEIGHT through the CLASSIC window: Remove refuses a sword into his full pack with the box in his name, and the remote panel is labelled with his load (mutants: the classic door without it; the label without it)', () => {
  _resetForTests();
  const bag = [sword()];
  const pack = swords(16);
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, loot: { items: () => pack, storage: true, capacity: () => HILDA } });
  assert.equal(w.mode, 'remove');
  assert.equal(w._remoteTargetIconShown().label, '88 / 90', 'the panel: his load and his limit, the wagon\'s shape');
  w.click(163 + CELL_X + 5, 48 + 5);
  assert.equal(bag.length, 1, 'it stayed in my bag');
  assert.equal(pack.length, 16, 'nothing went in');
  assert.equal(w.topBox?.rows?.[0]?.text, 'Hilda cannot carry any more.');
  const roomy = [];
  const bag2 = [sword()];
  const w2 = new NativeInventoryWindow({ items: () => bag2, icons: ICONS, loot: { items: () => roomy, storage: true, capacity: () => HILDA } });
  w2.click(163 + CELL_X + 5, 48 + 5);
  assert.deepEqual([roomy.length, bag2.length], [1, 0], 'room: it went in');
  assert.equal(w2._remoteTargetIconShown().label, '5.50 / 90', 'a fractional load to two places (targetIconWeightText)');
  assert.equal(totalWeight(roomy), 5.5);
  _resetForTests();
});

test('COMPANION-WEIGHT: every store and gold door of both windows hands the limit in - counted in the code, never a comment (mutants: a door without it)', () => {
  const e = code('src/ui/enhanced/enhancedInventory.js'), n = code('src/ui/native/nativeInventory.js');
  assert.equal((e.match(/capacity: storeCapacityOf\(deps, session\)/g) ?? []).length, 6, 'the enhanced window: canStow, the label, the split, the store, the gold, Stash all (LOOT-BULK)');
  assert.equal((n.match(/capacity: storeCapacityOf\(this\.hooks, \{ usingWagon: this\.usingWagon, chooseOne: this\.chooseOne \}\)/g) ?? []).length, 2, 'the classic window: the store and the gold');
  const loot = { storage: true, items: () => swords(2), capacity: () => HILDA };
  const m = remoteModel({ loot }, {});
  assert.deepEqual([m.kind, m.capacity, m.weight], ['storage', 90, 11]);
  assert.equal(remoteModel({ loot: { storage: true, items: () => [] } }, {}).capacity, null, 'a chest has none');
});
