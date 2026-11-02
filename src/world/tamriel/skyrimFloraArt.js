// @ts-check
// Stand Skyrim's plant PNGs on the texture door. Catalog is skyrimFlora.js (worker-safe);
// this file is the browser door (festivalArt.js's law).
import { addVendorTextures, decodePng } from '../../systems/textureReplacement.js';
import { SKYRIM_FLORA, SKYRIM_FLORA_ARCHIVE } from './skyrimFlora.js';

export { SKYRIM_FLORA, SKYRIM_FLORA_ARCHIVE, SKYRIM_FLORA_PATHS, skyrimCoverPicks } from './skyrimFlora.js';

const floraUrl = (/** @type {{ zone: string, file: string }} */ e) =>
  new URL(`../../assets/skyrim/flora/${e.zone}/${e.file}`, import.meta.url).href;

const defaultFetch = async (/** @type {string} */ url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[skyrim-flora] ${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

async function cutPicture(
  /** @type {Uint8Array} */ bytes,
  /** @type {(b: Uint8Array) => Promise<{width:number,height:number,data:Uint8Array}>} */ decode,
) {
  const pic = await decode(bytes);
  const data = new Uint8Array(pic.data);
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0;
  return { width: pic.width, height: pic.height, data };
}

let _registered = false;
/**
 * @param {(entries: any[]) => number} [addTextures]
 * @param {(b: Uint8Array) => Promise<{width:number,height:number,data:Uint8Array}>} [decode]
 * @param {(url: string) => Promise<Uint8Array>} [fetchBytes]
 */
export function registerSkyrimFloraArt(addTextures = addVendorTextures, decode = decodePng, fetchBytes = defaultFetch) {
  if (_registered || typeof addTextures !== 'function') return 0;
  _registered = true;
  return addTextures(SKYRIM_FLORA.map((e, record) => ({
    archive: SKYRIM_FLORA_ARCHIVE,
    record,
    frame: 0,
    standIn: true,
    cutout: true,
    fileName: `skyrim-flora-${e.name}`,
    build: async () => cutPicture(await fetchBytes(floraUrl(e)), decode),
  })));
}

export function _resetSkyrimFloraArt() { _registered = false; }

registerSkyrimFloraArt();
