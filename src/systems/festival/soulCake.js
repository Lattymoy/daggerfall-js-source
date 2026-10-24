// @ts-check
// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL'S TWO ITEMS - the Soul Cake, the
// festival's treat and its coin, and the Hearth Offering, the bowl of them a home's owner sets out at the door.
//
// THE CAKES AND THE BOWLS ARE THE ACCOUNT'S (net/festivalLaw.js; the Weir Key's model, systems/eliteGates/weirKey.js): the
// account service holds the counts, and the pack's Soul Cakes and Hearth Offerings are their FACE - every answer that
// carries a count (a find, a sale, a take, a fill, a set-out, a take-in) RESTACKS the pack to it (`restackFaces`). A face
// never leaves the pack (their rows are pack-only, KEY-FACE's law) and one anywhere else a save holds is folded away at
// load (`foldStrayFaces`). A cake the service does not count buys nothing.
//
// THE OFFERING'S USE is the host's: the world host registers its placer (`setOfferingPlacer` - scenes/witchesHost.js),
// which sets the offering out at the home whose door the player stands at; a host with none (offline, a building, the
// ?exterior bench) answers where it can be set out.
//
// Their pictures are the festival's own (world/festivalArt.js), put on the texture door at this file's import.
// Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { registerCustomTemplates, setItemFields, mintCondition, registerItemUseHandler } from '../item/itemTemplates.js';
import { addVendorTextures } from '../textureReplacement.js';
import { FESTIVAL_ARCHIVE, FESTIVAL_ART, registerFestivalArt } from '../../world/festivalArt.js';
import { SOUL_CAKE_LAW_ROW, HEARTH_OFFERING_LAW_ROW } from './festivalRows.js';
import { SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE } from '../../net/festivalLaw.js';
import { t } from '../textManager.js';

export { SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE };
/** Their rows: the leaf's (bound, stacked) with their names - an item's name is its row's, as every port item's is
 *  (the Weir Key's, the gems') - and their pictures. */
export const SOUL_CAKE_ROW = Object.freeze({ ...SOUL_CAKE_LAW_ROW, name: 'Soul Cake', worldTextureArchive: FESTIVAL_ARCHIVE, worldTextureRecord: FESTIVAL_ART.cake });
export const HEARTH_OFFERING_ROW = Object.freeze({ ...HEARTH_OFFERING_LAW_ROW, name: 'Hearth Offering', worldTextureArchive: FESTIVAL_ARCHIVE, worldTextureRecord: FESTIVAL_ART.offeringIcon });
registerCustomTemplates([SOUL_CAKE_ROW, HEARTH_OFFERING_ROW]);
registerFestivalArt(addVendorTextures);   // the import IS the registration

/** The card's lines: what each is, in a line or two - read when the card is shown. */
export const SOUL_CAKE_TEXT = Object.freeze({
  cake: () => [t('festival.item.cake.what', 'A spiced cake set out for the restless dead.'), t('festival.item.cake.use', 'The Wyrd Sisters trade for them.')],
  offering: () => [t('festival.item.offering.what', 'A bowl for Soul Cakes, under a tallow lantern.'), t('festival.item.offering.use', 'Use it at your own door to set it out.')],
});

/** Whether a record is a Soul Cake, or a Hearth Offering - its template and its group. */
export const isSoulCake = (/** @type {any} */ item) => item?.templateIndex === SOUL_CAKE_TEMPLATE && item?.group === 'UselessItems2';
export const isHearthOffering = (/** @type {any} */ item) => item?.templateIndex === HEARTH_OFFERING_TEMPLATE && item?.group === 'UselessItems2';
/** Whether a record is either face - a Soul Cake or a Hearth Offering. */
export const isFestivalFace = (/** @type {any} */ item) => isSoulCake(item) || isHearthOffering(item);
/** `n` Soul Cakes (at least one), one stack. */
export function soulCakes(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: SOUL_CAKE_TEMPLATE })), { stackCount: Math.max(1, Math.trunc(Number(n) || 1)) });
}
/** `n` Hearth Offerings (at least one), one stack. */
export function hearthOffering(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: HEARTH_OFFERING_TEMPLATE })), { stackCount: Math.max(1, Math.trunc(Number(n) || 1)) });
}
/** How many Soul Cakes the pack holds (its stacks summed). */
export const soulCakesHeld = (/** @type {any[]} */ items) => (Array.isArray(items) ? items.filter(isSoulCake).reduce((s, it) => s + Math.max(1, it.stackCount ?? 1), 0) : 0);
/** One face's restack: the pack's pieces `is` names set to the count `n` - one stack of n (`mint(n)`), or none. */
function restack(/** @type {any[]} */ items, /** @type {number} */ n, /** @type {(it: any) => boolean} */ is, /** @type {(n: number) => any} */ mint) {
  if (!Array.isArray(items) || !Number.isSafeInteger(n) || n < 0) return false;
  const held = items.filter(is);
  if (held.length === (n > 0 ? 1 : 0) && (n === 0 || (held[0].stackCount ?? 1) === n)) return false;
  for (const it of held) items.splice(items.indexOf(it), 1);
  if (n > 0) items.push(mint(n));
  return true;
}
/**
 * THE RESTACK: the pack's Soul Cakes set to the account's count `n` - one stack of n, or none - whatever the pack held
 * before. Answers whether the pack changed.
 * @param {any[]} items @param {number} n
 */
export const restackSoulCakes = (/** @type {any[]} */ items, /** @type {number} */ n) => restack(items, n, isSoulCake, soulCakes);
/** The same for the Hearth Offerings and the account's bowls. */
export const restackHearthOfferings = (/** @type {any[]} */ items, /** @type {number} */ n) => restack(items, n, isHearthOffering, hearthOffering);

/**
 * KEY-FACE'S LAW FOR THE FESTIVAL: every Soul Cake and Hearth Offering in `lists` (every list a save holds but the pack)
 * or set out in a room (`records`, its `decorOwn`), folded away - the account's counts restack the pack. Answers how many.
 * @param {any[][]} lists @param {any[]} [records]
 */
export function foldStrayFaces(lists, records = []) {
  let n = 0;
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (let i = list.length - 1; i >= 0; i--) if (isFestivalFace(list[i])) n += Math.max(1, list.splice(i, 1)[0].stackCount ?? 1);
  }
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    for (const [id, item] of Object.entries(r)) if (isFestivalFace(item)) { n += Math.max(1, item.stackCount ?? 1); delete r[id]; }
  }
  return n;
}

/** The host's placer: answers the line its use shows, and starts the setting out (scenes/witchesHost.js). */
let _placer = null;
export function setOfferingPlacer(/** @type {((item: any) => string)|null} */ fn) { _placer = typeof fn === 'function' ? fn : null; }
/** What the offering's Use says where no placer stands. */
export const offeringCold = () => t('festival.offering.cold', 'Set it out at your own door, while online.');
registerItemUseHandler(HEARTH_OFFERING_TEMPLATE, (/** @type {any} */ item) => {
  const text = _placer ? _placer(item) : offeringCold();
  return { kind: 'text', text, closesWindow: text === '' };
});
