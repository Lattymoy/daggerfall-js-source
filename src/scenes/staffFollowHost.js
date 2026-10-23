// @ts-check
// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow - What staff see: "The view is
// from the player's own eyes ... It stays locked on them everywhere ... It only lets go when staff press Unlock, or click
// another player's nameplate") - THE HOST'S HALF OF A FOLLOW, out of bootWorld (HOST-SPLIT). The follow itself is
// net/staffHook.js; this is what the scene does with it: while it is locked the host's own room is left (the staff
// member's body is in no room), the place the target's note names is entered the way a staff /tp enters it (the
// "spectator enter" - the TP host's prepare, never placed), and after the motor the camera sits at the target's eyes
// and faces where they face. Nothing here moves anyone but the staff member's own camera and body, and nothing fights.
import { staffDestinationKey } from '../net/staffTeleport.js';
import { createStaffHook, staffHookDoor } from '../net/staffHook.js';
import { RIDE_EYE_HEIGHT, CAPSULE_HEIGHT } from '../player/motor.js';   // a peer's eye, as the peers' bodies stand it (world.js: a rider's the saddle's)

/** `where()` names the place the staff member stands in (its mode and map pixel): let go, the body the camera carried
 *  stands where the target stood, so the host stays out of every room until it is somewhere else (a door, fast travel,
 *  a teleport, or a walk off that map pixel) - it never reappears beside the player it watched.
 *  @param {{ hook: any, prepare: (d: any) => Promise<any>, mode: () => string, where: () => string, toScene: (p: any) => number[] | null, eyeHeight: (p: any) => number }} deps */
export function createStaffFollowHost({ hook, prepare, mode, where, toScene, eyeHeight }) {
  let entered = /** @type {string|null} */ (null), entering = false, held = false, parked = /** @type {string|null} */ (null);
  return {
    /** The online frame: the follow ticked; true while the host must stand in no room - a follow locked, or let go
     *  where it left the body. */
    frame() {
      hook.tick();
      if (!hook.locked()) {
        if (held) { held = false; entered = null; parked = where(); }
        if (parked !== null && parked !== where()) parked = null;
        return parked !== null;
      }
      held = true;
      const d = hook.place();
      const key = d ? staffDestinationKey(d) : null;
      // the open air carries itself (the camera walks with the target, and the world streams under it) while they are seen
      if (d && !entering && key !== entered && !(d.kind === 'exterior' && mode() === 'exterior' && hook.view())) {
        entering = true;
        Promise.resolve().then(() => prepare(d))
          .catch((e) => console.warn('[staff] the follow could not enter their place:', e?.message ?? e))
          .finally(() => { entered = key; entering = false; });   // tried once a place: their next place tries again
      }
      return true;
    },
    /** After the motor took the eye: the camera at the target's eyes, the body under it (the world streams round the
     *  body). False while there is nothing to copy. @param {{ pos: number[], _airVelX?: number, _airVelZ?: number, velY?: number, falling?: boolean, fallStart?: number }} player @param {{ pos: number[], yaw: number, pitch: number }} cam */
    eye(player, cam) {
      const v = !entering && hook.locked() ? hook.view() : null;
      const q = v ? toScene(v) : null;
      if (!q) return false;
      player.pos[0] = q[0]; player.pos[1] = q[1]; player.pos[2] = q[2];
      // carried, never fallen: no flight is registered for a follow (the motor's one flight slot is a battle spectator's)
      player._airVelX = 0; player._airVelZ = 0; player.velY = 0; player.falling = false; player.fallStart = q[1];
      cam.pos = [q[0], q[1] + eyeHeight(v), q[2]];
      cam.yaw = v.yaw; cam.pitch = v.pitch;
      return true;
    },
  };
}

/** THE PAGE'S FOLLOW, made once by the host (scenes/world.js): the panel's door on this window, the hook behind it and
 *  the host's half above - so bootWorld wires one object. `follow(sub)` is a /tp's follow-on (mob, 06:01Z: "tp should
 *  auto follow form thier view"), taken only where a Staff Panel has spoken on this page: with none, no token comes.
 *  @param {{ main: () => any, prepare: (d: any) => Promise<any>, mode: () => string, pixel: () => { x: number, y: number }, toScene: (p: any) => number[] | null, win?: any, Session?: any }} deps */
export function staffFollowOnPage({ main, prepare, mode, pixel, toScene, win = globalThis.window, Session = undefined }) {
  const door = staffHookDoor(win, () => hook);
  const hook = createStaffHook({ main, askToken: door.askToken, ...(Session ? { Session } : {}) });
  const host = createStaffFollowHost({ hook, prepare, mode, where: () => `${mode()}|${pixel().x},${pixel().y}`, toScene, eyeHeight: (p) => (p.rd ? RIDE_EYE_HEIGHT : CAPSULE_HEIGHT - 0.2) });
  return {
    hook, frame: host.frame, eye: host.eye, locked: () => hook.locked(),
    follow: (/** @type {unknown} */ sub) => door.panel() && hook.follow(sub),
  };
}
