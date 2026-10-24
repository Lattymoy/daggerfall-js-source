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
const { walkSpeed } = await import('../../../src/player/motor.js');

export const DT = 1 / 60;
const tick = () => new Promise((res) => setTimeout(res, 5));

/** A rig wearing `right`/`left`, Pellets in the pack, drawn. Answers { r, frame, audio, entity, uploads, glows } - `glows` each
 *  frame's element outlines (WEAPON-GLOW1's door: the texture it is drawn over and the look). MIXED-PAIR / SPELL-HAND: `cif`
 *  the bytes a CIF read is served, or a function of its name (a blade's art beside the gun, a spell's hands - none by
 *  default), and the rig's magic doors (`spellArmed`, `readiedSpell`, `abortSpell`) when a pin readies a spell. */
export async function pistolRig({ right = null, left = null, leftHanded = false, warm = 60, widget = {}, size = [320, 200], dts = null, cif = null, spellArmed = null, readiedSpell = null, abortSpell = null, pellets = 60 } = {}) {
  resetToDefaults(); _resetModSettings();
  setModSetting('weapon-widget', 'Enabled', false);
  for (const [k, v] of Object.entries(widget)) setModSetting('weapon-widget', k, v);   // a module switch the test needs still
  if (leftHanded) setValue('Controls', 'Handedness', 1);
  const quads = [], uploads = [], glows = [];
  // PISTOL-PORT: the camera the host hands the rig, walking when a pin says; AUDIT PISTOL-PORT B1: strafing (-1 left, 1
  // right) and in the air (`vertical` the eye's climb, null on the ground) too
  const eye = [0, 1.7, 0], walk = { on: false, strafe: 0, vertical: null, climbing: false };
  const events = [];   // AUDIT PISTOL-PORT: the events the rig handed its host on the last frame
  const renderer = {
    uploadTexture: (_k, name) => { uploads.push(name); return name; },
    drawScreenQuad: (tex, rect, uv, tint) => quads.push({ tex, rect: { ...rect }, uv, tint }),
    drawScreenQuadGlow: (tex, rect, uv, spec) => glows.push({ tex, look: spec?.look ?? null, level: spec?.level ?? null }),
    setScreenOffset: () => {},
    flatLightAt: () => [0.3, 0.3, 0.3],   // a room's flat light (MAC-I), so a flash has a tint to lift - unlit, every quad's tint is null and no flash can be told
  };
  const canvas = { width: size[0], height: size[1], clientWidth: size[0], clientHeight: size[1] };   // PISTOL-PORT: a real screen's size too
  const audio = { played: [], playOneShot(k) { audio.played.push(String(k)); }, registerSound: async () => true };
  const entity = {
    items: pellets > 0 ? [createPellets(pellets)] : [], lightSource: null, equipCountdown: 0,
    equip: { slots: { [EQUIP_SLOTS.RightHand]: right, [EQUIP_SLOTS.LeftHand]: left } },
    stats: { speed: 50, strength: 50, agility: 50 },
  };
  const r = createWeaponRig({ renderer, canvas, entity, audio, palette: { get: () => ({ r: 0, g: 0, b: 0 }) }, say: () => {},
    fetchBytes: async (name) => { const bytes = typeof cif === 'function' ? cif(name) : cif; if (bytes) return bytes; throw new Error('no CIF in this harness'); },
    ...(spellArmed ? { spellArmed } : {}), ...(readiedSpell ? { readiedSpell } : {}), ...(abortSpell ? { abortSpell } : {}),
    // AUDIT PISTOL-PORT B8: the motion bag the hosts hand the rig (player/motor.js motionBagOf) - PlayerMotor.Speed as
    // `speedField`, never a ratio or a base of the harness's own, so a pin runs the rig's own path from it
    camera: () => ({ pos: [...eye], yaw: 0, pitch: 0, climbing: !!walk.climbing,   // AUDIT SPELL-HAND L4-5: `walk.climbing` puts the hands on a wall
      move: { grounded: walk.vertical === null, running: false, crouching: false, standing: !walk.on && !walk.strafe && walk.vertical === null, speedField: walkSpeed(50) } }) });
  r.toggleSheath();   // drawn
  // PISTOL-PORT: a frame of `dt` (a browser's own, when a pin replays one), the eye carried forward at the walk's speed
  const frame = async (dt = DT, held = false) => {   // AUDIT PISTOL-PORT: `held` the attack button, for a pin that holds it
    if (walk.on) eye[2] += walkSpeed(50) * dt;
    if (walk.strafe) eye[0] += walk.strafe * walkSpeed(50) * dt;
    if (walk.vertical !== null) eye[1] += walk.vertical * dt;
    r.attackInput(0, 0, held);
    quads.length = 0; glows.length = 0;
    events.length = 0; events.push(...(r.frame(dt) ?? [])); r.draw();
    await tick();
    return quads.slice();
  };
  for (const dt of dts ?? Array(warm).fill(DT)) await frame(dt);
  return { r, frame, audio, entity, uploads, canvas, glows, walk, events };
}
