// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md sections 4 and 5): THE EFFECTS' OWN SOUNDS - a kill effect's and
// a portal skin's, ours outright (tools/storefrontSfx.mjs -> public/sfx/fx-*.wav, baked to DAGGER.SND's own 11025 Hz
// 8-bit mono, provenance in public/sfx/SOURCES.md) - and the season's tremor and fissure - registered on the bus under
// string keys the climb's way. A clip is
// loaded the first time it is asked for; one asked while it loads plays when it lands, if it lands soon, else not at
// all - a late sound is a wrong one. Not a DFU member: DAGGER.SND has no portal of stone or brass.
import { APP_ROOT } from './appRoot.js';

/** Each key's file under public/sfx. */
export const STOREFRONT_SFX = Object.freeze({
  'storefront:kill-ashen': 'fx-kill-ashen.wav',
  'storefront:kill-voidrend': 'fx-kill-voidrend.wav',
  'storefront:kill-pyre': 'fx-kill-pyre.wav',
  'storefront:kill-tonal': 'fx-kill-tonal.wav',
  'storefront:portal-runic': 'fx-portal-runic.wav',
  'storefront:portal-daedric': 'fx-portal-daedric.wav',
  'storefront:portal-aetheric': 'fx-portal-aetheric.wav',
  'storefront:portal-brass': 'fx-portal-brass.wav',
  'storefront:season-tremor': 'fx-season-tremor.wav',   // the season's tremor (scenes/seasonHost.js)
  'storefront:season-hum': 'fx-season-hum.wav',   // a Brass Fissure, heard from beside it
});
/** A sound asked for while its clip loads plays if the clip lands within this (ms). */
export const STOREFRONT_SFX_LATE_MS = 350;

export const storefrontSfxUrl = (/** @type {string} */ file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;
/** @type {WeakMap<any, Map<string, Promise<boolean>>>} each bus's loads, by key */
const _loads = new WeakMap();
/** Load one clip onto a bus, once. Answers whether it stands. */
export function loadStorefrontSound(/** @type {any} */ audio, /** @type {string} */ key, { fetchBytes = null } = {}) {
  const file = STOREFRONT_SFX[/** @type {keyof typeof STOREFRONT_SFX} */ (key)];
  if (!file || !audio?.registerSound) return Promise.resolve(false);
  let m = _loads.get(audio);
  if (!m) { m = new Map(); _loads.set(audio, m); }
  if (!m.has(key)) {
    m.set(key, (async () => {
      try {
        const bytes = fetchBytes ? await fetchBytes(file) : new Uint8Array(await (await fetch(storefrontSfxUrl(file))).arrayBuffer());
        return !!(await audio.registerSound(key, bytes));
      } catch { return false; }
    })());
  }
  return /** @type {Promise<boolean>} */ (m.get(key));
}
/** Play a clip where something stands - now if it is loaded, when it lands if that is soon. */
export function playStorefrontSound(/** @type {any} */ audio, /** @type {string} */ key, /** @type {number[]} */ at, volume = 1, opts = {}) {
  if (!audio?.play3d || !key) return;
  const asked = performance.now();
  if (audio.buffers?.get?.(key)) { try { audio.play3d(key, at, volume, opts); } catch { /* silent */ } return; }
  loadStorefrontSound(audio, key).then((ok) => { if (ok && performance.now() - asked <= STOREFRONT_SFX_LATE_MS) { try { audio.play3d(key, at, volume, opts); } catch { /* silent */ } } });
}
