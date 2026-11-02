// RPT1026-LEDGERLAW (2026-10-26, a private report: wear spent a found piece's own-mend credit and a smith's restore
// paid it out again; bible/06-Systems/Economy-Arc.md, MEND-THIRD): online a found piece sells at its mark and a third of what
// its owner's OWN mends put past it (MEND-THIRD - systems/item/foundMark.js), and wear spends those mends first. The
// count had only ever grown: worn back down it stood whole, and a smith's paid repair that raised the condition again made
// it count - the paid repair sold a third over its worth, and two kits a wear apart credited more than the piece ever held.
// Every piece from its producer (enemyEquipment.js armorOfMaterial), worn by Roleplay & Realism: Items' own roll
// (rriRealism.js randomConditionLootItems) and by a blow's own wear (equip.js lowerCondition), mended by the real kit
// (smithItems.js repairKitUse), repaired by the smith's own restore (repairService.js repairWhole, a finished job's
// repairJobsAt) and priced by the counter's own reader (tradeModes.js saleConditionPercentage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { saleConditionPercentage } from '../../../src/systems/tradeModes.js';
import { spendOwnMends, creditOwnMend } from '../../../src/systems/item/foundMark.js';
import { armorOfMaterial } from '../../../src/combat/enemyEquipment.js';
import { randomConditionLootItems } from '../../../src/systems/roleplayRealismItems/rriRealism.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { mintFieldRepairKit, repairKitUse } from '../../../src/systems/smithItems.js';
import { lowerCondition } from '../../../src/systems/equip.js';
import { repairWhole, repairJobsAt, leaveForRepair, calculateItemRepairTime } from '../../../src/systems/repairService.js';

const CUIRASS = 102;
const at = (v) => () => v;
/** A Daedric cuirass as Roleplay & Realism: Items hands it over - worn by its roll to a fifth, and marked there. */
const found = () => randomConditionLootItems([armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric)], at(0))[0];
const sells = (it) => saleConditionPercentage(it, { online: true });
const kit = (piece) => { const pack = [piece, mintFieldRepairKit()]; repairKitUse(pack[1], pack); return piece; };
/** Worn by blows to `to` (equip.js lowerCondition - the wear every blow and charge bills through). */
const wearTo = (piece, to) => { lowerCondition(piece, piece.currentCondition - to); return piece; };

test('RPT1026-LEDGERLAW (#98, the report\'s steps): a found piece mended by its owner, worn back down and repaired whole by a smith sells at its mark, as a piece only a smith ever repaired does (mutants: the paid repair spends nothing; the spend cut to the condition, never the mark)', () => {
  const plate = found();
  const mark = plate.foundCondition;
  assert.deepEqual([plate.currentCondition, plate.maxCondition, mark, sells(plate)], [6553, 32768, 6553, 19], 'found at a fifth');
  kit(kit(plate));
  assert.deepEqual([plate.currentCondition, plate.selfMended, sells(plate)], [16385, 9832, 29], 'two kits: a third of the 9,832 past the mark');
  wearTo(plate, mark);
  assert.equal(sells(plate), 19, 'worn back to the mark: the mends are spent');
  repairWhole(plate);
  assert.deepEqual([plate.currentCondition, plate.selfMended, sells(plate)], [32768, 0, 19], 'the smith\'s repair brings none of them back - it read 29 before');
  const control = found();
  repairWhole(control);
  assert.equal(sells(control), sells(plate), 'as the piece only a smith ever repaired');
  // worn part way: what it still held of its own mends stays its own
  const half = kit(kit(found()));
  wearTo(half, 10000);
  repairWhole(half);
  assert.deepEqual([half.selfMended, sells(half)], [10000 - mark, 23], 'the 3,447 it still held, a third of it');
});

test('RPT1026-LEDGERLAW (#98, the variant): two kits a wear apart credit what the piece held, never the two mends whole - the first kit\'s spent part is gone before the second counts (mutant: the kit\'s credit adds to the count unspent)', () => {
  const plate = kit(kit(found()));
  wearTo(plate, 8192);
  kit(plate);
  assert.deepEqual([plate.currentCondition, plate.selfMended], [13108, 13108 - plate.foundCondition], 'all of it past the mark is its owner\'s - and no more (14,748 before: every kit whole)');
  repairWhole(plate);
  assert.equal(sells(plate), 26, 'whole at a smith: the mark and a third of the 6,555 - it read 35 before');
  // creditOwnMend itself, from below the mark: nothing it held before counts
  const low = found();
  low.selfMended = 9000;   // a count a build before this left standing
  low.currentCondition = 3000;
  const was = low.currentCondition;
  low.currentCondition = 9000;
  creditOwnMend(low, was);
  assert.equal(low.selfMended, 9000 - low.foundCondition, 'the stale count spent at the mend\'s start');
});

test('RPT1026-LEDGERLAW (#98): a finished job\'s restore at the smith spends the same; spendOwnMends is the floor of the condition above the mark, and leaves an unmarked piece alone', () => {
  const plate = kit(kit(found()));
  wearTo(plate, plate.foundCondition + 1000);
  const owner = { otherItems: [plate] };
  leaveForRepair(plate, 7, calculateItemRepairTime(plate.currentCondition, plate.maxCondition), 0, 0);
  repairJobsAt(owner, 7, 10 ** 9, 0);
  assert.deepEqual([plate.currentCondition, plate.selfMended, sells(plate)], [32768, 1000, 21], 'the job done: the 1,000 it held, a third of it');
  repairJobsAt(owner, 7, 10 ** 9, 0);
  assert.equal(plate.selfMended, 1000, 'read again, nothing more spent');
  const piece = { currentCondition: 500, maxCondition: 1000, foundCondition: 200, selfMended: 700 };
  assert.equal(spendOwnMends(piece).selfMended, 300);
  assert.equal(spendOwnMends({ ...piece, currentCondition: 100 }).selfMended, 0, 'below the mark: none');
  assert.equal(spendOwnMends(piece, 1000).selfMended, 300, 'never raised');
  assert.deepEqual(spendOwnMends({ currentCondition: 5, maxCondition: 10, selfMended: 4 }), { currentCondition: 5, maxCondition: 10, selfMended: 4 }, 'no mark: untouched');
});

test('RPT1026-LEDGERLAW (#98): every paid repair restores through the one door - the counter\'s and the keyed flow\'s InstantRepairs arms (scenes/worldModes.js) and a finished job (repairService.js); no host writes a whole condition of its own', () => {
  const src = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');
  const wm = src('scenes/worldModes.js');
  assert.equal((wm.match(/repairWhole\(it\);/g) ?? []).length, 2, 'both InstantRepairs arms');
  for (const host of ['scenes/worldModes.js', 'scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js']) {
    assert.doesNotMatch(src(host), /\.currentCondition = \w+\.maxCondition/, `${host} restores no condition of its own`);
  }
  assert.match(src('systems/repairService.js'), /if \(isRepairFinished\(item, nowMinutes\)\) repairWhole\(item\);/);
});
