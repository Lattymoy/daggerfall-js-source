// DISC21 (2026-09-24, three Discord reports relayed by Mac). bible/01-Overview/Field-Bugs-2026-09-23.md, DISC21.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { applyBiographyEffect } from '../src/systems/biography.js';
import { assignSkillEquipment } from '../src/systems/rriKits.js';
import { repairUnmintedConditions, WEARABLE_GROUPS, isQuestionsDagger } from '../src/systems/conditionRepair.js';
import { isBrokenItem, equipItem } from '../src/systems/equip.js';
import { repairRefusal } from '../src/systems/repairService.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { conditionMultipliersByMaterial, WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { ServiceFlowWindow } from '../src/ui/guildServiceWindows.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = () => ({ isPlayer: true, level: 1, gender: 'male', activeEffects: [], health: 30, maxHealth: 30, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const EBONY_DAGGER_MAX = Math.trunc(templateByIndex(WEAPONS.Dagger).hitPoints * conditionMultipliersByMaterial[WEAPON_MATERIALS.Ebony] / 4);

// ── DISC21-A: "Starting ebony dagger says 'broken and cannot be worn,' repair says it isn't damaged" ──
test('DISC21-A: the questions\' ebony dagger is minted as CreateWeapon mints it, and Roleplay & Realism\'s skill-based kit wears it to 20% of a real condition - worn, not broken; equipped; a repairer takes it (mutants: the biography\'s hand-built record; the kit\'s 20% of nothing)', () => {
  const e = P();
  assert.equal(applyBiographyEffect(e, 'IT 3 0 7', { rolls: () => 0.5 }), 'item');   // Weapons, Dagger, Ebony
  const dagger = e.items.find(isQuestionsDagger);
  assert.ok(dagger, 'the questions gave an ebony dagger');
  assert.ok(EBONY_DAGGER_MAX > 1, `a real condition (${EBONY_DAGGER_MAX})`);
  assert.equal(dagger.maxCondition, EBONY_DAGGER_MAX, 'SetItemPropertiesByMaterial\'s maxCondition');
  assert.equal(dagger.currentCondition, EBONY_DAGGER_MAX, 'whole, as minted');
  assert.ok(dagger.minDamage > 0 && dagger.maxDamage >= dagger.minDamage && dagger.value > 0, 'the rest of CreateWeapon\'s record');
  // the kit's law: "Set condition of ebony dagger if player has one from char creation questions"
  assignSkillEquipment(e, { rolls: () => 0.5, torchesFromItems: false });
  assert.equal(dagger.currentCondition, Math.trunc(EBONY_DAGGER_MAX * 0.2), 'worn to 20%');
  assert.equal(isBrokenItem(dagger), false, 'not "broken and cannot be worn"');
  assert.equal(repairRefusal(dagger), null, 'a repairer takes it - it is damaged');
  assert.notEqual(equipItem(e, dagger), null, 'it goes on');
  // a biography armor piece and a bare record mint too (CreateArmor, `new DaggerfallUnityItem`)
  const a = P();
  applyBiographyEffect(a, 'IT 2 0 1', { rolls: () => 0.5 });   // Armor, steel's plate
  assert.ok(a.items[0].maxCondition > 0 && a.items[0].currentCondition === a.items[0].maxCondition, `armor minted whole (${a.items[0].maxCondition})`);
});

test('DISC21-A: a save made since - the questions\' dagger at 0 with no maxCondition, broken and "not damaged" - is minted on load: the kit\'s 20% on its real condition; an arrow keeps CreateWeapon\'s 0; any other wearable whole; nothing minted is touched, and nothing that is not worn (mutants: no repair on load; the dagger whole or at 0; the arrow whole)', () => {
  const stuck = { group: 'Weapons', templateIndex: WEAPONS.Dagger, material: WEAPON_MATERIALS.Ebony, name: 'Dagger', value: 1, currentCondition: 0 };
  assert.equal(isBrokenItem(stuck), true, 'the report: broken');
  assert.equal(repairRefusal(stuck), 'undamaged', 'the report: "it isn\'t damaged"');
  const p = P();
  p.items.push(stuck,
    { group: 'Weapons', templateIndex: 131, material: 0, name: 'Arrow', value: 2, stackCount: 12, currentCondition: 0 },
    { group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', value: 5 },
    { group: 'Weapons', templateIndex: WEAPONS.Longsword, material: 1, name: 'Longsword', value: 5, maxCondition: 300, currentCondition: 120 },
    { group: 'PlantIngredients1', templateIndex: 0, name: 'Twigs', value: 1 });
  const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 100 }))));
  const [dagger, arrows, cuirass, sword, twigs] = q.items;
  assert.equal(dagger.maxCondition, EBONY_DAGGER_MAX);
  assert.equal(dagger.currentCondition, Math.trunc(EBONY_DAGGER_MAX * 0.2), 'the kit\'s 20%, on the real condition');
  assert.equal(isBrokenItem(dagger), false, 'it can be worn');
  assert.equal(repairRefusal(dagger), null, 'and repaired');
  assert.equal(arrows.maxCondition, templateByIndex(131).hitPoints, 'the arrow\'s template hitPoints');
  assert.equal(arrows.currentCondition, 0, 'and CreateWeapon\'s 0 - "classic does it"');
  assert.ok(cuirass.maxCondition > 0 && cuirass.currentCondition === cuirass.maxCondition, 'another wearable: whole');
  assert.deepEqual([sword.maxCondition, sword.currentCondition], [300, 120], 'a minted item keeps its wear');
  assert.equal(twigs.maxCondition, undefined, 'nothing worn is touched');
  // idempotent
  assert.equal(repairUnmintedConditions(q.items), 0, 'a second load mints nothing');
  assert.deepEqual(WEARABLE_GROUPS, ['Weapons', 'Armor', 'MensClothing', 'WomensClothing', 'Jewellery']);
  // the load door runs it over the pack, the wagon and the repairer's shelf
  assert.match(rd('src/systems/save.js'), /for \(const list of \[entity\.items, entity\.wagonItems, entity\.otherItems\]\) \{\s+const n = repairUnmintedConditions\(list\);/);
});

