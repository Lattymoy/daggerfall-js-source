// Vendored from project-final's Rewrite Engine (rewrite/rig/muzzleFlash.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json
// (captured from rewrite/rig at vendor time). Do not hand-diverge:
// upstream first, then re-vendor + re-capture.
import { box } from './geometry.js';

// Muzzle-flash geometry (Toolkit-Arc S4b-i micro-carve): the flash config + face builder are base rig
// FX with zero content coupling - Voxlight's body.js re-exports them so consumers never moved.
export const FLASH_DEF = { core: [255, 255, 255], mid: [120, 226, 255], edge: [50, 150, 255], flareLen: 3, flareThick: 0.22, nearW: 0.82, farW: 1.04, z0: 0.6, z1: 1.4, z2: 2.7, coreR: 0.58, scale: 1.0 };
export const WEAPON_FLASH = { // keyed by activeWeaponId() (first person) / FLASH_TYPE_KEY (third person)
  warden: { ...FLASH_DEF }, tempest: { ...FLASH_DEF }, talon: { ...FLASH_DEF }, rampart: { ...FLASH_DEF }, verdict: { ...FLASH_DEF }, sunder: { ...FLASH_DEF },
};
const FLASH_TYPE_KEY = { rifle: 'warden', pistol: 'talon', lmg: 'rampart', sar: 'verdict', launcher: 'sunder' }; // third person knows only the weapon TYPE (no variant) -> Warden stands in for the rifle cone

// energy firing cone at the muzzle, scaled by intensity. cfg = a WEAPON_FLASH entry (colours + cone geometry).
export function muzzleFlashFaces(tip, k, cfg = FLASH_DEF) {
  const c = cfg, out = [], s = 0.16 * k * (c.scale ?? 1), [mx, my, mz] = tip;
  box(out, mx - s * c.flareLen, mx + s * c.flareLen, my - s * c.flareThick, my + s * c.flareThick, mz - s * 0.12, mz + s * 0.12, c.mid); // horizontal flare
  box(out, mx - s * c.flareThick, mx + s * c.flareThick, my - s * c.flareLen, my + s * c.flareLen, mz - s * 0.12, mz + s * 0.12, c.mid); // vertical flare
  box(out, mx - s * c.nearW, mx + s * c.nearW, my - s * c.nearW, my + s * c.nearW, mz + s * c.z0, mz + s * c.z1, c.mid); // near cone segment
  box(out, mx - s * c.farW, mx + s * c.farW, my - s * c.farW, my + s * c.farW, mz + s * c.z1, mz + s * c.z2, c.edge); // far cone segment (flares forward)
  box(out, mx - s * c.coreR, mx + s * c.coreR, my - s * c.coreR, my + s * c.coreR, mz - s * 0.18, mz + s * 0.5, c.core); // hot white core
  return out;
}
