// @ts-check
// The Pipe and Nirnroot. The pipe is the clay pipe Daggerfall stands among its household clutter (TEXTURE.211 record
// 24), made a thing the player carries: its Use packs it with one nirnroot from the pack and smokes it, and the world
// goes hazy for 30 to 60 seconds (pipeHaze.js). Without nirnroot the pipe says so and nothing is spent. A General
// Store's and a Pawn Shop's counter carries a pipe; an Alchemist's and a General Store's carries some nirnroot.
// Nirnroot wears Daggerfall's Root Bulb picture. Not a DFU member.
import { registerCustomTemplates, setItemFields, mintCondition, registerItemUseHandler } from '../item/itemTemplates.js';
import { removeOne } from '../inventory.js';
import { hudText } from '../notify.js';
import { t } from '../textManager.js';
import { PIPE_TEMPLATE, NIRNROOT_TEMPLATE, PIPE_LAW_ROW, NIRNROOT_LAW_ROW } from './pipeRow.js';
import { startHaze, hazeSeconds } from './pipeHaze.js';

export { PIPE_TEMPLATE, NIRNROOT_TEMPLATE };
const GROUP = 'UselessItems2';
/** The pipe's picture: the single clay pipe of Daggerfall's Misc flats. */
export const PIPE_PICTURE = Object.freeze([211, 24]);
/** Nirnroot's picture: Daggerfall's Root Bulb ingredient. */
export const NIRNROOT_PICTURE = Object.freeze([254, 14]);
const rowOf = (/** @type {any} */ law, /** @type {string} */ name, /** @type {readonly number[]} */ picture) =>
  Object.freeze({
    ...law,
    name,
    capacityOrTarget: 0,
    enchantmentPoints: 0,
    variants: 0,
    drawOrderOrEffect: 0,
    isBluntWeapon: false,
    isLiquid: false,
    isOneHanded: false,
    isIngredient: false,
    worldTextureArchive: picture[0],
    worldTextureRecord: picture[1],
    playerTextureArchive: 0,
    playerTextureRecord: 0,
  });
export const PIPE_ROW = rowOf(PIPE_LAW_ROW, 'Pipe', PIPE_PICTURE);
export const NIRNROOT_ROW = rowOf(NIRNROOT_LAW_ROW, 'Nirnroot', NIRNROOT_PICTURE);
registerCustomTemplates([PIPE_ROW, NIRNROOT_ROW]);

/** Nirnroot a counter shelf carries each day. */
export const NIRNROOT_SHELF_STACK = 5;

export const PIPE_TEXT = Object.freeze({
  pipe: () => [
    t('pipe.item.what', 'A clay pipe, worn smooth by use.'),
    t('pipe.item.use', 'Use it with nirnroot in your pack to smoke.'),
  ],
  nirnroot: () => [
    t('pipe.nirnroot.what', 'A sprig of nirnroot. It hums faintly.'),
    t('pipe.nirnroot.use', 'Pack it in a pipe and smoke it.'),
  ],
  smoked: () => t('pipe.smoked', 'You pack the pipe with nirnroot and smoke it. The world grows hazy.'),
  noRoot: () => t('pipe.noRoot', 'You have no nirnroot to pack the pipe with.'),
});

export const isPipe = (/** @type {any} */ item) => item?.templateIndex === PIPE_TEMPLATE && item?.group === GROUP;
export const isNirnroot = (/** @type {any} */ item) =>
  item?.templateIndex === NIRNROOT_TEMPLATE && item?.group === GROUP;

/** A pipe. */
export const pipe = () => mintCondition(setItemFields({ group: GROUP, templateIndex: PIPE_TEMPLATE }));
/** `n` nirnroot (at least one), one stack. */
export function nirnroot(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: GROUP, templateIndex: NIRNROOT_TEMPLATE })), {
    stackCount: Math.max(1, Math.trunc(Number(n) || 1)),
  });
}

/**
 * The pipe's Use: one nirnroot from the pack (else the list the pipe is in) spent, and the haze started. The pack
 * closes so the haze is seen; with no nirnroot the pack stays open and says why.
 * @param {any} _item @param {any[]} collection @param {{ entity?: any, rolls?: () => number, haze?: (s: number) => any }} [ctx]
 */
export function smokePipe(_item, collection, { entity = null, rolls = Math.random, haze = startHaze } = {}) {
  const pack = Array.isArray(entity?.items) ? entity.items : collection;
  if (!Array.isArray(pack) || !removeOne(pack, NIRNROOT_TEMPLATE, { group: GROUP }))
    return { kind: 'text', text: PIPE_TEXT.noRoot() };
  const seconds = hazeSeconds(rolls);
  haze(seconds);
  hudText(PIPE_TEXT.smoked());
  return { kind: 'smoked', seconds, closesWindow: true };
}
registerItemUseHandler(PIPE_TEMPLATE, (/** @type {any} */ item, /** @type {any[]} */ collection, /** @type {any} */ ctx) =>
  smokePipe(item, collection, { entity: ctx?.entity, rolls: ctx?.rolls }),
);

/** A counter shelf's pipe: one, added when the shelf holds none. */
export function ensureShelfPipe(/** @type {any[]} */ items) {
  if (Array.isArray(items) && !items.some(isPipe)) items.push(pipe());
  return items;
}
/** A counter shelf's nirnroot: a stack of NIRNROOT_SHELF_STACK, added when the shelf holds none. */
export function ensureShelfNirnroot(/** @type {any[]} */ items) {
  if (Array.isArray(items) && !items.some(isNirnroot)) items.push(nirnroot(NIRNROOT_SHELF_STACK));
  return items;
}
