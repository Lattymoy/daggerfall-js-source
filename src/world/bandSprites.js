// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-FOES - THE BANDS, SEEN (bible/06-Systems/Travel-View.md).
//
// The player's ask (2026-09-29): "when you go near the encounters let the sprites slowly show up the same the players
// sprite is on the map". A roaming band (systems/travel/travelBands.js) was a dot and a label on the Overworld; near enough,
// it now stands as its lead monster - the enemy's own animated, eight-way sprite (characters/mobile/mobileUnit.js, the same
// MobileUnit a monster-skinned player wears, net/remotePlayers.js) - grown as the traveller's own sprite is
// (player/travelCamera.js tvOwnGrow: a party's icon from the Overworld's height), and faded in:
//   - by distance: nothing past BAND_SPRITE_FAR_M, whole inside BAND_SPRITE_NEAR_M, smoothstepped between,
//   - and by time: the opacity eases toward that at BAND_SPRITE_FADE_RATE, so a band never pops in - it comes out of
//     the land as the traveller nears it,
//   - and by the view's own blend (it rises and falls with the camera).
// Only under the Overworld: on the ground the band is the real foes it stands as (world.js bandStand).
// Pointer-free and outside the overlay stack, as every mark of the view.
// ═══════════════════════════════════════════════════════════════════
import { MobileUnit } from '../characters/mobile/mobileUnit.js';
import { ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';
import { setupFoeLook } from '../characters/enemy/foeLook.js';   // AUDIT DEX B6: SetupDemoEnemy.cs:129-151, the mobile's renderer
import { mobileBillboardSize } from './rmbFlats.js';

/** Past this (m) a band is only its mark. */
export const BAND_SPRITE_FAR_M = 420;
/** Inside this (m) its sprite stands whole. */
export const BAND_SPRITE_NEAR_M = 240;
/** How fast its opacity follows the distance's (per second) - about a second and a half to come in whole. */
export const BAND_SPRITE_FADE_RATE = 1.4;
/** Below this opacity nothing is drawn. */
const ALPHA_MIN = 0.02;
/** The renderer's blended pass, plain (render/renderer.js uConceal: any mode but 1, 2, 4, 5 is opacity alone). */
const PLAIN_BLEND_MODE = 3;

/** The distance's share of the sprite, 0..1 (smoothstepped between the far and the near). */
export function bandSpriteReach(distM) {
  if (!Number.isFinite(distM)) return 0;
  const x = (BAND_SPRITE_FAR_M - distM) / (BAND_SPRITE_FAR_M - BAND_SPRITE_NEAR_M);
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

/** One step of the eased opacity toward `target`. */
export function stepBandAlpha(alpha, target, dt) {
  const k = 1 - Math.exp(-BAND_SPRITE_FADE_RATE * Math.max(0, dt) * 2);
  const a = alpha + (target - alpha) * k;
  return Math.abs(a - target) < 0.004 ? target : a;
}

/**
 * @param {{ renderer: any, getTexture: (archive: number) => Promise<any>, uploadRecordFrame: (archive: number, record: number, frame: number) => void }} deps
 */
export function createBandSprites({ renderer, getTexture, uploadRecordFrame }) {
  /** mobileType -> { tex, archive } | null (failed) | Promise */
  const looks = new Map();
  /** band id -> its drawn state */
  const units = new Map();
  const drawn = [];

  function lookOf(mobileType) {
    if (looks.has(mobileType)) return looks.get(mobileType);
    const basics = ENEMY_BASICS[mobileType];
    if (!basics?.maleTexture || !getTexture) { looks.set(mobileType, null); return null; }
    const archive = basics.maleTexture;
    const p = Promise.resolve(getTexture(archive))
      .then((tex) => { looks.set(mobileType, tex ? { tex, archive, basics } : null); })
      .catch(() => { looks.set(mobileType, null); });
    looks.set(mobileType, p);
    return p;
  }

  function drop(id) {
    const r = units.get(id);
    if (r?.batch) renderer?.destroyBillboardBatch?.(r.batch);
    units.delete(id);
  }

  /**
   * One frame. `bands`: [{ id, mobileType, feet: [x,y,z] (scene), distM }]. `eye` the frame's eye, `grow` the
   * traveller's own (the sprite's size times it), `fade` the view's blend 0..1.
   * @param {Array<{id: string, mobileType: number, feet: number[], distM: number}>} bands
   * @param {{ dt?: number, eye?: number[]|Float32Array|null, grow?: number, fade?: number }} [o]
   */
  function sync(bands, { dt = 0, eye = null, grow = 1, fade = 1 } = {}) {
    drawn.length = 0;
    const seen = new Set();
    for (const b of bands ?? []) {
      if (!b?.feet || !Number.isInteger(b.mobileType)) continue;
      const look = lookOf(b.mobileType);
      if (!look || typeof look.then === 'function') continue;   // loading, or no art for this kind: its mark stands alone
      seen.add(b.id);
      let r = units.get(b.id);
      if (!r || r.mobileType !== b.mobileType) {
        if (r) drop(b.id);
        r = { mobileType: b.mobileType, unit: new MobileUnit(b.mobileType, look.basics, (rec) => look.tex.getFrameCount(rec), Math.random, 'male'),
          look, batch: null, alpha: 0, yaw: 0, last: null };
        units.set(b.id, r);
      }
      // its heading off its own walk (a band has no facing but where it goes)
      const f = b.feet;
      if (r.last) {
        const dx = f[0] - r.last[0], dz = f[2] - r.last[2];
        if (dx * dx + dz * dz > 1e-4) r.yaw = Math.atan2(dx, dz);
      }
      r.last = [f[0], f[1], f[2]];
      r.alpha = stepBandAlpha(r.alpha, bandSpriteReach(b.distM) * Math.max(0, Math.min(1, fade)), dt);
      if (r.alpha < ALPHA_MIN) continue;
      const out = r.unit.update(dt, { moving: true }, r.yaw, f, eye && eye.length === 3 ? eye : f);
      const { tex, archive } = r.look;
      const rkey = `${out.record}#${out.frame}`;
      if (!renderer?.textures?.has?.(`${archive}_${rkey}`)) uploadRecordFrame?.(archive, out.record, out.frame);
      const sz = mobileBillboardSize(tex, out.record);
      const g = Math.max(1, grow || 1);
      const size = { w: (out.flip ? -sz.w : sz.w) * g, h: sz.h * g };
      if (!r.batch) {
        // AUDIT DEX B6: dressed as SetupDemoEnemy dresses a mobile, as the hosts' foes are - a Spectral row's band (the
        // mod's Will-o'-wisp and Faded Ghost) its ghost, a NoShadow row's (the vampires) casting none; the band stood opaque
        r.batch = setupFoeLook(renderer?.createBillboardBatch?.(archive, rkey, size, [[0, 0, 0]]) ?? null, b.mobileType);
        if (!r.batch) continue;
        r.batch.origin = [0, 0, 0];
      } else {
        r.batch.record = rkey;
        r.batch.size = size;
      }
      r.batch.origin[0] = f[0]; r.batch.origin[1] = f[1]; r.batch.origin[2] = f[2];
      r.batch.conceal = r.alpha >= 0.99 ? null : { mode: PLAIN_BLEND_MODE, alpha: r.alpha, t: 0, phase: 0 };
      drawn.push(r.batch);
    }
    for (const id of [...units.keys()]) if (!seen.has(id)) drop(id);
  }

  return {
    sync,
    /** This frame's drawn sprites, for the exterior's billboard pass. */
    batches: () => drawn,
    /** The view went down, or the host is torn down: every sprite freed. */
    clear() { for (const id of [...units.keys()]) drop(id); drawn.length = 0; },
    get size() { return units.size; },
  };
}
