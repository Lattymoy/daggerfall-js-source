// VANILLA ENHANCED SHIPS WITH THE PORT. OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything")
// - AND IS OUR OWN: the Base, Masked Roads, Snowless Swamps and Jungles, Sands of the Alik'r and Snowfall's winter
// ground keep their place in the texture-mod door (key, title, switch, dependencies, names and sizes -
// systems/ownTextures/ownTexturePacks.json), and each picture is built when it is first drawn from the player's own
// classic record (systems/classicArt.js) under our rule (ownTextureRules.js). AUDIT VE P1: the rule runs in the pack's
// worker (vanillaEnhancedDecodeWorker.js) and the pixels come back moved; a page with none builds here, the same
// pixels. A built picture is kept a while (OWN_CACHE_BYTES), and two asks share one build. FIRST-VISIT: the same
// workers decode a served PNG.
import { OWN_TEXTURE_PACKS, ownSpec, ownSliceSpecs, specKey } from '../ownTextures/ownTexturePacks.js';
import { applyOwnRule } from '../ownTextures/ownTextureRules.js';
import { setShippedDfmods } from '../dfmodTextures.js';
import { decodePng, PRELOAD_CONCURRENCY } from '../textureReplacement.js';
import { mipFitSize } from '../../formats/resample.js';
import { APP_ROOT } from '../appRoot.js';
import { classicArt } from '../classicArt.js';

const VE_DIRS = Object.freeze(['base', 'masked-roads', 'snowless-swamps-and-jungles']);
/** Where the pictures come from now - our rules over the player's own records, no repository. */
export const VE_PACK_SOURCE = Object.freeze({
  rules: 'systems/ownTextures/ownTextureRules.js',
  records: 'systems/classicArt.js',
});
/** The Vanilla Enhanced mods, as the listing has them: `{ key, dir, rule, index }`. */
export const VE_PACK_MODS = Object.freeze(OWN_TEXTURE_PACKS.filter((m) => VE_DIRS.includes(m.dir)));

/** AUDIT VE: the shipped mods on until the player chooses otherwise - the Base. */
export const ON_BY_DEFAULT = Object.freeze(new Set(['base']));

const fetchBytes = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};
const classicPicture = (archive, record, frame) => classicArt().picture(archive, record, frame);
let _fetch = fetchBytes;
let _decode = decodePng;
let _classic = classicPicture;
let _build = null;
const defaultWorker = () =>
  new Worker(new URL('./vanillaEnhancedDecodeWorker.js', import.meta.url), { type: 'module' });
let _makeWorker = defaultWorker;
/** Test seam: this thread's fetch and decode (node has neither a server nor createImageBitmap), the classic records
 *  (`classic(archive, record, frame)`), a whole build (`build(spec)`, in place of the rule), and the worker - none when
 *  any of the others is handed in and no worker is, a fake one when it is. */
export function _setVePackIoForTests({
  fetch = null,
  decode = null,
  worker = null,
  classic = null,
  build = null,
} = {}) {
  _fetch = fetch ?? fetchBytes;
  _decode = decode ?? decodePng;
  _classic = classic ?? classicPicture;
  _build = build;
  _makeWorker = worker ?? (fetch || decode || classic || build ? null : defaultWorker);
  _workers = null;
  _decodeHere = false;
  _built.clear();
  _building.clear();
  _builtBytes = 0;
}

// ---- AUDIT VE P1: THE WORK, OFF THE MAIN THREAD --------------------------------------------------------------------
const DECODE_WORKERS = 2; // as the attached mods' bundle pool (formats/unity/unityBundlePool.js)
let _workers = null; // [{ w, pending, dead }] once made; false when this page cannot have them
let _decodeHere = false; // a worker said it cannot decode a PNG (no OffscreenCanvas there): decodes are this thread's
let _nextAsk = 1,
  _turn = 0;
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
        for (const p of lane.pending.values())
          p.reject(Object.assign(new Error(e?.message ?? 'decode worker failed'), { unsupported: true }));
        lane.pending.clear();
      };
      return lane;
    });
  } catch {
    _workers = false;
  }
  return _workers;
}
/** A lane stopped for good: its worker terminated, and what it still holds answered as unsupported, so each such ask
 *  falls back to this thread rather than waiting on a worker that is gone. */
function letGo(lane) {
  lane.dead = true;
  lane.w.terminate?.();
  for (const ask of lane.pending.values())
    ask.reject(Object.assign(new Error('decode worker let go'), { unsupported: true }));
  lane.pending.clear();
}
const askWorker = (lanes, msg, transfer = []) =>
  new Promise((resolve, reject) => {
    const live = lanes.filter((l) => !l.dead);
    if (!live.length) {
      reject(Object.assign(new Error('no decode worker is alive'), { unsupported: true }));
      return;
    }
    const lane = live[_turn++ % live.length];
    const id = _nextAsk++;
    lane.pending.set(id, { resolve, reject });
    try {
      lane.w.postMessage({ id, ...msg }, transfer);
    } catch (e) {
      lane.pending.delete(id);
      reject(Object.assign(e, { unsupported: true }));
    }
  });

/** Any served PNG by its URL, top-down RGBA and whole, decoded in a worker where the page has one (the
 *  weapon rig's body sprites: 200 ms of a warm launch's boot on this thread). A relative URL is the page's, not the
 *  worker's. */
