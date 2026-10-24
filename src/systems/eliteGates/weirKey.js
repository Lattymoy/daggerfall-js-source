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
// THE FACE IS THE PACK'S ALONE (FIELD BUGS 2026-10-19f KEY-FACE): the restack reads the pack and nothing else, so its row
// is pack-only (weirKeyRow.js `packOnly` - systems/item/itemBound.js isPackOnly, the Wallet's law: no wagon, no storage, no
// room's decoration, no revenant's take); and a save that holds a face anywhere else - stowed before the row said so, or
// thrown on a body (egFind.js) and never taken up - has it folded away as it loads (`foldStrayWeirKeys`, save.js
// restorePlayer): a face out of the pack counts nothing, and carried back it showed keys the account never held.
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
/** Its row: the leaf's (weirKeyRow.js - bound, stacked, pack-only) with its name and its picture. */
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
/**
 * KEY-FACE (FIELD BUGS 2026-10-19f): A FACE OUT OF THE PACK IS FOLDED AWAY. Every Weir Key out of each of `lists` (never
 * hand it the pack - the restack's), and out of each of `records` (`{ id: item }`, a room's own things standing - DECOR2a
 * `decorOwn`), in place. The balance is the account's: what was folded comes back as the pack's own face at the next
 * restack. Answers how many keys the folded faces showed - each face once, however many of the lists named it (the load's
 * walk lists a record's items too).
 * @param {any[][]} lists @param {any[]} [records]
 */
export function foldStrayWeirKeys(lists, records = []) {
  const folded = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (let i = list.length - 1; i >= 0; i--) if (isWeirKey(list[i])) folded.add(list.splice(i, 1)[0]);
  }
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    for (const [id, item] of Object.entries(r)) if (isWeirKey(item)) { folded.add(item); delete r[id]; }
  }
  return [...folded].reduce((n, it) => n + Math.max(1, it.stackCount ?? 1), 0);
}
/** The host's opener: answers the line its use shows, and starts the open (scenes/world.js). AUDIT STAKE-ROW (L1-2): an
 *  empty line is the opener's "the start window will ask" (scenes/eliteGates/egClient.js useKey) - the use closes the pack,
 *  so the window has the screen when its preflight lands; a pack left up held the slot and the window was refused, unsaid. */
let _opener = null;
export function setWeirKeyOpener(/** @type {((item: any) => string)|null} */ fn) { _opener = typeof fn === 'function' ? fn : null; }
registerItemUseHandler(WEIR_KEY_TEMPLATE, (item) => {
  const text = _opener ? _opener(item) : EG_TEXT.cold;
  return { kind: 'text', text, closesWindow: text === '' };
});