// ── DISC21-B: "Can't access wagon from dungeon entrance - Clicking 'yes' on the prompt only closes it" ──
/** The dungeon context's one overlay slot, as dungeonContext.js keeps it (the source pin below holds the three lines):
 *  input goes to the slot's window and a window that is done leaves the slot AFTER its handler returns
 *  (overlayInput); openInventoryWithWagon refuses a slot that is held. */
function dungeonSlot() {
  const s = { slot: null, opened: 0 };
  s.openInventoryWithWagon = () => { if (s.slot) return false; s.slot = { inventory: true, done: false }; s.opened++; return true; };
  s.input = (code) => { s.slot.input(code); if (s.slot?.done) s.slot = null; };
  return s;
}

test('DISC21-B: the exit door\'s wagon prompt - Yes is taken a frame later, once the box has left the dungeon\'s one slot, and the inventory opens with the wagon; inside the box\'s own click the slot is still the box\'s and the open is refused (mutant: Yes opens inside the click)', () => {
  // the premise, on the real box: its Yes handler runs BEFORE it closes
  let doneInYes = null;
  const probe = new ServiceFlowWindow([{ rows: [{ text: 'wagon?' }], buttons: 'YesNo', onYes: () => { doneInYes = probe.done; return null; }, onNo: () => null, onEscape: () => null }]);
  probe.input('KeyY');
  assert.equal(doneInYes, false, 'the handler runs while the box still stands');
  assert.equal(probe.done, true, 'and the box closes after it');
  // the report: Yes calling the open from inside its click - refused, silently, and the box closes
  const before = dungeonSlot();
  before.slot = new ServiceFlowWindow([{ rows: [{ text: 'wagon?' }], buttons: 'YesNo', onYes: () => { before.openInventoryWithWagon(); return null; }, onNo: () => null, onEscape: () => null }]);
  before.input('KeyY');
  assert.deepEqual([before.opened, before.slot], [0, null], 'the report: nothing opened, the box gone');
  // the fix: Yes sets the flag, the next dungeon frame takes it with the slot drained
  const now = dungeonSlot();
  let pending = false;
  now.slot = new ServiceFlowWindow([{ rows: [{ text: 'wagon?' }], buttons: 'YesNo', onYes: () => { pending = true; return null; }, onNo: () => null, onEscape: () => null }]);
  now.input('KeyY');
  if (pending) { pending = false; now.openInventoryWithWagon(); }   // the frame's line
  assert.equal(now.opened, 1, 'the inventory opens');
  assert.equal(now.slot?.inventory, true, 'and holds the slot');

  // the source: the prompt's Yes sets the flag, the frame takes it right after No's exit, both teardowns clear it
  const wm = rd('src/scenes/worldModes.js');
  const fn = wm.slice(wm.indexOf('function tryExitDungeon('), wm.indexOf('function exitDungeonNow()'));
  assert.match(fn, /onYes: \(\) => \{ pendingDungeonWagonOpen = true; return null; \}/);
  assert.doesNotMatch(fn, /onYes: \(\) => \{ dungeonCtx\.openInventoryWithWagon\(\)/, 'never inside the box\'s click');
  assert.match(wm, /if \(pendingDungeonExit\) \{ pendingDungeonExit = false; exitDungeonNow\(\); return true; \}[^\n]*\n\s+if \(pendingDungeonWagonOpen\) \{ pendingDungeonWagonOpen = false; dungeonCtx\.openInventoryWithWagon\(\); \}/);
  assert.match(wm, /function exitDungeonNow\(\) \{\s+pendingDungeonWagonOpen = false;/, 'a Yes pending is this dungeon\'s alone');
  assert.match(wm, /if \(dungeonCtx\) \{\s+pendingDungeonWagonOpen = false;\s+[^\n]*\n\s+host\.onDungeonLeave\?\.\(\);   \/\/ WORLD1: a load or a teleport out is a leave too/, 'nor a load\'s or a teleport\'s next dungeon\'s');
  // ...and the three lines the slot model above stands for are the context's own
  const ctx = rd('src/scenes/dungeonContext.js');
  assert.match(ctx, /openInventoryWithWagon\(\) \{\s+if \(activeOverlay\) return false;/, 'the open refuses a held slot');
  const at = ctx.indexOf('    overlayInput(action, e = null) {');
  assert.ok(at > 0, 'the context\'s key door');
  assert.match(ctx.slice(at, at + 900), /activeOverlay\.input\(action, e\);[\s\S]*?if \(activeOverlay\?\.done\) \{\s+surfacePlayer\(\);\s+activeOverlay = null;/, 'input goes to the slot\'s window, which leaves the slot after its handler returns');
});
