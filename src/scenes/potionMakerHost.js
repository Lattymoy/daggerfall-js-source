// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POTION-DOOR (SaberGGaming's report, 2026-10-25: "potions from recipes give no XP"; the owner: "No band aids") - THE
// POTION MAKER'S HOOKS, ONE HOME (bible/06-Systems/Professions-Arc.md 52).
//
// DFU'S OWN, AS M2 WIRED THEM (moved here from scenes/worldModes.js createWorldModes, HOST-SPLIT - the host builds the
// window and mounts it, nothing more): the grid is the pack and the cart, the Materials Bag after the cart (BAG1); the
// recipes the carried recipe ITEMS (AUDIT 63 F42); a mix minted by ItemBuilder.CreatePotion's one minter (loot.js); the
// walk's spend never an enchanted twin (F176); MakePotionService's empty-handed refusal (AUDIT 26 F201) read off the
// same lists.
//
// AND THE PROFESSION'S, THROUGH THE SAME WINDOW. DFU's maker mints its potion on the client and asks no service, so it
// earned nothing (PROF12 law 1), while the brew on the Stores page paid - two doors to one act. Now, online (the
// Professions pages standing) at an ALCHEMY STATION - an Alchemist's, a Mages Guild hall, a home's (worldModes
// alchemyHere) - the maker is the brew's door too (ui/professions/profPages.js potionMakerDoor):
//   - its grid holds the Stores' ingredients beside what is carried (each the Stores' row as DFU's own item, its key kept);
//   - a Mix that DFU's recipe law accepts (systems/potions.js mixCauldron - the hash, the same twenty) is the station's
//     brew: the cauldron as the Stores hold it (each unit's own key - an herb its group, the brewer's), asked of
//     `/v1/prof/brew` through the book (BAG-CRAFT puts what is carried in first, the owner's law), its potions minted on the
//     answer and its XP the service's - the words the answer's, never this module's;
//   - a cauldron holding the Stores' goods is never spent here: one no recipe answers is refused before anything moves
//     (PROF12: the station names its recipe), as the brew itself refuses it.
// Where the brew cannot be had for a cauldron wholly carried - a potion past the brewer's rank, a fee the purse cannot
// meet - DFU's maker mixes it as it always did, and says it earned nothing and why. Anywhere else online (a temple's or
// the Dark Brotherhood's Make Potions - no alchemy station) the mix is the client's, unwitnessed, and the maker says it
// earns no experience and where it would. Offline the maker is DFU's as it is: no word, no door.
// ═══════════════════════════════════════════════════════════════════
import { removeOne, addItem } from '../systems/inventory.js';
import { isIngredient } from '../systems/potions.js';
import { isPotionRecipe } from '../systems/useItem.js';
import { createPotion } from '../systems/loot/loot.js';
import { totalGoldAmount } from '../systems/court.js';
import { mintMaterialItem } from '../systems/professions/profItems.js';
import { potionById, brewSpends } from '../net/alchemyLaw.js';
import { INGREDIENT_KEYS, ingredientKeys, PLANT_GROUPS, professionName } from '../net/professionLaw.js';
import { potionMakerDoor } from '../ui/professions/profPages.js';
import { t } from '../systems/textManager.js';

/** The words a classic mix says online - why it earned nothing (L10N4: read when said). */
export const POTION_DOOR_WORDS = Object.freeze({
  away: () => t('prof.maker.away', 'A potion mixed here earns no {profession} experience. At an alchemy station (an Alchemist\'s, a Mages Guild hall or your own home) the potion maker brews it from your Stores and what you carry, and it does.', { profession: professionName('alchemy') }),
  rank: (/** @type {string} */ name, /** @type {number} */ rank) => t('prof.maker.rank', 'Mixed as the classic potion maker mixes, it earns no {profession} experience: {potion} is brewed from {profession} rank {rank}.', { profession: professionName('alchemy'), potion: name, rank }),
  fee: (/** @type {number} */ fee) => t('prof.maker.fee', 'Mixed as the classic potion maker mixes, it earns no {profession} experience: brewing it here costs {fee} gold.', { profession: professionName('alchemy'), fee }),
  stored: (/** @type {string} */ name, /** @type {number} */ rank) => t('prof.maker.storedRank', '{potion} is brewed from {profession} rank {rank}. Take your Stores\' ingredients out of the cauldron to mix it from what you carry.', { profession: professionName('alchemy'), potion: name, rank }),
  brewing: () => t('prof.page.alchemy.brewing', 'Brewing...'),
});

/** The Stores key a cauldron's unit is spent under: a Stores unit its own; a carried herb its group's (`p1:16`, `p2:16`),
 *  any other ingredient its one row's - or null for an ingredient the Stores never hold.
 *  @param {any} it */
export function cauldronKey(it) {
  if (typeof it?.stores === 'string') return it.stores;
  const keys = ingredientKeys(it?.templateIndex);
  if (keys.length > 1) return keys.find((k) => PLANT_GROUPS[/** @type {'p1'|'p2'} */ (k.slice(0, 2))] === it.group) ?? keys[0];
  return keys[0] ?? null;
}

/**
 * THE MAKER'S HOOKS (ui/potionMakerWindow.js): `player` the entity whose pack, cart and bag it reads and spends (the
 * host's playerEntity), `surface` the host's redraw of it, `icons` and `onClose` the window's own; `door` the profession's
 * door, read when it is asked (ui/professions/profPages.js potionMakerDoor - a test hands its own).
 * @param {{ player: any, surface?: () => void, icons: any, onClose?: () => void, door?: () => any }} deps
 */
