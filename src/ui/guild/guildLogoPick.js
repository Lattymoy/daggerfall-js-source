// @ts-check
// GUILD-LOGO (bible/11-Multiplayer/Guild-Shop.md): A PICTURE CHOSEN, MADE A LOGO THE SERVICE TAKES - its middle square,
// drawn GUILD_LOGO_SIDE across and written as a PNG (a WebP where the PNG is over the size). The service checks it again
// (server-account/src/guildLogos.js); this only spares the guildmaster a picture it would refuse.
import { GUILD_LOGO_SIDE, GUILD_LOGO_SIDE_MIN, GUILD_LOGO_MAX_BYTES } from '../../net/guild/guildLogoLaw.js';

/** The pictures the file box offers. */
export const GUILD_LOGO_ACCEPT = 'image/png,image/webp,image/jpeg,image/gif';
/** A file larger than this is refused before it is read. */
export const GUILD_LOGO_FILE_MAX = 8 * 1024 * 1024;

/**
 * `file` as a logo: `{ ok: true, image, url }` - its base64 and a data URL to show it - or `{ ok: false, error }` with the
 * refusal word: logo-unread (no picture to be read here), logo-file (a file past GUILD_LOGO_FILE_MAX), logo-side, logo-bytes.
 * @param {any} file @param {{ doc?: any, bitmap?: (f: any) => Promise<any> }} [o]
 */
export async function pickGuildLogo(
  file,
  { doc = globalThis.document, bitmap = /** @type {any} */ (globalThis).createImageBitmap } = {},
) {
  if (!file || typeof file.size !== 'number' || typeof bitmap !== 'function')
    return { ok: false, error: 'logo-unread' }; // AUDIT GUILD-SHOP C7: each its own word
  if (file.size > GUILD_LOGO_FILE_MAX) return { ok: false, error: 'logo-file' };
  let bmp;
  try {
    bmp = await bitmap(file);
  } catch {
    return { ok: false, error: 'logo-unread' };
  }
  const side = Math.min(bmp.width, bmp.height);
  if (!(side >= GUILD_LOGO_SIDE_MIN)) {
    bmp.close?.();
    return { ok: false, error: 'logo-side' };
  }
  const c = doc.createElement('canvas');
  c.width = GUILD_LOGO_SIDE;
  c.height = GUILD_LOGO_SIDE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bmp,
    (bmp.width - side) / 2,
    (bmp.height - side) / 2,
    side,
    side,
    0,
    0,
    GUILD_LOGO_SIDE,
    GUILD_LOGO_SIDE,
  );
  bmp.close?.();
  for (const [type, q] of /** @type {[string, number | undefined][]} */ ([
    ['image/png', undefined],
    ['image/webp', 0.92],
    ['image/webp', 0.8],
  ])) {
    const url = String(c.toDataURL(type, q));
    if (!url.startsWith(`data:${type};base64,`)) continue; // a browser that writes no WebP answers a PNG
    const image = url.slice(url.indexOf(',') + 1);
    if (Math.floor((image.length * 3) / 4) <= GUILD_LOGO_MAX_BYTES) return { ok: true, image, url };
  }
  return { ok: false, error: 'logo-bytes' };
}
