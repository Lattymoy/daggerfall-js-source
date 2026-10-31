// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 9): AN EFFECT'S SOUND WHERE IT IS TRIED ON - the
// profile's stage and the shop's carousel play a kill effect's or a portal skin's own clip (systems/storefrontSounds.js)
// at the Sound Volume setting, through one small context of their own: the windows stand before the world's bus does.
// A browser keeps a context shut until the page is touched, so the first sound waits for a press. Not a DFU member.
import { STOREFRONT_SFX, storefrontSfxUrl } from '../systems/storefrontSounds.js';
import { getFloat } from '../systems/settings/settings.js';

/** A tried-on effect's sound is this share of the Sound Volume - a window's, under the world's. */
export const PREVIEW_SOUND_SHARE = 0.55;
/** The clip a slot's effect plays, or null (a mount look, a portal with no skin). Pure. */
export const previewSoundKey = (/** @type {string|null} */ slot, /** @type {string|null} */ key) => {
  const k = slot === 'kill' && key ? `storefront:kill-${key}` : slot === 'portal' && key ? `storefront:portal-${key}` : null;
  return k && Object.hasOwn(STOREFRONT_SFX, k) ? k : null;
};

/** @type {AudioContext|null} */
let ctx = null;
/** @type {Map<string, Promise<AudioBuffer|null>>} */
const clips = new Map();
const contextNow = () => {
  if (ctx) return ctx;
  const C = /** @type {any} */ (globalThis).AudioContext ?? /** @type {any} */ (globalThis).webkitAudioContext;
  try { ctx = C ? new C() : null; } catch { ctx = null; }
  return ctx;
};
/** Play a slot's effect's sound once - quietly nothing where there is none, no context or no clip. */
export function playPreviewSound(/** @type {string|null} */ slot, /** @type {string|null} */ key) {
  const id = previewSoundKey(slot, key);
  const vol = getFloat('Controls', 'SoundVolume', 0, 1) * PREVIEW_SOUND_SHARE;
  if (!id || !(vol > 0)) return;
  const c = contextNow();
  if (!c || c.state === 'closed') return;
  if (c.state === 'suspended') c.resume?.().catch(() => {});
  if (!clips.has(id)) {
    const file = STOREFRONT_SFX[/** @type {keyof typeof STOREFRONT_SFX} */ (id)];
    clips.set(id, fetch(storefrontSfxUrl(file)).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).catch(() => null));
  }
  /** @type {Promise<AudioBuffer|null>} */ (clips.get(id)).then((buf) => {
    if (!buf || c.state !== 'running') return;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; g.gain.value = vol;
    src.connect(g).connect(c.destination);
    src.start();
  });
}
