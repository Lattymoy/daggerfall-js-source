// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E3 (2026-09-25): ILIAC PUDDLE NO MORE'S FISH AS ITEMS (jet082,
// 1.2.2) - the seven templates the mod registers (DeepWaters.Init's
// RegisterCustomItem, UselessItems2), the pictures its PassiveFishResources
// gives them, and the item a fish carries (TryCreateFishItem).
//
// THE TEMPLATES are the mod's own ItemTemplates.json (vendored verbatim,
// tools/iliacPuddleAssets.mjs): names, weights, prices, rarity 20, not
// repairable - "Juvenile Finulon" at 30 kg among them.
//
// THE PICTURES. The mod writes each fish's icon into ItemHelper's image
// cache (CacheInventoryIcons) under TEXTURE.216 records 41-47, undyed,
// masked and not - the key an item drawn from 216/41-47 reads. Those
// records are the classic treasure piles' own pictures, and the cache
// reaches only item pictures, never a pile in the world: so the port
// gives each fish template a picture of its own - an archive that is only
// that picture (the template's index, record 0, the port's precedent for
// a mod's item art) - and every item picture the mod's cache would have
// answered answers the same. The icon is the drawn fish's picture with
// its shape given back (RestoreIconAspect: Unity's import rounded each to
// powers of two).
// ═══════════════════════════════════════════════════════════════════

import FISH_TEMPLATES_JSON from '../../vendor/iliac-puddle-no-more/ItemTemplates.json' with { type: 'json' };
import { registerCustomTemplates, setItemFields, mintCondition } from './itemTemplates.js';
import { addVendorTextures, decodePng } from './textureReplacement.js';
import { PASSIVE_FISH_SPECIES, isFishTemplateIndex, speciesOfTemplate, restoreIconAspect } from '../world/passiveFish.js';

/** ItemGroups.UselessItems2, as the port names it. */
export const FISH_GROUP = 'UselessItems2';
/** A fish's picture's archive: its own template index (record 0). */
export const fishIconArchive = (templateIndex) => templateIndex;

/** The mod's rows, each drawn from its own picture (above). */
export const DEEP_WATERS_FISH_TEMPLATES = Object.freeze(FISH_TEMPLATES_JSON.map((t) => Object.freeze({
  ...t, worldTextureArchive: fishIconArchive(t.index), worldTextureRecord: 0,
})));
registerCustomTemplates(DEEP_WATERS_FISH_TEMPLATES);

/** A fish's own drawn picture's URL (the vendored Flats/<name>.png). */
export const fishPictureUrl = (name) => new URL(`../../vendor/iliac-puddle-no-more/Flats/${name}.png`, import.meta.url).href;

async function fetchPicture(name) {
  const r = await fetch(fishPictureUrl(name));
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

let _iconsInstalled = false;
/**
 * The icons on the texture door: each fish's archive, record 0, built
 * from its picture (LoadFishIconTexture falls back to the species' own
 * picture when no 216_NN-0 file is in the bundle - none is) with its
 * aspect restored. Once; a test passes its own bytes and decoder.
 */
export function installDeepWatersFishIcons({ fetchBytes = fetchPicture, decode = decodePng } = {}) {
  if (_iconsInstalled) return 0;
  _iconsInstalled = true;
  return addVendorTextures(PASSIVE_FISH_SPECIES.map((s) => ({
    archive: fishIconArchive(s.templateIndex), record: 0, frame: 0, standIn: true, fileName: `${s.textureName}.png`,
    build: async () => restoreIconAspect(await decode(await fetchBytes(s.textureName)), s.billboardAspect),
  })));
}
/** Tests: install again. */
export function _resetFishIconsForTests() { _iconsInstalled = false; }

/**
 * TryCreateFishItem: ItemBuilder.CreateItem(UselessItems2, the species'
 * template) - null for none (the mod refuses a species whose item did not
 * come out as its template).
 */
export function createFishItem(species) {
  if (!species) return null;
  const item = mintCondition(setItemFields({ group: FISH_GROUP, templateIndex: species.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  return item?.templateIndex === species.templateIndex ? item : null;
}

/**
 * What DaggerfallUnityItem.SetItem writes from the template - the name, the
 * pictures, the material, the dye, the weight, the variant, the value, the
 * flags, the conditions, the type data, the enchantment points, the
 * message, the stack. The port reads each off the template when the item
 * carries none, so SetItem is these dropped and the mint's own written.
 */
const SET_ITEM_FIELDS = Object.freeze([
  'name', 'playerTextureArchive', 'playerTextureRecord', 'worldTextureArchive', 'worldTextureRecord', 'material', 'nativeMaterialValue',
  'dye', 'dyeColor', 'weightInKg', 'variant', 'rriVariant', 'value', 'flags', 'currentCondition', 'maxCondition', 'typeDependentData',
  'enchantmentPoints', 'message', 'stackCount',
]);

/**
 * NormalizeFishItemCollection: a fish item that is not in UselessItems2
 * put back there - SetItem(UselessItems2, its template), which keeps the
 * item's UID and everything SetItem does not write (its enchantments, its
 * quest tie, its poison) - and its stack and condition given back.
 * @param {Array<any>} items
 * @returns {number} how many were put back
 */
export function normalizeFishItems(items) {
  let n = 0;
  for (let i = 0; i < (items?.length ?? 0); i++) {
    const it = items[i];
    if (!it || it.group === FISH_GROUP || !isFishTemplateIndex(it.templateIndex)) continue;
    const { stackCount, currentCondition, maxCondition } = it;
    const fresh = createFishItem(speciesOfTemplate(it.templateIndex));
    for (const k of SET_ITEM_FIELDS) delete it[k];
    Object.assign(it, fresh, { stackCount, currentCondition, maxCondition });
    n++;
  }
  return n;
}

/** The species an item is, or null. */
export const fishSpeciesOfItem = (item) => (item && isFishTemplateIndex(item.templateIndex) ? speciesOfTemplate(item.templateIndex) : null);
