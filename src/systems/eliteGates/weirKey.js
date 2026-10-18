// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 5): THE WEIR KEY - one of the
// Spire's portal keys, the item that opens an Elite Breach. Template 575, free beside the gate's 570-572 and the Ayleid
// stones' 573-574, in the miscellany group (never a gem: every Gems piece is a crystal a slot takes - PORTAL1's lesson).
//
// THE BALANCE IS THE ACCOUNT'S (section 5): a key opens a real relay instance, so the count is the account service's
// (`players.eg_keys`) and the stack in the pack is its FACE - every answer that carries the count (the keys' look, an
// open's stake, a claim's roll) RESTACKS the pack to it (`restackWeirKeys`). A key the service does not count does
// nothing: the open is the service's to refuse, and the pack is restacked to what it says.
//
// ITS USE is the host's: the world host registers its opener (`setWeirKeyOpener` - scenes/world.js egUseKey), which
// answers the line to show and starts the open's asks; a host with none (the ?exterior bench, a game offline) answers
// "The key is cold here." Every reader shows a `text` result (useItem.js's registered arm), so no reader needs a new
// kind.
//
// ITS PICTURE is its own (EG-ZH, 2026-10-12 - Elite-Gates.md section 25.1): painted in code under the Spire's held archive
// block (world/eliteGates/egKeyArt.js, world/eliteGates/pseudoArchives.js EG_ARCH_BLOCK.key) - a Battlemage's key in gold leaf with a blue stone
// in its bow - and put on the texture door at this file's import as its archive's stand-in, so every door that draws an
// item's picture draws it (the custom template's world arm - systems/item/itemTemplates.js usesWorldTexture).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { registerCustomTemplates, setItemFields, mintCondition, registerItemUseHandler } from '../item/itemTemplates.js';
import { EG_TEXT } from '../../net/eliteGates/egLaw.js';
import { WEIR_KEY_ART, registerWeirKeyArt } from '../../world/eliteGates/egKeyArt.js';   // EG-ZH: its own picture
import { addVendorTextures } from '../textureReplacement.js';
import { WEIR_KEY_TEMPLATE, WEIR_KEY_LAW_ROW } from './weirKeyRow.js';   // KEY-LAW: its row a leaf, so the law knows it headless

export { WEIR_KEY_TEMPLATE };
/** Its row: the leaf's (weirKeyRow.js - bound, stacked) with its name and its picture. */
export const WEIR_KEY_ROW = Object.freeze({
  ...WEIR_KEY_LAW_ROW, name: EG_TEXT.keyName, worldTextureArchive: WEIR_KEY_ART.archive, worldTextureRecord: WEIR_KEY_ART.record,
});
registerCustomTemplates([WEIR_KEY_ROW]);
registerWeirKeyArt(addVendorTextures);   // EG-ZH: the import IS the registration
/** Whether a record is a Weir Key - its template and its group, the one spelling every rule reads. */
export const isWeirKey = (/** @type {any} */ item) => item?.templateIndex === WEIR_KEY_TEMPLATE && item?.group === 'UselessItems2';
/** `n` Weir Keys (at least one), one stack. */
export function weirKeys(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: WEIR_KEY_TEMPLATE })), { stackCount: Math.max(1, Math.trunc(Number(n) || 1)) });
}
/** How many the pack holds (its stacks summed). */
export const weirKeysHeld = (/** @type {any[]} */ items) => (Array.isArray(items) ? items.filter(isWeirKey).reduce((s, it) => s + Math.max(1, it.stackCount ?? 1), 0) : 0);
/**
 * THE RESTACK (section 5): the pack's Weir Keys set to the account's balance `n` - one stack of n, or none - whatever
 * the pack held before. Answers whether the pack changed.
 * @param {any[]} items @param {number} n
 */
export function restackWeirKeys(items, n) {
  if (!Array.isArray(items) || !Number.isSafeInteger(n) || n < 0) return false;
  const held = items.filter(isWeirKey);
  if (held.length === (n > 0 ? 1 : 0) && (n === 0 || (held[0].stackCount ?? 1) === n)) return false;
  for (const it of held) items.splice(items.indexOf(it), 1);
  if (n > 0) items.push(weirKeys(n));
  return true;
}
/** The host's opener: answers the line its use shows, and starts the open (scenes/world.js). */
let _opener = null;
export function setWeirKeyOpener(/** @type {((item: any) => string)|null} */ fn) { _opener = typeof fn === 'function' ? fn : null; }
registerItemUseHandler(WEIR_KEY_TEMPLATE, (item) => ({ kind: 'text', text: _opener ? _opener(item) : EG_TEXT.cold }));
