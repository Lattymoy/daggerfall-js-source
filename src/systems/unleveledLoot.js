// ═══════════════════════════════════════════════════════════════════
// UNLEVELED LOOT 1.1.2 (Ralzar, MIT) - THE MOD, 1:1 (UL1, 2026-09-12,
// Mac: "Heres the next mod unleveled loot. Again 1:1").
//
// "Makes loot and shop stock materials not scale to your level." A
// MonoBehaviour that REPLACES FormulaHelper.RandomMaterial and
// RandomArmorMaterial (the two rolls behind every random weapon and
// armour piece - loot piles, enemy loadouts, shop shelves) with rolls
// driven by LUCK, the shop's quality and the dungeon's type, hooks
// EnemyDeath.OnEnemyDeath to divide a corpse's gold by the player's
// level and to add a daedric or orcish piece to a Daedra's or an Orc's
// corpse, and remembers the region and the dungeon type at every
// PlayerEnterExit transition. Ten MultipleChoiceKeys let the player
// swap any material for another whenever it would drop.
//
// THE SOURCE: the shipped `unleveled loot.dfmod` (a compiled `Unleveled
// Loot.dll`, 11,264 bytes, the manifest, modsettings) unpacked and the
// DLL decompiled (ILSpy 8.2), read beside the repository's
// `UnleveledLoot.cs` (github.com/Ralzar81/Unleveled-Loot, master =
// 1.1.1). The 1.1.2 DLL is the law where they differ: the armour drop
// is built as a NEW item over CreateRandomArmor's template with
// ApplyArmorSettings(daedric/orcish, variant 0), its condition taken
// from the RANDOM piece's maxCondition (`val2.maxCondition`, not the
// daedric one's); 1.1.1 applied the material to the random piece
// itself. Both add at AddPosition.Back.
//
// KEPT BUG FOR BUG:
// - `ModifyFoundLootItems` is registered on FormulaHelper and READ
//   NOWHERE in DFU 1.1.1 (nor master): the "unleveled gold in loot
//   piles / worn books" arm never runs in DFU. Registered here under
//   the same name, which nothing consults; the function is exported
//   for the pin and for the day DFU grows the hook.
// - The mod's `dungeon` is cleared (-1) on OnTransitionEXTERIOR - a
//   BUILDING's exit - and not on OnTransitionDungeonExterior, so after
//   leaving an Orc Stronghold `dungeon == OrcStronghold` keeps the
//   orcish arm live outdoors until the player leaves a building.
// - `region` and `dungeon` start at 0 (Alik'r, Crypt) and change only
//   at a transition: a game loaded inside a dungeon reads quality 12
//   whatever the dungeon is, until its next door.
// - The manifest REQUIRES roleplayrealism and roleplayrealism-items;
//   nothing in the code reads either - the dependency orders the mod
//   AFTER Roleplay Realism so its two overrides register last. The
//   port has no Roleplay Realism yet (MM1: no compatibility switches);
//   when it lands, its RandomMaterial must register BEFORE this one.
//
// THE PORT'S SHAPE: the two rolls consult formulas' registry
// (combat/enemyEquipment.js randomMaterial / randomArmorMaterial);
// `raiseEnemyDeath` (scenes/corpseMarker.js) is OnEnemyDeath, raised
// by the three pools at the kill; scenes/worldModes.js publishes the
// world (open shop, quality, dungeon, region, location) and calls the
// two transition arms at DFU's five OnPreTransition doors and the one
// OnTransitionExterior door. Unity's Random.Range is `rangeInt(min,
// maxExclusive)` and `rangeFloat`, over the caller's `rolls`; Dice100
// is the port's. The ten switches and Enabled live in the Mods pane.
// ═══════════════════════════════════════════════════════════════════

import { modSetting } from './modSettings.js';
import { liveStat } from './statMods.js';
import { registerFormulaOverride, dice100 } from '../combat/formulas.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { createRandomArmor } from './loot.js';
import { mintCondition, itemBaseValue, templateByIndex } from './itemTemplates.js';
import { registerEnemyDeathHandler } from '../scenes/corpseMarker.js';
import { GOLD_TEMPLATE } from './inventory.js';

export const UNLEVELED_LOOT_VENDOR = 'unleveledLoot';
export const UNLEVELED_LOOT_VERSION = '1.1.2';
/** WeaponMaterialTypes, the order of the ten MaterialSwitching keys. */
export const UNLEVELED_MATERIAL_NAMES = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);

