// @ts-check
// STAND-HORSE (2026-10-12, the owner: "Some models arent affected when morrowind is attached, like static NPCs, static
// horses, etc" - bible/04-Characters/Morrowind-NPCs.md section 28): THE HORSES THAT STAND. COATS3D put every horse
// the Morrowind lane MOVES in the 3D horse (world/horseRig.js) - the rider's, the peers', Horse Cart and Cargo's pool,
// the road's teams - and left the ones that only stand as sprites: Daggerfall's own town horses (TEXTURE.201's two
// horse records, an RMB block's or a World of Daggerfall site's flats) and the Stable's three. Each now stands as the
// 3D horse at its billboard's base, idling, its billboard drawing nothing while it does (`castOnly`, MWNPC16's law -
// the pool's 3D horse draws no billboard either).
//
//  - ONE MANAGER A HOST (`createStandingHorses`): a frame `begin`s with the lane's rig (player/mwView.js
//    mwViewHorseRig - null off the lane), the host `offer`s each standing horse it walks (a key object of its own, the
//    feet, the heading, the look, the billboard), and `end` stands the nearest STANDING_HORSES_MAX within
//    STANDING_HORSE_RANGE - one already standing held by STANDING_HORSE_HOLD, so a horse on the cut's edge does not
//    stand and fall frame by frame - posing only the ones in the view; `draw` draws them
//    in a character-sprite bind of their own (MWNPC2's one pass, as a population lane's draw opens its own). A horse no longer offered, out of the cut or under a new rig is let
//    go through the rig that made it (AUDIT COATS3D A7) and its billboard drawn again.
//  - HORSE-VIEW II (2026-10-21, bible/07-Rendering/Performance-Priority.md): POSED AS THE POOL'S ARE (world/horseView.js
//    poseWhereSeen). Every horse standing steps its idle's clock every frame; its pose is written and sent in the view
//    alone (`end`'s camera, the one the frame draws through - the draw's own test, horseRig.js seen), on the peers'
//    bodies' cadence by how far it looks from that camera (its eye `begin` names, over its lens). A horse that comes
//    into the view is caught up by the draw (`fresh`), so it shows the very pose an every-frame horse shows. Before, the
//    ones in the view were posed every frame at any range, and one out of it stood still on its clock - turned back
//    into the view, it took up its idle where it had left it.
//  - THE HORSE IS STILL: speed 0, the bake's idle at a phase of its own (its seed); its heading its own, off its key
//    (`standingHorseYaw` - a billboard has none, and a town of horses all facing one way reads as a sprite's lie).
//
// Not a DFU member: Daggerfall's horse is a sprite. Ledger A (COATS3D).
import { poseWhereSeen } from './horseView.js';   // HORSE-VIEW II: the pool's law
import { lensOf } from '../net/peer/peerBodies.js';
import { ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD, SOUND } from '../systems/soundClips.js';

/** The most standing horses a host stands in 3D at once, nearest first (a town's square holds a handful). */
export const STANDING_HORSES_MAX = 8;
/** How far from the eye a standing horse stands in 3D, metres - past it, Daggerfall's sprite. */
export const STANDING_HORSE_RANGE = 60;
/** A horse already standing keeps its place this much past the cut (npcBodies.js NPC_BUDGET_HYSTERESIS's law). */
export const STANDING_HORSE_HOLD = 1.15;

/** Is this flat one of Daggerfall's town horses - TEXTURE.201 by the records RMBLayout's animal sound names a horse
 *  (AddAnimalAudioSource's table, soundClips.js ANIMAL_SOUND_BY_RECORD)? */
export const isStandingHorseFlat = (archive, record) => archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[record] === SOUND.AnimalHorse;

