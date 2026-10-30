// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): THE GUILD SHOP'S WORDS, in the player's language - each ware's name and
// what it looks like, each section's name, and who pays. The service names a ware by its key alone.
import { t } from '../../systems/textManager.js';

/** A ware's name. */
export function guildWareName(/** @type {unknown} */ key) {
  switch (key) {
    case 'insigniaarmlet': return t('guild.shop.ware.insigniaarmlet', 'Insignia Armlet');
    case 'guildcrest': return t('guild.shop.ware.guildcrest', 'Guild Crest');
    case 'guildsails': return t('guild.shop.ware.guildsails', 'Guild Sailcloth');
    case 'banker': return t('guild.shop.ware.banker', 'Guild Banker');
    case 'standard': return t('guild.shop.ware.standard', 'Heraldic Standard');
    case 'crestplaque': return t('guild.shop.ware.crestplaque', 'Crest Plaque');
    case 'throne': return t('guild.shop.ware.throne', 'Guildmaster\'s Seat');
    case 'wartable': return t('guild.shop.ware.wartable', 'War Table');
    case 'weaponrack': return t('guild.shop.ware.weaponrack', 'Weapon Rack');
    case 'brazier': return t('guild.shop.ware.brazier', 'Guild Brazier');
    default: return t('guild.shop.ware.unknown', 'a ware');
  }
}

/** What a ware is, in one sentence. */
export function guildWareLook(/** @type {unknown} */ key) {
  switch (key) {
    case 'insigniaarmlet': return t('guild.shop.look.insigniaarmlet', 'Your guild\'s arms on a gilded band round one upper arm. An Aura Armory piece for the arms slot.');
    case 'guildcrest': return t('guild.shop.look.guildcrest', 'Your guild\'s arms in your portrait, where other players see your face.');
    case 'guildsails': return t('guild.shop.look.guildsails', 'Patterned sails for every ship on your account, with your guild\'s arms on them.');
    case 'banker': return t('guild.shop.look.banker', 'A banker\'s counter for the hall. Members press it to open the guild vault.');
    case 'standard': return t('guild.shop.look.standard', 'A tall pole with the guild\'s banner, for the hall.');
    case 'crestplaque': return t('guild.shop.look.crestplaque', 'The guild\'s arms on a wooden shield for the hall\'s wall.');
    case 'throne': return t('guild.shop.look.throne', 'A high-backed seat with the guild\'s arms on its back. One to a guild.');
    case 'wartable': return t('guild.shop.look.wartable', 'A long table with a map of Tamriel and markers on it.');
    case 'weaponrack': return t('guild.shop.look.weaponrack', 'A rack of swords and spears under the guild\'s arms.');
    case 'brazier': return t('guild.shop.look.brazier', 'An iron brazier that burns and lights the hall.');
    default: return '';
  }
}

/** A section's name. */
export function guildShopKindName(/** @type {unknown} */ kind) {
  switch (kind) {
    case 'armory': return t('guild.shop.kind.armory', 'Aura Armory');
    case 'icon': return t('guild.shop.kind.icon', 'Portrait');
    case 'sails': return t('guild.shop.kind.sails', 'Ships');
    case 'furniture': return t('guild.shop.kind.furniture', 'Hall furniture');
    default: return '';
  }
}

/** Who pays, as a ware's tag says it. */
export const guildWarePayerText = (/** @type {unknown} */ payer) => (payer === 'guild'
  ? t('guild.shop.payer.guild', 'From the silver treasury')
  : t('guild.shop.payer.account', 'From your own silver'));

/** A guild piece's stock, as the decor tool says it beside the piece: how many more of it the guild owns to set down. */
export const guildStockText = (/** @type {any} */ entry, /** @type {number} */ left) => (left === Infinity
  ? t('guild.shop.stock.unread', 'From the guild\'s stock')
  : left > 0 ? t('guild.shop.stock.left', 'From the guild\'s stock: {n} left', { n: left })
    : t('guild.shop.stock.none', 'Every {name} the guild owns is set down. Buy another on the guild\'s Shop page.', { name: guildWareName(entry?.guild) }));
