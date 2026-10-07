// AUDIT WEAPON-POOL (2026-10-06, Mac: "Audit this"): WEAPON-POOL read again before it merges - three independent lanes
// (who mints and reads a weapon's condition; the migration's reach; what the change says and pins). Each fix below is
// pinned through the real producer. bible/05-Combat/Physical-Combat-Overhaul.md, AUDIT WEAPON-POOL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { createWeapon, weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { repoolWeapon, repoolWeaponConditions } from '../src/systems/conditionRepair.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { addPileLootExtras } from '../src/systems/loot.js';
import { saleConditionPercentage } from '../src/systems/tradeModes.js';
import { damageEquipment } from '../src/combat/formulas.js';
import { applyRarity, legendaryById } from '../src/systems/lootRarity.js';
import { doItemEnchantmentPayloads, assignHeldSpell, PAYLOAD } from '../src/systems/enchantments.js';
import { updateRepairTimes, collectRepaired, calculateItemRepairTime } from '../src/systems/repairService.js';
import { classicItemFromRecord } from '../src/systems/classicSave.js';
import { ITEM_ARTIFACT_MASK } from '../src/systems/loot.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = () => ({ isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
/** A piece as the pre-WEAPON-POOL mint left it: the real producer's record on its row's numbers. */
const onRow = (piece, max, cur, extra = {}) => Object.assign(piece, { maxCondition: max, currentCondition: cur }, extra);
const at = (v) => () => v;

test('AUDIT WEAPON-POOL P1: SELL-AS-FOUND\'s mark moves by the same share - a piece found at half its row\'s pool sells online at half, mended or not; left on the row it sold at a 32nd (mutants: the mark left behind)', () => {
  // the mark's producer: Roleplay & Realism: Items' pile roll (rriRealism.js), here on a pre-change iron dagger's 50
  const found = addPileLootExtras([weaponOfMaterial(WEAPONS.Dagger, WEAPON_MATERIALS.Iron)], 'J', at(0.5), { online: false })[0];
  assert.equal(found.foundCondition, found.currentCondition, 'the roll marks what it handed over');
  onRow(found, 50, 25, { foundCondition: 25 });
  const mended = onRow({ ...found }, 50, 50, { foundCondition: 25 });
  assert.equal(saleConditionPercentage(found, { online: true }), 50, 'before the move: half');
  assert.equal(repoolWeaponConditions([found, mended]), 2);
  assert.deepEqual([found.maxCondition, found.currentCondition, found.foundCondition], [1600, 800, 800]);
  assert.deepEqual([mended.maxCondition, mended.currentCondition, mended.foundCondition], [1600, 1600, 800]);
  assert.equal(saleConditionPercentage(found, { online: true }), 50, 'as found: still half');
  assert.equal(saleConditionPercentage(mended, { online: true }), 50, 'mended: the counter still pays the found half, never 1%');
});