const F = Math.fround;
const int = (x) => Math.trunc(x);
/** UnityEngine.Random.Range(int min, int maxExclusive). */
export const rangeInt = (min, maxExclusive, rolls) => (maxExclusive <= min ? min : min + Math.floor(rolls() * (maxExclusive - min)));
/** UnityEngine.Random.Range(float min, float max), float32, inclusive. */
export const rangeFloat = (min, max, rolls) => F(F(min) + F(F(F(max) - F(min)) * F(rolls())));

// ── the statics ────────────────────────────────────────────────────
let luckMod = 0;
let matRoll = 0;
let region = 0;
let dungeon = 0;
export const _state = () => ({ luckMod, matRoll, region, dungeon });
export function _resetUnleveledLoot() { luckMod = 0; matRoll = 0; region = 0; dungeon = 0; }

// ── the world, as PlayerEnterExit / PlayerGPS / PlayerEntity answer it ──
let _world = null;
/** scenes/worldModes.js hands in: playerEntity(), insideOpenShop(),
 *  buildingQuality(), insideDungeon(), regionIndex(),
 *  locationDungeonType(). A test hands in its own. */
export function setUnleveledLootWorld(world) { _world = world; }
export const _worldReader = () => _world;
const player = () => _world?.playerEntity?.() ?? null;
const playerLevel = () => Math.max(1, player()?.level | 0);
const playerLuck = () => liveStat(player(), 'luck');
const insideOpenShop = () => !!_world?.insideOpenShop?.();
const insideDungeon = () => !!_world?.insideDungeon?.();
const buildingQuality = () => _world?.buildingQuality?.() ?? 0;
const currentRegionIndex = () => _world?.regionIndex?.() ?? -1;

// ── the settings (Init) ────────────────────────────────────────────
const read = (k, r = null) => (r ? r(k) : modSetting(UNLEVELED_LOOT_VENDOR, k));
export const unleveledLootEnabled = (r = null) => !!read('Enabled', r);
/** matSwitchList: the ten MultipleChoiceKeys, index -> WeaponMaterialTypes. */
export const matSwitchList = (r = null) => UNLEVELED_MATERIAL_NAMES.map((n) => read(n, r) | 0);
export const orcishDrops = (r = null) => (read('Orcish', r) | 0) === 8;
export const daedricDrops = (r = null) => (read('Daedric', r) | 0) === 9;

// ── the transitions ────────────────────────────────────────────────
/** SetDungeon_OnPreTransition: PlayerGPS.CurrentRegionIndex and
 *  CurrentLocation.MapTableData.DungeonType, at EVERY OnPreTransition. */
export function unleveledLootPreTransition() {
  region = currentRegionIndex();
  dungeon = _world?.locationDungeonType?.() ?? 0;
}
/** ClearData_OnTransitionExterior: `dungeon = -1` - the BUILDING exit
 *  only (OnTransitionExterior), never the dungeon exit. */
export function unleveledLootExteriorTransition() { dungeon = -1; }

// ── the material rolls ─────────────────────────────────────────────
/** dungeonQuality(): the DFRegion.DungeonTypes ladder. */
export function dungeonQuality(d = dungeon, level = playerLevel()) {
  switch (d) {
    case 7: case 16: return 21;                 // Coven, VolcanicCaves
    case 4: case 14: return 18;                 // DesecratedTemple, DragonsDen
    case 8: case 15: return 15;                 // VampireHaunt, BarbarianStronghold
    case 0: case 1: return 12;                  // Crypt, OrcStronghold
    case 9: case 10: return 10;                 // Laboratory, HarpyNest
    case 13: return 5;                          // GiantStronghold
    case 2: case 3: case 11: return Math.min(level, 15);   // HumanStronghold, Prison, RuinedCastle
    default: return 0;
  }
}
/** ShopLevel(): Interior.BuildingData.Quality into 1..5. */
export function shopLevel(quality = buildingQuality()) {
  if (quality > 16) return 5;
  if (quality > 12) return 4;
  if (quality > 8) return 3;
  if (quality > 4) return 2;
  return 1;
}
/** RandomHighTier(): Range(0, 201) - Daedric over 199, Orcish over
 *  192, Ebony over 180, Adamantium over 100, Mithril otherwise. */
export function randomHighTier(rolls) {
  const num = rangeInt(0, 201, rolls);
  if (num > 199) return 9;
  if (num > 192) return 8;
  if (num > 180) return 7;
  if (num > 100) return 6;
  return 5;
}
/** RandomMat(): the wilderness/dungeon ladder over the shared matRoll. */
export function randomMat(rolls) {
  if (insideDungeon()) matRoll = matRoll - 15 + dungeonQuality();
  else matRoll -= rangeInt(10, 20, rolls);
  if (dice100(luckMod * 2, rolls())) {
    if ((region === 26 || dungeon === 1) && dice100(luckMod, rolls())) return 8;   // Orsinium, or an Orc Stronghold: Orcish
    matRoll += luckMod * 4;
  }
  if (matRoll > 90) return dice100(luckMod * 3, rolls()) ? randomHighTier(rolls) : 4;
  if (matRoll > 83) return 3;
  if (matRoll > 75) return 2;
  if (matRoll > 35) return 1;
  return 0;
}
/** ShopMat(): the shelf ladder - the shop's level lifts the roll, and
 *  Orsinium's shelves may carry Orcish. */
