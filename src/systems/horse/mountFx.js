// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 7): A MOUNT LOOK IN THE WORLD - the beat each horse in
// a look throws (render/killFx.js 'mount-*': a hoof's smoke, print or sparks, a mane of fire or light) through the
// running host's magic engine (systems/playerDoor.js `burst`), in the horses' own pool, which never takes a kill effect's
// place (render/killFx.js KFX_POOL_OF). A beat a stride while it moves, a slow one while it stands. My horse is stepped
// by the mount rig (player/mountRig.js), a peer's by the peers' effects (net/peer/peerFx.js). Not a DFU member.
import { playerDoor } from '../playerDoor.js';

/** The beat (s): standing, walking, running. */
export const MOUNT_FX_BEAT_S = Object.freeze([0.9, 0.34, 0.2]);
/** A horse's measure for its beat (m): its height to the crest and its length nose to rump - a sprite's and the 3D's. */
export const MOUNT_FX_SIZE = Object.freeze({ h: 1.7, w: 2.1 });

/** The horses' beats, by rider id. `door` the magic engine's (tests hand their own). */
export function createMountFx({ door = playerDoor } = {}) {
  /** @type {Map<string, { t: number, seen: boolean }>} */
  const clocks = new Map();
  return {
    /** One horse this frame: `look` its mount look (or none: nothing, its clock let go), `feet` its hooves' ground (the
     *  scene's), `yaw` its facing (forward is [sin, cos]), `pace` 0 standing, 1 walking, 2 running, `mane` whether its
     *  head is seen (never from its own saddle in first person). Answers whether a beat was thrown. */
    step(
      /** @type {string} */ id,
      /** @type {string|null} */ look,
      /** @type {number[]|null} */ feet,
      /** @type {number} */ yaw,
      /** @type {number} */ pace,
      /** @type {number} */ dt,
      { mane = true } = {},
    ) {
      if (!look || !feet || !feet.every?.(Number.isFinite)) {
        clocks.delete(id);
        return false;
      }
      let c = clocks.get(id);
      if (!c) {
        c = { t: 0, seen: true };
        clocks.set(id, c);
      }
      c.seen = true;
      c.t += Math.max(0, Number.isFinite(dt) ? dt : 0);
      const p = pace === 2 ? 2 : pace ? 1 : 0,
        beat = MOUNT_FX_BEAT_S[p];
      if (c.t + 1e-9 < beat) return false;
      c.t = Math.min(c.t - beat, beat); // the remainder carried, so the beat keeps its time - never a burst of them after a long frame
      const y = Number.isFinite(yaw) ? yaw : 0;
      try {
        return !!door()?.burst?.(`mount-${look}`, feet, {
          ...MOUNT_FX_SIZE,
          dir: [Math.sin(y), Math.cos(y)],
          pace: p,
          mane,
        });
      } catch {
        return false;
      }
    },
    /** The riders not stepped since the last sweep let go - once a frame, after every horse. */
    sweep() {
      for (const [id, c] of clocks) {
        if (!c.seen) clocks.delete(id);
        else c.seen = false;
      }
    },
    /** How many horses it keeps a beat for (tests). */
    get size() {
      return clocks.size;
    },
  };
}
