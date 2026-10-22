// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - A STORES MATERIAL AS DFU'S OWN
// ITEM: its name, and the items a withdrawal mints into the pack
// (bible/06-Systems/Professions-Arc.md 7, 22; law 3 - the Stores are
// one way: nothing here puts an item back in).
//
// AN HERB is a plant template in its group - PlantIngredients1 or 2, as
// the material key says (net/professionLaw.js) - minted exactly as DFU's
// loot mints one (itemTemplates.js setItemFields + mintCondition), so it
// is the northern or southern plant DFU names and DFU's potion maker
// takes by its template (systems/potions.js - the done-when: "An herb
// picked online reaches DFU's potion maker by the pack").
//
// A BASKET FOOD becomes, when it is withdrawn, the template Foraging's
// own code would make at that moment (FORAGE0 14.6): Climates &
// Calories' Apple and Orange while C&C is on, else Foraging's; the
// Mushroom and the Egg Foraging's always - foragingInstall.js
// createForagingItem, the mod's own mint.
//
// PROF2: A METAL OR A GEM is DFU's own item in its own group
// (MetalIngredients, Gems), minted as the herbs are; an ORE, an INGOT or
// STONE is its registered template (systems/professions/profTemplates.js, 610-674) in
// DFU's miscellany - the item DFU's own ItemCollection would hold for it.
//
// PROF7: A HIDE, A LEATHER OR A BOLT the same (655-671); a body's DFU
// part its own ingredient (Big Tooth, Spider's Venom...); its butchery
// C&C's Raw Meat, and a Slaughterfish's Raw Fish as the Basket's fruit is
// chosen - C&C's while it is on, else Foraging's Fish.
// ═══════════════════════════════════════════════════════════════════
import { material } from '../../net/nodeLaw.js';
import { minedMaterial } from '../../net/professionLaw.js';
import { setItemFields, mintCondition, templateByIndex } from '../item/itemTemplates.js';
import { addItem } from '../inventory.js';
import { itemNameParts } from '../item/itemInfo.js';
import { FT, fruitTemplate, fishTemplate } from '../foraging/foragingLaw.js';
import { TEMPLATE as CC_TEMPLATE } from '../survival/food.js';   // PROF7: C&C's Raw Meat
import { createForagingItem } from '../foraging/foragingInstall.js';
import { survivalOn } from '../survival/switch.js';
import { PROF_ITEM_GROUP } from './profTemplates.js';   // PROF2: the ores', ingots' and stone's group (and their rows, registered)

/** The template a food key withdraws as, C&C on or off. PROF7: a body's butchery - C&C's Raw Meat either way (4.4:
 *  "Butchery gives C&C's Raw Meat"), and a Slaughterfish's Raw Fish as Foraging's own code makes a fish (5.2: C&C's Raw
 *  Fish while C&C is on, else Foraging's Fish). */
export function foodTemplate(key, cc) {
  if (key === 'food:apple') return fruitTemplate('Apple', cc);
  if (key === 'food:orange') return fruitTemplate('Orange', cc);
  if (key === 'food:mushroom') return FT.Mushroom;
  if (key === 'food:egg') return FT.Egg;
  if (key === 'food:meat') return CC_TEMPLATE.RawMeat;
  if (key === 'food:fish') return fishTemplate(cc);
  return null;
}

