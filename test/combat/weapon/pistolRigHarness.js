// AUDIT PISTOLET (bible/01-Overview/audits/Audit-Pistolet.md): THE REAL RIG IN NODE, for the Pistolet's pins - createWeaponRig
// with a stub renderer that records every screen quad and every sound, the strip served off public/ through the browser
// shapes loadPistoletArt reaches (fetch, createImageBitmap, OffscreenCanvas). From the audit's lane B harness. Not a test
// file itself: test/combat/weapon/pistoletRig.test.js imports it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPng } from '../../../tools/pngIO.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const m = String(url).match(/\/(art\/[^?#]+)$/);
  if (m) {
    const bytes = readFileSync(`${ROOT}public/${m[1]}`);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }
  return realFetch ? realFetch(url) : { ok: false, status: 404 };
};
globalThis.createImageBitmap = async (blob) => {
  const img = readPng(new Uint8Array(await blob.arrayBuffer()));
  return { width: img.width, height: img.height, _img: img, close() {} };
};
globalThis.OffscreenCanvas = class {
  constructor(w, h) { this.width = w; this.height = h; this._img = null; }
  getContext() {
    return {
      drawImage: (bmp) => { this._img = bmp._img; },
      getImageData: () => ({ width: this._img.width, height: this._img.height, data: new Uint8ClampedArray(this._img.data) }),
    };
  }
};

const { createWeaponRig } = await import('../../../src/combat/weapon/weaponRig.js');
const { EQUIP_SLOTS } = await import('../../../src/systems/equip.js');
const { createPellets } = await import('../../../src/systems/thunderlock.js');
const { resetToDefaults, setValue } = await import('../../../src/systems/settings/settings.js');
const { _resetModSettings, setModSetting } = await import('../../../src/systems/modSettings.js');

export const DT = 1 / 60;
const tick = () => new Promise((res) => setTimeout(res, 5));

/** A rig wearing `right`/`left`, Pellets in the pack, drawn. Answers { r, frame, audio, entity, uploads, glows } - `glows` each
 *  frame's element outlines (WEAPON-GLOW1's door: the texture it is drawn over and the look). */
export async function pistolRig({ right = null, left = null, leftHanded = false, warm = 60, widget = {} } = {}) {
  resetToDefaults(); _resetModSettings();
  setModSetting('weapon-widget', 'Enabled', false);
  for (const [k, v] of Object.entries(widget)) setModSetting('weapon-widget', k, v);   // a module switch the test needs still
  if (leftHanded) setValue('Controls', 'Handedness', 1);
  const quads = [], uploads = [], glows = [];
  const renderer = {
    uploadTexture: (_k, name) => { uploads.push(name); return name; },
    drawScreenQuad: (tex, rect, uv, tint) => quads.push({ tex, rect: { ...rect }, uv, tint }),
    drawScreenQuadGlow: (tex, rect, uv, spec) => glows.push({ tex, look: spec?.look ?? null, level: spec?.level ?? null }),
    setScreenOffset: () => {},
    flatLightAt: () => [0.3, 0.3, 0.3],   // a room's flat light (MAC-I), so a flash has a tint to lift - unlit, every quad's tint is null and no flash can be told
  };
  const canvas = { width: 320, height: 200, clientWidth: 320, clientHeight: 200 };
  const audio = { played: [], playOneShot(k) { audio.played.push(String(k)); }, registerSound: async () => true };
  const entity = {
    items: [createPellets(60)], lightSource: null, equipCountdown: 0,
    equip: { slots: { [EQUIP_SLOTS.RightHand]: right, [EQUIP_SLOTS.LeftHand]: left } },
    stats: { speed: 50, strength: 50, agility: 50 },
  };
  const r = createWeaponRig({ renderer, canvas, entity, audio, palette: { get: () => ({ r: 0, g: 0, b: 0 }) }, say: () => {},
    fetchBytes: async () => { throw new Error('no CIF in this harness'); },
    camera: () => ({ pos: [0, 1.7, 0], yaw: 0, pitch: 0, climbing: false, move: { grounded: true, running: false, standing: true } }) });
  r.toggleSheath();   // drawn
  const frame = async () => {
    r.attackInput(0, 0, false);
    quads.length = 0; glows.length = 0;
    r.frame(DT); r.draw();
    await tick();
    return quads.slice();
  };
  for (let i = 0; i < warm; i++) await frame();
  return { r, frame, audio, entity, uploads, canvas, glows };
}
