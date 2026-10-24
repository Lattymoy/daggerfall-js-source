// @ts-check
// SEA-DECK (FIELD BUGS 2026-10-23, the owner after DECK-POSE: "Do the not fixed items" - "Other players also slide when on
// board your ship/npc ships"): THE SEA'S OWN SHIPS CARRY WHOEVER STANDS ON THEIR DECKS. A merchantman, a pirate or a packet
// under sail stands in the player's collider (navalHost.js collidable: her hull met, her deck stood on), and nothing moved
// a body with her: she sailed out from under it, her rail shoving it along, and on every other screen it stood a play-out
// behind her. The naval host poses her once a frame (poseShip: her root at her place and heading, her bob, heel and list on
// her MeshObject); this carries the one aboard by that pose's move - her DECK's (comeSailAwayAboard.js deckPose: her root
// carried by her bob, which her deck rolls and pitches with), the helm's own law for its child (carriedPoint, yawDelta), as
// Come Sail Away's riders are carried on another player's boat (CSA-K) - and says the place on every pose (DECK-POSE's
// `ab`, net/wire.js validAboard) under a key each client's copy of her answers to: her seed and her class (`~sea:<seed>:<
// class>`, the identity the naval word matches her by - navalHost.js applyWord bySeed), never a player's id. A reader
// stands the body on her deck as it will be drawn this frame (`ahead`: her root carried on by her way, the online frame
// running before the sea's).
//
//   createSeaDecks({ standsOn(boat, feet) -> bool, feet() -> [x, y, z], swimming() -> bool }) -> {
//     hold(entries)                    before the sea's frame poses its ships: each one's deck as it stands
//     frame(entries, me, rate)         after: the one aboard carried by her deck's move, then aboard or off; `me` the
//                                      host's deck door - { allowed(), ground(boat) -> 'boat' | 'other' | null,
//                                      carry(delta, yawDeg) }; `rate` the sea's seconds a second of the frame's `dt`
//     word(feet) -> [key, 0, x, y, z] | null           my place aboard, in her deck's own frame (the pose's `ab`)
//     ahead(entries, key, dt) -> { position, rotation } | null    the deck a reader stands a body on this frame
//     boat                              the boat of the ship I stand aboard, or null
//     leave()
//   }
//   entries: the naval host's sea entries - { boat, ship: { seed, cls: { id }, yaw, speed } }
//
// Not a DFU member: DFU has no ship to stand on, and the mod's boats carry their helmsman alone.
import { carriedPoint, yawDelta } from '../../systems/comeSailAway/comeSailAway.js';
import { deckPose, localOf, poseMatrix } from '../comeSailAway/comeSailAwayAboard.js';
import { POSE_ABOARD_LOCAL_MAX } from '../../net/wire.js';

/** A deck that moved farther than this in one frame was placed, not sailed (a copy snapped to its stander's word, a ship
 *  rebuilt): nobody is carried across it (CSA-K's law, navalHost.js PUPPET_SNAP_M's order). */
export const SEA_DECK_JUMP_M = 20;
/** The key a place aboard a sea ship names her by - her seed and her class, the same on every client's copy of her. */
export const seaDeckKey = (e) => `~sea:${(e?.ship?.seed ?? 0) >>> 0}:${e?.ship?.cls?.id ?? ''}`;
/** Whether a place aboard names a sea ship (a player's id never begins so). */
export const isSeaDeckKey = (key) => typeof key === 'string' && key.startsWith('~sea:');
const r2 = (v) => { const x = Math.round(v * 100) / 100; return x === 0 ? 0 : x; };
const copyPose = (p) => ({ position: [...p.position], rotation: [...p.rotation] });

/** @param {{ standsOn: (boat: any, feet: number[]) => boolean, feet: () => number[], swimming: () => boolean }} opts */
export function createSeaDecks({ standsOn, feet, swimming }) {
  /** @type {{ boat: any, key: string } | null} */
  let aboard = null;
  /** Each near ship's deck pose before the sea's frame posed her, by her boat. */
  const held = new Map();
  let rate = 1;

  const live = (e) => !!e?.boat?.GameObject?.activeSelf;
  /** On her this frame: the motor stands on her colliders, or on nothing with a floor of hers under the feet. */
  const on = (boat, me) => { const g = me.ground(boat); return g === 'boat' || (g == null && standsOn(boat, feet())); };
  function leave() { aboard = null; }

  function hold(entries) {
    held.clear();
    for (const e of entries) if (live(e)) held.set(e.boat, copyPose(deckPose(e.boat)));
  }

  function frame(entries, me, frameRate = 1) {
    rate = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 1;
    if (!me || !me.allowed()) { leave(); held.clear(); return null; }
    const list = [...entries];   // the sea's entries once (an iterator is spent by one walk)
    // aboard her from the frame the motor stood on her (its ground is its last step's, on her deck as it stood before
    // this frame posed her) - so that frame's move carries the body too, never leaves it a frame of her way behind
    if (!aboard && !swimming()) {
      for (const e of list) if (live(e) && held.has(e.boat) && on(e.boat, me)) { aboard = { boat: e.boat, key: seaDeckKey(e) }; break; }
    }
    if (aboard) {
      const e = list.find((x) => x.boat === aboard.boat);
      const before = held.get(aboard.boat);
      if (!live(e) || !before) leave();   // she is gone - sunk out of the world, faded, let go - or was not stood before
      else {
        const after = deckPose(e.boat);
        const at = feet();
        const to = carriedPoint(poseMatrix(before), poseMatrix(after), at);
        const delta = [to[0] - at[0], to[1] - at[1], to[2] - at[2]];
        if (Math.hypot(delta[0], delta[1], delta[2]) > SEA_DECK_JUMP_M) leave();   // a placement, never a carry
        else {
          const yaw = yawDelta(poseMatrix(before), poseMatrix(after));
          if (delta[0] || delta[1] || delta[2] || yaw) me.carry(delta, yaw);
          if (swimming() || !on(e.boat, me)) leave();
        }
      }
    }
    held.clear();
    return aboard?.boat ?? null;
  }

  function word(at) {
    if (!aboard || !Array.isArray(at)) return null;
    const l = localOf(deckPose(aboard.boat), at);
    if (!l || !l.every((v) => Math.abs(v) <= POSE_ABOARD_LOCAL_MAX)) return null;
    return [aboard.key, 0, r2(l[0]), r2(l[1]), r2(l[2])];
  }

  /** Her deck a frame ahead: her root carried on along her heading by her way over the sea's share of `dt` (the sea poses
   *  her after the online frame stands the others), her bob as it stands. */
  function ahead(entries, key, dt) {
    if (!isSeaDeckKey(key)) return null;
    for (const e of entries) {
      if (!live(e) || seaDeckKey(e) !== key) continue;
      const go = e.boat.GameObject, way = (Number(e.ship?.speed) || 0) * Math.max(0, Number(dt) || 0) * rate, yaw = Number(e.ship?.yaw) || 0;
      return deckPose(e.boat, { position: [go.position[0] + Math.sin(yaw) * way, go.position[1], go.position[2] + Math.cos(yaw) * way], rotation: go.rotation });
    }
    return null;
  }

  return { hold, frame, word, ahead, leave, get boat() { return aboard?.boat ?? null; }, get key() { return aboard?.key ?? null; } };
}
