// @ts-check
// SD9e (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE BRASS REMNANT'S SPOILS
// ON THE ARENA'S FLOOR - the court's burst (scenes/gateCourt.js burst) for the Last Moment. SD_SPEW_AT_MS into its fall
// (the fight as the page holds it - net/sdFightLink.js), this fighter's spoils (systems/sdSpoils.js, off the receipt the
// relay signed for them - net/sdReceipt.js `h1`) leave the cage of its chest toward them and come to rest on the arena's
// floor, never off its edge into the void (world/gateSpew.js keepLaunch, SD_SPOILS_KEEP); a fighter the realm counted in
// that has no receipt SD_RECEIPT_WAIT_MS into the fall is told so, once. The pool (scenes/spoilsPool.js, the Hour's own
// keys) keeps them as rolled until a save holds them, the press takes them, and leaving the Hour gathers whatever is
// still on the floor. A receipt that comes outside its realm is the host's to grant (scenes/world.js).
//
// SEEN BY THIS PLAYER ALONE, as the court's are: every fighter's spoils are their own seed's, on their own screen.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ARENA, realmToDungeon } from '../net/sdBrain.js';
import { SD_REM } from '../net/sdRemnant.js';
import { readSdReceipt } from '../net/sdReceipt.js';
import { remnantPose } from './sdRemnant.js';
import { spoilsLevel } from './spoilsPool.js';
import { sdSpoilsDay, sdSpoilsList, SD_SPOILS_TEXT } from '../systems/sdSpoils.js';

/** Its spoils leave it this long into its fall - its body still sinking, the cage of its chest above the floor
 *  (scenes/sdRemnant.js SD_REM_SINK_MS is the whole sink); a receipt not come this long after it never will. */
export const SD_SPEW_AT_MS = 1200;
export const SD_RECEIPT_WAIT_MS = 4000;
/** Where in its height they leave it (the cage about its heart), and never lower than this over the floor. */
export const SD_SPEW_CHEST = 0.55;
export const SD_SPEW_LOW_M = 1;
/** They come to rest this far inside the arena's edge at most - never off it into the void. */
export const SD_SPEW_RIM_M = 2;
/** The floor they are kept to (world/gateSpew.js keepLaunch's `{ centre, r, floorY }`): the arena's, in the dungeon's
 *  frame. */
export const SD_SPOILS_KEEP = Object.freeze({ centre: Object.freeze(realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z)), r: SD_ARENA.r - SD_SPEW_RIM_M, floorY: realmToDungeon(0, 0, 0)[1] });

/**
 * The burst's driver. `link` the fight's (net/sdFightLink.js - its `state`, `now` and `counted`), `pool` the Hour's spoils
 * pool, `slot()` the realm I stand in (null out of it), `receipt(slot)` my receipt for it as the relay handed it (null for
 * none yet), `level()` mine, `feet()` my feet in the dungeon's frame, `say(text)` a line.
 * @param {{ link: any, pool: any, slot: () => (number|null), receipt: (slot: number) => (string|null), level: () => number,
 *   feet?: () => (number[]|null), say?: (text: string) => void }} deps
 */
export function createSdSpoils({ link, pool, slot, receipt, level, feet = () => null, say = () => {} }) {
  /** the fight whose spoils have left it on this screen, and the one told it had none - each once a fight */
  let spewedFi = 0, saidFi = 0;
  return {
    /** One frame in the Hour: the burst, when it is due and the receipt is here; then the pool's pieces flying. */
    frame() {
      const s = link?.state?.(), t = link?.now?.() ?? 0, here = slot();
      if (s?.fell && here != null && spewedFi !== s.fi && t >= s.fell.at + SD_SPEW_AT_MS) {
        const r = receipt(here), c = r ? readSdReceipt(r) : null;
        if (c && c.d === here) {
          spewedFi = s.fi;
          const pose = remnantPose(s, s.fell.at + SD_SPEW_AT_MS);
          const at = realmToDungeon(SD_ARENA.x + pose.x, Math.max(SD_SPEW_LOW_M, SD_REM.h * SD_SPEW_CHEST - pose.sink), SD_ARENA.z + pose.z);
          const f = feet();
          const bearing = f ? Math.atan2(f[0] - at[0], f[2] - at[2]) : pose.yw;
          const lv = spoilsLevel(level(), c.l);   // AUDIT WBX S2: never past the level the fight admitted
          if (pool.spew({ day: sdSpoilsDay(c.d), seed: c.c, level: lv, at, bearing, acct: c.s, keep: SD_SPOILS_KEEP, roll: () => sdSpoilsList(c.c, lv) })) say(SD_SPOILS_TEXT.spilled);
        } else if (saidFi !== s.fi && t >= s.fell.at + SD_RECEIPT_WAIT_MS && link.counted?.()) {
          saidFi = s.fi;
          say(SD_SPOILS_TEXT.none);
        }
      }
      pool.frame();
    },
    /** Out of the Hour: whatever is still on the floor goes into the pack (the record stands until a save holds it). */
    leave() {
      spewedFi = 0; saidFi = 0;
      return pool.gather();
    },
    /** What the driver holds, for the tests. */
    state: () => ({ spewedFi, saidFi }),
  };
}
