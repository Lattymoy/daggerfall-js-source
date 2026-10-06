// WEAPON-POOL (2026-10-06, Mac: "keep the material disparity, but unify all the weapons types condition stat"): EVERY
// WEAPON TYPE WEARS FROM ONE POOL - the Warhammer's 1,600 - through Daggerfall's material ladder, and a save's weapons
// minted on their rows move to it on load. bible/05-Combat/Physical-Combat-Overhaul.md WEAPON-POOL; Ledger A, WEAPON-POOL.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WEAPONS, WEAPON_MATERIALS, WEAPON_CONDITION_POOL, buildWeapon } from '../src/characters/weapons.js';
import { templateByIndex, registerCustomTemplates, registerTemplateOverrides } from '../src/systems/itemTemplates.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { createWeapon, weaponOfMaterial, armorOfMaterial } from '../src/combat/enemyEquipment.js';
import { createThunderlock, createPellets, THUNDERLOCK_TEMPLATE } from '../src/systems/thunderlock.js';
import { RRI_TEMPLATES, RRI_TEMPLATE_PATCHES } from '../src/systems/rriItems.js';
import { repoolWeaponConditions } from '../src/systems/conditionRepair.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { mintPiece } from '../src/systems/smithItems.js';
import { applyRarity, legendaryById } from '../src/systems/lootRarity.js';
import { applyEnchantments } from '../src/systems/enchanting.js';
import { doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES as T } from '../src/systems/enchantments.js';
import { damageEquipment } from '../src/combat/formulas.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MATERIALS = Object.values(WEAPON_MATERIALS).filter((m) => m >= 0);
/** The one pool through Daggerfall's ladder (ItemBuilder's conditionMultipliersByMaterial, x4 iron to x32 Daedric, / 4). */
const LADDER = [1600, 2400, 2400, 3200, 4800, 6400, 8000, 9600, 11200, 12800];
const P = () => ({ isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const ladderOf = (mint) => MATERIALS.map((m) => { const w = mint(m); return [w.maxCondition, w.currentCondition]; });
const PROVENANCE = '0123456789abcdef';

test('WEAPON-POOL: every weapon type mints one pool, the Warhammer\'s 1,600, through Daggerfall\'s material ladder - the eighteen classic types, Roleplay & Realism: Items\' two and its eight patched rows, the Thunderlock; ammunition keeps its row, armour its own, and Daggerfall\'s rows stay as they are (mutants: the pool\'s number; the weapon test; the ammunition test; the template test; the viewer\'s pool and its arrow)', () => {
  assert.equal(WEAPON_CONDITION_POOL, 1600);
  assert.equal(WEAPON_CONDITION_POOL, templateByIndex(WEAPONS.Warhammer).hitPoints, 'the Warhammer\'s, the deepest row: no type has less than it had');
  // THE ROWS STAY DAGGERFALL'S (ItemTemplates.txt, verbatim): the departure reads in their place, it does not edit them
  assert.deepEqual(GROUP_TEMPLATE_INDICES.Weapons.map((i) => templateByIndex(i).hitPoints),
    [50, 50, 300, 300, 200, 600, 700, 800, 600, 1400, 800, 800, 1000, 1600, 1200, 800, 50, 100, 1]);
  // every classic type, at every material, minted as CreateWeapon mints it - maximum and current alike
  const types = GROUP_TEMPLATE_INDICES.Weapons.filter((i) => i !== WEAPONS.Arrow);
  assert.equal(types.length, 18);
  const want = LADDER.map((c) => [c, c]);
  assert.deepEqual(Object.fromEntries(types.map((i) => [templateByIndex(i).name, ladderOf((m) => createWeapon(i, m, () => 0.5))])),
    Object.fromEntries(types.map((i) => [templateByIndex(i).name, want])));
  // the port's own weapon: the Thunderlock, Dwarven as minted (x12 / 4)
  const gun = createThunderlock();
  assert.deepEqual([gun.templateIndex, gun.material, gun.maxCondition, gun.currentCondition], [THUNDERLOCK_TEMPLATE, WEAPON_MATERIALS.Dwarven, 4800, 4800]);
  // AMMUNITION KEEPS ITS ROW: CreateWeapon's arrow arm (no material pass, `currentCondition = 0`), the ocean mod's
  // re-mint of an arrow through the material pass (its row's 1 on the ladder), the Dwemer Pellet
  const arrows = createWeapon(WEAPONS.Arrow, WEAPON_MATERIALS.Daedric, () => 0.5);
  assert.deepEqual([arrows.maxCondition, arrows.currentCondition], [1, 0]);
  assert.deepEqual(MATERIALS.map((m) => weaponOfMaterial(WEAPONS.Arrow, m).maxCondition), [1, 1, 1, 2, 3, 4, 5, 6, 7, 8]);
  const pellets = createPellets(5);
  assert.deepEqual([pellets.maxCondition, pellets.currentCondition], [1, 1]);
  // armour keeps its own row through the plate ladder: a Cuirass's 4,096
  assert.deepEqual([armorOfMaterial(102, 0x0200).maxCondition, armorOfMaterial(102, 0x0209).maxCondition], [4096, 32768]);
  // a weapon whose template is not known mints no condition, as before
  assert.equal(weaponOfMaterial(9999, 0).maxCondition, 0);
  // the paperdoll viewer's pure builder reads the same law, its arrow included
  assert.deepEqual(GROUP_TEMPLATE_INDICES.Weapons.map((i) => MATERIALS.map((m) => buildWeapon(i, m).maxCondition)),
    GROUP_TEMPLATE_INDICES.Weapons.map((i) => MATERIALS.map((m) => weaponOfMaterial(i, m).maxCondition)));
  // ROLEPLAY & REALISM: ITEMS: its two weapons (an Archer's Axe and a Light Flail at 500) and its patches to eight
  // classic rows (a Tanto at 40, a Short Bow at 80 ...) take the pool as every other type does
  registerCustomTemplates(RRI_TEMPLATES);
  registerTemplateOverrides(RRI_TEMPLATE_PATCHES);
  try {
    const patched = RRI_TEMPLATE_PATCHES.filter((p) => p.hitPoints != null).map((p) => p.index);
    assert.deepEqual(patched, [114, 116, 117, 118, 121, 123, 129, 130]);
    assert.equal(templateByIndex(WEAPONS.Tanto).hitPoints, 40, 'the patch is laid over the row');
    for (const i of [513, 514, ...patched]) assert.deepEqual(ladderOf((m) => createWeapon(i, m, () => 0.5)), want, `${templateByIndex(i).name} (${i})`);
  } finally {
    registerTemplateOverrides([]);
  }
});

test('WEAPON-POOL: the flat costs stop picking a type - a Worm\'s Tooth (the Legendary that rolls on a Dagger or a Tanto) strikes 160 times at iron before it breaks, as a Warp-Edge Claymore does; a Cast-When-Held dagger the item maker made runs 6,400 magic rounds; 25 blows of 20 damage, which broke an iron short bow, leave it at 1,550 (mutants: the pool\'s number; the weapon test)', () => {
  // Cast-When-Strikes bills 10 a strike (CastWhenStrikes.cs:30) through the real dispatcher; the break consumes the piece
  const strikesToBreak = (piece) => {
    const owner = P();
    owner.items.push(piece);
    let n = 0;
    while (owner.items.includes(piece) && n < 10000) {
      doItemEnchantmentPayloads(PAYLOAD.Strikes, piece, { entity: owner, target: { mobileType: 3 }, damage: 10 });
      n++;
    }
    return n;
  };
  const legendary = (id, template) => applyRarity(createWeapon(template, WEAPON_MATERIALS.Iron, () => 0.5), 'legendary', () => 0, [legendaryById(id)]);
  const tooth = legendary('worms-tooth', WEAPONS.Dagger);
  assert.equal(tooth.name, 'Worm\'s Tooth');
  assert.deepEqual(tooth.enchantments, [{ type: T.CastWhenStrikes, param: 67 }]);
  assert.equal(strikesToBreak(tooth), 160, 'it was 5: an iron dagger\'s 50 at 10 a strike');
  assert.equal(strikesToBreak(legendary('worms-tooth', WEAPONS.Tanto)), 160);
  assert.equal(strikesToBreak(legendary('warp-edge', WEAPONS.Claymore)), 160, 'it was 140');
  // Cast-When-Held bills 1 every four magic rounds (CastWhenHeld.cs:27) - an iron dagger the player enchanted
  const owner = P();
  const held = applyEnchantments(createWeapon(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, () => 0.5), [{ type: T.CastWhenHeld, param: 37 }]);
  owner.items.push(held);
  let round = 0;
  while (owner.items.includes(held) && round < 100000) doItemEnchantmentPayloads(PAYLOAD.MagicRound, held, { entity: owner, round: ++round });
  assert.equal(round, 6400, 'it was 200');
  // a blow wears (10 x damage + 50) / 100 - 2 at 20 damage - on DFU's own scale (WEAR-ONE)
  const archer = P(), bow = createWeapon(WEAPONS.Short_Bow, WEAPON_MATERIALS.Iron, () => 0.5);
  for (let i = 0; i < 25; i++) damageEquipment(archer, P(), 20, bow, 0, { rolls: () => 0.99 });
  assert.deepEqual([bow.maxCondition, bow.currentCondition], [1600, 1550], 'it broke at 25');
});

test('WEAPON-POOL: a save\'s weapons minted on their rows move to the one pool on load, their condition the same share - the pack, the wagon, the bag, the repairer\'s shelf and a pile in the world; a whole piece whole, a broken one broken; a magic item\'s uses, ammunition and a piece already on the pool untouched; a second load moves nothing (mutants: no move on load; the condition left behind; the maximum left behind)', () => {
  const old = (template, material, max, cur) => ({ ...createWeapon(template, material, () => 0.5), maxCondition: max, currentCondition: cur });
  const p = P();
  p.items.push(
    old(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, 50, 50),
    old(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, 50, 25),
    old(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, 50, 0),
    old(WEAPONS.Long_Bow, WEAPON_MATERIALS.Ebony, 600, 450),
    { ...old(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, 50, 50), magic: true },   // MAGIC.DEF's uses, at a dagger's number
    createWeapon(WEAPONS.Arrow, 0, () => 0.5),
    old(WEAPONS.Warhammer, WEAPON_MATERIALS.Iron, 1600, 900));
  p.wagonItems = [old(WEAPONS.Staff, WEAPON_MATERIALS.Silver, 450, 300)];
  p.bagItems = [old(WEAPONS.Shortsword, WEAPON_MATERIALS.Iron, 300, 150)];
  p.otherItems = [old(WEAPONS.Katana, WEAPON_MATERIALS.Daedric, 4800, 1200)];
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 100, world: { piles: [{ items: [old(WEAPONS.Saber, WEAPON_MATERIALS.Steel, 1050, 700)] }] } })));
  const q = { isPlayer: true };
  restorePlayer(q, snap);
  const pairs = (list) => list.map((it) => [it.maxCondition, it.currentCondition]);
  assert.deepEqual(pairs(q.items), [[1600, 1600], [1600, 800], [1600, 0], [9600, 7200], [50, 50], [1, 0], [1600, 900]]);
  assert.deepEqual(pairs(q.wagonItems), [[2400, 1600]]);
  assert.deepEqual(pairs(q.bagItems), [[1600, 800]]);
  assert.deepEqual(pairs(q.otherItems), [[12800, 3200]]);
  assert.deepEqual(pairs(snap.world.piles[0].items), [[2400, 1600]], 'a pile in the world, in the save itself');
  // idempotent: every piece moved is on the pool, and the Warhammer was - a second load moves nothing
  for (const list of [q.items, q.wagonItems, q.bagItems, q.otherItems, snap.world.piles[0].items]) assert.equal(repoolWeaponConditions(list), 0);
  // the load door runs it over every list the save carries, after the never-minted are minted (DISC21-A)
  assert.match(rd('src/systems/save.js'), /const n = repairUnmintedConditions\(list\);[\s\S]*?for \(const list of repairLists\) \{\s+const n = repoolWeaponConditions\(list\);/);
});