export function shopMat(rolls) {
  const regionNow = currentRegionIndex();   // the LIVE region, not the static
  matRoll = matRoll - 35 + shopLevel() * 8;
  if (regionNow === 26 && matRoll > 70 && rangeInt(0, 90, rolls) + luckMod > 90) return 8;
  if (matRoll > 99) return 7;
  if (matRoll > 97) return 6;
  if (matRoll > 94) return 5;
  if (matRoll > 88) return 4;
  if (matRoll > 80) return 3;
  if (matRoll > 70) return 2;
  if (matRoll < 10) return 0;
  return 1;
}
/** MaterialSwitch(material): matSwitchList[(int)material]. */
export const materialSwitch = (material, list = matSwitchList()) => list[material] ?? material;
/** WpnMatSelector(): a shop's shelf or the world's roll, then the switch. */
export function wpnMatSelector(rolls, list = matSwitchList()) {
  const m = insideOpenShop() ? shopMat(rolls) : randomMat(rolls);
  return materialSwitch(m, list);
}
/** ArmMatSelector(): Range(1, 91) + luck, lifted by the shop's quality
 *  x6 or the dungeon's quality; over 80 plate of WpnMatSelector's
 *  material (the SAME matRoll), over 50 chain, else leather. */
export function armMatSelector(rolls, list = matSwitchList()) {
  let rollMod = 0;
  const armRoll = rangeInt(1, 91, rolls) + luckMod;
  if (insideOpenShop()) rollMod += buildingQuality() * 6;
  else if (insideDungeon()) rollMod += dungeonQuality();
  if (armRoll + rollMod > 50) {
    if (armRoll + rollMod > 80) return 0x0200 + wpnMatSelector(rolls, list);
    return 0x0100;
  }
  return 0;
}
/** The RandomMaterial override: luck's tenth, Range(0, 92) + it, the selector. */
export function unleveledRandomMaterial(rolls = Math.random, list = matSwitchList()) {
  luckMod = int(playerLuck() / 10);
  matRoll = rangeInt(0, 92, rolls) + luckMod;
  return wpnMatSelector(rolls, list);
}
/** The RandomArmorMaterial override: the same roll, the armour selector. */
export function unleveledRandomArmorMaterial(rolls = Math.random, list = matSwitchList()) {
  luckMod = int(playerLuck() / 10);
  matRoll = rangeInt(0, 92, rolls) + luckMod;
  return armMatSelector(rolls, list);
}

// ── ModifyFoundLootItems (dead in DFU 1.1.1 - see the header) ──────
/** UnleveledGoldLootPiles: a book (not an artifact) worn to 20-75%,
 *  a currency stack divided by the level (never under 1); returns the
 *  number of books changed. Exported for the pin; consulted by nothing. */
export function unleveledGoldLootPiles(lootItems, { rolls = Math.random, level = playerLevel(), luck = playerLuck() } = {}) {
  luckMod = int(luck / 10);
  let changes = 0;
  for (const item of lootItems) {
    if (item.group === 'Books' && !item.artifact) {
      const conditionMod = rangeFloat(0.2, 0.75, rolls);
      item.currentCondition = int(F(F(item.maxCondition ?? 0) * conditionMod));
      changes++;
    } else if (item.group === 'Currency') {
      item.stackCount = int((item.stackCount ?? 0) / level);
      if (item.stackCount < 1) item.stackCount = 1;
    }
  }
  return changes;
}

// ── OnEnemyDeath ───────────────────────────────────────────────────
/** A weapon drop: CreateItem(Weapons, Range(Dagger, Long_Bow + 1)),
 *  ApplyWeaponMaterial(material), condition 30-75% of its own max,
 *  AddItem(Back). */
function dropWeapon(loot, material, rolls) {
  const item = createWeapon(rangeInt(113, 131, rolls), material, rolls);
  item.currentCondition = int(F(rangeFloat(0.3, 0.75, rolls) * F(item.maxCondition ?? 0)));
  loot.push(item);
  return item;
}
/** An armour drop, 1.1.2's way: CreateRandomArmor (its own rolls, the
 *  registry's RandomArmorMaterial among them), a NEW item over its
 *  template with ApplyArmorSettings(material, variant 0), and the
 *  condition 30-75% of the RANDOM piece's maxCondition. */
