// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): A GUILD'S ARMS AS A SAIL'S EMBLEM - the shield (ui/guild/guildCrestArt.js
// drawArms, its approved logo once loaded) on a square canvas, read back as a top-down picture the sail painter lays
// over the cloth (systems/naval/sailCloth.js clothPicture). Null where no canvas can be made here (a pin's node): the
// sail then wears its pattern alone.
import { drawArms } from '../../ui/guild/guildCrestArt.js';
import { logoImage } from '../../ui/guild/guildLogoImages.js';
import { armsKey } from '../../net/guild/guildArmsBook.js';

/** The emblem's side, pixels - the port's sails are 64 across. */
export const SAIL_EMBLEM_PX = 64;

/** A pair of arms' emblem's key: its arms, and whether its logo has loaded (the emblem is drawn again when it does). */
export const sailEmblemKey = (/** @type {any} */ arms) =>
  `${armsKey(arms)}|${arms?.logo && logoImage(arms.logo) ? 1 : 0}`;

/** The emblem for `arms`: `{ width, height, data }` (RGBA, top-down), or null. */
export function sailEmblemOf(/** @type {any} */ arms) {
  if (!arms) return null;
  const doc = /** @type {any} */ (globalThis).document;
  const c = doc?.createElement?.('canvas');
  const ctx = c?.getContext?.('2d');
  if (!ctx) return null;
  c.width = SAIL_EMBLEM_PX;
  c.height = SAIL_EMBLEM_PX;
  if (!drawArms(ctx, arms, 0, 0, SAIL_EMBLEM_PX, logoImage(arms.logo))) return null;
  const img = ctx.getImageData(0, 0, SAIL_EMBLEM_PX, SAIL_EMBLEM_PX);
  return { width: img.width, height: img.height, data: img.data };
}
