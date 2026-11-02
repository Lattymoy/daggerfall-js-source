// @ts-check
// DRAGON5 (2026-10-29, the owner: "If tamed, the dragon becomes a players mount they can summon, just like their
// horse/carriage"; bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE TAMED DRAGON AS AN ITEM, A LEAF. A third
// Transportation piece beside DFU's Small Cart (93) and Horse (94): bound to the pack (never dropped, sold, traded or
// stored), worthless to the wealth measure, and named by the tame the account service drew (server-account/src/dragons.js
// `dragon_mounts`), which the judge holds it to. Its row registers at import, so the item law knows it headless. Not a
// DFU member: Daggerfall has no flying mount. Ledger A (DRAGON).
import { registerCustomTemplates, registerOwnItemImage } from '../item/itemTemplates.js';
import { DWARVEN_DRAGON_ARCHIVE, dragonArchiveOf } from '../../characters/dwarvenDragonId.js';

export const DRAGON_MOUNT_TEMPLATE = 1820;
export const DRAGON_MOUNT_GROUP = 'Transportation';
/** A tame's id, as the service mints it (dragons.js `dg` and sixteen hex). */
export const DRAGON_ID_RE = /^dg[0-9a-f]{16}$/;
/** REST6's law, SHIP BEFORE ANYONE CAN SEE ONE: false for the release that ships the row, so no older client meets a
 *  dragon it cannot read. A tame waits on the device (scenes/dragonRewards.js) and in its service row until it is on. */
export const DRAGON_MOUNT_ONLINE = true; // DRAGON-ON (2026-10-29, the owner asked for the ride itself): on (Dwarven-Dragon.md DRAGON-ON)
/** Its pack picture: the dragon's own idle front (characters/dwarvenDragon.js records 15-19 idle). */
export const DRAGON_MOUNT_ICON = Object.freeze([DWARVEN_DRAGON_ARCHIVE, 15]);

export const DRAGON_MOUNT_ROW = Object.freeze({
  index: DRAGON_MOUNT_TEMPLATE,
  name: 'Dwarven Dragon',
  baseWeight: 0,
  hitPoints: 100,
  capacityOrTarget: 0,
  basePrice: 0,
  enchantmentPoints: 0,
  rarity: 20,
  variants: 0,
  drawOrderOrEffect: 0,
  isBluntWeapon: false,
  isLiquid: false,
  isOneHanded: false,
  isIngredient: false,
  worldTextureArchive: DRAGON_MOUNT_ICON[0],
  worldTextureRecord: DRAGON_MOUNT_ICON[1],
  playerTextureArchive: 0,
  playerTextureRecord: 0,
  stackable: false,
  hasNoEncumbrance: true,
  isNotRepairable: true,
  bound: true,
  packOnly: true,
});
registerCustomTemplates([DRAGON_MOUNT_ROW]);

/** The tamed dragon `{ id, look }` as the pack holds it. */
export const newDragonMount = ({ id, look = 0 }) => ({
  group: DRAGON_MOUNT_GROUP,
  templateIndex: DRAGON_MOUNT_TEMPLATE,
  dragonId: id,
  ...(look === 1 ? { dragonLook: 1 } : {}),
});
export const isDragonMount = (/** @type {any} */ it) => it?.templateIndex === DRAGON_MOUNT_TEMPLATE;
/** The first dragon in a list, or null. */
export const dragonMountOf = (/** @type {any[] | null | undefined} */ items) =>
  (items ?? []).find(isDragonMount) ?? null;
export const hasDragon = (/** @type {any[] | null | undefined} */ items) => !!dragonMountOf(items);
/** DRAGON5c: a dragon's seed for horse care's law (systems/steedCare.js bornStats) - its tame id's last four hex, 1..65535:
 *  the dragon itself, as a horse's seed is the horse. 0 for anything else. */
export const dragonSeedOf = (/** @type {any} */ it) =>
  isDragonMount(it) && typeof it.dragonId === 'string' && DRAGON_ID_RE.test(it.dragonId)
    ? Math.max(1, parseInt(it.dragonId.slice(-4), 16))
    : 0;
/** A dragon item's look: 1 the Aetherbright, else the brass. */
export const dragonLookOfItem = (/** @type {any} */ it) => (it?.dragonLook === 1 ? 1 : 0);
// DRAGON7: an Aetherbright's pack picture is its own colours (archive 1801), the brass's its row's
registerOwnItemImage(DRAGON_MOUNT_TEMPLATE, (it) => ({
  archive: dragonArchiveOf(dragonLookOfItem(it)),
  record: DRAGON_MOUNT_ICON[1],
}));
/** Whether a dragon item is one a tame made: its own template and a tame's id (the judge asks the service's row). */
export const dragonMountWellFormed = (/** @type {any} */ it) =>
  isDragonMount(it) &&
  typeof it.dragonId === 'string' &&
  DRAGON_ID_RE.test(it.dragonId) &&
  (it.dragonLook === undefined || it.dragonLook === 1);
