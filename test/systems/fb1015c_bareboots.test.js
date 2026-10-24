// BARE-BOOTS (FIELD BUGS 2026-10-15c, `01-Overview/bugs/Field-Bugs-2026-10-15c.md`; Discord "No boots model on legendary boots": the Morrowind figure in the pack
// stood bare-shinned and barefoot under The Wayrest Courier's Treads). The Legendary is innocent - applyRarity writes
// the name, the lines and the enchantment and never the template, group or material - but a Legendary lands on
// whatever base the loot made, and DFU's RandomArmorMaterial makes one boot in five CHAIN. Imperial chain is a cuirass,
// greaves and coif in Morrowind, and mwArmorRecords answered "the classic sprite stands" for the rest - on a figure
// that has no sprite to stand, so the skin did. And the chain walk was the MATERIAL's, not the piece's: Tribunal
// attached, Adamantium boots stopped at adamantium (which has none) and never reached the ebony after it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRarity, allLegendaries } from '../../src/systems/loot/lootRarity.js';
import { armorOfMaterial, ARMOR_ENUM } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { EQUIP_SLOTS, equipItem, equipTableOf } from '../../src/systems/equip.js';
import { dfWornEquipment, composeWornArmor, ARMO_PART } from '../../src/formats/morrowind/mwItemMap.js';

const P = (name) => ARMO_PART.findIndex((r) => r.name === name);
/** The parts a retail ARMO of this id references (its piece's own slots, both sides for a pair). */
const partsOf = (id) => {
  const side = /_left$/.test(id) ? ['left'] : /_right$/.test(id) ? ['right'] : ['right', 'left'];
  const names = /boots/.test(id) ? side.flatMap((s) => [`${s} foot`, `${s} ankle`])
    : /gauntlet|bracer/.test(id) ? side.map((s) => `${s} hand`)
      : /pauldron/.test(id) ? side.map((s) => `${s} pauldron`)
        : /greaves/.test(id) ? side.map((s) => `${s} upper leg`)
          : /helm/.test(id) ? ['hair'] : ['cuirass'];
  return names.map((n) => ({ part: P(n), male: `${id}:${n}`, female: null }));
};
/** Morrowind.esm's and Tribunal.esm's armour as a player's archives name it - imperial chain a cuirass, greaves and
 *  coif alone; Tribunal's adamantium no boots. */
const IDS = [
  'netch_leather_cuirass', 'netch_leather_greaves', 'netch_leather_boots', 'netch_leather_bracer_left', 'netch_leather_bracer_right', 'netch_leather_pauldron_left', 'netch_leather_pauldron_right', 'netch_leather_helm',
  'imperial_chain_cuirass', 'imperial_chain_greaves', 'imperial_chain_coif_helm',
  ...['iron', 'steel', 'dwemer', 'ebony', 'orcish', 'daedric'].flatMap((m) => [`${m}_cuirass`, `${m}_greaves`, `${m}_boots`, `${m}_gauntlet_left`, `${m}_gauntlet_right`, `${m}_pauldron_left`, `${m}_pauldron_right`, `${m}_helm`]),
  'adamantium_cuirass', 'adamantium_greaves', 'adamantium_bracer_left', 'adamantium_bracer_right', 'adamantium_pauldron_left', 'adamantium_pauldron_right', 'adamantium_helm',
];
const ARMORS = IDS.map((id) => ({ id, model: `a/${id}.nif`, name: id, enchanted: false, parts: partsOf(id) }));
const BODIES = ARMORS.flatMap((a) => a.parts.map((p) => ({ id: p.male, model: `${p.male}.nif` })));

/** A Legendary as the loot door mints it: DFU's CreateArmor at a material, the record laid on through applyRarity (the
 *  one-record pool testRoom.js's legendaryItem hands it - chosen, not rolled), then worn through the equip door (equip.js equipItem). */
function wornLegendary(rec, templateIndex, material) {
  const item = applyRarity(armorOfMaterial(templateIndex, material), 'legendary', () => 0, [rec]);
  assert.equal(item.legendary, rec.id);
  const entity = { items: [item] };
  assert.ok(equipItem(entity, item), `${rec.id} on ${templateIndex}: worn`);
  return { item, pieces: dfWornEquipment(equipTableOf(entity), EQUIP_SLOTS, ARMOR_ENUM) };
}
const BODY_PIECES = [ARMOR_ENUM.Cuirass, ARMOR_ENUM.Gauntlets, ARMOR_ENUM.Greaves, ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Right_Pauldron, ARMOR_ENUM.Helm, ARMOR_ENUM.Boots];
const MATERIALS = Object.entries(ARMOR_MATERIAL).filter(([, m]) => m !== ARMOR_MATERIAL.None);

test('BARE-BOOTS-1 The Wayrest Courier\'s Treads are drawn on the feet in every material the loot can make them - chain the iron beside it, Tribunal\'s adamantium the ebony after it (mutants: chain alone; the walk by material)', () => {
  const treads = allLegendaries().find((l) => l.id === 'wayrest-treads');
  for (const [mName, m] of MATERIALS) {
    const { item, pieces } = wornLegendary(treads, ARMOR_ENUM.Boots, m);
    assert.equal(item.templateIndex, ARMOR_ENUM.Boots, 'the Legendary keeps its base');
    const worn = composeWornArmor({ pieces, armors: ARMORS, clothes: [], bodyPool: BODIES });
    const feet = worn.adds.filter((a) => a.partName === 'right foot' || a.partName === 'left foot');
    assert.equal(feet.length, 2, `${mName} Treads: both feet drawn (${worn.notes.join('; ')})`);
    assert.ok(worn.shadows.includes('foot:right') && worn.shadows.includes('foot:left'), `${mName}: no bare foot under them`);
  }
});

test('BARE-BOOTS-2 every Legendary body piece is worn on the figure on every base it lands on - the gauntlets, the pauldrons and the helm as the boots (mutants: chain alone)', () => {
  for (const rec of allLegendaries().filter((l) => l.group === 'Armor')) {
    for (const t of (rec.templates ?? BODY_PIECES).filter((x) => BODY_PIECES.includes(x))) {
      for (const [mName, m] of MATERIALS) {
        const { pieces } = wornLegendary(rec, t, m);
        const worn = composeWornArmor({ pieces, armors: ARMORS, clothes: [], bodyPool: BODIES });
        assert.ok(worn.adds.some((a) => a.piece?.templateIndex === t), `${rec.id} on ${t} in ${mName}: drawn (${worn.notes.join('; ')})`);
      }
    }
  }
});
