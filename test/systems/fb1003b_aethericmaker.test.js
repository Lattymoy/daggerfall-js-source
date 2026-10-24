// AETHERIC-MAKER (FIELD BUGS 2026-10-03b, Discord: "Not sure if intentional or not, buuut: Enchanting Aetheric sets" - "You can enchant Ruhn's gear, lol"; `bible/01-Overview/bugs/Field-Bugs-2026-10-03b.md`).
// Every fixture from its real producer (TEST THE SHAPE THE PRODUCER MINTS): the gate boss's spoils, the Sigil Broker's ware, a raid's thanks.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../../src/systems/uiPrefs.js';
import { rollSpoils } from '../../src/systems/gate/gateSpoils.js';
import { rollRaidSpoils } from '../../src/systems/raidSpoils.js';
import { brokerStock } from '../../src/systems/sigil/sigilBroker.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { ItemMakerWindow, itemMakerFilter, TAB_PAGES } from '../../src/ui/item/itemMakerWindow.js';
import { enchantDecision, AETHERIC_TAKES_NO_ENCHANTMENT } from '../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';

test('AETHERIC-MAKER: an Aetheric piece is never on the item maker\'s list and never enchanted - the gate boss\'s Regalia drop, the Broker\'s Regalia ware, a town\'s raid-set thanks; a plain Daedric Battle Axe still is (mutants: the predicate out of the filter; out of the decision)', () => {
  setPref('lootRarity', true);
  let seed = 1;
  while (!rollSpoils(seed, 12).pieces.some((p) => p.item.aetheric === 'ruhn-gatecleaver')) seed++;
  assert.equal(seed, 17, 'the first kill whose spoils carry the Gatecleaver');
  const axe = rollSpoils(seed, 12).pieces.find((p) => p.item.aetheric === 'ruhn-gatecleaver').item;
  const ware = brokerStock(20000).find((o) => o.kind === 'regalia').item;
  let raid = null;
  for (let s = 1; s < 5000 && !raid; s++) raid = rollRaidSpoils(s, 12, 1).pieces?.find((p) => p.item?.rarity === 'aetheric')?.item ?? null;
  assert.ok(raid, 'a raid set piece off a real receipt');
  const plain = createWeapon(127, WEAPON_MATERIALS.Daedric);
  for (const it of [axe, ware, raid]) for (const tab of TAB_PAGES) assert.equal(itemMakerFilter(it, tab), false, `${it.name} on ${tab}`);
  const player = { goldPieces: 10_000_000, items: [axe, ware, raid, plain] };
  const w = new ItemMakerWindow({ player, entity: player, packItems: () => player.items });
  assert.deepEqual(w.items(), [plain], 'only the plain axe is listed');
  // the commit path: a selection that never came off the list (the probe seam, a window open before the piece changed)
  const potent = enchantmentSettings('PotentVs', 1);
  assert.deepEqual(enchantDecision(axe, [potent], [], { gold: 10_000_000 }), { kind: 'refused', text: AETHERIC_TAKES_NO_ENCHANTMENT });
  w._selectItem(axe);
  w.powers = [potent];
  w._enchant();
  assert.deepEqual([axe.enchantments, axe.name, player.goldPieces], [undefined, "Ruhn's Gatecleaver", 10_000_000], 'nothing laid on, renamed or paid');
  assert.equal(enchantDecision(plain, [potent], [], { gold: 10_000_000 }).kind, 'enchant', 'DFU\'s own item maker for the plain piece');
});
