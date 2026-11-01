// @ts-check
// DRAGON5 (2026-10-29, the owner: "The dragon in non overworld view should be able to walk and fly if the player
// chooses. Simply jumping and holding should enable flight"; bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE
// MOUNT'S FLIGHT, PURE. On the ground a tamed dragon is ridden as a horse is. Jump held TAKEOFF_HOLD_S takes it up; aloft
// the motor levitates at DRAGON_FLY_SPEED where the rider looks (jump climbs, crouch dives) until the ground meets it.
// A winded dragon cannot take off, and one winded aloft sinks. Not a DFU member: Daggerfall has no flying mount.

/** Jump held this long, mounted, takes the dragon up, s. */
export const TAKEOFF_HOLD_S = 0.4;
/** Its pace aloft, m/s (the owner's answer, 2026-10-29: "Fly 25 m/s"). */
export const DRAGON_FLY_SPEED = 25;
/** The motor's own levitating pace (player/motor.js LEVITATE_MOVE_SPEED, pinned equal) - the flight is a multiple of it. */
export const LEVITATE_PACE = 4;
/** Aloft at least this long before the ground lands it, s: the takeoff's own climb clears the ground it left. */
export const DRAGON_LAND_AFTER_S = 0.6;
/** A winded dragon's sink aloft, of its pace: it glides down. */
export const DRAGON_GLIDE_SINK = 0.35;

/** One rider's flight: `{ step(dt, s), lift(), aloft(), flyMult(), sink(), land() }`. */
export function createDragonFlight() {
  let aloft = false,
    held = 0,
    air = 0,
    winded = false;
  const land = () => {
    const was = aloft;
    aloft = false;
    held = 0;
    air = 0;
    return was;
  };
  return {
    /**
     * One step of the motor: `mounted` on the dragon, `outdoors` (a door dismounts), `jump` held, `grounded`, `winded`
     * (horse care's breath spent). Answers 'took-off', 'landed' or null.
     * @param {number} dt @param {{ mounted: boolean, outdoors?: boolean, jump: boolean, grounded: boolean, winded?: boolean }} s
     * @returns {'took-off' | 'landed' | null}
     */
    step(dt, s) {
      winded = !!s.winded;
      if (!s.mounted || s.outdoors === false) return land() ? 'landed' : null;
      if (aloft) {
        air += dt;
        return s.grounded && air >= DRAGON_LAND_AFTER_S ? (land(), 'landed') : null;
      }
      held = s.jump ? held + dt : 0;
      if (held < TAKEOFF_HOLD_S || winded) return null;
      aloft = true;
      held = 0;
      air = 0;
      return 'took-off';
    },
    /** Into the air whatever the jump and the breath (a dragon caught falling spreads its wings): false if aloft. */
    lift() {
      if (aloft) return false;
      aloft = true;
      held = 0;
      air = 0;
      return true;
    },
    aloft: () => aloft,
    /** The motor's levitating pace times this while aloft (player/motor.js registerFlySpeedMod). */
    flyMult: () => (aloft ? DRAGON_FLY_SPEED / LEVITATE_PACE : 1),
    /** The sink aloft, of the pace: none unless winded. */
    sink: () => (aloft && winded ? DRAGON_GLIDE_SINK : 0),
    land,
  };
}