export async function decodeServedPng(url) {
  const href = new URL(url, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;
  const lanes = _decodeHere ? false : decodeWorkers();
  if (lanes) {
    try {
      return await askWorker(lanes, { url: href, maxSize: Infinity });
    } catch (e) {
      if (!e?.unsupported) throw e;
      _decodeHere = true; // this browser's workers cannot decode: this thread's, for good - its builds stay there
    }
  }
  return _decode(await _fetch(href));
}

// ---- OWN-WORK4: A PICTURE BUILT, KEPT A WHILE ------------------------------------------------------------------------
/** The bytes of built pictures kept for the next ask (a terrain record is asked as a slice and as a texture). */
export const OWN_CACHE_BYTES = 24 * 1024 * 1024;
const _built = new Map(); // specKey -> picture, least recently asked first
const _building = new Map(); // specKey -> Promise, the builds in flight
let _builtBytes = 0;
function keep(key, pic) {
  _built.set(key, pic);
  _builtBytes += pic.data.byteLength;
  while (_builtBytes > OWN_CACHE_BYTES && _built.size > 1) {
    const [k, p] = _built.entries().next().value;
    _built.delete(k);
    _builtBytes -= p.data.byteLength;
  }
}
/** The classic record a spec reads - its own, or (snow) the summer one where the data has no winter record. */
async function sourceOf(spec) {
  const own = await _classic(...spec.from).catch(() => null);
  if (own || !spec.fallback) return own ? { src: own, spec } : null;
  const summer = await _classic(...spec.fallback).catch(() => null);
  return summer ? { src: summer, spec: { ...spec, fromSummer: true } } : null;
}
/** One spec's picture, built in a worker where the page has one, else here. Null where the player has no record. */
async function buildNow(spec) {
  if (_build) return _build(spec);
  const got = await sourceOf(spec);
  if (!got) return null;
  const lanes = decodeWorkers();
  if (lanes) {
    try {
      return await askWorker(lanes, { build: got.spec, source: got.src }, [got.src.data.buffer]);
    } catch (e) {
      if (!e?.unsupported) throw e;
      for (const lane of lanes) letGo(lane); // none left idle for the session, none of their asks left waiting
      _workers = false; // this thread builds from here on
      return buildNow(spec);
    }
  }
  return applyOwnRule(got.spec, got.src);
}
/** A spec's picture at the texture detail - the size a mip chain reaches under `maxSize`, built at that size. */
function built(spec, maxSize = Infinity) {
  const [w, h] = mipFitSize(spec.w, spec.h, maxSize);
  const at = w === spec.w && h === spec.h ? spec : { ...spec, w, h };
  const key = specKey(at);
  const hit = _built.get(key);
  if (hit) {
    _built.delete(key);
    _built.set(key, hit);
    return Promise.resolve(hit);
  }
  if (!_building.has(key)) {
    const p = buildNow(at)
      .then((pic) => {
        if (pic) keep(key, pic);
        return pic;
      })
      .finally(() => _building.delete(key));
    _building.set(key, p);
  }
  return _building.get(key);
}

/** A shipped mod's client, in unityBundleClient's shape: `rgba(name, { maxSize })` a texture, top-down RGBA at the
 *  texture detail; `layers(name)` an array's slices, top-down, whole; `close()`. OWN-WORK4: each picture built. */
export function vePackClient(mod) {
  return {
    async rgba(name, { maxSize = Infinity } = {}) {
      const spec = ownSpec(mod, name);
      if (!spec) throw new Error(`${mod.index.title} carries no ${name}`);
      return built(spec, maxSize);
    },
    async layers(name) {
      const specs = ownSliceSpecs(mod, name);
      if (!specs) throw new Error(`${mod.index.title}: ${name} carries no slices`);
      // a few at a time, as an archive's preload decodes (PRELOAD_CONCURRENCY); AUDIT VE R12: a slice that will not
      // build is null, said once - the ground stands the classic record there (dfmodTextures.js groundLayers)
      const out = new Array(specs.length);
      let next = 0;
      const one = (i) =>
        built(specs[i]).catch((e) => {
          console.warn(`[own textures] ${specKey(specs[i])} would not build:`, e?.message ?? e);
          return null;
        });
      const lane = async () => {
        while (next < specs.length) {
          const i = next++;
          out[i] = await one(i);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, specs.length) }, lane));
      return out;
    },
    close() {},
  };
}

/** The environment packs - Sands of the Alik'r and Snowfall's winter ground, each `{ key, dir, rule,
 *  index }`, on by default. */
export const ENVIRONMENT_PACK_MODS = Object.freeze(OWN_TEXTURE_PACKS.filter((m) => !VE_DIRS.includes(m.dir)));
const SHIPPED = Object.freeze([
  ...VE_PACK_MODS.map((m) =>
    Object.freeze({ key: m.key, index: m.index, open: () => vePackClient(m), on: ON_BY_DEFAULT.has(m.dir) }),
  ),
  ...ENVIRONMENT_PACK_MODS.map((m) =>
    Object.freeze({ key: m.key, index: m.index, open: () => vePackClient(m), on: true }),
  ),
]);
/** Put the shipped mods in the texture-mod door. Idempotent (the same list each time), and cheap: a registration is
 *  names - the boot seam calls it before the attached mods register, and the menus before they read the door, so a
 *  card opened before any host has booted still finds Vanilla Enhanced. */
export const installVanillaEnhancedPack = () => setShippedDfmods(SHIPPED);
