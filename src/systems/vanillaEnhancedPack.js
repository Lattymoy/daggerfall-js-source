// VE4 (2026-10-05, Mac: "Put it in the codebase") - VANILLA ENHANCED SHIPS WITH THE PORT.
//
// carademono's Vanilla Enhanced is Daggerfall's own textures remastered, and Port-Doctrine's A RENDER OF GAME DATA IS
// GAME DATA kept it the player's to attach (VE3). Mac approved carrying it (Port-Doctrine records the exception), so
// three of its mods ship under public/art/vanilla-enhanced/ - the Base, Masked Roads, and Snowless Swamps and Jungles -
// written there by tools/vanillaEnhancedVendor.mjs from github.com/drcarademono/vanilla-enhanced at the commit it pins.
//
// THEY ARE MODS, NOT THE PORT'S OWN ART. Daggerfall Unity reads them as mods - behind Replace Game Artwork, after the
// loose folder, in the load order their manifests' dependencies make - so they register in the texture-mod door
// (systems/dfmodTextures.js setShippedDfmods) beside any the player attaches, with the index an attached copy's would
// carry (vendor/vanilla-enhanced/vanilla-enhanced.index.json). Only where a picture comes from differs: the client here
// fetches the port's own file. Nothing is fetched until a picture is drawn; the Base is on by default, its add-ons off.
//
// A TEXTURE ARRAY IS ITS SLICES. The bundles carry each terrain tile set as one BC7 Texture2DArray; the vendoring proved
// every slice within BC7's error of a PNG and serves the slice from it (the Base's own record where it is that record),
// so `layers` answers the array from those files. Masked Roads' 403 array is 57 deep and Daggerfall Unity refuses it;
// it is indexed with its depth and no slices, and the door's own depth law refuses it here too.
//
// AUDIT VE (Mac, 2026-10-05: "Ensure this is on by default. And performance isn't affected"):
//   - THE BASE IS ON BY DEFAULT (`ON_BY_DEFAULT`), as a mod in DFU's Mods folder is; its add-ons stay off until picked on
//     the Texture Overhaul card. The player's own choice either way is kept (dfmodTextures.js DFMOD_SHIPPED_PREF).
//   - THE DECODE IS A WORKER'S (P1, systems/vanillaEnhancedDecodeWorker.js): the fetch, the readback and the texture
//     detail's fit run off the main thread, as an attached bundle's decode does in its own worker. A browser with no
//     OffscreenCanvas in a worker, or node, decodes on this thread - the same pixels.
import pack from '../../vendor/vanilla-enhanced/vanilla-enhanced.index.json' with { type: 'json' };
import { setShippedDfmods } from './dfmodTextures.js';
import { decodePng, PRELOAD_CONCURRENCY } from './textureReplacement.js';
import { resampleRgba, mipFitSize } from '../formats/resample.js';
import { APP_ROOT } from './appRoot.js';

/** The repository and commit the pictures were read from. */
export const VE_PACK_SOURCE = Object.freeze({ repo: pack.Source, commit: pack.Commit });
/** The shipped mods, as the index lists them: `{ key, dir, index, slices }`. */
export const VE_PACK_MODS = Object.freeze(pack.Mods.map((m) => Object.freeze({ ...m })));

/** AUDIT VE: the shipped mods on until the player chooses otherwise - the Base (Mac: "Ensure this is on by default"). */
export const ON_BY_DEFAULT = Object.freeze(new Set(['base']));

const fetchBytes = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};
let _fetch = fetchBytes;
let _decode = decodePng;
const defaultWorker = () => new Worker(new URL('./vanillaEnhancedDecodeWorker.js', import.meta.url), { type: 'module' });
let _makeWorker = defaultWorker;
/** Test seam: this thread's fetch and decode (node has neither a server nor createImageBitmap), and the decode worker -
 *  none when a fetch or decode is handed in and no worker is, a fake one when it is. */
export function _setVePackIoForTests({ fetch = null, decode = null, worker = null } = {}) {
  _fetch = fetch ?? fetchBytes; _decode = decode ?? decodePng;
  _makeWorker = worker ?? (fetch || decode ? null : defaultWorker);
  _workers = null;
}

