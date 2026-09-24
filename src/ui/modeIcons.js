// HUD-ICON1 (2026-09-24, Mac: "the classic interaction (grab, info etc) ui element is missing the sprite and is just
// large text") - DFU'S INTERACTION-MODE ICONS, THE PICTURES THEMSELVES.
//
// U38 drew the mode's NAME in the HUD font: HUDInteractionModeIcon loads its four pictures out of Unity's
// Resources folder (Assets/Resources/Icons/, DaggerfallUI.GetTextureFromResources), which is DFU-authored art and was
// absent from the sparse clone. It is MIT, the licence of the C# this port translates, so it is vendored now, byte for
// byte, under public/art/dfu-icons/ with its listing (vendor/dfu-icons/dfu-icons.files.json, the doctrine gate's
// authority). The word stays only as the arm a picture that did not load falls back to - a missing file must never
// cost the player the indicator.
//
// LoadAssets (:136-190): the STYLE picks one of four sets - "classic"/"classicxhair" the classic set, "monochrome" the
// mono set, "colour"/"colourxhair" the colour set, anything else (the default "icon", "minimal") the icon set - and the
// size is each picture's OWN (the `out size` of GetTextureFromResources), which is why the loader answers w and h.
// GetTextureFromResources samples with the GUI filter, Point by default (GUIFilterMode 0): NEAREST, and a string-keyed
// upload carries no mip chain (renderer.js uploadTexture) - UI art's single level, as ImageReader's is.
import { APP_ROOT } from '../systems/appRoot.js';

/** LoadAssets' switch: the setting's word -> the file-name prefix of its set. */
export function modeIconSet(style) {
  const s = String(style ?? '').toLowerCase();
  if (s === 'classic' || s === 'classicxhair') return 'classic';
  if (s === 'monochrome') return 'mono';
  if (s === 'colour' || s === 'colourxhair') return 'colour';
  return 'icon';
}
/** The port's mode names -> DFU's file suffixes (PlayerActivateModes; the port's 'dialogue' is DFU's Talk). */
export const MODE_ICON_SUFFIX = Object.freeze({ steal: 'steal', grab: 'grab', info: 'info', dialogue: 'talk' });

/** The served URL of one icon file (`classic-grab.png`). */
export const modeIconUrl = (file, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`art/dfu-icons/${file}`, root).href;

let _fetch = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};
let _decode = null;   // test seam: bytes -> { width, height, data }

const _byRenderer = new WeakMap();   // renderer -> Map<file, { state: 'loading'|'ready'|'failed', icon }>

function load(renderer, cache, file) {
  const slot = { state: 'loading', icon: null };
  cache.set(file, slot);
  (async () => {
    const { toScreenOrder } = await import('../formats/color32Order.js');
    const decode = _decode ?? (await import('../systems/textureReplacement.js')).decodePng;
    const px = toScreenOrder(await decode(await _fetch(modeIconUrl(file))));
    slot.icon = { tex: renderer.uploadTexture('dfu-icon', file, px, { alpha: true }), w: px.width, h: px.height };
    slot.state = 'ready';
  })().catch((e) => { slot.state = 'failed'; console.warn(`[hud] ${file} did not load - the mode's name stands in:`, e?.message ?? e); });
  return slot;
}

/** The picture for `mode` under `style` - `{ tex, w, h }` - or null while it loads (or if it failed). The first ask
 *  loads the style's whole SET, as LoadAssets loads all four at once, so switching modes never waits on a file; the
 *  HUD asks every frame, so a picture appears the frame after it arrives. */
export function modeIcon(renderer, style, mode) {
  const suffix = MODE_ICON_SUFFIX[mode];
  if (!suffix || typeof renderer?.uploadTexture !== 'function') return null;
  const set = modeIconSet(style);
  let cache = _byRenderer.get(renderer);
  if (!cache) _byRenderer.set(renderer, (cache = new Map()));
  if (!cache.has(`${set}-${suffix}.png`)) {
    for (const s of Object.values(MODE_ICON_SUFFIX)) if (!cache.has(`${set}-${s}.png`)) load(renderer, cache, `${set}-${s}.png`);
  }
  const slot = cache.get(`${set}-${suffix}.png`);
  return slot.state === 'ready' ? slot.icon : null;
}

export function _setModeIconSeamsForTests({ fetch: f = null, decode = null } = {}) {
  _decode = decode;
  _fetch = f ?? (async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
}