test('WEAPON-POOL: the fingerprint is the old mint\'s own number - Daggerfall\'s row, a custom row and Roleplay & Realism: Items\' patch, through the ladder and a made piece\'s quality - and nothing else moves: armour, a frozen record, a piece with no condition, a piece no mint gives; the share rounds to the nearest point (mutants: each row source; the ladder\'s default; the quality\'s rounding; the share\'s rounding; each guard)', () => {
  const old = (template, material, max, cur, extra = {}) => ({ ...createWeapon(template, material, () => 0.5), maxCondition: max, currentCondition: cur, ...extra });
  // the mod's patch, with the mod off at the load: a Tanto at 40
  const tanto40 = old(WEAPONS.Tanto, WEAPON_MATERIALS.Iron, 40, 10);
  // a custom row: the Thunderlock's 90, Dwarven (x12 / 4)
  const gun = { ...createThunderlock(), maxCondition: 270, currentCondition: 270 };
  // no material at all (a quest's template mint): the row as it stands, x4 / 4
  const bare = { group: 'Weapons', templateIndex: WEAPONS.Wakazashi, name: 'Wakizashi', maxCondition: 200, currentCondition: 100 };
  // made pieces: the smith's quality over the row - a Crude dagger's round(37.5) = 38, a Masterwork's 65
  const made = (quality, max, cur) => ({ ...mintPiece({ recipe: 'dagger:iron', quality, seed: 1 }, PROVENANCE), maxCondition: max, currentCondition: cur });
  const crude = made(0, 38, 38), master = made(4, 65, 13);
  // the share rounds to the nearest point: a steel Saber at 3 and at 1 of 1,050 (x16 / 7)
  const saber3 = old(WEAPONS.Saber, WEAPON_MATERIALS.Steel, 1050, 3), saber1 = old(WEAPONS.Saber, WEAPON_MATERIALS.Steel, 1050, 1);
  const moved = [tanto40, gun, bare, crude, master, saber3, saber1];
  // and what stays
  const cuirass = { ...armorOfMaterial(102, 0x0200) };   // an iron cuirass's 4,096: its own row, not a weapon
  const frozen = Object.freeze(old(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, 50, 50));
  const unworn = old(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, 50, undefined);
  const raised = old(WEAPONS.Dagger, WEAPON_MATERIALS.Steel, 50, 50);   // an enchanted piece the ocean mod raised a material: the iron pool it kept
  const stays = [cuirass, frozen, unworn, raised];
  assert.equal(repoolWeaponConditions([null, ...moved, ...stays]), moved.length);
  assert.deepEqual(moved.map((it) => [it.maxCondition, it.currentCondition]),
    [[1600, 400], [4800, 4800], [1600, 800], [1200, 1200], [2080, 416], [2400, 7], [2400, 2]]);
  assert.deepEqual(stays.map((it) => [it.maxCondition, it.currentCondition]), [[4096, 4096], [50, 50], [50, undefined], [50, 50]]);
  // a classic Tanto at 50 moves with the mod ON as well - its patch laid over the row at this load
  registerTemplateOverrides(RRI_TEMPLATE_PATCHES);
  try {
    const tanto50 = old(WEAPONS.Tanto, WEAPON_MATERIALS.Iron, 50, 50);
    assert.equal(repoolWeaponConditions([tanto50]), 1);
    assert.deepEqual([tanto50.maxCondition, tanto50.currentCondition], [1600, 1600]);
  } finally {
    registerTemplateOverrides([]);
  }
  assert.equal(repoolWeaponConditions(undefined), 0, 'no list, nothing to move');
});