function dropArmor(loot, material, rolls) {
  const random = mintCondition(named(createRandomArmor(playerLevel(), rolls)));
  const item = mintCondition(named({ group: 'Armor', templateIndex: random.templateIndex, material, variant: 0 }));
  item.currentCondition = int(F(rangeFloat(0.3, 0.75, rolls) * F(random.maxCondition ?? 0)));
  loot.push(item);
  return item;
}
const named = (item) => ({ ...item, name: item.name ?? templateByIndex(item.templateIndex)?.name, value: item.value ?? itemBaseValue(item) });
/** AddDaedric: the Lord over 70, the Seducer over 75 (always a weapon),
 *  the Fire and Frost Daedra and the Daedroth over 80. */
export function addDaedric(loot, enemyId, rolls) {
  const num = rangeInt(0, 101, rolls) + (luckMod - 5);
  const flag = (enemyId === 31 && num > 70) || (enemyId === 29 && num > 75) || ((enemyId === 26 || enemyId === 25) && num > 80) || (enemyId === 27 && num > 80);
  if (!flag) return null;
  if (rangeInt(0, 100, rolls) > 50 || enemyId === 29) return dropWeapon(loot, 9, rolls);
  return dropArmor(loot, 521, rolls);
}
/** AddOrcish: the Warlord over 80, the Shaman over 90, the Sergeant over 95, the Orc over 98. */
export function addOrcish(loot, enemyId, rolls) {
  const num = rangeInt(0, 101, rolls) + (luckMod - 5);
  const flag = (enemyId === 24 && num > 80) || (enemyId === 21 && num > 90) || (enemyId === 12 && num > 95) || (enemyId === 7 && num > 98);
  if (!flag) return null;
  if (rangeInt(0, 100, rolls) > 50) return dropWeapon(loot, 8, rolls);
  return dropArmor(loot, 520, rolls);
}
/** UnlevelDroppedLoot_OnEnemyDeath: the corpse's collection - a Daedra
 *  (MobileAffinity.Daedra) or an Orc (MobileTeams.Orcs) may drop its
 *  metal; every gold stack is divided by the level (never under 1) and
 *  multiplied by Range(1, luck's tenth + 1). */
export function unlevelDroppedLoot(entity, { rolls = Math.random, r = null } = {}) {
  if (!entity || !Array.isArray(entity.items)) return;
  luckMod = int(playerLuck() / 10);
  const b = entity.basics ?? {};
  const id = entity.mobileType;
  if (b.affinity === 'Daedra' && daedricDrops(r)) addDaedric(entity.items, id, rolls);
  else if (b.team === 'Orcs' && orcishDrops(r)) addOrcish(entity.items, id, rolls);
  const level = playerLevel();
  for (const item of entity.items) {
    if (item.group !== 'Currency' || item.templateIndex !== GOLD_TEMPLATE) continue;
    item.stackCount = int((item.stackCount ?? 0) / level);
    if (item.stackCount < 1) item.stackCount = 1;
    item.stackCount *= rangeInt(1, luckMod + 1, rolls);
  }
}

// ── Awake ──────────────────────────────────────────────────────────
/** One call per boot (systems/worldTick.js): the two FormulaHelper
 *  overrides, the dead third, the death handler. Each reads `Enabled`
 *  live and declines when off, so DFU's own rolls stand. */
export function installUnleveledLoot({ read: r = null } = {}) {
  const on = () => unleveledLootEnabled(r);
  registerFormulaOverride('randomMaterial', (playerLevel, rolls = Math.random) => (on() ? unleveledRandomMaterial(rolls, matSwitchList(r)) : undefined));
  registerFormulaOverride('randomArmorMaterial', (playerLevel, rolls = Math.random) => (on() ? unleveledRandomArmorMaterial(rolls, matSwitchList(r)) : undefined));
  registerFormulaOverride('modifyFoundLootItems', (lootItems) => (on() ? unleveledGoldLootPiles(lootItems) : undefined));   // read nowhere, as in DFU 1.1.1
  registerEnemyDeathHandler(UNLEVELED_LOOT_VENDOR, (entity, opts) => { if (on()) unlevelDroppedLoot(entity, { ...opts, r }); });
  return true;
}
export function uninstallUnleveledLoot() {
  registerFormulaOverride('randomMaterial', null);
  registerFormulaOverride('randomArmorMaterial', null);
  registerFormulaOverride('modifyFoundLootItems', null);
  registerEnemyDeathHandler(UNLEVELED_LOOT_VENDOR, null);
}
