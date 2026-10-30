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
import {
  registerCustomTemplates,
  setItemFields,
  mintCondition,
  registerItemUseHandler,
} from '../item/itemTemplates.js';
import { EG_TEXT } from '../../net/eliteGates/egLaw.js';
import { WEIR_KEY_ART, registerWeirKeyArt } from '../../world/eliteGates/egKeyArt.js'; // EG-ZH: its own picture
import { addVendorTextures } from '../textureReplacement.js';
import { WEIR_KEY_TEMPLATE, WEIR_KEY_LAW_ROW } from './weirKeyRow.js'; // KEY-LAW: its row a leaf, so the law knows it headless

export { WEIR_KEY_TEMPLATE };
/** Its row: the leaf's (weirKeyRow.js - bound, stacked, pack-only) with its name and its picture. */
export const WEIR_KEY_ROW = Object.freeze({
  ...WEIR_KEY_LAW_ROW,
  name: EG_TEXT.keyName,
  worldTextureArchive: WEIR_KEY_ART.archive,
  worldTextureRecord: WEIR_KEY_ART.record,
});
registerCustomTemplates([WEIR_KEY_ROW]);
registerWeirKeyArt(addVendorTextures); // EG-ZH: the import IS the registration
/** Whether a record is a Weir Key - its template and its group, the one spelling every rule reads. */
export const isWeirKey = (/** @type {any} */ item) =>
  item?.templateIndex === WEIR_KEY_TEMPLATE && item?.group === 'UselessItems2';
/** `n` Weir Keys (at least one), one stack. */
export function weirKeys(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: WEIR_KEY_TEMPLATE })), {
    stackCount: Math.max(1, Math.trunc(Number(n) || 1)),
  });
}
/** How many the pack holds (its stacks summed). */
export const weirKeysHeld = (/** @type {any[]} */ items) =>
  Array.isArray(items) ? items.filter(isWeirKey).reduce((s, it) => s + Math.max(1, it.stackCount ?? 1), 0) : 0;
/**
 * RPT1026-CLIENT (private reports: a pack's count of Weir Keys fell back to one now and then from more): THE FACES
 * LYING ON BODIES. The find throws its face onto the body (egFind.js egFindThrow), and KEY-FACE left its count open: the
 * pack was restacked to the balance less THAT face alone, so a second find before the first body was looted, or any answer
 * landing before the take-up (the balance asked every ten minutes), restacked the pack as if no face lay anywhere - each
 * face taken up then showed a key the account never held, and the next answer took it back (*The key turns to rust.*).
 * Every face thrown is kept here with the body's list it lies in, and every restack sets the pack to the balance less the
 * faces still lying: taken up - gone from its list, whatever door took it - a face leaves the count, so the pack and the
 * bodies together always show the balance. Away from the dungeon (the find's tier door, `setWeirKeyFacesHere`) the faces
 * left behind are folded off their bodies and the pack shows the whole balance again; a load folds every one (KEY-FACE).
 * AUDIT RPT1026 K1: and a face is kept against the VISIT it was thrown in (the door's answer at the throw - the world host's
 * dungeon context, built new at every entry): "away" is not only the answers that land outside a dungeon. Out of one and
 * into the next (or the same one built again) before any answer landed outside, the faces of the visit before lay on
 * bodies its context took with it, and every restack in the new one still counted them - the pack one key short of the
 * balance for each, none of them on any body to take up. A face of another visit is folded as one away is.
 * @type {{ list: any[], face: any, at: unknown }[]}
 */
const _lying = [];
/** @type {() => unknown} */
let _facesHere = () => true;
/** The find's door (egFind.js registerEgFind): the visit the player stands in (any token, the same for one dungeon's
 *  stay - AUDIT RPT1026 K1), or null/false away from the bodies its faces lie on - null, the find let go with its world,
 *  keeps none as lying. */
export function setWeirKeyFacesHere(/** @type {(() => unknown)|null} */ fn) {
  _facesHere = typeof fn === 'function' ? fn : () => true;
  if (!fn) _lying.length = 0;
}
/** One face thrown into a body's `list` (egFind.js egFindThrow), and kept as lying there - in the visit it was thrown in. */
export function throwWeirKeyFace(/** @type {any[]} */ list) {
  const face = weirKeys(1);
  list.push(face);
  _lying.push({ list, face, at: _facesHere() });
  return face;
}
/** The faces off their bodies - those `gone` names, every one by default - and those no longer kept as lying. */
function foldLyingWeirKeys(gone = (/** @type {{ at: unknown }} */ _e) => true) {
  for (let i = _lying.length - 1; i >= 0; i--) {
    const { list, face } = _lying[i];
    if (!gone(_lying[i])) continue;
    const k = list.indexOf(face);
    if (k >= 0) list.splice(k, 1);
    _lying.splice(i, 1);
  }
}
/** How many keys the faces still lying on bodies show - a face taken up leaves the count; away, none lies (folded). */
export function weirKeysLying() {
  if (!_facesHere()) {
    foldLyingWeirKeys();
    return 0;
  }
  const here = _facesHere();
  foldLyingWeirKeys((e) => e.at !== here); // AUDIT RPT1026 K1: a face of another visit lies on a body that visit took with it
  for (let i = _lying.length - 1; i >= 0; i--) if (!_lying[i].list.includes(_lying[i].face)) _lying.splice(i, 1);
  return _lying.reduce((s, e) => s + Math.max(1, e.face.stackCount ?? 1), 0);
}
/** Test seam: no face lying anywhere. */
export const _resetWeirKeyFacesForTests = () => {
  _lying.length = 0;
  _facesHere = () => true;
};
/**
 * THE RESTACK (section 5): the pack's Weir Keys set to the account's balance `n` less the faces still lying on bodies
 * (RPT1026-CLIENT, above) - one stack, or none - whatever the pack held before. Answers whether the pack changed.
 * @param {any[]} items @param {number} n
 */
export function restackWeirKeys(items, n) {
  if (!Array.isArray(items) || !Number.isSafeInteger(n) || n < 0) return false;
  const want = Math.max(0, n - weirKeysLying());
  const held = items.filter(isWeirKey);
  if (held.length === (want > 0 ? 1 : 0) && (want === 0 || (held[0].stackCount ?? 1) === want)) return false;
  for (const it of held) items.splice(items.indexOf(it), 1);
  if (want > 0) items.push(weirKeys(want));
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
  _lying.length = 0; // RPT1026-CLIENT: the load's world is a new one - every face it holds out of the pack is folded here
  const folded = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (let i = list.length - 1; i >= 0; i--) if (isWeirKey(list[i])) folded.add(list.splice(i, 1)[0]);
  }
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    for (const [id, item] of Object.entries(r))
      if (isWeirKey(item)) {
        folded.add(item);
        delete r[id];
      }
  }
  return [...folded].reduce((n, it) => n + Math.max(1, it.stackCount ?? 1), 0);
}
/** The host's opener: answers the line its use shows, and starts the open (scenes/world.js). AUDIT STAKE-ROW (L1-2): an
 *  empty line is the opener's "the start window will ask" (scenes/eliteGates/egClient.js useKey) - the use closes the pack,
 *  so the window has the screen when its preflight lands; a pack left up held the slot and the window was refused, unsaid. */
let _opener = null;
export function setWeirKeyOpener(/** @type {((item: any) => string)|null} */ fn) {
  _opener = typeof fn === 'function' ? fn : null;
}
registerItemUseHandler(WEIR_KEY_TEMPLATE, (item) => {
  const text = _opener ? _opener(item) : EG_TEXT.cold;
  return { kind: 'text', text, closesWindow: text === '' };
});
