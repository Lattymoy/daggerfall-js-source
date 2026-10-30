// @ts-check
// GUILD-SHOP (2026-10-30, the owner: "The new guild shop where you can purchase the insignia aura, guild furniture, guild
// profile icon, etc" and "Everything should cost silver"; bible/11-Multiplayer/Guild-Shop.md): WHAT THE GUILD SHOP SELLS,
// WHO PAYS AND WHAT EACH COSTS. A ware is the buyer's own (paid from their silver, held by the account, worn by any of its
// characters while that character is in a guild) or the guild's (paid from the guild's silver treasury by the
// guildmaster, kept as a count the hall's keepers set down). Read by the account service (server-account/src/guildShop.js)
// and the client. Imports nothing, so the worker's graph stays flat. Pure. Not a DFU member - Ledger A (GUILD-SHOP).

/** Who pays for a ware: the buyer's own silver, or the guild's silver treasury. */
export const GUILD_SHOP_PAYERS = Object.freeze(['account', 'guild']);
/** The shop's sections, in the window's order. */
export const GUILD_SHOP_KINDS = Object.freeze(['armory', 'icon', 'sails', 'furniture']);

/** @typedef {Readonly<{ key: string, kind: string, payer: string, price: number, bit?: number, max?: number, model?: number }>} GuildWare */
/** @returns {GuildWare} */
const ware = (/** @type {string} */ key, /** @type {string} */ kind, /** @type {string} */ payer, /** @type {number} */ price, /** @type {{ bit?: number, max?: number, model?: number }} */ extra) =>
  Object.freeze({ key, kind, payer, price, ...extra });
/**
 * EVERY WARE, in the window's order. An account ware's `bit` is its place on `players.guild_wares` and is never renumbered
 * (a stored bit is a sale). A guild ware's `max` is how many one guild may own; its `model` is the piece it sets down
 * (world/guildFurniture.js). The prices are silver; a day's combat strikes 150 (marksLaw.js MARKS_COMBAT), so a personal
 * ware is one to two weeks' fighting and a hall's piece a guild's shared week.
 */
export const GUILD_SHOP_WARES = Object.freeze([
  ware('insigniaarmlet', 'armory', 'account', 1_500, { bit: 1 }),
  ware('guildcrest', 'icon', 'account', 600, { bit: 2 }),
  ware('guildsails', 'sails', 'account', 1_200, { bit: 4 }),
  ware('banker', 'furniture', 'guild', 6_000, { max: 2, model: 864300 }),
  ware('standard', 'furniture', 'guild', 1_500, { max: 6, model: 864301 }),
  ware('crestplaque', 'furniture', 'guild', 800, { max: 8, model: 864302 }),
  ware('throne', 'furniture', 'guild', 4_000, { max: 1, model: 864303 }),
  ware('wartable', 'furniture', 'guild', 3_000, { max: 2, model: 864304 }),
  ware('weaponrack', 'furniture', 'guild', 1_200, { max: 6, model: 864305 }),
  ware('brazier', 'furniture', 'guild', 900, { max: 8, model: 864306 }),
]);
/** Every ware's key. */
export const GUILD_SHOP_KEYS = Object.freeze(GUILD_SHOP_WARES.map((w) => w.key));
/** A ware by its key, or null. */
export const guildWareOf = (/** @type {unknown} */ key) => (typeof key === 'string' ? GUILD_SHOP_WARES.find((w) => w.key === key) ?? null : null);
/** The account wares held on a `players.guild_wares` value, by key, in the window's order. */
export const guildWaresHeld = (/** @type {unknown} */ bits) => {
  const b = Number.isSafeInteger(bits) ? /** @type {number} */ (bits) : 0;
  return GUILD_SHOP_WARES.filter((w) => w.payer === 'account' && (b & /** @type {number} */ (w.bit)) !== 0).map((w) => w.key);
};
/** The guild ware a placed model is, or null - a hall's piece the guild bought, never the catalogue's. */
export const guildWareOfModel = (/** @type {unknown} */ model) => GUILD_SHOP_WARES.find((w) => w.model != null && w.model === model) ?? null;
/** Every guild furniture model. */
export const GUILD_FURNITURE_MODELS = Object.freeze(GUILD_SHOP_WARES.filter((w) => w.model != null).map((w) => /** @type {number} */ (w.model)));

/** Whether a guild that owns `owned` of a ware may buy one more. */
export const guildWareRoom = (/** @type {any} */ w, /** @type {number} */ owned) => w?.payer === 'guild' && Number.isSafeInteger(owned) && owned >= 0 && owned < w.max;

// ─── THE GUILD'S OWN ACTS, IN SILVER ─────────────────────────────────────────────────────────────────────────────────
// The owner: "Introduce guild name change for cost" and "Everything should cost silver". GUILD2a's rename was 25,000 gold
// from the realm's gold in the treasury; it is the silver treasury's now, at the yardstick's worth (MARK_WORTH_GOLD, 10).

/** What a new name costs, in silver from the guild's treasury. */
export const GUILD_RENAME_SILVER = 2_500;
/** GUILD-LOGO: what a logo's review costs, held from the guild's treasury while the moderators decide - burnt when it is
 *  approved, home when it is turned down or withdrawn. */
export const GUILD_LOGO_FEE = 2_500;
