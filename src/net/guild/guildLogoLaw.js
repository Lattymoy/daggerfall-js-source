// @ts-check
// GUILD-LOGO (2026-10-30, the owner: "The ability for guilds to submit their own logos and approval on discord instead of
// using the built in insignia creator"; bible/11-Multiplayer/Guild-Shop.md): A GUILD'S OWN PICTURE - its shape, its
// bounds and its address. The guildmaster sends one; the moderators approve it or turn it down from a card on Discord;
// an approved logo is worn in place of the arms' device on every face that draws them. Read by the account service
// (server-account/src/guildLogos.js) and the client. Imports nothing. Pure. Not a DFU member.

/** A logo is square, sent as PNG or WebP (the client draws it into a square PNG first: ui/guild/guildLogoPick.js). */
export const GUILD_LOGO_TYPES = Object.freeze({ png: 'image/png', webp: 'image/webp' });
/** Its side, pixels, and its most bytes - small enough to ride a JSON body, big enough for a banner's device. */
export const GUILD_LOGO_SIDE_MIN = 64;
export const GUILD_LOGO_SIDE_MAX = 256;
export const GUILD_LOGO_SIDE = 128;
export const GUILD_LOGO_MAX_BYTES = 48 * 1024;
/** The request's most bytes: the picture in base64 (four to every three) and the rest of the body. */
export const GUILD_LOGO_BODY_MAX = Math.ceil(GUILD_LOGO_MAX_BYTES / 3) * 4 + 1024;
/** A logo's id: 32 hex, minted by the service - the picture's address, which no one can guess before it is approved. */
/** AUDIT GUILD-SHOP S3: the least time between two logos a guild sends for review, seconds - a card each for the moderators. */
export const GUILD_LOGO_GAP_S = 15 * 60;
export const GUILD_LOGO_ID_RE = /^[0-9a-f]{32}$/;
/** Where the service serves a logo. */
export const GUILD_LOGO_PATH = '/v1/guilds/logo/';
/** A logo's address under the service's origin `base`, or null for no logo. */
export const guildLogoUrl = (/** @type {string} */ base, /** @type {unknown} */ id) =>
  (typeof id === 'string' && GUILD_LOGO_ID_RE.test(id) ? `${String(base ?? '').replace(/\/$/, '')}${GUILD_LOGO_PATH}${id}` : null);
/** The logo id a path names, or null. */
export const guildLogoPathOf = (/** @type {unknown} */ path) => {
  const m = typeof path === 'string' ? /^\/v1\/guilds\/logo\/([0-9a-f]{32})$/.exec(path) : null;
  return m ? m[1] : null;
};

/** A picture's shape off its first bytes: `{ type, side }` for a square PNG or WebP inside the bounds, else `{ error }`.
 *  `meta` the image sniffer's answer (src/poi/poiImage.js poiImageMetaOf), handed in so this file imports nothing. */
export function guildLogoShapeOf(/** @type {any} */ meta, /** @type {number} */ bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > GUILD_LOGO_MAX_BYTES) return { error: 'logo-bytes' };
  if (!meta || meta.error || !Object.hasOwn(GUILD_LOGO_TYPES, meta.format)) return { error: 'logo-type' };
  if (meta.w !== meta.h) return { error: 'logo-square' };
  if (meta.w < GUILD_LOGO_SIDE_MIN || meta.w > GUILD_LOGO_SIDE_MAX) return { error: 'logo-side' };
  return { type: GUILD_LOGO_TYPES[/** @type {keyof typeof GUILD_LOGO_TYPES} */ (meta.format)], side: meta.w };
}
