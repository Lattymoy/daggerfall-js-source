// FOX-STACK (2026-10-30; bible/06-Systems/Loot-Arc.md section 22). A player: "Some players buy six of these items,
// equip all of them, and then legendary items just keep dropping for them constantly." Fortune's Favour already counted
// once; each Foxglove's +15 Luck did not, and Luck multiplies every rarity threshold. The laws pinned:
//   - A Legendary record's lines count once, however many copies are worn: the fold, the worn pieces, the card's resist.
//   - Two different records, and two pieces that are no Legendary, still add up.
//   - Fortune's Favour is a quarter.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import * as LP from '../../../src/systems/loot/lootPowers.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem, equipTableOf } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';

const fresh = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); setPlayerDoor(null); };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100 });
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const jewel = (t = 135) => mintCondition({ group: 'Jewellery', templateIndex: t, flags: 0 });
function legendary(id, base = null) {
  const rec = LR.legendaryById(id);
  const b = base ?? (rec.group === 'Weapons' ? createWeapon(rec.templates[0], 0, () => 0.5) : jewel());
  const it = LR.applyRarity(b, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const worn = (e) => equipTableOf(e).filter(Boolean).length;

test('FOX-STACK: a Legendary record\'s lines count once - two Foxgloves are one Foxglove\'s Luck, Speed and poison', () => {
  fresh();
  const me = player();
  wear(me, legendary('foxglove'));
  const one = LR.affixFold(me);
  assert.equal(one.stats.luck, 15);
  wear(me, legendary('foxglove'));
  assert.equal(worn(me), 2, 'both are worn');
  const two = LR.affixFold(me);
  assert.equal(two.stats.luck, 15, 'the second copy adds no Luck');
  assert.equal(two.stats.speed, 10, 'nor Speed');
  assert.deepEqual(two.resist, one.resist, 'nor resistance');
  assert.deepEqual(LR.rolledResistOf(me, 'poison'), { worn: 35, counts: 35 }, 'the card says one copy\'s');
  assert.equal(LP.wornPieces(me).length, 1, 'the powers\' worn pieces hold the first copy alone');
  assert.equal(LP.wornPieces(me)[0], me.items[0], 'the first the table lists');
});

test('FOX-STACK: two different records add up, and so do two pieces that are no Legendary', () => {
  fresh();
  const me = player();
  wear(me, legendary('foxglove'));
  wear(me, legendary('warp-edge'));
  assert.equal(LR.affixFold(me).stats.luck, 27, 'Foxglove\'s 15 and Warp-Edge\'s 12');
  assert.equal(LP.wornPieces(me).length, 2);
  fresh();
  const you = player();
  for (let i = 0; i < 2; i++) {
    const ring = jewel();
    ring.rarity = 'rare';
    ring.affixes = [{ id: 'stat', param: 'luck', value: 6 }];
    ring.isIdentified = true;
    wear(you, ring);
  }
  assert.equal(LR.affixFold(you).stats.luck, 12, 'a Rare names no record: each counts');
});

test('FOX-STACK: Fortune\'s Favour is a quarter, said so on the card', () => {
  fresh();
  const me = player();
  setPlayerDoor({ player: () => me });
  wear(me, legendary('foxglove'));
  wear(me, legendary('foxglove'));
  assert.equal(LP.lootFind(), 1.25);
  assert.equal(LR.legendaryFindMult(), 1.25, 'two copies, one finder');
  assert.equal(LR.powerOf('foxglove').brief, 'Legendaries 25% more likely');
  assert.match(LR.powerOf('foxglove').text, /25% more likely/);
  setPlayerDoor(null);
});