test('AUDIT WEAPON-POOL P2: a weapon still on its row\'s pool moves before it wears - a blow, a Cast-When-Strikes strike and a Cast-When-Held bill each land on the one pool, wherever the piece came back from (a hung piece, a revenant\'s take, a quest\'s prize, a bequest, a market record); lowerCondition asks it first (mutants: the door dropped)', () => {
  // a blow: (10 x 20 + 50) / 100 = 2, on 1,600 - not on the row's 50
  const blade = onRow(createWeapon(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, at(0.5)), 50, 50);
  damageEquipment(P(), P(), 20, blade, 0, { rolls: at(0.99) });
  assert.deepEqual([blade.maxCondition, blade.currentCondition], [1600, 1598]);
  // a strike: Worm's Tooth on its row's 50, 10 a strike - 1,590, where the row's would have been 40 (and 0 by the fifth)
  const tooth = onRow(applyRarity(createWeapon(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, at(0.5)), 'legendary', at(0), [legendaryById('worms-tooth')]), 50, 50);
  const owner = P();
  owner.items.push(tooth);
  doItemEnchantmentPayloads(PAYLOAD.Strikes, tooth, { entity: owner, target: { mobileType: 3 }, damage: 10 });
  assert.deepEqual([tooth.maxCondition, tooth.currentCondition], [1600, 1590]);
  // the first-equip bill of a held spell (a 159-point record at skill 50): on the row's 50 it broke the piece
  const record = { index: 3, rangeType: 0, effects: [{ type: 14, subType: -1, durationBase: 1, durationMod: 10, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] };
  const held = onRow(createWeapon(WEAPONS.Tanto, WEAPON_MATERIALS.Iron, at(0.5)), 50, 50);
  const wearer = P();
  wearer.items.push(held);
  assignHeldSpell(record, wearer, held, { ctx: { castingSkillOf: at(50) } });
  assert.deepEqual([held.maxCondition, held.currentCondition], [1600, 1441], 'billed on the one pool - not broken on its row\'s');
  assert.ok(wearer.items.includes(held));
  // the door: lowerCondition moves it after minting it and before a point is taken
  assert.match(rd('src/systems/equip.js'), /export function lowerCondition\(item, amount[^)]*\) \{\s+mintCondition\(item\);[^]*?repoolWeapon\(item\);\s+if \(\(item\.maxCondition \?\? 0\) <= 0\) return false;/);
});

test('AUDIT WEAPON-POOL P3: a piece at a smith keeps the job it was booked for - the load leaves it, a drop-off beside it never re-derives it from the one pool\'s points (13 times as long), and once collected whole it moves at its first wear (mutants: the guard dropped)', () => {
  // a Daedric dagger broken on its row's 400, booked at a smith for a day (Instant Repairs off)
  const booked = onRow(createWeapon(WEAPONS.Dagger, WEAPON_MATERIALS.Daedric, at(0.5)), 400, 0, { repairData: { buildingKey: 7, timeStarted: 0, repairTime: 1440 } });
  const p = P();
  p.otherItems = [booked];
  const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 100 }))));
  const job = q.otherItems[0];
  assert.deepEqual([job.maxCondition, job.currentCondition], [400, 0], 'the load leaves a booked piece');
  assert.equal(repoolWeapon(job), false);
  // another piece left at the same smith: the pass re-derives every unfinished job from its missing points
  const another = createWeapon(WEAPONS.Mace, WEAPON_MATERIALS.Iron, at(0.5));
  another.currentCondition = 800;
  // (DFU's queue: the longest job is stretched by half the rest - a day and a half here; moved onto the one pool, the
  // broken dagger would be 12.8 days' work, stretched to 13.3)
  assert.equal(calculateItemRepairTime(0, 400), 1440);
  assert.equal(calculateItemRepairTime(0, 12800), 18432);
  const out = updateRepairTimes([job, another], { commit: true, nowMinutes: 100, buildingKey: 7 });
  assert.equal(out.get(job), 2160, 'the job on its booked points - never 19152');
  // collected whole on its row's pool, it moves at its first wear
  job.currentCondition = job.maxCondition;
  collectRepaired(job);
  damageEquipment(P(), P(), 20, job, 0, { rolls: at(0.99) });
  assert.deepEqual([job.maxCondition, job.currentCondition], [12800, 12798]);
});

test('AUDIT WEAPON-POOL P4: a classic save\'s artifact keeps its uses - the importer marks it `artifact` and never `magic`, and a Daedric dagger\'s 400 uses are what the dagger\'s row gave; a plain classic dagger moves (mutants: the artifact guard dropped)', () => {
  const classic = (flags) => classicItemFromRecord({ parsedData: { group: 3, index: 0, name: 'Dagger', material: WEAPON_MATERIALS.Daedric, value: 1, flags, currentCondition: 300, maxCondition: 400, typeDependentData: 0, enchantmentPoints: 0, message: 0, magic: [] } });
  const artifact = classic(ITEM_ARTIFACT_MASK), plain = classic(0);
  assert.deepEqual([artifact.group, artifact.templateIndex, artifact.artifact, artifact.magic], ['Weapons', WEAPONS.Dagger, true, undefined]);
  assert.equal(repoolWeaponConditions([artifact, plain]), 1);
  assert.deepEqual([artifact.maxCondition, artifact.currentCondition], [400, 300], 'its uses');
  assert.deepEqual([plain.maxCondition, plain.currentCondition], [12800, 9600], 'a plain classic dagger on the pool');
});