/** FNV-1a over a key's text, as an unsigned 32-bit number. */
function hashOf(key) {
  let h = 0x811c9dc5;
  const s = String(key ?? '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** A standing horse's heading (radians, the motor's yaw: 0 down +Z) off its key - the same on every machine and every
 *  build of its pixel. */
export const standingHorseYaw = (key) => ((hashOf(key) % 3600) / 3600) * 2 * Math.PI;
/** A standing horse's idle phase seed (horseRig.js `horse(seed)`), off its key. */
export const standingHorseSeed = (key) => 1 + (hashOf(`seed:${key}`) % 65535);

/**
 * @param {{ renderer?: any, max?: number, range?: number }} [opts] - `renderer` the host's (its character-sprite bind)
 */
export function createStandingHorses({ renderer = null, max = STANDING_HORSES_MAX, range = STANDING_HORSE_RANGE } = {}) {
  /** @type {Map<any, { horse: any, rig: any, batch: any, frame: number, phase: number, out: boolean, fresh: boolean }>} */
  const stood = new Map();
  /** This frame's offers (pooled - no object a horse a frame). */
  /** @type {{ key: any, feet: number[], yaw: number, look: number, batch: any, seed: number, d2: number }[]} */
  const offers = [];
  /** The offers sorted, reused. */
  /** @type {typeof offers} */
  const live = [];
  let n = 0, rig = null, frameNo = 0, phases = 0;
  const eye = [0, 0, 0];
  /** HORSE-VIEW II: `end`'s camera as the law reads it (its view, its eye - `begin`'s - and its lens). */
  const pass = { view: null, proj: null, eye, lens: 1 };
  function letGo(key, e) {
    e.rig?.release(e.horse);
    if (e.batch) e.batch.castOnly = false;
    stood.delete(key);
  }
  return {
    /** A frame begins under the lane's rig (null: off the lane) and from the eye. A new rig lets every horse go. */
    begin(r, eyeAt) {
      frameNo++;
      n = 0;
      if (eyeAt) { eye[0] = eyeAt[0]; eye[1] = eyeAt[1]; eye[2] = eyeAt[2]; }
      if (r !== rig) { for (const [k, e] of stood) letGo(k, e); rig = r ?? null; }
    },
    /** One standing horse: `key` an object (or text) of its host's that is the horse, `feet` its billboard's base,
     *  `yaw` its heading, `look` its look's code (systems/horse/horseCoats.js), `batch` the billboard it stands for, `seed` its
     *  idle phase. */
    offer(key, feet, yaw, look, batch, seed = 1) {
      const o = offers[n] ??= { key: null, feet: [0, 0, 0], yaw: 0, look: 0, batch: null, seed: 1, d2: 0 };
      n++;
      o.key = key; o.feet[0] = feet[0]; o.feet[1] = feet[1]; o.feet[2] = feet[2]; o.yaw = yaw; o.look = look | 0; o.batch = batch ?? null; o.seed = seed;
      const dx = feet[0] - eye[0], dy = feet[1] - eye[1], dz = feet[2] - eye[2];
      o.d2 = (dx * dx + dy * dy + dz * dz) / (stood.has(key) ? STANDING_HORSE_HOLD * STANDING_HORSE_HOLD : 1);
    },
    /** The cut made and the chosen stepped - HORSE-VIEW II: each posed in the view (`cam`'s, when given: the camera the
     *  frame draws through), on its cadence (world/horseView.js) - and the rest of the offered drawn as their
     *  billboards; a horse not offered this frame let go. Answers how many stand. */
    end(dt, cam = null) {
      if (cam) { pass.view = cam.view; pass.proj = cam.proj; pass.lens = lensOf(cam.proj); }
      live.length = 0;
      for (let i = 0; i < n; i++) live.push(offers[i]);
      for (let i = n; i < offers.length; i++) { offers[i].key = null; offers[i].batch = null; }   // no stale hold on a horse gone
      live.sort((a, b) => a.d2 - b.d2);
      let standing = 0;
      for (const o of live) {
        const want = !!rig && standing < max && o.d2 <= range * range;
        let e = stood.get(o.key);
        if (want && !e) {
          const horse = rig.horse(o.seed);
          if (horse) { e = { horse, rig, batch: o.batch, frame: 0, phase: phases++, out: false, fresh: false }; stood.set(o.key, e); }
        }
        if (!want || !e) { if (o.batch) o.batch.castOnly = false; continue; }
        if (e.batch && e.batch !== o.batch) e.batch.castOnly = false;   // a billboard rebuilt under the horse
        e.batch = o.batch; e.frame = frameNo;
        standing++;
        if (o.batch) o.batch.castOnly = true;
        rig.step(e.horse, { feet: o.feet, yaw: o.yaw, speed: 0, dt, look: o.look, pose: false });   // HORSE-VIEW II: its idle's clock every frame
        e.fresh = e.out;   // out of the view when last judged: the draw catches it up as it comes into this one
        e.out = poseWhereSeen(rig, e.horse, o.feet, cam ? pass : null, eye, frameNo, e.phase);
      }
      for (const [k, e] of stood) if (e.frame !== frameNo) letGo(k, e);   // a Map deletes the entry it is on safely
      return standing;
    },
    /** The horses standing this frame in the view (`end`'s), in a character-sprite bind of their own (none opened for
     *  none) - flushed whatever throws. HORSE-VIEW II: one come into the view since its last pose caught up first
     *  (`fresh`). Answers how many drew. */
    draw(canvas, { proj, view, eye: eyeAt, up = null }) {
      if (!rig) return 0;
      let drawn = 0, open = false;
      try {
        for (const e of stood.values()) {
          if (e.frame !== frameNo || e.out) continue;
          if (!open) { renderer?.beginCharacterSpriteBatch?.(); open = true; }
          if (rig.draw(e.horse, canvas, { proj, view, eye: eyeAt, up, fresh: e.fresh })) drawn++;
        }
      } finally { if (open) renderer?.flushCharacterSpriteBatch?.(); }
      return drawn;
    },
    /** Does this horse stand in 3D? */
    has(key) { return stood.has(key); },
    /** How many stand. */
    get size() { return stood.size; },
    /** Let every horse go (the street left, the host gone). */
    destroy() { for (const [k, e] of stood) letGo(k, e); n = 0; },
  };
}
