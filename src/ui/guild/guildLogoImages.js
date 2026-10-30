// @ts-check
// GUILD-LOGO (bible/11-Multiplayer/Guild-Shop.md): AN APPROVED LOGO'S PICTURE, decoded once a page. A face that draws a
// guild's arms asks `logoImage(id)`: the decoded picture, or null while it loads (the face draws the device meanwhile and
// draws again when `logoVersion()` moves). Fetched across origins with CORS, so a canvas that draws it can still be
// uploaded as a texture. A picture that will not load is not asked again this page.
import { guildLogoSrc } from '../../net/guild/guildArmsBook.js';

/** @type {Map<string, { img: any, ok: boolean, failed: boolean }>} */
const _logos = new Map();
let _version = 0;

/** Moves whenever a logo finishes loading. */
export const logoVersion = () => _version;

/** A logo's decoded picture by its id, or null while it loads, will not load, or no picture can be made here. */
export function logoImage(/** @type {unknown} */ id) {
  if (typeof id !== 'string' || !id) return null;
  const had = _logos.get(id);
  if (had) return had.ok ? had.img : null;
  const src = guildLogoSrc(id);
  const Img = /** @type {any} */ (globalThis).Image;
  if (!src || typeof Img !== 'function') return null;
  const img = new Img();
  const e = { img, ok: false, failed: false };
  _logos.set(id, e);
  img.crossOrigin = 'anonymous';
  img.onload = () => { e.ok = true; _version++; };
  img.onerror = () => { e.failed = true; };
  img.src = src;
  return null;
}

/** For the tests: every picture forgotten. */
export function _resetLogoImages() { _logos.clear(); _version = 0; }
