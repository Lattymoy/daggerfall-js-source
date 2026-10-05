// @ts-check
// LW6c (2026-10-05, bible/06-Systems/Living-World.md "LW6c"): CARRIED HOME - a keepsake of one the deep kept, found with
// their remains (LW6b) and carried home to the household they lived with. Mac: "make friends or enemies, and explore a
// dynamic world".
//
// THE THING. Each of the fallen of a dive carries one (`mintKeepsake`): a locket, a ring, a brooch or a charm - their
// own, by their id - an item of the port's own (DECLARED; a custom template registered at import, as the port's others
// are: profTemplates.js), worth nothing to a merchant, named for them ("Ada Lark's locket") and marking whose it was
// (`livingKeepsake`: their id, name, town and home). It does not stack, and no shelf stocks it.
// CARRIED HOME (`keepsakeFor`): the keepsake of one who lived in a town's home, among what the player carries - the
// household's moment when the player speaks with one of them (livingTown.js moment).
import { registerCustomTemplates, setItemFields, mintCondition } from '../itemTemplates.js';
import { lwSeed, textSeed } from './seed.js';

/** The keepsake's template index - free after the port's own (survival's 1700s). */
export const KEEPSAKE_TEMPLATE = 1800;
export const KEEPSAKE_GROUP = 'UselessItems2';
export const KEEPSAKE_ROW = Object.freeze({
  index: KEEPSAKE_TEMPLATE, name: 'Keepsake', baseWeight: 0.1, hitPoints: 100, capacityOrTarget: 0, basePrice: 1,
  enchantmentPoints: 0, rarity: 0, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 254, worldTextureRecord: 56, playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: false,
});
registerCustomTemplates([KEEPSAKE_ROW]);

/** What a keepsake is - the owner's own, by their id. */
export const KEEPSAKE_KINDS = Object.freeze(['locket', 'ring', 'brooch', 'charm']);

/** A resident's id without a newcomer's generation (`L1.t2~3` -> `L1.t2`): the place, not the one holding it. @param {string} id */
const placeIdOf = (id) => String(id ?? '').split('~')[0];

/**
 * A fallen's keepsake: their own thing, named for them, marking whose it was.
 * @param {{ id: string, name: string, town: number, home?: number|null }} res
 */
export function mintKeepsake(res) {
  const kind = KEEPSAKE_KINDS[lwSeed(textSeed(res.id), 0x6b656570) % KEEPSAKE_KINDS.length];   // 'keep'
  const item = mintCondition(setItemFields({ group: KEEPSAKE_GROUP, templateIndex: KEEPSAKE_TEMPLATE, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  return { ...item, name: `${res.name}'s ${kind}`, livingKeepsake: { id: res.id, name: res.name, town: res.town >>> 0, home: res.home ?? null } };
}

/** Whether an item is a keepsake. @param {any} it */
export const isKeepsake = (it) => it?.templateIndex === KEEPSAKE_TEMPLATE && !!it?.livingKeepsake;

/**
 * The keepsake among `items` of one who lived in `town`'s `home` - never one of `holder`'s own place (the fallen, or a
 * newcomer holding it now) - or null. AUDIT-C1: `homeOf(id)` the town's own word for the home of the place a keepsake
 * names when it carries none - the deep's dead are travellers, minted off the town's row alone with no house (their home
 * is the town's census's), and no keepsake of theirs was ever carried home.
 * @param {readonly any[]} items @param {number} town @param {number|null|undefined} home @param {string} holder - the id spoken with
 * @param {((id: string) => (number|null))|null} [homeOf]
 */
export function keepsakeFor(items, town, home, holder, homeOf = null) {
  if (home == null) return null;
  return (items ?? []).find((it) => isKeepsake(it) && it.livingKeepsake.town === (town >>> 0)
    && (it.livingKeepsake.home ?? homeOf?.(it.livingKeepsake.id) ?? null) === home
    && placeIdOf(it.livingKeepsake.id) !== placeIdOf(holder)) ?? null;
}
