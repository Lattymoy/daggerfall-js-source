// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT21 (2026-10-07) — THE AYLEID STONES.
//
// The Loot arc II (bible/06-Systems/Loot-II-Arc.md section 13; Mac:
// "what could we do to make it even more amazing, while also balancing
// everyrhing?", then "Lets go all in"). Two things DFU's roll cannot
// make, found at the deepest sources through the Thunderlock's registry
// (lootRarity.js registerUniqueFind) - as LATE finds, the door's last
// draws (rollLateFinds: the arc's law 9, so no seed's earlier draw
// moves):
//   - the WELKYND STONE, from a source of tier 6: used, your magicka is
//     full, and the stone is spent;
//   - the VARLA STONE, from tier 10: used, every enchanted piece you
//     wear is whole again - its condition full, which is a DFU magic
//     item's charges - and the stone is spent.
// A stone that would do nothing is not spent: it says so. The Welkynd
// Shard (gateSpoils.js) is a sliver of the first; these are whole.
//
// Their rows are the port's own (573 and 574, beside the shard's 571
// and the Portal Stone's 572), miscellany as the Portal Stone is - a
// Gems piece is a crystal a slot takes (equipTable.js getEquipSlot) -
// on DFU's gem art (TEXTURE.254: Turquoise's blue for the Welkynd,
// Amber's lamplight for the Varla). Registered at import
// (systems/worldTick.js imports this, the Thunderlock's wire).
// ═══════════════════════════════════════════════════════════════════

import { registerCustomTemplates, mintCondition, setItemFields, registerItemUseHandler } from './itemTemplates.js';
import { registerUniqueFind } from './lootRarity.js';
import { isEnchanted } from './inventory.js';
import { equipTableOf } from './equip.js';

export const WELKYND_STONE_TEMPLATE = 573;
export const VARLA_STONE_TEMPLATE = 574;
/** The source tier each is first found at. */
export const WELKYND_STONE_TIER = 6;
export const VARLA_STONE_TIER = 10;
export const AYLEID_STONE_TEMPLATES = Object.freeze([
  Object.freeze({ index: WELKYND_STONE_TEMPLATE, name: 'Welkynd Stone', baseWeight: 0.5, hitPoints: 1000, basePrice: 1500, rarity: 20,
    worldTextureArchive: 254, worldTextureRecord: 5 }),
  Object.freeze({ index: VARLA_STONE_TEMPLATE, name: 'Varla Stone', baseWeight: 0.5, hitPoints: 1000, basePrice: 4000, rarity: 20,
    worldTextureArchive: 254, worldTextureRecord: 7 }),
]);
registerCustomTemplates(AYLEID_STONE_TEMPLATES);
export const isWelkyndStone = (/** @type {any} */ item) => item?.templateIndex === WELKYND_STONE_TEMPLATE;
export const isVarlaStone = (/** @type {any} */ item) => item?.templateIndex === VARLA_STONE_TEMPLATE;
/** One stone, minted on its row. */
export const welkyndStone = () => mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: WELKYND_STONE_TEMPLATE }));
export const varlaStone = () => mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: VARLA_STONE_TEMPLATE }));

registerUniqueFind({ id: 'welkynd-stone', minTier: WELKYND_STONE_TIER, weight: 1, late: true, mint: () => [welkyndStone()] });
registerUniqueFind({ id: 'varla-stone', minTier: VARLA_STONE_TIER, weight: 1, late: true, mint: () => [varlaStone()] });

/** The stones' words. */
export const STONE_TEXT = Object.freeze({
  welkynd: 'The Welkynd Stone flares blue and is spent. Your magicka is full.',
  welkyndFull: 'Your magicka is already full - the stone would be wasted.',
  varla: (n) => `The Varla Stone flares and is spent. ${n === 1 ? 'An enchanted piece you wear is' : `${n} enchanted pieces you wear are`} whole again.`,
  varlaWhole: 'Every enchanted piece you wear is already whole - the stone would be wasted.',
  nobody: 'Nothing happens.',
});
/** One off a stack, or the stone off the list. */
function spend(item, list) {
  if ((item.stackCount ?? 1) > 1) { item.stackCount -= 1; return; }
  const i = Array.isArray(list) ? list.indexOf(item) : -1;
  if (i >= 0) list.splice(i, 1);
}
/** THE WELKYND STONE, USED: the user's magicka full, the stone spent - or, full already, nothing spent. */
export function useWelkyndStone(item, list, entity) {
  if (!entity) return { kind: 'text', text: STONE_TEXT.nobody };
  const max = Number(entity.maxMagicka) || 0;
  if (!(max > 0) || (Number(entity.magicka) || 0) >= max) return { kind: 'text', text: STONE_TEXT.welkyndFull };
  entity.magicka = max;
  spend(item, list);
  return { kind: 'text', text: STONE_TEXT.welkynd };
}
/** The enchanted pieces a Varla Stone would mend: worn, enchanted, under their full condition. */
export const varlaMends = (entity) => (entity ? equipTableOf(entity).filter((it) => it && isEnchanted(it) && Number.isFinite(it.maxCondition) && (it.currentCondition ?? it.maxCondition) < it.maxCondition) : []);
/** THE VARLA STONE, USED: every enchanted piece the user wears whole, the stone spent - or, all whole, nothing spent. */
export function useVarlaStone(item, list, entity) {
  if (!entity) return { kind: 'text', text: STONE_TEXT.nobody };
  const pieces = varlaMends(entity);
  if (!pieces.length) return { kind: 'text', text: STONE_TEXT.varlaWhole };
  for (const it of pieces) it.currentCondition = it.maxCondition;
  spend(item, list);
  return { kind: 'text', text: STONE_TEXT.varla(pieces.length) };
}
registerItemUseHandler(WELKYND_STONE_TEMPLATE, (item, list, ctx) => useWelkyndStone(item, list, ctx?.entity ?? null));
registerItemUseHandler(VARLA_STONE_TEMPLATE, (item, list, ctx) => useVarlaStone(item, list, ctx?.entity ?? null));
