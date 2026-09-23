// DISC10-A / LH1 (2026-09-23, Discord: "Weapons when swapped into left hand dont work showing fists";
// 01-Overview/Field-Bugs-2026-09-23.md). The quickslot swap readied into the RIGHT slot whatever hand the
// player was using, so on the left hand "You ready your Dagger." stood over bare fists. By execution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { swapQuickslot, assignQuickslot, clearQuickslots } from '../src/systems/quickslots.js';
import { equipItem, equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sword = () => ({ group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword', currentCondition: 800, maxCondition: 1000 });
const dagger = () => ({ group: 'Weapons', templateIndex: 113, material: 3, name: 'Dagger', currentCondition: 50, maxCondition: 100 });
const claymore = () => ({ group: 'Weapons', templateIndex: 123, material: 0, name: 'Claymore', currentCondition: 800, maxCondition: 1000 });
const player = (items) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: {}, items });
const door = (usingRightHand) => { const d = { usingRightHand, switched: 0, switchHand() { d.switched++; d.usingRightHand = !d.usingRightHand; } }; return d; };

test('LH1: on the LEFT hand the swap readies into the left hand - the hand the screen shows - and leaves the right hand\'s weapon alone (mutant: the right slot whatever the hand)', () => {
  clearQuickslots();
  const e = player([sword(), dagger(), sword()]);
  const [right, dag, left] = e.items;
  equipItem(e, right); equipItem(e, left);
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.LeftHand], left);
  assignQuickslot('swap', dag);
  e.equipCountdown = 0;
  const hand = door(false);
  swapQuickslot({ entity: e, say: () => {}, hand });
  const t = equipTableOf(e);
  assert.equal(t[EQUIP_SLOTS.LeftHand], dag, 'the dagger is in the hand in use');
  assert.equal(t[EQUIP_SLOTS.RightHand], right, 'the right hand keeps its sword');
  assert.equal(hand.switched, 0, 'no hand change needed');
});

test('LH1: the right hand, as before; a two-hander goes to the right and the hand FOLLOWS it through ToggleHand (mutant: the hand not followed)', () => {
  clearQuickslots();
  const e = player([sword(), dagger()]);
  const [right, dag] = e.items;
  equipItem(e, right);
  assignQuickslot('swap', dag); e.equipCountdown = 0;
  const onRight = door(true);
  swapQuickslot({ entity: e, say: () => {}, hand: onRight });
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], dag, 'the right hand, as QS2 had it');
  assert.equal(onRight.switched, 0);
  clearQuickslots();
  const e2 = player([claymore()]);
  assignQuickslot('swap', e2.items[0]); e2.equipCountdown = 0;
  const onLeft = door(false);
  swapQuickslot({ entity: e2, say: () => {}, hand: onLeft });
  assert.equal(equipTableOf(e2)[EQUIP_SLOTS.RightHand], e2.items[0], 'a two-hander is the right hand\'s');
  assert.equal(onLeft.switched, 1, 'and the player now holds it: the hand followed');
});

test('LH1 by source: every host hands the swap its LIVE rig\'s hand door - the street\'s, the building\'s own, the dungeon\'s', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(read(f), /const quickSwap = \(rig = weaponRig\) => \{[^\n]*\n\s*swapQuickslot\(\{[^\n]*hand: rig\.handDoor\(\) \}\);/, f);
  assert.match(read('src/scenes/worldModes.js'), /host\.quickSwap\?\.\(interiorWeapon\)/);
  assert.match(read('src/scenes/dungeonContext.js'), /hand: weaponRig\.handDoor\(\) \}\);/);
  assert.match(read('src/combat/weaponRig.js'), /handDoor\(\) \{\s*\n\s*syncWorn\(\);\s*\n\s*return \{ usingRightHand: playerWeapon\.usingRightHand, switchHand: \(\) => this\.switchHand\(\) \};/);
});