export function potionMakerHooks({ player, surface = () => {}, icons, onClose, door = potionMakerDoor }) {
  const carried = () => [...(player.items ?? []), ...(player.wagonItems ?? []), ...(player.bagItems ?? [])];
  const station = () => { const d = door(); return d?.station ? d : null; };
  /** POTION-DOOR: one DFU item a Stores key, made once (mintMaterialItem - the item a withdrawal would mint). */
  const minted = new Map();
  const itemOf = (/** @type {string} */ key) => {
    if (!minted.has(key)) { const it = mintMaterialItem(key); minted.set(key, it && isIngredient(it) ? it : null); }
    return minted.get(key);
  };
  /** POTION-DOOR: at an alchemy station, online, the Stores' ingredients - each its row's units, its key kept. */
  const storeItems = () => {
    const d = station();
    if (!d) return [];
    return INGREDIENT_KEYS.flatMap((key) => {
      const n = Math.max(0, Math.trunc(Number(d.held(key)) || 0)), it = n > 0 ? itemOf(key) : null;
      return it ? [{ ...it, stackCount: n, stores: key }] : [];
    });
  };
  return {
    packItems: () => (player.items ??= []),
    // BAG1: THE SECOND LIST the walk reads is the cart's, and the Materials Bag's after it - the herbs a player gathered
    // are DFU's own plants, and DFU's mixer takes them wherever they are carried (read here, spent by takeOne below)
    wagonItems: () => [...(player.wagonItems ??= []), ...(player.bagItems ?? [])],
    storeItems,   // POTION-DOOR: the Stores' beside what is carried, at an alchemy station
    // AUDIT 58: Refresh's gold label is GetGoldAmount (DaggerfallPotionMakerWindow.cs:138) - coins PLUS letters of credit
    // (PlayerEntity.cs:1313-1316), the reader the item maker, the spellbook and the character sheet take
    gold: () => totalGoldAmount(player),
    // AUDIT 63 F42: the picker's source is DFU's own - the recipe ITEMS carried, in the pack AND the wagon, each resolved
    // through GetPotionRecipe(item.PotionRecipeKey) (Refresh :143-153, :164-169); the carried scroll IS the knowledge. Key 0
    // is DFU's "no recipe" sentinel (potionRecipeKey([]) is 0, potions.js), so it never enters the set.
    recipeKeys: () => {
      const seen = new Set();
      for (const it of [...(player.items ?? []), ...(player.wagonItems ?? [])]) {
        if (isPotionRecipe(it) && it.potionRecipeKey) seen.add(it.potionRecipeKey);
      }
      return [...seen];
    },
    // ItemBuilder.CreatePotion (:324) - loot.js has minted these since E1 for random treasure; a mixed potion is the
    // same bottle carrying the same key, so there is one minter
    addPotion: (/** @type {any} */ recipe, /** @type {number} */ key) => {
      const bottle = createPotion(key);
      bottle.name = recipe.name;
      bottle.value = recipe.price;
      addItem(player.items, bottle);
      surface();
    },
    takeOne: (/** @type {number} */ templateIndex, /** @type {string} */ where, /** @type {string} */ group) => {
      const list = where === 'pack' ? player.items : (player.wagonItems ?? []);
      // F176: GetItem(group, template, allowEnchantedItem: false) (:338, :345) - the walk must not spend an enchanted twin
      // of the plain reagent that went in the pot (X11b: removeOne takes a TEMPLATE INDEX, not the item)
      if (removeOne(list, templateIndex, { group, allowEnchantedItem: false })) return true;
      // BAG1: the second list's second half - the Materials Bag, after the cart
      return where !== 'pack' && removeOne(player.bagItems ?? [], templateIndex, { group, allowEnchantedItem: false });
    },
    /**
     * POTION-DOOR: THE MIX ASKED FIRST (ui/potionMakerWindow.js _mix) - `result` DFU's law's (mixCauldron), `cauldron` its
     * units. Null offline (DFU's mix, nothing said); `{ classic: true, word }` DFU's mix and why it earned nothing;
     * `{ ok: false, text }` refused, nothing spent (`failed` - the window's "potionFailed"); `{ wait, answer }` the station's brew, asked.
     * @param {{ kind: string, recipe?: any }} result @param {any[]} cauldron
     */
    brew: (result, cauldron) => {
      const d = door();
      if (!d) return null;
      if (!d.station) return { classic: true, word: POTION_DOOR_WORDS.away() };
      const stored = cauldron.some((it) => typeof it?.stores === 'string');
      if (result.kind !== 'mixed') return stored ? { ok: false, failed: true } : null;   // the window's own "potionFailed"
      const potion = potionById(result.recipe?.name);
      const keys = cauldron.map(cauldronKey);
      if (!potion || keys.some((k) => !k) || !brewSpends(potion, /** @type {string[]} */ (keys))) return stored ? { ok: false, failed: true } : null;
      const rank = Number(d.rank()) || 0, fee = Number(d.fee()) || 0;
      if (rank < potion.rank) return stored ? { ok: false, text: POTION_DOOR_WORDS.stored(potion.name, potion.rank) } : { classic: true, word: POTION_DOOR_WORDS.rank(potion.name, potion.rank) };
      if (!stored && fee > totalGoldAmount(player)) return { classic: true, word: POTION_DOOR_WORDS.fee(fee) };
      return { wait: POTION_DOOR_WORDS.brewing(), answer: d.brew(potion.id, keys) };
    },
    /** AUDIT 26 F201: MakePotionService (:670-686) scans pack AND wagon for any ingredient (BAG1: and the bag) - and at an
     *  alchemy station, POTION-DOOR, the Stores' ingredients count as well. */
    stocked: () => carried().some(isIngredient) || storeItems().length > 0,
    icons,
    entity: player,
    onClose,
  };
}