// ---- AUDIT VE P1: THE DECODE, OFF THE MAIN THREAD -------------------------------------------------------------------
const DECODE_WORKERS = 2;   // as the attached mods' bundle pool (formats/unityBundlePool.js)
let _workers = null;        // [{ w, pending }] once made; false when this page cannot have them
let _nextAsk = 1, _turn = 0;
function decodeWorkers() {
  if (_workers !== null) return _workers;
  if (!_makeWorker || (_makeWorker === defaultWorker && typeof Worker === 'undefined')) return false;
  try {
    _workers = Array.from({ length: DECODE_WORKERS }, () => {
      const lane = { w: _makeWorker(), pending: new Map(), dead: false };
      lane.w.onmessage = (ev) => {
        const m = ev.data ?? {};
        const p = lane.pending.get(m.id);
        if (!p) return;
        lane.pending.delete(m.id);
        if (m.error) p.reject(Object.assign(new Error(m.error), { unsupported: m.unsupported === true }));
        else p.resolve({ width: m.width, height: m.height, data: m.data });
      };
      // a worker that will not load (no module workers here, its script refused) is dead: what it holds is answered as
      // unsupported, and nothing is sent to it again - an ask after the error must not wait on it for ever
      lane.w.onerror = (e) => {
        lane.dead = true;
        for (const p of lane.pending.values()) p.reject(Object.assign(new Error(e?.message ?? 'decode worker failed'), { unsupported: true }));
        lane.pending.clear();
      };
      return lane;
    });
  } catch { _workers = false; }
  return _workers;
}
const askWorker = (lanes, url, maxSize) => new Promise((resolve, reject) => {
  const live = lanes.filter((l) => !l.dead);
  if (!live.length) { reject(Object.assign(new Error('no decode worker is alive'), { unsupported: true })); return; }
  const lane = live[_turn++ % live.length];
  const id = _nextAsk++;
  lane.pending.set(id, { resolve, reject });
  try { lane.w.postMessage({ id, url, maxSize }); } catch (e) { lane.pending.delete(id); reject(Object.assign(e, { unsupported: true })); }
});
/** One shipped file as top-down RGBA, fitted to `maxSize` as a mip chain would be: a worker's decode where the page has
 *  one, else this thread's - and this thread's for good once a worker says it cannot. */
async function decodeShipped(path, maxSize = Infinity) {
  const url = vePackUrl(path);
  const lanes = decodeWorkers();
  if (lanes) {
    try { return await askWorker(lanes, url, maxSize); } catch (e) {
      if (!e?.unsupported) throw e;
      for (const l of lanes) { try { l.w.terminate(); } catch { /* gone */ } }
      _workers = false;
    }
  }
  const img = await _decode(await _fetch(url));
  const [w, h] = mipFitSize(img.width, img.height, maxSize);
  return w === img.width && h === img.height ? img : resampleRgba(img, w, h);
}

/** The served URL of a file under the pack's root (`base/302_0-0.png`). */
export const vePackUrl = (path, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`${pack.Root}/${path.split('/').map(encodeURIComponent).join('/')}`, root).href;

/** A shipped mod's client, in unityBundleClient's shape: `rgba(name, { maxSize })` a texture, top-down RGBA at the
 *  texture detail; `layers(name)` an array's slices, top-down, whole; `close()`. */
export function vePackClient(mod) {
  const files = new Map(mod.index.textures.map(([name]) => [name, `${mod.dir}/${name}.png`]));
  const picture = (path) => decodeShipped(path);
  return {
    async rgba(name, { maxSize = Infinity } = {}) {
      const path = files.get(name);
      if (!path) throw new Error(`${mod.index.title} carries no ${name}`);
      return decodeShipped(path, maxSize);
    },
    async layers(name) {
      const paths = mod.slices?.[name] ?? [];
      if (!paths.length) throw new Error(`${mod.index.title}: ${name} carries no slices`);
      // a few at a time, as an archive's preload decodes (PRELOAD_CONCURRENCY); AUDIT VE R12: a slice that will not load
      // is null, said once - the ground stands the classic record there (dfmodTextures.js groundLayers), not the climate
      const out = new Array(paths.length);
      let next = 0;
      const one = (i) => picture(paths[i]).catch((e) => { console.warn(`[vanilla-enhanced] ${paths[i]} would not load:`, e?.message ?? e); return null; });
      const lane = async () => { while (next < paths.length) { const i = next++; out[i] = await one(i); } };
      await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, paths.length) }, lane));
      return out;
    },
    close() {},
  };
}

const SHIPPED = Object.freeze(VE_PACK_MODS.map((m) => Object.freeze({ key: m.key, index: m.index, open: () => vePackClient(m), on: ON_BY_DEFAULT.has(m.dir) })));
/** Put the shipped mods in the texture-mod door. Idempotent (the same list each time), and cheap: a registration is
 *  names - the boot seam calls it before the attached mods register, and the menus before they read the door, so a
 *  card opened before any host has booted still finds Vanilla Enhanced. */
export const installVanillaEnhancedPack = () => setShippedDfmods(SHIPPED);