/** One item of a material, as DFU (or Foraging) mints it - or null for a key the Stores never hold. */
export function mintMaterialItem(key, cc = survivalOn()) {
  const m = material(key);
  if (!m) return null;
  if (m.family === 'herbs' || m.group) {   // an herb, and PROF2's DFU metals and gems: DFU's own item in its own group
    return mintCondition(setItemFields({ group: m.group, templateIndex: m.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  }
  if (m.family === 'food') { const t = foodTemplate(key, cc); return t ? createForagingItem(t) : null; }
  if (!templateByIndex(m.templateIndex)) return null;   // a template not registered (Charcoal, before Logging) mints nothing
  return mintCondition(setItemFields({ group: PROF_ITEM_GROUP, templateIndex: m.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
}

/** A material's name as the Stores tab and the toasts say it: DFU's own ("Red Rose", "Twigs (northern)"), the Basket's
 *  food as the template it would withdraw as now. */
export function materialLabel(key, cc = survivalOn()) {
  const m = material(key);
  if (!m) return String(key ?? '');
  if (m.family === 'herbs') return itemNameParts({ group: m.group, templateIndex: m.templateIndex }).name;
  if (m.family === 'food') { const t = foodTemplate(key, cc); return templateByIndex(t)?.name ?? String(key); }
  return templateByIndex(m.templateIndex)?.name ?? minedMaterial(key)?.name ?? String(key);   // PROF2: DFU's name, or the row's
}

/** "Red Roses (northern)": a name's plural for a count, the group's word kept at the end. English's few irregulars
 *  the plants and foods carry are named; the rest take an s. */
const PLURAL_SAME = Object.freeze(['Twigs', 'Green Leaves', 'Root Tendrils', 'Green Berries', 'Red Berries', 'Yellow Berries', 'Red Flowers', 'Yellow Flowers', 'Ginkgo Leaves', 'Bamboo', 'Clover', 'Aloe',
  // PROF2: the metals and the matter the ground gives are counted as mass ("30 Iron", "12 Mithril Ore", "40 Rough Stone")
  'Mercury', 'Tin', 'Brass', 'Lodestone', 'Sulphur', 'Lead', 'Iron', 'Copper', 'Silver', 'Gold', 'Platinum',
  'Moonstone Ore', 'Dwarven Scrap', 'Mithril Ore', 'Adamantium Ore', 'Ebony Ore', 'Orichalcum Ore', 'Rough Stone', 'Cut Stone', 'Charcoal',
  'Resin', 'Heartwood', 'Cured Leather',   // PROF4: the mass nouns a wood and a hide bring ('3 Oak Logs', '12 Oak Planks', but '2 Resin', '4 Cured Leather' - PROF3's stock said 'Cured Leathers')
  'Jade', 'Turquoise', 'Malachite', 'Amber',
  // PROF7: the hides, leathers and silks a body and the loom bring, and its butchery ('2 Harpy Feathers', '3 Raw Meat')
  'Bat Leather', 'Spider Silk', 'Scorpion Chitin', 'Slaughterfish Scales', 'Harpy Feathers', 'Hardened Leather', 'Standard-bearer\'s Silk',
  'Mudcrab Chitin',   // DEX-HIDES (FIELD BUGS 2026-10-21): the Enemy Expansion's chitin is mass, as the scorpion's
  'Spider\'s Venom', 'Dragon\'s Scales', 'Raw Meat', 'Raw Fish', 'Fish',
  'Mortar',   // PROF11 (FOUND by its pin): the bench's mix is mass, as its stone - '10 Mortar', never 'Mortars'
  // PROF12: the Apothecaries' sixteen and the enchanter's Essence, counted as mass ('4 Ichor', '3 Arcane Essence')
  'Werewolf\'s Blood', 'Fairy Dragon\'s Scales', 'Ectoplasm', 'Troll\'s Blood', 'Snake Venom', 'Mummy Wrappings', 'Saint\'s Hair',
  'Pure Water', 'Rain Water', 'Orc\'s Blood', 'Elixir Vitae', 'Nectar', 'Ichor', 'Ivory', 'Arcane Essence']);
const PLURAL_OF = Object.freeze({ Cactus: 'Cacti', 'Pine Branch': 'Pine Branches', Ruby: 'Rubies', 'Big Tooth': 'Big Teeth', 'Small Tooth': 'Small Teeth' });   // PROF12: the Apothecaries' Small Tooth
export function materialCountLabel(key, n, cc = survivalOn()) {
  const full = materialLabel(key, cc);
  if (n === 1) return full;
  const m = /^(.*?)( \((?:northern|southern)\))?$/.exec(full);
  const base = m?.[1] ?? full;
  const tail = m?.[2] ?? '';
  const plural = PLURAL_OF[base] ?? (PLURAL_SAME.includes(base) ? base : `${base}s`);
  return `${plural}${tail}`;
}

/**
 * WITHDRAWN INTO THE PACK: `n` items of the material, each added as DFU's AddItem adds (a stackable one joins its
 * stack). Answers how many were added. PROF7: `slowRot` - a Butcher's meat, which spoils half as fast (PROF0 3.3).
 * PROF9: `noRot` - a Provisioner's provisions, which never spoil (3.3: "rations and dishes never spoil" - the foods a
 * Provisioner takes from the Stores; FACT, C&C's Rations never spoil already). Only a food takes it.
 * @param {{ items?: any[] }} entity @param {string} key @param {number} n @param {boolean} [cc]
 * @param {{ slowRot?: boolean, noRot?: boolean }} [opts]
 */
export function withdrawIntoPack(entity, key, n, cc = survivalOn(), { slowRot = false, noRot = false } = {}) {
  if (!entity || !Number.isSafeInteger(n) || n < 1) return 0;
  if (!Array.isArray(entity.items)) entity.items = [];
  let added = 0;
  for (let i = 0; i < n; i++) {
    const item = mintMaterialItem(key, cc);
    if (!item) break;
    if (slowRot === true) item.slowRot = true;
    if (noRot === true && key.startsWith('food:')) item.noRot = true;   // PROF9: a Provisioner's
    addItem(entity.items, item, 'back');
    added++;
  }
  return added;
}
